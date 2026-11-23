import { contextBridge, ipcRenderer } from 'electron';
import type { MasterLinkMeldung } from '@jm/app-runtime';
import type { JmInterpreterApi } from '@shared/api';

// Die Audio-Kette lebt vollstaendig im Renderer; vom Main braucht der Interpreter nur den
// Download-Verweis auf das virtuelle Kabel (#208).
const api: JmInterpreterApi = {
  platform: process.platform,
  openCableDownload: () => ipcRenderer.invoke('cable:openDownload') as Promise<void>,
  // UX Welle 2a (Spec 3.9): Master-Link-Zustand lesend. null, solange die Brücke fehlt oder ablehnt (Statusleiste: unbekannt).
  masterLink: () => (ipcRenderer.invoke('jmps:master-link') as Promise<MasterLinkMeldung>).catch(() => null),
  onMasterLink: (cb) => {
    const listener = (_e: unknown, m: MasterLinkMeldung): void => cb(m);
    ipcRenderer.on('jmps:master-link', listener);
    return () => ipcRenderer.off('jmps:master-link', listener);
  },
};

export type { JmInterpreterApi };

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('jminterpreter', api);
} else {
  // @ts-expect-error Fallback, wenn contextIsolation aus ist
  window.jminterpreter = api;
}
