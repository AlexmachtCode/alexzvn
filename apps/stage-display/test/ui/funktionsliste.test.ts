// ─────────────────────────────────────────────────────────────────────────────
// Funktionsliste nach dem Umbau (UX Welle 2a, Stage-Display e; Spec 10 „Kein Funktionsverlust“). Jede der 108 Zeilen in den
// Abschnitten 1–7 von docs/ux/funktionslisten/stage-display.md ist in „künftig wo“ abgehakt: „✓ “ und ein Ort des Ortsregisters,
// „unverändert (…)“, „entfällt (…, E…)“ oder „ersetzt durch {Ort} (…, E…)“. Verweise nur auf E1–E16 (Plan 2a) und, seit dem
// 2a-Nachzug in Welle 2b (Task 5), auf B1–B22 (Plan 2b). Jede
// genannte Datei existiert, Groß- und Kleinschreibung wie im Repo. Dazu Querprüfungen gegen den Code (keine Kürzel, Panel-Tasten
// nach O1, die Abläufe in der Wurzel-View statt im Panel, die Bedienelemente an ihrem neuen Ort).
// Läuft im Paketordner apps/stage-display (npm run selftest -w @jm/stage-display).
// „unverändert (…)“ darf keine Datei nennen, die seit der Erhebung (d7cdd79ce0) geändert wurde, außer sie bekam nur die lesenden
// Brücken bzw. den Ausgabezustand (E2, E3): dann steht der Hinweis im Haken; oder ein Altfehler der Stufe 2 hat sie geändert: dann
// steht „Altfehler <ID>“ im Haken, und die Liste der ID in ALTFEHLER nennt die Datei (C8, R6). Der Abgleich der statischen Liste
// GEAENDERT mit git läuft nur mit JM_FUNKTIONSLISTE_GIT=1 (Arbeitsbaum gegen die Erhebung, damit auch eine noch nicht eingecheckte,
// aber gestagte Datei zählt).
// ─────────────────────────────────────────────────────────────────────────────

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { gleich, leseText, ok } from '@jm/ui/testhilfe';

const LISTE = '../../docs/ux/funktionslisten/stage-display.md';

/** Ortsregister: Rahmen, Kopf, Live-Bereich (Vorschau, Nachricht, Elemente, Bühnenschirm-Taste), Statusleiste, Panel je Abschnitt, Bühnenschirm. */
const ABSCHNITTE = ['Ausgabe', 'Gegenstellen', 'Presenter-Kopplung'];
const ORTE: readonly string[] = [
  'Rahmen',
  'Kopf',
  'Live-Bereich',
  'Live-Bereich Vorschau',
  'Live-Bereich Nachricht',
  'Live-Bereich Elemente',
  'Live-Bereich Bühnenschirm-Taste',
  'Statusleiste',
  'Panel',
  ...ABSCHNITTE.map((a) => `Panel ${a}`),
  'Bühnenschirm',
];

/** Zeilen insgesamt und je Abschnitt 1–7, wie die Liste im Kopf sie nennt. */
const GESAMT = 108;
const JE_ABSCHNITT = [40, 7, 21, 0, 11, 8, 21];

const ERHEBUNG = 'd7cdd79ce0';

/**
 * Alle Dateien von apps/stage-display, die seit der Erhebung geändert, angelegt oder gelöscht wurden, als Pfad ab der Repo-Wurzel.
 * Ein „unverändert (…)“ darf sie nur nennen, wenn der Haken E2 oder E3 nennt und die Datei nur die lesenden Brücken bekam
 * (NUR_MELDUNG). Mit JM_FUNKTIONSLISTE_GIT=1 prüft der Test unten, dass git dieselbe Menge kennt.
 */
const GEAENDERT = [
  'package.json',
  'src/main/config.ts',
  'src/main/index.ts',
  'src/preload/index.ts',
  'src/renderer/src/App.tsx',
  'src/renderer/src/components/PinFeld.tsx',
  'src/renderer/src/globals.css',
  'src/renderer/src/lib/aktionen.ts',
  'src/renderer/src/lib/bruecken.ts',
  'src/renderer/src/lib/oberflaeche.ts',
  'src/renderer/src/views/Einstellungen.tsx',
  'src/renderer/src/views/LiveBereich.tsx',
  'src/renderer/src/views/OperatorView.tsx',
  'src/renderer/src/views/StageOberflaeche.tsx',
  'src/shared/konfig-regeln.ts',
  'src/shared/mdns.ts',
  'src/shared/types.ts',
  'test/ui/bruecken.test.ts',
  'test/ui/funktionsliste.test.ts',
  'test/ui/hilfe.ts',
  'test/ui/konfig-regeln.test.ts',
  'test/ui/live.test.tsx',
  'test/ui/mdns.test.ts',
  'test/ui/oberflaeche.test.ts',
  'test/ui/panel.test.tsx',
  'test/ui/rahmen.test.tsx',
  'test/ui/selftest.ts',
  'test/ui/testzustand.ts',
  'test/ui/werkzeug.test.tsx',
  'tsconfig.test.json',
].map((p) => `apps/stage-display/${p}`);

/**
 * Geänderte Dateien außerhalb von apps/stage-display, die ein unverändert-Haken zitieren könnte (Task 1, W2-2: Ausgabezustand;
 * Altfehler Stufe 2: die Gegenstellen-Zeile aus @jm/settings, G6).
 */
const PAKETE_GEAENDERT = [
  'packages/output-window/package.json',
  'packages/output-window/src/bildschirme.ts',
  'packages/output-window/src/index.ts',
  'packages/output-window/src/zustand.ts',
  'packages/output-window/test/bildschirme.test.ts',
  'packages/output-window/test/selftest.ts',
  'packages/output-window/test/zustand.test.ts',
  // Altfehler SD-3, Stufe 2: PeerRow.eingerichtet und „nicht erreichbar“ (C5).
  'packages/settings/src/abschnitte/peers.ts',
];

