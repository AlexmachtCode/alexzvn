// ─────────────────────────────────────────────────────────────────────────────
// Funktionsliste nach dem Umbau (UX Welle 2b, Presenter e; Spec 10 „Kein Funktionsverlust“). Jede der 229 Zeilen in den
// Abschnitten 1–7 von docs/ux/funktionslisten/presenter.md ist in „künftig wo“ abgehakt, in genau einer Form: „✓ “ und ein Ort
// des Ortsregisters (Plan Task 12), „✓ unverändert (…)“, „✓ entfällt (…, B…)“ oder „✓ ersetzt durch {Ort} (…, B…)“. Verweise
// nur auf B1–B22 (Plan 2b) und die übernommenen 2a-Festlegungen E15 und E16, im Haken und in der ganzen Liste. Jede genannte
// Datei existiert, Groß- und Kleinschreibung wie im Repo (Platzhalter ausgenommen); Zeilenangaben im Haken liegen in der Datei
// von heute, an den Pflichtzeilen auch am richtigen Code. Dazu Querprüfungen gegen den Code: Pflichtzeilen Tastatur und
// Panel-Tasten (O1), Standardmenü, die Abläufe aus Abschnitt 3 im Main und in den Wurzel-Views statt im Panel (B8), die
// Zusatzfenster, die Zeilen aus N2b 1.1 und die Korrekturen aus den Prüfungen von Task 7 bis 11.
// Läuft im Paketordner apps/presenter (npm run selftest -w @jm/presenter), per await import aus test/ui/selftest.ts.
// „unverändert (…)“ und die Orte „… (unverändert)“ nennen keine Datei, die seit der Erhebung (481c998c08) geändert wurde, außer
// sie bekam nur, was der Plan erlaubt (Master-Link und Fernsteuerungs-Meldung B2, Bildschirm-Ereignis und move B11, die Wurzel
// des Referenten B12): dann nennt der Haken diesen Verweis. Der Abgleich der statischen Listen mit git läuft nur mit
// JM_FUNKTIONSLISTE_GIT=1; dann prüft der Test auch die Zeilenangaben der übrigen Spalten gegen die Erhebung.
// ─────────────────────────────────────────────────────────────────────────────

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { NDI_TEXTE, PEERS_TEXTE, REMOTE_TEXTE, SCREEN_TEXTE } from '@jm/settings';
import { gleich, leseText, ok } from '@jm/ui/testhilfe';
import { PRESENTER_TEXTE } from '@/lib/oberflaeche';

const LISTE = '../../docs/ux/funktionslisten/presenter.md';
const ERHEBUNG = '481c998c08';

/**
 * Ortsregister (Plan Task 12): Editor-Kopf, Editor-Werkzeugleiste, Arbeitsfläche, Referent-Kopf, Referent-Leiste, Live-Bereich
 * (Folie, Tasten, nächste Folie, Notizen, Timer), Statusleiste, Panel je Abschnitt (die Titel der Abschnitte im Panel), Publikum,
 * NDI-Fenster und Handy-Seite je mit „(unverändert)“.
 */
const ABSCHNITTE = ['Ausgabe auf Bildschirm', 'NDI-Ausgabe', 'Fernsteuerung', 'Handy-Fernsteuerung', 'Gast-Klicker', 'Gegenstellen', 'Import'];
const LIVE = ['Folie', 'Tasten', 'nächste Folie', 'Notizen', 'Timer'];
const UNVERAENDERT_ORTE = ['Publikum (unverändert)', 'NDI-Fenster (unverändert)', 'Handy-Seite (unverändert)'];
const ORTE: readonly string[] = [
  'Editor-Kopf',
  'Editor-Werkzeugleiste',
  'Arbeitsfläche',
  'Referent-Kopf',
  'Referent-Leiste',
  'Live-Bereich',
  ...LIVE.map((t) => `Live-Bereich ${t}`),
  'Statusleiste',
  'Panel',
  ...ABSCHNITTE.map((a) => `Panel ${a}`),
  ...UNVERAENDERT_ORTE,
];

/** Zeilen insgesamt und je Abschnitt 1–7, wie Task 7 die Liste angelegt hat (eca351c3b2); Abschnitt 4 in vier Teiltabellen. */
const GESAMT = 229;
const JE_ABSCHNITT = [47, 26, 47, 56, 8, 30, 15];
const TEILTABELLEN: Record<string, [number, number]> = { '4a': [121, 165], '4b': [166, 167], '4c': [168, 168], '4d': [169, 176] };

/**
 * Platzhalter in Backticks, die keine Pfade nach der Pfadregel der Liste sind: `icon.png` (Nr. 2) ist das Argument von
 * resourcePath im Fensteraufruf (die Datei liegt in resources/), kein Pfad relativ zu apps/presenter.
 */
const PLATZHALTER = new Set(['icon.png']);

/** Alle Dateien von apps/presenter, die seit der Erhebung geändert, angelegt oder gelöscht wurden (Pfad ab apps/presenter). */
const GEAENDERT = [
  'electron.vite.config.ts',
  'package.json',
  'src/main/control-server.ts',
  'src/main/index.ts',
  'src/main/windows.ts',
  'src/preload/index.ts',
  'src/renderer/src/components/GastKlickerAbschnitt.tsx',
  'src/renderer/src/components/GastKlickerPille.tsx',
  'src/renderer/src/components/NdiSchalter.tsx',
  'src/renderer/src/components/OeffnenFrage.tsx',
  'src/renderer/src/components/RemotePanel.tsx',
  'src/renderer/src/components/TimerBar.tsx',
  'src/renderer/src/components/Toolbar.tsx',
  'src/renderer/src/globals.css',
  'src/renderer/src/lib/bruecken.ts',
  'src/renderer/src/lib/oberflaeche.ts',
  'src/renderer/src/lib/timer.ts',
  'src/renderer/src/lib/usePresentation.ts',
  'src/renderer/src/lib/useStand.ts',
  'src/renderer/src/main.tsx',
  'src/renderer/src/views/EditorOberflaeche.tsx',
  'src/renderer/src/views/EditorView.tsx',
  'src/renderer/src/views/Einstellungen.tsx',
  'src/renderer/src/views/PresenterView.tsx',
  'src/renderer/src/views/ReferentLeiste.tsx',
  'src/renderer/src/views/ReferentOberflaeche.tsx',
  'src/shared/fernsteuerung.ts',
  'src/shared/types.ts',
  'test/ndi-ausgang.test.ts',
  'test/ui/bruecken.test.ts',
  'test/ui/funktionsliste.test.ts',
  'test/ui/hilfe.ts',
  'test/ui/live.test.tsx',
  'test/ui/oberflaeche.test.ts',
  'test/ui/panel.test.tsx',
  'test/ui/rahmen.test.tsx',
  'test/ui/referent.test.tsx',
  'test/ui/selftest.ts',
  'test/ui/stub-url.ts',
  'test/ui/testzustand.ts',
  'test/ui/werkzeug.test.tsx',
  'tsconfig.test.json',
].map((p) => `apps/presenter/${p}`);

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
 * Geänderte Dateien, die nur bekamen, was der Plan erlaubt, und der Verweis, der das belegt: Main und Preload die lesenden
 * Brücken (Master-Link, Fernsteuerungs-Meldung, B2) und das lesende Bildschirm-Ereignis samt move des Publikumsfensters (B11),
 * die Typdatei die Typen dazu, R/main.tsx nur die Wurzel des Referenten (ReferentOberflaeche statt PresenterView, B12).
 */
