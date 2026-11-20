# Gast-Klicker übers Internet (#317) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remote-Gäste schalten ihre lokal im JM Presenter laufenden Folien über einen Browser-Link selbst weiter (vor/zurück + Vorschaubild).

**Architecture:** Neuer Cloudflare-Worker `jm-gast-klicker` mit Durable Object `KlickRaum` (ein Raum je Event, EU) liefert die Gast-Seite und vermittelt per WebSocket zwischen Gästen und dem Presenter. Der Presenter verbindet sich ausgehend (Paket `ws`, Main-Prozess), führt nur `next()/prev()` aus und schickt Stand + JPEG-Vorschau.

**Tech Stack:** Cloudflare Workers + SQLite-Durable-Object (Hibernation-WebSockets), reines ESM-JS im Worker; Electron 33 / TypeScript / React im Presenter; `ws` 8; Tests im Stil der Suite (`ck`/`check`-Zähler, `tsx`/`node --experimental-strip-types`), Prüfstand der gepackten App per CDP.

**Spec:** `docs/superpowers/specs/2026-11-18-presenter-gast-klicker-design.md`

## Global Constraints

- Suite-Proxy `services/release-proxy` wird NICHT geändert und NICHT deployt.
- Worker-Name `jm-gast-klicker`; Basis-URL `https://jm-gast-klicker.jm-production-suite.workers.dev`; überschreibbar per `JMPR_GAST_KLICKER_URL` (nur `http:`/`https:`).
- Raum-Kennung 12 Zeichen `[a-z0-9]`; Host-Geheimnis 32 Byte hex (64 Zeichen); DO speichert nur SHA-256 (hex) des Geheimnisses.
- Drossel 150 ms je Gast-Verbindung; höchstens 30 Gäste je Raum; Gast-Nachricht ≤ 256 Byte; Bild nur vom Presenter, ≤ 256 KB (262 144 Byte); Raum verfällt 7 Tage nach letzter Presenter-Verbindung.
- Über das Internet nur `next`/`prev`; Presenter führt sie nur aus bei aktiver Präsentation und nicht pausiert.
- Vorschau 640 px breit, JPEG; ~300 ms nach Änderung von Folie oder `screen`; Quelle Publikumsfenster, sonst NDI-Fenster, sonst keine.
- Reconnect 1 s verdoppelnd bis 30 s, zufällig gestreut.
- `pausiert` wird nicht gespeichert; gespeichert werden `an`, `raum`, `geheimnis` (Datei `gast-klicker.json` in userData).
- Gast-Seite: Englisch, Deutsch bei `navigator.language` `de*`; keine externen Ressourcen; strenge CSP.
- Log: eine Zeile je Gast-Klick `[gast-klicker] next|prev`, keine Namen/IPs.
- Presenter-Version 0.14.0. Commits enden mit `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; `git add` nur mit expliziten Pfaden, danach `git status --short` lesen.
- npm nur aus `C:\Users\alexk\alexzvn\.claude\worktrees\presenter-gast-klicker-317` (großes `C:`).

## Review Focus

1. Presenter-Verbindung bricht mitten in der Präsentation ab (WLAN-Wechsel, Dienst neu deployt) → Presenter läuft ungestört weiter, verbindet von selbst neu, Gäste sehen „Presenter offline“ und danach wieder den Stand. (Task 3 Client-Test „Dienst weg und wieder da“, Task 5 Prüfstand.)
2. Zwei Presenter-Instanzen/Neustart mit demselben Raum (alte Verbindung hängt noch) → neue Verbindung mit richtigem Geheimnis ersetzt die alte, Kommandos gehen nur an die neue. (Task 1 Test „Presenter ersetzt alten Presenter“.)
3. Gast hämmert auf „Weiter“ / Skript schickt Müll → höchstens ein Kommando je 150 ms, Müll und Übergröße werden verworfen, nichts stürzt. (Task 1 Tests Drossel/Parser.)
4. Präsentation nur über NDI (kein Publikumsfenster) oder gar keine Präsentation → Gast sieht „Slide n / m“ bzw. „keine Präsentation“, Klicks bewirken nichts Falsches. (Task 3 Test „inaktiv → kein next“, Task 5 Prüfstand NDI-Fall.)
5. „Neuer Link“ während Gäste verbunden sind → alte Gäste bekommen `nichtAktiv`, alter Raum nimmt keine Kommandos mehr an. (Task 1 Test „schliessen“, Task 3 Test „neuerLink schickt schliessen“.)

---

### Task 1: Raumlogik und Durable Object `KlickRaum`

**Files:**
- Create: `services/gast-klicker/raum.js` (reine Logik + Klasse `KlickRaum`, ohne Cloudflare-Importe)
- Create: `services/gast-klicker/test/raum.test.mjs`
- Modify: `.github/workflows/ci-checks.yml` (Schritt nach „Release-Proxy“: `node services/gast-klicker/test/raum.test.mjs`)

**Interfaces:**
- Produces (ESM-Exporte aus `raum.js`):
  - Konstanten `RAUM_RE = /^[a-z0-9]{12}$/`, `DROSSEL_MS = 150`, `MAX_GAESTE = 30`, `MAX_GAST_BYTES = 256`, `MAX_BILD_BYTES = 262144`, `VERFALL_MS = 7*24*3600*1000`.
  - `leseGastNachricht(roh: string|ArrayBuffer): {dir:'next'|'prev'} | null`
  - `lesePresenterNachricht(roh: string|ArrayBuffer): {t:'hallo',geheimnis:string} | {t:'stand',aktiv:boolean,index:number,total:number,screen:'live'|'black'|'white',pausiert:boolean} | {t:'schliessen'} | {t:'bild',daten:ArrayBuffer} | null`
  - `async sha256Hex(text: string): Promise<string>` (WebCrypto `crypto.subtle`, in Node ≥ 20 und Workers vorhanden)
  - `class KlickRaum { constructor(ctx, env); async fetch(request); async webSocketMessage(ws, msg); async webSocketClose(ws); async alarm(); async nimmGastAn(ws): Promise<void>; async nimmPresenterAn(ws): Promise<void> }` — `fetch` erzeugt `WebSocketPair` und ruft `nimmGastAn`/`nimmPresenterAn` (Rolle aus Header `x-rolle: gast|presenter`, den der Worker in Task 2 setzt); Tests rufen die `nimm…An`-Methoden direkt mit Attrappen.
  - Speicher (ctx.storage): `hash` (string), `geschlossen` (boolean), `letzterPresenterMs` (number). Im Speicher der Instanz: `stand`, `bild`.
  - Anhang je WebSocket (`serializeAttachment`): `{rolle:'gast'|'presenter', bestaetigt:boolean, zuletztMs:number}`; Tags `gast` bzw. `presenter`.
- Verhalten (aus Spec 5.2): Gast an Raum ohne `hash` oder mit `geschlossen` → `{t:'nichtAktiv'}` senden, Verbindung schließen (Code 4404). Gast Nr. 31 → schließen (4429). Presenter-Erstnachricht `hallo`: ohne `hash` → Hash speichern, `ok`; gleicher Hash → `ok`, alle anderen bestätigten Presenter-Verbindungen schließen (4409), `geschlossen` löschen; anderer Hash → `abgelehnt`, schließen (4403). Vor `ok` verwirft der DO alle anderen Presenter-Nachrichten. `stand` → speichern, an alle Gäste `{t:'stand',…,presenter:true}`. Bild → merken, an alle Gäste binär. `schliessen` → `geschlossen=true`, allen Gästen `nichtAktiv` + schließen. Gast-`cmd` → nur wenn bestätigter Presenter da, Stand nicht `pausiert`, und `jetzt - zuletztMs ≥ 150` → an Presenter `{t:'cmd',dir}`. Gastzahl ändert sich → Presenter `{t:'gaeste',n}`. Neuer Gast: aktueller Stand (oder `{t:'stand',aktiv:false,…,presenter:false}`) + Bild, falls vorhanden; sonst Presenter `{t:'bildBitte'}`. Presenter weg → Gästen `{…stand, presenter:false}`. `letzterPresenterMs` bei jedem `hallo` setzen und Alarm auf `+VERFALL_MS`; `alarm()` löscht den Speicher (`deleteAll`).

- [ ] **Step 1: Tests schreiben** — `test/raum.test.mjs` mit Attrappen `ctx` (storage: Map + `get/put/delete/deleteAll/setAlarm`; `acceptWebSocket(ws, tags)`, `getWebSockets(tag)`, `getTags(ws)`) und `ws` (`send` sammelt, `close(code)` merkt, `serializeAttachment/deserializeAttachment`). Fälle (je ein `check`):
  - `leseGastNachricht('{"t":"cmd","dir":"next"}')` → `{dir:'next'}`; `'{"t":"cmd","dir":"goto"}'`, `'kaputt'`, 257-Byte-String, ArrayBuffer → `null`.
  - `lesePresenterNachricht` für `hallo` (Geheimnis nicht 64 hex → `null`), `stand` (index/total keine nicht-negativen Ganzzahlen → `null`; `screen` außerhalb live/black/white → `null`), ArrayBuffer ≤ 262144 → `bild`, 262145 → `null`.
  - „Gast ohne Presenter-Raum bekommt nichtAktiv“ (Code 4404).
  - „erster Presenter beansprucht Raum“ (Hash gespeichert = `await sha256Hex(geheimnis)`, `ok`).
  - „falsches Geheimnis abgelehnt“ (4403, kein `ok`).
  - „Presenter ersetzt alten Presenter“ (alte Verbindung 4409; `cmd` geht nur an die neue).
  - „Gast-cmd wird weitergereicht“, „zweites cmd innerhalb 150 ms verworfen“, „cmd nach 150 ms weitergereicht“ (Zeit über injizierbare Uhr `ctx.jetzt?.() ?? Date.now()`).
  - „pausiert → cmd verworfen“, „ohne Presenter → cmd verworfen“.
  - „stand geht an alle Gäste mit presenter:true“, „Bild geht binär an Gäste“, „neuer Gast ohne Bild → bildBitte an Presenter“.
  - „Gast 31 abgewiesen“ (4429), „gaeste n an Presenter bei Ein-/Austritt“.
  - „schliessen → Gäste nichtAktiv, neuer Gast nichtAktiv, cmd verworfen“; „hallo mit gleichem Geheimnis öffnet geschlossenen Raum wieder“.
  - „alarm löscht Raum“ (danach Gast → nichtAktiv).
- [ ] **Step 2: Laufen lassen** — `node services/gast-klicker/test/raum.test.mjs` → Expected: Abbruch „Cannot find module …/raum.js“.
- [ ] **Step 3: `raum.js` implementieren** (Exporte oben; WebSocket-Konstanten nicht aus Cloudflare importieren; `fetch` nutzt `globalThis.WebSocketPair` erst zur Laufzeit).
- [ ] **Step 4: Laufen lassen** — Expected: `raum: N ok, 0 FAIL`, Exit 0. Zusätzlich unter Node 22 (`npx -y node@22 services/gast-klicker/test/raum.test.mjs` oder lokales Node 22) grün.
- [ ] **Step 5: CI-Schritt ergänzen, committen**

```bash
git add services/gast-klicker/raum.js services/gast-klicker/test/raum.test.mjs .github/workflows/ci-checks.yml
git commit -m "feat(gast-klicker): Raumlogik und Durable Object KlickRaum (#317)"
```

### Task 2: Worker-Routen und Gast-Seite

**Files:**
- Create: `services/gast-klicker/worker.js`, `services/gast-klicker/gast-seite.js`, `services/gast-klicker/wrangler.toml`, `services/gast-klicker/README.md`
- Create: `services/gast-klicker/test/worker.test.mjs`
- Modify: `.github/workflows/ci-checks.yml` (zweiter Befehl im Schritt aus Task 1)

**Interfaces:**
- Consumes: `KlickRaum`, `RAUM_RE` aus `raum.js`.
- Produces: `export default { fetch(request, env) }`, `export { KlickRaum }`; `gastSeiteHtml(raum: string): string` aus `gast-seite.js`.
- Routen: `GET /k/<raum>` → 200 HTML, Header `content-type: text/html; charset=utf-8`, `cache-control: no-store`, `x-content-type-options: nosniff`, `referrer-policy: no-referrer`, `content-security-policy: default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src blob:; connect-src wss://<host> ws://<host>; base-uri 'none'; form-action 'none'; frame-ancestors 'none'` (`<host>` = `url.host`). `GET /k/<raum>/ws` und `GET /h/<raum>/ws` → ohne `Upgrade: websocket` 426; sonst an DO `env.KLICK_RAUM.jurisdiction('eu').idFromName(raum)` mit Header `x-rolle: gast|presenter`. Raum passt nicht zu `RAUM_RE` oder anderer Pfad/Methode → 404 (leerer Body).
- `wrangler.toml`: `name = "jm-gast-klicker"`, `main = "worker.js"`, `compatibility_date = "2024-11-01"`, `[[durable_objects.bindings]] name = "KLICK_RAUM" class_name = "KlickRaum"`, `[[migrations]] tag = "v1" new_sqlite_classes = ["KlickRaum"]`, `workers_dev = true`.
- Gast-Seite (Spec 5.3): Elemente `#bild` (img), `#pos` („Slide n / m“), `#zurueck`, `#weiter`, `#status`, `#hinweis`; Tasten → `ArrowRight`, `PageDown`, ` ` = weiter; `ArrowLeft`, `PageUp` = zurück; WebSocket `wss://<host>/k/<raum>/ws` (bei `http:` `ws:`), Neuverbinden 1→30 s außer nach `nichtAktiv`; Binär → `URL.createObjectURL(new Blob([d],{type:'image/jpeg'}))`, vorige URL freigeben; Knopf `.wartet` bis neuer `stand`, nach 3 s Hinweis „Click not confirmed – check your connection“ / „Klick nicht bestätigt – Verbindung prüfen“. Texte DE/EN je Zustand: verbunden, Presenter offline, pausiert, keine Präsentation, Bildschirm schwarz/weiß, Link nicht aktiv, Verbindung weg.

