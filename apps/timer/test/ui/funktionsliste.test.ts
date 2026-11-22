// ─────────────────────────────────────────────────────────────────────────────
// Funktionsliste nach dem Umbau (UX Welle 1, Timer e; Spec 10 „Kein Funktionsverlust“). Jede der 184 Zeilen in den Abschnitten
// 1–7 von docs/ux/funktionslisten/timer.md ist in „künftig wo“ abgehakt: „✓ “ und ein Ort des Ortsregisters, „unverändert (…)“,
// „entfällt (…, E…)“ oder „ersetzt durch {Ort} (…, E…)“. E-Verweise nur auf E1–E18. Jede genannte Datei existiert, Groß- und
// Kleinschreibung wie im Repo. Dazu Querprüfungen gegen den Code (Kürzel und Enter/Escape, Panel-Tasten nach O1, persistId,
// die Abläufe in den immer gemounteten Teilen statt im Panel, Ausnahme R11, kein window.confirm).
// Läuft im Paketordner apps/timer (npm run selftest -w @jm/timer, zweiter Lauf).
// ─────────────────────────────────────────────────────────────────────────────

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { gleich, leseText, ok } from '@jm/ui/testhilfe';

const LISTE = '../../docs/ux/funktionslisten/timer.md';

/** Panel-Abschnitte des Timers (Titel der @jm/settings-Abschnitte und der tool-eigenen Abschnitte, E3, E9). */
const ABSCHNITTE = ['Fernsteuerung', 'Speaker-Fenster', 'LAN-Fernbedienung', 'Farben'];

/** Ortsregister des Plans; „Panel“ allein steht für Regeln, die im ganzen Panel gelten (Panel-Tasten nach O1). */
const ORTE: readonly string[] = [
  'Kopf',
  'Kopfmitte',
  'Sidebar',
  'Live-Bereich Uhr',
  'Live-Bereich Countdown',
  'Live-Bereich Ablauf',
  'MessageBar',
  'Statusleiste',
  'Tray',
  'Speaker/Remote',
  'Panel',
  ...ABSCHNITTE.map((a) => `Panel ${a}`),
];

/** Zeilen insgesamt und je Abschnitt 1–7, wie Task 8 die Liste angelegt hat. */
const GESAMT = 184;
const JE_ABSCHNITT = [87, 18, 41, 0, 7, 18, 13];

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

