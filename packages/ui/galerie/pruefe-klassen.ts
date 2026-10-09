// Klassen-Probe (Spec 3.10, Review Focus 1): Kommen die neuen Tokens und die Pflichtklassen der Bausteine im
// gebauten CSS an? Tailwind erzeugt eine Klasse nur, wenn es sie in einer gescannten Datei als Text findet
// (`@source`). Ein Tippfehler, ein zusammengesetzter Klassenname oder eine Datei außerhalb der Quellen fällt erst
// hier auf; im Fenster wäre der Baustein nur still ungestylt.
//
// Aufrufe (Arbeitsverzeichnis packages/ui):
//   npm run galerie:pruefen -w @jm/ui                               Galerie bauen, galerie/dist/assets/*.css prüfen
//   npx tsx galerie/pruefe-klassen.ts --css <ordner> --ohne-settings  CSS eines App-Renderers prüfen (Task 24)
//
// Diese Datei ist in galerie.css per `@source not` vom Tailwind-Scan ausgenommen: Gescannt, erzeugte Tailwind die
// gesuchten Klassen aus den Listen unten selbst, und die Probe bestünde immer.
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { abschluss, ok } from '../test/harness';

/** Die 13 neuen Token-Namen (Spec 4.2, 4.3; --field-border aus Task 10, Owner-Freigabe O3 vom 09.10.2026). */
export const NEUE_TOKENS = [
  '--tally-live',
  '--tally-ready',
  '--tally-selected',
  '--status-warn',
  '--status-error',
  '--status-off',
  '--surface-raised',
  '--field-border',
  '--header-h',
  '--statusbar-h',
  '--control-h',
  '--control-h-lg',
  '--panel-w',
] as const;

/** Pflichtklassen der Bausteine (Plan 9.7 und G7). */
export const PFLICHTKLASSEN = [
  'h-[var(--statusbar-h)]',
  'h-[var(--header-h)]',
  'h-[var(--control-h)]',
  'min-h-[var(--control-h-lg)]',
  'w-[var(--panel-w)]',
  'bg-[var(--surface-raised)]',
  'bg-[var(--tally-live)]',
  'border-[var(--tally-ready)]',
  'text-[19px]',
  'max-[900px]:sr-only',
  'max-[900px]:absolute',
  'select-text',
  'sr-only',
] as const;

/** Klassen, die Tailwind absichtlich ohne eigene Regel lässt (nur Marker für Varianten). */
const OHNE_EIGENE_REGEL = new Set(['group', 'peer']);

/** Selektoren ohne CSS-Escapes: `.h-\[var\(--x\)\]` → `.h-[var(--x)]`. */
export function selektorText(css: string): string {
  return css.replace(/\\/g, '');
}

