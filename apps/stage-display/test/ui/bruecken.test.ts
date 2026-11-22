// UX Welle 2a, Stage-Display b · Brücken (Spec 3.9, 7.2): Quellen ohne und mit window, Quelltext-Wächter für Preload und
// Main. Der Stage-Display hat keinen Steuerserver und damit keine Fernsteuerungs-Meldung. Kein Electron, kein window beim Import.
import { existsSync } from 'node:fs';
import { gleich, leseText, ok } from '@jm/ui/testhilfe';
import type { AusgabeZustand } from '@jm/output-window/zustand';
import { AUSGABE_QUELLE, MASTER_LINK_QUELLE } from '@/lib/bruecken';
import { offenerSchirm } from './testzustand';

// ── SD Quelle ohne window ──
{
  let ergebnis: unknown;
  try {
    const quellen = [MASTER_LINK_QUELLE, AUSGABE_QUELLE];
    const antworten: unknown[] = [];
    for (const q of quellen) antworten.push(await q.abfrage());
    let gemeldet = 0;
    const ab = quellen.map((q) => q.ereignis(() => void gemeldet++));
    for (const f of ab) f();
    ergebnis = [antworten, ab.map((f) => typeof f), gemeldet];
  } catch (e) {
    ergebnis = String(e);
  }
  gleich(ergebnis, [[null, null], ['function', 'function'], 0], 'SD Quelle ohne window: Abfrage null, Ereignis gibt eine Abmeldung und meldet nichts');
}

// ── Quellen mit Preload-Attrappe (window nur im Test gesetzt) ──
{
  const g = globalThis as unknown as { window?: unknown };
  const log: string[] = [];
  let ausCb: ((z: AusgabeZustand) => void) | undefined;
  g.window = {
    jmstage: {
      masterLink: async () => ({ art: 'aus' }),
      onMasterLink: () => () => void log.push('ab masterLink'),
      output: {
        zustand: async () => offenerSchirm({ displayId: 3 }),
        onZustand: (cb: (z: AusgabeZustand) => void) => {
          ausCb = cb;
          return () => void log.push('ab ausgabe');
        },
      },
    },
  };
  try {
    gleich(await MASTER_LINK_QUELLE.abfrage(), { art: 'aus' }, 'SD Quelle mit Preload: MASTER_LINK_QUELLE liest jmstage.masterLink');
    MASTER_LINK_QUELLE.ereignis(() => {})();
    gleich(log, ['ab masterLink'], 'SD Quelle mit Preload: die Abmeldung geht an jmstage.onMasterLink');
    gleich(await AUSGABE_QUELLE.abfrage(), { art: 'offen', displayId: 3 }, 'SD Quelle mit Preload: AUSGABE_QUELLE liest jmstage.output.zustand');
    const aus: unknown[] = [];
    const abAus = AUSGABE_QUELLE.ereignis((z) => void aus.push(z));
    ausCb?.({ art: 'abgestuerzt', displayId: 3 });
    abAus();
    gleich([aus, log], [[{ art: 'abgestuerzt', displayId: 3 }], ['ab masterLink', 'ab ausgabe']], 'SD Quelle mit Preload: AUSGABE_QUELLE hängt an jmstage.output.onZustand samt Abmeldung');
  } finally {
    delete g.window;
  }
  // Preload vorhanden, aber ohne die neuen Funktionen (älterer Preload): null und kein Wurf.
  g.window = { jmstage: { output: {} } };
  try {
    gleich([await AUSGABE_QUELLE.abfrage(), await MASTER_LINK_QUELLE.abfrage(), typeof AUSGABE_QUELLE.ereignis(() => {})], [null, null, 'function'], 'SD Quelle ohne window: Preload ohne die neuen Funktionen → null und Abmeldung statt Wurf');
  } finally {
    delete g.window;
  }
}

