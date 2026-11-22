// ─────────────────────────────────────────────────────────────────────────────
// Funktionsliste nach dem Umbau (UX Welle 2a, Recorder e; Spec 10 „Kein Funktionsverlust“). Jede der 138 Zeilen in den
// Abschnitten 1–7 von docs/ux/funktionslisten/recorder.md ist in „künftig wo“ abgehakt: „✓ “ und ein Ort des Ortsregisters,
// „unverändert (…)“, „entfällt (…, E…)“ oder „ersetzt durch {Ort} (…, E…)“. E-Verweise nur auf E1–E16 dieses Plans. Jede
// genannte Datei existiert, Groß- und Kleinschreibung wie im Repo. Dazu Querprüfungen gegen den Code: die Änderungen der
// Aufgaben 19–21 (gemessener Zustand, Meldung bis „OK“, Toast oben, Tastenfolge, Sperre im Ruhezustand, NumberInput, Sperre bei
// offenem Eingang, Pegel vor Hinweisband, Kopf) stehen als Haken in den betroffenen Zeilen, und der Code trägt, was der Haken sagt.
// Läuft im Paketordner apps/recorder (npm run selftest -w @jm/recorder).
// „unverändert (…)“ darf keine Datei nennen, die seit der Erhebung (d7cdd79ce0) geändert wurde, außer sie bekam nur die lesenden
// Brücken (E2): dann steht der Hinweis im Haken. Der Abgleich der statischen Liste GEAENDERT mit git läuft nur mit
// JM_FUNKTIONSLISTE_GIT=1 (Arbeitsbaum gegen die Erhebung, damit auch eine noch nicht eingecheckte Datei zählt).
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
  'src/main/index.ts',
  'src/preload/index.ts',
  'src/renderer/src/App.tsx',
  'src/renderer/src/components/Topbar.tsx',
  'src/renderer/src/globals.css',
  'src/renderer/src/lib/aktionen.ts',
  'src/renderer/src/lib/bruecken.ts',
  'src/renderer/src/lib/oberflaeche.ts',
  'src/renderer/src/views/Einstellungen.tsx',
  'src/renderer/src/views/LiveBereich.tsx',
  'src/renderer/src/views/RecorderOberflaeche.tsx',
  'src/renderer/src/views/RecorderView.tsx',
  'src/shared/fernsteuerung.ts',
  'src/shared/types.ts',
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
].map((p) => `apps/recorder/${p}`);

/**
 * Dateien, die nur die lesenden Brücken bekamen: der Main (Fernsteuerungs-Meldung E2), der Preload und die Typen dazu. Verhalten
 * und Befehle blieben.
 */
const NUR_MELDUNG = new Set([
  'apps/recorder/src/main/index.ts',
  'apps/recorder/src/main/control-server.ts',
  'apps/recorder/src/preload/index.ts',
  'apps/recorder/src/shared/types.ts',
]);

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
  // „unverändert“ nennt nur Dateien, die seit der Erhebung unverändert sind; Dateien mit nur den lesenden Brücken (E2) mit Hinweis.
  if (form === 'unverändert') {
    const veraendert = pfade.filter((p) => GEAENDERT_KANON.has(kanon(p)) || GIT?.has(kanon(p)) === true);
    if (veraendert.length > 0 && !/\bE2\b/.test(ohneCode)) return `unverändert mit geänderter Datei (${veraendert.join(', ')}) ohne Hinweis auf E2`;
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
    const zitiert = alle.filter((z) => z.zellen[6].startsWith('✓ unverändert (')).flatMap((z) => [...z.zellen[6].matchAll(PFAD)].map((m) => kanon(m[1])));
    const getroffen = zitiert.filter((n) => GIT.has(n));
    ok(getroffen.every((n) => NUR_MELDUNG.has(n)), `RE Funktionsliste: keine in einem unverändert-Haken zitierte Datei bekam mehr als die lesenden Brücken (${getroffen.join(', ') || 'keine'})`);
    const pakete = ['packages/suite-control-protocol/src/capabilities.ts', 'packages/show/src/index.ts'];
    ok(pakete.every((p) => !GIT.has(p)), 'RE Funktionsliste: die zitierten Pakete (capabilities.ts, Freigabeliste der Show) sind seit der Erhebung unverändert');
  }
  // Negativprobe: andere Schreibweisen derselben geänderten Datei werden erkannt, eine unveränderte nicht.
  const synth = (pfad: string, zusatz = ''): Zeile => ({ abschnitt: 3, nr: 0, zellen: ['0', '', '', '', '', '', `✓ unverändert (\`${pfad}\`): x${zusatz}`] });
  ok(
    ['views/LiveBereich.tsx', 'renderer/src/views/LiveBereich.tsx', 'apps/recorder/src/renderer/src/views/LiveBereich.tsx'].every((p) => (zeilenFehler(synth(p)) ?? '').includes('geänderter Datei')) &&
      (zeilenFehler(synth('views/LiveBereich.tsx', ' (E2)')) ?? '').includes('mehr als die lesenden Brücken') &&
      zeilenFehler(synth('main/control-server.ts', ' (E2)')) === null &&
      zeilenFehler(synth('main/index.ts', ' (E2)')) === null &&
      zeilenFehler(synth('main/recorder.ts')) === null,
    'RE Funktionsliste: eine geänderte Datei wird in jeder Schreibweise erkannt; E2 entlastet nur Dateien mit den lesenden Brücken; eine unveränderte Datei ist frei',
  );
}

