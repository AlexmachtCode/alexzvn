// UX Welle 2a, Recorder b · Brücken (Spec 3.9, 7.2): Fernsteuerungs-Meldung (Kreuzprodukt der Ereignisse, Port belegt),
// Quellen ohne und mit window, Quelltext-Wächter für Preload, Main und Steuerport. Kein Electron, kein window beim Import.
// Der Recorder hat kein Ausgabefenster, daher keine Quelle und keinen Kanal für output:zustand.
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
import { basisMeldung } from './testzustand';

const BELEGT = 'listen EADDRINUSE: address already in use :::8729';
const folge = (...es: FernsteuerungEreignis[]): FernsteuerungMeldung | undefined =>
  es.reduce<FernsteuerungMeldung | undefined>((m, e) => naechsteFernsteuerung(m, e), undefined);

// ── RE Fernsteuerung Kreuzprodukt: Anfangszustand × Ereignis (Status × Start ok/Fehler × Wurf) ──
{
  const anfaenge: Record<string, FernsteuerungMeldung | undefined> = {
    keine: undefined,
    laeuft: basisMeldung({ clients: 2, modus: 'secure' }),
    Fehler: { laeuft: false, port: 9000, clients: 0, fehler: BELEGT },
  };
  const ereignisse: Record<string, FernsteuerungEreignis> = {
    'Status läuft': { art: 'status', running: true, port: 8729, clients: 1, modus: 'open' },
    'Status läuft ohne Modus': { art: 'status', running: true, port: 8729, clients: 3 },
    'Status steht': { art: 'status', running: false, port: 0, clients: 0 },
    'Start ok': { art: 'start', ok: true },
    'Start Fehler': { art: 'start', ok: false, error: BELEGT },
    'Start Fehler ohne Text': { art: 'start', ok: false },
    Wurf: { art: 'wurf', text: 'kaputt' },
    'Wurf ohne Text': { art: 'wurf', text: ' ' },
  };
  const faelle = kreuz({ anfang: Object.keys(anfaenge), ereignis: Object.keys(ereignisse) });
  pruefeFaelle('RE Fernsteuerung Kreuzprodukt', faelle, (f) => {
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
    { art: 'status', running: true, port: 8729, clients: 0, modus: 'secure' },
    { art: 'start', ok: true },
    { art: 'status', running: true, port: 8729, clients: 2, modus: 'secure' },
  );
  gleich(laeuft, { laeuft: true, port: 8729, clients: 2, modus: 'secure' }, 'RE Fernsteuerung Kreuzprodukt: läuft, 2 Clients, Modus secure, kein Fehler');
  gleich(folge({ art: 'start', ok: true }), { laeuft: true, port: STEUER_PORT, clients: 0 }, 'RE Fernsteuerung Kreuzprodukt: nur Start-Ergebnis, Standardport, ohne Modus');
  gleich(
    folge({ art: 'status', running: false, port: 0, clients: 0 }, { art: 'start', ok: false, error: BELEGT }),
    { laeuft: false, port: STEUER_PORT, clients: 0, fehler: BELEGT },
    'RE Fernsteuerung Kreuzprodukt: Startfehler nach Status mit Port 0 → Standardport statt 0, Fehler wörtlich',
  );
}

// ── RE Fernsteuerung Port belegt ──
{
  const belegt = folge({ art: 'status', running: false, port: 0, clients: 0 }, { art: 'start', ok: false, error: BELEGT });
  ok(portBelegt(belegt), 'RE Fernsteuerung Port belegt: EADDRINUSE im Startfehler → portBelegt');
  ok(portBelegt(folge({ art: 'wurf', text: 'Error: listen EADDRINUSE 0.0.0.0:8729' })), 'RE Fernsteuerung Port belegt: auch ein Wurf mit EADDRINUSE zählt');
  ok(!portBelegt(folge({ art: 'wurf', text: 'x' })), 'RE Fernsteuerung Port belegt: anderer Fehler → false');
  ok(!portBelegt(undefined) && !portBelegt(basisMeldung()), 'RE Fernsteuerung Port belegt: ohne Meldung und ohne Fehler → false');
  ok(!portBelegt(naechsteFernsteuerung(belegt, { art: 'status', running: true, port: 8729, clients: 0 })), 'RE Fernsteuerung Port belegt: läuft der Server später, ist der Fehler weg');
}

// ── RE Quelle ohne window ──
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
  gleich(ergebnis, [[null, null], ['function', 'function'], 0], 'RE Quelle ohne window: Abfrage null, Ereignis gibt eine Abmeldung und meldet nichts');
}

