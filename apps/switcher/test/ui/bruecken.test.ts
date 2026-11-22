// UX Welle 1, Switcher b · Brücken (Spec 3.9, 7.2): Fernsteuerungs-Meldung (Kreuzprodukt der Ereignisse, Port belegt),
// Quellen ohne und mit window, Quelltext-Wächter für Preload, Main und Steuerport. Kein Electron, kein window beim Import.
import net from 'node:net';
import { gleich, leseText, ok } from '@jm/ui/testhilfe';
import { FERNSTEUERUNG_QUELLE, MASTER_LINK_QUELLE } from '@/lib/bruecken';
import {
  STEUER_PORT,
  controlStatusZuMeldung,
  meldungZuControlStatus,
  naechsteFernsteuerung,
  portBelegt,
  type FernsteuerungEreignis,
  type FernsteuerungMeldung,
} from '@shared/fernsteuerung';
import type { ControlStatus } from '@shared/types';
import { erzeugeHalter } from '../../src/main/steuerserver-halter';
import { kreuz, pruefeFaelle } from './hilfe';
import { basisControlStatus, basisMeldung, ohneKommentare } from './testzustand';

const BELEGT = 'listen EADDRINUSE: address already in use :::8723';
const folge = (...es: FernsteuerungEreignis[]): FernsteuerungMeldung | undefined =>
  es.reduce<FernsteuerungMeldung | undefined>((m, e) => naechsteFernsteuerung(m, e), undefined);

