import { create } from 'zustand';
import type { CaptionConfig, CaptionState } from '@shared/types';

interface Store {
  state: CaptionState | null;
  level: number; // aktueller RMS-Pegel (Renderer-lokal, aus der Aufnahme)
  load: () => Promise<void>;
  setLevel: (v: number) => void;
  setConfig: (patch: Partial<CaptionConfig>) => Promise<void>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  setHold: (hold: boolean) => Promise<void>;
  clear: () => Promise<void>;
  correctLine: (id: string, text: string) => Promise<void>;
  ndiStart: (name?: string) => Promise<void>;
  ndiStop: () => Promise<void>;
}

let subscribed = false;

export const useCaption = create<Store>((set) => ({
  state: null,
  level: 0,
  load: async () => {
    if (!subscribed) {
      subscribed = true;
      window.jmcaption.onState((s) => set({ state: s }));
    }
    set({ state: await window.jmcaption.getState() });
  },
  setLevel: (v) => set({ level: v }),
  setConfig: async (patch) => set({ state: await window.jmcaption.setConfig(patch) }),
  start: async () => set({ state: await window.jmcaption.start() }),
  stop: async () => set({ state: await window.jmcaption.stop() }),
  setHold: async (hold) => set({ state: await window.jmcaption.setHold(hold) }),
  clear: async () => set({ state: await window.jmcaption.clear() }),
  correctLine: async (id, text) => set({ state: await window.jmcaption.correctLine(id, text) }),
  // NDI-Start/Stop liefern nur den Status zurück; der vollständige State kommt
  // über den onState-Broadcast (startNdi/stopNdi im Main rufen broadcast()).
  ndiStart: async (name) => {
    await window.jmcaption.ndi.start(name);
  },
  ndiStop: async () => {
    await window.jmcaption.ndi.stop();
  },
}));
