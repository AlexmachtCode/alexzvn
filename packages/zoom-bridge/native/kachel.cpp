// Zeichner der Zoom-Kachel (#306), siehe kachel.h.
//
// Ein Auftrag zeichnet die ganze Kachel mit Direct2D (Software-Rasterer) in ein WIC-Bitmap 32bppPBGRA und gibt sie
// als I420 ab; alle Maße kommen aus kachel::masse(w, h), alle Farben aus kachel_logik.h. Jede Fabrik und jedes
// Ziel entsteht je Auftrag neu auf dem Zeichen-Thread: nichts wird zwischen Threads geteilt, und gezeichnet wird
// nur je Zustandswechsel einmal, nicht je Bild.
//
// Fehlerweg: Was am Profilbild scheitert (fehlt, zu groß, unlesbar), zeichnet die Kachel mit Initialen weiter –
// bytegleich zu einem Auftrag ganz ohne Profilbild (die Musterprobe prüft das). Was am Zeichnen selbst scheitert
// (Fabrik, Ziel, Schrift, EndDraw, Lock), liefert kein Bild (i420 == nullptr) und das HRESULT; der Aufrufer zeigt
// dann die dunkle Grundfläche. Nichts davon wirft aus kachelZeichnen heraus.
//
// Protokoll: der Zeichner selbst schreibt nichts (das tut der Slot, Task 7). Nur der Sonderweg kachelMuster
// schreibt auf stderr – nie einen Namen, nie einen Pfad, nie einen Dateinamen.
#include <chrono>
#include <climits>
#include <cmath>
#include <cstdio>
#include <cstring>
#include <cwchar>
#include <filesystem>
#include <fstream>
#include <iterator>
#include <new>
#include <string>
#include <system_error>
#include <thread>
#include <utility>
#include <vector>

#include <windows.h>
#include <wincodec.h>
#include <d2d1.h>
#include <dwrite.h>
#include <wrl/client.h>
// windows.h (ohne NOMINMAX) definiert die Makros min und max; std::min/std::max in der reinen Logik brächen dann
// mit C2589 ab. Für diesen einen Include gelten sie darum nicht (wie video.h bei slot_logic.h).
#pragma push_macro("min")
#pragma push_macro("max")
#undef min
#undef max
#include "kachel_logik.h"
#pragma pop_macro("max")
#pragma pop_macro("min")
#include "kachel.h"
#include "emit.h"

using Microsoft::WRL::ComPtr;

static_assert(sizeof(wchar_t) == sizeof(char16_t), "UTF-16 von Zoom geht ohne Umweg an die Windows-Schnittstellen");

