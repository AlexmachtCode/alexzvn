#include "session.h"
#include <windows.h>
#include "zoom_sdk.h"
#include "emit.h"

USING_ZOOM_SDK_NAMESPACE

namespace {
bool g_sdkUp = false;
}

void pumpOnce() {
  MSG msg;
  while (PeekMessageW(&msg, nullptr, 0, 0, PM_REMOVE)) {
    TranslateMessage(&msg);
    DispatchMessageW(&msg);
  }
}

bool sessionInit() {
  if (g_sdkUp) {
    emitRaw("{\"ev\":\"error\",\"where\":\"init\",\"code\":2}");  // SDKERR_WRONG_USAGE
    return false;
  }

  InitParam p;
  p.strWebDomain = L"https://zoom.us";
  p.strBrandingName = L"JM Connect";
  p.emLanguageID = LANGUAGE_German;
  p.enableGenerateDump = false;
  p.enableLogByDefault = false;
  // Muss stehen, BEVOR Rohdaten fliessen (Stage 2/3). Hier schadet es nicht.
  p.rawdataOpts.enableRawdataIntermediateMode = false;
  p.rawdataOpts.videoRawdataMemoryMode = ZoomSDKRawDataMemoryModeStack;
  p.rawdataOpts.audioRawdataMemoryMode = ZoomSDKRawDataMemoryModeStack;
  p.rawdataOpts.shareRawdataMemoryMode = ZoomSDKRawDataMemoryModeStack;

  // ACHTUNG: OHNE DIESE ZEILE HAENGT DER BEITRITT BEI CONNECTING.
  // Vorgabe ist der Zoom-UI-Modus: das SDK will ein eigenes Meeting-FENSTER
  // aufmachen. Die Bridge hat keines. Der Beitritt scheitert dann nicht - er
  // haengt, und das sieht aus wie ein Netzwerkproblem. Im Stage-0-Spike gemessen:
  // 90 Sekunden Schweigen bei CONNECTING.
  p.obConfigOpts.optionalFeatures = ENABLE_CUSTOMIZED_UI_FLAG;

  const SDKError err = InitSDK(p);
  if (err != SDKERR_SUCCESS) {
    emitRaw("{\"ev\":\"error\",\"where\":\"init\",\"code\":" + std::to_string(static_cast<int>(err)) + "}");
    emitLog(L"InitSDK fehlgeschlagen.");
    return false;
  }
  g_sdkUp = true;

  const zchar_t* v = GetSDKVersion();
  emitRaw(std::string("{\"ev\":\"ready\",\"sdkVersion\":\"") + jsonEscape(v ? v : L"(unbekannt)") + "\"}");
  return true;
}

void sessionShutdown() {
  if (!g_sdkUp) return;
  CleanUPSDK();
  g_sdkUp = false;
}

namespace {

bool isJsonSpace(char c) { return c == ' ' || c == '\t'; }

// Liest den Zeichenkettenwert, der bei "at" (dem oeffnenden Anfuehrungszeichen)
// beginnt, mit denselben Maskierungsregeln wie der Rest des Lesers.
std::string readStringValue(const std::string& line, size_t at) {
  std::string out;
  size_t i = at + 1;
  while (i < line.size()) {
    const char c = line[i];
    if (c == '\\' && i + 1 < line.size()) {
      const char n = line[i + 1];
      switch (n) {
        case 'n': out += '\n'; break;
        case 'r': out += '\r'; break;
        case 't': out += '\t'; break;
        case 'b': out += '\b'; break;
        case 'f': out += '\f'; break;
        default:  out += n;    break;  // \" \\ \/ und alles andere woertlich
      }
      i += 2;
      continue;
    }
    if (c == '"') break;
    out += c;
    ++i;
  }
  return out;
}

}  // namespace

std::string fieldFromJson(const std::string& line, const char* key) {
  // Der Leser bleibt bewusst schlicht: fuenf Befehle, ausschliesslich flache
  // Zeichenkettenfelder (siehe session.h). Er sucht daher NICHT nach einem
  // Baum, sondern nach der Zeichenfolge des Schluessels und prueft an dieser
  // Stelle nur zwei Dinge nach: steht unmittelbar davor ein '{' oder ein ','
  // (also eine SCHLUESSEL-Position, keine WERT-Position), und folgt nach dem
  // Doppelpunkt wieder ein Anfuehrungszeichen (also ein STRING-Wert, keine
  // Zahl, kein Objekt, kein Array)? Beides muss stimmen, sonst gilt das Feld
  // als nicht gefunden - das ist fuer dieses Protokoll richtig, waere aber
  // falsch fuer allgemeines JSON (verschachtelte Objekte, Zahlenfelder,
  // Arrays erkennt dieser Leser gar nicht und soll er auch nicht).
  const std::string needle = std::string("\"") + key + "\"";
  size_t searchFrom = 0;

  while (true) {
    size_t at = line.find(needle, searchFrom);
    if (at == std::string::npos) return "";

    bool isKeyPosition = false;
    size_t p = at;
    while (p > 0 && isJsonSpace(line[p - 1])) --p;
    if (p > 0 && (line[p - 1] == '{' || line[p - 1] == ',')) isKeyPosition = true;

    if (isKeyPosition) {
      size_t after = at + needle.size();
      while (after < line.size() && isJsonSpace(line[after])) ++after;
      if (after < line.size() && line[after] == ':') {
        ++after;
        while (after < line.size() && isJsonSpace(line[after])) ++after;
        if (after < line.size() && line[after] == '"') {
          return readStringValue(line, after);
        }
      }
    }

    // Kein gueltiges Schluessel-Wert-Paar an dieser Stelle (z.B. der
    // Schluesselname tauchte hier als WERT eines anderen Feldes auf, oder
    // sein Wert ist keine Zeichenkette) - an der naechsten Fundstelle weiter
    // suchen statt sofort aufzugeben.
    searchFrom = at + needle.size();
  }
}

std::string cmdOf(const std::string& line) {
  return fieldFromJson(line, "cmd");
}
