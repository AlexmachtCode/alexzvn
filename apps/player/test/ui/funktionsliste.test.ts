// ─────────────────────────────────────────────────────────────────────────────
// Funktionsliste nach dem Umbau (UX Welle 2a, Player e; Spec 10 „Kein Funktionsverlust“). Jede der 154 Zeilen in den
// Abschnitten 1–7 von docs/ux/funktionslisten/player.md ist in „künftig wo“ abgehakt: „✓ “ und ein Ort des Ortsregisters,
// „unverändert (…)“, „entfällt (…, E…)“ oder „ersetzt durch {Ort} (…, E…)“. Verweise nur auf E1–E16 (Plan 2a) und, seit dem
// 2a-Nachzug in Welle 2b (Task 6), auf B1–B22 (Plan 2b). Jede
// genannte Datei existiert, Groß- und Kleinschreibung wie im Repo. Dazu Querprüfungen gegen den Code: die Änderungen der
// Aufgaben 14–16 (Panik stoppt Pads, Pausen-Merker, ON AIR, Tastenfilter, Dialoge, Ausgabe-Panel, Transport, Fußleiste) stehen als
// Haken in den betroffenen Zeilen, und der Code trägt, was der Haken sagt.
// Läuft im Paketordner apps/player (npm run selftest -w @jm/player).
// „unverändert (…)“ darf keine Datei nennen, die seit der Erhebung (d7cdd79ce0) geändert wurde, außer sie bekam nur die lesenden
// Brücken bzw. den Ausgabezustand (E2, E3): dann steht der Hinweis im Haken. Seit der Altfehler-Stufe 1 (Plan 2026-11-25) darf es
// auch eine Datei nennen, die ein Befund dieser Stufe geändert hat, wenn der Haken ihn als „Altfehler <ID>“ nennt (ALTFEHLER). Der
// Abgleich der statischen Liste GEAENDERT mit git läuft nur mit JM_FUNKTIONSLISTE_GIT=1 (Arbeitsbaum gegen die Erhebung, damit auch
// eine noch nicht eingecheckte Datei zählt).
// ─────────────────────────────────────────────────────────────────────────────

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { gleich, leseText, ok } from '@jm/ui/testhilfe';

const LISTE = '../../docs/ux/funktionslisten/player.md';

/**
 * Ortsregister: Rahmen, Kopf, Werkzeugleiste (Reiter), Live-Bereich Cue-Show (Standby, Transport), Fußleiste, Bibliothek,
 * Soundboard, Cue-Show (Kopf und Liste der Show), Dialoge, Statusleiste, Panel je Abschnitt, Ausgabefenster.
 */
const ABSCHNITTE = ['Ausgabe', 'Fernsteuerung'];
const ORTE: readonly string[] = [
  'Rahmen',
  'Kopf',
  'Werkzeugleiste',
  'Live-Bereich Cue-Show',
  'Live-Bereich Cue-Show Standby',
  'Live-Bereich Cue-Show Transport',
  'Fußleiste',
  'Bibliothek',
  'Soundboard',
  'Cue-Show',
  'Dialoge',
  'Statusleiste',
  'Panel',
  ...ABSCHNITTE.map((a) => `Panel ${a}`),
  'Ausgabefenster',
];

/** Zeilen insgesamt und je Abschnitt 1–7, wie die Liste im Kopf sie nennt (Stand 31ff7b49a8). */
const GESAMT = 154;
const JE_ABSCHNITT = [56, 24, 39, 0, 10, 11, 14];

const ERHEBUNG = 'd7cdd79ce0';

/**
 * Alle Dateien von apps/player, die seit der Erhebung geändert, angelegt oder gelöscht wurden, als Pfad ab der Repo-Wurzel. Ein
 * „unverändert (…)“ darf sie nur nennen, wenn der Haken E2 oder E3 nennt und die Datei nur die lesenden Brücken bekam
 * (NUR_MELDUNG). Mit JM_FUNKTIONSLISTE_GIT=1 prüft der Test unten, dass git dieselbe Menge kennt.
 */
const GEAENDERT = [
  'electron.vite.config.ts',
  'package.json',
  'src/main/ausgabe-fenster.ts',
  'src/main/control-server.ts',
  'src/main/index.ts',
  'src/main/ipc.ts',
  'src/main/library.ts',
  'src/main/output-window.ts',
  'src/preload/index.ts',
  'src/renderer/src/App.tsx',
  'src/renderer/src/components/Topbar.tsx',
  'src/renderer/src/globals.css',
  'src/renderer/src/lib/aktionen.ts',
  'src/renderer/src/lib/bruecken.ts',
  'src/renderer/src/lib/cues.ts',
  'src/renderer/src/lib/fernbefehl.ts',
  'src/renderer/src/lib/oberflaeche.ts',
  'src/renderer/src/lib/show-audio.ts',
  'src/renderer/src/lib/vorlauf.ts',
  'src/renderer/src/store/player.ts',
  'src/renderer/src/views/Einstellungen.tsx',
  'src/renderer/src/views/EntfernenFrage.tsx',
  'src/renderer/src/views/Fussleiste.tsx',
  'src/renderer/src/views/LibraryView.tsx',
  'src/renderer/src/views/LiveBereich.tsx',
  'src/renderer/src/views/OutputView.tsx',
  'src/renderer/src/views/PlayerOberflaeche.tsx',
  'src/renderer/src/views/ShowView.tsx',
  'src/renderer/src/views/SoundboardView.tsx',
  'src/shared/fernsteuerung.ts',
  'src/shared/types.ts',
  'test/ui/ablauf.test.ts',
  'test/ui/bruecken.test.ts',
  'test/ui/funktionsliste.test.ts',
  'test/ui/hilfe.ts',
  'test/ui/live.test.tsx',
  'test/ui/oberflaeche.test.ts',
  'test/ui/panel.test.tsx',
  'test/ui/rahmen.test.tsx',
  'test/ui/rueckfrage.test.tsx',
  'test/ui/rueckspiel.test.tsx',
  'test/ui/show-audio.test.ts',
  'test/ui/selftest.ts',
  'test/ui/store.test.ts',
  'test/ui/testzustand.ts',
  'test/ui/werkzeug.test.tsx',
  'tsconfig.test.json',
].map((p) => `apps/player/${p}`);

/** Geänderte Dateien außerhalb von apps/player, die ein unverändert-Haken zitieren könnte (Task 1, W2-2: Ausgabezustand). */
const PAKETE_GEAENDERT = [
  'packages/output-window/package.json',
  'packages/output-window/src/bildschirme.ts',
  'packages/output-window/src/index.ts',
  'packages/output-window/src/zustand.ts',
  'packages/output-window/test/bildschirme.test.ts',
  'packages/output-window/test/selftest.ts',
  'packages/output-window/test/zustand.test.ts',
];

/**
 * Dateien, die nur die lesenden Brücken bekamen: der Main (Fernsteuerungs-Meldung E2, Ausgabezustand und gemessenes Vollbild E3,
 * E14), der Preload und die Typen dazu, das Fenster-Paket den Ausgabezustand (E3). Verhalten und Befehle blieben. Welle 2b (Task 6)
 * ergänzt nur das lesende Bildschirm-Ereignis: in main/index.ts, preload/index.ts, shared/types.ts und im Fenster-Paket (index.ts und
 * die neue reine Datei bildschirme.ts). Seit der Altfehler-Stufe 1 bekamen main/ipc.ts, main/output-window.ts, preload/index.ts und
 * shared/types.ts mehr (PL-N, PL-T13: „bereit“ und ein einziges Fenster); sie stehen darum nicht mehr hier, ein Haken braucht für sie
 * den Verweis auf den Altfehler.
 */
const NUR_MELDUNG = new Set([
  'apps/player/src/main/index.ts',
  'apps/player/src/main/control-server.ts',
  'packages/output-window/src/index.ts',
  'packages/output-window/src/bildschirme.ts',
]);

/**
 * Altfehler Runde 1, Stufe 1 (Plan 2026-11-25): je erlaubter Player-ID die Dateien (ab der Repo-Wurzel), die der Befund geändert hat,
 * wie ERLAUBT in Studio-Control (Ruling R6). „Altfehler <ID>“ im Haken entlastet ein „unverändert (…)“, das eine geänderte Datei nennt,
 * nur, wenn die Liste dieser ID die Datei enthält; dann für die ganze Änderung des Befunds, nicht nur für lesende Brücken. Erlaubt sind
 * genau die neun Player-IDs: die sieben der Stufe 1 (SC-S1 bis SC-S3 betreffen Studio-Control; Task 2–4 trugen ihre Dateien bei ihrer
 * ID ein) und PL-K1, PL-K2 der Stufe 2 (Plan 2026-11-26, Task 1).
 */
