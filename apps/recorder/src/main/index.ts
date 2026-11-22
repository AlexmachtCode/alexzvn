import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path, { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { initAppRuntime, getLog } from '@jm/app-runtime';
import { parseShow, parseShowDeepLink } from '@jm/show';
import type { RecShowSettings } from '@shared/types';
import { naechsteFernsteuerung, type FernsteuerungEreignis, type FernsteuerungMeldung } from '@shared/fernsteuerung';
import { registerIpc } from './ipc';
import { shutdown } from './recorder';
import { startControlServer, stopControlServer } from './control-server';

declare const __dirname: string;

let mainWindow: BrowserWindow | null = null;

// ─────────────────────────────────────────────────────────────────────────────
// Show-Integration (C3): Wird der Recorder per Show-Deep-Link gestartet, übernimmt
// er den `settings`-Block seines Eintrags aus der .jmshow (Ordner/Dateiname/
// Spuren/Kanäle/Samplerate). Der Config lebt im Renderer-Store, daher schiebt der
// Main die geprüften Werte dorthin: läuft der Renderer schon, per Push; beim
// Kaltstart merken wir sie und der Renderer holt sie NACH der Geräte-Vorauswahl ab
// (sonst überschriebe refreshDevices channels/sampleRate wieder).
// ─────────────────────────────────────────────────────────────────────────────
let pendingShowSettings: RecShowSettings | null = null;

function applyShowFromDeepLink(url: string): void {
  const showPath = parseShowDeepLink(url);
  if (!showPath) return;
  try {
    const show = parseShow(readFileSync(showPath, 'utf8'));
    const s = show.tools.find((t) => t.appId === 'jm-recorder')?.settings;
    if (!s) return;
    const out: RecShowSettings = {};
    if (typeof s.dir === 'string') out.dir = s.dir;
    if (typeof s.fileName === 'string') out.fileName = s.fileName;
    if (typeof s.separateTracks === 'boolean') out.separateTracks = s.separateTracks;
    if (typeof s.channels === 'number' && Number.isFinite(s.channels)) out.channels = s.channels;
    if (typeof s.sampleRate === 'number' && Number.isFinite(s.sampleRate)) out.sampleRate = s.sampleRate;
    if (!Object.keys(out).length) return;
    // Läuft der Renderer schon (Deep-Link zur Laufzeit)? Direkt pushen; sonst für
    // den Kaltstart-Pull (rec:takeShowSettings) merken.
    if (mainWindow && !mainWindow.webContents.isLoading()) {
      mainWindow.webContents.send('recorder:show-settings', out);
    } else {
      pendingShowSettings = out;
    }
  } catch (err) {
    getLog().error(`Show-Einstellungen konnten nicht geladen werden: ${(err as Error).message}`);
  }
}

/**
 * UX Welle 2a (Spec 3.9): die zuletzt gemeldete Lage des Steuerservers, nur lesend. null, solange nichts gemeldet wurde
 * (der Renderer zeigt dann „unbekannt“). Jede Meldung geht an alle offenen Fenster.
 */
let fernsteuerung: FernsteuerungMeldung | null = null;
function meldeFernsteuerung(e: FernsteuerungEreignis): void {
  fernsteuerung = naechsteFernsteuerung(fernsteuerung ?? undefined, e);
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send('recorder:fernsteuerung', fernsteuerung);
  }
}

// Geteilter Runtime-Layer: Logging, Crash-Handler, Deep-Links, Presence. Per Show
// gestartet? settings-Block übernehmen (C3).
const runtime = initAppRuntime({
  csp: true,
  appId: 'jm-recorder',
  appName: 'JM Audio Recorder',
  onDeepLink: (url) => applyShowFromDeepLink(url),
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
    width: 1180,
    height: 820,
    minWidth: 920,
    minHeight: 620,
    backgroundColor: '#121212',
    show: false,
    title: 'JM Audio Recorder',
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
    shutdown(); // geplante Aufnahme-Timer lösen + Eingang schließen
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
    // nach der Geräte-Vorauswahl auf und leert damit den Puffer.
    ipcMain.handle('rec:takeShowSettings', () => {
      const s = pendingShowSettings;
      pendingShowSettings = null;
      return s;
    });
    ipcMain.handle('recorder:fernsteuerung', () => fernsteuerung);
    registerIpc(() => mainWindow);
    createMainWindow();
    // TCP-Steuerserver (suite-weites Protokoll) für Companion u. a. — Befehle
    // gehen per IPC an den Renderer, STATE wird direkt aus dem Main gepusht.
    startControlServer(() => mainWindow, meldeFernsteuerung)
      .then((r) => meldeFernsteuerung({ art: 'start', ok: r.ok, error: r.error }))
      .catch((err) => meldeFernsteuerung({ art: 'wurf', text: err instanceof Error ? err.message : String(err) }));
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
