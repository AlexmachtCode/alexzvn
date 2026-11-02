// IPC-Verdrahtung zwischen Operator-Renderer und Main.
//   - Raum öffnen/schließen + Gast-Token (room.ts)
//   - NDI-Sender je Gast starten/stoppen (ndi-guests.ts) — getrieben von den
//     ndi-Effekten, die der Renderer aus dem DO empfängt
//   - abgeleiteten STATE ans Steuerprotokoll weiterreichen (control-server.ts)
import { ipcMain, shell, type BrowserWindow } from 'electron';
import { join } from 'node:path';
import { getLog } from '@jm/app-runtime';
import { resourcePath } from '@jm/electron-kit';
import { IPC, LIZENZ_DATEI, NDI_SEITE, PEER_CONNECT, neustartSchluessel, oeffneAdresseMit, oeffnePfadMit } from '@shared/ipc';
import type { AppStatus, OeffnenErgebnis, ProxyInfo } from '@shared/types';
import { baueAppStatus } from '@shared/app-status';
import { closeRoom, isConfigured, mintGuest, openRoom, peerConnectInfo, proxyConfig } from './room';
import { proxyKeySource, proxyUrl, setProxyKey, setProxyUrl } from './settings';
import { gastLagen, gastNeustart, spinUp, tearDown, tearDownAll } from './ndi-guests';
import { programmLage, programmNeustart, startProgram, stopProgram } from './ndi-program';
import { CONTROL_PORT, pushControlState } from './control-server';
import { initShow, showInfo } from './show-open';
import { presenterConnected, slideCue } from './presenter-link';
import { zoomKurz } from './zoom';

declare const __dirname: string;

let getWindow: () => BrowserWindow | null = () => null;
let getPeer: () => BrowserWindow | null = () => null;
let onStatusChange: (s: AppStatus) => void = () => {};

/** Cloud-Zugang für die Oberfläche — bewusst OHNE den Key selbst. */
function proxyInfo(): ProxyInfo {
  return { url: proxyUrl(), keySource: proxyKeySource(), configured: isConfigured() };
}

/** AppStatus aus den Messwerten des Mains, gebaut nur über baueAppStatus (Plan C, E44, KF10). */
export function currentStatus(): AppStatus {
  return baueAppStatus({
    configured: isConfigured(),
    proxyBase: proxyConfig().base,
    proxyKeySource: proxyKeySource(),
    controlPort: CONTROL_PORT,
    ndiGaeste: gastLagen(),
    ndiProgramm: programmLage(),
    presenterLinked: presenterConnected(),
    zoom: zoomKurz(),
  });
}

function pushStatus(): void {
  const s = currentStatus();
  getWindow()?.webContents.send(IPC.status, s);
  onStatusChange(s);
}

/** Die Lizenzbedingungen im Paket (E55, LP5): gepackt resources/LIZENZ.txt, im Dev apps/connect/resources/LIZENZ.txt. */
function lizenzPfad(): string {
  return resourcePath(LIZENZ_DATEI, join(__dirname, '..', '..', 'resources'));
}

/** Ein gescheitertes Öffnen steht zusätzlich im Log (Diagnose, ohne Namen; E35). */
function meldeOeffnen(was: string, r: OeffnenErgebnis): OeffnenErgebnis {
  if (!r.ok) getLog().warn(`[connect] ${was} ließ sich nicht öffnen: ${r.pfad}`);
  return r;
}

export function registerIpc(deps: {
  getWindow: () => BrowserWindow | null;
  getPeer: () => BrowserWindow | null;
  onStatusChange: (s: AppStatus) => void;
  /** Logordner von Connect (runtime.logDir), für jmc:logordner (E35). */
  logDir: string;
}): void {
  getWindow = deps.getWindow;
  getPeer = deps.getPeer;
  onStatusChange = deps.onStatusChange;
  const logDir = deps.logDir;

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

  // ── NDI und Lizenz (Plan C, E35, E55, KF12): hier, auf beiden Plattformen, nicht in der Windows-Weiche von startZoom.
  // Feste Ziele, keine Nutzlast; scheitert das Öffnen, kommt der Pfad bzw. die Adresse für T143 zurück.
  ipcMain.handle(IPC.logordner, async (): Promise<OeffnenErgebnis> => meldeOeffnen('Logordner', await oeffnePfadMit((pf) => shell.openPath(pf), logDir)));
  ipcMain.handle(IPC.lizenz, async (): Promise<OeffnenErgebnis> => meldeOeffnen('Lizenzbedingungen', await oeffnePfadMit((pf) => shell.openPath(pf), lizenzPfad())));
  ipcMain.handle(IPC.ndiSeite, async (): Promise<OeffnenErgebnis> => meldeOeffnen('ndi.video', await oeffneAdresseMit((a) => shell.openExternal(a), NDI_SEITE)));
  // „NDI neu starten“ (22.3 Nr. 9): { schluessel } feldweise geprüft; ein fremder oder fehlender Schlüssel ändert nichts.
  ipcMain.handle(IPC.ndiNeustart, async (_e, p: unknown): Promise<void> => {
    const s = neustartSchluessel(p);
    if (s !== null) gastNeustart(s);
  });
  // „Programm neu starten“ (22.4): wirkt nur in gescheitert (Lage).
  ipcMain.handle(IPC.programmNeustart, async (): Promise<void> => programmNeustart());

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
    if (typeof msg === 'string') getLog().info('[peer]', msg);
  });

  // Auditierbare Vorgänge (heute: Talkback) ins Laufzeit-Log von @jm/app-runtime.
  // Spur S4 ersetzt das später durch ein echtes audit_log (Muster: studio-control).
  ipcMain.on(IPC.audit, (_e, p: { event?: string; detail?: string }) => {
    if (p?.event) getLog().info('[audit]', p.event, p.detail ?? '');
  });

  // Folien-Cue eines freigegebenen Gasts → JM Presenter im LAN (Welle 6.3c). Erreicht der Cue
  // niemanden, sagt das Log es laut — ein stumm verschluckter Blätter-Befehl wäre auf der Bühne
  // nicht zu diagnostizieren.
  ipcMain.on(IPC.slideCue, (_e, p: { dir?: 'next' | 'prev'; guestId?: string }) => {
    if (p?.dir !== 'next' && p?.dir !== 'prev') return;
    const sent = slideCue(p.dir);
    if (sent === 0) getLog().warn('[connect] Folien-Cue ohne Empfänger — kein JM Presenter im Netz gefunden.');
    else getLog().info('[audit] slide', `${p.dir} von ${p.guestId ?? '?'} → ${sent} Presenter`);
  });
}

/** Status an Fenster und Tray pushen; aufgerufen von der NDI-Lage (onLage, E52), Zoom und Presenter. */
export function notifyStatusChanged(): void {
  pushStatus();
}
