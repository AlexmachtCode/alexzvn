# Anmeldung Teil 2 · Connect über die Anmeldung (Cloud-Raum, Zoom-JWT, SDK laden) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** JM Connect 0.5.0 holt Cloud-Raum, Zoom-JWT und „Zoom-SDK laden“ über Freigaben des Launchers 0.19.0 statt über Proxy-Key, Zoom-Zugangsdaten und SDK-Schlüssel; der Worker signiert das Zoom-JWT und nimmt die alten Schlüssel bis zum Stichtag weiter an.

**Architecture:** Der Worker bekommt drei Zwecke (`connect-raum`, `zoom-jwt`, `zoom-sdk`, je 72 h) mit festen Zielen, prüft Cloud-Raum und SDK-Link über `zugangPruefen` (alter Schlüssel nur noch zeitkonstant und bis `ALTKEY_CONNECT_BIS`), bindet Räume wie Q&A-Events an ihre erste Freigabe und stellt mit `POST /zoom/jwt` ein JWT aus, das byte-gleich zu `buildJwt` ist. Der Launcher kennt die drei Zwecke (mit JM-Prüfung für `zoom-sdk`) und sagt in seinen Texten, was wirkt. Connect hält die Freigaben verschlüsselt (Muster `apps/qa/src/main/cloud-zugang.ts`), holt das JWT vor dem Start der Bridge, hält es nur im RAM und fällt im Übergang auf vorhandene alte Werte zurück; die Eingabefelder für alte Werte entfallen.

**Tech Stack:** Cloudflare Worker als ESM ohne Bundler-Konfiguration (Web Crypto, Durable Objects, `[[ratelimits]]`, `compatibility_date = "2024-11-01"`), Tests mit `node --experimental-strip-types` (lokal Node 24.16.0, CI Node 22); TypeScript, tsx, React 18, Electron 33 (nur Typprüfung, kein Start); Attrappen statt Netz.

**Spec:** `docs/superpowers/specs/2026-11-20-anmeldung-teil2-design.md` (Entwurf Teil 2, alle Entscheidungen vom Owner freigegeben: OT1–OT12 am 05.11., N1–N4 am 20.11.) und die Haupt-Spec `docs/superpowers/specs/2026-10-17-launcher-anmeldung-design.md` (deren Teil-2-Zeilen der Entwurf festlegt). Bei Widerspruch gilt der Entwurf, dann die Haupt-Spec; die Abweichung wird gemeldet.

**Messbasis:** Branch `feat/anmeldung-teil2` = `origin/main` `df96395472` (Connect 0.4.6, Launcher 0.18.0, Q&A 0.6.0, Worker mit Teil 1 und `ALTKEY_BIS = "2026-12-20"`) plus der Entwurfs-Commit `15b1411e5d`. Quellen der Planung (nicht im Repo, `.superpowers/sdd/teil2-quellen/`): Nachmessung vom 20.11. (`teil2-nachmessung-2011.md`) und Bestandsaufnahme vom 05.11. (`teil2-bestand-0511.md`). Zeilenangaben gelten für `df96395472`; maßgeblich ist der wortgleiche Vorher-Text. Kein Test dieser Planung wurde ausgeführt; Zählstände stehen darum als „0 failed“ bzw. „0 fehlgeschlagen“, nicht als Summen.

---

## Global Constraints

- **Zwecke:** `connect-raum` → Funktion `connect-raum`, Gruppe `connect`, Ziel = Raum-ID nach `^[A-Za-z0-9_-]{6,64}$` (`ID_RE`); `zoom-jwt` → Funktion `zoom`, Ziel fest `meeting-sdk`; `zoom-sdk` → Funktion `zoom` und JM-Rechner (alle Stufen), Ziel fest `win-x64`; `qa-relay` unverändert (Ziel `^[A-Za-z0-9_-]{1,128}$`).
- **Freigabe-Laufzeit:** jeder Zweck 72 h = `259_200_000` ms (`FREIGABE_MS`); appId `jm-connect`.
- **JM-Prüfung für `zoom-sdk`:** beim Ausstellen auf beiden Seiten (Launcher `freigaben.ts`, Worker `/konto/freigabe`), weil die Freigabe-Claims `{v, typ, zweck, ziel, kid, gid, iat, exp}` kein `jm` tragen.
- **Zoom-JWT:** HS256, Kopf `{"alg":"HS256","typ":"JWT"}`, Nutzlast `{"appKey","iat","exp","tokenExp"}` in genau dieser Reihenfolge, `iat` = ⌊jetzt s⌋ − 30, `exp` = `tokenExp` = `iat` + 43 200 (12 h; nur auf Anfrage mit Rumpf `ttlS` 1800–43 200 kürzer, E9/M4); kein `mn`, keine `role`; byte-gleich zu `packages/zoom-bridge/src/jwt.ts` `buildJwt` bei gleichen Eingaben.
- **JWT in Connect:** nur im RAM; vor dem Spawn der Bridge (vor S-c) geholt; erneuert, wenn weniger als 2 h = `7_200_000` ms Rest bleiben; Rest gemessen an `gueltigS` der Worker-Antwort, nicht an `exp` gegen die lokale Uhr.
- **Worker-Secrets:** neu `ZOOM_CLIENT_ID` und `ZOOM_CLIENT_SECRET` (nur beschrieben, nie gesetzt, nie in `[vars]`); kein neuer Name mit `ZOOM_SDK_`; `PROXY_KEY` und `ZOOM_SDK_KEY` bleiben bis zum Stichtag.
- **Stichtag:** `ALTKEY_CONNECT_BIS` bleibt in diesem Plan leer (unbefristet); er gilt später für `PROXY_KEY` an `/connect` und `ZOOM_SDK_KEY` an `/zoom-sdk`.
- **Neue Drosseln:** `KONTO_RL_CONNECTALT` (`namespace_id = "7308"`, 20 je 60 s) und `KONTO_RL_ZOOMJWT` (`"7309"`, 30 je 60 s); danach neun `[[ratelimits]]`.
- **Versionen:** Launcher 0.18.0 → **0.19.0**, Connect 0.4.6 → **0.5.0** (nur Teil 2, N3); Worker ohne Version; `@jm/app-runtime`, `apps/qa`, `packages/zoom-bridge` bleiben unverändert.
- **Gemerktes Meeting bleibt (N1):** `zoomLetzteNummer` und `zoomLetzterKenncodeEnc` werden nie gelöscht; der Nachweis „kein dauerhaftes Geheimnis“ prüft `proxyKeyEnc`, `zoomZugangEnc`, `zoomSdkKeyEnc`.
- **Texte:** jeder neue oder geänderte sichtbare Text steht wörtlich in der Texttabelle (unten) und wird so verwendet; nur „ “ (nie ASCII `"`) in Nutzertexten; echte Umlaute; Datum `TT.MM.JJJJ`, Uhrzeit `HH:MM`.
- **Nativer Code:** `packages/zoom-bridge/native/**` wird nicht angefasst; falls doch, Logtexte nur ASCII.
- **Geheimnisse:** kein JWT, keine Freigabe (`jm1.…`), kein Secret, kein alter Schlüssel in Log, Fehlermeldung, Abbild, IPC-Antwort oder Show; Testwerte entstehen zur Laufzeit oder sind offensichtlich unecht (`test-…`), nie hochentropische Literale (gitleaks).
- **Git:** ein Commit je Aufgabe (Task 21 ohne Commit), Botschaft ASCII im Stil `feat(proxy): …`, `feat(launcher): …`, `feat(connect): …`, `docs(…): …`, letzte Zeile `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; nie auf `main` committen; `git add` nur mit expliziten Pfaden, danach `git status --short` lesen; kein `git add -A`, kein Push, Tag, Merge, Deploy, Release.
- **Läufe (immer aus `C:/Users/alexk/alexzvn/.claude/worktrees/anmeldung-teil2`, Laufwerksbuchstabe groß):** Worker `node --experimental-strip-types services/release-proxy/test/<datei>.test.mjs` → `‹n› passed, 0 failed`; Bauprobe `node services/release-proxy/tools/bauprobe.mjs` → Exit 0; Launcher `npm run selftest:konto -w @jm/launcher` bzw. einzeln `cd apps/launcher && npx tsx test/<datei>.test.ts` → `‹n› ok, 0 fehlgeschlagen.`, dazu `npm run selftest -w @jm/launcher`; Connect einzeln `cd apps/connect && npx tsx test/<datei>.test.ts` → `‹n› ok, 0 fehlgeschlagen.` (zoom-kern: `…, 0 fehlgeschlagen, ‹k› übersprungen.`), ganz `npm run selftest -w @jm/connect` (rund 170 s, nur im letzten Step einer Connect-Aufgabe); Typprüfung `npm run typecheck -w @jm/launcher` bzw. `-w @jm/connect` → 0 `error TS`; Kochbuch `npm run cookbook:build && npm run cookbook:check`.
- **Windows-Umgebung:** In der Shell ist `ELECTRON_RUN_AS_NODE=1` gesetzt; kein Test startet Electron, Connect-Tests ersetzen `electron` und `@jm/app-runtime` per `registerHooks` (Muster `apps/connect/test/zoom-settings.test.ts:3-42`).
- **tsx und Node 22:** neue `.js`-Dateien nur unter `services/release-proxy/` (dort `package.json` mit `"type": "module"`, Commit `2d7a376f25`); in Launcher und Connect nur `.ts`. Vor dem ersten Lauf prüfen, dass `node_modules` im Worktree liegt (sonst `npm ci --ignore-scripts` genau dort).
- **Konstruktoren greppen:** wer ein Feld an `ZoomAbbild` (`abbild()` in `kern.ts`), `AppStatus` (nur `baueAppStatus`), `ProxyInfo` (`ipc.ts:29-31`), `AdminUebersicht.altKey` (DO `adminUebersicht`) oder `StartErgebnis` ergänzt, greppt zuerst alle bauenden Stellen und nennt sie im Step.
- **Abbruchregel:** Weicht ein Vorher-Text, ein Prüfname oder ein Ergebnis vom Plan ab, hält der Ausführende an und meldet; Test oder Erwartung passt er nicht an.

## Review Focus

1. **Die Uhr des Connect-Rechners geht Stunden falsch:** Das JWT gilt trotzdem bis zur Laufzeit, die der Worker nennt, und wird nach ihr erneuert (nicht nach `exp` gegen die lokale Uhr). Test: Task 14 `T14 RF1`.
2. **Zwei Bedarfe zur selben Zeit** (Doppelklick „Raum öffnen“, „Einrichtung prüfen“ und „Beitreten“, Wiederbeitritt und Hintergrund-Erneuern): genau eine Anfrage an Launcher bzw. Worker. Tests: Task 11 `T11 RF2`, Task 14 `T14 RF2`.
3. **Freigabe für den falschen Zweck oder Raum** (`zoom-jwt` an `/zoom-sdk`, `zoom-sdk` an `/zoom/jwt`, `zoom-jwt` mit Ziel `meeting-sdk` an `/connect/meeting-sdk`, Raum A an Raum B): immer 403, nie 200. Tests: Task 3 `T3 RF3`, Task 4 `T4 RF3`, Task 6 `T6 RF3`.
4. **Worker-Secret mit Leerraum am Rand** (Zeilenumbruch aus `wrangler secret put`): 503 `nicht-eingerichtet` mit Logzeile ohne Wert statt eines still falsch signierten JWT. Tests: Task 5 `T5 RF4`, Task 6 `T6 RF4`.
5. **Derselbe Show-Raum am nächsten Tag, anderer Kollege, anderer Rechner:** Nach „Raum schließen“ des Inhabers ist der Raum frei; solange er gebunden ist, sagt Connect, wem er gehört, statt „Proxy 403“. Tests: Task 3 `T3 RF5`, Task 12 `T12 RF5`.

---

## Aufbau

| Phase | Aufgaben | Ergebnis | Release (nach dem Plan, Owner-Tor) |
| --- | --- | --- | --- |
| A Worker | 1–7 | ein abwärtskompatibler Deploy; Connect 0.4.6 läuft unverändert weiter | N1 |
| B Launcher 0.19.0 | 8–9 | Zwecke für Connect, Texte mit Wirkung | N2 |
| C Connect 0.5.0 | 10–17 | Zugang über die Tür, JWT vom Worker, Übergang | N3 (nach Abnahme mit M4) |
| D Doku und Release-Vorbereitung | 18–21 | Texttabelle zur Freigabe, Changelog-Entwürfe, Doku, Abnahme-Datei, Gesamtprüfung | – |

Jede Aufgabe braucht nur, was davor fertig ist. Phase B hängt nur an Task 1 (gemeinsame Falltabelle), Phase C an Task 1 und an den Worker-Verträgen aus Task 3, 4 und 6.

## Entscheidungen, wo der Entwurf schweigt (Owner zur Kenntnis)

- **E1 JM-Prüfung als eigene Funktion:** `zweckDarf(stand, zweck, {jetzt})` → `'ja' | 'kein-recht' | 'kein-jm-rechner'` auf beiden Seiten, geprüft an einer gemeinsamen Falltabelle `services/release-proxy/test/zweck-faelle.json`. `FUNKTIONEN` und `darf` bleiben unverändert. Der Launcher antwortet bei `kein-jm-rechner` mit `{grund: 'kein-recht', detail: 'kein-jm-rechner'}`; daran erkennt Connect den Fall N2.
- **E2 Neuer Fehlercode `raum-vergeben` (Text S20)** statt `keine-freigabe` (S15 nennt „Q&A-Event“). Connect zeigt eigene Texte je Code; den Worker-Text sieht kein Nutzer.
- **E3 Raum-Bindung:** gilt 25 h ab der letzten Nutzung (Raum-Verfall 24 h plus 1 h Puffer, höchstens 30 Tage, Schritt 30 min wie `qa-inhaber`) und **endet mit „Raum schließen“ des Inhabers** (ein geschlossener Raum ist verfallen). Der alte Schlüssel öffnet einen gebundenen Raum nicht (wie EP33). Siehe Offene Punkte.
- **E4 Antwort von `POST /zoom/jwt`:** `200 { jwt, exp, gueltigS }` (`exp` in Unix-Sekunden, `gueltigS` = `exp` − ⌊jetzt s⌋), `cache-control: no-store`. Connect rechnet `bis` = lokale Uhr + `gueltigS` × 1000.
- **E5 Protokoll des JWT:** DO-Aktion `zoom-jwt-protokoll` über `ctx.waitUntil`, best effort: fällt der Konten-DO aus, gibt es das JWT trotzdem (Live-Betrieb hängt nie an der Anmeldung), mit Warnung im Log.
- **E6 Drosseln:** 20/min für den alten Schlüssel an `/connect` (Connect öffnet selten), 30/min für `/zoom/jwt` je IP (mehrere Rechner hinter einer Büro-IP).
- **E7 Alte Werte in Connect 0.5.0:** nur noch anzeigen und entfernen, nie neu eintragen; Zeilen erscheinen nur, solange ein alter Wert da ist („Felder nur im Übergang“, Spec 166). Umgebungsvariablen bleiben für Entwicklung und Test und stehen als Diagnose da.
- **E8 Kurze Raum-IDs (N4):** gesäuberte ID mit 1–5 Zeichen → `‹id›-‹die ersten 6 Hex-Zeichen von SHA-256(id)›`; 0 Zeichen bleibt leer (Zufalls-ID wie heute), ab 6 Zeichen unverändert.
- **E9 M4 ausführbar machen (Owner 20.11. 20:21: Weg über den Worker, kein Secret auf dem PC):** `POST /zoom/jwt` nimmt optional den JSON-Rumpf `{ "ttlS": n }` mit ganzer Zahl `n` 1800–43 200 an (ohne Rumpf oder ohne `ttlS`: 43 200; andere Werte, kein JSON → 400 `{ code: 'ungueltige-laufzeit' }`); eine kürzere Laufzeit gibt einem Freigabe-Inhaber nichts zusätzlich. Connect liest die Entwicklungsvariable `JMPS_ZOOM_JWT_TTL_S` (ganze Zahl 1800–43 200) und schickt sie als `ttlS` mit; dann kein JWT aus dem RAM und kein Erneuerungs-Zeitgeber, jeder Bedarf holt neu. Connect signiert mit dieser Variable nie lokal. (Ursprünglicher Planer-Vorschlag, verworfen: lokal signieren mit den Zugangsdaten aus der Umgebung.)
- **E10 Zugangs-Altlasten (OT9):** `proxyKeyEnc` fällt beim Erhalt der ersten gültigen `connect-raum`-Freigabe, `zoomSdkKeyEnc` nach dem ersten Link mit Freigabe, `zoomZugangEnc` nach dem ersten `auth` mit Code 0 und Server-JWT; je einmal ein Hinweis (CZ5, ZA6, ZA5). Lehnt der Worker einen alten Schlüssel mit 401 `nicht-angemeldet` oder `alter-key-abgelaufen` ab, löscht Connect ihn ebenfalls (Muster Q&A OE5): nach dem Stichtag kein Rückfall.

---

## Texttabelle (Entwurf zur Owner-Freigabe)

Die Aufgaben setzen diese Texte wörtlich um. **Tor:** Die Freigabe durch den Owner (Task 18 legt die Datei `docs/anmeldung-teil2-texte.md` vor) blockiert keine Aufgabe dieses Plans; sie ist Tor für die Releases N2 und N3. Ändert der Owner einen Text, setzt eine Nachbesserung ihn in den Aufgaben der Spalte „Task“ um (Code, Test, Handbuch, Changelog). Platzhalter: ‹Datum› `TT.MM.JJJJ`, ‹Zeit› `HH:MM`, ‹Name› Kurzname aus der Freigabe, ‹Stufe› Admin/Kollege/Externer, ‹Grund› ein Text CG1–CG10 bzw. ZA8–ZA10.

### T1 Worker

| Nr. | Task | Ort | Text |
| --- | --- | --- | --- |
| S20 | 2 | `konto-zugang.js` `FEHLER_TEXT['raum-vergeben']` | dieser Cloud-Raum gehört einem anderen Konto oder Rechner |

### T2 Launcher

| Nr. | Task | Ort | Text (neu) |
| --- | --- | --- | --- |
| Z5 | 9 | `konto-dialog.ts` `ZOOM_TEXTE.hinweisJm` | Dieser Rechner ist ein JM-Rechner. Eine Freigabe wirkt hier nach dem nächsten Start des Launchers. |
| Z6 | 9 | `…hinweisKeinJm` | Dieser Rechner ist kein JM-Rechner. Zoom gibt es für Externe nur auf JM-Rechnern; eine Freigabe wirkt hier nicht. |
| Z7 | 9 | `…hinweisMac` | Auf dem Mac gibt es Zoom in Connect nicht. Eine Freigabe wirkt nur auf JM-Rechnern unter Windows. |
| Z9b | 9 | `…freigegeben(d)` | Zoom freigegeben bis ‹Datum›. Gilt ab dem nächsten Start des Launchers. |
| Z11 | 9 | `…connect` | entfällt |
| K29d | 9 | `KONTO_TEXTE.zweck` | Q&A extern / Connect Cloud-Raum / Zoom-Anmeldung / Zoom-SDK laden |
| M44a | 9 | `admin-ansicht.ts` `REITER_TEXTE` | Alter Schlüssel für Katalog, Updates und Q&A angenommen bis ‹Datum›. / Alter Schlüssel für Katalog, Updates und Q&A ohne Enddatum angenommen. |
| M44b | 9 | dito | Alter Schlüssel für Connect (Cloud-Raum, Zoom-SDK) angenommen bis ‹Datum›. / Alter Schlüssel für Connect (Cloud-Raum, Zoom-SDK) ohne Enddatum angenommen. |
| M46 | 9 | `REITER_TEXTE.gruppe` | Katalog und Updates / Q&A extern / Connect (Cloud-Raum, Zoom-SDK) |
| M47 | 9 | `REITER_TEXTE.connect` | entfällt (M44b sagt es) |
| M48 | 9 | `ADMIN_TEXTE.connectTeil1` | entfällt |
| R1a | 9 | `launcher-anmeldung.md:48` | - **Zoom anfragen (Externe):** im Konto-Dialog „Zoom anfragen“, Zweck oder Event und den Zeitraum eintragen, „Anfrage senden“. Ein Admin gibt frei. Die Freigabe wirkt ab dem nächsten Start des Launchers und nur auf einem JM-Rechner unter Windows. Kollegen brauchen keine Anfrage. |
| R1b | 9 | `launcher-anmeldung.md:74` | \| Zoom-Freigabe wirkt nicht \| Sie wirkt erst nach dem nächsten Start des Launchers und nur auf JM-Rechnern unter Windows. Der Konto-Dialog sagt, ob der Rechner ein JM-Rechner ist \| |

### T3 Connect: Gründe (`zugang/regeln.ts` `grundText(zweck, grund, detail)`)

| Nr. | Grund (Zweck) | Text |
| --- | --- | --- |
| CG1 | `kein-launcher` | Kein Launcher mit Anmeldung gefunden. Starte den Launcher und melde dich dort an. |
| CG2 | `launcher-unecht` | Der Launcher hat sich nicht ausgewiesen. Starte den Launcher neu. |
| CG3 | `launcher-zu-alt`, `unbekannter-zweck` | Der Launcher ist zu alt für Connect. Launcher aktualisieren (ab 0.19.0). |
| CG4 | `niemand-angemeldet` | Im Launcher ist niemand angemeldet. Melde dich im Launcher an (oben rechts). |
| CG5 | `abgelaufen` | Die Anmeldung im Launcher ist abgelaufen. Melde dich im Launcher neu an. |
| CG6 | `entzogen` | Dein Zugang wurde beim letzten Start des Launchers nicht bestätigt. Frag einen Admin. |
| CG7a | `kein-recht` (`connect-raum`) | Dein Konto darf den Cloud-Raum nicht nutzen. Frag einen Admin. |
| CG7b | `kein-recht` (`zoom-jwt`) | Dein Konto darf Zoom auf diesem Rechner nicht nutzen. Externe brauchen eine Zoom-Freigabe und einen JM-Rechner. |
| CG7c | `kein-recht` (`zoom-sdk`, ohne Detail) | Dein Konto darf das Zoom-SDK nicht laden. Wähle den SDK-Ordner von Hand („SDK-Ordner wählen …“). |
| CG8 (N2) | `kein-recht` + `detail: 'kein-jm-rechner'` (`zoom-sdk`) | „Zoom-SDK laden“ gibt es nur auf JM-Rechnern. Wähle den SDK-Ordner von Hand („SDK-Ordner wählen …“) oder bitte einen Admin, diesen Rechner als JM-Rechner zu markieren. |
| CG9 | `server-nicht-erreichbar` | Der Server ist gerade nicht erreichbar. Ich versuche es weiter. |
| CG10 | `fehler` | Freigabe fehlgeschlagen: ‹Detail› |

### T4 Connect: Cloud-Zugang, Raum, Zoom-Anmeldung, Übergang

| Nr. | Task | Ort | Text |
| --- | --- | --- | --- |
| CZ1 | 10 | Cloud-Zeile, Freigabe | Cloud-Zugang über den Launcher (‹Name› · ‹Stufe›), gültig bis ‹Datum› ‹Zeit›. |
| CZ2 | 10 | Cloud-Zeile, alter Key | Cloud-Zugang über den alten Proxy-Key (Übergang). |
| CZ3 | 10 | Cloud-Zeile, alter Key abgelehnt | Der Server nimmt den alten Proxy-Key nicht mehr an. Melde dich im Launcher an. |
| CZ4 | 10 | Cloud-Zeile, noch kein Versuch | Connect holt die Freigabe für den Cloud-Raum beim Launcher, sobald du einen Raum öffnest. |
| CZ5 | 10 | Zusatz nach OT9 | Der alte Proxy-Key wurde gelöscht; Connect nutzt jetzt die Freigabe des Launchers. |
| CZ6 | 10 | Zusatz, Umgebung | Entwicklungsmodus: JMPS_PROXY_KEY gesetzt. |
| CZ7 | 10, 12 | Fehler „Raum öffnen“ ohne Zugang | Raum öffnen nicht möglich: ‹Grund› |
| CZ8 | 10, 12 | Fehler 403 `raum-vergeben` | Dieser Cloud-Raum gehört gerade einem anderen Konto oder Rechner. Schließe ihn dort oder wähle im Show-Editor eine andere Raum-ID. |
| CZ9 | 10, 12 | Fehler 401 auf Freigabe | Der Server hat die Freigabe abgelehnt. Ich hole eine neue beim Launcher; bitte noch einmal „Raum öffnen“. |
| CZ10 | 10, 12 | Karte, Übergangszeile | Alter Proxy-Key: hinterlegt, nur noch im Übergang. |
| T146 | 12 | `ndi-text.ts:77` | Keine Verbindung zum Raum „‹Raum›“. Adresse und Cloud-Zugang prüfen — im Hintergrund wird weiter versucht. |
| ZA1 | 10 | Zoom-Anmeldung, Server | Zoom-Anmeldung über den Launcher (‹Name› · ‹Stufe›), Freigabe gültig bis ‹Datum› ‹Zeit›. |
| ZA2 | 10 | Zoom-Anmeldung, lokal | Zoom-Anmeldung über die alten Zugangsdaten dieses Rechners (Übergang). |
| ZA3 | 10 | Zoom-Anmeldung, keine | Zoom-Anmeldung: ‹Grund› |
| ZA4 | 10 | Zoom-Anmeldung, noch kein Versuch | Zoom-Anmeldung über den Launcher; die Freigabe holt Connect beim ersten Beitritt. |
| ZA5 | 10 | Zusatz/Hinweis nach OT9 | Die alten Zoom-Zugangsdaten wurden gelöscht; Connect meldet sich jetzt über den Launcher bei Zoom an. |
| ZA6 | 10 | Hinweis nach OT9 | Der alte SDK-Schlüssel wurde gelöscht; „Zoom-SDK laden“ läuft jetzt über den Launcher. |
| ZA7 | 10 | Meldung, Start ohne JWT | Ohne Zoom-Anmeldung kein Beitritt. ‹Grund› |
| ZA8 | 10 | Grund `server-abgelehnt` | Der Server hat die Freigabe für Zoom abgelehnt. Ich hole beim nächsten Versuch eine neue beim Launcher. |
| ZA9 | 10 | Grund `nicht-eingerichtet` | Die Zoom-Anmeldung ist auf dem Server nicht eingerichtet. Sag einem Admin Bescheid. |
| ZA10 | 10 | Grund `server-fehler` | Der Server hat kein Zoom-Anmelde-Token geliefert (‹Detail›). Ich versuche es beim nächsten Beitritt erneut. |
| ZA11 | 10 | Zusatz, Entwicklung (E9) | Entwicklungsmodus: JMPS_ZOOM_JWT_TTL_S gesetzt, der Server stellt das Zoom-Anmelde-Token mit ‹n› s Laufzeit aus. |
| B9s | 15 | `klartext.ts` | Zoom hat die Anmeldung abgelehnt: Die Zoom-Zugangsdaten auf dem Server stimmen nicht (‹Result›). Sag einem Admin Bescheid. |
| B10s | 15 | `klartext.ts` | Zoom hat die Anmeldung abgelehnt: Das Anmelde-Token vom Server passt nicht (AUTHRET_JWTTOKENWRONG). Meist geht die Uhr dieses PCs falsch; sonst stimmen die Zugangsdaten auf dem Server nicht. |
| S12b | 13 | `klartext.ts`, 401 auf Freigabe an `/zoom-sdk` | Der Server hat die Freigabe für „Zoom-SDK laden“ abgelehnt. Bitte noch einmal versuchen; Connect holt eine neue beim Launcher. |
| ZU1 | 16 | Zoom-Karte, Übergang | Alte Zugangsdaten: hinterlegt (Client-ID endet auf ‹vier Zeichen›), nur noch im Übergang. |
| ZU2 | 16 | Zoom-Karte, Übergang | Alter SDK-Schlüssel: hinterlegt, nur noch im Übergang. |
| ZU3 | 16 | Zoom-Karte, unlesbar | Alte Zugangsdaten lassen sich unter diesem Windows-Konto nicht entschlüsseln. Sie werden nicht mehr gebraucht; „Entfernen“ räumt sie weg. |
| ZS1 | 16 | `ZoomCard.tsx:47` `SPERR_HINWEIS` | Zoom ist gesperrt, bis das Zoom-SDK eingerichtet ist. |
| entfällt | 13, 15, 16 | `klartext.ts`, `zoom-text.ts` | S11, S18, A1, A2, A3, A5, A7, B17, `MANGEL_GRUND.zugang_fehlt`, `MANGEL_GRUND.zugang_unlesbar` (A4, A6, B9, B10, S12 bleiben für den Übergang) |

### T5 Changelog-Entwürfe (Task 18 trägt sie in `packages/suite-manifest/changelog.json` ein)

| Nr. | App, Version | Text |
| --- | --- | --- |
| CL-L1 | launcher 0.19.0 | JM Connect holt Cloud-Raum, Zoom-Anmeldung und „Zoom-SDK laden“ ab Connect 0.5.0 über die Anmeldung im Launcher. Dafür braucht es diese Launcher-Version. |
| CL-L2 | launcher 0.19.0 | Zoom-Freigaben für Externe wirken jetzt in Connect: ab dem nächsten Start des Launchers und nur auf JM-Rechnern unter Windows. |
| CL-L3 | launcher 0.19.0 | Der Konto-Dialog nennt unter „An Tools ausgegeben“ auch die Freigaben für Connect. Der Reiter „Geräte“ der Admin-Maske zeigt in einer eigenen Zeile, bis wann ältere Connect-Versionen ihren alten Schlüssel noch nutzen dürfen. |
| CL-C1 | connect 0.5.0 | Cloud-Raum, Zoom und „Zoom-SDK laden“ laufen jetzt über die Anmeldung im Launcher (ab Launcher 0.19.0). Proxy-Key, Zoom-Zugangsdaten und SDK-Schlüssel muss niemand mehr eintragen. |
| CL-C2 | connect 0.5.0 | Connect hält seine Freigaben 72 Stunden, auch über einen Neustart und bei geschlossenem Launcher. Ein laufendes Meeting und ein Wiederbeitritt hängen nicht am Launcher. |
| CL-C3 | connect 0.5.0 | Alte Schlüssel und Zugangsdaten gelten im Übergang weiter und werden gelöscht, sobald die Anmeldung einmal geklappt hat. Das gemerkte Meeting bleibt. |
| CL-C4 | connect 0.5.0 | „Zoom-SDK laden“ gibt es nur auf JM-Rechnern; auf anderen Rechnern wählt man den SDK-Ordner von Hand. |
| CL-C5 | connect 0.5.0 | Shows mit sehr kurzem Namen (unter 6 Zeichen) bekommen jetzt einen Cloud-Raum, den der Server annimmt. |

---

## Phase A · Worker (ein Deploy, abwärtskompatibel)

### Task 1: Zwecke, Ziele und Rechte für Connect am Worker

**Files:**
- Modify: `services/release-proxy/konto-kern.js:12-13` (Konstanten), nach `darf` (`:88-117`) neue Exporte
- Modify: `services/release-proxy/konto-relay.js:10`, `:196-207` (`freigabe`)
- Create: `services/release-proxy/test/zweck-faelle.json`
- Modify: `services/release-proxy/test/konto-attrappen.mjs` (zwei Helfer, vor `neuerSpeicher` `:314`)
- Test: `services/release-proxy/test/konto-kern.test.mjs:84-96` und neue Prüfungen vor `abschluss`; `services/release-proxy/test/konto-routen.test.mjs:288-297` und ein neuer Block

**Interfaces:**
- Consumes: `darf(stand, funktion, {event, jetzt})` (`konto-kern.js:88`), `signiere(schluesselB64, claims)` (`konto-krypto.js:72`).
- Produces:
  - `FREIGABE_MS = { 'qa-relay', 'connect-raum', 'zoom-jwt', 'zoom-sdk' }` je `259_200_000`
  - `ZWECK_FUNKTION = { 'qa-relay': 'qa', 'connect-raum': 'connect-raum', 'zoom-jwt': 'zoom', 'zoom-sdk': 'zoom' }`
  - `ZIEL_ZOOM_JWT = 'meeting-sdk'`, `ZIEL_ZOOM_SDK = 'win-x64'`
  - `ZWECK_ZIEL: Readonly<Record<Zweck, RegExp>>` = `qa-relay` `/^[A-Za-z0-9_-]{1,128}$/`, `connect-raum` `/^[A-Za-z0-9_-]{6,64}$/`, `zoom-jwt` `/^meeting-sdk$/`, `zoom-sdk` `/^win-x64$/`
  - `zweckDarf(stand, zweck, { jetzt }): 'ja' | 'kein-recht' | 'kein-jm-rechner'` — unbekannter Zweck oder `darf(stand, ZWECK_FUNKTION[zweck])` falsch → `'kein-recht'`; sonst `zoom-sdk` mit `stand.jm !== true` → `'kein-jm-rechner'`; sonst `'ja'`
  - `POST /konto/freigabe`: 400 `unbekannter-zweck` | 400 `ungueltig` (Ziel passt nicht auf `ZWECK_ZIEL[zweck]`) | 403 `kein-recht` (jedes `zweckDarf` ≠ `'ja'`) | 200 `{ freigabe, bis }`
  - Testhelfer `testSitzung(schluessel, { stufe='kollege', tools=[], zoom=stufe!=='externer', jm=true, plattform='win', kid='k-test', gid='g-test', jetzt, exp=jetzt+3600_000 }): Promise<string>` (Claims wie `kontoStand`, `email 'test@example.org'`, `name 'Test Person'`, `art 'passwort'`, `events []`, `zoomBis null`, `kontoBis null`, `angemeldetSeit jetzt`) und `testFreigabe(schluessel, { zweck, ziel, kid='k-test', gid='g-test', jetzt, exp=jetzt+259_200_000 }): Promise<string>` (`{v:1, typ:'freigabe', zweck, ziel, kid, gid, iat: jetzt, exp}`)

- [ ] **Step 1: Falltabelle erzeugen (Wegwerf-Skript nur im Scratchpad, nicht committen)**

Die Tabelle ist die gemeinsame Wahrheit für Worker (Task 1) und Launcher (Task 8). Regel = Entwurf „Zwecke und Ziele“, OF1, OF4, OT4:

```js
// node erzeuge.mjs > services/release-proxy/test/zweck-faelle.json
const Z = ['qa-relay', 'connect-raum', 'zoom-jwt', 'zoom-sdk'], S = ['admin', 'kollege', 'externer'];
const soll = (z, s) => {
  if (!s || s.exp === 'abgelaufen') return 'kein-recht';
  const intern = s.stufe !== 'externer';
  if (z === 'qa-relay') return intern || s.tools.includes('qa') ? 'ja' : 'kein-recht';
  if (z === 'connect-raum') return intern || s.tools.includes('connect-raum') ? 'ja' : 'kein-recht';
  const zoom = s.plattform === 'win' && (intern || (s.zoom && s.jm));
  if (!zoom) return 'kein-recht';
  return z === 'zoom-sdk' && !s.jm ? 'kein-jm-rechner' : 'ja';
};
const f = [];
for (const z of Z) {
  f.push({ name: `${z} · ohne Stand`, stand: null, zweck: z, erwartet: 'kein-recht' });
  const ab = { stufe: 'kollege', tools: [], events: [], zoom: true, jm: true, plattform: 'win', exp: 'abgelaufen' };
  f.push({ name: `${z} · Kollege · abgelaufen`, stand: ab, zweck: z, erwartet: 'kein-recht' });
  for (const st of S) for (const t of [[], ['connect-raum', 'qa']]) for (const zo of [true, false]) for (const jm of [true, false]) for (const pf of ['win', 'mac']) {
    const s = { stufe: st, tools: t, events: [], zoom: zo, jm, plattform: pf, exp: 'gueltig' };
    f.push({ name: `${z} · ${st} · Werkzeuge ${t.length ? 'ja' : 'nein'} · Zoom ${zo ? 'ja' : 'nein'} · ${jm ? 'JM' : 'kein JM'} · ${pf}`, stand: s, zweck: z, erwartet: soll(z, s) });
  }
}
console.log('[\n' + f.map((x) => '  ' + JSON.stringify(x)).join(',\n') + '\n]');
```

Erwartet: 200 Fälle, Namen einmalig.

- [ ] **Step 2: Die failing tests schreiben**

In `konto-kern.test.mjs` die Konstanten-Prüfung (`:85-95`) an die neuen Werte anpassen und danach einfügen:

```js
const ZFAELLE = JSON.parse(readFileSync(new URL('./zweck-faelle.json', import.meta.url), 'utf8'));
check('T1 OT1: Zwecke, Funktionen, Ziele und 72 h für Connect',
  JSON.stringify(Object.keys(FREIGABE_MS)) === '["qa-relay","connect-raum","zoom-jwt","zoom-sdk"]'
    && Object.values(FREIGABE_MS).every((ms) => ms === 3 * TAG)
    && JSON.stringify(ZWECK_FUNKTION) === '{"qa-relay":"qa","connect-raum":"connect-raum","zoom-jwt":"zoom","zoom-sdk":"zoom"}'
    && ZIEL_ZOOM_JWT === 'meeting-sdk' && ZIEL_ZOOM_SDK === 'win-x64');
