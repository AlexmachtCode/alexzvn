// N-API-Addon fuer die Blackmagic-DeckLink-AUSGABE (SDI). Nur Windows, nur Ausgang,
// nur Bild — Ton, Halbbilder und Karten-Eingaenge sind ausdrueckliche Nicht-Ziele.
// Entwurf: docs/superpowers/specs/2026-08-07-decklink-output-design.md
//
// Die Schnittstelle ist COM. DeckLinkAPI.h und die GUID-Datei entstehen erst beim Bau
// aus der IDL des SDK (scripts/generate-idl.mjs) — das SDK liefert KEINE fertigen
// Header und KEINE Import-Bibliothek. Zur Laufzeit kommt die Implementierung aus dem
// installierten Desktop-Video-Treiber; mitzuliefern ist nichts.

#include <napi.h>
#include <windows.h>
// windows.h zieht ole2.h (und damit objbase.h/unknwn.h, Quelle des interface-Makros,
// IUnknown, CoInitializeEx/CoCreateInstance) NUR ein, wenn WIN32_LEAN_AND_MEAN NICHT
// gesetzt ist. binding.gyp setzt es aber (schlankerer Build) — deshalb hier explizit.
#include <objbase.h>
#include <oleauto.h>  // BSTR: SysStringLen/SysFreeString.
#include "DeckLinkAPI.h"

#include <atomic>
#include <cstring>
#include <string>

