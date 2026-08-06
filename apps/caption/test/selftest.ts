// Selbsttest der reinen Audio-Helfer:
//   node --experimental-strip-types test/selftest.ts
import { floatToWav16, rms } from '../src/shared/wav.ts';

let failed = 0;
function eq(actual: unknown, expected: unknown, msg: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    failed++;
    console.error(`FAIL ${msg}\n  erwartet: ${e}\n  bekommen: ${a}`);
  } else {
    console.log(`ok   ${msg}`);
  }
}

// ── floatToWav16: Header + Größe ─────────────────────────────────────────────
const pcm = new Float32Array([0, 0.5, -0.5, 1, -1]);
const wav = floatToWav16(pcm, 16000);
const dv = new DataView(wav.buffer);
const str = (off: number, len: number): string =>
  String.fromCharCode(...Array.from({ length: len }, (_, i) => wav[off + i]));

eq(wav.length, 44 + pcm.length * 2, 'WAV-Länge = 44 + 2·Samples');
eq(str(0, 4), 'RIFF', 'RIFF-Magic');
eq(str(8, 4), 'WAVE', 'WAVE-Magic');
eq(str(12, 4), 'fmt ', 'fmt-Chunk');
eq(str(36, 4), 'data', 'data-Chunk');
eq(dv.getUint16(20, true), 1, 'PCM-Format');
eq(dv.getUint16(22, true), 1, 'mono');
eq(dv.getUint32(24, true), 16000, 'Sample-Rate 16000');
eq(dv.getUint16(34, true), 16, '16 Bit/Sample');
eq(dv.getUint32(40, true), pcm.length * 2, 'data-Größe = 2·Samples');
// Clipping: +1 → 0x7fff, -1 → -0x8000 (Int16)
eq(dv.getInt16(44 + 6, true), 0x7fff, '+1.0 → 0x7fff (Vollausschlag)');
eq(dv.getInt16(44 + 8, true), -0x8000, '-1.0 → -0x8000');

// ── rms ──────────────────────────────────────────────────────────────────────
eq(rms(new Float32Array([0, 0, 0])), 0, 'Stille → RMS 0');
eq(Math.round(rms(new Float32Array([1, -1, 1, -1])) * 1000), 1000, 'Vollausschlag → RMS 1');
eq(rms(new Float32Array([])), 0, 'leer → RMS 0');

// ── buildPrompt ────────────────────────────────────────────────────────────
import { buildPrompt } from '../src/shared/prompt.ts';
eq(buildPrompt(''), '', 'leeres Wörterbuch → leerer Prompt');
eq(buildPrompt('  \n  \n'), '', 'nur Leerzeilen → leerer Prompt');
eq(
  buildPrompt('iveo\n Jakobs Medien \n\nNITROVON'),
  'iveo, Jakobs Medien, NITROVON',
  'Zeilen → getrimmt, komma-verbunden, Leerzeilen weg',
);
eq(buildPrompt('aaaa\nbbbb\ncccc', 8), 'aaaa', 'maxChars kappt am letzten vollständigen Begriff');

// ── buildCliArgs ───────────────────────────────────────────────────────────
import { buildCliArgs } from '../src/shared/whisper-args.ts';
eq(
  buildCliArgs({ model: 'M', wav: 'W', outBase: 'O', language: 'auto', prompt: '', threads: 0, fast: false }),
  ['-m', 'M', '-f', 'W', '-nt', '-otxt', '-of', 'O'],
  'Basis-Args ohne Sprache/Prompt/Threads/Fast',
);
eq(
  buildCliArgs({ model: 'M', wav: 'W', outBase: 'O', language: 'de', prompt: 'iveo', threads: 4, fast: true }),
  ['-m', 'M', '-f', 'W', '-nt', '-otxt', '-of', 'O', '-l', 'de', '--prompt', 'iveo', '-t', '4', '-bs', '1', '-bo', '1', '-nf'],
  'volle Args: Sprache + Prompt + Threads + Greedy',
);

// ── parseInferenceText ─────────────────────────────────────────────────────
import { parseInferenceText } from '../src/shared/whisper-response.ts';
eq(parseInferenceText('{"text":"  hallo welt "}'), 'hallo welt', 'JSON {text} → getrimmt');
eq(parseInferenceText('roher text\n'), 'roher text', 'kein JSON → Rohtext getrimmt');
eq(parseInferenceText(''), '', 'leer → leer');
eq(parseInferenceText('{kaputt'), '{kaputt', 'malformed JSON → Rohtext');

console.log(failed === 0 ? '\nALLE TESTS OK' : `\n${failed} FEHLER`);
process.exit(failed === 0 ? 0 : 1);
