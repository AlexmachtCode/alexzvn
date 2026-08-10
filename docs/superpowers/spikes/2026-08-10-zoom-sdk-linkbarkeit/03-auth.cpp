// Stage-0-Sondierlauf, dritter Teil: die eigentliche Frage.
//
//   Hat dieses Konto die ROHDATEN-BERECHTIGUNG?
//
// Vor der Anmeldung ist HasRawdataLicense() nichtssagend — es meldet immer false, weil die
// Berechtigung ueber das JWT am Konto haengt. Erst NACH erfolgreicher Anmeldung ist die
// Antwort belastbar. Genau das prueft dieser Lauf.
//
// Nebenbei bewiesen wird die zweite Voraussetzung von Stage 1: SDKAuth antwortet
// ASYNCHRON ueber onAuthenticationReturn. Ohne eine laufende Win32-Nachrichtenschleife
// kommt der Rueckruf NIE an — ein utilityProcess hat keine, deshalb muss die Bridge ihre
// eigene mitbringen. Hier laeuft sie zum ersten Mal gegen das echte SDK.
//
// Das JWT kommt aus der Umgebungsvariable ZOOM_SDK_JWT. Dieses Programm sieht weder
// Client-ID noch Secret und gibt das JWT nirgends aus.

#include <cstdio>
#include <cstdlib>
#include <cwchar>
#include <string>
#include <windows.h>
#include "zoom_sdk.h"
#include "auth_service_interface.h"
#include "rawdata/zoom_rawdata_api.h"

USING_ZOOM_SDK_NAMESPACE

namespace {

volatile bool g_done = false;
AuthResult g_result = AUTHRET_NONE;

const wchar_t* AuthResultName(AuthResult r) {
  switch (r) {
    case AUTHRET_SUCCESS: return L"AUTHRET_SUCCESS";
    case AUTHRET_KEYORSECRETEMPTY: return L"AUTHRET_KEYORSECRETEMPTY (Schluessel/Secret leer)";
    case AUTHRET_KEYORSECRETWRONG: return L"AUTHRET_KEYORSECRETWRONG (Schluessel/Secret falsch)";
    case AUTHRET_ACCOUNTNOTSUPPORT: return L"AUTHRET_ACCOUNTNOTSUPPORT (Konto unterstuetzt das nicht)";
    case AUTHRET_ACCOUNTNOTENABLESDK: return L"AUTHRET_ACCOUNTNOTENABLESDK (SDK fuer das Konto nicht freigeschaltet)";
    case AUTHRET_JWTTOKENWRONG: return L"AUTHRET_JWTTOKENWRONG (JWT fehlerhaft)";
    case AUTHRET_OVERTIME: return L"AUTHRET_OVERTIME (Zeitueberschreitung)";
    case AUTHRET_NETWORKISSUE: return L"AUTHRET_NETWORKISSUE (Netzwerkproblem)";
    case AUTHRET_CLIENT_INCOMPATIBLE: return L"AUTHRET_CLIENT_INCOMPATIBLE";
    case AUTHRET_LIMIT_EXCEEDED_EXCEPTION: return L"AUTHRET_LIMIT_EXCEEDED_EXCEPTION";
    case AUTHRET_SERVICE_BUSY: return L"AUTHRET_SERVICE_BUSY";
    case AUTHRET_NONE: return L"AUTHRET_NONE (kein Ergebnis)";
    default: return L"AUTHRET_UNKNOWN";
  }
}

class AuthListener : public IAuthServiceEvent {
 public:
  void onAuthenticationReturn(AuthResult ret) override {
    g_result = ret;
    g_done = true;
  }
  void onLoginReturnWithReason(LOGINSTATUS, IAccountInfo*, LoginFailReason) override {}
  void onLogout() override {}
  void onZoomIdentityExpired() override {}
  void onZoomAuthIdentityExpired() override {}
  void onNotificationServiceStatus(SDKNotificationServiceStatus, SDKNotificationServiceError) override {}
};

/** Nachrichtenschleife mit Zeitgrenze. Gibt false zurueck, wenn die Zeit ablief. */
bool PumpUntilDone(int seconds) {
  const ULONGLONG deadline = GetTickCount64() + static_cast<ULONGLONG>(seconds) * 1000;
  MSG msg;
  while (!g_done) {
    while (PeekMessageW(&msg, nullptr, 0, 0, PM_REMOVE)) {
      TranslateMessage(&msg);
      DispatchMessageW(&msg);
    }
    if (GetTickCount64() > deadline) return false;
    Sleep(20);
  }
  return true;
}

}  // namespace

