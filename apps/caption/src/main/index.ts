import { app, BrowserWindow, ipcMain, session, shell } from 'electron';
import path, { join } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import { initAppRuntime, getLog } from '@jm/app-runtime';
import { parseShow, parseShowDeepLink } from '@jm/show';
import { whisperAvailable } from './locate';
import { enqueueUtterance, initTranscriber, stopTranscriber } from './transcriber';
import { startSender, stopSender, senderActive } from './ndi/sender-process';
import {
  startControlServer,
  stopControlServer,
  pushControlState,
  resolveMode,
} from './control-server';
import type { SuiteCommand, SuiteState } from '@jm/suite-control-protocol';
import type { CaptionConfig, CaptionLine, CaptionState, CaptionStatus } from '@shared/types';

declare const __dirname: string;

const MAX_LINES = 40;
const preloadPath = join(__dirname, '../preload/index.mjs');
let mainWindow: BrowserWindow | null = null;

const defaultConfig: CaptionConfig = {
  model: 'base',
  language: 'de',
  maxUtteranceSec: 8,
  silenceMs: 700,
  silenceThreshold: 0.012,
  audioInputDeviceId: '',
  ndiName: 'JM Caption',
  ndiWidth: 1920,
  ndiHeight: 1080,
  ndiFps: 30,
  ndiFontSize: 54,
  ndiLines: 2,
  ndiBand: true,
};

let config: CaptionConfig = { ...defaultConfig };
let running = false;
let hold = false;
let busy = false;
let error: string | null = null;
let lines: CaptionLine[] = [];
let lineSeq = 0;
const status: CaptionStatus = { ndiActive: false, connections: 0 };

function configPath(): string {
  return join(app.getPath('userData'), 'caption.config.json');
}
function loadConfig(): void {
  try {
    const raw = JSON.parse(readFileSync(configPath(), 'utf8')) as Partial<CaptionConfig>;
    config = { ...defaultConfig, ...raw };
  } catch {
    config = { ...defaultConfig };
  }
}
function saveConfig(): void {
  try {
    writeFileSync(configPath(), JSON.stringify(config, null, 2));
  } catch {
    /* best-effort */
  }
}

function resourcePath(filename: string): string {
  if (app.isPackaged) return path.join(process.resourcesPath, filename);
  return path.join(__dirname, '..', '..', 'resources', filename);
}

function buildState(): CaptionState {
  return { running, hold, busy, whisperAvailable: whisperAvailable(), lines, config, status, error };
}
function broadcast(): void {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('caption:state', buildState());
  pushControlState(buildSuiteState());
}

/** Zustand fürs Suite-Steuerprotokoll (Companion liest running/hold/ndi/…). */
function buildSuiteState(): SuiteState {
  return {
    ns: 'caption',
    kv: {
      running,
      hold,
      ndi: status.ndiActive,
      connections: status.connections,
      lines: lines.length,
    },
  };
}

/** CAPTION-Befehl (von Companion) → Zustandsänderung. */
function handleSuiteCommand(cmd: SuiteCommand): void {
  const arg = cmd.args[0];
  switch (cmd.verb) {
    case 'transcribe':
      setRunning(resolveMode(arg, running));
      break;
    case 'hold':
      setHoldState(resolveMode(arg, hold));
      break;
    case 'ndi':
      if (resolveMode(arg, status.ndiActive)) startNdi(config.ndiName);
      else stopNdi();
      break;
    case 'clear':
      doClear();
      break;
  }
}

// ── Geteilte Zustandsänderungen (IPC + Steuerserver nutzen dieselben) ──────────
function setRunning(v: boolean): void {
  if (running === v) return;
  running = v;
  if (v) error = null;
  else stopTranscriber();
  broadcast();
}
function setHoldState(v: boolean): void {
  if (hold === v) return;
  hold = v;
  broadcast();
}
function doClear(): void {
  lines = [];
  broadcast();
}

function startNdi(name: string): void {
  if (!mainWindow) return;
  startSender(mainWindow, name || config.ndiName, (connections) => {
    status.connections = connections;
    broadcast();
  });
  status.ndiActive = true;
  status.connections = 0;
  broadcast();
}

function stopNdi(): void {
  stopSender();
  status.ndiActive = false;
  status.connections = 0;
  broadcast();
}

initTranscriber({
  config: () => config,
  onText: (text) => {
    lines = [...lines, { id: `l${Date.now()}_${lineSeq++}`, text, at: Date.now() }].slice(-MAX_LINES);
    broadcast();
  },
  onBusy: (b) => {
    busy = b;
    broadcast();
  },
  onError: (msg) => {
    if (msg !== error) {
      error = msg;
      if (msg) getLog().warn(`Caption: ${msg}`);
      broadcast();
    }
  },
});

