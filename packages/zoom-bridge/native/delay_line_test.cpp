// Selbsttest fuer die Bild-Verzoegerung (delay_line.h) - OHNE Zoom, OHNE NDI,
// OHNE Uhr: jede Zeit wird eingespeist. Laeuft darum ueberall, wo der Bau
// laeuft, und in Millisekunden statt in einem Meeting.
//
//   npm run delay-test -w @jm/zoom-bridge
//
// Rueckgabewert 0 = alles gruen, 1 = mindestens eine Pruefung gefallen.
#include "delay_line.h"

#include <cstdio>
#include <vector>

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

using std::chrono::milliseconds;

DelayLine::TimePoint at(int ms) { return DelayLine::TimePoint{} + milliseconds(ms); }

// Ein winziges I420-Bild (4x2 = 8 Byte Y + 2x1 U + 2x1 V = 12 Byte). Das
// ERSTE Byte traegt eine Kennung, damit die Reihenfolge am Ausgang pruefbar
// ist, ohne Bilder zu vergleichen.
constexpr int kW = 4;
constexpr int kH = 2;
constexpr size_t kLen = kW * kH * 3 / 2;

std::vector<uint8_t> bild(uint8_t kennung) {
  std::vector<uint8_t> b(kLen, 0);
  b[0] = kennung;
  return b;
}

// Was am Ausgang ankam: Kennung je Bild, 0xFF fuer ein Schwarzbild.
struct Ausgang {
  std::vector<int> kennungen;
  void operator()(const DelayLine::Frame& f) {
    kennungen.push_back(f.black ? 0xFF : f.data.at(0));
  }
};

void pushBild(DelayLine& d, uint8_t kennung, int ms) {
  const auto b = bild(kennung);
  d.pushFrame(b.data(), b.size(), kW, kH, at(ms));
}

void test_nicht_vor_der_zeit() {
  std::printf("Ein Bild geht erst nach Ablauf des Versatzes raus\n");
  DelayLine d;
  pushBild(d, 1, 0);
  Ausgang a;
  auto r = d.release(at(499), milliseconds(500), a);
  CHECK(r.sent == 0);
  CHECK(a.kennungen.empty());
  CHECK(d.size() == 1);
  r = d.release(at(500), milliseconds(500), a);
  CHECK(r.sent == 1);
  CHECK(a.kennungen == std::vector<int>{1});
  CHECK(d.size() == 0);
}

void test_reihenfolge_mit_schwarzbild() {
  std::printf("Bild, Schwarz, Bild kommen in Ankunftsreihenfolge raus\n");
  DelayLine d;
  pushBild(d, 1, 0);
  d.pushBlack(kW, kH, at(10));
  pushBild(d, 2, 20);
  Ausgang a;
  const auto r = d.release(at(520), milliseconds(500), a);
  CHECK(r.sent == 3);
  CHECK(r.dropped == 0);
  CHECK((a.kennungen == std::vector<int>{1, 0xFF, 2}));
}

void test_schwarzbild_traegt_groesse() {
  std::printf("Ein Schwarzbild traegt seine Groesse und keine Bilddaten\n");
  DelayLine d;
  d.pushBlack(1280, 720, at(0));
  int w = 0, h = 0;
  bool schwarz = false;
  size_t len = 99;
  d.release(at(0), milliseconds(0), [&](const DelayLine::Frame& f) {
    w = f.w; h = f.h; schwarz = f.black; len = f.data.size();
  });
  CHECK(schwarz);
  CHECK(w == 1280);
  CHECK(h == 720);
  CHECK(len == 0);
}

void test_wertaenderung_wirkt_sofort() {
  std::printf("Ein geaenderter Versatz gilt auch fuer schon wartende Bilder\n");
  DelayLine d;
  pushBild(d, 1, 0);
  Ausgang a;
  auto r = d.release(at(100), milliseconds(500), a);
  CHECK(r.sent == 0);
  // Verkleinert: das Bild ist jetzt faellig, OHNE dass ein neues ankommen muss.
  r = d.release(at(100), milliseconds(50), a);
  CHECK(r.sent == 1);
  CHECK(a.kennungen == std::vector<int>{1});
}