- [ ] **Step 1: Tests schreiben** — `test/worker.test.mjs` (Attrappe `env.KLICK_RAUM` mit `jurisdiction()` → `idFromName()` → `get()` → Stub, der Anfrage + `x-rolle` merkt und 101-Ersatz `new Response(null,{status:200})` liefert):
  - `GET /k/abcdefghij12` → 200, CSP enthält `connect-src wss://` + Host, `cache-control: no-store`; Body enthält `id="weiter"` und `id="zurueck"`.
  - Inline-Skript der Seite parst: Text zwischen `<script>` und `</script>` → `new Function(skript)` wirft nicht.
  - `GET /k/ABC` (Großbuchstaben), `/k/abc` (zu kurz), `/x`, `POST /k/abcdefghij12` → 404.
  - `GET /k/abcdefghij12/ws` ohne Upgrade → 426; mit `Upgrade: websocket` → Stub erreicht, `x-rolle: gast`; `/h/abcdefghij12/ws` → `x-rolle: presenter`; `jurisdiction('eu')` aufgerufen.
- [ ] **Step 2: Laufen lassen** — `node services/gast-klicker/test/worker.test.mjs` → Expected: Abbruch „Cannot find module …/worker.js“.
- [ ] **Step 3: `worker.js`, `gast-seite.js`, `wrangler.toml`, `README.md` (Zweck, Routen, Deploy `npx wrangler@4 deploy` aus diesem Ordner, „nicht mit dem Suite-Proxy zusammenlegen, solange die Launcher-Anmeldung im Branch lebt“) schreiben.**
- [ ] **Step 4: Laufen lassen** — Expected: `worker: N ok, 0 FAIL`; Task-1-Test weiter grün.
- [ ] **Step 5: Commit**

