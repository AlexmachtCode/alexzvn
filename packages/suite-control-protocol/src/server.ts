// Generalisierter Steuerserver für die ganze Suite — TCP-Zeilenprotokoll
// (./index) + mDNS-Annoncierung (@jm/discovery). Verallgemeinert aus dem
// Switcher-Steuerserver (apps/switcher/src/main/control-server.ts): net.Server,
// clients-Set, broadcast, Begrüßung mit aktuellem Status, mDNS gekoppelt an den
// laufenden Server. Jedes Tool instanziiert ihn mit seiner `role`/`appId`.
//
// Nur im Main-Prozess verwenden (node:net + Multicast über @jm/discovery).
import net from 'node:net';
import tls from 'node:tls';
import { advertise, type Advertiser } from '@jm/discovery';
import { randomNonce, verifyProof } from '@jm/auth-core';
import {
  AUTH_FAIL,
  AUTH_OK,
  createLineBuffer,
  formatAuthReq,
  formatSuiteState,
  parseAuth,
  parseSuiteCommand,
  type SuiteCommand,
  type SuiteState,
} from './index';

export interface SuiteControlStatus {
  running: boolean;
  port: number;
  clients: number;
}

export interface SuiteCommandContext {
  /** Die rohe, ungeparste Befehlszeile (z. B. für Legacy-Parser). */
  raw: string;
  /** Eine Antwortzeile an genau diesen Client schreiben (\n wird ergänzt). */
  reply: (line: string) => void;
  socket: net.Socket;
}

export interface SuiteControlServerOptions {
  /** Rolle des Tools (TXT-Record + ns im STATE), z. B. 'switcher'. */
  role: string;
  /** Tool-ID für mDNS (TXT appId), z. B. 'jm-switcher'. */
  appId: string;
  /** Aktuellen Zustand liefern (Begrüßung + Antwort auf STATE?). */
  getState: () => SuiteState;
  /** Befehl eines Clients (STATE? wird intern beantwortet, kommt hier nicht an). */
  onCommand: (cmd: SuiteCommand, ctx: SuiteCommandContext) => void;
  /** Statuswechsel (Start/Stop/Client-Zahl) — z. B. für UI-Anzeige. */
  onStatus?: (status: SuiteControlStatus) => void;
  /**
   * Schlägt die mDNS-Annoncierung fehl (Bonjour/Multicast/Firewall), wird der
   * Fehler hier gemeldet, statt still verschluckt zu werden. Der Steuerserver
   * lauscht trotzdem weiter (manuelle Host:Port-Eingabe bleibt möglich), aber
   * Auto-Discovery funktioniert dann nicht — sichtbar fürs Log/Debugging.
   */
  onAdvertiseError?: (err: Error) => void;
  /** mDNS-Annoncierung (Default true). */
  advertiseService?: boolean;
  /** Anzeigename für mDNS (Default `${appId}-ctl` bei controlEndpoint, sonst appId). */
  name?: string;
  /**
   * Diesen Endpunkt als **Steuer-Endpunkt** annoncieren: TXT-Marker `ctl=1` +
   * eigener mDNS-Instanzname (`${appId}-ctl`). Damit unterscheiden Aggregatoren
   * ihn von einem tool-eigenen Advert derselben Rolle (Socket.IO/SSE): das
   * Companion-Modul nimmt den `ctl=1`-Endpunkt, Stage Display den anderen.
   * Tools mit eigenem Advert (Timer/Presenter/Prompter) brauchen den eigenen
   * Namen, damit nicht zwei _jmps._tcp-Instanzen denselben Namen tragen.
   */
  controlEndpoint?: boolean;
  /**
   * Bind-Adresse für den TCP-Server. `undefined` (Default) = unverändertes
   * Verhalten: alle Interfaces (Node-Default), damit Fernsteuerung über das LAN
   * (Companion/Stage Display/Aggregatoren auf anderen Rechnern) weiter
   * funktioniert. Wer ein reines Einzel-Rechner-Setup absichern will, setzt
   * `'127.0.0.1'` (nur lokal erreichbar). Im `mode:'secure'` ist sie für fremde
   * Netze sicher, weil der Bind erst nach Auth/TLS Wirkung entfaltet.
   */
  bindHost?: string;
  /**
   * Betriebsmodus (P1, #59):
   *  - `'open'` (Default): unverändertes Verhalten — Server grüßt sofort mit
   *    STATE, akzeptiert Befehle ohne Auth. Für reine, vertraute LANs.
   *  - `'secure'`: Auth-Handshake (Challenge-Response) ZUERST; vor `AUTHOK` wird
   *    KEIN Zustand gesendet und kein Befehl angenommen. Für geteilte/fremde
   *    Netze. Mit `tls` zusätzlich verschlüsselt (empfohlen für fremde Netze).
   */
  mode?: 'open' | 'secure';
  /**
   * TLS für `mode:'secure'` (P1, #59): umhüllt den Server mit `tls.createServer`.
   * Selbstsigniertes Zertifikat je Installation (vom Launcher bereitgestellt);
   * der Client pinnt den Fingerprint (TOFU). Ohne `tls` läuft `secure` als reine
   * Authentifizierung über Klartext-TCP (Token leakt dank HMAC trotzdem nicht,
   * aber die Steuer-Inhalte sind unverschlüsselt).
   */
  tls?: { key: string; cert: string };
  /**
   * Auth-Konfiguration für `mode:'secure'`. Entweder ein geteiltes Suite-Token
   * (der Client beweist Besitz per HMAC über die Server-Nonce) oder eine eigene
   * Prüf-Funktion (z. B. Token je Rolle). Fehlt sie im secure-Modus, wird jede
   * Verbindung abgelehnt.
   */
  auth?: { token: string } | { verify: (proof: string, nonce: string) => boolean };
  /** Fehlversuche pro Quell-IP bis zur kurzen Sperre (Default 5). */
  authMaxFailures?: number;
  /** Sperrdauer nach zu vielen Fehlversuchen in ms (Default 30000). */
  authLockoutMs?: number;
}

