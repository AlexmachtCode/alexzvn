import type { BrowserWindow } from 'electron';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import type * as AudioNS from '@jm/audio';
import type {
  ArmInput,
  AudioDevice,
  OpResult,
  RecordInput,
  RecordResult,
  RecorderState,
  ScheduleInput,
} from '@shared/types';
import { MultiWavWriter, WavWriter } from './wav';

// Lazy-Load des nativen Addons: das Fenster startet auch ohne gebautes @jm/audio
// (z. B. im Codespace). Erst beim ersten Geräte-/Aufnahme-Zugriff geladen.
let audioMod: typeof AudioNS | null = null;
let inited = false;
function engine(): typeof AudioNS {
  if (!audioMod) {
    audioMod = require('@jm/audio') as typeof AudioNS;
  }
  if (!inited) {
    audioMod.init();
    inited = true;
  }
  return audioMod;
}

let getWin: () => BrowserWindow | null = () => null;
export function setWindowGetter(fn: () => BrowserWindow | null): void {
  getWin = fn;
}

const state: RecorderState = {
  status: 'idle',
  device: null,
  channels: 0,
  sampleRate: 0,
  filePath: null,
  recordedSec: 0,
  scheduledStartAt: null,
  scheduledStopAt: null,
};
let writer: WavWriter | null = null;
let multiWriter: MultiWavWriter | null = null;
let peaks: number[] = [];
let lastEmit = 0;
// Aufnahme-Verstärkung (#94): linearer Faktor, der je Audioblock VOR Pegel-
// messung und Schreiben angewandt wird → der Meter zeigt den verstärkten Pegel.
let gainFactor = 1;

/** Aufnahme-Gain in dB setzen (geklemmt). 0 dB = unverändert. */
export function setGain(db: number): void {
  const clamped = Math.max(-24, Math.min(36, Number.isFinite(db) ? db : 0));
  gainFactor = Math.pow(10, clamped / 20);
}

// Zeitgesteuerte Aufnahme (Slice C3): Timer + gemerkter Aufnahme-Input.
let startTimer: ReturnType<typeof setTimeout> | null = null;
let stopTimer: ReturnType<typeof setTimeout> | null = null;
let pendingInput: RecordInput | null = null;

function send(channel: string, payload: unknown): void {
  const win = getWin();
  if (!win || win.isDestroyed()) return;
  const wc = win.webContents;
  if (!wc.isDestroyed()) wc.send(channel, payload);
}

// Zustands-Listener (z. B. der TCP-Steuerserver für den Companion-STATE-Push).
const stateListeners = new Set<() => void>();
export function onStateChange(cb: () => void): () => void {
  stateListeners.add(cb);
  return () => stateListeners.delete(cb);
}

function emitState(): void {
  send('recorder:state', { ...state });
  for (const cb of stateListeners) cb();
}
function notice(msg: string): void {
  send('recorder:notice', msg);
}

export function getState(): RecorderState {
  return { ...state };
}

export function listDevices(): AudioDevice[] {
  return engine()
    .listDevices()
    .filter((d) => d.maxInputChannels > 0)
    .map((d) => ({
      index: d.index,
      name: d.name,
      hostApiName: d.hostApiName,
      maxInputChannels: d.maxInputChannels,
      defaultSampleRate: Math.round(d.defaultSampleRate),
    }));
}

