// ─────────────────────────────────────────────────────────────────────────────
// Funktionsliste nach dem Umbau (UX Welle 2a, Recorder e; Spec 10 „Kein Funktionsverlust“). Jede der 138 Zeilen in den
// Abschnitten 1–7 von docs/ux/funktionslisten/recorder.md ist in „künftig wo“ abgehakt: „✓ “ und ein Ort des Ortsregisters,
// „unverändert (…)“, „entfällt (…, E…)“ oder „ersetzt durch {Ort} (…, E…)“. E-Verweise nur auf E1–E16 dieses Plans. Jede
// genannte Datei existiert, Groß- und Kleinschreibung wie im Repo. Dazu Querprüfungen gegen den Code: die Änderungen der
// Aufgaben 19–21 (gemessener Zustand, Meldung bis „OK“, Toast oben, Tastenfolge, Sperre im Ruhezustand, NumberInput, Sperre bei
// offenem Eingang, Pegel vor Hinweisband, Kopf) stehen als Haken in den betroffenen Zeilen, und der Code trägt, was der Haken sagt.
// Läuft im Paketordner apps/recorder (npm run selftest -w @jm/recorder).
// „unverändert (…)“ darf keine Datei nennen, die seit der Erhebung (d7cdd79ce0) geändert wurde, außer sie bekam nur die lesenden
// Brücken (E2): dann steht der Hinweis im Haken; oder ein Altfehler der Stufe 2 hat sie geändert: dann steht „Altfehler <ID>“ im
// Haken, und die Liste der ID in ALTFEHLER nennt die Datei (B7, R6). Der Abgleich der statischen Liste GEAENDERT mit git läuft nur
// mit JM_FUNKTIONSLISTE_GIT=1 (Arbeitsbaum gegen die Erhebung, damit auch eine noch nicht eingecheckte Datei zählt).
// ─────────────────────────────────────────────────────────────────────────────

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { gleich, leseText, ok } from '@jm/ui/testhilfe';

const LISTE = '../../docs/ux/funktionslisten/recorder.md';

/**
 * Ortsregister: Rahmen, Kopf, Live-Bereich (Preset-Leiste, Hinweisband, Transport, Pegel, Gain, Ziel), Arbeitsbereich Zeitplan,
 * Statusleiste, Panel je Abschnitt. Der Main und das Unveränderte stehen als „unverändert (…)“ (der Recorder hat keinen Tray).
 */
const ABSCHNITTE = ['Audiogerät', 'Format', 'Ziel', 'Fernsteuerung'];
const ORTE: readonly string[] = [
  'Rahmen',
  'Kopf',
  'Live-Bereich',
  'Live-Bereich Preset-Leiste',
  'Live-Bereich Hinweisband',
  'Live-Bereich Transport',
  'Live-Bereich Pegel',
  'Live-Bereich Gain',
  'Live-Bereich Ziel',
  'Arbeitsbereich Zeitplan',
  'Statusleiste',
  'Panel',
  ...ABSCHNITTE.map((a) => `Panel ${a}`),
];

/** Zeilen insgesamt und je Abschnitt 1–7, wie die Liste im Kopf sie nennt (Stand 195e5f0649). */
const GESAMT = 138;
const JE_ABSCHNITT = [44, 19, 48, 0, 1, 11, 15];

const ERHEBUNG = 'd7cdd79ce0';

/**
 * Alle Dateien von apps/recorder, die seit der Erhebung geändert, angelegt oder gelöscht wurden, als Pfad ab der Repo-Wurzel. Ein
 * „unverändert (…)“ darf sie nur nennen, wenn der Haken E2 nennt und die Datei nur die lesenden Brücken bekam (NUR_MELDUNG).
 * Mit JM_FUNKTIONSLISTE_GIT=1 prüft der Test unten, dass git dieselbe Menge kennt.
 */
const GEAENDERT = [
  'package.json',
  'src/main/control-server.ts',
  'src/main/eingang-waechter.ts',
  'src/main/index.ts',
  'src/main/ipc.ts',
  'src/main/netzordner.ts',
  'src/main/platz.ts',
  'src/main/recorder.ts',
  'src/main/wav.ts',
  'src/preload/index.ts',
  'src/renderer/src/App.tsx',
  'src/renderer/src/components/Topbar.tsx',
  'src/renderer/src/globals.css',
  'src/renderer/src/lib/aktionen.ts',
  'src/renderer/src/lib/bruecken.ts',
  'src/renderer/src/lib/fernbefehl.ts',
  'src/renderer/src/lib/oberflaeche.ts',
  'src/renderer/src/lib/platz.ts',
  'src/renderer/src/store/recorder.ts',
  'src/renderer/src/views/Einstellungen.tsx',
  'src/renderer/src/views/LiveBereich.tsx',
  'src/renderer/src/views/RecorderOberflaeche.tsx',
  'src/renderer/src/views/RecorderView.tsx',
  'src/renderer/src/views/SchliessenFrage.tsx',
  'src/shared/fernsteuerung.ts',
  'src/shared/netzordner.ts',
  'src/shared/schliessen.ts',
  'src/shared/types.ts',
  'test/recorder.test.ts',
  'test/store.test.ts',
  'test/ui/altfehler.test.ts',
  'test/ui/bruecken.test.ts',
  'test/ui/fernbefehl.test.ts',
  'test/ui/funktionsliste.test.ts',
  'test/ui/hilfe.ts',
  'test/ui/live.test.tsx',
  'test/ui/netzordner.test.ts',
  'test/ui/oberflaeche.test.ts',
  'test/ui/panel.test.tsx',
  'test/ui/platz.test.ts',
  'test/ui/rahmen.test.tsx',
  'test/ui/schliessen.test.tsx',
  'test/ui/selftest.ts',
  'test/ui/testzustand.ts',
  'test/ui/werkzeug.test.tsx',
  'test/wav.test.ts',
  'tsconfig.test.json',
].map((p) => `apps/recorder/${p}`);

/**
 * Dateien, die nur die lesenden Brücken bekamen: der Steuerserver (Fernsteuerungs-Meldung E2). Verhalten und Befehle blieben.
 * Seit der Altfehler-Stufe 2 bekamen main/index.ts (RE-7b: Prüfung des Show-Ordners), preload/index.ts und shared/types.ts
 * (RE-2: `ablehnung`, `disarm` mit Ergebnis; RE-7b: `netzordnerBestaetigen`, Felder der Show-Vorgabe) mehr; sie stehen darum
 * nicht mehr hier, ein Haken braucht für sie den Verweis auf den Altfehler (B7, wie der Player in Stufe 1).
 */
const NUR_MELDUNG = new Set(['apps/recorder/src/main/control-server.ts']);

/**
 * Altfehler Stufe 2 (Plan 2026-11-26, Task 6; B7): je erlaubter Recorder-ID die Dateien (ab der Repo-Wurzel), die der Befund
 * geändert hat, wie im Player (Ruling R6). „Altfehler <ID>“ im Haken entlastet ein „unverändert (…)“, das eine geänderte Datei
 * nennt, nur, wenn die Liste dieser ID die Datei enthält; dann für die ganze Änderung des Befunds, nicht nur für lesende Brücken.
 * Erlaubt sind genau RE-2 (ARM/DISARM und „Eingang schließen“ in der Aufnahme abgelehnt, gemeinsamer Ablehnungsweg B6; seit Ruling R11
 * auch die Logzeile einer Ablehnung im Wettlauf), RE-2b (RECORD ON ohne Zielordner abgelehnt), RE-7b (Zielordner aus der Show geprüft,
 * Netzwerkordner erst nach „Übernehmen“) und RE-NAS (Ordnerprüfung eines Presets außerhalb der Warteschlange); Task 7: RE-3 (Fehlerfeld,
 * die Aufnahme endet sauber nach einem Schreibfehler oder ohne Blöcke), RE-7a (Rückfrage beim Schließen während einer Aufnahme) und
 * RE-PLATZ (freier Platz als Restzeit in der Statusleiste). RE-3 nennt zusätzlich store/recorder.ts (das Neuöffnen eines Presets nur über
 * arm, Pre-flight K7). Fix-Runde 2 (Ruling R21): RE-3 nennt auch main/wav.ts (MultiWavWriter meldet die erste kaputte Spur mit ihrer Datei).
 */
const APP = (p: string): string => `apps/recorder/src/${p}`;
const RENDERER = (p: string): string => `apps/recorder/src/renderer/src/${p}`;
const ALTFEHLER = new Map<string, readonly string[]>([
  [
    'RE-2',
    [APP('main/recorder.ts'), APP('main/ipc.ts'), APP('preload/index.ts'), APP('shared/types.ts'), RENDERER('store/recorder.ts'), RENDERER('lib/fernbefehl.ts'), RENDERER('lib/oberflaeche.ts')],
  ],
  ['RE-2b', [RENDERER('store/recorder.ts'), RENDERER('lib/fernbefehl.ts'), APP('main/ipc.ts'), APP('preload/index.ts'), APP('shared/types.ts')]],
  [
    'RE-7b',
    [
      APP('shared/netzordner.ts'),
      APP('main/netzordner.ts'),
      APP('main/index.ts'),
      APP('main/ipc.ts'),
      APP('preload/index.ts'),
      APP('shared/types.ts'),
      RENDERER('store/recorder.ts'),
      RENDERER('lib/oberflaeche.ts'),
      RENDERER('views/LiveBereich.tsx'),
      RENDERER('views/RecorderOberflaeche.tsx'),
    ],
  ],
  ['RE-NAS', [RENDERER('store/recorder.ts')]],
  [
    'RE-3',
    [
      APP('main/recorder.ts'),
      APP('main/eingang-waechter.ts'),
      APP('main/wav.ts'),
      APP('main/ipc.ts'),
      APP('shared/types.ts'),
      RENDERER('lib/oberflaeche.ts'),
      RENDERER('views/LiveBereich.tsx'),
      RENDERER('store/recorder.ts'),
    ],
  ],
  [
    'RE-7a',
    [
      APP('shared/schliessen.ts'),
      APP('main/index.ts'),
      APP('preload/index.ts'),
      APP('shared/types.ts'),
      RENDERER('store/recorder.ts'),
      RENDERER('views/SchliessenFrage.tsx'),
      RENDERER('views/RecorderOberflaeche.tsx'),
      RENDERER('lib/oberflaeche.ts'),
    ],
  ],
  [
    'RE-PLATZ',
    [
      APP('main/platz.ts'),
      APP('main/ipc.ts'),
      APP('main/recorder.ts'),
      APP('preload/index.ts'),
      APP('shared/types.ts'),
      RENDERER('lib/platz.ts'),
      RENDERER('lib/oberflaeche.ts'),
      RENDERER('store/recorder.ts'),
      RENDERER('views/RecorderOberflaeche.tsx'),
    ],
  ],
]);
/** Verweis „Altfehler <ID>“ auf eine der erlaubten IDs; die ID steht in Gruppe 1. `(?![\w-])` trennt RE-2 von RE-2b. */
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
if (GIT_PRUEFEN && GIT === null) console.log(`RE Funktionsliste: kein git-Verlauf bis ${ERHEBUNG} (flacher Klon); die Prüfung gegen git entfällt`);

