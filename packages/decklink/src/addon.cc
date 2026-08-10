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

// ===================== AUSGANG =====================
//
// Es gibt genau EINEN offenen Ausgang je Prozess — mehrere gleichzeitig sind
// Nicht-Ziel (gleiche Setzung wie @jm/ndi).

IDeckLink* g_device = nullptr;
IDeckLinkOutput* g_output = nullptr;
long g_width = 0;
long g_height = 0;
BMDTimeValue g_frameDuration = 0;
BMDTimeScale g_timeScale = 0;
uint32_t g_preroll = 2;
BMDTimeValue g_nextDisplayTime = 0;

// Zaehler. atomic, weil ScheduledFrameCompleted auf dem TREIBER-Thread laeuft.
// Getrennt gefuehrt, weil sie verschiedene Ursachen haben: late/dropped kommen von
// der Karte und deuten auf zu kleinen Vorlauf, repeated/rejected kommen von uns und
// deuten auf Drift oder einen stockenden Zulieferer. Ein gemeinsamer Zaehler
// "Bildfehler" wuerde genau die Diagnose zerstoeren, fuer die man ihn braucht.
std::atomic<uint64_t> g_late{0};
std::atomic<uint64_t> g_dropped{0};
std::atomic<uint64_t> g_repeated{0};
std::atomic<uint64_t> g_rejected{0};
std::atomic<uint64_t> g_scheduled{0};

// Der Treiber ruft ScheduledFrameCompleted auf SEINEM Thread. Hier darf NICHTS mit
// JavaScript passieren — nur atomare Zaehler. Genau deshalb braucht dieses Addon
// keine ThreadSafeFunction.
//
// Das uebergebene Bild ist GELIEHEN: ScheduleVideoFrame haelt seine eigene Referenz
// und gibt sie nach Abschluss selbst frei. Hier NICHT Release aufrufen.
class OutputCallback : public IDeckLinkVideoOutputCallback {
 public:
  HRESULT STDMETHODCALLTYPE ScheduledFrameCompleted(IDeckLinkVideoFrame*,
                                                    BMDOutputFrameCompletionResult result) override {
    if (result == bmdOutputFrameDisplayedLate) {
      g_late.fetch_add(1, std::memory_order_relaxed);
    } else if (result == bmdOutputFrameDropped) {
      g_dropped.fetch_add(1, std::memory_order_relaxed);
    }
    return S_OK;
  }
  HRESULT STDMETHODCALLTYPE ScheduledPlaybackHasStopped() override { return S_OK; }

  // Der Rueckruf ist ein statisches Objekt und lebt so lange wie das Modul —
  // eine echte Referenzzaehlung waere hier nur Zierrat.
  HRESULT STDMETHODCALLTYPE QueryInterface(REFIID, LPVOID*) override { return E_NOINTERFACE; }
  ULONG STDMETHODCALLTYPE AddRef() override { return 1; }
  ULONG STDMETHODCALLTYPE Release() override { return 1; }
};

OutputCallback g_callback;

/** Ein schwarzes Bild einreihen (Vorlauf). Gibt false zurueck, wenn es nicht klappt. */
bool ScheduleBlackFrame() {
  if (!g_output) return false;
  IDeckLinkMutableVideoFrame* frame = nullptr;
  if (g_output->CreateVideoFrame(static_cast<int>(g_width), static_cast<int>(g_height),
                                 static_cast<int>(g_width) * 4, bmdFormat8BitBGRA,
                                 bmdFrameFlagDefault, &frame) != S_OK) {
    return false;
  }
  void* bytes = nullptr;
  IDeckLinkVideoBuffer* buffer = nullptr;
  if (frame->QueryInterface(IID_IDeckLinkVideoBuffer, reinterpret_cast<void**>(&buffer)) != S_OK || !buffer) {
    frame->Release();
    return false;
  }
  if (buffer->StartAccess(bmdBufferAccessWrite) != S_OK) {
    buffer->Release();
    frame->Release();
    return false;
  }
  if (buffer->GetBytes(&bytes) != S_OK || !bytes) {
    buffer->EndAccess(bmdBufferAccessWrite);
    buffer->Release();
    frame->Release();
    return false;
  }
  std::memset(bytes, 0, static_cast<size_t>(g_width) * static_cast<size_t>(g_height) * 4);
  buffer->EndAccess(bmdBufferAccessWrite);
  buffer->Release();

  const HRESULT hr =
      g_output->ScheduleVideoFrame(frame, g_nextDisplayTime, g_frameDuration, g_timeScale);
  frame->Release();  // der Treiber haelt seine eigene Referenz
  if (FAILED(hr)) return false;
  g_nextDisplayTime += g_frameDuration;
  return true;
}

