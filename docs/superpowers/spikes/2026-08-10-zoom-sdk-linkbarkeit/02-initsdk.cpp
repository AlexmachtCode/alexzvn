// Stage-0-Sondierlauf, zweiter Teil: traegt InitSDK ohne Marketplace-Zugangsdaten?
//
// InitSDK richtet nur das SDK ein; die ANMELDUNG ist ein eigener Schritt ueber
// IAuthService mit einem JWT. Wenn InitSDK ohne Zugangsdaten durchgeht, steht das
// Fundament von Stage 1 (Bridge-Geruest) — und HasRawdataLicense() laesst sich
// danach ehrlicher befragen als vorher.

#include <cstdio>
#include <cwchar>
#include <windows.h>
#include "zoom_sdk.h"
#include "rawdata/zoom_rawdata_api.h"

USING_ZOOM_SDK_NAMESPACE

int main() {
  wprintf(L"vor  InitSDK: HasRawdataLicense() -> %s\n", HasRawdataLicense() ? L"true" : L"false");

  InitParam p;
  p.strWebDomain = L"https://zoom.us";
  p.strBrandingName = L"JM Connect Spike";
  p.emLanguageID = LANGUAGE_German;
  p.enableGenerateDump = false;
  p.enableLogByDefault = false;
  // Der entscheidende Schalter: ohne ihn liefert das SDK gar keine Rohdaten.
  p.rawdataOpts.enableRawdataIntermediateMode = false;
  p.rawdataOpts.videoRawdataMemoryMode = ZoomSDKRawDataMemoryModeStack;
  p.rawdataOpts.audioRawdataMemoryMode = ZoomSDKRawDataMemoryModeStack;
  p.rawdataOpts.shareRawdataMemoryMode = ZoomSDKRawDataMemoryModeStack;

  const SDKError initErr = InitSDK(p);
  wprintf(L"InitSDK()                         -> SDKError=%d\n", (int)initErr);

  if (initErr == SDKERR_SUCCESS) {
    wprintf(L"nach InitSDK: HasRawdataLicense() -> %s\n", HasRawdataLicense() ? L"true" : L"false");

    IAuthService* auth = nullptr;
    const SDKError authErr = CreateAuthService(&auth);
    wprintf(L"CreateAuthService()               -> SDKError=%d, ptr=%p\n", (int)authErr, (void*)auth);
    if (auth) DestroyAuthService(auth);

    IMeetingService* svc = nullptr;
    const SDKError svcErr = CreateMeetingService(&svc);
    wprintf(L"CreateMeetingService()            -> SDKError=%d, ptr=%p\n", (int)svcErr, (void*)svc);
    if (svc) DestroyMeetingService(svc);

    CleanUPSDK();
    wprintf(L"CleanUPSDK()                      -> ok\n");
  }
  return 0;
}
