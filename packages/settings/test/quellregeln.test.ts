// Statische Quellregeln für packages/settings/src (Plan G3–G5, G7, G8; Spec 3.8, 6, 6.1).
// Wächst automatisch mit: Jede neue Datei unter src/ wird geprüft.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { leseText, ok } from '@jm/ui/testhilfe';

function dateien(ordner: string): string[] {
  return readdirSync(ordner, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? dateien(join(ordner, e.name)) : /\.tsx?$/.test(e.name) ? [join(ordner, e.name).replace(/\\/g, '/')] : [],
  );
}
const QUELLEN = dateien('src');
const TEXT = new Map(QUELLEN.map((p) => [p, leseText(p)] as const));
const UI_TOKENS = ['colors.css', 'typography.css', 'signal-colors.css', 'sizes.css'];

/** Alle Dateien, in denen `re` außerhalb von Kommentaren trifft (Block- und ganze Zeilenkommentare zählen nicht). */
function treffer(re: RegExp, nur: (p: string) => boolean = () => true): string[] {
  const aus: string[] = [];
  for (const [p, t] of TEXT) {
    if (!nur(p)) continue;
    const code = t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    if (re.test(code)) aus.push(p);
    re.lastIndex = 0;
  }
  return aus;
}
function regel(liste: string[], msg: string): void {
  ok(liste.length === 0, msg);
  if (liste.length > 0) console.log(`     in: ${liste.join(', ')}`);
}

ok(QUELLEN.includes('src/vertrag.ts') && QUELLEN.includes('src/SectionFrame.tsx'), `Quellregel settings: Dateiliste gelesen (${QUELLEN.length} Dateien)`);

regel(
  treffer(/\b(bg|text|border|ring|outline|fill|stroke|from|to|via)-(red|green|yellow|orange|amber|lime|emerald|neutral|gray|zinc|slate|stone|white|black)\b/),
  'Quellregel settings: keine rohen Farbklassen',
);
// Dieselben Muster wie die Quellregeln in packages/ui (Task 3): `var(--…${`, `prefix-${`, `prefix-[…${`.
const UTILITY =
  'bg|text|border|ring|outline|fill|stroke|h|w|min-h|min-w|max-h|max-w|p[xytrbl]?|m[xytrbl]?|gap|rounded|top|left|right|bottom|inset|z|opacity|duration|leading|tracking|font|grid-cols|col-span';