```bash
git add services/gast-klicker/worker.js services/gast-klicker/gast-seite.js services/gast-klicker/wrangler.toml services/gast-klicker/README.md services/gast-klicker/test/worker.test.mjs .github/workflows/ci-checks.yml
git commit -m "feat(gast-klicker): Worker-Routen und Gast-Seite (#317)"
```

### Task 3: Presenter — gemeinsame Typen, Einstellungen und Verbindungs-Client

**Files:**
- Create: `apps/presenter/src/shared/gast-klicker.ts`, `apps/presenter/src/main/gast-klicker-config.ts`, `apps/presenter/src/main/gast-klicker.ts`
- Create: `apps/presenter/test/gast-klicker.test.ts`
- Modify: `apps/presenter/package.json` (Abhängigkeit `"ws": "^8.20.1"`, devAbhängigkeit `"@types/ws": "^8.18.1"`, Selbsttest-Kette: `tsx test/gast-klicker.test.ts` am Ende), `apps/presenter/electron.vite.config.ts` (`'ws'` in `exclude` → ins Main-Bundle), `package-lock.json` (nur durch `npm install` aus dem Worktree-Ordner)
- Modify: `apps/presenter/src/main/windows.ts` (neue Funktion `captureVorschau`)

**Interfaces:**
- Produces in `src/shared/gast-klicker.ts`:
  - `export const GAST_KLICKER_BASIS = 'https://jm-gast-klicker.jm-production-suite.workers.dev'`
  - `export interface GastKlickerConfig { an: boolean; raum: string | null; geheimnis: string | null }`
  - `export type GastKlickerLage = 'aus' | 'verbindet' | 'verbunden' | 'getrennt' | 'abgelehnt'`
  - `export interface GastKlickerStatus { an: boolean; lage: GastKlickerLage; link: string | null; gaeste: number; pausiert: boolean }`
  - `export function coerceGastKlickerConfig(raw: unknown): GastKlickerConfig` (raum nur bei `/^[a-z0-9]{12}$/`, geheimnis nur bei `/^[a-f0-9]{64}$/`, sonst `null`)
  - `export function basisAusUmgebung(wert: string | undefined): string` (nur gültige `http:`/`https:`-URL ohne Pfadrest, sonst `GAST_KLICKER_BASIS`; ohne abschließenden `/`)
  - `export function gastLink(basis: string, raum: string): string` → `${basis}/k/${raum}`
  - `export function presenterWsUrl(basis: string, raum: string): string` → `https→wss`, `http→ws`, `/h/${raum}/ws`
  - `export function chatText(link: string): string` → `Advance your slides yourself / Folien selbst weiterschalten: ${link}`
  - `export function fuehreAus(lage: {aktiv: boolean; pausiert: boolean}, dir: unknown): 'next' | 'prev' | null`
  - `export function wartezeitMs(versuch: number, zufall: number): number` (1000·2^versuch, Deckel 30 000, ±20 % per `zufall` ∈ [0,1))