// Läuft je Audioblock (TSFN → Node-Loop): Pegel sammeln, ggf. schreiben,
// gedrosselt Pegel/State an den Renderer senden.
function onFrames(planar: Float32Array, channels: number, frames: number): void {
  // Gain zuerst auf den ganzen Block anwenden (in place) → Pegel + Datei zeigen/
  // schreiben den verstärkten Ton. 32-bit-Float-WAV behält Werte >1 (kein Hard-
  // Clip in der Datei); der Meter warnt rot ab ~0 dBFS.
  if (gainFactor !== 1) {
    for (let i = 0; i < planar.length; i++) planar[i] *= gainFactor;
  }
  if (peaks.length !== channels) peaks = new Array(channels).fill(0);
  for (let c = 0; c < channels; c++) {
    let p = peaks[c];
    const base = c * frames;
    for (let i = 0; i < frames; i++) {
      const v = Math.abs(planar[base + i]);
      if (v > p) p = v;
    }
    peaks[c] = p;
  }

  if (state.status === 'recording' && writer) {
    writer.writeBlock(planar, channels, frames);
    multiWriter?.writeBlock(planar, channels, frames);
    state.recordedSec += frames / (state.sampleRate || 1);
  }

  const now = Date.now();
  if (now - lastEmit >= 50) {
    send('recorder:levels', { peaks: peaks.slice() });
    if (state.status === 'recording') emitState();
    peaks = new Array(channels).fill(0);
    lastEmit = now;
  }
}

export function arm(input: ArmInput): OpResult {
  try {
    if (state.status !== 'idle') disarm();
    engine().openInput(
      { device: input.device, channels: input.channels, sampleRate: input.sampleRate },
      onFrames,
    );
    state.status = 'armed';
    state.device = input.device;
    state.channels = input.channels;
    state.sampleRate = input.sampleRate;
    state.filePath = null;
    state.recordedSec = 0;
    peaks = new Array(input.channels).fill(0);
    emitState();
    return { ok: true };
  } catch (e) {
    state.status = 'idle';
    emitState();
    return { ok: false, error: (e as Error).message };
  }
}

export function disarm(): void {
  clearTimers(); // geplante Aufnahmen verfallen mit dem Eingang
  state.scheduledStartAt = null;
  state.scheduledStopAt = null;
  pendingInput = null;
  if (writer) {
    try {
      writer.finalize();
    } catch {
      // ignore
    }
    writer = null;
  }
  if (multiWriter) {
    multiWriter.finalize();
    multiWriter = null;
  }
  try {
    if (audioMod && inited) audioMod.stopInput();
  } catch {
    // ignore
  }
  state.status = 'idle';
  state.filePath = null;
  state.recordedSec = 0;
  emitState();
}

