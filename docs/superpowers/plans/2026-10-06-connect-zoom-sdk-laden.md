# JM Connect: Zoom-SDK nachladen — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** JM Connect lädt das Zoom-Meeting-SDK 7.1.5.43953 auf Knopfdruck aus der privaten Ablage, prüft es gegen die im Connect-Code gepinnte Prüfsumme und richtet es über die vorhandene Prüf- und Kopierstrecke ein — ohne dass der Bediener das SDK selbst besorgen und als Ordner wählen muss.

**Architecture:**
- **Proxy** (`services/release-proxy/worker.js`): neue Route `GET /zoom-sdk/:fassung` vor dem PROXY_KEY-Gate. Eigener Schlüssel `ZOOM_SDK_KEY` (zeitkonstant über SHA-256 verglichen), eigener Drossel-Bucket `zoomsdk`, Antwort `{ fassung, url, size }` mit dem kurzlebigen, signierten Storage-Link aus dem privaten Repo `ZOOM_SDK_REPO`. Der Worker streamt nichts.
- **Connect, rein und ohne Electron** (`src/main/zoom/`): `sdk-paket.ts` (gepinnte Werte), `sdk-laden.ts` (`holeLink`, `lade`, `entpacke`, `ladeFehlerText`, Dienste mit eingespeisten Werkzeugen), `sdk-schluessel-eingabe.ts` (Nutzlast-Prüfung). Der Kern (`kern.ts`) bekommt `sdkLaden`, `sdkLadenAbbrechen`, `sdkSchluesselEintragen`, `sdkSchluesselLoeschen`; `sdkWaehlen` wird ohne Verhaltensänderung in `pruefeUndRichteEin(ordner, herkunft)` geteilt, und das Laden läuft danach durch genau diese Strecke.
- **Connect-Hülle**: `settings.ts` (SDK-Schlüssel nach dem Muster der Zugangsdaten), `shared/ipc.ts`, `shared/types.ts`, Preload, `main/zoom.ts`; `shared/zoom-text.ts` (Zeilen, Knöpfe, Balken, Textfarbe) und `ZoomCard.tsx` (Zeile „SDK-Schlüssel“, Knopf „Zoom-SDK laden“ mit Fortschritt und „Abbrechen“).

**Tech Stack:** Cloudflare Worker (ESM; lokaler Selbsttest mit Node ≥ 23.6 und Type-Stripping), TypeScript (ESM), Electron 33, electron-vite 2, React 18 + Tailwind 4, `tsx` ^4.19.2 (Connect-Tests), Node 22 in CI und 24 lokal, Windows-`tar.exe` (bsdtar) zum Entpacken.

**Spec:** `docs/superpowers/specs/2026-10-06-connect-zoom-sdk-laden-design.md` (vom Owner freigegeben am 06.10.2026, ebenso das private Repo und der Upload). Plan und Spec gehören zusammen. Bei Widerspruch gilt die Spec, außer bei den begründeten Abweichungen A1–A14 unten.

**Arbeitsverzeichnis:** `C:\Users\alexk\alexzvn\.claude\worktrees\master-link-2b` (Branch `feat/connect-zoom-sdk-laden`). Alle Pfade sind relativ dazu.

**Wie dieser Plan entstanden ist:**
- Jede Aufgabe wurde am 06.10.2026 an einer Kopie von `apps/connect` und `services/release-proxy` im Scratchpad nachgebaut (Windows 11, Node 24.16.0). Gemessen wurde jeder Test erst rot, dann grün. Die Zählstände in den Schritten sind gemessen.
- Die großen Testblöcke und die neuen Dateien stehen in diesem Plan Zeichen für Zeichen so, wie sie in der Kopie grün liefen.
- Gegenproben mit absichtlich eingebauten Fehlern stehen am Ende der jeweiligen Aufgabe. Jede dieser Gegenproben machte den Lauf rot.
- Nicht ausgeführt wurden ein Lauf unter Linux mit Node 22 (CI) und ein Klick durch die echte Karte. Den Klick übernimmt der Owner in der Abnahme (Aufgabe 9).
- **Nachbesserung (06.10.2026, nach drei Prüfern):** Eingearbeitet sind G2-Bridge-Umgebung, G16 (R8), A5/A6/A8 präzisiert, A11–A14 neu, zwölf zusätzliche Prüfungen (sdk-laden +5, zoom-kern +3, zoom-text +4) und zwei reine Funktionen für die Karte. Alles ist auf einer frischen Kopie neu gemessen worden: erst die ganze Montage, dann Aufgabe für Aufgabe mit Typecheck und ganzer Selbsttest-Kette (Tabelle in der Selbstprüfung). Jeder neue Test war vor seinem Code rot; die Gegenproben stehen bei den Aufgaben.

## Global Constraints

- **G1 Gepinntes Paket, wörtlich:** fassung `'7.1.5.43953'`; datei `'zoom-sdk-win-x64-7.1.5.43953.zip'`; sha256 `'596ef61956b5f336570dd3cd14b0ec9822d51e37a2a4fc03ce4f96c1974b3b4e'`; bytes `150120193`; bytesEntpackt `329657415` (153 Dateien). Ablage: privates Repo `AlexmachtCode/jm-zoom-sdk`, Release-Tag `zoom-sdk-7.1.5.43953`, einziges Asset ist das ZIP.
- **G2 SDK-Schlüssel:** Es gibt keinen Vorgabewert. Der Schlüssel steht in keinem Code, CI-Secret, Build-Wert, Log, Abbild oder Rückgabetext. Namen: Header `X-Zoom-Sdk-Key`, Worker-Secret `ZOOM_SDK_KEY`, Connect-Umgebung `JMPS_ZOOM_SDK_KEY`, Einstellung `zoomSdkKeyEnc` (safeStorage, base64). Der `PROXY_KEY` wird für diese Route weder verlangt noch benutzt. Die Zoom-Bridge (Kindprozess, lädt die Zoom-DLLs) erbt weder `JMPS_ZOOM_SDK_KEY` noch `JMPS_PROXY_KEY`: beide stehen in `envRemove` (kern.ts, Aufgabe 4), wie heute die `ZOOM_SDK_*`-Zugangsdaten. Über das Netz geht der Schlüssel nur per https (A14).
- **G3 Testwerte (R3):** Als Schlüsselwerte (SDK-Schlüssel, Secret, Proxy-Schlüssel) nur `'sdk-test'`, `'falsch'` und `'sdk-geheim-test'`; der Prüfstand des Proxys behält seinen vorhandenen Proxy-Schlüssel `'k'`. Signierte Links in Attrappen tragen den Marker `geheim-link` (kein Schlüssel, niedrige Entropie). Keine langen, zufällig aussehenden Strings an Namen mit key, secret oder token, sonst schlägt die gitleaks-Regel generic-api-key im CI-Job „Secret-Scan“ an.
- **G4 Texte:** S11–S18 stehen wörtlich wie in Spec 5, mit deutschen Anführungszeichen „…“ und der Auslassung „…“ (U+2026). Die Logzeilen stehen wörtlich wie in den Aufgaben. Nie geloggt werden Schlüssel oder signierter Link; vom Proxy steht nur der Host im Log.
- **G5 Rein bleibt rein** (wie Plan 4a, dort G8; die Kommentare in `laufzeit.ts` nennen noch „G8“): `src/main/zoom/*.ts` importiert kein `electron`. Erlaubt sind `node:`-Module, relative Pfade und `@jm/zoom-bridge`. `src/shared/*` hat keine `node:`-Importe, weil der Renderer-tsconfig diese Dateien mitprüft.
- **G6 Keine Zoom-Datei** in Repo, Test, Installer oder `apps/connect/resources`. Tests nutzen ein erfundenes Mini-Paket. Kein Test ruft den echten Proxy oder GitHub.
- **G7 Vergleich im Proxy (R1):** Beide Werte werden mit `crypto.subtle.digest('SHA-256')` gehasht, die Digests per XOR-Schleife ohne frühen Ausstieg verglichen. `crypto.subtle.timingSafeEqual` gibt es nur in der Workers-Laufzeit, nicht in Node (worker.test.mjs).
- **G8 Entpacken (R2):** `entpacke()` startet unter win32 `%SystemRoot%\System32\tar.exe` mit absolutem Pfad, ohne Shell. Auf anderen Plattformen kommt sofort der Fehler `entpacken` mit Grund „nur Windows“. Der Test mit echtem `tar.exe` läuft nur unter Windows und zählt sonst sichtbar als „übersprungen“. Alle Fälle mit eingespeistem Start laufen überall, auch in der Linux-CI.
- **G9 Arbeitsordner (R9 geprüft):** `%LOCALAPPDATA%\JM Connect\zoom-laufzeit\laden\` stört die Laufzeit nicht. `pruefeLaufzeit` liest nur `<basis>\7.1.5.43953` (laufzeit.ts:317). Das Aufräumen in `richteEin` löscht nur Geschwister, die in ihrer Wurzel einen gültigen Stempel `jm-zoom-laufzeit.json` haben (laufzeit.ts:283-292); in `laden` liegen nur das ZIP und der Unterordner `sdk`. Die Wächter (`tools/bundle-zoom-bridge.mjs`, `tools/after-pack.cjs`) prüfen nur das gebaute Paket.
- **G10 Platz vor dem Laden:** Der Bedarf ist `bytes + 2 × bytesEntpackt + 100 MiB`, gerundet 872 MB. Reicht der Platz nicht, kommt S5. `richteEin` prüft danach weiter seinen eigenen Bedarf.
- **G11 Kern-Harness (R6):** Wer nach einem Kern-Aufruf `p.befehle()` liest, wartet vorher mit `await bis(...)` (CI-Fix #242). Neue Fälle stehen direkt über der Zeile `// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──`, wo eine Testdatei sie hat; in `zoom-settings.test.ts` stehen sie vor der Schlusszeile.
- **G12 TDD und Abschluss (R7):** Erst den Test rot sehen, dann der Code. Jede Connect-Aufgabe endet mit grünem `npm run selftest -w @jm/connect` und grünem `npm run typecheck -w @jm/connect`. Die Proxy-Aufgabe endet mit grünem `node services/release-proxy/test/worker.test.mjs`. Neue Connect-Testdateien hängen in `apps/connect/package.json` unter „selftest“, damit die CI (Ubuntu, Node 22) sie ausführt.
- **G13 git (R4):** Jede Aufgabe committet ihre Dateien selbst. `git add` nur mit expliziten Pfaden, danach `git status --short` lesen. Erwartet sind dann genau die Pfade der Aufgabe als gestaged (`M ` bzw. `A `). Zusätzlich darf nur die Zeile `?? docs/superpowers/plans/2026-10-06-connect-zoom-sdk-laden.md` erscheinen, solange dieser Plan unversioniert ist; er wird nie mitgestaged. Die Commit-Nachricht ist deutsch, die letzte Zeile lautet `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Nennt die Sitzungsvorgabe des Implementierers für Commits eine andere Co-Authored-By-Zeile (anderes Modell), gilt deren Zeile. Verboten sind push, tag, merge, release, PR, jeder `wrangler`-Aufruf, Branch-Wechsel, bare `git stash`, `git reset --hard` und `git clean`.
- **G14 CRLF:** Die Dateien im Arbeitsbaum haben CRLF (`core.autocrlf=true`). Ersetzungen laufen mit dem Edit-Werkzeug (Vorher-Text exakt), nicht mit `sed`.
- **G15 Nicht anfassen:** `packages/**` (auch `@jm/zoom-bridge`), `.github/workflows/**`, Versionsnummern, Changelog, Katalog und Manifest, `apps/connect/ABNAHME-0.2.0.md`. Keine Secret-Werte lesen oder ausgeben (`.dev.vars`, `.env`, Einstellungsdateien, Zugangsdaten-Dateien). Keine Dateien außerhalb von Worktree und eigenem Scratchpad öffnen.
- **G16 Teilung ohne Verhaltensänderung (R8):** `sdkWaehlen` wird in `pruefeUndRichteEin(ordner, herkunft)` geteilt, ohne dass sich sein Verhalten ändert (Spec 4.3 Schritt 6). Zuerst kommt ein Regressionstest, der das heutige Verhalten samt Logzeilen wörtlich pinnt und auf dem UNVERÄNDERTEN Code grün läuft. Erst danach wird geteilt, und derselbe Test bleibt grün (Aufgabe 6). Ist der Regressionstest vor der Teilung rot, stimmt der Test nicht, und die Teilung beginnt nicht.

### Abweichungen von der Spec (begründet)

- **A1 (R1):** Spec 3.1 nennt `crypto.subtle.timingSafeEqual`. Umgesetzt wird Digest plus XOR-Schleife (G7), mit derselben Absicht.
- **A2 (R2):** Spec 6 nennt „unter Linux mit dem System-`tar`“. GNU tar kann kein ZIP, also läuft der Echt-Test nur unter Windows; sonst übernimmt der eingespeiste Start (G8).
- **A3:** Spec 3.1 sagt, `resolveSignedUrl` bekomme das Repo als Parameter. Das ist schon so (worker.js:381; einziger Aufrufer :301 mit `env.REPO`), deshalb gibt es keine Codeänderung. Ein Regressionstest belegt, dass `/tools/…` weiter `env.REPO` nutzt.
- **A4:** `lade()` bekommt zusätzlich `size`, weil die Spec-Prüfung „size ≠ gepinnt → `fehlt`“ diesen Wert braucht, und `beimPruefen`, das die Phase „pruefen“ setzt, sobald der Strom endet. `holeLink` und `lade` melden einen Abbruch als Art `abgebrochen`; `entpacke` meldet ihn wie in der Spec als `entpacken`. Der Kern macht aus jedem Abbruch S17 (Spec 5, Zeile „Abbruch“), unabhängig von der gemeldeten Art.
- **A5:** Laut Spec 5 stehen in `{grund}` nur Netz-Codes (`ENOTFOUND`, `ETIMEDOUT`, HTTP-Status). Umgesetzt sind zusätzlich feste Texte ohne Link und ohne Wert, damit jeder Fehler einen Grund hat:
  - `unvollstaendig` (S16): „unvollständig“, wenn der Strom zu früh endet; „zu groß“, wenn mehr Bytes als gepinnt kommen (dann wird sofort abgebrochen).
  - `proxy` (S14): „Antwort ungültig“, wenn eine 200-Antwort kein JSON oder kein gültiges `url`/`size` hat; „kein HTTPS“ (A14); „Adresse ungültig“, wenn die Proxy-Adresse keine URL ergibt. S14 sagt dann „nicht erreichbar“, obwohl der Proxy antwortet. Die Spec ordnet „sonstiges“ aber ausdrücklich der Art `proxy` zu, und S14 ist ein freigegebener Text.
  - `entpacken` (S16c): „Exit <n>“, „nur Windows“, „SystemRoot fehlt“, „abgebrochen“.
  - Hat ein Fehler keinen Code, nimmt `fehlerCode` seinen Namen (zum Beispiel `TypeError`), sonst „unbekannt“. Die Meldung eines Fehlers steht nie im Grund, weil sie einen Link zitieren könnte.
- **A6:** S13 rechnet `max(1, ⌈s/60⌉)`. Ein unbrauchbares `Retry-After` wird zu 60 s, „in 0 Minuten“ kommt also nie vor. Bei genau einer Minute steht die Einzahl: „in 1 Minute“ statt „in 1 Minuten“. Das ist der häufigste Fall, denn ohne `Retry-After` gelten 60 s. Der Owner sieht die Form bei der Freigabe der Texte (Offene Punkte).
- **A7:** Spec 4.4 sagt, die Sperre sei nur frei, wenn `laden === null`. Umgesetzt wird das über `ladeLauf === null`; das umfasst die Phasen bis zum Entpacken und zusätzlich die anschließende Kopie samt Aufräumen.
- **A8:** Es gibt zusätzliche Logzeilen, alle ohne Wert:
  - `[zoom] SDK-Link angefragt bei <host>` (Spec 4.3: „Vom Proxy wird nur der Host geloggt“)
  - `[zoom] Zoom-SDK laden abgewiesen: <S11>`
  - `[zoom] SDK-Schlüssel abgewiesen: <S18>`
  - `[zoom] Geladenes Zoom-SDK abgewiesen: <Text>`
  - `[zoom] Aufräumen nach dem Laden unvollständig (<Code>)`
  - `[zoom] Laden des Zoom-SDK nicht rechtzeitig abgebrochen`

  Keine davon ersetzt eine Spec-Zeile. Jedes gescheiterte Laden endet mit `[zoom] Laden des Zoom-SDK gescheitert: <Text>`, auch wenn `pruefeOrdner` das geladene Paket abweist oder die Kopie scheitert. Nach dem Entpacken stehen dann zwei Zeilen: erst die der gemeinsamen Strecke (`Geladenes Zoom-SDK abgewiesen: …` bzw. die bestehende `Einrichtung des Zoom-SDK gescheitert: …`), danach die Spec-Zeile.
- **A9:** Auf der Karte erscheint S17 grau als `einrichtung.sdk.text` (Spec: „als Hinweis und nicht rot“), und zwar auch als sofortige Antwort des Knopfs, bevor das gedrosselte Abbild (höchstens alle 100 ms) ankommt. Darüber entscheidet die reine Funktion `einrichtungsTextArt` (Aufgabe 8); den Balken liefert `sdkBalken`. Die Statuszeile der Karte (Z1b) zeigt beim Laden die Phase statt „wird kopiert: 0 von 0 Dateien“. „Entfernen“ beim SDK-Schlüssel fehlt bei „aus der Umgebung“ und auch bei „fehlt“.
- **A10:** Der Proxy setzt bei 200 zusätzlich `Cache-Control: no-store`, damit der signierte Link in keinem Zwischenspeicher landet. Andere Methoden als GET auf `/zoom-sdk/…` bekommen nach der Drosselung 404.
- **A11:** Spec 4.3 sagt, fetch, Dateisystem, `spawn` und Uhr würden eingespeist. Eingespeist sind in `LadeWerkzeuge` fetch, Uhr, das Schreibziel (`oeffne`, damit Teil-Schreibvorgänge testbar sind), der Prozessstart, Plattform und `SystemRoot`. Dazu kommen im Kern `freierPlatz` und `loesche` über `SdkLadenDienste`. `mkdirSync`, `renameSync` und `rmSync` in `lade()`/`entpacke()` laufen echt; die Tests arbeiten dafür auf einem echten Temp-Ordner und prüfen dort Ziel, `.teil` und Zielordner.
- **A12:** Spec 4.3 nennt Platz (3) vor Arbeitsordner (4). Umgesetzt werden die Reste eines früheren Laufs **vor** der Platzmessung gelöscht. Nach einem Absturz kurz vor dem Entpacken liegen sonst rund 460 MB (ZIP und `sdk/`) in `zoom-laufzeit\laden`, zählen gegen den Bedarf von 872 MB, und es käme S5, obwohl das Aufräumen genug Platz schafft. Die Spec-Absicht bleibt gewahrt: Bei S5 ist nichts angelegt, nur Müll ist weg.
- **A13:** Spec 4.2 lässt S18 bei leerem Wert oder Leerraum in der Mitte kommen. Umgesetzt gilt S18 für alles außer druckbaren ASCII-Zeichen (`/^[\x21-\x7e]+$/` nach dem Trimmen). Das umfasst die Spec-Fälle. Zusätzlich fängt es Zeichen wie „€“ ab, die `fetch` nicht in einen Header schreiben kann: Sonst scheiterte das Laden später mit S14 und dem Grund `TypeError` („Proxy nicht erreichbar“), gemessen mit Node 24. Ein Schlüssel aus der Umgebung `JMPS_ZOOM_SDK_KEY` wird nicht so geprüft (Offene Punkte).
- **A14:** Die Spec sagt nichts zum Schema der Proxy-Adresse. `normalize` in `settings.ts` lässt `http://` zu (JMPS_PROXY_URL, Einstellung). `holeLink` schickt den SDK-Schlüssel nur an `https://` oder per `http://` an die eigene Maschine (`127.0.0.1`, `localhost`, `[::1]`; Tests, `wrangler dev`). Sonst kommt `proxy` mit Grund „kein HTTPS“, ohne Anfrage. Der signierte Link vom Proxy wird **nicht** so geprüft: An ihn geht kein Schlüssel, und den Inhalt sichern Länge und gepinnter SHA.

## Review Focus

1. **Doppelklick auf „Zoom-SDK laden“:** Ein zweiter `sdkLaden()`, während der erste noch auf den Link wartet, liefert S10. Der Link wird genau einmal angefragt, und es gibt genau einen Lauf. → Test in **Aufgabe 7** („Review Focus SDK-1“).
2. **Connect wird während des Ladens beendet:** `kern.beenden` bricht das Laden ab und kehrt erst zurück, wenn es samt Aufräumen fertig ist (höchstens `fristMs`). Danach ist `zoom-laufzeit\laden` weg. Hört ein Laden den Abbruch nicht, steht das nach der Frist im Log. → Tests in **Aufgabe 7** („Review Focus SDK-2“ und „beenden mit Frist“).
3. **Der Storage liefert mehr Bytes als gepinnt** (falsches oder manipuliertes Paket mit passender `size`): Der Download bricht beim Überschreiten ab, statt die Platte zu füllen; `.teil` ist weg; Ergebnis `unvollstaendig` mit Grund „zu groß“. → Test in **Aufgabe 5** („Review Focus SDK-3“): Der Testserver sendet bis zum Zehnfachen der Paketgröße, und der Test belegt, dass der Client die Verbindung vorher schließt.
4. **Der SDK-Schlüssel wird mit Leerraum oder Zeilenumbruch eingefügt** (Kopieren aus einer Nachricht): Leerraum am Rand wird getrimmt, und der Schlüssel gilt. Leerraum in der Mitte ergibt S18, und nichts wird gespeichert. → Tests in **Aufgabe 4** („Review Focus SDK-4“ und S18-Schleife).
5. **Reste eines früheren Laufs** (Absturz oder Stromausfall mitten im Laden) liegen in `zoom-laufzeit\laden`: Sie sind weg, bevor der Platz gemessen wird (A12) und bevor der neue Lauf den Link anfragt, und gelangen nie in die Einrichtung. → Test in **Aufgabe 7** („Review Focus SDK-5“).

---

## Testläufe (wie sie wirklich heißen)

| Was | Befehl (aus der Worktree-Wurzel) | Stand vorher → nachher (gemessen, Windows) |
| --- | --- | --- |
| Proxy | `node services/release-proxy/test/worker.test.mjs` | `33 passed` → `62 passed, 0 failed` |
| Connect alle | `npm run selftest -w @jm/connect` | Kette bis `Alle after-pack-Tests bestanden.` |
| Connect einzeln | `npx tsx apps/connect/test/<datei>.test.ts` | zoom-text 490 → 529 · zoom-teile 84 → 90 · zoom-settings 11 → 21 · zoom-kern 307 → 391 · sdk-laden neu 64 (Linux: 61 ok, 3 übersprungen) · zoom-laufzeit 86 unverändert |
| Typen | `npm run typecheck -w @jm/connect` | grün |
| Bau | `npm run build -w @jm/connect` | grün (nur Aufgabe 9) |

Test-Konvention Connect: `ck(name, cond)` zählt `pass`/`fail` und gibt `  ok  <name>` bzw. `FAIL  <name>` aus; `ueberspringe(name)` zählt `skip`. Schluss: `<pass> ok, <fail> fehlgeschlagen[, <skip> übersprungen].` und `process.exit(fail === 0 ? 0 : 1)`. Proxy: `check(name, cond)`, Schluss `<n> passed, <m> failed`.

## Dateistruktur

**Proxy** (`services/release-proxy/`)
- `worker.js` (geändert, Aufgabe 1): Kopfkommentar, `LIMITS.zoomsdk`, Route vor dem PROXY_KEY-Gate, `handleZoomSdk`, `zoomSdkSchluesselPasst`.
- `test/worker.test.mjs` (geändert, Aufgabe 1): Fälle 20 (Route) und 21 (Regression `/tools/…`).
- `wrangler.toml`, `README.md` (geändert, Aufgabe 1): Variable `ZOOM_SDK_REPO`, Secret `ZOOM_SDK_KEY`, Route, Token-Zugriff.

**Connect, rein** (`apps/connect/src/main/zoom/`, `apps/connect/src/shared/`)
- `klartext.ts` (geändert, Aufgabe 2): KT S11–S18.
- `shared/zoom-text.ts` (geändert, Aufgaben 2 und 8): `TEXT_S11`, `TEXT_S17`; `sdkLadenZeile`, `sdkSchluesselZeile`, `sdkBalken`, `einrichtungsTextArt`, `kartenZeile` Z1b, `zoomKnoepfe` (`sdkLaden`, `sdkLadenAbbrechen`, `sdkSchluesselEntfernbar`).
- `sdk-schluessel-eingabe.ts` (neu, Aufgabe 3): `pruefeSdkSchluesselEingabe`.
- `sdk-paket.ts` (neu, Aufgabe 5): `SDK_PAKET`.
- `sdk-laden.ts` (neu, Aufgabe 5): `holeLink`, `lade`, `entpacke`, `ladeFehlerText`, `fehlerCode`, `SDK_LADEN_DIENSTE`, `LADE_ORDNER`, `Schreibziel`.
- `laufzeit.ts` (geändert, Aufgabe 5): `freierPlatz` exportiert.
- `kern.ts` (geändert, Aufgaben 4, 6, 7): SDK-Schlüssel, `envRemove` der Bridge, `pruefeUndRichteEin`, `sdkLaden`, `sdkLadenAbbrechen`, Sperre, `laeuft`, `beenden`, Abbild.
- `shared/types.ts` (geändert, Aufgaben 4 und 7): `einrichtung.sdkSchluessel`, `einrichtung.sdk.laden`, `JmConnectApi`.

**Connect, Hülle**
- `src/main/settings.ts` (geändert, Aufgabe 3): `zoomSdkSchluesselLesen`, `zoomSdkSchluesselSpeichern`, `zoomSdkSchluesselLoeschen`.
- `src/shared/ipc.ts`, `src/preload/index.ts`, `src/main/zoom.ts` (geändert, Aufgaben 4 und 7): vier neue Kanäle.
- `src/renderer/src/zoom/ZoomCard.tsx` (geändert, Aufgabe 9): Zeile „SDK-Schlüssel“, `SchluesselEingabe`, Knopf „Zoom-SDK laden“, Fortschritt, „Abbrechen“; `prozent` entfällt (jetzt `sdkBalken`).
- `apps/connect/ABNAHME-0.2.2.md` (neu, Aufgabe 9).

**Tests** (`apps/connect/test/`)
- `zoom-text.test.ts` (Aufgaben 2, 4, 7, 8) · `zoom-settings.test.ts` und `zoom-teile.test.ts` (Aufgabe 3) · `zoom-kern.test.ts` (Aufgaben 4, 6, 7) · `sdk-laden.test.ts` (neu, Aufgabe 5) · `package.json` „selftest“ (Aufgabe 5).

---

### Task 1: Proxy-Route `GET /zoom-sdk/:fassung`

**Files:**
- Modify: `services/release-proxy/worker.js` (Kopfkommentar :8-17, `LIMITS` :37-40, Route nach `handleConnect` :126-127, neue Funktionen nach `resolveSignedUrl` :381-395)
- Modify: `services/release-proxy/test/worker.test.mjs` (Ende von `run()`, nach Fall 17–19)
- Modify: `services/release-proxy/wrangler.toml` (`[vars]`, Secret-Kommentar am Ende)
- Modify: `services/release-proxy/README.md` („Was du brauchst“, „API“, neuer Abschnitt vor „Lokaler Test“)

**Interfaces:**
- Consumes: `rateLimit(env, bucket, ip, max, windowSec)` (worker.js:80), `tooMany(retryAfter)` (:96), `clientIp(request)` (:69), `json(obj, status)` (:408), `resolveSignedUrl(repo, assetId, env)` (:381, unverändert), `USER_AGENT` (:31).
- Produces (HTTP-Vertrag, den Aufgabe 5 aufruft): `GET <proxy>/zoom-sdk/<fassung>` mit Header `X-Zoom-Sdk-Key`. Antworten: `200 { fassung: string, url: string, size: number }` mit `cache-control: no-store` · `401 { error: 'unauthorized' }` · `404 { error: 'not_found' }` · `429 { error: 'zu viele Anfragen' }` mit `Retry-After` (Sekunden) · `502 { error: 'upstream' }`.

- [ ] **Step 1: Die Tests schreiben**

Datei `services/release-proxy/test/worker.test.mjs` — ersetze (genau einmal vorhanden):

```js
    check('Jurisdiction verlangt, aber nicht unterstützt → 503 statt stiller Rückfall', r.status === 503);
  }
}
```

durch:

```js
    check('Jurisdiction verlangt, aber nicht unterstützt → 503 statt stiller Rückfall', r.status === 503);
  }

  // ── Zoom-SDK nachladen (JM Connect 0.2.2): GET /zoom-sdk/:fassung ──

  // 20) Eigener Schlüssel, Antwort, Fehlerfälle, Drosselung, kein Proxy-Key, nichts Geheimes in der Konsole.
  {
    const FASSUNG = '7.1.5.43953';
    const ZIP = `zoom-sdk-win-x64-${FASSUNG}.zip`;
    const zEnv = { ...baseEnv, ZOOM_SDK_KEY: 'sdk-geheim-test', ZOOM_SDK_REPO: 'owner/jm-zoom-sdk' };
    const zReq = (fassung, schluessel, opts = {}) =>
      req(`/zoom-sdk/${fassung}`, {
        key: null,
        ...opts,
        headers: schluessel === null ? {} : { 'X-Zoom-Sdk-Key': schluessel },
      });
    const aufrufe = [];
    let release = { assets: [{ id: 77, name: ZIP, size: 150120193 }] };
    let tagStatus = 200;
    let assetOhneLink = false;
    stub = async (u) => {
      const url = String(u);
      aufrufe.push(url);
      if (url.includes('/releases/assets/')) {
        if (assetOhneLink) return new Response('{}', { status: 200 });
        const id = url.split('/').pop();
        return new Response(null, { status: 302, headers: { Location: `https://signed.test/zoom-${id}?sig=geheim-link` } });
      }
      if (url.includes('/releases/tags/')) {
        if (tagStatus !== 200) return new Response('GITHUB-FEHLTEXT-LEAK', { status: tagStatus });
        return new Response(JSON.stringify(release), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    };
    // Konsole mitschneiden: weder Schlüssel noch signierter Link dürfen dort landen (Spec 3.2).
    const mitschnitt = [];
    const merke = (...a) => mitschnitt.push(a.map(String).join(' '));
    const infoVorher = console.info;
    console.warn = merke;
    console.error = merke;
    console.info = merke;

    let r = await worker.fetch(zReq(FASSUNG, null), zEnv);
    check('zoom-sdk ohne Header → 401 unauthorized', r.status === 401 && (await r.json()).error === 'unauthorized');
    r = await worker.fetch(zReq(FASSUNG, 'falsch'), zEnv);
    check('zoom-sdk falscher Schlüssel → 401', r.status === 401);
    r = await worker.fetch(zReq(FASSUNG, 'sdk-geheim-test'), { ...zEnv, ZOOM_SDK_KEY: undefined });
    check('zoom-sdk ohne Secret ZOOM_SDK_KEY → 401, auch mit Header', r.status === 401);
    r = await worker.fetch(zReq(FASSUNG, ''), { ...zEnv, ZOOM_SDK_KEY: '' });
    check('zoom-sdk leeres Secret und leerer Header → 401', r.status === 401);
    check('… ohne gültigen Schlüssel fragt der Proxy GitHub nicht', aufrufe.length === 0);

    r = await worker.fetch(zReq(FASSUNG, 'sdk-geheim-test'), zEnv);
    const out = await r.json();
    check('zoom-sdk richtiger Schlüssel → 200 { fassung, url, size }',
      r.status === 200 && out.fassung === FASSUNG && out.url === 'https://signed.test/zoom-77?sig=geheim-link'
        && out.size === 150120193 && JSON.stringify(Object.keys(out).sort()) === '["fassung","size","url"]');
    check('… Antwort mit Cache-Control no-store', r.headers.get('cache-control') === 'no-store');
    check('… Release über ZOOM_SDK_REPO und Tag zoom-sdk-<fassung>',
      aufrufe.includes(`https://api.github.com/repos/owner/jm-zoom-sdk/releases/tags/zoom-sdk-${FASSUNG}`));
    check('… signierter Link aus demselben Repo', aufrufe.includes('https://api.github.com/repos/owner/jm-zoom-sdk/releases/assets/77'));
    check('… nie das Monorepo REPO', !aufrufe.some((u) => u.includes('/repos/owner/repo/')));

    r = await worker.fetch(zReq(FASSUNG, 'sdk-geheim-test', { key: 'falsch' }), zEnv);
    check('zoom-sdk verlangt keinen Proxy-Schlüssel (ein falscher X-Proxy-Key stört nicht)', r.status === 200);
    r = await worker.fetch(zReq(FASSUNG, null, { key: 'k' }), zEnv);
    check('… und der richtige Proxy-Schlüssel ersetzt den SDK-Schlüssel nicht', r.status === 401);

    aufrufe.length = 0;
    for (const f of ['7.1.5', 'abc', '7.1.5.43953x', '7.1.5.43953.1', '..%2F..', '']) {
      r = await worker.fetch(zReq(f, 'sdk-geheim-test'), zEnv);
      check(`zoom-sdk ungültige Fassung „${f}“ → 404`, r.status === 404);
    }
    check('… ohne GitHub-Abfrage', aufrufe.length === 0);

    tagStatus = 404;
    r = await worker.fetch(zReq(FASSUNG, 'sdk-geheim-test'), zEnv);
    check('zoom-sdk Release fehlt → 404 not_found', r.status === 404 && (await r.json()).error === 'not_found');
    tagStatus = 200;
    release = { assets: [{ id: 5, name: 'etwas-anderes.zip', size: 1 }] };
    r = await worker.fetch(zReq(FASSUNG, 'sdk-geheim-test'), zEnv);
    check('zoom-sdk Asset fehlt → 404 not_found', r.status === 404 && (await r.json()).error === 'not_found');
    release = { assets: [{ id: 77, name: ZIP, size: 150120193 }] };
    tagStatus = 500;
    r = await worker.fetch(zReq(FASSUNG, 'sdk-geheim-test'), zEnv);
    const t500 = await r.text();
    check('zoom-sdk GitHub 500 → 502 upstream ohne GitHub-Fehlertext',
      r.status === 502 && JSON.parse(t500).error === 'upstream' && !t500.includes('LEAK'));
    tagStatus = 200;
    assetOhneLink = true;
    r = await worker.fetch(zReq(FASSUNG, 'sdk-geheim-test'), zEnv);
    check('zoom-sdk signierter Link nicht auflösbar → 502 upstream', r.status === 502 && (await r.json()).error === 'upstream');
    assetOhneLink = false;

    // Drosselung VOR dem Schlüsselvergleich: 20 Anfragen je IP und 10 Minuten, die 21. → 429, auch mit gültigem Schlüssel.
    const rlEnv = { ...zEnv, RATELIMIT: makeKV() };
    for (let i = 0; i < 20; i++) await worker.fetch(zReq(FASSUNG, 'falsch', { ip: '3.3.3.3' }), rlEnv);
    aufrufe.length = 0;
    r = await worker.fetch(zReq(FASSUNG, 'sdk-geheim-test', { ip: '3.3.3.3' }), rlEnv);
    check('zoom-sdk Drosselung: 21. Anfrage je IP → 429, auch mit gültigem Schlüssel', r.status === 429);
    check('… mit Retry-After', Number(r.headers.get('Retry-After')) > 0);
    check('… ohne GitHub-Abfrage', aufrufe.length === 0);
    r = await worker.fetch(zReq(FASSUNG, 'sdk-geheim-test', { ip: '4.4.4.4' }), rlEnv);
    check('… andere IP unabhängig', r.status === 200);

    const alles = mitschnitt.join('\n');
    check('zoom-sdk: weder Schlüssel noch signierter Link in der Konsole',
      !alles.includes('sdk-geheim-test') && !alles.includes('signed.test') && !alles.includes('geheim-link'));
    console.warn = () => {};
    console.error = () => {};
    console.info = infoVorher;
    stub = async () => new Response('{}', { status: 200 });
  }

  // 21) Regression: /tools/… löst den signierten Link weiter im Monorepo REPO auf, auch mit ZOOM_SDK_REPO.
  {
    const aufrufe = [];
    stub = async (u) => {
      const url = String(u);
      aufrufe.push(url);
      if (url.includes('/releases/assets/')) return new Response(null, { status: 302, headers: { Location: 'https://signed.test/9' } });
      if (url.includes('/releases?')) {
        return new Response(JSON.stringify([{ tag_name: 'copy-v1.0.0', draft: false, assets: [{ id: 9, name: 'JM.Copy.Setup.1.0.0.exe', size: 5 }] }]), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    };
    const r = await worker.fetch(req('/tools/jm-copy/latest?platform=win'), { ...baseEnv, ZOOM_SDK_REPO: 'owner/jm-zoom-sdk' });
    check('tools: signierter Link weiter aus REPO, nicht aus ZOOM_SDK_REPO',
      r.status === 200 && aufrufe.includes('https://api.github.com/repos/owner/repo/releases/assets/9')
        && !aufrufe.some((u) => u.includes('jm-zoom-sdk')));
    stub = async () => new Response('{}', { status: 200 });
  }
}
```

- [ ] **Step 2: Rot sehen**

Run: `node services/release-proxy/test/worker.test.mjs`
Expected: `43 passed, 19 failed` (unter anderem `FAIL  zoom-sdk richtiger Schlüssel → 200 { fassung, url, size }` und `FAIL  zoom-sdk Drosselung: 21. Anfrage je IP → 429, auch mit gültigem Schlüssel`). Die 401-Fälle sind schon grün, weil das PROXY_KEY-Gate heute jede unbekannte Route ablehnt.

- [ ] **Step 3: Kopfkommentar und Drossel-Grenze**

Datei `services/release-proxy/worker.js` — ersetze:

```js
//   → 200 { version, assets: { <platform>: { url, size, fileName } } }
//
// Secrets (verschlüsselt, via `wrangler secret put` oder Dashboard):
//   GITHUB_TOKEN  fine-grained PAT, read-only Contents auf REPO
//   PROXY_KEY     gemeinsamer Key, den die Clients mitschicken
// Variable (Klartext, in wrangler.toml [vars]):
//   REPO          z. B. "AlexmachtCode/alexzvn"
```

durch:

```js
//   → 200 { version, assets: { <platform>: { url, size, fileName } } }
//
//   GET /zoom-sdk/:fassung              (JM Connect 0.2.2, KEIN Proxy-Key)
//   Header: X-Zoom-Sdk-Key: <ZOOM_SDK_KEY>
//   → 200 { fassung, url, size }        (url = kurzlebiger, signierter Storage-Link des ZIP)
//
// Secrets (verschlüsselt, via `wrangler secret put` oder Dashboard):
//   GITHUB_TOKEN  fine-grained PAT, read-only Contents auf REPO und auf ZOOM_SDK_REPO
//   PROXY_KEY     gemeinsamer Key, den die Clients mitschicken
//   ZOOM_SDK_KEY  eigener Schlüssel nur für /zoom-sdk/:fassung; steht in keinem Repo, CI-Secret
//                 oder Build (der PROXY_KEY steckt in öffentlichen Launcher-Installern)
// Variable (Klartext, in wrangler.toml [vars]):
//   REPO          z. B. "AlexmachtCode/alexzvn"
//   ZOOM_SDK_REPO privates Repo mit dem Zoom-SDK-Paket, Vorgabe "AlexmachtCode/jm-zoom-sdk"
```

Dann ersetze:

```js
  draft: { maxBytes: 32 * 1024, rlMax: 5, rlWindowSec: 3600 },
};
```

durch:

```js
  draft: { maxBytes: 32 * 1024, rlMax: 5, rlWindowSec: 3600 },
  // GET /zoom-sdk/:fassung: gedrosselt VOR dem Schlüsselvergleich, auch für gültige Schlüssel.
  zoomsdk: { rlMax: 20, rlWindowSec: 600 },
};
```

- [ ] **Step 4: Route vor dem PROXY_KEY-Gate**

Datei `services/release-proxy/worker.js` — ersetze:

```js
    const conn = await handleConnect(request, env, url);
    if (conn) return conn;
```

durch:

```js
    const conn = await handleConnect(request, env, url);
    if (conn) return conn;

    // Zoom-SDK nachladen (JM Connect 0.2.2). VOR dem PROXY_KEY-Gate: Die Route prüft ihren eigenen
    // Schlüssel ZOOM_SDK_KEY. Der Proxy-Key scheidet dafür aus, er steckt in öffentlichen Installern.
    const zoomSdk = url.pathname.match(/^\/zoom-sdk\/([^/]*)\/?$/);
    if (zoomSdk) return handleZoomSdk(request, env, zoomSdk[1]);
```

- [ ] **Step 5: `handleZoomSdk` und der zeitkonstante Vergleich**

Datei `services/release-proxy/worker.js` — ersetze (das Ende von `resolveSignedUrl`):

```js
  // Falls die Laufzeit doch gefolgt ist: finale URL nehmen.
  if (res.ok && res.url) return res.url;
  return null;
}
```

durch:

```js
  // Falls die Laufzeit doch gefolgt ist: finale URL nehmen.
  if (res.ok && res.url) return res.url;
  return null;
}

// --- Zoom-SDK nachladen (JM Connect 0.2.2) -----------------------------------

const ZOOM_SDK_REPO_VORGABE = 'AlexmachtCode/jm-zoom-sdk';
const ZOOM_SDK_FASSUNG = /^\d+\.\d+\.\d+\.\d+$/;

/**
 * GET /zoom-sdk/:fassung → 200 { fassung, url, size }: der kurzlebige, signierte Storage-Link des ZIP
 * `zoom-sdk-win-x64-<fassung>.zip` aus dem Release `zoom-sdk-<fassung>` im privaten Repo ZOOM_SDK_REPO.
 * Reihenfolge: Drosselung (auch für gültige Schlüssel), Fassung, Schlüssel, GitHub. Nie in Log oder
 * Antwort: Schlüssel, signierter Link, GitHub-Fehlertext. Eine Prüfsumme liefert der Proxy bewusst
 * nicht: Die steht nur im Connect-Code, ein manipulierter Proxy kann ein falsches Paket nicht tarnen.
 */
