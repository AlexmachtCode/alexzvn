import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path, { join } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import { initAppRuntime, getLog } from '@jm/app-runtime';
import { parseShow, parseShowDeepLink } from '@jm/show';
import { RemoteServer } from '@jm/remote';
import { readControlConfig } from '@jm/control-config';
import type { SuiteCommand, SuiteState } from '@jm/suite-control-protocol';
import type { QaCloudInfo, QaConfig, QaEntry, QaState, QaSubmission, ToolLink } from '@shared/types';
import {
  activate,
  activeEntry,
  clearDone,
  encodeToken,
  endActive,
  makeEntry,
  move,
  newEntryId,
  nextWaiting,
  remove,
  setApproved,
  updateEntry,
  waitingCount,
} from '@shared/queue';
import { Coupling } from './coupling';
import { getConfig, getOverrides, patchConfig, setOverride } from './config';
import { startControlServer, stopControlServer, pushControlState } from './control-server';
import { REMOTE_PAGE } from './remote-page';
import {
  type CloudCfg,
  type CloudSecrets,
  ackItems,
  generateKeypair,
  loadSecrets,
  openEvent,
  pollPending,
  pressUrl,
  purgeEvent,
  randomEventId,
  saveSecrets,
  streamUrl,
} from './cloud';

declare const __dirname: string;

const REMOTE_PORT = 7782;
let mainWindow: BrowserWindow | null = null;
const preloadPath = join(__dirname, '../preload/index.cjs');

// P1 (#59): geteiltes Suite-Token aus der control.json (vom Launcher provisioniert).
// Gesetzt → die Saal-Endpunkte (/state,/events,/cmd) verlangen es; der QR-Link trägt
// ?t=<token>, die Seite reicht es bei jedem Aufruf mit. Fehlt es (open-Modus) →
// unverändertes Verhalten ohne Token. readControlConfig ist fehlertolerant ({}).
const suiteToken = readControlConfig(app.getPath('appData')).token;

/** Token an die LAN-URLs hängen, damit QR/Anzeige die Saal-Clients berechtigen. */
function withRemoteToken(urls: string[]): string[] {
  const t = suiteToken;
  if (!t) return urls;
  return urls.map((u) => `${u}/?t=${encodeURIComponent(t)}`);
}

// ── Autoritativer Zustand (lebt im Main, damit Steuerserver/Companion + die
//    Saal-Einreichung darauf wirken) ──────────────────────────────────────────
let entries: QaEntry[] = [];
let remoteRunning = false;
let remoteUrls: string[] = [];

// Externe Einreichung (Cloud-Relay, #166). Secrets (Private Key + Proxy-Key)
// leben nur hier im Main, nie im Renderer. Erst in whenReady() geladen (safeStorage).
let cloudSecrets: CloudSecrets = { publicJwk: null, privateJwk: null, proxyKey: '' };
let cloudTimer: ReturnType<typeof setInterval> | null = null;
let cloudError: string | null = null;
let cloudLastPollAt: number | null = null;

const coupling = new Coupling(() => broadcastLinks());

const remote = new RemoteServer({
  port: REMOTE_PORT,
  page: REMOTE_PAGE,
  token: suiteToken,
  getState: () => publicRemoteState(),
  onCommand: (cmd) => handleRemoteSubmit(cmd),
});

function publicRemoteState(): { accepting: boolean; waiting: number } {
  return { accepting: true, waiting: waitingCount(entries, getConfig().moderation) };
}

function resourcePath(filename: string): string {
  if (app.isPackaged) return path.join(process.resourcesPath, filename);
  return path.join(__dirname, '..', '..', 'resources', filename);
}

function cloudCfg(): CloudCfg {
  const c = getConfig();
  return {
    proxyUrl: c.proxyUrl,
    eventId: c.eventId,
    pressCode: c.pressCode,
    streamOpen: c.streamOpen,
    pressOpen: c.pressOpen,
  };
}

function buildCloudInfo(): QaCloudInfo {
  const c = getConfig();
  const cfg = cloudCfg();
  const configured = !!(c.proxyUrl && c.eventId && cloudSecrets.publicJwk && cloudSecrets.proxyKey);
  return {
    enabled: cloudTimer != null,
    configured,
    eventId: c.eventId,
    proxyUrl: c.proxyUrl,
    streamUrl: streamUrl(cfg),
    pressUrl: pressUrl(cfg),
    pressCode: c.pressCode,
    streamOpen: c.streamOpen,
    pressOpen: c.pressOpen,
    hasKey: !!cloudSecrets.proxyKey,
    lastError: cloudError,
    lastPollAt: cloudLastPollAt,
  };
}