const ALTFEHLER = new Map<string, readonly string[]>([
  [
    'PL-N',
    [
      'src/main/ausgabe-fenster.ts',
      'src/main/output-window.ts',
      'src/main/ipc.ts',
      'src/preload/index.ts',
      'src/shared/types.ts',
      'src/renderer/src/views/OutputView.tsx',
      'src/renderer/src/store/player.ts',
    ].map((p) => `apps/player/${p}`),
  ],
  ['PL-T13', ['src/main/ausgabe-fenster.ts', 'src/main/output-window.ts'].map((p) => `apps/player/${p}`)],
  ['PL-4', ['src/renderer/src/lib/oberflaeche.ts', 'src/renderer/src/views/SoundboardView.tsx', 'src/renderer/src/views/PlayerOberflaeche.tsx'].map((p) => `apps/player/${p}`)],
  [
    'PL-10',
    [
      'src/main/ipc.ts',
      'src/main/library.ts',
      'src/preload/index.ts',
      'src/shared/types.ts',
      'src/renderer/src/lib/oberflaeche.ts',
      'src/renderer/src/store/player.ts',
      'src/renderer/src/views/LibraryView.tsx',
      'src/renderer/src/views/ShowView.tsx',
      'src/renderer/src/views/EntfernenFrage.tsx',
    ].map((p) => `apps/player/${p}`),
  ],
  ['PL-11', ['src/renderer/src/lib/vorlauf.ts', 'src/renderer/src/store/player.ts'].map((p) => `apps/player/${p}`)],
  [
    'PL-16a',
    [
      'src/main/ipc.ts',
      'src/preload/index.ts',
      'src/shared/types.ts',
      'src/renderer/src/lib/fernbefehl.ts',
      'src/renderer/src/lib/oberflaeche.ts',
      'src/renderer/src/store/player.ts',
    ].map((p) => `apps/player/${p}`),
  ],
  [
    'PL-T14',
    ['src/renderer/src/lib/show-audio.ts', 'src/renderer/src/lib/oberflaeche.ts', 'src/renderer/src/store/player.ts'].map((p) => `apps/player/${p}`),
  ],
  ['PL-K1', ['src/renderer/src/lib/vorlauf.ts', 'src/renderer/src/store/player.ts', 'src/renderer/src/lib/oberflaeche.ts'].map((p) => `apps/player/${p}`)],
  ['PL-K2', ['src/renderer/src/store/player.ts'].map((p) => `apps/player/${p}`)],
]);
/** Verweis „Altfehler <ID>“ auf eine der erlaubten IDs; die ID steht in Gruppe 1. */
const ALTFEHLER_VERWEIS = new RegExp(`\\bAltfehler (${[...ALTFEHLER.keys()].join('|')})(?![\\w-])`, 'g');
/** Die Altfehler-IDs, die ein Text (ohne Code) als Verweis nennt. */
const altfehlerIds = (text: string): string[] => [...text.matchAll(ALTFEHLER_VERWEIS)].map((m) => m[1]);
/** Entlastet einer der Verweise die Datei (kanonischer Pfad)? */
const entlastet = (ids: readonly string[], datei: string): boolean => ids.some((id) => ALTFEHLER.get(id)?.includes(datei) === true);

const GEAENDERT_KANON = new Set([...GEAENDERT, ...PAKETE_GEAENDERT]);

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
if (GIT_PRUEFEN && GIT === null) console.log(`PL Funktionsliste: kein git-Verlauf bis ${ERHEBUNG} (flacher Klon); die Prüfung gegen git entfällt`);

/** Datei in Backticks: Pfad mit Endung, aufgelöst nach der Pfadregel im Kopf der Liste. */
const PFAD = /`([A-Za-z0-9_./-]+\.(?:tsx|ts|css|html|json|md|mjs))`/g;
/** Erlaubte Verweise: die Entscheidungen E1–E16 des Plans 2a und, für den 2a-Nachzug in Welle 2b, die Festlegungen B1–B22. */
const VERWEIS = /\b(?:E(?:[1-9]|1[0-6])|B(?:[1-9]|1\d|2[0-2]))\b/;
const FREMD = /\b(?:E(?:0|1[7-9]|[2-9]\d)|E\d{3,}|B(?:0|2[3-9]|[3-9]\d)|B\d{3,}|OF\d+)\b/;

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
    if (/^## /.test(z)) abschnitt = 0;
    const nr = /^\|\s*(\d+)\s*\|/.exec(z);
    if (nr && abschnitt >= 1 && abschnitt <= 7) {
      liste.push({ abschnitt, nr: Number(nr[1]), zellen: z.split(/(?<!\\)\|/).slice(1, -1).map((s) => s.trim()) });
    }
  }
  return liste;
}

