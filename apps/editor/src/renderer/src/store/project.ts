import { create } from 'zustand';
import {
  clipDurationUs,
  clipEndUs,
  getVideoTrack,
  makeEmptyProject,
  newId,
  projectDurationUs,
  secToUs,
  sortedClips,
  trackEndUs,
  type Clip,
  type MediaAsset,
  type Project,
  type TitleSpec,
  type Track,
} from '@shared/project';
import type { ProxyProgress, ProxyResult } from '@shared/ipc-types';

const HISTORY_CAP = 50;

export interface ProxyStatus {
  state: 'none' | 'building' | 'ready' | 'failed';
  percent: number;
}

export interface ExportStatus {
  running: boolean;
  percent: number;
  etaSec?: number;
  exportId?: string;
  message?: string;
  lastOutput?: string;
  error?: string;
}

interface State {
  present: Project;
  past: Project[];
  future: Project[];
  filePath: string | null;
  dirty: boolean;

  selectedClipId: string | null;
  playheadUs: number;
  playing: boolean;
  pxPerSec: number;

  /** Aktive Ziel-Videospur für Einfügen/Überschreiben/Anhängen. null = erste Videospur. */
  activeVideoTrackId: string | null;

  // ── Quelle-Monitor (Source) ───────────────────────────────────────────────
  /** Im Quelle-Monitor geladenes Asset (oder null). */
  sourceAssetId: string | null;
  /** Quell-In/Out (µs, innerhalb des Assets) für Insert/Overwrite. */
  sourceInUs: number;
  sourceOutUs: number;
  /** Abspielposition im Quelle-Monitor (µs). */
  sourcePlayheadUs: number;

  proxies: Record<string, ProxyStatus>;
  exportStatus: ExportStatus;

  // intern: Snapshot vor einer Drag-Interaktion
  _dragBefore: Project | null;

  // ── Projekt / History ─────────────────────────────────────────────────────
  newProject: () => void;
  loadProject: (path: string, project: Project) => void;
  commit: (label: string, mutate: (draft: Project) => void) => void;
  /** Projektänderung OHNE History (Metadaten wie Proxy-Pfade). */
  patchProject: (mutate: (draft: Project) => void) => void;
  undo: () => void;
  redo: () => void;
  beginDrag: () => void;
  dragUpdate: (mutate: (draft: Project) => void) => void;
  endDrag: () => void;

  // ── Auswahl / Transport ───────────────────────────────────────────────────
  select: (clipId: string | null) => void;
  setPlayhead: (us: number) => void;
  setPlaying: (playing: boolean) => void;
  setZoom: (pxPerSec: number) => void;

  // ── Quelle-Monitor ────────────────────────────────────────────────────────
  loadSource: (assetId: string) => void;
  setSourcePlayhead: (us: number) => void;
  setSourceIn: (us: number) => void;
  setSourceOut: (us: number) => void;
  /** Quelle (mit In/Out) am Programm-Playhead in die Timeline setzen. */
  insertFromSource: (mode: 'insert' | 'overwrite') => void;

  // ── Spuren ────────────────────────────────────────────────────────────────
  setActiveVideoTrack: (trackId: string) => void;
  addVideoTrack: () => void;
  removeTrack: (trackId: string) => void;

  // ── Bearbeiten ────────────────────────────────────────────────────────────
  addAssets: (assets: MediaAsset[]) => void;
  addAssetToTimeline: (assetId: string) => void;
  addTitle: () => void;
  splitAtPlayhead: () => void;
  deleteSelected: () => void;
  updateClip: (clipId: string, patch: Partial<Clip>, label?: string) => void;
  setExportStatus: (patch: Partial<ExportStatus>) => void;
  setProxyProgress: (p: ProxyProgress) => void;
  setProxyDone: (r: ProxyResult) => void;
}

const clone = (p: Project): Project => structuredClone(p);

function pushHistory(state: State, before: Project): Partial<State> {
  const past = [...state.past, before];
  if (past.length > HISTORY_CAP) past.shift();
  return { past, future: [] };
}

