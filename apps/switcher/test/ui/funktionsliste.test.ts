// ─────────────────────────────────────────────────────────────────────────────
// Funktionsliste nach dem Umbau (UX Welle 1, Switcher e; Spec 10 „Kein Funktionsverlust“). Jede der 164 Zeilen in den Abschnitten
// 1–7 von docs/ux/funktionslisten/switcher.md ist in „künftig wo“ abgehakt: „✓ “ und ein Ort des Ortsregisters, „unverändert (…)“,
// „entfällt (…, E…)“ oder „ersetzt durch {Ort} (…, E…)“. E-Verweise nur auf E1–E18. Jede genannte Datei existiert, Groß- und
// Kleinschreibung wie im Repo. Dazu Querprüfungen gegen den Code (Abläufe in der View, persistId, Panel-Tasten, Pflichtzeilen).
// Läuft im Paketordner apps/switcher (npm run selftest -w @jm/switcher, zweiter Lauf).
// ─────────────────────────────────────────────────────────────────────────────

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { gleich, leseText, ok } from '@jm/ui/testhilfe';

const LISTE = '../../docs/ux/funktionslisten/switcher.md';

/** Panel-Abschnitte (Titel der @jm/settings-Abschnitte und der tool-eigenen Abschnitte). */
const ABSCHNITTE = ['NDI-Ausgabe', 'Ausgabe auf Bildschirm', 'Fernsteuerung', 'Programm-Audio', 'Streaming', 'Aufnahme', 'Programm-Format'];

/** Ortsregister des Plans; „Panel“ allein steht für Regeln, die im ganzen Panel gelten (Aufbau, Einleitung). */
const ORTE: readonly string[] = [
  'Kopf',
  'Werkzeugleiste',
  'Live-Bereich',
  'Monitore',
  'untere Panels',
  'Statusleiste',
  'Overlays',
  'Ausgabefenster',
  'Panel',
  ...ABSCHNITTE.map((a) => `Panel ${a}`),
];

/** Zeilen insgesamt und je Abschnitt 1–7, wie Task 2 die Liste angelegt hat. */
const GESAMT = 164;
const JE_ABSCHNITT = [86, 18, 31, 0, 4, 10, 15];

/** Datei in Backticks: Pfad mit Endung, aufgelöst nach der Pfadregel im Kopf der Liste. */
const PFAD = /`([A-Za-z0-9_./-]+\.(?:tsx|ts|css|html|json|md|mjs))`/g;
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
      liste.push({ abschnitt, nr: Number(nr[1]), zellen: z.split('|').slice(1, -1).map((s) => s.trim()) });
    }
  }
  return liste;
}

