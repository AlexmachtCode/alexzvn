// Selbsttest fuer die Bild-Verzoegerung (delay_line.h) - OHNE Zoom, OHNE NDI,
// OHNE Uhr: jede Zeit wird eingespeist. Laeuft darum ueberall, wo der Bau
// laeuft, und in Millisekunden statt in einem Meeting.
//
//   npm run delay-test -w @jm/zoom-bridge
//
// Rueckgabewert 0 = alles gruen, 1 = mindestens eine Pruefung gefallen.
#include "delay_line.h"

#include <cstdio>
#include <memory>
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

// Was am Ausgang ankam: Kennung je Bild, 0xFF fuer ein Schwarzbild, 0xEE fuer eine Kachel.
struct Ausgang {
  std::vector<int> kennungen;
  void operator()(const DelayLine::Frame& f) {
    if (f.art == Bildart::Kachel) kennungen.push_back(0xEE);
    else kennungen.push_back(f.art == Bildart::Schwarz ? 0xFF : f.data.at(0));
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
  d.pushBild(Bildart::Schwarz, kW, kH, at(10));
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
  d.pushBild(Bildart::Schwarz, 1280, 720, at(0));
  int w = 0, h = 0;
  bool schwarz = false;
  size_t len = 99;
  d.release(at(0), milliseconds(0), [&](const DelayLine::Frame& f) {
    w = f.w; h = f.h; schwarz = f.art == Bildart::Schwarz; len = f.data.size();
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

void test_bildarten_pb18() {
  std::printf("PB18 Bildarten weiss und transparent behalten Reihenfolge und Art; clear() beim Moduswechsel leert\n");
  DelayLine d;
  pushBild(d, 1, 0);
  CHECK(d.pushBild(Bildart::Weiss, kW, kH, at(10)) == 0);
  CHECK(d.pushBild(Bildart::Transparent, kW, kH, at(20)) == 0);
  pushBild(d, 2, 30);
  d.pushBild(Bildart::Schwarz, kW, kH, at(40));
  CHECK(d.pushBild(Bildart::I420, kW, kH, at(50)) == 0);   // I420 nur mit Bilddaten (pushFrame)
  CHECK(d.size() == 5);
  std::vector<Bildart> arten;
  std::vector<int> kennungen;
  const auto senke = [&](const DelayLine::Frame& f) {
    arten.push_back(f.art);
    kennungen.push_back(!f.data.empty() ? f.data[0] : (f.art == Bildart::Schwarz ? 0xFF : 0));
  };
  // Einzeln faellig machen (hoechstens kMaxBurst je release), damit die Schwall-Regel nicht dazwischenfunkt.
  d.release(at(510), milliseconds(500), senke);
  d.release(at(530), milliseconds(500), senke);
  d.release(at(540), milliseconds(500), senke);
  CHECK((arten == std::vector<Bildart>{Bildart::I420, Bildart::Weiss, Bildart::Transparent, Bildart::I420, Bildart::Schwarz}));
  CHECK((kennungen == std::vector<int>{1, 0, 0, 2, 0xFF}));
  d.pushBild(Bildart::Weiss, 1280, 720, at(600));
  d.pushBild(Bildart::Transparent, 1280, 720, at(610));
  d.clear();
  CHECK(d.size() == 0);
}

}  // namespace

void test_kachel_verweis_306() {
  std::printf("#306 Bildart Kachel: Verweis statt Kopie, Reihenfolge bleibt, kein Puffer bleibt haengen\n");
  DelayLine d;
  const auto p = std::make_shared<const std::vector<uint8_t>>(kLen, uint8_t{46});
  pushBild(d, 1, 0);
  CHECK(d.pushKachel(p, kW, kH, at(10)) == 0);
  pushBild(d, 2, 20);
  CHECK(d.pushKachel(nullptr, kW, kH, at(30)) == 0);
  CHECK(d.pushKachel(std::make_shared<const std::vector<uint8_t>>(kLen - 1), kW, kH, at(31)) == 0);
  CHECK(d.size() == 3);
  CHECK(p.use_count() == 2);                      // genau ein Verweis in der Warteschlange
  std::vector<Bildart> arten;
  bool verweis = false;
  const auto senke = [&](const DelayLine::Frame& f) {
    arten.push_back(f.art);
    if (f.art == Bildart::Kachel) verweis = f.kachel.get() == p.get() && f.data.empty();
  };
  d.release(at(510), milliseconds(500), senke);
  d.release(at(520), milliseconds(500), senke);
  d.release(at(530), milliseconds(500), senke);
  CHECK((arten == std::vector<Bildart>{Bildart::I420, Bildart::Kachel, Bildart::I420}));
  CHECK(verweis);
  CHECK(p.use_count() == 1);                      // weder Warteschlange noch Vorrat halten ihn
  for (int i = 0; i < 5; ++i) d.pushKachel(p, kW, kH, at(600 + i));
  Ausgang a;
  CHECK(d.release(at(1200), milliseconds(500), a).dropped == 4);   // Schwall-Regel wie bei Bildern
  CHECK(p.use_count() == 1);
  d.pushKachel(p, kW, kH, at(1300));
  d.clear();
  CHECK(p.use_count() == 1 && d.size() == 0);
}

void test_kachel_nur_ueber_pushkachel_306() {
  std::printf("#306 Bildart Kachel nur mit Puffer: pushBild(Kachel) legt nichts ab (sonst ein Frame ohne Verweis)\n");
  DelayLine d;
  CHECK(d.pushBild(Bildart::Kachel, kW, kH, at(0)) == 0);
  CHECK(d.size() == 0);
  pushBild(d, 1, 10);
  CHECK(d.pushBild(Bildart::Kachel, kW, kH, at(20)) == 0);
  CHECK(d.size() == 1);
  bool ohneVerweis = false;
  const auto senke = [&](const DelayLine::Frame& f) {
    if (f.art == Bildart::Kachel && !f.kachel) ohneVerweis = true;
  };
  d.release(at(1000), milliseconds(500), senke);
  CHECK(!ohneVerweis && d.size() == 0);
}

// #310: ein Rohbild „einpassen in 16 x 9“ (Rahmengroesse klein, nur als Merker - die Warteschlange passt nichts ein).
int einpassBild(DelayLine& d, uint8_t kennung, int ms) {
  const auto b = bild(kennung);
  return d.pushEinpassen(b.data(), kLen, kW, kH, 16, 9, at(ms));
}

// Kennungen der entnommenen Bilder, wie Ausgang sie am Ausgang von release() sieht.
std::vector<int> kennungenVon(const std::vector<DelayLine::Frame>& aus) {
  Ausgang a;
  for (const auto& f : aus) a(f);
  return a.kennungen;
}

void test_einpassen_traegt_rahmen_310() {
  std::printf("#310 Bildart Einpassen: traegt Rohbild (Kopie) und Rahmengroesse bis zum Ausgang\n");
  DelayLine d;
  auto b = bild(5);
  CHECK(d.pushEinpassen(b.data(), kLen, kW, kH, 16, 9, at(0)) == 0);
  b[0] = 99;   // Zoom ueberschreibt seinen Puffer mit dem naechsten Bild
  Bildart art = Bildart::I420;
  int w = 0, h = 0, rahmenW = 0, rahmenH = 0, kennung = 0;
  const auto r = d.release(at(100), milliseconds(0), [&](const DelayLine::Frame& f) {
    art = f.art; w = f.w; h = f.h; rahmenW = f.rahmenW; rahmenH = f.rahmenH; kennung = f.data.at(0);
  });
  CHECK(r.sent == 1);
  CHECK(art == Bildart::Einpassen);
  CHECK(w == 4);
  CHECK(h == 2);
  CHECK(rahmenW == 16);
  CHECK(rahmenH == 9);
  CHECK(kennung == 5);
}

void test_einpassen_nur_ueber_pusheinpassen_310() {
  std::printf("#310 Bildart Einpassen nur mit Bilddaten und Rahmengroesse: pushBild(Einpassen) und Rahmen 0 legen nichts ab\n");
  DelayLine d;
  const auto b = bild(1);
  CHECK(d.pushBild(Bildart::Einpassen, 4, 2, at(0)) == 0);
  CHECK(d.pushEinpassen(b.data(), kLen, kW, kH, 0, 9, at(0)) == 0);
  CHECK(d.pushEinpassen(b.data(), kLen, kW, kH, 16, 0, at(0)) == 0);
  CHECK(d.pushEinpassen(b.data(), kLen - 1, kW, kH, 16, 9, at(0)) == 0);   // Laenge passt nicht zu w x h
  CHECK(d.size() == 0);
}

void test_einpassen_reihenfolge_310() {
  std::printf("#310 entnehmen: I420, Einpassen und Schwarz kommen in Ankunftsreihenfolge heraus\n");
  DelayLine d;
  pushBild(d, 1, 0);
  einpassBild(d, 2, 10);
  d.pushBild(Bildart::Schwarz, kW, kH, at(20));
  std::vector<DelayLine::Frame> aus;
  auto r = d.entnehmen(at(500), milliseconds(100), aus);
  CHECK((kennungenVon(aus) == std::vector<int>{1, 2, 0xFF}));
  CHECK(r.sent == 3);
  CHECK(r.dropped == 0);
  CHECK(d.size() == 0);
  d.zuruecklegen(aus);
  einpassBild(d, 3, 30);
  pushBild(d, 4, 40);
  r = d.entnehmen(at(500), milliseconds(100), aus);
  CHECK((kennungenVon(aus) == std::vector<int>{3, 4}));
  CHECK(r.sent == 2);
}

void test_entnehmen_wie_release_310() {
  std::printf("#310 entnehmen folgt derselben Faelligkeits- und Schwallregel wie release\n");
  DelayLine a, b;
  for (int i = 0; i < 10; ++i) {
    pushBild(a, static_cast<uint8_t>(i + 1), i * 10);
    pushBild(b, static_cast<uint8_t>(i + 1), i * 10);
  }
  pushBild(a, 42, 900);
  pushBild(b, 42, 900);
  Ausgang ausRelease;
  const auto ra = a.release(at(600), milliseconds(500), ausRelease);
  std::vector<DelayLine::Frame> aus;
  const auto rb = b.entnehmen(at(600), milliseconds(500), aus);
  CHECK(ausRelease.kennungen == std::vector<int>{10});
  CHECK(kennungenVon(aus) == std::vector<int>{10});
  CHECK(ra.sent == 1 && rb.sent == 1);
  CHECK(ra.dropped == 9 && rb.dropped == 9);
  CHECK(a.size() == 1 && b.size() == 1);   // das Bild von 900 ms wartet in beiden weiter
}

void test_zuruecklegen_fuellt_vorrat_310() {
  std::printf("#310 zuruecklegen gibt die Puffer der entnommenen Bilder in den Vorrat\n");
  DelayLine d;
  pushBild(d, 1, 0);
  einpassBild(d, 2, 10);
  d.pushBild(Bildart::Schwarz, kW, kH, at(20));
  std::vector<DelayLine::Frame> aus;
  d.entnehmen(at(100), milliseconds(0), aus);
  CHECK(aus.size() == 3);
  CHECK(d.spareBuffers() == 0);
  d.zuruecklegen(aus);
  CHECK(d.spareBuffers() == 2);   // das Schwarzbild hat keinen Puffer
  CHECK(aus.empty());
}

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
  test_bildarten_pb18();
  test_kachel_verweis_306();
  test_kachel_nur_ueber_pushkachel_306();
  test_einpassen_traegt_rahmen_310();
  test_einpassen_nur_ueber_pusheinpassen_310();
  test_einpassen_reihenfolge_310();
  test_entnehmen_wie_release_310();
  test_zuruecklegen_fuellt_vorrat_310();
  std::printf("\n%d Pruefungen, %d gefallen.\n", g_run, g_fail);
  return g_fail == 0 ? 0 : 1;
}
