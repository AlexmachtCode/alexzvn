import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type {
  AiSegmentRequest,
  JmgApi,
  LibraryAddRequest,
  OpenedFile,
  OpenKind,
  PickedImage,
  SaveBytesRequest,
  SaveImageRequest,
} from '@shared/types';

const api: JmgApi = {
  platform: process.platform,
  pathForFile: (file) => webUtils.getPathForFile(file),
  dialog: {
    pickImages: () => ipcRenderer.invoke('dialog:pickImages') as Promise<PickedImage[]>,
  },
  file: {
    read: (path) => ipcRenderer.invoke('file:read', path) as Promise<PickedImage>,
    saveImage: (req: SaveImageRequest) => ipcRenderer.invoke('file:saveImage', req),
    open: (kind: OpenKind) => ipcRenderer.invoke('file:open', kind) as Promise<OpenedFile | null>,
    saveBytes: (req: SaveBytesRequest) => ipcRenderer.invoke('file:saveBytes', req),
  },
  fonts: {
    list: () => ipcRenderer.invoke('fonts:list') as Promise<string[]>,
  },
  ai: {
    status: () => ipcRenderer.invoke('ai:status'),
    segment: (req: AiSegmentRequest) => ipcRenderer.invoke('ai:segment', req),
  },
  library: {
    list: () => ipcRenderer.invoke('library:list'),
    add: (req: LibraryAddRequest) => ipcRenderer.invoke('library:add', req),
    remove: (id: string) => ipcRenderer.invoke('library:remove', id) as Promise<void>,
    read: (id: string) => ipcRenderer.invoke('library:read', id),
  },
  shell: {
    reveal: (path) => ipcRenderer.invoke('shell:reveal', path) as Promise<void>,
    openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url) as Promise<void>,
  },
  onFileOpened: (cb) => {
    const listener = (_e: unknown, f: OpenedFile) => cb(f);
    ipcRenderer.on('file:opened', listener);
    return () => ipcRenderer.off('file:opened', listener);
  },
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('jmg', api);
} else {
  // @ts-expect-error fallback when context isolation is off
  window.jmg = api;
}
