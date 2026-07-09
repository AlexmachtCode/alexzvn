# JM Connect — Datenresidenz und Bedrohungsmodell

Stand: 2026-07-09 (Welle 6.6). Gilt für Remote-Zuschaltungen über `apps/jm-connect`,
`services/release-proxy/connect-relay.js` und Cloudflare Realtime.

Dieses Dokument sagt, **was in der EU bleibt und was nicht**. Der zweite Teil ist der wichtigere.

## Kurzfassung

| Datum | Wo | EU-Residenz |
|---|---|---|
| Raum-Zustand (Gästenamen, Einwilligung, Tally, Standby, Publish-Referenzen) | Durable Object `ConnectRoom` | **Ja, hart garantiert** |
| Join-Token, Raum-Secret | Durable Object + Operator-PC | **Ja** |
| Signalling (SDP, Steuernachrichten) | Durable Object (WebSocket) | **Ja** |
| **Audio und Video der Gäste** | **Cloudflare Realtime SFU** | **Nein — keine Garantie** |
| **TURN-Relay (bei striktem NAT)** | **Cloudflare TURN** | **Nein — keine Garantie** |

## Was in der EU bleibt

Jeder Raum ist ein Durable Object, das über eine **Jurisdiction** adressiert wird:

```js
env.CONNECT_ROOM.jurisdiction('eu').idFromName(room)
```

Das ist laut Cloudflare eine harte Zusage („only run and store data within a region"), keine
Empfehlung. Bewusst **nicht** `locationHint` — das ist ausdrücklich best effort und taugt nicht
für Compliance.

Connect verwendet **kein Workers KV**. Das ist kein Zufall: KV kennt keine Jurisdiction, ein
dort abgelegter Raum-Zustand wäre nicht EU-pinnbar. Der komplette persistierte Zustand liegt im
DO-Storage.

Gesteuert über `CONNECT_JURISDICTION` in `wrangler.toml` (Default `"eu"`).

> ⚠️ **Nicht im laufenden Betrieb ändern.** Derselbe Raumname ergibt in einer anderen Jurisdiction
> eine **andere Objekt-ID**. Ein Wechsel verwaist alle bestehenden Räume. Der Leerstring schaltet
> die Jurisdiction ab und ist nur für lokale `wrangler dev`-Läufe gedacht, deren Simulation keine
> Jurisdictions kennt. Fordert die Konfiguration eine Jurisdiction, die die Bindung nicht kann,
> antwortet der Worker mit **503** — er läuft nicht still ohne EU-Bindung weiter.

## Was NICHT in der EU bleibt

**Die Medien.** Cloudflare Realtime (SFU) und Cloudflare TURN bieten **keine** Regions-,
Jurisdiction- oder Data-Residency-Option. Beide laufen über das globale Anycast-Netz; wo ein
Medienstrom terminiert, ist weder dokumentiert noch steuerbar — de facto am Edge, der dem
jeweiligen Gast am nächsten ist. Ein Gast aus Singapur wird in Singapur terminiert.

Die **Data Localization Suite** (Enterprise-Add-on) ändert daran nichts: Realtime und TURN sind in
ihrer Kompatibilitätstabelle nicht aufgeführt. Sie deckt HTTPS-Traffic, Logs/Metadaten und
TLS-Schlüssel ab, nicht die Developer-Platform-Medien.

**Zusätzlich: die SFU terminiert SRTP.** Die Medien sind an der Edge entschlüsselt. Das ist ein
struktureller Unterschied zum Q&A-Text-Relay der Suite, das blind weiterleitet. Wer zuschaltet,
vertraut Cloudflare den Inhalt der Zuschaltung an.

### Wenn Medienresidenz zwingend gefordert ist

Die Naht dafür existiert und ist genau deswegen gebaut: `packages/rtc/src/sfu.ts` definiert
`SfuBroker`, die Cloudflare-Umsetzung liegt isoliert in `cf-sfu.ts`. Ein selbst gehosteter SFU in
der EU (LiveKit, mediasoup, Janus — jeweils hinter WHIP/WHEP) ersetzt **diese eine Datei**.
Durable Object, App und Gast-Seite bleiben unberührt. Analog lässt sich TURN durch einen eigenen
coturn in der EU ersetzen; ausgegeben werden die ICE-Server ohnehin schon token-gegatet über
`/connect/:room/ice`.

Das ist keine Theorie, aber auch keine erledigte Arbeit: der Tausch ist **nicht validiert**.

## Grenzen und Voreinstellungen

| Wert | Ort | Anmerkung |
|---|---|---|
| 50 gleichzeitige Gäste je Raum | `CONNECT.guestCap` | **Schutzgrenze, kein gemessener Wert.** Ein Lasttest steht aus. |
| 24 h Raum-Retention | `CONNECT.retentionMaxSec` | DO-Alarm räumt danach vollständig ab. |
| 30 min TURN-Credential-TTL | `CONNECT.turnTtlSec` | Kurzlebig, pro Anfrage neu ausgestellt. |
| 12 h Gast-Token, 8 h Operator-Token | `apps/jm-connect/src/main/room.ts` | HMAC über `{room,guestId,scope,exp}`. |
| 720p je Gast | Peer/NDI-Brücke | BGRA-Kopie; 1080p vervierfacht die Busbandbreite. |

Jeder Gast erzeugt einen eigenen NDI-Sender-Prozess und (für den Rückkanal) einen eigenen
Mix-Minus-Audio-Track. Die Zahl der Return-Tracks wächst linear mit den Gästen — das ist der
eigentliche Skalierungskostenpunkt, nicht das Bild.

## Was strukturell erzwungen ist

Diese Zusagen liegen im Reducer (`packages/rtc/src/state.ts`), nicht in der Oberfläche, und sind
durch Selbsttests abgedeckt:

- Ein Gast im **Warteraum** bekommt keine Publish-Rechte und keine ICE-Credentials.
- **Ohne Einwilligung** (`consentAt`) ist `onair` nicht erreichbar.
- **Folien-Steuerung** entsteht nur nach ausdrücklicher Freigabe und überlebt keinen Rejoin.
- **Talkback** wird geschlossen, sobald die Operator-Verbindung abbricht — ein Absturz bei
  gedrückter Sprechtaste hinterlässt kein heißes Regie-Mikro.
- Der Raum-PC öffnet **keinen eingehenden Port**; alles läuft ausgehend über den Cloud-Proxy.
- Das SFU-App-Secret und der `PROXY_KEY` bleiben serverseitig. Der versteckte Peer spricht die SFU
  ausschließlich über den Durable Object.

## Quellen

- Durable Objects, Datenort und Jurisdictions: <https://developers.cloudflare.com/durable-objects/reference/data-location/>
- Durable Objects Namespace-API (`jurisdiction`, `idFromName`): <https://developers.cloudflare.com/durable-objects/api/namespace/>
- Cloudflare Realtime SFU (HTTPS-API): <https://developers.cloudflare.com/realtime/sfu/https-api/>
- Cloudflare Realtime TURN: <https://developers.cloudflare.com/realtime/turn/>
- Data Localization Suite, Produktkompatibilität: <https://developers.cloudflare.com/data-localization/compatibility/>