- Produces in `src/main/gast-klicker-config.ts`: `loadGastKlickerConfig(): GastKlickerConfig`, `saveGastKlickerConfig(c: GastKlickerConfig): void` (Datei `gast-klicker.json` in userData, Muster `remote-config.ts`).
- Produces in `src/main/windows.ts`: `export async function captureVorschau(maxBreite = 640): Promise<Buffer | null>` — Publikumsfenster (`captureAudience(maxBreite)`), sonst `getNdiWindow()` mit `capturePage()` (leer → `null`), skaliert auf `maxBreite`, `toJPEG(72)`.
- Produces in `src/main/gast-klicker.ts`:
  - `setGastKlickerStatusHandler(cb: (s: GastKlickerStatus) => void): void`
  - `getGastKlickerStatus(): GastKlickerStatus`
  - `applyGastKlicker(an: boolean): GastKlickerStatus` (beim ersten `an` Raum = 12 Zeichen aus `randomInt(36)`-Alphabet `0-9a-z`, Geheimnis = `randomBytes(32).toString('hex')`; speichert)
  - `setzeGastPause(an: boolean): GastKlickerStatus` (sendet neuen Stand sofort)
  - `neuerGastLink(): GastKlickerStatus` (an alten Raum `{t:'schliessen'}`, dann neuer Raum + Geheimnis, speichern, neu verbinden)
  - `shutdownGastKlicker(): void`
  - Abhängigkeiten über Modulimporte: `ws` (`WebSocket`), `./present` (`subscribe`, `getState`, `next`, `prev`), `./windows` (`captureVorschau`), `./gast-klicker-config`, `@jm/app-runtime` (`getLog`). Basis = `basisAusUmgebung(process.env.JMPR_GAST_KLICKER_URL)`.
  - Protokoll wie Spec 5.2; Vorschau 300 ms nach Änderung von `index`/`screen`/`active` (Timer neu starten bei schneller Folge; gleiche Kombination nicht doppelt); `bildBitte` → sofort erfassen und senden. Bei `abgelehnt` keine Neuverbindung, Lage `abgelehnt`.

