// Shared types for JM Grafiktool — used by the main process, the preload bridge
// (window.jmg) and the renderer. Kept dependency-free so it compiles in both the
// Node (main/preload) and DOM (renderer) tsconfig projects.

export type ImageFormat = 'png' | 'jpg' | 'webp';

/** A file the user picked, returned with the bytes already read in the main process. */
export interface PickedImage {
  path: string;
  fileName: string;
  /** Raw file bytes; the renderer decodes these into an ImageBitmap. */
  bytes: Uint8Array;
}

export interface SaveImageRequest {
  /** Suggested base file name without extension. */
  suggestedName: string;
  format: ImageFormat;
  /** Encoded image bytes produced by the renderer (canvas.toBlob). */
  bytes: Uint8Array;
}

export interface SaveImageResult {
  saved: boolean;
  path?: string;
}

export interface OpenedFile {
  path: string;
  fileName: string;
  bytes: Uint8Array;
}

/** Which file types the open dialog should offer. */
export type OpenKind = 'all' | 'project';

export interface SaveBytesRequest {
  suggestedName: string;
  /** File extension without the dot, e.g. 'psd' | 'jmg'. */
  ext: string;
  /** Human label for the dialog filter, e.g. 'Photoshop'. */
  filterName: string;
  bytes: Uint8Array;
}

export interface AiStatus {
  modelPresent: boolean;
  modelId: string;
}

export interface LibraryItem {
  id: string;
  name: string;
  width: number;
  height: number;
  createdAt: number;
  /** Small preview as a data URL, ready to render in the library grid. */
  thumbDataUrl: string;
}

export interface LibraryAddRequest {
  name: string;
  /** Full-resolution PNG of the asset. */
  pngBytes: Uint8Array;
  /** Small PNG thumbnail. */
  thumbBytes: Uint8Array;
  width: number;
  height: number;
}

export interface AiSegmentRequest {
  /** RGBA pixels of a square image, length size*size*4. */
  rgba: Uint8Array;
  size: number;
}

export interface AiSegmentResult {
  /** 8-bit alpha matte, length size*size (255 = foreground). */
  matte: Uint8Array;
  size: number;
}

/** Shape exposed on `window.jmg` by the preload bridge. */
export interface JmgApi {
  platform: NodeJS.Platform;
  /** Resolve the absolute path of a dropped File (Electron webUtils). */
  pathForFile: (file: File) => string;
  dialog: {
    /** Open one or more raster images; bytes are read in the main process. */
    pickImages: () => Promise<PickedImage[]>;
  };
  file: {
    /** Read an arbitrary file path (e.g. a dropped image) into bytes. */
    read: (path: string) => Promise<PickedImage>;
    /** Show a save dialog and write the encoded image to disk. */
    saveImage: (req: SaveImageRequest) => Promise<SaveImageResult>;
    /** Open one file (images, PSD, SVG, TIFF or .jmg projects) as raw bytes. */
    open: (kind: OpenKind) => Promise<OpenedFile | null>;
    /** Show a save dialog and write arbitrary bytes (PSD, .jmg) to disk. */
    saveBytes: (req: SaveBytesRequest) => Promise<SaveImageResult>;
  };
  fonts: {
    /** List font family names installed on the machine. */
    list: () => Promise<string[]>;
  };
  ai: {
    /** Whether the local segmentation model is available. */
    status: () => Promise<AiStatus>;
    /** Run background segmentation on a square RGBA buffer; returns an alpha matte. */
    segment: (req: AiSegmentRequest) => Promise<AiSegmentResult>;
  };
  library: {
    list: () => Promise<LibraryItem[]>;
    add: (req: LibraryAddRequest) => Promise<LibraryItem>;
    remove: (id: string) => Promise<void>;
    /** Full-resolution PNG bytes of a stored asset. */
    read: (id: string) => Promise<Uint8Array | null>;
  };
  shell: {
    reveal: (path: string) => Promise<void>;
    openExternal: (url: string) => Promise<void>;
  };
  /** Show-Integration (C3): der Hauptprozess schiebt eine aus der .jmshow geladene Datei zu. */
  onFileOpened: (cb: (f: OpenedFile) => void) => () => void;
}
