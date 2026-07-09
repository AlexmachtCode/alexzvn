// Geteilte Typen für Main, Preload und Renderer (window.jmconnect-API).

/** Ergebnis von openRoom: alles, was der Operator-Renderer zum Verbinden braucht. */
export interface RoomSession {
  room: string;
  /** Vollständige WebSocket-URL zum ConnectRoom-DO inkl. Operator-Token. */
  wsUrl: string;
  /** HTTPS-Basis des Cloud-Proxys (für Gast-Links/QR), z. B. https://proxy.example.com. */
  proxyBase: string;
}

/** Ergebnis von mintGuest: ein einladbarer Gast. */
export interface GuestInvite {
  guestId: string;
  name: string;
  /** Öffentlicher Join-Link (Gast-Seite + Token), als QR verteilbar. */
  joinUrl: string;
}

/** Laufzeit-/Konfigurations-Status der App (Main → Renderer). */
export interface AppStatus {
  /** Cloud-Proxy konfiguriert (URL + Key vorhanden)? */
  configured: boolean;
  proxyBase: string | null;
  /** Steuerport (Companion/Rundown). */
  controlPort: number;
  /** Anzahl aktiver NDI-Sender (freigegebene Gäste). */
  ndiSenders: number;
  /** Programm-Rückkanal-Empfang (Welle 6.2a): 'off'|'searching'|'notfound'|'connected'|'error'|'stopped'. */
  programState: string;
  /** Aufgelöster NDI-Quellname des Programm-Rückkanals (oder null). */
  programSource: string | null;
}

export type TrayCommand = { kind: 'show' } | { kind: 'closeRoom' };

/** Steuerbefehl vom TCP-Protokoll (Companion/Rundown), den der Renderer an den DO relayt. */
export interface ControlCommand {
  verb: string;
  args: string[];
}

/** Die unter window.jmconnect bereitgestellte API. */
export interface JmConnectApi {
  platform: string;
  openRoom: (room?: string) => Promise<RoomSession>;
  mintGuest: (name: string) => Promise<GuestInvite>;
  closeRoom: () => Promise<void>;
  /** NDI-Sender einer Quelle starten (spinUpNdi). `key` = Pool-Schlüssel: Gast-ID oder `<id>::screen`. */
  ndiUp: (key: string, label: string) => void;
  /** NDI-Sender einer Quelle stoppen (tearDownNdi). Kamera-Schlüssel räumt auch den Bildschirm ab. */
  ndiDown: (key: string) => void;
  /** Abgeleiteten STATE ans Steuerprotokoll melden (Companion/Rundown/Health). */
  pushControlState: (kv: Record<string, string | number | boolean>) => void;
  /** Diagnose-Zeile des versteckten Peers ins Main-/Terminal-Log spiegeln. */
  peerLog: (msg: string) => void;
  /** Auditierbaren Vorgang protokollieren (Spur S4 hängt hier später ein Audit-Log an). */
  audit: (event: string, detail?: string) => void;
  getStatus: () => Promise<AppStatus>;
  onStatus: (cb: (s: AppStatus) => void) => () => void;
  onTrayCommand: (cb: (cmd: TrayCommand) => void) => () => void;
  /** Steuerbefehle (Companion/Rundown) empfangen und an den DO relayen. Liefert Unsubscribe. */
  onControlCommand: (cb: (cmd: ControlCommand) => void) => () => void;
}