async function handleZoomSdk(request, env, fassung) {
  const rl = await rateLimit(env, 'zoomsdk', clientIp(request), LIMITS.zoomsdk.rlMax, LIMITS.zoomsdk.rlWindowSec);
  if (!rl.ok) return tooMany(rl.retryAfter);
  if (request.method !== 'GET' || !ZOOM_SDK_FASSUNG.test(fassung)) return json({ error: 'not_found' }, 404);
  if (!(await zoomSdkSchluesselPasst(request.headers.get('X-Zoom-Sdk-Key'), env.ZOOM_SDK_KEY))) {
    return json({ error: 'unauthorized' }, 401);
  }
  const repo = env.ZOOM_SDK_REPO || ZOOM_SDK_REPO_VORGABE;
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/releases/tags/zoom-sdk-${fassung}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': USER_AGENT,
      },
    });
    if (res.status === 404) return json({ error: 'not_found' }, 404);
    if (!res.ok) {
      console.warn(`zoom-sdk: GitHub antwortet ${res.status}`);
      return json({ error: 'upstream' }, 502);
    }
    const release = await res.json();
    const name = `zoom-sdk-win-x64-${fassung}.zip`;
    const assets = Array.isArray(release && release.assets) ? release.assets : [];
    const asset = assets.find((a) => a && a.name === name);
    if (!asset) return json({ error: 'not_found' }, 404);
    const signiert = await resolveSignedUrl(repo, asset.id, env);
    if (!signiert) return json({ error: 'upstream' }, 502);
    return new Response(JSON.stringify({ fassung, url: signiert, size: asset.size }), {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
  } catch {
    console.warn('zoom-sdk: GitHub nicht erreichbar oder Antwort unlesbar');
    return json({ error: 'upstream' }, 502);
  }
}

/**
 * Zeitkonstanter Vergleich (Spec 3.1): beide Werte per SHA-256 auf 32 Byte bringen, dann eine
 * XOR-Schleife ohne frühen Ausstieg. `crypto.subtle.timingSafeEqual` gibt es nur in der Workers-
 * Laufzeit, nicht in Node (worker.test.mjs); die Schleife läuft in beiden. Ohne Secret: nie gleich.
 */
async function zoomSdkSchluesselPasst(geliefert, secret) {
  if (!secret || typeof geliefert !== 'string') return false;
  const kodierer = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', kodierer.encode(geliefert)),
    crypto.subtle.digest('SHA-256', kodierer.encode(secret)),
  ]);
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}
```

- [ ] **Step 6: Grün sehen**

Run: `node services/release-proxy/test/worker.test.mjs`
Expected: `62 passed, 0 failed`.

- [ ] **Step 7: `wrangler.toml` ergänzen**

Datei `services/release-proxy/wrangler.toml` — ersetze:

```toml
CONNECT_JURISDICTION = "eu"
```

durch:

```toml
CONNECT_JURISDICTION = "eu"
# Privates Repo mit dem Zoom-SDK-Paket für GET /zoom-sdk/:fassung (JM Connect 0.2.2). Das GITHUB_TOKEN
# braucht darauf Contents: read, sonst antwortet GitHub 404 und die Route meldet not_found.
ZOOM_SDK_REPO = "AlexmachtCode/jm-zoom-sdk"
```

Dann ersetze:

```toml
#   npx wrangler secret put ANTHROPIC_API_KEY (nur für /cookbook/draft mode "ai")
```

durch:

```toml
#   npx wrangler secret put ANTHROPIC_API_KEY (nur für /cookbook/draft mode "ai")
#   npx wrangler secret put ZOOM_SDK_KEY      (nur für /zoom-sdk/:fassung; der Owner tippt ihn ein,
#                                              er steht in keinem Repo, CI-Secret oder Build;
#                                              zufällig, mindestens 32 Zeichen; nur druckbare ASCII-
#                                              Zeichen ohne Leerzeichen, anderes lehnt Connect ab)
```

- [ ] **Step 8: README ergänzen**

Datei `services/release-proxy/README.md` — ersetze:

```markdown
- GitHub **fine-grained PAT**: Repository nur `alexzvn`, Permission **Contents: Read-only**.
```

durch:

```markdown
- GitHub **fine-grained PAT**: Repositories `alexzvn` und `jm-zoom-sdk` (nur für `/zoom-sdk`, JM Connect 0.2.2), Permission **Contents: Read-only**.
```

Dann ersetze (Ende des API-Blocks; die drei Backticks am Schluss sind die vorhandene Schlusszeile dieses Codeblocks im README):

````markdown
   braucht GITHUB_TOKEN mit Contents:write + Pull requests:write; mode "ai" zusätzlich ANTHROPIC_API_KEY
```
````

durch:

````markdown
   braucht GITHUB_TOKEN mit Contents:write + Pull requests:write; mode "ai" zusätzlich ANTHROPIC_API_KEY

GET /zoom-sdk/:fassung
Header: X-Zoom-Sdk-Key: <ZOOM_SDK_KEY>       (KEIN Proxy-Key)
→ 200 { fassung, url, size }   (url = kurzlebiger, signierter Storage-Link des ZIP)
→ 401 unauthorized · 404 not_found · 429 mit Retry-After · 502 upstream
```
````

Dann ersetze:

```markdown
Lokaler Test (ohne Deploy): `node services/release-proxy/test/worker.test.mjs`.
```

durch:

```markdown
## Zoom-SDK nachladen (JM Connect 0.2.2)
`GET /zoom-sdk/:fassung` liefert JM Connect den kurzlebigen, signierten Link auf das Paket
`zoom-sdk-win-x64-<fassung>.zip` aus dem Release `zoom-sdk-<fassung>` im **privaten** Repo `ZOOM_SDK_REPO`
(Vorgabe `AlexmachtCode/jm-zoom-sdk`). Der Download läuft direkt von GitHubs Storage, der Worker streamt nichts.

- **Eigener Schlüssel:** Header `X-Zoom-Sdk-Key`, verglichen mit dem Secret `ZOOM_SDK_KEY` (zeitkonstant über
  SHA-256). Der `PROXY_KEY` gilt hier nicht, weil der Launcher ihn in öffentliche Installer einbackt. Fehlt das
  Secret, antwortet die Route immer 401.
- **Drosselung:** eigener Bucket `zoomsdk`, 20 Anfragen je 10 Minuten je IP, VOR dem Schlüsselvergleich, auch für
  gültige Schlüssel → `429` mit `Retry-After`. Braucht die KV-Bindung `RATELIMIT` (siehe oben).
- **Antworten:** 200 `{ fassung, url, size }` (mit `Cache-Control: no-store`) · 401 `unauthorized` ·
  404 `not_found` (ungültige Fassung, Release oder Asset fehlt) · 502 `upstream` (andere GitHub-Fehler, ohne GitHub-Text).
- **Nie:** Schlüssel oder signierter Link im Log. Eine Prüfsumme liefert der Proxy nicht; die steht nur im Connect-Code.
- **Token:** `GITHUB_TOKEN` braucht zusätzlich `Contents: Read-only` auf `ZOOM_SDK_REPO`. Ohne diesen Zugriff
  antwortet GitHub 404, und die Route meldet `not_found`.
- **Einrichtung (einmalig, nur durch den Owner):** Der Owner erweitert den Token-Zugriff in GitHub und setzt das Secret
  mit `npx wrangler secret put ZOOM_SDK_KEY` (ein selbst gewählter Schlüssel, der in keinem Chat, Log oder Repo
  erscheint). Ein Deploy (`npx wrangler deploy`) geschieht nur mit seinem ausdrücklichen Okay.
- **Wahl des Schlüssels:** zufällig erzeugt, mindestens 32 Zeichen, nur druckbare ASCII-Zeichen ohne Leerzeichen
  (JM Connect lehnt alles andere mit S18 ab). Gegen Raten schützt sonst nur die Drosselung von 20 Anfragen je
  10 Minuten und IP.

Lokaler Test (ohne Deploy): `node services/release-proxy/test/worker.test.mjs`.
```

- [ ] **Step 9: Prüfen**

Run: `node services/release-proxy/test/worker.test.mjs`
Expected: `62 passed, 0 failed` (README und wrangler.toml ändern daran nichts).

- [ ] **Step 10: Commit**

```bash
git add services/release-proxy/worker.js services/release-proxy/test/worker.test.mjs services/release-proxy/wrangler.toml services/release-proxy/README.md
git status --short
git commit -m "feat(release-proxy): Route /zoom-sdk/:fassung mit eigenem Schlüssel und Drosselung" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Expected bei `git status --short` vor dem Commit: genau diese vier Pfade als gestaged (`M `). Zusätzlich darf nur `?? docs/superpowers/plans/2026-10-06-connect-zoom-sdk-laden.md` erscheinen (G13); der Plan wird nicht mitgestaged.

**Gegenprobe (gemessen):** Wird in `handleZoomSdk` der Schlüssel VOR der Drosselung geprüft, zählen die 20 falschen Anfragen nicht mit. Der Lauf endet dann mit `59 passed, 3 failed`; rot sind die drei Drossel-Prüfungen („21. Anfrage je IP → 429 …“, „… mit Retry-After“, „… ohne GitHub-Abfrage“).

---

### Task 2: Klartexte S11–S18

**Files:**
- Modify: `apps/connect/src/shared/zoom-text.ts` (nach `TEXT_A6` :20-21)
- Modify: `apps/connect/src/main/zoom/klartext.ts` (Import :8, `KT` nach `A7` :50)
- Test: `apps/connect/test/zoom-text.test.ts` (Import :8-11, `KT_SOLL` nach Zeile `A6`, Zählprüfung :494)

**Interfaces:**
- Consumes: nichts Neues.
- Produces: `TEXT_S11: string` und `TEXT_S17: string` aus `@shared/zoom-text` (die Karte und `zoom-text.ts` brauchen sie ohne `klartext.ts`). In `KT`: `S11: string`, `S12: string`, `S13(sekunden: number): string` (Einzahl bei genau 1 Minute, A6), `S14(grund: string): string`, `S15: string`, `S16(grund: string): string`, `S16b: string`, `S16c(grund: string): string`, `S17: string`, `S18: string`. `KT` hat danach 73 Einträge.

- [ ] **Step 1: Die Tests schreiben**

Datei `apps/connect/test/zoom-text.test.ts` — ersetze:

```ts
  gaesteZeile, kartenZeile, MANGEL_GRUND, Q9_ANFANG, sdkKnopf, sdkZeile, stateKvAus, TEXT_A4, TEXT_A4_SCHREIBFEHLER, TEXT_A6, trayTooltip,
  trayVerlassenAktiv, zoomKnoepfe, zoomZ, zoomZeile, zugangZeile, type ZoomStatusWert, type ZoomZ,
```

durch:

```ts
  gaesteZeile, kartenZeile, MANGEL_GRUND, Q9_ANFANG, sdkKnopf, sdkZeile, stateKvAus, TEXT_A4, TEXT_A4_SCHREIBFEHLER, TEXT_A6, TEXT_S11,
  TEXT_S17, trayTooltip, trayVerlassenAktiv, zoomKnoepfe, zoomZ, zoomZeile, zugangZeile, type ZoomStatusWert, type ZoomZ,
```

Dann ersetze:

```ts
    ['A6', KT.A6, 'Kommt aus Umgebungsvariablen (ZOOM_SDK_…) und hat Vorrang.'],
```

durch:

```ts
    ['A6', KT.A6, 'Kommt aus Umgebungsvariablen (ZOOM_SDK_…) und hat Vorrang.'],
    // Zoom-SDK nachladen (Spec 2026-10-06, Abschnitt 5)
    ['S11', KT.S11, 'Für „Zoom-SDK laden“ fehlt der SDK-Schlüssel. Bitte unter „SDK-Schlüssel“ eintragen.'],
    ['S12', KT.S12, 'Der Proxy hat den SDK-Schlüssel abgelehnt. Bitte den Schlüssel prüfen.'],
    ['S13', KT.S13(125), 'Zu viele Versuche. Bitte in 3 Minuten erneut versuchen.'],
    ['S14', KT.S14('ENOTFOUND'), 'Der Proxy ist nicht erreichbar (ENOTFOUND). Bitte die Netzverbindung prüfen oder den SDK-Ordner von Hand wählen.'],
    ['S15', KT.S15, 'Auf dem Proxy liegt kein passendes Zoom-SDK 7.1.5.43953. Bitte den SDK-Ordner von Hand wählen.'],
    ['S16', KT.S16('UND_ERR_SOCKET'), 'Das Zoom-SDK ließ sich nicht laden (UND_ERR_SOCKET). Die bisherige Einrichtung bleibt unverändert.'],
    ['S16b', KT.S16b, 'Das geladene Zoom-SDK hat nicht die erwartete Prüfsumme und wurde verworfen. Die bisherige Einrichtung bleibt unverändert.'],
    ['S16c', KT.S16c('Exit 1'), 'Das geladene Zoom-SDK ließ sich nicht entpacken (Exit 1). Die bisherige Einrichtung bleibt unverändert.'],
    ['S17', KT.S17, 'Laden abgebrochen. Die bisherige Einrichtung bleibt unverändert.'],
    ['S18', KT.S18, 'Bitte den SDK-Schlüssel eintragen, ohne Leerzeichen.'],
```

Dann ersetze:

```ts
  ck('KT hat genau diese 63 Einträge (F1–F8, R2/R4/R5/R7 erst in 4b)', Object.keys(KT).length === 63 && KT_SOLL.length === 63);
}
```

durch:

```ts
  ck('KT hat genau diese 73 Einträge (F1–F8, R2/R4/R5/R7 erst in 4b)', Object.keys(KT).length === 73 && KT_SOLL.length === 73);
  ck('S13: ⌈s/60⌉ Minuten, bei 1 die Einzahl (60 s → 1 Minute, 61 s → 2 Minuten, 600 s → 10), nie 0',
    KT.S13(60).includes(' in 1 Minute erneut') && KT.S13(61).includes(' in 2 Minuten erneut')
      && KT.S13(600).includes(' in 10 Minuten erneut') && KT.S13(0).includes(' in 1 Minute erneut'));
  ck('S11 und S17 kommen aus @shared/zoom-text (die Karte zeigt sie ohne klartext.ts)', KT.S11 === TEXT_S11 && KT.S17 === TEXT_S17);
}
```

- [ ] **Step 2: Rot sehen**

Run: `npx tsx apps/connect/test/zoom-text.test.ts`
Expected: Abbruch mit `SyntaxError: The requested module '../src/shared/zoom-text' does not provide an export named 'TEXT_S11'`.

- [ ] **Step 3: Geteilte Texte S11 und S17**

Datei `apps/connect/src/shared/zoom-text.ts` — ersetze:

```ts
/** Text A6 (Spec 8.1). */
export const TEXT_A6 = 'Kommt aus Umgebungsvariablen (ZOOM_SDK_…) und hat Vorrang.';
```

durch:

```ts
/** Text A6 (Spec 8.1). */
export const TEXT_A6 = 'Kommt aus Umgebungsvariablen (ZOOM_SDK_…) und hat Vorrang.';

/** Text S11 (Spec SDK nachladen, Abschnitt 5): Tooltip des gesperrten Knopfs „Zoom-SDK laden“; klartext.ts übernimmt ihn. */
export const TEXT_S11 = 'Für „Zoom-SDK laden“ fehlt der SDK-Schlüssel. Bitte unter „SDK-Schlüssel“ eintragen.';
/** Text S17: Ergebnis eines Abbruchs. Die Karte zeigt ihn als Hinweis, nicht rot (Spec SDK nachladen 4.3). */
export const TEXT_S17 = 'Laden abgebrochen. Die bisherige Einrichtung bleibt unverändert.';
```

- [ ] **Step 4: KT S11–S18**

Datei `apps/connect/src/main/zoom/klartext.ts` — ersetze:

```ts
import { Q9_ANFANG, TEXT_A4, TEXT_A6 } from '../../shared/zoom-text';
```

durch:

```ts
import { Q9_ANFANG, TEXT_A4, TEXT_A6, TEXT_S11, TEXT_S17 } from '../../shared/zoom-text';
```

Dann ersetze:

```ts
  A7: 'Bitte Client-ID und Client-Secret eintragen, ohne Leerzeichen.',
```

durch:

```ts
  A7: 'Bitte Client-ID und Client-Secret eintragen, ohne Leerzeichen.',

  // Zoom-SDK nachladen (Spec 2026-10-06, Abschnitt 5). Platzmangel nutzt S5; {grund} ist nur ein Code, nie ein Link.
  S11: TEXT_S11,
  S12: 'Der Proxy hat den SDK-Schlüssel abgelehnt. Bitte den Schlüssel prüfen.',
  S13: (sekunden: number): string => {
    const minuten = Math.max(1, Math.ceil(sekunden / 60));
    return `Zu viele Versuche. Bitte in ${minuten} ${minuten === 1 ? 'Minute' : 'Minuten'} erneut versuchen.`;
  },
  S14: (grund: string): string =>
    `Der Proxy ist nicht erreichbar (${grund}). Bitte die Netzverbindung prüfen oder den SDK-Ordner von Hand wählen.`,
  S15: 'Auf dem Proxy liegt kein passendes Zoom-SDK 7.1.5.43953. Bitte den SDK-Ordner von Hand wählen.',
  S16: (grund: string): string =>
    `Das Zoom-SDK ließ sich nicht laden (${grund}). Die bisherige Einrichtung bleibt unverändert.`,
  S16b: 'Das geladene Zoom-SDK hat nicht die erwartete Prüfsumme und wurde verworfen. Die bisherige Einrichtung bleibt unverändert.',
  S16c: (grund: string): string =>
    `Das geladene Zoom-SDK ließ sich nicht entpacken (${grund}). Die bisherige Einrichtung bleibt unverändert.`,
  S17: TEXT_S17,
  S18: 'Bitte den SDK-Schlüssel eintragen, ohne Leerzeichen.',
```

- [ ] **Step 5: Grün sehen**

Run: `npx tsx apps/connect/test/zoom-text.test.ts`
Expected: letzte Zeile `502 ok, 0 fehlgeschlagen.`

- [ ] **Step 6: Alles prüfen**

Run: `npm run selftest -w @jm/connect` — Expected: Exit 0, letzte Zeile `Alle after-pack-Tests bestanden.`
Run: `npm run typecheck -w @jm/connect` — Expected: Exit 0, keine Ausgabe von `tsc`.

- [ ] **Step 7: Commit**