pruefeFaelle('T1 5.5: Ziel je Zweck', [
  ['connect-raum', 'abcde', false], ['connect-raum', 'abcdef', true], ['connect-raum', 'a'.repeat(64), true],
  ['connect-raum', 'a'.repeat(65), false], ['connect-raum', 'raum.1', false], ['zoom-jwt', 'meeting-sdk', true],
  ['zoom-jwt', 'x1', false], ['zoom-sdk', 'win-x64', true], ['zoom-sdk', '7.1.5.43953', false], ['qa-relay', 'e', true],
].map(([z, ziel, soll]) => ({ name: `${z} ${ziel}`, z, ziel, soll })), (c) => gleich(ZWECK_ZIEL[c.z].test(c.ziel), c.soll));
check('T1 OT4: Falltabelle zweck-faelle.json: 200 Fälle, Namen einmalig, jeder Zweck ohne Stand und abgelaufen',
  ZFAELLE.length === 200 && new Set(ZFAELLE.map((c) => c.name)).size === 200
    && ['qa-relay', 'connect-raum', 'zoom-jwt', 'zoom-sdk'].every((z) => ZFAELLE.some((c) => c.zweck === z && c.stand === null)));
pruefeFaelle('T1 OT4, OF1, OF4: zweckDarf nach der Falltabelle', ZFAELLE, (c) =>
  gleich(zweckDarf(standAus(c.stand), c.zweck, { jetzt: JETZT }), c.erwartet));
check('T1 OT4: unbekannter Zweck → kein-recht', zweckDarf({ ...standAus(ZFAELLE[2].stand) }, 'toString', { jetzt: JETZT }) === 'kein-recht');
```

In `konto-routen.test.mjs:291` den Fall „unbekannter Zweck“ auf `zweck: 'zoom-xyz'` stellen und einen eigenen Block `{ const env = umgebung(); const uhr = env.KONTO_UHR; … }` vor der Ende-Marke einfügen (Sitzungen über `testSitzung`, ohne DO):

```js
// T1 OT1: Freigaben für Connect, Ziel je Zweck, Rechte (OF1, OF4, OT4)
const s = (o) => testSitzung(SCHLUESSEL, { jetzt: uhr(), ...o });
const fr = async (sitzung, zweck, ziel) => api(env, 'POST', '/konto/freigabe', { sitzung, body: { zweck, ziel } });
const ok = await fr(await s({ stufe: 'kollege', jm: false }), 'zoom-jwt', 'meeting-sdk');
const c = await pruefeToken(SCHLUESSEL, ok.daten.freigabe, 'freigabe', uhr());
check('T1 OT1: Kollege auf Nicht-JM-Rechner bekommt zoom-jwt (OF1): 200, Ziel meeting-sdk, bis = jetzt + 72 h',
  ok.status === 200 && c.zweck === 'zoom-jwt' && c.ziel === 'meeting-sdk' && ok.daten.bis === uhr() + 259_200_000);
await pruefeFaelle('T1 OT1, OT4: Freigaben für Connect', [
  { name: 'Admin connect-raum cop31-tag1', a: await fr(await s({ stufe: 'admin' }), 'connect-raum', 'cop31-tag1'), s: [200] },
  { name: 'Externer mit Werkzeug connect-raum', a: await fr(await s({ stufe: 'externer', tools: ['connect-raum'] }), 'connect-raum', 'cop31-tag1'), s: [200] },
  { name: 'Kollege JM zoom-sdk', a: await fr(await s({ jm: true }), 'zoom-sdk', 'win-x64'), s: [200] },
  { name: 'Externer Zoom-Freigabe JM zoom-jwt', a: await fr(await s({ stufe: 'externer', zoom: true, jm: true }), 'zoom-jwt', 'meeting-sdk'), s: [200] },
  { name: 'Externer ohne Werkzeug connect-raum', a: await fr(await s({ stufe: 'externer' }), 'connect-raum', 'cop31-tag1'), s: [403, 'kein-recht'] },
  { name: 'Externer ohne Zoom-Freigabe zoom-jwt', a: await fr(await s({ stufe: 'externer', zoom: false, jm: true }), 'zoom-jwt', 'meeting-sdk'), s: [403, 'kein-recht'] },
  { name: 'Externer Freigabe, Nicht-JM zoom-jwt', a: await fr(await s({ stufe: 'externer', zoom: true, jm: false }), 'zoom-jwt', 'meeting-sdk'), s: [403, 'kein-recht'] },
  { name: 'Kollege Mac zoom-jwt', a: await fr(await s({ plattform: 'mac' }), 'zoom-jwt', 'meeting-sdk'), s: [403, 'kein-recht'] },
  { name: 'Kollege Nicht-JM zoom-sdk', a: await fr(await s({ jm: false }), 'zoom-sdk', 'win-x64'), s: [403, 'kein-recht'] },
  { name: 'zoom-jwt mit Ziel x1', a: await fr(await s({}), 'zoom-jwt', 'x1'), s: [400, 'ungueltig'] },
  { name: 'connect-raum mit Ziel abc', a: await fr(await s({}), 'connect-raum', 'abc'), s: [400, 'ungueltig'] },
  { name: 'zoom-sdk mit Fassung', a: await fr(await s({}), 'zoom-sdk', '7.1.5.43953'), s: [400, 'ungueltig'] },
], (x) => (x.s.length === 1 ? (x.a.status === 200 ? null : `ist ${ist(x.a)}`) : (soll(x.a, ...x.s) ? null : `ist ${ist(x.a)}`)));
```

- [ ] **Step 3: Laufen lassen, Rot sehen**

Run: `node --experimental-strip-types services/release-proxy/test/konto-kern.test.mjs` und `… konto-routen.test.mjs`
Expected: FAIL bei den `T1 …`-Zeilen bzw. SyntaxError beim Import von `zweckDarf`; alle übrigen Prüfungen unverändert `ok`.

- [ ] **Step 4: Konstanten, `zweckDarf`, Ziel-Regel und Testhelfer umsetzen**

`konto-kern.js` nach Interfaces. `konto-relay.js` `freigabe`: Zweck prüfen wie bisher (`Object.hasOwn(ZWECK_FUNKTION, zweck)`), das Ziel mit `ZWECK_ZIEL[zweck].test(ziel)` statt mit dem festen Muster, das Recht mit `zweckDarf(stand, zweck, { jetzt: k.jetzt }) !== 'ja'` → 403 `kein-recht`; Kommentar im Kopf von `konto-kern.js:1-4` um „Teil 2: Zwecke für Connect, `zweckDarf`“ ergänzen. Helfer in `konto-attrappen.mjs` nach Interfaces (Import `signiere` aus `../konto-krypto.js`).

- [ ] **Step 5: Laufen lassen, Grün sehen**

Run: `node --experimental-strip-types services/release-proxy/test/konto-kern.test.mjs`, `… konto-routen.test.mjs`, `… konto-zugang.test.mjs`, `… qa-relay.test.mjs`
Expected: je `‹n› passed, 0 failed`.

- [ ] **Step 6: Commit**

```bash
git add services/release-proxy/konto-kern.js services/release-proxy/konto-relay.js services/release-proxy/test/zweck-faelle.json services/release-proxy/test/konto-attrappen.mjs services/release-proxy/test/konto-kern.test.mjs services/release-proxy/test/konto-routen.test.mjs
git status --short
git commit -m "feat(proxy): Zwecke connect-raum, zoom-jwt, zoom-sdk mit festen Zielen und JM-Pruefung (Anmeldung Teil 2)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 2: Konten-DO: Raum-Inhaber, Alt-Key-Gruppe `connect`, Connect-Frist, JWT-Protokoll

**Files:**
- Modify: `services/release-proxy/konto-do.js:31` (Schlüssel-Kommentar), `:85-104` (`K`, Konstanten), `:105-128` (`AKTIONEN`), `:1036-1048` (`altkeyZaehlen`), `:1050-1092` (`qaInhaber` → gemeinsamer Kern), `:1155-1172` (`adminUebersicht`)
- Modify: `services/release-proxy/konto-zugang.js:24-45` (`FEHLER_TEXT`), `:315` (`altKeyZaehlen` exportieren)
- Test: `services/release-proxy/test/konto-do.test.mjs:1325-1342` und neue Blöcke vor der Ende-Marke

**Interfaces:**
- Produces:
  - DO-Aktion `connect-inhaber` `{ raumHash: hex64, kidHash?: hex64, gidHash?: hex64, bisMs: number, loesen?: true }` → `{ ok: true, inhaber, neu }` | 403 `raum-vergeben` | 400 `ungueltig`. Gleiche Regeln wie `qa-inhaber` (`:1050-1061`), Schlüssel `connect:<raumHash>`, Deckel `QA_INHABER_MAX_MS`, Schritt `QA_INHABER_SCHRITT_MS`. `loesen: true` braucht beide Hashes: kein Inhaber → `{ ok: true, inhaber: null, neu: false }`; `kidHash` oder `gidHash` gleich → löschen, `{ ok: true, inhaber: null, neu: false }`; sonst 403 `raum-vergeben`.
  - DO-Aktion `zoom-jwt-protokoll` `{ kid: string, gid: string }` (je 1–128 Zeichen, sonst 400) → `{ ok: true }`; genau ein `protokolliere({ am: jetzt, wer: 'system', was: 'zoom-jwt', wen: ‹E-Mail des Kontos oder kid›, details: { kid, gid } })`.
  - `altkey-zaehlen` nimmt die Gruppe `connect` an.
  - `admin-uebersicht` → `altKey: { bis, diagnose, zeilen, connect: { bis, diagnose } }` aus `alterKeyGilt(this.env, 'connect', jetzt)`.
  - `konto-zugang.js`: `FEHLER_TEXT['raum-vergeben']` = Text S20; `export function altKeyZaehlen(request, env, ctx, gruppe, jetzt): void` (Body unverändert).

- [ ] **Step 1: Die failing tests schreiben**

In `konto-do.test.mjs:1335-1341` die Gruppe `connect` als gezählt erwarten: `soll` beginnt mit `['altkey:2026-10-21:connect:win-x64', 1, T0]`, `connect.http === 200`, Prüfname `P5 OF2, T2 OT5: Alt-Key-Zählung je Tag (UTC), Gruppe (katalog, qa, connect) und Plattform-Architektur`. Neue Blöcke (Hashes wie im Worker: `sha256Hex('connect-raum|r')` usw.; `HEX = (c) => c.repeat(64)`):

```js
await pruefeFaelle('T2 OT7: connect-inhaber bindet die erste Freigabe, danach Konto ODER Rechner', [
  { name: 'erste Freigabe bindet', r: await ci({ raumHash: HEX('a'), kidHash: HEX('1'), gidHash: HEX('2') }), soll: [200, true] },
  { name: 'gleiches Konto, anderer Rechner', r: await ci({ raumHash: HEX('a'), kidHash: HEX('1'), gidHash: HEX('9') }), soll: [200, false] },
  { name: 'anderes Konto, gleicher Rechner', r: await ci({ raumHash: HEX('a'), kidHash: HEX('8'), gidHash: HEX('2') }), soll: [200, false] },
  { name: 'fremd', r: await ci({ raumHash: HEX('a'), kidHash: HEX('8'), gidHash: HEX('9') }), soll: [403, 'raum-vergeben'] },
  { name: 'alter Schlüssel, gebunden', r: await ci({ raumHash: HEX('a') }), soll: [403, 'raum-vergeben'] },
  { name: 'alter Schlüssel, ungebunden', r: await ci({ raumHash: HEX('b') }), soll: [200, false] },
  { name: 'nur kidHash', r: await ci({ raumHash: HEX('b'), kidHash: HEX('1') }), soll: [400, 'ungueltig'] },
], (x) => (x.r.http === x.soll[0] && (x.soll[0] === 200 ? x.r.neu === x.soll[1] : x.r.code === x.soll[1]) ? null : `ist ${x.r.http} ${x.r.code ?? x.r.neu}`));
check('T2 OT7: loesen nur durch den Inhaber; danach bindet eine fremde Freigabe neu',
  (await ci({ raumHash: HEX('a'), kidHash: HEX('8'), gidHash: HEX('9'), loesen: true })).http === 403
    && (await ci({ raumHash: HEX('a'), kidHash: HEX('1'), gidHash: HEX('7'), loesen: true })).http === 200
    && (await ci({ raumHash: HEX('a'), kidHash: HEX('8'), gidHash: HEX('9') })).neu === true);
check('T2 OT7: connect- und qa-Inhaber getrennt (gleicher Hash): ein gebundener Raum bindet kein Q&A-Event',
  (await rufeDo(sp, 'qa-inhaber', { eventHash: HEX('a'), kidHash: HEX('5'), gidHash: HEX('6'), bisMs: T0 + TAG })).neu === true);
check('T2 OT5: Übersicht nennt die Connect-Frist: leer → ohne-ende, 2027-01-19 → bis 2027-01-19T00:00:00.000Z, 2027-13-01 → unlesbar',
  (await ueb({})).altKey.connect.diagnose === 'ohne-ende'
    && (await ueb({ ALTKEY_CONNECT_BIS: '2027-01-19' })).altKey.connect.bis === '2027-01-19T00:00:00.000Z'
    && (await ueb({ ALTKEY_CONNECT_BIS: '2027-13-01' })).altKey.connect.diagnose === 'unlesbar');
check('T2 R2: zoom-jwt-protokoll schreibt genau einen Eintrag mit E-Mail, kid, gid; leere kid → 400',
  (await rufeDo(sp, 'zoom-jwt-protokoll', { kid: kid1, gid: 'g-test' })).ok === true
    && logEintraege().filter((e) => e.was === 'zoom-jwt').length === 1
    && JSON.stringify(logEintraege().find((e) => e.was === 'zoom-jwt').details) === JSON.stringify({ kid: kid1, gid: 'g-test' })
    && (await rufeDo(sp, 'zoom-jwt-protokoll', { kid: '', gid: 'g-test' })).http === 400);
```

