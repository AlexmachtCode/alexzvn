import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path, { join } from 'node:path';
import { initAppRuntime, getLog } from '@jm/app-runtime';
import type { PartialTitlerConfig, TitlerRemoteState, TitlerState, TitlerStatus } from '@shared/types';
import { getConfig, patchConfig } from './config';
import { startSender, stopSender, senderActive } from './ndi/sender-process';
import { startControlServer, stopControlServer, updateTitlerState, CONTROL_PORT } from './control-server';

declare const __dirname: string;

let mainWindow: BrowserWindow | null = null;
const preloadPath = join(__dirname, '../preload/index.mjs');

const status: TitlerStatus = { ndiActive: false, connections: 0, suiteClients: 0 };

function buildState(): TitlerState {
  return { config: getConfig(), status };
}

function broadcastStatus(): void {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('titler:status', status);
}

function resourcePath(filename: string): string {
  if (app.isPackaged) return path.join(process.resourcesPath, filename);
  return path.join(__dirname, '..', '..', 'resources', filename);
}

function createMainWindow(): BrowserWindow {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    return mainWindow;
  }
  const win = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 960,
    minHeight: 660,
    backgroundColor: '#121212',
    show: false,
    title: 'JM Titler',
    icon: resourcePath('icon.png'),
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.on('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  win.on('closed', () => {
    stopSender();
    status.ndiActive = false;
    status.connections = 0;
    mainWindow = null;
  });
  const url = process.env['ELECTRON_RENDERER_URL'];
  if (url) win.loadURL(url);
  else win.loadFile(join(__dirname, '../renderer/index.html'));
  mainWindow = win;
  return win;
}

function startNdi(name: string): void {
  if (!mainWindow) return;
  startSender(mainWindow, name, (connections) => {
    status.connections = connections;
    broadcastStatus();
  });
  status.ndiActive = true;
  status.connections = 0;
  broadcastStatus();
}

function stopNdi(): void {
  stopSender();
  status.ndiActive = false;
  status.connections = 0;
  broadcastStatus();
}

function registerIpc(): void {
  ipcMain.handle('titler:getState', () => buildState());
  ipcMain.handle('titler:setConfig', (_e, patch: PartialTitlerConfig) => {
    patchConfig(patch);
    return buildState();
  });
  ipcMain.handle('titler:ndi-start', (_e, name: string) => startNdi(name || getConfig().ndiName));
  ipcMain.handle('titler:ndi-stop', () => stopNdi());
  ipcMain.handle('titler:ndi-status', () => {
    status.ndiActive = senderActive();
    return status;
  });
  // TCP-Fernsteuerung: Renderer meldet seinen Live-Zustand → Steuerserver.
  ipcMain.handle('titler:report-state', (_e, st: TitlerRemoteState) => updateTitlerState(st));
}

// Geteilter Runtime-Layer: Logging, Crash-Handler, Deep-Links, Presence.
initAppRuntime({ appId: 'jm-titler', appName: 'JM Titler' });

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    } else {
      createMainWindow();
    }
  });

  app.whenReady().then(async () => {
    registerIpc();
    createMainWindow();
    // TCP-Steuerserver (suite-weites Protokoll) für Companion u. a. — Befehle
    // gehen per IPC an den Renderer, der seinen Zustand zurückmeldet. Ergebnis
    // loggen, damit eine fehlende Suite-Verbindung nicht unsichtbar bleibt.
    try {
      const r = await startControlServer(
        () => mainWindow,
        (clients) => {
          status.suiteClients = clients;
          broadcastStatus();
        },
      );
      if (!r.ok) getLog().warn(`Titler-Steuerserver nicht gestartet: ${r.error ?? 'unbekannt'}`);
      else getLog().info(`Titler-Steuerserver (Companion) lauscht auf :${CONTROL_PORT}`);
    } catch (err) {
      getLog().warn(`Titler-Steuerserver fehlgeschlagen: ${(err as Error).message}`);
    }
  });

  app.on('before-quit', () => {
    stopSender();
    stopControlServer();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
