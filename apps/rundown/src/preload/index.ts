import { contextBridge, ipcRenderer } from 'electron';
import type { JmRundownApi, RundownDoc, RundownNav, RundownState, ToolLink } from '@shared/types';

const api: JmRundownApi = {
  platform: process.platform,
  getState: () => ipcRenderer.invoke('rundown:getState') as Promise<RundownState>,
  onState: (cb) => {
    const listener = (_e: unknown, s: RundownState): void => cb(s);
    ipcRenderer.on('rundown:state', listener);
    return () => ipcRenderer.off('rundown:state', listener);
  },
  onLinks: (cb) => {
    const listener = (_e: unknown, links: ToolLink[]): void => cb(links);
    ipcRenderer.on('rundown:links', listener);
    return () => ipcRenderer.off('rundown:links', listener);
  },
  nav: (cmd: RundownNav) => ipcRenderer.invoke('rundown:nav', cmd) as Promise<RundownState>,
  fireAction: (rowId: string, actionId: string) =>
    ipcRenderer.invoke('rundown:fireAction', rowId, actionId) as Promise<boolean>,
  setEndpoint: (role: string, host: string, port: number) =>
    ipcRenderer.invoke('rundown:setEndpoint', role, host, port) as Promise<RundownState>,
  pickFile: () => ipcRenderer.invoke('rundown:pickFile') as Promise<string | null>,
  importRegieplan: () =>
    ipcRenderer.invoke('rundown:importRegieplan') as Promise<{ name: string; bytes: Uint8Array } | null>,
  setDoc: (doc: RundownDoc, basisRev: number) =>
    ipcRenderer.invoke('rundown:setDoc', doc, basisRev) as Promise<RundownState>,
  hinweisWeg: (id: number) => ipcRenderer.invoke('rundown:hinweisWeg', id) as Promise<RundownState>,
  alsEigeneZeile: (rowId: string) =>
    ipcRenderer.invoke('rundown:alsEigeneZeile', rowId) as Promise<RundownState>,
  newDoc: () => ipcRenderer.invoke('rundown:new') as Promise<RundownState>,
  open: () => ipcRenderer.invoke('rundown:open') as Promise<RundownState>,
  save: () => ipcRenderer.invoke('rundown:save') as Promise<RundownState>,
  saveAs: () => ipcRenderer.invoke('rundown:saveAs') as Promise<RundownState>,
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('jmrundown', api);
} else {
  // @ts-expect-error fallback when context isolation is off
  window.jmrundown = api;
}
