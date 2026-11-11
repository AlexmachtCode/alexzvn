// WAV-Writer (#291): über die 4-GB-Grenze einer Standard-WAV hinaus beginnt der Recorder eine
// Folgedatei (Name_002.wav, Name_003.wav …), statt beim Stopp an writeUInt32LE zu scheitern.
// Grenze im Test klein gestellt; MAX_DATA_BYTES selbst wird einzeln geprüft.
// npm run selftest -w @jm/recorder
import { existsSync, mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MAX_DATA_BYTES, MultiWavWriter, WavWriter } from '../src/main/wav';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}

const wurzel = mkdtempSync(join(tmpdir(), 'jmrec-wav-'));

/** Kopf lesen: RIFF-Größe, Kanäle, data-Größe, und die Float-Werte dahinter. */
function lies(p: string): { riff: number; ch: number; data: number; werte: number[] } {
  const b = readFileSync(p);
  const data = b.readUInt32LE(40);
  const werte: number[] = [];
  for (let o = 44; o < 44 + data; o += 4) werte.push(b.readFloatLE(o));
  return { riff: b.readUInt32LE(4), ch: b.readUInt16LE(22), data, werte };
}

/** planar [ch0:frames][ch1:frames]; Wert = Frame*10 + Kanal, damit Reihenfolge prüfbar ist. */
function block(channels: number, frames: number, start: number): Float32Array {
  const a = new Float32Array(channels * frames);
  for (let c = 0; c < channels; c++) for (let i = 0; i < frames; i++) a[c * frames + i] = (start + i) * 10 + c;
  return a;
}

// --- Grenze selbst: Kopf (36 + data) muss in ein vorzeichenloses 32-Bit-Feld passen.
ck('MAX_DATA_BYTES passt mit Kopf in 32 Bit', MAX_DATA_BYTES + 36 <= 0xffffffff);
ck('MAX_DATA_BYTES liegt nah an 4 GB (> 4 000 000 000)', MAX_DATA_BYTES > 4_000_000_000);

// --- Unter der Grenze: genau eine Datei, wie bisher.
{
  const p = join(wurzel, 'klein.wav');
  const w = new WavWriter(p, 2, 48000, 40);
  w.writeBlock(block(2, 3, 0), 2, 3);
  const r = w.finalize();
  const k = lies(p);
  ck('klein: data = 3 Frames × 8 Byte', k.data === 24);
  ck('klein: RIFF = 36 + data', k.riff === 60);
  ck('klein: keine Folgedatei', !existsSync(join(wurzel, 'klein_002.wav')));
  ck('klein: files = [klein.wav]', r.files.length === 1 && r.files[0] === p);
}

// --- Über der Grenze: 12 Frames Stereo bei 40 Byte (5 Frames) je Datei → 5 + 5 + 2.
{
  const p = join(wurzel, 'lang.wav');
  const w = new WavWriter(p, 2, 1000, 40);
  w.writeBlock(block(2, 12, 0), 2, 12);
  const r = w.finalize();
  const teile = [p, join(wurzel, 'lang_002.wav'), join(wurzel, 'lang_003.wav')];
  ck('lang: drei Dateien', teile.every((t) => existsSync(t)) && !existsSync(join(wurzel, 'lang_004.wav')));
  ck('lang: files in Reihenfolge', JSON.stringify(r.files) === JSON.stringify(teile));
  const k = teile.map(lies);
  ck('lang: data-Größen 40/40/16', k[0].data === 40 && k[1].data === 40 && k[2].data === 16);
  ck('lang: jede RIFF-Größe = 36 + data', k.every((x) => x.riff === 36 + x.data));
  ck('lang: Folgedateien behalten 2 Kanäle', k.every((x) => x.ch === 2));
  const alle = k.flatMap((x) => x.werte);
  const erwartet: number[] = [];
  for (let i = 0; i < 12; i++) erwartet.push(i * 10, i * 10 + 1);
  ck('lang: Samples lückenlos und interleaved über alle Dateien', JSON.stringify(alle) === JSON.stringify(erwartet));
  ck('lang: Dauer zählt alle Dateien (12 Frames / 1000 Hz)', Math.abs(r.durationSec - 0.012) < 1e-9);
  const summe = teile.reduce((s, t) => s + statSync(t).size, 0);
  ck('lang: bytes = Summe der Dateigrößen', r.bytes === summe);
}

// --- Grenze kein Vielfaches eines Frames: 44 Byte bei 8 Byte/Frame → 5 Frames (40 Byte), nie ein halber Frame.
{
  const p = join(wurzel, 'krumm.wav');
  const w = new WavWriter(p, 2, 48000, 44);
  w.writeBlock(block(2, 6, 0), 2, 6);
  w.finalize();
  ck('krumm: erste Datei endet auf Frame-Grenze', lies(p).data === 40);
  ck('krumm: Rest in Folgedatei', lies(join(wurzel, 'krumm_002.wav')).data === 8);
}

// --- Genau an der Grenze: keine leere Folgedatei.
{
  const p = join(wurzel, 'genau.wav');
  const w = new WavWriter(p, 2, 48000, 40);
  w.writeBlock(block(2, 5, 0), 2, 5);
  const r = w.finalize();
  ck('genau: keine leere Folgedatei', !existsSync(join(wurzel, 'genau_002.wav')) && r.files.length === 1);
}

// --- Mehrere Blöcke über die Grenze hinweg.
{
  const p = join(wurzel, 'bloecke.wav');
  const w = new WavWriter(p, 1, 1000, 12); // 3 Frames Mono je Datei
  w.writeBlock(block(1, 2, 0), 1, 2);
  w.writeBlock(block(1, 2, 2), 1, 2);
  w.writeBlock(block(1, 3, 4), 1, 3);
  w.finalize();
  const alle = [p, join(wurzel, 'bloecke_002.wav'), join(wurzel, 'bloecke_003.wav')].map(lies).flatMap((x) => x.werte);
  ck('bloecke: 7 Frames über drei Dateien in Reihenfolge', JSON.stringify(alle) === JSON.stringify([0, 10, 20, 30, 40, 50, 60]));
}

// --- Einzelspuren teilen genauso: Name-Spur01.wav → Name-Spur01_002.wav.
{
  const w = new MultiWavWriter(wurzel, 'multi', 2, 48000, 8); // 2 Frames Mono je Datei
  w.writeBlock(block(2, 3, 0), 2, 3);
  w.finalize();
  ck('multi: Spur01 + Folgedatei', existsSync(join(wurzel, 'multi-Spur01.wav')) && existsSync(join(wurzel, 'multi-Spur01_002.wav')));
  ck('multi: Spur02-Folgedatei trägt Kanal 2', JSON.stringify(lies(join(wurzel, 'multi-Spur02_002.wav')).werte) === JSON.stringify([21]));
}

console.log(`\nwav: ${pass} ok, ${fail} FAIL`);
if (fail) process.exit(1);
