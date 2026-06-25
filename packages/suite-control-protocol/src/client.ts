// Generalisierter Steuer-Client mit Auto-Reconnect. Verallgemeinert aus dem
// Stage-Display-Switcher-Client (apps/stage-display/src/main/switcher-client.ts).
// Konsumiert den STATE-Strom eines SuiteControlServer (Tally/Status) und kann
// Befehle senden. Genutzt von Tally-Aggregatoren (Stage Display, Rundown).
//
// Nur im Main-Prozess verwenden (node:net).
import net from 'node:net';
import { hmacProof } from '@jm/auth-core';
import {
  createLineBuffer,
  formatAuth,
  isAuthFail,
  isAuthOk,
  parseAuthReq,
  parseSuiteState,
  type SuiteState,
} from './index';

const DEFAULT_RECONNECT_MS = 2000;

export interface SuiteControlClientOptions {
  /** Neuer Zustand vom Server (jede STATE-Zeile). */
  onState: (state: SuiteState) => void;
  /** Verbindungswechsel (true beim Connect, false bei Trennung). */
  onConnectedChange?: (connected: boolean) => void;
  /** Reconnect-Intervall in ms (Default 2000). */
  reconnectMs?: number;
  /**
   * Geteiltes Suite-Token (P1, #59). Gesetzt → der Client beantwortet ein
   * AUTHREQ des Servers per HMAC-Beweis (secure-Modus). Nicht gesetzt → Verhalten
   * wie bisher (open-Modus: STATE? beim Connect, kein Handshake).
   */
  auth?: string;
  /** Auth-Erfolg/-Misserfolg (nur secure-Modus) — z. B. fürs UI/Log. */
  onAuthChange?: (ok: boolean) => void;
}

/** TCP-Client auf einen SuiteControlServer (suite-weites Zeilenprotokoll). */
export class SuiteControlClient {
  private socket: net.Socket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private active = false;
  private host = '';
  private port = 0;

  constructor(private readonly opts: SuiteControlClientOptions) {}

  connect(host: string, port: number): void {
    this.disconnect();
    this.active = true;
    this.host = host;
    this.port = port;
    this.open();
  }

  /** Eine Befehlszeile senden (\n wird ergänzt). No-op, wenn nicht verbunden. */
  send(line: string): void {
    if (this.socket && !this.socket.destroyed) {
      try {
        this.socket.write(line.endsWith('\n') ? line : line + '\n');
      } catch {
        /* egal */
      }
    }
  }

  private open(): void {
    if (!this.active) return;
    const socket = net.connect({ host: this.host, port: this.port });
    socket.setEncoding('utf8');
    const feed = createLineBuffer((line) => {
      // secure-Handshake: Server fordert mit AUTHREQ einen Beweis an.
      const req = parseAuthReq(line);
      if (req) {
        if (this.opts.auth) {
          socket.write(formatAuth(hmacProof(this.opts.auth, req.nonce)));
        }
        // ohne Token: nichts senden → Server antwortet AUTHFAIL/schließt.
        return;
      }
      if (isAuthOk(line)) {
        this.opts.onAuthChange?.(true);
        return; // der Server schickt direkt danach den Greeting-STATE
      }
      if (isAuthFail(line)) {
        this.opts.onAuthChange?.(false);
        return; // 'close' folgt → Reconnect
      }
      const st = parseSuiteState(line);
      if (st) this.opts.onState(st);
    });
    socket.on('connect', () => {
      this.opts.onConnectedChange?.(true);
      // open-Modus: Zustand aktiv anfordern (wie bisher). Im secure-Modus NICHT —
      // ein STATE? vor der Auth würde als Fehlversuch gewertet; dort liefert der
      // Server den Zustand ohnehin direkt nach AUTHOK.
      if (!this.opts.auth) socket.write('STATE?\n');
    });
    socket.on('data', (chunk: string) => feed(chunk));
    socket.on('error', () => {
      /* 'close' folgt → Reconnect dort */
    });
    socket.on('close', () => {
      this.opts.onConnectedChange?.(false);
      this.scheduleReconnect();
    });
    this.socket = socket;
  }

  private scheduleReconnect(): void {
    if (!this.active) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this.open(), this.opts.reconnectMs ?? DEFAULT_RECONNECT_MS);
  }

  disconnect(): void {
    this.active = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.destroy();
      this.socket = null;
    }
    this.opts.onConnectedChange?.(false);
  }
}