/** Pfadregel der Liste: Repo-Wurzel, apps/switcher/src, @jm/ui-Bausteine oder der Renderer. */
function aufgeloest(pfad: string): string {
  if (/^(?:apps|packages|docs)\//.test(pfad)) return `../../${pfad}`;
  if (/^(?:main|preload|shared|utility|renderer)\//.test(pfad)) return `src/${pfad}`;
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
  return fehlt.length > 0 ? `Datei fehlt: ${fehlt.join(', ')}` : null;
}

const alle = zeilen(leseText(LISTE));

gleich(alle.length, GESAMT, 'SW Funktionsliste: 164 Zeilen in den Abschnitten 1–7 (Stand Task 2)');
gleich(
  JE_ABSCHNITT.map((_, i) => alle.filter((z) => z.abschnitt === i + 1).length),
  JE_ABSCHNITT,
  'SW Funktionsliste: Zeilen je Abschnitt wie in Task 2 (86/18/31/0/4/10/15)',
);
gleich(
  alle.map((z) => z.nr),
  alle.map((_, i) => i + 1),
  'SW Funktionsliste: Nummern fortlaufend ab 1',
);

for (const z of alle) {
  const f = zeilenFehler(z);
  ok(f === null, `SW Funktionsliste Nr. ${z.nr} abgehakt${f === null ? '' : ` – ${f}`}`);
}

const zeile = (nr: number): Zeile | undefined => alle.find((z) => z.nr === nr);
const kuenftig = (nr: number): string => zeile(nr)?.zellen[6] ?? '';
const quelle = (pfad: string): string => (gibtEs(pfad) ? readFileSync(aufgeloest(pfad), 'utf8') : '');

// ── Haupttasten (E7): Cut, Auto, Aufnahme und Stream stehen im Live-Bereich in views/LiveBereich.tsx ──
for (const nr of [16, 17, 20, 21]) {
  ok(
    kuenftig(nr).startsWith('✓ Live-Bereich') && kuenftig(nr).includes('`views/LiveBereich.tsx`') && /\bE7\b/.test(kuenftig(nr)),
    `SW Funktionsliste Nr. ${nr}: Haupttaste im Live-Bereich, views/LiveBereich.tsx (E7)`,
  );
}
ok(
  ['cut', 'auto', 'aufnahme', 'stream'].every((w) => quelle('views/LiveBereich.tsx').includes(`h.${w}()`)),
  'SW Funktionsliste: LiveBereich.tsx verdrahtet alle vier Haupttasten (cut, auto, aufnahme, stream)',
);

// ── Pflichtzeilen Tastatur: keine eigenen Kürzel, Panel-Tasten nach O1, Menü ──
ok(
  zeile(145)?.zellen[1] === 'Tastenkürzel' && kuenftig(145).startsWith('✓ ') && kuenftig(145).includes('keine') && /\bE1\b/.test(kuenftig(145)),
  'SW Funktionsliste Nr. 145 (Pflichtzeile Tastenkürzel): abgehakt, keine eigenen Kürzel, keine neuen (E1)',
);
ok(
  zeile(148)?.zellen[1] === 'Pflichtpunkt Panel' &&
    kuenftig(148).startsWith('✓ ') &&
    ['Leertaste', 'Escape', 'Feld', 'Schalter', 'O1'].every((w) => kuenftig(148).includes(w)),
  'SW Funktionsliste Nr. 148 (Pflichtpunkt Panel): Leertaste und Escape, je für Feld und Schalter (Spec 10, O1)',
);
ok(
  zeile(149)?.zellen[1] === 'Menü / globale Kürzel' && kuenftig(149).startsWith('✓ unverändert (`main/index.ts`)'),
  'SW Funktionsliste Nr. 149 (Menü): der Hauptprozess bleibt unverändert',
);

// ── Panel-Tasten nach O1 stehen im Baustein: Escape schließt, Leertaste auf Knopf/Schalter geht ans Tool ──
{
  const panel = quelle('packages/ui/src/components/SettingsPanel.tsx');
  ok(panel.includes('Escape') && panel.includes('defaultPrevented'), 'SW Funktionsliste Nr. 148: SettingsPanel schließt mit Escape, nur wenn nicht defaultPrevented');
}

// ── Gemerkte Zustände: localStorage-Schlüssel und persistId ──
ok(
  (zeile(150)?.zellen[3] ?? '').includes('jmswitch-settings') && quelle('store/settings.ts').includes("name: 'jmswitch-settings'"),
  'SW Funktionsliste Nr. 150: der Schlüssel jmswitch-settings bleibt im Store',
);
ok(
  kuenftig(163).includes('jm.collapsible.switcher.unten') && quelle('views/SwitcherView.tsx').includes('persistId="switcher.unten"'),
  'SW Funktionsliste Nr. 163: das untere Panel merkt sich Auf/Zu unter persistId switcher.unten (views/SwitcherView.tsx)',
);

// ── R8: die wiederhergestellten Zeilen stehen im Panel ──
for (const [nr, ort] of [
  [66, 'Panel'],
  [71, 'Panel NDI-Ausgabe'],
  [75, 'Panel Ausgabe auf Bildschirm'],
  [78, 'Panel Ausgabe auf Bildschirm'],
  [80, 'Panel Programm-Audio'],
  [84, 'Panel Fernsteuerung'],
] as const) {
  ok(
    ortAm(kuenftig(nr).slice(2)) === ort && kuenftig(nr).includes('`views/Einstellungen.tsx`') && kuenftig(nr).includes('R8'),
    `SW Funktionsliste Nr. ${nr}: wiederhergestellt (R8) im ${ort}, views/Einstellungen.tsx`,
  );
}
ok(
  quelle('views/Einstellungen.tsx').includes('onClick={aktionen.scanDisplays}') && quelle('views/Einstellungen.tsx').includes('panelText.'),
  'SW Funktionsliste Nr. 75 und Erklärtexte: Knopf „Monitore aktualisieren“ und Erklärtexte stehen in views/Einstellungen.tsx',
);

// ── Abläufe aus Abschnitt 3: bleiben in der immer gemounteten View, nicht im Panel (G7, G8) ──
{
  const view = quelle('views/SwitcherView.tsx');
  const panel = quelle('views/Einstellungen.tsx');
  for (const [nr, imCode] of [
    [118, 'control.onCommand'],
    [126, 'control.pushState'],
    [127, 'control.start'],
  ] as const) {
    ok(
      kuenftig(nr).includes('`views/SwitcherView.tsx`') && view.includes(imCode) && !panel.includes(imCode),
      `SW Funktionsliste Nr. ${nr}: ${imCode} bleibt in SwitcherView, wirkt bei geschlossenem Panel, nicht im Panel (G8)`,
    );
  }
  for (const nr of [118, 119, 120, 121, 122, 123, 124, 126, 127]) {
    ok(kuenftig(nr).includes('`views/SwitcherView.tsx`'), `SW Funktionsliste Nr. ${nr}: Ablauf steht in views/SwitcherView.tsx`);
  }
  ok(
    ['preview', 'program', 'cut', 'auto', 'record', 'stream'].every((v) => view.includes(`'${v}'`)),
    'SW Funktionsliste: alle sechs Fernsteuer-Verben (preview, program, cut, auto, record, stream) stehen in SwitcherView',
  );
}

// ── Abgrenzung Ausgabefenster ──
ok(
  [136, 137, 138, 139].every((nr) => kuenftig(nr).startsWith('✓ Ausgabefenster') && /\bE18\b/.test(kuenftig(nr))),
  'SW Funktionsliste Nr. 136–139: Ausgabefenster unverändert (E18)',
);
