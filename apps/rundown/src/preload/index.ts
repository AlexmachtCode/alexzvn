import { contextBridge, ipcRenderer } from 'electron';
import type { MasterLinkMeldung } from '@jm/app-runtime';
import type { FernsteuerungMeldung } from '@shared/fernsteuerung';
import type { JmRundownApi, RundownDoc, RundownNav, RundownState, ToolLink, VerbundAnzeigeZeile } from '@shared/types';

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
  verbundAnzeige: () => (ipcRenderer.invoke('jmps:verbund-anzeige') as Promise<VerbundAnzeigeZeile | null>).catch(() => null),
  onVerbundAnzeige: (cb) => {
    const listener = (_e: unknown, a: VerbundAnzeigeZeile | null): void => cb(a);
    ipcRenderer.on('jmps:verbund-anzeige', listener);
    return () => ipcRenderer.off('jmps:verbund-anzeige', listener);
  },
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
  fernsteuerung: () => (ipcRenderer.invoke('rundown:fernsteuerung') as Promise<FernsteuerungMeldung | null>).catch(() => null),
  onFernsteuerung: (cb) => {
    const listener = (_e: unknown, m: FernsteuerungMeldung | null): void => cb(m);
    ipcRenderer.on('rundown:fernsteuerung', listener);
    return () => ipcRenderer.off('rundown:fernsteuerung', listener);
  },
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('jmrundown', api);
} else {
  // @ts-expect-error fallback when context isolation is off
  window.jmrundown = api;
}
