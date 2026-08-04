# JM Production Suite — Roadmap

> **Lebendes Dokument.** Aktualisieren, nicht neu bauen. Stand: **2026-08-04**.
> Leitprojekt der nächsten Phase ist die **Zoom-Einbindung (Welle 6.7)**; alles andere läuft
> in vier Parallel-Spuren, die gezielt Zooms Beschaffungs-/Bau-Wartefenster füllen.

**Status-Legende:** ⛔ blockiert/Gate · 🟢 jetzt/aktiv · 🔵 als Nächstes · ⚪ später/geparkt · ✅ erledigt

---

## 1 · Leitprojekt: Zoom-Einbindung (Welle 6.7)

**Issue [#197](https://github.com/AlexmachtCode/alexzvn/issues/197).** Zoom-Einwahldaten eintragen, dann
einzelne Teilnehmer als Gäste/Quellen laden. Owner-Entscheidungen: wir sind **Host** · **Mischton genügt**
(getrennter Ton nimmt das native SDK aber gratis mit) · **in JM Connect bauen** (nicht zukaufen) · **nur Zoom**.

### Architektur (Recherche abgeschlossen — nicht erneut recherchieren)

Zwei Abkürzungen sind tot: **Zoom ISO** (Liminal, nur macOS 14+) und das **Zoom Meeting SDK for Web**
(gibt keinerlei Roh-Medien heraus). Einziger tragfähiger Weg: **natives Zoom Meeting SDK für Windows (C++)**.

- Eigenständige **`zoom-bridge.exe`** (C++-Sidecar), linkt Zoom-SDK **und** NDI-SDK, macht je Teilnehmer
  selbst einen NDI-Sender auf, wird per JSON über stdin/stdout gesteuert. **Frames sehen den JS-Heap nie.**
- „Ein NDI-Sender pro Prozess" ist **kein NDI-Limit** — es kommt aus den Modul-Singletons unseres eigenen
  Addons. In C++ hält ein Prozess beliebig viele `NDIlib_send_create`. Zoom liefert **I420**, und **NDI nimmt
  I420 nativ** → keine Farbraumwandlung.
- Zoom-Teilnehmer sind **keine `Guest`s** → eigene Entität `ZoomParticipant`, die den **Durable Object nicht
  berührt** (Zoom bleibt lokal am Raum-PC). Damit bleibt die **EU-Residenz-Aussage aus 6.6 gültig**.
  `zoom_*`-Verben zweigen in `App.tsx` **vor** dem DO-Mapping ab. Passcode/SDK-Secret gehen nie an den Worker.
- Paketierung: `packages/zoom-bridge/` mit **CMake** + `maybe-build.mjs`-Guard (kein `binding.gyp`, weil
  node-gyp auf `.node`-Ausgabe + Electron-ABI verdrahtet ist). `connect-v` steht schon in der CI-Ausnahmeliste.

### Stages

| Stage | Inhalt | Status |
|---|---|---|
| **0 · Beschaffung + De-Risking-Spike** | **Owner:** private Marketplace-App (Client-ID/Secret) · Windows-Meeting-SDK laden (`ZOOM_SDK_DIR`) · Testmeeting mit Co-Host/„local recording permission" · DLL-Weiterverteilungs-Lizenz klären. **Spike:** minimaler C++-Prototyp bekommt Roh-Video (I420 je User) + Roh-Ton (PCM16 je `node_id`); bestätigt, dass **kein Sonder-Entitlement** nötig ist. Ausweg **VideoCom Bridge** (~199 $), falls der Spike scheitert. | ⛔ **Owner** |
| **1 · Bridge-Gerüst** | `packages/zoom-bridge/` (CMake + `maybe-build.mjs`) · Win32/COM-**Message-Pump** (`utilityProcess` hat keine) · Zoom-SDK-Init + Meeting-Join per JSON. | 🔵 nach Stage 0 |
| **2 · Video → NDI** | `onVideoRawDataReceived` (I420 nativ) → **mehrere NDI-Sender in EINEM Prozess** · Quelle „JM Connect – Zoom: \<Name\>" erscheint ohne Switcher-Änderung. | 🔵 |
| **3 · Ton je Person** | `onOneWayAudioRawDataReceived` (PCM16 je `node_id`) → NDI-Audio je Teilnehmer (bzw. `onMixedAudioRawDataReceived` als Mischton). | 🔵 |
| **4 · Integration + Release** | `ZoomParticipant` in `App.tsx` · Operator-UI (Einwahldaten eintragen, Teilnehmerliste, einzeln als Quelle laden/entladen) · Handbuch mit harten Grenzen · Lizenz-Entscheid: DLLs nachladen (transcribe-Muster) vs. separate Installer-Variante · Release **`connect-v0.2.0`**. | 🔵 |

### Harte Grenzen (gehören ins Handbuch)

Zoom-Teilnehmer bekommen **kein Tally**, **kein privates Talkback/IFB** und **kein Mix-Minus pro Person**
(Zoom-Audio ist EIN gemeinsamer Kanal). Das sind Zoom-Grenzen, keine Designentscheidungen.

**Zeitrahmen ehrlich: mehrwöchiges C++-Vorhaben.** Beginnt auf eigenem Branch von `main`, nachdem Stage 0 steht.

---

## 2 · Parallel-Spuren

Laufen, während Zoom in Stage 0/1–2 hängt. Alle vier sind für diese Phase freigegeben.

### Lane A — Kunden-Features

- **Caption [#204](https://github.com/AlexmachtCode/alexzvn/issues/204):**
  - (a) **Fachwörter-Wörterbuch** für Eigennamen/Fachbegriffe (whisper.cpp Initial-Prompt / Hotwords).
  - (b) **Schnellere Transkription** — heute ~10 s Latenz; kürzeres Chunk-/Fenster-Intervall, Modell-/GPU-Wahl prüfen.
  - Release **`caption-v0.4.0`**.
- **Timer [#11](https://github.com/AlexmachtCode/alexzvn/issues/11):**
  - (a) **xlsx-Beispiel** einladen/generieren, damit das Format klar ist.
  - (b) **iveo-Schnittstelle** (Owner hat Entwicklerkontakt bei my-iveo.de).

### Lane B — Welle-6-Abschluss (vor allem Verifikation, wenig Code)

- Live-Test **Bildschirmfreigabe** im gepackten Build (6.3a — Permission-Handler-Pfad existiert nur im Paket).
- Live-Test **iveo-QR nach App-Neustart** (6.3b — `safeStorage`-Persistenz des Raum-Secrets).
- **Interpreter-Ducking-Live-Test** [#164](https://github.com/AlexmachtCode/alexzvn/issues/164) (VB-Cable + hörbares Ducking) → danach #164 schließen.
- **50-Gäste-Lasttest** (die Gästeobergrenze ist eine Schutzgrenze, kein gemessener Wert).

### Lane C — Security & Betrieb

- **Proxy-Rate-Limit deployen** [#61](https://github.com/AlexmachtCode/alexzvn/issues/61) — Code liegt auf `main` (PR #133); offen ist `wrangler deploy` + `wrangler kv namespace create RATELIMIT`.
- **Token-at-rest** (Launcher-GitHub-Token via `safeStorage`, PR #134) bestätigen/ausliefern.
- **iveo-Prod-URL** scharfschalten (📌 langstehend; Staging-Base bleibt bis dahin).
- *Optional:* **Binär-/Manifest-Signierung (C3)** — braucht Zertifikate/Budget, zurückgestellt.

### Lane D — Switcher physischer Output

- **Decklink/SDI-Ausgang** über natives DeckLink-SDK-Addon (utilityProcess + Addon, ein Sender/Prozess,
  Muster `packages/ndi`). Größerer nativer Brocken, echt nebenläufig zum Zoom-C++-Strang. **Kein Issue → neu anlegen.**
- Kontext: der 2. Bildschirm ist seit `switcher-v0.9.0` erledigt; hier geht es um den **physischen** SDI/HDMI-Out.

---

## 3 · Was läuft wann (Zoom-Wartefenster gezielt füllen)

- **Während Stage 0** (Owner beschafft, Wochen) 🟢 **Jetzt-Block:**
  Lane C (Proxy-Deploy #61, iveo-URL — schnell, nur Worker/CI) · Lane B (Live-Tests) · Caption-Wörterbuch #204.
  Hoher Wert, wartet auf nichts.
- **Während Stage 1–2** (C++-Bau läuft) 🔵:
  Timer #11 · Caption-Speed · Lane D Switcher-Decklink (eigener nativer Strang).
- **Nach Zoom-Release** ⚪: Härtung, dann geparkte Wünsche nach Bedarf.

---

## 4 · Issue-Hygiene (Aufräum-Empfehlung)

- **[#57](https://github.com/AlexmachtCode/alexzvn/issues/57) Optimierung** (Umbrella): P0–P4 im Kern erledigt → **nach Proxy-Deploy schließen**, C3 abtrennen.
- **[#61](https://github.com/AlexmachtCode/alexzvn/issues/61) P3:** nach Proxy-Deploy + Token-at-rest → **schließen**; **C3 Binär-Signierung** als eigenes Issue ausgliedern.
- **[#164](https://github.com/AlexmachtCode/alexzvn/issues/164) Interpreter:** gebaut+released → **nach bestandenem Ducking-Test schließen**.
- **Neu anlegen:** Switcher-Decklink/SDI-Issue (Lane D).
- **[#200](https://github.com/AlexmachtCode/alexzvn/issues/200) App-Designer W3:** bleibt offen, niedrige Prio → geparkt.

---

## 5 · Geparkt / niedrige Priorität

- **App-Designer Welle 3** [#200](https://github.com/AlexmachtCode/alexzvn/issues/200) (Bundle-Optimierung, CSV-Auswertung, Autosave) — ausdrücklich „nach Bedarf".
- **Onboarding-Reste:** D1-Teil-2 (timer/switcher-Primitive auf `@jm/ui`), D2/D3-Reste.
- **C4-c iveo-Speaker-Join** — extern blockiert (iveo-API v1 liefert `program_speakers` nicht).
- **Kochbuch:** Polaris-API-Vertrag (Endpoint + Schema-Steuerung, Owner liefert nach) + cookbook-web-Deploy.
- **Binär-Signierung C3** — Zertifikate/Budget offen.
- **DAW PortAudio-DLL** — Umgebungsproblem (Win-Fehler 126), kein Code-Bug.

---

## Anhang · Ausgeliefert (Baseline, Stand 2026-08-04)

`main` trägt **24 Werkzeuge**. Bereits released:

- **Welle 1–5** — Steuerebene (mDNS/Discovery, `.jmshow`, Health-Dashboard), ATEM/OBS-Bridge, Companion-Gateway (8735).
- **Welle 6 „JM Connect"** (`connect-v0.1.0`) — Green Room (Lobby/Approve/Tally), Rückkanal + Mix-Minus, Talkback-PTT, Gast-Bildschirm als eigene NDI-Quelle, iveo-Provisionierung, Folien-Kopplung an Presenter. EU-Pinning (6.6).
- **JM Interpreter** (`interpreter-v0.1.0`) — Floor/Dolmetscher-Ducking, VB-Cable-Ausgabe (Live-Ducking-Test noch offen → Lane B).
- **JM App Designer** (`app-designer-v0.1.0`) — vier Spieltypen, Editor, Sandbox, Kiosk, Export.
- **Switcher** — NDI-Programmton (`0.8.0`), echtes Full-HD + Zweitbildschirm (`0.9.0`).
- **titler / caption / ndi-screen-capture** — rAF-/Background-Throttle-Fix (`0.x.1`).
- **Onboarding-Roadmap A/B/C/D** — Setup-Automatik, First-Run-Assistent, Szenario-Start, Tool-Manuals (alle 21 Katalog-Tools), Token-Migration, Barrierefreiheit-Modal.
- **Security P0–P4** — Auth+TLS-Transport, sandbox+CSP suite-weit, signierte mDNS, Proxy-Härtung (Deploy offen → Lane C).
- **Kochbuch** — 41 Rezepte, live über Proxy, im Launcher ab `0.5.2`.