/** Finde Clip + Spur per ID. */
export function locateClip(project: Project, clipId: string | null): { track: Track; clip: Clip } | null {
  if (!clipId) return null;
  for (const track of project.tracks) {
    const clip = track.clips.find((c) => c.id === clipId);
    if (clip) return { track, clip };
  }
  return null;
}

const clampNum = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(v, hi));

/** Aktive Ziel-Videospur (oder erste Videospur als Fallback). */
function resolveVideoTrack(project: Project, activeId: string | null): Track | undefined {
  if (activeId) {
    const t = project.tracks.find((tt) => tt.id === activeId && tt.kind === 'video');
    if (t) return t;
  }
  return project.tracks.find((tt) => tt.kind === 'video');
}

/**
 * Ripple-Insert über ALLE Spuren: am Zeitpunkt `atUs` einen Spalt der Länge
 * `lenUs` aufmachen. Clips, die den Punkt überspannen, werden geteilt; alles ab
 * `atUs` rückt um `lenUs` nach hinten — so bleibt die Synchronität aller Spuren.
 */
function rippleInsertAll(project: Project, atUs: number, lenUs: number): void {
  for (const track of project.tracks) {
    for (const clip of [...track.clips]) {
      if (clip.startUs < atUs && clipEndUs(clip) > atUs) {
        const cutSource = clip.inUs + (atUs - clip.startUs);
        track.clips.push({
          ...structuredClone(clip),
          id: newId('clip'),
          inUs: cutSource,
          startUs: atUs,
          transitionIn: undefined,
        });
        clip.outUs = cutSource;
      }
    }
    for (const clip of track.clips) {
      if (clip.startUs >= atUs) clip.startUs += lenUs;
    }
  }
}

/**
 * Überschreiben: räumt auf EINER Spur das Intervall [fromUs, toUs) frei — voll
 * überdeckte Clips entfallen, randüberlappende werden getrimmt, ein das Intervall
 * komplett umschließender Clip wird in zwei geteilt.
 */
function overwriteRegion(track: Track, fromUs: number, toUs: number): void {
  const kept: Clip[] = [];
  for (const clip of track.clips) {
    const s = clip.startUs;
    const e = clipEndUs(clip);
    if (e <= fromUs || s >= toUs) {
      kept.push(clip);
      continue;
    }
    const coversLeft = s < fromUs;
    const coversRight = e > toUs;
    if (coversLeft && coversRight) {
      const right: Clip = {
        ...structuredClone(clip),
        id: newId('clip'),
        inUs: clip.inUs + (toUs - s),
        startUs: toUs,
        transitionIn: undefined,
      };
      clip.outUs = clip.inUs + (fromUs - s);
      kept.push(clip, right);
    } else if (coversLeft) {
      clip.outUs = clip.inUs + (fromUs - s);
      kept.push(clip);
    } else if (coversRight) {
      clip.inUs += toUs - s;
      clip.startUs = toUs;
      clip.transitionIn = undefined;
      kept.push(clip);
    }
    // sonst (voll überdeckt): verwerfen
  }
  track.clips = kept;
}

