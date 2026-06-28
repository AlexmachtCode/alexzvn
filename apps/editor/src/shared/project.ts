// Projekt-/Timeline-Datenmodell für JM Editor.
//
// Zeiten konsequent in MIKROSEKUNDEN (Integer) → kein Float-Drift, FPS-unabhängig.
// Das Schema trägt bereits Felder für spätere Phasen (Effekte, Multicam), damit
// man erweitert statt umschreibt (siehe Plan: Vorschau/Export-Naht).
import type { MediaInfo } from '@jm/media';

export const PROJECT_FILE_VERSION = 1;
export const PROJECT_FILE_EXT = 'jmedit';

export const US_PER_SEC = 1_000_000;
export const usToSec = (us: number): number => us / US_PER_SEC;
export const secToUs = (sec: number): number => Math.round(sec * US_PER_SEC);

export type MediaKind = 'video' | 'audio' | 'image';
export type ProxyState = 'none' | 'building' | 'ready' | 'failed';

/** Eine importierte Quelldatei (geteilt von mehreren Clips). */
export interface MediaAsset {
  id: string;
  path: string;
  fileName: string;
  kind: MediaKind;
  durationUs: number;
  hasVideo: boolean;
  hasAudio: boolean;
  width?: number;
  height?: number;
  fps?: number;
  /** Roh-Probe (ffprobe) — informativ / für spätere Phasen. */
  probe?: MediaInfo;
  /** Browser-dekodierbarer Proxy fürs Scrubbing (ProRes/MXF/DNxHD …). */
  proxyPath?: string;
  proxyState?: ProxyState;
}

/** Wie ein Clip in die Sequenz-Auflösung eingepasst wird. */
export type ScaleMode = 'fit' | 'fill' | 'stretch';
export interface ClipTransform {
  scaleMode: ScaleMode;
}

/** Übergang am Kopf (eingehende Seite) des Clips — v0.1 nur Kreuzblende. */
export interface Transition {
  kind: 'dissolve';
  durationUs: number;
}

/** Platzhalter fürs spätere Effekt-Parametermodell (Phase 4). */
export interface EffectInstance {
  id: string;
  kind: string;
  params: Record<string, number | string>;
}

/** Stil einer Bauchbinde / eines Titels (Overlay-Spur). */
export interface TitleStyle {
  fontSize: number;
  color: string;
  /** Hintergrundbox hinter dem Text (z. B. "#000000aa") oder null für transparent. */
  background: string | null;
  /** Normierte Position 0..1 (Ankerpunkt unten-links der Box). */
  x: number;
  y: number;
  bold: boolean;
}

export interface TitleSpec {
  text: string;
  subtitle?: string;
  style: TitleStyle;
}

export type ClipKind = 'media' | 'title';

export interface Clip {
  id: string;
  kind: ClipKind;
  /** Bei kind='media': Quelle. Bei 'title': leer. */
  assetId?: string;
  /** Quell-In/Out innerhalb des Assets (µs). Bei 'title': 0..Anzeigedauer. */
  inUs: number;
  outUs: number;
  /** Startposition auf der Spur-Timeline (µs). */
  startUs: number;
  transform?: ClipTransform;
  /** Audio-Verstärkung als linearer Faktor (1 = unverändert). */
  gain?: number;
  /**
   * Verknüpft einen Video-Clip mit seinem ausgekoppelten Audio-Clip (gemeinsame
   * `linkId`). Beim Video-Import wird der Ton als eigener Audio-Clip auf die
   * Audiospur gelegt; die linkId markiert das Paar (Grundlage für späteres
   * gekoppeltes Bearbeiten).
   */
  linkId?: string;
  /**
   * Nur Video-Clips: der eingebettete Ton wird NICHT exportiert, weil der
   * verknüpfte Audio-Clip ihn trägt — verhindert doppelten Ton, wenn die
   * Audiospur eines Videos separat auf die Timeline gelegt wird.
   */
  muteSource?: boolean;
  transitionIn?: Transition;
  effects?: EffectInstance[];
  title?: TitleSpec;
  enabled: boolean;
}

export type TrackKind = 'video' | 'audio' | 'overlay';

export interface Track {
  id: string;
  kind: TrackKind;
  name: string;
  /** Nach startUs sortiert; auf Video-/Audio-Spuren überlappungsfrei (außer Blende). */
  clips: Clip[];
  muted: boolean;
  locked: boolean;
}

