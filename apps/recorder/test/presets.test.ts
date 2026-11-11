// Preset-Regeln: Normieren, Vergleichen, Namen, Zusammenführen, Dateiformat. npm run selftest -w @jm/recorder
import {
  baueExportDatei, fuehreZusammen, freierPresetName, gleicheWerte, istNetzwerkPfad, leseExportDatei,
  normierePreset, presetWerte, sortiere,
} from '../src/shared/presets';
import type { RecPreset } from '../src/shared/types';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}
const gleich = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
function wirft(f: () => unknown, teil: string): boolean {
  try { f(); return false; } catch (e) { return e instanceof Error && e.message.includes(teil); }
}

const voll = {
  eingang: { name: 'Dante Virtual Soundcard (x64)', hostApiName: 'ASIO' },
  channels: 16,
  sampleRate: 48000,
  dir: 'D:\\Aufnahmen',
  fileName: 'Plenum',
  separateTracks: true,
  gainDb: 6,
  scheduleDurationMin: 90,
};

// --- presetWerte
const pw = presetWerte({ ...voll, preset: 'X', gainDb: 999 });
ck('presetWerte: kein preset-Feld', !('preset' in pw));
ck('presetWerte: gainDb geklemmt', pw.gainDb === 24);

// --- normierePreset
ck('Name wird getrimmt', normierePreset({ name: '  Dante  ', werte: voll })?.name === 'Dante');
ck('leerer Name → null', normierePreset({ name: '', werte: voll }) === null && normierePreset({ name: '   ', werte: voll }) === null);
ck('Zahl als Name → null', normierePreset({ name: 5, werte: voll }) === null);
ck('Unsinn → null', normierePreset(null) === null && normierePreset('x') === null);
ck('langer Name auf 60 gekürzt', normierePreset({ name: 'x'.repeat(500), werte: voll })?.name.length === 60);
ck('ohne werte → leere Werte', gleich(normierePreset({ name: 'A' })?.werte, {}));
ck('werte ohne preset-Feld', !('preset' in (normierePreset({ name: 'A', werte: { ...voll, preset: 'Q' } })?.werte ?? {})));

// --- gleicheWerte
ck('gleich trotz anderer Schlüsselreihenfolge', gleicheWerte(voll, { gainDb: 6, scheduleDurationMin: 90, separateTracks: true, fileName: 'Plenum', dir: 'D:\\Aufnahmen', sampleRate: 48000, channels: 16, eingang: { hostApiName: 'ASIO', name: 'Dante Virtual Soundcard (x64)' } }));
ck('anderer sampleRate → ungleich', !gleicheWerte(voll, { ...voll, sampleRate: 44100 }));
ck('nur preset verschieden → gleich', gleicheWerte({ ...voll, preset: 'A' }, { ...voll, preset: 'B' }));

// --- freierPresetName
ck('A belegt → A (2)', freierPresetName('A', ['A']) === 'A (2)');
ck('A, A (2) belegt → A (3)', freierPresetName('A', ['A', 'A (2)']) === 'A (3)');
ck('B frei → B', freierPresetName('B', ['A']) === 'B');
ck('langer Name bleibt ≤ 60', freierPresetName('x'.repeat(60), ['x'.repeat(60)]).length <= 60);

// --- sortiere / fuehreZusammen
const A1 = { name: 'A', werte: { gainDb: 1 } };
const A2 = { name: 'A', werte: { gainDb: 2 } };
const B = { name: 'B', werte: { gainDb: 3 } };
const C = { name: 'C', werte: { gainDb: 4 } };
ck('sortiere nach Name', gleich(sortiere([C, A1, B]).map((p) => p.name), ['A', 'B', 'C']));
const orig = [C, A1];
sortiere(orig);
ck('sortiere verändert die Eingabe nicht', orig[0] === C);
const m1 = fuehreZusammen([A1, B], [A2, C], 'ueberschreiben');
ck('überschreiben: Namen', gleich(m1.liste.map((p) => p.name), ['A', 'B', 'C']));
ck('überschreiben: A hat Werte von A2', m1.liste[0].werte.gainDb === 2);
ck('überschreiben: hinzu 1, ersetzt 1', m1.hinzu === 1 && m1.ersetzt === 1);
const m2 = fuehreZusammen([A1], [A2], 'beide');
ck('beide: Namen', gleich(m2.liste.map((p) => p.name), ['A', 'A (2)']));
ck('beide: hinzu 1, ersetzt 0', m2.hinzu === 1 && m2.ersetzt === 0);

