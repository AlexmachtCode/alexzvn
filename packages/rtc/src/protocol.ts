// @jm/rtc/protocol — Room-Protokoll & Signalling-Nachrichten der Remote-A/V-Ebene (Welle 6).
// Reine Typen + JSON-Nachrichten, isomorph: identisch nutzbar auf der Browser-Gast-Seite, in der
// Electron-App (JM Connect) und im Cloudflare Durable Object. KEINE node/electron/DOM-Imports —
// dieselbe Disziplin wie @jm/suite-control-protocol/index und @jm/control-config.

export type Tally = 'off' | 'preview' | 'program';

export type GuestPhase =
  | 'joining' // WS verbunden, Token gültig — noch nicht im Warteraum sichtbar
  | 'lobby' // im Warteraum, wartet auf Operator-Freigabe (KEINE Publish-Rechte)
  | 'approved' // freigegeben: publiziert, Vorschau/Preview — noch nicht auf Sendung
  | 'onair' // auf Programm
  | 'off' // war auf Sendung, jetzt zurück auf Preview (publiziert weiter)
  | 'left' // hat den Raum verlassen (terminal)
  | 'kicked' // vom Operator entfernt (terminal)
  | 'disconnected'; // Verbindung weg, Slot kurz gehalten (Rejoin möglich)

export interface Guest {
  id: string;
  name: string;
  phase: GuestPhase;
  tally: Tally;
  /** Zeitpunkt (Unix-ms) der Aufnahme-/Broadcast-Einwilligung; ohne diese kein onair (Spur S3). */
  consentAt: number | null;
  muted: boolean;
  hasVideo: boolean;
  hasScreen: boolean;
  /**
   * Darf der Gast die Folien im JM Presenter weiterblättern (Welle 6.3c)? Standard: nein.
   * Der Operator erteilt das ausdrücklich — ein Remote-Gast steuert sonst ungefragt den Saal.
   */
  canAdvance: boolean;
  joinedAt: number;
}

/** Richtung eines Folien-Kommandos. Mehr braucht die Fernbedienung eines Sprechers nicht. */
export type SlideDir = 'next' | 'prev';

export type TalkbackMode = 'off' | 'selected' | 'all';

export interface RoomState {
  room: string;
  guests: Guest[];
  /** Als Nächstes „scharf“ geschalteter Gast (Standby → GO, die eine Rundown-Zeile). */
  standbyId: string | null;
  talkback: { mode: TalkbackMode; target: string | null };
}

// ── Operator-Aktionen (App/Rundown/Companion → DO) ─────────────────────────
export type OperatorAction =
  | { t: 'approve'; guestId: string }
  | { t: 'deny'; guestId: string }
  | { t: 'onair'; guestId: string }
  | { t: 'off'; guestId: string }
  | { t: 'standby'; guestId: string }
  | { t: 'go' }
  | { t: 'next' }
  | { t: 'kick'; guestId: string }
  | { t: 'mute'; guestId: string; on: boolean }
  | { t: 'talkback'; mode: TalkbackMode; target?: string | null }
  | { t: 'slides'; guestId: string; on: boolean };

// ── Gast-Lebenszyklus-Ereignisse (Gast-Seite/DO-intern → Reducer) ──────────
export type GuestEvent =
  | { t: 'guestJoin'; guestId: string; name: string; hasVideo?: boolean; hasScreen?: boolean }
  | { t: 'guestConsent'; guestId: string }
  | { t: 'guestTracks'; guestId: string; hasVideo?: boolean; hasScreen?: boolean }
  | { t: 'guestSlide'; guestId: string; dir: SlideDir }
  | { t: 'guestLeave'; guestId: string }
  | { t: 'guestDisconnect'; guestId: string };

export type RoomEvent = OperatorAction | GuestEvent;

// ── Effekte (Reducer → DO/App-Seiteneffekte) ───────────────────────────────
// Der Reducer bleibt rein; Seiteneffekte werden als Daten zurückgegeben. Der DO setzt Publish-
// Rechte, die App-Main mappt spinUpNdi/tearDownNdi auf ihren utilityProcess-Sender-Pool.
//
// `stream` unterscheidet die beiden NDI-Quellen eines Gasts (Welle 6.3): seine Kamera und sein
// geteilter Bildschirm. Fehlt das Feld, ist die Kamera gemeint (Abwärtskompatibilität).
export type GuestStream = 'cam' | 'screen';

export type RoomEffect =
  | { t: 'grantPublish'; guestId: string } // DO: SFU-Publish erlauben / ICE-Creds herausgeben
  | { t: 'revokePublish'; guestId: string }
  | { t: 'spinUpNdi'; guestId: string; label: string; stream?: GuestStream } // App: NDI-Sender-utilityProcess forken
  | { t: 'tearDownNdi'; guestId: string; stream?: GuestStream }
  | { t: 'tally'; guestId: string; tally: Tally }
  // App: Folie im JM Presenter blättern (Control-Plane). Entsteht NUR, wenn der Operator dem
  // Gast die Folien-Steuerung erteilt hat — das Gate sitzt im Reducer, nicht in der Oberfläche.
  | { t: 'slideCue'; guestId: string; dir: SlideDir }
  | { t: 'notify'; guestId: string; code: 'consentRequired' | 'denied' | 'kicked' };

