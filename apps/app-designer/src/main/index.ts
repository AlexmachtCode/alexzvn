import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import path, { join } from 'node:path';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { initAppRuntime, getLog } from '@jm/app-runtime';
import { OutputWindow, listDisplays } from '@jm/output-window';
import { migrateProject, type AppProject } from '@jm/appkit';
import { sanitizeFileName } from '@shared/assets';
import type { AssetBlob, ExportResult, SaveResult, TemplateInfo } from '@shared/types';
import { publish, publishedDoc, registerAppProtocol, registerAppScheme, urlFor } from './app-protocol';
import { writeBundle } from './export';

declare const __dirname: string;

const preloadPath = join(__dirname, '../preload/index.cjs');
let mainWindow: BrowserWindow | null = null;
const kiosk = new OutputWindow('appdesigner:kiosk');

/** Aktuell geöffnete Projektdatei (für „Speichern" ohne Dialog). */
let currentPath: string | null = null;

function resourcePath(...parts: string[]): string {
  if (app.isPackaged) return path.join(process.resourcesPath, ...parts);
  return path.join(__dirname, '..', '..', 'resources', ...parts);
}

/** Die gebaute @jm/appkit-Laufzeit. tools/bundle-runtime.mjs legt sie dorthin. */
function runtimePath(): string {
  return resourcePath('runtime.js');
}

// ── Vorlagen ─────────────────────────────────────────────────────────────────

function templateDir(): string {
  return resourcePath('templates');
}

function listTemplates(): TemplateInfo[] {
  try {
    return readdirSync(templateDir())
      .filter((f) => f.endsWith('.json'))
      .map((f) => {
        const raw = JSON.parse(readFileSync(join(templateDir(), f), 'utf8')) as Record<string, unknown>;
        const meta = (raw['$meta'] as Record<string, string> | undefined) ?? {};
        return {
          id: f.replace(/\.json$/, ''),
          name: meta['name'] ?? String(raw['name'] ?? f),
          description: meta['description'] ?? '',
        };
      });
  } catch (err) {
    getLog().error(`Vorlagen konnten nicht gelesen werden: ${(err as Error).message}`);
    return [];
  }
}

/**
 * Vorlage laden. Die IDs im Vorlagen-JSON sind fest — sie werden hier NICHT neu
 * vergeben, weil Regeln per ID auf Szenen und Elemente zeigen. Zwei Kopien
 * derselben Vorlage kollidieren nicht: sie leben in getrennten Dokumenten.
 */
function loadTemplate(id: string): AppProject {
  const safe = sanitizeFileName(`${id}.json`);
  const raw = JSON.parse(readFileSync(join(templateDir(), safe), 'utf8'));
  return migrateProject(raw);
}

// ── Datei-Dialoge ────────────────────────────────────────────────────────────

const PROJECT_FILTER = [{ name: 'JM App', extensions: ['jmapp'] }];

async function doSave(zipBytes: Uint8Array, target: string | null): Promise<SaveResult> {
  let dest = target;
  if (!dest) {
    const r = await dialog.showSaveDialog({
      title: 'App speichern',
      defaultPath: 'meine-app.jmapp',
      filters: PROJECT_FILTER,
    });
    if (r.canceled || !r.filePath) return { path: null, canceled: true };
    dest = r.filePath;
  }
  writeFileSync(dest, zipBytes);
  currentPath = dest;
  return { path: dest, canceled: false };
}

// ── Fenster ──────────────────────────────────────────────────────────────────

function rendererUrl(): string | undefined {
  return process.env['ELECTRON_RENDERER_URL'];
}

function createMainWindow(): BrowserWindow {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    return mainWindow;
  }
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#121212',
    show: false,
    title: 'JM App Designer',
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
  else win.loadFile(join(__dirname, '../renderer/index.html'));
  mainWindow = win;
  return win;
}

// ── IPC ──────────────────────────────────────────────────────────────────────

