// Selbsttest der 16:9-Einpassung (bild_einpassen.h, #310) - OHNE Zoom, OHNE NDI, OHNE Uhr: Flaeche, Achsen und
// die Bildpunkt-Arbeit (I420 -> UYVA) sind reine Funktionen.
//
//   npm run logik-test -w @jm/zoom-bridge
//
// Rueckgabewert 0 = alles gruen, 1 = mindestens eine Pruefung gefallen.
#include "bild_einpassen.h"

#include <cstdint>
#include <cstdio>
#include <cstdlib>
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

struct Uyv { int u, y, v; };
bool operator==(const Uyv& a, const Uyv& b) { return a.u == b.u && a.y == b.y && a.v == b.v; }

size_t zeile(const Rahmen& r, int y) { return static_cast<size_t>(y) * static_cast<size_t>(r.W) * 2u; }
Uyv uyvy(const Rahmen& r, int x, int y) {
  const size_t z = zeile(r, y);
  const size_t paar = z + static_cast<size_t>(x & ~1) * 2u;
  return Uyv{r.daten[paar], r.daten[z + static_cast<size_t>(x) * 2u + 1u], r.daten[paar + 2u]};
}
int alpha(const Rahmen& r, int x, int y) {
  return r.daten[static_cast<size_t>(r.W) * static_cast<size_t>(r.H) * 2u + static_cast<size_t>(y) * static_cast<size_t>(r.W) + static_cast<size_t>(x)];
}
int64_t absl(int64_t a) { return a < 0 ? -a : a; }

/** Y-Wert des Flaechenpunkts (fx, fy), gezaehlt ab der Flaeche. */
int flaechenY(const Rahmen& r, int fx, int fy) { return uyvy(r, r.flaeche.x + fx, r.flaeche.y + fy).y; }

void t_ist16zu9() {
  CHECK(ist16zu9(640, 360) && ist16zu9(1280, 720) && ist16zu9(1920, 1080) && ist16zu9(1920, 1088));
  CHECK(ist16zu9(176, 100) && ist16zu9(179, 100) && !ist16zu9(175, 100) && !ist16zu9(180, 100));   // Grenze 1 %
  CHECK(!ist16zu9(720, 1280) && !ist16zu9(1280, 800) && !ist16zu9(640, 480));
  CHECK(!ist16zu9(0, 0) && !ist16zu9(16, 0) && !ist16zu9(-16, -9));
}

void t_einpassen_noetig() {
  CHECK(einpassenNoetig(true, false, 720, 1280));
  CHECK(!einpassenNoetig(false, false, 720, 1280) && !einpassenNoetig(true, true, 720, 1280));   // Original, Freigabe
  CHECK(!einpassenNoetig(true, false, 1280, 720) && !einpassenNoetig(true, false, 0, 0));
}

void t_bild_flaeche() {
  CHECK(bildFlaeche(720, 1280, 1920, 1080) == (Rechteck{656, 0, 608, 1080}));
  CHECK(bildFlaeche(360, 640, 1280, 720) == (Rechteck{436, 0, 406, 720}));
  CHECK(bildFlaeche(360, 640, 640, 360) == (Rechteck{218, 0, 202, 360}));
  CHECK(bildFlaeche(640, 480, 1920, 1080) == (Rechteck{240, 0, 1440, 1080}));
  CHECK(bildFlaeche(2560, 1080, 1920, 1080) == (Rechteck{0, 135, 1920, 810}));
  CHECK(bildFlaeche(721, 1281, 1920, 1080) == (Rechteck{656, 0, 608, 1080}));
  CHECK(bildFlaeche(0, 1280, 1920, 1080) == Rechteck{} && bildFlaeche(720, 1280, 0, 0) == Rechteck{});
}

