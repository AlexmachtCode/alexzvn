// Kontrast nach WCAG 2.x aus oklch-Werten, nur für die Selbsttests (Task 4).
// Rechenweg: oklch → OKLab (a = C·cos h, b = C·sin h) → LMS (hoch 3) → lineares sRGB (auf 0..1 geklemmt)
// → Luminanz Y = 0,2126 r + 0,7152 g + 0,0722 b → Kontrast (Yhell + 0,05) / (Ydunkel + 0,05).
// Durchscheinende Farben mischt der Browser im gamma-kodierten sRGB; mische() tut dasselbe.
import { leseText } from '../harness';
import { tokenTabelle } from './css';

/** Lineares sRGB, je Kanal 0..1 (geklemmt). */
export type Rgb = [number, number, number];

const OKLCH = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+)\s*)?\)$/;

const klemme = (x: number): number => Math.min(1, Math.max(0, x));

/** 'oklch(L C h)' oder 'oklch(L C h / a)'; alles andere → null. */
export function parseFarbe(wert: string): { rgb: Rgb; alpha: number } | null {
  const m = OKLCH.exec(wert.trim());
  if (!m) return null;
  const L = Number(m[1]);
  const C = Number(m[2]);
  const h = (Number(m[3]) * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb: Rgb = [
    klemme(4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s),
    klemme(-1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s),
    klemme(-0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s),
  ];
  return { rgb, alpha: m[4] === undefined ? 1 : Number(m[4]) };
}

/** Folgt var()-Ketten bis zu einem Wert ohne var(). Zyklus oder unbekannter Name → Error. */
export function loese(name: string, tabelle: Record<string, string>): string {
  const gesehen: string[] = [];
  let aktuell = name;
  for (;;) {
    if (gesehen.includes(aktuell)) throw new Error(`Zyklus: ${[...gesehen, aktuell].join(' → ')}`);
    gesehen.push(aktuell);
    const wert = tabelle[aktuell];
    if (wert === undefined) throw new Error(`unbekannt: ${aktuell}`);
    const verweis = /^var\(\s*(--[\w-]+)\s*\)$/.exec(wert);
    if (!verweis) return wert;
    aktuell = verweis[1];
  }
}

const kodiere = (c: number): number => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const dekodiere = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** `vorne` mit Deckkraft `alpha` über `hinten`, gemischt im gamma-kodierten sRGB; Ergebnis wieder linear. */
export function mische(vorne: Rgb, alpha: number, hinten: Rgb): Rgb {
  return [0, 1, 2].map((i) => dekodiere(kodiere(vorne[i]) * alpha + kodiere(hinten[i]) * (1 - alpha))) as Rgb;
}

export function luminanz(rgb: Rgb): number {
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

export function kontrast(a: Rgb, b: Rgb): number {
  const ya = luminanz(a);
  const yb = luminanz(b);
  return (Math.max(ya, yb) + 0.05) / (Math.min(ya, yb) + 0.05);
}

/** Alle Tokens eines Modus: Marke (:root), Dunkel (:root, .dark), für Hell darüber .light; je aus colors.css und signal-colors.css. */
export function modusTabelle(modus: 'dunkel' | 'hell'): Record<string, string> {
  const colors = leseText('src/tokens/colors.css');
  const signal = leseText('src/tokens/signal-colors.css');
  const tabelle: Record<string, string> = {
    ...tokenTabelle(colors, ':root'),
    ...tokenTabelle(colors, ':root, .dark'),
    ...tokenTabelle(signal, ':root, .dark'),
  };
  if (modus === 'hell') Object.assign(tabelle, tokenTabelle(colors, '.light'), tokenTabelle(signal, '.light'));
  return tabelle;
}
