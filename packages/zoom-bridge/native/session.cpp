#include "session.h"
#include <cstdlib>
#include <windows.h>
#include "zoom_sdk.h"
#include "meeting_service_interface.h"
#include "emit.h"
#include "callbacks.h"

USING_ZOOM_SDK_NAMESPACE

namespace {
bool g_sdkUp = false;
}

namespace {
IAuthService* g_auth = nullptr;
AuthListener g_authListener;
// Siehe sessionAuthPending() in session.h: schuetzt die asynchrone Antwort vor
// einem verfruehten Prozessende bei geschlossenem stdin.
bool g_authPending = false;

IMeetingService* g_meeting = nullptr;
MeetingListener g_meetingListener;
// Siehe sessionJoinPending() in session.h: derselbe Schutz wie g_authPending,
// nur fuer die ERSTE Statusmeldung eines Beitritts statt fuer die Anmeldung.
bool g_joinPending = false;

std::wstring toWide(const std::string& utf8) {
  const int need = MultiByteToWideChar(CP_UTF8, 0, utf8.c_str(), static_cast<int>(utf8.size()), nullptr, 0);
  std::wstring w(static_cast<size_t>(need), L'\0');
  if (need > 0) {
    MultiByteToWideChar(CP_UTF8, 0, utf8.c_str(), static_cast<int>(utf8.size()), w.data(), need);
  }
  return w;
}
}  // namespace

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

void sessionAuth(const std::string& jwtUtf8) {
  if (!g_sdkUp) {
    emitRaw("{\"ev\":\"error\",\"where\":\"auth\",\"code\":7}");  // SDKERR_UNINITIALIZE
    return;
  }
  if (g_auth == nullptr) {
    const SDKError err = CreateAuthService(&g_auth);
    if (err != SDKERR_SUCCESS || g_auth == nullptr) {
      emitRaw("{\"ev\":\"error\",\"where\":\"auth\",\"code\":" + std::to_string(static_cast<int>(err)) + "}");
      return;
    }
    g_auth->SetEvent(&g_authListener);
  }

  // Das JWT lebt nur bis zum Ende dieses Aufrufs und wird nie ausgegeben.
  const std::wstring jwt = toWide(jwtUtf8);
  AuthContext ctx;
  ctx.jwt_token = jwt.c_str();
  const SDKError err = g_auth->SDKAuth(ctx);
  if (err != SDKERR_SUCCESS) {
    emitRaw("{\"ev\":\"error\",\"where\":\"auth\",\"code\":" + std::to_string(static_cast<int>(err)) + "}");
    return;
  }
  // Bei Erfolg wird hier NICHTS gemeldet: die Antwort kommt asynchron.
  // Bis onAuthenticationReturn feuert (sessionAuthAnswered()), gilt die
  // Anmeldung als offen - siehe sessionAuthPending().
  g_authPending = true;
}

bool sessionAuthPending() {
  return g_authPending;
}

void sessionAuthAnswered() {
  g_authPending = false;
}

void sessionJoin(const std::string& meetingIdUtf8, const std::string& passcodeUtf8, const std::string& displayNameUtf8) {
  if (!g_sdkUp) {
    emitRaw("{\"ev\":\"error\",\"where\":\"join\",\"code\":7}");  // SDKERR_UNINITIALIZE
    return;
  }
  if (g_meeting == nullptr) {
    const SDKError err = CreateMeetingService(&g_meeting);
    if (err != SDKERR_SUCCESS || g_meeting == nullptr) {
      emitRaw("{\"ev\":\"error\",\"where\":\"join\",\"code\":" + std::to_string(static_cast<int>(err)) + "}");
      return;
    }
    g_meeting->SetEvent(&g_meetingListener);
  }

  const UINT64 number = _strtoui64(meetingIdUtf8.c_str(), nullptr, 10);
  if (number == 0) {
    emitRaw("{\"ev\":\"error\",\"where\":\"join\",\"code\":3}");  // SDKERR_INVALID_PARAMETER
    return;
  }

  const std::wstring name = toWide(displayNameUtf8);
  const std::wstring psw = toWide(passcodeUtf8);

  JoinParam jp;
  jp.userType = SDK_UT_WITHOUT_LOGIN;
  JoinParam4WithoutLogin& w = jp.param.withoutloginuserJoin;
  w.meetingNumber = number;
  w.userName = name.c_str();
  w.psw = psw.empty() ? nullptr : psw.c_str();
  // Die Bridge sendet NICHTS. Sie hoert nur zu.
  w.isVideoOff = true;
  w.isAudioOff = true;

  const SDKError err = g_meeting->Join(jp);
  if (err != SDKERR_SUCCESS) {
    emitRaw("{\"ev\":\"error\",\"where\":\"join\",\"code\":" + std::to_string(static_cast<int>(err)) + "}");
    return;
  }
  // Bei Erfolg NICHTS melden: das Ergebnis kommt als Statusfolge.
  // Ab hier gilt der Beitritt als offen, bis die ERSTE Statusmeldung eintrifft
  // (sessionJoinAnswered(), von MeetingListener::onMeetingStatusChanged gerufen)
  // - siehe sessionJoinPending() in session.h. Derselbe Verschluck-Mechanismus
  // wie bei sessionAuth(): ohne diese Markierung koennte EOF den Beitritt
  // beenden, bevor auch nur eine Pumprunde eine Rueckmeldung bringt.
  g_joinPending = true;
}

void sessionLeave() {
  if (g_meeting == nullptr) return;
  g_meeting->Leave(LEAVE_MEETING);
  // Erst SAUBER VERLASSEN, dann abbauen - bis zu 5 s pumpen. Ein
  // DestroyMeetingService waehrend CONNECTING hat den Stage-0-Spike mit
  // 0xC0000005 beendet: der Abbau raeumt Zustand weg, an dem der SDK-Thread
  // noch arbeitet.
  const ULONGLONG deadline = GetTickCount64() + 5000;
  while (GetTickCount64() < deadline) {
    pumpOnce();
    const MeetingStatus s = g_meeting->GetMeetingStatus();
    if (s == MEETING_STATUS_ENDED || s == MEETING_STATUS_IDLE) break;
    Sleep(20);
  }
}

bool sessionJoinPending() {
  return g_joinPending;
}

void sessionJoinAnswered() {
  g_joinPending = false;
}

void sessionShutdown() {
  if (!g_sdkUp) return;
  if (g_meeting != nullptr) {
    sessionLeave();
    g_meeting->SetEvent(nullptr);
    DestroyMeetingService(g_meeting);
    g_meeting = nullptr;
  }
  if (g_auth != nullptr) {
    g_auth->SetEvent(nullptr);
    DestroyAuthService(g_auth);
    g_auth = nullptr;
  }
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