```bash
git add apps/connect/src/shared/zoom-text.ts apps/connect/src/main/zoom/klartext.ts apps/connect/test/zoom-text.test.ts
git status --short
git commit -m "feat(connect): Klartexte S11-S18 für Zoom-SDK laden" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Gegenprobe (gemessen):** S13 ohne Einzahl (immer „Minuten“) ergibt `501 ok, 1 fehlgeschlagen`; rot wird „S13: ⌈s/60⌉ Minuten, bei 1 die Einzahl …“.

---

### Task 3: SDK-Schlüssel speichern (settings.ts) und Nutzlast prüfen

**Files:**
- Modify: `apps/connect/src/main/settings.ts` (`Stored` :30-42, Anhang nach `setzeZoomLaufzeit` :254-258)
- Create: `apps/connect/src/main/zoom/sdk-schluessel-eingabe.ts`
- Test: `apps/connect/test/zoom-settings.test.ts` (Import :4, Block vor der Schlusszeile)
- Test: `apps/connect/test/zoom-teile.test.ts` (Import :6, Block über der ENDE-Zeile)

**Interfaces:**
- Consumes: `read()`, `write(next): boolean`, `decryptKey(enc)`, `safeStorage`, `getLog()` in `settings.ts` (vorhanden); `ProxyKeySource` aus `@shared/types`.
- Produces:
  - `zoomSdkSchluesselLesen(): { wert: string | null; herkunft: ProxyKeySource }` — Rangfolge Umgebung `JMPS_ZOOM_SDK_KEY` (getrimmt) > `zoomSdkKeyEnc` > Sitzung > `none`.
  - `zoomSdkSchluesselSpeichern(wert: string): 'stored' | 'session'` — bekommt den schon getrimmten Wert.
  - `zoomSdkSchluesselLoeschen(): void`.
  - `SDK_SCHLUESSEL_MAX = 512`, `interface SdkSchluesselEingabe { schluessel: string }`, `pruefeSdkSchluesselEingabe(p: unknown): SdkSchluesselEingabe | null`.
  Diese Funktionen nutzt Aufgabe 4 (Kern und Hülle).

- [ ] **Step 1: Die Tests schreiben**

Datei `apps/connect/test/zoom-settings.test.ts` — ersetze:

```ts
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
```

durch:

```ts
import { chmodSync, mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
```

Dann ersetze:

```ts
ck('Set: ohne Schlüsselbund → session, kein Grund', o.herkunft === 'session' && o.grund === undefined);

console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
```

durch:

```ts
ck('Set: ohne Schlüsselbund → session, kein Grund', o.herkunft === 'session' && o.grund === undefined);

// SDK-Schlüssel (Spec SDK nachladen 4.2): Umgebung > gespeichert > Sitzung, nie im Klartext auf der Platte
const datei = (): string => readFileSync(join(wurzel, 'connect-settings.json'), 'utf8');
g.__mock.verschluesselung = true;
g.__mock.userData = wurzel;
const leer = s.zoomSdkSchluesselLesen();
ck('SDK: anfangs fehlt der Schlüssel', leer.herkunft === 'none' && leer.wert === null);
ck('SDK: Speichern mit Schlüsselbund → stored', s.zoomSdkSchluesselSpeichern('sdk-geheim-test') === 'stored');
ck('SDK: verschlüsselt in der Datei, nie im Klartext', datei().includes('zoomSdkKeyEnc') && !datei().includes('sdk-geheim-test'));
const gespeichert = s.zoomSdkSchluesselLesen();
ck('SDK: Lesen → stored mit Wert', gespeichert.herkunft === 'stored' && gespeichert.wert === 'sdk-geheim-test');
process.env.JMPS_ZOOM_SDK_KEY = '  sdk-test  ';
const umgebung = s.zoomSdkSchluesselLesen();
ck('SDK: Umgebung JMPS_ZOOM_SDK_KEY hat Vorrang, getrimmt', umgebung.herkunft === 'env' && umgebung.wert === 'sdk-test');
delete process.env.JMPS_ZOOM_SDK_KEY;
// Datei lesbar, aber schreibgeschützt: der alte Wert steht noch auf der Platte, der neue kommt nicht hin.
chmodSync(join(wurzel, 'connect-settings.json'), 0o444);
ck('SDK: Schreiben scheitert → session statt stored', s.zoomSdkSchluesselSpeichern('sdk-test') === 'session');
const sitzung = s.zoomSdkSchluesselLesen();
ck('SDK: … der neue Wert gilt für die Sitzung, nicht der alte von der Platte', sitzung.herkunft === 'session' && sitzung.wert === 'sdk-test');
chmodSync(join(wurzel, 'connect-settings.json'), 0o644);
s.zoomSdkSchluesselLoeschen();
ck('SDK: Entfernen → fehlt, Feld aus der Datei', s.zoomSdkSchluesselLesen().herkunft === 'none' && !datei().includes('zoomSdkKeyEnc'));
g.__mock.verschluesselung = false;
ck('SDK: ohne Schlüsselbund → session', s.zoomSdkSchluesselSpeichern('sdk-test') === 'session' && s.zoomSdkSchluesselLesen().herkunft === 'session');
ck('SDK: … nichts davon auf der Platte', !datei().includes('zoomSdkKeyEnc') && !datei().includes('sdk-test'));

console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
```

Datei `apps/connect/test/zoom-teile.test.ts` — ersetze:

```ts
import { pruefeZugangEingabe } from '../src/main/zoom/zugang-eingabe';
```

durch:

```ts
import { pruefeZugangEingabe } from '../src/main/zoom/zugang-eingabe';
import { pruefeSdkSchluesselEingabe } from '../src/main/zoom/sdk-schluessel-eingabe';
```

Dann ersetze:

```ts
// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
```

durch:

```ts
console.log('— SDK-Schlüssel von Hand: Nutzlast-Prüfung (IPC, Spec SDK nachladen 4.2)');
{
  const g = pruefeSdkSchluesselEingabe({ schluessel: 'sdk-test' });
  ck('gültig → der Wert', g !== null && g.schluessel === 'sdk-test');
  ck('Wert wird hier nicht verändert (Leerraum bleibt für den Kern)', pruefeSdkSchluesselEingabe({ schluessel: ' a b ' })?.schluessel === ' a b ');
  ck('leerer String ist eine Eingabe (S18 gibt der Kern)', pruefeSdkSchluesselEingabe({ schluessel: '' })?.schluessel === '');
  ck('kein Objekt → null', pruefeSdkSchluesselEingabe(null) === null && pruefeSdkSchluesselEingabe('sdk-test') === null
    && pruefeSdkSchluesselEingabe(undefined) === null && pruefeSdkSchluesselEingabe(42) === null);
  ck('fehlendes Feld oder Zahl → null', pruefeSdkSchluesselEingabe({}) === null && pruefeSdkSchluesselEingabe({ schluessel: 7 }) === null);
  ck('genau 512 Zeichen → gültig, 513 → null',
    pruefeSdkSchluesselEingabe({ schluessel: 'x'.repeat(512) }) !== null && pruefeSdkSchluesselEingabe({ schluessel: 'x'.repeat(513) }) === null);
}

// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
```

- [ ] **Step 2: Rot sehen**

Run: `npx tsx apps/connect/test/zoom-settings.test.ts`
Expected: Abbruch mit `TypeError: s.zoomSdkSchluesselLesen is not a function`.
Run: `npx tsx apps/connect/test/zoom-teile.test.ts`
Expected: Abbruch mit `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…\src\main\zoom\sdk-schluessel-eingabe'`.

- [ ] **Step 3: Nutzlast-Prüfung**

Neue Datei `apps/connect/src/main/zoom/sdk-schluessel-eingabe.ts`:

```ts
// Prüfung der Nutzlast von „SDK-Schlüssel eintragen“ (IPC, Spec SDK nachladen 4.2) — rein, ohne Electron,
// damit sie testbar ist. Hier wird nur die FORM geprüft; Trimmen und Leerzeichen-Prüfung (S18) gehören dem Kern.

/** Obergrenze; alles darüber ist keine SDK-Schlüssel-Eingabe. */
export const SDK_SCHLUESSEL_MAX = 512;

export interface SdkSchluesselEingabe {
  schluessel: string;
}

/** `{ schluessel: string }` mit höchstens 512 Zeichen — sonst `null`. */
export function pruefeSdkSchluesselEingabe(p: unknown): SdkSchluesselEingabe | null {
  if (typeof p !== 'object' || p === null) return null;
  const { schluessel } = p as Record<string, unknown>;
  if (typeof schluessel !== 'string' || schluessel.length > SDK_SCHLUESSEL_MAX) return null;
  return { schluessel };
}
```

- [ ] **Step 4: Speicher in settings.ts**

Datei `apps/connect/src/main/settings.ts` — ersetze:

```ts
  /** Zoom: ganze Zahl 0 bis 1000; fehlt = 0. */
  zoomVersatzMs?: number;
}
```

durch:

```ts
  /** Zoom: ganze Zahl 0 bis 1000; fehlt = 0. */
  zoomVersatzMs?: number;
  /** Zoom: SDK-Schlüssel für „Zoom-SDK laden“, safeStorage-verschlüsselt, base64. Nie im Klartext (Spec SDK nachladen 4.2). */
  zoomSdkKeyEnc?: string;
}
```

Dann ersetze (Dateiende):

```ts
export function setzeZoomLaufzeit(v: { dir: string; fassung: string; eingerichtetAm: string }): void {
  const next = read();
  next.zoomLaufzeit = { dir: v.dir, fassung: v.fassung, eingerichtetAm: v.eingerichtetAm };
  write(next);
}
```

durch:

```ts
export function setzeZoomLaufzeit(v: { dir: string; fassung: string; eingerichtetAm: string }): void {
  const next = read();
  next.zoomLaufzeit = { dir: v.dir, fassung: v.fassung, eingerichtetAm: v.eingerichtetAm };
  write(next);
}

// ── Zoom-SDK nachladen (Spec 2026-10-06, 4.2) ────────────────────────────────────────────────
// Eigener SDK-Schlüssel für GET /zoom-sdk/:fassung. Muster wie die Zugangsdaten: Umgebung
// JMPS_ZOOM_SDK_KEY > zoomSdkKeyEnc (safeStorage) > Sitzung. Ohne Schlüsselbund oder wenn die Datei
// nicht schreibbar ist, gilt er nur für diese Sitzung, nie im Klartext auf der Platte. Der Renderer
// erfährt nur die Herkunft (der Kern trägt sie ins Abbild), nie den Wert.

/** Nur belegt, wenn nichts auf der Platte gelandet ist. */
let zoomSdkSitzung: string | null = null;
/** zoomSdkKeyEnc, EINMAL entschlüsselt. `undefined` = noch nicht gelesen, `null` = nichts (oder nicht entschlüsselbar). */
let zoomSdkGespeichert: string | null | undefined;
let zoomSdkSitzungGewarnt = false;

function zoomSdkGespeichertLesen(): string | null {
  if (zoomSdkGespeichert === undefined) zoomSdkGespeichert = decryptKey(read().zoomSdkKeyEnc);
  return zoomSdkGespeichert;
}

export function zoomSdkSchluesselLesen(): { wert: string | null; herkunft: ProxyKeySource } {
  const env = (process.env.JMPS_ZOOM_SDK_KEY || '').trim();
  if (env) return { wert: env, herkunft: 'env' };
  const gespeichert = zoomSdkGespeichertLesen();
  if (gespeichert) return { wert: gespeichert, herkunft: 'stored' };
  if (zoomSdkSitzung) return { wert: zoomSdkSitzung, herkunft: 'session' };
  return { wert: null, herkunft: 'none' };
}

/** Der Kern hat getrimmt und geprüft (S18). 'session', wenn nichts auf der Platte gelandet ist. */
export function zoomSdkSchluesselSpeichern(wert: string): 'stored' | 'session' {
  const next = read();
  if (safeStorage.isEncryptionAvailable()) {
    next.zoomSdkKeyEnc = safeStorage.encryptString(wert).toString('base64');
    if (write(next)) {
      zoomSdkGespeichert = wert;
      zoomSdkSitzung = null;
      return 'stored';
    }
    // Nichts auf der Platte: ehrlich „nur für diese Sitzung“, und der neue Wert gilt, nicht ein alter von der Platte.
    zoomSdkGespeichert = null;
    zoomSdkSitzung = wert;
    return 'session';
  }
  // Ohne Schlüsselbund NIE im Klartext auf die Platte; ein altes, hier nicht entschlüsselbares Feld fliegt raus.
  delete next.zoomSdkKeyEnc;
  write(next);
  zoomSdkGespeichert = null;
  zoomSdkSitzung = wert;
  if (!zoomSdkSitzungGewarnt) {
    zoomSdkSitzungGewarnt = true;
    getLog().warn('[zoom] safeStorage nicht verfügbar — der SDK-Schlüssel gilt nur für diese Sitzung.');
  }
  return 'session';
}

export function zoomSdkSchluesselLoeschen(): void {
  const next = read();
  delete next.zoomSdkKeyEnc;
  write(next);
  zoomSdkGespeichert = null;
  zoomSdkSitzung = null;
}
```

- [ ] **Step 5: Grün sehen**

Run: `npx tsx apps/connect/test/zoom-settings.test.ts` — Expected: `21 ok, 0 fehlgeschlagen.`
Run: `npx tsx apps/connect/test/zoom-teile.test.ts` — Expected: `90 ok, 0 fehlgeschlagen.`

- [ ] **Step 6: Alles prüfen**

Run: `npm run selftest -w @jm/connect` — Expected: Exit 0, letzte Zeile `Alle after-pack-Tests bestanden.`
Run: `npm run typecheck -w @jm/connect` — Expected: Exit 0.

- [ ] **Step 7: Commit**

```bash
git add apps/connect/src/main/settings.ts apps/connect/src/main/zoom/sdk-schluessel-eingabe.ts apps/connect/test/zoom-settings.test.ts apps/connect/test/zoom-teile.test.ts
git status --short
git commit -m "feat(connect): SDK-Schlüssel speichern (safeStorage, Sitzung) und Nutzlast prüfen" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Gegenprobe (gemessen):** Liest `zoomSdkSchluesselLesen` ohne den Zwischenspeicher `zoomSdkGespeichert` direkt von der Platte, gewinnt nach einem gescheiterten Schreiben der alte, verschlüsselte Wert. Dann wird `SDK: … der neue Wert gilt für die Sitzung, nicht der alte von der Platte` rot (`20 ok, 1 fehlgeschlagen.`). Der Test erzwingt das Scheitern mit `chmodSync(…, 0o444)`; das wirkt unter Windows (Schreibschutz-Attribut) und unter Linux für Nicht-root-Nutzer, also auch im GitHub-Runner.

---

### Task 4: SDK-Schlüssel im Kern, im Abbild und über IPC

**Files:**
- Modify: `apps/connect/src/main/zoom/kern.ts` (Typen :94-151, Zustand :202-204, Abbild :312-315, neue Funktionen vor `versatz` :515, `envRemove` der Bridge :655, Rückgabeobjekt :1203-1226)
- Modify: `apps/connect/src/shared/types.ts` (`ZoomAbbild.einrichtung` :176-185, `JmConnectApi` :256)
- Modify: `apps/connect/src/shared/ipc.ts` (nach `zoomZugangLoeschen` :54)
- Modify: `apps/connect/src/preload/index.ts` (nach `zoomZugangLoeschen` :80)
- Modify: `apps/connect/src/main/zoom.ts` (Importe :11-22, `erzeugeZoomKern` :61, Kanäle nach :114)
- Test: `apps/connect/test/zoom-kern.test.ts` (Import :33, `Probe` :79-80, `BaueOptionen` :106, `baueKern` :120, :198, :214; Block über der ENDE-Zeile)
- Test: `apps/connect/test/zoom-text.test.ts` (Testhilfe `abbild()` :35, Fall Z1b :76, drei Abbilder in „Einrichtungszeilen“)

**Interfaces:**
- Consumes (Aufgabe 2): `KT.S18`. (Aufgabe 3): `zoomSdkSchluesselLesen`, `zoomSdkSchluesselSpeichern`, `zoomSdkSchluesselLoeschen`, `pruefeSdkSchluesselEingabe`.
- Produces:
  - `export interface SdkSchluesselStand { wert: string | null; herkunft: ProxyKeySource }` in `kern.ts`.
  - `ZoomKernAbhaengigkeiten.sdkSchluessel: { lesen(): SdkSchluesselStand; speichern(wert: string): 'stored' | 'session'; loeschen(): void }` (Pflicht).
  - `ZoomKern.sdkSchluesselEintragen(e: { schluessel: string }): ZoomErgebnis` (getrimmt; S18 für alles außer druckbaren ASCII-Zeichen, A13) und `ZoomKern.sdkSchluesselLoeschen(): ZoomErgebnis`.
  - Die Bridge startet ohne `JMPS_ZOOM_SDK_KEY` und `JMPS_PROXY_KEY` in ihrer Umgebung (`envRemove`, G2).
  - `ZoomAbbild.einrichtung.sdkSchluessel: { herkunft: ProxyKeySource }` (Pflichtfeld; Aufgabe 8 liest es).
  - IPC `IPC.zoomSdkSchluesselEintragen = 'jmc:zoom-sdk-schluessel-eintragen'` (Nutzlast `{ schluessel }`), `IPC.zoomSdkSchluesselLoeschen = 'jmc:zoom-sdk-schluessel-loeschen'`; `JmConnectApi.zoomSdkSchluesselEintragen(p: { schluessel: string }): Promise<ZoomErgebnis>`, `JmConnectApi.zoomSdkSchluesselLoeschen(): Promise<ZoomErgebnis>` (Aufgabe 9 ruft sie).
  - Prüfstand: `BaueOptionen.sdkSchluessel?: { wert: string | null; herkunft: ProxyKeySource }`, `BaueOptionen.sdkSchluesselLiefert?: 'stored' | 'session'`, `Probe.sdkSchluesselGespeichert: string[]`, `Probe.sdkSchluesselGeloescht(): number` (Aufgabe 7 nutzt `sdkSchluessel`).

- [ ] **Step 1: Prüfstand erweitern**

Datei `apps/connect/test/zoom-kern.test.ts` — ersetze:

```ts
import type { ZoomAbbild, ZoomErgebnis, ZoomKurz } from '../src/shared/types';
```

durch:

```ts
import type { ProxyKeySource, ZoomAbbild, ZoomErgebnis, ZoomKurz } from '../src/shared/types';
```

Dann ersetze:

```ts
  zugangGespeichert: ZugangDaten[];
  richteEinAufrufe(): number;
```

durch:

```ts
  zugangGespeichert: ZugangDaten[];
  /** Werte, mit denen der Kern sdkSchluessel.speichern() aufrief (nur im Test sichtbar). */
  sdkSchluesselGespeichert: string[];
  sdkSchluesselGeloescht(): number;
  richteEinAufrufe(): number;
```

Dann ersetze:

```ts
  startFehler?: () => Error;
}
```

durch:

```ts
  startFehler?: () => Error;
  /** SDK-Schlüssel beim Start (Spec SDK nachladen 4.2); Vorgabe: keiner. */
  sdkSchluessel?: { wert: string | null; herkunft: ProxyKeySource };
  /** Was sdkSchluessel.speichern() meldet; Vorgabe 'stored'. */
  sdkSchluesselLiefert?: 'stored' | 'session';
}
```

Dann ersetze:

```ts
  const zugangGespeichert: ZugangDaten[] = [];
```

durch:

```ts
  const zugangGespeichert: ZugangDaten[] = [];
  let sdkSchluessel: { wert: string | null; herkunft: ProxyKeySource } = { wert: null, herkunft: 'none', ...o.sdkSchluessel };
  const sdkSchluesselGespeichert: string[] = [];
  let sdkSchluesselGeloescht = 0;
```

Dann ersetze:

```ts
    gastLabels: o.gastLabels ?? (() => []),
```

durch:

```ts
    sdkSchluessel: {
      lesen: () => ({ ...sdkSchluessel }),
      speichern: (w) => {
        sdkSchluesselGespeichert.push(w);
        const herkunft = o.sdkSchluesselLiefert ?? 'stored';
        if (sdkSchluessel.herkunft !== 'env') sdkSchluessel = { wert: w, herkunft };
        return herkunft;
      },
      loeschen: () => {
        sdkSchluesselGeloescht += 1;
        if (sdkSchluessel.herkunft !== 'env') sdkSchluessel = { wert: null, herkunft: 'none' };
      },
    },
    gastLabels: o.gastLabels ?? (() => []),
```

Dann ersetze:

```ts
    zugangGespeichert,
    ordner,
```

durch:

```ts
    zugangGespeichert,
    sdkSchluesselGespeichert,
    sdkSchluesselGeloescht: () => sdkSchluesselGeloescht,
    ordner,
```

- [ ] **Step 2: Die Kern-Tests schreiben**

Datei `apps/connect/test/zoom-kern.test.ts` — ersetze:

```ts
// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
```

durch:

```ts
console.log('— SDK-Schlüssel eintragen und entfernen (Spec SDK nachladen 4.2, S18, S10)');
{
  const p = baueKern();
  ck('anfangs: Abbild ohne SDK-Schlüssel (none)', p.kern.abbild().einrichtung.sdkSchluessel.herkunft === 'none');
  const r = p.kern.sdkSchluesselEintragen({ schluessel: '  sdk-geheim-test \t\n' });
  ck('Review Focus SDK-4: eingefügt mit Leerraum und Zeilenumbruch → ok, getrimmt gespeichert',
    ok(r) && p.sdkSchluesselGespeichert.length === 1 && p.sdkSchluesselGespeichert[0] === 'sdk-geheim-test');
  ck('… Abbild: Herkunft stored', p.kern.abbild().einrichtung.sdkSchluessel.herkunft === 'stored');
  ck('… Logzeile ohne Wert', p.logs.includes('[zoom] SDK-Schlüssel hinterlegt (verschlüsselt)'));
  ck('… der Wert steht weder im Log noch im Abbild',
    !p.logs.some((z) => z.includes('sdk-geheim')) && !JSON.stringify(p.kern.abbild()).includes('sdk-geheim'));
  ck('… Zustand unverändert (bereit)', p.kern.kurz().zustand === 'bereit');
  for (const w of ['', '   ', 'sdk geheim', 'sdk\tgeheim', 'sdk\ngeheim', 'sdk€geheim']) {
    ck(`${JSON.stringify(w)} → S18, nichts gespeichert`,
      text(p.kern.sdkSchluesselEintragen({ schluessel: w })) === KT.S18 && p.sdkSchluesselGespeichert.length === 1);
  }
  ck('… Abweisung im Log, ohne Wert', p.logs.includes('[zoom] SDK-Schlüssel abgewiesen: ' + KT.S18) && !p.logs.some((z) => z.includes('sdk geheim')));
  ck('… S18 ist ein Eingabefehler: nicht im Abbild', !JSON.stringify(p.kern.abbild()).includes(KT.S18));
  const l = p.kern.sdkSchluesselLoeschen();
  ck('Entfernen → ok, Herkunft none, Log', ok(l) && p.sdkSchluesselGeloescht() === 1
    && p.kern.abbild().einrichtung.sdkSchluessel.herkunft === 'none' && p.logs.includes('[zoom] SDK-Schlüssel entfernt'));
  await p.aufraeumen();
}
{
  const p = baueKern({ sdkSchluesselLiefert: 'session' });
  ck('ohne Schlüsselbund: hinterlegt nur für diese Sitzung',
    ok(p.kern.sdkSchluesselEintragen({ schluessel: 'sdk-test' })) && p.kern.abbild().einrichtung.sdkSchluessel.herkunft === 'session'
      && p.logs.includes('[zoom] SDK-Schlüssel hinterlegt (nur für diese Sitzung)'));
  await p.aufraeumen();
}
{
  const p = baueKern({ sdkSchluessel: { wert: 'sdk-test', herkunft: 'env' } });
  ck('aus der Umgebung: Abbild env, der Wert nirgends',
    p.kern.abbild().einrichtung.sdkSchluessel.herkunft === 'env' && !JSON.stringify(p.kern.abbild()).includes('sdk-test'));
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_AUTH_CODE: '2' }) });
  await p.kern.beitreten({ nummer: NUMMER, kenncode: KENNCODE, anzeigename: 'JM Connect' });
  ck('Vorbereitung: Zustand fehler (B9)', p.kern.kurz().zustand === 'fehler');
  const r = p.kern.sdkSchluesselEintragen({ schluessel: 'sdk-test' });
  ck('im Zustand fehler: zuerst schließen, dann speichern → bereit, Meldung weg',
    ok(r) && p.sdkSchluesselGespeichert.length === 1 && p.kern.kurz().zustand === 'bereit' && p.kern.abbild().meldung === null);
  await p.aufraeumen();
}
{
  const p = baueKern();
  ck('Vorbereitung: im Meeting', await insMeeting(p));
  ck('während Zoom läuft: SDK-Schlüssel eintragen und entfernen → S10, nichts geändert',
    text(p.kern.sdkSchluesselEintragen({ schluessel: 'sdk-test' })) === KT.S10 && text(p.kern.sdkSchluesselLoeschen()) === KT.S10
      && p.sdkSchluesselGespeichert.length === 0 && p.sdkSchluesselGeloescht() === 0);
  await p.aufraeumen();
}
{
  let freigabe: (e: EinrichtungsErgebnis) => void = () => {};
  const p = baueKern({
    laufzeit: {
      pruefeOrdner: () => ({ ok: true, bin: 'X', fassung: SDK_FASSUNG, dateien: [{ pfad: 'sdk.dll', bytes: 1 }], bytesGesamt: 1 }),
      richteEin: () => new Promise<EinrichtungsErgebnis>((resolve) => {
        freigabe = resolve;
      }),
    },
  });
  const lauf = p.kern.sdkWaehlen('C:/SDK');
  ck('während der SDK-Kopie: SDK-Schlüssel eintragen und entfernen → S10',
    text(p.kern.sdkSchluesselEintragen({ schluessel: 'sdk-test' })) === KT.S10 && text(p.kern.sdkSchluesselLoeschen()) === KT.S10
      && p.sdkSchluesselGespeichert.length === 0);
  freigabe({ ok: false, text: KT.S6('EIO') });
  await lauf;
  await p.aufraeumen();
}
{
  // G2: Weder der SDK-Schlüssel noch der Proxy-Schlüssel erreichen die Zoom-Bridge (sie lädt die Zoom-DLLs).
  const vorher = { sdk: process.env.JMPS_ZOOM_SDK_KEY, proxy: process.env.JMPS_PROXY_KEY };
  process.env.JMPS_ZOOM_SDK_KEY = 'sdk-test';
  process.env.JMPS_PROXY_KEY = 'sdk-test';
  const p = baueKern({
    skript: 'envprobe',
    stell: () => ({ ENV_PROBE_NAMES: 'JMPS_ZOOM_SDK_KEY,JMPS_PROXY_KEY' }),
    fristen: { anmeldeMs: 500 },
  });
  await p.kern.pruefen();
  for (const [name, wert] of [['JMPS_ZOOM_SDK_KEY', vorher.sdk], ['JMPS_PROXY_KEY', vorher.proxy]] as const) {
    if (wert === undefined) delete process.env[name];
    else process.env[name] = wert;
  }
  const probe = p.ereignisse.find((x) => x.ev.ev === 'envprobe')?.ev as unknown as { seen: Record<string, boolean> } | undefined;
  ck('G2: Bridge-Umgebung ohne JMPS_ZOOM_SDK_KEY und JMPS_PROXY_KEY',
    probe !== undefined && JSON.stringify(probe.seen) === '{"JMPS_ZOOM_SDK_KEY":false,"JMPS_PROXY_KEY":false}');
  await p.aufraeumen();
}

// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
```

- [ ] **Step 3: Rot sehen**

Run: `npx tsx apps/connect/test/zoom-kern.test.ts`
Expected: Die alten Fälle laufen durch, dann Abbruch mit `TypeError: Cannot read properties of undefined (reading 'herkunft')`.

- [ ] **Step 4: Kern — Typen, Zustand, Abbild**

Datei `apps/connect/src/main/zoom/kern.ts` — ersetze:

```ts
export interface ZugangStand { daten: ZugangDaten | null; herkunft: ProxyKeySource; grund?: 'schreibfehler'; unlesbar: boolean }
```

durch:

```ts
export interface ZugangStand { daten: ZugangDaten | null; herkunft: ProxyKeySource; grund?: 'schreibfehler'; unlesbar: boolean }
/** SDK-Schlüssel für „Zoom-SDK laden“ (Spec SDK nachladen 4.2). Der Wert bleibt im Main, das Abbild trägt nur die Herkunft. */
export interface SdkSchluesselStand { wert: string | null; herkunft: ProxyKeySource }
```

Dann ersetze:

```ts
  zugang: { lesen(): ZugangStand; speichern(d: ZugangDaten): 'stored' | 'session'; loeschen(): void };
```

durch:

```ts
  zugang: { lesen(): ZugangStand; speichern(d: ZugangDaten): 'stored' | 'session'; loeschen(): void };
  /** Umgebung JMPS_ZOOM_SDK_KEY > gespeichert (safeStorage) > Sitzung; speichern() bekommt den getrimmten Wert. */
  sdkSchluessel: { lesen(): SdkSchluesselStand; speichern(wert: string): 'stored' | 'session'; loeschen(): void };
```

Dann ersetze:

```ts
  zugangLoeschen(): ZoomErgebnis;
  versatz(e: { ms: number }): ZoomErgebnis;
```

durch:

```ts
  zugangLoeschen(): ZoomErgebnis;
  sdkSchluesselEintragen(e: { schluessel: string }): ZoomErgebnis;
  sdkSchluesselLoeschen(): ZoomErgebnis;
  versatz(e: { ms: number }): ZoomErgebnis;
```

Dann ersetze:

```ts
  let zugangFehler: string | null = null;
```

durch:

```ts
  let zugangFehler: string | null = null;
  /** Nur die Herkunft; den Wert liest erst das Laden (Spec SDK nachladen 4.2). */
  let sdkSchluesselHerkunft: ProxyKeySource = d.sdkSchluessel.lesen().herkunft;
```

Dann ersetze:

```ts
        zugang: { herkunft: zugang.herkunft, ...(zugang.grund ? { grund: zugang.grund } : {}), clientIdEnde: id ? id.slice(-4) : null, text: zugangText },
      },
```

durch:

```ts
        zugang: { herkunft: zugang.herkunft, ...(zugang.grund ? { grund: zugang.grund } : {}), clientIdEnde: id ? id.slice(-4) : null, text: zugangText },
        sdkSchluessel: { herkunft: sdkSchluesselHerkunft },
      },
```

- [ ] **Step 5: Kern — Eintragen, Entfernen und Umgebung der Bridge**

Datei `apps/connect/src/main/zoom/kern.ts` — ersetze:

```ts
  function versatz(e: { ms: number }): ZoomErgebnis {
```

durch:

```ts
  /** Spec SDK nachladen 4.2: getrimmt, nur druckbare ASCII-Zeichen, sonst S18 (A13). Der Wert geht nie in Log, Abbild oder Rückgabe. */
  function sdkSchluesselEintragen(e: { schluessel: string }): ZoomErgebnis {
    const sperre = einrichtungSperre();
    if (!sperre.ok) return sperre;
    if (zustand === 'fehler') schliessen();
    const wert = e.schluessel.trim();
    // Nur druckbare ASCII-Zeichen: kein Leerraum in der Mitte (Spec 4.2) und nichts, was kein HTTP-Header tragen kann.
    if (!/^[\x21-\x7e]+$/.test(wert)) {
      // Eingabefehler, kein Zustand des hinterlegten Schlüssels: nur im Ergebnis, nicht im Abbild.
      d.log('[zoom] SDK-Schlüssel abgewiesen: ' + KT.S18);
      return { ok: false, text: KT.S18 };
    }
    const herkunft = d.sdkSchluessel.speichern(wert);
    sdkSchluesselHerkunft = d.sdkSchluessel.lesen().herkunft;
    d.log(`[zoom] SDK-Schlüssel hinterlegt (${herkunft === 'session' ? 'nur für diese Sitzung' : 'verschlüsselt'})`);
    abbildGeaendert();
    return { ok: true };
  }

  function sdkSchluesselLoeschen(): ZoomErgebnis {
    const sperre = einrichtungSperre();
    if (!sperre.ok) return sperre;
    if (zustand === 'fehler') schliessen();
    d.sdkSchluessel.loeschen();
    sdkSchluesselHerkunft = d.sdkSchluessel.lesen().herkunft;
    d.log('[zoom] SDK-Schlüssel entfernt');
    abbildGeaendert();
    return { ok: true };
  }

  function versatz(e: { ms: number }): ZoomErgebnis {
```

Dann ersetze (im Rückgabeobjekt am Dateiende):

```ts
    zugangLoeschen,
    versatz,
```

durch:

```ts
    zugangLoeschen,
    sdkSchluesselEintragen,
    sdkSchluesselLoeschen,
    versatz,
```

Dann ersetze (Umgebung der Zoom-Bridge in `startZoom`; `bridge.ts` mischt `process.env` hinein, darum muss der Name hier stehen):

```ts
        envRemove: ['ZOOM_SDK_CLIENT_ID', 'ZOOM_SDK_CLIENT_SECRET', 'ZOOM_SDK_CREDENTIALS', ...pfadVarianten(env)],
```

durch:

```ts
        // Nie an die Bridge (sie lädt die Zoom-DLLs): Zoom-Zugangsdaten und Schlüssel für den Release-Proxy (G2).
        envRemove: [
          'ZOOM_SDK_CLIENT_ID',
          'ZOOM_SDK_CLIENT_SECRET',
          'ZOOM_SDK_CREDENTIALS',
          'JMPS_ZOOM_SDK_KEY',
          'JMPS_PROXY_KEY',
          ...pfadVarianten(env),
        ],
```

- [ ] **Step 6: Typen, IPC, Preload, Hülle**

Datei `apps/connect/src/shared/types.ts` — ersetze:

```ts
    zugang: { herkunft: ProxyKeySource; grund?: 'schreibfehler'; clientIdEnde: string | null; text: string | null };
  };
```

durch:

```ts
    zugang: { herkunft: ProxyKeySource; grund?: 'schreibfehler'; clientIdEnde: string | null; text: string | null };
    /** Nur die Herkunft, nie der Wert (Spec SDK nachladen 4.2). */
    sdkSchluessel: { herkunft: ProxyKeySource };
  };
```

Dann ersetze:

```ts
  zoomZugangLoeschen: () => Promise<ZoomErgebnis>;
```

durch:

```ts
  zoomZugangLoeschen: () => Promise<ZoomErgebnis>;
  /** SDK-Schlüssel für „Zoom-SDK laden“: nur hinein, es gibt keinen Weg zurück ins Fenster. */
  zoomSdkSchluesselEintragen: (p: { schluessel: string }) => Promise<ZoomErgebnis>;
  zoomSdkSchluesselLoeschen: () => Promise<ZoomErgebnis>;
```

Datei `apps/connect/src/shared/ipc.ts` — ersetze:

```ts
  zoomZugangLoeschen: 'jmc:zoom-zugang-loeschen',
```

durch:

```ts
  zoomZugangLoeschen: 'jmc:zoom-zugang-loeschen',
  /** invoke: { schluessel } → ZoomErgebnis (gesperrt wie die Wahl, S10). Der Wert geht nie zurück. */
  zoomSdkSchluesselEintragen: 'jmc:zoom-sdk-schluessel-eintragen',
  /** invoke: hinterlegten SDK-Schlüssel entfernen → ZoomErgebnis (gesperrt wie die Wahl, S10). */
  zoomSdkSchluesselLoeschen: 'jmc:zoom-sdk-schluessel-loeschen',
```

Datei `apps/connect/src/preload/index.ts` — ersetze:

```ts
  zoomZugangLoeschen: () => ipcRenderer.invoke(IPC.zoomZugangLoeschen) as Promise<ZoomErgebnis>,
```

durch:

```ts
  zoomZugangLoeschen: () => ipcRenderer.invoke(IPC.zoomZugangLoeschen) as Promise<ZoomErgebnis>,
  zoomSdkSchluesselEintragen: ({ schluessel }) =>
    ipcRenderer.invoke(IPC.zoomSdkSchluesselEintragen, { schluessel }) as Promise<ZoomErgebnis>,
  zoomSdkSchluesselLoeschen: () => ipcRenderer.invoke(IPC.zoomSdkSchluesselLoeschen) as Promise<ZoomErgebnis>,
```

Datei `apps/connect/src/main/zoom.ts` — ersetze:

```ts
import { pruefeZugangEingabe } from './zoom/zugang-eingabe';
```

durch:

```ts
import { pruefeZugangEingabe } from './zoom/zugang-eingabe';
import { pruefeSdkSchluesselEingabe } from './zoom/sdk-schluessel-eingabe';
```

Dann ersetze:

```ts
  zoomAnzeigename,
  zoomVersatzMs,
```

durch:

```ts
  zoomAnzeigename,
  zoomSdkSchluesselLesen,
  zoomSdkSchluesselLoeschen,
  zoomSdkSchluesselSpeichern,
  zoomVersatzMs,
```

Dann ersetze:

```ts
      zugang: { lesen: zoomZugangLesen, speichern: zoomZugangSpeichern, loeschen: zoomZugangLoeschen },
```

durch:

```ts
      zugang: { lesen: zoomZugangLesen, speichern: zoomZugangSpeichern, loeschen: zoomZugangLoeschen },
      sdkSchluessel: { lesen: zoomSdkSchluesselLesen, speichern: zoomSdkSchluesselSpeichern, loeschen: zoomSdkSchluesselLoeschen },
```

Dann ersetze:

```ts
  ipcMain.handle(IPC.zoomZugangLoeschen, (): ZoomErgebnis => k.zugangLoeschen());
```

durch:

```ts
  ipcMain.handle(IPC.zoomZugangLoeschen, (): ZoomErgebnis => k.zugangLoeschen());

  // SDK-Schlüssel (Spec SDK nachladen 4.2): Form prüfen (über 512 Zeichen, falsche Typen → stumm abgewiesen),
  // dann der Kern (Trimmen, S18, Sperre S10). Weder Antwort noch Log enthalten je den Wert.
  ipcMain.handle(IPC.zoomSdkSchluesselEintragen, (_e, p: unknown): ZoomErgebnis => {
    const e = pruefeSdkSchluesselEingabe(p);
    return e === null ? NICHTS : k.sdkSchluesselEintragen(e);
  });
  ipcMain.handle(IPC.zoomSdkSchluesselLoeschen, (): ZoomErgebnis => k.sdkSchluesselLoeschen());
```

- [ ] **Step 7: Testhilfen in zoom-text.test.ts an den neuen Pflichttyp anpassen**

Datei `apps/connect/test/zoom-text.test.ts` — ersetze (Testhilfe `abbild()`, sechs Leerzeichen Einzug):

```ts
      zugang: { herkunft: 'stored', clientIdEnde: '1234', text: null },
    },
    anzeigename: 'Regie Süd',
```

durch:

```ts
      zugang: { herkunft: 'stored', clientIdEnde: '1234', text: null },
      sdkSchluessel: { herkunft: 'stored' },
    },
    anzeigename: 'Regie Süd',
```

Dann ersetze (Fall Z1b, acht Leerzeichen Einzug):

```ts
        zugang: { herkunft: 'stored', clientIdEnde: '1234', text: null },
      },
    },
    nk: [[0, 0]],
```

durch:

```ts
        zugang: { herkunft: 'stored', clientIdEnde: '1234', text: null },
        sdkSchluessel: { herkunft: 'stored' },
      },
    },
    nk: [[0, 0]],
