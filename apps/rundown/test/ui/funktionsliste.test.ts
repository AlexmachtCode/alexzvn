// ─────────────────────────────────────────────────────────────────────────────
// Funktionsliste nach dem Umbau (UX Welle 1, Rundown e; Spec 10 „Kein Funktionsverlust“). Jede der 141 Zeilen in den Abschnitten
// 1–7 von docs/ux/funktionslisten/rundown.md ist in „künftig wo“ abgehakt: „✓ “ und ein Ort des Ortsregisters, „unverändert (…)“,
// „entfällt (…, E…)“ oder „ersetzt durch {Ort} (…, E…)“. E-Verweise nur auf E1–E18. Jede genannte Datei existiert, Groß- und
// Kleinschreibung wie im Repo. Dazu Querprüfungen gegen den Code (Haupttasten und Kürzel, Eingabefilter, Panel-Tasten nach O1,
// die Abläufe in den immer gemounteten Teilen statt im Panel, die ersetzten Elemente aus der Prüfung von Task 16).
// Läuft im Paketordner apps/rundown (npm run selftest -w @jm/rundown, zweiter Lauf).
// ─────────────────────────────────────────────────────────────────────────────

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { gleich, leseText, ok } from '@jm/ui/testhilfe';
import type { RundownState, ToolLink } from '@shared/types';
import { gefundeneAdressen, hauptTasten, istEingabeZiel, RUNDOWN_TEXTE, statusLeiste, type OberflaechenStand } from '@/lib/oberflaeche';
import { basisState, ohneKommentare, zeile as testZeile } from './testzustand';

const LISTE = '../../docs/ux/funktionslisten/rundown.md';

/** Panel-Abschnitte des Rundowns (Titel der @jm/settings-Abschnitte, E11, E12). */
const ABSCHNITTE = ['iveo', 'Fernsteuerung', 'Gegenstellen'];

/** Ortsregister des Plans; „Panel“ allein steht für Regeln, die im ganzen Panel gelten (Panel-Tasten nach O1). */
const ORTE: readonly string[] = [
  'Kopf',
  'Kopfmitte',
  'Werkzeugleiste',
  'Liste',
  'Editor',
  'Transport',
  'Hinweise',
  'Statusleiste',
  'Panel',
  ...ABSCHNITTE.map((a) => `Panel ${a}`),
];

/** Zeilen insgesamt und je Abschnitt 1–7, wie Task 13 die Liste angelegt hat. */
const GESAMT = 141;
const JE_ABSCHNITT = [65, 21, 36, 0, 1, 9, 9];

/** Dateien, die seit der Erhebung (210e1d9dcb) geändert wurden, jeweils nur um die lesenden Brücken (E2, Spec 3.9) bzw. umgebaut. */
const GEAENDERT = ['main/index.ts', 'main/control-server.ts', 'preload/index.ts', 'shared/types.ts'];

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

/** Pfadregel der Liste: Repo-Wurzel, apps/rundown/src (main, preload, shared, renderer), test/ im Paket oder der Renderer. */
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
  // R13: „unverändert“ mit einer Datei, die seit der Erhebung eine lesende Brücke bekam, muss das sagen (E2).
  if (form === 'unverändert' && pfade.some((p) => GEAENDERT.includes(p)) && !/\bE2\b/.test(ohneCode)) {
    return 'unverändert mit einer geänderten Datei, aber ohne Hinweis auf E2';
  }
  return null;
}

const alle = zeilen(leseText(LISTE));

gleich(alle.length, GESAMT, 'RD Funktionsliste: 141 Zeilen in den Abschnitten 1–7 (Stand Task 13)');
gleich(
  JE_ABSCHNITT.map((_, i) => alle.filter((z) => z.abschnitt === i + 1).length),
  JE_ABSCHNITT,
  'RD Funktionsliste: Zeilen je Abschnitt wie in Task 13 (65/21/36/0/1/9/9)',
);
gleich(
  alle.map((z) => z.nr),
  alle.map((_, i) => i + 1),
  'RD Funktionsliste: Nummern fortlaufend ab 1',
);

