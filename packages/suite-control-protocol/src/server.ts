// Generalisierter Steuerserver für die ganze Suite — TCP-Zeilenprotokoll
// (./index) + mDNS-Annoncierung (@jm/discovery). Verallgemeinert aus dem
// Switcher-Steuerserver (apps/switcher/src/main/control-server.ts): net.Server,
// clients-Set, broadcast, Begrüßung mit aktuellem Status, mDNS gekoppelt an den
// laufenden Server. Jedes Tool instanziiert ihn mit seiner `role`/`appId`.
//
// Nur im Main-Prozess verwenden (node:net + Multicast über @jm/discovery).
import net from 'node:net';
import { advertise, type Advertiser } from '@jm/discovery';
import { createLineBuffer, formatSuiteState, parseSuiteCommand, type SuiteCommand, type SuiteState } from './index';

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

  constructor(private readonly opts: SuiteControlServerOptions) {}

  status(): SuiteControlStatus {
    return { running: this.running, port: this.boundPort, clients: this.clients.size };
  }

  start(port: number): Promise<{ ok: boolean; error?: string; port?: number }> {
    return new Promise((resolve) => {
      this.stop();
      const srv = net.createServer((socket) => {
        this.clients.add(socket);
        socket.setEncoding('utf8');
        socket.write(formatSuiteState(this.opts.getState())); // Begrüßung mit Zustand
        const feed = createLineBuffer((line) => this.handleLine(line, socket));
        socket.on('data', (d) => feed(String(d)));
        socket.on('error', () => {});
        socket.on('close', () => {
          this.clients.delete(socket);
          this.notifyStatus();
        });
        this.notifyStatus();
      });
      srv.on('error', (e) => {
        this.server = null;
        this.running = false;
        this.boundPort = 0;
        this.notifyStatus();
        resolve({ ok: false, error: e.message });
      });
      srv.listen(port, () => {
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
