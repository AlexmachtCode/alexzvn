# Zoom Stage 4: Die Zoom-Bridge in JM Connect (connect-v0.2.0)

**Datum:** 02.10.2026 · **Status:** Entwurf
**Bezug:** Issue #197, Stufe 4 von 4. Roadmap-Zeile `docs/roadmap.md:154` („4 · Integration + Release“).
**Vorgänger:** Stage 1–3 der Bridge (`packages/zoom-bridge`), zuletzt Stage 3 „Ton je Teilnehmer“ (PR #229, gemergt als `b666e5c5f4`).
**Arbeitsstand:** Branch `feat/zoom-stage4-connect` = `main` @ `b666e5c5f4`. Alle Fundstellen in diesem Spec sind an diesem Stand nachgelesen.
**Grundlagen:** drei Ist-Karten (Connect, Bridge, Auslieferung) und ihre Kritik vom 02.10.2026, Besprechung mit dem Owner am selben Tag.

**Ziel in einem Satz:** Der Bediener tritt aus JM Connect heraus einem Zoom-Meeting bei und lädt einzelne Teilnehmer als NDI-Quelle, ohne Konsole, ohne Einsatzpaket und ohne dass Zoom-Dateien im Installer stecken.

Kurz erklärt, für alle, die nicht in Stage 1–3 dabei waren:
- **Zoom-Bridge** (`zoom-bridge.exe`): unser eigenes C++-Programm. Es tritt mit dem Zoom-Meeting-SDK einem Meeting bei und macht je abonniertem Teilnehmer eine NDI-Quelle auf. Gesteuert wird es über JSON-Zeilen auf stdin und stdout.
- **NDI**: Videoprotokoll im lokalen Netz. Der JM Switcher findet NDI-Quellen von selbst.
- **SDK** (Software Development Kit): hier das Zoom-Meeting-SDK für Windows, Fassung 7.1.5.43953. Es besteht aus 153 Dateien (DLLs, Hilfsprogramme, Sprachdateien).
- **Abo**: ein Teilnehmer, den die Bridge als NDI-Quelle sendet (Befehl `videoSubscribe`).

---

## 0 · Ergänzungen gegenüber der Besprechung (bitte bewusst prüfen)

Beim Ausarbeiten kamen Stellen heraus, die die Besprechung nicht abdeckte oder an denen der Code etwas anderes verlangt. Nur dort ergänzt oder präzisiert dieser Spec.

| # | Besprochen | Jetzt | Warum |
| --- | --- | --- | --- |
| 1 | E6: SDK-Ordner und VC-Laufzeit in einen eigenen Ordner kopieren | In den Laufzeit-Ordner kommen **auch** `zoom-bridge.exe` und die NDI-DLL. Connect startet die Bridge von dort (5.3). | Nur so entsteht genau das gemessene Layout des Komplett-Pakets: Bridge, NDI, VC-Laufzeit und alle Zoom-Dateien in **einem** Ordner (`packages/zoom-bridge/README.md:913-920`, Messung „lädt MSVCP140 aus dem eigenen bin“ `:1071-1072`). Der Windows-Lader findet dann alles im Ordner der EXE, ohne PATH-Tricks. |
| 2 | „eigener Ordner“ | Ort: `%LOCALAPPDATA%\JM Connect\zoom-laufzeit\7.1.5.43953\` | `userData` liegt unter `%APPDATA%` (Roaming). 315 MB gehören nicht in ein servergespiegeltes Profil. Der Installationsordner fällt aus, weil ein Update ihn ersetzt. |
| 3 | Roadmap: „`zoom_*`-Verben zweigen in `App.tsx` vor dem DO-Mapping ab“ (`docs/roadmap.md:29`) | Die Verben zweigen im **Main** ab (`index.ts`, vor dem Weiterreichen an den Renderer). | Die Bridge lebt im Main (E4). Ein Umweg über den Renderer brächte nichts und hinge an einem Fenster. |
| 4 | E8: Variablen „Status, Quellen, Aufnahme-Erlaubnis“ plus Feedback | Zusätzlich zwei Schalter-Variablen `zoom_live` und `zoom_alarm` (je 1/0). Feedbacks hängen nur an diesen. | Companion wertet `truthy` nur bei `'1'`, `'an'` oder `'true'` aus (`packages/companion-jm-suite/lib.mjs:55-57`), `equalsArg` nur als Zahl (`main.js:130-131`). Eine Anzahl wie `2` oder ein Text wie `warteraum` lässt sich so nicht als Feedback nutzen. |
| 5 | Laden per Anzeigename | Mehrwortige Namen gehen: Connect setzt die Argumente mit einem Leerzeichen wieder zusammen. STATE führt **keine** Namen. | Das Steuerprotokoll trennt Befehle und STATE-Werte an jedem Leerraum (`packages/suite-control-protocol/src/index.ts:72`, `:115`). |
| 6 | – | Knopf **„Einrichtung prüfen“**: Bridge starten, bei Zoom anmelden, wieder beenden, ohne Meeting. | So lässt sich ein Raum-PC vor der Show prüfen (DLLs, VC-Laufzeit, Zugangsdaten, SDK-Fassung). Der Ablauf existiert schon als „Nur-Anmelden“ im Einsatzpaket. |
| 7 | – | Das Anmelde-Token (JWT) gilt 12 h statt 1 h. | Ob ein abgelaufenes Token ein laufendes Meeting stört, ist ungemessen (M4). Zoom erlaubt bis zu zwei Tage (`packages/zoom-bridge/src/jwt.ts:19`). Das Token verlässt den PC nie. |
| 8 | Tray zählt Zoom-Quellen | Das Tray-Menü bekommt **zwei** Statuszeilen (Gäste, Zoom). Der Gäste-Text wird dabei berichtigt. | Heute steht dort „● N Gast/Gäste auf Sendung“ (`apps/connect/src/main/tray.ts:60`). Gezählt werden aber NDI-Sender (`ndi-guests.ts:107-109`), also auch Bildschirm-Quellen und freigegebene Gäste, die nicht auf Sendung sind. |
| 9 | E5: Quellen nach Wiederbeitritt automatisch neu abonnieren | Eine **Soll-Liste** gilt immer. Connect abonniert nur Einträge **ohne** bestehendes Abo, und zwar 300 ms nach jeder Teilnehmeränderung. | Kommt ein einzelner Teilnehmer zurück, hängt die Bridge sein Abo selbst um (`reboundByName`). Würde Connect parallel abonnieren, entstünde eine zweite Quelle „… (2)“. Dieselbe Wartezeit von 300 ms nutzt die Konsolen-Steuerung (`cli/steuerung.mjs:189`). |
| 10 | E5: Abriss → automatischer Wiederbeitritt | Automatisch nur, wenn Connect in dieser Sitzung schon **im Meeting war**. Scheitert der erste Beitritt, entscheidet der Bediener. | Beim ersten Beitritt sitzt der Bediener vor dem Fenster. Fünf stille Versuche gegen einen falschen Kenncode wären Zeitverlust. |
| 11 | E8: Companion-Modul ausliefern | Als zweite Datei `jm-suite-companion-0.2.0.tgz` im Release `connect-v0.2.0`. | Es gibt keinen eigenen Release-Weg für das Modul (`packages/companion-jm-suite/README.md`, Abschnitt „Bauen / Testen“). Der Launcher übersieht die Datei, weil er nur `.exe`/`.dmg` nimmt (`apps/launcher/src/main/release-source.ts:123`). |
| 12 | – | Die Neu-Generierung bringt die fehlende Connect-Aktion `slides` mit ins Companion-Modul. Eine CI-Prüfung verhindert, dass Modul und Capabilities wieder auseinanderlaufen. | `generated/protocol.mjs` ist seit 02.07.2026 nicht neu erzeugt, `capabilities.ts` hat sich am 09.07. geändert. Die Aktion `slides` fehlt im Modul (`grep slides` = 0). |
| 13 | – | Der Rundown bekommt die Zoom-Aktionen erst mit seinem nächsten regulären Release. | Er bündelt die Capabilities zur Bauzeit (`apps/rundown/src/renderer/src/components/RowEditor.tsx`). Ein eigener Rundown-Release gehört nicht zu Stage 4. |
| 14 | – | Der native Teil der Bridge (C++) ändert sich in Stage 4 **nicht**. Geändert werden nur TypeScript, Skripte und die Attrappe. | Alle Fähigkeiten sind seit Stage 3 da. Ein unveränderter nativer Teil hält die Abnahmen von Stage 1–3 gültig. |

---

## 1 · Ziel und Nicht-Ziele

### Ziel

1. **Einrichtung einmal je Raum-PC:** SDK-Ordner wählen und Zugangsdaten-Datei wählen. Connect prüft beides hart und meldet Fehler in Klartext.
2. **Bedienung aus Connect:** Meeting-Nummer, Kenncode und Anzeigename eingeben, beitreten. Connect zeigt Status und Teilnehmerliste. Je Person gibt es „Als Quelle laden“ und „Entladen“.
3. **Robust im Betrieb:** Nach einem Verbindungsabriss tritt Connect selbst wieder bei und lädt die Quellen wieder. Beim Beenden verlässt Connect das Meeting sauber.
4. **Ehrlicher Status:** Tray, Kopfzeile, Zoom-Karte und Fernsteuerung sagen in jedem Zustand die Wahrheit (Abschnitt 7).
5. **Minimale Fernsteuerung** per Companion: Status lesen, Quellen per Anzeigename laden und entladen, Versatz setzen.
6. **Auslieferung** als `connect-v0.2.0` für Windows, ohne eine einzige Zoom-Datei im Installer.

### Nicht-Ziele

- **Kein Zoom unter macOS.** Die Bridge ist Windows-only (`packages/zoom-bridge/CMakeLists.txt:7-9`). Connect blendet den Zoom-Bereich dort aus.
- **Keine Zoom-DLLs im Installer**, kein Download, keine Installer-Variante (E2).
- **Keine Meetings fremder Zoom-Konten**, kein OBF- oder ZAK-Token, keine Nutzer-Anmeldung per OAuth (E3).
- **Kein Speichern von Meeting-Nummer oder Kenncode**, auch nicht in der `.jmshow`.
- **Kein Tally, kein Talkback/IFB, kein Mix-Minus je Zoom-Person.** Das sind Grenzen von Zoom (`docs/roadmap.md:156-159`).
- **Keine Vorschau** der Zoom-Bilder in Connect. Die Bilder erreichen JavaScript nie (`docs/roadmap.md:23`). Das Bild sieht man im NDI-Monitor oder im Switcher.
- **Kein Beitritt per Fernsteuerung** (E8).
- **Kein Mischton, kein Bildschirmton, kein Dolmetscherton**, kein Ton zurück nach Zoom (Stage-3-Grenzen, `docs/superpowers/specs/2026-08-14-zoom-stage3-audio-ndi-design.md`, Abschnitt 10).
- **Keine Änderung am C++-Teil** der Bridge (Ergänzung 0.14).
- **Kein eigener Katalog-Eintrag** für die Bridge. Das Einzelpaket `zoom-bridge-v0.1.0` bleibt als Notfallweg (F5).
- **Keine Signatur** der EXE-Dateien.
- **Keine Behebung der Altfehler** aus 17.2, außer dem Tray-Text (Ergänzung 0.8) und dem veralteten Companion-Protokoll (Ergänzung 0.12).

---

## 2 · Owner-Entscheidungen und Festlegungen

### 2.1 Owner-Entscheidungen (alle vom 02.10.2026, verbindlich)

| # | Entscheidung |
| --- | --- |
| E1 | **Stage 4 jetzt**, parallel zu Master-Link Teil 2b. Das hebt die Entscheidung vom 30.09.2026 „Master-Link vor Stage 4“ auf. |
| E2 | **Zoom-DLLs werden nicht verteilt.** Der Bediener wählt einmal je Raum-PC den SDK-Ordner aus der internen JM-Ablage. Die Lizenzfrage blockiert Stage 4 damit nicht. Das ersetzt den „Lizenz-Entscheid: DLLs nachladen vs. separate Installer-Variante“ aus `docs/roadmap.md:154`. |
| E3 | **Meetings laufen immer im eigenen Zoom-Konto**, also im Konto der Meeting-SDK-App. Grund: Zoom verlangt seit 02.03.2026 für Meetings fremder Konten zusätzlich ein OBF-Token. Laut Zoom-FAQ (https://developers.zoom.us/docs/meeting-sdk/obf-faq/, abgerufen am 02.10.2026) braucht ein Beitritt außerhalb des App-Kontos „JWT + OBF token“, innerhalb nur „JWT“. Das ist eine harte Grenze im Handbuch, und Connect meldet sie in Klartext (Fehlercodes 63, 64, 503, 504, Abschnitt 8.3). |
| E4 | **Einbau in JM Connect**, kein eigenes Tool. Die Bridge läuft im Main-Prozess. Der Zoom-Bereich ist unabhängig vom Cloud-Raum: Er funktioniert ohne Proxy und ohne offenen Raum. Release `connect-v0.2.0`, nur Windows; unter macOS ist Zoom ausgeblendet. |
| E5 | **Abriss:** automatischer Wiederbeitritt mit neuem Bridge-Prozess, begrenzten Versuchen und dem Kenncode nur im Arbeitsspeicher. Quellen mit eindeutigem Namen abonniert Connect automatisch neu. Doppelte Namen markiert es rot. Leitsatz: „lieber ein Handgriff als die falsche Person“. |
| E6 | **SDK-Ordner:** harte Prüfung auf Fassung 7.1.5.43953. Connect kopiert `x64\bin` **einmal** zusammen mit der VC-Laufzeit in einen eigenen Ordner, im gemessenen Layout des Einsatzpakets. So finden auch Zooms Hilfsprogramme die VC-Laufzeit. Eine neue SDK-Fassung heißt: neuer Connect-Release. |
| E7 | **Zugangsdaten (Client-ID und Client-Secret):** Der Bediener wählt die Zugangsdaten-Datei einmal. Connect speichert den Inhalt dauerhaft, mit `safeStorage` verschlüsselt (Muster Proxy-Key). Die Daten gehen nie an Worker oder Cloud. |
| E8 | **Fernsteuerung minimal:** Status-Variablen (Status, Quellen, Aufnahme-Erlaubnis) plus Feedback, Aktionen Laden und Entladen per Anzeigename, Versatz. **Kein Beitritt per Companion.** Das Companion-Modul wird neu generiert und ausgeliefert. |
| E9 | **PR #229 ist gemergt** (`b666e5c5f4`). Stage 4 baut auf `main`. |

### 2.2 Festlegungen (Annahmen aus der Besprechung, vom Owner nicht widersprochen)

| # | Festlegung |
| --- | --- |
| F1 | Meeting-Nummer und Kenncode werden **nie gespeichert**: nicht auf der Platte, nicht in der `.jmshow`, nicht im Log, nicht im STATE. |
| F2 | Der Anzeigename in Zoom ist vorgegeben mit **„JM Connect“** und änderbar. Er wird je PC gespeichert. |
| F3 | Das Versatz-Feld ist in ms, wird je PC gespeichert und steht auf **0**, bis der Messwert aus dem Projekttest vorliegt (M10). |
| F4 | Ab der **6. Quelle** warnt Connect, sperrt aber nicht. Die Betriebsgröße ist 5 (Owner, 14.08.2026). |
| F5 | Das Einzelpaket **`zoom-bridge-v0.1.0` bleibt** als Notfallweg, bis die erste Live-Show mit Connect gelaufen ist. |

---

## 3 · Ausgangslage (nachgemessen an `main` @ `b666e5c5f4`)

### 3.1 Connect heute

| # | Tatsache | Fundstelle |
| --- | --- | --- |
| 1 | Connect enthält keine Zeile Zoom. | `git grep -i zoom -- apps/connect` = leer |
| 2 | Die ganze Gäste-Oberfläche hängt hinter `connected` (Raum-WebSocket offen). Ohne Proxy ist „Raum öffnen“ gesperrt. | `apps/connect/src/renderer/src/App.tsx:256-359`, `:259` |
| 3 | Fenster schließen versteckt nur ins Tray. | `apps/connect/src/main/index.ts:51-56`, `:119-122` |
| 4 | `before-quit` ist synchron. | `apps/connect/src/main/index.ts:124-132` |
| 5 | Steuerbefehle (Port 8737) gehen ungeprüft an den Renderer. | `index.ts:97-99`, `control-server.ts:36-38` |
| 6 | Ein STATE-Push **ersetzt** alle Werte. Absender ist allein der Renderer. | `control-server.ts:51-53`, `App.tsx:68-81` |
| 7 | Tray und Tooltip zählen nur `ndiSenders` (Gast-Sender inklusive Bildschirm). | `tray.ts:59-63`, `:71`, `:76`; `ipc.ts:34`; `ndi-guests.ts:107-109` |
| 8 | Kopfzeile rechts: „● Raum verbunden“ bzw. „○ nicht verbunden“. | `App.tsx:244-247` |
| 9 | Einstellungen in `userData/connect-settings.json`, Datei mit Modus `0o600`, Geheimes per `safeStorage`, ohne Schlüsselbund nur für die Sitzung. | `settings.ts:21-25`, `:45-53`, `:110-123` |
| 10 | Gebündelt werden nur Pakete aus `internalPackages`. `@jm/zoom-bridge` fehlt dort und in den `dependencies`. Main ist CommonJS. | `electron.vite.config.ts:10-18`, `:35-38`; `package.json:24-36` |
| 11 | `tsconfig.node.json` hat kein `allowImportingTsExtensions`. Die Bridge braucht es (Importe mit `.ts`-Endung). | `apps/connect/tsconfig.node.json`; `packages/zoom-bridge/src/index.ts:3-17` |
| 12 | `extraResources` packt `resources/**` **ungefiltert** in den Installer. `resources/bin/` ist gitignored. | `electron-builder.yml:14-18`; `apps/connect/.gitignore` |
| 13 | `dist:dir` ruft kein `prepackage`. | `apps/connect/package.json:20` |
| 14 | Connect hat keine Tests und kein `selftest`-Skript. | `apps/connect/package.json:9-23` |
| 15 | Ein Browser-Gast heißt in NDI „JM Connect – <Anzeigename>“, gefiltert auf Buchstaben, Ziffern, Leerzeichen, `_` und `-`, höchstens 40 Zeichen. | `packages/rtc/src/state.ts:212-215` |

### 3.2 Bridge heute

| # | Tatsache | Fundstelle |
| --- | --- | --- |
| 1 | Öffentliche Fläche: `Bridge`, `buildJwt`, `readCredentials`, Zustandsfunktionen, Typen. Exportiert als `.ts`-Quellen. | `packages/zoom-bridge/src/index.ts:3-17`, `package.json:7-12` |
| 2 | `binPath()` rechnet relativ zur Quelldatei. Im gebündelten Connect zeigt es ins Leere. `exePath` muss gesetzt sein. | `src/bridge.ts:46-51` |
| 3 | `start()` mischt `process.env` mit `opts.env`, entfernt danach `envRemove` und setzt zuletzt die NDI-Laufzeit vorn auf `PATH`. | `src/bridge.ts:116-124` |
| 4 | `withNdiRuntimeOnPath` liest `env.PATH`. Heißt der geerbte Schlüssel `Path`, bekommt das Kind nur den NDI-Ordner als `PATH`. | `src/ndi-path.ts:69-81` |
| 5 | Eine `Bridge` setzt ihre Sitzung nie zurück. Ein zweiter `start()` nach Prozessende erbte alte Abos und Teilnehmer. | `src/bridge.ts:57`, `:377`, `:461` |
| 6 | `stop()` schickt `quit`, wartet bis `killTimeoutMs` (Vorgabe 8000) und tötet dann. Gegen doppelten Aufruf geschützt. | `src/bridge.ts:411-463` |
| 7 | Der Beitritts-Wachhund (Vorgabe 30 s) wartet auf einen **ruhenden** Zustand. Ein `reconnecting` stellt ihn neu scharf (`reconnectTimeout`). | `src/bridge.ts:293-324`, `:373-375`; `src/state.ts:102-104` |
| 8 | `phase:'error'` ist endgültig für **jeden** Fehler außer `where:'video'` und `where:'audio'`, also auch für Erlaubnis- oder Befehlsfehler bei laufendem Meeting. | `src/state.ts:223` |
| 9 | Teilnehmer-IDs gelten nur in einer Sitzung. Bei `ended`/`failed` leert der Reducer die Teilnehmer. | `src/protocol.ts:22-33`; `src/state.ts:121` |
| 10 | `FAIL_CODES` kennt nur 1–13 und `0xffff`. Ein Code 63 erschiene als „Fehlerschluessel 63“. | `src/protocol.ts:434-448`, `:462-467` |
| 11 | Das SDK definiert 63 `MEETING_FAIL_UNABLE_TO_JOIN_EXTERNAL_MEETING`, 64 `…BLOCKED_BY_ACCOUNT_ADMIN`, 503 `…USER_LEVEL_TOKEN_NOT_HAVE_HOST_ZAK_OBF`, 504 `…APP_CAN_NOT_ANONYMOUS_JOIN_MEETING`. | SDK `x64\zoom_sdk_c_sharp_wrap\h\meeting_service_interface.h:124`, `:126`, `:140`, `:142` |
| 12 | NDI-Name einer Zoom-Quelle: „JM Connect – Zoom <Anzeigename>“, bei Dopplung „ (2)“. Geprüft wird nur gegen eigene Abos. | `native/video.cpp:188-201` |
| 13 | Die Rohdaten-Erlaubnis fragt die Bridge beim Ankommen selbst an. Einen Befehl für eine neue Anfrage gibt es nicht. Erteilt der Host später, kommt ein `privilege`-Ereignis. | `native/session.cpp:471-495`; `native/callbacks.cpp:247` |
| 14 | Die Attrappe `test/fake-bridge.mjs` (Drehbuch `steuerung`) antwortet auf Befehle wie das Original, mit Stellschrauben für Warteraum, Abriss, Absturz, Wiederbeitritt und DLL-Tod. | `test/fake-bridge.mjs:113-157` |
| 15 | Die Konsolen-Steuerung warnt über 5 Abos, deutet DLL-Rückgabewerte und nimmt die Zugangsdaten aus der Kind-Umgebung. | `cli/steuerung.mjs:72`, `:169-173`, `:352-362` |
| 16 | Wächter gegen Zoom-Dateinamen, VC-Laufzeit-Suche und Frische-Prüfung stecken nur im Einsatzpaket-Bau. | `scripts/build-release.mjs:131-164`, `:178-189`, `:203-270`, `:383-400` |

### 3.3 SDK im JM-Bestand (gemessen am 02.10.2026)

- `sdk.dll` trägt die Dateifassung **7.1.5.43953** (VS_FIXEDFILEINFO, gelesen wie `build-release.mjs:103-110`).
- `x64\bin` enthält **153 Dateien, 329 657 415 Byte**, mit den Unterordnern `language` und `ringtone`.
- Die SDK-Wurzel enthält `version.txt` = `v7.1.5.43953`. Wer direkt `x64\bin` wählt, hat diese Datei nicht. Darum prüft Connect `sdk.dll` selbst.

### 3.4 Fernsteuerung heute

- Rolle `connect`: 9 Aktionen, 9 Variablen, 3 Feedbacks, kein Zoom (`packages/suite-control-protocol/src/capabilities.ts:586-618`).
- Companion-Modul: generierte Kopie `packages/companion-jm-suite/generated/protocol.mjs`, erzeugt von `scripts/sync-companion-protocol.mjs`. Gebaut wird lokal mit `npm run build:local` zu `pkg.tgz`.

---

## 4 · Begriffe

| Begriff | Bedeutung |
| --- | --- |
| **Laufzeit-Ordner** | `%LOCALAPPDATA%\JM Connect\zoom-laufzeit\7.1.5.43953\`. Darin liegen alle Dateien, die `zoom-bridge.exe` zur Laufzeit braucht (5.3). |
| **Eigene Dateien** | Was Connect selbst mitbringt: `zoom-bridge.exe`, die VC-Laufzeit, die NDI-DLL. |
| **VC-Laufzeit** | Die Microsoft-Visual-C++-Laufzeit (`msvcp140.dll`, `vcruntime140.dll` …). Bridge und Zoom-DLLs brauchen sie. Microsoft erlaubt die Weitergabe. |
| **Stempel** | `jm-zoom-laufzeit.json` im Laufzeit-Ordner. Er hält fest, was die Kopie enthält. |
| **Hülle / Kern** | Der Kern (`zoom/kern.ts`) enthält die ganze Zoom-Logik ohne Electron und ist ohne Electron testbar. Die Hülle (`zoom.ts`) verbindet ihn mit IPC, Dialogen, `safeStorage`, Tray und Steuerserver. Muster: Master-Link Teil 2a. |
| **Abbild** | Ein serialisierbarer Schnappschuss des Zoom-Zustands (`ZoomAbbild`). Der Main schickt ihn an den Renderer. |
| **Abriss** | Connect war in dieser Sitzung im Meeting, und die Verbindung ist weg: Zoom verbindet neu, scheitert, oder die Bridge stirbt. Nicht gemeint ist ein Meeting-Ende durch den Host. |
| **Soll-Liste** | Die Quellen, die der Bediener geladen hat, gemerkt über den normierten Namen. Sie überlebt einen Wiederbeitritt, nicht aber „Verlassen“ oder ein Meeting-Ende. |
| **Normierter Name** | Anzeigename nach Unicode-NFC, `trim`, Leerraum zu einem Leerzeichen, klein geschrieben (`de`). |
| **Doppelname** | Zwei oder mehr fremde Teilnehmer haben denselben normierten Namen. |
| **Verwaiste Quelle** | Ein Abo, dessen Teilnehmer gegangen ist (`black`, Grund `participantLeft`). Die Bridge hängt es um, sobald jemand mit eindeutigem Namen zurückkommt. |
| **STATE** | Die Zeile `STATE ns=connect k=v …`, die Connect an Companion und Rundown schickt. |

---

## 5 · Aufbau

### 5.1 Module und Verantwortung

| Datei | Neu/geändert | Aufgabe | Electron? |
| --- | --- | --- | --- |
| `packages/zoom-bridge/src/sdk.ts` | neu, Export `./sdk` | `SDK_FASSUNG = '7.1.5.43953'`, `SDK_FASSUNG_BRIDGE = '7.1.5 (43953)'`, `peInfo(buf)` (Maschinentyp + Dateifassung aus der PE-Datei), `findeSdkBin(gewaehlt, gibtEs)` (Wurzel, `x64` oder `x64\bin`) | nein |
| `packages/zoom-bridge/src/protocol.ts` | geändert | `FAIL_CODES` um 14–16, 23, 60–64, 82, 88, 89, 500–506 ergänzen (Namen wörtlich aus dem SDK-Kopf). Nur Diagnose; die Klartexte liegen in Connect. | nein |
| `packages/zoom-bridge/scripts/auslieferung.mjs` | neu | Aus `build-release.mjs` herausgezogen: `SDK_NAMEN_7_1_5`, `verboteneZoomDateien(ordner, {sdkBin})`, `findeVcLaufzeit()`, `VC_PFLICHT`, `linkerFassung`, `dateiFassung`, `mindestens`, `bridgeExeFrisch(pkgDir)` | nein |
| `packages/zoom-bridge/scripts/build-release.mjs` | geändert | importiert diese Teile statt eigener Kopien. Verhalten unverändert. | nein |
| `packages/zoom-bridge/test/fake-bridge.mjs` | geändert | neue Stellschrauben `FAKE_SDK_FASSUNG` und `FAKE_DOPPELNAME`; Drehbuch `envprobe` meldet zusätzlich den Wert von `PATH` (12.1) | nein |
| `apps/connect/src/main/zoom/laufzeit.ts` | neu | SDK-Ordner prüfen, kopieren, Stempel schreiben, Laufzeit vor jedem Start prüfen, eigene Dateien abgleichen | nein |
| `apps/connect/src/main/zoom/klartext.ts` | neu | alle Klartexte aus Abschnitt 8, Einordnung „endgültig/vorübergehend“ | nein |
| `apps/connect/src/main/zoom/kern.ts` | neu | Zustandsmaschine, Bridge-Lebenslauf, Soll-Liste, Wiederbeitritt, Abbild, STATE-Werte, Fernsteuer-Verben | nein |
| `apps/connect/src/main/zoom.ts` | neu | Hülle: IPC-Handler, Dialoge, Zugangsdaten über `settings.ts`, Pfade, Push an Fenster, Tray und Steuerserver, Beenden | ja |
| `apps/connect/src/main/settings.ts` | geändert | Felder für Zoom (5.6) | ja |
| `apps/connect/src/main/control-server.ts` | geändert | STATE aus zwei Teilen mischen (11.3) | ja |
| `apps/connect/src/main/control-state.ts` | neu | reine Funktion `mischeState(raum, zoom)` | nein |
| `apps/connect/src/main/ndi-guests.ts` | geändert | neuer Export `activeLabels(): string[]` für die Kollisionsprüfung | ja |
| `apps/connect/src/main/ipc.ts` | geändert | `AppStatus.zoom` füllen | ja |
| `apps/connect/src/main/tray.ts` | geändert | zwei Statuszeilen, Eintrag „Zoom-Meeting verlassen“, Tooltip (7.3, 7.4) | ja |
| `apps/connect/src/main/index.ts` | geändert | Zoom starten, `zoom_*`-Verben abfangen, asynchrones Beenden (6.6) | ja |
| `apps/connect/src/shared/types.ts`, `ipc.ts` | geändert | Typen (5.4), Kanäle (5.5) | – |
| `apps/connect/src/shared/zoom-text.ts` | neu | `zoomZeile(kurz)`, `gaesteZeile(status)`, `trayTooltip(status)`: **eine** Quelle für Tray und Kopfzeile | nein |
| `apps/connect/src/preload/index.ts`, `renderer/src/jmconnect.d.ts` | geändert | API-Erweiterung | – |
| `apps/connect/src/renderer/src/zoom/ZoomCard.tsx` | neu | Zoom-Karte (Abschnitt 9) | – |
| `apps/connect/src/renderer/src/App.tsx` | geändert | Karte außerhalb des `connected`-Zweigs einhängen, Kopfzeile (7.2) | – |
| `apps/connect/tools/bundle-zoom-bridge.mjs`, `tools/after-pack.cjs` | neu | Paketierung und Wächter (Abschnitt 10) | nein |
| `packages/suite-control-protocol/src/capabilities.ts` | geändert | Zoom-Aktionen, -Variablen, -Feedbacks (11.1) | nein |

Regel für den Kern: Er importiert nur relative Pfade und `@jm/zoom-bridge`, keine Aliase wie `@shared`, kein `electron`. Typen dürfen per `import type` aus `../../shared/types.ts` kommen. So laufen die Tests mit `tsx` ohne Konfiguration.

`shared/types.ts` importiert aus der Bridge **nur Typen** und nur aus `@jm/zoom-bridge/protocol`. Diese Datei hat selbst keine Importe. Darum braucht `tsconfig.web.json` keine Änderung. `tsconfig.node.json` bekommt `allowImportingTsExtensions: true` (Präzedenz: `apps/interpreter/tsconfig.node.json:18`) und nimmt `test/**/*.ts` mit auf.

`apps/connect/package.json`: `@jm/zoom-bridge` in `dependencies`, `tsx` in `devDependencies`. `electron.vite.config.ts`: `@jm/zoom-bridge` in `internalPackages`.

### 5.2 Prozessmodell

- **Eine neue `Bridge` je Beitritt**, auch je Wiederbeitritts-Versuch und je „Einrichtung prüfen“. Grund: Tatsache 3.2-5. Außerdem bleiben so zwei ungemessene Fälle aus: ein zweites Meeting im selben Prozess (`native/audio.cpp:182-188`) und ein Token-Ablauf in einem langen Prozess.
- Es läuft **höchstens eine** Bridge. Der Kern startet eine neue erst, wenn `stop()` der alten zurückgekehrt ist.
- Aufruf:

```ts
new Bridge({
  exePath: join(laufzeitOrdner, 'zoom-bridge.exe'),
  // PATH immer selbst setzen, INKLUSIVE des geerbten Werts: sonst greift die Falle 3.2-4.
  // process.env.PATH liest unter Windows ohne Rücksicht auf Groß-/Kleinschreibung.
  env: { PATH: `${laufzeitOrdner};${process.env.PATH ?? ''}` },
  envRemove: ['ZOOM_SDK_CLIENT_ID', 'ZOOM_SDK_CLIENT_SECRET', 'ZOOM_SDK_CREDENTIALS'],
  joinTimeoutMs: 30_000,
  killTimeoutMs: 12_000,
  onEvent, onLog,
});
```

- **Feste Werte:**

| Name | Wert | Bedeutung |
| --- | --- | --- |
| `ANMELDE_FRIST_MS` | 30 000 | Warten auf das `auth`-Ereignis (wie `cli/steuerung.mjs:783`) |
| `joinTimeoutMs` | 30 000 | Wachhund der Bridge für Beitritt und Neuverbindung |
| `killTimeoutMs` | 12 000 | `stop()` tötet danach hart. Die Bridge braucht bis zu 10 s bei offenen Antworten (`native/main.cpp:484-503`). |
| `BEENDEN_FRIST_MS` | 15 000 | Höchstdauer des Beendens von Connect (6.6) |
| `ABGLEICH_VERZOEGERUNG_MS` | 300 | Wartezeit nach Teilnehmeränderungen, bevor Connect neu abonniert (Ergänzung 0.9) |
| `ABO_ANTWORT_FRIST_MS` | 10 000 | Ohne `video`-Ereignis oder Fehler zu einem Abo gilt es als unbeantwortet (Q8) |
| `WIEDERBEITRITT_PLAN_S` | 2, 5, 10, 20, 30 | Wartezeit vor Versuch 1 bis 5 (6.4) |
| `JWT_GUELTIG_S` | 43 200 | 12 h (Ergänzung 0.7) |
| `BETRIEBSGROESSE` | 5 | ab der 6. Quelle warnen (F4) |
| `AUFLOESUNG` | `'720p'` | Vorgabe der Bridge |
| `ABBILD_TAKT_MS` | 100 | höchstens 10 Abbild-Pushes je Sekunde |
| `HINWEISE_MAX` | 5 | so viele Hinweise zeigt die Karte |

### 5.3 Laufzeit-Ordner

```
%LOCALAPPDATA%\JM Connect\zoom-laufzeit\7.1.5.43953\
  sdk.dll, … (153 Dateien aus x64\bin, mit language\ und ringtone\)
  zoom-bridge.exe                      eigene Datei, aus <resources>\zoom-bridge\
  msvcp140.dll, vcruntime140*.dll, …   eigene Dateien, aus <resources>\zoom-bridge\
  Processing.NDI.Lib.x64.dll           eigene Datei, aus <resources>\bin\win\
  jm-zoom-laufzeit.json                Stempel
```

`<resources>` ist im Paket `process.resourcesPath`, in der Entwicklung `apps/connect/resources` (`resourcePath()` aus `@jm/electron-kit`). Für die Entwicklung genügt einmal `npm run prepackage -w @jm/connect`.

**Stempel** `jm-zoom-laufzeit.json`:

```json
{
  "format": 1,
  "sdkFassung": "7.1.5.43953",
  "eingerichtetAm": "<ISO-Zeit>",
  "sdkDateien": [{ "pfad": "sdk.dll", "bytes": 0 }],
  "eigeneDateien": [{ "pfad": "zoom-bridge.exe", "sha256": "<hex>" }]
}
```

(`bytes` und `sha256` hier nur als Form; die Werte schreibt Connect.)

**Prüfung vor jedem Start** (`pruefeLaufzeit`):
1. Der Stempel ist lesbar, und `sdkFassung` ist gleich `SDK_FASSUNG`.
2. Jede Datei aus `sdkDateien` existiert mit gleicher Größe. Zusätzliche Dateien stören nicht, denn ob das SDK selbst Dateien in seinen Ordner schreibt, ist ungemessen.
3. `peInfo(sdk.dll)` ergibt x64 und 7.1.5.43953.
4. **Eigene Dateien abgleichen:** Jede Datei aus `<resources>\zoom-bridge\` und die NDI-DLL wird kopiert, wenn sie fehlt oder ihr SHA-256 abweicht. Danach wird der Stempel aktualisiert. So bringt ein Connect-Update eine neue `zoom-bridge.exe` mit, ohne dass das SDK neu kopiert wird.

Scheitert 1–3, gilt die Laufzeit als „defekt“ (Text S9). Scheitert 4, weil `<resources>\zoom-bridge\zoom-bridge.exe` fehlt, gilt S8.

### 5.4 Typen (`apps/connect/src/shared/types.ts`)

```ts
import type { AudioReason, AudioState, UserRoleName, VideoReason, VideoState } from '@jm/zoom-bridge/protocol';

export type ZoomZustand =
  | 'nicht_verfuegbar' // macOS
  | 'einrichtung'      // SDK oder Zugangsdaten fehlen, oder die Kopie läuft
  | 'bereit'
  | 'startet'          // Bridge startet, Anmeldung bei Zoom
  | 'tritt_bei'        // join gesendet
  | 'warteraum'        // waitingRoom oder waitingForHost
  | 'im_meeting'
  | 'abriss'           // Zoom verbindet neu, oder Wiederbeitritt läuft
  | 'verlaesst'
  | 'fehler';          // endgültig, bis der Bediener handelt

export type ZoomErlaubnis = 'offen' | 'ja' | 'abgelehnt' | 'abgelaufen';

/** Ein laufendes Abo der Bridge. */
export interface ZoomQuelle {
  /** Teilnehmer-ID zum Zeitpunkt des Abos. Gilt nur in dieser Sitzung. */
  aboId: number;
  /** Wörtlich aus dem video-Ereignis (`source`). */
  ndiName: string;
  bild: Exclude<VideoState, 'unsubscribed'>;
  bildGrund: VideoReason;
  /** 'aus' = ohne Ton geladen. */
  ton: AudioState | 'aus';
  tonGrund: AudioReason | null;
  /** Klartext des letzten Fehlers dieses Abos (Abschnitt 8.4). */
  fehler: string | null;
}

/** Ein Zoom-Teilnehmer, wie die Zoom-Karte ihn zeigt. Die eigene Zeile der Bridge fehlt. */
export interface ZoomParticipant {
  /** Zooms GetUserID(). Gilt nur in dieser Sitzung. */
  id: number;
  name: string;
  rolle: UserRoleName;
  kamera: 'an' | 'aus' | 'keine';
  imWarteraum: boolean;
  doppelname: boolean;
  /** Ton-Schalter. Vorgabe true, nur änderbar ohne Quelle. */
  tonVorwahl: boolean;
  quelle: ZoomQuelle | null;
  /** „JM Connect – Zoom <name>“, solange noch keine Quelle läuft. */
  ndiNameVorschau: string;
  /** Klartext Q10, wenn ein Browser-Gast denselben NDI-Namen führt. */
  kollision: string | null;
}

/** Ein Eintrag der Soll-Liste, der gerade keinem Teilnehmer zugeordnet ist. */
export interface ZoomSollEintrag {
  name: string;
  ton: boolean;
  /** Zuletzt gemeldeter NDI-Name, sonst die Vorschau. */
  ndiName: string;
  stand: 'wartet' | 'doppelname' | 'verwaist';
  /** Nur bei 'verwaist': das alte Abo, zum Entladen. */
  aboId: number | null;
}

/** Kurzform für Tray, Kopfzeile und STATE. Teil von AppStatus. */
export interface ZoomKurz {
  zustand: ZoomZustand;
  /** Nur bei 'warteraum'. */
  warten: 'warteraum' | 'host' | null;
  /** Nur bei 'im_meeting' gesetzt, sonst null. */
  erlaubnis: ZoomErlaubnis | null;
  /** Abos dieser Bridge-Sitzung, deren NDI-Sender existiert. */
  quellen: number;
  /** Davon nicht im Zustand 'live'. */
  ohneBild: number;
  /** Nur bei 'abriss': null = Zoom verbindet selbst neu, sonst Versuch 1 bis 5. */
  versuch: number | null;
  /** Nur bei 'einrichtung'. */
  fehlt: Array<'sdk' | 'zugang'>;
  kopieLaeuft: boolean;
}

export interface ZoomAbbild {
  kurz: ZoomKurz;
  einrichtung: {
    sdk: {
      stand: 'fehlt' | 'kopiert' | 'ok' | 'defekt';
      fassung: string | null;
      kopie: { dateien: number; dateienGesamt: number; bytes: number; bytesGesamt: number } | null;
      text: string | null;
    };
    zugang: { herkunft: ProxyKeySource; clientIdEnde: string | null; text: string | null };
  };
  anzeigename: string;
  versatz: { gewuenschtMs: number; bestaetigtMs: number | null };
  /** Ohne eigene Zeile. Host und Co-Host zuerst, dann nach Name (de). */
  teilnehmer: ZoomParticipant[];
  soll: ZoomSollEintrag[];
  abriss: { versuch: number | null; versuche: 5; naechsterUm: number | null } | null;
  meldung: { art: 'info' | 'warnung' | 'fehler'; text: string; detail: string | null } | null;
  /** Die letzten 5 Hinweise (Fernsteuerung, Ton-Überlauf, Wiederbeitritt). */
  hinweise: string[];
  /** Liegen Nummer und Kenncode noch im Arbeitsspeicher des Main? */
  erneutMoeglich: boolean;
}

export type ZoomErgebnis = { ok: true } | { ok: false; text: string };
```

`AppStatus` (`types.ts:37-53`) bekommt `zoom: ZoomKurz | null` (`null` unter macOS).

`ZoomParticipant.kamera`: `videoOn` → `'an'`, sonst `hasCamera === false` → `'keine'`, sonst `'aus'`.

### 5.5 IPC-Kanäle (`apps/connect/src/shared/ipc.ts`)

| Konstante | Kanal | Art | Nutzlast → Antwort |
| --- | --- | --- | --- |
| `zoomGet` | `jmc:zoom-get` | invoke | – → `ZoomAbbild` |
| `zoom` | `jmc:zoom` | push Main → Renderer | `ZoomAbbild` |
| `zoomSdkWaehlen` | `jmc:zoom-sdk-waehlen` | invoke | – → `ZoomErgebnis` (öffnet den Ordner-Dialog, startet die Kopie) |
| `zoomZugangWaehlen` | `jmc:zoom-zugang-waehlen` | invoke | – → `ZoomErgebnis` (öffnet den Datei-Dialog) |
| `zoomZugangLoeschen` | `jmc:zoom-zugang-loeschen` | invoke | – → `void` |
| `zoomPruefen` | `jmc:zoom-pruefen` | invoke | – → `ZoomErgebnis` |
| `zoomBeitreten` | `jmc:zoom-beitreten` | invoke | `{ nummer, kenncode, anzeigename }` → `ZoomErgebnis` |
| `zoomVerlassen` | `jmc:zoom-verlassen` | invoke | – → `void` |
| `zoomLaden` | `jmc:zoom-laden` | invoke | `{ id, ton, trotzBetriebsgroesse }` → `ZoomErgebnis` |
| `zoomEntladen` | `jmc:zoom-entladen` | invoke | `{ aboId }` → `ZoomErgebnis` |
| `zoomTon` | `jmc:zoom-ton` | invoke | `{ id, an }` → `ZoomErgebnis` (nur ohne Quelle) |
| `zoomSollVerwerfen` | `jmc:zoom-soll-verwerfen` | invoke | `{ name }` → `void` |
| `zoomVersatz` | `jmc:zoom-versatz` | invoke | `{ ms }` → `ZoomErgebnis` |
| `zoomErneut` | `jmc:zoom-erneut` | invoke | – → `ZoomErgebnis` (Beitritt mit den Daten im Arbeitsspeicher) |
| `zoomAbbrechen` | `jmc:zoom-abbrechen` | invoke | – → `void` (Wiederbeitritt abbrechen) |
| `zoomSchliessen` | `jmc:zoom-schliessen` | invoke | – → `void` (Fehler quittieren, Arbeitsspeicher leeren) |

Der Kenncode geht **nur** mit `zoomBeitreten` in den Main und kommt nie zurück. `JmConnectApi` bekommt je Kanal eine Methode (`zoomGet`, `onZoom`, `zoomSdkWaehlen` …), nach dem flachen Muster der bestehenden API (`types.ts:79-110`).

### 5.6 Einstellungen (`connect-settings.json`)

```ts
interface Stored {
  proxyUrl?: string;
  proxyKeyEnc?: string;
  /** safeStorage(JSON { clientId, clientSecret }), base64. Nie im Klartext. */
  zoomZugangEnc?: string;
  /** Laufzeit-Ordner und Fassung, nach erfolgreicher Einrichtung. */
  zoomLaufzeit?: { dir: string; fassung: string; eingerichtetAm: string };
  /** 1 bis 64 Zeichen; fehlt = „JM Connect“. */
  zoomAnzeigename?: string;
  /** Ganze Zahl 0 bis 1000; fehlt = 0. */
  zoomVersatzMs?: number;
}
```

Zugangsdaten folgen der Rangfolge aus `settings.ts:10-11`: Umgebung vor Gespeichertem. Die Umgebung (`ZOOM_SDK_CLIENT_ID` + `ZOOM_SDK_CLIENT_SECRET` oder `ZOOM_SDK_CREDENTIALS`) ist der Entwicklungsweg und hat die Herkunft `'env'`. Ohne Schlüsselbund hält Connect die Zugangsdaten nur für die Sitzung (Herkunft `'session'`), nie im Klartext auf der Platte.

### 5.7 Wer welches Geheimnis sieht

| Datum | Main (RAM) | Platte | Renderer | Kindprozess | Log | STATE | Cloud |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Client-ID / Secret | ja (beim Token-Bau) | nur verschlüsselt | nein (nur Herkunft + letzte 4 Zeichen der Client-ID) | **nein** (`envRemove`) | nein | nein | nein |
| JWT | ja (kurz) | nein | nein | ja (stdin) | nein | nein | nein |
| Meeting-Nummer | ja, bis „Verlassen“/„Schließen“/Ende von Connect | nein | nur im Eingabefeld, nicht persistiert | ja (stdin) | nein | nein | nein |
| Kenncode | ja, wie Nummer | nein | nur bis zum Klick auf „Beitreten“ | ja (stdin) | **maskiert** (8.7) | nein | nein |

---

## 6 · Datenflüsse

### 6.1 Einrichtung

**SDK-Ordner wählen**
1. Renderer ruft `zoomSdkWaehlen`. Gesperrt, solange Zoom nicht in `einrichtung`, `bereit` oder `fehler` steht (S10).
2. Hülle öffnet `dialog.showOpenDialog({ properties: ['openDirectory'] })`.
3. `findeSdkBin`: Erst `<gewählt>\sdk.dll`, dann `<gewählt>\bin\sdk.dll`, dann `<gewählt>\x64\bin\sdk.dll`. Keiner → S1.
4. `peInfo(sdk.dll)`: Maschinentyp `0x014c` → S2. Keine Versionsangabe → S3b. Fassung ≠ 7.1.5.43953 → S3.
5. Eigene Dateinamen dürfen im SDK-Ordner nicht vorkommen → sonst S4.
6. Freier Platz (`fs.statfs`) ≥ Größe der Quelle + 100 MB → sonst S5.
7. Kopieren nach `<ziel>.teil\`, Datei für Datei. Nach jeder Datei aktualisiert sich `abbild.einrichtung.sdk.kopie`. Zustand `einrichtung`, `kopieLaeuft: true`.
8. Nachprüfen: gleiche Dateizahl, gleiche Größen, `peInfo` der Kopie. Abweichung → S7, `.teil` löschen.
9. Eigene Dateien hinzufügen, Stempel schreiben.
10. Tauschen: alter Ordner → `.alt`, `.teil` → Ziel, `.alt` löschen. Danach Geschwister-Ordner anderer Fassungen löschen, aber nur solche mit gültigem Stempel.
11. `zoomLaufzeit` in die Einstellungen, Abbild pushen.

Ein Fehler in 7–10 lässt die bisherige Einrichtung unverändert (S6). Beendet der Bediener Connect während der Kopie, bricht sie ab und `.teil` wird gelöscht.

**Zugangsdaten wählen**
1. `dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Zugangsdaten', extensions: ['json'] }] })`.
2. `readCredentials({ ZOOM_SDK_CREDENTIALS: pfad })`. Mit dieser Umgebung ist die Datei die einzige Quelle (`jwt.ts:66-70`), BOM wird vertragen, ein Parse-Fehler zitiert den Inhalt nicht (`jwt.ts:82-89`). Fehler → A1, A2, A3.
3. `safeStorage.encryptString(JSON.stringify({ clientId, clientSecret }))` → `zoomZugangEnc`. Den Pfad merkt sich Connect nicht.
4. Ohne Schlüsselbund → nur für die Sitzung (A4).

**Einrichtung prüfen** (Nur-Anmelden)
1. Wie Beitritt (6.2) Schritt 1–6, aber ohne `join`.
2. Danach `stop()`. Ergebnis: „Einrichtung in Ordnung: Zoom-SDK 7.1.5 (43953), Anmeldung bei Zoom erfolgreich.“ oder der Klartext des Fehlers.

### 6.2 Beitritt

1. **Vorbedingungen:** Zustand `bereit` oder `fehler`. Laufzeit geprüft (5.3), Zugangsdaten vorhanden, `normalizeMeetingId(nummer)` gelingt (sonst N0), Anzeigename 1 bis 64 Zeichen nach `trim` (sonst N0b). Der Anzeigename wird gespeichert.
2. Nummer und Kenncode in den Arbeitsspeicher des Kerns. Zustand `startet`.
3. Neue `Bridge` (5.2), `await start()`. Spawn-Fehler → B1/B2.
4. Senden: `init`, `auth { jwt: buildJwt({ clientId, clientSecret, ttlSeconds: 43_200 }) }`, `videoDelay { ms: <gespeicherter Versatz> }`. `videoDelay` braucht weder `init` noch ein Meeting (`native/main.cpp:267-285`).
5. Bei `ready`: `sdkVersion` muss gleich `SDK_FASSUNG_BRIDGE` sein, sonst `stop()` und B7.
6. Warten auf `auth`, höchstens 30 s. Ausgang: Code 0 → weiter. Code ≠ 0 → B9–B15. Bridge tot → B3–B6. Fehler `where:'init'` → B8. Keine Antwort → B16.
7. `join { meetingId, passcode, displayName }`. Zustand `tritt_bei`.
8. Ereignisse:
   - `waitingRoom` → `warteraum` (`warten: 'warteraum'`), ohne Frist.
   - `waitingForHost` → `warteraum` (`warten: 'host'`), ohne Frist.
   - `inMeeting` → `im_meeting`, Merker „war im Meeting“ setzen.
   - `failed` → Text aus 8.3, Zustand `fehler`, `stop()`. Kein automatischer Versuch (Ergänzung 0.10).
   - `error join joinTimeout` → Text CT aus 8.3, Zustand `fehler`, `stop()`.
   - Fehler `where:'join'` mit SDK-Code → Text CJ, Zustand `fehler`, `stop()`.
9. Im Meeting: `privilege` setzt `erlaubnis` (`canRecordRaw` → `'ja'`, `denied` → `'abgelehnt'`, `timedOut` → `'abgelaufen'`, sonst `'offen'`). Wechselt `erlaubnis` auf `'ja'`, läuft der Abgleich der Soll-Liste (6.3).

Connect wertet **nicht** `session.phase` als „Bridge tot“ aus, denn `phase:'error'` steht auch bei laufendem Meeting (3.2-8). Es gelten die Regeln aus 6.4.

### 6.3 Laden, Entladen, Soll-Liste

**Laden** (`zoomLaden { id, ton, trotzBetriebsgroesse }`)
1. Voraussetzungen: `im_meeting`, `erlaubnis === 'ja'` (sonst Q1), Teilnehmer bekannt und nicht im Warteraum (sonst Q2 bzw. Knopf gesperrt).
2. Sind schon 5 oder mehr Quellen geladen und `trotzBetriebsgroesse` ist false → `{ ok:false, text: Q9 }`. Die Karte macht daraus einen zweiten Klick.
3. Gibt es eine **verwaiste** Quelle mit gleichem normierten Namen: zuerst `videoUnsubscribe(aboId)`, auf `unsubscribed` warten (höchstens 2 s). So bleibt der NDI-Name gleich.
4. `videoSubscribe { id, resolution: '720p', audio: ton }`.
5. Soll-Liste: Eintrag für den normierten Namen setzen bzw. ersetzen (`ton`, NDI-Name).
6. Kommt binnen 10 s weder ein `video`-Ereignis noch ein Fehler mit dieser `id` → Q8 an der Zeile.

**Entladen** (`zoomEntladen { aboId }`): Soll-Eintrag entfernen, dann `videoUnsubscribe(aboId)`. Der Ton meldet sich vor dem Bild ab (Bridge-Verhalten).

**Ton-Schalter:** Er gilt beim Laden. Bei geladener Quelle ist er gesperrt (Q14); Umschalten heißt entladen und neu laden (Stage-3-Regel). Die Vorwahl hält der Kern je normiertem Namen im Arbeitsspeicher.

**Abgleich der Soll-Liste** (300 ms nach `roster`, `joined`, `left`, `renamed`, nach `inMeeting` und nach Erlaubnis `'ja'`; nur bei `im_meeting` + `erlaubnis 'ja'`):

| Soll-Eintrag | Lage | Handlung | Stand |
| --- | --- | --- | --- |
| hat ein Abo mit Teilnehmer im Meeting | – | nichts | (verbunden, nicht im Abbild-`soll`) |
| hat ein Abo `black`/`participantLeft` | – | nichts; die Bridge hängt selbst um | `verwaist` |
| kein Abo | genau 1 fremder Teilnehmer mit dem Namen, nicht im Warteraum | `videoSubscribe` mit dem gemerkten Ton | danach verbunden |
| kein Abo | 0 Treffer | warten | `wartet` |
| kein Abo | 2 oder mehr Treffer | **nichts** | `doppelname` (rot) |
| `verwaist` | 2 oder mehr Treffer | nichts | `verwaist`, rot mit Q11 |

Die Soll-Liste leert sich bei „Verlassen“, „Schließen“, beim Meeting-Ende durch den Host (6.5) und beim Beenden von Connect. Sie bleibt bei einem Abriss und bei „Erneut beitreten“.

**Doppelname:** Beide Zeilen tragen `doppelname: true` und Q11. Laden von Hand bleibt möglich. Laden per Fernsteuerung wird abgelehnt (F3).

**Kollision Gast ↔ Zoom:** Bei jedem Abbild vergleicht der Kern den NDI-Namen jeder Zoom-Zeile (Quelle oder Vorschau) mit `activeLabels()` der Gast-Sender, nach NFC und ohne Groß-/Kleinschreibung. Treffer → `kollision` = Q10. Connect warnt, sperrt aber nicht. Die Prüfung läuft in beide Richtungen, also auch, wenn der Browser-Gast später kommt.

### 6.4 Abriss und Wiederbeitritt

**Auslöser** (nur mit Merker „war im Meeting“):

| Ereignis | Folge |
| --- | --- |
| `status reconnecting` | Zustand `abriss`, `versuch: null`. Zoom verbindet selbst neu; der Wachhund der Bridge läuft (30 s). Quellen bestehen weiter (schwarz). |
| `status inMeeting` nach `reconnecting` | zurück zu `im_meeting`, Abgleich der Soll-Liste |
| `status failed`, Code endgültig (Tabelle unten) | Zustand `fehler`, Text aus 8.3 mit Vorsatz „Wiederbeitritt abgebrochen: “ |
| `status failed`, sonst | Wiederbeitritt |
| `error meeting reconnectTimeout` | Wiederbeitritt |
| `error exit exited` | Wiederbeitritt (R4), außer bei DLL-Rückgabewerten (B3–B5, dann `fehler`) |
| `status ended` | **kein** Abriss: Meeting-Ende (6.5) |

**Wiederbeitritt:**
1. Alte Bridge `stop()` (höchstens 12 s, dann hart).
2. Für Versuch i = 1 bis 5: `WIEDERBEITRITT_PLAN_S[i-1]` warten (Abbild zeigt `naechsterUm`), dann 6.2 Schritt 3–7 mit neuer `Bridge`.
3. Ausgang eines Versuchs:
   - `inMeeting` → Erfolg: Zustand `im_meeting`, Zähler zurück, Hinweis R5. Der Abgleich lädt die Soll-Liste neu, sobald die Erlaubnis da ist.
   - `waitingRoom`/`waitingForHost` → angekommen: Zustand `warteraum`, keine weiteren Versuche. Lässt der Host zu, geht es weiter wie oben.
   - endgültiger Fehler → Zustand `fehler`, keine weiteren Versuche.
   - vorübergehender Fehler → nächster Versuch.
4. Nach Versuch 5 → `fehler` mit R2, `erneutMoeglich: true`.
5. „Abbrechen“ (Karte oder Tray „Zoom-Meeting verlassen“) beendet die Folge → `fehler` mit R7.

**Einordnung** (`klartext.ts`, `istEndgueltig`):

| Art | Codes |
| --- | --- |
| endgültig, `status failed` | 4, 6, 7, 8, 9, 10, 12, 13, 14, 16, 23, 60, 61, 62, 63, 64, 82, 88, 89, 500–506 |
| endgültig, sonst | jedes `ended`; `auth` ≠ 0 außer 6, 8, 9; DLL-Tod (B3–B5); SDK-Fassung falsch (B7); Spawn-Fehler (B1, B2); Laufzeit defekt (S9); Zugangsdaten fehlen (B17) |
| vorübergehend | alle übrigen `failed`-Codes (darunter 1, 2, 3, 5, 11, 15, `0xffff` und unbekannte); `joinTimeout`; `reconnectTimeout`; `exited` nach `ready`; `auth` 6, 8, 9; keine Antwort auf `auth` (B16) |

Unbekannte Codes zählen als vorübergehend. Die Versuche sind ja auf fünf begrenzt, und bei einem Abriss mitten in der Show zählt die selbsttätige Erholung mehr als zwei verlorene Minuten.

Nach dem Wiederbeitritt gelten neue Teilnehmer-IDs. Die NDI-Namen sind dieselben, weil die neue Bridge keine alten Abos kennt (`native/video.cpp:188-201`). Der Switcher verbindet sich über den Namen selbst wieder [VERMUTET, M2]. Ob der Host die Erlaubnis neu erteilen muss, ist ungemessen (M2). Die Karte zeigt es in jedem Fall über `erlaubnis`.

### 6.5 Meeting-Ende durch den Host

`status ended` → `stop()`, Zustand `bereit`, Meldung R6 mit dem Grund aus `explainStatus` (`protocol.ts:450-460`). Bei Grund 1 („vom Gastgeber entfernt“) lautet der Text C61. Soll-Liste leer. Nummer und Kenncode bleiben im Arbeitsspeicher; „Erneut beitreten“ ist möglich, falls der Host neu startet.

### 6.6 Beenden und Fenster schließen

**Fenster schließen:** wie heute ins Tray (`index.ts:51-56`). Zoom läuft weiter.

**Beenden** (Tray „Beenden“ oder `app.quit()`):

```ts
let zoomAbgebaut = false;
app.on('before-quit', (e) => {
  isQuitting = true;
  if (!zoomAbgebaut && zoom.laeuft()) {
    e.preventDefault();
    // Zweiter Aufruf während des Wartens bekommt dasselbe Versprechen.
    void zoom.beenden(BEENDEN_FRIST_MS).finally(() => {
      zoomAbgebaut = true;
      app.quit();
    });
    return;
  }
  tearDownAll(); stopProgram(); destroyPeerWindow(); stopControlServer(); stopPresenterLink(); destroyTray();
});
```

`zoom.beenden(frist)`: Wiederbeitritt abbrechen, Kopie abbrechen, `bridge.stop()`. Die Bridge schickt dabei selbst `Leave` (`native/session.cpp:613-624`). Nach `frist` geht es ohne Warten weiter; das Log hält „Zoom-Bridge nicht rechtzeitig beendet“ fest. Während des Wartens zeigt das Tray „◌ Zoom: verlässt das Meeting …“.

**Windows-Abmeldung oder Herunterfahren:** Das Ereignis `session-end` des Hauptfensters stößt `zoom.beenden(BEENDEN_FRIST_MS)` an. Ob Windows so lange wartet, ist ungemessen (17.1).

### 6.7 Bild-Versatz

- Feld 0 bis 1000 ms, ganze Zahl. Ungültig → Feld rot, Text Q13, nichts gesendet.
- Gültig → speichern (`zoomVersatzMs`). Läuft eine Bridge: `videoDelay`. Die Karte zeigt „bestätigt: N ms“ aus `session.videoDelayMs`, sonst „gilt ab dem nächsten Beitritt“.
- Bei jedem Bridge-Start sendet Connect den gespeicherten Wert vor dem `join` (6.2 Schritt 4).
- Fernsteuerung `zoom_delay` wirkt genauso, auch auf das Gespeicherte.

---

## 7 · Status: Zustände und Texte (Kreuzprodukt)

Grundsatz aus der Lehre „Eine dauerhafte Statuszeile lügt leichter“: Jeder Text muss in **jedem** Zustand wahr sein, in dem er steht. Deshalb gibt es feste Zeilen je Zustand und eine einzige Funktion, die Tray und Kopfzeile versorgt (`shared/zoom-text.ts`).

### 7.1 Zustände

| Z | `zustand` | Bedingung |
| --- | --- | --- |
| Z0 | `nicht_verfuegbar` | `process.platform !== 'win32'` |
| Z1a | `einrichtung` | SDK oder Zugangsdaten fehlen oder sind defekt, keine Kopie läuft |
| Z1b | `einrichtung` | Kopie läuft |
| Z2 | `bereit` | – |
| Z3 | `startet` | – |
| Z4 | `tritt_bei` | – |
| Z5a | `warteraum` | `warten: 'warteraum'` |
| Z5b | `warteraum` | `warten: 'host'` |
| Z6 | `im_meeting` | Erlaubnis `'offen'`, 0 Quellen |
| Z7 | `im_meeting` | Erlaubnis `'abgelehnt'` oder `'abgelaufen'`, 0 Quellen |
| Z7b | `im_meeting` | Erlaubnis ≠ `'ja'`, n > 0 Quellen (z. B. Erlaubnis entzogen) |
| Z8 | `im_meeting` | Erlaubnis `'ja'`, 0 Quellen |
| Z9 | `im_meeting` | Erlaubnis `'ja'`, n > 0, alle `live` |
| Z9b | `im_meeting` | Erlaubnis `'ja'`, n > 0, k > 0 nicht `live` |
| Z10 | `abriss` | `versuch: null` (Zoom verbindet selbst) |
| Z11 | `abriss` | Versuch i von 5 |
| Z12 | `verlaesst` | – |
| Z13 | `fehler` | – |

### 7.2 Zoom-Zeile (Tray = Kopfzeile) und Kartentext

`zoomZeile(kurz)` liefert die Zeile für das Tray-Menü **und** für die Kopfzeile. Singular bei 1 („1 Quelle“, „1 ohne Bild“).

| Z | Tray-Zeile und Kopfzeile | Statuszeile der Zoom-Karte |
| --- | --- | --- |
| Z0 | – (keine Zeile) | – (keine Karte) |
| Z1a | `△ Zoom: nicht eingerichtet` | „Zoom ist noch nicht eingerichtet: {Grund}.“ — Grund ist „SDK-Ordner fehlt“, „Zugangsdaten fehlen“ oder „SDK-Ordner und Zugangsdaten fehlen“ |
| Z1b | `◌ Zoom: Einrichtung läuft` | „Zoom-SDK wird kopiert: {d} von {D} Dateien ({m} von {M} MB).“ |
| Z2 | `○ Zoom: kein Meeting` | „Bereit. Meeting-Nummer und Kenncode eingeben.“ |
| Z3 | `◌ Zoom: meldet sich an …` | „Melde mich bei Zoom an …“ |
| Z4 | `◌ Zoom: tritt dem Meeting bei …` | „Trete dem Meeting bei …“ |
| Z5a | `◌ Zoom: im Warteraum` | „Im Warteraum. Der Host muss „{Anzeigename}“ zulassen.“ |
| Z5b | `◌ Zoom: wartet auf den Host` | „Das Meeting hat noch nicht begonnen. Warte auf den Host.“ |
| Z6 | `◌ Zoom: im Meeting, Aufnahme-Erlaubnis ausstehend` | „Im Meeting. Warte auf die Aufnahme-Erlaubnis: Der Host muss sie im Zoom-Client für „{Anzeigename}“ erteilen.“ |
| Z7 | `△ Zoom: im Meeting ohne Aufnahme-Erlaubnis` | „Im Meeting ohne Aufnahme-Erlaubnis. {Grund} Der Host kann sie im Zoom-Client jederzeit erteilen; Connect merkt das von selbst.“ — Grund ist „Der Host hat abgelehnt.“ (`abgelehnt`) oder „Zoom hat keine Antwort bekommen.“ (`abgelaufen`) |
| Z7b | `△ Zoom: {n} Quellen, Aufnahme-Erlaubnis fehlt` | „Die Aufnahme-Erlaubnis fehlt. {n} Quellen bestehen, senden aber kein Bild, bis der Host sie erteilt.“ |
| Z8 | `○ Zoom: im Meeting, keine Quelle geladen` | „Im Meeting. Personen unten als Quelle laden.“ |
| Z9 | `● Zoom: {n} Quellen geladen` | „Im Meeting. {n} Quellen geladen.“ |
| Z9b | `● Zoom: {n} Quellen geladen, {k} ohne Bild` | „Im Meeting. {n} Quellen geladen, {k} davon ohne Bild (Kamera aus oder Person weg).“ |
| Z10 | `△ Zoom: Verbindung unterbrochen, Zoom verbindet neu` | „Verbindung unterbrochen. Zoom versucht selbst, neu zu verbinden …“ |
| Z11 | `△ Zoom: Verbindung verloren, Wiederbeitritt {i} von 5` | „Verbindung zum Meeting verloren. Wiederbeitritt {i} von 5 in {s} s.“ während der Wartezeit, „Verbindung zum Meeting verloren. Wiederbeitritt {i} von 5 läuft …“ während des Versuchs |
| Z12 | `◌ Zoom: verlässt das Meeting …` | „Verlasse das Meeting …“ |
| Z13 | `✕ Zoom: Fehler, siehe Connect-Fenster` | Text der `meldung` (Abschnitt 8) |

Prüfung auf Wahrheit, Zeile für Zeile:
- „Quellen geladen“ heißt: Der NDI-Sender existiert. Das stimmt auch bei schwarzem Bild, darum nennt Z9b die Zahl ohne Bild.
- Z7b sagt „fehlt“ auch bei `'offen'`: Eine ausstehende Erlaubnis ist eine fehlende.
- Z10 nennt keine Quellenzahl, weil die Quellen in diesem Zustand schwarz sind.
- Z5a und Z5b sind getrennt, weil „Warteraum“ für `waitingForHost` falsch wäre.

### 7.3 Gäste-Zeile im Tray (berichtigt)

`g` = `ndiSenders` (Gast-Sender inklusive Bildschirm).

| Lage | Zeile |
| --- | --- |
| g > 0 | `● Gäste: {g} NDI-Quellen` (Singular „1 NDI-Quelle“) |
| g = 0, Cloud eingerichtet | `○ Gäste: keine NDI-Quelle` |
| g = 0, Cloud nicht eingerichtet | `△ Gäste: Cloud nicht eingerichtet` |

Tray-Menü: Gäste-Zeile, Zoom-Zeile (nur Windows), Trenner, „Fenster anzeigen“, „Raum schließen“ (unverändert), „Zoom-Meeting verlassen“ (aktiv in Z3–Z11; in Z10/Z11 bricht es den Wiederbeitritt ab), Trenner, „Beenden“.

Kopfzeile rechts (`App.tsx:244-247`): „Steuerport 8737“, darunter „● Raum verbunden“ bzw. „○ Raum nicht verbunden“ (statt „○ nicht verbunden“, das bei laufendem Zoom wie „gar nichts verbunden“ klänge), darunter die Zoom-Zeile.

### 7.4 Tooltip: das einzige kombinierte Feld

```ts
function trayTooltip(s: AppStatus): string {
  const teile: string[] = [];
  if (s.ndiSenders > 0 || (s.zoom?.quellen ?? 0) > 0) teile.push('Zuschaltungen aktiv');
  if (s.zoom?.zustand === 'abriss') teile.push('Zoom-Verbindung unterbrochen');
  if (s.zoom?.zustand === 'fehler') teile.push('Zoom-Fehler');
  return teile.length ? `JM Connect — ${teile.join(' · ')}` : 'JM Connect';
}
```

| Z | g = 0 | g > 0 |
| --- | --- | --- |
| Z0–Z8, Z12 mit 0 Quellen | `JM Connect` | `JM Connect — Zuschaltungen aktiv` |
| Z7b, Z9, Z9b, Z12 mit n > 0 | `JM Connect — Zuschaltungen aktiv` | `JM Connect — Zuschaltungen aktiv` |
| Z10 (Quellen bestehen) | `JM Connect — Zuschaltungen aktiv · Zoom-Verbindung unterbrochen` | dasselbe |
| Z11 (keine Quellen) | `JM Connect — Zoom-Verbindung unterbrochen` | `JM Connect — Zuschaltungen aktiv · Zoom-Verbindung unterbrochen` |
| Z13 | `JM Connect — Zoom-Fehler` | `JM Connect — Zuschaltungen aktiv · Zoom-Fehler` |

### 7.5 STATE je Zustand

`zoom_sources` = Abos der laufenden Bridge, deren NDI-Sender existiert. `zoom_live` = 1, wenn `zoom_sources > 0`. `zoom_privilege` = 1 nur in `im_meeting` mit Erlaubnis `'ja'`. Unter macOS fehlen die `zoom_*`-Schlüssel ganz.

| Z | `zoom_status` | `zoom_sources` | `zoom_live` | `zoom_privilege` | `zoom_alarm` |
| --- | --- | --- | --- | --- | --- |
| Z1a, Z1b | `einrichtung` | 0 | 0 | 0 | 0 |
| Z2 | `bereit` | 0 | 0 | 0 | 0 |
| Z3, Z4 | `tritt_bei` | 0 | 0 | 0 | 0 |
| Z5a, Z5b | `warteraum` | 0 | 0 | 0 | 0 |
| Z6 | `im_meeting` | 0 | 0 | 0 | 0 |
| Z7 | `im_meeting` | 0 | 0 | 0 | 1 |
| Z7b | `im_meeting` | n | 1 | 0 | 1 |
| Z8 | `im_meeting` | 0 | 0 | 1 | 0 |
| Z9, Z9b | `im_meeting` | n | 1 | 1 | 0 |
| Z10 | `abriss` | n | 1 wenn n > 0 | 0 | 1 |
| Z11 | `abriss` | 0 | 0 | 0 | 1 |
| Z12 | `verlaesst` | n (sinkt) | 1 wenn n > 0 | 0 | 0 |
| Z13 | `fehler` | 0 | 0 | 0 | 1 |

### 7.6 Prüfregel

`test/zoom-text.test.ts` prüft tabellengetrieben **jede** Zeile aus 7.2, 7.3, 7.4 und 7.5 wörtlich gegen `zoomZeile`, `gaesteZeile`, `trayTooltip` und `kern.stateKv()`. Eine neue Zustandsart ohne Tabellenzeile lässt den Test scheitern (vollständige Fallunterscheidung über `ZoomZustand`).

---

## 8 · Fehlerkatalog (Klartexte wörtlich)

Darstellung in der Karte: `meldung.text` groß, darunter `meldung.detail` klein (technischer Name und Code, z. B. `MEETING_FAIL_UNABLE_TO_JOIN_EXTERNAL_MEETING (63)`). Platzhalter in `{…}`.

### 8.1 Einrichtung

| ID | Wann | Text |
| --- | --- | --- |
| S1 | kein `sdk.dll` gefunden | „In diesem Ordner liegt kein Zoom-SDK. Bitte den entpackten SDK-Ordner wählen (der mit dem Unterordner x64\bin) oder direkt den Ordner x64\bin.“ |
| S2 | 32-Bit-`sdk.dll` | „Das ist die 32-Bit-Fassung des Zoom-SDK. Bitte den Ordner x64\bin wählen oder den SDK-Ordner darüber.“ |
| S3 | andere Fassung | „Dieses Zoom-SDK hat die Fassung {gefunden}. Diese Connect-Fassung braucht genau 7.1.5.43953. Für eine andere SDK-Fassung braucht es einen neuen Connect-Release.“ |
| S3b | keine Versionsangabe | „Die Fassung des Zoom-SDK lässt sich nicht lesen. Bitte das unveränderte SDK aus der JM-Ablage wählen.“ |
| S4 | eigener Dateiname im SDK | „Im SDK-Ordner liegt eine Datei, die wie eine Connect-Datei heißt ({name}). Das ist kein unverändertes Zoom-SDK.“ |
| S5 | zu wenig Platz | „Für die Kopie des Zoom-SDK fehlt Platz: gebraucht {x} MB, frei {y} MB.“ |
| S6 | Kopierfehler | „Das Zoom-SDK ließ sich nicht kopieren ({grund}). Die bisherige Einrichtung bleibt unverändert.“ |
| S7 | Nachprüfung scheitert | „Die Kopie des Zoom-SDK ist unvollständig ({x} von {y} Dateien). Bitte den Ordner erneut wählen.“ |
| S8 | `zoom-bridge.exe` fehlt in der Installation | „Dieser Connect-Installation fehlt die Zoom-Bridge. Bitte JM Connect neu installieren.“ |
| S9 | Laufzeit defekt (5.3) | „Die Zoom-Laufzeit auf diesem PC ist unvollständig ({datei}). Bitte den SDK-Ordner erneut wählen.“ |
| S10 | Wahl bei laufendem Zoom | „Während Zoom läuft, lässt sich das SDK nicht austauschen.“ |
| A1 | Datei kein JSON | „Die Datei ist kein gültiges JSON (Inhalt wird absichtlich nicht angezeigt).“ |
| A2 | Felder fehlen | „In der Datei fehlen Client-ID oder Client-Secret (erwartet: clientId und clientSecret).“ |
| A3 | Lesefehler | „Die Datei lässt sich nicht lesen ({code}).“ |
| A4 | kein Schlüsselbund | „Nur für diese Sitzung gemerkt — auf diesem Rechner gibt es keinen Schlüsselbund.“ |
| A5 | Entschlüsseln scheitert | „Die hinterlegten Zugangsdaten lassen sich unter diesem Windows-Konto nicht entschlüsseln. Bitte die Datei erneut wählen.“ |
| A6 | Herkunft Umgebung | „Kommt aus Umgebungsvariablen (ZOOM_SDK_…) und hat Vorrang.“ |

### 8.2 Start und Anmeldung

| ID | Wann | Text |
| --- | --- | --- |
| B1 | Spawn `ENOENT` | „zoom-bridge.exe fehlt im Laufzeit-Ordner. Bitte den SDK-Ordner erneut wählen.“ |
| B2 | Spawn `EACCES`/`EPERM` | „Windows hat den Start der Zoom-Bridge verhindert (Virenschutz oder Smart App Control). Detail: {code}.“ |
| B3 | Tod vor `auth`, `0xC0000135` | „Die Zoom-Bridge ist beim Start gestorben: Eine DLL fehlt (0xC0000135). Mit den Zugangsdaten hat das nichts zu tun. Bitte den SDK-Ordner erneut wählen.“ |
| B4 | dito, `0xC0000139` | „Die Zoom-Bridge ist beim Start gestorben: Eine DLL ist zu alt oder passt nicht (0xC0000139). Mit den Zugangsdaten hat das nichts zu tun. Bitte den SDK-Ordner erneut wählen.“ |
| B5 | dito, `0xC000007B` | „Die Zoom-Bridge ist beim Start gestorben: Eine DLL ist kein 64-Bit-Programm oder beschädigt (0xC000007B). Mit den Zugangsdaten hat das nichts zu tun. Bitte den SDK-Ordner erneut wählen.“ |
| B6 | Tod vor `auth`, anderer Wert | „Die Zoom-Bridge hat sich beendet, bevor Zoom die Anmeldung beantwortet hat ({detail}). Details im Log.“ |
| B7 | `ready.sdkVersion` falsch | „Die Zoom-Laufzeit meldet die Fassung {x}, erwartet ist 7.1.5 (43953). Bitte den SDK-Ordner erneut wählen.“ |
| B8 | Fehler `where:'init'` | „Das Zoom-SDK ließ sich nicht starten ({name}). Details im Log.“ — bei SDK-Fehler 14: „Auf diesem PC läuft schon ein anderes Programm mit dem Zoom-Meeting-SDK (zum Beispiel das Einsatzpaket „zoom-join“). Bitte es zuerst beenden.“ |
| B9 | `auth` 1, 2 | „Zoom hat die Anmeldung abgelehnt: Client-ID oder Client-Secret stimmen nicht ({result}). Bitte die Zugangsdaten-Datei prüfen.“ |
| B10 | `auth` 11 | „Zoom hat die Anmeldung abgelehnt: Das Anmelde-Token passt nicht (AUTHRET_JWTTOKENWRONG). Meist stimmen die Zugangsdaten nicht, oder die Uhr dieses PCs geht falsch.“ |
| B11 | `auth` 3, 4 | „Das Zoom-Konto der App darf das Meeting-SDK nicht nutzen ({result}). Das klärt der Inhaber des Zoom-Kontos.“ |
| B12 | `auth` 6, 8, 9 | „Zoom ist gerade nicht erreichbar ({result}). Netzwerk prüfen und erneut versuchen.“ |
| B13 | `auth` 10 | „Zoom lässt diese SDK-Fassung nicht mehr zu (AUTHRET_CLIENT_INCOMPATIBLE). Nötig ist ein neuer Connect-Release mit neuer SDK-Fassung.“ |
| B14 | `auth` 12 | „Zu viele Anmeldungen in kurzer Zeit (AUTHRET_LIMIT_EXCEEDED_EXCEPTION). Einige Minuten warten.“ |
| B15 | `auth` sonst | „Zoom hat die Anmeldung abgelehnt ({result}).“ |
| B16 | 30 s ohne `auth` | „Zoom hat auf die Anmeldung nicht geantwortet (30 s). Netzwerk prüfen und erneut versuchen.“ |
| B17 | Zugangsdaten fehlen | „Zugangsdaten fehlen — bitte die Datei wählen.“ |

Die DLL-Deutung liest den Rückgabewert aus `detail` („… exitCode=<n>“, `src/bridge.ts:168`, `:191`), wie `cli/steuerung.mjs:176-179`.

### 8.3 Beitritt

Vorsatz bei `status failed`: „Beitritt gescheitert: “. Beim Wiederbeitritt: „Wiederbeitritt abgebrochen: “.

| ID | Code | Text nach dem Vorsatz |
| --- | --- | --- |
| N0 | Nummer ungültig (vor dem Start) | (ohne Vorsatz) „Die Meeting-Nummer darf nur Ziffern enthalten (Leerzeichen und Bindestriche werden entfernt).“ |
| N0b | Anzeigename leer oder zu lang | (ohne Vorsatz) „Der Anzeigename muss 1 bis 64 Zeichen lang sein.“ |
| C4 | 4 | „falscher Kenncode.“ |
| C6 | 6 | „Das Meeting ist vorbei.“ |
| C7 | 7 | „Das Meeting hat noch nicht begonnen, und Warten auf den Host ist nicht erlaubt.“ |
| C8 | 8 | „Dieses Meeting gibt es nicht. Bitte die Nummer prüfen.“ |
| C9 | 9 | „Das Meeting ist voll.“ |
| C10 | 10 | „Zoom lässt diese SDK-Fassung nicht mehr zu (Client zu alt). Nötig ist ein neuer Connect-Release mit neuer SDK-Fassung.“ |
| C12 | 12 | „Das Meeting ist gesperrt.“ |
| C13 | 13, 14 | „Das Meeting ist durch eine Kontoeinstellung eingeschränkt.“ |
| C61 | 61, `ended` Grund 1 | „Der Host hat „{Anzeigename}“ aus dem Meeting entfernt.“ |
| C62 | 62 | „Der Host lässt niemanden von außerhalb seines Zoom-Kontos zu.“ |
| C63 | 63 | „Das Meeting gehört nicht zum Zoom-Konto dieser App. JM Connect kann nur Meetings im eigenen Zoom-Konto betreten (Zoom-Regel seit 02.03.2026). Bitte das Meeting im eigenen Konto anlegen.“ |
| C64 | 64 | „Der Administrator des Gastgeber-Kontos hat diese App gesperrt.“ |
| C82 | 82 | „Das Meeting verlangt eine Anmeldung mit dem Konto des Veranstalters. JM Connect tritt ohne Anmeldung bei und kann nur Meetings im eigenen Zoom-Konto betreten.“ |
| C500 | 500–506 | „Zoom verlangt für dieses Meeting einen Beitritt im Namen eines angemeldeten Nutzers (OBF-Token). Das kann JM Connect nicht — nur Meetings im eigenen Zoom-Konto.“ |
| Csonst | übrige | „{explain} (Code {n}).“ |
| CT | `joinTimeout` | „Zoom hat den Beitritt in 30 s weder bestätigt noch abgelehnt. Netzwerk prüfen und erneut versuchen.“ |
| CJ | Fehler `where:'join'` mit SDK-Code | „Zoom hat den Beitritt nicht angenommen ({name}).“ |

### 8.4 Im Meeting und an Quellen

| ID | Wann | Text |
| --- | --- | --- |
| Q1 | `videoNoPrivilege`, Laden ohne Erlaubnis | „Keine Aufnahme-Erlaubnis — der Host muss sie im Zoom-Client erteilen.“ |
| Q2 | `videoUnknownParticipant` | „Diese Person ist nicht mehr im Meeting.“ |
| Q3 | `videoAlreadySubscribed` | kein Text; das Abbild gleicht sich an |
| Q4 | `videoRendererFailed`, `videoRawRecordingFailed`, `videoSenderFailed`, `videoBufferMismatch` | „Die Quelle ließ sich nicht aufbauen ({name}). Details im Log.“ |
| Q5 | `audioVoipJoinFailed`, `audioHelperMissing`, `audioSubscribeFailed`, `audioBufferMismatch`, Ton `off`/`audioUnavailable` | „Ton nicht verfügbar ({name}) — das Bild läuft ohne Ton. Für einen neuen Versuch entladen und neu laden.“ |
| Q6 | `audioQueueOverflow` (Hinweis) | „Ton: {dropped} Pakete verworfen — dieser PC kommt nicht hinterher.“ |
| Q7 | `ndiInitFailed` | „NDI ließ sich in der Zoom-Bridge nicht starten. Details im Log.“ |
| Q8 | Abo ohne Antwort 10 s | „Keine Antwort der Zoom-Bridge auf „Als Quelle laden“.“ |
| Q9 | 6. Quelle | „Mehr als 5 Zoom-Quellen sind nicht gemessen. Noch einmal klicken, um die {n}. Quelle trotzdem zu laden.“ |
| Q10 | Kollision | „NDI-Name doppelt: Ein Browser-Gast und diese Zoom-Person senden beide als „{ndiName}“. Im Switcher ist nicht sicher, welche Quelle ankommt. Einen der beiden umbenennen.“ |
| Q11 | Doppelname | „Name doppelt im Meeting — nach einem Wiederbeitritt kann Connect diese Quelle nicht von selbst zuordnen.“ |
| Q12 | Fehler `where:'privilege'` | „Zoom hat die Anfrage nach der Aufnahme-Erlaubnis nicht angenommen ({name}). Der Host kann sie im Zoom-Client trotzdem erteilen.“ |
| Q13 | Versatz ungültig, `videoBadDelay` | „Bild-Versatz: erlaubt sind ganze Zahlen von 0 bis 1000 ms.“ |
| Q14 | Ton-Schalter bei geladener Quelle (Tooltip) | „Zum Umschalten erst entladen.“ |
| Q15 | Laden bei Person im Warteraum (Tooltip) | „Erst im Zoom-Client zulassen.“ |

### 8.5 Abriss

| ID | Text |
| --- | --- |
| R1 | siehe Z10/Z11 in 7.2 |
| R2 | „Wiederbeitritt gescheitert ({letzter Grund}). „Erneut beitreten“ versucht es noch einmal.“ |
| R4 | (Hinweis) „Die Zoom-Bridge ist abgestürzt ({detail}). Connect tritt neu bei.“ |
| R5 | (Hinweis) „Wieder im Meeting. {k} Quellen neu geladen, {d} warten auf eine eindeutige Person.“ |
| R6 | „Meeting beendet: {Grund}.“ |
| R7 | „Wiederbeitritt abgebrochen.“ |

### 8.6 Fernsteuerung (Hinweise, Vorsatz „Companion: “)

| ID | Text |
| --- | --- |
| F1 | „kein Anzeigename angegeben.“ |
| F2 | „niemand namens „{name}“ im Meeting.“ |
| F3 | „„{name}“ ist nicht eindeutig ({n} Personen) — bitte in Connect von Hand laden.“ |
| F4 | „Laden nicht möglich — {Grund}.“ — Grund ist „nicht im Meeting“, „keine Aufnahme-Erlaubnis“ oder „die Person ist im Warteraum“ |
| F5 | „keine geladene Quelle „{name}“.“ |
| F6 | „Versatz „{arg}“ ungültig — erlaubt sind ganze Zahlen von 0 bis 1000.“ |
| F7 | „unbekannter Befehl „{verb}“.“ |
| F8 | „{n}. Quelle geladen — mehr als 5 sind nicht gemessen.“ |

### 8.7 Log-Regeln

- Präfixe: `[zoom]` für den Kern, `[zoom-bridge]` für stderr der Bridge (`onLog`).
- Ins Log kommen Zustandswechsel, jede Meldung mit `detail`, jeder Fehler mit `where`, `code`, `name`, jeder Bridge-Rückgabewert und die Dauer jedes Wiederbeitritts-Versuchs.
- **Nie** ins Log: Meeting-Nummer, Kenncode, JWT, Client-Secret. Der Kern meldet einen Beitritt als „Beitritt gestartet (Anzeigename „{name}“)“.
- **Maskierung:** Die Hülle ersetzt in jeder Zeile von `onLog` die aktuell bekannten Werte von Kenncode, Meeting-Nummer und JWT durch `•••`. Der echte native Teil schreibt sie nicht (`native/main.cpp:174-177`, `native/session.cpp:156-196`), die Attrappe aber schon (`test/fake-bridge.mjs:285`). Die Maskierung ist doppelte Absicherung und im Test belegt (12.2, Fall 3).
- Das Log liegt im Connect-Logordner (`<userData>\logs\main.log`, `packages/app-runtime/src/index.ts:132`, `:556`).

---

## 9 · Bedienoberfläche (Zoom-Karte)

Die Karte steht **außerhalb** des `connected`-Zweigs, direkt nach dem Raum-Abschnitt (`App.tsx` nach Zeile 359). Sie erscheint nur bei `window.jmconnect.platform === 'win32'`. Eigene Datei `renderer/src/zoom/ZoomCard.tsx`, damit `App.tsx` nicht weiter wächst.

**Aufbau von oben nach unten** (UI-Texte wörtlich):

1. Titel „Zoom-Meeting“, rechts die Statuszeile aus 7.2 (Kartentext).
2. **Einrichtung** (eingeklappt, sobald beides in Ordnung ist; Knopf „Einrichtung“ klappt auf):
   - „Zoom-SDK: nicht eingerichtet“ bzw. „Zoom-SDK 7.1.5.43953 eingerichtet“ · Knopf „SDK-Ordner wählen …“ bzw. „Neu wählen …“ · bei laufender Kopie ein Fortschrittsbalken.
   - „Zugangsdaten: fehlen“ bzw. „Zugangsdaten: hinterlegt (Client-ID endet auf {4 Zeichen})“ bzw. Text A4 oder A6 · Knöpfe „Datei wählen …“, „Entfernen“.
   - Knopf „Einrichtung prüfen“ (nur in `bereit`).
   - Solange etwas fehlt: „Zoom ist gesperrt, bis SDK-Ordner und Zugangsdaten eingerichtet sind.“
3. **Beitritt** (in `bereit` und `fehler`): Felder „Meeting-Nummer“, „Kenncode“ (Passwortfeld, ohne Autovervollständigung), „Anzeigename in Zoom“ (vorbefüllt) · Knopf „Beitreten“. Nach dem Klick leert der Renderer das Kenncode-Feld.
4. **Laufend** (in `startet` bis `abriss`): Knopf „Meeting verlassen“. Sind Quellen geladen, wird der erste Klick zu „Ja, verlassen ({n} Quellen laufen)“.
5. **Abriss:** Statuszeile mit Countdown, Knopf „Abbrechen“.
6. **Fehler:** Meldung mit Detail · Knöpfe „Erneut beitreten“ (bei `erneutMoeglich`) und „Schließen“.
7. **Bild-Versatz (ms):** Zahlenfeld, darunter „bestätigt: {n} ms“ bzw. „gilt ab dem nächsten Beitritt“.
8. **Teilnehmerliste** (in `im_meeting`, auch in `warteraum` leer mit Hinweis):
   - je Zeile: Name; Kennzeichen „Host“, „Co-Host“, „Kamera aus“, „keine Kamera“, „im Warteraum“, „Name doppelt“ (rot); NDI-Name (Quelle) bzw. grau „wird: {Vorschau}“; Bild- und Ton-Zustand der Quelle; Schalter „Ton“; Knopf „Als Quelle laden“ bzw. „Entladen“; Kollisionswarnung Q10 und Zeilenfehler.
   - Kein Tally, kein Talkback, keine Phasen: Die Gast-Bausteine `PttButton`, `GuestActions` und `PhaseBadge` werden **nicht** wiederverwendet.
9. **Gemerkte Quellen** (Soll-Einträge aus 6.3): „{Name} — wartet auf die Person“ · „{Name} — Name doppelt, bitte von Hand laden“ (rot) · „{Name} — Person weg, Quelle schwarz“ (bei Doppelname rot mit Q11) · Knöpfe „Entladen“ (verwaist) bzw. „Vergessen“ (wartet, doppelname).
10. **Hinweise:** die letzten 5.
11. Fußzeile: „Zoom-Quellen haben kein Tally, kein Talkback und kein Mix-Minus — das sind Grenzen von Zoom.“

---

## 10 · Paketierung und Wächter

### 10.1 Was in den Installer kommt

| Datei im Installer | Quelle beim Packen | Weg |
| --- | --- | --- |
| `resources\zoom-bridge\zoom-bridge.exe` | `packages/zoom-bridge/build/Release/zoom-bridge.exe` | `tools/bundle-zoom-bridge.mjs` |
| `resources\zoom-bridge\*.dll` (VC-Laufzeit) | `VC\Redist\MSVC\<v>\x64\Microsoft.VC14x.CRT` (Suche wie `build-release.mjs:221-253`) | `tools/bundle-zoom-bridge.mjs` |
| `resources\bin\win\Processing.NDI.Lib.x64.dll`, `jm_ndi.node` | wie heute | `tools/bundle-ndi.mjs` |
| **keine** Datei aus `<Zoom-SDK>\x64\bin` | – | Wächter |

Die Bridge-Dateien liegen in einem **eigenen** Unterordner, nicht in `resources\bin\win`. Dort setzt `@jm/ndi` den Ordner vorn auf `PATH` der Gast-Sender (`packages/ndi/index.js:30-53`). Eine fremde VC-Laufzeit dort würde in deren Prozesse geladen.

### 10.2 `tools/bundle-zoom-bridge.mjs`

1. Nicht Windows → Meldung „übersprungen“, Rückgabe 0 (wie `bundle-ndi.mjs:18-21`).
2. `bridgeExeFrisch(pkgDir)`: Die EXE muss existieren und jünger sein als jede Datei in `native\` und `CMakeLists.txt`. Sonst Abbruch mit dem Text aus `build-release.mjs:185-188`.
3. `findeVcLaufzeit()` + Fassung ≥ Linker der EXE. Sonst Abbruch (`build-release.mjs:257-269`).
4. `apps/connect/resources/zoom-bridge/` leeren und füllen.
5. **Wächter 1:** `verboteneZoomDateien('apps/connect/resources', { sdkBin })`. Mit `ZOOM_SDK_DIR` gegen die echte Liste, sonst gegen `SDK_NAMEN_7_1_5`, ohne Groß-/Kleinschreibung. Treffer → Abbruch mit Liste.

`package.json`:
- `"prepackage": "node tools/bundle-ndi.mjs && node tools/bundle-zoom-bridge.mjs"`
- `"dist:dir": "electron-vite build && npm run prepackage && electron-builder --dir"` (behebt 3.1-13)
- `"selftest": "tsx test/zoom-kern.test.ts && tsx test/zoom-laufzeit.test.ts && tsx test/zoom-text.test.ts && tsx test/control-state.test.ts"`

`apps/connect/.gitignore`: zusätzlich `resources/zoom-bridge/`.

### 10.3 Wächter 2: `afterPack`

`electron-builder.yml`: `afterPack: tools/after-pack.cjs`. electron-builder ruft den Haken auf, nachdem `release\win-unpacked` steht und **bevor** der NSIS-Installer entsteht.

```js
// tools/after-pack.cjs
const { existsSync } = require('node:fs');
const { join } = require('node:path');
const { pathToFileURL } = require('node:url');
exports.default = async function afterPack(context) {
  const modul = join(__dirname, '..', '..', '..', 'packages', 'zoom-bridge', 'scripts', 'auslieferung.mjs');
  const { verboteneZoomDateien } = await import(pathToFileURL(modul).href);
  const treffer = verboteneZoomDateien(context.appOutDir, { sdkBin: process.env.ZOOM_SDK_DIR && join(process.env.ZOOM_SDK_DIR, 'x64', 'bin') });
  if (treffer.length) throw new Error(`Zoom-SDK-Dateien im Installer:\n  ${treffer.join('\n  ')}`);
  if (context.electronPlatformName === 'win32' && !existsSync(join(context.appOutDir, 'resources', 'zoom-bridge', 'zoom-bridge.exe'))) {
    throw new Error('zoom-bridge.exe fehlt im Installer (prepackage gelaufen?).');
  }
};
```

Damit prüft derselbe Wächter `resources` **und** das fertige `win-unpacked`, aus **einem** Modul. `build-release.mjs` nutzt dasselbe Modul (keine zweite Liste).

### 10.4 Lizenzlage im Installer

- VC-Laufzeit: von Microsoft als „Distributable Code“ freigegeben (`build-release.mjs:215-216`).
- NDI-DLL: wie heute in Connect 0.1.0. Die offene NDI-Frage §3d gilt suiteweit (`packages/zoom-bridge/README.md:1102-1109`).
- `zoom-bridge.exe`: unser Programm, gebaut gegen Zoom-Header. Es ist im öffentlichen Einzelpaket seit 01.10.2026 draußen. Ob das lizenzrechtlich in Ordnung ist, steht als Owner-Frage in 17.1; Stage 4 blockiert es nach E2 nicht.

---

## 11 · Fernsteuerung (Companion und Rundown)

### 11.1 Capabilities (`packages/suite-control-protocol/src/capabilities.ts`, Rolle `connect`)

```ts
// ── Zoom (Stage 4, #197). Eigene Verben, im Main abgefangen, nie an den DO. Anzeigename statt
// Teilnehmer-ID, weil Zooms IDs nur innerhalb einer Sitzung gelten. Kein Beitritt per Fernsteuerung.
actions: [
  // … wie heute …
  { id: 'zoom_load', label: 'Zoom: Person als Quelle laden', verb: 'zoom_load',
    args: [{ id: 'name', label: 'Anzeigename in Zoom', type: 'string', default: '' }] },
  { id: 'zoom_unload', label: 'Zoom: Quelle entladen', verb: 'zoom_unload',
    args: [{ id: 'name', label: 'Anzeigename in Zoom', type: 'string', default: '' }] },
  { id: 'zoom_delay', label: 'Zoom: Bild-Versatz setzen', verb: 'zoom_delay',
    args: [{ id: 'ms', label: 'Versatz (ms)', type: 'number', default: 0, min: 0, max: 1000 }] },
],
variables: [
  // … wie heute …
  { id: 'zoom_status', label: 'Zoom: Status (einrichtung/bereit/tritt_bei/warteraum/im_meeting/abriss/verlaesst/fehler)' },
  { id: 'zoom_sources', label: 'Zoom: geladene Quellen (Anzahl)' },
  { id: 'zoom_live', label: 'Zoom: mindestens eine Quelle geladen (1/0)' },
  { id: 'zoom_privilege', label: 'Zoom: Aufnahme-Erlaubnis erteilt (1/0)' },
  { id: 'zoom_alarm', label: 'Zoom: Eingriff nötig (1/0)' },
],
feedbacks: [
  // … wie heute …
  { id: 'zoom_live', label: 'Connect: Zoom-Quellen geladen', stateKey: 'zoom_live', match: 'truthy', bgcolor: GREEN, color: WHITE },
  { id: 'zoom_alarm', label: 'Connect: Zoom braucht einen Eingriff', stateKey: 'zoom_alarm', match: 'truthy', bgcolor: RED, color: WHITE },
],
```

### 11.2 Verben im Main

`index.ts`, im `onCommand` des Steuerservers (heute `:97-99`):

```ts
onCommand: (cmd) => {
  if (cmd.verb.startsWith('zoom_')) return zoom.steuerbefehl(cmd);   // nie an den Renderer/DO
  getMainWindow()?.webContents.send(IPC.controlCommand, { verb: cmd.verb, args: cmd.args });
},
```

| Befehl auf der Leitung | Wirkung |
| --- | --- |
| `CONNECT ZOOM_LOAD <Anzeigename …>` | Name = `args.join(' ')`. Genau ein fremder Teilnehmer mit diesem normierten Namen, nicht im Warteraum → laden mit seiner Ton-Vorwahl. Ist er schon geladen → nichts. Sonst F1–F4. Ab der 6. Quelle wird geladen, dazu Hinweis F8. |
| `CONNECT ZOOM_UNLOAD <Anzeigename …>` | Geladene Quelle bzw. Soll-Eintrag mit diesem normierten Namen entladen bzw. vergessen. Keiner → F5. Mehrere geladene mit gleichem Namen → alle entladen (Entladen kann niemanden falsch zeigen). |
| `CONNECT ZOOM_DELAY <ms>` | wie 6.7, sonst F6 |
| `CONNECT ZOOM_<anderes>` | F7 |

Jeder Hinweis geht ins Log und in `abbild.hinweise`. Unter macOS beantwortet die Hülle jedes `zoom_*` mit einer Logzeile und sonst nichts.

### 11.3 STATE mischen

Heute ersetzt jeder Push des Renderers alles (`control-server.ts:51-53`). Neu:

```ts
// control-state.ts (rein, testbar)
export function mischeState(raum: Kv, zoom: Kv): Kv { return { ...raum, ...zoom }; }

// control-server.ts
let raumKv: Kv = { room: '', onair: 0, lobby: 0, guests: 0, talkback: 0 };
let zoomKv: Kv = {};
export function pushControlState(kv: Kv): void { raumKv = kv; senden(); }   // Renderer, wie heute
export function setZoomControlState(kv: Kv): void { zoomKv = kv; senden(); } // Zoom-Hülle
function senden(): void { lastState = { ns: 'connect', kv: mischeState(raumKv, zoomKv) }; server?.pushState(lastState); }
```

Die Hülle ruft `setZoomControlState(kern.stateKv())` bei jeder Änderung eines der fünf Werte, nicht bei jedem Abbild.

### 11.4 Companion-Modul

1. `npm run sync` in `packages/companion-jm-suite` erzeugt `generated/protocol.mjs` neu. Dabei kommt auch die fehlende Aktion `slides` mit (Ergänzung 0.12).
2. Version 0.2.0 in `companion/manifest.json` und `package.json` des Moduls.
3. `npm run selftest` und `npm run build:local` im Modulordner → `pkg.tgz`.
4. Als `jm-suite-companion-0.2.0.tgz` an das Release `connect-v0.2.0` hängen (15).

### 11.5 Rundown

Der Rundown zeigt die neuen Aktionen erst nach seinem nächsten Release (Ergänzung 0.13). Bis dahin steuert er Zoom nicht. Das steht im Handbuch.

---

## 12 · Tests

### 12.1 Bridge-Paket (`npm run selftest -w @jm/zoom-bridge`)

Erweiterung von `test/selftest.ts`:
1. `peInfo` mit erzeugten PE-Puffern: x64 + 7.1.5.43953 → ok; Maschinentyp `0x014c` → x86; ohne Versionsressource → `null`; kein `PE\0\0` → Fehler.
2. `findeSdkBin` für Wurzel, `x64`, `x64\bin`, leeren Ordner (mit eingespeistem `gibtEs`).
3. `explainStatus('failed', 63)` nennt `MEETING_FAIL_UNABLE_TO_JOIN_EXTERNAL_MEETING`, ebenso 64, 82, 503, 504.
4. Attrappe: `FAKE_SDK_FASSUNG` bestimmt `ready.sdkVersion` (Vorgabe bleibt `'7.1.5 (attrappe)'`). `FAKE_DOPPELNAME=1` gibt dem zweiten fremden Teilnehmer ebenfalls den Namen „Anna“. Das Drehbuch `envprobe` (`test/fake-bridge.mjs:86-91`) meldet neben `seen` auch `path: process.env.PATH`.

Neu `test/auslieferung.test.mjs` (Node ohne Typen): `verboteneZoomDateien` findet `sdk.dll` und `SDK.DLL` in einem Unterordner eines Temp-Ordners, findet in einem sauberen Ordner nichts, nutzt mit `sdkBin` die echte Liste. Das `selftest`-Skript ruft es nach `test/selftest.ts` auf.

### 12.2 Connect-Kern (`apps/connect/test/zoom-kern.test.ts`, mit `tsx`)

Aufbau: echte `Bridge` gegen die Attrappe. Die eingespeiste Bridge-Fabrik setzt `exePath: process.execPath`, `exeArgs: [<fake-bridge.mjs>]` und `env: { ...opts.env, FAKE_SCRIPT: 'steuerung', FAKE_LOGDATEI: <temp>, …Stellschrauben je Fall }`. Laufzeit, Zugangsdaten und Einstellungen sind Attrappen im Test. `WIEDERBEITRITT_PLAN_S`, `killTimeoutMs` und `joinTimeoutMs` sind für die Tests verkürzt einspeisbar. Als Kenncode dient eine erfundene Zeichenfolge mit dem Wort `KENNCODE-PROBE`.

| # | Fall | Erwartung |
| --- | --- | --- |
| 1 | Zugangsdaten fehlen | `zoomBeitreten` → B17; Zustand `einrichtung`; STATE `zoom_status=einrichtung` |
| 2 | glatter Beitritt | Befehlsfolge in `FAKE_LOGDATEI`: `init`, `auth`, `videoDelay` mit gespeichertem Wert, dann `join`; Zustand `im_meeting`, Erlaubnis `ja`; Teilnehmer ohne eigene Zeile, Host zuerst |
| 3 | Geheimnisse | Kenncode und Nummer stehen weder im JSON des Abbilds noch in `stateKv()` noch in Kern-Logzeilen; die Echo-Zeile der Attrappe erscheint im Log nur maskiert (`•••`) |
| 4 | Umgebung (Drehbuch `envprobe`, `ENV_PROBE_NAMES` mit den drei `ZOOM_SDK_*`-Namen; die Fabrik fängt das `envprobe`-Ereignis über `onEvent` ab, danach `beenden`) | Mit gesetztem `ZOOM_SDK_CLIENT_SECRET` im Testprozess sieht das Kind keine der drei Variablen; `PATH` des Kindes beginnt mit dem Laufzeit-Ordner und enthält den alten `PATH` |
| 5 | Anmeldung abgelehnt (`FAKE_AUTH_CODE=2`) | B9; **kein** `join` in der Befehlsfolge |
| 6 | DLL-Tod (`FAKE_SOFORT_ENDE=0xC0000135`; `Number()` liest die Hex-Schreibweise) | B3, Text nennt nicht die Zugangsdaten als Ursache. **Nur unter Windows**, sonst als übersprungen gezählt (Linux kürzt Rückgabewerte auf 8 Bit) |
| 7 | SDK-Fassung falsch (`FAKE_SDK_FASSUNG='7.1.6 (99999)'`) | B7; Bridge gestoppt; kein `join` |
| 8 | Fremdkonto (`FAKE_BEITRITT_SCHEITERT=63`), dazu 503, 504, 4 | C63, C500, C500, C4; Zustand `fehler`; **kein** zweiter Bridge-Start |
| 9 | Warteraum (`FAKE_WARTERAUM=1`, `joinTimeoutMs` 500) | nach 1 s noch `warteraum`, kein Fehler |
| 10 | Erlaubnis abgelehnt (`FAKE_PRIVILEGE=nein`) | Z7; Laden → Q1; STATE `zoom_alarm=1`, `zoom_privilege=0` |
| 11 | Laden und Entladen | `videoSubscribe` mit `resolution:'720p'` und `audio` nach Ton-Schalter; Abbild-Quelle mit NDI-Name; STATE `zoom_sources=1`, `zoom_live=1`; nach Entladen 0 |
| 12 | Betriebsgröße (`FAKE_TEILNEHMER=6`) | 5 laden ok; 6. ohne `trotzBetriebsgroesse` → Q9; mit → geladen |
| 13 | Doppelname (`FAKE_DOPPELNAME=1`) | beide Zeilen `doppelname`; `zoom_load Anna` → F3 |
| 14 | Teilnehmer-Wiederbeitritt (`FAKE_WIEDERBEITRITT_MS`) | Quelle wandert zur neuen ID (`reboundByName`); Connect sendet **kein** weiteres `videoSubscribe` |
| 15 | Abriss mit Erfolg (`FAKE_VERBINDUNG_WEG_MS`; Fabrik liefert beim 2. Start eine Attrappe ohne Abriss) | Z10 → Z11 Versuch 1 → `im_meeting`; die zweite Attrappe bekommt `videoSubscribe` für jeden eindeutigen Soll-Namen; Doppelnamen nicht, sie stehen als `doppelname` im Abbild |
| 16 | Abriss ohne Erfolg (Fabrik liefert immer `FAKE_BEITRITT_SCHEITERT=2`) | genau 5 weitere Bridge-Starts, dann `fehler` mit R2; `erneutMoeglich: true` |
| 17 | Abriss trifft endgültigen Code (2. Start: `FAKE_BEITRITT_SCHEITERT=63`) | Folge endet nach diesem Versuch; C63 mit Vorsatz „Wiederbeitritt abgebrochen: “ |
| 18 | Absturz im Meeting (`FAKE_ABSTURZ_MS`) | Wiederbeitritt startet; Hinweis R4 |
| 19 | Meeting-Ende (`FAKE_MEETING_ENDE_MS`) | Zustand `bereit`, R6 mit „vom Gastgeber beendet“; **kein** Wiederbeitritt; Soll-Liste leer |
| 20 | Beenden | `beenden(15000)` mit `FAKE_ABGANG_MS=200` → `quit` in der Befehlsfolge, Ende vor Frist; mit Drehbuch `stuck` und `killTimeoutMs` 300 → Ende per Kill, Logzeile „hart beendet“ |
| 21 | Versatz | 1001 und 1,5 abgelehnt (Q13, nichts gesendet); 250 → `videoDelay`, bestätigt, gespeichert; `zoom_delay 300` wirkt genauso |
| 22 | Fernsteuer-Verben | `zoom_load` mit `['Ben']`; mit `['Anna','Maria']` wird „Anna Maria“ gesucht; `zoom_unload`; leeres Argument → F1; `zoom_xyz` → F7 |
| 23 | Kollision | `gastLabels()` liefert „JM Connect – zoom anna“ → Annas Zeile trägt Q10 |
| 24 | Einrichtung prüfen | kein `join`; Text nennt „7.1.5“ |
| 25 | Wiederbeitritt abbrechen | während der Wartezeit vor Versuch 2 → `fehler` R7, keine weitere Bridge |

### 12.3 Laufzeit (`apps/connect/test/zoom-laufzeit.test.ts`)

Temp-Ordner mit erzeugten PE-Dateien:
1. Ordnerwahl: Wurzel, `x64`, `x64\bin` werden erkannt; leerer Ordner → S1; x86 → S2; Fassung 7.1.6 → S3.
2. Kopie mit Fortschritt: Rückrufe zählen bis zur Gesamtzahl; Stempel mit allen Dateien.
3. Kopierfehler bei Datei 5 (eingespeistes `copyFile` wirft) → S6; `.teil` gelöscht; vorige Einrichtung unverändert.
4. Platz: eingespeistes `statfs` mit zu wenig frei → S5, nichts kopiert.
5. Prüfung vor Start: fehlende SDK-Datei → S9; zusätzliche Datei → in Ordnung.
6. Eigene Dateien: geänderte `zoom-bridge.exe` in den Ressourcen → beim nächsten Start ersetzt, Stempel neu; fehlende Ressource → S8.
7. Kollision: SDK-Ordner enthält `vcruntime140.dll` → S4.
8. Austausch: zweite Einrichtung ersetzt die erste; ein Geschwister-Ordner einer anderen Fassung mit gültigem Stempel wird gelöscht, einer ohne Stempel nicht.

### 12.4 Texte und STATE

- `test/zoom-text.test.ts`: tabellengetrieben, jede Zeile aus 7.2–7.5 wörtlich (7.6).
- `test/control-state.test.ts`: Ein Raum-Push lässt `zoom_*` stehen und umgekehrt.

### 12.5 Gegenprobe

Absichtlich eingebaute Fehler, die je mindestens einen Fall rot machen müssen. Das Ergebnis kommt in den Bericht der Aufgabe.
- `join` wird ohne Warten auf `auth` gesendet → Fall 5 (kein `join` erwartet)
- `envRemove` fehlt → Fall 4
- `PATH` ohne geerbten Wert → Fall 4
- Abgleich ohne 300-ms-Verzögerung oder ohne die Regel „nur Soll ohne Abo“ → Fall 14
- Wiederbeitritt bei `ended` → Fall 19
- Code 63 als vorübergehend eingeordnet → Fall 17
- Doppelname wird automatisch abonniert → Fall 15
- `zoom_privilege` ohne Erlaubnis = 1 → Fall 10 oder 12.4
- Raum-Push ersetzt alles → `control-state.test.ts`
- Maskierung fehlt → Fall 3

### 12.6 CI (`.github/workflows/ci-checks.yml`, Job `selftests`)

Neue Schritte nach den bestehenden (`:45-60`):

```yaml
      - name: Zoom-Bridge (Protokoll, Zustand, Attrappe — ohne SDK)
        run: npm run selftest -w @jm/zoom-bridge
      - name: Connect (Zoom-Kern gegen die Attrappe, Laufzeit, Statustexte)
        run: npm run selftest -w @jm/connect
      - name: Companion-Protokoll aktuell
        run: node scripts/sync-companion-protocol.mjs && git diff --exit-code -- packages/companion-jm-suite/generated/protocol.mjs
```

- Keiner dieser Tests lädt Electron.
- Der Job läuft auf Ubuntu mit Node 22. Die Bridge-Selbsttests sollen laut `README.md:59-69` unter Linux laufen; belegt ist das in CI noch nicht (M14). Scheitern Fälle nur an 32-Bit-Rückgabewerten, bekommen genau diese Fälle einen Windows-Wächter und zählen als übersprungen.
- `esbuild` braucht für den Sync-Schritt sein Plattform-Paket. Fehlt es mit `--ignore-scripts`, kommt vor dem Schritt `npm rebuild esbuild` dazu.
- Typprüfung: Der bestehende Job `typecheck` deckt `@jm/connect` (jetzt mit Tests) und `@jm/zoom-bridge` ab.

---

## 13 · Abnahme (Owner, echte Hardware)

Datei `apps/connect/ABNAHME-0.2.0.md`, je Schritt mit Ergebnisspalte.

**Voraussetzungen:**
- Raum-PC **ohne** VC-Redist: In „Apps“ gibt es kein „Microsoft Visual C++ 2015-2022 Redistributable (x64)“, und der Registrierungsschlüssel `HKLM:\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64` fehlt.
- Zoom-Meeting im **eigenen** Konto der Meeting-SDK-App. Host ist der Owner im Zoom-Client auf einem zweiten Gerät. Dazu fünf Teilnehmer-Geräte; zwei davon für den Doppelnamen-Test.
- Ein **fremdes** Zoom-Konto mit einem Meeting (für Schritt 19).
- Switcher oder NDI-Monitor im selben Netz, Companion mit Modul 0.2.0.
- Ein Proxy-Zugang für Browser-Gäste (Schritt 14).

| # | Schritt | Erwartung |
| --- | --- | --- |
| 1 | Connect 0.2.0 auf dem Raum-PC installieren | Version sichtbar; Zoom-Karte zeigt „nicht eingerichtet“, „Beitreten“ fehlt, Hinweis zur Sperre |
| 2 | SDK-Ordner `x86\bin` wählen | Text S2, nichts kopiert |
| 3 | SDK-Ordner aus der JM-Ablage wählen | Fortschritt; danach „Zoom-SDK 7.1.5.43953 eingerichtet“; Ordner unter `%LOCALAPPDATA%\JM Connect\zoom-laufzeit\` |
| 4 | Zugangsdaten-Datei wählen, danach die Datei umbenennen | „hinterlegt (Client-ID endet auf …)“; bleibt nach Neustart von Connect hinterlegt |
| 5 | „Einrichtung prüfen“ | „Einrichtung in Ordnung: Zoom-SDK 7.1.5 (43953) …“ — **ohne VC-Redist** (M1, erster Teil) |
| 6 | Beitreten mit `<Meeting-Nummer>` und `<Kenncode>`, Anzeigename Vorgabe | Warteraum (falls an), Host lässt zu, Erlaubnis-Anfrage beim Host, nach dem Erteilen „Im Meeting. Personen unten als Quelle laden.“; Tray und Kopfzeile wie 7.2 |
| 7 | Teilnehmerliste ansehen | keine eigene Zeile; Host markiert; Kamera-Zustand stimmt |
| 8 | Fünf Personen laden, bei einer vorher „Ton“ aus | fünf Quellen „JM Connect – Zoom <Name>“ im Switcher mit Bild, vier mit Ton; Tray „● Zoom: 5 Quellen geladen“; Hilfsprogramme laufen **ohne VC-Redist** (M1, zweiter Teil) |
| 9 | Sechste Person laden (falls da) | Warnung Q9, zweiter Klick lädt |
| 10 | Versatz auf den Projekttest-Wert setzen, Connect neu starten | „bestätigt: … ms“; nach Neustart steht der Wert noch im Feld |
| 11 | Eine Person verlässt das Meeting und kommt zurück | Quelle kommt mit gleichem NDI-Namen zurück, ohne Handgriff |
| 12 | Zwei Geräte mit gleichem Namen; Companion `zoom_load` mit diesem Namen | beide Zeilen „Name doppelt“; Companion-Hinweis F3 |
| 13 | Companion: `zoom_unload` und `zoom_load` per Name, Variablen und Feedbacks ansehen | Quelle geht und kommt; `zoom_status`, `zoom_sources` stimmen; `zoom_live` grün |
| 14 | Raum öffnen, zwei Browser-Gäste freigeben, Programm-Rückkanal an; ein Gast heißt „Zoom <Name einer geladenen Person>“ | alle Quellen laufen; Gäste-Zeile im Tray zählt richtig; Kollisionswarnung Q10; CPU- und GPU-Last notieren (M5) |
| 15 | Netzwerkkabel des Raum-PCs 60 s ziehen, dann wieder stecken | Z10, dann Z11 mit Versuchen; danach wieder im Meeting, eindeutige Quellen kommen mit gleichem NDI-Namen zurück, der Switcher verbindet sich selbst; notieren: Zeit bis Bild, musste der Host zulassen oder Erlaubnis neu erteilen (M2) |
| 16 | Fenster schließen | Connect im Tray, Quellen laufen weiter |
| 17 | Tray → Beenden | Connect beendet sich binnen 15 s; im Zoom-Client verschwindet „JM Connect“ sofort; kein `zoom-bridge.exe` im Task-Manager |
| 18 | Connect neu starten, beitreten, dann per Task-Manager hart beenden | notieren, wie lange „JM Connect“ im Zoom-Client stehen bleibt (M3) |
| 19 | Beitritt in das Meeting des fremden Kontos | Text C63 bzw. C500; Code aus dem Log notieren (M9) |
| 20 | 65 min im Meeting mit zwei Quellen bleiben | keine Unterbrechung |
| 21 | Logordner nach dem Kenncode und der Meeting-Nummer durchsuchen | kein Treffer |

---

## 14 · Handbuch `packages/cookbook/content/tool-manuals/tool-jm-connect.md` (neu)

Format wie `tool-jm-caption.md` (Frontmatter mit `id: tool-jm-connect`, `relatedTools: [jm-connect, jm-switcher, jm-rundown]`, `lastReviewed: 2026-10-…`). Muss `npm run cookbook:check` bestehen. Es gibt heute kein Connect-Handbuch, darum deckt es beide Wege ab, den Zoom-Teil ausführlich.

**Inhalt:**
1. **Zutaten:** Windows 10/11 64 Bit; JM Connect über den Launcher; für Zoom: SDK-Ordner 7.1.5.43953 aus der JM-Ablage, Zugangsdaten-Datei der Meeting-SDK-App, ein Meeting **im eigenen Zoom-Konto**, ein Host im Zoom-Client; Steuerport 8737 mit allen Befehlen inklusive `ZOOM_LOAD`, `ZOOM_UNLOAD`, `ZOOM_DELAY` und den STATE-Variablen.
2. **Browser-Gäste (kurz):** Raum öffnen, Link erzeugen, Warteraum, Freigabe, Auf Sendung, Talkback. Nur, was Connect 0.1.0 schon kann.
3. **Zoom einrichten (einmal je PC):** SDK-Ordner wählen (Kopie ~315 MB nach `%LOCALAPPDATA%\JM Connect\zoom-laufzeit`), Zugangsdaten-Datei wählen, „Einrichtung prüfen“.
4. **Vor der Show:** Versatz eintragen (Klatschtest), Kopfhörer bereitlegen, Host absprechen (Warteraum zulassen, Aufnahme-Erlaubnis erteilen).
5. **Während:** Beitreten, Personen laden, Ton-Schalter vor dem Laden, Verhalten bei Abriss (Connect tritt selbst neu bei; Host muss ggf. zulassen und Erlaubnis neu erteilen), Doppelnamen von Hand.
6. **Nach der Show:** Meeting verlassen oder Connect beenden; beides verlässt sauber.
7. **Harte Grenzen** (eigener Abschnitt, hervorgehoben):
   - kein Tally, kein Talkback/IFB, kein Mix-Minus je Zoom-Person — Zoom-Grenze
   - **nur Meetings im eigenen Zoom-Konto** (Zoom-Regel seit 02.03.2026)
   - ohne Aufnahme-Erlaubnis des Hosts keine Quellen
   - höchstens 5 Zoom-Quellen sind gemessen
   - Kopfhörer tragen: Lautsprecher im selben Raum erzeugen Echo
   - kein Mischton, kein Bildschirmton, kein Dolmetscherton, kein Ton zurück nach Zoom
   - keine Bildvorschau in Connect: Bild im Switcher oder NDI-Monitor ansehen
   - Zoom nur unter Windows
   - SDK-Fassung fest: Lehnt Zoom die Fassung ab (B13/C10), hilft nur ein neuer Connect-Release
   - Rundown kennt die Zoom-Aktionen erst ab seinem nächsten Release
8. **Pannenhilfe:** Tabelle Meldung → Ursache → Abhilfe für S1–S9, B1–B16, C4, C8, C63, C500, Q1, Q10, Q11, R2; Logordner.
9. **Checklisten:** Einrichtung, Vor Live, Nach Live.
10. **Deinstallieren:** Der Laufzeit-Ordner bleibt; bei Bedarf `%LOCALAPPDATA%\JM Connect\zoom-laufzeit` von Hand löschen. Das SDK legt `%APPDATA%\ZoomSDK\` an (`packages/zoom-bridge/paket/LIESMICH.txt:21-22`).

Mitzuziehen: `docs/roadmap.md:154` (Lizenz-Entscheid durch E2 ersetzt, Stand), `packages/zoom-bridge/README.md` Abschnitt 9 („Keine Anbindung an `apps/connect`“ ist überholt), `packages/zoom-bridge/package.json` Beschreibung (heute „Stage 1+2“).

---

## 15 · Release

1. **Voraussetzung:** Alle Tests grün (12), Abnahme bestanden (13).
2. **Versionen:**
   - `apps/connect/package.json` → `0.2.0`.
   - `packages/suite-manifest/changelog.json`: Eintrag `connect` 0.2.0, ohne ASCII-Anführungszeichen in den Texten. Vor dem Commit: `node -e "JSON.parse(require('fs').readFileSync('packages/suite-manifest/changelog.json','utf8'))"`.
   - `packages/suite-manifest/suite.json:471`: Beschreibung ergänzen um Zoom (nur Windows); „Windows + macOS“ bleibt für die Gäste.
   - `node scripts/bump-manifest.mjs connect 0.2.0`.
3. **Companion** wie 11.4.
4. **Lokaler Bau** (Windows, `ZOOM_SDK_DIR` und `NDI_SDK_DIR` gesetzt):
   - `npm run rebuild -w @jm/zoom-bridge` (nur, wenn `bridgeExeFrisch` es verlangt)
   - `npm run rebuild:native -w @jm/connect`
   - `npm run dist:win -w @jm/connect` → Wächter 1 und 2 laufen mit
   - Ergebnis: `apps/connect/release/JM Connect-0.2.0-win-x64.exe`
5. **Erst nach Freigabe durch den Owner:** Branch pushen, PR anlegen.
6. **Release vor dem Merge** (Lehre „erst releasen, dann mergen“): Der Katalog kommt aus `main` (`services/release-proxy/worker.js:196`, Vorgabe `MANIFEST_REF || 'main'`). Mit dem Merge sieht der Launcher 0.2.0, also muss das Asset vorher da sein.
   - Vorab prüfen, dass `MANIFEST_REF` im Proxy nicht auf einen festen Stand zeigt.
   - Tag `connect-v0.2.0` **einzeln** pushen. Mehr als drei Tags in einem Push lösen keine Workflows aus; `connect-v` ist in CI ohnehin ausgenommen (`.github/workflows/suite-release.yml:35`).
   - `gh release create connect-v0.2.0 --prerelease --title "JM Connect 0.2.0 (Zoom)" "apps/connect/release/JM Connect-0.2.0-win-x64.exe" "<Kopie von pkg.tgz>/jm-suite-companion-0.2.0.tgz"` (wie 0.1.0 als Pre-Release).
7. **Merge** → Launcher zeigt 0.2.0, Handbuch erscheint im Kochbuch.
8. `zoom-bridge-v0.1.0` bleibt bestehen (F5).

---

## 16 · Offene Messungen (VERMUTET, bis gemessen)

| # | Frage | Wo gemessen |
| --- | --- | --- |
| M1 | Starten `zoom-bridge.exe` **und** Zooms Hilfsprogramme auf einem PC ohne VC-Redist aus dem Laufzeit-Ordner? | Abnahme 5 und 8 |
| M2 | Lässt Zoom eine neue Bridge direkt nach einem Abriss zu? Muss der Host zulassen oder die Erlaubnis neu erteilen? Wie lange bis Bild? Verbindet der Switcher selbst? | Abnahme 15 |
| M3 | Wie lange bleibt „JM Connect“ im Meeting, wenn Connect hart endet? Windows hängt Kindprozesse an ein Job-Objekt mit „beim Schließen töten“; ein `Leave` kommt dann nicht. | Abnahme 18 |
| M4 | Stört ein abgelaufenes JWT ein laufendes Meeting? Unabhängig von Connect: `npm run join -w @jm/zoom-bridge` (Token 1 h) 65 min im Meeting halten. Ergebnis entscheidet, ob 12 h nötig bleiben. | Prüfstand am Entwicklungs-PC |
| M5 | Gemischte Last: 5 Zoom-Quellen + Browser-Gäste + Programm-Rückkanal | Abnahme 14 |
| M6 | `PATH`/`Path` bei Start aus Launcher oder Explorer. Durch das ausdrückliche `PATH` (5.2) entschärft; belegt per Drehbuch `envprobe` (Fall 4) und Abnahme 6. | Test + Abnahme |
| M7 | Blockiert Smart App Control die unsignierte `zoom-bridge.exe` aus `%LOCALAPPDATA%`? | Abnahme 5 (Text B2, falls ja) |
| M8 | Was tut NDI mit zwei gleichnamigen Sendern auf einem PC (Kollision Gast ↔ Zoom)? | Abnahme 14 |
| M9 | Welcher Code kommt beim Fremdkonto tatsächlich (63, 503 oder 504)? | Abnahme 19 |
| M10 | Versatz-Vorgabewert aus dem Projekttest | Owner |
| M11 | Erscheinungs- und Ablaufdatum von SDK 7.1.5 bei Zooms vierteljährlichen Mindestfassungen | Recherche Owner/Zoom-Konto |
| M12 | Kommt SDK-Fehler 14, wenn das Einsatzpaket parallel läuft? | Abnahme, optional |
| M13 | Verträgt sich die Bridge mit einem laufenden Zoom-Workplace-Client auf demselben PC? | Abnahme, optional |
| M14 | Laufen die Bridge-Selbsttests unter Linux in CI? | erster CI-Lauf des PR |
| M15 | Pegel des Zoom-Tons (aus Stage 3 offen) | Projekttest |

---

## 17 · Risiken und Nebenbefunde

### 17.1 Risiken

- **SDK-Lebenszyklus:** Zoom setzt vierteljährlich Mindestfassungen durch. Ist 7.1.5 abgelaufen, tritt Connect keinem Meeting mehr bei (B13/C10). Dann braucht es: Bridge neu bauen, neuen Connect-Release, neuen SDK-Ordner auf jedem Raum-PC. Das SDK ist der „C# Wrapper“, ein Community-Projekt, das Zoom nicht aktiv pflegt (SDK `README.md:1-3`).
- **Lizenz der `zoom-bridge.exe`:** Ob die öffentliche Weitergabe unserer gegen Zoom-Header gebauten EXE erlaubt ist, ist offen. Owner-Frage, blockiert Stage 4 nach E2 nicht.
- **Hartes Ende** bei Absturz oder Task-Kill von Connect: kein `Leave` (M3). Herunterfahren nur „best effort“ (6.6).
- **Unsigniert:** Virenschutz oder Smart App Control können die Bridge blockieren (M7).
- **Platz:** 315 MB je Raum-PC, bleiben nach dem Deinstallieren liegen.
- **Erlaubnis nach Wiederbeitritt:** Muss der Host jedes Mal neu erteilen, dauert die Erholung so lange, wie der Host braucht (M2). Die Karte und `zoom_alarm` zeigen es.
- **Doppelnamen bei Handys** („Samsung SM-…“) sind häufig. Dann gibt es nach einem Abriss Handarbeit, mit Absicht (E5).

### 17.2 Nebenbefunde (Altfehler, nicht Teil von Stage 4 außer wo vermerkt)

1. Die Variable `connected` ist deklariert (`capabilities.ts:604`), wird aber nie gepusht (`App.tsx:68-81`).
2. Die Connect-Feedbacks `onair` und `lobby` hängen an Anzahlen. Companion wertet `truthy` nur bei `'1'` aus (`lib.mjs:55-57`). Bei 2 Gästen auf Sendung bleibt die Taste dunkel.
3. `active_label` und `standby_label` enthalten Namen mit Leerzeichen. Der STATE-Parser trennt sie (`suite-control-protocol/src/index.ts:115`), Companion sieht nur das erste Wort.
4. Tray „Raum schließen“ ist nur bei Gast-Sendern aktiv (`tray.ts:71`), nicht bei offenem Raum ohne Gäste.
5. Tray-Text „Gast/Gäste auf Sendung“ zählt NDI-Sender. **Wird in Stage 4 behoben** (7.3).
6. Companion-Modul ohne `slides`. **Wird in Stage 4 behoben** (11.4) und per CI abgesichert (12.6).

Für 1–4 empfiehlt sich ein eigenes Issue.

---

## 18 · Schnitt 4a/4b (Vorschlag für die Pläne)

Ein Spec, **ein** Release `connect-v0.2.0`, aber zwei Implementierungspläne. Begründung:

1. **Größe:** Der Umfang ergibt rund 24 Aufgaben (Bridge-Paket 4, Connect-Main 8, Oberfläche 3, Paketierung 2, Fernsteuerung und CI 2, Handbuch und Doku 2, Abnahme und Release 3). Zwei Pläne mit je etwa 12 Aufgaben bleiben prüfbar.
2. **Messung vor Logik:** Der Wiederbeitritt (E5) stützt sich auf ungemessenes Verhalten (M2, M3). Ein früher Testlauf mit dem Stand von 4a beantwortet diese Fragen, bevor die Logik dafür steht. Ebenso M1 (VC-Laufzeit, Hilfsprogramme) und M7.
3. **Kein Zwischen-Release:** Die Owner-Entscheidungen gelten für 0.2.0 als Ganzes. 4a endet mit einem internen Bau, nicht mit einem Release.

| Teil | Inhalt | Ende |
| --- | --- | --- |
| **4a · Fundament** | Bridge-Paket (`sdk.ts`, `FAIL_CODES`, `auslieferung.mjs`, Attrappe); Laufzeit-Ordner und Einrichtung; Kern **ohne** automatischen Wiederbeitritt (bei Abriss gleich `fehler` mit „Erneut beitreten“); Hülle, IPC, Oberfläche, Status (Abschnitt 7 vollständig); Beenden; Paketierung mit beiden Wächtern; Tests 12.1, 12.3, 12.4 und 12.2 ohne Fälle 15–18, 22, 25; CI | interner Bau, Owner-Kurztest am echten Meeting: Abnahme 1–8, 10, 16–19 (liefert M1, M3, M7, M9) |
| **4b · Betrieb und Auslieferung** | Abriss und Wiederbeitritt (6.4) samt Fällen 15–18, 25; Fernsteuerung (Abschnitt 11) samt Fall 22 und Companion-Sync; Handbuch und Doku; volle Abnahme (13); Release (15) | `connect-v0.2.0` |

Will der Owner lieber einen einzigen Plan, trägt der Spec auch das. Dann läuft der Kurztest aus 4a als Zwischenschritt vor den Aufgaben zu 6.4.
