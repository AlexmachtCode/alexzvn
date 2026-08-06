import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  screen,
  shell,
  Tray,
} from 'electron';
import path, { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { initAppRuntime, getLog } from '@jm/app-runtime';
import { advertise, type Advertiser } from '@jm/discovery';
import { readControlConfig, mdnsSignKey } from '@jm/control-config';
import { parseShow, parseShowDeepLink, type ShowAblaufItem } from '@jm/show';
import type { TimetableItem } from '@shared/timer-state';
import { loadState, dispatch } from './state';
import {
  startServer,
  SERVER_HOST,
  SERVER_PORT,
  getRemoteUrls,
  getLanAddresses,
} from './server';
import { startControlServer, stopControlServer, CONTROL_PORT } from './control-server';
import {
  getAuth,
  loadAuth,
  regenerateToken,
  setAuthEnabled,
} from './auth';

declare const __dirname: string;

type ViewName = 'operator' | 'speaker';

let operatorWindow: BrowserWindow | null = null;
let speakerWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let advertiser: Advertiser | null = null;
/** Pfad der aktuell geladenen Show (für Live-Reload, z. B. nach iveo-Update). */
let currentShowPath: string | null = null;

const preloadPath = join(__dirname, '../preload/index.cjs');

function resourcePath(filename: string): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, filename);
  }
  return path.join(__dirname, '..', '..', 'resources', filename);
}

function loadView(win: BrowserWindow, view: ViewName): void {
  const rendererUrl = process.env['ELECTRON_RENDERER_URL'];
  if (rendererUrl) {
    win.loadURL(`${rendererUrl}/?view=${view}`);
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), {
      search: `view=${view}`,
    });
  }
}

function createOperatorWindow(): BrowserWindow {
  if (operatorWindow) {
    if (operatorWindow.isMinimized()) operatorWindow.restore();
    operatorWindow.focus();
    return operatorWindow;
  }
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: '#121212',
    show: false,
    title: 'JM Timer · Operator',
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

  // Closing the operator window does NOT quit the app — only the tray "Quit"
  // action does. Live productions usually want the timer server to keep
  // running until the operator explicitly stops it.
  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });

  win.on('closed', () => {
    operatorWindow = null;
  });

  loadView(win, 'operator');
  operatorWindow = win;
  rebuildTrayMenu();
  return win;
}

function toggleOperatorWindow(): void {
  if (operatorWindow && operatorWindow.isVisible()) {
    operatorWindow.hide();
  } else {
    if (!operatorWindow) createOperatorWindow();
    else {
      if (operatorWindow.isMinimized()) operatorWindow.restore();
      operatorWindow.show();
      operatorWindow.focus();
    }
  }
}

