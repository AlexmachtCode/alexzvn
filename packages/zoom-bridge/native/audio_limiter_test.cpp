// Selbsttest des Ton-Limiters (audio_limiter.h, Entwurf 2026-11-14) - OHNE Zoom, OHNE NDI, OHNE Uhr.
//
//   npm run logik-test -w @jm/zoom-bridge     (Compiler direkt, auch CI)
//   npm run slot-test -w @jm/zoom-bridge      (lokal ueber CMake)
//
// Aufbau wie audio_mix_test.cpp: Makro CHECK, je Fall eine Funktion mit gedrucktem Titel. Alle Faelle bauen den
// Limiter mit -6.0 dBFS, nie mit dem Vorgabewert: so bricht eine spaetere Aenderung der Grenze keinen Test.
// Rueckgabewert 0 = alles gruen, 1 = mindestens eine Pruefung gefallen.
#include "audio_limiter.h"

#include <cstdio>
#include <cstdlib>
#include <string>
#include <vector>

namespace {

using namespace slotlogic;

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

/** n Werte mit festem Wert (mono). */
std::vector<int16_t> ton(size_t n, int16_t wert) { return std::vector<int16_t>(n, wert); }

void l1_grenze() {
  std::printf("l1_grenze\n");
  CHECK(TonLimiter(-6.0).grenze() == 16422);
}

void l2_bitgenau_unter_grenze() {
  std::printf("l2_bitgenau_unter_grenze\n");
  TonLimiter lim(-6.0);
  std::vector<int16_t> eingabe(320);
  for (size_t i = 0; i < eingabe.size(); ++i) eingabe[i] = (i % 2 == 0) ? int16_t{16000} : int16_t{-16000};
  std::vector<int16_t> ausgabe = eingabe;
  lim.verarbeite(ausgabe.data(), 320, 32000, 1);
  for (size_t i = 0; i < eingabe.size(); ++i) CHECK(ausgabe[i] == eingabe[i]);
  CHECK(lim.absenkungDb() == 0.0);
}

void l3_nie_ueber_grenze() {
  std::printf("l3_nie_ueber_grenze\n");
  TonLimiter lim(-6.0);
  const int16_t muster[5] = {32767, -32768, 20000, -20000, 16423};
  std::vector<int16_t> w(320);
  for (size_t i = 0; i < w.size(); ++i) w[i] = muster[i % 5];
  lim.verarbeite(w.data(), 320, 32000, 1);
  for (int16_t v : w) CHECK(std::abs(static_cast<int>(v)) <= 16422);
  CHECK(w[0] >= 16000);
}

void l4_rueckkehr_150ms() {
  std::printf("l4_rueckkehr_150ms\n");
  TonLimiter lim(-6.0);
  std::vector<int16_t> spitze = ton(320, 32767);
  lim.verarbeite(spitze.data(), 320, 32000, 1);
  std::vector<int16_t> leise;
  for (int p = 0; p < 20; ++p) {
    std::vector<int16_t> paket = ton(320, 1000);
    lim.verarbeite(paket.data(), 320, 32000, 1);
    leise.insert(leise.end(), paket.begin(), paket.end());
  }
  CHECK(leise[1599] > 0 && leise[1599] < 1000);   // nach 50 ms noch abgesenkt
  for (size_t i = 4900; i < leise.size(); ++i) CHECK(leise[i] == 1000);   // nach 150 ms wieder exakt 1
  CHECK(lim.absenkungDb() == 0.0);
}

void l5_stereo_gemeinsam() {
  std::printf("l5_stereo_gemeinsam\n");
  TonLimiter lim(-6.0);
  std::vector<int16_t> w(320);
  for (size_t i = 0; i < 160; ++i) {
    w[2 * i] = 32767;
    w[2 * i + 1] = 100;
  }
  lim.verarbeite(w.data(), 160, 32000, 2);
  for (size_t i = 0; i < 160; ++i) {
    CHECK(std::abs(static_cast<int>(w[2 * i])) <= 16422);
    CHECK(w[2 * i + 1] == 50);
  }
}

void l6_formatwechsel() {
  std::printf("l6_formatwechsel\n");
  TonLimiter lim(-6.0);
  std::vector<int16_t> a = ton(320, 32767);
  lim.verarbeite(a.data(), 320, 32000, 1);
  std::vector<int16_t> b = ton(480, 1000);
  lim.verarbeite(b.data(), 480, 48000, 1);
  for (int16_t v : b) CHECK(v == 1000);
}

void l7_messung() {
  std::printf("l7_messung\n");
  TonLimiter lim(-6.0);
  std::vector<int16_t> w = ton(320, 0);
  w[0] = 32767;
  w[1] = -32768;
  lim.verarbeite(w.data(), 320, 32000, 1);
  PegelFenster f = lim.abholen();
  CHECK(f.spitze == 32768);
  CHECK(f.vollausschlag == 2);
  CHECK(f.werte == 320);
  CHECK(f.pakete == 1);
  CHECK(f.paketeMitEingriff == 1);
  CHECK(f.summeQuadrate == 32767.0 * 32767.0 + 32768.0 * 32768.0);
  CHECK(f.staerksteAbsenkungDb > 5.9 && f.staerksteAbsenkungDb < 6.1);
  PegelFenster g = lim.abholen();
  CHECK(g.pakete == 0 && g.spitze == 0 && g.werte == 0);
}

void l8_messung_vor_dem_limiter() {
  std::printf("l8_messung_vor_dem_limiter\n");
  TonLimiter lim(-6.0);
  std::vector<int16_t> w = ton(320, 32767);
  lim.verarbeite(w.data(), 320, 32000, 1);
  CHECK(lim.abholen().spitze == 32767);   // nicht <= 16422
}

void l9_slots_unabhaengig() {
  std::printf("l9_slots_unabhaengig\n");
  TonLimiter lim1(-6.0);
  TonLimiter lim2(-6.0);
  std::vector<int16_t> a = ton(320, 32767);
  lim1.verarbeite(a.data(), 320, 32000, 1);
  std::vector<int16_t> b = ton(320, 1000);
  lim2.verarbeite(b.data(), 320, 32000, 1);
  for (int16_t v : b) CHECK(v == 1000);
}

/** Fenster wie in p1: Spitze 8192 (-12 dBFS), Mittel -12 dBFS, 100 Pakete ohne Eingriff. */
PegelFenster normalesFenster() {
  PegelFenster f;
  f.spitze = 8192;
  f.werte = 32000;
  f.summeQuadrate = 8192.0 * 8192.0 * 32000.0;
  f.pakete = 100;
  return f;
}

void p1_normal() {
  std::printf("p1_normal\n");
  CHECK(pegelZeile(4, false, normalesFenster()) ==
        L"Ton-Pegel Slot 4 [Dauerbetrieb]: Spitze -12,0 dBFS, Mittel -12,0 dBFS, "
        L"Vollausschlag 0 Abtastwerte, Limiter griff in 0 von 100 Paketen ein, staerkste Absenkung 0,0 dB.");
}

void p2_anlauf() {
  std::printf("p2_anlauf\n");
  const std::wstring z = pegelZeile(4, true, normalesFenster());
  const std::wstring anfang = L"Ton-Pegel Slot 4 [ANLAUF]: Spitze -12,0 dBFS";
  CHECK(z.compare(0, anfang.size(), anfang) == 0);
}

void p3_eingriff() {
  std::printf("p3_eingriff\n");
  PegelFenster f;
  f.spitze = 32768;
  f.werte = 1000;
  f.summeQuadrate = 1000.0 * 3276.8 * 3276.8;
  f.vollausschlag = 2;
  f.pakete = 1000;
  f.paketeMitEingriff = 1;
  f.staerksteAbsenkungDb = 6.0012;
  CHECK(pegelZeile(1, false, f) ==
        L"Ton-Pegel Slot 1 [Dauerbetrieb]: Spitze 0,0 dBFS, Mittel -20,0 dBFS, "
        L"Vollausschlag 2 Abtastwerte, Limiter griff in 1 von 1000 Paketen ein, staerkste Absenkung 6,0 dB.");
}

void p4_keine_minus_null() {
  std::printf("p4_keine_minus_null\n");
  PegelFenster f = normalesFenster();
  f.spitze = 32767;   // -0,0003 dBFS
  CHECK(pegelZeile(4, false, f).find(L"Spitze 0,0 dBFS") != std::wstring::npos);
}

void p5_stille() {
  std::printf("p5_stille\n");
  PegelFenster f;
  f.pakete = 50;
  CHECK(pegelZeile(2, false, f) == L"Ton-Pegel Slot 2 [Dauerbetrieb]: Stille (alle Abtastwerte 0) in 50 Paketen.");
}

void p6_leer() {
  std::printf("p6_leer\n");
  CHECK(pegelZeile(3, false, PegelFenster{}).empty());
}

// ── ENDE DER FALLFUNKTIONEN (neue Funktionen direkt darüber einfügen) ──
}  // namespace

int main() {
  l1_grenze();
  l2_bitgenau_unter_grenze();
  l3_nie_ueber_grenze();
  l4_rueckkehr_150ms();
  l5_stereo_gemeinsam();
  l6_formatwechsel();
  l7_messung();
  l8_messung_vor_dem_limiter();
  l9_slots_unabhaengig();
  p1_normal();
  p2_anlauf();
  p3_eingriff();
  p4_keine_minus_null();
  p5_stille();
  p6_leer();
// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
  std::printf("\n%d Pruefungen, %d gefallen.\n", g_run, g_fail);
  return g_fail == 0 ? 0 : 1;
}