export type RateControl = 'quality' | 'vbr' | 'cbr';

export interface ExportSettings {
  presetId: string;
  /** Sequenz-Auflösung/Framerate (Normalisierungsziel). */
  width: number;
  height: number;
  fps: number;
  rateControl: RateControl;
  quality?: number | null;
  bitrateKbps?: number | null;
  audioCodec: string;
  audioBitrateKbps?: number | null;
  useHardware: boolean;
}

/** Winkel-Gruppe für Multicam (v0.2) — im Schema vorgesehen, noch ungenutzt. */
export interface MulticamGroup {
  id: string;
  name: string;
  angles: { assetId: string; offsetUs: number }[];
}

export interface Project {
  version: number;
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  assets: MediaAsset[];
  tracks: Track[];
  export: ExportSettings;
  multicamGroups?: MulticamGroup[];
}

let idSeq = 0;
/** Kollisionsarme ID (Zeit + Zähler + Zufall) — reicht für Clip/Track/Asset-IDs. */
export function newId(prefix = 'id'): string {
  idSeq = (idSeq + 1) % 1_000_000;
  return `${prefix}_${Date.now().toString(36)}_${idSeq.toString(36)}_${Math.floor(
    Math.random() * 1e6,
  ).toString(36)}`;
}

export const DEFAULT_EXPORT: ExportSettings = {
  presetId: 'h264-mp4',
  width: 1920,
  height: 1080,
  fps: 30,
  rateControl: 'quality',
  quality: null,
  bitrateKbps: null,
  audioCodec: 'aac',
  audioBitrateKbps: 192,
  useHardware: true,
};

export function makeEmptyProject(name = 'Unbenanntes Projekt'): Project {
  const now = Date.now();
  return {
    version: PROJECT_FILE_VERSION,
    id: newId('proj'),
    name,
    createdAt: now,
    updatedAt: now,
    assets: [],
    tracks: [
      { id: newId('trk'), kind: 'overlay', name: 'Titel', clips: [], muted: false, locked: false },
      { id: newId('trk'), kind: 'video', name: 'Video 1', clips: [], muted: false, locked: false },
      { id: newId('trk'), kind: 'audio', name: 'Audio 1', clips: [], muted: false, locked: false },
    ],
    export: { ...DEFAULT_EXPORT },
  };
}

/** Migriert ältere Projektdateien auf das aktuelle Schema (idempotent). */
export function migrateProject(raw: unknown): Project {
  const p = raw as Partial<Project>;
  if (!p || typeof p !== 'object') throw new Error('Ungültige Projektdatei.');
  const base = makeEmptyProject(p.name ?? 'Projekt');
  return {
    ...base,
    ...p,
    version: PROJECT_FILE_VERSION,
    export: { ...DEFAULT_EXPORT, ...(p.export ?? {}) },
    assets: p.assets ?? [],
    tracks: p.tracks ?? base.tracks,
  } as Project;
}

// ── Abgeleitete Werte ───────────────────────────────────────────────────────

export const clipDurationUs = (clip: Clip): number => Math.max(0, clip.outUs - clip.inUs);
export const clipEndUs = (clip: Clip): number => clip.startUs + clipDurationUs(clip);

export function trackEndUs(track: Track): number {
  return track.clips.reduce((max, c) => Math.max(max, clipEndUs(c)), 0);
}

export function projectDurationUs(project: Project): number {
  return project.tracks.reduce((max, t) => Math.max(max, trackEndUs(t)), 0);
}

export function findAsset(project: Project, assetId: string | undefined): MediaAsset | undefined {
  if (!assetId) return undefined;
  return project.assets.find((a) => a.id === assetId);
}

/** Die primäre Video-Basisspur (erste Spur der Art 'video'). */
export function getVideoTrack(project: Project): Track | undefined {
  return project.tracks.find((t) => t.kind === 'video');
}

export function tracksOfKind(project: Project, kind: TrackKind): Track[] {
  return project.tracks.filter((t) => t.kind === kind);
}

/** Clips einer Spur nach Startzeit sortiert (neue Liste). */
export function sortedClips(track: Track): Clip[] {
  return [...track.clips].sort((a, b) => a.startUs - b.startUs);
}

/** Der Clip einer Spur, der den Zeitpunkt t (µs) überdeckt (oder undefined). */
export function clipAt(track: Track, tUs: number): Clip | undefined {
  return track.clips.find((c) => tUs >= c.startUs && tUs < clipEndUs(c));
}
