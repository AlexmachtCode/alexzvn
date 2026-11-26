// ─────────────────────────────────────────────────────────────────────────────
// Funktionsliste nach dem Umbau (UX Welle 2a, Caption e; Spec 10 „Kein Funktionsverlust“). Jede der 116 Zeilen in den
// Abschnitten 1–7 von docs/ux/funktionslisten/caption.md ist in „künftig wo“ abgehakt: „✓ “ und ein Ort des Ortsregisters,
// „unverändert (…)“, „entfällt (…, E…)“ oder „ersetzt durch {Ort} (…, E…)“. E-Verweise nur auf E1–E16 dieses Plans. Jede
// genannte Datei existiert, Groß- und Kleinschreibung wie im Repo. Dazu Querprüfungen gegen den Code: die Änderungen der
// Aufgaben 24–26 (NDI-Lage, gemessener Zustand, Mikrofonfehler, Tastenfolge, Panel, Tokens, Kopf) stehen als Haken in den
// betroffenen Zeilen, und der Code trägt, was der Haken sagt.
// Läuft im Paketordner apps/caption (npm run selftest -w @jm/caption).
// „unverändert (…)“ darf keine Datei nennen, die seit der Erhebung (d7cdd79ce0) geändert wurde, außer sie bekam nur die lesenden
// Brücken (E2) oder die gemessene NDI-Lage (E8): dann steht der Hinweis im Haken; oder ein Altfehler der Stufe 2 hat sie geändert:
// dann steht „Altfehler <ID>“ im Haken, und die Liste der ID in ALTFEHLER nennt die Datei (C8, R6). Der Abgleich der statischen
// Liste GEAENDERT mit git läuft nur mit JM_FUNKTIONSLISTE_GIT=1 (Arbeitsbaum gegen die Erhebung, damit auch eine noch nicht
// eingecheckte, aber gestagte Datei zählt).
// ─────────────────────────────────────────────────────────────────────────────

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { gleich, leseText, ok } from '@jm/ui/testhilfe';

const LISTE = '../../docs/ux/funktionslisten/caption.md';

/**
 * Ortsregister: Rahmen, Kopf, Live-Bereich (Live-Zeile, Vorschau, Verlauf, Haupttasten, Pegel), Statusleiste, Panel je
 * Abschnitt, NDI-Bild (der Bildweg des Senders, unverändert). Der Main und das Unveränderte stehen als „unverändert (…)“
 * (Caption hat keinen Tray).
 */
const ABSCHNITTE = ['NDI-Ausgabe', 'Audiogerät', 'Fernsteuerung', 'Erkennung', 'Darstellung'];
const ORTE: readonly string[] = [
  'Rahmen',
  'Kopf',
  'Live-Bereich',
  'Live-Bereich Live-Zeile',
  'Live-Bereich Vorschau',
  'Live-Bereich Verlauf',
  'Live-Bereich Haupttasten',
  'Live-Bereich Pegel',
  'Statusleiste',
  'Panel',
  ...ABSCHNITTE.map((a) => `Panel ${a}`),
  'NDI-Bild',
];

/** Zeilen insgesamt und je Abschnitt 1–7, wie die Liste im Kopf sie nennt (Stand 742f0927d4). */
const GESAMT = 116;
const JE_ABSCHNITT = [38, 9, 49, 0, 1, 7, 12];

const ERHEBUNG = 'd7cdd79ce0';

/**
 * Alle Dateien von apps/caption, die seit der Erhebung geändert, angelegt oder gelöscht wurden, als Pfad ab der Repo-Wurzel. Ein
 * „unverändert (…)“ darf sie nur nennen, wenn der Haken E2 oder E8 nennt und die Datei nur die lesenden Brücken bzw. die gemessene
 * NDI-Lage bekam (NUR_MELDUNG). Mit JM_FUNKTIONSLISTE_GIT=1 prüft der Test unten, dass git dieselbe Menge kennt.
 */
const GEAENDERT = [
  'package.json',
  'src/main/control-server.ts',
  'src/main/index.ts',
  'src/main/ndi/sender-process.ts',
  'src/main/ndi/wachhund.ts',
  'src/preload/index.ts',
  'src/renderer/src/App.tsx',
  'src/renderer/src/globals.css',
  'src/renderer/src/lib/aktionen.ts',
  'src/renderer/src/lib/bruecken.ts',
  'src/renderer/src/lib/ndi-engine.ts',
  'src/renderer/src/lib/oberflaeche.ts',
  'src/renderer/src/store/useCaption.ts',
  'src/renderer/src/views/CaptionOberflaeche.tsx',
  'src/renderer/src/views/Einstellungen.tsx',
  'src/renderer/src/views/LiveBereich.tsx',
  'src/shared/fernsteuerung.ts',
  'src/shared/types.ts',
  'src/shared/zeilen.ts',
  'test/ui/altfehler.test.ts',
  'test/ui/bruecken.test.ts',
  'test/ui/funktionsliste.test.ts',
  'test/ui/hilfe.ts',
  'test/ui/live.test.tsx',
  'test/ui/ndi.test.ts',
  'test/ui/oberflaeche.test.ts',
  'test/ui/panel.test.tsx',
  'test/ui/rahmen.test.tsx',
  'test/ui/selftest.ts',
  'test/ui/testzustand.ts',
  'test/ui/werkzeug.test.tsx',
  'tsconfig.test.json',
].map((p) => `apps/caption/${p}`);

/**
 * Dateien, die nur die lesenden Brücken (E2) oder die gemessene NDI-Lage (E8) bekamen: der Steuerserver und der Sender-Start.
 * Verhalten und Befehle blieben, bis auf die zwei Folgen von E8 für `ndi` und `connections` (Nr. 82, 83, 95). Seit der
 * Altfehler-Stufe 2 bekamen main/index.ts (CA-4: Zähler der Leerungen; CA-5: caption:correctLine), preload/index.ts (CA-5) und
 * shared/types.ts (CA-4, CA-5) mehr; sie stehen darum nicht mehr hier, ein Haken braucht für sie den Verweis auf den Altfehler (K3).
 */
const NUR_MELDUNG = new Set(['apps/caption/src/main/control-server.ts', 'apps/caption/src/main/ndi/sender-process.ts']);

/**
 * Altfehler Stufe 2 (Plan 2026-11-26, Task 4; C8): je erlaubter Caption-ID die Dateien (ab der Repo-Wurzel), die der Befund geändert
 * hat, wie im Player (Ruling R6). „Altfehler <ID>“ im Haken entlastet ein „unverändert (…)“ oder „NDI-Bild (…)“, das eine geänderte
 * Datei nennt, nur, wenn die Liste dieser ID die Datei enthält; dann für die ganze Änderung des Befunds, nicht nur für lesende
 * Brücken. Erlaubt sind genau die Caption-IDs CA-1 (Mikrofonfehler stoppt), CA-4 (Leeren leert NDI auch bei Hold) und CA-5
 * (Korrektur trifft die Zeile per Kennung, G8: auch die Wurzel-View).
 */
