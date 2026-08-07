import { contextBridge, ipcRenderer } from 'electron';
import { PRELOAD_SERVER_URL } from '@shared/net';

const api = {
  platform: process.platform,
  versions: process.versions,
  serverUrl: PRELOAD_SERVER_URL,
  speaker: {
    open: () => ipcRenderer.invoke('speaker:open') as Promise<void>,
    close: () => ipcRenderer.invoke('speaker:close') as Promise<void>,
    toggle: () => ipcRenderer.invoke('speaker:toggle') as Promise<void>,
    isOpen: () => ipcRenderer.invoke('speaker:isOpen') as Promise<boolean>,
    setFullscreen: (flag: boolean) =>
      ipcRenderer.invoke('speaker:fullscreen', flag) as Promise<boolean>,
    isFullscreen: () =>
      ipcRenderer.invoke('speaker:isFullscreen') as Promise<boolean>,
    onStatus: (cb: (open: boolean) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, open: boolean) => cb(open);
      ipcRenderer.on('speaker:status', listener);
      return () => {
        ipcRenderer.off('speaker:status', listener);
      };
    },
  },
  remote: {
    getUrls: () => ipcRenderer.invoke('remote:getUrls') as Promise<string[]>,
    getAddresses: () =>
      ipcRenderer.invoke('remote:getAddresses') as Promise<string[]>,
  },
  auth: {
    get: () =>
      ipcRenderer.invoke('auth:get') as Promise<{ enabled: boolean; token: string }>,
    setEnabled: (enabled: boolean) =>
      ipcRenderer.invoke('auth:setEnabled', enabled) as Promise<{
        enabled: boolean;
        token: string;
      }>,
    regenerate: () =>
      ipcRenderer.invoke('auth:regenerate') as Promise<{
        enabled: boolean;
        token: string;
      }>,
  },
  closeWindow: () => ipcRenderer.invoke('window:close') as Promise<void>,
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('jm', api);
} else {
  // @ts-expect-error fallback when context isolation is off (we don't use this path)
  window.jm = api;
}

export type JmApi = typeof api;
