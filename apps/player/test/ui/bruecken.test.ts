// UX Welle 2a, Player b · Brücken (Spec 3.9, 7.2): Fernsteuerungs-Meldung (Kreuzprodukt der Ereignisse, Port belegt),
// Quellen ohne und mit window, Quelltext-Wächter für Preload, Main und Steuerport. Kein Electron, kein window beim Import.
import { gleich, leseText, ok } from '@jm/ui/testhilfe';
import { AUSGABE_ZU, naechsterAusgabeZustand, type AusgabeEreignis, type AusgabeZustand } from '@jm/output-window/zustand';
import { AUSGABE_QUELLE, FERNSTEUERUNG_QUELLE, MASTER_LINK_QUELLE } from '@/lib/bruecken';
import {
  STEUER_PORT,
  naechsteFernsteuerung,
  portBelegt,
  type FernsteuerungEreignis,
  type FernsteuerungMeldung,
} from '@shared/fernsteuerung';
import { LebendeFenster } from '../../src/main/ausgabe-fenster';
import { kreuz, pruefeFaelle } from './hilfe';
import { basisMeldung, ohneKommentare } from './testzustand';

const BELEGT = 'listen EADDRINUSE: address already in use :::8725';
const folge = (...es: FernsteuerungEreignis[]): FernsteuerungMeldung | undefined =>
  es.reduce<FernsteuerungMeldung | undefined>((m, e) => naechsteFernsteuerung(m, e), undefined);

// ── PL Fernsteuerung Kreuzprodukt: Anfangszustand × Ereignis (Status × Start ok/Fehler × Wurf) ──
{
  const anfaenge: Record<string, FernsteuerungMeldung | undefined> = {
    keine: undefined,
    laeuft: basisMeldung({ clients: 2, modus: 'secure' }),
    Fehler: { laeuft: false, port: 9000, clients: 0, fehler: BELEGT },
  };
  const ereignisse: Record<string, FernsteuerungEreignis> = {
    'Status läuft': { art: 'status', running: true, port: 8725, clients: 1, modus: 'open' },
    'Status läuft ohne Modus': { art: 'status', running: true, port: 8725, clients: 3 },
    'Status steht': { art: 'status', running: false, port: 0, clients: 0 },
    'Start ok': { art: 'start', ok: true },
    'Start Fehler': { art: 'start', ok: false, error: BELEGT },
    'Start Fehler ohne Text': { art: 'start', ok: false },
    Wurf: { art: 'wurf', text: 'kaputt' },
    'Wurf ohne Text': { art: 'wurf', text: ' ' },
  };
  const faelle = kreuz({ anfang: Object.keys(anfaenge), ereignis: Object.keys(ereignisse) });
  pruefeFaelle('PL Fernsteuerung Kreuzprodukt', faelle, (f) => {
    const alt = anfaenge[f.anfang];
    const e = ereignisse[f.ereignis];
    const neu = naechsteFernsteuerung(alt, e);
    const fehler: string[] = [];
    const laeuft = e.art === 'status' ? e.running : e.art === 'start' ? e.ok : false;
    const text = e.art === 'wurf' ? e.text : e.art === 'start' ? e.error : undefined;
    if (neu.laeuft !== laeuft) fehler.push(`laeuft ${neu.laeuft}`);
    if (!laeuft && neu.clients !== 0) fehler.push(`clients ${neu.clients} ohne laufenden Server`);
    if (laeuft && neu.fehler !== undefined) fehler.push('Fehler trotz laufendem Server');
    if (e.art !== 'status' && !laeuft && neu.fehler !== (text?.trim() || 'unbekannt')) fehler.push(`Fehlertext ${neu.fehler}`);
    if (neu.port <= 0) fehler.push(`port ${neu.port}`);
    if (alt?.modus !== undefined && neu.modus === undefined) fehler.push('Modus verloren');
    for (const k of Object.keys(neu) as Array<keyof FernsteuerungMeldung>) if (neu[k] === undefined) fehler.push(`Feld ${k} ist undefined statt abwesend`);
    return fehler.length ? fehler.join('; ') : null;
  });
  // Reihenfolgen wie im Server: erst Status, dann Start-Ergebnis; danach melden sich Clients.
  const laeuft = folge(
    { art: 'status', running: true, port: 8725, clients: 0, modus: 'secure' },
    { art: 'start', ok: true },
    { art: 'status', running: true, port: 8725, clients: 2, modus: 'secure' },
  );
  gleich(laeuft, { laeuft: true, port: 8725, clients: 2, modus: 'secure' }, 'PL Fernsteuerung Kreuzprodukt: läuft, 2 Clients, Modus secure, kein Fehler');
  gleich(folge({ art: 'start', ok: true }), { laeuft: true, port: STEUER_PORT, clients: 0 }, 'PL Fernsteuerung Kreuzprodukt: nur Start-Ergebnis, Standardport, ohne Modus');
  gleich(
    folge({ art: 'status', running: false, port: 0, clients: 0 }, { art: 'start', ok: false, error: BELEGT }),
    { laeuft: false, port: STEUER_PORT, clients: 0, fehler: BELEGT },
    'PL Fernsteuerung Kreuzprodukt: Startfehler nach Status mit Port 0 → Standardport statt 0, Fehler wörtlich',
  );
}

