// ─────────────────────────────────────────────────────────────────────────────
// Funktionsliste nach dem Umbau (UX Welle 1, Battle e; Spec 10 „Kein Funktionsverlust“). Jede der 92 Zeilen in den Abschnitten
// 1–7 von docs/ux/funktionslisten/battle.md ist in „künftig wo“ abgehakt: „✓ “ und ein Ort des Ortsregisters, „unverändert (…)“,
// „entfällt (…, E…)“ oder „ersetzt durch {Ort} (…, E…)“. E-Verweise nur auf E1–E18. Jede genannte Datei existiert, Groß- und
// Kleinschreibung wie im Repo. „unverändert (…)“ nennt die Datei in der Klammer und darf keine Datei nennen, die seit der
// Erhebung (210e1d9dcb) geändert wurde, außer sie bekam nur die lesende Fernsteuerungs-Meldung (E2, R18): dann steht der Hinweis
// im Haken. Dazu Querprüfungen gegen den Code (Haupttasten, Kürzel, Zahlfelder, Panel-Tasten nach O1, die Abläufe in den
// immer gemounteten Teilen statt im Panel, Statuseinträge, die ersetzten und die geänderten Elemente aus Task 26).
// Läuft im Paketordner apps/battle (npm run selftest -w @jm/battle, zweiter Lauf).
// Der Abgleich der Listen GEAENDERT und PAKETE_GEAENDERT mit git läuft nur mit der Umgebungsvariable JM_FUNKTIONSLISTE_GIT=1
// (einmal am Ende der Welle, R23); ohne sie oder ohne Verlauf im Klon bleiben die statischen Listen der Wächter.
// ─────────────────────────────────────────────────────────────────────────────

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { PEERS_TEXTE, peerSetzen, peerSetzenGrund } from '@jm/settings';
import { gleich, leseText, ok } from '@jm/ui/testhilfe';
import {
  BATTLE_TEXTE,
  clipQuelleText,
  clipZielText,
  gefundeneAdressen,
  gegenstellenAbschnitt,
  hauptTasten,
  onAirKopf,
  statusLeiste,
  tastenBeschriftung,
  vsHinweis,
  type OberflaechenStand,
} from '@/lib/oberflaeche';
import { liveTasten, tastenSchluessel, type TastenAktionen } from '@/views/LiveBereich';
import { battleState, clipJob, mitConfig, ohneKommentare, toolLink } from './testzustand';

const LISTE = '../../docs/ux/funktionslisten/battle.md';
const ERHEBUNG = '210e1d9dcb';

/** Panel-Abschnitte von Battle (Titel der @jm/settings-Abschnitte und der tool-eigenen Abschnitte, E16). */
const ABSCHNITTE = ['Fernsteuerung', 'Gegenstellen', 'Battle', 'Instant-Replay', 'Zurücksetzen'];

/**
 * Ortsregister des Plans. „Panel“ allein steht für die Panel-Tasten nach O1 (gilt für das ganze Panel, kein Abschnitt) und für das
 * Ersetzen der Modals durch das Panel (Nr. 37, 43, 50, 83).
 */
const ORTE: readonly string[] = [
  'Kopf',
  'Live-Bereich Ecken',
  'Live-Bereich Scoreboard',
  'Live-Bereich Ergebnis',
  'Haupttasten',
  'rechte Spalte Voting',
  'rechte Spalte Clip',
  'Statusleiste',
  'Voting-Webseite',
  'Panel',
  ...ABSCHNITTE.map((a) => `Panel ${a}`),
];

/** Zeilen insgesamt und je Abschnitt 1–7, wie Task 23 die Liste angelegt hat. */
const GESAMT = 92;
const JE_ABSCHNITT = [36, 18, 22, 0, 4, 6, 6];

/**
 * Alle Dateien von apps/battle, die seit der Erhebung (210e1d9dcb) geändert oder gelöscht wurden, in der Schreibweise der Liste. Ein
 * „unverändert (…)“ darf sie nur nennen, wenn der Haken E2 nennt (R18, nur die lesende Fernsteuerungs-Meldung). Läuft der Test in
 * einem Klon mit Verlauf, prüft er unten zusätzlich, dass git keine weitere Datei kennt.
 */
const GEAENDERT = [
  'App.tsx',
  'components/ClipPanel.tsx',
  'components/Competitors.tsx',
  'components/ConnectionsPanel.tsx',
  'components/RemotePanel.tsx',
  'components/Scoreboard.tsx',
  'components/Settings.tsx',
  'globals.css',
  'lib/bruecken.ts',
  'lib/oberflaeche.ts',
  'main/control-server.ts',
  'main/index.ts',
  'package.json',
  'preload/index.ts',
  'shared/fernsteuerung.ts',
  'shared/types.ts',
  'test/ui/bruecken.test.ts',
  'test/ui/funktionsliste.test.ts',
  'test/ui/hilfe.ts',
  'test/ui/live.test.tsx',
  'test/ui/oberflaeche.test.ts',
  'test/ui/panel.test.tsx',
  'test/ui/rahmen.test.tsx',
  'test/ui/selftest.ts',
  'test/ui/testzustand.ts',
  'test/ui/werkzeug.test.tsx',
  'tsconfig.test.json',
  'views/BattleOberflaeche.tsx',
  'views/Einstellungen.tsx',
  'views/LiveBereich.tsx',
];

/** Geänderte Dateien außerhalb von apps/battle, die ein Haken zitieren könnte (Stand Task 27, aus git diff gegen 210e1d9dcb). */
const PAKETE_GEAENDERT: string[] = [
  'packages/settings/src/abschnitte/peers.ts',
  'packages/settings/test/peers.test.tsx',
  'packages/ui/src/components/AppHeader.tsx',
  'packages/ui/src/components/StatusBar.tsx',
  'packages/ui/src/components/TallyButton.tsx',
  'packages/ui/src/lib/halten.ts',
  'packages/ui/test/header.test.tsx',
  'packages/ui/test/statusbar.test.tsx',
  'packages/ui/test/tally.test.tsx',
  '.github/workflows/ci-checks.yml',
  'package-lock.json',
];

/** Kanonischer Pfad ab der Repo-Wurzel, gleich welche Schreibweise der Haken wählt (kurz, mit renderer/src/ oder mit apps/battle/). */
function kanon(pfad: string): string {
  if (/^[A-Za-z.]+\.json$/.test(pfad)) return `apps/battle/${pfad}`; // Dateien der Paketwurzel (package.json, tsconfig.test.json)
  const a = aufgeloest(pfad);
  return a.startsWith('../../') ? a.slice('../../'.length) : `apps/battle/${a}`;
}

const GEAENDERT_KANON = new Set([...GEAENDERT.map(kanon), ...PAKETE_GEAENDERT]);
const NUR_MELDUNG = new Set(['main/index.ts', 'main/control-server.ts', 'preload/index.ts', 'shared/types.ts'].map(kanon));