regel(
  [
    ...treffer(/var\(--[\w-]*\$\{/),
    ...treffer(new RegExp(`\\b(${UTILITY})-\\$\\{`)),
    ...treffer(new RegExp(`\\b(${UTILITY})-\\[[^\\]\\s]*\\$\\{`)),
  ],
  'Quellregel settings: keine zusammengesetzten Klassen',
);
// Wie Regel 9 in packages/ui (Task 3): Tailwind v4 kennt die Kurzform `bg-(--x)` für `bg-[var(--x)]`; sie liefe an den
// Regeln vorbei, die `var(--` suchen.
regel(treffer(/\b[\w:-]+-\(\s*--/), 'Quellregel settings: Tokens nur als …-[var(--…)], keine Kurzform …-(--…) (Tailwind v4)');
{
  const definiert = new Set<string>();
  for (const datei of UI_TOKENS) {
    for (const m of leseText(`../ui/src/tokens/${datei}`).matchAll(/(--[a-z0-9-]+)\s*:/g)) definiert.add(m[1]);
  }
  const fehlt: string[] = [];
  for (const [p, t] of TEXT) {
    const code = t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    // Wie in packages/ui: der Name bis zum ersten Zeichen, das kein Namenszeichen ist (auch `var(--status-${…}`).
    for (const m of code.matchAll(/var\(\s*(--[\w-]+)/g)) if (!definiert.has(m[1])) fehlt.push(`${p}: ${m[1]}`);
  }
  ok(definiert.has('--control-h') && definiert.has('--status-error'), 'Quellregel settings: Token-Liste aus @jm/ui gelesen (neue Tokens enthalten)');
  regel(fehlt, 'Quellregel settings: jede var(--…) ist in @jm/ui definiert');
}
regel(
  treffer(/\b(window|document|navigator|globalThis)\b|from ['"](electron|node:[^'"]+)['"]|require\(|\bprocess\./),
  'Quellregel settings: kein window/document/navigator/globalThis, kein electron-, node:-Import, kein process. (Spec 3.8)',
);
regel(treffer(/localStorage|sessionStorage/), 'Quellregel settings: kein localStorage');
regel(treffer(/text-\[var\(--(tally|status)-/), 'Quellregel settings: Statusfarben nie als Schrift (nur Symbole, Ränder, Flächen)');
regel(treffer(/var\(--highlight\)/), 'Quellregel settings: kein --highlight (E23)');
regel(
  [
    ...treffer(/\banimate-|(?<!motion-safe:)(?<!motion-reduce:)\btransition(-[a-z]+)?\b(?=[\s'"`])/),
    ...treffer(/motion-reduce:(?!transition-none\b)/),
    // Dauer wie in packages/ui (Task 3, G8): duration-<n> höchstens 150, kein duration-[…]
    ...treffer(/\bduration-\[|\bduration-(?:15[1-9]|1[6-9]\d|[2-9]\d\d|\d{4,})\b/),
  ],
  'Quellregel settings: Übergänge nur motion-safe und höchstens 150 ms (motion-reduce nur als transition-none für den Bestands-Button), kein animate-',
);
regel(treffer(/import\s+(?!type\b)[^;]*from\s+['"]@jm\/control-config['"]/), 'Quellregel settings: @jm/control-config nur per import type');
{
  // Spec 6.1: Texte fest im Paket. Als Text-Prop gilt jede Prop der Abschnitts-Props, deren Name auf
  // titel/title/text/texte/label/labels endet (jeder Typ, also auch `backLabel`), und jede Prop vom Typ string, die
  // nicht in DATEN steht (Namen, Werte, Pfade und Zeitstempel des Tools). Ausgenommen sind nur die drei fertigen Texte
  // der App aus E25. Eine neue string-Prop muss also bewusst als Daten-Prop eingetragen werden.
  const DATEN = new Set([
    'NdiOutputSectionProps.sourceName', 'NdiOutputSectionProps.networkName', 'NdiOutputSectionProps.resolution',
    'NdiOutputSectionProps.fps', 'ScreenOutputSectionProps.background', 'RemoteControlSectionProps.companionModule',
    'IveoSectionProps.eventName', 'IveoSectionProps.stage', 'IveoSectionProps.staleSince',
    'DataLinkSectionProps.folder', 'DataLinkSectionProps.lastChange',
  ]);
  const AUSNAHMEN = new Set(['DataLinkSectionProps.sourceLine', 'DataLinkSectionProps.notice', 'DataLinkSectionProps.backLabel']);
  const mitText: string[] = [];
  for (const [p, t] of TEXT) {
    for (const m of t.matchAll(/export interface (\w+SectionProps) extends SectionInput \{([\s\S]*?)\n\}/g)) {
      for (const prop of m[2].matchAll(/(?:^|[;{\n])\s*(\w+)\??\s*(?::\s*([^;\n]*)|\()/g)) {
        const name = `${m[1]}.${prop[1]}`;
        const nachName = /(titel|title|text|texte|label|labels)$/i.test(prop[1]);
        const freierText = /^string\b/.test((prop[2] ?? '').trim()) && !DATEN.has(name);
        if ((nachName || freierText) && !AUSNAHMEN.has(name)) mitText.push(`${p}: ${name}`);
      }
    }
  }
  regel(mitText, 'Quellregel settings: keine Text-Prop in den Abschnitts-Props (Name …titel/…text/…label oder string außerhalb der Daten-Liste) außer E25 (Spec 6.1)');
}
regel(
  treffer(/(?<![=-])>\s*[A-Za-zÄÖÜäöüß][^<>{}]*[<{]/, (p) => p.endsWith('.tsx')),
  'Quellregel settings: keine festen Texte in .tsx (Texte stehen in vertrag.ts bzw. …_TEXTE)',
);