`ci(b)` = `rufeDo(sp, 'connect-inhaber', { bisMs: T0 + 25 * 3600_000, ...b })`; `ueb(envMehr)` ruft `admin-uebersicht` eines Admins in einem Speicher mit `envMehr`; `logEintraege()` liest `ctx.storage.list({ prefix: 'log:' })`.

- [ ] **Step 2: Laufen lassen, Rot sehen**

Run: `node --experimental-strip-types services/release-proxy/test/konto-do.test.mjs`
Expected: FAIL bei `P5 OF2, T2 OT5 …` und allen `T2 …`; die `qa-inhaber`-Prüfungen bleiben `ok`.

- [ ] **Step 3: DO-Aktionen, Gruppe und Frist umsetzen**

`qaInhaber` und `connectInhaber` rufen einen privaten Kern `async inhaberSetzen(key, b, jetzt, code)` mit dem bisherigen Body von `qaInhaber` (`:1062-1090`, Hash-Feld als Parameter, Ablehnungscode `keine-freigabe` bzw. `raum-vergeben`), dazu der Zweig `loesen`. `altkeyZaehlen` (`:1042`) erlaubt `connect`. `adminUebersicht` ergänzt `connect` im Objekt `altKey`. `FEHLER_TEXT` bekommt S20, `altKeyZaehlen` wird exportiert.

- [ ] **Step 4: Laufen lassen, Grün sehen**

Run: `node --experimental-strip-types services/release-proxy/test/konto-do.test.mjs`, `… qa-relay.test.mjs`, `… konto-zugang.test.mjs`
Expected: je `‹n› passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add services/release-proxy/konto-do.js services/release-proxy/konto-zugang.js services/release-proxy/test/konto-do.test.mjs
git status --short
git commit -m "feat(proxy): Konten-DO mit Raum-Inhaber, Alt-Key-Gruppe connect, Connect-Frist und JWT-Protokoll (Anmeldung Teil 2)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 3: Cloud-Raum am Worker über die Tür (`connect-relay.js`)

**Files:**
- Modify: `services/release-proxy/connect-relay.js:25-34` (Importe), `:52-93` (`handleConnect`), `:125-130` (`keyOk` entfällt), neue Helfer nach `roomStub`
- Modify: `services/release-proxy/worker.js:155` (`handleConnect(request, env, url, ctx)`)
- Modify: `services/release-proxy/konto-zugang.js:103-112` (`KONTO_RL.connectAlt`), `:266`, `:288-296` (Option `zweck`)
- Modify: `services/release-proxy/wrangler.toml:55-60`, nach `:107` (Eintrag `KONTO_RL_CONNECTALT`)
- Modify: `services/release-proxy/tools/bauprobe.mjs:35-44`, `:58` (Zeile in `RL_SOLL`, Befundtext ohne Zahl)
- Modify: `services/release-proxy/test/konto-attrappen.mjs:223-231` (`RL_TABELLE`), `:258` (Kommentar ohne Zahl)
- Modify: `services/release-proxy/test/konto-zugang.test.mjs:283-291` (P15 G10), `:636-640` (Name und Zählung ohne feste Zahl), `:676-677` (CI-Liste)
- Modify: `.github/workflows/ci-checks.yml:136-137` (neuer Schritt nach Q&A-Relay)
- Create: `services/release-proxy/test/connect-zugang.test.mjs`

**Interfaces:**
- Consumes: `zugangPruefen`, `kontoAktion`, `drosselBindung`, `abgelehnt`, `kontoJetzt` (`konto-zugang.js`); DO `connect-inhaber` (Task 2); `testSitzung`, `testFreigabe` (Task 1).
- Produces:
  - `zugangPruefen(request, env, { funktion, zweck = null, gruppe, ziel, jetzt, ctx })`: mit `zweck` gilt eine Freigabe nur, wenn `freigabe.zweck === zweck` (sonst 403 `kein-recht`); ohne `zweck` wie bisher.
  - `KONTO_RL.connectAlt = 'KONTO_RL_CONNECTALT'`; `wrangler.toml` `name = "KONTO_RL_CONNECTALT"`, `namespace_id = "7308"`, `limit = 20`, `period = 60`.
  - `handleConnect(request, env, url, ctx)`. Admin-Route (POST/DELETE ohne Unterpfad), in dieser Reihenfolge: `zugangPruefen({ funktion: 'connect-raum', zweck: 'connect-raum', gruppe: 'connect', ziel: id, jetzt, ctx })` → Ablehnung als `{ error, code }` mit ihrem Status; bei `art === 'alter-key'` Drossel `KONTO_RL_CONNECTALT` → 429 `{ error: 'zu viele Anfragen', code: 'zu-viele' }`, `Retry-After: 60`; ohne `CONNECT_ROOM` 503 wie heute; Inhaber über `connect-inhaber` (`raumHash = sha256Hex('connect-raum|' + id)`, `kidHash = sha256Hex('connect-inhaber|kid|' + kid)`, `gidHash` entsprechend, `bisMs = jetzt + 25 * 3600_000`) → 403 `raum-vergeben` (S20) bzw. 503 `nicht-eingerichtet` bei jedem anderen Ausgang (nie offen); dann der DO wie heute; nach DELETE mit Status 200 und `art === 'freigabe'` `connect-inhaber` mit `loesen: true` (Fehler nur als Warnung).
  - öffentliche Routen (Gast-Seite, `state`, `ice`, `ws`) unverändert.

- [ ] **Step 1: Die failing tests schreiben**

`connect-zugang.test.mjs` (Kopf wie `qa-relay.test.mjs`: Mitschnitt der Konsole, `worker` aus `../worker.js`, `KS = testSchluessel()`, `uhr = makeUhr()`, `ctx = makeWaitCtx()`, `env = { KONTO_SCHLUESSEL: KS, PROXY_KEY: 'test-proxy-key', CONNECT_ROOM: raumNs(), ...makeRLBindungen(), KONTO_UHR: uhr }` und danach `env.KONTO = makeKontoNs(env)`, `raumNs()` = Attrappe, die jede Anfrage mit Methode und Kopfzeilen merkt und 200 `{"ok":true}` antwortet, `quelle` = Inhalt von `../connect-relay.js`):

```js
const auf = (id, kopf, method = 'POST') => worker.fetch(new Request(`https://proxy.test/connect/${id}`, { method, headers: { 'CF-Connecting-IP': '9.9.9.9', 'content-type': 'application/json', ...kopf }, body: method === 'POST' ? JSON.stringify({ secretHex: 'a'.repeat(64) }) : undefined }), env, ctx);
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
const fA = await testFreigabe(KS, { zweck: 'connect-raum', ziel: 'cop31-tag1', jetzt: uhr() });
check('T3 9.1: POST /connect/cop31-tag1 mit Freigabe für genau diese ID → 200, Raum erreicht', (await auf('cop31-tag1', bearer(fA))).status === 200);
await pruefeFaelle('T3 RF3: Gegenproben am Cloud-Raum', [
  { name: 'Sitzung statt Freigabe', r: await auf('cop31-tag1', bearer(await testSitzung(KS, { jetzt: uhr() }))), s: [403, 'keine-freigabe'] },
  { name: 'Freigabe für Raum A an Raum B', r: await auf('cop31-tag2', bearer(fA)), s: [403, 'keine-freigabe'] },
  { name: 'zoom-jwt (Ziel meeting-sdk) an /connect/meeting-sdk', r: await auf('meeting-sdk', bearer(await testFreigabe(KS, { zweck: 'zoom-jwt', ziel: 'meeting-sdk', jetzt: uhr() }))), s: [403, 'kein-recht'] },
  { name: 'fremdes Konto, fremder Rechner, gebundener Raum', r: await auf('cop31-tag1', bearer(await testFreigabe(KS, { zweck: 'connect-raum', ziel: 'cop31-tag1', kid: 'k-2', gid: 'g-2', jetzt: uhr() }))), s: [403, 'raum-vergeben'] },
  { name: 'abgelaufene Freigabe', r: await auf('cop31-tag1', bearer(await testFreigabe(KS, { zweck: 'connect-raum', ziel: 'cop31-tag1', jetzt: uhr() - 259_200_001 }))), s: [401, 'sitzung-abgelaufen'] },
  { name: 'ohne Kopf', r: await auf('cop31-tag1', {}), s: [401, 'nicht-angemeldet'] },
], async (x) => (x.r.status === x.s[0] && (await x.r.json()).code === x.s[1] ? null : `ist ${x.r.status}`));
check('T3 OT7: gleiches Konto auf anderem Rechner und anderes Konto auf gleichem Rechner → 200',
  (await auf('cop31-tag1', bearer(await testFreigabe(KS, { zweck: 'connect-raum', ziel: 'cop31-tag1', gid: 'g-9', jetzt: uhr() })))).status === 200
    && (await auf('cop31-tag1', bearer(await testFreigabe(KS, { zweck: 'connect-raum', ziel: 'cop31-tag1', kid: 'k-9', jetzt: uhr() })))).status === 200);
check('T3 RF5: DELETE des Inhabers löst die Bindung; danach öffnet ein fremdes Konto auf fremdem Rechner denselben Raum',
  (await auf('cop31-tag1', bearer(fA), 'DELETE')).status === 200
    && (await auf('cop31-tag1', bearer(await testFreigabe(KS, { zweck: 'connect-raum', ziel: 'cop31-tag1', kid: 'k-2', gid: 'g-2', jetzt: uhr() })))).status === 200);
// Alter Schlüssel (OT5, R1): Stichtag, Bindung, Drossel, Zählung
check('T3 OT5: alter PROXY_KEY: ALTKEY_CONNECT_BIS leer → 200, auch nach ALTKEY_BIS; vor dem Stichtag 200; am Stichtag 401 alter-key-abgelaufen; unlesbar → 200', …);
check('T3 R1: alter Schlüssel an gebundenem Raum → 403 raum-vergeben; an ungebundenem → 200 ohne Bindung (danach bindet eine Freigabe)', …);
check('T3 R1: alter Schlüssel je IP gedrosselt (21. Anfrage → 429, Retry-After 60), Freigaben nicht', …);
check('T3 OT5: angenommener alter Schlüssel wird einmal je IP und Tag in Gruppe connect gezählt (waitUntil)', …);
check('T3: Konten-DO wirft → 503 nicht-eingerichtet, Raum-DO nie gerufen', …);
check('T3 R1: connect-relay.js hat kein keyOk und keinen Vergleich mit === env.PROXY_KEY', !/keyOk|===\s*env\.PROXY_KEY/.test(quelle));
abschluss();
```

Die fünf Prüfungen mit `…` bauen ihre Anfragen nach demselben Muster (`auf(id, { 'X-Proxy-Key': 'test-proxy-key' })`, `uhr.stelle(…)`, `env.ALTKEY_CONNECT_BIS`, `ctx.fertig()` und `ctx.storage` des Konten-DO für die Zählung). In `konto-zugang.test.mjs:283-291` die Prüfungen auf `T3 OT5: POST /connect/room-1 mit altem Key nach ALTKEY_BIS → 200 (Connect-Frist leer)` und `T3: ohne Key → 401 nicht-angemeldet` umstellen (`KONTO: makeKontoNs(env)` dazu, `b2.code === 'nicht-angemeldet'`). Die Ratelimit-Prüfung (`:636`) heißt `Z1-W2 AR70: wrangler.toml hat genau die [[ratelimits]] aus RL_TABELLE …` und vergleicht `size` mit `Object.keys(RL_TABELLE).length`. Die CI-Liste (`:676-677`) endet mit `'qa-relay', 'connect-zugang'`.

- [ ] **Step 2: Laufen lassen, Rot sehen**

Run: `node --experimental-strip-types services/release-proxy/test/connect-zugang.test.mjs`
Expected: FAIL bei allen `T3 …` außer `T3: ohne Kopf` (heute 401 ohne `code`); dazu `konto-zugang.test.mjs` FAIL bei der Ratelimit- und der CI-Prüfung.

- [ ] **Step 3: Zugang, Drossel, Bindung und Konfiguration umsetzen**

`connect-relay.js` nach Interfaces; `sha256Hex` wie `qa-relay.js:363-366`; der Kommentar `:9-10` und `:48-51` nennt „Sitzung, Freigabe oder alter Schlüssel bis ALTKEY_CONNECT_BIS (zugangPruefen)“. `wrangler.toml`: Eintrag nach `KONTO_RL_QAALT` mit Kommentar `# KONTO_RL_CONNECTALT: /connect/:raum (Öffnen, Schließen) mit dem alten Schlüssel, vor der Inhaber-Prüfung im Konten-DO`; der Kopfkommentar (`:55-60`) sagt „diese Einträge“ statt „diese sieben Einträge“. `bauprobe.mjs` `RL_SOLL` um `['KONTO_RL_CONNECTALT', '7308', 20, 60]`, Befundtext „genau die Einträge KONTO_RL_* aus RL_SOLL“. `RL_TABELLE` entsprechend. CI-Schritt:

```yaml
      - name: Release-Proxy (Connect-Raum über die Anmeldung, Bindung, alter Schlüssel)
        run: node --experimental-strip-types services/release-proxy/test/connect-zugang.test.mjs
```

- [ ] **Step 4: Laufen lassen, Grün sehen**

Run: `node --experimental-strip-types services/release-proxy/test/connect-zugang.test.mjs`, `… worker.test.mjs`, `… konto-zugang.test.mjs`, `… qa-relay.test.mjs`, `node --experimental-strip-types services/release-proxy/test/connect-do.test.mjs`, `node services/release-proxy/tools/bauprobe.mjs`
Expected: je `‹n› passed, 0 failed`; Bauprobe Exit 0 mit „Drosseln aus wrangler.toml: … KONTO_RL_CONNECTALT 20/60 s“.

- [ ] **Step 5: Commit**

```bash
git add services/release-proxy/connect-relay.js services/release-proxy/worker.js services/release-proxy/konto-zugang.js services/release-proxy/wrangler.toml services/release-proxy/tools/bauprobe.mjs services/release-proxy/test/konto-attrappen.mjs services/release-proxy/test/konto-zugang.test.mjs services/release-proxy/test/connect-zugang.test.mjs .github/workflows/ci-checks.yml
git status --short
git commit -m "feat(proxy): Cloud-Raum ueber Freigabe connect-raum, Raum-Bindung, alter Schluessel zeitkonstant bis ALTKEY_CONNECT_BIS (Anmeldung Teil 2)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 4: `/zoom-sdk` mit Freigabe oder `ZOOM_SDK_KEY` bis zum Stichtag

**Files:**
- Modify: `services/release-proxy/worker.js:14-16` (Vertragskommentar), `:158-161` (`ctx` durchreichen), `:443-460` (`handleZoomSdk`)
- Test: `services/release-proxy/test/worker.test.mjs` (neuer Block nach dem Zoom-SDK-Block, vor dessen Aufräumen der Konsole)

**Interfaces:**
- Consumes: `zugangPruefen` mit `zweck` (Task 3), `altKeyZaehlen` und `FEHLER_TEXT` (Task 2), `alterKeyGilt`, `ZIEL_ZOOM_SDK` (Task 1).
- Produces: `handleZoomSdk(request, env, fassung, ctx)`. Reihenfolge: KV-Drossel und Fassung wie heute; Kopf `Authorization: Bearer jm1.…` → `zugangPruefen({ funktion: 'zoom', zweck: 'zoom-sdk', gruppe: null, ziel: ZIEL_ZOOM_SDK, jetzt: kontoJetzt(env), ctx })`, Ablehnung als `{ error, code }`; sonst der alte Weg wie heute (Vergleich, 401 `unauthorized`) und danach `alterKeyGilt(env, 'connect', jetzt).gilt === false` → 401 `{ error: FEHLER_TEXT['alter-key-abgelaufen'], code: 'alter-key-abgelaufen' }`, sonst `altKeyZaehlen(request, env, ctx, 'connect', jetzt)`; danach GitHub wie heute. Der Link bleibt das Einzige, was die Route liefert (Spec 173).

- [ ] **Step 1: Die failing tests schreiben**

```js
const zBearer = async (t) => worker.fetch(new Request(`https://proxy.test/zoom-sdk/${FASSUNG}`, { headers: { 'CF-Connecting-IP': '9.9.9.9', Authorization: `Bearer ${t}` } }), zEnvT, zCtx);
check('T4 9.1: /zoom-sdk mit Freigabe zoom-sdk (Ziel win-x64) → 200 mit Link, ohne X-Zoom-Sdk-Key',
  (await zBearer(await testFreigabe(KS, { zweck: 'zoom-sdk', ziel: 'win-x64', jetzt: uhr() }))).status === 200);
await pruefeFaelle('T4 RF3: Gegenproben an /zoom-sdk', [
  { name: 'Freigabe zoom-jwt', t: await testFreigabe(KS, { zweck: 'zoom-jwt', ziel: 'meeting-sdk', jetzt: uhr() }), s: [403, 'kein-recht'] },
  { name: 'zoom-sdk mit Ziel win-arm64', t: await testFreigabe(KS, { zweck: 'zoom-sdk', ziel: 'win-arm64', jetzt: uhr() }), s: [403, 'keine-freigabe'] },
  { name: 'Sitzung', t: await testSitzung(KS, { jetzt: uhr() }), s: [403, 'keine-freigabe'] },
  { name: 'abgelaufen', t: await testFreigabe(KS, { zweck: 'zoom-sdk', ziel: 'win-x64', jetzt: uhr() - 259_200_001 }), s: [401, 'sitzung-abgelaufen'] },
  { name: 'fremd signiert', t: await testFreigabe(testSchluessel(), { zweck: 'zoom-sdk', ziel: 'win-x64', jetzt: uhr() }), s: [401, 'nicht-angemeldet'] },
], async (x) => { const r = await zBearer(x.t); return r.status === x.s[0] && (await r.json()).code === x.s[1] ? null : `ist ${r.status}`; });
check('T4 OT5: ZOOM_SDK_KEY: Frist leer → 200; vor 2027-01-19 → 200; ab 2027-01-19 → 401 alter-key-abgelaufen; unlesbar → 200', …);
check('T4 OT5: angenommener ZOOM_SDK_KEY wird in Gruppe connect gezählt (ein DO-Aufruf altkey-zaehlen nach waitUntil)', …);
```

`zEnvT` = bisheriges `zEnv` plus `KONTO_SCHLUESSEL: KS`, `KONTO: makeKontoNs(…)`, `KONTO_UHR: uhr`; die `…`-Prüfungen stellen `ALTKEY_CONNECT_BIS` und `uhr` und schicken `X-Zoom-Sdk-Key: 'sdk-geheim-test'` wie die bestehenden Prüfungen ab `:377`.

- [ ] **Step 2: Laufen lassen, Rot sehen**

Run: `node --experimental-strip-types services/release-proxy/test/worker.test.mjs`
Expected: FAIL bei `T4 …`; die bestehenden `zoom-sdk …`-Prüfungen bleiben `ok`.

- [ ] **Step 3: Zwei Wege an `/zoom-sdk` umsetzen**

`handleZoomSdk` nach Interfaces; `worker.js:14-16` beschreibt beide Kopfzeilen und den Stichtag.

- [ ] **Step 4: Laufen lassen, Grün sehen**

Run: `node --experimental-strip-types services/release-proxy/test/worker.test.mjs`, `… connect-zugang.test.mjs`
Expected: je `‹n› passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add services/release-proxy/worker.js services/release-proxy/test/worker.test.mjs
git status --short
git commit -m "feat(proxy): /zoom-sdk mit Freigabe zoom-sdk, ZOOM_SDK_KEY bis ALTKEY_CONNECT_BIS (Anmeldung Teil 2)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 5: Zoom-JWT signieren (`zoom-jwt.js`)

**Files:**
- Create: `services/release-proxy/zoom-jwt.js`
- Create: `services/release-proxy/test/zoom-jwt.test.mjs`
- Modify: `.github/workflows/ci-checks.yml` (Schritt nach dem aus Task 3), `services/release-proxy/test/konto-zugang.test.mjs:676-677` (CI-Liste)

**Interfaces:**
- Produces:
  - `ZOOM_JWT_TTL_S = 43_200`, `ZOOM_JWT_VORLAUF_S = 30`
  - `signiereZoomJwt({ clientId: string, clientSecret: string, jetztMs: number, ttlSeconds?: number }): Promise<{ jwt: string, iat: number, exp: number }>`
  - `zoomZugangBrauchbar(clientId: unknown, clientSecret: unknown): boolean` — beide Zeichenketten, nicht leer, nur `\x21-\x7e` (also ohne Leerraum am Rand oder innen)

- [ ] **Step 1: Die failing tests schreiben**

```js
import { buildJwt } from '../../../packages/zoom-bridge/src/jwt.ts';
import { signiereZoomJwt, zoomZugangBrauchbar, ZOOM_JWT_TTL_S } from '../zoom-jwt.js';
const JETZT_MS = Date.UTC(2026, 10, 20, 9, 0, 0) + 789;
const teile = (jwt) => jwt.split('.').slice(0, 2).map((t) => JSON.parse(Buffer.from(t, 'base64url').toString('utf8')));
const r = await signiereZoomJwt({ clientId: 'test-id-1234', clientSecret: 'test-secret-5678', jetztMs: JETZT_MS });
const [kopf, nutz] = teile(r.jwt);
check('T5 OT2: Kopf {alg HS256, typ JWT}; Nutzlast genau appKey, iat, exp, tokenExp in dieser Reihenfolge; iat = jetzt − 30 s; exp = tokenExp = iat + 43 200; kein mn, keine role',
  JSON.stringify(kopf) === '{"alg":"HS256","typ":"JWT"}' && JSON.stringify(Object.keys(nutz)) === '["appKey","iat","exp","tokenExp"]'
    && nutz.appKey === 'test-id-1234' && nutz.iat === Math.floor(JETZT_MS / 1000) - 30 && nutz.exp === nutz.iat + ZOOM_JWT_TTL_S
    && nutz.tokenExp === nutz.exp && r.iat === nutz.iat && r.exp === nutz.exp);
const faelle = Array.from({ length: 50 }, (_, i) => ({ name: `Fall ${i}`, id: `test-id-${i}${i % 7 === 0 ? '-ä' : ''}`, secret: `test-secret-${(i * 7919) % 1000}`, ms: JETZT_MS + i * 3_600_123, ttl: 1800 + i * 600 }));
await pruefeFaelle('T5 OT2: byte-gleich zu buildJwt (packages/zoom-bridge/src/jwt.ts)', faelle, async (f) => {
  const w = await signiereZoomJwt({ clientId: f.id, clientSecret: f.secret, jetztMs: f.ms, ttlSeconds: f.ttl });
  return w.jwt === buildJwt({ clientId: f.id, clientSecret: f.secret, now: Math.floor(f.ms / 1000), ttlSeconds: f.ttl }) ? null : 'abweichend';
});
check('T5 OT2: Signatur mit HMAC-SHA256 und dem Secret prüfbar (WebCrypto verify)', await hmacGueltig(r.jwt, 'test-secret-5678'));
check('T5 RF4: zoomZugangBrauchbar: Leerraum am Rand oder innen, leer, kein Text → false; test-id und test-secret → true',
  [[' id', 's'], ['id\n', 's'], ['id', 's\r\n'], ['a b', 's'], ['', 's'], ['id', undefined]].every(([a, b]) => zoomZugangBrauchbar(a, b) === false)
    && zoomZugangBrauchbar('test-id', 'test-secret') === true);
abschluss();
```

`hmacGueltig(jwt, secret)` importiert den Schlüssel mit `crypto.subtle.importKey('raw', …, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])` und prüft den dritten Teil über `kopf.nutzlast`.

- [ ] **Step 2: Laufen lassen, Rot sehen**

Run: `node --experimental-strip-types services/release-proxy/test/zoom-jwt.test.mjs`
Expected: Abbruch mit `ERR_MODULE_NOT_FOUND` für `../zoom-jwt.js`.

- [ ] **Step 3: `signiereZoomJwt` und `zoomZugangBrauchbar` umsetzen**

Byte-Layout (die Tests legen es fest, hier die Form): `kopf = b64url(utf8('{"alg":"HS256","typ":"JWT"}'))`, `nutz = b64url(utf8(JSON.stringify({ appKey: clientId, iat, exp, tokenExp: exp })))` mit `iat = Math.floor(jetztMs / 1000) - 30`, `exp = iat + ttlSeconds`; `sig = b64url(HMAC-SHA256(utf8(clientSecret), utf8(kopf + '.' + nutz)))` über `crypto.subtle`; `b64url` = Base64 mit `-` statt `+`, `_` statt `/`, ohne `=`. Kein Import außer Web-APIs; keine Konsole.

- [ ] **Step 4: CI-Schritt und Wächter**

```yaml
      - name: Release-Proxy (Zoom-JWT signieren und ausstellen)
        run: node --experimental-strip-types services/release-proxy/test/zoom-jwt.test.mjs
```

Die CI-Liste in `konto-zugang.test.mjs` endet mit `'connect-zugang', 'zoom-jwt'`.

- [ ] **Step 5: Laufen lassen, Grün sehen**

Run: `node --experimental-strip-types services/release-proxy/test/zoom-jwt.test.mjs`, `… konto-zugang.test.mjs`
Expected: je `‹n› passed, 0 failed`.

- [ ] **Step 6: Commit**

