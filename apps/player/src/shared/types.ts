export type MediaKind = 'audio' | 'video';
export type PlaylistKind = 'playlist' | 'soundboard';

/** Bibliotheks-Eintrag (camelCase-Sicht der media_items-Zeile). */
export interface MediaItem {
  id: number;
  path: string;
  fileName: string;
  kind: MediaKind;
  title: string | null;
  artist: string | null;
  durationSec: number;
  sizeBytes: number;
  format: string | null;
  codec: string | null;
  thumbPath: string | null;
  addedAt: number;
  lastPlayedAt: number | null;
}

export interface Playlist {
  id: number;
  name: string;
  kind: PlaylistKind;
  createdAt: number;
  updatedAt: number;
}

/** Playlist-Eintrag inkl. eingebettetem Medium (JOIN). */
export interface PlaylistItem {
  id: number;
  playlistId: number;
  mediaId: number;
  position: number;
  media: MediaItem;
}

/** Ein Soundboard-Pad inkl. (optional) zugewiesenem Medium (JOIN). */
export interface Cue {
  id: number;
  playlistId: number;
  mediaId: number | null;
  label: string;
  slot: number;
  hotkey: string | null;
  color: string | null;
  gainDb: number;
  loop: boolean;
  media: MediaItem | null;
}

export interface CueInput {
  playlistId: number;
  slot: number;
  mediaId: number | null;
  label: string;
  hotkey?: string | null;
  color?: string | null;
  gainDb?: number;
  loop?: boolean;
}

// ---- Cue-Show (QLab-artig) ----

export interface Show {
  id: number;
  name: string;
  createdAt: number;
  updatedAt: number;
}

/** Ein Cue innerhalb einer Show inkl. Timing + eingebettetem Medium (JOIN). */
export interface ShowCue {
  id: number;
  showId: number;
  mediaId: number | null;
  label: string;
  position: number;
  /** Vorlaufzeit in s: nach GO wartet der Cue, bevor er startet. */
  preWaitSec: number;
  /** Beim Ende dieses Cues automatisch den nächsten feuern. */
  autoContinue: boolean;
  fadeInSec: number;
  fadeOutSec: number;
  gainDb: number;
  loop: boolean;
  media: MediaItem | null;
}

/** Teil-Update der editierbaren Felder eines Show-Cues. */
export interface ShowCuePatch {
  label?: string;
  preWaitSec?: number;
  autoContinue?: boolean;
  fadeInSec?: number;
  fadeOutSec?: number;
  gainDb?: number;
  loop?: boolean;
}

// ---- Video-Ausgabefenster (2. Screen) ----

export interface DisplayInfo {
  id: number;
  label: string;
  primary: boolean;
  width: number;
  height: number;
}

/** Befehle vom Hauptfenster an das Video-Ausgabefenster. */
export type OutputCommand =
  | { type: 'load'; url: string; gainDb: number; loop: boolean; fadeInSec: number }
  | { type: 'stop'; fadeOutSec: number }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'black' };

/** Wiedergabe-Position des Ausgabe-Videos (Ausgabe → Hauptfenster, Issue #41). */
export interface OutputTime {
  currentTime: number;
  duration: number;
}

export interface ImportResult {
  added: number;
  skipped: number;
  failed: number;
  /** Erste Fehlermeldung (z. B. DB-Problem), falls etwas hart fehlschlug. */
  error?: string;
}

/**
 * Show-Integration (C3): aus dem `settings`-Block der .jmshow übernommene
 * Player-Voreinstellungen. `show` aktiviert eine Cue-Show (Name oder DB-ID,
 * gleiche Auflösung wie der Companion-Befehl `loadShow`); `outputDisplayId`
 * merkt den Ausgabe-Monitor (kein Auto-Fenster — greift, wenn die Ausgabe für
 * einen Video-Cue automatisch öffnet).
 */
export interface PlayerShowSettings {
  show?: string;
  outputDisplayId?: number;
}

/** Shape, die der Preload auf `window.jmplay` legt. */
/**
 * Befehl der TCP-Fernsteuerung (Bitfocus Companion), vom Main an den Renderer
 * gepusht. Zielt auf die Cue-Show (Standby/GO) und das Soundboard (Pads).
 */
export type RemoteCommand =
  | { t: 'go' } // Standby-Cue feuern (= GO/PLAY)
  | { t: 'stop' } // alle laufenden Cues stoppen
  | { t: 'pause' } // Pause/Resume umschalten
  | { t: 'panic' } // Hard-Stop
  | { t: 'cue'; n: number } // Show-Cue n (1-basiert) feuern
  | { t: 'standby'; n: number } // Standby auf Cue n (1-basiert) setzen
  | { t: 'next' } // Standby +1
  | { t: 'prev' } // Standby -1
  | { t: 'pad'; slot: number } // Soundboard-Pad (slot) triggern
  | { t: 'loadShow'; show: string }; // Show aus der Bibliothek aktivieren (Name oder DB-ID)

