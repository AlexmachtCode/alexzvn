// ─────────────────────────────────────────────────────────────────────────────
// Funktionsliste nach dem Umbau (UX Welle 2b, Connect e; Spec 10 „Kein Funktionsverlust“). Jede der 209 Zeilen in den
// Abschnitten 1–7 von docs/ux/funktionslisten/connect.md ist in „künftig wo“ abgehakt, in genau einer Form: „✓ “ und ein Ort
// des Ortsregisters (Plan Task 25), „✓ unverändert (…)“, „✓ entfällt (…, B…)“ oder „✓ ersetzt durch {Ort} (…, B…)“. Das
// Register ist streng: Nach dem Ort folgt genau „ (“, ein bloßes „Panel“ oder ein Ort mit angehängtem Wort gilt nicht.
// Verweise im Haken und im Stand der Befunde nur auf B1–B22 (Plan 2b); die übrigen Spalten tragen die E-Nummern der
// Connect-Spezifikationen und bleiben, wie sie sind. Jede genannte Datei existiert, Groß- und Kleinschreibung wie im Repo; in den
// Spalten 1–6 auch die seit der Erhebung gelöschte (GELOESCHT). Zeilenangaben im Haken liegen in der Datei von heute, an den
// Pflichtzeilen auch am richtigen Code. „heute wo“ bleibt beim Stand der Erhebung (481c998c08, Prüfsumme).
// Dazu Querprüfungen gegen den Code: Pflichtzeilen Verben, Tastatur, Standardmenü und Panel-Tasten (O1), die Abläufe aus
// Abschnitt 3 in der Wurzel-View statt im Panel (B8), Peer-Fenster und Tray, die Zeilen aus N2b 3.1, die Festlegungen aus Task 21
// bis 24 und der Abschluss der Befunde 1–14.
// Läuft im Paketordner apps/connect (npm run selftest -w @jm/connect), eingehängt in test/ui/selftest.ts.
// „unverändert (…)“ und die Orte „Peer-Fenster (unverändert)“ und „Tray (unverändert)“ nennen keine Datei, die seit der Erhebung
// geändert wurde, außer sie bekam nur, was der Plan erlaubt (Master-Link und Fernsteuerungs-Meldung B2 in Main, Preload und
// shared; class="dark" B4 in renderer/index.html) oder nur ohneVorsatz (src/shared/zoom-text.ts, Task 23, Statusleiste): dann
// nennt der Haken diesen Verweis. Der Abgleich mit git (geänderte Dateien, verschobene Abläufe zeichengleich, zoom-text nur um
// ohneVorsatz gewachsen) läuft nur mit JM_FUNKTIONSLISTE_GIT=1.
// ─────────────────────────────────────────────────────────────────────────────

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createElement } from 'react';
import { REMOTE_TEXTE } from '@jm/settings';
import { gleich, leseText, ok, render } from '@jm/ui/testhilfe';
import { NDI_TEXT } from '@shared/ndi-text';
import { STEUER_PORT } from '@shared/fernsteuerung';
import { CONNECT_TEXTE, gastHalten, kopfOnAir, raumTaste, talkbackTaste } from '@/lib/oberflaeche';
import { CloudRaum } from '@/views/CloudRaum';
import { aktionenAttrappe, ansicht, appStatus, gast, halteKnoepfe, offenerRaum, ohneKommentare, raum, stand, tallyTasten } from './testzustand';

const LISTE = '../../docs/ux/funktionslisten/connect.md';
const ERHEBUNG = '481c998c08';
/** Letzter Stand der Liste vor dem Abhaken (Task 20, Fix-Runde 1). */
const LISTE_VORHER = '82d504166d';

/**
 * Ortsregister (Plan Task 25): Kopf, Inhalt oben (T145), Cloud-Raum, Gästeliste, Zoom-Spalte, Fußzeile, Statusleiste, Panel
 * ‹Abschnitt› (die Abschnitte im Einstellungs-Panel hinter ⚙), Peer-Fenster (unverändert), Tray (unverändert). „Inhalt oben
 * (T145)“ ist ein Eintrag samt Klammer, wie „Tray (unverändert)“.
 */
const ABSCHNITTE = ['Fernsteuerung', 'Cloud-Zugang', 'Zoom-Einrichtung', 'Zoom-Vorgaben'];
const UNVERAENDERT_ORTE = ['Peer-Fenster (unverändert)', 'Tray (unverändert)'];
const ORTE: readonly string[] = [
  'Kopf',
  'Inhalt oben (T145)',
  'Cloud-Raum',
  'Gästeliste',
  'Zoom-Spalte',
  'Fußzeile',
  'Statusleiste',
  ...ABSCHNITTE.map((a) => `Panel ${a}`),
  ...UNVERAENDERT_ORTE,
];

/** Zeilen insgesamt und je Abschnitt 1–7, wie Task 20 die Liste angelegt hat (82d504166d); Abschnitt 4 in drei Teiltabellen. */
const GESAMT = 209;
const JE_ABSCHNITT = [105, 26, 52, 9, 1, 7, 9];
const TEILTABELLEN: Record<string, [number, number]> = { '4a': [184, 186], '4b': [187, 190], '4c': [191, 192] };

/** Prüfsumme der Spalte „heute wo“ aller 209 Zeilen (Stand der Erhebung, wie Task 20 sie schrieb): sie bleibt (Ruling Task 12). */
const HEUTE_WO_SHA256 = 'a13b7acab084b7e6e93fa68a8052fd22acaf618fdefd5fc75c1fde8626a33d58';
/**
 * Korrekturen in Task 25 an den Spalten 1–6 (Nr. → Spaltenindex): der Kopf ordnet N2b 3.1 Nr. 4 Nr. 143 zu, Nr. 16 Nr. 14 und 15,
 * Nr. 17 Nr. 61 bis 68; diese Zeilen bekamen den Vermerk „N2b 3.1 Nr. …“ in der Spalte Element, wie Task 19 an Nr. 99/100.
 */
const KORRIGIERT: Record<number, number[]> = { 14: [2], 15: [2], 61: [2], 62: [2], 63: [2], 64: [2], 65: [2], 66: [2], 67: [2], 68: [2], 143: [2] };

/** Seit der Erhebung gelöscht (Task 23: index.css → globals.css); sie steht nur noch in den Spalten 1–6, nie im Haken. */
const GELOESCHT = ['R/index.css'];

/** Alle Dateien von apps/connect, die seit der Erhebung geändert, angelegt oder gelöscht wurden (Pfad ab apps/connect). */
const GEAENDERT = [
  'package.json',
  'src/main/control-server.ts',
  'src/main/index.ts',
  'src/preload/index.ts',
  'src/renderer/index.html',
  'src/renderer/src/App.tsx',
  'src/renderer/src/globals.css',
  'src/renderer/src/index.css',
  'src/renderer/src/lib/bruecken.ts',
  'src/renderer/src/lib/oberflaeche.ts',
  'src/renderer/src/main.tsx',
  'src/renderer/src/views/CloudRaum.tsx',
  'src/renderer/src/views/CloudZugang.tsx',
  'src/renderer/src/views/ConnectOberflaeche.tsx',
  'src/renderer/src/views/Einstellungen.tsx',
  'src/renderer/src/views/Fusszeile.tsx',
  'src/renderer/src/views/ZoomSpalte.tsx',
  'src/renderer/src/zoom/Messwerte.tsx',
  'src/renderer/src/zoom/SlotBereich.tsx',
  'src/renderer/src/zoom/SlotEinstellungen.tsx',
  'src/renderer/src/zoom/SlotKachel.tsx',
  'src/renderer/src/zoom/ZoomCard.tsx',
  'src/renderer/src/zoom/ZoomEinrichtung.tsx',
  'src/renderer/src/zoom/ZoomVorgaben.tsx',
  'src/renderer/src/zoom/aufrufe.ts',
  'src/shared/fernsteuerung.ts',
  'src/shared/ipc.ts',
  'src/shared/types.ts',
  'src/shared/zoom-text.ts',
  'test/ndi-text.test.ts',
  'test/raum-zugang.test.ts',
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
  'test/zoom-teile.test.ts',
  'tsconfig.node.json',
  'tsconfig.test.json',
].map((p) => `apps/connect/${p}`);

/** Geänderte Quelldateien der Pakete seit der Erhebung (Bausteine Task 1–3, Bildschirm-Ereignis Task 4), die ein Haken zitieren könnte. */
const PAKETE_GEAENDERT = [
  'packages/output-window/src/bildschirme.ts',
  'packages/output-window/src/index.ts',
  'packages/settings/src/SectionFrame.tsx',
  'packages/settings/src/abschnitte/ScreenOutputSection.tsx',
  'packages/settings/src/abschnitte/screen-output.ts',
  'packages/ui/src/components/AppHeader.tsx',
  'packages/ui/src/components/AppShell.tsx',
  'packages/ui/src/components/HalteKnopf.tsx',
  'packages/ui/src/components/TallyButton.tsx',
  'packages/ui/src/index.ts',
  'packages/ui/src/lib/halten.ts',
  'packages/ui/src/tokens/sizes.css',
];

/**
 * Geänderte Dateien, die nur bekamen, was der Plan erlaubt, und der Verweis, der das belegt: Main, Preload, Kanal und Typen die
 * lesenden Brücken (Master-Link und Fernsteuerungs-Meldung, B2); renderer/index.html class="dark" (B4) und, als Folge der
 * Schrift Manrope (Task 23), `font-src` in der Meta-CSP; src/shared/zoom-text.ts nur ohneVorsatz für die Statusleiste (Task 23,
 * mit git geprüft, unten).
 */
const ERLAUBT = new Map<string, readonly string[]>([
  ['apps/connect/src/main/index.ts', ['B2']],
  ['apps/connect/src/main/control-server.ts', ['B2']],
  ['apps/connect/src/preload/index.ts', ['B2']],
  ['apps/connect/src/shared/ipc.ts', ['B2']],
  ['apps/connect/src/shared/types.ts', ['B2']],
  ['apps/connect/src/renderer/index.html', ['B4']],
  ['apps/connect/src/shared/zoom-text.ts', ['ohneVorsatz']],
]);

const GEAENDERT_KANON = new Set([...GEAENDERT, ...PAKETE_GEAENDERT]);

function git(args: string[]): string | null {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).replace(/\r\n/g, '\n');
  } catch {
    return null;
  }
}
// Nur auf Anforderung: ohne JM_FUNKTIONSLISTE_GIT=1 sagt der Test nichts über git; die statischen Listen sind der Wächter.
const GIT_PRUEFEN = process.env.JM_FUNKTIONSLISTE_GIT === '1';
const GIT_LISTE = GIT_PRUEFEN ? git(['diff', '--name-only', `${ERHEBUNG}..HEAD`]) : null;
const GIT = GIT_LISTE === null ? null : new Set(GIT_LISTE.split('\n').filter((n) => n !== ''));
if (GIT_PRUEFEN && GIT === null) console.log(`CN Funktionsliste: kein git-Verlauf bis ${ERHEBUNG} (flacher Klon); die Prüfung gegen git entfällt`);