```bash
git add services/release-proxy/zoom-jwt.js services/release-proxy/test/zoom-jwt.test.mjs services/release-proxy/test/konto-zugang.test.mjs .github/workflows/ci-checks.yml
git status --short
git commit -m "feat(proxy): Zoom-JWT im Worker signieren, byte-gleich zu buildJwt (Anmeldung Teil 2)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 6: `POST /zoom/jwt` (`zoom-relay.js`)

**Files:**
- Create: `services/release-proxy/zoom-relay.js`
- Modify: `services/release-proxy/worker.js:30-42` (Import), nach `:161` (Route vor `/konto/*`)
- Modify: `services/release-proxy/konto-zugang.js:103-112` (`KONTO_RL.zoomJwt`)
- Modify: `services/release-proxy/wrangler.toml` (Eintrag `KONTO_RL_ZOOMJWT` nach `KONTO_RL_CONNECTALT`)
- Modify: `services/release-proxy/tools/bauprobe.mjs` (`RL_SOLL`), `services/release-proxy/test/konto-attrappen.mjs` (`RL_TABELLE`)
- Test: `services/release-proxy/test/zoom-jwt.test.mjs` (Block vor `abschluss()`)

**Interfaces:**
- Consumes: `signiereZoomJwt`, `zoomZugangBrauchbar` (Task 5); `zugangPruefen` mit `zweck` (Task 3); `drosselBindung`, `kontoAktion`, `kontoJetzt`, `abgelehnt`; DO `zoom-jwt-protokoll` (Task 2); `ZIEL_ZOOM_JWT` (Task 1).
- Produces:
  - `handleZoomJwt(request, env, url, ctx): Promise<Response | null>` — `null` für jeden anderen Pfad als `/zoom/jwt`. Reihenfolge: Methode ≠ POST → 404 `{ error: 'not found' }`; Drossel `KONTO_RL_ZOOMJWT` → 429 `{ error: 'zu viele Anfragen', code: 'zu-viele' }`, `Retry-After: 60`; `zugangPruefen({ funktion: 'zoom', zweck: 'zoom-jwt', gruppe: null, ziel: ZIEL_ZOOM_JWT, jetzt, ctx })`; `!zoomZugangBrauchbar(env.ZOOM_CLIENT_ID, env.ZOOM_CLIENT_SECRET)` → `console.warn('zoom-jwt: Secret ZOOM_CLIENT_ID oder ZOOM_CLIENT_SECRET fehlt oder hat Leerraum')`, 503 `{ error: FEHLER_TEXT['nicht-eingerichtet'], code: 'nicht-eingerichtet' }`; Laufzeit aus dem Rumpf (E9, `zoomJwtLaufzeit(text: string): number | null` exportiert: leerer Rumpf oder JSON ohne `ttlS` → 43 200; `ttlS` ganze Zahl 1800–43 200 → sie; sonst `null` → 400 `{ error: 'ungültige Laufzeit', code: 'ungueltige-laufzeit' }`); signieren mit `ttlSeconds` = Laufzeit; `ctx.waitUntil(kontoAktion(env, 'zoom-jwt-protokoll', { kid, gid }))` mit Warnung nur mit dem Fehlernamen; 200 `{ jwt, exp, gueltigS: exp - Math.floor(jetzt / 1000) }`, Kopf `cache-control: no-store`.
  - `KONTO_RL.zoomJwt = 'KONTO_RL_ZOOMJWT'`; `wrangler.toml` `namespace_id = "7309"`, `limit = 30`, `period = 60`.

- [ ] **Step 1: Die failing tests schreiben**

```js
const jwtEnv = { KONTO_SCHLUESSEL: KS, ZOOM_CLIENT_ID: 'test-id-1234', ZOOM_CLIENT_SECRET: 'test-secret-5678', ...makeRLBindungen(), KONTO_UHR: uhr };
jwtEnv.KONTO = makeKontoNs(jwtEnv);
const post = (kopf, env = jwtEnv, method = 'POST') => worker.fetch(new Request('https://proxy.test/zoom/jwt', { method, headers: { 'CF-Connecting-IP': '9.9.9.9', ...kopf } }), env, ctx);
const fJ = await testFreigabe(KS, { zweck: 'zoom-jwt', ziel: 'meeting-sdk', jetzt: uhr() });
const a = await post({ Authorization: `Bearer ${fJ}` });
const d = await a.json();
check('T6 OT1: POST /zoom/jwt mit Freigabe zoom-jwt → 200 {jwt, exp, gueltigS 43170}, no-store, JWT byte-gleich zu buildJwt',
  a.status === 200 && a.headers.get('cache-control') === 'no-store' && d.gueltigS === 43_170
    && d.jwt === buildJwt({ clientId: 'test-id-1234', clientSecret: 'test-secret-5678', now: Math.floor(uhr() / 1000), ttlSeconds: 43_200 }));
await pruefeFaelle('T6 RF3, R2: Gegenproben an /zoom/jwt', [
  { name: 'GET', r: await post({ Authorization: `Bearer ${fJ}` }, jwtEnv, 'GET'), s: [404, undefined] },
  { name: 'ohne Kopf', r: await post({}), s: [401, 'nicht-angemeldet'] },
  { name: 'alter PROXY_KEY', r: await post({ 'X-Proxy-Key': 'test-proxy-key' }, { ...jwtEnv, PROXY_KEY: 'test-proxy-key' }), s: [401, 'nicht-angemeldet'] },
  { name: 'Sitzung', r: await post({ Authorization: `Bearer ${await testSitzung(KS, { jetzt: uhr() })}` }), s: [403, 'keine-freigabe'] },
  { name: 'Freigabe zoom-sdk', r: await post({ Authorization: `Bearer ${await testFreigabe(KS, { zweck: 'zoom-sdk', ziel: 'win-x64', jetzt: uhr() })}` }), s: [403, 'kein-recht'] },
  { name: 'Freigabe connect-raum mit Ziel meeting-sdk', r: await post({ Authorization: `Bearer ${await testFreigabe(KS, { zweck: 'connect-raum', ziel: 'meeting-sdk', jetzt: uhr() })}` }), s: [403, 'kein-recht'] },
  { name: 'zoom-jwt mit anderem Ziel', r: await post({ Authorization: `Bearer ${await testFreigabe(KS, { zweck: 'zoom-jwt', ziel: 'x-anders', jetzt: uhr() })}` }), s: [403, 'keine-freigabe'] },
], async (x) => (x.r.status === x.s[0] && (x.s[1] === undefined || (await x.r.json()).code === x.s[1]) ? null : `ist ${x.r.status}`));
await pruefeFaelle('T6 RF4: Secret fehlt oder mit Leerraum → 503 nicht-eingerichtet, Logzeile nennt nur die Namen', [
  { name: 'ID fehlt', env: { ZOOM_CLIENT_ID: undefined } }, { name: 'Secret mit Zeilenumbruch', env: { ZOOM_CLIENT_SECRET: 'test-secret-5678\n' } },
  { name: 'ID mit Leerzeichen vorn', env: { ZOOM_CLIENT_ID: ' test-id-1234' } },
], async (x) => { const r = await post({ Authorization: `Bearer ${fJ}` }, { ...jwtEnv, ...x.env }); return r.status === 503 && (await r.json()).code === 'nicht-eingerichtet' ? null : `ist ${r.status}`; });
check('T6 RF4: … Warnung „zoom-jwt: Secret ZOOM_CLIENT_ID oder ZOOM_CLIENT_SECRET fehlt oder hat Leerraum“, ohne Wert', …);
const kurz = await worker.fetch(new Request('https://proxy.test/zoom/jwt', { method: 'POST', headers: { 'CF-Connecting-IP': '9.9.9.9', Authorization: `Bearer ${fJ}`, 'content-type': 'application/json' }, body: '{"ttlS":1860}' }), jwtEnv, ctx);
const dk = await kurz.json();
check('T6 E9, M4: Rumpf {ttlS 1860} → 200, gueltigS 1830, JWT byte-gleich zu buildJwt mit ttlSeconds 1860',
  kurz.status === 200 && dk.gueltigS === 1830 && dk.jwt === buildJwt({ clientId: 'test-id-1234', clientSecret: 'test-secret-5678', now: Math.floor(uhr() / 1000), ttlSeconds: 1860 }));
check('T6 E9: zoomJwtLaufzeit: leer und {} → 43200; 1800 und 43200 gelten; 1799, 43201, 1860.5, "1860", kein JSON → null',
  zoomJwtLaufzeit('') === 43_200 && zoomJwtLaufzeit('{}') === 43_200 && zoomJwtLaufzeit('{"ttlS":1800}') === 1800 && zoomJwtLaufzeit('{"ttlS":43200}') === 43_200
    && ['{"ttlS":1799}', '{"ttlS":43201}', '{"ttlS":1860.5}', '{"ttlS":"1860"}', 'kein json'].every((t) => zoomJwtLaufzeit(t) === null));
check('T6 E9: Rumpf {ttlS 1799} → 400 ungueltige-laufzeit, kein JWT, kein Protokolleintrag', …);
check('T6 R2: Drossel KONTO_RL_ZOOMJWT: 31. Anfrage je IP → 429 Retry-After 60; ohne Bindung Warnung und offen', …);
check('T6 R2: nach ctx.fertig() genau ein Protokolleintrag zoom-jwt mit kid k-test und gid g-test', …);
check('T6: Konten-DO wirft beim Protokoll → trotzdem 200, Warnung nur mit dem Fehlernamen', …);
check('T6 G4: weder JWT noch Freigabe noch Secret im Mitschnitt der Konsole', !protokoll.join('\n').includes(d.jwt) && !protokoll.join('\n').includes('test-secret-5678') && !protokoll.join('\n').includes(fJ));
```

- [ ] **Step 2: Laufen lassen, Rot sehen**

Run: `node --experimental-strip-types services/release-proxy/test/zoom-jwt.test.mjs`
Expected: FAIL bei allen `T6 …` (Route fehlt: der Gate antwortet 401/403).

- [ ] **Step 3: Route, Drossel und Konfiguration umsetzen**

`zoom-relay.js` nach Interfaces (Kopfkommentar: Spec 6.3, Entwurf „Zoom-JWT“, R2). `worker.js` direkt nach der `/zoom-sdk`-Weiche: `const zoomJwt = await handleZoomJwt(request, env, url, ctx); if (zoomJwt) return zoomJwt;`. `wrangler.toml`: Kommentar `# KONTO_RL_ZOOMJWT: POST /zoom/jwt (Connect holt das JWT je Start der Bridge; mehrere Rechner hinter einer IP)`. `RL_SOLL` und `RL_TABELLE` um `['KONTO_RL_ZOOMJWT', '7309', 30, 60]`.

- [ ] **Step 4: Laufen lassen, Grün sehen**

Run: `node --experimental-strip-types services/release-proxy/test/zoom-jwt.test.mjs`, `… konto-zugang.test.mjs`, `… worker.test.mjs`, `node services/release-proxy/tools/bauprobe.mjs`
Expected: je `‹n› passed, 0 failed`; Bauprobe Exit 0 mit neun Drosseln.

- [ ] **Step 5: Commit**

```bash
git add services/release-proxy/zoom-relay.js services/release-proxy/worker.js services/release-proxy/konto-zugang.js services/release-proxy/wrangler.toml services/release-proxy/tools/bauprobe.mjs services/release-proxy/test/konto-attrappen.mjs services/release-proxy/test/zoom-jwt.test.mjs
git status --short
git commit -m "feat(proxy): POST /zoom/jwt mit Freigabe zoom-jwt, eigener Drossel und Protokoll im Konten-DO (Anmeldung Teil 2)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 7: Betrieb: Secrets beschreiben, Wächter P20, `connect-do` in die CI, README

**Files:**
- Modify: `services/release-proxy/wrangler.toml:144-151` (Kommentar zu `ALTKEY_CONNECT_BIS`), `:154-174` (Secrets `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`)
- Modify: `services/release-proxy/test/konto-zugang.test.mjs:641-650` (P20), `:676-677` (CI-Liste)
- Modify: `.github/workflows/ci-checks.yml` (Schritt `connect-do` nach dem Zoom-JWT-Schritt)
- Modify: `services/release-proxy/README.md:126-152`, `:165-166`, `:182`, neuer Abschnitt „Anmeldung Teil 2 (Connect)“ nach dem Abschnitt „Anmeldung im Launcher (Teil 1)“ (ab `:153`)
- Modify: `services/release-proxy/worker.js:18-25` (Secret-Kommentar)

**Interfaces:**
- Consumes: alle Routen und Bindungen aus Task 1–6.
- Produces: keine Code-Schnittstelle; der Wächter P20 nimmt `ALTKEY_CONNECT_BIS` als fehlend oder lesbares Datum an (Vorbereitung für N4).

- [ ] **Step 1: Die failing tests schreiben**

In `konto-zugang.test.mjs:641-650`:

```js
const geheim = /^(KONTO_SCHLUESSEL|IVEO_SCHLUESSEL|GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET|ERSTER_ADMIN|PROXY_KEY|GITHUB_TOKEN|ANTHROPIC_API_KEY|ZOOM_SDK_KEY|ZOOM_CLIENT_ID|ZOOM_CLIENT_SECRET|RTC_.*)$/;
const lesbar = (name, gruppe) => {
  const alle = tabellen.flatMap((t) => t.kv.filter(([k]) => k === name)); const w = inVars(name);
  const m = w.length === 1 ? /^"([^"]*)"$/.exec(w[0]) : null;
  return alle.length === 0 || (alle.length === 1 && !!m && /^\d{4}-\d{2}-\d{2}(T.+)?$/.test(m[1]) && alterKeyGilt({ [name]: m[1] }, gruppe, 0).diagnose === null);
};
check('T7 EP9, G4: keine Secrets in [vars] (auch ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET); ALTKEY_BIS und ALTKEY_CONNECT_BIS fehlen oder sind ein lesbares Datum; alle Namen beschrieben',
  !alleSchluessel.some((k) => geheim.test(k)) && lesbar('ALTKEY_BIS', 'katalog') && lesbar('ALTKEY_CONNECT_BIS', 'connect')
    && ['KONTO_SCHLUESSEL', 'IVEO_SCHLUESSEL', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'ERSTER_ADMIN', 'ALTKEY_BIS', 'ALTKEY_CONNECT_BIS', 'ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET'].every((n) => toml.includes(n)));
```

Die CI-Liste endet mit `'connect-zugang', 'zoom-jwt', 'connect-do'`.

- [ ] **Step 2: Laufen lassen, Rot sehen**

Run: `node --experimental-strip-types services/release-proxy/test/konto-zugang.test.mjs`
Expected: FAIL bei `T7 EP9, G4 …` (Namen fehlen in `wrangler.toml`) und bei der CI-Liste.

- [ ] **Step 3: Kommentare, CI-Schritt und README schreiben**

`wrangler.toml`: Der Kommentar über `# ALTKEY_CONNECT_BIS` sagt „Eigene Frist für die Connect-Routen (EP9, OT5): gilt für PROXY_KEY an /connect und ZOOM_SDK_KEY an /zoom-sdk. Bleibt leer bis zum Release von Connect 0.5.0; dann Release + 30 Tage (eigener Schritt mit Owner-OK).“ Unter den Secrets der Anmeldung: `ZOOM_CLIENT_ID` und `ZOOM_CLIENT_SECRET` (Client-ID und Client-Secret der Meeting-SDK-App; signieren das JWT an `POST /zoom/jwt`; fehlen sie oder haben Leerraum, antwortet die Route 503 S5; nie ein Name mit `ZOOM_SDK_`). CI-Schritt:

```yaml
      - name: Release-Proxy (ConnectRoom-DO, SFU-Vermittlung)
        run: node --experimental-strip-types services/release-proxy/test/connect-do.test.mjs
```

README: Abschnitt „Zoom-SDK nachladen“ nennt beide Wege (Freigabe `zoom-sdk`, alter `X-Zoom-Sdk-Key` bis `ALTKEY_CONNECT_BIS`); `:165-166` und `:182` sagen, dass `/connect/*` und `/zoom-sdk/*` seit Teil 2 über `zugangPruefen` prüfen und die Connect-Frist erst nach dem Release von Connect 0.5.0 gesetzt wird; der neue Abschnitt listet: Zwecke und Ziele, `POST /zoom/jwt` (Antwort, Fehler, Drossel), Raum-Bindung (E3), die Secrets, die zwei neuen Drosseln, die Reihenfolge der Deploys (N1–N5) und den Satz „Die Secrets setzt der Controller mit Freigabe des Owners; kein Wert steht im Repo oder im Chat.“ `worker.js:18-25` nennt die zwei neuen Secrets.

- [ ] **Step 4: Laufen lassen, Grün sehen**

Run: `node --experimental-strip-types services/release-proxy/test/konto-zugang.test.mjs`, `node --experimental-strip-types services/release-proxy/test/connect-do.test.mjs`, `node services/release-proxy/tools/bauprobe.mjs`
Expected: je `‹n› passed, 0 failed`; Bauprobe Exit 0 mit „Stichtage aus wrangler.toml: ALTKEY_BIS bis 2026-12-20T00:00:00.000Z, ALTKEY_CONNECT_BIS nicht gesetzt (unbefristet)“.

- [ ] **Step 5: Commit**

```bash
git add services/release-proxy/wrangler.toml services/release-proxy/test/konto-zugang.test.mjs services/release-proxy/README.md services/release-proxy/worker.js .github/workflows/ci-checks.yml
git status --short
git commit -m "docs(proxy): Secrets ZOOM_CLIENT_ID/SECRET, Connect-Frist und Teil 2 beschrieben; connect-do in der CI (Anmeldung Teil 2)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Phase B · Launcher 0.19.0

### Task 8: Zwecke für Connect und JM-Prüfung im Launcher

**Files:**
- Modify: `apps/launcher/src/shared/konto.ts:9-12` (Typen), `:52-55` (`AltKeyZeile`, `AdminUebersicht.altKey`), nach `darf` (`:75-103`)
- Modify: `apps/launcher/src/main/konto/freigaben.ts:3-7` (Kopf), `:15-17` (`ZWECKE`), `:51-62`
- Test: `apps/launcher/test/konto-rechte.test.ts` (nach `:60-63`), `apps/launcher/test/konto-tuer.test.ts:160-168` und neuer Block

**Interfaces:**
- Consumes: `services/release-proxy/test/zweck-faelle.json` (Task 1); `FreigabeErgebnis` (`@jm/app-runtime/freigabe`).
- Produces:
  - `type Zweck = 'qa-relay' | 'connect-raum' | 'zoom-jwt' | 'zoom-sdk'`; `ZWECK_FUNKTION: Readonly<Record<Zweck, Funktion>>` wie am Worker
  - `zweckDarf(stand: KontoStand | null, zweck: string, k: { jetzt: number }): 'ja' | 'kein-recht' | 'kein-jm-rechner'` — gleiche Regel wie Task 1
  - `AltKeyZeile.gruppe: 'katalog' | 'qa' | 'connect'`; `AdminUebersicht.altKey.connect?: { bis: string | null; diagnose: 'ohne-ende' | 'unlesbar' | null }`
  - `ZWECKE` = `{ 'qa-relay': {funktion:'qa', zielNoetig:true, apps:['jm-qa']}, 'connect-raum': {funktion:'connect-raum', zielNoetig:true, apps:['jm-connect']}, 'zoom-jwt': {funktion:'zoom', zielNoetig:true, apps:['jm-connect']}, 'zoom-sdk': {funktion:'zoom', zielNoetig:true, apps:['jm-connect']} }`
  - Freigabe-Stelle: `zweckDarf` → `'kein-recht'` ⇒ `{ ok: false, grund: 'kein-recht' }`; `'kein-jm-rechner'` ⇒ `{ ok: false, grund: 'kein-recht', detail: 'kein-jm-rechner' }`, Logzeile `Freigabe: zoom-sdk für jm-connect abgelehnt (kein JM-Rechner)`; nie beim Worker.

- [ ] **Step 1: Die failing tests schreiben**

`konto-rechte.test.ts`:

```ts
const ZF = JSON.parse(readFileSync(new URL('../../../services/release-proxy/test/zweck-faelle.json', import.meta.url), 'utf8')) as Array<{ name: string; stand: Fall['stand']; zweck: string; erwartet: string }>;
const r2 = pruefeFaelle('T8 OT4: zweckDarf wie der Worker, gemeinsame Tabelle zweck-faelle.json', ZF, (f) => {
  const ist = zweckDarf(f.stand ? standAus(f.stand) : null, f.zweck, { jetzt: JETZT });
  return ist === f.erwartet ? null : `${f.name}: ist ${ist}, soll ${f.erwartet}`;
});
ck(r2.name, r2.ok && ZF.length === 200);
```

`konto-tuer.test.ts:160-168`: der unbekannte Zweck heißt `zoom-xyz`, die Pin-Prüfung erwartet die vier Einträge aus Interfaces; neuer Block:

```ts
const c = client('ok');
const zeilen: string[] = [];
const stelle = erzeugeFreigabeStelle({ treiber: treiber('angemeldet', stand({ jm: false, plattform: 'win' })), client: c, jetzt: () => T0, log: (z) => zeilen.push(z) });
const raum = await stelle.behandle({ v: 1, appId: 'jm-connect', zweck: 'connect-raum', ziel: 'cop31-tag1' });
const jwt = await stelle.behandle({ v: 1, appId: 'jm-connect', zweck: 'zoom-jwt', ziel: 'meeting-sdk' });
const sdk = await stelle.behandle({ v: 1, appId: 'jm-connect', zweck: 'zoom-sdk', ziel: 'win-x64' });
const quer = await stelle.behandle({ v: 1, appId: 'jm-qa', zweck: 'zoom-jwt', ziel: 'meeting-sdk' });
ck('T8 OT1, OF1: Connect bekommt connect-raum und zoom-jwt (Kollege, Nicht-JM-Rechner); Q&A keinen Connect-Zweck',
  raum.ok && jwt.ok && grund(quer) === 'unbekannter-zweck'
    && JSON.stringify(c.aufrufe.map((a) => [a.zweck, a.ziel])) === '[["connect-raum","cop31-tag1"],["zoom-jwt","meeting-sdk"]]');
ck('T8 OT4, N2: zoom-sdk auf Windows ohne JM-Markierung → kein-recht mit detail kein-jm-rechner, nie beim Worker',
  !sdk.ok && sdk.grund === 'kein-recht' && sdk.detail === 'kein-jm-rechner' && c.aufrufe.length === 2
    && zeilen.includes('Freigabe: zoom-sdk für jm-connect abgelehnt (kein JM-Rechner)'));
ck('T8 G4: keine Logzeile nennt ein Token oder ein Ziel', zeilen.every((z) => !z.includes('jm1.') && !z.includes('cop31-tag1')));
```

- [ ] **Step 2: Laufen lassen, Rot sehen**

Run: `cd apps/launcher && npx tsx test/konto-rechte.test.ts && npx tsx test/konto-tuer.test.ts`
Expected: Abbruch beim Import von `zweckDarf` bzw. FAIL bei `T8 …` und bei der Pin-Prüfung von `ZWECKE`.

- [ ] **Step 3: Typen, `zweckDarf` und Freigabe-Stelle umsetzen**

Nach Interfaces; `shared/konto.ts` bleibt ohne Import (G9), der Kopfkommentar nennt die zweite Falltabelle; `freigaben.ts:3-7` sagt „Teil 2: Zwecke für JM Connect; `zoom-sdk` nur auf JM-Rechnern (OT4)“.

- [ ] **Step 4: Laufen lassen, Grün sehen**

Run: `npm run selftest:konto -w @jm/launcher`, `npm run typecheck -w @jm/launcher`
Expected: jede Summenzeile `‹n› ok, 0 fehlgeschlagen.`; 0 `error TS`.

- [ ] **Step 5: Commit**

```bash
git add apps/launcher/src/shared/konto.ts apps/launcher/src/main/konto/freigaben.ts apps/launcher/test/konto-rechte.test.ts apps/launcher/test/konto-tuer.test.ts
git status --short
git commit -m "feat(launcher): Freigaben connect-raum, zoom-jwt, zoom-sdk fuer JM Connect mit JM-Pruefung (Anmeldung Teil 2)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 9: Launcher-Texte mit Wirkung, Connect-Frist im Reiter „Geräte“, Version 0.19.0

**Files:**
- Modify: `apps/launcher/src/renderer/src/lib/konto-dialog.ts:51` (K29d), `:62-76` (Z5–Z7, Z9b, Z11 raus), `:230-237` (`zoomConnectHinweis` raus)
- Modify: `apps/launcher/src/renderer/src/components/KontoModal.tsx:67-68` und die Stelle `{zConnect && (` (raus)
- Modify: `apps/launcher/src/renderer/src/lib/admin-ansicht.ts:40-41` (M48 raus), `:236-239` (M44, M46, M47), `altKeyText` → `altKeyTexte`
- Modify: `apps/launcher/src/renderer/src/components/AdminZugaenge.tsx:233-234`, `AdminAnfragen.tsx:42-43`, `AdminGeraete.tsx:3`, `:30-32`
- Modify: `packages/cookbook/content/tool-manuals/launcher-anmeldung.md:48`, `:74`; `packages/cookbook/cookbook.json` (nur per `npm run cookbook:build`)
- Modify: `apps/launcher/package.json:3`, `package-lock.json:295` (Version)
- Test: `apps/launcher/test/konto-anzeige.test.ts:284-296`, `:427-458`; `apps/launcher/test/konto-admin.test.ts:169-186`, `:254-275`, `:313-331`; `apps/launcher/test/selftest.ts:3436-3438`, `:3473-3476`, `:3518-3524`

**Interfaces:**
- Consumes: `AdminUebersicht.altKey.connect` (Task 8).
- Produces: `REITER_TEXTE.altKeyBis(d)` und `altKeyOhneEnde` (M44a, neuer Wortlaut), `REITER_TEXTE.altKeyConnectBis(d)` und `altKeyConnectOhneEnde` (M44b); `altKeyTexte(u: AdminUebersicht): string[]` — erste Zeile M44a nach `u.altKey.bis`/`diagnose` (Regel wie `altKeyText` heute), zweite Zeile M44b nach `u.altKey.connect` mit derselben Regel, nur wenn `connect` da ist; `REITER_TEXTE.gruppe` mit `connect`; `KONTO_TEXTE.zweck` mit vier Einträgen; `ZOOM_TEXTE` ohne `connect`; `ADMIN_TEXTE` ohne `connectTeil1`; `REITER_TEXTE` ohne `connect`.

- [ ] **Step 1: Die failing tests schreiben**

Wortlaut-Tabellen anpassen (alte Zeilen raus, neue rein, Werte aus T2):

```ts
['Z5–Z7 (Teil 2)', `${Z.hinweisJm} / ${Z.hinweisKeinJm} / ${Z.hinweisMac}`,
  'Dieser Rechner ist ein JM-Rechner. Eine Freigabe wirkt hier nach dem nächsten Start des Launchers. / Dieser Rechner ist kein JM-Rechner. Zoom gibt es für Externe nur auf JM-Rechnern; eine Freigabe wirkt hier nicht. / Auf dem Mac gibt es Zoom in Connect nicht. Eine Freigabe wirkt nur auf JM-Rechnern unter Windows.'],
['Z9b (Teil 2)', Z.freigegeben('D'), 'Zoom freigegeben bis D. Gilt ab dem nächsten Start des Launchers.'],
['K29d', ['qa-relay', 'connect-raum', 'zoom-jwt', 'zoom-sdk'].map((z) => K.zweck[z]).join(' / '), 'Q&A extern / Connect Cloud-Raum / Zoom-Anmeldung / Zoom-SDK laden'],
['Z11 entfällt', String('connect' in Z), 'false'],
```

```ts
['M44a', `${T.altKeyBis('D')} / ${T.altKeyOhneEnde}`, 'Alter Schlüssel für Katalog, Updates und Q&A angenommen bis D. / Alter Schlüssel für Katalog, Updates und Q&A ohne Enddatum angenommen.'],
['M44b', `${T.altKeyConnectBis('D')} / ${T.altKeyConnectOhneEnde}`, 'Alter Schlüssel für Connect (Cloud-Raum, Zoom-SDK) angenommen bis D. / Alter Schlüssel für Connect (Cloud-Raum, Zoom-SDK) ohne Enddatum angenommen.'],
['M46', Object.values(T.gruppe).join(' / '), 'Katalog und Updates / Q&A extern / Connect (Cloud-Raum, Zoom-SDK)'],
['M47, M48 entfallen', `${'connect' in T} ${'connectTeil1' in ADMIN_TEXTE}`, 'false false'],
```

```ts
kreuz('T9 OT5: altKeyTexte — Katalog-Frist und Connect-Frist', [
  ['beide gesetzt', altKeyTexte(mitFrist('2026-12-20T00:00:00.000Z', { bis: '2027-01-19T00:00:00.000Z', diagnose: null })).join(' | '),
    'Alter Schlüssel für Katalog, Updates und Q&A angenommen bis 20.12.2026. | Alter Schlüssel für Connect (Cloud-Raum, Zoom-SDK) angenommen bis 19.01.2027.'],
  ['Connect leer', altKeyTexte(mitFrist('2026-12-20T00:00:00.000Z', { bis: null, diagnose: 'ohne-ende' }))[1], 'Alter Schlüssel für Connect (Cloud-Raum, Zoom-SDK) ohne Enddatum angenommen.'],
  ['Connect unlesbar', altKeyTexte(mitFrist(null, { bis: null, diagnose: 'unlesbar' })).length, 2],
  ['Worker ohne connect', altKeyTexte(mitFrist('2026-12-20T00:00:00.000Z', undefined)).length, 1],
]);
kreuz('T9 OT5: alte Connects erscheinen mit Gruppenname', [['Zeile', alteLauncherZeilen(mitZeile('connect'))[0], '21.10.2026 · Connect (Cloud-Raum, Zoom-SDK) · win-x64: 3 Anfragen, zuletzt 08:30']]);
```

`mitFrist(bis, connect)` baut eine Übersicht mit `altKey: { bis, diagnose: bis ? null : 'ohne-ende', zeilen: [], connect }` (ohne Schlüssel `connect`, wenn `undefined`); `mitZeile(gruppe)` eine mit einer Zeile `{ tag: '2026-10-21', gruppe, plattform: 'win-x64', anzahl: 3, zuletzt: new Date(2026, 9, 21, 8, 30).getTime() }`. Der Z11-Kreuzprodukt-Block (`konto-anzeige.test.ts:288-296`) entfällt. `selftest.ts`: `:3436-3438` prüft statt Z11 `!konto.includes('zoomConnectHinweis')`; `:3473-3476` wird `T9 EP34: der Reiter Zugänge nennt kein „erst mit einem Update“ mehr` mit `!zugaenge.includes('connectTeil1')`; `:3518-3521` entsprechend für `anfragen`; `:3522-3524` erwartet `geraete.includes('{altKeyTexte(daten).map((z) => (')` und `!geraete.includes('{REITER_TEXTE.connect}')`.

- [ ] **Step 2: Laufen lassen, Rot sehen**

Run: `cd apps/launcher && npx tsx test/konto-anzeige.test.ts && npx tsx test/konto-admin.test.ts`, dann `npm run selftest -w @jm/launcher`
Expected: FAIL bei den geänderten Wortlautzeilen, bei `T9 …` und bei den drei geänderten Quelltext-Wächtern.

- [ ] **Step 3: Texte, Ansichten und Rezept umsetzen**

Werte aus T2. `KontoModal.tsx`: `zConnect` und sein Absatz entfallen. `AdminZugaenge.tsx:233-234` und `AdminAnfragen.tsx:42-43`: der Absatz mit `connectTeil1` entfällt samt Kommentar. `AdminGeraete.tsx:30-32`: `{altKeyTexte(daten).map((z) => (<p key={z} role="status">{z}</p>))}` statt `altKeyText` und M47. Rezept `:48` = R1a, `:74` = R1b, dann `npm run cookbook:build`.

- [ ] **Step 4: Laufen lassen, Grün sehen**

Run: `npm run selftest:konto -w @jm/launcher`, `npm run selftest -w @jm/launcher`, `npm run typecheck -w @jm/launcher`, `npm run cookbook:check`
Expected: alle Summenzeilen `0 fehlgeschlagen.`; 0 `error TS`; „cookbook.json ist frisch (… Rezepte).“

- [ ] **Step 5: Commit der Texte**

```bash
git add apps/launcher/src/renderer/src/lib/konto-dialog.ts apps/launcher/src/renderer/src/lib/admin-ansicht.ts apps/launcher/src/renderer/src/components/KontoModal.tsx apps/launcher/src/renderer/src/components/AdminZugaenge.tsx apps/launcher/src/renderer/src/components/AdminAnfragen.tsx apps/launcher/src/renderer/src/components/AdminGeraete.tsx apps/launcher/test/konto-anzeige.test.ts apps/launcher/test/konto-admin.test.ts apps/launcher/test/selftest.ts packages/cookbook/content/tool-manuals/launcher-anmeldung.md packages/cookbook/cookbook.json
git status --short
git commit -m "feat(launcher): Texte mit Wirkung fuer Zoom-Freigaben, Connect-Frist im Reiter Geraete, Z11/M47/M48 entfallen (Anmeldung Teil 2)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Version 0.19.0 setzen und committen**

`apps/launcher/package.json:3` und `package-lock.json:295` auf `"0.19.0"`; Prüfung `node -e "const l=require('./package-lock.json');process.exit(l.packages['apps/launcher'].version==='0.19.0'&&require('./apps/launcher/package.json').version==='0.19.0'?0:1)"` → Exit 0.

```bash
git add apps/launcher/package.json package-lock.json
git status --short
git commit -m "chore(launcher): Version 0.19.0 (Anmeldung Teil 2)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Phase C · Connect 0.5.0 (Basis 0.4.6)

### Task 10: Regeln und Texte des Zugangs (rein)

**Files:**
- Create: `apps/connect/src/main/zugang/regeln.ts`
- Create: `apps/connect/test/zugang-regeln.test.ts`
- Modify: `apps/connect/package.json:17` (`tsx test/zugang-regeln.test.ts` nach `zoom-text`)

**Interfaces:**
- Consumes: Typ `FreigabeGrund` (`@jm/app-runtime/freigabe`, nur `import type`), Typ `ProxyKeySource` (`../../shared/types`).
- Produces (alles in `regeln.ts`, keine Laufzeit-Importe):
  - `type ConnectZweck = 'connect-raum' | 'zoom-jwt' | 'zoom-sdk'`; `APP_ID = 'jm-connect'`; `ZIEL_ZOOM_JWT = 'meeting-sdk'`; `ZIEL_ZOOM_SDK = 'win-x64'`; `ERNEUERN_VOR_MS = 86_400_000`; `FREIGABE_ABSTAND_MS = 30_000`
  - `interface ConnectFreigabe { zweck: ConnectZweck; token: string; bis: number; ziel: string; konto: { name: string; stufe: 'admin' | 'kollege' | 'externer' } }`; `type GehalteneFreigaben = Partial<Record<ConnectZweck, ConnectFreigabe>>`
  - `type ZugangsWahl = { art: 'freigabe'; f: ConnectFreigabe } | { art: 'alter-key'; key: string } | { art: 'keiner' }`
  - `interface ZugangsLage { wahl: ZugangsWahl['art']; konto: ConnectFreigabe['konto'] | null; bis: number | null; letzterGrund: FreigabeGrund | null; detail: string | null; altHerkunft: ProxyKeySource; altAbgelehnt: boolean; versucht: boolean; geloescht: boolean }`
  - `type JwtGrund = FreigabeGrund | 'server-abgelehnt' | 'server-fehler' | 'nicht-eingerichtet'`
  - `interface ZoomAnmeldungLage { quelle: 'server' | 'lokal' | 'keine'; grund: JwtGrund | null; detail: string | null; konto: ConnectFreigabe['konto'] | null; freigabeBis: number | null; devTtlS: number | null; versucht: boolean; geloescht: boolean }`
  - `waehleZugang(s: { freigabe: ConnectFreigabe | null; ziel: string; altKey: string | null; altAbgelehnt: boolean; jetzt: number }): ZugangsWahl` — gültige Freigabe für genau dieses Ziel vor altem Key (nicht abgelehnt) vor keinem
  - `erneuernFaellig(f: ConnectFreigabe | null, ziel: string, jetzt: number): boolean` — keine, anderes Ziel oder weniger als 24 h Rest
  - `versuchErlaubt(letzter: number | null, jetzt: number): boolean` — höchstens einer je 30 s
  - `zugangsKopf(zweck: ConnectZweck, w: ZugangsWahl): Record<string, string>` — Freigabe → `Authorization: Bearer ‹token›`; alter Key → `connect-raum`: `X-Proxy-Key`, `zoom-sdk`: `X-Zoom-Sdk-Key`; sonst `{}`
  - `leseFreigabe(roh: unknown, zweck: ConnectZweck): ConnectFreigabe | null` (Token nur `^[\x21-\x7e]+$`, `bis` endlich, Ziel nicht leer, Stufe gültig, Zweck gleich); `leseGehalten(roh: unknown): GehalteneFreigaben`
  - `geheimnisDatei(g: GehalteneFreigaben, v: { verfuegbar(): boolean; verschluesseln(t: string): Uint8Array }): Uint8Array | null` — ohne Schlüsselspeicher `null` (nichts schreiben)
  - `leseFehlerCode(body: unknown): string | null` (wie `apps/qa/src/main/cloud-zugang.ts:280-284`); `altKeyVerworfen(status: number, code: string | null): boolean` (401 mit `nicht-angemeldet` oder `alter-key-abgelaufen`); `nachAblehnung(w: ZugangsWahl['art'], status: number, code: string | null): 'freigabe-verwerfen' | 'key-abgelehnt' | null`
  - `grundText(zweck: ConnectZweck, g: FreigabeGrund, detail?: string | null): string` (CG1–CG10); `jwtGrundText(g: JwtGrund, detail?: string | null): string` (FreigabeGrund → `grundText('zoom-jwt', …)`, sonst ZA8–ZA10)
  - `ZUGANG_TEXT` (Schlüssel, die spätere Aufgaben benutzen): `cloudFreigabe(name, stufe, datum, zeit)` CZ1, `cloudAltKey` CZ2, `cloudAltAbgelehnt` CZ3, `cloudNochNicht` CZ4, `cloudGeloescht` CZ5, `cloudEnv` CZ6, `raumNicht(grund)` CZ7, `raumVergeben` CZ8, `raumFreigabeAbgelehnt` CZ9, `altProxyKey` CZ10, `anmeldungServer(name, stufe, datum, zeit)` ZA1, `anmeldungLokal` ZA2, `anmeldungKeine(grund)` ZA3, `anmeldungNochNicht` ZA4, `zugangGeloescht` ZA5, `sdkGeloescht` ZA6, `ohneAnmeldung(grund)` ZA7, `serverAbgelehnt` ZA8, `nichtEingerichtet` ZA9, `serverFehler(detail)` ZA10, `entwicklungTtl(n)` ZA11
  - `cloudZeile(l: ZugangsLage, jetzt: number): { text: string; ton: 'ok' | 'warn' | 'fehler' }` — Freigabe: CZ1 (`ok`), mit `letzterGrund` und weniger als 24 h Rest CZ1 + Leerzeichen + Grund (`warn`); alter Key: CZ2 (`warn`), mit `letzterGrund` + Leerzeichen + Grund; keiner: `altAbgelehnt` → CZ3 (`fehler`), sonst mit `letzterGrund` der Grund allein (Ton nach der Regel unten), sonst CZ4 (`ok`); danach `geloescht` → + Leerzeichen + CZ5, `altHerkunft === 'env'` → + Leerzeichen + CZ6
  - `anmeldungZeile(l: ZoomAnmeldungLage, jetzt: number): { text: string; ton: 'ok' | 'warn' | 'fehler' }` — `server`: ZA1 (`ok`); `lokal`: ZA2 (`warn`), mit `grund` + Leerzeichen + `jwtGrundText`; `keine`: mit `grund` ZA3(`jwtGrundText`) (Ton nach der Regel unten), ohne `grund` ZA4 (`ok`); danach `geloescht` → + Leerzeichen + ZA5, `devTtlS !== null` → + Leerzeichen + ZA11
  - Vorübergehend (Ton `warn`) sind `kein-launcher`, `niemand-angemeldet`, `abgelaufen`, `server-nicht-erreichbar`, `server-fehler`; alle übrigen Gründe Ton `fehler`

- [ ] **Step 1: Die failing tests schreiben**

Form „ck“ wie `zoom-settings.test.ts:44-47`, Zeitzone fest: `process.env.TZ = 'Europe/Berlin'` vor dem Import.

```ts
const J = new Date(2026, 10, 20, 9, 0).getTime();
const F = (o: Partial<ConnectFreigabe> = {}): ConnectFreigabe => ({ zweck: 'connect-raum', token: 'jm1.test-a', bis: J + 72 * 3600_000, ziel: 'cop31-tag1', konto: { name: 'Maria S.', stufe: 'kollege' }, ...o });
ck('T10 QR1: Freigabe für dieses Ziel vor altem Key vor keinem; abgelehnter alter Key zählt nicht',
  waehleZugang({ freigabe: F(), ziel: 'cop31-tag1', altKey: 'k', altAbgelehnt: false, jetzt: J }).art === 'freigabe'
    && waehleZugang({ freigabe: F(), ziel: 'cop31-tag2', altKey: 'k', altAbgelehnt: false, jetzt: J }).art === 'alter-key'
    && waehleZugang({ freigabe: F({ bis: J }), ziel: 'cop31-tag1', altKey: null, altAbgelehnt: false, jetzt: J }).art === 'keiner'
    && waehleZugang({ freigabe: null, ziel: 'x', altKey: 'k', altAbgelehnt: true, jetzt: J }).art === 'keiner');
ck('T10 QR2: erneuern ohne Freigabe, bei anderem Ziel, unter 24 h Rest; Abstand 30 s',
  erneuernFaellig(null, 'a', J) && erneuernFaellig(F(), 'anders', J) && erneuernFaellig(F({ bis: J + 86_399_999 }), 'cop31-tag1', J)
    && !erneuernFaellig(F({ bis: J + 86_400_000 }), 'cop31-tag1', J) && versuchErlaubt(null, J) && !versuchErlaubt(J - 29_999, J) && versuchErlaubt(J - 30_000, J));
ck('T10: Kopfzeilen je Zweck',
  JSON.stringify(zugangsKopf('connect-raum', { art: 'freigabe', f: F() })) === '{"Authorization":"Bearer jm1.test-a"}'
    && JSON.stringify(zugangsKopf('connect-raum', { art: 'alter-key', key: 'k1' })) === '{"X-Proxy-Key":"k1"}'
    && JSON.stringify(zugangsKopf('zoom-sdk', { art: 'alter-key', key: 'k2' })) === '{"X-Zoom-Sdk-Key":"k2"}'
    && JSON.stringify(zugangsKopf('zoom-jwt', { art: 'keiner' })) === '{}');
ck('T10 G4: leseFreigabe verwirft Token mit Steuerzeichen oder Leerraum, fremden Zweck, unendliches bis, leeres Ziel, fremde Stufe',
  leseFreigabe(F(), 'connect-raum') !== null && [{ token: 'jm1.a b' }, { token: 'jm1.a\n' }, { zweck: 'zoom-jwt' }, { bis: Infinity }, { ziel: '' }, { konto: { name: 'x', stufe: 'chef' } }]
    .every((o) => leseFreigabe({ ...F(), ...o }, 'connect-raum') === null));
ck('T10 G6: geheimnisDatei: mit Schlüsselspeicher nur die Ausgabe des Verschlüsselers; ohne → null',
  geheimnisDatei({ 'connect-raum': F() }, { verfuegbar: () => true, verschluesseln: (t) => new TextEncoder().encode('E:' + t.length) }) !== null
    && geheimnisDatei({ 'connect-raum': F() }, { verfuegbar: () => false, verschluesseln: () => { throw new Error('nie'); } }) === null);
ck('T10 OE5: nur 401 nicht-angemeldet oder alter-key-abgelaufen verwirft den alten Key; 403 nie',
  altKeyVerworfen(401, 'nicht-angemeldet') && altKeyVerworfen(401, 'alter-key-abgelaufen') && !altKeyVerworfen(403, 'raum-vergeben') && !altKeyVerworfen(401, null));
kreuz('T10: Gründe CG1–CG10 wörtlich (T3), N2 nur für zoom-sdk mit detail kein-jm-rechner', [ /* je Zeile [Nr., grundText(...), Text aus T3] */ ]);
kreuz('T10 G7: Cloud-Zeile als Kreuzprodukt (Wahl × Grund × abgelehnt × gelöscht × Umgebung)', [
  ['Freigabe', cloudZeile(lage({ wahl: 'freigabe' }), J), 'Cloud-Zugang über den Launcher (Maria S. · Kollege), gültig bis 23.11.2026 09:00.|ok'],
  ['Freigabe bald ab, kein Launcher', cloudZeile(lage({ wahl: 'freigabe', bis: J + 3600_000, letzterGrund: 'kein-launcher' }), J),
    'Cloud-Zugang über den Launcher (Maria S. · Kollege), gültig bis 20.11.2026 10:00. Kein Launcher mit Anmeldung gefunden. Starte den Launcher und melde dich dort an.|warn'],
  ['alter Key mit Grund', cloudZeile(lage({ wahl: 'alter-key', letzterGrund: 'unbekannter-zweck' }), J),
    'Cloud-Zugang über den alten Proxy-Key (Übergang). Der Launcher ist zu alt für Connect. Launcher aktualisieren (ab 0.19.0).|warn'],
  ['alter Key abgelehnt', cloudZeile(lage({ wahl: 'keiner', altAbgelehnt: true }), J), 'Der Server nimmt den alten Proxy-Key nicht mehr an. Melde dich im Launcher an.|fehler'],
  ['nichts versucht', cloudZeile(lage({ wahl: 'keiner' }), J), 'Connect holt die Freigabe für den Cloud-Raum beim Launcher, sobald du einen Raum öffnest.|ok'],
  ['kein Recht', cloudZeile(lage({ wahl: 'keiner', versucht: true, letzterGrund: 'kein-recht' }), J), 'Dein Konto darf den Cloud-Raum nicht nutzen. Frag einen Admin.|fehler'],
  ['gelöscht', cloudZeile(lage({ wahl: 'freigabe', geloescht: true }), J).text.endsWith(' Der alte Proxy-Key wurde gelöscht; Connect nutzt jetzt die Freigabe des Launchers.'), true],
  ['Umgebung', cloudZeile(lage({ wahl: 'alter-key', altHerkunft: 'env' }), J).text.endsWith(' Entwicklungsmodus: JMPS_PROXY_KEY gesetzt.'), true],
  // dazu je FreigabeGrund (10) eine Zeile „keiner, versucht“ mit Ton nach der Regel aus Interfaces
]);
kreuz('T10 G7: Zeile Zoom-Anmeldung (Quelle × Grund × gelöscht × Entwicklung)', [
  ['Server', anmeldungZeile(alage({ quelle: 'server' }), J), 'Zoom-Anmeldung über den Launcher (Maria S. · Kollege), Freigabe gültig bis 23.11.2026 09:00.|ok'],
  ['lokal, Launcher zu alt', anmeldungZeile(alage({ quelle: 'lokal', grund: 'launcher-zu-alt' }), J),
    'Zoom-Anmeldung über die alten Zugangsdaten dieses Rechners (Übergang). Der Launcher ist zu alt für Connect. Launcher aktualisieren (ab 0.19.0).|warn'],
  ['keine, nie versucht', anmeldungZeile(alage({ quelle: 'keine' }), J), 'Zoom-Anmeldung über den Launcher; die Freigabe holt Connect beim ersten Beitritt.|ok'],
  ['keine, Server abgelehnt', anmeldungZeile(alage({ quelle: 'keine', versucht: true, grund: 'server-abgelehnt' }), J),
    'Zoom-Anmeldung: Der Server hat die Freigabe für Zoom abgelehnt. Ich hole beim nächsten Versuch eine neue beim Launcher.|fehler'],
  ['keine, nicht eingerichtet', anmeldungZeile(alage({ quelle: 'keine', versucht: true, grund: 'nicht-eingerichtet' }), J),
    'Zoom-Anmeldung: Die Zoom-Anmeldung ist auf dem Server nicht eingerichtet. Sag einem Admin Bescheid.|fehler'],
  ['keine, Server-Fehler', anmeldungZeile(alage({ quelle: 'keine', versucht: true, grund: 'server-fehler', detail: 'HTTP 502' }), J),
    'Zoom-Anmeldung: Der Server hat kein Zoom-Anmelde-Token geliefert (HTTP 502). Ich versuche es beim nächsten Beitritt erneut.|warn'],
  ['Entwicklung', anmeldungZeile(alage({ quelle: 'server', devTtlS: 1860 }), J).text.endsWith(' Entwicklungsmodus: JMPS_ZOOM_JWT_TTL_S gesetzt, der Server stellt das Zoom-Anmelde-Token mit 1860 s Laufzeit aus.'), true],
]);
ck('T10: kein Text enthält ASCII-Anführungszeichen', alleTexte().every((t) => !t.includes('"')));
```

`kreuz(name, zeilen)` vergleicht `${text}|${ton}` bzw. den Wert mit der dritten Spalte und gibt bei Abweichung die ersten fünf aus; `lage(o)`/`alage(o)` füllen die Lagen mit `konto: {name:'Maria S.', stufe:'kollege'}`, `bis`/`freigabeBis` = `J + 72 h`, sonst `null`/`false`/`'none'`.

- [ ] **Step 2: Laufen lassen, Rot sehen**

Run: `cd apps/connect && npx tsx test/zugang-regeln.test.ts`
Expected: Abbruch mit „Cannot find module '../src/main/zugang/regeln'“.

- [ ] **Step 3: `regeln.ts` umsetzen**

Nach Interfaces und Texttabelle (T3, T4). Datum und Uhrzeit in Ortszeit wie `cloud-zugang.ts:144-157`. Stufen-Namen Admin/Kollege/Externer. Kopfkommentar: Spec 3, 6.2, 6.3, 10; Entwurf OT1, OT8–OT10, N2; Muster `apps/qa/src/main/cloud-zugang.ts`.

- [ ] **Step 4: Laufen lassen, Grün sehen**

Run: `cd apps/connect && npx tsx test/zugang-regeln.test.ts`, dann `npm run typecheck -w @jm/connect`
Expected: `‹n› ok, 0 fehlgeschlagen.`; 0 `error TS`.

- [ ] **Step 5: Commit**

```bash
git add apps/connect/src/main/zugang/regeln.ts apps/connect/test/zugang-regeln.test.ts apps/connect/package.json
git status --short
git commit -m "feat(connect): Regeln und Texte fuer den Zugang ueber den Launcher (Anmeldung Teil 2)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 11: Halter der Freigaben und Hülle (holen, halten, erneuern, Altlasten)

