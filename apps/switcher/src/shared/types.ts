import type { OpenSwitcherResult, SaveSwitcherRequest, SaveSwitcherResult } from './project';

export interface ScreenSourceInfo {
  /** chromeMediaSourceId aus desktopCapturer.getSources(). */
  id: string;
  name: string;
  type: 'screen' | 'window';
  thumbnailDataURL: string;
}

export type NdiState = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

/** Zustand EINES NDI-Empfängers (Slice: mehrere gleichzeitig), per recvId. */
export interface NdiStatus {
  /** Empfänger-Kennung (= Engine-Source-id). */
  recvId: string;
  state: NdiState;
  /** verbundener Quellname bzw. Fehlertext bei state === 'error'. */
  source: string | null;
}

/** Ein BGRA-Videoframe, das der utilityProcess → Main → Renderer-Port liefert. */
export interface NdiVideoMessage {
  type: 'video';
  /** BGRA, Länge = lineStride * height (Kopie — über Port strukturgeklont). */
  data: Uint8Array;
  width: number;
  height: number;
  lineStride: number;
  fpsN: number;
  fpsD: number;
}

/** NDI-Teil-API auf window.jmswitch — mehrere Empfänger gleichzeitig (je recvId). */
export interface JmswitchNdiApi {
  /** Sichtbare NDI-Quellen im Netz suchen (Quellnamen). */
  find: (timeoutMs?: number) => Promise<string[]>;
  /** Empfänger `recvId` mit einer Quelle verbinden (eigener utilityProcess). */
  connect: (recvId: string, source: string) => Promise<void>;
  /** Empfänger `recvId` trennen. */
  disconnect: (recvId: string) => Promise<void>;
  /** Status aller Empfänger abfragen. */
  getStatus: () => Promise<NdiStatus[]>;
  /** Auf Status-Änderungen hören. Gibt die Abmeldefunktion zurück. */
  onStatus: (cb: (s: NdiStatus) => void) => () => void;
}

/** Aufnahme-/Stream-Status des Program-Outputs (Slice 5). */
export interface OutputStatus {
  recording: boolean;
  streaming: boolean;
  recPath: string | null;
}

/** Was als NDI-Quelle ausgegeben wird: das Program-Bild oder das Multiview. */
export type NdiOutputSource = 'program' | 'multiview';

/** Status der NDI-Ausgabe (eigener Sender-Prozess). */
export interface NdiOutputStatus {
  active: boolean;
  /** Sichtbarer NDI-Quellname. */
  name: string;
  /** Anzahl verbundener NDI-Empfänger. */
  connections: number;
}

/** Fehler aus dem Output-Pfad (Datei-Schreibfehler, ffmpeg-Exit …). */
export interface OutputError {
  scope: 'record' | 'stream';
  message: string;
}

import type { ControlCommand, SwitcherStateMsg } from '@jm/companion-protocol';

/** Status des TCP-Steuerservers (Slice 6). */
export interface ControlStatus {
  running: boolean;
  port: number;
  clients: number;
}

/** TCP-Fernsteuerung (Bitfocus Companion). */
export interface JmswitchControlApi {
  start: (port: number) => Promise<{ ok: boolean; error?: string; port?: number }>;
  stop: () => Promise<void>;
  getStatus: () => Promise<ControlStatus>;
  onStatus: (cb: (s: ControlStatus) => void) => () => void;
  /** Eingehende Fernsteuer-Befehle (Renderer wendet sie an). */
  onCommand: (cb: (cmd: ControlCommand) => void) => () => void;
  /** Aktuellen Switcher-Zustand an den Server melden (→ Clients). */
  pushState: (state: SwitcherStateMsg) => void;
}

