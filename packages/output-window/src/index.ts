import { BrowserWindow, screen } from 'electron';
import { beobachte } from './bildschirme';
import { AUSGABE_ZU, naechsterAusgabeZustand, type AusgabeEreignis, type AusgabeZustand } from './zustand';

export type { AusgabeArt, AusgabeEreignis, AusgabeZustand } from './zustand';

/** Ein angeschlossener Bildschirm (für die Auswahl im UI). */
export interface DisplayInfo {
  id: number;
  label: string;
  primary: boolean;
  width: number;
  height: number;
}

export interface OpenOutputOptions {
  /**
   * Preload-Pfad der App (stellt die window.jm*-Bridge auch im Ausgabe-Renderer
   * bereit). Weglassen, wenn die Ausgabe ein eigenständiges Dokument ist, das
   * keine IPC-Bridge bekommen soll — etwa der Kiosk des JM App Designers, der
   * exakt das exportierte Bundle laden muss.
   */
  preloadPath?: string;
  /**
   * Rohe URL, die statt des App-Renderers geladen wird (kein `#hash`). Für Tools,
   * deren Ausgabe ein eigenständiges Dokument ist statt einer Ansicht des Renderers
   * — z. B. der Kiosk des JM App Designers (`jmapp://kiosk/index.html`).
   * Hat Vorrang vor `rendererUrl`/`rendererFile`.
   */
  url?: string;
  /** Dev-Renderer-URL (process.env.ELECTRON_RENDERER_URL); im Prod undefined. */
  rendererUrl?: string;
  /** Prod-Renderer-HTML (loadFile), wenn keine rendererUrl gesetzt ist. */
  rendererFile?: string;
  /** Hash-Route, unter der die Ausgabe-Ansicht rendert (Default 'output'). */
  hash?: string;
  /** Ziel-Bildschirm (Default: primärer). */
  displayId?: number;
  /** Fenstertitel. */
  title?: string;
  /**
   * Renderer-Sandbox des Ausgabefensters (P2, #60). Default false (heutiges
   * Verhalten). true setzt die App, sobald ihr Preload sandbox-sicher + als CJS
   * gebaut ist — dann sollten Haupt- UND Ausgabefenster gemeinsam sandboxed sein.
   */
  sandbox?: boolean;
}

/** Liste aller Bildschirme (id/label/primär/Auflösung). */
export function listDisplays(): DisplayInfo[] {
  const primaryId = screen.getPrimaryDisplay().id;
  return screen.getAllDisplays().map((d, i) => ({
    id: d.id,
    label: d.label || `Bildschirm ${i + 1}`,
    primary: d.id === primaryId,
    width: d.size.width,
    height: d.size.height,
  }));
}

/**
 * Bildschirm angesteckt, abgezogen oder geändert (UX Welle 2b): ruft `cb` je Ereignis ohne Nutzlast; gibt die Abmeldung zurück.
 * `screen` gibt es erst nach app.ready, also erst dann aufrufen.
 */
export function beobachteBildschirme(cb: () => void): () => void {
  return beobachte(screen, cb);
}

/**
 * Vollbild-Ausgabefenster auf einem gewählten Bildschirm. Lädt denselben
 * Renderer wie das Hauptfenster unter `#<hash>` (die App rendert dort ihre
 * schlanke Ausgabe-Ansicht). Befehle gehen über `send()` an den Channel; die
 * App lauscht im Ausgabe-Renderer per Preload darauf.
 *
 * Generalisiert aus dem JM-Player-Muster, damit Stage Display / Prompter /
 * weitere Tools dasselbe Verhalten teilen.
 */
export class OutputWindow {
  private win: BrowserWindow | null = null;
  private readonly channel: string;
  private zust: AusgabeZustand = AUSGABE_ZU;
  private readonly hoerer = new Set<(z: AusgabeZustand) => void>();
  private bildschirmHoerer = false;