```

Dann ersetze alle drei Vorkommen (Abschnitt „Einrichtungszeilen“; mit dem Edit-Werkzeug `replace_all`):

```ts
{ sdk: ohne.einrichtung.sdk, zugang:
```

durch:

```ts
{ ...ohne.einrichtung, zugang:
```

- [ ] **Step 8: Grün sehen**

Run: `npx tsx apps/connect/test/zoom-kern.test.ts` — Expected: letzte Zeile `330 ok, 0 fehlgeschlagen, 0 übersprungen.`
Run: `npx tsx apps/connect/test/zoom-text.test.ts` — Expected: `502 ok, 0 fehlgeschlagen.`

- [ ] **Step 9: Alles prüfen**

Run: `npm run selftest -w @jm/connect` — Expected: Exit 0, letzte Zeile `Alle after-pack-Tests bestanden.`
Run: `npm run typecheck -w @jm/connect` — Expected: Exit 0. Fehlt ein Schritt aus Step 6 oder 7, meldet `tsc` hier das fehlende Feld `sdkSchluessel`.

- [ ] **Step 10: Commit**

```bash
git add apps/connect/src/main/zoom/kern.ts apps/connect/src/shared/types.ts apps/connect/src/shared/ipc.ts apps/connect/src/preload/index.ts apps/connect/src/main/zoom.ts apps/connect/test/zoom-kern.test.ts apps/connect/test/zoom-text.test.ts
git status --short
git commit -m "feat(connect): SDK-Schlüssel eintragen und entfernen (Kern, Abbild, IPC)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Gegenproben (gemessen, je einzeln eingebaut):**
- Ohne `'JMPS_ZOOM_SDK_KEY'` und `'JMPS_PROXY_KEY'` in `envRemove`: `329 ok, 1 fehlgeschlagen`; rot wird „G2: Bridge-Umgebung ohne JMPS_ZOOM_SDK_KEY und JMPS_PROXY_KEY“. Die Attrappe meldet dann beide Namen als gesehen.
- Mit der alten Prüfung `!wert || /\s/.test(wert)` statt der ASCII-Prüfung: `329 ok, 1 fehlgeschlagen`; rot wird `"sdk€geheim" → S18, nichts gespeichert`.

---

### Task 5: Gepinntes Paket und Lade-Modul (`sdk-paket.ts`, `sdk-laden.ts`)

**Files:**
- Create: `apps/connect/src/main/zoom/sdk-paket.ts`
- Create: `apps/connect/src/main/zoom/sdk-laden.ts`
- Modify: `apps/connect/src/main/zoom/laufzeit.ts:177-178` (`freierPlatz` exportieren)
- Create: `apps/connect/test/sdk-laden.test.ts`
- Modify: `apps/connect/package.json:17` („selftest“)

**Interfaces:**
- Consumes (Aufgabe 2): `KT.S12`–`KT.S17`. Aus `laufzeit.ts`: `freierPlatz` (wird hier exportiert). HTTP-Vertrag des Proxys aus Aufgabe 1.
- Produces (Aufgabe 7 baut darauf):
  - `SDK_PAKET: { fassung: '7.1.5.43953'; datei: 'zoom-sdk-win-x64-7.1.5.43953.zip'; sha256: string; bytes: 150120193; bytesEntpackt: 329657415 }` (`as const`).
  - `LADE_ORDNER = 'laden'`, `FORTSCHRITT_TAKT_MS = 250`.
  - `type LadeFehler = { ok: false; art: 'schluessel' | 'fehlt' | 'pruefsumme' | 'abgebrochen' } | { ok: false; art: 'gedrosselt'; sekunden: number } | { ok: false; art: 'proxy' | 'unvollstaendig' | 'entpacken'; grund: string }`; `LinkErgebnis = { ok: true; url: string; size: number } | LadeFehler`; `LadeErgebnis = EntpackErgebnis = { ok: true } | LadeFehler`.
  - `holeLink(e: { base: string; schluessel: string; fassung: string; signal: AbortSignal; werkzeuge?: Partial<LadeWerkzeuge> }): Promise<LinkErgebnis>`. Schickt den Schlüssel nur an `https://` oder per `http://` an `127.0.0.1`/`localhost`/`[::1]`, sonst `proxy` „kein HTTPS“ ohne Anfrage (A14); keine URL → „Adresse ungültig“; 200 ohne gültiges JSON → „Antwort ungültig“ (A5).
  - `lade(e: { url: string; size: number; ziel: string; erwartet: { bytes: number; sha256: string }; signal: AbortSignal; fortschritt: (bytes: number) => void; beimPruefen?: () => void; werkzeuge?: Partial<LadeWerkzeuge> }): Promise<LadeErgebnis>`.
  - `entpacke(e: { zip: string; ordner: string; signal: AbortSignal; werkzeuge?: Partial<LadeWerkzeuge> }): Promise<EntpackErgebnis>`.
  - `ladeFehlerText(f: LadeFehler): string`, `fehlerCode(e: unknown): string`.
  - `interface SdkLadenDienste { holeLink; lade; entpacke; freierPlatz(pfad: string): Promise<number>; loesche(pfad: string): void }` und `SDK_LADEN_DIENSTE: SdkLadenDienste`.
  - `interface LadeWerkzeuge { fetch; jetzt(): number; oeffne(pfad: string): Promise<Schreibziel>; starte(befehl: string, args: readonly string[]): KindProzess; plattform: string; systemRoot: string | undefined }`, `interface Schreibziel { write(daten: Uint8Array, versatz: number, laenge: number): Promise<{ bytesWritten: number }>; close(): Promise<void> }` (ein `FileHandle` erfüllt es; `lade()` schreibt Teil-Schreibvorgänge zu Ende), `interface KindProzess { on('error' | 'close', …); kill(): boolean }`.
  - `laufzeit.ts`: `export async function freierPlatz(pfad: string, w: Pick<LaufzeitWerkzeuge, 'statfs'>): Promise<number>`.

- [ ] **Step 1: Die Testdatei schreiben**

Neue Datei `apps/connect/test/sdk-laden.test.ts`:

```ts
// Zoom-SDK nachladen OHNE Electron (tsx): Paket, Link, Download, Entpacken, Texte (Spec 2026-10-06, 4.1, 4.3, 5, 6).
//   npm run selftest -w @jm/connect   ·   einzeln: npx tsx apps/connect/test/sdk-laden.test.ts
// Lokaler HTTP-Testserver (Muster apps/launcher/test/iveo-huelle.test.ts) mit erfundenem Mini-Paket und eigenem
// SHA. Das echte tar.exe läuft nur unter Windows; anderswo zählen diese Fälle als „übersprungen“.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { open } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SDK_FASSUNG } from '@jm/zoom-bridge/sdk';
import { KT } from '../src/main/zoom/klartext';
import { freierPlatz } from '../src/main/zoom/laufzeit';
import {
  entpacke,
  fehlerCode,
  holeLink,
  lade,
  LADE_ORDNER,
  ladeFehlerText,
  SDK_LADEN_DIENSTE,
  type KindProzess,
  type LadeFehler,
} from '../src/main/zoom/sdk-laden';
import { SDK_PAKET } from '../src/main/zoom/sdk-paket';

let pass = 0, fail = 0, skip = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}
function ueberspringe(name: string): void {
  skip++;
  console.log(`  --  ${name} (übersprungen: nur unter Windows)`);
}
// Gesamtwache: hängt ein Fall, endet der Lauf rot statt nie.
const wache = setTimeout(() => {
  console.log('FAIL  Gesamtlaufzeit über 60 s – ein Fall hängt');
  process.exit(1);
}, 60_000);
wache.unref();

const tmp = mkdtempSync(join(tmpdir(), 'jm-sdk-laden-'));
const sig = (): AbortSignal => new AbortController().signal;
/** Wartet höchstens `ms`, bis `f()` gilt; liefert den letzten Wert. */
async function bis(f: () => boolean, ms = 2000): Promise<boolean> {
  const ende = Date.now() + ms;
  while (!f() && Date.now() < ende) await new Promise((r) => setTimeout(r, 10));
  return f();
}
/** Jedes Fehler-Ergebnis landet hier: am Ende darf keines Schlüssel, Link oder Server-Adresse tragen. */
const fehlerErgebnisse: unknown[] = [];
function merke<T extends { ok: boolean }>(r: T): T {
  if (!r.ok) fehlerErgebnisse.push(r);
  return r;
}

// Erfundenes Mini-Paket: 300 000 Bytes festes Muster, eigener SHA-256.
const PAKET = Buffer.alloc(300_000);
for (let i = 0; i < PAKET.length; i++) PAKET[i] = i % 251;
const MINI = { bytes: PAKET.length, sha256: createHash('sha256').update(PAKET).digest('hex') };

// ── Testserver ──
type LinkModus = { status: number; kopf?: Record<string, string>; body: string } | 'haengt';
let linkModus: LinkModus = { status: 200, body: '{}' };
let anfragen: Array<{ pfad: string; schluessel: string | undefined; proxyKey: string | undefined }> = [];
/** /paket/endlos: was der Server gesendet hat und ob der Client die Verbindung geschlossen hat. */
const endlos = { gesendet: 0, zu: false };

/** Schreibt `daten` in 10 Stücken mit kurzer Pause, damit der Client mehrere Stücke liest. */
function stueckweise(res: ServerResponse, daten: Buffer, dann: () => void): void {
  const groesse = Math.ceil(daten.length / 10);
  let pos = 0;
  const weiter = (): void => {
    if (pos >= daten.length) return dann();
    res.write(daten.subarray(pos, pos + groesse));
    pos += groesse;
    setTimeout(weiter, 5);
  };
  weiter();
}

function route(req: IncomingMessage, res: ServerResponse): void {
  const pfad = (req.url ?? '/').split('?')[0];
  anfragen.push({
    pfad,
    schluessel: req.headers['x-zoom-sdk-key'] as string | undefined,
    proxyKey: req.headers['x-proxy-key'] as string | undefined,
  });
  if (pfad.startsWith('/zoom-sdk/')) {
    if (linkModus === 'haengt') return; // antwortet nie
    res.writeHead(linkModus.status, { 'content-type': 'application/json', ...linkModus.kopf });
    res.end(linkModus.body);
    return;
  }
  const haelfte = PAKET.subarray(0, PAKET.length / 2);
  switch (pfad) {
    case '/paket/ok':
      res.writeHead(200, { 'content-length': String(PAKET.length) });
      stueckweise(res, PAKET, () => res.end());
      return;
    case '/paket/abriss':
      res.writeHead(200, { 'content-length': String(PAKET.length) });
      res.write(haelfte);
      setTimeout(() => res.socket?.destroy(), 20);
      return;
    case '/paket/kurz': // sauber zu Ende, aber zu kurz (ohne content-length, chunked)
      res.writeHead(200);
      res.end(haelfte);
      return;
    case '/paket/endlos': { // mehr Bytes als gepinnt: sendet bis zum Zehnfachen, es sei denn, der Client legt auf
      res.writeHead(200);
      const stueck = Buffer.alloc(30_000, 1);
      endlos.gesendet = 0;
      endlos.zu = false;
      res.on('close', () => {
        endlos.zu = true;
      });
      const weiter = (): void => {
        if (endlos.zu) return;
        if (endlos.gesendet >= 10 * PAKET.length) return void res.end();
        endlos.gesendet += stueck.length;
        res.write(stueck);
        setTimeout(weiter, 5);
      };
      weiter();
      return;
    }
    case '/paket/falsch': {
      const anders = Buffer.from(PAKET);
      anders[0] ^= 0xff;
      res.writeHead(200, { 'content-length': String(anders.length) });
      res.end(anders);
      return;
    }
    case '/paket/haengt':
      res.writeHead(200, { 'content-length': String(PAKET.length) });
      res.write(haelfte);
      return; // nie zu Ende
    default:
      res.writeHead(403);
      res.end('nein');
  }
}

const server = createServer(route);
await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
const BASIS = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

// ── 4.1 Gepinntes Paket ──
console.log('— Gepinntes Paket (Spec 4.1)');
ck('SDK_PAKET.fassung === SDK_FASSUNG aus @jm/zoom-bridge', SDK_PAKET.fassung === SDK_FASSUNG);
ck('sha256 ist echtes Hex (64 Zeichen, kein Platzhalter)', /^[0-9a-f]{64}$/.test(SDK_PAKET.sha256));
ck('datei = zoom-sdk-win-x64-<fassung>.zip', SDK_PAKET.datei === `zoom-sdk-win-x64-${SDK_FASSUNG}.zip`);
ck('bytes und bytesEntpackt sind ganze Zahlen > 0, entpackt größer',
  Number.isSafeInteger(SDK_PAKET.bytes) && SDK_PAKET.bytes > 0 && Number.isSafeInteger(SDK_PAKET.bytesEntpackt)
    && SDK_PAKET.bytesEntpackt > SDK_PAKET.bytes);
ck('Arbeitsordner heißt „laden“ (Spec 4.3 Schritt 4)', LADE_ORDNER === 'laden');
ck('Werte wörtlich wie am hochgeladenen Asset gemessen (Plan G1)', JSON.stringify(SDK_PAKET) === JSON.stringify({
  fassung: '7.1.5.43953',
  datei: 'zoom-sdk-win-x64-7.1.5.43953.zip',
  sha256: '596ef61956b5f336570dd3cd14b0ec9822d51e37a2a4fc03ce4f96c1974b3b4e',
  bytes: 150120193,
  bytesEntpackt: 329657415,
}));

// ── Link beim Proxy ──
console.log('— Link beim Proxy (holeLink): Fehlerarten, Header, kein Proxy-Schlüssel');
async function link(modus: LinkModus): Promise<Awaited<ReturnType<typeof holeLink>>> {
  linkModus = modus;
  return merke(await holeLink({ base: BASIS, schluessel: 'sdk-test', fassung: SDK_FASSUNG, signal: sig() }));
}
{
  anfragen = [];
  const r = await link({ status: 200, body: JSON.stringify({ fassung: SDK_FASSUNG, url: `${BASIS}/paket/ok`, size: MINI.bytes }) });
  ck('200 → url und size', r.ok && r.url === `${BASIS}/paket/ok` && r.size === MINI.bytes);
  ck('… GET /zoom-sdk/<fassung>, Schlüssel im Header X-Zoom-Sdk-Key',
    anfragen.length === 1 && anfragen[0].pfad === `/zoom-sdk/${SDK_FASSUNG}` && anfragen[0].schluessel === 'sdk-test');
  ck('… ohne X-Proxy-Key', anfragen[0].proxyKey === undefined);
}
ck('401 → schluessel', JSON.stringify(await link({ status: 401, body: '{"error":"unauthorized"}' })) === '{"ok":false,"art":"schluessel"}');
ck('429 mit Retry-After 125 → gedrosselt, 125 s',
  JSON.stringify(await link({ status: 429, kopf: { 'Retry-After': '125' }, body: '{}' })) === '{"ok":false,"art":"gedrosselt","sekunden":125}');
ck('429 ohne Retry-After → gedrosselt, 60 s',
  JSON.stringify(await link({ status: 429, body: '{}' })) === '{"ok":false,"art":"gedrosselt","sekunden":60}');
ck('404 → fehlt', JSON.stringify(await link({ status: 404, body: '{"error":"not_found"}' })) === '{"ok":false,"art":"fehlt"}');
ck('502 → proxy „HTTP 502“', JSON.stringify(await link({ status: 502, body: '{"error":"upstream"}' })) === '{"ok":false,"art":"proxy","grund":"HTTP 502"}');
ck('200 mit kaputtem JSON → proxy „Antwort ungültig“ (kein JS-Fehlername)',
  JSON.stringify(await link({ status: 200, body: 'kein json' })) === '{"ok":false,"art":"proxy","grund":"Antwort ungültig"}');
ck('200 ohne url → proxy „Antwort ungültig“',
  JSON.stringify(await link({ status: 200, body: JSON.stringify({ size: 5 }) })) === '{"ok":false,"art":"proxy","grund":"Antwort ungültig"}');
{
  // Der SDK-Schlüssel geht nie im Klartext übers Netz: http nur an die eigene Maschine (wie BASIS hier).
  let gefragt = 0;
  const zaehle: typeof fetch = async () => {
    gefragt++;
    return new Response('{}', { status: 500 });
  };
  const r = merke(await holeLink({ base: 'http://proxy.test', schluessel: 'sdk-test', fassung: SDK_FASSUNG, signal: sig(), werkzeuge: { fetch: zaehle } }));
  ck('Proxy-Adresse mit http:// (nicht die eigene Maschine) → proxy „kein HTTPS“, keine Anfrage',
    JSON.stringify(r) === '{"ok":false,"art":"proxy","grund":"kein HTTPS"}' && gefragt === 0);
  gefragt = 0;
  const r2 = merke(await holeLink({ base: 'keine adresse', schluessel: 'sdk-test', fassung: SDK_FASSUNG, signal: sig(), werkzeuge: { fetch: zaehle } }));
  ck('kaputte Proxy-Adresse → proxy „Adresse ungültig“, keine Anfrage',
    JSON.stringify(r2) === '{"ok":false,"art":"proxy","grund":"Adresse ungültig"}' && gefragt === 0);
}
{
  const zu = createServer(() => {});
  await new Promise<void>((r) => zu.listen(0, '127.0.0.1', r));
  const port = (zu.address() as AddressInfo).port;
  await new Promise<void>((r) => zu.close(() => r()));
  const r = merke(await holeLink({ base: `http://127.0.0.1:${port}`, schluessel: 'sdk-test', fassung: SDK_FASSUNG, signal: sig() }));
  ck('Netzfehler (Port zu) → proxy „ECONNREFUSED“', !r.ok && r.art === 'proxy' && r.grund === 'ECONNREFUSED');
}
{
  linkModus = 'haengt';
  const ac = new AbortController();
  const lauf = holeLink({ base: BASIS, schluessel: 'sdk-test', fassung: SDK_FASSUNG, signal: ac.signal });
  setTimeout(() => ac.abort(), 50);
  ck('Abbruch, während der Proxy schweigt → abgebrochen', JSON.stringify(merke(await lauf)) === '{"ok":false,"art":"abgebrochen"}');
}

// ── Download ──
console.log('— Download (lade): Fortschritt, Abriss, Länge, Prüfsumme, Abbruch, Größe vom Proxy');
let nr = 0;
const neuesZiel = (): string => join(tmp, `dl-${++nr}`, 'paket.zip');
async function ladeVon(modus: string, extra: Partial<Parameters<typeof lade>[0]> = {}): Promise<{ r: Awaited<ReturnType<typeof lade>>; ziel: string }> {
  const ziel = neuesZiel();
  const r = merke(await lade({ url: `${BASIS}/paket/${modus}`, size: MINI.bytes, ziel, erwartet: MINI, signal: sig(), fortschritt: () => {}, ...extra }));
  return { r, ziel };
}
{
  const meldungen: number[] = [];
  let geprueft = 0;
  let uhr = 0;
  const { r, ziel } = await ladeVon('ok', {
    fortschritt: (b) => meldungen.push(b),
    beimPruefen: () => { geprueft++; },
    werkzeuge: { jetzt: () => (uhr += 300) },
  });
  ck('Erfolg → ok, Datei am Ziel mit genau dem Inhalt', r.ok && existsSync(ziel) && readFileSync(ziel).equals(PAKET));
  ck('… .teil ist weg', !existsSync(`${ziel}.teil`));
  ck('… Fortschritt in mehreren Schritten, steigend, bis zur vollen Größe',
    meldungen.length >= 2 && meldungen.at(-1) === MINI.bytes && meldungen.every((b, i) => i === 0 || b > meldungen[i - 1]));
  ck('… „wird geprüft“ genau einmal gemeldet', geprueft === 1);
}
{
  const meldungen: number[] = [];
  const { r } = await ladeVon('ok', { fortschritt: (b) => meldungen.push(b), werkzeuge: { jetzt: () => 1000 } });
  ck('Uhr steht: höchstens eine Fortschrittsmeldung je 250 ms (hier genau eine)', r.ok && meldungen.length === 1);
}
{
  const { r, ziel } = await ladeVon('abriss');
  ck('Abriss mitten im Strom → unvollstaendig mit Netz-Code', !r.ok && r.art === 'unvollstaendig' && /^[A-Z][A-Z_]+$/.test(r.grund));
  ck('… .teil weg, kein Ziel', !existsSync(`${ziel}.teil`) && !existsSync(ziel));
}
{
  const { r, ziel } = await ladeVon('kurz');
  ck('sauber zu Ende, aber zu kurz → unvollstaendig „unvollständig“',
    JSON.stringify(r) === '{"ok":false,"art":"unvollstaendig","grund":"unvollständig"}' && !existsSync(`${ziel}.teil`) && !existsSync(ziel));
}
{
  const { r, ziel } = await ladeVon('endlos');
  ck('Review Focus SDK-3: mehr Bytes als gepinnt → Abbruch beim Überschreiten, unvollstaendig „zu groß“',
    JSON.stringify(r) === '{"ok":false,"art":"unvollstaendig","grund":"zu groß"}' && !existsSync(`${ziel}.teil`) && !existsSync(ziel));
  ck('… der Download hört dort auf: Verbindung zu, bevor der Server das Zehnfache gesendet hat',
    (await bis(() => endlos.zu)) && endlos.gesendet < 10 * MINI.bytes);
}
{
  // Ein Schreibziel, das je Aufruf höchstens 1000 Bytes schreibt: lade() muss den Rest selbst nachschieben.
  let schreibAufrufe = 0;
  const { r, ziel } = await ladeVon('ok', {
    werkzeuge: {
      oeffne: async (pfad) => {
        const echt = await open(pfad, 'w');
        return {
          write: (daten, versatz, laenge) => {
            schreibAufrufe++;
            return echt.write(daten, versatz, Math.min(laenge, 1000));
          },
          close: () => echt.close(),
        };
      },
    },
  });
  ck('Teil-Schreiben (höchstens 1000 Bytes je Aufruf) → die Datei bekommt trotzdem jedes Byte',
    r.ok && readFileSync(ziel).equals(PAKET) && schreibAufrufe >= MINI.bytes / 1000);
}
{
  const { r, ziel } = await ladeVon('falsch');
  ck('falscher SHA → pruefsumme', JSON.stringify(r) === '{"ok":false,"art":"pruefsumme"}');
  ck('… .teil weg, kein Ziel', !existsSync(`${ziel}.teil`) && !existsSync(ziel));
}
{
  const { r } = await ladeVon('verboten');
  ck('Storage antwortet 403 → unvollstaendig „HTTP 403“', JSON.stringify(r) === '{"ok":false,"art":"unvollstaendig","grund":"HTTP 403"}');
}
{
  const ac = new AbortController();
  const ziel = neuesZiel();
  const r = merke(await lade({ url: `${BASIS}/paket/haengt`, size: MINI.bytes, ziel, erwartet: MINI, signal: ac.signal, fortschritt: () => ac.abort() }));
  ck('Abbruch mitten im Strom → abgebrochen', JSON.stringify(r) === '{"ok":false,"art":"abgebrochen"}');
  ck('… .teil weg, kein Ziel', !existsSync(`${ziel}.teil`) && !existsSync(ziel));
}
{
  anfragen = [];
  const ziel = neuesZiel();
  const r = merke(await lade({ url: `${BASIS}/paket/ok`, size: MINI.bytes + 1, ziel, erwartet: MINI, signal: sig(), fortschritt: () => {} }));
  ck('size vom Proxy ≠ gepinnt → fehlt, ohne Download', JSON.stringify(r) === '{"ok":false,"art":"fehlt"}' && anfragen.length === 0);
}

// ── Entpacken mit eingespeistem Start (läuft überall) ──
console.log('— Entpacken (entpacke): Aufruf von tar.exe, Fehler, Abbruch (eingespeister Start)');
function falscherStart(verhalten: (k: EventEmitter) => void): {
  starte: (befehl: string, args: readonly string[]) => KindProzess;
  aufrufe: Array<{ befehl: string; args: readonly string[] }>;
  getoetet: () => number;
} {
  const aufrufe: Array<{ befehl: string; args: readonly string[] }> = [];
  let getoetet = 0;
  const starte = (befehl: string, args: readonly string[]): KindProzess => {
    aufrufe.push({ befehl, args });
    const k = new EventEmitter() as EventEmitter & { kill(): boolean };
    k.kill = () => {
      getoetet++;
      setImmediate(() => k.emit('close', null));
      return true;
    };
    setImmediate(() => verhalten(k));
    return k;
  };
  return { starte, aufrufe, getoetet: () => getoetet };
}
const WIN = { plattform: 'win32', systemRoot: 'C:\\Windows' };
{
  const f = falscherStart((k) => k.emit('close', 0));
  const ordner = join(tmp, 'aus-1');
  const r = merke(await entpacke({ zip: 'C:\\x\\paket.zip', ordner, signal: sig(), werkzeuge: { ...WIN, starte: f.starte } }));
  ck('Exit 0 → ok', r.ok);
  ck('… genau ein Aufruf: C:\\Windows\\System32\\tar.exe -xf <zip> -C <ordner>',
    f.aufrufe.length === 1 && f.aufrufe[0].befehl === 'C:\\Windows\\System32\\tar.exe'
      && JSON.stringify(f.aufrufe[0].args) === JSON.stringify(['-xf', 'C:\\x\\paket.zip', '-C', ordner]));
  ck('… Zielordner angelegt', existsSync(ordner));
}
{
  const f = falscherStart((k) => k.emit('close', 1));
  const r = merke(await entpacke({ zip: 'p.zip', ordner: join(tmp, 'aus-2'), signal: sig(), werkzeuge: { ...WIN, starte: f.starte } }));
  ck('Exit 1 → entpacken „Exit 1“', JSON.stringify(r) === '{"ok":false,"art":"entpacken","grund":"Exit 1"}');
}
{
  const f = falscherStart((k) => k.emit('error', Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' })));
  const r = merke(await entpacke({ zip: 'p.zip', ordner: join(tmp, 'aus-3'), signal: sig(), werkzeuge: { ...WIN, starte: f.starte } }));
  ck('tar.exe fehlt (error ENOENT) → entpacken „ENOENT“', JSON.stringify(r) === '{"ok":false,"art":"entpacken","grund":"ENOENT"}');
}
{
  const f = falscherStart(() => {}); // läuft, bis er getötet wird
  const ac = new AbortController();
  const lauf = entpacke({ zip: 'p.zip', ordner: join(tmp, 'aus-4'), signal: ac.signal, werkzeuge: { ...WIN, starte: f.starte } });
  setTimeout(() => ac.abort(), 20);
  const r = merke(await lauf);
  ck('Abbruch → Prozess beendet, entpacken „abgebrochen“',
    f.getoetet() === 1 && JSON.stringify(r) === '{"ok":false,"art":"entpacken","grund":"abgebrochen"}');
}
{
  const f = falscherStart((k) => k.emit('close', 0));
  const ac = new AbortController();
  ac.abort();
  const r = merke(await entpacke({ zip: 'p.zip', ordner: join(tmp, 'aus-5'), signal: ac.signal, werkzeuge: { ...WIN, starte: f.starte } }));
  ck('schon abgebrochen → entpacken „abgebrochen“, kein Start', f.aufrufe.length === 0 && !r.ok && r.art === 'entpacken' && r.grund === 'abgebrochen');
}
{
  const f = falscherStart((k) => k.emit('close', 0));
  const r = merke(await entpacke({ zip: 'p.zip', ordner: join(tmp, 'aus-6'), signal: sig(), werkzeuge: { plattform: 'linux', starte: f.starte } }));
  ck('nicht Windows → entpacken „nur Windows“, kein Start',
    f.aufrufe.length === 0 && JSON.stringify(r) === '{"ok":false,"art":"entpacken","grund":"nur Windows"}');
}
{
  const f = falscherStart((k) => k.emit('close', 0));
  const r = merke(await entpacke({ zip: 'p.zip', ordner: join(tmp, 'aus-7'), signal: sig(), werkzeuge: { plattform: 'win32', systemRoot: undefined, starte: f.starte } }));
  ck('ohne SystemRoot → entpacken „SystemRoot fehlt“, kein Start', f.aufrufe.length === 0 && !r.ok && r.art === 'entpacken' && r.grund === 'SystemRoot fehlt');
}
{
  const r = merke(await entpacke({
    zip: 'p.zip', ordner: join(tmp, 'aus-8'), signal: sig(),
    werkzeuge: { ...WIN, starte: () => { throw Object.assign(new Error('EPERM'), { code: 'EPERM' }); } },
  }));
  ck('Start wirft → entpacken mit Code', JSON.stringify(r) === '{"ok":false,"art":"entpacken","grund":"EPERM"}');
}
{
  // Echter Start, aber SystemRoot zeigt ins Leere: tar.exe fehlt wirklich. Läuft auf jeder Plattform.
  const r = merke(await entpacke({ zip: join(tmp, 'egal.zip'), ordner: join(tmp, 'aus-9'), signal: sig(), werkzeuge: { plattform: 'win32', systemRoot: join(tmp, 'kein-windows') } }));
  ck('fehlendes tar.exe (echter Start) → entpacken „ENOENT“', !r.ok && r.art === 'entpacken' && r.grund === 'ENOENT');
}

// ── Entpacken mit dem echten tar.exe (nur Windows) ──
console.log('— Entpacken mit dem echten tar.exe (nur Windows)');
if (process.platform === 'win32') {
  const quelle = join(tmp, 'tar-quelle');
  mkdirSync(join(quelle, 'language'), { recursive: true });
  writeFileSync(join(quelle, 'sdk.dll'), 'MZ-probe');
  writeFileSync(join(quelle, 'language', 'de.txt'), 'hallo');
  const zip = join(tmp, 'mini.zip');
  const tar = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe');
  const pack = spawnSync(tar, ['-a', '-cf', zip, '-C', quelle, 'sdk.dll', 'language'], { windowsHide: true });
  ck('Vorbereitung: Test-ZIP mit tar.exe -a gebaut', pack.status === 0 && existsSync(zip));
  const aus = join(tmp, 'tar-aus');
  const r = merke(await entpacke({ zip, ordner: aus, signal: sig() }));
  ck('echtes tar.exe: Erfolg, Dateien samt Unterordner da',
    r.ok && readFileSync(join(aus, 'sdk.dll'), 'utf8') === 'MZ-probe' && readFileSync(join(aus, 'language', 'de.txt'), 'utf8') === 'hallo');
  const kaputt = join(tmp, 'kaputt.zip');
  writeFileSync(kaputt, Buffer.alloc(500, 7));
  const r2 = merke(await entpacke({ zip: kaputt, ordner: join(tmp, 'tar-aus-2'), signal: sig() }));
  ck('echtes tar.exe: kaputtes ZIP → entpacken „Exit …“', !r2.ok && r2.art === 'entpacken' && r2.grund.startsWith('Exit '));
} else {
  ueberspringe('Vorbereitung: Test-ZIP mit tar.exe -a gebaut');
  ueberspringe('echtes tar.exe: Erfolg, Dateien samt Unterordner da');
  ueberspringe('echtes tar.exe: kaputtes ZIP → entpacken „Exit …“');
}

// ── Texte, Codes, Dienste ──
console.log('— Zuordnung Fehlerart → Text (Spec 5), Codes, Platz');
const ZUORDNUNG: Array<[LadeFehler, string]> = [
  [{ ok: false, art: 'schluessel' }, KT.S12],
  [{ ok: false, art: 'gedrosselt', sekunden: 125 }, KT.S13(125)],
  [{ ok: false, art: 'proxy', grund: 'ENOTFOUND' }, KT.S14('ENOTFOUND')],
  [{ ok: false, art: 'fehlt' }, KT.S15],
  [{ ok: false, art: 'unvollstaendig', grund: 'UND_ERR_SOCKET' }, KT.S16('UND_ERR_SOCKET')],
  [{ ok: false, art: 'pruefsumme' }, KT.S16b],
  [{ ok: false, art: 'entpacken', grund: 'Exit 1' }, KT.S16c('Exit 1')],
  [{ ok: false, art: 'abgebrochen' }, KT.S17],
];
for (const [f, soll] of ZUORDNUNG) ck(`${f.art} → ${soll.slice(0, 40)} …`, ladeFehlerText(f) === soll);
ck('fehlerCode: cause.code vor code vor name, sonst „unbekannt“',
  fehlerCode(Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } })) === 'ENOTFOUND'
    && fehlerCode(Object.assign(new Error('x'), { code: 'EPERM' })) === 'EPERM'
    && fehlerCode(new TypeError('x')) === 'TypeError' && fehlerCode(null) === 'unbekannt' && fehlerCode('text') === 'unbekannt');
{
  // Freier Platz ändert sich zwischen zwei Messungen (andere Prozesse schreiben): darum die Frage „wo?“ mit
  // eingespeistem statfs prüfen und die echte Messung nur auf „> 0“.
  let gefragt: string | undefined;
  const bytes = await freierPlatz(join(tmp, 'gibt', 'es', 'nicht'), {
    statfs: async (pfad) => {
      gefragt = pfad;
      return { bavail: 10, bsize: 4096 };
    },
  });
  ck('freierPlatz: gemessen am nächsten existierenden Vorfahren, bavail × bsize', gefragt === tmp && bytes === 40_960);
  ck('SDK_LADEN_DIENSTE.freierPlatz misst echt (> 0)', (await SDK_LADEN_DIENSTE.freierPlatz(join(tmp, 'gibt', 'es', 'nicht'))) > 0);
  const weg = join(tmp, 'weg');
  mkdirSync(join(weg, 'unter'), { recursive: true });
  writeFileSync(join(weg, 'unter', 'x'), 'x');
  SDK_LADEN_DIENSTE.loesche(weg);
  SDK_LADEN_DIENSTE.loesche(weg); // fehlt schon: kein Fehler
  ck('loesche: Ordner samt Inhalt weg, fehlender Ordner ist kein Fehler', !existsSync(weg));
}

// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
{
  const alles = JSON.stringify(fehlerErgebnisse);
  ck('kein Fehler-Ergebnis trägt Schlüssel, Link oder Server-Adresse',
    fehlerErgebnisse.length > 20 && !alles.includes('sdk-test') && !alles.includes('127.0.0.1') && !alles.includes('/paket/'));
}
server.closeAllConnections();
await new Promise<void>((r) => server.close(() => r()));
try {
  rmSync(tmp, { recursive: true, force: true });
} catch {
  // Windows: eine Datei ist noch offen — der Temp-Ordner bleibt liegen, der Test nicht hängen.
}
console.log(`\n${pass} ok, ${fail} fehlgeschlagen, ${skip} übersprungen.`);
process.exit(fail === 0 ? 0 : 1);
```

- [ ] **Step 2: Rot sehen**

Run: `npx tsx apps/connect/test/sdk-laden.test.ts`
Expected: Abbruch mit `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…\src\main\zoom\sdk-laden'`.

- [ ] **Step 3: Das gepinnte Paket**

Neue Datei `apps/connect/src/main/zoom/sdk-paket.ts`:

```ts
// Das eine Zoom-SDK-Paket, das diese Connect-Fassung nachladen und einrichten darf (Spec SDK nachladen 2 und 4.1).
// Werte am hochgeladenen Asset nachgemessen (06.10.2026). Wird das ZIP je neu hochgeladen, müssen sha256 und
// Größen hier mit, und es braucht einen neuen Connect-Release: Connect richtet nur ein Paket ein, das genau zu
// seinem Code passt. Die Prüfsumme kommt nie vom Proxy. Rein: keine Importe.
export const SDK_PAKET = {
  /** = SDK_FASSUNG aus @jm/zoom-bridge (test/sdk-laden.test.ts gleicht ab). */
  fassung: '7.1.5.43953',
  datei: 'zoom-sdk-win-x64-7.1.5.43953.zip',
  sha256: '596ef61956b5f336570dd3cd14b0ec9822d51e37a2a4fc03ce4f96c1974b3b4e',
  /** Exakte Größe des ZIP. */
  bytes: 150_120_193,
  /** Summe der 153 entpackten Dateien. */
  bytesEntpackt: 329_657_415,
} as const;
```

- [ ] **Step 4: `freierPlatz` exportieren**

Datei `apps/connect/src/main/zoom/laufzeit.ts` — ersetze:

```ts
/** Freier Platz am nächsten existierenden Vorfahren von `pfad` (basis gibt es vor der ersten Einrichtung nicht). */
async function freierPlatz(pfad: string, w: LaufzeitWerkzeuge): Promise<number> {
```

