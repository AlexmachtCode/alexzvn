import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import path, { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { initAppRuntime, getLog } from '@jm/app-runtime';
import { advertise, type Advertiser } from '@jm/discovery';
import { parseShow, parseShowDeepLink } from '@jm/show';
import { OutputWindow, listDisplays } from '@jm/output-window';
import { RemoteServer } from '@jm/remote';
import { readControlConfig } from '@jm/control-config';
import { INITIAL_TRANSPORT, positionEm } from '@shared/types';
import type { PartialPrompterConfig, PrompterState, PrompterTransport, RemoteInfo } from '@shared/types';
import type { SuiteCommand, SuiteState } from '@jm/suite-control-protocol';
import { getConfig, patchConfig } from './config';
import { readScriptFile } from './docx';
import { REMOTE_PAGE } from './remote-page';
import {
  startControlServer,
  stopControlServer,
  pushState as pushControlState,
} from './control-server';

declare const __dirname: string;

const REMOTE_PORT = 7781;

let mainWindow: BrowserWindow | null = null;
const preloadPath = join(__dirname, '../preload/index.cjs');
const output = new OutputWindow('prompter:state');

// P1 (#59): geteiltes Suite-Token aus der control.json (vom Launcher provisioniert).
// Gesetzt → die Fernbedienungs-Endpunkte (/events,/cmd) verlangen es; der QR-Link
// trägt ?t=<token>, die Seite reicht es bei jedem Aufruf mit. Fehlt es (open-Modus)
// → unverändertes Verhalten ohne Token. readControlConfig ist fehlertolerant ({}).
const suiteToken = readControlConfig(app.getPath('appData')).token;

/** Token an die LAN-URLs hängen, damit der QR die Fernbedienung berechtigt. */
function withRemoteToken(urls: string[]): string[] {
  const t = suiteToken;
  if (!t) return urls;
  return urls.map((u) => `${u}/?t=${encodeURIComponent(t)}`);
}

// mDNS-Annoncierung ist an die Fernbedienung gekoppelt: nur wenn die läuft, ist
// der Prompter im LAN sichtbar (für Discovery durch andere Tools). Best-effort.
let advertiser: Advertiser | null = null;

// Transport gehört dem Main-Prozess; die Renderer interpolieren nur.
let transport: PrompterTransport = {
  ...INITIAL_TRANSPORT,
  emPerSec: getEmPerSec(),
};

// Handy-Fernbedienung (HTTP/SSE).
const remote = new RemoteServer({
  port: REMOTE_PORT,
  page: REMOTE_PAGE,
  token: suiteToken,
  getState: () => ({ playing: transport.playing, speed: getConfig().speed }),
  onCommand: (cmd) => handleRemoteCommand(cmd),
});

function getEmPerSec(): number {
  const c = getConfig();
  return c.speed * c.lineHeight;
}

function remoteInfo(): RemoteInfo {
  const addr = remote.address();
  return { running: remote.isRunning(), urls: withRemoteToken(addr?.urls ?? []) };
}

function buildState(): PrompterState {
  return { config: getConfig(), transport, remote: remoteInfo() };
}

function broadcast(): void {
  const state = buildState();
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('prompter:state', state);
  output.send(state);
  remote.broadcast({ playing: transport.playing, speed: getConfig().speed });
  pushControlState(buildSuiteState());
}

/** Prompter-Zustand → STATE ns=prompter (für Companion). */
function buildSuiteState(): SuiteState {
  return { ns: 'prompter', kv: { scrolling: transport.playing, speed: getConfig().speed } };
}

/** SuiteCommand (ns=prompter) auf die Transport-Funktionen abbilden. */
function handleSuiteCommand(cmd: SuiteCommand): void {
  switch (cmd.verb) {
    case 'scroll': {
      const m = (cmd.args[0] ?? 'toggle').toLowerCase();
      if (m === 'on' || m === '1' || m === 'start') play();
      else if (m === 'off' || m === '0' || m === 'stop') pause();
      else transport.playing ? pause() : play();
      break;
    }
    case 'speed': {
      const v = Number(cmd.args[0]);
      if (Number.isFinite(v)) {
        patchConfig({ speed: Math.max(0.2, Math.min(6, Math.round(v * 10) / 10)) });
        reanchor();
        broadcast();
      }
      break;
    }
    case 'faster':
      handleRemoteCommand({ type: 'speed', value: 0.2 });
      break;
    case 'slower':
      handleRemoteCommand({ type: 'speed', value: -0.2 });
      break;
    case 'top':
      reset();
      break;
  }
}

function handleRemoteCommand(cmd: unknown): void {
  const c = cmd as { type?: string; value?: number } | null;
  if (!c || typeof c.type !== 'string') return;
  switch (c.type) {
    case 'toggle':
      transport.playing ? pause() : play();
      break;
    case 'play':
      play();
      break;
    case 'pause':
      pause();
      break;
    case 'nudge':
      nudge(Number(c.value) || 0);
      break;
    case 'reset':
      reset();
      break;
    case 'speed': {
      const next = Math.max(0.2, Math.min(6, getConfig().speed + (Number(c.value) || 0)));
      patchConfig({ speed: Math.round(next * 10) / 10 });
      reanchor();
      broadcast();
      break;
    }
  }
}

async function setRemote(enabled: boolean): Promise<void> {
  patchConfig({ remoteEnabled: enabled });
  try {
    if (enabled) await remote.start();
    else await remote.stop();
  } catch (err) {
    console.error('[prompter] Fernbedienung:', err);
  }
  // mDNS an den Remote-Status koppeln (Annoncierung nur bei laufendem Server).
  setAdvertised(enabled);
  broadcast();
}

/** mDNS-Annoncierung an/aus schalten (idempotent). Best-effort — Fehler egal. */
function setAdvertised(on: boolean): void {
  if (on && !advertiser) {
    try {
      advertiser = advertise({ appId: 'jm-prompter', role: 'prompter', port: REMOTE_PORT });
    } catch {
      /* mDNS optional */
    }
  } else if (!on && advertiser) {
    advertiser.stop();
    advertiser = null;
  }
}

/** Anker auf die aktuelle Position neu setzen (z. B. nach Tempo-/Zeilenabstand-Änderung). */
function reanchor(now: number = Date.now()): void {
  transport = {
    ...transport,
    anchorEm: positionEm(transport, now),
    anchorAtMs: now,
    emPerSec: getEmPerSec(),
  };
}

function play(): void {
  if (transport.playing) return;
  transport = {
    ...transport,
    playing: true,
    anchorEm: positionEm(transport),
    anchorAtMs: Date.now(),
    emPerSec: getEmPerSec(),
  };
  broadcast();
}

function pause(): void {
  if (!transport.playing) return;
  transport = {
    ...transport,
    playing: false,
    anchorEm: positionEm(transport),
    anchorAtMs: Date.now(),
  };
  broadcast();
}

function seek(em: number): void {
  transport = {
    ...transport,
    anchorEm: Math.max(0, em),
    anchorAtMs: Date.now(),
    emPerSec: getEmPerSec(),
  };
  broadcast();
}

function nudge(deltaEm: number): void {
  seek(positionEm(transport) + deltaEm);
}

function reset(): void {
  transport = {
    ...transport,
    playing: false,
    anchorEm: 0,
    anchorAtMs: Date.now(),
    emPerSec: getEmPerSec(),
  };
  broadcast();
}

function resourcePath(filename: string): string {
  if (app.isPackaged) return path.join(process.resourcesPath, filename);
  return path.join(__dirname, '..', '..', 'resources', filename);
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
    width: 1180,
    height: 800,
    minWidth: 940,
    minHeight: 620,
    backgroundColor: '#121212',
    show: false,
    title: 'JM Prompter',
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
  const url = rendererUrl();
  if (url) win.loadURL(url);
  else win.loadFile(rendererFile());
  mainWindow = win;
  return win;
}

function openOutput(displayId?: number): void {
  if (displayId != null) patchConfig({ outputDisplayId: displayId });
  output.open({
    preloadPath,
    sandbox: true, // P2 (#60): Ausgabefenster ebenfalls sandboxen (gleiches CJS-Preload).
    rendererUrl: rendererUrl(),
    rendererFile: rendererFile(),
    hash: 'output',
    title: 'JM Prompter — Ausgabe',
    displayId: displayId ?? getConfig().outputDisplayId ?? undefined,
  });
  // Frischen State sofort schicken, sobald das Fenster geladen hat.
  setTimeout(broadcast, 400);
}

/**
 * Show-Integration (B4): Wird der Prompter über einen Show-Deep-Link gestartet
 * (jmps://open?show=<pfad>), lädt er das in der Show referenzierte Skript-
 * Dokument (.docx/.txt/.md) und springt an den Anfang — nutzt denselben Pfad
 * wie „Skript laden".
 */
function applyShowFromDeepLink(url: string): void {
  const showPath = parseShowDeepLink(url);
  if (!showPath) return;
  try {
    const show = parseShow(readFileSync(showPath, 'utf8'));
    const ref = show.tools.find((t) => t.appId === 'jm-prompter');
    if (!ref?.document) return;
    const docPath = path.isAbsolute(ref.document)
      ? ref.document
      : path.join(path.dirname(showPath), ref.document);
    const text = readScriptFile(docPath);
    patchConfig({ script: text });
    reset(); // an den Skript-Anfang springen (broadcastet den neuen Stand)
  } catch (err) {
    getLog().error(`Show-Skript konnte nicht geladen werden: ${(err as Error).message}`);
  }
}

function registerIpc(): void {
  ipcMain.handle('prompter:getState', () => buildState());
  ipcMain.handle('prompter:setConfig', (_e, patch: PartialPrompterConfig) => {
    patchConfig(patch);
    // Tempo/Zeilenabstand wirken sofort: Anker neu setzen, damit kein Sprung.
    if (patch.speed !== undefined || patch.lineHeight !== undefined) reanchor();
    broadcast();
    return buildState();
  });

  // Skript aus Datei laden: .docx (entpackt) oder .txt/.md (Issue #28).
  ipcMain.handle('prompter:importScript', async () => {
    if (!mainWindow) return buildState();
    const r = await dialog.showOpenDialog(mainWindow, {
      title: 'Skript laden',
      properties: ['openFile'],
      filters: [
        { name: 'Skript / Word', extensions: ['docx', 'txt', 'md', 'markdown'] },
        { name: 'Alle Dateien', extensions: ['*'] },
      ],
    });
    if (r.canceled || r.filePaths.length === 0) return buildState();
    const text = readScriptFile(r.filePaths[0]); // wirft bei Lese-/Parse-Fehler
    patchConfig({ script: text });
    broadcast();
    return buildState();
  });

  ipcMain.handle('prompter:play', () => (play(), buildState()));
  ipcMain.handle('prompter:pause', () => (pause(), buildState()));
  ipcMain.handle('prompter:toggle', () => (transport.playing ? pause() : play(), buildState()));
  ipcMain.handle('prompter:seek', (_e, em: number) => (seek(em), buildState()));
  ipcMain.handle('prompter:nudge', (_e, deltaEm: number) => (nudge(deltaEm), buildState()));
  ipcMain.handle('prompter:reset', () => (reset(), buildState()));

  ipcMain.handle('prompter:setRemote', async (_e, enabled: boolean) => {
    await setRemote(enabled);
    return buildState();
  });

  ipcMain.handle('output:displays', () => listDisplays());
  ipcMain.handle('output:open', (_e, displayId?: number) => openOutput(displayId));
  ipcMain.handle('output:close', () => output.close());
  ipcMain.handle('output:isOpen', () => output.isOpen());
}

// Geteilter Runtime-Layer: Logging, Crash-Handler, Deep-Links, Presence.
// onDeepLink fängt Show-Links bei laufender App ab; den Start-Link verarbeiten
// wir unten über runtime.initialDeepLink.
const runtime = initAppRuntime({
  appId: 'jm-prompter',
  appName: 'JM Prompter',
  servicePort: REMOTE_PORT,
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
    registerIpc();
    createMainWindow();
    // Fernbedienung automatisch starten, wenn zuletzt aktiv.
    if (getConfig().remoteEnabled) void setRemote(true);
    // TCP-Steuerserver (suite-weites Protokoll) für Companion u. a. — immer an.
    void startControlServer({ getState: buildSuiteState, onCommand: handleSuiteCommand });
    // Per Show gestartet? Referenziertes Skript laden.
    if (runtime.initialDeepLink) applyShowFromDeepLink(runtime.initialDeepLink);
  });

  app.on('before-quit', () => {
    setAdvertised(false);
    stopControlServer();
    void remote.stop();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