function buildState(): QaState {
  return {
    entries,
    activeId: activeEntry(entries)?.id ?? null,
    config: getConfig(),
    remote: { running: remoteRunning, urls: remoteUrls },
    cloud: buildCloudInfo(),
    links: coupling.snapshot(),
    overrides: getOverrides(),
  };
}

// ── Queue-Persistenz (#166) ───────────────────────────────────────────────────
// Presse-Vorab-Fragen sammeln sich vor dem Event an; damit sie einen Neustart
// überstehen (und abgeholte Cloud-Einträge nicht verloren gehen), wird die Queue
// auf Platte gesichert. Beim Laden wird ein evtl. „aktiver" Sprecher auf „wartend"
// zurückgesetzt (nach Neustart ist niemand live).
function entriesPath(): string {
  return join(app.getPath('userData'), 'qa.entries.json');
}
let persistTimer: ReturnType<typeof setTimeout> | null = null;
function persistEntries(): void {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    try {
      writeFileSync(entriesPath(), JSON.stringify(entries));
    } catch (err) {
      getLog().error(`Q&A: Queue speichern fehlgeschlagen: ${(err as Error).message}`);
    }
  }, 200);
}
function loadEntries(): void {
  try {
    const raw = JSON.parse(readFileSync(entriesPath(), 'utf8')) as QaEntry[];
    if (Array.isArray(raw)) {
      entries = raw.map((e) => (e.status === 'active' ? { ...e, status: 'waiting' } : e));
    }
  } catch {
    /* keine gespeicherte Queue → leer starten */
  }
}

function broadcast(): void {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('qa:state', buildState());
  pushControlState(buildSuiteState());
  if (remoteRunning) remote.broadcast(publicRemoteState());
  persistEntries();
}

// ── Externe Einreichung: Poll / Ingest (#166) ─────────────────────────────────
/** Abgeholte, entschlüsselte Einreichungen in die Moderations-Queue übernehmen. */
async function cloudPollTick(): Promise<void> {
  const cfg = cloudCfg();
  if (!cfg.proxyUrl || !cfg.eventId) return;
  try {
    const items = await pollPending(cfg, cloudSecrets);
    cloudError = null;
    cloudLastPollAt = Date.now();
    if (items.length) {
      const cfgQa = getConfig();
      const acked: string[] = [];
      for (const it of items) {
        // Deterministische ID → idempotent (Neu-Abruf nach Absturz vor dem ACK
        // erzeugt keine Dubletten).
        const id = `c_${it.itemId}`;
        acked.push(it.itemId);
        if (entries.some((e) => e.id === id)) continue;
        const sub: QaSubmission = {
          name: it.name,
          affiliation: it.affiliation,
          question: it.question,
          contact: it.contact,
        };
        // Externe Einreichungen sind IMMER moderationspflichtig (approved:false),
        // unabhängig vom Saal-Moderations-Flag (#166, User-Vorgabe Presse-Security).
        entries = [...entries, makeEntry(sub, 'remote', false, id, it.at, it.channel)];
        getLog().info(`Q&A: ${it.channel === 'press' ? 'Presse' : 'Stream'}-Frage „${it.name}" (wartet auf Freigabe)`);
      }
      // Im Relay quittieren (löschen) — auch bereits bekannte, damit sie nicht
      // erneut geliefert werden.
      await ackItems(cfg, cloudSecrets, acked);
      broadcast();
    } else {
      broadcast();
    }
  } catch (err) {
    cloudError = (err as Error).message;
    broadcast();
  }
}

function startCloudPoll(): void {
  if (cloudTimer) return;
  cloudTimer = setInterval(() => void cloudPollTick(), 5000);
  void cloudPollTick();
}
function stopCloudPoll(): void {
  if (cloudTimer) {
    clearInterval(cloudTimer);
    cloudTimer = null;
  }
}