namespace {

/** Kleiner ist nichts lesbar, größer liefert Zoom nicht (1080p); außerhalb: kein Bild, dunkle Grundfläche. */
constexpr int kSeiteMin = 16;
constexpr int kSeiteMax = 4096;
/** Breite und Höhe eines Text-Layouts ohne Grenze: kein Name erreicht sie. */
constexpr float kWeit = 100000.0f;

const wchar_t* breit(const std::u16string& s) { return reinterpret_cast<const wchar_t*>(s.c_str()); }

D2D1_COLOR_F farbe(uint32_t rgb, float deckkraft = 1.0f) { return D2D1::ColorF(static_cast<UINT32>(rgb), deckkraft); }

std::wstring hexHr(long hr) {
  wchar_t text[16];
  std::swprintf(text, 16, L"0x%08lX", static_cast<unsigned long>(hr));
  return text;
}

/** „Segoe UI“ in Gewicht und Pixelgröße, ohne Umbruch (ein Name ist eine Zeile). */
HRESULT schrift(IDWriteFactory* dw, DWRITE_FONT_WEIGHT gewicht, int px, ComPtr<IDWriteTextFormat>* aus) {
  HRESULT hr = dw->CreateTextFormat(L"Segoe UI", nullptr, gewicht, DWRITE_FONT_STYLE_NORMAL, DWRITE_FONT_STRETCH_NORMAL,
                                    static_cast<float>(px), L"de-de", aus->ReleaseAndGetAddressOf());
  if (SUCCEEDED(hr)) hr = (*aus)->SetWordWrapping(DWRITE_WORD_WRAPPING_NO_WRAP);
  return hr;
}

/**
 * Das Profilbild als Pinsel für den Kreis: mittiger quadratischer Ausschnitt, auf seite × seite skaliert. Liefert
 * den Befund; bei Unlesbar steht in *hr das HRESULT des gescheiterten Schritts (Decoder bis Pinsel).
 */
kachel::ProfilbildFehler profilbildLaden(IWICImagingFactory* wic, ID2D1RenderTarget* rt, const std::u16string& pfad,
                                         UINT seite, ComPtr<ID2D1BitmapBrush>* pinsel, HRESULT* hr) {
  using kachel::ProfilbildFehler;
  *hr = S_OK;
  if (pfad.empty()) return ProfilbildFehler::KeinPfad;
  WIN32_FILE_ATTRIBUTE_DATA info{};
  if (!GetFileAttributesExW(breit(pfad), GetFileExInfoStandard, &info)) {
    *hr = HRESULT_FROM_WIN32(GetLastError());
    return ProfilbildFehler::Fehlt;
  }
  const uint64_t bytes = (static_cast<uint64_t>(info.nFileSizeHigh) << 32) | info.nFileSizeLow;

  ComPtr<IWICBitmapDecoder> dekoder;
  ComPtr<IWICBitmapFrameDecode> rahmen;
  UINT bw = 0, bh = 0;
  *hr = wic->CreateDecoderFromFilename(breit(pfad), nullptr, GENERIC_READ, WICDecodeMetadataCacheOnDemand, &dekoder);
  if (SUCCEEDED(*hr)) *hr = dekoder->GetFrame(0, &rahmen);
  if (SUCCEEDED(*hr)) *hr = rahmen->GetSize(&bw, &bh);
  if (FAILED(*hr)) return ProfilbildFehler::Unlesbar;
  const ProfilbildFehler pruefung = kachel::profilbildPruefen(bytes, bw, bh);
  if (pruefung != ProfilbildFehler::Keiner) return pruefung;

  // Die Kette rechnet erst, wenn CreateBitmapFromWicBitmap die Bildpunkte abholt: ein abgeschnittenes oder
  // kaputtes Bild scheitert darum oft erst dort – es zählt genauso als unlesbar.
  const kachel::Ausschnitt a = kachel::quadratAusschnitt(bw, bh);
  const WICRect ausschnitt{static_cast<INT>(a.x), static_cast<INT>(a.y), static_cast<INT>(a.seite),
                           static_cast<INT>(a.seite)};
  ComPtr<IWICBitmapClipper> schere;
  ComPtr<IWICBitmapScaler> skalierer;
  ComPtr<IWICFormatConverter> wandler;
  ComPtr<ID2D1Bitmap> bild;
  *hr = wic->CreateBitmapClipper(&schere);
  if (SUCCEEDED(*hr)) *hr = schere->Initialize(rahmen.Get(), &ausschnitt);
  if (SUCCEEDED(*hr)) *hr = wic->CreateBitmapScaler(&skalierer);
  if (SUCCEEDED(*hr)) *hr = skalierer->Initialize(schere.Get(), seite, seite, WICBitmapInterpolationModeHighQualityCubic);
  if (SUCCEEDED(*hr)) *hr = wic->CreateFormatConverter(&wandler);
  if (SUCCEEDED(*hr)) {
    *hr = wandler->Initialize(skalierer.Get(), GUID_WICPixelFormat32bppPBGRA, WICBitmapDitherTypeNone, nullptr, 0.0,
                              WICBitmapPaletteTypeMedianCut);
  }
  // Ohne Eigenschaften: Pixelformat wie die Quelle, 96 DPI (die DPI-Angabe der Datei zählt nicht) – ein Bildpunkt
  // des Bitmaps ist dann ein Bildpunkt des Ziels.
  if (SUCCEEDED(*hr)) *hr = rt->CreateBitmapFromWicBitmap(wandler.Get(), nullptr, &bild);
  if (SUCCEEDED(*hr)) *hr = rt->CreateBitmapBrush(bild.Get(), pinsel->ReleaseAndGetAddressOf());
  if (FAILED(*hr)) {
    pinsel->Reset();
    return ProfilbildFehler::Unlesbar;
  }
  return ProfilbildFehler::Keiner;
}

/**
 * Zeichnet die Kachel nach e. Alle COM-Zeiger leben nur hier drin, damit sie vor CoUninitialize (in
 * kachelZeichnen) freigegeben sind – auch wenn eine Ausnahme (Speicher) hier herausläuft.
 */
void zeichnen(const KachelAuftrag& a, KachelErgebnis* e) {
  const int w = a.w, h = a.h;
  if (w < kSeiteMin || h < kSeiteMin || w > kSeiteMax || h > kSeiteMax) {
    e->hresult = E_INVALIDARG;
    return;
  }
  const kachel::KachelMasse m = kachel::masse(w, h);
  const std::vector<uint32_t> name = kachel::utf16Dekodieren(a.name);

  // --- Fabriken und Ziel -----------------------------------------------------------------------------------
  ComPtr<IWICImagingFactory> wic;
  ComPtr<ID2D1Factory> d2d;
  ComPtr<IDWriteFactory> dw;
  ComPtr<IWICBitmap> ziel;
  ComPtr<ID2D1RenderTarget> rt;
  HRESULT hr = CoCreateInstance(CLSID_WICImagingFactory, nullptr, CLSCTX_INPROC_SERVER, IID_PPV_ARGS(&wic));
  if (SUCCEEDED(hr)) hr = D2D1CreateFactory(D2D1_FACTORY_TYPE_SINGLE_THREADED, d2d.GetAddressOf());
  if (SUCCEEDED(hr)) {
    // ISOLATED, nicht SHARED – GEMESSEN 14.11.2026 mit --kachel-muster: mit der geteilten Fabrik zeichnete
    // derselbe Auftrag („Anna Müller“, 720p, ohne Profilbild) nach einigen anderen Kacheln im selben Prozess
    // anders (2 Bildpunkte im „A“ des Namensschilds, bis 11 Stufen) – die geteilte Fabrik trägt Zustand von
    // Auftrag zu Auftrag. Isoliert ist jede Kachel nur eine Folge ihres Auftrags (bytegleich über Läufe und
    // Prozesse). Preis gemessen (je ein Lauf geteilt, vier isoliert, alle 21 Musterkacheln): 8–45 ms je Kachel
    // wie zuvor; Chinesisch (Ersatzschrift) einmal 92 ms, in den drei folgenden Läufen 18–19 ms (geteilt: 32 ms).
    hr = DWriteCreateFactory(DWRITE_FACTORY_TYPE_ISOLATED, __uuidof(IDWriteFactory),
                             reinterpret_cast<IUnknown**>(dw.GetAddressOf()));
  }
  if (SUCCEEDED(hr)) {
    hr = wic->CreateBitmap(static_cast<UINT>(w), static_cast<UINT>(h), GUID_WICPixelFormat32bppPBGRA,
                           WICBitmapCacheOnLoad, &ziel);
  }
  if (SUCCEEDED(hr)) {
    // Software-Ziel mit 96 DPI: eine Einheit von Direct2D ist ein Bildpunkt.
    const D2D1_RENDER_TARGET_PROPERTIES eigenschaften = D2D1::RenderTargetProperties(
        D2D1_RENDER_TARGET_TYPE_SOFTWARE, D2D1::PixelFormat(DXGI_FORMAT_B8G8R8A8_UNORM, D2D1_ALPHA_MODE_PREMULTIPLIED),
        96.0f, 96.0f);
    hr = d2d->CreateWicBitmapRenderTarget(ziel.Get(), eigenschaften, &rt);
  }
  if (FAILED(hr)) {
    e->hresult = hr;
    return;
  }
  rt->SetAntialiasMode(D2D1_ANTIALIAS_MODE_PER_PRIMITIVE);
  // Graustufen statt ClearType: farbige ClearType-Säume überleben die halbe Farbauflösung von I420 nicht.
  rt->SetTextAntialiasMode(D2D1_TEXT_ANTIALIAS_MODE_GRAYSCALE);

  // --- Profilbild ------------------------------------------------------------------------------------------
  // Scheitert es, bleibt nur der Befund samt HRESULT; gezeichnet wird weiter mit Initialen.
  ComPtr<ID2D1BitmapBrush> bildPinsel;
  HRESULT bildHr = S_OK;
  e->fehler = profilbildLaden(wic.Get(), rt.Get(), a.profilbild, static_cast<UINT>(m.durchmesser), &bildPinsel, &bildHr);
  e->hresult = bildHr;

  // --- Pinsel, Schriften, Texte (alles vor BeginDraw, damit ein Fehler nie ein halbes Bild hinterlässt) ------
  ComPtr<ID2D1SolidColorBrush> weiss, kreis, schild, hinweis;
  hr = rt->CreateSolidColorBrush(farbe(0xFFFFFF), &weiss);
  if (SUCCEEDED(hr)) hr = rt->CreateSolidColorBrush(farbe(kachel::PALETTE[kachel::farbIndex(name)]), &kreis);
  if (SUCCEEDED(hr)) hr = rt->CreateSolidColorBrush(farbe(0x000000, kachel::SCHILD_DECKKRAFT), &schild);
  if (SUCCEEDED(hr)) hr = rt->CreateSolidColorBrush(farbe(kachel::HINWEIS_FARBE), &hinweis);
  ComPtr<IDWriteTextFormat> initialenSchrift, nameSchrift, hinweisSchrift;
  if (SUCCEEDED(hr)) hr = schrift(dw.Get(), DWRITE_FONT_WEIGHT_SEMI_BOLD, m.initialenPx, &initialenSchrift);
  if (SUCCEEDED(hr)) hr = schrift(dw.Get(), DWRITE_FONT_WEIGHT_NORMAL, m.namePx, &nameSchrift);
  if (SUCCEEDED(hr)) hr = schrift(dw.Get(), DWRITE_FONT_WEIGHT_NORMAL, m.hinweisPx, &hinweisSchrift);
  if (FAILED(hr)) {
    e->hresult = hr;
    return;
  }

  // Initialen, nur ohne Profilbild: waagerecht nach der Vorschubbreite zentriert, senkrecht nach der Tinte (die
  // Zeilenbox von Segoe UI hat unten Platz für Unterlängen, Großbuchstaben säßen sonst sichtbar zu tief).
  ComPtr<IDWriteTextLayout> initialenText;
  float initialenVersatz = 0.0f;
  const std::u16string initialen = kachel::utf16Kodieren(kachel::initialen(name));
  if (!bildPinsel && !initialen.empty()) {
    const float d = static_cast<float>(m.durchmesser);
    hr = dw->CreateTextLayout(breit(initialen), static_cast<UINT32>(initialen.size()), initialenSchrift.Get(), d, d,
                              &initialenText);
    if (SUCCEEDED(hr)) hr = initialenText->SetTextAlignment(DWRITE_TEXT_ALIGNMENT_CENTER);
    if (SUCCEEDED(hr)) hr = initialenText->SetParagraphAlignment(DWRITE_PARAGRAPH_ALIGNMENT_CENTER);
    DWRITE_OVERHANG_METRICS ueberhang{};
    // Überhang = wie weit die Tinte über die Box hinausragt (oben/unten, innen negativ). Ohne ihn bleibt es bei
    // der Zeilenbox-Mitte.
    if (SUCCEEDED(hr) && SUCCEEDED(initialenText->GetOverhangMetrics(&ueberhang))) {
      initialenVersatz = (ueberhang.top - ueberhang.bottom) / 2.0f;
    }
  }

  // Namensschild: gekürzt auf maxTextBreite, gemessen mit DirectWrite (ohne Umbruch, mit Leerraum am Ende).
  ComPtr<IDWriteTextLayout> nameText;
  int textBreite = 0;
  if (SUCCEEDED(hr) && !name.empty()) {
    HRESULT messHr = S_OK;
    const kachel::Breite messen = [&](const std::vector<uint32_t>& text) -> int {
      const std::u16string t = kachel::utf16Kodieren(text);
      ComPtr<IDWriteTextLayout> probe;
      HRESULT r = dw->CreateTextLayout(breit(t), static_cast<UINT32>(t.size()), nameSchrift.Get(), kWeit, kWeit, &probe);
      DWRITE_TEXT_METRICS mass{};
      if (SUCCEEDED(r)) r = probe->GetMetrics(&mass);
      if (FAILED(r)) {
        if (SUCCEEDED(messHr)) messHr = r;
        return INT_MAX / 2;   // passt nie; das Ergebnis zählt ohnehin nicht (messHr unten)
      }
      return static_cast<int>(std::ceil(mass.widthIncludingTrailingWhitespace));
    };
    const std::u16string gekuerzt = kachel::utf16Kodieren(kachel::kuerzen(name, m.maxTextBreite, messen));
    textBreite = messen(kachel::utf16Dekodieren(gekuerzt));
    hr = messHr;
    if (SUCCEEDED(hr)) {
      hr = dw->CreateTextLayout(breit(gekuerzt), static_cast<UINT32>(gekuerzt.size()), nameSchrift.Get(), kWeit,
                                static_cast<float>(m.schildHoehe), &nameText);
    }
    if (SUCCEEDED(hr)) hr = nameText->SetParagraphAlignment(DWRITE_PARAGRAPH_ALIGNMENT_CENTER);
  }

  ComPtr<IDWriteTextLayout> hinweisText;
  if (SUCCEEDED(hr) && a.hinweis) {
    // Ein Feld ohne Destruktor, kein statischer std::u16string: ein losgelöster Zeichen-Thread kann beim
    // Prozessende noch zeichnen, während die CRT statische Objekte schon abbaut – dieses hier gibt es bis zuletzt.
    static constexpr char16_t kHinweis[] = u"Bild unterbrochen";
    hr = dw->CreateTextLayout(reinterpret_cast<const wchar_t*>(kHinweis), static_cast<UINT32>(std::size(kHinweis) - 1),
                              hinweisSchrift.Get(), static_cast<float>(w), kWeit, &hinweisText);
    if (SUCCEEDED(hr)) hr = hinweisText->SetTextAlignment(DWRITE_TEXT_ALIGNMENT_CENTER);
  }
  if (FAILED(hr)) {
    e->hresult = hr;
    return;
  }

  // --- Zeichnen ----------------------------------------------------------------------------------------------
  const D2D1_DRAW_TEXT_OPTIONS textArt = D2D1_DRAW_TEXT_OPTIONS_ENABLE_COLOR_FONT;
  const float radius = static_cast<float>(m.durchmesser) / 2.0f;
  const float mx = static_cast<float>(m.mitteX), my = static_cast<float>(m.mitteY);
  const D2D1_ELLIPSE kreisForm = D2D1::Ellipse(D2D1::Point2F(mx, my), radius, radius);
  rt->BeginDraw();
  // Grund: kachel::HINTERGRUND (0x232323). Die Vorschau in Connect malt für das Ersatzbild „Zoom-Kachel“ dieselbe
  // Farbe (apps/connect/src/renderer/src/zoom/SlotKachel.tsx, bg-[#232323]) – ändert sich die eine, die andere mit.
  rt->Clear(farbe(kachel::HINTERGRUND));
  if (bildPinsel) {
    // Das Bitmap ist durchmesser × durchmesser groß; verschoben auf die Ecke des Kreises füllt es ihn genau. Die
    // Kante glättet FillEllipse (Kantenglättung je Grundform).
    bildPinsel->SetTransform(D2D1::Matrix3x2F::Translation(mx - radius, my - radius));
    rt->FillEllipse(kreisForm, bildPinsel.Get());
  } else {
    rt->FillEllipse(kreisForm, kreis.Get());
    if (initialenText) {
      rt->DrawTextLayout(D2D1::Point2F(mx - radius, my - radius + initialenVersatz), initialenText.Get(), weiss.Get(),
                         textArt);
    }
  }
  if (hinweisText) {
    rt->DrawTextLayout(D2D1::Point2F(0.0f, static_cast<float>(m.hinweisOben)), hinweisText.Get(), hinweis.Get(), textArt);
  }
  if (nameText) {
    const float x = static_cast<float>(m.rand), y = static_cast<float>(m.schildY);
    const float hoehe = static_cast<float>(m.schildHoehe);
    const float breite = static_cast<float>(textBreite + 2 * m.textAbstand);
    rt->FillRoundedRectangle(D2D1::RoundedRect(D2D1::RectF(x, y, x + breite, y + hoehe), hoehe / 4.0f, hoehe / 4.0f),
                             schild.Get());
    rt->DrawTextLayout(D2D1::Point2F(x + static_cast<float>(m.textAbstand), y), nameText.Get(), weiss.Get(), textArt);
  }
  hr = rt->EndDraw();
  if (FAILED(hr)) {
    e->hresult = hr;
    return;
  }
  rt.Reset();

  // --- Ablesen ---------------------------------------------------------------------------------------------
  // Alles ist deckend (der Grund deckt die ganze Fläche), vormultipliziertes BGRA ist darum gewöhnliches BGRA.
  const WICRect alles{0, 0, w, h};
  ComPtr<IWICBitmapLock> sperre;
  UINT schritt = 0, groesse = 0;
  BYTE* daten = nullptr;
  hr = ziel->Lock(&alles, WICBitmapLockRead, &sperre);
  if (SUCCEEDED(hr)) hr = sperre->GetStride(&schritt);
  if (SUCCEEDED(hr)) hr = sperre->GetDataPointer(&groesse, &daten);
  if (SUCCEEDED(hr) && (daten == nullptr || schritt < static_cast<UINT>(w) * 4 ||
                        static_cast<uint64_t>(groesse) < static_cast<uint64_t>(schritt) * static_cast<uint64_t>(h - 1) +
                                                             static_cast<uint64_t>(w) * 4)) {
    hr = E_UNEXPECTED;
  }
  if (FAILED(hr)) {
    e->hresult = hr;
    return;
  }
  e->i420 = std::make_shared<const std::vector<uint8_t>>(kachel::bgraZuI420(daten, w, h, static_cast<int>(schritt)));
}

}  // namespace