/** Ausgang schliessen. Idempotent. */
void CloseOutputInternal() {
  if (g_output) {
    BMDTimeValue actualStop = 0;
    g_output->StopScheduledPlayback(0, &actualStop, g_timeScale ? g_timeScale : 1000);
    g_output->SetScheduledFrameCompletionCallback(nullptr);
    g_output->DisableVideoOutput();
    g_output->Release();
    g_output = nullptr;
  }
  if (g_device) {
    g_device->Release();
    g_device = nullptr;
  }
  g_width = 0;
  g_height = 0;
  g_frameDuration = 0;
  g_timeScale = 0;
  g_nextDisplayTime = 0;
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

// openOutput(deviceIndex, mode, prerollFrames?)
Napi::Value OpenOutput(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 2 || !info[0].IsNumber() || !info[1].IsString()) {
    ThrowJs(env, "openOutput(deviceIndex: number, mode: string, prerollFrames?: number) erwartet");
    return env.Undefined();
  }
  const uint32_t index = info[0].As<Napi::Number>().Uint32Value();
  const std::string modeStr = info[1].As<Napi::String>().Utf8Value();
  uint32_t preroll = 2;
  if (info.Length() >= 3 && info[2].IsNumber()) {
    preroll = info[2].As<Napi::Number>().Uint32Value();
  }
  // Vorgabe 2 (bei 25p rund 80 ms bis zum Bild) — der Ausgang bedient auch das
  // Saalbild, und dort ist Versatz gegen einen live sprechenden Menschen das
  // teurere Uebel. Bewusst die riskantere Einstellung; wer Ruckler sieht, dreht hoch.
  if (preroll < 2) preroll = 2;
  if (preroll > 6) preroll = 6;

  CloseOutputInternal();

  // DeviceAt liefert die Ursache selbst — fehlender Treiber, gar keine Karte und
  // falscher Index sind drei verschiedene Lagen und bekommen drei verschiedene Saetze.
  const char* lookupError = nullptr;
  IDeckLink* dev = DeviceAt(index, &lookupError);
  if (!dev) {
    ThrowJs(env, lookupError ? lookupError : "Keine Karte mit diesem Index.");
    return env.Undefined();
  }

  IDeckLinkOutput* out = nullptr;
  if (dev->QueryInterface(IID_IDeckLinkOutput, reinterpret_cast<void**>(&out)) != S_OK) {
    dev->Release();
    ThrowJs(env, "Diese Karte hat keinen Ausgang.");
    return env.Undefined();
  }

  const BMDDisplayMode wanted = static_cast<BMDDisplayMode>(StringToFourCc(modeStr));

  // Norm suchen und ihre Masse uebernehmen.
  IDeckLinkDisplayModeIterator* modeIt = nullptr;
  if (out->GetDisplayModeIterator(&modeIt) != S_OK) {
    out->Release();
    dev->Release();
    ThrowJs(env, "Normen der Karte nicht lesbar.");
    return env.Undefined();
  }

  bool found = false;
  IDeckLinkDisplayMode* m = nullptr;
  while (modeIt->Next(&m) == S_OK) {
    if (m->GetDisplayMode() == wanted) {
      g_width = m->GetWidth();
      g_height = m->GetHeight();
      const HRESULT hrRate = m->GetFrameRate(&g_frameDuration, &g_timeScale);
      if (hrRate != S_OK) {
        m->Release();
        modeIt->Release();
        out->Release();
        dev->Release();
        ThrowJs(env, "Bildrate dieser Norm ist nicht lesbar.");
        return env.Undefined();
      }
      found = true;
    }
    m->Release();
    m = nullptr;
    if (found) break;
  }
  modeIt->Release();

  if (!found) {
    out->Release();
    dev->Release();
    ThrowJs(env, "Diese Norm kennt die Karte nicht.");
    return env.Undefined();
  }

  // BGRA ist Pflicht. Kann die Karte es fuer diese Norm nicht, wird abgewiesen —
  // eine Wandlung nach UYVY ist ausdruecklich eine spaetere Scheibe, und ungepruefte
  // Farbmathematik waere hier schlimmer als eine klare Absage.
  BMDDisplayMode actual = wanted;
  BOOL supported = FALSE;
  out->DoesSupportVideoMode(bmdVideoConnectionUnspecified, wanted, bmdFormat8BitBGRA,
                            bmdNoVideoOutputConversion, bmdSupportedVideoModeDefault, &actual,
                            &supported);
  if (supported != TRUE) {
    out->Release();
    dev->Release();
    ThrowJs(env, "Diese Karte kann diese Norm nicht mit BGRA ausgeben.");
    return env.Undefined();
  }

  out->SetScheduledFrameCompletionCallback(&g_callback);

  const HRESULT hr = out->EnableVideoOutput(wanted, bmdVideoOutputFlagDefault);
  if (FAILED(hr)) {
    out->SetScheduledFrameCompletionCallback(nullptr);
    out->Release();
    dev->Release();
    ThrowJs(env, hr == E_ACCESSDENIED ? "Die Karte wird von einem anderen Programm benutzt."
                                      : "Ausgang konnte nicht aktiviert werden.");
    return env.Undefined();
  }

  g_device = dev;
  g_output = out;
  g_preroll = preroll;
  g_nextDisplayTime = 0;
  g_late = 0;
  g_dropped = 0;
  g_repeated = 0;
  g_rejected = 0;
  g_scheduled = 0;

  // Vorlauf mit Schwarzbildern fuellen, dann die Wiedergabe starten.
  for (uint32_t i = 0; i < g_preroll; i++) {
    if (!ScheduleBlackFrame()) break;
  }
  if (FAILED(g_output->StartScheduledPlayback(0, g_timeScale, 1.0))) {
    CloseOutputInternal();
    ThrowJs(env, "Wiedergabe konnte nicht gestartet werden.");
    return env.Undefined();
  }

  return Napi::Boolean::New(env, true);
}

