// #303: Reine Zeichenhilfen des NDI-Bilds – ohne DOM, ohne Electron. Die NDI-Ansicht (ndi/ndi-ansicht.ts) zeichnet
// damit das Publikumsbild auf ein festes 1920×1080-Bild: eingepasst wie SlideCanvas, Überblendung wie der CSS-Stapel
// der Publikumsansicht (`opacity … ease-in-out`), freie Ränder transparent.
import type { BildArt } from './publikumsbild';
import { NDI_BREITE, NDI_HOEHE } from './ndi';

export interface Rechteck {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Folie der Größe bw×bh ins NDI-Bild: verkleinern, nie vergrößern (wie im Publikumsfenster), mittig. */
export function einpassen(bw: number, bh: number): Rechteck {
  const f = Math.min(1, NDI_BREITE / bw, NDI_HOEHE / bh);
  const w = Math.round(bw * f);
  const h = Math.round(bh * f);
  return { x: Math.round((NDI_BREITE - w) / 2), y: Math.round((NDI_HOEHE - h) / 2), w, h };
}

/** CSS `ease-in-out` = `cubic-bezier(0.42, 0, 0.58, 1)`; t wird auf 0..1 begrenzt. */
export function easeInOut(t: number): number {
  if (!(t > 0)) return 0;
  if (t >= 1) return 1;
  const x1 = 0.42, x2 = 0.58; // y1 = 0, y2 = 1
  const bx = (s: number): number => 3 * (1 - s) * (1 - s) * s * x1 + 3 * (1 - s) * s * s * x2 + s * s * s;
  // x(s) steigt monoton: den Kurvenparameter zu x = t per Bisektion suchen, dann y(s) = 3s² − 2s³.
  let lo = 0, hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (bx(mid) < t) lo = mid; else hi = mid;
  }
  const s = (lo + hi) / 2;
  return 3 * s * s - 2 * s * s * s;
}

/** Zeitdaten einer Schicht (unten → oben). `bereitAbMs` = gemalt seit (null = noch nicht gemalt). */
export interface SchichtZeit {
  key: number;
  /** 0 = Schnitt. */
  blendeMs: number;
  bereitAbMs: number | null;
}

export interface Zeichenplan {
  /** Von unten nach oben, je mit Deckkraft. */
  zeichnen: { key: number; alpha: number }[];
  /** Oberste Schicht, die voll deckt – alles darunter ist verdeckt und kann weg. */
  deckendAb: number | null;
  /** Läuft noch eine Überblendung (dann im Takt weiterzeichnen)? */
  blendeLaeuft: boolean;
}

/**
 * Was zum Zeitpunkt `jetztMs` zu zeichnen ist. Eine nicht gemalte Schicht zählt nicht (die alte bleibt stehen –
 * kein Schwarzblitz); ein Schnitt deckt sofort, eine Blende erst, wenn sie fertig ist.
 */
export function zeichenplan(schichten: readonly SchichtZeit[], jetztMs: number): Zeichenplan {
  const bereit: { key: number; alpha: number; deckt: boolean }[] = [];
  for (const s of schichten) {
    if (s.bereitAbMs === null) continue;
    const t = s.blendeMs > 0 ? Math.min(1, Math.max(0, (jetztMs - s.bereitAbMs) / s.blendeMs)) : 1;
    bereit.push({ key: s.key, alpha: t >= 1 ? 1 : easeInOut(t), deckt: t >= 1 });
  }
  let ab = 0;
  for (let i = bereit.length - 1; i >= 0; i--) {
    if (bereit[i].deckt) {
      ab = i;
      break;
    }
  }
  const sichtbar = bereit.slice(ab);
  return {
    zeichnen: sichtbar.map((e) => ({ key: e.key, alpha: e.alpha })),
    deckendAb: sichtbar[0]?.deckt ? sichtbar[0].key : null,
    blendeLaeuft: sichtbar.some((e) => !e.deckt),
  };
}

/** Canvas-Pixel (RGBA) an Ort und Stelle zu BGRA: R und B tauschen, Alpha bleibt (Formel aus dem Titler). */
export function rgbaZuBgra(px: Uint8Array | Uint8ClampedArray): void {
  const u32 = new Uint32Array(px.buffer, px.byteOffset, px.length >> 2);
  for (let i = 0; i < u32.length; i++) {
    const p = u32[i];
    // RGBA (0xAABBGGRR LE) → BGRA (0xAARRGGBB LE).
    u32[i] = (p & 0xff00ff00) | ((p & 0x000000ff) << 16) | ((p & 0x00ff0000) >>> 16);
  }
}

/** Womit das NDI-Bild gefüllt wird. */
export type NdiFuellung = 'transparent' | 'weiss' | 'schichten';

/** Pause Schwarz, nichts geöffnet und gestoppt → ganz transparent; Weiß → weiß; sonst der Schichtenstapel. */
export function ndiFuellung(art: BildArt): NdiFuellung {
  if (art === 'weiss') return 'weiss';
  if (art === 'folie') return 'schichten';
  return 'transparent';
}