/** Steht `klasse` als Klassenselektor im CSS (nicht nur als Anfang einer längeren Klasse)? */
export function hatKlasse(css: string, klasse: string): boolean {
  const flach = selektorText(css);
  const gesucht = `.${klasse}`;
  for (let ab = flach.indexOf(gesucht); ab >= 0; ab = flach.indexOf(gesucht, ab + 1)) {
    const danach = flach.charAt(ab + gesucht.length);
    if (danach === '' || /[\s{,:.>+~)[]/.test(danach)) return true;
  }
  return false;
}

/** Wird `name` im CSS definiert (`--name:`), nicht nur benutzt (`var(--name)`)? */
export function hatToken(css: string, name: string): boolean {
  return new RegExp(`(^|[{;\\s])${name.replace(/[-]/g, '\\-')}:`).test(css);
}

/**
 * Medienabfrage der Variante `max-[900px]:`. Tailwind 4.3 schreibt `@media (width < 900px)`; der Minifizierer im
 * `vite build` macht daraus `@media not all and (min-width:900px)` (gemessen am 08.10.2026). Beide Formen zählen.
 */
export function hatSchmalAbfrage(css: string): boolean {
  const ohne = css.replace(/\s+/g, '');
  return ohne.includes('@media(width<900px)') || ohne.includes('@medianotalland(min-width:900px)');
}

/**
 * Regel der kompakten Dichte. Der Galerie-Bau minifiziert (`[data-dichte=kompakt]{`), der Renderer-Bau der Apps mit
 * electron-vite nicht (`[data-dichte="kompakt"] {`); beides gemessen am 08.10.2026.
 */
export function hatKompaktRegel(css: string): boolean {
  return /\[data-dichte=("?)kompakt\1\]\s*\{/.test(css);
}

/** Medienabfrage der Variante `motion-safe:`. */
export function hatBewegungAbfrage(css: string): boolean {
  return css.replace(/\s+/g, '').includes('@media(prefers-reduced-motion:no-preference)');
}

/** Klassen aus `className="…"`-Literalen (nicht aus `cn(…)` oder Ausdrücken). */
export function classNameLiterale(quelltext: string): string[] {
  const klassen: string[] = [];
  for (const m of quelltext.matchAll(/className="([^"]*)"/g)) klassen.push(...m[1].split(/\s+/).filter(Boolean));
  return klassen;
}

function tsxDateien(ordner: string): string[] {
  return (readdirSync(ordner, { recursive: true }) as string[])
    .filter((d) => d.endsWith('.tsx'))
    .map((d) => join(ordner, d));
}

function klassenAus(ordner: string): Set<string> {
  const menge = new Set<string>();
  for (const datei of tsxDateien(ordner)) {
    for (const k of classNameLiterale(readFileSync(datei, 'utf8'))) if (!OHNE_EIGENE_REGEL.has(k)) menge.add(k);
  }
  return menge;
}

export interface ProbeOptionen {
  /** Ordner mit den gebauten CSS-Dateien. */
  cssOrdner: string;
  /** Auch die Klassen aus packages/settings/src verlangen (Galerie: ja, App ohne @source dorthin: nein). */
  mitSettings: boolean;
}

export function pruefeKlassen(o: ProbeOptionen): void {
  const paket = fileURLToPath(new URL('..', import.meta.url));
  let dateien: string[] = [];
  try {
    dateien = readdirSync(o.cssOrdner).filter((d) => d.endsWith('.css'));
  } catch {
    dateien = [];
  }
  ok(dateien.length > 0, `Klassen-Probe: CSS in ${o.cssOrdner} (${dateien.join(', ') || 'keine Datei'})`);
  const css = dateien.map((d) => readFileSync(join(o.cssOrdner, d), 'utf8')).join('\n');

  const ohneToken = NEUE_TOKENS.filter((t) => !hatToken(css, t));
  ok(ohneToken.length === 0, `Klassen-Probe: ${NEUE_TOKENS.length} neue Tokens definiert${ohneToken.length ? ` – fehlt: ${ohneToken.join(', ')}` : ''}`);
  ok(hatKompaktRegel(css), 'Klassen-Probe: Regel [data-dichte="kompakt"] vorhanden');
  for (const k of PFLICHTKLASSEN) ok(hatKlasse(css, k), `Klassen-Probe: Pflichtklasse ${k}`);
  ok(hatSchmalAbfrage(css), 'Klassen-Probe: Medienabfrage für max-[900px] (Schmal-Ansicht)');
  ok(hatBewegungAbfrage(css), 'Klassen-Probe: Medienabfrage für motion-safe');

  const ui = klassenAus(join(paket, 'src'));
  const uiFehlt = [...ui].filter((k) => !hatKlasse(css, k));
  ok(uiFehlt.length === 0, `Klassen-Probe: ${ui.size} Klassen aus className="…" in packages/ui/src im CSS${uiFehlt.length ? ` – fehlt: ${uiFehlt.join(' ')}` : ''}`);
  if (o.mitSettings) {
    const settings = klassenAus(resolve(paket, '../settings/src'));
    const fehlt = [...settings].filter((k) => !hatKlasse(css, k));
    ok(fehlt.length === 0, `Klassen-Probe: ${settings.size} Klassen aus className="…" in packages/settings/src im CSS${fehlt.length ? ` – fehlt: ${fehlt.join(' ')}` : ''}`);
    // Tailwind scannt Text, nicht nur className: verglichen wird mit dem ganzen Quelltext von ui/src und Galerie.
    const anderswo = [
      ...(readdirSync(join(paket, 'src'), { recursive: true }) as string[]).map((d) => join(paket, 'src', d)),
      ...readdirSync(join(paket, 'galerie')).filter((d) => d !== 'pruefe-klassen.ts').map((d) => join(paket, 'galerie', d)),
    ]
      .filter((d) => /\.(tsx?|html)$/.test(d))
      .map((d) => readFileSync(d, 'utf8'))
      .join('\n');
    // Ganze Wörter vergleichen: „pl-2“ steht als Text auch in „pl-20“, ist aber eine andere Klasse.
    const woerter = new Set(anderswo.split(/[\s"'`]+/));
    const nurSettings = [...settings].filter((k) => !woerter.has(k));
    console.log(`Hinweis: ${nurSettings.length} davon stehen nur in packages/settings/src (${nurSettings.join(' ') || '–'}); nur sie zeigen ein fehlendes @source "../../settings/src".`);
  }
}

const direkt = process.argv[1] !== undefined && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (direkt) {
  const argumente = process.argv.slice(2);
  const i = argumente.indexOf('--css');
  const cssOrdner = i >= 0 && argumente[i + 1] ? resolve(argumente[i + 1]) : fileURLToPath(new URL('./dist/assets', import.meta.url));
  pruefeKlassen({ cssOrdner, mitSettings: !argumente.includes('--ohne-settings') });
  abschluss();
}