KachelErgebnis kachelZeichnen(const KachelAuftrag& a) {
  const auto start = std::chrono::steady_clock::now();
  KachelErgebnis e;
  // Eigene COM-Wohnung je Zeichen-Thread. RPC_E_CHANGED_MODE: der Thread hat schon eine STA – WIC und Direct2D
  // gehen auch dort, nur abmelden darf er sie dann nicht.
  const HRESULT com = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
  if (FAILED(com) && com != RPC_E_CHANGED_MODE) {
    e.hresult = com;
  } else {
    try {
      zeichnen(a, &e);
    } catch (const std::bad_alloc&) {
      e.i420.reset();
      e.hresult = E_OUTOFMEMORY;
    } catch (...) {
      e.i420.reset();
      e.hresult = E_UNEXPECTED;
    }
    if (SUCCEEDED(com)) CoUninitialize();
  }
  e.dauerUs = std::chrono::duration_cast<std::chrono::microseconds>(std::chrono::steady_clock::now() - start).count();
  return e;
}

std::shared_ptr<KachelJob> kachelStarten(KachelAuftrag a, const kachel::KachelSchluessel& k) {
  auto job = std::make_shared<KachelJob>();
  job->schluessel = k;
  try {
    // Der Thread hält seine Kopie des Jobs: lässt der Slot ihn los (Frist, Slot zu), schreibt der Thread sein
    // Ergebnis trotzdem gefahrlos in einen Job, den dann niemand mehr liest.
    std::thread([job, auftrag = std::move(a)]() {
      KachelErgebnis ergebnis = kachelZeichnen(auftrag);   // wirft nie
      std::lock_guard<std::mutex> lock(job->m);
      job->ergebnis = std::move(ergebnis);
      job->fertig = true;
      job->cv.notify_all();
    }).detach();
  } catch (...) {
    // Kein Thread (std::system_error) oder kein Speicher für die Kopie: sofort fertig, ohne Bild – nie auf dem
    // Hauptthread nachzeichnen.
    std::lock_guard<std::mutex> lock(job->m);
    job->ergebnis = KachelErgebnis{};
    job->ergebnis.hresult = E_OUTOFMEMORY;
    job->fertig = true;
  }
  return job;
}

