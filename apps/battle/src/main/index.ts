import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import path, { join } from 'node:path';
import { mkdirSync, readFileSync } from 'node:fs';
import { initAppRuntime, getLog } from '@jm/app-runtime';
import { parseShow, parseShowDeepLink } from '@jm/show';
import { RemoteServer } from '@jm/remote';
import { readControlConfig } from '@jm/control-config';
import type { SuiteCommand, SuiteState } from '@jm/suite-control-protocol';
import type { BattleConfig, BattleState, ClipJob, Competitor, RoundResult, Side, ToolLink } from '@shared/types';
import {
  addVote,
  clampRound,
  clearVotes,
  decided,
  encodeToken,
  juryWins,
  makeRounds,
  overallWinner,
  resizeRounds,
  setJuryWinner,
  voteLeader,
  voteTotals,
} from '@shared/scoring';
import { Coupling } from './coupling';
import {
  getCompetitors,
  getConfig,
  getOverrides,
  patchConfig,
  setCompetitors,
  setOverride,
} from './config';
import { startControlServer, stopControlServer, pushControlState, resolveMode } from './control-server';
import { REMOTE_PAGE } from './remote-page';
import { makeClip } from './clip';

declare const __dirname: string;

const REMOTE_PORT = 7783;
let mainWindow: BrowserWindow | null = null;
const preloadPath = join(__dirname, '../preload/index.cjs');

// P1 (#59): geteiltes Suite-Token aus der control.json (vom Launcher provisioniert).
// Gesetzt → die Voting-Endpunkte (/state,/events,/cmd) verlangen es; der QR-Link
// trägt ?t=<token>, die Seite reicht es bei jedem Aufruf mit. Fehlt es (open-Modus)
// → unverändertes Verhalten ohne Token. readControlConfig ist fehlertolerant ({}).
const suiteToken = readControlConfig(app.getPath('appData')).token;

/** Token an die LAN-URLs hängen, damit QR/Anzeige die Publikums-Clients berechtigen. */
function withRemoteToken(urls: string[]): string[] {
  const t = suiteToken;
  if (!t) return urls;
  return urls.map((u) => `${u}/?t=${encodeURIComponent(t)}`);
}

// ── Live-Zustand (Runde/Stimmen/VS sind nicht persistiert) ────────────────────
let competitors = getCompetitorsSafe();
let rounds: RoundResult[] = makeRounds(getConfig().rounds);
let round = 1;
let votingOpen = false;
let live = false;
let clips: ClipJob[] = [];
let remoteRunning = false;
let remoteUrls: string[] = [];

function getCompetitorsSafe(): { A: Competitor; B: Competitor } {
  // Vor app.ready ist userData ggf. nicht lesbar → erst nach ready laden.
  try {
    return getCompetitors();
  } catch {
    return { A: { name: 'Kontrahent A', crew: '' }, B: { name: 'Kontrahent B', crew: '' } };
  }
}

const coupling = new Coupling(() => broadcastLinks());

const remote = new RemoteServer({
  port: REMOTE_PORT,
  page: REMOTE_PAGE,
  token: suiteToken,
  getState: () => publicRemoteState(),
  onCommand: (cmd) => handleVote(cmd),
});

function publicRemoteState(): Record<string, unknown> {
  return {
    round,
    rounds: rounds.length,
    votingOpen,
    votingEnabled: getConfig().votingEnabled,
    A: competitors.A.name,
    B: competitors.B.name,
    crewA: competitors.A.crew,
    crewB: competitors.B.crew,
  };
}

function resourcePath(filename: string): string {
  if (app.isPackaged) return path.join(process.resourcesPath, filename);
  return path.join(__dirname, '..', '..', 'resources', filename);
}

function buildState(): BattleState {
  return {
    config: getConfig(),
    competitors,
    round,
    rounds,
    votingOpen,
    live,
    remote: { running: remoteRunning, urls: remoteUrls },
    links: coupling.snapshot(),
    overrides: getOverrides(),
    clips,
  };
}

function broadcast(): void {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('battle:state', buildState());
  pushControlState(buildSuiteState());
  if (remoteRunning) remote.broadcast(publicRemoteState());
}

let linksTimer: ReturnType<typeof setTimeout> | null = null;
function broadcastLinks(): void {
  if (linksTimer) return;
  linksTimer = setTimeout(() => {
    linksTimer = null;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('battle:links', coupling.snapshot() as ToolLink[]);
    }
  }, 100);
}

// ── Suite-Steuerprotokoll (Companion) ─────────────────────────────────────────
function buildSuiteState(): SuiteState {
  const w = juryWins(rounds);
  const v = voteTotals(rounds);
  return {
    ns: 'battle',
    kv: {
      round,
      total: rounds.length,
      wins_a: w.A,
      wins_b: w.B,
      votes_a: v.A,
      votes_b: v.B,
      voting: votingOpen,
      live,
      leader: decided(rounds) ? overallWinner(rounds) : '-',
      vote_leader: voteLeader(rounds),
    },
  };
}