namespace {

bool g_comReady = false;

void ThrowJs(napi_env env, const char* message) {
  napi_throw_error(env, nullptr, message);
}

/** BSTR nach UTF-8 uebernehmen UND freigeben. */
std::string TakeBstr(BSTR bstr) {
  if (!bstr) return std::string();
  const int wlen = static_cast<int>(SysStringLen(bstr));
  std::string out;
  if (wlen > 0) {
    const int len = WideCharToMultiByte(CP_UTF8, 0, bstr, wlen, nullptr, 0, nullptr, nullptr);
    if (len > 0) {
      out.resize(static_cast<size_t>(len));
      WideCharToMultiByte(CP_UTF8, 0, bstr, wlen, &out[0], len, nullptr, nullptr);
    }
  }
  SysFreeString(bstr);
  return out;
}

/** BMDDisplayMode ist ein FourCC. Als lesbares Vierzeichenkuerzel ausgeben ('Hp25'). */
std::string FourCcToString(uint32_t code) {
  const char s[5] = {
      static_cast<char>((code >> 24) & 0xFF),
      static_cast<char>((code >> 16) & 0xFF),
      static_cast<char>((code >> 8) & 0xFF),
      static_cast<char>(code & 0xFF),
      0,
  };
  return std::string(s);
}

uint32_t StringToFourCc(const std::string& s) {
  if (s.size() != 4) return 0;
  return (static_cast<uint32_t>(static_cast<unsigned char>(s[0])) << 24) |
         (static_cast<uint32_t>(static_cast<unsigned char>(s[1])) << 16) |
         (static_cast<uint32_t>(static_cast<unsigned char>(s[2])) << 8) |
         static_cast<uint32_t>(static_cast<unsigned char>(s[3]));
}

/** Iterator anlegen. nullptr heisst: Desktop Video ist nicht installiert. */
IDeckLinkIterator* NewIterator() {
  IDeckLinkIterator* it = nullptr;
  const HRESULT hr = CoCreateInstance(CLSID_CDeckLinkIterator, nullptr, CLSCTX_ALL,
                                      IID_IDeckLinkIterator, reinterpret_cast<void**>(&it));
  return SUCCEEDED(hr) ? it : nullptr;
}

/**
 * Die n-te Karte holen. Der Aufrufer gibt sie frei.
 *
 * Bei Misserfolg liefert die Funktion eine UNTERSCHEIDBARE Begruendung statt eines blossen
 * nullptr: fehlender Treiber, gar keine Karte und "diesen Index gibt es nicht" sind drei
 * verschiedene Ursachen und verlangen drei verschiedene Meldungen. Eine gemeinsame Meldung
 * zerstoert genau die Diagnose, fuer die man sie braucht.
 *
 * `errorOut` zeigt danach auf eine statische Zeichenkette oder auf nullptr bei Erfolg.
 */
IDeckLink* DeviceAt(uint32_t index, const char** errorOut) {
  if (errorOut) *errorOut = nullptr;

  IDeckLinkIterator* it = NewIterator();
  if (!it) {
    if (errorOut) *errorOut = "Blackmagic Desktop Video ist nicht installiert.";
    return nullptr;
  }

  IDeckLink* dev = nullptr;
  uint32_t i = 0;
  while (it->Next(&dev) == S_OK) {
    if (i == index) {
      it->Release();
      return dev;
    }
    dev->Release();
    dev = nullptr;
    i++;
  }
  it->Release();

  if (errorOut) {
    // i ist jetzt die Anzahl gefundener Karten.
    *errorOut = (i == 0) ? "Keine Blackmagic-Karte gefunden." : "Keine Karte mit diesem Index.";
  }
  return nullptr;
}

// init(): COM hochfahren.
// MTA, NICHT STA: der utilityProcess, der dieses Addon spaeter traegt, hat keine
// Windows-Nachrichtenschleife — ein Wohnungsmodell mit Pumpe wuerde dort verklemmen.
// Die DeckLink-Schnittstellen sind frei threadfaehig und brauchen keine Pumpe.
Napi::Value Init(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (!g_comReady) {
    const HRESULT hr = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
    // RPC_E_CHANGED_MODE heisst nur: COM laeuft schon, in einem anderen Modell.
    // Fuer uns kein Fehler.
    if (FAILED(hr) && hr != RPC_E_CHANGED_MODE) {
      ThrowJs(env, "CoInitializeEx fehlgeschlagen.");
      return env.Undefined();
    }
    g_comReady = true;
  }
  return Napi::Boolean::New(env, true);
}

// listDevices(): alle Karten. EINE LEERE LISTE IST EIN GUELTIGES ERGEBNIS —
// nur ein fehlender Treiber wirft.
Napi::Value ListDevices(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  IDeckLinkIterator* it = NewIterator();
  if (!it) {
    ThrowJs(env, "Blackmagic Desktop Video ist nicht installiert.");
    return env.Undefined();
  }

  Napi::Array out = Napi::Array::New(env);
  IDeckLink* dev = nullptr;
  uint32_t i = 0;
  while (it->Next(&dev) == S_OK) {
    BSTR nameBstr = nullptr;
    const std::string name =
        (dev->GetDisplayName(&nameBstr) == S_OK) ? TakeBstr(nameBstr) : std::string("DeckLink");

    IDeckLinkOutput* outIface = nullptr;
    const bool hasOutput =
        dev->QueryInterface(IID_IDeckLinkOutput, reinterpret_cast<void**>(&outIface)) == S_OK;
    if (outIface) outIface->Release();

    Napi::Object o = Napi::Object::New(env);
    o.Set("index", Napi::Number::New(env, i));
    o.Set("name", Napi::String::New(env, name));
    o.Set("hasOutput", Napi::Boolean::New(env, hasOutput));
    out.Set(i, o);

    dev->Release();
    dev = nullptr;
    i++;
  }
  it->Release();
  return out;
}

// listOutputModes(deviceIndex): BESCHREIBT jede Norm der Karte. Das Urteil, welche
// benutzbar ist, faellt bewusst in src/modes.ts — dort ist es ohne Hardware pruefbar.
Napi::Value ListOutputModes(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 1 || !info[0].IsNumber()) {
    ThrowJs(env, "listOutputModes(deviceIndex: number) erwartet");
    return env.Undefined();
  }
  const uint32_t index = info[0].As<Napi::Number>().Uint32Value();