**Files:**
- Create: `apps/connect/src/main/zugang/halter.ts` (rein)
- Create: `apps/connect/src/main/zugang/huelle.ts` (Electron)
- Create: `apps/connect/test/zugang-halter.test.ts`
- Modify: `apps/connect/src/main/index.ts:95-158` (Halter vor `registerIpc` und `startZoom` anlegen)
- Modify: `apps/connect/package.json:17` (Testdatei in die Kette)
- Test: `apps/connect/test/zoom-settings.test.ts` (Block vor der Schlusszeile)

**Interfaces:**
- Consumes: alles aus `regeln.ts` (Task 10); `holeFreigabe` (`@jm/app-runtime/freigabe`); aus `settings.ts` `proxyKey`, `proxyKeySource`, `setProxyKey`, `zoomSdkSchluesselLesen`, `zoomSdkSchluesselLoeschen`.
- Produces:
  - `interface AltWert { lesen(): { wert: string | null; herkunft: ProxyKeySource }; loeschen(): boolean }`
  - `interface ZugangsHalter { zugang(zweck: ConnectZweck, ziel: string): Promise<ZugangsWahl>; antwort(zweck: ConnectZweck, w: ZugangsWahl, status: number, code: string | null): void; bestaetigt(zweck: ConnectZweck, w: ZugangsWahl): boolean; lage(zweck: ConnectZweck): ZugangsLage; tokens(): string[] }`
  - `erzeugeZugangsHalter(d: { holeFreigabe(a: { appId: 'jm-connect'; zweck: ConnectZweck; ziel: string }): Promise<FreigabeErgebnis>; gehalten: GehalteneFreigaben; speichern(g: GehalteneFreigaben): void; alt: { 'connect-raum': AltWert; 'zoom-sdk': AltWert }; jetzt(): number; log(z: string): void; geaendert(): void }): ZugangsHalter`
  - Regeln: `zugang()` holt nur, wenn `erneuernFaellig` und `versuchErlaubt`, je Zweck höchstens ein laufender Versuch (alle Aufrufer warten auf ihn); Erfolg → `leseFreigabe`, halten, `speichern`; bei `connect-raum` und alter Herkunft `stored`/`session` sofort `alt.loeschen()`, `lage.geloescht = true`, Logzeile `[connect] Zugang: alter Proxy-Key gelöscht, Freigabe vom Launcher bis ‹ISO›`; Misserfolg → `letzterGrund`/`detail`; danach `waehleZugang`. `antwort()`: `freigabe-verwerfen` → Freigabe weg, `speichern`, nächster Versuch sofort erlaubt; `key-abgelehnt` → `altAbgelehnt = true` und `alt.loeschen()` (nicht bei `env`). `bestaetigt('zoom-sdk', freigabe)` → alter Schlüssel `stored`/`session` löschen, `true` genau beim ersten Mal; sonst `false`. Jede Änderung ruft `geaendert()`. Keine Logzeile nennt ein Token.
  - `huelle.ts`: `starteZugang(o: { userData: string; appData: string }): ZugangsHalter` (Datei `<userData>/connect-zugang.bin`, safeStorage, `geheimnisDatei`; unlesbar → leer mit Logzeile `[connect] Zugang: gehaltene Freigaben nicht lesbar, Connect holt neue beim Launcher`), `zugangsHalter(): ZugangsHalter` (wirft vor `starteZugang`), `beiZugangsAenderung(cb: () => void): void`.