/** Pfadregel der Liste: Repo-Wurzel, apps/player/src (main, preload, shared, renderer) oder der Renderer. */
function aufgeloest(pfad: string): string {
  if (/^(?:apps|packages|docs)\//.test(pfad)) return `../../${pfad}`;
  if (/^(?:main|preload|shared|renderer)\//.test(pfad)) return `src/${pfad}`;
  return `src/renderer/src/${pfad}`;
}

/** Kanonischer Pfad ab der Repo-Wurzel nach der Pfadregel der Liste. */
function kanon(pfad: string): string {
  const a = aufgeloest(pfad);
  return a.startsWith('../../') ? a.slice('../../'.length) : `apps/player/${a}`;
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
  if (FREMD.test(ohneCode)) return 'Verweis außerhalb von E1–E16 und B1–B22';
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
  // „unverändert“ nennt nur Dateien, die seit der Erhebung unverändert sind; Dateien mit nur den lesenden Brücken (E2, E3) mit Hinweis,
  // Dateien, die ein Altfehler der Stufe 1 geändert hat, mit dem Verweis „Altfehler <ID>“, dessen Liste sie nennt (R6).
  if (form === 'unverändert') {
    const ids = altfehlerIds(ohneCode);
    const offen = pfade.filter((p) => (GEAENDERT_KANON.has(kanon(p)) || GIT?.has(kanon(p)) === true) && !entlastet(ids, kanon(p)));
    if (offen.length > 0 && !/\bE[23]\b/.test(ohneCode)) return `unverändert mit geänderter Datei (${offen.join(', ')}) ohne Hinweis auf E2 oder E3 und ohne Altfehler-Verweis, dessen Liste sie nennt`;
    if (offen.some((p) => !NUR_MELDUNG.has(kanon(p)))) return `unverändert mit einer Datei, die mehr als die lesenden Brücken bekam (${offen.join(', ')})`;
  }
  return null;
}

const text = leseText(LISTE);
const alle = zeilen(text);

gleich(alle.length, GESAMT, 'PL Funktionsliste: 154 Zeilen in den Abschnitten 1–7 (Stand der Erhebung)');
gleich(
  JE_ABSCHNITT.map((_, i) => alle.filter((z) => z.abschnitt === i + 1).length),
  JE_ABSCHNITT,
  'PL Funktionsliste: Zeilen je Abschnitt wie in der Erhebung (56/24/39/0/10/11/14)',
);
gleich(
  alle.map((z) => z.nr),
  alle.map((_, i) => i + 1),
  'PL Funktionsliste: Nummern fortlaufend ab 1',
);
ok(!text.replace(/`[^`]*`/g, '').includes('"') && !text.includes('\r'), 'PL Funktionsliste: keine ASCII-Anführungszeichen außerhalb von Code, kein CR');

for (const z of alle) {
  const f = zeilenFehler(z);
  ok(f === null, `PL Funktionsliste Nr. ${z.nr} abgehakt${f === null ? '' : ` – ${f}`}`);
}

// ── Die Menge der geänderten Dateien stimmt mit git überein (nur mit JM_FUNKTIONSLISTE_GIT=1 und Verlauf) ──
{
  if (GIT !== null) {
    const fehlend = [...GIT].filter((n) => n.startsWith('apps/player/') && !GEAENDERT_KANON.has(n));
    ok(fehlend.length === 0, `PL Funktionsliste: GEAENDERT nennt alle seit ${ERHEBUNG} geänderten Dateien von apps/player (fehlt: ${fehlend.join(', ') || 'nichts'})`);
    const zuviel = GEAENDERT.filter((n) => !GIT.has(n));
    ok(zuviel.length === 0, `PL Funktionsliste: GEAENDERT nennt keine Datei, die git nicht als geändert kennt (zu viel: ${zuviel.join(', ') || 'nichts'})`);
    const pakete = [...GIT].filter((n) => !n.startsWith('apps/') && !n.startsWith('docs/') && !n.startsWith('.superpowers/'));
    const paketFehlt = pakete.filter((n) => !PAKETE_GEAENDERT.includes(n) && /^packages\/output-window\//.test(n));
    ok(paketFehlt.length === 0, `PL Funktionsliste: PAKETE_GEAENDERT nennt alle geänderten Dateien von packages/output-window (fehlt: ${paketFehlt.join(', ') || 'nichts'})`);
    const zitiert = alle
      .filter((z) => z.zellen[6].startsWith('✓ unverändert ('))
      .flatMap((z) => {
        const ids = altfehlerIds(z.zellen[6].replace(/`[^`]*`/g, ''));
        return [...z.zellen[6].matchAll(PFAD)].map((m) => kanon(m[1])).filter((n) => !entlastet(ids, n));
      });
    const getroffen = zitiert.filter((n) => GIT.has(n));
    ok(getroffen.every((n) => NUR_MELDUNG.has(n)), `PL Funktionsliste: keine in einem unverändert-Haken zitierte Datei bekam mehr als die lesenden Brücken, außer ein Altfehler-Verweis nennt sie in seiner Liste (${getroffen.join(', ') || 'keine'})`);
    const listen = [...ALTFEHLER.values()].flat();
    ok(listen.every((n) => GIT.has(n)), `PL Funktionsliste: jede Datei einer Altfehler-Liste ist laut git geändert (nicht: ${listen.filter((n) => !GIT.has(n)).join(', ') || 'nichts'})`);
  }
  // Jede Datei einer Altfehler-Liste steht in GEAENDERT: eine Liste entlastet nur, was wirklich geändert ist.
  {
    const listen = [...ALTFEHLER.values()].flat();
    ok(
      listen.length > 0 && listen.every((n) => GEAENDERT_KANON.has(n)),
      `PL Funktionsliste: jede Datei einer Altfehler-Liste steht in GEAENDERT (nicht: ${listen.filter((n) => !GEAENDERT_KANON.has(n)).join(', ') || 'nichts'})`,
    );
  }
  // Negativprobe: andere Schreibweisen derselben geänderten Datei werden erkannt, eine unveränderte nicht.
  const synth = (pfad: string, zusatz = ''): Zeile => ({ abschnitt: 3, nr: 0, zellen: ['0', '', '', '', '', '', `✓ unverändert (\`${pfad}\`): x${zusatz}`] });
  ok(
    ['views/ShowView.tsx', 'renderer/src/views/ShowView.tsx', 'apps/player/src/renderer/src/views/ShowView.tsx'].every((p) => (zeilenFehler(synth(p)) ?? '').includes('geänderter Datei')) &&
      (zeilenFehler(synth('views/ShowView.tsx', ' (E3)')) ?? '').includes('mehr als die lesenden Brücken') &&
      (zeilenFehler(synth('store/player.ts', ' (E2)')) ?? '').includes('mehr als die lesenden Brücken') &&
      (zeilenFehler(synth('main/output-window.ts', ' (E3)')) ?? '').includes('mehr als die lesenden Brücken') &&
      zeilenFehler(synth('main/index.ts', ' (E3)')) === null &&
      zeilenFehler(synth('main/control-server.ts', ' (E2)')) === null &&
      zeilenFehler(synth('main/media-protocol.ts')) === null,
    'PL Funktionsliste: eine geänderte Datei wird in jeder Schreibweise erkannt; E2 und E3 entlasten nur Dateien mit den lesenden Brücken; eine unveränderte Datei ist frei',
  );
  // Der Verweis „Altfehler <ID>“ (Stufe 1 und 2) entlastet eine geänderte Datei nur, wenn die Liste der ID sie nennt (R6); nur mit dem
  // Wort „Altfehler“ und nur die neun Player-IDs.
  ok(
    zeilenFehler(synth('views/OutputView.tsx', ' (Altfehler PL-N)')) === null &&
      zeilenFehler(synth('main/output-window.ts', ' (E3, Altfehler PL-T13)')) === null &&
      zeilenFehler(synth('main/ipc.ts', ' (Altfehler PL-T13, Altfehler PL-N)')) === null &&
      (zeilenFehler(synth('views/OutputView.tsx', ' (E6)')) ?? '').includes('geänderter Datei') &&
      (zeilenFehler(synth('views/OutputView.tsx', ' (PL-N)')) ?? '').includes('geänderter Datei') &&
      ['PL-12', 'PL-16', 'PL-T1', 'PL-40', 'SC-S2', 'PL-N2'].every((id) => (zeilenFehler(synth('views/OutputView.tsx', ` (Altfehler ${id})`)) ?? '').includes('geänderter Datei')),
    'PL Funktionsliste: „Altfehler PL-N“ entlastet eine Datei aus der Liste von PL-N im unverändert-Haken; ohne das Wort „Altfehler“ oder mit einer anderen ID nicht',
  );
  // Negativprobe R6: eine geänderte Datei mit einer erlaubten ID, deren Liste sie nicht nennt, wird gemeldet; nennt ein Haken zwei
  // Dateien, entlastet die ID nur die eigene.
  ok(
    ['PL-N', 'PL-T13', 'PL-4', 'PL-11', 'PL-16a', 'PL-T14'].every((id) => (zeilenFehler(synth('views/ShowView.tsx', ` (Altfehler ${id})`)) ?? '').includes('geänderter Datei')) &&
      zeilenFehler(synth('views/ShowView.tsx', ' (Altfehler PL-10)')) === null &&
      (zeilenFehler(synth('views/OutputView.tsx', ' (Altfehler PL-10)')) ?? '').includes('geänderter Datei') &&
      (zeilenFehler(synth('views/OutputView.tsx', ' (Altfehler PL-T13)')) ?? '').includes('geänderter Datei') &&
      (zeilenFehler(synth('views/OutputView.tsx', ' (E3, Altfehler PL-T13)')) ?? '').includes('mehr als die lesenden Brücken') &&
      /geänderter Datei \(views\/ShowView\.tsx\)/.test(zeilenFehler(synth('views/OutputView.tsx', ' und `views/ShowView.tsx` (Altfehler PL-N)')) ?? ''),
    'PL Funktionsliste: eine geänderte Datei mit einer Altfehler-ID, deren Liste sie nicht nennt, wird gemeldet (R6)',
  );
}

const zeile = (nr: number): Zeile | undefined => alle.find((z) => z.nr === nr);
const kuenftig = (nr: number): string => zeile(nr)?.zellen[6] ?? '';
const quelle = (pfad: string): string => (gibtEs(pfad) ? readFileSync(aufgeloest(pfad), 'utf8') : '');
const beginnt = (nr: number, ...orte: string[]): boolean => orte.some((o) => kuenftig(nr).startsWith(`✓ ${o}`));
const ersetzt = (nr: number, ort: string): boolean => kuenftig(nr).startsWith(`✓ ersetzt durch ${ort}`);
const nennt = (nr: number, ...woerter: string[]): boolean => woerter.every((w) => kuenftig(nr).includes(w));
const ohneKommentar = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const wurzel = quelle('views/PlayerOberflaeche.tsx');
const panel = quelle('views/Einstellungen.tsx');
const live = quelle('views/LiveBereich.tsx');
const fuss = quelle('views/Fussleiste.tsx');
const show = quelle('views/ShowView.tsx');
const sb = quelle('views/SoundboardView.tsx');
const bib = quelle('views/LibraryView.tsx');
const obf = quelle('lib/oberflaeche.ts');
const akt = quelle('lib/aktionen.ts');
const store = quelle('store/player.ts');
const cues = quelle('lib/cues.ts');
const ctl = quelle('main/control-server.ts');
const ausgabeMain = quelle('main/output-window.ts');

