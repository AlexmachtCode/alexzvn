import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { randomInt } from 'node:crypto';
import { networkInterfaces } from 'node:os';
import { app } from 'electron';
import { advertise, type Advertiser } from '@jm/discovery';
import { readControlConfig, mdnsSignKey } from '@jm/control-config';
import type { NetInterface, RemoteConfig, RemoteStatus } from '@shared/types';
import { getRemoteView, goto, next, prev, setScreen, stopPresentation, subscribe } from './present';
import { captureAudience } from './windows';
import { controllerHtml } from './remote-page';

// Embedded LAN clicker: a tiny HTTP server in the main process serves a mobile
// web remote and bridges its commands straight into present.ts. No external
// dependency — Node's http/crypto/os are enough. Live slide state is pushed to
// the phone over Server-Sent Events; commands come back as small POSTs. A 4-digit
// PIN (optional) keeps strangers on the same Wi-Fi from hijacking the slides.

let server: Server | null = null;
let config: RemoteConfig | null = null;
let pin: string | null = null;
let lastError: string | null = null;
let displayUrl: string | null = null;
let unsubscribe: (() => void) | null = null;
// mDNS-Annoncierung ist an die laufende Fernsteuerung gekoppelt: nur wenn der
// Remote-Server lauscht, ist der Presenter im LAN auffindbar (Stage Display
// verbindet sich dann ohne manuelle IP). Stop spiegelt stopServer().
let advertiser: Advertiser | null = null;

const sseClients = new Set<ServerResponse>();
let onStatusChange: ((s: RemoteStatus) => void) | null = null;

/** Register a callback fired whenever the server status changes (ipc → windows). */
export function setRemoteStatusHandler(cb: (s: RemoteStatus) => void): void {
  onStatusChange = cb;
}

/** Non-internal IPv4 interfaces the operator can bind to, plus an "all" option. */
export function listInterfaces(): NetInterface[] {
  const out: NetInterface[] = [{ address: 'all', label: 'Alle Schnittstellen (0.0.0.0)' }];
  const ifaces = networkInterfaces();
  for (const [name, addrs] of Object.entries(ifaces)) {
    for (const a of addrs ?? []) {
      if (a.family === 'IPv4' && !a.internal) {
        out.push({ address: a.address, label: `${name} · ${a.address}` });
      }
    }
  }
  return out;
}

/** First reachable LAN IP, used as the display URL when binding to all interfaces. */
function firstLanIp(): string | null {
  const ifaces = networkInterfaces();
  for (const addrs of Object.values(ifaces)) {
    for (const a of addrs ?? []) {
      if (a.family === 'IPv4' && !a.internal) return a.address;
    }
  }
  return null;
}

export function getRemoteStatus(): RemoteStatus {
  return {
    running: server != null,
    url: server != null ? displayUrl : null,
    pin: server != null && config?.pinEnabled ? pin : null,
    config: config ?? { enabled: false, bind: 'all', port: 7330, pinEnabled: true },
    error: lastError,
  };
}

function emitStatus(): void {
  onStatusChange?.(getRemoteStatus());
}

function authorized(provided: string | null): boolean {
  if (!config?.pinEnabled) return true;
  return provided != null && provided === pin;
}

function sendView(res: ServerResponse): void {
  res.write(`data: ${JSON.stringify(getRemoteView())}\n\n`);
}

