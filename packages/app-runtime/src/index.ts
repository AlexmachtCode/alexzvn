import { app, ipcMain, BrowserWindow } from 'electron';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';

// ─────────────────────────────────────────────────────────────────────────────
// @jm/app-runtime — einmaliger Main-Prozess-Layer, den jede App ganz früh ruft.
//
// Bündelt vier Querschnitts-Themen, die sonst in jeder App fehlten:
//   1. Logging        → Datei-Logs in userData/logs mit Rotation
//   2. Crash-Handler  → uncaughtException/unhandledRejection ins Log + Marker
//   3. Deep-Links     → jmps://… / --show <pfad> parsen (OS-Handler optional)
//   4. Presence       → Heartbeat an den Launcher-Hub (Health-Dashboard)
//
// Bewusst OHNE externe Abhängigkeiten (nur node:* + electron), weil das Paket
// von electron-vite in den App-Main gebündelt wird (siehe externalizeDepsPlugin
// `exclude`) und gepackte Apps kein node_modules mitliefern.
// ─────────────────────────────────────────────────────────────────────────────

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(msg: string, ...rest: unknown[]): void;
  info(msg: string, ...rest: unknown[]): void;
  warn(msg: string, ...rest: unknown[]): void;
  error(msg: string, ...rest: unknown[]): void;
}

export interface AppRuntimeOptions {
  /** Stabile Tool-ID (z. B. "jm-timer") — für Logs, Presence, Heartbeat. */
  appId: string;
  /** Anzeigename (z. B. "JM Timer"). Default: appId. */
  appName?: string;
  /** App-Version (Default: app.getVersion()). */
  version?: string;
  /** Port, falls die App einen Server betreibt (z. B. Timer 7777). */
  servicePort?: number;
  /** Callback für eingehende Deep-Links (jmps://… oder --show <pfad>). */
  onDeepLink?: (url: string) => void;
  /**
   * Diese App als OS-Handler für `jmps://` registrieren. Standard false —
   * i. d. R. besitzt nur der Launcher das Protokoll und reicht es an die
   * Tools weiter. Andere Apps verarbeiten Deep-Links trotzdem, wenn sie damit
   * gestartet werden (argv / second-instance).
   */
  registerProtocol?: boolean;
  /** Presence-Heartbeat an den Launcher-Hub senden (Default true). */
  presence?: boolean;
  /**
   * Ladescreen anzeigen, bis das erste Fenster bereit ist (Default true).
   * Fängt den Electron-Kaltstart + Erststart-Scan ab, damit der Nutzer nicht
   * „in der Luft hängt". Schließt automatisch beim ready-to-show des ersten
   * echten Fensters (oder nach einer Sicherheits-Frist).
   */
  splash?: boolean;
  /** Untere Log-Schwelle (Default: 'debug' im Dev, sonst 'info'). */
  level?: LogLevel;
}

export interface AppRuntime {
  log: Logger;
  /** Deep-Link/Datei, mit der die App gestartet wurde (falls vorhanden). */
  initialDeepLink: string | null;
  /** Verzeichnis der Log-Dateien (userData/logs). */
  logDir: string;
}

export const PROTOCOL = 'jmps';
const DEFAULT_HUB = 'http://127.0.0.1:7799';
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB pro Datei
const MAX_FILES = 5; // main.log + main.log.1 … main.log.4
const HEARTBEAT_MS = 10_000;

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

let defaultLogger: Logger | null = null;

// ── Logging ──────────────────────────────────────────────────────────────────

