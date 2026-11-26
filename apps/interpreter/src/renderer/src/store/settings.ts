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
      reset: () => set({ ...DUCKING_VORGABEN }),
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

/**
 * Altfehler IN-8: Was „Ducking-Werte zurücksetzen“ (`reset`) zurücksetzt: die fünf Ducking-Werte mit den Vorgaben aus
 * `DEFAULT_SETTINGS`. Die beiden Vorverstärkungen bleiben stehen (auch im laufenden Mix), ebenso Bypass und die drei Geräte.
 */
export const DUCKING_VORGABEN: Pick<DuckSettings, 'thresholdDb' | 'duckDb' | 'attackMs' | 'releaseMs' | 'holdMs'> = {
  thresholdDb: DEFAULT_SETTINGS.thresholdDb,
  duckDb: DEFAULT_SETTINGS.duckDb,
  attackMs: DEFAULT_SETTINGS.attackMs,
  releaseMs: DEFAULT_SETTINGS.releaseMs,
  holdMs: DEFAULT_SETTINGS.holdMs,
};