function isQueryVerb(verb: string): boolean {
  return verb === 'query' || verb === 'state' || verb === 'state?';
}

export class SuiteControlServer {
  private server: net.Server | null = null;
  private readonly clients = new Set<net.Socket>();
  private advertiser: Advertiser | null = null;
  private running = false;
  private boundPort = 0;
  /** Fehlversuch-Zähler je Quell-IP (Brute-Force-Bremse im secure-Modus). */
  private readonly authFailures = new Map<string, { count: number; lockUntil: number }>();

  constructor(private readonly opts: SuiteControlServerOptions) {}

  status(): SuiteControlStatus {
    return { running: this.running, port: this.boundPort, clients: this.clients.size };
  }

  start(port: number): Promise<{ ok: boolean; error?: string; port?: number }> {
    return new Promise((resolve) => {
      this.stop();
      // secure + tls → verschlüsselter Transport (tls.Server ist ein net.Server).
      // Der Connection-Handler ist identisch: TLSSocket erbt von net.Socket.
      const useTls = this.opts.mode === 'secure' && this.opts.tls != null;
      const srv = useTls
        ? tls.createServer(
            { key: this.opts.tls!.key, cert: this.opts.tls!.cert },
            (socket) => this.handleConnection(socket),
          )
        : net.createServer((socket) => this.handleConnection(socket));
      srv.on('error', (e) => {
        this.server = null;
        this.running = false;
        this.boundPort = 0;
        this.notifyStatus();
        resolve({ ok: false, error: e.message });
      });
      // host undefined → Node-Default (alle Interfaces): bestehendes Verhalten.
      srv.listen(port, this.opts.bindHost, () => {
        this.server = srv;
        this.running = true;
        this.boundPort = port;
        if (this.opts.advertiseService !== false) {
          try {
            const ctl = this.opts.controlEndpoint === true;
            this.advertiser = advertise({
              appId: this.opts.appId,
              role: this.opts.role,
              port,
              name: this.opts.name ?? (ctl ? `${this.opts.appId}-ctl` : undefined),
              txt: ctl ? { ctl: '1' } : undefined,
            });
          } catch (err) {
            // mDNS optional — Server lauscht trotzdem. Fehler aber melden, damit
            // ausbleibende Auto-Discovery nicht unsichtbar bleibt.
            this.opts.onAdvertiseError?.(err instanceof Error ? err : new Error(String(err)));
          }
        }
        this.notifyStatus();
        resolve({ ok: true, port });
      });
    });
  }