/** Push the latest slide state to every connected phone. */
function broadcastView(): void {
  for (const res of sseClients) {
    try {
      sendView(res);
    } catch {
      sseClients.delete(res);
    }
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 4096) req.destroy(); // commands are tiny; cap abuse
    });
    req.on('end', () => resolve(data));
    req.on('error', () => resolve(''));
  });
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const pathname = url.pathname;

  if (req.method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(controllerHtml(config?.pinEnabled === true));
    return;
  }

  // Live state stream (Server-Sent Events). EventSource can't set headers, so the
  // PIN travels as a query param.
  if (req.method === 'GET' && pathname === '/events') {
    if (!authorized(url.searchParams.get('pin'))) {
      res.writeHead(401).end();
      return;
    }
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    });
    res.write('retry: 2000\n\n');
    sendView(res);
    sseClients.add(res);
    const ping = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        clearInterval(ping);
      }
    }, 15000);
    req.on('close', () => {
      clearInterval(ping);
      sseClients.delete(res);
    });
    return;
  }

  // Live rendered slide (program output) as JPEG — the stage display fetches this
  // when the SSE `rev` changes (#38, slice 2b). PIN travels as a query param like
  // /events. 404 while no presentation window is open.
  if (req.method === 'GET' && pathname === '/slide/current.jpg') {
    if (!authorized(url.searchParams.get('pin'))) {
      res.writeHead(401).end();
      return;
    }
    const jpeg = await captureAudience(1280);
    if (!jpeg) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'content-type': 'image/jpeg', 'cache-control': 'no-store' });
    res.end(jpeg);
    return;
  }

  // Control commands.
  if (req.method === 'POST' && pathname === '/cmd') {
    const body = await readBody(req);
    let msg: { action?: string; pin?: string; index?: number };
    try {
      msg = JSON.parse(body || '{}');
    } catch {
      res.writeHead(400).end();
      return;
    }
    if (!authorized(msg.pin ?? null)) {
      res.writeHead(401, { 'content-type': 'application/json' }).end('{"error":"pin"}');
      return;
    }
    switch (msg.action) {
      case 'next':
        next();
        break;
      case 'prev':
        prev();
        break;
      case 'goto':
        if (typeof msg.index === 'number') goto(msg.index);
        break;
      case 'black':
        setScreen('black');
        break;
      case 'white':
        setScreen('white');
        break;
      case 'live':
        setScreen('live');
        break;
      case 'stop':
        stopPresentation();
        break;
      default:
        res.writeHead(400).end();
        return;
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(getRemoteView()));
    return;
  }

  res.writeHead(404).end();
}

function stopServer(): void {
  if (advertiser) {
    advertiser.stop();
    advertiser = null;
  }
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  for (const res of sseClients) {
    try {
      res.end();
    } catch {
      /* ignore */
    }
  }
  sseClients.clear();
  if (server) {
    server.close();
    server = null;
  }
  pin = null;
  displayUrl = null;
}

/** Persist nothing here — caller persists. Start/stop the server to match `cfg`. */
export function applyRemoteConfig(cfg: RemoteConfig): Promise<RemoteStatus> {
  return new Promise((resolve) => {
    stopServer();
    config = cfg;
    lastError = null;

    if (!cfg.enabled) {
      emitStatus();
      resolve(getRemoteStatus());
      return;
    }

    pin = cfg.pinEnabled ? String(randomInt(1000, 10000)) : null;
    const host = cfg.bind === 'all' ? '0.0.0.0' : cfg.bind;
    const ip = cfg.bind === 'all' ? firstLanIp() : cfg.bind;
    displayUrl = ip ? `http://${ip}:${cfg.port}` : null;

    const srv = createServer((req, res) => {
      void handle(req, res).catch(() => {
        try {
          res.writeHead(500).end();
        } catch {
          /* response already sent */
        }
      });
    });

    srv.once('error', (err: NodeJS.ErrnoException) => {
      lastError =
        err.code === 'EADDRINUSE'
          ? `Port ${cfg.port} ist belegt — anderen Port wählen.`
          : `Server-Fehler: ${err.message}`;
      server = null;
      displayUrl = null;
      pin = null;
      emitStatus();
      resolve(getRemoteStatus());
    });

    srv.listen(cfg.port, host, () => {
      server = srv;
      // Push slide changes to connected phones.
      unsubscribe = subscribe(broadcastView);
      // Im LAN annoncieren, damit Stage Display den Presenter ohne IP-Eingabe
      // findet (mDNS). Best-effort — Fehler dürfen die Fernsteuerung nicht stören.
      try {
        // Annonce im secure-Modus signieren (A3, #59) → Stage Display verbindet nur
        // mit dem echten Presenter. Open-Modus → undefined (unverändert).
        const signKey = mdnsSignKey(readControlConfig(app.getPath('appData')));
        advertiser = advertise({ appId: 'jm-presenter', role: 'presenter', port: cfg.port, signKey });
      } catch {
        /* mDNS optional */
      }
      emitStatus();
      resolve(getRemoteStatus());
    });
  });
}

/** Stop the server (called on app quit). */
export function shutdownRemote(): void {
  stopServer();
  config = config ? { ...config, enabled: false } : null;
}
