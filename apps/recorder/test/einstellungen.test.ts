// Gemerkte Einstellungen (#291): Prüfen der gelesenen Datei, Wiederfinden des Eingangs über den
// Namen (die PortAudio-Nummer verschiebt sich), Lesen/Schreiben der Datei. npm run selftest -w @jm/recorder
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findeEingang, normiereEinstellungen } from '../src/shared/einstellungen';
import { ladeEinstellungen, speichereEinstellungen } from '../src/main/einstellungen';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}
const gleich = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

// --- normiereEinstellungen
ck('Unsinn → leer', gleich(normiereEinstellungen('x'), {}) && gleich(normiereEinstellungen(null), {}));
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
ck('gültige Werte bleiben erhalten', gleich(normiereEinstellungen(voll), voll));
ck('falsche Typen fallen weg', gleich(
  normiereEinstellungen({ eingang: { name: 3 }, channels: 'acht', sampleRate: null, dir: '', fileName: 7, separateTracks: 'ja', gainDb: 'laut' }),
  {},
));
ck('Verstärkung auf −12…24 dB geklemmt', normiereEinstellungen({ gainDb: 99 }).gainDb === 24 && normiereEinstellungen({ gainDb: -99 }).gainDb === -12);
ck('Kanäle mindestens 1, ganzzahlig', normiereEinstellungen({ channels: 0 }).channels === 1 && normiereEinstellungen({ channels: 2.7 }).channels === 2);
ck('Samplerate außerhalb 8000…384000 fällt weg', normiereEinstellungen({ sampleRate: 100 }).sampleRate === undefined);
ck('Dauer nie negativ', normiereEinstellungen({ scheduleDurationMin: -5 }).scheduleDurationMin === 0);
ck('leerer Dateiname bleibt (= Zeitstempel)', normiereEinstellungen({ fileName: '' }).fileName === '');

// --- findeEingang: Name UND Treiber müssen stimmen, die Nummer ist egal.
const geraete = [
  { index: 0, name: 'Mikrofon (Realtek)', hostApiName: 'MME', maxInputChannels: 2, defaultSampleRate: 44100 },
  { index: 7, name: 'Dante Virtual Soundcard (x64)', hostApiName: 'ASIO', maxInputChannels: 64, defaultSampleRate: 48000 },
  { index: 9, name: 'Mikrofon (Realtek)', hostApiName: 'Windows WASAPI', maxInputChannels: 2, defaultSampleRate: 48000 },
];
ck('findet über Name + Treiber, egal welche Nummer', findeEingang(geraete, voll.eingang)?.index === 7);
ck('gleicher Name, anderer Treiber → der richtige', findeEingang(geraete, { name: 'Mikrofon (Realtek)', hostApiName: 'Windows WASAPI' })?.index === 9);
ck('fehlt → null', findeEingang(geraete, { name: 'Focusrite USB', hostApiName: 'ASIO' }) === null);

// --- Datei lesen/schreiben
const wurzel = mkdtempSync(join(tmpdir(), 'jmrec-set-'));
const datei = join(wurzel, 'unter', 'recorder-settings.json');
ck('keine Datei → leer', gleich(ladeEinstellungen(datei), {}));
speichereEinstellungen(datei, { ...voll, fremd: 'weg' });
ck('Rundreise: gespeichert = gelesen', gleich(ladeEinstellungen(datei), voll));
ck('fremde Felder werden nicht gespeichert', !readFileSync(datei, 'utf8').includes('fremd'));
ck('keine Zwischendatei liegen geblieben', !existsSync(`${datei}.tmp`));
writeFileSync(datei, '{kaputt');
ck('kaputte Datei → leer statt Absturz', gleich(ladeEinstellungen(datei), {}));

console.log(`\neinstellungen: ${pass} ok, ${fail} FAIL`);
if (fail) process.exit(1);
