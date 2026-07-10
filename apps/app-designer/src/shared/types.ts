import type { AppProject } from '@jm/appkit';

/** Ein Asset im Speicher: Metadaten aus dem Dokument + die Bytes. */
export interface AssetBlob {
  id: string;
  fileName: string;
  mime: string;
  /** Rohbytes; über IPC als Uint8Array (strukturiert geklont). */
  bytes: Uint8Array;
}

export interface DisplayInfo {
  id: number;
  label: string;
  primary: boolean;
  width: number;
  height: number;
}

/**
 * Rohes .jmapp beim Öffnen. Der Main liest nur Bytes; entpackt wird im Renderer
 * (fflate), wie in apps/grafiktool — so bleibt der ZIP-Code an einer Stelle.
 */
export interface OpenedProject {
  path: string;
  zipBytes: Uint8Array;
}

export interface SaveResult {
  path: string | null;
  canceled: boolean;
}

export interface ExportResult {
  dir: string | null;
  canceled: boolean;
  /** Gesamtgröße des Bundles in Bytes (für die Größen-Warnung). */
  bytes: number;
}

export interface TemplateInfo {
  id: string;
  name: string;
  description: string;
}

/** Preload-Bridge (window.jmapp). */
export interface JmAppDesignerApi {
  platform: string;

  listTemplates(): Promise<TemplateInfo[]>;
  loadTemplate(id: string): Promise<AppProject>;

  openProject(): Promise<OpenedProject | null>;
  /** `zipBytes` erzeugt der Renderer (fflate) — der Main schreibt nur. */
  saveProject(zipBytes: Uint8Array, currentPath: string | null): Promise<SaveResult>;
  saveProjectAs(zipBytes: Uint8Array): Promise<SaveResult>;

  importAsset(): Promise<AssetBlob[]>;

  /** Dokument + Assets in den Vorschau-/Kiosk-Speicher stellen (hinter jmapp://). */
  publish(doc: AppProject, assets: AssetBlob[]): Promise<void>;
  /** URL des Vorschau-Frames (jmapp://preview/index.html). */
  previewUrl(): Promise<string>;

  exportBundle(doc: AppProject, assets: AssetBlob[]): Promise<ExportResult>;

  listDisplays(): Promise<DisplayInfo[]>;
  openKiosk(displayId: number | null): Promise<void>;
  closeKiosk(): Promise<void>;
  isKioskOpen(): Promise<boolean>;

  revealPath(path: string): Promise<void>;
}

declare global {
  interface Window {
    jmapp: JmAppDesignerApi;
  }
}
