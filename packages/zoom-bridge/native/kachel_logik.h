// Inhalte der Zoom-Kachel (#306): reine Logik, ohne Zoom, ohne NDI, ohne Direct2D, ohne Uhr (G-A2).
//
// Die Kachel ist ein deckendes Ersatzbild: Profilbild oder Initialen auf farbigem Kreis, dazu der Name, auf
// dunklem Grund, als I420. Gezeichnet wird sie anderswo (Direct2D/DirectWrite, je Zustandswechsel einmal); hier
// stehen nur die Entscheidungen und Rechnungen, die sich ohne Zeichnen pruefen lassen: welche Buchstaben, welche
// Farbe, wie gekuerzt, welche Masse, welches Profilbild brauchbar ist, wie ein BGRA-Bild zu I420 wird.
//
// Alle Texte laufen als Code-Punkte (uint32_t), nicht als UTF-16-Einheiten: Initialen und Kuerzung duerfen kein
// Surrogatpaar und kein Zeichen samt Kombinationszeichen zerreissen. Die Unicode-Tabellen sind absichtlich klein
// und fest (Spec der Kachel); was nicht darin steht, zaehlt nicht als Buchstabe.
//
// Nur Standardbibliothek; ein Selbsttest (selftest.ts, G-A2) prueft die Einbindungen.
#pragma once

#include <algorithm>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <functional>
#include <memory>
#include <string>
#include <utility>
#include <vector>