function fmtArg(v: unknown): string {
  if (v instanceof Error) return v.stack ?? `${v.name}: ${v.message}`;
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function resolveLogDir(): string {
  try {
    return path.join(app.getPath('userData'), 'logs');
  } catch {
    return path.join(os.tmpdir(), 'jmps-logs');
  }
}

/** Rotiert die Datei, sobald sie MAX_BYTES überschreitet (main.log → .1 → …). */
function rotateIfNeeded(file: string): void {
  try {
    if (!existsSync(file) || statSync(file).size < MAX_BYTES) return;
    const oldest = `${file}.${MAX_FILES - 1}`;
    if (existsSync(oldest)) rmSync(oldest, { force: true });
    for (let i = MAX_FILES - 2; i >= 1; i--) {
      const src = `${file}.${i}`;
      if (existsSync(src)) renameSync(src, `${file}.${i + 1}`);
    }
    renameSync(file, `${file}.1`);
  } catch {
    /* Rotation darf niemals den Logger sprengen */
  }
}

function createLogger(opts: {
  appId: string;
  logDir: string;
  fileName: string;
  level: LogLevel;
  toConsole: boolean;
}): Logger {
  const file = path.join(opts.logDir, opts.fileName);
  const threshold = LEVEL_ORDER[opts.level];

  const write = (level: LogLevel, msg: string, rest: unknown[]): void => {
    if (LEVEL_ORDER[level] < threshold) return;
    const extra = rest.length ? ' ' + rest.map(fmtArg).join(' ') : '';
    const line = `${new Date().toISOString()} [${level.toUpperCase()}] [${opts.appId}] ${msg}${extra}\n`;
    try {
      rotateIfNeeded(file);
      appendFileSync(file, line);
    } catch {
      /* Logging darf nie werfen */
    }
    if (opts.toConsole) {
      const sink =
        level === 'error'
          ? console.error
          : level === 'warn'
            ? console.warn
            : console.log;
      sink(line.trimEnd());
    }
  };

  return {
    debug: (m, ...r) => write('debug', m, r),
    info: (m, ...r) => write('info', m, r),
    warn: (m, ...r) => write('warn', m, r),
    error: (m, ...r) => write('error', m, r),
  };
}

function consoleFallback(): Logger {
  return {
    debug: (m, ...r) => console.debug(m, ...r),
    info: (m, ...r) => console.log(m, ...r),
    warn: (m, ...r) => console.warn(m, ...r),
    error: (m, ...r) => console.error(m, ...r),
  };
}

// ── Crash-Handler ────────────────────────────────────────────────────────────

function installCrashHandlers(log: Logger, logDir: string, appId: string): void {
  const record = (kind: string, err: unknown): void => {
    const e = err instanceof Error ? err : new Error(String(err));
    log.error(`${kind}: ${e.message}`, e);
    try {
      writeFileSync(
        path.join(logDir, 'last-crash.json'),
        JSON.stringify(
          {
            appId,
            kind,
            message: e.message,
            stack: e.stack ?? null,
            at: new Date().toISOString(),
          },
          null,
          2,
        ),
      );
    } catch {
      /* Marker ist best-effort */
    }
  };

  process.on('uncaughtException', (err) => record('uncaughtException', err));
  process.on('unhandledRejection', (reason) =>
    record('unhandledRejection', reason),
  );
}

/** Liest die zuletzt geschriebene Crash-Marke (aus einem früheren Lauf). */
function readLastCrash(logDir: string): { kind: string; at: string } | null {
  try {
    const raw = readFileSync(path.join(logDir, 'last-crash.json'), 'utf8');
    const j = JSON.parse(raw) as { kind?: unknown; at?: unknown };
    if (j && typeof j.at === 'string') {
      return { kind: typeof j.kind === 'string' ? j.kind : 'crash', at: j.at };
    }
  } catch {
    /* keine Crash-Marke vorhanden */
  }
  return null;
}

// ── Deep-Links ───────────────────────────────────────────────────────────────

/** Findet eine jmps://-URL oder ein `--show <pfad>` in einer argv-Liste. */
export function findDeepLink(argv: readonly string[]): string | null {
  for (const a of argv) {
    if (a.startsWith(`${PROTOCOL}://`)) return a;
  }
  const idx = argv.indexOf('--show');
  if (idx >= 0 && argv[idx + 1]) {
    return `${PROTOCOL}://open?show=${encodeURIComponent(argv[idx + 1])}`;
  }
  return null;
}

function setupDeepLinks(
  onUrl: (url: string) => void,
  registerProtocol: boolean,
): string | null {
  if (registerProtocol) {
    try {
      // Im Dev läuft die App über das Electron-Binary (process.defaultApp):
      // Pfad zum Einstiegsskript mitgeben, sonst zeigt der Handler auf electron.exe.
      if (process.defaultApp && process.argv.length >= 2) {
        app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [
          path.resolve(process.argv[1]),
        ]);
      } else {
        app.setAsDefaultProtocolClient(PROTOCOL);
      }
    } catch {
      /* Registrierung ist optional */
    }
  }

  // macOS liefert Deep-Links über open-url (nur wenn als Handler registriert).
  app.on('open-url', (event, url) => {
    event.preventDefault();
    onUrl(url);
  });

  // Windows/Linux: zweite Instanz bekommt die URL via argv (mehrere Listener
  // sind erlaubt — der App-eigene second-instance-Handler bleibt unberührt).
  app.on('second-instance', (_event, argv) => {
    const url = findDeepLink(argv);
    if (url) onUrl(url);
  });

  return findDeepLink(process.argv);
}

