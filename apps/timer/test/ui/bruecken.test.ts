// UX Welle 1, Timer b · Brücken (Spec 3.9, 7.2): Fernsteuerungs-Meldung (Kreuzprodukt der Ereignisse, Port belegt),
// Quellen ohne und mit window, Quelltext-Wächter für Preload, Main und Steuerport. Kein Electron, kein window beim Import.
import { gleich, leseText, ok } from '@jm/ui/testhilfe';
import { FERNSTEUERUNG_QUELLE, MASTER_LINK_QUELLE, VERBUND_QUELLE } from '@/lib/bruecken';
import {
  STEUER_PORT,
  naechsteFernsteuerung,
  portBelegt,
  type FernsteuerungEreignis,
  type FernsteuerungMeldung,
} from '@shared/fernsteuerung';
import { kreuz, pruefeFaelle } from './hilfe';
import { basisMeldung } from './testzustand';

const BELEGT = 'listen EADDRINUSE: address already in use :::8724';
const folge = (...es: FernsteuerungEreignis[]): FernsteuerungMeldung | undefined =>
  es.reduce<FernsteuerungMeldung | undefined>((m, e) => naechsteFernsteuerung(m, e), undefined);

// ── TI Fernsteuerung Kreuzprodukt: Anfangszustand × Ereignis (Status × Start ok/Fehler × Wurf) ──
{
  const anfaenge: Record<string, FernsteuerungMeldung | undefined> = {
    keine: undefined,
    laeuft: basisMeldung({ clients: 2, modus: 'secure' }),
    Fehler: { laeuft: false, port: 9000, clients: 0, fehler: BELEGT },
  };
  const ereignisse: Record<string, FernsteuerungEreignis> = {
    'Status läuft': { art: 'status', running: true, port: 8724, clients: 1, modus: 'open' },
    'Status läuft ohne Modus': { art: 'status', running: true, port: 8724, clients: 3 },
    'Status steht': { art: 'status', running: false, port: 0, clients: 0 },
    'Start ok': { art: 'start', ok: true },
    'Start Fehler': { art: 'start', ok: false, error: BELEGT },
    'Start Fehler ohne Text': { art: 'start', ok: false },
    Wurf: { art: 'wurf', text: 'kaputt' },
    'Wurf ohne Text': { art: 'wurf', text: ' ' },
  };
  const faelle = kreuz({ anfang: Object.keys(anfaenge), ereignis: Object.keys(ereignisse) });
  pruefeFaelle('TI Fernsteuerung Kreuzprodukt', faelle, (f) => {
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
    { art: 'status', running: true, port: 8724, clients: 0, modus: 'secure' },
    { art: 'start', ok: true },
    { art: 'status', running: true, port: 8724, clients: 2, modus: 'secure' },
  );
  gleich(laeuft, { laeuft: true, port: 8724, clients: 2, modus: 'secure' }, 'TI Fernsteuerung Kreuzprodukt: läuft, 2 Clients, Modus secure, kein Fehler');
  gleich(folge({ art: 'start', ok: true }), { laeuft: true, port: STEUER_PORT, clients: 0 }, 'TI Fernsteuerung Kreuzprodukt: nur Start-Ergebnis, Standardport, ohne Modus');
  gleich(
    folge({ art: 'status', running: false, port: 0, clients: 0 }, { art: 'start', ok: false, error: BELEGT }),
    { laeuft: false, port: STEUER_PORT, clients: 0, fehler: BELEGT },
    'TI Fernsteuerung Kreuzprodukt: Startfehler nach Status mit Port 0 → Standardport statt 0, Fehler wörtlich',
  );
}

// ── TI Fernsteuerung Port belegt ──
{
  const belegt = folge({ art: 'status', running: false, port: 0, clients: 0 }, { art: 'start', ok: false, error: BELEGT });
  ok(portBelegt(belegt), 'TI Fernsteuerung Port belegt: EADDRINUSE im Startfehler → portBelegt');
  ok(portBelegt(folge({ art: 'wurf', text: 'Error: listen EADDRINUSE 0.0.0.0:8724' })), 'TI Fernsteuerung Port belegt: auch ein Wurf mit EADDRINUSE zählt');
  ok(!portBelegt(folge({ art: 'wurf', text: 'x' })), 'TI Fernsteuerung Port belegt: anderer Fehler → false');
  ok(!portBelegt(undefined) && !portBelegt(basisMeldung()), 'TI Fernsteuerung Port belegt: ohne Meldung und ohne Fehler → false');
  ok(!portBelegt(naechsteFernsteuerung(belegt, { art: 'status', running: true, port: 8724, clients: 0 })), 'TI Fernsteuerung Port belegt: läuft der Server später, ist der Fehler weg');
}

// ── TI Quelle ohne window ──
{
  let ergebnis: unknown;
  try {
    const quellen = [MASTER_LINK_QUELLE, FERNSTEUERUNG_QUELLE, VERBUND_QUELLE];
    const antworten: unknown[] = [];
    for (const q of quellen) antworten.push(await q.abfrage());
    let gemeldet = 0;
    const ab = quellen.map((q) => q.ereignis(() => void gemeldet++));
    for (const f of ab) f();
    ergebnis = [antworten, ab.map((f) => typeof f), gemeldet];
  } catch (e) {
    ergebnis = String(e);
  }
  gleich(ergebnis, [[null, null, null], ['function', 'function', 'function'], 0], 'TI Quelle ohne window: Abfrage null, Ereignis gibt eine Abmeldung und meldet nichts');
}

// ── Quellen mit Preload-Attrappe (window nur im Test gesetzt) ──
{
  const g = globalThis as unknown as { window?: unknown };
  const log: string[] = [];
  let fernCb: ((m: FernsteuerungMeldung | null) => void) | undefined;
  g.window = {
    jm: {
      masterLink: async () => ({ art: 'aus' }),
      onMasterLink: () => () => void log.push('ab masterLink'),
      fernsteuerung: async () => basisMeldung({ clients: 1 }),
      onFernsteuerung: (cb: (m: FernsteuerungMeldung | null) => void) => {
        fernCb = cb;
        return () => void log.push('ab fernsteuerung');
      },
      verbundAnzeige: async () => ({ text: 'V', farbe: 'gruen' }),
      onVerbundAnzeige: () => () => void log.push('ab verbund'),
    },
  };
  try {
    const gemeldet: unknown[] = [];
    const ab = FERNSTEUERUNG_QUELLE.ereignis((w) => void gemeldet.push(w));
    fernCb?.(basisMeldung({ clients: 3 }));
    ab();
    gleich(await FERNSTEUERUNG_QUELLE.abfrage(), basisMeldung({ clients: 1 }), 'TI Quelle mit Preload: FERNSTEUERUNG_QUELLE liest jm.fernsteuerung');
    gleich(gemeldet, [basisMeldung({ clients: 3 })], 'TI Quelle mit Preload: jm.onFernsteuerung meldet die Meldung weiter');
    gleich(log, ['ab fernsteuerung'], 'TI Quelle mit Preload: die Abmeldung geht an jm.onFernsteuerung');
    gleich(await MASTER_LINK_QUELLE.abfrage(), { art: 'aus' }, 'TI Quelle mit Preload: MASTER_LINK_QUELLE liest jm.masterLink');
    gleich(await VERBUND_QUELLE.abfrage(), { text: 'V', farbe: 'gruen' }, 'TI Quelle mit Preload: VERBUND_QUELLE liest die bestehende jm.verbundAnzeige');
    VERBUND_QUELLE.ereignis(() => {})();
    gleich(log, ['ab fernsteuerung', 'ab verbund'], 'TI Quelle mit Preload: VERBUND_QUELLE hängt an jm.onVerbundAnzeige');
  } finally {
    delete g.window;
  }
}

// ── Quelltext-Wächter ──
{
  const preload = leseText('src/preload/index.ts');
  const main = leseText('src/main/index.ts');
  const cs = leseText('src/main/control-server.ts');
  const typen = leseText('src/renderer/src/sync/jm.d.ts');
  const verbund = leseText('src/shared/verbund.ts');
  const vorkommen = (t: string, kanal: string): number => t.split(`'${kanal}'`).length - 1;

  // TI Wächter Kanäle
  const kanaele = [...preload.matchAll(/'(jmps:master[^']*)'/g)].map((m) => m[1]);
  ok(kanaele.length === 3 && kanaele.every((k) => k === 'jmps:master-link'), 'TI Wächter Kanäle: Preload nennt den Kanal dreimal wörtlich jmps:master-link (invoke, on, off)');
  ok(
    preload.includes("  masterLink: () => (ipcRenderer.invoke('jmps:master-link') as Promise<MasterLinkMeldung>).catch(() => null),\n") &&
      preload.includes("    ipcRenderer.on('jmps:master-link', listener);\n    return () => ipcRenderer.off('jmps:master-link', listener);\n"),
    'TI Wächter Kanäle: Abfrage fängt jede Ablehnung zu null ab, Ereignis mit Abmeldung',
  );
  ok(
    /^import type \{ MasterLinkMeldung \} from '@jm\/app-runtime';$/m.test(preload) && !/^import \{[^}]*\} from '@jm\/app-runtime'/m.test(preload),
    'TI Wächter Kanäle: aus app-runtime nur der Typ (kein Main-Code im Sandbox-Preload)',
  );
  ok(
    verbund.includes('export type MasterLinkMeldungZeile =') &&
      typen.includes('masterLink: () => Promise<MasterLinkMeldungZeile | null>;') &&
      typen.includes('onMasterLink: (cb: (m: MasterLinkMeldungZeile) => void) => () => void;'),
    'TI Wächter Kanäle: window.jm hat masterLink und onMasterLink mit MasterLinkMeldungZeile',
  );
  ok(
    vorkommen(preload, 'timer:fernsteuerung') === 3 && vorkommen(main, 'timer:fernsteuerung') === 2,
    'TI Wächter Kanäle: timer:fernsteuerung steht in Preload (invoke, on, off) und Main (handle, send) gleich',
  );
  ok(
    typen.includes('fernsteuerung: () => Promise<FernsteuerungMeldung | null>;') &&
      typen.includes('onFernsteuerung: (cb: (m: FernsteuerungMeldung | null) => void) => () => void;'),
    'TI Wächter Kanäle: window.jm hat fernsteuerung und onFernsteuerung',
  );
  ok(
    preload.includes("fernsteuerung: () => (ipcRenderer.invoke('timer:fernsteuerung') as Promise<FernsteuerungMeldung | null>).catch(() => null),"),
    'TI Wächter Kanäle: Abfrage der Meldung fängt jede Ablehnung zu null ab',
  );
  ok(
    vorkommen(preload, 'jmps:verbund-anzeige') === 3 && vorkommen(leseText('src/renderer/src/lib/bruecken.ts'), 'jmps:verbund-anzeige') === 0,
    'TI Wächter Kanäle: die V-Zeile bleibt am bestehenden Kanal jmps:verbund-anzeige (kein neuer Kanal)',
  );
  const von = main.indexOf('initAppRuntime({');
  const runtime = main.slice(von, main.indexOf('});', von));
  ok(von >= 0 && !/masterLink\s*:\s*false/.test(runtime), 'TI Wächter Kanäle: initAppRuntime registriert jmps:master-link (Option masterLink:false fehlt)');

  // TI Wächter STEUER_PORT 8724
  const m = /export const CONTROL_PORT = (\d+);/.exec(cs);
  ok(m !== null && Number(m[1]) === STEUER_PORT && STEUER_PORT === 8724, `TI Wächter STEUER_PORT 8724: STEUER_PORT ${STEUER_PORT} gleich CONTROL_PORT des Steuerservers (${m?.[1]})`);
  ok(cs.includes("onMeldung?.({ art: 'status', ...st, modus: server?.modus() });"), 'TI Wächter STEUER_PORT 8724: jeder Statuswechsel des Servers wird mit wirksamem Modus gemeldet');
  ok(
    main.includes("meldeFernsteuerung({ art: 'start', ok: r.ok, error: r.error });") &&
      main.includes("meldeFernsteuerung({ art: 'wurf', text: ") &&
      main.includes('onMeldung: meldeFernsteuerung'),
    'TI Wächter STEUER_PORT 8724: Statuswechsel, Start-Ergebnis und Wurf werden gemeldet',
  );
  ok(cs.includes('return server.start(CONTROL_PORT);'), 'TI Wächter STEUER_PORT 8724: der Steuerserver startet unverändert auf CONTROL_PORT');
}
