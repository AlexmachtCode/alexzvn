import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import path, { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { initAppRuntime, getLog } from '@jm/app-runtime';
import { parseShow, parseShowDeepLink } from '@jm/show';
import type { PartialTitlerConfig, TitlerRemoteState, TitlerState, TitlerStatus } from '@shared/types';
import { getConfig, patchConfig } from './config';
import { startSender, stopSender, senderActive } from './ndi/sender-process';
import { startControlServer, stopControlServer, updateTitlerState, updateTitlerData, CONTROL_PORT } from './control-server';
import { startDataWatch, stopDataWatch, recall, step, type DataState } from './datalink';
import { writeSpeakersTsv } from './iveo-show';

declare const __dirname: string;

let mainWindow: BrowserWindow | null = null;
const preloadPath = join(__dirname, '../preload/index.cjs');
/** Pfad der aktuell geladenen Show (für Live-Reload nach iveo-Update). */
let currentShowPath: string | null = null;

const status: TitlerStatus = {
  ndiActive: false,
  connections: 0,
  suiteClients: 0,
  variables: {},
  dataSources: [],
  entries: [],
  activeEntry: -1,
};

function buildState(): TitlerState {
  return { config: getConfig(), status };
}

function broadcastStatus(): void {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('titler:status', status);
}

/** DataLink-Watchfolder (neu) starten/aktualisieren — Einträge/Variablen spiegeln. */
function refreshDataWatch(): void {
  const folder = getConfig().dataFolder;
  if (!folder) {
    stopDataWatch();
    status.variables = {};
    status.dataSources = [];
    status.dataError = undefined;
    status.entries = [];
    status.activeEntry = -1;
    broadcastStatus();
    updateTitlerData({ entry: '', entryIndex: 0, entryCount: 0 });
    return;
  }
  startDataWatch(folder, (d: DataState) => {
    status.variables = d.variables;
    status.dataSources = d.sources;
    status.dataError = d.error;
    status.entries = d.entries.map((e) => e.label);
    status.activeEntry = d.activeIndex;
    broadcastStatus();
    updateTitlerData({
      entry: d.activeIndex >= 0 ? d.entries[d.activeIndex].label : '',
      entryIndex: d.activeIndex >= 0 ? d.activeIndex + 1 : 0,
      entryCount: d.entries.length,
    });
  });
}

/**
 * Show-Integration (#11, Phase 3): Wird der Titler per Show-Deep-Link gestartet und
 * trägt die Show eine iveo-Speaker-Liste, materialisieren wir sie als `speakers.tsv`
 * im verwalteten DataLink-Ordner und richten den Watchfolder darauf aus. Das
 * bestehende DataLink/Recall-System füllt daraus die Bauchbinden. Kein Token nötig
 * (die Daten stehen bereits sanitisiert in der Show).
 */
function applyShowFromDeepLink(url: string): void {
  const showPath = parseShowDeepLink(url);
  if (!showPath) return;
  applyShowFromPath(showPath);
}

function applyShowFromPath(showPath: string): void {
  try {
    const show = parseShow(readFileSync(showPath, 'utf8'));
    currentShowPath = showPath;
    const speakers = show.iveo?.speakers ?? [];
    if (!speakers.length) return; // Show ohne iveo-Speaker → DataLink unverändert lassen
    const dir = writeSpeakersTsv(speakers);
    if (getConfig().dataFolder !== dir) patchConfig({ dataFolder: dir });
    refreshDataWatch();
    getLog().info(`iveo: ${speakers.length} Speaker aus Show in den DataLink übernommen.`);
  } catch (err) {
    getLog().error(`Show konnte nicht geladen werden: ${(err as Error).message}`);
  }
}

/** Aktuelle Show neu einlesen (Launcher schickt `TITLER RELOAD` nach iveo-Update). */
function reloadCurrentShow(): boolean {
  if (!currentShowPath) return false;
  applyShowFromPath(currentShowPath);
  return true;
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
    const before = getConfig().dataFolder;
    patchConfig(patch);
    if (patch.dataFolder !== undefined && patch.dataFolder !== before) refreshDataWatch();
    return buildState();
  });
  ipcMain.handle('titler:pickDataFolder', async () => {
    const r = await dialog.showOpenDialog({
      title: 'DataLink-Ordner wählen',
      properties: ['openDirectory'],
      defaultPath: getConfig().dataFolder || undefined,
    });
    return r.canceled || !r.filePaths[0] ? '' : r.filePaths[0];
  });
  ipcMain.handle('titler:recall', (_e, ref: string) => recall(ref));
  ipcMain.handle('titler:stepEntry', (_e, delta: number) => step(delta));
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
const runtime = initAppRuntime({
  csp: true,
  appId: 'jm-titler',
  appName: 'JM Titler',
  // Per Show gestartet? iveo-Speaker in den DataLink übernehmen (#11).
  onDeepLink: (url) => applyShowFromDeepLink(url),
});

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
    // DataLink-Watchfolder (#86) starten, falls konfiguriert.
    refreshDataWatch();
    // Per Show gestartet? iveo-Speaker aus der Show in den DataLink übernehmen (#11).
    if (runtime.initialDeepLink) applyShowFromDeepLink(runtime.initialDeepLink);
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
        // DataLink-Recall im Main behandeln (ändert den aktiven Eintrag, kein
        // Renderer-Push) → true = erledigt.
        (rc) => {
          if (rc.t === 'recall') {
            recall(rc.ref);
            return true;
          }
          if (rc.t === 'next') {
            step(1);
            return true;
          }
          if (rc.t === 'prev') {
            step(-1);
            return true;
          }
          if (rc.t === 'reload') {
            reloadCurrentShow();
            return true;
          }
          return false;
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
    stopDataWatch();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
