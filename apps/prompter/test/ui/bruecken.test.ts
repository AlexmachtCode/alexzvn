// UX Welle 2a, Prompter b · Brücken (Spec 3.9, 7.2): Fernsteuerungs-Meldung (Kreuzprodukt der Ereignisse, Port belegt),
// Quellen ohne und mit window, Quelltext-Wächter für Preload, Main und Steuerport. Kein Electron, kein window beim Import.
import { gleich, leseText, ok } from '@jm/ui/testhilfe';
import type { AusgabeZustand } from '@jm/output-window/zustand';
import { AUSGABE_QUELLE, FERNSTEUERUNG_QUELLE, MASTER_LINK_QUELLE } from '@/lib/bruecken';
import {
  STEUER_PORT,
  naechsteFernsteuerung,
  portBelegt,
  type FernsteuerungEreignis,
  type FernsteuerungMeldung,
} from '@shared/fernsteuerung';
import { kreuz, pruefeFaelle } from './hilfe';
import { basisMeldung } from './testzustand';

const BELEGT = 'listen EADDRINUSE: address already in use :::8727';
const folge = (...es: FernsteuerungEreignis[]): FernsteuerungMeldung | undefined =>
  es.reduce<FernsteuerungMeldung | undefined>((m, e) => naechsteFernsteuerung(m, e), undefined);

// ── PR Fernsteuerung Kreuzprodukt: Anfangszustand × Ereignis (Status × Start ok/Fehler × Wurf) ──
{
  const anfaenge: Record<string, FernsteuerungMeldung | undefined> = {
    keine: undefined,
    laeuft: basisMeldung({ clients: 2, modus: 'secure' }),
    Fehler: { laeuft: false, port: 9000, clients: 0, fehler: BELEGT },
  };
  const ereignisse: Record<string, FernsteuerungEreignis> = {
    'Status läuft': { art: 'status', running: true, port: 8727, clients: 1, modus: 'open' },
    'Status läuft ohne Modus': { art: 'status', running: true, port: 8727, clients: 3 },
    'Status steht': { art: 'status', running: false, port: 0, clients: 0 },
    'Start ok': { art: 'start', ok: true },
    'Start Fehler': { art: 'start', ok: false, error: BELEGT },
    'Start Fehler ohne Text': { art: 'start', ok: false },
    Wurf: { art: 'wurf', text: 'kaputt' },
    'Wurf ohne Text': { art: 'wurf', text: ' ' },
  };
  const faelle = kreuz({ anfang: Object.keys(anfaenge), ereignis: Object.keys(ereignisse) });
  pruefeFaelle('PR Fernsteuerung Kreuzprodukt', faelle, (f) => {
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
    { art: 'status', running: true, port: 8727, clients: 0, modus: 'secure' },
    { art: 'start', ok: true },
    { art: 'status', running: true, port: 8727, clients: 2, modus: 'secure' },
  );
  gleich(laeuft, { laeuft: true, port: 8727, clients: 2, modus: 'secure' }, 'PR Fernsteuerung Kreuzprodukt: läuft, 2 Clients, Modus secure, kein Fehler');
  gleich(folge({ art: 'start', ok: true }), { laeuft: true, port: STEUER_PORT, clients: 0 }, 'PR Fernsteuerung Kreuzprodukt: nur Start-Ergebnis, Standardport, ohne Modus');
  gleich(
    folge({ art: 'status', running: false, port: 0, clients: 0 }, { art: 'start', ok: false, error: BELEGT }),
    { laeuft: false, port: STEUER_PORT, clients: 0, fehler: BELEGT },
    'PR Fernsteuerung Kreuzprodukt: Startfehler nach Status mit Port 0 → Standardport statt 0, Fehler wörtlich',
  );
}

// ── PR Fernsteuerung Port belegt ──
{
  const belegt = folge({ art: 'status', running: false, port: 0, clients: 0 }, { art: 'start', ok: false, error: BELEGT });
  ok(portBelegt(belegt), 'PR Fernsteuerung Port belegt: EADDRINUSE im Startfehler → portBelegt');
  ok(portBelegt(folge({ art: 'wurf', text: 'Error: listen EADDRINUSE 0.0.0.0:8727' })), 'PR Fernsteuerung Port belegt: auch ein Wurf mit EADDRINUSE zählt');
  ok(!portBelegt(folge({ art: 'wurf', text: 'x' })), 'PR Fernsteuerung Port belegt: anderer Fehler → false');
  ok(!portBelegt(undefined) && !portBelegt(basisMeldung()), 'PR Fernsteuerung Port belegt: ohne Meldung und ohne Fehler → false');
  ok(!portBelegt(naechsteFernsteuerung(belegt, { art: 'status', running: true, port: 8727, clients: 0 })), 'PR Fernsteuerung Port belegt: läuft der Server später, ist der Fehler weg');
}

// ── PR Quelle ohne window ──
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
  gleich(ergebnis, [[null, null, null], ['function', 'function', 'function'], 0], 'PR Quelle ohne window: Abfrage null, Ereignis gibt eine Abmeldung und meldet nichts');
}