/** Datei in Backticks: Pfad mit Endung, aufgelöst nach der Pfadregel im Kopf der Liste. */
const PFAD = /`([A-Za-z0-9_./-]+\.(?:tsx|ts|css|html|json|md|mjs))`/g;
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

/** Pfadregel der Liste: Repo-Wurzel, apps/recorder/src (main, preload, shared, renderer) oder der Renderer. */
function aufgeloest(pfad: string): string {
  if (/^(?:apps|packages|docs)\//.test(pfad)) return `../../${pfad}`;
  if (/^(?:main|preload|shared|renderer)\//.test(pfad)) return `src/${pfad}`;
  return `src/renderer/src/${pfad}`;
}

/** Kanonischer Pfad ab der Repo-Wurzel nach der Pfadregel der Liste. */
function kanon(pfad: string): string {
  const a = aufgeloest(pfad);
  return a.startsWith('../../') ? a.slice('../../'.length) : `apps/recorder/${a}`;
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
  // Dateien, die ein Altfehler der Stufe 2 geändert hat, mit dem Verweis „Altfehler <ID>“, dessen Liste sie nennt (B7, R6).
  if (form === 'unverändert') {
    const ids = altfehlerIds(ohneCode);
    const veraendert = pfade.filter((p) => (GEAENDERT_KANON.has(kanon(p)) || GIT?.has(kanon(p)) === true) && !entlastet(ids, kanon(p)));
    if (veraendert.length > 0 && !/\bE2\b/.test(ohneCode)) return `unverändert mit geänderter Datei (${veraendert.join(', ')}) ohne Hinweis auf E2 und ohne Altfehler-Verweis, dessen Liste sie nennt`;
    if (veraendert.some((p) => !NUR_MELDUNG.has(kanon(p)))) return `unverändert mit einer Datei, die mehr als die lesenden Brücken bekam (${veraendert.join(', ')})`;
  }
  return null;
}

const text = leseText(LISTE);
const alle = zeilen(text);

gleich(alle.length, GESAMT, 'RE Funktionsliste: 138 Zeilen in den Abschnitten 1–7 (Stand der Erhebung)');
gleich(
  JE_ABSCHNITT.map((_, i) => alle.filter((z) => z.abschnitt === i + 1).length),
  JE_ABSCHNITT,
  'RE Funktionsliste: Zeilen je Abschnitt wie in der Erhebung (44/19/48/0/1/11/15)',
);
gleich(
  alle.map((z) => z.nr),
  alle.map((_, i) => i + 1),
  'RE Funktionsliste: Nummern fortlaufend ab 1',
);
ok(!text.replace(/`[^`]*`/g, '').includes('"') && !text.includes('\r'), 'RE Funktionsliste: keine ASCII-Anführungszeichen außerhalb von Code, kein CR');

for (const z of alle) {
  const f = zeilenFehler(z);
  ok(f === null, `RE Funktionsliste Nr. ${z.nr} abgehakt${f === null ? '' : ` – ${f}`}`);
}

// ── Die Menge der geänderten Dateien stimmt mit git überein (nur mit JM_FUNKTIONSLISTE_GIT=1 und Verlauf) ──
{
  if (GIT !== null) {
    const fehlend = [...GIT].filter((n) => n.startsWith('apps/recorder/') && !GEAENDERT_KANON.has(n));
    ok(fehlend.length === 0, `RE Funktionsliste: GEAENDERT nennt alle seit ${ERHEBUNG} geänderten Dateien von apps/recorder (fehlt: ${fehlend.join(', ') || 'nichts'})`);
    const zuviel = GEAENDERT.filter((n) => !GIT.has(n));
    ok(zuviel.length === 0, `RE Funktionsliste: GEAENDERT nennt keine Datei, die git nicht als geändert kennt (zu viel: ${zuviel.join(', ') || 'nichts'})`);
    const zitiert = alle
      .filter((z) => z.zellen[6].startsWith('✓ unverändert ('))
      .flatMap((z) => {
        const ids = altfehlerIds(z.zellen[6].replace(/`[^`]*`/g, ''));
        return [...z.zellen[6].matchAll(PFAD)].map((m) => kanon(m[1])).filter((n) => !entlastet(ids, n));
      });
    const getroffen = zitiert.filter((n) => GIT.has(n));
    ok(getroffen.every((n) => NUR_MELDUNG.has(n)), `RE Funktionsliste: keine in einem unverändert-Haken zitierte Datei bekam mehr als die lesenden Brücken, außer ein Altfehler-Verweis nennt sie in seiner Liste (${getroffen.join(', ') || 'keine'})`);
    const pakete = ['packages/suite-control-protocol/src/capabilities.ts', 'packages/show/src/index.ts'];
    ok(pakete.every((p) => !GIT.has(p)), 'RE Funktionsliste: die zitierten Pakete (capabilities.ts, Freigabeliste der Show) sind seit der Erhebung unverändert');
    const listen = [...ALTFEHLER.values()].flat();
    ok(listen.every((n) => GIT.has(n)), `RE Funktionsliste: jede Datei einer Altfehler-Liste ist laut git geändert (nicht: ${listen.filter((n) => !GIT.has(n)).join(', ') || 'nichts'})`);
  }
  // Jede Datei einer Altfehler-Liste steht in GEAENDERT: eine Liste entlastet nur, was wirklich geändert ist.
  {
    const listen = [...ALTFEHLER.values()].flat();
    ok(
      listen.length > 0 && listen.every((n) => GEAENDERT_KANON.has(n)),
      `RE Funktionsliste: jede Datei einer Altfehler-Liste steht in GEAENDERT (nicht: ${listen.filter((n) => !GEAENDERT_KANON.has(n)).join(', ') || 'nichts'})`,
    );
  }
  // Negativprobe: andere Schreibweisen derselben geänderten Datei werden erkannt, eine unveränderte nicht.
  const synth = (pfad: string, zusatz = ''): Zeile => ({ abschnitt: 3, nr: 0, zellen: ['0', '', '', '', '', '', `✓ unverändert (\`${pfad}\`): x${zusatz}`] });
  ok(
    ['views/LiveBereich.tsx', 'renderer/src/views/LiveBereich.tsx', 'apps/recorder/src/renderer/src/views/LiveBereich.tsx'].every((p) => (zeilenFehler(synth(p)) ?? '').includes('geänderter Datei')) &&
      (zeilenFehler(synth('views/LiveBereich.tsx', ' (E2)')) ?? '').includes('mehr als die lesenden Brücken') &&
      zeilenFehler(synth('main/control-server.ts', ' (E2)')) === null &&
      zeilenFehler(synth('main/stille.ts')) === null,
    'RE Funktionsliste: eine geänderte Datei wird in jeder Schreibweise erkannt; E2 entlastet nur Dateien mit den lesenden Brücken; eine unveränderte Datei ist frei',
  );
  // Fix-Runde 2 (Ruling R21, Altfehler RE-3; Probe umgestellt): main/wav.ts war bis dahin die unveränderte Probe; seit MultiWavWriter die erste
  // kaputte Spur meldet, ist sie geändert und nur „Altfehler RE-3“ entlastet sie (statt ihrer prüft die Probe oben main/stille.ts).
  ok(
    (zeilenFehler(synth('main/wav.ts')) ?? '').includes('geänderter Datei') &&
      zeilenFehler(synth('main/wav.ts', ' (Altfehler RE-3)')) === null &&
      ['RE-7a', 'RE-PLATZ', 'RE-3a'].every((id) => (zeilenFehler(synth('main/wav.ts', ` (Altfehler ${id})`)) ?? '').includes('geänderter Datei')),
    'RE Funktionsliste (Fix-Runde 2, R21): main/wav.ts gilt als geändert; nur „Altfehler RE-3“ entlastet sie, RE-7a, RE-PLATZ und RE-3a nicht',
  );
  // Der Verweis „Altfehler <ID>“ (Stufe 2, B7) entlastet eine geänderte Datei nur, wenn die Liste der ID sie nennt (R6); nur mit dem
  // Wort „Altfehler“ und nur die sieben Recorder-IDs; RE-2 und RE-2b sind getrennt. main/index.ts, preload/index.ts und shared/types.ts
  // verlassen NUR_MELDUNG: E2 allein entlastet sie nicht mehr. Task 7: „Altfehler RE-3“ entlastet main/recorder.ts seither (Probe
  // umgestellt, statt RE-3 jetzt RE-7a, RE-30 und RE-3a als fremde IDs).
  ok(
    (zeilenFehler(synth('views/LiveBereich.tsx', ' (Altfehler RE-2)')) ?? '').includes('geänderter Datei') &&
      zeilenFehler(synth('views/LiveBereich.tsx', ' (Altfehler RE-7b)')) === null &&
      zeilenFehler(synth('main/recorder.ts', ' (Altfehler RE-2)')) === null &&
      (zeilenFehler(synth('main/recorder.ts')) ?? '').includes('geänderter Datei') &&
      ['RE-2b', 'RE-7b', 'RE-NAS', 'RE-2a', 'RE-20', 'RE-2-b', 'RE-7a', 'RE-30', 'RE-3a', 'CA-11', 'PL-16a'].every((id) => (zeilenFehler(synth('main/recorder.ts', ` (Altfehler ${id})`)) ?? '').includes('geänderter Datei')) &&
      (zeilenFehler(synth('main/recorder.ts', ' (RE-2)')) ?? '').includes('geänderter Datei') &&
      zeilenFehler(synth('store/recorder.ts', ' (Altfehler RE-NAS)')) === null &&
      zeilenFehler(synth('store/recorder.ts', ' (Altfehler RE-2b)')) === null &&
      (zeilenFehler(synth('main/index.ts', ' (E2)')) ?? '').includes('mehr als die lesenden Brücken') &&
      zeilenFehler(synth('main/index.ts', ' (E2, Altfehler RE-7b)')) === null &&
      (zeilenFehler(synth('main/index.ts', ' (E2, Altfehler RE-2)')) ?? '').includes('mehr als die lesenden Brücken') &&
      (zeilenFehler(synth('preload/index.ts', ' (E2)')) ?? '').includes('mehr als die lesenden Brücken') &&
      zeilenFehler(synth('preload/index.ts', ' (Altfehler RE-2b)')) === null &&
      zeilenFehler(synth('apps/recorder/src/shared/types.ts', ' (Altfehler RE-7b)')) === null,
    'RE Funktionsliste: „Altfehler RE-7b“ entlastet views/LiveBereich.tsx, „Altfehler RE-2“ nicht; ohne ID, mit der ID eines anderen Befunds, ohne das Wort „Altfehler“ oder mit einer fremden ID nicht; main/index.ts, preload/index.ts und shared/types.ts brauchen ihren Altfehler-Verweis (B7)',
  );
  // Task 7 (B7): RE-3, RE-7a und RE-PLATZ entlasten genau die Dateien ihrer Liste, auch die neuen.
  ok(
    zeilenFehler(synth('main/recorder.ts', ' (Altfehler RE-3)')) === null &&
      zeilenFehler(synth('main/eingang-waechter.ts', ' (Altfehler RE-3)')) === null &&
      (zeilenFehler(synth('main/eingang-waechter.ts', ' (Altfehler RE-7a)')) ?? '').includes('geänderter Datei') &&
      zeilenFehler(synth('views/SchliessenFrage.tsx', ' (Altfehler RE-7a)')) === null &&
      zeilenFehler(synth('shared/schliessen.ts', ' (Altfehler RE-7a)')) === null &&
      (zeilenFehler(synth('shared/schliessen.ts', ' (Altfehler RE-PLATZ)')) ?? '').includes('geänderter Datei') &&
      zeilenFehler(synth('main/platz.ts', ' (Altfehler RE-PLATZ)')) === null &&
      zeilenFehler(synth('lib/platz.ts', ' (Altfehler RE-PLATZ)')) === null &&
      ['RE-PLATZ2', 'RE-PLATZ-a', 'RE-3'].every((id) => (zeilenFehler(synth('main/platz.ts', ` (Altfehler ${id})`)) ?? '').includes('geänderter Datei')) &&
      (zeilenFehler(synth('main/index.ts', ' (E2, Altfehler RE-PLATZ)')) ?? '').includes('mehr als die lesenden Brücken') &&
      zeilenFehler(synth('main/index.ts', ' (E2, Altfehler RE-7a)')) === null,
    'RE Funktionsliste (Task 7): „Altfehler RE-3“ entlastet main/recorder.ts und main/eingang-waechter.ts, „Altfehler RE-7a“ shared/schliessen.ts und views/SchliessenFrage.tsx, „Altfehler RE-PLATZ“ main/platz.ts und lib/platz.ts; eine fremde ID oder eine längere Schreibweise entlastet nicht',
  );
  {
    const meldung = zeilenFehler(synth('main/recorder.ts', ' und `store/recorder.ts` (Altfehler RE-2), dazu `main/index.ts`')) ?? '';
    ok(
      /geänderter Datei \(main\/index\.ts\) /.test(meldung) && zeilenFehler(synth('main/recorder.ts', ' und `main/index.ts` (Altfehler RE-2, Altfehler RE-7b)')) === null,
      'RE Funktionsliste: eine geänderte Datei, deren Liste die genannte ID nicht enthält, wird gemeldet, die übrigen sind entlastet (R6)',
    );
  }
}

