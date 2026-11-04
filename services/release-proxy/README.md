# JM Production Suite — Release-Proxy (Cloudflare Worker)

Hält **ein** GitHub-Token serverseitig und liefert dem Launcher pro Tool die
neueste Version + eine signierte Download-URL. Dadurch braucht **kein Client ein
GitHub-Token**. Der Proxy selbst ist über die Anmeldung im Launcher geschützt (Sitzung, Abschnitt
„Anmeldung im Launcher (Teil 1)“), im Übergang zusätzlich über den alten `PROXY_KEY`; die
eigentlichen Downloads laufen direkt von GitHubs Storage (nicht über den Worker).

## Was du brauchst
- Cloudflare-Account (Free-Tier reicht).
- GitHub **fine-grained PAT**: Repositories `alexzvn` und `jm-zoom-sdk` (nur für `/zoom-sdk`, JM Connect 0.2.2), Permission **Contents: Read-only**.
- Einen **Proxy-Key** (zufälliger String), z. B. `openssl rand -hex 24`.

## Deploy (wrangler, empfohlen — ~5 Min)
**Wichtig:** alle Befehle aus DIESEM Ordner (`services/release-proxy/`) ausführen —
sonst findet wrangler die `wrangler.toml` nicht ("Worker name missing").

```bash
cd services/release-proxy   # hier liegen wrangler.toml + worker.js
npm i -g wrangler           # oder: npx wrangler ...
wrangler login              # Browser öffnet sich, mit Cloudflare-Account anmelden

# Erst deployen (legt den Worker an), DANN Secrets — `secret put` braucht einen
# existierenden Worker. Secrets greifen sofort, kein erneutes Deploy nötig.
wrangler deploy             # gibt die URL aus, z. B. https://jm-suite-proxy.<account>.workers.dev
wrangler secret put GITHUB_TOKEN   # PAT einfügen
wrangler secret put PROXY_KEY      # deinen Proxy-Key einfügen
```

Den `REPO`-Wert (Standard `AlexmachtCode/alexzvn`) ggf. in `wrangler.toml` anpassen.
Falls wrangler den Namen partout nicht findet: `--name jm-suite-proxy` an die Befehle anhängen.

### Alternative: Dashboard
Cloudflare → **Workers & Pages** → **Create Worker** → Code aus `worker.js` einfügen →
**Settings → Variables**: `GITHUB_TOKEN` und `PROXY_KEY` als **encrypted secrets**,
`REPO` als Klartext-Variable → **Deploy**.

## Test
```bash
curl -s -H "X-Proxy-Key: <DEIN_KEY>" \
  "https://<dein-worker>.workers.dev/tools/copy/latest?platform=win&arch=x64"
```
Erwartet: `{"version":"0.1.1","assets":{"win":{"url":"https://release-assets.githubusercontent.com/…","size":…,"fileName":"JM.Copy-0.1.1-win-x64.exe"}}}`

Health-Check (ohne Key): `GET https://<dein-worker>.workers.dev/` → `… ok`.

## API
```
GET /tools/:id/latest?platform=<mac|win>&arch=<arm64|x64>
Header: X-Proxy-Key: <PROXY_KEY>
→ 200 { version, assets: { <platform>: { url, size, fileName } } }

GET /suite.json
Header: X-Proxy-Key: <PROXY_KEY>
→ 200 (liefert packages/suite-manifest/suite.json LIVE aus dem Repo)

GET /changelog.json
Header: X-Proxy-Key: <PROXY_KEY>
→ 200 (liefert packages/suite-manifest/changelog.json LIVE aus dem Repo)

GET /cookbook.json
Header: X-Proxy-Key: <PROXY_KEY>
→ 200 (liefert packages/cookbook/cookbook.json LIVE aus dem Repo)

POST /cookbook/draft
Header: X-Proxy-Key: <PROXY_KEY>
Body: { "mode": "ai",   "input":  { "title"?, "category"?, "notes" } }
  oder { "mode": "form", "recipe": { ...vollständiges Rezept-Objekt... } }
→ 200 { ok, prUrl, number, branch }
   (validiert das Rezept, rendert die .md und öffnet einen PR; mode "ai" ruft Claude)
   braucht GITHUB_TOKEN mit Contents:write + Pull requests:write; mode "ai" zusätzlich ANTHROPIC_API_KEY

GET /zoom-sdk/:fassung
Header: X-Zoom-Sdk-Key: <ZOOM_SDK_KEY>       (KEIN Proxy-Key)
→ 200 { fassung, url, size }   (url = kurzlebiger, signierter Storage-Link des ZIP)
→ 401 unauthorized · 404 not_found · 429 mit Retry-After · 502 upstream
```
- `:id` = Tool-ID aus suite.json (`jm-copy`, `jm-sync`, … oder `launcher`).
- Gewählt wird das neueste Release mit einem Paket für die Plattform (`paketwahl.js`, iveo-Paket Spec 10.5): auf Windows eine `.exe`, auf macOS ein DMG mit genau dieser `arch`, sonst ein universelles, auf `arm64` zuletzt ein x64-DMG (Rosetta), nie ein arm64-DMG für x64 (ohne `arch` gilt x64); fehlt es in allen Releases, antwortet der Proxy 404 mit `kein Release von <app> mit einem Paket für macOS (<arch>)` bzw. `kein Release von <app> mit einem Paket für Windows`.
- `/suite.json` liefert den **Katalog** direkt aus git (Branch = `MANIFEST_REF` in
  `wrangler.toml`). Damit erscheinen **neue Tools ohne Launcher-Release** — einfach
  `suite.json` committen. Der Launcher zieht diese URL automatisch als Default.
