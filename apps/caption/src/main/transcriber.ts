// Transkriptions-Engine (Main): nimmt erkannte Äußerungen (Float32-PCM) entgegen,
// schreibt sie als 16-kHz-Mono-WAV und lässt whisper.cpp (CLI) sie offline
// transkribieren — ein Job nach dem anderen (Queue). Reuse des bewährten
// whisper-cli-Pfads aus apps/transcribe (locate.ts), nur als kurze Einzel-
// Äußerungen statt ganzer Dateien (Live-Untertitel).
//
// Die whisper-Binary + Modelle werden im Office gebündelt (bundle-whisper.mjs);
// ohne sie liefert whisperPath() null → klare Fehlermeldung, kein Crash.
import { app } from 'electron';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { bundledModelsDir, whisperPath } from './locate';
import { floatToWav16 } from '@shared/wav';
import { buildPrompt } from '@shared/prompt';
import { buildCliArgs } from '@shared/whisper-args';
import { cpus } from 'node:os';
import type { CaptionConfig, WhisperModelId } from '@shared/types';

export interface TranscriberHooks {
  config: () => CaptionConfig;
  onText: (text: string) => void;
  onBusy: (busy: boolean) => void;
  onError: (msg: string | null) => void;
}

let hooks: TranscriberHooks | null = null;
let queue: { pcm: Float32Array; sampleRate: number }[] = [];
let draining = false;
let current: ChildProcess | null = null;
let seq = 0;

// Threads für whisper (Auto, aber gekappt gegen Oversubscription auf kleinen Kernen).
const THREADS = Math.max(1, Math.min(8, cpus().length));

export function initTranscriber(h: TranscriberHooks): void {
  hooks = h;
}

/** Pfad zum gewählten Modell (userData bevorzugt, sonst gebündeltes Basismodell). */
function modelPath(id: WhisperModelId): string | null {
  const user = join(app.getPath('userData'), 'models', `ggml-${id}.bin`);
  if (existsSync(user)) return user;
  const base = join(bundledModelsDir(), 'ggml-base.bin');
  if (existsSync(base)) return base; // Fallback: Basismodell
  return null;
}

export function enqueueUtterance(pcm: Float32Array, sampleRate: number): void {
  queue.push({ pcm, sampleRate });
  void drain();
}

export function clearQueue(): void {
  queue = [];
}

export function stopTranscriber(): void {
  queue = [];
  if (current) {
    try {
      current.kill();
    } catch {
      /* egal */
    }
    current = null;
  }
}

async function drain(): Promise<void> {
  if (draining || !hooks) return;
  const bin = whisperPath();
  if (!bin) {
    hooks.onError('whisper-CLI nicht gefunden — Binary + Modell werden im Office gebündelt.');
    queue = [];
    return;
  }
  draining = true;
  hooks.onBusy(true);
  try {
    while (queue.length) {
      const job = queue.shift();
      if (!job) break;
      const text = await transcribeOne(bin, job.pcm, job.sampleRate);
      if (text) hooks.onText(text);
    }
  } finally {
    draining = false;
    hooks.onBusy(false);
  }
}

function transcribeOne(bin: string, pcm: Float32Array, sampleRate: number): Promise<string> {
  return new Promise((resolve) => {
    const cfg = hooks!.config();
    const model = modelPath(cfg.model);
    if (!model) {
      hooks!.onError(`Modell ggml-${cfg.model}.bin nicht gefunden.`);
      resolve('');
      return;
    }
    const dir = join(app.getPath('temp'), 'jm-caption');
    try {
      mkdirSync(dir, { recursive: true });
    } catch {
      /* egal */
    }
    const stamp = `${Date.now()}_${seq++}`;
    const wav = join(dir, `u_${stamp}.wav`);
    const outBase = join(dir, `u_${stamp}`);
    try {
      writeFileSync(wav, floatToWav16(pcm, sampleRate));
    } catch {
      resolve('');
      return;
    }

    const args = buildCliArgs({
      model,
      wav,
      outBase,
      language: cfg.language,
      prompt: buildPrompt(cfg.dictionary),
      threads: THREADS,
      fast: true, // Live-Untertitel: Greedy-Decode, Tempo vor letzter Genauigkeit
    });

    const child = spawn(bin, args, { windowsHide: true });
    current = child;
    const done = (text: string): void => {
      current = null;
      try {
        rmSync(wav, { force: true });
        rmSync(`${outBase}.txt`, { force: true });
      } catch {
        /* egal */
      }
      resolve(text);
    };
    child.on('error', () => {
      hooks!.onError('whisper-Start fehlgeschlagen.');
      done('');
    });
    child.on('close', () => {
      let text = '';
      try {
        text = readFileSync(`${outBase}.txt`, 'utf8').trim();
      } catch {
        /* keine Ausgabe */
      }
      hooks!.onError(null);
      done(text);
    });
  });
}
