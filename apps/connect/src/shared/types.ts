// Geteilte Typen für Main, Preload und Renderer (window.jmconnect-API).
//
// Aus der Zoom-Bridge kommen NUR Typen und nur aus '@jm/zoom-bridge/protocol' (Spec 5.1):
// protocol.ts hat selbst keine Importe, darum prüft tsconfig.web.json diese Datei ohne Änderung mit.
import type { AudioReason, AudioState, UserRoleName, VideoReason, VideoState } from '@jm/zoom-bridge/protocol';

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

/**
 * Woher der PROXY_KEY stammt. Der Wert selbst verlässt den Main-Prozess nie.
 *   'env'     — Umgebungsvariable JMPS_PROXY_KEY (hat Vorrang, Feld in der UI wirkungslos)
 *   'stored'  — verschlüsselt hinterlegt (safeStorage)
 *   'session' — nur für diese Sitzung gemerkt (kein OS-Schlüsselbund vorhanden)
 *   'none'    — kein Key
 */
export type ProxyKeySource = 'none' | 'env' | 'stored' | 'session';

/** Cloud-Zugang für die Einstellungs-Oberfläche (ohne den Key selbst). */
export interface ProxyInfo {
  url: string;
  keySource: ProxyKeySource;
  configured: boolean;
}

/** Laufzeit-/Konfigurations-Status der App (Main → Renderer). */
export interface AppStatus {
  /** Cloud-Proxy konfiguriert (URL + Key vorhanden)? */
  configured: boolean;
  proxyBase: string | null;
  /** Herkunft des PROXY_KEY — nie der Key selbst. */
  proxyKeySource: ProxyKeySource;
  /** Steuerport (Companion/Rundown). */
  controlPort: number;
  /** Anzahl aktiver NDI-Sender (freigegebene Gäste). */
  ndiSenders: number;
  /** Programm-Rückkanal-Empfang (Welle 6.2a): 'off'|'searching'|'notfound'|'connected'|'error'|'stopped'. */
  programState: string;
  /** Aufgelöster NDI-Quellname des Programm-Rückkanals (oder null). */
  programSource: string | null;
  /** Ist ein JM Presenter im LAN erreichbar? (Folien-Kopplung, Welle 6.3c.) */
  presenterLinked: boolean;
  /** Zoom-Kurzform für Tray, Kopfzeile und STATE (Spec 5.4); null unter macOS. */
  zoom: ZoomKurz | null;
}

/** Sprecher aus der `.jmshow` — token-frei vom Launcher materialisiert (iveo, Welle 6.3b). */
export interface ShowSpeaker {
  name: string;
  /** Funktion/Rolle, z. B. „Lead Negotiator". */
  title: string | null;
}

/** Die geöffnete Veranstaltung: Sprecher-Liste + deterministische Raum-ID. */
export interface ShowInfo {
  name: string;
  room: string;
  eventName: string | null;
  speakers: ShowSpeaker[];
}

// ── Zoom (Stage 4, Spec 5.4 wörtlich; zwei Zusätze: ZoomParticipant.fehler, ZoomSollEintrag.doppelname) ──

export type ZoomZustand =
  | 'nicht_verfuegbar' // macOS
  | 'einrichtung'      // mindestens ein Mangel (ZoomMangel), oder die Kopie läuft
  | 'bereit'           // auch während „Einrichtung prüfen“ (pruefungLaeuft)
  | 'startet'          // Bridge startet, Anmeldung bei Zoom
  | 'tritt_bei'        // join gesendet, oder Einlass aus dem Warteraum (6.2 Schritt 5)
  | 'warteraum'        // waitingRoom oder waitingForHost
  | 'im_meeting'
  | 'abriss'           // Zoom verbindet neu, oder ein Wiederbeitritt von Connect wartet bzw. läuft
  | 'verlaesst'
  | 'fehler';          // endgültig, bis der Bediener handelt

export type ZoomMangel =
  | 'sdk_fehlt'        // nie eingerichtet
  | 'sdk_defekt'       // pruefeLaufzeit Schritt 1–3 gescheitert (S9)
  | 'bridge_fehlt'     // zoom-bridge.exe fehlt in der Installation (S8)
  | 'zugang_fehlt'     // keine Zugangsdaten (B17)
  | 'zugang_unlesbar'; // safeStorage kann sie nicht entschlüsseln (A5)

/** 'entzogen': war 'ja', dann broadcast mit canRecordRaw:false (3.2-23). */
export type ZoomErlaubnis = 'offen' | 'ja' | 'abgelehnt' | 'abgelaufen' | 'entzogen';