function openSpeakerWindow(): void {
  if (speakerWindow) {
    if (speakerWindow.isMinimized()) speakerWindow.restore();
    speakerWindow.focus();
    return;
  }

  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  const secondary = displays.find((d) => d.id !== primary.id) ?? primary;
  const { x, y, width, height } = secondary.workArea;

  const win = new BrowserWindow({
    x,
    y,
    width: Math.min(width, 1600),
    height: Math.min(height, 900),
    backgroundColor: '#121212',
    show: false,
    autoHideMenuBar: true,
    title: 'JM Timer · Speaker',
    icon: resourcePath('icon.png'),
    fullscreenable: true,
    webPreferences: {
      preload: preloadPath,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.on('ready-to-show', () => {
    win.show();
    if (secondary.id !== primary.id) {
      win.setFullScreen(true);
    }
  });

  win.on('closed', () => {
    speakerWindow = null;
    operatorWindow?.webContents.send('speaker:status', false);
    rebuildTrayMenu();
  });

  loadView(win, 'speaker');
  speakerWindow = win;
  operatorWindow?.webContents.send('speaker:status', true);
  rebuildTrayMenu();
}

function closeSpeakerWindow(): void {
  speakerWindow?.close();
}

function rebuildTrayMenu(): void {
  if (!tray) return;
  const urls = getRemoteUrls();
  const operatorVisible = operatorWindow?.isVisible() ?? false;
  const speakerOpen = speakerWindow !== null;

  const menu = Menu.buildFromTemplate([
    {
      label: operatorVisible
        ? 'Operator-Fenster verbergen'
        : 'Operator-Fenster anzeigen',
      click: () => toggleOperatorWindow(),
    },
    {
      label: speakerOpen
        ? 'Speaker-Fenster schließen'
        : 'Speaker-Fenster öffnen',
      click: () => (speakerOpen ? closeSpeakerWindow() : openSpeakerWindow()),
    },
    { type: 'separator' },
    {
      label: 'Remote-URLs (LAN)',
      submenu:
        urls.length > 0
          ? urls.map((url) => ({
              label: url,
              click: () => shell.openExternal(url),
            }))
          : [{ label: 'Keine LAN-Adresse gefunden', enabled: false }],
    },
    { type: 'separator' },
    {
      label: `Status: Server läuft auf :${SERVER_PORT}`,
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'JM Timer beenden',
      click: () => {
        isQuitting = true;
        if (speakerWindow) speakerWindow.destroy();
        if (operatorWindow) operatorWindow.destroy();
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(menu);
  tray.setToolTip(
    `JM Timer · Server :${SERVER_PORT}${speakerOpen ? ' · Speaker offen' : ''}`,
  );
}

function setupTray(): void {
  const iconPath = resourcePath(
    process.platform === 'win32' ? 'icon.ico' : 'tray-icon.png',
  );
  let image = nativeImage.createFromPath(iconPath);
  if (image.isEmpty()) {
    // Fallback to the larger PNG if tray-icon.png isn't found
    image = nativeImage.createFromPath(resourcePath('icon.png'));
  }
  // On macOS, tray icons are template images that get tinted
  if (process.platform === 'darwin') {
    image = image.resize({ width: 18, height: 18 });
    image.setTemplateImage(true);
  } else if (process.platform === 'win32') {
    image = image.resize({ width: 16, height: 16 });
  }

  tray = new Tray(image);
  tray.setToolTip('JM Timer');

  // Single-click on Windows/Linux toggles the operator window
  tray.on('click', () => {
    if (process.platform !== 'darwin') toggleOperatorWindow();
  });

  rebuildTrayMenu();
}

function registerIpc(): void {
  ipcMain.handle('speaker:open', () => openSpeakerWindow());
  ipcMain.handle('speaker:close', () => closeSpeakerWindow());
  ipcMain.handle('speaker:toggle', () => {
    if (speakerWindow) closeSpeakerWindow();
    else openSpeakerWindow();
  });
  ipcMain.handle('speaker:isOpen', () => speakerWindow !== null);
  ipcMain.handle('speaker:fullscreen', (_event, flag: boolean) => {
    if (!speakerWindow) return false;
    speakerWindow.setFullScreen(flag);
    return flag;
  });
  ipcMain.handle('speaker:isFullscreen', () => {
    return speakerWindow?.isFullScreen() ?? false;
  });
  ipcMain.handle('window:close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
  });
  ipcMain.handle('remote:getUrls', () => getRemoteUrls());
  ipcMain.handle('remote:getAddresses', () => getLanAddresses());

  ipcMain.handle('auth:get', () => getAuth());
  ipcMain.handle('auth:setEnabled', (_event, enabled: boolean) =>
    setAuthEnabled(enabled),
  );
  ipcMain.handle('auth:regenerate', () => regenerateToken());
}

/** Liest einen Ablaufplan aus den (untrusted) Show-Settings — defensiv. */
function parseTimetable(raw: unknown): Array<Omit<TimetableItem, 'id'>> | null {
  if (!Array.isArray(raw)) return null;
  const items = raw
    .filter((it): it is Record<string, unknown> => Boolean(it) && typeof it === 'object')
    .map((it) => ({
      label: typeof it.label === 'string' ? it.label : '',
      durationMs:
        typeof it.durationMs === 'number' && it.durationMs >= 0 ? it.durationMs : 0,
      ...(typeof it.note === 'string' ? { note: it.note } : {}),
    }));
  return items.length ? items : null;
}

/** Zentralen Show-Ablauf (#78) in Timetable-Items überführen (gleiche Form). */
function ablaufToTimetable(
  ablauf: ShowAblaufItem[] | undefined,
): Array<Omit<TimetableItem, 'id'>> | null {
  if (!ablauf || !ablauf.length) return null;
  return ablauf.map((a) => ({
    label: a.label,
    durationMs: typeof a.durationMs === 'number' && a.durationMs > 0 ? a.durationMs : 0,
    ...(a.note ? { note: a.note } : {}),
    ...(typeof a.plannedStartMs === 'number' ? { plannedStartMs: a.plannedStartMs } : {}),
    ...(a.owner ? { owner: a.owner } : {}),
    ...(a.category ? { category: a.category } : {}),
  }));
}

/**
 * Show-Integration (B4): Wird der Timer über einen Show-Deep-Link gestartet,
 * übernimmt er seinen Teil aus der Show. Der Timer hat kein Dokumentformat,
 * daher trägt die Show die Daten inline in `settings`:
 *   { timetable?: [{label, durationMs, note?}], durationMs?: number }
 * Fehlt eine explizite Timer-Timetable, greift der ZENTRALE Show-Ablauf
 * (#78, show.ablauf) — derselbe {label,durationMs?,note?}-Aufbau. So muss der
 * Ablauf nur einmal zentral gepflegt werden (speist Timer UND Rundown).
 */
function applyShowFromDeepLink(url: string): void {
  const showPath = parseShowDeepLink(url);
  if (!showPath) return;
  applyShowFromPath(showPath, 'initial');
}

/**
 * Ablauf aus einer .jmshow anwenden. `mode`:
 *  - 'initial' (Erst-Öffnen): `tt:setAll` — ersetzt Ablauf + setzt Countdown zurück.
 *  - 'reload' (Live-Update, z. B. nach iveo-Poll): `tt:replaceItems` — tauscht nur
 *    die Items, lässt einen laufenden Countdown UNANGETASTET.
 * Merkt sich den Show-Pfad, damit `reloadCurrentShow()` später neu einlesen kann.
 */
function applyShowFromPath(showPath: string, mode: 'initial' | 'reload'): void {
  try {
    const show = parseShow(readFileSync(showPath, 'utf8'));
    const settings = show.tools.find((t) => t.appId === 'jm-timer')?.settings;
    const items = parseTimetable(settings?.timetable) ?? ablaufToTimetable(show.ablauf);
    if (items) {
      dispatch({ type: mode === 'reload' ? 'tt:replaceItems' : 'tt:setAll', items });
    }
    // Countdown-Vorgabe nur beim Erst-Öffnen anwenden (nicht bei Live-Reload).
    if (
      mode === 'initial' &&
      settings &&
      typeof settings.durationMs === 'number' &&
      settings.durationMs >= 0
    ) {
      dispatch({ type: 'setDuration', ms: settings.durationMs });
    }
    currentShowPath = showPath;
  } catch (err) {
    getLog().error(`Show-Einstellungen konnten nicht geladen werden: ${(err as Error).message}`);
  }
}

/**
 * Aktuelle Show neu einlesen (z. B. wenn der Launcher nach einem iveo-Update ein
 * `TIMER RELOAD` schickt). No-op, wenn keine Show geladen ist. Nicht-destruktiv.
 */
export function reloadCurrentShow(): boolean {
  if (!currentShowPath) return false;
  applyShowFromPath(currentShowPath, 'reload');
  return true;
}

// Geteilter Runtime-Layer: Logging, Crash-Handler, Deep-Links, Presence.
// Früh aufrufen, damit Crash-Handler auch Fehler vor whenReady fangen.
const runtime = initAppRuntime({
  appId: 'jm-timer',
  appName: 'JM Timer',
  servicePort: SERVER_PORT,
  // P2 (#60): CSP. Operator-/Speaker-Fenster sprechen den lokalen Socket.IO-Server
  // (Loopback, Port 7777) per WebSocket — connect-src muss http+ws dorthin erlauben.
  // Die Remote-Browser-Ansicht (Handy/Tablet) ist kein Electron-Fenster und von
  // dieser CSP unberührt.
  csp: {
    connectSrc: [`http://${SERVER_HOST}:${SERVER_PORT}`, `ws://${SERVER_HOST}:${SERVER_PORT}`],
  },
  onDeepLink: (url) => applyShowFromDeepLink(url),
});

// Single-instance lock — second launch focuses the existing instance.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (operatorWindow) {
      if (operatorWindow.isMinimized()) operatorWindow.restore();
      operatorWindow.show();
      operatorWindow.focus();
    } else {
      createOperatorWindow();
    }
  });

  app.whenReady().then(async () => {
    loadState();
    loadAuth();
    await startServer();
    // Im LAN annoncieren, damit Aggregatoren (Stage Display) den Timer ohne
    // manuelle IP/Port-Eingabe finden (mDNS). Best-effort.
    try {
      // Annonce im secure-Modus signieren (A3, #59), damit Aggregatoren den echten
      // Timer von einem Spoof unterscheiden. Open-Modus → signKey undefined (wie bisher).
      const signKey = mdnsSignKey(readControlConfig(app.getPath('appData')));
      advertiser = advertise({ appId: 'jm-timer', role: 'timer', port: SERVER_PORT, signKey });
    } catch (err) {
      getLog().warn(`mDNS-Annoncierung fehlgeschlagen: ${(err as Error).message}`);
    }
    // TCP-Steuerserver (suite-weites Protokoll) für Companion u. a. — neben
    // Socket.IO, ohne eigene mDNS-Annoncierung (siehe control-server.ts).
    try {
      const r = await startControlServer({ onReload: () => reloadCurrentShow() });
      if (!r.ok) getLog().warn(`Timer-Steuerserver nicht gestartet: ${r.error ?? 'unbekannt'}`);
      else getLog().info(`Timer-Steuerserver (Companion) lauscht auf :${CONTROL_PORT}`);
    } catch (err) {
      getLog().warn(`Timer-Steuerserver fehlgeschlagen: ${(err as Error).message}`);
    }
    registerIpc();
    // Per Show gestartet? Ablaufplan/Countdown aus der Show übernehmen (nach
    // startServer, damit der Broadcast verbundene Clients sofort erreicht).
    if (runtime.initialDeepLink) applyShowFromDeepLink(runtime.initialDeepLink);
    setupTray();
    createOperatorWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createOperatorWindow();
      else operatorWindow?.show();
    });
  });

  // Don't quit when all windows close — the tray keeps the app alive.
  app.on('window-all-closed', () => {
    // Intentionally a no-op: only the tray "Quit" action exits the app.
  });

  app.on('before-quit', () => {
    isQuitting = true;
    advertiser?.stop();
    stopControlServer();
  });
}

export { SERVER_HOST, SERVER_PORT };
