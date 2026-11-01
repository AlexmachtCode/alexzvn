// Vorschau-Weg der Slots (Spec 6.16): Plaetze, Verkleinern, Vorschau-Thread, WIC, Base64.
// Liest NIE g_slots und kein Feld eines Slots (Thread-Regel 6.1, Quelltext-Waechter PT6 e).
#include "preview.h"
#include <windows.h>
#include <objbase.h>
#include <wincodec.h>
#include <atomic>
#include <cstdio>
#include <cstring>
#include <mutex>
#include <string>
#include <thread>
#include <vector>
#include "emit.h"
// Base64 aus der reinen Logik (geprueft im Logik-Test). windows.h definiert min/max als
// Makros - fuer diesen Include ausgeschaltet (siehe video.h).
#pragma push_macro("min")
#pragma push_macro("max")
#undef min
#undef max
#include "slot_logic.h"
#pragma pop_macro("max")
#pragma pop_macro("min")

namespace {

constexpr int kMaxB = 192;
constexpr int kMaxH = 108;

struct Platz {
  std::mutex m;
  bool aktiv = false;
  bool neu = false;              // ein Bild wartet aufs Kodieren
  std::vector<uint8_t> bgr;      // hoechstens 192 x 108 x 3
  int w = 0, h = 0;
  unsigned ziel = 0;             // Ziel-Kennung bzw. Freigabe-Kennung DIESES Bildes
  int64_t letzteMs = 0;
  std::atomic<uint64_t> kostenUs{0};
};

Platz g_vorschau[16];
std::atomic<bool> g_an{false};
std::atomic<bool> g_stopp{false};
std::thread g_thread;            // nur Hauptthread startet und beendet ihn
std::atomic<bool> g_unavailableGemeldet{false};

Platz* platz(int nr) { return (nr >= 1 && nr <= 16) ? &g_vorschau[nr - 1] : nullptr; }

long long qpc() {
  LARGE_INTEGER q;
  QueryPerformanceCounter(&q);
  return q.QuadPart;
}

uint64_t qpcUs(long long von) {
  static const long long f = [] {
    LARGE_INTEGER q;
    QueryPerformanceFrequency(&q);
    return q.QuadPart;
  }();
  const long long bis = qpc();
  return (f > 0 && bis > von) ? static_cast<uint64_t>((bis - von) * 1000000LL / f) : 0;
}

uint8_t klemme(int v) { return static_cast<uint8_t>(v < 0 ? 0 : (v > 255 ? 255 : v)); }

void meldeUnavailable(HRESULT hr) {
  if (g_unavailableGemeldet.exchange(true)) return;
  char hex[16];
  std::snprintf(hex, sizeof hex, "0x%08lX", static_cast<unsigned long>(hr));
  emitRaw(std::string("{\"ev\":\"error\",\"where\":\"slot\",\"code\":\"previewUnavailable\",\"detail\":\"") + hex + "\"}");
  emitLog(std::wstring(L"Vorschau nicht verfuegbar (WIC/COM), HRESULT ") + std::wstring(hex, hex + std::strlen(hex)) +
          L" - Bild und Ton laufen weiter");
}

// BGR (24 bit) -> JPEG (Qualitaet 0,5) ueber WIC. false = gescheitert, *hr traegt den Grund. Rund 8 KB je Bild ist ANNAHME AN7 (unbelegt).
bool kodiere(IWICImagingFactory* fabrik, const std::vector<uint8_t>& bgr, int w, int h, std::vector<uint8_t>* jpeg, HRESULT* hr) {
  IStream* speicher = nullptr;
  IWICStream* strom = nullptr;
  IWICBitmapEncoder* kodierer = nullptr;
  IWICBitmapFrameEncode* bild = nullptr;
  IPropertyBag2* optionen = nullptr;
  bool ok = false;
  *hr = CreateStreamOnHGlobal(nullptr, TRUE, &speicher);
  if (SUCCEEDED(*hr)) *hr = fabrik->CreateStream(&strom);
  if (SUCCEEDED(*hr)) *hr = strom->InitializeFromIStream(speicher);
  if (SUCCEEDED(*hr)) *hr = fabrik->CreateEncoder(GUID_ContainerFormatJpeg, nullptr, &kodierer);
  if (SUCCEEDED(*hr)) *hr = kodierer->Initialize(strom, WICBitmapEncoderNoCache);
  if (SUCCEEDED(*hr)) *hr = kodierer->CreateNewFrame(&bild, &optionen);
  if (SUCCEEDED(*hr)) {
    PROPBAG2 name = {};
    name.pstrName = const_cast<LPOLESTR>(L"ImageQuality");
    VARIANT wert = {};
    wert.vt = VT_R4;
    wert.fltVal = 0.5f;
    *hr = optionen->Write(1, &name, &wert);
  }
  if (SUCCEEDED(*hr)) *hr = bild->Initialize(optionen);
  if (SUCCEEDED(*hr)) *hr = bild->SetSize(static_cast<UINT>(w), static_cast<UINT>(h));
  WICPixelFormatGUID format = GUID_WICPixelFormat24bppBGR;
  if (SUCCEEDED(*hr)) *hr = bild->SetPixelFormat(&format);
  if (SUCCEEDED(*hr)) {
    *hr = bild->WritePixels(static_cast<UINT>(h), static_cast<UINT>(w * 3), static_cast<UINT>(bgr.size()),
                            const_cast<BYTE*>(bgr.data()));
  }
  if (SUCCEEDED(*hr)) *hr = bild->Commit();
  if (SUCCEEDED(*hr)) *hr = kodierer->Commit();
  if (SUCCEEDED(*hr)) {
    STATSTG st = {};
    HGLOBAL hg = nullptr;
    *hr = speicher->Stat(&st, STATFLAG_NONAME);
    if (SUCCEEDED(*hr)) *hr = GetHGlobalFromStream(speicher, &hg);
    if (SUCCEEDED(*hr)) {
      const void* p = GlobalLock(hg);
      if (p != nullptr) {
        const uint8_t* b = static_cast<const uint8_t*>(p);
        jpeg->assign(b, b + st.cbSize.LowPart);
        GlobalUnlock(hg);
        ok = true;
      }
    }
  }
  if (optionen) optionen->Release();
  if (bild) bild->Release();
  if (kodierer) kodierer->Release();
  if (strom) strom->Release();
  if (speicher) speicher->Release();
  return ok;
}

// Der Vorschau-Thread: ein Thread fuer alle Plaetze, COM als MTA (E15). Dass WIC auf einem eigenen MTA-Thread das SDK nicht stoert, ist ANNAHME AN6 (unbelegt).
void vorschauLauf() {
  const HRESULT com = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
  IWICImagingFactory* fabrik = nullptr;
  HRESULT hr = com;
  if (SUCCEEDED(hr)) {
    hr = CoCreateInstance(CLSID_WICImagingFactory, nullptr, CLSCTX_INPROC_SERVER, IID_PPV_ARGS(&fabrik));
  }
  if (FAILED(hr) || fabrik == nullptr) {
    meldeUnavailable(hr);
    g_an = false;
    if (SUCCEEDED(com)) CoUninitialize();
    return;
  }
  std::vector<uint8_t> bgr, jpeg;
  while (!g_stopp.load()) {
    for (int i = 0; i < 16; ++i) {
      Platz& p = g_vorschau[i];
      int w = 0, h = 0;
      unsigned ziel = 0;
      {
        std::lock_guard<std::mutex> lock(p.m);
        if (!p.aktiv || !p.neu) continue;
        bgr = p.bgr;
        w = p.w;
        h = p.h;
        ziel = p.ziel;
        p.neu = false;
      }
      const long long t0 = qpc();
      HRESULT ehr = S_OK;
      if (!kodiere(fabrik, bgr, w, h, &jpeg, &ehr)) {
        emitLog(L"Vorschau: JPEG-Kodierung gescheitert, Slot " + std::to_wstring(i + 1) + L", HRESULT " +
                std::to_wstring(static_cast<unsigned long>(ehr)));
        continue;
      }
      const std::string b64 = slotlogic::base64(jpeg.data(), jpeg.size());
      p.kostenUs.fetch_add(qpcUs(t0));
      emitRaw("{\"ev\":\"preview\",\"slot\":" + std::to_string(i + 1) + ",\"target\":" + std::to_string(ziel) + ",\"w\":" +
              std::to_string(w) + ",\"h\":" + std::to_string(h) + ",\"jpeg\":\"" + b64 + "\"}");
    }
    Sleep(50);
  }
  fabrik->Release();
  CoUninitialize();
}

void threadAnhalten() {
  if (!g_thread.joinable()) return;
  g_stopp = true;
  g_thread.join();
  g_stopp = false;
}

}  // namespace