- [ ] **Step 1: Tests schreiben** — `test/gast-klicker.test.ts` (Stil `ndi-schalter.test.ts`, `registerHooks`-Attrappen für `electron` (`app.getPath` → Testordner), `./present`, `./windows`, `@jm/app-runtime`; echter `WebSocketServer` aus `ws` auf `127.0.0.1:0` als Stand-in, `process.env.JMPR_GAST_KLICKER_URL = http://127.0.0.1:<port>`):
  - Reine Helfer: `coerceGastKlickerConfig({an:true,raum:'ABC',geheimnis:'x'})` → `{an:true,raum:null,geheimnis:null}`; gültige Werte bleiben; `basisAusUmgebung('ftp://x')` → Vorgabe, `('http://127.0.0.1:9/')` → `'http://127.0.0.1:9'`; `presenterWsUrl('https://a.b','abcdefghij12')` → `'wss://a.b/h/abcdefghij12/ws'`; `fuehreAus({aktiv:true,pausiert:false},'next')` → `'next'`, pausiert → `null`, inaktiv → `null`, `'goto'` → `null`; `wartezeitMs(0,0.5)` = 1000, `wartezeitMs(10,0.5)` = 30000.
  - Client: „verbindet und sendet hallo mit Geheimnis als erste Nachricht“; „nach ok: Lage verbunden, Stand gesendet“; „cmd next bei aktiver Präsentation → next() einmal“; „pausiert → kein next()“; „inaktiv → kein next()“; „Folienwechsel → nach ~300 ms ein Binärbild (FF D8) “; „bildBitte → Bild“; „gaeste 3 → Status gaeste 3“; „abgelehnt → Lage abgelehnt, keine Neuverbindung binnen 2 s“; „Dienst weg und wieder da → Lage getrennt, dann wieder verbunden, hallo erneut“; „neuerGastLink → schliessen an alten Raum, neue Verbindung zu anderem Raum“; „Einstellungen gespeichert: an/raum/geheimnis, kein pausiert“.
