// Testhilfen der Rundown-Oberflächentests (UX Welle 1, Aufgabe b): lokale Kopie von kreuz, fallText, pruefeFaelle und vergleiche aus
// packages/settings/test/hilfe.ts (dort nicht exportiert). Gezählt wird mit der @jm/ui-Testhilfe (ein Zähler je Lauf).
import { readFileSync } from 'node:fs';
import { ok } from '@jm/ui/testhilfe';

type Achsen = Record<string, readonly unknown[]>;
export type Fall<A extends Achsen> = { [K in keyof A]: A[K][number] };

/** Alle Kombinationen der Achsen (vollständiges Kreuzprodukt), in fester Reihenfolge. */
export function kreuz<A extends Achsen>(achsen: A): Array<Fall<A>> {
  let faelle: Array<Record<string, unknown>> = [{}];
  for (const [name, werte] of Object.entries(achsen)) {
    faelle = faelle.flatMap((f) => werte.map((w) => ({ ...f, [name]: w })));
  }
  return faelle as Array<Fall<A>>;
}

/** Ein Fall als lesbare Zeile, `undefined` bleibt sichtbar (JSON ließe es weg). */
export function fallText(f: Record<string, unknown>): string {
  return Object.entries(f)
    .map(([k, v]) => `${k}=${v === undefined ? 'undefined' : JSON.stringify(v)}`)
    .join(' ');
}

/** Prüft jeden Fall; eine ok-Zeile je Tabelle, bei Abweichung die ersten fünf Fälle mit ist/soll. */
export function pruefeFaelle<F extends Record<string, unknown>>(msg: string, faelle: readonly F[], pruefe: (f: F) => string | null): void {
  const abweichungen: string[] = [];
  for (const f of faelle) {
    const r = pruefe(f);
    if (r !== null) abweichungen.push(`${fallText(f)} → ${r}`);
  }
  ok(abweichungen.length === 0, `${msg} (${faelle.length} Fälle)`);
  for (const z of abweichungen.slice(0, 5)) console.log(`     ${z}`);
  if (abweichungen.length > 5) console.log(`     … und ${abweichungen.length - 5} weitere`);
}

/** Vergleich ist/soll für pruefeFaelle: null bei Gleichheit, sonst „ist: … soll: …“. */
export function vergleiche(ist: string | undefined, soll: string | undefined): string | null {
  return ist === soll ? null : `ist: ${ist ?? 'undefined'} soll: ${soll ?? 'undefined'}`;
}

// ── Kontrast aus den Tokens von @jm/ui (Fund B3 der Gesamtprüfung) ──
// Lokale Kopie der Rechnung aus packages/ui/test/lib/oklch.ts und css.ts (dort nicht exportiert): oklch → OKLab → lineares sRGB
// → Luminanz → Kontrast nach WCAG 2.x; durchscheinende Farben mischt der Browser im gamma-kodierten sRGB.
type Rgb = [number, number, number];
const klemme = (x: number): number => Math.min(1, Math.max(0, x));
const kodiere = (c: number): number => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const dekodiere = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

function oklch(wert: string): { rgb: Rgb; alpha: number } {
  const m = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+)\s*)?\)$/.exec(wert.trim());
  if (!m) throw new Error(`keine oklch-Farbe: ${wert}`);
  const L = Number(m[1]);
  const h = (Number(m[3]) * Math.PI) / 180;
  const a = Number(m[2]) * Math.cos(h);
  const b = Number(m[2]) * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return {
    rgb: [
      klemme(4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s),
      klemme(-1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s),
      klemme(-0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s),
    ],
    alpha: m[4] === undefined ? 1 : Number(m[4]),
  };
}

function bloecke(css: string, selektor: string): Record<string, string> {
  const tabelle: Record<string, string> = {};
  for (const block of css.replace(/\r\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{};]*)\{([^{}]*)\}/g)) {
    if (block[1].split(',').map((t) => t.trim()).join(', ') !== selektor) continue;
    for (const w of block[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) tabelle[w[1]] = w[2].trim().replace(/\s+/g, ' ');
  }
  return tabelle;
}

/** Alle Farb-Tokens eines Modus aus @jm/ui (colors.css, signal-colors.css), wie modusTabelle in packages/ui/test/lib/oklch.ts. */
export function tokenModus(modus: 'dunkel' | 'hell'): Record<string, string> {
  const colors = readFileSync('../../packages/ui/src/tokens/colors.css', 'utf8');
  const signal = readFileSync('../../packages/ui/src/tokens/signal-colors.css', 'utf8');
  const t = { ...bloecke(colors, ':root'), ...bloecke(colors, ':root, .dark'), ...bloecke(signal, ':root, .dark') };
  return modus === 'hell' ? { ...t, ...bloecke(colors, '.light'), ...bloecke(signal, '.light') } : t;
}

function loese(name: string, t: Record<string, string>): string {
  let akt = name;
  for (let i = 0; i < 10; i++) {
    const w = t[akt];
    if (w === undefined) throw new Error(`unbekannt: ${akt}`);
    const v = /^var\(\s*(--[\w-]+)\s*\)$/.exec(w);
    if (!v) return w;
    akt = v[1];
  }
  throw new Error(`Zyklus bei ${name}`);
}

const luminanz = (c: Rgb): number => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const mische = (vorne: Rgb, alpha: number, hinten: Rgb): Rgb => [0, 1, 2].map((i) => dekodiere(kodiere(vorne[i]) * alpha + kodiere(hinten[i]) * (1 - alpha))) as Rgb;

/** Fläche eines Tokens, optional mit Deckkraft (z. B. bg-[var(--input)]/70) über einer Unterlage. */
function flaeche(t: Record<string, string>, name: string, deckkraft = 1, unterlage?: string): Rgb {
  const f = oklch(loese(name, t));
  const alpha = f.alpha * deckkraft;
  if (alpha >= 1) return f.rgb;
  if (unterlage === undefined) throw new Error(`${name} ist durchscheinend, die Unterlage fehlt`);
  return mische(f.rgb, alpha, flaeche(t, unterlage));
}

/** Kontrast von Token `vorne` auf der Fläche `hinten` (mit Deckkraft über `unterlage`). */
export function tokenKontrast(t: Record<string, string>, vorne: string, hinten: string, deckkraft = 1, unterlage?: string): number {
  const h = flaeche(t, hinten, deckkraft, unterlage);
  const v = oklch(loese(vorne, t));
  const vv = v.alpha >= 1 ? v.rgb : mische(v.rgb, v.alpha, h);
  const [a, b] = [luminanz(vv), luminanz(h)];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
