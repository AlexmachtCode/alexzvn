# P1 Design-Spike: Authentifizierter, verschlüsselter Steuer-Transport

> Gehört zu **#59** (Roadmap-Epic **#57**). Status: **Design-Spike** — Entwurf zur Abstimmung, noch keine Implementierung. Ziel ist eine entscheidungsreife Vorlage: Wire-Format, Migrationspfad, Paket-Schnitt, offene Fragen.

## 1. Ziel & Randbedingungen

**Ziel:** Die suite-weite Steuerebene (`@jm/suite-control-protocol`, TCP-Zeilenprotokoll, ~12 Apps, Ports 8724–8735) so erweitern, dass sie **authentifiziert + verschlüsselt** betrieben werden kann — damit Konnektivität **sicher über das LAN hinaus** steigerbar wird (geteilte/fremde Netze, Multi-Site, Fernbetrieb via VPN/WSS).

**Harte Randbedingungen (aus dem Bestand):**
1. **Rückwärtskompatibel & opt-in.** Die ~12 Apps + das Bitfocus-Companion-Modul dürfen nicht brechen. Heutiges Verhalten bleibt Default, bis bewusst auf „secure" geschaltet wird.
2. **`src/index.ts` bleibt node-/electron-frei.** Es wird per `scripts/sync-companion-protocol.mjs` unverändert ins standalone Companion-Modul kopiert. Wire-Parsing (reine Strings) gehört dorthin; alles Krypto-/Netznahe in `server.ts`/`client.ts`.
3. **Keine nativen Build-Abhängigkeiten.** Vorbild ist bereits gesetzt: `apps/studio-control/src/main/auth/password.ts` nutzt `node:crypto` scrypt (kein argon2/bcrypt-Compile). TLS kommt aus `node:tls`. Beides Node-Core.
4. **Bestehendes Auth-Vorbild wiederverwenden**, kein zweites System bauen — siehe §5.

