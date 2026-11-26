import { contextBridge, ipcRenderer } from 'electron';
import type { MasterLinkMeldung } from '@jm/app-runtime';
import type { FernsteuerungMeldung } from '@shared/fernsteuerung';
import type { CaptionConfig, CaptionState, CaptionStatus, JmCaptionApi } from '@shared/types';

// Den vom Main übertragenen Frame-MessagePort in den Renderer-Main-World
// durchreichen — contextBridge kann MessagePorts nicht direkt übergeben, daher
// der dokumentierte window.postMessage-Transfer (Empfang im Renderer: 'message').
ipcRenderer.on('jmcaption:frame-port', (e) => {
  window.postMessage('jmcaption:frame-port', '*', e.ports);
});

const api: JmCaptionApi = {
  platform: process.platform,
  // UX Welle 2a (Spec 3.9): Master-Link-Zustand lesend. null, solange die Brücke fehlt oder ablehnt (Statusleiste: unbekannt).
  masterLink: () => (ipcRenderer.invoke('jmps:master-link') as Promise<MasterLinkMeldung>).catch(() => null),
  onMasterLink: (cb) => {
    const listener = (_e: unknown, m: MasterLinkMeldung): void => cb(m);
    ipcRenderer.on('jmps:master-link', listener);
    return () => ipcRenderer.off('jmps:master-link', listener);
  },
  // Meldung des Steuerservers lesend (Port, läuft, Clients, Modus, Startfehler). null, solange Main nichts gemeldet hat.
  fernsteuerung: () => (ipcRenderer.invoke('caption:fernsteuerung') as Promise<FernsteuerungMeldung | null>).catch(() => null),
  onFernsteuerung: (cb) => {
    const listener = (_e: unknown, m: FernsteuerungMeldung | null): void => cb(m);
    ipcRenderer.on('caption:fernsteuerung', listener);
    return () => ipcRenderer.off('caption:fernsteuerung', listener);
  },
  getState: () => ipcRenderer.invoke('caption:getState') as Promise<CaptionState>,
  onState: (cb) => {
    const listener = (_e: unknown, s: CaptionState): void => cb(s);
    ipcRenderer.on('caption:state', listener);
    return () => ipcRenderer.off('caption:state', listener);
  },
  setConfig: (patch: Partial<CaptionConfig>) =>
    ipcRenderer.invoke('caption:setConfig', patch) as Promise<CaptionState>,
  start: () => ipcRenderer.invoke('caption:start') as Promise<CaptionState>,
  stop: () => ipcRenderer.invoke('caption:stop') as Promise<CaptionState>,
  setHold: (h: boolean) => ipcRenderer.invoke('caption:setHold', h) as Promise<CaptionState>,
  clear: () => ipcRenderer.invoke('caption:clear') as Promise<CaptionState>,
  correctLine: (id: string, text: string) => ipcRenderer.invoke('caption:correctLine', id, text) as Promise<CaptionState>,
  pushUtterance: (pcm: Float32Array, sampleRate: number) =>
    ipcRenderer.send('caption:utterance', pcm, sampleRate),
  ndi: {
    start: (name?: string) => ipcRenderer.invoke('caption:ndi-start', name ?? '') as Promise<CaptionStatus>,
    stop: () => ipcRenderer.invoke('caption:ndi-stop') as Promise<CaptionStatus>,
    status: () => ipcRenderer.invoke('caption:ndi-status') as Promise<CaptionStatus>,
  },
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('jmcaption', api);
} else {
  // @ts-expect-error fallback when context isolation is off
  window.jmcaption = api;
}