function handleSuiteCommand(cmd: SuiteCommand): void {
  switch (cmd.verb) {
    case 'next':
      doGotoRound(round + 1);
      break;
    case 'prev':
      doGotoRound(round - 1);
      break;
    case 'win': {
      const a = String(cmd.args[0] ?? '').toLowerCase();
      const winner = a === 'a' ? 'A' : a === 'b' ? 'B' : a === 'tie' ? 'tie' : null;
      if (winner !== null) doSetJuryWinner(round, winner);
      break;
    }
    case 'voting':
      doSetVotingOpen(resolveMode(cmd.args[0], votingOpen));
      break;
    case 'vs':
      doSetLive(resolveMode(cmd.args[0], live));
      break;
    case 'replay':
      void doClip();
      break;
    case 'reset':
      doReset();
      break;
  }
}

// ── Titler-Kopplung (VS-Bauchbinde) ───────────────────────────────────────────
function fireTitler(verb: string, ...args: (string | number)[]): void {
  coupling.fire('titler', `TITLER ${verb.toUpperCase()}${args.length ? ' ' + args.join(' ') : ''}`);
}
function applyVs(): void {
  if (!getConfig().autoTitler) return;
  fireTitler('template', 'lowerthird');
  // name = "A_vs_B" (whitespace-frei), subtitle = "Runde_N". Vorwärtskompatibel:
  // ein Titler ohne text-Verb ignoriert die Zeile, take/clear wirkt trotzdem.
  fireTitler('text', `${encodeToken(competitors.A.name)}_vs_${encodeToken(competitors.B.name)}`, `Runde_${round}`);
  fireTitler('take');
}
function clearVs(): void {
  if (getConfig().autoTitler) fireTitler('clear');
}

// ── Operationen ───────────────────────────────────────────────────────────────
function doGotoRound(n: number): void {
  round = clampRound(n, rounds.length);
  votingOpen = false; // Rundenwechsel schließt das Voting (Operator öffnet neu).
  if (live) applyVs();
  broadcast();
}

function doSetJuryWinner(r: number, winner: Side | 'tie' | null): void {
  rounds = setJuryWinner(rounds, r, winner);
  broadcast();
}

function doSetVotingOpen(open: boolean): void {
  votingOpen = open && getConfig().votingEnabled;
  broadcast();
}

function doSetLive(v: boolean): void {
  live = v;
  if (v) applyVs();
  else clearVs();
  broadcast();
}

function doReset(): void {
  rounds = makeRounds(getConfig().rounds);
  round = 1;
  votingOpen = false;
  if (live) {
    live = false;
    clearVs();
  }
  broadcast();
}

function handleVote(cmd: unknown): void {
  const c = cmd as { type?: string; side?: string; round?: number } | null;
  if (!c || c.type !== 'vote') return;
  if (!votingOpen || !getConfig().votingEnabled) return;
  const side = c.side === 'A' ? 'A' : c.side === 'B' ? 'B' : null;
  if (!side) return;
  // Nur Stimmen für die aktuelle Runde zählen (verspätete Stimmen verwerfen).
  if (typeof c.round === 'number' && c.round !== round) return;
  rounds = addVote(rounds, round, side);
  broadcast();
}

async function doClip(seconds?: number): Promise<void> {
  const cfg = getConfig();
  const secs = Math.max(1, Math.round(seconds ?? cfg.clipSeconds));
  const dir = cfg.clipDir || join(app.getPath('videos'), 'JM Battle Clips');
  try {
    mkdirSync(dir, { recursive: true });
  } catch {
    /* best-effort */
  }
  const id = `c${Date.now()}`;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const job: ClipJob = { id, status: 'running', outputPath: '', seconds: secs, at: Date.now() };
  clips = [job, ...clips].slice(0, 6);
  broadcast();

  const res = await makeClip({ recordingPath: cfg.recordingPath, clipDir: dir, seconds: secs, outBase: `replay-R${round}-${stamp}` });
  clips = clips.map((j) => (j.id === id ? { ...j, status: res.ok ? 'done' : 'error', outputPath: res.outputPath, error: res.error } : j));
  if (res.ok) getLog().info(`Battle-Replay: ${res.outputPath}`);
  else getLog().warn(`Battle-Replay fehlgeschlagen: ${res.error ?? ''}`);
  broadcast();
}

async function setRemote(enabled: boolean): Promise<void> {
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
    getLog().error(`Battle-Voting: ${(err as Error).message}`);
  }
  broadcast();
}

