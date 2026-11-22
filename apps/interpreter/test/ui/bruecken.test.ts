// UX Welle 2a, Interpreter b · Brücke (Spec 3.9, 7.2): Quelle ohne und mit window, Quelltext-Wächter für Preload und Main.
// Der Interpreter hat keinen Steuerserver und damit keine Fernsteuerungs-Meldung. Kein Electron, kein window beim Import.
import { existsSync } from 'node:fs';
import { gleich, leseText, ok } from '@jm/ui/testhilfe';
import { MASTER_LINK_QUELLE } from '@/lib/bruecken';

// ── IN Quelle ohne window ──
{
  let ergebnis: unknown;
  try {
    const antwort = await MASTER_LINK_QUELLE.abfrage();
    let gemeldet = 0;
    const ab = MASTER_LINK_QUELLE.ereignis(() => void gemeldet++);
    ab();
    ergebnis = [antwort, typeof ab, gemeldet];
  } catch (e) {
    ergebnis = String(e);
  }
  gleich(ergebnis, [null, 'function', 0], 'IN Quelle ohne window: Abfrage null, Ereignis gibt eine Abmeldung und meldet nichts');
}

// ── Quelle mit Preload-Attrappe (window nur im Test gesetzt) ──
{
  const g = globalThis as unknown as { window?: unknown };
  const log: string[] = [];
  g.window = {
    jminterpreter: {
      masterLink: async () => ({ art: 'aus' }),
      onMasterLink: () => () => void log.push('ab masterLink'),
    },
  };
  try {
    gleich(await MASTER_LINK_QUELLE.abfrage(), { art: 'aus' }, 'IN Quelle mit Preload: MASTER_LINK_QUELLE liest jminterpreter.masterLink');
    MASTER_LINK_QUELLE.ereignis(() => {})();
    gleich(log, ['ab masterLink'], 'IN Quelle mit Preload: die Abmeldung geht an jminterpreter.onMasterLink');
  } finally {
    delete g.window;
  }
  // Älterer Preload ohne die neuen Funktionen: null und kein Wurf.
  g.window = { jminterpreter: {} };
  try {
    gleich([await MASTER_LINK_QUELLE.abfrage(), typeof MASTER_LINK_QUELLE.ereignis(() => {})], [null, 'function'], 'IN Quelle ohne window: Preload ohne die neuen Funktionen → null und Abmeldung statt Wurf');
  } finally {
    delete g.window;
  }
}

// ── Quelltext-Wächter ──
{
  const preload = leseText('src/preload/index.ts');
  const main = leseText('src/main/index.ts');
  const api = leseText('src/shared/api.ts');

  // IN Wächter Kanäle
  const kanaele = [...preload.matchAll(/'(jmps:master[^']*)'/g)].map((m) => m[1]);
  ok(kanaele.length === 3 && kanaele.every((k) => k === 'jmps:master-link'), 'IN Wächter Kanäle: Preload nennt den Kanal dreimal wörtlich jmps:master-link (invoke, on, off)');
  ok(
    preload.includes("  masterLink: () => (ipcRenderer.invoke('jmps:master-link') as Promise<MasterLinkMeldung>).catch(() => null),\n") &&
      preload.includes("    ipcRenderer.on('jmps:master-link', listener);\n    return () => ipcRenderer.off('jmps:master-link', listener);\n"),
    'IN Wächter Kanäle: Abfrage fängt jede Ablehnung zu null ab, Ereignis mit Abmeldung',
  );
  ok(
    /^import type \{ MasterLinkMeldung \} from '@jm\/app-runtime';$/m.test(preload) && !/^import \{[^}]*\} from '@jm\/app-runtime'/m.test(preload),
    'IN Wächter Kanäle: aus app-runtime nur der Typ (kein Main-Code im Sandbox-Preload)',
  );
  ok(
    api.includes('export type MasterLinkMeldungZeile =') &&
      api.includes('masterLink: () => Promise<MasterLinkMeldungZeile | null>;') &&
      api.includes('onMasterLink: (cb: (m: MasterLinkMeldungZeile) => void) => () => void;'),
    'IN Wächter Kanäle: window.jminterpreter hat masterLink und onMasterLink mit MasterLinkMeldungZeile',
  );
  ok(preload.includes("openCableDownload: () => ipcRenderer.invoke('cable:openDownload')"), 'IN Wächter Kanäle: der bisherige Kanal cable:openDownload bleibt unverändert');
  const von = main.indexOf('initAppRuntime({');
  const runtime = main.slice(von, main.indexOf('});', von));
  ok(von >= 0 && !/masterLink\s*:\s*false/.test(runtime), 'IN Wächter Kanäle: initAppRuntime registriert jmps:master-link (Option masterLink:false fehlt)');

  // IN Wächter keine Fernsteuerung
  ok(!existsSync('src/main/control-server.ts'), 'IN Wächter keine Fernsteuerung: es gibt keinen src/main/control-server.ts');
  ok(!existsSync('src/shared/fernsteuerung.ts'), 'IN Wächter keine Fernsteuerung: es gibt keine shared/fernsteuerung.ts');
  ok(!preload.includes('interpreter:fernsteuerung') && !main.includes('interpreter:fernsteuerung'), 'IN Wächter keine Fernsteuerung: kein Kanal interpreter:fernsteuerung in Preload oder Main');
  ok(!/fernsteuerung|startControlServer/i.test(preload + main + api), 'IN Wächter keine Fernsteuerung: weder Preload, Main noch API-Typ nennen eine Fernsteuerung');
}