void vorschauAnmelden(int nr) {
  Platz* p = platz(nr);
  if (p == nullptr) return;
  std::lock_guard<std::mutex> lock(p->m);
  p->aktiv = true;
  p->neu = false;
  p->bgr.clear();
  p->letzteMs = 0;
}

void vorschauAbmelden(int nr) {
  Platz* p = platz(nr);
  if (p == nullptr) return;
  std::lock_guard<std::mutex> lock(p->m);
  p->aktiv = false;
  p->neu = false;
  p->bgr.clear();
  p->bgr.shrink_to_fit();
}

void vorschauLeeren(int nr) {
  Platz* p = platz(nr);
  if (p == nullptr) return;
  std::lock_guard<std::mutex> lock(p->m);
  p->neu = false;
  p->bgr.clear();
  p->letzteMs = 0;
}

void vorschauBild(int nr, unsigned ziel, const uint8_t* i420, int w, int h, int64_t jetzt) {
  if (!g_an.load() || i420 == nullptr || w <= 0 || h <= 0) return;
  Platz* p = platz(nr);
  if (p == nullptr || !p->m.try_lock()) return;   // belegt: dieses Bild faellt aus
  std::lock_guard<std::mutex> lock(p->m, std::adopt_lock);
  if (!p->aktiv || (p->letzteMs != 0 && jetzt - p->letzteMs < 500)) return;
  const long long t0 = qpc();
  // In 192 x 108 einpassen, Seitenverhaeltnis bleibt (4:3 wird 144 x 108).
  int zw = kMaxB, zh = h * kMaxB / w;
  if (zh > kMaxH) { zh = kMaxH; zw = w * kMaxH / h; }
  if (zw < 1) zw = 1;
  if (zh < 1) zh = 1;
  p->bgr.resize(static_cast<size_t>(zw) * zh * 3);
  const uint8_t* yEbene = i420;
  const uint8_t* uEbene = i420 + static_cast<size_t>(w) * h;
  const uint8_t* vEbene = uEbene + static_cast<size_t>(w / 2) * (h / 2);
  for (int y = 0; y < zh; ++y) {
    const int sy = y * h / zh;
    for (int x = 0; x < zw; ++x) {
      const int sx = x * w / zw;
      // BT.601, begrenzter Wertebereich (wie die NDI-Annahme fuer I420).
      const int c = yEbene[static_cast<size_t>(sy) * w + sx] - 16;
      const int d = uEbene[static_cast<size_t>(sy / 2) * (w / 2) + sx / 2] - 128;
      const int e = vEbene[static_cast<size_t>(sy / 2) * (w / 2) + sx / 2] - 128;
      uint8_t* ziel3 = &p->bgr[(static_cast<size_t>(y) * zw + x) * 3];
      ziel3[0] = klemme((298 * c + 516 * d + 128) >> 8);
      ziel3[1] = klemme((298 * c - 100 * d - 208 * e + 128) >> 8);
      ziel3[2] = klemme((298 * c + 409 * e + 128) >> 8);
    }
  }
  p->w = zw;
  p->h = zh;
  p->ziel = ziel;
  p->neu = true;
  p->letzteMs = jetzt;
  p->kostenUs.fetch_add(qpcUs(t0));
}

