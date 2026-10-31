// Selbsttest des Mischers (audio_mix.h, Spec 6.13, 11.1 PB17/PB28) - OHNE Zoom, OHNE NDI, OHNE Uhr.
//
//   npm run logik-test -w @jm/zoom-bridge     (Compiler direkt, auch CI)
//   npm run slot-test -w @jm/zoom-bridge      (lokal ueber CMake)
//
// Aufbau wie delay_line_test.cpp: Makro CHECK, eingespeiste Zeit at(ms), je Fall eine Funktion mit gedrucktem
// Titel. Rueckgabewert 0 = alles gruen, 1 = mindestens eine Pruefung gefallen.
#include "audio_mix.h"

#include <cstdio>
#include <functional>
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

int64_t at(int ms) { return static_cast<int64_t>(ms); }

/** ms Millisekunden Ton mit festem Wert (mono). */
std::vector<int16_t> ton(int rate, int ms, int16_t wert) {
  return std::vector<int16_t>(static_cast<size_t>(rate / 1000 * ms), wert);
}

void a(AudioMix& m, const std::vector<int16_t>& t, int rate, int zeit) {
  m.eingangA(t.data(), static_cast<int>(t.size()), rate, 1, at(zeit));
}
void b(AudioMix& m, const std::vector<int16_t>& t, int rate, int zeit) {
  m.eingangB(t.data(), static_cast<int>(t.size()), rate, 1, at(zeit));
}

bool alleGleich(const std::vector<int16_t>& v, int16_t wert) {
  for (int16_t x : v) {
    if (x != wert) return false;
  }
  return !v.empty();
}

void pb17_summe_begrenzung_raten() {
  std::printf("PB17 Mischer: gleiche Laenge summiert; ueber 32767 begrenzt; 32 000 und 48 000 -> nur Computerton\n");
  AudioMix m;
  a(m, ton(32000, 40, 1000), 32000, 0);
  b(m, ton(32000, 40, 2000), 32000, 0);
  CHECK(m.laeuft() && !m.rateMismatch());
  std::vector<int16_t> out;
  CHECK(m.ausgabe(at(40), out) == 1280);
  CHECK(out.size() == 1280 && alleGleich(out, 3000));
  CHECK(m.rate() == 32000 && m.kanaele() == 1);
  AudioMix laut;
  a(laut, ton(32000, 40, 30000), 32000, 0);
  b(laut, ton(32000, 20, 10000), 32000, 0);
  b(laut, ton(32000, 20, -10000), 32000, 0);
  laut.ausgabe(at(40), out);
  CHECK(out.size() == 1280 && out[0] == 32767 && out[1279] == 20000);
  AudioMix leise;
  a(leise, ton(32000, 40, -30000), 32000, 0);
  b(leise, ton(32000, 40, -10000), 32000, 0);
  leise.ausgabe(at(40), out);
  CHECK(alleGleich(out, -32768));
  AudioMix raten;
  a(raten, ton(32000, 40, 1000), 32000, 0);
  b(raten, ton(48000, 40, 2000), 48000, 0);
  CHECK(raten.rateMismatch());
  CHECK(raten.ausgabe(at(40), out) == 1920);
  CHECK(alleGleich(out, 2000) && raten.rate() == 48000);
}

/**
 * Faehrt den Mischer 10 s: alle 10 ms je ein 10-ms-Paket, wenn liefertA/liefertB(t) es sagen; Herzschlag in
 * wechselndem Abstand (10, 15, 16 ms). Prueft nach jeder Ausgabe: gesendete Zeit = Wanduhr seit dem Beginn +- 10 ms,
 * Rueckstand nie ueber 200 ms.
 */
struct Lauf {
  bool wanduhr = true;
  bool rueckstand = true;
  int64_t gesendetMs = 0;
};
Lauf fahre(AudioMix& m, const std::function<bool(int)>& liefertA, const std::function<bool(int)>& liefertB, int faktorA = 1) {
  Lauf l;
  int64_t gesendet = 0;
  int64_t beginn = -1;
  int naechsterTakt = 0;
  const int abstaende[3] = {10, 15, 16};
  int i = 0;
  std::vector<int16_t> out;
  const std::vector<int16_t> paket = ton(32000, 10, 100);
  for (int t = 0; t <= 10000; ++t) {
    if (t % 10 == 0) {
      for (int k = 0; k < faktorA; ++k) {
        if (liefertA(t)) a(m, paket, 32000, t);
      }
      if (liefertB(t)) b(m, paket, 32000, t);
    }
    if (beginn < 0 && m.laeuft()) beginn = t;
    if (t == naechsterTakt) {
      gesendet += m.ausgabe(at(t), out);
      naechsterTakt += abstaende[i++ % 3];
      if (beginn >= 0) {
        const int64_t wand = t - beginn;
        const int64_t ms = gesendet * 1000 / 32000;
        if (ms > wand || wand - ms >= 10) l.wanduhr = false;
      }
      if (m.rueckstandMs() > 200) l.rueckstand = false;
    }
  }
  l.gesendetMs = gesendet * 1000 / 32000;
  return l;
}