- [ ] **Step 2: Laufen lassen** — `npx tsx test/gast-klicker.test.ts` im Ordner `apps/presenter` → Expected: Abbruch „Cannot find module …/gast-klicker“.
- [ ] **Step 3: Abhängigkeiten eintragen** — im Worktree-Ordner `npm install ws@^8.20.1 -w @jm/presenter` und `npm install -D @types/ws@^8.18.1 -w @jm/presenter`; `git diff --stat package-lock.json` darf nur Einträge für presenter/ws/@types/ws zeigen.
- [ ] **Step 4: Module implementieren** (`shared/gast-klicker.ts`, `main/gast-klicker-config.ts`, `main/gast-klicker.ts`, `captureVorschau` in `windows.ts`, `'ws'` in `exclude`).
- [ ] **Step 5: Laufen lassen** — Expected: `gast-klicker: N ok, 0 FAIL`; dann `npm run selftest -w @jm/presenter` (Node 24) und unter Node 22 grün; `npm run typecheck -w @jm/presenter` grün.
- [ ] **Step 6: Commit**

```bash
git add apps/presenter/src/shared/gast-klicker.ts apps/presenter/src/main/gast-klicker-config.ts apps/presenter/src/main/gast-klicker.ts apps/presenter/src/main/windows.ts apps/presenter/test/gast-klicker.test.ts apps/presenter/package.json apps/presenter/electron.vite.config.ts package-lock.json
git commit -m "feat(presenter): Gast-Klicker-Verbindung zum Cloud-Dienst (#317)"
```

### Task 4: Presenter — IPC, Fernsteuerungs-Abschnitt, Anzeige in der Referentenansicht

**Files:**
- Modify: `apps/presenter/src/main/ipc.ts` (nach dem Abschnitt „Network remote“), `apps/presenter/src/main/index.ts` (`before-quit` → `shutdownGastKlicker()`), `apps/presenter/src/preload/index.ts`, `apps/presenter/src/shared/types.ts` (`JmprApi.gastKlicker`)
- Create: `apps/presenter/src/renderer/src/components/GastKlickerAbschnitt.tsx`, `apps/presenter/src/renderer/src/components/GastKlickerPille.tsx`
- Modify: `apps/presenter/src/renderer/src/components/RemotePanel.tsx` (Abschnitt unter dem LAN-Teil), `apps/presenter/src/renderer/src/views/PresenterView.tsx` (Pille neben `NdiSchalter variante="referent"`)
- Test: `apps/presenter/test/gast-klicker.test.ts` (ergänzen)