void vorschauModus(bool an) {
  if (an) {
    // Nach einem gemeldeten previewUnavailable bleibt die Vorschau aus (6.16).
    g_an = !g_unavailableGemeldet.load();
    if (!g_thread.joinable()) g_thread = std::thread(vorschauLauf);
  } else {
    g_an = false;
    threadAnhalten();
  }
  // Abschluss-Fix F9 (M2): bestaetigt wird der tatsaechliche Zustand - nach previewUnavailable on:false, auch wenn
  // on:true gesendet wurde (bewusste Abweichung von Spec 6.3 "wie gesendet"; README Abschnitt 7, Vorschau).
  emitRaw(std::string("{\"ev\":\"previewMode\",\"on\":") + (g_an.load() ? "true" : "false") + "}");
}

void vorschauThreadEnde() {
  g_an = false;
  threadAnhalten();
}

bool vorschauAn() { return g_an.load(); }

uint64_t vorschauKostenUs(int nr) {
  Platz* p = platz(nr);
  return p != nullptr ? p->kostenUs.exchange(0) : 0;
}

size_t vorschauSpeicherBytes(int nr) {
  Platz* p = platz(nr);
  if (p == nullptr) return 0;
  std::lock_guard<std::mutex> lock(p->m);
  return p->bgr.capacity();
}
