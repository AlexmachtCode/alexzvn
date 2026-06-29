import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import path, { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { initAppRuntime, getLog } from '@jm/app-runtime';
import { parseShow, parseShowDeepLink } from '@jm/show';
import { buildActionLine, navigate } from '@shared/conductor';
import type { SuiteCommand, SuiteState } from '@jm/suite-control-protocol';
import type { FireReport, RundownAction, RundownDoc, RundownNav, RundownRow, RundownState } from '@shared/types';
import { Conductor } from './conductor';
import { getOverrides, setOverride } from './config';
import { startControlServer, stopControlServer, pushControlState } from './control-server';
import { defaultDoc, docFromAblauf, loadAutosave, readDoc, saveAutosave, writeDoc } from './store';

declare const __dirname: string;

let mainWindow: BrowserWindow | null = null;
const preloadPath = join(__dirname, '../preload/index.cjs');

// ── Autoritativer Zustand (lebt im Main, damit auch der spätere RUNDOWN-
//    Steuerserver / Companion navigieren kann) ───────────────────────────────
let doc: RundownDoc = defaultDoc();
let index = 0;
let filePath: string | null = null;
let dirty = false;
let lastFired: FireReport | null = null;

const conductor = new Conductor(() => broadcastLinks());

function resourcePath(filename: string): string {
  if (app.isPackaged) return path.join(process.resourcesPath, filename);
  return path.join(__dirname, '..', '..', 'resources', filename);
}

function buildState(): RundownState {
  return { doc, index, filePath, dirty, links: conductor.snapshot(), overrides: getOverrides(), lastFired };
}

function broadcast(): void {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('rundown:state', buildState());
  pushControlState(buildSuiteState());
}

/** Zustand fürs Suite-Steuerprotokoll (Companion liest cue/total/label). */
function buildSuiteState(): SuiteState {
  const cur = doc.rows[index];
  return {
    ns: 'rundown',
    kv: {
      cue: doc.rows.length ? index + 1 : 0,
      total: doc.rows.length,
      // STATE ist whitespace-getrennt → Leerzeichen im Titel ersetzen.
      label: cur ? cur.label.trim().replace(/\s+/g, '_') || '-' : '-',
    },
  };
}

/** RUNDOWN-Befehl (von Companion) → Navigation. */
function handleSuiteCommand(cmd: SuiteCommand): void {
  switch (cmd.verb) {
    case 'go':
      doNav({ t: 'go' });
      break;
    case 'next':
      doNav({ t: 'next' });
      break;
    case 'prev':
      doNav({ t: 'prev' });
      break;
    case 'goto': {
      const n = Number(cmd.args[0]);
      if (Number.isFinite(n)) doNav({ t: 'goto', n: Math.trunc(n) });
      break;
    }
  }
}

// Tally/Verbindungen ändern sich häufig (z. B. Timer-Tick 1×/s je Tool) → nur die
// Links separat und gedrosselt senden, nicht den ganzen Doc.
let linksTimer: ReturnType<typeof setTimeout> | null = null;
function broadcastLinks(): void {
  if (linksTimer) return;
  linksTimer = setTimeout(() => {
    linksTimer = null;
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('rundown:links', conductor.snapshot());
  }, 100);
}

function setDoc(next: RundownDoc, nextPath: string | null, markDirty: boolean): void {
  // Dokumentwechsel/-Edit bricht noch ausstehende verzögerte Aktionen ab — sie
  // gehörten zum alten Stand.
  cancelPendingFires();
  doc = next;
  if (index > doc.rows.length - 1) index = Math.max(0, doc.rows.length - 1);
  filePath = nextPath;
  dirty = markDirty;
  saveAutosave(doc);
  broadcast();
}

// ── Verzögerte GO-Feuerung (Issue #80) ───────────────────────────────────────
// Aktionen einer Zeile können je eine Verzögerung (delayMs) vor dem Feuern tragen,
// kumulativ über die Sequenz. Ohne Verzögerungen verhält sich GO exakt wie bisher
// (alle Aktionen synchron). Ausstehende Timer werden bei jeder neuen Navigation
// oder jedem Dokumentwechsel abgebrochen, damit nichts in die nächste Cue feuert.
let fireTimers: ReturnType<typeof setTimeout>[] = [];

function cancelPendingFires(): void {
  for (const t of fireTimers) clearTimeout(t);
  fireTimers = [];
}

function fireOne(row: RundownRow, a: RundownAction, sent: FireReport['sent']): void {
  const line = buildActionLine(a.role, a.verb, a.args);
  const delivered = conductor.fire(a.role, line);
  sent.push({ role: a.role, line, delivered });
  getLog().info(`GO „${row.label}": ${line}${delivered ? '' : ' (offline)'}`);
}

/** Aktionen der scharfen Zeile feuern — sofort und/oder zeitversetzt nach delayMs. */
function fireRow(row: RundownRow | undefined, actions: RundownAction[]): void {
  if (!row) {
    lastFired = null;
    return;
  }
  const sent: FireReport['sent'] = [];
  lastFired = { rowId: row.id, rowLabel: row.label, sent };
  let offset = 0;
  for (const a of actions) {
    offset += Math.max(0, a.delayMs ?? 0);
    if (offset === 0) {
      fireOne(row, a, sent); // kein Versatz → synchron (wie bisher)
    } else {
      const t = setTimeout(() => {
        fireTimers = fireTimers.filter((x) => x !== t);
        fireOne(row, a, sent);
        broadcast(); // UI-Quittung aktualisieren, sobald die Aktion rausging
      }, offset);
      fireTimers.push(t);
    }
  }
}

/** Navigation auswerten; bei GO die Aktionen der scharfen Zeile feuern. */
function doNav(cmd: RundownNav): void {
  // Neue Navigation bricht noch ausstehende verzögerte Aktionen der vorigen Zeile ab.
  cancelPendingFires();
  const res = navigate(doc, index, cmd);
  if (cmd.t === 'go') fireRow(doc.rows[index], res.fire);
  index = res.index;
  broadcast();
}

async function openDialog(): Promise<void> {
  const r = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'JM Rundown', extensions: ['jmrundown'] }],
  });
  if (r.canceled || !r.filePaths[0]) return;
  try {
    const d = readDoc(r.filePaths[0]);
    index = 0;
    lastFired = null;
    setDoc(d, r.filePaths[0], false);
  } catch (err) {
    getLog().error(`Öffnen fehlgeschlagen: ${(err as Error).message}`);
  }
}