// ── Quellen mit Preload-Attrappe (window nur im Test gesetzt) ──
{
  const g = globalThis as unknown as { window?: unknown };
  const log: string[] = [];
  let fernCb: ((m: FernsteuerungMeldung | null) => void) | undefined;
  let ausCb: ((z: AusgabeZustand) => void) | undefined;
  g.window = {
    jmprompt: {
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
    gleich(await FERNSTEUERUNG_QUELLE.abfrage(), basisMeldung({ clients: 1 }), 'PR Quelle mit Preload: FERNSTEUERUNG_QUELLE liest jmprompt.fernsteuerung');
    gleich(gemeldet, [basisMeldung({ clients: 3 })], 'PR Quelle mit Preload: jmprompt.onFernsteuerung meldet die Meldung weiter');
    gleich(log, ['ab fernsteuerung'], 'PR Quelle mit Preload: die Abmeldung geht an jmprompt.onFernsteuerung');
    gleich(await MASTER_LINK_QUELLE.abfrage(), { art: 'aus' }, 'PR Quelle mit Preload: MASTER_LINK_QUELLE liest jmprompt.masterLink');
    gleich(await AUSGABE_QUELLE.abfrage(), { art: 'offen', displayId: 3 }, 'PR Quelle mit Preload: AUSGABE_QUELLE liest jmprompt.output.zustand');
    const aus: unknown[] = [];
    const abAus = AUSGABE_QUELLE.ereignis((z) => void aus.push(z));
    ausCb?.({ art: 'abgestuerzt', displayId: 3 });
    abAus();
    gleich([aus, log], [[{ art: 'abgestuerzt', displayId: 3 }], ['ab fernsteuerung', 'ab ausgabe']], 'PR Quelle mit Preload: AUSGABE_QUELLE hängt an jmprompt.output.onZustand samt Abmeldung');
  } finally {
    delete g.window;
  }
  // Preload vorhanden, aber ohne die neuen Funktionen (älterer Preload): null und kein Wurf.
  g.window = { jmprompt: { output: {} } };
  try {
    gleich([await AUSGABE_QUELLE.abfrage(), await FERNSTEUERUNG_QUELLE.abfrage(), typeof AUSGABE_QUELLE.ereignis(() => {})], [null, null, 'function'], 'PR Quelle ohne window: Preload ohne die neuen Funktionen → null und Abmeldung statt Wurf');
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

  // PR Wächter Kanäle
  const kanaele = [...preload.matchAll(/'(jmps:master[^']*)'/g)].map((m) => m[1]);
  ok(kanaele.length === 3 && kanaele.every((k) => k === 'jmps:master-link'), 'PR Wächter Kanäle: Preload nennt den Kanal dreimal wörtlich jmps:master-link (invoke, on, off)');
  ok(
    preload.includes("  masterLink: () => (ipcRenderer.invoke('jmps:master-link') as Promise<MasterLinkMeldung>).catch(() => null),\n") &&
      preload.includes("    ipcRenderer.on('jmps:master-link', listener);\n    return () => ipcRenderer.off('jmps:master-link', listener);\n"),
    'PR Wächter Kanäle: Abfrage fängt jede Ablehnung zu null ab, Ereignis mit Abmeldung',
  );
  ok(
    /^import type \{ MasterLinkMeldung \} from '@jm\/app-runtime';$/m.test(preload) && !/^import \{[^}]*\} from '@jm\/app-runtime'/m.test(preload),
    'PR Wächter Kanäle: aus app-runtime nur der Typ (kein Main-Code im Sandbox-Preload)',
  );
  ok(
    /^import type \{ AusgabeZustand \} from '@jm\/output-window\/zustand';$/m.test(preload) && !/from '@jm\/output-window'/.test(preload),
    'PR Wächter Kanäle: aus output-window nur der reine Typ aus /zustand (kein electron im Preload-Import)',
  );
  ok(
    typen.includes('export type MasterLinkMeldungZeile =') &&
      typen.includes('masterLink: () => Promise<MasterLinkMeldungZeile | null>;') &&
      typen.includes('onMasterLink: (cb: (m: MasterLinkMeldungZeile) => void) => () => void;'),
    'PR Wächter Kanäle: window.jmprompt hat masterLink und onMasterLink mit MasterLinkMeldungZeile',
  );
  ok(
    vorkommen(preload, 'prompter:fernsteuerung') === 3 && vorkommen(main, 'prompter:fernsteuerung') === 2,
    'PR Wächter Kanäle: prompter:fernsteuerung steht in Preload (invoke, on, off) und Main (handle, send) gleich',
  );
  ok(
    typen.includes('fernsteuerung: () => Promise<FernsteuerungMeldung | null>;') &&
      typen.includes('onFernsteuerung: (cb: (m: FernsteuerungMeldung | null) => void) => () => void;'),
    'PR Wächter Kanäle: window.jmprompt hat fernsteuerung und onFernsteuerung',
  );
  ok(
    preload.includes("fernsteuerung: () => (ipcRenderer.invoke('prompter:fernsteuerung') as Promise<FernsteuerungMeldung | null>).catch(() => null),"),
    'PR Wächter Kanäle: Abfrage der Meldung fängt jede Ablehnung zu null ab',
  );
  ok(
    vorkommen(preload, 'output:zustand') === 3 && vorkommen(main, 'output:zustand') === 2,
    'PR Wächter Kanäle: output:zustand steht in Preload (invoke, on, off) und Main (handle, send) gleich',
  );
  ok(
    preload.includes("zustand: () => (ipcRenderer.invoke('output:zustand') as Promise<AusgabeZustand | null>).catch(() => null),") &&
      typen.includes('zustand: () => Promise<AusgabeZustand | null>;') &&
      typen.includes('onZustand: (cb: (z: AusgabeZustand) => void) => () => void;'),
    'PR Wächter Kanäle: output.zustand fängt jede Ablehnung zu null ab, output.onZustand ist typisiert',
  );
  ok(
    main.includes("ipcMain.handle('output:zustand', () => output.zustand());") &&
      main.includes('output.onZustand((z) => {') &&
      main.includes("mainWindow.webContents.send('output:zustand', z);"),
    'PR Wächter Kanäle: Main antwortet mit output.zustand() und schickt jede Änderung an das Hauptfenster (nicht an alle)',
  );
  // PR Bildschirmliste folgt dem Ereignis (UX Welle 2b, Task 4): output:bildschirme ist nur ein Ereignis ohne Nutzlast. Der Main
  // sendet es über beobachteBildschirme aus @jm/output-window (nach app.ready) nur an das Hauptfenster; der Preload reicht es
  // ohne Wert weiter (on, off).
  ok(
    vorkommen(preload, 'output:bildschirme') === 2 && vorkommen(main, 'output:bildschirme') === 1,
    'PR Wächter Kanäle: output:bildschirme steht in Preload (on, off) und Main (send) gleich',
  );
  ok(
    preload.includes("    onBildschirme: (cb) => {\n      const listener = (): void => cb();\n      ipcRenderer.on('output:bildschirme', listener);\n      return () => ipcRenderer.off('output:bildschirme', listener);\n    },\n") &&
      typen.includes('onBildschirme: (cb: () => void) => () => void;'),
    'PR Wächter Kanäle: output.onBildschirme meldet ohne Nutzlast, mit Abmeldung, und ist typisiert',
  );
  {
    const bereit = main.indexOf('app.whenReady().then(() => {');
    const aufruf = main.indexOf('beobachteBildschirme(');
    const block = main.slice(aufruf, main.indexOf('});', aufruf) + 3);
    ok(
      /^import \{[^}]*\bbeobachteBildschirme\b[^}]*\} from '@jm\/output-window';$/m.test(main) &&
        bereit >= 0 &&
        aufruf > bereit &&
        main.split('beobachteBildschirme(').length === 2 &&
        /^beobachteBildschirme\(\(\) => \{\s*if \(mainWindow && !mainWindow\.isDestroyed\(\)\) mainWindow\.webContents\.send\('output:bildschirme'\);\s*\}\);$/.test(block),
      'PR Wächter Kanäle: Main ruft beobachteBildschirme einmal nach app.ready und schickt output:bildschirme ohne Nutzlast nur an das Hauptfenster',
    );
  }

  const von = main.indexOf('initAppRuntime({');
  const runtime = main.slice(von, main.indexOf('});', von));
  ok(von >= 0 && !/masterLink\s*:\s*false/.test(runtime), 'PR Wächter Kanäle: initAppRuntime registriert jmps:master-link (Option masterLink:false fehlt)');

  // PR Wächter STEUER_PORT 8727
  const m = /export const CONTROL_PORT = (\d+);/.exec(cs);
  ok(m !== null && Number(m[1]) === STEUER_PORT && STEUER_PORT === 8727, 'PR Wächter STEUER_PORT 8727: STEUER_PORT ' + STEUER_PORT + ' gleich CONTROL_PORT des Steuerservers (' + m?.[1] + ')');
  // Rückspiel (Task 26, Regel aus Task 21): der Modus kommt aus der meldenden Instanz, nicht aus der Modulvariable `server`.
  ok(
    cs.includes("handlers.onMeldung?.({ art: 'status', ...st, modus: srv.modus() });") && /const srv = new SuiteControlServer\(/.test(cs) && cs.includes('server = srv;') && !cs.includes('server?.modus()'),
    'PR Rückspiel Wächter STEUER_PORT 8727: jeder Statuswechsel des Servers wird mit dem Modus der meldenden Instanz gemeldet (srv.modus(), nicht die Modulvariable)',
  );
  ok(
    main.includes("meldeFernsteuerung({ art: 'start', ok: r.ok, error: r.error })") &&
      main.includes("meldeFernsteuerung({ art: 'wurf', text: ") &&
      main.includes('onMeldung: meldeFernsteuerung'),
    'PR Wächter STEUER_PORT 8727: Statuswechsel, Start-Ergebnis und Wurf werden gemeldet',
  );
  ok(cs.includes('return server.start(CONTROL_PORT);'), 'PR Wächter STEUER_PORT 8727: der Steuerserver startet unverändert auf CONTROL_PORT');
}

