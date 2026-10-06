// Zoom-Einstellungen: ein gescheitertes Schreiben darf die Anzeige nicht belügen (Fix-Runde 1, Aufgabe 16).
// settings.ts braucht Electron und das Log; beides wird per Modul-Hook durch Attrappen ersetzt. npm run selftest -w @jm/connect
import { registerHooks } from 'node:module';
import { chmodSync, mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
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

// SDK-Schlüssel (Spec SDK nachladen 4.2): Umgebung > gespeichert > Sitzung, nie im Klartext auf der Platte
const datei = (): string => readFileSync(join(wurzel, 'connect-settings.json'), 'utf8');
g.__mock.verschluesselung = true;
g.__mock.userData = wurzel;
// Unabhängig von der Umgebung des Testlaufs: Eine gesetzte Variable hätte Vorrang (Gesamtprüfung: Task 3 minor 2).
delete process.env.JMPS_ZOOM_SDK_KEY;
const leer = s.zoomSdkSchluesselLesen();
ck('SDK: anfangs fehlt der Schlüssel', leer.herkunft === 'none' && leer.wert === null);
ck('SDK: Speichern mit Schlüsselbund → stored', s.zoomSdkSchluesselSpeichern('sdk-geheim-test') === 'stored');
ck('SDK: verschlüsselt in der Datei, nie im Klartext', datei().includes('zoomSdkKeyEnc') && !datei().includes('sdk-geheim-test'));
const gespeichert = s.zoomSdkSchluesselLesen();
ck('SDK: Lesen → stored mit Wert', gespeichert.herkunft === 'stored' && gespeichert.wert === 'sdk-geheim-test');
process.env.JMPS_ZOOM_SDK_KEY = '  sdk-test  ';
const umgebung = s.zoomSdkSchluesselLesen();
ck('SDK: Umgebung JMPS_ZOOM_SDK_KEY hat Vorrang, getrimmt', umgebung.herkunft === 'env' && umgebung.wert === 'sdk-test');
delete process.env.JMPS_ZOOM_SDK_KEY;
// Datei lesbar, aber schreibgeschützt: der alte Wert steht noch auf der Platte, der neue kommt nicht hin.
chmodSync(join(wurzel, 'connect-settings.json'), 0o444);
ck('SDK: Schreiben scheitert → session statt stored', s.zoomSdkSchluesselSpeichern('sdk-test') === 'session');
const sitzung = s.zoomSdkSchluesselLesen();
ck('SDK: … der neue Wert gilt für die Sitzung, nicht der alte von der Platte', sitzung.herkunft === 'session' && sitzung.wert === 'sdk-test');
chmodSync(join(wurzel, 'connect-settings.json'), 0o644);
s.zoomSdkSchluesselLoeschen();
ck('SDK: Entfernen → fehlt, Feld aus der Datei', s.zoomSdkSchluesselLesen().herkunft === 'none' && !datei().includes('zoomSdkKeyEnc'));
g.__mock.verschluesselung = false;
ck('SDK: ohne Schlüsselbund → session', s.zoomSdkSchluesselSpeichern('sdk-test') === 'session' && s.zoomSdkSchluesselLesen().herkunft === 'session');
ck('SDK: … nichts davon auf der Platte', !datei().includes('zoomSdkKeyEnc') && !datei().includes('sdk-test'));

// Entfernen und Speichern, wenn die Datei nicht schreibbar ist (Gesamtprüfung: Task 3 minor 1 und 3, Task 4 minor 1):
// Für diese Sitzung ist der Wert weg, auf der Platte steht er noch. Das meldet `false`, damit der Kern es sagen kann.
const schreibschutz = (an: boolean): void => chmodSync(join(wurzel, 'connect-settings.json'), an ? 0o444 : 0o644);
g.__mock.verschluesselung = true;
ck('SDK: Vorbereitung: gespeichert', s.zoomSdkSchluesselSpeichern('sdk-geheim-test') === 'stored');
schreibschutz(true);
ck('SDK: Entfernen bei schreibgeschützter Datei → false', s.zoomSdkSchluesselLoeschen() === false);
ck('SDK: … für diese Sitzung weg, auf der Platte noch da', s.zoomSdkSchluesselLesen().herkunft === 'none' && datei().includes('zoomSdkKeyEnc'));
g.__mock.verschluesselung = false;
ck('SDK: ohne Schlüsselbund, Datei schreibgeschützt → session (Zweig ohne Schlüsselbund, Schreiben scheitert)',
  s.zoomSdkSchluesselSpeichern('sdk-test') === 'session' && s.zoomSdkSchluesselLesen().wert === 'sdk-test');
ck('SDK: … nie im Klartext auf der Platte', !datei().includes('sdk-test'));
ck('SDK: … Entfernen → false, solange das alte Feld noch auf der Platte steht', s.zoomSdkSchluesselLoeschen() === false
  && s.zoomSdkSchluesselLesen().herkunft === 'none');
schreibschutz(false);
ck('SDK: Entfernen bei schreibbarer Datei → true, Feld weg', s.zoomSdkSchluesselLoeschen() === true && !datei().includes('zoomSdkKeyEnc'));
g.__mock.userData = kaputt;
s.zoomSdkSchluesselSpeichern('sdk-test');
ck('SDK: nur in der Sitzung und nichts auf der Platte → Entfernen → true, auch wenn das Schreiben scheitert',
  s.zoomSdkSchluesselLoeschen() === true && s.zoomSdkSchluesselLesen().herkunft === 'none');
g.__mock.userData = wurzel;
g.__mock.verschluesselung = true;
s.zoomZugangSpeichern(daten);
ck('Zugang: Vorbereitung: gespeichert', s.zoomZugangLesen().herkunft === 'stored' && datei().includes('zoomZugangEnc'));
schreibschutz(true);
ck('Zugang: Entfernen bei schreibgeschützter Datei → false', s.zoomZugangLoeschen() === false);
ck('Zugang: … für diese Sitzung weg, auf der Platte noch da', s.zoomZugangLesen().daten === null && datei().includes('zoomZugangEnc'));
schreibschutz(false);
ck('Zugang: Entfernen bei schreibbarer Datei → true, Feld weg', s.zoomZugangLoeschen() === true && !datei().includes('zoomZugangEnc'));

console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);
