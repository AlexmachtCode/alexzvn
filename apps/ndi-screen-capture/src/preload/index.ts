import { contextBridge, ipcRenderer } from 'electron';
import type {
  JmNdiApi,
  JmNdiSource,
  JmNdiStartOptions,
  JmNdiStatus,
  TrayCommand,
  TraySettings,
} from '@shared/types';
import { IPC } from '@shared/ipc';

// Den vom Main übertragenen Frame-MessagePort in den Renderer-Main-World
// durchreichen — contextBridge kann MessagePorts nicht direkt übergeben, daher
// der dokumentierte window.postMessage-Transfer (Empfang: window 'message').
ipcRenderer.on('jmndi:frame-port', (e) => {
  window.postMessage('jmndi:frame-port', '*', e.ports);
});

const api: JmNdiApi = {
  platform: process.platform,
  listSources: () => ipcRenderer.invoke(IPC.listSources) as Promise<JmNdiSource[]>,
  start: (opts: JmNdiStartOptions) => ipcRenderer.invoke(IPC.start, opts) as Promise<void>,
  stop: () => ipcRenderer.invoke(IPC.stop) as Promise<void>,
  getStatus: () => ipcRenderer.invoke(IPC.getStatus) as Promise<JmNdiStatus>,
  onStatus: (cb) => {
    const listener = (_event: unknown, s: JmNdiStatus) => cb(s);
    ipcRenderer.on(IPC.status, listener);
    return () => ipcRenderer.off(IPC.status, listener);
  },
  traySync: (settings: TraySettings) => ipcRenderer.send(IPC.traySync, settings),
  onTrayCommand: (cb) => {
    const listener = (_event: unknown, cmd: TrayCommand) => cb(cmd);
    ipcRenderer.on(IPC.trayCommand, listener);
    return () => ipcRenderer.off(IPC.trayCommand, listener);
  },
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('jmndi', api);
} else {
  // @ts-expect-error Fallback, wenn contextIsolation aus ist
  window.jmndi = api;
}