bool kachelWarten(KachelJob& j, int64_t ms) {
  std::unique_lock<std::mutex> lock(j.m);
  return j.cv.wait_for(lock, std::chrono::milliseconds(ms > 0 ? ms : 0), [&j] { return j.fertig; });
}

bool kachelFertig(KachelJob& j) {
  std::lock_guard<std::mutex> lock(j.m);
  return j.fertig;
}

// ---------------------------------------------------------------------------------------------------------------
// Sonderweg --kachel-muster
// ---------------------------------------------------------------------------------------------------------------

namespace {

/** Schreibt w × h Bildpunkte BGR (3 Bytes je Punkt, ohne Zeilenrest) als 24-bit-PNG. */
HRESULT pngSchreiben(IWICImagingFactory* wic, const std::wstring& ziel, int w, int h, const std::vector<uint8_t>& bgr) {
  ComPtr<IWICStream> strom;
  ComPtr<IWICBitmapEncoder> kodierer;
  ComPtr<IWICBitmapFrameEncode> bild;
  WICPixelFormatGUID format = GUID_WICPixelFormat24bppBGR;
  const UINT schritt = static_cast<UINT>(w) * 3;
  HRESULT hr = wic->CreateStream(&strom);
  if (SUCCEEDED(hr)) hr = strom->InitializeFromFilename(ziel.c_str(), GENERIC_WRITE);
  if (SUCCEEDED(hr)) hr = wic->CreateEncoder(GUID_ContainerFormatPng, nullptr, &kodierer);
  if (SUCCEEDED(hr)) hr = kodierer->Initialize(strom.Get(), WICBitmapEncoderNoCache);
  if (SUCCEEDED(hr)) hr = kodierer->CreateNewFrame(&bild, nullptr);
  if (SUCCEEDED(hr)) hr = bild->Initialize(nullptr);
  if (SUCCEEDED(hr)) hr = bild->SetSize(static_cast<UINT>(w), static_cast<UINT>(h));
  if (SUCCEEDED(hr)) hr = bild->SetPixelFormat(&format);
  // Der Kodierer darf ein anderes Format vorschlagen; dann passten die Bytes nicht mehr – lieber scheitern.
  if (SUCCEEDED(hr) && !IsEqualGUID(format, GUID_WICPixelFormat24bppBGR)) hr = WINCODEC_ERR_UNSUPPORTEDPIXELFORMAT;
  if (SUCCEEDED(hr) && bgr.size() != static_cast<size_t>(schritt) * static_cast<size_t>(h)) hr = E_INVALIDARG;
  if (SUCCEEDED(hr)) {
    hr = bild->WritePixels(static_cast<UINT>(h), schritt, static_cast<UINT>(bgr.size()), const_cast<BYTE*>(bgr.data()));
  }
  if (SUCCEEDED(hr)) hr = bild->Commit();
  if (SUCCEEDED(hr)) hr = kodierer->Commit();
  return hr;
}

/** Muster-Profilbild 512 × 512: Verlauf 0x0E72ED → 0xDB2777 von links nach rechts, darüber ein um 45° gedrehtes
 *  Schachbrett mit 32 px Kantenlänge, jedes zweite Feld 25 % Weiß. So zeigt die Musterkachel Ausschnitt,
 *  Skalierung und Kreiskante auf einen Blick. */
std::vector<uint8_t> profilbildMuster(int n) {
  std::vector<uint8_t> bgr(static_cast<size_t>(n) * static_cast<size_t>(n) * 3);
  const uint32_t von = 0x0E72ED, bis = 0xDB2777;
  const auto kanal = [](uint32_t rgb, int verschiebung) { return static_cast<double>((rgb >> verschiebung) & 0xFF); };
  const double wurzel2 = std::sqrt(2.0);
  for (int y = 0; y < n; ++y) {
    for (int x = 0; x < n; ++x) {
      const double t = static_cast<double>(x) / static_cast<double>(n - 1);
      double rgb[3] = {kanal(von, 16) + (kanal(bis, 16) - kanal(von, 16)) * t,
                       kanal(von, 8) + (kanal(bis, 8) - kanal(von, 8)) * t,
                       kanal(von, 0) + (kanal(bis, 0) - kanal(von, 0)) * t};
      const long u = static_cast<long>(std::floor((x + y) / wurzel2 / 32.0));
      const long v = static_cast<long>(std::floor((x - y) / wurzel2 / 32.0));
      if (((u + v) % 2 + 2) % 2 == 1) {
        for (double& k : rgb) k = k * 0.75 + 255.0 * 0.25;
      }
      uint8_t* p = &bgr[(static_cast<size_t>(y) * static_cast<size_t>(n) + static_cast<size_t>(x)) * 3];
      p[0] = static_cast<uint8_t>(std::lround(rgb[2]));
      p[1] = static_cast<uint8_t>(std::lround(rgb[1]));
      p[2] = static_cast<uint8_t>(std::lround(rgb[0]));
    }
  }
  return bgr;
}

struct MusterFall {
  const wchar_t* datei;        // ohne Endung; im Ordner als <datei>.png
  int w, h;
  const char16_t* name;
  const wchar_t* profilbild;   // Datei im Ordner, nullptr = ohne Profilbild
  bool hinweis;
};

constexpr const char16_t* kNormal = u"Anna Müller";
constexpr const char16_t* kLang = u"Prof. Dr. Maximilian Österreicher-Schönberg von Würzburg-Großenhain";
constexpr const wchar_t* kBild = L"_profilbild.png";

constexpr MusterFall kFaelle[] = {
    {L"360p-mit-profilbild", 640, 360, kNormal, kBild, false},
    {L"360p-initialen", 640, 360, kNormal, nullptr, false},
    {L"360p-langer-name", 640, 360, kLang, nullptr, false},
    {L"360p-bild-unterbrochen", 640, 360, kNormal, kBild, true},
    {L"720p-mit-profilbild", 1280, 720, kNormal, kBild, false},
    {L"720p-initialen", 1280, 720, kNormal, nullptr, false},
    {L"720p-langer-name", 1280, 720, kLang, nullptr, false},
    {L"720p-bild-unterbrochen", 1280, 720, kNormal, kBild, true},
    {L"1080p-mit-profilbild", 1920, 1080, kNormal, kBild, false},
    {L"1080p-initialen", 1920, 1080, kNormal, nullptr, false},
    {L"1080p-langer-name", 1920, 1080, kLang, nullptr, false},
    {L"1080p-bild-unterbrochen", 1920, 1080, kNormal, kBild, true},
    {L"720p-kaputtes-profilbild", 1280, 720, kNormal, L"_kaputt.jpg", false},
    {L"720p-riesiges-profilbild", 1280, 720, kNormal, L"_riesig.png", false},
    {L"720p-fehlendes-profilbild", 1280, 720, kNormal, L"_fehlt.png", false},
    // Langer Name im Hochformat: in 16:9 passt er überall ungekürzt, hier wird er mit „…“ gekürzt (Initialen PW).
    {L"360x640-initialen", 360, 640, kLang, nullptr, false},
    {L"640x480-mit-profilbild", 640, 480, kNormal, kBild, false},
    {L"320x180-initialen", 320, 180, kNormal, nullptr, false},
    {L"720p-chinesisch", 1280, 720, u"张伟", nullptr, false},
    {L"720p-arabisch", 1280, 720, u"محمد عبد الله", nullptr, false},
    {L"720p-nur-emoji", 1280, 720, u"🎤🎬", nullptr, false},
};
constexpr int kFallZahl = static_cast<int>(sizeof(kFaelle) / sizeof(kFaelle[0]));
static_assert(kFallZahl == 21, "die Musterprobe erwartet genau 21 Musterkacheln");

/** So lange darf eine Musterkachel brauchen; die Probe selbst gibt nach 60 s für alle 21 auf. */
constexpr int64_t kMusterFristMs = 20000;

void schlusszeile(bool fertig, int dateien, bool gleich) {
  emitRaw(std::string("{\"ev\":\"kachelMuster\",\"fertig\":") + (fertig ? "true" : "false") +
          ",\"dateien\":" + std::to_string(dateien) + ",\"gleichInitialen\":" + (gleich ? "true" : "false") + "}");
}

/** Der Lauf; alle COM-Zeiger leben hier drin (vor CoUninitialize in kachelMuster freigegeben). */
int musterLauf(const std::filesystem::path& ordner) {
  std::error_code fehler, gibtEs;
  std::filesystem::create_directories(ordner, fehler);
  if (!std::filesystem::is_directory(ordner, gibtEs)) {
    emitLog(L"Kachel-Muster: Zielordner nicht anlegbar (Fehler " + std::to_wstring(fehler.value()) + L")");
    schlusszeile(false, 0, false);
    return 1;
  }
  ComPtr<IWICImagingFactory> wic;
  HRESULT hr = CoCreateInstance(CLSID_WICImagingFactory, nullptr, CLSCTX_INPROC_SERVER, IID_PPV_ARGS(&wic));
  if (FAILED(hr)) {
    emitLog(L"Kachel-Muster: WIC nicht verfügbar (HRESULT " + hexHr(hr) + L")");
    schlusszeile(false, 0, false);
    return 1;
  }

  // Die Profilbilder der Fälle: ein gutes, ein zu großes (Seite über PROFILBILD_MAX_SEITE), ein kaputtes (keine
  // Bildsignatur, beginnt mit JMKAPUTT) und eins, das es nicht gibt.
  const int bildSeite = 512;
  hr = pngSchreiben(wic.Get(), (ordner / kBild).wstring(), bildSeite, bildSeite, profilbildMuster(bildSeite));
  if (SUCCEEDED(hr)) {
    const int rw = 5000, rh = 8;
    std::vector<uint8_t> einfarbig(static_cast<size_t>(rw) * rh * 3);
    for (size_t i = 0; i < einfarbig.size(); i += 3) {
      einfarbig[i] = 0xED;
      einfarbig[i + 1] = 0x72;
      einfarbig[i + 2] = 0x0E;
    }
    hr = pngSchreiben(wic.Get(), (ordner / L"_riesig.png").wstring(), rw, rh, einfarbig);
  }
  if (SUCCEEDED(hr)) {
    std::string kaputt(4096, '\0');
    std::memcpy(&kaputt[0], "JMKAPUTT", 8);
    std::ofstream aus(ordner / L"_kaputt.jpg", std::ios::binary | std::ios::trunc);
    aus.write(kaputt.data(), static_cast<std::streamsize>(kaputt.size()));
    aus.close();
    if (!aus) hr = E_FAIL;
  }
  if (FAILED(hr)) {
    emitLog(L"Kachel-Muster: Muster-Profilbilder nicht geschrieben (HRESULT " + hexHr(hr) + L")");
    schlusszeile(false, 0, false);
    return 1;
  }
  DeleteFileW((ordner / L"_fehlt.png").c_str());   // aus einem früheren Lauf? Es darf nicht da sein.

  int dateien = 0;
  bool fertig = true;
  kachel::Puffer initialen720, kaputt, riesig, fehlt;
  std::vector<uint8_t> bgr;
  for (const MusterFall& f : kFaelle) {
    KachelAuftrag auftrag;
    auftrag.name = f.name;
    if (f.profilbild != nullptr) {
      const std::wstring voll = (ordner / f.profilbild).wstring();
      auftrag.profilbild.assign(voll.begin(), voll.end());
    }
    auftrag.hinweis = f.hinweis;
    auftrag.w = f.w;
    auftrag.h = f.h;
    // Über den Thread-Weg wie im Meeting (kachelStarten, kachelWarten), nur mit großzügiger Frist.
    const std::shared_ptr<KachelJob> job = kachelStarten(std::move(auftrag), kachel::KachelSchluessel{});
    if (!kachelWarten(*job, kMusterFristMs)) {
      emitLog(L"Kachel-Muster: eine Kachel nach " + std::to_wstring(kMusterFristMs) + L" ms nicht fertig - Abbruch");
      fertig = false;
      break;
    }
    const KachelErgebnis& e = job->ergebnis;
    if (e.i420 == nullptr) {
      emitLog(L"Kachel-Muster: Kachel nicht gezeichnet (HRESULT " + hexHr(e.hresult) + L")");
      continue;
    }
    const char* fehlerText = kachel::fehlerName(e.fehler);
    if (e.fehler != kachel::ProfilbildFehler::Keiner && e.fehler != kachel::ProfilbildFehler::KeinPfad) {
      const std::wstring art(fehlerText, fehlerText + std::strlen(fehlerText));
      emitLog(L"Kachel-Muster: Profilbild nicht verwendet (" + art + L", HRESULT " + hexHr(e.hresult) + L") - Initialen");
    }
    const std::wstring datei = std::wstring(f.datei) + L".png";
    kachel::i420ZuBgr(e.i420->data(), f.w, f.h, &bgr);
    hr = pngSchreiben(wic.Get(), (ordner / datei).wstring(), f.w, f.h, bgr);
    if (FAILED(hr)) {
      emitLog(L"Kachel-Muster: eine Musterkachel nicht geschrieben (HRESULT " + hexHr(hr) + L")");
      continue;
    }
    ++dateien;
    char ms[32];
    std::snprintf(ms, sizeof(ms), "%.1f", static_cast<double>(e.dauerUs) / 1000.0);
    emitRaw("{\"ev\":\"kachelMuster\",\"datei\":\"" + jsonEscape(datei) + "\",\"w\":" + std::to_string(f.w) +
            ",\"h\":" + std::to_string(f.h) + ",\"profilbild\":\"" + fehlerText + "\",\"ms\":" + ms + "}");
    const std::wstring fall = f.datei;
    if (fall == L"720p-initialen") initialen720 = e.i420;
    if (fall == L"720p-kaputtes-profilbild") kaputt = e.i420;
    if (fall == L"720p-riesiges-profilbild") riesig = e.i420;
    if (fall == L"720p-fehlendes-profilbild") fehlt = e.i420;
  }

  // Ein Profilbild, das nicht taugt, darf die Kachel um kein Byte von der ohne Profilbild unterscheiden.
  const auto gleich = [&initialen720](const kachel::Puffer& p) { return p != nullptr && *p == *initialen720; };
  const bool gleichInitialen = initialen720 != nullptr && gleich(kaputt) && gleich(riesig) && gleich(fehlt);
  schlusszeile(fertig, dateien, gleichInitialen);
  return (fertig && dateien == kFallZahl && gleichInitialen) ? 0 : 1;
}

}  // namespace

int kachelMuster(const std::wstring& ordner) {
  // Der Sonderweg läuft auf dem Hauptthread, aber ohne Meeting; WIC zum Schreiben der PNG braucht COM.
  const HRESULT com = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
  if (FAILED(com) && com != RPC_E_CHANGED_MODE) {
    emitLog(L"Kachel-Muster: COM nicht verfügbar (HRESULT " + hexHr(com) + L")");
    schlusszeile(false, 0, false);
    return 1;
  }
  int rc = 1;
  try {
    rc = musterLauf(std::filesystem::path(ordner));
  } catch (...) {
    emitLog(L"Kachel-Muster: Ausnahme im Lauf - Abbruch");
    schlusszeile(false, 0, false);
    rc = 1;
  }
  if (SUCCEEDED(com)) CoUninitialize();
  return rc;
}