/** Alle seit der Erhebung geänderten Dateien des Repos laut git (Pfade ab der Wurzel); null, wenn der Klon keinen Verlauf hat. */
function gitGeaendert(): Set<string> | null {
  try {
    const aus = execFileSync('git', ['diff', '--name-only', `${ERHEBUNG}..HEAD`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return new Set(aus.split(/\r?\n/).filter((n) => n !== ''));
  } catch {
    return null;
  }
}
/** Hinzugefügte und entfernte Zeilen einer Datei seit der Erhebung (git diff -U0); null ohne Verlauf. */
function gitZeilen(datei: string): { neu: string[]; weg: string[] } | null {
  try {
    const aus = execFileSync('git', ['diff', '-U0', `${ERHEBUNG}..HEAD`, '--', datei], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const z = aus.split(/\r?\n/);
    return { neu: z.filter((l) => l.startsWith('+') && !l.startsWith('+++')), weg: z.filter((l) => l.startsWith('-') && !l.startsWith('---')) };
  } catch {
    return null;
  }
}
// Nur auf Anforderung (R23): ohne JM_FUNKTIONSLISTE_GIT=1 sagt der Test nichts über git; die statischen Listen sind der Wächter.
const GIT_PRUEFEN = process.env.JM_FUNKTIONSLISTE_GIT === '1';
const GIT = GIT_PRUEFEN ? gitGeaendert() : null;
if (GIT_PRUEFEN && GIT === null) console.log(`BA Funktionsliste: kein git-Verlauf bis ${ERHEBUNG} (flacher Klon); die Prüfung gegen git entfällt, die statischen Listen gelten`);

/** Datei in Backticks: Pfad mit Endung, aufgelöst nach der Pfadregel im Kopf der Liste. */
const PFAD = /`([A-Za-z0-9_./-]+\.(?:tsx|ts|css|html|json|md|mjs))`/g;
/** Nach „unverändert (“ steht sofort die Datei. */
const UNVERAENDERT = /^unverändert \(`[A-Za-z0-9_./-]+\.(?:tsx|ts|css|html|json|md|mjs)`/;
/** Nur die Entscheidungen E1–E18 dieses Plans sind erlaubte Verweise. */
const VERWEIS = /\bE(?:[1-9]|1[0-8])\b/;
const FREMD = /\b(?:E(?:0|19|[2-9]\d)|E\d{3,}|OF\d+)\b/;

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
    const nr = /^\| (\d+) \|/.exec(z);
    if (nr && abschnitt >= 1 && abschnitt <= 7) {
      liste.push({ abschnitt, nr: Number(nr[1]), zellen: z.split(/(?<!\\)\|/).slice(1, -1).map((s) => s.trim()) });
    }
  }
  return liste;
}

/** Pfadregel der Liste: Repo-Wurzel, apps/battle/src (main, preload, shared, renderer), test/ im Paket oder der Renderer. */
function aufgeloest(pfad: string): string {
  if (/^(?:apps|packages|docs)\//.test(pfad)) return `../../${pfad}`;
  if (/^test\//.test(pfad)) return pfad;
  if (/^(?:main|preload|shared|renderer)\//.test(pfad)) return `src/${pfad}`;
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
  if (FREMD.test(ohneCode)) return 'Verweis außerhalb von E1–E18';
  let form: string | undefined;
  if (rest.startsWith('unverändert')) form = UNVERAENDERT.test(rest) ? 'unverändert' : undefined;
  else if (rest.startsWith('entfällt (')) form = 'entfällt';
  else if (rest.startsWith('ersetzt durch ')) form = ortAm(rest.slice('ersetzt durch '.length)) && 'ersetzt durch';
  else form = ortAm(rest);
  if (form === undefined) return rest.startsWith('unverändert') ? '„unverändert“ ohne Datei in der Klammer' : `Ort nicht aus dem Ortsregister: ${rest.slice(0, 40)}`;
  if (form === 'ersetzt durch' && !VERWEIS.test(ohneCode)) return '„ersetzt durch“ ohne E-Verweis';
  if (form === 'entfällt' && !VERWEIS.test(ohneCode)) return '„entfällt“ ohne E-Verweis';
  const pfade = [...k.matchAll(PFAD)].map((m) => m[1]);
  if (form !== 'entfällt' && pfade.length === 0) return 'Ort ohne Datei';
  const fehlt = pfade.filter((p) => !gibtEs(p));
  if (fehlt.length > 0) return `Datei fehlt: ${fehlt.join(', ')}`;
  // R13/R18: „unverändert“ nennt nur Dateien, die es seit der Erhebung nicht verändert hat; die vier Dateien mit der lesenden
  // Fernsteuerungs-Meldung (E2) und nur sie dürfen es mit diesem Hinweis.
  if (form === 'unverändert') {
    const veraendert = pfade.filter((p) => GEAENDERT_KANON.has(kanon(p)) || GIT?.has(kanon(p)) === true);
    if (veraendert.length > 0 && !/\bE2\b/.test(ohneCode)) return `unverändert mit geänderter Datei (${veraendert.join(', ')}) ohne Hinweis auf E2`;
    if (veraendert.some((p) => !NUR_MELDUNG.has(kanon(p)))) {
      return `unverändert mit einer Datei, die mehr als die Fernsteuerungs-Meldung bekam (${veraendert.join(', ')})`;
    }
  }
  return null;
}

const alle = zeilen(leseText(LISTE));

gleich(alle.length, GESAMT, 'BA Funktionsliste: 92 Zeilen in den Abschnitten 1–7 (Stand Task 23)');
gleich(
  JE_ABSCHNITT.map((_, i) => alle.filter((z) => z.abschnitt === i + 1).length),
  JE_ABSCHNITT,
  'BA Funktionsliste: Zeilen je Abschnitt wie in Task 23 (36/18/22/0/4/6/6)',
);
gleich(
  alle.map((z) => z.nr),
  alle.map((_, i) => i + 1),
  'BA Funktionsliste: Nummern fortlaufend ab 1',
);

for (const z of alle) {
  const f = zeilenFehler(z);
  ok(f === null, `BA Funktionsliste Nr. ${z.nr} abgehakt${f === null ? '' : ` – ${f}`}`);
}

const zeile = (nr: number): Zeile | undefined => alle.find((z) => z.nr === nr);
const kuenftig = (nr: number): string => zeile(nr)?.zellen[6] ?? '';
const quelle = (pfad: string): string => (gibtEs(pfad) ? readFileSync(aufgeloest(pfad), 'utf8') : '');

/** Alle .ts und .tsx unter src/renderer/src, mit Pfad (für Prüfungen über den ganzen Renderer). */
function rendererDateien(ordner = 'src/renderer/src'): string[] {
  return readdirSync(ordner).flatMap((n) => {
    const p = `${ordner}/${n}`;
    return statSync(p).isDirectory() ? rendererDateien(p) : /\.tsx?$/.test(n) ? [p] : [];
  });
}
const renderer = rendererDateien();
const rendererQuelle = renderer.map((d) => ohneKommentare(readFileSync(d, 'utf8'))).join('\n');

// ── Die Menge der geänderten Dateien stimmt mit git überein, wenn der Klon den Verlauf hat (sonst keine Aussage) ──
{
  if (GIT !== null) {
    const fehlend = [...GIT].filter((n) => n.startsWith('apps/battle/') && !GEAENDERT_KANON.has(n) && n !== 'apps/battle/test/ui/funktionsliste.test.ts');
    ok(fehlend.length === 0, `BA Funktionsliste: GEAENDERT nennt alle seit ${ERHEBUNG} geänderten Dateien von apps/battle (fehlt: ${fehlend.join(', ') || 'nichts'})`);
    const pakete = [...GIT].filter((n) => !n.startsWith('apps/') && !n.startsWith('docs/') && !n.startsWith('.superpowers/'));
    const zitiert = alle.filter((z) => UNVERAENDERT.test(z.zellen[6].slice(2))).flatMap((z) => [...z.zellen[6].matchAll(PFAD)].map((m) => kanon(m[1])));
    const getroffen = zitiert.filter((n) => !n.startsWith('apps/battle/') && pakete.includes(n));
    ok(getroffen.length === 0 || getroffen.every((n) => PAKETE_GEAENDERT.includes(n)), `BA Funktionsliste: keine in einem unverändert-Haken zitierte Datei außerhalb von apps/battle wurde geändert (${getroffen.join(', ') || 'keine'})`);
    // R18: die vier Main-/Preload-Dateien bekamen nur Zeilen für die lesende Fernsteuerungs-Meldung und die Master-Link-Brücke dazu.
    const index = gitZeilen('src/main/index.ts');
    const server = gitZeilen('src/main/control-server.ts');
    const preload = gitZeilen('src/preload/index.ts');
    const typen = gitZeilen('src/shared/types.ts');
    ok(
      index !== null &&
        server !== null &&
        preload !== null &&
        typen !== null &&
        index.weg.length === 1 &&
        /void startControlServer\(\{ getState: buildSuiteState, onCommand: handleSuiteCommand \}\);/.test(index.weg[0]) &&
        server.weg.length === 0 &&
        preload.weg.length === 0 &&
        typen.weg.length === 0,
      'BA Funktionsliste R18: main/index.ts verlor nur den alten Aufruf von startControlServer, control-server.ts, preload/index.ts und shared/types.ts verloren keine Zeile',
    );
    ok(
      index !== null && index.neu.every((l) => /ernsteuerung|Meldung|startControlServer|getAllWindows|void [(]async|getLog\(\)\.warn|r\.ok|r\.error|catch|try \{|\}\)\(\);|^\+\s*$|^\+\s*(?:\}|\/\/|\/\*\*|\*)/.test(l)),
      'BA Funktionsliste R18: die neuen Zeilen in main/index.ts betreffen nur die Fernsteuerungs-Meldung und den Startblock',
    );
  }
  ok(!GEAENDERT.some((d) => ['main/clip.ts', 'main/config.ts', 'main/coupling.ts', 'main/remote-page.ts', 'shared/scoring.ts', 'store/useBattle.ts', 'lib/capabilities.ts', 'lib/qr.ts', 'main.tsx'].includes(d)), 'BA Funktionsliste: die als unverändert geführten Dateien stehen nicht in GEAENDERT');
  // Negativprobe: andere Schreibweisen derselben geänderten Datei werden erkannt.
  const synth = (pfad: string): Zeile => ({ abschnitt: 3, nr: 0, zellen: ['0', '', '', '', '', '', `✓ unverändert (\`${pfad}\`): x`] });
  ok(
    ['App.tsx', 'renderer/src/App.tsx', 'apps/battle/src/renderer/src/App.tsx'].every((p) => (zeilenFehler(synth(p)) ?? '').includes('geänderter Datei')) &&
      zeilenFehler(synth('apps/battle/src/main/clip.ts')) === null &&
      zeilenFehler(synth('apps/battle/src/main/index.ts')) !== null &&
      (zeilenFehler(synth('apps/battle/src/main/index.ts')) ?? '').includes('E2'),
    'BA Funktionsliste: eine geänderte Datei wird in jeder Schreibweise (kurz, renderer/src/…, apps/battle/…) erkannt, eine unveränderte nicht',
  );
}

// ── Gelöschte Dateien: Settings.tsx und ConnectionsPanel.tsx gibt es nicht mehr, kein Haken nennt sie ──
ok(
  !gibtEs('components/Settings.tsx') && !gibtEs('components/ConnectionsPanel.tsx') && alle.every((z) => !/components\/(?:Settings|ConnectionsPanel)\.tsx/.test(z.zellen[6])),
  'BA Funktionsliste: Settings.tsx und ConnectionsPanel.tsx sind gelöscht und kein Haken nennt sie als neuen Ort',
);

// ── Jeder Verweis „Befund n“ in den Haken zeigt auf einen vorhandenen Befund (die neuen sind 31 bis 39) ──
{
  const text = leseText(LISTE);
  const befunde = [...text.matchAll(/^(\d+)\. \*\*/gm)].map((m) => Number(m[1]));
  gleich(befunde, befunde.map((_, i) => i + 1), 'BA Funktionsliste: Befunde fortlaufend nummeriert');
  const nenner = alle.flatMap((z) => [...z.zellen[6].matchAll(/Befund (\d+)/g)].map((m) => Number(m[1])));
  ok(nenner.every((n) => befunde.includes(n)) && befunde.length === 39, `BA Funktionsliste: die Befunde der Haken gibt es (39 Befunde, Verweise ${[...new Set(nenner)].sort((a, b) => a - b).join(',')})`);
  ok(/Befunden 31 ff./.test(text) && !text.includes('0 Commits auf'), 'BA Funktionsliste: der Kopf nennt die Befunde ab 31 und sagt nicht mehr, die App sei unverändert');
}

// ── Pflichtzeilen Tastatur (Nr. 81–86) ──
{
  const t = hauptTasten({ state: battleState() });
  ok(
    [t.vs, t.voting, t.naechste, t.replay].every((x) => !('shortcut' in x)) &&
      liveTasten({ state: battleState() }, { setLive() {}, setVotingOpen() {}, nextRound() {}, clip() {} }).every((x) => !('shortcut' in x)) &&
      !/\b(?:keydown|keyup|keypress|onKey\w*|addEventListener|accelerator|globalShortcut)\b/.test(rendererQuelle) &&
      kuenftig(81).startsWith('✓ Haupttasten') &&
      /\bE1\b/.test(kuenftig(81)),
    'BA Funktionsliste Nr. 81: weiter keine Kürzel; die Haupttasten tragen keines und im Renderer steht kein keydown, keyup, onKey und addEventListener (E1)',
  );
  const main = quelle('main/index.ts');
  ok(
    !/setApplicationMenu|globalShortcut|new Tray|before-input-event/.test(main) && main.includes('autoHideMenuBar: true') && /\bE2\b/.test(kuenftig(81)),
    'BA Funktionsliste Nr. 81 (Menü): der Hauptprozess bleibt ohne eigenes Menü, globales Kürzel, Tray und before-input-event, autoHideMenuBar bleibt',
  );
  ok(
    kuenftig(82).startsWith('✓ Haupttasten') &&
      kuenftig(82).includes('Pfeil hoch und runter ändern den Wert nicht mehr') &&
      kuenftig(82).includes('R21') &&
      quelle('packages/ui/src/components/TallyButton.tsx').includes('onClick'),
    'BA Funktionsliste Nr. 82: Leertaste und Enter lösen den fokussierten Knopf aus; die Zahlfelder übernehmen bei Enter, Pfeil hoch und runter ändern den Wert nicht mehr (R21, benannt)',
  );
  ok(
    kuenftig(83).startsWith('✓ ersetzt durch Panel (') && /\bE16\b/.test(kuenftig(83)) && quelle('packages/ui/src/components/SettingsPanel.tsx').includes('Escape'),
    'BA Funktionsliste Nr. 83: die Modals sind das Panel, Escape schließt es (E16)',
  );
  ok(kuenftig(84).startsWith('✓ Panel Zurücksetzen (`views/Einstellungen.tsx`)') && quelle('views/Einstellungen.tsx').includes('confirm('), 'BA Funktionsliste Nr. 84: der native confirm steht im Abschnitt Zurücksetzen');
  ok(
    kuenftig(86).startsWith('✓ Live-Bereich Ecken') && (quelle('components/Competitors.tsx').match(/onChange=\{\(e\) => aktionen\.setCompetitor\(side, \{ (?:name|crew): e\.target\.value \}\)\}/g) ?? []).length === 2,
    'BA Funktionsliste Nr. 86: Namens- und Crew-Feld schreiben je Tastendruck, ohne Handler für Enter',
  );
}

// ── Pflichtpunkt Panel (Nr. 85, O1): Feld behält Tasten, Leertaste auf Knopf/Schalter geht ans Tool, Escape schließt ──
ok(
  zeile(85)?.zellen[1] === 'Pflichtpunkt Panel-Tasten' &&
    kuenftig(85).startsWith('✓ Panel (') &&
    ['Leertaste', 'Escape', 'Feld', 'Schalter', 'O1', 'ohne Wirkung'].every((w) => kuenftig(85).includes(w)),
  'BA Funktionsliste Nr. 85 (Pflichtpunkt Panel): Leertaste und Escape, je für Feld und Knopf/Schalter; in Battle bleibt die Leertaste ohne Wirkung, weil es kein Tool-Kürzel gibt (Spec 10, O1)',
);
{
  const panel = quelle('packages/ui/src/components/SettingsPanel.tsx');
  ok(
    panel.includes('Escape') && panel.includes('defaultPrevented') && /verbrauchtTasten/.test(panel),
    'BA Funktionsliste Nr. 83/85: SettingsPanel schließt mit Escape, nur wenn nicht defaultPrevented; Felder behalten ihre Tasten',
  );
}

// ── Abläufe aus Abschnitt 3: Renderer-Abläufe in den immer gemounteten Teilen, nicht im Panel; Main-Abläufe im Main ──
{
  const app = quelle('App.tsx');
  const store = quelle('store/useBattle.ts');
  const panel = ohneKommentare(quelle('views/Einstellungen.tsx'));
  const oberflaeche = quelle('views/BattleOberflaeche.tsx');
  ok(
    app.includes('void load()') && app.includes('Lädt …') && store.includes('window.jmbattle.onState') && store.includes('window.jmbattle.onLinks') && store.includes('subscribed') && !panel.includes('load('),
    'BA Funktionsliste Nr. 3/76: Laden und das einmalige Abonnement von onState und onLinks laufen in App und Store, nicht im Panel',
  );
  ok(
    ['window', 'useEffect', 'addEventListener', 'setInterval', 'setTimeout', 'localStorage', 'useBattle'].every((w) => !panel.includes(w)),
    'BA Funktionsliste: Einstellungen.tsx hat kein window, keinen Effekt und keinen Store (G7, G8)',
  );
  ok(
    oberflaeche.includes('useBrueckenWert(MASTER_LINK_QUELLE)') &&
      oberflaeche.includes('useBrueckenWert(FERNSTEUERUNG_QUELLE)') &&
      !panel.includes('useBrueckenWert') &&
      [63, 75].every((nr) => kuenftig(nr).startsWith('✓ Statusleiste')),
    'BA Funktionsliste Nr. 63/75: die Brücken werden in der Oberfläche gelesen, nicht im Panel; Fernsteuerung und Master-Link stehen in der Statusleiste',
  );
  // Abläufe im Hauptprozess: die genannten Funktionen und Befehle stehen im Main.
  const main = quelle('main/index.ts');
  ok(
    ['next', 'prev', 'win', 'voting', 'vs', 'replay', 'reset'].every((v) => main.includes(`case '${v}'`)) &&
      ['doGotoRound', 'doSetJuryWinner', 'doSetVotingOpen', 'doSetLive', 'doClip', 'doReset', 'handleVote', 'applyVs', 'clearVs', 'applyShowFromDeepLink', 'requestSingleInstanceLock', 'second-instance', 'before-quit', 'window-all-closed', 'setWindowOpenHandler', 'resolveMode'].every((w) => main.includes(w)) &&
      [2, 51, 52, 55, 56, 57, 58, 59, 60, 61, 62, 64, 65, 66, 67, 68, 70, 71, 72, 73, 74, 77, 81, 90].every((nr) => kuenftig(nr).startsWith('✓ unverändert (') || nr === 81) &&
      [2, 51, 52, 55, 56, 57, 58, 59, 60, 61, 62, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 77, 90, 91].every((nr) => /\bE2\b/.test(kuenftig(nr))),
    'BA Funktionsliste Nr. 2/51/52/55–62/64–74/77/90/91: Fernsteuerung, Stimmen, Kopplung, Clip, Show und Fenster leben weiter im Hauptprozess (E2: nur die Meldung kam dazu)',
  );
  ok(
    ['main/clip.ts', 'main/config.ts', 'main/coupling.ts', 'main/remote-page.ts', 'shared/scoring.ts', 'store/useBattle.ts'].every((d) => gibtEs(d)) &&
      [3, 76, 89].every((nr) => kuenftig(nr).startsWith('✓ unverändert (') && !/\bE2\b/.test(kuenftig(nr))) &&
      [78, 79, 80, 92].every((nr) => kuenftig(nr).startsWith('✓ Voting-Webseite (`main/remote-page.ts`)')),
    'BA Funktionsliste Nr. 3/76/78–80/89/92: Store, Konfiguration und Voting-Seite liegen in ihren unveränderten Dateien',
  );
  // Der Master-Link-Client im Main bleibt an: initAppRuntime ohne masterLink: false (Nr. 75).
  ok(/initAppRuntime\(\{ csp: true,/.test(main) && !/masterLink:\s*false/.test(main), 'BA Funktionsliste Nr. 75: initAppRuntime läuft weiter ohne masterLink: false');
  ok(
    main.includes('meldeFernsteuerung') && main.includes("'battle:fernsteuerung'") && quelle('main/control-server.ts').includes('onMeldung') && quelle('preload/index.ts').includes('onMasterLink') && quelle('preload/index.ts').includes('onFernsteuerung'),
    'BA Funktionsliste Nr. 63/75: Meldekanal battle:fernsteuerung, Rückruf onMeldung und die beiden Preload-Brücken sind das, was die Main-Dateien dazubekamen',
  );
}

// ── Haupttasten (Nr. 6, 16, 28, 34) ──
{
  const T = BATTLE_TEXTE;
  const serverAus = battleState();
  const serverAn = battleState({ remote: { running: true, urls: ['http://10.0.0.5:7783'] } });
  const nichtErlaubt = mitConfig({ votingEnabled: false }, { remote: { running: true, urls: ['http://10.0.0.5:7783'] } });
  const ohneQuelle = battleState();
  const mitQuelle = mitConfig({ recordingPath: 'C:/Rec/show.mp4' });
  const schneidet = mitConfig({ recordingPath: 'C:/Rec/show.mp4' }, { clips: [clipJob('running')] });
  gleich(tastenSchluessel({ state: serverAus }), ['vs', 'voting', 'naechste', 'replay'], 'BA Funktionsliste Nr. 6/16/28/34: vier Haupttasten in der Reihenfolge VS, Voting, Nächste Runde, Replay');
  const getrennt = mitConfig({ autoTitler: true }, { live: false, links: [toolLink({ connected: false })] });
  ok(
    hauptTasten({ state: serverAus }).vs.state === 'bereit' &&
      hauptTasten({ state: battleState({ live: true }) }).vs.state === 'live' &&
      hauptTasten({ state: getrennt }).vs.state === 'bereit' &&
      hauptTasten({ state: getrennt }).vs.disabledReason === undefined &&
      tastenBeschriftung({ state: serverAus }).vs === '○ VS einblenden' &&
      tastenBeschriftung({ state: battleState({ live: true }) }).vs === '● VS on air' &&
      onAirKopf({ state: battleState({ live: true }) }).live &&
      !onAirKopf({ state: serverAus }).live &&
      vsHinweis({ state: getrennt }) === T.vsHinweis &&
      kuenftig(6).includes('Befund 31') &&
      kuenftig(6).includes('E8'),
    'BA Funktionsliste Nr. 6: VS nie gesperrt (auch mit getrenntem Titler), live bei state.live, Wörter wörtlich, On-Air im Kopf; der entfallene Tooltip ist als Befund 31 benannt',
  );
  ok(
    hauptTasten({ state: serverAus }).naechste.state === 'bereit' &&
      hauptTasten({ state: battleState({ round: 3 }) }).naechste.state === 'bereit' &&
      tastenBeschriftung({ state: serverAus }).naechste === 'Nächste Runde ▶' &&
      kuenftig(16).startsWith('✓ ersetzt durch Haupttasten') &&
      !/▶/.test(quelle('components/Scoreboard.tsx').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')),
    'BA Funktionsliste Nr. 16: „Nächste Runde ▶“ ist Haupttaste und nie gesperrt, das ▶ ist aus dem Scoreboard weg',
  );
  ok(
    hauptTasten({ state: serverAus }).voting.state === 'gesperrt' &&
      hauptTasten({ state: serverAus }).voting.disabledReason === T.voting.serverAus &&
      hauptTasten({ state: nichtErlaubt }).voting.disabledReason === T.voting.abgeschaltet &&
      hauptTasten({ state: serverAn }).voting.state === 'bereit' &&
      hauptTasten({ state: serverAn }).voting.label === 'Voting öffnen (Runde 2)' &&
      hauptTasten({ state: { ...serverAn, votingOpen: true } }).voting.label === 'Voting offen (Runde 2) — schließen' &&
      kuenftig(28).startsWith('✓ ersetzt durch Haupttasten') &&
      kuenftig(28).includes('Befund 32') &&
      kuenftig(28).includes(T.voting.serverAus) &&
      kuenftig(28).includes(T.voting.abgeschaltet),
    'BA Funktionsliste Nr. 28: die Voting-Taste ist ohne Server sichtbar und gesperrt mit Grund (vorher fehlte sie), bei nicht erlaubtem Voting gesperrt; die Wörter sind wörtlich',
  );
  ok(
    hauptTasten({ state: ohneQuelle }).replay.disabledReason === T.replay.keineQuelle &&
      hauptTasten({ state: mitQuelle }).replay.state === 'bereit' &&
      hauptTasten({ state: schneidet }).replay.disabledReason === T.replay.laeuft &&
      tastenBeschriftung({ state: mitQuelle }).replay === '⧉ Clip (letzte 20s)' &&
      tastenBeschriftung({ state: schneidet }).replay === 'schneidet …' &&
      kuenftig(34).startsWith('✓ ersetzt durch Haupttasten') &&
      kuenftig(34).includes(T.replay.keineQuelle) &&
      kuenftig(34).includes(T.replay.laeuft),
    'BA Funktionsliste Nr. 34: Replay ist ohne Quelle und während eines Auftrags gesperrt, mit sichtbarem Grund; „⧉ Clip (letzte Ns)“ und „schneidet …“ wörtlich',
  );
  // Handler: je Taste der Handler des Stores wie bisher.
  const log: string[] = [];
  const a: TastenAktionen = {
    setLive: (an) => void log.push(`setLive(${an})`),
    setVotingOpen: (offen) => void log.push(`setVotingOpen(${offen})`),
    nextRound: () => void log.push('nextRound'),
    clip: () => void log.push('clip'),
  };
  for (const taste of liveTasten({ state: serverAn }, a)) taste.onClick?.();
  gleich(log, ['setLive(true)', 'setVotingOpen(true)', 'nextRound', 'clip'], 'BA Funktionsliste Nr. 6/16/28/34: die vier Tasten lösen setLive(!live), setVotingOpen(!votingOpen), nextRound() und clip() aus');
  const live = quelle('views/LiveBereich.tsx');
  ok(live.includes('<TallyButton') && live.includes('a.setLive(!s.state.live)') && live.includes('a.setVotingOpen(!s.state.votingOpen)'), 'BA Funktionsliste Nr. 6/28: die Haupttasten sind TallyButtons mit den bisherigen Handlern');
}

// ── Kopf und Kopfmitte (Nr. 4–9) ──
{
  ok(
    BATTLE_TEXTE.runde(2, 3) === 'Runde 2/3' &&
      quelle('views/BattleOberflaeche.tsx').includes('BATTLE_TEXTE.runde(state.round, state.rounds.length)') &&
      kuenftig(5).startsWith('✓ Kopf') &&
      kuenftig(4).includes('R12') &&
      kuenftig(4).startsWith('✓ Kopf'),
    'BA Funktionsliste Nr. 4/5: „JM Battle“ kommt aus dem Kopf, „Runde x/y“ steht in der Kopfmitte, Battle hatte keine Markenzeile (R12)',
  );
  ok(
    kuenftig(7).startsWith('✓ ersetzt durch Kopf') &&
      kuenftig(8).startsWith('✓ ersetzt durch Kopf') &&
      quelle('packages/ui/src/components/AppHeader.tsx').includes('data-zahnrad') &&
      quelle('packages/ui/src/components/AppHeader.tsx').includes('ThemeToggle') &&
      quelle('packages/ui/src/components/AppHeader.tsx').includes('dragRegion') &&
      /\bE17\b/.test(kuenftig(9)) &&
      kuenftig(9).includes('Hilfe gibt es weiterhin nicht'),
    'BA Funktionsliste Nr. 7–9: „Verbindungen“ und „Einstellungen“ sind ersetzt durch ⚙ im Kopf; Logo, Theme-Knopf, Ziehfläche und Statusleiste gibt es jetzt, eine Hilfe weiterhin nicht (E17)',
  );
}

// ── Statusleiste: Master-Link, Titler, Fernsteuerung, Voting, Aufnahme-Quelle (Nr. 36, 63, 75) ──
{
  const stand = (state = battleState(), teil: Partial<OberflaechenStand> = {}): OberflaechenStand => ({ state, masterLink: undefined, fernsteuerung: undefined, ...teil });
  const eintrag = (s: OberflaechenStand, id: string) => statusLeiste(s).find((i) => i.id === id);
  gleich(
    statusLeiste(stand()).map((i) => i.id),
    ['master-link', 'titler', 'fernsteuerung', 'voting', 'aufnahme-quelle'],
    'BA Funktionsliste Nr. 36/63/75: die Statusleiste hat master-link, titler, fernsteuerung, voting und aufnahme-quelle',
  );
  const aus = mitConfig({ autoTitler: false });
  const gesucht = battleState();
  const verbunden = battleState({ links: [toolLink()] });
  ok(
    eintrag(stand(aus), 'titler')?.state === 'off' &&
      eintrag(stand(gesucht), 'titler')?.state === 'warn' &&
      eintrag(stand(verbunden), 'titler')?.state === 'ok' &&
      eintrag(stand(verbunden), 'titler')?.detail?.includes('10.0.0.7') === true &&
      kuenftig(36).startsWith('✓ ersetzt durch Statusleiste') &&
      /\bE16\b/.test(kuenftig(36)) &&
      kuenftig(36).includes('autoTitler') &&
      kuenftig(36).includes('VS-Bauchbinde mit den Namen läuft über den Titler.') &&
      kuenftig(36).includes(BATTLE_TEXTE.gegenstellen.erklaerung),
    'BA Funktionsliste Nr. 36: die Titler-Karte ist ersetzt durch den dreifarbigen Eintrag (aus = off, nicht verbunden = warn, verbunden = ok mit Adresse), nie grün ohne Gegenstelle; der entfallene Satz ist benannt (E16)',
  );
  ok(
    eintrag(stand(), 'fernsteuerung')?.state === 'off' &&
      eintrag(stand(battleState(), { fernsteuerung: { laeuft: true, port: 8734, clients: 1, modus: 'open' } }), 'fernsteuerung')?.state === 'ok' &&
      quelle('shared/fernsteuerung.ts').includes('8734') &&
      kuenftig(63).includes('Port 8734') &&
      kuenftig(63).includes('main/control-server.ts'),
    'BA Funktionsliste Nr. 63: das Start-Ergebnis des Steuerservers steht als Eintrag fernsteuerung in der Statusleiste, bis zur ersten Meldung unbekannt (off)',
  );
  ok(
    eintrag(stand(), 'voting')?.state === 'off' &&
      eintrag(stand(battleState({ remote: { running: true, urls: ['http://10.0.0.5:7783'] } })), 'voting')?.state === 'ok' &&
      eintrag(stand(mitConfig({ recordingPath: '' })), 'aufnahme-quelle')?.state === 'warn' &&
      eintrag(stand(mitConfig({ recordingPath: 'C:/Rec/show.mp4' })), 'aufnahme-quelle')?.state === 'ok' &&
      kuenftig(31).includes('Aufnahme-Quelle'),
    'BA Funktionsliste Nr. 25/28/31: die Einträge voting und aufnahme-quelle bilden Server und Quelle ab',
  );
  ok(eintrag(stand(), 'master-link')?.state === 'off' && eintrag(stand(), 'master-link')?.detail !== undefined, 'BA Funktionsliste Nr. 75: der Eintrag master-link ist bis zur ersten Meldung „unbekannt“ (off), nie ok');
  // Kein Toast, kein alert, kein prompt im Renderer (Nr. 54); genau ein confirm im Panel-Abschnitt Zurücksetzen (Nr. 42).
  const treffer = renderer.flatMap((d) => (ohneKommentare(readFileSync(d, 'utf8')).match(/\b(?:window\.)?(?:alert|prompt|confirm)\(/g) ?? []).map((m) => `${d}:${m}`));
  gleich(treffer, ['src/renderer/src/views/Einstellungen.tsx:confirm('], 'BA Funktionsliste Nr. 42/54: genau ein confirm im Renderer (Battle zurücksetzen), kein alert, kein prompt');
}

// ── Zurücksetzen (Nr. 41, 42): Rückfrage mit der Nebenwirkung, das Panel bleibt offen ──
{
  const e = quelle('views/Einstellungen.tsx');
  ok(
    BATTLE_TEXTE.zuruecksetzen.frage === 'Battle zurücksetzen? Runden/Stimmen werden geleert (Namen bleiben). Ein laufendes VS geht aus.' &&
      BATTLE_TEXTE.zuruecksetzen.knopf === 'Battle zurücksetzen' &&
      e.includes('if (confirm(BATTLE_TEXTE.zuruecksetzen.frage)) aktionen.reset();') &&
      !e.includes('onClose') &&
      kuenftig(41).startsWith('✓ Panel Zurücksetzen') &&
      kuenftig(41).includes('Befund 37') &&
      kuenftig(42).includes(BATTLE_TEXTE.zuruecksetzen.frage),
    'BA Funktionsliste Nr. 41/42: die Rückfrage nennt „Ein laufendes VS geht aus.“, nach dem Zurücksetzen bleibt das Panel offen (kein onClose)',
  );
}

// ── Gegenstellen (Nr. 44–49): Host-Feld nicht mehr vorbelegt, Setzen mit Grund, Auto ──
{
  const aufrufe: string[] = [];
  const a = { setEndpoint: (role: string, host: string, port: number) => void aufrufe.push(`${role}|${host}|${port}`) };
  const gefunden = battleState({ links: [toolLink({ connected: true, source: 'mdns' })] });
  const manuell = battleState({ links: [toolLink({ connected: false, source: 'manual', host: 'rec.lan', port: 9000 })], overrides: { titler: { host: 'rec.lan', port: 9000 } } });
  const zeileTitler = (s: ReturnType<typeof battleState>) => gegenstellenAbschnitt({ state: s }, a).peers.find((p) => p.role === 'titler');
  ok(
    zeileTitler(gefunden)?.host === '' &&
      zeileTitler(gefunden)?.port === 8735 &&
      zeileTitler(manuell)?.host === 'rec.lan' &&
      gefundeneAdressen({ state: gefunden }).some((g) => g.text === `${BATTLE_TEXTE.gegenstellen.gefunden} 10.0.0.7:8735`) &&
      kuenftig(46).includes('nicht mehr') &&
      kuenftig(46).includes('Verlust an Bequemlichkeit') &&
      kuenftig(47).includes('Port-Feld'),
    'BA Funktionsliste Nr. 46/47: das Host-Feld ist nur bei einem manuellen Endpunkt vorbelegt, ein Fund steht als „gefunden: host:port“ (Verlust gegenüber heute, benannt); der Port bleibt vorbelegt',
  );
  const p = gegenstellenAbschnitt({ state: gefunden }, a);
  const peer = p.peers[0];
  ok(
    peerSetzen(p, peer, ' 10.0.0.9 ', 8735) &&
      !peerSetzen(p, peer, 'x', null) &&
      !peerSetzen(p, peer, 'x', 9, false) &&
      peerSetzenGrund(false, null, true) === PEERS_TEXTE.setzenOhnePort &&
      aufrufe.join(';') === 'titler|10.0.0.9|8735' &&
      kuenftig(48).includes(PEERS_TEXTE.setzenOhnePort),
    'BA Funktionsliste Nr. 48: „Setzen“ schickt Host (getrimmt) und Port; ohne gültigen Port gesperrt mit Grund, statt den Override zu entfernen',
  );
  p.onAuto?.('titler');
  ok(aufrufe.at(-1) === 'titler||0' && kuenftig(49).includes('aria-label „Auto: JM Titler“') && PEERS_TEXTE.autoFuer('JM Titler') === 'Auto: JM Titler', 'BA Funktionsliste Nr. 49: „Auto“ entfernt den Override (setEndpoint mit leerem Host), der Tooltip ist durch Erklärtext und aria-label ersetzt (R8)');
  ok(
    kuenftig(44).includes('PEERS_TEXTE.erklaerung') &&
      kuenftig(44).includes('R9') &&
      kuenftig(44).includes(BATTLE_TEXTE.gegenstellen.erklaerung) &&
      kuenftig(44).includes(PEERS_TEXTE.erklaerung) &&
      gegenstellenAbschnitt({ state: gefunden }, a).peers.map((x) => x.role).join(',') === 'titler' &&
      kuenftig(44).startsWith('✓ ersetzt durch Panel Gegenstellen'),
    'BA Funktionsliste Nr. 44: nur die Rolle titler; der Erklärtext ist geteilt (Satz 1 aus BATTLE_TEXTE, Rest aus PEERS_TEXTE, ohne ASCII-Anführungszeichen)',
  );
  ok(
    ['verbunden', 'gefunden · nicht verbunden', 'nicht gefunden'].every((w) => kuenftig(45).includes(w)) &&
      kuenftig(45).includes(`manuell: host:port · nicht verbunden`) &&
      PEERS_TEXTE.zeileManuellNichtVerbunden('h', 1) === 'manuell: h:1 · nicht verbunden' &&
      PEERS_TEXTE.zeileGefundenNichtVerbunden === 'gefunden · nicht verbunden' &&
      PEERS_TEXTE.zeileNichtGefunden === 'nicht gefunden',
    'BA Funktionsliste Nr. 45: die Zeilentexte der Gegenstellen stehen im Haken und stimmen mit PEERS_TEXTE überein (Wortlaut gegenüber RoleRow geändert, benannt)',
  );
}

// ── Panel-Abschnitte Battle, Instant-Replay: Texte wörtlich und Klemmwerte (Nr. 32, 33, 38–40) ──
{
  const e = quelle('views/Einstellungen.tsx');
  ok(
    ['Runden', 'Anzahl der Battle-Runden.', 'Publikums-Voting', 'Abstimmung per QR/Handy zulassen.', 'VS-Bauchbinde automatisch', 'JM Titler bei VS-Live mit den Namen ein-/ausblenden (text-Befehl vorwärtskompatibel).', 'Zielordner …'].every((t) => e.includes(t)) &&
      [38, 39, 40].every((nr) => kuenftig(nr).startsWith('✓ Panel Battle')) &&
      kuenftig(32).startsWith('✓ ersetzt durch Panel Instant-Replay') &&
      kuenftig(41).startsWith('✓ Panel Zurücksetzen'),
    'BA Funktionsliste Nr. 32/38–41: Beschriftungen und Hinweise der Felder stehen wörtlich im Panel',
  );
  const runden = /<NumberInput value=\{config\.rounds\}[^\n]*\/>/.exec(e)?.[0] ?? '';
  ok(
    runden !== '' &&
      !/\bmin=|\bmax=|ganzzahl/.test(runden) &&
      runden.includes('Math.max(1, Math.min(20, v))') &&
      kuenftig(38).includes('R21') &&
      kuenftig(38).includes('früher wurde 1 gespeichert') &&
      kuenftig(38).includes('Enter oder Verlassen'),
    'BA Funktionsliste Nr. 38: Runden ohne Grenzen im Feld, Klemmwert 1 bis 20 im Handler (R21); das leere Feld wird abgewiesen (benannt)',
  );
  const clip = quelle('components/ClipPanel.tsx');
  const laenge = /<NumberInput[\s\S]*?\/>/.exec(clip)?.[0] ?? '';
  ok(
    laenge !== '' &&
      !/\bmin=|\bmax=|ganzzahl/.test(laenge) &&
      laenge.includes('Math.max(3, v)') &&
      laenge.includes('Sekunden (letzte)') &&
      kuenftig(33).startsWith('✓ rechte Spalte Clip') &&
      kuenftig(33).includes('R21') &&
      kuenftig(33).includes('früher wurde 3 gespeichert') &&
      kuenftig(33).includes('Enter oder Verlassen'),
    'BA Funktionsliste Nr. 33: Länge ohne Grenzen im Feld, Klemmwert mindestens 3 im Handler (R21); das leere Feld wird abgewiesen (benannt)',
  );
  ok(
    clipZielText({ clipDir: '' }) === 'Standard (Videos/JM Battle Clips)' &&
      clipZielText({ clipDir: 'C:/Clips/Battle' }) === 'Battle' &&
      clipQuelleText({ recordingPath: '' }) === 'keine Quelle gewählt' &&
      clip.includes('Aufnahme …') &&
      !ohneKommentare(clip).includes('Zielordner') &&
      kuenftig(31).startsWith('✓ rechte Spalte Clip') &&
      kuenftig(32).includes(BATTLE_TEXTE.replay.zielLabel),
    'BA Funktionsliste Nr. 31/32: Aufnahme bleibt am Clip-Knopf, Zielordner steht im Panel; „keine Quelle gewählt“ und „Standard (Videos/JM Battle Clips)“ wörtlich',
  );
}

// ── Live-Bereich: Ecken, Scoreboard, Ergebnis, rechte Spalte (Nr. 10–15, 17–27, 29, 30, 35) ──
{
  const ecken = quelle('components/Competitors.tsx');
  ok(
    ecken.indexOf('function Ecke(') > -1 &&
      ecken.indexOf('function Ecke(') < ecken.indexOf('export function Competitors(') &&
      !/^\s+(?:const|function)\s+Card\b/m.test(ecken) &&
      ecken.includes('Ecken tauschen') &&
      ecken.includes('Crew / Stadt') &&
      ecken.includes('Rundensiege') &&
      quelle('lib/oberflaeche.ts').includes('var(--battle-ecke-a)') &&
      quelle('globals.css').includes('--battle-ecke-a') &&
      kuenftig(11).includes('Befund 34') &&
      kuenftig(10).includes('--battle-ecke-a'),
    'BA Funktionsliste Nr. 10–13: die Ecken-Karte steht auf Modulebene (Fokus bleibt), Texte wörtlich, Farben als Tokens; die Namensfelder schreiben weiter je Taste (Befund 34)',
  );
  const score = quelle('components/Scoreboard.tsx');
  ok(
    score.includes('aktionen.prevRound()') &&
      score.includes('aktionen.gotoRound(r.round)') &&
      score.includes('aktionen.setJuryWinner(state.round, active ? null : winner)') &&
      score.includes('aktionen.clearVotes(state.round)') &&
      !/confirm\(/.test(score) &&
      score.includes('aria-current') &&
      score.includes('border-2 border-[var(--tally-selected)]') &&
      score.includes('Jury — Runde') &&
      score.includes('Publikum — Runde') &&
      score.includes('Unentschieden') &&
      [14, 15, 17, 18, 19, 20, 21, 22].every((nr) => kuenftig(nr).startsWith('✓ Live-Bereich Scoreboard')) &&
      kuenftig(21).includes('ohne Rückfrage'),
    'BA Funktionsliste Nr. 14/15/17–22: ◀, Direktsprung, Jury-Knöpfe und „zurücksetzen“ bleiben im Scoreboard mit denselben Handlern, die Stimmen weiter ohne Rückfrage; aktuelle Runde mit --tally-selected',
  );
  const liveQuelle = ohneKommentare(quelle('views/LiveBereich.tsx'));
  ok(
    liveQuelle.includes('border-[var(--tally-selected)] bg-[var(--highlight)]') &&
      liveQuelle.includes('text-[var(--foreground)]') &&
      liveQuelle.includes('🏆') &&
      liveQuelle.includes('🤝 Unentschieden') &&
      liveQuelle.includes('decided(state.rounds)') &&
      !/brand-yellow/.test(rendererQuelle) &&
      kuenftig(23).startsWith('✓ Live-Bereich Ergebnis') &&
      kuenftig(23).includes('--foreground'),
    'BA Funktionsliste Nr. 23: die Ergebnis-Karte erscheint bei decided, Texte wörtlich, Rahmen --tally-selected und Schrift --foreground statt gelb',
  );
  const voting = quelle('components/RemotePanel.tsx');
  ok(
    voting.includes('Aus. Anschalten, damit das Publikum per Handy (QR) für die Runden abstimmt.') &&
      voting.includes('QR zum Voting') &&
      voting.includes('bg-white') &&
      voting.includes('aktionen.setRemote(!state.remote.running)') &&
      !voting.includes('setVotingOpen') &&
      voting.includes("'◉ An' : '○ Aus'") &&
      [24, 25, 26, 27, 29].every((nr) => kuenftig(nr).startsWith('✓ rechte Spalte Voting')) &&
      quelle('lib/qr.ts').includes('#000000') &&
      quelle('lib/qr.ts').includes('#ffffff'),
    'BA Funktionsliste Nr. 24–27/29: die Voting-Karte behält Schalter, Hinweis, QR (schwarz auf weiß) und Adressen; das Öffnen des Votings ist nicht mehr in der Karte',
  );
  const clip = quelle('components/ClipPanel.tsx');
  ok(
    clip.includes('aktionen.pickRecording()') && clip.includes('StatusPill') && !clip.includes('aktionen.clip') && [30, 31, 35].every((nr) => kuenftig(nr).startsWith('✓ rechte Spalte Clip')) && kuenftig(35).includes('StatusPill'),
    'BA Funktionsliste Nr. 30/31/35: die Clip-Karte behält Quelle, Länge und Liste (StatusPill statt Punkt); der Clip selbst ist die Haupttaste',
  );
  const live = quelle('views/LiveBereich.tsx');
  ok(
    ['<Competitors', '<HauptTasten', '<Scoreboard', '<Ergebnis', '<RemotePanel', '<ClipPanel'].every((w) => live.includes(w)) && !/Titler-Kopplung|JM Titler/.test(ohneKommentare(live).replace(/\/\/.*$/gm, '')),
    'BA Funktionsliste Nr. 1/36: der Live-Bereich trägt Ecken, Haupttasten, Scoreboard, Ergebnis, Voting und Clip; die Titler-Karte gibt es nicht mehr',
  );
}

// ── Theme und Gemerktes (Nr. 87, 88) ──
{
  ok(
    !/\b(?:localStorage|sessionStorage|persistId|indexedDB)\b/.test(rendererQuelle) &&
      quelle('packages/ui/src/lib/theme.ts').includes("'jm-theme'") &&
      [87, 88].every((nr) => /\bE17\b/.test(kuenftig(nr))) &&
      kuenftig(88).includes('jm-theme') &&
      quelle('main/index.ts').includes("backgroundColor: '#0e0e10'"),
    'BA Funktionsliste Nr. 87/88: der Renderer merkt sich selbst nichts, nur das Theme im geteilten Hook (E17); der Fensterhintergrund im Main bleibt',
  );
}

// ── Texte der Haken stimmen mit dem Code überein (die wörtlich zitierten Texte, Nr. 6, 36, 42, 44) ──
ok(
  [BATTLE_TEXTE.vs.an, BATTLE_TEXTE.vs.aus, BATTLE_TEXTE.vsHinweis, BATTLE_TEXTE.naechste].every((t) => t.length > 0) &&
    kuenftig(6).includes(BATTLE_TEXTE.vs.aus) &&
    kuenftig(6).includes(BATTLE_TEXTE.vs.an) &&
    kuenftig(16).includes(BATTLE_TEXTE.naechste.replace(' ▶', '')),
  'BA Funktionsliste Nr. 6/16: die zitierten Beschriftungen der Haupttasten stehen wörtlich im Haken',
);
