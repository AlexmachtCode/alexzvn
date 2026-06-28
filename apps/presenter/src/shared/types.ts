// Shared domain + IPC types for JM Presenter.
// Used by the main process, the preload bridge and the renderer.

export type ViewName = 'editor' | 'presenter' | 'audience';

export type SourceKind = 'pdf' | 'image';

/** A document imported into the project (a multi-page PDF or a single image). */
export interface SourceMeta {
  id: string;
  kind: SourceKind;
  name: string; // original file name, for display
  pageCount: number; // pdf: number of pages, image: always 1
}

export type OverlayKind = 'text' | 'image';

/**
 * An overlay placed on top of a slide. All geometry is normalised to the slide
 * box (0..1) so it renders identically at any resolution (editor, audience, export).
 */
export interface Overlay {
  id: string;
  kind: OverlayKind;
  x: number; // 0..1 — left
  y: number; // 0..1 — top
  w: number; // 0..1 — width
  h: number; // 0..1 — height
  rotation: number; // degrees
  // text overlays
  text?: string;
  fontFrac?: number; // font size as fraction of slide height (e.g. 0.06)
  color?: string;
  bold?: boolean;
  align?: 'left' | 'center' | 'right';
  background?: string | null; // optional box background (e.g. lower-third bar)
  // image overlays
  imageId?: string; // key into the project's image asset map
}

/** A single slide = one source page plus optional overlays + presenter metadata. */
export interface Slide {
  id: string;
  sourceId: string;
  pageIndex: number; // 0-based page within the source
  title: string;
  notes: string;
  hidden: boolean;
  overlays: Overlay[];
}

/** The editable project document (serialised into a .jmpres ZIP). */
export interface ProjectDoc {
  schemaVersion: number;
  name: string;
  slides: Slide[];
  sources: SourceMeta[];
}

/** Audience screen mode — normal slide, or a full black/white pause screen. */
export type ScreenMode = 'live' | 'black' | 'white';

/** Runtime presentation state — owned by the main process, broadcast to windows. */
export interface PresentationState {
  active: boolean;
  index: number; // index into the visible-slide list
  total: number; // number of visible slides
  screen: ScreenMode; // black/white pause screen (B/W keys, remote, buttons)
}

/**
 * Everything the presenter/audience windows need to render, handed over when a
 * presentation starts. Source bytes travel as transferable Uint8Arrays.
 */
export interface PresentationPayload {
  slides: Slide[]; // visible slides, in presentation order
  sources: Record<string, { kind: SourceKind; bytes: Uint8Array }>;
  images: Record<string, Uint8Array>; // overlay image assets by id
  startIndex: number;
}

export interface DisplayInfo {
  id: number;
  label: string;
  bounds: { x: number; y: number; width: number; height: number };
  primary: boolean;
  current: boolean; // is the audience window currently on this display?
}

/** A file picked/imported through the main process, delivered to the renderer. */
export interface ImportedFile {
  name: string;
  kind: SourceKind;
  bytes: Uint8Array;
}

/**
 * Push vom Hauptprozess (PRESENTER OPEN, Issue #81): importierte Dateien als
 * Präsentation vorlegen. `replace` = vorhandenes Projekt ersetzen (frisches Deck).
 */
export interface OpenFilesPayload {
  files: ImportedFile[];
  replace: boolean;
}

/** On-click build animations read from a .pptx (LibreOffice flattens them away). */
export interface OfficeAnimations {
  /** Click-build count per slide, in presentation order. */
  perSlide: number[];
  animatedSlides: number;
  totalBuilds: number;
}

export interface OfficeImportResult {
  ok: boolean;
  name?: string;
  bytes?: Uint8Array; // converted PDF bytes
  error?: string;
  /** Present for .pptx imports that carry on-click build animations. */
  animations?: OfficeAnimations;
  /** True when the (experimental) build-step expansion was applied — the PDF
   *  pages are then already the progressive reveal steps. */
  expanded?: boolean;
}

// ---- Network remote (phone clicker over LAN) ----

/** A selectable network interface to bind the remote server to. */
export interface NetInterface {
  /** IPv4 address, or the sentinel 'all' for 0.0.0.0 (every interface). */
  address: string;
  /** Human label, e.g. "Ethernet · 192.168.1.20" or "Alle Schnittstellen". */
  label: string;
}

/** Persisted remote-control configuration. */
export interface RemoteConfig {
  enabled: boolean;
  /** Bound IPv4 address, or 'all' for every interface. */
  bind: string;
  port: number;
  /** Require a 4-digit PIN from the phone before it can control slides. */
  pinEnabled: boolean;
}

/** Live status of the remote server, broadcast to the presenter window. */
export interface RemoteStatus {
  running: boolean;
  /** Reachable URL for the phone, e.g. "http://192.168.1.20:7330" (null if off). */
  url: string | null;
  /** Active 4-digit PIN while running with pinEnabled (else null). */
  pin: string | null;
  config: RemoteConfig;
  /** Last start error (e.g. port in use), else null. */
  error: string | null;
}

// ---- Timer sync (live countdown from JM Timer over the LAN, #38) ----
//
// The JM Timer broadcasts its full state over socket.io on port 7777. We mirror
// just the countdown subset the presenter needs to show a live readout — no
// dependency on the timer app, same approach the stage-display already uses.

export interface CountdownState {
  durationMs: number;
  delayMs: number;
  startedAtMs: number | null;
  pausedRemainingMs: number | null;
}

