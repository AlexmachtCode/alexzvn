// Menüleisten-Symbol von JM Connect unter macOS (#277, Spec 23, E59) als reines Modul (G-C2): kein electron, keine Uhr,
// kein Zufall; gleiche Eingabe, gleiche Bytes. Die Zeichnung V1 (OFC5: das Connect-Abzeichen aus resources/icon.svg,
// vereinfacht) steht als Daten in pt auf einer Fläche von 18 × 18 pt, y nach unten; jede Form deckt („plus“) oder stanzt
// aus („minus“), in ihrer Reihenfolge. trayVorlagePng(1) liefert das 18er, trayVorlagePng(2) die Retina-Fassung (36 px):
// PNG, RGBA mit 8 Bit, jedes Pixel schwarz, die Zeichnung nur im Alpha (Vorlagenbild; wie macOS es tönt, belegt das
// electron.d.ts nicht, Abnahme M1/M2). Kantenglättung mit 16 × 16 Abtastpunkten je Pixel; PNG mit Filter 0 in jeder Zeile,
// Deflate Stufe 9 (node:zlib), CRC32 im Modul. Die Wahl je Plattform: traySymbolArt (nur macOS bekommt das Vorlagenbild).
import { deflateSync } from 'node:zlib';

/** Woher das Tray-Bild kommt: unter macOS das Vorlagenbild dieses Moduls, sonst die Datei wie in 0.3.0 (E59). */
export type TraySymbolArt = 'vorlage' | 'datei';

export function traySymbolArt(plattform: string): TraySymbolArt {
  return plattform === 'darwin' ? 'vorlage' : 'datei';
}

/** Kantenlänge in pt; das 18er hat 1 Pixel je pt, die Retina-Fassung 2. */
export const TRAY_SYMBOL_PT = 18;

type Modus = 'plus' | 'minus';
type Form =
  | { modus: Modus; art: 'rrect'; x0: number; y0: number; x1: number; y1: number; r: number }
  | { modus: Modus; art: 'kreis'; cx: number; cy: number; r: number }
  | { modus: Modus; art: 'halbellipse'; cx: number; cy: number; rx: number; ry: number }
  | { modus: Modus; art: 'bogen'; cx: number; cy: number; r: number; breite: number; von: number; bis: number };

/**
 * V1: Bildschirm als Umriss (außen 16 × 12 pt, Strich 1,5 pt), rechts der Gast (Kopf und Schultern, 1 pt über der
 * Innenkante), links unten die eingehende Verbindung (Punkt und ein Viertelbogen mit runden Enden). Gerade Kanten liegen
 * auf halben pt, in der Retina-Fassung also auf ganzen Pixeln.
 */
const FORMEN: readonly Form[] = [
  { modus: 'plus', art: 'rrect', x0: 1, y0: 3, x1: 17, y1: 15, r: 2.5 },
  { modus: 'minus', art: 'rrect', x0: 2.5, y0: 4.5, x1: 15.5, y1: 13.5, r: 1 },
  { modus: 'plus', art: 'kreis', cx: 11.5, cy: 7, r: 1.75 },
  { modus: 'plus', art: 'halbellipse', cx: 11.5, cy: 12.5, rx: 3, ry: 3 },
  { modus: 'plus', art: 'kreis', cx: 4.5, cy: 11.5, r: 1 },
  { modus: 'plus', art: 'bogen', cx: 4.5, cy: 11.5, r: 2.75, breite: 1.5, von: -90, bis: 0 },
];

function drin(f: Form, x: number, y: number): boolean {
  switch (f.art) {
    case 'rrect': {
      if (x < f.x0 || x > f.x1 || y < f.y0 || y > f.y1) return false;
      const cx = Math.min(Math.max(x, f.x0 + f.r), f.x1 - f.r);
      const cy = Math.min(Math.max(y, f.y0 + f.r), f.y1 - f.r);
      return (x - cx) ** 2 + (y - cy) ** 2 <= f.r * f.r;
    }
    case 'kreis':
      return (x - f.cx) ** 2 + (y - f.cy) ** 2 <= f.r * f.r;
    case 'halbellipse': // obere Hälfte (y ≤ cy)
      return y <= f.cy && ((x - f.cx) / f.rx) ** 2 + ((y - f.cy) / f.ry) ** 2 <= 1;
    case 'bogen': {
      // Strich der Breite f.breite um den Kreisbogen; Winkel in Grad (0 = rechts, -90 = oben); runde Enden
      const h = f.breite / 2;
      const d = Math.hypot(x - f.cx, y - f.cy);
      const w = (Math.atan2(y - f.cy, x - f.cx) * 180) / Math.PI;
      if (Math.abs(d - f.r) <= h && w >= f.von && w <= f.bis) return true;
      return [f.von, f.bis].some((a) => {
        const ex = f.cx + f.r * Math.cos((a * Math.PI) / 180);
        const ey = f.cy + f.r * Math.sin((a * Math.PI) / 180);
        return (x - ex) ** 2 + (y - ey) ** 2 <= h * h;
      });
    }
  }
}

/** Alpha je Pixel (0–255) bei skala Pixeln je pt, zeilenweise von oben links. */
function rastere(skala: number): Uint8Array {
  const kante = TRAY_SYMBOL_PT * skala;
  const n = 16;
  const alpha = new Uint8Array(kante * kante);
  for (let py = 0; py < kante; py++) {
    for (let px = 0; px < kante; px++) {
      let treffer = 0;
      for (let j = 0; j < n; j++) {
        const y = (py + (j + 0.5) / n) / skala;
        for (let i = 0; i < n; i++) {
          const x = (px + (i + 0.5) / n) / skala;
          let deckt = false;
          for (const f of FORMEN) if (drin(f, x, y)) deckt = f.modus === 'plus';
          if (deckt) treffer++;
        }
      }
      alpha[py * kante + px] = Math.round((255 * treffer) / (n * n));
    }
  }
  return alpha;
}

const CRC_TAFEL = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(b: Buffer): number {
  let c = 0xffffffff;
  for (const x of b) c = CRC_TAFEL[(c ^ x) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(typ: string, daten: Buffer): Buffer {
  const b = Buffer.alloc(12 + daten.length);
  b.writeUInt32BE(daten.length, 0);
  b.write(typ, 4, 'ascii');
  daten.copy(b, 8);
  b.writeUInt32BE(crc32(b.subarray(4, 8 + daten.length)), 8 + daten.length);
  return b;
}

/** PNG aus dem Alpha-Feld: RGBA mit 8 Bit, ohne Interlace, RGB überall 0, Filter 0 in jeder Zeile. */
function png(kante: number, alpha: Uint8Array): Buffer {
  const zeile = kante * 4 + 1;
  const roh = Buffer.alloc(zeile * kante); // Filterbyte 0 und RGB 0 schon durch alloc
  for (let i = 0; i < kante * kante; i++) roh[Math.floor(i / kante) * zeile + 1 + (i % kante) * 4 + 3] = alpha[i];
  const kopf = Buffer.alloc(13);
  kopf.writeUInt32BE(kante, 0);
  kopf.writeUInt32BE(kante, 4);
  kopf[8] = 8; // Bit je Kanal
  kopf[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', kopf),
    chunk('IDAT', deflateSync(roh, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Vorlagenbild als PNG: skala 1 → 18 × 18 px, skala 2 → 36 × 36 px (Retina-Fassung für scaleFactor 2). */
export function trayVorlagePng(skala: 1 | 2): Buffer {
  return png(TRAY_SYMBOL_PT * skala, rastere(skala));
}
