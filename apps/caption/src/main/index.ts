import { app, BrowserWindow, ipcMain, session, shell } from 'electron';
import path, { join } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import { initAppRuntime, getLog } from '@jm/app-runtime';
import { parseShow, parseShowDeepLink } from '@jm/show';
import { whisperAvailable } from './locate';
import { enqueueUtterance, initTranscriber, stopTranscriber } from './transcriber';
import { startSender, stopSender, senderActive } from './ndi/sender-process';
import { NdiLage } from './ndi/wachhund';
import {
  startControlServer,
  stopControlServer,
  pushControlState,
  resolveMode,
} from './control-server';
import type { SuiteCommand, SuiteState } from '@jm/suite-control-protocol';
import { transcribeAblehnung } from '@shared/fernbefehl';
import { naechsteFernsteuerung, type FernsteuerungEreignis, type FernsteuerungMeldung } from '@shared/fernsteuerung';
import { pruefeKonfig } from '@shared/konfig';
import type { CaptionConfig, CaptionLine, CaptionState, CaptionStatus } from '@shared/types';
import { korrigiereZeile } from '@shared/zeilen';

declare const __dirname: string;

const MAX_LINES = 40;
const preloadPath = join(__dirname, '../preload/index.cjs');
let mainWindow: BrowserWindow | null = null;

const defaultConfig: CaptionConfig = {
  model: 'base',
  language: 'de',
  maxUtteranceSec: 8,
  silenceMs: 700,
  silenceThreshold: 0.012,
  audioInputDeviceId: '',
  dictionary: '',
  engine: 'server',
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
// Altfehler CA-4: jedes „Leeren“ zählt; der Renderer leert damit auch bei Hold die NDI-Quelle (R/lib/ndi-engine.ts, angezeigterText).
let leerungen = 0;
const status: CaptionStatus = { ndiActive: false, connections: 0, ndiSendet: false, ndiNetzName: null };

/**
 * Gemessene NDI-Lage (UX Welle 2a, E8): ndiSendet aus den Statusmeldungen des Senders mit Wachhund, ndiNetzName = Name des
 * laufenden Senders. Jede Änderung aus der Stille geht als neuer Zustand an den Renderer.
 */
const ndiLage = new NdiLage(() => broadcast());
function syncNdi(): void {
  status.ndiSendet = ndiLage.sendet;
  status.ndiNetzName = ndiLage.netzName;
}

/**
 * UX Welle 2a (Spec 3.9): die zuletzt gemeldete Lage des Steuerservers, nur lesend. null, solange nichts gemeldet wurde
 * (der Renderer zeigt dann „unbekannt“). Jede Meldung geht an alle offenen Fenster.
 */
let fernsteuerung: FernsteuerungMeldung | null = null;
function meldeFernsteuerung(e: FernsteuerungEreignis): void {
  fernsteuerung = naechsteFernsteuerung(fernsteuerung ?? undefined, e);
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send('caption:fernsteuerung', fernsteuerung);
  }
}