/** Aufnahme (WebM-Datei) + RTMP-Stream (ffmpeg) des Program-Outputs. */
export interface JmswitchOutputApi {
  /** Speicherort wählen + Datei öffnen. */
  recStart: () => Promise<{ ok: boolean; path?: string; error?: string }>;
  /** Aufnahme ohne Dialog (Fernsteuerung): Standardordner + Zeitstempel. */
  recStartAuto: () => Promise<{ ok: boolean; path?: string; error?: string }>;
  /** WebM-Chunk in die Aufnahmedatei schreiben. */
  recChunk: (chunk: Uint8Array) => void;
  /** Aufnahme abschließen. */
  recStop: () => void;
  /** ffmpeg → RTMP starten. `hasAudio` = WebM enthält eine echte Tonspur. */
  streamStart: (
    url: string,
    videoBitrateKbps?: number,
    hasAudio?: boolean,
  ) => Promise<{ ok: boolean; error?: string }>;
  /** WebM-Chunk in ffmpegs stdin schreiben. */
  streamChunk: (chunk: Uint8Array) => void;
  /** Stream beenden (ffmpeg stdin schließen). */
  streamStop: () => void;
  onStatus: (cb: (s: OutputStatus) => void) => () => void;
  onError: (cb: (e: OutputError) => void) => () => void;
  /** NDI-Ausgabe (Program oder Multiview) starten — liefert den Frame-Port-Hinweis. */
  ndiStart: (name: string) => Promise<{ ok: boolean; error?: string }>;
  /** NDI-Ausgabe stoppen. */
  ndiStop: () => Promise<void>;
  /** Status der NDI-Ausgabe abfragen. */
  ndiStatus: () => Promise<NdiOutputStatus>;
  /** Auf NDI-Ausgabe-Status (v. a. Empfängerzahl) hören. */
  onNdiStatus: (cb: (s: NdiOutputStatus) => void) => () => void;
}

/** Ein angeschlossener Monitor (für die Zweitbildschirm-Ausgabe). */
export interface DisplayInfo {
  /** Electron `Display.id`. */
  id: number;
  /** Menschlicher Name (Label oder „Monitor 1 · 1920×1080"). */
  label: string;
  width: number;
  height: number;
  /** Der primäre Monitor (dort läuft i. d. R. die Bedienoberfläche). */
  primary: boolean;
}

/** Zweitbildschirm-Ausgabe: Vollbild-Programmbild auf einem gewählten Monitor. */
export interface JmswitchScreenApi {
  /** Angeschlossene Monitore auflisten (für die Auswahl). */
  listDisplays: () => Promise<DisplayInfo[]>;
  /** Ausgabe an-/abschalten und Ziel-Monitor setzen (0 = Hauptmonitor). */
  setSecondScreen: (enabled: boolean, displayId: number) => Promise<void>;
  /** Ein (komprimiertes) Programm-Frame aus dem Haupt-Renderer an das Ausgabefenster schicken. */
  sendFrame: (data: ArrayBuffer, w: number, h: number) => void;
  /** Nur im Ausgabefenster (view=output): eingehende Programm-Frames empfangen. */
  onFrame: (cb: (data: ArrayBuffer, w: number, h: number) => void) => () => void;
}

/** Shape, die der Preload auf `window.jmswitch` legt. */
export interface JmswitchApi {
  platform: NodeJS.Platform;
  /** Aufnehmbare Monitore/Fenster auflisten (für die Bildschirm-Quelle). */
  listScreens: () => Promise<ScreenSourceInfo[]>;
  /** Quelle für das nächste getDisplayMedia() im Renderer vormerken. */
  armCapture: (sourceId: string) => Promise<void>;
  /** NDI-Empfang (Slice 3). */
  ndi: JmswitchNdiApi;
  /** Aufnahme + RTMP des Program-Outputs (Slice 5). */
  output: JmswitchOutputApi;
  /** TCP-Fernsteuerung / Companion (Slice 6). */
  control: JmswitchControlApi;
  /** Projekt speichern/öffnen (#89). */
  project: JmswitchProjectApi;
  /** Zweitbildschirm-Ausgabe (physischer Programm-Output auf einem Monitor). */
  screen: JmswitchScreenApi;
}

export interface JmswitchProjectApi {
  /** `.jmswitch`-Projekt öffnen (Datei-Dialog). null = abgebrochen. */
  open: () => Promise<OpenSwitcherResult | null>;
  /** Projekt speichern; ohne `path` öffnet sich „Speichern unter". null = abgebrochen. */
  save: (req: SaveSwitcherRequest) => Promise<SaveSwitcherResult | null>;
  /** Show-Integration (C3): Der Hauptprozess schiebt das aus der .jmshow geladene Projekt zu. */
  onOpened: (cb: (res: OpenSwitcherResult) => void) => () => void;
}