/** Ein laufendes Abo der Bridge. */
export interface ZoomQuelle {
  /** Teilnehmer-ID zum Zeitpunkt des Abos. Gilt nur in dieser Sitzung. */
  aboId: number;
  /** Wörtlich aus dem video-Ereignis (`source`). */
  ndiName: string;
  bild: Exclude<VideoState, 'unsubscribed'>;
  bildGrund: VideoReason;
  /** 'aus' = ohne Ton geladen. */
  ton: AudioState | 'aus';
  tonGrund: AudioReason | null;
  /** Klartext des letzten Fehlers dieses Abos (Abschnitt 8.4). */
  fehler: string | null;
}

/** Ein Zoom-Teilnehmer, wie die Zoom-Karte ihn zeigt. Die eigene Zeile der Bridge fehlt. */
export interface ZoomParticipant {
  /** Zooms GetUserID(). Gilt nur in dieser Sitzung. */
  id: number;
  name: string;
  rolle: UserRoleName;
  kamera: 'an' | 'aus' | 'keine';
  imWarteraum: boolean;
  doppelname: boolean;
  /** Ton-Schalter dieser Zeile (je Teilnehmer-ID, nicht je Name). Vorgabe true, nur änderbar ohne Quelle. */
  tonVorwahl: boolean;
  quelle: ZoomQuelle | null;
  /** „JM Connect – Zoom <name>“, solange noch keine Quelle läuft. */
  ndiNameVorschau: string;
  /** Klartext Q10, wenn ein Browser-Gast denselben NDI-Namen führt. */
  kollision: string | null;
  /**
   * Zeilenfehler (Q2, Q4, Q5, Q8), auch ohne laufende Quelle. Zusatz zu Spec 5.4: Spec 9 Punkt 8
   * verlangt Zeilenfehler auch dort, wo noch keine Quelle läuft, und ZoomQuelle.fehler gibt es erst mit Quelle.
   */
  fehler: string | null;
}

/** Ein Eintrag der Soll-Liste, der gerade keinem Teilnehmer zugeordnet ist. */
export interface ZoomSollEintrag {
  name: string;
  ton: boolean;
  /** Zuletzt gemeldeter NDI-Name, sonst die Vorschau. */
  ndiName: string;
  stand: 'wartet' | 'doppelname' | 'verwaist';
  /** Nur bei 'verwaist': das alte Abo, zum Entladen. */
  aboId: number | null;
  /**
   * Zwei oder mehr fremde Teilnehmer tragen diesen normierten Namen. Zusatz zu Spec 5.4: nur so kann
   * die Karte „Person weg, Quelle schwarz“ bei Doppelname rot mit Q11 zeigen (Spec 9 Punkt 9).
   */
  doppelname: boolean;
}

/** Kurzform für Tray, Kopfzeile und STATE. Teil von AppStatus. */
export interface ZoomKurz {
  zustand: ZoomZustand;
  /** Nur bei 'warteraum'. */
  warten: 'warteraum' | 'host' | null;
  /** Nur bei 'im_meeting' gesetzt, sonst null. */
  erlaubnis: ZoomErlaubnis | null;
  /** n: Abos der laufenden Bridge, deren NDI-Sender existiert. 0, wenn keine Bridge läuft. */
  quellen: number;
  /** Davon nicht im Zustand 'live' (black oder subscribed = erstes Bild steht aus). */
  ohneBild: number;
  /** Offene Soll-Einträge (Begriffe, Abschnitt 4). */
  sollOffen: number;
  /** Nur bei 'abriss': null = Zoom verbindet selbst neu, sonst Versuch 1 bis 5. */
  versuch: number | null;
  /** Alle Mängel der Einrichtung. Nicht leer ⇒ Zustand 'einrichtung'. Während einer laufenden Bridge kann kein Mangel entstehen (Sperre S10). */
  maengel: ZoomMangel[];
  kopieLaeuft: boolean;
}

