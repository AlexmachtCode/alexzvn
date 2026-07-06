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
  joinedAt: number;
}

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
  | { t: 'talkback'; mode: TalkbackMode; target?: string | null };

// ── Gast-Lebenszyklus-Ereignisse (Gast-Seite/DO-intern → Reducer) ──────────
export type GuestEvent =
  | { t: 'guestJoin'; guestId: string; name: string; hasVideo?: boolean; hasScreen?: boolean }
  | { t: 'guestConsent'; guestId: string }
  | { t: 'guestTracks'; guestId: string; hasVideo?: boolean; hasScreen?: boolean }
  | { t: 'guestLeave'; guestId: string }
  | { t: 'guestDisconnect'; guestId: string };

export type RoomEvent = OperatorAction | GuestEvent;

// ── Effekte (Reducer → DO/App-Seiteneffekte) ───────────────────────────────
// Der Reducer bleibt rein; Seiteneffekte werden als Daten zurückgegeben. Der DO setzt Publish-
// Rechte, die App-Main mappt spinUpNdi/tearDownNdi auf ihren utilityProcess-Sender-Pool.
export type RoomEffect =
  | { t: 'grantPublish'; guestId: string } // DO: SFU-Publish erlauben / ICE-Creds herausgeben
  | { t: 'revokePublish'; guestId: string }
  | { t: 'spinUpNdi'; guestId: string; label: string } // App: NDI-Sender-utilityProcess forken
  | { t: 'tearDownNdi'; guestId: string }
  | { t: 'tally'; guestId: string; tally: Tally }
  | { t: 'notify'; guestId: string; code: 'consentRequired' | 'denied' | 'kicked' };

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

export const RTC_PROTO = 'jmrtc/1' as const;