/**
 * Pool-Schlüssel der NDI-Sender. Kamera = die nackte Gast-ID (unverändert seit 6.1), Bildschirm =
 * eigener Schlüssel. Beide Seiten (DO-Effekt-Konsument und Sender-Pool) leiten ihn hieraus ab,
 * damit die Namensregel an genau EINER Stelle steht.
 */
export function ndiPoolKey(guestId: string, stream: GuestStream = 'cam'): string {
  return stream === 'screen' ? `${guestId}::screen` : guestId;
}

/**
 * Track-Namen der SFU sind global eindeutig und tragen die Art im Suffix. Sie sind die einzige
 * Korrelation zwischen Gast-Publish und Peer-Subscribe — deshalb hier zentral, statt an mehreren
 * Stellen per `endsWith` geraten zu werden.
 */
export type GuestTrackKind = 'video' | 'audio' | 'screen';

export function guestTrackName(guestId: string, kind: GuestTrackKind): string {
  return `${guestId}-${kind}`;
}

export function guestTrackKind(trackName: string): GuestTrackKind {
  if (trackName.endsWith('-audio')) return 'audio';
  if (trackName.endsWith('-screen')) return 'screen';
  return 'video';
}

// ── Signalling-Nachrichten über den DO-WebSocket ───────────────────────────
// SDP/ICE werden nur relayt; die App/DO spricht die SFU-HTTP-API (App-Secret bleibt serverseitig,
// nie im Browser). JSON-Discriminated-Unions über das Feld `t`.
export interface SdpDescription {
  type: 'offer' | 'answer';
  sdp: string;
}

export type GuestToServer =
  | { t: 'hello'; token: string; name: string }
  | { t: 'consent' }
  | { t: 'offer'; sdp: SdpDescription }
  | { t: 'answer'; sdp: SdpDescription }
  | { t: 'ice'; candidate: unknown }
  | { t: 'bye' };

export type OperatorToServer = { t: 'opHello'; adminToken: string } | OperatorAction;

export type ServerToClient =
  | { t: 'welcome'; you?: string; state: RoomState }
  | { t: 'state'; state: RoomState }
  | { t: 'offer'; sdp: SdpDescription } // Renegotiation-Offer an den Peer
  | { t: 'answer'; sdp: SdpDescription }
  | { t: 'ice'; candidate: unknown }
  | { t: 'tally'; tally: Tally }
  | { t: 'needConsent' }
  | { t: 'error'; code: string; message?: string };

// ── Rückkanal-Signalling (Welle 6.2) über den DO-WebSocket ─────────────────
// Der versteckte Peer publisht EINEN geteilten Programm-Track (`program-video`, Switcher-PGM) auf
// seiner SFU-Session; jeder Gast zieht ihn in seine eigene Publish-Session. SDP wird nur relayt —
// das App-Secret bleibt serverseitig. Lose JSON (der DO/Peer/Gast prüft nur `t`); hier zur
// Dokumentation getypt. `program-video` ist der stabile Trackname des Programm-Rückkanals.
export const PROGRAM_TRACK = 'program-video' as const;

/** Peer → DO: Programm-Track auf der Peer-Session anbieten (Renegotiation-Offer). */
export interface PeerPublishMsg {
  t: 'peerPublish';
  sessionId: string;
  offer: SdpDescription;
  tracks: { mid: string | null; trackName: string }[];
}
/** DO → Peer: Answer auf den Programm-Publish. */
export interface PeerPublishedMsg {
  t: 'peerPublished';
  answer?: SdpDescription;
}
/** Gast → DO: Programm-Track sehen wollen (nach eigenem Publish bzw. auf returnAvailable). */
export interface WantReturnMsg {
  t: 'wantReturn';
}
/** DO → Gast: ein Programm-Track ist (neu) verfügbar → (erneut) `wantReturn` senden. */
export interface ReturnAvailableMsg {
  t: 'returnAvailable';
}
/** DO → Gast: Renegotiation-Offer der SFU, der den Programm-Track in die Gast-Session zieht. */
export interface ReturnOfferMsg {
  t: 'returnOffer';
  sdp: SdpDescription;
  tracks: { mid: string; kind: 'video' | 'audio' }[];
  renegotiate?: boolean;
}
/** Gast → DO: Answer auf den Rückkanal-Offer → an die SFU. */
export interface ReturnAnswerMsg {
  t: 'returnAnswer';
  sdp: SdpDescription;
}

export const RTC_PROTO = 'jmrtc/1' as const;