// ── Gesamtprüfung M1: Startfehler des Steuerservers kommen zusätzlich ins Protokoll, wie beim Timer
// (apps/timer/src/main/index.ts): ein Start mit ok:false (z. B. Port belegt) und ein Wurf. Die Meldungen an die Statusleiste
// bleiben, sonst ändert sich nichts am Start ──
{
  const main = leseText('src/main/index.ts');
  const start = main.slice(main.indexOf('startControlServer('), main.indexOf('startControlServer(') + 1200);
  ok(
    /^startControlServer\([\s\S]*?\)\s*\.then\(\(r\) => \{\s*meldeFernsteuerung\(\{ art: 'start', ok: r\.ok, error: r\.error \}\);\s*if \(!r\.ok\) getLog\(\)\.warn\(`Prompter-Steuerserver nicht gestartet: \$\{r\.error \?\? 'unbekannt'\}`\);\s*\}\)/.test(start),
    'PR Wächter Steuerserver-Start: ein Start mit ok:false (z. B. Port belegt) geht mit getLog().warn ins Protokoll, die Meldung an die Statusleiste bleibt',
  );
  ok(
    /\.catch\(\(err\) => \{\s*getLog\(\)\.warn\(`Prompter-Steuerserver fehlgeschlagen: \$\{err instanceof Error \? err\.message : String\(err\)\}`\);\s*meldeFernsteuerung\(\{ art: 'wurf', text: err instanceof Error \? err\.message : String\(err\) \}\);\s*\}\);/.test(start),
    'PR Wächter Steuerserver-Start: der Wurf beim Start geht mit getLog().warn ins Protokoll und weiter als Meldung an die Statusleiste',
  );
}
