// Geteilte Typen für Main, Preload und Renderer (window.jmconnect-API).
//
// Aus der Zoom-Bridge kommen NUR Typen und nur aus '@jm/zoom-bridge/protocol' (Spec 5.1):
// protocol.ts hat selbst keine Importe, darum prüft tsconfig.web.json diese Datei ohne Änderung mit.
import type {
  AudioState, SlotAudioReason, SlotReason, SlotSent, UserRoleName, WireEvent,
} from '@jm/zoom-bridge/protocol';

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

/** Ergebnis eines zoom_*-Befehls als Kennung (Spec 8.6; f9–f14 ab Connect 0.4.0, Spec 8.3): 'ok' oder die Hinweis-ID in Kleinbuchstaben. */
export type ZoomBefehlKennung =
  | 'ok' | 'f1' | 'f2' | 'f3' | 'f4' | 'f5' | 'f6' | 'f7' | 'f8' | 'f9' | 'f10' | 'f11' | 'f12' | 'f13' | 'f14';
/**
 * `abgelehnt` ist true bei F1–F7, F9–F11, F13, F14 (Slot-Spec 8.3). F8 und F12 sind Warnungen, der Befehl wurde ausgeführt.
 */
export interface ZoomBefehlErgebnis { kennung: ZoomBefehlKennung; abgelehnt: boolean }

/**
 * Ein Zoom-Teilnehmer, wie die Zoom-Karte ihn zeigt. Die eigene Zeile der Bridge fehlt. Ab Connect 0.4.0 (Spec 7.10,
 * 10.10) ohne Quelle, Ton-Vorwahl, NDI-Vorschau, Kollision und Zeilenfehler: Bild, Ton und Fehler stehen an der Kachel.
 */
export interface ZoomParticipant {
  /** Zooms GetUserID(). Gilt nur in dieser Sitzung. */
  id: number;
  name: string;
  rolle: UserRoleName;
  /** Aus dem Teilnehmer der Sitzung; der Reducer führt ihn bei `videoStatus` nach (Spec 0.18, 7.10). */
  kamera: 'an' | 'aus' | 'keine';
  imWarteraum: boolean;
  doppelname: boolean;
  /** Laufende Slots (SZ4–SZ6, jeder Modus), deren Ziel diese Person ist oder deren gezeigte Freigabe sie teilt, nach Nummer (10.10). */
  slotNrn: number[];
}

/** Kurzform für Tray, Kopfzeile und STATE. Teil von AppStatus. */
export interface ZoomKurz {
  zustand: ZoomZustand;
  /** Nur bei 'warteraum'. */
  warten: 'warteraum' | 'host' | null;
  /** Nur bei 'im_meeting' gesetzt, sonst null. */
  erlaubnis: ZoomErlaubnis | null;
  /** n: laufende Slots aller Modi, deren NDI-Sender besteht (SZ4, SZ5, SZ6, SZ9; Spec 10.1). 0 ohne Bridge. */
  slotsLaufen: number;
  /** k: davon mit Ersatzbild (SZ6). */
  slotsErsatz: number;
  /** o: offene Slots (Spec 3, 10.1). */
  slotsOffen: number;
  /** e: eingeschaltete Slots, auch vorübergehende und solche mit `anNurMeeting` (10.11). */
  slotsAn: number;
  /** Slots in SZ2 mit Erlaubnis „entzogen“, die in diesem Meeting liefen (10.3, T82). */
  slotsGestopptEntzug: number;
  /**
   * Je angelegtem Slot nach Nummer die Werte für zoom_slot{n}_* (Spec 8.2, 10.4): `live` nur in SZ4/SZ5 und Z6–Z9b, `ziel` nur
   * mit `live` (sonst leer), `alarm` = zählt in o, `tonEin` = Ton eingeschaltet (Computerton eingerechnet), `zustandWort` = Wert
   * von zoom_slot{n}_state.
   */
  slotKurz: Array<{ nr: number; an: boolean; live: boolean; alarm: boolean; tonEin: boolean; modus: ZoomSlotModus; ziel: string; zustandWort: string }>;
  /** Nur bei 'abriss': null = Zoom verbindet selbst neu, sonst Versuch 1 bis 5. */
  versuch: number | null;
  /** Alle Mängel der Einrichtung. Nicht leer ⇒ Zustand 'einrichtung'. Während einer laufenden Bridge kann kein Mangel entstehen (Sperre S10). */
  maengel: ZoomMangel[];
  /** Die Kopie ODER „Zoom-SDK laden“ läuft (Z1b; Spec SDK nachladen 4.4: dieselbe Einrichtungszeile). */
  kopieLaeuft: boolean;
  /** Letzter zoom_*-Befehl der Fernsteuerung (Spec 11.2, 8.6); null vor dem ersten. Hängt nicht am Zustand (7.5). */
  befehl: ZoomBefehlErgebnis | null;
}

