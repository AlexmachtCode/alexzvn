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

1. **Öffnen** (lokale App mit Freigabe des Launchers): App erzeugt ein Event-Keypair, lädt den
   **Public Key** (JWK) + den **Hash des Presse-Codes** + Flags/Retention hoch
   (`POST /qa/<id>`). Private Key bleibt lokal (at-rest gesichert).
2. **Einreichen** (öffentlich): Zuschauer/Presse öffnen die vom Worker gehostete
   Seite, verschlüsseln im Browser, senden den Umschlag (`/submit` bzw. `/press`).
3. **Pollen** (lokale App mit Freigabe des Launchers): `GET /qa/<id>/pending` liefert die
   Chiffretexte; die App entschlüsselt, ingestet in die Moderations-Queue und
   **quittiert** (`POST /qa/<id>/ack` → Löschen im Worker). Lokale Dedupe per ID.
4. **Schließen** (lokale App): `DELETE /qa/<id>` purged alle Event-Daten; zusätzlich
   KV-TTL als Auto-Verfall.

**Zugang der lokalen App (Anmeldung, Teil 1).** Q&A holt beim Launcher eine Freigabe für
genau dieses Event (Zweck `qa-relay`, 72 Stunden), hält sie in `qa.cloud.secret` und
erneuert sie über den Launcher, sobald weniger als 24 Stunden bleiben. Der Live-Pfad
Q&A → Worker braucht den Launcher nicht. Bis `ALTKEY_BIS` nimmt der Worker an den
Admin-Routen auch den alten `PROXY_KEY` an, aber nur für Events ohne Inhaber; nach der ersten
gültigen Freigabe leert Q&A den gespeicherten Key. Einzelheiten: `docs/anmeldung.md`.

**Inhaber eines Events (EP33).** Die Event-ID ist öffentlich (Einreich-Adresse, Saal-QR). Darum
gehört ein Event dem Konto und dem Rechner der ersten Freigabe, die es nutzt (Öffnen oder Abholen).
Danach gilt nur eine Freigabe desselben Kontos oder desselben Rechners; jede andere Freigabe und
der alte `PROXY_KEY` bekommen 403 („keine Freigabe“). Hat ein Event noch keinen Inhaber (im
Übergang mit dem alten Schlüssel geöffnet), bindet die erste Freigabe, die es nutzt. Der Inhaber
steht im Konten-Durable-Object in der EU, nicht in KV: Der Worker entscheidet dort per
Compare-and-set, auch wenn zwei Konten das Event gleichzeitig öffnen. Gespeichert werden nur
SHA-256-Hashes von Event-ID, Konto und Rechner. Der Inhaber gilt mindestens bis zum Ende der
Aufbewahrung des Events, höchstens 30 Tage; Einreichungen leben höchstens 60 Sekunden länger
als das Event (Mindestdauer von KV). Antwortet der Konten-Dienst nicht, antworten die
Admin-Routen mit 503 statt offen. Anfragen mit dem alten Schlüssel werden je IP gedrosselt
(60 je Minute, Bindung `KONTO_RL_QAALT`), bevor sie den Konten-Dienst erreichen. Die
Angaben in KV (`QA_RELAY`) enthalten keinen Inhaber.

## Endpunkte (`/qa/...`)

Öffentlich (ohne Anmeldung):

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/qa/<id>` | Stream-Einreichseite (HTML) |
| GET | `/qa/<id>/press` | Presse-Einreichseite (HTML, fragt Zugangscode) |
| GET | `/qa/<id>/pubkey` | Event-Public-Key (JWK) + Offen-Flags fürs Browser-Encrypt |
| GET | `/qa/<id>/state` | `{streamOpen, pressOpen, waiting}` (nur Zähler, kein Inhalt) |
| POST | `/qa/<id>/submit` | Stream-Umschlag; rate-limited |
| POST | `/qa/<id>/press` | Presse-Umschlag + `{code}`; rate-limited + Code-Prüfung |

Mit Zugang (Freigabe `qa-relay` für dieses Event als `Authorization: Bearer …`; bis `ALTKEY_BIS` auch der alte `PROXY_KEY`):

| Methode | Pfad | Zweck |
|---|---|---|
| POST | `/qa/<id>` | Event öffnen/konfigurieren (`pubJwk`, `pressCodeHash`, Flags, `retentionSec`) |
| GET | `/qa/<id>/pending` | Offene Chiffretexte holen |
| POST | `/qa/<id>/ack` | Quittierte IDs löschen |
| DELETE | `/qa/<id>` | Alle Event-Daten purgen |

## Wiederverwendete Worker-Härtung

`readJsonLimited` (Größenlimit), `clampField`, `rateLimit` (KV, Fixed-Window pro IP),
`HttpError` — wie bei `/feedback` und `/cookbook/draft`; den Zugang prüft `zugangPruefen` aus `konto-zugang.js`.
Zusätzlich: harte Umschlag-Größenkappung, per-Event-Einreich-Cap, Konstantzeit-
Vergleich des Presse-Code-Hashes.

## Deployment (User-Schritt)

- KV-Namespace anlegen und in `wrangler.toml` binden:
  `npx wrangler kv namespace create QA_RELAY` → id eintragen als Binding `QA_RELAY`.
  (Rate-Limit nutzt die bestehende `RATELIMIT`-Bindung; der Inhaber eines Events steht im
  Konten-DO hinter der Bindung `KONTO`, ohne sie antworten die Admin-Routen mit 503.)
- `npx wrangler deploy`. Die Admin-Routen prüfen seit der Anmeldung (Teil 1) die
  Freigabe des Launchers; `PROXY_KEY` gilt dort nur bis `ALTKEY_BIS` (`docs/anmeldung.md`).

## Restrisiken / offen

- **Anonymer Stream-Spam:** per-IP-Rate-Limit + per-Event-Cap mindern, verhindern
  ihn aber nicht vollständig. Optional später **Cloudflare Turnstile** (CAPTCHA) auf
  der Stream-Seite. Presse ist durch den Zugangscode geschützt.
- **Sicherheits-Review Pflicht** (`/security-review`) wegen Presse-PII, bevor
  produktiv deployt wird.