**Interfaces:**
- Consumes: Task 3 (`applyGastKlicker`, `setzeGastPause`, `neuerGastLink`, `getGastKlickerStatus`, `setGastKlickerStatusHandler`, `shutdownGastKlicker`, `chatText`, `GastKlickerStatus`).
- IPC: `gastKlicker:status` (handle), `gastKlicker:setzeAn` (handle, `an: boolean`), `gastKlicker:pause` (handle, `an: boolean`), `gastKlicker:neuerLink` (handle), Push `gastKlicker:status` an alle Fenster (`broadcastAll`). Beim Start: gespeichert `an` → `applyGastKlicker(true)`.
- Preload `jmpr.gastKlicker = { status(): Promise<GastKlickerStatus>; setzeAn(an: boolean): Promise<GastKlickerStatus>; pause(an: boolean): Promise<GastKlickerStatus>; neuerLink(): Promise<GastKlickerStatus>; onStatus(cb): () => void }`.
- `GastKlickerAbschnitt`: Überschrift „🌐 Gast-Klicker übers Internet (Zoom-Gäste)“; Schalter; bei `an`: Link (nur lesbar, markierbar), Knopf „Für den Zoom-Chat kopieren“ (`navigator.clipboard.writeText(chatText(link))`, danach 2 s „Kopiert ✓“), Status-Text je Lage (`verbunden · n Gäste`, `verbindet …`, `getrennt – verbindet neu`, `abgelehnt – „Neuer Link“ drücken`), Knopf „Gast-Klick pausieren“/„Gast-Klick fortsetzen“, Knopf „Neuer Link“ mit `window.confirm('Neuen Link erzeugen? Der alte Link funktioniert dann nicht mehr.')`; Hinweistext „Wer den Link hat, kann vor/zurück klicken. Ist Publikum im Chat, den Link privat an den Gast schicken.“
- `GastKlickerPille`: nur sichtbar bei `an`; Text „Gast-Klick ●“ (verbunden, nicht pausiert), „Gast-Klick pausiert“, „Gast-Klick getrennt“; Klick schaltet Pause um; `title` erklärt es.
- Reine Textwahl testbar: `export function pillenText(s: GastKlickerStatus): string | null` und `export function statusText(s: GastKlickerStatus): string` in `src/shared/gast-klicker.ts`.

- [ ] **Step 1: Tests ergänzen** — `pillenText({an:false,…})` → `null`; verbunden+nicht pausiert → `'Gast-Klick ●'`; pausiert → `'Gast-Klick pausiert'`; getrennt → `'Gast-Klick getrennt'`; `statusText` verbunden mit 2 Gästen → `'verbunden · 2 Gäste'`, 1 Gast → `'verbunden · 1 Gast'`, abgelehnt → enthält `Neuer Link`.
- [ ] **Step 2: Laufen lassen** → Expected: FAIL „pillenText is not a function“.
- [ ] **Step 3: Implementieren** (Helfer, IPC, Preload, Typen, Komponenten, Einbau, `before-quit`).
- [ ] **Step 4: Prüfen** — `npx tsx test/gast-klicker.test.ts` grün; `npm run selftest -w @jm/presenter` grün; `npm run typecheck -w @jm/presenter` grün.
- [ ] **Step 5: Commit**

```bash
git add apps/presenter/src/main/ipc.ts apps/presenter/src/main/index.ts apps/presenter/src/preload/index.ts apps/presenter/src/shared/types.ts apps/presenter/src/shared/gast-klicker.ts apps/presenter/src/renderer/src/components/GastKlickerAbschnitt.tsx apps/presenter/src/renderer/src/components/GastKlickerPille.tsx apps/presenter/src/renderer/src/components/RemotePanel.tsx apps/presenter/src/renderer/src/views/PresenterView.tsx apps/presenter/test/gast-klicker.test.ts
git commit -m "feat(presenter): Gast-Klicker bedienen (Fernsteuerung, Referentenansicht) (#317)"
```

### Task 5: Prüfstand-Gruppe `gastklicker` (gepackte App)

**Files:**
- Modify: `apps/presenter/test/pruefstand.mjs` (Gruppe `gastklicker`, Eintrag in `GRUPPEN`)

**Interfaces:**
- Consumes: `KlickRaum` aus `services/gast-klicker/raum.js` als Stand-in-Dienst: kleiner Node-`http`-Server + `ws`-`WebSocketServer` (`noServer`), der `/h/<raum>/ws` und `/k/<raum>/ws` an eine `KlickRaum`-Instanz mit Attrappen-`ctx` (wie Task-1-Test) reicht, Adapter `ws` → Hibernation-API (`send`, `close`, `serializeAttachment`, `deserializeAttachment`; `message` → `webSocketMessage`, `close` → `webSocketClose`). App-Start mit `JMPR_GAST_KLICKER_URL=http://127.0.0.1:<port>`.
- Bedienung über CDP im Editor: `window.jmpr.gastKlicker.setzeAn(true)`, `.status()`, `.pause(true|false)`; Präsentation starten wie in `gruppeNavigation`.