export interface ZoomAbbild {
  kurz: ZoomKurz;
  einrichtung: {
    sdk: {
      stand: 'fehlt' | 'kopiert' | 'ok' | 'defekt';
      fassung: string | null;
      kopie: { dateien: number; dateienGesamt: number; bytes: number; bytesGesamt: number } | null;
      /** „Zoom-SDK laden“ bis zum Ende des Entpackens (Spec SDK nachladen 4.4); danach folgt die Kopie mit `kopie`. */
      laden: { phase: 'link' | 'download' | 'pruefen' | 'entpacken'; bytes: number; bytesGesamt: number } | null;
      text: string | null;
    };
    /** `grund` nur bei `session`: 'schreibfehler' = Schlüsselbund da, die Einstellungsdatei ließ sich nicht schreiben. */
    zugang: { herkunft: ProxyKeySource; grund?: 'schreibfehler'; clientIdEnde: string | null; text: string | null };
    /** Nur die Herkunft, nie der Wert (Spec SDK nachladen 4.2). */
    sdkSchluessel: { herkunft: ProxyKeySource };
  };
  anzeigename: string;
  /** `nurSitzung`: Die Einstellungsdatei ließ sich nicht schreiben, der Wert gilt nur bis zum Beenden (N4b.3 Nr. 4, L14). */
  versatz: { gewuenschtMs: number; bestaetigtMs: number | null; nurSitzung: boolean };
  /** Ohne eigene Zeile. Host und Co-Host zuerst, dann nach Name (de). */
  teilnehmer: ZoomParticipant[];
  /** Alle angelegten Slots nach Nummer (Spec 7.1); ein Konstruktor: slotLage() im Kern. */
  slots: ZoomSlotLage[];
  /** Vorgaben für neue Slots und Sprecher-Einstellungen (Spec 7.6). */
  vorgaben: ZoomSlotVorgaben;
  sprecher: ZoomSprecherEinstellung;
  /** Schalter „Vorschau“ (7.7); `vorschauVerfuegbar` false nach previewUnavailable (T57). */
  vorschauAn: boolean;
  vorschauVerfuegbar: boolean;
  /** {detail} von T57 an der Kachel (HRESULT aus previewUnavailable, 6.4); null, solange die Vorschau verfügbar ist. */
  vorschauDetail: string | null;
  /** Zustimmung zu mehr als 5 eingeschalteten Slots (E4, 7.4). */
  ueber5: boolean;
  /** Messwerte (Spec 7.8). */
  messwerte: ZoomMesswerte;
  /** Einstellungsdatei: Werte nur für diese Sitzung (T92), Name der Sicherungskopie einer unlesbaren Datei (T90). */
  einstellungen: { nurSitzung: boolean; gesichert: string | null };
  abriss: { versuch: number | null; versuche: 5; naechsterUm: number | null } | null;
  /** Steht im Meldungsbereich der Karte, in JEDEM Zustand, bis quittiert (Abschnitt 9, Punkt 2). */
  meldung: { art: 'info' | 'warnung' | 'fehler'; text: string; detail: string | null } | null;
  /** Die letzten 5 Hinweise (Fernsteuerung, Ton-Überlauf, verworfene Pakete, Wiederbeitritt). */
  hinweise: string[];
  /** Liegen Nummer und Kenncode noch im Arbeitsspeicher des Main? */
  erneutMoeglich: boolean;
  /** „Einrichtung prüfen“ läuft (Zustand bleibt 'bereit', 6.1). */
  pruefungLaeuft: boolean;
  /** Eine gestoppte Bridge baut noch ab (Sperre S10, L13). */
  abbauLaeuft: boolean;
}