function registerIpc(): void {
  ipcMain.handle('caption:getState', () => buildState());
  ipcMain.handle('caption:setConfig', (_e, patch: Partial<CaptionConfig>) => {
    config = { ...config, ...patch };
    saveConfig();
    broadcast();
    return buildState();
  });
  ipcMain.handle('caption:start', () => {
    setRunning(true);
    return buildState();
  });
  ipcMain.handle('caption:stop', () => {
    setRunning(false);
    return buildState();
  });
  ipcMain.handle('caption:setHold', (_e, h: boolean) => {
    setHoldState(h);
    return buildState();
  });
  ipcMain.handle('caption:clear', () => {
    doClear();
    return buildState();
  });
  ipcMain.handle('caption:correctLast', (_e, text: string) => {
    if (lines.length) {
      const last = lines[lines.length - 1];
      lines = [...lines.slice(0, -1), { ...last, text }];
      broadcast();
    }
    return buildState();
  });
  // Fire-and-forget: erkannte Äußerung vom Renderer → Transkriptions-Queue.
  ipcMain.on('caption:utterance', (_e, pcm: Float32Array, sampleRate: number) => {
    if (running) enqueueUtterance(pcm instanceof Float32Array ? pcm : new Float32Array(pcm), sampleRate);
  });
  // Transparente NDI-Untertitel-Quelle (Frames zeichnet der Renderer).
  ipcMain.handle('caption:ndi-start', (_e, name: string) => {
    startNdi(name || config.ndiName);
    return status;
  });
  ipcMain.handle('caption:ndi-stop', () => {
    stopNdi();
    return status;
  });
  ipcMain.handle('caption:ndi-status', () => {
    status.ndiActive = senderActive();
    return status;
  });
}

function rendererUrl(): string | undefined {
  return process.env['ELECTRON_RENDERER_URL'];
}
function rendererFile(): string {
  return join(__dirname, '../renderer/index.html');
}

function createMainWindow(): BrowserWindow {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    return mainWindow;
  }
  const win = new BrowserWindow({
    width: 1100,
    height: 780,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#121212',
    show: false,
    title: 'JM Caption',
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
  const url = rendererUrl();
  if (url) win.loadURL(url);
  else win.loadFile(rendererFile());
  mainWindow = win;
  return win;
}

/**
 * Show-Integration: Wird Caption über einen Show-Deep-Link gestartet, übernimmt es
 * aus der Show (ShowToolRef.settings von jm-caption) Modell, Sprache und NDI-Name —
 * so startet die Untertitelung mit den Produktions-Vorgaben.
 */
function applyShowFromDeepLink(url: string): void {
  const showPath = parseShowDeepLink(url);
  if (!showPath) return;
  try {
    const show = parseShow(readFileSync(showPath, 'utf8'));
    const s = show.tools.find((t) => t.appId === 'jm-caption')?.settings;
    if (!s) return;
    const patch: Partial<CaptionConfig> = {};
    const MODELS = ['tiny', 'base', 'small', 'medium', 'large-v3'];
    if (typeof s.model === 'string' && MODELS.includes(s.model)) patch.model = s.model as CaptionConfig['model'];
    if (typeof s.language === 'string') patch.language = s.language;
    if (typeof s.ndiName === 'string' && s.ndiName.trim()) patch.ndiName = s.ndiName.trim();
    if (Object.keys(patch).length) {
      config = { ...config, ...patch };
      saveConfig();
      broadcast();
    }
  } catch (err) {
    getLog().error(`Show-Deep-Link konnte nicht geladen werden: ${(err as Error).message}`);
  }
}

const runtime = initAppRuntime({
  appId: 'jm-caption',
  appName: 'JM Caption',
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

  app.whenReady().then(() => {
    loadConfig();
    // Mikrofon-Zugriff für getUserMedia im Renderer erlauben.
    session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => cb(permission === 'media'));
    session.defaultSession.setPermissionCheckHandler((_wc, permission) => permission === 'media');
    registerIpc();
    createMainWindow();
    if (runtime.initialDeepLink) applyShowFromDeepLink(runtime.initialDeepLink);
    // Eigener Steuerserver: Caption per Companion fernsteuerbar (Port 8732).
    void startControlServer({ getState: buildSuiteState, onCommand: handleSuiteCommand });
  });

  app.on('before-quit', () => {
    stopTranscriber();
    stopSender();
    stopControlServer();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
