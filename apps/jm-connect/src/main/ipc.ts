// IPC-Verdrahtung zwischen Operator-Renderer und Main.
//   - Raum öffnen/schließen + Gast-Token (room.ts)
//   - NDI-Sender je Gast starten/stoppen (ndi-guests.ts) — getrieben von den
//     ndi-Effekten, die der Renderer aus dem DO empfängt
//   - abgeleiteten STATE ans Steuerprotokoll weiterreichen (control-server.ts)
import { ipcMain, type BrowserWindow } from 'electron';
import { IPC, PEER_CONNECT } from '@shared/ipc';
import type { AppStatus, ProxyInfo } from '@shared/types';
import { closeRoom, isConfigured, mintGuest, openRoom, peerConnectInfo, proxyConfig } from './room';
import { proxyKeySource, proxyUrl, setProxyKey, setProxyUrl } from './settings';
import { activeCount, spinUp, tearDown, tearDownAll } from './ndi-guests';
import { programStatus, startProgram, stopProgram } from './ndi-program';
import { CONTROL_PORT, pushControlState } from './control-server';
import { initShow, showInfo } from './show-open';
import { presenterConnected, slideCue } from './presenter-link';

let getWindow: () => BrowserWindow | null = () => null;
let getPeer: () => BrowserWindow | null = () => null;
let onStatusChange: (s: AppStatus) => void = () => {};

/** Cloud-Zugang für die Oberfläche — bewusst OHNE den Key selbst. */
function proxyInfo(): ProxyInfo {
  return { url: proxyUrl(), keySource: proxyKeySource(), configured: isConfigured() };
}

export function currentStatus(): AppStatus {
  const prog = programStatus();
  return {
    configured: isConfigured(),
    proxyBase: proxyConfig().base,
    proxyKeySource: proxyKeySource(),
    controlPort: CONTROL_PORT,
    ndiSenders: activeCount(),
    programState: prog.state,
    programSource: prog.source,
    presenterLinked: presenterConnected(),
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

  // Show-Deep-Link kann VOR dem Fenster eintreffen — deshalb zusätzlich der getShow-Abruf unten.
  initShow((show) => getWindow()?.webContents.send(IPC.showInfo, show));

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

  // iveo-Provisionierung: ein Join-Link je Sprecher. Serialisiert, nicht Promise.all — die
  // Reihenfolge der Karten soll der Sprecher-Reihenfolge der Veranstaltung entsprechen.
  ipcMain.handle(IPC.mintGuests, async (_e, names: string[]) => {
    const invites = [];
    for (const name of Array.isArray(names) ? names : []) invites.push(await mintGuest(name));
    return invites;
  });

  ipcMain.handle(IPC.getShow, async () => showInfo());

  ipcMain.handle(IPC.closeRoom, async () => {
    tearDownAll();
    stopProgram();
    await closeRoom();
    pushStatus();
  });

  ipcMain.handle(IPC.getProxy, async () => proxyInfo());

  // Der Key kommt hier herein und geht nie wieder hinaus — zurück fließt nur seine Herkunft.
  ipcMain.handle(IPC.setProxy, async (_e, p: { url?: string; key?: string }) => {
    if (typeof p?.url === 'string') setProxyUrl(p.url);
    if (typeof p?.key === 'string') setProxyKey(p.key);
    pushStatus();
    return proxyInfo();
  });

  ipcMain.handle(IPC.status, async () => currentStatus());

  // `key` ist der NDI-Pool-Schlüssel (Gast-ID = Kamera, `<id>::screen` = geteilter Bildschirm).
  ipcMain.on(IPC.ndiUp, (_e, p: { key: string; label: string }) => {
    if (p?.key) spinUp(p.key, p.label || `JM Connect – ${p.key}`);
  });

  ipcMain.on(IPC.ndiDown, (_e, p: { key: string }) => {
    if (p?.key) tearDown(p.key);
  });

  ipcMain.on(IPC.pushControlState, (_e, kv: Record<string, string | number | boolean>) => {
    if (kv && typeof kv === 'object') pushControlState(kv);
  });

  // Der versteckte Peer hat kein sichtbares Fenster — seine Diagnose landet so im Terminal-Log.
  ipcMain.on(IPC.peerLog, (_e, msg: string) => {
    if (typeof msg === 'string') console.log('[peer]', msg);
  });

  // Auditierbare Vorgänge (heute: Talkback) ins Laufzeit-Log von @jm/app-runtime.
  // Spur S4 ersetzt das später durch ein echtes audit_log (Muster: studio-control).
  ipcMain.on(IPC.audit, (_e, p: { event?: string; detail?: string }) => {
    if (p?.event) console.log('[audit]', p.event, p.detail ?? '');
  });

  // Folien-Cue eines freigegebenen Gasts → JM Presenter im LAN (Welle 6.3c). Erreicht der Cue
  // niemanden, sagt das Log es laut — ein stumm verschluckter Blätter-Befehl wäre auf der Bühne
  // nicht zu diagnostizieren.
  ipcMain.on(IPC.slideCue, (_e, p: { dir?: 'next' | 'prev'; guestId?: string }) => {
    if (p?.dir !== 'next' && p?.dir !== 'prev') return;
    const sent = slideCue(p.dir);
    if (sent === 0) console.warn('[connect] Folien-Cue ohne Empfänger — kein JM Presenter im Netz gefunden.');
    else console.log('[audit] slide', `${p.dir} von ${p.guestId ?? '?'} → ${sent} Presenter`);
  });
}

/** Vom ndi-guests-Pool aufgerufen, wenn sich die Sender-Anzahl ändert. */
export function notifyStatusChanged(): void {
  pushStatus();
}
