import { request, type ClientRequest, type IncomingMessage } from 'node:http';
import type { PresenterScreen, PresenterSource } from '@shared/types';

export const PRESENTER_OFFLINE: PresenterSource = {
  connected: false,
  active: false,
  index: 0,
  total: 0,
  title: '',
  notes: '',
  nextTitle: null,
  screen: 'live',
  rev: 0,
};

const RECONNECT_MS = 2000;
// Der Presenter-SSE-Server sendet alle 15 s einen Keep-alive-Ping (": ping").
// Bleiben Daten UND Pings länger als STALE_MS aus, ist die Verbindung halb-tot
// (lautloser TCP-Abbruch durch Netz-Blip/Standby feuert weder `end` noch `error`)
// → der Client hinge „connected", bekäme aber keine frischen Folien mehr und
// würde erst nach einem Presenter-Neustart wieder etwas zeigen (#87). Ein
// Watchdog erzwingt dann einen Reconnect.
const STALE_MS = 35000;
const WATCHDOG_MS = 10000;

/** The compact view the JM Presenter remote broadcasts over SSE (`/events`). */
interface IncomingView {
  active: boolean;
  index: number;
  total: number;
  screen: PresenterScreen;
  title: string;
  notes: string;
  nextTitle: string | null;
  rev: number;
}

/**
 * Server-Sent-Events client onto the JM Presenter's network remote (`/events`,
 * default port 7330). The presenter already pushes its live reference view
 * (current/next title, notes, position) to connected phones — we tap the same
 * stream so the stage display can mirror it. Node has no EventSource, so we read
 * the chunked stream and split on the SSE record separator ("\n\n") ourselves.
 *
 * The presenter must have its Fernsteuerung (network remote) enabled. If that
 * remote runs with a PIN, pass it through; a PIN-less remote needs no token.
 */
export class PresenterClient {
  private req: ClientRequest | null = null;
  private res: IncomingMessage | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private watchdogTimer: ReturnType<typeof setInterval> | null = null;
  private lastRx = 0;
  private active = false;
  private host = '';
  private port = 0;
  private pin = '';
  private buf = '';
  private readonly onChange: (s: PresenterSource) => void;

  constructor(onChange: (s: PresenterSource) => void) {
    this.onChange = onChange;
  }

  connect(host: string, port: number, pin: string): void {
    this.disconnect();
    this.active = true;
    this.host = host;
    this.port = port;
    this.pin = pin;
    this.open();
  }

  private open(): void {
    if (!this.active) return;
    this.buf = '';
    const path = this.pin ? `/events?pin=${encodeURIComponent(this.pin)}` : '/events';
    const req = request(
      { host: this.host, port: this.port, path, method: 'GET', headers: { Accept: 'text/event-stream' } },
      (res) => {
        if (res.statusCode !== 200) {
          // 401 = PIN required/wrong; anything else = not reachable. Drain + retry.
          res.resume();
          this.onChange({ ...PRESENTER_OFFLINE });
          this.scheduleReconnect();
          return;
        }
        this.res = res;
        res.setEncoding('utf8');
        // Reachable: mark connected even before the first slide event arrives.
        this.onChange({ ...PRESENTER_OFFLINE, connected: true });
        this.startWatchdog();
        res.on('data', (chunk: string) => this.feed(chunk));
        res.on('end', () => {
          this.stopWatchdog();
          this.onChange({ ...PRESENTER_OFFLINE });
          this.scheduleReconnect();
        });
        // Ohne 'error'-Handler auf der Response wird ein „socket hang up" (Server
        // bricht den Stream ab) zur uncaughtException → App-Crash (#87, Symptom A).
        res.on('error', () => {
          this.stopWatchdog();
          this.onChange({ ...PRESENTER_OFFLINE });
          this.scheduleReconnect();
        });
      },
    );
    req.on('error', () => {
      this.stopWatchdog();
      this.onChange({ ...PRESENTER_OFFLINE });
      this.scheduleReconnect();
    });
    req.end();
    this.req = req;
  }

  /** Accumulate the stream and parse complete "\n\n"-delimited SSE records. */
  private feed(chunk: string): void {
    // Jeder Chunk — auch die ": ping"-Keep-alives — zählt als Lebenszeichen.
    this.lastRx = Date.now();
    this.buf += chunk;
    let sep: number;
    while ((sep = this.buf.indexOf('\n\n')) >= 0) {
      const record = this.buf.slice(0, sep);
      this.buf = this.buf.slice(sep + 2);
      this.handleRecord(record);
    }
  }

  private handleRecord(record: string): void {
    for (const line of record.split('\n')) {
      if (!line.startsWith('data:')) continue; // skip comments (": ping") and "retry:"
      const json = line.slice(5).trim();
      if (!json) continue;
      try {
        this.onChange(this.map(JSON.parse(json) as IncomingView));
      } catch {
        /* ignore malformed records */
      }
    }
  }

  private map(v: IncomingView): PresenterSource {
    return {
      connected: true,
      active: v.active === true,
      index: Number.isFinite(v.index) ? v.index : 0,
      total: Number.isFinite(v.total) ? v.total : 0,
      title: typeof v.title === 'string' ? v.title : '',
      notes: typeof v.notes === 'string' ? v.notes : '',
      nextTitle: typeof v.nextTitle === 'string' ? v.nextTitle : null,
      screen: v.screen === 'black' || v.screen === 'white' ? v.screen : 'live',
      rev: Number.isFinite(v.rev) ? v.rev : 0,
    };
  }

  private scheduleReconnect(): void {
    if (!this.active) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this.open(), RECONNECT_MS);
  }

  /** Liveness-Watchdog: schlägt zu, wenn weder Folien-Events noch Pings ankommen. */
  private startWatchdog(): void {
    this.stopWatchdog();
    this.lastRx = Date.now();
    this.watchdogTimer = setInterval(() => {
      if (!this.active) return;
      if (Date.now() - this.lastRx > STALE_MS) this.forceReconnect();
    }, WATCHDOG_MS);
  }

  private stopWatchdog(): void {
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }

  /**
   * Reißt req/res sicher ab. removeAllListeners() entfernt die Reconnect-Handler,
   * aber destroy() kann danach noch synchron/asynchron ein „socket hang up"-'error'
   * nachfeuern — ohne Listener wäre das eine uncaughtException → App-Crash (#87,
   * Symptom A). Darum vor dem destroy() einen schluckenden 'error'-Handler setzen.
   */
  private teardown(stream: ClientRequest | IncomingMessage | null): void {
    if (!stream) return;
    stream.removeAllListeners();
    stream.on('error', () => {});
    stream.destroy();
  }

  /** Halb-tote Verbindung verwerfen und sofort neu aufbauen (#87). */
  private forceReconnect(): void {
    this.stopWatchdog();
    this.teardown(this.res);
    this.res = null;
    this.teardown(this.req);
    this.req = null;
    this.onChange({ ...PRESENTER_OFFLINE });
    this.open();
  }

  disconnect(): void {
    this.active = false;
    this.stopWatchdog();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.teardown(this.res);
    this.res = null;
    this.teardown(this.req);
    this.req = null;
    this.onChange({ ...PRESENTER_OFFLINE });
  }
}