/** Pfadregel der Liste: Repo-Wurzel, apps/timer/src (main, preload, shared, standalone, renderer) oder der Renderer. */
function aufgeloest(pfad: string): string {
  if (/^(?:apps|packages|docs)\//.test(pfad)) return `../../${pfad}`;
  if (/^(?:main|preload|shared|standalone|renderer)\//.test(pfad)) return `src/${pfad}`;
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

gleich(alle.length, GESAMT, 'TI Funktionsliste: 184 Zeilen in den Abschnitten 1–7 (Stand Task 8)');
gleich(
  JE_ABSCHNITT.map((_, i) => alle.filter((z) => z.abschnitt === i + 1).length),
  JE_ABSCHNITT,
  'TI Funktionsliste: Zeilen je Abschnitt wie in Task 8 (87/18/41/0/7/18/13)',
);
gleich(
  alle.map((z) => z.nr),
  alle.map((_, i) => i + 1),
  'TI Funktionsliste: Nummern fortlaufend ab 1',
);

for (const z of alle) {
  const f = zeilenFehler(z);
  ok(f === null, `TI Funktionsliste Nr. ${z.nr} abgehakt${f === null ? '' : ` – ${f}`}`);
}

const zeile = (nr: number): Zeile | undefined => alle.find((z) => z.nr === nr);
const kuenftig = (nr: number): string => zeile(nr)?.zellen[6] ?? '';
const quelle = (pfad: string): string => (gibtEs(pfad) ? readFileSync(aufgeloest(pfad), 'utf8') : '');

/** Alle Quelltexte unter einem Ordner (rekursiv), für die Wächter „kein window.confirm“. */
function alleQuellen(ordner: string): string[] {
  return readdirSync(ordner).flatMap((n) => {
    const p = `${ordner}/${n}`;
    return statSync(p).isDirectory() ? alleQuellen(p) : /\.(?:ts|tsx)$/.test(n) ? [readFileSync(p, 'utf8')] : [];
  });
}

// ── Pflichtzeilen Tastatur: Leertaste und R im Countdown, Enter und Escape, Eingabeziele (Nr. 154–167) ──
{
  const countdown = quelle('components/Countdown.tsx');
  ok(
    kuenftig(154).startsWith('✓ Live-Bereich Countdown') &&
      kuenftig(155).startsWith('✓ Live-Bereich Countdown') &&
      countdown.includes("e.code === 'Space'") &&
      countdown.includes("e.code === 'KeyR'") &&
      countdown.includes('istEingabeZiel(e.target)'),
    'TI Funktionsliste Nr. 154/155 (Pflichtzeilen Leertaste und R): im Countdown-Handler, der Eingabeziele auslässt',
  );
  const weiche = quelle('lib/oberflaeche.ts');
  ok(
    ['INPUT', 'TEXTAREA', 'SELECT', 'isContentEditable'].every((w) => weiche.includes(w)) && /\bO1\b/.test(kuenftig(156)),
    'TI Funktionsliste Nr. 156: der Handler lässt INPUT, TEXTAREA, SELECT und contentEditable aus (O1)',
  );
  ok(
    countdown.includes("e.key === 'Enter'") && countdown.includes('blur()') && kuenftig(158).includes('`components/Countdown.tsx`'),
    'TI Funktionsliste Nr. 158: Enter im Dauer-Feld ruft blur',
  );
  const nachricht = quelle('components/MessageBar.tsx');
  ok(
    nachricht.includes("e.key === 'Enter'") &&
      nachricht.includes("e.key === 'Escape'") &&
      nachricht.includes('setDraft(message.text)') &&
      [160, 161].every((nr) => kuenftig(nr).startsWith('✓ MessageBar')),
    'TI Funktionsliste Nr. 160/161 (Pflichtzeilen MessageBar): Enter sendet, Escape verwirft den Entwurf',
  );
  const zeileDatei = quelle('components/TimetableRow.tsx');
  ok(
    (zeileDatei.match(/e\.key === 'Enter'/g) ?? []).length >= 6 && [162, 163, 164, 165, 166, 167].every((nr) => kuenftig(nr).includes('`components/TimetableRow.tsx`')),
    'TI Funktionsliste Nr. 162–167: Enter in allen sechs Zeilenfeldern ruft blur (TimetableRow.tsx)',
  );
  ok(
    quelle('components/DelayControls.tsx').includes("e.key === 'Enter'") && kuenftig(159).includes('`components/DelayControls.tsx`'),
    'TI Funktionsliste Nr. 159: Enter im Feld „Custom · Sekunden“ wendet an (DelayControls.tsx)',
  );
}

// ── Pflichtpunkt Panel (Nr. 169, O1): Feld behält Tasten, Leertaste auf Knopf/Schalter geht ans Tool, Escape schließt ──
ok(
  zeile(169)?.zellen[1] === 'Pflichtpunkt Panel' &&
    kuenftig(169).startsWith('✓ Panel ') &&
    ['Leertaste', 'Escape', 'Feld', 'Schalter', 'O1'].every((w) => kuenftig(169).includes(w)),
  'TI Funktionsliste Nr. 169 (Pflichtpunkt Panel): Leertaste und Escape, je für Feld und Knopf/Schalter (Spec 10, O1)',
);
{
  const panel = quelle('packages/ui/src/components/SettingsPanel.tsx');
  ok(panel.includes('Escape') && panel.includes('defaultPrevented'), 'TI Funktionsliste Nr. 169: SettingsPanel schließt mit Escape, nur wenn nicht defaultPrevented');
  ok(
    quelle('views/TimerOberflaeche.tsx').includes('<ModusInhalt') && !quelle('views/Einstellungen.tsx').includes('Countdown'),
    'TI Funktionsliste Nr. 169/157: das Panel ist kein Modus, der Countdown bleibt neben dem Panel gemountet (E9)',
  );
}
ok(
  kuenftig(171).startsWith('✓ unverändert (`main/index.ts`)') && !quelle('main/index.ts').includes('setApplicationMenu'),
  'TI Funktionsliste Nr. 171 (Menü): der Hauptprozess bleibt unverändert, weiter ohne setApplicationMenu',
);

// ── Gemerkte Zustände: persistId der beiden Collapsibles, Theme (E17) ──
ok(
  quelle('components/DelayControls.tsx').includes('persistId="timer.delay"') &&
    quelle('components/AutoAdvanceSettings.tsx').includes('persistId="timer.autoAdvance"') &&
    kuenftig(172).includes('jm.collapsible.timer.delay') &&
    kuenftig(172).includes('jm.collapsible.timer.autoAdvance') &&
    kuenftig(172).includes('jm-theme'),
  'TI Funktionsliste Nr. 172: Delay und Auto-Advance merken Auf/Zu unter persistId timer.delay und timer.autoAdvance, das Theme unter jm-theme (E17)',
);
ok(
  [31, 46, 71].every((nr) => kuenftig(nr).includes('Collapsible')) && kuenftig(49).includes('persistId timer.autoAdvance'),
  'TI Funktionsliste Nr. 31/46/49/71: Delay und Auto-Advance stehen als Collapsible im Live-Bereich ihres Modus',
);

// ── Abläufe aus Abschnitt 3: bleiben in den immer gemounteten Teilen, nicht im Panel (G7, G8) ──
{
  const app = quelle('App.tsx');
  const operator = quelle('views/Operator.tsx');
  const panel = quelle('views/Einstellungen.tsx');
  ok(
    app.includes('connect(resolveServerUrl()') && !panel.includes('connect(') && kuenftig(106).includes('`App.tsx`'),
    'TI Funktionsliste Nr. 106: der Socket-Client wird in App verbunden (oberhalb des Modus), nicht im Panel (G8)',
  );
  ok(
    operator.includes('useAutoAdvance()') && !panel.includes('useAutoAdvance') && kuenftig(110).includes('`views/Operator.tsx`'),
    'TI Funktionsliste Nr. 110: useAutoAdvance läuft in OperatorView, nicht im Panel und nicht im Modus (G8)',
  );
  ok(
    ['window.addEventListener', 'useEffect', 'setInterval'].every((w) => !panel.includes(w)),
    'TI Funktionsliste: Einstellungen.tsx hat keine eigenen Effekte (G7, G8)',
  );
  ok(
    quelle('views/TimerOberflaeche.tsx').includes('if (!window.jm?.speaker) return;') && quelle('views/TimerOberflaeche.tsx').includes('window.jm?.speaker.toggle()'),
    'TI Funktionsliste Nr. 153: TimerOberflaeche prüft window.jm?.speaker vor dem Zugriff, im Browser ohne Preload wirkungslos (E18)',
  );
  ok(
    ['main/state.ts', 'main/server.ts', 'main/index.ts', 'main/control-server.ts'].every((d) => gibtEs(d)) &&
      [113, 115, 118, 133].every((nr) => kuenftig(nr).startsWith('✓ ')),
    'TI Funktionsliste Nr. 113/115/118/133: die Abläufe des Hauptprozesses haben ihre Haken',
  );
}

// ── Statusleiste: Verbindung, Speaker, Fernsteuerung (E2, E3) ──
ok(
  [14, 105, 133].every((nr) => kuenftig(nr).startsWith('✓ Statusleiste')) && /\bE2\b/.test(kuenftig(133)) && !/\bE10\b/.test(kuenftig(105)),
  'TI Funktionsliste Nr. 14/105/133: Sync, Verbindungs- und Startfehler und Fernsteuerung stehen in der Statusleiste',
);
ok(
  [15, 146].every((nr) => kuenftig(nr).startsWith('✓ Kopfmitte') && /\bE3\b/.test(kuenftig(nr))),
  'TI Funktionsliste Nr. 15/146: Speaker-Knopf und -Zustand in der Kopfmitte (E3)',
);

// ── Entfallene und ersetzte Elemente aus der Prüfung von Task 11 (task-11-entfallen.md) ──
ok(kuenftig(9) === '✓ entfällt (E9): die falsche Versionszeile „v0.1.0“ ist weg', 'TI Funktionsliste Nr. 9: Versionszeile entfällt (E9)');
ok(
  kuenftig(7).startsWith('✓ ersetzt durch Panel LAN-Fernbedienung') && /\bE9\b/.test(kuenftig(7)) && kuenftig(8).startsWith('✓ ersetzt durch Panel Farben') && /\bE9\b/.test(kuenftig(8)),
  'TI Funktionsliste Nr. 7/8: „Remote“ und „Farben“ werden Panel-Abschnitte (E9)',
);
ok(kuenftig(16).startsWith('✓ ersetzt durch Kopf') && /\bE17\b/.test(kuenftig(16)), 'TI Funktionsliste Nr. 16: Theme-Knopf im Kopf (E17)');
ok(/\bE8\b/.test(kuenftig(22)) && kuenftig(22).includes('entfällt'), 'TI Funktionsliste Nr. 22: die feste Pille „Live“ der Uhr entfällt (E8)');
{
  const lbe = quelle('views/LiveBereich.tsx');
  const text = quelle('lib/oberflaeche.ts');
  ok(
    kuenftig(34).startsWith('✓ Live-Bereich Countdown') && lbe.includes('TallyButton') && text.includes("startPause: 'Leertaste'") && text.includes("reset: 'R'"),
    'TI Funktionsliste Nr. 34: die Kürzelzeile steht als kbd „Leertaste“ und „R“ auf den Haupttasten (LiveBereich.tsx)',
  );
  ok(
    kuenftig(30).includes('R9') && text.includes('dauerHinweis') && quelle('components/Countdown.tsx').includes('TIMER_TEXTE.dauerHinweis'),
    'TI Funktionsliste Nr. 30: der Dauer-Hinweis ist ein neuer Text in TIMER_TEXTE (R9)',
  );
}
for (const nr of [32, 33, 41, 42, 43, 44]) {
  ok(kuenftig(nr).includes('`views/LiveBereich.tsx`'), `TI Funktionsliste Nr. ${nr}: Haupttaste in views/LiveBereich.tsx`);
}

// ── Ausnahme R11: RemoteInfo behält seine Anzeige-Effekte im Panel ──
{
  const remote = quelle('components/RemoteInfo.tsx');
  ok(
    [77, 78].every((nr) => kuenftig(nr).startsWith('✓ Panel LAN-Fernbedienung') && kuenftig(nr).includes('R11')) &&
      remote.includes('getUrls()') &&
      remote.includes('auth.get()') &&
      remote.includes('setInterval'),
    'TI Funktionsliste Nr. 77/78: RemoteInfo liest URLs und Auth selbst, Ausnahme R11 im Panel vermerkt',
  );
}

// ── Kein window.confirm, alert oder prompt im Renderer (Nr. 104) ──
ok(
  alleQuellen('src/renderer/src').every((t) => !/\b(?:window\.)?(?:confirm|alert|prompt)\(/.test(t)),
  'TI Funktionsliste Nr. 104: weiter kein confirm, alert oder prompt im Renderer',
);

// ── Abgrenzung Speaker/Remote: ohne AppShell und ohne @jm/settings (E18) ──
{
  const speaker = quelle('views/Speaker.tsx');
  ok(
    [147, 148, 149, 150, 151, 152].every((nr) => kuenftig(nr).startsWith('✓ Speaker/Remote') && /\bE18\b/.test(kuenftig(nr))) &&
      !speaker.includes('AppShell') &&
      !speaker.includes('@jm/settings'),
    'TI Funktionsliste Nr. 147–152: Speaker und Remote unverändert, ohne AppShell und ohne @jm/settings (E18)',
  );
}