function defaultName(): string {
  const d = new Date();
  const p = (n: number): string => String(n).padStart(2, '0');
  return `Aufnahme-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
function sanitize(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, ' ').trim() || defaultName();
}

export function startRecording(input: RecordInput): OpResult {
  if (state.status !== 'armed') return { ok: false, error: 'Erst den Eingang öffnen (Arm).' };
  try {
    // Ein laufender Start erfüllt eine evtl. geplante Startzeit.
    if (startTimer) {
      clearTimeout(startTimer);
      startTimer = null;
    }
    state.scheduledStartAt = null;
    mkdirSync(input.dir, { recursive: true });
    const base = input.fileName?.trim() ? sanitize(input.fileName) : defaultName();
    const filePath = path.join(input.dir, `${base}.wav`);
    writer = new WavWriter(filePath, state.channels, state.sampleRate);
    // Optional zusätzlich jede Spur einzeln in einen Unterordner (Issue #20). Bei
    // Mono gibt es nichts zu trennen — die Kombi-Datei ist bereits die eine Spur.
    if (input.separateTracks && state.channels > 1) {
      const tracksDir = path.join(input.dir, `${base}-Spuren`);
      mkdirSync(tracksDir, { recursive: true });
      multiWriter = new MultiWavWriter(tracksDir, base, state.channels, state.sampleRate);
    }
    state.filePath = filePath;
    state.recordedSec = 0;
    state.status = 'recording';
    emitState();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export function stopRecording(): RecordResult {
  if (state.status !== 'recording' || !writer) return { ok: false, error: 'Keine laufende Aufnahme.' };
  // Manueller Stopp hebt einen ausstehenden Auto-Stopp auf.
  if (stopTimer) {
    clearTimeout(stopTimer);
    stopTimer = null;
  }
  state.scheduledStopAt = null;
  const filePath = state.filePath ?? '';
  try {
    const res = writer.finalize();
    writer = null;
    if (multiWriter) {
      multiWriter.finalize();
      multiWriter = null;
    }
    state.status = 'armed';
    emitState();
    return {
      ok: true,
      filePath,
      bytes: res.bytes,
      durationSec: res.durationSec,
      channels: state.channels,
      sampleRate: state.sampleRate,
    };
  } catch (e) {
    writer = null;
    if (multiWriter) {
      multiWriter.finalize();
      multiWriter = null;
    }
    state.status = 'armed';
    emitState();
    return { ok: false, error: (e as Error).message };
  }
}

// ---- Zeitgesteuerte Aufnahme (C3) ----

function clearTimers(): void {
  if (startTimer) {
    clearTimeout(startTimer);
    startTimer = null;
  }
  if (stopTimer) {
    clearTimeout(stopTimer);
    stopTimer = null;
  }
}

/**
 * Plant eine Aufnahme: optional Startzeit (sonst sofort) und optional Stoppzeit
 * (sonst manuell). Erfordert einen geöffneten Eingang (armed). Die Timer laufen
 * im Main, damit Start/Stopp unabhängig vom Renderer-Zustand zuverlässig feuern.
 */
export function schedule(input: ScheduleInput): OpResult {
  if (state.status === 'idle') return { ok: false, error: 'Erst den Eingang öffnen (Arm).' };
  if (state.status === 'recording') return { ok: false, error: 'Es läuft bereits eine Aufnahme.' };

  const now = Date.now();
  const startAt = input.startAt && input.startAt > now ? input.startAt : null;
  const stopAt = input.stopAt && input.stopAt > now ? input.stopAt : null;
  if (stopAt && startAt && stopAt <= startAt) {
    return { ok: false, error: 'Stoppzeit muss nach der Startzeit liegen.' };
  }
  if (input.stopAt && !stopAt) {
    return { ok: false, error: 'Stoppzeit liegt in der Vergangenheit.' };
  }

  clearTimers();
  pendingInput = { dir: input.dir, fileName: input.fileName, separateTracks: input.separateTracks };
  state.scheduledStartAt = startAt;
  state.scheduledStopAt = stopAt;

  if (startAt) {
    startTimer = setTimeout(doScheduledStart, startAt - now);
    emitState();
    notice(`Aufnahme geplant für ${new Date(startAt).toLocaleTimeString()}.`);
  } else {
    // Sofort starten; ein evtl. gesetzter Stopp wird in doScheduledStart bewaffnet.
    doScheduledStart();
  }
  return { ok: true };
}

function doScheduledStart(): void {
  startTimer = null;
  state.scheduledStartAt = null;
  const input = pendingInput;
  if (!input) return;
  const res = startRecording(input);
  if (!res.ok) {
    state.scheduledStopAt = null;
    notice(res.error ?? 'Geplante Aufnahme konnte nicht starten.');
    return;
  }
  notice('Geplante Aufnahme gestartet.');
  // Auto-Stopp bewaffnen (startRecording räumt scheduledStartAt; Stopp bleibt).
  if (state.scheduledStopAt) {
    const delay = Math.max(0, state.scheduledStopAt - Date.now());
    stopTimer = setTimeout(doScheduledStop, delay);
  }
  emitState();
}

function doScheduledStop(): void {
  stopTimer = null;
  state.scheduledStopAt = null;
  const res = stopRecording();
  if (res.ok) notice(`Geplante Aufnahme beendet${res.filePath ? `: ${res.filePath}` : ''}.`);
}

/** Geplante Aufnahme abbrechen. Eine bereits LAUFENDE Aufnahme bleibt unberührt. */
export function cancelSchedule(): void {
  const had = state.scheduledStartAt != null || state.scheduledStopAt != null;
  clearTimers();
  state.scheduledStartAt = null;
  state.scheduledStopAt = null;
  pendingInput = null;
  emitState();
  if (had) notice('Planung abgebrochen.');
}

/** Beim Fenster-Schließen/Beenden: Timer lösen + Eingang schließen. */
export function shutdown(): void {
  clearTimers();
  try {
    if (audioMod && inited) audioMod.stopInput();
  } catch {
    // ignore
  }
}