durch:

```ts
/**
 * Freier Platz am nächsten existierenden Vorfahren von `pfad` (basis gibt es vor der ersten Einrichtung nicht).
 * Auch für „Zoom-SDK laden“ (sdk-laden.ts), das vor der Kopie ZIP und Entpackordner braucht.
 */
export async function freierPlatz(pfad: string, w: Pick<LaufzeitWerkzeuge, 'statfs'>): Promise<number> {
```

(`richteEin` ruft `freierPlatz(pfade.basis, w)` mit dem vollen `LaufzeitWerkzeuge` auf; das passt weiter.)

- [ ] **Step 5: Das Lade-Modul**

Neue Datei `apps/connect/src/main/zoom/sdk-laden.ts`:

```ts
// Zoom-SDK nachladen (Spec 2026-10-06, Abschnitt 4.3): Link beim Proxy holen, ZIP laden und dabei SHA-256
// rechnen, mit Windows' tar.exe entpacken. Ohne Electron, rein wie laufzeit.ts: node:-Module und relative
// Importe. fetch, Uhr, Schreibziel, Prozessstart und Plattform sind einspeisbar (test/sdk-laden.test.ts).
//
// GEHEIMNISSE: Der SDK-Schlüssel geht nur in den Header X-Zoom-Sdk-Key, und nur über https (an die eigene
// Maschine auch http). Der signierte Link geht nur in fetch. Kein Ergebnis trägt einen von beiden: `grund` ist
// immer ein Code (ENOTFOUND, UND_ERR_SOCKET, „HTTP 503“, „Exit 1“) oder ein fester Text, nie eine
// Fehlermeldung (die könnte den Link zitieren).
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, renameSync, rmSync } from 'node:fs';
import { open, statfs } from 'node:fs/promises';
import { dirname, win32 } from 'node:path';
import { KT } from './klartext';
import { freierPlatz } from './laufzeit';

/**
 * Arbeitsordner unter `zoom-laufzeit` (Spec 4.3 Schritt 4). Stört die Laufzeit nicht: pruefeLaufzeit liest nur
 * `<basis>/<SDK_FASSUNG>`, und das Aufräumen in richteEin löscht nur Geschwister mit gültigem Stempel
 * (`jm-zoom-laufzeit.json` in deren Wurzel); in `laden` liegen nur das ZIP und der Unterordner `sdk`.
 */
export const LADE_ORDNER = 'laden';
/** Fortschritt höchstens 4-mal je Sekunde (Spec 4.3). */
export const FORTSCHRITT_TAKT_MS = 250;
/** Fehlt Retry-After oder ist er unbrauchbar: eine Minute. */
const WARTEN_VORGABE_S = 60;

/** Fehlerarten (Spec 4.3); die Texte dazu liefert ladeFehlerText (Spec 5). */
export type LadeFehler =
  | { ok: false; art: 'schluessel' | 'fehlt' | 'pruefsumme' | 'abgebrochen' }
  | { ok: false; art: 'gedrosselt'; sekunden: number }
  | { ok: false; art: 'proxy' | 'unvollstaendig' | 'entpacken'; grund: string };
export type LinkErgebnis = { ok: true; url: string; size: number } | LadeFehler;
export type LadeErgebnis = { ok: true } | LadeFehler;
export type EntpackErgebnis = { ok: true } | LadeFehler;

/** Ein gestarteter Kindprozess, so weit entpacke() ihn braucht. */
export interface KindProzess {
  on(ereignis: 'error', f: (e: Error) => void): unknown;
  on(ereignis: 'close', f: (code: number | null) => void): unknown;
  kill(): boolean;
}

/** Die Datei `<ziel>.teil`, so weit lade() sie braucht (FileHandle erfüllt das). */
export interface Schreibziel {
  /** Darf weniger als `laenge` Bytes schreiben; lade() schiebt den Rest nach. */
  write(daten: Uint8Array, versatz: number, laenge: number): Promise<{ bytesWritten: number }>;
  close(): Promise<void>;
}

/** Einspeisbare Werkzeuge (Tests: Netz, Uhr, Schreibziel, Prozessstart, Plattform). */
export interface LadeWerkzeuge {
  fetch: typeof fetch;
  /** Millisekunden; nur für die Drossel des Fortschritts. */
  jetzt(): number;
  /** Öffnet `<ziel>.teil` zum Schreiben (neu oder geleert). */
  oeffne(pfad: string): Promise<Schreibziel>;
  /** Startet ohne Shell, ohne Fenster, ohne Ein- und Ausgabe. */
  starte(befehl: string, args: readonly string[]): KindProzess;
  plattform: string;
  /** %SystemRoot%, z. B. C:\Windows. */
  systemRoot: string | undefined;
}

function werkzeuge(w?: Partial<LadeWerkzeuge>): LadeWerkzeuge {
  return {
    fetch: (eingabe, init) => fetch(eingabe, init),
    jetzt: () => Date.now(),
    oeffne: (pfad) => open(pfad, 'w'),
    starte: (befehl, args) => spawn(befehl, [...args], { shell: false, windowsHide: true, stdio: 'ignore' }),
    plattform: process.platform,
    systemRoot: process.env.SystemRoot,
    ...w,
  };
}

/** Ohne TLS darf der SDK-Schlüssel nur an die eigene Maschine (Test, wrangler dev). */
const EIGENE_MASCHINE = new Set(['127.0.0.1', 'localhost', '[::1]']);

/** Nur ein Code, nie die Meldung (sie könnte einen Link tragen): cause.code > code > name > „unbekannt“. */
export function fehlerCode(e: unknown): string {
  if (typeof e !== 'object' || e === null) return 'unbekannt';
  const x = e as { code?: unknown; name?: unknown; cause?: { code?: unknown } | null };
  if (typeof x.cause === 'object' && x.cause !== null && typeof x.cause.code === 'string') return x.cause.code;
  if (typeof x.code === 'string') return x.code;
  return typeof x.name === 'string' && x.name ? x.name : 'unbekannt';
}

function wartezeit(kopf: string | null): number {
  const s = Number(kopf);
  return Number.isFinite(s) && s >= 1 ? Math.ceil(s) : WARTEN_VORGABE_S;
}

/** Spec 4.3: den kurzlebigen Link beim Proxy holen. Ein Proxy-Schlüssel wird nicht gebraucht. */
export async function holeLink(e: {
  base: string;
  schluessel: string;
  fassung: string;
  signal: AbortSignal;
  werkzeuge?: Partial<LadeWerkzeuge>;
}): Promise<LinkErgebnis> {
  const w = werkzeuge(e.werkzeuge);
  let ziel: URL;
  try {
    ziel = new URL(`${e.base}/zoom-sdk/${encodeURIComponent(e.fassung)}`);
  } catch {
    return { ok: false, art: 'proxy', grund: 'Adresse ungültig' };
  }
  // Der SDK-Schlüssel geht nie im Klartext übers Netz (JMPS_PROXY_URL und die Einstellung erlauben http://).
  if (ziel.protocol !== 'https:' && !(ziel.protocol === 'http:' && EIGENE_MASCHINE.has(ziel.hostname))) {
    return { ok: false, art: 'proxy', grund: 'kein HTTPS' };
  }
  try {
    const res = await w.fetch(ziel, {
      headers: { 'X-Zoom-Sdk-Key': e.schluessel },
      signal: e.signal,
    });
    if (res.status !== 200) {
      await res.body?.cancel().catch(() => undefined);
      if (res.status === 401) return { ok: false, art: 'schluessel' };
      if (res.status === 404) return { ok: false, art: 'fehlt' };
      if (res.status === 429) return { ok: false, art: 'gedrosselt', sekunden: wartezeit(res.headers.get('Retry-After')) };
      return { ok: false, art: 'proxy', grund: `HTTP ${res.status}` };
    }
    // Netzfehler beim Lesen gehen als Code in den catch; kein JSON ist „Antwort ungültig“, kein JS-Fehlername.
    const roh = await res.text();
    let j: { url?: unknown; size?: unknown } | null = null;
    try {
      j = JSON.parse(roh) as { url?: unknown; size?: unknown } | null;
    } catch {
      j = null;
    }
    if (typeof j?.url !== 'string' || !j.url || typeof j.size !== 'number' || !Number.isSafeInteger(j.size)) {
      return { ok: false, art: 'proxy', grund: 'Antwort ungültig' };
    }
    return { ok: true, url: j.url, size: j.size };
  } catch (err) {
    return e.signal.aborted ? { ok: false, art: 'abgebrochen' } : { ok: false, art: 'proxy', grund: fehlerCode(err) };
  }
}

/**
 * Spec 4.3: streamt nach `<ziel>.teil`, rechnet SHA-256 mit und meldet den Fortschritt höchstens alle 250 ms.
 * Erst wenn Länge UND Prüfsumme stimmen, wird umbenannt. Bei Fehler oder Abbruch ist `.teil` weg. Mehr Bytes
 * als gepinnt bricht sofort ab (die Platte läuft nicht voll). `size` (vom Proxy) muss der gepinnten Größe
 * gleichen, sonst liegt dort ein anderes Paket (`fehlt`), und es wird gar nicht erst geladen.
 */
export async function lade(e: {
  url: string;
  size: number;
  ziel: string;
  erwartet: { bytes: number; sha256: string };
  signal: AbortSignal;
  fortschritt: (bytes: number) => void;
  /** Der Strom ist zu Ende, jetzt wird geprüft (Phase „pruefen“). */
  beimPruefen?: () => void;
  werkzeuge?: Partial<LadeWerkzeuge>;
}): Promise<LadeErgebnis> {
  if (e.size !== e.erwartet.bytes) return { ok: false, art: 'fehlt' };
  const w = werkzeuge(e.werkzeuge);
  const teil = `${e.ziel}.teil`;
  const offen: { datei: Schreibziel | null } = { datei: null };
  const strom = async (): Promise<LadeErgebnis> => {
    mkdirSync(dirname(teil), { recursive: true });
    const res = await w.fetch(e.url, { signal: e.signal });
    if (res.status !== 200 || res.body === null) {
      await res.body?.cancel().catch(() => undefined);
      return { ok: false, art: 'unvollstaendig', grund: `HTTP ${res.status}` };
    }
    offen.datei = await w.oeffne(teil);
    const hash = createHash('sha256');
    const leser = res.body.getReader();
    let bytes = 0;
    let zuletzt = Number.NEGATIVE_INFINITY;
    for (;;) {
      const { done, value } = await leser.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > e.erwartet.bytes) {
        await leser.cancel().catch(() => undefined);
        return { ok: false, art: 'unvollstaendig', grund: 'zu groß' };
      }
      hash.update(value);
      // Der SHA läuft über den Strom: Die Datei muss darum jedes Byte bekommen, auch bei Teil-Schreibvorgängen.
      for (let versatz = 0; versatz < value.byteLength; ) {
        const { bytesWritten } = await offen.datei.write(value, versatz, value.byteLength - versatz);
        if (bytesWritten <= 0) throw Object.assign(new Error('Schreiben ohne Fortschritt'), { code: 'EIO' });
        versatz += bytesWritten;
      }
      const t = w.jetzt();
      if (t - zuletzt >= FORTSCHRITT_TAKT_MS) {
        zuletzt = t;
        e.fortschritt(bytes);
      }
    }
    await offen.datei.close();
    offen.datei = null;
    e.beimPruefen?.();
    if (bytes !== e.erwartet.bytes) return { ok: false, art: 'unvollstaendig', grund: 'unvollständig' };
    if (hash.digest('hex') !== e.erwartet.sha256) return { ok: false, art: 'pruefsumme' };
    renameSync(teil, e.ziel);
    return { ok: true };
  };
  let erg: LadeErgebnis;
  try {
    erg = await strom();
  } catch (err) {
    erg = e.signal.aborted ? { ok: false, art: 'abgebrochen' } : { ok: false, art: 'unvollstaendig', grund: fehlerCode(err) };
  }
  if (offen.datei !== null) await offen.datei.close().catch(() => undefined);
  if (!erg.ok) {
    try {
      rmSync(teil, { force: true });
    } catch {
      // Bleibt .teil liegen, räumt der Kern den ganzen Arbeitsordner (und loggt, falls auch das scheitert).
    }
  }
  return erg;
}

/**
 * Spec 4.3: `%SystemRoot%\System32\tar.exe -xf <zip> -C <ordner>` mit absolutem Pfad, ohne Shell. Exit-Code
 * ungleich 0, fehlende tar.exe oder Abbruch → `entpacken`. bsdtar lehnt absolute Pfade und `..` ab; das ZIP ist
 * hier schon gegen den gepinnten SHA geprüft. Zoom gibt es nur unter Windows: anderswo sofort `entpacken`.
 */
export function entpacke(e: {
  zip: string;
  ordner: string;
  signal: AbortSignal;
  werkzeuge?: Partial<LadeWerkzeuge>;
}): Promise<EntpackErgebnis> {
  const w = werkzeuge(e.werkzeuge);
  const fehler = (grund: string): EntpackErgebnis => ({ ok: false, art: 'entpacken', grund });
  if (w.plattform !== 'win32') return Promise.resolve(fehler('nur Windows'));
  if (!w.systemRoot) return Promise.resolve(fehler('SystemRoot fehlt'));
  if (e.signal.aborted) return Promise.resolve(fehler('abgebrochen'));
  const tar = win32.join(w.systemRoot, 'System32', 'tar.exe');
  return new Promise<EntpackErgebnis>((resolve) => {
    let kind: KindProzess | null = null;
    let fertig = false;
    let abgebrochen = false;
    const abbrechen = (): void => {
      abgebrochen = true;
      kind?.kill();
    };
    const ende = (r: EntpackErgebnis): void => {
      if (fertig) return;
      fertig = true;
      e.signal.removeEventListener('abort', abbrechen);
      resolve(r);
    };
    try {
      mkdirSync(e.ordner, { recursive: true });
      kind = w.starte(tar, ['-xf', e.zip, '-C', e.ordner]);
    } catch (err) {
      ende(fehler(fehlerCode(err)));
      return;
    }
    e.signal.addEventListener('abort', abbrechen, { once: true });
    kind.on('error', (err) => ende(fehler(abgebrochen ? 'abgebrochen' : fehlerCode(err))));
    kind.on('close', (code) => ende(abgebrochen ? fehler('abgebrochen') : code === 0 ? { ok: true } : fehler(`Exit ${code}`)));
  });
}

/** Spec 5: Zuordnung der Fehlerarten zu den Texten. */
export function ladeFehlerText(f: LadeFehler): string {
  switch (f.art) {
    case 'schluessel':
      return KT.S12;
    case 'gedrosselt':
      return KT.S13(f.sekunden);
    case 'proxy':
      return KT.S14(f.grund);
    case 'fehlt':
      return KT.S15;
    case 'unvollstaendig':
      return KT.S16(f.grund);
    case 'pruefsumme':
      return KT.S16b;
    case 'entpacken':
      return KT.S16c(f.grund);
    case 'abgebrochen':
      return KT.S17;
  }
}

/** Was der Kern zum Laden braucht; in Tests einzeln ersetzbar (ZoomKernAbhaengigkeiten.sdkLaden). */
export interface SdkLadenDienste {
  holeLink: typeof holeLink;
  lade: typeof lade;
  entpacke: typeof entpacke;
  /** Freier Platz in Bytes am nächsten existierenden Vorfahren von `pfad`. */
  freierPlatz(pfad: string): Promise<number>;
  /** Ordner oder Datei samt Inhalt löschen; ein fehlender Pfad ist kein Fehler, alles andere wirft. */
  loesche(pfad: string): void;
}

export const SDK_LADEN_DIENSTE: SdkLadenDienste = {
  holeLink,
  lade,
  entpacke,
  freierPlatz: (pfad) => freierPlatz(pfad, { statfs: (p) => statfs(p) }),
  loesche: (pfad) => rmSync(pfad, { recursive: true, force: true }),
};
```

- [ ] **Step 6: Grün sehen**

Run: `npx tsx apps/connect/test/sdk-laden.test.ts`
Expected unter Windows: `64 ok, 0 fehlgeschlagen, 0 übersprungen.` Unter Linux (CI): `61 ok, 0 fehlgeschlagen, 3 übersprungen.`
Der Lauf dauert rund 1,5 Sekunden samt Start von `tsx`. Gemessen wurde er sechsmal hintereinander ohne Ausreißer (1,41–1,48 s).

Zum Fall „Fortschritt in mehreren Schritten“ (`meldungen.length >= 2`): Testserver und Client laufen im selben Prozess. Der Server schreibt jedes seiner zehn Stücke in einer eigenen Timer-Runde, dazwischen liest der Client. Darum kommen nie alle zehn Stücke in einem einzigen `read()` an, auch nicht auf einer langsamen CI.

- [ ] **Step 7: In die Selbsttest-Kette hängen**

Datei `apps/connect/package.json` — ersetze:

```json
tsx test/zoom-settings.test.ts && node test/after-pack.test.mjs"
```

durch:

```json
tsx test/zoom-settings.test.ts && tsx test/sdk-laden.test.ts && node test/after-pack.test.mjs"
```

- [ ] **Step 8: Alles prüfen**

Run: `npm run selftest -w @jm/connect` — Expected: Exit 0; die Kette enthält jetzt `64 ok, 0 fehlgeschlagen, 0 übersprungen.` vor `Alle after-pack-Tests bestanden.`
Run: `npm run typecheck -w @jm/connect` — Expected: Exit 0. (Achtung: `AddressInfo` kommt aus `node:net`, nicht aus `node:http`; mit `node:http` meldet `tsc` TS2305.)

- [ ] **Step 9: Commit**

```bash
git add apps/connect/src/main/zoom/sdk-paket.ts apps/connect/src/main/zoom/sdk-laden.ts apps/connect/src/main/zoom/laufzeit.ts apps/connect/test/sdk-laden.test.ts apps/connect/package.json
git status --short
git commit -m "feat(connect): Zoom-SDK-Paket gepinnt, Link holen, laden mit SHA-256, entpacken mit tar.exe" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Gegenproben (gemessen, je einzeln eingebaut, Windows):**

| Eingebauter Fehler | Ergebnis des Laufs |
| --- | --- |
| Ohne die 250-ms-Drossel (`if (true)` statt `if (t - zuletzt >= FORTSCHRITT_TAKT_MS)`) | `63 ok, 1 fehlgeschlagen`: „Uhr steht: höchstens eine Fortschrittsmeldung je 250 ms …“ |
| Ohne den sofortigen Abbruch bei Überlänge (`if (false)` statt `if (bytes > e.erwartet.bytes)`) | `62 ok, 2 fehlgeschlagen`: „Review Focus SDK-3 …“ und „… der Download hört dort auf …“ |
| Ohne die Schreibschleife (ein `write` je Stück, `bytesWritten` ungeprüft) | `63 ok, 1 fehlgeschlagen`: „Teil-Schreiben (höchstens 1000 Bytes je Aufruf) …“ |
| Ohne die https-Prüfung in `holeLink` | `63 ok, 1 fehlgeschlagen`: „Proxy-Adresse mit http:// …“ |
| `JSON.parse` ohne eigenes `catch` (wie `res.json()`) | `63 ok, 1 fehlgeschlagen`: „200 mit kaputtem JSON …“ |
| Eine Ziffer von `bytes` in `sdk-paket.ts` geändert | `63 ok, 1 fehlgeschlagen`: „Werte wörtlich wie am hochgeladenen Asset gemessen (Plan G1)“ |

---

### Task 6: `sdkWaehlen` in `pruefeUndRichteEin` teilen (ohne Verhaltensänderung)

Diese Aufgabe setzt G16 (R8) um: erst der Regressionstest auf dem unveränderten Code, dann die Teilung. Darum gibt es hier keinen roten Schritt.

**Files:**
- Test: `apps/connect/test/zoom-kern.test.ts` (Block über der ENDE-Zeile)
- Modify: `apps/connect/src/main/zoom/kern.ts:407-418` (`sdkWaehlen`)

**Interfaces:**
- Consumes: Prüfstand aus Aufgabe 4 (`baueKern`, `Probe`).
- Produces:
  - Im Kern (nicht exportiert): `async function pruefeUndRichteEin(ordner: string, herkunft: 'Ordner' | 'Laden'): Promise<ZoomErgebnis>`. Das ist die Strecke `lz.pruefeOrdner` → `kopie` → `lz.richteEin` → Einstellungen → Mängel → Zustand. Sperre, `fehler`→`schliessen` und `sdkFehler = null` bleiben beim Aufrufer. `herkunft` ändert nur die Logzeile einer Abweisung: `[zoom] SDK-Ordner abgewiesen: …` bzw. `[zoom] Geladenes Zoom-SDK abgewiesen: …`.
  - Im Test (oberste Ebene): `REG_WAHL` (gültige `SdkWahl` mit zwei Dateien) und `REG_STEMPEL` (gültiger Stempel). Aufgabe 7 nutzt beide.

- [ ] **Step 1: Den Regressionstest schreiben (pinnt das heutige Verhalten wörtlich)**

Datei `apps/connect/test/zoom-kern.test.ts` — ersetze:

```ts
// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
```

durch:

```ts
console.log('— sdkWaehlen wörtlich (Regression zur Teilung in pruefeUndRichteEin, Spec SDK nachladen 4.3 Schritt 6)');
const REG_WAHL = {
  ok: true as const, bin: 'C:/SDK/x64/bin', fassung: SDK_FASSUNG,
  dateien: [{ pfad: 'sdk.dll', bytes: 1 }, { pfad: 'a.dll', bytes: 2 }], bytesGesamt: 3,
};
const REG_STEMPEL = { format: 1 as const, sdkFassung: SDK_FASSUNG, eingerichtetAm: '2026-10-06T10:00:00.000Z', sdkDateien: [], eigeneDateien: [] };
{
  let gewaehlt: [string, string] | null = null;
  let kopieWaehrend: number | null = null;
  const p: Probe = baueKern({
    laufzeit: {
      pruefeOrdner: (g, r) => {
        gewaehlt = [g, r];
        return REG_WAHL;
      },
      richteEin: async (e) => {
        e.fortschritt({ dateien: 2, dateienGesamt: 2, bytes: 3, bytesGesamt: 3 });
        kopieWaehrend = p.kern.abbild().einrichtung.sdk.kopie?.bytes ?? null;
        return { ok: true, ordner: p.ordner, stempel: REG_STEMPEL, aufraeumFehler: null };
      },
    },
  });
  const vor = p.logs.length;
  const r = await p.kern.sdkWaehlen('C:/SDK');
  ck('Erfolg aus bereit: Logzeilen wörtlich und in dieser Reihenfolge', ok(r) && JSON.stringify(p.logs.slice(vor)) === JSON.stringify([
    '[zoom] Zoom-SDK 7.1.5.43953 wird kopiert (2 Dateien)',
    '[zoom] Zustand bereit → einrichtung',
    `[zoom] Zoom-SDK eingerichtet in ${p.ordner}`,
    '[zoom] Zustand einrichtung → bereit',
  ]));
  ck('… pruefeOrdner(ordner, ressourcen), Kopie-Fortschritt im Abbild, Laufzeit gespeichert',
    JSON.stringify(gewaehlt) === JSON.stringify(['C:/SDK', p.pfade.ressourcen]) && kopieWaehrend === 3
      && JSON.stringify(p.einst.laufzeit) === JSON.stringify({ dir: p.ordner, fassung: SDK_FASSUNG, eingerichtetAm: '2026-10-06T10:00:00.000Z' }));
  ck('… danach bereit, keine Kopie, kein Text', p.kern.kurz().zustand === 'bereit' && p.kern.abbild().einrichtung.sdk.kopie === null
    && p.kern.abbild().einrichtung.sdk.text === null);
  await p.aufraeumen();
}
{
  const p = baueKern({ laufzeit: { pruefeOrdner: () => ({ ok: false, text: KT.S1 }), richteEin: async () => ({ ok: false, text: 'darf nicht laufen' }) } });
  const vor = p.logs.length;
  const r = await p.kern.sdkWaehlen('C:/leer');
  ck('Abweisung: genau eine Logzeile, kein Zustandswechsel, keine Kopie',
    text(r) === KT.S1 && JSON.stringify(p.logs.slice(vor)) === JSON.stringify([`[zoom] SDK-Ordner abgewiesen: ${KT.S1}`])
      && p.richteEinAufrufe() === 0 && p.kern.kurz().zustand === 'bereit' && p.kern.abbild().einrichtung.sdk.text === KT.S1);
  await p.aufraeumen();
}
{
  const p = baueKern({ laufzeit: { pruefeOrdner: () => REG_WAHL, richteEin: async () => ({ ok: false, text: KT.S6('EIO') }) } });
  const vor = p.logs.length;
  const r = await p.kern.sdkWaehlen('C:/SDK');
  ck('Kopierfehler: Logzeilen wörtlich', text(r) === KT.S6('EIO') && JSON.stringify(p.logs.slice(vor)) === JSON.stringify([
    '[zoom] Zoom-SDK 7.1.5.43953 wird kopiert (2 Dateien)',
    '[zoom] Zustand bereit → einrichtung',
    `[zoom] Einrichtung des Zoom-SDK gescheitert: ${KT.S6('EIO')}`,
    '[zoom] Zustand einrichtung → bereit',
  ]));
  await p.aufraeumen();
}
{
  const p = baueKern({
    laufzeit: {
      pruefeOrdner: () => REG_WAHL,
      richteEin: async () => {
        throw Object.assign(new Error('Zugriff verweigert'), { code: 'EACCES' });
      },
    },
  });
  const r = await p.kern.sdkWaehlen('C:/SDK');
  ck('richteEin wirft: S6 mit dem Code, nicht mit der Meldung', text(r) === KT.S6('EACCES')
    && p.logs.includes(`[zoom] Einrichtung des Zoom-SDK gescheitert: ${KT.S6('EACCES')}`) && p.kern.kurz().zustand === 'bereit');
  await p.aufraeumen();
}
{
  let lzStand: LaufzeitPruefung = { ok: false, mangel: 'sdk_fehlt' };
  const p: Probe = baueKern({
    laufzeit: {
      pruefe: () => lzStand,
      pruefeOrdner: () => REG_WAHL,
      richteEin: async () => {
        lzStand = { ok: true, ordner: p.ordner, ersetzt: [] };
        return { ok: true, ordner: p.ordner, stempel: REG_STEMPEL, aufraeumFehler: 'EBUSY' };
      },
    },
  });
  const vor = p.logs.length;
  const r = await p.kern.sdkWaehlen('C:/SDK');
  ck('aus einrichtung mit Aufräumfehler: Logzeilen wörtlich', ok(r) && JSON.stringify(p.logs.slice(vor)) === JSON.stringify([
    '[zoom] Zoom-SDK 7.1.5.43953 wird kopiert (2 Dateien)',
    `[zoom] Zoom-SDK eingerichtet in ${p.ordner}`,
    '[zoom] Aufräumen nach der Einrichtung unvollständig (EBUSY)',
    '[zoom] Zustand einrichtung → bereit',
  ]));
  await p.aufraeumen();
}

// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
```

- [ ] **Step 2: Grün auf dem UNVERÄNDERTEN Code sehen**

Run: `npx tsx apps/connect/test/zoom-kern.test.ts`
Expected: `337 ok, 0 fehlgeschlagen, 0 übersprungen.` Ein Regressionstest muss vor der Teilung grün sein; ist er hier rot, stimmt der Test nicht, und die Teilung beginnt nicht. Die Logzeilen im Test wurden am heutigen Code gemessen.

- [ ] **Step 3: Teilen**

Datei `apps/connect/src/main/zoom/kern.ts` — ersetze:

```ts
  async function sdkWaehlen(ordner: string): Promise<ZoomErgebnis> {
    const sperre = einrichtungSperre();
    if (!sperre.ok) return sperre;
    if (zustand === 'fehler') schliessen();
    sdkFehler = null;
    const wahl = lz.pruefeOrdner(ordner, d.pfade.ressourcen);
    if (!wahl.ok) {
      sdkFehler = wahl.text;
      d.log(`[zoom] SDK-Ordner abgewiesen: ${wahl.text}`);
      abbildGeaendert();
      return { ok: false, text: wahl.text };
    }
```

durch:

```ts
  async function sdkWaehlen(ordner: string): Promise<ZoomErgebnis> {
    const sperre = einrichtungSperre();
    if (!sperre.ok) return sperre;
    if (zustand === 'fehler') schliessen();
    sdkFehler = null;
    return pruefeUndRichteEin(ordner, 'Ordner');
  }

  /**
   * Gemeinsame Strecke von „SDK-Ordner wählen“ und „Zoom-SDK laden“ (Spec SDK nachladen 4.3 Schritt 6): Ordner
   * prüfen, kopieren mit dem `kopie`-Fortschritt, Einstellungen, Mängel, Zustand. Sperre, fehler→schliessen und
   * `sdkFehler = null` stehen bei den Aufrufern. `herkunft` ändert nur die Logzeile einer Abweisung.
   */
  async function pruefeUndRichteEin(ordner: string, herkunft: 'Ordner' | 'Laden'): Promise<ZoomErgebnis> {
    const wahl = lz.pruefeOrdner(ordner, d.pfade.ressourcen);
    if (!wahl.ok) {
      sdkFehler = wahl.text;
      d.log(herkunft === 'Ordner' ? `[zoom] SDK-Ordner abgewiesen: ${wahl.text}` : `[zoom] Geladenes Zoom-SDK abgewiesen: ${wahl.text}`);
      abbildGeaendert();
      return { ok: false, text: wahl.text };
    }
```

Der Rest des alten Rumpfs (ab `const abbruch = new AbortController();` bis `return erg.ok ? { ok: true } : { ok: false, text: erg.text };` und der schließenden Klammer) bleibt Zeichen für Zeichen stehen und ist jetzt der Rumpf von `pruefeUndRichteEin`.

- [ ] **Step 4: Weiter grün**

Run: `npx tsx apps/connect/test/zoom-kern.test.ts` — Expected: `337 ok, 0 fehlgeschlagen, 0 übersprungen.`

- [ ] **Step 5: Alles prüfen**

Run: `npm run selftest -w @jm/connect` — Expected: Exit 0.
Run: `npm run typecheck -w @jm/connect` — Expected: Exit 0.

- [ ] **Step 6: Commit**

```bash
git add apps/connect/src/main/zoom/kern.ts apps/connect/test/zoom-kern.test.ts
git status --short
git commit -m "refactor(connect): sdkWaehlen in pruefeUndRichteEin geteilt, Verhalten per Regressionstest gepinnt" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Gegenprobe (gemessen):** Ändert man die Logzeile der Abweisung um ein Wort („abgelehnt“ statt „abgewiesen“), endet der Lauf mit `336 ok, 1 fehlgeschlagen`; rot wird „Abweisung: genau eine Logzeile, kein Zustandswechsel, keine Kopie“.

---

### Task 7: `sdkLaden` im Kern (Phasen, Abbruch, Beenden, Sperre, Abbild) und über IPC

**Files:**
- Modify: `apps/connect/src/main/zoom/kern.ts` (Importe :58-71, Abhängigkeiten :121-123, `ZoomKern` :134, Konstanten :164, `lz` :190, Zustand :208, `kurz()` :297, `abbild()` :313, `einrichtungSperre` :402-405, neue Funktionen vor `zugangWaehlen`, `laeuft()` :543, `beenden` :1174-1182, Rückgabeobjekt)
- Modify: `apps/connect/src/shared/types.ts` (`ZoomKurz.kopieLaeuft` :171, `einrichtung.sdk` :180, `JmConnectApi` :251)
- Modify: `apps/connect/src/shared/ipc.ts` (nach `zoomSdkWaehlen` :48)
- Modify: `apps/connect/src/preload/index.ts` (nach `zoomSdkWaehlen` :76)
- Modify: `apps/connect/src/main/zoom.ts` (Import `proxyUrl`, `erzeugeZoomKern`, Kanäle nach `zoomSdkWaehlen`)
- Test: `apps/connect/test/zoom-kern.test.ts` (Importe, `BaueOptionen`, `erzeugeZoomKern`-Aufruf in `baueKern`, Block über der ENDE-Zeile)
- Test: `apps/connect/test/zoom-text.test.ts` (Testhilfe `abbild()` und Fall Z1b: Feld `laden`)

**Interfaces:**
- Consumes (Aufgabe 5): `SDK_PAKET`, `LADE_ORDNER`, `SdkLadenDienste`, `SDK_LADEN_DIENSTE`, `LadeFehler`, `ladeFehlerText`, `fehlerCode`. (Aufgabe 6): `pruefeUndRichteEin(ordner, 'Laden')`, im Test `REG_WAHL` und `REG_STEMPEL`. (Aufgabe 4): `d.sdkSchluessel.lesen()`, `BaueOptionen.sdkSchluessel`. Aus `laufzeit.ts`: `PLATZ_RESERVE_BYTES`. Aus `settings.ts`: `proxyUrl()`.
- Produces:
  - `ZoomKernAbhaengigkeiten.proxyUrl(): string` (Pflicht) und `ZoomKernAbhaengigkeiten.sdkLaden?: Partial<SdkLadenDienste>`.
  - `ZoomKern.sdkLaden(): Promise<ZoomErgebnis>` und `ZoomKern.sdkLadenAbbrechen(): void`.
  - `ZoomAbbild.einrichtung.sdk.laden: { phase: 'link' | 'download' | 'pruefen' | 'entpacken'; bytes: number; bytesGesamt: number } | null` (Pflichtfeld). `ZoomKurz.kopieLaeuft` ist jetzt „Kopie ODER Laden läuft“ (Z1b).
  - IPC `IPC.zoomSdkLaden = 'jmc:zoom-sdk-laden'`, `IPC.zoomSdkLadenAbbrechen = 'jmc:zoom-sdk-laden-abbrechen'`; `JmConnectApi.zoomSdkLaden(): Promise<ZoomErgebnis>`, `JmConnectApi.zoomSdkLadenAbbrechen(): Promise<void>` (Aufgabe 9 ruft sie).
  - Logzeilen (wörtlich): `[zoom] Zoom-SDK wird geladen (143 MB)` · `[zoom] SDK-Link angefragt bei <host>` · `[zoom] Zoom-SDK geladen und geprüft` · `[zoom] Laden des Zoom-SDK gescheitert: <Text>` · `[zoom] Laden des Zoom-SDK abgebrochen` · `[zoom] Zoom-SDK laden abgewiesen: <S11>` · `[zoom] Aufräumen nach dem Laden unvollständig (<Code>)` · `[zoom] Laden des Zoom-SDK nicht rechtzeitig abgebrochen` · `[zoom] Geladenes Zoom-SDK abgewiesen: <Text>`. „Laden des Zoom-SDK gescheitert“ steht nach JEDEM gescheiterten Laden, auch nach einer Abweisung durch `pruefeOrdner` oder einem Kopierfehler (A8).
- Hinweis zum Namen: Der Kern hat schon eine Funktion `laden(e)` (eine Zoom-Person als NDI-Quelle laden). Der neue Zustand heißt darum `ladung`; nur das Abbild-Feld heißt wie in der Spec `laden`.

- [ ] **Step 1: Prüfstand erweitern**

Datei `apps/connect/test/zoom-kern.test.ts` — ersetze:

```ts
} from '../src/main/zoom/laufzeit';
```

durch:

```ts
} from '../src/main/zoom/laufzeit';
import type { SdkLadenDienste } from '../src/main/zoom/sdk-laden';
import { SDK_PAKET } from '../src/main/zoom/sdk-paket';
```

Dann ersetze:

```ts
  sdkSchluesselLiefert?: 'stored' | 'session';
}
```

durch:

```ts
  sdkSchluesselLiefert?: 'stored' | 'session';
  /** Dienste für „Zoom-SDK laden“ (Attrappen); ohne Angabe die echten aus sdk-laden.ts gegen https://proxy.test. */
  sdkLaden?: Partial<SdkLadenDienste>;
}
```

Dann ersetze (im `erzeugeZoomKern`-Aufruf von `baueKern`):

```ts
    laufzeit,
    env: o.env,
```

durch:

```ts
    laufzeit,
    proxyUrl: () => 'https://proxy.test',
    sdkLaden: o.sdkLaden,
    env: o.env,
```

- [ ] **Step 2: Die Kern-Tests schreiben**

Datei `apps/connect/test/zoom-kern.test.ts` — ersetze:

```ts
// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
```

durch:

```ts
console.log('— Zoom-SDK laden (Spec SDK nachladen 4.3, 4.4; Tests 6 Kern; Review Focus SDK-1, SDK-2, SDK-5)');
const LADE_MIB = 1024 * 1024;
const LINK = 'https://signed.test/zoom-77?sig=geheim-link';
const SCHLUESSEL: { wert: string; herkunft: 'stored' } = { wert: 'sdk-geheim-test', herkunft: 'stored' };
/** Attrappen für das Laden: alles klappt, einzelne Schritte überschreibbar. */
function ladeDienste(o: Partial<SdkLadenDienste> = {}): Partial<SdkLadenDienste> {
  return {
    freierPlatz: async () => 10 * 1024 * LADE_MIB,
    holeLink: async () => ({ ok: true, url: LINK, size: SDK_PAKET.bytes }),
    lade: async (e) => {
      mkdirSync(dirname(e.ziel), { recursive: true });
      writeFileSync(e.ziel, 'zip');
      e.fortschritt(SDK_PAKET.bytes);
      e.beimPruefen?.();
      return { ok: true };
    },
    entpacke: async (e) => {
      mkdirSync(e.ordner, { recursive: true });
      writeFileSync(join(e.ordner, 'sdk.dll'), 'MZ');
      return { ok: true };
    },
    ...o,
  };
}
const arbeitsordner = (p: Probe): string => join(p.pfade.basis, 'laden');
/** Phase und Bytes des Ladens | Zeile Z… | Sperre | laeuft() — für die Phasenfolge. */
function ladeStand(p: Probe): string {
  const l = p.kern.abbild().einrichtung.sdk.laden;
  return `${l ? `${l.phase}:${l.bytes}` : 'kein-laden'}|${zoomZ(p.kern.kurz())}|${text(p.kern.einrichtungSperre()) === KT.S10 ? 'S10' : 'frei'}|${p.kern.laeuft() ? 'laeuft' : 'ruht'}`;
}
{
  let lzStand: LaufzeitPruefung = { ok: false, mangel: 'sdk_fehlt' };
  const gesehen: string[] = [];
  let linkEingabe: Parameters<SdkLadenDienste['holeLink']>[0] | undefined;
  let ladeEingabe: Parameters<SdkLadenDienste['lade']>[0] | undefined;
  let entpackEingabe: Parameters<SdkLadenDienste['entpacke']>[0] | undefined;
  let gewaehlt: string | undefined;
  let platzPfad: string | undefined;
  let resteBeimPlatz: boolean | undefined;
  let resteBeimLink: boolean | undefined;
  const p: Probe = baueKern({
    sdkSchluessel: SCHLUESSEL,
    laufzeit: {
      pruefe: () => lzStand,
      pruefeOrdner: (g) => {
        gewaehlt = g;
        return { ok: true, bin: g, fassung: SDK_FASSUNG, dateien: [{ pfad: 'sdk.dll', bytes: 2 }], bytesGesamt: 2 };
      },
      richteEin: async (e) => {
        e.fortschritt({ dateien: 1, dateienGesamt: 1, bytes: 2, bytesGesamt: 2 });
        gesehen.push(`kopie ${ladeStand(p)} kopie=${p.kern.abbild().einrichtung.sdk.kopie?.bytes}`);
        lzStand = { ok: true, ordner: p.ordner, ersetzt: [] };
        return { ok: true, ordner: p.ordner, stempel: REG_STEMPEL, aufraeumFehler: null };
      },
    },
    sdkLaden: ladeDienste({
      freierPlatz: async (pfad) => {
        platzPfad = pfad;
        resteBeimPlatz = existsSync(arbeitsordner(p));
        return 10 * 1024 * LADE_MIB;
      },
      holeLink: async (e) => {
        linkEingabe = e;
        resteBeimLink = existsSync(arbeitsordner(p));
        gesehen.push(`link ${ladeStand(p)}`);
        return { ok: true, url: LINK, size: SDK_PAKET.bytes };
      },
      lade: async (e) => {
        ladeEingabe = e;
        mkdirSync(dirname(e.ziel), { recursive: true });
        writeFileSync(e.ziel, 'zip');
        e.fortschritt(63 * LADE_MIB);
        gesehen.push(`download ${ladeStand(p)}`);
        e.beimPruefen?.();
        gesehen.push(`pruefen ${ladeStand(p)}`);
        return { ok: true };
      },
      entpacke: async (e) => {
        entpackEingabe = e;
        gesehen.push(`entpacken ${ladeStand(p)}`);
        mkdirSync(e.ordner, { recursive: true });
        writeFileSync(join(e.ordner, 'sdk.dll'), 'MZ');
        return { ok: true };
      },
    }),
  });
  // Review Focus SDK-5: Reste eines abgebrochenen früheren Laufs liegen im Arbeitsordner.
  mkdirSync(join(arbeitsordner(p), 'sdk'), { recursive: true });
  writeFileSync(join(arbeitsordner(p), `${SDK_PAKET.datei}.teil`), 'alt');
  writeFileSync(join(arbeitsordner(p), 'sdk', 'alt.dll'), 'alt');
  const vor = p.logs.length;
  const r = await p.kern.sdkLaden();
  ck('Erfolg → ok, bereit, keine Mängel, nichts läuft mehr',
    ok(r) && p.kern.kurz().zustand === 'bereit' && p.kern.kurz().maengel.length === 0 && !p.kern.laeuft());
  ck('… Phasen link → download → pruefen → entpacken, danach die Kopie (laden dann null), überall Z1b und S10',
    JSON.stringify(gesehen) === JSON.stringify([
      'link link:0|Z1b|S10|laeuft',
      `download download:${63 * LADE_MIB}|Z1b|S10|laeuft`,
      `pruefen pruefen:${63 * LADE_MIB}|Z1b|S10|laeuft`,
      `entpacken entpacken:${63 * LADE_MIB}|Z1b|S10|laeuft`,
      'kopie kein-laden|Z1b|S10|laeuft kopie=2',
    ]));
  ck('Review Focus SDK-5: Reste des früheren Laufs waren schon vor der Platzmessung weg (A12), erst recht vor dem Link',
    resteBeimPlatz === false && resteBeimLink === false);
  ck('… Link: Proxy-Adresse, SDK-Schlüssel, gepinnte Fassung',
    linkEingabe?.base === 'https://proxy.test' && linkEingabe?.schluessel === 'sdk-geheim-test' && linkEingabe?.fassung === SDK_FASSUNG);
  ck('… Download: Link und Größe vom Proxy, ZIP im Arbeitsordner, erwartet = SDK_PAKET',
    ladeEingabe?.url === LINK && ladeEingabe?.size === SDK_PAKET.bytes && ladeEingabe?.ziel === join(arbeitsordner(p), SDK_PAKET.datei)
      && ladeEingabe?.erwartet.sha256 === SDK_PAKET.sha256 && ladeEingabe?.erwartet.bytes === SDK_PAKET.bytes);
  ck('… Entpacken nach laden/sdk, derselbe Ordner geht in pruefeOrdner',
    entpackEingabe?.zip === join(arbeitsordner(p), SDK_PAKET.datei) && entpackEingabe?.ordner === join(arbeitsordner(p), 'sdk')
      && gewaehlt === join(arbeitsordner(p), 'sdk'));
  ck('… Platz am Laufzeit-Ordner gemessen', platzPfad === p.pfade.basis);
  ck('… ZIP und Entpackordner danach weg', !existsSync(arbeitsordner(p)));
  const sdk = p.kern.abbild().einrichtung.sdk;
  ck('… Laufzeit in den Einstellungen, Abbild ohne laden, kopie und Text',
    p.einst.laufzeit?.dir === p.ordner && sdk.laden === null && sdk.kopie === null && sdk.text === null);
  ck('… Logzeilen wörtlich', JSON.stringify(p.logs.slice(vor)) === JSON.stringify([
    '[zoom] Zoom-SDK wird geladen (143 MB)',
    '[zoom] SDK-Link angefragt bei proxy.test',
    '[zoom] Zoom-SDK geladen und geprüft',
    '[zoom] Zoom-SDK 7.1.5.43953 wird kopiert (1 Dateien)',
    `[zoom] Zoom-SDK eingerichtet in ${p.ordner}`,
    '[zoom] Zustand einrichtung → bereit',
  ]));
  const alles = p.logs.join('\n') + JSON.stringify(p.kern.abbild()) + JSON.stringify(p.abbilder);
  ck('… weder SDK-Schlüssel noch Link in Log oder Abbild', !alles.includes('sdk-geheim') && !alles.includes('signed.test') && !alles.includes('geheim-link'));
  await p.aufraeumen();
}
const LADE_FEHLER: Array<[string, Partial<SdkLadenDienste>, string]> = [
  ['Schlüssel abgelehnt', { holeLink: async () => ({ ok: false, art: 'schluessel' }) }, KT.S12],
  ['gedrosselt 125 s', { holeLink: async () => ({ ok: false, art: 'gedrosselt', sekunden: 125 }) }, KT.S13(125)],
  ['Proxy nicht erreichbar', { holeLink: async () => ({ ok: false, art: 'proxy', grund: 'ENOTFOUND' }) }, KT.S14('ENOTFOUND')],
  ['kein passendes Paket auf dem Proxy', { holeLink: async () => ({ ok: false, art: 'fehlt' }) }, KT.S15],
  ['Download abgerissen', { lade: async () => ({ ok: false, art: 'unvollstaendig', grund: 'UND_ERR_SOCKET' }) }, KT.S16('UND_ERR_SOCKET')],
  ['Prüfsumme falsch', { lade: async () => ({ ok: false, art: 'pruefsumme' }) }, KT.S16b],
  ['Entpacken gescheitert', {
    entpacke: async (e) => {
      mkdirSync(e.ordner, { recursive: true });
      writeFileSync(join(e.ordner, 'halb.dll'), 'x');
      return { ok: false, art: 'entpacken', grund: 'Exit 1' };
    },
  }, KT.S16c('Exit 1')],
  ['Ausnahme in einem Dienst', {
    holeLink: async () => {
      throw Object.assign(new Error('E/A'), { code: 'EIO' });
    },
  }, KT.S16('EIO')],
];
for (const [name, dienste, soll] of LADE_FEHLER) {
  const p = baueKern({
    sdkSchluessel: SCHLUESSEL,
    laufzeit: {
      pruefeOrdner: () => {
        throw new Error('pruefeOrdner darf nicht laufen');
      },
      richteEin: async () => ({ ok: false, text: 'richteEin darf nicht laufen' }),
    },
    sdkLaden: ladeDienste(dienste),
  });
  const r = await p.kern.sdkLaden();
  const sdk = p.kern.abbild().einrichtung.sdk;
  ck(`${name} → Text wörtlich, im Abbild, im Log`, text(r) === soll && sdk.text === soll
    && p.logs.includes(`[zoom] Laden des Zoom-SDK gescheitert: ${soll}`));
  ck('… bisherige Einrichtung unverändert: bereit, keine Kopie, keine Einstellung, Arbeitsordner weg, nichts läuft',
    p.kern.kurz().zustand === 'bereit' && p.richteEinAufrufe() === 0 && p.einst.laufzeit === null && sdk.laden === null
      && !existsSync(arbeitsordner(p)) && !p.kern.laeuft() && !p.kern.kurz().kopieLaeuft);
  await p.aufraeumen();
}
{
  let linkGefragt = false;
  const bedarf = SDK_PAKET.bytes + 2 * SDK_PAKET.bytesEntpackt + 100 * LADE_MIB;
  let frei = bedarf - 1;
  const p = baueKern({
    sdkSchluessel: SCHLUESSEL,
    sdkLaden: ladeDienste({
      freierPlatz: async () => frei,
      holeLink: async () => {
        linkGefragt = true;
        return { ok: false, art: 'fehlt' };
      },
    }),
  });
  const r = await p.kern.sdkLaden();
  ck('Platzmangel (1 Byte zu wenig) → S5 mit ZIP + 2 × entpackt + 100 MB (gebraucht 872 MB, frei 871 MB)',
    text(r) === KT.S5(872, 871) && p.kern.abbild().einrichtung.sdk.text === KT.S5(872, 871));
  ck('… kein Link angefragt, Zustand bereit, nichts angelegt', !linkGefragt && p.kern.kurz().zustand === 'bereit' && !existsSync(arbeitsordner(p)));
  frei = bedarf;
  await p.kern.sdkLaden();
  ck('… genau genug Platz → es geht weiter zum Link', linkGefragt);
  await p.aufraeumen();
}
{
  let linkGefragt = false;
  const p = baueKern({
    sdkLaden: ladeDienste({
      holeLink: async () => {
        linkGefragt = true;
        return { ok: false, art: 'fehlt' };
      },
    }),
  });
  const vor = p.logs.length;
  const r = await p.kern.sdkLaden();
  ck('ohne SDK-Schlüssel → S11, kein Link, Zustand bleibt, kein Text im Abbild',
    text(r) === KT.S11 && !linkGefragt && p.kern.kurz().zustand === 'bereit' && p.kern.abbild().einrichtung.sdk.text === null);
  ck('… Log: nur die Abweisung', JSON.stringify(p.logs.slice(vor)) === JSON.stringify(['[zoom] Zoom-SDK laden abgewiesen: ' + KT.S11]));
  await p.aufraeumen();
}
{
  const p = baueKern({
    sdkSchluessel: SCHLUESSEL,
    sdkLaden: ladeDienste({
      holeLink: async () => {
        throw new Error('holeLink darf nicht laufen');
      },
    }),
  });
  ck('Vorbereitung: im Meeting', await insMeeting(p));
  ck('im Meeting → S10, nichts geladen', text(await p.kern.sdkLaden()) === KT.S10 && p.kern.abbild().einrichtung.sdk.laden === null
    && p.kern.kurz().zustand === 'im_meeting');
  await p.aufraeumen();
}
{
  let linkAufrufe = 0;
  const p = baueKern({
    sdkSchluessel: SCHLUESSEL,
    sdkLaden: ladeDienste({
      holeLink: (e) => {
        linkAufrufe++;
        return new Promise((resolve) => e.signal.addEventListener('abort', () => resolve({ ok: false, art: 'abgebrochen' }), { once: true }));
      },
    }),
  });
  const lauf = p.kern.sdkLaden();
  ck('während des Ladens: Z1b, laeuft(), Sperre S10',
    (await bis(() => linkAufrufe === 1)) && zoomZ(p.kern.kurz()) === 'Z1b' && p.kern.laeuft() && text(p.kern.einrichtungSperre()) === KT.S10);
  const zweit = await Promise.race([p.kern.sdkLaden(), warte(1000).then((): ZoomErgebnis => ({ ok: false, text: '(keine Antwort)' }))]);
  ck('Review Focus SDK-1: zweiter Klick auf „Zoom-SDK laden“ → S10, der Link wird nur einmal angefragt',
    text(zweit) === KT.S10 && linkAufrufe === 1);
  ck('… SDK-Ordner wählen, Zugangsdaten entfernen und SDK-Schlüssel eintragen ebenfalls S10',
    text(await p.kern.sdkWaehlen('C:/SDK')) === KT.S10 && text(p.kern.zugangLoeschen()) === KT.S10
      && text(p.kern.sdkSchluesselEintragen({ schluessel: 'sdk-test' })) === KT.S10);
  p.kern.sdkLadenAbbrechen();
  const r = await lauf;
  ck('Abbrechen → S17, als Text im Abbild', text(r) === KT.S17 && p.kern.abbild().einrichtung.sdk.text === KT.S17);
  ck('… Log „abgebrochen“, kein „gescheitert“',
    p.logs.includes('[zoom] Laden des Zoom-SDK abgebrochen') && !p.logs.some((z) => z.includes('Laden des Zoom-SDK gescheitert')));
  ck('… Zustand zurück auf bereit, Arbeitsordner weg, nichts läuft',
    p.kern.kurz().zustand === 'bereit' && !existsSync(arbeitsordner(p)) && !p.kern.laeuft() && p.kern.abbild().einrichtung.sdk.laden === null);
  await p.aufraeumen();
}
{
  let freigabe: (e: EinrichtungsErgebnis) => void = () => {};
  let linkGefragt = false;
  const p = baueKern({
    sdkSchluessel: SCHLUESSEL,
    laufzeit: {
      pruefeOrdner: () => REG_WAHL,
      richteEin: () => new Promise<EinrichtungsErgebnis>((resolve) => {
        freigabe = resolve;
      }),
    },
    sdkLaden: ladeDienste({
      holeLink: async () => {
        linkGefragt = true;
        return { ok: false, art: 'fehlt' };
      },
    }),
  });
  const wahl = p.kern.sdkWaehlen('C:/SDK');
  ck('während der Kopie aus „SDK-Ordner wählen …“: „Zoom-SDK laden“ → S10, kein Link, kein Laden im Abbild',
    (await bis(() => p.kern.kurz().kopieLaeuft)) && text(await p.kern.sdkLaden()) === KT.S10 && !linkGefragt
      && p.kern.abbild().einrichtung.sdk.laden === null);
  freigabe({ ok: false, text: KT.S6('EIO') });
  await wahl;
  await p.aufraeumen();
}
{
  let entpackLaeuft = false;
  const p = baueKern({
    sdkSchluessel: SCHLUESSEL,
    laufzeit: { richteEin: async () => ({ ok: false, text: 'richteEin darf nicht laufen' }) },
    sdkLaden: ladeDienste({
      entpacke: (e) => {
        entpackLaeuft = true;
        return new Promise((resolve) =>
          e.signal.addEventListener('abort', () => resolve({ ok: false, art: 'entpacken', grund: 'abgebrochen' }), { once: true }));
      },
    }),
  });
  const lauf = p.kern.sdkLaden();
  ck('Vorbereitung: Entpacken läuft', (await bis(() => entpackLaeuft)) && p.kern.abbild().einrichtung.sdk.laden?.phase === 'entpacken');
  p.kern.sdkLadenAbbrechen();
  ck('Abbrechen beim Entpacken → S17 (nicht S16c), keine Kopie', text(await lauf) === KT.S17 && p.richteEinAufrufe() === 0);
  await p.aufraeumen();
}
{
  let signal: AbortSignal | undefined;
  let freigabe: (e: EinrichtungsErgebnis) => void = () => {};
  const p = baueKern({
    sdkSchluessel: SCHLUESSEL,
    laufzeit: {
      pruefeOrdner: () => REG_WAHL,
      richteEin: (e) => {
        signal = e.signal;
        return new Promise<EinrichtungsErgebnis>((resolve) => {
          freigabe = resolve;
        });
      },
    },
    sdkLaden: ladeDienste(),
  });
  const lauf = p.kern.sdkLaden();
  ck('Vorbereitung: nach dem Laden läuft die Kopie',
    (await bis(() => signal !== undefined)) && p.kern.abbild().einrichtung.sdk.laden === null && p.kern.kurz().kopieLaeuft);
  p.kern.sdkLadenAbbrechen();
  ck('„Abbrechen“ während der Kopie greift nicht mehr (Spec 4.3)', signal?.aborted === false);
  freigabe({ ok: false, text: KT.S6('EIO') });
  const r = await lauf;
  ck('… Kopierfehler danach: S6 im Abbild und in „Laden … gescheitert“, bereit, Arbeitsordner weg',
    text(r) === KT.S6('EIO') && p.kern.abbild().einrichtung.sdk.text === KT.S6('EIO') && p.kern.kurz().zustand === 'bereit'
      && p.logs.includes(`[zoom] Laden des Zoom-SDK gescheitert: ${KT.S6('EIO')}`) && !existsSync(arbeitsordner(p)));
  await p.aufraeumen();
}
{
  const p = baueKern({ sdkSchluessel: SCHLUESSEL, laufzeit: { pruefeOrdner: () => ({ ok: false, text: KT.S4('vcruntime140.dll') }) }, sdkLaden: ladeDienste() });
  const r = await p.kern.sdkLaden();
  ck('geladenes Paket von pruefeOrdner abgewiesen → Text, eigene Logzeile und „Laden … gescheitert“, bereit, Arbeitsordner weg',
    text(r) === KT.S4('vcruntime140.dll') && p.logs.includes(`[zoom] Geladenes Zoom-SDK abgewiesen: ${KT.S4('vcruntime140.dll')}`)
      && p.logs.includes(`[zoom] Laden des Zoom-SDK gescheitert: ${KT.S4('vcruntime140.dll')}`)
      && p.kern.kurz().zustand === 'bereit' && !p.kern.kurz().kopieLaeuft && !existsSync(arbeitsordner(p)));
  await p.aufraeumen();
}
{
  let loeschAufrufe = 0;
  const p: Probe = baueKern({
    sdkSchluessel: SCHLUESSEL,
    laufzeit: {
      pruefeOrdner: () => REG_WAHL,
      richteEin: async () => ({ ok: true, ordner: p.ordner, stempel: REG_STEMPEL, aufraeumFehler: null }),
    },
    sdkLaden: ladeDienste({
      loesche: (pfad) => {
        loeschAufrufe++;
        if (loeschAufrufe === 2) throw Object.assign(new Error('belegt'), { code: 'EBUSY' });
        rmSync(pfad, { recursive: true, force: true });
      },
    }),
  });
  const r = await p.kern.sdkLaden();
  ck('Aufräumfehler am Ende → trotzdem ok, nur geloggt', ok(r) && loeschAufrufe === 2
    && p.logs.includes('[zoom] Aufräumen nach dem Laden unvollständig (EBUSY)'));
  await p.aufraeumen();
}
{
  let linkLaeuft = false;
  const p = baueKern({
    sdkSchluessel: SCHLUESSEL,
    sdkLaden: ladeDienste({
      holeLink: (e) => {
        linkLaeuft = true;
        return new Promise((resolve) =>
          e.signal.addEventListener('abort', () => setTimeout(() => resolve({ ok: false, art: 'abgebrochen' }), 150), { once: true }));
      },
    }),
  });
  const lauf = p.kern.sdkLaden();
  ck('Vorbereitung: das Laden hängt am Link', await bis(() => linkLaeuft));
  mkdirSync(arbeitsordner(p), { recursive: true });
  writeFileSync(join(arbeitsordner(p), `${SDK_PAKET.datei}.teil`), 'halb');
  const t0 = Date.now();
  await p.kern.beenden(2000);
  ck('Review Focus SDK-2: beenden bricht ab und wartet, bis das Laden aufgeräumt hat',
    Date.now() - t0 >= 100 && !existsSync(arbeitsordner(p)) && !p.logs.some((z) => z.includes('nicht rechtzeitig')));
  ck('… das Laden endet mit S17', text(await lauf) === KT.S17);
  await p.aufraeumen();
}
{
  let freigabe: () => void = () => {};
  const p = baueKern({
    sdkSchluessel: SCHLUESSEL,
    sdkLaden: ladeDienste({
      holeLink: () => new Promise((resolve) => {
        freigabe = () => resolve({ ok: false, art: 'abgebrochen' });
      }),
    }),
  });
  const lauf = p.kern.sdkLaden();
  // Hält die Ereignisschleife wach: mitFrist nutzt einen unref-Zeitgeber, und sonst wartet hier nichts.
  const spaeter = setTimeout(() => freigabe(), 2000);
  await warte(50);
  await p.kern.beenden(300);
  ck('beenden mit Frist: hört das Laden den Abbruch nicht, steht es nach der Frist im Log',
    p.logs.includes('[zoom] Laden des Zoom-SDK nicht rechtzeitig abgebrochen'));
  clearTimeout(spaeter);
  freigabe();
  await lauf;
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_AUTH_CODE: '2' }), sdkSchluessel: SCHLUESSEL, sdkLaden: ladeDienste({ holeLink: async () => ({ ok: false, art: 'fehlt' }) }) });
  await p.kern.beitreten({ nummer: NUMMER, kenncode: KENNCODE, anzeigename: 'JM Connect' });
  ck('Vorbereitung: Zustand fehler (B9)', p.kern.kurz().zustand === 'fehler');
  const r = await p.kern.sdkLaden();
  ck('im Zustand fehler: zuerst schließen, dann laden → S15, bereit, Meldung weg',
    text(r) === KT.S15 && p.kern.kurz().zustand === 'bereit' && p.kern.abbild().meldung === null);
  await p.aufraeumen();
}

// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
```

Zwei Stellen in diesem Block sind absichtlich so gebaut:
- Der zweite Klick in „Review Focus SDK-1“ läuft mit `Promise.race` gegen 1 s. Ist die Sperre kaputt, wird der Fall rot, statt den Lauf hängen zu lassen.
- „beenden mit Frist“ hält die Ereignisschleife mit einem eigenen `setTimeout` wach. `mitFrist` nutzt einen `unref`-Zeitgeber; ohne den eigenen Timer endet Node vorher mit „unsettled top-level await“ (Exit 13).

- [ ] **Step 3: Rot sehen**

Run: `npx tsx apps/connect/test/zoom-kern.test.ts`
Expected: Die alten Fälle laufen durch, dann Abbruch mit `TypeError: p.kern.sdkLaden is not a function`.

- [ ] **Step 4: Typen**

Datei `apps/connect/src/shared/types.ts` — ersetze:

```ts
  kopieLaeuft: boolean;
}
```

durch:

```ts
  /** Die Kopie ODER „Zoom-SDK laden“ läuft (Z1b; Spec SDK nachladen 4.4: dieselbe Einrichtungszeile). */
  kopieLaeuft: boolean;
}
```

Dann ersetze:

```ts
      kopie: { dateien: number; dateienGesamt: number; bytes: number; bytesGesamt: number } | null;
```

durch:

```ts
      kopie: { dateien: number; dateienGesamt: number; bytes: number; bytesGesamt: number } | null;
      /** „Zoom-SDK laden“ bis zum Ende des Entpackens (Spec SDK nachladen 4.4); danach folgt die Kopie mit `kopie`. */
      laden: { phase: 'link' | 'download' | 'pruefen' | 'entpacken'; bytes: number; bytesGesamt: number } | null;
```

Dann ersetze:

```ts
  zoomSdkWaehlen: () => Promise<ZoomErgebnis>;
```

durch:

```ts
  zoomSdkWaehlen: () => Promise<ZoomErgebnis>;
  /** „Zoom-SDK laden“: Link vom Proxy, Download, Prüfung, Entpacken, dann dieselbe Kopie wie die Ordnerwahl. */
  zoomSdkLaden: () => Promise<ZoomErgebnis>;
  /** Bricht ein laufendes Laden ab (Phasen link bis entpacken). */
  zoomSdkLadenAbbrechen: () => Promise<void>;
```

- [ ] **Step 5: Kern — Importe, Abhängigkeiten, Schnittstelle, Konstanten**

Datei `apps/connect/src/main/zoom/kern.ts` — ersetze:

```ts
  pfadVarianten,
  pruefeLaufzeit,
```

durch:

```ts
  pfadVarianten,
  PLATZ_RESERVE_BYTES,
  pruefeLaufzeit,
```

Dann ersetze:

```ts
  type SdkWahl,
} from './laufzeit';
```

durch:

```ts
  type SdkWahl,
} from './laufzeit';
import { fehlerCode, LADE_ORDNER, ladeFehlerText, SDK_LADEN_DIENSTE, type LadeFehler, type SdkLadenDienste } from './sdk-laden';
import { SDK_PAKET } from './sdk-paket';
```

Dann ersetze:

```ts
  /** Vorgabe: die echten Funktionen aus laufzeit.ts. */
  laufzeit?: Partial<LaufzeitDienste>;
```

durch:

```ts
  /** Vorgabe: die echten Funktionen aus laufzeit.ts. */
  laufzeit?: Partial<LaufzeitDienste>;
  /** Adresse des Release-Proxys für „Zoom-SDK laden“ (settings.proxyUrl()). Ein Proxy-Schlüssel wird nicht gebraucht. */
  proxyUrl(): string;
  /** Vorgabe: die echten Funktionen aus sdk-laden.ts. */
  sdkLaden?: Partial<SdkLadenDienste>;
```

Dann ersetze:

```ts
  sdkWaehlen(ordner: string): Promise<ZoomErgebnis>;
  zugangWaehlen(datei: string): ZoomErgebnis;
```

durch:

```ts
  sdkWaehlen(ordner: string): Promise<ZoomErgebnis>;
  /** „Zoom-SDK laden“ (Spec SDK nachladen 4.3): Link, Download, Prüfung, Entpacken, dann dieselbe Strecke wie sdkWaehlen. */
  sdkLaden(): Promise<ZoomErgebnis>;
  /** Bricht ein laufendes Laden ab (Phasen link bis entpacken); während der Kopie wirkungslos. */
  sdkLadenAbbrechen(): void;
  zugangWaehlen(datei: string): ZoomErgebnis;
```

Dann ersetze:

```ts
const ABGEBROCHEN: Meldungstext = { text: '', detail: null };
```

durch:

```ts
const ABGEBROCHEN: Meldungstext = { text: '', detail: null };
const MIB = 1024 * 1024;
/** Phase und Bytes von „Zoom-SDK laden“ im Abbild (Spec SDK nachladen 4.4). */
type LadenStand = NonNullable<ZoomAbbild['einrichtung']['sdk']['laden']>;
```

- [ ] **Step 6: Kern — Dienste, Zustand, Kurzform, Abbild, Sperre**

Datei `apps/connect/src/main/zoom/kern.ts` — ersetze:

```ts
  const lz: LaufzeitDienste = { pruefe: pruefeLaufzeit, pruefeOrdner: pruefeSdkOrdner, richteEin, ...d.laufzeit };
```

durch:

```ts
  const lz: LaufzeitDienste = { pruefe: pruefeLaufzeit, pruefeOrdner: pruefeSdkOrdner, richteEin, ...d.laufzeit };
  const ld: SdkLadenDienste = { ...SDK_LADEN_DIENSTE, ...d.sdkLaden };
```

Dann ersetze:

```ts
  let kopieLauf: Promise<EinrichtungsErgebnis> | null = null;
```

durch:

```ts
  let kopieLauf: Promise<EinrichtungsErgebnis> | null = null;
  /** „Zoom-SDK laden“: Phase und Bytes bis zum Ende des Entpackens, danach null (die Kopie zeigt `kopie`). */
  let ladung: LadenStand | null = null;
  /** Bricht die Phasen link bis entpacken ab; danach null (Spec SDK nachladen 4.3 „Abbrechen“). */
  let ladeAbbruch: AbortController | null = null;
  /** Das ganze Laden samt Kopie und Aufräumen; Sperre, laeuft() und beenden hängen daran (L24-Muster). */
  let ladeLauf: Promise<ZoomErgebnis> | null = null;
```

Dann ersetze:

```ts
      maengel: [...maengel],
      kopieLaeuft: kopie !== null,
    };
```

durch:

```ts
      maengel: [...maengel],
      // Spec SDK nachladen 4.4: Kopfzeile und Tray zeigen beim Laden dieselbe Einrichtungszeile wie bei der Kopie (Z1b).
      kopieLaeuft: kopie !== null || ladung !== null,
    };
```

Dann ersetze:

```ts
        sdk: { stand, fassung: stand === 'ok' ? SDK_FASSUNG : null, kopie: kopie ? { ...kopie } : null, text: sdkText },
```

durch:

```ts
        sdk: { stand, fassung: stand === 'ok' ? SDK_FASSUNG : null, kopie: kopie ? { ...kopie } : null, laden: ladung ? { ...ladung } : null, text: sdkText },
```

Dann ersetze:

```ts
  function einrichtungSperre(): ZoomErgebnis {
    const frei = (zustand === 'einrichtung' && kopie === null) || (zustand === 'bereit' && !pruefungLaeuft) || zustand === 'fehler';
    return frei ? { ok: true } : { ok: false, text: KT.S10 };
  }
```

durch:

```ts
  function einrichtungSperre(): ZoomErgebnis {
    // Spec SDK nachladen 4.4: zusätzlich nur ohne laufendes Laden (ladeLauf umfasst ladung !== null und die Kopie danach).
    const frei = ladeLauf === null
      && ((zustand === 'einrichtung' && kopie === null) || (zustand === 'bereit' && !pruefungLaeuft) || zustand === 'fehler');
    return frei ? { ok: true } : { ok: false, text: KT.S10 };
  }
```

- [ ] **Step 7: Kern — `sdkLaden`, `ladeAblauf`, `sdkLadenAbbrechen`**

Datei `apps/connect/src/main/zoom/kern.ts` — ersetze:

```ts
  function zugangWaehlen(datei: string): ZoomErgebnis {
```

durch:

```ts
  // ── Zoom-SDK laden (Spec 2026-10-06, 4.3, 4.4) ───────────────────────────
  /**
   * Schritte 1–2 hier, synchron: Sperre (S10), fehler→schliessen, Schlüssel (S11). Danach sind `ladung`,
   * `ladeAbbruch` und `ladeLauf` gesetzt, bevor irgendetwas wartet: ein zweiter Klick trifft schon die Sperre.
   */
  function sdkLaden(): Promise<ZoomErgebnis> {
    const sperre = einrichtungSperre();
    if (!sperre.ok) return Promise.resolve(sperre);
    if (zustand === 'fehler') schliessen();
    const schluessel = d.sdkSchluessel.lesen().wert;
    if (schluessel === null) {
      d.log('[zoom] Zoom-SDK laden abgewiesen: ' + KT.S11);
      return Promise.resolve({ ok: false, text: KT.S11 });
    }
    sdkFehler = null;
    const abbruch = new AbortController();
    ladeAbbruch = abbruch;
    ladung = { phase: 'link', bytes: 0, bytesGesamt: SDK_PAKET.bytes };
    d.log(`[zoom] Zoom-SDK wird geladen (${Math.round(SDK_PAKET.bytes / MIB)} MB)`);
    setzeZustand('einrichtung');
    const lauf = ladeAblauf(schluessel, abbruch.signal).finally(() => {
      ladeLauf = null;
    });
    ladeLauf = lauf;
    return lauf;
  }

  /** Schritte 3–8. Jeder Ausgang räumt den Arbeitsordner (Schritt 7) und lässt die bisherige Einrichtung stehen. */
  async function ladeAblauf(schluessel: string, signal: AbortSignal): Promise<ZoomErgebnis> {
    const arbeit = join(d.pfade.basis, LADE_ORDNER);
    const zip = join(arbeit, SDK_PAKET.datei);
    const entpackt = join(arbeit, 'sdk');
    const phase = (p: LadenStand['phase'], bytes = ladung?.bytes ?? 0): void => {
      ladung = { phase: p, bytes, bytesGesamt: SDK_PAKET.bytes };
      abbildGeaendert();
    };
    /** Ende ohne Kopie: ladung weg, Text ins Abbild, Zustand wie vorher (die Laufzeit hat sich nicht geändert). */
    const ende = (text: string, zeile: string): ZoomErgebnis => {
      ladung = null;
      sdkFehler = text;
      d.log(zeile);
      setzeZustand(maengel.length ? 'einrichtung' : 'bereit');
      return { ok: false, text };
    };
    const scheitert = (text: string): ZoomErgebnis => ende(text, `[zoom] Laden des Zoom-SDK gescheitert: ${text}`);
    const abgebrochen = (): ZoomErgebnis => ende(KT.S17, '[zoom] Laden des Zoom-SDK abgebrochen');
    // Ein Abbruch zählt immer als Abbruch (S17), auch wenn entpacke ihn als `entpacken` meldet.
    const fehlschlag = (f: LadeFehler): ZoomErgebnis => (signal.aborted || f.art === 'abgebrochen' ? abgebrochen() : scheitert(ladeFehlerText(f)));
    try {
      // (4) Arbeitsordner: Reste eines früheren Laufs weg, und zwar VOR der Platzmessung (A12): Sie zählen sonst
      // gegen den Bedarf (ZIP und Entpackordner, bis rund 460 MB). Angelegt wird dabei nichts.
      ld.loesche(arbeit);
      // (3) Platz: ZIP + Entpackordner + Kopie + Reserve, sonst S5 — dann ist noch nichts angelegt.
      const bedarf = SDK_PAKET.bytes + 2 * SDK_PAKET.bytesEntpackt + PLATZ_RESERVE_BYTES;
      const frei = await ld.freierPlatz(d.pfade.basis);
      if (frei < bedarf) return scheitert(KT.S5(Math.ceil(bedarf / MIB), Math.floor(frei / MIB)));
      // (5) Phasen link → download → pruefen → entpacken. Vom Proxy steht nur der Host im Log.
      const base = d.proxyUrl();
      let host = 'unbekannt';
      try {
        host = new URL(base).host;
      } catch {
        // ungültige Adresse: holeLink meldet sie als S14
      }
      d.log(`[zoom] SDK-Link angefragt bei ${host}`);
      const link = await ld.holeLink({ base, schluessel, fassung: SDK_PAKET.fassung, signal });
      if (!link.ok) return fehlschlag(link);
      phase('download', 0);
      const geladen = await ld.lade({
        url: link.url,
        size: link.size,
        ziel: zip,
        erwartet: SDK_PAKET,
        signal,
        fortschritt: (bytes) => phase('download', bytes),
        beimPruefen: () => phase('pruefen'),
      });
      if (!geladen.ok) return fehlschlag(geladen);
      if (signal.aborted) return abgebrochen();
      phase('entpacken');
      const ausgepackt = await ld.entpacke({ zip, ordner: entpackt, signal });
      if (!ausgepackt.ok) return fehlschlag(ausgepackt);
      if (signal.aborted) return abgebrochen();
      d.log('[zoom] Zoom-SDK geladen und geprüft');
      // (6) Dieselbe Strecke wie „SDK-Ordner wählen“. Ab hier greift „Abbrechen“ nicht mehr (die Kopie hat keinen).
      ladung = null;
      ladeAbbruch = null;
      const r = await pruefeUndRichteEin(entpackt, 'Laden');
      // Nach einer Kopie steht der Zustand schon; eine Abweisung vorher ließe ihn auf dem Lade-Zustand stehen.
      setzeZustand(maengel.length ? 'einrichtung' : 'bereit');
      // Auch nach Abweisung oder Kopierfehler endet ein gescheitertes Laden mit der Zeile aus Spec 4.3.
      if (!r.ok) d.log(`[zoom] Laden des Zoom-SDK gescheitert: ${r.text}`);
      return r;
    } catch (e) {
      return signal.aborted ? abgebrochen() : scheitert(KT.S16(fehlerCode(e)));
    } finally {
      ladung = null;
      ladeAbbruch = null;
      // (7) ZIP und Entpackordner immer weg; ein Fehler hier wird nur geloggt.
      try {
        ld.loesche(arbeit);
      } catch (e) {
        d.log(`[zoom] Aufräumen nach dem Laden unvollständig (${fehlerCode(e)})`);
      }
      abbildGeaendert();
    }
  }

  function sdkLadenAbbrechen(): void {
    if (ladung !== null) ladeAbbruch?.abort();
  }

  function zugangWaehlen(datei: string): ZoomErgebnis {
```

So läuft das Laden (Spec 4.3 Schritte 1–8):
- **Synchron in `sdkLaden`:** Sperre (S10) → `fehler` schließen → Schlüssel (S11) → `ladung`, `ladeAbbruch`, `ladeLauf` und Zustand `einrichtung` setzen. Erst danach wartet irgendetwas, deshalb trifft ein zweiter Klick schon die Sperre.
- **`ladeAblauf`:** Arbeitsordner leeren → Platz (S5) → Link → Download → Prüfung → Entpacken → `pruefeUndRichteEin(entpackt, 'Laden')`. Die Reste kommen vor der Platzmessung weg (A12). Danach setzt `setzeZustand(maengel.length ? 'einrichtung' : 'bereit')` den Zustand. Nach einer Kopie ändert das nichts (kein Log); nach einer Abweisung durch `pruefeOrdner` holt es den Zustand vom Lade-Zustand zurück. Ist das Ergebnis kein Erfolg, folgt die Spec-Zeile „Laden des Zoom-SDK gescheitert: <Text>“ (A8).
- **`finally`:** löscht den Arbeitsordner immer. Ein Fehler dabei wird nur geloggt.
- **Abbruch:** Jeder Abbruch ergibt S17, auch wenn `entpacke` ihn als `entpacken` meldet (A4).

- [ ] **Step 8: Kern — `laeuft`, `beenden`, Rückgabeobjekt**

Datei `apps/connect/src/main/zoom/kern.ts` — ersetze:

```ts
    return kopie !== null || pruefungLaeuft || aktiveBridge !== null || stopps.size > 0;
```

durch:

```ts
    return kopie !== null || ladeLauf !== null || pruefungLaeuft || aktiveBridge !== null || stopps.size > 0;
```

Dann ersetze:

```ts
      laufNr += 1;
      kopieAbbruch?.abort();
      d.log(`[zoom] Connect wird beendet (Frist ${fristMs} ms)`);
      // Spec 6.1: richteEin bricht nach der laufenden Datei ab und löscht <ziel>.teil selbst. Ohne dieses
      // Warten endet der Prozess vorher (before-quit ruft danach app.quit()) und .teil bliebe liegen.
      if (kopieLauf !== null && !(await mitFrist(kopieLauf, fristMs))) d.log('[zoom] SDK-Kopie nicht rechtzeitig abgebrochen');
```

durch:

```ts
      laufNr += 1;
      ladeAbbruch?.abort();
      kopieAbbruch?.abort();
      d.log(`[zoom] Connect wird beendet (Frist ${fristMs} ms)`);
      // Spec 6.1: richteEin bricht nach der laufenden Datei ab und löscht <ziel>.teil selbst. Ohne dieses
      // Warten endet der Prozess vorher (before-quit ruft danach app.quit()) und .teil bliebe liegen.
      // Ein Laden schließt seine Kopie und das Aufräumen von ZIP und Entpackordner ein: dann auf das Laden warten.
      if (ladeLauf !== null) {
        if (!(await mitFrist(ladeLauf, fristMs))) d.log('[zoom] Laden des Zoom-SDK nicht rechtzeitig abgebrochen');
      } else if (kopieLauf !== null && !(await mitFrist(kopieLauf, fristMs))) d.log('[zoom] SDK-Kopie nicht rechtzeitig abgebrochen');
```

Dann ersetze (im Rückgabeobjekt):

```ts
    sdkWaehlen,
    zugangWaehlen,
```

durch:

```ts
    sdkWaehlen,
    sdkLaden,
    sdkLadenAbbrechen,
    zugangWaehlen,
```

- [ ] **Step 9: IPC, Preload, Hülle**

Datei `apps/connect/src/shared/ipc.ts` — ersetze:

```ts
  zoomSdkWaehlen: 'jmc:zoom-sdk-waehlen',
```

durch:

```ts
  zoomSdkWaehlen: 'jmc:zoom-sdk-waehlen',
  /** invoke: „Zoom-SDK laden“ (Link vom Proxy, Download, Prüfung, Entpacken, Kopie) → ZoomErgebnis. */
  zoomSdkLaden: 'jmc:zoom-sdk-laden',
  /** invoke: laufendes Laden abbrechen (bis zum Entpacken, nicht mehr während der Kopie) → void. */
  zoomSdkLadenAbbrechen: 'jmc:zoom-sdk-laden-abbrechen',
```

Datei `apps/connect/src/preload/index.ts` — ersetze:

```ts
  zoomSdkWaehlen: () => ipcRenderer.invoke(IPC.zoomSdkWaehlen) as Promise<ZoomErgebnis>,
```

durch:

```ts
  zoomSdkWaehlen: () => ipcRenderer.invoke(IPC.zoomSdkWaehlen) as Promise<ZoomErgebnis>,
  zoomSdkLaden: () => ipcRenderer.invoke(IPC.zoomSdkLaden) as Promise<ZoomErgebnis>,
  zoomSdkLadenAbbrechen: () => ipcRenderer.invoke(IPC.zoomSdkLadenAbbrechen) as Promise<void>,
```

Datei `apps/connect/src/main/zoom.ts` — ersetze:

```ts
import {
  setzeZoomAnzeigename,
```

durch:

```ts
import {
  proxyUrl,
  setzeZoomAnzeigename,
```

Dann ersetze:

```ts
      gastLabels: activeLabels,
```

durch:

```ts
      // „Zoom-SDK laden“ (Spec SDK nachladen 4.3): Umgebung JMPS_PROXY_URL, Einstellung oder Vorgabe; kein Proxy-Schlüssel.
      proxyUrl,
      gastLabels: activeLabels,
```

Dann ersetze:

```ts
    return ordner === null ? NICHTS : k.sdkWaehlen(ordner);
  });
```

durch:

```ts
    return ordner === null ? NICHTS : k.sdkWaehlen(ordner);
  });

  // „Zoom-SDK laden“ (Spec SDK nachladen 4.3): Sperre S10, Schlüssel S11 und Platz S5 prüft der Kern.
  ipcMain.handle(IPC.zoomSdkLaden, (): Promise<ZoomErgebnis> => k.sdkLaden());
  ipcMain.handle(IPC.zoomSdkLadenAbbrechen, (): void => k.sdkLadenAbbrechen());
```

- [ ] **Step 10: Testhilfen in zoom-text.test.ts um `laden` ergänzen**

Datei `apps/connect/test/zoom-text.test.ts` — ersetze:

```ts
      sdk: { stand: 'ok', fassung: '7.1.5.43953', kopie: null, text: null },
```

durch:

```ts
      sdk: { stand: 'ok', fassung: '7.1.5.43953', kopie: null, laden: null, text: null },
```

Dann ersetze:

```ts
        sdk: { stand: 'kopiert', fassung: null, kopie: { dateien: 40, dateienGesamt: 153, bytes: 105_500_000, bytesGesamt: 329_657_415 }, text: null },
```

durch:

```ts
        sdk: { stand: 'kopiert', fassung: null, kopie: { dateien: 40, dateienGesamt: 153, bytes: 105_500_000, bytesGesamt: 329_657_415 }, laden: null, text: null },
```

- [ ] **Step 11: Grün sehen**

Run: `npx tsx apps/connect/test/zoom-kern.test.ts` — Expected: `391 ok, 0 fehlgeschlagen, 0 übersprungen.` (Exit 0, keine Zeile „unsettled top-level await“).
Run: `npx tsx apps/connect/test/zoom-text.test.ts` — Expected: `502 ok, 0 fehlgeschlagen.`

- [ ] **Step 12: Alles prüfen**

Run: `npm run selftest -w @jm/connect` — Expected: Exit 0, letzte Zeile `Alle after-pack-Tests bestanden.`
Run: `npm run typecheck -w @jm/connect` — Expected: Exit 0. Heißt der neue Zustand versehentlich `laden`, meldet `tsc` „Duplicate identifier 'laden'“ (TS2300). Der Kern hat schon `laden(e)` für Zoom-Quellen.

- [ ] **Step 13: Commit**

```bash
git add apps/connect/src/main/zoom/kern.ts apps/connect/src/shared/types.ts apps/connect/src/shared/ipc.ts apps/connect/src/preload/index.ts apps/connect/src/main/zoom.ts apps/connect/test/zoom-kern.test.ts apps/connect/test/zoom-text.test.ts
git status --short
git commit -m "feat(connect): Zoom-SDK laden im Kern - Phasen, Abbrechen, Beenden, Sperre und Abbild" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Gegenproben (gemessen, je einzeln eingebaut):**

| Eingebauter Fehler | Ergebnis des Laufs |
| --- | --- |
| `setzeZustand(…)` nach `pruefeUndRichteEin` fehlt | `390 ok, 1 fehlgeschlagen`: „geladenes Paket von pruefeOrdner abgewiesen …“ ist rot |
| Sperre ohne `ladeLauf === null` | vier Fälle rot (Phasenfolge, „während des Ladens …“, „Review Focus SDK-1 …“, „… ebenfalls S10“) |
| `beenden` ohne Warten auf `ladeLauf` | `389 ok, 2 fehlgeschlagen`: „Review Focus SDK-2 …“ und „beenden mit Frist …“ sind rot |
| Alte Reihenfolge: erst Platz messen, dann Reste löschen | `390 ok, 1 fehlgeschlagen`: „Review Focus SDK-5 …“ ist rot |
| Ohne die Zeile „Laden des Zoom-SDK gescheitert“ nach `pruefeUndRichteEin` | `389 ok, 2 fehlgeschlagen`: „… Kopierfehler danach …“ und „geladenes Paket von pruefeOrdner abgewiesen …“ sind rot |
| `sdkLaden` übergeht die Sperre, solange eine Kopie läuft | `390 ok, 1 fehlgeschlagen`: „während der Kopie aus „SDK-Ordner wählen …“ …“ ist rot |

Bei der kaputten Sperre bleibt ein zweiter Lauf am Ende offen; Node meldet dann „unsettled top-level await“ und endet mit Exit 13. Der Lauf ist rot.

---

### Task 8: Zeilen, Knöpfe und Kartenableitungen in `zoom-text.ts` (Statuszeile, SDK-Schlüssel, Laden, Balken, Textfarbe)

**Files:**
- Modify: `apps/connect/src/shared/zoom-text.ts` (`kartenZeile` Z1b :149, neue Funktionen vor `sdkKnopf` :279, `ZoomKnoepfe` :301, `zoomKnoepfe` :332-336)
- Test: `apps/connect/test/zoom-text.test.ts` (Import, Block über der ENDE-Zeile)

**Interfaces:**
- Consumes (Aufgabe 4): `ZoomAbbild.einrichtung.sdkSchluessel.herkunft`. (Aufgabe 7): `ZoomAbbild.einrichtung.sdk.laden`, `ZoomKurz.kopieLaeuft` (Kopie oder Laden).
- Produces (Aufgabe 9 nutzt sie):
  - `sdkLadenZeile(l: NonNullable<ZoomAbbild['einrichtung']['sdk']['laden']>): string`, wörtlich:
    - `link` → „Zoom-SDK wird geladen …“
    - `download` → „Zoom-SDK wird geladen … <x> von <y> MB“ (MiB, gerundet wie Z1b)
    - `pruefen` → „Zoom-SDK wird geprüft …“
    - `entpacken` → „Zoom-SDK wird entpackt …“
  - `sdkSchluesselZeile(a: ZoomAbbild): string`: „SDK-Schlüssel: hinterlegt“ · „SDK-Schlüssel: hinterlegt (nur für diese Sitzung)“ · „SDK-Schlüssel: aus der Umgebung“ · „SDK-Schlüssel: fehlt“.
  - `ZoomKnoepfe.sdkLaden: 'frei' | 'gesperrt' | 'ohneSchluessel'`: `gesperrt` genau dann, wenn `einrichtungAenderbar` falsch ist (S10 geht vor), sonst `ohneSchluessel` bei Herkunft `none`.
  - `ZoomKnoepfe.sdkLadenAbbrechen: boolean` (genau dann, wenn `einrichtung.sdk.laden !== null`).
  - `ZoomKnoepfe.sdkSchluesselEntfernbar: boolean` (bei `stored` oder `session`).
  - `kartenZeile` zeigt in Z1b während des Ladens `sdkLadenZeile(laden)`; Tray und Kopfzeile bleiben „◌ Zoom: Einrichtung läuft“.
  - `sdkBalken(sdk: ZoomAbbild['einrichtung']['sdk']): number | null`: Prozent 0–100 aus `kopie` (hat Vorrang) oder aus `laden` in der Phase `download`; sonst `null` (kein Balken). Ersetzt `prozent` in der Karte.
  - `einrichtungsTextArt(text: string): 'hinweis' | 'fehler'`: `'hinweis'` genau für `TEXT_S17` (grau), sonst `'fehler'` (rot). Die Karte nutzt es für `sdk.text` und für die sofortige Antwort des Knopfs (A9).

- [ ] **Step 1: Die Tests schreiben**

Datei `apps/connect/test/zoom-text.test.ts` — ersetze (Importzeilen aus Aufgabe 2):

```ts
  gaesteZeile, kartenZeile, MANGEL_GRUND, Q9_ANFANG, sdkKnopf, sdkZeile, stateKvAus, TEXT_A4, TEXT_A4_SCHREIBFEHLER, TEXT_A6, TEXT_S11,
  TEXT_S17, trayTooltip, trayVerlassenAktiv, zoomKnoepfe, zoomZ, zoomZeile, zugangZeile, type ZoomStatusWert, type ZoomZ,
```

durch:

```ts
  einrichtungsTextArt, gaesteZeile, kartenZeile, MANGEL_GRUND, Q9_ANFANG, sdkBalken, sdkKnopf, sdkLadenZeile, sdkSchluesselZeile,
  sdkZeile, stateKvAus, TEXT_A4, TEXT_A4_SCHREIBFEHLER, TEXT_A6, TEXT_S11, TEXT_S17, trayTooltip, trayVerlassenAktiv, zoomKnoepfe,
  zoomZ, zoomZeile, zugangZeile, type ZoomStatusWert, type ZoomZ,
```

Dann ersetze:

```ts
// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
```

durch:

```ts
console.log('— Zoom-SDK laden: Zeilen und Knöpfe (Spec SDK nachladen 4.4, 4.5)');
{
  const MiB = 1024 * 1024;
  const GESAMT = 150_120_193; // 143,2 MiB → 143
  type Laden = NonNullable<ZoomAbbild['einrichtung']['sdk']['laden']>;
  const ZEILE: Array<[Laden, string]> = [
    [{ phase: 'link', bytes: 0, bytesGesamt: GESAMT }, 'Zoom-SDK wird geladen …'],
    [{ phase: 'download', bytes: 63 * MiB, bytesGesamt: GESAMT }, 'Zoom-SDK wird geladen … 63 von 143 MB'],
    [{ phase: 'pruefen', bytes: GESAMT, bytesGesamt: GESAMT }, 'Zoom-SDK wird geprüft …'],
    [{ phase: 'entpacken', bytes: GESAMT, bytesGesamt: GESAMT }, 'Zoom-SDK wird entpackt …'],
  ];
  for (const [l, soll] of ZEILE) {
    ck(`Phase ${l.phase}: Zeile „${soll}“`, sdkLadenZeile(l) === soll);
    const a = abbild({
      kurz: { zustand: 'einrichtung', maengel: ['sdk_fehlt'], kopieLaeuft: true },
      einrichtung: { ...abbild().einrichtung, sdk: { stand: 'fehlt', fassung: null, kopie: null, laden: l, text: null } },
    });
    ck(`… Kopfzeile und Tray wie bei der Kopie, die Karte zeigt die Phase (${l.phase})`,
      zoomZ(a.kurz) === 'Z1b' && zoomZeile(a.kurz) === '◌ Zoom: Einrichtung läuft' && kartenZeile(a, JETZT) === soll
        && stateKvAus(a.kurz)?.zoom_status === 'einrichtung');
  }

  const SCHLUESSEL: Record<ProxyKeySource, string> = {
    stored: 'SDK-Schlüssel: hinterlegt',
    session: 'SDK-Schlüssel: hinterlegt (nur für diese Sitzung)',
    env: 'SDK-Schlüssel: aus der Umgebung',
    none: 'SDK-Schlüssel: fehlt',
  };
  for (const h of Object.keys(SCHLUESSEL) as ProxyKeySource[]) {
    const a = abbild({ einrichtung: { ...abbild().einrichtung, sdkSchluessel: { herkunft: h } } });
    ck(`SDK-Schlüssel, Herkunft ${h}: Zeile wörtlich`, sdkSchluesselZeile(a) === SCHLUESSEL[h]);
    ck(`… „Entfernen“ ${h === 'stored' || h === 'session' ? 'da' : 'fehlt'}`,
      zoomKnoepfe(a).sdkSchluesselEntfernbar === (h === 'stored' || h === 'session'));
  }

  const mit = (herkunft: ProxyKeySource, kz: Partial<ZoomKurz> = {}, extra: Omit<Partial<ZoomAbbild>, 'kurz'> = {}): ZoomAbbild =>
    abbild({ ...extra, kurz: kz, einrichtung: { ...abbild().einrichtung, sdkSchluessel: { herkunft } } });
  ck('Z2 mit Schlüssel: „Zoom-SDK laden“ frei', zoomKnoepfe(mit('stored')).sdkLaden === 'frei');
  ck('Z1a mit Schlüssel aus der Umgebung: frei', zoomKnoepfe(mit('env', { zustand: 'einrichtung', maengel: ['sdk_fehlt'] })).sdkLaden === 'frei');
  ck('ohne Schlüssel: gesperrt mit S11', zoomKnoepfe(mit('none', { zustand: 'einrichtung', maengel: ['sdk_fehlt'] })).sdkLaden === 'ohneSchluessel');
  ck('während Kopie oder Laden (Z1b): gesperrt wie die Ordnerwahl (S10)',
    zoomKnoepfe(mit('stored', { zustand: 'einrichtung', maengel: ['sdk_fehlt'], kopieLaeuft: true })).sdkLaden === 'gesperrt');
  ck('während „Einrichtung prüfen“: gesperrt (S10)', zoomKnoepfe(mit('stored', {}, { pruefungLaeuft: true })).sdkLaden === 'gesperrt');
  ck('im Meeting: gesperrt (S10), auch ohne Schlüssel geht S10 vor', zoomKnoepfe(mit('none', { zustand: 'im_meeting', erlaubnis: 'ja' })).sdkLaden === 'gesperrt');
  const laufend = abbild({
    kurz: { zustand: 'einrichtung', maengel: ['sdk_fehlt'], kopieLaeuft: true },
    einrichtung: { ...abbild().einrichtung, sdk: { stand: 'fehlt', fassung: null, kopie: null, laden: { phase: 'download', bytes: 1, bytesGesamt: 2 }, text: null } },
  });
  ck('„Abbrechen“ nur, solange geladen wird (nicht während der Kopie)', zoomKnoepfe(laufend).sdkLadenAbbrechen
    && !zoomKnoepfe(lage('Z1b', 0, 0)).sdkLadenAbbrechen && !zoomKnoepfe(abbild()).sdkLadenAbbrechen);

  // Karte (Aufgabe 9): Balken und Farbe des Einrichtungstexts sind reine Ableitungen.
  const sdkMit = (kopie: ZoomAbbild['einrichtung']['sdk']['kopie'], laden: Laden | null): ZoomAbbild['einrichtung']['sdk'] =>
    ({ ...abbild().einrichtung.sdk, kopie, laden });
  ck('Balken beim Download: 63 von 143 MB → 44 %', sdkBalken(sdkMit(null, { phase: 'download', bytes: 63 * MiB, bytesGesamt: GESAMT })) === 44);
  ck('… kein Balken bei Link, Prüfen und Entpacken, und ohne Laden und Kopie',
    (['link', 'pruefen', 'entpacken'] as const).every((phase) => sdkBalken(sdkMit(null, { phase, bytes: GESAMT, bytesGesamt: GESAMT })) === null)
      && sdkBalken(sdkMit(null, null)) === null);
  ck('… während der Kopie der Kopierfortschritt wie bisher (32 %), Gesamt 0 → 0 %',
    sdkBalken(sdkMit({ dateien: 40, dateienGesamt: 153, bytes: 105_500_000, bytesGesamt: 329_657_415 }, null)) === 32
      && sdkBalken(sdkMit({ dateien: 0, dateienGesamt: 0, bytes: 0, bytesGesamt: 0 }, null)) === 0);
  ck('S17 ist ein Hinweis (grau), S10, S11, S12, S16b und S5 sind Fehler (rot)',
    einrichtungsTextArt(TEXT_S17) === 'hinweis'
      && [KT.S10, TEXT_S11, KT.S12, KT.S16b, KT.S5(872, 871)].every((t) => einrichtungsTextArt(t) === 'fehler'));
}

// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
```

- [ ] **Step 2: Rot sehen**

Run: `npx tsx apps/connect/test/zoom-text.test.ts`
Expected: Abbruch mit `SyntaxError: The requested module '../src/shared/zoom-text' does not provide an export named 'einrichtungsTextArt'` (Node nennt den ersten fehlenden Namen der Importliste).

- [ ] **Step 3: Statuszeile Z1b während des Ladens**

Datei `apps/connect/src/shared/zoom-text.ts` — ersetze:

```ts
    case 'Z1b': {
      const c = a.einrichtung.sdk.kopie ?? { dateien: 0, dateienGesamt: 0, bytes: 0, bytesGesamt: 0 };
```

durch:

```ts
    case 'Z1b': {
      // Spec SDK nachladen 4.4: Tray und Kopfzeile bleiben bei „Einrichtung läuft“, nur die Karte zeigt die Phase.
      const l = a.einrichtung.sdk.laden;
      if (l) return sdkLadenZeile(l);
      const c = a.einrichtung.sdk.kopie ?? { dateien: 0, dateienGesamt: 0, bytes: 0, bytesGesamt: 0 };
```

- [ ] **Step 4: Zeilen „Zoom-SDK wird …“ und „SDK-Schlüssel“, Balken und Textfarbe**

Datei `apps/connect/src/shared/zoom-text.ts` — ersetze:

```ts
/** Beschriftung des SDK-Knopfs (Spec 9 Punkt 3). */
```

durch:

```ts
/** Fortschritt von „Zoom-SDK laden“ in der Zeile „Zoom-SDK“ und in der Statuszeile der Karte (Spec SDK nachladen 4.5). */
export function sdkLadenZeile(l: NonNullable<ZoomAbbild['einrichtung']['sdk']['laden']>): string {
  switch (l.phase) {
    case 'link':
      return 'Zoom-SDK wird geladen …';
    case 'download':
      return `Zoom-SDK wird geladen … ${mb(l.bytes)} von ${mb(l.bytesGesamt)} MB`;
    case 'pruefen':
      return 'Zoom-SDK wird geprüft …';
    case 'entpacken':
      return 'Zoom-SDK wird entpackt …';
  }
}

/** Zeile „SDK-Schlüssel“ im Einrichtungsbereich (Spec SDK nachladen 4.5): nur die Herkunft, nie ein Wert. */
export function sdkSchluesselZeile(a: ZoomAbbild): string {
  const je: Record<ProxyKeySource, string> = {
    stored: 'SDK-Schlüssel: hinterlegt',
    session: 'SDK-Schlüssel: hinterlegt (nur für diese Sitzung)',
    env: 'SDK-Schlüssel: aus der Umgebung',
    none: 'SDK-Schlüssel: fehlt',
  };
  return je[a.einrichtung.sdkSchluessel.herkunft];
}

/** Ein Balken für Download und Kopie (Spec SDK nachladen 4.5): Prozent 0–100, `null` = kein Balken. */
export function sdkBalken(sdk: ZoomAbbild['einrichtung']['sdk']): number | null {
  const anteil = (teil: number, ganz: number): number => (ganz > 0 ? Math.min(100, Math.round((teil / ganz) * 100)) : 0);
  if (sdk.kopie) return anteil(sdk.kopie.bytes, sdk.kopie.bytesGesamt);
  if (sdk.laden?.phase === 'download') return anteil(sdk.laden.bytes, sdk.laden.bytesGesamt);
  return null;
}

/** S17 (Laden abgebrochen) ist ein Hinweis und steht grau, jeder andere Einrichtungstext ist ein Fehler (rot). */
export function einrichtungsTextArt(text: string): 'hinweis' | 'fehler' {
  return text === TEXT_S17 ? 'hinweis' : 'fehler';
}

/** Beschriftung des SDK-Knopfs (Spec 9 Punkt 3). */
```

- [ ] **Step 5: Knöpfe**

Datei `apps/connect/src/shared/zoom-text.ts` — ersetze:

```ts
  /** SDK-Ordner/Zugangsdaten wählen oder entfernen: nur Z1a, Z2 ohne Prüfung, Z13 (sonst Tooltip S10). */
  einrichtungAenderbar: boolean;
```

durch:

```ts
  /** SDK-Ordner/Zugangsdaten wählen oder entfernen: nur Z1a, Z2 ohne Prüfung, Z13 (sonst Tooltip S10). */
  einrichtungAenderbar: boolean;
  /** „Zoom-SDK laden“ (Spec SDK nachladen 4.5): frei, gesperrt wie die Ordnerwahl (Tooltip S10) oder ohne Schlüssel (Tooltip S11). */
  sdkLaden: 'frei' | 'gesperrt' | 'ohneSchluessel';
  /** „Abbrechen“ neben dem Ladefortschritt: solange `einrichtung.sdk.laden` steht, nicht während der Kopie. */
  sdkLadenAbbrechen: boolean;
  /** „Entfernen“ beim SDK-Schlüssel: bei hinterlegt oder Sitzung; nicht aus der Umgebung, nicht ohne Schlüssel. */
  sdkSchluesselEntfernbar: boolean;
```

Dann ersetze:

```ts
  const mangel = k.maengel.length > 0;
  return {
    meldung,
    einrichtungAenderbar: z === 'Z1a' || (z === 'Z2' && !a.pruefungLaeuft) || z === 'Z13',
```

durch:

```ts
  const mangel = k.maengel.length > 0;
  const einrichtungAenderbar = z === 'Z1a' || (z === 'Z2' && !a.pruefungLaeuft) || z === 'Z13';
  const schluessel = a.einrichtung.sdkSchluessel.herkunft;
  return {
    meldung,
    einrichtungAenderbar,
    sdkLaden: !einrichtungAenderbar ? 'gesperrt' : schluessel === 'none' ? 'ohneSchluessel' : 'frei',
    sdkLadenAbbrechen: a.einrichtung.sdk.laden !== null,
    sdkSchluesselEntfernbar: schluessel === 'stored' || schluessel === 'session',
```

- [ ] **Step 6: Grün sehen**

Run: `npx tsx apps/connect/test/zoom-text.test.ts` — Expected: `529 ok, 0 fehlgeschlagen.`

- [ ] **Step 7: Alles prüfen**

Run: `npm run selftest -w @jm/connect` — Expected: Exit 0.
Run: `npm run typecheck -w @jm/connect` — Expected: Exit 0 (der Renderer-tsconfig prüft `zoom-text.ts` mit).

- [ ] **Step 8: Commit**

```bash
git add apps/connect/src/shared/zoom-text.ts apps/connect/test/zoom-text.test.ts
git status --short
git commit -m "feat(connect): Zeilen und Knöpfe für Zoom-SDK laden und SDK-Schlüssel" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Gegenproben (gemessen, je einzeln eingebaut):**
- `einrichtungsTextArt` liefert immer `'fehler'`: `528 ok, 1 fehlgeschlagen`; rot wird „S17 ist ein Hinweis (grau) …“.
- `sdkBalken` ohne den Zweig für `download`: `528 ok, 1 fehlgeschlagen`; rot wird „Balken beim Download: 63 von 143 MB → 44 %“.

---

### Task 9: Karte (Zeile „SDK-Schlüssel“, Knopf „Zoom-SDK laden“) und Abnahme 0.2.2

**Files:**
- Modify: `apps/connect/src/renderer/src/zoom/ZoomCard.tsx` (Import :8, `prozent` :41-43 entfällt, neue Komponente vor `ZoomCard` :143, State :156, Effekt :198-200, Ableitungen :247-248, Einrichtungsbereich :462-481, Antwort der Einrichtung :532-534)
- Create: `apps/connect/ABNAHME-0.2.2.md`

**Interfaces:**
- Consumes (Aufgabe 2): `TEXT_S11`. (Aufgabe 8): `sdkLadenZeile`, `sdkSchluesselZeile`, `sdkBalken`, `einrichtungsTextArt`, `zoomKnoepfe(a).sdkLaden | .sdkLadenAbbrechen | .sdkSchluesselEntfernbar`. (Aufgaben 4 und 7): `window.jmconnect.zoomSdkLaden()`, `.zoomSdkLadenAbbrechen()`, `.zoomSdkSchluesselEintragen({ schluessel })`, `.zoomSdkSchluesselLoeschen()`; `a.einrichtung.sdk.laden`.
- Produces: nichts für andere Aufgaben.

Für die Karte gibt es keinen Testrahmen (wie bisher). Ihre Logik — Sperren, Tooltips, Texte, Sichtbarkeit, Balken, Farbe von S17 — steckt in `zoomKnoepfe`, `sdkLadenZeile`, `sdkSchluesselZeile`, `sdkBalken` und `einrichtungsTextArt` und ist in Aufgabe 8 getestet. Hier bleibt nur Verdrahtung: Die prüfen `tsc` und der Bau, den Klick prüft der Owner in der Abnahme.

- [ ] **Step 1: Importe; `prozent` entfällt**

Datei `apps/connect/src/renderer/src/zoom/ZoomCard.tsx` — ersetze:

```tsx
import { kartenZeile, Q9_ANFANG, sdkKnopf, sdkZeile, zoomKnoepfe, zugangZeile } from '@shared/zoom-text';
```

durch:

```tsx
import {
  einrichtungsTextArt,
  kartenZeile,
  Q9_ANFANG,
  sdkBalken,
  sdkKnopf,
  sdkLadenZeile,
  sdkSchluesselZeile,
  sdkZeile,
  TEXT_S11,
  zoomKnoepfe,
  zugangZeile,
} from '@shared/zoom-text';
```

Dann ersetze (den Balken rechnet ab jetzt `sdkBalken` aus Aufgabe 8):

```tsx
function prozent(teil: number, ganz: number): number {
  return ganz > 0 ? Math.min(100, Math.round((teil / ganz) * 100)) : 0;
}

function sollText(e: ZoomSollEintrag): string {
```

durch:

```tsx
function sollText(e: ZoomSollEintrag): string {
```

- [ ] **Step 2: Eingabe-Komponente nach dem Muster `ZugangEingabe`**

Datei `apps/connect/src/renderer/src/zoom/ZoomCard.tsx` — ersetze:

```tsx
export function ZoomCard(): JSX.Element {
```

durch:

```tsx
/**
 * SDK-Schlüssel von Hand (Spec SDK nachladen 4.5). Der Wert steht NUR im State dieser Komponente: Hängt sie aus
 * (Speichern, Abbrechen, Einrichtung zugeklappt), ist er weg. S18 und andere Ablehnungen erscheinen hier am Formular.
 */
function SchluesselEingabe({
  gesperrt,
  speichern,
  zu,
}: {
  gesperrt: boolean;
  speichern: (schluessel: string) => Promise<ZoomErgebnis>;
  zu: () => void;
}): JSX.Element {
  const [wert, setWert] = useState('');
  const [zeigen, setZeigen] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const absenden = (): void => {
    if (gesperrt) return;
    setFehler(null);
    void speichern(wert).then((r) => {
      if (r.ok) zu();
      else setFehler(r.text || null);
    });
  };
  return (
    <form
      className="mt-2 grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        absenden();
      }}
    >
      <div className="text-xs text-neutral-400">
        <label>
          SDK-Schlüssel
          <input
            type={zeigen ? 'text' : 'password'}
            value={wert}
            onChange={(e) => setWert(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            className={`${INP} mt-1 border-neutral-700`}
          />
        </label>
        <button type="button" onClick={() => setZeigen((z) => !z)} className={`${RAND} mt-1`}>
          {zeigen ? 'verbergen' : 'anzeigen'}
        </button>
      </div>
      <div className="flex items-center gap-2">
        <button type="submit" disabled={gesperrt} className={GELB}>
          Speichern
        </button>
        <button type="button" onClick={zu} className={RAND}>
          Abbrechen
        </button>
        {fehler && <span className="text-xs text-red-300">{fehler}</span>}
      </div>
    </form>
  );
}

export function ZoomCard(): JSX.Element {
```

- [ ] **Step 3: State und Lebensdauer der Eingabe**

Datei `apps/connect/src/renderer/src/zoom/ZoomCard.tsx` — ersetze:

```tsx
  const [handAuf, setHandAuf] = useState(false);
  const [verlassenFrage, setVerlassenFrage] = useState(false);
```

durch:

```tsx
  const [handAuf, setHandAuf] = useState(false);
  /** SDK-Schlüssel von Hand: Eingabe offen. Der Wert selbst lebt nur in `SchluesselEingabe`. */
  const [schluesselAuf, setSchluesselAuf] = useState(false);
  const [verlassenFrage, setVerlassenFrage] = useState(false);
```

Dann ersetze:

```tsx
  useEffect(() => {
    if (!einrichtungSichtbar) setHandAuf(false);
  }, [einrichtungSichtbar]);
```

durch:

```tsx
  useEffect(() => {
    if (!einrichtungSichtbar) {
      setHandAuf(false);
      setSchluesselAuf(false);
    }
  }, [einrichtungSichtbar]);
```

- [ ] **Step 4: Tooltip, Fortschrittsbalken und Textfarbe ableiten**

Datei `apps/connect/src/renderer/src/zoom/ZoomCard.tsx` — ersetze:

```tsx
  const antwortText = (ort: Ort): string | null => (antwort && antwort.ort === ort ? antwort.text : null);
  const einrichtungAntwort = antwortText('einrichtung');
```

durch:

```tsx
  const antwortText = (ort: Ort): string | null => (antwort && antwort.ort === ort ? antwort.text : null);
  const einrichtungAntwort = antwortText('einrichtung');
  // „Zoom-SDK laden“: Tooltip S10 wie die Ordnerwahl, ohne Schlüssel S11 (Spec SDK nachladen 4.5).
  const ladenTitel = kn.sdkLaden === 'gesperrt' ? TEXT_S10 : kn.sdkLaden === 'ohneSchluessel' ? TEXT_S11 : undefined;
  // Ein Balken für beide Abschnitte: erst der Download, danach die bestehende Kopie (sdkBalken, Aufgabe 8).
  const balken = sdkBalken(sdk);
  // S17 ist ein Hinweis (grau), alles andere rot (Spec SDK nachladen 4.3) — auch als Antwort, bevor das Abbild kommt.
  const textFarbe = (t: string): string => (einrichtungsTextArt(t) === 'hinweis' ? 'text-neutral-400' : 'text-red-300');
```

- [ ] **Step 5: Zeile „Zoom-SDK“ mit Laden, Fortschritt, „Abbrechen“ und die neue Zeile „SDK-Schlüssel“**

Datei `apps/connect/src/renderer/src/zoom/ZoomCard.tsx` — ersetze:

```tsx
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm">{sdkZeile(a)}</span>
              <MitTooltip titel={sperrTitel}>
                <button
                  disabled={!kn.einrichtungAenderbar || laeuft.has('sdk')}
                  onClick={() => void fuehreAus('sdk', 'einrichtung', () => window.jmconnect.zoomSdkWaehlen())}
                  className={RAND}
                >
                  {sdkKnopf(a)}
                </button>
              </MitTooltip>
            </div>
            {sdk.kopie && (
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded bg-neutral-800">
                <div className="h-full bg-yellow-400" style={{ width: `${prozent(sdk.kopie.bytes, sdk.kopie.bytesGesamt)}%` }} />
              </div>
            )}
            {sdk.text && <p className="mt-1 text-xs text-red-300">{sdk.text}</p>}
          </div>
```

durch:

```tsx
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm">{sdkZeile(a)}</span>
              <span className="flex shrink-0 gap-2">
                <MitTooltip titel={sperrTitel}>
                  <button
                    disabled={!kn.einrichtungAenderbar || laeuft.has('sdk')}
                    onClick={() => void fuehreAus('sdk', 'einrichtung', () => window.jmconnect.zoomSdkWaehlen())}
                    className={RAND}
                  >
                    {sdkKnopf(a)}
                  </button>
                </MitTooltip>
                <MitTooltip titel={ladenTitel}>
                  <button
                    disabled={kn.sdkLaden !== 'frei' || laeuft.has('sdk')}
                    onClick={() => void fuehreAus('sdk', 'einrichtung', () => window.jmconnect.zoomSdkLaden())}
                    className={RAND}
                  >
                    Zoom-SDK laden
                  </button>
                </MitTooltip>
              </span>
            </div>
            {sdk.laden && (
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-xs text-neutral-300">{sdkLadenZeile(sdk.laden)}</span>
                <button
                  disabled={!kn.sdkLadenAbbrechen || laeuft.has('sdk-abbrechen')}
                  onClick={() => void fuehreAus('sdk-abbrechen', null, () => ohneText(window.jmconnect.zoomSdkLadenAbbrechen()))}
                  className={RAND}
                >
                  Abbrechen
                </button>
              </div>
            )}
            {balken !== null && (
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded bg-neutral-800">
                <div className="h-full bg-yellow-400" style={{ width: `${balken}%` }} />
              </div>
            )}
            {/* S17 (abgebrochen) ist ein Hinweis, kein Fehler: grau statt rot (Spec SDK nachladen 4.3). */}
            {sdk.text && <p className={`mt-1 text-xs ${textFarbe(sdk.text)}`}>{sdk.text}</p>}
          </div>
          <div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm">{sdkSchluesselZeile(a)}</span>
              <span className="flex shrink-0 gap-2">
                <MitTooltip titel={sperrTitel}>
                  <button
                    disabled={!kn.einrichtungAenderbar || laeuft.has('sdk-schluessel')}
                    onClick={() => setSchluesselAuf(true)}
                    className={RAND}
                  >
                    Eintragen …
                  </button>
                </MitTooltip>
                {kn.sdkSchluesselEntfernbar && (
                  <MitTooltip titel={sperrTitel}>
                    <button
                      disabled={!kn.einrichtungAenderbar || laeuft.has('sdk-schluessel')}
                      onClick={() => void fuehreAus('sdk-schluessel', 'einrichtung', () => window.jmconnect.zoomSdkSchluesselLoeschen())}
                      className={RAND}
                    >
                      Entfernen
                    </button>
                  </MitTooltip>
                )}
              </span>
            </div>
            {schluesselAuf && (
              <SchluesselEingabe
                gesperrt={!kn.einrichtungAenderbar || laeuft.has('sdk-schluessel')}
                speichern={(schluessel) =>
                  fuehreAus('sdk-schluessel', null, () => window.jmconnect.zoomSdkSchluesselEintragen({ schluessel }))
                }
                zu={() => setSchluesselAuf(false)}
              />
            )}
          </div>
```

Dann ersetze (die sofortige Antwort im Einrichtungsbereich; S17 auch hier grau):

```tsx
            <p className="text-xs text-red-300">{einrichtungAntwort}</p>
```

durch:

```tsx
            <p className={`text-xs ${textFarbe(einrichtungAntwort)}`}>{einrichtungAntwort}</p>
```

Wie sich die Knöpfe verhalten:
- **„Zoom-SDK laden“** und „SDK-Ordner wählen …“ teilen den Lauf-Schlüssel `'sdk'`. Solange einer läuft (Laden samt Kopie), sind beide gesperrt.
- **„Abbrechen“** hat einen eigenen Schlüssel und ist nur da, solange `sdk.laden` steht.
- **Fehlertexte:** Abgelehnte Antworten des Ladens erscheinen über `fuehreAus(…, 'einrichtung', …)`. Steht derselbe Text als `sdk.text` im Abbild, zeigt die vorhandene Prüfung `einrichtungAntwort !== sdk.text` ihn nicht doppelt. Die Antwort kommt oft vor dem gedrosselten Abbild an (höchstens 100 ms später). Darum färbt `textFarbe` beide Stellen gleich: S17 erscheint nie kurz rot.

- [ ] **Step 6: Typen und Bau**

Run: `npm run typecheck -w @jm/connect` — Expected: Exit 0.
Run: `npm run build -w @jm/connect` — Expected: Exit 0. In der Ausgabe stehen `out/main`, `out/preload/index.cjs` und `out/renderer/assets/index-*.js` (gemessen: rund 336 kB).
Run: `npm run selftest -w @jm/connect` — Expected: Exit 0.

- [ ] **Step 7: Abnahme-Dokument**

Neue Datei `apps/connect/ABNAHME-0.2.2.md`:

```markdown
# Abnahme JM Connect 0.2.2 (Zoom-SDK nachladen, Owner, echte Hardware)

Spec: `docs/superpowers/specs/2026-10-06-connect-zoom-sdk-laden-design.md`, Abschnitt 7 (Schritte), Texte aus Abschnitt 5.

- Getestet wird der Bau von connect-v0.2.2 auf einem **JM-eigenen** Rechner. Kunden-Rechner sind ausgeschlossen (Spec 1, Zoom-Lizenz §6.1).
- Der SDK-Schlüssel steht **nie** in dieser Datei, in Notizen, Screenshots oder Berichten; `<SDK-Schlüssel>` bleibt Platzhalter.
- Schritt 7 ist neu gegenüber Spec 7 und prüft die Log-Regel aus Spec 4.3.

**Getesteter Bau** (vom Owner auszufüllen):

| Installer | SHA-256 | Datum | Rechner |
| --- | --- | --- | --- |
| `JM Connect-0.2.2-win-x64.exe` | | | |

**Voraussetzungen:**
- Der Proxy mit der Route `/zoom-sdk/:fassung` ist deployt, das Secret `ZOOM_SDK_KEY` ist gesetzt, und das `GITHUB_TOKEN` des Proxys darf `AlexmachtCode/jm-zoom-sdk` lesen.
- Im privaten Repo liegt das Release `zoom-sdk-7.1.5.43953` mit dem einen Asset `zoom-sdk-win-x64-7.1.5.43953.zip`.
- Die Zoom-Zugangsdaten sind eingetragen; sonst meldet Schritt 3 B17 statt PRUEFUNG_OK.
- Auf dem Laufwerk von `%LOCALAPPDATA%` sind mindestens 872 MB frei (ZIP, Entpackordner, Kopie und 100 MB Reserve).

| # | Schritt | Erwartung | Ergebnis |
| --- | --- | --- | --- |
| 1 | Einrichtung aufklappen. In der Zeile „SDK-Schlüssel“ auf „Eintragen …“, `<SDK-Schlüssel>` einfügen (verdeckt; „anzeigen“ zeigt ihn), „Speichern“ | Die Eingabe klappt zu, die Zeile zeigt „SDK-Schlüssel: hinterlegt“. Im Log steht „[zoom] SDK-Schlüssel hinterlegt (verschlüsselt)“ und **kein** Wert | |
| 2 | Connect beenden, den Ordner `%LOCALAPPDATA%\JM Connect\zoom-laufzeit\7.1.5.43953` löschen, Connect starten. In der Zeile „Zoom-SDK“ auf „Zoom-SDK laden“ | Erst „Zoom-SDK wird geladen … x von 143 MB“ mit Balken und „Abbrechen“, dann „Zoom-SDK wird entpackt …“, danach die Kopieranzeige. „Zoom-SDK wird geprüft …“ steht dazwischen höchstens einen Augenblick (die Prüfung dauert nur Millisekunden); fehlt es, ist der Schritt trotzdem bestanden. Zuletzt „Zoom-SDK 7.1.5.43953 eingerichtet“ und Zustand „bereit“. Kopfzeile und Tray zeigen währenddessen „◌ Zoom: Einrichtung läuft“. Der Ordner `zoom-laufzeit\laden` ist danach weg | |
| 3 | „Einrichtung prüfen“ | „Einrichtung in Ordnung: Zoom-SDK 7.1.5 (43953), Anmeldung bei Zoom erfolgreich.“ (PRUEFUNG_OK) | |
| 4 | SDK-Schlüssel „Entfernen“, dann „Eintragen …“ mit einem falschen Schlüssel, danach „Zoom-SDK laden“ | S12: „Der Proxy hat den SDK-Schlüssel abgelehnt. Bitte den Schlüssel prüfen.“ Die bisherige Einrichtung bleibt („Zoom-SDK 7.1.5.43953 eingerichtet“) | |
| 5 | Den richtigen Schlüssel wieder eintragen, „Zoom-SDK laden“; während „Zoom-SDK wird geladen … x von 143 MB“ steht, auf „Abbrechen“ | S17 in grauer Schrift: „Laden abgebrochen. Die bisherige Einrichtung bleibt unverändert.“ Der Ordner `zoom-laufzeit\laden` fehlt oder ist leer, die alte Einrichtung ist unverändert | |
| 6 | Netz trennen (WLAN aus bzw. Kabel ziehen), „Zoom-SDK laden“ | S14: „Der Proxy ist nicht erreichbar (…). Bitte die Netzverbindung prüfen oder den SDK-Ordner von Hand wählen.“ In der Klammer steht nur ein Code wie ENOTFOUND, nie ein Link | |
| 7 | Logordner („Logordner öffnen“) nach dem SDK-Schlüssel und nach „sig=“ durchsuchen | Kein Treffer. Vom Proxy steht nur der Host in „[zoom] SDK-Link angefragt bei …“ | |
```

- [ ] **Step 8: Commit**

```bash
git add apps/connect/src/renderer/src/zoom/ZoomCard.tsx apps/connect/ABNAHME-0.2.2.md
git status --short
git commit -m "feat(connect): Karte - SDK-Schlüssel und Zoom-SDK laden mit Fortschritt; Abnahme 0.2.2" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Expected bei `git status --short` vor dem Commit: genau diese zwei Pfade als gestaged (`M ` und `A `). Zusätzlich darf nur `?? docs/superpowers/plans/2026-10-06-connect-zoom-sdk-laden.md` erscheinen (G13). Ein Ordner `apps/connect/out/` vom Bau ist per `.gitignore` ausgenommen und erscheint nicht.

---

## Selbstprüfung des Plans (06.10.2026)

**Montage:** Der fertige Plantext wurde maschinell auf eine frische Kopie von `apps/connect` und `services/release-proxy` angewendet, und zwar jede „ersetze … durch …“-Stelle und jede „Neue Datei“ der Reihe nach. Jede Vorher-Stelle kam genau einmal vor; bei „alle drei Vorkommen“ waren es genau drei.

**Ergebnis der Montage (alle neun Aufgaben, nach der Nachbesserung neu gemessen):**
- 99 Schritte, alle Vorher-Stellen eindeutig.
- Die Code- und Testdateien sind Zeichen für Zeichen gleich mit der grün gemessenen Kopie (bis auf CRLF/LF).
- Selbsttest-Kette grün: zoom-text 529, zoom-laufzeit 86, zoom-teile 90, zoom-kern 391, zoom-settings 21, sdk-laden 64, after-pack bestanden.
- Beide Typechecks grün, `electron-vite build` grün, Proxy `62 passed, 0 failed`.

**Stufenprüfung (nach der Nachbesserung neu gemessen):** Der Plan wurde Aufgabe für Aufgabe auf eine weitere frische Kopie angewendet. Nach jeder Aufgabe liefen Typecheck, Proxy-Test und die ganze Selbsttest-Kette:

| nach Aufgabe | Proxy | Typecheck | zoom-text | zoom-laufzeit | zoom-teile | zoom-kern | zoom-settings | sdk-laden | after-pack |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 62 | ok | 490 | 86 | 84 | 307 | 11 | – | ok |
| 2 | 62 | ok | 502 | 86 | 84 | 307 | 11 | – | ok |
| 3 | 62 | ok | 502 | 86 | 90 | 307 | 21 | – | ok |
| 4 | 62 | ok | 502 | 86 | 90 | 330 | 21 | – | ok |
| 5 | 62 | ok | 502 | 86 | 90 | 330 | 21 | 64 | ok |
| 6 | 62 | ok | 502 | 86 | 90 | 337 | 21 | 64 | ok |
| 7 | 62 | ok | 502 | 86 | 90 | 391 | 21 | 64 | ok |
| 8 | 62 | ok | 529 | 86 | 90 | 391 | 21 | 64 | ok |
| 9 | 62 | ok | 529 | 86 | 90 | 391 | 21 | 64 | ok, Bau ok |

Alle Zahlen sind „ok“-Zählungen ohne einen einzigen Fehlschlag. Jede Aufgabe baut damit nur auf Schnittstellen, die eine frühere Aufgabe schon geliefert hat.

### 1. Abdeckung der Spec

| Spec-Abschnitt | Umgesetzt in |
| --- | --- |
| 1 Ziel und Grenzen | Nur Windows: Aufgabe 5 (`entpacke` → „nur Windows“), Kern nur unter win32 (`startZoom`, unverändert). Nur 7.1.5.43953: Aufgabe 5 (`SDK_PAKET`, Test gegen `SDK_FASSUNG`). Kein Laden ohne Klick (nur über den Knopf, Aufgabe 9). Launcher und Master-Link bleiben unberührt (G15). Kunden-Rechner: Abnahme-Kopf (Aufgabe 9). Eigener Schlüssel statt Proxy-Key: Aufgaben 1, 3, 4. Der Schlüssel erreicht die Zoom-Bridge nicht (G2, `envRemove`, Aufgabe 4) und geht nur per https übers Netz (A14, Aufgabe 5). |
| 2 Paket und Ablage | Aufgabe 5 (`SDK_PAKET` mit den nachgemessenen Werten aus G1; der Kommentar beschreibt den Austausch). Bau, Upload und Nachmessen sind erledigt (Controller, 06.10.). |
| 3.1 Route | Aufgabe 1: Lage vor dem Gate, Fassungsmuster, `X-Zoom-Sdk-Key` gegen `ZOOM_SDK_KEY` (A1), 401 ohne Secret, kein Proxy-Key, Bucket `zoomsdk` 20/600 s vor dem Vergleich, `ZOOM_SDK_REPO`, Tag und Asset-Name, 404/502, `resolveSignedUrl` mit Repo-Parameter (A3), Antwort `{ fassung, url, size }`. |
| 3.2 Was der Proxy nie tut | Aufgabe 1: Konsolen-Mitschnitt ohne Schlüssel und Link, 502 ohne GitHub-Text, Antwort ohne Prüfsumme (Test prüft die Schlüssel der Antwort exakt). |
| 3.3 Einrichtung | Aufgabe 1 (README, wrangler.toml); die Ausführung steht unter „Nach der Umsetzung“. |
| 4.1 Gepinntes Paket | Aufgabe 5 (Datei und Tests: Fassung, echtes Hex, alle Werte wörtlich wie G1). |
| 4.2 SDK-Schlüssel | Aufgabe 3 (Rangfolge, safeStorage, Sitzung, nie Klartext, Nutzlast höchstens 512 Zeichen); Aufgabe 4 (Kanäle, Trimmen, S18 samt A13, S10, `fehler`→schließen, Log, Abbild nur Herkunft); Aufgabe 9 (Formular). |
| 4.3 Laden | Aufgabe 5 (`holeLink`, `lade`, `entpacke`, eingespeiste Werkzeuge; A4, A5, A11, A14); Aufgabe 6 (Teilung mit Regressionstest, G16 = R8); Aufgabe 7 (Schritte 1–8, Reste vor der Platzmessung A12, Abbrechen, Beenden, Logzeilen samt A8, Proxy-Adresse aus `proxyUrl()`). |
| 4.4 Abbild und Sperre | Aufgabe 7 (`einrichtung.sdk.laden`, `einrichtung.sdkSchluessel` schon in Aufgabe 4, Sperre A7, `kopieLaeuft` → Z1b); Aufgabe 8 (Kopfzeile und Tray unverändert, nur die Karte zeigt die Phase). |
| 4.5 Karte | Aufgaben 8 und 9 (Knopf neben „SDK-Ordner wählen …“ mit derselben Sichtbarkeit; gesperrt ohne Schlüssel mit S11, bei S10 wie die Ordnerwahl; Fortschritt, „Abbrechen“; Zeile „SDK-Schlüssel“ mit vier Ständen, „Eintragen …“, „Entfernen“, verdecktes Feld mit „anzeigen“/„verbergen“, Lebensdauer wie `ZugangEingabe`). Balken und Farbe von S17 sind reine Funktionen mit Tests (Aufgabe 8, A9). |
| 5 Texte | Aufgabe 2 (wörtlich, KT_SOLL); Zuordnung der Fehlerarten: Aufgabe 5 (`ladeFehlerText`) und Aufgabe 7 (Kern, Abbruch → S17). |
| 6 Tests | Proxy: alle acht Punkte in Aufgabe 1. Connect `sdk-laden`: Link, Download, Entpacken, Log/Ergebnisse ohne Schlüssel und Link in Aufgabe 5 (A2); Log im Kern in Aufgabe 7. Kern: alle Punkte in Aufgaben 4, 6 und 7; „S10, solange laden oder kopie läuft“ für beide Kopien, die aus dem Laden und die aus „SDK-Ordner wählen …“. Paket: Aufgabe 5. Harness-Falle: G11 (kein neuer Fall liest `p.befehle()`). |
| 7 Abnahme | Aufgabe 9 (`apps/connect/ABNAHME-0.2.2.md`, Schritte 1–6 aus der Spec, dazu Schritt 7 Logsuche). |
| 8 Ablauf bis zum Release | „Nach der Umsetzung“ unten (kein Plan-Schritt, R5). |

### 2. Platzhalter

Gesucht wurde nach TBD, TODO, „implement later“, „fill in“, „Similar to Task“, „appropriate error“ und „handle edge“, außerdem nach ungefüllten Marken der Plan-Vorlage: keine Treffer. Jeder Code-Schritt enthält den vollständigen Code. Die neuen Dateien und die großen Testblöcke sind aus der grün gemessenen Kopie eingesetzt.

### 3. Namen und Typen über die Aufgaben hinweg

Die Montage mit beiden Typechecks hat alle folgenden Namen gegeneinander geprüft:

| Bereich | Namen |
| --- | --- |
| Kern-Schnittstelle | `SdkSchluesselStand`, `ZoomKernAbhaengigkeiten.sdkSchluessel` / `.proxyUrl` / `.sdkLaden`, `ZoomKern.sdkSchluesselEintragen` / `.sdkSchluesselLoeschen` / `.sdkLaden` / `.sdkLadenAbbrechen`, `pruefeUndRichteEin(ordner, 'Ordner' \| 'Laden')` |
| Lade-Modul | `SDK_PAKET`, `LADE_ORDNER`, `holeLink`, `lade` (mit `size` und `beimPruefen`), `entpacke`, `ladeFehlerText`, `fehlerCode`, `LadeWerkzeuge` (mit `oeffne`), `Schreibziel`, `SdkLadenDienste`, `SDK_LADEN_DIENSTE`, `freierPlatz` |
| Kern-Zustand und Abbild | Zustand `ladung`; Abbild-Feld `laden` |
| Zeilen und Knöpfe | `zoomKnoepfe(…).sdkLaden` / `.sdkLadenAbbrechen` / `.sdkSchluesselEntfernbar`, `sdkLadenZeile`, `sdkSchluesselZeile`, `sdkBalken`, `einrichtungsTextArt`, `TEXT_S11`, `TEXT_S17` |
| IPC | `zoomSdkSchluesselEintragen`, `zoomSdkSchluesselLoeschen`, `zoomSdkLaden`, `zoomSdkLadenAbbrechen` |
| Prüfstand | `BaueOptionen.sdkSchluessel` / `.sdkSchluesselLiefert` / `.sdkLaden`, `REG_WAHL`, `REG_STEMPEL` |

Eine Falle wurde gefunden und eingearbeitet: Der Kern hat schon `laden(e)` für Zoom-Quellen. Der neue Zustand heißt darum `ladung` (Aufgabe 7, Hinweis in Step 12).

### 4. Review Focus

Alle fünf Punkte haben einen Test in der Aufgabe, der der Code gehört. Die Testnamen beginnen mit „Review Focus SDK-<n>“, damit sie sich nicht mit „Review Focus 1–5“ aus Plan 4a in `zoom-kern.test.ts` verwechseln lassen:

| Punkt | Aufgabe |
| --- | --- |
| SDK-1 | 7 |
| SDK-2 | 7, dazu „beenden mit Frist“ |
| SDK-3 | 5 |
| SDK-4 | 4 |
| SDK-5 | 7 |

Ebenfalls getestet, aber nicht unter den fünf, weil seltener: Platz genau an der Grenze (Aufgabe 7), Abbruch beim Entpacken ergibt S17 statt S16c (Aufgabe 7), Abweisung des geladenen Pakets durch `pruefeOrdner` setzt den Zustand zurück (Aufgabe 7), unbrauchbares `Retry-After` (Aufgaben 2 und 5), Proxy-Antwort ohne `url` oder ohne JSON (Aufgabe 5), Proxy-Adresse mit `http://` (Aufgabe 5), Teil-Schreibvorgänge auf die Platte (Aufgabe 5), Schlüssel mit Zeichen außerhalb von ASCII (Aufgabe 4), Umgebung der Zoom-Bridge ohne Schlüssel (Aufgabe 4), „Zoom-SDK laden“ während der Kopie aus der Ordnerwahl (Aufgabe 7).

### Offene Punkte und Annahmen

- **Proxy-Tests in CI:** `services/release-proxy/test/worker.test.mjs` läuft in keinem Workflow; `ci-checks.yml` ruft nur `npm run selftest` der Pakete auf, mit Node 22. Dieser Plan ändert `.github/workflows/**` nicht (G15). Ob dafür ein CI-Schritt kommt, ist eine eigene Entscheidung.
- **Systemproxy:** Das Laden nutzt `fetch` aus Node im Electron-Main. Ein Windows-Systemproxy (Firmennetz) wird dabei nicht benutzt; hinter einem Pflicht-Proxy käme S14. Die JM-Rechner brauchen das nach heutigem Stand nicht; die Spec sagt dazu nichts.
- **Linux-Lauf:** Die Linux-CI zählt in `sdk-laden.test.ts` drei Fälle als übersprungen (echtes `tar.exe`). Die Codes in den Fällen „Netzfehler → ECONNREFUSED“ und „Abriss → UND_ERR_SOCKET-artiger Code“ wurden unter Node 24 gemessen; der Abriss-Fall prüft darum nur auf ein Code-Muster `^[A-Z][A-Z_]+$`. Ein Lauf unter Node 22 steht aus und geschieht automatisch in der CI des PRs.
- **Visuelle Prüfung der Karte:** steht aus; sie ist Teil der Abnahme (Schritte 1, 2 und 5).
- **S10 beim Laden und beim SDK-Schlüssel:** S10 lautet „Während Zoom läuft oder die Kopie läuft, lassen sich SDK-Ordner und Zugangsdaten nicht ändern.“ Als Tooltip und Ergebnis von „Zoom-SDK laden“ und vom SDK-Schlüssel nennt er beides nicht. Spec 4.2 und 4.5 verlangen hier ausdrücklich S10, und S10 ist ein freigegebener Text. Eine Neufassung bleibt darum eine Entscheidung des Owners und ist nicht Teil dieses Plans.
- **S13 in der Einzahl (A6):** „in 1 Minute“ statt „in 1 Minuten“ ist eine Abweichung vom Wortlaut der Spec-Vorlage. Der Owner sieht sie bei der Freigabe der Texte.
- **Schlüssel aus der Umgebung (A13):** `JMPS_ZOOM_SDK_KEY` wird nur getrimmt, nicht auf ASCII geprüft. Ein Wert mit „€“ führt beim Laden zu S14 mit dem Grund `TypeError`. Die Umgebung setzen nur Entwickler und Admins.
- **Signierter Link (A14):** Er wird nicht auf `https://` geprüft. An ihn geht kein Schlüssel, und den Inhalt sichern Länge und gepinnter SHA. Ein manipulierter Proxy kann Connect höchstens zu einer Anfrage an eine fremde Adresse bringen, deren Antwort verworfen wird.

## Nach der Umsetzung (nur Controller und Owner)

Die folgenden Punkte gehören nicht zu diesem Plan. Implementierer führen keinen davon aus. Sie stehen hier nur, damit der Zusammenhang mit Spec 8 sichtbar ist:

- **Token-Zugriff und Secret:** Der Zugriff des Proxy-`GITHUB_TOKEN` auf `AlexmachtCode/jm-zoom-sdk` (Contents: read) wird vom Owner in GitHub eingestellt. Das Secret `ZOOM_SDK_KEY` gibt der Owner selbst über `wrangler secret put` ein; laut README ist es zufällig, mindestens 32 Zeichen lang und besteht nur aus druckbaren ASCII-Zeichen ohne Leerzeichen. Ohne den Token-Zugriff meldet die Route `not_found`.
- **Proxy-Deploy:** Der Deploy geschieht nur mit ausdrücklichem Owner-Okay. Danach wird die Route einmal mit einem falschen Schlüssel geprüft (erwartet: 401); die Probe mit dem richtigen Schlüssel macht der Owner in Connect.
- **Release connect-v0.2.2:** Versionsnummer, Release-Notes zur Freigabe, Tag, lokaler Bau mit SDK, GitHub-Release und Katalog-Bump liegen beim Controller, jeweils nach Owner-Freigabe und im bisherigen Ablauf der Connect-Releases.
- **Abnahme:** Der Owner arbeitet `apps/connect/ABNAHME-0.2.2.md` auf einem JM-eigenen Rechner ab.