/** Wiedergabe-Zustand, vom Renderer an den Main gemeldet (für Companion-STATE). */
export interface RemotePlayerState {
  /** Spielt etwas (Cues oder Ausgabe-Video). */
  playing: boolean;
  /** Cue-Show pausiert. */
  paused: boolean;
  /** Standby-Cue (1-basiert; 0 = keiner). */
  standby: number;
  /** Titel des Standby-Cues (leer → '-'). */
  standbyLabel: string;
  /** Anzahl Cues in der aktiven Show. */
  cues: number;
  /** Anzahl gerade klingender/pending Cues. */
  playingCount: number;
}

export interface JmplayApi {
  platform: NodeJS.Platform;
  pathForFile: (file: File) => string;
  /** Lokalen Pfad in eine vom Renderer ladbare `jmedia://`-URL übersetzen. */
  mediaUrl: (path: string) => string;
  dialog: {
    pickFolders: () => Promise<string[]>;
    pickFiles: () => Promise<string[]>;
  };
  library: {
    list: () => Promise<MediaItem[]>;
    /** Dateien oder Ordner importieren (Ordner werden rekursiv gescannt). */
    importPaths: (paths: string[]) => Promise<ImportResult>;
    remove: (id: number) => Promise<void>;
    /** Thumbnail erzeugen (falls nötig) + Pfad liefern; null wenn nicht möglich. */
    thumb: (id: number) => Promise<string | null>;
    markPlayed: (id: number) => Promise<void>;
  };
  playlists: {
    list: () => Promise<Playlist[]>;
    create: (name: string, kind?: PlaylistKind) => Promise<Playlist>;
    rename: (id: number, name: string) => Promise<void>;
    remove: (id: number) => Promise<void>;
    items: (playlistId: number) => Promise<PlaylistItem[]>;
    addItems: (playlistId: number, mediaIds: number[]) => Promise<void>;
    removeItem: (itemId: number) => Promise<void>;
    reorder: (playlistId: number, orderedItemIds: number[]) => Promise<void>;
  };
  cues: {
    list: (playlistId: number) => Promise<Cue[]>;
    assign: (input: CueInput) => Promise<Cue>;
    clear: (playlistId: number, slot: number) => Promise<void>;
  };
  shows: {
    list: () => Promise<Show[]>;
    create: (name: string) => Promise<Show>;
    rename: (id: number, name: string) => Promise<void>;
    remove: (id: number) => Promise<void>;
    cues: (showId: number) => Promise<ShowCue[]>;
    addCues: (showId: number, mediaIds: number[]) => Promise<void>;
    removeCue: (cueId: number) => Promise<void>;
    reorder: (showId: number, orderedCueIds: number[]) => Promise<void>;
    updateCue: (cueId: number, patch: ShowCuePatch) => Promise<ShowCue>;
  };
  /** Video-Ausgabefenster (2. Screen). */
  output: {
    displays: () => Promise<DisplayInfo[]>;
    open: (displayId?: number) => Promise<void>;
    close: () => Promise<void>;
    isOpen: () => Promise<boolean>;
    /** Vollbild am Ausgabeschirm ein/aus; liefert den neuen Zustand (Issue #31). */
    toggleFullscreen: () => Promise<boolean>;
    /** Befehl ans Ausgabefenster (Hauptfenster → Ausgabe). */
    command: (cmd: OutputCommand) => Promise<void>;
    /** Ausgabefenster meldet, dass das aktuelle Video natürlich endete. */
    notifyEnded: () => Promise<void>;
    /** Ausgabe-Seite: aktuelle Wiedergabe-Position melden (Issue #41). */
    reportTime: (t: OutputTime) => Promise<void>;
    /** Ausgabe-Seite: auf Befehle hören. Liefert Unsubscribe. */
    onCommand: (cb: (cmd: OutputCommand) => void) => () => void;
    /** Hauptfenster-Seite: auf „Video zu Ende" hören. Liefert Unsubscribe. */
    onEnded: (cb: () => void) => () => void;
    /** Hauptfenster-Seite: auf Positions-Updates des Ausgabe-Videos hören. */
    onTime: (cb: (t: OutputTime) => void) => () => void;
  };
  /** TCP-Fernsteuerung (Bitfocus Companion) ↔ Renderer. */
  remote: {
    /** Auf Fernsteuer-Befehle hören (Main → Renderer). Liefert Unsubscribe. */
    onCommand: (cb: (cmd: RemoteCommand) => void) => () => void;
    /** Wiedergabe-Zustand an den Main melden (Renderer → Steuerserver). */
    reportState: (state: RemotePlayerState) => Promise<void>;
  };
  shell: {
    reveal: (path: string) => Promise<void>;
    openExternal: (url: string) => Promise<void>;
  };
  /** Show-Integration (C3): beim Start ausstehende Show-Voreinstellungen abholen (Kaltstart). */
  takeShowSettings: () => Promise<PlayerShowSettings | null>;
  /** Show-Integration (C3): Voreinstellungen, die zur Laufzeit per Deep-Link ankommen. Liefert Unsubscribe. */
  onShowSettings: (cb: (s: PlayerShowSettings) => void) => () => void;
}