// ── Zoom-Slots (Connect 0.4.0, Spec 7.1 wörtlich; additiv: die Quellen-Typen oben entfallen erst in Plan B, Task B12) ──

export type ZoomSlotModus = 'teilnehmer' | 'sprecher' | 'freigabe';
export type ZoomSlotAufloesung = '360p' | '720p' | '1080p';
export type ZoomSlotErsatzbild = 'transparent' | 'eingefroren' | 'schwarz' | 'weiss';
export type ZoomSlotTonArt = 'mischton' | 'person';
export type ZoomSprecherSignal = 'sprecherVideo' | 'aktivesVideo' | 'tonAktiv';
export type TonQuelle = 'mix' | 'person' | 'share' | 'mixShare' | 'none';  // wie slotAudio.source (6.3)
// SlotReason, SlotAudioReason, SlotSent ('none' | 'transparent' | 'freeze' | 'black' | 'white' | 'held') kommen aus @jm/zoom-bridge/protocol

/** Am Rechner gespeichert (connect-settings.json, zoomSlots). Ein Konstruktor: normiereSlot(). */
export interface ZoomSlotEinstellung {
  nr: number;                       // 1..16, fest (E2)
  ndiName: string;                  // E26
  modus: ZoomSlotModus;
  person: string;                   // Anzeigename, nur Teilnehmer; '' = keine Person gewählt
  an: boolean;                      // Start-Taste
  aufloesung: ZoomSlotAufloesung;
  ersatzbild: ZoomSlotErsatzbild;   // Vorgabe 'transparent'
  tonAn: boolean;                   // Meeting-Ton (Mischton oder Person) an/aus
  tonArt: ZoomSlotTonArt;           // Vorgabe 'mischton'
  computerton: boolean;             // nur Freigabe, Vorgabe true (O4); eigener Schalter (Abbildung tonFuerBridge, main/zoom/slots.ts)
  ohneKamera: boolean;              // nur Sprecher: „Teilnehmer ohne Kamera zeigen“, Vorgabe true (0.28)
}
export interface ZoomSlotVorgaben { aufloesung: ZoomSlotAufloesung; tonAn: boolean }  // Vorgabe 720p, Ton an
export interface ZoomSprecherEinstellung { signal: ZoomSprecherSignal; haltezeitMs: number } // Vorgabe sprecherVideo, 1000

/** Ein Ereignis der Bridge ohne `ev` (Messwerte, Spec 6.3, 7.8). */
type Gemeldet<E extends string> = Omit<Extract<WireEvent, { ev: E }>, 'ev'>;
/**
 * Messwerte (Spec 7.8) so, wie die Bridge sie zuletzt gemeldet hat; leer, solange nichts gemeldet ist (keine erfundenen Werte).
 * Namen stehen nur in `sprecherSignale` (für die Anzeige), nie im Log und nie in „Messwerte kopieren“ (0.23).
 */
export interface ZoomMesswerte {
  bridge: Gemeldet<'bridgeStats'> | null;
  /** Je laufendem Slot das letzte slotStats, nach Nummer. */
  slots: Gemeldet<'slotStats'>[];
  freigaben: Gemeldet<'shares'> | null;
  /** Die letzten 20 Sprecher-Signale aller drei Rückrufe, mit den Namen der Kennungen. */
  sprecherSignale: Array<Gemeldet<'speakerSignal'> & { namen: string[] }>;
}

