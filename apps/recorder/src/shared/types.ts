import type { FernsteuerungMeldung } from './fernsteuerung';

/**
 * Grund, warum Öffnen und Schließen des Eingangs während einer Aufnahme abgelehnt werden (Altfehler RE-2, Wortlaut der Spec). Der Satz
 * steht nur hier (Pre-flight K4): der Hauptprozess antwortet damit (`arm`, `schliesseEingang`), die Oberfläche nennt ihn bei einem
 * abgelehnten Fernbefehl und ohne den Punkt als Sperrgrund der Taste „Eingang schließen“.
 */
export const ERST_AUFNAHME_STOPPEN = 'Erst die Aufnahme stoppen.';

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
  /** Alle geschriebenen Dateien: `filePath` und ab 4 GB die Folgedateien `Name_002.wav` … (#291). */
  files?: string[];
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
 * Der Zielordner der Show geht im Main durch `pruefeShowOrdner` (Altfehler RE-7b) und kommt in genau einem der drei Felder an:
 * `dir` nur, wenn er gesetzt werden darf (Laufwerk oder bestätigter Netzwerkordner).
 */
export interface RecShowSettings {
  dir?: string;
  /** Altfehler RE-7b: ein Netzwerkordner, den noch niemand bestätigt hat; gilt erst nach „Übernehmen“ im Fenster. */
  netzordnerOffen?: string;
  /** Altfehler RE-7b: ein Ordner, der kein gültiger Ordner ist (wie beim Import); er wird nicht übernommen, das Fenster nennt ihn. */
  ordnerUngueltig?: string;
  fileName?: string;
  separateTracks?: boolean;
  channels?: number;
  sampleRate?: number;
}

/** Eingang, wie er gemerkt wird: über Name + Treiber, nie über die PortAudio-Nummer (#291). */
export interface GemerkterEingang {
  name: string;
  hostApiName: string;
}

/**
 * Gemerkte Einstellungen (#291), im Main als `recorder-settings.json` unter userData abgelegt.
 * Alle Felder optional — was fehlt, nimmt die Vorgabe. Die Startzeit des Zeitplans fehlt mit
 * Absicht: ein festes Datum liegt am nächsten Tag in der Vergangenheit.
 */
export interface RecEinstellungen {
  eingang?: GemerkterEingang;
  channels?: number;
  sampleRate?: number;
  dir?: string;
  fileName?: string;
  separateTracks?: boolean;
  gainDb?: number;
  scheduleDurationMin?: number;
  /** Name des zuletzt angewandten/gespeicherten Presets — nur in der Einstellungsdatei, nie in `werte`. */
  preset?: string;
}

/** Benannter Satz Einstellungen (Preset), ohne das Feld `preset`. */
export interface RecPreset {
  name: string;
  werte: RecEinstellungen;
}

/** Wahl bei gleichnamigen Presets beim Import. */
export type KonfliktWahl = 'ueberschreiben' | 'beide' | 'abbrechen';

/** Wahl beim Import, wenn Presets in einen Netzwerkordner aufnehmen würden. */
export type NetzWahl = 'uebernehmen' | 'ohne' | 'abbrechen';

/** Ergebnis von Preset-Import/-Export über den Dateidialog. */
export interface PresetDateiErgebnis {
  ok: boolean;
  error?: string;
  presets?: RecPreset[];
  meldung?: string;
  /** Import: übernommene Presets, die in einen Netzwerkordner aufnehmen (endgültiger Name). Leer → fehlt. */
  netzwerk?: { name: string; dir: string }[];
}

/** Ergebnis von `settings.load()`: die Einstellungen und ob der gemerkte Zielordner da ist. */
export interface GeladeneEinstellungen {
  einstellungen: RecEinstellungen;
  /**
   * null = nicht geprüft. Seit Altfehler RE-7b immer null: `settings:load` prüft den Ordner nicht mehr synchron (ein unerreichbares NAS
   * hielte den Hauptprozess an); der Store fragt nach dem Setzen über `ordnerDa`, ohne darauf zu warten.
   */
  ordnerDa: boolean | null;
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

/** Shape, die der Preload auf `window.jmrec` legt. */
export interface JmrecApi {
  platform: NodeJS.Platform;
  /** Master-Link-Zustand (Spec 3.9): Meldung oder null (Brücke fehlt oder lehnt ab → „unbekannt“). */
  masterLink: () => Promise<MasterLinkMeldungZeile | null>;
  onMasterLink: (cb: (m: MasterLinkMeldungZeile) => void) => () => void;
  /** Lage des Steuerservers (Port 8729), nur lesend; null, solange Main nichts gemeldet hat. */
  fernsteuerung: () => Promise<FernsteuerungMeldung | null>;
  onFernsteuerung: (cb: (m: FernsteuerungMeldung | null) => void) => () => void;
  listDevices: () => Promise<AudioDevice[]>;
  /** Eingang öffnen (Pegel laufen, noch keine Datei). */
  arm: (input: ArmInput) => Promise<OpResult>;
  /** Eingang schließen; in der Aufnahme lehnt der Main ab (`ok: false`, ERST_AUFNAHME_STOPPEN; Altfehler RE-2). */
  disarm: () => Promise<OpResult>;
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
  /** Gemerkte Einstellungen (#291). `save` wartet nicht — es muss auch beim Schließen noch durchgehen. */
  settings: {
    load: () => Promise<GeladeneEinstellungen>;
    save: (e: RecEinstellungen) => void;
  };
  /** Gespeicherte Presets. Alle Aufrufe geben die neue, sortierte Liste zurück. */
  presets: {
    list: () => Promise<RecPreset[]>;
    speichern: (p: RecPreset) => Promise<RecPreset[]>;
    loeschen: (name: string) => Promise<RecPreset[]>;
    exportieren: () => Promise<PresetDateiErgebnis>;
    importieren: () => Promise<PresetDateiErgebnis>;
  };
  /** Gibt es den Ordner? (z. B. Zielordner eines Presets) */
  ordnerDa: (dir: string) => Promise<boolean>;
  /**
   * Abgelehnter Fernbefehl (B6; Altfehler RE-2, RE-2b, RE-7b): der Main schreibt `log` ins Protokoll und zeigt `hinweis` als Meldung
   * bis „OK“ (`recorder:notice`). Sonst ändert sich nichts; Companion sieht es an den Zustandswerten.
   */
  ablehnung: (a: { hinweis: string; log: string }) => Promise<void>;
  /** Altfehler RE-7b: einen Netzwerkordner aus der Show bestätigen; der Main merkt ihn (true) oder lehnt einen ungültigen ab (false). */
  netzordnerBestaetigen: (pfad: string) => Promise<boolean>;
}