int main() {
  char* jwtRaw = nullptr;
  size_t jwtLen = 0;
  if (_dupenv_s(&jwtRaw, &jwtLen, "ZOOM_SDK_JWT") != 0 || !jwtRaw || jwtLen <= 1) {
    std::fwprintf(stderr, L"ZOOM_SDK_JWT ist nicht gesetzt. Erst make-jwt.mjs laufen lassen.\n");
    return 2;
  }
  const std::wstring jwt(jwtRaw, jwtRaw + strlen(jwtRaw));
  free(jwtRaw);

  InitParam p;
  p.strWebDomain = L"https://zoom.us";
  p.strBrandingName = L"JM Connect Spike";
  p.emLanguageID = LANGUAGE_German;
  p.enableGenerateDump = false;
  p.enableLogByDefault = false;
  // Ohne diese Setzung liefert das SDK spaeter keine Rohdaten. Gehoert schon hierher,
  // damit der Lauf denselben Zustand pruefe wie die spaetere Bridge.
  p.rawdataOpts.enableRawdataIntermediateMode = false;
  p.rawdataOpts.videoRawdataMemoryMode = ZoomSDKRawDataMemoryModeStack;
  p.rawdataOpts.audioRawdataMemoryMode = ZoomSDKRawDataMemoryModeStack;
  p.rawdataOpts.shareRawdataMemoryMode = ZoomSDKRawDataMemoryModeStack;

  if (InitSDK(p) != SDKERR_SUCCESS) {
    std::fwprintf(stderr, L"InitSDK fehlgeschlagen.\n");
    return 1;
  }
  wprintf(L"InitSDK()                    -> ok\n");
  wprintf(L"vor  Anmeldung: HasRawdataLicense() -> %s\n", HasRawdataLicense() ? L"true" : L"false");

  IAuthService* auth = nullptr;
  if (CreateAuthService(&auth) != SDKERR_SUCCESS || !auth) {
    std::fwprintf(stderr, L"CreateAuthService fehlgeschlagen.\n");
    CleanUPSDK();
    return 1;
  }

  AuthListener listener;
  auth->SetEvent(&listener);

  AuthContext ctx;
  ctx.jwt_token = jwt.c_str();
  const SDKError authErr = auth->SDKAuth(ctx);
  wprintf(L"SDKAuth()                    -> SDKError=%d (nur Annahme, Ergebnis kommt asynchron)\n",
          (int)authErr);

  if (!PumpUntilDone(30)) {
    wprintf(L"\nKein Rueckruf innerhalb von 30 s.\n");
    wprintf(L"Das heisst NICHT automatisch, dass die Anmeldung scheiterte — es heisst, dass kein\n");
    wprintf(L"Ergebnis eintraf. Netz, Uhrzeit (JWT-iat/exp) oder Nachrichtenschleife pruefen.\n");
    DestroyAuthService(auth);
    CleanUPSDK();
    return 1;
  }

  wprintf(L"\nonAuthenticationReturn       -> %s\n", AuthResultName(g_result));

  if (g_result == AUTHRET_SUCCESS) {
    const bool lic = HasRawdataLicense();
    wprintf(L"nach Anmeldung: HasRawdataLicense() -> %s\n", lic ? L"TRUE" : L"FALSE");
    wprintf(L"\n==> %s\n",
            lic ? L"Rohdaten-Berechtigung VORHANDEN. Stage 0 ist durch, Stage 1 kann beginnen."
                : L"Rohdaten-Berechtigung FEHLT. Ohne sie gibt es kein Rohvideo und keinen Ton je\n"
                  L"    Person — dann greift der Ausweg VideoCom Bridge aus der Roadmap.");
  } else {
    wprintf(L"\n==> Anmeldung nicht erfolgreich — HasRawdataLicense() bleibt aussagelos.\n");
  }

  DestroyAuthService(auth);
  CleanUPSDK();
  return g_result == AUTHRET_SUCCESS ? 0 : 1;
}
