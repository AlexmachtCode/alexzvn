// Geteilte Typen für Main, Preload und Renderer (window.jmndi-API).

export type SendState = 'idle' | 'starting' | 'sending' | 'error';

export type PixelFormat = 'bgra' | 'uyvy';

/** Eine wählbare Aufnahmequelle (Monitor oder Fenster) inkl. Vorschau. */
export interface JmNdiSource {
  /** chromeMediaSourceId aus desktopCapturer.getSources(). */
  id: string;
  name: string;
  type: 'screen' | 'window';
  /** Vorschaubild als data:-URL. */
  thumbnailDataURL: string;
  /** App-Icon (nur bei Fenstern) als data:-URL. */
  appIconDataURL?: string;
}

/** Optionen für den Start des NDI-Versands. */
export interface JmNdiStartOptions {
  sourceId: string;
  targetFps: 30 | 60;
  audio: boolean;
  pixelFormat: PixelFormat;
}

/** Laufzeit-Status des Senders, vom Main-/Utility-Prozess gemeldet. */
export interface JmNdiStatus {
  sendState: SendState;
  /** Sichtbarer NDI-Quellname, z. B. "JM Capture (STUDIO-PC) - Display 1". */
  ndiSourceName?: string;
  width?: number;
  height?: number;
  /** Gemessene ausgehende Bildrate. */
  fps?: number;
  /** Anzahl verbundener NDI-Empfänger (NDIlib_send_get_no_connections). */
  connections?: number;
  audioEnabled: boolean;
  error?: string;
}

/** Einstellungen, die der Renderer ans Tray-Menü spiegelt (#104). */
export interface TraySettings {
  active: boolean;
  targetFps: 30 | 60;
  audio: boolean;
  /** Name der gewählten Quelle (für die Menü-/Tooltip-Anzeige). */
  sourceName: string | null;
}

/** Befehl vom Tray-Menü an den Renderer (#104). */
export type TrayCommand =
  | { kind: 'start' }
  | { kind: 'stop' }
  | { kind: 'setFps'; fps: 30 | 60 }
  | { kind: 'setAudio'; audio: boolean };

/** Die unter window.jmndi bereitgestellte API. */
export interface JmNdiApi {
  platform: string;
  listSources: () => Promise<JmNdiSource[]>;
  start: (opts: JmNdiStartOptions) => Promise<void>;
  stop: () => Promise<void>;
  getStatus: () => Promise<JmNdiStatus>;
  /** Abonniert Status-Pushes; liefert eine Unsubscribe-Funktion. */
  onStatus: (cb: (status: JmNdiStatus) => void) => () => void;
  /** Aktuelle Einstellungen ans Tray-Menü melden (#104). */
  traySync: (settings: TraySettings) => void;
  /** Auf Tray-Befehle hören (#104). Liefert Unsubscribe. */
  onTrayCommand: (cb: (cmd: TrayCommand) => void) => () => void;
}