// ── SW Fernsteuerung Kreuzprodukt: Anfangszustand × Ereignis (Status × Start ok/Fehler × Wurf) ──
{
  const anfaenge: Record<string, FernsteuerungMeldung | undefined> = {
    keine: undefined,
    laeuft: basisMeldung({ clients: 2, modus: 'secure' }),
    Fehler: { laeuft: false, port: 9000, clients: 0, fehler: BELEGT },
  };
  const ereignisse: Record<string, FernsteuerungEreignis> = {
    'Status läuft': { art: 'status', running: true, port: 8723, clients: 1, modus: 'open' },
    'Status läuft ohne Modus': { art: 'status', running: true, port: 8723, clients: 3 },
    'Status steht': { art: 'status', running: false, port: 0, clients: 0 },
    'Start ok': { art: 'start', ok: true },
    'Start Fehler': { art: 'start', ok: false, error: BELEGT },
    'Start Fehler ohne Text': { art: 'start', ok: false },
    Wurf: { art: 'wurf', text: 'kaputt' },
    'Wurf ohne Text': { art: 'wurf', text: ' ' },
  };
  const faelle = kreuz({ anfang: Object.keys(anfaenge), ereignis: Object.keys(ereignisse) });
  pruefeFaelle('SW Fernsteuerung Kreuzprodukt', faelle, (f) => {
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
    { art: 'status', running: true, port: 8723, clients: 0, modus: 'secure' },
    { art: 'start', ok: true },
    { art: 'status', running: true, port: 8723, clients: 2, modus: 'secure' },
  );
  gleich(laeuft, { laeuft: true, port: 8723, clients: 2, modus: 'secure' }, 'SW Fernsteuerung Kreuzprodukt: läuft, 2 Clients, Modus secure, kein Fehler');
  gleich(folge({ art: 'start', ok: true }), { laeuft: true, port: STEUER_PORT, clients: 0 }, 'SW Fernsteuerung Kreuzprodukt: nur Start-Ergebnis, Standardport, ohne Modus');
  gleich(
    folge({ art: 'status', running: false, port: 0, clients: 0 }, { art: 'start', ok: false, error: BELEGT }),
    { laeuft: false, port: STEUER_PORT, clients: 0, fehler: BELEGT },
    'SW Fernsteuerung Kreuzprodukt: Startfehler nach Status mit Port 0 → Standardport statt 0, Fehler wörtlich',
  );
  gleich(
    naechsteFernsteuerung({ laeuft: true, port: 9000, clients: 1 }, { art: 'status', running: false, port: 0, clients: 0 }),
    { laeuft: false, port: 9000, clients: 0 },
    'SW Fernsteuerung Kreuzprodukt: Port 0 übernimmt den zuletzt gemeldeten Port',
  );
}

// ── SW Fernsteuerung Startport: Der Switcher-Port ist einstellbar, das Start-Ereignis trägt den angeforderten Port ──
{
  const belegt = folge({ art: 'start', ok: false, error: BELEGT, port: 9000 });
  gleich(belegt, { laeuft: false, port: 9000, clients: 0, fehler: BELEGT }, 'SW Fernsteuerung Startport: Startfehler mit Port 9000 ohne vorherigen Status → Port 9000');
  ok(portBelegt(belegt), 'SW Fernsteuerung Startport: EADDRINUSE mit Startport → portBelegt');
  gleich(folge({ art: 'start', ok: true, port: 9000 }), { laeuft: true, port: 9000, clients: 0 }, 'SW Fernsteuerung Startport: Start ok mit Port 9000 → läuft, Port 9000');
  gleich(folge({ art: 'start', ok: false, error: BELEGT }), { laeuft: false, port: STEUER_PORT, clients: 0, fehler: BELEGT }, 'SW Fernsteuerung Startport: Start ohne Port → alter Rückfall STEUER_PORT');
  gleich(naechsteFernsteuerung({ laeuft: true, port: 9100, clients: 1 }, { art: 'start', ok: true }), { laeuft: true, port: 9100, clients: 1 }, 'SW Fernsteuerung Startport: Start ohne Port behält den zuletzt gemeldeten Port');
  gleich(naechsteFernsteuerung({ laeuft: true, port: 9100, clients: 1 }, { art: 'start', ok: true, port: 0 }), { laeuft: true, port: 9100, clients: 1 }, 'SW Fernsteuerung Startport: Port 0 zählt als ohne Port');
}

// ── SW Fernsteuerung Port belegt ──
{
  const belegt = folge({ art: 'status', running: false, port: 0, clients: 0 }, { art: 'start', ok: false, error: BELEGT });
  ok(portBelegt(belegt), 'SW Fernsteuerung Port belegt: EADDRINUSE im Startfehler → portBelegt');
  ok(portBelegt(folge({ art: 'wurf', text: 'Error: listen EADDRINUSE 0.0.0.0:8723' })), 'SW Fernsteuerung Port belegt: auch ein Wurf mit EADDRINUSE zählt');
  ok(!portBelegt(folge({ art: 'wurf', text: 'x' })), 'SW Fernsteuerung Port belegt: anderer Fehler → false');
  ok(!portBelegt(undefined) && !portBelegt(basisMeldung()), 'SW Fernsteuerung Port belegt: ohne Meldung und ohne Fehler → false');
  ok(!portBelegt(naechsteFernsteuerung(belegt, { art: 'status', running: true, port: 8723, clients: 0 })), 'SW Fernsteuerung Port belegt: läuft der Server später, ist der Fehler weg');
}

// ── Wandler ControlStatus ↔ FernsteuerungMeldung (Ruling R1) ──
{
  pruefeFaelle(
    'SW Fernsteuerung Wandler: ControlStatus → Meldung → ControlStatus, fehlende Felder bleiben fehlend',
    kreuz({ running: [true, false], modus: [undefined, 'open', 'secure'], fehler: [undefined, 'x'] } as const),
    (f) => {
      const s: ControlStatus = { running: f.running, port: 8723, clients: 2 };
      if (f.modus !== undefined) s.modus = f.modus;
      if (f.fehler !== undefined) s.fehler = f.fehler;
      const m = controlStatusZuMeldung(s);
      const zurueck = meldungZuControlStatus(m);
      const soll: FernsteuerungMeldung = { laeuft: f.running, port: 8723, clients: 2 };
      if (f.modus !== undefined) soll.modus = f.modus;
      if (f.fehler !== undefined) soll.fehler = f.fehler;
      if (JSON.stringify(m) !== JSON.stringify(soll)) return `Meldung ${JSON.stringify(m)}`;
      if (JSON.stringify(zurueck) !== JSON.stringify(s)) return `zurück ${JSON.stringify(zurueck)}`;
      return null;
    },
  );
  gleich(Object.keys(meldungZuControlStatus(basisMeldung())), ['running', 'port', 'clients', 'modus'], 'SW Fernsteuerung Wandler: Felder von ControlStatus heißen running, port, clients, modus');
}

// ── SW Fernsteuerung Neustart: Portwechsel bei verbundenem Client (Fund A1 der Gesamtprüfung) ──
// Mit dem echten SuiteControlServer über den Halter des Mains (ohne Electron, ohne mDNS). stop() zerstört die Client-Sockets,
// ihr close kommt erst danach; der alte Server meldete dann seinen Stillstand über die neue, lauschende Meldung.
{
  const freierPort = async (): Promise<number> => {
    const s = net.createServer();
    await new Promise<void>((r) => s.listen(0, '127.0.0.1', () => r()));
    const port = (s.address() as net.AddressInfo).port;
    await new Promise<void>((r) => s.close(() => r()));
    return port;
  };
  const warte = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
  const halter = erzeugeHalter();
  let meldung: FernsteuerungMeldung | undefined;
  const melde = (e: FernsteuerungEreignis): void => {
    meldung = naechsteFernsteuerung(meldung, e);
  };
  // Wie startControlServerGemeldet: erst die Statuswechsel, danach das Start-Ergebnis mit dem angefragten Port.
  const starte = async (port: number): Promise<void> => {
    const r = await halter.starte(
      { role: 'switcher', appId: 'jm-switcher', advertiseService: false, getState: () => ({ ns: 'switcher', kv: {} }) as never, onCommand: () => {} },
      port,
      melde,
    );
    melde({ art: 'start', ok: r.ok, error: r.error, port });
  };
  const client = (port: number): net.Socket => net.connect(port, '127.0.0.1').on('error', () => {});
  const p1 = await freierPort();
  const p2 = await freierPort();
  const c1 = client(p1);
  try {
    await starte(p1);
    c1.destroy();
    const c2 = client(p1);
    await warte(200);
    gleich([meldung?.laeuft, meldung?.port, meldung?.clients], [true, p1, 1], 'SW Fernsteuerung Neustart: erster Start mit einem Client → läuft, Port, 1 verbunden');
    await starte(p2);
    await warte(300);
    gleich(
      [meldung?.laeuft, meldung?.port, meldung?.clients, halter.aktuell()?.status().running],
      [true, p2, 0, true],
      'SW Fernsteuerung Neustart: nach dem Portwechsel bei verbundenem Client meldet die Statusleiste den neuen, lauschenden Server (kein spätes „aus“ vom alten)',
    );
    c2.destroy();
    halter.stoppe();
    gleich([meldung?.laeuft, meldung?.clients, halter.aktuell()], [false, 0, null], 'SW Fernsteuerung Neustart: das Stoppen selbst wird weiter gemeldet (läuft nicht mehr)');
  } finally {
    c1.destroy();
    halter.stoppe();
  }
  const cs = ohneKommentare(leseText('src/main/control-server.ts'));
  ok(
    cs.includes('erzeugeHalter()') && !cs.includes('new SuiteControlServer') && !/^export function startControlServer\b/m.test(cs) && cs.includes('onMeldung: (e: FernsteuerungEreignis) => void'),
    'SW Fernsteuerung Neustart: control-server.ts baut den Server nur über den Halter; startControlServer ist nicht exportiert und verlangt onMeldung',
  );
}

// ── SW Quelle ohne window ──
{
  let ergebnis: unknown;
  try {
    const antworten = [await MASTER_LINK_QUELLE.abfrage(), await FERNSTEUERUNG_QUELLE.abfrage()];
    let gemeldet = 0;
    const ab = [MASTER_LINK_QUELLE.ereignis(() => void gemeldet++), FERNSTEUERUNG_QUELLE.ereignis(() => void gemeldet++)];
    for (const f of ab) f();
    ergebnis = [antworten, ab.map((f) => typeof f), gemeldet];
  } catch (e) {
    ergebnis = String(e);
  }
  gleich(ergebnis, [[null, null], ['function', 'function'], 0], 'SW Quelle ohne window: Abfrage null, Ereignis gibt eine Abmeldung und meldet nichts');
}

// ── Quellen mit Preload-Attrappe (window nur im Test gesetzt) ──
{
  const g = globalThis as unknown as { window?: unknown };
  const log: string[] = [];
  let ereignisCb: ((s: ControlStatus) => void) | undefined;
  let abfrageStatus: ControlStatus = basisControlStatus({ clients: 1 });
  g.window = {
    jmswitch: {
      masterLink: async () => ({ art: 'aus' }),
      onMasterLink: () => {
        log.push('onMasterLink');
        return () => void log.push('ab masterLink');
      },
      control: {
        getStatus: async () => abfrageStatus,
        onStatus: (cb: (s: ControlStatus) => void) => {
          ereignisCb = cb;
          return () => void log.push('ab control');
        },
      },
    },
  };
  try {
    const gemeldet: unknown[] = [];
    const ab = FERNSTEUERUNG_QUELLE.ereignis((w) => void gemeldet.push(w));
    ereignisCb?.(basisControlStatus({ clients: 3, modus: 'secure' }));
    ab();
    gleich(await FERNSTEUERUNG_QUELLE.abfrage(), { laeuft: true, port: 8723, clients: 1, modus: 'open' }, 'SW Quelle mit Preload: FERNSTEUERUNG_QUELLE liest control.getStatus und wandelt in die Meldung');
    gleich(gemeldet, [{ laeuft: true, port: 8723, clients: 3, modus: 'secure' }], 'SW Quelle mit Preload: control.onStatus wird in die Meldung gewandelt');
    gleich(log, ['ab control'], 'SW Quelle mit Preload: die Abmeldung geht an control.onStatus');
    gleich(await MASTER_LINK_QUELLE.abfrage(), { art: 'aus' }, 'SW Quelle mit Preload: MASTER_LINK_QUELLE liest masterLink');
    // Main hat noch nie gemeldet (nicht laufend, Port 0) → unbekannt (null), nicht „aus“.
    abfrageStatus = { running: false, port: 0, clients: 0 };
    gleich(await FERNSTEUERUNG_QUELLE.abfrage(), null, 'SW Quelle mit Preload: Status ohne jede Meldung (Port 0, nicht laufend) → null = unbekannt');
    abfrageStatus = { running: false, port: 8723, clients: 0 };
    gleich(await FERNSTEUERUNG_QUELLE.abfrage(), { laeuft: false, port: 8723, clients: 0 }, 'SW Quelle mit Preload: gemeldeter Stillstand mit Port → aus, nicht unbekannt');
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
  const protokoll = leseText('../../packages/suite-control-protocol/src/index.ts');

  // SW Wächter Kanal master-link
  const kanaele = [...preload.matchAll(/'(jmps:master[^']*)'/g)].map((m) => m[1]);
  ok(kanaele.length === 3 && kanaele.every((k) => k === 'jmps:master-link'), 'SW Wächter Kanal master-link: Preload nennt den Kanal dreimal wörtlich jmps:master-link (invoke, on, off)');
  ok(
    preload.includes("  masterLink: () => (ipcRenderer.invoke('jmps:master-link') as Promise<MasterLinkMeldung>).catch(() => null),\n") &&
      preload.includes("    ipcRenderer.on('jmps:master-link', listener);\n    return () => ipcRenderer.off('jmps:master-link', listener);\n"),
    'SW Wächter Kanal master-link: Abfrage fängt jede Ablehnung zu null ab, Ereignis mit Abmeldung',
  );
  ok(
    /^import type \{ MasterLinkMeldung \} from '@jm\/app-runtime';$/m.test(preload) && !/^import \{[^}]*\} from '@jm\/app-runtime'/m.test(preload),
    'SW Wächter Kanal master-link: aus app-runtime nur der Typ (kein Main-Code im Sandbox-Preload)',
  );
  ok(
    typen.includes('export type MasterLinkMeldungZeile =') &&
      typen.includes('masterLink: () => Promise<MasterLinkMeldungZeile | null>;') &&
      typen.includes('onMasterLink: (cb: (m: MasterLinkMeldungZeile) => void) => () => void;'),
    'SW Wächter Kanal master-link: JmswitchApi hat masterLink und onMasterLink mit MasterLinkMeldungZeile',
  );

  // SW Wächter initAppRuntime ohne masterLink:false
  const von = main.indexOf('initAppRuntime({');
  const runtime = main.slice(von, main.indexOf('});', von));
  ok(von >= 0 && !/masterLink\s*:\s*false/.test(runtime), 'SW Wächter initAppRuntime ohne masterLink:false: initAppRuntime registriert jmps:master-link (Option nicht abgeschaltet)');

  // SW Wächter ControlStatus
  const vorkommen = (t: string, kanal: string): number => t.split(`'${kanal}'`).length - 1;
  ok(
    vorkommen(preload, 'control:status') === 3 && vorkommen(ipc, 'control:status') === 1 && vorkommen(cs, 'control:status') === 1,
    'SW Wächter ControlStatus: Kanal control:status steht in Preload (invoke, on, off), ipc (handle) und Steuerserver (send) gleich',
  );
  const ohneKommentar = (t: string): string => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  ok(
    /export interface ControlStatus \{\s*running: boolean;\s*port: number;\s*clients: number;\s*modus\?: 'open' \| 'secure';\s*fehler\?: string;\s*\}/.test(ohneKommentar(typen)),
    'SW Wächter ControlStatus: Typ hat running, port, clients plus optional modus und fehler',
  );
  ok(
    cs.includes("send('control:status', meldungZuControlStatus(") && ipc.includes("ipcMain.handle('control:status', () => controlStatus());"),
    'SW Wächter ControlStatus: Main sendet und beantwortet die erweiterte ControlStatus aus der Meldung',
  );
  ok(!/export interface ControlStatus/.test(cs), 'SW Wächter ControlStatus: der Steuerserver führt keinen zweiten, abweichenden ControlStatus');
  ok(preload.includes('as Promise<ControlStatus>') && preload.includes('(_event: unknown, s: ControlStatus)'), 'SW Wächter ControlStatus: Preload nimmt dieselbe Form an');

  // Steuerport und Anlässe der Meldung
  const m = /export const DEFAULT_CONTROL_PORT = (\d+);/.exec(protokoll);
  ok(m !== null && Number(m[1]) === STEUER_PORT, `SW Wächter Steuerport: STEUER_PORT ${STEUER_PORT} gleich DEFAULT_CONTROL_PORT des Steuerprotokolls (${m?.[1]})`);
  ok(leseText('src/renderer/src/store/settings.ts').includes('controlPort: DEFAULT_CONTROL_PORT,'), 'SW Wächter Steuerport: der Standard der Einstellung ist DEFAULT_CONTROL_PORT');
  ok(
    leseText('src/main/steuerserver-halter.ts').includes("if (server === srv) onMeldung({ art: 'status', ...st, modus: srv.modus() });"),
    'SW Wächter Steuerport: jeder Statuswechsel des aktuellen Servers wird mit wirksamem Modus gemeldet (Halter des Mains)',
  );
  ok(
    cs.includes("meldeFernsteuerung({ art: 'start', ok: r.ok, error: r.error, port });") && cs.includes("meldeFernsteuerung({ art: 'wurf', text: "),
    'SW Wächter Steuerport: Start-Ergebnis und Wurf werden gemeldet',
  );
  ok(
    ipc.includes("ipcMain.handle('control:start', (_e, port: number) => startControlServerGemeldet(port));") && main.includes('startControlServerGemeldet(envPort)'),
    'SW Wächter Steuerport: IPC-Start und Env-Start melden; der Port kommt unverändert aus dem Renderer bzw. JMSWITCH_CONTROL_PORT',
  );
}