const zeile = (nr: number): Zeile | undefined => alle.find((z) => z.nr === nr);
const kuenftig = (nr: number): string => zeile(nr)?.zellen[6] ?? '';
const quelle = (pfad: string): string => (gibtEs(pfad) ? readFileSync(aufgeloest(pfad), 'utf8') : '');
const beginnt = (nr: number, ...orte: string[]): boolean => orte.some((o) => kuenftig(nr).startsWith(`✓ ${o}`));
const ersetzt = (nr: number, ort: string): boolean => kuenftig(nr).startsWith(`✓ ersetzt durch ${ort}`);
const nennt = (nr: number, ...woerter: string[]): boolean => woerter.every((w) => kuenftig(nr).includes(w));
const unveraendert = (nr: number): boolean => kuenftig(nr).startsWith('✓ unverändert (');
/** Nennt der Haken der Zeile einen Altfehler-Verweis, dessen Liste die Datei (Pfad nach der Pfadregel der Liste) enthält? */
const gebunden = (nr: number, datei: string): boolean => entlastet(altfehlerIds(kuenftig(nr).replace(/`[^`]*`/g, '')), kanon(datei));
const ohneKommentar = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const von = (nrn: number[], f: (nr: number) => boolean): boolean => nrn.every(f);
const bis = (a: number, b: number): number[] => [...Array(b - a + 1).keys()].map((i) => i + a);

const wurzel = quelle('views/RecorderOberflaeche.tsx');
const panel = quelle('views/Einstellungen.tsx');
const live = quelle('views/LiveBereich.tsx');
const zeitplan = quelle('views/RecorderView.tsx');
const obf = quelle('lib/oberflaeche.ts');
const akt = quelle('lib/aktionen.ts');
const brk = quelle('lib/bruecken.ts');
const store = quelle('store/recorder.ts');
const leiste = quelle('components/PresetLeiste.tsx');
const app = quelle('App.tsx');
const ctl = quelle('main/control-server.ts');

// ── Rahmen, Kopf (Nr. 1–4): AppShell, Name nach E16, Hell/Dunkel nach E5 ──
ok(
  beginnt(1, 'Rahmen') && wurzel.includes('<AppShell') && wurzel.includes('status={statusLeiste(stand)}') && wurzel.includes('settings={<Einstellungen') && !gibtEs('components/Topbar.tsx') && nennt(1, 'E13', 'E15') && !/useRouter|<Route/.test(wurzel),
  'RE Funktionsliste Nr. 1: Aufbau im AppShell (Kopf, Inhalt, Statusleiste, Panel), eine Ansicht, die alte Kopfleiste (components/Topbar.tsx) ist weg',
);
ok(
  beginnt(3, 'Kopf') && nennt(3, 'entfällt (E16)', 'JM Audio Recorder', 'JM AUDIO RECORDER', 'Mehrkanal-Aufnahme · Dante / ASIO') && wurzel.includes('tool="Audio Recorder"') && !/Mehrkanal-Aufnahme/.test(ohneKommentar(wurzel + live + obf)),
  'RE Funktionsliste Nr. 3: Logo und Name „JM Audio Recorder“ im Kopf (früher „JM AUDIO RECORDER“), der Untertitel „Mehrkanal-Aufnahme · Dante / ASIO“ entfällt (E16)',
);
ok(
  ersetzt(4, 'Kopf') && nennt(4, 'E5', 'jm-theme', '`packages/ui/src/lib/theme.ts`', 'Light', 'Dark') && !/classList|setTheme|localStorage/.test(ohneKommentar(wurzel + live + panel)) && quelle('packages/ui/src/lib/theme.ts').includes("'jm-theme'"),
  'RE Funktionsliste Nr. 4: Hell/Dunkel ist der ThemeToggle im gemeinsamen Kopf (E5, jm-theme), der lokale Knopf „Light“/„Dark“ entfällt',
);
ok(
  unveraendert(2) && nennt(2, '`main/index.ts`', '`renderer/index.html`', 'E2') && gebunden(2, 'main/index.ts') && quelle('renderer/index.html').includes('class="dark"'),
  'RE Funktionsliste Nr. 2: die Fensterhülle bleibt (main/index.ts bekam die lesende Fernsteuerungs-Meldung, E2, und mit Altfehler RE-7b die Prüfung des Show-Ordners), index.html behält class="dark"',
);
ok(
  nennt(2, 'Altfehler RE-7a', '`shared/schliessen.ts`', '`views/SchliessenFrage.tsx`', 'Nr. 89') && gebunden(2, 'shared/schliessen.ts') && gebunden(2, 'views/SchliessenFrage.tsx') &&
    quelle('main/index.ts').includes("win.on('close', (e) => {") && quelle('main/index.ts').includes("win.on('closed', () => {"),
  'RE Funktionsliste Nr. 2 (Altfehler RE-7a): das Schließen mit shutdown() bleibt; davor fragt das Fenster in der Aufnahme nach (Ablauf in shared/schliessen.ts, Fenster in views/SchliessenFrage.tsx, Nr. 89)',
);
ok(
  beginnt(1, 'Rahmen') &&
    nennt(1, 'Altfehler RE-PLATZ', '„Platz“', 'Platz für 2 h 10 min', '`lib/platz.ts`', '`main/platz.ts`', '`fs:platz`', 'gelb unter 15 min', 'rot unter 5 min', 'Platz unbekannt', 'gesperrt wird nichts') &&
    obf.includes('platzItem(s),') && obf.indexOf('aufnahmeItem(s),') < obf.indexOf('platzItem(s),') && wurzel.includes('platz: { frei: platzFrei, spuren: separateTracks, dir }'),
  'RE Funktionsliste Nr. 1 (Altfehler RE-PLATZ, die Statusleisten-Zeile, B5): die Statusleiste zeigt hinter „Aufnahme“ den Eintrag „Platz“ (Restzeit im Zielordner), ohne neue Zeile',
);

// ── Live-Bereich: Kopf der Karte, Preset-Leiste, Hinweisband, Meldung bis „OK“ (Nr. 5–15, 44, 55–63) ──
ok(
  beginnt(5, 'Live-Bereich Transport') && nennt(5, 'Suche Audiogeräte…', 'Eingänge') && live.includes('T.aufnahme.titel') && live.includes('${stand.geraete?.length ?? 0} Eingänge') && obf.includes("sucheGeraete: 'Suche Audiogeräte…'"),
  'RE Funktionsliste Nr. 5: Überschrift „Aufnahme“ und der Zähler „Suche Audiogeräte…“ bzw. „n Eingänge“ stehen im Kopf der Transport-Karte',
);
ok(
  beginnt(6, 'Panel Audiogerät') && nennt(6, 'solange der Eingang offen ist') && obf.includes('capabilities: { refresh: true }') && obf.includes('onRefresh: () => a.geraeteAktualisieren()') && akt.includes('geraeteAktualisieren: () => void s.refreshDevices()') && panel.includes('<AudioDeviceSection {...eingangAbschnitt(stand, aktionen)} />'),
  'RE Funktionsliste Nr. 6: „Geräte aktualisieren“ ist im Panel Audiogerät, gesperrt bei offenem Eingang, und ruft refreshDevices',
);
ok(
  von(bis(7, 13), (nr) => beginnt(nr, 'Live-Bereich Preset-Leiste') && nennt(nr, '`components/PresetLeiste.tsx`')) &&
    von([45, 46, 47, 115], (nr) => beginnt(nr, 'Live-Bereich Preset-Leiste') && nennt(nr, '`components/PresetLeiste.tsx`')) &&
    !GEAENDERT_KANON.has('apps/recorder/src/renderer/src/components/PresetLeiste.tsx') &&
    wurzel.includes('presets={<PresetLeiste />}') && live.includes('{presets}') && live.indexOf('{presets}') < live.indexOf('data-recorder="transport"'),
  'RE Funktionsliste Nr. 7–13, 45–47, 115: die Preset-Leiste steht unverändert oben im Live-Bereich (E13), vor dem Transport',
);
ok(
  beginnt(14, 'Live-Bereich Hinweisband') && nennt(14, 'role=alert', '--status-warn', 'Pegel', 'Vorrang', 'Meldung', 'OK', 'E13') && live.includes('role="alert"') && live.includes('shrink-[10000]') && live.includes("--status-warn") && !/amber/.test(live) && live.indexOf('data-recorder="hinweise"') < live.indexOf('data-recorder="transport"'),
  'RE Funktionsliste Nr. 14: Hinweisband mit Variablenfarbe, die Pegel haben Vorrang (der Kasten schrumpft zuerst), dazu die Meldung des Hauptprozesses bis „OK“ (E13)',
);
ok(
  nennt(14, 'Altfehler RE-7b', 'Übernehmen', 'nie als Dialog', '`lib/oberflaeche.ts`') &&
    live.indexOf('data-recorder="netzordner"') > live.indexOf('data-recorder="hinweise"') && live.indexOf('data-recorder="netzordner"') < live.indexOf('data-recorder="transport"') &&
    live.includes('onClick={aktionen.netzordnerUebernehmen}') && live.includes('netzordnerHinweis(werte.netzordnerOffen)') && !/showMessageBox|confirm\(/.test(ohneKommentar(live)),
  'RE Funktionsliste Nr. 14 (Altfehler RE-7b): ein Netzwerkordner aus der Show steht im Hinweiskasten mit der Taste „Übernehmen“, nie als Dialog',
);
ok(
  beginnt(15, 'Live-Bereich Hinweisband') && live.includes('title="Hinweis schließen"') && live.includes('aktionen.hinweiseSchliessen') && nennt(15, 'hinweiseSchliessen', 'Altfehler RE-7b', 'Ordner von vorher'),
  'RE Funktionsliste Nr. 15: das „×“ des Hinweisbands löscht beide Hinweise wie bisher und verwirft seit Altfehler RE-7b einen offenen Show-Vorschlag (der Ordner von vorher gilt wieder)',
);
ok(
  beginnt(44, 'Live-Bereich Hinweisband') && nennt(44, '--status-warn', 'amber') && !/amber-/.test(live) && live.includes("HINWEIS = 'border border-[var(--status-warn)]/60"),
  'RE Funktionsliste Nr. 44: die rohe Farbe (amber) des Hinweisbands ist eine Variable (--status-warn)',
);
ok(
  [55, 56].every((nr) => beginnt(nr, 'Live-Bereich Hinweisband') && nennt(nr, '`store/recorder.ts`')) &&
    ['Gerät/Treiber starten und „Geräte aktualisieren“ drücken.', 'Gemerkter Zielordner nicht erreichbar: ', ' — neuen Ordner wählen und das Preset neu speichern.'].every((t) => store.includes(t)),
  'RE Funktionsliste Nr. 55/56: die Texte der Hinweise kommen aus dem Store (der Store änderte sich nur mit den Altfehlern der Stufe 2, B7)',
);
ok(
  nennt(56, 'Altfehler RE-7b', 'entfällt', 'Die Show möchte in einem Netzwerkordner aufnehmen', 'kein gültiger Ordner', 'Altfehler RE-NAS') &&
    !store.includes('nur verwenden, wenn dieser Ordner bekannt ist') &&
    obf.includes('Die Show möchte in einem Netzwerkordner aufnehmen: ${pfad} (Server ${server}).') &&
    obf.includes('Zielordner aus der Show ist kein gültiger Ordner und wurde nicht übernommen: ${pfad}'),
  'RE Funktionsliste Nr. 56 (Altfehler RE-7b): der Text „… liegt im Netzwerk … nur verwenden, wenn dieser Ordner bekannt ist.“ entfällt; der Hinweis mit „Übernehmen“ und der zum ungültigen Ordner stehen in RECORDER_TEXTE',
);
ok(
  [60, 61, 62].every((nr) => beginnt(nr, 'Live-Bereich Hinweisband') && nennt(nr, 'E13', 'OK', 'Toast')) &&
    live.includes('data-recorder="meldung"') && live.includes('T.meldung.ok') && live.includes('aktionen.meldungQuittieren') && live.includes('shrink-0') &&
    wurzel.includes('meldungAbonnieren(window.jmrec?.onNotice, setMeldung)') && wurzel.includes('meldungQuittieren: () => setMeldung(null)') && akt.includes('export function meldungAbonnieren'),
  'RE Funktionsliste Nr. 60–62: Meldungen des Hauptprozesses bleiben bis „OK“ stehen (eigenes Band, eigenes Abo der View, E13) und zeigen zusätzlich den Toast',
);
ok(
  [57, 58, 59, 63].every((nr) => beginnt(nr, 'Rahmen') && nennt(nr, '`store/recorder.ts`', 'Toast')) && nennt(63, 'Erst den Eingang öffnen (Arm).') && nennt(58, 'Kein Eingang gewählt.', 'Companion'),
  'RE Funktionsliste Nr. 57–59, 63: die Meldungen des Stores bleiben Toast ohne „OK“; der Fehler „Erst den Eingang öffnen (Arm).“ erreicht jetzt nur noch den Fernbefehl und das Planen',
);

// ── Panel Audiogerät und Format (Nr. 16–20, 116, 117): NumberInput (E13), Sperre bei offenem Eingang ──
ok(
  beginnt(16, 'Panel Audiogerät') && nennt(16, 'Kein Eingang gefunden', 'solange der Eingang offen ist', 'selectDevice') && obf.includes("direction: 'input'") && obf.includes('lockedReason: sperre') && obf.includes('onChange: (id) => a.geraetWaehlen(Number(id))') && akt.includes('geraetWaehlen: (index) => s.selectDevice(index)'),
  'RE Funktionsliste Nr. 16: die Eingangswahl steht im Panel Audiogerät, gesperrt bei offenem Eingang mit Grund, und ruft selectDevice',
);
ok(
  von([17, 19], (nr) => beginnt(nr, 'Panel Format') && nennt(nr, 'NumberInput', 'E13', 'Enter', 'Pfeil', 'solange der Eingang offen ist')) &&
    (panel.match(/<NumberInput /g) ?? []).length === 2 && !/type="number"/.test(panel) && panel.includes('max={f.kanaele.max}') && panel.includes('min={f.samplerate.min}') && panel.includes('ganzzahl') &&
    akt.includes('kanaeleSetzen: (n) => s.setChannels(n)') && akt.includes('samplerateSetzen: (n) => s.setSampleRate(n)') && obf.includes('max: gewaehlt?.maxInputChannels ?? 64') && obf.includes('min: 8000'),
  'RE Funktionsliste Nr. 17/19: Kanäle und Samplerate sind NumberInput (Übernahme bei Enter oder Verlassen, keine Pfeile), gesperrt bei offenem Eingang, und rufen setChannels bzw. setSampleRate',
);
ok(
  von([116, 117], (nr) => beginnt(nr, 'Panel Format') && nennt(nr, 'NumberInput', 'E13', 'Fehlertext', 'Enter')) && nennt(116, 'Gerätemaximum', 'getippt') && nennt(117, 'Mindestens 8000') && nennt(17, 'Gerätemaximum') && nennt(19, 'Raster'),
  'RE Funktionsliste Nr. 116/117: die Zahlenfelder zeigen den Fehlertext statt still zu klemmen; das Gerätemaximum gilt auch für getippte Kanäle; kein 100er-Raster mehr',
);
ok(
  beginnt(18, 'Panel Format') && panel.includes('title={T.format.alleKanaele(alle.kanaele)}') && panel.includes('aktionen.kanaeleSetzen(alle.kanaele)') && obf.includes("max: 'Max'") && nennt(18, 'Max', 'Alle n Kanäle'),
  'RE Funktionsliste Nr. 18: „Max“ (Tooltip „Alle n Kanäle“) steht im Panel Format und setzt die Kanäle auf die Höchstzahl des Geräts',
);
ok(
  beginnt(20, 'Panel Format') && panel.includes('f.asioHinweis') && obf.includes('/asio/i.test(gewaehlt.hostApiName)') && obf.includes('ASIO: Samplerate muss exakt zur Geräte-Einstellung (z. B. DVSC) passen'),
  'RE Funktionsliste Nr. 20: der ASIO-Hinweis steht im Panel Format, nur beim gewählten ASIO-Gerät, im alten Wortlaut',
);

// ── Haupttasten, Marke, Uhr (Nr. 21–26, 80): Tastenfolge, Sperrgründe, gemessener Zustand ──
ok(
  [21, 22, 23, 24].every((nr) => beginnt(nr, 'Live-Bereich Transport') && nennt(nr, '`views/LiveBereich.tsx`')) &&
    live.indexOf('{ ...t.aufnahme,') < live.indexOf('{ ...t.eingang,') && nennt(22, 'links') && nennt(21, 'rechts') && nennt(24, 'rechts') && nennt(23, 'links') &&
    live.includes('<TallyButton key={i} {...k} />') && live.includes('grid-cols-2'),
  'RE Funktionsliste Nr. 21–24: Aufnahme/Stopp links, Eingang öffnen/schließen rechts (Ruling Task 21), zwei TallyButtons',
);
ok(
  nennt(21, 'Kein Eingang gewählt', 'Suche Audiogeräte…', 'Aufnahmezustand wird abgefragt…', 'E7') && obf.includes("zustandOffen: 'Aufnahmezustand wird abgefragt…'") && obf.includes("keinEingang: 'Kein Eingang gewählt'") && obf.includes('taste(T.taste.eingangOeffnen, \'bereit\')') && obf.indexOf('const eingang = ') >= 0 && !/'live'/.test(obf.slice(obf.indexOf('const eingang = '), obf.indexOf('const aufnahme = nimmtAuf'))),
  'RE Funktionsliste Nr. 21: „Eingang öffnen“ ist nie live, gesperrt ohne Gerät („Kein Eingang gewählt“, „Suche Audiogeräte…“) und vor der ersten Antwort „Aufnahmezustand wird abgefragt…“',
);
ok(
  nennt(22, 'Erst den Eingang öffnen', 'gesperrt', 'Companion', 'RECORD', 'Nr. 80', 'Altfehler RE-2b') && obf.includes("eingangZu: 'Erst den Eingang öffnen'") && obf.includes("taste(T.taste.aufnahme, 'gesperrt', T.grund.eingangZu)") &&
    nennt(80, 'Companion', 'RECORD', 'Altfehler RE-2b', 'abgelehnt', 'Ordnerdialog') && !nennt(80, 'unverändert'),
  'RE Funktionsliste Nr. 22/80 (Altfehler RE-2b): die Aufnahme-Taste ist im Ruhezustand gesperrt mit „Erst den Eingang öffnen“; Companion RECORD läuft über den Store, ohne Zielordner abgelehnt statt mit Ordnerdialog (Nr. 80)',
);
// Altfehler RE-3 (Task 7, Wächter umgestellt): ON AIR ist zusätzlich nie bei einem Fehlerfeld live (bisher nur nimmtAuf).
ok(
  nennt(23, 'ON AIR', 'E4', 'recording') && obf.includes("taste(T.taste.stopp, 'live')") && obf.includes('return { live: nimmtAuf(s.zustand) && fehlerVon(s.zustand) === null, label: RECORDER_TEXTE.onAirLabel }') && wurzel.includes('onAir={kopfOnAir(stand)}') && nennt(25, 'unbekannt') && live.includes('if (z === undefined) return { tone: \'muted\', text: UNBEKANNT }'),
  'RE Funktionsliste Nr. 23/25 (Altfehler RE-3): ON AIR nur bei gemessenem recording ohne Fehlerfeld (E4), „Stopp“ ist live; die Marke zeigt vor der ersten Antwort „unbekannt“',
);
ok(
  nennt(23, 'Altfehler RE-3', 'Fehlerfeld', 'ON AIR ist aus', 'Neu aufnehmen') && nennt(25, 'Altfehler RE-3', 'Schreibfehler', 'Kein Eingang', 'Nicht gestartet', 'destructive') &&
    obf.includes("neuAufnehmen: 'Neu aufnehmen'") && live.includes("if (z.fehler) return { tone: 'destructive', text: RECORDER_TEXTE.fehler.marke[z.fehler.art] };"),
  'RE Funktionsliste Nr. 23/25 (Altfehler RE-3): nach einem Schreibfehler oder ohne Audiodaten ist ON AIR aus, die linke Taste heißt „Neu aufnehmen“, die Marke nennt den Fehler in der Tönung destructive',
);
ok(
  beginnt(24, 'Live-Bereich Transport') && nennt(24, 'ohne Rückfrage', 'E7', 'Eingang schließen', 'Altfehler RE-2', 'gesperrt', 'Erst die Aufnahme stoppen', '`schliesseEingang`') &&
    obf.includes("taste(T.taste.eingangSchliessen, 'gesperrt', T.grund.aufnahmeLaeuft)") && obf.includes("taste(T.taste.eingangSchliessen, 'bereit')") &&
    /const eingang = nimmtAuf\(z\)\s+\? taste\(T\.taste\.eingangSchliessen, 'gesperrt', T\.grund\.aufnahmeLaeuft\)/.test(obf) &&
    live.includes('t.eingang.label === T.eingangSchliessen ? a.disarm : a.arm') && !/confirm|prompt/.test(live),
  'RE Funktionsliste Nr. 24 (Altfehler RE-2): „Eingang schließen“ ist in der Aufnahme gesperrt mit „Erst die Aufnahme stoppen“, bei armed bereit und weiter ohne Rückfrage (eine Taste mit wechselnder Beschriftung, E7)',
);
ok(
  [25, 26].every((nr) => beginnt(nr, 'Live-Bereich Transport') && nennt(nr, 'gemessen')) && live.includes('formatClock(z?.recordedSec ?? 0)') && live.includes("z.status === 'recording'"),
  'RE Funktionsliste Nr. 25/26: Marke und Uhr kommen aus dem gemessenen Zustand des Hauptprozesses',
);
ok(
  nennt(80, '`views/LiveBereich.tsx`', '`store/recorder.ts`', '`lib/fernbefehl.ts`') && beginnt(80, 'Live-Bereich Transport') && /record: async/.test(store) && !store.includes('Erst den Eingang öffnen') &&
    store.includes('pruefeFernbefehl(cmd,') && store.indexOf('pruefeFernbefehl(cmd,') < store.indexOf("case 'record':"),
  'RE Funktionsliste Nr. 80 (Altfehler RE-2b): der Start aus der Taste und aus dem Fernbefehl läuft über dieselbe Store-Aktion record; der Fernbefehl wird vorher geprüft, der Store nennt „Erst den Eingang öffnen“ weiter nicht',
);
ok(
  wurzel.includes('useBrueckenWert(ZUSTAND_QUELLE)') && brk.includes('getState?.()') && brk.includes('onState?.(cb)') && nennt(64, 'getState', 'onState') && obf.includes('Vorgabewert') && nennt(21, 'Aufnahmezustand wird abgefragt…'),
  'RE Funktionsliste: der gemessene Zustand kommt aus getState plus onState (Brücke), nie aus dem Vorgabewert des Stores; Nr. 64 nennt es',
);

// ── Ziel, Dateilink (Nr. 27–30), Zeitplan (Nr. 31–37, 118, 121) ──
ok(
  [27, 28, 29].every((nr) => beginnt(nr, 'Panel Ziel') && nennt(nr, '`views/Einstellungen.tsx`')) && nennt(27, 'Live-Bereich Ziel', 'Ordner wählen…') && panel.includes('aktionen.ordnerWaehlen') && panel.includes('aktionen.dateinameSetzen') && panel.includes('aktionen.spurenSetzen') && live.includes('data-recorder="ziel"'),
  'RE Funktionsliste Nr. 27–29: Ordner, Dateiname und Spuren stehen im Panel Ziel, die Ziel-Anzeige zusätzlich im Live-Bereich',
);
ok(
  nennt(29, 'gesperrt nur in der Aufnahme') && panel.includes("stand.zustand?.status === 'recording'") && panel.includes('disabled={spurenGesperrt}'),
  'RE Funktionsliste Nr. 29: „Spuren einzeln“ ist nur in der gemessenen Aufnahme gesperrt',
);
ok(
  beginnt(30, 'Live-Bereich Ziel') && nennt(30, 'Im Ordner zeigen', 'shell.reveal') && live.includes('title={T.ziel.imOrdnerZeigen}') && wurzel.includes('window.jmrec.shell.reveal(pfad)') && live.includes('z?.filePath'),
  'RE Funktionsliste Nr. 30: der Dateilink „→ Dateiname“ steht in der Ziel-Anzeige des Live-Bereichs und zeigt die Datei im Ordner',
);
ok(
  bis(31, 37).every((nr) => beginnt(nr, 'Arbeitsbereich Zeitplan') && nennt(nr, '`views/RecorderView.tsx`')) && wurzel.includes('<ScheduleCard zustand={zustand} />') && zeitplan.includes('zustand: RecorderState | undefined') && zeitplan.includes('const pendingStart = zustand?.scheduledStartAt != null') && nennt(31, 'gemessen'),
  'RE Funktionsliste Nr. 31–37: der Zeitplan steht im Arbeitsbereich unter dem Live-Bereich und liest den gemessenen Zustand',
);
ok(
  nennt(32, 'Erst den Eingang öffnen — dann lässt sich Start- und Stoppzeit planen.', 'unbekannt') && zeitplan.includes('Erst den Eingang öffnen — dann lässt sich Start- und Stoppzeit planen.') && zeitplan.includes("zustand !== undefined && zustand.status !== 'idle'"),
  'RE Funktionsliste Nr. 32: der Text bei geschlossenem Eingang bleibt; vor der ersten Antwort gilt der Eingang als zu',
);
ok(
  nennt(37, 'in den Einstellungen unter Ziel', 'wie oben eingestellt', 'R9') && obf.includes('gelten wie in den Einstellungen unter Ziel eingestellt') && zeitplan.includes('RECORDER_TEXTE.zeitplan.fusstext'),
  'RE Funktionsliste Nr. 37: der Fußtext der Karte ändert „wie oben“ in „wie in den Einstellungen unter Ziel“ (R9)',
);
ok(
  beginnt(118, 'Arbeitsbereich Zeitplan') && nennt(118, 'nativ', 'E13') && zeitplan.includes('type="number"') && !zeitplan.includes('<NumberInput') && beginnt(121, 'Arbeitsbereich Zeitplan') && zeitplan.includes('type="datetime-local"'),
  'RE Funktionsliste Nr. 118/121: Dauer und Startzeit bleiben native Felder im Zeitplan (E13 nennt nur Kanäle und Samplerate)',
);

// ── Pegel, Gain, Anordnung (Nr. 38–43, 119) ──
ok(
  beginnt(38, 'Live-Bereich Pegel') && beginnt(42, 'Live-Bereich Pegel') && beginnt(39, 'Live-Bereich Gain') && beginnt(40, 'Live-Bereich Gain') && beginnt(41, 'Live-Bereich Gain') && beginnt(119, 'Live-Bereich Gain') &&
    live.includes('Eingang öffnen zum Messen') && live.includes('title="Aufnahme-Verstärkung"') && live.includes('min={-12}') && live.includes('max={24}') && live.includes('title="Auf 0 dB zurücksetzen"') && live.includes('CH${String(c + 1).padStart(2, \'0\')}') && live.includes('data-recorder="pegel"'),
  'RE Funktionsliste Nr. 38–42, 119: Pegelkopf, Gain (−12 bis 24 dB), „0 dB“, Hinweis und die Kanal-Meter stehen im Live-Bereich, im alten Wortlaut',
);
ok(
  beginnt(43, 'Live-Bereich Transport') && nennt(43, 'gemessen', '920', 'ohne Scrollen') && live.includes('max-h-[calc(100vh_-_var(--header-h)_-_var(--statusbar-h)_-_2rem)]') && live.indexOf('data-recorder="transport"') < live.indexOf('data-recorder="pegel"') && wurzel.indexOf('<LiveBereich') < wurzel.indexOf('<ScheduleCard'),
  'RE Funktionsliste Nr. 43: Taste, Uhr, Marke und Meter stehen gemeinsam ohne Scrollen im Blick, der Zeitplan darunter (die ✏️-Zeile der Nachmessung ist erledigt)',
);

// ── Toast (Nr. 54): oben über der Preset-Leiste, scrollt mit dem Inhalt ──
ok(
  beginnt(54, 'Rahmen') && nennt(54, 'oben', 'Preset-Leiste', 'scrollt', '5000', 'E13') && wurzel.includes('data-recorder="toast"') && wurzel.includes('absolute inset-x-0 top-0') && !/\bfixed\b|\bsticky\b/.test(ohneKommentar(wurzel)) && wurzel.includes('setTimeout(() => setNotice(null), 5000)') && wurzel.indexOf('data-recorder="toast"') < wurzel.indexOf('<LiveBereich'),
  'RE Funktionsliste Nr. 54: der Toast steht oben über der Preset-Leiste (nicht mehr unten), scrollt mit dem Inhalt (weder fixed noch sticky) und bleibt bei 5 s',
);

// ── Dialoge, Browser-Fenster (Nr. 45–53): Systemdialoge im Main unverändert, keine confirm/prompt/alert ──
ok(
  von([48, 49, 50, 51, 52], unveraendert) && von([48, 49, 50], (nr) => nennt(nr, '`main/ipc.ts`')) && nennt(51, '`main/presets.ts`') &&
    nennt(48, 'Altfehler RE-2b', 'von Hand', 'abgelehnt') &&
    nennt(52, '`main/ipc.ts`', '`main/presets.ts`', '`main/netzordner.ts`', 'Befund 7', 'Altfehler RE-7b', 'Übernehmen', 'nie als Dialog') &&
    von([48, 49, 50, 51, 52], (nr) => gebunden(nr, 'main/ipc.ts')) && gebunden(52, 'main/netzordner.ts') && !GEAENDERT_KANON.has('apps/recorder/src/main/presets.ts'),
  'RE Funktionsliste Nr. 48–52 (Altfehler RE-2b, RE-7b): die Systemdialoge im Main bleiben; RECORD ON ohne Zielordner öffnet den Ordnerdialog nicht mehr, ein Netzwerkordner aus der Show wartet auf „Übernehmen“ im Fenster statt auf einen Dialog, „Übernehmen“ im Import merkt den Ordner',
);
{
  // Altfehler RE-7a (Task 7): Text neu; das Schließen in der Aufnahme fragt jetzt nach, im Fenster (views/SchliessenFrage.tsx über Modal),
  // weiter ohne confirm, alert oder prompt; die übrigen Aktionen bleiben ohne Rückfrage.
  const dateien = ['App.tsx', 'views/RecorderOberflaeche.tsx', 'views/LiveBereich.tsx', 'views/Einstellungen.tsx', 'views/RecorderView.tsx', 'views/SchliessenFrage.tsx', 'lib/aktionen.ts', 'lib/oberflaeche.ts', 'lib/bruecken.ts', 'lib/fernbefehl.ts', 'lib/platz.ts', 'components/PresetLeiste.tsx', 'store/recorder.ts'];
  ok(
    unveraendert(53) && nennt(53, 'Altfehler RE-2', 'gesperrt') && dateien.every((d) => !/\b(?:window\.)?(?:confirm|alert|prompt)\(/.test(ohneKommentar(quelle(d)))),
    'RE Funktionsliste Nr. 53 (Altfehler RE-2): weder confirm noch alert noch prompt im Renderer; „Eingang schließen“ fragt weiter nicht nach, ist in der Aufnahme aber gesperrt',
  );
  ok(
    nennt(53, 'Altfehler RE-7a', 'während einer Aufnahme fragt es', '`views/SchliessenFrage.tsx`', 'kein `window.confirm`') && gebunden(53, 'views/SchliessenFrage.tsx') &&
      quelle('views/SchliessenFrage.tsx').includes('<Modal onClose={onWeiter}'),
    'RE Funktionsliste Nr. 53 (Altfehler RE-7a): das Schließen des Fensters während einer Aufnahme fragt nach, im Fenster über Modal (kein window.confirm); ohne Aufnahme, Löschen im Hinweisband und „Stopp“ bleiben ohne Rückfrage',
  );
}

// ── Abläufe aus Abschnitt 3: bleiben im Wurzelknoten, in der View und im Main, nicht im Panel (E15) ──
ok(
  beginnt(64, 'Rahmen') && nennt(64, '`App.tsx`', '`store/recorder.ts`') && app.includes('void init()') && app.includes('return <RecorderOberflaeche />') && !/init\(\)/.test(ohneKommentar(wurzel + live + panel)) && store.includes('subscribed'),
  'RE Funktionsliste Nr. 64: init() läuft weiter genau einmal im Effekt des App-Wurzelknotens, nie in einer Ansicht oder im Panel',
);
ok(
  [
    'useBrueckenWert(MASTER_LINK_QUELLE)',
    'useBrueckenWert(FERNSTEUERUNG_QUELLE)',
    'useBrueckenWert(ZUSTAND_QUELLE)',
    'meldungAbonnieren(window.jmrec?.onNotice, setMeldung)',
    'panelAktionen(',
  ].every((w) => wurzel.includes(w)) &&
    ['window.', 'useEffect', 'useRec(', 'setInterval', 'addEventListener'].every((w) => !ohneKommentar(panel).includes(w)) &&
    !ohneKommentar(live).includes('window.') && !/useEffect|useRec\(/.test(ohneKommentar(live)),
  'RE Funktionsliste: Brücken, Meldungs-Abo und Toast laufen in der Wurzel-View auch bei geschlossenem Panel; Einstellungen.tsx hat kein window, keine Effekte, keinen Store; LiveBereich.tsx keine Hooks (E15)',
);
ok(
  von([65, 66, 67, 68, 69, 70, 74, 75, 96, 97, 98, 99, 100], (nr) => (unveraendert(nr) || beginnt(nr, 'Live-Bereich Preset-Leiste')) && nennt(nr, '`store/recorder.ts`')) &&
    von([65, 66, 67, 68, 69, 70, 74, 75], (nr) => gebunden(nr, 'store/recorder.ts')),
  'RE Funktionsliste Nr. 65–70, 74, 75, 96–100: Start, Merken und Presets laufen im Store; seine Änderungen sind die gebundenen Altfehler der Stufe 2 (B7)',
);
ok(
  nennt(96, 'Altfehler RE-NAS', 'Laufwerksordner gilt sofort', 'Netzwerkordner erst', 'Altfehler RE-7b') && nennt(97, 'Altfehler RE-NAS', 'nicht mehr auf', 'einen `ordnerDa`-Aufruf') &&
    nennt(65, 'Altfehler RE-7b', '`ordnerDa: null`') && nennt(74, 'Altfehler RE-7b', '`dirGemerkt`') &&
    store.includes('return lauf.then((d) => pruefeOrdner(d, name));') && /const laufendePruefungen = new Map<string, Promise<boolean>>\(\);/.test(store) &&
    !/await window\.jmrec\.ordnerDa\(/.test(store) && store.includes('function merkWerte(s: RecStore): RecEinstellungen'),
  'RE Funktionsliste Nr. 65, 74, 96, 97 (Altfehler RE-NAS, RE-7b): die Ordnerprüfung läuft außerhalb der Warteschlange (geteilt je Pfad), ein Netzwerkordner gilt erst nach der Antwort; der Start wartet nicht auf sie; das Merken behält den Ordner von vorher, solange ein Show-Vorschlag offen ist',
);
ok(
  von([71, 73, 89, 90], (nr) => unveraendert(nr) && nennt(nr, '`main/index.ts`', 'E2') && gebunden(nr, 'main/index.ts')) && unveraendert(72) &&
    nennt(72, 'Altfehler RE-7b', '`netzordnerOffen`', '`dirGemerkt`', '`ordnerUngueltig`', '`normiereOrdner`', '`shared/netzordner.ts`') && gebunden(72, 'shared/netzordner.ts') &&
    nennt(73, 'Altfehler RE-7b', '`pruefeShowOrdner`', 'Show-Zielordner wartet auf Bestätigung', 'Show-Zielordner ungültig, nicht übernommen', '`readFileSync`', '`shared/netzordner.ts`'),
  'RE Funktionsliste Nr. 71–73, 89, 90 (Altfehler RE-7b): Deep-Link, Schließen und Einzelinstanz im Main bleiben (lesende Meldung, E2); der Zielordner der Show geht durch pruefeShowOrdner, ein neuer Netzwerkordner wartet auf „Übernehmen“',
);
ok(
  von([76, 77, 78, 79, 81, 82, 83, 84, 85, 86, 87, 88, 92, 93, 94, 95], (nr) => unveraendert(nr)) &&
    von([76, 77, 78, 79, 81, 82, 83, 85, 86, 87, 88, 89, 92, 93, 94, 95], (nr) => gebunden(nr, 'main/recorder.ts')) &&
    // Fix-Runde 2 (Ruling R21, Altfehler RE-3; Wächter umgestellt): main/wav.ts ist geändert und in Nr. 83, 84 und 137 an RE-3 gebunden.
    GEAENDERT_KANON.has('apps/recorder/src/main/wav.ts') && von([83, 84, 137], (nr) => gebunden(nr, 'main/wav.ts')) &&
    !GEAENDERT_KANON.has('apps/recorder/src/main/stille.ts') && !GEAENDERT_KANON.has('apps/recorder/src/main/dateiname.ts'),
  'RE Funktionsliste Nr. 76–95: Aufnahmekern, Dateinamen, Folgedatei, Stille-Auffüllung und Zeitplan im Main sind unverändert; main/recorder.ts änderte sich nur mit Altfehler RE-2 (gebunden, B7); main/wav.ts nur mit Altfehler RE-3 (Fix-Runde 2, R21)',
);
// ── Altfehler RE-3, RE-7a, RE-PLATZ (Task 7): die Zeilen nennen ihre ID ausdrücklich (die Bindung aus Task 6 entlastet die Dateien schon) ──
ok(
  nennt(79, 'Altfehler RE-3', '`try`', 'Block-Wächter', '`main/eingang-waechter.ts`', '2 s ohne Block', '`setProtokoll`', 'Stau') && gebunden(79, 'main/eingang-waechter.ts') &&
    nennt(87, 'Altfehler RE-3', 'Befund 3') && nennt(88, 'Altfehler RE-3', 'Der Dateikopf von', 'quittiert ein Stopp das Fehlerfeld') &&
    nennt(62, 'Altfehler RE-3', 'Aufnahme beendet: Schreibfehler in', 'entfällt') && !quelle('main/recorder.ts').includes('Stille konnte nicht in die Datei geschrieben werden'),
  'RE Funktionsliste Nr. 62, 79, 87, 88 (Altfehler RE-3): Schreibfehler im Block, beim Auffüllen und im Kopf beenden die Aufnahme sauber, der Block-Wächter (main/eingang-waechter.ts) ebenso nach 2 s ohne Block; ein Stopp quittiert; die alte Stille-Meldung entfällt',
);
ok(
  nennt(89, 'Altfehler RE-7a', 'Aufnahme läuft. Wirklich beenden?', '`views/SchliessenFrage.tsx`', '`shared/schliessen.ts`', 'binnen 1 s', 'nicht blockierenden nativen Dialog', '`session-end`', '`will-quit`') &&
    gebunden(89, 'views/SchliessenFrage.tsx') && gebunden(89, 'shared/schliessen.ts') && von([2, 89, 90, 112], (nr) => nennt(nr, 'Altfehler RE-7a', 'Rückfrage beim Schließen')),
  'RE Funktionsliste Nr. 2, 89, 90, 112 (Altfehler RE-7a): main/index.ts fragt beim Schließen in der Aufnahme nach (Fenster, nativer Rückfall nach 1 s, session-end ohne Frage, will-quit hält den Steuerserver an)',
);
ok(
  nennt(1, 'Fix-Runde 1', '`//server/share`', 'Wurzel der Freigabe') && nennt(23, 'Fix-Runde 1', 'Eingang öffnen, dann neu aufnehmen') && nennt(79, 'Fix-Runde 1', 'zwei Takte') &&
    nennt(88, 'Fix-Runde 1', 'Ordner der Spuren', 'genau einmal') && nennt(89, 'Fix-Runde 1', '`SchliessenSteuerung`', 'Neuladen', 'Renderer weg', '`powerMonitor`', 'nicht auf dem Mac gemessen') &&
    gebunden(89, 'shared/schliessen.ts') && quelle('main/index.ts').includes("win.webContents.on('did-finish-load', () => steuerung.geladen());") && obf.includes("neuAufnehmenZu: 'Eingang öffnen, dann neu aufnehmen'"),
  'RE Funktionsliste Nr. 1, 23, 79, 88, 89 (Task 7, Fix-Runde 1): Freigabe mit Schrägstrichen nur bis zur Wurzel, Haupttaste mit Fehler bei geschlossenem Eingang, Stau ab zwei Takten, Kopf der Spuren, Rückfrage nach Neuladen und Absturz, powerMonitor',
);
ok(
  von([83, 84, 137], (nr) => nennt(nr, '`main/wav.ts` änderte sich nur mit Altfehler RE-3: nach allen Spuren wirft `MultiWavWriter.finalize` den ersten Fehler mit der Datei der Spur, statt ihn zu verschlucken (Nr. 88)')) &&
    nennt(88, 'Fix-Runde 1 (Ruling R18b)', 'Ordner der Spuren', 'Fix-Runde 2 (Ruling R21)', 'die Datei dieser Spur', 'die übrigen Spuren') &&
    nennt(89, 'Fix-Runde 1 (Befund 1, Ruling R15)', 'Fix-Runde 2 (Ruling R19, R20)', 'nur unter Linux', 'RE-K3', 'ohne die Frist zu verlängern', 'fragt wieder') &&
    quelle('main/index.ts').includes("if (process.platform === 'linux') {") && quelle('main/wav.ts').includes('export class SpurFehler'),
  'RE Funktionsliste Nr. 83, 84, 88, 89, 137 (Task 7, Fix-Runde 2): main/wav.ts meldet die kaputte Spur (an RE-3 gebunden), der Kopf einer Spur nennt ihre Datei, powerMonitor nur unter Linux, die Frist verlängert sich nicht, ohneFrage hebt nichts auf Dauer auf (ergänzt, nicht ersetzt)',
);
ok(
  nennt(134, 'Altfehler RE-3', 'Altfehler RE-PLATZ') && nennt(138, 'Altfehler RE-3', '`fehler`', 'Altfehler RE-PLATZ', '`spuren`', 'Altfehler RE-7a') &&
    von([76, 79, 81, 82, 83, 85, 86, 87, 88, 89, 92, 93, 94, 95, 134, 137, 138], (nr) => nennt(nr, 'mit Altfehler RE-3: ein Schreibfehler oder 2 s ohne Audiodaten', 'mit Altfehler RE-PLATZ: der Zustand nennt die Spuren')) &&
    von([48, 101, 124], (nr) => nennt(nr, 'Altfehler RE-3 `setProtokoll`', 'Altfehler RE-PLATZ `fs:platz`', 'Ablehnung im Wettlauf')) &&
    von([53, 66, 88, 132], (nr) => nennt(nr, 'Altfehler RE-3 (ein Preset öffnet den Eingang nur über `arm` neu', 'Altfehler RE-7a (Rückfrage beim Schließen', 'Altfehler RE-PLATZ (Abfrage des freien Platzes')),
  'RE Funktionsliste Nr. 48, 53, 66, 76–95, 101, 124, 132–138 (Altfehler RE-3, RE-7a, RE-PLATZ): die Sätze „… änderte sich nur mit …“ nennen die neuen Befunde (ergänzt, nicht ersetzt)',
);
ok(
  nennt(77, 'Altfehler RE-2', 'Erst die Aufnahme stoppen.', 'Befund 2') && nennt(78, 'Altfehler RE-2', '`schliesseEingang`', '`disarm()`'),
  'RE Funktionsliste Nr. 77/78 (Altfehler RE-2): Öffnen und Schließen des Eingangs lehnen in der Aufnahme ab, disarm() bleibt fürs Schließen des Fensters',
);
ok(
  beginnt(91, 'Arbeitsbereich Zeitplan') && nennt(91, '`views/RecorderView.tsx`', '`store/recorder.ts`') && zeitplan.includes('schedule: () => void schedule()') && zeitplan.includes('cancelSchedule: () => void cancelSchedule()'),
  'RE Funktionsliste Nr. 91: Planen und Abbrechen rufen weiter schedule und cancelSchedule des Stores',
);
ok(
  von([101, 102, 103, 104], unveraendert) && nennt(102, '`main/ipc.ts`') && nennt(104, '`main/ipc.ts`') && nennt(102, 'Befund 10') &&
    nennt(104, 'Altfehler RE-7b', '`existsSync`', '`ordnerDa: null`') && von([101, 102, 103, 104], (nr) => gebunden(nr, 'main/ipc.ts')),
  'RE Funktionsliste Nr. 101–104: Export, Import und Preset-Datei im Main sind unverändert (Befund 10 bleibt); die Ordnerprüfung beim Laden entfällt mit Altfehler RE-7b (kein existsSync mehr)',
);

// ── Fernsteuerung (Nr. 105–111): Server und Verben unverändert, die Meldung ist neu (E2) ──
ok(
  beginnt(105, 'Panel Fernsteuerung') && nennt(105, 'E2', 'Statusleiste', '`main/control-server.ts`', '`shared/fernsteuerung.ts`', 'JM Audio Recorder') && ctl.includes('onMeldung') && panel.includes('<RemoteControlSection {...fernsteuerungAbschnitt(stand)} />') && obf.includes("companionModule: RECORDER_TEXTE.companionModul") && obf.includes("companionModul: 'JM Audio Recorder'"),
  'RE Funktionsliste Nr. 105: die Fernsteuerungs-Meldung (Port 8729, Clients, Fehler) steht im Panel Fernsteuerung und in der Statusleiste (E2), Modul „JM Audio Recorder“',
);
ok(
  [106, 107, 108, 109, 110, 111].every((nr) => unveraendert(nr) && nennt(nr, '`main/control-server.ts`')) && nennt(106, '`packages/suite-control-protocol/src/capabilities.ts`') && von([107, 108, 109, 111], (nr) => nennt(nr, '`store/recorder.ts`', '`lib/fernbefehl.ts`')) && nennt(111, '`preload/index.ts`', 'E2') &&
    NUR_MELDUNG.has('apps/recorder/src/main/control-server.ts') && gebunden(111, 'preload/index.ts'),
  'RE Funktionsliste Nr. 106–111: STATE-Rückmeldung, die drei Verben und der Weg über den Renderer bleiben (control-server.ts nur mit den lesenden Brücken, E2; der Preload bekam mit Altfehler RE-2 die Ablehnung)',
);
ok(
  nennt(108, 'Altfehler RE-2', 'Befund 2', 'Owner') && nennt(109, 'Altfehler RE-2', 'Befund 2') && nennt(107, 'RECORD', 'Altfehler RE-2b', 'Kein Zielordner gewählt.') &&
    nennt(111, 'Altfehler RE-2', '`recorder:ablehnung`', '`pruefeFernbefehl`') &&
    von([107, 108, 109, 111], (nr) => gebunden(nr, 'lib/fernbefehl.ts') && gebunden(nr, 'store/recorder.ts')) && /arm\(\)/.test(store) && store.includes('pruefeFernbefehl('),
  'RE Funktionsliste Nr. 107–109, 111 (Altfehler RE-2, RE-2b): ARM und DISARM in der Aufnahme und RECORD ON ohne Zielordner werden abgelehnt (Befund 2), über den gemeinsamen Weg pruefeFernbefehl und recorder:ablehnung',
);
ok(beginnt(112, 'Rahmen') || unveraendert(112), 'RE Funktionsliste Nr. 112: der Recorder hat weiter kein Ausgabefenster');

// ── Tastatur (Nr. 113–123, Pflichtzeilen): keine Kürzel, Panel-Tasten nach O1, Tasten im Feld ──
ok(
  nennt(113, 'Escape', 'Panel') && !/keydown|onKeyDown|addEventListener/.test(ohneKommentar(wurzel)) && !/keydown|onKeyDown|addEventListener/.test(ohneKommentar(live)) && !/keydown|onKeyDown|addEventListener/.test(ohneKommentar(panel)) && !/keydown|onKeyDown|addEventListener/.test(ohneKommentar(zeitplan)) && /onKeyDown/.test(leiste),
  'RE Funktionsliste Nr. 113 (Pflichtzeile Tastatur): weiter keine Kürzel; Wurzel, Live-Bereich, Panel und Zeitplan hören auf keine Taste, nur das Namensfeld der Preset-Leiste',
);
ok(
  zeile(114)?.zellen[1] === 'Panel-Tasten' && beginnt(114, 'Panel ') && ['Leertaste', 'Escape', 'Feld', 'Schalter', 'O1', 'keine Kürzel'].every((w) => kuenftig(114).includes(w)),
  'RE Funktionsliste Nr. 114 (Pflichtpunkt Panel-Tasten): Leertaste und Escape, je für Feld und Knopf/Schalter (Spec 10, O1), Recorder ohne Kürzel',
);
{
  const sp = quelle('packages/ui/src/components/SettingsPanel.tsx');
  ok(sp.includes('Escape') && sp.includes('defaultPrevented'), 'RE Funktionsliste Nr. 114: SettingsPanel schließt mit Escape, nur wenn nicht defaultPrevented');
  ok(
    wurzel.includes('settings={<Einstellungen') && !panel.includes('<LiveBereich') && !panel.includes('<ScheduleCard') && wurzel.includes('<LiveBereich') && !/key=\{/.test(ohneKommentar(wurzel)),
    'RE Funktionsliste Nr. 114: das Panel ist kein eigener Bildschirm, der Live-Bereich bleibt bei offenem Panel gemountet (kein key um ihn)',
  );
}
ok(
  beginnt(115, 'Live-Bereich Preset-Leiste') && leiste.includes("e.key === 'Enter'") && leiste.includes("e.key === 'Escape'") && nennt(115, 'Enter', 'Escape'),
  'RE Funktionsliste Nr. 115: Enter und Escape im Namensfeld der Preset-Leiste bleiben',
);
ok(
  beginnt(120, 'Panel Audiogerät') && nennt(120, 'Preset') && nennt(122, 'Kontrollkästchen') && nennt(123, 'Escape', 'Panel') && beginnt(123, 'Live-Bereich Preset-Leiste'),
  'RE Funktionsliste Nr. 120/122/123: Auswahlfelder, Knöpfe und Escape; Escape schließt jetzt das Panel, sonst nichts',
);

// ── Gemerkte Zustände (Nr. 124–138): alles im Main oder im Store, Hell/Dunkel mit der Ausnahme jm-theme ──
ok(
  !/localStorage|sessionStorage|persistId/.test(ohneKommentar(wurzel + panel + live + zeitplan + akt + obf + brk + app + leiste)) && /localStorage/.test(ohneKommentar(store)),
  'RE Funktionsliste Nr. 132: die Oberfläche der App merkt nichts selbst; der einzige localStorage-Zugriff bleibt der lesende Altwert jmrec.gainDb im Store',
);
ok(
  unveraendert(132) && nennt(132, '`store/recorder.ts`', 'jmrec.gainDb') && von([124, 125, 126, 127, 128, 129, 130, 131], (nr) => unveraendert(nr)) &&
    nennt(124, 'Altfehler RE-7b', 'recorder-netzordner.json', '`main/netzordner.ts`', 'Zwischendatei') && gebunden(124, 'main/netzordner.ts'),
  'RE Funktionsliste Nr. 124–132: die gemerkten Werte und Dateien sind unverändert; neu daneben die Datei der bestätigten Netzwerkordner (Altfehler RE-7b, Nr. 124)',
);
ok(
  ['jm-theme', 'E5'].every((w) => kuenftig(133).includes(w)) && kuenftig(133).includes('`packages/ui/src/lib/theme.ts`') && quelle('packages/ui/src/lib/theme.ts').includes("'jm-theme'") && ersetzt(133, 'Kopf'),
  'RE Funktionsliste Nr. 133: der Haken nennt die Ausnahme Hell/Dunkel im gemeinsamen Kopf (jm-theme in localStorage, E5)',
);
ok(
  [134, 135, 136, 137, 138].every((nr) => zeile(nr) !== undefined) && nennt(135, 'Meldung', 'Panel') && unveraendert(136) && unveraendert(137) && unveraendert(138) &&
    nennt(136, 'Altfehler RE-7b', '`dirGemerkt`') && nennt(138, 'Altfehler RE-7b', 'Netzwerkordner'),
  'RE Funktionsliste Nr. 134–138: Zustand der Oberfläche (jetzt auch Meldung und Panel, nicht gemerkt), Show-Vorgaben (mit Altfehler RE-7b auch der offene Vorschlag, nur im Speicher), Dateien und Laufzeit des Mains',
);

// ── Statusleiste: die sieben Einträge stehen in der Leiste (Nr. 5, 25, 26, 105 und die neuen) ──
ok(
  ['masterLinkStatusItem(s.masterLink)', "group: 'fernsteuerung'", "id: 'aufnahme'", "id: 'zeitplan'", "id: 'audio-modul'", "id: 'meldung'", 'eingangItem(s)', 'platzItem(s)'].every((w) => obf.includes(w)) &&
    quelle('lib/platz.ts').includes("id: 'platz'") && wurzel.includes('status={statusLeiste(stand)}'),
  'RE Funktionsliste (Altfehler RE-PLATZ): die Statusleiste hat Master-Link, Aufnahme, Platz, Fernsteuerung, Eingang, Zeitplan, Audio-Modul und Meldung',
);

// ── Abschnitt 8, 9, 10 und der Kopf „Stand“ widersprechen den Haken nicht ──
{
  const abschnitt8 = text.slice(text.indexOf('## 8 · '), text.indexOf('## 9 · '));
  const abschnitt9 = text.slice(text.indexOf('## 9 · '), text.indexOf('## 10 · '));
  const abschnitt10 = text.slice(text.indexOf('## 10 · '));
  const kopf = text.slice(0, text.indexOf('## 1 · '));
  const stand = text.slice(text.indexOf('- **Stand:**'), text.indexOf('- **Gelesen'));
  const befund = (n: number): string => abschnitt10.slice(abschnitt10.indexOf(`\n${n}. `), abschnitt10.indexOf(`\n${n + 1}. `) === -1 ? undefined : abschnitt10.indexOf(`\n${n + 1}. `));
  ok(/zum Zeitpunkt der Erhebung/.test(stand) && !/sind leer, der Code ist seither unverändert/.test(stand), 'RE Funktionsliste Stand: „Code unverändert“ gilt nur zum Zeitpunkt der Erhebung');
  ok(/zum Zeitpunkt der Erhebung[^]*(?:Ordner|Testordner)[^]*test\/ui/.test(text.slice(text.indexOf('- **Gelesen'), text.indexOf('- **künftig wo**'))), 'RE Funktionsliste Kopf: „kein Ordner test/ui“ gilt nur zum Zeitpunkt der Erhebung');
  ok(/zum Zeitpunkt der Erhebung/.test(text.slice(text.indexOf('## 1 · '), text.indexOf('|---'))) && /Welle 2a/.test(text.slice(text.indexOf('## 1 · '), text.indexOf('|---'))), 'RE Funktionsliste Abschnitt 1: die Einleitung („keine Navigation, kein Panel, kein Statusbereich“) gilt zum Zeitpunkt der Erhebung');
  ok(/zum Zeitpunkt der Erhebung/.test(abschnitt8) && /masterLink/.test(abschnitt8) && /Task 19|Recorder b/.test(abschnitt8) && !/Zugänge, die der Umbau ergänzt \(Entscheidung E2\)\./.test(abschnitt8), 'RE Funktionsliste Abschnitt 8: Master-Link und Fernsteuerungs-Zustand fehlten zum Zeitpunkt der Erhebung und sind jetzt ergänzt (E2)');
  ok(/getState/.test(abschnitt8) && !/im Renderer nirgends benutzt, abgeleitet; der Zustand kommt über `onState`\)/.test(abschnitt8) && /ZUSTAND_QUELLE/.test(abschnitt8), 'RE Funktionsliste Abschnitt 8: getState wird jetzt benutzt (gemessener Zustand beim Einhängen), nicht mehr „nirgends“');
  ok(!/„Aufnahme“ ist nie gesperrt, ihr Fehler \(Eingang zu\) kommt als Toast \(Nr\. 80\)/.test(abschnitt9) && /Erst den Eingang öffnen/.test(abschnitt9) && /gesperrt/.test(abschnitt9), 'RE Funktionsliste Abschnitt 9: „Aufnahme“ ist nicht mehr „nie gesperrt“, sie ist im Ruhezustand gesperrt (Ruling Task 21)');
  ok(!/kein Zugang im Preload \(Abschnitt 8\), kommt neu \(E2\)/.test(abschnitt9) && !/heute nicht gemeldet \(Befund 1, Risiko 1\)/.test(abschnitt9) && !/„Gerät nicht gefunden“ steht heute nur im Hinweisband \(Befund 4\)/.test(abschnitt9), 'RE Funktionsliste Abschnitt 9: Master-Link, Fernsteuerung und „Gerät nicht gefunden“ stehen nicht mehr als offen da');
  ok(/Statuseintrag `master-link`[^\n]*Task 19/.test(abschnitt9) && /Statuseintrag `eingang`[^\n]*Statusleiste/.test(abschnitt9), 'RE Funktionsliste Abschnitt 9: die Zeilen master-link und eingang nennen den Stand nach dem Umbau');
  ok(!/store\.test\.ts` kennt die Felder des Stores, ein Wechsel auf `NumberInput` berührt sie/.test(abschnitt9) && /store\.test\.ts/.test(abschnitt9), 'RE Funktionsliste Abschnitt 9: store.test.ts bleibt unverändert, der NumberInput berührt den Store nicht');
  ok(/Welle 2a/.test(abschnitt10.slice(0, 600)) && /Zeitpunkt der Erhebung/.test(abschnitt10.slice(0, 600)), 'RE Funktionsliste Abschnitt 10: die Einleitung nennt, dass die Befunde den Stand der Erhebung beschreiben');
  ok([5, 6, 9, 13].every((n) => /Welle 2a:/.test(befund(n))) && /E5/.test(befund(6)) && /E13/.test(befund(13)) && /Task 21/.test(befund(9)), 'RE Funktionsliste Abschnitt 10: Befunde 5, 6, 9 und 13 nennen den Stand nach der Welle (NumberInput, Theme, Anordnung, Meldung bis OK)');
  ok(!/Mit `NumberInput` \(E13\) fallen die Pfeile weg und die Übernahme geschieht bei Enter und Blur \(Nachmessung 5\.3 Risiko 5, Nr\. 116,\s+117, 118\)\./.test(abschnitt10), 'RE Funktionsliste Abschnitt 10: Befund 5 sagt nicht mehr „künftig“ für das Dauer-Feld (Nr. 118 bleibt nativ)');
  // Widerruf: der alte Satz der Welle 2a bleibt stehen, dahinter „Altfehler Stufe 2 (‹ID›): …“.
  ok(/Welle 2a:[^]*unverändert[^]*Owner/.test(befund(2)) && /Welle 2a:[^]*unverändert[^]*Owner/.test(befund(7)), 'RE Funktionsliste Abschnitt 10: Befund 2 (ARM) und Befund 7 (Netzwerkordner) behalten den Satz der Welle 2a („unverändert … Owner“)');
  ok(
    /Welle 2a:[^]*\n {3}Altfehler Stufe 2 \(RE-2, RE-2b\): [^\n]*abgelehnt[^\n]*Owner 25\.11\., Frage 3: ablehnen/.test(befund(2)) &&
      /Welle 2a:[^]*\n {3}Altfehler Stufe 2 \(RE-7b, RE-NAS\): [^\n]*`pruefeShowOrdner`[^\n]*Übernehmen[^\n]*Owner 25\.11\., Frage 2: A/.test(befund(7)),
    'RE Funktionsliste Abschnitt 10 (Altfehler RE-2, RE-2b, RE-7b, RE-NAS): hinter dem Satz der Welle 2a steht bei Befund 2 und 7 die Zeile „Altfehler Stufe 2 (‹ID›): …“ mit der Owner-Entscheidung',
  );
  // Task 7, Widerruf: der alte Satz bleibt stehen, dahinter „Altfehler Stufe 2 (‹ID›): …“.
  ok(
    /\*\*Kein Fehlerzustand im Aufnahmezustand:\*\* `RecorderState` hat kein Feld für einen Fehler[^]*\n {3}Altfehler Stufe 2 \(RE-3\): [^\n]*`fehler`[^\n]*sauber[^\n]*recording=0[^\n]*B1, B2, Pre-flight K7/.test(befund(3)) &&
      /Das Schließen des Fensters in der Aufnahme ist hier nicht behandelt\.\n {3}Altfehler Stufe 2 \(RE-7a\): [^\n]*Wirklich beenden\?[^\n]*1 s[^\n]*B3, D4/.test(befund(7)) &&
      /endet das Auffüllen für die Aufnahme[^]*\n {3}Altfehler Stufe 2 \(RE-3\): ein Schreibfehler beim Auffüllen beendet jetzt die Aufnahme sauber/.test(befund(14)),
    'RE Funktionsliste Abschnitt 10 (Altfehler RE-3, RE-7a): Befund 3, 7 und 14 behalten ihren Satz, dahinter steht „Altfehler Stufe 2 (‹ID›): …“',
  );
  const kopfFlach = kopf.replace(/\n/g, ' ');
  const nachLs = kopfFlach.slice(kopfFlach.indexOf('einer, lesend'), kopfFlach.indexOf('einer, lesend') + 500);
  const abschnitt2 = text.slice(text.indexOf('## 2 · '), text.indexOf('|---', text.indexOf('## 2 · ')));
  const abschnitt7 = text.slice(text.indexOf('## 7 · '), text.indexOf('|---', text.indexOf('## 7 · ')));
  ok(/zum Zeitpunkt der Erhebung/.test(nachLs) && /jm-theme/.test(nachLs) && /E5/.test(nachLs), 'RE Funktionsliste Kopf: „localStorage: einer, lesend“ gilt zum Zeitpunkt der Erhebung; jm-theme (E5) kommt dazu');
  ok(/zum Zeitpunkt der Erhebung/.test(abschnitt7) && /jm-theme/.test(abschnitt7) && /E5/.test(abschnitt7) && !/Es gibt kein `persistId`/.test(abschnitt7), 'RE Funktionsliste Abschnitt 7: „kein localStorage zum Schreiben“ gilt zum Zeitpunkt der Erhebung; jm-theme (E5) schreibt jetzt');
  ok(/zum Zeitpunkt der Erhebung/.test(abschnitt2) && /E13/.test(abschnitt2) && /OK/.test(abschnitt2) && !/Meldungen laufen über einen einzigen\s+Platz, den Toast \(`notice`\); der Hauptprozess und der Store schreiben dort hinein, die jüngste Meldung ersetzt die ältere\./.test(abschnitt2), 'RE Funktionsliste Abschnitt 2: „ein einziger Platz, den Toast“ gilt zum Zeitpunkt der Erhebung; Meldungen des Hauptprozesses stehen jetzt bis „OK“ (E13)');
  ok(nennt(132, 'jm-theme', 'E5') && !/nennen jede geänderte Datei/.test(kopfFlach) && /geänderten Code-Dateien unter `src\/`/.test(kopfFlach), 'RE Funktionsliste Kopf/Nr. 132: Nr. 132 nennt jm-theme (E5); der Kopf behauptet nicht mehr, die Haken nennen jede geänderte Datei');
  {
    const codeDateien = GEAENDERT.filter((p) => p.startsWith('apps/recorder/src/')).map((p) => p.slice('apps/recorder/src/'.length));
    const ausnahmen = ['renderer/src/components/Topbar.tsx', 'renderer/src/globals.css'];
    const genannt = (d: string): boolean => ausnahmen.includes(d) || alle.some((z) => [...z.zellen[6].matchAll(PFAD)].some((m) => kanon(m[1]) === `apps/recorder/src/${d}`));
    const fehlt = codeDateien.filter((d) => !genannt(d));
    ok(fehlt.length === 0, `RE Funktionsliste Kopf: jede geänderte Code-Datei unter src/ steht in einem Haken (Ausnahmen: gelöschte Topbar.tsx, globals.css; fehlt: ${fehlt.join(', ') || 'nichts'})`);
  }
  for (const nr of [17, 19, 116, 117]) {
    ok(nennt(nr, 'abgerundet', 'Bitte eine ganze Zahl eingeben.'), `RE Funktionsliste Nr. ${nr}: der Haken nennt, dass nicht mehr abgerundet wird, sondern „Bitte eine ganze Zahl eingeben.“ erscheint`);
  }
  ok(/künftig wo[^]*Aufgabe e/.test(kopf) && /funktionsliste\.test\.ts/.test(kopf) && !/bleibt leer/.test(kopf), 'RE Funktionsliste Kopf: „künftig wo“ ist gefüllt und abgehakt (nicht mehr „bleibt leer“)');
}
