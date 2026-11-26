import type { FernsteuerungMeldung } from './fernsteuerung';

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

  /** Fachwörter/Eigennamen, eine je Zeile — als Initial-Prompt an whisper übergeben (#204). */
  dictionary: string;
  /** Transkriptions-Backend: 'server' (persistent, schnell) | 'cli' (pro Äußerung). */
  engine: 'server' | 'cli';

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
  /** Der NDI-Unterprozess existiert (sagt nicht, dass er Bilder sendet). */
  ndiActive: boolean;
  /** Anzahl verbundener NDI-Empfänger (letzter Sender-Report). */
  connections: number;
  /** Gemessen (E8): der Sender meldete zuletzt innerhalb von NDI_STILLE_MS; false bei Stopp, Prozessende und Stille. */
  ndiSendet: boolean;
  /** Name, mit dem startNdi den Sender gestartet hat; null, wenn NDI aus ist. */
  ndiNetzName: string | null;
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
  /**
   * Altfehler CA-4: Zahl der „Leeren“ (Taste und Companion clear) seit dem Start des Main. Eine neue Leerung leert die Ausgabe auch
   * bei Hold; ein Zähler, weil zwei Übertragungen kurz nacheinander die leere Liste überspringen können.
   */
  leerungen: number;
  config: CaptionConfig;
  status: CaptionStatus;
  error: string | null;
}

/**
 * Master-Link-Zustand für die Statusleiste (Spec 3.9). Spiegel von MasterLinkMeldung aus @jm/app-runtime, das im Renderer
 * nicht importierbar ist (Main-Code). Den Gleichlauf prüft die Typprüfung des Preloads.
 */
export type MasterLinkMeldungZeile =
  | { art: 'aus' }
  | { art: 'sucht' }
  | { art: 'verbindet'; adresse: string }
  | { art: 'verbunden'; adresse: string; seit: number; masterName: string; suite: string }
  | { art: 'fehler'; code: string; text: string; errCode?: string }
  | { art: 'ohne-client' };

export interface JmCaptionApi {
  platform: string;
  /** Master-Link-Zustand (Spec 3.9): Meldung oder null (Brücke fehlt oder lehnt ab → „unbekannt“). */
  masterLink: () => Promise<MasterLinkMeldungZeile | null>;
  onMasterLink: (cb: (m: MasterLinkMeldungZeile) => void) => () => void;
  /** Lage des Steuerservers (Port 8732), nur lesend; null, solange Main nichts gemeldet hat. */
  fernsteuerung: () => Promise<FernsteuerungMeldung | null>;
  onFernsteuerung: (cb: (m: FernsteuerungMeldung | null) => void) => () => void;
  getState: () => Promise<CaptionState>;
  onState: (cb: (s: CaptionState) => void) => () => void;
  setConfig: (patch: Partial<CaptionConfig>) => Promise<CaptionState>;
  start: () => Promise<CaptionState>;
  stop: () => Promise<CaptionState>;
  setHold: (hold: boolean) => Promise<CaptionState>;
  clear: () => Promise<CaptionState>;
  /** Zeile mit dieser Kennung korrigieren (Operator-Edit, Altfehler CA-5); eine unbekannte Kennung ändert nichts. */
  correctLine: (id: string, text: string) => Promise<CaptionState>;
  /** Erkannte Äußerung (Float32-PCM @ sampleRate) zum Transkribieren senden. */
  pushUtterance: (pcm: Float32Array, sampleRate: number) => void;
  /** Transparente NDI-Untertitel-Quelle starten/stoppen/abfragen. */
  ndi: {
    start: (name?: string) => Promise<CaptionStatus>;
    stop: () => Promise<CaptionStatus>;
    status: () => Promise<CaptionStatus>;
  };
}