// ── Quellen mit Preload-Attrappe (window nur im Test gesetzt) ──
{
  const g = globalThis as unknown as { window?: unknown };
  const log: string[] = [];
  let fernCb: ((m: FernsteuerungMeldung | null) => void) | undefined;
  g.window = {
    jmrec: {
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
    gleich(await FERNSTEUERUNG_QUELLE.abfrage(), basisMeldung({ clients: 1 }), 'RE Quelle mit Preload: FERNSTEUERUNG_QUELLE liest jmrec.fernsteuerung');
    gleich(gemeldet, [basisMeldung({ clients: 3 })], 'RE Quelle mit Preload: jmrec.onFernsteuerung meldet die Meldung weiter');
    gleich(log, ['ab fernsteuerung'], 'RE Quelle mit Preload: die Abmeldung geht an jmrec.onFernsteuerung');
    gleich(await MASTER_LINK_QUELLE.abfrage(), { art: 'aus' }, 'RE Quelle mit Preload: MASTER_LINK_QUELLE liest jmrec.masterLink');
  } finally {
    delete g.window;
  }
  // Preload vorhanden, aber ohne die neuen Funktionen (älterer Preload): null und kein Wurf.
  g.window = { jmrec: {} };
  try {
    gleich(
      [await FERNSTEUERUNG_QUELLE.abfrage(), await MASTER_LINK_QUELLE.abfrage(), typeof FERNSTEUERUNG_QUELLE.ereignis(() => {})],
      [null, null, 'function'],
      'RE Quelle ohne window: Preload ohne die neuen Funktionen → null und Abmeldung statt Wurf',
    );
  } finally {
    delete g.window;
  }
}

// ── Quelltext-Wächter ──
{
  const preload = leseText('src/preload/index.ts');
  const main = leseText('src/main/index.ts');
  const cs = leseText('src/main/control-server.ts');
  const typen = leseText('src/shared/types.ts');
  const vorkommen = (t: string, kanal: string): number => t.split("'" + kanal + "'").length - 1;

  // RE Wächter Kanäle
  const kanaele = [...preload.matchAll(/'(jmps:master[^']*)'/g)].map((m) => m[1]);
  ok(kanaele.length === 3 && kanaele.every((k) => k === 'jmps:master-link'), 'RE Wächter Kanäle: Preload nennt den Kanal dreimal wörtlich jmps:master-link (invoke, on, off)');
  ok(
    preload.includes("  masterLink: () => (ipcRenderer.invoke('jmps:master-link') as Promise<MasterLinkMeldung>).catch(() => null),\n") &&
      preload.includes("    ipcRenderer.on('jmps:master-link', listener);\n    return () => ipcRenderer.off('jmps:master-link', listener);\n"),
    'RE Wächter Kanäle: Abfrage fängt jede Ablehnung zu null ab, Ereignis mit Abmeldung',
  );
  ok(
    /^import type \{ MasterLinkMeldung \} from '@jm\/app-runtime';$/m.test(preload) && !/^import \{[^}]*\} from '@jm\/app-runtime'/m.test(preload),
    'RE Wächter Kanäle: aus app-runtime nur der Typ (kein Main-Code im Sandbox-Preload)',
  );
  ok(
    typen.includes('export type MasterLinkMeldungZeile =') &&
      typen.includes('masterLink: () => Promise<MasterLinkMeldungZeile | null>;') &&
      typen.includes('onMasterLink: (cb: (m: MasterLinkMeldungZeile) => void) => () => void;'),
    'RE Wächter Kanäle: window.jmrec hat masterLink und onMasterLink mit MasterLinkMeldungZeile',
  );
  ok(
    vorkommen(preload, 'recorder:fernsteuerung') === 3 && vorkommen(main, 'recorder:fernsteuerung') === 2,
    'RE Wächter Kanäle: recorder:fernsteuerung steht in Preload (invoke, on, off) und Main (handle, send) gleich',
  );
  ok(
    typen.includes('fernsteuerung: () => Promise<FernsteuerungMeldung | null>;') &&
      typen.includes('onFernsteuerung: (cb: (m: FernsteuerungMeldung | null) => void) => () => void;'),
    'RE Wächter Kanäle: window.jmrec hat fernsteuerung und onFernsteuerung',
  );
  ok(
    preload.includes("fernsteuerung: () => (ipcRenderer.invoke('recorder:fernsteuerung') as Promise<FernsteuerungMeldung | null>).catch(() => null),"),
    'RE Wächter Kanäle: Abfrage der Meldung fängt jede Ablehnung zu null ab',
  );
  ok(!preload.includes('output:zustand') && !main.includes('output:zustand'), 'RE Wächter Kanäle: der Recorder hat kein Ausgabefenster, also keinen Kanal output:zustand');
  const von = main.indexOf('initAppRuntime({');
  const runtime = main.slice(von, main.indexOf('});', von));
  ok(von >= 0 && !/masterLink\s*:\s*false/.test(runtime), 'RE Wächter Kanäle: initAppRuntime registriert jmps:master-link (Option masterLink:false fehlt)');

  // RE Wächter STEUER_PORT 8729
  const m = /export const CONTROL_PORT = (\d+);/.exec(cs);
  ok(m !== null && Number(m[1]) === STEUER_PORT && STEUER_PORT === 8729, 'RE Wächter STEUER_PORT 8729: STEUER_PORT ' + STEUER_PORT + ' gleich CONTROL_PORT des Steuerservers (' + m?.[1] + ')');
  ok(cs.includes("onMeldung?.({ art: 'status', ...st, modus: server?.modus() });"), 'RE Wächter STEUER_PORT 8729: jeder Statuswechsel des Servers wird mit wirksamem Modus gemeldet');
  ok(
    main.includes("meldeFernsteuerung({ art: 'start', ok: r.ok, error: r.error })") &&
      main.includes("meldeFernsteuerung({ art: 'wurf', text: ") &&
      main.includes('meldeFernsteuerung)'),
    'RE Wächter STEUER_PORT 8729: Statuswechsel, Start-Ergebnis und Wurf werden gemeldet',
  );
  ok(cs.includes('return server.start(CONTROL_PORT);'), 'RE Wächter STEUER_PORT 8729: der Steuerserver startet unverändert auf CONTROL_PORT');
}

// ── Gesamtprüfung M1: ein Wurf beim Start des Steuerservers kommt zusätzlich ins Protokoll (wie beim Timer), nicht nur als
// Meldung in die Statusleiste; sonst ändert sich nichts am Start ──
{
  const main = leseText('src/main/index.ts');
  ok(
    /startControlServer\([^;]*?\.catch\(\(err\) => \{\s*getLog\(\)\.warn\(`Recorder-Steuerserver fehlgeschlagen: \$\{err instanceof Error \? err\.message : String\(err\)\}`\);\s*meldeFernsteuerung\(\{ art: 'wurf', text: err instanceof Error \? err\.message : String\(err\) \}\);\s*\}\);/.test(main),
    'RE Wächter Steuerserver-Start: der Wurf beim Start geht mit getLog().warn ins Protokoll und weiter als Meldung an die Statusleiste',
  );
}
