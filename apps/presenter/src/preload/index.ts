import { contextBridge, ipcRenderer, webUtils } from 'electron';
import { ladeInPortionen } from '../shared/dateien';
import type {
  AbgelegteDateien,
  GeladeneDateien,
  ImportedFile,
  JmprApi,
  NdiStatus,
  NetInterface,
  OfficeImportResult,
  OpenFilesPayload,
  PresentationPayload,
  PresentationState,
  RemoteConfig,
  RemoteStatus,
  TimerSource,
  TimerSyncConfig,
  ViewName,
} from '@shared/types';

function parseView(): ViewName {
  const v = new URLSearchParams(location.search).get('view');
  if (v === 'presenter' || v === 'audience' || v === 'ndi') return v;
  return 'editor';
}

const view = parseView();

// NDI-Fenster (#303): Den Bild-Port aus dem Main an die Seite weiterreichen (Titler-Muster) – nur dort.
if (view === 'ndi') {
  ipcRenderer.on('jmpr:ndi-port', (e) => window.postMessage('jmpr:ndi-port', '*', e.ports));
}

/**
 * Abgelegte Dateien laden (#298). Die Pfade holt NUR der Preload (isolierte Welt) per
 * webUtils: Seiten-JS kann kein File mit erfundenem Pfad bauen, also auch keine beliebigen
 * Pfade (oder UNC-Freigaben) lesen lassen. Der Hauptprozess prüft trotzdem weiter
 * (Absender Editor, absolute Pfade, höchstens 200 je Aufruf).
 */
async function importiereAbgelegte(files: File[], expandBuilds: boolean): Promise<AbgelegteDateien> {
  const pfade: string[] = [];
  const ohnePfad: string[] = [];
  for (const f of Array.isArray(files) ? files : []) {
    let pfad = '';
    try {
      pfad = webUtils.getPathForFile(f);
    } catch {
      // kein File (TypeError) → wie eine Datei ohne Pfad
    }
    if (pfad) pfade.push(pfad);
    else ohnePfad.push(typeof f?.name === 'string' && f.name ? f.name : '(ohne Namen)');
  }
  const g = await ladeInPortionen(
    pfade,
    (teil) => ipcRenderer.invoke('files:importPaths', teil, expandBuilds === true) as Promise<GeladeneDateien>,
  );
  return { ...g, ohnePfad };
}

