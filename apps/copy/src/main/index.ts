import { app, BrowserWindow, shell } from 'electron';
import path, { join } from 'node:path';
import { initAppRuntime } from '@jm/app-runtime';
import { registerIpc } from './ipc';
import { rescheduleAll, stopAllRunners } from './sync/scheduler';

declare const __dirname: string;

// Geteilter Runtime-Layer: Logging, Crash-Handler, Deep-Links, Presence.
// P2 (#60): CSP-Pilot. copy spricht im Renderer nur per IPC (kein Custom-Protokoll,
// kein direkter Netz-Zugriff) → strenge Default-CSP ohne zusätzliche Quellen.
initAppRuntime({ appId: 'jm-copy', appName: 'JM Copy', csp: true });

let mainWindow: BrowserWindow | null = null;

const preloadPath = join(__dirname, '../preload/index.cjs');

function resourcePath(filename: string): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, filename);
  }
  return path.join(__dirname, '..', '..', 'resources', filename);
}

function loadMain(win: BrowserWindow): void {
  const rendererUrl = process.env['ELECTRON_RENDERER_URL'];
  if (rendererUrl) {
    win.loadURL(rendererUrl);
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

function createMainWindow(): BrowserWindow {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    return mainWindow;
  }
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: '#121212',
    show: false,
    title: 'JM Copy',
    icon: resourcePath('icon.png'),
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      sandbox: true,
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
    mainWindow = null;
  });

  loadMain(win);
  mainWindow = win;
  return win;
}

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

  app.whenReady().then(() => {
    registerIpc(() => mainWindow);
    createMainWindow();
    // Auto-Sync-Jobs (Überwachung/Intervall) aus dem Store hochfahren.
    rescheduleAll();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });

  app.on('will-quit', () => stopAllRunners());

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