async function saveDialog(forceNew: boolean): Promise<void> {
  let target = filePath;
  if (forceNew || !target) {
    const r = await dialog.showSaveDialog({
      defaultPath: `${doc.name}.jmrundown`,
      filters: [{ name: 'JM Rundown', extensions: ['jmrundown'] }],
    });
    if (r.canceled || !r.filePath) return;
    target = r.filePath;
  }
  try {
    writeDoc(target, doc);
    filePath = target;
    dirty = false;
    broadcast();
  } catch (err) {
    getLog().error(`Speichern fehlgeschlagen: ${(err as Error).message}`);
  }
}

function registerIpc(): void {
  ipcMain.handle('rundown:getState', () => buildState());
  ipcMain.handle('rundown:nav', (_e, cmd: RundownNav) => {
    doNav(cmd);
    return buildState();
  });
  ipcMain.handle('rundown:fireAction', (_e, role: string, verb: string, args: (string | number)[]) => {
    const line = buildActionLine(role, verb, args);
    const delivered = conductor.fire(role, line);
    getLog().info(`Test-Fire ${line}${delivered ? '' : ' (offline)'}`);
    return delivered;
  });
  ipcMain.handle('rundown:setEndpoint', (_e, role: string, host: string, port: number) => {
    conductor.setOverrides(setOverride(role, host || null, Number.isFinite(port) ? port : null));
    return buildState();
  });
  ipcMain.handle('rundown:pickFile', async () => {
    // Datei-Dialog für Pfad-Argumente (z. B. PRESENTER OPEN). Hinweis: Der Pfad
    // gilt auf dem Ziel-Rechner — sinnvoll bei gemeinsamem/UNC-Laufwerk oder
    // gleichem Rechner; sonst Pfad direkt eintippen.
    const r = await dialog.showOpenDialog({
      title: 'Datei wählen',
      properties: ['openFile'],
      filters: [
        { name: 'Präsentationen', extensions: ['pdf', 'pptx', 'ppt', 'odp', 'jmpres', 'png', 'jpg', 'jpeg', 'webp'] },
        { name: 'Alle Dateien', extensions: ['*'] },
      ],
    });
    if (r.canceled || !r.filePaths[0]) return null;
    return r.filePaths[0];
  });
  ipcMain.handle('rundown:importRegieplan', async () => {
    // Regieplan (Excel/CSV) wählen + Bytes an den Renderer geben (parst dort mit
    // SheetJS, Issue #82). Dasselbe Spaltenformat wie der JM-Timer-Import.
    const r = await dialog.showOpenDialog({
      title: 'Regieplan importieren',
      properties: ['openFile'],
      filters: [
        { name: 'Regieplan (Excel/CSV)', extensions: ['xlsx', 'xls', 'xlsm', 'csv'] },
        { name: 'Alle Dateien', extensions: ['*'] },
      ],
    });
    if (r.canceled || !r.filePaths[0]) return null;
    return { name: path.basename(r.filePaths[0]), bytes: new Uint8Array(readFileSync(r.filePaths[0])) };
  });
  ipcMain.handle('rundown:setDoc', (_e, next: RundownDoc) => {
    setDoc(next, filePath, true);
    return buildState();
  });
  ipcMain.handle('rundown:new', () => {
    index = 0;
    lastFired = null;
    setDoc(defaultDoc(), null, false);
    return buildState();
  });
  ipcMain.handle('rundown:open', async () => {
    await openDialog();
    return buildState();
  });
  ipcMain.handle('rundown:save', async () => {
    await saveDialog(false);
    return buildState();
  });
  ipcMain.handle('rundown:saveAs', async () => {
    await saveDialog(true);
    return buildState();
  });
}