- [ ] **Step 1: Fälle schreiben** (je `fall(...)` innerhalb `mitApp`):
  1. Einschalten → binnen 5 s Lage `verbunden`, `link` endet auf `/k/<12 Zeichen>`.
  2. Gast verbindet (Node-`WebSocket` gegen Stand-in), Präsentation mit 3 Folien läuft → Gast bekommt `stand` mit `total:3`, `presenter:true`; `status().gaeste === 1`.
  3. Gast `next` → binnen 2 s `present.getState().index === 1` und Gast bekommt `stand index:1`; binnen 2 s Binärbild ≥ 1000 Byte, beginnt mit `FF D8`.
  4. `pause(true)` → Gast `next` → nach 1,5 s Index unverändert; Gast-Stand `pausiert:true`; `pause(false)` → `next` wirkt wieder.
  5. Stand-in stoppen → Lage `getrennt`, App reagiert (Editor-Evaluate antwortet); Stand-in mit gleicher `KlickRaum`-Instanz neu starten → binnen 10 s wieder `verbunden`.
  6. App neu starten (gleiches Profil) → gleicher Link, verbindet von selbst.
  7. Nur NDI (Publikumsfenster aus, wie Gruppe `ndi`): Gast `next` → Index wechselt; Bild ≥ 1000 Byte oder `ueberspringe('NDI-Fenster liefert kein capturePage-Bild')` mit gemessenem Grund.
- [ ] **Step 2: Paket bauen und laufen lassen** — `npm run dist:dir -w @jm/presenter` (mit `NDI_SDK_DIR` wie bisher), dann `node apps/presenter/test/pruefstand.mjs --nur gastklicker` → Expected vor Task 3/4: nicht relevant (Gruppe neu); jetzt: alle Fälle ok (oder Fall 7 mit begründetem skip).
- [ ] **Step 3: Volle Prüfstand-Runde** — `node apps/presenter/test/pruefstand.mjs` → Expected: nur die bekannten ndi-FAILs 4, 13, 14, 15 (identisch zu main), sonst ok.
- [ ] **Step 4: Commit**

```bash
git add apps/presenter/test/pruefstand.mjs
git commit -m "test(presenter): Prüfstand-Gruppe gastklicker (#317)"
```

### Task 6: Version, Handbuch, Release-Vorbereitung

**Files:**
- Modify: `apps/presenter/package.json` (`"version": "0.14.0"`), `packages/cookbook/content/tool-manuals/tool-jm-presenter.md` (Abschnitt „Gast-Klicker übers Internet“), `packages/cookbook/cookbook.json` (neu gebaut, CRLF-Falle: `core.autocrlf false`, CR entfernen, bauen, nur `.md` + `cookbook.json` stagen, `autocrlf` zurück)
- Changelog `packages/suite-manifest/changelog.json` erst nach Owner-Freigabe der Texte (eigener Katalog-Commit wie 0.13.2).

- [ ] **Step 1:** Version setzen; Handbuch-Abschnitt (Einschalten, Link in den Chat, Pause, Neuer Link, Hinweis Publikum, was der Gast sieht).
- [ ] **Step 2:** Cookbook bauen und prüfen (`npm run build -w @jm/cookbook`, Prüfskript wie bei #313).
- [ ] **Step 3:** `npm run selftest -w @jm/presenter`, `npm run typecheck -w @jm/presenter`, beide Worker-Tests grün.
- [ ] **Step 4: Commit**

```bash
git add apps/presenter/package.json packages/cookbook/content/tool-manuals/tool-jm-presenter.md packages/cookbook/cookbook.json
git commit -m "chore(presenter): Version 0.14.0, Handbuch Gast-Klicker (#317)"
```

Danach (außerhalb der Tasks, je mit Owner-OK): Gesamtprüfung durch frischen Gutachter → Worker-Deploy → Rauchtest gegen den echten Dienst (Skript als Presenter + Gast) → PR → Release-Kit 0.14.0 (`freigabe.ps1` aus der 0.13.2-Vorlage, Katalog-Kette auf dem dann aktuellen main) → Merge nach Release.
