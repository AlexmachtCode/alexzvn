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
// Wächtertakte zählen: recorder.ts startet den Wächter über das globale setInterval.
let takte = 0;
const echtesSetInterval = globalThis.setInterval;
(globalThis as unknown as { setInterval: (fn: () => void, ms?: number) => unknown }).setInterval = (fn, ms) =>
  echtesSetInterval(() => { takte++; fn(); }, ms);

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
async function luecke(device: number, name: string): Promise<{ frames: number; ms: number }> {
  ck(`arm ${name}`, rec.arm({ device, channels: 2, sampleRate: 1000 }).ok);
  const t0 = Date.now();
  ck(`start ${name}`, rec.startRecording({ dir, fileName: name }).ok);
  aufFrames!(new Float32Array(2 * 10), 2, 10);
  await warte(700);
  aufFrames!(new Float32Array(2 * 10), 2, 10);
  const res = rec.stopRecording();
  const ms = Date.now() - t0;
  ck(`stopp ${name}`, res.ok);
  rec.disarm();
  return { frames: dataLaenge(join(dir, `${name}.wav`)) / 8, ms };
}
// Länge gegen die GEMESSENE Zeit von Start bis Stopp (bei 1000 Hz: 1 Frame je ms).
const loop = await luecke(5, 'Loop');
ck(`Loopback: Pause gefüllt (${loop.frames} Frames, gemessen ${loop.ms} ms)`, Math.abs(loop.frames - loop.ms) <= 80);
const mik = await luecke(0, 'Mik');
ck(`Nicht-Loopback: genau 20 Frames (${mik.frames})`, mik.frames === 20);

// --- Stau im Hauptprozess (I1): hängt die Ereignisschleife 400 ms, kommen die gepufferten Blöcke
// danach auf einen Schlag. Das ist keine Stille — zwischen den echten Blöcken darf keine Null stehen.
const haengen = (ms: number): void => {
  const bis = Date.now() + ms;
  while (Date.now() < bis) { /* Hauptprozess hängt, kein Wächter */ }
};
const echt = (n: number): Float32Array => new Float32Array(2 * n).fill(0.5);
async function stau(name: string, waechterZuerst: boolean): Promise<Float32Array> {
  ck(`arm ${name}`, rec.arm({ device: 5, channels: 2, sampleRate: 1000 }).ok);
  ck(`start ${name}`, rec.startRecording({ dir, fileName: name }).ok);
  aufFrames!(echt(10), 2, 10);
  haengen(400);
  if (waechterZuerst) {
    // Ein Wächtertakt läuft VOR den Blöcken (ohne echte Wartezeit — die wäre wieder Stille).
    const vor = takte;
    for (let i = 0; takte === vor && i < 1000; i++) await new Promise((r) => setImmediate(r));
    ck(`${name}: Wächter lief vor den Blöcken`, takte > vor);
  }
  for (let i = 0; i < 40; i++) aufFrames!(echt(10), 2, 10);
  ck(`stopp ${name}`, rec.stopRecording().ok);
  rec.disarm();
  const b = readFileSync(join(dir, `${name}.wav`));
  return new Float32Array(b.buffer.slice(b.byteOffset + 44, b.byteOffset + b.length));
}
function nullenZwischen(s: Float32Array): number {
  const a = s.findIndex((v) => v !== 0);
  let e = s.length - 1;
  while (e >= 0 && s[e] === 0) e--;
  let n = 0;
  for (let i = a; i <= e; i++) if (s[i] === 0) n++;
  return n;
}
for (const [name, zuerst] of [['StauBloecke', false], ['StauWaechter', true]] as const) {
  const s = await stau(name, zuerst);
  ck(`${name}: keine Null zwischen den echten Blöcken (${nullenZwischen(s)})`, s.length > 0 && nullenZwischen(s) === 0);
  ck(`${name}: genau 41 Blöcke, nichts eingeschoben (${s.length / 2} Frames)`, s.length === 2 * 410);
}