// ── IPC ───────────────────────────────────────────────────────────────────────
function registerIpc(): void {
  ipcMain.handle('battle:getState', () => buildState());

  ipcMain.handle('battle:setCompetitor', (_e, side: Side, patch: Partial<Competitor>) => {
    competitors = { ...competitors, [side]: { ...competitors[side], ...patch } };
    setCompetitors(competitors);
    if (live) applyVs();
    broadcast();
    return buildState();
  });
  ipcMain.handle('battle:swapCompetitors', () => {
    competitors = { A: competitors.B, B: competitors.A };
    setCompetitors(competitors);
    if (live) applyVs();
    broadcast();
    return buildState();
  });

  ipcMain.handle('battle:nextRound', () => {
    doGotoRound(round + 1);
    return buildState();
  });
  ipcMain.handle('battle:prevRound', () => {
    doGotoRound(round - 1);
    return buildState();
  });
  ipcMain.handle('battle:gotoRound', (_e, n: number) => {
    doGotoRound(n);
    return buildState();
  });
  ipcMain.handle('battle:setJuryWinner', (_e, r: number, winner: Side | 'tie' | null) => {
    doSetJuryWinner(r, winner);
    return buildState();
  });
  ipcMain.handle('battle:setVotingOpen', (_e, open: boolean) => {
    doSetVotingOpen(open);
    return buildState();
  });
  ipcMain.handle('battle:clearVotes', (_e, r: number) => {
    rounds = clearVotes(rounds, r);
    broadcast();
    return buildState();
  });
  ipcMain.handle('battle:setLive', (_e, v: boolean) => {
    doSetLive(v);
    return buildState();
  });
  ipcMain.handle('battle:reset', () => {
    doReset();
    return buildState();
  });

  ipcMain.handle('battle:setConfig', (_e, patch: Partial<BattleConfig>) => {
    const next = patchConfig(patch);
    if (patch.rounds !== undefined) {
      rounds = resizeRounds(rounds, next.rounds);
      round = clampRound(round, rounds.length);
    }
    broadcast();
    return buildState();
  });
  ipcMain.handle('battle:setRemote', async (_e, enabled: boolean) => {
    await setRemote(enabled);
    return buildState();
  });
  ipcMain.handle('battle:setEndpoint', (_e, role: string, host: string, port: number) => {
    coupling.setOverrides(setOverride(role, host || null, Number.isFinite(port) ? port : null));
    broadcast();
    return buildState();
  });

  ipcMain.handle('battle:pickRecording', async () => {
    const r = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Video/Audio', extensions: ['mp4', 'mov', 'mkv', 'm4v', 'avi', 'wav', 'mp3', 'm4a', 'flac'] }],
    });
    if (!r.canceled && r.filePaths[0]) {
      patchConfig({ recordingPath: r.filePaths[0] });
      broadcast();
    }
    return buildState();
  });
  ipcMain.handle('battle:pickClipDir', async () => {
    const r = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
    if (!r.canceled && r.filePaths[0]) {
      patchConfig({ clipDir: r.filePaths[0] });
      broadcast();
    }
    return buildState();
  });
  ipcMain.handle('battle:clip', async (_e, seconds?: number) => {
    await doClip(seconds);
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
    width: 1200,
    height: 820,
    minWidth: 980,
    minHeight: 660,
    backgroundColor: '#0e0e10',
    show: false,
    title: 'JM Battle',
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
 * Show-Integration: Wird Battle über einen Show-Deep-Link gestartet, übernimmt es
 * aus der Show (ShowToolRef.settings von jm-battle) die Rundenzahl und die
 * Kontrahenten-Namen — so startet das Event mit der richtigen Paarung.
 */
function applyShowFromDeepLink(url: string): void {
  const showPath = parseShowDeepLink(url);
  if (!showPath) return;
  try {
    const show = parseShow(readFileSync(showPath, 'utf8'));
    const s = show.tools.find((t) => t.appId === 'jm-battle')?.settings;
    if (!s) return;
    if (typeof s.rounds === 'number') {
      const next = patchConfig({ rounds: Math.max(1, Math.round(s.rounds)) });
      rounds = resizeRounds(rounds, next.rounds);
      round = clampRound(round, rounds.length);
    }
    const A: Competitor = { ...competitors.A };
    const B: Competitor = { ...competitors.B };
    if (typeof s.nameA === 'string' && s.nameA.trim()) A.name = s.nameA.trim();
    if (typeof s.nameB === 'string' && s.nameB.trim()) B.name = s.nameB.trim();
    if (typeof s.crewA === 'string') A.crew = s.crewA;
    if (typeof s.crewB === 'string') B.crew = s.crewB;
    competitors = { A, B };
    setCompetitors(competitors);
    broadcast();
  } catch (err) {
    getLog().error(`Show-Deep-Link konnte nicht geladen werden: ${(err as Error).message}`);
  }
}

const runtime = initAppRuntime({ csp: true,
  appId: 'jm-battle',
  appName: 'JM Battle',
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
    competitors = getCompetitors();
    rounds = makeRounds(getConfig().rounds);
    registerIpc();
    createMainWindow();
    if (runtime.initialDeepLink) applyShowFromDeepLink(runtime.initialDeepLink);
    coupling.setOverrides(getOverrides());
    coupling.start();
    void startControlServer({ getState: buildSuiteState, onCommand: handleSuiteCommand });
  });

  app.on('before-quit', () => {
    coupling.stop();
    stopControlServer();
    void remote.stop();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
