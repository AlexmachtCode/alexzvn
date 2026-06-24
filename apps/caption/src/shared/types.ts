// Datenmodell + IPC-Typen für JM Caption (Welle 3b, Slice 1).
//
// Die Audio-Aufnahme läuft im Renderer (getUserMedia + AudioContext@16 kHz):
// erkannte Äußerungen (Float32-PCM) gehen per IPC an den Main, der sie mit
// whisper.cpp (CLI) transkribiert. Der autoritative Zustand (Zeilen, Lauf-Flag)
// lebt im Main — so kann ihn später der CAPTION-Steuerserver (Companion) setzen.

export type WhisperModelId = 'tiny' | 'base' | 'small' | 'medium' | 'large-v3';

export interface CaptionConfig {
  model: WhisperModelId;
  /** ISO-Sprachcode ('de', 'en', …) oder 'auto'. */
  language: string;
  /** Force-Finalize einer Äußerung nach dieser Dauer (s). */
  maxUtteranceSec: number;
  /** Stille-Dauer (ms) nach Sprache, bis eine Äußerung abgeschlossen wird. */
  silenceMs: number;
  /** RMS-Schwelle, ab der ein Block als „Sprache" gilt. */
  silenceThreshold: number;
  /** Gewählter Audio-Eingang (deviceId); leer = System-Standard-Mikrofon. */
  audioInputDeviceId: string;

  // ── NDI-Ausgabe (Slice 2): transparente Untertitel-Quelle ──────────────────
  /** Sichtbarer NDI-Quellname. */
  ndiName: string;
  /** Programmauflösung der NDI-Frames. */
  ndiWidth: number;
  ndiHeight: number;
  /** Sende-Framerate (gedrosselt). */
  ndiFps: number;
  /** Schriftgröße der Untertitel in px (bezogen auf ndiHeight). */
  ndiFontSize: number;
  /** Wieviele der letzten Zeilen gleichzeitig sichtbar sind (1–3). */
  ndiLines: number;
  /** Halbtransparentes Hintergrundband hinter dem Text (für nicht-keyende Ziele). */
  ndiBand: boolean;
}

/** Laufzeit-Status der NDI-Ausgabe (nicht persistiert). */
export interface CaptionStatus {
  ndiActive: boolean;
  /** Anzahl verbundener NDI-Empfänger (letzter Sender-Report). */
  connections: number;
}

export interface CaptionLine {
  id: string;
  text: string;
  at: number;
}

export interface CaptionState {
  /** Aufnahme/Transkription aktiv (Renderer captured, wenn true). */
  running: boolean;
  /** Anzeige + NDI-Ausgabe eingefroren (Untertitel werden nicht aktualisiert). */
  hold: boolean;
  /** Ein whisper-Job läuft gerade. */
  busy: boolean;
  whisperAvailable: boolean;
  /** Letzte finalisierte Untertitelzeilen (jüngste zuletzt). */
  lines: CaptionLine[];
  config: CaptionConfig;
  status: CaptionStatus;
  error: string | null;
}

export interface JmCaptionApi {
  platform: string;
  getState: () => Promise<CaptionState>;
  onState: (cb: (s: CaptionState) => void) => () => void;
  setConfig: (patch: Partial<CaptionConfig>) => Promise<CaptionState>;
  start: () => Promise<CaptionState>;
  stop: () => Promise<CaptionState>;
  setHold: (hold: boolean) => Promise<CaptionState>;
  clear: () => Promise<CaptionState>;
  /** Letzte Zeile korrigieren (Operator-Edit). */
  correctLast: (text: string) => Promise<CaptionState>;
  /** Erkannte Äußerung (Float32-PCM @ sampleRate) zum Transkribieren senden. */
  pushUtterance: (pcm: Float32Array, sampleRate: number) => void;
  /** Transparente NDI-Untertitel-Quelle starten/stoppen/abfragen. */
  ndi: {
    start: (name?: string) => Promise<CaptionStatus>;
    stop: () => Promise<CaptionStatus>;
    status: () => Promise<CaptionStatus>;
  };
}
