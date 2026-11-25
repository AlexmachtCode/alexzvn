// UX Welle 2b, Presenter b · Brücken (Spec 3.9, 7.2, B2, B11): Fernsteuerungs-Meldung (Kreuzprodukt der Ereignisse, Port
// belegt), Quellen ohne und mit window, Quelltext-Wächter für Preload, Main, Steuerport und das Bildschirm-Ereignis samt `move`
// des Publikumsfensters. Kein Electron, kein window beim Import.
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

const BELEGT = 'listen EADDRINUSE: address already in use :::8728';
const folge = (...es: FernsteuerungEreignis[]): FernsteuerungMeldung | undefined =>
  es.reduce<FernsteuerungMeldung | undefined>((m, e) => naechsteFernsteuerung(m, e), undefined);

// ── PS Fernsteuerung Kreuzprodukt: Anfangszustand × Ereignis (Status × Start ok/Fehler × Wurf) ──
{
  const anfaenge: Record<string, FernsteuerungMeldung | undefined> = {
    keine: undefined,
    laeuft: basisMeldung({ clients: 2, modus: 'secure' }),
    Fehler: { laeuft: false, port: 9000, clients: 0, fehler: BELEGT },
  };
  const ereignisse: Record<string, FernsteuerungEreignis> = {
    'Status läuft': { art: 'status', running: true, port: 8728, clients: 1, modus: 'open' },
    'Status läuft ohne Modus': { art: 'status', running: true, port: 8728, clients: 3 },
    'Status steht': { art: 'status', running: false, port: 0, clients: 0 },
    'Start ok': { art: 'start', ok: true },
    'Start Fehler': { art: 'start', ok: false, error: BELEGT },
    'Start Fehler ohne Text': { art: 'start', ok: false },
    Wurf: { art: 'wurf', text: 'kaputt' },
    'Wurf ohne Text': { art: 'wurf', text: ' ' },
  };
  const faelle = kreuz({ anfang: Object.keys(anfaenge), ereignis: Object.keys(ereignisse) });
  pruefeFaelle('PS Fernsteuerung Kreuzprodukt', faelle, (f) => {
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
    { art: 'status', running: true, port: 8728, clients: 0, modus: 'secure' },
    { art: 'start', ok: true },
    { art: 'status', running: true, port: 8728, clients: 2, modus: 'secure' },
  );
  gleich(laeuft, { laeuft: true, port: 8728, clients: 2, modus: 'secure' }, 'PS Fernsteuerung Kreuzprodukt: läuft, 2 Clients, Modus secure, kein Fehler');
  gleich(folge({ art: 'start', ok: true }), { laeuft: true, port: STEUER_PORT, clients: 0 }, 'PS Fernsteuerung Kreuzprodukt: nur Start-Ergebnis, Standardport, ohne Modus');
  gleich(
    folge({ art: 'status', running: false, port: 0, clients: 0 }, { art: 'start', ok: false, error: BELEGT }),
    { laeuft: false, port: STEUER_PORT, clients: 0, fehler: BELEGT },
    'PS Fernsteuerung Kreuzprodukt: Startfehler nach Status mit Port 0 → Standardport statt 0, Fehler wörtlich',
  );
}

// ── PS Fernsteuerung Port belegt ──
{
  const belegt = folge({ art: 'status', running: false, port: 0, clients: 0 }, { art: 'start', ok: false, error: BELEGT });
  ok(portBelegt(belegt), 'PS Fernsteuerung Port belegt: EADDRINUSE im Startfehler → portBelegt');
  ok(portBelegt(folge({ art: 'wurf', text: 'Error: listen EADDRINUSE 0.0.0.0:8728' })), 'PS Fernsteuerung Port belegt: auch ein Wurf mit EADDRINUSE zählt');
  ok(!portBelegt(folge({ art: 'wurf', text: 'x' })), 'PS Fernsteuerung Port belegt: anderer Fehler → false');
  ok(!portBelegt(undefined) && !portBelegt(basisMeldung()), 'PS Fernsteuerung Port belegt: ohne Meldung und ohne Fehler → false');
  ok(!portBelegt(naechsteFernsteuerung(belegt, { art: 'status', running: true, port: 8728, clients: 0 })), 'PS Fernsteuerung Port belegt: läuft der Server später, ist der Fehler weg');
}

// ── PS Quelle ohne window ──
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
  gleich(ergebnis, [[null, null], ['function', 'function'], 0], 'PS Quelle ohne window: Abfrage null, Ereignis gibt eine Abmeldung und meldet nichts');
}

