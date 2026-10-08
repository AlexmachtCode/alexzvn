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

regel(
  suche(
    code,
    /\b(bg|text|border|ring|outline|fill|stroke|from|to|via)-(red|green|yellow|orange|amber|lime|emerald|neutral|gray|zinc|slate|stone|white|black)\b/,
  ),
  'Quellregel: keine rohen Farbklassen',
);

regel(
  [
    ...suche(code, /var\(--[\w-]*\$\{/),
    ...suche(code, new RegExp(`\\b(${UTILITY})-\\$\\{`)),
    ...suche(code, new RegExp(`\\b(${UTILITY})-\\[[^\\]\\s]*\\$\\{`)),
  ],
  'Quellregel: keine zusammengesetzten Klassen',
);

// Tailwind v4 kennt die Kurzform `bg-(--x)` für `bg-[var(--x)]`. Sie liefe an allen Regeln vorbei, die `var(--` suchen.
regel(suche(code, /\b[\w:-]+-\(\s*--/), 'Quellregel: Tokens nur als …-[var(--…)], keine Kurzform …-(--…) (Tailwind v4)');

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