// --- Dateiformat
const rund = leseExportDatei(baueExportDatei([A1, B], new Date(0)));
ck('Rundreise', gleich(rund.presets, [A1, B]) && rund.uebersprungen === 0);
ck('Exportdatei trägt Zeitstempel', baueExportDatei([A1], new Date(0)).includes('1970-01-01T00:00:00.000Z'));
ck('kein JSON wirft', wirft(() => leseExportDatei('kein json'), 'keine Recorder-Preset-Datei'));
ck('fremdes Format wirft', wirft(() => leseExportDatei('{"format":"anders","version":1,"presets":[]}'), 'keine Recorder-Preset-Datei'));
ck('version 2 wirft', wirft(() => leseExportDatei('{"format":"jm-recorder-presets","version":2,"presets":[]}'), 'neueren Recorder-Version'));
ck('leere Liste wirft', wirft(() => leseExportDatei('{"format":"jm-recorder-presets","version":1,"presets":[]}'), 'keine gültigen Presets'));
ck('presets kein Array wirft', wirft(() => leseExportDatei('{"format":"jm-recorder-presets","version":1,"presets":5}'), 'keine Recorder-Preset-Datei'));
const gemischt = leseExportDatei(JSON.stringify({
  format: 'jm-recorder-presets', version: 1,
  presets: [A1, { name: '' }, { name: 'A', werte: { gainDb: 9 } }],
}));
ck('ungültig + doppelt übersprungen, erster gewinnt', gleich(gemischt.presets, [A1]) && gemischt.uebersprungen === 2);
const kaputt = leseExportDatei(JSON.stringify({
  format: 'jm-recorder-presets', version: 1,
  presets: [{ name: 'K', werte: { gainDb: 999, sampleRate: 'abc', channels: -3 } }],
}));
const kw = kaputt.presets[0].werte;
ck('Werte aus Datei werden normiert', kw.gainDb === 24 && kw.sampleRate === undefined && kw.channels === 1);

// --- höchstens 500 Presets je Datei
const datei = (n: number): string => JSON.stringify({
  format: 'jm-recorder-presets', version: 1, presets: Array.from({ length: n }, (_, i) => ({ name: `P${i}` })),
});
ck('501 Presets wirft', wirft(() => leseExportDatei(datei(501)), 'Die Datei enthält zu viele Presets (höchstens 500).'));
ck('500 Presets gehen', leseExportDatei(datei(500)).presets.length === 500);

// --- Netzwerkpfade (der Import nennt sie ausdrücklich)
ck('Netzwerkpfad: \\\\srv\\x', istNetzwerkPfad('\\\\srv\\x'));
ck('Netzwerkpfad: //srv/x', istNetzwerkPfad('//srv/x'));
ck('Netzwerkpfad: \\\\?\\UNC\\srv\\x', istNetzwerkPfad('\\\\?\\UNC\\srv\\x'));
ck('kein Netzwerkpfad: D:\\x', !istNetzwerkPfad('D:\\x'));
ck('kein Netzwerkpfad: \\x', !istNetzwerkPfad('\\x'));
ck('kein Netzwerkpfad: leer', !istNetzwerkPfad(''));

// Export-Grenze: dieselbe Obergrenze wie beim Import
const viele = Array.from({ length: 501 }, (_, i): RecPreset => ({ name: `P${i}`, werte: {} }));
ck('baueExportDatei: 501 Presets wirft', wirft(() => baueExportDatei(viele, new Date(0)), 'Zu viele Presets für eine Datei (höchstens 500).'));
ck('baueExportDatei: 500 Presets gehen', baueExportDatei(viele.slice(0, 500), new Date(0)).length > 0);

console.log(`\npresets: ${pass} ok, ${fail} FAIL`);
if (fail) process.exit(1);
