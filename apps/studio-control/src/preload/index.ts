import { contextBridge, ipcRenderer } from 'electron';
import type { MasterLinkMeldung } from '@jm/app-runtime';
import type { FernsteuerungMeldung } from '@shared/fernsteuerung';

const SERVER_HOST = '127.0.0.1';
const SERVER_PORT = 7778;

const api = {
  platform: process.platform,
  versions: process.versions,
  serverUrl: `http://${SERVER_HOST}:${SERVER_PORT}`,
  isElectron: true,
  remote: {
    getUrls: () => ipcRenderer.invoke('remote:getUrls') as Promise<string[]>,
    getAddresses: () => ipcRenderer.invoke('remote:getAddresses') as Promise<string[]>,
  },
  closeWindow: () => ipcRenderer.invoke('window:close') as Promise<void>,
  // UX Welle 2b: Master-Link-Zustand lesend. null, solange die Brücke fehlt oder ablehnt (Statusleiste: unbekannt).
  masterLink: () => (ipcRenderer.invoke('jmps:master-link') as Promise<MasterLinkMeldung>).catch(() => null),
  onMasterLink: (cb: (m: MasterLinkMeldung) => void) => {
    const listener = (_e: unknown, m: MasterLinkMeldung): void => cb(m);
    ipcRenderer.on('jmps:master-link', listener);
    return () => ipcRenderer.off('jmps:master-link', listener);
  },
  // Meldung des Steuerservers (Port 8735) lesend. null, solange Main nichts gemeldet hat.
  fernsteuerung: () => (ipcRenderer.invoke('studio:fernsteuerung') as Promise<FernsteuerungMeldung | null>).catch(() => null),
  onFernsteuerung: (cb: (m: FernsteuerungMeldung | null) => void) => {
    const listener = (_e: unknown, m: FernsteuerungMeldung | null): void => cb(m);
    ipcRenderer.on('studio:fernsteuerung', listener);
    return () => ipcRenderer.off('studio:fernsteuerung', listener);
  },
  // Altfehler SC-S1: Ort der Datei mit dem Erst-Passwort und ob sie besteht, gefragt beim Öffnen des Panels. null bei Ablehnung.
  erstPasswort: () => (ipcRenderer.invoke('studio:erstPasswort') as Promise<{ datei: string; vorhanden: boolean }>).catch(() => null),
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('jms', api);
} else {
  // @ts-expect-error fallback when context isolation is off
  window.jms = api;
}

export type JmsApi = typeof api;