// ── PL Fernsteuerung Port belegt ──
{
  const belegt = folge({ art: 'status', running: false, port: 0, clients: 0 }, { art: 'start', ok: false, error: BELEGT });
  ok(portBelegt(belegt), 'PL Fernsteuerung Port belegt: EADDRINUSE im Startfehler → portBelegt');
  ok(portBelegt(folge({ art: 'wurf', text: 'Error: listen EADDRINUSE 0.0.0.0:8725' })), 'PL Fernsteuerung Port belegt: auch ein Wurf mit EADDRINUSE zählt');
  ok(!portBelegt(folge({ art: 'wurf', text: 'x' })), 'PL Fernsteuerung Port belegt: anderer Fehler → false');
  ok(!portBelegt(undefined) && !portBelegt(basisMeldung()), 'PL Fernsteuerung Port belegt: ohne Meldung und ohne Fehler → false');
  ok(!portBelegt(naechsteFernsteuerung(belegt, { art: 'status', running: true, port: 8725, clients: 0 })), 'PL Fernsteuerung Port belegt: läuft der Server später, ist der Fehler weg');
}

// ── PL Quelle ohne window ──
{
  let ergebnis: unknown;
  try {
    const quellen = [MASTER_LINK_QUELLE, FERNSTEUERUNG_QUELLE, AUSGABE_QUELLE];
    const antworten: unknown[] = [];
    for (const q of quellen) antworten.push(await q.abfrage());
    let gemeldet = 0;
    const ab = quellen.map((q) => q.ereignis(() => void gemeldet++));
    for (const f of ab) f();
    ergebnis = [antworten, ab.map((f) => typeof f), gemeldet];
  } catch (e) {
    ergebnis = String(e);
  }
  gleich(ergebnis, [[null, null, null], ['function', 'function', 'function'], 0], 'PL Quelle ohne window: Abfrage null, Ereignis gibt eine Abmeldung und meldet nichts');
}

