// Zoom-Einstellungen: ein gescheitertes Schreiben darf die Anzeige nicht belügen (Fix-Runde 1, Aufgabe 16).
// settings.ts braucht Electron und das Log; beides wird per Modul-Hook durch Attrappen ersetzt. npm run selftest -w @jm/connect
import { registerHooks } from 'node:module';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const g = globalThis as unknown as { __mock: { userData: string; verschluesselung: boolean } };
const wurzel = mkdtempSync(join(tmpdir(), 'jmc-set-'));
const kaputt = join(wurzel, 'datei-statt-ordner');
writeFileSync(kaputt, 'x'); // darunter lässt sich nichts anlegen → jedes Schreiben scheitert
g.__mock = { userData: wurzel, verschluesselung: true };

const ELECTRON = `
export const app = { getPath: () => globalThis.__mock.userData };
export const safeStorage = {
  isEncryptionAvailable: () => globalThis.__mock.verschluesselung,
  encryptString: (s) => Buffer.from('E:' + s),
  decryptString: (b) => b.toString().slice(2),
};`;
const LOG = `const n = () => {}; export const getLog = () => ({ error: n, warn: n, info: n });`;
registerHooks({
  resolve(spec, ctx, next) {
    if (spec === 'electron') return { url: 'mock:electron', shortCircuit: true };
    if (spec === '@jm/app-runtime') return { url: 'mock:app-runtime', shortCircuit: true };
    return next(spec, ctx);
  },
  load(url, ctx, next) {
    if (url === 'mock:electron') return { format: 'module', source: ELECTRON, shortCircuit: true };
    if (url === 'mock:app-runtime') return { format: 'module', source: LOG, shortCircuit: true };
    return next(url, ctx);
  },
});

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}

const s = await import('../src/main/settings');
const daten = { clientId: 'ID-1234', clientSecret: 'geheim' };

// Schreiben klappt: wie bisher
g.__mock.userData = wurzel;
ck('Set: Schreiben ok → stored', s.zoomZugangSpeichern(daten) === 'stored');
ck('Set: Datei liegt da', existsSync(join(wurzel, 'connect-settings.json')) && readFileSync(join(wurzel, 'connect-settings.json'), 'utf8').includes('zoomZugangEnc'));
s.setzeZoomVersatzMs(120); s.setzeZoomAnzeigename('Alt');
ck('Set: Versatz/Name von Platte', s.zoomVersatzMs() === 120 && s.zoomAnzeigename() === 'Alt');

// Schreiben scheitert
g.__mock.userData = kaputt;
const neu = { clientId: 'ID-9999', clientSecret: 'neu' };
ck('Set: Schreiben scheitert → session statt stored', s.zoomZugangSpeichern(neu) === 'session');
const z = s.zoomZugangLesen();
ck('Set: Sitzungsdaten gelten, Herkunft session', z.herkunft === 'session' && z.daten?.clientId === 'ID-9999');
ck('Set: Grund schreibfehler (Schlüsselbund ist da, die Datei nicht)', z.grund === 'schreibfehler');
s.setzeZoomVersatzMs(300);
ck('Set: Versatz nach gescheitertem Schreiben = neuer Wert', s.zoomVersatzMs() === 300);
s.setzeZoomAnzeigename('Neu');
ck('Set: Name nach gescheitertem Schreiben = neuer Wert', s.zoomAnzeigename() === 'Neu');

// Platte wieder da: Schreiben gelingt, Platte ist maßgeblich
g.__mock.userData = wurzel;
s.zoomZugangSpeichern(daten);
ck('Set: erfolgreich gespeichert → kein Grund mehr', s.zoomZugangLesen().herkunft === 'stored' && s.zoomZugangLesen().grund === undefined);
s.setzeZoomVersatzMs(50); s.setzeZoomAnzeigename('Platte');
ck('Set: Schreiben ok → Platte gilt', s.zoomVersatzMs() === 50 && s.zoomAnzeigename() === 'Platte');

// Ohne Schlüsselbund: Sitzung ohne Grund (A4 bleibt wörtlich richtig)
g.__mock.verschluesselung = false;
s.zoomZugangSpeichern(neu);
const o = s.zoomZugangLesen();
ck('Set: ohne Schlüsselbund → session, kein Grund', o.herkunft === 'session' && o.grund === undefined);

console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);