/**
 * Dateien, die nur die lesenden Brücken bekamen: preload/index.ts die Brücken (E2, E3), das Fenster-Paket den Ausgabezustand (E3).
 * Welle 2b (Task 5) ergänzt nur das lesende Bildschirm-Ereignis: in preload/index.ts und im Fenster-Paket (index.ts und die neue
 * reine Datei bildschirme.ts). Seit der Altfehler-Stufe 2 bekamen main/index.ts (SD-3: mDNS nur bei der Vorgabe) und
 * shared/types.ts (SD-1: das gemerkte Feld nachrichtEntwurf) mehr; sie stehen darum nicht mehr hier, ein Haken braucht für sie
 * den Verweis auf den Altfehler (K3).
 */
const NUR_MELDUNG = new Set([
  'apps/stage-display/src/preload/index.ts',
  'packages/output-window/src/index.ts',
  'packages/output-window/src/bildschirme.ts',
]);

/**
 * Altfehler Stufe 2 (Plan 2026-11-26, Task 3; C8): je erlaubter Stage-Display-ID die Dateien (ab der Repo-Wurzel), die der Befund
 * geändert hat, wie im Player (Ruling R6). „Altfehler <ID>“ im Haken entlastet ein „unverändert (…)“, das eine geänderte Datei nennt,
 * nur, wenn die Liste dieser ID die Datei enthält; dann für die ganze Änderung des Befunds, nicht nur für lesende Brücken. Erlaubt sind
 * genau die drei Stage-Display-IDs SD-5 (PIN verdeckt, gilt erst mit „Setzen“), SD-1 (Nachricht als Entwurf) und SD-3 (mDNS nur bei
 * der Vorgabe 127.0.0.1 oder ohne Host, Ruling R6); SD-3 nennt dazu die Datei aus @jm/settings, die es erweitert (C5).
 */