// scheduleFrameBGRA(buf, width, height)
Napi::Value ScheduleFrameBGRA(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 3 || !info[0].IsTypedArray() || !info[1].IsNumber() || !info[2].IsNumber()) {
    ThrowJs(env, "scheduleFrameBGRA(buf: Uint8Array, width: number, height: number) erwartet");
    return env.Undefined();
  }
  if (!g_output) {
    ThrowJs(env, "Kein Ausgang offen.");
    return env.Undefined();
  }

  Napi::Uint8Array buf = info[0].As<Napi::Uint8Array>();
  const long width = static_cast<long>(info[1].As<Napi::Number>().Int64Value());
  const long height = static_cast<long>(info[2].As<Napi::Number>().Int64Value());

  // Masse muessen exakt passen. NICHT skalieren — die Aufloesung kommt aus der Quelle.
  if (width != g_width || height != g_height) {
    return Napi::Boolean::New(env, false);
  }
  const size_t need = static_cast<size_t>(g_width) * static_cast<size_t>(g_height) * 4;
  if (buf.ByteLength() != need) {
    ThrowJs(env, "Puffergroesse passt nicht zu width*height*4.");
    return env.Undefined();
  }

  unsigned int buffered = 0;
  g_output->GetBufferedVideoFrameCount(&buffered);

  // Warteschlange laeuft voll: die Karte kommt nicht hinterher bzw. wir liefern zu
  // schnell. Das eingehende Bild faellt weg — gezaehlt, nicht verschwiegen.
  if (buffered > g_preroll + 2) {
    g_rejected.fetch_add(1, std::memory_order_relaxed);
    return Napi::Boolean::New(env, false);
  }

  // Warteschlange leergelaufen: die Karte hatte nichts mehr. Wir zaehlen es UND setzen
  // die Zeitachse auf die Hardware-Uhr zurueck. Ohne diese Neusetzung planten wir ab
  // hier dauerhaft in die Vergangenheit, und ALLES kaeme fuer immer zu spaet.
  if (buffered == 0 && g_scheduled.load(std::memory_order_relaxed) > 0) {
    g_repeated.fetch_add(1, std::memory_order_relaxed);
    BMDTimeValue streamTime = 0;
    double speed = 0.0;
    if (g_output->GetScheduledStreamTime(g_timeScale, &streamTime, &speed) == S_OK) {
      g_nextDisplayTime = streamTime + g_frameDuration;
    }
  }

  IDeckLinkMutableVideoFrame* frame = nullptr;
  if (g_output->CreateVideoFrame(static_cast<int>(g_width), static_cast<int>(g_height),
                                 static_cast<int>(g_width) * 4, bmdFormat8BitBGRA,
                                 bmdFrameFlagDefault, &frame) != S_OK) {
    return Napi::Boolean::New(env, false);
  }
  void* bytes = nullptr;
  IDeckLinkVideoBuffer* buffer = nullptr;
  if (frame->QueryInterface(IID_IDeckLinkVideoBuffer, reinterpret_cast<void**>(&buffer)) != S_OK || !buffer) {
    frame->Release();
    return Napi::Boolean::New(env, false);
  }
  if (buffer->StartAccess(bmdBufferAccessWrite) != S_OK) {
    buffer->Release();
    frame->Release();
    return Napi::Boolean::New(env, false);
  }
  if (buffer->GetBytes(&bytes) != S_OK || !bytes) {
    buffer->EndAccess(bmdBufferAccessWrite);
    buffer->Release();
    frame->Release();
    return Napi::Boolean::New(env, false);
  }
  std::memcpy(bytes, buf.Data(), need);
  buffer->EndAccess(bmdBufferAccessWrite);
  buffer->Release();

  const HRESULT hr =
      g_output->ScheduleVideoFrame(frame, g_nextDisplayTime, g_frameDuration, g_timeScale);
  frame->Release();  // der Treiber haelt seine eigene Referenz bis zum Abschluss
  if (FAILED(hr)) return Napi::Boolean::New(env, false);

  g_nextDisplayTime += g_frameDuration;
  g_scheduled.fetch_add(1, std::memory_order_relaxed);
  return Napi::Boolean::New(env, true);
}

