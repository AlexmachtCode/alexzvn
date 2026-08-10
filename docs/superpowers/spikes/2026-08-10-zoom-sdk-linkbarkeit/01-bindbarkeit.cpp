// Stage-0-Sondierlauf: Laesst sich das Zoom-Meeting-SDK gegen eine SELBST erzeugte
// Import-Bibliothek binden — ohne das offizielle sdk.lib?
//
// Geprueft wird genau das und nichts weiter:
//   1. Die Kopfdateien uebersetzen (der C#-Wrapper bringt den vollen C++-Kopfsatz mit).
//   2. Der Binder findet die Symbole in der aus sdk.dll erzeugten Bibliothek.
//   3. Das Programm laeuft und bekommt echte Werte aus der DLL.
//
// KEIN Meeting, KEINE Anmeldung, KEIN Rohvideo — das braucht die Marketplace-App.

#include <cstdio>
#include <cwchar>
#include <windows.h>
#include "zoom_sdk.h"
#include "rawdata/zoom_rawdata_api.h"

USING_ZOOM_SDK_NAMESPACE

int main() {
  // 1. Version aus der DLL holen. Braucht weder Init noch Anmeldung —
  //    beweist, dass die Bindung wirklich traegt und nicht nur uebersetzt.
  const zchar_t* v = GetSDKVersion();
  wprintf(L"GetSDKVersion()            -> %s\n", v ? v : L"(null)");

  // 2. Die Rohdaten-Einstiegspunkte. Dass sie bindbar sind, ist die eigentliche
  //    Frage von Stage 0: ohne sie gibt es kein Bild und keinen Ton je Person.
  wprintf(L"HasRawdataLicense()        -> %s\n", HasRawdataLicense() ? L"true" : L"false");
  wprintf(L"GetRawdataVideoSourceHelper -> %p\n", (void*)GetRawdataVideoSourceHelper());
  wprintf(L"GetAudioRawdataHelper      -> %p\n", (void*)GetAudioRawdataHelper());

  // 3. Ein Dienst, den man ohne Anmeldung erzeugen darf. Zeigt, dass auch die
  //    Schnittstellen-Fabriken erreichbar sind, nicht nur freie Funktionen.
  IMeetingService* svc = nullptr;
  const SDKError err = CreateMeetingService(&svc);
  wprintf(L"CreateMeetingService()     -> SDKError=%d, ptr=%p\n", (int)err, (void*)svc);
  if (svc) DestroyMeetingService(svc);

  return 0;
}
