// zoom-bridge.exe - Stage 1.
// Diese Fassung beweist nur die Baukette: sie meldet die SDK-Fassung und endet.
// Nachrichtenschleife, stdin-Leser und Befehle kommen in Task 5.
#include <string>
#include <windows.h>
#include "zoom_sdk.h"
#include "emit.h"

USING_ZOOM_SDK_NAMESPACE

int main() {
  const zchar_t* version = GetSDKVersion();
  const std::wstring v = version ? std::wstring(version) : L"(unbekannt)";
  emitRaw(std::string("{\"ev\":\"ready\",\"sdkVersion\":\"") + jsonEscape(v) + "\"}");
  emitRaw("{\"ev\":\"bye\"}");
  return 0;
}
