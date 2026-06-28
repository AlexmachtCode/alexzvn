import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Shared, persisted settings. The single source of truth for the beep frequency
// ensures the generator and the measurement always agree (a mismatch would make
// the Goertzel detector miss every beep). Also remembers the last device choice.

interface SettingsState {
  /** Reference beep frequency in Hz — used by BOTH generator and measurement. */
  targetFreq: number;
  /** Generator cadence in ms. */
  intervalMs: number;
  /** Last selected input devices (best-effort; deviceIds can change). */
  videoId: string;
  audioId: string;
  setTargetFreq: (hz: number) => void;
  setIntervalMs: (ms: number) => void;
  setVideoId: (id: string) => void;
  setAudioId: (id: string) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      targetFreq: 1000,
      intervalMs: 2000,
      videoId: '',
      audioId: '',
      setTargetFreq: (hz) => set({ targetFreq: hz }),
      setIntervalMs: (ms) => set({ intervalMs: ms }),
      setVideoId: (id) => set({ videoId: id }),
      setAudioId: (id) => set({ audioId: id }),
    }),
    { name: 'jm-sync-settings' },
  ),
);