void test_schwall_wird_verworfen() {
  std::printf("Mehr als kMaxBurst faellige Bilder: nur das juengste geht raus\n");
  DelayLine d;
  for (int i = 0; i < 10; ++i) pushBild(d, static_cast<uint8_t>(i + 1), i * 10);
  Ausgang a;
  const auto r = d.release(at(1000), milliseconds(0), a);
  CHECK(r.sent == 1);
  CHECK(r.dropped == 9);
  CHECK(a.kennungen == std::vector<int>{10});
  CHECK(d.size() == 0);
}

void test_schwall_grenze() {
  std::printf("Genau kMaxBurst faellige Bilder gehen ALLE raus\n");
  DelayLine d;
  for (int i = 0; i < static_cast<int>(DelayLine::kMaxBurst); ++i) {
    pushBild(d, static_cast<uint8_t>(i + 1), i * 10);
  }
  Ausgang a;
  const auto r = d.release(at(1000), milliseconds(0), a);
  CHECK(r.sent == static_cast<int>(DelayLine::kMaxBurst));
  CHECK(r.dropped == 0);
  CHECK((a.kennungen == std::vector<int>{1, 2, 3}));
}

void test_schwall_laesst_nicht_faellige_stehen() {
  std::printf("Die Schwall-Regel verwirft nur FAELLIGE Bilder, nie wartende\n");
  DelayLine d;
  for (int i = 0; i < 6; ++i) pushBild(d, static_cast<uint8_t>(i + 1), i * 10);
  pushBild(d, 42, 900);
  Ausgang a;
  const auto r = d.release(at(600), milliseconds(500), a);
  CHECK(r.sent == 1);
  CHECK(r.dropped == 5);
  CHECK(a.kennungen == std::vector<int>{6});
  CHECK(d.size() == 1);   // das Bild von 900 ms wartet weiter
}

void test_kopie_statt_verweis() {
  std::printf("Die Warteschlange kopiert - Zooms Puffer darf danach weg\n");
  DelayLine d;
  auto b = bild(7);
  d.pushFrame(b.data(), b.size(), kW, kH, at(0));
  b[0] = 99;   // Zoom ueberschreibt seinen Puffer mit dem naechsten Bild
  Ausgang a;
  d.release(at(0), milliseconds(0), a);
  CHECK(a.kennungen == std::vector<int>{7});
}

void test_obergrenze_verwirft_das_aelteste() {
  std::printf("Ueber kMaxQueue wird das AELTESTE verworfen, nicht das neue\n");
  DelayLine d;
  const int n = static_cast<int>(DelayLine::kMaxQueue) + 5;
  int verworfen = 0;
  for (int i = 0; i < n; ++i) {
    const auto b = bild(static_cast<uint8_t>(i % 250));
    verworfen += d.pushFrame(b.data(), b.size(), kW, kH, at(i));
  }
  CHECK(verworfen == 5);
  CHECK(d.size() == DelayLine::kMaxQueue);
  // Das erste verbliebene ist Nummer 5: die ersten fuenf sind weg. Einzeln
  // herausholen (Versatz so, dass genau eines faellig ist), damit die
  // Schwall-Regel nicht dazwischenfunkt.
  Ausgang a;
  d.release(at(5), milliseconds(0), a);
  CHECK(a.kennungen == std::vector<int>{5});
}

void test_puffer_werden_wiederverwendet() {
  std::printf("Ausgegebene und verworfene Puffer gehen in den Vorrat zurueck\n");
  DelayLine d;
  CHECK(d.spareBuffers() == 0);
  pushBild(d, 1, 0);
  pushBild(d, 2, 0);
  d.release(at(0), milliseconds(0), [](const DelayLine::Frame&) {});
  CHECK(d.spareBuffers() == 2);
  pushBild(d, 3, 10);   // nimmt einen aus dem Vorrat
  CHECK(d.spareBuffers() == 1);
}

