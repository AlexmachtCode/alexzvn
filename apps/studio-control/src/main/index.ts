import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  shell,
  Tray,
} from 'electron';
import path, { join } from 'node:path';

import { initAppRuntime } from '@jm/app-runtime';
import { migrate } from './db/migrate';
import { ensureInitialAdmin } from './auth/bootstrap';
import { loadDevices } from './config/devices';
import { loadTricasters } from './config/tricasters';
import {
  startServer,
  SERVER_HOST,
  SERVER_PORT,
  getRemoteUrls,
  getLanAddresses,
} from './server';

declare const __dirname: string;

// Geteilter Runtime-Layer: Logging, Crash-Handler, Deep-Links, Presence.
initAppRuntime({ appId: 'jm-studio-control', appName: 'JM Studio Control' });

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

const preloadPath = join(__dirname, '../preload/index.mjs');

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
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: '#121212',
    show: false,
    title: 'JM Studio Control',
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

  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });

  win.on('closed', () => {
    mainWindow = null;
  });

  loadMain(win);
  mainWindow = win;
  rebuildTrayMenu();
  return win;
}

function toggleMainWindow(): void {
  if (mainWindow && mainWindow.isVisible()) {
    mainWindow.hide();
  } else if (!mainWindow) {
    createMainWindow();
  } else {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
}

function rebuildTrayMenu(): void {
  if (!tray) return;
  const urls = getRemoteUrls();
  const visible = mainWindow?.isVisible() ?? false;

  const menu = Menu.buildFromTemplate([
    {
      label: visible ? 'Fenster verbergen' : 'Fenster anzeigen',
      click: () => toggleMainWindow(),
    },
    { type: 'separator' },
    {
      label: 'LAN-URLs',
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
      label: `Server :${SERVER_PORT}`,
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'JM Studio Control beenden',
      click: () => {
        isQuitting = true;
        if (mainWindow) mainWindow.destroy();
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(menu);
  tray.setToolTip(`JM Studio Control · :${SERVER_PORT}`);
}

function setupTray(): void {
  const iconPath = resourcePath(
    process.platform === 'win32' ? 'icon.ico' : 'tray-icon.png',
  );
  let image = nativeImage.createFromPath(iconPath);
  if (image.isEmpty()) image = nativeImage.createFromPath(resourcePath('icon.png'));
  if (process.platform === 'darwin') {
    image = image.resize({ width: 18, height: 18 });
    image.setTemplateImage(true);
  } else if (process.platform === 'win32') {
    image = image.resize({ width: 16, height: 16 });
  }
  tray = new Tray(image);
  tray.setToolTip('JM Studio Control');
  tray.on('click', () => {
    if (process.platform !== 'darwin') toggleMainWindow();
  });
  rebuildTrayMenu();
}

function registerIpc(): void {
  ipcMain.handle('remote:getUrls', () => getRemoteUrls());
  ipcMain.handle('remote:getAddresses', () => getLanAddresses());
  ipcMain.handle('window:close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
  });
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

  app.whenReady().then(async () => {
    migrate();
    ensureInitialAdmin();
    loadDevices();
    loadTricasters();
    await startServer();
    registerIpc();
    setupTray();
    createMainWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
      else mainWindow?.show();
    });
  });

  app.on('window-all-closed', () => {
    // tray keeps the app alive
  });

  app.on('before-quit', () => {
    isQuitting = true;
  });
}

export { SERVER_HOST, SERVER_PORT };
