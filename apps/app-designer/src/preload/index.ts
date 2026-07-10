import { contextBridge, ipcRenderer } from 'electron';
import type { AppProject } from '@jm/appkit';
import type {
  AssetBlob,
  DisplayInfo,
  ExportResult,
  JmAppDesignerApi,
  OpenedProject,
  SaveResult,
  TemplateInfo,
} from '@shared/types';

const api: JmAppDesignerApi = {
  platform: process.platform,

  listTemplates: () => ipcRenderer.invoke('appdesigner:listTemplates') as Promise<TemplateInfo[]>,
  loadTemplate: (id) => ipcRenderer.invoke('appdesigner:loadTemplate', id) as Promise<AppProject>,

  openProject: () => ipcRenderer.invoke('appdesigner:openProject') as Promise<OpenedProject | null>,
  saveProject: (zipBytes, currentPath) =>
    ipcRenderer.invoke('appdesigner:saveProject', zipBytes, currentPath) as Promise<SaveResult>,
  saveProjectAs: (zipBytes) => ipcRenderer.invoke('appdesigner:saveProjectAs', zipBytes) as Promise<SaveResult>,

  importAsset: () => ipcRenderer.invoke('appdesigner:importAsset') as Promise<AssetBlob[]>,

  publish: (doc, assets) => ipcRenderer.invoke('appdesigner:publish', doc, assets) as Promise<void>,
  previewUrl: () => ipcRenderer.invoke('appdesigner:previewUrl') as Promise<string>,

  exportBundle: (doc, assets) => ipcRenderer.invoke('appdesigner:exportBundle', doc, assets) as Promise<ExportResult>,

  listDisplays: () => ipcRenderer.invoke('appdesigner:listDisplays') as Promise<DisplayInfo[]>,
  openKiosk: (displayId) => ipcRenderer.invoke('appdesigner:openKiosk', displayId) as Promise<void>,
  closeKiosk: () => ipcRenderer.invoke('appdesigner:closeKiosk') as Promise<void>,
  isKioskOpen: () => ipcRenderer.invoke('appdesigner:isKioskOpen') as Promise<boolean>,

  revealPath: (p) => ipcRenderer.invoke('appdesigner:revealPath', p) as Promise<void>,
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('jmapp', api);
} else {
  // Fallback, wenn contextIsolation abgeschaltet ist (sollte nie vorkommen).
  window.jmapp = api;
}