void test_nachlauf_wartet_die_karenz_ab() {
  std::printf("Der Nachlauf gibt ein Bild erst aus, wenn es laenger als die Karenz ueberfaellig ist\n");
  // WARUM (Review 30.09.2026, dreifach gefunden): pump() lief in JEDEM Tick
  // der Hauptschleife und gab alles Faellige aus - der Tick (~15 ms) kam fast
  // immer vor dem naechsten Bild (~33 ms), und die Quelle lief im Raster der
  // Schleife statt in Zooms Takt. Der Nachlauf darf nur greifen, wenn das
  // naechste Bild ihn offensichtlich NICHT mehr anstoesst.
  DelayLine d;
  pushBild(d, 1, 0);
  Ausgang a;
  const int karenz = static_cast<int>(DelayLine::kNachlaufKarenz.count());
  auto r = d.releaseNachlauf(at(500 + karenz - 1), milliseconds(500), a);
  CHECK(r.sent == 0);
  CHECK(a.kennungen.empty());
  r = d.releaseNachlauf(at(500 + karenz), milliseconds(500), a);
  CHECK(r.sent == 1);
  CHECK(a.kennungen == std::vector<int>{1});
}

void test_karenz_laenger_als_ein_bildabstand() {
  std::printf("Die Karenz ist laenger als ein Bildabstand bei 30 Bildern je Sekunde\n");
  // Sonst gewaenne der Nachlauf im Normalbetrieb doch wieder gegen das
  // naechste Bild - genau der Fehler, den die Karenz abstellt.
  CHECK(DelayLine::kNachlaufKarenz.count() > 34);
}

void test_vorrat_ist_gedeckelt() {
  std::printf("Der Puffervorrat haelt hoechstens kMaxSpare Puffer\n");
  // WARUM (Review 30.09.2026): ohne Deckel blieb nach einem kurzen Ausflug auf
  // 1000 ms der Spitzenspeicher bis zum Abo-Ende belegt - bei 1080p rund 96 MB
  // je Quelle, auch nach dem Zurueckstellen auf 0.
  DelayLine d;
  for (int i = 0; i < 20; ++i) pushBild(d, static_cast<uint8_t>(i + 1), i);
  d.release(at(1000), milliseconds(0), [](const DelayLine::Frame&) {});
  CHECK(d.size() == 0);
  CHECK(d.spareBuffers() == DelayLine::kMaxSpare);
  CHECK(DelayLine::kMaxSpare >= 2);   // Gleichlauf braucht einen zum Nehmen und einen zum Zurueckgeben
}

void test_leeren() {
  std::printf("clear() leert Warteschlange UND Vorrat\n");
  DelayLine d;
  pushBild(d, 1, 0);
  pushBild(d, 2, 0);
  d.release(at(0), milliseconds(0), [](const DelayLine::Frame&) {});
  pushBild(d, 3, 0);
  d.clear();
  CHECK(d.size() == 0);
  CHECK(d.spareBuffers() == 0);
}

}  // namespace

int main() {
  test_nicht_vor_der_zeit();
  test_reihenfolge_mit_schwarzbild();
  test_schwarzbild_traegt_groesse();
  test_wertaenderung_wirkt_sofort();
  test_schwall_wird_verworfen();
  test_schwall_grenze();
  test_schwall_laesst_nicht_faellige_stehen();
  test_kopie_statt_verweis();
  test_obergrenze_verwirft_das_aelteste();
  test_puffer_werden_wiederverwendet();
  test_nachlauf_wartet_die_karenz_ab();
  test_karenz_laenger_als_ein_bildabstand();
  test_vorrat_ist_gedeckelt();
  test_leeren();
  std::printf("\n%d Pruefungen, %d gefallen.\n", g_run, g_fail);
  return g_fail == 0 ? 0 : 1;
}
