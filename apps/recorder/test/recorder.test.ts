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
  listDevices: () => [],
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

console.log(`\nrecorder: ${pass} ok, ${fail} FAIL`);
if (fail) process.exit(1);
