// UX Welle 2b, Connect b (Task 21) · Brücken (Spec 3.9, 7.2): Fernsteuerungs-Meldung (Kreuzprodukt der Ereignisse, Port belegt),
// Quellen ohne und mit window, Quelltext-Wächter für Preload, Main, Steuerport und AppStatus. Kein Electron, kein window beim
// Import. Arbeitsverzeichnis ist apps/connect; leseText liest relativ dazu.
import { gleich, leseText, ok } from '@jm/ui/testhilfe';
import { FERNSTEUERUNG_QUELLE, MASTER_LINK_QUELLE } from '@/lib/bruecken';
import {
  STEUER_PORT,
  naechsteFernsteuerung,
  portBelegt,
  type FernsteuerungEreignis,
  type FernsteuerungMeldung,
} from '@shared/fernsteuerung';
import { kreuz, pruefeFaelle } from './hilfe';
import { basisMeldung, ohneKommentare } from './testzustand';

const BELEGT = 'listen EADDRINUSE: address already in use :::8737';
const folge = (...es: FernsteuerungEreignis[]): FernsteuerungMeldung | undefined =>
  es.reduce<FernsteuerungMeldung | undefined>((m, e) => naechsteFernsteuerung(m, e), undefined);

// ── CN Fernsteuerung Kreuzprodukt: Anfangszustand × Ereignis (Status × Start ok/Fehler × Wurf) ──
{
  const anfaenge: Record<string, FernsteuerungMeldung | undefined> = {
    keine: undefined,
    laeuft: basisMeldung({ clients: 2, modus: 'secure' }),
    Fehler: { laeuft: false, port: 9000, clients: 0, fehler: BELEGT },
  };
  const ereignisse: Record<string, FernsteuerungEreignis> = {
    'Status läuft': { art: 'status', running: true, port: 8737, clients: 1, modus: 'open' },
    'Status läuft ohne Modus': { art: 'status', running: true, port: 8737, clients: 3 },
    'Status steht': { art: 'status', running: false, port: 0, clients: 0 },
    'Start ok': { art: 'start', ok: true },
    'Start Fehler': { art: 'start', ok: false, error: BELEGT },
    'Start Fehler ohne Text': { art: 'start', ok: false },
    Wurf: { art: 'wurf', text: 'kaputt' },
    'Wurf ohne Text': { art: 'wurf', text: ' ' },
  };
  const faelle = kreuz({ anfang: Object.keys(anfaenge), ereignis: Object.keys(ereignisse) });
  pruefeFaelle('CN Fernsteuerung Kreuzprodukt', faelle, (f) => {
    const alt = anfaenge[f.anfang];
    const e = ereignisse[f.ereignis]!;
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
    { art: 'status', running: true, port: 8737, clients: 0, modus: 'secure' },
    { art: 'start', ok: true },
    { art: 'status', running: true, port: 8737, clients: 2, modus: 'secure' },
  );
  gleich(laeuft, { laeuft: true, port: 8737, clients: 2, modus: 'secure' }, 'CN Fernsteuerung Kreuzprodukt: läuft, 2 Clients, Modus secure, kein Fehler');
  gleich(folge({ art: 'start', ok: true }), { laeuft: true, port: STEUER_PORT, clients: 0 }, 'CN Fernsteuerung Kreuzprodukt: nur Start-Ergebnis, Standardport, ohne Modus');
  gleich(
    folge({ art: 'status', running: false, port: 0, clients: 0 }, { art: 'start', ok: false, error: BELEGT }),
    { laeuft: false, port: STEUER_PORT, clients: 0, fehler: BELEGT },
    'CN Fernsteuerung Kreuzprodukt: Startfehler nach Status mit Port 0 → Standardport statt 0, Fehler wörtlich',
  );
}

// ── CN Fernsteuerung Port belegt ──
{
  const belegt = folge({ art: 'status', running: false, port: 0, clients: 0 }, { art: 'start', ok: false, error: BELEGT });
  ok(portBelegt(belegt), 'CN Fernsteuerung Port belegt: EADDRINUSE im Startfehler → portBelegt');
  ok(portBelegt(folge({ art: 'wurf', text: 'Error: listen EADDRINUSE 0.0.0.0:8737' })), 'CN Fernsteuerung Port belegt: auch ein Wurf mit EADDRINUSE zählt');
  ok(!portBelegt(folge({ art: 'wurf', text: 'x' })), 'CN Fernsteuerung Port belegt: anderer Fehler → false');
  ok(!portBelegt(undefined) && !portBelegt(basisMeldung()), 'CN Fernsteuerung Port belegt: ohne Meldung und ohne Fehler → false');
  ok(!portBelegt(naechsteFernsteuerung(belegt, { art: 'status', running: true, port: 8737, clients: 0 })), 'CN Fernsteuerung Port belegt: läuft der Server später, ist der Fehler weg');
}

// ── CN Quelle ohne window ──
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
  gleich(ergebnis, [[null, null], ['function', 'function'], 0], 'CN Quelle ohne window: Abfrage null, Ereignis gibt eine Abmeldung und meldet nichts');
}
{
  const g = globalThis as unknown as { window?: unknown };
  const log: string[] = [];
  let fernCb: ((m: FernsteuerungMeldung | null) => void) | undefined;
  g.window = {
    jmconnect: {
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
    const gemeldet: unknown[] = [];
    const ab = FERNSTEUERUNG_QUELLE.ereignis((w) => void gemeldet.push(w));
    fernCb?.(basisMeldung({ clients: 3 }));
    ab();
    gleich(await FERNSTEUERUNG_QUELLE.abfrage(), basisMeldung({ clients: 1 }), 'CN Quelle mit Preload: FERNSTEUERUNG_QUELLE liest jmconnect.fernsteuerung');
    gleich(gemeldet, [basisMeldung({ clients: 3 })], 'CN Quelle mit Preload: jmconnect.onFernsteuerung meldet die Meldung weiter');
    gleich(log, ['ab fernsteuerung'], 'CN Quelle mit Preload: die Abmeldung geht an jmconnect.onFernsteuerung');
    gleich(await MASTER_LINK_QUELLE.abfrage(), { art: 'aus' }, 'CN Quelle mit Preload: MASTER_LINK_QUELLE liest jmconnect.masterLink');
  } finally {
    delete g.window;
  }
  // window.jmconnect ohne die Funktionen (älterer Preload): null und kein Wurf.
  g.window = { jmconnect: {} };
  try {
    gleich([await FERNSTEUERUNG_QUELLE.abfrage(), await MASTER_LINK_QUELLE.abfrage()], [null, null], 'CN Quelle ohne window: jmconnect ohne Brücken-Funktionen → null');
  } finally {
    delete g.window;
  }
}

// ── CN Wächter Kanäle: Quelltext ──
{
  const preload = ohneKommentare(leseText('src/preload/index.ts'));
  const main = ohneKommentare(leseText('src/main/index.ts'));
  const ipc = ohneKommentare(leseText('src/shared/ipc.ts'));
  const typen = leseText('src/shared/types.ts');

  ok(
    preload.includes("ipcRenderer.invoke('jmps:master-link')") &&
      preload.includes("ipcRenderer.on('jmps:master-link', listener)") &&
      preload.includes("ipcRenderer.off('jmps:master-link', listener)") &&
      (preload.match(/jmps:master-link/g) ?? []).length === 3,
    'CN Wächter Kanäle: Preload nutzt genau den Kanal jmps:master-link (invoke, on, off)',
  );
  ok(
    (ipc.match(/fernsteuerung: 'jmc:fernsteuerung',/g) ?? []).length === 1 && (ipc.match(/jmc:fernsteuerung/g) ?? []).length === 1,
    'CN Wächter Kanäle: IPC.fernsteuerung ist der Kanal jmc:fernsteuerung (Präfix der übrigen Kanäle, einmal vergeben)',
  );
  ok(
    preload.includes('ipcRenderer.invoke(IPC.fernsteuerung)') &&
      preload.includes('ipcRenderer.on(IPC.fernsteuerung, listener)') &&
      preload.includes('ipcRenderer.off(IPC.fernsteuerung, listener)') &&
      (preload.match(/IPC\.fernsteuerung\b/g) ?? []).length === 3,
    'CN Wächter Kanäle: Preload nutzt IPC.fernsteuerung für Abfrage und Ereignis (invoke, on, off)',
  );
  ok(
    /ipcMain\.handle\(IPC\.fernsteuerung, \(\) => fernsteuerung\)/.test(main) &&
      /webContents\.send\(IPC\.fernsteuerung, fernsteuerung\)/.test(main) &&
      (main.match(/IPC\.fernsteuerung\b/g) ?? []).length === 2,
    'CN Wächter Kanäle: Main beantwortet und meldet IPC.fernsteuerung (je einmal)',
  );
  ok(
    typen.includes('masterLink: () => Promise<MasterLinkMeldungZeile | null>;') &&
      typen.includes('onMasterLink: (cb: (m: MasterLinkMeldungZeile) => void) => () => void;') &&
      typen.includes('fernsteuerung: () => Promise<FernsteuerungMeldung | null>;') &&
      typen.includes('onFernsteuerung: (cb: (m: FernsteuerungMeldung | null) => void) => () => void;'),
    'CN Wächter Kanäle: JmConnectApi ist typisiert (Master-Link und Fernsteuerung, mit Abmeldung)',
  );
  const von = main.indexOf('initAppRuntime({');
  const runtime = von < 0 ? '' : main.slice(von, main.indexOf('\n});', von));
  ok(von >= 0 && runtime.length > 0 && !/masterLink\s*:\s*false/.test(runtime), 'CN Wächter Kanäle: initAppRuntime registriert jmps:master-link (Option masterLink:false fehlt)');
}

// ── CN Wächter STEUER_PORT 8737 ──
{
  const cs = ohneKommentare(leseText('src/main/control-server.ts'));
  const main = ohneKommentare(leseText('src/main/index.ts'));
  const m = /export const CONTROL_PORT = (\d+);/.exec(cs);
  ok(m !== null && Number(m[1]) === STEUER_PORT && STEUER_PORT === 8737, 'CN Wächter STEUER_PORT 8737: STEUER_PORT ' + STEUER_PORT + ' gleich CONTROL_PORT des Steuerservers (' + m?.[1] + ')');
  ok(cs.includes('return server.start(CONTROL_PORT);'), 'CN Wächter STEUER_PORT 8737: der Steuerserver startet unverändert auf CONTROL_PORT');
  ok(
    cs.includes("onMeldung?.({ art: 'status', ...st, modus: srv.modus() });") && /const srv = new SuiteControlServer\(/.test(cs),
    'CN Wächter STEUER_PORT 8737: jeder Statuswechsel wird mit dem Modus der meldenden Server-Instanz gemeldet',
  );
  ok(
    main.includes("meldeFernsteuerung({ art: 'start', ok: res.ok, error: res.error })") &&
      main.includes("meldeFernsteuerung({ art: 'wurf', text: ") &&
      main.includes('startControlServer(\n') &&
      /startControlServer\(\s*\{[\s\S]*?\},\s*meldeFernsteuerung,?\s*\)/.test(main),
    'CN Wächter STEUER_PORT 8737: Statuswechsel, Start-Ergebnis und Wurf werden gemeldet und von Main verdrahtet',
  );
}

// ── CN AppStatus unverändert: die Feldliste von interface AppStatus ist genau die heutige (auch ein optionales Feld macht rot) ──
{
  const typen = ohneKommentare(leseText('src/shared/types.ts'));
  const von = typen.indexOf('export interface AppStatus {');
  const bis = von < 0 ? -1 : typen.indexOf('\n}', von);
  const koerper = von < 0 || bis < 0 ? '' : typen.slice(von, bis);
  const felder = [...koerper.matchAll(/^ {2}(\w+\??):/gm)].map((x) => x[1]);
  gleich(
    felder,
    ['configured', 'proxyBase', 'proxyKeySource', 'cloudZugang', 'controlPort', 'ndiGaeste', 'ndiProgramm', 'presenterLinked', 'zoom'],
    'CN AppStatus unverändert: die Felder von AppStatus sind die heutigen neun (die Fernsteuerung ist kein Feld, E44/KF10)',
  );
}
