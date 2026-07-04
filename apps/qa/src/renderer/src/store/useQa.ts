import { create } from 'zustand';
import type { QaConfig, QaState, QaSubmission } from '@shared/types';

interface Store {
  state: QaState | null;
  load: () => Promise<void>;
  addEntry: (sub: QaSubmission) => Promise<void>;
  updateEntry: (id: string, patch: QaSubmission) => Promise<void>;
  removeEntry: (id: string) => Promise<void>;
  moveEntry: (id: string, dir: -1 | 1) => Promise<void>;
  approveEntry: (id: string, approved: boolean) => Promise<void>;
  activate: (id: string) => Promise<void>;
  next: () => Promise<void>;
  endActive: () => Promise<void>;
  clearDone: () => Promise<void>;
  clearAll: () => Promise<void>;
  setConfig: (patch: Partial<QaConfig>) => Promise<void>;
  setRemote: (enabled: boolean) => Promise<void>;
  setEndpoint: (role: string, host: string, port: number) => Promise<void>;
  setCloudConfig: (patch: Partial<QaConfig>) => Promise<void>;
  setProxyKey: (key: string) => Promise<void>;
  cloudGenerateEvent: () => Promise<void>;
  cloudEnable: (enabled: boolean) => Promise<void>;
  cloudPurge: () => Promise<void>;
}

let subscribed = false;

export const useQa = create<Store>((set) => ({
  state: null,
  load: async () => {
    if (!subscribed) {
      subscribed = true;
      window.jmqa.onState((s) => set({ state: s }));
      // Häufige Tally-Updates (z. B. Timer-Restzeit) ohne den ganzen State.
      window.jmqa.onLinks((links) => set((st) => (st.state ? { state: { ...st.state, links } } : {})));
    }
    set({ state: await window.jmqa.getState() });
  },
  addEntry: async (sub) => set({ state: await window.jmqa.addEntry(sub) }),
  updateEntry: async (id, patch) => set({ state: await window.jmqa.updateEntry(id, patch) }),
  removeEntry: async (id) => set({ state: await window.jmqa.removeEntry(id) }),
  moveEntry: async (id, dir) => set({ state: await window.jmqa.moveEntry(id, dir) }),
  approveEntry: async (id, approved) => set({ state: await window.jmqa.approveEntry(id, approved) }),
  activate: async (id) => set({ state: await window.jmqa.activate(id) }),
  next: async () => set({ state: await window.jmqa.next() }),
  endActive: async () => set({ state: await window.jmqa.endActive() }),
  clearDone: async () => set({ state: await window.jmqa.clearDone() }),
  clearAll: async () => set({ state: await window.jmqa.clearAll() }),
  setConfig: async (patch) => set({ state: await window.jmqa.setConfig(patch) }),
  setRemote: async (enabled) => set({ state: await window.jmqa.setRemote(enabled) }),
  setEndpoint: async (role, host, port) => set({ state: await window.jmqa.setEndpoint(role, host, port) }),
  setCloudConfig: async (patch) => set({ state: await window.jmqa.setCloudConfig(patch) }),
  setProxyKey: async (key) => set({ state: await window.jmqa.setProxyKey(key) }),
  cloudGenerateEvent: async () => set({ state: await window.jmqa.cloudGenerateEvent() }),
  cloudEnable: async (enabled) => set({ state: await window.jmqa.cloudEnable(enabled) }),
  cloudPurge: async () => set({ state: await window.jmqa.cloudPurge() }),
}));