void t_bild_flaeche_invarianten() {
  const int rahmen[3][2] = {{640, 360}, {1280, 720}, {1920, 1080}};
  for (int w = 2; w <= 2000; w += 37) {
    for (int h = 2; h <= 2000; h += 37) {
      for (const auto& rm : rahmen) {
        const int W = rm[0], H = rm[1];
        const Rechteck f = bildFlaeche(w, h, W, H);
        const int rechts = (W - f.w - f.x) - f.x;
        const int64_t abw = absl(static_cast<int64_t>(f.w) * h - static_cast<int64_t>(f.h) * w);
        const int64_t grenze = w > h ? w : h;
        const bool ok = f.x % 2 == 0 && f.w % 2 == 0 && f.h % 2 == 0
                        && f.x >= 0 && f.x + f.w <= W && f.y >= 0 && f.y + f.h <= H
                        && rechts >= 0 && rechts <= 2 && H - f.h - f.y == f.y
                        && (f.w == W || f.h == H)
                        && (f.w == 2 || f.h == 2 || abw <= grenze);   // Seite auf das Mindestmass 2 geklemmt: Seitenverhaeltnis nicht mehr haltbar
        if (!ok) std::printf("  Fall w=%d h=%d W=%d H=%d: Flaeche {%d,%d,%d,%d}\n", w, h, W, H, f.x, f.y, f.w, f.h);
        CHECK(ok);
      }
    }
  }
}

void t_achse() {
  std::vector<Stelle> s;
  achse(4, 2, s);
  CHECK(s.size() == 2 && s[0].i0 == 0 && s[0].i1 == 1 && s[0].f == 128 && s[1].i0 == 2 && s[1].i1 == 3 && s[1].f == 128);
  achse(2, 4, s);
  CHECK(s[0].i0 == 0 && s[0].f == 0 && s[1].i0 == 0 && s[1].i1 == 1 && s[1].f == 64 && s[2].f == 192
        && s[3].i0 == 1 && s[3].i1 == 1 && s[3].f == 0);
  achse(3, 3, s);
  CHECK(s[0].i0 == 0 && s[1].i0 == 1 && s[2].i0 == 2 && s[2].i1 == 2 && s[0].f + s[1].f + s[2].f == 0);
  achse(1, 3, s);
  CHECK(s.size() == 3);
  for (const Stelle& st : s) CHECK(st.i0 == 0 && st.i1 == 0 && st.f == 0);
}

/** Alle Punkte ausserhalb der Flaeche: {128,16,128} und Alpha 0. */
bool randOk(const Rahmen& r) {
  for (int y = 0; y < r.H; ++y) {
    for (int x = 0; x < r.W; ++x) {
      const bool innen = x >= r.flaeche.x && x < r.flaeche.x + r.flaeche.w && y >= r.flaeche.y && y < r.flaeche.y + r.flaeche.h;
      if (innen) continue;
      if (!(uyvy(r, x, y) == Uyv{128, 16, 128}) || alpha(r, x, y) != 0) return false;
    }
  }
  return true;
}

void t_rahmen_raender() {
  Rahmen r;
  rahmenVorbereiten(r, 1920, 1080, Rechteck{656, 0, 608, 1080});
  CHECK(r.daten.size() == static_cast<size_t>(1920) * 1080 * 3);
  CHECK(uyvy(r, 0, 0) == (Uyv{128, 16, 128}));
  CHECK(alpha(r, 0, 540) == 0 && alpha(r, 655, 540) == 0 && alpha(r, 656, 540) == 255);
  CHECK(alpha(r, 1263, 540) == 255 && alpha(r, 1264, 540) == 0 && alpha(r, 1919, 1079) == 0);
  std::vector<uint8_t> q;
  einfarbigI420(q, 720, 1280, 81, 90, 240);
  einpassen(q.data(), 720, 1280, r);
  CHECK(randOk(r));
  CHECK(alpha(r, 656, 0) == 255 && alpha(r, 1263, 1079) == 255);
}

/** Zaehlt Flaechenpunkte, die nicht {u, y, v} sind. */
int abweichungen(const Rahmen& r, int u, int y, int v) {
  int n = 0;
  for (int fy = 0; fy < r.flaeche.h; ++fy)
    for (int fx = 0; fx < r.flaeche.w; ++fx)
      if (!(uyvy(r, r.flaeche.x + fx, r.flaeche.y + fy) == Uyv{u, y, v})) ++n;
  return n;
}