export interface ZoomAbbild {
  kurz: ZoomKurz;
  einrichtung: {
    sdk: {
      stand: 'fehlt' | 'kopiert' | 'ok' | 'defekt';
      fassung: string | null;
      kopie: { dateien: number; dateienGesamt: number; bytes: number; bytesGesamt: number } | null;
      text: string | null;
    };
    /** `grund` nur bei `session`: 'schreibfehler' = Schlüsselbund da, die Einstellungsdatei ließ sich nicht schreiben. */
    zugang: { herkunft: ProxyKeySource; grund?: 'schreibfehler'; clientIdEnde: string | null; text: string | null };
  };
  anzeigename: string;
  versatz: { gewuenschtMs: number; bestaetigtMs: number | null };
  /** Ohne eigene Zeile. Host und Co-Host zuerst, dann nach Name (de). */
  teilnehmer: ZoomParticipant[];
  soll: ZoomSollEintrag[];
  abriss: { versuch: number | null; versuche: 5; naechsterUm: number | null } | null;
  /** Steht im Meldungsbereich der Karte, in JEDEM Zustand, bis quittiert (Abschnitt 9, Punkt 2). */
  meldung: { art: 'info' | 'warnung' | 'fehler'; text: string; detail: string | null } | null;
  /** Die letzten 5 Hinweise (Fernsteuerung, Ton-Überlauf, verworfene Pakete, Wiederbeitritt). */
  hinweise: string[];
  /** Liegen Nummer und Kenncode noch im Arbeitsspeicher des Main? */
  erneutMoeglich: boolean;
  /** „Einrichtung prüfen“ läuft (Zustand bleibt 'bereit', 6.1). */
  pruefungLaeuft: boolean;
}

export type ZoomErgebnis = { ok: true } | { ok: false; text: string };

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
  /** Join-Links für mehrere Sprecher auf einmal (iveo-Provisionierung). */
  mintGuests: (names: string[]) => Promise<GuestInvite[]>;
  closeRoom: () => Promise<void>;
  /** Zuletzt per Deep-Link geöffnete Show (oder null). */
  getShow: () => Promise<ShowInfo | null>;
  onShow: (cb: (show: ShowInfo | null) => void) => () => void;
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
  /** Folie im JM Presenter blättern (ausgelöst von einem freigegebenen Gast). */
  slideCue: (dir: 'next' | 'prev', guestId: string) => void;
  /** Cloud-Zugang lesen (Adresse + Herkunft des Keys, nie der Key selbst). */
  getProxy: () => Promise<ProxyInfo>;
  /** Cloud-Zugang setzen. Leerer Key löscht den hinterlegten, leere URL setzt die Vorgabe. */
  setProxy: (p: { url?: string; key?: string }) => Promise<ProxyInfo>;
  getStatus: () => Promise<AppStatus>;
  onStatus: (cb: (s: AppStatus) => void) => () => void;
  onTrayCommand: (cb: (cmd: TrayCommand) => void) => () => void;
  /** Steuerbefehle (Companion/Rundown) empfangen und an den DO relayen. Liefert Unsubscribe. */
  onControlCommand: (cb: (cmd: ControlCommand) => void) => () => void;

  // ── Zoom (Stage 4a, Spec 5.5). Nur unter Windows verdrahtet; der Renderer ruft sie nur dort.
  /** Aktuelles Zoom-Abbild. */
  zoomGet: () => Promise<ZoomAbbild>;
  /** Zoom-Abbild abonnieren. Liefert Unsubscribe. */
  onZoom: (cb: (a: ZoomAbbild) => void) => () => void;
  /** Ordner-Dialog, dann SDK prüfen und kopieren. */
  zoomSdkWaehlen: () => Promise<ZoomErgebnis>;
  /** Datei-Dialog für die Zugangsdaten. */
  zoomZugangWaehlen: () => Promise<ZoomErgebnis>;
  /** Zugangsdaten von Hand: nur hinein, es gibt keinen Weg zurück ins Fenster. */
  zoomZugangEintragen: (p: { clientId: string; clientSecret: string }) => Promise<ZoomErgebnis>;
  zoomZugangLoeschen: () => Promise<ZoomErgebnis>;
  /** „Einrichtung prüfen“: Bridge starten, anmelden, beenden, ohne Meeting. */
  zoomPruefen: () => Promise<ZoomErgebnis>;
  /** Der Kenncode geht nur hier in den Main und kommt nie zurück. */
  zoomBeitreten: (p: { nummer: string; kenncode: string; anzeigename: string }) => Promise<ZoomErgebnis>;
  zoomVerlassen: () => Promise<void>;
  zoomLaden: (p: { id: number; ton: boolean; trotzBetriebsgroesse: boolean }) => Promise<ZoomErgebnis>;
  zoomEntladen: (p: { aboId: number }) => Promise<ZoomErgebnis>;
  zoomTon: (p: { id: number; an: boolean }) => Promise<ZoomErgebnis>;
  zoomSollVerwerfen: (p: { name: string }) => Promise<void>;
  zoomVersatz: (p: { ms: number }) => Promise<ZoomErgebnis>;
  zoomErneut: () => Promise<ZoomErgebnis>;
  zoomSchliessen: () => Promise<void>;
  zoomMeldungWeg: () => Promise<void>;
  zoomLogordner: () => Promise<void>;
}