for (const z of alle) {
  const f = zeilenFehler(z);
  ok(f === null, `RD Funktionsliste Nr. ${z.nr} abgehakt${f === null ? '' : ` – ${f}`}`);
}

const zeile = (nr: number): Zeile | undefined => alle.find((z) => z.nr === nr);
const kuenftig = (nr: number): string => zeile(nr)?.zellen[6] ?? '';
const quelle = (pfad: string): string => (gibtEs(pfad) ? readFileSync(aufgeloest(pfad), 'utf8') : '');

// ── Pflichtzeilen Tastatur: Leertaste, Pfeile, Eingabefilter (Nr. 124–127) ──
{
  const app = quelle('App.tsx');
  ok(
    [124, 125, 126].every((nr) => kuenftig(nr).startsWith('✓ Transport')) &&
      app.includes("e.code === 'Space'") &&
      app.includes("e.code === 'ArrowDown'") &&
      app.includes("e.code === 'ArrowUp'") &&
      app.includes("nav({ t: 'go' })") &&
      app.includes("nav({ t: 'next' })") &&
      app.includes("nav({ t: 'prev' })") &&
      app.includes('istEingabeZiel(e.target)'),
    'RD Funktionsliste Nr. 124–126 (Pflichtzeilen Leertaste, Pfeil unten, Pfeil oben): im Handler von App.tsx, der Eingabeziele auslässt',
  );
  // Der Handler hängt vor dem ersten Zustand (vor der Ladeanzeige) am window.
  ok(
    app.indexOf("window.addEventListener('keydown'") > -1 && app.indexOf("window.addEventListener('keydown'") < app.indexOf('Lädt …'),
    'RD Funktionsliste Nr. 3/124: der Tastaturhandler hängt vor der Ladeanzeige, ist also schon vor dem ersten Zustand aktiv',
  );
  const weiche = quelle('lib/oberflaeche.ts');
  ok(
    ['INPUT', 'TEXTAREA', 'SELECT', 'isContentEditable'].every((w) => weiche.includes(w)) && /\bO1\b/.test(kuenftig(127)) && kuenftig(127).includes('contentEditable'),
    'RD Funktionsliste Nr. 127: der Handler lässt INPUT, TEXTAREA, SELECT und contentEditable aus (O1)',
  );
  // Verhalten, nicht nur Quelltext: Felder gehören dem Feld, Knöpfe und alles andere der Regie (O1).
  const ziel = (t: { tagName?: string; isContentEditable?: boolean } | null): boolean => istEingabeZiel(t as unknown as EventTarget | null);
  ok(
    ziel({ tagName: 'INPUT' }) &&
      ziel({ tagName: 'TEXTAREA' }) &&
      ziel({ tagName: 'SELECT' }) &&
      ziel({ tagName: 'DIV', isContentEditable: true }) &&
      !ziel({ tagName: 'BUTTON' }) &&
      !ziel({ tagName: 'A' }) &&
      !ziel({ tagName: 'DIV', isContentEditable: false }) &&
      !ziel(null),
    'RD Funktionsliste Nr. 127: istEingabeZiel nimmt Felder und contentEditable aus, einen Knopf nicht',
  );
  ok(
    ['go', 'zurueck', 'weiter'].every((k) => Boolean(hauptTasten({ state: basisState() })[k as 'go'].shortcut)) &&
      hauptTasten({ state: basisState() }).go.shortcut === 'Leertaste' &&
      hauptTasten({ state: basisState() }).zurueck.shortcut === '↑' &&
      hauptTasten({ state: basisState() }).weiter.shortcut === '↓' &&
      kuenftig(124).includes('Leertaste') &&
      kuenftig(125).includes('↓') &&
      kuenftig(126).includes('↑'),
    'RD Funktionsliste Nr. 124–126: die Kürzel Leertaste, ↓ und ↑ stehen auf den Haupttasten',
  );
}