- [ ] **Step 1: Die failing tests schreiben**

```ts
const T = new Date(2026, 10, 20, 9, 0).getTime();
const halter = (o: Partial<Opt> = {}) => { /* Attrappe: holeFreigabe zählt Aufrufe, antwortet nach o.antwort; alt merkt loeschen(); speichern merkt die Inhalte; log sammelt Zeilen */ };
{
  const h = halter({ antwort: ok('jm1.test-raum') });
  const [a, b, c] = await Promise.all([h.zugang('connect-raum', 'cop31-tag1'), h.zugang('connect-raum', 'cop31-tag1'), h.zugang('connect-raum', 'cop31-tag1')]);
  ck('T11 RF2: drei gleichzeitige Bedarfe → genau ein holeFreigabe (jm-connect, connect-raum, cop31-tag1), alle bekommen die Freigabe',
    h.aufrufe.length === 1 && JSON.stringify(h.aufrufe[0]) === '{"appId":"jm-connect","zweck":"connect-raum","ziel":"cop31-tag1"}' && [a, b, c].every((w) => w.art === 'freigabe'));
  ck('T11 6.3: zweiter Bedarf ohne Launcher, gespeichert wird nur die Freigabe', (await h.zugang('connect-raum', 'cop31-tag1')).art === 'freigabe' && h.aufrufe.length === 1 && JSON.stringify(Object.keys(h.gespeichert.at(-1))) === '["connect-raum"]');
}
ck('T11 QR2: anderer Raum → neuer Versuch; gleicher Raum erst unter 24 h Rest; Fehlschlag höchstens alle 30 s', …);
ck('T11 6.3: Neustart mit gehaltener Freigabe (gehalten aus der Datei) → Bearer ohne holeFreigabe', …);
ck('T11 OT10: Launcher 0.18.0 (unbekannter-zweck) mit altem Key → alter-key, lage.letzterGrund unbekannter-zweck; ohne alten Key → keiner', …);
ck('T11 OT9: erste connect-raum-Freigabe löscht den gespeicherten Proxy-Key genau einmal, lage.geloescht; aus der Umgebung nie', …);
ck('T11 OT9: zoom-sdk: Altlast fällt erst mit bestaetigt() (true genau einmal), nicht beim Erhalt', …);
ck('T11 QR5: 403 auf eine Freigabe → verworfen, nächster zugang() holt sofort neu', …);
ck('T11 OE5, OT8: 401 alter-key-abgelaufen auf den alten Key → altAbgelehnt, Key gelöscht, danach keiner (kein Rückfall)', …);
ck('T11 G4: tokens() nennt alle gehaltenen Freigaben; keine Logzeile enthält jm1.', …);
ck('T11 G9: halter.ts importiert nur Typen; huelle.ts schreibt nur die Ausgabe von geheimnisDatei',
  !/^import (?!type)/m.test(read('src/main/zugang/halter.ts')) && read('src/main/zugang/huelle.ts').includes('geheimnisDatei(') && !/writeFileSync\([^)]*JSON\.stringify/.test(read('src/main/zugang/huelle.ts')));
```

Jede `…`-Prüfung baut sich ihren Halter mit `halter({ … })`, stellt die Uhr über `o.jetzt` und vergleicht `aufrufe`, `geloescht`, `lage(…)` und die Rückgaben mit den Werten im Namen.

In `zoom-settings.test.ts` (Muster der Attrappen dort):

```ts
writeFileSync(join(wurzel, 'connect-settings.json'), JSON.stringify({ proxyKeyEnc: enc('test-proxy'), zoomZugangEnc: enc('{"clientId":"ID-1","clientSecret":"s"}'), zoomSdkKeyEnc: enc('sdk-test'), zoomLetzteNummer: '123 456', zoomLetzterKenncodeEnc: enc('Code-1') }));
s.setProxyKey(''); s.zoomZugangLoeschen(); s.zoomSdkSchluesselLoeschen();
const nach = JSON.parse(readFileSync(join(wurzel, 'connect-settings.json'), 'utf8'));
ck('T11 Spec 184, N1: nach den drei Löschungen steht keins von proxyKeyEnc, zoomZugangEnc, zoomSdkKeyEnc in der Datei; zoomLetzteNummer und zoomLetzterKenncodeEnc bleiben',
  !('proxyKeyEnc' in nach) && !('zoomZugangEnc' in nach) && !('zoomSdkKeyEnc' in nach) && nach.zoomLetzteNummer === '123 456' && 'zoomLetzterKenncodeEnc' in nach);
```

`enc(t)` = `Buffer.from('E:' + t).toString('base64')` (die Attrappe von `safeStorage`).

- [ ] **Step 2: Laufen lassen, Rot sehen**

Run: `cd apps/connect && npx tsx test/zugang-halter.test.ts && npx tsx test/zoom-settings.test.ts`
Expected: Abbruch beim Import von `halter`; der Settings-Block ist schon grün (er belegt, dass die Löschwege genügen).

- [ ] **Step 3: Halter, Hülle und Start umsetzen**

`halter.ts` nach Interfaces. `huelle.ts`: liest die Datei einmal beim Start, `speichern` schreibt `geheimnisDatei(g, safeStorage-Adapter)` mit `mode: 0o600` (bei `null` nichts), `holeFreigabe(a, { appDataDir: o.appData })`, `alt['connect-raum'] = { lesen: () => ({ wert: proxyKey(), herkunft: proxyKeySource() }), loeschen: () => { setProxyKey(''); return true; } }`, `alt['zoom-sdk'] = { lesen: () => zoomSdkSchluesselLesen(), loeschen: zoomSdkSchluesselLoeschen }`, `log` = `getLog().info`, `geaendert` ruft alle Rückrufe aus `beiZugangsAenderung`. `index.ts`: `starteZugang({ userData: app.getPath('userData'), appData: app.getPath('appData') })` als erste Zeile in `app.whenReady().then(…)`.

- [ ] **Step 4: Laufen lassen, Grün sehen**

Run: `cd apps/connect && npx tsx test/zugang-halter.test.ts && npx tsx test/zoom-settings.test.ts`, dann `npm run typecheck -w @jm/connect`
Expected: je `‹n› ok, 0 fehlgeschlagen.`; 0 `error TS`.

- [ ] **Step 5: Commit**

```bash
git add apps/connect/src/main/zugang/halter.ts apps/connect/src/main/zugang/huelle.ts apps/connect/src/main/index.ts apps/connect/test/zugang-halter.test.ts apps/connect/test/zoom-settings.test.ts apps/connect/package.json
git status --short
git commit -m "feat(connect): Freigaben beim Launcher holen, verschluesselt halten, erneuern; Altlasten nach OT9 (Anmeldung Teil 2)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 12: Cloud-Raum mit Freigabe (`room.ts`, kurze Raum-IDs, Status, Karte)

**Files:**
- Create: `apps/connect/src/main/raum-id.ts`
- Modify: `apps/connect/src/main/room.ts:1-58` (Kopf, Zugang, `isConfigured`, `openRoom`), `:116-131` (`closeRoom`, `sanitizeRoom` → `raumId`)
- Modify: `apps/connect/src/main/show-open.ts:26-48` (`roomFor` exportiert, über `raumId`)
- Modify: `apps/connect/src/main/ipc.ts:14`, `:28-46` (`ProxyInfo`, `currentStatus`), `:111-117` (`setProxy`), `registerIpc` (Rückruf `beiZugangsAenderung(pushStatus)`)
- Modify: `apps/connect/src/shared/types.ts:41-55` (`ProxyInfo.zugang`, `AppStatus.cloudZugang`), `apps/connect/src/shared/app-status.ts:7-45`
- Modify: `apps/connect/src/shared/ndi-text.ts:77` (T146)
- Modify: `apps/connect/src/renderer/src/App.tsx:370`, `:554-667` (`ProxyCard` → `CloudZugangKarte`)
- Create: `apps/connect/test/raum-zugang.test.ts`; Modify: `apps/connect/package.json:17`
- Test: `apps/connect/test/ndi-text.test.ts:167`, `:689-718`

**Interfaces:**
- Consumes: `zugangsHalter()`, `beiZugangsAenderung` (Task 11); `zugangsKopf`, `cloudZeile`, `grundText`, `ZUGANG_TEXT`, `leseFehlerCode` (Task 10); Worker `/connect/:id` (Task 3).
- Produces:
  - `raumId(roh: string): string` — Body (die Regel E8 ist nicht aus Signatur und Test ableitbar):
    ```ts
    export function raumId(roh: string): string {
      const s = roh.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
      if (s.length === 0 || s.length >= 6) return s;
      return `${s}-${createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 6)}`;
    }
    ```
  - `roomFor(show: { name: string; tools: { appId: string; settings?: Record<string, unknown> }[] }): string` (exportiert, Ergebnis über `raumId`, Rückfall `raumId('show')`)
  - `openRoom(room?: string, nowMs?: number): Promise<RoomSession>` unverändert in der Signatur: `id = raumId(room ?? '') || current?.room || randomId(8)`; Zugang `await zugangsHalter().zugang('connect-raum', id)`, `keiner` → mit `const lage = zugangsHalter().lage('connect-raum')` `throw new Error(ZUGANG_TEXT.raumNicht(grundText('connect-raum', lage.letzterGrund ?? 'kein-launcher', lage.detail)))` (CZ7) ohne Anfrage; Kopf `zugangsKopf('connect-raum', w)`; Antwort 401/403 → `zugangsHalter().antwort('connect-raum', w, status, code)`, 403 `raum-vergeben` → CZ8, 401 auf Freigabe → CZ9, sonst wie heute `Raum öffnen fehlgeschlagen (Proxy ‹status›).`
  - `closeRoom()` schickt denselben Zugang wie `openRoom` für den offenen Raum
  - `isConfigured(): boolean` = Adresse vorhanden
  - `ProxyInfo = { url: string; keySource: ProxyKeySource; configured: boolean; zugang: { text: string; ton: 'ok' | 'warn' | 'fehler' } }`; `AppStatus.cloudZugang: { text: string; ton: 'ok' | 'warn' | 'fehler' }` — `currentStatus()` füllt es mit `cloudZeile(zugangsHalter().lage('connect-raum'), Date.now())`, `baueAppStatus` kopiert es, `APP_STATUS_START.cloudZugang = { text: '', ton: 'ok' }` (noch nichts gemessen, wie `ndiGaeste: []`)
  - IPC `setProxy` übernimmt `url` und nur `key === ''` (Entfernen), genau mit den Zeilen `if (typeof p?.url === 'string') setProxyUrl(p.url);` und `if (p?.key === '') setProxyKey('');`; jeder andere Key wird verworfen

- [ ] **Step 1: Die failing tests schreiben**

`raum-zugang.test.ts` ersetzt `electron`, `@jm/app-runtime` und `./zugang/huelle` per `registerHooks` (die Hülle-Attrappe liefert einen Halter aus `globalThis.__halter`) und `globalThis.fetch` durch eine Attrappe, die URL, Methode und Kopfzeilen merkt:

```ts
const sha6 = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 6);
ck('T12 N4: raumId: show → show- und 6 Hex, stabil; cop31 → cop31-…; abcdef und 64 Zeichen unverändert; 70 → 64; ä-x → -x- und 6 Hex; leer bleibt leer; zwei kurze Namen verschieden; jede Ausgabe passt auf ID_RE',
  /^show-[0-9a-f]{6}$/.test(raumId('show')) && raumId('show') === raumId('show') && /^cop31-[0-9a-f]{6}$/.test(raumId('cop31'))
    && raumId('abcdef') === 'abcdef' && raumId('a'.repeat(64)) === 'a'.repeat(64) && raumId('b'.repeat(70)) === 'b'.repeat(64)
    && raumId('ä-x') === '-x-' + sha6('-x') && raumId('') === '' && raumId('show') !== raumId('cop31')
    && ['show', 'cop31', 'a', 'abcdef', '-x'].every((r) => /^[A-Za-z0-9_-]{6,64}$/.test(raumId(r))));
ck('T12 N4: Show „Show“ ohne Raum-Einstellung → raumId(„show“); explizite Raum-ID „ab“ → raumId(„ab“)',
  roomFor({ name: 'Show', tools: [] }) === raumId('show') && roomFor({ name: 'X Y Z', tools: [{ appId: 'jm-connect', settings: { room: 'ab' } }] }) === raumId('ab'));
ck('T12 9.1: Raum öffnen mit Freigabe → POST /connect/‹id› mit Bearer, ohne X-Proxy-Key; Ziel der Freigabe = aufgefüllte ID', …);
ck('T12 OT10: ohne Freigabe, mit altem Key → X-Proxy-Key; ohne beides → Fehler CZ7 mit Grundtext, keine Anfrage', …);
ck('T12 RF5: 403 raum-vergeben → Fehler CZ8 wörtlich; halter.antwort mit 403 und raum-vergeben', …);
ck('T12 QR5: 401 auf eine Freigabe → Fehler CZ9, halter.antwort mit 401', …);
ck('T12: Raum schließen schickt DELETE mit demselben Zugang für den offenen Raum', …);
ck('T12 Spec 166, E7: ipc.ts nimmt keinen neuen Proxy-Key an; App.tsx hat kein Feld „Proxy-Key“ und zeigt status.cloudZugang.text',
  /if \(p\?\.key === ''\) setProxyKey\(''\)/.test(read('src/main/ipc.ts')) && !read('src/renderer/src/App.tsx').includes('>Proxy-Key</label>')
    && read('src/renderer/src/App.tsx').includes('{status?.cloudZugang.text}'));
```

`ndi-text.test.ts:167` erwartet T146; `:701` erwartet die Schlüsselliste mit `'cloudZugang'`; `:691-695` und `:708` bauen den Status mit `cloudZugang: { text: 'x', ton: 'ok' }`.

- [ ] **Step 2: Laufen lassen, Rot sehen**

Run: `cd apps/connect && npx tsx test/raum-zugang.test.ts && npx tsx test/ndi-text.test.ts`
Expected: Abbruch beim Import von `raum-id` bzw. FAIL bei T146 und der Schlüsselliste.

- [ ] **Step 3: Raum, Status, Karte umsetzen**

Nach Interfaces. `room.ts`-Kopf (`:1-8`) beschreibt den Zugang über den Launcher und den alten Key im Übergang. `App.tsx`: `CloudZugangKarte` zeigt in der zugeklappten Form „Cloud-Zugang: ‹url› · “ und `{status?.cloudZugang.text}` (Farbe nach `ton`) und „ändern“; aufgeklappt das Feld „Adresse“ mit „Speichern“ (OFP11) und, nur bei `keySource` `stored`/`session`, CZ10 mit „Key entfernen“; `KEY_HINT` entfällt. Der Knopf „Raum öffnen“ (`App.tsx:386`) bleibt an `configured` (= Adresse da).

- [ ] **Step 4: Laufen lassen, Grün sehen**

Run: `cd apps/connect && npx tsx test/raum-zugang.test.ts && npx tsx test/ndi-text.test.ts`, dann `npm run typecheck -w @jm/connect`
Expected: je `‹n› ok, 0 fehlgeschlagen.`; 0 `error TS`.

- [ ] **Step 5: Commit**

```bash
git add apps/connect/src/main/raum-id.ts apps/connect/src/main/room.ts apps/connect/src/main/show-open.ts apps/connect/src/main/ipc.ts apps/connect/src/shared/types.ts apps/connect/src/shared/app-status.ts apps/connect/src/shared/ndi-text.ts apps/connect/src/renderer/src/App.tsx apps/connect/test/raum-zugang.test.ts apps/connect/test/ndi-text.test.ts apps/connect/package.json
git status --short
git commit -m "feat(connect): Cloud-Raum mit Freigabe, kurze Raum-IDs auffuellen, Zugangszeile statt Proxy-Key-Feld (Anmeldung Teil 2)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 13: „Zoom-SDK laden“ mit Freigabe

**Files:**
- Modify: `apps/connect/src/main/zoom/sdk-laden.ts:31-34` (`LadeFehler`), `:122-170` (`holeLink`)
- Modify: `apps/connect/src/main/zoom/kern.ts:167-176` (Abhängigkeit `halter`), `:1004-1030` (`sdkLaden`), `:1033-1075` (`ladeAblauf`), `:1183-1210` (S11-Bezug)
- Modify: `apps/connect/src/main/zoom/klartext.ts:56-58` (S11 raus, S12b neu), Text-Zuordnung von `ladeFehlerText`
- Modify: `apps/connect/src/main/zoom.ts:100-103` (`halter: zugangsHalter()`)
- Modify: `apps/connect/src/shared/zoom-text.ts:44-46` (`TEXT_S11` raus), `:534-575` (`sdkLaden: 'frei' | 'gesperrt'`)
- Test: `apps/connect/test/sdk-laden.test.ts:180-270`; `apps/connect/test/zoom-kern.test.ts:163-320` (Attrappe), `:1905-1960`, `:2125-2150`; `apps/connect/test/zoom-text.test.ts:13`, `:474`, `:534`, `:696`, `:718-720`

**Interfaces:**
- Consumes: `ZugangsHalter` (Task 11), `ZIEL_ZOOM_SDK`, `zugangsKopf`, `grundText`, `ZUGANG_TEXT.sdkGeloescht` (ZA6) (Task 10); Worker `/zoom-sdk` (Task 4).
- Produces:
  - `holeLink(e: { base: string; kopf: Record<string, string>; fassung: string; signal: AbortSignal; werkzeuge?: Partial<LadeWerkzeuge> }): Promise<LinkErgebnis>`; 401 → `{ ok: false, art: 'schluessel' }`; 403 → `{ ok: false, art: 'verweigert', code: string | null }` (Code aus dem Körper); sonst wie heute
  - `ZoomKernAbhaengigkeiten.halter: Pick<ZugangsHalter, 'zugang' | 'antwort' | 'bestaetigt' | 'lage' | 'tokens'>`
  - `sdkLaden()`: Sperre und `fehler → schliessen` wie heute, kein S11 mehr; `ladeAblauf` holt `await d.halter.zugang('zoom-sdk', ZIEL_ZOOM_SDK)` in der Phase `link` (nach dem Setzen von `ladung`); `keiner` → mit `const lage = d.halter.lage('zoom-sdk')` `ende(grundText('zoom-sdk', lage.letzterGrund ?? 'kein-launcher', lage.detail), …)` (N2 bei `detail === 'kein-jm-rechner'`); Antwort 401/403 → `d.halter.antwort('zoom-sdk', w, status, code)`, Text S12 (alter Key) bzw. S12b (Freigabe) bzw. `grundText(... 'kein-recht' ...)` bei 403; nach `link.ok` → `if (d.halter.bestaetigt('zoom-sdk', w)) hinweis(ZA6)`
  - `ZoomKnoepfe.sdkLaden: 'frei' | 'gesperrt'`

- [ ] **Step 1: Die failing tests schreiben**

`sdk-laden.test.ts`: die Prüfungen an `:189` und `:259-263` schicken `kopf: { Authorization: 'Bearer jm1.test-sdk' }` und erwarten diesen Kopf (und keinen `X-Zoom-Sdk-Key`); neu:

```ts
ck('T13: 403 mit {"code":"kein-recht"} → art verweigert, code kein-recht; 401 → schluessel', …);
ck('T13 OT10: alter Weg im Übergang: kopf {X-Zoom-Sdk-Key: sdk-test} geht genau so hinaus', …);
```

`zoom-kern.test.ts`: `baueKern` bekommt die Option `halter?: Partial<…>` (Vorgabe: liefert `{ art: 'freigabe', f: { zweck: 'zoom-sdk', token: 'jm1.test-sdk', bis: Date.now() + 72 * 3600_000, ziel: 'win-x64', konto: { name: 'Maria S.', stufe: 'kollege' } } }`, `antwort` und `bestaetigt` zählen mit, `lage` liefert eine Lage nach `o.halterLage`, `tokens: () => ['jm1.test-sdk']`). Der Block „ohne SDK-Schlüssel → S11“ (`:1905-1918`) wird (Halter liefert `{ art: 'keiner' }`, Lage `letzterGrund: 'kein-recht'`, `detail: 'kein-jm-rechner'`):

```ts
const CG8 = grundText('zoom-sdk', 'kein-recht', 'kein-jm-rechner');
ck('T13 N2: kein JM-Rechner → sdk.text CG8, Zustand bleibt, kein Link',
  text(r) === CG8 && !linkGefragt && p.kern.kurz().zustand === 'bereit' && p.kern.abbild().einrichtung.sdk.text === CG8);
ck('T13 4.4: die Freigabe wird erst nach dem Setzen von ladung geholt (zweiter Klick → S10)', …);
ck('T13 OT9: erster Link mit Freigabe → bestaetigt einmal, Hinweis ZA6 einmal; zweites Laden ohne neuen Hinweis', …);
ck('T13 QR5: 401 auf die Freigabe → halter.antwort(zoom-sdk, …, 401), Text S12b', …);
ck('T13 OT10: alter Schlüssel im Übergang → holeLink bekommt X-Zoom-Sdk-Key; 401 → S12 wie bisher', …);
```

`:2125-2150` (Ergebnisse S15/S12 nach „Eintragen“): Vorbereitung über die Halter-Option statt `sdkSchluesselEintragen`. `zoom-text.test.ts`: `TEXT_S11` aus Import und Tabellen (`:474`, `:534`, `:718-720`) entfernen; `:696` erwartet `zoomKnoepfe(mit('none', …)).sdkLaden === 'frei'`.

- [ ] **Step 2: Laufen lassen, Rot sehen**

Run: `cd apps/connect && npx tsx test/sdk-laden.test.ts && npx tsx test/zoom-kern.test.ts && npx tsx test/zoom-text.test.ts`
Expected: FAIL bei den geänderten und neuen `T13 …`-Prüfungen (tsx prüft keine Typen; die Typprüfung folgt in Step 4).

- [ ] **Step 3: Kopf statt Schlüssel, Kern und Knöpfe umsetzen**

Nach Interfaces. `holeLink` behält: nur HTTPS (HTTP nur für die eigene Maschine), `redirect: 'manual'`, kein Kopfwert in Log oder Fehlertext.

- [ ] **Step 4: Laufen lassen, Grün sehen**

Run: `cd apps/connect && npx tsx test/sdk-laden.test.ts && npx tsx test/zoom-kern.test.ts && npx tsx test/zoom-text.test.ts`, dann `npm run typecheck -w @jm/connect`
Expected: je `… 0 fehlgeschlagen…`; 0 `error TS`.

- [ ] **Step 5: Commit**