/** Slot-Zustände (10.1), 12 Werte. */
export type ZoomSlotZustand =
  | 'aus' | 'ohne_meeting' | 'wartet_erlaubnis' | 'startet' | 'zeigt' | 'gehalten'
  | 'ersatz' | 'keine_antwort' | 'gescheitert' | 'stoppt' | 'zurueckgestellt' | 'geplant';

/** Ein Slot im Abbild (Main → Fenster). Ein Konstruktor: slotLage() im Kern (Plan B, Task B12). */
export interface ZoomSlotLage {
  einstellung: ZoomSlotEinstellung;
  voruebergehend: boolean;           // per zoom_load angelegt, nur bis Meeting-Ende, nie gespeichert (7.2)
  anNurMeeting: boolean;             // dauerhafter Slot, per zoom_load nur für dieses Meeting eingeschaltet (7.2, FR10)
  zustand: ZoomSlotZustand;
  grund: SlotReason | null;          // letzter Grund der Bridge
  gesendet: SlotSent | null;         // `sent` der Bridge (6.12): was der Sender gerade zusätzlich schickt
  zielName: string | null;           // wen der Slot zeigt oder erwartet (für Texte, nie im Log)
  doppelt: number;                   // > 1 nur, wenn keine gültige gewaehlteId besteht (7.3 Nr. 5)
  zweifel: boolean;                  // T13b: gezeigte Person gegangen, ein Namensvetter war schon vorher da
  imWarteraum: boolean;
  wahl: { id: number; name: string; hinweis: string }[] | null;  // bei doppelt > 1 oder zweifel
  geliefert: { b: number; h: number; fps: number } | null;        // nur aus dem laufenden Fenster dieses Ziels
  zuletzt: { b: number; h: number } | null;                       // letzte Größe dieses Ziels (T51c)
  ton: AudioState | 'aus'; tonGrund: SlotAudioReason | null;
  tonQuelle: TonQuelle; tonEingestellt: TonQuelle;                // gemessen bzw. eingestellt (6.3)
  offen: boolean;                    // zählt in o (10.1)
  liefSchon: boolean;                // lief in diesem Meeting schon (0.12)
  zeigteSchon: boolean;              // Teilnehmer-Slot zeigte in diesem Meeting schon die eingestellte Person; gesetzt
                                     // nur von `slot live` mit mode participant und target = gewaehlteId (N3);
                                     // fällt bei Person- und Moduswechsel (7.3 Nr. 7, 0.12, FR7)
  andererSlot: number | null;        // T97: ein anderer laufender Slot hat dasselbe Ziel
  fehler: string | null;             // Klartext (9.6), Regeln 10.9
  ndiWarnung: string | null;         // T46: ein Browser-Gast sendet unter diesem NDI-Namen (Warnung, 7.5 Nr. 9, E26)
  text: string; tonText: string | null; messText: string | null;  // fertige Zeilen der Kachel (10.2, 10.6, 10.7);
                                     // null = keine Zeile (Ton: nur in SZ9 mit eingestelltem Ton; Restrunde RR6, N5)
}

export type ZoomErgebnis = { ok: true } | { ok: false; text: string };

