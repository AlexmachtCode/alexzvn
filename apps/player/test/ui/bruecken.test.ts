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
import { AUSGABE_BEREIT_MS, LebendeFenster } from '../../src/main/ausgabe-fenster';
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
  // PL Bildschirmliste folgt dem Ereignis (UX Welle 2b, Task 6, 2a-Nachzug): output:bildschirme ist nur ein Ereignis ohne Nutzlast.
  // Der Main sendet es über beobachteBildschirme aus @jm/output-window (nach app.ready) nur an das Hauptfenster; der Preload reicht
  // es ohne Wert weiter (on, off). Das eigene Ausgabefenster des Players bleibt (E14): aus dem Paket kommt nur diese Funktion.
  ok(
    vorkommen(preload, 'output:bildschirme') === 2 && vorkommen(main, 'output:bildschirme') === 1 && vorkommen(ipc, 'output:bildschirme') === 0,
    'PL Wächter Kanäle: output:bildschirme steht in Preload (on, off) und Main (send) gleich',
  );
  ok(
    preload.includes("    onBildschirme: (cb) => {\n      const listener = (): void => cb();\n      ipcRenderer.on('output:bildschirme', listener);\n      return () => ipcRenderer.off('output:bildschirme', listener);\n    },\n") &&
      typen.includes('onBildschirme: (cb: () => void) => () => void;'),
    'PL Wächter Kanäle: output.onBildschirme meldet ohne Nutzlast, mit Abmeldung, und ist typisiert',
  );
  {
    const bereit = main.indexOf('app.whenReady().then(() => {');
    const aufruf = main.indexOf('beobachteBildschirme(');
    const block = main.slice(aufruf, main.indexOf('});', aufruf) + 3);
    ok(
      /^import \{ beobachteBildschirme \} from '@jm\/output-window';$/m.test(main) &&
        bereit >= 0 &&
        aufruf > bereit &&
        main.split('beobachteBildschirme(').length === 2 &&
        /^beobachteBildschirme\(\(\) => \{\s*if \(mainWindow && !mainWindow\.isDestroyed\(\)\) mainWindow\.webContents\.send\('output:bildschirme'\);\s*\}\);$/.test(block),
      'PL Wächter Kanäle: Main ruft beobachteBildschirme einmal nach app.ready und schickt output:bildschirme ohne Nutzlast nur an das Hauptfenster',
    );
    ok(!/\bOutputWindow\b/.test(ohneKommentare(main)), 'PL Wächter Kanäle: aus @jm/output-window kommt in den Main nur beobachteBildschirme, die Klasse OutputWindow nicht (E14)');
  }
  const von = main.indexOf('initAppRuntime({');
  const runtime = main.slice(von, main.indexOf('});', von));
  ok(von >= 0 && !/masterLink\s*:\s*false/.test(runtime), 'PL Wächter Kanäle: initAppRuntime registriert jmps:master-link (Option masterLink:false fehlt)');

  // PL Wächter STEUER_PORT 8725
  const m = /export const CONTROL_PORT = (\d+);/.exec(cs);
  ok(m !== null && Number(m[1]) === STEUER_PORT && STEUER_PORT === 8725, 'PL Wächter STEUER_PORT 8725: STEUER_PORT ' + STEUER_PORT + ' gleich CONTROL_PORT des Steuerservers (' + m?.[1] + ')');
  // Rückspiel (Task 26, Regel aus Task 21): der Modus kommt aus der meldenden Instanz, nicht aus der Modulvariable `server`.
  ok(
    cs.includes("onMeldung?.({ art: 'status', ...st, modus: srv.modus() });") && /const srv = new SuiteControlServer\(/.test(cs) && cs.includes('server = srv;') && !cs.includes('server?.modus()'),
    'PL Rückspiel Wächter STEUER_PORT 8725: jeder Statuswechsel des Servers wird mit dem Modus der meldenden Instanz gemeldet (srv.modus(), nicht die Modulvariable)',
  );
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
    q.includes('export function isOutputFullscreen(): boolean | null') && /return aktuell\(\)\?\.isFullScreen\(\) \?\? null;/.test(q),
    'PL Ausgabe-Zustand: isOutputFullscreen liest win.isFullScreen() des aktuellen Fensters und liefert ohne Fenster null',
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

// ── PL-T13 und PL-N (Altfehler Stufe 1): höchstens ein Ausgabefenster; ein Befehl geht erst hinaus, wenn das Fenster „bereit“
// gemeldet hat (es hört dann auf output:cmd), höchstens AUSGABE_BEREIT_MS lang (A5). Die Klasse ist rein; output-window.ts nutzt
// sie für jedes Fenster, darum prüfen die Wächter dort nur die Verdrahtung ──
{
  /** Ein Fall, der auch dann einzeln rot meldet, wenn eine Methode fehlt oder wirft. */
  const fall = async (name: string, f: () => boolean | Promise<boolean>): Promise<void> => {
    let ergebnis: boolean | string;
    try {
      ergebnis = await f();
    } catch (e) {
      ergebnis = e instanceof Error ? e.message : String(e);
    }
    ok(ergebnis === true, typeof ergebnis === 'string' ? `${name} (${ergebnis})` : name);
  };
  /** Wettlauf gegen ein Versprechen von `ms`: true, wenn `p` dann noch offen ist. */
  const offenNach = async (p: Promise<unknown>, ms: number): Promise<boolean> => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const offen = await Promise.race([p.then(() => false), new Promise<boolean>((res) => (t = setTimeout(() => res(true), ms)))]);
    clearTimeout(t);
    return offen;
  };

  await fall('PL-T13 aktuelles bleibt das neue Fenster, wenn das alte spät schließt', () => {
    const l = new LebendeFenster<string>();
    l.hinzu('a');
    l.schliesst('a');
    l.hinzu('b');
    return l.schliesse('a') === false && l.aktuelles() === 'b';
  });
  await fall('PL-T13 Schließ-Wunsch ohne neues Fenster', () => {
    const l = new LebendeFenster<string>();
    l.hinzu('a');
    l.schliesst('a');
    return l.aktuelles() === null;
  });
  await fall('PL-T13 aktuelles: ohne Fenster null, sonst das neueste lebende', () => {
    const l = new LebendeFenster<string>();
    const leer = l.aktuelles();
    l.hinzu('a');
    l.hinzu('b');
    const zwei = l.aktuelles();
    l.schliesse('b');
    return leer === null && zwei === 'b' && l.aktuelles() === 'a';
  });
  gleich(AUSGABE_BEREIT_MS, 5000, 'PL-N AUSGABE_BEREIT_MS: höchstens 5000 ms Warten auf „bereit“ (A5)');
  await fall('PL-N bereit wartet auf die Meldung', async () => {
    const l = new LebendeFenster<string>();
    l.hinzu('a');
    const p = l.bereit('a', 1000);
    const offen = await offenNach(p, 20);
    l.meldeBereit('a');
    return offen && (await p) === true;
  });
  await fall('PL-N bereit nach der Meldung sofort true', async () => {
    const l = new LebendeFenster<string>();
    l.hinzu('a');
    l.meldeBereit('a');
    const p = l.bereit('a', 1000);
    return !(await offenNach(p, 20)) && (await p) === true;
  });
  await fall('PL-N bereit läuft nach ms ab', async () => {
    const l = new LebendeFenster<string>();
    l.hinzu('a');
    const t0 = Date.now();
    const r = await l.bereit('a', 30);
    return r === false && Date.now() - t0 >= 25;
  });
  await fall('PL-N bereit endet mit dem Fenster', async () => {
    const l = new LebendeFenster<string>();
    l.hinzu('a');
    const p = l.bereit('a', 1000);
    const offen = await offenNach(p, 10);
    l.schliesse('a');
    return offen && !(await offenNach(p, 50)) && (await p) === false;
  });
  await fall('PL-N meldeBereit eines unbekannten Fensters ist ohne Wirkung', async () => {
    const l = new LebendeFenster<string>();
    l.meldeBereit('a');
    l.hinzu('a');
    return (await l.bereit('a', 30)) === false;
  });
  await fall('PL-N bereit gilt je Fenster: ein neues Fenster meldet selbst', async () => {
    const l = new LebendeFenster<string>();
    l.hinzu('a');
    l.meldeBereit('a');
    l.schliesst('a');
    l.hinzu('b');
    return (await l.bereit('a', 30)) === true && (await l.bereit('b', 30)) === false;
  });
  await fall('PL-N mehrere Wartende werden in ihrer Reihenfolge frei', async () => {
    const l = new LebendeFenster<string>();
    l.hinzu('a');
    const folge: number[] = [];
    const ps = [1, 2, 3].map((n) => l.bereit('a', 1000).then((b) => void folge.push(b ? n : -n)));
    const offen = await offenNach(Promise.all(ps), 20);
    l.meldeBereit('a');
    await Promise.all(ps);
    return offen && folge.join(',') === '1,2,3';
  });
  // R5: Die Frist gilt je Fenster, nicht je Befehl. Nach dem ersten Ablauf gilt das Fenster als bereit; alle, die gerade warten,
  // werden in ihrer Reihenfolge frei, spätere warten nicht mehr, und der Ablauf wird einmal je Fenster gemeldet.
  await fall('PL-N nach Ablauf wartet ein zweiter Befehl nicht', async () => {
    const l = new LebendeFenster<string>();
    l.hinzu('a');
    const erster = await l.bereit('a', 30);
    const p = l.bereit('a', 1000);
    return erster === false && !(await offenNach(p, 20)) && (await p) === true;
  });
  await fall('PL-N der erste Ablauf gibt alle Wartenden des Fensters frei, in ihrer Reihenfolge', async () => {
    const l = new LebendeFenster<string>();
    l.hinzu('a');
    const folge: string[] = [];
    const lang = l.bereit('a', 1000).then((b) => void folge.push(`lang:${b}`));
    const kurz = l.bereit('a', 30).then((b) => void folge.push(`kurz:${b}`));
    return !(await offenNach(Promise.all([lang, kurz]), 200)) && folge.join(',') === 'lang:false,kurz:false';
  });
  await fall('PL-N der Ablauf wird einmal je Fenster gemeldet', async () => {
    const abgelaufen: string[] = [];
    const l = new LebendeFenster<string>((w) => void abgelaufen.push(w));
    l.hinzu('a');
    l.hinzu('b');
    l.hinzu('c');
    await Promise.all([l.bereit('a', 30), l.bereit('a', 30), l.bereit('b', 30)]);
    await l.bereit('a', 30);
    const p = l.bereit('c', 50);
    l.meldeBereit('c');
    await p;
    await new Promise((r) => setTimeout(r, 80));
    return abgelaufen.join(',') === 'a,b';
  });

  // Wächter an der Verdrahtung (Electron-Main und Preload laufen unter tsx nicht, Ruling R3).
  const q = ohneKommentare(leseText('src/main/output-window.ts'));
  const ipc = ohneKommentare(leseText('src/main/ipc.ts'));
  const preload = leseText('src/preload/index.ts');
  const main = leseText('src/main/index.ts');
  const typen = leseText('src/shared/types.ts');
  const ov = ohneKommentare(leseText('src/renderer/src/views/OutputView.tsx'));
  const vorkommen = (t: string, kanal: string): number => t.split("'" + kanal + "'").length - 1;
  /** Rumpf einer Funktion auf oberster Ebene: vom Kopf bis zur schließenden Klammer in Spalte 0. */
  const rumpf = (kopf: string): string => {
    const i = q.indexOf(kopf);
    return i < 0 ? '' : q.slice(i, q.indexOf('\n}\n', i) + 2);
  };
  ok(!/\boutputWindow\b/.test(q), 'PL-T13 Wächter: output-window.ts hat keine eigene Fensterreferenz outputWindow mehr');
  ok(
    /function aktuell\(\): BrowserWindow \| null \{\s*const w = lebende\.aktuelles\(\);\s*return w && !w\.isDestroyed\(\) \? w : null;\s*\}/.test(q) &&
      ['export async function openOutputWindow(', 'export function closeOutputWindow(', 'export function isOutputOpen(', 'export function isOutputFullscreen(', 'export function toggleOutputFullscreen(', 'export async function sendToOutput('].every((k) =>
        rumpf(k).includes('aktuell()'),
      ),
    'PL-T13 Wächter: öffnen, schließen, offen, Vollbild und senden lesen das aktuelle Fenster aus lebende.aktuelles() (nicht zerstört)',
  );
  {
    const auf = rumpf('export async function openOutputWindow(');
    ok(
      /^export async function openOutputWindow\(displayId\?: number\): Promise<void> \{/.test(auf) &&
        /const vorhanden = aktuell\(\);\s*if \(vorhanden\) \{/.test(auf) &&
        auf.indexOf('if (vorhanden) {') < auf.indexOf('new BrowserWindow(') &&
        auf.includes('await lebende.bereit(vorhanden, AUSGABE_BEREIT_MS);') &&
        auf.indexOf('lebende.hinzu(win);') < auf.indexOf('await lebende.bereit(win, AUSGABE_BEREIT_MS);'),
      'PL-N Wächter: openOutputWindow gibt ein Promise zurück, das auf lebende.bereit wartet (neues und vorhandenes Fenster); ein neues Fenster nur ohne aktuelles (PL-T13)',
    );
  }
  ok(/lebende\.schliesst\(win\);\s*win\.close\(\);/.test(rumpf('export function closeOutputWindow(')), 'PL-T13 Wächter: closeOutputWindow vermerkt den Schließ-Wunsch (lebende.schliesst) vor win.close()');
  ok(
    /win\.on\('closed', \(\) => \{\s*if \(lebende\.schliesse\(win\)\) melde\(\{ t: 'geschlossen' \}\);\s*\}\);/.test(q),
    'PL-T13 Wächter: das closed eines Fensters setzt keine Referenz zurück, es meldet nur dem Helfer',
  );
  {
    const senden = rumpf('export async function sendToOutput(');
    const warten = senden.indexOf('await lebende.bereit(win, AUSGABE_BEREIT_MS)');
    const schicken = senden.indexOf("win.webContents.send('output:cmd', cmd);");
    ok(
      /^export async function sendToOutput\(cmd: OutputCommand\): Promise<void> \{/.test(senden) &&
        warten >= 0 &&
        schicken > warten &&
        senden.split('webContents.send(').length === 2 &&
        /if \(lebende\.aktuelles\(\) !== win \|\| win\.isDestroyed\(\)\) return;/.test(senden.slice(warten, schicken)) &&
        !senden.includes('getLog('),
      'PL-N Wächter: sendToOutput ist async, wartet auf lebende.bereit vor output:cmd und sendet nur an ein noch aktuelles Fenster; die Log-Zeile schreibt es nicht selbst (R5)',
    );
  }
  ok(
    /const lebende = new LebendeFenster<BrowserWindow>\(\(\) => \{\s*getLog\(\)\.warn\(`Ausgabefenster meldete nicht bereit \(\$\{AUSGABE_BEREIT_MS\} ms\)`\);\s*\}\);/.test(q) &&
      q.split('getLog()').length === 2 &&
      q.split('new LebendeFenster').length === 2,
    'PL-N Wächter: die Log-Zeile „Ausgabefenster meldete nicht bereit (5000 ms)“ kommt nur aus dem Ablauf-Hörer des Helfers, also einmal je Fenster (R5)',
  );
  ok(
    /^import \{[^}]*\bgetLog\b[^}]*\} from '@jm\/app-runtime';$/m.test(q) && /^import \{[^}]*\bAUSGABE_BEREIT_MS\b[^}]*\bLebendeFenster\b[^}]*\} from '\.\/ausgabe-fenster';$/m.test(q),
    'PL-N Wächter: output-window.ts holt getLog aus @jm/app-runtime und AUSGABE_BEREIT_MS aus dem reinen Helfer',
  );
  ok(
    /export function meldeAusgabeBereit\(win: BrowserWindow\): void \{\s*lebende\.meldeBereit\(win\);\s*\}/.test(q) &&
      /ipcMain\.on\('output:bereit', \(e\) => \{\s*const win = BrowserWindow\.fromWebContents\(e\.sender\);\s*if \(win\) meldeAusgabeBereit\(win\);\s*\}\);/.test(ipc),
    'PL-N Wächter: Main ordnet output:bereit über BrowserWindow.fromWebContents(e.sender) dem Fenster zu und meldet es dem Helfer',
  );
  ok(
    ipc.includes("ipcMain.handle('output:open', (_e, displayId?: number) => openOutputWindow(displayId));") &&
      ipc.includes("ipcMain.handle('output:command', (_e, cmd: OutputCommand) => sendToOutput(cmd));"),
    'PL-N Wächter: output:open und output:command geben das Promise zurück (open löst nach „bereit“ auf, command nach dem Senden)',
  );
  ok(
    preload.includes("    meldeBereit: () => ipcRenderer.send('output:bereit'),\n") &&
      vorkommen(preload, 'output:bereit') === 1 &&
      vorkommen(ipc, 'output:bereit') === 1 &&
      vorkommen(main, 'output:bereit') === 0 &&
      typen.includes('meldeBereit: () => void;'),
    'PL Wächter Kanäle: output:bereit steht einmal im Preload (send) und einmal im Main (on), window.jmplay.output.meldeBereit ist typisiert',
  );
  ok(
    preload.includes("protokolliere: (text) => ipcRenderer.invoke('player:protokoll', text) as Promise<void>,") &&
      vorkommen(preload, 'player:protokoll') === 1 &&
      vorkommen(ipc, 'player:protokoll') === 1 &&
      vorkommen(main, 'player:protokoll') === 0 &&
      typen.includes('protokolliere: (text: string) => Promise<void>;'),
    'PL Wächter Kanäle: player:protokoll steht einmal im Preload (invoke) und einmal im Main (handle), window.jmplay.protokolliere ist typisiert (Altfehler PL-16a)',
  );
  ok(
    ipc.includes("ipcMain.handle('player:protokoll', (_e, text: unknown) => {") &&
      ipc.includes("if (typeof text === 'string') getLog().warn(text.slice(0, 500));"),
    'PL Wächter Kanäle: player:protokoll schreibt nur Text, auf 500 Zeichen gekürzt, als Warnung ins Log (Altfehler PL-16a)',
  );
  {
    const effekt = ov.indexOf('useEffect(');
    const hoeren = ov.indexOf('window.jmplay.output.onCommand(');
    const bereit = ov.indexOf('window.jmplay.output.meldeBereit();');
    const aufraeumen = ov.indexOf('return () => {', hoeren);
    ok(
      ov.split('useEffect(').length === 2 &&
        ov.split('meldeBereit(').length === 2 &&
        effekt >= 0 &&
        effekt < hoeren &&
        hoeren < bereit &&
        bereit > ov.indexOf("case 'black':") &&
        bereit < aufraeumen,
      'PL-N Wächter: OutputView meldet einmal „bereit“, nachdem onCommand im selben Effekt abonniert ist',
    );
  }
}

