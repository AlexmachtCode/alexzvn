import { contextBridge, ipcRenderer } from 'electron';
import type {
  ImportedFile,
  JmprApi,
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
  if (v === 'presenter' || v === 'audience') return v;
  return 'editor';
}

const api: JmprApi = {
  platform: process.platform,
  view: parseView(),

  files: {
    importDocs: () => ipcRenderer.invoke('files:importDocs') as Promise<ImportedFile[]>,
    importImage: () => ipcRenderer.invoke('files:importImage') as Promise<ImportedFile | null>,
    importOffice: (expandBuilds?: boolean) =>
      ipcRenderer.invoke('files:importOffice', expandBuilds) as Promise<OfficeImportResult>,
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
    start: (payload: PresentationPayload, audienceDisplayId) =>
      ipcRenderer.invoke('present:start', payload, audienceDisplayId) as Promise<void>,
    getPayload: () =>
      ipcRenderer.invoke('present:getPayload') as Promise<PresentationPayload | null>,
    getState: () => ipcRenderer.invoke('present:getState') as Promise<PresentationState>,
    goto: (index) => ipcRenderer.invoke('present:goto', index) as Promise<void>,
    next: () => ipcRenderer.invoke('present:next') as Promise<void>,
    prev: () => ipcRenderer.invoke('present:prev') as Promise<void>,
    stop: () => ipcRenderer.invoke('present:stop') as Promise<void>,
    setScreen: (mode) => ipcRenderer.invoke('present:setScreen', mode) as Promise<void>,
    displays: () => ipcRenderer.invoke('present:displays'),
    assignAudience: (displayId) =>
      ipcRenderer.invoke('present:assignAudience', displayId) as Promise<void>,
    toggleAudienceFullscreen: () =>
      ipcRenderer.invoke('present:toggleAudienceFullscreen') as Promise<boolean>,
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
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('jmpr', api);
} else {
  // @ts-expect-error fallback when context isolation is off
  window.jmpr = api;
}
