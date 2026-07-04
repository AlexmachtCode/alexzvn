import { app, BrowserWindow, ipcMain, protocol, shell } from 'electron';
import path, { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { initAppRuntime, getLog } from '@jm/app-runtime';
import { parseShow, parseShowDeepLink } from '@jm/show';
import { MEDIA_SCHEME } from '@shared/media-url';
import type { PlayerShowSettings } from '@shared/types';
import { registerIpc } from './ipc';
import { registerMediaProtocol } from './media-protocol';
import { startControlServer, stopControlServer } from './control-server';

declare const __dirname: string;

let mainWindow: BrowserWindow | null = null;

// ─────────────────────────────────────────────────────────────────────────────
// Show-Integration (C3): Wird der Player per Show-Deep-Link gestartet, übernimmt
// er den `settings`-Block seines Eintrags aus der .jmshow (Cue-Show + Ausgabe-
// Monitor). Der Zustand lebt im Renderer-Store, daher schiebt der Main die
// geprüften Werte dorthin: läuft der Renderer schon, per Push; beim Kaltstart
// gemerkt, der Renderer holt sie NACH dem Laden der Shows ab (damit `show` per
// Name aufgelöst werden kann).
// ─────────────────────────────────────────────────────────────────────────────
let pendingShowSettings: PlayerShowSettings | null = null;

function applyShowFromDeepLink(url: string): void {
  const showPath = parseShowDeepLink(url);
  if (!showPath) return;
  try {
    const show = parseShow(readFileSync(showPath, 'utf8'));
    const s = show.tools.find((t) => t.appId === 'jm-player')?.settings;
    if (!s) return;
    const out: PlayerShowSettings = {};
    if (typeof s.show === 'string' && s.show.trim()) out.show = s.show;
    if (typeof s.outputDisplayId === 'number' && Number.isFinite(s.outputDisplayId)) {
      out.outputDisplayId = s.outputDisplayId;
    }
    if (!Object.keys(out).length) return;
    if (mainWindow && !mainWindow.webContents.isLoading()) {
      mainWindow.webContents.send('player:show-settings', out);
    } else {
      pendingShowSettings = out;
    }
  } catch (err) {
    getLog().error(`Show-Einstellungen konnten nicht geladen werden: ${(err as Error).message}`);
  }
}

// Geteilter Runtime-Layer: Logging, Crash-Handler, Deep-Links, Presence. Per Show
// gestartet? settings-Block übernehmen (C3).
const runtime = initAppRuntime({
  appId: 'jm-player',
  appName: 'JM Player',
  // P2 (#60): CSP. Medien laufen über das privilegierte jm-media://-Schema
  // (bypassCSP) — wir whitelisten es zusätzlich explizit, damit auch der
  // fetch(mediaUrl())-Pfad (connect-src) unabhängig vom bypassCSP-Verhalten trägt.
  csp: { connectSrc: ['jm-media:'], imgSrc: ['jm-media:'], mediaSrc: ['jm-media:'] },
  onDeepLink: (url) => applyShowFromDeepLink(url),
});

const preloadPath = join(__dirname, '../preload/index.cjs');

// Schema vor app.whenReady() freischalten (Pflicht für protocol.handle).
protocol.registerSchemesAsPrivileged([
  {
    scheme: MEDIA_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true,
      bypassCSP: true,
    },
  },
]);

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
    width: 1320,
    height: 880,
    minWidth: 1040,
    minHeight: 660,
    backgroundColor: '#121212',
    show: false,
    title: 'JM Player',
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
    // Kaltstart-Abholung der Show-Voreinstellungen (C3) — der Renderer ruft das
    // nach dem Laden der Shows auf und leert damit den Puffer.
    ipcMain.handle('player:takeShowSettings', () => {
      const s = pendingShowSettings;
      pendingShowSettings = null;
      return s;
    });
    registerMediaProtocol();
    registerIpc(() => mainWindow);
    createMainWindow();
    // TCP-Steuerserver (suite-weites Protokoll) für Companion u. a. — Befehle
    // gehen per IPC an den Renderer, der seinen Zustand zurückmeldet.
    void startControlServer(() => mainWindow);
    // Per Show gestartet (Kaltstart)? settings-Block jetzt verarbeiten.
    if (runtime.initialDeepLink) applyShowFromDeepLink(runtime.initialDeepLink);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });

  app.on('before-quit', () => stopControlServer());

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