/** Externe Einreichung starten/stoppen: Event öffnen + Polling. */
async function cloudEnable(enabled: boolean): Promise<void> {
  patchConfig({ cloudEnabled: enabled });
  cloudError = null;
  if (enabled) {
    const cfg = cloudCfg();
    if (!cfg.proxyUrl || !cfg.eventId || !cloudSecrets.publicJwk || !cloudSecrets.proxyKey) {
      cloudError = 'Nicht vollständig konfiguriert (Proxy-URL, Key, Event fehlen).';
      patchConfig({ cloudEnabled: false });
      broadcast();
      return;
    }
    try {
      await openEvent(cfg, cloudSecrets);
      startCloudPoll();
    } catch (err) {
      cloudError = (err as Error).message;
      patchConfig({ cloudEnabled: false });
    }
  } else {
    stopCloudPoll();
    // Kanäle schließen (Best effort), damit ohne Polling nichts mehr angenommen wird.
    try {
      await openEvent({ ...cloudCfg(), streamOpen: false, pressOpen: false }, cloudSecrets);
    } catch {
      /* offline o. ä. — egal */
    }
  }
  broadcast();
}

/** Neues Event erzeugen: frische Event-ID + Schlüsselpaar (alte Daten aufgeben). */
async function cloudGenerateEvent(): Promise<void> {
  const { publicJwk, privateJwk } = await generateKeypair();
  cloudSecrets = { ...cloudSecrets, publicJwk, privateJwk };
  saveSecrets(app.getPath('userData'), cloudSecrets);
  patchConfig({ eventId: randomEventId() });
  cloudError = null;
  broadcast();
}

/** Event-Daten im Relay löschen (Ende des Events). Stoppt auch das Polling. */
async function cloudPurge(): Promise<void> {
  stopCloudPoll();
  patchConfig({ cloudEnabled: false });
  try {
    await purgeEvent(cloudCfg(), cloudSecrets);
  } catch (err) {
    cloudError = (err as Error).message;
  }
  broadcast();
}

// Tally/Verbindungen (z. B. Timer-Tick 1×/s) ändern sich häufig → nur die Links
// separat und gedrosselt senden, nicht den ganzen State.
let linksTimer: ReturnType<typeof setTimeout> | null = null;
function broadcastLinks(): void {
  if (linksTimer) return;
  linksTimer = setTimeout(() => {
    linksTimer = null;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('qa:links', coupling.snapshot() as ToolLink[]);
    }
  }, 100);
}

// ── Suite-Steuerprotokoll (Companion liest active/waiting/…) ──────────────────
function buildSuiteState(): SuiteState {
  const active = activeEntry(entries);
  return {
    ns: 'qa',
    kv: {
      active: active ? encodeToken(active.name) : '-',
      waiting: waitingCount(entries, getConfig().moderation),
      total: entries.length,
      live: !!active,
      remote: remoteRunning,
    },
  };
}

function handleSuiteCommand(cmd: SuiteCommand): void {
  switch (cmd.verb) {
    case 'next':
      doNext();
      break;
    case 'end':
      doEnd();
      break;
    case 'clear':
      doClearDone();
      break;
    case 'extend': {
      const s = Number(cmd.args[0]);
      fireTimer('add', Number.isFinite(s) ? Math.trunc(s) : 30);
      break;
    }
  }
}

// ── Tool-Kopplung (Titler-Bauchbinde + Redezeit-Timer) ────────────────────────
function line(role: string, verb: string, ...args: (string | number)[]): string {
  return `${role.toUpperCase()} ${verb.toUpperCase()}${args.length ? ' ' + args.join(' ') : ''}`;
}
function fireTimer(verb: string, ...args: (string | number)[]): void {
  coupling.fire('timer', line('timer', verb, ...args));
}
function fireTitler(verb: string, ...args: (string | number)[]): void {
  coupling.fire('titler', line('titler', verb, ...args));
}

/** Aktiven Sprecher einblenden: Bauchbinde mit Name/Funktion + Redezeit starten. */
function applyCouplingActivate(entry: QaEntry): void {
  const cfg = getConfig();
  if (cfg.autoTitler) {
    fireTitler('template', cfg.titlerTemplate);
    // TITLER TEXT <name> <funktion> — Tokens whitespace-frei kodiert (Titler
    // dekodiert '_' → Space). Alter Titler ohne text-Verb ignoriert die Zeile.
    fireTitler('text', encodeToken(entry.name), encodeToken(entry.affiliation));
    fireTitler('take');
  }
  if (cfg.autoTimer) {
    fireTimer('set', Math.max(1, Math.round(cfg.speakSeconds)));
    fireTimer('start');
  }
}

/** Aktiven Sprecher ausblenden: Bauchbinde raus + Timer stoppen. */
function applyCouplingEnd(): void {
  const cfg = getConfig();
  if (cfg.autoTitler) fireTitler('clear');
  if (cfg.autoTimer) fireTimer('stop');
}