**Heutiges Verhalten (verifiziert):**
- `SuiteControlServer.start(port)` ruft `srv.listen(port)` **ohne Host** → bindet alle Interfaces ([server.ts:99](../../packages/suite-control-protocol/src/server.ts#L99)).
- Server **grüßt sofort** beim Connect mit `STATE …` ([server.ts:82](../../packages/suite-control-protocol/src/server.ts#L82)), bevor irgendeine Authentifizierung möglich wäre.
- Client schickt beim Connect `STATE?\n` und liest den STATE-Strom ([client.ts:58-61](../../packages/suite-control-protocol/src/client.ts#L58-L61)).
- Kein Token, kein TLS, keine Bind-Beschränkung.

## 2. Betriebsmodi

Statt eines harten Schnitts: ein **Modus pro Server-Instanz**, abgeleitet aus Konfiguration.

| Modus | Bind | Auth | TLS | Greeting | Zweck |
|---|---|---|---|---|---|
| `open` (heute) | konfigurierbar, Default `127.0.0.1` (nach **P0**) | nein | nein | sofort `STATE` | Lokale Tools/Companion im vertrauten LAN, abwärtskompatibel |
| `secure` | `0.0.0.0` (oder spezifisch) | **Pflicht** | **Pflicht** | erst nach `AUTHOK` | Geteilte/fremde Netze, Multi-Site, Fernbetrieb |

**Regel:** Bind auf eine Nicht-Loopback-Adresse ist nur im Modus `secure` erlaubt. Damit kann eine offene Instanz nie versehentlich ins ganze Netz hängen (das war Befund **A1**).

## 3. Wire-Protokoll: Auth-Handshake

Neue, **optionale** Zeilen — additive Erweiterung des bestehenden ASCII-Zeilenprotokolls. Reine Parser/Formatter wandern node-frei nach `index.ts`.

### Sequenz (Modus `secure`)
```
Client →  (verbindet via TLS)
Server →  AUTHREQ scs/1 nonce=<hex>            # statt sofortigem STATE
Client →  AUTH <proof>                         # proof = HMAC-SHA256(token, nonce), hex
Server →  AUTHOK                               # bei Erfolg …
Server →  STATE ns=… …                         # … dann erst der gewohnte Greeting-State
   (ab hier: Protokoll exakt wie heute — Befehle + STATE-Pushes)
```
Bei Fehlschlag:
```
Server →  AUTHFAIL
Server →  (Verbindung schließen, nach kurzer Verzögerung + Rate-Limit, §7)
```

### Sequenz (Modus `open`) — unverändert
```
Server →  STATE ns=… …      # sofortiger Greeting wie heute
Client →  STATE? / Befehle   # wie heute
```

### Warum Challenge-Response (nonce + HMAC), nicht `AUTH <token>` im Klartext
- Das **rohe Token wandert nie über die Leitung**; selbst bei (Fehl-)Konfiguration ohne TLS leakt es nicht und ist nicht replaybar (nonce ist pro Verbindung frisch).
- Server-seitig: HMAC mit dem geteilten Token über die selbst gesendete nonce neu berechnen, `crypto.timingSafeEqual` vergleichen — gleiches Muster wie `verifyPassword` ([password.ts:45](../../apps/studio-control/src/main/auth/password.ts#L45)).
- TLS bleibt trotzdem Pflicht im `secure`-Modus (schützt die Steuer-Inhalte selbst, nicht nur das Token).

### Node-freie Helfer in `index.ts` (Spike-Signaturen)
```ts
// reine Strings — kopierbar ins Companion-Modul
export function formatAuthReq(nonceHex: string): string;          // → "AUTHREQ scs/1 nonce=…\n"
export function parseAuthReq(line: string): { nonce: string } | null;
export function formatAuth(proofHex: string): string;             // → "AUTH …\n"
export function parseAuth(line: string): { proof: string } | null;
export const AUTH_OK = 'AUTHOK';
export const AUTH_FAIL = 'AUTHFAIL';
```
Die **Krypto** (HMAC/Compare/nonce-Erzeugung) lebt in `server.ts`/`client.ts` bzw. `@jm/auth-core` (§5) — nicht in `index.ts`.

## 4. Transport-Verschlüsselung (TLS)

- `secure`-Modus umhüllt den `net.Server` mit `tls.createServer(...)` (Node-Core, keine Native-Deps).
- **Kein zentraler CA-Aufwand** für LAN-Peers: **selbstsigniertes Zertifikat je Installation**, generiert beim ersten Aktivieren von `secure`, persistiert in `userData`. Der Client pinnt den **Fingerprint** (Trust-on-first-use), der beim Pairing mit angezeigt wird → bindet Token **und** Endpunkt.
- `SuiteControlClient` bekommt eine optionale `tls: { fingerprint }`-Option; Mismatch ⇒ Verbindung verweigern (MITM-Schutz).
- Companion-Modul: TLS + Fingerprint-Pinning analog (Node zur Laufzeit, `index.ts` bleibt unberührt).

## 5. Paket-Schnitt: `@jm/auth-core`

Gemeinsamer Krypto-/Token-Kern, damit Control-Protocol **und** `@jm/remote` **und** studio-control dieselbe Basis nutzen.

**Promoten (nahezu verbatim, reines `node:crypto`):**
- `hashPassword` / `verifyPassword` aus [auth/password.ts](../../apps/studio-control/src/main/auth/password.ts) — unverändert übernehmbar.

**Neu (klein):**
- `randomToken(bytes = 32): string` — aus dem `newToken()`-Muster in [auth/sessions.ts:7-9](../../apps/studio-control/src/main/auth/sessions.ts#L7-L9).
- `hmacProof(token, nonce): string` + `verifyProof(token, nonce, proof): boolean` (timing-safe) — für den Handshake in §3.

**Abstrahieren, nicht verschieben:** Der Session-/User-Store von studio-control ([sessions.ts](../../apps/studio-control/src/main/auth/sessions.ts), SQLite) bleibt in studio-control. `@jm/auth-core` definiert nur ein schlankes `SessionStore`-Interface; studio-control behält seine SQLite-Implementierung, das Control-Protocol braucht nur ein **einziges geteiltes Suite-Token** (kein User-Modell). So entsteht kein Zwang, studio-controls reichhaltiges Modell in die anderen Tools zu ziehen.

## 6. Pairing & Verteilung des Tokens

Wie kommt **ein** Suite-Token (+ Fingerprint) auf alle Beteiligten — ohne den Bedien-Workflow zu verschlechtern?

1. **Launcher** erzeugt/verwaltet das Suite-Token (Setting), zeigt es als Klartext **und QR**.
2. Jedes Tool liest Token + Modus aus der geteilten Suite-Einstellung (gleicher Weg wie heutige Settings-Verteilung; der Steuerserver erhält es bei `start()`).
3. **Companion-Operator** trägt das Token einmalig im Modul-Config-Feld ein; Fingerprint wird beim ersten Connect via TOFU bestätigt.
4. **Rotation:** Token im Launcher neu würfeln → Tools übernehmen, Companion-Feld aktualisieren. (Sessions/Token-Invalidierung wie bei studio-control.)

## 7. Missbrauchsschutz beim Handshake

- **Rate-Limit pro Quell-IP**: nach N Fehlversuchen kurze Sperre (analog zur in der Roadmap für Remote geplanten 3-Fehlversuche-Logik), bevor erneut `AUTHREQ` gesendet wird.
- **Verzögertes Schließen** nach `AUTHFAIL` (kein Timing-Orakel; `timingSafeEqual` ohnehin konstantzeitig).
- **Greeting-State erst nach `AUTHOK`** — kein Informationsleak vor Auth.

## 8. API-Erweiterung (additiv, abwärtskompatibel)

`SuiteControlServerOptions` (heute: `role, appId, getState, onCommand, …`) bekommt **optionale** Felder — bestehende Aufrufer (z. B. [rundown/control-server.ts:29-38](../../apps/rundown/src/main/control-server.ts#L29-L38)) bleiben unverändert lauffähig:

```ts
interface SuiteControlServerOptions {
  // … bestehende Felder unverändert …
  mode?: 'open' | 'secure';          // Default 'open'
  bindHost?: string;                 // Default '127.0.0.1' (open) — Teil von P0
  auth?: {
    token: string;                   // geteiltes Suite-Token (secure)
  } | { verify: (proof: string, nonce: string) => boolean };
  tls?: { key: string; cert: string }; // Pflicht bei mode:'secure'
}
```
`SuiteControlClientOptions` analog: `auth?: string` (Token), `tls?: { fingerprint: string }`.

**Wichtig:** Aufrufer ohne neue Felder ⇒ exakt heutiges Verhalten. Die Migration der 12 Apps ist damit „Feld ergänzen, wenn secure gewünscht" — kein Pflicht-Umbau pro App.

## 9. Migrationspfad / Rollout (innerhalb P1)

1. **Protokoll-Support** in `server.ts`/`client.ts` + Helfer in `index.ts` + `@jm/auth-core`. Default bleibt `open` → niemand merkt etwas, alles grün.
2. **Companion-Modul** um optionales Token-/TLS-Feld erweitern (`sync-companion-protocol.mjs` zieht die neuen node-freien Helfer mit).
3. **Launcher**: Suite-Token/Modus-Setting + Pairing-UI (QR).
4. **Tools** reichen Token/Modus an ihren `SuiteControlServer.start()` durch (eine Zeile je App).
5. **Umschalten auf `secure`** für Nicht-Loopback-Betrieb; `open` bleibt für reine Lokal-Setups verfügbar.
6. **`@jm/remote`** (WSS+Token+Rate-Limit) und **mDNS-Signatur** schließen sich an (eigene Teilaufgaben in #59).

## 10. Backward-Compat-Matrix

| Szenario | Verhalten |
|---|---|
| Alt-Client / Alt-Companion ↔ Server `open` | ✅ unverändert |
| Alt-Client ↔ Server `secure` (Nicht-Loopback) | ⛔ kein `AUTH` ⇒ `AUTHFAIL`/Close (gewollt) |
| Neuer Client mit Token ↔ Server `secure` | ✅ Handshake + TLS |
| Neuer Client ohne Token ↔ Server `open` | ✅ ignoriert Auth, wie heute |
| Loopback-Lokalbetrieb | ✅ `open` bleibt Default-Pfad |

## 11. Offene Entscheidungen (für die Abstimmung)
1. **Token-Granularität:** Ein Suite-weites Token (einfachstes Pairing) vs. Token je Tool/Rolle (feinere Rotation, mehr Pairing-Aufwand). Empfehlung Spike: **suite-weit** starten, Interface erlaubt späteres Aufteilen.
2. **TLS-Vertrauen:** TOFU-Fingerprint (kein Setup) vs. kleine Suite-eigene CA im Launcher (sauberer, mehr Maschinerie). Empfehlung: **TOFU** zuerst.
3. **`secure` erzwingen ab wann:** nur bei explizitem Nicht-Loopback-Bind (Spike-Annahme) — oder global per Launcher-Schalter?
4. **mDNS-Annonce im `secure`-Modus:** weiterhin annoncieren (mit signiertem TXT) oder ganz unterdrücken in fremden Netzen?

## 12. Proof-of-Concept-Plan (klein, vor der Vollumsetzung)
- `packages/suite-control-protocol/test/selftest.ts` erweitern: Handshake-Round-Trip (nonce → proof → AUTHOK), Fehlpfad (falsches Token → AUTHFAIL), und `open`-Pfad bleibt byte-identisch.
- Ein Throwaway-TLS-Loopback-Test (self-signed, Fingerprint-Pin) als Machbarkeitsnachweis.
- Kein App-Rollout im PoC — nur das Paket + selftest.

## 13. Verifikation (Definition of Done für P1)
- Alt-Client ohne Token funktioniert weiter auf `open`/Loopback.
- Remote-Client ohne Token auf `secure`/Nicht-Loopback wird abgewiesen (`AUTHFAIL`, kein State-Leak).
- TLS-Handshake steht; Fingerprint-Mismatch wird verweigert.
- Companion steuert nach Token-Eintrag weiter; Smoke über alle ~12 Steuer-Apps grün.
- `selftest` deckt Auth-Erfolg-/Fehlpfad + `open`-Byte-Kompatibilität ab.
