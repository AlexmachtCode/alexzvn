// Vertrag zwischen Renderer (window.jmed), Preload-Bridge und Main-Prozess.
import type { MediaAsset, Project } from './project';

export type ImportKind = 'video' | 'audio' | 'image';

export interface ThumbRequest {
  path: string;
  atSec: number;
  /** Zielhöhe in px (klein halten — Data-URL). */
  height: number;
}
export interface ThumbResult {
  dataUrl: string;
}

export interface ProxyProgress {
  assetId: string;
  percent: number;
}
export interface ProxyResult {
  assetId: string;
  success: boolean;
  proxyPath?: string;
  error?: string;
}

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

/** Ein vom Renderer (Canvas) gerendertes Titelbild — volle Sequenzauflösung, transparent. */
export interface TitleImage {
  clipId: string;
  /** PNG als data:URL. */
  dataUrl: string;
}

export interface ExportRequest {
  project: Project;
  outputPath: string;
  titleImages: TitleImage[];
}
export interface ExportStartResult {
  exportId: string;
}

export interface ExportProgress {
  exportId: string;
  /** 0..100, oder -1 wenn unbestimmt. */
  percent: number;
  fps?: number;
  speed?: string;
  etaSec?: number;
}
export interface ExportResult {
  exportId: string;
  success: boolean;
  outputPath?: string;
  error?: string;
  canceled?: boolean;
}

export interface PickOutputRequest {
  defaultName: string;
  /** Container-Endung ohne Punkt (mp4/mov). */
  ext: string;
}

import type { EncoderSupport } from '@jm/media';

/** Form, die die Preload-Bridge auf `window.jmed` legt. */
export interface JmedApi {
  platform: NodeJS.Platform;
  pathForFile: (file: File) => string;
  dialog: {
    importMedia: (kind: ImportKind) => Promise<string[]>;
  };
  media: {
    /** Pfade proben + als Assets aufbereiten (ohne Proxy-Erzeugung). */
    import: (paths: string[]) => Promise<MediaAsset[]>;
    thumb: (req: ThumbRequest) => Promise<ThumbResult>;
  };
  proxy: {
    /** Proxy für ein Asset erzeugen (falls nötig); Ergebnis via Events. */
    ensure: (asset: MediaAsset) => Promise<void>;
  };
  project: {
    open: () => Promise<OpenProjectResult | null>;
    save: (req: SaveProjectRequest) => Promise<SaveProjectResult | null>;
  };
  export: {
    pickOutput: (req: PickOutputRequest) => Promise<string | null>;
    start: (req: ExportRequest) => Promise<ExportStartResult>;
    cancel: (exportId: string) => Promise<void>;
  };
  encoders: {
    get: () => Promise<EncoderSupport>;
  };
  shell: {
    reveal: (path: string) => Promise<void>;
    openExternal: (url: string) => Promise<void>;
  };
  onProxyProgress: (cb: (p: ProxyProgress) => void) => () => void;
  onProxyDone: (cb: (r: ProxyResult) => void) => () => void;
  onExportProgress: (cb: (p: ExportProgress) => void) => () => void;
  onExportDone: (cb: (r: ExportResult) => void) => () => void;
  /** Show-Integration (C3): der Hauptprozess schiebt ein aus der .jmshow geladenes Projekt zu. */
  onProjectOpened: (cb: (r: OpenProjectResult) => void) => () => void;
}