// ── Quellen mit Preload-Attrappe (window nur im Test gesetzt) ──
{
  const g = globalThis as unknown as { window?: unknown };
  const log: string[] = [];
  let fernCb: ((m: FernsteuerungMeldung | null) => void) | undefined;
  let ausCb: ((z: AusgabeZustand) => void) | undefined;
  g.window = {
    jmplay: {
      masterLink: async () => ({ art: 'aus' }),
      onMasterLink: () => () => void log.push('ab masterLink'),
      fernsteuerung: async () => basisMeldung({ clients: 1 }),
      onFernsteuerung: (cb: (m: FernsteuerungMeldung | null) => void) => {
        fernCb = cb;
        return () => void log.push('ab fernsteuerung');
      },
      output: {
        zustand: async () => ({ art: 'offen', displayId: 3 }),
        onZustand: (cb: (z: AusgabeZustand) => void) => {
          ausCb = cb;
          return () => void log.push('ab ausgabe');
        },
      },
    },
  };
  try {
    const gemeldet: unknown[] = [];
    const ab = FERNSTEUERUNG_QUELLE.ereignis((w) => void gemeldet.push(w));
    fernCb?.(basisMeldung({ clients: 3 }));
    ab();
    gleich(await FERNSTEUERUNG_QUELLE.abfrage(), basisMeldung({ clients: 1 }), 'PL Quelle mit Preload: FERNSTEUERUNG_QUELLE liest jmplay.fernsteuerung');
    gleich(gemeldet, [basisMeldung({ clients: 3 })], 'PL Quelle mit Preload: jmplay.onFernsteuerung meldet die Meldung weiter');
    gleich(log, ['ab fernsteuerung'], 'PL Quelle mit Preload: die Abmeldung geht an jmplay.onFernsteuerung');
    gleich(await MASTER_LINK_QUELLE.abfrage(), { art: 'aus' }, 'PL Quelle mit Preload: MASTER_LINK_QUELLE liest jmplay.masterLink');
    gleich(await AUSGABE_QUELLE.abfrage(), { art: 'offen', displayId: 3 }, 'PL Quelle mit Preload: AUSGABE_QUELLE liest jmplay.output.zustand');
    const aus: unknown[] = [];
    const abAus = AUSGABE_QUELLE.ereignis((z) => void aus.push(z));
    ausCb?.({ art: 'abgestuerzt', displayId: 3 });
    abAus();
    gleich([aus, log], [[{ art: 'abgestuerzt', displayId: 3 }], ['ab fernsteuerung', 'ab ausgabe']], 'PL Quelle mit Preload: AUSGABE_QUELLE hängt an jmplay.output.onZustand samt Abmeldung');
  } finally {
    delete g.window;
  }
  // Preload vorhanden, aber ohne die neuen Funktionen (älterer Preload): null und kein Wurf.
  g.window = { jmplay: { output: {} } };
  try {
    gleich([await AUSGABE_QUELLE.abfrage(), await FERNSTEUERUNG_QUELLE.abfrage(), typeof AUSGABE_QUELLE.ereignis(() => {})], [null, null, 'function'], 'PL Quelle ohne window: Preload ohne die neuen Funktionen → null und Abmeldung statt Wurf');
  } finally {
    delete g.window;
  }
}