- `/changelog.json` und `/cookbook.json` funktionieren analog (gleicher `MANIFEST_REF`):
  neue Patchnotes bzw. **Rezepte erscheinen ohne Launcher-Release** — die jeweilige JSON
  committen (bei `cookbook.json` vorher `npm run cookbook:build`). Pfad-Overrides optional
  via `CHANGELOG_PATH` / `COOKBOOK_PATH` in `wrangler.toml`.

### Katalog-Quelle (MANIFEST_REF)
`MANIFEST_REF` in `wrangler.toml` steht auf `main` (Default-Branch, aus dem der
Live-Katalog gelesen wird). Bei einem Branch-Wechsel dort ändern, erneut
`wrangler deploy` und die CI-Variable `MANIFEST_BRANCH` (Bump-Ziel) synchron halten.

## Update auf einen Stand mit `/suite.json`
Wenn der Worker schon läuft und du nur die neue `/suite.json`-Route ausrollst:
```bash
cd services/release-proxy
wrangler deploy            # Secrets bleiben erhalten, nur Code+Vars werden aktualisiert
```
Danach testen:
```bash
curl -s -H "X-Proxy-Key: <DEIN_KEY>" \
  "https://jm-suite-proxy.jm-production-suite.workers.dev/suite.json" | head -c 200
```
Erwartet: der Anfang der `suite.json` (`{"schemaVersion":…,"tools":[…`).

## Sicherheit / Missbrauchsschutz (P3, #61)
Die **schreibenden** Endpunkte `/feedback` (legt Issues an) und `/cookbook/draft`
(öffnet PRs, ruft ggf. Anthropic) sind gehärtet:

- **Input-Größenlimits** — Bodies über 16 KB (`/feedback`) bzw. 32 KB
  (`/cookbook/draft`) → `413`; Felder (Titel/Beschreibung/Notizen …) werden hart
  gekappt. Begrenzt Body- und Prompt-Injection-Fläche. **Sofort aktiv** nach Deploy.
- **Fehler-Redaktion** — rohe GitHub-/Anthropic-Antwortkörper gehen nicht mehr an
  den Client (nur Status + serverseitiges Log via `wrangler tail`). **Sofort aktiv.**
- **Rate-Limit pro IP** — `/feedback` 10 / 10 min, `/cookbook/draft` 5 / h →
  `429` mit `Retry-After`. Braucht eine **Workers-KV-Bindung** `RATELIMIT`:
  ```bash
  cd services/release-proxy
  npx wrangler kv namespace create RATELIMIT   # gibt eine id aus
  # die id in wrangler.toml unter [[kv_namespaces]] eintragen + Zeilen einkommentieren
  npx wrangler deploy
  ```
  **Solange die Bindung fehlt, ist NUR das Rate-Limit inaktiv** (der Worker warnt
  pro Aufruf im Log); Größenlimits + Redaktion laufen unabhängig davon.

## Zoom-SDK nachladen (JM Connect 0.2.2)
`GET /zoom-sdk/:fassung` liefert JM Connect den kurzlebigen, signierten Link auf das Paket
`zoom-sdk-win-x64-<fassung>.zip` aus dem Release `zoom-sdk-<fassung>` im **privaten** Repo `ZOOM_SDK_REPO`
(Vorgabe `AlexmachtCode/jm-zoom-sdk`). Der Download läuft direkt von GitHubs Storage, der Worker streamt nichts.

