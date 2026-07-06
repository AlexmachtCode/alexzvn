// @jm/rtc/turn — kurzlebige Cloudflare-Realtime-TURN-Credentials (Welle 6, Spur S2).
//
// SERVERSEITIG (Worker/DO oder App-Main) — der TURN-API-Token ist geheim und darf NIE in den
// Browser. Der Worker gibt der token-gegateten Gast-Seite (`GET /connect/:room/ice`) nur das
// fertige iceServers-Objekt mit kurzem TTL zurück.
//
// Endpoint & Response-Shape verifiziert 2026-07-06 gegen
// developers.cloudflare.com/realtime/turn/generate-credentials:
//   POST https://rtc.live.cloudflare.com/v1/turn/keys/$TURN_KEY_ID/credentials/generate-ice-servers
//   Authorization: Bearer $TURN_KEY_API_TOKEN ; Body {"ttl": <sekunden>}
//   → 201 { iceServers: [ {urls:[stun…]}, {urls:[turn…], username, credential} ] }

export interface IceServer {
  urls: string[];
  username?: string;
  credential?: string;
}
export interface IceServersResponse {
  iceServers: IceServer[];
}

const TURN_BASE = 'https://rtc.live.cloudflare.com/v1/turn/keys';
/** Max-TTL laut Doc: 48 h. */
export const TURN_MAX_TTL_SEC = 48 * 3600;

export async function generateTurnCredentials(
  turnKeyId: string,
  turnApiToken: string,
  ttlSeconds: number,
  fetchImpl: typeof fetch = fetch,
): Promise<IceServersResponse> {
  const ttl = Math.max(60, Math.min(Math.floor(ttlSeconds), TURN_MAX_TTL_SEC));
  const res = await fetchImpl(
    `${TURN_BASE}/${encodeURIComponent(turnKeyId)}/credentials/generate-ice-servers`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${turnApiToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ ttl }),
    },
  );
  if (!res.ok) throw new Error(`TURN-Cred-Ausgabe fehlgeschlagen: ${res.status}`);
  return (await res.json()) as IceServersResponse;
}
