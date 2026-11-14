// Selbsttest fuer die Inhalte der Zoom-Kachel (kachel_logik.h, #306) - OHNE Zoom, OHNE NDI, OHNE Uhr, OHNE
// Zeichnen: Initialen, Farbe, Kuerzung, Masse, Profilbild-Pruefung und I420-Umrechnung sind reine Funktionen.
//
//   npm run logik-test -w @jm/zoom-bridge
//
// Rueckgabewert 0 = alles gruen, 1 = mindestens eine Pruefung gefallen.
#include "kachel_logik.h"

#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <iterator>
#include <string>
#include <vector>

using namespace kachel;

namespace {

int g_run = 0;
int g_fail = 0;

#define CHECK(cond)                                                          \
  do {                                                                       \
    ++g_run;                                                                 \
    if (!(cond)) {                                                           \
      ++g_fail;                                                              \
      std::printf("  FEHLER %s:%d: %s\n", __FILE__, __LINE__, #cond);        \
    }                                                                        \
  } while (0)

std::vector<uint32_t> cp(const std::u16string& s) { return utf16Dekodieren(s); }
std::u16string ini(const std::u16string& s) { return utf16Kodieren(initialen(cp(s))); }
std::vector<uint8_t> einfarbig(uint32_t rgb, int w, int h) {   // BGRA, deckend, stride 4*w
  std::vector<uint8_t> b(static_cast<size_t>(w) * h * 4);
  for (size_t i = 0; i < b.size(); i += 4) {
    b[i] = static_cast<uint8_t>(rgb & 0xFF); b[i + 1] = static_cast<uint8_t>((rgb >> 8) & 0xFF);
    b[i + 2] = static_cast<uint8_t>(rgb >> 16); b[i + 3] = 255;
  }
  return b;
}

// Leuchtdichte nach WCAG 2.x (sRGB).
double leuchtdichte(uint32_t rgb) {
  double l = 0;
  const double gewicht[3] = {0.2126, 0.7152, 0.0722};
  for (int k = 0; k < 3; ++k) {
    const double c = ((rgb >> (16 - 8 * k)) & 0xFF) / 255.0;
    l += gewicht[k] * (c <= 0.03928 ? c / 12.92 : std::pow((c + 0.055) / 1.055, 2.4));
  }
  return l;
}
// kontrast(a, b) nach WCAG 2.x: (L_hell + 0.05) / (L_dunkel + 0.05).
double kontrast(uint32_t a, uint32_t b) {
  const double la = leuchtdichte(a), lb = leuchtdichte(b);
  return (std::fmax(la, lb) + 0.05) / (std::fmin(la, lb) + 0.05);
}
// abweichung(bgr, rgb): groesste Differenz eines Kanals zu rgb ueber alle Bildpunkte eines BGR-Puffers.
int abweichung(const std::vector<uint8_t>& bgr, uint32_t rgb) {
  const int soll[3] = {static_cast<int>(rgb & 0xFF), static_cast<int>((rgb >> 8) & 0xFF), static_cast<int>(rgb >> 16)};
  int m = 0;
  for (size_t i = 0; i < bgr.size(); ++i) {
    const int d = std::abs(static_cast<int>(bgr[i]) - soll[i % 3]);
    if (d > m) m = d;
  }
  return m;
}

void t_utf16() {
  CHECK(cp(u"Anna") == (std::vector<uint32_t>{'A', 'n', 'n', 'a'}));
  CHECK(cp(u"\U0001F3A4") == std::vector<uint32_t>{0x1F3A4});
  CHECK(cp(std::u16string{char16_t(0xD800), u'A'}) == (std::vector<uint32_t>{0xFFFD, 'A'}));
  CHECK(utf16Kodieren({0x1F3A4, 'A'}) == u"\U0001F3A4A");
}
void t_initialen() {
  CHECK(ini(u"Anna Müller") == u"AM");               CHECK(ini(u"anna") == u"A");
  CHECK(ini(u"  Anna   Maria   Müller  ") == u"AM"); CHECK(ini(u"ömer öztürk") == u"ÖÖ");
  CHECK(ini(u"(Gast) Ben") == u"GB");                CHECK(ini(u"\U0001F3A4 Anna") == u"A");
  CHECK(ini(u"Анна Петрова") == u"АП");              CHECK(ini(u"张伟") == u"张");
  CHECK(ini(u"jean-luc picard") == u"JP");           CHECK(ini(u"O\u0308mer") == u"O\u0308");
  CHECK(ini(u"łukasz ćwik") == u"ŁĆ");               CHECK(ini(u"ÿves") == u"\u0178");
  CHECK(ini(u"ς") == u"Σ");                          CHECK(ini(u"ά") == u"\u0386");
  CHECK(ini(u"") == u"");  CHECK(ini(u" \u00A0\u3000") == u"");  CHECK(ini(u"\U0001F3A4\U0001F3AC") == u"");
}
void t_farbe() {
  CHECK(fnv1a32(cp(u"Ben")) == 4128311196u);   CHECK(fnv1a32(cp(u"")) == 2166136261u);
  CHECK(farbIndex(cp(u"Anna Müller")) == 3);   CHECK(farbIndex(cp(u"  Anna Müller ")) == 3);
  CHECK(farbIndex(cp(u"Carla")) == 0);
  for (const uint32_t f : PALETTE) CHECK(kontrast(f, 0xFFFFFF) >= 4.5 && kontrast(f, HINTERGRUND) >= 2.0);
}
void t_kuerzen() {
  const Breite b10 = [](const std::vector<uint32_t>& t) {   // 10 px je Code-Punkt, Kombinationszeichen 0 px
    int n = 0;
    for (const uint32_t c : t) n += (c >= 0x0300 && c <= 0x036F) ? 0 : 10;
    return n;
  };
  const Breite alle10 = [](const std::vector<uint32_t>& t) { return static_cast<int>(t.size()) * 10; };
  CHECK(kuerzen(cp(u"Anna"), 100, b10) == cp(u"Anna"));
  CHECK(kuerzen(cp(u"Abcdefghij"), 100, b10) == cp(u"Abcdefghij"));      // genau 100 passt
  CHECK(kuerzen(cp(u"Abcdefghijk"), 100, b10) == cp(u"Abcdefghi…"));
  CHECK(kuerzen(cp(u"Abcdefgh jk"), 100, b10) == cp(u"Abcdefgh…"));      // Leerraum vor „…“ faellt weg
  CHECK(kuerzen(cp(u"Abcdefghe\u0301zz"), 100, b10) == cp(u"Abcdefghe\u0301…"));
  CHECK(kuerzen(cp(u"Abcdefghe\u0301z"), 100, alle10) == cp(u"Abcdefgh…"));   // nie vor einem Kombinationszeichen
  CHECK(kuerzen(cp(u"Abcdefgh\U0001F469\u200D\U0001F4BB"), 100, alle10) == cp(u"Abcdefgh…"));   // ZWJ-Folge ganz
  CHECK(kuerzen(cp(u"Anna"), 5, b10) == cp(u"…"));
  CHECK(kuerzen(cp(u""), 100, b10).empty());
}
void t_masse() {
  const KachelMasse m = masse(1280, 720);
  CHECK(m.durchmesser == 288 && m.mitteX == 640 && m.mitteY == 324 && m.initialenPx == 115 && m.hinweisPx == 32);
  CHECK(m.hinweisOben == 497 && m.rand == 18 && m.namePx == 36 && m.schildHoehe == 58 && m.schildY == 644);
  CHECK(m.textAbstand == 14 && m.maxTextBreite == 1216);
  const KachelMasse g = masse(1920, 1080);
  CHECK(g.durchmesser == 432 && g.mitteY == 486 && g.initialenPx == 173 && g.hinweisOben == 745 && g.schildY == 967 && g.maxTextBreite == 1822);
  const KachelMasse k = masse(640, 360);
  CHECK(k.durchmesser == 144 && k.mitteY == 162 && k.initialenPx == 58 && k.hinweisOben == 248 && k.schildY == 322 && k.maxTextBreite == 608);
}
void t_masse_invarianten() {
  const int groessen[6][2] = {{640, 360}, {1280, 720}, {1920, 1080}, {360, 640}, {640, 480}, {320, 180}};
  for (const auto& g : groessen) {
    const KachelMasse m = masse(g[0], g[1]);
    CHECK(m.mitteX - m.durchmesser / 2 >= 0 && m.mitteX + m.durchmesser / 2 <= g[0]);
    CHECK(m.mitteY - m.durchmesser / 2 >= 0 && m.hinweisOben + m.hinweisPx * 3 / 2 <= m.schildY);
    CHECK(m.schildY >= m.rand && m.maxTextBreite > 0);
  }
}
void t_profilbild() {
  CHECK(profilbildPruefen(PROFILBILD_MAX_BYTES, 100, 100) == ProfilbildFehler::Keiner);
  CHECK(profilbildPruefen(PROFILBILD_MAX_BYTES + 1, 100, 100) == ProfilbildFehler::ZuGross);
  CHECK(profilbildPruefen(1000, 0, 10) == ProfilbildFehler::Unlesbar);
  CHECK(profilbildPruefen(1000, 4096, 4096) == ProfilbildFehler::Keiner);
  CHECK(profilbildPruefen(1000, 4097, 10) == ProfilbildFehler::ZuGross);
  const Ausschnitt a = quadratAusschnitt(640, 480), b = quadratAusschnitt(300, 500), c = quadratAusschnitt(7, 4);
  CHECK(a.x == 80 && a.y == 0 && a.seite == 480);
  CHECK(b.x == 0 && b.y == 100 && b.seite == 300);
  CHECK(c.x == 1 && c.y == 0 && c.seite == 4);
}
void t_fehlername() {
  CHECK(std::string(fehlerName(ProfilbildFehler::Keiner)) == "keiner");
  CHECK(std::string(fehlerName(ProfilbildFehler::KeinPfad)) == "keinPfad");
  CHECK(std::string(fehlerName(ProfilbildFehler::Fehlt)) == "fehlt");
  CHECK(std::string(fehlerName(ProfilbildFehler::ZuGross)) == "zuGross");
  CHECK(std::string(fehlerName(ProfilbildFehler::Unlesbar)) == "unlesbar");
  CHECK(std::string(fehlerName(ProfilbildFehler::Frist)) == "frist");
}
void t_i420() {
  CHECK(i420Bytes(1280, 720) == 1382400u && i420Bytes(4, 2) == 12u);
  const auto yuv = [](uint32_t rgb) { const auto b = einfarbig(rgb, 4, 2); return bgraZuI420(b.data(), 4, 2, 16); };
  CHECK(yuv(0x232323) == (std::vector<uint8_t>{46, 46, 46, 46, 46, 46, 46, 46, 128, 128, 128, 128}));
  CHECK(yuv(0xFF0000)[0] == 82 && yuv(0xFF0000)[8] == 90 && yuv(0xFF0000)[10] == 240);
  CHECK(yuv(0xFFFFFF)[0] == 235 && yuv(0x000000)[0] == 16 && yuv(0x000000)[8] == 128);
  const uint8_t misch[16] = {0, 0, 255, 255, 255, 0, 0, 255, 255, 0, 0, 255, 0, 0, 255, 255};   // BGRA: Rot, Blau / Blau, Rot
  const auto m = bgraZuI420(misch, 2, 2, 8);
  CHECK(m.size() == 6 && m[4] == 165 && m[5] == 175);     // U/V aus dem gerundeten Mittel (R 128, G 0, B 128)
  CHECK(grundkachelI420(4, 2) == yuv(HINTERGRUND));
  std::vector<uint32_t> farben(std::begin(PALETTE), std::end(PALETTE));
  farben.push_back(HINTERGRUND);
  farben.push_back(0xFFFFFF);
  for (const uint32_t f : farben) {                         // Rundreise, gemessen: hoechstens 1 je Kanal
    std::vector<uint8_t> bgr;
    const auto y = yuv(f);
    i420ZuBgr(y.data(), 4, 2, &bgr);
    CHECK(bgr.size() == 24 && abweichung(bgr, f) <= 2);   // abweichung: groesste Kanaldifferenz ueber alle Bildpunkte
  }
}

}  // namespace

int main() {
  t_utf16();
  t_initialen();
  t_farbe();
  t_kuerzen();
  t_masse();
  t_masse_invarianten();
  t_profilbild();
  t_fehlername();
  t_i420();
  std::printf("\n%d Pruefungen, %d gefallen.\n", g_run, g_fail);
  return g_fail == 0 ? 0 : 1;
}