void t_farbtreue() {
  std::vector<uint8_t> q;
  Rahmen a;
  rahmenVorbereiten(a, 1920, 1080, bildFlaeche(720, 1280, 1920, 1080));
  einfarbigI420(q, 720, 1280, 81, 90, 240);
  einpassen(q.data(), 720, 1280, a);
  CHECK(abweichungen(a, 90, 81, 240) == 0);
  Rahmen b;
  rahmenVorbereiten(b, 1280, 720, bildFlaeche(360, 640, 1280, 720));
  einfarbigI420(q, 360, 640, 81, 90, 240);
  einpassen(q.data(), 360, 640, b);
  CHECK(abweichungen(b, 90, 81, 240) == 0);
}

void t_identitaet() {
  std::vector<uint8_t> q(i420Bytes(608, 1080), 128);
  for (int y = 0; y < 1080; ++y)
    for (int x = 0; x < 608; ++x) q[static_cast<size_t>(y) * 608u + static_cast<size_t>(x)] = static_cast<uint8_t>((x * 7 + y * 3) & 0xFF);
  Rahmen r;
  rahmenVorbereiten(r, 1920, 1080, bildFlaeche(608, 1080, 1920, 1080));
  CHECK(r.flaeche == (Rechteck{656, 0, 608, 1080}));
  einpassen(q.data(), 608, 1080, r);
  int falsch = 0;
  for (int y = 0; y < 1080; ++y)
    for (int x = 0; x < 608; ++x)
      if (flaechenY(r, x, y) != ((x * 7 + y * 3) & 0xFF)) ++falsch;
  CHECK(falsch == 0);
}

void t_verkleinern_glaettet() {
  std::vector<uint8_t> q(i420Bytes(720, 1280), 128);
  for (int y = 0; y < 1280; ++y)
    for (int x = 0; x < 720; ++x) q[static_cast<size_t>(y) * 720u + static_cast<size_t>(x)] = (x % 2 == 0) ? 16 : 235;
  Rahmen r;
  rahmenVorbereiten(r, 1920, 1080, bildFlaeche(720, 1280, 1920, 1080));
  einpassen(q.data(), 720, 1280, r);
  long dazwischen = 0;
  for (int y = 0; y < r.flaeche.h; ++y)
    for (int x = 0; x < r.flaeche.w; ++x) {
      const int v = flaechenY(r, x, y);
      if (v > 16 && v < 235) ++dazwischen;
    }
  CHECK(dazwischen * 4 > static_cast<long>(r.flaeche.w) * r.flaeche.h);
}

void t_vergroessern_rampe() {
  std::vector<uint8_t> q(i420Bytes(360, 640), 128);
  for (int y = 0; y < 640; ++y)
    for (int x = 0; x < 360; ++x) q[static_cast<size_t>(y) * 360u + static_cast<size_t>(x)] = static_cast<uint8_t>(16 + 219 * x / 359);
  Rahmen r;
  rahmenVorbereiten(r, 1280, 720, bildFlaeche(360, 640, 1280, 720));
  einpassen(q.data(), 360, 640, r);
  bool steigt = true;
  for (int x = 1; x < r.flaeche.w; ++x)
    if (flaechenY(r, x, 360) < flaechenY(r, x - 1, 360)) steigt = false;
  CHECK(steigt);
  CHECK(flaechenY(r, 0, 360) <= 18);
  CHECK(flaechenY(r, r.flaeche.w - 1, 360) >= 233);
}