// ── Haupttasten: GO nur ohne Zeile gesperrt, mit Grund; ◀ und ▶ nie (R15, Nr. 60–62) ──
{
  const leer = hauptTasten({ state: basisState() });
  const mitZeile = hauptTasten({ state: basisState({ doc: { schemaVersion: 2, name: 'T', rows: [testZeile('a')] } }) });
  ok(
    leer.go.state === 'gesperrt' &&
      leer.go.disabledReason === RUNDOWN_TEXTE.grund.keineZeile &&
      mitZeile.go.state === 'bereit' &&
      leer.zurueck.state === 'bereit' &&
      leer.weiter.state === 'bereit' &&
      mitZeile.zurueck.state === 'bereit' &&
      mitZeile.weiter.state === 'bereit',
    'RD Funktionsliste Nr. 60–62: GO ist nur ohne Zeile gesperrt (mit Grund), ◀ und ▶ sind nie gesperrt (R15)',
  );
  const transport = quelle('components/Transport.tsx');
  ok(
    [60, 61, 62, 63, 64, 65].every((nr) => kuenftig(nr).startsWith('✓ Transport (`components/Transport.tsx`')) &&
      transport.includes('@[292px]:order-first') &&
      transport.includes('@[444px]:grid-cols-3') &&
      transport.includes('grid-cols-1'),
    'RD Funktionsliste Nr. 60–65: Transport in components/Transport.tsx, GO breit oben ab 292 px, eine Reihe ab 444 px, darunter gestapelt (R16, R17)',
  );
}

// ── Pflichtpunkt Panel (Nr. 128, O1): Feld behält Tasten, Leertaste auf Knopf/Schalter geht ans Tool, Escape schließt ──
ok(
  zeile(128)?.zellen[1] === 'Pflichtpunkt Panel' &&
    kuenftig(128).startsWith('✓ Panel ') &&
    ['Leertaste', 'Escape', 'Feld', 'Schalter', 'O1', 'GO'].every((w) => kuenftig(128).includes(w)),
  'RD Funktionsliste Nr. 128 (Pflichtpunkt Panel): Leertaste und Escape, je für Feld und Knopf/Schalter, im Rundown geht die Leertaste an GO (Spec 10, O1)',
);
{
  const panel = quelle('packages/ui/src/components/SettingsPanel.tsx');
  ok(
    panel.includes('Escape') && panel.includes('defaultPrevented') && /verbrauchtTasten/.test(panel),
    'RD Funktionsliste Nr. 128/129: SettingsPanel schließt mit Escape, nur wenn nicht defaultPrevented; Felder behalten ihre Tasten',
  );
  ok(
    kuenftig(129).startsWith('✓ ersetzt durch Panel (') && /\bE11\b/.test(kuenftig(129)) && kuenftig(66).startsWith('✓ ersetzt durch Panel Gegenstellen'),
    'RD Funktionsliste Nr. 66/129: das Modal wird das Panel, Escape schließt es (E11)',
  );
}

