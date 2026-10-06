import { contextBridge, ipcRenderer } from 'electron';
import type {
  AppStatus,
  ControlCommand,
  GuestInvite,
  JmConnectApi,
  ProxyInfo,
  RoomSession,
  ShowInfo,
  TrayCommand,
  ZoomAbbild,
  ZoomErgebnis,
} from '@shared/types';
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
  getProxy: () => ipcRenderer.invoke(IPC.getProxy) as Promise<ProxyInfo>,
  setProxy: (p: { url?: string; key?: string }) => ipcRenderer.invoke(IPC.setProxy, p) as Promise<ProxyInfo>,
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
  // ── Zoom (Stage 4a, Spec 5.5). Nutzlasten werden Feld für Feld weitergereicht, nichts darüber hinaus.
  zoomGet: () => ipcRenderer.invoke(IPC.zoomGet) as Promise<ZoomAbbild>,
  onZoom: (cb) => {
    const listener = (_e: unknown, a: ZoomAbbild) => cb(a);
    ipcRenderer.on(IPC.zoom, listener);
    return () => ipcRenderer.off(IPC.zoom, listener);
  },
  zoomSdkWaehlen: () => ipcRenderer.invoke(IPC.zoomSdkWaehlen) as Promise<ZoomErgebnis>,
  zoomZugangWaehlen: () => ipcRenderer.invoke(IPC.zoomZugangWaehlen) as Promise<ZoomErgebnis>,
  zoomZugangEintragen: ({ clientId, clientSecret }) =>
    ipcRenderer.invoke(IPC.zoomZugangEintragen, { clientId, clientSecret }) as Promise<ZoomErgebnis>,
  zoomZugangLoeschen: () => ipcRenderer.invoke(IPC.zoomZugangLoeschen) as Promise<ZoomErgebnis>,
  zoomSdkSchluesselEintragen: ({ schluessel }) =>
    ipcRenderer.invoke(IPC.zoomSdkSchluesselEintragen, { schluessel }) as Promise<ZoomErgebnis>,
  zoomSdkSchluesselLoeschen: () => ipcRenderer.invoke(IPC.zoomSdkSchluesselLoeschen) as Promise<ZoomErgebnis>,
  zoomPruefen: () => ipcRenderer.invoke(IPC.zoomPruefen) as Promise<ZoomErgebnis>,
  zoomBeitreten: (p) =>
    ipcRenderer.invoke(IPC.zoomBeitreten, { nummer: p.nummer, kenncode: p.kenncode, anzeigename: p.anzeigename }) as Promise<ZoomErgebnis>,
  zoomVerlassen: () => ipcRenderer.invoke(IPC.zoomVerlassen) as Promise<void>,
  zoomLaden: (p) =>
    ipcRenderer.invoke(IPC.zoomLaden, { id: p.id, ton: p.ton, trotzBetriebsgroesse: p.trotzBetriebsgroesse }) as Promise<ZoomErgebnis>,
  zoomEntladen: (p) => ipcRenderer.invoke(IPC.zoomEntladen, { aboId: p.aboId }) as Promise<ZoomErgebnis>,
  zoomTon: (p) => ipcRenderer.invoke(IPC.zoomTon, { id: p.id, an: p.an }) as Promise<ZoomErgebnis>,
  zoomSollVerwerfen: (p) => ipcRenderer.invoke(IPC.zoomSollVerwerfen, { name: p.name }) as Promise<void>,
  zoomVersatz: (p) => ipcRenderer.invoke(IPC.zoomVersatz, { ms: p.ms }) as Promise<ZoomErgebnis>,
  zoomErneut: () => ipcRenderer.invoke(IPC.zoomErneut) as Promise<ZoomErgebnis>,
  zoomSchliessen: () => ipcRenderer.invoke(IPC.zoomSchliessen) as Promise<void>,
  zoomMeldungWeg: () => ipcRenderer.invoke(IPC.zoomMeldungWeg) as Promise<void>,
  zoomLogordner: () => ipcRenderer.invoke(IPC.zoomLogordner) as Promise<void>,
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('jmconnect', api);
} else {
  // @ts-expect-error Fallback, wenn contextIsolation aus ist
  window.jmconnect = api;
}