/** Datei in Backticks (Pfad mit Endung, optional mit Zeilen „:a-b“) oder nur Zeilen „:a-b“ zur zuletzt genannten Datei im Feld. */
const VERWEIS_DATEI = /`([A-Za-z0-9_./-]+\.(?:tsx|ts|css|html|json|md|mjs|png|h))(?::(\d+)(?:-(\d+))?)?`|`:(\d+)(?:-(\d+))?`/g;
/** Erlaubte Verweise: nur B1–B22 (Plan 2b). */
const VERWEIS = /\bB(?:[1-9]|1\d|2[0-2])\b/;
const FREMD = /\b(?:B(?:0|2[3-9]|[3-9]\d|\d{3,})|E\d+)\b/;

interface Zeile {
  abschnitt: number;
  teil: string;
  nr: number;
  zellen: string[];
}

function zeilen(text: string): Zeile[] {
  const liste: Zeile[] = [];
  let abschnitt = 0;
  let teil = '';
  for (const z of text.split('\n')) {
    const kopf = /^## (\d+) · /.exec(z);
    if (kopf) {
      abschnitt = Number(kopf[1]);
      teil = '';
      continue;
    }
    if (/^## /.test(z)) abschnitt = 0;
    const unter = /^### (\d[a-z]) · /.exec(z);
    if (unter) teil = unter[1];
    const nr = /^\|\s*(\d+)\s*\|/.exec(z);
    if (nr && abschnitt >= 1 && abschnitt <= 7) {
      liste.push({ abschnitt, teil, nr: Number(nr[1]), zellen: z.split('|').slice(1, -1).map((s) => s.trim()) });
    }
  }
  return liste;
}

/** Pfadregel der Liste: Repo-Wurzel (apps, packages, docs), `R/…` = src/renderer/src/…, sonst relativ zu apps/connect. */
function aufgeloest(pfad: string): string {
  if (/^(?:apps|packages|docs)\//.test(pfad)) return `../../${pfad}`;
  if (pfad.startsWith('R/')) return `src/renderer/src/${pfad.slice(2)}`;
  return pfad;
}

/** Kanonischer Pfad ab der Repo-Wurzel nach der Pfadregel der Liste. */
function kanon(pfad: string): string {
  const a = aufgeloest(pfad);
  return a.startsWith('../../') ? a.slice('../../'.length) : `apps/connect/${a}`;
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

const quelleCache = new Map<string, string>();
/** Inhalt einer Datei von heute (LF), leer, wenn es sie nicht gibt. */
function quelle(pfad: string): string {
  if (!quelleCache.has(pfad)) quelleCache.set(pfad, gibtEs(pfad) ? readFileSync(aufgeloest(pfad), 'utf8').replace(/\r\n/g, '\n') : '');
  return quelleCache.get(pfad) ?? '';
}
const zeilenZahl = (inhalt: string): number => (inhalt === '' ? 0 : inhalt.replace(/\n$/, '').split('\n').length);

const altCache = new Map<string, number>();
/** Zeilenzahl der Datei in der Erhebung (git); -1 ohne Verlauf oder ohne Datei. */
function altZeilen(pfad: string): number {
  if (!altCache.has(pfad)) {
    const inhalt = git(['show', `${ERHEBUNG}:${kanon(pfad)}`]);
    altCache.set(pfad, inhalt === null ? -1 : zeilenZahl(inhalt));
  }
  return altCache.get(pfad) ?? -1;
}

interface Verweis {
  datei: string;
  von?: number;
  bis?: number;
}

/** Alle Datei- und Zeilenverweise eines Felds; „:a-b“ allein gilt für die zuletzt genannte Datei. Ohne Datei davor: datei ''. */
function verweise(zelle: string): Verweis[] {
  const aus: Verweis[] = [];
  let letzte = '';
  for (const m of zelle.matchAll(VERWEIS_DATEI)) {
    if (m[1] !== undefined) {
      letzte = m[1];
      aus.push({ datei: m[1], ...(m[2] === undefined ? {} : { von: Number(m[2]), bis: Number(m[3] ?? m[2]) }) });
    } else {
      aus.push({ datei: letzte, von: Number(m[4]), bis: Number(m[5] ?? m[4]) });
    }
  }
  return aus;
}

/** Ort am Anfang des Texts: genau ein Eintrag des Ortsregisters, unmittelbar gefolgt von „ (“ (kein Präfix-Rückfall). */
function ortAm(text: string): string | undefined {
  return ORTE.find((o) => text.startsWith(`${o} (`));
}

/** Die Form des Hakens und, bei Ort und „ersetzt durch“, der Ort. */
function form(k: string): { form: 'unverändert' | 'entfällt' | 'ersetzt durch' | 'Ort'; ort?: string } | undefined {
  const rest = k.slice(2);
  if (rest.startsWith('unverändert (')) return { form: 'unverändert' };
  if (rest.startsWith('entfällt (')) return { form: 'entfällt' };
  if (rest.startsWith('ersetzt durch ')) {
    const ort = ortAm(rest.slice('ersetzt durch '.length));
    return ort === undefined ? undefined : { form: 'ersetzt durch', ort };
  }
  const ort = ortAm(rest);
  return ort === undefined ? undefined : { form: 'Ort', ort };
}

/** Datei- und Zeilenprüfung eines Felds mit Verweisen auf heutige Dateien; null = in Ordnung. */
function verweisFehler(feld: string): string | null {
  const vs = verweise(feld);
  if (vs.some((v) => v.datei === '')) return 'Zeilenangabe ohne Datei davor';
  const dateien = [...new Set(vs.map((v) => v.datei))];
  const fehlt = dateien.filter((d) => !gibtEs(d));
  if (fehlt.length > 0) return `Datei fehlt: ${fehlt.join(', ')}`;
  const ausserhalb = vs.filter((v) => v.von !== undefined && (v.von < 1 || (v.bis ?? 0) < v.von || (v.bis ?? 0) > zeilenZahl(quelle(v.datei))));
  if (ausserhalb.length > 0) return `Zeilen außerhalb der Datei: ${ausserhalb.map((v) => `${v.datei}:${v.von}-${v.bis}`).join(', ')}`;
  return null;
}

/** null = Zeile abgehakt; sonst der erste Grund, warum nicht. */
function zeilenFehler(z: Zeile): string | null {
  if (z.zellen.length !== 7) return `${z.zellen.length} statt 7 Spalten`;
  const k = z.zellen[6];
  if (!k.startsWith('✓ ')) return '„künftig wo“ ohne Haken';
  const ohneCode = k.replace(/`[^`]*`/g, '');
  if (ohneCode.includes('"')) return 'ASCII-Anführungszeichen';
  if (FREMD.test(ohneCode)) return 'Verweis außerhalb von B1–B22';
  const f = form(k);
  if (f === undefined) return `Ort nicht aus dem Ortsregister: ${k.slice(2, 50)}`;
  if ((f.form === 'ersetzt durch' || f.form === 'entfällt') && !VERWEIS.test(ohneCode)) return `„${f.form}“ ohne B-Verweis`;
  if (/entf(?:ä|a)llt/.test(ohneCode) && !VERWEIS.test(ohneCode)) return '„entfällt“ im Text ohne B-Verweis';
  const dateien = [...new Set(verweise(k).map((v) => v.datei).filter((d) => d !== ''))];
  if (f.form !== 'entfällt' && dateien.length === 0) return 'Ort ohne Datei';
  if (dateien.some((d) => GELOESCHT.includes(d))) return 'gelöschte Datei im Haken';
  const vf = verweisFehler(k);
  if (vf !== null) return vf;
  // „unverändert“ und die Orte „… (unverändert)“: nur Dateien, die seit der Erhebung gleich sind, oder erlaubte mit ihrem Verweis.
  if (f.form === 'unverändert' || (f.ort !== undefined && UNVERAENDERT_ORTE.includes(f.ort))) {
    for (const d of dateien) {
      const kd = kanon(d);
      if (!GEAENDERT_KANON.has(kd) && GIT?.has(kd) !== true) continue;
      const refs = ERLAUBT.get(kd);
      if (refs === undefined) return `unverändert mit geänderter Datei ${d}`;
      if (!refs.some((r) => new RegExp(`(?<![\\w-])${r}(?![\\w-])`).test(k))) return `unverändert mit ${d} ohne Verweis auf ${refs.join(' oder ')}`;
    }
  }
  return null;
}

const text = leseText(LISTE);
const alle = zeilen(text);
const kopfText = text.slice(0, text.indexOf('\n---\n'));

gleich(alle.length, GESAMT, 'CN Funktionsliste: 209 Zeilen in den Abschnitten 1–7 (Stand Task 20)');
gleich(
  JE_ABSCHNITT.map((_, i) => alle.filter((z) => z.abschnitt === i + 1).length),
  JE_ABSCHNITT,
  'CN Funktionsliste: Zeilen je Abschnitt wie in Task 20 (105/26/52/9/1/7/9)',
);
gleich(
  alle.map((z) => z.nr),
  alle.map((_, i) => i + 1),
  'CN Funktionsliste: Nummern fortlaufend ab 1',
);
gleich(
  Object.keys(TEILTABELLEN).map((t) => alle.filter((z) => z.teil === t).map((z) => z.nr)),
  Object.values(TEILTABELLEN).map(([von, bis]) => Array.from({ length: bis - von + 1 }, (_, i) => von + i)),
  'CN Funktionsliste: Abschnitt 4 mit den Teiltabellen 4a Peer-Fenster (184–186), 4b Tray (187–190), 4c Ladescreen und „Über“ (191–192)',
);
ok(!text.replace(/`[^`]*`/g, '').includes('"') && !text.includes('\r'), 'CN Funktionsliste: keine ASCII-Anführungszeichen außerhalb von Code, kein CR');
ok(ORTE.every((o) => kopfText.includes(o)) && !kopfText.includes('bleibt leer'), 'CN Funktionsliste: der Kopf nennt das Ortsregister und sagt nicht mehr „bleibt leer“');
gleich(
  ABSCHNITTE,
  [REMOTE_TEXTE.titel, CONNECT_TEXTE.titel.cloud, CONNECT_TEXTE.titel.zoomEinrichtung, CONNECT_TEXTE.titel.zoomVorgaben],
  'CN Funktionsliste: die Orte „Panel ‹Abschnitt›“ heißen wie die Abschnitte im Panel (RemoteControlSection und CONNECT_TEXTE.titel)',
);
{
  const co = quelle('R/views/ConnectOberflaeche.tsx');
  ok(
    co.includes('tool="Connect"') &&
      co.includes('data-connect="untertitel"') &&
      co.includes('{NDI_TEXT.t145}') &&
      co.includes('data-connect="cloud-raum"') &&
      co.includes('data-connect="zoom-spalte"') &&
      co.includes('status={statusLeiste(stand)}') &&
      quelle('R/views/CloudRaum.tsx').includes('data-connect="gaesteliste"') &&
      quelle('R/views/Fusszeile.tsx').includes('data-connect="fusszeile"'),
    'CN Funktionsliste: zu jedem Ort gibt es den Bereich im Rahmen (Kopf, Untertitel T145, Cloud-Raum, Gästeliste, Zoom-Spalte, Fußzeile, Statusleiste)',
  );
}

for (const z of alle) {
  const f = zeilenFehler(z);
  ok(f === null, `CN Funktionsliste Nr. ${z.nr} abgehakt${f === null ? '' : ` – ${f}`}`);
}

// ── Spalten 1–6: jede genannte Datei gibt es heute oder ist seit der Erhebung gelöscht; „heute wo“ bleibt beim Stand der Erhebung ──
{
  const fehlt: string[] = [];
  const zeilenFalsch: string[] = [];
  for (const z of alle) {
    for (const zelle of z.zellen.slice(0, 6)) {
      for (const v of verweise(zelle)) {
        if (v.datei === '') fehlt.push(`Nr. ${z.nr}: Zeilenangabe ohne Datei`);
        else if (!gibtEs(v.datei) && !GELOESCHT.includes(v.datei)) fehlt.push(`Nr. ${z.nr}: ${v.datei}`);
        else if (GIT_PRUEFEN && v.bis !== undefined) {
          const n = altZeilen(v.datei);
          if (n >= 0 && v.bis > n) zeilenFalsch.push(`Nr. ${z.nr}: ${v.datei}:${v.bis} > ${n}`);
        }
      }
    }
  }
  ok(fehlt.length === 0, `CN Funktionsliste: jede in den Spalten 1–6 genannte Datei gibt es oder sie ist gelöscht (fehlt: ${fehlt.join('; ') || 'nichts'})`);
  if (GIT_PRUEFEN) ok(zeilenFalsch.length === 0, `CN Funktionsliste: die Zeilenangaben der Spalten 1–6 liegen in den Dateien der Erhebung (${zeilenFalsch.join('; ') || 'alle'})`);
  ok(GELOESCHT.every((d) => !gibtEs(d)), 'CN Funktionsliste: die gelöschte Datei (R/index.css, jetzt R/globals.css) gibt es nicht mehr');
  const heuteWo = createHash('sha256').update(alle.map((z) => z.zellen[5]).join('\n')).digest('hex');
  gleich(heuteWo, HEUTE_WO_SHA256, 'CN Funktionsliste: „heute wo“ bleibt beim Stand der Erhebung (eine Spalte, ein Stand; heutige Zeilen stehen im Haken)');
  if (GIT_PRUEFEN) {
    const vorher = git(['show', `${LISTE_VORHER}:docs/ux/funktionslisten/connect.md`]);
    if (vorher !== null) {
      const alt = new Map(zeilen(vorher).map((z) => [z.nr, z.zellen] as const));
      const anders = alle.flatMap((z) =>
        z.zellen.slice(0, 6).flatMap((zelle, i) => (zelle === alt.get(z.nr)?.[i] || KORRIGIERT[z.nr]?.includes(i) === true ? [] : [`Nr. ${z.nr} Spalte ${i + 1}`])),
      );
      ok(anders.length === 0, `CN Funktionsliste: Spalten 1–6 gleich dem Stand ${LISTE_VORHER}, außer den Korrekturen in Task 25 (anders: ${anders.join(', ') || 'nichts'})`);
      const korrigiertAnders = Object.keys(KORRIGIERT).filter((n) => alle.find((z) => z.nr === Number(n))?.zellen[2] === alt.get(Number(n))?.[2]);
      ok(korrigiertAnders.length === 0, `CN Funktionsliste: jede Korrektur in KORRIGIERT ist auch eine (unverändert: ${korrigiertAnders.join(', ') || 'keine'})`);
    }
  }
}

// ── Die Mengen der geänderten Dateien stimmen mit git überein; verschobene Abläufe zeichengleich (nur mit JM_FUNKTIONSLISTE_GIT=1) ──
{
  if (GIT !== null) {
    const fehlend = [...GIT].filter((n) => n.startsWith('apps/connect/') && !GEAENDERT_KANON.has(n));
    ok(fehlend.length === 0, `CN Funktionsliste: GEAENDERT nennt alle seit ${ERHEBUNG} geänderten Dateien von apps/connect (fehlt: ${fehlend.join(', ') || 'nichts'})`);
    const zuviel = GEAENDERT.filter((n) => !GIT.has(n));
    ok(zuviel.length === 0, `CN Funktionsliste: GEAENDERT nennt keine Datei, die git nicht als geändert kennt (zu viel: ${zuviel.join(', ') || 'nichts'})`);
    const pakete = [...GIT].filter((n) => /^packages\/[^/]+\/src\//.test(n));
    const paketFehlt = pakete.filter((n) => !PAKETE_GEAENDERT.includes(n));
    const paketZuviel = PAKETE_GEAENDERT.filter((n) => !GIT.has(n));
    ok(paketFehlt.length === 0 && paketZuviel.length === 0, `CN Funktionsliste: PAKETE_GEAENDERT gleich den geänderten Quelldateien der Pakete (fehlt: ${paketFehlt.join(', ') || 'nichts'}; zu viel: ${paketZuviel.join(', ') || 'nichts'})`);
    // src/shared/zoom-text.ts steht in ERLAUBT nur mit ohneVorsatz: ohne diese eine Funktion samt Kommentar ist die Datei die der Erhebung.
    const ztAlt = git(['show', `${ERHEBUNG}:apps/connect/src/shared/zoom-text.ts`]);
    if (ztAlt !== null) {
      const ohneOhneVorsatz = quelle('src/shared/zoom-text.ts').replace(/\/\*\*\n(?: \*[^\n]*\n)*? \*\/\nexport function ohneVorsatz\([\s\S]*?\n\}\n\n/, '');
      ok(ohneOhneVorsatz !== quelle('src/shared/zoom-text.ts') && ohneOhneVorsatz === ztAlt, 'CN Funktionsliste: src/shared/zoom-text.ts bekam seit der Erhebung nur ohneVorsatz (Beleg für „unverändert … ohneVorsatz“ an den Tray-Zeilen)');
    }
    // Abschnitt 3: die Abläufe der Wurzel-View und die Handler der Zoom-Spalte sind ohne Kommentare zeichengleich mit der Erhebung.
    const ohne = (s: string): string => ohneKommentare(s).replace(/\s+/g, ' ').trim();
    const block = (s: string, anfang: string, ende: string): string | null => {
      const z = s.split('\n');
      const i = z.findIndex((l) => l.includes(anfang));
      const j = z.findIndex((l, k) => k > i && l === ende);
      return i < 0 || j < 0 ? null : z.slice(i, j + 1).join('\n');
    };
    const appAlt = git(['show', `${ERHEBUNG}:apps/connect/src/renderer/src/App.tsx`]);
    const zcAlt = git(['show', `${ERHEBUNG}:apps/connect/src/renderer/src/zoom/ZoomCard.tsx`]);
    if (appAlt !== null && zcAlt !== null) {
      const wurzel: Array<[string, string]> = [
        ['const send = useCallback(', '  }, []);'],
        ['const talkbackDown = useCallback(', '  );'],
        ['const talkbackUp = useCallback(', '  }, [send]);'],
        ['const folien = useCallback(', '  );'],
        ['const pushControlState = useCallback(', '  }, []);'],
        ['const handleMessage = useCallback(', '  );'],
        ['const openRoom = useCallback(', '  );'],
        ['const inviteGuest = useCallback(', '  }, [guestName]);'],
        ['const inviteSpeakers = useCallback(', '  }, [show, invites]);'],
        ['const closeRoom = useCallback(', '  );'],
        ['const wachhundWeg = useCallback(', '  }, [clearWatchdog]);'],
        ['void window.jmconnect.getStatus().then(setStatus);', '  }, [clearWatchdog, closeRoom, send]);'],
      ];
      const co = quelle('R/views/ConnectOberflaeche.tsx');
      const anders = wurzel.filter(([a, e]) => {
        const x = block(appAlt, a, e);
        const y = block(co, a, e);
        return x === null || y === null || ohne(x) !== ohne(y);
      });
      ok(anders.length === 0, `CN Funktionsliste Abschnitt 3: Raum-Client, Raum-Folge, Wachhund, Talkback, Folien, STATE, Einladen, Abos und Fernbefehle in der Wurzel-View zeichengleich mit App.tsx der Erhebung (anders: ${anders.map(([a]) => a).join(' | ') || 'nichts'})`);
      const zoom: Array<[string, string]> = [
        ['const holeLetztes = useCallback((): void => {', '  }, []);'],
        ['const beitreten = (): void => {', '  };'],
        ['const vergessen = (): void => {', '  };'],
        ['const verlassen = (): void => {', '  };'],
        ['const uebernimmVersatz = (): void => {', '  };'],
      ];
      const zc = quelle('R/zoom/ZoomCard.tsx');
      const zAnders = zoom.filter(([a, e]) => {
        const x = block(zcAlt, a, e);
        const y = block(zc, a, e);
        return x === null || y === null || ohne(x) !== ohne(y);
      });
      ok(zAnders.length === 0, `CN Funktionsliste Nr. 69–77: gemerktes Meeting, Beitreten, Vergessen, Verlassen und Bild-Versatz zeichengleich mit der ZoomCard der Erhebung (anders: ${zAnders.map(([a]) => a).join(' | ') || 'nichts'})`);
    }
  }
  // Negativproben: eine geänderte Datei in jeder Schreibweise, eine erlaubte nur mit ihrem Verweis, eine unveränderte frei.
  const synth = (k: string): Zeile => ({ abschnitt: 3, teil: '', nr: 0, zellen: ['0', '', '', '', '', '', k] });
  ok(
    ['R/views/CloudRaum.tsx', 'src/renderer/src/views/CloudRaum.tsx', 'apps/connect/src/renderer/src/views/CloudRaum.tsx'].every((p) =>
      (zeilenFehler(synth(`✓ unverändert (\`${p}\`): x`)) ?? '').includes('geänderter Datei'),
    ) &&
      (zeilenFehler(synth('✓ unverändert (`src/main/index.ts`): x')) ?? '').includes('ohne Verweis auf B2') &&
      zeilenFehler(synth('✓ unverändert (`src/main/index.ts`, B2): x')) === null &&
      (zeilenFehler(synth('✓ unverändert (`src/renderer/index.html`, B2): x')) ?? '').includes('ohne Verweis auf B4') &&
      zeilenFehler(synth('✓ unverändert (`src/renderer/index.html`, B4): x')) === null &&
      (zeilenFehler(synth('✓ Tray (unverändert) (`src/shared/zoom-text.ts`, B2): x')) ?? '').includes('ohne Verweis auf ohneVorsatz') &&
      (zeilenFehler(synth('✓ Tray (unverändert) (`src/shared/zoom-text.ts`): ohneVorsatzX')) ?? '').includes('ohne Verweis auf ohneVorsatz') &&
      zeilenFehler(synth('✓ Tray (unverändert) (`src/shared/zoom-text.ts`): bekam nur ohneVorsatz')) === null &&
      (zeilenFehler(synth('✓ Peer-Fenster (unverändert) (`src/main/index.ts`): x')) ?? '').includes('ohne Verweis auf B2') &&
      zeilenFehler(synth('✓ unverändert (`src/main/room.ts`): x')) === null &&
      (zeilenFehler(synth('✓ unverändert (`packages/ui/src/components/TallyButton.tsx`): x')) ?? '').includes('geänderter Datei'),
    'CN Funktionsliste: unverändert erkennt geänderte Dateien in jeder Schreibweise; B2, B4 und ohneVorsatz entlasten nur ihre Dateien; unveränderte Dateien sind frei',
  );
  ok(
    zeilenFehler(synth('✓ entfällt (x, B1)')) === null &&
      zeilenFehler(synth('✓ entfällt (x, B22)')) === null &&
      ['B0', 'B23', 'E57', 'E16', 'E2'].every((r) => (zeilenFehler(synth(`✓ entfällt (x, ${r})`)) ?? '').includes('Verweis außerhalb')) &&
      (zeilenFehler(synth('✓ entfällt (x)')) ?? '').includes('ohne B-Verweis') &&
      (zeilenFehler(synth('✓ ersetzt durch Cloud-Raum (`R/views/CloudRaum.tsx`)')) ?? '').includes('ohne B-Verweis') &&
      (zeilenFehler(synth('✓ Cloud-Raum (`R/views/CloudRaum.tsx`): Knopf entfällt')) ?? '').includes('ohne B-Verweis'),
    'CN Funktionsliste: nur B1–B22 gelten (B0, B23 und jedes E nicht); entfällt und ersetzt brauchen einen B-Verweis',
  );
  ok(
    ['Panel', 'Panel Gibtsnicht', 'Panel Zoom', 'Cloud-Raum links', 'Inhalt oben', 'Inhalt', 'Tray', 'Peer-Fenster', 'Zoom-Karte', 'Panel cloud-zugang', 'Statusleiste Raum'].every((o) =>
      (zeilenFehler(synth(`✓ ${o} (\`R/views/CloudRaum.tsx\`): x`)) ?? '').includes('Ortsregister'),
    ) &&
      (zeilenFehler(synth('✓ ersetzt durch Panel (`R/views/Einstellungen.tsx`, B20): x')) ?? '').includes('Ortsregister') &&
      ORTE.every((o) => zeilenFehler(synth(`✓ ${o} (\`${UNVERAENDERT_ORTE.includes(o) ? 'src/main/room.ts' : 'R/views/CloudRaum.tsx'}\`): x`)) === null),
    'CN Funktionsliste: das Ortsregister ist streng (kein bloßes „Panel“, kein angehängtes Wort, „Inhalt oben“ nur mit „(T145)“, Groß- und Kleinschreibung zählt); jeder Eintrag gilt',
  );
  ok(
    (zeilenFehler(synth('✓ Cloud-Raum')) ?? '').includes('Ortsregister') &&
      (zeilenFehler(synth('✓ Cloud-Raum (B21): x')) ?? '').includes('Ort ohne Datei') &&
      (zeilenFehler(synth('✓ Cloud-Raum (`R/views/CloudRaum.tsx:900-901`)')) ?? '').includes('Zeilen außerhalb') &&
      (zeilenFehler(synth('✓ Cloud-Raum (`R/views/Gibtsnicht.tsx`)')) ?? '').includes('Datei fehlt') &&
      (zeilenFehler(synth('✓ Cloud-Raum (`r/views/CloudRaum.tsx`)')) ?? '').includes('Datei fehlt') &&
      (zeilenFehler(synth('✓ Cloud-Raum (`R/index.css`): x')) ?? '').includes('gelöschte Datei') &&
      (zeilenFehler(synth('✓ Cloud-Raum (`:12-14`, `R/views/CloudRaum.tsx`)')) ?? '').includes('ohne Datei davor') &&
      (zeilenFehler(synth('✓ Cloud-Raum (`R/views/CloudRaum.tsx`): Text mit "Zitat"')) ?? '').includes('ASCII'),
    'CN Funktionsliste: Ort mit Datei, Zeilen in der Datei, Schreibweise wie im Repo, keine gelöschte Datei im Haken, kein ASCII-Anführungszeichen',
  );
}

/** Alle Dateien des Renderers (ohne das Peer-Fenster), Pfad ab R/. */
const rendererDateien = (): string[] =>
  readdirSync('src/renderer/src', { recursive: true })
    .map((d) => String(d).replace(/\\/g, '/'))
    .filter((d) => /\.(?:ts|tsx)$/.test(d) && d !== 'peer.tsx');
/** Der ganze Renderer ohne Kommentare (Kommentare nennen alte Namen wie PttButton). */
const rendererQuelle = (): string => rendererDateien().map((d) => ohneKommentare(quelle(`R/${d}`))).join('\n');
const zaehle = (s: string, teil: string): number => s.split(teil).length - 1;

const zeile = (nr: number): Zeile | undefined => alle.find((z) => z.nr === nr);
const element = (nr: number): string => zeile(nr)?.zellen[2] ?? '';
const kuenftig = (nr: number): string => zeile(nr)?.zellen[6] ?? '';
const beginnt = (nr: number, ...orte: string[]): boolean => orte.some((o) => form(kuenftig(nr))?.form === 'Ort' && form(kuenftig(nr))?.ort === o);
const ersetzt = (nr: number, ort: string): boolean => form(kuenftig(nr))?.form === 'ersetzt durch' && form(kuenftig(nr))?.ort === ort;
const unveraendert = (nr: number): boolean => form(kuenftig(nr))?.form === 'unverändert';
const nennt = (nr: number, ...woerter: string[]): boolean => woerter.every((w) => kuenftig(nr).includes(w));
const mitVerweis = (nr: number, ...refs: string[]): boolean => refs.every((r) => new RegExp(`\\b${r}\\b`).test(kuenftig(nr).replace(/`[^`]*`/g, '')));

/** Der im Haken der Zeile für `datei` zitierte Bereich als Quelltext von heute; leer, wenn der Haken die Datei ohne Zeilen nennt. */
function zitiert(nr: number, datei: string): string {
  return verweise(kuenftig(nr))
    .filter((x) => x.datei === datei && x.von !== undefined && x.bis !== undefined)
    .map((v) => quelle(datei).split('\n').slice((v.von ?? 1) - 1, v.bis).join('\n'))
    .join('\n');
}
const zeigtAuf = (nr: number, datei: string, ...woerter: string[]): boolean => {
  const z = zitiert(nr, datei);
  return z !== '' && woerter.every((w) => z.includes(w));
};

const CO = 'R/views/ConnectOberflaeche.tsx';
const CR = 'R/views/CloudRaum.tsx';
const OF = 'R/lib/oberflaeche.ts';

// ── Pflichtzeilen Verben (Nr. 140–159): Raum-Verben in der Wurzel-View, zoom_*-Verben im Main unverändert, Steuerserver 8737 ──
{
  const co = quelle(CO);
  const raumVerben: Array<[number, string]> = [
    [142, "go: { t: 'go' }"],
    [143, "next: { t: 'next' }"],
    [144, "onair: { t: 'onair', guestId }"],
    [145, "off: { t: 'off', guestId }"],
    [146, "approve: { t: 'approve', guestId }"],
    [147, "kick: { t: 'kick', guestId }"],
    [148, "standby: { t: 'standby', guestId }"],
    [149, "if (cmd.verb === 'slides') {"],
    [150, "if (cmd.verb === 'talkback') {"],
    [151, 'if (action) send(action);'],
  ];
  const falsch = raumVerben.filter(([nr, fall]) => !co.includes(fall) || !beginnt(nr, 'Cloud-Raum') || !zeigtAuf(nr, CO, fall));
  ok(falsch.length === 0, `CN Funktionsliste Nr. 142–151 (Raum-Verben): jeder Haken beim Ort Cloud-Raum und zeigt auf seinen Fall im Fernbefehl der Wurzel-View (falsch: ${falsch.map(([n]) => n).join(', ') || 'keine'})`);
  const zoomVerben: Array<[number, string]> = [
    [152, "case 'zoom_load':"],
    [153, "case 'zoom_unload':"],
    [154, "case 'zoom_delay':"],
    [155, "v === 'zoom_slot'"],
    [156, "if (v === 'zoom_slot_mode') {"],
    [157, "if (v === 'zoom_slot_person')"],
    [158, "art: 'slotTon'"],
  ];
  const zFalsch = zoomVerben.filter(([nr, fall]) => !unveraendert(nr) || !zeigtAuf(nr, 'src/main/zoom/fernsteuerung.ts', fall));
  ok(zFalsch.length === 0, `CN Funktionsliste Nr. 152–158 (zoom_*-Verben): jeder Haken unverändert und zeigt auf seine Deutung in src/main/zoom/fernsteuerung.ts (falsch: ${zFalsch.map(([n]) => n).join(', ') || 'keine'})`);
  ok(unveraendert(159) && unveraendert(141) && zeigtAuf(141, 'src/main/control-state.ts', "cmd.verb.startsWith('zoom_')") && mitVerweis(141, 'B2'), 'CN Funktionsliste Nr. 141/159: Weiche und Ergebnis der zoom_*-Verben unverändert');
  const cs = quelle('src/main/control-server.ts');
  ok(
    cs.includes('export const CONTROL_PORT = 8737;') && STEUER_PORT === 8737 &&
      beginnt(140, 'Statusleiste') && mitVerweis(140, 'B2') && zeigtAuf(140, 'src/main/control-server.ts', 'onStatus', 'server.start(CONTROL_PORT)') && nennt(140, 'Panel Fernsteuerung'),
    'CN Funktionsliste Nr. 140: der Steuerserver ist jetzt als Eintrag Fernsteuerung sichtbar (Meldung aus onStatus, B2), Start auf CONTROL_PORT 8737 wie bisher',
  );
  ok(unveraendert(139) && mitVerweis(139, 'B2') && beginnt(138, 'Cloud-Raum') && zeigtAuf(138, CO, 'window.jmconnect.pushControlState({'), 'CN Funktionsliste Nr. 138/139: STATE aus der Wurzel-View (Raum-Teil) und aus dem Main unverändert');
}

// ── Pflichtzeilen Tastatur (Nr. 194–199): keine neuen Kürzel (B1), Standardmenü, Enter in Feldern, Halten per Taste über die Bausteine ──
{
  const renderer = rendererQuelle();
  const tastenHoerer = renderer.match(/onKeyDown=\{\((\w+)\) => \{\s*if \(\1\.key === 'Enter'/g) ?? [];
  ok(
    !/addEventListener\(\s*'key/.test(renderer) && !renderer.includes('shortcut=') && zaehle(renderer, 'onKeyDown') === tastenHoerer.length && tastenHoerer.length >= 5 &&
      beginnt(194, 'Kopf') && mitVerweis(194, 'B1') && nennt(194, 'keine eigenen Kürzel'),
    'CN Funktionsliste Nr. 194: weiter keine eigenen Kürzel im Renderer (kein Tastenhörer, kein shortcut; jedes onKeyDown ist Enter in einem Feld, B1)',
  );
  const main = readdirSync('src/main', { recursive: true })
    .map((d) => String(d).replace(/\\/g, '/'))
    .filter((d) => d.endsWith('.ts'))
    .map((d) => quelle(`src/main/${d}`))
    .join('\n');
  ok(!main.includes('setApplicationMenu') && !main.includes('globalShortcut'), 'CN Funktionsliste Nr. 195: weiter kein eigenes Menü und kein globalShortcut im Main (Electron-Standardmenü)');
  ok(
    zeile(195)?.zellen[1] === 'Kürzel' && unveraendert(195) && mitVerweis(195, 'B2') &&
      ['Standardmenü', 'Strg+R', 'Raumverbindung fällt', 'Strg+W', 'Datei › Beenden', 'Panel'].every((w) => kuenftig(195).includes(w)) &&
      zeigtAuf(195, 'src/main/index.ts', 'createMainWindow({', "app.on('before-quit'"),
    'CN Funktionsliste Nr. 195 (Pflichtzeile Standardmenü): abgehakt mit Strg+R (die Raumverbindung fällt), Strg+W und Datei › Beenden; der Haken zeigt auf Fenster und Beenden',
  );
  ok(
    beginnt(196, 'Zoom-Spalte') && nennt(196, 'Enter', 'Gast einladen') && zeigtAuf(196, 'R/views/CloudZugang.tsx', "e.key === 'Enter'") && zeigtAuf(196, 'R/zoom/ZoomVorgaben.tsx', "ev.key === 'Enter'"),
    'CN Funktionsliste Nr. 196: Enter übernimmt in den Feldern wie bisher, Cloud-Adresse und Haltezeit jetzt im Panel',
  );
  ok(unveraendert(197) && zeigtAuf(197, 'src/main/index.ts', 'kontextMenueVorlage(params)'), 'CN Funktionsliste Nr. 197: Rechtsklick-Menü unverändert');
  ok(
    beginnt(198, 'Cloud-Raum') && nennt(198, 'Leertaste', 'Enter', 'Talkback alle', '🎙') && mitVerweis(198, 'B1') &&
      quelle('packages/ui/src/components/TallyButton.tsx').includes("e.key === 'Enter' && e.repeat") && zeigtAuf(198, 'packages/ui/src/components/TallyButton.tsx', 'onKeyDown(e)'),
    'CN Funktionsliste Nr. 198: Leertaste und Enter auf Knöpfen; Talkback alle und 🎙 halten jetzt auch per Taste (Baustein, B1), ein gehaltenes Enter löst nur einmal aus',
  );
  // Nachtrag Task 25 (Befund 11, Wahl ≠ Bewegung): an einem laufenden Slot und beim Sprecher-Signal wählt eine Pfeiltaste nur einen
  // Entwurf, erst „Setzen“ sendet; die übrigen Auswahlen und die Schalter senden wie bisher sofort.
  ok(
    beginnt(199, 'Zoom-Spalte') && nennt(199, 'Pfeiltasten', 'Befund 11', 'Panel', 'Setzen', 'Wahl ≠ Bewegung') &&
      zeigtAuf(199, 'R/zoom/SlotEinstellungen.tsx', 'wahl.waehlen({ aufloesung: ev.target.value', 'wahl.waehlen({ bildformat: ev.target.value') &&
      zeigtAuf(199, 'R/zoom/ZoomVorgaben.tsx', 'onChange={() => signal.waehlen(s)}'),
    'CN Funktionsliste Nr. 199: Pfeiltasten auf den Auswahlen eines laufenden Slots und im Sprecher-Signal wählen nur, erst „Setzen“ sendet (Befund 11); die übrigen Auswahlen und die Schalter senden wie bisher sofort',
  );
  ok(
    beginnt(95, 'Zoom-Spalte') && nennt(95, 'Setzen', 'Befund 11', 'Wahl ≠ Bewegung', 'Entwurf') &&
      zeigtAuf(95, 'R/zoom/SlotEinstellungen.tsx', 'export function slotWahl(', 'data-connect="slot-setzen"', 'if (!laeuft) setEntwurf({});') &&
      ersetzt(83, 'Panel Zoom-Vorgaben') && nennt(83, 'Setzen', 'Entwurf') && zeigtAuf(83, 'R/zoom/ZoomVorgaben.tsx', 'export function sprecherWahl(', 'data-connect="sprecher-setzen"') &&
      nennt(209, 'Sprecher-Signal', 'laufenden Slots'),
    'CN Funktionsliste Nr. 95, 83, 209: Auswahlen eines laufenden Slots und das Sprecher-Signal halten einen Entwurf, „Setzen“ sendet ihn (Befund 11); die Entwürfe werden nicht gemerkt',
  );
}

// ── Pflichtpunkt Panel-Tasten (Nr. 200, O1): Feld behält Tasten, Leertaste auf Knopf/Schalter geht ans Tool, Escape schließt ──
{
  ok(
    zeile(200)?.zellen[1] === 'Panel-Tasten' && beginnt(200, 'Panel Fernsteuerung') && ['Leertaste', 'Escape', 'Feld', 'Knopf', 'Schalter', 'O1'].every((w) => kuenftig(200).includes(w)) && mitVerweis(200, 'B8', 'B20'),
    'CN Funktionsliste Nr. 200 (Pflichtpunkt Panel-Tasten): Leertaste und Escape, je für Feld und Knopf/Schalter (Spec 10, O1), Panel nach B8/B20',
  );
  const panel = quelle('packages/ui/src/components/SettingsPanel.tsx');
  ok(
    panel.includes("e.key === 'Escape'") && panel.includes('defaultPrevented') && panel.includes("'SELECT'") && zeigtAuf(200, 'packages/ui/src/components/SettingsPanel.tsx', 'export function panelTaste'),
    'CN Funktionsliste Nr. 200: SettingsPanel schließt mit Escape (nur ohne defaultPrevented), Felder samt Auswahl behalten ihre Tasten',
  );
  const co = quelle(CO);
  ok(
    co.includes('settings={<Einstellungen stand={stand} aktionen={p.aktionen} proxyAdresse={p.proxyAdresse} zoom={p.zoom} />}') && !/panelOffen\s*(?:&&|\?)/.test(ohneKommentare(co)),
    'CN Funktionsliste Nr. 200: das Panel ist immer angeboten (Fernsteuerung, Cloud-Zugang, unter Windows Zoom-Einrichtung und Zoom-Vorgaben), nichts im Rahmen hängt am Panelzustand',
  );
}

// ── Abläufe aus Abschnitt 3: Raum, Abos und Zoom-Abbild in der Wurzel-View, nicht im Panel (B8); Main unverändert bis auf B2 ──
{
  const panelDateien = ['R/views/Einstellungen.tsx', 'R/views/CloudZugang.tsx', 'R/zoom/ZoomEinrichtung.tsx', 'R/zoom/ZoomVorgaben.tsx'];
  const verboten = ['useEffect', 'addEventListener', 'useBrueckenWert(', 'getStatus(', 'getProxy(', 'zoomGet(', 'onZoom(', 'onStatus(', 'SignallingClient'];
  const panelFalsch = panelDateien.filter((d) => {
    const q = ohneKommentare(quelle(d));
    return verboten.some((w) => q.includes(w));
  });
  ok(panelFalsch.length === 0, `CN Funktionsliste Abschnitt 3: das Panel (Einstellungen, Cloud-Zugang, Zoom-Einrichtung, Zoom-Vorgaben) hat keine Effekte, kein Abo, keinen Raum-Client (B8; falsch: ${panelFalsch.join(', ') || 'keine'})`);
  ok(
    ['R/views/Einstellungen.tsx', 'R/views/CloudZugang.tsx'].every((d) => !/\bwindow\b/.test(ohneKommentare(quelle(d)))) &&
      ['R/zoom/ZoomEinrichtung.tsx', 'R/zoom/ZoomVorgaben.tsx'].every((d) => (ohneKommentare(quelle(d)).match(/\bwindow\b/g) ?? []).length === 1 && ohneKommentare(quelle(d)).includes('() => window.jmconnect)')),
    'CN Funktionsliste Abschnitt 3: das Panel liest window nicht; die Zoom-Abschnitte reichen window.jmconnect nur als Ziel der Aufrufe beim Klick weiter',
  );
  const renderer = rendererQuelle();
  const co = ohneKommentare(quelle(CO));
  const einmal = ['new SignallingClient(', 'onControlCommand(', 'onTrayCommand(', 'onStatus(', 'onShow(', 'getStatus(', 'getShow(', 'getProxy(', 'zoomGet(', 'onZoom(', 'useBrueckenWert(MASTER_LINK_QUELLE)', 'useBrueckenWert(FERNSTEUERUNG_QUELLE)'];
  const nichtEinmal = einmal.filter((w) => zaehle(renderer, w) !== 1 || zaehle(co, w) !== 1);
  ok(nichtEinmal.length === 0, `CN Funktionsliste Nr. 132, 161, 162, 180, 52: Raum-Client, Abos, Show, Status, Adresse, Zoom-Abbild, Master-Link und Fernsteuerung je genau einmal in der Wurzel-View (nicht so: ${nichtEinmal.join(', ') || 'keine'})`);
  const wurzelZeilen: Array<[number, string]> = [
    [132, 'new SignallingClient({'],
    [133, "if (msg.action === 'up') window.jmconnect.ndiUp("],
    [134, 'window.jmconnect.slideCue(msg.dir'],
    [135, 'setRaumabbruch(true);'],
    [136, 'raumFolge.oeffnen('],
    [161, 'window.jmconnect.onShow(setShow)'],
    [162, 'window.jmconnect.onStatus(setStatus)'],
  ];
  const wFalsch = wurzelZeilen.filter(([nr, w]) => !zeigtAuf(nr, CO, w));
  ok(wFalsch.length === 0, `CN Funktionsliste Nr. 132–136, 161, 162: die Haken zeigen auf die Abläufe in der Wurzel-View (falsch: ${wFalsch.map(([n]) => n).join(', ') || 'keine'})`);
  ok(
    beginnt(160, 'Cloud-Raum') && zeigtAuf(160, CO, "if (cmd.kind === 'closeRoom') void closeRoom();") && zeigtAuf(160, 'src/main/tray.ts', "kind: 'closeRoom'") && nennt(160, 'Tray (unverändert)'),
    'CN Funktionsliste Nr. 160 (Pflichtzeile Tray „Raum schließen“): das unveränderte Tray ruft über das Hauptfenster dieselbe Funktion wie die Raum-Taste',
  );
  const mainUnveraendert = [1, 2, 3, 4, 7, 107, 131, 137, 139, 141, 152, 153, 154, 155, 156, 157, 158, 159, 163, 164, 165, 166, 167, 169, 170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 181, 182, 183, 191, 192, 193, 195, 197, 202, 203, 204, 205, 206, 207, 208];
  const nichtUnveraendert = mainUnveraendert.filter((nr) => !unveraendert(nr));
  ok(nichtUnveraendert.length === 0, `CN Funktionsliste Abschnitt 1/2/3/4/5/6/7: Fenster, Main-Abläufe, Raum im Main, STATE, zoom_*-Verben, Zugang, NDI, Zoom-Kern, Start, Ende, Ladescreen, Ausgabe und Dateien laufen unverändert (nicht so: ${nichtUnveraendert.join(', ') || 'keine'})`);
  ok(
    beginnt(180, 'Statusleiste') && mitVerweis(180, 'B2') && zeigtAuf(180, 'src/preload/index.ts', 'jmps:master-link') && zeigtAuf(180, OF, 'masterLinkStatusItem(s.masterLink)'),
    'CN Funktionsliste Nr. 180: der Master-Link steht jetzt in der Statusleiste (Preload liest ihn, B2)',
  );
}

// ── Zusatzfenster (Abschnitt 4): Peer-Fenster und Tray unverändert, Ladescreen und „Über“ unverändert; Ausgabe (5) unverändert ──
{
  ok(
    [184, 185, 186, 129, 168].every((nr) => beginnt(nr, 'Peer-Fenster (unverändert)')) && ['src/renderer/src/peer.tsx', 'src/renderer/peer.html', 'src/main/peer-window.ts'].every((d) => !GEAENDERT.includes(`apps/connect/${d}`)),
    'CN Funktionsliste Nr. 184–186, 129, 168: Peer-Fenster samt Talkback-Mikro unverändert (peer.tsx, peer.html, peer-window.ts seit der Erhebung gleich)',
  );
  const tray = quelle('src/main/tray.ts');
  ok(
    [187, 188, 189, 190].every((nr) => beginnt(nr, 'Tray (unverändert)')) && [187, 190].every((nr) => nennt(nr, 'ohneVorsatz')) && mitVerweis(189, 'B2') &&
      ["label: 'Fenster anzeigen'", "label: 'Raum schließen', enabled: status.ndiGaeste.length > 0", "label: 'Zoom-Meeting verlassen'", "label: 'Beenden'"].every((w) => tray.includes(w)) &&
      !GEAENDERT.includes('apps/connect/src/main/tray.ts'),
    'CN Funktionsliste Nr. 187–190: das Tray-Menü bleibt (tray.ts gleich, zoom-text.ts bekam nur ohneVorsatz)',
  );
  ok(zeigtAuf(187, 'src/main/tray.ts', 'function rebuild()') && zeigtAuf(187, 'src/shared/zoom-text.ts', 'export function trayTooltip') && zeigtAuf(190, 'src/shared/zoom-text.ts', 'export function trayTooltip'), 'CN Funktionsliste Nr. 187/190: die Haken zeigen auf Tray-Menü und Tooltip');
  ok(unveraendert(191) && unveraendert(192) && mitVerweis(192, 'B2') && zeigtAuf(192, 'src/main/index.ts', 'setAboutPanelOptions'), 'CN Funktionsliste Nr. 191/192: Ladescreen und „Über JM Connect“ unverändert');
  ok(unveraendert(193) && mitVerweis(193, 'B5'), 'CN Funktionsliste Nr. 193: kein Ausgabefenster, die Ausgabe sind NDI-Quellen; die Programmflächen bleiben (B5)');
}

// ── Rahmen (Task 23): Kopf, Inhalt oben, Statusleiste statt Kopfzeilen, Cloud-Zugang im Panel, Hell/Dunkel ──
{
  const co = quelle(CO);
  const renderer = rendererQuelle();
  ok(ersetzt(5, 'Inhalt oben (T145)') && mitVerweis(5, 'B19') && zeigtAuf(5, CO, '@[56rem]:grid-cols-2', '<Fusszeile />'), 'CN Funktionsliste Nr. 5: AppShell mit Inhalt, oben T145, zwei Spalten ab 56rem, Fußzeile über volle Breite (B19)');
  ok(
    ersetzt(6, 'Kopf') && mitVerweis(6, 'B4') && nennt(6, 'jm-theme', 'Manrope') && quelle('src/renderer/index.html').includes('<html lang="de" class="dark">'),
    'CN Funktionsliste Nr. 6: Hell/Dunkel über den ThemeToggle (jm-theme), Start dunkel per class="dark" (B4), Manrope und Tokens',
  );
  ok(unveraendert(7) && mitVerweis(7, 'B2', 'B4') && nennt(7, 'font-src'), 'CN Funktionsliste Nr. 7: CSP wie bisher, in der Meta-CSP nur font-src für die eingebettete Schrift ergänzt');
  ok(
    ersetzt(8, 'Kopf') && mitVerweis(8, 'B3', 'B4', 'B9') && co.includes('onAir={kopfOnAir(stand)}') && zeigtAuf(8, CO, 'onAir={kopfOnAir(stand)}') &&
      kopfOnAir({ connected: true, room: raum(['onair']) })?.live === true && kopfOnAir({ connected: false, room: raum(['onair']) }) === undefined && kopfOnAir({ connected: true, room: undefined }) === undefined,
    'CN Funktionsliste Nr. 8: Kopf aus AppShell, ON AIR nur bei Raumverbindung und Gast auf Sendung (B3), sonst fehlt es',
  );
  ok(beginnt(9, 'Inhalt oben (T145)') && mitVerweis(9, 'B9') && zeigtAuf(9, CO, '{NDI_TEXT.t145}') && NDI_TEXT.t145.includes('NDI®'), 'CN Funktionsliste Nr. 9: T145 mit ® als erste Zeile des Inhalts (B9)');
  ok(ersetzt(10, 'Statusleiste') && mitVerweis(10, 'B2') && nennt(10, '„Steuerport 8737“') && zeigtAuf(10, OF, 'export function fernsteuerungAbschnitt') && !renderer.includes('Steuerport'), 'CN Funktionsliste Nr. 10: „Steuerport 8737“ ist ersetzt durch den Eintrag Fernsteuerung (B2)');
  ok(ersetzt(11, 'Statusleiste') && nennt(11, '„● Raum verbunden“', 'abgebrochen', 'unbekannt') && zeigtAuf(11, OF, 'function raumItem') && !renderer.includes('Raum verbunden'), 'CN Funktionsliste Nr. 11: die Kopfzeile Raum ist ersetzt durch den Eintrag Raum');
  ok(ersetzt(12, 'Statusleiste') && nennt(12, 'ohneVorsatz') && zeigtAuf(12, OF, 'detail: ohneVorsatz(zeile)'), 'CN Funktionsliste Nr. 12: die Zoom-Zeile ist der Eintrag Zoom (ohne Vorsatz „‹Symbol› Zoom: “)');
  ok(ersetzt(13, 'Statusleiste') && mitVerweis(13, 'B20') && nennt(13, '„ändern“') && zeigtAuf(13, OF, 'function cloudItem') && !/>\s*ändern\s*</.test(renderer) && !/^\s*ändern\s*$/m.test(renderer),'CN Funktionsliste Nr. 13: die Cloud-Zeile ist der Eintrag Cloud-Zugang, er öffnet das Panel; „ändern“ entfällt');
  ok([14, 15, 16].every((nr) => beginnt(nr, 'Panel Cloud-Zugang')) && zeigtAuf(14, 'R/views/CloudZugang.tsx', 'placeholder="https://…workers.dev"') && zeigtAuf(15, 'R/views/CloudZugang.tsx', 'Key entfernen'), 'CN Funktionsliste Nr. 14–16: Adresse, Key entfernen und Speichern im Panel Cloud-Zugang');
  ok(
    ersetzt(17, 'Panel Cloud-Zugang') && mitVerweis(17, 'B8', 'B20') && nennt(17, 'verloren') && quelle('packages/ui/src/components/SettingsPanel.tsx').includes('if (!p.open) return null;'),
    'CN Funktionsliste Nr. 17: „Schließen“ entfällt (⚙, ✕, Escape); eine ungesicherte Adresse geht beim Schließen des Panels verloren (Panel hängt sich aus)',
  );
  ok(
    beginnt(201, 'Kopf') && mitVerweis(201, 'B4') && nennt(201, 'jm-theme') && !/\blocalStorage\b|\bsessionStorage\b|persistId/.test(renderer) && zeigtAuf(201, 'packages/ui/src/lib/theme.ts', "THEME_SCHLUESSEL = 'jm-theme'"),
    'CN Funktionsliste Nr. 201 (Pflichtzeile localStorage): im Renderer weiter kein localStorage, sessionStorage oder persistId; Hell/Dunkel merkt der Baustein unter jm-theme (B4)',
  );
  ok(beginnt(209, 'Cloud-Raum') && nennt(209, 'Panel', 'Haltezeit') && zeigtAuf(209, CO, 'const [panelOffen, setPanelOffen] = useState(anfangOffen);'), 'CN Funktionsliste Nr. 209: nichts gemerkt, auch Panel und die Entwürfe im Panel nicht');
  ok(unveraendert(4) && nennt(4, 'window.open') && !renderer.includes('window.open'), 'CN Funktionsliste Nr. 4: der Renderer ruft window.open weiter nirgends');
  ok(
    beginnt(106, 'Zoom-Spalte') && nennt(106, 'window.confirm') && !/\bwindow\.(?:confirm|alert|prompt)\b|(?<![\w.])(?:confirm|alert|prompt)\(/.test(renderer),
    'CN Funktionsliste Nr. 106 (Pflichtzeile window.confirm): weiter kein confirm, alert oder prompt im Renderer, die Rückfragen bleiben Zeilen in der Seite',
  );
}

// ── Haupttasten, Talkback und Gästeliste (Task 22–24): eine Raum-Taste, Talkback alle immer sichtbar, Halte-Knopf je Gast ──
{
  const cr = ohneKommentare(quelle(CR));
  const renderer = rendererQuelle();
  const ohneStatus = raumTaste(stand(), null);
  const ohneAdresse = raumTaste(stand({ status: appStatus({ configured: false, cloudZugang: { text: '', ton: 'fehler' } }) }), null);
  const mitClient = raumTaste(stand({ status: appStatus(), ansicht: ansicht({ client: true }) }), null);
  ok(
    ersetzt(21, 'Cloud-Raum') && mitVerweis(21, 'B6', 'B21') && nennt(21, CONNECT_TEXTE.grund.cloudZugangFehlt, CONNECT_TEXTE.grund.unbekannt, 'Doppelklick', 'Owner-Entscheid Z1') && zeigtAuf(21, CR, '<TallyButton {...raumKnopf} />') &&
      ohneStatus.state === 'gesperrt' && ohneStatus.disabledReason === CONNECT_TEXTE.grund.unbekannt &&
      ohneAdresse.state === 'gesperrt' && ohneAdresse.disabledReason === CONNECT_TEXTE.grund.cloudZugangFehlt &&
      mitClient.label === CONNECT_TEXTE.taste.raumSchliessen && mitClient.state === 'bereit',
    'CN Funktionsliste Nr. 21: eine Raum-Taste (öffnet ohne Client, schließt mit Client), gesperrt mit Grund statt ohne (B21, B6); Doppelklick hingenommen (Owner-Entscheid Z1)',
  );
  ok(
    beginnt(22, 'Cloud-Raum') && nennt(22, 'unter den Haupttasten') && zeigtAuf(22, CR, 'data-connect="raum-schliessen"') && cr.indexOf('data-connect="haupttasten"') < cr.indexOf('data-connect="raum-schliessen"') &&
      cr.includes('!ansicht.gastEinladen && ansicht.raumSchliessen'),
    'CN Funktionsliste Nr. 22: „Raum schließen“ nach einem Raumabbruch als normaler Knopf unter den Haupttasten (Tastenplatz, Task 24)',
  );
  const einladen = cr.slice(cr.indexOf('data-connect="einladen"'), cr.indexOf('data-connect="einladungen"'));
  ok(
    ersetzt(27, 'Cloud-Raum') && mitVerweis(27, 'B21') && einladen.length > 0 && !einladen.includes('raumSchliessen') && !einladen.includes('Raum schließen') && zaehle(cr, 'Raum schließen') === 1,
    'CN Funktionsliste Nr. 27: das zweite „Raum schließen“ der Einladen-Zeile entfällt zugunsten der Raum-Taste (B21)',
  );
  const html = render(createElement(CloudRaum, { stand: stand({ status: appStatus() }), show: null, error: null, invites: [], guestName: '', aktionen: aktionenAttrappe() }));
  const tb = tallyTasten(html).find((t) => t.text.startsWith(CONNECT_TEXTE.taste.talkback));
  ok(
    ersetzt(35, 'Cloud-Raum') && mitVerweis(35, 'B1', 'B6', 'B21') && nennt(35, CONNECT_TEXTE.grund.raumNichtVerbunden, 'Leertaste', 'blur', 'Befund 7', '„🎙 Halten zum Sprechen (alle Gäste)“') &&
      tb?.state === 'gesperrt' && (tb?.text ?? '').includes(CONNECT_TEXTE.grund.raumNichtVerbunden) &&
      talkbackTaste(offenerRaum(raum([], { mode: 'all', target: null }))).label === CONNECT_TEXTE.taste.talkbackGehalten && !renderer.includes('Halten zum Sprechen'),
    'CN Funktionsliste Nr. 35: Talkback alle als Haupttaste, auch ohne Raum-Zustand sichtbar und gesperrt „Raum nicht verbunden“; Halten per Taste, Abbruch bei blur (B1, B21)',
  );
  const g = gast('g1', 'approved');
  const offen = offenerRaum(raum(['approved'], { mode: 'selected', target: 'g1' }));
  const gHtml = render(createElement(CloudRaum, { stand: offen, show: null, error: null, invites: [], guestName: '', aktionen: aktionenAttrappe() }));
  ok(
    ersetzt(40, 'Gästeliste') && mitVerweis(40, 'B1', 'B21') && nennt(40, 'HalteKnopf', 'Befund 7') && cr.includes('<HalteKnopf') && !renderer.includes('PttButton') && !renderer.includes('onPointerDown') &&
      gastHalten(offen, g).aktiv && halteKnoepfe(gHtml).some((k) => k.label === '🎙'),
    'CN Funktionsliste Nr. 40: 🎙 je Gast ist der HalteKnopf aus @jm/ui (kein PttButton mehr), aktiv, solange nur dieser Gast die Regie hört',
  );
  ok(
    beginnt(48, 'Gästeliste') && nennt(48, 'F2', '34rem') && cr.includes("const AKTIONSZEILE = 'flex gap-1 @[34rem]:basis-full';") && cr.includes("const AKTIONSKNOPF = '@[34rem]:!px-2';"),
    'CN Funktionsliste Nr. 48: Gast-Aktionen in der breiten Liste auf eigener Zeile (Tastenplatz, Task 24), sonst wie bisher hinter dem Phasen-Abzeichen',
  );
  // Owner-Entscheid F2-B (24.11., Nachtrag Task 24): in der breiten Liste 🎙 und 📊 vor dem Namen, nur sichtbar (CSS order); die
  // Zeilen 37, 40 und 41 nennen die geänderte Bedienung mit dem Entscheid, Form und Ort bleiben.
  ok(
    beginnt(37, 'Gästeliste') && ersetzt(40, 'Gästeliste') && beginnt(41, 'Gästeliste') && [37, 40, 41].every((nr) => nennt(nr, 'Owner-Entscheid F2-B', '34rem')) &&
      cr.includes("const VORN_BREIT = '@[34rem]:order-first';") && cr.includes('<HalteKnopf {...gastTalkback(stand, g, aktionen)} className={VORN_BREIT} />') &&
      cr.includes('className={`${VORN_BREIT} min-h-[var(--control-h)]') && zaehle(cr, 'VORN_BREIT') === 3,
    'CN Funktionsliste Nr. 37, 40, 41: in der breiten Liste stehen 🎙 und 📊 vor dem Namen (Owner-Entscheid F2-B), in der schmalen wie bisher dahinter',
  );
  ok([42, 43, 44, 45, 46, 47].every((nr) => beginnt(nr, 'Gästeliste')) && nennt(45, 'ohne Anzeige') && !cr.includes('standbyId'), 'CN Funktionsliste Nr. 42–47: Gast-Aktionen wie bisher; Standby weiter ohne Anzeige (C1-A)');
}

// ── Zoom (Task 24): Zoom-Spalte, Einrichtung und Vorgaben im Panel, Doppelklick-Schutz in der Wurzel-View, rechtsbündige Tasten ──
{
  const zc = ohneKommentare(quelle('R/zoom/ZoomCard.tsx'));
  const sb = ohneKommentare(quelle('R/zoom/SlotBereich.tsx'));
  const renderer = rendererQuelle();
  ok(ersetzt(50, 'Zoom-Spalte') && mitVerweis(50, 'B19') && zeigtAuf(50, CO, 'data-connect="zoom-spalte"'), 'CN Funktionsliste Nr. 50: die Zoom-Karte ist die rechte Spalte (B19)');
  ok(
    [56, 57, 72, 75, 76].every((nr) => beginnt(nr, 'Zoom-Spalte') && nennt(nr, 'rechts')) && zaehle(zc, 'flex flex-row-reverse') === 3,
    'CN Funktionsliste Nr. 56, 57, 72, 75, 76: Erneut beitreten, Beitreten und Meeting verlassen ganz rechts ihrer Zeile (flex-row-reverse, Tastenplatz, Task 24); Nachbarn seitenverkehrt',
  );
  ok(ersetzt(60, 'Panel Zoom-Einrichtung') && mitVerweis(60, 'B20') && !renderer.includes('setEinrichtungAuf'), 'CN Funktionsliste Nr. 60: der Knopf „Einrichtung“ entfällt, die Einrichtung steht im Panel (B20)');
  ok(
    ersetzt(61, 'Statusleiste') && mitVerweis(61, 'B22') && zeigtAuf(61, OF, 'export function zoomMangel') && zeigtAuf(61, 'R/zoom/ZoomEinrichtung.tsx', 'SPERR_HINWEIS'),
    'CN Funktionsliste Nr. 61 (Pflichtzeile Mangel): der Eintrag Zoom-Einrichtung öffnet das Panel dort, der Sperr-Hinweis steht im Abschnitt (B22)',
  );
  ok([62, 63, 64, 65, 66, 67, 68].every((nr) => beginnt(nr, 'Panel Zoom-Einrichtung') && zeigtAuf(nr, 'R/zoom/ZoomEinrichtung.tsx', '')), 'CN Funktionsliste Nr. 62–68: SDK, Laden, Anmeldung, Übergangszeilen und Prüfen im Panel Zoom-Einrichtung');
  ok(
    ersetzt(80, 'Panel Zoom-Vorgaben') && ersetzt(83, 'Panel Zoom-Vorgaben') && beginnt(82, 'Panel Zoom-Vorgaben') && [80, 82, 83].every((nr) => mitVerweis(nr, 'B20')) && nennt(83, 'verloren') &&
      !sb.includes('setVorgabenAuf') && !sb.includes('setSprecherAuf') && !sb.includes('personImNdiNamen'),
    'CN Funktionsliste Nr. 80, 82, 83: Vorgaben, Person im NDI-Namen und Sprecher im Panel Zoom-Vorgaben; die Aufklapper entfallen (B20)',
  );
  const schluessel = ["'erneut'", "'sdk'", "'sdk-abbrechen'", "'sdk-schluessel'", "'zugang'", "'pruefen'", "'beitreten'", "'vergessen'", "'schliessen'", "'verlassen'", "'abbrechen'", "'anlegen'", "'vorschau'", "'personImNdiNamen'", "'vorgaben'", "'sprecher'", '`start:${nr}`', '`behalten:${nr}`', '`person:${nr}`', '`aendern:${nr}`', '`loeschen:${nr}`', '`alsSlot:${t.id}`', "'ok'", "'logordner'", "'versatz'"];
  const fehlend = schluessel.filter((s) => !renderer.includes(s));
  ok(
    beginnt(103, 'Zoom-Spalte') && mitVerweis(103, 'B8', 'B20') && nennt(103, 'ZoomAufrufe', 'Wurzel-View') && fehlend.length === 0 &&
      zaehle(renderer, 'useState<ReadonlySet<string>>') === 1 && zeigtAuf(103, CO, 'useState<ReadonlySet<string>>', 'fuehreZoomAus('),
    `CN Funktionsliste Nr. 103: der Doppelklick-Schutz laeuft liegt einmal in der Wurzel-View, alle Schlüssel wie bisher (fehlt: ${fehlend.join(', ') || 'nichts'})`,
  );
  ok(
    beginnt(121, 'Zoom-Spalte') && nennt(121, 'T92', 'Panel') && sb.includes('TEXT_A4_SCHREIBFEHLER') && !ohneKommentare(quelle('R/zoom/ZoomVorgaben.tsx')).includes('TEXT_A4_SCHREIBFEHLER'),
    'CN Funktionsliste Nr. 121: T92 steht weiter im Kopf der Slots, auch für Änderungen aus dem Panel Zoom-Vorgaben (zwei Orte)',
  );
  ok(ersetzt(12, 'Statusleiste') && beginnt(53, 'Zoom-Spalte') && beginnt(52, 'Zoom-Spalte') && mitVerweis(52, 'B20'), 'CN Funktionsliste Nr. 52/53: vor dem ersten Abbild „Zoom-Meeting“; das Abbild hält die Wurzel-View (B20)');
}

// ── Pflichtzeilen aus N2b 3.1 (✏️, ❌, ➕; Plan Teil 3): jede Zeile behält ihren Vermerk und ist abgehakt ──
{
  const n2b: Record<number, number[]> = {
    1: [20, 36, 50],
    4: [142, 143],
    5: [139],
    7: [135],
    8: [13],
    9: [32],
    10: [38, 166],
    11: [10],
    13: [12, 78],
    15: [166, 82],
    16: [13, 14, 15],
    17: [50, 61, 62, 63, 64, 65, 66, 67, 68],
    19: [6],
    20: [196, 197],
    21: [50],
    23: [7],
    26: [40, 41],
    27: [104],
    28: [23, 24, 29],
    29: [169],
    30: [2, 187],
    31: [45],
    32: [168, 129],
  };
  /** Nummern der Vermerke „N2b 3.1 Nr. …“ im Element, bis zur Klammer oder einem anderen N2b-Vermerk. */
  const vermerke = (el: string): Set<number> => {
    const s = new Set<number>();
    for (const m of el.matchAll(/N2b 3\.1(?!\d) Nr\.([^)]*?)(?=\)|N2b|$)/g)) for (const n of m[1].matchAll(/(?:^|[ ,])(\d+)\b/g)) s.add(Number(n[1]));
    return s;
  };
  const fehlt = Object.entries(n2b).flatMap(([n, nrs]) => nrs.filter((nr) => !vermerke(element(nr)).has(Number(n)) || zeilenFehler(zeile(nr) as Zeile) !== null).map((nr) => `${n}→${nr}`));
  ok(fehlt.length === 0, `CN Funktionsliste: jede Zeile aus N2b 3.1 mit ✏️, ❌ oder ➕ hat ihren Vermerk und ist abgehakt (fehlt: ${fehlt.join(', ') || 'nichts'})`);
  ok(/17 \(✏️\) →\s*50, 61 bis 68;/.test(kopfText) && /Korrekturen in Task 25[^\n]*Nr\. 14/.test(kopfText), 'CN Funktionsliste: der Kopf nennt die Zuordnung zu N2b 3.1 und die Korrekturen in Task 25');
}

// ── Befunde 1–14 (Abschnitt 10): jeder ist abgeschlossen – erledigt, bleibt oder Owner-Frage –, mit Beleg ──
{
  const teil = text.slice(text.indexOf('## 10 · Befunde'));
  const befunde = teil.split(/\n(?=\d+\. \*\*)/).filter((b) => /^\d+\. \*\*/.test(b));
  gleich(befunde.map((b) => Number(/^(\d+)\./.exec(b)?.[1])), Array.from({ length: 14 }, (_, i) => i + 1), 'CN Funktionsliste Befunde: 14 Befunde in Abschnitt 10');
  /** Der Stand eines Befunds in Teilen: jeder beginnt mit erledigt, bleibt oder Owner-Frage, getrennt durch „; “. */
  const teile = (b: string): string[] | undefined => {
    const st = b.split('**Stand Task 25:**');
    return st.length === 2 ? st[1].trim().split(/; (?=(?:erledigt|bleibt|Owner-Frage)\b)/) : undefined;
  };
  const falsch = befunde.flatMap((b, i) => {
    const t = teile(b);
    if (t === undefined) return [`${i + 1} (kein oder mehr als ein Stand)`];
    if (!t.every((s) => /^(?:erledigt|bleibt|Owner-Frage)\b/.test(s))) return [`${i + 1} (Teil ohne erledigt, bleibt oder Owner-Frage)`];
    if (!t.every((s) => verweise(s).some((v) => v.datei !== ''))) return [`${i + 1} (Teil ohne Beleg)`];
    const s = t.join('; ');
    if (FREMD.test(s.replace(/`[^`]*`/g, ''))) return [`${i + 1} (Verweis außerhalb von B1–B22)`];
    const vf = verweisFehler(s);
    return vf === null ? [] : [`${i + 1} (${vf})`];
  });
  ok(falsch.length === 0, `CN Funktionsliste Befunde 1–14: jeder mit „Stand Task 25:“, jeder Teil erledigt, bleibt oder Owner-Frage und mit Beleg (falsch: ${falsch.join(', ') || 'keine'})`);
  const status = (i: number): string => (teile(befunde[i - 1] ?? '') ?? []).map((s) => /^(erledigt|bleibt|Owner-Frage)/.exec(s)?.[1] ?? '').join();
  const soll: Record<number, string> = {
    1: 'erledigt,bleibt',
    2: 'erledigt,erledigt,bleibt,bleibt',
    3: 'erledigt,bleibt',
    4: 'erledigt,bleibt',
    5: 'erledigt,bleibt',
    6: 'bleibt',
    7: 'erledigt',
    8: 'bleibt',
    9: 'erledigt,bleibt',
    10: 'erledigt,bleibt',
    11: 'erledigt,bleibt',
    12: 'erledigt,bleibt',
    13: 'erledigt,bleibt',
    14: 'bleibt',
  };
  const abweichend = Object.entries(soll).filter(([i, s]) => status(Number(i)) !== s).map(([i]) => `${i}: ${status(Number(i)) || '–'}`);
  ok(abweichend.length === 0, `CN Funktionsliste Befunde: Stand je Befund wie festgelegt (Tastenplätze 1, 2, 4 nach dem Owner-Entscheid zu F1–F3: F2-B erledigt, das Übrige bleibt; Talkback 7 erledigt; Wahl wirkt sofort 11 erledigt mit „Setzen“, die Schalter bleiben; abweichend: ${abweichend.join(', ') || 'keine'})`);
  const b11 = befunde[10] ?? '';
  ok(
    ['Setzen', '`R/zoom/SlotEinstellungen.tsx:', '`R/zoom/ZoomVorgaben.tsx:', 'Schalter', 'Vorgaben'].every((w) => b11.includes(w)) && !b11.includes('Owner-Frage'),
    'CN Funktionsliste Befund 11: erledigt mit „Setzen“ an laufenden Slots und am Sprecher-Signal (Belege in Kachel und Panel), Schalter und Vorgaben bleiben, keine Owner-Frage mehr',
  );
  // Fix-Runde 1 (Review Task 25, Important 2 und Minor 2): ein „erledigt“ sagt nur, was der Code erledigt; was bleibt, steht in
  // einem eigenen „bleibt“. Befund 5: die Cloud-Zeile fehlt nur im Arbeitsbereich, im Eintrag der Statusleiste ist sie gekürzt.
  // Befund 2: das Wandern mit dem Zustand bleibt (eigener Teil). Teile mit eingeebneten Zeilenumbrüchen.
  const flach = (i: number): string[] => (teile(befunde[i - 1] ?? '') ?? []).map((s) => s.replace(/\s+/g, ' '));
  const erledigtTeile = (i: number): string => flach(i).filter((s) => s.startsWith('erledigt')).join(' ');
  const bleibtTeile = (i: number): string => flach(i).filter((s) => s.startsWith('bleibt')).join(' ');
  ok(
    ['Arbeitsbereich', 'Panel Cloud-Zugang', 'Tooltip', '`R/views/CloudZugang.tsx:', '`packages/ui/src/components/StatusBar.tsx:'].every((w) => erledigtTeile(5).includes(w)) &&
      ['16rem', 'Screenreader', '`packages/ui/src/components/StatusBar.tsx:125-133`'].every((w) => bleibtTeile(5).includes(w)) &&
      !flach(5).join(' ').includes('gibt es im Fenster nicht mehr') && nennt(13, '16rem', 'Screenreader', 'Befund 5'),
    'CN Funktionsliste Befund 5 und Nr. 13: erledigt nur im Arbeitsbereich (voll im Panel und im Tooltip), bleibt: im Eintrag der Statusleiste auf 16rem gekürzt, unter 900 px nur für Screenreader',
  );
  ok(
    !erledigtTeile(2).includes('Wandern') && bleibtTeile(2).includes('Wandern') && bleibtTeile(2).includes('`R/views/CloudRaum.tsx:140-162`'),
    'CN Funktionsliste Befund 2: das Wandern mit dem Zustand steht in einem eigenen „bleibt“, nicht im „erledigt“',
  );
  // Ruling zu Important 1: „Setzen“ ist eine Kachel-Taste, F2 A gilt für sie; die gemessenen Treffer stehen offen in Nr. 95 und Befund 2.
  ok(
    nennt(95, 'Owner-Entscheid F2 A', 'Ruling', 'Standby', 'nur mit Entwurf', 'nachher-connect-ks.json') &&
      ['„Setzen“', 'K01', 'Standby', 'KD088'].every((w) => bleibtTeile(2).includes(w)),
    'CN Funktionsliste Nr. 95 und Befund 2: die Treffer von „Setzen“ in den kombinierten Zuständen stehen offen da (F2 A nach Ruling)',
  );
  const tastenplatz = [1, 2, 4].map((i) => befunde[i - 1] ?? '').join('\n');
  ok(['F1', 'F2', 'F3', 'Owner-Entscheid'].every((f) => tastenplatz.includes(f)) && !tastenplatz.includes('Owner-Frage') && (befunde[6] ?? '').includes('`packages/ui/src/lib/halten.ts'), 'CN Funktionsliste Befunde: 1, 2 und 4 nennen den Owner-Entscheid zu F1–F3 (keine offene Owner-Frage mehr); 7 belegt den Abbruch bei Fensterverlust im Baustein');
}