// ── Quelltext-Wächter ──
{
  const preload = leseText('src/preload/index.ts');
  const main = leseText('src/main/index.ts');
  const ipc = leseText('src/main/ipc.ts');
  const cs = leseText('src/main/control-server.ts');
  const typen = leseText('src/shared/types.ts');
  const vorkommen = (t: string, kanal: string): number => t.split("'" + kanal + "'").length - 1;

  // PL Wächter Kanäle
  const kanaele = [...preload.matchAll(/'(jmps:master[^']*)'/g)].map((m) => m[1]);
  ok(kanaele.length === 3 && kanaele.every((k) => k === 'jmps:master-link'), 'PL Wächter Kanäle: Preload nennt den Kanal dreimal wörtlich jmps:master-link (invoke, on, off)');
  ok(
    preload.includes("  masterLink: () => (ipcRenderer.invoke('jmps:master-link') as Promise<MasterLinkMeldung>).catch(() => null),\n") &&
      preload.includes("    ipcRenderer.on('jmps:master-link', listener);\n    return () => ipcRenderer.off('jmps:master-link', listener);\n"),
    'PL Wächter Kanäle: Abfrage fängt jede Ablehnung zu null ab, Ereignis mit Abmeldung',
  );
  ok(
    /^import type \{ MasterLinkMeldung \} from '@jm\/app-runtime';$/m.test(preload) && !/^import \{[^}]*\} from '@jm\/app-runtime'/m.test(preload),
    'PL Wächter Kanäle: aus app-runtime nur der Typ (kein Main-Code im Sandbox-Preload)',
  );
  ok(
    /^import type \{ AusgabeZustand \} from '@jm\/output-window\/zustand';$/m.test(preload) && !/from '@jm\/output-window'/.test(preload),
    'PL Wächter Kanäle: aus output-window nur der reine Typ aus /zustand (kein electron im Preload-Import)',
  );
  ok(
    typen.includes('export type MasterLinkMeldungZeile =') &&
      typen.includes('masterLink: () => Promise<MasterLinkMeldungZeile | null>;') &&
      typen.includes('onMasterLink: (cb: (m: MasterLinkMeldungZeile) => void) => () => void;'),
    'PL Wächter Kanäle: window.jmplay hat masterLink und onMasterLink mit MasterLinkMeldungZeile',
  );
  ok(
    vorkommen(preload, 'player:fernsteuerung') === 3 && vorkommen(main, 'player:fernsteuerung') === 2,
    'PL Wächter Kanäle: player:fernsteuerung steht in Preload (invoke, on, off) und Main (handle, send) gleich',
  );
  ok(
    typen.includes('fernsteuerung: () => Promise<FernsteuerungMeldung | null>;') &&
      typen.includes('onFernsteuerung: (cb: (m: FernsteuerungMeldung | null) => void) => () => void;'),
    'PL Wächter Kanäle: window.jmplay hat fernsteuerung und onFernsteuerung',
  );
  ok(
    preload.includes("fernsteuerung: () => (ipcRenderer.invoke('player:fernsteuerung') as Promise<FernsteuerungMeldung | null>).catch(() => null),"),
    'PL Wächter Kanäle: Abfrage der Meldung fängt jede Ablehnung zu null ab',
  );
  ok(
    vorkommen(preload, 'output:zustand') === 3 && vorkommen(main, 'output:zustand') + vorkommen(ipc, 'output:zustand') === 2,
    'PL Wächter Kanäle: output:zustand steht in Preload (invoke, on, off) und Main (handle, send) gleich',
  );
  ok(
    preload.includes("zustand: () => (ipcRenderer.invoke('output:zustand') as Promise<AusgabeZustand | null>).catch(() => null),") &&
      typen.includes('zustand: () => Promise<AusgabeZustand | null>;') &&
      typen.includes('onZustand: (cb: (z: AusgabeZustand) => void) => () => void;'),
    'PL Wächter Kanäle: output.zustand fängt jede Ablehnung zu null ab, output.onZustand ist typisiert',
  );
  ok(
    ipc.includes("ipcMain.handle('output:zustand', () => ausgabeZustand());") &&
      main.includes('onAusgabeZustand((z) => {') &&
      main.includes("mainWindow.webContents.send('output:zustand', z);"),
    'PL Wächter Kanäle: Main antwortet mit dem gemessenen Zustand und schickt jede Änderung an das Hauptfenster (nicht an alle)',
  );
  ok(
    preload.includes("isFullscreen: () => (ipcRenderer.invoke('output:isFullscreen') as Promise<boolean | null>).catch(() => null),") &&
      ipc.includes("ipcMain.handle('output:isFullscreen', () => isOutputFullscreen());") &&
      typen.includes('isFullscreen: () => Promise<boolean | null>;'),
    'PL Wächter Kanäle: output.isFullscreen liest den gemessenen Vollbildzustand (null ohne Fenster)',
  );
  const von = main.indexOf('initAppRuntime({');
  const runtime = main.slice(von, main.indexOf('});', von));
  ok(von >= 0 && !/masterLink\s*:\s*false/.test(runtime), 'PL Wächter Kanäle: initAppRuntime registriert jmps:master-link (Option masterLink:false fehlt)');

  // PL Wächter STEUER_PORT 8725
  const m = /export const CONTROL_PORT = (\d+);/.exec(cs);
  ok(m !== null && Number(m[1]) === STEUER_PORT && STEUER_PORT === 8725, 'PL Wächter STEUER_PORT 8725: STEUER_PORT ' + STEUER_PORT + ' gleich CONTROL_PORT des Steuerservers (' + m?.[1] + ')');
  ok(cs.includes("onMeldung?.({ art: 'status', ...st, modus: server?.modus() });"), 'PL Wächter STEUER_PORT 8725: jeder Statuswechsel des Servers wird mit wirksamem Modus gemeldet');
  ok(
    main.includes("meldeFernsteuerung({ art: 'start', ok: r.ok, error: r.error })") &&
      main.includes("meldeFernsteuerung({ art: 'wurf', text: ") &&
      main.includes('meldeFernsteuerung)'),
    'PL Wächter STEUER_PORT 8725: Statuswechsel, Start-Ergebnis und Wurf werden gemeldet',
  );
  ok(cs.includes('return server.start(CONTROL_PORT);'), 'PL Wächter STEUER_PORT 8725: der Steuerserver startet unverändert auf CONTROL_PORT');
}

