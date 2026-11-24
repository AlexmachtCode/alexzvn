// UX Welle 2b, Studio-Control b · Brücken (Spec 3.9, 7.2): Fernsteuerungs-Meldung (Kreuzprodukt der Ereignisse, Port belegt),
// Quellen und Umgebung ohne und mit window, Quelltext-Wächter für Preload, Main und Steuerport. Kein Electron, kein window
// beim Import.
import { gleich, leseText, ok } from '@jm/ui/testhilfe';
import { FERNSTEUERUNG_QUELLE, MASTER_LINK_QUELLE, umgebung } from '@/lib/bruecken';
import {
  STEUER_PORT,
  naechsteFernsteuerung,
  portBelegt,
  type FernsteuerungEreignis,
  type FernsteuerungMeldung,
} from '@shared/fernsteuerung';
import { kreuz, pruefeFaelle } from './hilfe';
import { basisMeldung, ohneKommentare } from './testzustand';

const BELEGT = 'listen EADDRINUSE: address already in use :::8735';
const folge = (...es: FernsteuerungEreignis[]): FernsteuerungMeldung | undefined =>
  es.reduce<FernsteuerungMeldung | undefined>((m, e) => naechsteFernsteuerung(m, e), undefined);

// ── SC Fernsteuerung Kreuzprodukt: Anfangszustand × Ereignis (Status × Start ok/Fehler × Wurf) ──
{
  const anfaenge: Record<string, FernsteuerungMeldung | undefined> = {
    keine: undefined,
    laeuft: basisMeldung({ clients: 2, modus: 'secure' }),
    Fehler: { laeuft: false, port: 9000, clients: 0, fehler: BELEGT },
  };
  const ereignisse: Record<string, FernsteuerungEreignis> = {
    'Status läuft': { art: 'status', running: true, port: 8735, clients: 1, modus: 'open' },
    'Status läuft ohne Modus': { art: 'status', running: true, port: 8735, clients: 3 },
    'Status steht': { art: 'status', running: false, port: 0, clients: 0 },
    'Start ok': { art: 'start', ok: true },
    'Start Fehler': { art: 'start', ok: false, error: BELEGT },
    'Start Fehler ohne Text': { art: 'start', ok: false },
    Wurf: { art: 'wurf', text: 'kaputt' },
    'Wurf ohne Text': { art: 'wurf', text: ' ' },
  };
  const faelle = kreuz({ anfang: Object.keys(anfaenge), ereignis: Object.keys(ereignisse) });
  pruefeFaelle('SC Fernsteuerung Kreuzprodukt', faelle, (f) => {
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
  const laeuft = folge(
    { art: 'status', running: true, port: 8735, clients: 0, modus: 'secure' },
    { art: 'start', ok: true },
    { art: 'status', running: true, port: 8735, clients: 2, modus: 'secure' },
  );
  gleich(laeuft, { laeuft: true, port: 8735, clients: 2, modus: 'secure' }, 'SC Fernsteuerung Kreuzprodukt: läuft, 2 Clients, Modus secure, kein Fehler');
  gleich(folge({ art: 'start', ok: true }), { laeuft: true, port: STEUER_PORT, clients: 0 }, 'SC Fernsteuerung Kreuzprodukt: nur Start-Ergebnis, Standardport, ohne Modus');
  gleich(
    folge({ art: 'status', running: false, port: 0, clients: 0 }, { art: 'start', ok: false, error: BELEGT }),
    { laeuft: false, port: STEUER_PORT, clients: 0, fehler: BELEGT },
    'SC Fernsteuerung Kreuzprodukt: Startfehler nach Status mit Port 0 → Standardport statt 0, Fehler wörtlich',
  );
}

// ── SC Fernsteuerung Port belegt ──
{
  const belegt = folge({ art: 'status', running: false, port: 0, clients: 0 }, { art: 'start', ok: false, error: BELEGT });
  ok(portBelegt(belegt), 'SC Fernsteuerung Port belegt: EADDRINUSE im Startfehler → portBelegt');
  ok(portBelegt(folge({ art: 'wurf', text: 'Error: listen EADDRINUSE 0.0.0.0:8735' })), 'SC Fernsteuerung Port belegt: auch ein Wurf mit EADDRINUSE zählt');
  ok(!portBelegt(folge({ art: 'wurf', text: 'x' })), 'SC Fernsteuerung Port belegt: anderer Fehler → false');
  ok(!portBelegt(undefined) && !portBelegt(basisMeldung()), 'SC Fernsteuerung Port belegt: ohne Meldung und ohne Fehler → false');
  ok(!portBelegt(naechsteFernsteuerung(belegt, { art: 'status', running: true, port: 8735, clients: 0 })), 'SC Fernsteuerung Port belegt: läuft der Server später, ist der Fehler weg');
}

// ── SC Quelle ohne window / SC Umgebung Browser ──
{
  let ergebnis: unknown;
  try {
    const quellen = [MASTER_LINK_QUELLE, FERNSTEUERUNG_QUELLE];
    const antworten: unknown[] = [];
    for (const q of quellen) antworten.push(await q.abfrage());
    let gemeldet = 0;
    const ab = quellen.map((q) => q.ereignis(() => void gemeldet++));
    for (const f of ab) f();
    ergebnis = [antworten, ab.map((f) => typeof f), gemeldet];
  } catch (e) {
    ergebnis = String(e);
  }
  gleich(ergebnis, [[null, null], ['function', 'function'], 0], 'SC Quelle ohne window: Abfrage null, Ereignis gibt eine Abmeldung und meldet nichts');
  gleich(umgebung(), 'browser', 'SC Umgebung Browser: ohne window → browser');
}
{
  const g = globalThis as unknown as { window?: unknown };
  const log: string[] = [];
  let fernCb: ((m: FernsteuerungMeldung | null) => void) | undefined;
  g.window = {
    jms: {
      isElectron: true,
      masterLink: async () => ({ art: 'aus' }),
      onMasterLink: () => () => void log.push('ab masterLink'),
      fernsteuerung: async () => basisMeldung({ clients: 1 }),
      onFernsteuerung: (cb: (m: FernsteuerungMeldung | null) => void) => {
        fernCb = cb;
        return () => void log.push('ab fernsteuerung');
      },
    },
  };
  try {
    gleich(umgebung(), 'electron', 'SC Umgebung Browser: mit jms.isElectron === true → electron');
    const gemeldet: unknown[] = [];
    const ab = FERNSTEUERUNG_QUELLE.ereignis((w) => void gemeldet.push(w));
    fernCb?.(basisMeldung({ clients: 3 }));
    ab();
    gleich(await FERNSTEUERUNG_QUELLE.abfrage(), basisMeldung({ clients: 1 }), 'SC Quelle mit Preload: FERNSTEUERUNG_QUELLE liest jms.fernsteuerung');
    gleich(gemeldet, [basisMeldung({ clients: 3 })], 'SC Quelle mit Preload: jms.onFernsteuerung meldet die Meldung weiter');
    gleich(log, ['ab fernsteuerung'], 'SC Quelle mit Preload: die Abmeldung geht an jms.onFernsteuerung');
    gleich(await MASTER_LINK_QUELLE.abfrage(), { art: 'aus' }, 'SC Quelle mit Preload: MASTER_LINK_QUELLE liest jms.masterLink');
  } finally {
    delete g.window;
  }
  // window.jms ohne die Funktionen (älterer Preload): null und kein Wurf, Umgebung browser.
  g.window = { jms: { isElectron: false } };
  try {
    gleich([await FERNSTEUERUNG_QUELLE.abfrage(), await MASTER_LINK_QUELLE.abfrage(), umgebung()], [null, null, 'browser'], 'SC Quelle ohne window: jms ohne Brücken-Funktionen → null, Umgebung browser');
  } finally {
    delete g.window;
  }
}

// ── SC Wächter Kanäle / SC Wächter STEUER_PORT 8735: Quelltext ──
{
  const preload = leseText('src/preload/index.ts');
  const main = ohneKommentare(leseText('src/main/index.ts'));
  const cg = ohneKommentare(leseText('src/main/gateway/control-gateway.ts'));
  const srv = ohneKommentare(leseText('src/main/server.ts'));
  const typen = leseText('src/renderer/src/sync/jms.d.ts');
  const css = leseText('src/renderer/src/globals.css');

  ok(
    preload.includes("ipcRenderer.invoke('jmps:master-link')") &&
      preload.includes("ipcRenderer.on('jmps:master-link', listener)") &&
      preload.includes("ipcRenderer.off('jmps:master-link', listener)") &&
      (preload.match(/jmps:master-link/g) ?? []).length === 3,
    'SC Wächter Kanäle: Preload nutzt genau den Kanal jmps:master-link (invoke, on, off)',
  );
  ok(
    preload.includes("ipcRenderer.invoke('studio:fernsteuerung')") &&
      preload.includes("ipcRenderer.on('studio:fernsteuerung', listener)") &&
      preload.includes("ipcRenderer.off('studio:fernsteuerung', listener)") &&
      (preload.match(/studio:fernsteuerung/g) ?? []).length === 3,
    'SC Wächter Kanäle: Preload nutzt studio:fernsteuerung für Abfrage und Ereignis',
  );
  ok(
    main.includes("ipcMain.handle('studio:fernsteuerung', () => fernsteuerung)") &&
      main.includes("mainWindow.webContents.send('studio:fernsteuerung', fernsteuerung)") &&
      (main.match(/studio:fernsteuerung/g) ?? []).length === 2,
    'SC Wächter Kanäle: Main beantwortet und meldet studio:fernsteuerung, nur an das Hauptfenster (nicht an Browser-Clients)',
  );
  ok(
    typen.includes('masterLink: () => Promise<MasterLinkMeldungZeile | null>;') &&
      typen.includes('onMasterLink: (cb: (m: MasterLinkMeldungZeile) => void) => () => void;') &&
      typen.includes('fernsteuerung: () => Promise<FernsteuerungMeldung | null>;') &&
      typen.includes('onFernsteuerung: (cb: (m: FernsteuerungMeldung | null) => void) => () => void;'),
    'SC Wächter Kanäle: window.jms ist typisiert (Master-Link und Fernsteuerung, mit Abmeldung)',
  );
  const von = main.indexOf('initAppRuntime({');
  const runtime = main.slice(von, main.indexOf('});', von));
  ok(von >= 0 && !/masterLink\s*:\s*false/.test(runtime), 'SC Wächter Kanäle: initAppRuntime registriert jmps:master-link (Option masterLink:false fehlt)');
  ok(
    /^@source "\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/packages\/settings\/src";$/m.test(css) && /^@source "\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/packages\/ui\/src";$/m.test(css),
    'SC Wächter Kanäle: globals.css scannt packages/ui und packages/settings (@source)',
  );

  const m = /export const CONTROL_PORT = (\d+);/.exec(cg);
  ok(m !== null && Number(m[1]) === STEUER_PORT && STEUER_PORT === 8735, 'SC Wächter STEUER_PORT 8735: STEUER_PORT ' + STEUER_PORT + ' gleich CONTROL_PORT des Gateways (' + m?.[1] + ')');
  // Rückspiel (Task 26, Regel aus Task 21): der Modus kommt aus der meldenden Instanz, nicht aus der Modulvariable `server` (eine späte
  // Meldung eines gestoppten Gateways trüge sonst den Modus des neuen oder gar keinen).
  ok(
    cg.includes("onMeldung?.({ art: 'status', ...st, modus: srv.modus() });") && /const srv = new SuiteControlServer\(/.test(cg) && cg.includes('server = srv;') && !cg.includes('server?.modus()'),
    'SC Rückspiel Wächter STEUER_PORT 8735: jeder Statuswechsel des Servers wird mit dem Modus der meldenden Instanz gemeldet (srv.modus(), nicht die Modulvariable)',
  );
  ok(cg.includes('return server.start(CONTROL_PORT);'), 'SC Wächter STEUER_PORT 8735: das Gateway startet unverändert auf CONTROL_PORT');
  ok(
    srv.includes("onMeldung?.({ art: 'start', ok: r.ok, error: r.error })") &&
      srv.includes("onMeldung?.({ art: 'wurf', text: ") &&
      srv.includes('startControlGateway(onMeldung)') &&
      main.includes('await startServer(meldeFernsteuerung)'),
    'SC Wächter STEUER_PORT 8735: Statuswechsel, Start-Ergebnis und Wurf werden gemeldet und von Main verdrahtet',
  );
}
