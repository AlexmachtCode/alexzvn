import { app, BrowserWindow, shell } from 'electron';
import path, { join } from 'node:path';
import { initAppRuntime } from '@jm/app-runtime';
import { registerIpc } from './ipc';
import { installDisplayMediaHandler } from './capture-handler';
import { attachNdiWindow, stopNdi } from './ndi-receive';
import { attachNdiSendWindow, stopNdiOutput } from './ndi-send';
import { attachOutputWindow, stopOutput } from './output';
import { attachControlWindow, startControlServer, stopControlServer } from './control-server';
import { attachSecondScreen, stopSecondScreen } from './second-screen';
import { handleShowDeepLink, flushPendingShowProject } from './show-open';

declare const __dirname: string;

let mainWindow: BrowserWindow | null = null;

// Geteilter Runtime-Layer: Logging, Crash-Handler, Deep-Links, Presence. Ein
// Show-Deep-Link lädt das referenzierte .jmswitch-Projekt (C3).
const runtime = initAppRuntime({
  csp: true,
  appId: 'jm-switcher',
  appName: 'JM Switcher',
  onDeepLink: (url) => void handleShowDeepLink(url, () => mainWindow),
});

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
    minWidth: 1120,
    minHeight: 720,
    backgroundColor: '#121212',
    show: false,
    title: 'JM Switcher',
    icon: resourcePath('icon.png'),
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      // Der Programm-Ausgang (NDI/Aufnahme/RTMP) MUSS weiterlaufen, wenn das Fenster verdeckt oder
      // minimiert ist. Sonst drosselt Chromium Timer/rAF im Hintergrund und die NDI-Quelle sendet
      // keine Frames mehr (bleibt aber im Netz sichtbar → „verbunden, aber kein Bild").
      backgroundThrottling: false,
    },
  });

  win.on('ready-to-show', () => win.show());

  // Die Ausgabe-Pumpe (NDI/Aufnahme/RTMP) lebt im Renderer, dessen Konsole im Betrieb niemand
  // offen hat. Ihre `[ndi-out]`-Zeilen deshalb ins Terminal-Log spiegeln — alles andere bleibt draußen.
  win.webContents.on('console-message', (_e, _level, message) => {
    if (typeof message === 'string' && message.startsWith('[ndi-out]')) console.log(message);
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.on('closed', () => {
    stopNdi();
    stopNdiOutput();
    stopOutput();
    stopControlServer();
    stopSecondScreen();
    mainWindow = null;
  });

  loadMain(win);
  attachNdiWindow(win);
  attachNdiSendWindow(win);
  attachOutputWindow(win);
  attachControlWindow(win);
  attachSecondScreen(win);

  // Dev/Headless: Steuerserver per Env automatisch starten (zum Skripten/Testen
  // ohne den Einstellungen-Toggle). Sonst startet ihn der Renderer nach Settings.
  const envPort = Number(process.env['JMSWITCH_CONTROL_PORT']);
  if (Number.isFinite(envPort) && envPort > 0) {
    win.webContents.once('did-finish-load', () => void startControlServer(envPort));
  }

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
    installDisplayMediaHandler();
    registerIpc();
    createMainWindow();

    // Show-Deep-Link, der vor dem Fenster eintraf, jetzt nachliefern; per
    // Kaltstart (App direkt mit Deep-Link geöffnet) das Projekt laden.
    flushPendingShowProject(() => mainWindow);
    if (runtime.initialDeepLink) {
      void handleShowDeepLink(runtime.initialDeepLink, () => mainWindow);
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