```bash
git add apps/connect/src/main/zoom/sdk-laden.ts apps/connect/src/main/zoom/kern.ts apps/connect/src/main/zoom/klartext.ts apps/connect/src/main/zoom.ts apps/connect/src/shared/zoom-text.ts apps/connect/test/sdk-laden.test.ts apps/connect/test/zoom-kern.test.ts apps/connect/test/zoom-text.test.ts
git status --short
git commit -m "feat(connect): Zoom-SDK laden mit Freigabe zoom-sdk, Absage auf Nicht-JM-Rechnern (N2), SDK-Schluessel nur im Uebergang (Anmeldung Teil 2)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 14: Quelle des Zoom-JWT (`jwt-quelle.ts`)

**Files:**
- Create: `apps/connect/src/main/zoom/jwt-quelle.ts`
- Create: `apps/connect/test/jwt-quelle.test.ts`; Modify: `apps/connect/package.json:17`

**Interfaces:**
- Consumes: `ZugangsHalter` (Task 11); `JwtGrund`, `ZoomAnmeldungLage`, `ZIEL_ZOOM_JWT` (Task 10); Worker `POST /zoom/jwt` (Task 6, Antwort E4).
- Produces:
  - `JWT_ERNEUERN_VOR_MS = 7_200_000`; `JWT_MIN_REST_MS = 300_000`
  - `type JwtHerkunft = 'server' | 'lokal'`; `type JwtErgebnis = { ok: true; jwt: string; bis: number; herkunft: JwtHerkunft } | { ok: false; grund: JwtGrund; detail: string | null }`
  - `interface JwtQuelle { hole(): Promise<JwtErgebnis>; angemeldet(h: JwtHerkunft): boolean; lage(): ZoomAnmeldungLage; geheimnisse(): string[]; stoppe(): void }`
  - `erzeugeJwtQuelle(d: { halter: Pick<ZugangsHalter, 'zugang' | 'antwort' | 'lage'>; holeServerJwt(token: string, ttlS: number | null): Promise<{ ok: true; jwt: string; gueltigS: number } | { ok: false; status: number; code: string | null }>; lokal: { lesen(): { daten: { clientId: string; clientSecret: string } | null; herkunft: ProxyKeySource }; loeschen(): boolean }; signiereLokal(z: { clientId: string; clientSecret: string }, ttlS: number): string; devTtlS: number | null; brauchtJwt(): boolean; jetzt(): number; zeitgeber(ms: number, fn: () => void): unknown; loescheZeitgeber(t: unknown): void; log(z: string): void; geaendert(): void }): JwtQuelle`
  - `holeServerJwt(base: string, token: string, ttlS: number | null, f?: typeof fetch): Promise<…>` — `POST ‹base›/zoom/jwt`, `Authorization: Bearer`, bei `ttlS !== null` Rumpf `{"ttlS":‹n›}` mit `content-type: application/json` (sonst ohne Rumpf), `redirect: 'manual'`, nur HTTPS (HTTP nur `127.0.0.1`/`localhost`), Zeitlimit 10 s; Antwort ohne Text `jwt` oder ohne ganze Zahl `gueltigS` > 0 → `{ ok: false, status: 502, code: null }`; Netzfehler → `{ ok: false, status: 0, code: null }`
  - `devTtl(env: Record<string, string | undefined>): number | null` — `JMPS_ZOOM_JWT_TTL_S` als ganze Zahl 1800–43 200, sonst `null`
  - Reihenfolge in `hole()` (ein laufender Abruf für alle Aufrufer): (1) entfällt (E9: mit `devTtlS` wird nie lokal signiert); (2) JWT im RAM mit Rest ≥ 2 h → es — nicht bei `devTtlS !== null`; (3) `halter.zugang('zoom-jwt', ZIEL_ZOOM_JWT)` → Freigabe → Server mit `ttlS = devTtlS`: Erfolg → halten mit `bis = jetzt + gueltigS × 1000`, Zeitgeber auf `bis − 2 h` (feuert nur, wenn `brauchtJwt()`, und holt dann neu; bei `devTtlS !== null` kein Zeitgeber); 401/403 → `halter.antwort(…)`, Grund `server-abgelehnt`; 503 mit Code `nicht-eingerichtet` → `nicht-eingerichtet`; sonst `server-fehler` mit Detail `HTTP ‹status›` bzw. `Netz`; (4) JWT im RAM mit Rest ≥ 5 min → es; (5) lokale Daten → lokal mit 43 200 s (Übergang); (6) Fehler mit dem Grund aus (3) bzw. `halter.lage('zoom-jwt').letzterGrund ?? 'kein-launcher'`. `angemeldet('server')` löscht lokale Daten mit Herkunft `stored`/`session` genau einmal (→ `true`); `'lokal'` nie. Logzeilen nennen nie JWT oder Token, nur Herkunft und `bis` als ISO.

- [ ] **Step 1: Die failing tests schreiben**

```ts
let uhr = new Date(2026, 10, 20, 9, 0).getTime();
const q = (o: Partial<Opt> = {}) => { /* Attrappen: halter.zugang zählt und liefert o.wahl ?? Freigabe jm1.test-jwt; holeServerJwt zählt und liefert o.server ?? { ok: true, jwt: 'test.jwt.' + n, gueltigS: 43_170 }; lokal nach o.lokal; zeitgeber merkt [ms, fn] */ };
{
  const x = q();
  const a = await x.quelle.hole(); const b = await x.quelle.hole();
  ck('T14 OT2: erster Bedarf: Freigabe und JWT vom Server; zweiter Bedarf aus dem RAM, ohne Abruf',
    a.ok && b.ok && a.jwt === 'test.jwt.1' && b.jwt === a.jwt && x.server.length === 1 && x.zugang.length === 1 && a.herkunft === 'server' && a.bis === uhr + 43_170_000);
}
ck('T14 RF1: Uhr 3 h vor oder nach: bis = lokale Uhr + gueltigS; ein Zeitgeber auf bis − 2 h = 36 370 000 ms', …);
ck('T14 OT2: unter 2 h Rest → neues JWT; Zeitgeber feuert nur bei brauchtJwt() true', …);
{
  const x = q();
  const [a, b] = await Promise.all([x.quelle.hole(), x.quelle.hole()]);
  ck('T14 RF2: zwei gleichzeitige Bedarfe → genau ein zugang() und ein Server-Abruf', a.ok && b.ok && x.zugang.length === 1 && x.server.length === 1);
}
ck('T14 6.3: Server weg, JWT im RAM mit 1 h Rest → ok aus dem RAM; mit 4 min Rest und lokalen Daten → lokal; ohne → server-fehler, Detail Netz', …);
ck('T14 OT10: Freigabe nicht zu bekommen (unbekannter-zweck), lokale Daten → lokal, lage.quelle lokal mit Grund unbekannter-zweck', …);
ck('T14 OT8: weder Freigabe noch lokale Daten → ok false mit Grund kein-launcher, kein signiereLokal', …);
ck('T14 QR5: 401 vom Server → halter.antwort(zoom-jwt, …, 401), Grund server-abgelehnt; 503 nicht-eingerichtet → nicht-eingerichtet', …);
ck('T14 OT9: angemeldet(server) löscht gespeicherte Daten genau einmal (true, dann false); lokal und Umgebung nie', …);
ck('T14 E9, M4: devTtlS 1860 → jeder Bedarf holt beim Server mit ttlS 1860 (zweiter Bedarf nicht aus dem RAM), kein Zeitgeber, lage.devTtlS 1860; auch mit lokalen Daten nie signiereLokal, solange der Server liefert', …);
ck('devTtl: 1800 und 43200 gelten, 1799, 43201, 2e3x, leer → null', devTtl({ JMPS_ZOOM_JWT_TTL_S: '1800' }) === 1800 && devTtl({ JMPS_ZOOM_JWT_TTL_S: '43200' }) === 43_200
  && [ '1799', '43201', '2e3x', '' ].every((v) => devTtl({ JMPS_ZOOM_JWT_TTL_S: v }) === null) && devTtl({}) === null);
ck('T14 G4: keine Logzeile enthält test.jwt. oder jm1.; geheimnisse() nennt das gehaltene JWT', …);
ck('T14: holeServerJwt: POST ‹base›/zoom/jwt mit Bearer und redirect manual; mit ttlS 1860 Rumpf {"ttlS":1860} und content-type application/json, mit null ohne Rumpf; http://beispiel → kein Abruf; Antwort ohne gueltigS → status 502', …);
```

- [ ] **Step 2: Laufen lassen, Rot sehen**

Run: `cd apps/connect && npx tsx test/jwt-quelle.test.ts`
Expected: Abbruch mit „Cannot find module '../src/main/zoom/jwt-quelle'“.

- [ ] **Step 3: `jwt-quelle.ts` umsetzen**

Nach Interfaces; keine Electron-Importe; Kopfkommentar: Entwurf „Zoom-JWT“, OT2, OT3, OT9, R6, E4, E9.

- [ ] **Step 4: Laufen lassen, Grün sehen**

Run: `cd apps/connect && npx tsx test/jwt-quelle.test.ts`, dann `npm run typecheck -w @jm/connect`
Expected: `‹n› ok, 0 fehlgeschlagen.`; 0 `error TS`.

- [ ] **Step 5: Commit**

```bash
git add apps/connect/src/main/zoom/jwt-quelle.ts apps/connect/test/jwt-quelle.test.ts apps/connect/package.json
git status --short
git commit -m "feat(connect): Zoom-JWT vom Worker, nur im RAM, Erneuern unter 2 h Rest, Uebergang mit lokalen Zugangsdaten (Anmeldung Teil 2)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 15: Kern: JWT vor dem Start, neue Zustände statt `zugang_fehlt`, Masken

**Files:**
- Modify: `apps/connect/src/main/zoom/kern.ts:9-12` (Kopf), `:167-176` (Abhängigkeit `jwt`), `:240-300` (`ZoomKern` um `zugangGeaendert()`, `brauchtJwt()`), `:820-836` (`abbild().einrichtung.anmeldung`), `:908-918` (`bestimmeMaengel`), `:1256-1267` (`geheimnisse`), `:1343-1346` (`auth` → `angemeldet`), `:1366-1382` (JWT vor S-c), `:1454-1462` (S-d nimmt das geholte JWT)
- Modify: `apps/connect/src/main/zoom/klartext.ts:197-207` (`authMeldung(code, herkunft)`), `:236-248` (`mangelText`), `:281-292` (`VersuchsAusgang`), `:310-330` (`istEndgueltig`); Texte B9s, B10s
- Modify: `apps/connect/src/shared/types.ts:97-102` (`ZoomMangel`), `ZoomAbbild.einrichtung` (`anmeldung: { text: string; ton: 'ok' | 'warn' | 'fehler' }`)
- Modify: `apps/connect/src/shared/zoom-text.ts:110-114` (`MANGEL_GRUND`)
- Modify: `apps/connect/src/main/zoom.ts:95-145` (`erzeugeJwtQuelle` mit `holeServerJwt(proxyUrl(), …)`, `zoomZugangLesen`/`zoomZugangLoeschen`, `buildJwt`, `devTtl(process.env)`, `brauchtJwt: () => kern?.brauchtJwt() ?? false`, `geaendert: () => kern?.zugangGeaendert()`; `beiZugangsAenderung(() => kern?.zugangGeaendert())`)
- Test: `apps/connect/test/zoom-kern.test.ts:163-320` (Attrappe `jwt`), `:436-530`, `:821-825`, `:2185-2186`, neuer Block vor der Ende-Marke; `apps/connect/test/zoom-text.test.ts:83`, `:216`, `:437`, `:635`, `:821`

**Interfaces:**
- Consumes: `JwtQuelle`, `JwtHerkunft`, `holeServerJwt`, `devTtl` (Task 14); `anmeldungZeile`, `jwtGrundText`, `ZUGANG_TEXT` (Task 10); `halter.tokens()` (Task 13).
- Produces:
  - `ZoomKernAbhaengigkeiten.jwt: JwtQuelle`; `ZoomKern.zugangGeaendert(): void` (Abbild neu), `ZoomKern.brauchtJwt(): boolean` (Zustand `startet`, `tritt_bei`, `warteraum`, `im_meeting`, `abriss`)
  - `ZoomMangel = 'sdk_fehlt' | 'sdk_defekt' | 'bridge_fehlt'`
  - `VersuchsAusgang` `{ art: 'zugang'; grund: JwtGrund }`; `istEndgueltig`: `zugang` vorübergehend bei `kein-launcher`, `server-nicht-erreichbar`, `server-fehler`, sonst endgültig
  - `starteBridge()`: nach S-b `const j = await d.jwt.hole()`; `!j.ok` → `{ ok: false, meldung: { text: ZUGANG_TEXT.ohneAnmeldung(jwtGrundText(j.grund, j.detail)), detail: j.grund }, mangel: null, ausgang: { art: 'zugang', grund: j.grund } }` (kein `mangelFolgen`, Nummer und Kenncode bleiben); `jwt = j.jwt` und `jwtHerkunft = j.herkunft` vor S-c
  - `auth` mit Code 0 → `if (d.jwt.angemeldet(jwtHerkunft)) hinweis(ZA5)`; Code ≠ 0 → `authMeldung(code, jwtHerkunft)` (1, 2 → B9s; 11 → B10s bei `server`)
  - `geheimnisse()` = bisherige Werte + `d.jwt.geheimnisse()` + `d.halter.tokens()`
  - `GEHEIM` (`:414`) bleibt unverändert

- [ ] **Step 1: Die failing tests schreiben**

`baueKern` bekommt `jwt?: Partial<JwtQuelle>` und ein Feld `reihenfolge: string[]`, in das die Attrappe von `jwt.hole` `'hole'` und die `bridgeFabrik` `'fabrik'` schreibt (Vorgabe: `hole` liefert `{ ok: true, jwt: 'test-jwt-server', bis: Date.now() + 43_170_000, herkunft: 'server' }` und zählt, `angemeldet` zählt und liefert `o.angemeldetLiefert ?? false`, `lage` liefert eine Server-Lage, `geheimnisse: () => ['test-jwt-server']`). Die Prüfungen mit `zugang_fehlt` (`:442`, `:510`, `:823`, `:2185-2186`) erwarten die Mängel ohne Zugang (`["sdk_fehlt"]` bzw. `[]` und Zustand `bereit`). Neuer Block:

```ts
ck('T15 R6: Beitritt holt das JWT vor dem Start der Bridge; auth bekommt genau dieses JWT', reihenfolge.join(',') === 'hole,fabrik' && gesendet.some((c) => c.cmd === 'auth' && c.jwt === 'test-jwt-server'));
ck('T15 ➕1e: kein JWT (kein-launcher) → Zustand fehler, Meldung ZA7 mit CG1, keine Mängel, Nummer und Kenncode bleiben, „Erneut beitreten“ möglich, keine Bridge',
  p.kern.kurz().zustand === 'fehler' && p.kern.abbild().meldung?.text === 'Ohne Zoom-Anmeldung kein Beitritt. Kein Launcher mit Anmeldung gefunden. Starte den Launcher und melde dich dort an.'
    && p.kern.kurz().maengel.length === 0 && p.kern.abbild().erneutMoeglich === true && p.startZahl() === 0);
ck('T15 6.4: Wiederbeitritt: Quelle liefert aus dem RAM ohne Launcher; server-nicht-erreichbar → nächster Versuch nach Plan; kein-recht → endgültig', …);
ck('T15 5.3: ohne lokale Zugangsdaten und ohne Freigabe ist Zoom bereit (nur Laufzeit-Mängel)', …);
ck('T15 OT9: auth 0 mit Server-JWT → angemeldet(server) einmal, Hinweis ZA5 einmal; mit lokalem JWT → angemeldet(lokal), kein Hinweis', …);
ck('T15 B9/B10: Auth-Code 2 und 11 mit Server-JWT → B9s, B10s wörtlich; mit lokalem JWT → B9, B10 wie bisher', …);
ck('T15 8.7: Bridge-Logzeile mit test-jwt-server und jm1.test-sdk → beide als •••', …);
ck('T15: Einrichtung zeigt die Zeile Zoom-Anmeldung aus anmeldungZeile (ZA1 bei Server-Lage)', p.kern.abbild().einrichtung.anmeldung.text.startsWith('Zoom-Anmeldung über den Launcher (Maria S. · Kollege)'));
```

`zoom-text.test.ts:216` erwartet `MANGEL_GRUND` mit genau `sdk_fehlt`, `sdk_defekt`, `bridge_fehlt`; `:83`, `:437`, `:635`, `:821` nutzen `['sdk_fehlt']` statt `zugang_fehlt`.

- [ ] **Step 2: Laufen lassen, Rot sehen**

Run: `cd apps/connect && npx tsx test/zoom-kern.test.ts && npx tsx test/zoom-text.test.ts`
Expected: FAIL bei den `T15 …`-Prüfungen und den geänderten Mängel-Erwartungen; die G2-Prüfungen (`:1567-1613`) bleiben `ok`.

- [ ] **Step 3: Kern, Klartexte, Typen und Hülle umsetzen**

Nach Interfaces. `kern.ts:9-12` sagt: „Das JWT kommt aus der JWT-Quelle (Server über den Launcher, im Übergang lokal); es geht nur per stdin an die Bridge, kein Secret erreicht den Kindprozess.“ `bestimmeMaengel` liest `d.zugang` weiter nur für die Übergangszeile im Abbild.

- [ ] **Step 4: Laufen lassen, Grün sehen**

Run: `cd apps/connect && npx tsx test/zoom-kern.test.ts && npx tsx test/zoom-text.test.ts && npx tsx test/zoom-slots.test.ts`, dann `npm run typecheck -w @jm/connect`
Expected: je `… 0 fehlgeschlagen…`; 0 `error TS`.

- [ ] **Step 5: Commit**

```bash
git add apps/connect/src/main/zoom/kern.ts apps/connect/src/main/zoom/klartext.ts apps/connect/src/main/zoom.ts apps/connect/src/shared/types.ts apps/connect/src/shared/zoom-text.ts apps/connect/test/zoom-kern.test.ts apps/connect/test/zoom-text.test.ts
git status --short
git commit -m "feat(connect): JWT vor dem Bridge-Start aus der JWT-Quelle, Zugang kein Einrichtungsmangel mehr, Masken fuer Freigaben (Anmeldung Teil 2)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 16: Zoom-Karte und IPC ohne Eingaben für alte Werte

**Files:**
- Modify: `apps/connect/src/main/zoom/kern.ts:165-176` (`zugang` ohne `speichern`, `sdkSchluessel` ohne `speichern`), `:250-256` (Schnittstelle), `:1120-1167` (`zugangWaehlen`, `zugangUebernehmen`, `zugangEintragen` raus), `:1182-1201` (`sdkSchluesselEintragen` raus), `:3090-3094`
- Delete: `apps/connect/src/main/zoom/zugang-eingabe.ts`, `apps/connect/src/main/zoom/sdk-schluessel-eingabe.ts`
- Modify: `apps/connect/src/main/zoom.ts:12-13`, `:38-48` (Importe), `:100-101`, `:149-175` (drei Kanäle raus)
- Modify: `apps/connect/src/main/settings.ts:238-267` (`zoomZugangSpeichern` raus), Funktion `zoomSdkSchluesselSpeichern` raus
- Modify: `apps/connect/src/shared/ipc.ts:55-63`, `apps/connect/src/preload/index.ts:86-92`, `apps/connect/src/renderer/src/jmconnect.d.ts` (drei Kanäle raus)
- Modify: `apps/connect/src/renderer/src/zoom/ZoomCard.tsx:47` (ZS1), `:96-225` (`ZugangEingabe`, `SchluesselEingabe` raus), `:605-690` (Zeilen)
- Modify: `apps/connect/src/shared/zoom-text.ts:488-528` (`zugangZeile` → ZU1/ZU3, `sdkSchluesselZeile` → ZU2; `null` = keine Zeile)
- Test: `apps/connect/test/zoom-kern.test.ts:486-667`, `:1490-1560`, `:1950-1955`; `apps/connect/test/zoom-teile.test.ts:111-121`; `apps/connect/test/zoom-settings.test.ts:50-60`, `:90-142`; `apps/connect/test/zoom-text.test.ts`

**Interfaces:**
- Consumes: alles aus Task 13 und 15.
- Produces:
  - `zugangZeile(a: ZoomAbbild): string | null` — `stored` → ZU1, `session` → TEXT_A4 bzw. TEXT_A4_SCHREIBFEHLER, `env` → TEXT_A6, unlesbar → ZU3, `none` → `null`
  - `sdkSchluesselZeile(a: ZoomAbbild): string | null` — `stored`/`session` → ZU2, `env` → `SDK-Schlüssel: aus der Umgebung`, `none` → `null`
  - `ZoomKnoepfe.zugangEntfernbar: boolean` (nur `stored`, `session`, unlesbar)
  - Kern behält `zugangLoeschen()` und `sdkSchluesselLoeschen()` unverändert

- [ ] **Step 1: Die failing tests schreiben**

`zoom-text.test.ts`:

```ts
kreuz('T16 E7: Übergangszeilen nur mit altem Wert (Herkunft × unlesbar)', [
  ['stored', String(zugangZeile(mitZugang('stored', 'test-id-1234'))), 'Alte Zugangsdaten: hinterlegt (Client-ID endet auf 1234), nur noch im Übergang.'],
  ['unlesbar', String(zugangZeile(mitZugang('none', null, true))), 'Alte Zugangsdaten lassen sich unter diesem Windows-Konto nicht entschlüsseln. Sie werden nicht mehr gebraucht; „Entfernen“ räumt sie weg.'],
  ['none', String(zugangZeile(mitZugang('none'))), 'null'],
  ['SDK stored', String(sdkSchluesselZeile(mitSdk('stored'))), 'Alter SDK-Schlüssel: hinterlegt, nur noch im Übergang.'],
  ['SDK none', String(sdkSchluesselZeile(mitSdk('none'))), 'null'],
  ['entfernbar env', String(zoomKnoepfe(mitZugang('env')).zugangEntfernbar), 'false'],
]);
```

Neuer Quelltext-Wächter in `zoom-teile.test.ts` (ersetzt `:111-121`):

```ts
ck('T16 Spec 22, 166: kein Eintragen oder Wählen alter Werte mehr in Kern, Hülle, IPC, Preload, Karte und Einstellungen',
  ['src/main/zoom/kern.ts', 'src/main/zoom.ts', 'src/shared/ipc.ts', 'src/preload/index.ts', 'src/renderer/src/zoom/ZoomCard.tsx', 'src/main/settings.ts']
    .every((f) => !/zugangEintragen|zugangWaehlen|sdkSchluesselEintragen|ZugangEingabe|SchluesselEingabe|zoomZugangSpeichern|zoomSdkSchluesselSpeichern/.test(read(f)))
    && !existsSync('src/main/zoom/zugang-eingabe.ts') && !existsSync('src/main/zoom/sdk-schluessel-eingabe.ts')
    && read('src/renderer/src/zoom/ZoomCard.tsx').includes("'Zoom ist gesperrt, bis das Zoom-SDK eingerichtet ist.'"));
```

In `zoom-kern.test.ts` entfallen die Blöcke, die die entfernten Wege prüfen (`:486-627` Datei und Handeingabe, `:1490-1560` SDK-Schlüssel eintragen, `:667` und `:1954` je die Teilprüfung mit `zugangWaehlen` bzw. `sdkSchluesselEintragen`); die Teilprüfungen mit `zugangLoeschen`/`sdkSchluesselLoeschen` bleiben. `zoom-settings.test.ts` legt alte Werte direkt in die Datei (`enc()` aus Task 11) statt über die Speicher-Funktionen; die Prüfungen auf Lesen, Entfernen und Schreibschutz bleiben inhaltlich gleich.

- [ ] **Step 2: Laufen lassen, Rot sehen**

Run: `cd apps/connect && npx tsx test/zoom-text.test.ts && npx tsx test/zoom-teile.test.ts`
Expected: FAIL bei `T16 …`.

- [ ] **Step 3: Eingabewege entfernen, Karte umbauen**

Nach Interfaces. Die Zoom-Karte zeigt im Einrichtungsbereich: SDK-Zeile und Knöpfe wie bisher, die Zeile `abbild.einrichtung.anmeldung` (Farbe nach `ton`), darunter nur bei `zugangZeile(a) !== null` die Übergangszeile mit „Entfernen“ (bei `zugangEntfernbar`), ebenso für den SDK-Schlüssel mit `sdkSchluesselEntfernbar`.

- [ ] **Step 4: Laufen lassen, Grün sehen**

Run: `npm run selftest -w @jm/connect`, `npm run typecheck -w @jm/connect`
Expected: jede Summenzeile `0 fehlgeschlagen`; 0 `error TS`.

- [ ] **Step 5: Commit**

```bash
git add apps/connect/src/main/zoom/kern.ts apps/connect/src/main/zoom.ts apps/connect/src/main/settings.ts apps/connect/src/shared/ipc.ts apps/connect/src/preload/index.ts apps/connect/src/renderer/src/jmconnect.d.ts apps/connect/src/renderer/src/zoom/ZoomCard.tsx apps/connect/src/shared/zoom-text.ts apps/connect/test/zoom-kern.test.ts apps/connect/test/zoom-teile.test.ts apps/connect/test/zoom-settings.test.ts apps/connect/test/zoom-text.test.ts
git rm apps/connect/src/main/zoom/zugang-eingabe.ts apps/connect/src/main/zoom/sdk-schluessel-eingabe.ts
git status --short
git commit -m "feat(connect): keine Eingabe alter Schluessel und Zugangsdaten mehr, Zeilen nur im Uebergang (Anmeldung Teil 2)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 17: Handbuch JM Connect und Version 0.5.0