// ── Presence-Heartbeat ───────────────────────────────────────────────────────

function startPresence(info: {
  appId: string;
  name: string;
  version: string;
  servicePort?: number;
  logDir: string;
  lastCrash: { kind: string; at: string } | null;
}): void {
  const hub = process.env['JMPS_HUB_URL'] || DEFAULT_HUB;
  let target: URL;
  try {
    target = new URL('/presence', hub);
  } catch {
    return;
  }

  const send = (event: 'hello' | 'beat' | 'bye'): void => {
    try {
      const body = JSON.stringify({ ...info, pid: process.pid, event });
      const req = http.request({
        hostname: target.hostname,
        port: target.port,
        path: target.pathname,
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(body),
        },
        timeout: 1500,
      });
      // Hub läuft evtl. nicht — Fehler bewusst verschlucken (best-effort).
      req.on('error', () => {});
      req.on('timeout', () => req.destroy());
      req.end(body);
    } catch {
      /* best-effort */
    }
  };

  send('hello');
  const timer = setInterval(() => send('beat'), HEARTBEAT_MS);
  timer.unref?.();
  app.on('before-quit', () => {
    clearInterval(timer);
    send('bye');
  });
}

// ── Ladescreen (Splash) ──────────────────────────────────────────────────────

const SPLASH_SAFETY_MS = 15_000;
// Mindest-Anzeigedauer: Lädt das Hauptfenster sehr schnell, fielen Öffnen und
// Schließen des Splashs sonst fast zusammen → er blitzte nur kurz auf. Mit einer
// Untergrenze bleibt er wie bei Adobe/Blackmagic einen Moment sichtbar.
const MIN_SPLASH_MS = 700;

function splashHtml(appName: string): string {
  const name = appName.replace(
    /[&<>]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] ?? c,
  );
  return (
    '<!doctype html><meta charset="utf-8"><style>' +
    'html,body{margin:0;height:100%;background:#121212;color:#eee;overflow:hidden;user-select:none;' +
    'font-family:Segoe UI,system-ui,-apple-system,sans-serif}' +
    '.w{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px}' +
    '.n{font-size:20px;font-weight:600;letter-spacing:.02em}.s{font-size:12px;color:#8a8a8a}' +
    '.r{width:34px;height:34px;border:3px solid #2c2c2c;border-top-color:#4f8cff;border-radius:50%;' +
    'animation:s .8s linear infinite}@keyframes s{to{transform:rotate(360deg)}}</style>' +
    `<div class="w"><div class="r"></div><div class="n">${name}</div><div class="s">wird geladen…</div></div>`
  );
}

/**
 * Zeigt beim Start einen Ladescreen und schließt ihn, sobald das erste echte
 * Fenster bereit ist (ready-to-show/show) — fängt den spürbaren Electron-
 * Kaltstart + Erststart-Scan ab. Komplett best-effort: ein Splash-Fehler darf
 * den App-Start nie verhindern.
 */
