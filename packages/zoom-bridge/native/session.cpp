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

std::string fieldFromJson(const std::string& line, const char* key) {
  const std::string needle = std::string("\"") + key + "\"";
  size_t at = line.find(needle);
  if (at == std::string::npos) return "";
  at = line.find(':', at + needle.size());
  if (at == std::string::npos) return "";
  at = line.find('"', at);
  if (at == std::string::npos) return "";
  ++at;

  std::string out;
  while (at < line.size()) {
    const char c = line[at];
    if (c == '\\' && at + 1 < line.size()) {
      const char n = line[at + 1];
      switch (n) {
        case 'n': out += '\n'; break;
        case 'r': out += '\r'; break;
        case 't': out += '\t'; break;
        case 'b': out += '\b'; break;
        case 'f': out += '\f'; break;
        default:  out += n;    break;  // \" \\ \/ und alles andere woertlich
      }
      at += 2;
      continue;
    }
    if (c == '"') break;
    out += c;
    ++at;
  }
  return out;
}

std::string cmdOf(const std::string& line) {
  return fieldFromJson(line, "cmd");
}
