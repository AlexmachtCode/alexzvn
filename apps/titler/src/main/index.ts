import { app, BrowserWindow, dialog, ipcMain, screen, shell } from 'electron';
import path, { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { initAppRuntime, getLog } from '@jm/app-runtime';
import { parseShow, parseShowDeepLink } from '@jm/show';
import type {
  DisplayInfo,
  OpenedImportFile,
  PartialTitlerConfig,
  TitlerRemoteState,
  TitlerState,
  TitlerStatus,
} from '@shared/types';
import { getConfig, patchConfig } from './config';
import { registerTemplateIpc } from './library';
import { startSender, stopSender, senderActive } from './ndi/sender-process';
import { startControlServer, stopControlServer, updateTitlerState, updateTitlerData, CONTROL_PORT } from './control-server';
import { startDataWatch, stopDataWatch, recall, step, type DataState } from './datalink';
import { writeSpeakersTsv } from './iveo-show';

declare const __dirname: string;

let mainWindow: BrowserWindow | null = null;
/** Zweites Fenster: Recall-Button-Board (#152). */
let recallWindow: BrowserWindow | null = null;
/** Ausgabe-Fenster: 2. Bildschirm mit Chroma-Green (#161). */
let outputWindow: BrowserWindow | null = null;
/** Zuletzt vom Operator gemeldeter On-Air-Zustand (für frisch geöffnetes Output-Fenster). */
let lastOnAir = false;
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
  // An alle Fenster (Operator, Recall-Board, Output) — alle spiegeln den Zustand.
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send('titler:status', status);
  }
}

/**
 * Config an alle Fenster spiegeln (#161). Der `setConfig`-Invoke liefert den neuen
 * Stand nur an den aufrufenden Renderer zurück; das Output-Fenster (2. Bildschirm)
 * bekäme Text-/Stil-Änderungen sonst nie. Daher der zusätzliche Broadcast.
 */
function broadcastConfig(): void {
  const config = getConfig();
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send('titler:config', config);
  }
}

/** Library-Änderung (#162) an alle Fenster melden → neu listen + Hintergrund neu laden. */
function broadcastTplChanged(): void {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send('titler:tpl-changed');
  }
}

/** Datei für den Import (#162) lesen (Dialog / Drag&Drop). */
async function readImportFile(filePath: string): Promise<OpenedImportFile> {
  const buf = await readFile(filePath);
  return { fileName: path.basename(filePath), bytes: new Uint8Array(buf) };
}

/** Electron-Displays in die serialisierbare Auswahl-Form (#161) bringen. */
function toDisplayInfo(): DisplayInfo[] {
  const primaryId = screen.getPrimaryDisplay().id;
  return screen.getAllDisplays().map((d) => {
    const parts = [`${d.size.width}×${d.size.height}`];
    if (d.internal) parts.push('intern');
    if (d.id === primaryId) parts.push('primär');
    return {
      id: d.id,
      label: parts.join(' · '),
      bounds: { x: d.bounds.x, y: d.bounds.y, width: d.bounds.width, height: d.bounds.height },
      size: { width: d.size.width, height: d.size.height },
      scaleFactor: d.scaleFactor,
      primary: d.id === primaryId,
      internal: d.internal,
    };
  });
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
  // C3: zusätzlich die referenzierte Bauchbinden-Vorlage (Dokument-Ref) öffnen.
  void openShowDocument(showPath);
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

// ── Show-Integration (C3): referenzierte Bauchbinden-Vorlage öffnen ──────────
// Anders als die iveo-Speaker oben (settings-artiges Materialisieren) ist das ein
// DOKUMENT-Ref: Die in der .jmshow für `jm-titler` hinterlegte .jmtitler/.psd wird
// EINMAL beim Show-Öffnen geladen und dem Renderer gereicht, der sie in die Library
// importiert und als aktive Grafik VORBEREITET (nicht on-air). Läuft bewusst NICHT
// bei `TITLER RELOAD` (nur iveo-Refresh) — sonst entstünde je Reload ein Duplikat.
let pendingShowFile: OpenedImportFile | null = null;

async function openShowDocument(showPath: string): Promise<void> {
  try {
    const show = parseShow(readFileSync(showPath, 'utf8'));
    const ref = show.tools.find((t) => t.appId === 'jm-titler');
    if (!ref?.document) return;
    // Dokumentpfad relativ zur Show-Datei auflösen, falls nicht absolut.
    const docPath = path.isAbsolute(ref.document)
      ? ref.document
      : path.join(path.dirname(showPath), ref.document);
    deliverShowFile(await readImportFile(docPath));
  } catch (err) {
    getLog().error(`Show-Vorlage konnte nicht geladen werden: ${(err as Error).message}`);
  }
}

function deliverShowFile(file: OpenedImportFile): void {
  if (!mainWindow) {
    pendingShowFile = file; // Fenster noch nicht da (z. B. mac open-url vor whenReady)
    return;
  }
  const wc = mainWindow.webContents;
  if (wc.isLoading()) wc.once('did-finish-load', () => wc.send('titler:file-opened', file));
  else wc.send('titler:file-opened', file);
}

/** Ein evtl. vor dem Fenster eingetroffenes Show-Dokument nachliefern. */
function flushPendingShowFile(): void {
  const file = pendingShowFile;
  if (!file) return;
  pendingShowFile = null;
  deliverShowFile(file);
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
      // Der NDI-Ausgang (Render-/NDI-Engine im Renderer) MUSS weiterlaufen, wenn das Fenster
      // verdeckt oder minimiert ist. Sonst drosselt Chromium den Timer der Ausgabe-Schleife und
      // die NDI-Quelle sendet keine Frames mehr (bleibt aber im Netz sichtbar → „kein Bild").
      // Lehre aus dem Switcher-NDI-Ausgang (Commit 56320acfd8).
      backgroundThrottling: false,
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
    // Output-Fenster mitschließen, sonst kann die App nicht beenden (window-all-closed).
    if (outputWindow && !outputWindow.isDestroyed()) outputWindow.close();
  });
  const url = process.env['ELECTRON_RENDERER_URL'];
  if (url) win.loadURL(url);
  else win.loadFile(join(__dirname, '../renderer/index.html'));
  mainWindow = win;
  return win;
}