- **Eigener Schlüssel:** Header `X-Zoom-Sdk-Key`, verglichen mit dem Secret `ZOOM_SDK_KEY` (zeitkonstant über
  SHA-256). Der `PROXY_KEY` gilt hier nicht, weil der Launcher ihn bis 0.17.1 in öffentliche Installer einbackte (diese
  Installer bleiben im Umlauf). Fehlt das
  Secret (oder ist es falsch benannt), antwortet die Route immer 401, und `wrangler tail` zeigt
  `zoom-sdk: Secret ZOOM_SDK_KEY fehlt …` (ohne Wert).
- **Drosselung:** eigener Bucket `zoomsdk`, 20 Anfragen je 10 Minuten je IP, VOR dem Schlüsselvergleich, auch für
  gültige Schlüssel → `429` mit `Retry-After`. Braucht die KV-Bindung `RATELIMIT` (siehe oben). Wirft KV, wird die
  Anfrage mit 502 `upstream` abgewiesen (Log `zoom-sdk: Drosselung nicht prüfbar (<Fehlername>) …`).
- **Antworten:** 200 `{ fassung, url, size }` (mit `Cache-Control: no-store`) · 401 `unauthorized` ·
  404 `not_found` (ungültige Fassung, Release oder Asset fehlt) · 502 `upstream` (andere GitHub-Fehler, ohne GitHub-Text).
- **Nie:** Schlüssel oder signierter Link im Log. Eine Prüfsumme liefert der Proxy nicht; die steht nur im Connect-Code.
- **Token:** `GITHUB_TOKEN` braucht zusätzlich `Contents: Read-only` auf `ZOOM_SDK_REPO`. Ohne diesen Zugriff
  antwortet GitHub 404, und die Route meldet `not_found`. Im Worker-Log steht dann
  `zoom-sdk: GitHub 404 für Release zoom-sdk-<fassung> in <repo> …`; fehlt nur das Asset, steht dort sein Name.
  Von Ausnahmen loggt die Route nur den Fehlernamen (`TypeError`, `SyntaxError`), nie die Meldung.
- **Einrichtung (einmalig, nur durch den Owner):** Der Owner erweitert den Token-Zugriff in GitHub und setzt das Secret
  mit `npx wrangler secret put ZOOM_SDK_KEY` (ein selbst gewählter Schlüssel, der in keinem Chat, Log oder Repo
  erscheint). Ein Deploy (`npx wrangler deploy`) geschieht nur mit seinem ausdrücklichen Okay.
- **Wahl des Schlüssels:** zufällig erzeugt, mindestens 32 Zeichen, nur druckbare ASCII-Zeichen ohne Leerzeichen
  (JM Connect lehnt alles andere mit S18 ab). Gegen Raten schützt sonst nur die Drosselung von 20 Anfragen je
  10 Minuten und IP.

## Anmeldung im Launcher (Teil 1)
Seit der Anmeldung im Launcher (Plan `docs/superpowers/plans/2026-10-21-launcher-anmeldung-teil1.md`, Spec
`docs/superpowers/specs/2026-10-17-launcher-anmeldung-design.md`) schützt eine **Sitzung** die Tool-Routen statt des
eingebackenen `PROXY_KEY`. Kollegen melden sich mit ihrem Google-Konto von `jakobsmedien.com` an, Externe mit E-Mail,
Passwort und Einladungscode; den Rechner bestätigen sie mit dem Code, den der Launcher zeigt, im System-Browser.

- **Zugang (`konto-zugang.js`):** `Authorization: Bearer jm1.…` mit einer Sitzung (Rechte je Stufe nach `konto-kern.js`)
  oder, an den Q&A-Admin-Routen, mit einer Freigabe des Launchers für genau dieses Event; ein Q&A-Event gehört danach dem
  Konto bzw. Rechner, dessen Freigabe es zuerst geöffnet hat. Der alte `PROXY_KEY` gilt im
  Übergang weiter, für Katalog, Installieren, Updates, Kochbuch, Feedback, KI-Entwurf und Q&A bis `ALTKEY_BIS`; jede solche
  Anfrage zählt der Konten-DO je Tag, Gruppe und Plattform (ohne IP). `GET /tools/launcher/latest` braucht ab Launcher 0.18.0
  nichts, damit sich auch alte Launcher selbst aktualisieren (ältere Releases nur mit Zugang, ihre Installer tragen den alten
  Schlüssel; 60 s Zwischenspeicher, Drossel je IP). `/connect/*` und `/zoom-sdk/*` prüfen wie bisher selbst: Connect bekommt die
  Anmeldung erst mit Teil 2, bis dahin läuft für Connect keine Frist (`ALTKEY_CONNECT_BIS` bleibt leer).