function startSplash(appName: string): void {
  app.whenReady().then(() => {
    let splash: BrowserWindow | null = null;
    let shownAt = 0;
    try {
      splash = new BrowserWindow({
        width: 440,
        height: 260,
        frame: false,
        resizable: false,
        movable: false,
        minimizable: false,
        maximizable: false,
        skipTaskbar: true,
        center: true,
        show: false,
        backgroundColor: '#121212',
        alwaysOnTop: true,
        webPreferences: { contextIsolation: true, nodeIntegration: false },
      });
      splash.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(splashHtml(appName)));
      splash.once('ready-to-show', () => {
        shownAt = Date.now();
        splash?.show();
      });
    } catch {
      return; // Splash ist optional
    }

    const splashId = splash.id;
    let closed = false;
    let closeTimer: ReturnType<typeof setTimeout> | null = null;

    const doClose = (): void => {
      if (closed) return;
      closed = true;
      if (closeTimer) {
        clearTimeout(closeTimer);
        closeTimer = null;
      }
      try {
        splash?.close();
      } catch {
        /* egal */
      }
      splash = null;
    };

    // Schließen, aber die Mindest-Anzeigedauer ab dem Sichtbarwerden einhalten —
    // sonst blitzt der Splash bei schnellem Start nur kurz auf.
    const requestClose = (): void => {
      if (closed || closeTimer) return;
      const arm = (ms: number, fn: () => void): void => {
        closeTimer = setTimeout(() => {
          closeTimer = null;
          fn();
        }, Math.max(0, ms));
        closeTimer.unref?.();
      };
      if (!shownAt) {
        // Splash noch nicht sichtbar → gleich erneut prüfen (i. d. R. sofort bereit).
        arm(MIN_SPLASH_MS, requestClose);
        return;
      }
      const remaining = MIN_SPLASH_MS - (Date.now() - shownAt);
      if (remaining > 0) arm(remaining, doClose);
      else doClose();
    };

    // Erstes echtes Fenster (nicht der Splash) → beim Anzeigen den Splash schließen.
    const onCreated = (_e: unknown, win: BrowserWindow): void => {
      if (win.id === splashId) return;
      app.removeListener('browser-window-created', onCreated);
      win.once('ready-to-show', requestClose);
      win.once('show', requestClose);
    };
    app.on('browser-window-created', onCreated);

    // Sicherheits-Frist, falls nie ein Fenster bereit wird (hart, ohne Mindestzeit).
    const t = setTimeout(doClose, SPLASH_SAFETY_MS);
    t.unref?.();
  });
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Initialisiert den geteilten Runtime-Layer. So früh wie möglich im Main-Modul
 * aufrufen (vor app.whenReady), damit Crash-Handler auch frühe Fehler fangen.
 */
export function initAppRuntime(opts: AppRuntimeOptions): AppRuntime {
  const isDev = !app.isPackaged;
  const level: LogLevel = opts.level ?? (isDev ? 'debug' : 'info');
  const version = opts.version ?? safeGetVersion();
  const logDir = resolveLogDir();
  try {
    mkdirSync(logDir, { recursive: true });
  } catch {
    /* notfalls schreibt der Logger einfach nichts */
  }

  const log = createLogger({
    appId: opts.appId,
    logDir,
    fileName: 'main.log',
    level,
    toConsole: isDev,
  });
  defaultLogger = log;

  installCrashHandlers(log, logDir, opts.appId);

  // Optionaler Kanal für Renderer-Logs (App kann ihn über die Preload-Bridge
  // füttern: ipcRenderer.send('jmps:log', level, msg, ...rest)).
  const rendererLog = createLogger({
    appId: opts.appId,
    logDir,
    fileName: 'renderer.log',
    level,
    toConsole: isDev,
  });
  try {
    ipcMain.on(
      'jmps:log',
      (_e, lvl: LogLevel, msg: string, ...rest: unknown[]) => {
        const fn = rendererLog[lvl] ?? rendererLog.info;
        fn(msg, ...rest);
      },
    );
  } catch {
    /* ipcMain evtl. (noch) nicht verfügbar */
  }

  let initialDeepLink: string | null;
  if (opts.onDeepLink) {
    initialDeepLink = setupDeepLinks(
      opts.onDeepLink,
      opts.registerProtocol ?? false,
    );
  } else {
    initialDeepLink = findDeepLink(process.argv);
  }

  if (opts.presence !== false) {
    startPresence({
      appId: opts.appId,
      name: opts.appName ?? opts.appId,
      version,
      servicePort: opts.servicePort,
      logDir,
      lastCrash: readLastCrash(logDir),
    });
  }

  // Ladescreen, bis das erste Fenster bereit ist (best-effort, abschaltbar).
  if (opts.splash !== false) startSplash(opts.appName ?? opts.appId);

  log.info(
    `runtime gestartet (v${version}, dev=${isDev})` +
      (initialDeepLink ? ` deepLink=${initialDeepLink}` : ''),
  );

  return { log, initialDeepLink, logDir };
}

/** Der zuletzt initialisierte Logger (oder ein Konsolen-Fallback vor init). */
export function getLog(): Logger {
  return defaultLogger ?? consoleFallback();
}

function safeGetVersion(): string {
  try {
    return app.getVersion();
  } catch {
    return '0.0.0';
  }
}