// stats(): der ehrliche Blick auf die Ausgabe.
Napi::Value Stats(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  unsigned int buffered = 0;
  if (g_output) g_output->GetBufferedVideoFrameCount(&buffered);

  Napi::Object o = Napi::Object::New(env);
  o.Set("queued", Napi::Number::New(env, buffered));
  o.Set("late", Napi::Number::New(env, static_cast<double>(g_late.load())));
  o.Set("dropped", Napi::Number::New(env, static_cast<double>(g_dropped.load())));
  o.Set("repeated", Napi::Number::New(env, static_cast<double>(g_repeated.load())));
  o.Set("rejected", Napi::Number::New(env, static_cast<double>(g_rejected.load())));
  o.Set("scheduled", Napi::Number::New(env, static_cast<double>(g_scheduled.load())));
  return o;
}

Napi::Value CloseOutput(const Napi::CallbackInfo& info) {
  CloseOutputInternal();
  return info.Env().Undefined();
}

Napi::Value Destroy(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  CloseOutputInternal();
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
  exports.Set("openOutput", Napi::Function::New(env, OpenOutput));
  exports.Set("scheduleFrameBGRA", Napi::Function::New(env, ScheduleFrameBGRA));
  exports.Set("stats", Napi::Function::New(env, Stats));
  exports.Set("closeOutput", Napi::Function::New(env, CloseOutput));
  exports.Set("destroy", Napi::Function::New(env, Destroy));
  return exports;
}

}  // namespace

NODE_API_MODULE(jm_decklink, InitModule)