namespace kachel {

// ---------------------------------------------------------------------------------------------------------------
// Code-Punkte
// ---------------------------------------------------------------------------------------------------------------

/** Leerraum: U+0009-000D, U+0020, U+00A0, U+1680, U+2000-200A, U+2028, U+2029, U+202F, U+205F, U+3000. */
inline bool istLeerraum(uint32_t c) {
  return (c >= 0x09 && c <= 0x0D) || c == 0x20 || c == 0xA0 || c == 0x1680 || (c >= 0x2000 && c <= 0x200A) ||
         c == 0x2028 || c == 0x2029 || c == 0x202F || c == 0x205F || c == 0x3000;
}

/** Buchstabe oder Ziffer im Sinne der Kachel (feste, kleine Tabelle). */
inline bool istZeichen(uint32_t c) {
  if (c >= '0' && c <= '9') return true;
  if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z')) return true;
  if (c >= 0x00C0 && c <= 0x024F) return c != 0x00D7 && c != 0x00F7;
  return (c >= 0x0370 && c <= 0x03FF) || (c >= 0x0400 && c <= 0x052F) || (c >= 0x0531 && c <= 0x058F) ||
         (c >= 0x05D0 && c <= 0x05EA) || (c >= 0x0620 && c <= 0x064A) || (c >= 0x0900 && c <= 0x0DFF) ||
         (c >= 0x0E00 && c <= 0x0E7F) || (c >= 0x1100 && c <= 0x11FF) || (c >= 0x1E00 && c <= 0x1EFF) ||
         (c >= 0x3040 && c <= 0x30FF) || (c >= 0x3400 && c <= 0x4DBF) || (c >= 0x4E00 && c <= 0x9FFF) ||
         (c >= 0xAC00 && c <= 0xD7A3);
}

/** Gehoert zum Zeichen davor: Kombinationszeichen, Variantenwaehler, Hautton, Zero-Width-Joiner. */
inline bool haengt(uint32_t c) {
  return (c >= 0x0300 && c <= 0x036F) || (c >= 0x1AB0 && c <= 0x1AFF) || (c >= 0x20D0 && c <= 0x20FF) ||
         (c >= 0xFE20 && c <= 0xFE2F) || (c >= 0xFE00 && c <= 0xFE0F) || (c >= 0xE0100 && c <= 0xE01EF) ||
         (c >= 0x1F3FB && c <= 0x1F3FF) || c == 0x200D;
}

/** Grossbuchstabe zu c (Latein, Griechisch, Kyrillisch); alles andere bleibt, wie es ist. */
inline uint32_t gross(uint32_t c) {
  if (c >= 'a' && c <= 'z') return c - 0x20;
  if (c >= 0x00E0 && c <= 0x00FE) return c == 0x00F7 ? c : c - 0x20;
  if (c == 0x00FF) return 0x0178;
  if (c == 0x0131) return 0x0049;   // vor der Bereichsregel: ı (ungerade) wird I, nicht İ
  if ((c >= 0x0100 && c <= 0x0137) || (c >= 0x014A && c <= 0x0177)) return (c % 2 == 1) ? c - 1 : c;
  if ((c >= 0x0139 && c <= 0x0148) || (c >= 0x0179 && c <= 0x017E)) return (c % 2 == 0) ? c - 1 : c;
  if (c >= 0x03B1 && c <= 0x03C9) return c == 0x03C2 ? 0x03A3 : c - 0x20;
  if (c == 0x03AC) return 0x0386;
  if (c >= 0x03AD && c <= 0x03AF) return c - 0x03AD + 0x0388;
  if (c == 0x03CC) return 0x038C;
  if (c == 0x03CD || c == 0x03CE) return c - 0x03CD + 0x038E;
  if (c >= 0x0430 && c <= 0x044F) return c - 0x20;
  if (c >= 0x0450 && c <= 0x045F) return c - 0x50;
  return c;
}

/** UTF-16 zu Code-Punkten; ein einsames Surrogat wird zu U+FFFD. */
inline std::vector<uint32_t> utf16Dekodieren(const std::u16string& s) {
  std::vector<uint32_t> aus;
  aus.reserve(s.size());
  for (size_t i = 0; i < s.size(); ++i) {
    const uint32_t u = static_cast<uint32_t>(s[i]);
    if (u >= 0xD800 && u <= 0xDBFF) {
      if (i + 1 < s.size()) {
        const uint32_t v = static_cast<uint32_t>(s[i + 1]);
        if (v >= 0xDC00 && v <= 0xDFFF) {
          aus.push_back(0x10000 + ((u - 0xD800) << 10) + (v - 0xDC00));
          ++i;
          continue;
        }
      }
      aus.push_back(0xFFFD);
    } else if (u >= 0xDC00 && u <= 0xDFFF) {
      aus.push_back(0xFFFD);
    } else {
      aus.push_back(u);
    }
  }
  return aus;
}

/** Code-Punkte zu UTF-16; ungueltige Werte (Surrogate, ueber U+10FFFF) werden zu U+FFFD. */
inline std::u16string utf16Kodieren(const std::vector<uint32_t>& cps) {
  std::u16string aus;
  aus.reserve(cps.size());
  for (uint32_t c : cps) {
    if ((c >= 0xD800 && c <= 0xDFFF) || c > 0x10FFFF) c = 0xFFFD;
    if (c >= 0x10000) {
      const uint32_t v = c - 0x10000;
      aus.push_back(static_cast<char16_t>(0xD800 + (v >> 10)));
      aus.push_back(static_cast<char16_t>(0xDC00 + (v & 0x3FF)));
    } else {
      aus.push_back(static_cast<char16_t>(c));
    }
  }
  return aus;
}

// ---------------------------------------------------------------------------------------------------------------
// Initialen, Farbe
// ---------------------------------------------------------------------------------------------------------------

/**
 * Initialen eines Namens: Woerter = Folgen ohne Leerraum. Je Wort zaehlt der erste Buchstabe/Ziffer samt der
 * direkt folgenden Kombinationszeichen („Anfang“); ein Wort ohne Buchstabe zaehlt nicht. Ergebnis = Anfang des
 * ersten Worts, bei mindestens zwei zaehlenden Woertern dahinter der Anfang des letzten. Gross wird nur der erste
 * Code-Punkt je Anfang geschrieben.
 */
inline std::vector<uint32_t> initialen(const std::vector<uint32_t>& name) {
  std::vector<std::vector<uint32_t>> anfaenge;
  size_t i = 0;
  while (i < name.size()) {
    while (i < name.size() && istLeerraum(name[i])) ++i;
    const size_t von = i;
    while (i < name.size() && !istLeerraum(name[i])) ++i;
    size_t k = von;
    while (k < i && !istZeichen(name[k])) ++k;
    if (k >= i) continue;   // Wort ohne Buchstabe oder Ziffer
    std::vector<uint32_t> anfang;
    anfang.push_back(gross(name[k]));
    for (size_t j = k + 1; j < i && haengt(name[j]); ++j) anfang.push_back(name[j]);
    anfaenge.push_back(anfang);
  }
  std::vector<uint32_t> aus;
  if (anfaenge.empty()) return aus;
  aus = anfaenge.front();
  if (anfaenge.size() >= 2) aus.insert(aus.end(), anfaenge.back().begin(), anfaenge.back().end());
  return aus;
}

/** FNV-1a ueber die Code-Punkte, je Punkt seine vier Bytes, das niedrigste zuerst. */
inline uint32_t fnv1a32(const std::vector<uint32_t>& cps) {
  uint32_t h = 2166136261u;
  for (const uint32_t c : cps) {
    for (int b = 0; b < 4; ++b) {
      h ^= (c >> (8 * b)) & 0xFFu;
      h *= 16777619u;
    }
  }
  return h;
}

/** Farbplatz des Namens in PALETTE: Hash des Namens ohne Leerraum an den Raendern, modulo 8. */
inline int farbIndex(const std::vector<uint32_t>& name) {
  size_t von = 0, bis = name.size();
  while (von < bis && istLeerraum(name[von])) ++von;
  while (bis > von && istLeerraum(name[bis - 1])) --bis;
  const std::vector<uint32_t> kern(name.begin() + static_cast<std::ptrdiff_t>(von),
                                   name.begin() + static_cast<std::ptrdiff_t>(bis));
  return static_cast<int>(fnv1a32(kern) % 8u);
}

/** Kreisfarben (RGB); jede traegt weisse Schrift mit Kontrast >= 4,5 und hebt sich vom Grund ab (>= 2,0). */
inline constexpr uint32_t PALETTE[8] = {0x0E72ED, 0xC2410C, 0x15803D, 0x7C3AED, 0xBE123C, 0x0F766E, 0xA16207, 0xDB2777};
/** Grund der Kachel; muss dem Vorschau-Grund in Connect (#232323) gleichen. */
inline constexpr uint32_t HINTERGRUND = 0x232323;
inline constexpr uint32_t HINWEIS_FARBE = 0xBDBDBD;
/** Deckkraft des Namensschilds. */
inline constexpr float SCHILD_DECKKRAFT = 0.55f;

// ---------------------------------------------------------------------------------------------------------------
// Kuerzen
// ---------------------------------------------------------------------------------------------------------------

/** Breite eines Textes in Bildpunkten; der Zeichner liefert sie aus DirectWrite, der Test aus einer Attrappe. */
using Breite = std::function<int(const std::vector<uint32_t>&)>;

/**
 * Kuerzt text auf hoechstens maxBreite: passt er, bleibt er; sonst das laengste Stueck samt „…“ (U+2026), das
 * passt (0 Zeichen sind erlaubt). Nie vor einem Kombinationszeichen und nie mitten in einer ZWJ-Folge; Leerraum
 * vor dem „…“ faellt weg.
 */
inline std::vector<uint32_t> kuerzen(const std::vector<uint32_t>& text, int maxBreite, const Breite& breite) {
  if (breite(text) <= maxBreite) return text;
  const auto mitPunkten = [&text](size_t n) {
    std::vector<uint32_t> t(text.begin(), text.begin() + static_cast<std::ptrdiff_t>(n));
    t.push_back(0x2026);
    return t;
  };
  size_t lo = 0, hi = text.size();   // groesstes n mit breite(text[0..n) + …) <= maxBreite, 0 immer erlaubt
  while (lo < hi) {
    const size_t mitte = lo + (hi - lo + 1) / 2;
    if (breite(mitPunkten(mitte)) <= maxBreite) lo = mitte; else hi = mitte - 1;
  }
  size_t n = lo;
  while (n > 0 && n < text.size() && (haengt(text[n]) || text[n - 1] == 0x200D)) --n;
  while (n > 0 && istLeerraum(text[n - 1])) --n;
  return mitPunkten(n);
}

// ---------------------------------------------------------------------------------------------------------------
// Masse
// ---------------------------------------------------------------------------------------------------------------

/** Alle Masse der Kachel in Bildpunkten, aus Breite und Hoehe des Ersatzbilds. */
struct KachelMasse {
  int durchmesser, mitteX, mitteY, initialenPx, hinweisPx, hinweisOben, rand, namePx, schildHoehe, schildY,
      textAbstand, maxTextBreite;
};

inline KachelMasse masse(int w, int h) {
  const auto r = [](double x) { return static_cast<int>(std::lround(x)); };
  const double s = static_cast<double>(std::min(w, h));
  KachelMasse m{};
  m.durchmesser = r(0.40 * s);
  m.mitteX = w / 2;
  m.mitteY = r(0.45 * h);
  m.initialenPx = r(0.40 * m.durchmesser);
  m.hinweisPx = r(0.045 * s);
  m.hinweisOben = m.mitteY + m.durchmesser / 2 + r(0.04 * s);
  m.rand = r(0.025 * s);
  m.namePx = r(0.05 * s);
  m.schildHoehe = r(1.6 * m.namePx);
  m.schildY = h - m.rand - m.schildHoehe;
  m.textAbstand = r(0.4 * m.namePx);
  m.maxTextBreite = w - 2 * m.rand - 2 * m.textAbstand;
  return m;
}

// ---------------------------------------------------------------------------------------------------------------
// Profilbild
// ---------------------------------------------------------------------------------------------------------------

/** Warum ein Profilbild nicht taugt (Namen gehen als Text ins Protokoll). */
enum class ProfilbildFehler : uint8_t { Keiner, KeinPfad, Fehlt, ZuGross, Unlesbar, Frist };

inline const char* fehlerName(ProfilbildFehler f) {
  switch (f) {
    case ProfilbildFehler::Keiner: return "keiner";
    case ProfilbildFehler::KeinPfad: return "keinPfad";
    case ProfilbildFehler::Fehlt: return "fehlt";
    case ProfilbildFehler::ZuGross: return "zuGross";
    case ProfilbildFehler::Unlesbar: return "unlesbar";
    case ProfilbildFehler::Frist: return "frist";
  }
  return "keiner";
}

inline constexpr uint64_t PROFILBILD_MAX_BYTES = 10ull * 1024 * 1024;
inline constexpr uint32_t PROFILBILD_MAX_SEITE = 4096;

/** Prueft Dateigroesse und Bildmasse eines Profilbilds vor dem Zeichnen. */
inline ProfilbildFehler profilbildPruefen(uint64_t bytes, uint32_t w, uint32_t h) {
  if (bytes > PROFILBILD_MAX_BYTES) return ProfilbildFehler::ZuGross;
  if (w == 0 || h == 0) return ProfilbildFehler::Unlesbar;
  if (w > PROFILBILD_MAX_SEITE || h > PROFILBILD_MAX_SEITE) return ProfilbildFehler::ZuGross;
  return ProfilbildFehler::Keiner;
}

/** Mittiger quadratischer Ausschnitt eines Bildes. */
struct Ausschnitt {
  uint32_t x, y, seite;
};

inline Ausschnitt quadratAusschnitt(uint32_t w, uint32_t h) {
  const uint32_t seite = std::min(w, h);
  return Ausschnitt{(w - seite) / 2, (h - seite) / 2, seite};
}

// ---------------------------------------------------------------------------------------------------------------
// I420
// ---------------------------------------------------------------------------------------------------------------

/** Bytes eines I420-Bildes: Y (w*h) plus U und V je (w/2)*(h/2). */
inline size_t i420Bytes(int w, int h) {
  return static_cast<size_t>(w) * static_cast<size_t>(h) +
         2 * static_cast<size_t>(w / 2) * static_cast<size_t>(h / 2);
}

/**
 * BGRA (deckend, stride in Bytes) zu I420, BT.601, begrenzter Wertebereich. U/V aus dem gerundeten Mittel des
 * 2x2-Blocks je Kanal. Ebenen wie fillBlackI420: Y, dann U, dann V.
 */
inline std::vector<uint8_t> bgraZuI420(const uint8_t* bgra, int w, int h, int stride) {
  std::vector<uint8_t> aus(i420Bytes(w, h));
  const size_t flaeche = static_cast<size_t>(w) * static_cast<size_t>(h);
  const size_t halbBreite = static_cast<size_t>(w / 2);
  const size_t halbHoehe = static_cast<size_t>(h / 2);
  const auto punkt = [&](int x, int y) { return bgra + static_cast<size_t>(y) * static_cast<size_t>(stride) + static_cast<size_t>(x) * 4; };
  for (int y = 0; y < h; ++y) {
    for (int x = 0; x < w; ++x) {
      const uint8_t* p = punkt(x, y);
      const int b = p[0], g = p[1], rr = p[2];
      aus[static_cast<size_t>(y) * static_cast<size_t>(w) + static_cast<size_t>(x)] =
          static_cast<uint8_t>(((66 * rr + 129 * g + 25 * b + 128) >> 8) + 16);
    }
  }
  for (size_t by = 0; by < halbHoehe; ++by) {
    for (size_t bx = 0; bx < halbBreite; ++bx) {
      int sb = 0, sg = 0, sr = 0;
      for (int dy = 0; dy < 2; ++dy) {
        for (int dx = 0; dx < 2; ++dx) {
          const uint8_t* p = punkt(static_cast<int>(bx) * 2 + dx, static_cast<int>(by) * 2 + dy);
          sb += p[0];
          sg += p[1];
          sr += p[2];
        }
      }
      const int b = (sb + 2) / 4, g = (sg + 2) / 4, rr = (sr + 2) / 4;
      const size_t ort = by * halbBreite + bx;
      aus[flaeche + ort] = static_cast<uint8_t>((112 * b - 38 * rr - 74 * g + 32896) >> 8);
      aus[flaeche + halbBreite * halbHoehe + ort] = static_cast<uint8_t>((112 * rr - 94 * g - 18 * b + 32896) >> 8);
    }
  }
  return aus;
}

/** Die Kachel ohne Profilbild und ohne Text: nur der Grund (Y 46, U 128, V 128). */
inline std::vector<uint8_t> grundkachelI420(int w, int h) {
  std::vector<uint8_t> aus(i420Bytes(w, h), 128);
  std::fill(aus.begin(), aus.begin() + static_cast<std::ptrdiff_t>(static_cast<size_t>(w) * static_cast<size_t>(h)), static_cast<uint8_t>(46));
  return aus;
}

/** I420 zu BGR (3 Bytes je Punkt), BT.601 begrenzt wie in preview.cpp, ohne Verkleinern. */
inline void i420ZuBgr(const uint8_t* i420, int w, int h, std::vector<uint8_t>* bgr) {
  const auto klemme = [](int v) { return static_cast<uint8_t>(v < 0 ? 0 : (v > 255 ? 255 : v)); };
  bgr->resize(static_cast<size_t>(w) * static_cast<size_t>(h) * 3);
  const uint8_t* yEbene = i420;
  const uint8_t* uEbene = i420 + static_cast<size_t>(w) * static_cast<size_t>(h);
  const uint8_t* vEbene = uEbene + static_cast<size_t>(w / 2) * static_cast<size_t>(h / 2);
  for (int y = 0; y < h; ++y) {
    for (int x = 0; x < w; ++x) {
      const size_t farbort = static_cast<size_t>(y / 2) * static_cast<size_t>(w / 2) + static_cast<size_t>(x / 2);
      const int c = yEbene[static_cast<size_t>(y) * static_cast<size_t>(w) + static_cast<size_t>(x)] - 16;
      const int d = uEbene[farbort] - 128;
      const int e = vEbene[farbort] - 128;
      uint8_t* ziel = &(*bgr)[(static_cast<size_t>(y) * static_cast<size_t>(w) + static_cast<size_t>(x)) * 3];
      ziel[0] = klemme((298 * c + 516 * d + 128) >> 8);
      ziel[1] = klemme((298 * c - 100 * d - 208 * e + 128) >> 8);
      ziel[2] = klemme((298 * c + 409 * e + 128) >> 8);
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Zeichen-Ablauf je Slot
// ---------------------------------------------------------------------------------------------------------------

/** Name und Profilbild-Pfad eines Teilnehmers, wie der Slot sie aus Zoom liest. */
struct Profil {
  std::u16string name;
  std::u16string profilbild;
};

/** Alles, was die gezeichnete Kachel bestimmt; gleicher Schluessel = gleiches Bild, nichts neu zu zeichnen. */
struct KachelSchluessel {
  unsigned ziel = 0;
  uint64_t profilStand = 0;
  bool hinweis = false;
  int w = 0, h = 0;
  bool mitProfilbild = false;
};

inline bool operator==(const KachelSchluessel& a, const KachelSchluessel& b) {
  return a.ziel == b.ziel && a.profilStand == b.profilStand && a.hinweis == b.hinweis && a.w == b.w && a.h == b.h &&
         a.mitProfilbild == b.mitProfilbild;
}

/** So lange wartet die Hauptschleife hoechstens auf einen Zeichenauftrag. */
inline constexpr int64_t KACHEL_WARTEN_MS = 50;
/** Nach so vielen Millisekunden gibt ein laufender Zeichenauftrag auf (erst das Profilbild, dann die Initialen). */
inline constexpr int64_t KACHEL_FRIST_MS = 2000;
/** Kennt Zoom ein Ziel gerade nicht (kein Nutzer), fragt der Slot frühestens nach so vielen Millisekunden wieder. */
inline constexpr int64_t PROFIL_WIEDERHOLEN_MS = 1000;

using Puffer = std::shared_ptr<const std::vector<uint8_t>>;

/**
 * Zustand der Kachel eines Slots: gelesenes Profil, laufender Zeichenauftrag samt Frist, fertiger Puffer und dunkle
 * Grundflaeche. Keine Uhr: die Zeit kommt nur als Parameter. Gezeichnet wird je Zustandswechsel einmal; wer
 * zeichnet, steht anderswo.
 */
class KachelStand {
 public:
  /** Muss das Profil von ziel (neu) gelesen werden? Vor dem ersten Lesen, nach profilVeraltet, bei anderem Ziel. */
  bool profilLesenNoetig(unsigned ziel) const { return !gelesen_ || veraltet_ || ziel != profilZiel_; }

  /**
   * Soll der Slot das Profil von ziel jetzt lesen? Wie profilLesenNoetig, aber nach profilNichtGefunden für dieses
   * Ziel erst wieder ab PROFIL_WIEDERHOLEN_MS - kein SDK-Aufruf je Herzschlag.
   */
  bool profilJetztLesen(unsigned ziel, int64_t jetzt) const {
    return profilLesenNoetig(ziel) && !(nichtGefundenZiel_ == ziel && jetzt < nichtGefundenBis_);
  }

  /**
   * Zoom kennt ziel gerade nicht (kein Nutzer zur Kennung): das zählt NICHT als gelesen - der Stand bleibt, wie er
   * war, und gefragt wird nach PROFIL_WIEDERHOLEN_MS wieder (profilJetztLesen).
   */
  void profilNichtGefunden(unsigned ziel, int64_t jetzt) {
    nichtGefundenZiel_ = ziel;
    nichtGefundenBis_ = jetzt + PROFIL_WIEDERHOLEN_MS;
  }

  /** Ein frisch gelesenes Profil; zaehlt den Profilstand hoch (neuer Stand = neu zeichnen, neuer Versuch). */
  void profilGelesen(unsigned ziel, Profil p) {
    profilZiel_ = ziel;
    profil_ = std::move(p);
    ++profilStand_;
    gelesen_ = true;
    veraltet_ = false;
    nichtGefundenZiel_ = 0;
    nichtGefundenBis_ = 0;
  }

  /**
   * Das gelesene Profil, wenn es zu ziel gehört (auch wenn es als veraltet markiert ist: dieselbe Person); sonst
   * nullptr - nie Name oder Bild eines anderen Ziels, etwa nach einem Umhängen während der Renderer-Sperre, in der
   * nicht gelesen wird. Der Zeiger gilt bis zum nächsten profilGelesen bzw. leeren().
   */
  const Profil* profilFuer(unsigned ziel) const { return gelesen_ && profilZiel_ == ziel ? &profil_ : nullptr; }

  /** Zoom meldet eine Aenderung an Teilnehmer id (0 = alle): das Profil muss neu gelesen werden. */
  void profilVeraltet(unsigned id) {
    if (id == 0 || id == profilZiel_) veraltet_ = true;
  }

  const Profil& profil() const { return profil_; }

  /**
   * Die Kachel, die jetzt stehen soll; das Profilbild zählt, solange das gelesene Profil zu ziel gehört, der Pfad
   * nicht leer und der Stand nicht aufgegeben ist.
   */
  KachelSchluessel soll(unsigned ziel, bool hinweis, int w, int h) const {
    KachelSchluessel k;
    k.ziel = ziel;
    k.profilStand = profilStand_;
    k.hinweis = hinweis;
    k.w = w;
    k.h = h;
    // Nur das Profilbild DIESES Ziels zählt (profilFuer): ein Profil eines anderen Ziels trägt kein Bild in den Schlüssel.
    k.mitProfilbild = profilFuer(ziel) != nullptr && !profil_.profilbild.empty() && aufgegebenStand_ != profilStand_;
    return k;
  }

  /** Steht genau diese Kachel schon im Puffer? */
  bool hat(const KachelSchluessel& k) const { return puffer_ != nullptr && pufferSchluessel_ == k; }
  /** Laeuft fuer genau diese Kachel gerade ein Zeichenauftrag? */
  bool laeuft(const KachelSchluessel& k) const { return laufend_ && laufSchluessel_ == k; }

  /**
   * Läuft (oder hängt) ein Auftrag MIT Profilbild für dasselbe Ziel und denselben Profilstand wie k, und will k
   * ebenfalls das Profilbild? Dann kommt kein zweiter Auftrag: jeder hängende Lesezugriff hielte sonst einen Thread
   * mehr an derselben Datei. Die Frist des laufenden Auftrags gilt weiter; nach ihr ist das Bild dieses Stands
   * aufgegeben (fristAblauf), und k kommt ohne Profilbild.
   */
  bool bildAuftragOffen(const KachelSchluessel& k) const {
    return laufend_ && laufSchluessel_.mitProfilbild && k.mitProfilbild && laufSchluessel_.ziel == k.ziel &&
           laufSchluessel_.profilStand == k.profilStand;
  }

  /** Beginnt einen Auftrag und setzt die Frist neu; wer ihn schon laufen hat, fragt vorher mit laeuft() nach. */
  void gestartet(const KachelSchluessel& k, int64_t jetzt) {
    laufend_ = true;
    laufSchluessel_ = k;
    start_ = jetzt;
  }

  /**
   * Ein Zeichenauftrag ist fertig. Das Bild gilt immer als jüngster Puffer; beendet wird der laufende Auftrag nur,
   * wenn das Ergebnis zu ihm gehoert (das spaete Ergebnis eines alten Auftrags laesst den neuen weiterlaufen).
   */
  void fertig(const KachelSchluessel& k, Puffer i420) {
    puffer_ = std::move(i420);
    pufferSchluessel_ = k;
    if (laufend_ && laufSchluessel_ == k) laufend_ = false;
  }

  /**
   * Das Ergebnis des Auftrags k wird nicht gebraucht (die gewünschte Kachel steht schon im Puffer): beendet den
   * laufenden Auftrag, wenn er k gilt, und lässt Puffer und alles andere, wie es ist - anders als fertig().
   */
  void verwerfen(const KachelSchluessel& k) {
    if (laufend_ && laufSchluessel_ == k) laufend_ = false;
  }

  bool fristAbgelaufen(int64_t jetzt) const { return laufend_ && jetzt - start_ >= KACHEL_FRIST_MS; }

  /**
   * Die Frist des laufenden Auftrags ist um. Mit Profilbild: dieses Profilbild ist aufgegeben, der Auftrag weg (der
   * naechste kommt ohne Bild). Ohne Profilbild: dunkle Grundflaeche als Ergebnis, kein weiterer Auftrag.
   */
  void fristAblauf(int w, int h) {
    if (!laufend_) return;
    const KachelSchluessel k = laufSchluessel_;
    if (k.mitProfilbild) {
      aufgegebenStand_ = k.profilStand;   // der versuchte Stand, nicht ein inzwischen neuerer
      laufend_ = false;
    } else {
      fertig(k, grundflaeche(w, h));
    }
  }

  /** Darf der Fehler dieses Profilstands ins Protokoll? Hoechstens einmal je Profilstand. */
  bool fehlerMelden() {
    if (gemeldetStand_ == profilStand_) return false;
    gemeldetStand_ = profilStand_;
    return true;
  }

  Puffer puffer() const { return puffer_; }

  /** Der Puffer als Ueberbrueckung, solange der naechste gezeichnet wird: nur fuer dasselbe Ziel und dieselbe Groesse. */
  Puffer ueberbrueckung(unsigned ziel, int w, int h) const {
    if (puffer_ == nullptr || pufferSchluessel_.ziel != ziel || pufferSchluessel_.w != w || pufferSchluessel_.h != h)
      return nullptr;
    return puffer_;
  }

  /** Die dunkle Flaeche der Groesse w x h; bleibt, bis eine andere Groesse verlangt wird. Die Referenz gilt nur bis zum nächsten Aufruf mit anderer Größe bzw. bis leeren(). */
  const Puffer& grundflaeche(int w, int h) {
    if (grund_ == nullptr || grundW_ != w || grundH_ != h) {
      grund_ = std::make_shared<const std::vector<uint8_t>>(grundkachelI420(w, h));
      grundW_ = w;
      grundH_ = h;
    }
    return grund_;
  }

  /** Bytes der gehaltenen Bilder; Puffer und Grundflaeche zaehlen einmal, wenn sie dasselbe sind. */
  size_t speicherBytes() const {
    size_t n = 0;
    if (puffer_ != nullptr) n += puffer_->size();
    if (grund_ != nullptr && grund_ != puffer_) n += grund_->size();
    return n;
  }

  /** Zurueck in den Grundzustand (Slot geschlossen). */
  void leeren() {
    // Der Standzaehler laeuft weiter: ein spaetes Ergebnis eines Auftrags aus der Zeit vor leeren() darf nie zu
    // einem Schluessel nach dem Wiederoeffnen passen. Alles andere kommt in den Grundzustand; gemeldet und
    // aufgegeben wird auf den aktuellen Stand gesetzt bzw. geloescht, der naechste Stand versucht das Bild neu.
    const uint64_t stand = profilStand_;
    *this = KachelStand();
    profilStand_ = stand;
    gemeldetStand_ = stand;
  }

 private:
  unsigned profilZiel_ = 0;
  Profil profil_;
  uint64_t profilStand_ = 0;   // steigt nur, auch ueber leeren() hinweg (siehe dort)
  bool gelesen_ = false;       // gibt es seit dem Grundzustand ein gelesenes Profil?
  bool veraltet_ = false;
  unsigned nichtGefundenZiel_ = 0;   // profilNichtGefunden: für dieses Ziel …
  int64_t nichtGefundenBis_ = 0;     // … erst ab hier wieder fragen
  uint64_t aufgegebenStand_ = 0;
  uint64_t gemeldetStand_ = 0;
  bool laufend_ = false;
  KachelSchluessel laufSchluessel_;
  int64_t start_ = 0;
  Puffer puffer_;
  KachelSchluessel pufferSchluessel_;
  Puffer grund_;
  int grundW_ = 0, grundH_ = 0;
};

}  // namespace kachel