// ── Abläufe aus Abschnitt 3: Renderer-Abläufe in den immer gemounteten Teilen, nicht im Panel; Main-Abläufe im Main ──
{
  const app = quelle('App.tsx');
  const store = quelle('store/useRundown.ts');
  const panel = ohneKommentare(quelle('views/Einstellungen.tsx'));
  const oberflaeche = quelle('views/RundownOberflaeche.tsx');
  ok(
    app.includes('void load()') && store.includes('window.jmrundown.onState') && store.includes('window.jmrundown.onLinks') && store.includes('subscribed') && !panel.includes('load('),
    'RD Funktionsliste Nr. 3/120: Laden und das einmalige Abonnement von onState und onLinks laufen in App und Store, nicht im Panel',
  );
  ok(
    ['window', 'useEffect', 'useState', 'addEventListener', 'setInterval', 'setTimeout', 'localStorage'].every((w) => !panel.includes(w)),
    'RD Funktionsliste: Einstellungen.tsx hat kein window und keine eigenen Effekte (G7, G8)',
  );
  ok(
    oberflaeche.includes('<RowEditor') &&
      !panel.includes('RowEditor') &&
      !panel.includes('RundownList') &&
      oberflaeche.includes('key={`${selectedRow.id}:${state.abweisungen}`}') &&
      kuenftig(106).includes('abweisungen') &&
      kuenftig(38).includes('nie darin'),
    'RD Funktionsliste Nr. 38/106: der Editor steht gekeyt neben dem Panel, nie darin; der Schlüssel enthält abweisungen',
  );
  ok(
    oberflaeche.includes('useBrueckenWert(MASTER_LINK_QUELLE)') &&
      oberflaeche.includes('useBrueckenWert(FERNSTEUERUNG_QUELLE)') &&
      oberflaeche.includes('useBrueckenWert(VERBUND_QUELLE)') &&
      !panel.includes('useBrueckenWert') &&
      [15, 96, 122].every((nr) => /^✓ (?:Kopfmitte|Statusleiste)/.test(kuenftig(nr))),
    'RD Funktionsliste Nr. 15/96/122: die Brücken werden in der Oberfläche gelesen, nicht im Panel; V-Zeile in der Kopfmitte, Fernsteuerung und Master-Link in der Statusleiste',
  );
  // Abläufe im Hauptprozess: die genannten Funktionen und Befehle stehen im Main.
  const main = quelle('main/index.ts');
  ok(
    ['folgeMasterShow', 'ladeMasterShow', 'aktualisiereMasterShow', 'reloadShow', 'onDeepLink', "case 'reload'", "case 'goto'", 'function doNav', 'function sichere', 'RELOAD_OHNE_SHOW'].every((w) => main.includes(w)) &&
      [91, 101, 107, 113, 114, 115, 116, 117, 118].every((nr) => kuenftig(nr).startsWith('✓ unverändert (`main/index.ts`')),
    'RD Funktionsliste Nr. 91/101/107/113–118: Navigation, RELOAD, Deep-Link, Master folgen und Sichern leben weiter im Hauptprozess',
  );
  ok(
    ['main/conductor.ts', 'main/config.ts', 'main/store.ts', 'main/gedaechtnis.ts', 'shared/conductor.ts', 'shared/hinweise.ts', 'shared/scharf.ts', 'shared/zeilen.ts'].every((d) => gibtEs(d)) &&
      [87, 88, 89, 90].every((nr) => kuenftig(nr).includes('`shared/conductor.ts`')) &&
      [104, 105, 134, 135, 136, 137, 138, 139].every((nr) => kuenftig(nr).startsWith('✓ unverändert (')),
    'RD Funktionsliste Nr. 87–90/104/105/134–139: Navigation, Conductor, Konfiguration und die Ablagen liegen in ihren unveränderten Dateien',
  );
  ok(
    ['go', 'next', 'prev', 'goto'].every((v) => quelle('main/index.ts').includes(`case '${v}'`)) && [97, 98, 99, 100].every((nr) => /\bE2\b/.test(kuenftig(nr))),
    'RD Funktionsliste Nr. 97–100: RUNDOWN GO, NEXT, PREV und GOTO bleiben im Main; die Zeilen nennen die einzige Ergänzung der Datei (E2)',
  );
}

