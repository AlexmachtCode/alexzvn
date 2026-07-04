import { create } from 'zustand';
import type {
  Cue,
  CueInput,
  MediaItem,
  OutputTime,
  Playlist,
  PlaylistItem,
  PlaylistKind,
  PlayerShowSettings,
  RemoteCommand,
  RemotePlayerState,
  Show,
  ShowCue,
  ShowCuePatch,
} from '@shared/types';
import { showAudio } from '@/lib/show-audio';
import { cueEngine } from '@/lib/cues';

// Laufende Pre-Wait-Timer der Cue-Show (modulglobal, damit Panik/Stop sie killt).
const showTimers = new Set<ReturnType<typeof setTimeout>>();
function clearShowTimers(): void {
  for (const t of showTimers) clearTimeout(t);
  showTimers.clear();
}

// Einmalige Anmeldung des „Video zu Ende"-Listeners (nur im Hauptfenster).
let outputEndedSubscribed = false;

// ── TCP-Fernsteuerung (Bitfocus Companion) ───────────────────────────────────
// Einmalige Verdrahtung: Befehle vom Main ausführen + Wiedergabe-Zustand melden.
let remoteSubscribed = false;

// Show-Integration (C3): einmalige Anmeldung des Live-Push für Show-Voreinstellungen.
let showSettingsSubscribed = false;

function computeRemoteState(s: PlayerStore): RemotePlayerState {
  const label = s.showCues[s.standbyIndex]?.media?.title ?? '';
  return {
    playing: s.playingCueIds.length > 0 || s.videoCue !== null,
    paused: s.showPaused,
    standby: s.showCues.length ? s.standbyIndex + 1 : 0,
    standbyLabel: label.trim().replace(/\s+/g, '_') || '-',
    cues: s.showCues.length,
    playingCount: s.playingCueIds.length,
  };
}

function handleRemoteCommand(get: () => PlayerStore, cmd: RemoteCommand): void {
  const p = get();
  switch (cmd.t) {
    case 'go':
      p.showGo();
      break;
    case 'stop':
      p.showStop();
      break;
    case 'pause':
      p.showTogglePause();
      break;
    case 'panic':
      p.showPanic();
      break;
    case 'cue':
      p.fireCue(Math.trunc(cmd.n) - 1);
      break;
    case 'standby':
      p.setStandby(Math.max(0, Math.min(Math.trunc(cmd.n) - 1, p.showCues.length)));
      break;
    case 'next':
      p.setStandby(Math.min(p.standbyIndex + 1, p.showCues.length));
      break;
    case 'prev':
      p.setStandby(Math.max(p.standbyIndex - 1, 0));
      break;
    case 'pad':
      p.firePad(cmd.slot);
      break;
    case 'loadShow': {
      // Show per NAME (case-insensitiv: exakt, dann Teilstring) auflösen; rein
      // numerische Eingabe als DB-ID als letzter Ausweg. Dann wie „Show wählen".
      const q = cmd.show.trim();
      if (!q) break;
      const lower = q.toLowerCase();
      const byName =
        p.shows.find((s) => s.name.toLowerCase() === lower) ??
        p.shows.find((s) => s.name.toLowerCase().includes(lower));
      const id = byName?.id ?? (/^\d+$/.test(q) ? Number(q) : undefined);
      if (id != null) void p.selectShow(id);
      break;
    }
  }
}

function setupRemote(get: () => PlayerStore): void {
  if (remoteSubscribed) return;
  remoteSubscribed = true;
  window.jmplay.remote.onCommand((cmd) => handleRemoteCommand(get, cmd));
  // Zustand bei jeder relevanten Änderung melden (über JSON dedupliziert, damit
  // häufige Video-Positions-Updates keinen Push auslösen).
  let last = '';
  const report = (): void => {
    const snap = computeRemoteState(get());
    const json = JSON.stringify(snap);
    if (json !== last) {
      last = json;
      void window.jmplay.remote.reportState(snap);
    }
  };
  usePlayer.subscribe(report);
  report();
}

interface PlayerStore {
  items: MediaItem[];
  playlists: Playlist[];
  loading: boolean;
  busy: boolean;
  notice: string | null;

  // Bibliothek/Player
  activePlaylistId: number | null; // null = "Alle Medien"
  queue: PlaylistItem[];
  currentMediaId: number | null;
  /** Zufallswiedergabe. */
  shuffle: boolean;
  /** Wiederholung: aus / Einzelclip / ganze Liste. */
  repeat: 'none' | 'one' | 'all';