  constructor(channel = 'output:cmd') {
    this.channel = channel;
  }

  /** Gemessener Zustand des Fensters. */
  zustand(): AusgabeZustand {
    return this.zust;
  }

  /** Meldet jede Änderung des Zustands; gibt die Abmeldung zurück. */
  onZustand(cb: (z: AusgabeZustand) => void): () => void {
    this.hoerer.add(cb);
    return () => {
      this.hoerer.delete(cb);
    };
  }

  private melde(e: AusgabeEreignis): void {
    const neu = naechsterAusgabeZustand(this.zust, e);
    if (neu.art === this.zust.art && neu.displayId === this.zust.displayId) return;
    this.zust = neu;
    for (const cb of [...this.hoerer]) cb(neu);
  }

  open(opts: OpenOutputOptions): void {
    // `screen` gibt es erst nach app.ready, darum erst hier (einmalig) anmelden.
    if (!this.bildschirmHoerer) {
      this.bildschirmHoerer = true;
      screen.on('display-removed', (_e, d) => this.melde({ t: 'bildschirm-weg', displayId: d.id }));
    }
    const hash = opts.hash ?? 'output';
    const displays = screen.getAllDisplays();
    const target =
      (opts.displayId != null ? displays.find((d) => d.id === opts.displayId) : undefined) ??
      screen.getPrimaryDisplay();
    const { x, y, width, height } = target.bounds;

    if (this.win && !this.win.isDestroyed()) {
      // Auf den gewünschten Bildschirm umziehen und (wieder) Vollbild.
      this.win.setFullScreen(false);
      this.win.setBounds({ x, y, width, height });
      this.win.setFullScreen(true);
      // Bei `url` neu laden: das Dokument dahinter kann sich geändert haben (der
      // Kiosk soll das aktuelle Projekt zeigen, nicht das beim ersten Öffnen).
      if (opts.url) this.win.loadURL(opts.url);
      this.win.show();
      this.win.focus();
      this.melde({ t: 'geoeffnet', displayId: target.id, neu: false });
      return;
    }

    const win = new BrowserWindow({
      x,
      y,
      width,
      height,
      backgroundColor: '#000000',
      fullscreen: true,
      show: false,
      title: opts.title ?? 'Ausgabe',
      autoHideMenuBar: true,
      webPreferences: {
        ...(opts.preloadPath ? { preload: opts.preloadPath } : {}),
        sandbox: opts.sandbox ?? false,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    win.on('ready-to-show', () => win.show());
    win.on('closed', () => {
      // Ein später geöffnetes Fenster (this.win) soll das späte `closed` des alten nicht zu machen.
      if (this.win && this.win !== win) return;
      this.win = null;
      this.melde({ t: 'geschlossen' });
    });
    win.webContents.on('render-process-gone', () => this.melde({ t: 'abgestuerzt' }));
    if (opts.url) win.loadURL(opts.url);
    else if (opts.rendererUrl) win.loadURL(`${opts.rendererUrl}#${hash}`);
    else if (opts.rendererFile) win.loadFile(opts.rendererFile, { hash });
    this.win = win;
    this.melde({ t: 'geoeffnet', displayId: target.id, neu: true });
  }

  close(): void {
    if (this.win && !this.win.isDestroyed()) this.win.close();
    this.win = null;
  }

  isOpen(): boolean {
    return this.win != null && !this.win.isDestroyed();
  }

  /**
   * Das geöffnete Fenster (oder null). Für Feinheiten, die diese Klasse nicht
   * kennen muss — Zoom sperren, Tastenkürzel abfangen, Kiosk härten.
   */
  browserWindow(): BrowserWindow | null {
    return this.isOpen() ? this.win : null;
  }

  /** Befehl an den Ausgabe-Renderer schicken (no-op, wenn geschlossen). */
  send(payload: unknown): void {
    if (this.isOpen()) this.win!.webContents.send(this.channel, payload);
  }
}
