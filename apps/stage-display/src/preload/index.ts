import { contextBridge, ipcRenderer } from 'electron';
import type { MasterLinkMeldung } from '@jm/app-runtime';
import type { AusgabeZustand } from '@jm/output-window/zustand';
import type { DisplayInfo, JmstageApi, PartialStageConfig, StageState } from '@shared/types';

const api: JmstageApi = {
  platform: process.platform,
  getState: () => ipcRenderer.invoke('stage:getState') as Promise<StageState>,
  setConfig: (patch: PartialStageConfig) =>
    ipcRenderer.invoke('stage:setConfig', patch) as Promise<StageState>,
  onState: (cb) => {
    const listener = (_e: unknown, s: StageState): void => cb(s);
    ipcRenderer.on('stage:state', listener);
    return () => ipcRenderer.off('stage:state', listener);
  },
  // UX Welle 2a (Spec 3.9): Master-Link-Zustand lesend. null, solange die Brücke fehlt oder ablehnt (Statusleiste: unbekannt).
  masterLink: () => (ipcRenderer.invoke('jmps:master-link') as Promise<MasterLinkMeldung>).catch(() => null),
  onMasterLink: (cb) => {
    const listener = (_e: unknown, m: MasterLinkMeldung): void => cb(m);
    ipcRenderer.on('jmps:master-link', listener);
    return () => ipcRenderer.off('jmps:master-link', listener);
  },
  output: {
    displays: () => ipcRenderer.invoke('output:displays') as Promise<DisplayInfo[]>,
    open: (displayId) => ipcRenderer.invoke('output:open', displayId) as Promise<void>,
    close: () => ipcRenderer.invoke('output:close') as Promise<void>,
    isOpen: () => ipcRenderer.invoke('output:isOpen') as Promise<boolean>,
    // UX Welle 2a (W2-2): gemessener Zustand des Ausgabefensters, lesend. null, wenn Main ablehnt.
    zustand: () => (ipcRenderer.invoke('output:zustand') as Promise<AusgabeZustand | null>).catch(() => null),
    onZustand: (cb) => {
      const listener = (_e: unknown, z: AusgabeZustand): void => cb(z);
      ipcRenderer.on('output:zustand', listener);
      return () => ipcRenderer.off('output:zustand', listener);
    },
  },
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('jmstage', api);
} else {
  // @ts-expect-error fallback when context isolation is off
  window.jmstage = api;
}