// ── Kopf, Reiter, Hinweisleiste (Nr. 1–6): Aufbau im AppShell, Name nach E16, Hell/Dunkel nach E5, Hinweisleiste je Reiter ──
ok(
  beginnt(1, 'Rahmen') && wurzel.includes('<AppShell') && wurzel.includes('status={statusLeiste(stand)}') && wurzel.includes('settings={<Einstellungen') && wurzel.includes("useState<Reiter>(anfangReiter)") && !gibtEs('components/Topbar.tsx'),
  'PL Funktionsliste Nr. 1: Aufbau im AppShell, Start immer Bibliothek, Reiter nicht gemerkt, die alte Kopfleiste (components/Topbar.tsx) ist weg',
);
ok(
  beginnt(3, 'Kopf') && nennt(3, 'entfällt (E16)', 'JM Player', 'JM PLAYER', 'Player · Bibliothek · Soundboard') && wurzel.includes('tool="Player"'),
  'PL Funktionsliste Nr. 3: Logo und Name „JM Player“ im Kopf (früher „JM PLAYER“), der Untertitel „Player · Bibliothek · Soundboard“ entfällt (E16)',
);
ok(
  beginnt(4, 'Werkzeugleiste') && wurzel.includes('toolbar={<Tabs') && ['Bibliothek', 'Soundboard', 'Cue-Show', 'Medien · Playlists', 'Sofort-Cues · Hotkeys', 'GO · QLab-Stil'].every((w) => wurzel.includes(w)) && nennt(4, 'E14'),
  'PL Funktionsliste Nr. 4: die drei Reiter mit den alten Zusatztexten stehen als Tabs in der Werkzeugleiste (E14)',
);
ok(
  ersetzt(5, 'Kopf') && nennt(5, 'E5', 'jm-theme', '`packages/ui/src/lib/theme.ts`', 'Light', 'Dark') && !/classList|setTheme|localStorage/.test(wurzel) && quelle('packages/ui/src/lib/theme.ts').includes("'jm-theme'"),
  'PL Funktionsliste Nr. 5: Hell/Dunkel ist der ThemeToggle im gemeinsamen Kopf (E5, jm-theme), der lokale Knopf „Light“/„Dark“ entfällt',
);
ok(
  beginnt(6, 'Rahmen') && wurzel.includes('HINWEIS_UNTEN') && wurzel.includes('setTimeout(() => setNotice(null), 4000)') && ['library', 'soundboard', 'show'].every((r) => new RegExp(`${r}: '`).test(wurzel)) && nennt(6, 'je Reiter'),
  'PL Funktionsliste Nr. 6: die Hinweisleiste bleibt bei 4 s und steht je Reiter versetzt (über Fußleiste bzw. Transport)',
);

// ── Bibliothek (Nr. 7–29) und die Abwesenheit von Stop und Panik (Nr. 30) ──
ok(
  [...Array(23).keys()].map((i) => i + 7).every((nr) => beginnt(nr, 'Bibliothek') && nennt(nr, '`views/LibraryView.tsx`')) && bib.includes('<Fussleiste />') && bib.includes('<PlayerPanel />') && bib.includes('<Sidebar />'),
  'PL Funktionsliste Nr. 7–29: die Bibliothek (Quellen, Liste, Vorschau) steht in views/LibraryView.tsx, darunter die Fußleiste',
);
ok(
  beginnt(30, 'Fußleiste') && nennt(30, 'E14', 'W2-10', 'Vorschau', 'Owner', '`views/Fussleiste.tsx`') && bib.includes('<Fussleiste />') && sb.split('<Fussleiste />').length - 1 >= 2 && !show.includes('<Fussleiste') && fuss.includes('abSpalte2'),
  'PL Funktionsliste Nr. 30: Stop und Panik stehen jetzt in Bibliothek und Soundboard (Fußleiste, E14); Panik stoppt die Vorschau der Bibliothek nicht (Owner-Frage offen); die Cue-Show hat keine Fußleiste',
);
ok(
  fuss.includes('showStop') && fuss.includes('showPanic') && !/keydown|onKeyDown/.test(fuss) && obf.includes('export function fussleistenTasten') && obf.includes('shortcut: _ohneKuerzel') && fuss.includes('abSpalte2'),
  'PL Funktionsliste Nr. 30: die Fußleiste ruft showStop und showPanic ohne Kürzel, Stop und Panik in Spalte 2 und 3',
);
ok(
  nennt(23, 'Panik', 'nicht') && !/showPanic|cueEngine|stopAll/.test(ohneKommentar(bib)) && !/showStop|panic/i.test(ohneKommentar(bib)),
  'PL Funktionsliste Nr. 23: die Vorschau der Bibliothek hängt weiter an keiner Stop- oder Panik-Logik des Stores',
);

// ── Soundboard (Nr. 31–37, 70–75) ──
ok(
  [31, 32, 33, 34, 35, 36, 37].every((nr) => beginnt(nr, 'Soundboard') && nennt(nr, '`views/SoundboardView.tsx`')) && sb.includes('Alle stoppen') && sb.includes('cueEngine.stopAll()') && sb.includes('+ zuweisen') && sb.includes('Noch kein Soundboard'),
  'PL Funktionsliste Nr. 31–37: Auswahl, Leerzustand, Alle stoppen, Pad-Raster und Pads stehen in views/SoundboardView.tsx',
);
ok(
  nennt(33, 'ladend', 'Ruling') && cues.includes('stopAllZaehler') && cues.includes('zaehler === this.stopAllZaehler'),
  'PL Funktionsliste Nr. 33/101: „Alle stoppen“ verwirft auch ein noch ladendes Pad (Generationszähler der cueEngine)',
);

// ── Cue-Show (Nr. 38–51): Kopf, Liste, Zeilen ──
ok(
  [38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51].every((nr) => beginnt(nr, 'Cue-Show') && nennt(nr, '`views/ShowView.tsx`')) && show.includes('Noch keine Show') && show.includes('onClick={onAusgabe}') && show.includes('<VideoProgress'),
  'PL Funktionsliste Nr. 38–51: Kopf, Liste und Zeilen der Cue-Show stehen in views/ShowView.tsx',
);
ok(nennt(43, 'Panel Ausgabe', 'E14') && wurzel.includes('ausgabeOeffnen') && wurzel.includes('setPanelAbschnitt(ABSCHNITT.ausgabe)') && wurzel.includes('<CueShow onAusgabe={ausgabeOeffnen} />'), 'PL Funktionsliste Nr. 43: „▦ Ausgabe“ öffnet das Panel beim Abschnitt Ausgabe statt des Dialogs');

// ── Zeilen 39/42: die Show wählen oder löschen räumt wie bisher, stoppt aber keine Pads (Ruling Task 14, panikDerShow) ──
{
  const kopf = (name: string): string => store.slice(store.indexOf(`${name}: async`), store.indexOf(`${name}: async`) + 900);
  ok(
    [39, 42].every((nr) => nennt(nr, 'panikDerShow', 'Pads')) &&
      /selectShow: async[\s\S]{0,400}panikDerShow\(set\)/.test(store) &&
      /removeShow: async[\s\S]{0,400}panikDerShow\(set\)/.test(store) &&
      !kopf('selectShow').slice(0, 500).includes('cueEngine.stopAll') &&
      !kopf('removeShow').slice(0, 500).includes('cueEngine.stopAll'),
    'PL Funktionsliste Nr. 39/42: Show wählen und löschen räumen die Show (panikDerShow) und lassen die Pads laufen',
  );
}

// ── Transport (Nr. 52–56) und Panik/Stop (Nr. 108–111): Wortlaut, Reihenfolge, Gründe ──
ok(beginnt(52, 'Live-Bereich Cue-Show Standby'), 'PL Funktionsliste Nr. 52: die Standby-Anzeige steht im Live-Bereich Cue-Show');
ok(
  nennt(52, 'über den Tasten') && live.includes('data-player="standby"') && live.indexOf('data-player="standby"') < live.indexOf('<Tasten tasten={transportKnoepfe') && obf.includes("ende: '— Ende —'"),
  'PL Funktionsliste Nr. 52: die Standby-Anzeige steht über den Tasten (Transport zweizeilig), Wortlaut unverändert',
);
ok(
  [53, 54, 55, 56].every((nr) => beginnt(nr, 'Live-Bereich Cue-Show Transport')) &&
    live.includes('knopf(t.pauseWeiter, a.showTogglePause), knopf(t.stop, a.showStop), knopf(t.panik, a.showPanic), knopf(t.go, a.showGo)') &&
    nennt(56, 'GO ⏎', 'Leertaste', 'rechts') &&
    obf.includes("go: 'GO'") && !obf.includes('GO ⏎') &&
    nennt(53, 'Kein Cue läuft', 'E7') && obf.includes("keinCueLaeuft: 'Kein Cue läuft'") &&
    nennt(56, 'Kein Standby-Cue') && obf.includes("keinStandby: 'Kein Standby-Cue'"),
  'PL Funktionsliste Nr. 53–56: Pause/Weiter, Stop, Panik und GO im Transport in der alten Reihenfolge, GO ohne „⏎“ mit Hinweis „Leertaste“, Sperrgründe sichtbar',
);
ok(nennt(55, 'Sofort alles stoppen', 'Wrapper'), 'PL Funktionsliste Nr. 55: der Haken nennt den Tooltip „Sofort alles stoppen“ am Wrapper');
ok(
  live.includes('title={tipp}') && obf.includes('tipp: T.tipps.panik') && obf.includes("panik: 'Sofort alles stoppen'") && !/<TallyButton[^>]*title=/.test(live),
  'PL Funktionsliste Nr. 55: der Panik-Tooltip hängt am Wrapper (title der Hülle), nicht am Knopf',
);
ok(
  [54, 109].every((nr) => nennt(nr, 'Pause')) && nennt(54, 'Ausklingen') && nennt(54, 'ON AIR'),
  'PL Funktionsliste Nr. 54: Stop beendet auch die Pause; das Ausklingen nach Stop zählt nicht als ON AIR (dokumentierte Ausnahme)',
);

