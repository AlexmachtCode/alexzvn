import { create } from 'zustand';

// Modulares Panel-Layout des Editors (#95, Parität zur DAW): Größen + Sicht-
// barkeit der andockbaren Panels, persistiert in localStorage. Leichtgewichtig
// (keine Dock-Library): resizebare Splitter + Ein-/Ausblenden, im JM-Design.

const KEY = 'jmed.layout';

const LIMITS = {
  mediaBinW: [160, 520] as const,
  inspectorW: [200, 620] as const,
  timelineH: [140, 680] as const,
  sourceW: [220, 1400] as const,
};

const DEFAULTS = {
  mediaBinW: 260,
  inspectorW: 300,
  timelineH: 336,
  sourceW: 480,
  showMediaBin: true,
  showSource: true,
  showPreview: true,
  showInspector: true,
  showTimeline: true,
};

type Persisted = typeof DEFAULTS;

function clamp(n: number, [min, max]: readonly [number, number]): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function load(): Persisted {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const p = JSON.parse(raw) as Partial<Persisted>;
    return {
      mediaBinW: clamp(p.mediaBinW ?? DEFAULTS.mediaBinW, LIMITS.mediaBinW),
      inspectorW: clamp(p.inspectorW ?? DEFAULTS.inspectorW, LIMITS.inspectorW),
      timelineH: clamp(p.timelineH ?? DEFAULTS.timelineH, LIMITS.timelineH),
      sourceW: clamp(p.sourceW ?? DEFAULTS.sourceW, LIMITS.sourceW),
      showMediaBin: p.showMediaBin ?? DEFAULTS.showMediaBin,
      showSource: p.showSource ?? DEFAULTS.showSource,
      showPreview: p.showPreview ?? DEFAULTS.showPreview,
      showInspector: p.showInspector ?? DEFAULTS.showInspector,
      showTimeline: p.showTimeline ?? DEFAULTS.showTimeline,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

interface LayoutStore extends Persisted {
  nudgeMediaBin: (delta: number) => void;
  nudgeInspector: (delta: number) => void;
  nudgeTimeline: (delta: number) => void;
  nudgeSource: (delta: number) => void;
  toggleMediaBin: () => void;
  toggleSource: () => void;
  togglePreview: () => void;
  toggleInspector: () => void;
  toggleTimeline: () => void;
  reset: () => void;
}

function persist(s: Persisted): void {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        mediaBinW: s.mediaBinW,
        inspectorW: s.inspectorW,
        timelineH: s.timelineH,
        sourceW: s.sourceW,
        showMediaBin: s.showMediaBin,
        showSource: s.showSource,
        showPreview: s.showPreview,
        showInspector: s.showInspector,
        showTimeline: s.showTimeline,
      }),
    );
  } catch {
    // localStorage nicht verfügbar → nur In-Memory
  }
}

export const useLayout = create<LayoutStore>((set, get) => ({
  ...load(),

  // MediaBin links → Divider nach rechts ziehen = breiter (+delta).
  nudgeMediaBin: (delta) => {
    set({ mediaBinW: clamp(get().mediaBinW + delta, LIMITS.mediaBinW) });
    persist(get());
  },
  // Inspector rechts → Divider nach rechts ziehen = schmaler (−delta).
  nudgeInspector: (delta) => {
    set({ inspectorW: clamp(get().inspectorW - delta, LIMITS.inspectorW) });
    persist(get());
  },
  // Timeline unten → Divider nach oben ziehen = höher (−delta).
  nudgeTimeline: (delta) => {
    set({ timelineH: clamp(get().timelineH - delta, LIMITS.timelineH) });
    persist(get());
  },
  // Quelle links der Vorschau → Divider nach rechts = Quelle breiter (+delta).
  nudgeSource: (delta) => {
    set({ sourceW: clamp(get().sourceW + delta, LIMITS.sourceW) });
    persist(get());
  },

  toggleMediaBin: () => {
    set({ showMediaBin: !get().showMediaBin });
    persist(get());
  },
  toggleSource: () => {
    set({ showSource: !get().showSource });
    persist(get());
  },
  togglePreview: () => {
    set({ showPreview: !get().showPreview });
    persist(get());
  },
  toggleInspector: () => {
    set({ showInspector: !get().showInspector });
    persist(get());
  },
  toggleTimeline: () => {
    set({ showTimeline: !get().showTimeline });
    persist(get());
  },

  reset: () => {
    set({ ...DEFAULTS });
    persist(get());
  },
}));