/** Antwort von zoomSlotStart und zoomSlotAusPerson (Spec 7.4, 7.9): ab dem 6. eingeschalteten Slot ohne Zustimmung T40. */
export type ZoomStartErgebnis = ZoomErgebnis | { ok: false; nachfrage: true; text: string };
/** Vorschaubild eines Slots (Spec 7.7): Push jmc:zoom-vorschau-bild, nie im Abbild, nie im Log. */
export interface ZoomVorschauBild { nr: number; ziel: number; w: number; h: number; jpeg: string }

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
  /** „Zoom-SDK laden“: Link vom Proxy, Download, Prüfung, Entpacken, dann dieselbe Kopie wie die Ordnerwahl. */
  zoomSdkLaden: () => Promise<ZoomErgebnis>;
  /** Bricht ein laufendes Laden ab (Phasen link bis entpacken). */
  zoomSdkLadenAbbrechen: () => Promise<void>;
  /** Datei-Dialog für die Zugangsdaten. */
  zoomZugangWaehlen: () => Promise<ZoomErgebnis>;
  /** Zugangsdaten von Hand: nur hinein, es gibt keinen Weg zurück ins Fenster. */
  zoomZugangEintragen: (p: { clientId: string; clientSecret: string }) => Promise<ZoomErgebnis>;
  zoomZugangLoeschen: () => Promise<ZoomErgebnis>;
  /** SDK-Schlüssel für „Zoom-SDK laden“: nur hinein, es gibt keinen Weg zurück ins Fenster. */
  zoomSdkSchluesselEintragen: (p: { schluessel: string }) => Promise<ZoomErgebnis>;
  zoomSdkSchluesselLoeschen: () => Promise<ZoomErgebnis>;
  /** „Einrichtung prüfen“: Bridge starten, anmelden, beenden, ohne Meeting. */
  zoomPruefen: () => Promise<ZoomErgebnis>;
  /** Der Kenncode geht nur hier in den Main und kommt nie zurück. */
  zoomBeitreten: (p: { nummer: string; kenncode: string; anzeigename: string }) => Promise<ZoomErgebnis>;
  zoomVerlassen: () => Promise<void>;
  /** Wiederbeitritt abbrechen (nur Z11, Spec 6.8): Meldung R7, „Erneut beitreten“ behält Nummer, Kenncode und gemerkte Quellen. */
  zoomAbbrechen: () => Promise<void>;
  zoomVersatz: (p: { ms: number }) => Promise<ZoomErgebnis>;
  zoomErneut: () => Promise<ZoomErgebnis>;
  zoomSchliessen: () => Promise<void>;
  zoomMeldungWeg: () => Promise<void>;
  // ── Zoom-Slots (Connect 0.4.0, Spec 7.9). Jede Nutzlast geht als Ganzes durch die Preload; die Hülle prüft sie.
  zoomSlotAnlegen: () => Promise<ZoomErgebnis & { nr?: number }>;
  zoomSlotAendern: (p: { nr: number; aenderung: Partial<Omit<ZoomSlotEinstellung, 'nr' | 'an'>> }) => Promise<ZoomErgebnis>;
  zoomSlotLoeschen: (p: { nr: number }) => Promise<ZoomErgebnis>;
  zoomSlotStart: (p: { nr: number; an: boolean; trotz?: boolean }) => Promise<ZoomStartErgebnis>;
  zoomSlotAusPerson: (p: { teilnehmerId: number; trotz?: boolean }) => Promise<ZoomStartErgebnis>;
  zoomSlotPerson: (p: { nr: number; teilnehmerId: number }) => Promise<ZoomErgebnis>;
  zoomSlotVorgaben: (p: ZoomSlotVorgaben) => Promise<ZoomErgebnis>;
  zoomSprecher: (p: ZoomSprecherEinstellung) => Promise<ZoomErgebnis>;
  zoomVorschauSchalten: (p: { an: boolean }) => Promise<ZoomErgebnis>;
  /** Messwerte ohne Teilnehmer- und NDI-Namen für die Zwischenablage (7.8). */
  zoomMesswerteText: () => Promise<string>;
  zoomSlotBehalten: (p: { nr: number }) => Promise<ZoomErgebnis>;
  /** Vorschaubilder abonnieren (Push, 7.7). Liefert Unsubscribe. */
  onZoomVorschauBild: (cb: (b: ZoomVorschauBild) => void) => () => void;
  zoomLogordner: () => Promise<void>;
}
