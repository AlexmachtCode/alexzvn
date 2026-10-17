// ─────────────────────────────────────────────────────────────────────────────
// Funktionsliste nach dem Umbau (Spec 10, Aufgabe C13). Jede der 103 Zeilen in den Abschnitten 1–7 von
// docs/ux/funktionslisten/titler.md ist in „künftig wo“ abgehakt: „✓ “ und ein Ort des Ortsregisters, „unverändert (…)“,
// „entfällt (…, E…/OF…)“ oder „ersetzt durch {Ort} (…, E…/OF…)“. Jede genannte Datei existiert, Groß- und
// Kleinschreibung wie im Repo. Dazu zwei Querprüfungen gegen den Code (persistId in der Bedienung, die vier Abläufe in
// OperatorView, G8). Läuft im Paketordner apps/titler (npm run selftest -w @jm/titler, zweiter Lauf).
// ─────────────────────────────────────────────────────────────────────────────

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { gleich, leseText, ok } from '@jm/ui/testhilfe';

const LISTE = '../../docs/ux/funktionslisten/titler.md';

/** Ortsregister des Plans; „Einstellungen (Panel)“ steht für Regeln, die in jedem Abschnitt des Panels gelten. */
const ORTE: readonly string[] = [
  'Kopfzeile links (Logo, JM Titler)',
  'Kopfzeile Mitte (Show vom Master)',
  'Kopfzeile rechts (ON AIR)',
  'Kopfzeile rechts (Hell/Dunkel)',
  'Kopfzeile rechts (⚙)',
  'Live-Bereich › Vorschau',
  ...['Take', 'Clear', '◀ Eintrag', 'Eintrag ▶'].map((t) => `Live-Bereich › Haupttasten › ${t}`),
  'Live-Bereich › Hinweiszeile',
  ...['Vorlage', 'Inhalt', 'Grafik-Vorlagen', 'Daten / Recall'].map((b) => `Bedienung › ${b}`),
  'Einstellungen (Panel)',
  ...['iveo', 'NDI-Ausgabe', 'Ausgabe auf Bildschirm', 'Fernsteuerung', 'DataLink', 'Stil', 'Grafik-Vorlagen'].map(
    (a) => `Einstellungen › ${a}`,
  ),
  ...['Master', 'iveo', 'NDI', 'Bildschirm', 'Fernsteuerung', 'DataLink'].map((e) => `Statusleiste › ${e}`),
  'Recall-Board',
  'Ausgabefenster',
];

/** Zeilen je Abschnitt 1–7, wie C1 die Liste anlegt. */
const JE_ABSCHNITT = [60, 12, 12, 7, 1, 5, 6];

/** Datei in Backticks: Pfad mit Endung, aufgelöst nach der Pfadregel im Kopf der Liste. */
const PFAD = /`([A-Za-z0-9_./-]+\.(?:tsx|ts|css|html|json|md|mjs))`/g;
const VERWEIS = /\b(?:E\d+|OF\d+)\b/;

interface Zeile {
  abschnitt: number;
  nr: number;
  zellen: string[];
}

function zeilen(text: string): Zeile[] {
  const liste: Zeile[] = [];
  let abschnitt = 0;
  for (const z of text.split('\n')) {
    const kopf = /^## (\d+) · /.exec(z);
    if (kopf) {
      abschnitt = Number(kopf[1]);
      continue;
    }
    const nr = /^\| (\d+) \|/.exec(z);
    if (nr && abschnitt >= 1 && abschnitt <= 7) {
      liste.push({ abschnitt, nr: Number(nr[1]), zellen: z.split('|').slice(1, -1).map((s) => s.trim()) });
    }
  }
  return liste;
}