/** Recall-Button-Board (#152) in einem eigenen Fenster öffnen (view=recall). */
function createRecallWindow(): void {
  if (recallWindow && !recallWindow.isDestroyed()) {
    if (recallWindow.isMinimized()) recallWindow.restore();
    recallWindow.focus();
    return;
  }
  const win = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 460,
    minHeight: 340,
    backgroundColor: '#121212',
    show: false,
    title: 'JM Titler · Recall-Board',
    icon: resourcePath('icon.png'),
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
    recallWindow = null;
  });
  const url = process.env['ELECTRON_RENDERER_URL'];
  if (url) win.loadURL(`${url}?view=recall`);
  else win.loadFile(join(__dirname, '../renderer/index.html'), { search: 'view=recall' });
  recallWindow = win;
}

/**
 * Ausgabe-Fenster (#161): frameloses Vollbild auf dem gewählten Monitor, lädt
 * denselben Renderer mit `view=output` (CG auf Chroma-Green für externe Keyer,
 * z. B. vMix/ATEM/TriCaster — unabhängig von NDI). Kein Frame-Port → kann NDI
 * nicht auslösen; `ndiActive=false` im Renderer sorgt zusätzlich dafür.
 */
function createOutputWindow(): void {
  if (outputWindow && !outputWindow.isDestroyed()) return;
  const cfg = getConfig();
  const target =
    screen.getAllDisplays().find((d) => d.id === cfg.secondScreenDisplay) ?? screen.getPrimaryDisplay();
  const win = new BrowserWindow({
    x: target.bounds.x,
    y: target.bounds.y,
    width: target.bounds.width,
    height: target.bounds.height,
    frame: false,
    fullscreen: true,
    backgroundColor: cfg.chromaColor,
    show: false,
    title: 'JM Titler · Ausgabe',
    icon: resourcePath('icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      // Zweiter Bildschirm (#161): frameloser Live-Feed an einen Hardware-Keyer, treibt dieselbe
      // Engine wie das Hauptfenster. Darf ebenso wenig einfrieren, wenn er verdeckt wird oder der
      // Ausgabemonitor schlafen geht — sonst steht die Bauchbinde auf dem Keyer.
      backgroundThrottling: false,
    },
  });
  win.on('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  // On-Air-Zustand an das frisch geladene Fenster nachschieben (sonst startet es „clear").
  win.webContents.on('did-finish-load', () => {
    if (!win.isDestroyed()) win.webContents.send('titler:onair', lastOnAir);
  });
  win.on('closed', () => {
    outputWindow = null;
  });
  const url = process.env['ELECTRON_RENDERER_URL'];
  if (url) win.loadURL(`${url}?view=output`);
  else win.loadFile(join(__dirname, '../renderer/index.html'), { search: 'view=output' });
  outputWindow = win;
}

/**
 * Output-Fenster nach Config-Stand öffnen/schließen/umsetzen (#161). Aufgerufen
 * bei `setConfig` und bei Monitor-Wechseln (display-added/-removed → Hot-Unplug).
 */
function reconcileOutputWindow(): void {
  const cfg = getConfig();
  if (!cfg.secondScreenEnabled) {
    if (outputWindow && !outputWindow.isDestroyed()) outputWindow.close();
    return;
  }
  if (!outputWindow || outputWindow.isDestroyed()) {
    createOutputWindow();
    return;
  }
  // Aktiviert & Fenster existiert → ggf. auf einen anderen Monitor umsetzen.
  const target =
    screen.getAllDisplays().find((d) => d.id === cfg.secondScreenDisplay) ?? screen.getPrimaryDisplay();
  outputWindow.setBounds(target.bounds);
  outputWindow.setFullScreen(true);
  outputWindow.setBackgroundColor(cfg.chromaColor);
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
    // Neuen Stand an alle Fenster (u. a. Output/2. Bildschirm) spiegeln (#161).
    broadcastConfig();
    reconcileOutputWindow();
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
  ipcMain.handle('titler:openRecall', () => createRecallWindow());
  ipcMain.handle('titler:listDisplays', () => toDisplayInfo());
  // Grafik-Vorlagen-Library (#162): list/add/remove/read-bg + Änderungs-Broadcast.
  registerTemplateIpc(broadcastTplChanged);
  ipcMain.handle('titler:pickImportFile', async (): Promise<OpenedImportFile | null> => {
    const r = await dialog.showOpenDialog({
      title: 'Bauchbinde importieren',
      properties: ['openFile'],
      filters: [
        { name: 'Titler-Import', extensions: ['psd', 'jmtitler'] },
        { name: 'Photoshop', extensions: ['psd'] },
        { name: 'JM Titler-Vorlage', extensions: ['jmtitler'] },
        { name: 'Alle Dateien', extensions: ['*'] },
      ],
    });
    if (r.canceled || !r.filePaths[0]) return null;
    return readImportFile(r.filePaths[0]);
  });
  ipcMain.handle('titler:readFile', async (_e, filePath: string): Promise<OpenedImportFile | null> => {
    try {
      return await readImportFile(filePath);
    } catch {
      return null;
    }
  });
  ipcMain.handle('titler:ndi-start', (_e, name: string) => startNdi(name || getConfig().ndiName));
  ipcMain.handle('titler:ndi-stop', () => stopNdi());
  ipcMain.handle('titler:ndi-status', () => {
    status.ndiActive = senderActive();
    return status;
  });
  // TCP-Fernsteuerung: Renderer meldet seinen Live-Zustand → Steuerserver.
  // Zusätzlich On-Air ans Output-Fenster (#161) weiterreichen — fängt Take/Clear
  // per Button UND per Fernsteuerbefehl ab (beide laufen über den Operator-Live-Zustand).
  ipcMain.handle('titler:report-state', (_e, st: TitlerRemoteState) => {
    updateTitlerState(st);
    lastOnAir = st.onAir;
    if (outputWindow && !outputWindow.isDestroyed()) outputWindow.webContents.send('titler:onair', st.onAir);
  });
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
    // C3: eine vor dem Fenster eingetroffene Show-Vorlage jetzt nachliefern.
    flushPendingShowFile();
    // DataLink-Watchfolder (#86) starten, falls konfiguriert.
    refreshDataWatch();
    // Per Show gestartet? iveo-Speaker aus der Show in den DataLink übernehmen (#11)
    // + die referenzierte Bauchbinden-Vorlage (C3) laden.
    if (runtime.initialDeepLink) applyShowFromDeepLink(runtime.initialDeepLink);
    // 2. Bildschirm (#161): bei persistiert aktivierter Ausgabe direkt öffnen und
    // auf Monitor-Wechsel reagieren (verwaistes Fenster bei Hot-Unplug vermeiden,
    // Auswahl-Dropdown im Operator aktuell halten).
    reconcileOutputWindow();
    const onDisplaysChanged = (): void => {
      reconcileOutputWindow();
      for (const w of BrowserWindow.getAllWindows()) {
        if (!w.isDestroyed()) w.webContents.send('titler:displays-changed');
      }
    };
    screen.on('display-added', onDisplaysChanged);
    screen.on('display-removed', onDisplaysChanged);
    screen.on('display-metrics-changed', onDisplaysChanged);
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