const api: JmprApi = {
  platform: process.platform,
  view,

  files: {
    importDocs: () => ipcRenderer.invoke('files:importDocs') as Promise<ImportedFile[]>,
    importImage: () => ipcRenderer.invoke('files:importImage') as Promise<ImportedFile | null>,
    importOffice: (expandBuilds?: boolean) =>
      ipcRenderer.invoke('files:importOffice', expandBuilds) as Promise<OfficeImportResult>,
    importiereAbgelegte,
    openProject: () =>
      ipcRenderer.invoke('files:openProject') as Promise<{
        name: string;
        bytes: Uint8Array;
      } | null>,
    saveProject: (suggestedName, bytes) =>
      ipcRenderer.invoke('files:saveProject', suggestedName, bytes) as Promise<string | null>,
    savePdf: (suggestedName, bytes) =>
      ipcRenderer.invoke('files:savePdf', suggestedName, bytes) as Promise<string | null>,
    onOpenProject: (cb) => {
      const listener = (_event: unknown, p: { name: string; bytes: Uint8Array }) => cb(p);
      ipcRenderer.on('project:open', listener);
      return () => ipcRenderer.off('project:open', listener);
    },
    onOpenFiles: (cb) => {
      const listener = (_event: unknown, p: OpenFilesPayload) => cb(p);
      ipcRenderer.on('project:openFiles', listener);
      return () => ipcRenderer.off('project:openFiles', listener);
    },
  },

  present: {
    start: (payload: PresentationPayload, ziel) =>
      ipcRenderer.invoke('present:start', payload, ziel) as Promise<void>,
    getPayload: () =>
      ipcRenderer.invoke('present:getPayload') as Promise<PresentationPayload | null>,
    getState: () => ipcRenderer.invoke('present:getState') as Promise<PresentationState>,
    goto: (index) => ipcRenderer.invoke('present:goto', index) as Promise<void>,
    next: () => ipcRenderer.invoke('present:next') as Promise<void>,
    prev: () => ipcRenderer.invoke('present:prev') as Promise<void>,
    stop: () => ipcRenderer.invoke('present:stop') as Promise<void>,
    setScreen: (mode) => ipcRenderer.invoke('present:setScreen', mode) as Promise<void>,
    setSchleife: (an) => ipcRenderer.invoke('present:setSchleife', an) as Promise<void>,
    displays: () => ipcRenderer.invoke('present:displays'),
    assignAudience: (displayId) =>
      ipcRenderer.invoke('present:assignAudience', displayId) as Promise<void>,
    toggleAudienceFullscreen: () =>
      ipcRenderer.invoke('present:toggleAudienceFullscreen') as Promise<boolean>,
    toggleReferentVollbild: () =>
      ipcRenderer.invoke('present:toggleReferentVollbild') as Promise<boolean>,
    referentVollbild: () => ipcRenderer.invoke('present:referentVollbild') as Promise<boolean>,
    onReferentVollbild: (cb) => {
      const listener = (_event: unknown, an: boolean) => cb(an);
      ipcRenderer.on('present:referentVollbildStand', listener);
      return () => ipcRenderer.off('present:referentVollbildStand', listener);
    },
    onState: (cb) => {
      const listener = (_event: unknown, s: PresentationState) => cb(s);
      ipcRenderer.on('present:state', listener);
      return () => ipcRenderer.off('present:state', listener);
    },
  },

  remote: {
    interfaces: () => ipcRenderer.invoke('remote:interfaces') as Promise<NetInterface[]>,
    status: () => ipcRenderer.invoke('remote:status') as Promise<RemoteStatus>,
    apply: (config: RemoteConfig) =>
      ipcRenderer.invoke('remote:apply', config) as Promise<RemoteStatus>,
    onStatus: (cb) => {
      const listener = (_event: unknown, s: RemoteStatus) => cb(s);
      ipcRenderer.on('remote:status', listener);
      return () => ipcRenderer.off('remote:status', listener);
    },
  },

  timer: {
    getState: () => ipcRenderer.invoke('timer:getState') as Promise<TimerSource>,
    getConfig: () => ipcRenderer.invoke('timer:getConfig') as Promise<TimerSyncConfig>,
    apply: (config: TimerSyncConfig) =>
      ipcRenderer.invoke('timer:apply', config) as Promise<TimerSyncConfig>,
    onState: (cb) => {
      const listener = (_event: unknown, s: TimerSource) => cb(s);
      ipcRenderer.on('timer:state', listener);
      return () => ipcRenderer.off('timer:state', listener);
    },
  },

  ndi: {
    status: () => ipcRenderer.invoke('ndi:status') as Promise<NdiStatus>,
    setzeAn: (an) => ipcRenderer.invoke('ndi:setzeAn', an) as Promise<NdiStatus>,
    onStatus: (cb) => {
      const listener = (_event: unknown, s: NdiStatus) => cb(s);
      ipcRenderer.on('ndi:status', listener);
      return () => ipcRenderer.off('ndi:status', listener);
    },
    onPayload: (cb) => {
      const listener = (_event: unknown, p: PresentationPayload | null) => cb(p);
      ipcRenderer.on('present:payload', listener);
      return () => ipcRenderer.off('present:payload', listener);
    },
    fensterBereit: () => ipcRenderer.send('ndi:fensterBereit'),
  },
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('jmpr', api);
} else {
  // @ts-expect-error fallback when context isolation is off
  window.jmpr = api;
}