// ── Quellen mit Preload-Attrappe (window nur im Test gesetzt) ──
{
  const g = globalThis as unknown as { window?: unknown };
  const log: string[] = [];
  let fernCb: ((m: FernsteuerungMeldung | null) => void) | undefined;
  let linkCb: ((m: unknown) => void) | undefined;
  g.window = {
    jmpr: {
      masterLink: async () => ({ art: 'aus' }),
      onMasterLink: (cb: (m: unknown) => void) => {
        linkCb = cb;
        return () => void log.push('ab masterLink');
      },
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
    gleich(await FERNSTEUERUNG_QUELLE.abfrage(), basisMeldung({ clients: 1 }), 'PS Quelle mit Preload: FERNSTEUERUNG_QUELLE liest jmpr.fernsteuerung');
    gleich(gemeldet, [basisMeldung({ clients: 3 })], 'PS Quelle mit Preload: jmpr.onFernsteuerung meldet die Meldung weiter');
    gleich(log, ['ab fernsteuerung'], 'PS Quelle mit Preload: die Abmeldung geht an jmpr.onFernsteuerung');
    gleich(await MASTER_LINK_QUELLE.abfrage(), { art: 'aus' }, 'PS Quelle mit Preload: MASTER_LINK_QUELLE liest jmpr.masterLink');
    const links: unknown[] = [];
    const abLink = MASTER_LINK_QUELLE.ereignis((m) => void links.push(m));
    linkCb?.({ art: 'sucht' });
    abLink();
    gleich([links, log], [[{ art: 'sucht' }], ['ab fernsteuerung', 'ab masterLink']], 'PS Quelle mit Preload: MASTER_LINK_QUELLE hängt an jmpr.onMasterLink samt Abmeldung');
  } finally {
    delete g.window;
  }
  // Preload vorhanden, aber ohne die neuen Funktionen (älterer Preload): null und kein Wurf.
  g.window = { jmpr: {} };
  try {
    gleich(
      [await MASTER_LINK_QUELLE.abfrage(), await FERNSTEUERUNG_QUELLE.abfrage(), typeof MASTER_LINK_QUELLE.ereignis(() => {}), typeof FERNSTEUERUNG_QUELLE.ereignis(() => {})],
      [null, null, 'function', 'function'],
      'PS Quelle ohne window: Preload ohne die neuen Funktionen → null und Abmeldung statt Wurf',
    );
  } finally {
    delete g.window;
  }
}

// ── Quelltext-Wächter ──
{
  const preload = leseText('src/preload/index.ts');
  const main = leseText('src/main/index.ts');
  const fenster = leseText('src/main/windows.ts');
  const cs = leseText('src/main/control-server.ts');
  const typen = leseText('src/shared/types.ts');
  const vite = leseText('electron.vite.config.ts');
  const vorkommen = (t: string, kanal: string): number => t.split("'" + kanal + "'").length - 1;

  // PS Wächter Kanäle: jmps:master-link (Master-Link aus initAppRuntime)
  const kanaele = [...preload.matchAll(/'(jmps:master[^']*)'/g)].map((m) => m[1]);
  ok(kanaele.length === 3 && kanaele.every((k) => k === 'jmps:master-link'), 'PS Wächter Kanäle: Preload nennt den Kanal dreimal wörtlich jmps:master-link (invoke, on, off)');
  ok(
    preload.includes("  masterLink: () => (ipcRenderer.invoke('jmps:master-link') as Promise<MasterLinkMeldung>).catch(() => null),\n") &&
      preload.includes("    ipcRenderer.on('jmps:master-link', listener);\n    return () => ipcRenderer.off('jmps:master-link', listener);\n"),
    'PS Wächter Kanäle: Abfrage fängt jede Ablehnung zu null ab, Ereignis mit Abmeldung',
  );
  ok(
    /^import type \{ MasterLinkMeldung \} from '@jm\/app-runtime';$/m.test(preload) && !/^import \{[^}]*\} from '@jm\/app-runtime'/m.test(preload),
    'PS Wächter Kanäle: aus app-runtime nur der Typ (kein Main-Code im Sandbox-Preload)',
  );
  ok(!/from '@jm\/output-window/.test(preload), 'PS Wächter Kanäle: der Preload importiert nichts aus output-window (kein electron-Main-Code in der Sandbox)');
  ok(
    typen.includes('export type MasterLinkMeldungZeile =') &&
      typen.includes('  masterLink: () => Promise<MasterLinkMeldungZeile | null>;') &&
      typen.includes('  onMasterLink: (cb: (m: MasterLinkMeldungZeile) => void) => () => void;'),
    'PS Wächter Kanäle: window.jmpr hat masterLink und onMasterLink mit MasterLinkMeldungZeile',
  );
  const von = main.indexOf('initAppRuntime({');
  const runtime = main.slice(von, main.indexOf('});', von));
  ok(von >= 0 && !/masterLink\s*:\s*false/.test(runtime), 'PS Wächter Kanäle: initAppRuntime registriert jmps:master-link (Option masterLink:false fehlt)');

  // PS Wächter Kanäle: presenter:fernsteuerung (Meldung des Steuerservers, invoke und Ereignis)
  ok(
    vorkommen(preload, 'presenter:fernsteuerung') === 3 && vorkommen(main, 'presenter:fernsteuerung') === 2,
    'PS Wächter Kanäle: presenter:fernsteuerung steht in Preload (invoke, on, off) und Main (handle, broadcastAll) gleich',
  );
  ok(
    preload.includes("  fernsteuerung: () => (ipcRenderer.invoke('presenter:fernsteuerung') as Promise<FernsteuerungMeldung | null>).catch(() => null),\n") &&
      preload.includes("    ipcRenderer.on('presenter:fernsteuerung', listener);\n    return () => ipcRenderer.off('presenter:fernsteuerung', listener);\n"),
    'PS Wächter Kanäle: Abfrage der Meldung fängt jede Ablehnung zu null ab, Ereignis mit Abmeldung',
  );
  ok(
    typen.includes('  fernsteuerung: () => Promise<FernsteuerungMeldung | null>;') &&
      typen.includes('  onFernsteuerung: (cb: (m: FernsteuerungMeldung | null) => void) => () => void;'),
    'PS Wächter Kanäle: window.jmpr hat fernsteuerung und onFernsteuerung',
  );
  ok(
    main.includes("ipcMain.handle('presenter:fernsteuerung', () => fernsteuerung);") &&
      main.includes("broadcastAll('presenter:fernsteuerung', fernsteuerung);"),
    'PS Wächter Kanäle: Main antwortet mit der letzten Meldung und schickt jede neue über broadcastAll an alle Fenster',
  );

  // PS Wächter Kanäle: present:bildschirme (nur Ereignis ohne Nutzlast; Main über beobachteBildschirme und move des Publikums)
  ok(
    vorkommen(preload, 'present:bildschirme') === 2 && vorkommen(main, 'present:bildschirme') + vorkommen(fenster, 'present:bildschirme') === 2,
    'PS Wächter Kanäle: present:bildschirme steht in Preload (on, off) und Main (index.ts beobachteBildschirme, windows.ts move) gleich',
  );
  {
    const present = typen.slice(typen.indexOf('  present: {'), typen.indexOf('\n  };', typen.indexOf('  present: {')));
    ok(
      preload.includes("    onBildschirme: (cb) => {\n      const listener = (): void => cb();\n      ipcRenderer.on('present:bildschirme', listener);\n      return () => ipcRenderer.off('present:bildschirme', listener);\n    },\n") &&
        present.includes('    onBildschirme: (cb: () => void) => () => void;'),
      'PS Wächter Kanäle: present.onBildschirme meldet ohne Nutzlast, mit Abmeldung, und ist im Block present typisiert',
    );
  }
  {
    const bereit = main.indexOf('app.whenReady().then(() => {');
    const aufruf = main.indexOf('beobachteBildschirme(');
    const zeile = main.slice(aufruf, main.indexOf('\n', aufruf));
    ok(
      /^import \{[^}]*\bbeobachteBildschirme\b[^}]*\} from '@jm\/output-window';$/m.test(main) &&
        bereit >= 0 &&
        aufruf > bereit &&
        main.split('beobachteBildschirme(').length === 2 &&
        zeile === "beobachteBildschirme(() => broadcastAll('present:bildschirme', undefined));",
      'PS Wächter Kanäle: Main ruft beobachteBildschirme einmal nach app.ready und schickt present:bildschirme ohne Nutzlast über broadcastAll',
    );
  }
  ok(
    /exclude:\s*\[[^\]]*'@jm\/output-window'[^\]]*\]/.test(vite.slice(vite.indexOf('main: {'), vite.indexOf('preload: {'))),
    'PS Wächter Kanäle: @jm/output-window wird in den Main gebündelt (W21; die gepackte App liefert kein node_modules)',
  );
  {
    // Publikum und NDI-Fenster bekommen die Meldungen über broadcastAll mit, hören aber nicht zu.
    const ohneHoerer = ['src/renderer/src/views/AudienceView.tsx', 'src/renderer/src/ndi/ndi-ansicht.ts'].filter((p) =>
      /onBildschirme|onFernsteuerung|onMasterLink|FERNSTEUERUNG_QUELLE|MASTER_LINK_QUELLE/.test(leseText(p)),
    );
    gleich(ohneHoerer, [], 'PS Wächter Kanäle: Publikum und NDI-Fenster hören weder auf present:bildschirme noch auf Fernsteuerung oder Master-Link');
  }

  // PS Wächter STEUER_PORT 8728
  const m = /export const CONTROL_PORT = (\d+);/.exec(cs);
  ok(m !== null && Number(m[1]) === STEUER_PORT && STEUER_PORT === 8728, 'PS Wächter STEUER_PORT 8728: STEUER_PORT ' + STEUER_PORT + ' gleich CONTROL_PORT des Steuerservers (' + m?.[1] + ')');
  ok(
    cs.includes('export function startControlServer(\n  onMeldung?: (e: FernsteuerungEreignis) => void,\n): Promise<{ ok: boolean; error?: string; port?: number }> {') &&
      cs.includes("    onStatus: (st) => {\n      onMeldung?.({ art: 'status', ...st, modus: srv.modus() });\n    },\n") &&
      /const srv = new SuiteControlServer\(/.test(cs) &&
      cs.includes('server = srv;') &&
      !cs.includes('server?.modus()'),
    // Rückspiel (Task 26, Regel aus Task 21): der Modus kommt aus der meldenden Instanz, nicht aus der Modulvariable `server`.
    'PS Rückspiel Wächter STEUER_PORT 8728: startControlServer nimmt onMeldung; jeder Statuswechsel des Servers wird mit dem Modus der meldenden Instanz gemeldet (srv.modus(), nicht die Modulvariable)',
  );
  ok(cs.includes('  return server.start(CONTROL_PORT);\n'), 'PS Wächter STEUER_PORT 8728: der Steuerserver startet unverändert auf CONTROL_PORT');
  {
    const start = main.slice(main.indexOf('startControlServer('), main.indexOf('startControlServer(') + 1200);
    ok(
      /^startControlServer\(meldeFernsteuerung\)\s*\.then\(\(r\) => \{\s*meldeFernsteuerung\(\{ art: 'start', ok: r\.ok, error: r\.error \}\);\s*if \(!r\.ok\) getLog\(\)\.warn\(`Presenter-Steuerserver nicht gestartet: \$\{r\.error \?\? 'unbekannt'\}`\);\s*\}\)/.test(start),
      'PS Wächter STEUER_PORT 8728: Start-Ergebnis wird gemeldet; ein Start mit ok:false (z. B. Port belegt) geht mit getLog().warn ins Protokoll (2a M1)',
    );
    ok(
      /\.catch\(\(err\) => \{\s*getLog\(\)\.warn\(`Presenter-Steuerserver fehlgeschlagen: \$\{err instanceof Error \? err\.message : String\(err\)\}`\);\s*meldeFernsteuerung\(\{ art: 'wurf', text: err instanceof Error \? err\.message : String\(err\) \}\);\s*\}\);/.test(start),
      'PS Wächter STEUER_PORT 8728: ein Wurf beim Start geht mit getLog().warn ins Protokoll und als Meldung an die Statusleiste',
    );
    ok(!/await\s+startControlServer/.test(main) && main.split('startControlServer(').length === 2, 'PS Wächter STEUER_PORT 8728: genau ein Start, ohne await (der Ablauf nach app.ready wartet nicht auf den Server)');
  }

  // PS Wächter Publikumsfenster move meldet (B11): das Publikumsfenster meldet jede Bewegung (auch „Auf diesen Bildschirm“),
  // damit Editor und Referent die Bildschirmliste mit `current` neu lesen. Nur dort, ohne Nutzlast, über broadcastAll.
  {
    const oeffnen = ohneKommentare(fenster.slice(fenster.indexOf('export function openAudienceWindow('), fenster.indexOf('export function moveAudienceToDisplay(')));
    ok(
      oeffnen.includes("  win.on('move', () => broadcastAll('present:bildschirme', undefined));\n") && vorkommen(fenster, 'present:bildschirme') === 1,
      'PS Wächter Publikumsfenster move meldet: openAudienceWindow hängt an move des neuen Fensters und meldet present:bildschirme ohne Nutzlast',
    );
    ok(
      fenster.includes('  for (const win of [editorWindow, presenterWindow, audienceWindow, ndiWindow]) {\n    if (win && !win.isDestroyed()) win.webContents.send(channel, payload);\n'),
      'PS Wächter Publikumsfenster move meldet: broadcastAll sendet nur an lebende Fenster (isDestroyed-Schutz)',
    );
    ok(
      fenster.includes("  audienceWindow.once('move', () => {\n    if (audienceWindow && !audienceWindow.isDestroyed()) audienceWindow.setFullScreen(true);\n  });\n"),
      'PS Wächter Publikumsfenster move meldet: der Vollbild-Ablauf beim Verschieben bleibt unverändert',
    );
  }
}
