import { BrowserWindow, ipcMain } from 'electron';
import { listScreens } from './sources';
import { armCapture } from './capture-handler';
import { ndiConnect, ndiDisconnect, ndiFind, ndiStatus } from './ndi-receive';
import { ndiOutputStatus, startNdiOutput, stopNdiOutput } from './ndi-send';
import { registerOutputIpc } from './output';
import { controlStatus, pushState, startControlServer, stopControlServer } from './control-server';
import { openProject, saveProject } from './project/io';
import { registerSecondScreenIpc } from './second-screen';
import type { SaveSwitcherRequest } from '@shared/project';
import type { SwitcherStateMsg } from '@jm/companion-protocol';

export function registerIpc(): void {
  ipcMain.handle('sources:listScreens', () => listScreens());
  ipcMain.handle('capture:arm', (_e, sourceId: string) => armCapture(sourceId));

  // Projekt speichern/öffnen (#89) — Dialoge modal zum Hauptfenster.
  ipcMain.handle('project:open', () => openProject(BrowserWindow.getFocusedWindow()));
  ipcMain.handle('project:save', (_e, req: SaveSwitcherRequest) =>
    saveProject(BrowserWindow.getFocusedWindow(), req),
  );

  ipcMain.handle('ndi:find', (_e, timeoutMs?: number) => ndiFind(timeoutMs));
  ipcMain.handle('ndi:connect', (_e, recvId: string, source: string) => ndiConnect(recvId, source));
  ipcMain.handle('ndi:disconnect', (_e, recvId: string) => ndiDisconnect(recvId));
  ipcMain.handle('ndi:status', () => ndiStatus());

  registerOutputIpc();

  ipcMain.handle('output:ndiStart', (_e, name: string) => startNdiOutput(name));
  ipcMain.handle('output:ndiStop', () => {
    stopNdiOutput();
  });
  ipcMain.handle('output:ndiStatus', () => ndiOutputStatus());

  ipcMain.handle('control:start', (_e, port: number) => startControlServer(port));
  ipcMain.handle('control:stop', () => {
    stopControlServer();
  });
  ipcMain.handle('control:status', () => controlStatus());
  ipcMain.on('control:pushState', (_e, state: SwitcherStateMsg) => pushState(state));

  registerSecondScreenIpc();
}
