import { createServer, type IncomingMessage, type Server as HttpServer, type ServerResponse } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { networkInterfaces } from 'node:os';
import { app } from 'electron';
import { Server as IoServer } from 'socket.io';
import { dispatch, getState, subscribe } from './state';
import { getAuth, isTokenValid } from './auth';
import type { Command } from '@shared/timer-state';
import { BIND_HOST, SERVER_PORT as PORT } from '@shared/net';

export const SERVER_PORT = PORT;
/** Lausch-Adresse — NICHT als Verbindungsziel verwenden, siehe @shared/net. */
export const SERVER_HOST = BIND_HOST;
export const VITE_DEV_PORT = 5173;

let http: HttpServer | null = null;
let io: IoServer | null = null;

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8',
};

function rendererDistDir(): string {
  // After electron-vite build: <app>/out/renderer
  return path.join(app.getAppPath(), 'out', 'renderer');
}

function serveStatic(req: IncomingMessage, res: ServerResponse): void {
  const distDir = rendererDistDir();
  const url = new URL(req.url ?? '/', 'http://localhost');
  let urlPath = url.pathname;
  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';

  const safe = path.normalize(path.join(distDir, urlPath));
  if (!safe.startsWith(distDir)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(safe, (err, stat) => {
    if (err || !stat.isFile()) {
      // SPA fallback to index.html (e.g. /?view=remote rewrites)
      const idx = path.join(distDir, 'index.html');
      fs.readFile(idx, (e2, data) => {
        if (e2) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(data);
      });
      return;
    }
    const mime =
      MIME[path.extname(safe).toLowerCase()] ?? 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': mime,
      'Cache-Control': 'public, max-age=3600',
    });
    fs.createReadStream(safe).pipe(res);
  });
}

export function startServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    const distIndex = path.join(rendererDistDir(), 'index.html');
    const canServeStatic = fs.existsSync(distIndex);
    const mode = app.isPackaged
      ? 'prod'
      : canServeStatic
        ? 'preview'
        : 'dev';

    http = createServer((req, res) => {
      const url = (req.url ?? '/').split('?')[0];

      if (url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, mode }));
        return;
      }

      // Socket.IO attaches its own listener for /socket.io/* and intercepts first.
      // Renderer assets only get served if a built bundle is present.
      if (!canServeStatic) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(
          'JM Timer dev server\n\nNo built renderer found.\n' +
            'Run `npm run build` first, then `npm run preview` / `npm run dev:codespace`.\n' +
            'For local dev with hot-reload, open the Vite dev server on port 5173 instead.\n',
        );
        return;
      }
      serveStatic(req, res);
    });

    io = new IoServer(http, {
      cors: { origin: '*' },
      pingTimeout: 4000,
      pingInterval: 2000,
    });

    // Auth middleware: when enabled, every socket must present a matching
    // token via handshake.auth.token or ?token=... query. Loopback (Electron
    // renderer) always passes — we trust the local preload bridge.
    io.use((socket, next) => {
      const remoteAddr = socket.handshake.address ?? '';
      const isLoopback =
        remoteAddr === '127.0.0.1' ||
        remoteAddr === '::1' ||
        remoteAddr === '::ffff:127.0.0.1';
      if (isLoopback) return next();

      const auth = getAuth();
      if (!auth.enabled) return next();

      const supplied =
        (typeof socket.handshake.auth?.token === 'string'
          ? (socket.handshake.auth.token as string)
          : undefined) ??
        (typeof socket.handshake.query?.token === 'string'
          ? (socket.handshake.query.token as string)
          : undefined);

      if (isTokenValid(supplied)) return next();
      return next(new Error('unauthorised'));
    });

    io.on('connection', (socket) => {
      socket.emit('state', getState());
      socket.on('cmd', (cmd: Command) => {
        try {
          const next = dispatch(cmd);
          io?.emit('state', next);
        } catch (err) {
          console.error('[jm-timer] bad command', cmd, err);
        }
      });
    });

    subscribe((s) => {
      io?.emit('state', s);
    });

    http.once('error', reject);
    http.listen(SERVER_PORT, SERVER_HOST, () => {
      console.log(
        `[jm-timer] socket.io + http listening on http://${SERVER_HOST}:${SERVER_PORT} (${mode})`,
      );
      resolve();
    });
  });
}

export function stopServer(): void {
  io?.close();
  http?.close();
  io = null;
  http = null;
}

/** Returns all IPv4 LAN addresses (non-internal). */
export function getLanAddresses(): string[] {
  const out: string[] = [];
  const ifaces = networkInterfaces();
  for (const list of Object.values(ifaces)) {
    if (!list) continue;
    for (const iface of list) {
      if (iface.family === 'IPv4' && !iface.internal && iface.address) {
        out.push(iface.address);
      }
    }
  }
  return out;
}

/**
 * Returns Remote-View URLs that can be opened on any device in the LAN.
 * In dev the renderer is served by Vite on port 5173 (but the socket still
 * lives on port 7777, the client derives it from window.location.hostname).
 *
 * When token-auth is enabled the URLs include `&token=…` so the Remote
 * browser can authenticate the socket connection without manual entry.
 */
export function getRemoteUrls(): string[] {
  const port = app.isPackaged ? SERVER_PORT : VITE_DEV_PORT;
  const auth = getAuth();
  const tokenQuery =
    auth.enabled && auth.token ? `&token=${encodeURIComponent(auth.token)}` : '';
  return getLanAddresses().map(
    (ip) => `http://${ip}:${port}/?view=remote${tokenQuery}`,
  );
}
