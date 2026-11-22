import { contextBridge, ipcRenderer } from 'electron';
import type { MasterLinkMeldung } from '@jm/app-runtime';
import type { FernsteuerungMeldung } from '@shared/fernsteuerung';
import type { BattleConfig, BattleState, Competitor, JmBattleApi, Side, ToolLink } from '@shared/types';

const api: JmBattleApi = {
  platform: process.platform,
  getState: () => ipcRenderer.invoke('battle:getState') as Promise<BattleState>,
  onState: (cb) => {
    const listener = (_e: unknown, s: BattleState): void => cb(s);
    ipcRenderer.on('battle:state', listener);
    return () => ipcRenderer.off('battle:state', listener);
  },
  onLinks: (cb) => {
    const listener = (_e: unknown, links: ToolLink[]): void => cb(links);
    ipcRenderer.on('battle:links', listener);
    return () => ipcRenderer.off('battle:links', listener);
  },

  setCompetitor: (side: Side, patch: Partial<Competitor>) =>
    ipcRenderer.invoke('battle:setCompetitor', side, patch) as Promise<BattleState>,
  swapCompetitors: () => ipcRenderer.invoke('battle:swapCompetitors') as Promise<BattleState>,

  nextRound: () => ipcRenderer.invoke('battle:nextRound') as Promise<BattleState>,
  prevRound: () => ipcRenderer.invoke('battle:prevRound') as Promise<BattleState>,
  gotoRound: (n: number) => ipcRenderer.invoke('battle:gotoRound', n) as Promise<BattleState>,
  setJuryWinner: (round: number, winner: Side | 'tie' | null) =>
    ipcRenderer.invoke('battle:setJuryWinner', round, winner) as Promise<BattleState>,
  setVotingOpen: (open: boolean) => ipcRenderer.invoke('battle:setVotingOpen', open) as Promise<BattleState>,
  clearVotes: (round: number) => ipcRenderer.invoke('battle:clearVotes', round) as Promise<BattleState>,
  setLive: (v: boolean) => ipcRenderer.invoke('battle:setLive', v) as Promise<BattleState>,
  reset: () => ipcRenderer.invoke('battle:reset') as Promise<BattleState>,

  setConfig: (patch: Partial<BattleConfig>) => ipcRenderer.invoke('battle:setConfig', patch) as Promise<BattleState>,
  setRemote: (enabled: boolean) => ipcRenderer.invoke('battle:setRemote', enabled) as Promise<BattleState>,
  setEndpoint: (role: string, host: string, port: number) =>
    ipcRenderer.invoke('battle:setEndpoint', role, host, port) as Promise<BattleState>,

  pickRecording: () => ipcRenderer.invoke('battle:pickRecording') as Promise<BattleState>,
  pickClipDir: () => ipcRenderer.invoke('battle:pickClipDir') as Promise<BattleState>,
  clip: (seconds?: number) => ipcRenderer.invoke('battle:clip', seconds) as Promise<BattleState>,

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
  fernsteuerung: () => (ipcRenderer.invoke('battle:fernsteuerung') as Promise<FernsteuerungMeldung | null>).catch(() => null),
  onFernsteuerung: (cb) => {
    const listener = (_e: unknown, m: FernsteuerungMeldung | null): void => cb(m);
    ipcRenderer.on('battle:fernsteuerung', listener);
    return () => ipcRenderer.off('battle:fernsteuerung', listener);
  },
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('jmbattle', api);
} else {
  // @ts-expect-error fallback when context isolation is off
  window.jmbattle = api;
}
