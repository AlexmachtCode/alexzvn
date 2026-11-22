import { contextBridge, ipcRenderer } from 'electron';
import { PRELOAD_SERVER_URL } from '@shared/net';
import type { MasterLinkMeldung } from '@jm/app-runtime';
import type { FernsteuerungMeldung } from '@shared/fernsteuerung';
import type { VerbundAnzeigeZeile } from '@shared/verbund';

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
  /** Verbund-Anzeige (Master-Link Teil 2b, Spec 16.4/16.5): V-Zeile oder null (Einzelplatz). */
  verbundAnzeige: () => (ipcRenderer.invoke('jmps:verbund-anzeige') as Promise<VerbundAnzeigeZeile | null>).catch(() => null),
  onVerbundAnzeige: (cb: (a: VerbundAnzeigeZeile | null) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, a: VerbundAnzeigeZeile | null) => cb(a);
    ipcRenderer.on('jmps:verbund-anzeige', listener);
    return () => {
      ipcRenderer.off('jmps:verbund-anzeige', listener);
    };
  },
  // UX Welle 1 (Spec 3.9): Master-Link-Zustand lesend. Fehlt der Handler oder lehnt invoke ab, kommt null; der Renderer
  // zeigt dann „unbekannt“ (Spec 7.2), nicht „aus“. MasterLinkMeldung (app-runtime) → MasterLinkMeldungZeile (shared/verbund):
  // Weicht der Typ ab, meldet die Typprüfung den Fehler hier.
  masterLink: () => (ipcRenderer.invoke('jmps:master-link') as Promise<MasterLinkMeldung>).catch(() => null),
  onMasterLink: (cb: (m: MasterLinkMeldung) => void) => {
    const listener = (_e: unknown, m: MasterLinkMeldung): void => cb(m);
    ipcRenderer.on('jmps:master-link', listener);
    return () => ipcRenderer.off('jmps:master-link', listener);
  },
  // UX Welle 1 (Spec 3.9): Meldung des Steuerservers lesend (Port, läuft, Clients, Modus, Startfehler). null, solange Main
  // noch nichts gemeldet hat oder ablehnt.
  fernsteuerung: () => (ipcRenderer.invoke('timer:fernsteuerung') as Promise<FernsteuerungMeldung | null>).catch(() => null),
  onFernsteuerung: (cb: (m: FernsteuerungMeldung | null) => void) => {
    const listener = (_e: unknown, m: FernsteuerungMeldung | null): void => cb(m);
    ipcRenderer.on('timer:fernsteuerung', listener);
    return () => ipcRenderer.off('timer:fernsteuerung', listener);
  },
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('jm', api);
} else {
  // @ts-expect-error fallback when context isolation is off (we don't use this path)
  window.jm = api;
}

export type JmApi = typeof api;
