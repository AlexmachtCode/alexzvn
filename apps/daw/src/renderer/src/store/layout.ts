import { create } from 'zustand';

// Modulares Panel-Layout (#95): Breiten/Höhe der andockbaren Panels + deren
// Sichtbarkeit, persistiert in localStorage. Bewusst leichtgewichtig (keine
// Dock-Library): resizebare Splitter + Ein-/Ausblenden, im vorhandenen Design.

const KEY = 'jmdaw.layout';

const LIMITS = {
  mediaBinW: [160, 480] as const,
  inspectorW: [200, 560] as const,
  mixerH: [120, 520] as const,
};

const DEFAULTS = {
  mediaBinW: 240,
  inspectorW: 280,
  mixerH: 260,
  showMediaBin: true,
  showInspector: true,
  showMixer: true,
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
      mixerH: clamp(p.mixerH ?? DEFAULTS.mixerH, LIMITS.mixerH),
      showMediaBin: p.showMediaBin ?? DEFAULTS.showMediaBin,
      showInspector: p.showInspector ?? DEFAULTS.showInspector,
      showMixer: p.showMixer ?? DEFAULTS.showMixer,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

interface LayoutStore extends Persisted {
  /** Splitter-Drag: Panel um `delta` px verändern (Vorzeichen je Panel-Seite). */
  nudgeMediaBin: (delta: number) => void;
  nudgeInspector: (delta: number) => void;
  nudgeMixer: (delta: number) => void;
  toggleMediaBin: () => void;
  toggleInspector: () => void;
  toggleMixer: () => void;
  reset: () => void;
}

function persist(s: Persisted): void {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        mediaBinW: s.mediaBinW,
        inspectorW: s.inspectorW,
        mixerH: s.mixerH,
        showMediaBin: s.showMediaBin,
        showInspector: s.showInspector,
        showMixer: s.showMixer,
      }),
    );
  } catch {
    // localStorage nicht verfügbar → nur In-Memory
  }
}

export const useLayout = create<LayoutStore>((set, get) => ({
  ...load(),

  // MediaBin liegt links → Divider nach rechts ziehen = breiter (+delta).
  nudgeMediaBin: (delta) => {
    set({ mediaBinW: clamp(get().mediaBinW + delta, LIMITS.mediaBinW) });
    persist(get());
  },
  // Inspector liegt rechts → Divider nach rechts ziehen = schmaler (−delta).
  nudgeInspector: (delta) => {
    set({ inspectorW: clamp(get().inspectorW - delta, LIMITS.inspectorW) });
    persist(get());
  },
  // Mixer liegt unten → Divider nach oben ziehen = höher (−delta).
  nudgeMixer: (delta) => {
    set({ mixerH: clamp(get().mixerH - delta, LIMITS.mixerH) });
    persist(get());
  },

  toggleMediaBin: () => {
    set({ showMediaBin: !get().showMediaBin });
    persist(get());
  },
  toggleInspector: () => {
    set({ showInspector: !get().showInspector });
    persist(get());
  },
  toggleMixer: () => {
    set({ showMixer: !get().showMixer });
    persist(get());
  },

  reset: () => {
    set({ ...DEFAULTS });
    persist(get());
  },
}));