  const char* lookupError = nullptr;
  IDeckLink* dev = DeviceAt(index, &lookupError);
  if (!dev) {
    ThrowJs(env, lookupError ? lookupError : "Keine Karte mit diesem Index.");
    return env.Undefined();
  }

  IDeckLinkOutput* outIface = nullptr;
  if (dev->QueryInterface(IID_IDeckLinkOutput, reinterpret_cast<void**>(&outIface)) != S_OK) {
    dev->Release();
    ThrowJs(env, "Diese Karte hat keinen Ausgang.");
    return env.Undefined();
  }

  IDeckLinkDisplayModeIterator* modeIt = nullptr;
  if (outIface->GetDisplayModeIterator(&modeIt) != S_OK) {
    outIface->Release();
    dev->Release();
    ThrowJs(env, "Normen der Karte nicht lesbar.");
    return env.Undefined();
  }

  Napi::Array arr = Napi::Array::New(env);
  IDeckLinkDisplayMode* mode = nullptr;
  uint32_t n = 0;
  while (modeIt->Next(&mode) == S_OK) {
    BSTR nameBstr = nullptr;
    const std::string name =
        (mode->GetName(&nameBstr) == S_OK) ? TakeBstr(nameBstr) : std::string();

    const BMDDisplayMode code = mode->GetDisplayMode();

    // ACHTUNG Reihenfolge: erst die DAUER, dann die Zeitskala.
    // Bildrate = timeScale / frameDuration (1080p25 meldet 1000 und 25000).
    BMDTimeValue frameDuration = 0;
    BMDTimeScale timeScale = 0;
    mode->GetFrameRate(&frameDuration, &timeScale);

    // Die Feldkennung kennt FUENF Werte, nicht zwei. PsF ist ein eigener Fall.
    const BMDFieldDominance fd = mode->GetFieldDominance();

    BMDDisplayMode actual = code;
    BOOL supported = FALSE;
    outIface->DoesSupportVideoMode(bmdVideoConnectionUnspecified, code, bmdFormat8BitBGRA,
                                   bmdNoVideoOutputConversion, bmdSupportedVideoModeDefault,
                                   &actual, &supported);

    Napi::Object o = Napi::Object::New(env);
    o.Set("mode", Napi::String::New(env, FourCcToString(static_cast<uint32_t>(code))));
    o.Set("name", Napi::String::New(env, name));
    o.Set("width", Napi::Number::New(env, static_cast<double>(mode->GetWidth())));
    o.Set("height", Napi::Number::New(env, static_cast<double>(mode->GetHeight())));
    o.Set("fpsN", Napi::Number::New(env, static_cast<double>(timeScale)));
    o.Set("fpsD", Napi::Number::New(env, static_cast<double>(frameDuration)));
    o.Set("interlaced",
          Napi::Boolean::New(env, fd == bmdLowerFieldFirst || fd == bmdUpperFieldFirst));
    o.Set("segmented", Napi::Boolean::New(env, fd == bmdProgressiveSegmentedFrame));
    o.Set("supportsBGRA", Napi::Boolean::New(env, supported == TRUE));
    arr.Set(n, o);

    mode->Release();
    mode = nullptr;
    n++;
  }
  modeIt->Release();
  outIface->Release();
  dev->Release();
  return arr;
}

// destroy(): in Task 4 um das Schliessen des Ausgangs erweitert.
Napi::Value Destroy(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (g_comReady) {
    CoUninitialize();
    g_comReady = false;
  }
  return env.Undefined();
}

Napi::Object InitModule(Napi::Env env, Napi::Object exports) {
  exports.Set("init", Napi::Function::New(env, Init));
  exports.Set("listDevices", Napi::Function::New(env, ListDevices));
  exports.Set("listOutputModes", Napi::Function::New(env, ListOutputModes));
  exports.Set("destroy", Napi::Function::New(env, Destroy));
  return exports;
}

}  // namespace

NODE_API_MODULE(jm_decklink, InitModule)