  // Soundboard
  soundboardId: number | null;
  cues: Cue[];

  // Cue-Show
  shows: Show[];
  activeShowId: number | null;
  showCues: ShowCue[];
  /** Index des nächsten per GO zu feuernden Cues (= „Standby"). */
  standbyIndex: number;
  /** Cue-IDs, die gerade klingen oder im Pre-Wait stehen. */
  playingCueIds: number[];
  showPaused: boolean;
  /** Aktuell im Ausgabefenster laufender Video-Cue (für Ende → Auto-Continue). */
  videoCue: { id: number; index: number; autoContinue: boolean } | null;
  /** Wiedergabe-Position des laufenden Ausgabe-Videos (Issue #41). */
  videoProgress: OutputTime | null;
  /** Gewählter Ausgabe-Bildschirm (null = primär). */
  outputDisplayId: number | null;

  load: () => Promise<void>;
  setNotice: (s: string | null) => void;
  refreshLibrary: () => Promise<void>;
  refreshPlaylists: () => Promise<void>;

  importFiles: () => Promise<void>;
  importFolders: () => Promise<void>;
  importPaths: (paths: string[]) => Promise<void>;
  removeItem: (id: number) => Promise<void>;

  createPlaylist: (name: string, kind?: PlaylistKind) => Promise<Playlist | null>;
  removePlaylist: (id: number) => Promise<void>;
  selectPlaylist: (id: number | null) => Promise<void>;
  addToPlaylist: (playlistId: number, mediaIds: number[]) => Promise<void>;
  removeQueueItem: (itemId: number) => Promise<void>;

  /** Liste, über die Vor/Zurück navigiert (Playlist-Queue oder ganze Bibliothek). */
  contextList: () => MediaItem[];
  play: (mediaId: number) => void;
  playNext: () => void;
  playPrev: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;

  selectSoundboard: (id: number) => Promise<void>;
  refreshCues: () => Promise<void>;
  assignCue: (input: CueInput) => Promise<void>;
  clearCue: (slot: number) => Promise<void>;
  /** Soundboard-Pad an `slot` triggern (für die TCP-Fernsteuerung). */
  firePad: (slot: number) => void;

  // Cue-Show
  refreshShows: () => Promise<void>;
  createShow: (name: string) => Promise<Show | null>;
  renameShow: (id: number, name: string) => Promise<void>;
  removeShow: (id: number) => Promise<void>;
  selectShow: (id: number) => Promise<void>;
  refreshShowCues: () => Promise<void>;
  addShowCues: (mediaIds: number[]) => Promise<void>;
  removeShowCue: (cueId: number) => Promise<void>;
  reorderShow: (orderedCueIds: number[]) => Promise<void>;
  updateShowCue: (cueId: number, patch: ShowCuePatch) => Promise<void>;
  setStandby: (index: number) => void;
  /** Feuert intern den Cue an `index` (Pre-Wait, Audio, Auto-Continue). */
  fireCue: (index: number) => void;
  showGo: () => void;
  showStop: () => void;
  showPanic: () => void;
  showTogglePause: () => void;
  openOutput: (displayId?: number) => Promise<void>;
  closeOutput: () => Promise<void>;
  /** Vom Ausgabefenster gemeldetes Video-Ende → ggf. Auto-Continue. */
  onOutputEnded: () => void;
  /** Vom Ausgabefenster gemeldete Wiedergabe-Position (Issue #41). */
  onOutputTime: (t: OutputTime) => void;
}