/** Pfadregel der Liste: Repo-Wurzel, apps/titler/src, @jm/app-runtime, Bausteine von @jm/ui oder der Renderer. */
function aufgeloest(pfad: string): string {
  if (/^(?:apps|packages|docs)\//.test(pfad)) return `../../${pfad}`;
  if (/^(?:main|preload|shared|utility|renderer)\//.test(pfad)) return `src/${pfad}`;
  if (pfad.startsWith('app-runtime/')) return `../../packages/app-runtime/src/${pfad.slice('app-runtime/'.length)}`;
  if (pfad.startsWith('ui/')) return `../../packages/ui/src/components/${pfad.slice('ui/'.length)}`;
  return `src/renderer/src/${pfad}`;
}

/** Gibt es die Datei mit genau dieser Schreibweise? Jeder Pfadteil wird mit dem Verzeichnisinhalt verglichen. */
function gibtEs(pfad: string): boolean {
  let ort = '';
  for (const teil of aufgeloest(pfad).split('/')) {
    if (teil !== '..') {
      try {
        if (!readdirSync(ort === '' ? '.' : ort).includes(teil)) return false;
      } catch {
        return false;
      }
    }
    ort = ort === '' ? teil : `${ort}/${teil}`;
  }
  return existsSync(ort);
}

/** Ort am Anfang des Texts: ein Eintrag des Ortsregisters, danach Leerzeichen, Doppelpunkt, Komma oder das Ende. */
function ortAm(text: string): string | undefined {
  return ORTE.find((o) => text.startsWith(o) && /^(?:[ :,]|$)/.test(text.slice(o.length)));
}

/** null = Zeile abgehakt; sonst der erste Grund, warum nicht. */
function zeilenFehler(z: Zeile): string | null {
  if (z.zellen.length !== 7) return `${z.zellen.length} statt 7 Spalten`;
  const k = z.zellen[6];
  if (!k.startsWith('✓ ')) return '„künftig wo“ ohne Haken';
  const rest = k.slice(2);
  const ohneCode = k.replace(/`[^`]*`/g, '');
  if (ohneCode.includes('"')) return 'ASCII-Anführungszeichen';
  let form: string | undefined;
  if (rest.startsWith('unverändert (')) form = 'unverändert';
  else if (rest.startsWith('entfällt (')) form = 'entfällt';
  else if (rest.startsWith('ersetzt durch ')) form = ortAm(rest.slice('ersetzt durch '.length)) && 'ersetzt durch';
  else form = ortAm(rest);
  if (form === undefined) return `Ort nicht aus dem Ortsregister: ${rest.slice(0, 40)}`;
  if (form === 'ersetzt durch' && !VERWEIS.test(ohneCode)) return '„ersetzt durch“ ohne E- oder OF-Verweis';
  if (ohneCode.includes('entfällt') && !VERWEIS.test(ohneCode)) return '„entfällt“ ohne E- oder OF-Verweis';
  const pfade = [...k.matchAll(PFAD)].map((m) => m[1]);
  if (form !== 'entfällt' && pfade.length === 0) return 'Ort ohne Datei';
  const fehlt = pfade.filter((p) => !gibtEs(p));
  return fehlt.length > 0 ? `Datei fehlt: ${fehlt.join(', ')}` : null;
}

const alle = zeilen(leseText(LISTE));

gleich(alle.length, 103, 'Funktionsliste: 103 Zeilen in den Abschnitten 1–7 (Stand C1)');
gleich(
  JE_ABSCHNITT.map((_, i) => alle.filter((z) => z.abschnitt === i + 1).length),
  JE_ABSCHNITT,
  'Funktionsliste: Zeilen je Abschnitt wie in C1 (60/12/12/7/1/5/6)',
);
gleich(
  alle.map((z) => z.nr),
  alle.map((_, i) => i + 1),
  'Funktionsliste: Nummern fortlaufend ab 1',
);

for (const z of alle) {
  const f = zeilenFehler(z);
  ok(f === null, `Funktionsliste Nr. ${z.nr} abgehakt${f === null ? '' : ` – ${f}`}`);
}

const zeile = (nr: number): Zeile | undefined => alle.find((z) => z.nr === nr);
const kuenftig = (nr: number): string => zeile(nr)?.zellen[6] ?? '';
const quelle = (pfad: string): string => (gibtEs(pfad) ? readFileSync(aufgeloest(pfad), 'utf8') : '');

ok(
  kuenftig(7).startsWith('✓ Live-Bereich › Haupttasten › Take (') && kuenftig(7).includes('`views/LiveBereich.tsx`'),
  'Funktionsliste Nr. 7 (Take): Live-Bereich › Haupttasten › Take in views/LiveBereich.tsx',
);
// Die Kürzel des Electron-Standardmenüs gehören zu Nr. 93 (vor und nach dem Umbau), die Wirkung von Strg+R zu Nr. 97,
// gemessen in Abnahme 5c (OF11). Fällt das Menü aus einer Spalte, ist die Pflichtzeile nicht mehr vollständig.
ok(
  zeile(93)?.zellen[1] === 'Tastenkürzel' &&
    ['Electron-Standardmenü', 'Strg+R'].every((w) => (zeile(93)?.zellen[2] ?? '').includes(w)) &&
    kuenftig(93).startsWith('✓ ') &&
    kuenftig(93).includes('keine') &&
    kuenftig(93).includes('Electron-Standardmenü'),
  'Funktionsliste Nr. 93 (Pflichtzeile Tastenkürzel): abgehakt, keine eigenen Kürzel, das Electron-Standardmenü vor und nach dem Umbau genannt (Spec 10, UO5, OF11)',
);
ok(
  ['Standardmenü', 'Strg+R', 'Abnahme 5c'].every((w) => (zeile(97)?.zellen[2] ?? '').includes(w)) &&
    kuenftig(97).startsWith('✓ ') &&
    ['Electron-Standardmenü', 'Strg+R', 'Abnahme 5c'].every((w) => kuenftig(97).includes(w)),
  'Funktionsliste Nr. 97 (Menü): Electron-Standardmenü und die Wirkung von Strg+R genannt, gemessen in Abnahme 5c (OF11)',
);
ok(
  zeile(96)?.zellen[1] === 'Pflichtpunkt Panel' &&
    kuenftig(96).startsWith('✓ ') &&
    ['Leertaste', 'Escape', 'Feld', 'Schalter'].every((w) => kuenftig(96).includes(w)),
  'Funktionsliste Nr. 96 (Pflichtpunkt Panel): Leertaste und Escape, je für Feld und Schalter (Spec 10, O1)',
);

for (const [nr, id] of [
  [99, 'titler.graphics'],
  [100, 'titler.recall'],
] as const) {
  ok(
    (zeile(nr)?.zellen[2] ?? '').includes(`jm.collapsible.${id}`) &&
      kuenftig(nr).startsWith('✓ Bedienung › ') &&
      kuenftig(nr).includes(`\`${id}\``) &&
      kuenftig(nr).includes('`views/Bedienung.tsx`') &&
      quelle('views/Bedienung.tsx').includes(id),
    `Funktionsliste Nr. ${nr}: gleiche persistId ${id}, steht in views/Bedienung.tsx`,
  );
}

for (const [wort, imCode] of [
  ['remote.onCommand', 'remote.onCommand'],
  ['onFileOpened', 'onFileOpened'],
  ['remote.reportState', 'reportState'],
  ['listDisplays()', 'listDisplays'],
] as const) {
  const z = alle.find((x) => x.abschnitt === 3 && x.zellen[3].includes(wort));
  ok(
    z !== undefined &&
      z.zellen[6].includes('`views/OperatorView.tsx`') &&
      quelle('views/OperatorView.tsx').includes(imCode),
    `Funktionsliste: ${wort} bleibt in OperatorView, wirkt bei geschlossenem Panel (G8)`,
  );
}
