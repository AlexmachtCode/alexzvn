import { create } from 'zustand';
import type {
  GraphicTemplate,
  PartialTitlerConfig,
  TitlerConfig,
  TitlerState,
  TitlerStatus,
} from '@shared/types';

interface TitlerStore {
  state: TitlerState | null;
  /** On-Air-Zustand, vom Main gepusht (#161, nur im Output-Fenster relevant). */
  onAir: boolean;
  /** Grafik-Vorlagen-Library (#162), synchron über alle Fenster. */
  templates: GraphicTemplate[];
  load: () => Promise<void>;
  setConfig: (patch: PartialTitlerConfig) => Promise<void>;
  startNdi: (name: string) => Promise<void>;
  stopNdi: () => Promise<void>;
}

let subscribed = false;

export const useTitler = create<TitlerStore>((set, get) => ({
  state: null,
  onAir: false,
  templates: [],

  load: async () => {
    if (!subscribed) {
      subscribed = true;
      window.jmtitler.onStatus((status: TitlerStatus) => {
        const cur = get().state;
        if (cur) set({ state: { ...cur, status } });
      });
      // Config-Broadcast (#161): hält alle Fenster – v. a. das Output-Fenster –
      // bei Text-/Stil-/Ausgabe-Änderungen synchron.
      window.jmtitler.onConfig((config: TitlerConfig) => {
        const cur = get().state;
        if (cur) set({ state: { ...cur, config } });
      });
      // On-Air-Push (#161): Take/Clear des Operators treibt das Output-Fenster.
      window.jmtitler.onOnAir((onAir: boolean) => set({ onAir }));
      // Grafik-Vorlagen-Library (#162): initial + bei jeder Änderung neu listen.
      window.jmtitler.onTplChanged(() => void window.jmtitler.tpl.list().then((templates) => set({ templates })));
    }
    const [state, templates] = await Promise.all([window.jmtitler.getState(), window.jmtitler.tpl.list()]);
    set({ state, templates });
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