- **Launcher-API und Anmeldeseite (`konto-relay.js`, `konto-seiten.js`, `konto-google.js`):** alle Pfade unter `/konto/`:
  Vorgang anlegen, abholen und abbrechen, Sitzung erneuern, Abmelden, Lage (`/konto/ich`), Freigabe für Tools, iveo-Tokens,
  Zoom-Anfrage, Admin-Übersicht und Admin-Aktionen (JSON, Fehler als `{ error, code }`); die Anmeldeseite ohne Skript und
  ohne Cookie mit Passwort-Formular, Bestätigung und Google-Start und -Rückkehr.
- **Speicher:** Durable Object `KontoSpeicher` (`konto-do.js`), Bindung `KONTO`, eine Instanz in der EU
  (`KONTO_JURISDICTION` = `eu`), SQLite-gestützt, angelegt über die Migration `v2` beim Deploy (kein Vorab-Anlegen). iveo-Tokens
  liegen dort nur verschlüsselt; Sitzungen und Freigaben sind signiert und brauchen keinen Speicher.
- **Secrets** (verschlüsselt, nie in `[vars]`): `KONTO_SCHLUESSEL` und `IVEO_SCHLUESSEL` (je 32 Byte, Base64),
  `GOOGLE_CLIENT_ID` und `GOOGLE_CLIENT_SECRET` (Web-Client des Workspaces `jakobsmedien.com`, Rückkehradresse
  `https://jm-suite-proxy.jm-production-suite.workers.dev/konto/google/zurueck`), `ERSTER_ADMIN` (Google-Adresse des ersten Admins von `jakobsmedien.com`; eine andere Adresse oder ein Tippfehler wirkt nicht, der erste Admin zählt ab seiner ersten Anmeldung).
  Ohne `KONTO_SCHLUESSEL` antworten alle Pfade unter `/konto/` mit 503 „Anmeldung auf dem Server nicht eingerichtet“, der Rest
  des Workers läuft weiter; ohne Google-Client zeigt die Anmeldeseite nur die Passwort-Anmeldung. Ein Wechsel von
  `KONTO_SCHLUESSEL` meldet alle Rechner ab, ein Wechsel von `IVEO_SCHLUESSEL` macht die hinterlegten iveo-Tokens unlesbar.
- **Variablen:** `KONTO_JURISDICTION` (nicht im Betrieb ändern, sonst sind alle Konten verwaist), `ALTKEY_BIS` (Ende des
  alten Schlüssels; fehlt der Wert, gilt der Schlüssel unbefristet, und der Reiter Geräte der Admin-Maske zeigt das als
  Diagnose; einen unlesbaren Wert meldet die Bauprobe mit Exit 1), `ALTKEY_CONNECT_BIS` (in Teil 1 nie gesetzt).
- **Einrichtung:** Secrets, Google-Client, `ALTKEY_BIS` und den Deploy richtet der Controller nur mit Freigabe des Owners
  ein, beschrieben im Plan unter „Vor der Umsetzung“ und „Nach der Umsetzung“; vor jedem Deploy prüft er ungemergte
  Proxy-Commits und den Trockenlauf.
- **Tests ohne Cloudflare und ohne Netz:** `node --experimental-strip-types services/release-proxy/test/<datei>.test.mjs` für
  `konto-kern`, `konto-krypto`, `konto-do`, `konto-zugang`, `konto-routen` und `qa-relay` (Attrappen in
  `test/konto-attrappen.mjs`). Die Bauprobe bündelt den Worker wie wrangler, ohne Deploy:
  `node services/release-proxy/tools/bauprobe.mjs`.

Lokaler Test (ohne Deploy): `node services/release-proxy/test/worker.test.mjs`.

> Optional später: statt `PROXY_KEY` Cloudflare Access (Service-Tokens); Caching der
> Release-Liste (~60 s) gegen GitHub-Rate-Limits. Für die Testphase nicht nötig.