// ── Panik stoppt auch die Pads (E14, W2-10; Nr. 55, 111, Befund 1) ──
{
  const i = store.indexOf('showPanic: () => {');
  const panik = store.slice(i, i + 900);
  ok(
    [55, 111].every((nr) => nennt(nr, 'Pads', 'E14', 'W2-10')) &&
      panik.includes('cueEngine.stopAll()') &&
      panik.indexOf('cueEngine.stopAll()') < panik.indexOf('panikDerShow(set)') &&
      nennt(111, 'Companion', 'zuerst') &&
      nennt(55, 'zuerst', 'ladend') &&
      store.includes('function panikDerShow') &&
      cues.includes('this.stopAllZaehler++'),
    'PL Funktionsliste Nr. 55/111: Panik (Taste und Companion) stoppt zuerst die Pads, auch ein ladendes; der Tooltip stimmt damit',
  );
  ok(nennt(55, 'Vorschau') && nennt(111, 'Vorschau'), 'PL Funktionsliste Nr. 55/111: die Vorschau der Bibliothek läuft bei Panik weiter (Owner-Frage offen)');
}

// ── Pausen-Merker (Nr. 98, 99, 105, 110; Befund 11): Stop und jeder Cue-Start heben die Pause auf ──
ok(
  [98, 99, 110].every((nr) => nennt(nr, 'Befund 11')) &&
    [98, 99].every((nr) => beginnt(nr, 'Cue-Show') && nennt(nr, '`store/player.ts`')) &&
    /showStop: [\s\S]{0,900}showPaused: false/.test(store) &&
    /const startNow[\s\S]{0,1200}showPaused: false/.test(store) &&
    nennt(98, 'Pause/Weiter', 'paused'),
  'PL Funktionsliste Nr. 98/99/110: Stop und jeder Cue-Start (auch nach dem Vorlauf) setzen „pausiert“ zurück; sichtbar nur Pause/Weiter und Companion paused',
);

// ── ON AIR (Nr. 105, E4): Video nur über den Fortschritt, Ausklingen und Vorlauf zählen nicht, ein Pad allein ist ON AIR ──
ok(
  beginnt(105, 'Cue-Show') && nennt(105, 'E4', 'ON AIR', 'Videofortschritt', 'Vorlauf', 'Pad', 'Ausklingen', '`lib/oberflaeche.ts`', '`store/player.ts`') &&
    obf.includes('export function kopfOnAir') && obf.includes('showSpielt(s) || (s.pads?.length ?? 0) > 0') && obf.includes('p.videoCue !== null && p.videoProgress !== null') && obf.includes('!p.vorlaufCueIds.includes(id)') &&
    wurzel.includes('onAir={kopfOnAir(stand)}') && store.includes('computeRemoteState'),
  'PL Funktionsliste Nr. 105: ON AIR im Kopf aus Show oder Pads (E4), Video nur mit Fortschritt, Vorlauf zählt nicht; die Fernsteuerungs-Ableitung bleibt',
);
ok(nennt(105, 'paused') && nennt(105, 'Stop') && nennt(105, 'Companion'), 'PL Funktionsliste Nr. 105: Companion paused fällt nach Stop und Cue-Start zurück (Ruling Task 14)');