export const usePlayer = create<PlayerStore>((set, get) => ({
  items: [],
  playlists: [],
  loading: true,
  busy: false,
  notice: null,
  activePlaylistId: null,
  queue: [],
  currentMediaId: null,
  shuffle: false,
  repeat: 'none',
  soundboardId: null,
  cues: [],
  shows: [],
  activeShowId: null,
  showCues: [],
  standbyIndex: 0,
  playingCueIds: [],
  showPaused: false,
  videoCue: null,
  videoProgress: null,
  outputDisplayId: null,

  setNotice: (notice) => set({ notice }),

  load: async () => {
    const [items, playlists, shows] = await Promise.all([
      window.jmplay.library.list(),
      window.jmplay.playlists.list(),
      window.jmplay.shows.list(),
    ]);
    const firstSoundboard = playlists.find((p) => p.kind === 'soundboard') ?? null;
    set({ items, playlists, shows, loading: false, soundboardId: firstSoundboard?.id ?? null });
    if (firstSoundboard) void get().refreshCues();
    if (!outputEndedSubscribed) {
      outputEndedSubscribed = true;
      window.jmplay.output.onEnded(() => get().onOutputEnded());
      window.jmplay.output.onTime((t) => get().onOutputTime(t));
    }
    setupRemote(get);
    // Show-Integration (C3): geprüfte Voreinstellungen aus der .jmshow anwenden.
    // `show` über die vorhandene loadShow-Auflösung (Name/DB-ID); `outputDisplayId`
    // nur merken (kein Auto-Fenster). Erst hier — nach dem Shows-Laden oben —, damit
    // `show` per Name auflösen kann.
    const applyShowSettings = (s: PlayerShowSettings): void => {
      if (typeof s.outputDisplayId === 'number') set({ outputDisplayId: s.outputDisplayId });
      if (typeof s.show === 'string' && s.show.trim()) {
        handleRemoteCommand(get, { t: 'loadShow', show: s.show });
      }
    };
    if (!showSettingsSubscribed) {
      showSettingsSubscribed = true;
      window.jmplay.onShowSettings(applyShowSettings);
    }
    const pending = await window.jmplay.takeShowSettings();
    if (pending) applyShowSettings(pending);
  },

  refreshLibrary: async () => set({ items: await window.jmplay.library.list() }),
  refreshPlaylists: async () => set({ playlists: await window.jmplay.playlists.list() }),

  importFiles: async () => {
    const paths = await window.jmplay.dialog.pickFiles();
    if (paths.length) await get().importPaths(paths);
  },
  importFolders: async () => {
    const paths = await window.jmplay.dialog.pickFolders();
    if (paths.length) await get().importPaths(paths);
  },
  importPaths: async (paths) => {
    set({ busy: true, notice: 'Importiere…' });
    try {
      const res = await window.jmplay.library.importPaths(paths);
      await get().refreshLibrary();
      set({
        notice:
          `${res.added} hinzugefügt · ${res.skipped} übersprungen` +
          `${res.failed ? ` · ${res.failed} fehlgeschlagen` : ''}` +
          `${res.error ? ` — ${res.error}` : ''}`,
      });
    } catch (e) {
      set({ notice: (e as Error).message });
    } finally {
      set({ busy: false });
    }
  },
  removeItem: async (id) => {
    await window.jmplay.library.remove(id);
    await get().refreshLibrary();
    if (get().activePlaylistId != null) await get().selectPlaylist(get().activePlaylistId);
    if (get().currentMediaId === id) set({ currentMediaId: null });
  },

  createPlaylist: async (name, kind = 'playlist') => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const pl = await window.jmplay.playlists.create(trimmed, kind);
    await get().refreshPlaylists();
    return pl;
  },
  removePlaylist: async (id) => {
    await window.jmplay.playlists.remove(id);
    await get().refreshPlaylists();
    if (get().activePlaylistId === id) set({ activePlaylistId: null, queue: [] });
    if (get().soundboardId === id) set({ soundboardId: null, cues: [] });
  },
  selectPlaylist: async (id) => {
    if (id == null) {
      set({ activePlaylistId: null, queue: [] });
      return;
    }
    const queue = await window.jmplay.playlists.items(id);
    set({ activePlaylistId: id, queue });
  },
  addToPlaylist: async (playlistId, mediaIds) => {
    await window.jmplay.playlists.addItems(playlistId, mediaIds);
    if (get().activePlaylistId === playlistId) await get().selectPlaylist(playlistId);
    set({ notice: `${mediaIds.length} zur Playlist hinzugefügt` });
  },
  removeQueueItem: async (itemId) => {
    await window.jmplay.playlists.removeItem(itemId);
    if (get().activePlaylistId != null) await get().selectPlaylist(get().activePlaylistId);
  },

  contextList: () => {
    const { activePlaylistId, queue, items } = get();
    return activePlaylistId != null ? queue.map((q) => q.media) : items;
  },
  play: (mediaId) => {
    set({ currentMediaId: mediaId });
    void window.jmplay.library.markPlayed(mediaId);
  },
  playNext: () => {
    const { shuffle, repeat, currentMediaId } = get();
    const list = get().contextList();
    if (list.length === 0) return;
    if (shuffle) {
      // Zufälliger nächster Titel; bei >1 nicht denselben direkt wiederholen.
      if (list.length === 1) {
        get().play(list[0].id);
        return;
      }
      let pickId = list[Math.floor(Math.random() * list.length)].id;
      while (pickId === currentMediaId) pickId = list[Math.floor(Math.random() * list.length)].id;
      get().play(pickId);
      return;
    }
    const idx = list.findIndex((m) => m.id === currentMediaId);
    const next = list[idx + 1];
    if (next) get().play(next.id);
    else if (repeat === 'all') get().play(list[0].id); // am Ende → von vorn
  },
  playPrev: () => {
    const { repeat, currentMediaId } = get();
    const list = get().contextList();
    if (list.length === 0) return;
    const idx = list.findIndex((m) => m.id === currentMediaId);
    const prev = list[idx - 1];
    if (prev) get().play(prev.id);
    else if (repeat === 'all') get().play(list[list.length - 1].id); // Anfang → ans Ende
  },
  toggleShuffle: () => set((s) => ({ shuffle: !s.shuffle })),
  cycleRepeat: () =>
    set((s) => ({ repeat: s.repeat === 'none' ? 'all' : s.repeat === 'all' ? 'one' : 'none' })),

  selectSoundboard: async (id) => {
    set({ soundboardId: id });
    await get().refreshCues();
  },
  refreshCues: async () => {
    const id = get().soundboardId;
    if (id == null) {
      set({ cues: [] });
      return;
    }
    set({ cues: await window.jmplay.cues.list(id) });
  },
  assignCue: async (input) => {
    await window.jmplay.cues.assign(input);
    await get().refreshCues();
  },
  clearCue: async (slot) => {
    const id = get().soundboardId;
    if (id == null) return;
    await window.jmplay.cues.clear(id, slot);
    await get().refreshCues();
  },
  firePad: (slot) => {
    const cue = get().cues.find((c) => c.slot === slot);
    if (cue && cue.media) cueEngine.play(cue, window.jmplay.mediaUrl(cue.media.path));
  },

  // ---- Cue-Show ----

  refreshShows: async () => set({ shows: await window.jmplay.shows.list() }),

  createShow: async (name) => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const show = await window.jmplay.shows.create(trimmed);
    await get().refreshShows();
    await get().selectShow(show.id);
    return show;
  },
  renameShow: async (id, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await window.jmplay.shows.rename(id, trimmed);
    await get().refreshShows();
  },
  removeShow: async (id) => {
    await window.jmplay.shows.remove(id);
    await get().refreshShows();
    if (get().activeShowId === id) {
      get().showPanic();
      set({ activeShowId: null, showCues: [], standbyIndex: 0 });
    }
  },

  selectShow: async (id) => {
    get().showPanic();
    const cues = await window.jmplay.shows.cues(id);
    set({ activeShowId: id, showCues: cues, standbyIndex: 0, playingCueIds: [], showPaused: false });
    // Cue-Medien vordekodieren → latenzarmes GO.
    for (const c of cues) {
      if (c.media) void showAudio.preload(c.media.id, window.jmplay.mediaUrl(c.media.path));
    }
  },
  refreshShowCues: async () => {
    const id = get().activeShowId;
    if (id == null) return;
    const cues = await window.jmplay.shows.cues(id);
    set((s) => ({ showCues: cues, standbyIndex: Math.min(s.standbyIndex, cues.length) }));
    for (const c of cues) {
      if (c.media) void showAudio.preload(c.media.id, window.jmplay.mediaUrl(c.media.path));
    }
  },
  addShowCues: async (mediaIds) => {
    const id = get().activeShowId;
    if (id == null) return;
    await window.jmplay.shows.addCues(id, mediaIds);
    await get().refreshShowCues();
  },
  removeShowCue: async (cueId) => {
    showAudio.stop(cueId);
    await window.jmplay.shows.removeCue(cueId);
    set((s) => ({ playingCueIds: s.playingCueIds.filter((x) => x !== cueId) }));
    await get().refreshShowCues();
  },
  reorderShow: async (orderedCueIds) => {
    const id = get().activeShowId;
    if (id == null) return;
    await window.jmplay.shows.reorder(id, orderedCueIds);
    await get().refreshShowCues();
  },
  updateShowCue: async (cueId, patch) => {
    await window.jmplay.shows.updateCue(cueId, patch);
    await get().refreshShowCues();
  },

  setStandby: (index) => set({ standbyIndex: index }),

  fireCue: (index) => {
    const { showCues } = get();
    const cue = showCues[index];
    if (!cue) {
      set({ standbyIndex: showCues.length });
      return;
    }
    set({ standbyIndex: index + 1 });

    // Leerer Cue (kein Medium): ggf. direkt weiterlaufen.
    if (cue.mediaId == null || !cue.media) {
      if (cue.autoContinue) get().fireCue(index + 1);
      return;
    }

    const media = cue.media;
    const url = window.jmplay.mediaUrl(media.path);
    const startNow = (): void => {
      set((s) => ({ playingCueIds: [...new Set([...s.playingCueIds, cue.id])] }));
      if (media.kind === 'video') {
        // Video → Ausgabefenster (ggf. öffnen). Ende-/Auto-Continue läuft über
        // onOutputEnded (das Ausgabefenster meldet das natürliche Ende zurück).
        set({ videoCue: { id: cue.id, index, autoContinue: cue.autoContinue }, videoProgress: null });
        const load = (): Promise<void> =>
          window.jmplay.output.command({
            type: 'load',
            url,
            gainDb: cue.gainDb,
            loop: cue.loop,
            fadeInSec: cue.fadeInSec,
          });
        void window.jmplay.output
          .isOpen()
          .then((open) =>
            open ? load() : window.jmplay.output.open(get().outputDisplayId ?? undefined).then(load),
          );
      } else {
        void showAudio.play(cue, url, () => {
          set((s) => ({ playingCueIds: s.playingCueIds.filter((x) => x !== cue.id) }));
          if (cue.autoContinue) get().fireCue(index + 1);
        });
      }
    };

    if (cue.preWaitSec > 0) {
      set((s) => ({ playingCueIds: [...new Set([...s.playingCueIds, cue.id])] })); // „pending"
      const t = setTimeout(() => {
        showTimers.delete(t);
        startNow();
      }, cue.preWaitSec * 1000);
      showTimers.add(t);
    } else {
      startNow();
    }
  },

  showGo: () => get().fireCue(get().standbyIndex),

  showStop: () => {
    const { showCues, playingCueIds, videoCue } = get();
    for (const id of playingCueIds) {
      const cue = showCues.find((c) => c.id === id);
      if (cue && cue.media?.kind === 'video') {
        void window.jmplay.output.command({ type: 'stop', fadeOutSec: cue.fadeOutSec });
      } else {
        showAudio.stop(id, cue?.fadeOutSec ?? 0);
      }
    }
    if (videoCue && !playingCueIds.includes(videoCue.id)) {
      void window.jmplay.output.command({ type: 'stop', fadeOutSec: 0 });
    }
    clearShowTimers();
    set({ playingCueIds: [], videoCue: null, videoProgress: null });
  },

  showPanic: () => {
    showAudio.panic();
    void window.jmplay.output.command({ type: 'black' });
    clearShowTimers();
    set({ playingCueIds: [], videoCue: null, videoProgress: null, showPaused: false });
  },

  showTogglePause: () => {
    if (get().showPaused) {
      void showAudio.resume();
      void window.jmplay.output.command({ type: 'resume' });
      set({ showPaused: false });
    } else {
      void showAudio.suspend();
      void window.jmplay.output.command({ type: 'pause' });
      set({ showPaused: true });
    }
  },

  openOutput: async (displayId) => {
    await window.jmplay.output.open(displayId);
    if (displayId != null) set({ outputDisplayId: displayId });
  },
  closeOutput: async () => {
    await window.jmplay.output.close();
    set({ videoCue: null, videoProgress: null });
  },
  onOutputEnded: () => {
    const vc = get().videoCue;
    if (!vc) return;
    set((s) => ({
      playingCueIds: s.playingCueIds.filter((x) => x !== vc.id),
      videoCue: null,
      videoProgress: null,
    }));
    if (vc.autoContinue) get().fireCue(vc.index + 1);
  },
  onOutputTime: (t) => {
    // Nur übernehmen, solange wirklich ein Video-Cue läuft (verwirft Spät-Events
    // nach Stop/Ende).
    if (get().videoCue) set({ videoProgress: t });
  },
}));
