import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Calibration baseline: the systematic generator+capture self-latency measured
// once via loopback, subtracted from every real measurement. Persisted locally
// so it survives restarts (re-run when the hardware/source changes).

interface CalibrationState {
  baselineMs: number | null;
  capturedAt: string | null;
  setBaseline: (ms: number, capturedAt: string) => void;
  clear: () => void;
}

export const useCalibration = create<CalibrationState>()(
  persist(
    (set) => ({
      baselineMs: null,
      capturedAt: null,
      setBaseline: (ms, capturedAt) => set({ baselineMs: ms, capturedAt }),
      clear: () => set({ baselineMs: null, capturedAt: null }),
    }),
    { name: 'jm-sync-calibration' },
  ),
);
