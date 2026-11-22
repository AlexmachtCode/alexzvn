import { contextBridge, ipcRenderer } from 'electron';
import type { MasterLinkMeldung } from '@jm/app-runtime';
import type { FernsteuerungMeldung } from '@shared/fernsteuerung';
import type { JmQaApi, QaConfig, QaState, QaSubmission, ToolLink } from '@shared/types';

const api: JmQaApi = {
  platform: process.platform,
  getState: () => ipcRenderer.invoke('qa:getState') as Promise<QaState>,
  onState: (cb) => {
    const listener = (_e: unknown, s: QaState): void => cb(s);
    ipcRenderer.on('qa:state', listener);
    return () => ipcRenderer.off('qa:state', listener);
  },
  onLinks: (cb) => {
    const listener = (_e: unknown, links: ToolLink[]): void => cb(links);
    ipcRenderer.on('qa:links', listener);
    return () => ipcRenderer.off('qa:links', listener);
  },

  addEntry: (sub: QaSubmission) => ipcRenderer.invoke('qa:addEntry', sub) as Promise<QaState>,
  updateEntry: (id: string, patch: QaSubmission) =>
    ipcRenderer.invoke('qa:updateEntry', id, patch) as Promise<QaState>,
  removeEntry: (id: string) => ipcRenderer.invoke('qa:removeEntry', id) as Promise<QaState>,
  moveEntry: (id: string, dir: -1 | 1) => ipcRenderer.invoke('qa:moveEntry', id, dir) as Promise<QaState>,
  approveEntry: (id: string, approved: boolean) =>
    ipcRenderer.invoke('qa:approveEntry', id, approved) as Promise<QaState>,

  activate: (id: string) => ipcRenderer.invoke('qa:activate', id) as Promise<QaState>,
  next: () => ipcRenderer.invoke('qa:next') as Promise<QaState>,
  endActive: () => ipcRenderer.invoke('qa:endActive') as Promise<QaState>,
  clearDone: () => ipcRenderer.invoke('qa:clearDone') as Promise<QaState>,
  clearAll: () => ipcRenderer.invoke('qa:clearAll') as Promise<QaState>,

  setConfig: (patch: Partial<QaConfig>) => ipcRenderer.invoke('qa:setConfig', patch) as Promise<QaState>,
  setRemote: (enabled: boolean) => ipcRenderer.invoke('qa:setRemote', enabled) as Promise<QaState>,
  setEndpoint: (role: string, host: string, port: number) =>
    ipcRenderer.invoke('qa:setEndpoint', role, host, port) as Promise<QaState>,

  setCloudConfig: (patch: Partial<QaConfig>) => ipcRenderer.invoke('qa:setCloudConfig', patch) as Promise<QaState>,
  setProxyKey: (key: string) => ipcRenderer.invoke('qa:setProxyKey', key) as Promise<QaState>,
  cloudGenerateEvent: () => ipcRenderer.invoke('qa:cloudGenerateEvent') as Promise<QaState>,
  cloudEnable: (enabled: boolean) => ipcRenderer.invoke('qa:cloudEnable', enabled) as Promise<QaState>,
  cloudPurge: () => ipcRenderer.invoke('qa:cloudPurge') as Promise<QaState>,

  // UX Welle 1 (Spec 3.9): Master-Link-Zustand lesend. Fehlt der Handler oder lehnt invoke ab, kommt null; der Renderer
  // zeigt dann „unbekannt“ (Spec 7.2), nicht „aus“. MasterLinkMeldung (app-runtime) → MasterLinkMeldungZeile
  // (shared/types): Weicht der Typ ab, meldet die Typprüfung den Fehler hier.
  masterLink: () => (ipcRenderer.invoke('jmps:master-link') as Promise<MasterLinkMeldung>).catch(() => null),
  onMasterLink: (cb) => {
    const listener = (_e: unknown, m: MasterLinkMeldung): void => cb(m);
    ipcRenderer.on('jmps:master-link', listener);
    return () => ipcRenderer.off('jmps:master-link', listener);
  },
  // UX Welle 1 (Spec 3.9): Meldung des Steuerservers lesend (Port, läuft, Clients, Modus, Startfehler). null, solange Main
  // noch nichts gemeldet hat oder ablehnt.
  fernsteuerung: () => (ipcRenderer.invoke('qa:fernsteuerung') as Promise<FernsteuerungMeldung | null>).catch(() => null),
  onFernsteuerung: (cb) => {
    const listener = (_e: unknown, m: FernsteuerungMeldung | null): void => cb(m);
    ipcRenderer.on('qa:fernsteuerung', listener);
    return () => ipcRenderer.off('qa:fernsteuerung', listener);
  },
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('jmqa', api);
} else {
  // @ts-expect-error fallback when context isolation is off
  window.jmqa = api;
}