export function effectiveDurationMs(cd: CountdownState): number {
  return cd.durationMs + cd.delayMs;
}
export function getCountdownRemaining(cd: CountdownState, now: number = Date.now()): number {
  if (cd.startedAtMs !== null) return effectiveDurationMs(cd) - (now - cd.startedAtMs);
  if (cd.pausedRemainingMs !== null) return cd.pausedRemainingMs;
  return effectiveDurationMs(cd);
}
export function getProjectedEndMs(cd: CountdownState, now: number = Date.now()): number | null {
  if (cd.startedAtMs !== null) return cd.startedAtMs + effectiveDurationMs(cd);
  if (cd.pausedRemainingMs !== null) return now + cd.pausedRemainingMs;
  return null;
}
export function isCountdownRunning(cd: CountdownState): boolean {
  return cd.startedAtMs !== null;
}
export function isCountdownPaused(cd: CountdownState): boolean {
  return cd.startedAtMs === null && cd.pausedRemainingMs !== null;
}

/** Countdown colour thresholds (kept faithful to the timer's own colours). */
export interface ColorConfig {
  normal: string;
  warning: string;
  overtime: string;
  /** Seconds threshold normal → warning. */
  warningAtSec: number;
}

export const DEFAULT_COLORS: ColorConfig = {
  normal: '#FFE819',
  warning: '#FFB81C',
  overtime: '#F61C56',
  warningAtSec: 60,
};

/** Live timer state mirrored into the presenter, broadcast to the windows. */
export interface TimerSource {
  connected: boolean;
  /** Raw countdown (renderer ticks it live); null = unknown. */
  countdown: CountdownState | null;
  activeLabel: string | null;
  nextLabel: string | null;
  colors: ColorConfig;
  /** Speaker message from the timer. */
  message: string;
  blinking: boolean;
}

/** Persisted timer-sync configuration (set once per machine). */
export interface TimerSyncConfig {
  enabled: boolean;
  host: string;
  port: number;
}

/** The window API exposed on `window.jmpr`. */
export interface JmprApi {
  platform: NodeJS.Platform;
  /** Which view this window renders, parsed from the launch URL. */
  view: ViewName;

  files: {
    /** Open PDFs/images and return their bytes. */
    importDocs: () => Promise<ImportedFile[]>;
    /** Open an image to use as an overlay (logo). */
    importImage: () => Promise<ImportedFile | null>;
    /** Convert an Office document (PPTX/DOCX/…) to PDF via LibreOffice. When
     *  `expandBuilds` is set, .pptx on-click animations are split into per-step
     *  slides (experimental; falls back to the flat conversion on any doubt). */
    importOffice: (expandBuilds?: boolean) => Promise<OfficeImportResult>;
    /** Open a .jmpres project; returns the raw zip bytes. */
    openProject: () => Promise<{ name: string; bytes: Uint8Array } | null>;
    /** Save .jmpres project bytes to disk (save dialog). */
    saveProject: (suggestedName: string, bytes: Uint8Array) => Promise<string | null>;
    /** Save exported PDF bytes to disk (save dialog). */
    savePdf: (suggestedName: string, bytes: Uint8Array) => Promise<string | null>;
    /** Push vom Hauptprozess: in einer Show referenziertes .jmpres öffnen. */
    onOpenProject: (cb: (p: { name: string; bytes: Uint8Array }) => void) => () => void;
    /** Push vom Hauptprozess (PRESENTER OPEN): importierte Dateien vorlegen. */
    onOpenFiles: (cb: (p: OpenFilesPayload) => void) => () => void;
  };

  present: {
    /** Hand the payload to the main process and open presenter + audience windows. */
    start: (payload: PresentationPayload, audienceDisplayId: number | null) => Promise<void>;
    /** Fetch the active payload (presenter/audience windows call this on load). */
    getPayload: () => Promise<PresentationPayload | null>;
    getState: () => Promise<PresentationState>;
    goto: (index: number) => Promise<void>;
    next: () => Promise<void>;
    prev: () => Promise<void>;
    stop: () => Promise<void>;
    /** Set the audience pause screen (black/white/live); 'live' shows the slide. */
    setScreen: (mode: ScreenMode) => Promise<void>;
    /** List displays + which one holds the audience window. */
    displays: () => Promise<DisplayInfo[]>;
    /** Move the audience window to a given display (fullscreen). */
    assignAudience: (displayId: number) => Promise<void>;
    toggleAudienceFullscreen: () => Promise<boolean>;
    onState: (cb: (s: PresentationState) => void) => () => void;
  };

  /** Network remote control (phone clicker over LAN). */
  remote: {
    /** Selectable network interfaces to bind to (plus an "all" option). */
    interfaces: () => Promise<NetInterface[]>;
    /** Current server status. */
    status: () => Promise<RemoteStatus>;
    /** Persist config and start/stop the server accordingly; returns new status. */
    apply: (config: RemoteConfig) => Promise<RemoteStatus>;
    /** Subscribe to live status changes (start/stop/error). */
    onStatus: (cb: (s: RemoteStatus) => void) => () => void;
  };

  /** Live timer sync (countdown mirrored from JM Timer over the LAN). */
  timer: {
    /** Current live timer state (connected + countdown snapshot). */
    getState: () => Promise<TimerSource>;
    /** Persisted connection config (enabled/host/port). */
    getConfig: () => Promise<TimerSyncConfig>;
    /** Persist config and (re)connect accordingly; returns the saved config. */
    apply: (config: TimerSyncConfig) => Promise<TimerSyncConfig>;
    /** Subscribe to live timer-state pushes. */
    onState: (cb: (s: TimerSource) => void) => () => void;
  };
}
