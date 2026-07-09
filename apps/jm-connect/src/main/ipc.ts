// IPC-Verdrahtung zwischen Operator-Renderer und Main.
//   - Raum öffnen/schließen + Gast-Token (room.ts)
//   - NDI-Sender je Gast starten/stoppen (ndi-guests.ts) — getrieben von den
//     ndi-Effekten, die der Renderer aus dem DO empfängt
//   - abgeleiteten STATE ans Steuerprotokoll weiterreichen (control-server.ts)
import { ipcMain, type BrowserWindow } from 'electron';
import { IPC, PEER_CONNECT } from '@shared/ipc';
import type { AppStatus } from '@shared/types';
import { closeRoom, isConfigured, mintGuest, openRoom, peerConnectInfo, proxyConfig } from './room';
import { activeCount, spinUp, tearDown, tearDownAll } from './ndi-guests';
import { programStatus, startProgram, stopProgram } from './ndi-program';
import { CONTROL_PORT, pushControlState } from './control-server';

let getWindow: () => BrowserWindow | null = () => null;
let getPeer: () => BrowserWindow | null = () => null;
let onStatusChange: (s: AppStatus) => void = () => {};

export function currentStatus(): AppStatus {
  const prog = programStatus();
  return {
    configured: isConfigured(),
    proxyBase: proxyConfig().base,
    controlPort: CONTROL_PORT,
    ndiSenders: activeCount(),
    programState: prog.state,
    programSource: prog.source,
  };
}

function pushStatus(): void {
  const s = currentStatus();
  getWindow()?.webContents.send(IPC.status, s);
  onStatusChange(s);
}

export function registerIpc(deps: {
  getWindow: () => BrowserWindow | null;
  getPeer: () => BrowserWindow | null;
  onStatusChange: (s: AppStatus) => void;
}): void {
  getWindow = deps.getWindow;
  getPeer = deps.getPeer;
  onStatusChange = deps.onStatusChange;

  ipcMain.handle(IPC.openRoom, async (_e, room?: string) => {
    const session = await openRoom(room);
    // Den versteckten Peer separat mit dem DO verbinden (eigenes SFU-Medien-Signalling).
    const info = await peerConnectInfo();
    if (info) getPeer()?.webContents.send(PEER_CONNECT, info);
    // Programm-Rückkanal starten (Switcher-PGM → Peer → program-video an alle Gäste).
    startProgram();
    pushStatus();
    return session;
  });

  ipcMain.handle(IPC.mintGuest, async (_e, name: string) => mintGuest(name));

  ipcMain.handle(IPC.closeRoom, async () => {
    tearDownAll();
    stopProgram();
    await closeRoom();
    pushStatus();
  });

  ipcMain.handle(IPC.status, async () => currentStatus());

  ipcMain.on(IPC.ndiUp, (_e, p: { guestId: string; label: string }) => {
    if (p?.guestId) spinUp(p.guestId, p.label || `JM Connect – ${p.guestId}`);
  });

  ipcMain.on(IPC.ndiDown, (_e, p: { guestId: string }) => {
    if (p?.guestId) tearDown(p.guestId);
  });

  ipcMain.on(IPC.pushControlState, (_e, kv: Record<string, string | number | boolean>) => {
    if (kv && typeof kv === 'object') pushControlState(kv);
  });

  // Der versteckte Peer hat kein sichtbares Fenster — seine Diagnose landet so im Terminal-Log.
  ipcMain.on(IPC.peerLog, (_e, msg: string) => {
    if (typeof msg === 'string') console.log('[peer]', msg);
  });
}

/** Vom ndi-guests-Pool aufgerufen, wenn sich die Sender-Anzahl ändert. */
export function notifyStatusChanged(): void {
  pushStatus();
}