const ERLAUBT = new Map<string, readonly string[]>([
  ['apps/presenter/src/main/index.ts', ['B2', 'B11']],
  ['apps/presenter/src/main/control-server.ts', ['B2']],
  ['apps/presenter/src/main/windows.ts', ['B11']],
  ['apps/presenter/src/preload/index.ts', ['B2', 'B11']],
  ['apps/presenter/src/shared/types.ts', ['B2', 'B11']],
  ['apps/presenter/src/renderer/src/main.tsx', ['B12']],
]);

const GEAENDERT_KANON = new Set([...GEAENDERT, ...PAKETE_GEAENDERT]);

/** Alle seit der Erhebung geänderten Dateien des Repos laut git; null, wenn der Klon keinen Verlauf hat. */
function gitGeaendert(): Set<string> | null {
  try {
    const aus = execFileSync('git', ['diff', '--name-only', `${ERHEBUNG}..HEAD`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return new Set(aus.split(/\r?\n/).filter((n) => n !== ''));
  } catch {
    return null;
  }
}
// Nur auf Anforderung: ohne JM_FUNKTIONSLISTE_GIT=1 sagt der Test nichts über git; die statischen Listen sind der Wächter.
const GIT_PRUEFEN = process.env.JM_FUNKTIONSLISTE_GIT === '1';
const GIT = GIT_PRUEFEN ? gitGeaendert() : null;
if (GIT_PRUEFEN && GIT === null) console.log(`PS Funktionsliste: kein git-Verlauf bis ${ERHEBUNG} (flacher Klon); die Prüfung gegen git entfällt`);

/** Datei in Backticks (Pfad mit Endung, optional mit Zeilen „:a-b“) oder nur Zeilen „:a-b“ zur zuletzt genannten Datei im Feld. */
const VERWEIS_DATEI = /`([A-Za-z0-9_./-]+\.(?:tsx|ts|css|html|json|md|mjs|png))(?::(\d+)(?:-(\d+))?)?`|`:(\d+)(?:-(\d+))?`/g;
/** Erlaubte Verweise: B1–B22 (Plan 2b) und die übernommenen 2a-Festlegungen E15 und E16. */
const VERWEIS = /\b(?:B(?:[1-9]|1\d|2[0-2])|E1[56])\b/;
const FREMD = /\b(?:B(?:0|2[3-9]|[3-9]\d|\d{3,})|E(?:\d|1[0-4]|1[7-9]|[2-9]\d|\d{3,}))\b/;

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

/** Pfadregel der Liste: Repo-Wurzel (apps, packages, docs), `R/…` = src/renderer/src/…, sonst relativ zu apps/presenter. */
function aufgeloest(pfad: string): string {
  if (/^(?:apps|packages|docs)\//.test(pfad)) return `../../${pfad}`;
  if (pfad.startsWith('R/')) return `src/renderer/src/${pfad.slice(2)}`;
  return pfad;
}

/** Kanonischer Pfad ab der Repo-Wurzel nach der Pfadregel der Liste. */
function kanon(pfad: string): string {
  const a = aufgeloest(pfad);
  return a.startsWith('../../') ? a.slice('../../'.length) : `apps/presenter/${a}`;
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
    try {
      altCache.set(pfad, zeilenZahl(execFileSync('git', ['show', `${ERHEBUNG}:${kanon(pfad)}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).replace(/\r\n/g, '\n')));
    } catch {
      altCache.set(pfad, -1);
    }
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

/** Ort am Anfang des Texts: der längste passende Eintrag des Ortsregisters, danach Leerzeichen, Doppelpunkt, Komma oder Ende. */
function ortAm(text: string): string | undefined {
  return [...ORTE]
    .sort((a, b) => b.length - a.length)
    .find((o) => text.startsWith(o) && /^(?:[ :,]|$)/.test(text.slice(o.length)));
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

/** null = Zeile abgehakt; sonst der erste Grund, warum nicht. */
function zeilenFehler(z: Zeile): string | null {
  if (z.zellen.length !== 7) return `${z.zellen.length} statt 7 Spalten`;
  const k = z.zellen[6];
  if (!k.startsWith('✓ ')) return '„künftig wo“ ohne Haken';
  const ohneCode = k.replace(/`[^`]*`/g, '');
  if (ohneCode.includes('"')) return 'ASCII-Anführungszeichen';
  if (FREMD.test(ohneCode)) return 'Verweis außerhalb von B1–B22, E15 und E16';
  const f = form(k);
  if (f === undefined) return `Ort nicht aus dem Ortsregister: ${k.slice(2, 50)}`;
  if ((f.form === 'ersetzt durch' || f.form === 'entfällt') && !VERWEIS.test(ohneCode)) return `„${f.form}“ ohne B- oder E-Verweis`;
  if (ohneCode.includes('entfällt') && !VERWEIS.test(ohneCode)) return '„entfällt“ im Text ohne B- oder E-Verweis';
  const vs = verweise(k);
  const dateien = [...new Set(vs.map((v) => v.datei).filter((d) => d !== ''))];
  if (f.form !== 'entfällt' && dateien.length === 0) return 'Ort ohne Datei';
  if (vs.some((v) => v.datei === '')) return 'Zeilenangabe ohne Datei davor';
  const fehlt = dateien.filter((d) => !gibtEs(d));
  if (fehlt.length > 0) return `Datei fehlt: ${fehlt.join(', ')}`;
  const ausserhalb = vs.filter((v) => v.von !== undefined && (v.von < 1 || (v.bis ?? 0) < v.von || (v.bis ?? 0) > zeilenZahl(quelle(v.datei))));
  if (ausserhalb.length > 0) return `Zeilen außerhalb der Datei: ${ausserhalb.map((v) => `${v.datei}:${v.von}-${v.bis}`).join(', ')}`;
  // „unverändert“ und die Orte „… (unverändert)“: nur Dateien, die seit der Erhebung gleich sind, oder erlaubte mit ihrem Verweis.
  if (f.form === 'unverändert' || (f.ort !== undefined && UNVERAENDERT_ORTE.includes(f.ort))) {
    for (const d of dateien) {
      const kd = kanon(d);
      if (!GEAENDERT_KANON.has(kd) && GIT?.has(kd) !== true) continue;
      const refs = ERLAUBT.get(kd);
      if (refs === undefined) return `unverändert mit geänderter Datei ${d}`;
      if (!refs.some((r) => new RegExp(`\\b${r}\\b`).test(ohneCode))) return `unverändert mit ${d} ohne Verweis auf ${refs.join(' oder ')}`;
    }
  }
  return null;
}

const text = leseText(LISTE);
const alle = zeilen(text);
const kopfText = text.slice(0, text.indexOf('\n---\n'));

gleich(alle.length, GESAMT, 'PS Funktionsliste: 229 Zeilen in den Abschnitten 1–7 (Stand Task 7)');
gleich(
  JE_ABSCHNITT.map((_, i) => alle.filter((z) => z.abschnitt === i + 1).length),
  JE_ABSCHNITT,
  'PS Funktionsliste: Zeilen je Abschnitt wie in Task 7 (47/26/47/56/8/30/15)',
);
gleich(
  alle.map((z) => z.nr),
  alle.map((_, i) => i + 1),
  'PS Funktionsliste: Nummern fortlaufend ab 1',
);
gleich(
  Object.keys(TEILTABELLEN).map((t) => alle.filter((z) => z.teil === t).map((z) => z.nr)),
  Object.values(TEILTABELLEN).map(([von, bis]) => Array.from({ length: bis - von + 1 }, (_, i) => von + i)),
  'PS Funktionsliste: Abschnitt 4 mit den Teiltabellen 4a Referent (121–165), 4b Publikum, 4c NDI-Fenster, 4d Handy-Seite',
);
ok(!text.replace(/`[^`]*`/g, '').includes('"') && !text.includes('\r'), 'PS Funktionsliste: keine ASCII-Anführungszeichen außerhalb von Code, kein CR');
ok(!FREMD.test(text.replace(/`[^`]*`/g, '')), 'PS Funktionsliste: in der ganzen Liste nur Verweise B1–B22, E15 und E16 (auch E16 in Abschnitt 9)');
ok(ORTE.every((o) => kopfText.includes(o)) && !kopfText.includes('bleibt leer'), 'PS Funktionsliste: der Kopf nennt das Ortsregister und sagt nicht mehr „bleibt leer“');
gleich(
  ABSCHNITTE,
  [SCREEN_TEXTE.titel, NDI_TEXTE.titel, REMOTE_TEXTE.titel, PRESENTER_TEXTE.handy.titel, PRESENTER_TEXTE.gastKlicker.titel, PEERS_TEXTE.titel, PRESENTER_TEXTE.import.titel],
  'PS Funktionsliste: die Panel-Orte heißen wie die Abschnitte im Panel (Ausgabe, NDI, Fernsteuerung, Handy, Gast-Klicker, Timer, Import)',
);

for (const z of alle) {
  const f = zeilenFehler(z);
  ok(f === null, `PS Funktionsliste Nr. ${z.nr} abgehakt${f === null ? '' : ` – ${f}`}`);
}

// ── Jede genannte Datei der übrigen Spalten gibt es (Platzhalter ausgenommen); mit git liegen deren Zeilen in der Erhebung ──
{
  const fehlt: string[] = [];
  const zeilenFalsch: string[] = [];
  for (const z of alle) {
    for (const zelle of z.zellen.slice(0, 6)) {
      for (const v of verweise(zelle)) {
        if (v.datei === '' || PLATZHALTER.has(v.datei)) continue;
        if (!gibtEs(v.datei)) fehlt.push(`Nr. ${z.nr}: ${v.datei}`);
        else if (GIT_PRUEFEN && v.bis !== undefined) {
          const n = altZeilen(v.datei);
          if (n >= 0 && v.bis > n) zeilenFalsch.push(`Nr. ${z.nr}: ${v.datei}:${v.bis} > ${n}`);
        }
      }
    }
  }
  ok(fehlt.length === 0, `PS Funktionsliste: jede in den Spalten 1–6 genannte Datei gibt es (fehlt: ${fehlt.join('; ') || 'nichts'})`);
  if (GIT_PRUEFEN) ok(zeilenFalsch.length === 0, `PS Funktionsliste: die Zeilenangaben der Spalten 1–6 liegen in den Dateien der Erhebung (${zeilenFalsch.join('; ') || 'alle'})`);
  ok(text.includes('`icon.png`') && !gibtEs('icon.png'), 'PS Funktionsliste: der Platzhalter `icon.png` (Nr. 2) ist kein Pfad nach der Pfadregel und wird übersprungen');
}

// ── Die Mengen der geänderten Dateien stimmen mit git überein (nur mit JM_FUNKTIONSLISTE_GIT=1 und Verlauf) ──
{
  if (GIT !== null) {
    const fehlend = [...GIT].filter((n) => n.startsWith('apps/presenter/') && !GEAENDERT_KANON.has(n));
    ok(fehlend.length === 0, `PS Funktionsliste: GEAENDERT nennt alle seit ${ERHEBUNG} geänderten Dateien von apps/presenter (fehlt: ${fehlend.join(', ') || 'nichts'})`);
    const zuviel = GEAENDERT.filter((n) => !GIT.has(n));
    ok(zuviel.length === 0, `PS Funktionsliste: GEAENDERT nennt keine Datei, die git nicht als geändert kennt (zu viel: ${zuviel.join(', ') || 'nichts'})`);
    const pakete = [...GIT].filter((n) => /^packages\/[^/]+\/src\//.test(n));
    const paketFehlt = pakete.filter((n) => !PAKETE_GEAENDERT.includes(n));
    const paketZuviel = PAKETE_GEAENDERT.filter((n) => !GIT.has(n));
    ok(paketFehlt.length === 0 && paketZuviel.length === 0, `PS Funktionsliste: PAKETE_GEAENDERT gleich den geänderten Quelldateien der Pakete (fehlt: ${paketFehlt.join(', ') || 'nichts'}; zu viel: ${paketZuviel.join(', ') || 'nichts'})`);
  }
  // Negativproben: eine geänderte Datei in jeder Schreibweise, eine erlaubte nur mit ihrem Verweis, eine unveränderte frei.
  const synth = (k: string): Zeile => ({ abschnitt: 3, teil: '', nr: 0, zellen: ['0', '', '', '', '', '', k] });
  ok(
    ['R/views/PresenterView.tsx', 'src/renderer/src/views/PresenterView.tsx', 'apps/presenter/src/renderer/src/views/PresenterView.tsx'].every((p) =>
      (zeilenFehler(synth(`✓ unverändert (\`${p}\`): x`)) ?? '').includes('geänderter Datei'),
    ) &&
      (zeilenFehler(synth('✓ unverändert (`src/main/index.ts`): x')) ?? '').includes('ohne Verweis auf B2 oder B11') &&
      zeilenFehler(synth('✓ unverändert (`src/main/index.ts`, B2): x')) === null &&
      (zeilenFehler(synth('✓ unverändert (`src/main/control-server.ts`, B11): x')) ?? '').includes('ohne Verweis auf B2') &&
      (zeilenFehler(synth('✓ Publikum (unverändert) (`R/lib/usePresentation.ts`): x')) ?? '').includes('geänderter Datei') &&
      zeilenFehler(synth('✓ Publikum (unverändert) (`R/views/AudienceView.tsx`): x')) === null &&
      zeilenFehler(synth('✓ unverändert (`src/main/present.ts`): x')) === null &&
      (zeilenFehler(synth('✓ unverändert (`packages/ui/src/components/AppShell.tsx`): x')) ?? '').includes('geänderter Datei'),
    'PS Funktionsliste: unverändert erkennt geänderte Dateien in jeder Schreibweise; B2/B11/B12 entlasten nur ihre Dateien; unveränderte Dateien sind frei',
  );
  ok(
    zeilenFehler(synth('✓ entfällt (x, B1)')) === null &&
      zeilenFehler(synth('✓ entfällt (x, B22)')) === null &&
      zeilenFehler(synth('✓ entfällt (x, E15)')) === null &&
      zeilenFehler(synth('✓ entfällt (x, E16)')) === null &&
      ['B0', 'B23', 'E14', 'E17', 'E2'].every((r) => (zeilenFehler(synth(`✓ entfällt (x, ${r})`)) ?? '').includes('Verweis außerhalb')) &&
      (zeilenFehler(synth('✓ entfällt (x)')) ?? '').includes('ohne B- oder E-Verweis') &&
      (zeilenFehler(synth('✓ ersetzt durch Panel Import (`R/views/Einstellungen.tsx`)')) ?? '').includes('ohne B- oder E-Verweis') &&
      (zeilenFehler(synth('✓ Publikum (`R/views/AudienceView.tsx`)')) ?? '').includes('Ortsregister') &&
      (zeilenFehler(synth('✓ Kopf (`R/views/EditorView.tsx`)')) ?? '').includes('Ortsregister') &&
      (zeilenFehler(synth('✓ Panel Import')) ?? '').includes('Ort ohne Datei') &&
      (zeilenFehler(synth('✓ Panel Import (`R/views/Einstellungen.tsx:900-901`)')) ?? '').includes('Zeilen außerhalb') &&
      (zeilenFehler(synth('✓ Panel Import (`R/views/Gibtsnicht.tsx`)')) ?? '').includes('Datei fehlt') &&
      (zeilenFehler(synth('✓ Panel Import (`r/views/Einstellungen.tsx`)')) ?? '').includes('Datei fehlt'),
    'PS Funktionsliste: Verweise B1–B22, E15, E16 gelten, B0, B23, E14, E17 nicht; entfällt und ersetzt brauchen einen Verweis; Ort nur aus dem Register, mit Datei, Zeilen in der Datei, Schreibweise wie im Repo',
  );
}

const zeile = (nr: number): Zeile | undefined => alle.find((z) => z.nr === nr);
const element = (nr: number): string => zeile(nr)?.zellen[2] ?? '';
const kuenftig = (nr: number): string => zeile(nr)?.zellen[6] ?? '';
const beginnt = (nr: number, ...orte: string[]): boolean => orte.some((o) => form(kuenftig(nr))?.ort === o && kuenftig(nr).startsWith(`✓ ${o}`));
const ersetzt = (nr: number, ort: string): boolean => kuenftig(nr).startsWith(`✓ ersetzt durch ${ort}`);
const unveraendert = (nr: number): boolean => kuenftig(nr).startsWith('✓ unverändert (');
const nennt = (nr: number, ...woerter: string[]): boolean => woerter.every((w) => kuenftig(nr).includes(w));
const ohneKommentare = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/** Der im Haken der Zeile für `datei` zitierte Bereich als Quelltext von heute; leer, wenn der Haken die Datei ohne Zeilen nennt. */
function zitiert(nr: number, datei: string): string {
  const v = verweise(kuenftig(nr)).find((x) => x.datei === datei && x.von !== undefined);
  if (v?.von === undefined || v.bis === undefined) return '';
  return quelle(datei).split('\n').slice(v.von - 1, v.bis).join('\n');
}
const zeigtAuf = (nr: number, datei: string, ...woerter: string[]): boolean => {
  const z = zitiert(nr, datei);
  return z !== '' && woerter.every((w) => z.includes(w));
};

// ── Korrekturen aus den Prüfungen (Task 7 → 9 und → 12, Task 8, Task 11): stehen in der Liste ──
{
  ok(['w-80', '320 px'].every((w) => element(17).includes(w)) && !element(17).includes('(80 breit)'), 'PS Funktionsliste Korrektur Nr. 17: das ⚙-Menü ist `w-80` breit, also 320 px');
  ok(element(19).includes('Tooltip') && element(19).includes('nicht als Text'), 'PS Funktionsliste Korrektur Nr. 19: „verbunden“ und „keine Verbindung“ stehen nur als Tooltip am Punkt');
  ok(element(79).includes('publish') && element(79).includes('Standzeit der Schleife neu') && !element(79).includes('bei Folie ohne Wirkung'), 'PS Funktionsliste Korrektur Nr. 79: LIVE bei Folie verteilt den Zustand neu und startet die Standzeit der Schleife neu');
  ok(
    ['Strg+W', 'Weiß', 'preventDefault'].every((w) => element(88).includes(w)) && !element(88).includes('Strg+W aus dem Standardmenü) beendet') &&
      ['Strg+W', 'Weiß', 'nur im Editor'].every((w) => element(208).includes(w)) && !element(208).includes('Strg+W Fenster schließen (Referent oder Publikum: Präsentation endet)'),
    'PS Funktionsliste Korrektur Nr. 88/208: Strg+W schließt Referent und Publikum nicht, der Hook schaltet Weiß (usePresentation.ts:79-84 prüfte keine Zusatztaste)',
  );
  ok(element(88).includes('`R/lib/usePresentation.ts:79-84`') && element(208).includes('Nr. 88'), 'PS Funktionsliste Korrektur Nr. 88/208: mit der Fundstelle des alten Hooks und dem Querverweis');
  ok(
    element(125).includes('Nr. 206') && !element(125).includes('auch per Tastatur (abgeleitet)') && element(206).includes('Nr. 125'),
    'PS Funktionsliste Korrektur Nr. 125/206: die Bildschirmwahl wählt per Maus, die Tasten blättern auf der geschlossenen Auswahl (kein Widerspruch mehr)',
  );
  ok(['Ladefenster', 'Presence', 'Log', 'Absturz', 'Master-Link'].every((w) => element(120).includes(w)) && zeile(120)?.zellen[5].includes('`packages/app-runtime/src/index.ts:573-669`') === true, 'PS Funktionsliste Korrektur Nr. 120: initAppRuntime mit Ladefenster, Presence, Log, Absturz-Fänger und Master-Link');
  ok(element(134).includes('verdeckt') && element(134).includes('schließen ✕') && !element(134).includes('öffnet und schließt'), 'PS Funktionsliste Korrektur Nr. 134: die alte Übersicht verdeckte den Kopf, geschlossen nur über „schließen ✕“ oder einen Folienklick');
  ok(
    zeigtAuf(71, 'src/main/index.ts', 'startControlServer(meldeFernsteuerung)') &&
      zeigtAuf(83, 'src/main/index.ts', 'startControlServer(meldeFernsteuerung)') &&
      zeigtAuf(84, 'src/main/index.ts', 'initAppRuntime(') &&
      /Nachtrag Task 12[^\n]*`src\/main\/index\.ts:70-81`/.test(text.slice(text.indexOf('14. **Fernsteuerung und Master-Link ohne Meldung'))),
    'PS Funktionsliste Korrektur Task 8: Nr. 71/83/84 und Befund 14 nennen die heutigen Zeilen in src/main/index.ts',
  );
}

// ── Pflichtzeilen Verben (Nr. 74–82): Companion-Befehle unverändert im Main (Port 8728), Rückmeldung STATE ──
{
  const cs = quelle('src/main/control-server.ts');
  ok(
    ['open', 'next', 'prev', 'goto', 'black', 'white', 'live', 'stop'].every((v) => cs.includes(`case '${v}'`)) &&
      [74, 75, 76, 77, 78, 79, 80, 81].every((nr) => kuenftig(nr).startsWith('✓ unverändert (`src/main/control-server.ts') && /\bB2\b/.test(kuenftig(nr))),
    'PS Funktionsliste Nr. 74–81 (Verben): PRESENTER NEXT, PREV, GOTO, BLACK, WHITE, LIVE, STOP, OPEN laufen unverändert im Steuerserver (nur die lesende Meldung kam dazu, B2)',
  );
  ok(cs.includes('CONTROL_PORT = 8728') && quelle('src/shared/fernsteuerung.ts').includes('STEUER_PORT = 8728') && unveraendert(82), 'PS Funktionsliste Nr. 82/83: Port 8728 und die STATE-Rückmeldung bleiben');
  const remote = quelle('src/main/remote.ts');
  ok(['next', 'prev', 'goto', 'black', 'white', 'live', 'stop'].every((v) => remote.includes(`case '${v}'`)) && unveraendert(106), 'PS Funktionsliste Nr. 106: die Handy-Befehle bleiben im Main');
  ok(unveraendert(111) && quelle('src/main/gast-klicker.ts').length > 0, 'PS Funktionsliste Nr. 111: die Gast-Kommandos vor und zurück bleiben im Main');
}

// ── Pflichtzeilen Tastatur (Nr. 185–214): die 16 Kürzel hinter dem Filter B10 in Referent und Publikum, F11 nur im Referenten ──
{
  const ob = quelle('R/lib/oberflaeche.ts');
  const wurzel = ohneKommentare(quelle('R/views/ReferentOberflaeche.tsx'));
  const publikum = quelle('R/views/AudienceView.tsx');
  const tasten: Array<[number, string]> = [
    [185, "case 'ArrowRight'"],
    [186, "case 'ArrowDown'"],
    [187, "case 'PageDown'"],
    [188, "case ' '"],
    [189, "case 'Enter'"],
    [190, "case 'ArrowLeft'"],
    [191, "case 'ArrowUp'"],
    [192, "case 'PageUp'"],
    [193, "case 'Backspace'"],
    [194, "case 'Home'"],
    [195, "case 'End'"],
    [196, "case 'b'"],
    [197, "case '.'"],
    [198, "case 'w'"],
    [199, "case ','"],
    [200, "case 'Escape'"],
  ];
  const falsch = tasten.filter(([nr, fall]) => !zeigtAuf(nr, 'R/lib/oberflaeche.ts', fall) || !/\bB1\b/.test(kuenftig(nr)));
  ok(falsch.length === 0, `PS Funktionsliste Nr. 185–200 (Pflichtzeilen Kürzel): jeder Haken zeigt auf seinen Fall in verarbeiteTaste, keine neuen Kürzel (B1) (falsch: ${falsch.map(([n]) => n).join(', ') || 'keine'})`);
  ok(tasten.slice(0, 15).every(([nr]) => beginnt(nr, 'Live-Bereich Tasten')) && beginnt(200, 'Referent-Kopf'), 'PS Funktionsliste Nr. 185–200: die Kürzel stehen bei den Tasten des Live-Bereichs, Escape bei der Kopf-Aktion „■ Beenden“ (title „Esc“, B7)');
  ok(
    wurzel.includes('usePresenterKeys(true)') && publikum.includes('usePresenterKeys(true)') && quelle('R/lib/usePresentation.ts').includes('verarbeiteTaste(e, window.jmpr.present)') && !GEAENDERT_KANON.has('apps/presenter/src/renderer/src/views/AudienceView.tsx'),
    'PS Funktionsliste Nr. 148/166: die Kürzel hängen im Referenten (Wurzel-View) und unverändert im Publikum (AudienceView.tsx)',
  );
  ok(
    beginnt(148, 'Live-Bereich Tasten') && zeigtAuf(148, 'R/views/ReferentOberflaeche.tsx', 'usePresenterKeys(true)') && beginnt(166, 'Publikum (unverändert)') && zeigtAuf(166, 'R/views/AudienceView.tsx', 'usePresenterKeys(true)'),
    'PS Funktionsliste Nr. 148/166: Kürzel im Referenten und im Publikum abgehakt, der Haken zeigt jeweils auf den Hook',
  );
  ok(
    /e\.key !== 'F11'/.test(wurzel) && wurzel.includes('toggleReferentVollbild') && !publikum.includes('F11') && zeigtAuf(147, 'R/views/ReferentOberflaeche.tsx', 'F11') && zeigtAuf(207, 'R/views/ReferentOberflaeche.tsx', 'F11') && beginnt(147, 'Referent-Leiste') && beginnt(207, 'Referent-Leiste'),
    'PS Funktionsliste Nr. 147/207: F11 nur im Referenten, beim Knopf „Vollbild“ der Leiste',
  );
  ok(
    ob.includes('export function istTextfeld') && /if \(istTextfeld\(e\.target\)\)/.test(ob) && [201, 202, 203, 204].every((nr) => /\bB10\b/.test(kuenftig(nr))) && zeigtAuf(201, 'R/lib/oberflaeche.ts', 'istTextfeld'),
    'PS Funktionsliste Nr. 201–204: der Filter B10 (Textfelder nehmen keine Kürzel) steht vor dem switch',
  );
  ok(
    zeigtAuf(202, 'R/views/PresenterView.tsx', 'geheZuAbsenden') && nennt(202, 'Enter') && zeigtAuf(139, 'R/views/PresenterView.tsx', 'geheZuAbsenden') && /\bB10\b/.test(kuenftig(139)),
    'PS Funktionsliste Nr. 139/202: Enter in „Gehe zu“ springt (B10) und der Fokus verlässt das Feld',
  );
  ok(nennt(205, 'O1') && beginnt(205, 'Referent-Leiste') && nennt(206, 'B11', 'O1') && beginnt(206, 'Referent-Leiste'), 'PS Funktionsliste Nr. 205/206: Leertaste und Enter auf Knöpfen und der Auswahl blättern weiter (O1), die Wahl merkt nur (B11)');
  ok(beginnt(213, 'Handy-Seite (unverändert)') && zeigtAuf(213, 'src/main/remote-page.ts', 'keydown'), 'PS Funktionsliste Nr. 213: Tasten der Handy-Seite unverändert, der Haken zeigt auf den Tastenhörer');
}

// ── Pflichtzeile Standardmenü (Nr. 208, N2b 0.3): kein eigenes Menü, Strg+W schließt den Referenten nie (Entscheid zu Task 9) ──
{
  const main = ['index.ts', 'ipc.ts', 'windows.ts', 'present.ts', 'control-server.ts', 'remote.ts', 'gast-klicker.ts', 'datei-oeffnen.ts', 'show-open.ts'].map((d) => quelle(`src/main/${d}`)).join('\n');
  ok(!main.includes('setApplicationMenu') && !main.includes('globalShortcut'), 'PS Funktionsliste Nr. 208: weiter kein eigenes Menü und kein globalShortcut im Main (Electron-Standardmenü)');
  ok(
    zeile(208)?.zellen[1] === 'Kürzel' &&
      ['Standardmenü', 'Strg+W', 'Strg+R', 'B10'].every((w) => kuenftig(208).includes(w)) &&
      zeigtAuf(208, 'R/views/ReferentOberflaeche.tsx', "addEventListener('keydown', fensterSchliessenAbfangen, true)") &&
      zeigtAuf(208, 'R/lib/oberflaeche.ts', 'export function fensterSchliessenAbfangen'),
    'PS Funktionsliste Nr. 208 (Pflichtzeile Standardmenü): abgehakt mit Strg+W (Erfassungsphase im Referenten) und Strg+R',
  );
}

// ── Pflichtpunkt Panel-Tasten (Nr. 214, O1): Feld behält Tasten, Leertaste auf Knopf/Schalter geht ans Tool, Escape schließt ──
{
  ok(
    zeile(214)?.zellen[1] === 'Panel-Tasten' && beginnt(214, 'Panel') && ['Leertaste', 'Escape', 'Feld', 'Knopf', 'Schalter', 'O1'].every((w) => kuenftig(214).includes(w)),
    'PS Funktionsliste Nr. 214 (Pflichtpunkt Panel-Tasten): Leertaste und Escape, je für Feld und Knopf/Schalter (Spec 10, O1)',
  );
  const panel = quelle('packages/ui/src/components/SettingsPanel.tsx');
  ok(panel.includes("e.key === 'Escape'") && panel.includes('defaultPrevented') && panel.includes("'SELECT'"), 'PS Funktionsliste Nr. 214: SettingsPanel schließt mit Escape (nur ohne defaultPrevented) und lässt Felder samt Auswahl ihre Tasten behalten');
  const rahmen = quelle('R/views/ReferentOberflaeche.tsx');
  ok(
    rahmen.includes('settings={<Einstellungen') && rahmen.includes('<PresenterView ') && !quelle('R/views/Einstellungen.tsx').includes('<PresenterView') && quelle('R/views/EditorOberflaeche.tsx').includes('settings={<Einstellungen'),
    'PS Funktionsliste Nr. 214: das Panel ist kein eigener Bildschirm, Live-Bereich und Kürzel bleiben bei offenem Panel gemountet',
  );
}

// ── Abläufe aus Abschnitt 3: im Main unverändert, im Renderer in den Wurzel-Views (useStand), nicht im Panel (B8, E15) ──
{
  const panel = ohneKommentare(quelle('R/views/Einstellungen.tsx'));
  ok(
    ['window.', 'useEffect', 'addEventListener', 'useProject(', 'useStand(', 'useBrueckenWert('].every((w) => !panel.includes(w)),
    'PS Funktionsliste Abschnitt 3: Einstellungen.tsx hat keinen Zugriff auf window, keine Effekte, kein Abo und keinen Store (B8, E15)',
  );
  const editor = ohneKommentare(quelle('R/views/EditorOberflaeche.tsx'));
  const referent = ohneKommentare(quelle('R/views/ReferentOberflaeche.tsx'));
  ok(
    (editor.match(/useStand\(/g) ?? []).length === 1 && editor.includes("useStand('editor'") && (referent.match(/useStand\(/g) ?? []).length === 1 && referent.includes("useStand('referent'"),
    'PS Funktionsliste Abschnitt 3: Editor und Referent holen ihren Stand je genau einmal in der Wurzel-View (useStand)',
  );
  const stand = ohneKommentare(quelle('R/lib/useStand.ts'));
  ok(
    ['MASTER_LINK_QUELLE', 'FERNSTEUERUNG_QUELLE', 'PRAESENTATION_QUELLE', 'NDI_QUELLE', 'HANDY_QUELLE', 'GAST_KLICKER_QUELLE', 'TIMER_ZUSTAND_QUELLE', 'TIMER_EINSTELLUNG_QUELLE'].every((q) => stand.includes(`useBrueckenWert(${q})`)) &&
      stand.includes('onBildschirme') &&
      stand.includes('remote?.interfaces'),
    'PS Funktionsliste Abschnitt 3: alle Abos (Präsentation, NDI, Handy, Gast-Klicker, Timer, Master-Link, Fernsteuerung, Bildschirme, Netzwerkkarten) laufen in useStand',
  );
  const einstieg = quelle('R/main.tsx');
  ok(
    einstieg.includes('onOpenProject') && einstieg.includes('onOpenFiles') && einstieg.includes("oeffneGeladene({ files: [], projekt: p, hinweise: [] }, 'ersetzen')") && beginnt(98, 'Arbeitsfläche') && beginnt(99, 'Arbeitsfläche'),
    'PS Funktionsliste Nr. 98/99: Show-Link und PRESENTER OPEN kommen weiter über R/main.tsx in den Editor',
  );
  const mainUnveraendert = [52, 53, 54, 55, 56, 57, 72, 74, 75, 76, 77, 78, 79, 80, 81, 82, 85, 86, 87, 88, 90, 91, 92, 93, 94, 95, 96, 97, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120];
  const nichtUnveraendert = mainUnveraendert.filter((nr) => !unveraendert(nr));
  ok(nichtUnveraendert.length === 0, `PS Funktionsliste Abschnitt 2/3: Systemdialoge, Log, Companion, Präsentation, Dateien, Handy, Gast-Klicker, Timer, NDI und App laufen unverändert (nicht so: ${nichtUnveraendert.join(', ') || 'keine'})`);
  ok(
    beginnt(71, 'Statusleiste') && beginnt(83, 'Statusleiste') && beginnt(84, 'Statusleiste') && [71, 83, 84].every((nr) => /\bB2\b/.test(kuenftig(nr))),
    'PS Funktionsliste Nr. 71/83/84: Steuerserver und Master-Link sind jetzt als Einträge der Statusleiste sichtbar (B2)',
  );
}

// ── Zusatzfenster (Abschnitt 4): Referent im neuen Aufbau, Publikum, NDI-Fenster und Handy-Seite unverändert ──
{
  const referentOrte = ['Referent-Kopf', 'Referent-Leiste', 'Live-Bereich', ...LIVE.map((t) => `Live-Bereich ${t}`), 'Statusleiste', 'Panel', ...ABSCHNITTE.map((a) => `Panel ${a}`)];
  const ref = alle.filter((z) => z.teil === '4a');
  const ohneOrt = ref.filter((z) => z.nr !== 121 && !referentOrte.includes(form(z.zellen[6])?.ort ?? ''));
  ok(ohneOrt.length === 0 && unveraendert(121), `PS Funktionsliste Nr. 121–165 (Referent): jeder Punkt hat einen Ort im neuen Referenten, die Fensterhülle bleibt (falsch: ${ohneOrt.map((z) => z.nr).join(', ') || 'keine'})`);
  ok(
    ref.filter((z) => z.nr !== 121).every((z) => ['R/views/ReferentOberflaeche.tsx', 'R/views/ReferentLeiste.tsx', 'R/views/PresenterView.tsx', 'R/views/Einstellungen.tsx', 'R/components/RemotePanel.tsx', 'R/components/GastKlickerAbschnitt.tsx', 'R/lib/oberflaeche.ts', 'R/lib/useStand.ts', 'R/lib/usePresentation.ts'].some((d) => z.zellen[6].includes(`\`${d}`))),
    'PS Funktionsliste Nr. 122–165: jeder Haken nennt eine Datei des umgebauten Referenten (Wurzel, Leiste, Live-Bereich, Panel)',
  );
  ok(beginnt(166, 'Publikum (unverändert)') && beginnt(167, 'Publikum (unverändert)') && beginnt(168, 'NDI-Fenster (unverändert)'), 'PS Funktionsliste Nr. 166–168: Publikum und NDI-Fenster unverändert');
  ok([169, 170, 171, 172, 173, 174, 175, 176, 221].every((nr) => beginnt(nr, 'Handy-Seite (unverändert)') && nennt(nr, '`src/main/remote-page.ts')) && !GEAENDERT_KANON.has('apps/presenter/src/main/remote-page.ts'), 'PS Funktionsliste Nr. 169–176, 221: die Handy-Seite (src/main/remote-page.ts) ist unverändert');
  ok([177, 178, 179, 180].every((nr) => beginnt(nr, 'Publikum (unverändert)')) && [181, 182].every((nr) => beginnt(nr, 'NDI-Fenster (unverändert)')), 'PS Funktionsliste Nr. 177–182: Publikumsbild und NDI-Bild unverändert (B5)');
  const publikum = quelle('R/views/AudienceView.tsx');
  ok(!publikum.includes('AppShell') && !publikum.includes('@jm/settings') && !GEAENDERT_KANON.has('apps/presenter/src/renderer/src/ndi/ndi-ansicht.ts'), 'PS Funktionsliste Abschnitt 4/5: Publikum ohne AppShell und ohne @jm/settings, NDI-Ansicht unverändert (B5)');
}

// ── Entfernte und ersetzte Bedienelemente (Task 10/11): jedes hat seinen neuen Ort mit Verweis ──
{
  const leiste = ohneKommentare(quelle('R/views/ReferentLeiste.tsx'));
  ok(
    ersetzt(129, 'Live-Bereich Tasten') && ersetzt(130, 'Live-Bereich Tasten') && [129, 130].every((nr) => nennt(nr, 'B6', 'B12')) && zeigtAuf(129, 'R/views/PresenterView.tsx', 'taste-schwarz') && zeigtAuf(130, 'R/views/PresenterView.tsx', 'taste-weiss') && !leiste.includes('⬛') && !leiste.includes('⬜'),
    'PS Funktionsliste Nr. 129/130: ⬛ und ⬜ sind ersetzt durch Schwarz und Weiß unter der Folie (B6, B12)',
  );
  ok(
    beginnt(138, 'Live-Bereich Tasten') && beginnt(140, 'Live-Bereich Tasten') && zeigtAuf(138, 'R/views/PresenterView.tsx', 'taste-zurueck') && zeigtAuf(140, 'R/views/PresenterView.tsx', 'taste-weiter') && nennt(138, 'B13') && nennt(140, 'B13') && nennt(144, 'B13') && beginnt(144, 'Live-Bereich Tasten'),
    'PS Funktionsliste Nr. 138/140/144: Zurück und Weiter mit Grund gesperrt, Weiter mit Schleife auf der letzten Folie bedienbar (B13)',
  );
  ok(ersetzt(135, 'Referent-Kopf') && nennt(135, 'B7') && !leiste.includes('📱'), 'PS Funktionsliste Nr. 135: 📱 ist ersetzt durch ⚙ im Referenten-Kopf (B7)');
  ok(beginnt(136, 'Referent-Kopf') && nennt(136, 'B7') && zeigtAuf(136, 'R/views/ReferentOberflaeche.tsx', 'KopfBeenden'), 'PS Funktionsliste Nr. 136: „■ Beenden“ als Kopf-Aktion (B7)');
  ok(ersetzt(152, 'Panel Handy-Fernsteuerung') && nennt(152, 'B8', 'O1', 'Escape'), 'PS Funktionsliste Nr. 152: das Handy-Fenster ist ersetzt durch den Panel-Abschnitt, Escape schließt dort nur das Panel (O1)');
  // Nachtrag Task 12 (Entscheid zu Bedenken 3, Global Constraint „Wahl ≠ Bewegung“): Netzwerkkarte und Port ändern nur den Entwurf,
  // erst „Setzen“ wendet an; Server- und PIN-Schalter wirken sofort mit dem angewandten Stand.
  ok(
    [154, 155].every((nr) => beginnt(nr, 'Panel Handy-Fernsteuerung') && nennt(nr, '„Setzen“', 'Wahl ≠ Bewegung') && zeigtAuf(nr, 'R/components/RemotePanel.tsx', 'a.setzeEntwurf(')) &&
      !kuenftig(155).includes('übernommen beim Verlassen') &&
      [153, 156].every((nr) => beginnt(nr, 'Panel Handy-Fernsteuerung') && nennt(nr, 'angewandten Stands')) &&
      !quelle('R/components/RemotePanel.tsx').includes('onBlur'),
    'PS Funktionsliste Nr. 153–156: Netzwerkkarte und Port wirken erst mit „Setzen“ (Wahl ≠ Bewegung), Server und PIN sofort mit dem angewandten Stand',
  );
  ok(ersetzt(17, 'Editor-Kopf') && nennt(17, 'B14'), 'PS Funktionsliste Nr. 17: das ⚙-Menü ist ersetzt durch ⚙ und Panel (B14)');
  ok(beginnt(5, 'Editor-Kopf') && nennt(5, 'B4', 'jm-theme'), 'PS Funktionsliste Nr. 5: Hell/Dunkel im Editor-Kopf (B4), der Referent bleibt fest dunkel');
  ok(beginnt(6, 'Editor-Kopf') && /entfällt \(E16\)/.test(kuenftig(6)), 'PS Funktionsliste Nr. 6: Logo und Name im Kopf, der Untertitel entfällt (E16)');
  ok(
    beginnt(125, 'Referent-Leiste') && nennt(125, 'B11', 'Auf diesen Bildschirm') && zeigtAuf(125, 'R/views/ReferentLeiste.tsx', 'onWahl(id)') && beginnt(14, 'Panel Ausgabe auf Bildschirm') && nennt(14, 'B11'),
    'PS Funktionsliste Nr. 14/125: die Bildschirmwahl merkt nur, „Auf diesen Bildschirm“ verschiebt (B11)',
  );
  ok(beginnt(134, 'Referent-Leiste') && beginnt(150, 'Live-Bereich') && [134, 150].every((nr) => nennt(nr, 'B12')), 'PS Funktionsliste Nr. 134/150: die Übersicht liegt nur im Inhalt, Kopf und Leiste bleiben bedienbar (B12)');
  ok(
    [21, 22].every((nr) => beginnt(nr, 'Editor-Werkzeugleiste') && zeigtAuf(nr, 'R/components/Toolbar.tsx', 'TallyButton') && nennt(nr, 'B14')) && nennt(21, 'Keine sichtbaren Folien zum Präsentieren.') && nennt(22, 'B3'),
    'PS Funktionsliste Nr. 21/22: die Haupttaste Präsentieren/Beenden in der Werkzeugleiste, gesperrt mit Grund, live nach B3',
  );
}

// ── Pflichtzeilen aus N2b 1.1 (✏️, ❌, ➕; Plan Teil 3): jede Zeile behält ihren Vermerk und ist abgehakt ──
{
  const n2b: Record<number, number[]> = {
    1: [21, 22],
    2: [137, 141, 142, 143, 145],
    9: [14, 15, 125, 126],
    16: [17],
    18: [5, 122],
    19: [148, 166],
    21: [167, 168],
    24: [16, 127],
    25: [133, 147],
    26: [128, 160],
    27: [35, 44, 131],
    28: [25, 51],
    29: [4, 121],
    30: [124, 132, 134, 139, 150],
  };
  const fehlt = Object.entries(n2b).flatMap(([n, nrs]) => nrs.filter((nr) => !new RegExp(`N2b 1\\.1 Nr\\. (?:[0-9, ]+, )?${n}\\b`).test(element(nr)) || zeilenFehler(zeile(nr) as Zeile) !== null).map((nr) => `${n}→${nr}`));
  ok(fehlt.length === 0, `PS Funktionsliste: jede Zeile aus N2b 1.1 mit ✏️, ❌ oder ➕ hat ihren Vermerk und ist abgehakt (fehlt: ${fehlt.join(', ') || 'nichts'})`);
}
