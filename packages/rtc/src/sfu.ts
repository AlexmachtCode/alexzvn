// @jm/rtc/sfu — austauschbare SFU-Abstraktion (Welle 6). Die App/DO spricht NUR dieses Interface;
// die konkrete Implementierung ist Cloudflare Realtime (./cf-sfu) oder später ein selbstgehosteter
// WHIP/WHEP-SFU (LiveKit/mediasoup/Janus) — der EU-Residenz-Escape-Hatch aus Roadmap S5.
//
// Das App-Secret bleibt serverseitig; Browser-Peers relayen SDP/ICE über den DO, der diese API ruft.
// „publish“ = eigene lokale Tracks anbieten; „subscribe“ = fremde Tracks (per sessionId/trackName)
// abonnieren, was i. d. R. ein Renegotiation-Offer zurückgibt.

import type { SdpDescription } from './protocol';

export type TrackLocation = 'local' | 'remote';

export interface TrackRef {
  location: TrackLocation;
  /** Media-line-Index des lokalen Offers (nur location:'local'). */
  mid?: string;
  /** Eindeutiger Track-Name im App-Scope (Publish vergibt ihn, Subscribe referenziert ihn). */
  trackName: string;
  /** Fremd-Session, aus der subscribed wird (nur location:'remote'). */
  sessionId?: string;
}

export interface PublishResult {
  answer: SdpDescription;
  tracks: TrackRef[];
}
export interface SubscribeResult {
  requiresImmediateRenegotiation: boolean;
  offer?: SdpDescription;
  tracks: TrackRef[];
}

export interface SfuBroker {
  /**
   * Neue Session. Optionaler Offer etabliert direkt den Transport (ICE/DTLS) und liefert die
   * Answer zurück — nötig für reine EMPFÄNGER-Sessions (Pull), deren Transport sonst nie steht
   * (Publisher etablieren ihn über den Publish-Offer). Ohne Offer nur Session-Allokation.
   */
  newSession(offer?: SdpDescription): Promise<{ sessionId: string; answer?: SdpDescription }>;
  publish(sessionId: string, offer: SdpDescription, tracks: TrackRef[]): Promise<PublishResult>;
  subscribe(sessionId: string, tracks: TrackRef[]): Promise<SubscribeResult>;
  renegotiate(sessionId: string, answer: SdpDescription): Promise<void>;
  closeTracks(sessionId: string, trackNames: string[]): Promise<void>;
}