function registerIpc(): void {
  ipcMain.handle('appdesigner:listTemplates', () => listTemplates());
  ipcMain.handle('appdesigner:loadTemplate', (_e, id: string) => loadTemplate(id));

  ipcMain.handle('appdesigner:openProject', async () => {
    const r = await dialog.showOpenDialog({
      title: 'App öffnen',
      properties: ['openFile'],
      filters: PROJECT_FILTER,
    });
    if (r.canceled || !r.filePaths[0]) return null;
    const file = r.filePaths[0];
    // Der Renderer entpackt das ZIP (fflate) — der Main reicht nur Bytes durch,
    // wie in apps/grafiktool.
    const bytes = readFileSync(file);
    currentPath = file;
    return { path: file, zipBytes: new Uint8Array(bytes) };
  });

  ipcMain.handle('appdesigner:saveProject', (_e, zipBytes: Uint8Array, target: string | null) =>
    doSave(zipBytes, target ?? currentPath),
  );
  ipcMain.handle('appdesigner:saveProjectAs', (_e, zipBytes: Uint8Array) => doSave(zipBytes, null));

  ipcMain.handle('appdesigner:importAsset', async (): Promise<AssetBlob[]> => {
    const r = await dialog.showOpenDialog({
      title: 'Medien importieren',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Medien', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'mp4', 'webm', 'mp3', 'wav', 'ogg', 'm4a'] },
      ],
    });
    if (r.canceled) return [];
    return r.filePaths.map((p) => {
      const fileName = sanitizeFileName(path.basename(p));
      return {
        id: '',
        fileName,
        mime: '',
        bytes: new Uint8Array(readFileSync(p)),
      };
    });
  });

  ipcMain.handle('appdesigner:publish', (_e, doc: AppProject, assets: AssetBlob[]) => {
    publish(migrateProject(doc), assets);
  });
  ipcMain.handle('appdesigner:previewUrl', () => urlFor('preview'));

  ipcMain.handle('appdesigner:exportBundle', async (_e, doc: AppProject, assets: AssetBlob[]): Promise<ExportResult> => {
    const r = await dialog.showOpenDialog({
      title: 'Zielordner für das App-Bundle',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (r.canceled || !r.filePaths[0]) return { dir: null, canceled: true, bytes: 0 };
    const dir = r.filePaths[0];
    const { bytes } = writeBundle(dir, migrateProject(doc), assets, runtimePath());
    getLog().info(`Bundle exportiert: ${dir} (${Math.round(bytes / 1024)} KB)`);
    return { dir, canceled: false, bytes };
  });

  ipcMain.handle('appdesigner:listDisplays', () => listDisplays());

  ipcMain.handle('appdesigner:openKiosk', (_e, displayId: number | null) => {
    if (!publishedDoc()) {
      getLog().warn('Kiosk ohne veröffentlichtes Dokument angefordert');
      return;
    }
    // Der Kiosk lädt dieselbe Bundle-Struktur wie der Export — jeder Terminal-
    // Start testet damit das Export-Artefakt mit. Bewusst ohne Preload: bekäme die
    // Seite eine IPC-Bridge, wäre sie nicht mehr das, was exportiert wird.
    kiosk.open({
      url: urlFor('kiosk'),
      title: 'JM App Designer — Terminal',
      sandbox: true,
      ...(displayId != null ? { displayId } : {}),
    });
  });
  ipcMain.handle('appdesigner:closeKiosk', () => kiosk.close());
  ipcMain.handle('appdesigner:isKioskOpen', () => kiosk.isOpen());

  ipcMain.handle('appdesigner:revealPath', (_e, p: string) => shell.showItemInFolder(p));
}

// ── Start ────────────────────────────────────────────────────────────────────

// Muss vor app.whenReady() laufen: macht jmapp:// zu einer echten, sicheren Origin.
registerAppScheme();

const runtime = initAppRuntime({
  appId: 'jm-app-designer',
  appName: 'JM App Designer',
  // Der Vorschau-Frame läuft unter jmapp:// — ein eigenes Schema erbt die CSP des
  // Editors nicht, sondern bringt seine eigene mit (siehe main/app-protocol.ts).
  csp: { frameSrc: ['jmapp:'] },
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
    registerAppProtocol(runtimePath());
    registerIpc();
    createMainWindow();
    if (runtime.initialDeepLink) getLog().info(`Deep-Link: ${runtime.initialDeepLink}`);
  });

  app.on('before-quit', () => kiosk.close());

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