// ── Queue-Operationen (broadcasten den neuen Zustand) ─────────────────────────
function doActivate(id: string): void {
  if (!entries.some((e) => e.id === id)) return;
  entries = activate(entries, id);
  const a = activeEntry(entries);
  if (a) {
    applyCouplingActivate(a);
    getLog().info(`Q&A: „${a.name}" scharf (${a.affiliation || 'ohne Funktion'})`);
  }
  broadcast();
}

function doEnd(): void {
  if (!activeEntry(entries)) return;
  entries = endActive(entries);
  applyCouplingEnd();
  broadcast();
}

function doNext(): void {
  const cfg = getConfig();
  const nxt = nextWaiting(entries, cfg.moderation);
  if (nxt) doActivate(nxt.id);
  else doEnd();
}

function doClearDone(): void {
  entries = clearDone(entries);
  broadcast();
}

function doClearAll(): void {
  const hadActive = !!activeEntry(entries);
  entries = [];
  if (hadActive) applyCouplingEnd();
  broadcast();
}

function handleRemoteSubmit(cmd: unknown): void {
  const c = cmd as { type?: string; name?: string; affiliation?: string; question?: string } | null;
  if (!c || c.type !== 'submit' || typeof c.name !== 'string' || !c.name.trim()) return;
  const cfg = getConfig();
  const sub: QaSubmission = { name: c.name, affiliation: c.affiliation, question: c.question };
  entries = [...entries, makeEntry(sub, 'remote', !cfg.moderation, newEntryId(), Date.now())];
  getLog().info(`Q&A: Saal-Einreichung „${sub.name.trim()}"${cfg.moderation ? ' (wartet auf Freigabe)' : ''}`);
  broadcast();
}

async function setRemote(enabled: boolean): Promise<void> {
  patchConfig({ remoteEnabled: enabled });
  try {
    if (enabled) {
      const addr = await remote.start();
      remoteRunning = true;
      remoteUrls = withRemoteToken(addr.urls);
    } else {
      await remote.stop();
      remoteRunning = false;
      remoteUrls = [];
    }
  } catch (err) {
    getLog().error(`Q&A Saal-Einreichung: ${(err as Error).message}`);
  }
  broadcast();
}

// ── IPC ───────────────────────────────────────────────────────────────────────
function registerIpc(): void {
  ipcMain.handle('qa:getState', () => buildState());

  ipcMain.handle('qa:addEntry', (_e, sub: QaSubmission) => {
    entries = [...entries, makeEntry(sub, 'operator', true, newEntryId(), Date.now())];
    broadcast();
    return buildState();
  });
  ipcMain.handle('qa:updateEntry', (_e, id: string, patch: QaSubmission) => {
    entries = updateEntry(entries, id, patch);
    broadcast();
    return buildState();
  });
  ipcMain.handle('qa:removeEntry', (_e, id: string) => {
    const wasActive = activeEntry(entries)?.id === id;
    entries = remove(entries, id);
    if (wasActive) applyCouplingEnd();
    broadcast();
    return buildState();
  });
  ipcMain.handle('qa:moveEntry', (_e, id: string, dir: -1 | 1) => {
    entries = move(entries, id, dir === 1 ? 1 : -1);
    broadcast();
    return buildState();
  });
  ipcMain.handle('qa:approveEntry', (_e, id: string, approved: boolean) => {
    entries = setApproved(entries, id, approved);
    broadcast();
    return buildState();
  });

  ipcMain.handle('qa:activate', (_e, id: string) => {
    doActivate(id);
    return buildState();
  });
  ipcMain.handle('qa:next', () => {
    doNext();
    return buildState();
  });
  ipcMain.handle('qa:endActive', () => {
    doEnd();
    return buildState();
  });
  ipcMain.handle('qa:clearDone', () => {
    doClearDone();
    return buildState();
  });
  ipcMain.handle('qa:clearAll', () => {
    doClearAll();
    return buildState();
  });

  ipcMain.handle('qa:setConfig', (_e, patch) => {
    patchConfig(patch);
    broadcast();
    return buildState();
  });
  ipcMain.handle('qa:setRemote', async (_e, enabled: boolean) => {
    await setRemote(enabled);
    return buildState();
  });
  ipcMain.handle('qa:setEndpoint', (_e, role: string, host: string, port: number) => {
    coupling.setOverrides(setOverride(role, host || null, Number.isFinite(port) ? port : null));
    broadcast();
    return buildState();
  });

  // ── Externe Einreichung (Cloud-Relay, #166) ──────────────────────────────────
  ipcMain.handle('qa:setCloudConfig', async (_e, patch: Partial<QaConfig>) => {
    // Nur nicht-geheime Felder zulassen (Secrets laufen über setProxyKey).
    const allowed: Partial<QaConfig> = {};
    if (typeof patch.proxyUrl === 'string') allowed.proxyUrl = patch.proxyUrl.trim();
    if (typeof patch.pressCode === 'string') allowed.pressCode = patch.pressCode.trim();
    if (typeof patch.streamOpen === 'boolean') allowed.streamOpen = patch.streamOpen;
    if (typeof patch.pressOpen === 'boolean') allowed.pressOpen = patch.pressOpen;
    patchConfig(allowed);
    // Läuft das Event bereits, Änderungen (Flags/Code) sofort hochschieben.
    if (cloudTimer && cloudSecrets.publicJwk) {
      try {
        await openEvent(cloudCfg(), cloudSecrets);
        cloudError = null;
      } catch (err) {
        cloudError = (err as Error).message;
      }
    }
    broadcast();
    return buildState();
  });
  ipcMain.handle('qa:setProxyKey', (_e, key: string) => {
    cloudSecrets = { ...cloudSecrets, proxyKey: String(key || '').trim() };
    saveSecrets(app.getPath('userData'), cloudSecrets);
    broadcast();
    return buildState();
  });
  ipcMain.handle('qa:cloudGenerateEvent', async () => {
    await cloudGenerateEvent();
    return buildState();
  });
  ipcMain.handle('qa:cloudEnable', async (_e, enabled: boolean) => {
    await cloudEnable(!!enabled);
    return buildState();
  });
  ipcMain.handle('qa:cloudPurge', async () => {
    await cloudPurge();
    return buildState();
  });
}

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
    width: 1180,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#121212',
    show: false,
    title: 'JM Q&A',
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

