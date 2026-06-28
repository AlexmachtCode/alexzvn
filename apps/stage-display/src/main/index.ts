import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path, { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { initAppRuntime, getLog } from '@jm/app-runtime';
import { parseShow, parseShowDeepLink, type ShowNetworkBinding } from '@jm/show';
import { discover, type Discovery, type DiscoveredService } from '@jm/discovery';
import { OutputWindow, listDisplays } from '@jm/output-window';
import type { PartialStageConfig, StageState } from '@shared/types';
import { getConfig, patchConfig } from './config';
import { TimerClient, TIMER_OFFLINE } from './timer-client';
import { SwitcherClient, SWITCHER_OFFLINE } from './switcher-client';
import { PresenterClient, PRESENTER_OFFLINE } from './presenter-client';

declare const __dirname: string;

let mainWindow: BrowserWindow | null = null;
const preloadPath = join(__dirname, '../preload/index.cjs');
const output = new OutputWindow('stage:state');

let lastTimer = { ...TIMER_OFFLINE };
let lastSwitcher = { ...SWITCHER_OFFLINE };
let lastPresenter = { ...PRESENTER_OFFLINE };
let discovery: Discovery | null = null;

const timerClient = new TimerClient((s) => {
  lastTimer = s;
  broadcast();
});
const switcherClient = new SwitcherClient((s) => {
  lastSwitcher = s;
  broadcast();
});
const presenterClient = new PresenterClient((s) => {
  lastPresenter = s;
  broadcast();
});

function buildState(): StageState {
  return {
    config: getConfig(),
    timer: lastTimer,
    switcher: lastSwitcher,
    presenter: lastPresenter,
  };
}

function broadcast(): void {
  const state = buildState();
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('stage:state', state);
  output.send(state);
}

// Verbindungen an die aktuelle Config angleichen (nur reconnecten, wenn sich
// Host/Port/Enabled tatsächlich geändert haben — Widget-Toggles lösen nichts aus).
let appliedTimerKey = '';
let appliedSwitcherKey = '';
let appliedPresenterKey = '';
function applyConnections(): void {
  const cfg = getConfig();
  const tKey = cfg.timer.enabled ? `${cfg.timer.host}:${cfg.timer.port}` : '';
  if (tKey !== appliedTimerKey) {
    appliedTimerKey = tKey;
    if (tKey) timerClient.connect(cfg.timer.host, cfg.timer.port);
    else timerClient.disconnect();
  }
  const sKey = cfg.switcher.enabled ? `${cfg.switcher.host}:${cfg.switcher.port}` : '';
  if (sKey !== appliedSwitcherKey) {
    appliedSwitcherKey = sKey;
    if (sKey) switcherClient.connect(cfg.switcher.host, cfg.switcher.port);
    else switcherClient.disconnect();
  }
  const pKey = cfg.presenter.enabled
    ? `${cfg.presenter.host}:${cfg.presenter.port}:${cfg.presenter.pin}`
    : '';
  if (pKey !== appliedPresenterKey) {
    appliedPresenterKey = pKey;
    if (pKey) presenterClient.connect(cfg.presenter.host, cfg.presenter.port, cfg.presenter.pin);
    else presenterClient.disconnect();
  }
}

/**
 * mDNS-Fund auswerten: Findet sich eine Quelle im LAN und die konfigurierte
 * Verbindung steht (noch) nicht, übernehmen wir den entdeckten Host/Port — so
 * verbindet sich Stage Display ohne manuelle IP-Eingabe. Eine bereits stehende
 * Verbindung (z. B. lokal über 127.0.0.1) bleibt unangetastet, ebenso eine
 * deaktivierte Quelle. Auth (Presenter-PIN) bleibt manuell — Discovery liefert
 * nur die Adresse, nicht das Geheimnis.
 */
function onDiscovered(services: DiscoveredService[]): void {
  const cfg = getConfig();
  const patch: PartialStageConfig = {};

  // Timer/Presenter annoncieren seit dem Companion-Modul (Welle 1.6.2) ZWEI
  // _jmps._tcp-Dienste: ihren eigenen (Socket.IO/SSE, den Stage Display spricht)
  // und einen Steuer-Endpunkt mit TXT ctl=1 (TCP-Zeilenprotokoll fürs Companion-
  // Modul). Hier den NICHT-Steuer-Endpunkt wählen (!ctl), sonst verbände sich der
  // Socket.IO-/SSE-Client mit dem falschen Port.
  const timer = services.find((s) => s.role === 'timer' && !s.ctl);
  if (timer && cfg.timer.enabled && !lastTimer.connected && cfg.timer.host !== timer.host) {
    patch.timer = { host: timer.host, port: timer.port };
  }

  // Switcher hat KEINEN ctl=1-Marker: sein einziger Advert IST der TCP-Steuer-
  // server, mit dem sich Stage Display (via SuiteControlClient) verbindet — also
  // hier bewusst NICHT auf !ctl filtern.
  const switcher = services.find((s) => s.role === 'switcher');
  if (
    switcher &&
    cfg.switcher.enabled &&
    !lastSwitcher.connected &&
    cfg.switcher.host !== switcher.host
  ) {
    patch.switcher = { host: switcher.host, port: switcher.port };
  }

  const presenter = services.find((s) => s.role === 'presenter' && !s.ctl);
  if (
    presenter &&
    cfg.presenter.enabled &&
    !lastPresenter.connected &&
    cfg.presenter.host !== presenter.host
  ) {
    patch.presenter = { host: presenter.host, port: presenter.port };
  }

  if (Object.keys(patch).length === 0) return;
  patchConfig(patch);
  applyConnections();
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
    width: 1080,
    height: 760,
    minWidth: 880,
    minHeight: 600,
    backgroundColor: '#121212',
    show: false,
    title: 'JM Stage Display',
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
    title: 'JM Stage Display — Ausgabe',
    displayId: displayId ?? getConfig().outputDisplayId ?? undefined,
  });
  // Frischen State sofort schicken, sobald das Fenster geladen hat.
  setTimeout(broadcast, 400);
}

