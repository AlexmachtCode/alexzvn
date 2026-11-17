// Reine 16:9-Einpassung der Hochkant-Zuschaltungen (#310) - nur Standardbibliothek, keine Uhr, kein windows.h:
// darum im Logik-Test (native/bild_einpassen_test.cpp) und ohne SDK pruefbar. Ein Bild beliebigen Formats
// (I420) wird mittig, seitenrichtig und bilinear verkleinert/vergroessert in einen UYVA-Rahmen W x H gelegt;
// ausserhalb der Flaeche bleibt der Rahmen durchsichtig (Alpha 0, Schwarz).
//
// Kein min/max und keine Makros: die Datei wird nach windows.h eingebunden.
#pragma once

#include <cstddef>
#include <cstdint>
#include <vector>

namespace einpass {

struct Rechteck {
  int x = 0, y = 0, w = 0, h = 0;
};
inline bool operator==(const Rechteck& a, const Rechteck& b) { return a.x == b.x && a.y == b.y && a.w == b.w && a.h == b.h; }
inline bool operator!=(const Rechteck& a, const Rechteck& b) { return !(a == b); }

/** Eine Abtaststelle einer Achse: Quellindex links/oben (i0), rechts/unten (i1), Gewicht von i1 in 1/256. */
struct Stelle {
  int32_t i0 = 0;
  int32_t i1 = 0;
  uint32_t f = 0;
};

/** Der Ausgaberahmen samt Abtasttabellen. daten = UYVA W x H: UYVY-Ebene (W*H*2, Zeilenabstand 2*W), dahinter Alpha (W*H). */
struct Rahmen {
  std::vector<uint8_t> daten;
  int W = 0, H = 0;
  Rechteck flaeche{};
  uint32_t inhalt = 0;           // Kennung des zuletzt eingepassten Inhalts (setzt der Aufrufer), 0 = keiner
  int quelleW = 0, quelleH = 0;  // Quellmasse, fuer die yx..cy gelten (0 = neu rechnen)
  std::vector<Stelle> yx, yy, cx, cy;
};

inline constexpr int RAHMEN_MAX_W = 1920, RAHMEN_MAX_H = 1080;
inline constexpr size_t RAHMEN_MAX_BYTES = 1920u * 1080u * 3u;

inline size_t i420Bytes(int w, int h) {
  if (w <= 0 || h <= 0) return 0;
  const size_t sw = static_cast<size_t>(w), sh = static_cast<size_t>(h);
  return sw * sh + 2u * (sw / 2u) * (sh / 2u);
}

inline size_t uyvaBytes(int W, int H) {
  if (W <= 0 || H <= 0) return 0;
  return static_cast<size_t>(W) * static_cast<size_t>(H) * 3u;
}

/** Ob (w, h) auf 1 % genau 16:9 ist. */
inline bool ist16zu9(int w, int h) {
  if (w <= 0 || h <= 0) return false;
  const int64_t d = static_cast<int64_t>(w) * 9 - static_cast<int64_t>(h) * 16;
  const int64_t betrag = d < 0 ? -d : d;
  return betrag * 100 <= static_cast<int64_t>(h) * 16;
}

inline bool einpassenNoetig(bool fitGewaehlt, bool freigabe, int w, int h) {
  return fitGewaehlt && !freigabe && w > 0 && h > 0 && !ist16zu9(w, h);
}

/** Die Flaeche (gerade x, w, h), in die ein Bild w x h mittig in den Rahmen W x H passt; ungueltige Masse: Rechteck{}. */
inline Rechteck bildFlaeche(int w, int h, int W, int H) {
  if (w <= 0 || h <= 0 || W <= 0 || H <= 0) return Rechteck{};
  const int64_t bw = w, bh = h, rw = W, rh = H;
  const int64_t maxW = rw & ~static_cast<int64_t>(1), maxH = rh & ~static_cast<int64_t>(1);
  int64_t fw = 0, fh = 0;
  if (bw * rh < rw * bh) {   // hoehenbegrenzt
    fh = maxH;
    fw = 2 * ((rh * bw + bh) / (2 * bh));
  } else {
    fw = maxW;
    fh = 2 * ((rw * bh + bw) / (2 * bw));
  }
  if (fw < 2) fw = 2;
  if (fw > maxW) fw = maxW;
  if (fh < 2) fh = 2;
  if (fh > maxH) fh = maxH;
  Rechteck f;
  f.w = static_cast<int>(fw);
  f.h = static_cast<int>(fh);
  f.x = ((W - f.w) / 2) & ~1;
  f.y = (H - f.h) / 2;
  return f;
}

/** Mittenpunkt-Abbildung quelle -> ziel (16.16), je Zielindex eine Stelle; ungueltige Masse: leer. */
inline void achse(int quelle, int ziel, std::vector<Stelle>& aus) {
  aus.clear();
  if (quelle < 1 || ziel < 1) return;
  const int64_t schritt = (static_cast<int64_t>(quelle) << 16) / ziel;
  const int64_t oben = static_cast<int64_t>(quelle - 1) << 16;
  aus.resize(static_cast<size_t>(ziel));
  for (int d = 0; d < ziel; ++d) {
    int64_t p = schritt / 2 - 32768 + static_cast<int64_t>(d) * schritt;
    if (p < 0) p = 0;
    if (p > oben) p = oben;
    Stelle& s = aus[static_cast<size_t>(d)];
    s.i0 = static_cast<int32_t>(p >> 16);
    s.f = static_cast<uint32_t>((p >> 8) & 255);
    s.i1 = (s.i0 + 1 < quelle) ? s.i0 + 1 : quelle - 1;
  }
}

inline bool flaecheGueltig(int W, int H, const Rechteck& f) {
  return f.x >= 0 && f.y >= 0 && f.w >= 0 && f.h >= 0 && f.x + f.w <= W && f.y + f.h <= H;
}

/** Legt den Rahmen an (Rand: UYVY 128/16, Alpha 0; Flaeche: Alpha 255). Gleiche Geometrie: nichts anfassen. */
inline void rahmenVorbereiten(Rahmen& r, int W, int H, Rechteck flaeche) {
  if (!r.daten.empty() && r.W == W && r.H == H && r.flaeche == flaeche) return;
  const size_t n = uyvaBytes(W, H);
  if (r.daten.capacity() == 0) {
    r.daten.reserve(n > RAHMEN_MAX_BYTES ? n : RAHMEN_MAX_BYTES);
    r.yx.reserve(RAHMEN_MAX_W);
    r.cx.reserve(RAHMEN_MAX_W);
    r.yy.reserve(RAHMEN_MAX_H);
    r.cy.reserve(RAHMEN_MAX_H);
  }
  r.daten.resize(n);
  const size_t uyvy = n / 3u * 2u;
  for (size_t i = 0; i < uyvy; ++i) r.daten[i] = (i % 2u == 0u) ? 128 : 16;
  for (size_t i = uyvy; i < n; ++i) r.daten[i] = 0;
  r.W = W;
  r.H = H;
  r.flaeche = flaeche;
  if (n > 0 && flaecheGueltig(W, H, flaeche)) {
    for (int y = flaeche.y; y < flaeche.y + flaeche.h; ++y) {
      uint8_t* a = r.daten.data() + uyvy + static_cast<size_t>(y) * static_cast<size_t>(W) + static_cast<size_t>(flaeche.x);
      for (int x = 0; x < flaeche.w; ++x) a[x] = 255;
    }
  }
  r.inhalt = 0;
  r.quelleW = 0;
  r.quelleH = 0;
}

/** Bilinear ein I420-Bild in die Flaeche des Rahmens; Alpha und Rand bleiben unberuehrt. Unbrauchbare Eingabe: nichts. */
inline void einpassen(const uint8_t* i420, int w, int h, Rahmen& r) {
  const Rechteck& f = r.flaeche;
  if (i420 == nullptr || w < 2 || h < 2 || f.w < 2 || f.h < 2) return;
  if (r.daten.size() != uyvaBytes(r.W, r.H) || !flaecheGueltig(r.W, r.H, f)) return;
  if ((f.x & 1) != 0 || (f.w & 1) != 0) return;
  if (w != r.quelleW || h != r.quelleH) {
    achse(w, f.w, r.yx);
    achse(h, f.h, r.yy);
    achse(w / 2, f.w / 2, r.cx);
    achse(h / 2, f.h, r.cy);
    r.quelleW = w;
    r.quelleH = h;
  }
  const size_t sw = static_cast<size_t>(w);
  const size_t cw = sw / 2u;
  const uint8_t* ey = i420;
  const uint8_t* eu = i420 + sw * static_cast<size_t>(h);
  const uint8_t* ev = eu + cw * (static_cast<size_t>(h) / 2u);
  const size_t zeilenabstand = static_cast<size_t>(r.W) * 2u;
  const int paare = f.w / 2;
  for (int oy = 0; oy < f.h; ++oy) {
    uint8_t* aus = r.daten.data() + static_cast<size_t>(f.y + oy) * zeilenabstand + static_cast<size_t>(f.x) * 2u;
    const Stelle& sy = r.yy[static_cast<size_t>(oy)];
    const uint8_t* y0 = ey + static_cast<size_t>(sy.i0) * sw;
    const uint8_t* y1 = ey + static_cast<size_t>(sy.i1) * sw;
    const uint32_t fy = sy.f;
    for (int ox = 0; ox < f.w; ++ox) {
      const Stelle& sx = r.yx[static_cast<size_t>(ox)];
      const uint32_t fx = sx.f;
      const uint32_t o = static_cast<uint32_t>(y0[sx.i0]) * (256u - fx) + static_cast<uint32_t>(y0[sx.i1]) * fx;
      const uint32_t u = static_cast<uint32_t>(y1[sx.i0]) * (256u - fx) + static_cast<uint32_t>(y1[sx.i1]) * fx;
      aus[static_cast<size_t>(ox) * 2u + 1u] = static_cast<uint8_t>((o * (256u - fy) + u * fy + 32768u) >> 16);
    }
    const Stelle& sc = r.cy[static_cast<size_t>(oy)];
    const uint8_t* u0 = eu + static_cast<size_t>(sc.i0) * cw;
    const uint8_t* u1 = eu + static_cast<size_t>(sc.i1) * cw;
    const uint8_t* v0 = ev + static_cast<size_t>(sc.i0) * cw;
    const uint8_t* v1 = ev + static_cast<size_t>(sc.i1) * cw;
    const uint32_t fc = sc.f;
    for (int j = 0; j < paare; ++j) {
      const Stelle& sx = r.cx[static_cast<size_t>(j)];
      const uint32_t fx = sx.f;
      const uint32_t uo = static_cast<uint32_t>(u0[sx.i0]) * (256u - fx) + static_cast<uint32_t>(u0[sx.i1]) * fx;
      const uint32_t uu = static_cast<uint32_t>(u1[sx.i0]) * (256u - fx) + static_cast<uint32_t>(u1[sx.i1]) * fx;
      const uint32_t vo = static_cast<uint32_t>(v0[sx.i0]) * (256u - fx) + static_cast<uint32_t>(v0[sx.i1]) * fx;
      const uint32_t vu = static_cast<uint32_t>(v1[sx.i0]) * (256u - fx) + static_cast<uint32_t>(v1[sx.i1]) * fx;
      aus[static_cast<size_t>(j) * 4u] = static_cast<uint8_t>((uo * (256u - fc) + uu * fc + 32768u) >> 16);
      aus[static_cast<size_t>(j) * 4u + 2u] = static_cast<uint8_t>((vo * (256u - fc) + vu * fc + 32768u) >> 16);
    }
  }
}

/** Ein einfarbiges I420-Bild (Pruef- und Messhilfe). */
inline void einfarbigI420(std::vector<uint8_t>& aus, int w, int h, uint8_t y, uint8_t u, uint8_t v) {
  const size_t n = i420Bytes(w, h);
  aus.assign(n, y);
  if (n == 0) return;
  const size_t ys = static_cast<size_t>(w) * static_cast<size_t>(h);
  const size_t cs = (static_cast<size_t>(w) / 2u) * (static_cast<size_t>(h) / 2u);
  for (size_t i = 0; i < cs; ++i) {
    aus[ys + i] = u;
    aus[ys + cs + i] = v;
  }
}

inline size_t speicherBytes(const Rahmen& r) {
  return r.daten.capacity() + (r.yx.capacity() + r.yy.capacity() + r.cx.capacity() + r.cy.capacity()) * sizeof(Stelle);
}

}  // namespace einpass
