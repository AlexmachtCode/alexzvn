import { app, BrowserWindow, shell } from 'electron';
import path from 'node:path';

export interface WindowOptions {
  /** Fenstertitel (z. B. "JM Production Suite"). */
  title: string;
  /** Absoluter Pfad zur kompilierten Preload-Datei. */
  preloadPath: string;
  /** Pfad zum Fenster-Icon (optional). */
  iconPath?: string;
  /** Dev-Server-URL (process.env.ELECTRON_RENDERER_URL); fällt sonst auf rendererFile zurück. */
  rendererUrl?: string;
  /** Pfad zur gebauten index.html (Produktion). */
  rendererFile: string;
  width?: number;
  height?: number;
  minWidth?: number;
  minHeight?: number;
  backgroundColor?: string;
  /**
   * Renderer-Sandbox (P2, #60). Default `false` (heutiges Verhalten). `true` =
   * zusätzliche OS-Sandbox des Renderer-Prozesses (Defense-in-Depth über
   * `contextIsolation` hinaus). Das Preload darf dann nur sandbox-sichere
   * Electron-APIs nutzen (`contextBridge`/`ipcRenderer`/`webUtils`) — keine
   * `node:*`-Importe und kein `process.versions`. Pro App opt-in, bis alle Tools
   * migriert sind; danach kann der Default zentral auf `true` wechseln.
   */
  sandbox?: boolean;
  /**
   * Chromium drosselt Timer und `requestAnimationFrame` in verdeckten oder minimierten
   * Fenstern. Für Tools mit einem LIVE-Ausgang (NDI-Versand, Aufnahme, Ducking) ist das fatal:
   * die Quelle bleibt im Netz sichtbar, liefert aber nichts mehr. Solche Apps setzen `false`.
   * Default bleibt Chromiums Sparverhalten — es kostet sonst grundlos Akku.
   */
  backgroundThrottling?: boolean;
}

let mainWindow: BrowserWindow | null = null;

/**
 * Erstellt das Hauptfenster mit den JM-Standardwerten — oder fokussiert ein
 * bereits offenes Fenster (Singleton). Spiegelt das Muster aus den bestehenden Tools.
 */
export function createMainWindow(opts: WindowOptions): BrowserWindow {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    return mainWindow;
  }

  const win = new BrowserWindow({
    width: opts.width ?? 1280,
    height: opts.height ?? 860,
    minWidth: opts.minWidth ?? 980,
    minHeight: opts.minHeight ?? 640,
    backgroundColor: opts.backgroundColor ?? '#121212',
    show: false,
    title: opts.title,
    icon: opts.iconPath,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    autoHideMenuBar: true,
    webPreferences: {
      preload: opts.preloadPath,
      sandbox: opts.sandbox ?? false,
      contextIsolation: true,
      nodeIntegration: false,
      ...(opts.backgroundThrottling === false ? { backgroundThrottling: false } : {}),
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

  if (opts.rendererUrl) {
    win.loadURL(opts.rendererUrl);
  } else {
    win.loadFile(opts.rendererFile);
  }

  mainWindow = win;
  return win;
}

/** Liefert das aktuelle Hauptfenster (oder null). */
export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

/**
 * Single-Instance-Lock: verhindert doppelte App-Instanzen und fokussiert beim
 * erneuten Start das bestehende Fenster. Gibt false zurück, wenn die App quitten soll.
 */
export function setupSingleInstance(focusOrCreate: () => void): boolean {
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
    return false;
  }
  app.on('second-instance', () => focusOrCreate());
  return true;
}

/** Pfad zu einer Datei in `resources/` — gepackt via process.resourcesPath, im Dev relativ. */
export function resourcePath(filename: string, devDir: string): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, filename);
  }
  return path.join(devDir, filename);
}