// ── PL Ausgabe-Zustand: das eigene Fenster des Players (E14) meldet über die reine Zustandsmaschine ──
{
  const q = ohneKommentare(leseText('src/main/output-window.ts'));
  ok(
    /import \{[^}]*\bAUSGABE_ZU\b[^}]*\bnaechsterAusgabeZustand\b[^}]*\} from '@jm\/output-window\/zustand';/.test(q) ||
      /import \{[^}]*\bnaechsterAusgabeZustand\b[^}]*\bAUSGABE_ZU\b[^}]*\} from '@jm\/output-window\/zustand';/.test(q),
    'PL Ausgabe-Zustand: output-window.ts nutzt AUSGABE_ZU und naechsterAusgabeZustand aus @jm/output-window/zustand',
  );
  ok(!/from '@jm\/output-window'/.test(q) && !/\bnew OutputWindow\b/.test(q), 'PL Ausgabe-Zustand: das eigene Fenster bleibt, die Klasse OutputWindow wird nicht benutzt (E14)');
  ok(/let zustand: AusgabeZustand = AUSGABE_ZU;/.test(q), 'PL Ausgabe-Zustand: Start bei AUSGABE_ZU');
  ok(
    q.includes("melde({ t: 'geoeffnet', displayId: target.id, neu: false });") && q.includes("melde({ t: 'geoeffnet', displayId: target.id, neu: true });"),
    'PL Ausgabe-Zustand: Öffnen meldet geoeffnet (neues Fenster neu:true, Umzug neu:false)',
  );
  ok(/win\.on\('closed', \(\) => \{[\s\S]*?melde\(\{ t: 'geschlossen' \}\);/.test(q), 'PL Ausgabe-Zustand: Schließen meldet geschlossen');
  ok(q.includes("win.webContents.on('render-process-gone', () => {") && q.includes("melde({ t: 'abgestuerzt' })"), 'PL Ausgabe-Zustand: render-process-gone meldet abgestuerzt');
  ok(
    q.includes("screen.on('display-removed', (_e, d) => melde({ t: 'bildschirm-weg', displayId: d.id }));"),
    'PL Ausgabe-Zustand: display-removed meldet bildschirm-weg mit der Id des entfernten Bildschirms',
  );
  ok(
    q.includes('export function isOutputFullscreen(): boolean | null') && /return isOutputOpen\(\) \? outputWindow!\.isFullScreen\(\) : null;/.test(q),
    'PL Ausgabe-Zustand: isOutputFullscreen liest win.isFullScreen() und liefert ohne Fenster null',
  );
  // Reine Folge, wie sie das Fenster durchläuft.
  let z: AusgabeZustand = AUSGABE_ZU;
  const schritte: Array<[AusgabeEreignis, AusgabeZustand]> = [
    [{ t: 'geoeffnet', displayId: 2, neu: true }, { art: 'offen', displayId: 2 }],
    [{ t: 'geoeffnet', displayId: 3, neu: false }, { art: 'offen', displayId: 3 }],
    [{ t: 'bildschirm-weg', displayId: 9 }, { art: 'offen', displayId: 3 }],
    [{ t: 'bildschirm-weg', displayId: 3 }, { art: 'bildschirm-fehlt', displayId: 3 }],
    [{ t: 'abgestuerzt' }, { art: 'abgestuerzt', displayId: 3 }],
    [{ t: 'geoeffnet', displayId: 3, neu: false }, { art: 'abgestuerzt', displayId: 3 }],
    [{ t: 'geschlossen' }, AUSGABE_ZU],
  ];
  const folgeOk = schritte.every(([e, soll]) => {
    z = naechsterAusgabeZustand(z, e);
    return z.art === soll.art && z.displayId === soll.displayId;
  });
  ok(folgeOk, 'PL Ausgabe-Zustand: öffnen, umziehen, anderer Bildschirm weg, Bildschirm weg, abgestürzt, geschlossen ergibt die erwarteten Zustände');
}

// ── PL Ausgabe-Zustand: lebende Fenster (Fix-Runde 1): der Zustand folgt den lebenden Fenstern, nicht der Fensterreferenz ──
{
  type Ev = { t: 'auf'; w: string } | { t: 'zu'; w: string } | { t: 'absturz'; w: string };
  /** Spielt Ereignisse wie output-window.ts durch (Helfer + Zustandsmaschine); liefert die Folge der Zustandsarten. */
  const spiele = (...es: Ev[]): string[] => {
    const l = new LebendeFenster<string>();
    let z: AusgabeZustand = AUSGABE_ZU;
    const arten: string[] = [];
    for (const e of es) {
      if (e.t === 'auf') {
        l.hinzu(e.w);
        z = naechsterAusgabeZustand(z, { t: 'geoeffnet', displayId: 1, neu: true });
      } else if (e.t === 'zu') {
        if (l.schliesse(e.w)) z = naechsterAusgabeZustand(z, { t: 'geschlossen' });
      } else if (l.istNeuestes(e.w)) z = naechsterAusgabeZustand(z, { t: 'abgestuerzt' });
      arten.push(z.art);
    }
    return arten;
  };
  gleich(spiele({ t: 'auf', w: 'W1' }, { t: 'zu', w: 'W1' }), ['offen', 'zu'], 'PL Ausgabe-Zustand lebende Fenster: öffnen, schließen ergibt offen, zu');
  gleich(
    spiele({ t: 'auf', w: 'W1' }, { t: 'auf', w: 'W2' }, { t: 'auf', w: 'W3' }, { t: 'zu', w: 'W1' }, { t: 'zu', w: 'W2' }),
    ['offen', 'offen', 'offen', 'offen', 'offen'],
    'PL Ausgabe-Zustand lebende Fenster: Folge A (W1, W2 zu, W3 offen): spätes closed von W1 und W2 meldet nicht zu, solange W3 lebt',
  );
  gleich(
    spiele({ t: 'auf', w: 'W1' }, { t: 'auf', w: 'W2' }, { t: 'auf', w: 'W3' }, { t: 'zu', w: 'W3' }, { t: 'zu', w: 'W2' }, { t: 'zu', w: 'W1' }),
    ['offen', 'offen', 'offen', 'offen', 'offen', 'zu'],
    'PL Ausgabe-Zustand lebende Fenster: Folge B (mehrere Fenster, W3 zuerst zu): offen bis das letzte schließt',
  );
  gleich(
    spiele({ t: 'auf', w: 'W1' }, { t: 'auf', w: 'W2' }, { t: 'absturz', w: 'W1' }),
    ['offen', 'offen', 'offen'],
    'PL Ausgabe-Zustand lebende Fenster: Absturz eines abgelösten Fensters meldet nichts',
  );
  gleich(
    spiele({ t: 'auf', w: 'W1' }, { t: 'auf', w: 'W2' }, { t: 'absturz', w: 'W2' }),
    ['offen', 'offen', 'abgestuerzt'],
    'PL Ausgabe-Zustand lebende Fenster: Absturz des neuesten Fensters meldet abgestuerzt',
  );
  gleich(
    spiele({ t: 'auf', w: 'W1' }, { t: 'zu', w: 'W1' }, { t: 'zu', w: 'W1' }, { t: 'absturz', w: 'W1' }),
    ['offen', 'zu', 'zu', 'zu'],
    'PL Ausgabe-Zustand lebende Fenster: Schließen bei geschlossenem Fenster und Absturz eines toten Fensters ändern nichts',
  );
  const q2 = ohneKommentare(leseText('src/main/output-window.ts'));
  ok(
    q2.includes("from './ausgabe-fenster'") && q2.includes('lebende.hinzu(win);') && q2.includes("if (lebende.schliesse(win)) melde({ t: 'geschlossen' });") &&
      q2.includes("if (lebende.istNeuestes(win)) melde({ t: 'abgestuerzt' });"),
    'PL Ausgabe-Zustand lebende Fenster: output-window.ts meldet geschlossen und abgestuerzt nur über den Helfer',
  );
}

// ── Gesamtprüfung M1: ein Wurf beim Start des Steuerservers kommt zusätzlich ins Protokoll (wie beim Timer), nicht nur als
// Meldung in die Statusleiste; sonst ändert sich nichts am Start ──
{
  const main = leseText('src/main/index.ts');
  ok(
    /startControlServer\([^;]*?\.catch\(\(err\) => \{\s*getLog\(\)\.warn\(`Player-Steuerserver fehlgeschlagen: \$\{err instanceof Error \? err\.message : String\(err\)\}`\);\s*meldeFernsteuerung\(\{ art: 'wurf', text: err instanceof Error \? err\.message : String\(err\) \}\);\s*\}\);/.test(main),
    'PL Wächter Steuerserver-Start: der Wurf beim Start geht mit getLog().warn ins Protokoll und weiter als Meldung an die Statusleiste',
  );
}