// ── Statusleiste: Fernsteuerung (Nr. 96), Gegenstellen (Nr. 17–19), Master-Link (Nr. 122) ──
{
  const link = (t: Partial<ToolLink> = {}): ToolLink => ({
    role: 'recorder',
    label: 'JM Recorder',
    host: '10.0.0.7',
    port: 8734,
    source: 'mdns',
    connected: true,
    state: { recording: '1' },
    ...t,
  });
  const stand = (state: RundownState, teil: Partial<OberflaechenStand> = {}): OberflaechenStand => ({ state, masterLink: undefined, fernsteuerung: undefined, verbund: undefined, ...teil });
  const ids = (s: OberflaechenStand): string[] => statusLeiste(s).map((i) => i.id);
  const einEintrag = (t: Partial<ToolLink>) => statusLeiste(stand(basisState({ links: [link(t)] }))).find((i) => i.id === 'link-recorder');
  ok(
    ids(stand(basisState())).join(',') === 'master-link,iveo,fernsteuerung' &&
      ids(stand(basisState({ links: [link()] }))).join(',') === 'master-link,iveo,link-recorder,fernsteuerung',
    'RD Funktionsliste Nr. 17/96/122: die Statusleiste hat master-link, iveo, je Gegenstelle link-<rolle> und fernsteuerung',
  );
  // Nr. 17: Adresse eines Fundes im Detail, ein nicht verbundener mDNS-Fund steht mit Adresse im Panel (Nachbesserung Task 16).
  ok(
    einEintrag({})?.detail?.includes('10.0.0.7:') === true &&
      gefundeneAdressen(stand(basisState({ links: [link({ connected: false })] }))).some((g) => g.text.includes('10.0.0.7')) &&
      kuenftig(17).includes('Panel Gegenstellen') &&
      kuenftig(17).includes('gefunden: host:port'),
    'RD Funktionsliste Nr. 17: die Adresse eines Fundes steht im Eintrag (verbunden) bzw. im Panel Gegenstellen (nicht verbunden)',
  );
  // Nr. 18: manueller Endpunkt als Text im Detail.
  ok(
    einEintrag({ source: 'manual', host: 'rec.lan', port: 9000, connected: false })?.detail === 'manuell: rec.lan:9000 · nicht verbunden' && kuenftig(18).includes('manuell: host:port'),
    'RD Funktionsliste Nr. 18: der manuelle Endpunkt steht als „manuell: host:port“ im Detail statt des ⚙-Zeichens',
  );
  // Nr. 19: aktive Feedbacks als Text; ein inaktives Feedback erscheint nicht.
  const aktiv = einEintrag({ state: { recording: '1' } })?.detail ?? '';
  const inaktiv = einEintrag({ state: { recording: '0' } })?.detail ?? '';
  ok(aktiv !== inaktiv && !aktiv.startsWith('verbunden') && inaktiv.includes('10.0.0.7'), 'RD Funktionsliste Nr. 19: aktive Feedbacks stehen als Text im Detail des Eintrags, die Chips sind ersetzt (E11)');
  ok(
    einEintrag({ connected: false })?.state === 'warn' && einEintrag({})?.state === 'ok' && einEintrag({ connected: false })?.settingsSection === 'gegenstellen',
    'RD Funktionsliste Nr. 17/20: verbunden ok, sonst warn; ein Klick auf den Eintrag springt zum Abschnitt Gegenstellen',
  );
  ok(
    kuenftig(20).startsWith('✓ ersetzt durch Kopf') && quelle('packages/ui/src/components/AppHeader.tsx').includes('data-zahnrad'),
    'RD Funktionsliste Nr. 20: der Knopf „Verbindungen …“ ist ersetzt durch ⚙ im Kopf und den Klick auf einen link-Eintrag (R8)',
  );
}

