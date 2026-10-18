# Connect · Zoom-Slots (connect-v0.4.0, Companion-Modul 0.3.0)

**Datum:** 17.10.2026, nachgebessert 18.10.2026 · **Status:** Spec zur Prüfung durch den Owner, nachgebessert nach der Spec-Prüfung (91 bestätigte Befunde) und nach der Nachprüfung (acht weitere, W1–W8), dazu eine Restrunde für die zehn kleinen Punkte RR1–RR10 und die Tabellen, ein Restnachfix für den wichtigen Befund N1 aus deren Prüfung und eine fünfte Runde für die kleinen Punkte N2–N9, den Ton-Grund `noShare` und die vier Fragen des Builder-Checks, dazu eine sechste Runde nach deren Nachprüfung (RN1–RN17; alles Abschnitt 21). Grundlage ist der vom Owner am 16./17.10.2026 abschnittsweise freigegebene Entwurf („passt“, Abschnitt 2). **Die Owner-Freigabe dieser Spec umfasst Abschnitt 0 und die Texttabelle (9)**; danach ändert sich ein Text nur mit Owner-OK (E31). Echte offene Punkte stehen in Abschnitt 18; keiner blockiert den Beginn der Umsetzung. Dieser setzt die Owner-Freigabe dieser Spec voraus und liegt nach der Owner-Reihenfolge vom 17.10.2026 erst nach dem iveo-Paket und der Umsetzung der Geführten Anleitungen im Launcher (Abschnitt 2, 13, 20; Sechste Runde RN15).
**Bezug:** Leitprojekt #197; Issues #247 (Bildschirmfreigabe als eigene NDI-Quelle), #227 (aktiver Sprecher), #257 (Quellenmodus je Slot), #258 (Videoeinstellungen), #259 (Ton), #260 (Bedienung und Status), #261 (Slots als einzelne NDI-Ausgänge, Frage nach dem Limit), #262 (Rückkehr auf den Slot). Roadmap `docs/roadmap.md:434-437` („Danach: Zoom-Slots in Connect …“).
**Zielversionen:** Connect **0.4.0** (heute 0.3.0, `apps/connect/package.json:3`) und Companion-Modul **0.3.0** (heute 0.2.0, `packages/companion-jm-suite/package.json:3`, `packages/companion-jm-suite/companion/manifest.json:6`), beide als Pre-Release im Launcher-Katalog, **nach** Launcher 0.16.0 (iveo-Paket).
**Basis:** Worktree `.claude/worktrees/zoom-quellen`, Branch `feat/connect-zoom-slots` = `origin/main` @ `a9553defe7` (Connect 0.3.0, Titler 0.12.0, Launcher 0.15.0); vor dem ersten Plan-Schritt auf das dann aktuelle `main` neu aufzusetzen, die Fundstellen in Dateien, die sich seit `a9553defe7` geändert haben (iveo-Paket, Geführte Anleitungen), neu zu messen (13, 20). Seit dem Stand der Ist-Karten (`5e5b234ec3`) ist `git diff --stat 5e5b234ec3 a9553defe7 -- apps/connect packages/zoom-bridge packages/ndi packages/companion-jm-suite` leer; geändert haben sich nur `packages/app-runtime` und `packages/suite-control-protocol/src/server.ts` (ohne Wirkung auf Zoom, 5.6). Stichproben am 17.10.2026 nachgelesen: `packages/zoom-bridge/native/video.cpp:409`, `:1305-1310`; `apps/connect/src/main/zoom/kern.ts:282-283`; `apps/connect/src/shared/zoom-text.ts:40-45`, `:96-140`, `:196-231`, `:303-317`; `apps/connect/src/renderer/src/App.tsx:365-366`; `apps/connect/src/main/settings.ts:30-75`; `packages/suite-control-protocol/src/capabilities.ts:589-643`; `packages/companion-jm-suite/lib.mjs:28-46`; `packages/companion-jm-suite/main.js:120-150`; `packages/app-runtime/src/csp.ts:34`; `packages/zoom-bridge/src/protocol.ts:601-625`. Seit `5e5b234ec3` verschobene Zeilen sind an `a9553defe7` neu gemessen: `packages/suite-manifest/changelog.json:1651`, `:1660`; `packages/suite-manifest/suite.json:471`; `.github/workflows/ci-checks.yml:79-92`; `docs/roadmap.md:411`, `:434-437`.
**Vorgänger und Formvorlage:** `docs/superpowers/specs/2026-10-02-zoom-stage4-connect-design.md` (Stage 4, Connect 0.2.0 und 0.3.0), im Folgenden **ST4**. Ihre Abschnitte bleiben unverändert; diese Spec hebt dort zwei Nicht-Ziele auf (1, Nicht-Ziele) und ersetzt die Soll-Liste (ST4 6.3) durch die Slots.
**Grundlagen:** freigegebener Entwurf „Zoom-Slots“ vom 17.10.2026 (Owner-Entscheidungen wörtlich in Abschnitt 2), der ältere Entwurf „Zusatzquellen“ vom 15.10.2026 (nur, soweit Entwurf C ihn übernimmt), fünf Ist-Karten (Bridge nativ, SDK, TypeScript/Connect, Doku/Release vom 15.10.2026; Ergänzung „Slots“ vom 17.10.2026). Diese Arbeitsunterlagen liegen nicht im Repo; jede Aussage, die diese Spec aus ihnen übernimmt, steht hier mit eigener Fundstelle.
**Belegform:** Code als `pfad:Zeile` relativ zur Repo-Wurzel. Kurzpfade gelten im jeweiligen Paket: `native/…`, `src/…`, `test/…` (außer `test/selftest.mjs`), `cli/…`, `paket/…`, `CMakeLists.txt` und `README.md` unter `packages/zoom-bridge/`; `main/…`, `shared/…`, `renderer/…`, `preload/…` unter `apps/connect/src/`; `lib.mjs`, `main.js`, `generated/…`, `companion/…`, `test/selftest.mjs` unter `packages/companion-jm-suite/`; `scripts/sync-companion-protocol.mjs` und `scripts/bump-manifest.mjs` an der Wurzel. Ein Dateiname ohne Pfad (`kern.ts:…`, `video.cpp:…`) meint die zuletzt mit Pfad genannte Datei dieses Namens; `:Zeile` allein meint die Datei davor. Neue Dateien sind als „neu“ markiert. SDK als `datei.h:Zeile` unter `<ZOOM_SDK_DIR>\x64\zoom_sdk_c_sharp_wrap\h\`, Fassung 7.1.5.43953 (`rawdata_*.h` und `zoom_rawdata_api.h` unter `rawdata\`, `meeting_*_interface.h` unter `meeting_service_components\`, `customized_*.h` unter `customized_ui\`, alle übrigen direkt in `h\`). NDI als `Processing.NDI.structs.h:Zeile` (NDI 6 SDK). **Annahme** heißt: weder im Code noch im Header belegt und nicht gemessen. **Messpunkt** (MS1 …, Abschnitt 17) heißt: nur im echten Meeting zu klären; jeder Messpunkt hat ein Feld in der Abnahme (12).

**Ziel in einem Satz:** Der Bediener legt in JM Connect frei benannte Zoom-Slots an, jeder eine feste NDI-Quelle, die eine feste Person, den aktiven Sprecher oder die neueste Bildschirmfreigabe zeigt, mit eigener Auflösung, eigenem Ersatzbild und eigenem Ton, mit ehrlichem Zustand, kleiner Vorschau und eingebauten Messwerten, und alles über einen einzigen Zoom-Teilnehmer.

Kurz erklärt, für alle, die Stage 4 nicht kennen:
- **Zoom-Bridge** (`zoom-bridge.exe`): unser C++-Programm. Es tritt mit dem Zoom-Meeting-SDK einem Meeting bei und sendet Zoom-Bilder und -Ton als NDI. JM Connect startet und steuert es über JSON-Zeilen auf stdin und stdout (`packages/zoom-bridge/src/protocol.ts:3-6`).
- **Heute (0.3.0)** gibt es je geladener Person genau eine NDI-Quelle „JM Connect – Zoom ‹Name›“ (`packages/zoom-bridge/native/video.cpp:188-201`). Was geladen ist, merkt sich Connect nur im Arbeitsspeicher (`apps/connect/src/main/zoom/kern.ts:282`).
- **Neu (0.4.0)**: Statt Personen gibt es **Slots**. Ein Slot ist ein Platz mit festem, frei vergebenem NDI-Namen; was er zeigt (eine Person, wer gerade spricht, die Bildschirmfreigabe), lässt sich umschalten, ohne dass die NDI-Quelle im Bildmischer verschwindet. Die Slots sind am Rechner gespeichert und gelten für jedes Meeting.

---

## 0 · Ergänzungen und Abweichungen gegenüber dem Entwurf (bitte bewusst prüfen)

Beim Ausarbeiten zeigten sich Stellen, die der Entwurf offenlässt oder an denen Code oder SDK etwas anderes verlangen. Nur dort ergänzt oder präzisiert diese Spec. Wo eine Annahme des Entwurfs nicht trägt, steht zusätzlich eine Owner-Frage in Abschnitt 18.

| # | Entwurf | Jetzt | Warum |
| --- | --- | --- | --- |
| 0.1 | B.1 „Übergang: Die bisherigen gemerkten Personen-Quellen werden beim Update zu Teilnehmer-Slots“ | Es gibt **nichts zu übernehmen**. Den Übergang tragen stattdessen „Als Slot laden“ in der Teilnehmerliste (legt einen gespeicherten Teilnehmer-Slot an) und `zoom_load` (legt einen **vorübergehenden** Teilnehmer-Slot an, der wie in 0.3.0 nur bis zum Ende des Meetings gilt, 0.25); beide mit dem bisherigen NDI-Namen „JM Connect – Zoom ‹Name›“ (7.2). Owner-Frage **FR1**. | Die Soll-Liste lebt nur im Arbeitsspeicher (`kern.ts:282`), `connect-settings.json` hat kein Feld dafür (`apps/connect/src/main/settings.ts:30-44`). Sie wird bei jedem neuen Beitritt, bei „Verlassen“, „Schließen“, Meeting-Ende, Beenden und einem Mangel der Einrichtung geleert (`kern.ts:1187`, `:1336`, `:837`, `:1217`, `:1811`, `:532`). Nach einem Update ist sie also immer leer. |
| 0.2 | B.1 „Verlässt sie das Meeting und kommt zurück, landet sie von selbst wieder auf ihrem Slot“ | Die Rückkehr erkennt **Connect** am normierten Anzeigenamen und hängt den Slot per `slotSet` um. Die Bridge hängt **nicht mehr selbst** im Rückruf um. Bei doppeltem Namen gibt es keine Rückkehr von selbst, sondern einen Handgriff (E5 aus ST4). | Zoom vergibt beim Wiederbeitritt eine neue Kennung; auch die `persistentId` war gemessen eine andere (`video.cpp:1305-1310`). Heute gibt es zwei Regeln (Bridge exakt, `video.cpp:1320-1334`; Connect normiert, `apps/connect/src/main/zoom/teilnehmer.ts:12-14`) und zwei Rückrufe, die den Renderer direkt anfassen (`packages/zoom-bridge/native/callbacks.cpp:211`, `:225`). Eine Regel an einem Ort beseitigt beides (E6). |
| 0.3 | B.1 „Moduswechsel ohne Neustart (Renderer und NDI-Sender bleiben)“ | Der **NDI-Sender bleibt immer**. Der Renderer bleibt, wenn Zoom das Umhängen auf den neuen Rohdaten-Typ annimmt; sonst legt die Bridge einen neuen Renderer an, ohne den Sender anzufassen (6.10). | Ob ein Renderer zwischen `RAW_DATA_TYPE_VIDEO` und `RAW_DATA_TYPE_SHARE` wechseln darf, steht in keinem Header (`rawdata_renderer_interface.h:47-67`; Messpunkt MS5). Für den Bildmischer zählt der Sender; er gehört der Bridge, nicht Zoom (`packages/zoom-bridge/native/ndi_sender.cpp:44-54`). |
| 0.4 | B.2 „Ersatzbild transparent (Standard)“ | Transparent heißt ein Ersatzbild im NDI-Format **UYVA** mit Alpha 0; Live-Bilder bleiben I420. „Eingefroren“ ohne Kopie des aktuellen Ziels sendet transparent und sagt das (T60, `sent`). | I420 trägt keinen Alphakanal (`ndi_sender.cpp:74-87`); NDI kennt Alpha in UYVA und BGRA (`Processing.NDI.structs.h:67`, `:106`). Ob jeder Empfänger den Formatwechsel je Bild sauber nimmt, ist Messpunkt MS12. |
| 0.5 | C „Freigabe: bei Pause oder unverändertem Bildschirm das letzte Bild halten“ | Ein Freigabe-Slot hält das letzte Bild, **solange eine Freigabe läuft**, unabhängig vom gewählten Ersatzbild. Das Ersatzbild gilt nur, wenn niemand teilt oder bevor das erste Bild kam. | Sonst flackerte bei jedem stehenden Bildschirm nach 200 ms das Ersatzbild auf (Herzschlag `video.cpp:1131-1145`). |
| 0.6 | B.2 „Bei der Bildschirmfreigabe kommt der Computerton dazu, abschaltbar (O4)“ | Ist bei einem Freigabe-Slot Mischton **und** Computerton an, addiert die Bridge beide (6.13). Die Abnahme misst, ob Zooms Mischton den Computerton schon enthält (MS9); dann wäre er doppelt. Owner-Frage **FR4**. | Ein NDI-Sender trägt einen Tonstrom. Mischton und Freigabe-Ton kommen über getrennte Rückrufe (`rawdata_audio_helper_interface.h:16`, `:18`). Ob der Mischton den Freigabe-Ton enthält, sagt kein Header. |
| 0.7 | B.2 „nur der Ton dieser Person (bei Teilnehmer)“ | Steht ein Slot auf Person-Ton und wechselt in einen anderen Modus, sendet er **Stille** und sagt das (T75), statt still auf Mischton zu springen. | Plötzlicher Meeting-Ton auf einem Kanal, der eine Person erwartet, ist auf Sendung schlimmer als Stille. |
| 0.8 | B.2 Ton je Slot, B.4 „Ton an/aus“ per Companion | Ton lässt sich am **laufenden** Slot umschalten. Die Sperre Q14 „Zum Umschalten erst entladen.“ entfällt für Slots. | Heute gilt der Ton-Schalter nur beim Abonnieren (`packages/zoom-bridge/src/protocol.ts:128`; `kern.ts:1621-1626`). In der Bridge ist der Ton aber nur eine Zuordnung je Paket im Herzschlag (`video.cpp:721-727`); sie lässt sich jederzeit ändern. |
| 0.9 | B.1 „Wie viele Slots“ (keine Obergrenze genannt) | Höchstens **16** Slots je Rechner. Owner-Frage **FR3**. | Companion kennt Variablen nur aus einer festen Liste (`packages/companion-jm-suite/main.js:138-140`); Slot-Variablen brauchen eine feste Obergrenze. 16 ist die höchste Zahl aus #261 (VideoCom: 16 Bridges in 360p auf einem Ryzen 9). |
| 0.10 | B.1 „Ab dem 6. eingeschalteten Slot fragt Connect wie heute einmal nach“ | Connect fragt **einmal**, wenn der Bediener die Zahl der eingeschalteten Slots über 5 hebt. Die Zustimmung bleibt am Rechner gespeichert, solange mehr als 5 Slots an sind; so starten auch beim nächsten Beitritt alle von selbst. Companion fragt nie, sondern schaltet ein und meldet die Warnung F8 (wie heute bei `zoom_load`). | Heute braucht jede Quelle über 5 ihren eigenen zweiten Klick, nichts wird gemerkt (`apps/connect/src/renderer/src/zoom/ZoomCard.tsx:233-234`, `:373-377`), und der automatische Abgleich lädt nie mehr als 5 (`kern.ts:1663-1667`). Mit gespeicherten Slots hieße das: Slot 6 startet nie von selbst. |
| 0.11 | C „Ob `zoom_sources` künftig Slots zählt …“ | `zoom_sources` zählt **laufende Slots aller Modi** (NDI-Sender besteht), `zoom_live` = `zoom_sources > 0`. Nur die Beschriftung ändert sich (8.1). | Bestehende Companion-Seiten lesen `zoom_sources` als „Zoom-NDI-Quellen“ (Beschriftung heute „geladene Quellen (Anzahl)“, `capabilities.ts:627`). Zählte es nur Teilnehmer-Slots, liefe ein Sprecher-Slot als Quelle, die die Zahl verschweigt. |
| 0.12 | – | `zoom_alarm` bleibt bei der Tabelle ST4 7.5; „offene“ Slots (o) sind eingeschaltete Slots mit Fehlerstand oder abgelehntem Abo, ohne Antwort, mit ungeklärtem doppeltem Namen, solche, die **in diesem Meeting schon liefen** und jetzt nicht laufen, und Teilnehmer-Slots, die in diesem Meeting **die eingestellte Person schon zeigten** und sie verloren haben (10.1, 7.3 Nr. 7; Fünfte Runde N4). Ein Teilnehmer-Slot, dessen Person in diesem Meeting gar nicht vorkommt, ist **kein** Alarm. | Slots gelten für jedes Meeting (S3). Ein Slot „Anna“ in einem Meeting ohne Anna hielte die Alarm-Taste sonst dauerhaft rot. Die Regeln „schon lief“ und „schon gezeigt“ halten die Bedeutung aus 0.3.0: Ein Soll-Eintrag entstand erst durch Laden in diesem Meeting (`kern.ts:1598`), und ein verwaistes Abo, also eine gegangene Person, zählte als offen (`soll.ts:139-162`, `kern.ts:397-413`). Die erste Fassung ließ den zweiten Teil weg und behauptete trotzdem „bisherige Bedeutung“ (Nachbesserung B12). Owner-Frage **FR7**. |
| 0.13 | B.4 „Variablen ‚wen zeigt der Slot‘“ | Der STATE führt für Slots **Anzeigenamen** (`zoom_slot{n}_target`). Handbuch und Capability-Kommentar „Ohne Namen“ werden berichtigt. | Bisher galt „Die zoom_*-Werte enthalten nie einen Namen“ (`packages/cookbook/content/tool-manuals/tool-jm-connect.md:42`; `capabilities.ts:624`). Technisch trägt der STATE Namen mit Leerzeichen seit 4b (`packages/suite-control-protocol/src/index.ts:105-107`, `:121-124`). B.4 ist freigegeben. |
| 0.14 | B.2 „bei Teilnehmer die Person … Gespeichert am Rechner“ | Teilnehmer-Slots speichern einen **Anzeigenamen** in `connect-settings.json`; vorübergehende Slots (`zoom_load`, 0.25) und Namen aus einer Umbenennung (0.27) werden nie gespeichert. Log und Messwerte bleiben ohne Teilnehmernamen; die Datenschutz-Aussagen der Zoom-Review-Unterlagen werden ein Folgepunkt (FP1). | Bisher lagen Teilnehmernamen bewusst nur im Arbeitsspeicher (`kern.ts:310-311`). |
| 0.15 | B.3 „Messwerte mit Rechenlast je Slot“ | „Rechenlast je Slot“ ist der **Bridge-Anteil** (NDI-Senden einschließlich Kodierung, Kopien, Vorschau) in ms pro Sekunde. Zooms Dekodierung je Slot ist nicht messbar; sie steckt nur in der Last des ganzen Prozesses, die daneben steht (6.17). | Zoom dekodiert im SDK; ein Rückruf je Slot gibt nur das fertige Bild heraus (`rawdata_renderer_interface.h:42`). Eine Zahl misst nur, was sie messen kann. |
| 0.16 | B.4 „Je Slot: an/aus, Modus, Person, Ton“ | Eine Companion-Aktion je Funktion mit dem Argument „Slot (Nr.)“. Umschalten und Feedbacks lösen den Platzhalter `{slot}` in `toggleKey` bzw. `stateKey` auf; das ändert `lib.mjs` und `main.js` im Modul (8.5). | Heute prüft ein Feedback einen festen `stateKey` (`main.js:128-131`), und „Umschalten“ löst über einen festen `toggleKey` auf (`lib.mjs:32-37`). 16 Kopien jeder Aktion wären unbedienbar. |
| 0.17 | – | Ist `connect-settings.json` unlesbar, legt Connect vor dem nächsten Schreiben eine **Sicherungskopie** an und zeigt das (T90). | Heute liefert `read()` dann still `{}` (`settings.ts:54-62`), und das nächste `write()` überschreibt die ganze Datei (`:65-75`). Gespeicherte Slots verschwänden ohne Anzeige. |
| 0.18 | – | Ein neuer Video-Lauscher meldet Kamera an/aus je Person (`videoStatus`). | „Teilnehmer ohne Kamera zeigen“ braucht einen aktuellen Kamera-Zustand. Heute kommt er nur mit `roster`/`joined` (`callbacks.cpp:192-193`), ein Lauscher für `onUserVideoStatusChange` fehlt (`meeting_video_interface.h:219`). Damit kann auch das Kennzeichen „Kamera aus“ in der Teilnehmerliste heute veralten (`ZoomCard.tsx:390-391`). |
| 0.19 | B.5 „Entscheidungslogik ohne Zoom geprüft“ | Die Entscheidungslogik liegt header-only in `native/slot_logic.h` und `native/audio_mix.h` und läuft **auch in der CI** (direkter `g++`-Aufruf ohne CMake), dazu lokal als CMake-Ziel. | `delay-test` braucht ein mit beiden SDKs konfiguriertes `build/` und läuft nicht in der CI (`packages/zoom-bridge/CMakeLists.txt:14-43`, `:71-72`; `.github/workflows/ci-checks.yml:79-80`). Eine Logik ohne SDK-Typen braucht keins von beiden. |
| 0.20 | – | Die Bridge-Befehle `videoSubscribe`/`videoUnsubscribe` entfallen; Konsolen-Steuerung und Prüfstände ziehen auf die Slot-Befehle um. Das Einsatzpaket `zoom-bridge-v0.1.0` bleibt unverändert. | C verlangt, dass die Personen-Verwaltung in der Slot-Verwaltung aufgeht. Zwei Verwaltungen nebeneinander hießen zwei Abbau-Wege und zwei Namensregeln. |
| 0.21 | C „Vorschau-Weg … offen für die Spec“ | Kanal stdout (eine JSON-Zeile je Bild, Base64), Verkleinern im Bild-Rückruf ohne Warten, Kodieren in einem eigenen Vorschau-Thread, Ersatzbilder malt Connect selbst, Vorschau ohne Bild-Versatz, aus bei verborgenem oder minimiertem Fenster. Begründungen in E14–E17. | – |
| 0.22 | B.1 „NDI-Namen, den der Bediener frei vergibt“ | Regeln: 1 bis 60 Zeichen, kein Doppelpunkt, eindeutig unter den Slots (ohne Groß-/Kleinschreibung); änderbar nur bei ausgeschaltetem Slot. Vorgabe neuer Slots „Zoom ‹Nr›“. | NDI macht aus `:` ein Leerzeichen (`video.cpp:182-187`); zwei gleichnamige Sender auf einem Rechner sind ungemessen (ST4 M8). Der Name eines Senders steht ab dem Öffnen fest (`video.cpp:178-180`). |
| 0.23 | C „Messwerte … alles auch im Connect-Log“, B.3 „Messwerte kopieren“ | Messwerte im Log und in der Kopie nennen Slots nur mit **Nummer und Modus**, nie NDI-Name oder Person. | Keine Teilnehmernamen im Log (ST4 N4b.2); keine echten Namen in Abnahme-Dateien (`apps/connect/ABNAHME-0.3.0.md:9`). Ein NDI-Name kann einen Personennamen enthalten. |
| 0.24 | B.7 „nach Launcher 0.16.0“ | Der Tag `connect-v0.4.0` löst den Mac-Bau aus, den das iveo-Paket einführt (`.github/workflows/connect-mac.yml`, iveo-Spec 10.1). Die Release-Reihenfolge berücksichtigt das (13). | iveo-Spec `docs/superpowers/specs/2026-10-16-iveo-paket-design.md` (Branch `feat/iveo-paket`, noch nicht auf `main`), E36–E38 und Abschnitt 10.1; den Workflow gibt es erst mit dem iveo-Paket. |
| 0.25 | B.1, B.4 „Die bestehenden Companion-Befehle zum Laden und Entladen einer Person funktionieren weiter.“ | `zoom_load` legt einen **vorübergehenden** Slot an: nie gespeichert, gelöscht von `zoom_unload` und zu denselben Zeitpunkten wie die Soll-Liste in 0.3.0; an der Kachel „Behalten“ (7.2, 8.3). Nachbesserung B1. Trifft `zoom_load` einen ausgeschalteten **dauerhaften** Slot dieses Namens, schaltet es ihn nur für dieses Meeting ein (`anNurMeeting`, 7.2; Restrunde RR7, Owner-Frage **FR10**). | In 0.3.0 galt `zoom_load` nur bis Meeting-Ende (`kern.ts:1187`, `:1217`). Dauerhafte Slots hätten sich über Shows angesammelt (F14 nach 16 Namen), in jedem späteren Meeting von selbst gestartet und per Companion die Zustimmung über 5 gesetzt. |
| 0.26 | B.2 „Ton … oder aus. Bei der Bildschirmfreigabe kommt der Computerton dazu, abschaltbar“, B.4 „Ton an/aus“ | Feste Abbildung der Ton-Schalter auf die Bridge (7.1). In der Karte bleiben Meeting-Ton und Computerton getrennt; „Companion: Ton aus“ schaltet beides ab, `zoom_slot{n}_audio` rechnet den Computerton ein. Owner-Frage **FR6**. Nachbesserung B2, B57. | Die erste Fassung ließ den Computerton bei „Ton aus“ hinausgehen (6.13 „sonst direkt“), während Variable und Feedback „aus“ meldeten. |
| 0.27 | B.1 „Rückkehr“ (Umbenennung nicht genannt) | Benennt sich die gezeigte Person um, gilt der neue Name nur für dieses Meeting (`personJetzt`, 7.3 Nr. 6); die gespeicherte Person bleibt. Nachbesserung B8. | Die erste Fassung überschrieb die gespeicherte Person dauerhaft; ein Name aus einem Meeting hätte in jeder künftigen Show gegolten. |
| 0.28 | B.2 „Teilnehmer ohne Kamera zeigen an/aus“ (keine Vorgabe) | Vorgabe **an**. Nachbesserung B8. | „aus“ ließe den Slot bei der vorigen Person stehen, während jemand anderes spricht; „an“ zeigt ehrlich das Ersatzbild (T27). Ob das Vorgabe-Signal Personen ohne Kamera überhaupt meldet, misst D3 (MS7). |
| 0.29 | B.1 „landet sie von selbst wieder auf ihrem Slot“ | Rückkehr nur auf eine Person, die **nach** dem Weggang beitrat und den Namen als Einzige trägt; der Warteraum zählt wie in 0.3.0 mit; nach einer Handwahl übernimmt kein Namensvetter den Slot (7.3 Nr. 5). Nachbesserung B11. | Owner-Regel „lieber ein Handgriff als die falsche Person auf Sendung“ (`video.cpp:1311-1319`); die erste Fassung sprang nach dem Weggang der gewählten „Anna“ auf die zweite. |
| 0.30 | B.8 „nur so vorbereiten, dass es ohne Umbau dazukommt“ | Jeder Slot führt eine **Abo-Liste** (in 0.4.0 genau ein Eintrag) mit dem Ziel-Stand je Abo (Restrunde RR10), und der Bildweg läuft über den Slot statt direkt vom Delegate zum Sender (6.1). Nachbesserung B6. | Die Galerie braucht je Kachel einen Renderer (`rawdata_renderer_interface.h:22-26`, `:57`); mit genau einem Renderer und direktem Bildweg (`video.cpp:1575`) hätte 0.5.0 Slot, Umhängen und Abbau-Ketten umbauen müssen. Bitte bewusst prüfen: Das ist ein Strukturentscheid, den 0.4.0 bezahlt. |
| 0.31 | B.3 Beispiel „Kamera aus · Ersatzbild transparent“ | „Kamera aus“ nur, wenn **Zoom** für das Ziel die Kamera als aus meldet (`videoStatus`, `IsVideoOn()`); ein bloßer Bildausfall heißt `noFrames` mit eigenem Text (T19b, T27b, T29e). Nachbesserung B52, B31. | Heute setzt der Herzschlag nach 200 ms ohne Bild `cameraOff` (`video.cpp:1190-1192`); `RawData_Off` ist undokumentiert und kam gemessen auch ohne ausgeschaltete Kamera (`video.cpp:45-51`). |
| 0.32 | – | Neuer Slot-Zustand **„geplant“** (SZ11): eingeschaltet, im Meeting, Erlaubnis da, der nächste Abgleich startet ihn (10.1). Nachbesserung B14. | Ohne ihn hatte dieser Zustand keine Zeile im Kreuzprodukt. |
| 0.33 | C „Abbau: alle Slots in denselben Abbau-Ketten“ | Dazu eine **Renderer-Sperre** ab `DISCONNECTING`/`RECONNECTING` bis `INMEETING` oder `ENDED`/`FAILED` (6.5). Nachbesserung B34. Was eine Kette während der Sperre abbaut, geht in eine **Halteliste** und wird erst nach der Sperre abgemeldet; `slotOn` lehnt die Bridge solange ab (6.15; Nachfix W2). | Im Slot-Modell lösen auch Freigabe-Ende und Sprecherwechsel `unSubscribe` aus; der gemessene Absturz war `unSubscribe` an einem schon abgeräumten Renderer (`README.md:779-788`). |
| 0.34 | C „Sprecher“ | Eine **Sprecher-Erinnerung** je Bridge belegt jeden neuen Sprecher-Slot vor (6.8). Nachbesserung B16. | Die Rückrufe melden nur Wechsel, einen Getter gibt es nicht (`meeting_video_interface.h:234-243`, `:423-740`); ein frisch eingeschalteter Slot hätte bis zum nächsten Wechsel nichts gezeigt. |
| 0.35 | C „Freigabe-Ton … Mischton“ | Der Mischer folgt der **Wanduhr** und füllt fehlenden Ton mit Stille auf, statt zu warten (6.13). Nachbesserung B17. | Die erste Fassung hielt 60 ms zurück, während der Stille-Herzschlag schon nach 40 ms Stille einfügte (`video.cpp:1020-1035`): mehr Ton als Echtzeit, wachsende Verzögerung, ohne Anzeige. |
| 0.36 | C „Texttabelle geht vor dem Release zur Owner-Freigabe“ | Die Texttabelle (9) wird **mit dieser Spec** freigegeben, zusammen mit Abschnitt 0. Danach ändert sich ein Text nur mit Owner-OK, als eigener Punkt im Plan; vor dem Release sieht der Owner die Texte nur noch im Abnahme-Bau (E31). | Die Texttests halten jede Zeile wörtlich fest (11.6); eine Freigabe erst kurz vor dem Release hieße eine zweite Testrunde für alle Texte (Builder-Check, Frage 1). Die frühere Freigabe erfüllt „vor dem Release“. |

---

## 1 · Ziel und Nicht-Ziele

### Ziel

1. **Slots statt Personen:** Der Bediener legt bis zu 16 Slots an, je mit festem, frei benanntem NDI-Namen. Jeder Slot erscheint im JM Switcher wie ein Browser-Gast als eigene Quelle.
2. **Drei Modi, umschaltbar ohne Neustart:** Teilnehmer (feste Person, Rückkehr nach Verlassen), Aktiver Sprecher, Bildschirmfreigabe (neueste Freigabe). Beim Umschalten bleibt der NDI-Sender bestehen.
3. **Je Slot einstellbar:** Auflösung 360p, 720p oder 1080p mit ehrlicher Anzeige des Gelieferten; Ersatzbild transparent, eingefroren, schwarz oder weiß; Ton Mischton, Person oder aus, bei Freigabe zusätzlich Computerton; bei Sprecher „Teilnehmer ohne Kamera zeigen“.
4. **Ein Zoom-Teilnehmer für alle Slots:** Der Host lässt einmal zu und erteilt einmal die Aufnahme-Erlaubnis.
5. **Am Rechner gespeichert:** Slots und Vorgaben gelten für jedes Meeting und jede Show; eingeschaltete Slots starten beim Beitritt von selbst, sobald die Erlaubnis da ist.
6. **Ehrliche Anzeige:** Kachel je Slot mit Zustand in Klartext, gemessener Auflösung und Bildrate, Ton, Vorschau mit etwa 2 Bildern/s; aufklappbare Messwerte mit Rechenlast je Slot; Kopfzeile, Tray und Companion stimmen in jedem Zustand (Abschnitt 10).
7. **Companion je Slot** mit Modul 0.3.0; alle bisherigen Befehle bleiben.
8. **Abnahme mit Lasttest** 1, 3, 5, 7, 9 Slots je in 720p und 1080p; Auslieferung als Pre-Release vor der Abnahme.

### Nicht-Ziele

- **Galerie, Dolmetscher-Ton, fps-Wahl, QoS-Werte, eigenes Standbild/Logo** (0.5.0, B.8). Diese Spec bereitet sie nur vor (15).
- **Keine Anmeldung im Launcher.** Die Karten „Cloud-Zugang“ und „Zoom-Zugang“ bleiben wie in 0.3.0 (B.9; die Spec der Anmeldung `docs/superpowers/specs/2026-10-17-launcher-anmeldung-design.md` liegt auf dem Branch `docs/launcher-anmeldung`, Commit `9e26da0e88`, und ist am Stand `a9553defe7` noch nicht auf `main`).
- **Kein UX-Umbau von Connect** (Welle 2). 0.4.0 bleibt im heutigen Stil, neue Bausteine werden als eigene Komponenten geschnitten (7.5).
- **Kein Zoom unter macOS.** Die Bridge ist Windows-only (`packages/zoom-bridge/CMakeLists.txt:7-9`); die Mac-Oberfläche sagt, dass es Slots nur unter Windows gibt (7.11).
- **Kein zweiter Zoom-Teilnehmer**, kein zweiter Bridge-Prozess.
- **Keine Slots in der `.jmshow`** (S3).
- **Keine Zoom-DLLs in einem Paket** (ToU §6.1, ST4 E2).
- **Kein Halten des NDI-Senders über Entzug, Meeting-Ende oder Wiederbeitritt mit neuer Bridge.** Die Abbau-Ketten bleiben (C, 6.15); Folgepunkt FP4.
- **Kein Filtern später Bilder nach dem Umhängen** über `GetSourceID()`; 0.4.0 zählt sie nur (6.10, FP5). Bilder, die **während** des Umhängens kommen, verwirft der Riegel (6.10).
- **Reine Ton-Freigaben** (Computerton ohne Bild) zählen nicht als Freigabe und werden nicht geroutet (6.9, FP6).
- **Kein Neubau des Einsatzpakets** `zoom-bridge-v0.1.0` (`packages/zoom-bridge/README.md:914-1143`).
- **Aufgehoben aus ST4:** das Nicht-Ziel „Keine Vorschau der Zoom-Bilder in Connect“ (ST4 Abschnitt 1, Zeile 65) für laufende Slots (O8), und „Kein Mischton, kein Bildschirmton“ (ST4 Zeile 67). Dolmetscherton und Ton zurück nach Zoom bleiben ausgeschlossen.

---

## 2 · Owner-Entscheidungen (wörtlich aus dem freigegebenen Entwurf)

| # | Datum | Frage | Antwort des Owners |
| --- | --- | --- | --- |
| S1 | 16.10. | Wie nehmen wir #257–#262 auf? | **Slot-Modell in zwei Stufen.** 0.4.0: Slots mit den Modi Teilnehmer (mit Rückkehr nach Abbruch), Aktiver Sprecher, Bildschirmfreigabe; je Slot frei wählbarer NDI-Name, Auflösung bis 1080p, Ersatzbild (transparent, eingefroren, schwarz, weiß), Ton (Mischton oder Person), Status mit fps, Vorschau und Messwerte. 0.5.0: Galerie (selbst zusammengesetzt), Dolmetscher-Ton, fps-Wahl 25/50/60, QoS-Werte, Logo als Ersatzbild. |
| S2 | 17.10. | Grundmodell (Abschnitt B.1) | „passt“ |
| S3 | 17.10. | Slots in der Show oder am Rechner? | „die slots sollten einfach generell verfügbar sein“ → **am Rechner**, für jedes Meeting und jede Show. |
| S4 | 17.10. | Einstellungen, Anzeige, Companion (B.2–B.4) | „passt“ |
| S5 | 17.10. | Tests, Abnahme, Auslieferung (B.5–B.7) | „passt“ |
| O2 | 15.10. | Nur live Messbares | **Komplett bauen, Messung eingebaut**: vorsichtige Vorgaben, Messwerte sichtbar in Connect und im Log, der erste Live-Test über den Launcher liefert die Zahlen, ein Folge-Release passt Vorgaben an. Gilt weiter. |
| O3 | 15.10. | Freigabe-Quelle | **Folgt automatisch** der neuesten Freigabe (egal von wem); teilen mehrere, die neueste; endet sie, zurück auf eine noch laufende. Gilt weiter für den Modus Bildschirmfreigabe. |
| O4 | 15.10. | Computerton der Freigabe | **Ja, abschaltbar**, in derselben NDI-Quelle. Gilt weiter. |
| O7 | 15.10. | Companion | **Ja**, neues Modul mit dem Connect-Release. Gilt weiter, Umfang nach B.4. |
| O8 | 15.10. | Vorschau | **Ja, für laufende Slots**, etwa 192×108, rund 2 Bilder/s, stark komprimiert, abschaltbar; nicht für Personen ohne Slot. Gilt weiter (Weg siehe C). |
| — | 15.10. | Release | Connect 0.4.0 und Companion-Modul 0.3.0 als **Pre-Release in den Launcher-Katalog**, bewusst vor der Abnahme; was die Messung zeigt, korrigiert ein 0.4.1. Gilt weiter. |

Überholt durch das Slot-Modell (wörtlich): „O1 (zwei feste Plätze), O5 (Ton des Sprechers fest Mischton → jetzt je Slot wählbar), O6 (Freigabe und Sprecher zählen nicht zur Betriebsgröße → jetzt zählt jeder Slot, siehe B.1).“

Nicht aus dem Entwurf, später vom Owner festgelegt (17.10.2026, Reihenfolge der Vorhaben, verbindlich): iveo-Paket (Launcher 0.16.0, Titler 0.12.1) → Geführte Anleitungen im Launcher (Umsetzung) → Connect 0.4.0 Zoom-Slots (Umsetzung) → Launcher-Anmeldung → UX-Welle 1. Für die Umsetzung überholt das den Satz aus B.7 „Connect 0.4.0 entsteht parallel“; die Folgen stehen in 13 und 20 (Fünfte Runde, Builder-Check Frage 2). Nicht in dieser Reihenfolge stehen FP1 und FP2 der iveo-Spec (NDI auf dem Mac, Anzeige von NDI-Ausfällen), die der Owner am selben Tag „als nächster Connect-Schritt“ bestätigt hat; wohin sie gehören, fragt FR13 (Sechste Runde RN3).

Die Abschnitte B.1–B.9 und C des freigegebenen Entwurfs sind in diese Spec eingearbeitet; die Zuordnung steht in der folgenden Tabelle. Jede Zeile des Entwurfs hat eine Stelle.

| Entwurf | Inhalt | hier |
| --- | --- | --- |
| B.1 | Ein Slot, fester NDI-Name, Modi, Moduswechsel ohne Neustart, ein Zoom-Teilnehmer, wie viele Slots, Übergang | 3, 6.1, 6.7–6.10, 7.3, 7.4, 7.2, E1–E6 |
| B.2 | Je Slot: Name, Modus, Person, Start-Taste, Auflösung, Ersatzbild, Ton, Computerton, ohne Kamera, Vorgaben, gespeichert | 6.11–6.13, 7.1, 7.2, 7.6, E7–E12 |
| B.3 | Kachel, Vorschau, Messwerte | 7.5, 7.7, 7.8, 6.16, 6.17 |
| B.4 | Companion je Slot, Variablen, Feedbacks, Modul 0.3.0, alte Befehle | 8 |
| B.5 | Tests ohne Meeting, Kreuzprodukt, Gegenprobe | 10, 11 |
| B.6 | Abnahme mit Lasttest, Gegenprobe der bisherigen Funktionen | 12 |
| B.7 | Pre-Release, 0.4.1, nach Launcher 0.16.0, Mac ohne Zoom | 13, 7.11 |
| B.8 | 0.5.0 nur vorbereiten | 15 |
| B.9 | Abgrenzung Anmeldung, UX-Welle 2 | 1 (Nicht-Ziele), 7.5 |
| C | Ansatz N Slots, Lauscher, Sprecher, Freigabe, Abbau, Messwerte, Vorschau-Weg, Statuszeilen, Texte, Doku, SDK-Belege | 6, 7.7, 10, 9, 14, 5.3 |

---

## 3 · Begriffe

| Begriff | Bedeutung |
| --- | --- |
| **Slot** | Ein Platz mit Nummer (1 bis 16, fest, 7.1) und festem NDI-Namen, am Rechner gespeichert. Läuft er, besitzt die Bridge für ihn genau einen NDI-Sender und eine Abo-Liste, in 0.4.0 mit genau einem Abo (Zoom-Renderer, 6.1). |
| **Vorübergehender Slot** | Ein Teilnehmer-Slot, den `zoom_load` angelegt hat: nie gespeichert, gilt bis zum Ende des Meetings, `zoom_unload` löscht ihn (7.2). |
| **Nummer** | Die Slot-Nummer. Sie wird beim Anlegen vergeben (kleinste freie) und ändert sich nie; Companion und Bridge sprechen den Slot nur über sie an. |
| **Modus** | Was der Slot zeigt: **Teilnehmer** (eine gewählte Person), **Aktiver Sprecher** (wer gerade spricht) oder **Bildschirmfreigabe** (die neueste Freigabe). In der Bridge `participant`, `speaker`, `share`. |
| **Ziel** | Was der Slot gerade abonniert: eine Teilnehmer-Kennung (Teilnehmer, Sprecher) oder eine Freigabe-Kennung (`shareSourceID`, Freigabe), oder nichts (0). Das Ziel wechselt, der Sender bleibt. |
| **Start-Taste** | Ob der Slot eingeschaltet ist (`an`). Eingeschaltete Slots startet Connect, sobald Connect im Meeting ist und die Aufnahme-Erlaubnis hat. |
| **Laufender Slot** | Ein Slot, dessen NDI-Sender in der aktiven Bridge besteht (Slot-Zustände SZ4, SZ5, SZ6, SZ9 in 10.1). Ihre Zahl ist n. |
| **Ersatzbild** | Was der Sender schickt, wenn Zoom kein Bild liefert: **transparent** (Vorgabe), **eingefroren** (letztes Bild), **schwarz**, **weiß**. |
| **Halten** | Ein Freigabe-Slot wiederholt das letzte Bild, solange die gezeigte Freigabe läuft, aber kein neues Bild kommt (Pause, stehender Bildschirm). Halten ist kein Ersatzbild. |
| **Tonart** | Mischton (`mix`, Ton des ganzen Meetings) oder Person (`person`, nur der Ton der gezeigten Person, nur im Modus Teilnehmer). Dazu der Schalter Ton an/aus. |
| **Computerton** | Der Freigabe-Ton der teilenden Person (`onShareAudioRawDataReceived`, `rawdata_audio_helper_interface.h:18`); nur im Modus Bildschirmfreigabe, eigener Schalter. |
| **Sprecher-Signal** | Welcher Zoom-Rückruf den Sprecher-Slot steuert: `onActiveSpeakerVideoUserChanged` (Vorgabe), `onActiveVideoUserChanged` oder `onUserActiveAudioChange` (`meeting_video_interface.h:237`, `:243`; `meeting_audio_interface.h:122`). |
| **Haltezeit** | Wie lange ein neuer Sprecher ununterbrochen Kandidat sein muss, bevor der Slot umspringt; 0 bis 5 s, Vorgabe 1 s. |
| **Sprecher-Erinnerung** | Das zuletzt gemeldete Ergebnis jedes Sprecher-Signals, eine je Bridge; belegt jeden neuen Sprecher-Slot vor (6.8). |
| **Riegel** | Bild- und Status-Rückrufe eines Abos werden verworfen, solange es umgehängt wird oder nicht abonniert ist (6.10). |
| **Renderer-Sperre** | Ab `DISCONNECTING`/`RECONNECTING` ruft die Bridge keine Renderer-Funktion, bis `INMEETING` oder das Meeting-Ende kommt (6.5). |
| **Halteliste** | Slots, die eine Abbau-Kette während der Renderer-Sperre abbaute: ohne Sender, ohne Ereignisse, ohne Nummer, aber mit Renderer-Zeiger und Delegate, bis die Sperre fällt (6.15; Nachfix W2). |
| **Vorgaben** | Auflösung und Ton an/aus, mit denen neue Slots angelegt werden (B.2). |
| **Rückkehr** | Eine Person verlässt das Meeting und kommt wieder (neue Kennung); ihr Teilnehmer-Slot zeigt sie wieder, ohne Handgriff, wenn ihr normierter Name eindeutig ist. |
| **Normierter Name** | Wie in ST4 Abschnitt 4: NFC, `trim`, Leerraum zu einem Leerzeichen, klein (`de`) (`teilnehmer.ts:12-14`). |
| **Offener Slot** | Ein eingeschalteter Slot, der einen Eingriff braucht, in diesem Meeting schon lief und jetzt nicht läuft oder als Teilnehmer-Slot die eingestellte Person, die er in diesem Meeting schon zeigte, verloren hat (0.12, 7.3 Nr. 7, 10.1). Ihre Zahl ist o. |
| **Vorschau** | Kleines JPEG je laufendem Slot, etwa zweimal pro Sekunde, nur in Connect (O8). |
| **Bridge-Anteil** | Gemessene Zeit, die die Bridge selbst je Slot verbraucht (NDI-Senden samt Kodierung, Kopien, Vorschau), in ms je Sekunde (0.15). |
| **Betriebsgröße** | 5 gleichzeitige Zoom-Quellen sind funktional gemessen (`packages/zoom-bridge/README.md:190`); ihre Last ist ungemessen (`apps/connect/ABNAHME-0.3.0.md:114`). Ab dem 6. eingeschalteten Slot fragt Connect nach (E4). |
| **Generation** | Wie ST4 6.9: jede Bridge hat eine Nummer; Ereignisse alter Generationen räumen nur ab (`kern.ts:1058-1074`, `:1083-1087`). |

---

## 4 · Entscheidungen dieser Spec

Die Spec entscheidet hier, was der Entwurf offenlässt oder nur als Richtung vorgibt. Jede Entscheidung nennt Begründung und Beleg; die Ausführung steht im genannten Abschnitt.

| # | Entscheidung | Begründung und Beleg | siehe |
| --- | --- | --- | --- |
| E1 | **Die Slot-Verwaltung ersetzt die Personen-Verwaltung, Schlüssel ist die Slot-Nummer.** Bridge: `g_slots` (`std::map<int, std::unique_ptr<Slot>>`) statt `g_subs` nach Teilnehmer-Kennung. Connect: `slots: Map<number, SlotIntern>` nach Slot-Nummer statt `quellen` nach Abo-Kennung; die Soll-Liste entfällt. | C verlangt, dass die Personen-Verwaltung in der Slot-Verwaltung aufgeht. Heute schlüsseln 25 Stellen nach Teilnehmer-Kennung (Liste 5.8), angefangen bei `packages/zoom-bridge/native/video.cpp:20-21` und `apps/connect/src/main/zoom/kern.ts:283`. Eine Kennung gilt nur je Sitzung (`packages/zoom-bridge/src/protocol.ts:22-33`); ein Slot gilt immer. | 6.1, 7.1 |
| E2 | **Höchstens 16 Slots, Nummern 1 bis 16, fest.** Die kleinste freie Nummer wird beim Anlegen vergeben und ändert sich nie; Löschen gibt sie frei. | Companion braucht eine feste Zahl Slot-Variablen (`packages/companion-jm-suite/main.js:138-140`). 16 = höchste Zahl in #261. Owner-Frage FR3. | 6.1, 8 |
| E3 | **Ein Sender je laufendem Slot; er überlebt jeden Wechsel innerhalb des Slots.** Moduswechsel, Zielwechsel, Rückkehr, Sprecher- und Freigabe-Wechsel, Auflösung, Ton und Ersatzbild ändern den Sender nie. Der Renderer bleibt, wenn `subscribe` auf dem neuen Typ gelingt; sonst wird nur er neu angelegt (Zähler `rendererNew`). Meldet das SDK `onRendererBeDestroyed`, fasst die Bridge den Renderer nie mehr an und legt beim nächsten Umhängen einen neuen mit neuem Delegate an (Zähler `rendererLost`, B32). Nur `slotOff` und die Abbau-Ketten schließen den Sender. | B.1 „Renderer und NDI-Sender bleiben, nur das Ziel wechselt“. Das Umhängen per `unSubscribe` + `subscribe` auf demselben Renderer ist für VIDEO gemessen (`video.cpp:1370-1376`); für VIDEO↔SHARE nicht (MS5). Der Sender ist unabhängig vom Renderer (`packages/zoom-bridge/native/ndi_sender.cpp:44-54`). | 6.10 |
| E4 | **Nachfrage ab dem 6. eingeschalteten Slot: einmal, dann am Rechner gemerkt.** Hebt der Bediener die Zahl der eingeschalteten Slots von 5 auf 6 oder mehr, fragt Connect einmal (T40). „Trotzdem einschalten“ speichert `zoomSlotsUeber5: true`; sinkt die Zahl wieder auf höchstens 5, verfällt die Zustimmung. Mit Zustimmung startet der Abgleich alle eingeschalteten Slots. Companion schaltet ohne Frage ein, mit Warnung F8 und gesetzter Zustimmung. | B.1 „fragt Connect wie heute einmal nach“. Gespeicherte Slots würden sonst bei jedem Beitritt an der Grenze hängen bleiben (heute `kern.ts:1663-1667`, `apps/connect/src/shared/zoom-text.ts:463`). Companion kann keinen Dialog beantworten (heute F8, `kern.ts:1740-1742`). | 7.4 |
| E5 | **Wer das Ziel bestimmt:** Teilnehmer-Slot → **Connect** (Name → Kennung, Doppelname, Warteraum) und sendet die Kennung; Sprecher- und Freigabe-Slot → **Bridge** (Rückrufe, Haltezeit, neueste Freigabe). | Connect hat die Namensregeln samt Tests (`apps/connect/src/main/zoom/soll.ts`, `teilnehmer.ts:12-14`, `:84`). Sprecher und Freigabe hängen an schnellen SDK-Signalen; ein Umweg über Connect kostete je Wechsel eine Leitungsrunde und brächte Connect die Haltezeit. | 6.7–6.9, 7.3 |
| E6 | **Rückkehr erkennt Connect über den normierten Namen; die Bridge hängt nicht mehr selbst um.** `onUserJoin`/`onUserLeft` melden nur noch (`joined`/`left`) und setzen Merker; die Bridge baut beim Weggang das Abo ab (in der Hauptschleife). Connect findet die zurückgekehrte Person im Abgleich (300 ms, `apps/connect/src/main/zoom/fristen.ts:6-14`) und schickt `slotSet {slot, id}`; zurückkehren kann nur, wer nach dem Weggang beitrat und den Namen als Einziger trägt (7.3 Nr. 5, B11). Benennt sich die gezeigte Person um, gilt der neue Name für dieses Meeting, damit eine spätere Rückkehr wieder trifft; die gespeicherte Person bleibt (7.3 Nr. 6, B8). Doppelname: kein Umhängen, Handgriff (ST4 E5). | `persistentId` beim Wiederbeitritt gemessen verschieden (`video.cpp:1305-1310`, `packages/zoom-bridge/README.md:191`); heute zwei verschiedene Namensregeln (`video.cpp:1320-1334` exakt gegen `teilnehmer.ts:12-14` normiert) und Renderer-Aufrufe im Rückruf (`callbacks.cpp:211`, `:225` → `video.cpp:1217-1219`, `:1375-1376`). Die Lehre „Rückrufe setzen nur Merker“ (`packages/zoom-bridge/README.md:777-864`, §8) gilt damit auch hier. Der Name im heutigen `Sub` folgt keiner Umbenennung (`video.cpp:379`, `:1440`). | 6.7, 7.3 |
| E7 | **Auflösung je Slot 360p, 720p, 1080p; Vorgabe neuer Slots 720p; ehrliche Anzeige, keine automatische Herabstufung.** Die Bridge setzt `setRawDataResolution` vor **jedem** `subscribe` und meldet den Rückgabewert; die gelieferte Größe und die Bildrate misst sie je Bild und meldet sie alle 2 s. Connect zeigt „{gewünscht} gewünscht · Zoom liefert {B}×{H}“, wenn die kürzere Seite unter der Stufe liegt (Regel 10.7). | Das Enum reicht bis 1080P (`rawdata_renderer_interface.h:12-20`), `setRawDataResolution` ist undokumentiert (`:50`), heute ungeprüft (`video.cpp:409`) und beim Umhängen nicht neu gesetzt (`video.cpp:1375-1376`); die gelieferte Größe je Abo steht am Bild (`zoom_sdk_raw_data_def.h:213`, `:219`), heute erhoben, aber nie gemeldet (`video.cpp:110-111`, `:217-226`). Hinweise auf HD-Grenzen stehen beim Custom-UI-Container (`customized_video_container.h:192-201`); dazu gibt es Quellen mit offener Bedeutung (`GetUserVideoSize`, HD-Einstellungen, `recvResolution`), die als Messwerte mitlaufen (5.3-3, 6.11, MS24; B40). Owner-Frage FR2. | 6.11 |
| E8 | **Ersatzbilder:** transparent = UYVA mit Alpha 0; schwarz = I420 Y 16, U/V 128 (wie heute); weiß = I420 Y 235, U/V 128; eingefroren = Kopie des letzten Bildes des aktuellen Ziels, ohne sie transparent (B53). Größe = letzte gelieferte, sonst Nenngröße der Auflösung; Takt höchstens alle 100 ms wie der heutige Schwarz-Herzschlag; Beginn 200 ms nach dem letzten Bild wie heute. | Schwarz heute `ndi_sender.cpp:66-72`, `:131-140`, Herzschlag `video.cpp:1131-1145`; Alpha nur in UYVA/BGRA (`Processing.NDI.structs.h:67`, `:106`); `@jm/ndi` empfängt `BGRX_BGRA` (`packages/ndi/src/addon.cc:180`), Alpha kommt also im JM Switcher an (ob er es mischt: MS12). | 6.12 |
| E9 | **Halten bei der Freigabe:** Solange die gezeigte Freigabe läuft (auch pausiert), wiederholt der Slot nach 200 ms ohne Bild die Kopie des letzten Bildes **dieser** Freigabe höchstens alle 200 ms; der Zustand „gehalten“ folgt erst nach 2 s und nur mit einer solchen Kopie (6.9; B46, B53, B66). Freigabe-Slots kopieren dazu jedes Bild. | C; ohne Kopie gibt es kein letztes Bild, Zooms Puffer geht bei Versatz 0 ohne Kopie hinaus (`ndi_sender.cpp:112-118`). Eine Kopie je Bild statt einer gedrosselten verhindert, dass nach einem Folienwechsel ein älteres Bild gehalten wird. | 6.12 |
| E10 | **Ton:** Ein Ton-Abo für alle Slots (wie heute); die Zuordnung je Paket im Herzschlag nach Art (Person, Mischton, Freigabe) und Slot; jederzeit umschaltbar. Person-Ton nur im Modus Teilnehmer, sonst Stille mit Hinweis. Mischton plus Computerton werden in der Bridge addiert, mit eigener Uhr (6.13). Ton-Warteschlange von 256 auf 512 Pakete. | Ein Abo liefert Mischton, Person- und Freigabe-Ton (`rawdata_audio_helper_interface.h:16-18`, `:77`), den Dolmetscher-Ton nur mit `bWithInterpreters = true` (`:73-74`), den die Bridge nicht setzt (`audio.h:55-57`; B42); heute nur Person-Ton umgesetzt, Misch- und Freigabe-Ton leer (`packages/zoom-bridge/native/audio.cpp:91-92`); Zuordnung `video.cpp:721-727`; Warteschlange auf 5 Sprecher gerechnet (`audio.cpp:24-51`). Owner-Frage FR4. | 6.13 |
| E11 | **Bild-Versatz** (ein Wert für alle, wie heute) gilt für Teilnehmer- und Sprecher-Slots, **nicht** für Freigabe-Slots. Ein Moduswechsel von oder zur Freigabe leert die Versatz-Warteschlange des Senders. | C; Versatz global `ndi_sender.cpp:15`, gelesen `:111`, `:147`, `:176`; Vertrag „EIN Wert für ALLE Zoom-Quellen“ `protocol.ts:130-133`. Speicher je Slot bei 1080p und 1000 ms rund 94 MB (30 Bilder × 3,1 MB; Rechnung wie `packages/zoom-bridge/README.md:734-739`); er steht in den Messwerten. | 6.14 |
| E12 | **Speicherung am Rechner** in `connect-settings.json`: `zoomSlots`, `zoomSlotVorgaben`, `zoomSprecher`, `zoomVorschau`, `zoomSlotsUeber5`, `zoomSlotsFassung`. Unlesbare Datei → Sicherungskopie vor dem nächsten Schreiben und Hinweis T90. Scheitert das Schreiben, gelten die Werte nur für diese Sitzung (gelb, Muster Versatz). | S3, B.2. Heute stilles `{}` und Überschreiben (`apps/connect/src/main/settings.ts:54-75`); Muster „nur für diese Sitzung“ `settings.ts:251-269`, `kern.ts:823-830`, `zoom-text.ts:536-540`. | 7.2 |
| E13 | **Übergang ohne Datenübernahme.** Was den Übergang trägt: „Als Slot laden“ in der Teilnehmerliste legt einen gespeicherten, `zoom_load` einen vorübergehenden Teilnehmer-Slot an (0.25), beide mit NDI-Name „JM Connect – Zoom ‹Name›“ nach der Übergangs-Namensregel (7.2: „:“ wird ein Leerzeichen wie bei NDI, `video.cpp:182-187`, Leerraum bleibt sonst unverändert wie in 0.3.0, Nachfix W4; höchstens 60 Zeichen; bei Kollision mit irgendeinem Slot „ (2)“ usw.), und schalten ihn ein. Bisherige Mischer-Eingänge mit diesen Namen funktionieren damit weiter, solange kein anderer Slot dieser Person unter einem anderen Namen besteht und der Anzeigename höchstens 42 Zeichen hat (B79). | 0.1. Owner-Frage FR1. | 7.2 |
| E14 | **Vorschau-Kanal: stdout**, eine JSON-Zeile `preview` je Bild mit Base64-JPEG. Kein zweiter Kanal. | Bei 16 Slots × 2 Bilder/s × rund 8 KB JPEG (**Annahme** AN7 für 192×108, Qualität 0,5), mit Base64 rund 10,7 KB je Zeile, sind das rund 340 KB/s (B21); der Zeilenleser hat keine Längengrenze (`packages/zoom-bridge/src/protocol.ts:601-610`); `emitRaw` schreibt eine Zeile mit einem `fwrite` und ist schon heute vom SDK-Thread aus in Gebrauch (`packages/zoom-bridge/native/emit.cpp:5-25`). Ein zweiter Kanal (benannte Pipe, Datei, Socket) brächte Lebenslauf und Fehlerwege dazu. Ob Steuerereignisse spürbar warten, misst MS15. | 6.16 |
| E15 | **Vorschau-Thread:** Der Bild-Rückruf verkleinert höchstens alle 500 ms je Slot ein Bild per Punktauswahl in einen kleinen BGR-Puffer (`try_lock`, nie warten); ein eigener Vorschau-Thread kodiert mit WIC als JPEG und schreibt die Zeile. COM wird dort als MTA eingerichtet. | Der Bild-Rückruf läuft auf dem SDK-Thread (`video.cpp:76-78`) und darf nicht blockieren; WIC braucht COM, und welches Apartment das SDK auf dem Hauptthread nutzt, ist unbekannt (**Annahme**: ein eigener Thread vermeidet den Konflikt). WIC ist Teil von Windows (keine neue Abhängigkeit, C); nötig sind nur `windowscodecs.lib` und `ole32.lib` (`packages/zoom-bridge/CMakeLists.txt:58`). | 6.16 |
| E16 | **Vorschau zeigt nur echte Zoom-Bilder, ohne Bild-Versatz.** Ersatzbilder und Halten malt Connect selbst (Schachbrett für transparent, Schwarz, Weiß, letzte Vorschau dieses Ziels mit Kennzeichen „eingefroren“ bzw. „gehalten“), nach dem, was die Bridge tatsächlich sendet (`sent`, 6.12; B54). | Connect kennt aus `sent` und dem Zustand, was jeder Slot sendet; ein Vorschaubild eines Ersatzbildes kostete Kodierzeit ohne Information. Das versetzte Bild abzugreifen hieße, in die Versatz-Warteschlange einzugreifen (`packages/zoom-bridge/native/delay_line.h:91-147`). Die Kachel sagt es (T52). | 6.16, 7.7 |
| E17 | **Vorschau-Takt:** aus, wenn der Schalter „Vorschau“ aus ist oder das Connect-Fenster verborgen oder minimiert ist (Befehl `previewMode {on:false}`). | Fenster schließen versteckt nur ins Tray (ST4 3.1-3); niemand sieht dann die Vorschau. | 6.16, 7.7 |
| E18 | **Messwerte:** je Slot alle 2 s `slotStats` (Größe, Bildrate, Ersatzbilder/s, Bridge-Anteil, Vorschau-Anteil, Kopier-Anteil, Speicher, Auflösungs-Rückgabe, fremde Bilder, zu häufige Aufrufe, neue Renderer, Lücke beim letzten Wechsel, Ton je Art); prozessweit alle 2 s `bridgeStats` (CPU des Prozesses und des Systems, Arbeitsspeicher, Ton-Warteschlange); jedes Sprecher-Signal als `speakerSignal`. Connect zeigt sie und schreibt je Slot jede Minute und bei jedem Zustandswechsel eine Logzeile ohne Namen. | B.3, C, O2. Heute zählt niemand eine Bildrate (`video.cpp:33-176`, keine Felder). | 6.17, 7.8 |
| E19 | **Sprecher:** Vorgabe Signal `onActiveSpeakerVideoUserChanged`, Haltezeit 1 s, beides in Connect einstellbar. Kennung 0 und der eigene Bridge-Teilnehmer werden nie Kandidat. Bei `onUserActiveAudioChange` ist der Kandidat die erste Kennung der Liste, die nicht die eigene ist. Ein Slot ohne Ziel springt ohne Haltezeit. Eine Sprecher-Erinnerung je Bridge belegt jeden neuen Sprecher-Slot vor (B16). „Teilnehmer ohne Kamera zeigen“ aus: Kandidaten ohne Kamera werden übersprungen. | C; Doku beider Video-Rückrufe wortgleich (`meeting_video_interface.h:235`, `:241`); die Ton-Aktivität ist eine Liste ohne Reihenfolge-Aussage (`meeting_audio_interface.h:119-122`); einen Getter „aktueller Sprecher“ gibt es nicht (`meeting_video_interface.h:415-741`). | 6.8 |
| E20 | **Freigabe:** Liste der Freigaben aus `onSharingStatus` (Kennung, Person, Zustand, Typ, Reihenfolge des Beginns), beim Ankommen geleert und aus `GetViewableSharingUserList`/`GetSharingSourceInfoList` gefüllt, beim Einschalten nur ergänzt, soweit Zoom antwortet (B38); der Typ-Nachtrag `onShareContentNotification` ändert nur Typ und Kennung (B37). Gezeigt wird die zuletzt begonnene, nicht reine Ton-Freigabe; endet sie, die nächstjüngere. Alle Freigabe-Slots zeigen dieselbe Freigabe. Verlässt eine Person das Meeting, gelten ihre Freigaben als beendet. | O3; `meeting_sharing_interface.h:43-84`, `:166`, `:433`, `:442` (im Custom-UI-Modus an die nicht vorhandene `SetUserID` gebunden, `:440`); Pause nur als Zustand (`zoom_sdk_def.h:582-584`). | 6.9 |
| E21 | **Neue Lauscher setzen nur Merker.** `IMeetingShareCtrlEvent` (9 Methoden), `IMeetingVideoCtrlEvent` (12), `IMeetingAudioCtrlEvent` (5) kopieren ihre Werte in Warteschlangen unter Sperre und kehren zurück; die Hauptschleife arbeitet sie nach `pumpOnce()` ab. Auch die Arbeit nach `INMEETING` läuft über einen Merker; im Rückruf bleiben nur `SetEvent`, `emitRoster()` und `checkPrivilege()` wie heute (B33). Rückrufe mit Handler (`onMultiShareSwitchToSingleShareNeedConfirm`, `onHostRequestStartVideo`, `onCameraControlRequestReceived`, `onHostRequestStartAudio`) bleiben leer und schreiben nur eine Logzeile; insbesondere nie `Confirm()` (das stoppte alle Freigaben, `meeting_sharing_interface.h:144`). | README §8 (`packages/zoom-bridge/README.md:777-864`), Muster `g_meetingEndeOffen`/`g_entzugAbbauOffen` (`callbacks.cpp:14-23`). Methodenzahlen und fehlende `#if WIN32` in den drei Klassen: `meeting_sharing_interface.h:153-214`, `meeting_video_interface.h:208-290`, `meeting_audio_interface.h:108-143`. Ob die Rückrufe auf dem Hauptthread kommen, sagt kein Header; die Warteschlangen machen das gleichgültig. | 6.5, 6.6 |
| E22 | **`videoSubscribe`/`videoUnsubscribe` entfallen**; `cli/steuerung.mjs` und die Prüfstände `test/command-probe.mjs`, `test/bool-probe.mjs`, `test/video-limit.mjs`, `test/video-stress.mjs` ziehen auf `slotOn`/`slotOff` um. | 0.20; Prüfstände lesen heute die Zeile „Befehl gelesen: videoSubscribe …“ (`packages/zoom-bridge/native/main.cpp:246-247`). | 6.18 |
| E23 | **`zoom_sources` = laufende Slots aller Modi; `zoom_alarm` mit o nach 0.12.** | 0.11, 0.12; Tabelle ST4 7.5 bleibt. | 8.2, 10.4 |
| E24 | **Namen im STATE** nur in `zoom_slot{n}_target`, nur solange der Slot die Person tatsächlich zeigt. | B.4; 0.13. | 8.2 |
| E25 | **Companion:** vier neue Aktionen mit Argument „Slot (Nr.)“, sieben Variablen je Slot, drei Feedbacks mit Slot-Auswahl, Platzhalter `{slot}`; neue Fernsteuer-Hinweise F9–F14. | B.4; 0.16. | 8 |
| E26 | **NDI-Namen:** 1 bis 60 Zeichen (Code-Punkte, in Connect wie in der Bridge; B26), keine Steuerzeichen, kein `:`, eindeutig unter den Slots nach NFC ohne Groß-/Kleinschreibung (Muster `gleicherNdiName`, `teilnehmer.ts:29-31`); Gleichheit mit einem Browser-Gast ist nur eine Warnung (wie Q10). Änderbar nur bei ausgeschaltetem Slot. Die Bridge hängt **kein** „ (2)“ mehr an, sondern lehnt einen belegten Namen ab (`slotNameTaken`). | 0.22; Gast-Namen heute höchstens 40 Zeichen, gefiltert (ST4 3.1-15); Name fest ab Öffnen (`video.cpp:178-180`). | 6.2, 7.5 |
| E27 | **Logiktests in der CI:** `native/slot_logic_test.cpp`, `native/audio_mix_test.cpp` und das bestehende `native/delay_line_test.cpp` laufen über `packages/zoom-bridge/scripts/logik-test.mjs` (Compiler direkt, ohne CMake) im CI-Job `selftests`; lokal zusätzlich als CMake-Ziele. | 0.19; die drei Prüfprogramme brauchen keine SDK-Header (`packages/zoom-bridge/native/delay_line.h:19-22`; CMake-Ziel ohne Includes `CMakeLists.txt:71-72`). | 11.1 |
| E28 | **Release-Reihenfolge wie bei 0.3.0 gelebt:** Merge → Tag auf dem Merge-Commit → Release (Pre-Release) → Katalog-Bump; frühestens nach Launcher 0.16.0. | Notes, Katalog und Handbuch liest der Proxy aus `main` (`services/release-proxy/worker.js:211-259`, `services/release-proxy/wrangler.toml:55`); der Tag startet den Mac-Bau des iveo-Pakets. Gelebte Folge bei 0.3.0: Merge `2df1f79357`, Tag darauf, Bump `f118fcd215`. | 13 |
| E29 | **Die Teilnehmerliste bleibt**, mit „Als Slot laden“ statt „Als Quelle laden“ und ohne eigenen Ton-Schalter je Zeile; „Gemerkte Quellen“ entfällt, an ihre Stelle tritt der Abschnitt „Zoom-Slots“. | B.2 „Person per Namenssuche oder Auswahlliste“; B.9 „heutiger Stil“. Liste heute `ZoomCard.tsx:380-446`, `:792-801`. | 7.5 |
| E30 | **Mac:** Statt der Zoom-Karte steht unter macOS eine Zeile „Zoom-Slots gibt es nur unter Windows.“ (T95). Die `zoom_*`-Schlüssel fehlen im STATE weiter ganz. | B.7; Karte heute nur unter Windows eingehängt (`App.tsx:365-366`); STATE ohne Zoom unter macOS (`zoom-text.ts:303-306`). | 7.11 |
| E31 | **Freigabe und Texte:** Die Owner-Freigabe dieser Spec umfasst Abschnitt 0 und die Texttabelle (9); der Plan schreibt die Texttests (11.6) gegen diese Fassung. Textänderungen nach der Freigabe nur mit Owner-OK, je als eigener Punkt im Plan (samt Test). Vor dem Release prüft der Owner die Texte nur noch im Abnahme-Bau, also im lokalen Bau aus 13 Nr. 6, der als Pre-Release erscheint und nach 12 abgenommen wird. | Builder-Check, Frage 1: Auf Abschnitt 0 stehen die ersten und teuersten Teile des Plans (0.30 Abo-Liste und Bildweg, 0.20 Wegfall von `videoSubscribe`, 0.2 Rückkehr in Connect, 0.25 vorübergehende Slots, 0.9 höchstens 16 Slots); kippt einer später, heißt das Umbau statt Nacharbeit. `zoom-text.test.ts` hält jede Zeile von 9 wörtlich fest, samt dem Kreuzprodukt aus 10.5 (11.6); eine Freigabe erst vor dem Release (Entwurf C) hieße eine zweite Testrunde für alle Texte. Die frühere Freigabe erfüllt „vor dem Release“ (0.36). | 0, 9, 11.6, 13 Nr. 1, Nr. 6 |

---

## 5 · Ausgangslage am Code (Ist an `a9553defe7`)

### 5.1 Bridge, nativer Teil (`packages/zoom-bridge/native/`)

| # | Tatsache | Fundstelle |
| --- | --- | --- |
| 1 | Jedes Abo ist ein `Sub` in `g_subs`, Schlüssel Teilnehmer-Kennung; nur der Hauptthread verändert die Karte. | `video.cpp:20-21`, `:33-176`, `:686-691` |
| 2 | `Sub` hat keine Felder für Bildrate, Bildzähler oder die Lücke zwischen Abo und erstem Bild; gelieferte Größe steht in `lastW/lastH`, wird aber nicht gemeldet. | `video.cpp:110-111`, `:217-226` |
| 3 | `videoSubscribe` prüft in fester Folge (schon abonniert, Erlaubnis, Teilnehmer, NDI, `StartRawRecording`, Sender, Renderer), setzt `setRawDataResolution` einmal und ungeprüft und abonniert `RAW_DATA_TYPE_VIDEO`. | `video.cpp:321-459`, `:409-410` |
| 4 | NDI-Name „JM Connect – Zoom “ + Anzeigename, eindeutig nur gegen die eigenen Abos, Zusatz „ (2)“; fest ab dem Öffnen; NDI ersetzt `:` durch Leerzeichen. | `video.cpp:178-201` |
| 5 | Herzschlag: 200 ms ohne Bild → Schwarz höchstens alle 100 ms in letzter Größe, vor dem ersten Bild sofort. | `video.cpp:1131-1199` |
| 6 | Kein letztes Bild verfügbar: bei Versatz 0 geht Zooms Puffer direkt an NDI. | `ndi_sender.cpp:106-129`, `:112-118` |
| 7 | Jedes Bild geht als I420 mit fester Rate 30000/1001. | `ndi_sender.cpp:74-87`, `:78-79` |
| 8 | Bild-Versatz ist ein globaler Wert für alle Sender; die Versatz-Warteschlange kennt nur „Bild“ oder „schwarz“. | `ndi_sender.cpp:15`, `:38-40`; `delay_line.h:70-71`, `:91-116` |
| 9 | Ton: ein globales Abo ab dem ersten Abo mit Ton, braucht `JoinVoip`; der Person-Ton wird kopiert und im Herzschlag per `g_subs.find(userId)` zugeordnet; Mischton, Freigabe- und Dolmetscher-Ton sind leere Rümpfe; Warteschlange 256 Pakete, auf 5 Sprecher gerechnet. | `video.cpp:434-435`; `audio.cpp:180-230`, `:85-137`, `:91-93`, `:24-51`; `video.cpp:721-727` |
| 10 | Weggang und Rückkehr hängen den Renderer **im Rückruf** um (`onUserLeft` → `unSubscribe`, `onUserJoin` → `unSubscribe` + `subscribe`); Rückkehr über `persistentId` oder exakt gleichen, eindeutigen Namen. | `callbacks.cpp:199-227`; `video.cpp:1210-1240`, `:1253-1507` |
| 11 | Merker nur für Meeting-Ende und Entzug; Abarbeitung in der Hauptschleife nach `pumpOnce()`, vor `videoTick()`. | `callbacks.cpp:14-23`; `main.cpp:396-449` |
| 12 | Lauscher gibt es für Auth, Meeting, Teilnehmer, Aufnahme; keiner für Freigabe, Video-Regler oder Ton-Regler; Getter für Video- und Freigabe-Regler fehlen; die eigene Kennung wird nur lokal geholt. | `callbacks.h:39-139`; `session.cpp:329-391`, `:588-589` |
| 13 | Abbau-Ketten: Leave und quit/EOF mit `unSubscribe`/`destroyRenderer`; Meeting-Ende **ohne** SDK-Aufruf (gemessener Absturz); Entzug mit Abmelden, Sender zu, `StopRawRecording`; die beiden letzten kehren bei leerer Karte sofort zurück. | `video.cpp:567-674`; `main.cpp:178-200`, `:415-443`, `:542-544`; `README.md:779-788` |
| 14 | Befehlsleser flach: nur Zeichenketten, reine Ziffernfolgen, `true`/`false`. | `session.cpp:809-957` |
| 15 | Rein logischer C++-Test nur für die Versatz-Warteschlange, CMake-Ziel ohne Includes, Konfiguration verlangt trotzdem beide SDKs; läuft nicht in der CI. | `delay_line_test.cpp:15-264`; `CMakeLists.txt:14-43`, `:71-72`; `ci-checks.yml:79-80` |
| 16 | `shareRawdataMemoryMode` ist gesetzt; Custom-UI-Modus. | `session.cpp:96-106` |

### 5.2 Bridge, TypeScript und Attrappe (`packages/zoom-bridge/src`, `test/`)

| # | Tatsache | Fundstelle |
| --- | --- | --- |
| 1 | `Command` kennt `videoSubscribe {id, resolution?, audio?}`, `videoUnsubscribe {id}`, `videoDelay {ms}`; Ton nur beim Abonnieren. | `src/protocol.ts:122-134`, `:128` |
| 2 | `WireEvent` mit `video`/`audio` je Kennung und einem untypisierten Sammelfall. | `src/protocol.ts:137-219` |
| 3 | `VideoReason` (9 Werte), `AudioReason` (9 Werte); `BILD_SCHWARZ`/`TON_AUS` in Connect erzwingen je Grund einen Text im Typcheck. | `src/protocol.ts:57-82`, `:109-120`; `apps/connect/src/shared/zoom-text.ts:482-512` |
| 4 | Reducer: jeder `error`-Ort außer `video`/`audio` setzt `phase = 'error'` endgültig; unbekannte Ereignisse ändern nichts. | `src/state.ts:223`, `:323-325` |
| 5 | `Session.videoSubs`/`audioSubs` nach Kennung. | `src/state.ts:67-68` |
| 6 | Eigene Fehlerschlüssel in `OWN_ERROR_NAMES`; der Selbsttest prüft die ganze Tabelle. | `src/protocol.ts:282-414`; `test/selftest.ts:1300-1332` |
| 7 | Attrappe `test/fake-bridge.mjs`, Drehbuch `steuerung` mit `FAKE_*`-Schaltern, zentralem Abbau `abbauen(grund)` und Befehlsverteiler `befehl`; unbekannter Befehl → `where:'cmd'`. | `test/fake-bridge.mjs:126-219`, `:254-263`, `:451-531`, `:530` |
| 8 | Quelltext-Wächter: `onRecordPrivilegeChanged` setzt nur den Merker; Reihenfolge `pumpOnce` → Meeting-Ende → Entzug → `videoTick`. | `test/selftest.ts:2730-2747` |

### 5.3 SDK (Header 7.1.5.43953), was die Slots brauchen

| # | Tatsache | Fundstelle |
| --- | --- | --- |
| 1 | Auflösungsstufen bis `ZoomSDKResolution_1080P`; `setRawDataResolution` und `getResolution` ohne Doku; `getRawDataType()` und `getSubscribeId()` am Renderer. | `rawdata_renderer_interface.h:12-20`, `:50`, `:59`, `:60`, `:65` |
| 2 | `subscribe(subscribeId, type)`: bei SHARE ist `subscribeId` die Freigabe-Kennung; `unSubscribe` ohne Doku; ob ein Renderer den Typ wechseln darf und ob zwei Renderer dasselbe Ziel abonnieren dürfen, steht nirgends. | `rawdata_renderer_interface.h:51-58` |
| 3 | Die gelieferte Größe je Abo steht am Bild; `GetSourceID()` „source_id of the current YUV raw data“; Referenzzählung `AddRef`/`Release`. Daneben gibt es Quellen, deren Bedeutung der Header offenlässt (Nachbesserung B40): `GetUserVideoSize(userid)` (Doku: `Gets the size of user's video`), die HD-Einstellungen `EnableHDVideo`/`IsHDVideoEnabled` und `EnableAlwaysUseOriginalSizeVideo`/`IsAlwaysUseOriginalSizeVideo` (über `GetVideoSettings()` des Einstellungsdienstes, `CreateSettingService`), meetingweit `recvResolution`/`recvFps`. Ob sie den Empfang betreffen, sagt kein Header (MS24). | `zoom_sdk_raw_data_def.h:213`, `:219`, `:231`, `:143-158`; `meeting_video_interface.h:715-720`; `setting_service_interface.h:1031-1054`, `:3430`; `zoom_sdk.h:67`, `:74`; `meeting_service_interface.h:584`, `:590`, `:1100`, `:1107` |
| 4 | Grenzen für HD-Abos nur beim Custom-UI-Container: `…HasSubscribe1080POr720`, `…HasSubscribeTwo720P`, `…HasSubscribeExceededLimit`, `…TooFrequentCall`; der Rohdaten-Renderer hat keinen solchen Rückruf. `SDKERR_TOO_FREQUENT_CALL` = 18, `SDKERR_NO_SHARE_DATA` = 29 („There is no raw data of sharing“), `SDKERR_SHARE_CANNOT_SUBSCRIBE_MYSELF` = 30. | `customized_video_container.h:192-201`; `zoom_sdk_def.h:80-81`, `:102-105` |
| 5 | Ton: `onMixedAudioRawDataReceived(data)` ohne Kennung, `onOneWayAudioRawDataReceived(data, user_id)`, `onShareAudioRawDataReceived(data, user_id)` (ohne Doku; dass `user_id` die teilende Person ist, ist **Annahme** AN18, Nachbesserung B28, B39). Ein Abo liefert diese drei; den Dolmetscher-Rückruf nur mit `bWithInterpreters = true`, die Bridge setzt `false` (Nachbesserung B42 b). Rate und Kanäle laut Beitrittsparametern mono, 32 kHz. Die eigene Stimme ist nicht im Mischton, weil `isMyVoiceInMix` im Konstruktor per `memset` auf `false` steht und die Bridge es nicht setzt (Nachbesserung B42 c). | `rawdata_audio_helper_interface.h:16-18`, `:19-24`, `:73-74`; `audio.h:55-57`; `meeting_service_interface.h:277-278`, `:285-288`, `:350-355`; `session.cpp:181-189` |
| 6 | Teilnehmer: `onUserJoin`/`onUserLeft` nur mit Kennungen; `GetUserID()` ohne Aussage zur Stabilität, liefert 0 nur beim Scheitern; `GetPersistentId()` ohne Aussage, worüber sie beständig ist. | `meeting_participants_ctrl_interface.h:330-344`, `:96-113` |
| 7 | Kamera: `IsVideoOn()`, `HasCamera()`; Ereignis `onUserVideoStatusChange(userId, VideoStatus)` mit `Video_ON`, `Video_OFF`, `Video_Mute_ByHost`. | `meeting_participants_ctrl_interface.h:127`, `:261`; `meeting_video_interface.h:18-26`, `:219` |
| 8 | Sprecher: `onActiveSpeakerVideoUserChanged(userid)`, `onActiveVideoUserChanged(userid)` mit wortgleicher Parameter-Doku, beide als **Wechsel**-Ereignis beschrieben; `onUserActiveAudioChange(IList<unsigned int>*)`; kein Getter für den aktuellen Sprecher. | `meeting_video_interface.h:234-243`; `meeting_audio_interface.h:119-122`; Regler `meeting_video_interface.h:423-740` |
| 9 | Freigabe: `ZoomSDKSharingSourceInfo` mit `userid`, `shareSourceID`, `status`, `contentType`; `contentType` kann bei Begin vorläufig `SHARE_TYPE_UNKNOWN` sein, endgültig erst nach `onShareContentNotification`; Typen bis `SHARE_TYPE_COMPUTER_AUDIO`; `onSharingStatus`; `SharingStatus` mit Begin/End je eigen und fremd, Pure-Audio-Begin/End, `Sharing_Pause`/`Sharing_Resume` ohne Trennung; `GetViewableSharingUserList()`, `GetSharingSourceInfoList(userID)` (Custom-UI: an nicht vorhandenes `SetUserID` gebunden). | `meeting_sharing_interface.h:43-84`, `:60-65`, `:162-166`, `:180-184`, `:433-442`; `zoom_sdk_def.h:420-444`, `:561-585` |
| 10 | Regler-Getter `GetMeetingVideoController()`, `GetMeetingShareController()`, `GetMeetingAudioController()`; `SetEvent` je Regler. | `meeting_service_interface.h:1113-1125`; `meeting_sharing_interface.h:228`; `meeting_video_interface.h:423`; `meeting_audio_interface.h:158` |
| 11 | `EnablePlayMeetingAudio(false)` schließt laut Doku „sharing computer sound“ aus; ob das den Empfang fremden Freigabe-Tons betrifft, steht nirgends. Die Bridge setzt es. | `meeting_audio_interface.h:251-253`; `session.cpp:574` |
| 12 | Threads: keine Aussage für die betroffenen Schnittstellen. Ein Grep nach „thread“ über `h\` trifft Nachrichtenfäden im Chat (`meeting_chat_interface.h:397-420`, `:711-714`), `TLS_KEY_DEF` (`zoom_sdk_def.h:21`) und einen einzigen Satz zu Ausführungs-Threads (`ui_hook_interface.h:33`) (Nachbesserung B42 a). | wie genannt |
| 13 | QoS je Person nur grob (`onUserVideoQualityChanged`, `onUserNetworkStatusChanged`); Zahlen nur meetingweit. | `meeting_video_interface.h:268`; `meeting_service_interface.h:564-613`, `:1093-1107` |
| 14 | Lebensdauer eines Renderers: `onRendererBeDestroyed` („you should never user this renderer object any more“) ist das einzige Signal dafür; heute ein leerer Rumpf (Nachbesserung B32). | `rawdata_renderer_interface.h:36-40`; `video.cpp:26` |
| 15 | Meeting-Zustände `INMEETING`, `DISCONNECTING`, `RECONNECTING`, `FAILED`, `ENDED`. | `meeting_service_interface.h:26-34` |

### 5.4 JM Connect (`apps/connect/src`)

| # | Tatsache | Fundstelle |
| --- | --- | --- |
| 1 | Kern ohne Electron; Quellen in `quellen: Map<number, QuelleIntern>` nach Abo-Kennung; Soll-Liste `soll` nur im Arbeitsspeicher. | `main/zoom/kern.ts:282-283` |
| 2 | Betriebsgröße 5 steht nur in Connect; `laden` lehnt ab der 6. mit Q9 ab, die Karte merkt sich **eine** Zeile für den zweiten Klick; Companion lädt mit F8; der Abgleich lädt nie über 5. | `shared/zoom-text.ts:40-45`; `main/zoom/kern.ts:1578-1579`, `:1663-1667`, `:1740-1742`; `renderer/src/zoom/ZoomCard.tsx:233-234`, `:373-377` |
| 3 | Connect sendet immer `resolution: '720p'`. | `main/zoom/fristen.ts:21`; `kern.ts:1474` |
| 4 | Ton-Schalter nur vor dem Laden (Q14). | `kern.ts:1621-1626`; `ZoomCard.tsx:395-406` |
| 5 | Einstellungsdatei `connect-settings.json`, Felder in `Stored`; unlesbar → still `{}`; `write()` schreibt die ganze Datei. | `main/settings.ts:30-75` |
| 6 | Zoom-Karte eine Komponente mit 827 Zeilen; Abschnitte Statuszeile, Meldung, Einrichtung, Beitritt, Laufend, Versatz, Teilnehmerliste, Gemerkte Quellen, Hinweise, Fußzeile. | `renderer/src/zoom/ZoomCard.tsx:489-824` |
| 7 | Statuszeilen aus einer Quelle: `zoomZ`, `zoomZeile` (Tray und Kopfzeile), `kartenZeile`, `stateKvAus`; Z8–Z9b hängen nur an `quellen`/`ohneBild`, `zoom_alarm` an `sollOffen`. | `shared/zoom-text.ts:57-85`, `:96-140`, `:176-231`, `:303-317` |
| 8 | Ein neues Bridge-Ereignis landet in keinem Zweig von `beiEreignis`; ein neuer `error`-Ort erscheint nur im Log. | `kern.ts:1076-1117`, `:1081`, `:1285-1324` |
| 9 | Log ohne Teilnehmernamen (Maske `‹Name›`), Prüfung im Kerntest. | `kern.ts:859-874`; `apps/connect/test/zoom-kern.test.ts:2844-2913` |
| 10 | CSP erlaubt `img-src data: blob:`. | `packages/app-runtime/src/csp.ts:34` |
| 11 | Die Zwischenablage nutzt der Renderer über `navigator.clipboard.writeText`. | `renderer/src/App.tsx:548` |

### 5.5 Companion und Fernsteuerung

| # | Tatsache | Fundstelle |
| --- | --- | --- |
| 1 | Rolle `connect`: 12 Aktionen, 16 Variablen, 6 Feedbacks; Zoom-Aktionen `zoom_load`/`zoom_unload` per Anzeigename, `zoom_delay`; sieben Variablen „Ohne Namen“. | `packages/suite-control-protocol/src/capabilities.ts:589-643`, `:624` |
| 2 | Modul: Variablen nur aus der gebündelten Liste; Feedback liest einen festen `stateKey`; „Umschalten“ löst über einen festen `toggleKey` auf; ohne `toggleKey` geht der Wert wörtlich hinaus. | `packages/companion-jm-suite/main.js:138-140`, `:128-131`; `packages/companion-jm-suite/lib.mjs:32-39` |
| 3 | Feste Zählungen in Tests: Modul `[12, 16, 6]`, Connect „genau sieben zoom_*“. | `packages/companion-jm-suite/test/selftest.mjs:130`; `apps/connect/test/control-state.test.ts:88-97` |
| 4 | Nur Verben mit `zoom_` gehen an die Zoom-Hülle; unbekannte `zoom_*` → F7. | `apps/connect/src/main/control-state.ts:71-74`; `apps/connect/src/main/zoom/fernsteuerung.ts:20-34` |
| 5 | Der Rundown zeigt Feedbacks als Tally über einen festen `stateKey` und kennt neue Aktionen erst mit seinem nächsten Release. | `apps/rundown/src/renderer/src/components/ToolLinks.tsx:40-44` |

### 5.6 Seit `5e5b234ec3` geändert (Connect-Bezug geprüft)

- `packages/app-runtime`: Abfrage `jmps:master-link` und Zustandswechsel an alle Fenster (`packages/app-runtime/src/index.ts:395`, `:410`); Connects Preload reicht den Kanal nicht durch (`apps/connect/src/preload/index.ts:1-101`). Keine Wirkung auf Zoom.
- `packages/suite-control-protocol/src/server.ts:173-179`: `modus()` nur lesend, in Connect ungenutzt.

### 5.7 Release und Doku

| # | Tatsache | Fundstelle |
| --- | --- | --- |
| 1 | Connect wird lokal gebaut; `bundle-zoom-bridge.mjs` bricht ab, wenn die EXE älter als `native/` ist; Wächter 1 (Zoom-Dateien) und Wächter 2 (`afterPack`, auch `app.asar`). | `apps/connect/tools/bundle-zoom-bridge.mjs:27-67`; `apps/connect/electron-builder.yml:3`, `:16`, `:29` |
| 2 | Der Launcher nimmt das höchste nicht-Entwurfs-Release mit Präfix `connect-v`, Pre-Releases eingeschlossen; einen Testkanal gibt es nicht. Mit dem iveo-Paket nehmen Proxy und GitHub-Quelle stattdessen das neueste Release mit passendem Paket; Pre-Releases bleiben eingeschlossen (Kandidaten „nicht `draft`“). Nach dem Neuaufsetzen neu zu messen (20; Sechste Runde RN11). | `apps/launcher/src/main/release-source.ts:87-98`; `services/release-proxy/worker.js:300-306`; iveo-Spec E41 (Z. 147) und Z. 885-897 |
| 3 | Changelog, Katalog und Kochbuch liest der Proxy aus `main`. | `services/release-proxy/worker.js:211-259`; `services/release-proxy/wrangler.toml:55` |
| 4 | README §9 nennt „Kein Mischton“, „Kein Bildschirmton“ und „keine spätere Stage“; das Handbuch nennt dieselben Grenzen und „Die zoom_*-Werte enthalten nie einen Namen.“ | `packages/zoom-bridge/README.md:866-912`; `packages/cookbook/content/tool-manuals/tool-jm-connect.md:42`, `:59` |

### 5.8 Stellen, die heute nach Teilnehmer-Kennung schlüsseln (Pflichtliste für den Plan)

Bridge: `g_subs` (`video.cpp:20-21`), `Sub::userId` (`:33-44`), Ereignisformer mit `id` (`:203-261`), `videoSubscribe`/`videoUnsubscribe`/`uniqueSourceName` (`:321-520`, `:188-201`), Befehle mit `id` und `parseParticipantId` (`main.cpp:130-136`, `:201-266`), Ton-Zuordnung und `AudioPacket::userId` (`video.cpp:721-727`; `audio.h:34`; `audio.cpp:95`), Weggang und Umhängen (`video.cpp:1210-1240`, `:1253-1507`), Delegate meldet `owner_->userId` (`:1511-1651`).
TypeScript-Bridge: `Command`/`WireEvent` mit `id` (`src/protocol.ts:122-134`, `:187`, `:193-214`), `Session.videoSubs`/`audioSubs` und Reducer (`src/state.ts:67-68`, `:238-309`), Attrappe `abos` (`test/fake-bridge.mjs:249`, `:334-360`, `:483-525`).
Connect: `quellen` (`kern.ts:283`), `tonVorwahl`, `zeilenFehler`, `tonAngefragt`, `aboFristen`, `abmeldeWarter` (`:300-315`), `aktiveQuellen`, `belegteAbos`, `freiePlaetze` (`:326-345`), Ereignisse (`:1491-1568`), Abbau (`:1058-1074`, `:909`, `:1216`), `laden`/`entladen`/`ton`/`fernLaden`/`fernEntladen` (`:180-182`, `:1570-1626`, `:1718-1758`), Soll (`main/zoom/soll.ts:13`, `:24`, `:52`, `:72-74`), `baueTeilnehmer`/`istVerwaist` (`teilnehmer.ts:67`, `:102-105`), `ladeZiel` (`fernsteuerung.ts:37-50`), `quellenFehler` (`klartext.ts:271-302`), Typen (`shared/types.ts:106-141`, `:170-172`), IPC (`main/zoom.ts:176-193`; `preload/index.ts:91-94`), Karte (`ZoomCard.tsx:40`, `:233-234`, `:373-411`), Konsole `packages/zoom-bridge/cli/steuerung.mjs`.

---

## 6 · Teil Bridge (`packages/zoom-bridge`)

Der native Teil ändert sich in diesem Release erheblich. Darum gehört eine Regressionsgruppe in die Abnahme (12, Gruppe L), wie es die Regel für Änderungen am nativen Teil verlangt (`apps/connect/ABNAHME-0.3.0.md:8`).

### 6.1 Slot-Verwaltung

`Sub` heißt künftig `Slot` und wird erweitert; `g_subs` wird zu `g_slots` mit der Slot-Nummer als Schlüssel (E1).

**Threads (Regel; Nachbesserung B18):**
- **Hauptthread:** fügt Slots ein und entfernt sie, ruft jede Renderer-Funktion (`subscribe`, `unSubscribe`, `setRawDataResolution`, `createRenderer`, `destroyRenderer`) und liest die Karte ohne Kartensperre (wie heute `video.cpp:686-691`).
- **SDK-Thread** (Bild-, Status- und Abbau-Rückruf des Delegates): liest und schreibt nur Atome, die Felder unter `fieldMutex` (nie über einem Sendeaufruf gehalten, Regel wie `video.cpp:74-89`) und den Kopierpuffer per `try_lock`; den Vorschaupuffer nur über das Vorschau-Modul (6.16). Er fasst `g_slots` nie an.
- **Vorschau-Thread** (6.16): liest nur die Plätze des Vorschau-Moduls (`g_vorschau[16]`, je Platz eine eigene Sperre), nie `g_slots` und nie ein Feld eines Slots. Ein Slot meldet seinen Platz bei `slotOn` an und **vor** dem Löschen ab; die Plätze überleben jeden Slot. Ein Quelltext-Wächter hält fest, dass `native/preview.cpp` `g_slots` nicht liest (11.2 PT6).

```cpp
// native/video.h (Auszug, Arbeitsnamen; der Plan legt die endgültigen fest)
enum class SlotMode : uint8_t { Participant, Speaker, Share };
enum class Fallback : uint8_t { Transparent, Freeze, Black, White };
enum class SlotAudio : uint8_t { Off, Mix, Person };

// native/slot_logic.h, ohne SDK-Typen: alles, was für GENAU EIN Ziel EINES Abos gilt. Das Umhängen ersetzt den
// Stand als Ganzes durch ZielStand{} (6.10 Schritt 6); kein Feld kann beim Zurücksetzen vergessen werden (B9).
// Je Abo, nicht je Slot: Mehrere Abos der Galerie (0.5.0) haben je ein eigenes Ziel (Restrunde RR10).
// Ohne Ton-Felder: Der Ton hängt am Sender, nicht am Ziel (TonStand unten; Restrunde RR8).
struct ZielStand {
  int64_t lastFrameMs = 0; int lastW = 0, lastH = 0; bool gemessen = false;   // rotation/limitedRange gemessen
  bool mismatchGemeldet = false;
  bool bildSeitUmhaengen = false;  // erstes Bild dieses Ziels kam (6.7, 6.10)
  bool rawOffGesehen = false;      // RawData_Off nach dem ersten Bild dieses Ziels (6.7)
  bool kopieGueltig = false;       // Kopie stammt von diesem Ziel (6.12)
  int64_t retargetMs = 0;          // Beginn der Lücke (6.10)
};

// Ton des Slots: Format, Messfenster und Buchführung des Stille-Herzschlags für den Strom, den der Sender trägt
// (heute liest der Stille-Herzschlag unter anderem audioRate, audioChannels, lastAudioMs und silenceBisMs,
// video.cpp:1010-1013, Feld :138; seine übrigen Eingänge audioOn und teilnehmerWeg ersetzen künftig die
// Ton-Einstellung des Slots und Ziel 0, 6.13; Fünfte Runde N2). Je Slot, nicht je Ziel: als Ganzes durch TonStand{}
// ersetzt nur, wenn der gesendete Ton die Quelle wechselt (6.10 Schritt 8, 6.13), nie beim Umhängen eines Slots,
// der vor und nach dem Umhängen reinen Mischton sendet (tonWeg mix → mix: Sprecherwechsel, Moduswechsel ohne
// Mischer; Restrunde RR8). Ein Moduswechsel, der den Mischer ein- oder ausschaltet, wechselt die Quelle
// (mix ↔ mixShare; Restnachfix N1).
struct TonStand {
  int audioRate = 0, audioChannels = 0; int64_t lastAudioMs = 0, silenceBisMs = 0; bool audioMismatchGemeldet = false;
  int64_t audioMessBeginnMs = 0; int audioMessPakete = 0; int64_t audioMessAbtastwerte = 0;
  int audioMessFenster = 0; int64_t audioWartenSummeUs = 0, audioWartenMaxUs = 0, audioWartenMinUs = 0;
};

// Ein Abo = Renderer, Delegate, Ziel, Typ, Ziel-Stand. In 0.4.0 hat jeder laufende Slot GENAU EIN Abo; alle Wege
// (Umhängen, Abbau-Ketten, Messwerte) gehen trotzdem über die Liste, damit die Galerie in 0.5.0 Abos
// hinzufügen kann, ohne diese Wege umzubauen (B.8, Abschnitt 15; Nachbesserung B6).
struct Abo {
  IZoomSDKRenderer* renderer = nullptr; std::unique_ptr<Delegate> delegate;
  std::atomic<unsigned int> target{0};    // Teilnehmer-Kennung (VIDEO) oder shareSourceID (SHARE); 0 = keins
  ZoomSDKRawDataType type = RAW_DATA_TYPE_VIDEO;
  std::atomic<bool> subscribed{false};    // true nur zwischen geglücktem subscribe() und dem nächsten unSubscribe()
  std::atomic<bool> umhaengen{false};     // Riegel: true von vor unSubscribe() bis nach subscribe() (6.10)
  std::atomic<bool> rendererTot{false};   // onRendererBeDestroyed kam: Zeiger nie mehr anfassen (6.10, B32)
  ZielStand ziel;                         // unter fieldMutex des Slots; je Abo (Restrunde RR10)
};

struct Slot {
  int nr;                                  // 1..16, Schlüssel in g_slots
  std::string ndi;                         // fester NDI-Name, ab slotOn
  std::atomic<SlotMode> mode;
  ZoomSDKResolution res;
  std::atomic<unsigned int> shareUser{0};  // wer die gezeigte Freigabe teilt (Computerton)
  std::atomic<SlotAudio> audio; std::atomic<bool> shareAudio;
  std::atomic<Fallback> fallback; std::atomic<bool> showNoVideo;
  std::atomic<bool> imAbbau{false};
  std::vector<std::unique_ptr<Abo>> abos;  // 0.4.0: genau ein Eintrag, solange der Slot läuft
  NdiSender sender;
  // unter fieldMutex: TonStand ton (Restrunde RR8); state, reason, sent (6.12), rotation, limitedRange;
  //   Zähler frameCount, fallbackCount, heldFrames, gapMs, foreignFrames, lateFrames, tooFrequent,
  //   noShareData, rendererNew, rendererLost, resSet, resGot, workUs, copyUs
  FrameCopy last;   // Kopie des letzten Bildes, nur bei Freeze oder Share; gilt nur mit ziel.kopieGueltig des Abos
                    // (0.4.0: des einen; 6.12)
  AudioMix mix;     // nur Share mit Mischton + Computerton (tonWeg mixShare, 6.13); beginnt neu, sobald der Slot
                    // Mischer-Slot wird (Restnachfix N1)
  // Bildweg: Delegate → Slot::bildAnkunft(abo, frame) → Kopie, Vorschau, Sender. Nie direkt Delegate → Sender
  // (heute video.cpp:1575), damit 0.5.0 an dieser einen Stelle einen Zusammensetzer einfügen kann.
};
std::map<int, std::unique_ptr<Slot>> g_slots;   // höchstens 16 Einträge
```

Das Merkzeichen `teilnehmerWeg` entfällt (Nachbesserung B9): Nach einem Weggang ist das Ziel 0 und das Abo abgemeldet (6.7); der Riegel (`subscribed == false`) sperrt späte Bilder und Statusmeldungen, und Person-Ton geht nur an ein Ziel ≠ 0 (6.13). Heute fällt das Merkzeichen nur in `videoParticipantJoined` (`video.cpp:1444-1448`); diese Funktion wird nicht mehr gerufen, ein vergessenes Zurücksetzen hätte den Slot nach der Rückkehr ohne Bild und Ton gelassen (`video.cpp:1535-1538`, `:771`, `:1035`).

Lebenslauf eines Slots in der Bridge: **nicht vorhanden** → `slotOn` → **läuft** (`starting`, `live`, `fallback`, `held`) → `slotOff` oder eine Abbau-Kette (6.15) → **nicht vorhanden** (während der Renderer-Sperre über die Halteliste, 6.15). Solange er läuft, bleibt der Sender offen (E3).

### 6.2 Befehle

Prüfreihenfolge = Reihenfolge der Antworten (Muster `packages/zoom-bridge/native/main.cpp:138-301`). Die Feldleser reichen (`session.cpp:809-957`): Zeichenketten, reine Ziffernfolgen, `true`/`false`. Jeder neue Fehler hat `where:"slot"`.

| `cmd` | Felder | Prüfung → Fehler | Wirkung |
| --- | --- | --- | --- |
| `slotOn` | `slot` (1–16), `ndi` (Text), `mode` (`participant`/`speaker`/`share`), `id` (Zahl, nur `participant`, fehlt oder 0 = kein Ziel), `resolution` (`360p`/`720p`/`1080p`), `audio` (`mix`/`person`/`off`), `shareAudio` (Bool), `fallback` (`transparent`/`freeze`/`black`/`white`), `showNoVideo` (Bool) | `slot` unlesbar oder außerhalb → `slotBadNumber` (ohne `slot`); `ndi` leer, länger als 60 Code-Punkte (aus UTF-8 gezählt, wie in Connect), mit `:`, Steuerzeichen oder einer `\u`-Folge (der Feldleser dekodiert `\u` nicht, sondern übernimmt es wörtlich, `session.cpp:751-773`; `JSON.stringify` schreibt Steuerzeichen so; B26) → `slotBadName`; Name gleich dem eines laufenden Slots (Bytevergleich) → `slotNameTaken`; `mode`, `resolution`, `audio`, `fallback` unbekannt → `slotBadMode`, `slotBadResolution`, `slotBadAudio`, `slotBadFallback`; Bool unlesbar → `slotBadFlag`; Slot läuft schon → `slotAlreadyOn`; Renderer-Sperre gesetzt (6.5) → `slotReconnecting`, nichts angelegt (Nachfix W2); keine Erlaubnis (`sessionCanRecordRaw()`) → `slotNoPrivilege`; NDI nicht oben → `where:"ndi"`, `ndiInitFailed`; `StartRawRecording` scheitert → `slotRawRecordingFailed`; Sender lässt sich nicht öffnen → `slotSenderFailed`; `createRenderer` scheitert → `slotRendererFailed` (Sender wieder zu) | stderr „Befehl gelesen: slotOn ‹n›, Modus ‹m›, Ton ‹a›“ (ohne NDI-Namen, Prüfstände lesen sie); Slot anlegen, Sender öffnen, Vorschau-Platz anmelden (6.16), Renderer anlegen, erstes Ziel nach Modus (6.7–6.9) per `slotRetarget` (6.10); `slot starting/command`, bei Ziel 0 `slot fallback/<Ziel-0-Grund>` (6.10 Schritt 3; Nachfix W7); Ton nach 6.13 (`audioEnsureSubscribed()` bei jedem Einschalten von Ton) |
| `slotSet` | `slot`, dazu beliebig viele von `mode`, `id`, `resolution`, `audio`, `shareAudio`, `fallback`, `showNoVideo` | wie oben je Feld; **erst alle Felder prüfen, dann ändern** (ein Fehler ändert nichts); Slot läuft nicht → `slotNotOn` | Reihenfolge: `fallback`, `showNoVideo`, Ton (`audio`, `shareAudio`), dann höchstens **ein** Umhängen für `mode`/`id`/`resolution` (6.10). Bestätigung immer mit einem `slot`-Ereignis; Grund ist der des Umhängens (bei Ziel 0 der Ziel-0-Grund, 6.10 Schritt 3) oder `command` |
| `slotOff` | `slot` | unlesbar → `slotBadNumber`; läuft nicht → `slotNotOn` | `imAbbau`; `slotAudio off/command`; `slot off/command`; Vorschau-Platz abmelden; `unSubscribe` + `destroyRenderer` (Fehler nur auf stderr; bei `rendererTot` nur Zeiger verwerfen); Sender schließen; aus `g_slots` löschen (Muster `video.cpp:461-520`). Bei gesetzter Renderer-Sperre statt der Renderer-Aufrufe und des Löschens: Sender schließen und den ganzen Slot in die Halteliste legen (6.15; Nachfix W2) |
| `speakerConfig` | `signal` (`speakerVideo`/`activeVideo`/`activeAudio`), `holdMs` (0–5000) | `speakerBadSignal`, `speakerBadHold` | gilt für alle Sprecher-Slots sofort; braucht kein `init` (wie `videoDelay`, `main.cpp:267-285`); Bestätigung `{"ev":"speakerConfig","signal":…,"holdMs":…}` |
| `previewMode` | `on` (Bool) | unlesbar → `slotBadFlag` | Vorschau für alle Slots an oder aus; braucht kein `init`; Bestätigung `{"ev":"previewMode","on":…}` |
| `videoDelay` | wie heute | wie heute | wie heute, aber nicht für Freigabe-Slots (6.14) |
| `videoSubscribe`, `videoUnsubscribe` | – | entfallen → `where:"cmd"`, `code:1` wie jeder unbekannte Befehl (`main.cpp:286-300`) | – |

### 6.3 Ereignisse

Regel „keine erfundenen Werte“ bleibt: Felder fehlen, solange nichts gemessen ist (`src/protocol.ts:189-192`). Das gilt je Ziel: Nach jedem Umhängen fehlen die Messfelder wieder, bis ein Bild des neuen Ziels kam (Nachbesserung B55).

| `ev` | Felder | Wann |
| --- | --- | --- |
| `slot` | `slot`, `state` (`starting`, `live`, `fallback`, `held`, `off`), `mode`, `target` (Kennung oder 0), `share` (Freigabe-Kennung oder 0), `reason` (`SlotReason`), `sent` (`none`, `transparent`, `freeze`, `black`, `white`, `held`: was der Sender gerade zusätzlich zu Zooms Bildern schickt, 6.12), `ndi`, nach dem ersten Bild `rotation`, `limitedRange` | bei jedem Wechsel von Zustand, Grund, `sent`, Ziel oder Modus; nach jedem `slotOn`/`slotSet`/`slotOff` |
| `slotAudio` | `slot`, `state` (`waiting`, `live`, `silent`, `off`), `source` (**gemessen**: was im letzten 500-ms-Fenster tatsächlich hinausging, `mix`, `person`, `share`, `mixShare`, `none`), `configured` (eingestellt: der Tonweg im aktuellen Modus, `tonWeg`, 6.10 Schritt 8; dieselben Werte), `reason` (`SlotAudioReason`), nach dem ersten Paket `sampleRate`, `channels` | bei jedem Wechsel, auch wenn ein Eingang des Mischers wegfällt oder wiederkommt (Nachbesserung B56) und wenn ein Moduswechsel `configured` ändert (6.10 Schritt 8; Restnachfix N1) |
| `slotStats` | `slot`, `w`, `h`, `fps` (nur aus Bildern des laufenden 2-s-Fensters; ohne Bild im Fenster fehlen `w`/`h`, dafür `lastW`, `lastH` des Ziels), `fallbackFps`, `heldFrames`, `workUs`, `copyUs`, `previewUs` (je µs pro Sekunde), `memKb`, `resWanted`, `resSet` (SDKError-Zahl), `resGot` (`getResolution()`), `rawType` (`getRawDataType()`), `userVideoW`, `userVideoH` (`GetUserVideoSize` des Ziels, nur VIDEO), `foreignFrames`, `lateFrames`, `tooFrequent`, `noShareData`, `rendererNew`, `rendererLost`, `gapMs` (letzte Lücke, fehlt ohne Wechsel), `gapUngeprueft` (Bool, 6.10), `audioPps`, `audioRate`, `audioCh`, `shareAudioRate`, `shareAudioCh`, `mixDrops` (ms), `mixSilenceMs` | alle 2 s je laufendem Slot |
| `bridgeStats` | `cpuPct` (Prozess, 100 = ein Kern), `sysPct` (ganzes System, 100 = alle Kerne), `memMb` (Arbeitsspeicher des Prozesses), `audioQueueMax`, `audioDropped`, `merkerVerworfen` (6.5), `halteliste` (Einträge der Halteliste, 6.15; Nachfix W2), `shareAudioPackets`, `shareAudioUnassigned`, `shareAudioLastId` (Freigabe-Ton **vor** der Zuordnung gezählt, 6.13), `hdVideo`, `originalSize` (`IsHDVideoEnabled`, `IsAlwaysUseOriginalSizeVideo`; fehlen, wenn der Einstellungsdienst nicht verfügbar ist), `recvVideo`, `recvShare` (je `{res, fps}` aus `GetMeetingVideoStatisticInfo`/`GetMeetingShareStatisticInfo`, meetingweit), `previewOn` | alle 2 s, sobald `init` gelaufen ist |
| `shares` | `list` (Feld von `{user, share, status, type, audioOnly, pauses}` mit `status` = `running` oder `paused`, `type` = `contentType` als Name, `unknown` solange vorläufig), `shown` (Freigabe-Kennung oder 0), `seeded` (`ok`, `empty`, `unavailable`, nur nach einem Befüllen), `recent` (die letzten 10 Freigabe-Rückrufe roh: `{ms, cb, status, user, share, type}`, ohne Namen) | bei jeder Änderung der Liste, der gezeigten Freigabe oder bei jedem Freigabe-Rückruf |
| `speakerSignal` | `signal`, `ids` (Feld von Kennungen), `ms` (Bridge-Uhr) | bei jedem Rückruf eines der drei Signale, unabhängig vom gewählten |
| `videoStatus` | `id`, `videoOn` (Bool), `mutedByHost` (Bool) | `onUserVideoStatusChange` (0.18) |
| `preview` | `slot`, `target` (Ziel-Kennung bzw. Freigabe-Kennung des Bildes), `w`, `h`, `jpeg` (Base64) | höchstens zweimal pro Sekunde je laufendem Slot mit Bild, nur bei `previewMode on` |
| `speakerConfig`, `previewMode` | wie gesendet | Bestätigung |
| `video`, `audio` | – | entfallen (ersetzt durch `slot`, `slotAudio`) |

`SlotReason` (20 Werte, je einer mit Text in Connect, Muster `BILD_SCHWARZ`, `zoom-text.ts:482-492`): `command`, `frames`, `noTarget`, `participantLeft`, `cameraOff`, `noFrames`, `speakerNone`, `speakerNoVideo`, `speakerChanged`, `shareNone`, `sharePaused`, `shareStill`, `shareChanged`, `targetChanged`, `modeChanged`, `resolutionChanged`, `bufferMismatch`, `subscribeFailed`, `meetingEnded`, `privilegeRevoked`. Neu gegenüber der ersten Fassung ist `noFrames`: Zoom liefert seit 200 ms kein Bild, ohne dass Zoom für das Ziel „Kamera aus“ meldet (Netzhänger, veraltete Kennung, zweites Abo derselben Quelle; 6.7, 6.12; Nachbesserung B52). Heute setzt der Herzschlag in diesem Fall `cameraOff` (`video.cpp:1190-1192`), obwohl niemand die Kamera ausgeschaltet hat.

`SlotAudioReason` (12 Werte): `command`, `packets`, `gap`, `audioUnavailable`, `participantLeft`, `personNotInMode`, `noShare`, `rateMismatch`, `targetChanged`, `modeChanged`, `meetingEnded`, `privilegeRevoked`.

Kernregel wie heute „eine Ursache, ein Name“ (`src/protocol.ts:52-56`): Der Grund nennt immer, **warum** sich der Zustand zuletzt geändert hat.

### 6.4 Fehlerschlüssel

Alle neu in `OWN_ERROR_NAMES` (`src/protocol.ts:282-414`); der Selbsttest über die ganze Tabelle greift von selbst (`test/selftest.ts:1320-1332`). `where:"slot"` setzt die Sitzung **nicht** auf `error` (Reducer-Regel `src/state.ts:223` wird um `slot` erweitert; Gegenprobe 11.8).

| Schlüssel | Wann | Zusatzfelder |
| --- | --- | --- |
| `slotBadNumber` | `slot` unlesbar oder nicht 1–16 | – |
| `slotBadName`, `slotNameTaken` | NDI-Name ungültig bzw. schon an einem laufenden Slot | `slot` |
| `slotBadMode`, `slotBadResolution`, `slotBadAudio`, `slotBadFallback`, `slotBadFlag` | Feld unbekannt oder unlesbar | `slot` |
| `slotAlreadyOn`, `slotNotOn` | `slotOn` auf laufendem bzw. `slotSet`/`slotOff` auf nicht laufendem Slot | `slot` |
| `slotNoPrivilege` | keine Aufnahme-Erlaubnis (in Connect kein Fehlerstand, der Slot wartet wie bei Q1, 7.3 Nr. 2) | `slot` |
| `slotReconnecting` | `slotOn` während der Renderer-Sperre (Zoom verbindet neu, 6.5); nichts angelegt. In Connect kein Fehlerstand und kein Text; der Abgleich nach `inMeeting` startet den Slot (7.3 Nr. 2; Nachfix W2) | `slot` |
| `slotRawRecordingFailed`, `slotSenderFailed`, `slotRendererFailed` | Aufbau gescheitert, Slot nicht angelegt | `slot` |
| `slotSubscribeFailed` | `subscribe` gescheitert, auch nach neuem Renderer, oder `createRenderer` nach `rendererTot` gescheitert (6.10); Slot läuft mit Ersatzbild weiter und zählt in Connect als offen | `slot`, `sdk` (SDKError-Zahl), `type` (`video`/`share`) |
| `slotBufferMismatch` | Bildpuffer passt nicht zur Größe, einmal je Ziel (Muster `video.cpp:1549-1566`) | `slot` |
| `speakerBadSignal`, `speakerBadHold` | `speakerConfig` ungültig | – |
| `previewUnavailable` | WIC oder COM ließ sich nicht einrichten; Vorschau bleibt aus | `detail` (HRESULT hex) |

Die bestehenden Ton-Fehler (`audioVoipJoinFailed`, `audioHelperMissing`, `audioSubscribeFailed`, `audio.cpp:203-223`) bleiben `where:"audio"` und tragen jetzt `slot`, wenn ein Slot sie auslöste; nur diese drei sind **Ton-Abo-Fehler** (T104, 7.1). Ebenfalls `where:"audio"`, aber keine Ton-Abo-Fehler (Nachfix W6): `audioQueueOverflow` bleibt ohne Slot, eine Aussage über die eine Warteschlange aller Slots (`video.cpp:715-719`), Hinweis Q6 wie heute (`apps/connect/src/main/zoom/klartext.ts:293-294`); `audioBufferMismatch` (heute mit Teilnehmer-Kennung `id`, `video.cpp:822`, Hinweis Q17, `klartext.ts:297-298`) trägt künftig `slot` statt `id`, weil das Merkzeichen (`audioMismatchGemeldet`) im `TonStand` des Slots sitzt (6.1; Restrunde RR8), und bleibt ein Hinweis (T106).

### 6.5 Lauscher und Merker

Drei neue Lauscher in `native/callbacks.h`/`.cpp`. **Einbindereihenfolge** (Nachbesserung B43): `windows.h` zuerst (bestehende Regel, `callbacks.h:12-35`), dann `meeting_service_interface.h`, erst danach `meeting_sharing_interface.h`, `meeting_video_interface.h`, `meeting_audio_interface.h`. Grund: `meeting_sharing_interface.h` bindet nur `zoom_sdk_def.h` ein (`meeting_sharing_interface.h:7`), benutzt aber `SDKViewType` und `SDKShareViewZoomRatio` (`:319`, `:327`, `:353`), die erst in `meeting_service_interface.h:620`, `:634` stehen; dieselbe Art Falle wie heute bei `AudioType` (`callbacks.h:23-28`).

Jeder Rückruf kopiert nur Werte (keine Zeiger, deren Lebensdauer der Header nicht nennt, etwa `monitorID`, `meeting_sharing_interface.h:69`) in eine Warteschlange unter `g_merkerMutex` und kehrt zurück (E21). Jede Warteschlange hat höchstens 1024 Einträge; was darüber kommt, zählt `merkerVerworfen`, ein Feld von `bridgeStats` (6.3), angezeigt in T61 (Nachbesserung B20, B44, B62).

| Lauscher | Methode | Wirkung |
| --- | --- | --- |
| `ShareListener` (`IMeetingShareCtrlEvent`, 9) | `onSharingStatus(info)` | `{userid, shareSourceID, status, contentType}` einreihen (`meeting_sharing_interface.h:166`); `contentType` kann bei Begin vorläufig `SHARE_TYPE_UNKNOWN` sein (`:60-65`, `:162-164`) |
| | `onShareContentNotification(info)` | `{userid, shareSourceID, contentType}` einreihen, ausdrücklich als **Typ-Nachtrag**, nicht als Zustand (`:180-184`; was `status` dort trägt, sagt der Header nicht); Wirkung 6.9 |
| | `onMultiShareSwitchToSingleShareNeedConfirm(handler)` | nichts aufrufen, stderr-Zeile (`:190`; `Confirm()` stoppt alle Freigaben, `:144`) |
| | übrige 6 | leer, stderr nur bei `onFailedToStartShare` |
| `VideoCtrlListener` (`IMeetingVideoCtrlEvent`, 12, `meeting_video_interface.h:219-289`) | `onActiveSpeakerVideoUserChanged(id)`, `onActiveVideoUserChanged(id)` | `{signal, ids:[id], qpc}` einreihen (`:237`, `:243`) |
| | `onUserVideoStatusChange(id, status)` | `{id, status}` einreihen (`:219`) |
| | `onHostRequestStartVideo`, `onCameraControlRequestReceived` | nichts aufrufen, stderr-Zeile (`:231`, `:282`) |
| | übrige 7 | leer (Nachbesserung B41: 12 Methoden, 5 benannt; der Plan übernimmt die 12 Signaturen wörtlich aus `:219-289`) |
| `AudioCtrlListener` (`IMeetingAudioCtrlEvent`, 5) | `onUserActiveAudioChange(list)` | Kennungen während des Rückrufs kopieren, `{signal: activeAudio, ids, qpc}` einreihen (`meeting_audio_interface.h:122`; Lebensdauer der Liste ungenannt, darum sofort kopieren) |
| | `onHostRequestStartAudio` | nichts aufrufen, stderr-Zeile (`:128`) |
| | übrige 3 | leer |
| `ParticipantsListener` (vorhanden) | `onUserJoin`, `onUserLeft` | Ereignisse `joined`/`left` wie heute (`callbacks.cpp:199-227`), dazu Kennungen einreihen; **kein** Aufruf von `videoParticipantJoined`/`videoParticipantLeft` mehr im Rückruf (E6) |
| `MeetingListener` (vorhanden) | `onMeetingStatusChanged` | wie heute `status` melden und bei `INMEETING` `SetEvent` und `emitRoster()` (`callbacks.cpp:85-103`; diese SDK-Aufrufe bleiben ausdrücklich im Rückruf, sie laufen dort seit Stage 1). **Neu:** bei `INMEETING` zusätzlich `SetEvent` der drei neuen Lauscher und der Merker `g_inMeetingOffen`; bei `DISCONNECTING` und `RECONNECTING` der Merker **Renderer-Sperre** (`meeting_service_interface.h:28`, `:30`); `ENDED`/`FAILED` wie heute (`callbacks.cpp:119`). Alles Übrige zu `INMEETING` (eigene Kennung, Sprecher-Erinnerung, Freigabe-Liste, Lösen der Sperre, Umhängen) geschieht in der Hauptschleife (6.6 Nr. 4; Nachbesserung B33) |
| `Delegate` (Renderer, vorhanden) | `onRawDataFrameReceived`, `onRawDataStatusChanged` | Felder setzen, Riegel beachten (6.10) |
| | `onRendererBeDestroyed` | nur `rendererTot = true` am Abo (`rawdata_renderer_interface.h:36-40`: „you should never user this renderer object any more“); heute leerer Rumpf (`video.cpp:26`). Zähler `rendererLost` (Nachbesserung B32) |

Die Renderer-Sperre (Nachbesserung B34) ist ein Atom, das jede Renderer-Funktion in der Hauptschleife vorher liest: Ab `DISCONNECTING` oder `RECONNECTING` ruft die Bridge weder `subscribe` noch `unSubscribe`, `setRawDataResolution`, `createRenderer` oder `destroyRenderer`, bis `INMEETING` (Sperre lösen, Halteliste abbauen, vorgemerkte Umhängungen ausführen) oder `ENDED`/`FAILED` (Meeting-Ende-Kette ohne Renderer-Aufruf, Halteliste verwerfen) kommt. Was eine Abbau-Kette während der Sperre abbaut, legt sie in die Halteliste, statt Renderer-Funktionen zu rufen oder den Delegate freizugeben; `slotOn` beantwortet die Bridge solange mit `slotReconnecting` (6.2, 6.15; Nachfix W2). Grund: Gemessen ist die Folge `disconnecting` → `failed` → `ended` mit weiterlaufendem SDK-Thread (`session.cpp:252-259`), und schon vor `disconnecting` kommt `RawData_Off` (`README.md:411-416`); der gemessene Absturz 0xC0000005 war `unSubscribe()` an einem Renderer, dessen Rohdaten-Einrichtung das SDK schon abgeräumt hatte (`README.md:779-788`, `video.cpp:549-556`). Ob zwischen `DISCONNECTING` und `ENDED` überhaupt Weggang-, Freigabe- oder Sprecher-Rückrufe kommen, ist ungemessen (AN23, MS26).

Anmeldung der drei neuen Lauscher bei jedem `MEETING_STATUS_INMEETING` wie der Teilnehmer-Lauscher über neue Getter `videoCtrl()`, `shareCtrl()` und das schon vorhandene, dann im Header deklarierte `audioCtrl()` (`session.cpp:389-391`). Die eigene Kennung `sessionMyUserId()` aus `GetMySelfUser()` (heute nur lokal, `session.cpp:588-589`) holt die Hauptschleife nach jedem `INMEETING` neu, weil Kennungen nach einer Wiederverbindung wechseln (`callbacks.cpp:86-91`). Abmeldung in `sessionShutdown()` per `SetEvent(nullptr)` mit Registriert-Merkern, wie bei Teilnehmer und Aufnahme (`session.cpp:670-689`; dort ausdrücklich ungemessen).

### 6.6 Hauptschleife

Neue Reihenfolge je Durchlauf (heute `main.cpp:396-531`); neu sind die Schritte 4 und 5:

1. `pumpOnce()`
2. Meeting-Ende-Abbau (Merker, wie heute `:415-421`) → `slotsMeetingEnded()` = Abbau-Plan `meetingEnded` (6.15), **ohne** SDK-Aufruf am Renderer; die Halteliste wird dabei ebenso ohne Renderer-Aufruf verworfen (6.15)
3. Entzugs-Abbau (Merker, wie heute `:436-443`) → `slotsPrivilegeRevoked()` → `sessionStopRawRecording()`
4. **Merker nehmen:** zuerst `INMEETING` (eigene Kennung neu, Sprecher-Erinnerung zurücksetzen, Freigabe-Liste leeren und befüllen, Renderer-Sperre lösen, Halteliste abbauen, jeden laufenden Slot zum Umhängen vormerken, 6.15); dann Renderer tot (`rendererTot` je Abo, 6.10), Weggang (`slotsParticipantLeft(id)`, 6.7), Kamera (`videoStatus` melden), Freigaben (`FreigabeListe` füttern, 6.9), Sprecher-Signale (`speakerSignal` melden, Sprecher-Erinnerung und `SprecherWahl` füttern, 6.8)
5. **`slotLogicTick(jetzt)`:** abgelaufene Haltezeiten, Wechsel der gezeigten Freigabe, Wiederholungen nach `SDKERR_TOO_FREQUENT_CALL` und `SDKERR_NO_SHARE_DATA`, vorgemerkte Umhängungen → `slotRetarget` (6.10); solange die Renderer-Sperre gilt, bleibt alles vorgemerkt
6. `videoTick()`: Gründe der Übergänge nach 200 ms ohne Bild (6.12, mit `IsVideoOn()`), Ton-Zuordnung und Mischer (6.13), Ersatzbild- und Halte-Herzschlag (6.12), `slotStats`/`bridgeStats` alle 2 s (6.17)
7. Befehle abarbeiten
8. EOF-Behandlung wie heute
9. `Sleep(10)`

Der Quelltext-Wächter im Selbsttest (heute `test/selftest.ts:2730-2758`) prüft künftig diese Reihenfolge und, für **alle** Rückruf-Rümpfe (die Lauscher in `native/callbacks.cpp`, den Bild-Delegate in `native/video.cpp`, den Ton-Delegate in `native/audio.cpp`), dass keiner `subscribe`, `unSubscribe`, `setRawDataResolution`, `createRenderer`, `destroyRenderer` oder eine `slot…`-Funktion ruft; ausdrücklich erlaubt sind nur `SetEvent`, `emitRoster()` und `checkPrivilege()` in `onMeetingStatusChanged` (heute `callbacks.cpp:92-102`). Weil die Ketten nur den Plan ausführen (6.15), stünde `unSubscribe` nie im Text von `slotsMeetingEnded`; eine Prüfung darauf wäre immer grün (Restrunde RR3). Darum prüft er nach dem Muster der heutigen Prüfung `videoAbbauAlle("privilegeRevoked", true)` (`selftest.ts:2755-2758`, sie prüft das Argument des Aufrufs), dass `slotsMeetingEnded` den Ausführer `abbauAusfuehren` mit genau der Kette `meetingEnded` aufruft und `slotsPrivilegeRevoked` mit `privilegeRevoked`, dass keine der beiden Funktionen selbst eine Renderer-Funktion ruft und dass im Ausführer die Zweige der Schritte `ZeigerVerwerfen` und `HaltelisteVerwerfen` keine Renderer-Funktion rufen. Dass der Plan `meetingEnded` keinen Renderer-Schritt enthält, prüft PB20. Fälle und Gegenproben: 11.2 PT6, 11.8.

### 6.7 Modus Teilnehmer und Rückkehr

- **Ziel** ist die Kennung, die Connect schickt (E5). `id` fehlt oder 0 → kein Ziel, `fallback/noTarget`, auch nach einem Moduswechsel oder einem `slotSet {id:0}` (6.10 Schritt 3; Nachfix W7). Ist die Kennung keinem Teilnehmer zugeordnet, gilt dasselbe, mit stderr-Zeile; ein Fehler ist das nicht, weil Connect in einem Zwischenstand eine veraltete Kennung schicken kann.
- **Weggang:** Für jeden Slot, dessen Ziel geht (Teilnehmer- und Sprecher-Slots), ruft die Hauptschleife `slotRetarget(slot, 0, participantLeft)` bzw. `speakerNone` (6.8 Nr. 6): Riegel, `unSubscribe()`, Ziel 0, neuer Ziel-Stand (6.10). Dazu `slotAudio off/participantLeft`, wenn der Slot Person-Ton führt. Der Sender bleibt, das Ersatzbild läuft (heute dasselbe Verhalten, aber im Rückruf, `video.cpp:1210-1240`).
- **Rückkehr:** Connect findet die Person im Abgleich und schickt `slotSet {slot, id}` → Umhängen mit Grund `targetChanged` (6.10) → `starting` → `live`. Das Umhängen setzt den ganzen Ziel-Stand zurück (Bild, Messfelder, Kopie; 6.1 `ZielStand`) und, wenn der Slot Person-Ton führt, auch den Ton-Stand (Ton-Format, Ton-Messfenster; 6.1 `TonStand`, 6.10 Schritt 8), wie heute `video.cpp:1432-1466` es Feld für Feld tut (Nachbesserung B9; Restrunde RR8). Der Sender bleibt derselbe; im Switcher ändert sich nichts.
- **Kamera aus** (Nachbesserung B10, B31, B52): Den Grund `cameraOff` setzt die Bridge nur, wenn **Zoom für das Ziel** die Kamera als aus meldet: `onUserVideoStatusChange(Ziel, Video_OFF)` oder `Video_Mute_ByHost` (`meeting_video_interface.h:18-26`, `:219`), oder `IUserInfo::IsVideoOn()` des Ziels ist `false` (`meeting_participants_ctrl_interface.h:127`), abgefragt in der Hauptschleife direkt nach jedem Umhängen auf VIDEO (6.10 Schritt 7) und beim Übergang nach 200 ms ohne Bild (6.12). Kommt 200 ms kein Bild und meldet Zoom die Kamera als an, heißt der Grund `noFrames`. `RawData_Off` am Renderer setzt **keinen** Grund: Der Header dokumentiert ihn nicht (`rawdata_renderer_interface.h:31-35`, `:43`), und er kam gemessen auch nach `unSubscribe()` und vor `disconnecting`, ohne dass jemand die Kamera ausschaltete (`video.cpp:45-51`, `README.md:411-414`). Er löst nur die Abfrage `IsVideoOn()` aus, und nur, wenn seit dem Umhängen schon ein Bild dieses Ziels kam (`bildSeitUmhaengen`); während des Umhängens verwirft ihn der Riegel (6.10). Das nächste Bild → `live/frames`.
- **Doppelname, Warteraum, Person fehlt:** kennt nur Connect; die Bridge bekommt `id = 0` und meldet `noTarget`.
- **Person-Ton:** nach 6.13 an die Zielkennung gebunden; Ziel 0 heißt kein Person-Ton.

### 6.8 Modus Aktiver Sprecher (`native/slot_logic.h`, `SprecherErinnerung`, `SprecherWahl`)

Reine Logik ohne SDK-Typen, Zeit wird eingespeist (Muster `delay_line.h:19-27`). Zwei Bausteine (Nachbesserung B16):

- **`SprecherErinnerung`, eine je Bridge:** hält je Signal das zuletzt gemeldete Ergebnis (bei `speakerVideo`/`activeVideo` die Kennung, bei `activeAudio` die Liste) mit Zeit. Gefüttert wird sie von **jedem** Signal, auch wenn kein Sprecher-Slot läuft. Grund: Die Rückrufe melden nur Wechsel (`meeting_video_interface.h:234-243`: „Callback event of the active speaker video user changes“; `meeting_audio_interface.h:119-122`), und einen Getter für den aktuellen Sprecher gibt es nicht (`meeting_video_interface.h:423-740`). Zurückgesetzt wird sie bei jedem `INMEETING` (Kennungen wechseln, `callbacks.cpp:86-91`), bei Meeting-Ende, `leave`, `quit` und EOF; **nicht** beim Entzug, weil die Kennungen im selben Meeting gültig bleiben. Geht eine Person, verliert die Erinnerung ihre Kennung.
- **`SprecherWahl`, eine je Sprecher-Slot:** eingespeist werden Signal, Kennungen, Zeit, die eigene Kennung, eine Abfrage „hat Kamera an“ und die Einstellung des Slots. Jede neue `SprecherWahl` (Einschalten, Moduswechsel auf Sprecher, Wechsel des Signals) wird aus der Erinnerung des gewählten Signals **vorbelegt**.

Regeln:

1. Nur das in `speakerConfig` gewählte Signal steuert (Vorgabe `speakerVideo`, Haltezeit 1000 ms, E19). Alle drei Signale gehen trotzdem als `speakerSignal` an Connect.
2. Kandidat bei `speakerVideo`/`activeVideo`: die gemeldete Kennung; bei `activeAudio`: die erste Kennung der Liste, die nicht die eigene ist. Kennung 0 und die eigene Kennung sind nie Kandidat; eine leere Liste ändert nichts. Für die Vorbelegung gelten dieselben Regeln, auch Nr. 3. (Bedeutung von 0 und Form der Liste: MS7.)
3. Ist `showNoVideo` aus und hat der Kandidat keine Kamera an (`IUserInfo::IsVideoOn()`, abgefragt in der Hauptschleife, `meeting_participants_ctrl_interface.h:127`), wird er übersprungen.
4. Hat der Slot kein Ziel, springt er sofort auf den Kandidaten (auch auf den vorbelegten). Sonst muss derselbe Kandidat die Haltezeit lang ununterbrochen Kandidat bleiben; jeder andere Kandidat startet die Zeit neu; kehrt der Gezeigte zurück, verfällt der Wechsel.
5. Wechsel → `slotRetarget(VIDEO, id, speakerChanged)`.
6. Geht der gezeigte Sprecher aus dem Meeting → `slotRetarget(VIDEO, 0, speakerNone)` (mit Riegel, 6.10); der nächste Kandidat kommt sofort.
7. Schaltet der Gezeigte die Kamera aus, bleibt er Ziel (`fallback/cameraOff` nach 6.7: nur wenn Zoom es meldet, sonst `noFrames`), bis ein gültiger anderer Kandidat die Haltezeit erfüllt. Bei `showNoVideo` an kann ein Kandidat ohne Kamera Ziel werden; der Slot zeigt dann das Ersatzbild mit `speakerNoVideo`.
8. Beim Einschalten ohne Eintrag in der Erinnerung: `fallback/speakerNone`, bis das erste Signal kommt.

Ob die Sprecher-Signale auch kommen, solange die Bridge nicht per `JoinVoip` am Ton des Meetings teilnimmt (heute nur über das Ton-Abo, `session.cpp:552-563`, `audio.cpp:203`), sagt kein Header (AN17, MS22; Nachbesserung B36). Bleiben sie aus, steht der Slot auf T26, und die Messwerte zeigen eine leere Signal-Tabelle.

### 6.9 Modus Bildschirmfreigabe (`native/slot_logic.h`, `FreigabeListe`)

Reine Logik; eine Liste je Bridge, alle Freigabe-Slots zeigen dieselbe gezeigte Freigabe (E20). Ein Eintrag ist `{share, user, status, type, audioOnly, seq, pauses}`.

| Eingang (`SharingStatus`, `zoom_sdk_def.h:561-585`) | Wirkung |
| --- | --- |
| `Sharing_Other_Share_Begin` | Eintrag `{share, user, running, type = contentType (auch vorläufig UNKNOWN), seq = ++n}`. Kennung 0 → Eintrag je Person (**Annahme** AN19, MS6), die Kennung zieht der Typ-Nachtrag nach |
| `Sharing_Other_Share_End` | Eintrag entfernen |
| `Sharing_Pause` / `Sharing_Resume` | Eintrag `paused` / `running`, `pauses` zählt; ist `shareSourceID` 0, gilt es für alle Einträge dieser Person (**Annahme** AN8, Header schweigt, MS6) |
| `Sharing_Other_Share_Pure_Audio_Begin/End` | Eintrag mit `audioOnly`; nie gezeigt (Nicht-Ziel, FP6) |
| Typ-Nachtrag (`onShareContentNotification`) | Typ des passenden Eintrags (gleiche Person und Kennung, sonst der Eintrag dieser Person mit Kennung 0, dessen Kennung dann nachgezogen wird) übernehmen, **ohne** neues `seq`; ohne passenden Eintrag nichts. Typ `SHARE_TYPE_COMPUTER_AUDIO` (`zoom_sdk_def.h:443`) setzt `audioOnly`, damit eine reine Ton-Freigabe auch auf diesem Weg nie eine Bildfreigabe verdrängt (Nachbesserung B37) |
| `Sharing_Self_*`, `Sharing_View_Other_Sharing` | nichts (wir teilen nie; nur stderr) |
| Weggang einer Person (Merker) | ihre Einträge entfernen (**Annahme** AN9: auch ohne `Share_End`; Abnahme E7) |
| `MEETING_STATUS_INMEETING` (Merker, 6.6 Nr. 4) | Liste **leeren** (Kennungen wechseln) und befüllen |
| Entzug der Aufnahme-Erlaubnis (6.15) | nichts: die Liste **bleibt**, aus demselben Grund wie die Sprecher-Erinnerung (6.8): Die Kennungen gelten im selben Meeting weiter, und der Freigabe-Lauscher hängt nicht an der Erlaubnis, er füttert die Liste weiter (6.5, 6.6 Nr. 4). Nach der Wiedererteilung zeigen die neu gestarteten Freigabe-Slots sofort die gezeigte Freigabe, auch wenn das Befüllen im Custom-UI-Modus nichts liefert (AN14; Nachfix W3) |
| erstes Einschalten eines Freigabe-Slots | befüllen, aber **nur ergänzen**: was schon bekannt ist, bleibt mit seinem `seq` (Nachbesserung B38) |

**Befüllen:** `GetViewableSharingUserList()`, je Person `GetSharingSourceInfoList(user)` (`meeting_sharing_interface.h:433`, `:442`). Im Custom-UI-Modus der Bridge (`session.cpp:106`) ist die zweite Liste laut Header an das nicht vorhandene `ICustomizedShareRender::SetUserID` gebunden (`:440`); sie kann leer bleiben (AN14, MS3). Befüllte Einträge, die noch fehlen, bekommen ein `seq` **unter** allen per Rückruf bekannten (sie begannen vor dem Ankommen), untereinander in Listenreihenfolge (**Annahme** AN20: Der Header sagt nichts zur Reihenfolge). `seeded` = `ok`, `empty` (Listen leer) oder `unavailable` (Zeiger `nullptr`). Ein leeres oder fehlendes Ergebnis löscht nie einen bekannten Eintrag.

**Gezeigt** wird der Eintrag mit dem höchsten `seq`, der nicht `audioOnly` ist (laufend oder pausiert). Ändert sich die gezeigte Freigabe, hängen alle Freigabe-Slots um: `slotRetarget(SHARE, shareId, shareChanged)`, `shareUser` = Person. Gibt es keine: `slotRetarget(0, shareNone)`. Pause ändert nichts am Abo.

**Zustand bei Pause und stehendem Bildschirm** (Nachbesserung B46, B53, B66; Nachfix W1): Gesendet wird ab 200 ms ohne Bild die Kopie des letzten Bildes **dieses Ziels** (6.12, `sent = held`); Beginn und Ende dieses Haltens ändern `sent` und melden je ein `slot`-Ereignis (6.3), der Zustand bleibt dabei `live`. Der **Zustand** wechselt erst nach 2 s ohne Bild (Zustandsschwelle, getrennt vom Sendetakt; so flackert die Kachel nicht bei jeder Mausbewegung): mit Kopie dieses Ziels `held/sharePaused` bzw. `held/shareStill`, ohne Kopie `fallback/sharePaused` bzw. `fallback/noFrames` mit Ersatzbild. Zwischen 200 ms und 2 s gilt also `live` mit `sent = held`; die Kachel zeigt dann weiter T28/T28b (10.2 Regel 4), die Vorschau die letzte Vorschau dieses Ziels (7.7). **Vor dem ersten Bild** dieses Ziels gibt es keine Kopie, gesendet wird das Ersatzbild (6.10 Schritt 6), und der Zustand bleibt `starting` (6.12), auch bei `noShareData`; einzige Ausnahme: Ist die gezeigte Freigabe pausiert und kam seit dem Umhängen 2 s lang kein Bild, wechselt er auf `fallback/sharePaused` (T29d). Ein `RawData_Off` am Freigabe-Renderer setzt nie `cameraOff`; solange die Freigabe besteht, gilt dieselbe Regel. Jede Änderung meldet `shares`, jeder Freigabe-Rückruf landet in `recent` (6.3; Messpunkt MS6).

### 6.10 Umhängen (`slotRetarget`) und Moduswechsel

Einziger Ort, an dem ein Renderer abonniert, abgemeldet oder umgehängt wird; nur in der Hauptschleife. **Jeder** Weg mit `unSubscribe` geht hier durch: Ziel- und Moduswechsel, Rückkehr, Weggang (6.7), Sprecher geht (6.8 Nr. 6), Freigabe endet oder wechselt (6.9), Auflösung (6.11). Die Entscheidung, welcher Schritt auf welche SDK-Antwort folgt, ist eine reine Funktion `umhaengPlan(lage, antwort)` in `native/slot_logic.h` (PB21).

0. **Sperre:** Gilt die Renderer-Sperre (6.5), ruft die Bridge nichts auf; das gewünschte Ziel wird vorgemerkt und nach `INMEETING` umgehängt (6.6 Nr. 5).
1. `umhaengen = true` (Riegel). War das Abo abonniert und `rendererTot` nicht gesetzt: `unSubscribe()` (Fehler nur stderr). `subscribed = false`.
2. `rendererTot` gesetzt: Zeiger verwerfen (nie `destroyRenderer`, nie ein anderer Aufruf), `createRenderer` mit einem **neuen** Delegate, Zähler `rendererLost`. Scheitert `createRenderer`: `fallback/subscribeFailed`, Fehler `slotSubscribeFailed` mit `sdk` der Rückgabe; der Slot läuft mit Ersatzbild weiter.
3. Ziel 0 → weiter mit Schritt 6 ohne Abo, Zustand `fallback` mit dem **Ziel-0-Grund** (Nachfix W7): der Grund des Aufrufs, wenn er schon „kein Ziel“ sagt (`participantLeft`, `noTarget`, `speakerNone`, `shareNone`), sonst nach Modus `noTarget` (Teilnehmer), `speakerNone` (Sprecher) bzw. `shareNone` (Freigabe). Das gilt für jeden Aufrufer, auch für das erste Ziel nach `slotOn`, einen Moduswechsel (`modeChanged`), ein `slotSet {id:0}` aus dem Abgleich (`targetChanged`) und eine neue Auflösung (`resolutionChanged`). Die Gründe `modeChanged`, `targetChanged` und `resolutionChanged` stehen darum nur mit einem Ziel ≠ 0; die Kachel nennt bei Ziel 0 so immer, warum es keins gibt (Teilnehmer T13, T13b, T16, T17 oder T18; Sprecher T26; Freigabe T29c), nie „erstes Bild steht noch aus“ (10.2).
4. `setRawDataResolution(res)`; Rückgabe in `resSet` (E7); danach `getResolution()` in `resGot` (`rawdata_renderer_interface.h:59`; Nachbesserung B48).
5. `subscribe(id, typ)`; die Antwort bestimmt den nächsten Schritt (Nachbesserung B30):

| Rückgabe | Wirkung |
| --- | --- |
| `SDKERR_SUCCESS` | weiter mit Schritt 6 |
| `SDKERR_TOO_FREQUENT_CALL` (18, `zoom_sdk_def.h:80-81`) | Wiederholung nach 500 ms aus `slotLogicTick`, höchstens dreimal, Zähler `tooFrequent`; danach wie „anderer Fehler“ |
| `SDKERR_NO_SHARE_DATA` (29, `zoom_sdk_def.h:102-103`), nur SHARE | **kein** neuer Renderer; Wiederholung alle 500 ms, solange diese Freigabe gezeigt wird, Zähler `noShareData`; Zustand bleibt `starting/<grund>` (T20). Ob `subscribe(SHARE)` bei `Sharing_Other_Share_Begin` sofort liefert oder zuerst 29 antwortet, ist Messpunkt MS27 |
| `SDKERR_SHARE_CANNOT_SUBSCRIBE_MYSELF` (30, `:104-105`) | kommt nicht vor (die Bridge teilt nie, 6.9); behandelt wie „anderer Fehler“, mit stderr-Zeile |
| anderer Fehler, Typ gegenüber dem letzten Abo dieses Renderers **geändert** | `destroyRenderer`, `createRenderer` mit demselben Delegate (AN11), Schritt 4, `subscribe`; Zähler `rendererNew` zählt nur diesen Fall (Messpunkt MS5) |
| anderer Fehler sonst, auch nach neuem Renderer | `fallback/subscribeFailed`, Fehler `slotSubscribeFailed` mit `sdk` und `type`; der Slot läuft mit Ersatzbild weiter und zählt als offen (10.1); neuer Versuch beim nächsten Umhängen oder mit „Stopp“ und „Start“ (T20c) |

6. Unter `fieldMutex`: `abo.ziel = ZielStand{}` (6.1: Bild- und Messfelder, Kopie ungültig; den Ton-Stand ersetzt nur Schritt 8), `abo.ziel.retargetMs = jetzt`, Ziel und Typ setzen. Dann `subscribed = true` (nur nach Erfolg) und `umhaengen = false`. Wie heute sendet der Herzschlag sofort das Ersatzbild, bis das erste Bild kommt (`video.cpp:1153-1158`); eine Kopie eines früheren Ziels sendet er nie (6.12). Der Vorschau-Platz des Slots wird geleert (6.16).
7. Typ VIDEO: `IsVideoOn()` des Ziels abfragen (`meeting_participants_ctrl_interface.h:127`); aus → sofort `fallback/cameraOff` (eine Rückkehr mit ausgeschalteter Kamera zeigt so gleich T19, nicht T20; Nachbesserung B31).
8. `slot starting/<grund>` (bzw. `fallback/<grund>`). Ton beim Umhängen **ohne** Moduswechsel neu zuordnen nur, wo er am Ziel hängt (Nachbesserung B25): Person-Ton (`slotAudio waiting/targetChanged`, bei Ziel 0 `off/participantLeft`) und beim Wechsel der Freigabe der Computerton (`waiting/targetChanged`); nur dort beginnt auch der Ton-Stand neu (`ton = TonStand{}`, 6.1), bei einem Mischer-Slot (6.13) nur dessen Eingang B; direkter Computerton (Tonweg `share` ohne Person-Ton) meldet bei Ziel 0 statt `waiting/targetChanged` `off/noShare` (6.13; Fünfte Runde, `noShare`); mit Person-Ton (Tonweg `share` im Modus Freigabe, Ton-Abbildung 7.1, letzte Zeile) beginnt beim Wechsel der Freigabe nur der Ton-Stand neu, gemeldet wird nichts: Zustand und Grund bleiben `off/personNotInMode` (6.13; Sechste Runde RN5). Der Mischton hängt an keinem Ziel und läuft ungestört weiter, ohne Ereignis; sein Ton-Stand (Format, Messfenster, Stille-Herzschlag) bleibt (Restrunde RR8: Bis zur Restrunde ersetzte Schritt 6 auch die Ton-Felder, so dass ein Sprecher-Slot mit Mischton bei jedem Sprecherwechsel Format und Messwerte verlor und der Stille-Herzschlag bis zum nächsten Paket aussetzte, `video.cpp:999-1004`, `:1010-1013`). **Beim Moduswechsel** zählt stattdessen allein der **Tonweg** (Restnachfix N1): die Zusammensetzung, die der Slot nach der Ton-Abbildung (7.1, Spalte „gesendet“) im jeweiligen Modus sendet, als reine Funktion `tonWeg(mode, audio, shareAudio)` in `native/slot_logic.h` mit den Werten `none`, `mix`, `person`, `share` und `mixShare`; sie ist zugleich das `configured` von `slotAudio` (6.3). Bleibt der Tonweg gleich (über einen Moduswechsel nur als `mix` → `mix` oder `none` → `none` möglich, weil `person` nur im Modus Teilnehmer und `share`/`mixShare` nur im Modus Freigabe vorkommen), bleiben Ton-Stand und Mischer, ohne Ereignis. Ändert er sich, wechselt der gesendete Strom die Quelle wie bei `slotSet {audio|shareAudio}` (6.13): `ton = TonStand{}`; wird der Slot Mischer-Slot (`mixShare`), beginnt auch der Mischer neu (6.13); die Bridge meldet `slotAudio` mit dem neuen `configured`, und zwar `off/personNotInMode` bei Person-Ton außerhalb von Teilnehmer (6.13), `off/participantLeft` bei Person-Ton ohne Ziel (wie oben), `off/noShare` beim Tonweg `share` ohne Person-Ton und ohne gezeigte Freigabe (Ziel 0, 6.13), `off/modeChanged` beim Tonweg `none`, sonst `waiting/modeChanged`; ein Slot auf `off/audioUnavailable` bleibt dort (6.13). Das trifft die Vorgabe jedes neuen Slots (Ton an, Mischton, Computerton an; 7.1, 7.6): Teilnehmer oder Sprecher → Freigabe schaltet den Mischer ein (`mix` → `mixShare`), Freigabe → Teilnehmer oder Sprecher schaltet ihn aus und den Stille-Herzschlag wieder ein (`mixShare` → `mix`). Weil der Ton-Stand dabei neu beginnt, setzt der Stille-Herzschlag erst nach dem ersten Mischton-Paket wieder ein (Format bekannt, `video.cpp:999-1004`, `:1035`) und nie ab einem `lastAudioMs` von vor der Mischer-Zeit; sonst rechnete er ab `max(silenceBisMs, lastAudioMs)` und schöbe bis zu 200 ms Stille nach (`video.cpp:1050`, `:1063-1067`), die der Mischer schon gefüllt hat, also mehr Ton als Wanduhrzeit (das schließt 0.35 aus). Ob der Ton-Stand oder der Mischer neu beginnt und ob `slotAudio` gemeldet wird, gibt `umhaengPlan` als Schritte `TonStandNeu`, `MischerEingangBNeu`, `MischerNeu` und `TonMelden` (mit Zustand und Grund) an (PB21, PB22).

**Riegel** (I3 aus Stage 4 auf alle Wege übertragen; Nachbesserung B10, B31): Der Bild-Rückruf verwirft jedes Bild, solange `subscribed` false oder `umhaengen` true ist (Zähler `lateFrames`); der Status-Rückruf verwirft `RawData_On`/`RawData_Off` ebenso. Gemessen laufen Rückrufe während des Abbaus weiter (`video.cpp:57-61`), und nach `unSubscribe()` kam noch ein `RawData_Off` (`video.cpp:45-51`); ob es innerhalb von `unSubscribe()` oder danach auf einem SDK-Thread ankommt, ist ungemessen (AN22) und ohne Folge, weil der Riegel beides gleich verwirft. Ein Messpunkt ist es nicht: Kein Zähler trennt die beiden Fälle, und die Abnahme hätte kein Feld dafür (MS29 entfällt, Restrunde RR2). Ein spätes Bild des alten Ziels, das erst **nach** der Rückkehr von `subscribe()` eintrifft, lässt sich ohne `GetSourceID()` nicht erkennen; es zählt in `foreignFrames`, wenn die Kennung abweicht, und geht hinaus (FP5).

**Erstes Bild danach:** `bildSeitUmhaengen = true`, `live/frames`. Die Lücke `gapMs = jetzt − retargetMs` endet am ersten Bild, dessen `GetSourceID()` (`zoom_sdk_raw_data_def.h:231`) dem Ziel gleicht; ein abweichendes Bild endet sie nicht. Kommt 2 s lang kein passendes Bild (etwa weil `GetSourceID()` bei VIDEO etwas anderes liefert, MS4), endet sie am ersten Bild nach Schritt 6, mit `gapUngeprueft = true` (Nachbesserung B10 c).

**Moduswechsel** (`slotSet {mode}`): neues Ziel nach dem neuen Modus (Teilnehmer: `id` aus demselben Befehl, sonst 0; Sprecher: Kandidat aus der Sprecher-Erinnerung nach 6.8 Nr. 2, sonst 0; Freigabe: gezeigte Freigabe oder 0), dann `slotRetarget` mit `modeChanged`. Wechsel von oder zur Freigabe leeren die Versatz-Warteschlange (6.14). Die Kopie ist danach ungültig (Schritt 6). Der Ton folgt dem Tonweg (Schritt 8; Restnachfix N1). Der Sender bleibt in jedem Fall.

**Zwei Slots auf dasselbe Ziel** (Teilnehmer- und Sprecher-Slot auf derselben Person, mehrere Freigabe-Slots; Nachbesserung B35): Die Bridge behandelt jeden Slot für sich, ohne Vorrang. Ob Zoom zwei Renderer auf dieselbe Kennung bzw. dieselbe Freigabe zugleich beliefert, steht in keinem Header (`rawdata_renderer_interface.h:51-58`) und war nie gemessen, weil die heutige Bridge ein zweites Abo ablehnt (`video.cpp:322`, `videoAlreadySubscribed`; AN21, MS21). Lehnt Zoom das zweite Abo ab, gilt die Tabelle (`subscribeFailed`). Nimmt Zoom es an und einer der beiden bekommt keine Bilder mehr, meldet er `noFrames` (nicht `cameraOff`, weil Zoom die Kamera als an meldet). In beiden Fällen nennt die Kachel den anderen Slot (T97). Rückfallebene, falls MS21 „nein“ ergibt: RS15.

### 6.11 Auflösung

- Zuordnung `360p` → `ZoomSDKResolution_360P`, `720p` → `_720P`, `1080p` → `_1080P` (`rawdata_renderer_interface.h:12-20`). `90p`/`180p` bleiben im Katalog `VIDEO_RESOLUTIONS` (`src/protocol.ts:35`), sind für Slots aber nicht wählbar.
- Gesetzt vor jedem `subscribe` (6.10 Schritt 4), auch für SHARE (ob SHARE die Stufe einhält: MS1). Nach dem Setzen liest die Bridge `getResolution()` zurück (`rawdata_renderer_interface.h:59`, `resGot`).
- `slotSet {resolution}` hängt den Slot auf dasselbe Ziel neu um (`resolutionChanged`). Das Umhängen ist der sichere Weg; ob Zoom eine neue Stufe auch ohne Umhängen übernähme, prüft 0.4.0 nicht (die frühere zweite Hälfte von MS2 ist damit gestrichen, Nachbesserung B48).
- Gemessen je Bild: Breite und Höhe (`GetStreamWidth`/`GetStreamHeight`), Bildzähler; alle 2 s `w`, `h`, `fps` in `slotStats` aus dem laufenden Fenster (6.3). Zusätzliche Quellen, deren Bedeutung der Header offenlässt, gehen als Messwerte mit, nie als Tatsache (Nachbesserung B40): `GetUserVideoSize(Ziel)` (`meeting_video_interface.h:715-720`, Doku: `Gets the size of user's video`; ob Sende- oder Empfangsgröße, sagt der Header nicht), die HD-Einstellungen (`setting_service_interface.h:1031-1054`) und meetingweit `recvResolution`/`recvFps` (`meeting_service_interface.h:584`, `:590`, `:1100`, `:1107`); Messpunkt MS24.
- Die HD-Einstellungen liest die Bridge nur (`IsHDVideoEnabled`, `IsAlwaysUseOriginalSizeVideo`, über `GetVideoSettings()`, `setting_service_interface.h:3430`); sie ruft nie `EnableHDVideo` oder `EnableAlwaysUseOriginalSizeVideo`. Den Einstellungsdienst legt sie dafür nach der Anmeldung einmal an und beim Beenden ab; scheitert das, fehlen die beiden Felder in `bridgeStats` (heute fasst die Bridge den Dienst nicht an).
- Nenngröße für Ersatzbilder vor dem ersten Bild wie heute (`video.cpp:288-308`).

### 6.12 Ersatzbild und Halten

| Lage | gesendet | `sent` |
| --- | --- | --- |
| Bild jünger als 200 ms | nichts zusätzlich | `none` |
| Freigabe-Slot, gezeigte Freigabe besteht, Kopie **dieses Ziels** vorhanden | Kopie, höchstens alle 200 ms | `held` |
| sonst, Ersatzbild `transparent` | UYVA, Alpha 0, höchstens alle 100 ms | `transparent` |
| sonst, `black` | I420 Y 16, U/V 128 (heutiger Puffer, `ndi_sender.cpp:66-72`) | `black` |
| sonst, `white` | I420 Y 235, U/V 128 | `white` |
| sonst, `freeze` mit Kopie **dieses Ziels** | Kopie | `freeze` |
| sonst, `freeze` ohne Kopie dieses Ziels | wie `transparent` (Kachel T60) | `transparent` |

- „Kopie dieses Ziels“ heißt `ziel.kopieGueltig`: Das Umhängen setzt es zurück (6.10 Schritt 6), auch bei einem Moduswechsel. Eine Kopie eines früheren Ziels oder Modus geht also nie hinaus; nach einem Wechsel von Freigabe A auf B sendet der Slot bis zu Bs erstem Bild das Ersatzbild, nicht As Bildschirm (Nachbesserung B53). Damit entfällt der Widerspruch der ersten Fassung zwischen „sofort das Ersatzbild“ (6.10) und der Kopie-Zeile dieser Tabelle. Bei `freeze` heißt das: Nach einem Sprecher- oder Personenwechsel zeigt der Slot bis zum ersten Bild der neuen Person transparent, nicht das eingefrorene Bild der vorigen.
- Größe: letzte gelieferte dieses Ziels, sonst Nenngröße (6.11). Die Puffer für transparent, schwarz und weiß werden je Größe einmal angelegt und wiederverwendet (Muster `ndi_sender.cpp:131-140`).
- Die **Kopie** legt der Bild-Rückruf nur an, wenn das Ersatzbild `freeze` ist oder der Slot im Modus Freigabe läuft; dann **jedes** Bild (E9), mit `try_lock` auf den Kopierpuffer (ist er gerade beim Senden in der Hand der Hauptschleife, fällt diese eine Kopie aus). Nach der ersten Kopie `kopieGueltig = true`. Gemessen in `copyUs`.
- `NdiSender` bekommt `sendUYVA`, `sendWhite`, `sendTransparent` und `sendCopy`; die Versatz-Warteschlange bekommt eine Bildart (`I420`, `schwarz`, `weiß`, `transparent`) statt nur „Bild oder schwarz“ (`delay_line.h:70-71`), mit Tests (11.1).
- **Zustand und Grund** setzt die Hauptschleife (`videoTick`), nicht der Herzschlag allein (Nachbesserung B52):
  - VIDEO-Slot, 200 ms ohne Bild nach `live`: `fallback/cameraOff`, wenn Zoom für das Ziel die Kamera als aus meldet (`videoStatus` oder `IsVideoOn()` = `false`, 6.7); sonst `fallback/noFrames`. Ein laufender `bufferMismatch` bleibt stehen (wie `video.cpp:1192`).
  - Freigabe-Slot: siehe 6.9 (Senden ab 200 ms, Zustand ab 2 s; `held` nur mit Kopie dieses Ziels, sonst `fallback/sharePaused` bzw. `noFrames`). Nie `cameraOff`.
  - Vor dem ersten Bild nach `slotOn` oder einem Umhängen bleibt der Zustand `starting` (Muster `video.cpp:1153-1158`), mit drei Ausnahmen: 6.10 Schritt 7 meldet schon `cameraOff`; bei Ziel 0 gilt `fallback` mit dem Ziel-0-Grund (6.10 Schritt 3); ein Freigabe-Slot, dessen gezeigte Freigabe pausiert ist, wechselt nach 2 s ohne Bild auf `fallback/sharePaused` (6.9; Nachfix W1).
- `sent` geht mit jedem `slot`-Ereignis hinaus und wechselt mit einem Zustandswechsel, mit `slotSet {fallback}` und, nur bei Freigabe-Slots, mit Beginn und Ende des Haltens im Zustand `live` (200 ms ohne Bild → `held`, nächstes Bild → `none`; 6.9) (Nachbesserung B54; Nachfix W1). Jeder Wechsel von `sent` meldet ein `slot`-Ereignis (6.3); Connect leitet daraus „Ersatzbild {art}“, T60 und die Vorschau-Malerei ab (10.2, 7.7). Die Einstellung allein sagt nicht, was gesendet wird: Wer bei schon ausgeschalteter Kamera auf „eingefroren“ umstellt, hat keine Kopie, die Bridge sendet transparent, und `sent` sagt das.

### 6.13 Ton je Slot

- `AudioPacket` (`audio.h:20-49`) bekommt `kind` (`person`, `mix`, `share`); `userId` ist bei `mix` 0.
- `onMixedAudioRawDataReceived` und `onShareAudioRawDataReceived` werden wie der Person-Ton kopiert und eingereiht (heute leere Rümpfe, `audio.cpp:91-92`; Kommentar `:87-90` berichtigen). Dolmetscher-Ton bleibt leer (`:93`); diesen Rückruf liefert das Abo ohnehin nur mit `bWithInterpreters = true` (`rawdata_audio_helper_interface.h:73-74`), die Bridge setzt `false` (`audio.h:55-57`).
- Warteschlange 512 Pakete statt 256 (`audio.cpp:51`); die Summe mehrerer Arten ist ungemessen, ein Überlauf bleibt sichtbar (`audioQueueOverflow`, Hinweis Q6).
- **Freigabe-Ton vor der Zuordnung gezählt** (Nachbesserung B39): Jedes `share`-Paket zählt in `bridgeStats.shareAudioPackets`, jedes, das keinem Slot zugeordnet wird, in `shareAudioUnassigned`, dazu `shareAudioLastId` (die Kennung des letzten Pakets). So unterscheidet die Anzeige „nichts angekommen“ (T64) von „angekommen, keiner Freigabe zuzuordnen“ (T64c). Dass `user_id` in `onShareAudioRawDataReceived` die teilende Person ist, ist **Annahme** (AN18): Der Header nennt nur den Parameternamen (`rawdata_audio_helper_interface.h:18`); gemessen ist die Bedeutung nur für den Person-Ton (`audio.cpp:38-43`, `:95-110`).
- **Zuordnung** im Herzschlag (heute `video.cpp:721-958`) als reine Funktion `tonZiele(paket, slots)` in `native/slot_logic.h` (Eingang: Art, Kennung und je Slot läuft, Modus, Ziel, `audio`, `shareAudio`, `shareUser`; Ausgang: Liste von Slot und Weg `direkt`/`Mischer A`/`Mischer B`; PB25; Nachbesserung B76):

| Paket | geht an |
| --- | --- |
| `person`, Kennung k | jeden laufenden Teilnehmer-Slot mit Ziel k (k ≠ 0) und `audio = person` |
| `mix` | jeden laufenden Slot mit `audio = mix`; bei Freigabe-Slots mit `shareAudio` in den Mischer (Eingang A) |
| `share`, Kennung k | jeden laufenden Freigabe-Slot mit `shareAudio` und `shareUser = k`; mit `audio = mix` in den Mischer (Eingang B), sonst direkt |

- Was Connect als `audio` und `shareAudio` sendet, legt die Ton-Abbildung in 7.1 fest (Nachbesserung B2, B57). Die Bridge prüft nur ihre Felder.
- **Mischer mit eigener Uhr** (`native/audio_mix.h`, header-only, Zeit eingespeist; Nachbesserung B17): Je Freigabe-Slot mit Mischton und Computerton (**Mischer-Slot**, Tonweg `mixShare`, 6.10 Schritt 8) zwei Eingänge. Die Ausgabe folgt der Wanduhr: Je Herzschlag gibt der Mischer genau die seit seiner letzten Ausgabe verstrichene Zeit aus, in 10-ms-Schritten. Er beginnt, sobald ein Eingang 40 ms Vorlauf hat. Wird ein Slot Mischer-Slot, per `slotOn`, per Moduswechsel auf Freigabe (6.10 Schritt 8) oder per `slotSet {audio|shareAudio}` (unten), fängt der Mischer **von vorn** an (`mix = AudioMix{}`: Uhr, Eingänge, Vorlauf); sonst gäbe er nach Freigabe → Sprecher → Freigabe oder nach Computerton aus → an beim nächsten Herzschlag die ganze Zeit seit seiner letzten Ausgabe aus, mit alten Resten in den Eingängen (Restnachfix N1). Fehlt einem Eingang etwas, füllt er dessen Anteil mit Stille auf, statt zu warten (gezählt in `mixSilenceMs`); die Summe wird auf den 16-Bit-Bereich begrenzt. Rückstand über 200 ms je Eingang wird am ältesten Ende verworfen (`mixDrops`, in ms). Passen Rate oder Kanalzahl nicht zusammen, geht nur der Computerton hinaus, `slotAudio … rateMismatch` (T76). Für Mischer-Slots ist der Stille-Herzschlag aus; der Mischer liefert die Stille selbst. So sendet ein Mischer-Slot nie mehr Ton als Wanduhrzeit, und ein Aussetzer des Computertons lässt keinen bleibenden Rückstand zurück (die erste Fassung hielt bis zu 60 ms zurück, während der Stille-Herzschlag schon nach 40 ms Stille einfügte, `video.cpp:1020-1035`). Laut Beitrittsparametern sind alle Wege mono mit 32 kHz (`meeting_service_interface.h:285-288`); gemessen wird je Paket (`audio.cpp:99-100`).
- **Person-Ton außerhalb des Modus Teilnehmer:** keine Pakete, `slotAudio off/personNotInMode` (0.7); läuft der Computerton daneben, sagt das die Tonzeile (T75b).
- **Direkter Computerton ohne gezeigte Freigabe** (Fünfte Runde, `noShare`): Ein Freigabe-Slot mit `audio = off` und `shareAudio` (Tonweg `share` ohne Person-Ton, Ton-Abbildung 7.1, zweite Zeile) hat ohne gezeigte Freigabe (Ziel 0, `shareUser` = 0) nichts zu senden. Die Bridge meldet dann `slotAudio off/noShare`: beim Ende der gezeigten Freigabe und beim Moduswechsel auf Freigabe ohne Freigabe statt `waiting/…` (6.10 Schritt 8), beim Einschalten (`slotOn`, `slotSet`) unmittelbar nach dem `waiting/command`, das die Rücksetzregel aus 7.1 braucht. Beginnt eine Freigabe, folgt `waiting/targetChanged`, nach dem ersten Paket `live/packets`. Bis zur fünften Runde setzte die Bridge `noShare` an keiner Stelle, und 10.6 Regel 7 (T58f) war unerreichbar. Mit Person-Ton (Tonweg `share` im Modus Freigabe, Ton-Abbildung 7.1, letzte Zeile) bleiben Zustand und Grund `off/personNotInMode` (oben), solange der Modus bleibt, auch beim Ende und Beginn einer Freigabe, bei den ersten Paketen und bei Stille; nur `source` folgt der Messung (`share` oder `none`, je mit Ereignis, 6.3), und der Ton-Stand beginnt beim Freigabewechsel neu (6.10 Schritt 8; Sechste Runde RN5). Die Tonzeile regelt 10.6 Regel 4.
- **Umschalten am laufenden Slot** (`slotSet {audio|shareAudio}`): Zuordnung sofort ändern; aus → `slotAudio off/command`; an → `waiting/command`, nach dem ersten Paket `live/packets`. Jede Änderung von `audio` oder `shareAudio` ersetzt den Ton-Stand (`ton = TonStand{}`, 6.1), denn der gesendete Strom wechselt die Quelle: Format und Messfenster werden mit dem ersten Paket der neuen Zusammensetzung neu gemessen, und der Stille-Herzschlag setzt erst danach wieder ein (Regel „erst nach dem ersten echten Paket“, `video.cpp:999-1004`; Restrunde RR8). Wird der Slot dabei Mischer-Slot (Tonweg wird `mixShare`), beginnt auch der Mischer neu (oben; Restnachfix N1); denselben Ton-Stand-Wechsel löst ein Moduswechsel aus, der den Tonweg ändert (6.10 Schritt 8). **Jedes** Einschalten von Ton (`slotOn` mit `audio ≠ off` oder `shareAudio`, `slotSet` auf an) ruft `audioEnsureSubscribed()`; die Funktion ist idempotent und versucht es nach einem Fehler neu (`audio.cpp:180-181`, `:203-224`), so wirkt der Handgriff aus T104 (Nachbesserung B70). Gelingt sie, meldet die Bridge `waiting/command`; scheitert sie, zuerst den Ton-Abo-Fehler (mit `slot`, 6.4) und dann `slotAudio off/audioUnavailable`, und der Slot bleibt ohne Ton, auch über ein Umhängen hinweg, bis an ihm Ton wieder eingeschaltet wird (wie 0.3.0: `waiting/command` bzw. `audioOn = false` und `off/audioUnavailable`, `packages/zoom-bridge/native/video.cpp:434-454`). `waiting/command` meldet die Bridge nur unmittelbar nach einem geglückten `audioEnsureSubscribed()`; dazu ruft sie es bei jedem `slotSet`, das `audio` ≠ `off` oder `shareAudio` = `true` enthält (idempotent). Connect nutzt das für die Rücksetzregel des Ton-Abo-Fehlers (7.1; Nachfix W6).
- **`slotAudio.source`** ist die im letzten 500-ms-Fenster tatsächlich gesendete Zusammensetzung, `configured` die eingestellte (6.3). Fällt im Mischer der Computerton weg, wechselt `source` von `mixShare` auf `mix` (Ereignis), und die Tonzeile sagt „Computerton kommt nicht an“ (T58g; Nachbesserung B56).
- **Stille-Herzschlag** wie heute je Slot mit zugeordnetem Ton (`video.cpp:1005-1118`), außer bei Mischer-Slots; Person-Ton und Computerton (Tonwege `person` und `share`) zählen nur mit Ziel ≠ 0 (ersetzt die Bedingung `teilnehmerWeg`, `video.cpp:1030-1035`; ohne diese Regel sendete der Herzschlag nach dem Ende einer Freigabe weiter Stille und überschriebe `off/noShare` mit `silent/gap`; Fünfte Runde, `noShare`); Mischton (`mix`) hängt an keinem Ziel und zählt auch mit Ziel 0, etwa im Sprecher-Slot ohne Sprecher (Sechste Runde RN7). Ob und wie viel Stille fällig ist und wie weit der Strom danach gefüllt ist, entscheidet eine reine Funktion `stilleBloecke(tonWeg, ziel, ton, jetzt)` in `native/slot_logic.h` mit der heutigen Rechnung (Schwelle 40 ms, Beginn bei `max(silenceBisMs, lastAudioMs)`, höchstens 200 ms je Tick, erst mit bekanntem Format; `video.cpp:1035-1068`). Sie liefert die Zahl der Stille-Abtastwerte und den neuen `silenceBisMs`: gekappter Beginn plus tatsächlich gesendete Zeit (`video.cpp:1064-1067`, `:1086`), so verfällt der Rest über 200 ms, statt in den folgenden Ticks nachgeholt zu werden, wovor `video.cpp:1052-1062` warnt. `videoTick()` sendet nur, was sie liefert, und schreibt `silenceBisMs` unter `fieldMutex` fort (PB30; Sechste Runde RN6). Hört ein Slot auf, Mischer-Slot zu sein, beginnt sein Ton-Stand neu (6.10 Schritt 8, oben), und der Stille-Herzschlag setzt erst nach dem ersten Paket des neuen Tonwegs wieder ein, nie ab einem `lastAudioMs` von vor der Mischer-Zeit (Restnachfix N1).
- Das Ton-Abo bleibt bis Meeting-Ende oder Prozessende (wie `audio.h:89-117`). Ohne Ton-Slot tritt die Bridge nicht per `JoinVoip` bei (`audio.cpp:194-196`); ob die Sprecher-Signale dann trotzdem kommen, ist AN17/MS22 (6.8).

### 6.14 Bild-Versatz

`NdiSender` bekommt den Schalter „ohne Versatz“ (heute liest jeder Sender den globalen Wert, `ndi_sender.cpp:111`, `:147`, `:176`). Freigabe-Slots setzen ihn; ein Moduswechsel von oder zur Freigabe ruft vorher `clear()` der Warteschlange (`delay_line.h:168-172`). Der Speicher der Warteschlange je Slot steht in `slotStats.memKb`. Der Protokollvertrag „ein Wert für alle“ (`src/protocol.ts:130-133`) wird um „außer Freigabe-Slots“ ergänzt.

### 6.15 Abbau-Ketten

Welche Schritte eine Kette in welcher Reihenfolge ausführt, liefert eine reine Funktion `abbauPlan(kette)` in `native/slot_logic.h` als Schrittfolge (etwa `TonAusMelden`, `SlotAusMelden`, `VorschauPlatzAbmelden`, `Unsubscribe`, `DestroyRenderer`, `ZeigerVerwerfen`, `SenderZu`, `SlotLoeschen`, `InHalteliste`, `HaltelisteAbbauen`, `HaltelisteVerwerfen`, `FreigabenLeeren`, `ErinnerungLeeren`, `VorschauThreadEnde`, `StopRawRecording`, `SessionLeave`); ihr Eingang ist die Kette, ob die Renderer-Sperre gilt (Nachfix W2), und beim Nachlauf von `leave` die Rückgabe von `sessionLeave()` (Fünfte Runde N8). Diese steht erst fest, wenn die Slots abgebaut sind (`sessionLeave()` läuft nach `videoShutdownAll()`, `packages/zoom-bridge/native/main.cpp:196-198`; heute verwirft `leave` die Rückgabe, `:198`; Vertrag `session.h:185-200`). Darum führt der Ausführer `leave` in zwei Plänen aus: `abbauPlan(leave, sperre)` bis einschließlich `SessionLeave`, danach `abbauPlan(leaveNachlauf, sperre, verlassen)` mit `verlassen` = Rückgabe: `true` → `HaltelisteVerwerfen`, `false` → kein Schritt (Halteliste unten). Die Ketten in `video.cpp`/`main.cpp` führen nur den Plan aus, über einen Ausführer `abbauAusfuehren(kette, …)` in `native/video.cpp` mit einem Zweig je Schritt. PB20 prüft den Plan je Zeile dieser Tabelle, der Quelltext-Wächter (6.6, PT6 b) die Übergabe der richtigen Kette und dass die Zweige `ZeigerVerwerfen` und `HaltelisteVerwerfen` keine Renderer-Funktion rufen (Nachbesserung B4, B76; Restrunde RR3).

| Kette | Auslöser | Reihenfolge | Renderer | Sender | Listen |
| --- | --- | --- | --- | --- | --- |
| `slotOff` | Befehl | 6.2 | `unSubscribe` + `destroyRenderer`; bei `rendererTot` nur Zeiger verwerfen; bei Renderer-Sperre nichts davon, Slot in die Halteliste (unten) | zu | Vorschau-Platz abmelden |
| `leave` | Befehl | `audioShutdown()` → `slotsShutdownAll()` → `sessionLeave()` (heute `main.cpp:178-200`); danach Nachlauf-Plan mit dessen Rückgabe: `true` → Halteliste verwerfen, `false` → Halteliste bleibt (oben, unten; Fünfte Runde N8) | ja (wie `slotOff`, auch bei Sperre) | zu | Freigaben, Sprecher-Erinnerung leeren |
| quit / EOF | Befehl / stdin zu | `audioShutdown()` → **Vorschau-Thread beenden** → `slotsShutdownAll()` → `sessionShutdown()` (heute `:542-544`; der Vorschau-Thread endet vor dem Löschen der Slots, Nachbesserung B18) | ja (wie `slotOff`, auch bei Sperre; die Halteliste bleibt dann bis zum Prozessende stehen) | zu | ebenso |
| Meeting endet sich | `DISCONNECTING` / `RECONNECTING` → Merker | Renderer-Sperre an (6.5); gewünschte Umhängungen werden nur vorgemerkt | nicht angefasst | bleibt | – |
| Meeting-Ende | `ENDED`/`FAILED` → Merker | `audioClearSubscribed()` → `slotsMeetingEnded()`, **ohne** SDK-Aufruf am Renderer (gemessener Absturz, `video.cpp:544-566`) | nicht angefasst, Zeiger verworfen; Halteliste ebenso verworfen | zu | ebenso |
| Entzug | `onRecordPrivilegeChanged(false)` → Merker | `audioClearSubscribed()` → `slotsPrivilegeRevoked()` → `sessionStopRawRecording()` (heute `:436-443`; ST4 N4b.1) | ja (wie `slotOff`, auch bei Sperre) | zu | Freigaben **und** Sprecher-Erinnerung **bleiben** (Kennungen gelten im selben Meeting weiter, 6.8, 6.9; Nachfix W3) |
| Weggang | Merker `left` | `slotRetarget(0)` nach 6.7 bzw. 6.8 Nr. 6; 6.9 | nur `unSubscribe` (mit Riegel) | bleibt | Freigaben der Person entfernen; Erinnerung verliert ihre Kennung |
| Freigabe endet | Merker `onSharingStatus` | `slotRetarget` nach 6.9 | nur `unSubscribe` (mit Riegel) | bleibt | – |
| Zoom verbindet selbst neu | `INMEETING` erneut → Merker | Renderer-Sperre lösen, Halteliste abbauen (unten), eigene Kennung neu, Sprecher-Erinnerung leeren, Freigaben leeren und neu befüllen; dann je Slot `slotRetarget`: Teilnehmer-Slots Ziel 0 (`noTarget`), bis Connect neue Kennungen schickt (PK21); Sprecher-Slots Ziel 0 (`speakerNone`) bis zum nächsten Signal; Freigabe-Slots auf die gezeigte Freigabe | `unSubscribe` nur ohne `rendererTot`; sonst neuer Renderer (6.10 Schritt 2) | bleibt | neu befüllt |

In allen Ketten meldet jeder Slot `slotAudio off/<grund>` vor `slot off/<grund>` (Reihenfolge wie heute Ton vor Bild, `video.cpp:595-596`). Die frühen Rücksprünge bei leerer Karte (`video.cpp:637`, `:671`) bleiben, führen aber vorher die Listen-Schritte des Plans aus.

**Halteliste** (Nachfix W2): Gilt die Renderer-Sperre, wenn `slotOff`, `leave`, quit/EOF oder der Entzug einen Slot abbauen, darf die Bridge weder `unSubscribe`/`destroyRenderer` rufen (6.5) noch den Delegate freigeben: Der Renderer lebt womöglich weiter (AN25), das SDK ruft beim Abbau eines Renderers dessen Delegate (`onRendererBeDestroyed`, `rawdata_renderer_interface.h:36-40`), und der Delegate hält einen rohen Zeiger auf seinen Slot (heute `Delegate::owner_`, `packages/zoom-bridge/native/video.cpp:23-30`; Muster I6, `:484-512`). Darum, in dieser Reihenfolge: `imAbbau` und `subscribed = false` (Riegel, die Rückrufe kehren sofort zurück, 6.10), `slotAudio off/<grund>` und `slot off/<grund>` melden wie ohne Sperre, Vorschau-Platz abmelden, Sender schließen (`NdiSender::close()` arbeitet unter der Sperre des Senders, danach sendet er nichts mehr, `ndi_sender.cpp:261-268`, `:110`), dann den **ganzen Slot** samt Abo, Renderer-Zeiger und Delegate aus `g_slots` in die Halteliste `g_slotsHalt` verschieben (`InHalteliste`). Er zählt nirgends mehr, belegt weder Nummer noch NDI-Name, bekommt keinen Ton (6.13 geht nur über `g_slots`) und meldet nichts mehr; ein Rückruf, der den Riegel noch vor dem Verschieben passierte, trifft ein lebendes Objekt. Jeder Eintrag trägt die Nummer des Meetings, in dem er entstand (`join` zählt sie hoch). Abbau:
- `INMEETING` desselben Meetings (6.6 Nr. 4, nach dem Lösen der Sperre, vor jedem Umhängen; `HaltelisteAbbauen`): je Eintrag `unSubscribe` + `destroyRenderer` (bei `rendererTot` keins von beiden; Fehler nur auf stderr), dann löschen.
- `ENDED`/`FAILED` und `leave` nach einem `sessionLeave()`, das `true` lieferte (Meeting steht auf `ENDED`/`IDLE`, `session.h:190-200`; `HaltelisteVerwerfen`, bei `leave` im Nachlauf-Plan, oben): löschen ohne Renderer-Aufruf, wie die Meeting-Ende-Kette (heute `videoAbbauAlle(…, false)`, `video.cpp:567-621`).
- quit/EOF und `leave` nach einem `sessionLeave()`, das `false` lieferte (der SDK-Thread arbeitet noch, `session.h:190-200`, `main.cpp:544-560`): nichts; die Einträge bleiben bis zum Prozessende stehen, kein Aufruf am Renderer, kein Delegate wird frei, den das SDK noch kennen könnte. Einträge eines früheren Meetings fasst auch ein späteres `INMEETING` nie an.

`slotOn` legt während der Sperre nichts an (`slotReconnecting`, 6.2); Connect sendet `slotOn` ohnehin nur in `im_meeting` (7.3 Nr. 1), während der Sperre steht es in Z10 (`apps/connect/src/main/zoom/kern.ts:1251-1252`) und gleicht nach `inMeeting` ab (`:1253-1259`), so trifft die Ablehnung nur einen Befehl, der die Statusmeldung kreuzte, oder die Konsole. Die Zahl der Einträge steht als `halteliste` in `bridgeStats` und damit in T61 (eine Diagnose, die angezeigt wird); jede Bewegung schreibt dazu eine stderr-Zeile mit Slot-Nummer und Weg (ohne NDI-Namen, 0.23).

Ob das SDK bei einer eigenen Wiederverbindung (`RECONNECTING` → `INMEETING`) die Renderer abbaut, ohne `onRendererBeDestroyed` zu senden, ist ungemessen (AN25, MS25); kommt der Rückruf, fasst die Bridge den Zeiger nie mehr an (6.10 Schritt 2).

### 6.16 Vorschau-Weg

- **Vorschau-Modul** (`native/preview.cpp`, Nachbesserung B18): ein festes Feld `g_vorschau[16]`, ein Platz je Slot-Nummer, je Platz eine eigene Sperre, ein BGR-Puffer ≤ 192×108, die Ziel-Kennung des Bildes, die Zeit und die Kosten `previewUs`. Das Feld lebt so lange wie der Prozess. Ein Slot meldet seinen Platz bei `slotOn` an und bei `slotOff` und in jeder Abbau-Kette **vor** dem Löschen ab (Platz inaktiv, Puffer leer); das Umhängen leert den Platz (6.10 Schritt 6). Die Hauptschleife holt `previewUs` je Platz für `slotStats` ab; der Vorschau-Thread schreibt nie in ein Slot-Feld.
- **Erzeugen (Bild-Rückruf, SDK-Thread):** nur bei `previewMode on`, nur bei echten Bildern, höchstens alle 500 ms je Slot. Größe: in 192×108 eingepasst, Seitenverhältnis bleibt (eine 4:3-Freigabe wird 144×108). Verkleinern per Punktauswahl aus Y, U, V in BGR; mit `try_lock` in den Platz des Slots; ist er belegt, fällt dieses Bild aus. Kosten in `previewUs`.
- **Kodieren (Vorschau-Thread):** ein Thread für alle Plätze, gestartet mit dem ersten `previewMode on`, COM als MTA (E15). Er nimmt je **aktivem** Platz den jüngsten Puffer, kodiert mit WIC als JPEG (Qualität 0,5), Base64, `emitRaw` mit `{"ev":"preview","slot":n,"target":…,"w":…,"h":…,"jpeg":"…"}`. Kosten ebenfalls in `previewUs` des Platzes.
- **Startwert:** Die Vorschau ist aus, bis das erste `previewMode {on:true}` kommt (Nachbesserung B15); Connect schickt `previewMode` in jeder Startfolge (7.6).
- **Fehler:** Lässt sich WIC oder COM nicht einrichten, einmal `previewUnavailable` mit HRESULT, Vorschau bleibt aus; Bild und Ton laufen unberührt.
- **Ende:** `previewMode off` hält den Thread an; quit/EOF beendet ihn vor `slotsShutdownAll()` (6.15) und damit vor `ndiShutdown()`.
- Ersatzbild, Halten und Bild-Versatz: siehe E16; die Bridge sendet dafür keine Vorschau.
- `CMakeLists.txt:58`: zusätzlich `windowscodecs` und `ole32` linken.
- Durchsatz: 16 Slots × 2 Bilder/s × rund 10,7 KB je Zeile (8 KB JPEG, **Annahme** AN7, mit Base64-Aufschlag 4/3) sind rund 340 KB/s auf stdout (Nachbesserung B21).

### 6.17 Messwerte

| Wert | Quelle | Bedeutung, Grenze |
| --- | --- | --- |
| `w`, `h`, `fps`; `lastW`, `lastH` | Bild-Rückruf | gelieferte Größe und Bilder je Sekunde im laufenden 2-s-Fenster; ohne Bild im Fenster nur die letzte Größe dieses Ziels (6.3) |
| `fallbackFps`, `heldFrames` | Herzschlag | gesendete Ersatz- und Haltebilder je Sekunde bzw. gehaltene Bilder seit dem Umhängen |
| `workUs` | QPC um Senden und Kopieren im Rückruf und im Herzschlag | **Bridge-Anteil**: Zeit je Sekunde, die die Bridge für diesen Slot verbraucht, einschließlich der NDI-Kodierung, soweit `NDIlib_send_send_video_v2` sie im Aufruf leistet (**Annahme** AN4: synchron, `ndi_sender.cpp:111-118`). Zooms Dekodierung ist **nicht** enthalten. |
| `copyUs`, `previewUs` | QPC | Anteil für Kopie (Freeze, Freigabe) und Vorschau (aus dem Vorschau-Modul, 6.16) |
| `memKb` | Puffergrößen | Versatz-Warteschlange, Kopie, Vorschau, Ersatzbild-Puffer |
| `resWanted`, `resSet`, `resGot` | 6.11 | gewünschte Stufe, Rückgabe von `setRawDataResolution`, Rückgabe von `getResolution()` |
| `rawType` | `getRawDataType()` (`rawdata_renderer_interface.h:60`) | Rohdaten-Typ, den der Renderer meldet (zu MS5) |
| `userVideoW`, `userVideoH` | `GetUserVideoSize(Ziel)` | nur VIDEO; Bedeutung ungeklärt (MS24) |
| `gapMs`, `gapUngeprueft` | 6.10 | Lücke vom Umhängen bis zum ersten passenden Bild |
| `foreignFrames`, `lateFrames`, `tooFrequent`, `noShareData`, `rendererNew`, `rendererLost` | 6.10 | Zähler |
| `audioPps`, `audioRate`, `audioCh`, `shareAudioRate`, `shareAudioCh`, `mixDrops`, `mixSilenceMs` | 6.13 | Ton je Art; fehlt ein Wert, ist nichts angekommen |
| `cpuPct`, `sysPct`, `memMb` | `GetProcessTimes`, `GetSystemTimes`, `GetProcessMemoryInfo` | ganzer Bridge-Prozess bzw. ganzes System; enthält Zooms Dekodierung. GPU-Last misst die Bridge **nicht** (Task-Manager in der Abnahme). |
| `merkerVerworfen` | 6.5 | übergelaufene Merker-Warteschlangen (ein verlorenes Zoom-Ereignis) |
| `halteliste` | 6.15 | Slots, deren Renderer nach einem Abbau während der Renderer-Sperre noch nicht abgemeldet sind (Nachfix W2) |
| `shareAudioPackets`, `shareAudioUnassigned`, `shareAudioLastId` | 6.13 | Freigabe-Ton vor der Zuordnung |
| `hdVideo`, `originalSize`, `recvVideo`, `recvShare` | 6.11 | Einstellungen und meetingweite Empfangswerte, zu MS24 |
| `speakerSignal` | 6.5 | jedes der drei Signale mit Zeit |
| `shares.recent` | 6.9 | die letzten 10 Freigabe-Rückrufe roh (zu MS6) |

### 6.18 Was in der Bridge wegfällt oder umzieht

- Befehle `videoSubscribe`/`videoUnsubscribe`, Ereignisse `video`/`audio`, `uniqueSourceName` (der Name kommt fertig aus Connect), das Umhängen im Rückruf samt `rebound`/`reboundByName` (`video.cpp:1253-1507`), das Merkzeichen `teilnehmerWeg` (6.1), `Session.videoSubs`/`audioSubs` (ersetzt durch `slots`/`slotAudio` je Slot-Nummer in `src/state.ts`).
- **Konsole** `cli/steuerung.mjs` (Nachbesserung B83). Sie verließ sich auf das Umhängen in der Bridge (`cli/steuerung.mjs:181-189`, `:458-459`) und schlüsselt nach `session.videoSubs` (`:394`, `:556`, `:563`, `:582-585`). Neu:
  - `+<Kennung>` → `slotOn` mit der kleinsten freien Slot-Nummer, Modus `participant`, NDI-Name „JM Connect – Zoom ‹Name›“ nach der Namensregel aus 7.2 (eindeutig gegen die Slots der Konsole), Ton wie heute (`ZOOM_AUDIO_OFF`, „stumm“); `ZOOM_VIDEO_SUBSCRIBE` startet die Slots ebenso.
  - `-<Kennung>` → `slotOff` des Slots mit diesem Ziel.
  - `=<Slot> <Kennung>` (neu) → `slotSet {slot, id}`.
  - Keine Rückkehr von selbst: Tritt jemand bei, dessen normierter Name dem eines Konsolen-Slots ohne Ziel gleicht, druckt die Konsole „Rückkehr? =<Slot> <Kennung>“ (statt heute „Abo automatisch umgehängt … nichts zu tun“, `:458-459`).
  - `liste` zeigt Teilnehmer und Slots (Nummer, Ziel, Zustand).
  - Die `steuerung`-Fälle des Selbsttests (`test/selftest.ts:1597-2079`) ziehen um (11.10).
- Die Prüfstände `test/command-probe.mjs`, `test/bool-probe.mjs`, `test/video-limit.mjs`, `test/video-stress.mjs` ziehen auf `slotOn`/`slotOff`/`slotSet` um (E22). `command-probe` prüft wie heute ohne `init` (dann `slotNoPrivilege` als Beleg, dass die Zeile gelesen wurde, Muster `test/command-probe.mjs:7-13`).
- Die Attrappe `test/fake-bridge.mjs` bekommt die Slot-Befehle und -Ereignisse (11.3).
- Das Einsatzpaket `zoom-bridge-v0.1.0` wird nicht neu gebaut. Weil `scripts/build-release.mjs` aus dem aktuellen Code baut (`:114`, `:178-179`) und `paket/LIESMICH.txt` mitnimmt (`:253`), das noch das Umhängen in der Bridge verspricht (`paket/LIESMICH.txt:104-109`), bekommt `build-release.mjs` einen Riegel: Er bricht mit einem Hinweis auf diese Spec ab, solange `paket/LIESMICH.txt` den Satz „hängt die Bridge das Abo von selbst um“ enthält (Leerraum und Zeilenumbrüche gleich gewertet; dort steht er über zwei Zeilen). Wer das Paket später neu baut, berichtigt zuerst LIESMICH und Version (`package.json:3`).

### 6.19 Dateien (Bridge)

| Datei | neu/geändert | Aufgabe |
| --- | --- | --- |
| `native/slot_logic.h`, `native/slot_logic_test.cpp` | neu | `SprecherErinnerung`, `SprecherWahl`, `FreigabeListe`, Ersatzbild-Entscheidung (welche Art, wann, `sent`), Grund nach 200 ms ohne Bild, `ZielStand`, `TonStand`, `umhaengPlan`, `abbauPlan`, `tonZiele`, `tonWeg`, `stilleBloecke`; Test ohne SDK |
| `native/audio_mix.h`, `native/audio_mix_test.cpp` | neu | Mischer Mischton + Computerton; Test ohne SDK |
| `native/preview.cpp`, `native/preview.h` | neu | Plätze `g_vorschau[16]`, Verkleinern, Vorschau-Thread, WIC, Base64 |
| `native/video.cpp`, `native/video.h` | geändert | `Slot`, `g_slots`, `slotOn`/`slotSet`/`slotOff`, `slotRetarget`, Herzschlag, Ton-Zuordnung, Abbau (Ausführer `abbauAusfuehren`, 6.15), Messwerte |
| `native/ndi_sender.cpp`, `native/ndi_sender.h`, `native/delay_line.h`, `native/delay_line_test.cpp` | geändert | UYVA, Weiß, Kopie, ohne Versatz, Bildarten |
| `native/audio.cpp`, `native/audio.h` | geändert | `kind`, Misch- und Freigabe-Ton, 512 Pakete |
| `native/callbacks.cpp`, `native/callbacks.h` | geändert | drei Lauscher, Merker-Warteschlangen, Teilnehmer-Rückrufe ohne Renderer |
| `native/session.cpp`, `native/session.h` | geändert | Regler-Getter, eigene Kennung, Abmeldung, Einstellungsdienst nur lesend (6.11) |
| `native/main.cpp` | geändert | Befehle, Hauptschleife, Abbau |
| `CMakeLists.txt`, `package.json`, `scripts/logik-test.mjs` | geändert/neu | Quelldateien, Ziele `slot-logic-test`, `audio-mix-test`, Bibliotheken, Skripte `logik-test`, `slot-test` |
| `src/protocol.ts`, `src/state.ts`, `src/index.ts` | geändert | Typen, Fehlerschlüssel, Reducer, Exporte |
| `test/fake-bridge.mjs`, `test/selftest.ts`, Prüfstände, `cli/steuerung.mjs` | geändert | 11.2, 11.3, 6.18 |
| `scripts/build-release.mjs` | geändert | Riegel gegen einen Neubau des Einsatzpakets mit dem Slot-Code (6.18) |
| `README.md` | geändert | 14 |

---

## 7 · Teil Connect (`apps/connect`)

### 7.1 Slot-Modell im Kern

Typen in `apps/connect/src/shared/types.ts` (Arbeitsnamen; die Bridge-Typen kommen wie heute aus `@jm/zoom-bridge/protocol`, `types.ts:3-5`):

```ts
export type ZoomSlotModus = 'teilnehmer' | 'sprecher' | 'freigabe';
export type ZoomSlotAufloesung = '360p' | '720p' | '1080p';
export type ZoomSlotErsatzbild = 'transparent' | 'eingefroren' | 'schwarz' | 'weiss';
export type ZoomSlotTonArt = 'mischton' | 'person';
export type ZoomSprecherSignal = 'sprecherVideo' | 'aktivesVideo' | 'tonAktiv';
export type TonQuelle = 'mix' | 'person' | 'share' | 'mixShare' | 'none';  // wie slotAudio.source (6.3)
// SlotReason, SlotAudioReason, SlotSent ('none' | 'transparent' | 'freeze' | 'black' | 'white' | 'held') kommen aus @jm/zoom-bridge/protocol

/** Am Rechner gespeichert (connect-settings.json, zoomSlots). Ein Konstruktor: normiereSlot(). */
export interface ZoomSlotEinstellung {
  nr: number;                       // 1..16, fest (E2)
  ndiName: string;                  // E26
  modus: ZoomSlotModus;
  person: string;                   // Anzeigename, nur Teilnehmer; '' = keine Person gewählt
  an: boolean;                      // Start-Taste
  aufloesung: ZoomSlotAufloesung;
  ersatzbild: ZoomSlotErsatzbild;   // Vorgabe 'transparent'
  tonAn: boolean;                   // Meeting-Ton (Mischton oder Person) an/aus
  tonArt: ZoomSlotTonArt;           // Vorgabe 'mischton'
  computerton: boolean;             // nur Freigabe, Vorgabe true (O4); eigener Schalter (Abbildung unten)
  ohneKamera: boolean;              // nur Sprecher: „Teilnehmer ohne Kamera zeigen“, Vorgabe true (0.28)
}
export interface ZoomSlotVorgaben { aufloesung: ZoomSlotAufloesung; tonAn: boolean }  // Vorgabe 720p, Ton an
export interface ZoomSprecherEinstellung { signal: ZoomSprecherSignal; haltezeitMs: number } // Vorgabe sprecherVideo, 1000

/** Slot-Zustände (10.1), 12 Werte. */
export type ZoomSlotZustand =
  | 'aus' | 'ohne_meeting' | 'wartet_erlaubnis' | 'startet' | 'zeigt' | 'gehalten'
  | 'ersatz' | 'keine_antwort' | 'gescheitert' | 'stoppt' | 'zurueckgestellt' | 'geplant';

/** Ein Slot im Abbild (Main → Fenster). Ein Konstruktor: slotLage() im Kern. */
export interface ZoomSlotLage {
  einstellung: ZoomSlotEinstellung;
  voruebergehend: boolean;           // per zoom_load angelegt, nur bis Meeting-Ende, nie gespeichert (7.2)
  anNurMeeting: boolean;             // dauerhafter Slot, per zoom_load nur für dieses Meeting eingeschaltet (7.2, FR10)
  zustand: ZoomSlotZustand;
  grund: SlotReason | null;          // letzter Grund der Bridge
  gesendet: SlotSent | null;         // `sent` der Bridge (6.12): was der Sender gerade zusätzlich schickt
  zielName: string | null;           // wen der Slot zeigt oder erwartet (für Texte, nie im Log)
  doppelt: number;                   // > 1 nur, wenn keine gültige gewaehlteId besteht (7.3 Nr. 5)
  zweifel: boolean;                  // T13b: gezeigte Person gegangen, ein Namensvetter war schon vorher da
  imWarteraum: boolean;
  wahl: { id: number; name: string; hinweis: string }[] | null;  // bei doppelt > 1 oder zweifel
  geliefert: { b: number; h: number; fps: number } | null;        // nur aus dem laufenden Fenster dieses Ziels
  zuletzt: { b: number; h: number } | null;                       // letzte Größe dieses Ziels (T51c)
  ton: AudioState | 'aus'; tonGrund: SlotAudioReason | null;
  tonQuelle: TonQuelle; tonEingestellt: TonQuelle;                // gemessen bzw. eingestellt (6.3)
  offen: boolean;                    // zählt in o (10.1)
  liefSchon: boolean;                // lief in diesem Meeting schon (0.12)
  zeigteSchon: boolean;              // Teilnehmer-Slot zeigte in diesem Meeting schon die eingestellte Person; gesetzt
                                     // nur von `slot live` mit mode participant und target = gewaehlteId (N3);
                                     // fällt bei Person- und Moduswechsel (7.3 Nr. 7, 0.12, FR7)
  andererSlot: number | null;        // T97: ein anderer laufender Slot hat dasselbe Ziel
  fehler: string | null;             // Klartext (9.6), Regeln 10.9
  text: string; tonText: string | null; messText: string | null;  // fertige Zeilen der Kachel (10.2, 10.6, 10.7);
                                     // null = keine Zeile (Ton: nur in SZ9 mit eingestelltem Ton; Restrunde RR6, N5)
}
```

**Ton-Abbildung** (Connect → Bridge; eine reine Funktion `tonFuerBridge(einstellung)` in `main/zoom/slots.ts`; Nachbesserung B2, B57; Owner-Frage FR6):

| `tonAn` | `tonArt` | `computerton` | `audio` | `shareAudio` | gesendet (Bridge, 6.13) |
| --- | --- | --- | --- | --- | --- |
| aus | – | aus | `off` | `false` | nichts |
| aus | – | an | `off` | `true` | im Modus Freigabe nur der Computerton, sonst nichts |
| an | `mischton` | aus | `mix` | `false` | Mischton |
| an | `mischton` | an | `mix` | `true` | Freigabe: Mischton + Computerton (Mischer); sonst Mischton |
| an | `person` | aus | `person` | `false` | Teilnehmer: Ton der Person; sonst nichts (`personNotInMode`, T75) |
| an | `person` | an | `person` | `true` | Teilnehmer: Ton der Person; Freigabe: nur Computerton (T75b); Sprecher: nichts (T75) |

Connect sendet immer die eingestellten Werte; ob Person-Ton im Modus gilt, entscheidet die Bridge und meldet es (`off/personNotInMode`, 6.13). „Ton eingeschaltet“ für Companion und Kachel heißt: Der Slot ist so eingestellt, dass er Ton sendet (`tonAn`, oder im Modus Freigabe `computerton`; 8.2). Die Companion-Aktion „Ton aus“ schaltet beides ab und merkt sich den vorigen Stand, „Ton ein“ stellt ihn wieder her (8.3).

`ZoomKurz` (`types.ts:181-201`) verliert `quellen`, `ohneBild`, `sollOffen` und bekommt `slotsLaufen` (n), `slotsErsatz` (k), `slotsOffen` (o), `slotsAn` (e), `slotsGestopptEntzug` (10.3) und `slotKurz: { nr, an, live, alarm, tonEin, modus, ziel: string, zustandWort: string }[]` (`zustandWort` ist der Wert von `zoom_slot{n}_state`, 8.2; nicht „Kennung“, die meint in dieser Spec die Teilnehmer-Kennung; Restrunde RR10). Die **Umbenennung ist Absicht**: Der Typcheck findet so jeden Konstruktor und jeden Leser (Lehre „Konstruktoren greppen“). `ZoomAbbild` (`types.ts:203-236`) verliert `soll` und bekommt `slots: ZoomSlotLage[]`, `vorgaben`, `sprecher`, `vorschauAn`, `vorschauVerfuegbar`, `ueber5`, `messwerte` (7.8), `einstellungen: { nurSitzung: boolean; gesichert: string | null }`.

Im Kern (`apps/connect/src/main/zoom/kern.ts`) ersetzt `slots: Map<number, SlotIntern>` (Schlüssel Slot-Nummer) die Karten `quellen`, `soll`, `tonVorwahl`, `aboFristen` und `zeilenFehler` (`kern.ts:282-315`). `SlotIntern` trägt die Lage der Bridge (Zustand, Grund, `sent`, Ziel, Ton, `gen`), die Antwortfrist, den Fehlerstand (`keine_antwort`, `gescheitert`, `zurueckgestellt`, 7.3 Nr. 2), `liefSchon`, `zeigteSchon`, `gewaehlteId`, `wegSeq` und `personJetzt` (7.3 Nr. 5, Nr. 6; nur diese Sitzung), `voruebergehend`, `anNurMeeting` (7.2), den vor „Ton aus“ gemerkten Ton-Stand (8.3), die letzten Messwerte und die letzte Vorschau samt Ziel (7.7). Die Generationsregel bleibt (ST4 6.9): Ereignisse alter oder abbauender Generationen räumen nur ab (`kern.ts:1058-1074`).

Neue Kern-Methoden: `slotAnlegen()`, `slotAendern(nr, aenderung)`, `slotLoeschen(nr)`, `slotStart(nr, an, trotz?)`, `slotAusPerson(teilnehmerId, trotz?)`, `slotPersonWaehlen(nr, teilnehmerId)`, `slotBehalten(nr)` (macht einen vorübergehenden Slot dauerhaft bzw. das Einschalten eines Slots mit `anNurMeeting` zur gespeicherten Einstellung, 7.2), `vorgabenSetzen(v)`, `sprecherSetzen(s)`, `vorschauSetzen(an)`, `fensterSichtbar(sichtbar)`, `messwerteText()`, dazu für die Fernsteuerung `fernSlotAnlegen(name)` (`zoom_load` nach 8.3: schaltet einen Teilnehmer-Slot dieses Namens ein oder legt einen vorübergehenden an; ersetzt `fernLaden`, `kern.ts:1726`; Restrunde RR10) und `fernSlotEntladen(name)` (`zoom_unload` nach 8.3: schaltet alle eingeschalteten Teilnehmer-Slots dieses Namens aus, löscht dabei die vorübergehenden und hebt `anNurMeeting` auf, 7.2; ohne Treffer F5; ersetzt `fernEntladen`, `kern.ts:1746-1758`; Fünfte Runde N6). Es entfallen `laden`, `entladen`, `ton`, `sollVerwerfen` (`kern.ts:154-190`, `:1570-1626`). Neue Zweige in `beiEreignis` (`kern.ts:1093-1115`) für `slot`, `slotAudio`, `slotStats`, `bridgeStats`, `shares`, `speakerSignal`, `videoStatus`, `preview`, `speakerConfig`, `previewMode`.

**Fehler und ihr Anzeigeort** (Nachbesserung B62; heute erscheinen Fehler mit anderem `where` als `video`, `audio`, `privilege`, `join`, `meeting`, `exit` nur im Log, `kern.ts:1285-1324`):
- `where:"slot"` mit `slot` → Fehlerzeile der Kachel dieses Slots (10.9), Aufbaufehler zusätzlich als SZ8 (7.3 Nr. 2).
- `where:"slot"` ohne `slot` (`slotBadNumber`, `speakerBadSignal`, `speakerBadHold`) → „Hinweise“ der Karte (T103).
- `previewUnavailable` → `vorschauVerfuegbar = false`, T57 an jeder Kachel und einmal unter „Hinweise“.
- **Ton-Abo-Fehler** (nur `audioVoipJoinFailed`, `audioHelperMissing`, `audioSubscribeFailed`, 6.4; das Ton-Abo gilt für alle Slots) → Merker `tonAboFehler` mit dem Schlüssel; T104 an **jeder** Kachel mit eingeschaltetem Ton, nicht nur am auslösenden Slot (Nachbesserung B70). Der Merker **fällt** (Nachfix W6) beim nächsten `slotAudio` eines beliebigen Slots mit `waiting/command` oder `live` (beides meldet die Bridge nur mit stehendem Ton-Abo, 6.13), bei jeder neuen Bridge, bei Meeting-Ende, „Verlassen“, „Schließen“ und beim Entzug (das Ton-Abo ist dann abgemeldet, `audioClearSubscribed()`, 6.15). Ein Slot, dessen eigener Ton auf `off/audioUnavailable` steht, behält T104 auch danach, bis an ihm Ton wieder eingeschaltet wird (6.13); `{name}` ist dann der zuletzt gemeldete Ton-Abo-Fehler.
- `audioQueueOverflow` → Hinweis Q6 wie heute (`klartext.ts:293-294`), nie an einer Kachel; `audioBufferMismatch` → Hinweis T106 (6.4). Beide sind `where:"audio"`, aber keine Ton-Abo-Fehler und setzen den Merker nicht (Nachfix W6).
- `slotReconnecting` (6.4) → **kein** Text und **kein** Fehlerstand, wie `slotNoPrivilege` (7.3 Nr. 2; Nachfix W2).
- `slotAlreadyOn` und `slotNotOn` (Wettlauf, etwa ein `slotSet` des Abgleichs während des Abbaus nach einem Entzug) → **kein** Text und **kein** Fehlerstand; die Lage gleicht sich über das nächste `slot`-Ereignis an (Muster heute `videoAlreadySubscribed`/`videoNotSubscribed`, `apps/connect/src/main/zoom/klartext.ts:279-282`).
- Jeder Fehlerschlüssel der Slots hat in einem `Record<SlotFehler, string | 'keine'>` entweder einen Text oder ausdrücklich `'keine'`; ein neuer Schlüssel ohne Eintrag scheitert im Typcheck (Muster `zoom-text.ts:482-512`).
- `where:"cmd"` bleibt wie heute nur im Log: Connect gleicht `zoom-bridge.exe` vor jedem Start per SHA-256 mit der mitgelieferten Fassung ab und ersetzt sie (`apps/connect/src/main/zoom/laufzeit.ts:316-358`); eine Bridge, die die Slot-Befehle nicht kennt, kann im Release nicht laufen.

### 7.2 Speicherung am Rechner und Übergang

Neue Felder in `Stored` (`apps/connect/src/main/settings.ts:30-44`):

| Feld | Inhalt | fehlt = |
| --- | --- | --- |
| `zoomSlotsFassung` | `1` | `1` |
| `zoomSlots` | `ZoomSlotEinstellung[]`, höchstens 16, **ohne** vorübergehende Slots; ein dauerhafter Slot mit `anNurMeeting` steht dort mit `an: false` (unten) | leer |
| `zoomSlotVorgaben` | `{ aufloesung, tonAn }` | `720p`, an |
| `zoomSprecher` | `{ signal, haltezeitMs }` | `sprecherVideo`, 1000 |
| `zoomVorschau` | Bool | an |
| `zoomSlotsUeber5` | Bool, Zustimmung aus E4 | aus |

- **Lesen:** Jeder Slot geht durch `normiereSlot()` (rein, in `main/zoom/einstellungen.ts`, Muster `gueltigerVersatz`, `einstellungen.ts:22-24`): unbekannte Werte → Vorgabe, Nummer außerhalb 1–16, doppelte Nummer oder doppelter NDI-Name (nach `gleicherNdiName`) → Eintrag verworfen. Wird etwas verworfen, Hinweis T91 und Logzeile mit der Zahl (ohne Namen).
- **Unlesbare Datei** (`settings.ts:54-62`): Connect benennt sie vor dem nächsten Schreiben in `connect-settings.unlesbar-<JJJJMMTT-hhmmss>.json` um (gleicher Ordner) und zeigt T90 mit dem Dateinamen. Das gilt für alle Felder der Datei, nicht nur für Zoom.
- **Schreiben** nach jeder Änderung sofort. Liefert `write()` `false` (`settings.ts:65-75`), gelten die Werte nur für diese Sitzung; die Karte zeigt T92 (gelb, Muster `versatzZeile`, `zoom-text.ts:536-540`).
- **Vorübergehende Slots** (Nachbesserung B1, B79; Owner-Frage FR1): Ein Slot, den `zoom_load` anlegt, ist **vorübergehend**. Er lebt nur im Arbeitsspeicher, wird nie in `connect-settings.json` geschrieben (also auch kein Anzeigename auf der Platte, 0.14) und verschwindet wie die Soll-Liste in 0.3.0: bei Meeting-Ende, „Verlassen“, „Schließen“, neuem Beitritt, Beenden und einem Mangel der Einrichtung (heute `kern.ts:1187`, `:1217`, `:1336`, `:837`, `:1811`; Mangel `mangelFolgen()`, `kern.ts:530-535`, gerufen `:1139`, `:1163`, `:1401`, auch mitten in einem Wiederbeitritt; Restrunde RR1), nicht bei Entzug, Z10, Z11 oder „Erneut beitreten“ (dort blieb die Soll-Liste, `kern.ts:1193-1196`). `zoom_unload` löscht ihn sofort. Er belegt solange eine Nummer, zählt in e, n, k, o wie jeder Slot und trägt an der Kachel das Kennzeichen T96 mit dem Knopf „Behalten“ (`slotBehalten`, macht ihn dauerhaft und speichert ihn). So funktionieren `zoom_load`/`zoom_unload` wie in 0.3.0 weiter (Entwurf B.1, B.4): Nacheinander geladene und entladene Sprecher sammeln sich nicht an, ein späteres Meeting startet keinen alten Slot von selbst, und F14 kommt nur, wenn in **diesem** Meeting 16 Slots belegt sind.
- **Nur für dieses Meeting eingeschaltet** (Restrunde RR7; Owner-Frage FR10): Schaltet `zoom_load` einen ausgeschalteten **dauerhaften** Slot ein (8.3), merkt der Kern `anNurMeeting` (nur im Arbeitsspeicher). In `connect-settings.json` bleibt der Slot mit `an: false`; in diesem Meeting läuft er wie jeder eingeschaltete Slot (Start-Taste an, zählt in e), trägt an der Kachel T96b mit „Behalten“ und wird zu denselben Zeitpunkten wieder ausgeschaltet, zu denen vorübergehende Slots verschwinden (7.3 Nr. 8). So startet auch er in keinem späteren Meeting von selbst und hält die Zustimmung über 5 (7.4) nicht über das Meeting hinaus, wie 0.25 es für `zoom_load` verspricht; ohne diese Regel hätte ein einziges `zoom_load` die Start-Taste dauerhaft gesetzt. Der Merker fällt mit „Behalten“ (`slotBehalten`, dann `an: true` gespeichert), sobald der Bediener an der Kachel oder `zoom_slot` die Start-Taste setzt (dann gilt dessen Wert und wird gespeichert), und mit `zoom_unload` (der Slot geht aus).
- **Übergang (E13):** Nach dem Update auf 0.4.0 ist die Slot-Liste leer; die Karte zeigt T30. „Als Slot laden“ in der Teilnehmerliste legt einen **dauerhaften** Teilnehmer-Slot an (der Bediener sieht und löscht ihn in der Karte), `zoom_load` einen vorübergehenden. Beide: NDI-Name nach der **Übergangs-Namensregel**, Person = Anzeigename, Ersatzbild transparent, Auflösung und Ton aus den Vorgaben, an. So behalten Bildmischer-Eingänge mit den bisherigen Namen ihre Quelle, solange kein anderer Slot dieser Person unter einem anderen Namen besteht (8.3).
- **Übergangs-Namensregel** (Nachbesserung B22, B79a; eine reine Funktion in `main/zoom/einstellungen.ts`): „JM Connect – Zoom “ + Anzeigename (`teilnehmer.ts:9`); jedes „:“ wird ein Leerzeichen (wie es NDI in 0.3.0 tat, `video.cpp:182-187`, damit derselbe Name entsteht), Steuerzeichen fallen weg (die Bridge lehnt sie ab, E26); **sonst bleibt der Anzeigename unverändert**, auch doppelte, führende oder abschließende Leerzeichen (Nachfix W4): 0.3.0 hängte ihn roh an (`video.cpp:189`), und NDI ließ das doppelte Leerzeichen nach einem ersetzten „:“ gemessen stehen (`:182-187`). Aus „Moderation: Anna“ wird so wie in 0.3.0 „JM Connect – Zoom Moderation␣␣Anna“ (␣ = ein Leerzeichen, hier also zwei). Dann auf 60 Code-Punkte gekürzt (E26). `normiereSlot()` ändert einen so gebildeten Namen nicht (7.2 Lesen, PK35). Kollidiert der Name nach `gleicherNdiName` (`teilnehmer.ts:29-31`, NFC ohne Groß-/Kleinschreibung) mit irgendeinem Slot, kommt „ (2)“, „ (3)“ … dazu (vor dem Kürzen Platz dafür lassen). Grenze: Ein Anzeigename über 42 Zeichen ergab in 0.3.0 einen längeren NDI-Namen als 60; solche Eingänge finden ihre Quelle nicht wieder (wie lang Zoom-Namen sein dürfen, sagt der Header nicht, `meeting_participants_ctrl_interface.h:88`).

### 7.3 Slot-Abgleich (`main/zoom/slots.ts`, ersetzt `soll.ts`)

Rein und ohne Electron, Muster der heutigen Abgleich-Tabelle (`soll.ts:72-116`). **Eingaben:** Einstellungen (dauerhafte und vorübergehende Slots), Meeting-Zustand, Erlaubnis, Teilnehmer (ohne eigene Zeile, mit Warteraum-Kennzeichen und Beitrittsfolge, Nr. 5), Lage der Bridge-Slots, offene Fristen, **Fehlerstand je Slot** (`keine_antwort`, `gescheitert`, `zurueckgestellt`), `gewaehlteId`/`wegSeq`/`personJetzt` je Slot, `zoomSlotsUeber5`. **Ausgaben:** Handlungen `starten`, `aendern`, `stoppen`, `loeschen` (vorübergehende), `nameMerken`.

**Auslöser:** 300 ms nach `roster`, `joined`, `left`, `renamed`, `videoStatus`, Erlaubnis „ja“ und Ankommen im Meeting (Muster `kern.ts:1650-1659`), **nach `slot off/privilegeRevoked`, wenn die Erlaubnis dann schon wieder „ja“ ist** (die Erlaubnis flattert: Der Abbau kam nach der Wiedererteilung und ihrem Abgleich; wie heute `kern.ts:1498-1500`; Nachbesserung B14), sowie sofort nach jeder Änderung des Bedieners.

**Zustand eines Slots** (Vorrang, erste passende Zeile gilt; Nachbesserung B61): 1. Start aus und kein Sender → SZ0; 2. `slotOff` gesendet oder Bridge im Abbau → SZ9; 3. Sender der aktiven Bridge → SZ4/SZ5/SZ6 nach der Lage der Bridge; 4. Meeting nicht `im_meeting` → SZ1; 5. Erlaubnis ≠ „ja“ → SZ2; 6. Fehlerstand `keine_antwort` → SZ7, `gescheitert` → SZ8, `zurueckgestellt` → SZ10; 7. Frist läuft → SZ3; 8. sonst SZ11 (`geplant`: der nächste Abgleich startet ihn).

1. Gestartet wird nur in `im_meeting` mit Erlaubnis „ja“ (wie `kern.ts:1659`).
2. Eingeschaltet, läuft nicht, keine offene Frist **und kein Fehlerstand** → `slotOn` mit allen Feldern (Ton nach der Abbildung 7.1); Frist 10 s (wie `aboAntwortMs`, `fristen.ts:6-14`). Ohne Antwort → Fehlerstand `keine_antwort` (SZ7, T21). Ein Aufbaufehler (`slotRawRecordingFailed`, `slotSenderFailed`, `slotRendererFailed`, `slotNameTaken`, `slotBad…`) → Fehlerstand `gescheitert` (SZ8, T23). `slotNoPrivilege` setzt **keinen** Fehlerstand: Der Slot wartet wie bei Q1 (SZ2, `kern.ts:1565`, `klartext.ts:327-329`), der nächste Abgleich mit Erlaubnis „ja“ startet ihn. Ebenso `slotReconnecting` (die Bridge war in der Renderer-Sperre, 6.5; Nachfix W2): kein Fehlerstand, die Frist ist beantwortet; nach `inMeeting` plant der Kern ohnehin einen Abgleich (`kern.ts:1253-1259`), der den Slot startet. Ein Slot mit Fehlerstand wird **nicht** von selbst neu gestartet (Nachbesserung B13; anders als 0.3.0, das beim nächsten Abgleich doch neu lud, `kern.ts:1482-1483`, `soll.ts:89`). Der Fehlerstand fällt bei „Stopp“ und „Start“ dieses Slots, bei jeder neuen Bridge (wie `zeilenFehler.clear()`, `kern.ts:972`), bei Meeting-Ende, „Verlassen“, „Schließen“, neuem Beitritt und einem Mangel der Einrichtung (wie die Soll-Liste in 0.3.0, `kern.ts:530-535`; Restrunde RR1).
3. Mehr als 5 eingeschaltet und keine Zustimmung (nur möglich bei von Hand geänderter Datei) → die ersten 5 nach Nummer starten, der Rest Fehlerstand `zurueckgestellt` (SZ10, T22).
4. Ausgeschaltet, läuft → `slotOff`.
5. **Teilnehmer-Slot, Ziel** (Nachbesserung B11, B60). Gesucht wird nach dem normierten Namen (`teilnehmer.ts:12-14`) von `person` oder, falls gesetzt, `personJetzt` (Nr. 6). **Namensvettern** sind alle Teilnehmer mit diesem Namen, **einschließlich Warteraum** (wie 0.3.0, `soll.ts:79-80`, `teilnehmer.ts:46-48`, `fernsteuerung.ts:37-44`). Connect führt je Teilnehmer eine Beitrittsfolge (Einträge aus `roster` 0, jedes `joined` die nächste Zahl) und je Slot `gewaehlteId` (wen der Slot zeigt oder zuletzt zeigte) und `wegSeq` (Stand der Beitrittsfolge, als diese Person ging).
   - (a) `gewaehlteId` gesetzt, die Person ist da: im Warteraum → Ziel 0 (T17); sonst Ziel = `gewaehlteId`. Namensvettern ändern nichts, `doppelt` = 1, kein Alarm.
   - (b) `gewaehlteId` nicht gesetzt (in diesem Meeting noch niemand gezeigt, keine Handwahl): kein Namensvetter → Ziel 0 (T16); genau einer, nicht im Warteraum → Ziel = er, `gewaehlteId` := er; genau einer im Warteraum → Ziel 0 (T17); mehrere → Ziel 0, `doppelt` = Zahl, `wahl` gefüllt (T13).
   - (c) `gewaehlteId` gesetzt, die Person ist gegangen: genau ein Namensvetter, nicht im Warteraum, **beigetreten nach dem Weggang** (Beitrittsfolge > `wegSeq`) → Rückkehr: Ziel = er, `gewaehlteId` := er. Genau einer, aber schon **vor** dem Weggang da → Ziel 0, `zweifel`, `wahl` (T13b): Er war nicht die gezeigte Person, also springt der Slot nicht auf ihn. Genau einer im Warteraum → Ziel 0 (T17). Mehrere → Ziel 0, `doppelt` = Zahl, `wahl` (T13). Keiner → Ziel 0 (T16).
   - `slotPersonWaehlen` (Handwahl) setzt `gewaehlteId`; danach gilt (a) bzw. nach einem Weggang (c).
   - Weicht das Ziel von dem der Bridge ab → `slotSet {id}`.
   - `gewaehlteId`, `wegSeq` und die Beitrittsfolge gelten je Sitzung: Sie fallen, sobald die Kennungen wechseln (neues `roster` nach Z10, neue Bridge nach Z11), und mit Meeting-Ende, „Verlassen“, „Schließen“, neuem Beitritt und einem Mangel der Einrichtung (Restrunde RR1). Danach gilt (b); bei doppeltem Namen also T13, wie heute Q11 („nach einem Wiederbeitritt kann Connect diese Quelle nicht von selbst zuordnen“, `klartext.ts:122`).
   - Ändert der Bediener oder `zoom_slot_person` die Person (`person`) eines Slots, fallen dessen `gewaehlteId`, `wegSeq` und `personJetzt` sofort; danach gilt (b) für die neue Person. Sonst zeigte der Slot nach (a) weiter die vorige Person, denn (a) vergleicht keinen Namen (beim Nachprüfen von RR9 gefunden, Restrunde).
6. **Umbenennung** (Nachbesserung B8): Benennt sich die gezeigte Person um (`renamed` mit Kennung = `gewaehlteId`), gilt der neue Name als `personJetzt` **für dieses Meeting**: Die Kachel nennt ihn, und eine Rückkehr wird unter beiden Namen gesucht. Die gespeicherte `person` ändert sich nicht; ein Name, den sich jemand in einem Meeting gibt, wirkt so nicht in künftige Shows. `personJetzt` fällt mit `gewaehlteId` (Nr. 5).
7. `liefSchon` wird beim ersten `slot starting` in einem Meeting gesetzt, `zeigteSchon` beim ersten `slot live` eines Teilnehmer-Slots, das `mode: participant` trägt und als `target` die gültige `gewaehlteId` (Nr. 5), also die eingestellte Person. Ein `slot live` mit anderem Ziel oder Modus setzt es nicht: Es kann noch unterwegs sein, nachdem der Bediener Person oder Modus geändert hat, weil Connect `slotSet` erst aus dem Abgleich schickt (Nr. 5) und die Bridge Befehle erst in Schritt 7 ihrer Schleife abarbeitet (6.6); sonst hätte etwa ein `slot live` mit Ziel Anna nach dem Umstellen auf Ben den Alarm für Ben scharf gemacht (Fünfte Runde N3). Beide fallen bei Meeting-Ende, „Verlassen“, „Schließen“, neuem Beitritt und einem Mangel der Einrichtung, nicht bei Entzug, Z10, Z11 oder „Erneut beitreten“ (das wie in 0.3.0 als Fortsetzung zählt und die Soll-Liste behielt, `kern.ts:1193-1196`; Nachbesserung B61). Der Mangel gehört dazu, weil er wie in 0.3.0 nach Z1a/Z1b führt, wo `zoom_alarm` fest 0 ist (`zoom-text.ts:280-285`, mit dem Kommentar „In Z1a, Z1b und Z2 ist o immer 0 (ein Mangel bzw. jeder Weg nach Z2 leert die Soll-Liste)“); ein stehendes `liefSchon` hielte dort `zoom_slot{n}_alarm` auf 1 (Restrunde RR1). `zeigteSchon` fällt außerdem bei jeder Änderung von Person oder Modus dieses Slots: Es meint die **eingestellte** Person (3 „Offener Slot“, 0.12). Ein Slot, der Anna zeigte und auf Ben umgestellt wird, hat Ben nie gezeigt, und ein Sprecher-Slot, der auf Teilnehmer umgestellt wird, hat die eingestellte Person nie gezeigt; beide heben den Alarm nicht, solange diese Person fehlt (Restrunde RR9).
8. **Vorübergehende Slots** löscht der Abgleich zu denselben Zeitpunkten wie in 0.3.0 die Soll-Liste (7.2): Meeting-Ende, „Verlassen“, „Schließen“, neuer Beitritt, Beenden, Mangel der Einrichtung (Restrunde RR1); vorher `slotOff`, wenn sie laufen. Dauerhafte Slots mit `anNurMeeting` schaltet er zu denselben Zeitpunkten aus (Merker weg; gespeichert war schon `an: false`, 7.2; Restrunde RR7).
9. Sprecher- und Freigabe-Slots: Connect sendet nur Modus und Einstellungen; das Ziel wählt die Bridge.
10. **Neue Bridge:** Eine neue Bridge startet erst, wenn `stop()` jeder alten Generation zurückgekehrt ist (`kern.ts:955`). Eine Slot-Nummer hat darum nie zwei Lagen zugleich, und „Sender der alten Bridge zählen bis zu ihrem Abbau in n“ (10.1) gilt nur bis zu diesem Zeitpunkt (Nachbesserung B72).

### 7.4 Nachfrage ab dem 6. Slot

- `slotStart(nr, true)` und `slotAusPerson(…)`: Wäre danach die Zahl der eingeschalteten Slots größer als 5 und ist `zoomSlotsUeber5` aus, antwortet der Kern `{ ok: false, nachfrage: true, text: T40 }` und ändert nichts. Die Karte zeigt T40 mit „Trotzdem einschalten“ (wiederholt den Aufruf mit `trotz: true`, setzt die Zustimmung) und „Abbrechen“.
- Sinkt die Zahl auf höchstens 5, setzt der Kern `zoomSlotsUeber5` zurück.
- Companion (`zoom_slot … ON`, `zoom_load`): schaltet ein, setzt die Zustimmung, Warnung F8 (8.3). Vorübergehende Slots und Slots mit `anNurMeeting` (7.2) zählen mit; verschwinden bzw. gehen sie mit dem Meeting-Ende aus und sinkt die Zahl dadurch auf höchstens 5, verfällt die Zustimmung wie bei jedem Ausschalten.
- Der Abgleich startet mit Zustimmung alle eingeschalteten Slots (7.3 Nr. 2).

### 7.5 Zoom-Karte

Die Karte behält ihre Abschnitte 1–7 (`ZoomCard.tsx:489-790`). Neue Bausteine sind eigene Dateien, damit UX-Welle 2 sie übernehmen kann: `renderer/src/zoom/SlotBereich.tsx`, `SlotKachel.tsx`, `SlotEinstellungen.tsx`, `Messwerte.tsx`, `slot-vorschau.ts` (Ersatzbild-Malerei, rein).

Aufbau von oben nach unten (Texte wörtlich in Abschnitt 9):

1. Titel und Statuszeile (`kartenZeile`, 10.3).
2. Meldung, 3. Einrichtung, 4. Beitritt: unverändert.
5./6. Laufend: Die Verlassen-Rückfrage hängt an n = laufende Slots (heute `quellen`, `ZoomCard.tsx:320-321`, `:343-350`), Text T80.
7. Bild-Versatz: unverändert, dazu die Zeile T81.
8. **Zoom-Slots** (`SlotBereich`):
   - Kopf „Zoom-Slots“ mit T31; Knöpfe „Slot hinzufügen“ (gesperrt bei 16, Tooltip T32), „Vorgaben …“ (klappt Auflösung und Ton an/aus auf), Schalter „Vorschau“, „Sprecher-Einstellungen …“ (klappt Signal und Haltezeit auf, 7.6).
   - Ohne Slots: T30.
   - Je Slot eine **Kachel** (`SlotKachel`), nach Nummer, zwei Spalten bei breitem, eine bei schmalem Fenster:
     - Kopfzeile: „{nr} · {NDI-Name}“, Kennzeichen des Modus (T1–T3), bei vorübergehenden Slots T96, bei `anNurMeeting` T96b, je mit „Behalten“, Start-Schalter (T33/T34).
     - Vorschau 192×108 (7.7).
     - Zustandszeile in Klartext (`text`, 10.2), darunter Messzeile (`messText`, 10.7), Tonzeile (`tonText`, 10.6), Fehlerzeile (`fehler`, 10.9).
     - Bei Doppelname oder Zweifel (T13, T13b): Auswahl „Welche Person?“ mit den Kandidaten (Name, „Kamera aus“, „Host“, „im Warteraum“), wählt `slotPersonWaehlen`.
     - „Einstellungen“ klappt auf (`SlotEinstellungen`): NDI-Name (gesperrt, solange der Slot an ist, Tooltip T35), Modus (drei Knöpfe), Person (nur Teilnehmer: Textfeld mit Vorschlägen aus der Teilnehmerliste, freie Eingabe erlaubt, weil die Person noch nicht im Meeting sein muss), Auflösung, Ersatzbild, Ton an/aus und Tonart (Person nur im Modus Teilnehmer wählbar), Computerton (nur Freigabe), „Teilnehmer ohne Kamera zeigen“ (nur Sprecher), „Löschen“ (nur bei ausgeschaltetem Slot, Tooltip T36, Rückfrage T37).
   - Alle Felder sind in jedem Zoom-Zustand bedienbar (außer Z0); im Meeting wirken sie sofort (6.2 `slotSet`), sonst beim nächsten Start.
9. **Teilnehmerliste** (heute `ZoomCard.tsx:792-793`, `zeile()` `:380-446`): Zeilen wie heute ohne Ton-Schalter und ohne die Personen-Zeilen „wird: …“; statt „Als Quelle laden“/„Entladen“ der Knopf „Als Slot laden“ (T38, im Warteraum mit Tooltip T98) bzw. die Angaben T39, T39b, T39c, T39d nach den Regeln in 10.10; das Kamera-Kennzeichen folgt `videoStatus` über den Reducer (0.18, 7.10). Q10 und Q11 an der Zeile entfallen (ersetzt durch T46 und T13/T13b an der Kachel).
10. „Gemerkte Quellen“ entfällt (`ZoomCard.tsx:795-801`).
11. **Messwerte** (`Messwerte.tsx`, aufklappbar, eingeklappt als Vorgabe; Muster Einrichtung `ZoomCard.tsx:227`, `:543-546`), Inhalt 7.8, Knopf „Messwerte kopieren“.
12. Hinweise, 13. Fußzeile: unverändert.

Doppelklick-Schutz und Antwortort (`ZoomCard.tsx:40`, `:281-302`): `Ort` bekommt `slot:${number}`; `zeile:${number}` bleibt für „Als Slot laden“, `soll:${string}` und `trotzId` entfallen.

### 7.6 Vorgaben für neue Slots und Sprecher-Einstellungen

- **Vorgaben** (B.2): Auflösung (Vorgabe 720p, E7) und Ton an/aus (Vorgabe an). Gelten nur für neu angelegte Slots, auch für die per „Als Slot laden“ oder `zoom_load` angelegten. Ein neuer Slot bekommt außerdem: Modus Teilnehmer, keine Person, Ersatzbild transparent, Tonart Mischton, Computerton an, ohne Kamera an (0.28), Start aus, NDI-Name „Zoom {nr}“ (bei Kollision „Zoom {nr} (2)“ …).
- **Sprecher-Einstellungen** (C): Signal (T70–T72) und Haltezeit 0 bis 5 s in Schritten von 0,1 s (T73). Prüfregel rein in `einstellungen.ts` (11.11 KF7).
- **Startfolge:** Connect sendet in jeder Startfolge zusammen mit `videoDelay` (S-d, `kern.ts:1032-1039`) `speakerConfig` und `previewMode {on: Schalter „Vorschau“ und Fenster sichtbar}`, danach bei jeder Änderung. Jeder Beitritt und jeder Wiederbeitritts-Versuch startet eine neue Bridge (`kern.ts:1160`, `:1393`), deren Vorschau aus beginnt (6.16); ohne `previewMode` in S-d bliebe sie nach jedem Beitritt aus (Nachbesserung B15).

### 7.7 Vorschau in Connect

- Die Hülle reicht jedes `preview`-Ereignis **direkt** als Push `jmc:zoom-vorschau-bild` `{ nr, ziel, w, h, jpeg }` an das Fenster, nicht über das Abbild (das hielte das Abbild groß und den JSON-Vergleich der Kurzform teuer, `kern.ts:464-483`). Weil Bridge-Ereignisse nur im Kern ankommen (`kern.ts:995`), bekommt der Kern dafür den Rückruf `onVorschau` in seinen Abhängigkeiten (7.10). Die Bridge drosselt schon auf 2 Bilder/s je Slot.
- Die Kachel zeigt `<img src="data:image/jpeg;base64,…">`; die CSP erlaubt `data:` (`packages/app-runtime/src/csp.ts:34`).
- **Nur Bilder des aktuellen Ziels** (Nachbesserung B53): Die Kachel merkt sich die letzte Vorschau samt Ziel. Ändert ein `slot`-Ereignis `target`, `share` oder `mode`, verwirft sie die gemerkte Vorschau; ein Vorschaubild mit anderem `ziel` als dem gemeldeten wird nicht gezeigt.
- **Malerei je Lage** (`slot-vorschau.ts`, rein; Nachbesserung B54, B59; geprüft in 10.5):

| Lage | Fläche |
| --- | --- |
| Schalter „Vorschau“ aus | T56 |
| `vorschauVerfuegbar` falsch (`previewUnavailable`) | T57 an jeder Kachel |
| kein Sender: SZ0, SZ1, SZ2, SZ3, SZ7, SZ8, SZ10, SZ11 | leere Fläche, T55 „kein Bild“ |
| SZ4, `sent = none`, Vorschau jünger als 1,5 s | das Bild |
| SZ4, `sent = none`, ohne frische Vorschau (Stau, Fenster eben wiederhergestellt) | leere Fläche, T55b „kein Vorschaubild“ (kein Ersatzbild, denn Zoom liefert Bilder: das letzte ist jünger als 200 ms) |
| SZ4, `sent = held` (nur Freigabe, höchstens 2 s ohne neues Bild, 6.9; Nachfix W1) | letzte Vorschau dieses Ziels ohne Kennzeichen und ohne Frische-Grenze (der Sender wiederholt das letzte Bild dieser Freigabe); ohne sie leere Fläche mit T55b |
| SZ5 (`sent = held`) | letzte Vorschau dieses Ziels mit T54 „gehalten“; ohne sie leere Fläche mit T54 (Restrunde RR4) |
| SZ6, `sent = transparent` | Schachbrett |
| SZ6, `sent = black` / `white` | schwarz / weiß |
| SZ6, `sent = freeze` | letzte Vorschau dieses Ziels mit T53 „eingefroren“; ohne sie (Vorschau war aus, Fenster minimiert) leere Fläche mit T53, nie ein Schachbrett: Die Kopie in der Bridge entsteht unabhängig von der Vorschau (6.12, 6.16), und `sent = freeze` heißt, dass sie gesendet wird (Restrunde RR4) |
| SZ9 | letzte Fläche, abgeblendet |

- Unter der Vorschau steht als Tooltip T52 („ohne Bild-Versatz“).
- **Fenster** (Nachbesserung B15): Die Hülle übergibt dem Kern beim Anlegen den echten Zustand des Hauptfensters (sichtbar und nicht minimiert) und meldet danach `hide`, `show`, `minimize`, `restore` an `kern.fensterSichtbar()`. Der Kern schickt `previewMode {on}` = Schalter „Vorschau“ und Fenster sichtbar in **jeder Startfolge** (7.6) und bei jeder Änderung (E17). Die Bridge beginnt mit ausgeschalteter Vorschau (6.16).
- Vorschaubilder kommen nie ins Log und nie in den STATE.

### 7.8 Messwerte in Connect und im Log

- **Inhalt der Anzeige:** Prozess (T61, mit `merkerVerworfen`); je Slot eine Zeile (T62) aus `slotStats`, mit Ton-Paketen je Sekunde, Mischer-Verwurf und eingefügter Stille; Zähler (T69); Freigabe (T63/T64/T64c: Größe, Bildrate, Computerton angekommen mit Rate und Kanälen, ausdrücklich nicht oder nicht zuzuordnen, Pausen, gehaltene Bilder, `seeded`), dazu die letzten 10 Freigabe-Rückrufe roh (T63c, zu MS6); Sprecher: die letzten 20 Signale aller drei Rückrufe nebeneinander mit Uhrzeit und Name (nur in der Anzeige), die Lücke beim Wechsel (zuletzt, Median, höchstens über die letzten 20 Wechsel), Wechsel pro Minute (T65–T67); Empfang laut Zoom (T62b: `userVideoW/H`, `hdVideo`, `originalSize`, `recvVideo`, `recvShare`, zu MS24); Rückkehr (T62c: ob die `persistentId` beim Wiederbeitritt gleich blieb, zu MS16).
- **„Messwerte kopieren“** legt einen Text ohne Teilnehmernamen und ohne NDI-Namen in die Zwischenablage (Slots als „Slot {nr} ({Modus})“, Personen als Kennung; 0.23), über `navigator.clipboard.writeText` (`App.tsx:548`). Rückmeldung T68.
- **Log** (Präfix `[zoom]`, ST4 8.7), alle Zeilen ohne Namen (Nachbesserung B20):
  - je laufendem Slot jede Minute und bei jedem Zustandswechsel eine Zeile mit Nummer, Modus, Zustand, Grund, `sent`, `w`×`h`, `fps`, `fallbackFps`, `workUs`, `copyUs`, `previewUs`, `memKb`, `resSet`, `resGot`, `rawType`, Ton (`source`, `configured`, `audioPps`, `mixDrops`, `mixSilenceMs`) und allen Zählern aus T69; Zustandswechsel derselben Art höchstens einmal je 2 s (Nachbesserung B66); ein Wechsel nur von `sent` im Zustand `live` (Beginn oder Ende des Haltens, 6.9) schreibt keine eigene Zeile (Nachfix W1);
  - Prozesswerte jede Minute mit allen Feldern aus `bridgeStats`;
  - Sprecher-Signale gebündelt höchstens eine Zeile je Sekunde mit Kennungen;
  - jeder Freigabe-Rückruf (Zustand, Kennungen, Typ);
  - je Rückkehr einer Person eine Zeile „Rückkehr: persistentId gleich|verschieden|fehlt“ (Kern vergleicht die beim Weggang gemerkte `persistentId` mit der neuen, nur im Arbeitsspeicher; zu MS16).
- Die Logprüfung (PK17) zieht aus `zoom-kern.test.ts:2844-2913` in `zoom-slots.test.ts` um; ihr Muster `keinTeilnehmernameImLog` bleibt, die Fälle nutzen die Slot-Schnittstelle (11.10).

### 7.9 IPC (`apps/connect/src/shared/ipc.ts`, Hülle `main/zoom.ts`, Preload)

| Konstante | Kanal | Art | Nutzlast → Antwort |
| --- | --- | --- | --- |
| `zoomSlotAnlegen` | `jmc:zoom-slot-anlegen` | invoke | `{}` → `ZoomErgebnis & { nr? }` (T32 bei 16) |
| `zoomSlotAendern` | `jmc:zoom-slot-aendern` | invoke | `{ nr, aenderung }` (Teilmenge der Felder von `ZoomSlotEinstellung` ohne `nr`, `an`) → `ZoomErgebnis` |
| `zoomSlotLoeschen` | `jmc:zoom-slot-loeschen` | invoke | `{ nr }` → `ZoomErgebnis` (T36, wenn an) |
| `zoomSlotStart` | `jmc:zoom-slot-start` | invoke | `{ nr, an, trotz? }` → `ZoomErgebnis` oder `{ ok: false, nachfrage: true, text }` |
| `zoomSlotAusPerson` | `jmc:zoom-slot-aus-person` | invoke | `{ teilnehmerId, trotz? }` → wie `zoomSlotStart` |
| `zoomSlotPerson` | `jmc:zoom-slot-person` | invoke | `{ nr, teilnehmerId }` → `ZoomErgebnis` |
| `zoomSlotVorgaben` | `jmc:zoom-slot-vorgaben` | invoke | `{ aufloesung, tonAn }` → `ZoomErgebnis` |
| `zoomSprecher` | `jmc:zoom-sprecher` | invoke | `{ signal, haltezeitMs }` → `ZoomErgebnis` |
| `zoomVorschauSchalten` | `jmc:zoom-vorschau-schalten` | invoke | `{ an }` → `ZoomErgebnis` |
| `zoomMesswerteText` | `jmc:zoom-messwerte-text` | invoke | `{}` → `string` |
| `zoomSlotBehalten` | `jmc:zoom-slot-behalten` | invoke | `{ nr }` → `ZoomErgebnis` (macht einen vorübergehenden Slot dauerhaft bzw. das Einschalten bei `anNurMeeting` zur gespeicherten Einstellung, 7.2) |
| `zoomVorschauBild` | `jmc:zoom-vorschau-bild` | push | `{ nr, ziel, w, h, jpeg }` |

Es entfallen die Kanäle zum Laden, Entladen, Ton-Umschalten und Vergessen (`main/zoom.ts:176-198`; `preload/index.ts:91-94`). Die Hülle prüft jede Nutzlast feldweise mit einer reinen Funktion `pruefeSlotEingabe` (`main/zoom/slot-eingabe.ts`, Muster `pruefeZugangEingabe`, ST4 Nachtrag Zugangsdaten); ungültig → `{ ok: false, text: '' }`, der Kern wird nicht gerufen. Die Preload reicht jede dieser Nutzlasten als Ganzes durch, nie feldweise (7.10, 11.11 KF5).

### 7.10 Konstruktoren, Schnittstellen und Ereignis-Zweige (Pflichtliste für den Plan)

Neue Felder verwerfen Konstruktoren still. Der Plan greppt die **Konstruktoren** dieser Typen, nicht die Leser, und **jede Zeile** bekommt einen Fall, der ein neues Feld durch den Konstruktor hindurch prüft, mit Gegenprobe (11.11; Nachbesserung B78):

| Typ | Konstruktoren (heute bzw. neu) | Fall |
| --- | --- | --- |
| `ZoomSlotEinstellung` | `normiereSlot()` (rein, neue Funktion in `main/zoom/einstellungen.ts` wie in 7.2; gerufen beim Lesen und Schreiben in `settings.ts`; Restrunde RR10), `slotAnlegen`, `slotAusPerson`, `fernSlotAnlegen` (Kern), Übergangs-Namensregel (7.2), Testhilfen | 11.5 Rundlauf, PK1, PK23, PK35 |
| `ZoomSlotLage` | `slotLage()` im Kern (neu; Vorbild `aktiveQuellen()`, `kern.ts:330`) | 11.11 KF1 |
| `ZoomKurz` | `kurz()` (`kern.ts:415-430`), Testhilfen `kurz()` (`apps/connect/test/zoom-text.test.ts:31-36`), Literal in `apps/connect/test/control-state.test.ts:90-93` | 11.11 KF2 |
| `ZoomAbbild` | `abbild()` (`kern.ts:432-461`), Testhilfe `abbild()` (`zoom-text.test.ts:37-52`) | 11.11 KF3 (`vorgaben`, `sprecher`, `vorschauAn`, `vorschauVerfuegbar`, `ueber5`, `einstellungen`) |
| `ZoomParticipant` | `baueTeilnehmer` (`teilnehmer.ts:70-82`), bekommt `slotNrn` (Liste, 10.10) und das aktuelle Kamera-Kennzeichen | 11.11 KF4 |
| Bridge-Sitzung (`SlotSub`, `SlotAudioSub`, Teilnehmer mit Kamera) | Reducer `src/state.ts` (heute `VideoSub` nur mit sechs Feldern, `:285-288`); neuer Zweig für `videoStatus`, der `videoOn` des Teilnehmers in der Sitzung nachführt (heute ändern unbekannte Ereignisse nichts, `:323-325`), damit `baueTeilnehmer` (liest `participants`, `kern.ts:350-358`) das Kennzeichen ohne Überlagerung im Kern bekommt (Nachbesserung B29) | PT1 je Feld |
| STATE | `stateKvAus` (`zoom-text.ts:303-317`) | 10.5, 11.6 |
| Nutzlasten | Preload (`preload/index.ts:69-100`), Hülle (`main/zoom.ts:176-214`) | 11.11 KF5 |
| Einstellungen | Setter nach Muster `setzeZoomLaufzeit` (`settings.ts:271-275`, feldweise Kopie): für Slots nur über `normiereSlot()` | 11.5 |

**Nutzlasten ohne Electron prüfbar** (Nachbesserung B78): Die Preload reicht jede neue Nutzlast **als Ganzes** weiter (`(p) => ipcRenderer.invoke(kanal, p)`), nie feldweise; heute kopiert sie feldweise (`preload/index.ts:69`, `:92`), und `ipcRenderer.invoke(channel, ...args: any[])` meldet ein vergessenes Feld wie `trotz` nicht. Ein Quelltext-Test prüft das für jeden Kanal aus 7.9. Die Hülle ruft nur `pruefeSlotEingabe` (rein, getestet) und gibt deren Ergebnis unverändert an den Kern.

**Kern-Abhängigkeiten** (Nachbesserung B23; der Kern liest keine Einstellung selbst, `kern.ts:7`, `:123-132`): `ZoomKernAbhaengigkeiten.einstellungen` bekommt `slots()`/`setzeSlots(s): boolean`, `vorgaben()`/`setzeVorgaben(v): boolean`, `sprecher()`/`setzeSprecher(s): boolean`, `vorschau()`/`setzeVorschau(an): boolean`, `ueber5()`/`setzeUeber5(an): boolean` (jeweils `false` = nur diese Sitzung, T92) und `einstellungsLage(): { gesichert: string | null; verworfen: number }` (T90, T91). Dazu der Rückruf `onVorschau(bild)` für den Push (7.7) und der Startwert `fensterSichtbar`. Die Hülle (`main/zoom.ts:84-91`) verdrahtet alles.

**Ereignis-Zweige** (Nachbesserung B24): Der Typcheck findet veraltete Zweige nicht, weil `WireEvent` einen Sammelfall `{ ev: string }` hat (`src/protocol.ts:219`) und der Kern über `unknown` castet (`kern.ts:1059-1064`, `:1104-1107`). Darum gehören diese Stellen ausdrücklich in die Pflichtliste: `beschreibe` (`kern.ts:220-233`), `abbauEreignis` (`:1058-1074`), `abonniere`/`aboBeantwortet` (`:1464-1489`), das Leeren der Karten in `starteBridge` (`:971-976`), `teilnehmerAbbild`/`sollLage`/`sollOffen` (`:347-413`), `trayTooltip` (`zoom-text.ts:244`), `NDI_PRAEFIX`/`ndiVorschau`/Kollision (`teilnehmer.ts:9`, `:21-26`, `:80`), `ZoomParticipant.quelle`/`ndiNameVorschau`/`kollision`/`tonVorwahl` (`types.ts:129-135`), die Neuberechnung von T46 bei `zoomGastLabelsGeaendert` (`main/zoom.ts:244-246`) und `cli/steuerung.mjs:440-461`. Ein Quelltext-Test hält fest, dass in `apps/connect/src` kein `case 'video'` und kein `case 'audio'` und kein Vergleich `ev === 'video'`/`'audio'` mehr steht (PK33).

### 7.11 macOS

Unter macOS steht an der Stelle der Zoom-Karte (`App.tsx:365-366`) die Zeile T95. Die `zoom_*`-Schlüssel fehlen im STATE weiter ganz (`zoom-text.ts:303-306`); `zoom_*`-Befehle beantwortet die Hülle wie heute nur mit einer Logzeile (ST4 11.2). Das Mac-Paket baut die CI des iveo-Pakets aus dem Tag (13).

---

## 8 · Fernsteuerung: Companion-Schnittstelle und Modul 0.3.0

### 8.1 Capabilities (`packages/suite-control-protocol/src/capabilities.ts`, Rolle `connect`)

```ts
// ── Zoom-Slots (Connect 0.4.0, #257–#262). Slot-Nummer statt Teilnehmer-Kennung: Slots gelten immer,
// Kennungen nur je Sitzung. {slot} in toggleKey/stateKey löst das Modul aus dem Argument „slot“ auf (8.5).
// Namen stehen nur in zoom_slot{n}_target (B.4); alle übrigen zoom_*-Werte enthalten keinen Namen.
export const ZOOM_SLOT_MAX = 16;
const slotArg: CapabilityArg = { id: 'slot', label: 'Slot (Nr.)', type: 'number', default: 1, min: 1, max: ZOOM_SLOT_MAX };
const slotModusArg: CapabilityArg = {
  id: 'modus', label: 'Modus', type: 'dropdown', default: 'teilnehmer',
  choices: [
    { id: 'teilnehmer', label: 'Teilnehmer' },
    { id: 'sprecher', label: 'Aktiver Sprecher' },
    { id: 'freigabe', label: 'Bildschirmfreigabe' },
  ],
};
actions: [
  // … wie heute, zoom_load / zoom_unload / zoom_delay bleiben mit gleicher ID und gleichem Verb (B.4); geänderte Beschriftungen:
  //   zoom_load 'Zoom: Person als Slot laden (nur dieses Meeting)', zoom_unload 'Zoom: Slot einer Person entladen' (vorübergehende Slots, 7.2) …
  { id: 'zoom_slot', label: 'Zoom-Slot ein/aus', verb: 'zoom_slot', args: [slotArg, modeArg], toggleKey: 'zoom_slot{slot}_on' },
  { id: 'zoom_slot_mode', label: 'Zoom-Slot: Modus wählen', verb: 'zoom_slot_mode', args: [slotArg, slotModusArg] },
  { id: 'zoom_slot_person', label: 'Zoom-Slot: Person wählen', verb: 'zoom_slot_person',
    args: [slotArg, { id: 'name', label: 'Anzeigename in Zoom', type: 'string', default: '' }] },
  { id: 'zoom_slot_audio', label: 'Zoom-Slot: Ton ein/aus', verb: 'zoom_slot_audio', args: [slotArg, modeArg], toggleKey: 'zoom_slot{slot}_audio' },
],
variables: [
  // … wie heute; geänderte Beschriftungen:
  { id: 'zoom_sources', label: 'Zoom: laufende Slots (Anzahl)' },
  { id: 'zoom_live', label: 'Zoom: mindestens ein Slot läuft (1/0)' },
  { id: 'zoom_cmd', label: 'Zoom: Ergebnis des letzten Zoom-Befehls (ok, f1 … f14)' },
  // je Slot n = 1 … 16 (per Schleife erzeugt):
  { id: `zoom_slot${n}_on`, label: `Zoom-Slot ${n}: eingeschaltet (1/0)` },
  { id: `zoom_slot${n}_live`, label: `Zoom-Slot ${n}: zeigt Bild (1/0)` },
  { id: `zoom_slot${n}_alarm`, label: `Zoom-Slot ${n}: Eingriff nötig (1/0)` },
  { id: `zoom_slot${n}_audio`, label: `Zoom-Slot ${n}: Ton eingeschaltet, Computerton eingerechnet (1/0)` },
  { id: `zoom_slot${n}_mode`, label: `Zoom-Slot ${n}: Modus (teilnehmer/sprecher/freigabe)` },
  { id: `zoom_slot${n}_target`, label: `Zoom-Slot ${n}: wen der Slot zeigt (Name)` },
  { id: `zoom_slot${n}_state`, label: `Zoom-Slot ${n}: Zustand (fehlt/aus/wartet/startet/zeigt/gehalten/ersatz/fehler/zurueckgestellt/stoppt)` },
],
feedbacks: [
  // … wie heute; geänderte Beschriftung: zoom_live „Connect: Zoom-Slots laufen“ …
  { id: 'zoom_slot_on', label: 'Connect: Zoom-Slot eingeschaltet', stateKey: 'zoom_slot{slot}_on', match: 'truthy', arg: slotArg, bgcolor: YELLOW, color: BLACK },
  { id: 'zoom_slot_live', label: 'Connect: Zoom-Slot zeigt Bild', stateKey: 'zoom_slot{slot}_live', match: 'truthy', arg: slotArg, bgcolor: GREEN, color: WHITE },
  { id: 'zoom_slot_alarm', label: 'Connect: Zoom-Slot braucht einen Eingriff', stateKey: 'zoom_slot{slot}_alarm', match: 'truthy', arg: slotArg, bgcolor: RED, color: WHITE },
],
```

Neue Zählung der Rolle `connect`: **16 Aktionen, 128 Variablen, 9 Feedbacks** (heute 12/16/6, `packages/companion-jm-suite/test/selftest.mjs:130`). Die Typen `CapabilityAction.toggleKey` und `CapabilityFeedback.stateKey` (`capabilities.ts:40-60`) bekommen im Kommentar die Platzhalter-Regel: `{slot}` wird durch den Wert des Arguments bzw. der Option `slot` ersetzt; andere Platzhalter gibt es nicht.

### 8.2 STATE-Schlüssel

| Schlüssel | Wert | Regel |
| --- | --- | --- |
| `zoom_status`, `zoom_privilege`, `zoom_cmd`, `zoom_cmd_rejected` | wie heute | ST4 7.5, 11.1; `zoom_cmd` jetzt bis `f14` |
| `zoom_sources` | n | laufende Slots aller Modi (Sender besteht in der aktiven Bridge; SZ4, SZ5, SZ6, SZ9) |
| `zoom_live` | 1/0 | 1 genau dann, wenn n > 0 |
| `zoom_alarm` | 1/0 | Tabelle ST4 7.5 unverändert, mit o = offene Slots nach 10.1 (die Bedeutung von o ändert sich gegenüber 0.3.0 nur dort, wo 10.1 es sagt; 8.4) |
| `zoom_slot{n}_on` | 1/0 | Start-Taste, auch wenn nur für dieses Meeting eingeschaltet (`anNurMeeting`, 7.2); 0 für nicht angelegte Slots |
| `zoom_slot{n}_live` | 1/0 | 1 in SZ4 (zeigt) und SZ5 (gehalten), und nur in Z6–Z9b, also im Meeting (nicht in Z4, Z5, Z10, Z11, Z12, wo ein Sender bestehen kann, aber ungewiss ist, ob Bild kommt, 10.4; Restrunde RR5) |
| `zoom_slot{n}_alarm` | 1/0 | 1, wenn der Slot in o zählt |
| `zoom_slot{n}_audio` | 1/0 | **Ton eingeschaltet, Computerton eingerechnet**: 1, wenn `tonAn` oder (Modus Freigabe und `computerton`); so zeigt die Taste 1, sobald die Quelle laut Einstellung klingt (Nachbesserung B2, B57) |
| `zoom_slot{n}_mode` | `teilnehmer`/`sprecher`/`freigabe` | leer für nicht angelegte Slots |
| `zoom_slot{n}_target` | Name | Anzeigename der Person, die der Slot **gerade zeigt** (SZ4, SZ5; bei Freigabe die teilende Person), nur wenn `zoom_slot{n}_live` = 1; sonst leer. Leerzeichen kodiert der STATE (`packages/suite-control-protocol/src/index.ts:105-107`) |
| `zoom_slot{n}_state` | Zustandswort | `fehlt` (nicht angelegt), `aus` (SZ0), `wartet` (SZ1, SZ2; SZ4–SZ6 außerhalb von Z6–Z9b, also überall, wo `_live` nach der Zeile oben 0 sein muss, etwa in Z5, wenn Zoom Connect mit laufenden Slots in den Warteraum verschiebt; Restrunde RR5), `startet` (SZ3, SZ11), `zeigt` (SZ4), `gehalten` (SZ5), `ersatz` (SZ6), `fehler` (SZ7, SZ8), `zurueckgestellt` (SZ10; startet nie von selbst und braucht „Stopp“/„Start“, Nachbesserung B71), `stoppt` (SZ9) |

Alle 119 `zoom_*`-Schlüssel (7 + 16 × 7) stehen in **jedem** Zustand im STATE, außer unter macOS (dort keiner). Die Hülle meldet nur bei einer Änderung (`apps/connect/src/main/control-state.ts:50-59`). Die Wahrheitsprädikate je Schlüssel stehen in 10.4.

### 8.3 Verben in Connect

Weiche unverändert: alles mit `zoom_` geht an die Zoom-Hülle (`control-state.ts:71-74`). Werte werden ohne Groß-/Kleinschreibung gelesen. Jeder Befehl setzt `zoom_cmd` und `zoom_cmd_rejected` (ST4 8.6). Jeder Befehl wirkt im Kern ohne `await` zwischen Prüfen und Anlegen, so dass ein doppelter Tastendruck nie zwei Slots anlegt (Nachbesserung B79 c).

| Befehl auf der Leitung | Wirkung | Hinweise |
| --- | --- | --- |
| `CONNECT ZOOM_SLOT <nr> <ON\|OFF\|TOGGLE>` | Start-Taste setzen; `TOGGLE` löst Connect selbst auf (falls ein Werkzeug ohne Auflösung sendet); über 5 eingeschaltet → einschalten, Zustimmung setzen (E4) | F9, F13; Warnung F8 |
| `CONNECT ZOOM_SLOT_MODE <nr> <teilnehmer\|sprecher\|freigabe>` | Modus setzen (wirkt sofort, ohne Neustart) | F9, F10 |
| `CONNECT ZOOM_SLOT_PERSON <nr> <Name …>` | Name = übrige Argumente mit einem Leerzeichen (wie `zoom_load`, ST4 0.5); Person setzen und Modus Teilnehmer; die Person muss nicht im Meeting sein | F9, F11 |
| `CONNECT ZOOM_SLOT_AUDIO <nr> <ON\|OFF\|TOGGLE>` | `OFF` macht die Quelle still: `tonAn` und `computerton` aus; der vorige Stand beider Schalter wird gemerkt (nur diese Sitzung). `ON` stellt den gemerkten Stand wieder her; ohne gemerkten Stand oder wenn beide aus waren: `tonAn` an. `TOGGLE` löst über `zoom_slot{n}_audio` auf (8.2; Nachbesserung B57) | F9, F13; Warnung F12 bei Tonart Person außerhalb des Modus Teilnehmer |
| `CONNECT ZOOM_LOAD <Name …>` | Prüfungen wie heute (F1–F4, ST4 11.2). Gibt es Teilnehmer-Slots (dauerhaft oder vorübergehend) mit diesem normierten Namen und ist keiner davon an, wird der mit der kleinsten Nummer eingeschaltet, ein dauerhafter **nur für dieses Meeting** (`anNurMeeting`, 7.2; Restrunde RR7, FR10); ist einer an, ändert sich nichts. Sonst wird nach E13 ein **vorübergehender** Slot angelegt und eingeschaltet (7.2; Nachbesserung B1) | F1–F4, F14; Warnung F8 |
| `CONNECT ZOOM_UNLOAD <Name …>` | `fernSlotEntladen` (7.1): alle eingeschalteten Teilnehmer-Slots mit diesem Namen ausschalten; **vorübergehende werden dabei gelöscht**, dauerhafte bleiben gespeichert (wie das Vergessen des Soll-Eintrags in 0.3.0, `kern.ts:1604-1610`, `:1745-1757`) | F5 |
| `CONNECT ZOOM_DELAY <ms>` | wie heute | F6 |
| `CONNECT ZOOM_<anderes>` | – | F7 |

`zoom_cmd_rejected` = 1 bei F1–F7, F9–F11, F13, F14; 0 bei `ok` und bei den Warnungen F8 und F12. `ZoomBefehlKennung` (`apps/connect/src/shared/types.ts:101`) bekommt `f9` … `f14`; `deuteZoomBefehl` (`fernsteuerung.ts:20-34`) die vier neuen Verben.

### 8.4 Rückwärtsverträglichkeit

- **Modul 0.2.0 gegen Connect 0.4.0:** `zoom_load`, `zoom_unload`, `zoom_delay` wirken wie bisher, jetzt über vorübergehende Teilnehmer-Slots: Sie gelten bis zum Ende des Meetings, `zoom_unload` löscht sie (7.2). Trifft `zoom_load` einen ausgeschalteten dauerhaften Slot dieses Namens, schaltet es ihn ebenso nur für dieses Meeting ein (`anNurMeeting`, 7.2; FR10). Die sieben bisherigen Variablen und drei Zoom-Feedbacks bleiben mit gleicher ID. Was sich an ihrer Bedeutung ändert, steht hier vollständig (Nachbesserung B12, B71):
  - `zoom_sources` zählt jetzt laufende Slots aller Modi; die alte Beschriftung „geladene Quellen (Anzahl)“ bleibt in 0.2.0 sinngemäß wahr, weil jeder laufende Slot eine geladene NDI-Quelle ist.
  - `zoom_alarm` (o): Wie in 0.3.0 hebt eine gezeigte Person, die das Meeting verlässt, den Alarm (verwaister Soll-Eintrag in 0.3.0, `soll.ts:139-162`, `kern.ts:397-413`; hier: Teilnehmer-Slot mit `zeigteSchon` und Grund `participantLeft`/`noTarget`, 10.1; Owner-Frage FR7). Neu ist: Ein dauerhafter Teilnehmer-Slot, dessen Person in einem Meeting gar nicht vorkommt, hebt ihn **nicht** (0.12). Neu ist auch: Ein abgelehntes Abo hebt ihn (`subscribeFailed`), wie in 0.3.0 ein gescheitertes Laden (`kern.ts:1563-1566`).
  - `zoom_cmd` kann jetzt auch `f9` … `f14` tragen; das Modul 0.2.0 beschriftet die Variable weiter mit „(ok, f1 … f8)“ (`capabilities.ts:631`). Von den alten Befehlen liefert nur `zoom_load` einen neuen Wert (`f14`, 16 Slots belegt).
  - Die neuen Schlüssel zeigt 0.2.0 nicht (`main.js:138-140`).
- **Modul 0.3.0 gegen Connect 0.3.0:** Die neuen Verben beantwortet Connect 0.3.0 mit F7 (`fernsteuerung.ts:31-32`); das ist am Pult als `zoom_cmd=f7` sichtbar.
- **Bestehende Companion-Seiten** mit `zoom_load <Name>` legen nach dem Update je Meeting einen vorübergehenden Slot an; sie sammeln keine gespeicherten Slots an. Wer einen Slot behalten will, drückt an der Kachel „Behalten“ oder legt ihn mit „Als Slot laden“ an.

### 8.5 Companion-Modul 0.3.0 (`packages/companion-jm-suite`)

1. `node scripts/sync-companion-protocol.mjs` erzeugt `generated/protocol.mjs` neu (`scripts/sync-companion-protocol.mjs:13-49`); der CI-Schritt „Companion-Protokoll aktuell“ (`.github/workflows/ci-checks.yml:91-92`) wacht darüber.
2. `lib.mjs`, `buildCommandLine` (`lib.mjs:28-46`): Vor dem Nachschlagen `toggleKey.replace('{slot}', String(options.slot))`. Rein, mit Test.
3. `main.js`, `buildFeedbacks` (`main.js:120-136`): `stateKey` vor dem Lesen ebenso auflösen (aus `feedback.options.slot`); `buildPresets` (`main.js:142-162`) hängt heute nur Feedbacks ohne Argument an ein Preset (`main.js:147`, `:159`); für Feedbacks mit Platzhalter hängt es sie mit der Option `slot: 1` an.
4. Version `0.3.0` in `package.json` und `companion/manifest.json` (Gleichheit prüft `test/selftest.mjs:159`); README-Abschnitt Rolle „JM Connect“ (`packages/companion-jm-suite/README.md:42-64`) um die Slots ergänzen.
5. `npm run selftest`, `npm run build:local` → `pkg.tgz`, als `jm-suite-companion-0.3.0.tgz` an das Release `connect-v0.4.0` (13). Der Launcher lädt es nicht mit (`apps/launcher/src/main/release-source.ts:121-136`).

### 8.6 Rundown

Kein Rundown-Release. Der Rundown kennt die neuen Aktionen erst mit seinem nächsten Release (`apps/rundown/src/renderer/src/lib/capabilities.ts`); seine Tally liest `state[f.stateKey]` wörtlich (`ToolLinks.tsx:40-44`) und zeigt die drei Slot-Feedbacks deshalb nie an (sie lügen nicht, sie fehlen). Folgepunkt FP2.

---

## 9 · Texttabelle (alle neuen und geänderten Nutzertexte, wörtlich)

Platzhalter in `{…}`. Singular und Plural stehen ausgeschrieben, wo eine Zahl vorkommt (Nachbesserung B69). `{art}` ist der Ersatzbild-Name aus T4 für das, was die Bridge **sendet** (`sent`, 6.12), nicht für die Einstellung. Die Tabelle wird mit dieser Spec freigegeben (E31; Entwurf C verlangt die Freigabe vor dem Release, 0.36); danach ändert sich ein Text nur mit Owner-OK, als eigener Punkt im Plan, und vor dem Release sieht der Owner die Texte nur noch im Abnahme-Bau. `apps/connect/test/zoom-text.test.ts` hält jede Zeile wörtlich fest (11.6). Im Test tragen die Texte dieser Spec das Präfix „S“ (`ST10` …), weil `T72`, `T74` und `T75` dort schon Tabellen aus ST4 benennen (`zoom-text.test.ts:73`, `:267`, `:304`).

### 9.1 Bezeichnungen

| T | Ort | Text |
| --- | --- | --- |
| T1 | Modus | „Teilnehmer“ |
| T2 | Modus | „Aktiver Sprecher“ |
| T3 | Modus | „Bildschirmfreigabe“ |
| T4 | Ersatzbild | „transparent“ · „eingefroren“ · „schwarz“ · „weiß“; Feldname „Ersatzbild“ |
| T5 | Auflösung | „360p“ · „720p“ · „1080p“; Feldname „Auflösung“ |
| T6 | Ton | Feldname „Ton“; Schalter „an“/„aus“; Tonart „Mischton“ · „Person“ |
| T7 | Ton (Freigabe) | „Computerton der Freigabe“ |
| T8 | Sprecher | „Teilnehmer ohne Kamera zeigen“ |
| T9 | Felder | „NDI-Name“ · „Modus“ · „Person“ · „Einstellungen“ |

### 9.2 Zustandszeile der Kachel (Regeln in 10.2)

| T | Wann | Text |
| --- | --- | --- |
| T10 | Start aus | „Ausgeschaltet.“ |
| T11a | Z1a, Z1b | „Wartet: Zoom ist auf diesem Rechner noch nicht eingerichtet.“ |
| T11b | Z2 | „Wartet auf den Beitritt zu einem Meeting.“ |
| T11c | Z3, Z4 | „Wartet: Connect tritt dem Meeting bei.“ |
| T11h | Z5a, Z5b (neu, Nachbesserung B64) | „Wartet: Connect ist im Warteraum des Meetings.“ |
| T11d | Z10 | „Verbindung zum Meeting unterbrochen, Zoom verbindet neu.“ |
| T11e | Z11 | „Verbindung zum Meeting verloren, Connect tritt neu bei.“ |
| T11f | Z12 | „Connect verlässt das Meeting.“ |
| T11g | Z13 (geändert, Nachbesserung B50) | „Läuft nicht: Zoom meldet einen Fehler (siehe oben).“ |
| T12a | im Meeting, Erlaubnis angefragt | „Wartet auf die Aufnahme-Erlaubnis des Hosts.“ |
| T12b | im Meeting, Erlaubnis entzogen, der Slot lief in diesem Meeting | „Gestoppt: Der Host hat die Aufnahme-Erlaubnis entzogen. Erteilt er sie wieder, startet der Slot von selbst.“ |
| T12d | im Meeting, Erlaubnis entzogen, der Slot lief noch nicht (neu) | „Wartet: Der Host hat die Aufnahme-Erlaubnis entzogen. Erteilt er sie wieder, startet der Slot von selbst.“ |
| T12c | im Meeting, Erlaubnis abgelehnt oder abgelaufen | „Wartet: Ohne Aufnahme-Erlaubnis startet kein Slot.“ |
| T13 | Teilnehmer, Name doppelt | „Name doppelt: „{Person}“ ist {d}-mal im Meeting. Bitte unten die richtige Person wählen. · Ersatzbild {art}“ |
| T13b | Teilnehmer, gezeigte Person gegangen, ein Namensvetter war schon vorher da (neu, Nachbesserung B11) | „„{Person}“ hat das Meeting verlassen; eine andere Person mit diesem Namen ist noch da. Ist sie gemeint, unten wählen. · Ersatzbild {art}“ |
| T14 | Start gesendet oder geplant | „Startet …“ |
| T15 | Teilnehmer, Bild kommt | „Zeigt {Person}.“ |
| T16 | Teilnehmer, Person nicht im Meeting | „Wartet auf {Person} · Ersatzbild {art}“ |
| T17 | Teilnehmer, Person im Warteraum | „Wartet auf {Person} (im Warteraum) · Ersatzbild {art}“ |
| T18 | Teilnehmer ohne Person | „Keine Person gewählt · Ersatzbild {art}“ |
| T19 | Teilnehmer, Zoom meldet Kamera aus | „{Person}: Kamera aus · Ersatzbild {art}“ |
| T19b | Teilnehmer, kein Bild ohne Meldung „Kamera aus“ (neu, Nachbesserung B52) | „{Person}: Zoom liefert gerade kein Bild · Ersatzbild {art}“ |
| T20 | erstes Bild nach Start oder Wechsel steht aus | „{Ziel}: erstes Bild steht noch aus · Ersatzbild {art}“ — `{Ziel}` ist der Name der Person bzw. „Freigabe von {Person}“ |
| T20b | fehlerhafte Bilder | „{Ziel}: fehlerhafte Bilder verworfen · Ersatzbild {art}“ |
| T20c | Abo abgelehnt (geändert, Nachbesserung B51) | „{Ziel}: Zoom hat das Abo abgelehnt ({name}) · Ersatzbild {art}. Für einen neuen Versuch „Stopp“ und wieder „Start“.“ |
| T21 | keine Antwort | „Keine Antwort der Zoom-Bridge. Für einen neuen Versuch „Stopp“ und wieder „Start“.“ |
| T22 | zurückgestellt | „Nicht gestartet: mehr als 5 Slots ohne Bestätigung. Für die Bestätigung einmal „Stopp“ und wieder „Start“.“ |
| T23 | Aufbau gescheitert (geändert, Nachbesserung B61) | „Gescheitert: {Klartext} Für einen neuen Versuch „Stopp“ und wieder „Start“.“ (Klartexte 9.6) |
| T24 | wird gestoppt | „Wird gestoppt …“ |
| T25 | Sprecher, Bild kommt | „Zeigt {Person} (Sprecher).“ |
| T26 | Sprecher, noch niemand erkannt oder gegangen | „Wartet auf eine sprechende Person · Ersatzbild {art}“ |
| T27 | Sprecher, Zoom meldet Kamera aus | „{Person} (Sprecher): Kamera aus · Ersatzbild {art}“ |
| T27b | Sprecher, kein Bild ohne Meldung „Kamera aus“ (neu) | „{Person} (Sprecher): Zoom liefert gerade kein Bild · Ersatzbild {art}“ |
| T28 | Freigabe, eine | „Zeigt die Freigabe von {Person}.“ |
| T28b | Freigabe, mehrere | „Zeigt die Freigabe von {Person} (die neueste von {m}: {Namen}).“ |
| T29 | Freigabe pausiert, letztes Bild gehalten | „Freigabe von {Person} pausiert · letztes Bild gehalten“ |
| T29b | Freigabe unverändert, letztes Bild gehalten | „Freigabe von {Person} unverändert · letztes Bild gehalten“ |
| T29d | Freigabe pausiert, noch kein Bild dieser Freigabe (neu, Nachbesserung B46) | „Freigabe von {Person} pausiert · noch kein Bild · Ersatzbild {art}“ |
| T29e | Freigabe läuft, kein Bild und keine Kopie (neu) | „Freigabe von {Person}: Zoom liefert gerade kein Bild · Ersatzbild {art}“ |
| T29c | niemand teilt | „Wartet auf eine Bildschirmfreigabe · Ersatzbild {art}“ |
| T60 | gesendet wird transparent, eingestellt ist „eingefroren“ (ersetzt „Ersatzbild {art}“; geändert, Nachbesserung B54) | „Ersatzbild eingefroren (kein gespeichertes Bild, darum transparent)“ |
| T96 | Kennzeichen vorübergehender Slot (neu, Nachbesserung B1) | Kennzeichen „vorübergehend“, Tooltip „Per Companion geladen; gilt bis zum Ende dieses Meetings.“, Knopf „Behalten“ |
| T96b | Kennzeichen dauerhafter Slot, per `zoom_load` nur für dieses Meeting eingeschaltet (`anNurMeeting`; neu, Restrunde RR7) | Kennzeichen „nur dieses Meeting an“, Tooltip „Per Companion eingeschaltet; nach dem Ende dieses Meetings wieder aus. „Behalten“ lässt ihn eingeschaltet.“, Knopf „Behalten“ |
| T97 | Zusatz, ein anderer laufender Slot hat dasselbe Ziel (neu, Nachbesserung B35) | „ · Slot {m} zeigt dieselbe Quelle; ob Zoom zwei Abos derselben Quelle zugleich beliefert, ist noch nicht gemessen.“ |

### 9.3 Slot-Bereich und Kachel

| T | Wann | Text |
| --- | --- | --- |
| T30 | keine Slots (geändert, Nachbesserung B68) | „Noch keine Slots. „Slot hinzufügen“ oder, sobald Connect im Meeting ist, in der Teilnehmerliste eine Person „Als Slot laden“.“ |
| T31 | Kopf | „{a} von 16 Slots · {e} eingeschaltet · {n} laufen“; bei n = 1: „{a} von 16 Slots · {e} eingeschaltet · 1 läuft“ |
| T32 | 16 Slots | „Höchstens 16 Slots. Zuerst einen Slot löschen.“ |
| T33 | Start-Schalter, Slot aus | „Start“ |
| T34 | Start-Schalter, Slot an | „Stopp“ |
| T35 | NDI-Name gesperrt (geändert, Nachbesserung B50) | „Den NDI-Namen erst ändern, wenn der Slot ausgeschaltet ist.“ |
| T36 | Löschen gesperrt (geändert) | „Zum Löschen den Slot erst ausschalten.“ |
| T37 | Rückfrage Löschen | „Slot {nr} „{NDI-Name}“ löschen? Seine Einstellungen gehen verloren.“ · Knöpfe „Löschen“, „Abbrechen“ |
| T38 | Teilnehmerliste | „Als Slot laden“ |
| T39 | Teilnehmerliste, Slots zeigen diese Person (geändert, Nachbesserung B67) | „läuft in Slot {nr}“; mehrere: „läuft in Slot {nr1} und {nr2}“ bzw. „läuft in Slot {nr1}, {nr2} und {nr3}“ |
| T39b | Teilnehmerliste, Slot mit diesem Namen vorhanden, aus | „Slot {nr} einschalten“ |
| T39c | Teilnehmerliste, Slot mit diesem Namen an, zeigt ihn nicht (neu) | „Slot {nr} ist an und zeigt die Person nicht (siehe Kachel)“ |
| T39d | Teilnehmerliste, Name doppelt oder im Zweifel (neu) | „Slot {nr}: Name doppelt, bitte an der Kachel wählen“ |
| T40 | Nachfrage (E4) | „Mehr als 5 Zoom-Slots gleichzeitig sind nicht gemessen. Den {n}. Slot trotzdem einschalten? Ob dieser Rechner es schafft, zeigen die Messwerte.“ |
| T41 | Knopf | „Trotzdem einschalten“ |
| T42 | Knopf | „Abbrechen“ |
| T43 | NDI-Name leer oder zu lang | „Der NDI-Name muss 1 bis 60 Zeichen lang sein.“ |
| T44 | Doppelpunkt | „Ein Doppelpunkt ist im NDI-Namen nicht erlaubt (NDI macht daraus ein Leerzeichen).“ |
| T45 | Name doppelt unter Slots | „Diesen NDI-Namen trägt schon Slot {nr}.“ |
| T46 | Name gleich einem Browser-Gast (Warnung; ersetzt Q10 für Slots) | „NDI-Name doppelt: Ein Browser-Gast sendet ebenfalls als „{ndiName}“. Im Switcher ist nicht sicher, welche Quelle ankommt. Einen der beiden umbenennen.“ |
| T47 | Steuerzeichen | „Steuerzeichen sind im NDI-Namen nicht erlaubt.“ |
| T48 | Feld Person, leer | „Anzeigename in Zoom“ |
| T49 | Doppelname-Auswahl | „Welche Person?“ |
| T50 | Messzeile, Größe erreicht die Stufe oder Freigabe (Regel 10.7) | „{res} · Zoom liefert {b}×{h} · {fps} Bilder/s“ |
| T51 | Messzeile, kürzere Seite unter der Stufe (Regel 10.7) | „{res} gewünscht · Zoom liefert {b}×{h} · {fps} Bilder/s“ |
| T51b | Messzeile, noch kein Bild dieses Ziels | „{res} gewünscht · noch kein Bild“ |
| T51c | Messzeile, früher Bilder, im laufenden Fenster keins (neu, Nachbesserung B55) | „{res} · zuletzt {b}×{h} · jetzt kein Bild“ |
| T52 | Tooltip Vorschau | „Vorschau ohne Bild-Versatz, etwa 2 Bilder pro Sekunde.“ |
| T53 | Kennzeichen | „eingefroren“ |
| T54 | Kennzeichen | „gehalten“ |
| T55 | Vorschau, kein Sender | „kein Bild“ |
| T55b | Vorschau, Slot zeigt Bild, Vorschau fehlt (neu, Nachbesserung B59) | „kein Vorschaubild“ |
| T56 | Vorschau abgeschaltet | „Vorschau aus“ |
| T57 | `previewUnavailable`, an jeder Kachel | „Vorschau nicht verfügbar ({detail}). Bild und Ton laufen unverändert.“ |
| T58a | nichts eingestellt (Regel 10.6) | „Ton: aus“ |
| T58b | Ton wartet | „Ton: {Quelle} · wartet auf das erste Paket“ — `{Quelle}` ist „Mischton“, „{Person}“ (ohne gewählte Person „Person-Ton“; Sechste Runde RN12), „Computerton“ oder „Mischton + Computerton“ |
| T58c | Ton läuft | „Ton: {Quelle} · läuft ({rate} kHz, {kanäle})“ — `{Quelle}` aus dem **gemessenen** Ton (6.3), `{rate}` in kHz mit einer Nachkommastelle, `{kanäle}` „mono“ oder „{c} Kanäle“ |
| T58d | Ton-Lücke | „Ton: {Quelle} · Stille (keine Pakete)“ |
| T58e | Person weg | „Ton: {Person} · aus, die Person ist nicht im Meeting“ |
| T58f | nur Computerton eingestellt, keine gezeigte Freigabe (geändert, Fünfte Runde: „niemand teilt“ wäre bei einer reinen Ton-Freigabe falsch, die nie gezeigt wird, 6.9) | „Ton: Computerton · wartet auf eine Bildschirmfreigabe“ |
| T58g | Zusatz, Computerton eingestellt, kommt aber nicht an (neu, Nachbesserung B56) | „ · Computerton kommt nicht an“ |
| T58h | eingestellt, Slot läuft nicht (neu, Nachbesserung B58) | „Ton: {Quelle}, sobald der Slot läuft“ |
| T58i | Person-Ton, der Slot zeigt niemanden, weil eine Wahl fehlt: Name doppelt, Zweifel nach dem Weggang oder keine Person gewählt (neu, Sechste Runde RN12) | „Ton: Person-Ton · aus, bis eine Person gewählt ist“ |
| T75 | Person-Ton außerhalb Teilnehmer, ohne Computerton (geändert, Nachbesserung B2) | „Ton: Person-Ton gibt es nur im Modus Teilnehmer. Der Slot sendet keinen Meeting-Ton.“ |
| T75b | dasselbe, Computerton läuft (neu) | „Ton: Person-Ton gibt es nur im Modus Teilnehmer; es läuft nur der Computerton.“ |
| T76 | Mischton und Computerton passen nicht | „Ton: Mischton und Computerton passen nicht zusammen ({r1} und {r2}). Es läuft nur der Computerton.“ |
| T77 | Vorgaben (Kopf) | „Vorgaben für neue Slots: {res}, Ton {an/aus}.“ |
| T80 | Verlassen-Rückfrage (heute `ZoomCard.tsx:748`) | „Ja, verlassen ({n} Slots laufen)“; bei n = 1: „Ja, verlassen (1 Slot läuft)“ |
| T81 | unter dem Bild-Versatz | „Gilt für Teilnehmer- und Sprecher-Slots, nicht für Bildschirmfreigaben.“ |
| T98 | Tooltip „Als Slot laden“ bei einer Person im Warteraum (übernimmt Q15 wörtlich) | „Erst im Zoom-Client zulassen.“ |

### 9.4 Messwerte und Sprecher-Einstellungen

| T | Wann | Text |
| --- | --- | --- |
| T61 | Prozess | „Zoom-Bridge: {cpu} % eines Kerns · System {sys} % · Arbeitsspeicher {mem} MB · Ton-Warteschlange höchstens {q} Pakete, {d} verworfen · Zoom-Ereignisse verworfen {mv} · zurückgehaltene Renderer {hl}“ — `{hl}` = `halteliste` (6.15; Nachfix W2) |
| T62 | je Slot | „Slot {nr} ({Modus}): {b}×{h}, {fps} Bilder/s, Ersatzbilder {ffps}/s · Bridge-Anteil {work} ms/s (davon Kopie {copy}, Vorschau {prev}) · Speicher {mem} MB · Auflösung {res}: {resSetName}, Renderer meldet {resGot} · Ton {pps} Pakete/s, Mischer verworfen {md} ms, Stille eingefügt {ms} ms“ — `{resSetName}` über `sdkErrorName` (`src/protocol.ts:259-260`), nie als nackte Zahl |
| T62b | Empfang laut Zoom (neu, zu MS24) | „Slot {nr}: Zoom nennt als Videogröße {ub}×{uh} · HD-Video {hd} · Originalgröße {og} · Meeting empfängt Video {rv}, Freigabe {rs}“ (fehlende Werte: „unbekannt“) |
| T62c | Rückkehr (neu, zu MS16) | „Rückkehr in Slot {nr}: persistentId {vergleich}“ — `{vergleich}` ist „gleich“, „verschieden“ oder „fehlt“ (Restrunde: die frühere Schreibweise mit senkrechten Strichen zerlegte die Tabellenzeile) |
| T63 | Freigabe | „Freigabe: {b}×{h}, {fps} Bilder/s · Computerton {rate} kHz, {kanäle} · Pausen {p}, gehaltene Bilder {g}“ — `{p}` = `pauses` der gezeigten Freigabe (`shares`), `{g}` = `heldFrames` (`slotStats`) |
| T63c | Freigabe-Rückrufe (neu, zu MS6) | Überschrift „Freigabe-Rückrufe (letzte 10)“, Spalten „Uhrzeit“, „Rückruf“, „Zustand“, „Person (Kennung)“, „Freigabe-Kennung“, „Typ“ |
| T64 | Freigabe, kein Freigabe-Ton angekommen (`shareAudioPackets` = 0) | „Freigabe: {b}×{h}, {fps} Bilder/s · kein Computerton angekommen“ |
| T64c | Freigabe-Ton angekommen, keiner Freigabe zuzuordnen (neu, Nachbesserung B39) | „Freigabe: {b}×{h}, {fps} Bilder/s · Computerton kommt an ({x} Pakete), lässt sich aber keiner Freigabe zuordnen (Kennung {k})“ |
| T64b | Befüllen | „Laufende Freigaben beim Befüllen: erkannt“ · „… keine gemeldet“ · „… Zoom hat die Liste nicht geliefert“ |
| T65 | Sprecher-Tabelle | Überschrift „Sprecher-Signale (letzte 20)“, Spalten „Uhrzeit“, „Video-Sprecher“, „Aktives Video“, „Ton-Aktivität“ |
| T66 | Lücke | „Lücke beim Wechsel: zuletzt {a} ms · Median {m} ms · höchstens {x} ms ({w} Wechsel)“; bei w = 1: „(1 Wechsel)“; mit `gapUngeprueft`: Zusatz „ (ohne Prüfung der Quelle)“ |
| T67 | Wechsel | „Wechsel pro Minute: {r}“ |
| T68 | nach dem Kopieren | „Messwerte kopiert (ohne Namen).“ |
| T69 | Zähler (geändert) | „Zähler: fremde Bilder {f} · beim Umhängen verworfen {l} · zu häufige Aufrufe {t} · noch keine Freigabe-Daten {nsd} · neue Renderer {r} · vom SDK abgebaute Renderer {rl} · Renderer-Typ {typ}“ |
| T70 | Signal | „Video-Sprecher (onActiveSpeakerVideoUserChanged, Vorgabe)“ |
| T71 | Signal | „Aktives Video (onActiveVideoUserChanged)“ |
| T72 | Signal | „Ton-Aktivität (onUserActiveAudioChange)“ |
| T73 | Haltezeit | „Haltezeit: {s} s. So lange muss jemand sprechen, bevor der Sprecher-Slot wechselt.“ |
| T74 | Haltezeit ungültig | „Haltezeit: erlaubt sind 0 bis 5 Sekunden.“ |

### 9.5 Statuszeilen (geändert gegenüber ST4 7.2)

| T | Z | Tray-Zeile und Kopfzeile | Statuszeile der Zoom-Karte |
| --- | --- | --- | --- |
| T82 | Z7, entzogen, `slotsGestopptEntzug` > 0 | „△ Zoom: Aufnahme-Erlaubnis vom Host entzogen, Slots gestoppt“ | „Aufnahme-Erlaubnis vom Host entzogen, Slots gestoppt. Erteilt der Host sie im Zoom-Client wieder, startet Connect die eingeschalteten Slots von selbst.“ |
| T83 | Z7b | „△ Zoom: {n} Slots laufen, Aufnahme-Erlaubnis fehlt“; bei n = 1: „△ Zoom: 1 Slot läuft, Aufnahme-Erlaubnis fehlt“ | „Die Aufnahme-Erlaubnis fehlt ({Grund}). {n} Slots laufen noch. Der Host kann sie im Zoom-Client erteilen.“ (n = 1: „1 Slot läuft noch“) — entzogen: „Aufnahme-Erlaubnis vom Host entzogen. Connect stoppt {n} Slots …“ (n = 1: „Connect stoppt 1 Slot …“) |
| T84 | Z8 | „○ Zoom: im Meeting, kein Slot läuft“ | e = 0: „Im Meeting. Kein Slot läuft: Slots unten einschalten oder eine Person als Slot laden.“ — e > 0: „Im Meeting. Kein Slot läuft; die Kacheln unten nennen den Grund.“ |
| T85 | Z9 | „● Zoom: {n} Slots laufen“; bei n = 1: „● Zoom: 1 Slot läuft“ | „Im Meeting. {n} Slots laufen.“ (n = 1: „Im Meeting. 1 Slot läuft.“) |
| T86 | Z9b (geändert, Nachbesserung B65) | „● Zoom: {n} Slots laufen, {k} mit Ersatzbild“; bei n = 1: „● Zoom: 1 Slot läuft, mit Ersatzbild“ | „Im Meeting. {n} Slots laufen, {k} davon mit Ersatzbild; die Kacheln nennen den Grund.“ (n = 1: „Im Meeting. 1 Slot läuft, mit Ersatzbild; die Kachel nennt den Grund.“) |
| T87 | R5 (Hinweis; geändert, Nachbesserung B63) | – | „Wieder im Meeting. {gestartet} Slots laufen wieder.“ (1: „1 Slot läuft wieder.“), mit Zusätzen je nach Lage: „ {zweifel} warten auf eine eindeutige Person.“, „ {nicht} nicht gestartet (siehe Kachel).“, „ {grenze} über der Grenze von 5 nicht gestartet.“ (je mit Singular „1 wartet …“) |

Alle übrigen Zeilen aus ST4 7.2 (Z0–Z6, Z7 ohne Entzug, Z10–Z13) bleiben wörtlich. Der Tooltip (ST4 7.4) bleibt wörtlich; „n“ ist jetzt die Zahl laufender Slots.

### 9.6 Klartexte zu Fehlern (Kachel, Hinweise, Meldungen)

| T | Schlüssel | Text |
| --- | --- | --- |
| T100 | `slotNoPrivilege` | wie Q1: „Keine Aufnahme-Erlaubnis — der Host muss sie im Zoom-Client erteilen.“ (kein Fehlerstand; der Slot wartet, 7.3 Nr. 2) |
| T101 | `slotRawRecordingFailed`, `slotSenderFailed`, `slotRendererFailed` | „Der Slot ließ sich nicht aufbauen ({name}). Details im Log.“ |
| T102 | `slotNameTaken` | „Diesen NDI-Namen trägt schon ein laufender Slot.“ |
| T103 | `slotBad…`, `speakerBad…` (Programmfehler, sollte nie kommen; ohne Slot unter „Hinweise“) | „Die Zoom-Bridge hat die Einstellung abgelehnt ({name}). Details im Log.“ |
| T104 | Ton-Abo-Fehler (Q5 geändert; nur `audioVoipJoinFailed`, `audioHelperMissing`, `audioSubscribeFailed`, Regeln 7.1, 10.6; Nachfix W6), an jeder Kachel mit Ton | „Ton nicht verfügbar ({name}) — das Bild läuft ohne Ton. Für einen neuen Versuch den Ton aus- und wieder einschalten.“ |
| Q6 | `audioQueueOverflow` (Hinweis, unverändert aus 0.3.0, `klartext.ts:115`) | „Ton: {d} Pakete verworfen — dieser PC kommt nicht hinterher.“ |
| T106 | `audioBufferMismatch` (Hinweis, ersetzt Q17 für Slots; neu, Nachfix W6) | „Ton: ein fehlerhaftes Paket in Slot {nr} verworfen (audioBufferMismatch). Der Ton läuft mit dem nächsten gültigen Paket weiter.“ |
| T105 | `slotBufferMismatch` (Hinweis, wie Q16) | „Bild: fehlerhafte Bilder in Slot {nr} verworfen (slotBufferMismatch). Der Slot läuft weiter; ob wieder Bild kommt, zeigt seine Kachel.“ |
| – | `slotAlreadyOn`, `slotNotOn` | kein Text (`'keine'`, 7.1) |
| – | `slotReconnecting` (neu, Nachfix W2) | kein Text (`'keine'`, 7.1): Die Kachel steht in Z10 ohnehin auf T11d, und der Abgleich nach `inMeeting` startet den Slot |
| T90 | Einstellungsdatei unlesbar | „Die Einstellungen von Connect waren unlesbar. Die Datei liegt gesichert als „{datei}“; Connect arbeitet mit den Vorgaben weiter, auch für die Zoom-Slots.“ |
| T91 | Slots verworfen | „{x} gespeicherte Slots waren unvollständig oder doppelt und wurden nicht übernommen.“ (1: „1 gespeicherter Slot war unvollständig oder doppelt und wurde nicht übernommen.“) |
| T92 | Schreiben gescheitert (gleich `TEXT_A4_SCHREIBFEHLER`, `zoom-text.ts:19`; Nachbesserung B69) | „Nur für diese Sitzung gemerkt — die Einstellungsdatei ließ sich nicht schreiben.“ |
| T95 | macOS | „Zoom-Slots gibt es nur unter Windows: Die Zoom-Bridge läuft nur dort.“ |

### 9.7 Fernsteuer-Hinweise (Vorsatz „Companion: “, ST4 8.6)

| ID | Text |
| --- | --- |
| F5 (geändert) | „kein eingeschalteter Teilnehmer-Slot mit „{name}“.“ |
| F8 (geändert) | „{n}. Slot eingeschaltet — mehr als 5 sind nicht gemessen.“ |
| F9 | „Slot „{arg}“ gibt es nicht.“ |
| F10 | „Modus „{arg}“ unbekannt — erlaubt sind teilnehmer, sprecher und freigabe.“ |
| F11 | „Slot {nr}: kein Anzeigename angegeben.“ |
| F12 (geändert) | „Slot {nr}: Person-Ton gibt es nur im Modus Teilnehmer, der Slot sendet keinen Meeting-Ton.“ |
| F13 | „Wert „{arg}“ ungültig — erlaubt sind ON, OFF und TOGGLE.“ |
| F14 (geändert) | „kein freier Slot (höchstens 16, vorübergehende eingerechnet).“ |

Entfallen: Q8 („Keine Antwort … auf „Als Quelle laden““, ersetzt durch T21), Q9 (ersetzt durch T40), Q10 (für Slots ersetzt durch T46 an der Kachel), Q11 (ersetzt durch T13/T13b), Q14 (Ton nur vor dem Laden, 0.8), Q17 (für Slots ersetzt durch T106, Nachfix W6), die Soll-Stände (`zoom-text.ts:448-479`) und die Personen-Zeilen „wird: …“ (`ZoomCard.tsx:430-438`). Q15 bleibt als T98 (Nachbesserung B68).

---

## 10 · Status-Wahrheit (Kreuzprodukt)

Grundsatz bleibt (`zoom-text.ts:1-4`): Jeder Text muss in **jedem** Zustand wahr sein, in dem er steht. Das gilt für **jede** dauerhaft sichtbare Zeile, nicht nur für die Zustandszeile (Entwurf B.5, C; Nachbesserung B3, B58, B77): Zustandszeile (10.2), Kopfzeile, Tray und Karte (10.3), STATE (10.4), Tonzeile (10.6), Messzeile (10.7), Vorschau (10.8), Fehlerzeile (10.9), Teilnehmerliste (10.10), Slot-Kopf und Hinweis R5 (10.11). Die Meeting-Zustände Z0–Z13 gelten unverändert (ST4 7.1; `zoomZ`, `zoom-text.ts:57-85`); neu kommt der Zustand jedes Slots dazu.

### 10.1 Slot-Zustände

Quer laufen: n = laufende Slots, k = Slots mit Ersatzbild, o = offene Slots, e = eingeschaltete Slots. Welcher Zustand gilt, legt die Vorrangfolge in 7.3 fest (erste passende Zeile).

| SZ | `zustand` | Bedingung | in n | in k | in o |
| --- | --- | --- | --- | --- | --- |
| SZ0 | `aus` | Start-Taste aus und kein Sender | – | – | – |
| SZ1 | `ohne_meeting` | an, Zustand nicht `im_meeting`, kein Sender der aktiven Bridge | – | – | ja, wenn `liefSchon` |
| SZ2 | `wartet_erlaubnis` | an, `im_meeting`, Erlaubnis ≠ `ja`, kein Sender | – | – | ja, wenn `liefSchon` |
| SZ3 | `startet` | `slotOn` gesendet, noch kein `slot`-Ereignis, Frist läuft | – | – | – |
| SZ4 | `zeigt` | Bridge `live` (bei Freigabe auch mit `sent = held`, höchstens 2 s ohne neues Bild, 6.9) | ja | – | – |
| SZ5 | `gehalten` | Bridge `held` (nur Freigabe) | ja | – | – |
| SZ6 | `ersatz` | Bridge `starting` oder `fallback` | ja | ja | ja bei `doppelt` > 1, bei `zweifel` (T13b), bei Grund `subscribeFailed`, und bei Teilnehmer-Slots mit Grund `participantLeft`/`noTarget` und `zeigteSchon` (FR7) |
| SZ7 | `keine_antwort` | Fehlerstand: Frist abgelaufen | – | – | ja |
| SZ8 | `gescheitert` | Fehlerstand: Aufbau-Fehler der Bridge zu diesem Slot | – | – | ja |
| SZ9 | `stoppt` | `slotOff` gesendet oder Bridge im Abbau, Sender noch nicht weg | ja | – | – |
| SZ10 | `zurueckgestellt` | Fehlerstand nach 7.3 Nr. 3 | – | – | ja |
| SZ11 | `geplant` | an, `im_meeting`, Erlaubnis `ja`, kein Sender, keine Frist, kein Fehlerstand (bis zu 300 ms vor dem nächsten Abgleich; Nachbesserung B14) | – | – | – |

`doppelt` > 1 gibt es nur ohne gültige `gewaehlteId` (7.3 Nr. 5 b, c): Hat der Bediener gewählt oder zeigt der Slot schon eine Person, steht nach dem Ausschalten ihrer Kamera T19 und kein Alarm (Nachbesserung B60). Ein abgelehntes Abo (`subscribeFailed`) zählt in o, weil der Slot ohne Handgriff nicht wieder versucht (6.10; Nachbesserung B51). Ein dauerhafter Teilnehmer-Slot, dessen Person in diesem Meeting nie da war, zählt nicht (0.12).

Nach einem Wiederbeitritt mit neuer Bridge (Z11 → `im_meeting`) und während Zooms eigener Wiederverbindung (Z10) gilt die Generationsregel: Sender der alten Bridge zählen bis zu ihrem Abbau in n (ST4 7.1); eine neue Bridge startet erst danach (7.3 Nr. 10).

### 10.2 Zustandszeile der Kachel

Erste passende Regel gewinnt (Texte 9.2):

1. SZ0 → T10. SZ9 → T24.
2. Zustand nicht `im_meeting`: Z1a/Z1b → T11a; Z2 → T11b; Z3, Z4 → T11c; Z5a, Z5b → T11h; Z10 → T11d; Z11 → T11e; Z12 → T11f; Z13 → T11g. (Ein Sender der aktiven Bridge kann bestehen in Z5, wenn Zoom Connect aus dem Meeting in den Warteraum verschiebt (`kern.ts:1261`), in Z4 nach dem Einlass von dort (`kern.ts:1232`), in Z10 und kurz in Z12, das vor dem Abbau gesetzt wird (`kern.ts:1337-1338`); T11c, T11h, T11d und T11f behaupten dann nichts über das Bild, und der STATE meldet `wartet`, 10.4; Restrunde RR5.)
3. SZ2 → T12a (offen); entzogen: T12b mit `liefSchon`, sonst T12d; T12c (abgelehnt, abgelaufen). SZ3, SZ11 → T14. SZ7 → T21. SZ8 → T23. SZ10 → T22.
4. SZ4: Teilnehmer T15, Sprecher T25, Freigabe T28 bzw. T28b (mehr als eine Bild-Freigabe), bei Freigabe mit `sent = none` **und** mit `sent = held` (die ersten 2 s ohne neues Bild: Die gezeigte Freigabe läuft, der Sender wiederholt ihr letztes Bild, die Kachel bleibt ruhig; 6.9, Nachbesserung B66, Nachfix W1). Bei Teilnehmer und Sprecher kommt `live` nur mit `sent = none` vor (nach 200 ms ohne Bild wechselt der Zustand, 6.12).
5. SZ5: `sharePaused` T29, `shareStill` T29b.
6. SZ6, Teilnehmer: `doppelt` > 1 → T13; `zweifel` → T13b; keine Person → T18; im Warteraum → T17; `noTarget`, `participantLeft` → T16; `cameraOff` → T19; `noFrames` → T19b; `bufferMismatch` → T20b; `subscribeFailed` → T20c; sonst (vor dem ersten Bild) → T20.
7. SZ6, Sprecher: `speakerNone` oder `noTarget` → T26; `cameraOff`, `speakerNoVideo` → T27; `noFrames` → T27b; `bufferMismatch` → T20b; `subscribeFailed` → T20c; sonst → T20.
8. SZ6, Freigabe: `shareNone` oder `noTarget` → T29c; `sharePaused` → T29d; `noFrames` → T29e; `bufferMismatch` → T20b; `subscribeFailed` → T20c; sonst → T20.

   Zu 6–8 (Nachfix W7): Bei Ziel 0 meldet die Bridge immer einen Ziel-0-Grund (`noTarget`, `participantLeft`, `speakerNone`, `shareNone`; 6.10 Schritt 3), nie `modeChanged`, `targetChanged` oder `resolutionChanged`. „sonst → T20“ trifft darum nur Slots mit Ziel; der Generator in 10.5 erzeugt `modeChanged`, `targetChanged` und `resolutionChanged` nur zusammen mit einem Ziel ≠ 0.
9. „Ersatzbild {art}“ nennt `sent` der Bridge. Ist „eingefroren“ eingestellt und `sent` = `transparent`, ersetzt T60 den Teil.
10. In SZ6 mit `noFrames` oder `subscribeFailed` hängt T97 an, wenn ein anderer laufender Slot dasselbe Ziel hat.

Prüfung auf Wahrheit, Zeile für Zeile:
- „Zeigt …“ (T15, T25, T28) steht nur, wenn die Bridge Bilder meldet (`live`). Bei Teilnehmer und Sprecher ist dann `sent = none`; bei Freigabe kann `sent = held` sein, solange seit dem letzten Bild höchstens 2 s vergangen sind (Zustandsschwelle 6.9; Nachfix W1). Ein Bild, das länger gehalten wird, heißt „gehalten“ (SZ5), nie „zeigt“.
- „erstes Bild steht noch aus“ (T20) steht nur mit einem Ziel ≠ 0; ohne Ziel nennt die Zeile den Grund dafür (6.10 Schritt 3; Nachfix W7).
- „Ersatzbild …“ steht nur in SZ6, also nur, wenn der Sender besteht und Zoom kein Bild liefert, und nennt, was gesendet wird (`sent`), nicht die Einstellung.
- „Wartet auf {Person}“ (T16) steht nur, wenn die Person laut Teilnehmerliste nicht im Meeting ist; ist sie im Warteraum, sagt es T17; ist sie da, aber ohne Bild, sagt es T19, T19b oder T20.
- „Kamera aus“ steht nur mit dem Grund `cameraOff`/`speakerNoVideo`, und `cameraOff` setzt die Bridge nur, wenn Zoom für das Ziel die Kamera als aus meldet (6.7); nie aus dem Kennzeichen der Teilnehmerliste allein und nie aus einem bloßen Bildausfall (dann T19b/T27b/T29e).
- „Name doppelt“ (T13) steht nur ohne gültige `gewaehlteId`.
- „(Sprecher)“ in T25/T27 behauptet nicht, dass die Person **jetzt** spricht, nur dass sie über das Sprecher-Signal kam.
- „die neueste von {m}“ (T28b) zählt nur Bild-Freigaben; reine Ton-Freigaben (auch über `SHARE_TYPE_COMPUTER_AUDIO`) fehlen darin (6.9).
- „gehalten“ (T29, T29b) steht nur mit einer Kopie dieses Ziels; ohne sie T29d bzw. T29e.
- T11c, T11d, T11f und T11h behaupten nichts über Bild oder Sender, weil beides dort ungewiss ist.
- „Gestoppt“ (T12b) steht nur bei `entzogen` **und** `liefSchon`: Nur ein Slot, der lief, wurde gestoppt; T11g sagt „Läuft nicht“, weil nach einem gescheiterten ersten Beitritt kein Slot lief (Nachbesserung B50).
- T21, T22, T23, T20c sagen, was der Bediener tun kann; der Kern versucht nichts von selbst (7.3 Nr. 2).

### 10.3 Kopfzeile, Tray und Statuszeile der Karte

Z8, Z9, Z9b hängen an n und k wie heute an `quellen`/`ohneBild` (`zoom-text.ts:71-77`); Z8 unterscheidet in der Karte zusätzlich e = 0 und e > 0 (T84). Z7 mit Entzug nennt „Slots gestoppt“ (T82) nur bei `slotsGestopptEntzug` > 0, das sind Slots in SZ2 mit Erlaubnis „entzogen“ und `liefSchon` (heute bei `sollOffen > 0`, `zoom-text.ts:118-122`, `:207`). Texte 9.5. Prüfung auf Wahrheit:
- „{n} Slots laufen“ heißt: Der NDI-Sender besteht. Das stimmt auch mit Ersatzbild; darum nennt Z9b die Zahl mit Ersatzbild.
- Z9b nennt die Ursachen nicht einzeln, sondern verweist auf die Kacheln (T86; die erste Fassung zählte Ursachen auf und vergaß T13, T17, T18, T20b, T20c; Nachbesserung B65).
- Z8 mit e > 0 behauptet keinen Grund, sondern verweist auf die Kacheln, die ihn je Slot nennen.
- Z7 „Slots gestoppt“ steht nur, wenn ein Slot in diesem Meeting lief und durch den Entzug nicht mehr läuft.

### 10.4 STATE je Zustand

`zoom_status`, `zoom_privilege` und `zoom_alarm` folgen der Tabelle ST4 7.5 unverändert, mit n = laufende Slots und o = offene Slots. Beispiel, warum `liefSchon` zählt: Beim ersten Beitritt steht Connect in Z6, alle eingeschalteten Slots warten auf die Erlaubnis (SZ2); das ist kein Eingriff, `zoom_alarm` = 0 wie in 0.3.0. Nach einem Wiederbeitritt in Z6 warten dieselben Slots, liefen aber schon; `zoom_alarm` = 1 wie in 0.3.0 mit offener Soll-Liste (ST4 7.5, Ergänzung 0.16).

Je Slot gelten die Regeln aus 8.2 mit diesen **Wahrheitsprädikaten** (geprüft in 10.5; Nachbesserung B77):
- `zoom_slot{n}_live` = 1 ⇒ SZ4 oder SZ5 **und** Z ∈ {Z6, Z7, Z7b, Z8, Z9, Z9b}. Außerhalb dieser Menge ist es 0, auch mit einem Sender der aktiven Bridge (Z4, Z5, Z10, Z11, Z12; 10.2 Regel 2), dann in SZ4–SZ6 `_state` = `wartet` (SZ9 bleibt `stoppt`) und `_target` leer: Ob Bild kommt, ist dort ungewiss, wie T11d und T11h sagen, und in Z10 und Z11 sind zudem die Kennungen ungültig (6.15 letzte Zeile).
- `zoom_slot{n}_target` ≠ leer ⇒ `zoom_slot{n}_live` = 1, und der Name ist der der Person, deren Kennung das Ziel der Bridge ist (bei Freigabe: `shareUser`).
- `zoom_slot{n}_alarm` = 1 ⇔ der Slot zählt in o (10.1). In Z1a, Z1b und Z2 zählt kein Slot in o, so dass jedes `_alarm` = 0 ist wie `zoom_alarm` dort (ST4 7.5, `zoom-text.ts:280-285`): Jeder Weg dorthin leert `liefSchon`, `zeigteSchon` und die Fehlerstände, auch ein Mangel der Einrichtung (7.3 Nr. 2, Nr. 7; Restrunde RR1).
- `zoom_slot{n}_audio` = 1 ⇔ Ton eingeschaltet, Computerton eingerechnet (8.2).
- `zoom_slot{n}_state` folgt der Zuordnung in 8.2; `zeigt`, `gehalten` und `ersatz` nur in Z6–Z9b, derselben Menge wie bei `_live` (Restrunde RR5); `zurueckgestellt` nur in SZ10, `fehler` nur in SZ7/SZ8.

### 10.5 Prüfregel

`apps/connect/test/zoom-text.test.ts` prüft tabellengetrieben; die Dimensionen erzeugt ein Generator, „soweit 10.1 und 7.3 sie zulassen“ heißt: Kombinationen, die die Vorrangfolge aus 7.3 nie hervorbringt, fallen weg, alle übrigen werden geprüft.
- **Kachel, Zustandszeile:** Z (18) × Erlaubnis (`offen`, `ja`, `entzogen`, `abgelehnt`, `abgelaufen`) × SZ (12) × Modus (3) × `SlotReason` (20) × `sent` (6) × Ersatzbild-Einstellung (4) × `doppelt` ∈ {1, 2} × `zweifel` × im Warteraum × `liefSchon` × `zeigteSchon` × anderer Slot mit demselben Ziel ∈ {nein, ja} gegen 10.2 wörtlich, dazu die Wahrheitsprädikate aus 10.2 als eigene Prüfungen (etwa: enthält „Zeigt“ ⇒ SZ4; enthält „Ersatzbild“ ⇒ SZ6; enthält „Kamera aus“ ⇒ Grund `cameraOff`/`speakerNoVideo`; enthält „Gestoppt“ ⇒ `liefSchon`; enthält „gehalten“ ⇒ SZ5; enthält „Aufnahme-Erlaubnis“ ⇒ `im_meeting` und Erlaubnis ≠ `ja` oder Z7/Z7b).
- **Tonzeile:** SZ × Modus × Ziel ∈ {0, ≠ 0} (bei Ziel 0 mit dem Ziel-0-Grund des Modus, 6.10 Schritt 3; für die Regeln 6 und 7; Fünfte Runde) × bei Teilnehmer mit Ziel 0 `doppelt` ∈ {1, 2} × `zweifel` × keine Person × im Warteraum (für Regel 6; Sechste Runde RN12) × `tonAn` × `tonArt` × `computerton` × `slotAudio.state` (4) × `SlotAudioReason` (12) × `source` (5) × `configured` (5) × Ton-Abo-Fehler ∈ {nein, ja} gegen 10.6, mit Prädikaten (enthält „· läuft (“ ⇒ state `live`; enthält „es läuft nur der Computerton“ ⇒ `source` enthält `share`; enthält „Person-Ton gibt es nur“ (T75, T75b) ⇒ `tonAn`; enthält „nicht im Meeting“ (T58e) ⇒ Person gewählt, `doppelt` ≤ 1, kein `zweifel`; enthält „wartet auf eine Bildschirmfreigabe“ ⇒ Modus Freigabe und Ziel 0; enthält „Computerton“ in der Quelle von T58c ⇒ `source` enthält `share`; „Ton: aus“ ⇒ nichts eingestellt; in SZ9 keine Zeile außer „Ton: aus“; enthält „Ton nicht verfügbar“ ⇒ Ton-Abo-Fehler gesetzt oder eigener Ton-Zustand `off/audioUnavailable`). Dazu die Rücksetzregel aus 7.1 als Folge von Ereignissen (Fehler, dann `waiting/command` bzw. `live` eines anderen Slots, neue Bridge, Meeting-Ende, Entzug) und `audioQueueOverflow`/`audioBufferMismatch`, die keine Tonzeile ändern (Nachfix W6).
- **Messzeile:** SZ × Modus × Stufe (3) × geliefert ∈ {keins, 1280×720, 1920×1080, 960×720, 720×1280, 1920×1200, 640×360} × Bild im Fenster ∈ {ja, nein} × früher ein Bild dieses Ziels ∈ {ja, nein} gegen 10.7.
- **Vorschau:** SZ × `sent` × Schalter × `vorschauVerfuegbar` × frisch ∈ {ja, nein} × letzte Vorschau dieses Ziels ∈ {ja, nein} gegen die Tabelle in 7.7 (`slot-vorschau.ts`). SZ4 kommt nur mit `sent = none` und, im Modus Freigabe, mit `sent = held` vor (6.9, 6.12; Nachfix W1); beides prüft der Generator, auch auf der Zustandszeile (T28/T28b mit `held`).
- **Fehlerzeile, Teilnehmerliste, Kopf:** gegen 10.9, 10.10, 10.11.
- **Kopfzeile, Tray, Karte:** jede Z-Zeile mit n ∈ {0, 1, 2}, k ∈ {0, 1}, o ∈ {0, 1}, e ∈ {0, 1, 6}, `slotsGestopptEntzug` ∈ {0, 1}, soweit zulässig.
- **STATE:** dieselben Kombinationen, je Slot die sieben Schlüssel gegen 8.2 und die Prädikate aus 10.4, ausdrücklich auch jedes Z außerhalb von Z6–Z9b mit Sender (SZ4–SZ6): `_live` = 0, `_state` = `wartet`, `_target` leer (Restrunde RR5); `liefSchon`, `zeigteSchon` und Fehlerstände erzeugt der Generator in Z1a, Z1b und Z2 nicht (7.3 Nr. 2, Nr. 7), die Folge dorthin prüft PK11; „genau 119 zoom_*-Schlüssel = Variablen der Rolle connect“ (heute „genau sieben“, `apps/connect/test/control-state.test.ts:96-97`); die sieben bisherigen Namen bleiben dabei wörtlich als Teilmenge geprüft (heute `zoom-kern.test.ts:2942-2943`).
- Ein neuer Wert in `SlotReason`, `SlotAudioReason`, `ZoomSlotZustand` oder `SlotFehler` ohne Text scheitert schon im Typcheck (`Record<…, string>` bzw. `Record<SlotFehler, string | 'keine'>`, Muster `zoom-text.ts:482-512`), dazu Zähltests „SlotReason hat 20 Werte“, „SlotAudioReason hat 12 Werte“, „ZoomSlotZustand hat 12 Werte“ (Muster `zoom-text.test.ts:897`, `:912`).

### 10.6 Tonzeile der Kachel (`tonText`)

Erste passende Regel gewinnt (Texte 9.3; „eingestellt“ nach der Ton-Abbildung 7.1, `{Quelle}` bei „eingestellt“ aus `configured`, bei „läuft“ aus `source`):

1. Nichts eingestellt (`tonAn` aus und nicht [Modus Freigabe und `computerton`]) → T58a.
2. Kein Sender (SZ0–SZ3, SZ7, SZ8, SZ10, SZ11) → T58h. Sender im Abbau (SZ9, „Wird gestoppt …“, T24) mit eingestelltem Ton → **keine** Tonzeile (`tonText = null`; ohne eingestellten Ton gilt schon Regel 1, „Ton: aus“ ist auch dort wahr; Fünfte Runde N5): Der Ton endet mit dem Sender, „läuft“ wäre gleich überholt und T58h „sobald der Slot läuft“ passt nicht zu einem Slot, der gestoppt wird (Restrunde RR6: SZ9 fiel bisher durch die Regeln 3–11, etwa auf T58c bis zum `slotAudio off`, danach auf Regel 11).
3. Ton-Abo-Fehler gesetzt (nur die drei Schlüssel aus 7.1, mit dessen Rücksetzregel) oder eigener Ton-Zustand `off/audioUnavailable` → T104. `audioQueueOverflow` und `audioBufferMismatch` ändern die Tonzeile nie (Hinweise Q6, T106; Nachfix W6).
4. Ton an, Tonart Person und Modus nicht Teilnehmer (also `audio = person` nach 7.1, `personNotInMode`; bei ausgeschaltetem Ton zählt die gespeicherte Tonart nicht, Sechste Runde RN4): Computerton eingestellt, Modus Freigabe und `source` enthält `share` (der Computerton geht gemessen hinaus) → T75b; sonst T75 (Fünfte Runde: ohne gezeigte Freigabe oder vor dem ersten Paket behauptete T75b sonst „es läuft nur der Computerton“).
5. `rateMismatch` → T76.
6. Teilnehmer, Person-Ton, Ziel 0 (`participantLeft`, `noTarget`): in derselben Folge wie die Zustandszeile (10.2 Regel 6) `doppelt` > 1, `zweifel` oder keine Person → T58i; sonst (Person nicht im Meeting oder im Warteraum, T16, T17) → T58e (Sechste Runde RN12: bisher stand T58e „die Person ist nicht im Meeting“ auch neben T13 „ist {d}-mal im Meeting“).
7. Freigabe, nur Computerton eingestellt (`tonAn` aus), keine gezeigte Freigabe (Ziel 0, Grund `shareNone` oder `noTarget`; die Bridge meldet dazu `off/noShare`, 6.13) → T58f. Die Regel hängt wie Regel 6 am Ziel, nicht an der Folge der Ton-Ereignisse (beim Einschalten kommt zuerst `waiting/command`, 6.13; Fünfte Runde, `noShare`).
8. `waiting` → T58b.
9. `live` → T58c; ist Computerton eingestellt und `source` ohne `share`, hängt T58g an.
10. `silent` → T58d.
11. sonst (`off` mit `command`, `modeChanged`, `meetingEnded`, `privilegeRevoked` während eines Wechsels) → T58h.

Prädikate: „· läuft (“ (T58c) nur mit `live` (T58h „sobald der Slot läuft“ und T75b enthalten „läuft“ in anderem Sinn; Fünfte Runde); T75 und T75b nur mit `tonAn`; „nicht im Meeting“ (T58e) nur mit gewählter Person, `doppelt` ≤ 1 und ohne `zweifel` (Sechste Runde RN4, RN12); „es läuft nur der Computerton“ (T75b) nur, wenn `source` `share` enthält; „wartet auf eine Bildschirmfreigabe“ (T58f) nur im Modus Freigabe mit Ziel 0; „Ton: aus“ nur, wenn nichts eingestellt ist (nie bei eingeschaltetem Ton, etwa in SZ1 oder SZ2); in SZ9 keine Tonzeile außer „Ton: aus“ (N5); „Computerton“ in der Quelle von T58c nur, wenn er gemessen hinausgeht.

### 10.7 Messzeile der Kachel (`messText`)

- `null` in SZ0, SZ1, SZ2, SZ3, SZ7, SZ8, SZ10, SZ11 (kein Sender) und in SZ9 (Sender im Abbau; Restrunde RR6: Der Kern löscht `geliefert` und `zuletzt` mit dem Stopp, ohne diese Regel stünde dort T51b „noch kein Bild“). `geliefert` und `zuletzt` löscht der Kern bei Stopp, Abbau, Meeting-Ende und bei jedem `slot`-Ereignis mit geändertem `target`, `share` oder `mode` (Nachbesserung B55); die Bridge meldet je Ziel neu (6.3).
- SZ4, SZ5, SZ6 mit Bild im laufenden Fenster: Freigabe-Slot → immer T50 (eine Freigabe hat ihre eigene Größe, MS1). Teilnehmer- und Sprecher-Slot: Ist die **kürzere Seite** des gelieferten Bildes kleiner als die Nennhöhe der Stufe (360, 720, 1080), T51; sonst T50 (Nachbesserung B47). Beispiele: 1280×720 bei 1080p → T51; 960×720 bei 720p → T50; 720×1280 (hochkant) bei 720p → T50; 1920×1200 bei 1080p → T50.
- Kein Bild im laufenden Fenster, aber früher eines dieses Ziels → T51c. Noch nie ein Bild dieses Ziels → T51b. „0 Bilder/s“ steht also nie im Präsens neben einer alten Größe.

### 10.8 Vorschau

Regeln in 7.7, Tabelle wörtlich; geprüft über `slot-vorschau.ts` in 10.5. Prädikate: ein Schachbrett, Schwarz oder Weiß nur in SZ6 mit passendem `sent` (Schachbrett nur mit `sent = transparent`); „gehalten“ nur in SZ5; „eingefroren“ nur mit `sent = freeze`; fehlt in SZ5 oder bei `sent = freeze` die letzte Vorschau dieses Ziels, eine leere Fläche mit dem Kennzeichen, nie ein Ersatzbild (Restrunde RR4); in SZ4 nie ein Ersatzbild; in SZ4 mit `sent = held` die letzte Vorschau dieses Ziels ohne Kennzeichen, nie T55b mit der Begründung „Zoom liefert Bilder“ (Nachfix W1).

### 10.9 Fehlerzeile der Kachel (`fehler`)

- Gesetzt mit dem Klartext (9.6) des letzten Fehlers mit `where:"slot"` und dieser Slot-Nummer, gelöscht bei „Stopp“/„Start“, bei jeder neuen Bridge und sobald der Slot danach `live` meldet.
- In SZ8 steht der Klartext schon in T23; dann ist `fehler` = `null` (nie doppelt).
- Ton-Abo-Fehler (T104) und `previewUnavailable` (T57) stehen an jeder betroffenen Kachel (7.1), nicht in `fehler`; T104 fällt nach der Rücksetzregel in 7.1 (Nachfix W6).
- `slotAlreadyOn`, `slotNotOn`, `slotReconnecting`: keine Zeile (7.1).

### 10.10 Teilnehmerliste

Je Zeile einer anwesenden Person (Nachbesserung B3, B29, B67):
- `slotNrn` = alle laufenden Slots (SZ4–SZ6, jeder Modus), deren Ziel in der Bridge die Kennung dieser Person ist bzw. deren gezeigte Freigabe sie teilt → T39 mit allen Nummern.
- Sonst Teilnehmer-Slots, die diesen Namen suchen (`person`, `personJetzt`, 7.3 Nr. 5): mit `doppelt` > 1 oder `zweifel` → T39d; eingeschaltet, zeigt sie nicht → T39c; ausgeschaltet → T39b.
- Sonst T38; bei einer Person im Warteraum mit Tooltip T98.
- Das Kamera-Kennzeichen folgt dem Teilnehmer der Sitzung, den der Reducer bei `videoStatus` nachführt (7.10).

### 10.11 Slot-Kopf und Hinweis R5

- T31: a = angelegte Slots (dauerhaft und vorübergehend), e = eingeschaltete (auch mit `anNurMeeting`), n nach 10.1.
- T96 steht nur an vorübergehenden Slots, T96b nur an dauerhaften mit `anNurMeeting` (7.2); beide fallen mit „Behalten“, T96b auch, sobald die Start-Taste von Hand oder per `zoom_slot` gesetzt wird (Restrunde RR7).
- T87 (Nachbesserung B63): Erscheint nach einem Wiederbeitritt (Z11 → `im_meeting`), sobald nach dem ersten Abgleich mit Erlaubnis jeder dabei gestartete Slot geantwortet hat oder seine Frist abgelaufen ist. {gestartet} = Slots in SZ4–SZ6; {zweifel} = Teilnehmer-Slots mit `doppelt` > 1 oder `zweifel`; {nicht} = SZ7 und SZ8; {grenze} = SZ10. Zusätze mit dem Wert 0 entfallen.

---

## 11 · Tests

Kein Test lädt Electron, keiner braucht ein Meeting (Regel ST4 12.6). Jeder neue Test hat eine **Gegenprobe**: ein absichtlich eingebauter Fehler, der ihn rot macht; das Ergebnis gehört in den Aufgabenbericht (ST4 12.5). 11.8 ist eine **Pflichtauswahl**, keine vollständige Liste: Für jeden übrigen neuen Fall nennt der Plan je Aufgabe den absichtlichen Fehler (Nachbesserung B75). Bestehende Fälle, deren Schnittstelle entfällt, ziehen nach 11.10 um oder entfallen mit Begründung (Nachbesserung B19, B74).

### 11.1 Entscheidungslogik in C++ (`native/slot_logic_test.cpp`, `native/audio_mix_test.cpp`, `native/delay_line_test.cpp`)

Aufbau wie `delay_line_test.cpp:15-29`, `:247-264` (Makro `CHECK`, eingespeiste Zeit `at(ms)`, Rückgabe 0/1). Lauf in der CI über `npm run logik-test -w @jm/zoom-bridge` (`packages/zoom-bridge/scripts/logik-test.mjs`: `g++ -std=c++17 -Wall -Werror`, sonst `clang++`, unter Windows `cl /std:c++17`, je Testdatei ein Programm, ohne SDK-Header; E27). Unter Windows sucht das Skript `cl` über `vswhere.exe` und die Umgebung aus `vcvars64.bat`, weil `cl` sonst nur in der Developer-Shell im `PATH` liegt (am Entwicklungsrechner gemessen: weder `g++` noch `cl` noch `clang++` im `PATH`, Visual Studio 2022 installiert; Nachbesserung B86). Findet es keinen Compiler, endet es mit einer Zeile, die das sagt, und Rückgabewert 2 (nie still grün). Lokal zusätzlich `npm run slot-test` über CMake.

| # | Fall | Erwartung |
| --- | --- | --- |
| PB1 | Sprecher, Kandidat B neben gezeigtem A, Haltezeit 1000 ms | bei 999 ms kein Wechsel, bei 1000 ms Wechsel auf B |
| PB2 | A gezeigt, Kandidaten B (0 ms), C (400 ms), B (800 ms) | kein Wechsel vor 1800 ms; jeder neue Kandidat startet die Zeit neu |
| PB3 | kein Ziel, erstes Signal | sofortiger Wechsel, ohne Haltezeit |
| PB4 | eigene Kennung, Kennung 0, je für alle drei Signale | nie Kandidat, auch nicht als Vorbelegung |
| PB5 | `activeAudio` mit `[eigene, 7, 9]`; danach `[]` | Kandidat 7; leere Liste ändert nichts |
| PB6 | Kandidat ohne Kamera, `showNoVideo` aus bzw. an | übersprungen bzw. Ziel |
| PB7 | Signal `activeVideo` gewählt, nur `speakerVideo` kommt | kein Wechsel |
| PB8 | gezeigter Sprecher geht | Ziel 0, Grund `speakerNone`; nächster Kandidat sofort; Erinnerung ohne seine Kennung |
| PB9 | Haltezeit 0 und 5000 | sofort bzw. nach 5000 ms |
| PB10 | Freigabe: Begin A, Begin B, End B, End A | gezeigt A, B, A, keine |
| PB11 | Pause und Resume der gezeigten; Pause mit Kennung 0 | gezeigte bleibt, `pauses` zählt; Kennung 0 trifft alle Einträge der Person |
| PB12 | reine Ton-Freigabe nach einer Bild-Freigabe | nie gezeigt |
| PB13 | Person mit Freigabe geht | ihre Einträge weg, die nächstjüngere wird gezeigt |
| PB14 | `Sharing_Self_*`, `Sharing_View_Other_Sharing` | keine Änderung |
| PB15 | Befüllen bei `INMEETING` und beim ersten Einschalten (geändert, B38) | `INMEETING`: leert und befüllt; Einschalten: ergänzt nur, bekannte Einträge behalten ihr `seq`; befüllte bekommen `seq` unter allen per Rückruf bekannten, untereinander in Listenreihenfolge; `empty`/`unavailable` löscht nichts |
| PB16 | Ersatzbild-Entscheidung, alle Zeilen der Tabelle 6.12 | genau die Art, der Takt und `sent` der Tabelle; vor dem ersten Bild sofort; `freeze` ohne Kopie dieses Ziels → transparent |
| PB17 | Mischer: gleiche Länge; Summe über 32767; Raten 32 000 und 48 000 | Summe; begrenzt auf 32767; nur Computerton und Merker |
| PB18 | Versatz-Warteschlange mit den Bildarten weiß und transparent, `clear()` beim Moduswechsel | Reihenfolge und Art bleiben, `clear()` leert; bestehende 14 Fälle bleiben grün |
| PB19 | neues Ziel beim Moduswechsel (6.10) und Ziel-0-Grund (6.10 Schritt 3; Nachfix W7) | Teilnehmer: `id` des Befehls; Sprecher: Kandidat aus der Erinnerung oder 0; Freigabe: gezeigte oder 0. Bei Ziel 0 nach `modeChanged`, `targetChanged`, `resolutionChanged` und nach `slotOn` der Grund nach Modus (`noTarget`, `speakerNone`, `shareNone`); `participantLeft` bleibt; nie `modeChanged`/`targetChanged`/`resolutionChanged` mit Ziel 0 |
| PB20 | Abbau-Plan je Zeile von 6.15, je ohne und mit Renderer-Sperre (B4, B76; Nachfix W2, W3) | Schrittfolge wörtlich; `meetingEnded` ohne `Unsubscribe`/`DestroyRenderer`, mit `HaltelisteVerwerfen`; quit/EOF: `VorschauThreadEnde` vor `SlotLoeschen`; Entzug: Erinnerung **und** Freigaben bleiben (kein `FreigabenLeeren`); Weggang und Freigabe-Ende: Sender bleibt; „Meeting endet sich“: keine Renderer-Schritte. Mit Sperre: `slotOff`, `leave`, quit/EOF und Entzug melden Ton und Slot, melden den Vorschau-Platz ab und schließen den Sender wie ohne Sperre, dann `InHalteliste` statt `Unsubscribe`, `DestroyRenderer`, `ZeigerVerwerfen` und `SlotLoeschen`; `INMEETING`: `HaltelisteAbbauen` (je Eintrag `Unsubscribe` + `DestroyRenderer`, bei `rendererTot` nur löschen) nach dem Lösen der Sperre und vor jedem Umhängen; `leave` in zwei Plänen (Fünfte Runde N8): der Plan `leave` endet mit `SessionLeave` und enthält kein `HaltelisteVerwerfen`; der Nachlauf-Plan mit `verlassen` = `true` besteht aus `HaltelisteVerwerfen` ohne Renderer-Schritte, mit `false` aus keinem Schritt; quit/EOF: Halteliste bleibt; ein `INMEETING` eines späteren Meetings fasst ältere Einträge nicht an |
| PB21 | Umhäng-Plan (6.10) je Rückgabe: 0, 18 (dreimal, dann „anderer Fehler“), 29 (nur SHARE), 30, anderer Fehler mit und ohne Typwechsel, `rendererTot`, Sperre (B30, B32, B34) | Schritte der Tabelle; `rendererNew` nur bei Typwechsel; bei 29 kein neuer Renderer und Wiederholung, solange die Freigabe gezeigt wird; `rendererTot` → kein `unSubscribe`/`destroyRenderer`, neuer Delegate; Sperre → nur vorgemerkt; `TonStandNeu` bzw. `MischerEingangBNeu` nur, wo der Ton am Ziel hängt, beim Moduswechsel `TonStandNeu` und `TonMelden` nur mit geändertem Tonweg, dazu `MischerNeu` beim Wechsel in den Mischer (Restnachfix N1; Einzelheiten PB22) |
| PB22 | Ziel-Stand und Ton-Stand (6.1, 6.10 Schritt 8, 6.13; B9; Restrunde RR8, RR10; Restnachfix N1) | jedes Feld von `ZielStand` gesetzt, Umhängen → `abo.ziel` gleich `ZielStand{}`; `TonStand`: bei Person-Ton nach Weggang und Rückkehr gleich `TonStand{}` (Plan-Schritt `TonStandNeu`), beim Freigabewechsel eines Slots nur mit Computerton ebenso, bei einem Mischer-Slot nur `MischerEingangBNeu`; bei reinem Mischton vor und nach dem Wechsel (Tonweg `mix` → `mix`: Sprecherwechsel, Moduswechsel Teilnehmer ↔ Sprecher, Moduswechsel von und zur Freigabe ohne Computerton) bleibt er Feld für Feld gleich, ohne `TonMelden`; Sprecher → Freigabe → Sprecher und Teilnehmer → Freigabe → Teilnehmer mit Mischton + Computerton (Vorgabe neuer Slots): auf Freigabe `TonStandNeu`, `MischerNeu` und `TonMelden` mit `configured` = `mixShare`, `waiting/modeChanged`; zurück `TonStandNeu` und `TonMelden` mit `mix`, `waiting/modeChanged`, danach `lastAudioMs` = 0, `silenceBisMs` = 0 und `audioRate` = 0 (kein Stille-Block vor dem ersten Mischton-Paket, PB30; Fünfte Runde N2); nur Computerton (Ton aus): Sprecher → Freigabe mit gezeigter Freigabe `TonStandNeu` und `TonMelden` mit `share`, `waiting/modeChanged`, ohne gezeigte Freigabe `off/noShare`; die gezeigte Freigabe endet → `TonMelden` `off/noShare`, eine neue beginnt → `TonStandNeu`, `waiting/targetChanged` (Fünfte Runde, `noShare`); zurück mit `none`, `off/modeChanged`; Person-Ton mit Computerton: Teilnehmer → Freigabe `TonStandNeu` und `TonMelden` mit `share`, `off/personNotInMode` (6.13, T75b); im Modus Freigabe endet danach die gezeigte Freigabe bzw. beginnt eine neue → `TonStandNeu` ohne `TonMelden`, der Zustand bleibt `off/personNotInMode` (Sechste Runde RN5); ein Slot auf `off/audioUnavailable` bleibt dort; jede Änderung von `audio` oder `shareAudio` → `TonStand{}`, wird der Tonweg dabei `mixShare`, auch `MischerNeu` |
| PB23 | Riegel (6.10, B10, B31) | Bild und `RawData_Off` während `umhaengen` oder ohne `subscribed` → verworfen, `lateFrames`; erstes angenommenes Bild setzt `bildSeitUmhaengen` |
| PB24 | Grund nach 200 ms ohne Bild (6.7, 6.12, B52) | VIDEO, Zoom meldet Kamera aus → `cameraOff`; Kamera an → `noFrames`; `RawData_Off` vor dem ersten Bild des Ziels → kein Grund; SHARE → nie `cameraOff`; `bufferMismatch` bleibt |
| PB25 | Ton-Zuordnung `tonZiele` und Tonweg `tonWeg` (6.10 Schritt 8, 6.13, B76; Restnachfix N1) | jede Zeile der Tabelle; Person-Ton nie an Ziel 0; `share` nur an `shareUser`; Mischer A/B richtig; `tonWeg` für jeden Modus und jede Zeile der Ton-Abbildung (7.1) gleich der Spalte „gesendet“: Mischton + Computerton im Modus Sprecher oder Teilnehmer `mix`, im Modus Freigabe `mixShare`; Person-Ton mit Computerton im Modus Freigabe `share`, im Modus Sprecher `none`; nur Computerton außerhalb von Freigabe `none` |
| PB26 | Sprecher-Erinnerung (6.8, B16) | Signal vor dem Einschalten → neue `SprecherWahl` vorbelegt, sofort Ziel; Moduswechsel, während derselbe spricht → derselbe; Entzug und Wiedererteilung → Vorbelegung bleibt; `INMEETING` → leer |
| PB27 | Typ-Nachtrag (6.9, B37) | Begin mit UNKNOWN, Nachtrag → Typ ohne neues `seq`; Nachtrag `SHARE_TYPE_COMPUTER_AUDIO` → `audioOnly`, nie gezeigt; Kennung 0 nachgezogen |
| PB28 | Mischer-Uhr (6.13, B17) | über 10 s bei jeder Eingangsfolge (Lücken 30, 60, 100 ms, ein Eingang ganz still, beide still): gesendete Abtastwerte einschließlich Stille = Wanduhr ± 10 ms; Rückstand nie über 200 ms; `mixSilenceMs` und `mixDrops` gezählt |
| PB29 | Halten nach Umhängen (6.9, 6.12, B46, B53, B66; Nachfix W1) | Kopie eines anderen Ziels nie gesendet; `held` nur mit Kopie dieses Ziels; Senden ab 200 ms, Zustand erst nach 2 s: zwischen 200 ms und 2 s `live` mit `sent = held`, je ein `slot`-Ereignis bei Beginn und Ende des Haltens, kein Zustandswechsel; vor dem ersten Bild bleibt `starting` (auch bei `noShareData`), außer die gezeigte Freigabe ist pausiert: dann nach 2 s `fallback/sharePaused` |
| PB30 | Stille-Herzschlag `stilleBloecke` (6.13; Restnachfix N1; Fünfte Runde N2, `noShare`; Sechste Runde RN6, RN7) | ohne bekanntes Format (`audioRate` = 0) kein Block; Tonweg `none` und `mixShare` nie; Person-Ton und Computerton (`person`, `share`) mit Ziel 0 nie, mit Ziel ≠ 0 ab 40 ms ohne Paket; Mischton (`mix`) mit Ziel 0 und mit Ziel ≠ 0 ab 40 ms ohne Paket; Beginn bei `max(silenceBisMs, lastAudioMs)`, höchstens 200 ms je Aufruf, der Rest verfällt: nach 1 s ohne Paket liefert der erste Aufruf 200 ms und `silenceBisMs` = jetzt − 200 ms + gesendete Zeit, ein zweiter Aufruf 10 ms später nur rund 10 ms; nach `TonStand{}` erst wieder nach dem ersten Paket |

### 11.2 Bridge-Paket in TypeScript (`npm run selftest -w @jm/zoom-bridge`, `test/selftest.ts`)

| # | Fall | Erwartung |
| --- | --- | --- |
| PT1 | Reducer: `slot`, `slotAudio`, `videoStatus` | Einträge nach Slot-Nummer, jedes Feld aus 6.3 übernommen; `off` löscht; unbekannter Grund wird nicht erfunden; `videoStatus` führt `videoOn` des Teilnehmers nach |
| PT2 | `error where:'slot'` | `phase` bleibt; Gegenprobe `where:'auth'` kippt weiter (heute `:703-744`) |
| PT3 | neue `OWN_ERROR_NAMES` | paarweise verschieden, von `enrich` aufgelöst (Tabellenprüfung `:1300-1332`) |
| PT4 | Exporte | neue Typen über `src/index.ts` erreichbar (Muster `:2193-2202`) |
| PT5 | Attrappe gegen echte `Bridge` (`fahreSteuerung`, `:2237`) | `slotOn`, `slotSet`, `slotOff`, `speakerConfig`, `previewMode` werden beantwortet; `videoSubscribe` → `where:'cmd'` |
| PT6 | Quelltext-Wächter (heute `:2709-2768`; B4, B27, B33, B76, B88) | (a) **alle** Rückruf-Rümpfe (`native/callbacks.cpp`, Delegate in `native/video.cpp`, Ton-Delegate in `native/audio.cpp`) rufen weder `subscribe`, `unSubscribe`, `setRawDataResolution`, `createRenderer`, `destroyRenderer` noch eine `slot…`-Funktion; erlaubt nur `SetEvent`, `emitRoster()`, `checkPrivilege()` in `onMeetingStatusChanged`; (b) `slotsMeetingEnded` ruft den Ausführer `abbauAusfuehren` mit der Kette `meetingEnded`, `slotsPrivilegeRevoked` mit `privilegeRevoked`, beide ohne eigenen Aufruf einer Renderer-Funktion; im Ausführer rufen die Zweige `ZeigerVerwerfen` und `HaltelisteVerwerfen` weder `unSubscribe` noch `destroyRenderer` noch eine andere Renderer-Funktion (Nachfolger von `:2755-2758`, das ebenso das Argument des Aufrufs prüft; Restrunde RR3: Die frühere Prüfung „`slotsMeetingEnded` enthält kein `unSubscribe`“ war immer grün, weil die Kette nur den Plan ausführt); (c) Reihenfolge der Hauptschleife nach 6.6; (d) `emitLog` ohne Namens- **und NDI-Namens**-Bezeichner: Muster heute `/\b(name\|displayName\|userName\|nameOut)\b\|GetUserName/` (`:2713`; die senkrechten Striche sind für die Tabelle maskiert, im Code stehen sie ohne Backslash), erweitert um `ndi`, `ndiName`, `source`; (e) `"preview"` wird nur in `native/preview.cpp` ausgegeben, und `native/preview.cpp` liest `g_slots` nicht |
| PT7 | Attrappe, neue Stellschrauben (B89) | je Stellschraube aus 11.3 ein Fall, der ihre Wirkung an den Ereignissen prüft (heute fährt der Selbsttest 31 von 32 Schaltern); das Drehbuch `slots` läuft in einem eigenen benannten Fall von Anfang bis Ende |
| PT8 | Konsole (6.18, B83) | `+<Kennung>`, `-<Kennung>`, `=<Slot> <Kennung>`, `liste`, Hinweis „Rückkehr? …“ bei gleichem Namen, keine Rückkehr von selbst; Nachfolger der `steuerung`-Fälle (11.10) |
| PT9 | Riegel im Einsatzpaket-Bau (6.18) | `build-release.mjs` bricht ab, solange `paket/LIESMICH.txt` den Satz zum Umhängen enthält (Prüfung über eine Kopie in einem Prüfordner) |

### 11.3 Attrappe (`test/fake-bridge.mjs`, Drehbuch `steuerung`)

- Slot-Befehle mit derselben Prüfreihenfolge und denselben Fehlerschlüsseln wie 6.2; Ereignisse nach 6.3 (mit `sent`, `source`/`configured`, `target` im `preview`; `configured` nach dem Tonweg je Modus, mit `slotAudio` bei jedem Moduswechsel, der ihn ändert, 6.10 Schritt 8; Restnachfix N1; direkter Computerton ohne gezeigte Freigabe mit `off/noShare` wie 6.13, Fünfte Runde; Person-Ton mit Computerton im Modus Freigabe bleibt auch beim Freigabewechsel `off/personNotInMode`, 6.13, Sechste Runde RN5); `slotStats` alle 2 s mit `FAKE_AUFLOESUNG_GELIEFERT` (zum Beispiel `1280x720`) statt der gewünschten Größe; `preview` mit einem festen, winzigen JPEG.
- Zentraler Abbau `abbauen(grund)` (`fake-bridge.mjs:254-263`) über alle Slots, Ton vor Bild.
- Solange die Attrappe `reconnecting` gemeldet und noch kein `inMeeting` nachgeschickt hat (etwa mit `FAKE_VERBINDUNG_WEG_MS`, `fake-bridge.mjs:147`), beantwortet sie `slotOn` mit `slotReconnecting` wie die Bridge in der Renderer-Sperre (6.2; Nachfix W2).
- Weggang einer Person mit Slot: `left`, dann `slot fallback/participantLeft` (die Attrappe hängt wie die neue Bridge **nicht** selbst um).
- Neue Stellschrauben (Kopfdoku `:126-219`): `FAKE_SPRECHER_FOLGE` („ms:kennung,…“, mit `FAKE_SPRECHER_SIGNAL`), `FAKE_KAMERA_AUS_MS` („kennung:ms“, meldet `videoStatus` und `fallback/cameraOff`), `FAKE_KEIN_BILD_MS` („kennung:ms“, `fallback/noFrames` ohne `videoStatus`), `FAKE_FREIGABEN` („ms:person:freigabe:begin|end|pause|resume|ton|typ=<Typ>,…“), `FAKE_FREIGABE_BEFUELLT` (`ok`/`empty`/`unavailable`), `FAKE_AUFLOESUNG_GELIEFERT`, `FAKE_SLOT_FEHLER` („nr:schlüssel“), `FAKE_ABO_FEHLER` („nr:sdk“, `fallback/subscribeFailed` mit `slotSubscribeFailed`), `FAKE_SLOT_STUMM` („nr“: kein Ereignis auf `slotOn`). `FAKE_ABBAU_MS` (`fake-bridge.mjs:195-198`, `:315-317`) gilt auch für die Slots. Die Sprecher-Haltezeit bildet die Attrappe vereinfacht nach (sofort nach Ablauf); die echte Regel prüft 11.1.
- **Drehbuch „Slots“ (B.5):** `FAKE_SCRIPT=slots` ist das Drehbuch `steuerung` mit einer festen Folge dieser Stellschrauben: eine Person geht und kommt nach 500 ms wieder, schneller Sprecherwechsel, Kamera aus, zwei Freigaben gleichzeitig, Entzug und Wiedererteilung mit spätem Abbau; Moduswechsel kommen als Befehle aus dem Test. Es läuft als eigener Fall in PT7 und in PK36. Einzelne Fälle setzen die Stellschrauben weiter selbst (Muster `stell(nr)`, `apps/connect/test/zoom-kern.test.ts:167-197`).
- Rückkehr-Abstände in den Fällen liegen **über** der 300-ms-Entprellung des Abgleichs (`fristen.ts:10`), sonst entfällt der Zwischenabgleich, in dem der Fehler aus B11 läge (heute `FAKE_RUECKKEHR_MS` Vorgabe 0, `fake-bridge.mjs:183-184`).

### 11.4 Connect-Kern (`apps/connect/test/zoom-slots.test.ts`, neu, mit `tsx`)

Eigene Datei mit eigener Gesamtwache, weil `zoom-kern.test.ts` schon bei 138–145 s von 240 s steht (`zoom-kern.test.ts:72-79`); in `apps/connect/package.json:17` angehängt. **Zeitbudget** (Nachbesserung B90): Der CI-Job `selftests` hat 15 Minuten für alle Schritte (`.github/workflows/ci-checks.yml:36`). Der Plan misst die Laufzeit von `zoom-slots.test.ts` und von `zoom-kern.test.ts` nach dem Umzug (11.10) und setzt die Wache auf das Doppelte der gemessenen Zeit; überschreitet die Summe der Connect-Schritte 8 Minuten, wird der Job vor dem Merge geteilt (**Annahme**: passt, ungemessen). Fabrik und Einstellungs-Attrappe wie `zoom-kern.test.ts:144-310`; die Attrappe speichert die neuen Felder und kann Lesen und Schreiben scheitern lassen.

| # | Fall | Erwartung |
| --- | --- | --- |
| PK1 | Slots anlegen | Nummern 1, 2, 3; nach Löschen von 2 bekommt der nächste die 2; der 17. → T32; jede Änderung landet in der Attrappe |
| PK2 | Beitritt mit Teilnehmer-Slot „Anna“ und Sprecher-Slot, beide an | nach Erlaubnis je ein `slotOn` mit allen Feldern aus der Einstellung (Ton nach der Abbildung 7.1); n = 2; STATE `zoom_sources=2`, `zoom_live=1`, `zoom_slot1_on=1`, `zoom_slot1_target=Anna`, `zoom_slot2_mode=sprecher` |
| PK3 | erster Beitritt, Erlaubnis offen; dann Entzug und Wiedererteilung (`FAKE_ENTZUG_MS`, `FAKE_ERTEILUNG_MS`) | in Z6 `zoom_alarm=0`; nach dem Entzug T12b, Z7 mit T82, `zoom_alarm=1`; danach beide Slots wieder gestartet mit unveränderten Einstellungen |
| PK4 | Rückkehr (#262): `FAKE_WIEDERBEITRITT_MS`, `FAKE_RUECKKEHR_MS=500` | beim Weggang T16 und `zoom_alarm=1` (FR7); nach der Rückkehr genau ein `slotSet {slot:1, id:neu}`, **kein** `slotOff`/`slotOn`; danach T15 und Ton wieder `live` (frischer Ziel-Stand, bei Person-Ton auch frischer Ton-Stand, 6.10 Schritt 8) |
| PK5 | Rückkehr als „anna “ (`FAKE_RUECKKEHR_NAME`) | wie PK4 (normierter Name) |
| PK6 | Doppelname (`FAKE_DOPPELNAME=1`), Abstände über 300 ms (B11, B60) | Slot „Anna“ mit `id:0`, T13, `zoom_slot1_alarm=1`; `slotPersonWaehlen` → `slotSet {id}`; danach Kamera aus → T19, `zoom_slot1_alarm=0` (auch vor dem ersten Bild: T20, kein T13); geht die gewählte Person, während die zweite „Anna“ da ist → **kein** Umhängen auf die zweite, T13b; kommt sie wieder (neu beigetreten) → T13 mit Wahl; ohne Handwahl: A lief allein, B kommt dazu (A bleibt gezeigt), A geht → kein Sprung auf B, T13b; die einzige „Anna“ im Warteraum zählt mit (T17) |
| PK7 | Moduswechsel Teilnehmer → Sprecher → Freigabe am laufenden Slot; dazu dieselbe Folge ohne Ziel (Nachfix W7): leere Sprecher-Erinnerung, keine Freigabe, Wechsel zurück auf Teilnehmer mit einer Person, die nicht im Meeting ist | nur `slotSet {mode}`, nie `slotOff`/`slotOn`; mit Ziel Grund `modeChanged` und bis zum ersten Bild T20; ohne Ziel T26, T29c bzw. T16 wörtlich, nie T20; NDI-Name unverändert; gemerkte Vorschau verworfen; mit der Ton-Vorgabe (Mischton, Computerton an) je ein `slotAudio` mit neuem `configured` beim Wechsel auf und von Freigabe (`mixShare` bzw. `mix`), keins bei Teilnehmer → Sprecher, und die Tonzeile nennt nach dem Ereignis die Quelle des neuen `configured` (T58b), nie die des vorigen Modus (Restnachfix N1) |
| PK8 | Sprecher-Signale (`FAKE_SPRECHER_FOLGE`) | `speakerConfig` in der Startfolge mit den gespeicherten Werten und nach jeder Änderung; die letzten 20 Signale in den Messwerten; T25 mit dem Namen der zuletzt gezeigten Person |
| PK9 | Kamera aus (`FAKE_KAMERA_AUS_MS`) und Bildausfall (`FAKE_KEIN_BILD_MS`) | T19 bzw. T19b; das Kennzeichen „Kamera aus“ in der Teilnehmerliste folgt `videoStatus` auch ohne laufenden Slot |
| PK10 | zwei Freigaben (`FAKE_FREIGABEN` A, B, B endet) | T28b mit B, dann T28 mit A |
| PK11 | Meeting-Ende; dazu ein Mangel der Einrichtung im Wiederbeitritt (Restrunde RR1; Muster `zoom-kern.test.ts:2444-2465`, Mangel vor Versuch 2) | dauerhafte Slots bleiben gespeichert und eingeschaltet, vorübergehende sind gelöscht, Slots mit `anNurMeeting` ausgeschaltet; T11b; `liefSchon`, `zeigteSchon`, Fehlerstände gelöscht; `zoom_alarm=0`. Nach dem Mangel (Z1a) ebenso: vorübergehende Slots gelöscht, `liefSchon`, `zeigteSchon`, Fehlerstände gelöscht, jedes `zoom_slot{n}_alarm=0` |
| PK12 | Nachfrage ab dem 6. | sechster `slotStart` → `nachfrage` mit T40, nichts geändert; mit `trotz` → an, Zustimmung gespeichert; neuer Kern mit diesen Einstellungen → Beitritt startet alle 6; zurück auf 5 → Zustimmung weg |
| PK13 | Companion (B1, B57) | `zoom_slot 3 ON`/`OFF`/`TOGGLE` wirken; `zoom_slot 7 ON` ohne Slot 7 → F9; `zoom_slot 1 X` → F13; `zoom_slot_mode 2 freigabe`; `zoom_slot_mode 2 galerie` → F10; `zoom_slot_person 1 Anna Maria` → Person „Anna Maria“; ohne Namen → F11; `zoom_load Ben` legt einen **vorübergehenden** Slot „JM Connect – Zoom Ben“ an und schaltet ein, ein zweites `zoom_load Ben` nimmt denselben; `zoom_unload Ben` schaltet aus und löscht ihn; 17 verschiedene Namen nacheinander per `zoom_load`/`zoom_unload` in einem Meeting → nie F14; 16 belegte Slots → F14; nach Meeting-Ende und neuem Beitritt startet kein früherer `zoom_load`-Slot; ein ausgeschalteter dauerhafter Slot „Ben“ wird von `zoom_load Ben` nur für dieses Meeting eingeschaltet (T96b, in der Einstellungs-Attrappe weiter `an: false`), von `zoom_unload Ben` nur ausgeschaltet, ohne `zoom_unload` mit dem Meeting-Ende ausgeschaltet und beim nächsten Beitritt nicht gestartet; „Behalten“ bzw. „Stopp“/„Start“ an der Kachel oder `zoom_slot 1 ON` heben `anNurMeeting` auf und speichern die Start-Taste (Restrunde RR7); der 6. per Companion → F8, an, `zoom_cmd_rejected=0`; `zoom_slot_audio 3 OFF` an einem Freigabe-Slot mit Computerton → `slotSet {audio:'off', shareAudio:false}`, `zoom_slot3_audio=0`; `ON` stellt beide wieder her |
| PK14 | Ton am laufenden Slot (B2); Computerton ohne Freigabe (Fünfte Runde, `noShare`) | `slotSet {audio}`, keine Ablehnung; Tonart Person im Modus Sprecher → Connect sendet `audio:'person'`, Bridge `off/personNotInMode` → T75; im Modus Freigabe mit Computerton → T75b erst, wenn der Computerton gemessen hinausgeht (`source` mit `share`), ohne gezeigte Freigabe T75; F12 bei `zoom_slot_audio` in dieser Lage. Freigabe-Slot nur mit Computerton (Ton aus): niemand teilt → `off/noShare`, T58f; Freigabe beginnt (`FAKE_FREIGABEN`) → T58b, nach den ersten Paketen T58c; endet → T58f; dasselbe mit gespeicherter Tonart Person (Ton aus) → ebenso, nie T75 (Sechste Runde RN4). Ton an, Tonart Person, Computerton, Modus Freigabe: Freigabe endet und beginnt → die Bridge bleibt auf `off/personNotInMode`, die Tonzeile wechselt nur zwischen T75 und T75b (Sechste Runde RN5) |
| PK15 | Auflösung | Slot 1080p, Attrappe liefert 1280×720 → T51; 720p und 1280×720 → T50; 720p und 960×720 → T50; 720p und 720×1280 → T50; 1080p und 1920×1200 → T50; Freigabe-Slot mit 1280×720 bei 1080p → T50; nach Kamera aus → T51c, nie „0 Bilder/s“ |
| PK16 | Vorschau (B15) | `preview` → Push an das Fenster, nicht im Abbild, nicht im Log; Startfolge jeder neuen Bridge enthält `previewMode {on: Schalter und Fenster sichtbar}`; Startwert `fensterSichtbar` aus der Hülle; `fensterSichtbar(false)` → `previewMode {on:false}`; Schalter aus → ebenso; Wert gespeichert; ein Vorschaubild mit fremdem `ziel` wird verworfen |
| PK17 | Messwerte | `slotStats` im Abbild; `messwerteText()` enthält keinen Teilnehmernamen und keinen NDI-Namen (Prüfung gegen die Namen der Attrappe und der Slots); Logzeilen ohne Namen (Muster `keinTeilnehmernameImLog`, aus `zoom-kern.test.ts:2844-2913` übernommen, 7.8) |
| PK18 | Aufbaufehler (`FAKE_SLOT_FEHLER=2:slotRendererFailed`) | Slot 2 T23 mit T101, `zoom_slot2_alarm=1`, die anderen laufen; ein späteres `roster` startet Slot 2 **nicht** neu; „Stopp“/„Start“ versucht es; eine neue Bridge löscht den Fehlerstand (B13) |
| PK19 | keine Antwort (`FAKE_SLOT_STUMM=3`, Frist eingespeist) | T21; ein `roster` nach Ablauf der Frist sendet **kein** `slotOn` (B13) |
| PK20 | Wiederbeitritt mit neuer Bridge (Z11) | alle eingeschalteten Slots (auch vorübergehende) neu gestartet; T87 erst nach den Antworten, mit den Zahlen aus 10.11; `zoom_alarm=1` bis zur Erlaubnis |
| PK21 | Zoom verbindet selbst neu (Z10), neue Kennungen per `roster` | Slots bleiben, `slotSet {id}` mit der neuen Kennung; in Z10 `zoom_slot1_live=0`, `_state=wartet`, `_target` leer |
| PK22 | Ereignisse der alten Generation | ändern keine Slot-Lage außer dem Abbau (ST4 6.9) |
| PK23 | Übergang | leere Einstellungen → T30; „Als Slot laden“ für Anna → dauerhafter Slot 1 „JM Connect – Zoom Anna“, an; besteht dieser Name schon an einem anderen Slot → „… (2)“ |
| PK24 | NDI-Namen | T43, T44, T45, T47 je ein Fall; Gast mit gleichem Namen → T46 als Warnung, Speichern gelingt; 60 Zeichen in Code-Punkten (ein Emoji zählt als 1) |
| PK25 | Umbenennung der gezeigten Person (B8) | Kachel nennt den neuen Namen; gespeicherte Person unverändert; Rückkehr unter neuem und altem Namen; nach Meeting-Ende gilt der gespeicherte Name |
| PK26 | Löschen | an → T36; aus → gelöscht, Nummer frei |
| PK27 | macOS (Plattform-Attrappe `darwin`) | keine `zoom_*`-Schlüssel; kein Slot-Aufruf an eine Bridge |
| PK28 | Erlaubnis flattert (`FAKE_ENTZUG_MS`, `FAKE_ERTEILUNG_MS`, `FAKE_ABBAU_MS` > 300; B14) | nach dem späten `slot off/privilegeRevoked` bei Erlaubnis „ja“ ein neuer Abgleich, Slot wieder gestartet; dazwischen SZ11 mit T14 |
| PK29 | Alarm beim Weggang (B12, FR7); Wechsel von Person und Modus (Restrunde RR9) | gezeigte Person geht → `zoom_alarm=1`, `zoom_slot1_alarm=1`; Slot „Anna“ in einem Meeting ohne Anna → `zoom_alarm=0`; Slot zeigte Anna, der Bediener stellt die Person auf Ben (nicht im Meeting), Anna bleibt da → `slotSet {id:0}`, T16, `zoom_slot1_alarm=0` (der Slot zeigt Anna nicht weiter); ein Sprecher-Slot, der lief, wechselt auf Teilnehmer mit einer abwesenden Person → T16, kein Alarm. Ereignis im Flug (Fünfte Runde N3): Slot zeigt Anna mit Kamera aus (T19), der Bediener stellt auf Ben (nicht im Meeting), `slotSet {id:0}` wird zurückgehalten (`sendeFilter`, `zoom-kern.test.ts:115`, `:189`), und die Attrappe meldet `slot live` mit Ziel Anna (Kamera wieder an) → `zeigteSchon` bleibt aus; nach dem `slotSet` T16, `zoom_slot1_alarm=0`; ebenso ein spätes `slot live` mit `mode: speaker` nach dem Umstellen von Sprecher auf Teilnehmer (eingespeist über `ereignis`, `:137`, `:181`) |
| PK30 | Abo abgelehnt (`FAKE_ABO_FEHLER=1:9`; B51) | T20c mit Handgriff, `zoom_slot1_alarm=1`, `zoom_alarm=1`; kein automatischer neuer Versuch |
| PK31 | Ton-Abbildung (7.1) | jede Zeile der Tabelle als `slotOn`-Felder; `zoom_slot{n}_audio` nach 8.2 |
| PK32 | Vorübergehender Slot „Behalten“ | `slotBehalten` → dauerhaft, gespeichert, überlebt Meeting-Ende |
| PK33 | Quelltext (B24) | in `apps/connect/src` kein `case 'video'`, `case 'audio'`, `ev === 'video'`, `ev === 'audio'` |
| PK34 | Fehler ohne Slot, Wettlauf und Ton-Fehler (B62; Nachfix W2, W6) | `slotBadNumber` → „Hinweise“ T103; `slotNotOn` nach einem Entzug → kein Text, kein SZ8; `slotReconnecting` (Attrappe während `reconnecting`) → kein Text, kein Fehlerstand, nach `inMeeting` startet der Abgleich den Slot; `previewUnavailable` → T57 an jeder Kachel; Ton-Abo-Fehler (`audioSubscribeFailed`) → T104 an jeder Kachel mit Ton; danach `waiting/command` eines anderen Slots → T104 nur noch am Slot mit eigenem `off/audioUnavailable`; neue Bridge, Meeting-Ende und Entzug löschen den Merker; `audioQueueOverflow` → nur Hinweis Q6, keine Tonzeile ändert sich; `audioBufferMismatch` mit `slot` → Hinweis T106, keine Tonzeile ändert sich |
| PK35 | Übergangs-Namensregel (7.2; B22, B79 a; Nachfix W4) | „A:B“ → „JM Connect – Zoom A B“; „A: B“ → „JM Connect – Zoom A␣␣B“ (zwei Leerzeichen, wie 0.3.0 nach NDI); „A␣␣B“, „␣A“ und „A␣“ bleiben Zeichen für Zeichen erhalten (␣ = ein Leerzeichen, im Test als `' '` geschrieben); Steuerzeichen entfernt; 70 Zeichen → 60; Kollision nach `gleicherNdiName` (Groß-/Kleinschreibung) → „ (2)“; `normiereSlot` verwirft den so angelegten Slot nicht und ändert seinen Namen nicht |
| PK36 | Drehbuch „Slots“ von Anfang bis Ende | jede Kachel, Kopfzeile und der STATE nach jedem Schritt gegen 10.2–10.11 |

### 11.5 Einstellungen (`apps/connect/test/zoom-settings.test.ts`)

- Unlesbare Datei: Sicherungskopie mit Zeitstempel, T90, Vorgaben; die übrigen Felder der Datei gehen nicht still verloren.
- Schreibfehler: `nurSitzung`, T92; die Anzeige behauptet kein Speichern (Muster dieser Datei, „Schreibfehler darf die Anzeige nicht belügen“).
- `normiereSlot`: ungültige Werte → Vorgabe; doppelte Nummer oder doppelter Name → verworfen, T91 mit Zahl.
- **Konstruktor-Rundlauf:** jedes der elf Felder von `ZoomSlotEinstellung` einzeln geändert, geschrieben, gelesen → gleich.
- Vorübergehende Slots erscheinen nie in der geschriebenen Datei; ein dauerhafter Slot mit `anNurMeeting` steht dort mit `an: false` (7.2; Restrunde RR7).

### 11.6 Texte und STATE (`zoom-text.test.ts`, `control-state.test.ts`)

Prüfregel 10.5; jede Zeile aus Abschnitt 9 wörtlich (Präfix „S“, 9); 119 Schlüssel = Variablen der Rolle `connect`, die sieben bisherigen wörtlich als Teilmenge; ein Raum-Push lässt die `zoom_*`-Werte stehen und umgekehrt (heute `control-state.test.ts`, ST4 12.4).

### 11.7 Companion (`packages/companion-jm-suite/test/selftest.mjs`)

- Zählung `[16, 128, 9]` (heute `:130`).
- `buildCommandLine('connect', zoom_slot, { slot: 3, mode: 'toggle' }, { zoom_slot3_on: '1' })` → `CONNECT ZOOM_SLOT 3 OFF`; mit `'0'` → `ON`; `zoom_slot_person` mit „Anna Maria“ → `CONNECT ZOOM_SLOT_PERSON 1 Anna Maria`.
- Feedback `zoom_slot_live` mit Option `slot: 2` liest `zoom_slot2_live`.
- Preset `zoom_slot` trägt das Feedback `zoom_slot_on` mit `slot: 1`.
- Version 0.3.0 in `package.json` und `manifest.json` gleich (`:159`).

### 11.8 Gegenprobe (Pflichtauswahl)

| absichtlicher Fehler | wird rot |
| --- | --- |
| Haltezeit mit `>` statt `>=` | PB1 |
| eigene Kennung als Kandidat zugelassen | PB4 |
| reine Ton-Freigabe zählt als neueste | PB12 |
| nach dem Ende der gezeigten Freigabe kein Rücksprung | PB10 |
| `freeze` ohne Kopie sendet schwarz | PB16 |
| Mischer ohne Begrenzung | PB17 |
| Abbau-Plan `meetingEnded` mit `Unsubscribe` | PB20 |
| `slotsMeetingEnded` übergibt `privilegeRevoked`; der Zweig `ZeigerVerwerfen` des Ausführers ruft `destroyRenderer` (Restrunde RR3) | PT6 |
| `rendererNew` auch ohne Typwechsel gezählt; bei 29 ein neuer Renderer | PB21 |
| Umhängen setzt nur Ziel und `lastFrameMs` zurück | PB22, PK4 |
| Umhängen ersetzt auch den Ton-Stand eines Slots mit reinem Mischton (Restrunde RR8) | PB22 |
| Moduswechsel Freigabe → Sprecher mit Mischton + Computerton behält den Ton-Stand (alter `lastAudioMs`) oder meldet kein `slotAudio`; Wechsel in den Mischer ohne `MischerNeu`, auch per `slotSet` mit `shareAudio` (Restnachfix N1) | PB22 |
| `tonWeg` liefert im Modus Sprecher `mixShare` (Restnachfix N1) | PB25 |
| `silenceBisMs` liegt außerhalb von `TonStand` und bleibt bei `TonStandNeu` stehen (Fünfte Runde N2) | PB22, PB30 |
| direkter Computerton meldet bei Ziel 0 `waiting/targetChanged` statt `off/noShare`; `stilleBloecke` liefert für ihn bei Ziel 0 Stille (Fünfte Runde, `noShare`) | PB22, PB30 |
| T75b ohne gemessenen Computerton; T58f mit Ziel ≠ 0 (Fünfte Runde, `noShare`) | 10.5 (Tonzeile), PK14 |
| Regel 4 ohne `tonAn` (T75 bei ausgeschaltetem Ton); Regel 6 ohne `doppelt`, `zweifel` und „keine Person“ (T58e neben T13) (Sechste Runde RN4, RN12) | 10.5 (Tonzeile) |
| Person-Ton mit Computerton meldet beim Freigabewechsel `waiting/targetChanged` oder `off/noShare` (Sechste Runde RN5) | PB22 |
| `stilleBloecke` schreibt `silenceBisMs` ab dem ungekappten Beginn fort (der Rest wird nachgeholt); die Ziel-0-Regel gilt auch für `mix` (Sechste Runde RN6, RN7) | PB30 |
| Nachlauf von `leave` verwirft die Halteliste auch nach `sessionLeave()` = `false` (Fünfte Runde N8) | PB20 |
| `zeigteSchon` von einem `slot live` mit fremdem Ziel oder Modus gesetzt (Ereignis im Flug, Fünfte Runde N3) | PK29 |
| `zoom_unload` (`fernSlotEntladen`) schaltet einen vorübergehenden Slot nur aus, statt ihn zu löschen (Fünfte Runde N6) | PK13 |
| Riegel fehlt (Bild während `umhaengen` angenommen) | PB23 |
| Bildausfall setzt `cameraOff` | PB24, PK9 |
| Person-Ton an Ziel 0 | PB25 |
| neue `SprecherWahl` ohne Vorbelegung | PB26 |
| Befüllen ersetzt die Liste | PB15 |
| Typ-Nachtrag vergibt ein neues `seq` | PB27 |
| Mischer hält 60 ms, Stille-Herzschlag bleibt an (mehr Ton als Wanduhr) | PB28 |
| Kopie eines früheren Ziels als `held` gesendet | PB29 |
| Freigabe-Slot meldet `sent = held` erst mit dem Zustand nach 2 s (oder ändert `sent` ohne `slot`-Ereignis) (Nachfix W1) | PB29 |
| Vorschau in SZ4 mit `sent = held` als T55b gemalt (Nachfix W1) | 10.5 (Vorschau) |
| Abbau während der Renderer-Sperre löscht den Slot samt Delegate statt `InHalteliste`; `INMEETING` baut die Halteliste nicht ab (Nachfix W2) | PB20 |
| `slotOn` legt während der Sperre einen Slot an; `slotReconnecting` setzt in Connect einen Fehlerstand (Nachfix W2) | PB20 bzw. PK34 |
| Entzug leert die Freigabe-Liste (Nachfix W3) | PB20 |
| Übergangs-Namensregel fasst Leerraum zusammen (Nachfix W4) | PK35 |
| Ziel 0 nach einem Moduswechsel behält den Grund `modeChanged` (Nachfix W7) | PB19, PK7 |
| `audioQueueOverflow` setzt den Ton-Abo-Fehler; der Ton-Abo-Fehler fällt nie (Nachfix W6) | PK34 |
| ein Mangel der Einrichtung lässt vorübergehende Slots, `liefSchon` oder Fehlerstände stehen (Restrunde RR1) | PK11 |
| Vorschau bei `sent = freeze` ohne letzte Vorschau als Schachbrett gemalt (Restrunde RR4) | 10.5 (Vorschau), KF9 |
| `_state` meldet `zeigt` in Z5 mit laufendem Slot (Restrunde RR5) | 10.5 (STATE) |
| Ton- oder Messzeile in SZ9 nach den Regeln eines laufenden Slots (Restrunde RR6) | 10.5 (Ton- und Messzeile) |
| `zoom_load` schaltet einen ausgeschalteten dauerhaften Slot dauerhaft ein (`an: true` gespeichert) (Restrunde RR7) | PK13, 11.5 |
| `zeigteSchon` überlebt einen Wechsel von Person oder Modus; `gewaehlteId` überlebt einen Personenwechsel (Restrunde RR9) | PK29 |
| `where:'slot'` setzt `phase = 'error'` | PT2 |
| ein Lauscher ruft `subscribe`; `onMeetingStatusChanged` ruft `slotRetarget` | PT6 |
| NDI-Name in einer `emitLog`-Zeile | PT6 |
| `preview.cpp` liest `g_slots` | PT6 |
| Rückkehr exakt statt normiert verglichen | PK5 |
| Rückkehr per `slotOff`/`slotOn` statt `slotSet` | PK4 |
| Rückkehr auf einen Namensvetter, der schon vorher da war | PK6 |
| Moduswechsel per Neustart des Slots | PK7 |
| `zoom_alarm` ohne die Regel `liefSchon` | PK3 (Z6 beim ersten Beitritt wird 1) |
| `zoom_alarm` beim Weggang einer gezeigten Person 0 | PK29 |
| `subscribeFailed` zählt nicht in o | PK30 |
| Zustimmung ab dem 6. nicht gespeichert | PK12 |
| `zoom_sources` zählt nur Teilnehmer-Slots | PK2 |
| `zoom_load` legt einen dauerhaften Slot an | PK13, PK11 |
| `zoom_slot_audio OFF` lässt den Computerton an | PK13 |
| gescheiterter Slot bei `roster` neu gestartet | PK18 |
| kein Abgleich nach spätem Abbau bei Erlaubnis „ja“ | PK28 |
| `previewMode` fehlt in der Startfolge | PK16 |
| Messwerte-Kopie mit NDI-Namen | PK17 |
| Vorschaubild im Abbild | PK16 |
| „Ersatzbild“ in SZ4 oder „Zeigt“ in SZ5 | 10.5 |
| „Ton: aus“ bei eingeschaltetem Ton in SZ2 | 10.5 (Tonzeile) |
| „0 Bilder/s“ neben alter Größe | 10.5 (Messzeile), PK15 |
| T12b ohne `liefSchon` | 10.5 |
| unlesbare Datei ohne Sicherungskopie | 11.5 |
| `normiereSlot` verwirft ein Feld | 11.5, Rundlauf |
| Preload kopiert eine Nutzlast feldweise | 11.11 KF5 |
| Umschalten ohne Platzhalter-Auflösung | 11.7 |

### 11.9 CI (`.github/workflows/ci-checks.yml`, Job `selftests`)

```yaml
      - name: Zoom-Bridge, Entscheidungslogik (C++ ohne SDK)
        run: npm run logik-test -w @jm/zoom-bridge
```

Dazu bleiben die Schritte für Bridge, Connect, Steuerprotokoll, Companion-Selbsttest und Companion-Sync (`ci-checks.yml:79-92`). Der Job läuft auf Ubuntu; `g++` ist dort vorhanden (**Annahme** AN16, wird im ersten CI-Lauf belegt; fehlt er, installiert ein Schritt `build-essential`). Zeitbudget 11.4.

### 11.10 Verbleib der bestehenden Tests (Nachbesserung B19, B74)

Die Spec streicht Schnittstellen, an denen bestehende Fälle hängen: `laden`, `entladen`, `ton`, `sollVerwerfen` (7.1), `soll.ts` (7.3), `videoSubscribe`/`videoUnsubscribe`, die Ereignisse `video`/`audio`, `rebound`/`reboundByName`, `Session.videoSubs`/`audioSubs` (6.2, 6.3, 6.18). In `apps/connect/test/zoom-kern.test.ts` (3684 Zeilen) rufen 216 Zeilen diese Schnittstellen; `apps/connect/test/zoom-teile.test.ts:8` importiert `sollAbbild`, `sollHandlungen` und `istAusserhalbMeeting` aus `soll.ts`, ein fehlender Import bräche die ganze Datei und über die `&&`-Kette in `apps/connect/package.json:17` alle folgenden. Löschen ist darum kein Weg zu Grün: Jeder Block zieht um oder entfällt mit Begründung.

| bestehender Block | Verbleib |
| --- | --- |
| `zoom-kern.test.ts:317-1034` (Einrichtung, Mängel, Zugang, SDK-Ordner, Versatz, Drossel, Startfolge, Generationen, Beitritt, Erlaubnis) | bleibt in `zoom-kern.test.ts`; Fälle, die `laden` nur zum Herstellen einer Lage nutzen, nehmen stattdessen `slotStart` |
| `:1035-1197` (Warteraum, Meeting-Ende, Verlassen, Wiederbeitritt) | bleibt; Lage mit Slots statt Quellen; „Verlassen leert vor dem Abbau“ gilt jetzt für vorübergehende Slots |
| `:1198-1324` (Laden/Entladen, Ton, Doppelname, Kollision, Q8) | zieht um nach PK2, PK6, PK13, PK14, PK19, PK24; Q8 entfällt (T21) |
| `:1325-1459` (Soll-Liste, Teilnehmer-Wiederbeitritt, R5, Vergessen) | zieht um nach PK4, PK5, PK20; „Vergessen“ entfällt (es gibt keine Soll-Liste; Löschen ist PK26, vorübergehende Slots PK13) |
| `:1460-2254` (Spawn, SDK-Schlüssel, SDK laden) | bleibt unverändert (keine gestrichene Schnittstelle) |
| `:2255-2499` (Abriss, Wiederbeitritts-Folge, verlassen, abbrechen) | bleibt; die Teile mit Quellen prüfen dieselbe Folge mit Slots (PK20, PK21 als Ergänzung); „Mangel vor Versuch 2“ (`:2444-2465`) prüft statt der leeren Soll-Liste die Slot-Folgen aus PK11 (Restrunde RR1) |
| `:2500-2738` (Entzug, Wiedererteilung, Betriebsgröße, Erlaubnis nach jedem await, R5 mit Grenze) | zieht um nach PK3, PK12, PK20, PK28; „Erlaubnis nach jedem await“ bleibt als eigener Fall mit `slotStart` |
| `:2739-2843` (Randfälle 0.3.0: Hinweise, offenes Abo, Sperre, Z12, Z2, Versatz nur Sitzung, Ton aus dem Soll, Doppelname) | bleibt bis auf „Ton aus dem Soll“ (entfällt, Ton je Slot, 0.8) und „offenes Abo“ (zieht um nach PK19) |
| `:2844-2914` (Logzeilen ohne Teilnehmernamen) | zieht um nach PK17, Muster unverändert |
| `:2915-3076` (Fernsteuerung) | zieht um nach PK13; die Prüfung der sieben bisherigen STATE-Namen (`:2942-2943`) bleibt wörtlich (11.6) |
| `:3077-3167` (Fix-Welle: gemerkte Quellen, Erlaubnis flattert, Ausnahme im Versuch) | „gemerkte Quellen“ entfällt (Abschnitt entfällt, 7.5); „Erlaubnis flattert“ → PK28; „Ausnahme im Versuch“ bleibt |
| `:3168-3681` (Owner und Rulings vom 08.10.2026) | je Fall: Zustände außerhalb des Meetings → 10.5 (Kachel in Z10, Z11, Z13); Q8/Ladefehler an der Zeile → PK18, PK19; „Verlassen und Beenden leeren vor dem Abbau“ → PK11 für vorübergehende Slots; Q1/Q2 an der Zeile → PK18 (`slotNoPrivilege` wartet) und 10.10 |
| `zoom-teile.test.ts:28-88` (Name, NDI-Vorschau, `baueTeilnehmer`, `zaehleQuellen`, `istVerwaist`) | Name bleibt; NDI-Vorschau → PK35; `baueTeilnehmer` → 11.11 KF4; `zaehleQuellen`/`istVerwaist` entfallen (es gibt keine Quellen) |
| `zoom-teile.test.ts:89-216`, `:249-299`, `:300-652` (Soll-Abgleich, Plätze, Stände, Vorrang-Kreuzprodukt) | ziehen um in einen reinen Tabellentest für `slots.ts` (neu `apps/connect/test/zoom-slots-abgleich.test.ts`): 7.3 Nr. 1–10 je eine Zeile, Vorrangfolge als Kreuzprodukt |
| `zoom-teile.test.ts:217-248` (Nutzlast-Prüfung Zugang, SDK-Schlüssel) | bleibt; dazu `pruefeSlotEingabe` (11.11) |
| `zoom-text.test.ts` 4b-Blöcke zu gemerkten Quellen, Q8/Q9/Q14, Bild und Ton der Quelle (`:842-926`) | ziehen um nach 10.5 bzw. entfallen mit ihren Texten (9.7 „Entfallen“) |
| `packages/zoom-bridge/test/selftest.ts:1289-1451` (Video: Abo-Buchführung, Umhängen) | ziehen um nach PT1, PT5; „Umhängen behält denselben Sender“ → PK4 gegen die Attrappe und PB22 |
| `selftest.ts:1452-1553` (Ton) | PT1 (`slotAudio`) |
| `selftest.ts:1597-2079` (`steuerung`) | PT8 |
| `selftest.ts:2264-2708` (Attrappe Stage 4 und 4b) | bleibt, die Abo-Fälle mit Slots; neue Stellschrauben PT7 |
| `selftest.ts:2709-2768` (Quelltext-Wächter) | PT6 |

Der Plan führt diese Tabelle als Aufgabe: Jeder Block bekommt im Aufgabenbericht „umgezogen nach …“ oder „entfällt, weil …“; die Gegenproben übernommener Fälle bleiben Pflicht.

### 11.11 Konstruktor- und Helfer-Tests (Nachbesserung B78)

| # | Prüfling | Erwartung |
| --- | --- | --- |
| KF1 | `slotLage()` | jedes Feld von `ZoomSlotLage` aus einer Lage gesetzt (Rundlauf über eine Testlage mit lauter von der Vorgabe abweichenden Werten) |
| KF2 | `kurz()` | `slotsLaufen`, `slotsErsatz`, `slotsOffen`, `slotsAn`, `slotsGestopptEntzug`, `slotKurz` je Feld |
| KF3 | `abbild()` | `vorgaben`, `sprecher`, `vorschauAn`, `vorschauVerfuegbar`, `ueber5`, `messwerte`, `einstellungen` |
| KF4 | `baueTeilnehmer` | `slotNrn` (mehrere Slots auf dieselbe Person), Kamera-Kennzeichen nach `videoStatus` |
| KF5 | Preload und Hülle (Quelltext-Test) | jeder Kanal aus 7.9 reicht die Nutzlast als Ganzes weiter; die Hülle ruft `pruefeSlotEingabe` und gibt das Ergebnis unverändert an den Kern |
| KF6 | `pruefeSlotEingabe` (rein, Muster `pruefeZugangEingabe`, `zoom-teile.test.ts:219-226`) | je Kanal gültige und ungültige Nutzlasten |
| KF7 | Haltezeit-Prüfregel (`einstellungen.ts`) | 0, 0,1, 5 s gültig; −0,1, 5,1 s, 0,05 s → T74 |
| KF8 | `tonFuerBridge` | jede Zeile der Ton-Abbildung (7.1) |
| KF9 | `slot-vorschau.ts` | jede Zeile der Tabelle in 7.7 |

---

## 12 · Abnahme im echten Meeting (`apps/connect/ABNAHME-0.4.0.md`)

Format wie `apps/connect/ABNAHME-0.3.0.md`: Titel mit Umfang, Verweis auf diese Spec (Abschnitt 12 wörtlich, Messpunkte aus 17.2), Regeln, Tabelle „Getesteter Bau“, Voraussetzungen, Gruppen mit `# | Schritt | Erwartung | Ergebnis`, Schlusstabelle „Messungen“.

**Regeln:**
- Getesteter Bau ist der **veröffentlichte Pre-Release** aus dem Launcher (B.7), nicht ein interner Bau; SHA-256 des Installers in „Getesteter Bau“.
- Der native Teil ist geändert → Gruppe L (Gegenprobe der bisherigen Funktionen) ist Pflicht (`ABNAHME-0.3.0.md:8`).
- Meeting-Nummer, Kenncode und echte Teilnehmernamen nie in die Datei, nur `<Name>` (`ABNAHME-0.3.0.md:9`); die Messwerte-Kopie ist schon ohne Namen (0.23).
- Companion mit Modul 0.3.0 aus dem Release; für A3 zusätzlich ein Rechner mit Connect 0.3.0 oder eine Switcher-Show, die unter 0.3.0 eingerichtet wurde.
- Jeder Messpunkt aus 17.2 hat einen Schritt, der sein Feld füllt (Nachbesserung B80); was hier kein Feld hat, ist kein Messpunkt.

**Voraussetzungen** (Nachbesserung B5, B40; Nachfix W8): Raum-PC mit Windows (Prozessor, Grafikkarte, Arbeitsspeicher notieren); Meeting im eigenen Zoom-Konto, Host im Zoom-Client; die Kontoeinstellung für HD-Video notieren (ob das Konto 1080p zulässt, ist **Annahme** AN24); **mindestens 9 verschiedene Kamera-Quellen** für Gruppe K (Teilnehmer-Geräte, weitere Zoom-Clients auf einem zweiten Rechner oder virtuelle Kameras), möglichst alle für 1080p eingerichtet (Kamera, HD im Zoom-Client; für eine aussagekräftige Zeile „9 Slots, 1080p“ müssen es neun sein, die 1080p allein liefern, K0), und zwei mit gleichem Namen; zwei Geräte können den Bildschirm teilen, eines mit Computerton; ein Teilnehmer mit angemeldetem Zoom-Konto (für MS16); JM Switcher und ein NDI-Monitor im Netz, im Switcher ein eigenes Hintergrundbild unter dem Slot-Eingang (für transparent); ein Browser-Gast mit einem Namen gleich einem Slot (L1); Companion mit Modul 0.3.0; Task-Manager mit den Spalten CPU, GPU („3D“ und „Video Decode“) und Arbeitsspeicher; eine Stoppuhr (H1, D6). Reichen die Kamera-Quellen nicht, gilt die Regel unter der Lasttabelle.

| Gruppe | # | Schritt | Erwartung |
| --- | --- | --- | --- |
| A Installation | A1 | Connect 0.4.0 über den Launcher installieren (Update von 0.3.0) | Version sichtbar; Einrichtung, Zugang, Versatz unverändert; Abschnitt „Zoom-Slots“ mit T30 |
| | A2 | Slots anlegen: „Zoom 1 Moderation“ (Teilnehmer `<Name A>`), „Zoom 2 Sprecher“ (Sprecher), „Zoom 3 Freigabe“ (Freigabe), Connect beenden und aus dem Launcher neu starten | alle drei unverändert da; im Switcher noch keine Quelle |
| | A3a | Übergang mit einem Switcher-Eingang aus 0.3.0 (Quelle „‹Rechner› (JM Connect – Zoom <Name B>)“): im Meeting `<Name B>` „Als Slot laden“ (Nachbesserung B79 f) | der alte Eingang zeigt das Bild ohne Neueinrichtung; der Slot ist dauerhaft (kein T96). Dass dauerhafte Slots Neustart und Meeting-Ende überstehen, prüfen A2 und J3, denn A3b löscht diesen Slot (Fünfte Runde N7) |
| | A3b | Den Slot aus A3a ausschalten und löschen, dann `zoom_load <Name B>` per Companion (Nachfix W5: Solange ein Teilnehmer-Slot dieses Namens besteht, legt `zoom_load` keinen neuen an, 8.3) | ein neuer vorübergehender Slot mit T96 und dem alten NDI-Namen; der alte Eingang zeigt wieder Bild ohne Neueinrichtung; nach dem nächsten neuen Beitritt (spätestens D5) ist der Slot weg (7.3 Nr. 8); dass vorübergehende Slots mit dem Meeting enden, prüft J3 an einem eigenen Slot (Sechste Runde RN8) |
| | A4 | (falls ein Mac da ist) Connect 0.4.0 unter macOS starten | T95 an der Stelle der Zoom-Karte |
| B Teilnehmer | B1 | Beitreten, Erlaubnis erteilen | die eingeschalteten Slots starten von selbst; Quellen „‹Rechner› (Zoom 1 Moderation)“ usw. im Switcher; Kachel T15 |
| | B2 | `<Name A>` verlässt das Meeting und kommt nach mehr als 1 s zurück (#262) | T16 mit Ersatzbild, `zoom_alarm` = 1, dann wieder T15 mit Ton; der Switcher-Eingang bleibt verbunden (kein Neuverbinden sichtbar) |
| | B2b | dasselbe mit dem angemeldeten Konto | T62c notieren (MS16) |
| | B3 | Zwei Geräte mit gleichem Namen; Slot auf diesen Namen; Person wählen; dann schaltet die gewählte Person die Kamera aus | T13, Companion-Feedback „braucht einen Eingriff“; nach der Wahl Bild; nach Kamera aus T19 ohne Alarm |
| | B4 | `<Name A>` schaltet die Kamera aus und an | T19, Ersatzbild; Teilnehmerliste zeigt „Kamera aus“ |
| | B5 | Doppel-Abo vor dem Lasttest: Slot 1 Teilnehmer `<Name A>`, Slot 2 Sprecher, `<Name A>` spricht; dann zwei Freigabe-Slots, B teilt (Nachbesserung B35) | je Slot: Bild ja/nein, Bilder/s, geliefert B×H, Kachel (T97?) notieren (MS21) |
| C Ersatzbilder | C1 | Ersatzbild nacheinander transparent, eingefroren, schwarz, weiß, je Kamera aus; dann bei schon ausgeschalteter Kamera auf „eingefroren“ umstellen | transparent: im Switcher liegt das Hintergrundbild sichtbar darunter (MS12); eingefroren: letztes Bild; schwarz; weiß; Umstellen bei aus: T60 und transparent |
| D Sprecher | D1 | zwei Personen wechseln sich im Abstand von etwa 2 s ab, Haltezeit 1 s; danach T69 notieren | Slot folgt ohne Dauerflackern; Lücke (T66) notieren (MS13); „zu häufige Aufrufe“ und „fremde Bilder“ aus T69 (MS4, MS11) |
| | D2 | Signal nacheinander auf alle drei stellen, je D1 wiederholen | notieren, welches Signal passt; Spotlight durch den Host einmal je Signal (MS7) |
| | D3 | „Teilnehmer ohne Kamera zeigen“ aus, dann an; je eine Person ohne Kamera spricht, je Signal (Nachbesserung B49) | aus: Slot bleibt bei der vorigen Person; an: notieren, ob das Signal die Person ohne Kamera überhaupt meldet (Slot zeigt T27 bzw. bleibt; MS7) |
| | D4 | JM Connect selbst ist stumm; prüfen, dass der eigene Teilnehmer nie gezeigt wird | nie |
| | D5 | neuer Beitritt mit **allen** Slots auf Ton aus (kein `JoinVoip`), D1 wiederholen (Nachbesserung B36) | notieren, ob Sprecher-Signale kommen (Signal-Tabelle T65; MS22) |
| | D6 | Sprecher-Slot mit Mischton: Klatschen vor der Kamera, im Switcher Bild gegen Ton (Nachbesserung B80) | Versatz Bild–Ton notieren (MS18) |
| E Freigabe | E1 | Person B teilt den Bildschirm, pausiert, teilt weiter, beendet | T28, T29 mit gehaltenem Bild, T28, T29c; Auflösung und Bildrate notieren (MS1); T63c: Rückrufe und Freigabe-Kennung bei Pause notieren (MS6) |
| | E2 | Stehender Bildschirm 60 s; dann Maus bewegen | T29b, kein Ersatzbild-Flackern, die Kachel bleibt ruhig (kein Wechsel unter 2 s, Nachbesserung B66) |
| | E3 | A und B teilen gleichzeitig, dann endet B | Slot zeigt B (neueste, T28b), dann A |
| | E4 | Freigabe mit Computerton: Computerton an/aus; dann Ton Mischton dazu; T63/T64/T64c ansehen | Ton der Freigabe in derselben NDI-Quelle; aus → still; mit Mischton: notieren, ob der Computerton doppelt klingt (MS8, MS9); Kennung des Freigabe-Tons notieren (MS28); zum Schluss bei Ton aus und Computerton an die Freigabe beenden: Tonzeile T58f (Fünfte Runde, `noShare`) |
| | E4b | Slot mit Ton Person auf die teilende Person, während sie Ton teilt (Nachbesserung B80) | notieren, ob ihr Person-Ton den Computerton enthält (MS9, zweite Frage) |
| | E5 | Connect beitreten, während schon jemand teilt | notieren, ob der Slot die laufende Freigabe sofort zeigt (`seeded`, MS3) |
| | E6 | Connect ist im Meeting, B teilt schon, **dann** einen Freigabe-Slot einschalten (Nachbesserung B38) | Slot zeigt die Freigabe; nie T29c, solange B teilt |
| | E7 | B verlässt das Meeting, während B teilt (AN9) | Slot geht auf die nächstjüngere Freigabe bzw. T29c |
| | E8 | reine Computerton-Freigabe nach einer laufenden Bildschirmfreigabe (Nachbesserung B37) | Slot bleibt bei der Bildschirmfreigabe; Typ und Rückrufe in T63c notieren (MS23) |
| | E9 | Freigabe beginnen und sofort `rendererNew`/`noShareData` in T69 notieren | MS27 |
| F Ton | F1 | Slot 1 Ton Person, Slot 2 Mischton, Slot 3 aus; dann am laufenden Slot umschalten; Companion „Ton aus“ an einem Freigabe-Slot mit Computerton | jeweils der richtige Ton; Umschalten ohne Neustart der Quelle; Companion „Ton aus“ macht die Quelle still, `zoom_slot{n}_audio` = 0 |
| G Moduswechsel | G1 | Slot 1 laufend (Ton nach Vorgabe: Mischton, Computerton an) von Teilnehmer auf Sprecher, auf Freigabe, zurück | der Switcher-Eingang bleibt verbunden; die Tonzeile passt nach jedem Wechsel zum neuen Modus (10.6: in Freigabe mit Computerton, sonst nur Mischton), und der Ton läuft danach wieder (T58c; Restnachfix N1); Zähler „neue Renderer“ und „Renderer-Typ“ aus T69 notieren (MS5) |
| | G2 | Auflösung am laufenden Slot von 720p auf 1080p und zurück (Nachbesserung B48) | „Renderer meldet“ (T62) und geliefert B×H notieren (MS2) |
| H Anzeige | H1 | Kacheln, Vorschau, Messwerte ansehen; Fenster minimieren und zurückholen; „Messwerte kopieren“; bei 9 Slots Start-Klick → Kachel mit Stoppuhr | Vorschau etwa 2 Bilder/s, nach dem Minimieren aus und danach wieder an; Kopie ohne Namen; Verzögerung notieren (MS15) |
| I Companion | I1 | Slot ein/aus/umschalten, Modus, Person, Ton je Slot; Variablen und Feedbacks ansehen; alte Befehle `zoom_load`, `zoom_unload`, `zoom_delay`; 17 verschiedene Namen nacheinander laden und entladen; `zoom_load` auf den Namen eines ausgeschalteten dauerhaften Slots (Restrunde RR7) | alles wirkt; `zoom_slot{n}_target` nennt die gezeigte Person; alte Befehle wie in 0.3.0 (vorübergehende Slots, kein F14); der dauerhafte Slot zeigt T96b und ist nach dem Meeting-Ende (J3) wieder aus |
| J Abbau | J1 | Host entzieht die Erlaubnis, erteilt sie wieder, **während** B den Bildschirm teilt und ein Freigabe-Slot läuft (Nachfix W3) | Bild und Ton aller Slots stoppen sofort, T12b; danach laufen alle wieder, Sprecher-Slot zeigt sofort wieder den Sprecher, der Freigabe-Slot sofort wieder Bs Freigabe (nie T29c, solange B teilt) |
| | J2 | Netzwerkkabel 60 s ziehen | Z10/Z11, danach laufen die Slots wieder; notieren, ob der Switcher selbst neu verbindet (MS17) |
| | J3 | Kurz vorher per Companion `zoom_load <Name C>` (vorübergehender Slot, T96); dann beendet der Host das Meeting, **während** eine Freigabe und ein Sprecher-Slot laufen; dann Beenden aus dem Tray (Nachbesserung B34; Sechste Runde RN8) | **kein Absturz der Bridge** (Log: kein Rückgabewert eines Absturzes, Muster `packages/zoom-bridge/ABNAHME-STAGE3.md:264-267`); nach dem Meeting-Ende, vor dem Beenden: die dauerhaften Slots stehen weiter in der Karte, der vorübergehende Slot für `<Name C>` ist weg (der aus A3b ging schon mit einem neuen Beitritt, A3b), der dauerhafte Slot aus I1 (`zoom_load`, T96b) ist wieder aus und ohne T96b (Fünfte Runde N7); Connect endet binnen 15 s; notieren, welche Rückrufe zwischen `disconnecting` und `ended` kamen (MS26) |
| | J4 | Netzwerkkabel 5 s ziehen (Z10 kurz, wie A3 aus 0.3.0, `ABNAHME-0.3.0.md:33`; Nachbesserung B80) | Slots laufen weiter oder wieder; „vom SDK abgebaute Renderer“ aus T69 notieren (MS25); kein Absturz |
| K Lasttest (#261) | K0 | Vor K1 jede Kamera-Quelle einzeln mit genau einem laufenden Slot, je 30 s in 720p und in 1080p (Nachfix W8) | je Quelle geliefert B×H notieren; „liefert die Stufe allein“ = kürzere Seite mindestens die Nennhöhe (Regel 10.7); daraus je Stufe die Zahl der Quellen, die sie allein liefern (MS10) |
| | K1–K10 | 1, 3, 5, 7, 9 Slots je in 720p und 1080p, je 5 min (Tabelle unten); bei 6 die Nachfrage T40 einmal | Felder vollständig; „schafft dieser Rechner“ je Stufe ja/nein nach dem Kriterium unten |
| | K11 | bei 5 und 9 Slots Vorschau aus und wieder an | CPU-Unterschied notieren (MS15) |
| | K12 | zwei Slots auf dieselbe Person gegen zwei Slots auf verschiedene Personen, je 720p (Nachbesserung B5) | Prozess-CPU und GPU „Video Decode“ beider Fälle notieren (MS19) |
| L Gegenprobe | L1 | „Einrichtung prüfen“, Warteraum und Einlass, Versatz per Klatschtest, zwei Browser-Gäste parallel zu 5 Slots, einer davon mit dem NDI-Namen eines Slots, Log durchsuchen nach Kenncode, Meeting-Nummer und Teilnehmernamen | wie in 0.3.0; T46 an der Kachel; notieren, welche Quelle der Switcher zeigt (MS20); im Log keiner der Werte |

**Lasttest (Gruppe K), je Stufe eine Zeile:**

| Slots | Auflösung | Rechner | je Slot: geliefert B×H, Bilder/s, Bridge-Anteil (ms/s) | Prozess-CPU (T61) | System-CPU | GPU 3D / Video Decode (Task-Manager) | Arbeitsspeicher | Bild ruckelfrei im Switcher | Ton ruckelfrei | verschiedene Quellen | davon liefern die Stufe allein (K0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 720p | | | | | | | | | | |
| 1 | 1080p | | | | | | | | | | |
| 3 | 720p | | | | | | | | | | |
| 3 | 1080p | | | | | | | | | | |
| 5 | 720p | | | | | | | | | | |
| 5 | 1080p | | | | | | | | | | |
| 7 | 720p | | | | | | | | | | |
| 7 | 1080p | | | | | | | | | | |
| 9 | 720p | | | | | | | | | | |
| 9 | 1080p | | | | | | | | | | |

Je Stufe zeigt jeder Slot eine **eigene** Kamera-Quelle auf einem Teilnehmer-Slot. Reichen die Quellen nicht, werden Sprecher- und Freigabe-Slots aufgefüllt, die Spalte „verschiedene Quellen“ nennt die Zahl, und eine Stufe mit weniger verschiedenen Quellen als Slots gilt als **nicht aussagekräftig für #261**, bis K12 (MS19) zeigt, ob doppelt belegte Slots eine eigene Dekodierung kosten. Ebenso gilt eine Stufe für die Frage nach einer HD-Grenze (MS10) als **nicht aussagekräftig für #261**, wenn weniger ihrer Quellen die Stufe allein liefern (letzte Spalte, aus K0), als Slots laufen (Nachfix W8): Liefert eine Quelle schon allein nur 720p, sagt ihr 720p-Bild in der 1080p-Zeile nichts über eine Grenze, die Zoom bei mehreren Abos zieht (Hinweise darauf nur beim Custom-UI-Container, `customized_video_container.h:197-199`). Die Lastwerte der Zeile (MS14) bleiben gültig, mit den tatsächlich gelieferten Größen. Die Messwerte-Kopie (T68) jeder Stufe kommt unter die Tabelle.

**Kriterium „schafft dieser Rechner“** (Vorschlag der Spec, Owner-Frage FR9; Nachbesserung B73): eine Stufe gilt als geschafft, wenn über die 5 Minuten (1) jeder Slot mindestens 90 % der Bildrate liefert, die derselbe Slot in Stufe 1 lieferte, (2) `fallbackFps` bei laufendem Bild 0 bleibt, (3) T61 keine verworfenen Ton-Pakete und keine verworfenen Zoom-Ereignisse zeigt, (4) Bild und Ton im Switcher ruckelfrei sind. Die Betriebsgröße (5, `zoom-text.ts:40-45`) ändert erst eine Owner-Entscheidung nach der Abnahme; der Lasttest liefert die Grundlage.

**Messungen:** Schlusstabelle mit allen Messpunkten aus 17.2 (`# | Frage | Wo gemessen | Ergebnis`).

---

## 13 · Release-Weg

Jeder Schritt nur mit Owner-Okay (`docs/roadmap.md:411`). Abnahme ist bewusst **keine** Voraussetzung (Owner 15.10., Abschnitt 2).

**Beginn der Umsetzung** (Owner-Reihenfolge 17.10.2026, Abschnitt 2; Builder-Check, Frage 2; Sechste Runde RN15): Erste Bedingung ist die Owner-Freigabe dieser Spec samt Abschnitt 0 und Texttabelle (E31). Die Umsetzung beginnt erst nach dem Merge des iveo-Pakets; in derselben Reihenfolge steht davor auch die Umsetzung der Geführten Anleitungen im Launcher. Vor dem ersten Plan-Schritt wird der Branch auf das dann aktuelle `main` neu aufgesetzt, und jede Fundstelle dieser Spec in einer Datei, die `git diff --stat a9553defe7 <neuer main>` zeigt, wird neu gemessen; das deckt das iveo-Paket und die Geführten Anleitungen ab (die heute absehbaren Dateien und Stellen nennt 20; Sechste Runde RN11, RN13). **Mac-Weg:** Variante A der iveo-Spec (OF1: Connect-Mac-Paket aus der CI ohne NDI und ohne Zoom, Workflow `connect-mac.yml`; iveo-Spec auf `feat/iveo-paket` @ `0b5fe80c32`, `docs/superpowers/specs/2026-10-16-iveo-paket-design.md:1504`). Ein Wechsel auf C (dem Owner angeboten, offen) ändert die Stellen zum Mac-Bau (0.24, E28, 7.11, Nr. 9–10) und den Mac-Prüfschritt in der Selbsttest-Kette von `apps/connect/package.json` (unter C kehrt sich die Prüfung „kein `jm_ndi.node`“ um, iveo-Spec Z. 870, 872); sie werden dann nachgezogen (Sechste Runde RN14).

1. **Voraussetzungen:** Launcher 0.16.0 (iveo-Paket) released und gemergt; dieser Branch darauf neu aufgesetzt (vor dem ersten Plan-Schritt, oben). Nur wenn der Owner FR11 mit „ja“ beantwortet: Der interne Live-Messlauf nach 20 ist gemacht und ausgewertet, und zu jedem negativen Messpunkt liegt die Folge nach FR11 vor (bei MS21 die Entscheidung des Owners zu RS15, 0.4.0 oder 0.4.1). Bis zu dieser Antwort ist der Lauf empfohlen und keine Voraussetzung (O2 und Release-Entscheidung, Abschnitt 2; Sechste Runde RN2). Grün: `npm run selftest -w @jm/zoom-bridge`, `npm run logik-test -w @jm/zoom-bridge` (sucht unter Windows `cl` selbst, 11.1; findet es keinen Compiler, ersetzt lokal `npm run slot-test` den Schritt, die CI läuft ihn in jedem Fall; Nachbesserung B86), lokal `npm run slot-test` und `npm run delay-test -w @jm/zoom-bridge`, `npm run selftest -w @jm/connect`, `npm run selftest -w @jm/suite-control-protocol`, `node packages/companion-jm-suite/test/selftest.mjs`, Companion-Sync ohne Diff, `npm run cookbook:check`. Der Aufgabenbericht zu 11.10 ist vollständig. Texttabelle (9) mit der Spec freigegeben, jede spätere Textänderung mit Owner-OK als eigener Plan-Punkt (E31); Notes vom Owner freigegeben. Die Texte selbst prüft der Owner vor dem Release nur noch im Abnahme-Bau (Nr. 6).
2. **Versionen:** `apps/connect/package.json:3` → `0.4.0` (samt `package-lock.json`); `packages/companion-jm-suite/package.json:3` und `companion/manifest.json:6` → `0.3.0`.
3. **Changelog:** Eintrag `connect` 0.4.0 vor dem 0.3.0-Eintrag (`packages/suite-manifest/changelog.json:1651`), typografische Anführungszeichen, Modul-Hinweis wie `:1660` (auch in den Notes, unten); Prüfung `node -e "JSON.parse(require('fs').readFileSync('packages/suite-manifest/changelog.json','utf8'))"`.
4. **Katalog:** In der Beschreibung `packages/suite-manifest/suite.json:471` (Fassung aus dem iveo-Paket, iveo-Spec 10.6) wird „dazu Zoom“ zu „dazu Zoom-Slots: Teilnehmer, aktiver Sprecher und Bildschirmfreigabe als feste NDI-Quellen“; JSON-Prüfung wie Schritt 3. Der Proxy liefert den Katalog live aus `main` (`services/release-proxy/worker.js:211-259`).
5. **Companion** wie 8.5 → `jm-suite-companion-0.3.0.tgz`.
6. **Lokaler Bau** (Windows, `ZOOM_SDK_DIR` und `NDI_SDK_DIR` gesetzt): `npm run rebuild -w @jm/zoom-bridge` (Pflicht, `native/` ist geändert; sonst bricht `apps/connect/tools/bundle-zoom-bridge.mjs:38-39` ab) → `npm run rebuild:native -w @jm/connect` → `npm run dist:win -w @jm/connect` → `apps/connect/release/JM Connect-0.4.0-win-x64.exe` (`electron-builder.yml:3`). Den Bau-Commit notieren. Dieser Bau ist der Abnahme-Bau: Der Owner sieht darin vor Nr. 8 die Texte durch (E31); ändert sich danach ein Text, gilt E31, und es folgt ein neuer Bau.
7. **Wächter gegen Zoom-DLLs:** Wächter 1 (`bundle-zoom-bridge.mjs:59-67`) druckt eine Erfolgszeile. Wächter 2 (`afterPack`, `electron-builder.yml:29`, liest auch die `app.asar`) bricht heute nur bei einem Treffer ab und schreibt sonst nichts (`apps/connect/tools/after-pack.cjs:11-23`); er bekommt eine Erfolgszeile „Wächter 2: keine Zoom-SDK-Dateien im Installer“ (eine Zeile, ohne eigenen Test: Der Haken ruft nur die geteilte Wächter-Funktion aus `packages/zoom-bridge/scripts/auslieferung.mjs`). Beide Zeilen müssen im Bauprotokoll stehen (Nachbesserung B85); zusätzlich `tar -tzf jm-suite-companion-0.3.0.tgz` ohne `.dll`. Kein Zoom-Binärteil in einem veröffentlichten Paket (ToU §6.1).
8. **Push, PR** (Owner-Freigabe); vorher `MANIFEST_REF` = `main` prüfen (`services/release-proxy/wrangler.toml:55`) und Capabilities-Konflikte mit anderen Strängen durch neuen Sync lösen (ST4 17.3).
9. **Merge** (Owner) → **gleicher Baum prüfen:** `git diff --stat <Bau-Commit> <Merge-Commit>` muss leer sein, sonst neu bauen (bei 0.3.0 lagen Bau `f2cb025c99` und Tag auf dem Merge `2df1f79357` auseinander; die Mac-Pakete baut die CI aus dem Tag, Nachbesserung B87) → `git tag connect-v0.4.0 <Merge-Commit>` → `git push origin connect-v0.4.0` (einzeln; `.github/workflows/suite-release.yml:35` schließt `connect-v` aus) → sofort `gh release create connect-v0.4.0 --prerelease --title "JM Connect 0.4.0 (Zoom-Slots)" --notes-file <Notes> "apps/connect/release/JM Connect-0.4.0-win-x64.exe" "<Pfad>/jm-suite-companion-0.3.0.tgz"`. Der Tag startet `connect-mac.yml` aus dem iveo-Paket; er hängt die DMGs an das bestehende Release. Hat er wider Erwarten zuerst ein Release angelegt (Wettlauf), stattdessen `gh release upload connect-v0.4.0 …` für EXE und Modul und `gh release edit connect-v0.4.0 --title "JM Connect 0.4.0 (Zoom-Slots)" --notes-file <Notes> --prerelease`. **Bewusste Abweichung** von iveo-Spec 10.1 (2), wo `gh release create` das Tag anlegt: Das eigene Tag vor dem Release ist der bei 0.3.0 gelebte Weg (E28) und umgeht die dort offene Messaufgabe M3 (Nachbesserung B81).
10. **Katalog-Bump** erst, wenn **EXE, Modul und beide DMGs** am Release hängen und `connect-mac.yml` grün ist (Begründung von iveo-Spec E37: „Der Katalog soll erst eine Version nennen, wenn beide Pakete am Release hängen“, und 10.1 (4) „Nach den DMGs“; Nachbesserung B81): `node scripts/bump-manifest.mjs connect 0.4.0`, Commit „chore(manifest): connect latestVersion → 0.4.0 [skip ci]“. Ist der Mac-Lauf rot, kein Bump, bis er grün ist.
11. **Wirkung:** Jeder Launcher mit installiertem Connect meldet 0.4.0 als Update; `--prerelease` filtert nichts (`apps/launcher/src/main/release-source.ts:87-98`). So entschieden (Abschnitt 2, Release; RS9). Unter macOS bekommt der Bediener das Mac-Paket ohne Zoom (T95).
12. **Nach der Abnahme** (Nachbesserung B84): Messwerte in `ABNAHME-0.4.0.md`; dann **Doku nachziehen**, bevor Issues schließen: `packages/zoom-bridge/README.md` §7 mit der gemessenen Lücke beim Sprecherwechsel als Zahl (MS13) und dem gemessenen Unterschied der Sprecher-Signale (MS7), wie #227 es in seiner Abnahme verlangt; das Connect-Handbuch mit den gemessenen Grenzen aus Gruppe K und MS10 (D8 sagt bis dahin „5 gemessen“); die Roadmap (D11). Korrekturen und angepasste Vorgaben in 0.4.1. Schließen erst danach: #247, #227, #261, #262; #257, #258, #259, #260 bleiben offen mit Kommentar, was 0.4.0 erfüllt und was 0.5.0 bringt.
13. **Unverändert:** Einsatzpaket `zoom-bridge-v0.1.0` (Riegel in `build-release.mjs`, 6.18); kein Rundown-Release.

**Notes-Entwurf (zur Owner-Freigabe; Nachbesserung B82):**
- Zoom-Slots: feste NDI-Quellen mit frei wählbarem Namen, je Slot Teilnehmer, aktiver Sprecher oder Bildschirmfreigabe, umschaltbar ohne dass die Quelle im Bildmischer verschwindet.
- Eine Person, die das Meeting verlässt und zurückkommt, landet wieder auf ihrem Slot (bei eindeutigem Namen).
- Je Slot Auflösung 360p, 720p oder 1080p (die Kachel zeigt, was Zoom wirklich liefert), Ersatzbild transparent, eingefroren, schwarz oder weiß, Ton als Mischton, Ton der Person oder aus, bei Freigaben mit Computerton.
- Kachel je Slot mit Zustand, gemessener Auflösung und Bildrate, kleiner Vorschau und Messwerten; Slots sind am Rechner gespeichert und starten beim Beitritt von selbst.
- Aus „Gemerkte Quellen“ werden „Zoom-Slots“; in der Teilnehmerliste heißt „Als Quelle laden“ jetzt „Als Slot laden“ und legt einen gespeicherten Slot mit dem bisherigen NDI-Namen „JM Connect – Zoom ‹Name›“ an, so finden bestehende Mischer-Eingänge ihre Quelle wieder.
- Teilnehmer-Slots speichern den Anzeigenamen der Person am Rechner (in den Einstellungen von Connect); Log und Messwerte bleiben ohne Namen.
- Companion-Modul 0.3.0 liegt bei (`jm-suite-companion-0.3.0.tgz`, der Launcher lädt es nicht mit; in Companion über „Import custom module“ importieren): Slot ein/aus, Modus, Person, Ton je Slot, Variablen und Feedbacks. Die bisherigen Befehle „Zoom: Person als Quelle laden“ und „Zoom: Quelle entladen“ (im Modul 0.3.0 „Zoom: Person als Slot laden (nur dieses Meeting)“ und „Zoom: Slot einer Person entladen“) wirken weiter für das laufende Meeting: Sie legen einen vorübergehenden Slot an, den „entladen“ wieder löscht; gibt es für die Person schon einen ausgeschalteten gespeicherten Slot, schaltet „laden“ ihn nur für dieses Meeting ein. Modul 0.2.0 läuft weiter, zeigt die Slots aber nicht.
- Vorabfassung zum Live-Test: Die Abnahme mit Lasttest steht noch aus; Korrekturen folgen mit 0.4.1.

---

## 14 · Doku

| # | Stelle | Heute | Neu |
| --- | --- | --- | --- |
| D1 | `packages/zoom-bridge/README.md:5-16` (§1) | „Stage 1–3 von 4“, Bild und Ton je Teilnehmer, `videoSubscribe` | Slots mit drei Modi |
| D2 | `README.md:235-312` (§6) | Befehle ohne `videoDelay`, Ereignisse ohne `audio`/`videoDelay` | Befehle und Ereignisse nach 6.2/6.3; `videoSubscribe`/`video`/`audio` als entfallen vermerkt |
| D3 | `README.md:314-776` (§7) | nur Teilnehmer-Abos, „ein einziges globales Zoom-Ton-Abo“, Speicher für fünf Quellen | Slots, Umhängen samt Riegel und Renderer-Sperre, Halten, Ersatzbilder, Ton je Art samt Mischer-Uhr, Versatz ohne Freigabe, Speicher je Slot, Vorschau; nach der Abnahme die gemessene Lücke und der Signal-Unterschied (13 Nr. 12) |
| D4 | `README.md:845-853` (§8) | WIN32-Zählung nur Teilnehmer/Aufnahme | dazu Share 9/0, Video 12/0, Audio 5/0 (`meeting_sharing_interface.h:153-214`, `meeting_video_interface.h:208-290`, `meeting_audio_interface.h:108-143`); Renderer-Sperre ab `DISCONNECTING` |
| D5 | `README.md:866-912` (§9) | „Kein Mischton“, „Kein Bildschirmton“, „keine spätere Stage“ | **Widerruf daneben, alter Text bleibt stehen** (Lehre „beim Widerruf alten Text stehen lassen“), Verweis auf diese Spec |
| D6 | `native/audio.cpp:87-90` | „ausdrücklich NICHT im Umfang“ | mit dem Bau berichtigen |
| D7 | `packages/zoom-bridge/package.json:6` | Beschreibung je Teilnehmer | Slots |
| D8 | `packages/cookbook/content/tool-manuals/tool-jm-connect.md` | Voraussetzung ab 0.3.0, Modul 0.2.0, drei Zoom-Befehle, „nie einen Namen“ (`:42`), Grenzen (`:57`, `:59`), „Gemerkte Quellen“ und „Als Quelle laden“ (`:89-100`, `:153-167`), „Solange Einträge fehlen, steht zoom_alarm auf 1“ (`:94`, `:106`) | ab 0.4.0; Modul 0.3.0; Slot-Befehle; Namen nur in `zoom_slot{n}_target`; **gestrichen** werden die Teile zu „Gemerkte Quellen“ und „Als Quelle laden“ (`:89-100`, `:153-167`), ersetzt durch „Zoom-Slots“ und „Als Slot laden“; `zoom_load`/`zoom_unload` als vorübergehende Slots (ein ausgeschalteter gespeicherter Slot gleichen Namens wird nur für dieses Meeting eingeschaltet, Kennzeichen „nur dieses Meeting an“; Restrunde RR7); `zoom_alarm` nach 8.4; Grenzen: bis zu 16 Slots, 5 gemessen (bis die Abnahme mehr zeigt, 13 Nr. 12), Rückkehr nur bei eindeutigem Namen, 1080p nur, soweit Zoom liefert, kein Dolmetscherton, kein Ton zurück nach Zoom, Slots nur unter Windows; „Kein Mischton, kein Bildschirmton“ entfällt; Bedienung, Pannenhilfe für die neuen Texte, Checklisten; „Logs und Datenschutz“: Teilnehmer-Slots speichern einen Anzeigenamen am Rechner, vorübergehende nicht; danach `npm run cookbook:build` (Nachbesserung B91) |
| D9 | `packages/companion-jm-suite/README.md:33-64` | Rolle Connect ab 0.2.0 | Slots ab Modul 0.3.0 |
| D10 | `packages/suite-control-protocol/src/capabilities.ts:624` | „Ohne Namen“ | 8.1 |
| D11 | `docs/roadmap.md` | Stand 16.10.; Roadmap-Entscheidung E7 („vorher bauen“ A oder „als kommende Fassung“ B, `:180-182`); #227 und #247 als ⚪ (`:175`, `:177`); Release-Regel „Pre-Release, dann Merge“ (`:415`) | Zeile Connect 0.4.0 und Release-Reihenfolge; die Roadmap-Entscheidung E7 erst nach der Antwort des Owners auf FR12, die Spec setzt keine voraus (Sechste Runde RN1); #227 und #247 auf „in Arbeit“ bzw. nach dem Release auf „ausgeliefert, Abnahme offen“; die Release-Regel `:415` wird auf die gelebte Folge Merge → Tag → Release (E28) berichtigt (Nachbesserung B91); nach der Abnahme erneut (13 Nr. 12) |
| D12 | ST4 Zeilen 65 und 67, Stage-2- und Stage-3-Spec (`docs/superpowers/specs/2026-08-12-zoom-stage2-video-ndi-design.md`, `2026-08-14-zoom-stage3-audio-ndi-design.md`) | „Keine Vorschau“, „Kein Mischton, kein Bildschirmton“ | historisch stehen lassen, je ein Nachtrag mit Verweis auf diese Spec |
| D13 | `packages/zoom-bridge/paket/LIESMICH.txt` | Grenzen des Einsatzpakets 0.1.0, Umhängen in der Bridge (`:104-109`) | unverändert (das Paket wird nicht neu gebaut); der Riegel in `scripts/build-release.mjs` (6.18) verhindert, dass ein neuer Bau diese Anleitung mit dem neuen Code ausliefert |
| D14 | Zoom-Review-Unterlagen (Branch `spike/zoom-obf`, `docs/zoom-marketplace/`) | „upcoming version“, „Mischton wird nicht genutzt“, Name nur in Karte und NDI-Name | Folgepunkt FP1 |
| D15 | `README.md:59-69` (§2/§3, Skripte) und `README.md:71-121` (§4, Live-Befehle der Konsole) | `typecheck`/`selftest`; `+<id>`/`-<id>` → `videoSubscribe`/`videoUnsubscribe`, „Hängt sich ein Abo um … nichts zu tun“ (`rebound`/`reboundByName`) | §2/§3: dazu `logik-test` (C++ ohne SDK, braucht einen Compiler, 11.1) und `slot-test`; §4: Konsole nach 6.18 (`+`, `-`, `=`, Hinweis „Rückkehr? …“), keine Rückkehr von selbst (Nachbesserung B83) |
| D16 | `README.md:991-1000` (§10) | Einsatzpaket aus `zoom-join.mjs` | Satz, dass das Paket den Stand 0.1.0 zeigt und der Riegel in `build-release.mjs` einen Neubau mit dem Slot-Code sperrt |

---

## 15 · Vorbereitung 0.5.0 (nicht umsetzen, nur ohne Umbau ermöglichen)

| Thema (B.8) | Was 0.4.0 schon so schneidet | Was 0.5.0 noch braucht | Hindernis laut Header/Code |
| --- | --- | --- | --- |
| Galerie (selbst zusammengesetzt) | Modus als offene Aufzählung in Connect, Bridge und Capabilities (`slotModusArg`); Kachel und Slot-Lage unabhängig vom Modus; je Slot eine **Abo-Liste** (0.4.0: ein Eintrag), über die Umhängen, Abbau-Ketten und Messwerte schon laufen, mit dem Ziel-Stand je Abo (`Abo::ziel`; Restrunde RR10), und ein Bildweg über `Slot::bildAnkunft` statt direkt zum Sender (6.1; 0.30, B6) | weitere Abos je Slot und ein Bild-Zusammensetzer an der Stelle `bildAnkunft`; Auswahl und Reihenfolge der Personen; ein Befehl mit mehreren Kennungen (der Feldleser kennt keine Felder, `session.cpp:809-820`, also etwa eine Zeichenkette „1,2,3“) | kein Rohdaten-Typ „Galerie“ (`rawdata_renderer_interface.h:22-26`); Reihenfolge nur vom Host (`meeting_video_interface.h:538-554`); `HideOrShowNoVideoUserOnVideoWall` nur im Zoom-UI-Modus (`:640`); wie viele Abos Zoom zulässt, ist über 5 hinaus ungemessen (MS10) |
| Dolmetscher-Ton | Tonart als offene Aufzählung; Ton-Zuordnung je Art im Herzschlag (6.13) | Art `dolmetscher` mit Sprache; Abo mit `bWithInterpreters = true` | ein einziges Ton-Abo für alle Slots, Umschalten heißt Tonlücke überall (`rawdata_audio_helper_interface.h:70-77`); Schlüssel ist der Sprachname (`:19-24`); Begründung für `false` (#208) klären (`audio.h:55-57`) |
| fps-Wahl 25/30/50/60 | `slotStats.fps` misst schon, was Zoom liefert | Rate im NDI-Bild je Slot, ggf. Bilder doppeln | NDI-Rate fest 30000/1001 (`ndi_sender.cpp:78-79`); Zoom kennt Bildraten nur bis 30 (`meeting_video_interface.h:79-93`, **Annahme**, für das eigene Senden dokumentiert) |
| QoS-Werte | `slotStats` ist erweiterbar, Connect zeigt Messwerte je Slot | Lauscher `onUserVideoQualityChanged`, `onUserNetworkStatusChanged` | je Person nur grobe Stufen (`meeting_video_interface.h:268`; leerer Rumpf `callbacks.h:62`); Zahlen nur meetingweit (`meeting_service_interface.h:564-613`) |
| Logo als Ersatzbild | Ersatzbild als offene Aufzählung, Bildarten in der Versatz-Warteschlange, Ersatzbild-Puffer je Größe (6.12) | Bilddatei, Skalierung, BGRA | kein SDK-Bezug |
| Einstellungen | `zoomSlotsFassung` | Umstellung auf Fassung 2 | `normiereSlot()` setzt unbekannte Werte auf die Vorgabe; ein Rückweg von 0.5.0 auf 0.4.x verliert also die neuen Werte (bewusst) |

---

## 16 · Risiken

| # | Risiko | Folge | Gegenmaßnahme |
| --- | --- | --- | --- |
| RS1 | Zoom liefert 1080p, auch 720p, nicht für viele Slots gleichzeitig (HD-Grenzen nur beim Container belegt, 5.3-4) | Lasttest in 1080p zeigt kleinere Bilder | ehrliche Messzeile (T51), keine Herabstufung; zusätzliche Messquellen (6.11, MS24); Entscheidung nach MS10 in 0.4.1 (FR2) |
| RS2 | Rückkehr nur über eindeutigen Namen (5.3-6, gemessen `video.cpp:1305-1310`) | Handy-Gäste mit gleichem Gerätenamen kehren nicht von selbst zurück | Handgriff mit Personenauswahl (T13, T13b), Alarm je Slot; MS16 für angemeldete Konten |
| RS3 | Renderer darf den Typ nicht wechseln (MS5) | Moduswechsel braucht neuen Renderer | Sender bleibt trotzdem (E3); Zähler sichtbar |
| RS4 | Empfänger nehmen den Formatwechsel I420 ↔ UYVA nicht sauber (MS12) | Ruckler oder Schwarz beim transparenten Ersatzbild | Messpunkt; schwarz und weiß bleiben I420 |
| RS5 | Ersatz- und Haltebilder kosten NDI-Kodierung (bis 10/s je Slot) | Last steigt mit Slots ohne Bild | `fallbackFps` und Bridge-Anteil sichtbar; Takt in 0.4.1 anpassbar |
| RS6 | Versatz-Speicher bei 1080p rund 94 MB je Slot (E11) | bei 16 Slots bis 1,5 GB | `memKb` je Slot sichtbar; Freigabe-Slots ohne Versatz |
| RS7 | Ton-Warteschlange mit Mischton und Computerton zu klein | Paketverluste (Q6) | 512 Pakete, Überlauf sichtbar |
| RS8 | Zoom begrenzt die Zahl der Abos über 5 hinaus (`…HasSubscribeExceededLimit`, 5.3-4) | Slot 6 ff. ohne Bild | `slotSubscribeFailed` mit SDK-Code an der Kachel (T20c), Alarm (10.1); Lasttest |
| RS9 | Pre-Release erreicht jeden Raum-PC mit Connect (13 Nr. 11); **so entschieden** (Owner 15.10., Abschnitt 2; die frühere Frage FR5 entfällt, Nachbesserung B7) | ungeprüfter C++-Teil auf Show-Rechnern | Notes sagen „Vorabfassung“; wer vor einer Show nicht testen will, aktualisiert nicht; Rückweg über den Installer von 0.3.0 aus dem GitHub-Release |
| RS10 | 119 STATE-Schlüssel, 128 Companion-Variablen | längere STATE-Zeilen, lange Variablenliste | Meldung nur bei Änderung (`control-state.ts:50-59`); Messpunkt im Lasttest nicht nötig |
| RS11 | Datenschutz-Aussagen der Review-Unterlagen veraltet (Mischton genutzt, Namen am Rechner und im STATE) | Widerspruch bei einer Einreichung | FP1 vor jeder Einreichung |
| RS12 | Großer Umbau des nativen Teils | Regression bei Stage-2/3-Wegen | Gruppe L der Abnahme; Logiktests in der CI; Abbau-Plan und Quelltext-Wächter (PB20, PT6) |
| RS13 | Bedeutung der drei Sprecher-Signale unbekannt (5.3-8) | Sprecher-Slot folgt der falschen Größe | alle Signale protokolliert, umschaltbar ohne Release (O2) |
| RS14 | `EnablePlayMeetingAudio(false)` unterdrückt den Freigabe-Ton (5.3-11) | kein Computerton | T64 und T64c unterscheiden „nichts angekommen“ von „nicht zuzuordnen“ (6.13), MS8, MS28; Änderung der Einstellung nur nach Messung (0.4.1) |
| RS15 | Zoom beliefert zwei Renderer auf dieselbe Kennung bzw. Freigabe nicht (AN21, MS21; Nachbesserung B35) | Teilnehmer- und Sprecher-Slot auf derselben Person, mehrere Freigabe-Slots: einer ohne Bild | Kachel nennt den anderen Slot (T97), `noFrames`/`subscribeFailed` statt „Kamera aus“; Abnahme B5 vor dem Lasttest, vorher schon der empfohlene interne Messlauf (20); Rückfallebene in 0.4.1 (Abschnitt 2, Release); nur wenn der Owner FR11 mit „ja“ beantwortet und der Lauf MS21 negativ zeigt, entscheidet er zwischen 0.4.0 und 0.4.1 (Sechste Runde RN2): ein Renderer je Ziel, dessen Bilder an mehrere Sender gehen (der Bildweg über den Slot, 6.1, lässt das zu) |
| RS16 | Das SDK baut Renderer bei einer eigenen Wiederverbindung ab, ohne `onRendererBeDestroyed` (AN25, MS25; Nachbesserung B32); umgekehrt leben Renderer weiter, deren Slot während der Sperre abgebaut wurde (Nachfix W2) | `unSubscribe` an einem toten Renderer, Absturz wie README §8; bzw. ein Rückruf an einen freigegebenen Delegate | `rendererTot` beachten (6.10 Schritt 2); Renderer-Sperre bis `INMEETING` (6.5); Halteliste statt Freigabe des Delegates, Abbau erst nach `INMEETING` (6.15), Zahl in T61; Abnahme J4 |
| RS17 | Zwischen `DISCONNECTING` und `ENDED` kommen Weggang-, Freigabe- oder Sprecher-Rückrufe (AN23, MS26; Nachbesserung B34) | ohne Sperre `unSubscribe` an abgeräumten Renderern | Renderer-Sperre ab `DISCONNECTING`/`RECONNECTING` (6.5); Abnahme J3 mit laufender Freigabe |
| RS18 | Sprecher-Signale kommen nur mit `JoinVoip` (AN17, MS22; Nachbesserung B36) | Sprecher-Slot bleibt auf T26, wenn kein Slot Ton hat | Abnahme D5, vorher schon der empfohlene interne Messlauf (20); Ausweg nur nach der Messung (FR8) |

---

## 17 · Annahmen und Messpunkte

### 17.1 Annahmen (weder im Code noch im Header belegt)

| # | Annahme | wo sie trägt |
| --- | --- | --- |
| AN1 | `setRawDataResolution` ist ein Wunsch oder eine Obergrenze, kein Versprechen. | E7, 6.11 |
| AN2 | Zoom liefert höchstens 30 Bilder/s. | 15 |
| AN3 | Die neuen Lauscher können auf jedem Thread rufen; Warteschlangen unter Sperre genügen. | E21 |
| AN4 | `NDIlib_send_send_video_v2` kodiert im Aufruf; der Bridge-Anteil enthält also die NDI-Kodierung. Indirekt gestützt: nur die async-Variante sagt „all processing … asynchronously“ (`Processing.NDI.Send.h:68-87`). | 6.17 |
| AN5 | NDI-Empfänger verkraften den Formatwechsel je Bild. | E8 (MS12) |
| AN6 | WIC in einem eigenen MTA-Thread stört das SDK nicht. | E15 |
| AN7 | Ein Vorschau-JPEG 192×108 mit Qualität 0,5 hat rund 8 KB, als Base64-Zeile rund 10,7 KB; 16 Slots × 2 Bilder/s sind rund 340 KB/s (Nachbesserung B21). | E14, 6.16 |
| AN8 | Eine Pause mit Freigabe-Kennung 0 meint alle Freigaben der Person. | 6.9 (MS6) |
| AN9 | Verlässt eine Person das Meeting, enden ihre Freigaben, auch ohne `Share_End`. | 6.9 (Abnahme E7) |
| AN10 | Teilnehmer-Kennungen sind nie 0. **Teils belegt** (Nachbesserung B28): `GetUserID()` liefert 0 nur, wenn es scheitert (`meeting_participants_ctrl_interface.h:96-101`); dass Zoom einem Teilnehmer nie 0 gibt, sagt der Header nicht. | 6.2 (`id: 0` = kein Ziel) |
| AN11 | `destroyRenderer` ist synchron; ein Delegate lässt sich für einen neuen Renderer wiederverwenden (dieselbe Annahme wie `video.cpp:484-513`). Nach `onRendererBeDestroyed` nutzt die Bridge einen neuen Delegate (6.10 Schritt 2); die Synchronität bleibt Annahme. | 6.10 |
| AN12 | Alle Ton-Wege sind mono mit 32 kHz (laut Beitrittsparametern); gemessen wird je Paket. | 6.13 |
| AN13 | 512 Pakete Ton-Warteschlange reichen für 16 Slots mit Mischton und Computerton. | E10 |
| AN14 | `GetSharingSourceInfoList` liefert im Custom-UI-Modus womöglich nichts. | 6.9 (MS3) |
| AN15 | Mehrere Slots auf dieselbe Person kosten je Renderer eine eigene Dekodierung. | Lasttest (MS19, K12) |
| AN16 | `g++` steht im CI-Bild bereit. | 11.9 |
| AN17 | Die Sprecher-Signale (`meeting_video_interface.h:233-243`, `meeting_audio_interface.h:118-122`) kommen auch, solange die Bridge nicht per `JoinVoip` am Ton teilnimmt (`session.cpp:552-563`). | 6.8 (MS22) |
| AN18 | `user_id` in `onShareAudioRawDataReceived` ist die Kennung der teilenden Person; der Header nennt nur den Parameternamen (`rawdata_audio_helper_interface.h:18`). | 6.13 (MS28) |
| AN19 | Eine Freigabe mit Kennung 0 bei Begin bekommt ihre Kennung mit dem Typ-Nachtrag (`meeting_sharing_interface.h:47-48` sagt nichts zu 0). | 6.9 (MS6) |
| AN20 | Die Listen beim Befüllen stehen in Beginn-Reihenfolge; der Header sagt dazu nichts (`meeting_sharing_interface.h:428-442`). | 6.9 (MS3) |
| AN21 | Zoom beliefert zwei Renderer auf dieselbe Kennung bzw. dieselbe Freigabe zugleich (`rawdata_renderer_interface.h:51-58` schweigt). | 6.10 (MS21, RS15) |
| AN22 | `RawData_Off` nach `unSubscribe()` kommt auch nach dessen Rückkehr (der Riegel fängt beides; offen ist nur, welcher Fall vorliegt). | 6.10; trägt nichts, weil der Riegel beide Fälle gleich verwirft, darum kein Messpunkt (MS29 entfällt, Restrunde RR2) |
| AN23 | Zwischen `DISCONNECTING` und `ENDED` können Weggang-, Freigabe- oder Sprecher-Rückrufe kommen. | 6.5 (MS26) |
| AN24 | Das Zoom-Konto und die Sende-Geräte lassen 1080p zu. | 12 (MS24) |
| AN25 | Bei einer eigenen Wiederverbindung des SDK bleiben die Renderer gültig, solange kein `onRendererBeDestroyed` kommt. | 6.15 (MS25); ebenso der Abbau der Halteliste nach `INMEETING` (Nachfix W2): Gilt AN25, braucht ein dort gehaltener Renderer sein `unSubscribe` und sein Delegate darf bis dahin nicht frei werden; gilt sie nicht, trifft das `unSubscribe` ihn wie jeden laufenden Slot (RS16) |
| AN26 | `subscribe(SHARE)` liefert bei `Sharing_Other_Share_Begin` sofort Daten (sonst 29, 6.10). | 6.10 (MS27) |

### 17.2 Messpunkte (nur im Meeting; Feld in der Abnahme)

| # | Frage | Abnahme |
| --- | --- | --- |
| MS1 | Hält eine Freigabe die gewählte Auflösung ein? Welche Größe und Bildrate hat sie (Bildschirm, Fenster, ungerade Maße → `slotBufferMismatch`?) | E1 |
| MS2 | Hält der Renderer die Auflösung über `unSubscribe`+`subscribe`; was meldet `getResolution()` nach dem Setzen? (Ob eine Stufe auch ohne Umhängen wirkt, prüft 0.4.0 nicht, 6.11.) | G2, K |
| MS3 | Meldet Zoom laufende Freigaben beim Ankommen nach (`seeded`)? In welcher Reihenfolge? | E5, E6 |
| MS4 | Kommen nach dem Umhängen Bilder mit fremder `GetSourceID()` (`foreignFrames`)? Was liefert `GetSourceID()` bei VIDEO und SHARE (`gapUngeprueft`)? | D1, G1 |
| MS5 | Darf ein Renderer zwischen VIDEO und SHARE wechseln (`rendererNew`, `rawType`)? | G1 |
| MS6 | Was kommt während `Sharing_Pause` (keine Bilder, Standbilder, `RawData_Off`)? Ist die Freigabe-Kennung gesetzt, und zieht der Typ-Nachtrag eine Kennung 0 nach (T63c)? | E1 |
| MS7 | Unterschied der drei Sprecher-Signale, auch bei Spotlight; Bedeutung von 0; Meldungen über den eigenen Teilnehmer; Form der Liste; melden sie Personen ohne Kamera? | D2, D3 |
| MS8 | Kommt Freigabe-Ton trotz `EnablePlayMeetingAudio(false)`; Rate und Kanäle? | E4 |
| MS9 | Enthält der Mischton den Computerton; enthält der Ton der teilenden Person ihn? | E4, E4b |
| MS10 | Gelieferte Größe je Slot bei 720p und 1080p mit 1, 3, 5, 7, 9 Slots; gilt eine HD-Grenze? (360p misst die Abnahme nicht, Entwurf B.6; Nachbesserung B73). Aussagekräftig nur für Zeilen, deren Quellen die Stufe allein liefern (Nachfix W8) | K0, K |
| MS11 | Liefert `subscribe` bei schnellem Wechsel `SDKERR_TOO_FREQUENT_CALL` (`tooFrequent`)? | D1 |
| MS12 | Zeigt der JM Switcher das transparente Ersatzbild durchsichtig, ohne Ruckler beim Formatwechsel? | C1 |
| MS13 | Lücke beim Sprecherwechsel (`gapMs`), Wechsel pro Minute | D1 |
| MS14 | Last je Stufe: Bridge-Anteil, Prozess, System, GPU, Speicher | K |
| MS15 | Kosten der Vorschau (CPU an/aus); Verzögerung von Klick bis Kachel bei 9 Slots | K11, H1 |
| MS16 | Hält die `persistentId` bei angemeldeten Zoom-Konten über Weggang und Wiederbeitritt (T62c)? | B2b |
| MS17 | Verbindet der Switcher nach Entzug oder Wiederbeitritt (neuer Sender, gleicher Name) selbst neu? | J1, J2 |
| MS18 | Laufen Bild und Ton von Sprecher- und Freigabe-Slot gleich (Mischton; kein Versatz bei Freigabe)? | D6, E4 |
| MS19 | Kosten mehrere Slots auf dieselbe Person doppelt? | K12 |
| MS20 | Was tut NDI mit zwei gleichnamigen Sendern (Slot und Browser-Gast; ST4 M8)? | L1 |
| MS21 | Beliefert Zoom zwei Renderer auf dieselbe Kennung (VIDEO) bzw. dieselbe Freigabe (SHARE) zugleich? Je Slot Bild ja/nein, Bilder/s, B×H | B5 |
| MS22 | Kommen die Sprecher-Signale ohne `JoinVoip`? | D5 |
| MS23 | Welche Folge von Zustand und Typ meldet Zoom je Freigabe-Art (Bildschirm, Fenster, Whiteboard, reiner Computerton)? | E8, E1 |
| MS24 | Was sagen `GetUserVideoSize`, die HD-Einstellungen und `recvResolution`/`recvFps` neben der gemessenen Größe (T62b)? | K, G2 |
| MS25 | Kommt `onRendererBeDestroyed` bei Z10, Z11 oder Meeting-Ende (`rendererLost`)? | J2, J3, J4 |
| MS26 | Welche Rückrufe kommen zwischen `DISCONNECTING` und `ENDED`? | J3 |
| MS27 | Liefert `subscribe(SHARE)` bei `Sharing_Other_Share_Begin` sofort oder zuerst 29 (`noShareData`)? | E9 |
| MS28 | Welche Kennung trägt der Freigabe-Ton (`shareAudioLastId`), gleich der `userid` aus `ZoomSDKSharingSourceInfo`? | E4 |

Entfallen: **MS29** („Kommt `RawData_Off` innerhalb von `unSubscribe()` oder danach?“, Restrunde RR2). Er war nicht messbar: `slotStats` hat keinen Zähler für verworfene Status-Rückrufe (6.3), der Riegel verwirft beide Fälle gleich (6.10), und D1 und G1 hatten kein Feld dafür. Funktional hängt nichts daran; AN22 bleibt als Annahme ohne Folge.

---

## 18 · Offene Fragen an den Owner

Offen sind FR1 bis FR4 und FR6 bis FR13; FR5 ist entfallen (unten). Keine Frage blockiert den Beginn der Umsetzung; der setzt die Owner-Freigabe dieser Spec voraus (13). Die Vorgabe einer Frage gilt, bis der Owner anders entscheidet, mit einer Ausnahme: Die Vorgabe von FR11 änderte Owner-Entscheidungen aus Abschnitt 2 (O2, Release), darum gilt dort bis zur Antwort Abschnitt 2. Wann welche Frage dazukam oder sich änderte, steht in Abschnitt 21.

| # | Frage | Vorgabe der Spec (Empfehlung) | blockiert |
| --- | --- | --- | --- |
| FR1 | **Übergang und alte Companion-Befehle (B.1, B.4; geändert):** Es gibt keine gespeicherten Personen-Quellen, die zu Slots werden könnten (0.1). Reicht es, dass „Als Slot laden“ einen gespeicherten Teilnehmer-Slot mit dem bisherigen NDI-Namen „JM Connect – Zoom ‹Name›“ anlegt und `zoom_load` einen **vorübergehenden**, der wie in 0.3.0 nur bis zum Ende des Meetings gilt und den `zoom_unload` löscht? | Ja (E13, 7.2). So „funktionieren die bestehenden Befehle weiter“ (B.1, B.4): Nacheinander geladene Sprecher sammeln sich nicht als gespeicherte Slots an, kein späteres Meeting startet sie von selbst, F14 kommt nur bei 16 belegten Slots in einem Meeting, und am Rechner wird kein Name gespeichert, den nur Companion geladen hat. Wer einen solchen Slot behalten will, drückt „Behalten“. Die erste Fassung legte dauerhafte, eingeschaltete Slots an (Nachbesserung B1). Zum ausgeschalteten dauerhaften Slot gleichen Namens siehe FR10. | nein |
| FR2 | **Vorgabe 720p (B.2, S1; verengt):** Die ehrliche Anzeige ohne Herabstufung ist durch B.2 entschieden. Offen ist nur: Bleibt die Vorgabe für neue Slots 720p, bis der Lasttest Zahlen liefert? | Ja: Vorgabe 720p, Entscheidung über Vorgaben oder Warnungen in 0.4.1 nach MS10 und MS24 (Nachbesserung B7). | nein |
| FR3 | **Höchstzahl Slots:** Der Entwurf nennt keine. Companion braucht eine feste Zahl (0.9). | 16 (höchste Zahl in #261). Mehr heißt: neue Capabilities und ein neues Companion-Modul. | nein |
| FR4 | **Doppelter Computerton (B.2, O4; verengt):** Dass der Computerton zum Ton „dazukommt“, entscheidet B.2; die Bridge addiert Mischton und Computerton (6.13). Offen ist nur: Was soll 0.4.1 tun, wenn MS9 zeigt, dass der Mischton den Computerton schon enthält? | Dann schaltet 0.4.1 bei Mischton den Computerton ab und sagt das an der Kachel; der Bediener kann für „nur Computerton“ den Meeting-Ton ausschalten (Ton-Abbildung 7.1) (Nachbesserung B7). | nein |
| FR6 | **„Ton aus“ und der Computerton (B.2, B.4; neu, Nachbesserung B2, B57):** B.2 nennt den Computerton als abschaltbaren Zusatz, B.4 „Ton an/aus“ je Slot. Soll in der Karte „Ton“ (Meeting-Ton) und „Computerton“ getrennt schaltbar bleiben, mit „Companion: Ton aus“ als Hauptschalter, der beide abschaltet und „Ton an“ den vorigen Stand wiederherstellt? Oder soll schon der Schalter „Ton“ in der Karte den Computerton mitschalten (dann braucht „nur Computerton“ eine eigene Tonart)? | Getrennt in der Karte, Hauptschalter in Companion, `zoom_slot{n}_audio` = „Ton eingeschaltet, Computerton eingerechnet“ (7.1, 8.2, 8.3). So bleibt „nur Computerton“ (Freigabe mit Ton, Meeting-Ton über einen anderen Weg) ohne neue Tonart möglich, und keine Anzeige sagt „aus“, während die Quelle klingt. | nein |
| FR7 | **`zoom_alarm`, wenn eine gezeigte Person geht (neu, Nachbesserung B12):** In 0.3.0 hob ein Gast, der ging, den Alarm (verwaistes Abo, `soll.ts:139-162`, Handbuch `tool-jm-connect.md:94`). Soll das bleiben? | Ja: Ein Teilnehmer-Slot, der in diesem Meeting die eingestellte Person schon zeigte und sie verloren hat, zählt in o (10.1); nach dem Umstellen auf eine andere Person oder aus einem anderen Modus erst, wenn er die eingestellte Person gezeigt hat (7.3 Nr. 7; Restrunde RR9, Fünfte Runde N4). Ein Slot, dessen Person in diesem Meeting nie da war, zählt nicht (0.12). Die erste Fassung behauptete fälschlich, `zoom_alarm` behalte ohne diese Regel seine Bedeutung. Alternative: kein Alarm beim Weggang, dann in Handbuch und Notes als geänderte Bedeutung nennen. | nein |
| FR8 | **Sprecher-Signale ohne Ton (neu, Nachbesserung B36):** Kommen die Sprecher-Signale nur, wenn die Bridge per `JoinVoip` am Ton teilnimmt (MS22), steht ein Sprecher-Slot ohne jeden Ton-Slot auf T26. Soll 0.4.1 dann beim ersten Sprecher-Slot stumm `JoinVoip` ausführen, obwohl die Bridge bisher bewusst nur mit Ton-Abo am Ton teilnimmt (`audio.cpp:194-196`)? | Erst messen (Abnahme D5; schon der empfohlene interne Lauf misst MS22, 20), dann entscheiden; 0.4.0 baut nichts davon, auch wenn der Lauf das Ergebnis vor dem Release liefert. Kommt „nein“ heraus, empfiehlt die Spec den stummen Beitritt mit Anzeige an der Kachel. | nein |
| FR9 | **Kriterium „schafft dieser Rechner“ im Lasttest (neu, Nachbesserung B73):** Der Entwurf verlangt die Antwort (B.6), aber kein Kriterium. | Vorschlag in 12: mindestens 90 % der Bildrate aus Stufe 1, `fallbackFps` 0 bei laufendem Bild, keine verworfenen Ton-Pakete oder Zoom-Ereignisse, Bild und Ton im Switcher ruckelfrei. Grund: Maßstab ist derselbe Slot auf demselben Rechner in Stufe 1, also zählt nur, was die Last kostet; die 90 % sind gewählt, nicht gemessen, als Spielraum für Schwankungen, die schon ein einzelner Slot zeigen kann (**Annahme**); `fallbackFps` 0 heißt, bei laufendem Bild schiebt sich nie ein Ersatzbild dazwischen, das im Switcher als Flackern sichtbar wäre. Die Betriebsgröße ändert erst eine Owner-Entscheidung nach der Abnahme. | nein |
| FR10 | **`zoom_load` auf einen ausgeschalteten gespeicherten Slot (neu, Restrunde RR7):** Gibt es für den Namen schon einen dauerhaften Teilnehmer-Slot, der aus ist, schaltet `zoom_load` ihn ein, statt einen vorübergehenden anzulegen (8.3), damit der bisherige Mischer-Eingang seine Quelle behält. Soll dieses Einschalten wie jedes `zoom_load` nur für dieses Meeting gelten (FR1), oder dauerhaft wie die Start-Taste? | Nur für dieses Meeting (`anNurMeeting`, 7.2): gespeichert bleibt `an: false`, mit dem Meeting-Ende ist der Slot wieder aus, die Kachel zeigt T96b mit „Behalten“. Sonst startete der Slot nach einem einzigen Companion-Druck in jedem späteren Meeting von selbst und hielte die Zustimmung über 5, genau was 0.25 für `zoom_load` ausschließt. Alternative: dauerhaft einschalten und das in Handbuch und Notes als Ausnahme nennen. | nein |
| FR11 | **Interner Live-Messlauf als Schranke (geändert, Sechste Runde RN2):** 20 empfiehlt zwischen Plan A und dem Release einen kurzen Lauf im echten Meeting. Soll er eine **Schranke vor dem Release** werden? **Ein „ja“ ändert O2 und die Release-Entscheidung vom 15.10. (Abschnitt 2):** Dort liefert der erste Live-Test über den Launcher die Zahlen, und was die Messung zeigt, korrigiert ein 0.4.1; mit der Schranke wartet der Release auf einen internen Lauf, und ein Fund kann schon in 0.4.0 eingehen. Darum gilt hier bis zur Antwort Abschnitt 2: Der Lauf ist empfohlen, keine Voraussetzung (13 Nr. 1). | Ja, als Schranke zwischen dem Ende von Plan A (Bridge) und dem Release, **nicht** vor dem Ausbau von Plan B (B baut gegen die Attrappe weiter, 20). Grund: Ohne Schranke liegen die Ergebnisse erst nach dem Pre-Release vor, und der erreicht jeden Raum-PC (RS9). Folge je Messpunkt: MS21 negativ → der Owner entscheidet zwischen der Rückfallebene RS15 (Umbau des Bildwegs) schon in 0.4.0 und in 0.4.1; MS22 negativ → FR8, das Ergebnis liegt nur früher vor; ein Absturz oder ein nicht abgefangener Rückruf bei MS25/MS26 → Befund an den Owner vor dem Release; MS5, MS7 und MS27 verlangen keinen Umbau, weil die Spec beide Ausgänge abdeckt (RS3, RS13, 6.10), sie liefern Zahlen für 0.4.1. Termin mit dem Owner: Host im Zoom-Client, ein zweites Gerät, eine Person, die den Bildschirm teilt; MS10 damit nur als Vorabwert (20). Alternative: keine Schranke, wie heute in Abschnitt 2 (O2, Release; RS9). | nein (den Beginn nicht; den Release nur nach „ja“, 13 Nr. 1) |
| FR12 | **Zoom-Review: die Roadmap-Entscheidung E7 (geändert, Sechste Runde RN1):** Die Roadmap führt E7 („vorher bauen“ A oder „als kommende Fassung einreichen“ B, Empfehlung B) offen beim Owner (`docs/roadmap.md:180-182`, `:438`); eingereicht wird nach den Entscheidungen E1–E6 (`:173`). Die Spec nahm bis zur fünften Runde an, E7 sei durch den Bau „faktisch A“; das gälte nur, wenn vor dem Bau niemand einreicht, und die Owner-Reihenfolge lässt davor Zeit (Abschnitt 2). Bleibt es bei B? Nicht mehr gefragt, weil schon entschieden: Das Nachziehen der Review-Unterlagen ist **kein Teil dieses Releases**, sondern Folgepunkt FP1 (Entwurf 15.10.: „nicht Teil dieses Releases, als Folgepunkt notieren“; Entwurf 17.10., C: „als Folgepunkt“). | Wie die Roadmap: B. Grund: Die Spec und ihr Plan hängen von der Antwort nicht ab, und FP1 gilt in beiden Fällen vor der Einreichung. Bei B beschreiben die Unterlagen die Freigaben schon heute als kommende Fassung, samt Zusagen, die 0.4.0 ändert (Name nur in Connect und im NDI-Namen, kein Mischton; FP1); sie werden also vor einer Einreichung nach B auf den Stand der Slots gebracht, auch wenn das vor dem Bau liegt. Bei A wird nach dem Bau eingereicht. Der Pre-Release wartet in keinem Fall darauf. In die Roadmap kommt die Antwort erst, wenn sie vorliegt (D11). | nein |
| FR13 | **FP1 und FP2 der iveo-Spec (neu, Sechste Runde RN3):** Die vom Owner am 17.10.2026 bestätigte Vorgabe zu OF1 der iveo-Spec endet mit „FP1 und FP2 als nächster Connect-Schritt.“ (iveo-Spec auf `feat/iveo-paket` @ `0b5fe80c32`, Z. 1504). FP1 dort ist NDI für Connect auf dem Mac (Z. 1452), FP2 eine Anzeige von NDI-Ausfällen auf Windows und Mac; heute steht ein gestorbener Gast-Sender nur im Log, und das Programm-Abzeichen verschwindet ohne Text (Z. 1453; `apps/connect/src/main/ndi-guests.ts:38-79`, `apps/connect/src/main/ndi-program.ts:69-74`, `apps/connect/src/renderer/src/App.tsx:611-620`). Nach der Owner-Reihenfolge (Abschnitt 2) ist Connect 0.4.0 der nächste Connect-Release. Gehören die beiden Punkte in 0.4.0, in ein Connect 0.3.x davor oder in einen eigenen Schritt nach 0.4.0? | Eigener Connect-Schritt direkt nach 0.4.0, mit eigener Spec, FP2 zuerst (er betrifft auch Windows). Grund: 0.4.0 ist schon der größte Connect-Release (nativer Umbau, Lasttest); FP1 hängt an Lizenz und Download des NDI-SDK für Apple in der CI und an der offenen Variante C (iveo-Spec Z. 1452, 1504); FP2 betrifft anderen Code als die Slots, mit eigenen Texten und Abnahme-Schritten, die diese Spec nicht hat. Alternativen: FP2 in 0.4.0 (dann neue Teile in 7, 9, 10, 11 und 12, deren Texte mit dieser Spec freigegeben werden, E31); beide als Connect 0.3.x vor 0.4.0 (ändert die Owner-Reihenfolge). | nein (den Beginn nicht; bei „in 0.4.0“ wächst Plan B, 20) |

Entfallen: **FR5** (Pre-Release auf allen Raum-PCs). Die Frage war schon entschieden (Owner 15.10., Abschnitt 2, „bewusst vor der Abnahme“) und steht jetzt als Risiko RS9 (Nachbesserung B7).

---

## 19 · Folgepunkte (nicht Teil von 0.4.0)

| # | Punkt | Grund |
| --- | --- | --- |
| FP1 | Zoom-Review-Unterlagen (`spike/zoom-obf` @ `655763ecdc`, `docs/zoom-marketplace/`) **vor jeder Einreichung** nachziehen; kein Teil dieses Releases, der Pre-Release wartet nicht darauf (Entwurf 15.10. und 17.10., FR12). Bildschirmfreigaben sind gebaut (dort „upcoming version“, `01-listing-scope-test.md:132`, `02-privacy-terms-support.md:147`), dazu der aktive Sprecher; NDI-Namen sind frei benannt statt des festen Musters `JM Connect - Zoom <display name>` (`03-technical-design-security.md:179`). Ausdrücklich **drei Widersprüche** zu den Unterlagen: (1) **Namen auf der Platte:** Teilnehmer-Slots speichern einen Anzeigenamen in `connect-settings.json` (0.14); die Unterlagen sagen „In memory only, while the meeting session runs“ (`02-privacy-terms-support.md:161`). (2) **Namen im STATE:** `zoom_slot{n}_target` gibt den Namen an Companion (0.13); die Unterlagen nennen Namen nur „in JM Connect and in the NDI source name“ (`:150`, `:165`). (3) **Mischton:** 0.4.0 nutzt ihn (6.13); die Unterlagen sagen „does not use … the mixed meeting audio“ (`:168`, ebenso `:81`). Das gilt für beide Antworten auf die offene Roadmap-Entscheidung E7 (`docs/roadmap.md:180-182`, `:438`; FR12): Bei B werden die Unterlagen vor der Einreichung auf den Stand der Slots gebracht, auch wenn das vor dem Bau liegt, denn sie beschreiben die Freigaben schon heute als kommende Fassung (`:147`, `:150`). | C; 0.13, 0.14; RS11; FR12 |
| FP2 | Rundown: Platzhalter `{slot}` in der Tally und die neuen Aktionen mit seinem nächsten Release | 8.6 |
| FP3 | Issues #257–#260 nach der Abnahme kommentieren; ihre 0.5.0-Teile (Galerie, fps, Dolmetscher, QoS, Logo) bleiben offen | 13 Nr. 12 |
| FP4 | NDI-Sender über Entzug und Wiederbeitritt mit Ersatzbild halten, damit der Mischer-Eingang auch dann nicht abreißt | Nicht-Ziel; MS17 entscheidet, ob es nötig ist |
| FP5 | Späte Bilder nach dem Umhängen über `GetSourceID()` verwerfen | nach MS4 |
| FP6 | Reine Ton-Freigaben (Computerton ohne Bild) routen | Nicht-Ziel |
| FP7 | Anmeldung im Launcher (eigene Spec), ersetzt Proxy-Key und Zoom-Zugangsdaten in Connect | B.9 |
| FP8 | UX-Welle 2: Slot-Bereich, Kachel und Messwerte auf `@jm/ui` | B.9; Bausteine schon getrennt (7.5) |
| FP9 | Einsatzpaket `zoom-bridge-v0.1.0` zurückziehen, sobald Connect 0.4.0 im Live-Betrieb lief | ST4 F5 |
| FP10 | FP1 und FP2 der iveo-Spec (NDI für Connect auf dem Mac; Connect zeigt Ausfälle von NDI an, auf Windows und Mac): nach Vorgabe von FR13 ein eigener Connect-Schritt direkt nach 0.4.0, mit eigener Spec (Sechste Runde RN3) | iveo-Spec Z. 1452, 1453, 1504 („als nächster Connect-Schritt“); FR13 |

---

## 20 · Schnitt für die Pläne (Vorschlag)

Eine Spec, ein Release, zwei Pläne:

| Plan | Inhalt | Ende |
| --- | --- | --- |
| **A · Bridge** | Abschnitt 6 vollständig, Tests 11.1–11.3 und die Bridge-Zeilen von 11.10, CI-Schritt 11.9, Doku D1–D7, D15, D16 | `npm run selftest` und `npm run logik-test` grün, lokaler Bau, `slot-test`; Prüfstände gegen die echte EXE ohne Meeting (`command-probe`); Gegenprobe je neuem Fall im Aufgabenbericht |
| **B · Connect und Companion** | Abschnitte 7–10, Tests 11.4–11.7, 11.11 und die Connect-Zeilen von 11.10, Handbuch und Doku D8–D12, Abnahme-Datei, Release | Release `connect-v0.4.0` und Modul 0.3.0, nach „ja“ auf FR11 erst nach der Schranke (unten); Gegenprobe je neuem Fall und Verbleib jedes alten Testblocks im Aufgabenbericht |

**Beginn** (Owner-Reihenfolge 17.10.2026, Abschnitt 2; Builder-Check, Frage 2; Sechste Runde RN11, RN13–RN15): Erste Bedingung ist die Owner-Freigabe dieser Spec (E31). Die Umsetzung beginnt erst nach dem Merge des iveo-Pakets; in derselben Reihenfolge steht davor auch die Umsetzung der Geführten Anleitungen im Launcher. Vor dem ersten Plan-Schritt wird der Branch auf das dann aktuelle `main` neu aufgesetzt, und jede Fundstelle dieser Spec in einer Datei, die `git diff --stat a9553defe7 <neuer main>` zeigt, wird neu gemessen. Heute absehbar sind: die Selbsttest-Kette in `apps/connect/package.json` (11.4, 11.10; Version Kopf und 13 Nr. 2), `packages/cookbook/content/tool-manuals/tool-jm-connect.md` (0.13, 5.7 Nr. 4, 14 D8, FR7), die Connect-Beschreibung in `packages/suite-manifest/suite.json` (Kopf, 13 Nr. 4), `packages/suite-manifest/changelog.json` (Kopf, 13 Nr. 3; auch ein Launcher-Eintrag der Geführten Anleitungen verschiebt die Zeilen, der Block `launcher` steht vor `connect`, `:31` gegen `:1648`), `.github/workflows/ci-checks.yml` (Kopf, 0.19, 5.1 Nr. 15, 8.5 Nr. 1, 11.4, 11.9), `.github/workflows/connect-mac.yml` (0.24, 13 Nr. 9–10), `apps/launcher/src/main/release-source.ts` (5.7 Nr. 2, 8.5 Nr. 5, 13 Nr. 11; das iveo-Paket zieht die Wahl nach `release-wahl.ts`, iveo-Spec Z. 885-889), `services/release-proxy/worker.js` (5.7 Nr. 2 und 3, E28, 13 Nr. 4; neue Wahlregel, iveo-Spec Z. 895) und `docs/roadmap.md` (Kopf, 13 Vorspann, 14 D11, FR12, FP1; iveo-Spec Z. 1445). Der Mac-Weg ist Variante A der iveo-Spec (OF1); ein Wechsel auf C ändert die Stellen zum Mac-Bau (0.24, E28, 7.11, 13 Nr. 9–10) und den Mac-Prüfschritt in der Selbsttest-Kette und wird dann dort nachgezogen (13).

B baut gegen die Attrappe und braucht von A nur den Protokollvertrag (6.2, 6.3); beide können darum nach dem gemeinsamen Protokoll-Schritt parallel laufen. **Interner Messlauf** (Builder-Check, Frage 3; FR11; Sechste Runde RN2, RN9): Empfohlen ist zwischen dem Ende von Plan A und dem Release ein kurzer interner Lauf im echten Meeting (MS5, MS7, MS10, dazu nach der Nachbesserung MS21 Doppel-Abo, MS22 Sprecher ohne Ton, MS25/MS26 Renderer bei Wiederverbindung und Meeting-Ende, MS27 Freigabe-Abo), weil er die riskantesten Annahmen früh misst. Plan B wartet nicht darauf und baut weiter. Termin mit dem Owner: Host im Zoom-Client, ein zweites Gerät, eine Person, die den Bildschirm teilt. Damit gibt es zwei bis drei Kamera-Quellen; MS10 liefert so nur Vorabwerte für Stufen mit höchstens so vielen Slots, wie Quellen die Stufe allein liefern (Regel unter der Lasttabelle in 12); für #261 zählt erst die Abnahme (Gruppe K). Das Ergebnis steht je Messpunkt in einem eigenen Bericht des Laufs. **Schranke vor dem Release** wird der Lauf erst, wenn der Owner FR11 mit „ja“ beantwortet; dann wartet der Release (13 Nr. 1), bis der Lauf gemacht und ausgewertet ist und jede Folge nach FR11 feststeht (bei negativem MS21 die Entscheidung des Owners zwischen RS15 schon in 0.4.0 und in 0.4.1). Bis dahin gilt Abschnitt 2 (O2, Release): Was der Lauf zeigt, korrigiert ein 0.4.1, und der Bericht geht an den Owner. Der Lauf ersetzt die Abnahme nicht; die Abnahme (12) misst dieselben Punkte am veröffentlichten Pre-Release erneut.

---

## 21 · Nachbesserung nach der Spec-Prüfung (17./18.10.2026)

Grundlage: 91 bestätigte Befunde der Prüfung (Prüfer Entscheidungen, Code, SDK, Wahrheit, Test/Abnahme/Release), je mit Gegenprüfung; zwei weitere Befunde waren widerlegt und sind nicht umgesetzt. Jeder Befund wurde vor dem Umsetzen kurz selbst nachgeprüft, an den genannten Stellen in Code, Header oder Entwurf. Wo ein Befund vom freigegebenen Entwurf abwiche, steht statt einer stillen Änderung eine Owner-Frage (Abschnitt 18). „Umgesetzt“ heißt: in dieser Spec geändert, nicht im Code.

| B | Schwere | Ergebnis | Grund (eigene Nachprüfung) | Ort |
| --- | --- | --- | --- | --- |
| B1 | kritisch | umgesetzt | `soll.clear()` bei Beitritt und Meeting-Ende bestätigt (`kern.ts:1187`, `:1217`). Die erste Fassung machte `zoom_load`-Slots dauerhaft; das widersprach B.1/B.4 („funktionieren weiter“). Jetzt vorübergehende Slots, `zoom_unload` löscht sie, keine Ansammlung, kein F14 über Shows. | 0.1, 0.25, 7.2, 7.3 Nr. 8, 8.3, 8.4, PK11, PK13, FR1 |
| B2 | wichtig | umgesetzt, Owner-Frage | Abbildung `tonAn`/`tonArt`/`computerton` → `audio`/`shareAudio` fehlte (6.13 „sonst direkt“). Jetzt Tabelle; Anzeigen zählen den Computerton mit; Companion „Ton aus“ macht still. Welche Lesart von B.2 gilt, ist FR6. | 7.1, 8.2, 8.3, 10.6, T75/T75b, F12, PK14, PK31, FR6 |
| B3 | wichtig | umgesetzt | Spec 10.2/10.5 regelten nur `text`. Regeltabellen für Tonzeile, Messzeile, Vorschau, Fehlerzeile, Teilnehmerliste, Slot-Kopf und T87, alle in der Prüfregel. | 10 (10.5–10.11) |
| B4 | wichtig | umgesetzt | Abbau-Ketten hatten keinen meetingfreien Test; heute bewacht nur der Entzug einen Quelltext-Wächter (`selftest.ts:2755-2758`). Jetzt `abbauPlan` und `umhaengPlan` als reine Funktionen mit PB20/PB21, Wächter für `slotsMeetingEnded`. | 6.10, 6.15, 6.6, PB20, PB21, PT6 |
| B5 | wichtig | umgesetzt | Mit 4 Geräten füllten Stufen 7 und 9 zwangsläufig doppelt. Jetzt mindestens 9 verschiedene Kamera-Quellen, Spalte „verschiedene Quellen“, Kennzeichnung „nicht aussagekräftig“, K12 für MS19. | 12 (Voraussetzungen, K12, Lasttabelle) |
| B6 | wichtig | umgesetzt (Galerie), fps-Teil widerlegt | Ein Renderer je Slot und Bildweg direkt zum Sender (`video.cpp:1575`) hätten 0.5.0 zum Umbau gezwungen (B.8). Jetzt Abo-Liste je Slot (0.4.0: genau ein Eintrag) und Bildweg über den Slot. Die fps-Wahl braucht keinen Umbau (Rate im privaten `fillFrame`, `ndi_sender.cpp:74-87`); Zeile in 15 bleibt. | 0.30, 3, 6.1, 15 |
| B7 | klein | umgesetzt | FR5 war entschieden (Abschnitt 2), FR4 und FR2 durch B.2 teilweise. FR5 → RS9; FR2 und FR4 verengt. | 18, 16 RS9 |
| B8 | klein | umgesetzt | (a) Umbenennung gilt nur für dieses Meeting (`personJetzt`), gespeicherte Person bleibt; (b) Vorgabe „ohne Kamera an“ begründet. | 0.27, 0.28, 7.3 Nr. 6, PK25 |
| B9 | kritisch | umgesetzt | `teilnehmerWeg` fällt heute nur in `videoParticipantJoined` (`video.cpp:1444-1448`), die nicht mehr gerufen wird; gesetzt sperrt es Bild und Ton (`:1535-1538`, `:771`, `:1035`). Jetzt `ZielStand` als Ganzes ersetzt, `teilnehmerWeg` entfällt, Weggang über Ziel 0. | 6.1, 6.7, 6.10 Schritt 6, PB22, PK4 |
| B10 | wichtig | umgesetzt, Teil (b) als Messpunkt | Der Riegel aus I3 galt nur beim Weggang. Jetzt gilt er für jeden Weg über `slotRetarget` (`umhaengen`, `subscribed`); `gapMs` endet am ersten passenden Bild. Ob `RawData_Off` innerhalb von `unSubscribe()` kommt, ist MS29. | 6.1, 6.10, PB23, AN22, MS29 |
| B11 | wichtig | umgesetzt | Die Zielregel konnte nach Weggang der gewählten Anna auf die zweite springen (gegen PK6 und die Owner-Regel, `video.cpp:1311-1319`). Jetzt `gewaehlteId` bei jeder Zielvergabe, Rückkehr nur auf einen nach dem Weggang Beigetretenen, Warteraum zählt mit (wie `soll.ts:79-80`), T13b. | 0.29, 7.3 Nr. 5, T13b, PK6 |
| B12 | wichtig | umgesetzt, Owner-Frage | In 0.3.0 hob ein gehender Gast `zoom_alarm` (`soll.ts:139-162`, `kern.ts:397-413`, Handbuch `:94`). Vorgabe jetzt wie 0.3.0 (`zeigteSchon`); falsche Begründung in 0.12 berichtigt. | 0.12, 10.1, 8.4, PK4, PK29, FR7 |
| B13 | wichtig | umgesetzt | Nr. 2 traf auch SZ7/SZ8. Jetzt Fehlerstand als Eingabe, kein Neustart ohne Handgriff, `slotNoPrivilege` wartet wie Q1, Rücksetzpunkte festgelegt; der Verweis „Regel aus 0.3.0“ ist berichtigt (0.3.0 lud doch neu, `kern.ts:1482-1483`). | 7.3 Nr. 2, PK18, PK19 |
| B14 | wichtig | umgesetzt | Auslöser nach `privilegeRevoked` bei Erlaubnis „ja“ fehlte (heute `kern.ts:1498-1500`). Auslöser ergänzt, neuer Zustand SZ11 `geplant`. | 7.3, 10.1, 7.1, PK28 |
| B15 | wichtig | umgesetzt | `previewMode` fehlte in der Startfolge; jeder Beitritt startet eine neue Bridge (`kern.ts:1160`, `:1393`). Jetzt in S-d; Startwert der Bridge aus; Startwert `fensterSichtbar` aus der Hülle. | 6.16, 7.6, 7.7, PK16 |
| B16 | wichtig | umgesetzt | Rückrufe melden nur Wechsel (`meeting_video_interface.h:234-243`), kein Getter. Sprecher-Erinnerung je Bridge, Vorbelegung jeder neuen `SprecherWahl`, bleibt über den Entzug. | 0.34, 6.8, 6.15, PB19, PB26 |
| B17 | wichtig | umgesetzt | Haltezeit 60 ms > Stille-Schwelle 40 ms (`video.cpp:1020-1035`). Mischer mit eigener Uhr, Stille-Herzschlag für Mischer-Slots aus; der Nebenbefund (bleibender Rückstand) ist damit ebenso behoben. | 0.35, 6.13, PB28 |
| B18 | wichtig | umgesetzt | Thread-Regel kannte keinen dritten Thread, der Vorschau-Puffer lag im Slot. Jetzt `g_vorschau[16]` im Vorschau-Modul, An- und Abmeldung, `previewUs` dort gezählt, quit/EOF beendet den Thread zuerst, Wächter. | 6.1, 6.15, 6.16, PT6 |
| B19 | wichtig | umgesetzt | 216 Zeilen in `zoom-kern.test.ts` und der Import in `zoom-teile.test.ts:8` hängen an gestrichenen Schnittstellen. Verbleibstabelle je Block, Laufzeit und Wache. | 11.10, 11.4 |
| B20 | wichtig | umgesetzt | `merkerVerworfen` fehlte in `bridgeStats` (6.3) und T61; `mixDrops`, `audioPps` ohne Zeile. Ergänzt; Logfelder festgelegt. `audioRate`/`audioCh` standen schon in T58c (Teil widerlegt). | 6.3, 6.5, 6.17, 7.8, T61, T62 |
| B21 | klein | umgesetzt | `emitRaw` steht in `emit.cpp:5-25` (nachgeprüft), nicht `:33-53`; Base64-Aufschlag ergänzt (rund 340 KB/s). | E14, 6.16, AN7 |
| B22 | klein | umgesetzt | Übergangsname konnte E26 verletzen. Namensregel: „:“ → Leerzeichen, Steuerzeichen weg, 60 Code-Punkte, Kollision nach `gleicherNdiName`. | 7.2, PK35 |
| B23 | klein | umgesetzt | Kern liest keine Einstellung selbst (`kern.ts:7`, `:123-132`). Erweiterung der Abhängigkeiten und `onVorschau` benannt. | 7.10, 7.7 |
| B24 | klein | umgesetzt | Sammelfall `{ ev: string }` (`src/protocol.ts:219`) verdeckt veraltete Zweige. Pflichtliste ergänzt, Quelltext-Test. | 7.10, PK33 |
| B25 | klein | umgesetzt | Nur Person-Ton und beim Freigabe-Wechsel der Computerton werden neu zugeordnet. | 6.10 Schritt 8 |
| B26 | klein | umgesetzt | `readStringValue` übernimmt `\u` wörtlich (`session.cpp:751-773`, nachgeprüft). Code-Punkte auf beiden Seiten; die Bridge weist `\u`-Folgen ab. | E26, 6.2, PK24 |
| B27 | klein | umgesetzt | Muster `selftest.ts:2713` nachgeprüft; um `ndi`, `ndiName`, `source` erweitert. | PT6 |
| B28 | klein | umgesetzt | AN10 teils belegt (`meeting_participants_ctrl_interface.h:96-101`); `user_id` des Freigabe-Tons als Annahme AN18 mit Messpunkt. | 5.3, 6.13, AN10, AN18, MS28 |
| B29 | klein | umgesetzt | Reducer-Zweig für `videoStatus`; `slotNrn` als Liste. | 7.10, 10.10, PT1, KF4 |
| B30 | wichtig | umgesetzt | 29 und 30 (`zoom_sdk_def.h:102-105`, nachgeprüft) fehlten. Eigene Regeln, `rendererNew` nur bei Typwechsel, `rawType`, Messpunkt MS27. | 5.3, 6.10, 6.17, PB21, Abnahme E9, MS27 |
| B31 | wichtig | umgesetzt | `RawData_Off` nach `unSubscribe` gemessen (`video.cpp:45-51`), ohne Riegel. Riegel für alle Wege, `cameraOff` nur aus Zooms Meldung (`IsVideoOn`, `videoStatus`), Freigabe nie `cameraOff`, `IsVideoOn` nach jedem Umhängen. | 6.7, 6.9, 6.10, 6.12, PB23, PB24 |
| B32 | wichtig | umgesetzt | `onRendererBeDestroyed` (`rawdata_renderer_interface.h:36-40`, nachgeprüft) war nicht erwähnt. Merker `rendererTot`, Zeiger nie mehr anfassen, neuer Renderer mit neuem Delegate, `rendererLost`, MS25. AN11 bleibt für die Synchronität. | 5.3, 6.1, 6.5, 6.10, 6.15, RS16, AN25, MS25 |
| B33 | klein | umgesetzt | `INMEETING`-Arbeit setzt jetzt einen Merker; `SetEvent` bleibt ausdrücklich im Rückruf; Wächter über alle Rückruf-Rümpfe. Die Folgerung „`slotRetarget` aus dem Rückruf“ war widerlegt, darum klein. | 6.5, 6.6, PT6 |
| B34 | wichtig | umgesetzt | Folge `disconnecting` → `failed` → `ended` gemessen (`session.cpp:252-259`). Renderer-Sperre ab `DISCONNECTING`/`RECONNECTING`; J3 mit laufender Freigabe und Absturzprüfung. | 6.5, 6.10 Schritt 0, 6.15, J3, AN23, MS26, RS17 |
| B35 | wichtig | umgesetzt | Doppel-Abos schließt der heutige Code aus (`video.cpp:322`), im Slot-Modell sind sie Regelfall. Regel ohne Vorrang, T97, Schritt B5, MS21, RS15 mit Rückfallebene. | 6.10, T97, 12 B5, AN21, MS21, RS15 |
| B36 | wichtig | umgesetzt, Owner-Frage | `JoinVoip` nur über den Ton-Weg (`session.cpp:552-563`, `audio.cpp:203`). AN17, MS22, Abnahme-Schritt D5; Ausweg erst nach Messung (FR8). | 6.8, 6.13, Abnahme D5, AN17, MS22, RS18, FR8 |
| B37 | wichtig | umgesetzt | `contentType` wurde nicht ausgewertet; Header nachgeprüft (`meeting_sharing_interface.h:60-65`, `:162-164`). Typ im Eintrag und in `shares`, Typ-Nachtrag ohne neues `seq`, `COMPUTER_AUDIO` als `audioOnly`, PB27, Abnahme E8, MS23. | 6.3, 6.5, 6.9, PB27, Abnahme E8, MS23 |
| B38 | wichtig | umgesetzt | Befüllen hätte bekannte Einträge gelöscht (`meeting_sharing_interface.h:440`, nachgeprüft). Einschalten ergänzt nur, Leeren nur bei `INMEETING`, Reihenfolge als AN20, Abnahme-Schritt E6. | 6.9, PB15, Abnahme E6, AN20, MS3 |
| B39 | wichtig | umgesetzt | Freigabe-Ton wird vor der Zuordnung gezählt; T64 und T64c getrennt; Annahme AN18, MS28. | 6.3, 6.13, T64c, AN18, MS28 |
| B40 | wichtig | umgesetzt | `GetUserVideoSize`, HD-Einstellungen, `recvResolution` im Header nachgeprüft; als Messwerte (nicht Tatsache), Voraussetzungen 1080p, MS24. | 5.3, 6.11, 6.17, T62b, 12, AN24, MS24 |
| B41 | klein | umgesetzt | 12 Methoden (`meeting_video_interface.h:219-289`, nachgezählt), „übrige 7“. | 6.5 |
| B42 | klein | umgesetzt | Drei Belege berichtigt (Chat-Fäden, `bWithInterpreters`, `isMyVoiceInMix` mit `memset`), nachgeprüft. | 5.3, E10, 6.13 |
| B43 | klein | umgesetzt | Einbindereihenfolge `meeting_service_interface.h` vor `meeting_sharing_interface.h` (nachgeprüft: `:7`, `:319`; `meeting_service_interface.h:620`, `:634`). | 6.5 |
| B44 | klein | umgesetzt | wie B20. | 6.3, T61 |
| B45 | klein | umgesetzt | Kennung 0 als Annahme AN19, Nachzug über den Typ-Nachtrag, MS6 erweitert. | 6.9, AN19, MS6 |
| B46 | klein | umgesetzt | `held` nur mit Kopie dieses Ziels, sonst `fallback/sharePaused` (T29d). | 6.9, 6.12, T29d, PB29 |
| B47 | klein | umgesetzt | Vergleich über die kürzere Seite, Freigabe ohne T51, PK-Fälle 960×720, 720×1280, 1920×1200. | 10.7, PK15 |
| B48 | klein | umgesetzt | Zweite Hälfte von MS2 gestrichen; `getResolution()` als `resGot`; Schritt G2. | 6.10, 6.11, MS2, G2 |
| B49 | klein | umgesetzt | D3 prüft beide Zustände je Signal; MS7 erweitert. | D3, MS7 |
| B50 | wichtig | umgesetzt | T12b nur mit `liefSchon` (sonst T12d), T11g „Läuft nicht“, T35/T36 „ausgeschaltet“. | 9.2, 9.3, 10.2 |
| B51 | wichtig | umgesetzt | `subscribeFailed` zählt in o; T20c nennt den Handgriff; Gegenprobe PK30. | 10.1, T20c, PK30, 11.8 |
| B52 | wichtig | umgesetzt | Herzschlag setzt heute `cameraOff` ohne Zoom-Meldung (`video.cpp:1190-1192`, nachgeprüft). Neuer Grund `noFrames` (20 Werte), „Kamera aus“ nur aus `videoStatus`/`IsVideoOn`. | 0.31, 6.3, 6.7, 6.12, 10.2, T19b, T27b, T29e, PB24 |
| B53 | wichtig | umgesetzt | Kopie nicht ans Ziel gebunden; Widerspruch 6.10/6.12 aufgelöst. `kopieGueltig`, Vorschau mit Ziel, Verwerfen bei Ziel- und Moduswechsel. | 6.1, 6.12, 6.16, 7.7, PB29 |
| B54 | wichtig | umgesetzt | Feld `sent` im `slot`-Ereignis; T60 neu gefasst; Vorschau-Malerei aus `sent`. | 6.3, 6.12, 7.7, T60 |
| B55 | wichtig | umgesetzt | Messwerte je Fenster und Ziel, Rücksetzregel, T51c. | 6.3, 10.7, T51c, PK15 |
| B56 | wichtig | umgesetzt | `source` = gemessen, `configured` = eingestellt, Zusatz T58g. | 6.3, 6.13, 10.6 |
| B57 | wichtig | umgesetzt, Owner-Frage | wie B2. | 8.2, 8.3, FR6 |
| B58 | wichtig | umgesetzt | wie B3; Erlaubnis (5 Werte), `liefSchon`, Ton- und Messdimensionen in 10.5. | 10.5 |
| B59 | wichtig | umgesetzt | Malerei nur in SZ6 bzw. SZ5, T55 ohne Sender, T55b in SZ4, T57 an jeder Kachel. | 7.7, 10.8 |
| B60 | wichtig | umgesetzt | `doppelt` > 1 nur ohne gültige `gewaehlteId`; PK6 erweitert. | 7.1, 7.3 Nr. 5, 10.1, PK6 |
| B61 | wichtig | umgesetzt | Vorrangfolge, Rücksetzregeln, T23 mit Handgriff, „Erneut beitreten“ als Fortsetzung (wie `kern.ts:1193-1196`). | 7.3, 10.1, T23 |
| B62 | wichtig | teils umgesetzt, teils abgelehnt | Umgesetzt: `merkerVerworfen`, `mixDrops`, `audioPps` sichtbar; Fehler ohne Slot unter „Hinweise“; `Record<SlotFehler, string \| 'keine'>`; `slotAlreadyOn`/`slotNotOn` ohne Text und ohne SZ8. Abgelehnt: Meldung „Bridge passt nicht“ (im Release unmöglich, SHA-256-Abgleich `laufzeit.ts:316-358`) und Anzeige der Host-Anfragen (keine Diagnosen, sondern bewusst unbeantwortete Bitten, `meeting_video_interface.h:228-231`, `:277-282`; `onFailedToStartShare` kann nicht kommen, die Bridge teilt nie). | 7.1, 9.6, PK34 |
| B63 | klein | umgesetzt | T87 zählt nach Antwort oder Frist; Platzhalter umbenannt. | 9.5, 10.11, PK20 |
| B64 | klein | umgesetzt | T11h für Z5a/Z5b. | 9.2, 10.2 |
| B65 | klein | umgesetzt | T86 verweist auf die Kacheln. | 9.5, 10.3 |
| B66 | klein | umgesetzt | Zustandsschwelle 2 s für `held`, getrennt vom Sendetakt; Log gedrosselt; Abnahme E2 „Kachel bleibt ruhig“. | 6.9, 7.8, Abnahme E2 |
| B67 | klein | umgesetzt | `slotNrn` aus dem Ziel der Bridge, Texte T39c, T39d, mehrere Nummern. | 10.10, 9.3 |
| B68 | klein | umgesetzt | Q10 → T46, Q11 → T13/T13b, Q15 → T98; T30 ohne Verweis ins Leere. | 9.3, 9.7 |
| B69 | klein | umgesetzt | T92 gleich `TEXT_A4_SCHREIBFEHLER` (nachgeprüft, `zoom-text.ts:19`), kHz einheitlich, Quellen für {p}/{g}, Präfix „S“ im Test, Singularformen, `resSet` über `sdkErrorName`. | 9 |
| B70 | klein | umgesetzt | Jedes Einschalten von Ton ruft `audioEnsureSubscribed()`; Ton-Fehler an allen Kacheln mit Ton. | 6.13, 7.1, T104 |
| B71 | klein | umgesetzt | SZ10 → eigener Wert `zurueckgestellt`; f14 in 8.4 genannt. | 8.1, 8.2, 8.4 |
| B72 | klein | umgesetzt | Bereits gesichert: `starteBridge` wartet auf alle alten `stop()` (`kern.ts:955`, nachgeprüft); jetzt in der Spec festgehalten. | 7.3 Nr. 10, 10.1 |
| B73 | klein | teils umgesetzt | MS10 auf 720p/1080p gekürzt (Entwurf B.6); Kriterium „schafft“ als Vorschlag mit FR9. Abgelehnt: Spalte „Ergebnis → Folge“ je Messpunkt (O2 verlangt sie nicht; die Folgen stehen in RS, FR und 13 Nr. 12) und Ableitung der Betriebsgröße durch die Spec (Owner-Entscheidung, `zoom-text.ts:40-41`). | 12, 17.2, FR9 |
| B74 | wichtig | umgesetzt | wie B19. | 11.10 |
| B75 | klein | umgesetzt | 11.8 als Pflichtauswahl gekennzeichnet; Gegenprobe je übrigem Fall im Aufgabenbericht. | 11, 11.8, 20 |
| B76 | wichtig | umgesetzt | Umhäng-, Abbau- und Ton-Entscheidung als reine Funktionen mit PB-Fällen; Wächter für das Meeting-Ende. | 6.10, 6.13, 6.15, PB20, PB21, PB25, PT6 |
| B77 | wichtig | umgesetzt | wie B3; dazu STATE-Prädikate, `_live`/`_state`/`_target` in Z10/Z11. | 8.2, 10.4 |
| B78 | wichtig | umgesetzt | Fall je Zeile von 7.10 und je reinem Helfer; Preload reicht Nutzlasten als Ganzes weiter (Quelltext-Test). | 7.10, 11.11 |
| B79 | wichtig | teils umgesetzt | (a) Namensregel, (b) wie B1, (d) kleinste Nummer und eingeschränkte Zusage in E13, (f) Schritt A3. (c) widerlegt (kein `await` zwischen Prüfen und Anlegen; jetzt ausdrücklich festgehalten), (e) widerlegt (transparent ist die freigegebene Vorgabe S1). | 7.2, 8.3, E13, 12 A3 |
| B80 | wichtig | teils umgesetzt | Schritte für MS2 (G2), MS4/MS11 (D1), MS6 (E1, T63c), MS9 (E4b), MS15 (H1), MS16 (B2b, T62c), MS18 (D6), MS20 (L1), AN9 (E7), Z10 kurz (J4), Mac (A4). Abgelehnt: eigener Schritt für AN4 (ohne Meeting prüfbar, Header stützt die Annahme, `Processing.NDI.Send.h:68-87`), AN6/AN11 (in H1 und G1 mitgeprüft), #247 Erlaubnis für Freigabe-Rohdaten (E1 beantwortet sie), Dauerlauf G2 aus 0.3.0 (prüfte den JWT-Ablauf, den 0.4.0 nicht ändert). | 12, 17.2 |
| B81 | klein | umgesetzt | Bump erst mit EXE, Modul, beiden DMGs und grünem Mac-Lauf; Abweichung von iveo 10.1 benannt; `--title` im Wettlauf-Zweig. | 13 Nr. 9, Nr. 10 |
| B82 | wichtig | umgesetzt | Notes um Übergang, Datenhaltung, vorübergehende Slots, Modul-Import und Modul 0.2.0 ergänzt. | 13 (Notes) |
| B83 | wichtig | umgesetzt | Konsole stützte sich auf das Umhängen (`cli/steuerung.mjs:181-189`, `:458-459`); LIESMICH verspricht es (`paket/LIESMICH.txt:104-109`, nachgeprüft). Konsole neu festgelegt, Riegel in `build-release.mjs`, README §2–§4 und §10. | 6.18, D13, D15, D16, PT8, PT9 |
| B84 | wichtig | umgesetzt | Doku-Schritt nach der Abnahme (README §7 mit Zahl, Handbuch-Grenzen, Roadmap) vor dem Schließen der Issues. | 13 Nr. 12, D3, D8, D11 |
| B85 | klein | umgesetzt | `after-pack.cjs` wirft nur (nachgeprüft); Erfolgszeile vorgesehen. | 13 Nr. 7 |
| B86 | klein | umgesetzt | `logik-test.mjs` sucht `cl` über `vswhere`/`vcvars64.bat`; lokal ersatzweise `slot-test`. | 11.1, 13 Nr. 1 |
| B87 | klein | umgesetzt | `git diff --stat <Bau> <Merge>` muss vor dem Tag leer sein. | 13 Nr. 9 |
| B88 | klein | umgesetzt | wie B27. | PT6 |
| B89 | klein | umgesetzt | je neuer Stellschraube ein Fall; Drehbuch „Slots“ als benannter Fall. | 11.3, PT7, PK36 |
| B90 | klein | umgesetzt | Job-Rahmen 15 min nachgeprüft (`ci-checks.yml:36`); Wache und Budget festgelegt, Annahme markiert. | 11.4 |
| B91 | klein | umgesetzt | D11 um E7-Folge, Status #227/#247 und die gelebte Release-Folge ergänzt; D8 nennt die Streichungen. | 14 D8, D11 |

Nicht umgesetzt, weil in der Gegenprüfung widerlegt: die Umdeutung „einmal nachfragen“ (0.10 steht offen in Abschnitt 0; die Zustimmung verfällt bei höchstens 5, PK12) und „Modul 0.2.0 gegen 0.4.0 ungeprüft“ (die sieben Schlüssel hält `zoom-kern.test.ts:2942-2943` wörtlich fest; sie bleiben als Teilmenge geprüft, 10.5, 11.6).

### Zweite Runde: Nachfix nach der Nachprüfung (18.10.2026)

Grundlage: Die Nachprüfung der nachgebesserten Fassung fand acht wichtige Widersprüche oder Lücken (W1–W8, kein kritischer; dazu zehn kleine, RR1–RR10 (in der Nachprüfung K1–K10 genannt), die nicht Teil dieser Runde sind und offen bleiben). Jeder Befund ist vor dem Umsetzen an den genannten Stellen in Spec, Code und Header selbst nachgeprüft. Keine Änderung weicht vom freigegebenen Entwurf ab; neue Owner-Fragen entstehen nicht. Neue Texte (T106, Zusatz in T61) gehen mit der Texttabelle zur Owner-Freigabe (9).

| W | Schwere | Ergebnis | Grund (eigene Nachprüfung) | Ort |
| --- | --- | --- | --- | --- |
| W1 | wichtig | umgesetzt | Bestätigt: 6.9 sendete ab 200 ms `held`, 6.12 ließ `sent` nur mit dem Zustand wechseln; zwischen 0,2 und 2 s stand SZ4 mit `held` ohne Regel, T55b begründete falsch, und „bleibt `starting`“ (6.12) widersprach PB29. Jetzt bleibt `sent` ein Sendefakt und wechselt auch bei Beginn und Ende des Haltens (je ein `slot`-Ereignis, keine Logzeile); SZ4 mit `held` gibt es nur bei Freigabe, die Kachel bleibt bewusst bei T28/T28b (B66: ruhig unter 2 s), das Prädikat „Zeigt“ ist entsprechend gefasst, die Vorschau zeigt die letzte Vorschau dieses Ziels statt T55b; vor dem ersten Bild gilt `starting` mit drei benannten Ausnahmen. | 6.9, 6.12, 7.7, 7.8, 10.1, 10.2 (Regel 4, Prädikat), 10.5, 10.8, PB29, 11.8 |
| W2 | wichtig | umgesetzt; für `slotOn` mit anderer Lösung als vorgeschlagen | Bestätigt: Das SDK ruft beim Abbau eines Renderers dessen Delegate (`rawdata_renderer_interface.h:36-40`), der Delegate hält einen rohen Zeiger auf sein `Sub` (`video.cpp:23-30`; künftig auf Slot und Abo, Bildweg 6.1), und 0.3.0 rief bei `leave` stets `unSubscribe`/`destroyRenderer` (`main.cpp:178-200` → `videoShutdownAll`, `video.cpp:625-627`, `:601-605`). Halteliste: Der **ganze** Slot bleibt am Leben, nicht nur das Abo, weil der Delegate auf den Slot zeigt; Abbau nach `INMEETING`, Verwerfen bei `ENDED`/`FAILED` oder nach einem `sessionLeave()` mit `true`, bei quit/EOF nie frei; Zahl in `bridgeStats`/T61. `slotOn` während der Sperre wird mit `slotReconnecting` **abgelehnt statt vorgemerkt**: Connect sendet `slotOn` nur in `im_meeting` (7.3 Nr. 1), steht während der Sperre in Z10 (`kern.ts:1251-1252`) und gleicht nach `inMeeting` ohnehin ab (`:1253-1259`); Vormerken hätte `StartRawRecording` und `createRenderer` nach `INMEETING` mit neuen Fehlerwegen an einem schon gemeldeten Slot gebraucht. | 0.33, 3, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.15, 6.17, 7.1, 7.3 Nr. 2, T61, 9.6, 10.9, 11.3, PB20, PK34, 11.8, RS16, AN25 |
| W3 | wichtig | umgesetzt | Bestätigt: 6.15 leerte beim Entzug die Freigaben, 6.9 leert nur bei `INMEETING`; das Befüllen hängt im Custom-UI-Modus an `ICustomizedShareRender::SetUserID` (`meeting_sharing_interface.h:440`) und kann leer bleiben (AN14). Der Freigabe-Lauscher hängt nicht an der Erlaubnis (6.5). Die Liste bleibt beim Entzug wie die Sprecher-Erinnerung. | 6.9, 6.15, PB20, J1, 11.8 |
| W4 | wichtig | umgesetzt | Bestätigt: 0.3.0 hängte den Anzeigenamen roh an (`video.cpp:189`), NDI ersetzte „:“ und ließ das doppelte Leerzeichen gemessen stehen (`:182-187`); das Zusammenfassen von Leerraum hätte bisherige Namen verändert. Jetzt nur „:“ → Leerzeichen und Steuerzeichen weg, sonst unverändert; `normiereSlot` ändert den Namen nicht. | E13, 7.2, PK35, 11.8 |
| W5 | wichtig | umgesetzt | Bestätigt: Nach 8.3 ändert `zoom_load` nichts, solange ein eingeschalteter Teilnehmer-Slot dieses Namens besteht, und ein neuer vorübergehender Slot bekäme ohnehin „ (2)“ (7.2). A3 ist in A3a („Als Slot laden“) und A3b (`zoom_load` nach Löschen des A3a-Slots) geteilt. | 12 A3a, A3b |
| W6 | wichtig | umgesetzt, erweitert | Bestätigt: `audioQueueOverflow` ist `where:"audio"` ohne Slot (`video.cpp:715-719`), heute Hinweis Q6 (`klartext.ts:293-294`); dazu ist auch `audioBufferMismatch` `where:"audio"` (`video.cpp:822`, heute Q17, `klartext.ts:297-298`), was die Spec gar nicht regelte. T104 nur für die drei Ton-Abo-Fehler; die Rücksetzregel hängt an Ereignissen, die nur mit stehendem Abo kommen (`waiting/command` nach geglücktem `audioEnsureSubscribed()`, wie 0.3.0 `video.cpp:434-454`, und `live`), dazu neue Bridge, Meeting-Ende, „Verlassen“, „Schließen“, Entzug; ein Slot mit eigenem `off/audioUnavailable` behält T104 bis zum Handgriff. `audioBufferMismatch` trägt künftig `slot`, Hinweis T106. | 6.4, 6.13, 7.1, 9.6, 9.7, 10.5, 10.6, 10.9, PK34, 11.8 |
| W7 | wichtig | umgesetzt | Bestätigt: 6.10 Schritt 3 setzte „`fallback` mit dem Grund“, also `modeChanged`/`targetChanged`, während 6.7 `noTarget` sagte; die Kachel-Regeln 6–8 fielen dann auf T20. Jetzt setzt die Bridge an einer Stelle den Ziel-0-Grund nach Modus (deckt `slotOn`, `slotSet`, Moduswechsel und Auflösung); Prädikat zu T20; PK7 prüft die Zeilen wörtlich, PB19 den Grund. | 6.2, 6.7, 6.10 Schritt 3, 6.12, 10.2, PB19, PK7, 11.8 |
| W8 | wichtig | umgesetzt | Bestätigt: Verlangt waren nur zwei 1080p-fähige Quellen; die Ablehnungsgründe des Custom-UI-Containers deuten Grenzen schon bei einem 1080p- oder zwei 720p-Abos an (nur Enum-Namen ohne Doku, `customized_video_container.h:197-198`). Neuer Schritt K0 misst je Quelle allein, was sie in 720p und 1080p liefert; neue Spalte; eine Zeile mit weniger solchen Quellen als Slots gilt für MS10 als nicht aussagekräftig, ihre Lastwerte bleiben gültig. Die Lösung „neun 1080p-Quellen verlangen“ steht als Ziel in den Voraussetzungen, nicht als Bedingung, weil ob das Konto 1080p zulässt, Annahme AN24 ist. | 12 (Voraussetzungen, K0, Lasttabelle), 17.2 MS10 |

### Dritte Runde: Restpunkte RR1–RR10 und Tabellen (18.10.2026)

Grundlage: die zehn kleinen Befunde der Nachprüfung (dort K1–K10, hier RR1–RR10, weil K0–K12 die Schritte des Lasttests in 12 sind und R1–R7 Meldungen und Hinweise aus ST4 benennen, etwa den Hinweis R5 in 10.11; umbenannt in der fünften Runde, N9), die die zweite Runde offen ließ (oben), und der Tabellenfehler bei T62c aus dem Nachfix. Jeder Punkt ist vor dem Ändern an Spec, Code (Stand `a9553defe7`) und, wo nötig, Header nachgeprüft; geändert ist jeweils die kleinste Fassung, die ihn beseitigt, an allen Stellen, die ihn tragen. Keine Owner-Entscheidung aus Abschnitt 2 ist berührt. RR7 braucht eine Owner-Entscheidung: Die Vorgabe ist umgesetzt, die Frage steht als FR10 in Abschnitt 18. Neue Texte (T96b, neue Fassung von T62c) gehen mit der Texttabelle zur Owner-Freigabe (9). Dazu sind alle Tabellen auf ihre Spaltenzahl nach GitHub-Regeln geprüft (jede nicht maskierte senkrechte Linie trennt eine Zelle, auch in Code).

| Punkt | Ergebnis | Grund (eigene Nachprüfung) | Ort |
| --- | --- | --- | --- |
| RR1 | umgesetzt | Bestätigt: `mangelFolgen()` leert in 0.3.0 die Soll-Liste (`kern.ts:530-535`), gerufen bei der Prüfung, beim Beitritt und mitten im Wiederbeitritt (`:1139`, `:1163`, `:1401`, dort nach Z1a); in Z1a, Z1b und Z2 ist `zoom_alarm` fest 0 mit dem Kommentar „ein Mangel bzw. jeder Weg nach Z2 leert die Soll-Liste“ (`zoom-text.ts:280-285`). Die Spec nannte den Mangel nur in 0.1. Jetzt fallen vorübergehende Slots, Fehlerstände, `liefSchon`, `zeigteSchon` und `gewaehlteId` auch mit einem Mangel; Prädikat „in Z1a, Z1b, Z2 kein Slot in o“. | 7.2, 7.3 Nr. 2, 5, 7, 8, 10.4, 10.5, PK11, 11.8, 11.10 |
| RR2 | umgesetzt (Messpunkt gestrichen) | Bestätigt: `slotStats` hat keinen Zähler für verworfene Status-Rückrufe (6.3), der Riegel verwirft „innerhalb“ und „danach“ gleich (6.10), D1 und G1 hatten kein Feld. Ein eigener Zähler hätte Code für eine Frage ohne Folge gebracht; nach der Regel „nur live Messbares wird Messpunkt mit Feld“ entfällt MS29 (Vermerk unter 17.2, wie FR5), AN22 bleibt als Annahme ohne Folge. | 6.10 (Riegel), 17.1 AN22, 17.2 |
| RR3 | umgesetzt | Bestätigt: Die Ketten führen nur den Plan aus (6.15), also stünde `unSubscribe` nie im Text von `slotsMeetingEnded`; PT6 (b) wäre immer grün und die Gegenprobe „Plan mit `Unsubscribe`“ machte nur PB20 rot. Der Wächter prüft jetzt nach dem Muster von `selftest.ts:2755-2758` (Argument des Aufrufs) die Übergabe der Kette an den Ausführer `abbauAusfuehren` und dass dessen Zweige `ZeigerVerwerfen`/`HaltelisteVerwerfen` keine Renderer-Funktion rufen; Gegenprobe getrennt. | 6.6, 6.15, 6.19, PT6, 11.8 |
| RR4 | umgesetzt, erweitert | Bestätigt: Die Kopie in der Bridge entsteht unabhängig von der Vorschau (6.12 „nur, wenn das Ersatzbild `freeze` ist oder …“, 6.16 „nur bei `previewMode on`“); `sent = freeze` ohne letzte Vorschau ergab ein Schachbrett gegen das Prädikat in 10.8. Jetzt leere Fläche mit T53. Gleicher Fall gefunden in SZ5 ohne letzte Vorschau (dort gar nicht geregelt): leere Fläche mit T54. | 7.7, 10.8, 11.8 |
| RR5 | umgesetzt | Bestätigt: Ein Sender der aktiven Bridge kann außerhalb von `im_meeting` bestehen: Z5 nach dem Verschieben in den Warteraum (`kern.ts:1261`), Z4 nach dem Einlass von dort (`:1232`), Z10 und kurz Z12 (`:1337-1338`); `_live` war dort 0, `_state` meldete aber `zeigt`/`gehalten`/`ersatz`. Jetzt gilt für `_state` dieselbe Menge Z6–Z9b wie für `_live`, sonst `wartet`; in Z13 steht die Bridge schon im Abbau (SZ9: `scheitert` ruft `stoppeBridge()` vor `setzeZustand('fehler')`, `kern.ts:1147-1149`, und `stoppeBridge()` trägt die Generation sofort in `imAbbau` ein, `:894`). | 8.2, 10.2 Regel 2 und Prüfung, 10.4, 10.5, 11.8 |
| RR6 | umgesetzt | Bestätigt: 10.6 Regel 2 und 10.7 nannten SZ9 nicht; die Tonzeile fiel durch die Regeln 3–11, die Messzeile auf T51b, weil der Kern `geliefert`/`zuletzt` beim Stopp löscht. Jetzt in SZ9 keine Tonzeile (`tonText = null`, T58h „sobald der Slot läuft“ passte nicht zu einem Slot, der gestoppt wird) und keine Messzeile. | 7.1 (`tonText`), 10.6, 10.7, 11.8 |
| RR7 | umgesetzt mit Vorgabe, Owner-Frage FR10 | Bestätigt: `zoom_load` schaltete einen ausgeschalteten dauerhaften Slot ein und speicherte `an`; der Slot startete in jedem späteren Meeting und hielt die Zustimmung über 5, gegen das Versprechen in 0.25 und FR1. Vorgabe: nur für dieses Meeting (`anNurMeeting`, gespeichert `an: false`, aus zu den Zeitpunkten der vorübergehenden Slots, Kennzeichen T96b mit „Behalten“). | 0.25, 7.1, 7.2, 7.3 Nr. 8, 7.4, 7.5, 7.9, 8.2, 8.3, 8.4, T96b, 10.11, PK11, PK13, 11.5, 11.8, 12 I1, 13 Notes, 14 D8, FR1, FR10 |
| RR8 | umgesetzt | Bestätigt: `ZielStand` enthielt alle Ton-Felder, Schritt 6 ersetzte ihn bei jedem Umhängen, Schritt 8 versprach ungestörten Mischton; der Stille-Herzschlag liest genau diese Felder (`video.cpp:1010-1013`) und beginnt erst nach dem ersten echten Paket (`:999-1004`). Die Ton-Felder stehen jetzt in einem eigenen `TonStand` je Slot, der nur neu beginnt, wo der Ton am Ziel hängt (Person-Ton, Computerton ohne Mischer; beim Mischer nur Eingang B) oder `audio`/`shareAudio` sich ändert. 0.3.0 setzte die Ton-Felder nur bei der Rückkehr einer Person zurück (`video.cpp:1449-1466`), dort war Ton immer Person-Ton. | 6.1, 6.4 (`audioBufferMismatch`), 6.7, 6.10 Schritt 6 und 8, 6.13, 6.19, PB21, PB22, PK4, 11.8 |
| RR9 | umgesetzt, erweitert | Bestätigt: `zeigteSchon` fiel nur mit dem Meeting. Jetzt gesetzt nur von `live` eines Teilnehmer-Slots und gelöscht bei Person- und Moduswechsel. Beim Nachprüfen gefunden: Auch `gewaehlteId`, `wegSeq` und `personJetzt` fielen beim Personenwechsel nicht, und 7.3 Nr. 5 (a) vergleicht keinen Namen, so dass der Slot nach dem Umstellen auf Ben weiter Anna gezeigt hätte; sie fallen jetzt ebenso. | 7.1, 7.3 Nr. 5 und 7, PK29, 11.8 |
| RR10 | umgesetzt | Bestätigt: (a) `slotKurz.kennung` war der Wert von `_state` → `zustandWort`, 8.2 „Zustandswort“; (b) `fernSlotAnlegen` fehlte in der Methodenliste → ergänzt, ersetzt `fernLaden` (`kern.ts:1726`); (c) `normiereSlot` steht in `main/zoom/einstellungen.ts` (dort heute `gueltigerVersatz`, `einstellungen.ts:22-24`), `settings.ts` ruft es; (d) der Ziel-Stand liegt jetzt je Abo (`Abo::ziel`), wie 0.30 es für die Galerie verspricht. | 0.30, 6.1, 6.10 Schritt 6, 7.1, 7.10, 8.2, 15 |
| Tabelle bei T62c | umgesetzt | Bestätigt: „{gleich\|verschieden\|fehlt}“ mit nackten senkrechten Strichen zerlegte die Zeile in sechs statt vier Zellen. Jetzt Platzhalter `{vergleich}` mit den drei Werten in Worten. | 9.4 T62c |
| Tabelle bei PT6 | umgesetzt (neu gefunden) | Die strenge Spaltenprüfung fand eine zweite Zeile: Das Muster in PT6 (d) enthielt senkrechte Striche in Code, die in GitHub-Tabellen ebenfalls Zellen trennen (acht statt vier Trenner). Die frühere Prüfung zählte Striche in Code nicht mit und übersah sie. Jetzt maskiert (`\|`). | 11.2 PT6 |

### Vierte Runde: Restnachfix N1 (18.10.2026)

Grundlage: Die unabhängige Prüfung der Restrunde fand einen wichtigen Widerspruch (N1) und acht kleine Punkte (N2–N9); diese Runde behebt nur N1, N2–N9 sind nicht Teil davon. N1 ist vor dem Ändern an Spec, Code (Stand `a9553defe7`) und am Stand vor der Restrunde nachgeprüft; geändert ist die kleinste Fassung, die ihn an allen tragenden Stellen beseitigt. Keine Owner-Entscheidung aus Abschnitt 2 ist berührt; es gibt keine neue Owner-Frage und keinen neuen Text für Abschnitt 9.

| Punkt | Ergebnis | Grund (eigene Nachprüfung) | Ort |
| --- | --- | --- | --- |
| N1 | umgesetzt, erweitert | Bestätigt: PB22 verlangte bei Mischton über Moduswechsel „Feld für Feld gleich, ohne `slotAudio`-Ereignis“ (ebenso der Kommentar zu `TonStand` und Schritt 8), 6.3 dagegen ein Ereignis bei jedem Wechsel. Mit der Vorgabe jedes neuen Slots (Ton an, Mischton, Computerton an; 7.1, 7.6) schaltet jeder Moduswechsel von und zur Freigabe den Mischer ein oder aus (Ton-Abbildung 7.1, `tonZiele` 6.13), und `configured` wechselt zwischen `mix` und `mixShare`; die Abnahme G1 macht genau das. Schritt 8 regelte beim Mischer nur den Freigabewechsel, den Rückweg gar nicht. Bis zur Restrunde ersetzte `ZielStand{}` bei jedem Umhängen auch die Ton-Felder; seit RR8 bliebe nach Freigabe → Sprecher ein alter `lastAudioMs` stehen, und der Stille-Herzschlag (Schwelle 40 ms, Beginn bei `max(silenceBisMs, lastAudioMs)`, höchstens 200 ms je Tick, `video.cpp:1035`, `:1050`, `:1063-1067`) schöbe Stille nach, die der Mischer schon gefüllt hat (**Annahme** wie im Befund: Ob der Mischer-Weg `lastAudioMs` nachführt, sagte die Spec nicht; heute setzt es nur das direkte Senden, `video.cpp:829`, `:845`). Beim Nachprüfen gefunden: Auch der Mischer selbst begann nirgends neu; nach dem Wortlaut von 6.13 (Ausgabe „genau die seit seiner letzten Ausgabe verstrichene Zeit“) gäbe er nach Freigabe → Sprecher → Freigabe oder nach Computerton bzw. Mischton aus → an (Abnahme E4) beim nächsten Herzschlag die ganze Zwischenzeit aus. Jetzt: reine Funktion `tonWeg` (zugleich `configured`); ein Moduswechsel mit geändertem Tonweg beginnt den Ton-Stand neu, beim Wechsel in den Mischer auch den Mischer, und meldet `slotAudio` (`waiting/modeChanged`, sonst die bestehenden Gründe `personNotInMode`, `participantLeft`, `audioUnavailable`; `off/modeChanged` nur ohne eingestellten Ton, dort greift 10.6 Regel 1); gleicher Tonweg (über einen Moduswechsel nur `mix` → `mix` oder `none` → `none`) bleibt ohne Ereignis und ohne neuen Ton-Stand; der Mischer beginnt bei jedem Einschalten neu, auch per `slotSet` mit `audio` oder `shareAudio`. Damit hängt nichts mehr an der Annahme. PB22 ist auf reinen Mischton eingeschränkt und um Sprecher → Freigabe → Sprecher und Teilnehmer → Freigabe → Teilnehmer mit Computerton ergänzt, mit Gegenprobe. Die RR8-Zeile oben bleibt als Verlauf stehen; ihr „nur neu …, wo der Ton am Ziel hängt … oder `audio`/`shareAudio` sich ändert“ gilt seit dieser Runde auch für einen Moduswechsel, der den Tonweg ändert. | 6.1 (`TonStand`, `AudioMix`), 6.3, 6.10 Schritt 8 und Moduswechsel, 6.13 (Mischer, Umschalten, Stille-Herzschlag), 6.19, PB21, PB22, PB25, 11.3, PK7, 11.8, 12 G1 |

### Fünfte Runde: N2–N9, noShare, Builder-Check (18.10.2026)

Grundlage: die acht kleinen Punkte N2–N9 aus der Prüfung der Restrunde (N1 behob die vierte Runde), der Nebenbefund des Restnachfixes (`noShare` wird in der Bridge nirgends gesetzt, 10.6 Regel 7 ist unerreichbar) und die vier Fragen des Builder-Checks vor dem Plan. Jeder Punkt ist vor dem Ändern an Spec, Code (Stand `a9553defe7`) und, wo nötig, an den Review-Unterlagen und der iveo-Spec nachgeprüft (nur gelesen); geändert ist die kleinste Fassung, die ihn an allen tragenden Stellen beseitigt. Keine Owner-Entscheidung aus Abschnitt 2 ist berührt; die Owner-Reihenfolge vom 17.10.2026 steht jetzt unter der Tabelle in Abschnitt 2. Neu sind 0.36, E31, FR11, FR12, PB30 und die Fassung von T58f (sie geht mit der Texttabelle zur Freigabe, E31). Eine neue Header-Aussage gibt es nicht. Die Lasttest-Schritte K0–K12 der Abnahme behalten ihre Namen. Die Verlaufszeilen früherer Runden bleiben stehen; wo diese Runde sie einschränkt, steht es hier.

| Punkt | Ergebnis | Grund (eigene Nachprüfung) | Ort |
| --- | --- | --- | --- |
| N2 | umgesetzt | Bestätigt: Der Stille-Herzschlag liest `audioRate`, `audioChannels`, `lastAudioMs`, `audioOn`, `teilnehmerWeg` und `silenceBisMs` (`packages/zoom-bridge/native/video.cpp:1010-1013`, Feld `:138`); `TonStand` hatte kein `silenceBisMs`, der Kommentar „genau diese Felder“ war falsch. Heute ohne Wirkung (`bis = max(…)`, `:1050`; nach `TonStand{}` beginnt der Herzschlag erst mit dem ersten Paket, `:1035`), aber gegen den Grundsatz, dass beim Zurücksetzen kein Feld vergessen wird. Jetzt steht `silenceBisMs` in `TonStand`, der Kommentar sagt „unter anderem“ und nennt, was `audioOn` und `teilnehmerWeg` ersetzt. | 6.1, PB22, PB30, 11.8 |
| N3 | umgesetzt | Bestätigt: 7.3 Nr. 7 setzte `zeigteSchon` beim ersten `slot live` ohne Bezug auf Ziel oder Modus des Ereignisses, obwohl `slot` beides trägt (6.3); `slotSet` kommt erst aus dem Abgleich (7.3 Nr. 5), die Bridge arbeitet Befehle erst in Schritt 7 ihrer Schleife ab (6.6). Ein `slot live` mit Ziel Anna nach dem Umstellen auf Ben hätte den Alarm für Ben scharf gemacht, gegen PK29. Jetzt nur mit `mode: participant` und `target` = gültige `gewaehlteId`; PK29 prüft den Fall im Flug über die vorhandenen Testhaken `sendeFilter` und `ereignis` (`apps/connect/test/zoom-kern.test.ts:115`, `:137`, `:181`, `:189`). | 7.1, 7.3 Nr. 7, PK29, 11.8 |
| N4 | umgesetzt | Bestätigt: 0.12 und FR7 sprachen von „eine Person“, 7.3 Nr. 7 seit RR9 von der eingestellten; nach dem Wortlaut von FR7 hätte der Slot aus PK29 in o gezählt. Ebenso der Begriff „Offener Slot“ („seine schon gezeigte Person“). Jetzt überall „die eingestellte Person“. | 0.12, 3, 18 FR7 |
| N5 | umgesetzt (nur Wortlaut) | Bestätigt: In 10.6 gilt die erste passende Regel, und Regel 1 („Ton: aus“) steht vor Regel 2 (SZ9); in SZ9 ohne eingestellten Ton steht also T58a, und das ist dort wahr. Der Kommentar in 7.1 und die RR6-Zeile oben sagten mehr. Jetzt „in SZ9 mit eingestelltem Ton keine Tonzeile“ und das Prädikat „in SZ9 keine Tonzeile außer T58a“; die Reihenfolge der Regeln bleibt, damit jeder Verweis „10.6 Regel n“ weiter gilt. | 7.1 (`tonText`), 10.5, 10.6 Regel 2 und Prädikate |
| N6 | umgesetzt | Bestätigt: `fernEntladen` (`apps/connect/src/main/zoom/kern.ts:1746-1758`, gerufen `:1766`) steht in der Pflichtliste 5.8, seine neue Wirkung in 7.2 und 8.3, aber keine Methode trug sie. Jetzt `fernSlotEntladen(name)` in der Methodenliste, Verweis in 8.3, Gegenprobe gegen PK13. | 7.1, 8.3, 11.8 |
| N7 | umgesetzt | Bestätigt: A3a erwartete „bleibt nach dem Meeting-Ende gespeichert (J3)“, aber A3b löscht diesen Slot vorher; J3 nannte den Slot aus I1 nicht, der dort wieder aus sein soll. Jetzt verweist A3a für das Überstehen auf A2 (Neustart) und J3 (Meeting-Ende); J3 prüft nach dem Meeting-Ende und vor dem Beenden: dauerhafte Slots da, A3b-Slot weg, I1-Slot aus und ohne T96b. | 12 A3a, J3 |
| N8 | umgesetzt | Bestätigt: Der Eingang von `abbauPlan` kannte die Rückgabe von `sessionLeave()` nicht; die Tabellenzeile `leave` verwarf die Halteliste bei Sperre unbedingt, der Absatz zur Halteliste nur nach `true`. Die Rückgabe steht erst nach dem Abbau der Slots fest (`packages/zoom-bridge/native/main.cpp:196-198`; heute verworfen, `:198`; Vertrag `session.h:185-200`). Jetzt zwei Pläne: `leave` bis einschließlich `SessionLeave`, danach ein Nachlauf-Plan mit der Rückgabe (`true` → `HaltelisteVerwerfen`, `false` → kein Schritt); Tabellenzeile angeglichen, PB20 je Rückgabe, Gegenprobe. | 6.15 (Einleitung, Tabelle, Halteliste), PB20, 11.8 |
| N9 | umgesetzt | Bestätigt: Die Restrunden-Punkte und die Lasttest-Schritte hießen beide K1–K10, nicht überall unterscheidbar (Kopf; 7.3 Nr. 5 „beim Nachprüfen von K9“). Die Restrunden-Punkte heißen jetzt RR1–RR10 (Kopf, jeder Verweis „Restrunde RR…“, dritte Runde samt Tabelle, vierte Runde); die Lasttest-Schritte K0–K12 bleiben. Nicht R1–R10, weil R1–R7 schon Meldungen und Hinweise aus ST4 benennen (in dieser Spec der Hinweis R5, 10.11, T87, 11.10); der Vorschlag des Prüfberichts, durchgehend „Restrunde K…“ zu schreiben, hätte die doppelte Belegung nur ausgezeichnet, nicht beseitigt. In den Arbeitsunterlagen außerhalb des Repos heißen die Restrunden-Punkte weiter K1–K10. | Kopf, 0, 6, 7, 8, 9, 10, 11, 12, 14, 15, 17, 18, 21 |
| `noShare` | umgesetzt, erweitert | Bestätigt: Keine Stelle ließ die Bridge `noShare` setzen; ein Freigabe-Slot nur mit Computerton meldete ohne Freigabe `waiting/targetChanged` bzw. `waiting/modeChanged` (T58b), 10.6 Regel 7 war unerreichbar. Jetzt meldet die Bridge für direkten Computerton (`audio = off`, `shareAudio`) bei Ziel 0 `off/noShare`, beim Einschalten nach dem `waiting/command`, das die Rücksetzregel aus 7.1 braucht; Regel 7 hängt wie Regel 6 am Ziel. Beim Nachprüfen gefunden: (a) Der Stille-Herzschlag hätte nach dem Ende einer Freigabe weiter Stille gesendet und `off/noShare` mit `silent/gap` überschrieben (heute endet die Stille nur für Person-Ton mit dem Weggang, `video.cpp:1035`); jetzt zählt direkter Computerton nur mit Ziel ≠ 0, und die Rechnung liegt als reine Funktion `stilleBloecke` vor (PB30). (b) T75b („es läuft nur der Computerton“) stand auch ohne Freigabe und vor dem ersten Paket; jetzt nur, wenn `source` `share` enthält. (c) T58f „niemand teilt“ wäre bei einer reinen Ton-Freigabe falsch, die nie gezeigt wird (6.9); neuer Text „wartet auf eine Bildschirmfreigabe“. (d) Das Prädikat der Tonzeile für „läuft“ (⇒ `live`) traf auch T58h und T75b; jetzt gilt es nur für „· läuft (“. (e) Der Generator der Tonzeile hatte keine Dimension Ziel, obwohl die Regeln 6 und 7 daran hängen; ergänzt. Kreuzprodukt der Tonzeile: `off/noShare` entsteht nur bei Freigabe, nur Computerton und Ziel 0 → Regel 7 (T58f); Person-Ton mit Computerton ohne Freigabe → Regel 4 (T75); keine neue Kombination ohne Regel. | 6.10 Schritt 8, 6.13, 6.19, 9.3 T58f, 10.5, 10.6 Regeln 4 und 7, Prädikate, 11.3, PB22, PB30, PK14, 11.8, 12 E4 |
| Builder-Check, Frage 1 | entschieden (E31) | Bestätigt: Kopf, 9 und 13 Nr. 1 kannten nur die Freigabe der Texte „vor dem Release“ (Entwurf C), während `zoom-text.test.ts` jede Zeile wörtlich festhält (11.6) und Abschnitt 0 die Grundlage der ersten Plan-Teile ist. Jetzt umfasst die Owner-Freigabe der Spec Abschnitt 0 und die Texttabelle; Textänderungen danach nur mit Owner-OK als eigener Plan-Punkt; vor dem Release sieht der Owner die Texte nur im Abnahme-Bau (13 Nr. 6). | Kopf, 0.36, E31, 9, 13 Nr. 1 und Nr. 6 |
| Builder-Check, Frage 2 | beantwortet (Owner-Reihenfolge), keine Owner-Frage | Die Owner-Reihenfolge vom 17.10.2026 legt die Umsetzung hinter den Merge des iveo-Pakets und überholt damit B.7 „entsteht parallel“. Gelesen: Branch `feat/iveo-paket` @ `0b5fe80c32`, OF1 Variante A bestätigt, Wechsel auf C angeboten und offen (`docs/superpowers/specs/2026-10-16-iveo-paket-design.md:1504`). Jetzt in 13 und 20: Beginn nach dem iveo-Merge, Neuaufsetzen vor dem ersten Plan-Schritt, Liste der neu zu messenden Fundstellen, Mac-Weg A; ein Wechsel auf C ändert nur 13 Nr. 9–10. | Kopf, 2, 13, 20 |
| Builder-Check, Frage 3 | Owner-Frage FR11 mit Vorgabe | Bestätigt: 20 nannte den internen Lauf nur „empfohlen“, RS15 vertagte die Rückfallebene fest auf 0.4.1. Vorgabe: Schranke zwischen Plan A und dem Release, nicht vor dem Ausbau von Plan B; Termin mit dem Owner; bei negativem MS21 entscheidet der Owner über RS15 in 0.4.0 oder 0.4.1. | 13 Nr. 1, 16 RS15, 18 FR11, 20 |
| Builder-Check, Frage 4 | Owner-Frage FR12 mit Vorgabe | Bestätigt: Die Roadmap führt E7 offen (`docs/roadmap.md:180-182`, `:438`); die Unterlagen auf `spike/zoom-obf` @ `655763ecdc` widersprechen 0.4.0 an drei Stellen (`docs/zoom-marketplace/02-privacy-terms-support.md:161`, `:150`, `:165`, `:168`, `:81`). Vorgabe: FP1 bleibt „vor jeder Einreichung“, kein Teil dieses Releases; die drei Widersprüche stehen jetzt in FP1 mit Fundstelle. | 18 FR12, 19 FP1 |

### Sechste Runde: Restnachfix 2 nach der Nachprüfung der fünften Runde (18.10.2026)

Grundlage: zwei unabhängige Nachprüfungen der fünften Runde, eine mit der Linse Technik, eine mit der Linse Freigabe und Reihenfolge. Sie fanden keinen kritischen Punkt, drei wichtige (hier RN1–RN3, alle zu Freigabe und Reihenfolge) und vierzehn kleine (RN4–RN17); drei der kleinen decken sich mit anderen (RN9 mit RN16, RN10 mit RN2, RN11 mit RN13). Jeder Punkt ist vor dem Ändern an Spec, Code (Stand `a9553defe7`), den freigegebenen Entwürfen, der Roadmap, den Review-Unterlagen und der iveo-Spec (`feat/iveo-paket` @ `0b5fe80c32`, nur gelesen) nachgeprüft; geändert ist die kleinste Fassung, die ihn an allen tragenden Stellen beseitigt. **Keine Owner-Entscheidung aus Abschnitt 2 ist geändert; RN2 stellt O2 und die Release-Entscheidung wieder her.** Widerrufen sind drei Sätze der fünften Runde, die oben stehen bleiben: „Keine Owner-Entscheidung aus Abschnitt 2 ist berührt“ (die Vorgabe von FR11 änderte O2 und die Release-Entscheidung, RN2), „ein Wechsel auf C ändert nur 13 Nr. 9–10“ (zu eng, RN14) und „legt die Umsetzung hinter den Merge des iveo-Pakets“ (davor liegt auch die Umsetzung der Geführten Anleitungen, und erste Bedingung ist die Owner-Freigabe dieser Spec, RN15). Eingeschränkt ist die Aussage zum Kreuzprodukt der Tonzeile in der Zeile `noShare`: Für gespeicherte Tonart Person bei ausgeschaltetem Ton gilt sie erst seit RN4. Neu sind FR13, FP10 und der Text T58i (er geht mit der Texttabelle zur Freigabe, E31); FR11 und FR12 sind neu gefasst. Eine neue Header-Aussage gibt es nicht.

| Punkt | Schwere | Ergebnis | Grund (eigene Nachprüfung) | Ort |
| --- | --- | --- | --- | --- |
| RN1 | wichtig | umgesetzt | Bestätigt: Ob das Nachziehen der Review-Unterlagen in diesen Release gehört, hat der Owner in beiden Entwürfen entschieden (15.10.: „nicht Teil dieses Releases, als Folgepunkt notieren“; 17.10., C: „als Folgepunkt“); FR12 fragte es trotzdem. Die offene Roadmap-Entscheidung E7 (`docs/roadmap.md:182`) setzten D11, FR12 und FP1 dagegen als „durch den Bau faktisch A“; eingereicht wird aber nach E1–E6 (`:173`), und nach der Owner-Reihenfolge bleibt vor dem Bau Zeit. Beim Nachprüfen: FP1 gilt für A und für B, weil die Unterlagen die Freigaben schon heute als kommende Fassung beschreiben, samt Zusagen, die 0.4.0 ändert (`spike/zoom-obf` @ `655763ecdc`, `docs/zoom-marketplace/02-privacy-terms-support.md:147`, `:150`, `:168`); „faktisch A“ ist darum nicht als Annahme gefasst, sondern gestrichen. Jetzt fragt FR12 nach E7 selbst (Vorgabe wie die Roadmap: B), der entschiedene Teil steht als „nicht mehr gefragt“ dabei; D11 vermerkt E7 erst nach der Antwort. Nebenbei berichtigt: D11 zeigte für #227 und #247 als ⚪ auf `:453`, `:467`, dort stehen sie aber unter „Danach“ in überholten Ständen; richtig sind `:175`, `:177`, E7 steht an `:180-182`. | 14 D11, 18 FR12, 19 FP1 |
| RN2 | wichtig | umgesetzt, nach dem zweiten Vorschlag des Prüfers | Bestätigt: Die Vorgabe von FR11 (Schranke) galt nach der Einleitung von 18 sofort und stand als Voraussetzung in 13 Nr. 1. Damit wich die Spec ohne Hinweis von O2 ab („der erste Live-Test über den Launcher liefert die Zahlen, ein Folge-Release passt Vorgaben an“) und von der Release-Entscheidung („bewusst vor der Abnahme; was die Messung zeigt, korrigiert ein 0.4.1“). Vor der fünften Runde nannte 20 den Lauf „empfohlen“, RS15 lag fest in 0.4.1, und 13 Nr. 1 kannte keine Schranke. Jetzt gilt bis zur Antwort Abschnitt 2: Der Lauf ist empfohlen, keine Voraussetzung. FR11 sagt ausdrücklich, dass ein „ja“ O2 und die Release-Entscheidung ändert; 13 Nr. 1, RS15, 20 und Plan B nennen die Schranke nur nach „ja“, die Einleitung von 18 nennt FR11 als Ausnahme von „die Vorgabe gilt“. | 13 Nr. 1, 16 RS15, 18 (Einleitung, FR11), 20 |
| RN3 | wichtig | umgesetzt, Owner-Frage FR13 | Bestätigt: Die am 17.10.2026 bestätigte Vorgabe zu OF1 der iveo-Spec endet mit „FP1 und FP2 als nächster Connect-Schritt.“ (iveo-Spec Z. 1504; dort FP1 NDI auf dem Mac, Z. 1452, FP2 Anzeige von NDI-Ausfällen, Z. 1453; die Ausfälle heute nur im Log bzw. ohne Text, `apps/connect/src/main/ndi-guests.ts:38-79`, `apps/connect/src/main/ndi-program.ts:69-74`, `apps/connect/src/renderer/src/App.tsx:611-620`). Die Owner-Reihenfolge vom selben Tag nennt beide nicht, und die Spec schwieg dazu. Jetzt FR13 mit Vorgabe (eigener Connect-Schritt direkt nach 0.4.0, FP2 zuerst), FP10 und ein Satz unter der Owner-Reihenfolge in Abschnitt 2. Bei „in 0.4.0“ gehören FP2 und der Rückkanal in 7, 9, 10, 11 und 12. | 2, 18 FR13, 19 FP10 |
| RN4 | klein | umgesetzt | Bestätigt: Regel 4 fragte `tonAn` nicht; mit gespeicherter Tonart Person, Ton aus, Computerton und Modus Freigabe griff sie vor Regel 7 (T75 statt T58f, mit laufendem Computerton T75b statt T58c), obwohl Connect dann `audio = off` sendet (7.1) und die Bridge nie `personNotInMode` meldet. In den übrigen Lagen fängt Regel 1 den ausgeschalteten Ton vorher. Jetzt „Ton an, Tonart Person, Modus nicht Teilnehmer“, Prädikat „T75/T75b nur mit `tonAn`“, Fall in PK14, Gegenprobe. Ein eigener Generatorfall ist nicht nötig, der Generator erzeugt `tonAn` × `tonArt` × `computerton` schon (10.5). | 10.5, 10.6 Regel 4 und Prädikate, PK14, 11.8 |
| RN5 | klein | umgesetzt | Bestätigt: Für Person-Ton mit Computerton im Modus Freigabe (Tonweg `share`, 7.1 letzte Zeile, PB25) verlangte 6.10 Schritt 8 beim Freigabewechsel `waiting/targetChanged` (die Ausnahme `off/noShare` galt nur ohne Person-Ton), 6.13 dagegen `off/personNotInMode`. Festgelegt: Zustand und Grund bleiben `off/personNotInMode`, solange der Modus bleibt, auch bei Paketen und Stille; nur `source` folgt der Messung, und der Ton-Stand beginnt beim Freigabewechsel neu (`TonStandNeu` ohne `TonMelden`). Gewählt, weil 6.13 und PB22 (Moduswechsel) schon so lauten und die Tonzeile nur an Einstellung und `source` hängt (Regel 4); `live/packets` hätte den Grund verdeckt, den die Bridge für die Einstellung meldet. | 6.10 Schritt 8, 6.13, 11.3, PB22, PK14, 11.8 |
| RN6 | klein | umgesetzt | Bestätigt: Die Kappung setzt den Beginn auf jetzt − 200 ms (`packages/zoom-bridge/native/video.cpp:1064-1067`), erst die Fortschreibung `silenceBisMs = bis + gesendetMs` (`:1086`) lässt den Rest verfallen; der Code warnt vor dem Nachholen „mit dem Zwanzigfachen der Echtzeit“ (`:1052-1062`). `stilleBloecke` lieferte nur „ob und wie viel“. Jetzt liefert sie auch den neuen `silenceBisMs`, `videoTick()` schreibt ihn unter `fieldMutex` fort; PB30 prüft zwei Aufrufe nach 1 s Lücke, Gegenprobe. | 6.13, PB30, 11.8 |
| RN7 | klein | umgesetzt | Bestätigt: Mischton geht an jeden Slot mit `audio = mix`, ohne Ziel (Tabelle in 6.13); PB30 hatte keinen Fall `mix`, eine Umsetzung „bei Ziel 0 nie Stille“ bliebe grün. Jetzt in 6.13 ausdrücklich und in PB30 mit Ziel 0 und ≠ 0, Gegenprobe. | 6.13, PB30, 11.8 |
| RN8 | klein | umgesetzt | Bestätigt: Vorübergehende Slots verschwinden auch bei neuem Beitritt (7.2, 7.3 Nr. 8); vor J3 liegen D5 („neuer Beitritt …“) und E5, die Prüfung des A3b-Slots in J3 war also leer. Jetzt legt J3 kurz vor dem Meeting-Ende einen eigenen vorübergehenden Slot an und prüft danach, dass er weg ist; A3b erwartet das Verschwinden beim nächsten neuen Beitritt (spätestens D5). Der I1-Slot (T96b) war schon eine echte Prüfung. | 12 A3b, J3 |
| RN9 | klein | umgesetzt (zusammen mit RN16) | Bestätigt: MS10 ist nur aussagekräftig, wo so viele Quellen die Stufe allein liefern, wie Slots laufen (Regel unter der Lasttabelle in 12); der Termin des Laufs bringt zwei bis drei Kamera-Quellen. Jetzt führt 20 MS10 im Lauf als Vorabwert, für #261 nicht aussagekräftig; die Folgen je Messpunkt stehen in FR11 (RN16). | 18 FR11, 20 |
| RN10 | klein | abgelehnt, erledigt durch RN2 | Eine Zeile 0.37 in Abschnitt 0 wäre nur richtig, solange die Vorgabe von FR11 als Abweichung gälte. Seit RN2 gilt bis zur Antwort Abschnitt 2, es gibt also keine Abweichung; was ein „ja“ änderte, steht ausdrücklich in FR11. | – |
| RN11 | klein | umgesetzt (zusammen mit RN13) | Bestätigt: Das iveo-Paket zieht Auswahl und `compareVersions` aus `apps/launcher/src/main/release-source.ts` nach `release-wahl.ts` und stellt Proxy und GitHub-Quelle auf „das neueste Release mit passendem Paket“ um (iveo-Spec E40, E41, Z. 885-897); heute wählen beide ohne Blick auf die Pakete (`release-source.ts:87-98`, `services/release-proxy/worker.js:300-306`). Die Liste in 13 und 20 nannte beide Dateien nicht. Jetzt stehen sie in der Liste, und 5.7 Nr. 2 nennt die neue Regel („Pre-Releases eingeschlossen“ bleibt wahr). | 5.7 Nr. 2, 13, 20 |
| RN12 | klein | umgesetzt (vorbestehend), neuer Text T58i | Bestätigt: Bei doppeltem Namen gilt Ziel 0 (7.3 Nr. 5 b, c), Person-Ton meldet dann `off/participantLeft` (6.10 Schritt 8), und Regel 6 gab T58e „die Person ist nicht im Meeting“ neben T13 „ist {d}-mal im Meeting“. Beim Nachprüfen gefunden: ebenso bei `zweifel` (T13b) und ohne gewählte Person (T18, `person` leer nach 7.1), dort mit leerem `{Person}`; auch T58b und T58h hätten ohne Person eine leere Quelle. Jetzt folgt Regel 6 der Folge der Zustandszeile (10.2 Regel 6): `doppelt` > 1, `zweifel` oder keine Person → T58i „Ton: Person-Ton · aus, bis eine Person gewählt ist“, sonst T58e; `{Quelle}` ohne gewählte Person „Person-Ton“; Generator um `doppelt`, `zweifel`, keine Person und Warteraum, Prädikat zu T58e, Gegenprobe. T58e bleibt im Warteraum (T17): Wer dort wartet, ist nicht im Meeting. | 9.3 T58b, T58i, 10.5, 10.6 Regel 6 und Prädikate, 11.8 |
| RN13 | klein | umgesetzt | Bestätigt: Das iveo-Paket ändert auch `docs/roadmap.md` (iveo-Spec Z. 1445), das die Spec mehrfach zitiert; vor dem Neuaufsetzen liegen außerdem die Geführten Anleitungen auf `main`, deren Spec einen Launcher-Minor ankündigt (dort Z. 116), und der Block `launcher` steht in `packages/suite-manifest/changelog.json` vor `connect` (`:31` gegen `:1648`). Jetzt gilt als Regel „jede Fundstelle in einer Datei, die `git diff --stat a9553defe7 <neuer main>` zeigt“; 20 nennt die heute absehbaren Dateien samt `release-source.ts`, `worker.js` und `docs/roadmap.md`. | Kopf, 13, 20 |
| RN14 | klein | umgesetzt | Bestätigt: Auch 0.24, E28 und 7.11 setzen den Mac-Bau aus der CI voraus, und unter C kehrt sich die Prüfung „kein `jm_ndi.node`“ in der Selbsttest-Kette um (iveo-Spec Z. 870, 872). Jetzt nennen 13 und 20 diese Stellen. | 13, 20 |
| RN15 | klein | umgesetzt | Bestätigt: Kopf und fünfte Runde nannten als Grenze nur den Merge des iveo-Pakets, Abschnitt 2, 13 und 20 auch die Geführten Anleitungen; die Owner-Freigabe dieser Spec stand nirgends als Startbedingung. Jetzt im Kopf und in 13 und 20 als erste Bedingung, in 18 mit Verweis. | Kopf, 13, 18, 20 |
| RN16 | klein | umgesetzt | Bestätigt: FR11 begründete die Schranke mit MS21, MS22 und MS25/MS26, regelte aber nur für MS21 eine Folge, und FR8 kannte den Lauf nicht. Jetzt nennt FR11 je Messpunkt die Folge (MS21 → Owner über RS15; MS22 → FR8; Absturz oder nicht abgefangener Rückruf bei MS25/MS26 → Befund an den Owner vor dem Release; MS5, MS7, MS27 ohne Umbau, RS3, RS13, 6.10); FR8 und RS18 nennen den Lauf; MS10 wie RN9. | 16 RS18, 18 FR8, FR11, 20 |
| RN17 | klein | umgesetzt | Bestätigt: Die Einleitung von 18 erzählte Verlauf, FR1 nahm FR10 vorweg, FR9 nannte keinen Grund, und D11 schrieb „Entscheidung E7“, obwohl „E7“ hier auch die Entscheidung zur Auflösung und einen Abnahme-Schritt meint (der Bericht der fünften Runde sprach von „überall Roadmap-Entscheidung E7“). Jetzt: Einleitung nur „was ist offen, was blockiert“, FR1 verweist auf FR10, FR9 mit Grund (die 90 % als gewählt und als **Annahme** gekennzeichnet), D11, FR12 und FP1 sagen „Roadmap-Entscheidung E7“. | 14 D11, 18 (Einleitung, FR1, FR9, FR12), 19 FP1 |
