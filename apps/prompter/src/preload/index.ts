import { contextBridge, ipcRenderer } from 'electron';
import type { MasterLinkMeldung } from '@jm/app-runtime';
import type { AusgabeZustand } from '@jm/output-window/zustand';
import type { FernsteuerungMeldung } from '@shared/fernsteuerung';
import type {
  DisplayInfo,
  JmpromptApi,
  PartialPrompterConfig,
  PrompterState,
} from '@shared/types';

const api: JmpromptApi = {
  platform: process.platform,
  getState: () => ipcRenderer.invoke('prompter:getState') as Promise<PrompterState>,
  setConfig: (patch: PartialPrompterConfig) =>
    ipcRenderer.invoke('prompter:setConfig', patch) as Promise<PrompterState>,
  importScript: () => ipcRenderer.invoke('prompter:importScript') as Promise<PrompterState>,
  onState: (cb) => {
    const listener = (_e: unknown, s: PrompterState): void => cb(s);
    ipcRenderer.on('prompter:state', listener);
    return () => ipcRenderer.off('prompter:state', listener);
  },
  transport: {
    play: () => ipcRenderer.invoke('prompter:play') as Promise<PrompterState>,
    pause: () => ipcRenderer.invoke('prompter:pause') as Promise<PrompterState>,
    toggle: () => ipcRenderer.invoke('prompter:toggle') as Promise<PrompterState>,
    seek: (em: number) => ipcRenderer.invoke('prompter:seek', em) as Promise<PrompterState>,
    nudge: (deltaEm: number) => ipcRenderer.invoke('prompter:nudge', deltaEm) as Promise<PrompterState>,
    reset: () => ipcRenderer.invoke('prompter:reset') as Promise<PrompterState>,
  },
  setRemote: (enabled: boolean) =>
    ipcRenderer.invoke('prompter:setRemote', enabled) as Promise<PrompterState>,
  // UX Welle 2a (Spec 3.9): Master-Link-Zustand lesend. null, solange die Brücke fehlt oder ablehnt (Statusleiste: unbekannt).
  masterLink: () => (ipcRenderer.invoke('jmps:master-link') as Promise<MasterLinkMeldung>).catch(() => null),
  onMasterLink: (cb) => {
    const listener = (_e: unknown, m: MasterLinkMeldung): void => cb(m);
    ipcRenderer.on('jmps:master-link', listener);
    return () => ipcRenderer.off('jmps:master-link', listener);
  },
  // Meldung des Steuerservers lesend (Port, läuft, Clients, Modus, Startfehler). null, solange Main nichts gemeldet hat.
  fernsteuerung: () => (ipcRenderer.invoke('prompter:fernsteuerung') as Promise<FernsteuerungMeldung | null>).catch(() => null),
  onFernsteuerung: (cb) => {
    const listener = (_e: unknown, m: FernsteuerungMeldung | null): void => cb(m);
    ipcRenderer.on('prompter:fernsteuerung', listener);
    return () => ipcRenderer.off('prompter:fernsteuerung', listener);
  },
  output: {
    displays: () => ipcRenderer.invoke('output:displays') as Promise<DisplayInfo[]>,
    open: (displayId) => ipcRenderer.invoke('output:open', displayId) as Promise<void>,
    close: () => ipcRenderer.invoke('output:close') as Promise<void>,
    isOpen: () => ipcRenderer.invoke('output:isOpen') as Promise<boolean>,
    zustand: () => (ipcRenderer.invoke('output:zustand') as Promise<AusgabeZustand | null>).catch(() => null),
    onZustand: (cb) => {
      const listener = (_e: unknown, z: AusgabeZustand): void => cb(z);
      ipcRenderer.on('output:zustand', listener);
      return () => ipcRenderer.off('output:zustand', listener);
    },
  },
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('jmprompt', api);
} else {
  // @ts-expect-error fallback when context isolation is off
  window.jmprompt = api;
}