// ── Entfallene und ersetzte Elemente aus der Prüfung von Task 16 (task-16-entfallen.md) ──
{
  const einstellungen = quelle('views/Einstellungen.tsx');
  ok(
    RUNDOWN_TEXTE.gegenstellen.keine === 'Noch keine Tools gefunden — Suite-Tools im selben Netz starten (mDNS) oder Verbindungen manuell setzen.' &&
      einstellungen.includes('RUNDOWN_TEXTE.gegenstellen.keine') &&
      kuenftig(16).startsWith('✓ Panel Gegenstellen'),
    'RD Funktionsliste Nr. 16: der Leertext steht wörtlich im Panel Gegenstellen (R8)',
  );
  ok(
    kuenftig(73).startsWith('✓ Panel Gegenstellen') && kuenftig(73).includes('R8') && kuenftig(73).includes('aria-label „Auto: <Tool>“'),
    'RD Funktionsliste Nr. 73: der Auto-Tooltip ist ersetzt durch den Erklärtext und das aria-label, die Information bleibt sichtbar (R8)',
  );
  ok(
    [67, 69, 70, 72].every((nr) => kuenftig(nr).startsWith('✓ Panel Gegenstellen')) &&
      kuenftig(67).includes('PEERS_TEXTE.erklaerung') &&
      kuenftig(70).includes('leer = automatisch') &&
      kuenftig(69).includes('nicht gefunden') &&
      kuenftig(72).includes('gültigen Port'),
    'RD Funktionsliste Nr. 67/69/70/72: die Umformulierungen aus den gemeinsamen Texten stehen in den Haken',
  );
  ok(
    [5, 6, 7, 8, 9, 10, 11, 12, 13].every((nr) => kuenftig(nr).startsWith('✓ Werkzeugleiste (`views/Werkzeugleiste.tsx`')) &&
      [74, 79, 80, 81, 82, 83, 84, 85].every((nr) => kuenftig(nr).startsWith('✓ Werkzeugleiste')) &&
      quelle('App.tsx').includes('window.confirm('),
    'RD Funktionsliste Nr. 5–13/74/79–85: Datei-Knöpfe, Name, Marke und Rückmeldung in der Werkzeugleiste, der Regieplan-confirm bleibt (E11)',
  );
  ok(
    [21, 22, 119].every((nr) => kuenftig(nr).startsWith('✓ Hinweise')) && quelle('components/Hinweise.tsx').includes('RUNDOWN_TEXTE.hinweise.schliessen'),
    'RD Funktionsliste Nr. 21/22/119: die Hinweise stehen im Block über der Liste, das ✕ nur an stehenden',
  );
  ok(
    [14, 133, 141].every((nr) => /\bE17\b/.test(kuenftig(nr))) && quelle('packages/ui/src/lib/theme.ts').includes("'jm-theme'") && kuenftig(133).includes('jm-theme'),
    'RD Funktionsliste Nr. 14/133/141: Hell/Dunkel im Kopf, gemerkt unter jm-theme (E17)',
  );
  ok(
    kuenftig(15).startsWith('✓ Kopfmitte') && /\bE11\b/.test(kuenftig(15)) && kuenftig(4).includes('R12'),
    'RD Funktionsliste Nr. 4/15: V-Zeile in der Kopfmitte (E11); der Rundown hatte keine Markenzeile, R12 entfällt',
  );
}

// ── Kein persistId, kein localStorage im Code der App; die Liste sagt es (Nr. 133) ──
{
  const dateien = ['App.tsx', 'views/RundownOberflaeche.tsx', 'views/Werkzeugleiste.tsx', 'views/Einstellungen.tsx', 'views/KopfMitte.tsx', 'components/RowEditor.tsx', 'components/RundownList.tsx', 'components/Transport.tsx', 'components/Hinweise.tsx', 'store/useRundown.ts'];
  ok(
    dateien.every((d) => !/\b(?:localStorage|sessionStorage|persistId|indexedDB)\b/.test(quelle(d))) && kuenftig(133).includes('kein persistId'),
    'RD Funktionsliste Nr. 133: der Renderer merkt sich selbst nichts, nur das Theme im geteilten Hook',
  );
}