const APP = (p: string): string => `apps/stage-display/src/${p}`;
const RENDERER = (p: string): string => `apps/stage-display/src/renderer/src/${p}`;
const ALTFEHLER = new Map<string, readonly string[]>([
  ['SD-5', [RENDERER('components/PinFeld.tsx'), RENDERER('views/Einstellungen.tsx'), RENDERER('lib/oberflaeche.ts')]],
  [
    'SD-1',
    [APP('shared/types.ts'), APP('shared/konfig-regeln.ts'), APP('main/config.ts'), RENDERER('lib/aktionen.ts'), RENDERER('views/LiveBereich.tsx'), RENDERER('lib/oberflaeche.ts')],
  ],
  ['SD-3', [APP('shared/mdns.ts'), APP('main/index.ts'), APP('main/config.ts'), RENDERER('lib/oberflaeche.ts'), 'packages/settings/src/abschnitte/peers.ts']],
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
if (GIT_PRUEFEN && GIT === null) console.log(`SD Funktionsliste: kein git-Verlauf bis ${ERHEBUNG} (flacher Klon); die Prüfung gegen git entfällt`);

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

/** Pfadregel der Liste: Repo-Wurzel, apps/stage-display/src (main, preload, shared, renderer) oder der Renderer. */
function aufgeloest(pfad: string): string {
  if (/^(?:apps|packages|docs)\//.test(pfad)) return `../../${pfad}`;
  if (/^(?:main|preload|shared|renderer)\//.test(pfad)) return `src/${pfad}`;
  return `src/renderer/src/${pfad}`;
}

/** Kanonischer Pfad ab der Repo-Wurzel nach der Pfadregel der Liste. */
function kanon(pfad: string): string {
  const a = aufgeloest(pfad);
  return a.startsWith('../../') ? a.slice('../../'.length) : `apps/stage-display/${a}`;
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
  // Dateien, die ein Altfehler der Stufe 2 geändert hat, mit dem Verweis „Altfehler <ID>“, dessen Liste sie nennt (R6).
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

gleich(alle.length, GESAMT, 'SD Funktionsliste: 108 Zeilen in den Abschnitten 1–7 (Stand der Erhebung)');
gleich(
  JE_ABSCHNITT.map((_, i) => alle.filter((z) => z.abschnitt === i + 1).length),
  JE_ABSCHNITT,
  'SD Funktionsliste: Zeilen je Abschnitt wie in der Erhebung (40/7/21/0/11/8/21)',
);
gleich(
  alle.map((z) => z.nr),
  alle.map((_, i) => i + 1),
  'SD Funktionsliste: Nummern fortlaufend ab 1',
);
ok(!text.replace(/`[^`]*`/g, '').includes('"') && !text.includes('\r'), 'SD Funktionsliste: keine ASCII-Anführungszeichen außerhalb von Code, kein CR');

for (const z of alle) {
  const f = zeilenFehler(z);
  ok(f === null, `SD Funktionsliste Nr. ${z.nr} abgehakt${f === null ? '' : ` – ${f}`}`);
}

// ── Die Menge der geänderten Dateien stimmt mit git überein (nur mit JM_FUNKTIONSLISTE_GIT=1 und Verlauf) ──
{
  if (GIT !== null) {
    const fehlend = [...GIT].filter((n) => n.startsWith('apps/stage-display/') && !GEAENDERT_KANON.has(n));
    ok(fehlend.length === 0, `SD Funktionsliste: GEAENDERT nennt alle seit ${ERHEBUNG} geänderten Dateien von apps/stage-display (fehlt: ${fehlend.join(', ') || 'nichts'})`);
    const zuviel = GEAENDERT.filter((n) => !GIT.has(n));
    ok(zuviel.length === 0, `SD Funktionsliste: GEAENDERT nennt keine Datei, die git nicht als geändert kennt (zu viel: ${zuviel.join(', ') || 'nichts'})`);
    const pakete = [...GIT].filter((n) => !n.startsWith('apps/stage-display/') && !n.startsWith('docs/') && !n.startsWith('.superpowers/'));
    const paketFehlt = pakete.filter((n) => !PAKETE_GEAENDERT.includes(n) && /^packages\/output-window\//.test(n));
    ok(paketFehlt.length === 0, `SD Funktionsliste: PAKETE_GEAENDERT nennt alle geänderten Dateien von packages/output-window (fehlt: ${paketFehlt.join(', ') || 'nichts'})`);
    const zitiert = alle
      .filter((z) => z.zellen[6].startsWith('✓ unverändert ('))
      .flatMap((z) => {
        const ids = altfehlerIds(z.zellen[6].replace(/`[^`]*`/g, ''));
        return [...z.zellen[6].matchAll(PFAD)].map((m) => kanon(m[1])).filter((n) => !entlastet(ids, n));
      });
    const getroffen = zitiert.filter((n) => !n.startsWith('apps/stage-display/') && pakete.includes(n));
    ok(getroffen.every((n) => NUR_MELDUNG.has(n)), `SD Funktionsliste: keine in einem unverändert-Haken zitierte Datei außerhalb von apps/stage-display bekam mehr als den Ausgabezustand, außer ein Altfehler-Verweis nennt sie in seiner Liste (${getroffen.join(', ') || 'keine'})`);
    const listen = [...ALTFEHLER.values()].flat();
    ok(listen.every((n) => GIT.has(n)), `SD Funktionsliste: jede Datei einer Altfehler-Liste ist laut git geändert (nicht: ${listen.filter((n) => !GIT.has(n)).join(', ') || 'nichts'})`);
  }
  // Jede Datei einer Altfehler-Liste steht in GEAENDERT (oder PAKETE_GEAENDERT): eine Liste entlastet nur, was wirklich geändert ist.
  {
    const listen = [...ALTFEHLER.values()].flat();
    ok(
      listen.length > 0 && listen.every((n) => GEAENDERT_KANON.has(n)),
      `SD Funktionsliste: jede Datei einer Altfehler-Liste steht in GEAENDERT (nicht: ${listen.filter((n) => !GEAENDERT_KANON.has(n)).join(', ') || 'nichts'})`,
    );
  }
  // Negativprobe: andere Schreibweisen derselben geänderten Datei werden erkannt, eine unveränderte nicht.
  const synth = (pfad: string, zusatz = ''): Zeile => ({ abschnitt: 3, nr: 0, zellen: ['0', '', '', '', '', '', `✓ unverändert (\`${pfad}\`): x${zusatz}`] });
  ok(
    ['views/LiveBereich.tsx', 'renderer/src/views/LiveBereich.tsx', 'apps/stage-display/src/renderer/src/views/LiveBereich.tsx'].every((p) => (zeilenFehler(synth(p)) ?? '').includes('geänderter Datei')) &&
      (zeilenFehler(synth('views/LiveBereich.tsx', ' (E3)')) ?? '').includes('mehr als die lesenden Brücken') &&
      (zeilenFehler(synth('lib/oberflaeche.ts', ' (E2)')) ?? '').includes('mehr als die lesenden Brücken') &&
      zeilenFehler(synth('preload/index.ts', ' (E2)')) === null &&
      zeilenFehler(synth('main/timer-client.ts')) === null,
    'SD Funktionsliste: eine geänderte Datei wird in jeder Schreibweise erkannt; E2 und E3 entlasten nur Dateien mit den lesenden Brücken; eine unveränderte Datei ist frei',
  );
  // Der Verweis „Altfehler <ID>“ (Stufe 2, C8) entlastet eine geänderte Datei nur, wenn die Liste der ID sie nennt (R6); nur mit dem
  // Wort „Altfehler“ und nur die drei Stage-Display-IDs. main/index.ts und shared/types.ts verlassen NUR_MELDUNG (K3): E3 allein
  // entlastet sie nicht mehr.
  ok(
    (zeilenFehler(synth('main/config.ts')) ?? '').includes('geänderter Datei') &&
      zeilenFehler(synth('main/config.ts', ' (Altfehler SD-1)')) === null &&
      zeilenFehler(synth('main/config.ts', ' (Altfehler SD-3)')) === null &&
      (zeilenFehler(synth('main/config.ts', ' (Altfehler SD-5)')) ?? '').includes('geänderter Datei') &&
      (zeilenFehler(synth('main/index.ts', ' (E3)')) ?? '').includes('mehr als die lesenden Brücken') &&
      zeilenFehler(synth('main/index.ts', ' (E3, Altfehler SD-3)')) === null &&
      (zeilenFehler(synth('main/index.ts', ' (E3, Altfehler SD-1)')) ?? '').includes('mehr als die lesenden Brücken') &&
      (zeilenFehler(synth('shared/types.ts', ' (E2)')) ?? '').includes('mehr als die lesenden Brücken') &&
      zeilenFehler(synth('shared/types.ts', ' (Altfehler SD-1)')) === null &&
      zeilenFehler(synth('apps/stage-display/src/shared/types.ts', ' (Altfehler SD-1)')) === null &&
      zeilenFehler(synth('views/Einstellungen.tsx', ' (Altfehler SD-5)')) === null &&
      zeilenFehler(synth('lib/oberflaeche.ts', ' (Altfehler SD-3)')) === null &&
      (zeilenFehler(synth('packages/settings/src/abschnitte/peers.ts')) ?? '').includes('geänderter Datei') &&
      zeilenFehler(synth('packages/settings/src/abschnitte/peers.ts', ' (Altfehler SD-3)')) === null &&
      (zeilenFehler(synth('packages/settings/src/abschnitte/peers.ts', ' (Altfehler SD-5)')) ?? '').includes('geänderter Datei') &&
      (zeilenFehler(synth('main/config.ts', ' (SD-1)')) ?? '').includes('geänderter Datei') &&
      ['SD-10', 'SD-1a', 'SD-1-b', 'SD-30', 'SD-2', 'IN-3', 'PL-N', 'SC-S2'].every((id) => (zeilenFehler(synth('main/config.ts', ` (Altfehler ${id})`)) ?? '').includes('geänderter Datei')),
    'SD Funktionsliste: „Altfehler SD-1“ entlastet main/config.ts im unverändert-Haken; ohne ID, mit der ID eines anderen Befunds, ohne das Wort „Altfehler“ oder mit einer fremden ID nicht; main/index.ts und shared/types.ts brauchen ihren Altfehler-Verweis (K3)',
  );
  // Negativprobe R6: nennt ein Haken zwei geänderte Dateien, entlastet die ID nur die aus ihrer Liste; eine Datei mit mehr als den
  // lesenden Brücken entlastet auch E3 nicht.
  ok(
    /geänderter Datei \(views\/LiveBereich\.tsx\)/.test(zeilenFehler(synth('main/config.ts', ' und `views/LiveBereich.tsx` (Altfehler SD-3)')) ?? '') &&
      zeilenFehler(synth('main/config.ts', ' und `views/LiveBereich.tsx` (Altfehler SD-3, Altfehler SD-1)')) === null &&
      (zeilenFehler(synth('views/StageOberflaeche.tsx', ' (Altfehler SD-1)')) ?? '').includes('geänderter Datei') &&
      (zeilenFehler(synth('views/LiveBereich.tsx', ' (Altfehler SD-5)')) ?? '').includes('geänderter Datei') &&
      (zeilenFehler(synth('main/config.ts', ' (E3)')) ?? '').includes('mehr als die lesenden Brücken'),
    'SD Funktionsliste: eine geänderte Datei mit einer Altfehler-ID, deren Liste sie nicht nennt, wird gemeldet (R6)',
  );
}

const zeile = (nr: number): Zeile | undefined => alle.find((z) => z.nr === nr);
const kuenftig = (nr: number): string => zeile(nr)?.zellen[6] ?? '';
const quelle = (pfad: string): string => (gibtEs(pfad) ? readFileSync(aufgeloest(pfad), 'utf8') : '');
const beginnt = (nr: number, ...orte: string[]): boolean => orte.some((o) => kuenftig(nr).startsWith(`✓ ${o}`));
const ersetzt = (nr: number, ort: string): boolean => kuenftig(nr).startsWith(`✓ ersetzt durch ${ort}`);
/** Nennt der Haken der Zeile einen Altfehler-Verweis, dessen Liste die Datei (Pfad nach der Pfadregel der Liste) enthält? */
const gebunden = (nr: number, datei: string): boolean => entlastet(altfehlerIds(kuenftig(nr).replace(/`[^`]*`/g, '')), kanon(datei));

const wurzel = quelle('views/StageOberflaeche.tsx');
const live = quelle('views/LiveBereich.tsx');
const panel = quelle('views/Einstellungen.tsx');
const obf = quelle('lib/oberflaeche.ts');
const akt = quelle('lib/aktionen.ts');

// ── Zeile 4: der Untertitel im Kopf entfällt nach E16, Logo und Name bleiben im Kopf ──
ok(beginnt(4, 'Kopf') && /entfällt \(E16\)/.test(kuenftig(4)) && kuenftig(4).includes('Bühnen-/Crew-Schirm') && kuenftig(4).includes('JM Stage Display'), 'SD Funktionsliste Nr. 4: Logo und Name „JM Stage Display“ im Kopf, der Untertitel „Bühnen-/Crew-Schirm“ entfällt (E16)');

// ── Zeile 3: Ladezustand mit Rahmen; Zeile 1: Aufbau ──
ok(
  beginnt(3, 'Rahmen') && kuenftig(3).includes('Lädt…') && obf.includes("laedt: 'Lädt…'") && wurzel.includes('STAGE_TEXTE.live.laedt') && wurzel.includes('<AppShell') && wurzel.includes('status={statusLeiste(stand)}'),
  'SD Funktionsliste Nr. 3: „Lädt…“ steht im Inhalt, Kopf und Statusleiste stehen schon (views/StageOberflaeche.tsx)',
);
ok(beginnt(1, 'Rahmen') && kuenftig(1).includes('AppShell') && wurzel.includes('<LiveBereich') && wurzel.includes('settings={<Einstellungen'), 'SD Funktionsliste Nr. 1: Aufbau im AppShell, Live-Bereich im Inhalt, Panel daneben (Rahmen)');

// ── Pflichtzeile Tastatur (Nr. 80): keine Kürzel, keine neuen (E1) ──
{
  // Seit Altfehler SD-5 gehört components/PinFeld.tsx dazu (kein Enter am PIN-Feld); Enter im Nachricht-Feld schickt das Formular ab
  // (SD-1), ohne Tastenhörer.
  const dateien = ['App.tsx', 'views/StageOberflaeche.tsx', 'views/LiveBereich.tsx', 'views/Einstellungen.tsx', 'lib/aktionen.ts', 'lib/oberflaeche.ts', 'views/StageOutputView.tsx', 'components/StageScreen.tsx', 'components/PinFeld.tsx'];
  ok(
    beginnt(80, 'Rahmen') && /\bE1\b/.test(kuenftig(80)) && dateien.every((d) => quelle(d).length > 0 && !/keydown|keyup|addEventListener|onKeyDown|useHotkeys/.test(quelle(d))),
    'SD Funktionsliste Nr. 80 (Pflichtzeile Tastatur): weiter kein Kürzel und kein Tastenhörer im Renderer (E1), auch nicht im PIN-Feld (Altfehler SD-5)',
  );
  ok(beginnt(87, 'Bühnenschirm') && kuenftig(87).includes('`views/StageOutputView.tsx`'), 'SD Funktionsliste Nr. 87: das Ausgabefenster hat weiter keine Tasten');
}

// ── Pflichtpunkt Panel-Tasten (Nr. 81, O1): Feld behält Tasten, Leertaste auf Knopf/Schalter geht ans Tool (nichts), Escape schließt ──
ok(
  zeile(81)?.zellen[1] === 'Panel-Tasten' && beginnt(81, 'Panel ') && ['Leertaste', 'Escape', 'Feld', 'Schalter', 'O1', 'nichts'].every((w) => kuenftig(81).includes(w)),
  'SD Funktionsliste Nr. 81 (Pflichtpunkt Panel-Tasten): Leertaste und Escape, je für Feld und Knopf/Schalter (Spec 10, O1)',
);
{
  const sp = quelle('packages/ui/src/components/SettingsPanel.tsx');
  ok(sp.includes('Escape') && sp.includes('defaultPrevented'), 'SD Funktionsliste Nr. 81: SettingsPanel schließt mit Escape, nur wenn nicht defaultPrevented');
  ok(
    wurzel.includes('<LiveBereich') && wurzel.includes('settings={<Einstellungen') && !panel.includes('<LiveBereich'),
    'SD Funktionsliste Nr. 81: das Panel ist kein eigener Bildschirm, der Live-Bereich bleibt bei offenem Panel gemountet',
  );
}
ok(beginnt(82, 'Panel', 'Live-Bereich Nachricht') && beginnt(85, 'Panel', 'Live-Bereich Elemente') && beginnt(86, 'Panel', 'Live-Bereich Bühnenschirm-Taste'), 'SD Funktionsliste Nr. 82/85/86: die Tasten im Feld, am Schalter und am Knopf stehen bei ihrem neuen Ort');

// ── Host und Port der drei Quellen (E12): „Setzen“ statt jedem Tastendruck, auch bei ausgeschalteter Quelle, Pfeiltasten tot ──
{
  const grund = [16, 17, 21, 22, 26, 27];
  ok(
    grund.every((nr) => ersetzt(nr, 'Panel Gegenstellen') && /\bE12\b/.test(kuenftig(nr)) && kuenftig(nr).includes('Setzen')) &&
      panel.includes('<PeersSection {...quellenAbschnitt(stand, aktionen)} />') &&
      obf.includes('onSet:') &&
      akt.includes('quelleSetzen:') &&
      quelle('packages/settings/src/abschnitte/peers.ts').includes("setzen: 'Setzen'"),
    'SD Funktionsliste Nr. 16/17/21/22/26/27: Host und Port im Panel Gegenstellen mit „Setzen“ statt mit jedem Tastendruck (E12)',
  );
  ok(
    [17, 22, 27].every((nr) => kuenftig(nr).includes('Pfeiltasten')) && kuenftig(83).includes('Pfeiltasten') && /\bE12\b/.test(kuenftig(83)) && kuenftig(16).includes('ausgeschaltet'),
    'SD Funktionsliste Nr. 16/17/83: die Felder stehen auch bei ausgeschalteter Quelle, die Pfeiltasten des Ports wirken nicht mehr (E12)',
  );
  ok(
    [12, 13, 14, 18, 19, 23, 24].every((nr) => beginnt(nr, 'Panel Gegenstellen', 'ersetzt durch Panel Gegenstellen')) && [15, 20, 25].every((nr) => beginnt(nr, 'Panel Gegenstellen')),
    'SD Funktionsliste Nr. 12–15, 18–20, 23–25: Quellenkarten, Schalter, Zustand und Hinweise im Panel Gegenstellen',
  );
  ok(
    [15, 20, 25].every((nr) => kuenftig(nr).includes('quellenHinweis')) && ['timer', 'switcher', 'presenter'].every((r) => obf.includes(`${r}: '`)) && panel.includes('data-stage="quellen-hinweise"') && obf.includes('Countdown · Programmpunkt · Nachricht (Port 7777)') && obf.includes('Program/Preview · REC/Stream (Companion-Port)') && obf.includes('Referentenansicht: Folie · Notizen · Nächste (Fernsteuerung im Presenter aktivieren, Port 7330)'),
    'SD Funktionsliste Nr. 15/20/25: die drei Hinweise behalten ihren Wortlaut als Liste unter den Gegenstellen',
  );
}

// ── Presenter-Kopplung (Nr. 28–31): nur bei eingeschalteter Presenter-Quelle, PIN und Anzeige wie bisher; seit Altfehler SD-5 die
// PIN verdeckt im PinFeld, gültig erst mit „Setzen“ ──
ok(
  [28, 29, 30, 31].every((nr) => beginnt(nr, 'Panel Presenter-Kopplung')) &&
    panel.includes('p?.enabled === true') &&
    panel.includes('<PinFeld wert={p.pin} setzen={aktionen.pin} />') &&
    !panel.includes('onChange={aktionen.pin}') &&
    quelle('components/PinFeld.tsx').includes("type={p.sichtbar ? 'text' : 'password'}") &&
    quelle('components/PinFeld.tsx').includes('{PEERS_TEXTE.setzen}') &&
    ['Altfehler SD-5', 'verdeckt', '„Anzeigen“', '„Setzen“', '`components/PinFeld.tsx`'].every((w) => kuenftig(28).includes(w)) &&
    ['Altfehler SD-5', '„Setzen“'].every((w) => kuenftig(98).includes(w)) &&
    panel.includes('aktionen.modus(modus)') &&
    akt.includes("replace(/\\D/g, '').slice(0, 8)") &&
    obf.includes("pinHinweis: 'PIN nur falls die Presenter-Fernsteuerung mit PIN läuft — sonst leer lassen'") &&
    obf.includes("folienHinweis: 'Folienbild erscheint, sobald eine Präsentation läuft'"),
  'SD Funktionsliste Nr. 28–31, 98: PIN, PIN-Hinweis, Anzeige und Folien-Hinweis im Panel Presenter-Kopplung, nur bei eingeschalteter Quelle; die PIN verdeckt, gültig erst mit „Setzen“ (Altfehler SD-5)',
);

// ── Bildschirmwahl (Nr. 7/84): Panel Ausgabe, Liste beim Start und bei jedem Öffnen des Panels frisch ──
ok(
  beginnt(7, 'Panel Ausgabe') && beginnt(84, 'Panel Ausgabe') && [7, 84].every((nr) => kuenftig(nr).includes('Öffnen des Panels')) && wurzel.includes('[panelOffen]') && wurzel.includes('liesBildschirme(window.jmstage?.output?.displays') && akt.includes('bildschirmWaehlen'),
  'SD Funktionsliste Nr. 7/84: die Bildschirmliste kommt beim Start und bei jedem Öffnen des Panels frisch (views/StageOberflaeche.tsx), die Wahl merkt nur outputDisplayId',
);
ok(
  beginnt(9, 'Panel Ausgabe') && panel.includes('data-stage="verschieben"') && panel.includes('kannVerschieben(stand.ausgabe)') && akt.includes('ausgabeVerschieben') && obf.includes("verschieben: 'Auf diesen Bildschirm'") && obf.includes("primaer: ' · primär'"),
  'SD Funktionsliste Nr. 9: der Knopf „Auf diesen Bildschirm“ steht im Panel Ausgabe',
);

// ── Bühnenschirm-Haupttaste (Nr. 8/10) und Live-Bereich (Nr. 5, 32–39) ──
ok(
  [8, 10].every((nr) => beginnt(nr, 'Live-Bereich Bühnenschirm-Taste')) &&
    live.includes('<TallyButton {...liveTaste(stand, aktionen)} />') &&
    obf.includes("oeffnen: 'Vollbild-Ausgabe öffnen'") &&
    obf.includes("schliessen: 'Ausgabe schließen'") &&
    akt.includes('ausgabeUmschalten'),
  'SD Funktionsliste Nr. 8/10: die Haupttaste „Bühnenschirm“ öffnet und schließt mit dem alten Wortlaut',
);
// Altfehler SD-1: der Wächter „das Nachricht-Feld wirkt mit jedem Tastendruck“ ist umgestellt: das Feld schreibt den Entwurf, erst
// „Senden“ oder Enter (Formular) schreibt message; Nr. 39 nennt das.
ok(
  beginnt(5, 'Live-Bereich Vorschau') &&
    live.includes('<StageScreen state={state} now={now} />') &&
    quelle('components/StageScreen.tsx').length > 0 &&
    [38, 39].every((nr) => beginnt(nr, 'Live-Bereich Nachricht')) &&
    live.includes('onChange={aktionen.entwurf}') &&
    live.includes('<form') &&
    live.includes('aktionen.senden(c.nachrichtEntwurf ?? \'\')') &&
    !live.includes('aktionen.nachricht') &&
    akt.includes('entwurf: (text) => void q.setConfig({ nachrichtEntwurf: text })') &&
    akt.includes('senden: (text) => void q.setConfig({ message: text })') &&
    !akt.includes('nachricht: (text)') &&
    ['Altfehler SD-1', 'Entwurf', '„Senden“', 'Enter', 'C6', 'Neustart'].every((w) => kuenftig(39).includes(w)) &&
    obf.includes("senden: 'Senden'"),
  'SD Funktionsliste Nr. 5/38/39: Vorschau und Nachricht-Feld im Live-Bereich; das Feld ist ein Entwurf, auf die Bühne kommt er erst mit „Senden“ oder Enter (Altfehler SD-1, früher mit jedem Tastendruck)',
);
ok(
  [88, 105].every((nr) => kuenftig(nr).includes('Altfehler SD-1') && kuenftig(nr).includes('`shared/konfig-regeln.ts`') && kuenftig(nr).includes('nachrichtEntwurf')) &&
    kuenftig(105).includes('überlebt keinen Neustart mehr') &&
    kuenftig(46).includes('Altfehler SD-1') &&
    quelle('shared/konfig-regeln.ts').includes("nachrichtEntwurf: data.nachrichtEntwurf ?? data.message ?? ''") &&
    quelle('shared/types.ts').includes('nachrichtEntwurf?: string;'),
  'SD Funktionsliste Nr. 46/88/105: message überlebt keinen Neustart mehr, der Entwurf nachrichtEntwurf ist gemerkt; die Regeln stehen in shared/konfig-regeln.ts (Altfehler SD-1)',
);
ok(
  [32, 33, 34, 35, 36, 37].every((nr) => beginnt(nr, 'Live-Bereich Elemente')) &&
    ['clock', 'timer', 'switcher', 'presenter', 'message'].every((k) => live.includes(`'${k}'`) && obf.includes(`${k}: '`)) &&
    live.includes('<Toggle checked={c.widgets[key]}') &&
    ['Uhr', 'Timer/Countdown', 'Switcher-Status', 'Presenter (REF)'].every((w) => obf.includes(w)) &&
    kuenftig(32).includes('Schalter'),
  'SD Funktionsliste Nr. 32–37: die fünf Anzeige-Elemente sind Schalter mit unveränderter Beschriftung im Live-Bereich',
);

// ── Statusleiste (Nr. 11, 40, 43, 47) und Preload (Nr. 68): was früher unsichtbar war, ist jetzt ein Eintrag ──
ok(
  [11, 40, 43, 47].every((nr) => beginnt(nr, 'Statusleiste')) &&
    [11, 47].every((nr) => /\bE3\b/.test(kuenftig(nr))) &&
    obf.includes("id: 'buehnenschirm'") &&
    obf.includes('masterLinkStatusItem(s.masterLink)') &&
    obf.includes('quelle-${r.role}') &&
    obf.includes("id: 'nachricht'"),
  'SD Funktionsliste Nr. 11/40/43/47: Bühnenschirm (gemessen, E3), Master-Link, Quellen und Nachricht stehen in der Statusleiste',
);
ok(
  beginnt(68, 'Statusleiste') && /\bE2\b/.test(kuenftig(68)) && kuenftig(68).includes('Steuerserver') && quelle('main/index.ts').length > 0 && !/createServer|listen\(/.test(quelle('main/index.ts')),
  'SD Funktionsliste Nr. 68: weiter kein Steuerserver, neu nur die lesenden Brücken (E2, E3)',
);

// ── Abläufe aus Abschnitt 3: bleiben im Main, in App, Store und der Wurzel-View, nicht im Panel (E15) ──
{
  ok(
    quelle('App.tsx').includes('load()') && quelle('store/stage.ts').includes('onState') && beginnt(48, 'Rahmen') && kuenftig(48).includes('`App.tsx`') && kuenftig(48).includes('`store/stage.ts`'),
    'SD Funktionsliste Nr. 48: das Laden und Abonnieren des Zustands läuft in App und Store, oberhalb des Panels',
  );
  ok(
    wurzel.includes('useBrueckenWert(MASTER_LINK_QUELLE)') && wurzel.includes('useBrueckenWert(AUSGABE_QUELLE)') && wurzel.includes('liesBildschirme(window.jmstage?.output?.displays') && wurzel.includes('baueAktionen('),
    'SD Funktionsliste Nr. 7/48/68: Brücken, Bildschirmliste und Aktionen laufen in der Wurzel-View, auch bei geschlossenem Panel',
  );
  ok(
    ['window.', 'useEffect', 'setInterval', 'addEventListener', 'useStage('].every((w) => !panel.replace(/\/\/.*$/gm, '').includes(w)) && !live.replace(/\/\/.*$/gm, '').includes('window.'),
    'SD Funktionsliste: Einstellungen.tsx hat keinen Zugriff auf window, keine Effekte und keinen Store, LiveBereich.tsx kein window (E15)',
  );
  ok(
    kuenftig(50).includes('StageOutputView') && /\bE6\b/.test(kuenftig(50)) && quelle('renderer/src/main.tsx').includes("'#output'") && quelle('renderer/src/main.tsx').includes('<StageOutputView />') && !quelle('views/StageOutputView.tsx').includes('AppShell'),
    'SD Funktionsliste Nr. 50: #output lädt weiter die StageOutputView, ohne AppShell (E6)',
  );
  ok(
    [2, 44, 45, 52, 53, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 69].every((nr) => kuenftig(nr).startsWith('✓ unverändert (') && kuenftig(nr).includes('`main/index.ts`') && gebunden(nr, 'main/index.ts')),
    'SD Funktionsliste: Fensterhülle, Zustand, Verbindungen, mDNS, Show, Ausgabe, IPC, Start und Ende im Main sind unverändert bis auf die mDNS-Übernahme; die Zeilen tragen den Verweis Altfehler SD-3 (K3)',
  );
  ok(
    [46, 88].every((nr) => kuenftig(nr).startsWith('✓ unverändert (') && kuenftig(nr).includes('`main/config.ts`') && gebunden(nr, 'main/config.ts')),
    'SD Funktionsliste Nr. 46, 88: die Konfigurationsdatei liest und schreibt main/config.ts weiter wie bisher; die Zeilen tragen den Verweis Altfehler SD-1 (G4)',
  );
  ok(
    [54, 55, 56].every((nr) => kuenftig(nr).startsWith('✓ unverändert (') && /main\/(timer|switcher|presenter)-client\.ts/.test(kuenftig(nr))) && [49, 51].every((nr) => kuenftig(nr).startsWith('✓ unverändert (')),
    'SD Funktionsliste Nr. 49/51/54–56: Store, Bildtakt und die drei Clients sind unverändert',
  );
}

// ── Abschnitt 5: Ausgabefenster und StageScreen unverändert, Test nachricht.test.tsx bleibt ──
{
  ok(
    [41, 42, 72, 73, 74, 75, 76, 77, 78].every((nr) => kuenftig(nr).startsWith('✓ unverändert (`components/StageScreen.tsx`')) &&
      !GEAENDERT_KANON.has('apps/stage-display/src/renderer/src/components/StageScreen.tsx') &&
      !GEAENDERT_KANON.has('apps/stage-display/src/renderer/src/lib/nachricht.ts') &&
      !GEAENDERT_KANON.has('apps/stage-display/src/renderer/src/views/StageOutputView.tsx') &&
      !GEAENDERT_KANON.has('apps/stage-display/src/renderer/src/store/stage.ts'),
    'SD Funktionsliste Nr. 41/42/72–78: StageScreen und die Nachricht-Regel (components/StageScreen.tsx, lib/nachricht.ts) sind unverändert',
  );
  ok([70, 71].every((nr) => kuenftig(nr).startsWith('✓ unverändert (`views/StageOutputView.tsx`')), 'SD Funktionsliste Nr. 70/71: das Ausgabefenster (views/StageOutputView.tsx) ist unverändert, ohne AppShell');
  ok(kuenftig(79).startsWith('✓ unverändert (') && kuenftig(79).includes('`apps/stage-display/test/nachricht.test.tsx`'), 'SD Funktionsliste Nr. 79: test/nachricht.test.tsx bleibt');
}

// ── Gemerkte Zustände: kein localStorage, alles in der Konfigurationsdatei des Main ──
{
  ok(
    !wurzel.includes('localStorage') && !panel.includes('localStorage') && !live.includes('localStorage') && !akt.includes('localStorage'),
    'SD Funktionsliste Nr. 107/108 (App-Quelltext): die Oberfläche der App merkt nichts selbst, alle Werte liegen weiter in der Konfigurationsdatei des Main',
  );
  ok(
    ['jm-theme', 'E5'].every((w) => kuenftig(108).includes(w)) && kuenftig(108).includes('`packages/ui/src/lib/theme.ts`') && quelle('packages/ui/src/lib/theme.ts').includes("'jm-theme'"),
    'SD Funktionsliste Nr. 108: der Haken nennt die Ausnahme Hell/Dunkel im gemeinsamen Kopf (jm-theme in localStorage, E5)',
  );
  const typen = quelle('shared/types.ts');
  ok(
    ['outputDisplayId', 'message', 'widgets', 'presenter', 'switcher', 'timer'].every((f) => typen.includes(f)) && [88, 89, 90, 91, 92, 93, 94, 95, 96, 97].every((nr) => kuenftig(nr).includes('`main/config.ts`') || beginnt(nr, 'Panel')),
    'SD Funktionsliste Nr. 88–99: alle gemerkten Konfigurationsfelder gibt es weiter',
  );
  ok(beginnt(107, 'Rahmen') && kuenftig(107).includes('Panel'), 'SD Funktionsliste Nr. 107: der Panelzustand wird weiter nicht gemerkt (Rahmen)');
}

// ── Kein window.confirm und kein window.alert im Renderer ──
{
  const dateien = ['App.tsx', 'views/StageOberflaeche.tsx', 'views/LiveBereich.tsx', 'views/Einstellungen.tsx', 'views/StageOutputView.tsx', 'lib/aktionen.ts', 'lib/oberflaeche.ts', 'lib/bruecken.ts'];
  ok(dateien.every((d) => !/\bwindow\.(?:confirm|alert)\(/.test(quelle(d))), 'SD Funktionsliste: weiter kein window.confirm und kein window.alert im Renderer');
}

// ── 2a-Nachzug in Welle 2b (Task 5): gemessener Ort im Ausgabe-Abschnitt statt der Zeile „Lage“, Bildschirmliste folgt dem
// Bildschirm-Ereignis; kein Steuerserver, neu im Main und Preload nur das lesende Ereignis ──
{
  const main = quelle('main/index.ts');
  const preload = quelle('preload/index.ts');
  ok(
    ['Steht auf', 'measuredId', 'folgeBildschirmen', 'output:bildschirme'].every((w) => kuenftig(7).includes(w)) &&
      !kuenftig(7).includes('Bühnenschirm: offen') &&
      !panel.includes('gemesseneLage') &&
      !panel.includes('data-stage="lage"') &&
      obf.includes('measuredId') &&
      !obf.includes('gemesseneLage'),
    'SD Funktionsliste Nachzug Nr. 7: der Ausgabe-Abschnitt nennt den gemessenen Ort („Steht auf“, measuredId), die Liste folgt output:bildschirme; die Zeile „Lage“ entfällt',
  );
  ok(
    kuenftig(48).includes('folgeBildschirmen') && kuenftig(48).includes('`lib/aktionen.ts`') && kuenftig(84).includes('folgeBildschirmen') && wurzel.includes('folgeBildschirmen(window.jmstage?.output?.onBildschirme'),
    'SD Funktionsliste Nachzug Nr. 48/84: die Wurzel-View liest die Liste auch bei jedem Bildschirm-Ereignis (folgeBildschirmen)',
  );
  ok(
    ['beobachteBildschirme', 'output:bildschirme', '`packages/output-window/src/bildschirme.ts`', '2a-Nachzug'].every((w) => kuenftig(63).includes(w)) &&
      main.includes("mainWindow.webContents.send('output:bildschirme');") &&
      !kuenftig(63).includes('nur der lesende Kanal output:zustand'),
    'SD Funktionsliste Nachzug Nr. 63: der Main meldet angesteckte, abgezogene und geänderte Bildschirme über beobachteBildschirme (output:bildschirme)',
  );
  ok(
    ['output:bildschirme', 'onBildschirme'].every((w) => kuenftig(68).includes(w)) && /\bE2\b/.test(kuenftig(68)) && kuenftig(68).includes('Steuerserver') && preload.includes('onBildschirme'),
    'SD Funktionsliste Nachzug Nr. 68: weiter kein Steuerserver; im Preload neu nur die lesenden Brücken (Master-Link, Ausgabezustand, Bildschirm-Ereignis)',
  );
  // Jeder Haken, der sagt, die Datei bekäme „nur“ etwas Lesendes, nennt auch das Bildschirm-Ereignis.
  const alt = alle.filter((z) => /nur den lesenden Ausgabezustand \(E3\)(?! und das lesende Bildschirm-Ereignis)/.test(z.zellen[6]));
  const neu = alle.filter((z) => z.zellen[6].includes('nur den lesenden Ausgabezustand (E3) und das lesende Bildschirm-Ereignis'));
  ok(alt.length === 0 && neu.length >= 14, `SD Funktionsliste Nachzug: kein Haken sagt mehr, main/index.ts bekäme nur den Ausgabezustand (${alt.map((z) => z.nr).join(',') || 'keiner'}; mit Ereignis: ${neu.length})`);
  const synth = (k: string): Zeile => ({ abschnitt: 3, nr: 0, zellen: ['0', '', '', '', '', '', k] });
  ok(
    zeilenFehler(synth('✓ entfällt (x, B7)')) === null &&
      zeilenFehler(synth('✓ entfällt (x, B22)')) === null &&
      (zeilenFehler(synth('✓ entfällt (x, B23)')) ?? '').includes('Verweis außerhalb') &&
      (zeilenFehler(synth('✓ entfällt (x, B0)')) ?? '').includes('Verweis außerhalb') &&
      (zeilenFehler(synth('✓ entfällt (x, E17)')) ?? '').includes('Verweis außerhalb'),
    'SD Funktionsliste: Verweise B1–B22 und E1–E16 gelten, B0, B23 und E17 nicht',
  );
}

// ── Altfehler Stufe 2: mDNS nur bei der Vorgabe (SD-3); Abschnitt 10 behält die alten Sätze (Widerruf: alten Text stehen lassen) ──
{
  ok(
    [57, 58, 59, 60].every((nr) => gebunden(nr, 'main/index.ts') && gebunden(nr, 'shared/mdns.ts') && kuenftig(nr).includes('Vorgabe 127.0.0.1')) &&
      ['„nicht erreichbar“', 'Vorschläge', 'C5', 'Befund 3', '`mdnsUebernahme`', '`aufVorgabe`'].every((w) => kuenftig(57).includes(w)) &&
      [90, 91, 92, 93, 94, 95, 96, 97].every((nr) => kuenftig(nr).includes('Altfehler SD-3') && kuenftig(nr).includes('Vorgabe 127.0.0.1')) &&
      [43, 57, 58, 59, 60, 90, 91, 92, 93, 94, 95, 96, 97].every((nr) => kuenftig(nr).includes('ohne Host')) &&
      kuenftig(43).includes('nicht erreichbar') &&
      quelle('main/index.ts').includes('mdnsUebernahme(getConfig(),') &&
      quelle('shared/mdns.ts').includes("export const VORGABE_HOST = '127.0.0.1';") &&
      quelle('packages/settings/src/abschnitte/peers.ts').includes("zeileNichtErreichbar: 'nicht erreichbar'") &&
      obf.includes("eingerichtet: !aufVorgabe(q?.host ?? '')"),
    'SD Funktionsliste Nr. 43, 57–60, 90–97: die mDNS-Suche übernimmt nur auf der Vorgabe 127.0.0.1 oder ohne Host (Ruling R6), ein eingerichteter Host ohne Verbindung heißt „nicht erreichbar“ (Altfehler SD-3)',
  );
  const befund = (n: number): string => {
    const i = text.indexOf(`\n${n}. **`, text.indexOf('## 10 · '));
    const j = text.indexOf(`\n${n + 1}. **`, i + 1);
    return i < 0 ? '' : text.slice(i, j < 0 ? undefined : j);
  };
  ok(
    befund(1).includes('Die Nachricht ist live und gemerkt:') &&
      befund(1).includes('Altfehler Stufe 2 (SD-1):') &&
      befund(3).includes('mDNS überschreibt eingetragene Hosts:') &&
      befund(3).includes('Altfehler Stufe 2 (SD-3):') &&
      befund(5).includes('Presenter-PIN im Klartext:') &&
      befund(5).includes('Altfehler Stufe 2 (SD-5):'),
    'SD Funktionsliste Abschnitt 10: Befund 1, 3 und 5 behalten den alten Satz, dahinter steht der Satz der Altfehler-Stufe 2 (SD-1, SD-3, SD-5)',
  );
}
