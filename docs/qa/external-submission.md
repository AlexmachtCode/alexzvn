# Q&A extern — Stream- & Presse-Einreichung (#166)

Ermöglicht Fragen **außerhalb des Saal-WLANs**: Zuschauer per Livestream-QR und
Pressevertreter vorab (Slido-artig). Der Saal-Rechner öffnet dafür **keinen**
Inbound-Port — die Einreichungen laufen über den bereits vorhandenen Cloudflare-
Worker (`services/release-proxy`), den der lokale Q&A-Rechner **pollt**.

## Sicherheitsmodell: Blind-Relay + End-to-End-Verschlüsselung

Der Worker ist ein **blinder Zwischenspeicher** — er sieht **nie** den Klartext einer
Einreichung. Jede Einreichung (Stream **und** Presse) wird bereits **im Browser des
Einreichers** auf den **Public Key des Events** verschlüsselt:

- Hybrid: zufälliger **AES-256-GCM**-Schlüssel verschlüsselt den Inhalt, dieser
  AES-Schlüssel wird mit **RSA-OAEP-2048** (Event-Public-Key) umschlossen.
- Der Worker speichert nur den Chiffretext-Umschlag `{v,alg,ek,iv,ct}` + minimale
  Routing-Metadaten (Kanal, Zeitstempel, opake ID). Kein Klartext, keine PII.
- Nur die **lokale Q&A-App** hält den **Private Key** (single-holder, wie das iveo-
  Token-Muster) und kann entschlüsseln. Cloudflare/Worker/Logs sehen nie Namen,
  Medium, Kontakt oder Fragetext.

### Presse = eigener, strengerer Kanal (User-Vorgabe „besondere Security")

- **Getrennte Vertrauensstufen:** Stream = anonym & offen (aggressives Rate-Limit);
  Presse = **personalisierter Zugangscode pro Event** (kein offenes Formular),
  separater strengerer Rate-Limit-Bucket, Kanal-Tag `press`.
- **Moderationspflicht:** Stream und Presse landen in der lokalen Q&A-Moderation als
  `approved:false` — nie ungeprüft live.
- **DSGVO-Minimierung:** Inhalt nur E2E-verschlüsselt; kurze KV-TTL; explizites
  Löschen nach Event (`DELETE /qa/<id>`); Presse-Kontaktfelder optional und
  ausschließlich im verschlüsselten Umschlag.

## Event-Lebenszyklus

1. **Öffnen** (lokale App, `PROXY_KEY`): App erzeugt ein Event-Keypair, lädt den
   **Public Key** (JWK) + den **Hash des Presse-Codes** + Flags/Retention hoch
   (`POST /qa/<id>`). Private Key bleibt lokal (at-rest gesichert).
2. **Einreichen** (öffentlich): Zuschauer/Presse öffnen die vom Worker gehostete
   Seite, verschlüsseln im Browser, senden den Umschlag (`/submit` bzw. `/press`).
3. **Pollen** (lokale App, `PROXY_KEY`): `GET /qa/<id>/pending` liefert die
   Chiffretexte; die App entschlüsselt, ingestet in die Moderations-Queue und
   **quittiert** (`POST /qa/<id>/ack` → Löschen im Worker). Lokale Dedupe per ID.
4. **Schließen** (lokale App): `DELETE /qa/<id>` purged alle Event-Daten; zusätzlich
   KV-TTL als Auto-Verfall.

## Endpunkte (`/qa/...`)

Öffentlich (kein `PROXY_KEY`):

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/qa/<id>` | Stream-Einreichseite (HTML) |
| GET | `/qa/<id>/press` | Presse-Einreichseite (HTML, fragt Zugangscode) |
| GET | `/qa/<id>/pubkey` | Event-Public-Key (JWK) + Offen-Flags fürs Browser-Encrypt |
| GET | `/qa/<id>/state` | `{streamOpen, pressOpen, waiting}` (nur Zähler, kein Inhalt) |
| POST | `/qa/<id>/submit` | Stream-Umschlag; rate-limited |
| POST | `/qa/<id>/press` | Presse-Umschlag + `{code}`; rate-limited + Code-Prüfung |

Authentifiziert (`PROXY_KEY`, wie die bestehenden Schreib-Endpunkte):

| Methode | Pfad | Zweck |
|---|---|---|
| POST | `/qa/<id>` | Event öffnen/konfigurieren (`pubJwk`, `pressCodeHash`, Flags, `retentionSec`) |
| GET | `/qa/<id>/pending` | Offene Chiffretexte holen |
| POST | `/qa/<id>/ack` | Quittierte IDs löschen |
| DELETE | `/qa/<id>` | Alle Event-Daten purgen |

## Wiederverwendete Worker-Härtung

`readJsonLimited` (Größenlimit), `clampField`, `rateLimit` (KV, Fixed-Window pro IP),
`HttpError`, `PROXY_KEY`-Auth — identisch zu `/feedback` und `/cookbook/draft`.
Zusätzlich: harte Umschlag-Größenkappung, per-Event-Einreich-Cap, Konstantzeit-
Vergleich des Presse-Code-Hashes.

## Deployment (User-Schritt)

- KV-Namespace anlegen und in `wrangler.toml` binden:
  `npx wrangler kv namespace create QA_RELAY` → id eintragen als Binding `QA_RELAY`.
  (Rate-Limit nutzt die bestehende `RATELIMIT`-Bindung.)
- `npx wrangler deploy`. Secrets bleiben unverändert (`PROXY_KEY` genügt für die
  Admin-Routen).

## Restrisiken / offen

- **Anonymer Stream-Spam:** per-IP-Rate-Limit + per-Event-Cap mindern, verhindern
  ihn aber nicht vollständig. Optional später **Cloudflare Turnstile** (CAPTCHA) auf
  der Stream-Seite. Presse ist durch den Zugangscode geschützt.
- **Sicherheits-Review Pflicht** (`/security-review`) wegen Presse-PII, bevor
  produktiv deployt wird.