/**
 * Show-Integration: Wird Q&A über einen Show-Deep-Link gestartet, übernimmt es aus
 * der Show (ShowToolRef.settings von jm-qa) die Sitzungs-Vorgaben — Redezeit,
 * Moderation und Auto-Kopplung. So startet die Pressekonferenz korrekt eingestellt.
 */
function applyShowFromDeepLink(url: string): void {
  const showPath = parseShowDeepLink(url);
  if (!showPath) return;
  try {
    const show = parseShow(readFileSync(showPath, 'utf8'));
    const s = show.tools.find((t) => t.appId === 'jm-qa')?.settings;
    if (!s) return;
    const patch: Partial<QaConfig> = {};
    if (typeof s.speakSeconds === 'number') patch.speakSeconds = Math.max(0, Math.round(s.speakSeconds));
    if (typeof s.moderation === 'boolean') patch.moderation = s.moderation;
    if (typeof s.autoTimer === 'boolean') patch.autoTimer = s.autoTimer;
    if (typeof s.autoTitler === 'boolean') patch.autoTitler = s.autoTitler;
    if (Object.keys(patch).length) {
      patchConfig(patch);
      broadcast();
    }
  } catch (err) {
    getLog().error(`Show-Deep-Link konnte nicht geladen werden: ${(err as Error).message}`);
  }
}

// Geteilter Runtime-Layer: Logging, Crash-Handler, Deep-Links, Presence.
const runtime = initAppRuntime({ csp: true,
  appId: 'jm-qa',
  appName: 'JM Q&A',
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
    // Gespeicherte Queue + Cloud-Geheimnisse laden (safeStorage ist erst jetzt bereit).
    loadEntries();
    cloudSecrets = loadSecrets(app.getPath('userData'));
    registerIpc();
    createMainWindow();
    if (runtime.initialDeepLink) applyShowFromDeepLink(runtime.initialDeepLink);
    coupling.setOverrides(getOverrides());
    coupling.start(app.getPath('appData'));
    // Saal-Einreichung wiederherstellen, falls zuletzt aktiv.
    if (getConfig().remoteEnabled) void setRemote(true);
    // Externe Einreichung wiederherstellen, falls zuletzt aktiv (#166).
    if (getConfig().cloudEnabled) void cloudEnable(true);
    // Eigener Steuerserver: Q&A per Companion fernsteuerbar (Port 8733).
    void startControlServer({ getState: buildSuiteState, onCommand: handleSuiteCommand });
  });

  app.on('before-quit', () => {
    coupling.stop();
    stopControlServer();
    stopCloudPoll();
    void remote.stop();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
