// Aufnahme-Ablauf (#291) mit Attrappe statt @jm/audio: Überschreibschutz beim Start, Folgedateien
// im Stopp-Ergebnis, und shutdown() (Fenster zu) schließt eine laufende Aufnahme ordentlich ab —
// vorher blieb der Kopf auf Länge 0. npm run selftest -w @jm/recorder
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}

// recorder.ts lädt das Addon per freiem `require('@jm/audio')`; in ESM greift das auf globalThis.
type Frames = (planar: Float32Array, channels: number, frames: number) => void;
let aufFrames: Frames | null = null;
let gestoppt = 0;
const attrappe = {
  init: () => {},
  listDevices: () => [
    { index: 0, name: 'Mikrofon (Realtek)', hostApiName: 'WASAPI', maxInputChannels: 2, defaultSampleRate: 48000 },
    { index: 5, name: 'Lautsprecher (Realtek) [Loopback]', hostApiName: 'WASAPI', maxInputChannels: 2, defaultSampleRate: 48000 },
  ],
  openInput: (_o: unknown, cb: Frames) => { aufFrames = cb; },
  stopInput: () => { gestoppt++; aufFrames = null; },
};
(globalThis as unknown as { require: (id: string) => unknown }).require = (id: string) => {
  if (id === '@jm/audio') return attrappe;
  throw new Error(`unerwartetes require: ${id}`);
};

const rec = await import('../src/main/recorder');
const dir = mkdtempSync(join(tmpdir(), 'jmrec-rec-'));
const dataLaenge = (p: string): number => readFileSync(p).readUInt32LE(40);

// --- Überschreibschutz: vorhandene Tag.wav bleibt unberührt, Aufnahme läuft als Tag-2.wav.
writeFileSync(join(dir, 'Tag.wav'), 'VORTAG');
ck('arm ok', rec.arm({ device: 0, channels: 2, sampleRate: 48000 }).ok);
ck('start ok', rec.startRecording({ dir, fileName: 'Tag' }).ok);
ck('läuft als Tag-2.wav', rec.getState().filePath === join(dir, 'Tag-2.wav'));
aufFrames!(new Float32Array(2 * 4), 2, 4);
const r = rec.stopRecording();
ck('Vortags-Datei unverändert', readFileSync(join(dir, 'Tag.wav'), 'utf8') === 'VORTAG');
ck('Stopp meldet Tag-2.wav', r.ok && r.filePath === join(dir, 'Tag-2.wav'));
ck('Stopp nennt die Dateien', JSON.stringify(r.files) === JSON.stringify([join(dir, 'Tag-2.wav')]));

// --- shutdown während der Aufnahme: Kopf trägt die echte Länge, Eingang ist zu.
ck('start 2 ok', rec.startRecording({ dir, fileName: 'Abbruch' }).ok);
aufFrames!(new Float32Array(2 * 10), 2, 10);
const vorher = gestoppt;
rec.shutdown();
ck('shutdown: Kopf trägt 10 Frames × 8 Byte', dataLaenge(join(dir, 'Abbruch.wav')) === 80);
ck('shutdown: Eingang geschlossen', gestoppt > vorher);
ck('shutdown: Zustand idle', rec.getState().status === 'idle');

// --- Loopback (Windows liefert in Stille KEINE Blöcke): Lücke wird als echte Stille aufgefüllt.
const warte = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
async function luecke(device: number, name: string): Promise<number> {
  ck(`arm ${name}`, rec.arm({ device, channels: 2, sampleRate: 1000 }).ok);
  ck(`start ${name}`, rec.startRecording({ dir, fileName: name }).ok);
  aufFrames!(new Float32Array(2 * 10), 2, 10);
  await warte(700);
  aufFrames!(new Float32Array(2 * 10), 2, 10);
  const res = rec.stopRecording();
  ck(`stopp ${name}`, res.ok);
  rec.disarm();
  return dataLaenge(join(dir, `${name}.wav`)) / 8;
}
const loopFrames = await luecke(5, 'Loop');
ck(`Loopback: 700 ms Pause gefüllt (${loopFrames} Frames)`, loopFrames >= 650 && loopFrames <= 800);
const mikFrames = await luecke(0, 'Mik');
ck(`Nicht-Loopback: genau 20 Frames (${mikFrames})`, mikFrames === 20);

console.log(`\nrecorder: ${pass} ok, ${fail} FAIL`);
if (fail) process.exit(1);