**Files:**
- Modify: `packages/cookbook/content/tool-manuals/tool-jm-connect.md:12-14`, `:31-33`, `:51`, `:109-113`, `:174-175`, `:185-186`, `:193-194`, `:262-263`, `:273`; neuer Unterabschnitt „Anmeldung (ab 0.5.0)“ vor `:109`
- Modify: `packages/cookbook/cookbook.json` (nur per `npm run cookbook:build`)
- Modify: `apps/connect/package.json:3`, `package-lock.json:110`

**Interfaces:**
- Consumes: Texte aus T3/T4 (wörtlich zitiert, wo das Handbuch eine Meldung nennt).
- Produces: keine.

- [ ] **Step 1: Prüfung vorbereiten**

Run: `node -e "const t=require('fs').readFileSync('packages/cookbook/content/tool-manuals/tool-jm-connect.md','utf8');const alt=['SDK-Schlüssel“ auf „Eintragen','Datei wählen …“ oder „Eintragen','Zugangsdaten fehlen — bitte eintragen','Zugangsdaten hinterlegt (Client-ID','Adresse und Proxy-Key prüfen'];const neu=['Zoom-Anmeldung über den Launcher','„Zoom-SDK laden“ gibt es nur auf JM-Rechnern','Launcher aktualisieren (ab 0.19.0)','Das gemerkte Meeting bleibt'];const f=alt.filter(a=>t.includes(a)).concat(neu.filter(n=>!t.includes(n)).map(n=>'fehlt: '+n));console.log(f.join('\n')||'ok');process.exit(f.length?1:0)"`
Expected: Exit 1 mit den alten Stellen und den fehlenden neuen Sätzen.

- [ ] **Step 2: Handbuch umschreiben**

`:12-14` und `:31-33`: „JM Connect ab 0.5.0 und Launcher ab 0.19.0, angemeldet“; Zoom-SDK „auf JM-Rechnern per „Zoom-SDK laden“, sonst als SDK-Ordner aus der JM-Ablage“; keine Zugangsdaten mehr. `:51`: „Raum öffnen (braucht die Anmeldung im Launcher)“. Neuer Unterabschnitt: was die Zeilen „Cloud-Zugang“ und „Zoom-Anmeldung“ sagen (CZ1, ZA1), dass Connect seine Freigaben 72 h hält und ein laufendes Meeting nicht am Launcher hängt, der Übergang (CZ2, ZA2, alte Werte nur entfernen) und „Das gemerkte Meeting bleibt“. `:109-113`: Einrichtung ohne Schlüssel und Zugangsdaten. Pannenhilfe `:174-175`, `:185-186`, `:193-194`: S11/S12 → CG8, S12b; B9/B10 → B9s/B10s (alte Zeilen bleiben für den Übergang mit „mit alten Zugangsdaten:“); B17 → ZA7 mit CG1 bis CG6; neue Zeilen für CZ8 und CG3. `:262` = T146. `:273`: „Im Launcher angemeldet; Zeile „Zoom-Anmeldung“ grün“. Danach `npm run cookbook:build`.

- [ ] **Step 3: Prüfung grün**

Run: dieselbe Prüfung wie Step 1, dann `npm run cookbook:check`
Expected: `ok`, Exit 0; „cookbook.json ist frisch (… Rezepte).“

- [ ] **Step 4: Commit Handbuch**

```bash
git add packages/cookbook/content/tool-manuals/tool-jm-connect.md packages/cookbook/cookbook.json
git status --short
git commit -m "docs(connect): Handbuch fuer Cloud-Raum, Zoom-Anmeldung und SDK laden ueber den Launcher (Anmeldung Teil 2)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Version 0.5.0 setzen und committen**

`apps/connect/package.json:3` und `package-lock.json:110` auf `"0.5.0"`; Prüfung wie Task 9 Step 6 für `apps/connect` → Exit 0.

```bash
git add apps/connect/package.json package-lock.json
git status --short
git commit -m "chore(connect): Version 0.5.0 (Anmeldung Teil 2)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Phase D · Doku und Release-Vorbereitung

### Task 18: Texttabelle zur Owner-Freigabe und Changelog-Entwürfe

**Files:**
- Create: `docs/anmeldung-teil2-texte.md`
- Modify: `packages/suite-manifest/changelog.json` (App `launcher`: Eintrag 0.19.0; App `connect`: Eintrag 0.5.0; je oben in `entries`)

**Interfaces:**
- Consumes: alle Texte aus Task 2, 9–17 wie umgesetzt.
- Produces: die Vorlage für den Owner; Tor für N2 und N3.

- [ ] **Step 1: Prüfskript schreiben (Scratchpad, nicht committen)**

`pruefe-texte.mjs` liest `docs/anmeldung-teil2-texte.md`, nimmt aus jeder Tabellenzeile mit Nr. aus T1–T4 die Spalte „Text“, ersetzt Platzhalter ‹…› durch einen regulären Ausdruck `.+?` und sucht jeden Text in den Dateien der Spalte „Ort“; dazu `JSON.parse` von `changelog.json` und die Prüfung, dass kein Changelog-Text ein ASCII `"` enthält und jeder Text aus T5 genau einmal vorkommt. Ausgabe: fehlende Nummern, Exit 1 bei einem Fehlenden.

- [ ] **Step 2: Laufen lassen, Rot sehen**

Run: `node <scratchpad>/pruefe-texte.mjs`
Expected: Exit 1 („Datei fehlt“).

- [ ] **Step 3: Datei und Changelog schreiben**

`docs/anmeldung-teil2-texte.md`: Kopf (Zweck „zur Freigabe durch den Owner“, Stand, Plan und Entwurf), die Abschnitte T1–T5 dieses Plans wie umgesetzt (bei Abweichung im Code gilt der Code, und die Abweichung steht in einer Spalte „Hinweis“), dazu ein Abschnitt „Handbuch“ mit den geänderten Zeilen aus Task 17 (alt → neu) und ein Abschnitt „Entfällt“. Am Ende: „Freigabe: ☐ alle Texte wie hier ☐ mit Änderungen (bitte je Nr. notieren)“. `changelog.json`: Einträge `{ "version": "0.19.0", "date": "2026-11-20", "notes": [CL-L1, CL-L2, CL-L3] }` und `{ "version": "0.5.0", "date": "2026-11-20", "notes": [CL-C1 … CL-C5] }`; das Datum stellt N2/N3 auf den Release-Tag.

- [ ] **Step 4: Laufen lassen, Grün sehen**

Run: `node <scratchpad>/pruefe-texte.mjs`
Expected: `ok`, Exit 0.

- [ ] **Step 5: Commit**

```bash
git add docs/anmeldung-teil2-texte.md packages/suite-manifest/changelog.json
git status --short
git commit -m "docs(anmeldung): Texttabelle Teil 2 und Changelog-Entwuerfe Launcher 0.19.0 / Connect 0.5.0 (Texte zur Owner-Freigabe)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 19: Doku, Spec-Nachträge und Roadmap

**Files:**
- Modify: `docs/anmeldung.md:20-22`, `:105`, `:129`, `:131`, `:136`, `:203-204`, `:236-237`, `:245`; neuer Abschnitt „Teil 2: Connect“ am Ende
- Modify: `docs/superpowers/specs/2026-10-17-launcher-anmeldung-design.md` (Nachtrag nach Zeile 28)
- Modify: `docs/superpowers/specs/2026-10-02-zoom-stage4-connect-design.md` (Nachträge nach `:63` und nach der Tabelle `:470-476`)
- Modify: `docs/roadmap.md:280`, `:628`, `:645-648`, `:696`

**Interfaces:**
- Consumes: Messwerte aus `git log`.
- Produces: keine.

- [ ] **Step 1: Stand messen**

Run: `git log origin/main --oneline -1 -- packages/suite-manifest/suite.json` und `git log --oneline -1 -- apps/connect/package.json`
Expected: `df96395472 chore(manifest): connect latestVersion → 0.4.6 [skip ci]` (Connect 0.4.6 im Katalog, released 20.11.) bzw. der Commit aus Task 17. Weicht etwas ab: anhalten und melden (Lehre „Roadmaps nachmessen, nicht lesen“).

- [ ] **Step 2: `docs/anmeldung.md` nachziehen**

`:20-22`: Teil 2 ist mit Launcher 0.19.0 und Connect 0.5.0 gebaut; `:105`: „Zoom-Freigabe und Cloud-Raum wirken in Connect ab 0.5.0“; `:129`, `:131`: „(Teil 2)“ entfällt; `:136`: Reihenfolge `/qa/*`, `/connect/*`, `/zoom-sdk`, `/zoom/jwt`, `/konto/*`, …; `:203-204`: die drei Zwecke mit Zielen und JM-Prüfung; `:236-237`: `connect-relay.js` prüft über `zugangPruefen`, `ALTKEY_CONNECT_BIS` wird nach dem Release gesetzt; `:245`: Connect hält keinen Key mehr. Neuer Abschnitt: Zwecke und Ziele, Raum-Bindung (E3), `POST /zoom/jwt` (E4, E5), Connect-Module (`zugang/regeln.ts`, `zugang/halter.ts`, `zugang/huelle.ts`, `zoom/jwt-quelle.ts`, `raum-id.ts`), Übergang und OT9, Entwicklungsvariablen (`JMPS_PROXY_KEY`, `ZOOM_SDK_CLIENT_*`, `JMPS_ZOOM_SDK_KEY`, `JMPS_ZOOM_JWT_TTL_S`), Tests je Datei.

- [ ] **Step 3: Spec-Nachträge als datierte Notizen (alter Text bleibt stehen)**

Nach Zeile 28 der Haupt-Spec:

```markdown
  > **Nachtrag 20.11.2026 (Anmeldung Teil 2, N1):** Seit Connect 0.4.2 (#290, Owner-Entscheid 11.11.2026) merkt sich Connect das letzte Meeting: die Nummer im Klartext, den Kenncode mit safeStorage. Das sind Meeting-, keine Dienst-Geheimnisse; Teil 2 lässt sie unangetastet, und der Nachweis „kein dauerhaftes Geheimnis“ (Abschnitt 12) prüft `proxyKeyEnc`, `zoomZugangEnc` und `zoomSdkKeyEnc`. Der Wortlaut „nie gespeichert“ oben gilt seitdem nicht mehr.
```

Stage-4-Spec nach `:63` derselbe Nachtrag kurz („… gilt seit #290 nicht mehr; siehe Haupt-Spec der Anmeldung, Nachtrag zu Zeile 28“); nach der Tabelle 5.7: „Nachtrag 20.11.2026: Spalte Platte für Nummer und Kenncode seit #290 „ja (Nummer Klartext, Kenncode verschlüsselt)“; Spalte Cloud bleibt „nein“. Client-ID und Secret liegen seit Anmeldung Teil 2 nur beim Worker (E7 aufgehoben, Haupt-Spec 110); das JWT kommt vom Worker.“

- [ ] **Step 4: Roadmap**

`:280` Teil 2: „🟡 Entwurf freigegeben 20.11. (`docs/superpowers/specs/2026-11-20-anmeldung-teil2-design.md`), Plan `docs/superpowers/plans/2026-11-20-anmeldung-teil2.md`, in Umsetzung auf `feat/anmeldung-teil2`; Releases Worker → Launcher 0.19.0 → Connect 0.5.0 mit Owner-OK“. `:628` Block 2: „✅ released 20.11.“ (Stand des Owners). `:645-646` Connect 0.4.6: „✅ released 20.11. (Katalog `df96395472`)“. `:647-648`: „Nachmessung gegen 0.4.6 erledigt (20.11.)“. `:696`: Block 2 erledigt, Teil 2 läuft.

- [ ] **Step 5: Prüfen und committen**

Run: `git diff --stat` (nur die vier Dateien) und `node -e "const t=require('fs').readFileSync('docs/superpowers/specs/2026-10-17-launcher-anmeldung-design.md','utf8');process.exit(t.includes('nie gespeichert')&&t.includes('Nachtrag 20.11.2026 (Anmeldung Teil 2, N1)')?0:1)"`
Expected: Exit 0 (alter Text und Nachtrag stehen beide da).

```bash
git add docs/anmeldung.md docs/superpowers/specs/2026-10-17-launcher-anmeldung-design.md docs/superpowers/specs/2026-10-02-zoom-stage4-connect-design.md docs/roadmap.md
git status --short
git commit -m "docs(anmeldung): Teil 2 in Entwicklerdoku, Nachtraege zu #290 in den Specs, Roadmap (Block 2 und Connect 0.4.6 released)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 20: Abnahme-Datei für den Owner

**Files:**
- Create: `apps/connect/ABNAHME-0.5.0.md`

**Interfaces:**
- Consumes: Texte (Task 18), Entwurf „Abnahme“ 2.
- Produces: keine.

- [ ] **Step 1: Abnahme-Datei schreiben**

Aufbau wie `apps/launcher/ABNAHME-anmeldung.md:1-20` (Voraussetzungen, Rechner, Schritte mit erwartetem Text, Ankreuzfeld). Voraussetzungen: Worker nach N1 mit `ZOOM_CLIENT_ID`/`ZOOM_CLIENT_SECRET`, `ALTKEY_CONNECT_BIS` leer; Launcher 0.19.0 und Connect 0.5.0 als Abnahme-Bau; Rechner A (JM-Rechner, Windows, Kollege), Rechner B (Windows ohne JM-Markierung, Externer mit Connect-Werkzeug und Zoom-Freigabe, und einmal Kollege), Rechner C (Mac), Rechner D (Connect 0.4.6 mit altem Proxy-Key, SDK-Schlüssel, Zugangsdaten). Schritte mindestens:
1. A: Launcher anmelden, Connect starten → Zeile „Zoom-Anmeldung“ ZA4; Beitritt in ein Testmeeting über das Server-JWT → im Meeting; Zeile ZA1; Hinweis ZA5, wenn vorher alte Zugangsdaten da waren; `connect-settings.json` ohne `zoomZugangEnc`, mit `zoomLetzteNummer`.
2. A: **M4** — Launcher angemeldet lassen; in einer Eingabeaufforderung `set JMPS_ZOOM_JWT_TTL_S=1860` (keine Zugangsdaten, kein Secret auf dem Rechner; der Worker stellt das kurze JWT aus, E9), Connect aus dieser Eingabeaufforderung starten (Zeile ZA1 mit ZA11); beitreten und das Meeting 40 Minuten halten (über das Ende des JWT nach 31 Minuten hinaus); erwartet und zu notieren: bleibt das Meeting stehen, kommen Bild und Ton weiter, was steht im Log um Minute 31. Danach Variablen schließen (Fenster zu), Ergebnis in diese Datei.
3. A: Connect neu starten bei geschlossenem Launcher → Beitritt gelingt mit gehaltener Freigabe (CL-C2).
4. A: „Zoom-SDK laden“ → lädt; Hinweis ZA6, wenn ein alter SDK-Schlüssel da war.
5. B (Externer, Nicht-JM): „Zoom-SDK laden“ → CG8 wörtlich, SDK-Ordner wählen geht; Zoom-Beitritt → CG7b (kein JM-Rechner, Externer); als Kollege auf B: Zoom-Beitritt geht (OF1), „Zoom-SDK laden“ → CG8.
6. C (Mac): Cloud-Raum öffnen → CZ1, Gast-Link funktioniert; keine Zoom-Karte.
7. A und B: Raum einer Show mit kurzem Namen („Show“) öffnen → Raum-ID `show-…`; B öffnet denselben Raum → CZ8; A „Raum schließen“, B öffnet → geht (E3).
8. D: Connect 0.4.6 öffnet einen Raum mit altem Key, lädt das SDK mit altem SDK-Schlüssel und tritt mit alten Zugangsdaten bei → alles wie bisher; im Launcher-Reiter „Geräte“ erscheint eine Zeile „Connect (Cloud-Raum, Zoom-SDK)“ und M44b „ohne Enddatum“.
9. A mit Launcher 0.18.0 (optional): Connect 0.5.0 zeigt CG3 und nutzt vorhandene alte Werte.
10. Konto-Dialog im Launcher: „An Tools ausgegeben“ nennt „Connect Cloud-Raum“, „Zoom-Anmeldung“, „Zoom-SDK laden“; Z5/Z6/Z7/Z9b in der neuen Fassung.

- [ ] **Step 2: Prüfen**

Run: `node -e "const t=require('fs').readFileSync('apps/connect/ABNAHME-0.5.0.md','utf8');const m=['M4','JMPS_ZOOM_JWT_TTL_S=1860','CG8','CZ8','M44b','Connect 0.4.6'];const f=m.filter(x=>!t.includes(x));console.log(f.join(',')||'ok');process.exit(f.length?1:0)"`
Expected: `ok`, Exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/connect/ABNAHME-0.5.0.md
git status --short
git commit -m "docs(connect): Abnahme Connect 0.5.0 / Launcher 0.19.0 mit M4 (Anmeldung Teil 2)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 21: Gesamtprüfung (ohne Commit)

**Files:** keine Änderung.

**Interfaces:** Consumes: alles.

- [ ] **Step 1: Alle Worker-Läufe**

Run: je Datei `node --experimental-strip-types services/release-proxy/test/<datei>.test.mjs` für `worker`, `konto-kern`, `konto-krypto`, `konto-do`, `konto-zugang`, `konto-routen`, `qa-relay`, `connect-zugang`, `zoom-jwt`, `connect-do`; dann `node services/release-proxy/tools/bauprobe.mjs`
Expected: je `‹n› passed, 0 failed`; Bauprobe Exit 0, neun Drosseln, „ALTKEY_CONNECT_BIS nicht gesetzt (unbefristet)“, 0 Warnungen.

- [ ] **Step 2: Launcher, Connect, Kochbuch, Typprüfung**

Run: `npm run selftest:konto -w @jm/launcher`, `npm run selftest -w @jm/launcher`, `npm run selftest -w @jm/connect`, `npm run selftest -w @jm/qa`, `npm run selftest -w @jm/app-runtime`, `npm run cookbook:check`, `npm run typecheck --workspaces --if-present`
Expected: alle Summenzeilen ohne Fehlschlag (`0 fehlgeschlagen`, `0 failed`, `ALLE TESTS OK`); „cookbook.json ist frisch“; 0 `error TS`.

- [ ] **Step 3: Geheimnis- und Grenz-Wächter**

Run: `git diff df96395472 --stat -- packages/app-runtime apps/qa packages/zoom-bridge` und `git grep -n "ZOOM_SDK_CLIENT\|ZOOM_CLIENT_SECRET\s*=\s*\"" -- services/release-proxy/wrangler.toml` und `git log df96395472..HEAD --format=%B | grep -c "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`
Expected: leere Ausgabe für die ersten beiden Befehle; die Zahl gleich der Zahl der Commits seit `df96395472` ohne den Entwurfs-Commit.

---

## Nach der Umsetzung (nur Controller und Owner; nicht Teil der Aufgaben)

- **N1 Worker-Deploy (Owner-OK):** Trockenlauf und Bauprobe, ungemergte Proxy-Commits prüfen; der Owner bzw. Controller setzt `ZOOM_CLIENT_ID` und `ZOOM_CLIENT_SECRET` (Werte nie im Chat, nie im Repo; vorher prüfen, dass kein Leerraum am Rand steht); Deploy von `feat/anmeldung-teil2` oder nach Merge von `main`; `ALTKEY_CONNECT_BIS` bleibt leer. Danach Connect 0.4.6 kurz gegenprüfen (Raum, SDK, Zoom).
- **N2 Launcher 0.19.0 releasen** (nach Freigabe der Texttabelle; `main` vor den Tags pushen, Tags einzeln; Datum in `changelog.json` auf den Release-Tag).
- **N3 Connect 0.5.0 releasen** nach der Owner-Abnahme `apps/connect/ABNAHME-0.5.0.md` einschließlich M4 (Pre-Release, dann Merge; Tags einzeln).
- **N4 Stichtag setzen:** `ALTKEY_CONNECT_BIS` = Release-Datum Connect 0.5.0 + 30 Tage in `wrangler.toml`; Bauprobe zeigt das Datum lesbar; Deploy mit Owner-OK. Der Reiter „Geräte“ zeigt danach M44b mit Datum und die Zählung der Gruppe `connect`.
- **N5 Am Stichtag (je mit Owner-OK):** vorher klären, ob Zoom das Neu-Erzeugen des Client-Secrets der Meeting-SDK-App erlaubt; dann Secret rotieren, Worker-Secret `ZOOM_CLIENT_SECRET` tauschen, Zugangsdaten-Dateien in der JM-Ablage löschen, Worker-Secrets `PROXY_KEY` und `ZOOM_SDK_KEY` löschen.
- **N6 Folge-Release Connect** (optional, nach N5): Übergangszeilen und alten Weg entfernen.
- **N7 Roadmap** nach jedem Release nachmessen und nachziehen; Merge-Reihenfolge `main` vor Tags.

---

## Selbstprüfung des Plans

**Abdeckung Entwurf:**

| Entwurf | Aufgabe |
| --- | --- |
| Zwecke, Ziele, 72 h; JM-Prüfung `zoom-sdk` auf beiden Seiten | 1, 8 |
| `connect-raum` über `zugangPruefen`, Bindung `connect-inhaber` (OT7) | 2, 3 |
| Zeitkonstanter Vergleich des alten Keys (R1) | 3 |
| `/zoom-sdk` mit Freigabe oder `ZOOM_SDK_KEY` bis zum Stichtag | 4 |
| Zoom-JWT HS256, `iat` − 30 s, 12 h, byte-gleich | 5 |
| `POST /zoom/jwt`, Drossel, DO-Protokoll nur Konto/Rechner/Zeit, keine Geheimnisse im Log | 2, 6 |
| Secrets `ZOOM_CLIENT_ID`/`ZOOM_CLIENT_SECRET`, Namensfalle | 6, 7 |
| Alt-Key-Zählung `connect`, Reiter „Geräte“ | 2, 9 |
| `ALTKEY_CONNECT_BIS` leer, Wächter vorbereitet | 7, N4 |
| Reihenfolge Worker → Launcher 0.19.0 → Connect 0.5.0 | Aufbau, N1–N3 |
| Launcher 0.18.0 → „Launcher aktualisieren“, Übergang mit alten Werten | 10, 11, 12, 13, 14 |
| Kein Rückfall nach dem Übergang, Umgebung nur Diagnose (OT8) | 10, 11, 14 |
| JWT nur im RAM, vor dem Spawn, Erneuern unter 2 h | 14, 15 |
| Neue Zustände statt `zugang_fehlt`, Laufzeitfehler in der Startfolge (➕1 e) | 15 |
| `geheimnisse()` maskiert Freigaben | 15 |
| OT9 mit Ausnahme N1, Hinweis wie Q6b | 11, 13, 15, 10 (Texte) |
| N2 Text bei „Zoom-SDK laden“ | 8, 10, 13 |
| N4 kurze Raum-IDs | 12 |
| Texte Z5/Z6/Z7/Z9b/R1, Z11 und M48 raus, K29d, M44/M46 | 9 |
| Eine Texttabelle zur Owner-Freigabe | Texttabelle, 18 |
| Abnahme 1 (Selbsttests, Kreuzprodukt, Wiederbeitritt, Neustart, Nachweis) | 1–17, 21 |
| Abnahme 2 (Owner, M4) | 20 |
| Nicht im Plan: Stichtag setzen, Rotation, alte Secrets löschen | N4, N5 |

**Abdeckung Haupt-Spec (Teil-2-Zeilen):** 13/22 (12, 13, 16), 28 (19), 32–34 (Global Constraints, 14, 15), 40–43 (12, 13, 14, 15, 16), 50 (10, 14), 85–89 (1, 8), 95–98 (unverändert in Teil 1; Connect übernimmt den Stand über die Freigabe, 11), 103 (11), 107–110 (5, 6, 14), 130–132 (9), 139–140 (3, 4, 6, 7), 155–156 (1), 166–168 (11, 16, 9, 17), 173 (4), 174/184 (10, 11, 15, 16), 198 (6, 7).

**Typen über Aufgaben:** `zweckDarf` (Task 1 Worker, Task 8 Launcher) gleich benannt und gleich typisiert; `ConnectZweck`, `ZugangsWahl`, `ZugangsLage`, `JwtGrund`, `ZoomAnmeldungLage` nur in `regeln.ts` (Task 10) definiert und von 11–16 benutzt; `ZugangsHalter` (Task 11) mit `zugang`, `antwort`, `bestaetigt`, `lage`, `tokens` – Task 12 nutzt `zugang/antwort/lage`, Task 13 (Kern) `zugang/antwort/bestaetigt/lage/tokens`, Task 14 `zugang/antwort/lage`; `ZUGANG_TEXT`-Schlüssel (Task 10) `raumNicht`, `raumVergeben`, `raumFreigabeAbgelehnt` (Task 12), `sdkGeloescht` (Task 13), `zugangGeloescht`, `ohneAnmeldung` (Task 15); `JwtQuelle` (Task 14) mit `hole/angemeldet/lage/geheimnisse/stoppe` – Task 15 nutzt alle außer `stoppe` (Hülle beim Beenden); Worker-Antwort `{ jwt, exp, gueltigS }` (Task 6) = Erwartung von `holeServerJwt` (Task 14).

**Offene Punkte für den Owner**

Beide am 20.11.2026 20:21 vom Owner entschieden („alles mit deiner Empfehlung“):

1. **M4 (E9):** ~~mit lokalen Zugangsdaten~~ → **über den Worker**: `POST /zoom/jwt` nimmt optional `ttlS` 1800–43 200; Connect schickt `JMPS_ZOOM_JWT_TTL_S` mit. Kein Secret auf dem Rechner, M4 geht auch nach der Rotation (Task 6, 10, 14, 20 angepasst).
2. **Raum-Bindung endet mit „Raum schließen“ (E3):** so, wie der Plan es vorsieht.
