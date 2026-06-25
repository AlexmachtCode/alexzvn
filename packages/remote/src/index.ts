import { timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { networkInterfaces } from 'node:os';

export interface RemoteServerOptions {
  /** Bevorzugter Port (Default 0 = vom OS vergeben). */
  port?: number;
  /** Vollständige HTML-Seite der Fernbedienung (wird unter `/` ausgeliefert). */
  page: string;
  /** Liefert den aktuellen Zustand (beim Verbinden + bei broadcast an Clients gesendet). */
  getState?: () => unknown;
  /** Kommando eines Clients (POST /cmd, JSON-Body). */
  onCommand?: (cmd: unknown) => void;
  /**
   * Zugriffs-Token (P1, #59). Gesetzt → die Daten-Endpunkte (/state, /events,
   * /cmd) verlangen das Token (Query `?t=` ODER Header `x-remote-token`); ohne
   * gültiges Token → 401. Die Seite `/` selbst bleibt frei (der QR-Link trägt
   * `?t=<token>`, die Seite reicht es bei ihren Aufrufen mit). Nicht gesetzt →
   * Verhalten wie bisher (kein Token). Stärkerer Ersatz für den 4-stelligen PIN.
   */
  token?: string;
  /**
   * Rate-Limit für POST /cmd pro Quell-IP (Default: 60 Anfragen / 10 s). Schützt
   * vor Spam-Einreichungen aus dem Saal. `max:0` deaktiviert das Limit.
   */
  rateLimit?: { windowMs?: number; max?: number };
}

export interface RemoteAddress {
  port: number;
  /** Erreichbare LAN-URLs (eine je IPv4-Interface). */
  urls: string[];
}

/**
 * Winziger HTTP-Server für eine Handy-Fernbedienung im selben WLAN:
 *  - GET `/`        → die Fernbedienungsseite (HTML)
 *  - GET `/state`   → aktueller Zustand (JSON)
 *  - GET `/events`  → Server-Sent-Events: Zustands-Push an alle Clients
 *  - POST `/cmd`    → Kommando vom Client (JSON) → onCommand
 *
 * Bewusst ohne Fremd-Abhängigkeiten (nur node:http) — SSE + fetch reichen für
 * eine Fernbedienung und sind robust hinter Firewalls/Proxies. Bindet an
 * 0.0.0.0, damit das Handy im LAN zugreifen kann.
 */
export class RemoteServer {
  private server: Server | null = null;
  private readonly clients = new Set<ServerResponse>();
  private addr: RemoteAddress | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  /** Zeitstempel der jüngsten /cmd-Anfragen je Quell-IP (Rate-Limit). */
  private readonly cmdHits = new Map<string, number[]>();

  constructor(private readonly opts: RemoteServerOptions) {}

  start(): Promise<RemoteAddress> {
    if (this.server) return Promise.resolve(this.addr as RemoteAddress);
    return new Promise<RemoteAddress>((resolve, reject) => {
      const server = createServer((req, res) => this.handle(req, res));
      server.on('error', (err) => {
        this.server = null;
        reject(err);
      });
      server.listen(this.opts.port ?? 0, '0.0.0.0', () => {
        this.server = server;
        const address = server.address();
        const port = typeof address === 'object' && address ? address.port : (this.opts.port ?? 0);
        this.addr = { port, urls: lanUrls(port) };
        // SSE-Verbindungen am Leben halten (Proxies/Handys trennen sonst).
        this.heartbeat = setInterval(() => {
          for (const c of this.clients) c.write(': ping\n\n');
        }, 25000);
        resolve(this.addr);
      });
    });
  }

  stop(): Promise<void> {
    if (this.heartbeat) {
      clearInterval(this.heartbeat);
      this.heartbeat = null;
    }
    for (const c of this.clients) {
      try {
        c.end();
      } catch {
        /* ignore */
      }
    }
    this.clients.clear();
    const server = this.server;
    this.server = null;
    this.addr = null;
    if (!server) return Promise.resolve();
    return new Promise<void>((resolve) => server.close(() => resolve()));
  }

  isRunning(): boolean {
    return this.server != null;
  }

  address(): RemoteAddress | null {
    return this.addr;
  }

  /** Aktuellen Zustand an alle verbundenen Clients pushen. */
  broadcast(state: unknown): void {
    const payload = `data: ${JSON.stringify(state)}\n\n`;
    for (const c of this.clients) {
      try {
        c.write(payload);
      } catch {
        this.clients.delete(c);
      }
    }
  }

  private handle(req: IncomingMessage, res: ServerResponse): void {
    const url = (req.url ?? '/').split('?')[0];
    const method = req.method ?? 'GET';

    // Token-Schutz der Daten-Endpunkte (P1). Die Seite `/` bleibt frei.
    if ((url === '/state' || url === '/events' || url === '/cmd') && !this.tokenOk(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end('{"error":"unauthorized"}');
      return;
    }

    if (method === 'GET' && url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(this.opts.page);
      return;
    }

    if (method === 'GET' && url === '/state') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(this.opts.getState?.() ?? null));
      return;
    }

    if (method === 'GET' && url === '/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-store',
        Connection: 'keep-alive',
      });
      res.write('retry: 2000\n\n');
      res.write(`data: ${JSON.stringify(this.opts.getState?.() ?? null)}\n\n`);
      this.clients.add(res);
      req.on('close', () => this.clients.delete(res));
      return;
    }

    if (method === 'POST' && url === '/cmd') {
      if (!this.rateOk(req)) {
        res.writeHead(429, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end('{"error":"rate_limited"}');
        return;
      }
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
        if (body.length > 64_000) req.destroy(); // Schutz vor Übergröße
      });
      req.on('end', () => {
        try {
          this.opts.onCommand?.(body ? JSON.parse(body) : {});
        } catch {
          /* ungültiges JSON ignorieren */
        }
        res.writeHead(204).end();
      });
      return;
    }

    res.writeHead(404).end();
  }

  /** Token gültig? (kein Token konfiguriert → immer true). */
  private tokenOk(req: IncomingMessage): boolean {
    const expected = this.opts.token;
    if (!expected) return true;
    const qs = (req.url ?? '').split('?')[1] ?? '';
    const fromQuery = new URLSearchParams(qs).get('t') ?? '';
    const header = req.headers['x-remote-token'];
    const provided = (Array.isArray(header) ? header[0] : header) || fromQuery;
    return safeEqual(provided, expected);
  }

  /** Rate-Limit-Fenster pro Quell-IP (kein Limit, wenn max:0). */
  private rateOk(req: IncomingMessage): boolean {
    const max = this.opts.rateLimit?.max ?? 60;
    if (max <= 0) return true;
    const windowMs = this.opts.rateLimit?.windowMs ?? 10_000;
    const ip = req.socket.remoteAddress ?? '';
    const now = Date.now();
    const hits = (this.cmdHits.get(ip) ?? []).filter((t) => now - t < windowMs);
    if (hits.length >= max) {
      this.cmdHits.set(ip, hits);
      return false;
    }
    hits.push(now);
    this.cmdHits.set(ip, hits);
    return true;
  }
}

/** Konstantzeit-Vergleich zweier Strings (Längen-tolerant). */
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** Alle nicht-internen IPv4-Adressen → http-URLs. */
function lanUrls(port: number): string[] {
  const out: string[] = [];
  const ifaces = networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const ni of ifaces[name] ?? []) {
      if (ni.family === 'IPv4' && !ni.internal) out.push(`http://${ni.address}:${port}`);
    }
  }
  if (out.length === 0) out.push(`http://localhost:${port}`);
  return out;
}