function configPath(): string {
  return join(app.getPath('userData'), 'caption.config.json');
}
// Altfehler CA-8 (C1): die Datei geht über pruefeKonfig auf die Vorgaben; Schrift und Max. Äußerung liegen danach in ihren Grenzen,
// was keine endliche Zahl ist, fällt auf die Vorgabe zurück.
function loadConfig(): void {
  try {
    const raw = JSON.parse(readFileSync(configPath(), 'utf8')) as Partial<CaptionConfig>;
    config = { ...defaultConfig, ...pruefeKonfig(raw) };
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
  return { running, hold, busy, whisperAvailable: whisperAvailable(), lines, leerungen, config, status, error };
}
function broadcast(): void {
  syncNdi();
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
    // Altfehler CA-11 (C2, D8): ohne Fenster nimmt nichts auf; ein Einschalten wird dann nicht ausgeführt. Der Grund steht in
    // state.error (das Fenster zeigt ihn, sobald es wieder offen ist, der nächste Start löscht ihn), dazu eine Zeile im Protokoll.
    case 'transcribe': {
      const ziel = resolveMode(arg, running);
      const a = transcribeAblehnung(arg, ziel, mainWindow !== null);
      if (a) {
        error = a.hinweis;
        getLog().warn(a.log);
        broadcast();
      } else setRunning(ziel);
      break;
    }
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
  leerungen++;
  broadcast();
}

function startNdi(name: string): void {
  if (!mainWindow) return;
  const netzName = name || config.ndiName;
  const lauf = ndiLage.starte(netzName);
  startSender(
    mainWindow,
    netzName,
    (connections) => {
      if (!ndiLage.stat(lauf)) return;
      status.connections = connections;
      broadcast();
    },
    () => {
      // Der Unterprozess ist beendet (auch Absturz): ndiActive zurück. Ein spätes exit eines früheren Senders zählt nicht.
      if (!ndiLage.ende(lauf)) return;
      status.ndiActive = false;
      status.connections = 0;
      broadcast();
    },
  );
  status.ndiActive = true;
  status.connections = 0;
  broadcast();
}

function stopNdi(): void {
  stopSender();
  ndiLage.stoppe();
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
  ipcMain.handle('caption:fernsteuerung', () => fernsteuerung);
  // Altfehler CA-8 (C1): auch vom IPC zieht pruefeKonfig Schrift und Max. Äußerung auf die Grenzen; das Feld schickt nur gültige Zahlen.
  ipcMain.handle('caption:setConfig', (_e, patch: Partial<CaptionConfig>) => {
    config = { ...config, ...pruefeKonfig(patch) };
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
  // Altfehler CA-5: die Korrektur trifft die Zeile mit dieser Kennung, auch wenn inzwischen neue Zeilen kamen; übertragen wird nur
  // bei einem Treffer (eine Zeile, die es nicht mehr gibt, ändert nichts).
  ipcMain.handle('caption:correctLine', (_e, id: string, text: string) => {
    const neu = korrigiereZeile(lines, id, text);
    if (neu) {
      lines = neu;
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
    syncNdi();
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
  // Altfehler CA-11 (C2): mit dem Fenster endet die Aufnahme (sie lebt im Renderer); danach gehen auch running und hold zurück, beides
  // überträgt (Companion running=0, hold=0). Plattformunabhängig; unter Windows und Linux endet die App danach ohnehin.
  win.on('closed', () => {
    stopSender();
    ndiLage.stoppe();
    status.ndiActive = false;
    status.connections = 0;
    syncNdi();
    mainWindow = null;
    setRunning(false);
    setHoldState(false);
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

const runtime = initAppRuntime({ csp: true,
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
    // Altfehler CA-11 (G10, neu): auf dem Mac bleibt die App ohne Fenster offen; ein Klick aufs Dock öffnet wieder eins.
    app.on('activate', () => {
      if (!mainWindow) createMainWindow();
    });
    if (runtime.initialDeepLink) applyShowFromDeepLink(runtime.initialDeepLink);
    // Eigener Steuerserver: Caption per Companion fernsteuerbar (Port 8732).
    // Ergebnis und Wurf gehen als Meldung an die Statusleiste; der Start wird nicht abgewartet.
    startControlServer({ getState: buildSuiteState, onCommand: handleSuiteCommand }, meldeFernsteuerung)
      .then((r) => {
        meldeFernsteuerung({ art: 'start', ok: r.ok, error: r.error });
        if (!r.ok) getLog().warn(`Caption-Steuerserver nicht gestartet: ${r.error ?? 'unbekannt'}`);
      })
      // Gesamtprüfung M1: Startfehler gehen auch ins Protokoll (wie beim Timer), damit sie nach der Show nachlesbar sind:
      // ein Start mit ok:false (oben, z. B. Port belegt) und ein Wurf.
      .catch((err) => {
        getLog().warn(`Caption-Steuerserver fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`);
        meldeFernsteuerung({ art: 'wurf', text: err instanceof Error ? err.message : String(err) });
      });
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
