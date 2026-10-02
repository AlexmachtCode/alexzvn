import { create } from 'zustand';
import type { RundownDoc, RundownNav, RundownState } from '@shared/types';

interface Store {
  state: RundownState | null;
  load: () => Promise<void>;
  nav: (cmd: RundownNav) => Promise<void>;
  /** `basisRev` = `state.rev` des Stands, aus dem `doc` berechnet wurde (5.5). */
  setDoc: (doc: RundownDoc, basisRev: number) => Promise<void>;
  newDoc: () => Promise<void>;
  open: () => Promise<void>;
  save: () => Promise<void>;
  saveAs: () => Promise<void>;
  fireAction: (rowId: string, actionId: string) => Promise<boolean>;
  setEndpoint: (role: string, host: string, port: number) => Promise<void>;
  hinweisWeg: (id: number) => Promise<void>;
  alsEigeneZeile: (rowId: string) => Promise<void>;
}

let subscribed = false;

export const useRundown = create<Store>((set) => ({
  state: null,
  load: async () => {
    if (!subscribed) {
      subscribed = true;
      // Voller Zustand (Doc/Index/Datei) bei Editor-/Navigationsänderungen …
      window.jmrundown.onState((s) => set({ state: s }));
      // … und nur die Tool-Verbindungen/Tally (häufig, ohne den ganzen Doc).
      window.jmrundown.onLinks((links) =>
        set((st) => (st.state ? { state: { ...st.state, links } } : {})),
      );
    }
    set({ state: await window.jmrundown.getState() });
  },
  nav: async (cmd) => set({ state: await window.jmrundown.nav(cmd) }),
  setDoc: async (doc, basisRev) => set({ state: await window.jmrundown.setDoc(doc, basisRev) }),
  newDoc: async () => set({ state: await window.jmrundown.newDoc() }),
  open: async () => set({ state: await window.jmrundown.open() }),
  save: async () => set({ state: await window.jmrundown.save() }),
  saveAs: async () => set({ state: await window.jmrundown.saveAs() }),
  fireAction: (rowId, actionId) => window.jmrundown.fireAction(rowId, actionId),
  setEndpoint: async (role, host, port) =>
    set({ state: await window.jmrundown.setEndpoint(role, host, port) }),
  hinweisWeg: async (id) => set({ state: await window.jmrundown.hinweisWeg(id) }),
  alsEigeneZeile: async (rowId) => set({ state: await window.jmrundown.alsEigeneZeile(rowId) }),
}));
