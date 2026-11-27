// ─────────────────────────────────────────────────────────────────────────────
// Funktionsliste nach dem Umbau (UX Welle 2a, Interpreter e; Spec 10 „Kein Funktionsverlust“). Jede der 86 Zeilen in den
// Abschnitten 1–7 von docs/ux/funktionslisten/interpreter.md ist in „künftig wo“ abgehakt: „✓ “ und ein Ort des Ortsregisters,
// „unverändert (…)“, „entfällt (…, E…)“ oder „ersetzt durch {Ort} (…, E…)“. E-Verweise nur auf E1–E16 dieses Plans. Jede
// genannte Datei existiert, Groß- und Kleinschreibung wie im Repo. Dazu Querprüfungen gegen den Code: die Änderungen der
// Aufgaben 29–31 (Brücke, Statuseinträge, Haupttaste, Wahlen, Hinweise, Tokens, Kopf) stehen als Haken in den betroffenen Zeilen,
// und der Code trägt, was der Haken sagt. Die Einleitungen und die Abschnitte 8–10 sagen nichts, was der neue Aufbau widerlegt.
// Läuft im Paketordner apps/interpreter (npm run selftest -w @jm/interpreter).
// „unverändert (…)“ darf keine Datei nennen, die seit der Erhebung (d7cdd79ce0) geändert wurde, außer sie bekam nur die lesenden
// Brücken (E2): dann steht der Hinweis im Haken; oder ein Altfehler der Stufe 2 hat sie geändert: dann steht „Altfehler <ID>“ im
// Haken, und die Liste der ID in ALTFEHLER nennt die Datei (C8, R6). Der Abgleich der statischen Liste GEAENDERT mit git läuft nur mit
// JM_FUNKTIONSLISTE_GIT=1 (Arbeitsbaum gegen die Erhebung, damit auch eine noch nicht eingecheckte Datei zählt).
// ─────────────────────────────────────────────────────────────────────────────

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { gleich, leseText, ok } from '@jm/ui/testhilfe';
import { DEFAULT_SETTINGS } from '@shared/ducking';
import { START_FRIST_TEXT } from '@/core/engine';
import { DUCKING_REGLER, geraeteAbschnitt, hauptTaste, INTERPRETER_TEXTE, kopfOnAir, statusLeiste, VORVERSTAERKUNG_REGLER } from '@/lib/oberflaeche';
import { DUCKING_VORGABEN } from '@/store/settings';
import { selectOptionen } from '../../../../packages/ui/src/lib/eingabe';
import { einst, geraete, motor, stand } from './testzustand';

const LISTE = '../../docs/ux/funktionslisten/interpreter.md';

/**
 * Ortsregister: Rahmen, Kopf, Live-Bereich (Haupttaste, Meter, Ducking-Pille, Überbrückt-Anzeige, Kabelkarten), Statusleiste,
 * Panel je Abschnitt. Der Main, die Engine und das Unveränderte stehen als „unverändert (…)“ (der Interpreter hat keinen Tray).
 */
const ABSCHNITTE = ['Audiogerät', 'Ducking'];
const ORTE: readonly string[] = [
  'Rahmen',
  'Kopf',
  'Live-Bereich',
  'Live-Bereich Haupttaste',
  'Live-Bereich Meter',
  'Live-Bereich Pille',
  'Live-Bereich Überbrückt-Anzeige',
  'Live-Bereich Kabelkarten',
  'Statusleiste',
  'Panel',
  ...ABSCHNITTE.map((a) => `Panel ${a}`),
];

/** Zeilen insgesamt und je Abschnitt 1–7, wie die Liste im Kopf sie nennt (Stand 076c660fc7). */
const GESAMT = 86;
const JE_ABSCHNITT = [39, 7, 29, 0, 1, 5, 5];

const ERHEBUNG = 'd7cdd79ce0';

/**
 * Alle Dateien von apps/interpreter, die seit der Erhebung geändert, angelegt oder gelöscht wurden, als Pfad ab der Repo-Wurzel.
 * Ein „unverändert (…)“ darf sie nur nennen, wenn der Haken E2 nennt und die Datei nur die lesenden Brücken bekam
 * (NUR_MELDUNG). Mit JM_FUNKTIONSLISTE_GIT=1 prüft der Test unten, dass git dieselbe Menge kennt.
 */
const GEAENDERT = [
  'package.json',
  'src/preload/index.ts',
  'src/renderer/src/App.tsx',
  'src/renderer/src/core/engine.ts',
  'src/renderer/src/globals.css',
  'src/renderer/src/lib/aktionen.ts',
  'src/renderer/src/lib/bruecken.ts',
  'src/renderer/src/lib/oberflaeche.ts',
  'src/renderer/src/store/settings.ts',
  'src/renderer/src/views/Einstellungen.tsx',
  'src/renderer/src/views/InterpreterOberflaeche.tsx',
  'src/renderer/src/views/LiveBereich.tsx',
  'src/shared/api.ts',
  'test/ui/bruecken.test.ts',
  'test/ui/engine.test.ts',
  'test/ui/funktionsliste.test.ts',
  'test/ui/hilfe.ts',
  'test/ui/live.test.tsx',
  'test/ui/oberflaeche.test.ts',
  'test/ui/panel.test.tsx',
  'test/ui/rahmen.test.tsx',
  'test/ui/selftest.ts',
  'test/ui/store.test.ts',
  'test/ui/testzustand.ts',
  'test/ui/werkzeug.test.tsx',
  'tsconfig.node.json',
  'tsconfig.test.json',
].map((p) => `apps/interpreter/${p}`);

/** Dateien, die nur die lesenden Brücken (E2) bekamen oder sind: der Preload, der Vertrag dazu und die Quelle im Renderer. */
const NUR_MELDUNG = new Set(['apps/interpreter/src/preload/index.ts', 'apps/interpreter/src/shared/api.ts', 'apps/interpreter/src/renderer/src/lib/bruecken.ts']);

/**
 * Altfehler Stufe 2 (Plan 2026-11-26, Task 2; C8): je erlaubter Interpreter-ID die Dateien (ab der Repo-Wurzel), die der Befund
 * geändert hat, wie im Player (Ruling R6). „Altfehler <ID>“ im Haken entlastet ein „unverändert (…)“, das eine geänderte Datei nennt,
 * nur, wenn die Liste dieser ID die Datei enthält; dann für die ganze Änderung des Befunds, nicht nur für lesende Brücken. Erlaubt sind
 * genau die zwei Interpreter-IDs IN-3 (Startsperre mit Frist) und IN-8 (Zurücksetzen ohne Vorverstärkungen).
 */
const ALTFEHLER = new Map<string, readonly string[]>([
  ['IN-3', ['core/engine.ts', 'lib/oberflaeche.ts'].map((p) => `apps/interpreter/src/renderer/src/${p}`)],
  ['IN-8', ['store/settings.ts'].map((p) => `apps/interpreter/src/renderer/src/${p}`)],
]);
/** Verweis „Altfehler <ID>“ auf eine der erlaubten IDs; die ID steht in Gruppe 1. */
const ALTFEHLER_VERWEIS = new RegExp(`\\bAltfehler (${[...ALTFEHLER.keys()].join('|')})(?![\\w-])`, 'g');
/** Die Altfehler-IDs, die ein Text (ohne Code) als Verweis nennt. */
const altfehlerIds = (text: string): string[] => [...text.matchAll(ALTFEHLER_VERWEIS)].map((m) => m[1]);
/** Entlastet einer der Verweise die Datei (kanonischer Pfad)? */
const entlastet = (ids: readonly string[], datei: string): boolean => ids.some((id) => ALTFEHLER.get(id)?.includes(datei) === true);

const GEAENDERT_KANON = new Set(GEAENDERT);

