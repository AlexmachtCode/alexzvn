# JM Production Suite — Release-Proxy (Cloudflare Worker)

Hält **ein** GitHub-Token serverseitig und liefert dem Launcher pro Tool die
neueste Version + eine signierte Download-URL. Dadurch braucht **kein Client ein
GitHub-Token**. Der Proxy selbst ist über einen `PROXY_KEY` geschützt; die
eigentlichen Downloads laufen direkt von GitHubs Storage (nicht über den Worker).

## Was du brauchst
- Cloudflare-Account (Free-Tier reicht).
- GitHub **fine-grained PAT**: Repository nur `alexzvn`, Permission **Contents: Read-only**.
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
```
- `:id` = Tool-ID aus suite.json (`jm-copy`, `jm-sync`, … oder `launcher`).
- Auf macOS bestimmt `arch` das richtige DMG (arm64/x64); auf Windows ist es x64.
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

Lokaler Test (ohne Deploy): `node services/release-proxy/test/worker.test.mjs`.

> Optional später: statt `PROXY_KEY` Cloudflare Access (Service-Tokens); Caching der
> Release-Liste (~60 s) gegen GitHub-Rate-Limits. Für die Testphase nicht nötig.
