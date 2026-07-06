// @jm/rtc/cf-sfu — Cloudflare-Realtime-Implementierung von SfuBroker (Welle 6). SERVERSEITIG.
//
// Basis-Endpoints bestätigt (2026-07-06, developers.cloudflare.com/realtime/sfu/https-api):
//   POST /apps/{appId}/sessions/new
//   POST /apps/{appId}/sessions/{sessionId}/tracks/new
//   PUT  /apps/{appId}/sessions/{sessionId}/renegotiate
//   PUT  /apps/{appId}/sessions/{sessionId}/tracks/close
//   GET  /apps/{appId}/sessions/{sessionId}
//   Auth: Authorization: Bearer <App-Secret/Token>
//
// ⚠️ Die exakten JSON-FELDNAMEN (`sessionDescription`, `tracks[{location,mid,trackName,sessionId}]`,
// `requiresImmediateRenegotiation`) stammen aus der Realtime-Doc/Referenz-Apps und sind VOR dem
// Live-Wiring gegen die offizielle OpenAPI zu verifizieren („View full API/OpenAPI“ auf der
// https-api-Seite bzw. /realtime/llms-full.txt). Genau dafür existiert die SfuBroker-Naht:
// Feldnamen-Korrekturen bleiben in DIESER einen Datei, App/DO bleiben unberührt.

import type { SfuBroker, TrackRef, PublishResult, SubscribeResult } from './sfu';
import type { SdpDescription } from './protocol';

export interface CfSfuConfig {
  appId: string;
  /** App-Secret / Bearer-Token — geheim, nur serverseitig, nie in den Browser. */
  appToken: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export function createCloudflareSfu(cfg: CfSfuConfig): SfuBroker {
  const base = (cfg.baseUrl ?? 'https://rtc.live.cloudflare.com/v1').replace(/\/$/, '');
  const doFetch = cfg.fetchImpl ?? fetch;
  const app = `${base}/apps/${encodeURIComponent(cfg.appId)}`;
  const headers = { authorization: `Bearer ${cfg.appToken}`, 'content-type': 'application/json' };

  async function call(path: string, method: string, body?: unknown): Promise<any> {
    const res = await doFetch(`${app}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      // Response-Body mitgeben — bei Feldnamen-/Schema-Fehlern liefert CF Realtime hier die
      // konkrete Ursache (im DO geloggt, via `wrangler tail` sichtbar).
      const detail = await res.text().catch(() => '');
      throw new Error(`SFU ${method} ${path} → ${res.status} ${detail.slice(0, 400)}`);
    }
    return res.json();
  }

  return {
    async newSession(offer?) {
      // Mit Offer: Transport direkt etablieren (CF Realtime gibt die Answer zurück). Ohne Offer:
      // nur Session anlegen (der Publisher etabliert den Transport später über den Publish-Offer).
      const r = await call('/sessions/new', 'POST', offer ? { sessionDescription: offer } : undefined);
      return { sessionId: r.sessionId as string, answer: r.sessionDescription as SdpDescription | undefined };
    },

    async publish(sessionId, offer, tracks): Promise<PublishResult> {
      const r = await call(`/sessions/${sessionId}/tracks/new`, 'POST', {
        sessionDescription: offer,
        tracks: tracks.map((t) => ({ location: 'local', mid: t.mid, trackName: t.trackName })),
      });
      return { answer: r.sessionDescription as SdpDescription, tracks: (r.tracks ?? []) as TrackRef[] };
    },

    async subscribe(sessionId, tracks): Promise<SubscribeResult> {
      const r = await call(`/sessions/${sessionId}/tracks/new`, 'POST', {
        tracks: tracks.map((t) => ({ location: 'remote', sessionId: t.sessionId, trackName: t.trackName })),
      });
      return {
        requiresImmediateRenegotiation: Boolean(r.requiresImmediateRenegotiation),
        offer: r.sessionDescription as SdpDescription | undefined,
        tracks: (r.tracks ?? []) as TrackRef[],
      };
    },

    async renegotiate(sessionId, answer) {
      await call(`/sessions/${sessionId}/renegotiate`, 'PUT', { sessionDescription: answer });
    },

    async closeTracks(sessionId, trackNames) {
      await call(`/sessions/${sessionId}/tracks/close`, 'PUT', {
        tracks: trackNames.map((trackName) => ({ trackName })),
      });
    },
  };
}