void pb28_wanduhr() {
  std::printf("PB28 Mischer-Uhr: ueber 10 s bei Luecken 30/60/100 ms, stillem Eingang und beiden still = Wanduhr +- 10 ms\n");
  const int luecken[3] = {30, 60, 100};
  for (int luecke : luecken) {
    AudioMix m;
    const Lauf l = fahre(m, [](int) { return true; }, [luecke](int t) { return t % 500 >= luecke; });
    CHECK(l.wanduhr && l.rueckstand);
    CHECK(m.mixSilenceMs() > 0 && m.mixDropsMs() == 0);
  }
  AudioMix stillB;
  Lauf l = fahre(stillB, [](int) { return true; }, [](int) { return false; });
  CHECK(l.wanduhr && l.rueckstand && stillB.mixSilenceMs() >= 9900);
  AudioMix beide;
  l = fahre(beide, [](int t) { return t < 2000; }, [](int t) { return t < 2000; });
  CHECK(l.wanduhr && l.rueckstand && l.gesendetMs >= 9900);
  AudioMix zuViel;   // Mischton kommt doppelt so schnell: Rueckstand wird am aeltesten Ende verworfen
  l = fahre(zuViel, [](int) { return true; }, [](int) { return true; }, 2);
  CHECK(l.wanduhr && l.rueckstand && zuViel.mixDropsMs() > 0);
  AudioMix nie;
  l = fahre(nie, [](int) { return false; }, [](int) { return false; });
  CHECK(l.gesendetMs == 0 && !nie.laeuft());
}

void a8_eingang_b_neu() {
  std::printf("A8 MischerEingangBNeu: nur Eingang B beginnt leer und ohne Format, Uhr und Eingang A bleiben\n");
  AudioMix m;
  a(m, ton(32000, 40, 1000), 32000, 0);
  b(m, ton(48000, 40, 2000), 48000, 0);
  CHECK(m.rateMismatch());
  m.eingangBNeu();
  CHECK(!m.rateMismatch() && m.laeuft() && m.rate() == 32000);
  std::vector<int16_t> out;
  CHECK(m.ausgabe(at(40), out) == 1280 && alleGleich(out, 1000));
}

void n1_luecke_gekappt() {
  std::printf("N1.1 Mischer nach 60 s Luecke: hoechstens 200 ms je Aufruf, Rest in mixDropsMs, danach 10-ms-Takt\n");
  AudioMix m;
  a(m, ton(32000, 40, 1000), 32000, 0);
  b(m, ton(32000, 40, 2000), 32000, 0);
  std::vector<int16_t> out;
  CHECK(m.ausgabe(at(40), out) == 1280 && m.mixDropsMs() == 0);   // Normalbetrieb: genau die verstrichene Zeit
  const int64_t stilleVorher = m.mixSilenceMs();
  CHECK(m.ausgabe(at(60040), out) == 6400);                       // 60 s Luecke: hoechstens 200 ms (32 kHz mono)
  CHECK(out.size() == 6400);
  CHECK(m.mixDropsMs() == 59800);                                 // 60 000 ms verstrichen, 200 ms ausgegeben
  CHECK(m.mixSilenceMs() - stilleVorher <= 400);                  // Stille nur fuer die ausgegebenen 200 ms je Eingang
  a(m, ton(32000, 10, 1000), 32000, 60040);
  b(m, ton(32000, 10, 2000), 32000, 60040);
  CHECK(m.ausgabe(at(60050), out) == 320 && alleGleich(out, 3000));   // danach wieder der 10-ms-Takt
  CHECK(m.mixDropsMs() == 59800);
  AudioMix grenze;   // genau 200 ms verstrichen: noch Normalbetrieb, nichts verworfen
  a(grenze, ton(32000, 40, 1000), 32000, 0);
  CHECK(grenze.ausgabe(at(200), out) == 6400 && grenze.mixDropsMs() == 0);
}

// ── ENDE DER FALLFUNKTIONEN (neue Funktionen direkt darüber einfügen) ──
}  // namespace

int main() {
  pb17_summe_begrenzung_raten();
  pb28_wanduhr();
  a8_eingang_b_neu();
  n1_luecke_gekappt();
// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
  std::printf("\n%d Pruefungen, %d gefallen.\n", g_run, g_fail);
  return g_fail == 0 ? 0 : 1;
}