const APP = (p: string): string => `apps/caption/src/${p}`;
const RENDERER = (p: string): string => `apps/caption/src/renderer/src/${p}`;
const ALTFEHLER = new Map<string, readonly string[]>([
  ['CA-1', [RENDERER('lib/aktionen.ts'), RENDERER('views/CaptionOberflaeche.tsx')]],
  ['CA-4', [APP('shared/types.ts'), APP('main/index.ts'), RENDERER('lib/ndi-engine.ts'), RENDERER('views/CaptionOberflaeche.tsx')]],
  [
    'CA-5',
    [
      APP('shared/zeilen.ts'),
      APP('shared/types.ts'),
      APP('main/index.ts'),
      APP('preload/index.ts'),
      RENDERER('store/useCaption.ts'),
      RENDERER('lib/aktionen.ts'),
      RENDERER('views/LiveBereich.tsx'),
      RENDERER('views/CaptionOberflaeche.tsx'),
    ],
  ],
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
if (GIT_PRUEFEN && GIT === null) console.log(`CA Funktionsliste: kein git-Verlauf bis ${ERHEBUNG} (flacher Klon); die Prüfung gegen git entfällt`);

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

/** Pfadregel der Liste: Repo-Wurzel, apps/caption/src (main, preload, shared, utility, renderer) oder der Renderer. */
function aufgeloest(pfad: string): string {
  if (/^(?:apps|packages|docs)\//.test(pfad)) return `../../${pfad}`;
  if (/^(?:main|preload|shared|utility|renderer)\//.test(pfad)) return `src/${pfad}`;
  return `src/renderer/src/${pfad}`;
}

/** Kanonischer Pfad ab der Repo-Wurzel nach der Pfadregel der Liste. */
function kanon(pfad: string): string {
  const a = aufgeloest(pfad);
  return a.startsWith('../../') ? a.slice('../../'.length) : `apps/caption/${a}`;
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
  else form = ortAm(rest) === 'NDI-Bild' ? 'NDI-Bild' : ortAm(rest);
  if (form === undefined) return `Ort nicht aus dem Ortsregister: ${rest.slice(0, 40)}`;
  if (form === 'ersetzt durch' && !VERWEIS.test(ohneCode)) return '„ersetzt durch“ ohne E-Verweis';
  if (form === 'entfällt' && !VERWEIS.test(ohneCode)) return '„entfällt“ ohne E-Verweis';
  const pfade = [...k.matchAll(PFAD)].map((m) => m[1]);
  if (form !== 'entfällt' && pfade.length === 0) return 'Ort ohne Datei';
  const fehlt = pfade.filter((p) => !gibtEs(p));
  if (fehlt.length > 0) return `Datei fehlt: ${fehlt.join(', ')}`;
  // „unverändert“ und der Bildweg nennen nur Dateien, die seit der Erhebung unverändert sind; Dateien mit nur den lesenden
  // Brücken (E2) oder der gemessenen NDI-Lage (E8) mit Hinweis, Dateien, die ein Altfehler der Stufe 2 geändert hat, mit dem
  // Verweis „Altfehler <ID>“, dessen Liste sie nennt (R6).
  if (form === 'unverändert' || form === 'NDI-Bild') {
    const ids = altfehlerIds(ohneCode);
    const offen = pfade.filter((p) => (GEAENDERT_KANON.has(kanon(p)) || GIT?.has(kanon(p)) === true) && !entlastet(ids, kanon(p)));
    if (offen.length > 0 && !/\bE[28]\b/.test(ohneCode)) return `unverändert mit geänderter Datei (${offen.join(', ')}) ohne Hinweis auf E2 oder E8 und ohne Altfehler-Verweis, dessen Liste sie nennt`;
    if (offen.some((p) => !NUR_MELDUNG.has(kanon(p)))) return `unverändert mit einer Datei, die mehr als die lesenden Brücken und die NDI-Lage bekam (${offen.join(', ')})`;
  }
  return null;
}

const text = leseText(LISTE);
const alle = zeilen(text);

gleich(alle.length, GESAMT, 'CA Funktionsliste: 116 Zeilen in den Abschnitten 1–7 (Stand der Erhebung)');
gleich(
  JE_ABSCHNITT.map((_, i) => alle.filter((z) => z.abschnitt === i + 1).length),
  JE_ABSCHNITT,
  'CA Funktionsliste: Zeilen je Abschnitt wie in der Erhebung (38/9/49/0/1/7/12)',
);
gleich(
  alle.map((z) => z.nr),
  alle.map((_, i) => i + 1),
  'CA Funktionsliste: Nummern fortlaufend ab 1',
);
ok(!text.replace(/`[^`]*`/g, '').includes('"') && !text.includes('\r'), 'CA Funktionsliste: keine ASCII-Anführungszeichen außerhalb von Code, kein CR');

for (const z of alle) {
  const f = zeilenFehler(z);
  ok(f === null, `CA Funktionsliste Nr. ${z.nr} abgehakt${f === null ? '' : ` – ${f}`}`);
}

// ── Die Menge der geänderten Dateien stimmt mit git überein (nur mit JM_FUNKTIONSLISTE_GIT=1 und Verlauf) ──
{
  if (GIT !== null) {
    const fehlend = [...GIT].filter((n) => n.startsWith('apps/caption/') && !GEAENDERT_KANON.has(n));
    ok(fehlend.length === 0, `CA Funktionsliste: GEAENDERT nennt alle seit ${ERHEBUNG} geänderten Dateien von apps/caption (fehlt: ${fehlend.join(', ') || 'nichts'})`);
    const zuviel = GEAENDERT.filter((n) => !GIT.has(n));
    ok(zuviel.length === 0, `CA Funktionsliste: GEAENDERT nennt keine Datei, die git nicht als geändert kennt (zu viel: ${zuviel.join(', ') || 'nichts'})`);
    const zitiert = alle
      .filter((z) => z.zellen[6].startsWith('✓ unverändert (') || z.zellen[6].startsWith('✓ NDI-Bild'))
      .flatMap((z) => {
        const ids = altfehlerIds(z.zellen[6].replace(/`[^`]*`/g, ''));
        return [...z.zellen[6].matchAll(PFAD)].map((m) => kanon(m[1])).filter((n) => !entlastet(ids, n));
      });
    const getroffen = zitiert.filter((n) => GIT.has(n));
    ok(getroffen.every((n) => NUR_MELDUNG.has(n)), `CA Funktionsliste: keine in einem unverändert-Haken zitierte Datei bekam mehr als die lesenden Brücken und die NDI-Lage, außer ein Altfehler-Verweis nennt sie in seiner Liste (${getroffen.join(', ') || 'keine'})`);
    const pakete = ['packages/suite-control-protocol/src/capabilities.ts', 'packages/show/src/index.ts'];
    ok(pakete.every((p) => !GIT.has(p)), 'CA Funktionsliste: die zitierten Pakete (capabilities.ts, Freigabeliste der Show) sind seit der Erhebung unverändert');
    const listen = [...ALTFEHLER.values()].flat();
    ok(listen.every((n) => GIT.has(n)), `CA Funktionsliste: jede Datei einer Altfehler-Liste ist laut git geändert (nicht: ${listen.filter((n) => !GIT.has(n)).join(', ') || 'nichts'})`);
  }
  // Jede Datei einer Altfehler-Liste steht in GEAENDERT: eine Liste entlastet nur, was wirklich geändert ist.
  {
    const listen = [...ALTFEHLER.values()].flat();
    ok(
      listen.length > 0 && listen.every((n) => GEAENDERT_KANON.has(n)),
      `CA Funktionsliste: jede Datei einer Altfehler-Liste steht in GEAENDERT (nicht: ${listen.filter((n) => !GEAENDERT_KANON.has(n)).join(', ') || 'nichts'})`,
    );
  }
  // Negativprobe: andere Schreibweisen derselben geänderten Datei werden erkannt, eine unveränderte nicht.
  const synth = (pfad: string, zusatz = ''): Zeile => ({ abschnitt: 3, nr: 0, zellen: ['0', '', '', '', '', '', `✓ unverändert (\`${pfad}\`): x${zusatz}`] });
  const synthBild = (pfad: string, zusatz = ''): Zeile => ({ abschnitt: 3, nr: 0, zellen: ['0', '', '', '', '', '', `✓ NDI-Bild (\`${pfad}\`): x${zusatz}`] });
  ok(
    ['views/LiveBereich.tsx', 'renderer/src/views/LiveBereich.tsx', 'apps/caption/src/renderer/src/views/LiveBereich.tsx'].every((p) => (zeilenFehler(synth(p)) ?? '').includes('geänderter Datei')) &&
      (zeilenFehler(synth('views/LiveBereich.tsx', ' (E2)')) ?? '').includes('mehr als die lesenden Brücken') &&
      zeilenFehler(synth('main/control-server.ts', ' (E2)')) === null &&
      zeilenFehler(synth('main/ndi/sender-process.ts', ' (E8)')) === null &&
      (zeilenFehler(synth('main/ndi/wachhund.ts', ' (E8)')) ?? '').includes('mehr als die lesenden Brücken') &&
      zeilenFehler(synth('main/transcriber.ts')) === null,
    'CA Funktionsliste: eine geänderte Datei wird in jeder Schreibweise erkannt; E2 und E8 entlasten nur Dateien mit den lesenden Brücken bzw. der NDI-Lage; eine unveränderte Datei ist frei',
  );
  // Der Verweis „Altfehler <ID>“ (Stufe 2, C8) entlastet eine geänderte Datei nur, wenn die Liste der ID sie nennt (R6); nur mit dem
  // Wort „Altfehler“ und nur die drei Caption-IDs. main/index.ts, preload/index.ts und shared/types.ts verlassen NUR_MELDUNG (K3):
  // E2 oder E8 allein entlasten sie nicht mehr.
  ok(
    (zeilenFehler(synth('lib/ndi-engine.ts')) ?? '').includes('geänderter Datei') &&
      zeilenFehler(synth('lib/ndi-engine.ts', ' (Altfehler CA-4)')) === null &&
      (zeilenFehler(synth('lib/ndi-engine.ts', ' (Altfehler CA-5)')) ?? '').includes('geänderter Datei') &&
      (zeilenFehler(synth('lib/ndi-engine.ts', ' (Altfehler CA-1)')) ?? '').includes('geänderter Datei') &&
      (zeilenFehler(synth('lib/ndi-engine.ts', ' (CA-4)')) ?? '').includes('geänderter Datei') &&
      ['CA-10', 'CA-11', 'CA-1a', 'CA-1-b', 'CA-40', 'CA-8', 'CA-2', 'IN-3', 'SD-1', 'PL-N', 'SC-S2'].every((id) => (zeilenFehler(synth('lib/ndi-engine.ts', ` (Altfehler ${id})`)) ?? '').includes('geänderter Datei')) &&
      (zeilenFehler(synth('main/index.ts', ' (E8)')) ?? '').includes('mehr als die lesenden Brücken') &&
      zeilenFehler(synth('main/index.ts', ' (E8, Altfehler CA-4)')) === null &&
      zeilenFehler(synth('main/index.ts', ' (Altfehler CA-5)')) === null &&
      (zeilenFehler(synth('main/index.ts', ' (E8, Altfehler CA-1)')) ?? '').includes('mehr als die lesenden Brücken') &&
      (zeilenFehler(synth('preload/index.ts', ' (E2)')) ?? '').includes('mehr als die lesenden Brücken') &&
      zeilenFehler(synth('preload/index.ts', ' (E2, Altfehler CA-5)')) === null &&
      (zeilenFehler(synth('preload/index.ts', ' (Altfehler CA-4)')) ?? '').includes('geänderter Datei') &&
      (zeilenFehler(synth('shared/types.ts', ' (E2)')) ?? '').includes('mehr als die lesenden Brücken') &&
      zeilenFehler(synth('shared/types.ts', ' (Altfehler CA-4)')) === null &&
      zeilenFehler(synth('apps/caption/src/shared/types.ts', ' (Altfehler CA-5)')) === null &&
      zeilenFehler(synth('store/useCaption.ts', ' (Altfehler CA-5)')) === null &&
      (zeilenFehler(synth('store/useCaption.ts', ' (Altfehler CA-4)')) ?? '').includes('geänderter Datei') &&
      zeilenFehler(synth('views/CaptionOberflaeche.tsx', ' (Altfehler CA-1)')) === null &&
      (zeilenFehler(synthBild('lib/ndi-engine.ts')) ?? '').includes('geänderter Datei') &&
      zeilenFehler(synthBild('lib/ndi-engine.ts', ' (Altfehler CA-4)')) === null,
    'CA Funktionsliste: „Altfehler CA-4“ entlastet lib/ndi-engine.ts im unverändert- und im NDI-Bild-Haken; ohne ID, mit der ID eines anderen Befunds, ohne das Wort „Altfehler“ oder mit einer fremden ID nicht; main/index.ts, preload/index.ts und shared/types.ts brauchen ihren Altfehler-Verweis (K3)',
  );
  // Negativprobe R6: nennt ein Haken zwei geänderte Dateien, entlastet die ID nur die aus ihrer Liste.
  ok(
    /geänderter Datei \(store\/useCaption\.ts\)/.test(zeilenFehler(synth('lib/ndi-engine.ts', ' und `store/useCaption.ts` (Altfehler CA-4)')) ?? '') &&
      zeilenFehler(synth('lib/ndi-engine.ts', ' und `store/useCaption.ts` (Altfehler CA-4, Altfehler CA-5)')) === null &&
      (zeilenFehler(synth('views/LiveBereich.tsx', ' (Altfehler CA-1)')) ?? '').includes('geänderter Datei') &&
      (zeilenFehler(synth('views/Einstellungen.tsx', ' (Altfehler CA-5)')) ?? '').includes('geänderter Datei'),
    'CA Funktionsliste: eine geänderte Datei mit einer Altfehler-ID, deren Liste sie nicht nennt, wird gemeldet (R6)',
  );
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

const wurzel = quelle('views/CaptionOberflaeche.tsx');
const panel = quelle('views/Einstellungen.tsx');
const live = quelle('views/LiveBereich.tsx');
const obf = quelle('lib/oberflaeche.ts');
const akt = quelle('lib/aktionen.ts');
const brk = quelle('lib/bruecken.ts');
const app = quelle('App.tsx');
const store = quelle('store/useCaption.ts');
const motor = quelle('lib/ndi-engine.ts');
const hauptIndex = quelle('main/index.ts');
const sender = quelle('main/ndi/sender-process.ts');
const wach = quelle('main/ndi/wachhund.ts');
const ctl = quelle('main/control-server.ts');
const css = quelle('globals.css');
/** Beginn des JSX der Wurzel-View: alles Vorherige läuft vor jeder Bedingung. */
const RUECKGABE = '\n  return (\n';

// ── Rahmen, Kopf (Nr. 1–4): AppShell, Name nach E16, Hell/Dunkel nach E5 ──
ok(
  beginnt(1, 'Rahmen') && wurzel.includes('<AppShell') && wurzel.includes('status={statusLeiste(stand)}') && wurzel.includes('settings={<Einstellungen') && nennt(1, 'E15', 'Vorschau', 'Canvas') &&
    !/useRouter|<Route/.test(wurzel) && /return <CaptionOberflaeche \/>;/.test(app) && !/key=\{/.test(ohneKommentar(wurzel + app)),
  'CA Funktionsliste Nr. 1: Aufbau im AppShell (Kopf, Inhalt, Statusleiste, Panel), eine Ansicht, App.tsx zeigt die Wurzel-View ohne Bedingung und ohne key',
);
ok(
  wurzel.indexOf('useCaptionNdiEngine(cfg ?? FALLBACK_CFG') > 0 && wurzel.indexOf('useCaptionNdiEngine(cfg ?? FALLBACK_CFG') < wurzel.indexOf(RUECKGABE) &&
    wurzel.indexOf('startCapture(') < wurzel.indexOf(RUECKGABE) && /<canvas ref=\{previewRef\}/.test(live) && !/(?:&&|\?)\s*\(?\s*<canvas/.test(live),
  'CA Funktionsliste Nr. 1: die Engine und die Aufnahme-Effekte laufen vor jeder Bedingung in der Wurzel-View, das Vorschau-Canvas steht ohne Bedingung im JSX (Befund 14)',
);
ok(
  unveraendert(2) && nennt(2, '`main/index.ts`', '`renderer/index.html`', 'E2', 'E8') && gebunden(2, 'main/index.ts') && quelle('renderer/index.html').includes('class="dark"') &&
    hauptIndex.includes('backgroundThrottling: false') && hauptIndex.includes('width: 1100') && hauptIndex.includes('requestSingleInstanceLock'),
  'CA Funktionsliste Nr. 2: die Fensterhülle bleibt (main/index.ts bekam die lesenden Brücken und die NDI-Lage, E2, E8, dazu Altfehler CA-4 und CA-5), index.html behält class="dark"',
);
ok(
  ersetzt(3, 'Kopf') && nennt(3, 'E16', 'JM Caption', 'Untertitel', 'Nr. 5 bis 8', 'Nr. 9 bis 11') && wurzel.includes('tool="Caption"') && !/subtitle|untertitel=/i.test(ohneKommentar(wurzel)),
  'CA Funktionsliste Nr. 3: Logo und „JM Caption“ kommen aus dem gemeinsamen Kopf; Caption hatte keinen Untertitel, es gibt auch keinen (E16)',
);
ok(
  ersetzt(4, 'Kopf') && nennt(4, 'E5', 'jm-theme', '`packages/ui/src/lib/theme.ts`') && !/classList|setTheme|localStorage/.test(ohneKommentar(wurzel + live + panel)) && quelle('packages/ui/src/lib/theme.ts').includes("'jm-theme'"),
  'CA Funktionsliste Nr. 4: Hell/Dunkel ist der ThemeToggle im gemeinsamen Kopf (E5, jm-theme); Caption hatte keinen Schalter',
);

// ── Panel Erkennung und Audiogerät (Nr. 5–8, 21–23): dieselben Store-Aktionen, Wahl wirkt sofort wie heute ──
ok(
  von([5, 6, 21, 22, 23], (nr) => beginnt(nr, 'Panel Erkennung') && nennt(nr, '`views/Einstellungen.tsx`')) && nennt(5, 'nicht verfügbar', 'nächste') &&
    panel.includes('aktionen.konfigurieren({ model: v as WhisperModelId })') && panel.includes('aktionen.konfigurieren({ language: v })') && panel.includes("aktionen.konfigurieren({ engine: v as CaptionConfig['engine'] })") &&
    panel.includes('aktionen.konfigurieren({ dictionary: e.target.value })') && panel.includes('aktionen.konfigurieren({ maxUtteranceSec: Number(e.target.value) })') &&
    akt.includes('konfigurieren: (patch) => void store.setConfig(patch)') && MODELLE_WIE_BISHER(),
  'CA Funktionsliste Nr. 5, 6, 21–23: Modell, Sprache, Engine, Wörterbuch und Max. Äußerung stehen im Panel Erkennung und rufen setConfig mit demselben Teil wie bisher',
);
function MODELLE_WIE_BISHER(): boolean {
  return ["id: 'tiny', label: 'Tiny (schnell)'", "id: 'large-v3', label: 'Large v3 (genau)'", "label: 'Auto-Erkennung'", "label: 'Server (schnell, Modell bleibt geladen)'", "label: 'CLI (pro Äußerung)'"].every((w) => obf.includes(w));
}
ok(
  beginnt(7, 'Panel Audiogerät') && nennt(7, 'Audio-Eingang (Mikrofon)', 'System-Standard (Mikrofon)', 'Audiogerät n', 'sofort', 'Nr. 60', 'Gerät nicht gefunden') && obf.includes("direction: 'input'") &&
    obf.includes('defaultLabel: CAPTION_TEXTE.mikrofon.standard') && akt.includes('geraetWaehlen: (id) => void store.setConfig({ audioInputDeviceId: id })') && panel.includes('<AudioDeviceSection {...mikrofonAbschnitt(stand, aktionen)} />') &&
    obf.includes("mikrofon: { titel: 'Mikrofon', wahl: 'Audio-Eingang (Mikrofon)', standard: 'System-Standard (Mikrofon)'"),
  'CA Funktionsliste Nr. 7: die Eingangswahl steht im Panel Audiogerät mit dem alten Wortlaut, wirkt sofort wie heute und ruft setConfig({ audioInputDeviceId })',
);
ok(
  beginnt(8, 'Panel Audiogerät') && nennt(8, 'Geräte aktualisieren', '⟳', 'Audiogeräte aktualisieren') && obf.includes('capabilities: { level: true, refresh: true }') && obf.includes('onRefresh: () => a.geraeteAktualisieren()') &&
    panelAktionenRuft('geraeteAktualisieren') && !/Audiogeräte aktualisieren/.test(ohneKommentar(wurzel + panel + live + obf + akt)),
  'CA Funktionsliste Nr. 8: „⟳“ mit Tooltip „Audiogeräte aktualisieren“ ist der Knopf „Geräte aktualisieren“ im Panel Audiogerät und ruft refreshDevices der View',
);
function panelAktionenRuft(name: string): boolean {
  return akt.includes(`${name},`) && wurzel.includes('panelAktionen(store, cfg?.ndiName, refreshDevices)');
}

// ── Haupttasten (Nr. 9–12): Tastenfolge, Beschriftung ohne Symbole, live nur nach E4 ──
{
  const tasten = live.slice(live.indexOf('export function liveTasten'), live.indexOf('/** Breite des Pegelbalkens'));
  const nachNdi = tasten.indexOf('t.ndi');
  ok(
    von([9, 10, 11, 12], (nr) => beginnt(nr, 'Live-Bereich Haupttasten') && nennt(nr, '`views/LiveBereich.tsx`')) &&
      nachNdi > 0 && nachNdi < tasten.indexOf('t.start') && tasten.indexOf('t.start') < tasten.indexOf('t.hold') && tasten.indexOf('t.hold') < tasten.indexOf('t.leeren') &&
      live.includes('grid w-full max-w-[30rem] grid-cols-2 gap-3') && live.includes('<TallyButton key={i} {...k} />') &&
      nennt(12, 'links', 'oben') && nennt(9, 'rechts') && nennt(10, 'unten') && nennt(11, 'unten', 'rechts'),
    'CA Funktionsliste Nr. 9–12: vier TallyButtons im 2×2-Raster über der Live-Zeile, NDI oben links auf seinem alten Platz, Start/Stopp rechts daneben, Hold und Leeren darunter (Ruling Task 26)',
  );
}
ok(
  nennt(9, '●', '■', 'Symbole', 'E4', 'E9', 'Lädt …', 'Gelb') && obf.includes("taste: { start: 'Start', stopp: 'Stopp', hold: 'Hold', holdAn: 'Hold ✓', leeren: 'Leeren', ndiStarten: 'NDI starten', ndiAn: 'NDI an' }") &&
    obf.includes("start: c.running ? taste(T.taste.stopp, s.micError === null ? 'live' : 'bereit') : taste(T.taste.start, 'bereit')") &&
    live.includes('{ ...t.start, onClick: running ? a.stop : a.start }') && !/[●■○◉]/.test(ohneKommentar(live + obf + wurzel + panel)),
  'CA Funktionsliste Nr. 9: „Start“/„Stopp“ ohne Symbole, live nur ohne micError (E4, E9), Start bleibt bei micError bedienbar, ohne Gelbfüllung; vor der ersten Antwort gesperrt mit „Lädt …“',
);
ok(
  nennt(10, 'E7', 'Hold ✓', 'Nr. 75') && obf.includes("hold: taste(c.hold ? T.taste.holdAn : T.taste.hold, 'bereit')") && live.includes('{ ...t.hold, onClick: () => a.hold(!hold) }') && akt.includes('hold: (an) => void store.setHold(an)'),
  'CA Funktionsliste Nr. 10: „Hold“ ist bereit mit wechselnder Beschriftung (E7) und ruft setHold(!hold) wie bisher',
);
ok(
  nennt(11, 'ohne Rückfrage', 'Nr. 76') && obf.includes("leeren: taste(T.taste.leeren, 'bereit')") && live.includes('{ ...t.leeren, onClick: a.leeren }') && akt.includes('leeren: () => void store.clear()') && !/confirm|prompt/.test(live),
  'CA Funktionsliste Nr. 11: „Leeren“ bleibt ohne Rückfrage und ruft clear',
);
ok(
  nennt(12, 'E8', 'ndiSendet', 'Ausgabe', 'Panel NDI-Ausgabe', 'Befund 2') && obf.includes("ndi: taste(c.status.ndiActive ? T.taste.ndiAn : T.taste.ndiStarten, c.status.ndiSendet ? 'live' : 'bereit')") &&
    live.includes('{ ...t.ndi, onClick: ndiActive ? a.ndiStoppen : a.ndiStarten }') && akt.includes('ndiStarten: () => void store.ndiStart(ndiName)') && akt.includes('ndiSchalten: (next) => void (next ? store.ndiStart(ndiName) : store.ndiStop())') &&
    obf.includes('capabilities: { toggle: true, rename: true, resolution: true, fps: true }'),
  'CA Funktionsliste Nr. 12: „NDI“ ist live nur bei gemessenem ndiSendet (E8), ruft ndiStart(Quellname)/ndiStop wie bisher; der Schalter „Ausgabe“ im Panel NDI-Ausgabe ist ein zweiter Weg',
);
ok(
  nennt(10, 'Lädt …') && nennt(11, 'Lädt …') && nennt(12, 'Lädt …') && obf.includes('grund: { zustandOffen: \'Lädt …\' }') && /const g = T\.grund\.zustandOffen;/.test(obf) &&
    wurzel.includes('caption: state ?? undefined') && !/caption: [^\n]*FALLBACK_CFG/.test(wurzel),
  'CA Funktionsliste Nr. 9–12, 36: vor der ersten Antwort des Main ist caption undefined (nie FALLBACK_CFG), die vier Tasten sind gesperrt mit „Lädt …“',
);

// ── NDI-Ausgabe im Panel (Nr. 13–15, 19, 79, 103): Quellname bei Enter oder Verlassen, Auflösung, Bildrate, Empfänger ──
ok(
  beginnt(13, 'Panel NDI-Ausgabe') && nennt(13, 'Enter', 'Escape verwirft den angefangenen Entwurf', 'getrimmt', 'Quellenname', 'NDI-Quellname', 'Im Netz', 'E8') && panel.includes('<NdiOutputSection {...ndi} />') &&
    akt.includes('ndiName: (name) => void store.setConfig({ ndiName: name })') && obf.includes('onRename: (name) => a.ndiName(name)') &&
    quelle('packages/settings/src/entwurf.ts').includes("e.key === 'Escape' && schritt({ art: 'verwerfen' }).verbraucht") && quelle('packages/settings/src/entwurf.ts').includes("const neu = z.text.trim();"),
  'CA Funktionsliste Nr. 13: der Quellname übernimmt bei Enter oder Verlassen, getrimmt; Escape verwirft den Entwurf; der Hinweis „Im Netz: …“ zeigt den Namen des laufenden Senders',
);
ok(
  beginnt(14, 'Panel NDI-Ausgabe') && beginnt(15, 'Panel NDI-Ausgabe') && nennt(14, 'sofort', 'nicht verfügbar') && nennt(15, 'Bildrate', 'fps', '25, 30, 50, 60') &&
    obf.includes("{ id: '3840x2160', label: '2160p', w: 3840, h: 2160 }") && obf.includes('export const BILDRATEN = [25, 30, 50, 60] as const;') &&
    akt.includes('aufloesung: (w, h) => void store.setConfig({ ndiWidth: w, ndiHeight: h })') && akt.includes('bildrate: (fps) => void store.setConfig({ ndiFps: fps })'),
  'CA Funktionsliste Nr. 14, 15: Auflösung und Bildrate (früher „fps“) stehen im Panel NDI-Ausgabe, wirken sofort und rufen setConfig mit denselben Feldern',
);
ok(
  nennt(79, 'ndiNetzName', 'Im Netz', 'Befund 3', 'ndi on') && beginnt(79, 'Panel NDI-Ausgabe') && obf.includes('networkName: netz === \'\' ? undefined : (st?.ndiNetzName as string)') && obf.includes("const netz = st?.ndiActive === true ? (st.ndiNetzName ?? '').trim() : '';") &&
    hauptIndex.includes('const lauf = ndiLage.starte(netzName);') && wach.includes('this.name = name;') && wach.includes('this.name = null;'),
  'CA Funktionsliste Nr. 79: der Name, mit dem der Sender gestartet wurde (ndiNetzName), steht als „Im Netz: …“ im Panel; das Feld ändert weiter nicht den laufenden Sender',
);
ok(
  beginnt(19, 'Statusleiste') && nennt(19, 'E8', 'ndiSendet', 'n Empfänger', 'connections') && obf.includes('receivers: st?.ndiSendet === true ? st.connections : undefined') && obf.includes('v.status.state === \'ok\' && v.empfaenger !== undefined'),
  'CA Funktionsliste Nr. 19: „n Empfänger“ steht in der Statusleiste und im Panel und zählt nur bei gemessen sendendem Sender',
);

// ── Darstellung (Nr. 16–18, 101): native Felder wie bisher, Tokens ──
ok(
  von([16, 17, 18], (nr) => beginnt(nr, 'Panel Darstellung') && nennt(nr, '`views/Einstellungen.tsx`')) &&
    panel.includes('aktionen.konfigurieren({ ndiFontSize: Number(e.target.value) })') && panel.includes('min={16}') && panel.includes('max={160}') &&
    panel.includes('aktionen.konfigurieren({ ndiLines: Number(v) })') && panel.includes('aktionen.konfigurieren({ ndiBand: e.target.checked })') && obf.includes('export const NDI_ZEILEN = [1, 2, 3] as const;'),
  'CA Funktionsliste Nr. 16–18: Schrift, Zeilen und Band stehen im Panel Darstellung und rufen setConfig mit denselben Feldern wie bisher',
);
ok(
  von([16, 23, 101], (nr) => nennt(nr, 'Number(Wert)') && nennt(nr, 'leer')) && nennt(101, 'NumberInput', 'E13', 'klemmt') && (panel.match(/type="number"/g) ?? []).length === 2 && !/NumberInput/.test(panel),
  'CA Funktionsliste Nr. 16, 23, 101: die zwei Zahlenfelder bleiben native Felder ohne Klemmen und ohne Rundung (leeres Feld wird 0); kein NumberInput',
);
ok(
  ersetzt(20, 'Panel Erkennung') && nennt(20, 'showAdv', 'Erweitert') && !/Erweitert|showAdv/.test(ohneKommentar(wurzel + live + panel + obf)),
  'CA Funktionsliste Nr. 20: die Klappe „Erweitert“ entfällt, ihre drei Felder stehen ohne Klappe im Panel Erkennung',
);

// ── Hinweise, Live-Zeile, Vorschau, Pegel, Verlauf (Nr. 24–35, 61) ──
ok(
  beginnt(24, 'Live-Bereich') && nennt(24, 'whisperAvailable', '--status-warn', 'Statuseintrag') && live.includes('c !== undefined && !c.whisperAvailable') && live.includes('{T.whisper.fehltHinweis}') && obf.includes("fehltHinweis: 'whisper.cpp ist hier nicht gebündelt — Transkription läuft erst nach dem Office-Build (Binary + Modell).'") &&
    live.includes("HINWEIS_WARNUNG = 'border-[var(--status-warn)]/60"),
  'CA Funktionsliste Nr. 24: das whisper-Band ist ein Hinweis im Live-Bereich im alten Wortlaut, in der Warnfarbe aus der Variable, dazu der Statuseintrag Whisper',
);
ok(
  beginnt(25, 'Live-Bereich Haupttasten') && beginnt(61, 'Live-Bereich Haupttasten') && von([25, 61], (nr) => nennt(nr, 'E9', 'Mikrofon: ‹Meldung›', 'nie live')) && nennt(25, 'Ruling Task 25/26', 'nächsten erfolgreich') &&
    von([25, 61], (nr) => nennt(nr, 'Altfehler CA-1', 'running=0')) && nennt(61, '`mikrofonGescheitert`', 'nicht von selbst neu') && gebunden(61, 'views/CaptionOberflaeche.tsx') &&
    live.includes('{stand.micError !== null && (') && live.includes('T.live.mikrofonFehler(stand.micError)') && obf.includes('`Mikrofon: ${meldung}`') && obf.includes('error: s.micError ?? undefined') && wurzel.includes('setMicError(null)') &&
    wurzel.includes('.catch((e: unknown) => mikrofonGescheitert({ stop }, setMicError, e));') && akt.includes('export function mikrofonGescheitert(') && kopfOnAirOhneMic(),
  'CA Funktionsliste Nr. 25, 61: der Mikrofonfehler ist ein Statuseintrag und ein Text unter den Haupttasten (E9); Start bleibt bedienbar und ist nie live; er bleibt bis zum nächsten erfolgreichen Start; Altfehler CA-1: er beendet die Transkription (running=0), kein Neustart von selbst',
);
function kopfOnAirOhneMic(): boolean {
  return obf.includes('c.status.ndiSendet && c.running && s.micError === null');
}
ok(
  beginnt(26, 'Live-Bereich') && nennt(26, 'state.error', '--status-error', 'Statuseintrag') && live.includes('{c?.error ? (') && live.includes('{c.error}') && obf.includes("{ ...kopf, state: 'error', detail: c.error }"),
  'CA Funktionsliste Nr. 26: state.error steht im Live-Bereich und als Statuseintrag Fehler',
);
ok(
  beginnt(27, 'Live-Bereich Live-Zeile') && nennt(27, 'hold', 'Lädt …') && live.includes('{T.live.bereit}') && live.includes('text-3xl font-semibold') && !/hold/.test(live.slice(live.indexOf('data-caption="live-text"'), live.indexOf('data-caption="vorschau"'))),
  'CA Funktionsliste Nr. 27: die große Live-Zeile folgt hold weiter nicht; vor der ersten Antwort „Lädt …“',
);
ok(
  beginnt(28, 'Live-Bereich Vorschau') && nennt(28, '`globals.css`', 'ca-schachbrett', 'dunkel', 'Befund 14', 'eingefroren') && live.includes('ca-schachbrett') && css.includes('.ca-schachbrett') && css.includes('--brand-dark') && !/#[0-9a-fA-F]{3,8}\b/.test(css.slice(css.indexOf('.ca-schachbrett'))) &&
    live.includes('width={320} height={180}') && live.includes('{T.live.vorschau}') && live.includes('{T.live.eingefroren}'),
  'CA Funktionsliste Nr. 28: die Vorschau steht neben der Live-Zeile, das Schachbrett aus Tokens bleibt in Hell und Dunkel dunkel, die Zeichenfläche ist immer im DOM',
);
ok(
  von([29, 30, 31], (nr) => beginnt(nr, 'Live-Bereich Pegel')) && nennt(29, '--tally-ready', '--status-error', 'grün') && live.includes("prozent > 80 ? 'var(--status-error)' : 'var(--tally-ready)'") && live.includes('Math.min(100, Math.round((rms / 0.15) * 100))') &&
    live.includes('{T.whisper.arbeitet}') && live.includes('{T.live.zeilen(lines.length)}') && obf.includes("zeilen: (n: number) => `${n} Zeilen`") && nennt(31, 'Antwort'),
  'CA Funktionsliste Nr. 29–31: Pegelbalken (jetzt grün statt gelb, rot über 80 Prozent), „transkribiert …“ und „n Zeilen“ stehen in der Pegelzeile',
);
ok(
  von([32, 33, 34, 35], (nr) => beginnt(nr, 'Live-Bereich Verlauf')) && nennt(34, 'Escape', 'Befund 5', 'Altfehler CA-5', 'correctLine', 'bricht ab') && nennt(33, 'Altfehler CA-5') &&
    live.includes('.slice()') && live.includes('.reverse()') && live.includes('onDoubleClick={() => l.id === last?.id && aktionen.bearbeiten(l.id)}') &&
    live.includes('if (e.target.value !== l.text) aktionen.korrigieren(l.id, e.target.value);') && live.includes("if (e.key === 'Enter') (e.target as HTMLInputElement).blur();") &&
    /else if \(e\.key === 'Escape'\) \{\s*e\.preventDefault\(\);\s*e\.currentTarget\.value = l\.text;\s*aktionen\.bearbeiten\(null\);\s*\}/.test(ohneKommentar(live)) && live.includes('{T.live.keineZeilen}') &&
    akt.includes('korrigieren: (id, text) => void store.correctLine(id, text)') && store.includes('correctLine: async (id, text) => set({ state: await window.jmcaption.correctLine(id, text) }),') && !/correctLast/.test(ohneKommentar(akt + store + wurzel + live)),
  'CA Funktionsliste Nr. 32–35: der Verlauf, die Korrektur (Doppelklick auf die jüngste Zeile, Enter und Verlassen übernehmen) und „Noch keine Untertitel.“ stehen im Live-Bereich wie bisher; Altfehler CA-5: die Korrektur trifft die angeklickte Zeile per Kennung (correctLine), nur ein geänderter Text geht an den Main, Escape bricht ab',
);
ok(
  ersetzt(36, 'Rahmen') && nennt(36, 'E4', 'caption', 'undefined', 'FALLBACK_CFG', 'Lädt …', 'unbekannt') && store.includes('state: null') && !/FALLBACK/.test(store),
  'CA Funktionsliste Nr. 36: der Ladezustand „Lädt …“ ist der Rahmen mit gesperrten Tasten und unbekannten Einträgen; der Store hat keinen Vorgabewert',
);
ok(
  unveraendert(37) && nennt(37, 'ohne Bedienfläche', 'E2', 'E8') && !/silenceMs|silenceThreshold/.test(panel) && /silenceMs: number/.test(quelle('shared/types.ts')) && quelle('lib/capture.ts').includes('silenceThreshold'),
  'CA Funktionsliste Nr. 37: die Stille-Parameter bleiben ohne Bedienfläche, nicht im Panel',
);
{
  const roh = /\b(?:bg|text|border|ring|fill|stroke|from|to|via|divide|outline|accent|shadow|decoration|placeholder)-(?:neutral|red|green|yellow|white|black|amber|zinc|slate|gray|stone|orange|blue|sky|emerald|lime|rose)(?:-\d+)?(?:\/\d+)?\b/;
  const hex = /#[0-9a-fA-F]{3,8}\b/;
  const fl = ohneKommentar(wurzel + live + panel + obf + akt);
  ok(
    beginnt(38, 'Rahmen') && nennt(38, '63', '`lib/caption-cg.ts`', '`globals.css`', 'W2-9', 'Gelb', 'grün', 'Schachbrett') && !roh.test(fl) && !hex.test(fl) && quelle('lib/caption-cg.ts').includes('rgba(0,0,0,0.55)'),
    'CA Funktionsliste Nr. 38: die rohen Farben der Oberfläche sind Tokens (keine rohe Klasse, kein Hex in Views und Ableitungen), der Zeichner der NDI-Frames bleibt',
  );
}

// ── Dialoge, Meldungen, Texte (Nr. 39–47) ──
{
  const dateien = ['App.tsx', 'views/CaptionOberflaeche.tsx', 'views/LiveBereich.tsx', 'views/Einstellungen.tsx', 'lib/aktionen.ts', 'lib/oberflaeche.ts', 'lib/bruecken.ts', 'lib/capture.ts', 'lib/ndi-engine.ts', 'store/useCaption.ts'];
  ok(
    beginnt(39, 'Live-Bereich') && dateien.every((d) => !/\b(?:window\.)?(?:confirm|alert|prompt)\(/.test(ohneKommentar(quelle(d)))) && nennt(39, 'ohne Rückfrage'),
    'CA Funktionsliste Nr. 39: weder confirm noch alert noch prompt im Renderer; „Leeren“ und „Stopp“ bleiben ohne Rückfrage',
  );
}
ok(
  unveraendert(40) && nennt(40, '`main/index.ts`', 'media') && hauptIndex.includes('setPermissionRequestHandler') && hauptIndex.includes('setPermissionCheckHandler'),
  'CA Funktionsliste Nr. 40: die Mikrofon-Freigabe im Main bleibt',
);
ok(
  von([41, 42, 43, 44], (nr) => unveraendert(nr) && nennt(nr, '`main/transcriber.ts`')) && nennt(41, 'Statuseintrag') && !GEAENDERT_KANON.has('apps/caption/src/main/transcriber.ts') &&
    quelle('main/transcriber.ts').includes('whisper-CLI nicht gefunden — Binary + Modell werden im Office gebündelt.') && quelle('main/transcriber.ts').includes('whisper-server nicht verfügbar — nutze CLI.'),
  'CA Funktionsliste Nr. 41–44: die vier Fehlertexte bleiben im Main wörtlich; sie erscheinen im Live-Bereich und als Statuseintrag Fehler (Nr. 26)',
);
ok(
  unveraendert(45) && nennt(45, '`utility/ndi-sender.ts`', 'an (ohne Rückmeldung)', 'E8') && !GEAENDERT_KANON.has('apps/caption/src/utility/ndi-sender.ts'),
  'CA Funktionsliste Nr. 45: die Protokollzeilen bleiben; ein fehlgeschlagener NDI-Start bei lebendem Prozess zeigt in der Statusleiste „an (ohne Rückmeldung)“ als Warnung',
);
ok(
  beginnt(46, 'Live-Bereich Verlauf') && nennt(46, 'Doppelklick: letzte Zeile korrigieren', 'Audio-Eingang (Mikrofon)', 'Audiogeräte aktualisieren', 'Z1') && live.includes('title={l.id === last?.id ? T.live.korrigieren : undefined}') && obf.includes("korrigieren: 'Doppelklick: letzte Zeile korrigieren'"),
  'CA Funktionsliste Nr. 46: der Tooltip „Doppelklick: letzte Zeile korrigieren“ bleibt, die zwei anderen werden Beschriftungen bzw. entfallen (Z1)',
);
ok(
  beginnt(47, 'Rahmen') && nennt(47, 'NDI-Quellname', 'Lädt …', 'bereit', 'Noch keine Untertitel.') && obf.includes("bereit: '— bereit —'") && obf.includes("woerterbuchPlatzhalter: 'z. B.\\nJakobs Medien\\niveo\\nNITROVON'") && !/placeholder=["{]NDI-Quellname/.test(panel),
  'CA Funktionsliste Nr. 47: die Platzhaltertexte bleiben bis auf „NDI-Quellname“',
);

// ── Abläufe aus Abschnitt 3 (Nr. 48–96): Main unverändert, Aufnahme und Engine in der Wurzel-View, nicht im Panel (E15) ──
ok(
  [
    'useBrueckenWert(MASTER_LINK_QUELLE)',
    'useBrueckenWert(FERNSTEUERUNG_QUELLE)',
    'useCaptionNdiEngine(cfg ?? FALLBACK_CFG, state?.lines ?? [], hold, state?.leerungen ?? 0, ndiActive, previewRef)',
    'startCapture(',
    "navigator.mediaDevices.addEventListener?.('devicechange', onChange)",
    'void load();',
    'panelAktionen(',
    'liveAktionen(',
  ].every((w) => wurzel.includes(w)) &&
    ['window.', 'useEffect', 'useCaption(', 'setInterval', 'addEventListener'].every((w) => !ohneKommentar(panel).includes(w)) && !/window\.|useEffect|useCaption\(/.test(ohneKommentar(live)),
  'CA Funktionsliste: Engine, Aufnahme, Geräteliste, Laden und Brücken laufen in der Wurzel-View auch bei geschlossenem Panel; Einstellungen.tsx hat kein window, keine Effekte, keinen Store; LiveBereich.tsx keine Hooks (E15)',
);
ok(
  von([53, 56, 57, 59, 60, 86], (nr) => beginnt(nr, 'Rahmen') && nennt(nr, '`views/CaptionOberflaeche.tsx`')) && nennt(53, 'showAdv', 'geraete', 'Panel') && gebunden(53, 'store/useCaption.ts') &&
    !GEAENDERT_KANON.has('apps/caption/src/renderer/src/lib/capture.ts') && wurzel.includes('activeDeviceRef.current !== desiredDevice') && wurzel.includes('setGeraete(geraeteListe(d))') && wurzel.includes('.catch(() => setGeraete([]))'),
  'CA Funktionsliste Nr. 53, 56, 57, 59, 60, 86: Zustand, Aufnahme, Gerätewechsel und Geräteliste leben unverändert in der Wurzel-View; der Store änderte sich nur mit Altfehler CA-5, lib/capture.ts ist unverändert',
);
ok(
  von([58], (nr) => unveraendert(nr) && nennt(nr, '`lib/capture.ts`')) && von([48, 49, 50, 51, 54, 55, 62, 63, 72, 73], unveraendert) && nennt(48, '`main/index.ts`', 'E2') && nennt(52, 'syncNdi', 'ndiSendet', 'ndiNetzName') && unveraendert(52) &&
    von([48, 49, 50, 51, 52, 54, 55, 62, 63, 72, 73], (nr) => gebunden(nr, 'main/index.ts')) && gebunden(63, 'preload/index.ts') &&
    hauptIndex.includes('function syncNdi(): void') && hauptIndex.includes('status.ndiSendet = ndiLage.sendet;') && hauptIndex.includes('status.ndiNetzName = ndiLage.netzName;'),
  'CA Funktionsliste Nr. 48–55, 58, 62, 63, 72, 73: Start, Konfiguration, Übertragung, Transkription und Korrektur im Main bleiben bis auf die lesenden Brücken und die NDI-Lage (E2, E8) und die Altfehler CA-4 und CA-5, die jede Zeile nennt',
);
ok(
  von([64, 65, 66, 67, 68, 71, 114, 115], unveraendert) && von([64, 65, 66, 67], (nr) => nennt(nr, '`main/transcriber.ts`')) && nennt(68, '`main/whisper-server.ts`') && nennt(71, '`shared/prompt.ts`') &&
    !GEAENDERT_KANON.has('apps/caption/src/main/transcriber.ts') && !GEAENDERT_KANON.has('apps/caption/src/main/whisper-server.ts') && !GEAENDERT_KANON.has('apps/caption/src/shared/prompt.ts') && !GEAENDERT_KANON.has('apps/caption/src/main/locate.ts'),
  'CA Funktionsliste Nr. 64–68, 71, 114, 115: Warteschlange, Modellpfad, CLI, Server, Lebenslauf, Prompt und Dateien der Erkennung sind unverändert',
);
ok(
  von([69, 70], (nr) => beginnt(nr, 'Panel Erkennung') && nennt(nr, '`main/whisper-server.ts`', 'nächsten Äußerung', 'sofort')) && nennt(69, '20 s') && nennt(70, 'cli'),
  'CA Funktionsliste Nr. 69, 70: Modell- und Engine-Wechsel wirken wie bisher bei der nächsten Äußerung; die Wahl steht im Panel Erkennung',
);
ok(
  beginnt(74, 'Live-Bereich Verlauf') && nennt(74, 'einzige', 'onKeyDown', 'Escape', 'Altfehler CA-5') && (ohneKommentar(live).match(/onKeyDown/g) ?? []).length === 1,
  'CA Funktionsliste Nr. 74: der Hörer des Korrekturfelds (Enter, seit Altfehler CA-5 auch Escape) ist weiter das einzige onKeyDown der Oberfläche',
);
ok(
  von([75, 76], unveraendert) && nennt(75, '`lib/ndi-engine.ts`', 'E7', 'Altfehler CA-4') && nennt(76, '`lib/ndi-engine.ts`', '`lib/caption-cg.ts`', 'Befund 4', 'Altfehler CA-4', '`leerungen`', '`angezeigterText`', 'Hold bleibt an') &&
    gebunden(75, 'lib/ndi-engine.ts') && gebunden(76, 'lib/ndi-engine.ts') && gebunden(76, 'main/index.ts') && !GEAENDERT_KANON.has('apps/caption/src/renderer/src/lib/caption-cg.ts') && nennt(10, 'Altfehler CA-4', 'Nr. 76') &&
    motor.includes('shownRef.current = angezeigterText(shownRef.current, linesRef.current, holdRef.current, leerungenRef.current);') && hauptIndex.includes('leerungen++;') && hauptIndex.includes("case 'clear':\n      doClear();"),
  'CA Funktionsliste Nr. 10, 75, 76: Hold friert weiter ein (E7); Altfehler CA-4: „Leeren“ (Taste und Companion clear) leert Vorschau und NDI auch bei Hold (Zähler leerungen, angezeigterText), Hold bleibt an und hält den leeren Stand; der Zeichner bleibt',
);

// ── NDI im Main (Nr. 77, 78, 80–85, 97): E8 – gemessene Lage, Ende des Senders, spätes stat ──
ok(
  von([77, 78], (nr) => unveraendert(nr) && nennt(nr, 'E8', '`main/ndi/sender-process.ts`')) && nennt(77, 'ndiLage.starte') && nennt(78, 'ndiLage.stoppe') && hauptIndex.includes('ndiLage.stoppe();') && hauptIndex.includes('status.ndiActive = true;') &&
    sender.includes("proc.on('exit'") && sender.includes('if (child !== proc) return;'),
  'CA Funktionsliste Nr. 77, 78: NDI starten und stoppen bleiben, bis auf die Buchführung nach E8 (Lauf-Kennung, exit-Hörer)',
);
ok(
  von([82, 83, 95], (nr) => nennt(nr, 'E8', 'connections')) && von([82, 83], (nr) => beginnt(nr, 'Statusleiste')) && nennt(82, '`main/ndi/wachhund.ts`', '3000', 'Stille', 'ndiSendet', 'spät', 'alten') && nennt(83, 'exit', 'ndi toggle', 'Absturz', 'ndiActive') && nennt(95, 'ndi toggle', 'Absturz', 'spät') &&
    wach.includes('export const NDI_STILLE_MS = 3000;') && wach.includes('if (lauf !== this.lauf || !this.wachhund) return false;') && hauptIndex.includes('if (!ndiLage.stat(lauf)) return;') && hauptIndex.includes('if (!ndiLage.ende(lauf)) return;') &&
    /status\.ndiActive = false;\s*status\.connections = 0;/.test(hauptIndex.slice(hauptIndex.indexOf('const lauf = ndiLage.starte'), hauptIndex.indexOf('function stopNdi'))),
  'CA Funktionsliste Nr. 82, 83, 95: der Wachhund (3 s), das Ende des Senders (ndiActive aus, connections 0) und das späte stat eines alten Prozesses (setzt connections nicht mehr) stehen in den Zeilen; ndi toggle nach Absturz startet NDI',
);
ok(
  von([80, 81], (nr) => beginnt(nr, 'NDI-Bild')) && nennt(80, '`lib/ndi-engine.ts`', 'E2', 'E8', '`angezeigterText`') && nennt(81, '`lib/caption-cg.ts`', 'W2-9') && gebunden(80, 'lib/ndi-engine.ts') && gebunden(80, 'preload/index.ts') &&
    !GEAENDERT_KANON.has('apps/caption/src/renderer/src/lib/caption-cg.ts') && !GEAENDERT_KANON.has('apps/caption/src/utility/ndi-sender.ts') && ohneKommentar(motor).includes('setInterval(tick') &&
    motor.includes('const u32 = new Uint32Array(img.data.buffer);') && motor.includes("port.postMessage({ type: 'video', buffer: img.data.buffer, w: W, h: H, fpsN: c.ndiFps });"),
  'CA Funktionsliste Nr. 80, 81: der Bildweg (Takt, Pixel, BGRA, Anschluss) und der Zeichner der NDI-Frames sind unverändert; die Textwahl je Takt kam mit Altfehler CA-4 (angezeigterText), der Preload bekam mit Altfehler CA-5 correctLine',
);
ok(
  von([84, 85], unveraendert) && nennt(84, '`main/index.ts`', 'E8') && nennt(85, '`main/control-server.ts`') && hauptIndex.includes("app.on('window-all-closed'") && hauptIndex.includes("app.on('before-quit'") && /win\.on\('closed', \(\) => \{\s*stopSender\(\);\s*ndiLage\.stoppe\(\);/.test(hauptIndex),
  'CA Funktionsliste Nr. 84, 85: Schließen und Beenden bleiben (beim Schließen kommt ndiLage.stoppe() dazu, E8)',
);
ok(
  beginnt(97, 'NDI-Bild') && nennt(97, 'kein Ausgabefenster', 'Befund 14', '`lib/ndi-engine.ts`') && !/output:zustand|output-window/.test(ohneKommentar(wurzel + brk + quelle('preload/index.ts'))) && brk.includes('Die Caption hat kein Ausgabefenster'),
  'CA Funktionsliste Nr. 97: Caption hat weiter kein Ausgabefenster; die Ausgabe ist die NDI-Quelle',
);

// ── Show, Steuerserver, Fernbefehle (Nr. 87–96): Server und Verben unverändert, die Meldung ist neu (E2) ──
ok(
  unveraendert(87) && nennt(87, '`main/index.ts`', '`packages/show/src/index.ts`', 'E2') && !GIT?.has('packages/show/src/index.ts'),
  'CA Funktionsliste Nr. 87: der Show-Deep-Link bleibt (main/index.ts nur mit den lesenden Brücken und der NDI-Lage)',
);
ok(
  beginnt(88, 'Panel Fernsteuerung') && nennt(88, 'E2', 'Statusleiste', '`main/control-server.ts`', '`shared/fernsteuerung.ts`', 'Port 8732', 'EADDRINUSE', 'Befund 10') && ctl.includes('onMeldung') && ctl.includes('onStatus:') &&
    panel.includes('<RemoteControlSection {...fernsteuerungAbschnitt(stand)} />') && obf.includes('companionModule: CAPTION_TEXTE.companionModul') && obf.includes("companionModul: 'JM Caption'") && obf.includes('export const ABSCHNITT') &&
    hauptIndex.includes("meldeFernsteuerung({ art: 'start', ok: r.ok, error: r.error });"),
  'CA Funktionsliste Nr. 88: die Fernsteuerungs-Meldung (Port 8732, Clients, Fehler, Port belegt) steht im Panel Fernsteuerung und in der Statusleiste (E2), Modul „JM Caption“',
);
ok(
  [89, 90, 91, 92, 93, 94].every((nr) => unveraendert(nr) && nennt(nr, '`main/index.ts`')) && nennt(89, '`packages/suite-control-protocol/src/capabilities.ts`') && nennt(91, 'ndi toggle', 'Absturz', 'E8') && nennt(94, 'Renderer') &&
    hauptIndex.includes("case 'transcribe':") && hauptIndex.includes("case 'hold':") && hauptIndex.includes("case 'ndi':") && hauptIndex.includes("case 'clear':") && hauptIndex.includes('if (resolveMode(arg, status.ndiActive)) startNdi(config.ndiName);') &&
    ctl.includes('export function resolveMode') && nennt(96, '`main/control-server.ts`'),
  'CA Funktionsliste Nr. 89–94, 96: die vier Verben, ihre Auflösung und der Weg über den Main bleiben; ndi toggle löst weiter von ndiActive aus (nach einem Absturz startet es NDI, E8)',
);
ok(
  unveraendert(95) && nennt(95, '`main/index.ts`', '`main/control-server.ts`', 'running', 'hold', 'ndi', 'connections', 'lines') && /ndi: status\.ndiActive,\s*connections: status\.connections,\s*lines: lines\.length,/.test(hauptIndex),
  'CA Funktionsliste Nr. 95: STATE bleibt (running, hold, ndi aus ndiActive, connections, lines); nur die Werte von ndi und connections ändern sich nach E8',
);

// ── Tastatur (Nr. 98–104, Pflichtzeilen): keine Kürzel, Panel-Tasten nach O1, Tasten im Feld ──
ok(
  beginnt(98, 'Rahmen') && nennt(98, 'Kürzel', 'onKeyDown') && !/keydown|addEventListener\('key|globalShortcut|before-input-event/.test(ohneKommentar(wurzel + live + panel + obf + akt + app)) && !/shortcut/.test(ohneKommentar(live + obf)),
  'CA Funktionsliste Nr. 98 (Pflichtzeile Tastatur): weiter keine Kürzel; Wurzel, Live-Bereich und Panel hören auf keine Taste, die vier TallyButtons tragen kein shortcut',
);
ok(
  zeile(99)?.zellen[1] === 'Panel-Tasten' && beginnt(99, 'Panel ') && ['Leertaste', 'Escape', 'Feld', 'Schalter', 'O1', 'keine Kürzel', 'verwirft Escape den Entwurf'].every((w) => kuenftig(99).includes(w)),
  'CA Funktionsliste Nr. 99 (Pflichtpunkt Panel-Tasten): Leertaste und Escape, je für Feld und Knopf/Schalter (Spec 10, O1), Caption ohne Kürzel, Escape im NDI-Namensfeld',
);
{
  const sp = quelle('packages/ui/src/components/SettingsPanel.tsx');
  ok(sp.includes('Escape') && sp.includes('defaultPrevented'), 'CA Funktionsliste Nr. 99: SettingsPanel schließt mit Escape, nur wenn nicht defaultPrevented');
  ok(
    wurzel.includes('settings={<Einstellungen') && !panel.includes('<LiveBereich') && wurzel.includes('<LiveBereich') && !/key=\{/.test(ohneKommentar(wurzel)),
    'CA Funktionsliste Nr. 99: das Panel ist kein eigener Bildschirm, der Live-Bereich bleibt bei offenem Panel gemountet (kein key um ihn)',
  );
}
ok(
  beginnt(100, 'Live-Bereich Verlauf') && nennt(100, 'Enter', 'Escape', 'blur', 'Altfehler CA-5', 'bricht') && live.includes("e.key === 'Enter'") && live.includes("e.key === 'Escape'") && live.includes('onBlur='),
  'CA Funktionsliste Nr. 100: Enter im Korrekturfeld übernimmt über blur, Verlassen übernimmt; Escape bricht seit Altfehler CA-5 ab (zuvor tat es nichts)',
);
ok(
  beginnt(101, 'Panel Darstellung') && beginnt(102, 'Panel Erkennung') && nennt(102, 'Select', 'nicht verfügbar', 'jeder Schritt') && (panel.match(/<Select/g) ?? []).length >= 4 && !/<select/.test(panel),
  'CA Funktionsliste Nr. 101, 102: die Zahlenfelder bleiben nativ, die Auswahlfelder sind Select aus @jm/ui mit „nicht verfügbar: …“, jeder Schritt wirkt wie bisher',
);
ok(
  beginnt(103, 'Panel NDI-Ausgabe') && nennt(103, 'Escape verwirft den angefangenen Entwurf', 'Entwurf', 'Wörterbuch', 'Enter', 'getrimmt') && panel.includes('<textarea'),
  'CA Funktionsliste Nr. 103: Quellname übernimmt bei Enter oder Verlassen und Escape verwirft den Entwurf; das Wörterbuch schreibt weiter bei jeder Taste und Enter macht eine neue Zeile',
);
ok(
  beginnt(104, 'Live-Bereich Haupttasten') && nennt(104, 'Klappe', 'Doppelklick', 'Band') && panel.includes('type="checkbox"') && !/tabIndex/.test(live),
  'CA Funktionsliste Nr. 104: Knöpfe und Kontrollkästchen wie bisher; die Korrektur ist weiter nur mit der Maus auslösbar',
);

// ── Gemerkte Zustände (Nr. 105–116): alles im Main, Hell/Dunkel mit der Ausnahme jm-theme ──
ok(
  !/localStorage|sessionStorage|persistId/.test(ohneKommentar(wurzel + panel + live + akt + obf + brk + app + store + quelle('lib/capture.ts') + motor)),
  'CA Funktionsliste Nr. 112: die Oberfläche der App merkt nichts selbst (kein localStorage, kein persistId in apps/caption/src)',
);
ok(
  ['jm-theme', 'E5'].every((w) => kuenftig(112).includes(w)) && kuenftig(112).includes('`packages/ui/src/lib/theme.ts`') && quelle('packages/ui/src/lib/theme.ts').includes("'jm-theme'") && ersetzt(112, 'Kopf'),
  'CA Funktionsliste Nr. 112: der Haken nennt die Ausnahme Hell/Dunkel im gemeinsamen Kopf (jm-theme in localStorage, E5)',
);
ok(
  unveraendert(105) && nennt(105, '`main/index.ts`', 'caption.config.json') && unveraendert(111) && unveraendert(116) && nennt(116, '`main/control-server.ts`', 'E2') && unveraendert(107) && nennt(107, 'ohne Bedienfläche'),
  'CA Funktionsliste Nr. 105, 107, 111, 116: Datei, Stille-Parameter, Show-Vorgaben und Steuerdaten bleiben im Main unverändert',
);
ok(
  beginnt(106, 'Panel Erkennung') && beginnt(108, 'Panel Audiogerät') && beginnt(109, 'Panel NDI-Ausgabe') && beginnt(110, 'Panel Darstellung') && nennt(108, 'Gerät nicht gefunden', 'Befund 9') && nennt(109, 'Enter'),
  'CA Funktionsliste Nr. 106, 108–110: die gemerkten Einstellungen haben ihren Ort im Panel (Erkennung, Audiogerät, NDI-Ausgabe, Darstellung)',
);
ok(
  beginnt(113, 'Rahmen') && nennt(113, 'ndiSendet', 'ndiNetzName', 'Panel', 'showAdv'),
  'CA Funktionsliste Nr. 113: nicht gemerkt sind jetzt auch ndiSendet, ndiNetzName und der Zustand des Panels; showAdv entfällt',
);

// ── Statusleiste: die sechs Einträge stehen in der Leiste ──
ok(
  ['masterLinkStatusItem(s.masterLink)', 'ndiItem(s)', "group: 'fernsteuerung'", "id: 'whisper'", "id: 'fehler'", 'audioDeviceView(mikrofonAbschnitt(s))'].every((w) => obf.includes(w)) && wurzel.includes('status={statusLeiste(stand)}'),
  'CA Funktionsliste: die Statusleiste hat Master-Link, NDI, Fernsteuerung, Mikrofon, Whisper und Fehler',
);

// ── Abschnitt 8, 9, 10 und der Kopf „Stand“ widersprechen den Haken nicht ──
{
  const abschnitt1 = text.slice(text.indexOf('## 1 · '), text.indexOf('|---', text.indexOf('## 1 · ')));
  const abschnitt2 = text.slice(text.indexOf('## 2 · '), text.indexOf('|---', text.indexOf('## 2 · ')));
  const abschnitt6 = text.slice(text.indexOf('## 6 · '), text.indexOf('|---', text.indexOf('## 6 · ')));
  const abschnitt7 = text.slice(text.indexOf('## 7 · '), text.indexOf('|---', text.indexOf('## 7 · ')));
  const abschnitt8 = text.slice(text.indexOf('## 8 · '), text.indexOf('## 9 · '));
  const abschnitt9 = text.slice(text.indexOf('## 9 · '), text.indexOf('## 10 · '));
  const abschnitt10 = text.slice(text.indexOf('## 10 · '));
  const kopf = text.slice(0, text.indexOf('## 1 · '));
  const kopfFlach = kopf.replace(/\n\s*/g, ' ');
  const stand = kopfFlach.slice(kopfFlach.indexOf('- **Stand:**'), kopfFlach.indexOf('- **Gelesen'));
  const befund = (n: number): string => abschnitt10.slice(abschnitt10.indexOf(`\n${n}. `), abschnitt10.indexOf(`\n${n + 1}. `) === -1 ? undefined : abschnitt10.indexOf(`\n${n + 1}. `));
  const flach = (s: string): string => s.replace(/\n\s*/g, ' ');
  const a8 = flach(abschnitt8);
  const a9 = flach(abschnitt9);

  ok(/zum Zeitpunkt der Erhebung \(`d7cdd79ce0`\)/.test(stand) && /Am Ende der Welle 2a gilt das nicht mehr/.test(stand), 'CA Funktionsliste Stand: „Code unverändert“ gilt nur zum Zeitpunkt der Erhebung (d7cdd79ce0)');
  ok(
    /geänderten Code-Dateien unter `apps\/caption\/src`/.test(stand) && !/globals\.css` und `tsconfig/.test(stand) && !/nennen jede geänderte Datei/.test(stand),
    'CA Funktionsliste Stand: die Haken nennen die geänderten Code-Dateien unter src (nicht „jede geänderte Datei“); Tests, package.json und tsconfig.test.json stehen in keinem Haken',
  );
  {
    const codeDateien = GEAENDERT.filter((p) => p.startsWith('apps/caption/src/')).map((p) => p.slice('apps/caption/src/'.length));
    const genannt = (d: string): boolean => alle.some((z) => [...z.zellen[6].matchAll(PFAD)].some((m) => kanon(m[1]) === `apps/caption/src/${d}`));
    const fehlt = codeDateien.filter((d) => !genannt(d));
    ok(fehlt.length === 0, `CA Funktionsliste Stand: jede geänderte Code-Datei unter src/ steht in einem Haken (fehlt: ${fehlt.join(', ') || 'nichts'})`);
  }
  ok(/Caption hatte zum Zeitpunkt der Erhebung \(`d7cdd79ce0`\) keinen Ordner `test\/ui`/.test(kopfFlach), 'CA Funktionsliste Kopf: „kein Ordner test/ui“ gilt nur zum Zeitpunkt der Erhebung (d7cdd79ce0)');
  ok(/künftig wo[^]*Aufgabe e/.test(kopf) && /funktionsliste\.test\.ts/.test(kopf) && !/die der Umbau anlegt\)/.test(kopf) && /NDI-Bild/.test(kopf), 'CA Funktionsliste Kopf: „künftig wo“ ist gefüllt und abgehakt, das Ortsregister nennt NDI-Bild');
  ok(/so zum Zeitpunkt der Erhebung \(`d7cdd79ce0`\), im neuen Aufbau bleibt es bei einer Ansicht/.test(kopfFlach), 'CA Funktionsliste Kopf: „ein einziger Abschnitt im Hauptfenster“ gilt zum Zeitpunkt der Erhebung; im neuen Aufbau bleibt es bei einer Ansicht (Nr. 1)');
  ok(/Zeitpunkt der Erhebung/.test(kopfFlach.slice(kopfFlach.indexOf('**`window.confirm`:**'))) && /jm-theme/.test(kopfFlach.slice(kopfFlach.indexOf('**`window.confirm`:**'))) && /E5/.test(kopfFlach.slice(kopfFlach.indexOf('**`window.confirm`:**'))) && !/\*\*`localStorage`, `sessionStorage`:\*\* keiner \(0 Treffer\)\. \*\*`persistId`:\*\* keine \(0 Treffer, Nr\. 112\)\. \*\*Tastatur:\*\*/.test(kopfFlach), 'CA Funktionsliste Kopf: „localStorage: keiner“ gilt zum Zeitpunkt der Erhebung; jm-theme (E5) kommt dazu');
  ok(/Gemerkt wird die Datei `caption\.config\.json` \(Nr\. 105\)[^]{0,80}jm-theme/.test(kopfFlach) && !/Gemerkt wird nur die Datei `caption\.config\.json` \(Nr\. 105\)\./.test(kopfFlach), 'CA Funktionsliste Kopf: „gemerkt wird nur die Datei“ nennt jm-theme (E5)');
  ok(/Welle 2a \(E8\)/.test(kopfFlach) && /Companion/.test(kopfFlach.slice(kopfFlach.indexOf('- **Fernsteuerung:**'), kopfFlach.indexOf('- **`window.confirm`')))&& /Nr\. 82, 83, 95/.test(kopfFlach), 'CA Funktionsliste Kopf: die zwei für Companion sichtbaren Folgen von E8 stehen bei der Fernsteuerung (Nr. 82, 83, 95)');
  ok(/Zeitpunkt der Erhebung/.test(abschnitt1) && /Welle 2a/.test(abschnitt1) && !/kein Panel und keine Statusleiste\s+\(so zum Zeitpunkt der Erhebung\)\./.test(abschnitt1) && /TallyButton/.test(abschnitt1), 'CA Funktionsliste Abschnitt 1: die Einleitung („kein Panel, keine Statusleiste, einfache button-Elemente“) gilt zum Zeitpunkt der Erhebung');
  ok(
    /zum Zeitpunkt der Erhebung/i.test(abschnitt2) && /E9/.test(abschnitt2) && !/Meldungen laufen über drei Plätze: das\s+Warnband mit `state\.error`/.test(abschnitt2),
    'CA Funktionsliste Abschnitt 2: „drei Warnbänder“ gilt zum Zeitpunkt der Erhebung; seit Welle 2a Hinweise im Live-Bereich und Statuseinträge (E9)',
  );
  ok(/zum Zeitpunkt der Erhebung/.test(abschnitt6) && /Nr\. 100 bis 104/.test(abschnitt6) && !/wie Zahlen-, Auswahl- und Textfelder heute auf die Tastatur reagieren\./.test(abschnitt6), 'CA Funktionsliste Abschnitt 6: „heute“ gilt zum Zeitpunkt der Erhebung, die Änderungen stehen in Nr. 100 bis 104');
  ok(/zum Zeitpunkt der Erhebung/i.test(abschnitt7) && /jm-theme/.test(abschnitt7) && /E5/.test(abschnitt7) && !/Es gibt kein `persistId` und kein `localStorage` \(Nr\. 112\);/.test(abschnitt7), 'CA Funktionsliste Abschnitt 7: „kein localStorage“ gilt zum Zeitpunkt der Erhebung; jm-theme (E5) schreibt jetzt');
  ok(/zum Zeitpunkt der Erhebung/i.test(a8) && /masterLink/.test(a8) && /E2/.test(a8) && !/Zugänge, die der Umbau ergänzt \(Entscheidung E2\)\./.test(a8) && /ndiSendet/.test(a8) && !/E8 ergänzt `ndiSendet` und `ndiNetzName` im Status\./.test(a8), 'CA Funktionsliste Abschnitt 8: Master-Link und Fernsteuerungs-Zustand fehlten zum Zeitpunkt der Erhebung und sind jetzt ergänzt (E2), ndiSendet und ndiNetzName sind da (E8)');
  ok(/`ndi\.status\(\)`[^\n]*spiegelt/.test(a8) && /fernsteuerung/.test(a8) && /onFernsteuerung/.test(a8), 'CA Funktionsliste Abschnitt 8: die neuen Funktionen fernsteuerung, onFernsteuerung, masterLink, onMasterLink stehen in der Übersicht; ndi.status spiegelt die NDI-Lage');
  ok(
    /\| `correctLine\(id, text\)` \| `caption:correctLine` \| invoke \|[^|]*Altfehler CA-5[^|]*zum Zeitpunkt der Erhebung `correctLast\(text\)`/.test(abschnitt8) && !/\| `correctLast\(text\)` \|/.test(abschnitt8) &&
      /Altfehler CA-4 ergänzt `leerungen`/.test(a8),
    'CA Funktionsliste Abschnitt 8: correctLine(id, text) über caption:correctLine steht in der Übersicht (Altfehler CA-5, der alte Kanal correctLast als Stand der Erhebung), CaptionState nennt leerungen (Altfehler CA-4)',
  );
  ok(
    !/Sperrgründe nach dem heutigen Ablauf: \*\*keine\*\* \(alle vier sind nie gesperrt, Nr\. 9\)/.test(a9) && /Lädt …/.test(a9) && /gesperrt/.test(a9),
    'CA Funktionsliste Abschnitt 9: die Haupttasten sind nicht mehr „nie gesperrt“, sie sind vor der ersten Antwort des Main gesperrt („Lädt …“)',
  );
  ok(
    !/kein Zugang im Preload \(Abschnitt 8\), kommt neu \(E2\)/.test(a9) && !/Port 8732, heute nicht gemeldet \(Befund 10\)/.test(a9) && !/„Gerät nicht gefunden“ gibt es heute nur als Mikrofonfehler beim Start der Aufnahme \(Befund 9\)/.test(a9) && !/E8: „sendet“ aus der Stat-Meldung\s*\|/.test(a9),
    'CA Funktionsliste Abschnitt 9: Master-Link, Fernsteuerung, „Gerät nicht gefunden“ und „sendet“ stehen nicht mehr als offen da',
  );
  ok(/Statuseintrag `master-link`[^|]*\|[^|]*\|[^|]*Task 24/.test(a9) && /Statuseintrag `mikrofon`[^|]*\|[^|]*\|[^|]*Statusleiste/.test(a9) && /Statuseintrag `ndi`[^|]*\|[^|]*\|[^|]*ndiSendet/.test(a9), 'CA Funktionsliste Abschnitt 9: die Zeilen master-link, mikrofon und ndi nennen den Stand nach dem Umbau');
  ok(
    !/der Mikrofonfehler steht heute als Band \(E9: Text unter den Haupttasten\)/.test(a9) && !/heute zeigt „Stopp“ rot auch bei gescheitertem Mikrofon \(Befund 1\) und „NDI an“ grün auch ohne Bilder \(Befund 2\)/.test(a9) && !/66 rohe Farbwerte; der gemeinsame Kopf zeigt den Schalter immer, die App muss hell-fähig werden/.test(a9),
    'CA Funktionsliste Abschnitt 9: „Mikrofonfehler als Band“, „Stopp rot, NDI an grün“ und „66 rohe Farbwerte“ gelten zum Zeitpunkt der Erhebung, nicht mehr heute',
  );
  ok(/zum Zeitpunkt der Erhebung/.test(a9.slice(a9.indexOf('Dazu die Verben'), a9.indexOf('Weitere Zuordnung'))) && /ohne Symbole/.test(a9), 'CA Funktionsliste Abschnitt 9: die Beschriftungen der Verben-Übersicht gelten zum Zeitpunkt der Erhebung (jetzt ohne Symbole)');
  ok(/Welle 2a/.test(abschnitt10.slice(0, 700)) && /Zeitpunkt der Erhebung/.test(abschnitt10.slice(0, 700)), 'CA Funktionsliste Abschnitt 10: die Einleitung nennt, dass die Befunde den Stand der Erhebung beschreiben');
  ok(
    [1, 2, 3, 9, 10, 14, 15, 16, 18].every((n) => /Welle 2a:/.test(befund(n))) && /E9/.test(befund(1)) && /E8/.test(befund(2)) && /E8/.test(befund(3)) && /E2/.test(befund(10)) && /Task 26/.test(befund(14)),
    'CA Funktionsliste Abschnitt 10: die Befunde 1, 2, 3, 9, 10, 14, 15, 16 und 18 nennen den Stand nach der Welle (E9, E8, E2, Tokens, Wachhund, test/ui)',
  );
  ok(
    [4, 5, 6, 7, 8, 11, 12, 13].every((n) => /Welle 2a:[^]*unverändert[^]*Owner/.test(befund(n))),
    'CA Funktionsliste Abschnitt 10: die Befunde 4–8 und 11–13 bleiben unverändert, Owner-Entscheidung offen',
  );
  ok(
    /Welle 2a:[^]*Korrektur/.test(befund(5)) && /Welle 2a:[^]*Number\(Wert\)[^]*leer/.test(befund(8)) && /Welle 2a:[^]*Stopp[^]*letzten Worte/.test(befund(6)) && /Welle 2a:[^]*Base/.test(befund(7)),
    'CA Funktionsliste Abschnitt 10: die Befunde 5–8 nennen ihr Verhalten nach der Welle (Korrektur der jüngsten Zeile, Stopp, Base-Rückfall, leeres Zahlenfeld gleich 0)',
  );
  {
    const stufe2 = (n: number, id: string): string => {
      const b = befund(n);
      const i = b.indexOf(`Altfehler Stufe 2 (${id}):`);
      return i > b.indexOf('Welle 2a:') && b.indexOf('Welle 2a:') >= 0 ? b.slice(i) : '';
    };
    ok(
      /behoben[^]*`running=0`[^]*nicht mehr von selbst neu/.test(stufe2(1, 'CA-1')) && /behoben[^]*auch bei Hold[^]*Hold bleibt an/.test(stufe2(4, 'CA-4')) &&
        /behoben[^]*Kennung[^]*`caption:correctLine`[^]*Escape bricht ab/.test(stufe2(5, 'CA-5')) && /Altfehler Stufe 2 \(‹ID›\):/.test(abschnitt10.slice(0, 900)),
      'CA Funktionsliste Abschnitt 10: Befund 1, 4 und 5 behalten den Satz der Welle 2a und nennen danach „Altfehler Stufe 2 (CA-1, CA-4, CA-5): behoben …“ (Widerruf: alter Text bleibt stehen)',
    );
  }
  ok(nennt(1, 'CaptionOberflaeche') && nennt(36, 'Rahmen'), 'CA Funktionsliste: Nr. 1 und Nr. 36 nennen die Wurzel-View');
}
