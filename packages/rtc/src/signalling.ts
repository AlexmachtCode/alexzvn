// @jm/rtc/signalling — dünner, isomorpher WebSocket-Client zum ConnectRoom-DO (Welle 6).
//
// Nutzt das globale WebSocket (Browser-Gast-Seite, Electron-Renderer, Node ≥ 22). Der DO selbst
// nutzt serverseitig Cloudflare-WebSockets und braucht nur die Nachrichtentypen aus ./protocol —
// diesen Client also NICHT im Worker importieren. Auto-Reconnect mit exponentiellem Backoff.

export interface SignallingOptions {
  url: string;
  onMessage: (msg: unknown) => void;
  onOpen?: () => void;
  onClose?: () => void;
  /** Reconnect-Backoff-Grenzen (ms). */
  minBackoffMs?: number;
  maxBackoffMs?: number;
  /** Für Tests/Node-Umgebungen ohne globales WebSocket injizierbar. */
  WebSocketImpl?: typeof WebSocket;
}

export class SignallingClient {
  private ws: WebSocket | null = null;
  private closed = false;
  private backoff: number;
  private readonly WS: typeof WebSocket;

  constructor(private readonly opts: SignallingOptions) {
    this.backoff = opts.minBackoffMs ?? 500;
    const WS = opts.WebSocketImpl ?? (globalThis as { WebSocket?: typeof WebSocket }).WebSocket;
    if (!WS) throw new Error('Kein WebSocket verfügbar (globalThis.WebSocket fehlt).');
    this.WS = WS;
  }

  connect(): void {
    this.closed = false;
    this.open();
  }

  private open(): void {
    const ws = new this.WS(this.opts.url);
    this.ws = ws;
    ws.addEventListener('open', () => {
      this.backoff = this.opts.minBackoffMs ?? 500;
      this.opts.onOpen?.();
    });
    ws.addEventListener('message', (ev: MessageEvent) => {
      if (typeof ev.data !== 'string') return;
      let data: unknown;
      try {
        data = JSON.parse(ev.data);
      } catch {
        return;
      }
      this.opts.onMessage(data);
    });
    ws.addEventListener('close', () => {
      this.opts.onClose?.();
      if (!this.closed) this.scheduleReconnect();
    });
    ws.addEventListener('error', () => {
      try {
        ws.close();
      } catch {
        /* wird über 'close' reconnected */
      }
    });
  }

  private scheduleReconnect(): void {
    const wait = this.backoff;
    this.backoff = Math.min(this.backoff * 2, this.opts.maxBackoffMs ?? 10_000);
    setTimeout(() => {
      if (!this.closed) this.open();
    }, wait);
  }

  send(msg: unknown): void {
    if (this.ws && this.ws.readyState === 1 /* OPEN */) this.ws.send(JSON.stringify(msg));
  }

  close(): void {
    this.closed = true;
    try {
      this.ws?.close();
    } catch {
      /* egal */
    }
    this.ws = null;
  }
}
