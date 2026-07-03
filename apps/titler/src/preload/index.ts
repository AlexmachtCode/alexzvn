import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type {
  DisplayInfo,
  GraphicTemplate,
  JmtitlerApi,
  OpenedImportFile,
  PartialTitlerConfig,
  TitlerConfig,
  TitlerRemoteCommand,
  TitlerRemoteState,
  TitlerState,
  TitlerStatus,
  TitlerTemplateAddRequest,
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
  listDisplays: () => ipcRenderer.invoke('titler:listDisplays') as Promise<DisplayInfo[]>,
  onDisplaysChanged: (cb) => {
    const listener = (): void => cb();
    ipcRenderer.on('titler:displays-changed', listener);
    return () => ipcRenderer.off('titler:displays-changed', listener);
  },
  onStatus: (cb) => {
    const listener = (_e: unknown, s: TitlerStatus): void => cb(s);
    ipcRenderer.on('titler:status', listener);
    return () => ipcRenderer.off('titler:status', listener);
  },
  onConfig: (cb) => {
    const listener = (_e: unknown, config: TitlerConfig): void => cb(config);
    ipcRenderer.on('titler:config', listener);
    return () => ipcRenderer.off('titler:config', listener);
  },
  onOnAir: (cb) => {
    const listener = (_e: unknown, onAir: boolean): void => cb(onAir);
    ipcRenderer.on('titler:onair', listener);
    return () => ipcRenderer.off('titler:onair', listener);
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
  tpl: {
    list: () => ipcRenderer.invoke('titler:tpl-list') as Promise<GraphicTemplate[]>,
    add: (req: TitlerTemplateAddRequest) => ipcRenderer.invoke('titler:tpl-add', req) as Promise<GraphicTemplate>,
    remove: (id: string) => ipcRenderer.invoke('titler:tpl-remove', id) as Promise<void>,
    readBg: (id: string) => ipcRenderer.invoke('titler:tpl-read-bg', id) as Promise<Uint8Array | null>,
  },
  onTplChanged: (cb) => {
    const listener = (): void => cb();
    ipcRenderer.on('titler:tpl-changed', listener);
    return () => ipcRenderer.off('titler:tpl-changed', listener);
  },
  pickImportFile: () => ipcRenderer.invoke('titler:pickImportFile') as Promise<OpenedImportFile | null>,
  readFile: (path: string) => ipcRenderer.invoke('titler:readFile', path) as Promise<OpenedImportFile | null>,
  pathForFile: (file: File) => webUtils.getPathForFile(file),
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('jmtitler', api);
} else {
  // @ts-expect-error fallback when context isolation is off
  window.jmtitler = api;
}