void t_ungerade_quelle() {
  std::vector<uint8_t> q;
  einfarbigI420(q, 361, 641, 50, 100, 200);
  CHECK(q.size() == i420Bytes(361, 641));
  q.resize(q.size() + 4096, 0);   // dahinter Nullen: wuerde etwas gelesen, waere der Wert nicht 50/100/200
  Rahmen r;
  rahmenVorbereiten(r, 1280, 720, bildFlaeche(361, 641, 1280, 720));
  CHECK(r.flaeche.x % 2 == 0 && r.flaeche.w % 2 == 0 && r.flaeche.h % 2 == 0);
  einpassen(q.data(), 361, 641, r);
  CHECK(abweichungen(r, 100, 50, 200) == 0);
}

void t_zu_klein() {
  std::vector<uint8_t> q;
  einfarbigI420(q, 720, 1280, 200, 90, 240);
  Rahmen r;
  rahmenVorbereiten(r, 1920, 1080, bildFlaeche(720, 1280, 1920, 1080));
  const std::vector<uint8_t> kopie = r.daten;
  einpassen(q.data(), 1, 1280, r);
  CHECK(r.daten == kopie);
  einpassen(q.data(), 720, 1, r);
  CHECK(r.daten == kopie);
  einpassen(nullptr, 720, 1280, r);
  CHECK(r.daten == kopie);
}

void t_rahmen_wechsel() {
  std::vector<uint8_t> q;
  einfarbigI420(q, 720, 1280, 200, 128, 128);
  Rahmen r;
  rahmenVorbereiten(r, 1920, 1080, bildFlaeche(720, 1280, 1920, 1080));
  einpassen(q.data(), 720, 1280, r);
  const uint8_t* zeiger = r.daten.data();
  rahmenVorbereiten(r, 1280, 720, bildFlaeche(360, 640, 1280, 720));
  CHECK(r.daten.data() == zeiger);
  CHECK(r.daten.size() == static_cast<size_t>(1280) * 720 * 3);
  CHECK(alpha(r, 435, 360) == 0 && alpha(r, 436, 360) == 255 && uyvy(r, 435, 360) == (Uyv{128, 16, 128}));
}

void t_inhalt() {
  Rahmen r;
  const Rechteck f = bildFlaeche(720, 1280, 1920, 1080);
  rahmenVorbereiten(r, 1920, 1080, f);
  r.inhalt = 7;
  rahmenVorbereiten(r, 1920, 1080, f);
  CHECK(r.inhalt == 7);
  rahmenVorbereiten(r, 1280, 720, bildFlaeche(360, 640, 1280, 720));
  CHECK(r.inhalt == 0);
}

void t_speicher() {
  Rahmen leer;
  CHECK(speicherBytes(leer) == 0);
  Rahmen r;
  rahmenVorbereiten(r, 640, 360, bildFlaeche(360, 640, 640, 360));
  CHECK(speicherBytes(r) >= RAHMEN_MAX_BYTES);
}

void t_einfarbig() {
  std::vector<uint8_t> v;
  einfarbigI420(v, 4, 2, 16, 128, 128);
  CHECK(v.size() == 12);
  bool ok = v.size() == 12;
  for (size_t i = 0; ok && i < 8; ++i) ok = v[i] == 16;
  for (size_t i = 8; ok && i < 12; ++i) ok = v[i] == 128;
  CHECK(ok);
  einfarbigI420(v, 3, 3, 16, 128, 128);
  CHECK(v.size() == 11);
  CHECK(i420Bytes(0, 5) == 0 && i420Bytes(720, 1280) == 720u * 1280u + 2u * 360u * 640u && uyvaBytes(4, 2) == 24);
}

}  // namespace

int main() {
  t_ist16zu9();
  t_einpassen_noetig();
  t_bild_flaeche();
  t_bild_flaeche_invarianten();
  t_achse();
  t_rahmen_raender();
  t_farbtreue();
  t_identitaet();
  t_verkleinern_glaettet();
  t_vergroessern_rampe();
  t_ungerade_quelle();
  t_zu_klein();
  t_rahmen_wechsel();
  t_inhalt();
  t_speicher();
  t_einfarbig();
  std::printf("%d Pruefungen, %d gefallen.\n", g_run, g_fail);
  return g_fail == 0 ? 0 : 1;
}
