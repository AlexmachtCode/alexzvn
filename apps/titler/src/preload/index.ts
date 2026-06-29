import { contextBridge, ipcRenderer } from 'electron';
import type {
  JmtitlerApi,
  PartialTitlerConfig,
  TitlerRemoteCommand,
  TitlerRemoteState,
  TitlerState,
  TitlerStatus,
} from '@shared/types';

// Den vom Main übertragenen Frame-MessagePort in den Renderer-Main-World
// durchreichen — contextBridge kann MessagePorts nicht direkt übergeben, daher
// der dokumentierte window.postMessage-Transfer (Empfang im Renderer: 'message').
ipcRenderer.on('jmtitler:frame-port', (e) => {
  window.postMessage('jmtitler:frame-port', '*', e.ports);
});

const api: JmtitlerApi = {
  platform: process.platform,
  getState: () => ipcRenderer.invoke('titler:getState') as Promise<TitlerState>,
  setConfig: (patch: PartialTitlerConfig) =>
    ipcRenderer.invoke('titler:setConfig', patch) as Promise<TitlerState>,
  pickDataFolder: () => ipcRenderer.invoke('titler:pickDataFolder') as Promise<string>,
  recallEntry: (ref: string) => ipcRenderer.invoke('titler:recall', ref) as Promise<void>,
  stepEntry: (delta: number) => ipcRenderer.invoke('titler:stepEntry', delta) as Promise<void>,
  onStatus: (cb) => {
    const listener = (_e: unknown, s: TitlerStatus): void => cb(s);
    ipcRenderer.on('titler:status', listener);
    return () => ipcRenderer.off('titler:status', listener);
  },
  ndi: {
    start: (name: string) => ipcRenderer.invoke('titler:ndi-start', name) as Promise<void>,
    stop: () => ipcRenderer.invoke('titler:ndi-stop') as Promise<void>,
    status: () => ipcRenderer.invoke('titler:ndi-status') as Promise<TitlerStatus>,
  },
  remote: {
    onCommand: (cb) => {
      const listener = (_e: unknown, cmd: TitlerRemoteCommand): void => cb(cmd);
      ipcRenderer.on('titler:remote-cmd', listener);
      return () => ipcRenderer.off('titler:remote-cmd', listener);
    },
    reportState: (state: TitlerRemoteState) =>
      ipcRenderer.invoke('titler:report-state', state) as Promise<void>,
  },
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('jmtitler', api);
} else {
  // @ts-expect-error fallback when context isolation is off
  window.jmtitler = api;
}