// --- Alte Bestätigung (Review): Wächter bestätigt echte Stille, dann hängt der Hauptprozess 400 ms,
// danach kommt echtes Audio VOR dem nächsten Wächtertakt. Der Stau darf nicht als Stille davor stehen.
{
  ck('arm Alt', rec.arm({ device: 5, channels: 2, sampleRate: 1000 }).ok);
  ck('start Alt', rec.startRecording({ dir, fileName: 'Alt' }).ok);
  const t0 = Date.now();
  await warte(450); // echte Stille, der Wächter füllt auf
  haengen(400);
  const stilleMs = Date.now() - t0 - 400; // gemessene Stille vor dem Stau (ohne die 400 ms)
  for (let i = 0; i < 40; i++) aufFrames!(echt(10), 2, 10);
  ck('stopp Alt', rec.stopRecording().ok);
  rec.disarm();
  const b = readFileSync(join(dir, 'Alt.wav'));
  const s = new Float32Array(b.buffer.slice(b.byteOffset + 44, b.byteOffset + b.length));
  const erster = s.findIndex((v) => v !== 0) / 2;
  ck(`Alt: erster echter Frame bei ${erster} ≈ Stille ${stilleMs} ms (nicht danach)`, erster >= stilleMs - 150 && erster <= stilleMs + 20);
}

// --- Altfehler RE-2 (Plan 2026-11-26, Task 6; B6): arm in der Aufnahme lehnt ab, statt den Eingang zu schließen und neu zu öffnen
// (ein ARM kurz nach RECORD ON darf keine Aufnahme beenden). Die Aufnahme läuft weiter und behält alle Frames.
{
  ck('RE-2 arm', rec.arm({ device: 0, channels: 2, sampleRate: 48000 }).ok);
  ck('RE-2 start', rec.startRecording({ dir, fileName: 'Wache' }).ok);
  aufFrames!(new Float32Array(2 * 10), 2, 10);
  const vor = gestoppt;
  const r = rec.arm({ device: 0, channels: 2, sampleRate: 48000 });
  ck(`RE-2 arm in der Aufnahme abgelehnt: ok false, Grund „Erst die Aufnahme stoppen.“ (${JSON.stringify(r)})`, r.ok === false && r.error === 'Erst die Aufnahme stoppen.');
  ck('RE-2 arm in der Aufnahme abgelehnt: Status bleibt recording, der Eingang wurde nicht geschlossen', rec.getState().status === 'recording' && gestoppt === vor);
  aufFrames!(new Float32Array(2 * 10), 2, 10);
  const stopp = rec.stopRecording();
  ck('RE-2 arm in der Aufnahme abgelehnt: der Stopp danach schließt ab', stopp.ok);
  ck(`RE-2 arm in der Aufnahme abgelehnt: der Kopf trägt beide Blöcke (20 Frames × 8 Byte = ${dataLaenge(join(dir, 'Wache.wav'))})`, dataLaenge(join(dir, 'Wache.wav')) === 160);
  rec.disarm();
}
{
  const schliesse = (rec as unknown as { schliesseEingang?: () => { ok: boolean; error?: string } }).schliesseEingang;
  ck('RE-2 schliesseEingang gibt es', typeof schliesse === 'function');
  ck('RE-2 schliesseEingang: arm', rec.arm({ device: 0, channels: 2, sampleRate: 48000 }).ok);
  ck('RE-2 schliesseEingang: start', rec.startRecording({ dir, fileName: 'Wache2' }).ok);
  aufFrames!(new Float32Array(2 * 10), 2, 10);
  const vor = gestoppt;
  const r = schliesse?.();
  ck(
    `RE-2 schliesseEingang in der Aufnahme abgelehnt (${JSON.stringify(r)})`,
    r?.ok === false && r.error === 'Erst die Aufnahme stoppen.' && rec.getState().status === 'recording' && gestoppt === vor,
  );
  // Ohne `!`: hätte schliesseEingang den Eingang doch geschlossen, gibt es keine Block-Funktion mehr, und die Prüfung unten zeigt es.
  aufFrames?.(new Float32Array(2 * 10), 2, 10);
  ck('RE-2 schliesseEingang: Stopp', rec.stopRecording().ok);
  ck(`RE-2 schliesseEingang abgelehnt: die Aufnahme lief weiter, der Kopf trägt beide Blöcke (${dataLaenge(join(dir, 'Wache2.wav'))})`, dataLaenge(join(dir, 'Wache2.wav')) === 160);
  const r2 = schliesse?.();
  ck(`RE-2 schliesseEingang bei armed ok: Eingang zu (${JSON.stringify(r2)})`, r2?.ok === true && rec.getState().status === 'idle' && gestoppt > vor);
  if (rec.getState().status !== 'idle') rec.disarm();
}

console.log(`\nrecorder: ${pass} ok, ${fail} FAIL`);
if (fail) process.exit(1);
