// Vertrag zwischen Renderer (window.jmdaw), Preload-Bridge und Main-Prozess.
import type { AudioExportFormat, MediaAsset, Project } from './project';

// ── Medien-Import ────────────────────────────────────────────────────────────

export interface OpenProjectResult {
  path: string;
  project: Project;
}

export interface SaveProjectRequest {
  project: Project;
  /** Vorhandener Pfad; fehlt er, öffnet sich der Speichern-Dialog. */
  path?: string;
}
export interface SaveProjectResult {
  path: string;
}

/** Exotische Quelle für decodeAudioData nach 48-kHz-Float-WAV transkodieren. */
export interface TranscodeResult {
  ok: boolean;
  proxyPath?: string;
  error?: string;
}

// ── Export ───────────────────────────────────────────────────────────────────

export interface PickOutputRequest {
  defaultName: string;
  /** Container-Endung ohne Punkt (wav/mp3/flac/aac/ogg). */
  ext: string;
}

/**
 * Der Renderer rendert den Mix offline (OfflineAudioContext) zu einem
 * Float-WAV und übergibt die Bytes; der Main schreibt sie (Format wav) bzw.
 * encodet sie via FFmpeg (mp3/flac/aac/ogg).
 */
export interface ExportRunRequest {
  /** Fertig gerendertes WAV (32-bit float, interleaved) als Bytes. */
  wav: Uint8Array;
  outputPath: string;
  format: AudioExportFormat;
  sampleRate: number;
  /** Nur WAV: Ziel-Bittiefe (16/24/32). 32 = Passthrough ohne Re-Encode. */
  bitDepth?: 16 | 24 | 32;
  bitrateKbps?: number | null;
}
export interface ExportStartResult {
  exportId: string;
}
export interface ExportProgress {
  exportId: string;
  /** 0..100, oder -1 wenn unbestimmt. */
  percent: number;
}
export interface ExportResult {
  exportId: string;
  success: boolean;
  outputPath?: string;
  error?: string;
  canceled?: boolean;
}

// ── Aufnahme (über @jm/audio, gleiche Basis wie JM Recorder) ─────────────────

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
}

export interface ArmInput {
  device: number;
  channels: number;
  sampleRate: number;
}

export interface StartRecordInput {
  /** Basisname ohne Endung; Standard = Zeitstempel. */
  fileName?: string;
}

export interface OpResult {
  ok: boolean;
  error?: string;
}

export interface RecordResult extends OpResult {
  filePath?: string;
  durationUs?: number;
  channels?: number;
  sampleRate?: number;
}

/** Spitzenpegel pro Kanal, linear 0..1 (der Renderer rechnet in dBFS um). */
export interface Levels {
  peaks: number[];
}

// ── Mixer-Fenster (#95): Popout ↔ Host-Fenster ──────────────────────────────
// Der Host (Hauptfenster) besitzt Audio-Engine + Store; das Popout ist ein
// schlankes Spiegelfenster. Der Host pusht periodisch eine Momentaufnahme
// (Kanäle + Live-Meter), das Popout schickt Steuerbefehle zurück; beides läuft
// über den Main-Prozess als Relais.

export interface MixerStripSnapshot {
  id: string;
  name: string;
  kind: 'audio' | 'bus';
  gain: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  /** Anzahl Insert-Effekte (Anzeige ƒx). */
  fx: number;
  /** Spitzenpegel linear 0..1. */
  meter: number;
}

export interface MixerSnapshot {
  strips: MixerStripSnapshot[];
  master: { gain: number; meter: number };
  activeTrackId: string | null;
}

/** Steuerbefehl vom Popout an den Host-Store. Fader/Pan mit Drag-Phasen für sauberes Undo. */
export type MixerCommand =
  | { kind: 'gain'; id: string; value: number; phase: 'start' | 'move' | 'end' }
  | { kind: 'pan'; id: string; value: number; phase: 'start' | 'move' | 'end' }
  | { kind: 'mute'; id: string }
  | { kind: 'solo'; id: string }
  | { kind: 'select'; id: string }
  | { kind: 'addBus' }
  | { kind: 'removeBus'; id: string };

