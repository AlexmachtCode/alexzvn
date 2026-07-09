import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_SETTINGS, type DuckSettings } from '@shared/ducking';

interface SettingsState extends DuckSettings {
  floorId: string;
  interpreterId: string;
  outputId: string;
  bypass: boolean;
  set: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => void;
  reset: () => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      floorId: '',
      interpreterId: '',
      outputId: '',
      bypass: false,
      set: (key, value) => set({ [key]: value } as Partial<SettingsState>),
      reset: () => set({ ...DEFAULT_SETTINGS }),
    }),
    { name: 'jm-interpreter-settings' },
  ),
);

/** Nur die Ducking-Parameter — das, was die Engine braucht. */
export function duckSettings(s: SettingsState): DuckSettings {
  return {
    thresholdDb: s.thresholdDb,
    duckDb: s.duckDb,
    attackMs: s.attackMs,
    releaseMs: s.releaseMs,
    holdMs: s.holdMs,
    floorGainDb: s.floorGainDb,
    interpreterGainDb: s.interpreterGainDb,
  };
}