  /** Eine neue Verbindung behandeln — je nach Modus offen oder mit Handshake. */
  private handleConnection(socket: net.Socket): void {
    socket.setEncoding('utf8');
    socket.on('error', () => {});
    socket.on('close', () => {
      this.clients.delete(socket);
      this.notifyStatus();
    });

    if (this.opts.mode !== 'secure') {
      // OPEN: unverändertes Verhalten — sofort begrüßen, Befehle ohne Auth.
      this.clients.add(socket);
      socket.write(formatSuiteState(this.opts.getState()));
      const feed = createLineBuffer((line) => this.handleLine(line, socket));
      socket.on('data', (d) => feed(String(d)));
      this.notifyStatus();
      return;
    }

    // SECURE: Challenge-Response ZUERST. Vor AUTHOK kein Zustand, keine Befehle.
    const ip = socket.remoteAddress ?? '';
    if (this.isLockedOut(ip)) {
      socket.destroy(); // gesperrt: nicht mal eine Aufforderung senden
      return;
    }
    const nonce = randomNonce();
    let authed = false;
    socket.write(formatAuthReq(nonce));
    const feed = createLineBuffer((line) => {
      if (authed) {
        this.handleLine(line, socket);
        return;
      }
      const a = parseAuth(line);
      if (a && this.verifyAuth(a.proof, nonce)) {
        authed = true;
        this.clearFailures(ip);
        socket.write(`${AUTH_OK}\n`);
        this.clients.add(socket); // erst jetzt Empfänger von pushState/Greeting
        socket.write(formatSuiteState(this.opts.getState()));
        this.notifyStatus();
      } else {
        // Falscher/fehlender Beweis ODER Befehl vor Auth → ablehnen + schließen.
        this.registerFailure(ip);
        try {
          socket.write(`${AUTH_FAIL}\n`);
        } catch {
          /* egal */
        }
        socket.destroy();
      }
    });
    socket.on('data', (d) => feed(String(d)));
  }

  /** Prüft den Handshake-Beweis gegen Token bzw. verify-Funktion. */
  private verifyAuth(proof: string, nonce: string): boolean {
    const auth = this.opts.auth;
    if (!auth) return false; // secure ohne auth-Config: alles ablehnen
    if ('verify' in auth) return auth.verify(proof, nonce);
    return verifyProof(auth.token, nonce, proof);
  }

  private isLockedOut(ip: string): boolean {
    const e = this.authFailures.get(ip);
    return e != null && e.lockUntil > Date.now();
  }

  private registerFailure(ip: string): void {
    const max = this.opts.authMaxFailures ?? 5;
    const lockMs = this.opts.authLockoutMs ?? 30_000;
    const e = this.authFailures.get(ip) ?? { count: 0, lockUntil: 0 };
    e.count += 1;
    if (e.count >= max) {
      e.lockUntil = Date.now() + lockMs;
      e.count = 0; // nach Sperre frisch zählen
    }
    this.authFailures.set(ip, e);
  }

  private clearFailures(ip: string): void {
    this.authFailures.delete(ip);
  }

  private handleLine(line: string, socket: net.Socket): void {
    const cmd = parseSuiteCommand(line);
    if (!cmd) return;
    if (isQueryVerb(cmd.verb)) {
      socket.write(formatSuiteState(this.opts.getState()));
      return;
    }
    this.opts.onCommand(cmd, {
      raw: line,
      socket,
      reply: (l) => {
        try {
          socket.write(l.endsWith('\n') ? l : l + '\n');
        } catch {
          /* egal */
        }
      },
    });
  }

  stop(): void {
    if (this.advertiser) {
      this.advertiser.stop();
      this.advertiser = null;
    }
    for (const c of this.clients) {
      try {
        c.destroy();
      } catch {
        /* egal */
      }
    }
    this.clients.clear();
    if (this.server) {
      this.server.close();
      this.server = null;
    }
    if (this.running) {
      this.running = false;
      this.boundPort = 0;
      this.notifyStatus();
    }
  }

  /** Neuen Zustand an alle verbundenen Clients broadcasten. */
  pushState(state: SuiteState): void {
    if (this.clients.size === 0) return;
    const line = formatSuiteState(state);
    for (const c of this.clients) {
      try {
        c.write(line);
      } catch {
        /* egal */
      }
    }
  }

  private notifyStatus(): void {
    this.opts.onStatus?.(this.status());
  }
}