const zeile = (nr: number): Zeile | undefined => alle.find((z) => z.nr === nr);
const kuenftig = (nr: number): string => zeile(nr)?.zellen[6] ?? '';
const quelle = (pfad: string): string => (gibtEs(pfad) ? readFileSync(aufgeloest(pfad), 'utf8') : '');
const beginnt = (nr: number, ...orte: string[]): boolean => orte.some((o) => kuenftig(nr).startsWith(`✓ ${o}`));
const ersetzt = (nr: number, ort: string): boolean => kuenftig(nr).startsWith(`✓ ersetzt durch ${ort}`);
const nennt = (nr: number, ...woerter: string[]): boolean => woerter.every((w) => kuenftig(nr).includes(w));
const unveraendert = (nr: number): boolean => kuenftig(nr).startsWith('✓ unverändert (');
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
  unveraendert(2) && nennt(2, '`main/index.ts`', '`renderer/index.html`', 'E2') && quelle('renderer/index.html').includes('class="dark"'),
  'RE Funktionsliste Nr. 2: die Fensterhülle bleibt (main/index.ts bekam nur die lesende Fernsteuerungs-Meldung, E2), index.html behält class="dark"',
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
  beginnt(15, 'Live-Bereich Hinweisband') && live.includes('title="Hinweis schließen"') && live.includes('aktionen.hinweiseSchliessen') && nennt(15, 'hinweiseSchliessen'),
  'RE Funktionsliste Nr. 15: das „×“ des Hinweisbands löscht beide Hinweise wie bisher',
);
ok(
  beginnt(44, 'Live-Bereich Hinweisband') && nennt(44, '--status-warn', 'amber') && !/amber-/.test(live) && live.includes("HINWEIS = 'border border-[var(--status-warn)]/60"),
  'RE Funktionsliste Nr. 44: die rohe Farbe (amber) des Hinweisbands ist eine Variable (--status-warn)',
);
ok(
  [55, 56].every((nr) => beginnt(nr, 'Live-Bereich Hinweisband') && nennt(nr, '`store/recorder.ts`')) && !GEAENDERT_KANON.has('apps/recorder/src/renderer/src/store/recorder.ts'),
  'RE Funktionsliste Nr. 55/56: die Texte der Hinweise kommen unverändert aus dem Store',
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
  nennt(21, 'Kein Eingang gewählt', 'Suche Audiogeräte…', 'Aufnahmezustand wird abgefragt…', 'E7') && obf.includes("zustandOffen: 'Aufnahmezustand wird abgefragt…'") && obf.includes("keinEingang: 'Kein Eingang gewählt'") && obf.includes('taste(T.taste.eingangOeffnen, \'bereit\')') && !/'live'/.test(obf.slice(obf.indexOf('const eingang = eingangOffen'), obf.indexOf('const aufnahme = nimmtAuf'))),
  'RE Funktionsliste Nr. 21: „Eingang öffnen“ ist nie live, gesperrt ohne Gerät („Kein Eingang gewählt“, „Suche Audiogeräte…“) und vor der ersten Antwort „Aufnahmezustand wird abgefragt…“',
);
ok(
  nennt(22, 'Erst den Eingang öffnen', 'gesperrt', 'Companion', 'RECORD', 'Nr. 80') && obf.includes("eingangZu: 'Erst den Eingang öffnen'") && obf.includes("taste(T.taste.aufnahme, 'gesperrt', T.grund.eingangZu)") && nennt(80, 'Companion', 'RECORD', 'unverändert'),
  'RE Funktionsliste Nr. 22/80: die Aufnahme-Taste ist im Ruhezustand gesperrt mit „Erst den Eingang öffnen“; Companion RECORD läuft unverändert über den Store (Nr. 80)',
);
ok(
  nennt(23, 'ON AIR', 'E4', 'recording') && obf.includes("taste(T.taste.stopp, 'live')") && obf.includes('return { live: nimmtAuf(s.zustand), label: RECORDER_TEXTE.onAirLabel }') && wurzel.includes('onAir={kopfOnAir(stand)}') && nennt(25, 'unbekannt') && live.includes('if (z === undefined) return { tone: \'muted\', text: UNBEKANNT }'),
  'RE Funktionsliste Nr. 23/25: ON AIR nur bei gemessenem recording (E4), „Stopp“ ist live; die Marke zeigt vor der ersten Antwort „unbekannt“',
);
ok(
  beginnt(24, 'Live-Bereich Transport') && nennt(24, 'ohne Rückfrage', 'E7', 'Eingang schließen') && obf.includes("taste(T.taste.eingangSchliessen, 'bereit')") && live.includes('t.eingang.label === T.eingangSchliessen ? a.disarm : a.arm') && !/confirm|prompt/.test(live),
  'RE Funktionsliste Nr. 24: „Eingang schließen“ bleibt ohne Rückfrage, auch in der Aufnahme (eine Taste mit wechselnder Beschriftung, E7)',
);
ok(
  [25, 26].every((nr) => beginnt(nr, 'Live-Bereich Transport') && nennt(nr, 'gemessen')) && live.includes('formatClock(z?.recordedSec ?? 0)') && live.includes("z.status === 'recording'"),
  'RE Funktionsliste Nr. 25/26: Marke und Uhr kommen aus dem gemessenen Zustand des Hauptprozesses',
);
ok(
  nennt(80, '`views/LiveBereich.tsx`', '`store/recorder.ts`') && beginnt(80, 'Live-Bereich Transport') && /record: async/.test(store) && !store.includes('Erst den Eingang öffnen'),
  'RE Funktionsliste Nr. 80: der Start aus der Taste und aus dem Fernbefehl läuft über dieselbe Store-Aktion record, ohne Änderung',
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
  von([48, 49, 50, 51, 52], unveraendert) && von([48, 49, 50], (nr) => nennt(nr, '`main/ipc.ts`')) && nennt(51, '`main/presets.ts`') && nennt(52, '`main/ipc.ts`', '`main/presets.ts`', 'Befund 7', 'Owner') && !GEAENDERT_KANON.has('apps/recorder/src/main/ipc.ts') && !GEAENDERT_KANON.has('apps/recorder/src/main/presets.ts'),
  'RE Funktionsliste Nr. 48–52: die Systemdialoge im Main sind unverändert; die Netzwerkordner-Rückfrage bleibt nur im Import (Befund 7, Owner-Entscheidung offen)',
);
{
  const dateien = ['App.tsx', 'views/RecorderOberflaeche.tsx', 'views/LiveBereich.tsx', 'views/Einstellungen.tsx', 'views/RecorderView.tsx', 'lib/aktionen.ts', 'lib/oberflaeche.ts', 'lib/bruecken.ts', 'components/PresetLeiste.tsx', 'store/recorder.ts'];
  ok(
    unveraendert(53) && dateien.every((d) => !/\b(?:window\.)?(?:confirm|alert|prompt)\(/.test(ohneKommentar(quelle(d)))),
    'RE Funktionsliste Nr. 53: weder confirm noch alert noch prompt im Renderer; die Aktionen ohne Rückfrage bleiben ohne Rückfrage',
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
  von([65, 66, 67, 68, 69, 70, 74, 75, 96, 97, 98, 99, 100], (nr) => (unveraendert(nr) || beginnt(nr, 'Live-Bereich Preset-Leiste')) && nennt(nr, '`store/recorder.ts`')) && !GEAENDERT_KANON.has('apps/recorder/src/renderer/src/store/recorder.ts'),
  'RE Funktionsliste Nr. 65–70, 74, 75, 96–100: Start, Merken und Presets laufen unverändert im Store',
);
ok(
  von([71, 73, 89, 90], (nr) => unveraendert(nr) && nennt(nr, '`main/index.ts`', 'E2')) && unveraendert(72),
  'RE Funktionsliste Nr. 71–73, 89, 90: Show-Vorgaben, Deep-Link, Schließen und Einzelinstanz im Main sind unverändert (nur die lesende Meldung, E2)',
);
ok(
  von([76, 77, 78, 79, 81, 82, 83, 84, 85, 86, 87, 88, 92, 93, 94, 95], (nr) => unveraendert(nr)) && !GEAENDERT_KANON.has('apps/recorder/src/main/recorder.ts') && !GEAENDERT_KANON.has('apps/recorder/src/main/wav.ts') && !GEAENDERT_KANON.has('apps/recorder/src/main/stille.ts') && !GEAENDERT_KANON.has('apps/recorder/src/main/dateiname.ts'),
  'RE Funktionsliste Nr. 76–95: Aufnahmekern, Dateinamen, Folgedatei, Stille-Auffüllung und Zeitplan im Main sind unverändert',
);
ok(
  beginnt(91, 'Arbeitsbereich Zeitplan') && nennt(91, '`views/RecorderView.tsx`', '`store/recorder.ts`') && zeitplan.includes('schedule: () => void schedule()') && zeitplan.includes('cancelSchedule: () => void cancelSchedule()'),
  'RE Funktionsliste Nr. 91: Planen und Abbrechen rufen weiter schedule und cancelSchedule des Stores',
);
ok(
  von([101, 102, 103, 104], unveraendert) && nennt(102, '`main/ipc.ts`') && nennt(104, '`main/ipc.ts`') && nennt(102, 'Befund 10'),
  'RE Funktionsliste Nr. 101–104: Export, Import, Preset-Datei und Ordnerprüfung im Main sind unverändert (Befund 10 bleibt)',
);

// ── Fernsteuerung (Nr. 105–111): Server und Verben unverändert, die Meldung ist neu (E2) ──
ok(
  beginnt(105, 'Panel Fernsteuerung') && nennt(105, 'E2', 'Statusleiste', '`main/control-server.ts`', '`shared/fernsteuerung.ts`', 'JM Audio Recorder') && ctl.includes('onMeldung') && panel.includes('<RemoteControlSection {...fernsteuerungAbschnitt(stand)} />') && obf.includes("companionModule: RECORDER_TEXTE.companionModul") && obf.includes("companionModul: 'JM Audio Recorder'"),
  'RE Funktionsliste Nr. 105: die Fernsteuerungs-Meldung (Port 8729, Clients, Fehler) steht im Panel Fernsteuerung und in der Statusleiste (E2), Modul „JM Audio Recorder“',
);
ok(
  [106, 107, 108, 109, 110, 111].every((nr) => unveraendert(nr) && nennt(nr, '`main/control-server.ts`')) && nennt(106, '`packages/suite-control-protocol/src/capabilities.ts`') && von([107, 108, 109, 111], (nr) => nennt(nr, '`store/recorder.ts`')) && nennt(111, '`preload/index.ts`', 'E2'),
  'RE Funktionsliste Nr. 106–111: STATE-Rückmeldung, die drei Verben und der Weg über den Renderer bleiben (control-server.ts und Preload nur mit den lesenden Brücken, E2)',
);
ok(
  nennt(108, 'Befund 2', 'Owner') && nennt(109, 'Befund 2') && nennt(107, 'RECORD') && /arm\(\)/.test(store),
  'RE Funktionsliste Nr. 107–109: die Vorbefunde (ARM beendet eine Aufnahme ohne Rückfrage, Befund 2) bleiben unverändert und stehen im Haken',
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
  unveraendert(132) && nennt(132, '`store/recorder.ts`', 'jmrec.gainDb') && von([124, 125, 126, 127, 128, 129, 130, 131], (nr) => unveraendert(nr)),
  'RE Funktionsliste Nr. 124–132: die gemerkten Werte und Dateien sind unverändert',
);
ok(
  ['jm-theme', 'E5'].every((w) => kuenftig(133).includes(w)) && kuenftig(133).includes('`packages/ui/src/lib/theme.ts`') && quelle('packages/ui/src/lib/theme.ts').includes("'jm-theme'") && ersetzt(133, 'Kopf'),
  'RE Funktionsliste Nr. 133: der Haken nennt die Ausnahme Hell/Dunkel im gemeinsamen Kopf (jm-theme in localStorage, E5)',
);
ok(
  [134, 135, 136, 137, 138].every((nr) => zeile(nr) !== undefined) && nennt(135, 'Meldung', 'Panel') && unveraendert(136) && unveraendert(137) && unveraendert(138),
  'RE Funktionsliste Nr. 134–138: Zustand der Oberfläche (jetzt auch Meldung und Panel, nicht gemerkt), Show-Vorgaben, Dateien und Laufzeit des Mains',
);

// ── Statusleiste: die sieben Einträge stehen in der Leiste (Nr. 5, 25, 26, 105 und die neuen) ──
ok(
  ['masterLinkStatusItem(s.masterLink)', "group: 'fernsteuerung'", "id: 'aufnahme'", "id: 'zeitplan'", "id: 'audio-modul'", "id: 'meldung'", 'eingangItem(s)'].every((w) => obf.includes(w)) && wurzel.includes('status={statusLeiste(stand)}'),
  'RE Funktionsliste: die Statusleiste hat Master-Link, Aufnahme, Fernsteuerung, Eingang, Zeitplan, Audio-Modul und Meldung',
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
  ok(/Welle 2a:[^]*unverändert[^]*Owner/.test(befund(2)) && /Welle 2a:[^]*unverändert[^]*Owner/.test(befund(7)), 'RE Funktionsliste Abschnitt 10: Befund 2 (ARM) und Befund 7 (Netzwerkordner) bleiben unverändert, Owner-Entscheidung offen');
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