// ── Quelltext-Wächter ──
{
  const preload = leseText('src/preload/index.ts');
  const main = leseText('src/main/index.ts');
  const typen = leseText('src/shared/types.ts');
  const vorkommen = (t: string, kanal: string): number => t.split("'" + kanal + "'").length - 1;

  // SD Wächter Kanäle
  const kanaele = [...preload.matchAll(/'(jmps:master[^']*)'/g)].map((m) => m[1]);
  ok(kanaele.length === 3 && kanaele.every((k) => k === 'jmps:master-link'), 'SD Wächter Kanäle: Preload nennt den Kanal dreimal wörtlich jmps:master-link (invoke, on, off)');
  ok(
    preload.includes("  masterLink: () => (ipcRenderer.invoke('jmps:master-link') as Promise<MasterLinkMeldung>).catch(() => null),\n") &&
      preload.includes("    ipcRenderer.on('jmps:master-link', listener);\n    return () => ipcRenderer.off('jmps:master-link', listener);\n"),
    'SD Wächter Kanäle: Abfrage fängt jede Ablehnung zu null ab, Ereignis mit Abmeldung',
  );
  ok(
    /^import type \{ MasterLinkMeldung \} from '@jm\/app-runtime';$/m.test(preload) && !/^import \{[^}]*\} from '@jm\/app-runtime'/m.test(preload),
    'SD Wächter Kanäle: aus app-runtime nur der Typ (kein Main-Code im Sandbox-Preload)',
  );
  ok(
    /^import type \{ AusgabeZustand \} from '@jm\/output-window\/zustand';$/m.test(preload) && !/from '@jm\/output-window'/.test(preload),
    'SD Wächter Kanäle: aus output-window nur der reine Typ aus /zustand (kein electron im Preload-Import)',
  );
  ok(
    typen.includes('export type MasterLinkMeldungZeile =') &&
      typen.includes('masterLink: () => Promise<MasterLinkMeldungZeile | null>;') &&
      typen.includes('onMasterLink: (cb: (m: MasterLinkMeldungZeile) => void) => () => void;'),
    'SD Wächter Kanäle: window.jmstage hat masterLink und onMasterLink mit MasterLinkMeldungZeile',
  );
  ok(
    vorkommen(preload, 'output:zustand') === 3 && vorkommen(main, 'output:zustand') === 2,
    'SD Wächter Kanäle: output:zustand steht in Preload (invoke, on, off) und Main (handle, send) gleich',
  );
  ok(
    preload.includes("zustand: () => (ipcRenderer.invoke('output:zustand') as Promise<AusgabeZustand | null>).catch(() => null),") &&
      typen.includes('zustand: () => Promise<AusgabeZustand | null>;') &&
      typen.includes('onZustand: (cb: (z: AusgabeZustand) => void) => () => void;'),
    'SD Wächter Kanäle: output.zustand fängt jede Ablehnung zu null ab, output.onZustand ist typisiert',
  );
  ok(
    main.includes("ipcMain.handle('output:zustand', () => output.zustand());") &&
      main.includes('output.onZustand((z) => {') &&
      main.includes("mainWindow.webContents.send('output:zustand', z);"),
    'SD Wächter Kanäle: Main antwortet mit output.zustand() und schickt jede Änderung an das Hauptfenster (nicht an alle)',
  );
  const von = main.indexOf('initAppRuntime({');
  const runtime = main.slice(von, main.indexOf('});', von));
  ok(von >= 0 && !/masterLink\s*:\s*false/.test(runtime), 'SD Wächter Kanäle: initAppRuntime registriert jmps:master-link (Option masterLink:false fehlt)');

  // SD Wächter keine Fernsteuerung
  ok(!existsSync('src/main/control-server.ts'), 'SD Wächter keine Fernsteuerung: es gibt keinen src/main/control-server.ts');
  ok(!preload.includes('stage:fernsteuerung') && !main.includes('stage:fernsteuerung'), 'SD Wächter keine Fernsteuerung: kein Kanal stage:fernsteuerung in Preload oder Main');
  ok(!existsSync('src/shared/fernsteuerung.ts'), 'SD Wächter keine Fernsteuerung: es gibt keine shared/fernsteuerung.ts');
}