function registerIpc(): void {
  ipcMain.handle('stage:getState', () => buildState());
  ipcMain.handle('stage:setConfig', (_e, patch: PartialStageConfig) => {
    patchConfig(patch);
    applyConnections();
    broadcast();
    return buildState();
  });
  ipcMain.handle('output:displays', () => listDisplays());
  ipcMain.handle('output:open', (_e, displayId?: number) => openOutput(displayId));
  ipcMain.handle('output:close', () => output.close());
  ipcMain.handle('output:isOpen', () => output.isOpen());
}

function hostPort(n: ShowNetworkBinding | undefined): { host?: string; port?: number } {
  if (!n) return {};
  const out: { host?: string; port?: number } = {};
  if (n.host) out.host = n.host;
  if (typeof n.port === 'number') out.port = n.port;
  return out;
}

/**
 * Show-Integration (B4): Wird Stage Display über einen Show-Deep-Link gestartet,
 * verbindet es sich automatisch mit den Quellen, die in derselben Show stehen.
 * Schon die Präsenz von jm-timer/jm-switcher/jm-presenter aktiviert die Quelle
 * (Host/Port aus deren `network`-Binding, sonst Defaults/localhost) — so läuft
 * der häufige Single-Machine-Fall ohne Eingaben, Multi-Machine via network.
 */
function applyShowFromDeepLink(url: string): void {
  const showPath = parseShowDeepLink(url);
  if (!showPath) return;
  try {
    const show = parseShow(readFileSync(showPath, 'utf8'));
    const byId = new Map(show.tools.map((t) => [t.appId, t]));
    const patch: PartialStageConfig = {};

    const timer = byId.get('jm-timer');
    if (timer) patch.timer = { enabled: true, ...hostPort(timer.network) };

    const switcher = byId.get('jm-switcher');
    if (switcher) patch.switcher = { enabled: true, ...hostPort(switcher.network) };

    const presenter = byId.get('jm-presenter');
    if (presenter) {
      const pin =
        typeof presenter.settings?.pin === 'string' ? presenter.settings.pin : undefined;
      patch.presenter = {
        enabled: true,
        ...hostPort(presenter.network),
        ...(pin !== undefined ? { pin } : {}),
      };
    }

    if (Object.keys(patch).length === 0) return;
    patchConfig(patch);
    applyConnections();
    broadcast();
  } catch (err) {
    getLog().error(`Show-Verbindungen konnten nicht gesetzt werden: ${(err as Error).message}`);
  }
}

// Geteilter Runtime-Layer: Logging, Crash-Handler, Deep-Links, Presence.
const runtime = initAppRuntime({
  appId: 'jm-stage-display',
  appName: 'JM Stage Display',
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
    // Per Show gestartet? Quellen aus der Show verbinden (überschreibt die
    // persistierte Config), sonst normal nach persistierter Config verbinden.
    if (runtime.initialDeepLink) applyShowFromDeepLink(runtime.initialDeepLink);
    applyConnections();
    // LAN nach Quellen absuchen und nicht stehende Verbindungen automatisch
    // auf den entdeckten Host umstellen (mDNS). Best-effort.
    try {
      discovery = discover(onDiscovered);
    } catch (err) {
      getLog().warn(`mDNS-Discovery fehlgeschlagen: ${(err as Error).message}`);
    }
  });

  app.on('before-quit', () => discovery?.stop());

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