export const useProject = create<State>((set, get) => ({
  present: makeEmptyProject(),
  past: [],
  future: [],
  filePath: null,
  dirty: false,
  selectedClipId: null,
  playheadUs: 0,
  playing: false,
  pxPerSec: 90,
  activeVideoTrackId: null,
  sourceAssetId: null,
  sourceInUs: 0,
  sourceOutUs: 0,
  sourcePlayheadUs: 0,
  proxies: {},
  exportStatus: { running: false, percent: 0 },
  _dragBefore: null,

  newProject: () =>
    set({
      present: makeEmptyProject(),
      past: [],
      future: [],
      filePath: null,
      dirty: false,
      selectedClipId: null,
      playheadUs: 0,
      playing: false,
      activeVideoTrackId: null,
      sourceAssetId: null,
      sourceInUs: 0,
      sourceOutUs: 0,
      sourcePlayheadUs: 0,
    }),

  loadProject: (path, project) =>
    set({
      present: project,
      past: [],
      future: [],
      filePath: path,
      dirty: false,
      selectedClipId: null,
      playheadUs: 0,
      playing: false,
      activeVideoTrackId: null,
      sourceAssetId: null,
      sourceInUs: 0,
      sourceOutUs: 0,
      sourcePlayheadUs: 0,
    }),

  commit: (_label, mutate) =>
    set((state) => {
      const before = clone(state.present);
      const draft = clone(state.present);
      mutate(draft);
      return { present: draft, dirty: true, ...pushHistory(state, before) };
    }),

  patchProject: (mutate) =>
    set((state) => {
      const draft = clone(state.present);
      mutate(draft);
      return { present: draft };
    }),

  undo: () =>
    set((state) => {
      if (state.past.length === 0) return {};
      const past = [...state.past];
      const prev = past.pop()!;
      return { present: prev, past, future: [clone(state.present), ...state.future], dirty: true };
    }),

  redo: () =>
    set((state) => {
      if (state.future.length === 0) return {};
      const future = [...state.future];
      const next = future.shift()!;
      return { present: next, future, past: [...state.past, clone(state.present)], dirty: true };
    }),

  beginDrag: () => set((state) => ({ _dragBefore: clone(state.present) })),
  dragUpdate: (mutate) =>
    set((state) => {
      const draft = clone(state.present);
      mutate(draft);
      return { present: draft, dirty: true };
    }),
  endDrag: () =>
    set((state) => {
      if (!state._dragBefore) return {};
      return { ...pushHistory(state, state._dragBefore), _dragBefore: null };
    }),

  select: (clipId) => set({ selectedClipId: clipId }),
  setPlayhead: (us) =>
    set((state) => ({ playheadUs: Math.max(0, Math.min(us, Math.max(0, projectDurationUs(state.present)))) })),
  setPlaying: (playing) => set({ playing }),
  setZoom: (pxPerSec) => set({ pxPerSec: Math.max(8, Math.min(600, pxPerSec)) }),

  // ── Quelle-Monitor ────────────────────────────────────────────────────────
  loadSource: (assetId) => {
    const asset = get().present.assets.find((a) => a.id === assetId);
    if (!asset) return;
    set({
      sourceAssetId: assetId,
      sourceInUs: 0,
      sourceOutUs: asset.durationUs,
      sourcePlayheadUs: 0,
    });
  },

  setSourcePlayhead: (us) => {
    const asset = get().present.assets.find((a) => a.id === get().sourceAssetId);
    const max = asset ? asset.durationUs : 0;
    set({ sourcePlayheadUs: clampNum(us, 0, max) });
  },

  setSourceIn: (us) =>
    set((state) => {
      const asset = state.present.assets.find((a) => a.id === state.sourceAssetId);
      const max = asset ? asset.durationUs : 0;
      const inUs = clampNum(us, 0, max);
      return { sourceInUs: inUs, sourceOutUs: Math.max(state.sourceOutUs, inUs) };
    }),

  setSourceOut: (us) =>
    set((state) => {
      const asset = state.present.assets.find((a) => a.id === state.sourceAssetId);
      const max = asset ? asset.durationUs : 0;
      const outUs = clampNum(us, 0, max);
      return { sourceOutUs: outUs, sourceInUs: Math.min(state.sourceInUs, outUs) };
    }),

  insertFromSource: (mode) => {
    const { sourceAssetId, sourceInUs, sourceOutUs, playheadUs, present } = get();
    if (!sourceAssetId) return;
    const asset = present.assets.find((a) => a.id === sourceAssetId);
    if (!asset) return;
    const inUs = clampNum(sourceInUs, 0, asset.durationUs);
    const outUs = clampNum(sourceOutUs, inUs, asset.durationUs);
    const lenUs = outUs - inUs;
    if (lenUs <= 0) return;
    const wantVideo = asset.hasVideo;
    get().commit(mode === 'insert' ? 'Quelle einfügen' : 'Quelle überschreiben', (draft) => {
      const track = wantVideo
        ? resolveVideoTrack(draft, get().activeVideoTrackId)
        : draft.tracks.find((t) => t.kind === 'audio');
      if (!track) return;
      // Video mit Ton: Audiospur verknüpft auf die Audiospur legen (wie beim
      // Import), Video-Ton per muteSource vom Export ausnehmen.
      const audioTrack =
        wantVideo && asset.hasAudio ? draft.tracks.find((t) => t.kind === 'audio') : undefined;
      const linkId = audioTrack ? newId('link') : undefined;
      if (mode === 'insert') {
        rippleInsertAll(draft, playheadUs, lenUs); // macht auf ALLEN Spuren Platz
      } else {
        overwriteRegion(track, playheadUs, playheadUs + lenUs);
        if (audioTrack) overwriteRegion(audioTrack, playheadUs, playheadUs + lenUs);
      }
      track.clips.push({
        id: newId('clip'),
        kind: 'media',
        assetId: sourceAssetId,
        inUs,
        outUs,
        startUs: playheadUs,
        gain: 1,
        transform: { scaleMode: 'fit' },
        enabled: true,
        ...(audioTrack ? { muteSource: true, linkId } : {}),
      });
      if (audioTrack) {
        audioTrack.clips.push({
          id: newId('clip'),
          kind: 'media',
          assetId: sourceAssetId,
          inUs,
          outUs,
          startUs: playheadUs,
          gain: 1,
          enabled: true,
          linkId,
        });
      }
    });
    // Playhead ans Ende des eingefügten Clips ziehen (Verkettung wie in NLEs).
    set({ playheadUs: playheadUs + lenUs });
  },

  // ── Spuren ────────────────────────────────────────────────────────────────
  setActiveVideoTrack: (trackId) => set({ activeVideoTrackId: trackId }),

  addVideoTrack: () => {
    const id = newId('trk');
    get().commit('Videospur hinzufügen', (draft) => {
      const count = draft.tracks.filter((t) => t.kind === 'video').length;
      const track: Track = {
        id,
        kind: 'video',
        name: `Video ${count + 1}`,
        clips: [],
        muted: false,
        locked: false,
      };
      // Neue Videospur über die bestehenden legen (nach den Overlay-Spuren).
      const firstVideoIdx = draft.tracks.findIndex((t) => t.kind === 'video');
      if (firstVideoIdx < 0) draft.tracks.push(track);
      else draft.tracks.splice(firstVideoIdx, 0, track);
    });
    set({ activeVideoTrackId: id });
  },

  removeTrack: (trackId) => {
    const track = get().present.tracks.find((t) => t.id === trackId);
    if (!track) return;
    // Mindestens eine Videospur muss bleiben.
    if (track.kind === 'video' && get().present.tracks.filter((t) => t.kind === 'video').length <= 1)
      return;
    get().commit('Spur entfernen', (draft) => {
      draft.tracks = draft.tracks.filter((t) => t.id !== trackId);
    });
    if (get().activeVideoTrackId === trackId) set({ activeVideoTrackId: null });
  },

  addAssets: (assets) =>
    set((state) => {
      const before = clone(state.present);
      const draft = clone(state.present);
      draft.assets.push(...assets);
      return { present: draft, dirty: true, ...pushHistory(state, before) };
    }),

  addAssetToTimeline: (assetId) =>
    get().commit('Clip hinzufügen', (draft) => {
      const asset = draft.assets.find((a) => a.id === assetId);
      if (!asset) return;
      const wantVideo = asset.hasVideo;
      const track = wantVideo
        ? resolveVideoTrack(draft, get().activeVideoTrackId)
        : draft.tracks.find((t) => t.kind === 'audio');
      if (!track) return;
      const start = trackEndUs(track);

      // Video MIT Ton: die Audiospur separat (verknüpft) auf die Audiospur legen,
      // damit der Ton sichtbar/editierbar ist. Den eingebetteten Video-Ton dann
      // per muteSource vom Export ausnehmen (sonst doppelt). Fehlt eine Audiospur,
      // bleibt der Ton am Video-Clip (kein Verlust).
      const audioTrack =
        wantVideo && asset.hasAudio ? draft.tracks.find((t) => t.kind === 'audio') : undefined;
      const linkId = audioTrack ? newId('link') : undefined;

      track.clips.push({
        id: newId('clip'),
        kind: 'media',
        assetId,
        inUs: 0,
        outUs: asset.durationUs,
        startUs: start,
        gain: 1,
        transform: { scaleMode: 'fit' },
        enabled: true,
        ...(audioTrack ? { muteSource: true, linkId } : {}),
      });

      if (audioTrack) {
        audioTrack.clips.push({
          id: newId('clip'),
          kind: 'media',
          assetId,
          inUs: 0,
          outUs: asset.durationUs,
          startUs: start, // synchron zum Video-Clip
          gain: 1,
          enabled: true,
          linkId,
        });
      }
    }),

  addTitle: () =>
    get().commit('Titel hinzufügen', (draft) => {
      const track = draft.tracks.find((t) => t.kind === 'overlay');
      if (!track) return;
      const title: TitleSpec = {
        text: 'Vorname Nachname',
        subtitle: 'Funktion',
        style: { fontSize: 56, color: '#ffffff', background: '#000000cc', x: 0.07, y: 0.86, bold: true },
      };
      const start = get().playheadUs;
      track.clips.push({
        id: newId('clip'),
        kind: 'title',
        inUs: 0,
        outUs: secToUs(5),
        startUs: start,
        title,
        enabled: true,
      });
    }),

  splitAtPlayhead: () => {
    const { present, playheadUs } = get();
    const loc = locateClip(present, get().selectedClipId);
    // Splitte den ausgewählten Clip, sonst den Clip unter dem Playhead auf der Videospur.
    let target = loc;
    if (!target || playheadUs <= target.clip.startUs || playheadUs >= clipEndUs(target.clip)) {
      target = null;
      for (const track of present.tracks) {
        const clip = track.clips.find((c) => playheadUs > c.startUs && playheadUs < clipEndUs(c));
        if (clip) {
          target = { track, clip };
          break;
        }
      }
    }
    if (!target) return;
    const { track: t, clip: c } = target;
    const offset = playheadUs - c.startUs; // in Timeline-µs ab Clipanfang
    get().commit('Clip teilen', (draft) => {
      const track = draft.tracks.find((tt) => tt.id === t.id);
      const clip = track?.clips.find((cc) => cc.id === c.id);
      if (!track || !clip) return;
      const cutSource = clip.inUs + offset;
      const right: Clip = {
        ...structuredClone(clip),
        id: newId('clip'),
        inUs: cutSource,
        startUs: clip.startUs + offset,
        transitionIn: undefined,
      };
      clip.outUs = cutSource;
      track.clips.push(right);
    });
  },

  deleteSelected: () => {
    const id = get().selectedClipId;
    if (!id) return;
    get().commit('Clip löschen', (draft) => {
      for (const track of draft.tracks) {
        const idx = track.clips.findIndex((c) => c.id === id);
        if (idx >= 0) {
          track.clips.splice(idx, 1);
          break;
        }
      }
    });
    set({ selectedClipId: null });
  },

  updateClip: (clipId, patch, label = 'Clip ändern') =>
    get().commit(label, (draft) => {
      for (const track of draft.tracks) {
        const clip = track.clips.find((c) => c.id === clipId);
        if (clip) {
          Object.assign(clip, patch);
          break;
        }
      }
    }),

  setExportStatus: (patch) => set((state) => ({ exportStatus: { ...state.exportStatus, ...patch } })),

  setProxyProgress: (p) =>
    set((state) => ({ proxies: { ...state.proxies, [p.assetId]: { state: 'building', percent: p.percent } } })),

  setProxyDone: (r) => {
    set((state) => ({
      proxies: { ...state.proxies, [r.assetId]: { state: r.success ? 'ready' : 'failed', percent: 100 } },
    }));
    if (r.success && r.proxyPath) {
      get().patchProject((draft) => {
        const asset = draft.assets.find((a) => a.id === r.assetId);
        if (asset) {
          asset.proxyPath = r.proxyPath;
          asset.proxyState = 'ready';
        }
      });
    }
  },
}));

// ── Abgeleitete Selektoren (außerhalb des Stores, reine Funktionen) ──────────

export { clipDurationUs, clipEndUs, projectDurationUs, sortedClips, getVideoTrack };