// ── Kein Menü, kein globales Kürzel, kein Enter-Handler in den Feldern (Nr. 130–132) ──
{
  const main = quelle('main/index.ts');
  ok(
    !/setApplicationMenu|globalShortcut|new Tray|before-input-event/.test(main) && kuenftig(132).startsWith('✓ unverändert (`main/index.ts`'),
    'RD Funktionsliste Nr. 132 (Menü): der Hauptprozess bleibt ohne Menü, globales Kürzel, Tray und before-input-event',
  );
  ok(
    !/['"]Enter['"]|onKeyDown/.test(quelle('components/RowEditor.tsx') + quelle('views/Werkzeugleiste.tsx') + quelle('packages/settings/src/abschnitte/PeersSection.tsx')) &&
      kuenftig(130).startsWith('✓ Editor'),
    'RD Funktionsliste Nr. 130: weiter kein Enter- und kein Escape-Handler in Editor, Namensfeld und Gegenstellen',
  );
  ok(!/tabIndex/.test(quelle('components/RundownList.tsx')) && kuenftig(131).startsWith('✓ Liste'), 'RD Funktionsliste Nr. 131: die Zeilen der Liste sind weiter keine Tabulatorziele');
}

// ── Liste und Editor behalten ihre Elemente (Nr. 23–59), Stichproben gegen den Quelltext ──
{
  const liste = quelle('components/RundownList.tsx');
  ok(
    ['Noch keine Zeilen.', 'SCHARF', 'ziehen zum Umsortieren', 'scharf setzen', 'nach oben', 'nach unten', 'Zeile duplizieren', 'Zeile löschen', '+ Zeile hinzufügen', 'draggable', 'onDragStart', 'onDrop'].every((w) => liste.includes(w)),
    'RD Funktionsliste Nr. 23–37: die Liste hat Leerzustand, Marke SCHARF, Griff, die fünf Knöpfe, Drag and Drop und den Hinzufügen-Knopf',
  );
  const editor = quelle('components/RowEditor.tsx');
  ok(
    ['Zeilen-Titel', 'Dauer (mm:ss · optional, für Timer-Austausch)', 'Als eigene Zeile behalten', 'Aktionen beim GO', '+ Aktion hinzufügen', 'aktiviert', 'diese Aktion jetzt an das Tool senden', 'Aktion duplizieren', 'Aktion löschen', 'iveo-Speaker (Bauchbinde)', 'iveo Side Event (live schalten)', 'Ablaufpunkt (Timer springt dorthin)', 'an diesen Punkt binden', 'Durchsuchen…', 'Verzögerung'].every((w) => editor.includes(w)),
    'RD Funktionsliste Nr. 39–59: der Editor hat alle Felder, Knöpfe und Auswahlen der Liste',
  );
  ok(quelle('views/RundownOberflaeche.tsx').includes('Keine Zeile gewählt.') && quelle('views/RundownOberflaeche.tsx').includes('w-[26rem]'), 'RD Funktionsliste Nr. 38: Editor-Spalte 26 rem mit „Keine Zeile gewählt.“');
}

// ── Kein window.confirm außer dem Regieplan-Import (Nr. 74); keine anderen Dialoge im Renderer ──
{
  const dateien = ['App.tsx', 'views/RundownOberflaeche.tsx', 'views/Werkzeugleiste.tsx', 'views/Einstellungen.tsx', 'views/KopfMitte.tsx', 'components/RowEditor.tsx', 'components/RundownList.tsx', 'components/Transport.tsx', 'components/Hinweise.tsx', 'lib/oberflaeche.ts'];
  const treffer = dateien.flatMap((d) => (quelle(d).match(/\b(?:window\.)?(?:confirm|alert|prompt)\(/g) ?? []).map(() => d));
  gleich(treffer, ['App.tsx'], 'RD Funktionsliste Nr. 74: genau ein confirm im Renderer, der Regieplan-Import in App.tsx (E11)');
}
