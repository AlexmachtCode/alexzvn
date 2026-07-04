import { app, BrowserWindow, shell } from 'electron';
import path, { join } from 'node:path';
import { initAppRuntime } from '@jm/app-runtime';
import { registerIpc } from './ipc';
import { handleShowDeepLink } from './show-open';

declare const __dirname: string;

// Geteilter Runtime-Layer: Logging, Crash-Handler, Deep-Links, Presence.
// onDeepLink fängt Show-Links bei laufender App (second-instance/open-url) ab;
// den Start-Link verarbeiten wir unten über runtime.initialDeepLink.
const runtime = initAppRuntime({
  csp: true,
  appId: 'jm-grafiktool',
  appName: 'JM Grafiktool',
  onDeepLink: (url) => void handleShowDeepLink(url, () => mainWindow),
});

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
    width: 1480,
    height: 920,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#121212',
    show: false,
    title: 'JM Grafiktool',
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
    // Start-Deep-Link (App per Show gestartet) verarbeiten — lädt das in der
    // .jmshow referenzierte Grafiktool-Dokument.
    if (runtime.initialDeepLink) void handleShowDeepLink(runtime.initialDeepLink, () => mainWindow);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
