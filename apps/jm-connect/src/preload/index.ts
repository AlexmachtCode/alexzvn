import { contextBridge, ipcRenderer } from 'electron';
import type { AppStatus, ControlCommand, GuestInvite, JmConnectApi, RoomSession, ShowInfo, TrayCommand } from '@shared/types';
import { IPC, PEER_CONNECT, PEER_FRAME_PORT, PEER_PROGRAM_PORT } from '@shared/ipc';

// Versteckter Peer-Renderer: den vom Main übertragenen Frame-MessagePort (je Gast)
// in den Renderer-Main-World durchreichen. contextBridge kann MessagePorts nicht
// direkt übergeben → dokumentierter window.postMessage-Transfer (Empfang: window 'message').
ipcRenderer.on(PEER_FRAME_PORT, (e, payload: { key: string }) => {
  window.postMessage({ ch: PEER_FRAME_PORT, key: payload?.key }, '*', e.ports);
});

// Programm-NDI-Frame-Port (Rückkanal 6.2a) an den Peer-Renderer durchreichen.
ipcRenderer.on(PEER_PROGRAM_PORT, (e) => {
  window.postMessage({ ch: PEER_PROGRAM_PORT }, '*', e.ports);
});

// Raum-Verbindungsdaten (WS + ICE-URL) an den Peer-Renderer durchreichen.
ipcRenderer.on(PEER_CONNECT, (_e, payload: { wsUrl: string; iceUrl: string }) => {
  window.postMessage({ ch: PEER_CONNECT, ...payload }, '*');
});

const api: JmConnectApi = {
  platform: process.platform,
  openRoom: (room?: string) => ipcRenderer.invoke(IPC.openRoom, room) as Promise<RoomSession>,
  mintGuest: (name: string) => ipcRenderer.invoke(IPC.mintGuest, name) as Promise<GuestInvite>,
  mintGuests: (names: string[]) => ipcRenderer.invoke(IPC.mintGuests, names) as Promise<GuestInvite[]>,
  closeRoom: () => ipcRenderer.invoke(IPC.closeRoom) as Promise<void>,
  getShow: () => ipcRenderer.invoke(IPC.getShow) as Promise<ShowInfo | null>,
  onShow: (cb) => {
    const listener = (_e: unknown, show: ShowInfo | null) => cb(show);
    ipcRenderer.on(IPC.showInfo, listener);
    return () => ipcRenderer.off(IPC.showInfo, listener);
  },
  ndiUp: (key: string, label: string) => ipcRenderer.send(IPC.ndiUp, { key, label }),
  ndiDown: (key: string) => ipcRenderer.send(IPC.ndiDown, { key }),
  pushControlState: (kv) => ipcRenderer.send(IPC.pushControlState, kv),
  peerLog: (msg: string) => ipcRenderer.send(IPC.peerLog, msg),
  audit: (event: string, detail?: string) => ipcRenderer.send(IPC.audit, { event, detail }),
  slideCue: (dir: 'next' | 'prev', guestId: string) => ipcRenderer.send(IPC.slideCue, { dir, guestId }),
  getStatus: () => ipcRenderer.invoke(IPC.status) as Promise<AppStatus>,
  onStatus: (cb) => {
    const listener = (_e: unknown, s: AppStatus) => cb(s);
    ipcRenderer.on(IPC.status, listener);
    return () => ipcRenderer.off(IPC.status, listener);
  },
  onTrayCommand: (cb) => {
    const listener = (_e: unknown, cmd: TrayCommand) => cb(cmd);
    ipcRenderer.on(IPC.trayCommand, listener);
    return () => ipcRenderer.off(IPC.trayCommand, listener);
  },
  onControlCommand: (cb) => {
    const listener = (_e: unknown, cmd: ControlCommand) => cb(cmd);
    ipcRenderer.on(IPC.controlCommand, listener);
    return () => ipcRenderer.off(IPC.controlCommand, listener);
  },
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('jmconnect', api);
} else {
  // @ts-expect-error Fallback, wenn contextIsolation aus ist
  window.jmconnect = api;
}
