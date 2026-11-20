// Zeitmessung der 16:9-Einpassung (bild_einpassen.h, #310): Tor fuer den Ansatz "eigene Schleifen, kein libyuv".
// Gemessen wird nur einpassen() je Bild (Rahmen und Tabellen sind vorbereitet), 500 Bilder nach 20 Anlaufbildern.
// Grenze: Median <= 2 ms und P95 <= 4 ms je Bild, im optimierten Bau.
//
//   npm run einpassen-messung -w @jm/zoom-bridge
//
// Eigenes main und <chrono>: darum keine _test.cpp und nicht in TESTDATEIEN; die Logik selbst bleibt uhrfrei.
// Rueckgabewert 0 = innerhalb der Grenze, 1 = ueber der Grenze.
#include "bild_einpassen.h"

#include <algorithm>
#include <chrono>
#include <cstdint>
#include <cstdio>
#include <vector>

using namespace einpass;

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

constexpr int ANLAUF = 20;
constexpr int BILDER = 500;

/** I420 mit Verlauf in allen drei Ebenen (nicht einfarbig, damit nichts wegoptimiert oder gekuerzt wird). */
std::vector<uint8_t> verlauf(int w, int h) {
  std::vector<uint8_t> q(i420Bytes(w, h));
  for (size_t i = 0; i < q.size(); ++i) q[i] = static_cast<uint8_t>((i * 7u + (i >> 9) * 13u) & 0xFFu);
  return q;
}

void fall(int w, int h, int W, int H) {
  const std::vector<uint8_t> q = verlauf(w, h);
  Rahmen r;
  rahmenVorbereiten(r, W, H, bildFlaeche(w, h, W, H));
  for (int i = 0; i < ANLAUF; ++i) einpassen(q.data(), w, h, r);
  std::vector<double> ms;
  ms.reserve(BILDER);
  for (int i = 0; i < BILDER; ++i) {
    const auto t0 = std::chrono::steady_clock::now();
    einpassen(q.data(), w, h, r);
    const auto t1 = std::chrono::steady_clock::now();
    ms.push_back(std::chrono::duration<double, std::milli>(t1 - t0).count());
  }
  uint64_t summe = 0;
  for (uint8_t b : r.daten) summe += b;
  std::sort(ms.begin(), ms.end());
  const double median = ms[250];
  const double p95 = ms[475];
  std::printf("Messung %dx%d -> %dx%d: Median %.2f ms, P95 %.2f ms (Grenze 2 / 4 ms)\n", w, h, W, H, median, p95);
  std::printf("  Pruefsumme %llu\n", static_cast<unsigned long long>(summe));
  CHECK(median <= 2.0);
  CHECK(p95 <= 4.0);
}

}  // namespace

int main() {
  fall(720, 1280, 1920, 1080);
  fall(360, 640, 1280, 720);
  std::printf("%d Pruefungen, %d gefallen.\n", g_run, g_fail);
  return g_fail == 0 ? 0 : 1;
}
