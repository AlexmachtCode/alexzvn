import { contextBridge, ipcRenderer } from 'electron';
import type { JmInterpreterApi } from '@shared/api';

// Die Audio-Kette lebt vollstaendig im Renderer; vom Main braucht der Interpreter nur den
// Download-Verweis auf das virtuelle Kabel (#208).
const api: JmInterpreterApi = {
  platform: process.platform,
  openCableDownload: () => ipcRenderer.invoke('cable:openDownload') as Promise<void>,
};

export type { JmInterpreterApi };

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('jminterpreter', api);
} else {
  // @ts-expect-error Fallback, wenn contextIsolation aus ist
  window.jminterpreter = api;
}
