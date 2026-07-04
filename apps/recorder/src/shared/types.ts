export interface AudioDevice {
  index: number;
  name: string;
  hostApiName: string;
  maxInputChannels: number;
  defaultSampleRate: number;
}

export type RecorderStatus = 'idle' | 'armed' | 'recording';

export interface RecorderState {
  status: RecorderStatus;
  device: number | null;
  channels: number;
  sampleRate: number;
  filePath: string | null;
  recordedSec: number;
  /** Geplanter Start (epoch ms) — gesetzt, solange eine Aufnahme wartet. */
  scheduledStartAt?: number | null;
  /** Geplanter Stopp (epoch ms) — gesetzt, solange ein Auto-Stopp aussteht. */
  scheduledStopAt?: number | null;
}

export interface ArmInput {
  device: number;
  channels: number;
  sampleRate: number;
}

export interface RecordInput {
  dir: string;
  /** Basisname ohne Endung; Standard = Zeitstempel. */
  fileName?: string;
  /** Zusätzlich jede Spur als eigene Mono-WAV in einen Unterordner (Issue #20). */
  separateTracks?: boolean;
}

/** Zeitgesteuerte Aufnahme: Start-/Stoppzeit zusätzlich zum RecordInput. */
export interface ScheduleInput extends RecordInput {
  /** Absolute Startzeit (epoch ms). null/0 = sofort starten. */
  startAt: number | null;
  /** Absolute Stoppzeit (epoch ms). null/0 = manuell stoppen. */
  stopAt: number | null;
}

export interface OpResult {
  ok: boolean;
  error?: string;
}

export interface RecordResult extends OpResult {
  filePath?: string;
  bytes?: number;
  durationSec?: number;
  channels?: number;
  sampleRate?: number;
}

/** Spitzenpegel pro Kanal, linear 0..1 (der Renderer rechnet in dBFS um). */
export interface Levels {
  peaks: number[];
}

/**
 * Befehl der TCP-Fernsteuerung (Bitfocus Companion), vom Main an den Renderer
 * gepusht. Aufnahme-Start braucht die Renderer-Settings (Ordner/Gerät), daher
 * der Push statt direktem Main-Aufruf.
 */
export type RecorderRemoteCommand =
  | { t: 'record'; mode: 'on' | 'off' | 'toggle' }
  | { t: 'arm' }
  | { t: 'disarm' };

/**
 * Show-Integration (C3): aus dem `settings`-Block der .jmshow übernommene
 * Aufnahme-Voreinstellungen. Alle Felder optional — nur Vorhandenes wird gesetzt.
 * `deviceIndex` bleibt bewusst außen vor (maschinenlokaler PortAudio-Index).
 */
export interface RecShowSettings {
  dir?: string;
  fileName?: string;
  separateTracks?: boolean;
  channels?: number;
  sampleRate?: number;
}

/** Shape, die der Preload auf `window.jmrec` legt. */
export interface JmrecApi {
  platform: NodeJS.Platform;
  listDevices: () => Promise<AudioDevice[]>;
  /** Eingang öffnen (Pegel laufen, noch keine Datei). */
  arm: (input: ArmInput) => Promise<OpResult>;
  /** Eingang schließen. */
  disarm: () => Promise<void>;
  /** Aufnahme in WAV starten (muss armed sein). */
  startRecording: (input: RecordInput) => Promise<OpResult>;
  /** Aufnahme beenden + WAV finalisieren. */
  stopRecording: () => Promise<RecordResult>;
  /** Zeitgesteuerte Aufnahme planen (muss armed sein). */
  schedule: (input: ScheduleInput) => Promise<OpResult>;
  /** Geplante Aufnahme abbrechen (stoppt keine laufende Aufnahme). */
  cancelSchedule: () => Promise<void>;
  getState: () => Promise<RecorderState>;
  /** Aufnahme-Verstärkung in dB setzen (#94). Wirkt live auf Pegel + Aufnahme. */
  setGain: (db: number) => Promise<void>;
  dialog: { pickDir: () => Promise<string | null> };
  shell: { reveal: (path: string) => Promise<void> };
  onLevels: (cb: (l: Levels) => void) => () => void;
  onState: (cb: (s: RecorderState) => void) => () => void;
  /** Hinweistexte aus dem Main (z. B. „Geplante Aufnahme gestartet/beendet"). */
  onNotice: (cb: (msg: string) => void) => () => void;
  /** TCP-Fernsteuerung (Bitfocus Companion): auf Befehle hören. Liefert Unsubscribe. */
  onRemoteCommand: (cb: (cmd: RecorderRemoteCommand) => void) => () => void;
  /** Show-Integration (C3): beim Start ausstehende Show-Voreinstellungen abholen (Kaltstart). */
  takeShowSettings: () => Promise<RecShowSettings | null>;
  /** Show-Integration (C3): Voreinstellungen, die zur Laufzeit per Deep-Link ankommen. Liefert Unsubscribe. */
  onShowSettings: (cb: (s: RecShowSettings) => void) => () => void;
}