// ── Bridge-Shape ─────────────────────────────────────────────────────────────

/** Form, die die Preload-Bridge auf `window.jmdaw` legt. */
export interface JmdawApi {
  platform: NodeJS.Platform;
  pathForFile: (file: File) => string;
  dialog: {
    importAudio: () => Promise<string[]>;
  };
  media: {
    /** Pfade proben + als Audio-Assets aufbereiten. */
    import: (paths: string[]) => Promise<MediaAsset[]>;
    /** Exotische Quelle nach dekodierbarem WAV transkodieren. */
    transcodeForDecode: (asset: MediaAsset) => Promise<TranscodeResult>;
  };
  project: {
    open: () => Promise<OpenProjectResult | null>;
    save: (req: SaveProjectRequest) => Promise<SaveProjectResult | null>;
  };
  export: {
    pickOutput: (req: PickOutputRequest) => Promise<string | null>;
    start: (req: ExportRunRequest) => Promise<ExportStartResult>;
    cancel: (exportId: string) => Promise<void>;
  };
  rec: {
    listDevices: () => Promise<AudioDevice[]>;
    arm: (input: ArmInput) => Promise<OpResult>;
    disarm: () => Promise<void>;
    start: (input: StartRecordInput) => Promise<OpResult>;
    stop: () => Promise<RecordResult>;
    getState: () => Promise<RecorderState>;
  };
  shell: {
    reveal: (path: string) => Promise<void>;
    openExternal: (url: string) => Promise<void>;
  };
  /** Mixer als eigenes Fenster (#95): Popout öffnen + Live-Sync-Relais. */
  mixerWin: {
    /** Popout-Fenster öffnen (oder fokussieren). */
    open: () => Promise<void>;
    /** Host → Popout: aktuelle Mixer-Momentaufnahme senden. */
    pushSnapshot: (snap: MixerSnapshot) => void;
    /** Popout → Host: Steuerbefehl senden. */
    sendCommand: (cmd: MixerCommand) => void;
    /** Popout: auf Momentaufnahmen hören. Liefert Unsubscribe. */
    onSnapshot: (cb: (snap: MixerSnapshot) => void) => () => void;
    /** Host: auf Steuerbefehle des Popouts hören. Liefert Unsubscribe. */
    onCommand: (cb: (cmd: MixerCommand) => void) => () => void;
    /** Host: erfährt, ob das Popout offen ist (→ Pushen starten/stoppen). */
    onPopoutState: (cb: (open: boolean) => void) => () => void;
  };
  onExportProgress: (cb: (p: ExportProgress) => void) => () => void;
  onExportDone: (cb: (r: ExportResult) => void) => () => void;
  onRecLevels: (cb: (l: Levels) => void) => () => void;
  onRecState: (cb: (s: RecorderState) => void) => () => void;
  /** Show-Integration (C3): Der Hauptprozess schiebt das aus der .jmshow geladene Projekt zu. */
  onProjectOpened: (cb: (r: OpenProjectResult) => void) => () => void;
  /** TCP-Fernsteuerung (Bitfocus Companion) ↔ Renderer. */
  remote: {
    /** Auf Fernsteuer-Befehle hören (Main → Renderer). Liefert Unsubscribe. */
    onCommand: (cb: (cmd: DawRemoteCommand) => void) => () => void;
    /** Transport-/Aufnahme-Zustand an den Main melden (Renderer → Steuerserver). */
    reportState: (state: DawRemoteState) => Promise<void>;
  };
}

/**
 * Befehl der TCP-Fernsteuerung (Bitfocus Companion), vom Main an den Renderer
 * gepusht. Transport (Play/Stop) lebt im Renderer-Store, die Aufnahme-Flows
 * ebenfalls (sie platzieren den Clip), daher der Push statt direktem Main-Aufruf.
 */
export type DawRemoteCommand =
  | { t: 'play' }
  | { t: 'stop' }
  | { t: 'toggle' }
  | { t: 'rec'; mode: 'on' | 'off' | 'toggle' };

/** Transport-/Aufnahme-Zustand, vom Renderer an den Main gemeldet (Companion-STATE). */
export interface DawRemoteState {
  playing: boolean;
  recording: boolean;
}