// ── Gesamtprüfung M1: Startfehler des Steuerservers kommen zusätzlich ins Protokoll, wie beim Timer
// (apps/timer/src/main/index.ts): ein Start mit ok:false (z. B. Port belegt) und ein Wurf. Die Meldungen an die Statusleiste
// bleiben, sonst ändert sich nichts am Start ──
{
  const main = leseText('src/main/index.ts');
  const start = main.slice(main.indexOf('startControlServer('), main.indexOf('startControlServer(') + 1200);
  ok(
    /^startControlServer\([\s\S]*?\)\s*\.then\(\(r\) => \{\s*meldeFernsteuerung\(\{ art: 'start', ok: r\.ok, error: r\.error \}\);\s*if \(!r\.ok\) getLog\(\)\.warn\(`Player-Steuerserver nicht gestartet: \$\{r\.error \?\? 'unbekannt'\}`\);\s*\}\)/.test(start),
    'PL Wächter Steuerserver-Start: ein Start mit ok:false (z. B. Port belegt) geht mit getLog().warn ins Protokoll, die Meldung an die Statusleiste bleibt',
  );
  ok(
    /\.catch\(\(err\) => \{\s*getLog\(\)\.warn\(`Player-Steuerserver fehlgeschlagen: \$\{err instanceof Error \? err\.message : String\(err\)\}`\);\s*meldeFernsteuerung\(\{ art: 'wurf', text: err instanceof Error \? err\.message : String\(err\) \}\);\s*\}\);/.test(start),
    'PL Wächter Steuerserver-Start: der Wurf beim Start geht mit getLog().warn ins Protokoll und weiter als Meldung an die Statusleiste',
  );
}