// ── Dialog „Video-Ausgabe“ → Panel Ausgabe (Nr. 57–61), Bildschirmwahl speichert nur, Vollbild nur gemessen (E14) ──
ok(
  [57, 58, 59, 60].every((nr) => ersetzt(nr, 'Panel Ausgabe') && nennt(nr, 'E14')) && /^✓ entfällt \(/.test(kuenftig(61)) && nennt(61, 'E14', 'Fertig'),
  'PL Funktionsliste Nr. 57–61: der Dialog „Video-Ausgabe“ ist das Panel Ausgabe (E14), „Fertig“ entfällt',
);
ok(
  !show.includes('OutputModal') && !show.includes('outputOpen') && panel.includes('<ScreenOutputSection {...ausgabeAbschnitt(stand, aktionen)} />') && obf.includes('export function ausgabeAbschnitt') && obf.includes("hinweis: 'Bildschirm für das Vollbild-Ausgabefenster wählen. Video-Cues erscheinen dort.'") && nennt(57, 'Bildschirm für das Vollbild-Ausgabefenster wählen'),
  'PL Funktionsliste Nr. 57: das Modal ist aus ShowView verschwunden, das Panel zeigt ScreenOutputSection und den alten Hinweistext',
);
ok(
  nennt(58, 'Automatisch (Hauptmonitor)', 'null', 'nur gemerkt') && nennt(58, 'Auf diesen Bildschirm') && akt.includes('bildschirmWaehlen: (id) => q.setOutputDisplayId(id)') && akt.includes('ausgabeVerschieben') && panel.includes('kannVerschieben(stand.ausgabe)') && obf.includes("verschieben: 'Auf diesen Bildschirm'") && store.includes('setOutputDisplayId: (id) => set({ outputDisplayId: id })'),
  'PL Funktionsliste Nr. 58: die Bildschirmwahl speichert nur („Automatisch (Hauptmonitor)“ merkt null), „Auf diesen Bildschirm“ zieht das offene Fenster um',
);
ok(
  nennt(59, 'Schalter') && akt.includes('ausgabeUmschalten: (an) => danach(an ? aufGemerktem() : q.closeOutput())') && nennt(59, 'gemerkten Bildschirm'),
  'PL Funktionsliste Nr. 59: der Ausgabeschalter öffnet auf dem gemerkten Bildschirm und schließt',
);
ok(
  nennt(60, 'gemessen', 'abweicht') && akt.includes("typeof q.vollbild === 'boolean' && q.vollbild !== an") && obf.includes("capabilities: vollbild === undefined ? { toggle: true } : { toggle: true, fullscreen: true }") && ausgabeMain.includes('export function isOutputFullscreen') && nennt(60, '`main/output-window.ts`', 'E14'),
  'PL Funktionsliste Nr. 60: das Vollbild wird nur angeboten, wenn es gemessen ist, und schaltet nur bei abweichendem Messwert (E14)',
);
ok(nennt(95, 'gemerkten Bildschirm') && nennt(93, 'gemerkt') && store.includes('output.open('), 'PL Funktionsliste Nr. 93/95: der Video-Cue öffnet die Ausgabe weiter auf dem gemerkten Bildschirm');
ok(nennt(95, 'erste GO', 'Altfehler PL-N'), 'PL Funktionsliste Nr. 95: das erste GO bei geschlossener Ausgabe spielt das Video (Altfehler PL-N)');

// ── Dialoge (Nr. 62–75): Modal aus @jm/ui, Escape schließt und verwirft, das Hotkey-Feld hat einen toten Escape-Zweig ──
ok(
  [62, 63, 64, 65, 66, 67, 68, 69].every((nr) => beginnt(nr, 'Dialoge') && nennt(nr, '`views/ShowView.tsx`')) && [70, 71, 72, 73, 74, 75].every((nr) => beginnt(nr, 'Dialoge') && nennt(nr, '`views/SoundboardView.tsx`')) && show.includes('<Modal onClose={onClose}') && sb.includes('<Modal onClose={onClose}'),
  'PL Funktionsliste Nr. 62–75: die drei Dialoge stehen in den Views und laufen über Modal aus @jm/ui (E14)',
);
ok(
  [73, 135, 139].every((nr) => nennt(nr, 'Escape', 'verwirft')) && sb.includes("if (e.key === 'Escape') return;") && nennt(135, 'tot') && quelle('packages/ui/src/components/Modal.tsx').includes("e.key === 'Escape'"),
  'PL Funktionsliste Nr. 73/135/139: Escape schließt die drei Dialoge und verwirft die Eingabe, auch im Hotkey-Feld; der alte Escape-Zweig dort ist tot',
);
ok(
  beginnt(76, 'Dialoge') && beginnt(77, 'Dialoge') && show.includes("window.prompt('Show umbenennen'") && show.includes("window.confirm('Diese Show löschen?')"),
  'PL Funktionsliste Nr. 76/77: window.prompt und window.confirm der Cue-Show bleiben unverändert',
);

// ── Tastatur (Nr. 130–140, Pflichtzeilen): Filter, Panel-Tasten nach O1, Pad-Tasten, Knöpfe ──
ok(
  [130, 131, 133, 134, 136, 138, 139, 140].every((nr) => zeile(nr) !== undefined) && beginnt(130, 'Cue-Show') && nennt(130, 'Leertaste', 'Escape') && /e\.code === 'Space'/.test(show) && show.includes("e.key === 'Escape'") && show.includes('showGo()') && show.includes('showStop()'),
  'PL Funktionsliste Nr. 130 (Pflichtzeile Tastatur): Leertaste = GO und Escape = Stop bleiben im Hörer der Cue-Show',
);
{
  const kopf = show.slice(show.indexOf('const onKey'), show.indexOf('const onKey') + 400);
  ok(
    beginnt(131, 'Cue-Show') && nennt(131, 'outputOpen', 'contentEditable', 'O1') && kopf.includes('if (addOpen || editCue || rueckfrage) return;') && !kopf.includes('outputOpen') && kopf.includes('istEingabeZiel(e.target)') && /isContentEditable === true/.test(obf) && nennt(131, 'Escape', 'Panel'),
    'PL Funktionsliste Nr. 131: der Filter der Cue-Show hat outputOpen mit dem Modal verloren, sperrt Felder samt contentEditable und lässt Knöpfe durch',
  );
  ok(
    beginnt(134, 'Soundboard') && nennt(134, 'Feld', 'Pad-Dialog') && /padTasteErlaubt\(e, /.test(sb) && !/tagName === 'INPUT'/.test(sb),
    'PL Funktionsliste Nr. 134: die Pad-Tasten feuern nicht, solange der Fokus in einem Feld steht, auch im Pad-Dialog',
  );
  ok(nennt(131, 'istEingabeZiel') && nennt(134, 'istEingabeZiel') && /isContentEditable === true/.test(obf), 'PL Funktionsliste Nr. 131/134: der Feldschutz (istEingabeZiel) ist die gemeinsame Weiche, mit contentEditable');
}
ok(
  zeile(132)?.zellen[1] === 'Panel-Tasten' && beginnt(132, 'Panel ') && ['Leertaste', 'Escape', 'Feld', 'Schalter', 'O1', 'GO'].every((w) => kuenftig(132).includes(w)),
  'PL Funktionsliste Nr. 132 (Pflichtpunkt Panel-Tasten): Leertaste und Escape, je für Feld und Knopf/Schalter (Spec 10, O1)',
);
{
  const sp = quelle('packages/ui/src/components/SettingsPanel.tsx');
  ok(sp.includes('Escape') && sp.includes('defaultPrevented'), 'PL Funktionsliste Nr. 132: SettingsPanel schließt mit Escape, nur wenn nicht defaultPrevented, und hält Escape im Panel');
  ok(
    wurzel.includes('settings={<Einstellungen') && !panel.includes('<ShowView') && !panel.includes('<LibraryView') && wurzel.includes('<CueShow onAusgabe={ausgabeOeffnen} />'),
    'PL Funktionsliste Nr. 132: das Panel ist kein eigener Bildschirm, die Cue-Show bleibt bei offenem Panel gemountet (Leertaste erreicht GO)',
  );
}
ok(
  beginnt(133, 'Soundboard') && /e\.key|normalizeKey/.test(sb) && sb.includes('trigger(') && nennt(133, 'Pad-Tasten'),
  'PL Funktionsliste Nr. 133 (Pflichtzeile Pad-Tasten): Pad-Tasten bleiben im Hörer des Soundboards',
);
ok(
  beginnt(136, 'Bibliothek') && bib.includes("e.key === 'Enter'") && bib.includes("e.key === 'Escape'"),
  'PL Funktionsliste Nr. 136: Enter und Escape im Namensfeld der Bibliothek bleiben, sonst keine Taste',
);
ok(
  nennt(138, 'aria-disabled', 'einmal', 'Enter') && quelle('packages/ui/src/components/TallyButton.tsx').includes("e.key === 'Enter' && e.repeat") && !/^✓ unverändert/.test(kuenftig(138)),
  'PL Funktionsliste Nr. 138: Knöpfe: gesperrte Haupttasten sind fokussierbar (aria-disabled), gehaltenes Enter feuert GO einmal (nicht unverändert)',
);
ok(nennt(140, 'Fußleiste') && nennt(140, 'Stop', 'Panik'), 'PL Funktionsliste Nr. 140: Stop und Panik haben jetzt eine Fußleiste, aber weiter kein Kürzel außerhalb der Cue-Show');
ok(
  !/keydown|addEventListener|onKeyDown/.test(ohneKommentar(live)) && !/keydown|addEventListener|onKeyDown/.test(ohneKommentar(fuss)) && !/keydown/.test(ohneKommentar(quelle('views/OutputView.tsx'))) && beginnt(129, 'Ausgabefenster') && nennt(129, '`views/OutputView.tsx`'),
  'PL Funktionsliste Nr. 129: weder Live-Bereich noch Fußleiste noch das Ausgabefenster hören auf Tasten',
);

// ── Abläufe aus Abschnitt 3: bleiben im Main, im Store und in der Wurzel-View, nicht im Panel (E15) ──
{
  ok(
    nennt(81, '`App.tsx`', '`store/player.ts`') && quelle('App.tsx').includes('void load()') && store.includes('onOutputEnded') && store.includes('takeShowSettings') && store.includes('setupRemote'),
    'PL Funktionsliste Nr. 81: das Laden und Abonnieren läuft in App und Store, oberhalb des Panels',
  );
  ok(
    wurzel.includes('useBrueckenWert(MASTER_LINK_QUELLE)') && wurzel.includes('useBrueckenWert(AUSGABE_QUELLE)') && wurzel.includes('padsAbonnieren(cueEngine, setPads)') && wurzel.includes('liesBildschirme(') && wurzel.includes('liesVollbild(') && wurzel.includes('baueAktionen('),
    'PL Funktionsliste Nr. 81/102/104: Brücken, Pad-Meldung, Bildschirmliste, Vollbild und Aktionen laufen in der Wurzel-View, auch bei geschlossenem Panel',
  );
  ok(
    ['window.', 'useEffect', 'setInterval', 'addEventListener', 'usePlayer('].every((w) => !ohneKommentar(panel).includes(w)) && !ohneKommentar(live).includes('window.') && !ohneKommentar(fuss).includes('window.'),
    'PL Funktionsliste: Einstellungen.tsx hat keinen Zugriff auf window, keine Effekte und keinen Store, LiveBereich.tsx kein window (E15)',
  );
  ok(
    nennt(82, '`renderer/src/main.tsx`', 'E6') && quelle('renderer/src/main.tsx').includes("'#output'") && !quelle('views/OutputView.tsx').includes('AppShell') && !GEAENDERT_KANON.has('apps/player/src/renderer/src/main.tsx'),
    'PL Funktionsliste Nr. 82: #output lädt weiter die OutputView, ohne AppShell (E6)',
  );
  ok(
    [87, 88, 89, 90].every((nr) => kuenftig(nr).startsWith('✓ unverändert (')) && (GEAENDERT_KANON.has('apps/player/src/main/library.ts') ? /Altfehler PL-10/.test(kuenftig(87)) && /Altfehler PL-10/.test(kuenftig(89)) : true) && !GEAENDERT_KANON.has('apps/player/src/main/media-protocol.ts') && !GEAENDERT_KANON.has('apps/player/src/main/thumbs.ts'),
    'PL Funktionsliste Nr. 87–90: Datenbank, Medienprotokoll, Import und Vorschaubilder im Main sind unverändert',
  );
  ok(
    [83, 84, 85, 86, 91].every((nr) => kuenftig(nr).startsWith('✓ unverändert (') && nennt(nr, '`main/index.ts`')) && nennt(92, '`preload/index.ts`'),
    'PL Funktionsliste Nr. 83–86/91: Einzelinstanz, Laufzeitschicht, Start, Ende und Show-Deep-Link im Main sind unverändert (nur die lesenden Brücken, E2, E3)',
  );
  ok(
    [94, 95, 96, 97].every((nr) => beginnt(nr, 'Cue-Show') && nennt(nr, '`store/player.ts`')) && [96, 100, 101].every((nr) => nennt(nr, '`lib/show-audio.ts`') || nennt(nr, '`lib/cues.ts`')),
    'PL Funktionsliste Nr. 94–97/100/101: Cue starten, Video, Audio, Ende und Pad-Maschine bleiben in Store und Klangmaschinen',
  );
  ok(
    nennt(101, 'onChange', 'aktiveIds', 'E4') && cues.includes('aktiveIds()') && cues.includes('onChange(cb') && wurzel.includes('padsAbonnieren'),
    'PL Funktionsliste Nr. 101: die Pad-Maschine meldet jetzt die spielenden Pads (für ON AIR und den Statuseintrag pads)',
  );
  ok(
    nennt(102, 'Altfehler PL-T13', 'Altfehler PL-N', 'E3') &&
      nennt(103, 'Altfehler PL-T13') &&
      !nennt(102, 'bleibt als Altfehler') &&
      !nennt(103, 'Fensterreferenz bleibt unverändert') &&
      ausgabeMain.includes('lebende.aktuelles()') &&
      quelle('main/ausgabe-fenster.ts').includes('class LebendeFenster') &&
      !/\boutputWindow\b/.test(ohneKommentar(ausgabeMain)),
    'PL Funktionsliste Nr. 102/103: der Ausgabezustand folgt den lebenden Fenstern (E3); es gibt höchstens ein Ausgabefenster, die Fensterreferenz verwaist nicht mehr (Altfehler PL-T13), Befehle warten auf „bereit“ (Altfehler PL-N)',
  );
}

// ── Fernsteuerung (Nr. 104–119): Server und Verben unverändert, die Meldung ist neu (E2) ──
{
  ok(
    beginnt(104, 'Panel Fernsteuerung') && nennt(104, 'E2', 'Statusleiste', '`main/control-server.ts`', '`shared/fernsteuerung.ts`') && ctl.includes('onMeldung') && panel.includes('<RemoteControlSection {...fernsteuerungAbschnitt(stand)} />') && obf.includes("companionModule: PLAYER_TEXTE.companionModul"),
    'PL Funktionsliste Nr. 104: die Fernsteuerungs-Meldung (Port, Clients, Fehler) steht im Panel Fernsteuerung und in der Statusleiste (E2)',
  );
  ok(
    [108, 109, 110, 111, 112, 113, 114, 115, 116, 117].every((nr) => nennt(nr, '`main/control-server.ts`') && nennt(nr, '`store/player.ts`')),
    'PL Funktionsliste Nr. 108–117: die zehn Verben laufen weiter über control-server.ts und den Store',
  );
  ok(
    [105, 106, 107].every((nr) => nennt(nr, '`main/control-server.ts`')) && nennt(118, '`packages/suite-control-protocol/src/capabilities.ts`') && kuenftig(118).startsWith('✓ unverändert (') && beginnt(119, 'Panel Fernsteuerung'),
    'PL Funktionsliste Nr. 105–107/118/119: Zustand, Befehlsweg und Fähigkeitsliste bleiben, die Lücke „kein Zustand im Preload“ ist geschlossen',
  );
  ok(nennt(109, 'Pads') && nennt(109, 'nicht') && nennt(111, 'stoppt'), 'PL Funktionsliste Nr. 109/111: Companion stop stoppt weiter keine Pads, Companion panic stoppt sie jetzt');
}

// ── Abschnitt 5: Ausgabefenster unverändert (E6); neu meldet die Ausgabeansicht nur „bereit“ (Altfehler PL-N), und es gibt
// höchstens ein Fenster (Altfehler PL-T13) ──
{
  const ov = ohneKommentar(quelle('views/OutputView.tsx'));
  const zugriffe = [...ov.matchAll(/window\.jmplay\.output\.(\w+)/g)].map((m) => m[1]).sort();
  ok(
    [120, 121, 122, 123, 124, 125, 126, 127, 128, 129].every((nr) => beginnt(nr, 'Ausgabefenster') && nennt(nr, nr === 120 ? '`main/output-window.ts`' : '`views/OutputView.tsx`')) &&
      nennt(120, 'Altfehler PL-T13', 'Altfehler PL-N') &&
      nennt(122, 'Altfehler PL-N', 'bereit') &&
      ["case 'load':", "case 'stop':", "case 'pause':", "case 'resume':", "case 'black':"].every((c) => ov.includes(c)) &&
      zugriffe.join(',') === 'meldeBereit,notifyEnded,onCommand,reportTime',
    'PL Funktionsliste Nr. 120–129: Ausgabefenster und seine Befehle (views/OutputView.tsx) bleiben (E6); neu meldet die Ansicht nur „bereit“ (Altfehler PL-N), höchstens ein Fenster (Altfehler PL-T13)',
  );
}

// ── Gemerkte Zustände: kein localStorage, alles in der Datenbank oder im Speicher ──
{
  ok(
    !/localStorage|sessionStorage|persistId/.test(wurzel + panel + live + fuss + akt + show + sb + bib + store),
    'PL Funktionsliste Nr. 147–153 (App-Quelltext): die Oberfläche der App merkt nichts selbst; alles Gemerkte liegt weiter in der Datenbank oder im Speicher',
  );
  ok(
    ['jm-theme', 'E5'].every((w) => kuenftig(148).includes(w)) && kuenftig(148).includes('`packages/ui/src/lib/theme.ts`') && quelle('packages/ui/src/lib/theme.ts').includes("'jm-theme'"),
    'PL Funktionsliste Nr. 148: der Haken nennt die Ausnahme Hell/Dunkel im gemeinsamen Kopf (jm-theme in localStorage, E5)',
  );
  ok(
    nennt(152, 'setOutputDisplayId', 'null') && store.includes('outputDisplayId: number | null'),
    'PL Funktionsliste Nr. 152: der Ausgabebildschirm wird im Panel nur im Store gemerkt (null = automatisch), weiter nicht gespeichert',
  );
  ok(beginnt(147, 'Rahmen') && beginnt(151, 'Rahmen', 'Bibliothek') && beginnt(150, 'Bibliothek'), 'PL Funktionsliste Nr. 147/150/151: Reiter, Vorschau und Suchfelder werden weiter nicht gemerkt');
  ok(
    [141, 142, 143, 144, 145, 146].every((nr) => kuenftig(nr).startsWith('✓ unverändert (')) && !GEAENDERT_KANON.has('packages/media-library/src/schema.ts'),
    'PL Funktionsliste Nr. 141–146: Datenbank und Vorschauordner sind unverändert',
  );
}

// ── Statusleiste (Nr. 103 bis 105 im Plan): alle fünf Einträge stehen in der Statusleiste ──
ok(
  ["id: 'video-ausgabe'", "id: 'show'", "id: 'pads'", 'masterLinkStatusItem(s.masterLink)', "group: 'fernsteuerung'"].every((w) => obf.includes(w)) && /\bE3\b/.test(kuenftig(102)) && beginnt(103, 'Statusleiste') && beginnt(104, 'Panel Fernsteuerung'),
  'PL Funktionsliste: die Statusleiste hat Master-Link, Video-Ausgabe, Fernsteuerung, Cue-Show und Pads',
);

// ── Kein Rückfall auf geratene Werte: window.prompt und window.confirm je einmal in der Cue-Show, kein alert ──
// Seit Ruling R16 (Fix-Welle F2) sind die Rückfragen beim Entfernen eines Cues und eines Mediums Fenster im Fenster (EntfernenFrage);
// gezählt wird je Aufruf getrennt.
{
  const dateien = ['App.tsx', 'views/PlayerOberflaeche.tsx', 'views/LiveBereich.tsx', 'views/Fussleiste.tsx', 'views/Einstellungen.tsx', 'views/SoundboardView.tsx', 'views/LibraryView.tsx', 'views/EntfernenFrage.tsx', 'lib/aktionen.ts', 'lib/oberflaeche.ts', 'store/player.ts'];
  ok(
    dateien.every((d) => gibtEs(d) && !/\bwindow\.(?:confirm|alert|prompt)\(/.test(quelle(d))) &&
      (show.match(/window\.prompt\(/g) ?? []).length === 1 &&
      (show.match(/window\.confirm\(/g) ?? []).length === 1 &&
      show.includes("window.confirm('Diese Show löschen?')") &&
      !/\bwindow\.alert\(/.test(show),
    'PL Funktionsliste: window.prompt (Show umbenennen) und window.confirm (Show löschen) je einmal in der Cue-Show; die Rückfragen beim Entfernen eines Cues und eines Mediums sind Fenster im Fenster (Altfehler PL-10, Ruling R16), die Bibliothek hat kein window.confirm, window.alert nirgends',
  );
}

// ── Abschnitt 9 und der Kopf „Stand“ widersprechen den Haken nicht (Fix-Runde 1) ──
{
  const abschnitt9 = text.slice(text.indexOf('## 9 · '), text.indexOf('## 10 · '));
  const stand = text.slice(text.indexOf('- **Stand:**'), text.indexOf('- **künftig wo**'));
  ok(!/öffnet wie heute sofort/.test(abschnitt9) && /nur gemerkt/.test(abschnitt9) && /null/.test(abschnitt9), 'PL Funktionsliste Abschnitt 9: die Bildschirmwahl öffnet nicht sofort, sie wird nur gemerkt (Automatisch = null)');
  ok(!/einzige gewollte Änderung/.test(abschnitt9) && /Owner-Frage/.test(abschnitt9) && /W2-10/.test(abschnitt9), 'PL Funktionsliste Abschnitt 9: Panik-Pads ist nicht „die einzige gewollte Änderung“, die offene Owner-Frage zur Vorschau steht dabei');
  ok(/zum Zeitpunkt der Erhebung/.test(stand) && !/sind leer, der Code ist seither unverändert/.test(stand), 'PL Funktionsliste Stand: „Code unverändert“ gilt nur zum Zeitpunkt der Erhebung');
  ok(/zum Zeitpunkt der Erhebung[^]*Testordner/.test(text.slice(text.indexOf('- **Gelesen'), text.indexOf('- **künftig wo**'))), 'PL Funktionsliste Kopf: „kein Testordner“ gilt nur zum Zeitpunkt der Erhebung');
}

// ── 2a-Nachzug in Welle 2b (Task 6): gemessener Ort im Ausgabe-Abschnitt statt der Zeile „Lage“, Bildschirmliste folgt dem
// Bildschirm-Ereignis, Video-Beleg für ON AIR nach Alt+F4; neu im Main und Preload nur das lesende Ereignis ──
{
  const main = quelle('main/index.ts');
  const preload = quelle('preload/index.ts');
  ok(
    ['Steht auf', 'measuredId', 'folgeBildschirmen', 'output:bildschirme', '2a-Nachzug'].every((w) => kuenftig(57).includes(w)) &&
      !kuenftig(57).includes('nennt eine Zeile unter dem Abschnitt') &&
      nennt(57, 'Bildschirm für das Vollbild-Ausgabefenster wählen') &&
      !panel.includes('gemesseneLage') &&
      !panel.includes('data-player="lage"') &&
      obf.includes('measuredId') &&
      !obf.includes('gemesseneLage'),
    'PL Funktionsliste Nachzug Nr. 57: der Ausgabe-Abschnitt nennt den gemessenen Ort („Steht auf“, measuredId), die Liste folgt output:bildschirme; die Zeile „Lage“ entfällt',
  );
  ok(
    nennt(81, 'folgeBildschirmen', '`lib/aktionen.ts`', 'Video-Beleg') && wurzel.includes('folgeBildschirmen(window.jmplay?.output?.onBildschirme') && wurzel.includes('naechsterVideoBeleg('),
    'PL Funktionsliste Nachzug Nr. 81: die Wurzel-View liest die Liste auch bei jedem Bildschirm-Ereignis (folgeBildschirmen) und führt den Video-Beleg',
  );
  ok(
    ['beobachteBildschirme', 'output:bildschirme', '`packages/output-window/src/bildschirme.ts`', '2a-Nachzug'].every((w) => kuenftig(85).includes(w)) &&
      /\bE[23]\b/.test(kuenftig(85)) &&
      main.includes("mainWindow.webContents.send('output:bildschirme');"),
    'PL Funktionsliste Nachzug Nr. 85: der Main meldet nach app.ready angesteckte, abgezogene und geänderte Bildschirme über beobachteBildschirme (output:bildschirme)',
  );
  ok(
    nennt(102, 'output:bildschirme', '`main/index.ts`', '2a-Nachzug') && preload.includes("ipcRenderer.on('output:bildschirme', listener);"),
    'PL Funktionsliste Nachzug Nr. 102: die Bildschirmliste wird auch auf das Ereignis output:bildschirme hin neu gelesen',
  );
  // Video-Beleg (Task 6 Nachzug): nach Alt+F4 und Wiederöffnen über den Panel-Schalter zählt das alte Video nicht mehr für ON AIR.
  ok(
    [59, 95, 105].every((nr) => nennt(nr, 'Video-Beleg', 'Task 6', 'Alt+F4')) &&
      nennt(105, '`lib/oberflaeche.ts`', 'naechsterVideoBeleg', 'Fortschritt', 'Companion') &&
      obf.includes('export function naechsterVideoBeleg') &&
      obf.includes('videoBelegt') &&
      !store.includes('videoBelegt'),
    'PL Funktionsliste Nachzug Nr. 59/95/105: der Video-Beleg (Task 6) – nach Alt+F4 und Wiederöffnen zählt das alte Video erst mit neuem Fortschritt; nur im Renderer, Companion unverändert',
  );
  ok(
    nennt(105, 'gemessen offenem Fenster', 'späte Position', 'einzeln') && wurzel.includes('AUSGABE_QUELLE.ereignis('),
    'PL Funktionsliste Nachzug Nr. 105 (Fix-Runde): ein Fortschritt belegt nur bei gemessen offenem Fenster (keine späte Position des alten Fensters), jede Meldung des Fensters zählt einzeln',
  );
  // Jeder Haken, der sagt, main/index.ts bekäme „nur“ Lesendes, nennt auch das Bildschirm-Ereignis.
  const nurSaetze = alle.filter((z) => /\bnur\b/.test(z.zellen[6]) && z.zellen[6].includes('`main/index.ts`') && /lesende/.test(z.zellen[6]));
  const ohneEreignis = nurSaetze.filter((z) => !z.zellen[6].includes('Bildschirm-Ereignis'));
  ok(
    nurSaetze.length >= 7 && ohneEreignis.length === 0,
    `PL Funktionsliste Nachzug: kein Haken sagt mehr, main/index.ts bekäme nur die bisherigen lesenden Brücken (${ohneEreignis.map((z) => z.nr).join(',') || 'keiner'}; mit Ereignis: ${nurSaetze.length})`,
  );
  ok(
    text.includes('| `output.onBildschirme(cb)` | `output:bildschirme` | Ereignis |') && /kein Bildschirm-Ereignis \(`output:bildschirme`\)/.test(text.slice(text.indexOf('## 8 · '), text.indexOf('## 9 · '))),
    'PL Funktionsliste Abschnitt 8: der Preload hat output.onBildschirme (Ereignis output:bildschirme, nur lesend, neu in Welle 2b)',
  );
  ok(
    text.includes('| `output.meldeBereit()` | `output:bereit` | send |') &&
      /keine Meldung „bereit“ des Ausgabefensters \(`output:bereit`\)/.test(text.slice(text.indexOf('## 8 · '), text.indexOf('## 9 · '))) &&
      preload.includes("meldeBereit: () => ipcRenderer.send('output:bereit'),"),
    'PL Funktionsliste Abschnitt 8: der Preload hat output.meldeBereit (send output:bereit, Altfehler PL-N)',
  );
  const synth = (k: string): Zeile => ({ abschnitt: 3, nr: 0, zellen: ['0', '', '', '', '', '', k] });
  ok(
    zeilenFehler(synth('✓ entfällt (x, B7)')) === null &&
      zeilenFehler(synth('✓ entfällt (x, B22)')) === null &&
      (zeilenFehler(synth('✓ entfällt (x, B23)')) ?? '').includes('Verweis außerhalb') &&
      (zeilenFehler(synth('✓ entfällt (x, B0)')) ?? '').includes('Verweis außerhalb') &&
      (zeilenFehler(synth('✓ entfällt (x, E17)')) ?? '').includes('Verweis außerhalb'),
    'PL Funktionsliste: Verweise B1–B22 und E1–E16 gelten, B0, B23 und E17 nicht',
  );
}