/**
 * Show-Integration: Wird Rundown über einen Show-Deep-Link gestartet, lädt es den
 * Ablauf aus der Show. Zwei Quellen, in dieser Reihenfolge:
 *  1. Referenziert die Show ein eigenes `.jmrundown` (ShowToolRef.document von
 *     jm-rundown), gewinnt dieses — voller Ablauf inkl. GO-Aktionen.
 *  2. Sonst der ZENTRALE Show-Ablauf (#78, show.ablauf): die Programmpunkte
 *     werden zu Zeilen (ohne Aktionen). So muss der Ablauf nur einmal beim
 *     Erstellen der Show gepflegt werden, nicht separat in Rundown.
 */
function applyShowFromDeepLink(url: string): void {
  const showPath = parseShowDeepLink(url);
  if (!showPath) return;
  try {
    const show = parseShow(readFileSync(showPath, 'utf8'));
    const ref = show.tools.find((t) => t.appId === 'jm-rundown');
    if (ref?.document) {
      index = 0;
      lastFired = null;
      setDoc(readDoc(ref.document), ref.document, false);
    } else if (show.ablauf && show.ablauf.length) {
      index = 0;
      lastFired = null;
      setDoc(docFromAblauf(show.name, show.ablauf), null, false);
    }
  } catch (err) {
    getLog().error(`Show-Deep-Link konnte nicht geladen werden: ${(err as Error).message}`);
  }
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
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#121212',
    show: false,
    title: 'JM Rundown',
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

// Geteilter Runtime-Layer: Logging, Crash-Handler, Deep-Links, Presence.
const runtime = initAppRuntime({ csp: true,
  appId: 'jm-rundown',
  appName: 'JM Rundown',
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
    // Letzten Stand wiederherstellen (sofern kein Deep-Link kommt).
    const saved = loadAutosave();
    if (saved) doc = saved;
    registerIpc();
    createMainWindow();
    if (runtime.initialDeepLink) applyShowFromDeepLink(runtime.initialDeepLink);
    // start() zuerst: liest die geteilte Steuer-Konfig (Token/TLS für secure-Modus),
    // bevor setOverrides die ersten Clients erzeugt — sonst verbänden sie plain.
    conductor.start(app.getPath('appData'));
    conductor.setOverrides(getOverrides());
    // Eigener Steuerserver: Rundown selbst per Companion fern-GO-bar (Port 8731).
    void startControlServer({ getState: buildSuiteState, onCommand: handleSuiteCommand });
  });

  app.on('before-quit', () => {
    conductor.stop();
    stopControlServer();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
