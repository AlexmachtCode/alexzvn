import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type {
  ExportProgress,
  ExportRequest,
  ExportResult,
  ImportKind,
  JmedApi,
  OpenProjectResult,
  PickOutputRequest,
  ProxyProgress,
  ProxyResult,
  SaveProjectRequest,
  ThumbRequest,
} from '@shared/ipc-types';
import type { MediaAsset } from '@shared/project';

const api: JmedApi = {
  platform: process.platform,
  pathForFile: (file) => webUtils.getPathForFile(file),
  dialog: {
    importMedia: (kind: ImportKind) => ipcRenderer.invoke('dialog:importMedia', kind) as Promise<string[]>,
  },
  media: {
    import: (paths) => ipcRenderer.invoke('media:import', paths),
    thumb: (req: ThumbRequest) => ipcRenderer.invoke('media:thumb', req),
  },
  proxy: {
    ensure: (asset: MediaAsset) => ipcRenderer.invoke('proxy:ensure', asset) as Promise<void>,
  },
  project: {
    open: () => ipcRenderer.invoke('project:open'),
    save: (req: SaveProjectRequest) => ipcRenderer.invoke('project:save', req),
  },
  export: {
    pickOutput: (req: PickOutputRequest) => ipcRenderer.invoke('export:pickOutput', req) as Promise<string | null>,
    start: (req: ExportRequest) => ipcRenderer.invoke('export:start', req),
    cancel: (id) => ipcRenderer.invoke('export:cancel', id) as Promise<void>,
  },
  encoders: {
    get: () => ipcRenderer.invoke('encoders:get'),
  },
  shell: {
    reveal: (p) => ipcRenderer.invoke('shell:reveal', p) as Promise<void>,
    openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url) as Promise<void>,
  },
  onProxyProgress: (cb) => {
    const listener = (_e: unknown, p: ProxyProgress) => cb(p);
    ipcRenderer.on('proxy:progress', listener);
    return () => ipcRenderer.off('proxy:progress', listener);
  },
  onProxyDone: (cb) => {
    const listener = (_e: unknown, r: ProxyResult) => cb(r);
    ipcRenderer.on('proxy:done', listener);
    return () => ipcRenderer.off('proxy:done', listener);
  },
  onExportProgress: (cb) => {
    const listener = (_e: unknown, p: ExportProgress) => cb(p);
    ipcRenderer.on('export:progress', listener);
    return () => ipcRenderer.off('export:progress', listener);
  },
  onExportDone: (cb) => {
    const listener = (_e: unknown, r: ExportResult) => cb(r);
    ipcRenderer.on('export:done', listener);
    return () => ipcRenderer.off('export:done', listener);
  },
  onProjectOpened: (cb) => {
    const listener = (_e: unknown, r: OpenProjectResult) => cb(r);
    ipcRenderer.on('project:opened', listener);
    return () => ipcRenderer.off('project:opened', listener);
  },
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('jmed', api);
} else {
  // @ts-expect-error fallback when context isolation is off
  window.jmed = api;
}
