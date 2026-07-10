# @jm/rtc — Remote-A/V-Kern (Welle 6 „JM Connect")

Geteilte, **isomorphe** Grundlage der Hybrid-Konferenz-/Zuschaltungs-Ebene. Dieselben Typen und
Funktionen laufen auf drei Seiten:

- **Cloudflare Durable Object** (`ConnectRoom`, im `services/release-proxy`-Worker) — autoritative Room-State-Machine + Signalling-Relay.
- **`apps/connect`** (Electron) — Operator-App; dekodiert Remote-Gäste im hidden-Peer-Renderer und spielt sie als NDI-Quellen aus.
- **Worker-gehostete Gast-Seite** (Browser) — `getUserMedia` → publish, Consent, Warteraum.

> Status: **Fundament (Roadmap 6.0)**. Reines Scaffolding + grüner Selbsttest — noch nicht live an
> Cloudflare Realtime verdrahtet. Plan-File: `~/.claude/plans/moin-lass-uns-mal-cosmic-russell.md`.

## Modul-Karte

| Import | Umgebung | Zweck |
|---|---|---|
| `@jm/rtc` (Root) | isomorph | Re-Export der isomorphen Module (unten) — für Worker/DO gefahrlos |
| `@jm/rtc/protocol` | isomorph | Room-/Guest-Typen, Operator-Aktionen, Effekte, Signalling-Nachrichten |
| `@jm/rtc/state` | isomorph | **Reine** Room-State-Machine (`reduce`) + Ableitungen — EINE Quelle der Wahrheit für DO & UI |
| `@jm/rtc/token` | isomorph | Kurzlebige, signierte Join-Token (Web-Crypto-HMAC), Mint/Verify + Event-Secret |
| `@jm/rtc/turn` | serverseitig | Cloudflare-TURN-Cred-Ausgabe (kurzes TTL) |
| `@jm/rtc/sfu` | isomorph | **Austauschbare** `SfuBroker`-Naht (publish/subscribe/renegotiate) |
| `@jm/rtc/cf-sfu` | serverseitig | Cloudflare-Realtime-Implementierung von `SfuBroker` |
| `@jm/rtc/signalling` | Browser/Electron | Isomorpher WebSocket-Client zum DO (Auto-Reconnect) |
| `@jm/rtc/frames` | **nur Renderer** | WebCodecs ↔ NDI-Konverter (BGRA / f32-planar-FLTP) |

`frames` und `signalling` sind bewusst **nicht** vom Root re-exportiert (sie brauchen
`VideoFrame`/`AudioData` bzw. `globalThis.WebSocket`), damit der DO den Root importieren kann.

## Sicherheitskritische Invarianten (in `state.ts` erzwungen, Spur S3)

- **Warteraum ist strukturell:** ein Gast in `lobby` erzeugt **keinen** `grantPublish`-Effekt → keine
  SFU-Publish-Rechte/ICE, bis der Operator `approve`t.
- **Consent-Gate:** `onair` ist ohne gesetztes `consentAt` **nicht** erreichbar (Reducer gibt stattdessen
  `notify: consentRequired` zurück).
- **Mehrere Gäste dürfen gleichzeitig on-air sein** (Remote-Panel) — der Switcher komponiert final.

## Cloudflare-Findings (Recherche 2026-07-06)

**TURN — vollständig bestätigt** (`turn.ts`):
`POST https://rtc.live.cloudflare.com/v1/turn/keys/$KEY_ID/credentials/generate-ice-servers`,
`Authorization: Bearer $API_TOKEN`, Body `{"ttl": <sek>}` (max **48 h**) →
`201 { iceServers: [{urls:[stun…]}, {urls:[turn…], username, credential}] }`.
Der Worker gibt der token-gegateten Gast-Seite (`GET /connect/:room/ice`) nur dieses fertige
Objekt mit kurzem TTL — der API-Token bleibt serverseitig.

**SFU — Endpoints bestätigt, Feldnamen ⚠️ vor-Live-verifizieren** (`cf-sfu.ts`):
`POST /apps/{id}/sessions/new`, `POST …/tracks/new` (publish `location:'local'` / subscribe
`location:'remote'`), `PUT …/renegotiate`, `PUT …/tracks/close`; Bearer-App-Secret. Die exakten
JSON-Feldnamen (`sessionDescription`, `tracks[{location,mid,trackName,sessionId}]`,
`requiresImmediateRenegotiation`) sind aus Doc/Referenz-Apps übernommen und **gegen die offizielle
OpenAPI zu verifizieren, bevor live gewired wird**. Korrekturen bleiben in `cf-sfu.ts` — App/DO
sprechen nur das `SfuBroker`-Interface.

**EU-Datenresidenz:** Cloudflare Realtime/TURN laufen auf dem globalen Netz; **kein einfacher
EU-Region-Pin-Schalter** dokumentiert (nur China ist ausgenommen; Compliance-Details via Enterprise
Account Manager). ⇒ Die eigentliche Residenz-Antwort ist der **Self-Host-Escape-Hatch**: ein
selbstgehosteter WHIP/WHEP-SFU (LiveKit/mediasoup/Janus) hinter derselben `SfuBroker`-Naht ersetzt
Cloudflare, ohne App/DO/Gast-Seite anzufassen (Roadmap S5/6.6).

## Bewusste Abweichungen von der Roadmap

- **Token auf Web Crypto statt `@jm/auth-core`:** auth-core ist `node:crypto`-only und liefe nicht im
  Cloudflare-DO. `token.ts` nutzt `crypto.subtle` (HMAC-SHA256 — dieselbe Primitive wie
  `auth-core.hmacProof`), damit App (mint) und DO (verify) **identischen** Code teilen. Das
  Event-Secret ist symmetrisch — laut S5 akzeptabel, da die SFU ohnehin Klartext-Medien sieht
  (nicht E2E-blind). Aufwertungspfad: asymmetrisch (Ed25519).
- **Dependency-frei:** kein `@jm/auth-core`-Abhängigkeit nötig → das Paket bleibt im Worker/Browser/Node
  gleichermaßen nutzbar (Ethos wie `@jm/control-config`).

## Test

```
npm run selftest -w @jm/rtc      # State-Gates (Warteraum/Consent/GO/Kick) + Token-Round-Trip
```

## Nächste Schritte (Roadmap 6.0 → Proving-Milestone)

1. `ConnectRoom`-DO im `services/release-proxy` + `wrangler.toml`-Bindings (additiv, wie `handleQa`).
2. Worker-gehostete Gast-Seite (`/connect/:room`) — Muster wie `qa-relay.js`-`submissionPage`.
3. `apps/connect`-Skelett (aus `apps/ndi-screen-capture`) + hidden-Peer-Renderer + `ndi-guests`-Pool.
4. **Proving-Milestone:** ein Remote-Gast-Kamerabild → NDI-Quelle „JM Connect – Guest 1" im Switcher (einweg).