// ── Altfehler PL-4 und PL-10: Pad-Tasten und Rückfragen beim Löschen ──
{
  const sb = ohneKommentare(leseText('src/renderer/src/views/SoundboardView.tsx'));
  ok(
    /export function SoundboardView\(\{ panelOffen \}: \{ panelOffen: boolean \}\)/.test(sb) &&
      /if \(!padTasteErlaubt\(e, \{ dialogOffen: editSlot != null, panelOffen \}\)\) return;/.test(sb),
    'PL-4 Wächter: SoundboardView ruft padTasteErlaubt mit editSlot != null und panelOffen',
  );
  const wurzel = ohneKommentare(leseText('src/renderer/src/views/PlayerOberflaeche.tsx'));
  ok(/<Soundboard panelOffen=\{panelOffen\} \/>/.test(wurzel), 'PL-4 Wächter: PlayerOberflaeche reicht panelOffen an Soundboard');
  const show = ohneKommentare(leseText('src/renderer/src/views/ShowView.tsx'));
  ok(
    /cueEntfernenFrage\(/.test(show) && show.indexOf('cueEntfernenFrage(') < show.indexOf('removeShowCue(cue.id)') && /window\.confirm\(frage\)/.test(show),
    'PL-10 Wächter: ShowView fragt vor removeShowCue mit cueEntfernenFrage',
  );
  const bib = ohneKommentare(leseText('src/renderer/src/views/LibraryView.tsx'));
  ok(
    /window\.jmplay\.library\.nutzung\(/.test(bib) && /mediumEntfernenFrage\(/.test(bib) && bib.indexOf('mediumEntfernenFrage(') < bib.indexOf('removeItem(item.id)'),
    'PL-10 Wächter: LibraryView fragt vor removeItem mit library.nutzung und mediumEntfernenFrage',
  );
  const lib = leseText('src/main/library.ts');
  ok(
    /export function mediumNutzung\(id: number\)/.test(lib) && /FROM show_cues WHERE media_id = \?/.test(lib) && /FROM cues WHERE media_id = \?/.test(lib),
    'PL-10 Wächter: library.ts zählt show_cues und cues mit dieser media_id',
  );
  const preload = leseText('src/preload/index.ts');
  const main = leseText('src/main/ipc.ts');
  ok(
    vorkommenIn(preload, 'library:nutzung') === 1 && vorkommenIn(main, 'library:nutzung') === 1 && leseText('src/shared/types.ts').includes('nutzung: (id: number) => Promise<{ cues: number; pads: number }>;'),
    'PL-10 Wächter Kanäle: library:nutzung steht in Preload (invoke) und Main (handle) gleich, window.jmplay.library.nutzung ist typisiert',
  );
}
function vorkommenIn(t: string, kanal: string): number {
  return t.split("'" + kanal + "'").length - 1;
}
