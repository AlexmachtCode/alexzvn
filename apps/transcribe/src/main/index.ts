import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import path, { join } from 'node:path';
import { initAppRuntime } from '@jm/app-runtime';
import type { PartialTranscribeConfig, TranscribeState, WhisperModelId } from '@shared/types';
import { getConfig, patchConfig } from './config';
import { whisperAvailable } from './locate';
import { modelStates, downloadModel, deleteModel } from './models';
import {
  addJobs,
  cancel,
  clearFinished,
  getJobs,
  removeJob,
  setOnChange,
  startQueue,
} from './engine';

declare const __dirname: string;

let mainWindow: BrowserWindow | null = null;
const preloadPath = join(__dirname, '../preload/index.cjs');

const AUDIO_VIDEO = ['mp4', 'mov', 'mkv', 'avi', 'm4v', 'webm', 'mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg', 'wma'];

function buildState(): TranscribeState {
  return {
    config: getConfig(),
    jobs: getJobs(),
    models: modelStates(),
    engineReady: whisperAvailable(),
  };
}

function broadcast(): void {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('transcribe:state', buildState());
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
    width: 1080,
    height: 780,
    minWidth: 900,
    minHeight: 620,
    backgroundColor: '#121212',
    show: false,
    title: 'JM Transcribe',
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
  const url = process.env['ELECTRON_RENDERER_URL'];
  if (url) win.loadURL(url);
  else win.loadFile(join(__dirname, '../renderer/index.html'));
  mainWindow = win;
  return win;
}

function registerIpc(): void {
  ipcMain.handle('transcribe:getState', () => buildState());
  ipcMain.handle('transcribe:setConfig', (_e, patch: PartialTranscribeConfig) => {
    patchConfig(patch);
    broadcast();
    return buildState();
  });

  ipcMain.handle('transcribe:addFiles', async () => {
    if (!mainWindow) return 0;
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'Audio-/Videodateien wählen',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Audio/Video', extensions: AUDIO_VIDEO },
        { name: 'Alle Dateien', extensions: ['*'] },
      ],
    });
    if (res.canceled) return 0;
    return addJobs(res.filePaths);
  });

  ipcMain.handle('transcribe:addPaths', (_e, paths: string[]) =>
    addJobs((paths ?? []).filter((p) => typeof p === 'string' && p.length > 0)),
  );

  ipcMain.handle('transcribe:removeJob', (_e, id: string) => removeJob(id));
  ipcMain.handle('transcribe:clearFinished', () => clearFinished());
  ipcMain.handle('transcribe:start', () => startQueue(getConfig));
  ipcMain.handle('transcribe:cancel', (_e, id: string) => cancel(id));

  ipcMain.handle('transcribe:chooseOutputDir', async () => {
    if (!mainWindow) return null;
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'Zielordner wählen',
      properties: ['openDirectory', 'createDirectory'],
    });
    const dir = res.canceled || !res.filePaths[0] ? null : res.filePaths[0];
    patchConfig({ outputDir: dir });
    broadcast();
    return dir;
  });

  ipcMain.handle('transcribe:revealOutput', (_e, p: string) => {
    shell.showItemInFolder(p);
  });

  ipcMain.handle('transcribe:downloadModel', async (_e, id: WhisperModelId) => {
    try {
      await downloadModel(id, broadcast);
    } catch (err) {
      console.error('[transcribe] Modell-Download fehlgeschlagen:', err);
    }
    broadcast();
  });
  ipcMain.handle('transcribe:deleteModel', (_e, id: WhisperModelId) => {
    deleteModel(id);
    broadcast();
  });
}

// Geteilter Runtime-Layer: Logging, Crash-Handler, Deep-Links, Presence.
initAppRuntime({ appId: 'jm-transcribe', appName: 'JM Transcribe' });

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
    setOnChange(broadcast);
    registerIpc();
    createMainWindow();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
