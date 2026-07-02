// JM Switcher — Projektdatei (#89): speichert die Show-Struktur (Quellen-Pool +
// Szenen mit Ebenen/Geometrie/Chroma-Key + Program/Preview + Auto-Dauer) als
// `.jmswitch`-JSON. Live-Inhalte (Bildschirm-/Capture-Streams, NDI-Frames) sind
// hardware-/sessiongebunden und werden NICHT gespeichert:
//   • color/image → vollständig wiederherstellbar (Farbe bzw. Data-URL)
//   • ndi         → über den Quellnamen wieder verbindbar (Auto-Reconnect)
//   • screen/capture → als Platzhalter gespeichert; beim Öffnen offline, per
//                      „neu verbinden" wieder an eine Live-Quelle gekoppelt
//                      (Szenen-Ebenen bleiben erhalten, da die Source-ID gleich bleibt).

export const SWITCHER_FILE_EXT = 'jmswitch';
export const SWITCHER_FILE_VERSION = 1;

export type SwitcherSourceKind = 'color' | 'screen' | 'ndi' | 'image' | 'capture';

export interface SwitcherChromaKey {
  enabled: boolean;
  color: string;
  similarity: number;
  smoothness: number;
  spill: number;
}

export interface SwitcherLayer {
  id: string;
  sourceId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  visible: boolean;
  key?: SwitcherChromaKey;
}

export interface SwitcherScene {
  id: string;
  name: string;
  layers: SwitcherLayer[];
}

export interface SwitcherSource {
  id: string;
  name: string;
  kind: SwitcherSourceKind;
  /** color-Quelle: Hex-Farbe. */
  color?: string;
  /** image-Quelle: Bilddaten als Data-URL. */
  imageDataUrl?: string;
}

/** Der serialisierbare Inhalt (ohne Datei-Metadaten) — die Engine liest/schreibt genau das. */
export interface SwitcherContent {
  sources: SwitcherSource[];
  scenes: SwitcherScene[];
  previewSceneId: string | null;
  programSceneId: string | null;
  autoMs: number;
}

/** Die vollständige Projektdatei. */
export interface SwitcherProject extends SwitcherContent {
  version: number;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

// IPC-Ergebnisse für die Projekt-Dialoge (Main ↔ Preload ↔ Renderer).
export interface OpenSwitcherResult {
  path: string;
  project: SwitcherProject;
}
export interface SaveSwitcherRequest {
  project: SwitcherProject;
  /** Vorhandener Pfad; fehlt er, öffnet sich der Speichern-Dialog. */
  path?: string;
}
export interface SaveSwitcherResult {
  path: string;
}

export function newProjectId(): string {
  return `sw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyContent(): SwitcherContent {
  return { sources: [], scenes: [], previewSceneId: null, programSceneId: null, autoMs: 800 };
}

export function makeEmptyProject(name = 'Unbenanntes Projekt'): SwitcherProject {
  const now = new Date().toISOString();
  return { version: SWITCHER_FILE_VERSION, id: newProjectId(), name, createdAt: now, updatedAt: now, ...emptyContent() };
}

/** Tolerante, idempotente Migration einer geladenen Datei auf das aktuelle Schema. */
export function migrateProject(raw: unknown): SwitcherProject {
  const r = (raw ?? {}) as Partial<SwitcherProject>;
  const now = new Date().toISOString();
  const sources: SwitcherSource[] = Array.isArray(r.sources)
    ? r.sources.filter((s): s is SwitcherSource => !!s && typeof s.id === 'string' && typeof s.kind === 'string')
    : [];
  const scenes: SwitcherScene[] = Array.isArray(r.scenes)
    ? r.scenes
        .filter((s): s is SwitcherScene => !!s && typeof s.id === 'string')
        .map((s) => ({
          id: s.id,
          name: typeof s.name === 'string' ? s.name : 'Szene',
          layers: Array.isArray(s.layers) ? s.layers.filter((l) => !!l && typeof l.sourceId === 'string') : [],
        }))
    : [];
  return {
    version: SWITCHER_FILE_VERSION,
    id: typeof r.id === 'string' ? r.id : newProjectId(),
    name: typeof r.name === 'string' && r.name ? r.name : 'Unbenanntes Projekt',
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : now,
    updatedAt: now,
    sources,
    scenes,
    previewSceneId: typeof r.previewSceneId === 'string' ? r.previewSceneId : scenes[0]?.id ?? null,
    programSceneId: typeof r.programSceneId === 'string' ? r.programSceneId : scenes[0]?.id ?? null,
    autoMs: typeof r.autoMs === 'number' && r.autoMs >= 0 ? r.autoMs : 800,
  };
}
