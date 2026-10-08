// Task 3 · Quellregeln für jede neue Datei unter src/ (G3, G4, G7, G8). neueQuellen() findet jede neue Datei von
// selbst; die Regeln wachsen also mit jeder späteren Aufgabe mit. Geprüft wird der Text ohne Kommentare.
import { leseCustomProperties } from './lib/css';
import { neueQuellen } from './lib/quellen';
import { leseText, ok } from './harness';

/** Kommentare entfernen, Zeilennummern bleiben gleich (Blockkommentare werden zu Leerzeichen und Zeilenumbrüchen). */
function ohneKommentare(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (kommentar) => kommentar.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:\\])\/\/.*$/gm, '$1');
}

const quellen = neueQuellen();
const code = quellen.filter((pfad) => /\.tsx?$/.test(pfad));

/** Alle Treffer als `pfad:zeile: treffer`. */
function suche(dateien: readonly string[], muster: RegExp, ausnahme?: string): string[] {
  const global = new RegExp(muster.source, muster.flags.includes('g') ? muster.flags : `${muster.flags}g`);
  const treffer: string[] = [];
  for (const pfad of dateien) {
    if (pfad === ausnahme) continue;
    ohneKommentare(leseText(pfad))
      .split('\n')
      .forEach((zeile, i) => {
        for (const m of zeile.matchAll(global)) treffer.push(`${pfad}:${i + 1}: ${m[0]}`);
      });
  }
  return treffer;
}

function regel(treffer: readonly string[], msg: string): void {
  ok(treffer.length === 0, msg);
  for (const zeile of treffer) console.log(`     ${zeile}`);
}

ok(
  quellen.includes('src/tokens/signal-colors.css') &&
    quellen.includes('src/tokens/sizes.css') &&
    !quellen.includes('src/components/Button.tsx') &&
    !quellen.includes('src/base.css') &&
    !quellen.includes('src/index.ts'),
  'Quellregel: neueQuellen findet die neuen Dateien, nicht den Bestand',
);

const UTILITY =
  'bg|text|border|ring|outline|fill|stroke|h|w|min-h|min-w|max-h|max-w|p[xytrbl]?|m[xytrbl]?|gap|rounded|top|left|right|bottom|inset|z|opacity|duration|leading|tracking|font|grid-cols|col-span';

const ROHE_FARBKLASSE =
  /\b(bg|text|border(?:-[xytrblse])?|ring|ring-offset|outline|fill|stroke|from|to|via|divide|placeholder|decoration|accent|caret|shadow|inset-shadow|inset-ring|drop-shadow)-(red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone|white|black|transparent|current)\b/;

// Die Muster selbst werden geprüft: Fälle, die anschlagen müssen, und solche, die nie anschlagen dürfen.
for (const klasse of [
  'bg-red-500',
  'bg-sky-500',
  'text-violet-400',
  'border-blue-600',
  'ring-rose-500',
  'divide-neutral-800',
  'placeholder-gray-500',
  'border-t-teal-400',
  'decoration-pink-300',
  'accent-indigo-500',
  'caret-cyan-400',
  'shadow-fuchsia-500',
  'text-white',
  'bg-transparent',
  'hover:bg-purple-600',
]) {
  ok(ROHE_FARBKLASSE.test(klasse), `Quellregel-Muster: rohe Farbklasse ${klasse} wird erkannt`);
}
for (const klasse of ['bg-[var(--surface)]', 'text-[var(--text-muted)]', 'border-[var(--border)]', 'shadow-sm', 'text-sm']) {
  ok(!ROHE_FARBKLASSE.test(klasse), `Quellregel-Muster: ${klasse} ist keine rohe Farbklasse`);
}

regel(suche(code, ROHE_FARBKLASSE), 'Quellregel: keine rohen Farbklassen');

regel(
  [
    ...suche(code, /var\(--[\w-]*\$\{/),
    ...suche(code, new RegExp(`\\b(${UTILITY})-\\$\\{`)),
    ...suche(code, new RegExp(`\\b(${UTILITY})-\\[[^\\]\\s]*\\$\\{`)),
  ],
  'Quellregel: keine zusammengesetzten Klassen',
);

// Ein Token darf in einer Klasse nur als `var(--name)` stehen. Alles andere umgeht die Regeln, die `var(--` suchen:
// die v4-Kurzform `bg-(--x)`, die Kurzform mit Typ-Hinweis `bg-(color:--x)` und die v3-Form `bg-[--x]` (ungültiges CSS).
const TOKEN_OHNE_VAR = /(?<!var)[[(:,]\s*--[a-z]/;

for (const klasse of [
  'bg-(--x)',
  'bg-(color:--highlight)',
  'h-(length:--control-hx)',
  'bg-[--tally-live]',
  'h-[--control-h]',
  'hover:text-(color:--status-warn)',
]) {
  ok(TOKEN_OHNE_VAR.test(klasse), `Quellregel-Muster: Token ohne var() ${klasse} wird erkannt`);
}
for (const klasse of ['bg-[var(--surface)]', 'h-[var(--control-h)]', 'bg-[color:var(--surface)]', 'p-[calc(var(--a)+var(--b))]']) {
  ok(!TOKEN_OHNE_VAR.test(klasse), `Quellregel-Muster: ${klasse} ist korrekt`);
}

regel(suche(code, TOKEN_OHNE_VAR), 'Quellregel: Tokens nur als var(--…), nie …-(--…), …-(typ:--…) oder …-[--…] (Tailwind v4)');

{
  const definiert = new Set(
    ['src/tokens/colors.css', 'src/tokens/typography.css', 'src/tokens/signal-colors.css', 'src/tokens/sizes.css']
      .flatMap((pfad) => leseCustomProperties(leseText(pfad)))
      .flatMap((block) => Object.keys(block.werte)),
  );
  const fehlend = suche(quellen, /var\(\s*--[\w-]+/).filter((treffer) => {
    const name = treffer.slice(treffer.lastIndexOf('var(') + 4).trim();
    return !definiert.has(name);
  });
  regel(fehlend, 'Quellregel: jede var(--…) ist definiert');
}

regel(
  [
    ...suche(code, /\bwindow\.jm/),
    ...suche(code, /(from\s+|import\s*\(\s*|require\s*\(\s*)['"](electron|electron\/[^'"]*|@electron[^'"]*|node:[^'"]*)['"]/),
    ...suche(code, /\bipcRenderer\b/),
    ...suche(code, /\bprocess\./),
  ],
  'Quellregel: kein window.jm, kein electron-, node:-Import, kein process.',
);

regel(suche(quellen, /\blocalStorage\b/, 'src/lib/theme.ts'), 'Quellregel: localStorage nur in src/lib/theme.ts');

regel(
  suche(quellen, /text-\[var\(--(tally|status)-/, 'src/lib/status.ts'),
  'Quellregel: Statusfarben als Schrift nur in STATUS_SYMBOL_KLASSE (src/lib/status.ts)',
);

regel(
  suche(code, /var\(--highlight\)/),
  'Quellregel: kein --highlight in neuen Bausteinen (Gelb heißt nur „ausgewählt“; gedämpfte Schrift darauf 3,60 : 1, E23)',
);

regel(
  [
    ...suche(code, /(?<!motion-safe:)\btransition\b/),
    ...suche(code, /\banimate-/),
    ...suche(code, /\bduration-\[/),
    ...suche(code, /\bduration-(\d+)/).filter((treffer) => Number(treffer.slice(treffer.lastIndexOf('-') + 1)) > 150),
  ],
  'Quellregel: Übergänge nur motion-safe und höchstens 150 ms, kein animate-',
);
