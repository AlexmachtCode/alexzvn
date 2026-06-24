import { create } from 'zustand';
import type { PartialTitlerConfig, TitlerState, TitlerStatus } from '@shared/types';

interface TitlerStore {
  state: TitlerState | null;
  load: () => Promise<void>;
  setConfig: (patch: PartialTitlerConfig) => Promise<void>;
  startNdi: (name: string) => Promise<void>;
  stopNdi: () => Promise<void>;
}

let subscribed = false;

export const useTitler = create<TitlerStore>((set, get) => ({
  state: null,

  load: async () => {
    if (!subscribed) {
      subscribed = true;
      window.jmtitler.onStatus((status: TitlerStatus) => {
        const cur = get().state;
        if (cur) set({ state: { ...cur, status } });
      });
    }
    const state = await window.jmtitler.getState();
    set({ state });
  },
  setConfig: async (patch) => {
    const s = await window.jmtitler.setConfig(patch);
    set({ state: s });
  },
  startNdi: async (name) => {
    await window.jmtitler.ndi.start(name);
    const cur = get().state;
    if (cur) set({ state: { ...cur, status: { ...cur.status, ndiActive: true } } });
  },
  stopNdi: async () => {
    await window.jmtitler.ndi.stop();
    const cur = get().state;
    if (cur) set({ state: { ...cur, status: { ...cur.status, ndiActive: false, connections: 0 } } });
  },
}));