/** Alle seit der Erhebung geänderten Dateien des Repos laut git (Arbeitsbaum); null, wenn der Klon keinen Verlauf hat. */
function gitGeaendert(): Set<string> | null {
  try {
    const aus = execFileSync('git', ['diff', '--name-only', ERHEBUNG], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return new Set(aus.split(/\r?\n/).filter((n) => n !== ''));
  } catch {
    return null;
  }
}
// Nur auf Anforderung: ohne JM_FUNKTIONSLISTE_GIT=1 sagt der Test nichts über git; die statische Liste ist der Wächter.
const GIT_PRUEFEN = process.env.JM_FUNKTIONSLISTE_GIT === '1';
const GIT = GIT_PRUEFEN ? gitGeaendert() : null;
if (GIT_PRUEFEN && GIT === null) console.log(`IN Funktionsliste: kein git-Verlauf bis ${ERHEBUNG} (flacher Klon); die Prüfung gegen git entfällt`);

/** Datei in Backticks: Pfad mit Endung, aufgelöst nach der Pfadregel im Kopf der Liste. */
const PFAD = /`([A-Za-z0-9_./-]+\.(?:tsx|ts|css|html|json|md|mjs|yml))`/g;
/** Nur die Entscheidungen E1–E16 dieses Plans sind erlaubte Verweise. */
const VERWEIS = /\bE(?:[1-9]|1[0-6])\b/;
const FREMD = /\b(?:E(?:0|1[7-9]|[2-9]\d)|E\d{3,}|OF\d+)\b/;

interface Zeile {
  abschnitt: number;
  nr: number;
  zellen: string[];
}

/** Zeilen der Abschnitte 1–7; geteilt wird nur an Strichen, die nicht mit \ maskiert sind. */
function zeilen(text: string): Zeile[] {
  const liste: Zeile[] = [];
  let abschnitt = 0;
  for (const z of text.split('\n')) {
    const kopf = /^## (\d+) · /.exec(z);
    if (kopf) {
      abschnitt = Number(kopf[1]);
      continue;
    }
    if (/^## /.test(z)) abschnitt = 0;
    const nr = /^\|\s*(\d+)\s*\|/.exec(z);
    if (nr && abschnitt >= 1 && abschnitt <= 7) {
      liste.push({ abschnitt, nr: Number(nr[1]), zellen: z.split(/(?<!\\)\|/).slice(1, -1).map((s) => s.trim()) });
    }
  }
  return liste;
}

/** Pfadregel der Liste: Repo-Wurzel (apps, packages, docs, .github), apps/interpreter/src (main, preload, shared, renderer) oder der Renderer. */
function aufgeloest(pfad: string): string {
  if (/^(?:apps|packages|docs|\.github)\//.test(pfad)) return `../../${pfad}`;
  if (/^(?:main|preload|shared|renderer)\//.test(pfad)) return `src/${pfad}`;
  return `src/renderer/src/${pfad}`;
}

/** Kanonischer Pfad ab der Repo-Wurzel nach der Pfadregel der Liste. */
function kanon(pfad: string): string {
  const a = aufgeloest(pfad);
  return a.startsWith('../../') ? a.slice('../../'.length) : `apps/interpreter/${a}`;
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

/** Ort am Anfang des Texts: der längste passende Eintrag des Ortsregisters, danach Leerzeichen, Doppelpunkt, Komma oder Ende. */
function ortAm(text: string): string | undefined {
  return [...ORTE]
    .sort((a, b) => b.length - a.length)
    .find((o) => text.startsWith(o) && /^(?:[ :,]|$)/.test(text.slice(o.length)));
}

/** null = Zeile abgehakt; sonst der erste Grund, warum nicht. */
function zeilenFehler(z: Zeile): string | null {
  if (z.zellen.length !== 7) return `${z.zellen.length} statt 7 Spalten`;
  const k = z.zellen[6];
  if (!k.startsWith('✓ ')) return '„künftig wo“ ohne Haken';
  const rest = k.slice(2);
  const ohneCode = k.replace(/`[^`]*`/g, '');
  if (ohneCode.includes('"')) return 'ASCII-Anführungszeichen';
  if (FREMD.test(ohneCode)) return 'Verweis außerhalb von E1–E16';
  let form: string | undefined;
  if (rest.startsWith('unverändert (')) form = 'unverändert';
  else if (rest.startsWith('entfällt (')) form = 'entfällt';
  else if (rest.startsWith('ersetzt durch ')) form = ortAm(rest.slice('ersetzt durch '.length)) && 'ersetzt durch';
  else form = ortAm(rest);
  if (form === undefined) return `Ort nicht aus dem Ortsregister: ${rest.slice(0, 40)}`;
  if (form === 'ersetzt durch' && !VERWEIS.test(ohneCode)) return '„ersetzt durch“ ohne E-Verweis';
  if (form === 'entfällt' && !VERWEIS.test(ohneCode)) return '„entfällt“ ohne E-Verweis';
  const pfade = [...k.matchAll(PFAD)].map((m) => m[1]);
  if (form !== 'entfällt' && pfade.length === 0) return 'Ort ohne Datei';
  const fehlt = pfade.filter((p) => !gibtEs(p));
  if (fehlt.length > 0) return `Datei fehlt: ${fehlt.join(', ')}`;
  // „unverändert“ nennt nur Dateien, die seit der Erhebung unverändert sind; Dateien mit nur den lesenden Brücken (E2) mit Hinweis,
  // Dateien, die ein Altfehler der Stufe 2 geändert hat, mit dem Verweis „Altfehler <ID>“, dessen Liste sie nennt (R6).
  if (form === 'unverändert') {
    const ids = altfehlerIds(ohneCode);
    const offen = pfade.filter((p) => (GEAENDERT_KANON.has(kanon(p)) || GIT?.has(kanon(p)) === true) && !entlastet(ids, kanon(p)));
    if (offen.length > 0 && !/\bE2\b/.test(ohneCode)) return `unverändert mit geänderter Datei (${offen.join(', ')}) ohne Hinweis auf E2 und ohne Altfehler-Verweis, dessen Liste sie nennt`;
    if (offen.some((p) => !NUR_MELDUNG.has(kanon(p)))) return `unverändert mit einer Datei, die mehr als die lesenden Brücken bekam (${offen.join(', ')})`;
  }
  return null;
}

const text = leseText(LISTE);
const alle = zeilen(text);

gleich(alle.length, GESAMT, 'IN Funktionsliste: 86 Zeilen in den Abschnitten 1–7 (Stand der Erhebung)');
gleich(
  JE_ABSCHNITT.map((_, i) => alle.filter((z) => z.abschnitt === i + 1).length),
  JE_ABSCHNITT,
  'IN Funktionsliste: Zeilen je Abschnitt wie in der Erhebung (39/7/29/0/1/5/5)',
);
gleich(
  alle.map((z) => z.nr),
  alle.map((_, i) => i + 1),
  'IN Funktionsliste: Nummern fortlaufend ab 1',
);
ok(!text.replace(/`[^`]*`/g, '').includes('"') && !text.includes('\r'), 'IN Funktionsliste: keine ASCII-Anführungszeichen außerhalb von Code, kein CR');

for (const z of alle) {
  const f = zeilenFehler(z);
  ok(f === null, `IN Funktionsliste Nr. ${z.nr} abgehakt${f === null ? '' : ` – ${f}`}`);
}

// ── Die Menge der geänderten Dateien stimmt mit git überein (nur mit JM_FUNKTIONSLISTE_GIT=1 und Verlauf) ──
{
  if (GIT !== null) {
    const fehlend = [...GIT].filter((n) => n.startsWith('apps/interpreter/') && !GEAENDERT_KANON.has(n));
    ok(fehlend.length === 0, `IN Funktionsliste: GEAENDERT nennt alle seit ${ERHEBUNG} geänderten Dateien von apps/interpreter (fehlt: ${fehlend.join(', ') || 'nichts'})`);
    const zuviel = GEAENDERT.filter((n) => !GIT.has(n));
    ok(zuviel.length === 0, `IN Funktionsliste: GEAENDERT nennt keine Datei, die git nicht als geändert kennt (zu viel: ${zuviel.join(', ') || 'nichts'})`);
    const zitiert = alle
      .filter((z) => z.zellen[6].startsWith('✓ unverändert ('))
      .flatMap((z) => {
        const ids = altfehlerIds(z.zellen[6].replace(/`[^`]*`/g, ''));
        return [...z.zellen[6].matchAll(PFAD)].map((m) => kanon(m[1])).filter((n) => !entlastet(ids, n));
      });
    const getroffen = zitiert.filter((n) => GIT.has(n));
    ok(getroffen.every((n) => NUR_MELDUNG.has(n)), `IN Funktionsliste: keine in einem unverändert-Haken zitierte Datei bekam mehr als die lesenden Brücken, außer ein Altfehler-Verweis nennt sie in seiner Liste (${getroffen.join(', ') || 'keine'})`);
    const listen = [...ALTFEHLER.values()].flat();
    ok(listen.every((n) => GIT.has(n)), `IN Funktionsliste: jede Datei einer Altfehler-Liste ist laut git geändert (nicht: ${listen.filter((n) => !GIT.has(n)).join(', ') || 'nichts'})`);
    // G2: Engine und Store ändern sich mit Altfehler IN-3 und IN-8; Main, Ducking-Logik und Kabelmuster bleiben seit der Erhebung unverändert.
    const unberuehrt = ['apps/interpreter/src/main/index.ts', 'apps/interpreter/src/shared/ducking.ts', 'apps/interpreter/src/shared/virtual-cable.ts'];
    ok(unberuehrt.every((p) => !GIT.has(p)), 'IN Funktionsliste: Main, Ducking und Kabelmuster sind seit der Erhebung unverändert (Engine und Store: Altfehler IN-3, IN-8)');
  }
  // Jede Datei einer Altfehler-Liste steht in GEAENDERT: eine Liste entlastet nur, was wirklich geändert ist.
  {
    const listen = [...ALTFEHLER.values()].flat();
    ok(
      listen.length > 0 && listen.every((n) => GEAENDERT_KANON.has(n)),
      `IN Funktionsliste: jede Datei einer Altfehler-Liste steht in GEAENDERT (nicht: ${listen.filter((n) => !GEAENDERT_KANON.has(n)).join(', ') || 'nichts'})`,
    );
  }
  // Negativprobe: andere Schreibweisen derselben geänderten Datei werden erkannt, eine unveränderte nicht.
  const synth = (pfad: string, zusatz = ''): Zeile => ({ abschnitt: 3, nr: 0, zellen: ['0', '', '', '', '', '', `✓ unverändert (\`${pfad}\`): x${zusatz}`] });
  ok(
    ['views/LiveBereich.tsx', 'renderer/src/views/LiveBereich.tsx', 'apps/interpreter/src/renderer/src/views/LiveBereich.tsx'].every((p) => (zeilenFehler(synth(p)) ?? '').includes('geänderter Datei')) &&
      (zeilenFehler(synth('views/LiveBereich.tsx', ' (E2)')) ?? '').includes('mehr als die lesenden Brücken') &&
      zeilenFehler(synth('preload/index.ts', ' (E2)')) === null &&
      zeilenFehler(synth('shared/api.ts', ' (E2)')) === null &&
      (zeilenFehler(synth('preload/index.ts')) ?? '').includes('ohne Hinweis auf E2') &&
      zeilenFehler(synth('main/index.ts')) === null &&
      zeilenFehler(synth('shared/ducking.ts')) === null,
    'IN Funktionsliste: eine geänderte Datei wird in jeder Schreibweise erkannt; E2 entlastet nur Preload und Vertrag der lesenden Brücken; eine unveränderte Datei ist frei',
  );
  // Der Verweis „Altfehler <ID>“ (Stufe 2, C8) entlastet eine geänderte Datei nur, wenn die Liste der ID sie nennt (R6); nur mit dem
  // Wort „Altfehler“ und nur die zwei Interpreter-IDs.
  ok(
    (zeilenFehler(synth('core/engine.ts')) ?? '').includes('geänderter Datei') &&
      (zeilenFehler(synth('core/engine.ts', ' (Altfehler IN-8)')) ?? '').includes('geänderter Datei') &&
      zeilenFehler(synth('core/engine.ts', ' (Altfehler IN-3)')) === null &&
      zeilenFehler(synth('apps/interpreter/src/renderer/src/core/engine.ts', ' (Altfehler IN-3)')) === null &&
      zeilenFehler(synth('lib/oberflaeche.ts', ' (Altfehler IN-3)')) === null &&
      zeilenFehler(synth('store/settings.ts', ' (Altfehler IN-8)')) === null &&
      (zeilenFehler(synth('store/settings.ts', ' (Altfehler IN-3)')) ?? '').includes('geänderter Datei') &&
      (zeilenFehler(synth('core/engine.ts', ' (IN-3)')) ?? '').includes('geänderter Datei') &&
      ['IN-1', 'IN-30', 'IN-3a', 'IN-3-b', 'PL-N', 'SC-S2'].every((id) => (zeilenFehler(synth('core/engine.ts', ` (Altfehler ${id})`)) ?? '').includes('geänderter Datei')),
    'IN Funktionsliste: „Altfehler IN-3“ entlastet core/engine.ts im unverändert-Haken, ohne ID, mit „Altfehler IN-8“, ohne das Wort „Altfehler“ oder mit einer anderen ID nicht',
  );
  // Negativprobe R6: nennt ein Haken zwei geänderte Dateien, entlastet die ID nur die aus ihrer Liste; eine Datei mit mehr als den
  // lesenden Brücken entlastet auch E2 nicht.
  ok(
    /geänderter Datei \(store\/settings\.ts\)/.test(zeilenFehler(synth('core/engine.ts', ' und `store/settings.ts` (Altfehler IN-3)')) ?? '') &&
      zeilenFehler(synth('core/engine.ts', ' und `store/settings.ts` (Altfehler IN-3, Altfehler IN-8)')) === null &&
      (zeilenFehler(synth('views/LiveBereich.tsx', ' (Altfehler IN-3)')) ?? '').includes('geänderter Datei') &&
      (zeilenFehler(synth('core/engine.ts', ' (E2)')) ?? '').includes('mehr als die lesenden Brücken'),
    'IN Funktionsliste: eine geänderte Datei mit einer Altfehler-ID, deren Liste sie nicht nennt, wird gemeldet (R6)',
  );
  // Parser: maskierte Striche trennen nicht.
  ok(zeilen('## 1 · x\n|1| a \\| b | c | d | e | f | ✓ Rahmen (`App.tsx`) |')[0]?.zellen.length === 7, 'IN Funktionsliste: der Parser teilt nur an nicht maskierten Strichen');
}

const zeile = (nr: number): Zeile | undefined => alle.find((z) => z.nr === nr);
const kuenftig = (nr: number): string => zeile(nr)?.zellen[6] ?? '';
const quelle = (pfad: string): string => (gibtEs(pfad) ? readFileSync(aufgeloest(pfad), 'utf8') : '');
const beginnt = (nr: number, ...orte: string[]): boolean => orte.some((o) => kuenftig(nr).startsWith(`✓ ${o} (`) || kuenftig(nr).startsWith(`✓ ${o}:`));
const ersetzt = (nr: number, ort: string): boolean => kuenftig(nr).startsWith(`✓ ersetzt durch ${ort} (`);
const nennt = (nr: number, ...woerter: string[]): boolean => woerter.every((w) => kuenftig(nr).includes(w));
const unveraendert = (nr: number): boolean => kuenftig(nr).startsWith('✓ unverändert (');
/** Nennt der Haken der Zeile einen Altfehler-Verweis, dessen Liste die Datei (Pfad nach der Pfadregel der Liste) enthält? */
const gebunden = (nr: number, datei: string): boolean => entlastet(altfehlerIds(kuenftig(nr).replace(/`[^`]*`/g, '')), kanon(datei));
const ohneKommentar = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const flach = (s: string): string => s.replace(/\s+/g, ' ');
const von = (nrn: number[], f: (nr: number) => boolean): boolean => nrn.every(f);
const bis = (a: number, b: number): number[] => [...Array(b - a + 1).keys()].map((i) => i + a);

const wurzel = quelle('views/InterpreterOberflaeche.tsx');
const panel = quelle('views/Einstellungen.tsx');
const live = quelle('views/LiveBereich.tsx');
const liveF = flach(live);
const obf = quelle('lib/oberflaeche.ts');
const akt = quelle('lib/aktionen.ts');
const brk = quelle('lib/bruecken.ts');
const app = quelle('App.tsx');
const css = quelle('globals.css');
const engine = quelle('core/engine.ts');
const store = quelle('store/settings.ts');
const hauptIndex = quelle('main/index.ts');
const preload = quelle('preload/index.ts');
const api = quelle('shared/api.ts');
const html = quelle('renderer/index.html');
const kabel = quelle('shared/virtual-cable.ts');
const audio = quelle('packages/settings/src/abschnitte/audio-device.ts');
const quellen = ohneKommentar(wurzel + live + panel + obf + akt + brk + app);
/** Beginn des JSX der Wurzel-View: alles Vorherige läuft vor jeder Bedingung. */
const RUECKGABE = '\n  return (\n';
const T = INTERPRETER_TEXTE;

// ── Rahmen, Kopf, Dokument (Nr. 1–4): AppShell, Name nach E16, Hell/Dunkel nach E5 ──
ok(
  beginnt(1, 'Rahmen') && wurzel.includes('<AppShell') && wurzel.includes('tool="Interpreter"') && wurzel.includes('status={statusLeiste(stand)}') && wurzel.includes('settings={<Einstellungen') &&
    nennt(1, 'E15', 'Live-Bereich', 'Panel Audiogerät', 'Panel Ducking') && !/useRouter|<Route/.test(wurzel) && /return <InterpreterOberflaeche \/>;/.test(app) && !/key=\{/.test(ohneKommentar(wurzel + app)),
  'IN Funktionsliste Nr. 1: Aufbau im AppShell (Kopf, Inhalt, Statusleiste, Panel), eine Ansicht, App.tsx zeigt die Wurzel-View ohne Bedingung und ohne key',
);
ok(
  unveraendert(2) && nennt(2, '`main/index.ts`') && hauptIndex.includes('backgroundThrottling: false') && hauptIndex.includes('width: 1100') && hauptIndex.includes('sandbox: true') && hauptIndex.includes('setupSingleInstance') && !GEAENDERT_KANON.has('apps/interpreter/src/main/index.ts'),
  'IN Funktionsliste Nr. 2: die Fensterhülle bleibt wörtlich (main/index.ts unverändert)',
);
ok(
  beginnt(3, 'Rahmen') && nennt(3, '`renderer/index.html`', '`globals.css`', 'class="dark"') && html.includes('class="dark"') && html.includes('lang="de"') && css.includes('overflow: hidden') && css.includes('user-select: none') &&
    css.includes('--brand-yellow') && css.includes('@media (width < 900px)'),
  'IN Funktionsliste Nr. 3: index.html behält class="dark", globals.css behält Schrift, body und Markierungsfarbe; neu @source und die Regel unter 900 px',
);
ok(
  ersetzt(4, 'Kopf') && nennt(4, '`packages/ui/src/components/AppHeader.tsx`', 'E16', 'Floor/Dolmetscher-Ducking · Einspeisung in Zoom/Webex', 'Z1', 'MIX AKTIV', 'E4') && gibtEs('packages/ui/src/components/AppHeader.tsx') && !/subtitle|untertitel|center=/i.test(ohneKommentar(wurzel)) && T.onAir === 'MIX AKTIV',
  'IN Funktionsliste Nr. 4: Logo und „JM Interpreter“ kommen aus dem gemeinsamen Kopf, der Untertitel entfällt (E16), ON AIR heißt „MIX AKTIV“ (E4)',
);

// ── Haupttaste (Nr. 5, 6): Platz, Beschriftung, Sperrgründe, live nur nach E4 ──
{
  const bereit = hauptTaste({ engine: motor(), einstellungen: einst() });
  const laeuft = hauptTaste({ engine: motor({ running: true }), einstellungen: einst() });
  const ohneEingang = hauptTaste({ engine: motor({ running: true }), einstellungen: einst({ floorId: '' }) });
  const ohneAntwort = hauptTaste({ engine: undefined, einstellungen: einst() });
  const startet = hauptTaste({ engine: motor({ starting: true }), einstellungen: einst() });
  ok(
    beginnt(5, 'Live-Bereich Haupttaste') && nennt(5, '`views/LiveBereich.tsx`', '`lib/oberflaeche.ts`', '`lib/aktionen.ts`', 'Starten', 'Stoppen', 'E4', 'Lädt …', 'Startet …', 'Altfehler IN-3', 'oben rechts', 'breiter', 'Gelb') &&
      live.includes('<TallyButton {...liveTaste(stand, aktionen)} />') && live.includes('className="w-56 shrink-0"') && akt.includes('void motor.stop().then(() => gestartetMerken(null))') && akt.includes('void motor.start(geraete)') &&
      wurzel.includes('{ floorId: s.floorId, interpreterId: s.interpreterId, outputId: s.outputId }') && !/shortcut/.test(quellen) &&
      bereit.label === 'Starten' && bereit.state === 'bereit' && laeuft.label === 'Stoppen' && laeuft.state === 'live' && ohneAntwort.state === 'gesperrt' && ohneAntwort.disabledReason === 'Lädt …' &&
      startet.label === 'Starten' && startet.state === 'gesperrt' && startet.disabledReason === 'Startet …',
    'IN Funktionsliste Nr. 5: Starten/Stoppen sitzt als TallyButton oben rechts im Live-Bereich, ruft engine.start mit den drei Geräten bzw. stop, ist nur im Lauf live (E4), vor der ersten Antwort „Lädt …“ und während des Starts „Startet …“ (Altfehler IN-3)',
  );
  // Altfehler IN-3: der Wächter „die Taste ist beim Start nicht gesperrt“ (Befund 3) ist umgestellt: gesperrt mit „Startet …“, geprüft
  // nach „Lädt …“ und vor „Erst beide Eingänge wählen“.
  const tasteQuelle = ohneKommentar(obf.slice(obf.indexOf('export function hauptTaste')));
  const anZustandOffen = tasteQuelle.indexOf('T.grund.zustandOffen);');
  const anStartet = tasteQuelle.indexOf("if (s.engine.starting) return taste(T.taste.starten, 'gesperrt', T.grund.startet);");
  const anEingaenge = tasteQuelle.indexOf("if (!e.floorId || !e.interpreterId) return taste(label, 'gesperrt', T.grund.eingaengeFehlen);");
  ok(
    beginnt(6, 'Live-Bereich Haupttaste') && nennt(6, 'Erst beide Eingänge wählen', 'Befund 2', 'Befund 3', 'Lädt …', 'Startet …', 'höchstens 15 s', 'Altfehler IN-3', 'Nr. 8, 9, 80') && ohneEingang.state === 'gesperrt' && ohneEingang.disabledReason === 'Erst beide Eingänge wählen' && ohneEingang.label === 'Stoppen' &&
      anZustandOffen > 0 && anStartet > anZustandOffen && anEingaenge > anStartet && T.grund.startet === 'Startet …',
    'IN Funktionsliste Nr. 6: der Sperrgrund „Erst beide Eingänge wählen“ gilt wie heute auch im Lauf (Befund 2); Altfehler IN-3: beim Start gesperrt mit „Startet …“ (früher nicht gesperrt, Befund 3), nach „Lädt …“ und vor dem Eingangs-Grund',
  );
  ok(kopfOnAir({ engine: undefined }).live === false && kopfOnAir({ engine: motor() }).live === false && kopfOnAir({ engine: motor({ running: true }) }).live === true && kopfOnAir({ engine: motor({ running: true }) }).label === 'MIX AKTIV', 'IN Funktionsliste Nr. 4, 5: ON AIR „MIX AKTIV“ nur im Lauf, ohne Antwort nie');
}
ok(
  beginnt(7, 'Live-Bereich') && nennt(7, 'state.error', '--status-error', 'Statuseintrag', '`fehler`') && live.includes('{e?.error ? (') && live.includes('{e.error}') && live.includes('border-[var(--status-error)]/60') && liveF.includes('select-text') &&
    obf.includes("{ ...kopf, state: 'error', detail: s.engine.error }"),
  'IN Funktionsliste Nr. 7: das Fehlerband steht im Live-Bereich mit der rohen Meldung in der Fehlerfarbe aus der Variable, dazu der Statuseintrag fehler',
);

// ── Geräte-Wahlen (Nr. 8–11, 46, 60–62, 80, 84): ein gemeinsamer Abschnitt, drei Wahlen, Hinweis nach E10 ──
{
  const a = geraeteAbschnitt(stand());
  const hinweis = 'Wirkt erst nach Stopp und erneutem Start.';
  const wahl = (k: string) => a.choices.find((c) => c.key === k);
  ok(
    a.choices.length === 3 && a.choices.every((c) => c.changeWarning === hinweis) && T.wechselWirktNachNeustart === hinweis && wahl('floor')?.required === true && wahl('dolmetscher')?.required === true && wahl('ausgabe')?.required !== true &&
      wahl('ausgabe')?.defaultLabel === 'Systemstandard' && wahl('floor')?.label === 'Floor (O-Ton)' && wahl('dolmetscher')?.label === 'Dolmetscher' && wahl('ausgabe')?.label === 'Ausgabe (virtuelles Kabel)' &&
      a.capabilities.level === true && a.capabilities.refresh === false && !/lockedReason/.test(ohneKommentar(obf)),
    'IN Funktionsliste Nr. 8–10, 60–62: drei Wahlen im Abschnitt, Floor und Dolmetscher Pflicht, Ausgabe mit „Systemstandard“, alle drei mit dem Hinweis nach E10, kein Sperrgrund, kein Aktualisieren-Knopf',
  );
  ok(
    von([8, 9, 10], (nr) => beginnt(nr, 'Panel Audiogerät') && nennt(nr, '`views/Einstellungen.tsx`', '`lib/oberflaeche.ts`', '`lib/aktionen.ts`', 'Wirkt erst nach Stopp und erneutem Start.', 'E10')) &&
      panel.includes('<AudioDeviceSection {...geraeteAbschnitt(stand, aktionen)} />') && akt.includes("floorWaehlen: (id) => store.set('floorId', id)") && akt.includes("dolmetscherWaehlen: (id) => store.set('interpreterId', id)") &&
      akt.includes("ausgabeWaehlen: (id) => store.set('outputId', id)") && !/engine\.(start|stop)/.test(panel + obf.slice(obf.indexOf('function abschnitt('), obf.indexOf('export function geraeteAbschnitt'))),
    'IN Funktionsliste Nr. 8–10: die Wahlen stehen im Panel Audiogerät und schreiben nur den Speicher (floorId, interpreterId, outputId), nie die Engine',
  );
  // „– bitte wählen –“ ist nur ohne Wahl sichtbar: mit gewähltem Gerät gibt es keine Option mit leerem Wert, bei einer fremden ID bleibt sie gewählt.
  const mitWahl = selectOptionen([{ value: 'mic-a', label: 'Mikro Saal' }], 'mic-a', { placeholder: '– bitte wählen –' });
  const ohneWahl = selectOptionen([{ value: 'mic-a', label: 'Mikro Saal' }], '', { placeholder: '– bitte wählen –' });
  const fremd = selectOptionen([{ value: 'mic-a', label: 'Mikro Saal' }], 'weg', {});
  ok(
    von([8, 9, 80], (nr) => nennt(nr, '– bitte wählen –')) && nennt(8, 'Z1') && nennt(46, '– bitte wählen –', 'Z1') && mitWahl.every((o) => o.value !== '') && ohneWahl[0]?.value === '' && ohneWahl[0]?.label === '– bitte wählen –' &&
      fremd[0]?.value === 'weg' && fremd[0]?.label === 'nicht verfügbar: weg' && quelle('packages/settings/src/vertrag.ts').includes("bitteWaehlen: '– bitte wählen –'"),
    'IN Funktionsliste Nr. 8, 9, 46, 80: „– bitte wählen –“ (kurzer Strich, Z1) steht nur ohne Wahl und ist danach nicht mehr wählbar; eine fremde ID bleibt als „nicht verfügbar: ‹ID›“ gewählt',
  );
  ok(
    beginnt(11, 'Panel Audiogerät') && nennt(11, '`core/engine.ts`', 'unbekannt', 'Kein Ausgang gefunden', 'Gerätenamen nicht lesbar', 'Nr. 67') && engine.includes('export async function listDevices(withProbe = true)') &&
      obf.includes('if (g === undefined || !g.labelsAvailable) return undefined;') && audio.includes("keinAusgang: 'Kein Ausgang gefunden'") && quelle('packages/settings/src/abschnitte/AudioDeviceSection.tsx').includes('{AUDIO_TEXTE.unbekannt}') &&
      a.choices.every((c) => c.devices !== undefined) && geraeteAbschnitt(stand({ geraete: geraete({ labelsAvailable: false }) })).choices.every((c) => c.devices === undefined) && geraeteAbschnitt(stand({ geraete: undefined })).choices.every((c) => c.devices === undefined),
    'IN Funktionsliste Nr. 11: vor der Geräteliste und ohne lesbare Namen ist die Liste „unbekannt“ statt eines Auswahlfelds; eine gemessen leere Ausgabeliste zeigt „Kein Ausgang gefunden“',
  );
  ok(
    beginnt(80, 'Panel Audiogerät') && nennt(80, '`views/Einstellungen.tsx`', 'nur den Speicher', 'Kein Ausgang gefunden', 'Nr. 60') && packageSelect() && !/onKeyDown/.test(ohneKommentar(panel)),
    'IN Funktionsliste Nr. 80: die Auswahlfelder sind Select aus @jm/ui, jeder Pfeilschritt speichert nur die Einstellung',
  );
  function packageSelect(): boolean {
    return quelle('packages/settings/src/abschnitte/AudioDeviceSection.tsx').includes('onChange={(v) => c.onChange?.(v)}') && quelle('packages/ui/src/components/Select.tsx').includes('<select');
  }
  ok(
    ersetzt(62, 'Panel Audiogerät') && nennt(62, 'E10', 'Ein Wechsel stoppt die laufende Verarbeitung', 'Wirkt erst nach Stopp und erneutem Start.') && !/wechselStoppt/.test(quellen) && audio.includes("wechselStoppt: 'Ein Wechsel stoppt die laufende Verarbeitung'"),
    'IN Funktionsliste Nr. 62: der Paket-Text „Ein Wechsel stoppt die laufende Verarbeitung“ steht nirgends in der App; alle drei Wahlen tragen den Hinweis nach E10',
  );
}
ok(
  nennt(9, 'keine Prüfung') && !/floorId\s*===\s*[\w.]*interpreterId|interpreterId\s*===\s*[\w.]*floorId/.test(ohneKommentar(obf + akt + wurzel + panel)),
  'IN Funktionsliste Nr. 9: derselbe Eintrag darf weiter in beiden Eingangs-Wahlen stehen, keine Prüfung',
);

// ── Kabel-Hinweise (Nr. 12–23): Wortlaut wie bisher, Töne aus Tokens, Text nach E10 ──
ok(
  von(bis(12, 23), (nr) => beginnt(nr, 'Live-Bereich Kabelkarten') && nennt(nr, '`views/LiveBereich.tsx`')) && live.includes('if (g === undefined) return null;') && wurzel.includes('geraete: devicesLoaded ? { eingaenge: inputs, ausgaenge: outputs, labelsAvailable } : undefined,') &&
    liveF.includes('Gerätenamen nicht lesbar — bitte die Mikrofonfreigabe erteilen. Ohne sie kann der Interpreter das virtuelle Kabel nicht erkennen.') && nennt(12, 'devicesLoaded') && nennt(13, 'orange'),
  'IN Funktionsliste Nr. 12–23: die Kabel-Hinweise stehen als Karten im Live-Bereich, vor der ersten Geräteliste keine Karte, „Gerätenamen nicht lesbar“ im alten Wortlaut',
);
ok(
  nennt(14, 'Nr. 61', 'E10') && liveF.includes('Das Ausgabegerät wurde geändert, der Interpreter sendet aber noch auf das beim Start gewählte Gerät. Die Änderung wirkt erst, wenn er <strong>gestoppt und erneut gestartet</strong> wird.') &&
    liveF.includes('const pendingChange = running && startedOutputId !== null && outputId !== startedOutputId;') && nennt(15, '`ausgabe`', 'Statusleiste') && liveF.includes('const effectiveOutputId = running && startedOutputId !== null ? startedOutputId : outputId;'),
  'IN Funktionsliste Nr. 14, 15: die Karte „Ausgabegerät geändert“ und das gestartete Gerät als Bezug bleiben, der Eintrag ausgabe der Statusleiste zeigt ebenfalls das gestartete Gerät',
);
ok(
  nennt(16, 'E10', 'Der Mix geht auf den Systemstandard und erreicht die Konferenz nicht.', 'Das gewählte Ausgabegerät ist derzeit nicht verfügbar. Der Start schlägt damit fehl.', 'Z1', 'Befund 4') &&
    T.ausgabeNichtVerfuegbar === 'Das gewählte Ausgabegerät ist derzeit nicht verfügbar. Der Start schlägt damit fehl.' && live.includes("return hinweis('warn', T.ausgabeNichtVerfuegbar);") && !/Der Mix geht auf den Systemstandard/.test(ohneKommentar(live + obf + panel + akt)),
  'IN Funktionsliste Nr. 16: der Hinweis „nicht verfügbar“ hat den Text nach E10; „Der Mix geht auf den Systemstandard …“ steht nirgends mehr',
);
ok(
  nennt(17, 'Mögliche Ursachen') && liveF.includes('erkannt, aber unter dem Namen <strong>{kind.zoomInputLabel}</strong> wurde keine Aufnahmeseite gefunden. Mögliche Ursachen: der Treiber ist unvollständig installiert, das Gerät ist in den Windows-Sound-Einstellungen deaktiviert — oder es wurde dort umbenannt.'),
  'IN Funktionsliste Nr. 17: „Kabel erkannt, Gegenseite fehlt“ im alten Wortlaut',
);
ok(
  nennt(18, 'zoomInputDisplayName', 'ok') && liveF.includes('erkannt. In Zoom als <em>Mikrofon</em> wählen: <strong>{zoomName}</strong>') && liveF.includes('const zoomName = zoomInputDisplayName(kind, inputLabels);') && live.includes("'ok',") &&
    nennt(19, '`shared/virtual-cable.ts`') && liveF.includes('kind.needsRouting') && liveF.includes('{kind.routingHint}') && kabel.includes('needsRouting'),
  'IN Funktionsliste Nr. 18, 19: „Kabel erkannt“ ist die einzige Karte im Ton ok (grün aus dem Token), „VoiceMeeter erkannt“ warnt mit dem Routing-Satz',
);
ok(
  nennt(20, 'Kein virtuelles Kabel gewählt', 'Download') && liveF.includes('Kein virtuelles Kabel gewählt') && liveF.includes('Ohne Kabel geht der Mix auf den Systemstandard und erreicht die Konferenz nicht.') && liveF.includes('{downloadFuss(onDownload)}') &&
    nennt(21, 'kein bekanntes virtuelles Kabel') && liveF.includes('{selected!.label}: kein bekanntes virtuelles Kabel') && liveF.includes('Der Mix geht auf dieses Gerät.'),
  'IN Funktionsliste Nr. 20, 21: die zwei großen Karten stehen im alten Wortlaut, mit Lizenzsatz und Download-Knopf',
);
ok(
  nennt(22, 'Donationware') && liveF.includes('VB-CABLE ist für private Nutzung Donationware; der gewerbliche Einsatz ist lizenzpflichtig.') && nennt(23, '`lib/aktionen.ts`', '`main/index.ts`', 'cable:openDownload') && liveF.includes('VB-CABLE herunterladen') &&
    akt.includes('void api?.openCableDownload().catch(() => {});') && wurzel.includes('() => kabelHerunterladen(window.jminterpreter)') && hauptIndex.includes("ipcMain.handle('cable:openDownload'") && hauptIndex.includes("'https://vb-audio.com/Cable/'"),
  'IN Funktionsliste Nr. 22, 23: Lizenzsatz und Knopf „VB-CABLE herunterladen“ bleiben; der Aufruf geht wie bisher über openCableDownload und den Kanal cable:openDownload',
);
ok(
  von([13, 14, 16, 17, 19, 20, 21], (nr) => nennt(nr, 'Warnfarbe') || nennt(nr, 'orange')) && live.includes("warn: 'border-[var(--status-warn)]/60 bg-[var(--status-warn)]/10'") && live.includes("ok: 'border-[var(--tally-ready)]/60 bg-[var(--tally-ready)]/10'") && nennt(63, 'emerald', 'yellow'),
  'IN Funktionsliste Nr. 13–21, 63: die Töne der Karten sind Tokens (warn orange statt gelb, ok statt emerald)',
);

// ── Pegel, Pille, Überbrückt (Nr. 24–27, 29, 45, 58) ──
ok(
  beginnt(24, 'Live-Bereich Pille') && nennt(24, 'FLOOR ABGESENKT', 'Floor offen', 'unbekannt', 'Überbrückt') && T.live.abgesenkt === 'FLOOR ABGESENKT' && T.live.offen === 'Floor offen' && liveF.includes('{e === undefined ? UNBEKANNT : ducking ? T.live.abgesenkt : T.live.offen}') && live.includes('data-interpreter="pille"'),
  'IN Funktionsliste Nr. 24: die Pille „FLOOR ABGESENKT“ / „Floor offen“ steht in der Karte „Pegel“, vor der ersten Antwort „unbekannt“',
);
ok(
  beginnt(25, 'Live-Bereich Meter') && beginnt(26, 'Live-Bereich Meter') && beginnt(27, 'Live-Bereich Meter') && nennt(25, 'dunkle', 'Pegel:') && T.live.pegelWert(-23.44) === '-23.4 dB' && T.live.keinPegel === '—' && T.live.schwelle(-42) === 'Schwelle -42 dB' &&
    live.includes("meter('meter-floor', T.geraete.floorKurz, e?.floorDb ?? -Infinity)") && live.includes("meter('meter-dolmetscher', T.geraete.dolmetscher, e?.interpreterDb ?? -Infinity, schwelleDb)") && live.includes('title={T.live.schwelle(schwelleDb)}') &&
    live.includes('(db + 60) / 60') && live.includes('Number.isFinite(db)') && live.includes('duration-75') && live.includes('bg-[var(--destructive)]') && live.includes('className="dark relative h-3 overflow-hidden rounded bg-[var(--muted)]"') && engine.includes('private publish('),
  'IN Funktionsliste Nr. 25–27: zwei Meter (Dolmetscher mit Schwellenmarke), Skala −60 bis 0 dBFS, „−23.4 dB“ bzw. „—“, die Spur ist eine dunkle Token-Insel',
);
{
  const a = statusLeiste(stand({ einstellungen: einst({ bypass: true }), engine: motor({ ducking: false }) })).find((i) => i.id === 'ducking');
  const b = statusLeiste(stand({ einstellungen: einst({ bypass: true }), engine: motor({ ducking: true }) })).find((i) => i.id === 'ducking');
  ok(
    beginnt(29, 'Panel Ducking') && nennt(29, 'Überbrückt', 'überbrückt', 'E10', 'Live-Bereich Überbrückt-Anzeige', 'Statuseintrag', 'Befund 7') && panel.includes('type="checkbox"') && panel.includes('onChange={(e) => aktionen.bypass(e.target.checked)}') && T.ducking.bypass === 'Überbrücken (zum Vergleichshören)' &&
      akt.includes("bypass: (an) => store.set('bypass', an)") && wurzel.includes('engine.setBypass(s.bypass);') && liveF.includes('<StatusPill state="warn" text={T.live.ueberbrueckt} />') && live.includes('stand.einstellungen?.bypass ?') && T.live.ueberbrueckt === 'Überbrückt' &&
      a?.state === 'warn' && a?.detail === 'überbrückt' && b?.detail === 'überbrückt' && !/offen/.test(`${a?.detail}${b?.detail}`),
    'IN Funktionsliste Nr. 29: das Kästchen „Überbrücken“ steht im Panel Ducking und wirkt sofort; „Überbrückt“ im Live-Bereich und im Eintrag ducking (nie „offen“, E10)',
  );
}
ok(
  beginnt(58, 'Live-Bereich Überbrückt-Anzeige') && nennt(58, '`views/LiveBereich.tsx`', '`core/engine.ts`', 'Pille', 'E10') && live.includes('data-interpreter="ueberbrueckt"') && engine.includes('if (this.bypass) {') && engine.includes('const ducking = !this.bypass && this.duck.ducking;'),
  'IN Funktionsliste Nr. 58: die Engine bleibt wörtlich; die Anzeige „Überbrückt“ im Live-Bereich ist neu (E10)',
);
ok(
  beginnt(45, 'Live-Bereich Meter') && nennt(45, 'Schwelle ‹Wert› dB', 'Erst beide Eingänge wählen', 'Grund der Taste') && live.includes('title={T.live.schwelle(schwelleDb)}'),
  'IN Funktionsliste Nr. 45: der Schwellen-Tooltip bleibt, der Sperr-Tooltip ist jetzt der Grund der Taste',
);

// ── Abschnitt „Ducking“ im Panel (Nr. 28, 30–39, 83, 85) ──
{
  const soll: Array<[string, string, number, number, number]> = [
    ['thresholdDb', 'dB', -70, -10, 1],
    ['duckDb', 'dB', -40, 0, 1],
    ['attackMs', 'ms', 5, 300, 5],
    ['releaseMs', 'ms', 50, 2000, 10],
    ['holdMs', 'ms', 0, 1500, 10],
    ['floorGainDb', 'dB', -24, 12, 1],
    ['interpreterGainDb', 'dB', -24, 12, 1],
  ];
  const ist: unknown[] = [...DUCKING_REGLER, ...VORVERSTAERKUNG_REGLER].map((r) => [r.key, r.einheit, r.min, r.max, r.step]);
  gleich(ist, soll as unknown[], 'IN Funktionsliste Nr. 30–37: die sieben Regler haben dieselben Bereiche, Schritte und Einheiten wie der alte App');
  gleich(
    [DEFAULT_SETTINGS.thresholdDb, DEFAULT_SETTINGS.duckDb, DEFAULT_SETTINGS.attackMs, DEFAULT_SETTINGS.releaseMs, DEFAULT_SETTINGS.holdMs, DEFAULT_SETTINGS.floorGainDb, DEFAULT_SETTINGS.interpreterGainDb],
    [-42, -18, 60, 400, 350, 0, 0],
    'IN Funktionsliste Nr. 30–37, 83: die Vorgaben der sieben Werte sind unverändert',
  );
  ok(
    von(bis(30, 34), (nr) => beginnt(nr, 'Panel Ducking') && nennt(nr, '`views/Einstellungen.tsx`')) && von([36, 37], (nr) => beginnt(nr, 'Panel Ducking')) && nennt(30, 'Ab diesem Dolmetscher-Pegel wird der O-Ton abgesenkt.') && nennt(31, 'Wie weit der O-Ton zurückgeht, solange gesprochen wird.') &&
      nennt(32, 'Wie schnell abgesenkt wird.') && nennt(33, 'Wie schnell der O-Ton zurückkommt.') && nennt(34, 'Atempausen kürzer als der Nachlauf reißen den O-Ton nicht hoch (verhindert Pumpen).') && nennt(36, 'Vorverstärkung') && nennt(37, 'Auslösen') &&
      DUCKING_REGLER.map((r) => r.hinweis).join('|') === [T.regler.schwelleHinweis, T.regler.absenkungHinweis, T.regler.attackHinweis, T.regler.releaseHinweis, T.regler.nachlaufHinweis].join('|') && VORVERSTAERKUNG_REGLER.every((r) => r.hinweis === undefined) &&
      panel.includes('<input\n        id={id}\n        type="range"') && panel.includes('onChange={(e) => aktionen.regler(r.key, Number(e.target.value))}') && akt.includes('regler: (key, wert) => store.set(key, wert)') && panel.includes('{`${wert} ${r.einheit}`}'),
    'IN Funktionsliste Nr. 30–34, 36, 37: die Regler stehen im Panel Ducking als native Regler mit den alten Hinweisen und schreiben mit Number(Wert) in den Speicher',
  );
  ok(
    ersetzt(28, 'Panel Ducking') && ersetzt(35, 'Panel Ducking') && nennt(28, 'E15') && nennt(35, 'E15', 'Unterüberschrift') && panel.includes('<SettingsSection title={T.ducking.titel}>') && panel.includes('<h4 className="text-sm font-semibold text-[var(--foreground)]">{T.ducking.vorverstaerkung}</h4>') && T.ducking.titel === 'Ducking' && T.ducking.vorverstaerkung === 'Vorverstärkung',
    'IN Funktionsliste Nr. 28, 35: die Karten „Ducking“ und „Vorverstärkung“ sind der Abschnitt „Ducking“ und seine Unterüberschrift im Panel',
  );
  // Altfehler IN-8: der Wächter „setzt dieselben sieben Werte zurück“ (Befund 8) ist umgestellt: fünf Werte, nicht die Vorverstärkungen.
  ok(
    beginnt(38, 'Panel Ducking') && nennt(38, 'Befund 8', 'fünf Werte', 'nicht die Vorverstärkungen', 'Altfehler IN-8', 'Bypass', 'Geräte') && T.ducking.zuruecksetzen === 'Ducking-Werte zurücksetzen' && panel.includes('onClick={() => aktionen.zuruecksetzen()}') &&
      akt.includes('zuruecksetzen: () => store.reset()') && store.includes('reset: () => set({ ...DUCKING_VORGABEN }),') && !store.includes('set({ ...DEFAULT_SETTINGS })'),
    'IN Funktionsliste Nr. 38: „Ducking-Werte zurücksetzen“ steht am Ende des Abschnitts „Ducking“ und setzt fünf Werte zurück, nicht die Vorverstärkungen, nicht Bypass und Geräte (Altfehler IN-8)',
  );
  gleich(
    DUCKING_VORGABEN,
    { thresholdDb: DEFAULT_SETTINGS.thresholdDb, duckDb: DEFAULT_SETTINGS.duckDb, attackMs: DEFAULT_SETTINGS.attackMs, releaseMs: DEFAULT_SETTINGS.releaseMs, holdMs: DEFAULT_SETTINGS.holdMs },
    'IN Funktionsliste Nr. 38: DUCKING_VORGABEN sind genau die fünf Ducking-Werte mit den Vorgaben aus DEFAULT_SETTINGS, ohne Vorverstärkungen (Altfehler IN-8)',
  );
  ok(
    beginnt(39, 'Panel Ducking') && nennt(39, '`views/InterpreterOberflaeche.tsx`') && wurzel.includes('engine.setSettings(duckSettings(s));') && wurzel.includes('}, [engine, s]);') && wurzel.includes('}, [engine, s.bypass]);') && !/floorId|interpreterId|outputId/.test(wurzel.slice(wurzel.indexOf('engine.setSettings'), wurzel.indexOf('// Lesende Brücke'))),
    'IN Funktionsliste Nr. 39: Regler und Bypass wirken sofort über die Effekte der Wurzel-View, die Geräte-IDs gehören nicht dazu',
  );
  ok(
    beginnt(83, 'Panel Ducking') && nennt(83, '`shared/ducking.ts`', '`store/settings.ts`') && beginnt(85, 'Panel Ducking') && store.includes('bypass: false,') && wurzel.includes('engine.setBypass(s.bypass);'),
    'IN Funktionsliste Nr. 83, 85: die Vorgaben und der gemerkte Bypass bleiben, der Bypass geht beim Einhängen in die Engine',
  );
}

// ── Dialoge, Meldungen, Texte (Nr. 40–46) ──
{
  const dateien = ['App.tsx', 'views/InterpreterOberflaeche.tsx', 'views/LiveBereich.tsx', 'views/Einstellungen.tsx', 'lib/aktionen.ts', 'lib/oberflaeche.ts', 'lib/bruecken.ts', 'core/engine.ts', 'store/settings.ts'];
  ok(
    beginnt(40, 'Rahmen') && dateien.every((d) => !/\b(?:window\.)?(?:confirm|alert|prompt)\(/.test(ohneKommentar(quelle(d)))) && !/Modal|Toast|Dialog/.test(quellen) && nennt(40, 'ohne Rückfrage') && hauptIndex.includes("app.on('window-all-closed'"),
    'IN Funktionsliste Nr. 40: weder confirm noch alert noch prompt noch Dialog oder Toast im Renderer; „Stoppen“, „Zurücksetzen“ und Schließen bleiben ohne Rückfrage',
  );
}
ok(
  unveraendert(41) && nennt(41, '`main/index.ts`', 'media') && hauptIndex.includes('setPermissionRequestHandler') && hauptIndex.includes('setPermissionCheckHandler'),
  'IN Funktionsliste Nr. 41: die Mikrofon-Freigabe im Main bleibt',
);
ok(
  beginnt(42, 'Live-Bereich') && nennt(42, '`core/engine.ts`', 'rohe', 'Statuseintrag', 'Altfehler IN-3', START_FRIST_TEXT, '`START_FRIST_TEXT`') && engine.includes('error: e instanceof Error ? e.message : String(e)') && !/error:\s*['"`]/.test(ohneKommentar(engine)) &&
    [...ohneKommentar(engine).matchAll(/this\.patch\(\{([^}]*)\}\)/g)].flatMap((m) => [...m[1].matchAll(/\berror: ([^,]+?)\s*(?:,|$)/g)].map((x) => x[1])).sort().join('|') === 'START_FRIST_TEXT|e instanceof Error ? e.message : String(e)|null',
  'IN Funktionsliste Nr. 42: einen eigenen Wortlaut für Startfehler gibt es nur nach der Frist (START_FRIST_TEXT, Altfehler IN-3); sonst erscheint die rohe Meldung im Live-Bereich und im Eintrag fehler',
);
{
  const ids = statusLeiste(stand()).map((i) => i.id);
  ok(
    beginnt(43, 'Statusleiste') && nennt(43, 'master-link', 'floor', 'dolmetscher', 'ausgabe', 'ducking', 'fehler') && ids.join(',') === 'master-link,floor,dolmetscher,ausgabe,ducking,fehler' && wurzel.includes('status={statusLeiste(stand)}'),
    'IN Funktionsliste Nr. 43: die übrigen Meldungen stehen im Live-Bereich, dazu die Statusleiste mit master-link, floor, dolmetscher, ausgabe, ducking und fehler',
  );
}
ok(
  unveraendert(44) && nennt(44, '`main/index.ts`', 'initAppRuntime') && !/console\./.test(quellen) && hauptIndex.includes('initAppRuntime('),
  'IN Funktionsliste Nr. 44: der Interpreter schreibt weiter keine eigene Protokollzeile',
);

// ── Abläufe aus Abschnitt 3 (Nr. 47–75): Main und Engine unverändert, Besitzer ist die Wurzel-View (E15) ──
ok(
  beginnt(47, 'Rahmen') && nennt(47, '`views/InterpreterOberflaeche.tsx`', '`App.tsx`', 'E15', 'destroy', 'StrictMode') && wurzel.indexOf('new InterpreterEngine()') > 0 && wurzel.indexOf('new InterpreterEngine()') < wurzel.indexOf(RUECKGABE) &&
    wurzel.includes('return () => {\n      unsub();\n      engine.destroy();\n    };\n  }, [engine]);') && wurzel.indexOf('engine.subscribe(') < wurzel.indexOf(RUECKGABE) && /return <InterpreterOberflaeche \/>;/.test(app) && !/key=\{/.test(ohneKommentar(wurzel + app)) &&
    quelle('main.tsx').includes('<StrictMode>') && engine.includes('destroy(): void {\n    void this.stop();'),
  'IN Funktionsliste Nr. 47: die Engine lebt in der Wurzel-View vor jeder Bedingung, destroy nur im Aufräumen des Effekts mit [engine], die Wurzel hat weder Bedingung noch key',
);
ok(
  beginnt(48, 'Rahmen') && nennt(48, 'undefined', 'unbekannt', 'Lädt …') && wurzel.includes('useState<EngineState | undefined>(undefined)') && wurzel.includes('setState(engine.getState());') && wurzel.includes('const unsub = engine.subscribe(() => setState(engine.getState()));'),
  'IN Funktionsliste Nr. 48: der Zustand ist bis zur ersten Antwort der Engine undefined (Einträge unbekannt, Haupttaste „Lädt …“), danach wie bisher abonniert',
);
{
  const teile: Array<[number[], string[]]> = [
    [[49, 53], ['await this.stop();', "latencyHint: 'interactive'", 'this.patch({ running: true, error: null, startedOutputId: devices.outputId });', 'await this.route(devices.outputId, gilt);']],
    [[50], ['echoCancellation: false', 'noiseSuppression: false', 'autoGainControl: false']],
    [[51], ['setSinkId', 'el.autoplay = true']],
    [[52], ['startedOutputId: null,']],
    [[54], ['const TICK_MS = 10;', 'setInterval(this.tick, TICK_MS)']],
    [[56], ['private lastTarget = Number.NaN;']],
    [[57], ['setSettings(s: DuckSettings): void {']],
    [[59], ['private publish(']],
  ];
  ok(
    teile.every(([nrn, wo]) => nrn.every((nr) => unveraendert(nr) && nennt(nr, '`core/engine.ts`') && gebunden(nr, 'core/engine.ts')) && wo.every((w) => engine.includes(w))),
    'IN Funktionsliste Nr. 49–54, 56, 57, 59: die Engine bleibt bis auf den Start wörtlich (Aufnahme ohne Aufbereitung, Ausgabe, Stopp, Fehlerfall, Takt, Rampe, Vorverstärkung, Meldetakt); die Zeilen tragen den Verweis Altfehler IN-3',
  );
  // Altfehler IN-3 im Start (Nr. 49, 52): die Sperre steht vor dem ersten await, die Frist läuft gegen den Rumpf, stop() fasst die
  // Startsperre nicht an.
  const startQuelle = ohneKommentar(engine.slice(engine.indexOf('async start(devices: Devices)'), engine.indexOf('private async starte(')));
  const stopQuelle = ohneKommentar(engine.slice(engine.indexOf('async stop(): Promise<void> {'), engine.indexOf('private open(')));
  ok(
    nennt(49, 'Altfehler IN-3', 'Frist von 15 s', 'Startnummer') && nennt(52, 'Startsperre nicht') && startQuelle.indexOf('if (this.starting) return;') > 0 && startQuelle.indexOf('if (this.starting) return;') < startQuelle.indexOf('await') &&
      startQuelle.includes('Promise.race([this.starte(devices, nr), abgelaufen])') && startQuelle.includes('this.patch({ error: START_FRIST_TEXT });') && /finally \{\s*clearTimeout\(frist\);\s*this\.starting = false;\s*this\.patch\(\{ starting: false \}\);/.test(startQuelle) &&
      stopQuelle.length > 0 && !/starting|startNr/.test(stopQuelle),
    'IN Funktionsliste Nr. 49, 52: Altfehler IN-3: die Startsperre steht vor dem ersten await, der Rumpf läuft gegen die Frist, die Sperre endet in finally; stop() fasst sie nicht an',
  );
  ok(
    unveraendert(55) && nennt(55, '`shared/ducking.ts`') && quelle('shared/ducking.ts').includes('export function step(') && !GEAENDERT_KANON.has('apps/interpreter/src/shared/ducking.ts'),
    'IN Funktionsliste Nr. 55: die Ducking-Entscheidung bleibt',
  );
}
ok(
  nennt(53, 'Befund 4', 'Statusleiste') && nennt(57, 'Panel Ducking') && nennt(58, 'Überbrückt'),
  'IN Funktionsliste Nr. 53, 57, 58: die Engine-Zeilen nennen, wo ihre Folgen jetzt angezeigt werden',
);
{
  // Gerätewechsel im Betrieb (Nr. 60, 61): die Einträge zeigen das gestartete Gerät, eine abweichende Einstellung warnt mit dem Hinweis.
  const lauf = (einstellungen: Partial<ReturnType<typeof einst>>) =>
    statusLeiste(stand({ engine: motor({ running: true, startedOutputId: 'cable-in' }), einstellungen: einst(einstellungen), gestartet: { floorId: 'mic-a', interpreterId: 'mic-b' } }));
  const gleichGeblieben = lauf({});
  const umgestellt = lauf({ floorId: 'mic-b', interpreterId: 'mic-a', outputId: 'lautsprecher' });
  const hinweis = 'Wirkt erst nach Stopp und erneutem Start.';
  const abschnittImLauf = geraeteAbschnitt(stand({ engine: motor({ running: true, floorDb: -20, interpreterDb: -30, startedOutputId: 'cable-in' }), einstellungen: einst({ floorId: 'mic-b' }), gestartet: { floorId: 'mic-a', interpreterId: 'mic-b' } }));
  ok(
    von([60, 61], (nr) => beginnt(nr, 'Panel Audiogerät') && nennt(nr, 'Wirkt erst nach Stopp und erneutem Start.', 'gestartete', 'E10')) && nennt(60, '`core/engine.ts`') && nennt(61, 'Karte') &&
      ['floor', 'dolmetscher', 'ausgabe'].every((id) => gleichGeblieben.find((i) => i.id === id)?.state === 'ok' && umgestellt.find((i) => i.id === id)?.state === 'warn' && (umgestellt.find((i) => i.id === id)?.detail ?? '').includes(hinweis)) &&
      abschnittImLauf.choices.find((c) => c.key === 'floor')?.levelDb === undefined && abschnittImLauf.choices.find((c) => c.key === 'dolmetscher')?.levelDb === -30 && wurzel.includes('gestartet,') && akt.includes('gestartetMerken({ floorId: geraete.floorId, interpreterId: geraete.interpreterId });') && engine.includes('async start(devices: Devices)'),
    'IN Funktionsliste Nr. 60, 61: im Lauf zeigen floor, dolmetscher und ausgabe das gestartete Gerät, eine geänderte Einstellung gibt warn mit dem Hinweis, der Pegel steht nur unter der Wahl des gestarteten Geräts',
  );
}
{
  const roh = /\b(?:bg|text|border|ring|fill|stroke|from|to|via|divide|outline|accent|shadow|decoration|placeholder)-(?:neutral|red|green|yellow|white|black|amber|zinc|slate|gray|stone|orange|blue|sky|emerald|lime|rose)(?:-\d+)?(?:\/\d+)?\b/;
  const hex = /#[0-9a-fA-F]{3,8}\b/;
  const fl = ohneKommentar(wurzel + live + panel + obf + akt + brk + css);
  ok(
    beginnt(63, 'Rahmen') && nennt(63, '48', 'Tokens', '`views/LiveBereich.tsx`', 'Pegelspur', 'Gelb') && !roh.test(fl) && !hex.test(fl),
    'IN Funktionsliste Nr. 63: die rohen Farben der Oberfläche sind Tokens (keine rohe Klasse, kein Hex in Views, Ableitungen und globals.css)',
  );
}
ok(
  von([64, 65, 67], (nr) => beginnt(nr, 'Rahmen') && nennt(nr, '`views/InterpreterOberflaeche.tsx`')) && nennt(65, 'Mikrofon-Probe') && wurzel.indexOf('listDevices(!knownLabels)') > 0 && wurzel.indexOf('listDevices(!knownLabels)') < wurzel.indexOf(RUECKGABE) &&
    wurzel.includes('if (myGeneration !== generation) return;') && wurzel.includes('debounceTimer = setTimeout(load, 500);') && wurzel.includes("navigator.mediaDevices.addEventListener('devicechange', onDeviceChange);") && wurzel.includes('setDevicesLoaded(true);') &&
    wurzel.includes('if (labelsAvailable) knownLabels = true;') && engine.includes('if (withProbe) {'),
  'IN Funktionsliste Nr. 64, 65, 67: Geräteliste, Mikrofon-Probe und Nachziehen laufen zeichengleich in der Wurzel-View vor jeder Bedingung',
);
ok(
  unveraendert(66) && nennt(66, '`core/engine.ts`', 'unbekannt') && gebunden(66, 'core/engine.ts') && engine.includes('labelsAvailable'),
  'IN Funktionsliste Nr. 66: labelsAvailable bleibt; die Oberfläche liest es („unbekannt“ ohne lesbare Namen)',
);
ok(
  von([68, 69, 70], (nr) => unveraendert(nr) && nennt(nr, '`shared/virtual-cable.ts`')) && !GEAENDERT_KANON.has('apps/interpreter/src/shared/virtual-cable.ts') && nennt(68, 'geraetKarte', 'Kabelkarten') && liveF.includes('const kind = selected ? detectCable(selected.label) : null;') &&
    liveF.includes('counterpartPresent(kind, inputLabels)') && kabel.includes('export function detectCable(') && kabel.includes('export function zoomInputDisplayName('),
  'IN Funktionsliste Nr. 68–70: die Kabel-Erkennung, die acht Kabelarten und der Name für Zoom bleiben; die Karten rufen sie wie bisher',
);
ok(
  von([71, 72, 73], (nr) => unveraendert(nr) && nennt(nr, '`main/index.ts`')) && hauptIndex.includes("ipcMain.handle('cable:openDownload'") && hauptIndex.includes('function showOrCreateWindow()') && hauptIndex.includes("app.on('window-all-closed'"),
  'IN Funktionsliste Nr. 71–73: Download-Kanal, Einzelinstanz und Beenden im Main bleiben',
);
ok(
  unveraendert(74) && nennt(74, '`main/index.ts`', '`preload/index.ts`', '`shared/api.ts`', '`lib/bruecken.ts`', 'E2', 'master-link', 'Statusleiste') && hauptIndex.includes("initAppRuntime({ csp: true, appId: 'jm-interpreter', appName: 'JM Interpreter' })") && !/masterLink:\s*false/.test(hauptIndex) &&
    preload.includes("ipcRenderer.invoke('jmps:master-link')") && preload.includes("ipcRenderer.on('jmps:master-link', listener)") && api.includes('masterLink: () => Promise<MasterLinkMeldungZeile | null>;') && api.includes('onMasterLink: (cb: (m: MasterLinkMeldungZeile) => void) => () => void;') &&
    brk.includes('export const MASTER_LINK_QUELLE') && wurzel.includes('useBrueckenWert(MASTER_LINK_QUELLE)') && obf.includes('masterLinkStatusItem(s.masterLink)') && !/control-server|fernsteuerung/i.test(ohneKommentar(preload + api + hauptIndex)),
  'IN Funktionsliste Nr. 74: der Main bleibt; der Preload bekam nur die lesende Master-Link-Brücke (E2), der Eintrag master-link steht in der Statusleiste, es gibt weiter keine Fernsteuerung',
);
ok(
  unveraendert(75) && nennt(75, '`store/settings.ts`') && gebunden(75, 'store/settings.ts') && store.includes("{ name: 'jm-interpreter-settings' }") && store.includes('persist('),
  'IN Funktionsliste Nr. 75: der Speicher bleibt (zustand mit persist, Name jm-interpreter-settings); die Änderung trägt den Verweis Altfehler IN-8',
);

// ── Ausgabe, Tastatur (Nr. 76–81) ──
ok(
  unveraendert(76) && nennt(76, '`core/engine.ts`', '`main/index.ts`', 'Wurzel-View') && gebunden(76, 'core/engine.ts') && engine.includes('setSinkId') && !/@jm\/output-window|output:zustand/.test(quellen + hauptIndex),
  'IN Funktionsliste Nr. 76: der Interpreter hat weiter kein Ausgabefenster; die Ausgabe ist Ton aus dem Renderer der Wurzel-View',
);
ok(
  beginnt(77, 'Rahmen') && nennt(77, 'TallyButton', 'E1') && !/keydown|onKeyDown|onKeyUp|globalShortcut|before-input-event|Menu\./.test(quellen + ohneKommentar(hauptIndex)) && !/shortcut/.test(quellen),
  'IN Funktionsliste Nr. 77: weiter keine Tastaturkürzel (kein keydown, kein shortcut an der Haupttaste)',
);
ok(
  beginnt(78, 'Panel') && nennt(78, '`packages/ui/src/components/SettingsPanel.tsx`', 'Escape', 'O1') && quelle('packages/ui/src/components/SettingsPanel.tsx').includes('export function panelTaste(') && !/onKeyDown/.test(ohneKommentar(panel)) && wurzel.includes('onSettingsChange='),
  'IN Funktionsliste Nr. 78: die Panel-Tasten gelten über panelTaste des gemeinsamen Panels; der Interpreter hängt keine eigene Taste an',
);
ok(
  beginnt(79, 'Panel Ducking') && nennt(79, 'sieben', 'sofort') && (panel.match(/type="range"/g) ?? []).length === 1 && panel.includes('{DUCKING_REGLER.map(') && panel.includes('{VORVERSTAERKUNG_REGLER.map('),
  'IN Funktionsliste Nr. 79: die sieben Regler sind native Regler im Panel Ducking, jeder Schritt wirkt sofort',
);
ok(
  beginnt(81, 'Panel') && nennt(81, 'Reihenfolge im Dokument', 'Haupttaste', 'Download-Knopf') && panel.includes('data-interpreter="bypass"') && live.includes('<TallyButton'),
  'IN Funktionsliste Nr. 81: Knöpfe und Kästchen lösen weiter den Klick aus, die Tab-Reihenfolge ist die des Dokuments',
);

// ── Gemerkte Zustände (Nr. 82–86): jm-interpreter-settings unverändert, jm-theme neu (E5) ──
ok(
  unveraendert(82) && nennt(82, '`store/settings.ts`', 'jm-interpreter-settings', 'jm-theme', 'E5', '`packages/ui/src/lib/theme.ts`', 'thresholdDb', 'bypass') && gebunden(82, 'store/settings.ts') && quelle('packages/ui/src/lib/theme.ts').includes("export const THEME_SCHLUESSEL = 'jm-theme';") && !/localStorage|setTheme|classList/.test(quellen) &&
    ['thresholdDb', 'duckDb', 'attackMs', 'releaseMs', 'holdMs', 'floorGainDb', 'interpreterGainDb'].every((k) => quelle('shared/ducking.ts').includes(`${k}:`)) && ['floorId', 'interpreterId', 'outputId', 'bypass'].every((k) => store.includes(`${k}:`)),
  'IN Funktionsliste Nr. 82: jm-interpreter-settings bleibt mit denselben elf Feldern, dazu der zweite Schlüssel jm-theme (E5, packages/ui/src/lib/theme.ts); die App selbst greift nicht auf localStorage zu',
);
ok(
  beginnt(84, 'Panel Audiogerät') && nennt(84, 'nicht verfügbar: ‹ID›', 'Gerät nicht gefunden', 'Befund 5', '`store/settings.ts`') && !/lastLabel/.test(quellen) && store.includes("floorId: '',") && store.includes("interpreterId: '',") && store.includes("outputId: '',") &&
    statusLeiste(stand({ einstellungen: einst({ floorId: 'weg' }) })).find((i) => i.id === 'floor')?.state === 'error',
  'IN Funktionsliste Nr. 84: gemerkt wird nur die ID; eine ID außerhalb der Liste bleibt gewählt („nicht verfügbar: ‹ID›“) und der Eintrag zeigt „Gerät nicht gefunden“ (Befund 5)',
);
ok(
  beginnt(86, 'Rahmen') && nennt(86, 'jm-theme', 'E5', '`packages/ui/src/lib/theme.ts`', 'gestartet', 'Panel') && !/localStorage|sessionStorage/.test(quellen),
  'IN Funktionsliste Nr. 86: nicht gemerkt bleibt alles außer den zwei Schlüsseln; neu im Speicher der Sitzung sind die Eingänge des Starts und der Zustand des Panels; Hell/Dunkel ist jetzt gemerkt (jm-theme, E5)',
);

// ── Abschnitte 8, 9, 10 und der Kopf widersprechen den Haken nicht ──
{
  const ab = (n: number, bis_?: number): string => {
    const von_ = text.indexOf(`## ${n} · `);
    return text.slice(von_, bis_ === undefined ? text.length : text.indexOf(`## ${bis_} · `));
  };
  const intro = (n: number): string => {
    const s = ab(n);
    return s.slice(0, s.indexOf('|---'));
  };
  const abschnitt1 = intro(1);
  const abschnitt2 = intro(2);
  const abschnitt6 = intro(6);
  const abschnitt7 = intro(7);
  const abschnitt8 = ab(8, 9);
  const abschnitt9 = ab(9, 10);
  const abschnitt10 = ab(10);
  const kopf = text.slice(0, text.indexOf('## 1 · '));
  const kopfFlach = flach(kopf);
  const stand_ = kopfFlach.slice(kopfFlach.indexOf('- **Stand:**'), kopfFlach.indexOf('- **Gelesen'));
  const befund = (n: number): string => abschnitt10.slice(abschnitt10.indexOf(`\n${n}. `), abschnitt10.indexOf(`\n${n + 1}. `) === -1 ? undefined : abschnitt10.indexOf(`\n${n + 1}. `));
  const a8 = flach(abschnitt8);
  const a9 = flach(abschnitt9);

  ok(/zum Zeitpunkt der Erhebung \(`d7cdd79ce0`\)/.test(stand_) && /Am Ende der Welle 2a gilt das nicht mehr/.test(stand_) && !/der Code war seither unverändert/.test(stand_), 'IN Funktionsliste Stand: „Code unverändert“ gilt nur zum Zeitpunkt der Erhebung (d7cdd79ce0)');
  ok(
    /geänderten Code-Dateien unter `apps\/interpreter\/src`/.test(stand_) && !/nennen jede geänderte Datei/.test(stand_),
    'IN Funktionsliste Stand: die Haken nennen die geänderten Code-Dateien unter src (nicht „jede geänderte Datei“)',
  );
  {
    const codeDateien = GEAENDERT.filter((p) => p.startsWith('apps/interpreter/src/')).map((p) => p.slice('apps/interpreter/src/'.length));
    const genannt = (d: string): boolean => alle.some((z) => [...z.zellen[6].matchAll(PFAD)].some((m) => kanon(m[1]) === `apps/interpreter/src/${d}`));
    const fehlt = codeDateien.filter((d) => !genannt(d));
    ok(fehlt.length === 0, `IN Funktionsliste Stand: jede geänderte Code-Datei unter src/ steht in einem Haken (fehlt: ${fehlt.join(', ') || 'nichts'})`);
    const fremdeDateien = alle.flatMap((z) => [...z.zellen[6].matchAll(PFAD)].map((m) => kanon(m[1]))).filter((p) => /(?:^|\/)(?:package\.json|tsconfig[^/]*\.json)$|\/test\//.test(p));
    ok(fremdeDateien.length === 0, `IN Funktionsliste Stand: Tests, package.json und tsconfig stehen in keinem Haken (${fremdeDateien.join(', ') || 'keine'})`);
  }
  ok(/Der Interpreter hatte zum Zeitpunkt der Erhebung \(`d7cdd79ce0`\) keinen Ordner `test\/ui`/.test(kopfFlach) && !/der Umbau legt sie an/.test(kopfFlach), 'IN Funktionsliste Kopf: „kein Ordner test/ui“ gilt nur zum Zeitpunkt der Erhebung; der Umbau hat ihn angelegt');
  ok(/künftig wo[^]*Aufgabe e/.test(kopf) && /apps\/interpreter\/test\/ui\/funktionsliste\.test\.ts/.test(kopf) && !/den der Umbau anlegt\)/.test(kopf) && /Panel \(Abschnitt Audiogerät, Abschnitt Ducking\)/.test(kopfFlach) && /Überbrückt-Anzeige/.test(kopfFlach), 'IN Funktionsliste Kopf: „künftig wo“ ist gefüllt und abgehakt, das Ortsregister nennt die Abschnitte des Panels');
  ok(
    /Zum Zeitpunkt der Erhebung gab es einen einzigen Abschnitt im Hauptfenster/.test(kopfFlach) && !/Es gibt einen einzigen Abschnitt im Hauptfenster; Ansichten werden nicht gewechselt/.test(kopfFlach) && /im neuen Aufbau bleibt es bei einer Ansicht/.test(kopfFlach),
    'IN Funktionsliste Kopf: „ein einziger Abschnitt im Hauptfenster“ gilt zum Zeitpunkt der Erhebung; im neuen Aufbau bleibt es bei einer Ansicht (Nr. 1)',
  );
  {
    const fern = kopfFlach.slice(kopfFlach.indexOf('- **Fernsteuerung:**'), kopfFlach.indexOf('- **`window.confirm`'));
    ok(
      /E2/.test(fern) && /Master-Link/.test(fern) && /zum Zeitpunkt der Erhebung/.test(fern) && !/keine Verben, keinen Master-Link und keinen Kanal/.test(fern) && !/der Umbau ergänzt weder Meldung noch Abschnitt noch Statuseintrag dafür\./.test(fern),
      'IN Funktionsliste Kopf: „keinen Master-Link“ gilt zum Zeitpunkt der Erhebung; seit Welle 2a liest der Renderer die Master-Link-Meldung (E2), die Fernsteuerung bleibt aus',
    );
    const storage = kopfFlach.slice(kopfFlach.indexOf('**`window.confirm`:**'));
    ok(
      /zum Zeitpunkt der Erhebung/.test(storage) && /jm-theme/.test(storage) && /E5/.test(storage) && !/genau einer, der Schlüssel `jm-interpreter-settings` \(Nr\. 82\); \*\*`sessionStorage`\*\*/.test(storage) && !/Gemerkt wird nur der `localStorage`-Schlüssel \(Abschnitt 7\)\./.test(storage),
      'IN Funktionsliste Kopf: „localStorage: genau einer“ und „gemerkt wird nur“ gelten zum Zeitpunkt der Erhebung; jm-theme (E5) kommt dazu',
    );
    ok(/Zeilennummern in „heute wo“ gelten für `d7cdd79ce0`/.test(kopfFlach) && /`App\.tsx`/.test(kopfFlach.slice(kopfFlach.indexOf('- **Pfade:**'), kopfFlach.indexOf('- **Zustands-Kürzel'))), 'IN Funktionsliste Kopf: die Zeilennummern in „heute wo“ gelten für d7cdd79ce0; geänderte Dateien sind genannt');
  }
  ok(/Zum Zeitpunkt der Erhebung/.test(abschnitt1) && /TallyButton/.test(abschnitt1) && /Welle 2a/.test(abschnitt1) && !/Keine Navigation, kein Panel, keine Statusleiste \(so zum Zeitpunkt der Erhebung\)\./.test(abschnitt1) && !/die Bedienelemente sind einfache/.test(abschnitt1), 'IN Funktionsliste Abschnitt 1: „kein Panel, keine Statusleiste, einfache button-Elemente“ gilt zum Zeitpunkt der Erhebung, seit Welle 2a TallyButton und AppShell');
  ok(/Zum Zeitpunkt der Erhebung/.test(abschnitt2) && /E10/.test(abschnitt2) && /Statusleiste/.test(abschnitt2) && !/Der Interpreter hat keinen Dialog, keinen Toast und keine Rückfrage\. Meldungen laufen über/.test(abschnitt2), 'IN Funktionsliste Abschnitt 2: „Meldungen laufen über die Karten“ gilt zum Zeitpunkt der Erhebung; seit Welle 2a Statusleiste und Hinweis an den Wahlen (E10), weiter kein Dialog');
  ok(/zum Zeitpunkt der Erhebung/.test(abschnitt6) && /Nr\. 78 bis 81/.test(abschnitt6) && !/wie die Felder heute auf die Tastatur reagieren\./.test(abschnitt6), 'IN Funktionsliste Abschnitt 6: „heute“ gilt zum Zeitpunkt der Erhebung, die Änderungen stehen in Nr. 78 bis 81');
  ok(/zum Zeitpunkt der Erhebung/i.test(abschnitt7) && /jm-theme/.test(abschnitt7) && /E5/.test(abschnitt7) && !/Gemerkt wird in genau einem `localStorage`-Schlüssel des Renderers und in nichts sonst/.test(abschnitt7), 'IN Funktionsliste Abschnitt 7: „genau ein localStorage-Schlüssel“ gilt zum Zeitpunkt der Erhebung; jm-theme (E5) schreibt jetzt');
  ok(
    /zum Zeitpunkt der Erhebung/i.test(a8) && /masterLink/.test(a8) && /onMasterLink/.test(a8) && /jmps:master-link/.test(a8) && /E2/.test(a8) && !/Keine\s+Master-Link-Funktion \(`masterLink`, `onMasterLink`\)/.test(a8) && !/entscheidet der Umbau/.test(a8) && !/Der einzige Kanal trägt das Präfix/.test(a8),
    'IN Funktionsliste Abschnitt 8: Master-Link-Funktionen und -Kanal fehlten zum Zeitpunkt der Erhebung und sind jetzt ergänzt (E2), der Preload hat zwei Kanäle',
  );
  ok(/\| `masterLink\(\)` \| `jmps:master-link` \| invoke \|/.test(abschnitt8) && /\| `onMasterLink\(cb\)` \| `jmps:master-link` \| Ereignis \|/.test(abschnitt8), 'IN Funktionsliste Abschnitt 8: die Tabelle nennt masterLink() und onMasterLink(cb)');
  {
    const preloadZeilen = preload.split('\n');
    const apiZeilen = api.split('\n');
    const bei = (z: string[], s: string): number => z.findIndex((l) => l.includes(s)) + 1;
    const a = /jetzt in `src\/shared\/api\.ts:(\d+)-(\d+)`/.exec(a8);
    const b = /Kontextisolation in `src\/preload\/index\.ts:(\d+)-(\d+)`/.exec(a8);
    ok(
      a !== null && Number(a[1]) === bei(apiZeilen, 'export interface JmInterpreterApi') && apiZeilen[Number(a[2]) - 1] === '}' && b !== null && Number(b[1]) === bei(preloadZeilen, 'if (process.contextIsolated) {') && preloadZeilen[Number(b[2]) - 1] === '}',
      'IN Funktionsliste Abschnitt 8: die Zeilenverweise auf api.ts (Typ) und preload/index.ts (Kontextisolation) stimmen mit dem heutigen Code',
    );
  }
  ok(
    !/der Lauf steht \*\*nicht\*\* im Job „Selbsttests“/.test(a9) && /ci-checks\.yml/.test(a9) && /Task 29/.test(a9) && /Zeitpunkt der Erhebung/.test(a9) && quelle('.github/workflows/ci-checks.yml').includes('run: npm run selftest -w @jm/interpreter'),
    'IN Funktionsliste Abschnitt 9: der Selbsttest läuft jetzt im Job „Selbsttests“ der CI (Befund 11, Task 29), „nicht im Job“ gilt zum Zeitpunkt der Erhebung',
  );
  ok(/Welle 2a/.test(abschnitt10.slice(0, 700)) && /Zeitpunkt der Erhebung/.test(abschnitt10.slice(0, 700)), 'IN Funktionsliste Abschnitt 10: die Einleitung nennt, dass die Befunde den Stand der Erhebung beschreiben');
  ok(
    bis(1, 16).every((n) => /Welle 2a:/.test(befund(n))) && /E10/.test(befund(1)) && /E10/.test(befund(4)) && /Nr\. 8, 9, 80/.test(befund(2)) && /nicht verfügbar: ‹ID›/.test(befund(5)) && /E10/.test(befund(7)) && /Wurzel-View/.test(befund(9)) && /E5/.test(befund(12)) && /test\/ui/.test(befund(15)),
    'IN Funktionsliste Abschnitt 10: jeder der 16 Befunde nennt seinen Stand nach der Welle (E10, Nr. 8/9/80, nicht verfügbar, Wurzel-View, E5, test/ui)',
  );
  ok(
    [3, 6, 10, 13, 16].every((n) => /Welle 2a:[^]*unverändert/.test(befund(n))) && /Welle 2a:[^]*gleich/.test(befund(8)) && /Task 29/.test(befund(11)) && /`apps\/interpreter\/package\.json:17`/.test(befund(11)) && !/`apps\/interpreter\/package\.json:16`/.test(abschnitt10),
    'IN Funktionsliste Abschnitt 10: die Befunde 3, 6, 10, 13 und 16 bleiben unverändert; Befund 11 nennt den CI-Schritt und die Zeile `package.json:17` der Erhebung',
  );
  // Altfehler Stufe 2: hinter dem Satz der Welle 2a (er bleibt stehen, Widerruf ohne Löschen) steht der Satz zu IN-3 bzw. IN-8.
  ok(
    /Welle 2a: unverändert \(`hauptTaste` sperrt beim Start nicht[^]*\n {3}Altfehler Stufe 2 \(IN-3\): behoben:[^]*Startet …[^]*15 s/.test(befund(3)) &&
      /Welle 2a: gleich: der Knopf setzt dieselben sieben Werte zurück[^]*\n {3}Altfehler Stufe 2 \(IN-8\): behoben:[^]*fünf Ducking-Werte[^]*Vorverstärkungen bleiben/.test(befund(8)) &&
      /Altfehler Stufe 2 \(IN-3, IN-8\)/.test(befund(15)) && /Die Altfehler-Stufe 2 änderte danach Engine und Store/.test(stand_),
    'IN Funktionsliste Abschnitt 10: Befund 3 und 8 behalten den Satz der Welle 2a und nennen dahinter Altfehler Stufe 2 (IN-3, IN-8); Befund 15 und der Stand nennen die Änderung an Engine und Store',
  );
  {
    const nr = (k: string): string => text.slice(text.indexOf(k));
    ok(
      !/`R\/store\/settings\.ts:14-31`/.test(text) && !/`R\/store\/settings\.ts:20-22`/.test(text) && !/`R\/store\/settings\.ts:24`/.test(text) && /`R\/store\/settings\.ts:14-27`/.test(nr('|75|')) && /`R\/store\/settings\.ts:18-20`/.test(nr('|84|')) && /`R\/store\/settings\.ts:21`/.test(nr('|85|')),
      'IN Funktionsliste Zeilenverweise: store/settings.ts :14-27 (Nr. 75, 82), :18-20 (Nr. 84), :21 (Nr. 85)',
    );
    const storeZeilen = store.split('\n');
    ok(
      storeZeilen[13].startsWith('export const useSettings = create') && storeZeilen[26] === ');' && storeZeilen[17] === "      floorId: ''," && storeZeilen[19] === "      outputId: ''," && storeZeilen[20] === '      bypass: false,' && storeZeilen[22].includes('reset:'),
      'IN Funktionsliste Zeilenverweise: die Zeilen 14, 27, 18–20, 21 und 23 von store/settings.ts sind die genannten',
    );
  }
  ok(nennt(1, 'InterpreterOberflaeche') && nennt(47, 'InterpreterOberflaeche'), 'IN Funktionsliste: Nr. 1 und Nr. 47 nennen die Wurzel-View');
}
