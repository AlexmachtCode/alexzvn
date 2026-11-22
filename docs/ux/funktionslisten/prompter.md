# Funktionsliste JM Prompter (Suite-UX-Update, Welle 2a · Prompter)

Zweck (Spec `docs/superpowers/specs/2026-10-08-suite-ux-update-design.md`, Abschnitt 10 „Kein Funktionsverlust“, und
Anhang A „Prompter“): jedes Bedienelement mit Handler, jedes Tastaturkürzel, jeder Dialog, jede Fernsteuerungs-Aktion und
jede Einstellung des Prompters, erhoben **vor dem Umbau** aus dem Code. Nach dem Umbau bekommt jede Zeile in der Spalte
„künftig wo“ einen Haken mit dem Ort im neuen Aufbau; ein Punkt ohne Haken blockiert die Welle.

- **Stand:** erhoben aus dem Code am 2026-11-22, Commit `d7cdd79ce0`, Prompter 0.7.0 (`apps/prompter/package.json`). Die
  Nachmessung `docs/ux/welle2-nachmessung-2a.md` (Abschnitt 3) gilt für `0f589c3ee1`; `git diff 0f589c3ee1 HEAD --
  apps/prompter` ist leer, der Code ist seither unverändert (letzter Commit an der App `e3f4e65aaa`). Nichts ausgeführt,
  kein Fenster geöffnet. Was nur aus dem Code abgeleitet ist, steht als „abgeleitet“, Unklares als „unklar“ bzw. „nicht
  gemessen“. Die Nachmessung hat in 3.1 keine Zeile mit ❌ oder ✏️ (alle ✅ bzw. ➕); die ➕-Zeile (Token in der
  Fernbedienungs-URL) steht als Nr. 31, die Risiken 3.3 stehen in Abschnitt 10.
- **Gelesen, vollständig:** `apps/prompter/src/**` (`renderer/index.html`, `renderer/src/main.tsx`, `App.tsx`,
  `views/OperatorView.tsx`, `views/PrompterOutputView.tsx`, `components/PrompterScroller.tsx`, `components/RemoteQr.tsx`,
  `lib/useHotkeys.ts`, `lib/markers.ts`, `lib/qr.ts`, `store/prompter.ts`, `jmprompt.d.ts`, `globals.css`, `preload/index.ts`,
  `shared/types.ts`, `main/index.ts`, `main/control-server.ts`, `main/config.ts`, `main/docx.ts`, `main/remote-page.ts`),
  der Block `prompter` in `packages/suite-control-protocol/src/capabilities.ts`. Ausschnitte: `packages/remote/src/index.ts`
  (nur die Anfragebehandlung `handle`), `packages/output-window/src/index.ts` (nur Öffnen, Schließen, Ereignisse),
  `packages/suite-control-protocol/src/index.ts` (nur `parseCommand`). Nicht gelesen: `packages/app-runtime/**`,
  `packages/discovery/**`, `packages/show/**`, `packages/control-config/**`, `packages/suite-control-protocol/src/server.ts`
  (Zeilenprotokoll, Verbindungsaufbau), `packages/ui/**`.
- **künftig wo** bleibt leer. Die Spalte wird nach dem Umbau gefüllt und abgehakt.
- **Pfade:** ohne Präfix relativ zu `apps/prompter/src/renderer/src/`; `main/…`, `preload/…`, `shared/…` und `renderer/…`
  relativ zu `apps/prompter/src/`; `packages/…` und `docs/…` relativ zur Repo-Wurzel. Zeilennummern gelten für `d7cdd79ce0`.
- **Zustands-Kürzel** (Spalte „Zustand (sichtbar/aktiv)“): **imm.** = immer sichtbar im Hauptfenster, sobald der Zustand
  geladen ist (vorher steht dort nur „Lädt…“) · **RL** = nur mit eingeschalteter Lese-Linie (`readingLine`) · **OA** = nur
  bei `outputOpen` im Store · **RA** = nur mit laufender Fernbedienung und mindestens einer Adresse · **RE** = nur mit
  `remoteEnabled` ohne Adresse · **Main** = Hauptprozess, ohne Oberfläche · **Out** = Ausgabefenster (`#output`) ·
  **Hy** = Handy-Seite im Browser des Handys.
- **Nummerierung:** fortlaufend 1–123 in den Abschnitten 1–7.
  Zeilen je Abschnitt: 1 = 32, 2 = 7, 3 = 39, 4 = 8, 5 = 6, 6 = 13, 7 = 18; zusammen 123.
  Die Abschnitte 8 (IPC-Übersicht), 9 (Zuordnung zu Spec 6 / Anhang A) und 10 (Befunde) haben keine nummerierten Punkte und
  werden nicht abgehakt.
- **`window.confirm`:** keiner im Prompter (Suche über `apps/prompter/src`, 0 Treffer). Einziger Dialog dieser Art ist
  `window.alert` beim Laden einer Skriptdatei (Nr. 33). **`localStorage`/`persistId`:** keine; der Prompter legt alles in
  `prompter-config.json` ab (Abschnitt 7).

---

## 1 · Hauptfenster (Operator, ohne Hash)

| Nr. | Bereich | Element | Handler/IPC | Zustand (sichtbar/aktiv) | heute wo | künftig wo |
|---|---|---|---|---|---|---|
|1| Fenster | Aufbau: eigener Rahmen ohne `AppShell`; Kopf 56 hoch, darunter links die Skript-Spalte (flexibel, Rand rechts), rechts das Steuerpult (400 breit, scrollt). Kein Theme-Knopf, `html` trägt fest die Klasse `dark` | – (Anzeige) | imm. | `views/OperatorView.tsx:39-52`, `:87-88`, `renderer/index.html:2` | |
|2| Fenster | Fensterhülle: 1180 mal 800, mindestens 940 mal 620, Titel „JM Prompter“, Hintergrund `#121212`, Symbol `icon.png`, `autoHideMenuBar`, auf dem Mac `titleBarStyle: hiddenInset`, `sandbox`, `contextIsolation`, ohne `nodeIntegration`; Anzeige erst bei `ready-to-show`; Links im Fenster öffnen extern (`shell.openExternal`), nie im Fenster | `createMainWindow` | Main | `main/index.ts:249-286` | |
|3| Fenster | Ladezustand: solange `state` fehlt, steht mittig „Lädt…“ und sonst nichts | `usePrompter().state` | imm. (nur vor dem ersten Zustand) | `views/OperatorView.tsx:22-24`, `store/prompter.ts:29-39` | |
|4| Kopf | Logo (24), „JM PROMPTER“, „Teleprompter“; keine Ziehfläche für den Mac-Rahmen (kein `dragRegion`), kein Einzug für die Mac-Ampel | – | imm. | `views/OperatorView.tsx:41-46` | |
|5| Kopf | Kopfhinweis rechts „Leertaste = GO/Pause · ↑/↓ = nudge · Pos1 = Anfang“; erst ab Breite `md` sichtbar; nennt die Umschalt-Variante nicht | – (Text) | imm. (ab `md`) | `views/OperatorView.tsx:47-49` | |
|6| Skript | Spaltenkopf „Skript“ mit Hinweis „Zeilen mit # werden zu Abschnitts-Marken“ | – | imm. | `views/OperatorView.tsx:55-61` | |
|7| Skript | Knopf „📄 Datei laden“ (Tooltip „.docx, .txt oder .md laden (ersetzt das Skript)“): öffnet den Dateidialog, ersetzt das Skript ohne Rückfrage; bei Fehler `window.alert` (Nr. 33) | `importScript()`, IPC `prompter:importScript` | imm. | `views/OperatorView.tsx:62-75`, `store/prompter.ts:45-48`, `main/index.ts:338-353` | |
|8| Skript | Textfeld „Skript“ (Platzhalter „Skript hier eintippen oder einfügen…“, keine Rechtschreibprüfung): jede Eingabe geht sofort in die Konfiguration, wird gespeichert und an alle Fenster gesendet; Leertaste und Pfeile gehören hier dem Feld (Nr. 99) | `setConfig({ script })`, IPC `prompter:setConfig` | imm. | `views/OperatorView.tsx:77-83`, `main/index.ts:329-335` | |
|9| Vorschau | Abschnittstitel „Vorschau“ und Vorschaufläche im Seitenverhältnis 16:9 mit dem geteilten `PrompterScroller` (gleiche Darstellung wie das Ausgabefenster: Farben, Spiegelung, Schriftgröße, Lese-Linie, Marker-Zeilen in Akzentfarbe). Die Vorschau hat kein `onEnd`, sie stoppt den Lauf nicht am Textende | `PrompterScroller state onMarkers` | imm. | `views/OperatorView.tsx:90-95`, `components/PrompterScroller.tsx:20-182` | |
|10| Vorschau | Marker-Messung: die Vorschau meldet die Positionen aller Marker-Zeilen (in em, relativ zum Textanfang) in den Store (`markersEm`); neu gemessen bei Änderung von Skript, Schriftgröße, Zeilenabstand, Seitenrand, Fett und bei Größenänderung | `setMarkers` | imm. | `components/PrompterScroller.tsx:43-66`, `store/prompter.ts:53` | |
|11| Transport | „⏮ Marke“ (Tooltip „Voriger Abschnitt“): springt zur letzten Marke vor der Position (Toleranz 0,05 em), gibt es keine, an den Anfang (0) | `jumpMarker(-1)`, IPC `prompter:seek` | imm. | `views/OperatorView.tsx:28-37`, `:100-102` | |
|12| Transport | GO/Pause: Beschriftung „▶ GO“ (Stil primary) bzw. „❙❙ Pause“ (Stil accent) nach `transport.playing`; Kürzel Leertaste (Nr. 93), Fernsteuerung `scroll` (Nr. 40) | `window.jmprompt.transport.toggle()`, IPC `prompter:toggle` | imm. | `views/OperatorView.tsx:103-109` | |
|13| Transport | „Marke ⏭“ (Tooltip „Nächster Abschnitt“): springt zur ersten Marke nach der Position (Toleranz 0,05 em); gibt es keine, geschieht nichts | `jumpMarker(1)`, IPC `prompter:seek` | imm. | `views/OperatorView.tsx:28-33`, `:110-112` | |
|14| Transport | „↑ zurück“: 3 em zurück (kein Kürzel mit dieser Schrittweite; Umschalt plus Pfeil hoch tut dasselbe, Nr. 97); die Position klemmt unten bei 0 | `transport.nudge(-3)`, IPC `prompter:nudge` | imm. | `views/OperatorView.tsx:115-117` | |
|15| Transport | „⟲ Anfang“: Lauf pausieren und an den Anfang; Kürzel Pos1 (Nr. 98), Fernsteuerung `top` (Nr. 44) | `transport.reset()`, IPC `prompter:reset` | imm. | `views/OperatorView.tsx:118-120` | |
|16| Transport | „↓ vor“: 3 em vor (Umschalt plus Pfeil runter tut dasselbe, Nr. 95); nach oben unbegrenzt, das Ende klemmt erst die Anzeige (Nr. 65) | `transport.nudge(3)`, IPC `prompter:nudge` | imm. | `views/OperatorView.tsx:121-123` | |
|17| Lauf & Schrift | Abschnitt „Lauf & Schrift“; Regler „Tempo“, 0,2 bis 6, Schritt 0,1, Anzeige mit einer Stelle und „ Z/s“ (Zeilen je Sekunde). Wirkt sofort: der Anker wird neu gesetzt, kein Sprung. Der Regler ist das einzige Tempo-Bedienelement im Hauptfenster; die Fernsteuerung hat `speed`, `faster`, `slower` (Nr. 41 bis 43) | `setConfig({ speed })`, IPC `prompter:setConfig` | imm. | `views/OperatorView.tsx:128-137`, `:268-305`, `main/index.ts:329-335` | |
|18| Lauf & Schrift | Regler „Schriftgröße“, 3 bis 16, Schritt 0,5, Anzeige mit einer Stelle (ohne Einheit); Wert in cqh, also Prozent der Ausgabehöhe | `setConfig({ fontScale })` | imm. | `views/OperatorView.tsx:138-145`, `shared/types.ts:25-26` | |
|19| Lauf & Schrift | Regler „Zeilenabstand“, 1 bis 2,4, Schritt 0,05, Anzeige mit zwei Stellen. Ändert auch die Lauf-Geschwindigkeit (em je Sekunde = Tempo mal Zeilenabstand), der Anker wird neu gesetzt | `setConfig({ lineHeight })` | imm. | `views/OperatorView.tsx:146-153`, `main/index.ts:332`, `:65-68` | |
|20| Lauf & Schrift | Regler „Seitenrand“, 0 bis 28, Schritt 1, Anzeige ganzzahlig mit „ %“ | `setConfig({ marginXPct })` | imm. | `views/OperatorView.tsx:154-162` | |
|21| Lese-Linie | Abschnitt „Lese-Linie“; Schalter „Lese-Linie anzeigen“ (Kontrollkästchen) | `setConfig({ readingLine })` | imm. | `views/OperatorView.tsx:166-167`, `:307-322` | |
|22| Lese-Linie | Regler „Position“, 15 bis 80, Schritt 1, mit „ %“ von oben; steuert auch den Vorlauf vor dem ersten Textzeichen (die erste Zeile startet auf Höhe der Linie) | `setConfig({ readingLinePct })` | RL | `views/OperatorView.tsx:168-178`, `components/PrompterScroller.tsx:149` | |
|23| Darstellung | Abschnitt „Darstellung“; Schalter „Spiegeln ⇄“ (horizontal, für Beamsplitter-Glas) | `setConfig({ mirrorH })` | imm. | `views/OperatorView.tsx:182-185`, `components/PrompterScroller.tsx:107` | |
|24| Darstellung | Schalter „Spiegeln ⇅“ (vertikal, Deckenspiegel); beide Spiegelungen zugleich sind möglich | `setConfig({ mirrorV })` | imm. | `views/OperatorView.tsx:185`, `components/PrompterScroller.tsx:107` | |
|25| Darstellung | Schalter „Fett“ (Gewicht 800 statt 500, Marker-Zeilen immer 900) | `setConfig({ bold })` | imm. | `views/OperatorView.tsx:186`, `components/PrompterScroller.tsx:155`, `:170` | |
|26| Ausgabe | Abschnitt „Ausgabe (Talent-Monitor)“; Auswahl des Bildschirms: Eintrag „Primärer Bildschirm“ (Wert leer, gemerkt als `null`) und je Bildschirm „<Name>[ · primär] (<Breite>×<Höhe>)“. Die Liste wird beim Start geladen und neu geholt, sobald das Feld den Fokus bekommt; ein Wechsel merkt `outputDisplayId`, öffnet oder verschiebt aber kein Fenster | `setConfig({ outputDisplayId })`, `refreshDisplays()`, IPC `output:displays` | imm. | `views/OperatorView.tsx:191-207`, `store/prompter.ts:38`, `:54`, `main/index.ts:367` | |
|27| Ausgabe | Knopf „Vollbild öffnen“ bzw. (bei offenem Fenster laut Store) „Auf diesen Bildschirm“: öffnet das Ausgabefenster auf dem gewählten Bildschirm (Standard primär), merkt den Bildschirm und schickt nach 400 ms einen frischen Zustand | `openOutput(outputDisplayId)`, IPC `output:open` | imm. | `views/OperatorView.tsx:208-211`, `store/prompter.ts:55-58`, `main/index.ts:288-301` | |
|28| Ausgabe | Knopf „Schließen“: schließt das Ausgabefenster | `closeOutput()`, IPC `output:close` | OA | `views/OperatorView.tsx:212-216`, `store/prompter.ts:59-62` | |
|29| Fernbedienung | Abschnitt „Fernbedienung (Handy im WLAN)“; Schalter „Fernbedienung aktiv“: schaltet den HTTP-Server der Handy-Seite (Port 7781) und die mDNS-Annonce an oder aus und merkt den Wunsch (`remoteEnabled`) | `setRemote(v)`, IPC `prompter:setRemote` | imm. | `views/OperatorView.tsx:221-226`, `store/prompter.ts:49-52`, `main/index.ts:152-163` | |
|30| Fernbedienung | Kasten bei laufender Fernbedienung: Text „Am Handy im selben WLAN scannen oder URL öffnen:“ und der QR-Code (160 mal 160, weißer Grund, Alternativtext „QR-Code zur Handy-Fernbedienung“) für die **erste** Adresse; kein Kopieren-Knopf | `RemoteQr url=urls[0]` | RA | `views/OperatorView.tsx:227-232`, `components/RemoteQr.tsx:1-36`, `lib/qr.ts:1-11` | |
|31| Fernbedienung | Alle Adressen als Text (je LAN-Schnittstelle eine, fett, umbrechend), jede mit angehängtem Token `/?t=<Token>`, sobald die Suite ein Token vorgibt (Token-URL der Handy-Fernbedienung, ➕-Zeile der Nachmessung) | `state.remote.urls`, `withRemoteToken` | RA | `views/OperatorView.tsx:233-237`, `main/index.ts:30-44`, `:70-73` | |
|32| Fernbedienung | Hinweis „Keine LAN-Adresse gefunden.“, wenn der Schalter an ist und die Adressliste leer: auch dann, wenn der Server wegen eines belegten Ports gar nicht läuft (Befund Nr. 2 in Abschnitt 10) | – (Text) | RE | `views/OperatorView.tsx:240-242` | |

## 2 · Dialoge und Meldungen

| Nr. | Bereich | Element | Handler/IPC | Zustand (sichtbar/aktiv) | heute wo | künftig wo |
|---|---|---|---|---|---|---|
|33| Dialog | `window.alert` „Datei konnte nicht geladen werden: <Fehlertext>“ bei Fehler beim Laden einer Skriptdatei (ungültiges .docx, nicht lesbare Datei); danach bleibt das alte Skript | `importScript().catch` | bei Fehler | `views/OperatorView.tsx:64-70` | |
|34| Dialog | Dateidialog „Skript laden“ (nativ, am Hauptfenster): Filter „Skript / Word“ (docx, txt, md, markdown) und „Alle Dateien“; ohne Hauptfenster wird nur der Zustand zurückgegeben | `dialog.showOpenDialog`, IPC `prompter:importScript` | Main | `main/index.ts:338-347` | |
|35| Dialog | Abbruch des Dateidialogs oder keine Datei gewählt: nichts ändert sich, kein Hinweis | – | Main | `main/index.ts:348` | |
|36| Meldung | Fehlertexte des Dateilesers, die im `window.alert` landen: „Keine word/document.xml gefunden — kein gültiges .docx?“, „ZIP: lokaler Header fehlt.“, „ZIP: Kompressionsmethode <n> nicht unterstützt.“; Lesefehler des Dateisystems mit dem Text von Node | `readScriptFile`, `docxToText` | Main | `main/docx.ts:18`, `:54-64` | |
|37| Meldung | Fernbedienung lässt sich nicht starten (Port 7781 belegt o. ä.): nur `console.error`, keine Meldung im Fenster; `remoteEnabled` bleibt `true`, die Adressliste ist leer, die Oberfläche zeigt „Keine LAN-Adresse gefunden.“ (Nr. 32) | `setRemote` (Fehlerfang) | Main | `main/index.ts:152-163` | |
|38| Meldung | Steuerserver (Port 8727) lässt sich nicht starten (belegt): das Ergebnis von `startControlServer` wird verworfen, weder Log noch Anzeige | `void startControlServer(...)` | Main | `main/index.ts:403`, `main/control-server.ts:29-44` | |
|39| Meldung | Show-Deep-Link mit unlesbarem Skript-Dokument: Fehlertext nur im Log („Show-Skript konnte nicht geladen werden: …“), keine Anzeige | `applyShowFromDeepLink` (Fehlerfang) | Main | `main/index.ts:322-324` | |

## 3 · Abläufe ohne eigenes Bedienelement (im Renderer und im Hauptprozess)

| Nr. | Bereich | Element | Handler/IPC | Zustand (sichtbar/aktiv) | heute wo | künftig wo |
|---|---|---|---|---|---|---|
|40| Fernsteuerung | Companion `PROMPTER SCROLL ON`, `OFF` oder `TOGGLE` (Aktion `scroll`, Wert-Argument `modeArg`, Umschalt-Schlüssel `scrolling`): `on`, `1`, `start` = Lauf starten; `off`, `0`, `stop` = pausieren; alles andere und ohne Argument = umschalten (Schreibweise egal) | `handleSuiteCommand` `scroll` | Main | `main/index.ts:95-101`, `packages/suite-control-protocol/src/capabilities.ts:323` | |
|41| Fernsteuerung | Companion `PROMPTER SPEED <n>` (Aktion `speed`, Zahl, Vorgabe 2, 0,2 bis 6): setzt das Tempo auf <n>, gerundet auf eine Stelle und auf 0,2 bis 6 begrenzt; keine Zahl = ignoriert; Anker neu, Broadcast | `handleSuiteCommand` `speed` | Main | `main/index.ts:102-110`, `packages/suite-control-protocol/src/capabilities.ts:324` | |
|42| Fernsteuerung | Companion `PROMPTER FASTER` (Aktion `faster`): Tempo plus 0,2 (begrenzt auf 6, Rundung auf eine Stelle) | `handleRemoteCommand speed +0.2` | Main | `main/index.ts:111-113`, `:142-148`, `packages/suite-control-protocol/src/capabilities.ts:325` | |
|43| Fernsteuerung | Companion `PROMPTER SLOWER` (Aktion `slower`): Tempo minus 0,2 (begrenzt auf 0,2) | `handleRemoteCommand speed -0.2` | Main | `main/index.ts:114-116`, `:142-148`, `packages/suite-control-protocol/src/capabilities.ts:326` | |
|44| Fernsteuerung | Companion `PROMPTER TOP` (Aktion `top`): wie „⟲ Anfang“, pausiert und springt auf 0 | `reset()` | Main | `main/index.ts:117-119`, `packages/suite-control-protocol/src/capabilities.ts:327` | |
|45| Fernsteuerung | Zustand an Companion: Variablen `speed` (Tempo in Z/s) und `scrolling` (1/0), Rückmeldung (Feedback) `scrolling` „Prompter scrollt“ (grün); `STATE ns=prompter scrolling=… speed=…`, bei jeder Änderung an alle Verbundenen und auf Anfrage `STATE?` | `buildSuiteState`, `pushControlState` | Main | `main/index.ts:87-90`, `:84`, `main/control-server.ts:1-14`, `packages/suite-control-protocol/src/capabilities.ts:328-332` | |
|46| Fernsteuerung | Steuerserver: TCP Port 8727 (fest), startet bei jedem Programmstart ohne Schalter, nimmt nur Befehle mit dem Namensraum `prompter` an; als Steuer-Endpunkt per mDNS annonciert (`ctl=1`, Name `jm-prompter-ctl`); Stopp beim Beenden | `startControlServer`, `stopControlServer` | Main | `main/control-server.ts:20-54`, `main/index.ts:403`, `:410` | |
|47| Handy-Befehle | Befehl `toggle` (von der Handy-Seite): GO oder Pause nach Zustand | `handleRemoteCommand` | Main | `main/index.ts:127-129` | |
|48| Handy-Befehle | Befehl `play`: Lauf starten (die Seite sendet ihn nicht, der Server nimmt ihn an) | `handleRemoteCommand` | Main | `main/index.ts:130-132` | |
|49| Handy-Befehle | Befehl `pause`: pausieren (die Seite sendet ihn nicht, der Server nimmt ihn an) | `handleRemoteCommand` | Main | `main/index.ts:133-135` | |
|50| Handy-Befehle | Befehl `nudge` mit Wert: Position um den Wert in em verschieben (Seite sendet −3 und 3); ungültiger Wert = 0 | `handleRemoteCommand` | Main | `main/index.ts:136-138` | |
|51| Handy-Befehle | Befehl `reset`: pausieren und an den Anfang | `handleRemoteCommand` | Main | `main/index.ts:139-141` | |
|52| Handy-Befehle | Befehl `speed` mit Wert: Tempo relativ ändern (Seite sendet −0,2 und 0,2), begrenzt 0,2 bis 6, gerundet auf eine Stelle | `handleRemoteCommand` | Main | `main/index.ts:142-148` | |
|53| Handy-Server | HTTP-Server Port 7781 (`RemoteServer`): Seite unter `/`, Zustand unter `/state`, Ereignisstrom `/events`, Befehle per `POST /cmd`; Daten-Endpunkte verlangen das Suite-Token (Anfrage-Parameter `t` oder Kopfzeile `x-remote-token`), sonst 401; ohne Token in der Suite-Konfiguration offen; Befehls-Begrenzung 60 je 10 s und Quell-IP, danach 429; Nachrichten über 64 000 Zeichen werden abgebrochen | `RemoteServer`, `getState`, `onCommand` | Main | `main/index.ts:57-63`, `packages/remote/src/index.ts:118-170` | |
|54| Handy-Server | Zustand an die Handy-Seite: `{ playing, speed }` bei jeder Änderung und beim Verbinden | `remote.broadcast` | Main | `main/index.ts:61`, `:83` | |
|55| Handy-Server | Autostart: ist `remoteEnabled` gemerkt, startet die Fernbedienung beim Programmstart von selbst | `setRemote(true)` | Main | `main/index.ts:400-401` | |
|56| Handy-Server | mDNS-Annonce `jm-prompter`, Rolle `prompter`, Port 7781: nur solange die Fernbedienung an ist; im gesicherten Modus mit Signaturschlüssel; Fehler werden verschluckt | `setAdvertised` | Main | `main/index.ts:36-37`, `:46-48`, `:165-177` | |
|57| Handy-Server | Token der Fernbedienung: aus der Suite-Konfiguration (`control.json` im AppData-Ordner), beim Start einmal gelesen, nicht änderbar im Prompter; die Adressen im Zustand tragen es als `/?t=<Token>` | `readControlConfig`, `withRemoteToken` | Main | `main/index.ts:30-44` | |
|58| Transport | Modell: der Hauptprozess führt Anker (`anchorEm`, `anchorAtMs`, `emPerSec`, `playing`); Position = Anker plus Zeit mal Geschwindigkeit; alle Fenster rechnen lokal, per IPC fließt nur bei Änderung. Geschwindigkeit = Tempo mal Zeilenabstand | `positionEm`, `getEmPerSec` | Main | `main/index.ts:50-54`, `:65-68`, `shared/types.ts:80-101` | |
|59| Transport | Start (`play`): ohne Wirkung, wenn schon läuft; setzt Anker auf aktuelle Position | `play()` | Main | `main/index.ts:189-199` | |
|60| Transport | Pause (`pause`): ohne Wirkung, wenn nicht läuft; friert die Position ein | `pause()` | Main | `main/index.ts:201-210` | |
|61| Transport | Sprung (`seek`) auf absolute Position, unten bei 0 geklemmt, Lauf bleibt wie er ist (IPC `prompter:seek`, von den Knöpfen „⏮ Marke“ und „Marke ⏭“) | `seek(em)` | Main | `main/index.ts:212-220`, `:358` | |
|62| Transport | Verschieben (`nudge`) relativ zur aktuellen Position, nutzt `seek` | `nudge(delta)` | Main | `main/index.ts:222-224`, `:359` | |
|63| Transport | Zurücksetzen (`reset`): pausiert und setzt auf 0; auch nach dem Laden eines Skripts per Show-Verknüpfung | `reset()` | Main | `main/index.ts:226-235`, `:321` | |
|64| Transport | Neuverankerung bei Tempo- oder Zeilenabstand-Änderung (Konfigurationsänderung mit `speed` oder `lineHeight`), damit die Position nicht springt; die Fernsteuerung (`speed`, `faster`, `slower`) ruft sie ebenfalls | `reanchor()` | Main | `main/index.ts:179-187`, `:332` | |
|65| Transport | Anzeige-Ende: die Anzeige klemmt die Position beim gemessenen Textende (`pos` höchstens die Inhaltshöhe) und die Verschiebung läuft per `requestAnimationFrame` in Pixeln; vor der ersten Messung wird nichts geklemmt (Fix Issue #29) | `PrompterScroller` rAF | imm. und Out | `components/PrompterScroller.tsx:69-105` | |
|66| Transport | Auto-Stopp am Textende: erreicht die Position das Ende, während der Lauf läuft, meldet der Scroller **einmal je Lauf** das Ende und das Ausgabefenster ruft `transport.pause()`. Nur im Ausgabefenster; die Vorschau stoppt nicht (Nr. 9); ist das Ausgabefenster zu, läuft die Position über das Ende hinaus weiter | `onEnd` → `transport.pause()` | Out | `views/PrompterOutputView.tsx:18`, `components/PrompterScroller.tsx:80-85` | |
|67| Zustand | Verteilung: jede Änderung geht an das Hauptfenster (`prompter:state`), das Ausgabefenster (gleicher Kanal), die Handy-Seite und die Companion-Verbindungen; `getState` beim Laden jedes Fensters liefert den ganzen Zustand (Konfiguration, Transport, Fernbedienung) | `broadcast`, `buildState` | Main | `main/index.ts:75-85`, `:328`, `preload/index.ts:11-19` | |
|68| Zustand | Beim Laden der Oberfläche: Zustand und `output.isOpen()` holen, einmalig die Zustands-Meldung abonnieren (Schutz vor Doppelabo), Bildschirmliste holen; `outputOpen` wird nur hier gelesen und beim Öffnen auf `true`, beim Schließen auf `false` gesetzt, nie aus einem Ereignis (Befund Nr. 1 in Abschnitt 10) | `usePrompter.load` | imm. | `store/prompter.ts:29-39`, `:55-62`, `App.tsx:5-10` | |
|69| Zustand | Konfiguration: Standardwerte plus gespeicherte Datei, `colors` tief gemischt; beschädigte Datei ergibt die Standardwerte; Schreiben bei jeder Änderung, Fehler beim Schreiben werden verschluckt (dann nur im Speicher) | `getConfig`, `patchConfig` | Main | `main/config.ts:12-59` | |
|70| Skript | Marker-Syntax: Zeilen, die mit `#` beginnen (auch `##`, Einrückung egal), werden zu Marken; der Text erscheint ohne `#`; Leerzeilen erzeugen 0,6 em Abstand | `parseScript` | imm. und Out | `lib/markers.ts:1-23`, `components/PrompterScroller.tsx:161-177` | |
|71| Skript | Skriptdatei lesen: `.docx` wird ohne Fremdbibliothek aus dem ZIP gelesen (`word/document.xml`; Tabs, Umbrüche, Absatzenden zu Zeilen; Tags entfernt; Zeichencodes dekodiert; mehr als zwei Leerzeilen auf eine gekürzt; getrimmt), alles andere als UTF-8-Text | `readScriptFile`, `docxToText` | Main | `main/docx.ts:9-13`, `:15-20`, `:68-76` | |
|72| Show | Deep-Link `jmps://open?show=<Pfad>`: beim Start oder bei laufender App; liest die Show, sucht die Werkzeug-Zeile `jm-prompter`, lädt deren Dokument (absolut oder relativ zur Show) als Skript, springt an den Anfang; ohne Dokument oder Fehler nichts (Fehler im Log) | `applyShowFromDeepLink` | Main | `main/index.ts:303-325`, `:380`, `:405` | |
|73| Fenster | Ausgabefenster öffnen: sichert den gewählten Bildschirm in der Konfiguration, öffnet ein Vollbildfenster mit Hash `#output` (Titel „JM Prompter — Ausgabe“, sandboxed), Zielbildschirm = Parameter oder gemerkter oder primär; nach 400 ms wird der Zustand neu gesendet | `openOutput` | Main | `main/index.ts:288-301` | |
|74| Fenster | Ausgabefenster schließen und abfragen: IPC `output:close`, `output:isOpen`; Bildschirmliste `output:displays` | `output.close`, `output.isOpen`, `listDisplays` | Main | `main/index.ts:367-370` | |
|75| Fenster | Einzelinstanz: zweiter Start holt das Hauptfenster nach vorn (stellt es wieder her, zeigt es) oder legt es neu an | `requestSingleInstanceLock`, `second-instance` | Main | `main/index.ts:383-396` | |
|76| Fenster | Programmende: Fensterschluss beendet die App außer auf dem Mac; beim Beenden werden mDNS, Steuerserver und Handy-Server gestoppt | `window-all-closed`, `before-quit` | Main | `main/index.ts:408-416` | |
|77| Fenster | Laufzeit-Grundlage: `initAppRuntime` mit CSP, Kennung `jm-prompter`, Name „JM Prompter“, Dienstport 7781 (Presence), Deep-Link-Annahme; Log und Absturzbehandlung im Paket | `initAppRuntime` | Main | `main/index.ts:373-381` | |
|78| Fenster | Wahl des Renderers: Hash `#output` lädt `PrompterOutputView`, sonst `App` mit `OperatorView` | `main.tsx` | imm. und Out | `renderer/src/main.tsx:7-13` | |

## 4 · Zusatzfenster

Der Prompter hat kein zweites Fenster der App. Abgegrenzt als Grenzeintrag: die Handy-Seite, die der Hauptprozess unter
`http://<LAN-Adresse>:7781/` ausliefert (`main/remote-page.ts`, eine in sich geschlossene HTML-Seite im Browser des
Handys). Sie bleibt unverändert (Spec U6); der Umbau berührt nur ihren Schalter und die Adressanzeige im Hauptfenster.

| Nr. | Bereich | Element | Handler/IPC | Zustand (sichtbar/aktiv) | heute wo | künftig wo |
|---|---|---|---|---|---|---|
|79| Handy-Seite | Kopf: Punkt (gelb bei Lauf, sonst grau), „JM Prompter“ und Zustandswort: „verbinde…“, „läuft“, „pausiert“, „getrennt – verbinde…“ bei Verbindungsfehler (Wiederverbindung alle 2 s durch den Server-Hinweis `retry`) | `EventSource(/events)` | Hy | `main/remote-page.ts:33-37`, `:64-78` | |
|80| Handy-Seite | Großer Knopf „▶ GO“ bzw. „❙❙ Pause“ (gelb gefüllt bei Lauf) | `send({type:'toggle'})` → `POST /cmd` | Hy | `main/remote-page.ts:39`, `:64-72` | |
|81| Handy-Seite | „↑ Zurück“ (−3 em) | `send({type:'nudge',value:-3})` | Hy | `main/remote-page.ts:42` | |
|82| Handy-Seite | „↓ Vor“ (3 em) | `send({type:'nudge',value:3})` | Hy | `main/remote-page.ts:43` | |
|83| Handy-Seite | Tempo: Knöpfe „−“ und „+“ (je 0,2) und die Anzeige des Tempos („x,x Z/s“, „–“ vor dem ersten Zustand) | `send({type:'speed',value:∓0.2})` | Hy | `main/remote-page.ts:46-51`, `:71` | |
|84| Handy-Seite | „⟲ An den Anfang“ | `send({type:'reset'})` | Hy | `main/remote-page.ts:53` | |
|85| Handy-Seite | Token: die Seite liest `?t=` aus der eigenen Adresse und hängt es an `/events` und `/cmd`; ohne Token unverändert (offener Modus). Die Seite `/` selbst ist frei erreichbar | `withT`, `T` | Hy | `main/remote-page.ts:59-60`, `packages/remote/src/index.ts:123-128` | |
|86| Handy-Seite | Sendefehler werden verschluckt, kein Hinweis; Seite sperrt Zoom (`maximum-scale=1`), Texte nicht markierbar | `send().catch` | Hy | `main/remote-page.ts:8`, `:61` | |

## 5 · Ausgabefenster (Talent-Monitor, `#output`; nur Abgrenzung, bleibt unverändert)

| Nr. | Bereich | Element | Handler/IPC | Zustand (sichtbar/aktiv) | heute wo | künftig wo |
|---|---|---|---|---|---|---|
|87| Fenster | Vollbildfenster auf dem gewählten Bildschirm (`OutputWindow`, Kanal `prompter:state`, sandboxed, Hash `output`, Titel „JM Prompter — Ausgabe“); Öffnen und Schließen vom Hauptfenster (Nr. 27, 28) | `OutputWindow.open` | Out | `main/index.ts:28`, `:288-301`, `packages/output-window/src/index.ts:100-160` | |
|88| Inhalt | Fläche `fixed inset-0` schwarz, Mauszeiger ausgeblendet; darauf nur der `PrompterScroller` (Hintergrund und Textfarbe aus `config.colors`, Spiegelung, Lese-Linie, Marker); keine Bedienelemente, kein AppShell | `PrompterOutputView` | Out | `views/PrompterOutputView.tsx:16-20` | |
|89| Zustand | Eigener Zustand per `getState` und `onState` (kein Store des Hauptfensters); solange kein Zustand da ist, bleibt die Fläche schwarz | `window.jmprompt.getState`, `onState` | Out | `views/PrompterOutputView.tsx:8-14` | |
|90| Tastatur | Dieselben Kürzel wie im Hauptfenster (Leertaste, ↑/↓, Umschalt, Pos1; Nr. 93 bis 98) | `usePrompterHotkeys()` | Out | `views/PrompterOutputView.tsx:9`, `lib/useHotkeys.ts` | |
|91| Ablauf | Auto-Stopp am Textende läuft nur hier (Nr. 66) | `onEnd` | Out | `views/PrompterOutputView.tsx:18` | |
|92| Ablauf | Lebenszyklus: das Fenster merkt Bildschirmwechsel und Schließen im Paket (`display-removed`, `closed`, `render-process-gone`); der Prompter liest diesen Zustand heute nicht (Befund Nr. 1) | `OutputWindow.zustand()` (ungenutzt) | Main | `packages/output-window/src/index.ts:81-160`, `main/index.ts:28` | |

## 6 · Tastatur (Pflichtpunkt Spec 10)

Die Kürzel sitzen in einem Hook am `window` (`keydown`), eingehängt im Hauptfenster (`OperatorView`) und im Ausgabefenster
(`PrompterOutputView`). Ausgenommen sind nur Ziele vom Typ `INPUT`, `TEXTAREA` und mit `contentEditable`. `SELECT` und
Knöpfe sind nicht ausgenommen.

| Nr. | Bereich | Element | Handler/IPC | Zustand (sichtbar/aktiv) | heute wo | künftig wo |
|---|---|---|---|---|---|---|
|93| Kürzel | Leertaste: GO/Pause umschalten; `preventDefault` | `transport.toggle()` | imm. und Out | `lib/useHotkeys.ts:11-14` | |
|94| Kürzel | Pfeil runter: 1 em vor | `transport.nudge(1)` | imm. und Out | `lib/useHotkeys.ts:15-18` | |
|95| Kürzel | Umschalt plus Pfeil runter: 3 em vor | `transport.nudge(3)` | imm. und Out | `lib/useHotkeys.ts:17` | |
|96| Kürzel | Pfeil hoch: 1 em zurück | `transport.nudge(-1)` | imm. und Out | `lib/useHotkeys.ts:19-22` | |
|97| Kürzel | Umschalt plus Pfeil hoch: 3 em zurück | `transport.nudge(-3)` | imm. und Out | `lib/useHotkeys.ts:21` | |
|98| Kürzel | Pos1 (`Home`): pausieren und an den Anfang | `transport.reset()` | imm. und Out | `lib/useHotkeys.ts:23-26` | |
|99| Kürzel | Filter: in Eingabefeldern (`INPUT`, `TEXTAREA`, `contentEditable`) tut der Hook nichts; das gilt für das Skript-Textfeld (Leertaste tippt ein Leerzeichen, Pfeile bewegen den Cursor) und für alle Regler und Kontrollkästchen im Pult, denn die sind `INPUT` (Pfeile verstellen den Regler, Leertaste schaltet das Kontrollkästchen). Kein Filter für `SELECT` und `BUTTON` | `usePrompterHotkeys` | imm. und Out | `lib/useHotkeys.ts:8` | |
|100| Kürzel | Wirkung auf fokussierte Knöpfe und die Bildschirmauswahl (abgeleitet, nicht gemessen): Leertaste auf einem fokussierten Knopf löst GO aus (der Knopf selbst bekommt kein Klick-Ereignis, weil `preventDefault` greift); Pfeile auf der Bildschirmauswahl schieben den Text statt die Auswahl zu ändern | – | imm. | `lib/useHotkeys.ts:8-12` | |
|101| Kürzel | Kopfhinweis „Leertaste = GO/Pause · ↑/↓ = nudge · Pos1 = Anfang“ im Kopf, ab Breite `md`; bleibt zu pflegen, wenn die Kürzel im neuen Aufbau an der GO-Taste erscheinen | – (Text) | imm. | `views/OperatorView.tsx:47-49` | |
|102| Kürzel | Fehlende Kürzel heute: für „⏮ Marke“, „Marke ⏭“, Tempo und Schalter gibt es keine; kein Escape, kein Strg-Kürzel, keine Kürzel der App-Menüs (Menü ausgeblendet) | – | – | `lib/useHotkeys.ts`, `main/index.ts:265` | |
|103| Panel-Tasten | **Panel-Tasten nach O1 (gilt im neuen Aufbau):** Felder behalten ihre Tasten (Textfeld Skript, Regler, Auswahl, Kontrollkästchen: Leertaste und Pfeile gehören dem Feld); Leertaste auf einem Knopf oder Schalter im Panel geht ans Tool (GO); Escape schließt das Panel. Heute gibt es kein Panel und kein Escape (Nr. 102); die Leertaste auf einem Schalter vom Typ Kontrollkästchen bedient dagegen den Schalter | – | künftig | `lib/useHotkeys.ts:8`, Spec 10, Entscheidung O1 | |
|104| Tasten im Feld | Skript-Textfeld: alle normalen Textfeld-Tasten (Einfügen, Auswahl, Rückgängig); das Feld übernimmt keine Sondertaste des Prompters | `<textarea>` | imm. | `views/OperatorView.tsx:77-83` | |
|105| Tasten im Feld | Regler (Tempo, Schriftgröße, Zeilenabstand, Seitenrand, Position): native Tasten des Bereichsreglers (Pfeile, Bild auf/ab, Pos1/Ende) im Fokus; Pos1 setzt dort den Regler auf den Mindestwert und nicht den Prompter zurück | `<input type=range>` | imm. | `views/OperatorView.tsx:294-302` | |

## 7 · Gemerkte Zustände (Konfigurationsdatei, sonstige Ablage)

Alles liegt in einer JSON-Datei `prompter-config.json` im Benutzerordner der App (`app.getPath('userData')`), geschrieben bei jeder
Änderung (`patchConfig`). Es gibt kein `localStorage`, kein `persistId`. Die Datei und der gemischte Standard
(`DEFAULT_CONFIG`) sind in Nr. 119 beschrieben.

| Nr. | Bereich | Element | Handler/IPC | Zustand (sichtbar/aktiv) | heute wo | künftig wo |
|---|---|---|---|---|---|---|
|106| Konfiguration | `script`: Skripttext; Standard ist der Willkommenstext („# Willkommen …“) | `setConfig`, `importScript`, Show | Main | `shared/types.ts:24`, `:51`, `main/config.ts:33-59` | |
|107| Konfiguration | `fontScale`, Standard 7 | `setConfig` | Main | `shared/types.ts:26`, `:60`, `main/config.ts:33-59` | |
|108| Konfiguration | `lineHeight`, Standard 1,45 | `setConfig` | Main | `shared/types.ts:28`, `:61`, `main/config.ts:33-59` | |
|109| Konfiguration | `speed` (Tempo), Standard 1,6; auch durch die Fernsteuerung und die Handy-Seite geändert | `setConfig`, `speed`/`faster`/`slower`, Handy `speed` | Main | `shared/types.ts:30`, `:62`, `main/config.ts:33-59` | |
|110| Konfiguration | `mirrorH`, Standard aus | `setConfig` | Main | `shared/types.ts:32`, `:63`, `main/config.ts:33-59` | |
|111| Konfiguration | `mirrorV`, Standard aus | `setConfig` | Main | `shared/types.ts:34`, `:64`, `main/config.ts:33-59` | |
|112| Konfiguration | `marginXPct`, Standard 8 | `setConfig` | Main | `shared/types.ts:36`, `:65`, `main/config.ts:33-59` | |
|113| Konfiguration | `readingLine`, Standard an | `setConfig` | Main | `shared/types.ts:38`, `:66`, `main/config.ts:33-59` | |
|114| Konfiguration | `readingLinePct`, Standard 42 | `setConfig` | Main | `shared/types.ts:40`, `:67`, `main/config.ts:33-59` | |
|115| Konfiguration | `bold`, Standard an | `setConfig` | Main | `shared/types.ts:42`, `:68`, `main/config.ts:33-59` | |
|116| Konfiguration | `colors` mit `background` (`#000000`), `text` (`#FFFFFF`), `accent` (`#FFE819`): wirken in Vorschau und Ausgabe, **keine Bedienoberfläche** (nur über die Datei änderbar) | `patch.colors` (nur über IPC `prompter:setConfig`) | Main | `shared/types.ts:9-18`, `:43`, `:69`, `main/config.ts:49` | |
|117| Konfiguration | `outputDisplayId` (Bildschirm der Ausgabe, `null` = primär) | `setConfig`, `output:open` | Main | `shared/types.ts:45`, `:70`, `main/config.ts:33-59`, `main/index.ts:289` | |
|118| Konfiguration | `remoteEnabled` (Handy-Fernbedienung beim Start wieder an), Standard aus | `setRemote` | Main | `shared/types.ts:47`, `:71`, `main/config.ts:33-59`, `main/index.ts:401` | |
|119| Konfiguration | Datei- und Mischregel: fehlende Felder aus `DEFAULT_CONFIG`, `colors` je Feld gemischt, beschädigte Datei = Standardwerte, nicht schreibbar = nur im Speicher | `getConfig` | Main | `main/config.ts:12-30`, `:33-59` | |
|120| Nicht gemerkt | Transport (Position, Lauf): beim Start ist der Prompter am Anfang und pausiert | `transport` im Hauptprozess | Main | `main/index.ts:51-54` | |
|121| Nicht gemerkt | `outputOpen`: das Ausgabefenster wird beim Start nicht wieder geöffnet; im Store nur der gelesene Wert | `usePrompter` | imm. | `store/prompter.ts:7`, `:36-38` | |
|122| Nicht gemerkt | Fensterposition und -größe des Hauptfensters (immer 1180 mal 800); Marker-Positionen und Bildschirmliste nur im Store | `createMainWindow`, `markersEm`, `displays` | imm. | `main/index.ts:255-263`, `store/prompter.ts:8-9` | |
|123| Suite-Datei | `control.json` im AppData-Ordner (Suite-Token, Signaturschlüssel), nur gelesen: Token der Fernbedienung und der mDNS-Signatur | `readControlConfig`, `mdnsSignKey` | Main | `main/index.ts:34-37` | |

## 8 · IPC-Übersicht `window.jmprompt` (Preload `preload/index.ts`)

Der Preload legt das Objekt `window.jmprompt` an (Typ `JmpromptApi`, `shared/types.ts:141-167`). Keine Master-Link-Funktion,
keine Fernsteuerungs-Meldung, kein Ausgabe-Zustand (alles Zugänge, die der Umbau ergänzt).

| Funktion | Kanal | Richtung | Wirkung |
|---|---|---|---|
| `platform` | – | – | `process.platform` |
| `getState()` | `prompter:getState` | invoke | ganzer Zustand |
| `setConfig(patch)` | `prompter:setConfig` | invoke | Konfiguration ändern, ggf. neu verankern, senden |
| `importScript()` | `prompter:importScript` | invoke | Dateidialog und Skript ersetzen |
| `onState(cb)` | `prompter:state` | Ereignis | Zustand bei jeder Änderung |
| `transport.play()` | `prompter:play` | invoke | Lauf starten (kein Bedienelement) |
| `transport.pause()` | `prompter:pause` | invoke | pausieren (nur Auto-Stopp im Ausgabefenster) |
| `transport.toggle()` | `prompter:toggle` | invoke | GO/Pause, Leertaste |
| `transport.seek(em)` | `prompter:seek` | invoke | Sprung (Marken) |
| `transport.nudge(delta)` | `prompter:nudge` | invoke | relativ verschieben (Pfeile, ±3-Knöpfe) |
| `transport.reset()` | `prompter:reset` | invoke | Anfang, Pos1 |
| `setRemote(enabled)` | `prompter:setRemote` | invoke | Handy-Fernbedienung an/aus |
| `output.displays()` | `output:displays` | invoke | Bildschirmliste |
| `output.open(id?)` | `output:open` | invoke | Ausgabefenster öffnen |
| `output.close()` | `output:close` | invoke | schließen |
| `output.isOpen()` | `output:isOpen` | invoke | offen? (nur beim Laden gelesen) |

Nicht über den Preload, sondern im Hauptprozess: TCP-Steuerserver Port 8727 (Companion), HTTP-Server Port 7781 (Handy),
`jmps://`-Deep-Link, mDNS.

## 9 · Einstellungen nach Spec 6 / Anhang A (Zuordnung der Ist-Elemente)

| Spec-Baustein | Ist-Nr. | Bemerkung |
|---|---|---|
| Live-Bereich (Vorschau und Transport) | Nr. 9 bis 16 | Vorschau (16:9, Nr. 9, 10) und Transport (Nr. 11 bis 16); der Tempo-Regler (Nr. 17) kommt laut App-Werten darunter dazu |
| Haupttasten (4) | Nr. 11, 12, 13, 15 | GO/Pause, An den Anfang, Marke zurück, Marke vor; „↑ zurück“ und „↓ vor“ (Nr. 14, 16) bleiben normale Knöpfe |
| `ScreenOutputSection` | Nr. 26 bis 28, 73, 74 | Bildschirmwahl, öffnen, schließen, `windowOpen` aus dem künftigen Ausgabezustand |
| `RemoteControlSection` (Companion) | Nr. 40 bis 46 | Verben und Port 8727; die Capability-Aktionen siehe Nr. 40 bis 44 |
| Handy-Fernbedienung (tool-eigen) | Nr. 29 bis 32, 37, 47 bis 57, 79 bis 86 | Schalter, QR, Adressen, Seite im Abschnitt 4 |
| Schrift (tool-eigen) | Nr. 18 bis 20 | Schriftgröße, Zeilenabstand, Seitenrand |
| Lese-Linie (tool-eigen) | Nr. 21, 22 | Schalter und Position |
| Darstellung (tool-eigen) | Nr. 23 bis 25 | Spiegeln, Fett |
| Skript (Hauptbereich) | Nr. 6 bis 8, 70, 71 | Textfeld und „Datei laden“ |
| Statusleiste | – | heute keine; die Quellen: `master-link` (kein Preload-Zugang), `talent-monitor` (nur `outputOpen`, geglaubt), `fernsteuerung` (nicht gemeldet), `handy` (`remote.running`, gemessen), `tempo` (Konfiguration) |
| Kürzel | Nr. 93 bis 105 | Hook an `window`, bleibt im Live-Bereich und im Ausgabefenster |

## 10 · Befunde für den Umbau (belegt, ohne Wertung als Fehler)

1. **„Talent-Monitor offen“ ist geglaubt, nicht gemessen:** `outputOpen` wird beim Laden aus `output.isOpen()` gelesen und
   danach nur von den eigenen Knöpfen gesetzt (`store/prompter.ts:36-62`). Schließt jemand das Ausgabefenster (Fenster
   schließen, Bildschirm abgezogen, Absturz), bleibt der Store auf `true`; GO scrollt weiter, die Beschriftung bleibt
   „Auf diesen Bildschirm“ und der Knopf „Schließen“ bleibt sichtbar. Das Paket kennt den echten Zustand
   (`packages/output-window/src/index.ts:81-160`), der Prompter liest ihn nicht (Nachmessung 3.3, Risiko 1).
2. **Startfehler der Handy-Fernbedienung unsichtbar:** `setRemote` fängt den Fehler nur mit `console.error`
   (`main/index.ts:152-158`). `remoteEnabled` bleibt `true`, `remote.running` ist `false`, die Adressliste ist leer; die
   Oberfläche zeigt „Keine LAN-Adresse gefunden.“ (`views/OperatorView.tsx:240-242`), auch bei belegtem Port 7781
   (Nachmessung 3.3, Risiko 2). Ebenso unsichtbar: Steuerport 8727 belegt (Nr. 38).
3. **Die Kürzel hängen am Operator-Aufbau:** `usePrompterHotkeys()` wird in `OperatorView` aufgerufen (`:20`) und in
   `PrompterOutputView` (`:9`). Ein neuer Aufbau muss ihn im Live-Bereich behalten, sonst entfällt die Leertaste im
   Hauptfenster (Nachmessung 3.3, Risiko 3).
4. **Das Skript-Textfeld hält die Tasten:** Leertaste im Feld tippt ein Leerzeichen (gewollt); wer GO per Leertaste will, muss
   den Fokus aus dem Feld nehmen. Der Kopfhinweis weist darauf nicht hin und fällt mit dem Kopf weg (Nachmessung 3.3, Risiko 4).
5. **Filter lässt `SELECT` und `BUTTON` durch:** der Hook nimmt nur `INPUT`, `TEXTAREA` und `contentEditable` aus
   (`lib/useHotkeys.ts:8`). Kontrollkästchen und Regler sind `INPUT` und behalten ihre Tasten; auf der Bildschirmauswahl und
   auf fokussierten Knöpfen greift der Hook (abgeleitet, nicht gemessen). Für die Panel-Regel O1 (Leertaste auf Knopf oder
   Schalter geht ans Tool) ist das ein Unterschied: heute schaltet die Leertaste auf einem Kontrollkästchen den Schalter, nicht GO.
6. **Aufteilung und Mindestgröße:** Kopf 56, links Skript, rechts 400 breit; Mindestfenster 940 mal 620
   (`main/index.ts:258-259`). Mit einem offenen 360-breiten Panel bleiben 580 für Skript und Pult; die Nachmessung (3.2)
   rechnet damit, dass das Pult seine Abschnitte durch das Panel ersetzt.
7. **Vorschau ohne Auto-Stopp:** die Vorschau hat kein `onEnd`; nur das Ausgabefenster stoppt am Textende
   (`views/PrompterOutputView.tsx:18`). Ohne offenes Ausgabefenster läuft der Anker über das Ende hinaus weiter, die
   Anzeige klemmt nur optisch (`components/PrompterScroller.tsx:80-85`).
8. **Tempo ohne Grenze am IPC:** der Regler hält 0,2 bis 6; `prompter:setConfig` selbst prüft nichts
   (`main/index.ts:329-335`). Die Fernsteuerung (`speed`, `faster`, `slower`) und die Handy-Seite begrenzen auf 0,2 bis 6.
9. **Farben ohne Oberfläche:** `colors` (Hintergrund, Text, Akzent) wirken in Vorschau und Ausgabe, haben aber keine Bedienung
   (Nr. 116).
10. **Capability-Vorgaben:** die Aktion `speed` trägt in der Capability die Vorgabe 2 (Argument `value`, 0,2 bis 6,
    `packages/suite-control-protocol/src/capabilities.ts:324`); der Hauptprozess liest nur `args[0]` und kennt keine Vorgabe
    (`main/index.ts:103`). Das Argument `modeArg` der Aktion `scroll` ist in der Capability-Datei gemeinsam definiert (Inhalt
    nicht gelesen); der Hauptprozess versteht `on`, `1`, `start`, `off`, `0`, `stop` und sonst Umschalten (Nr. 40).
11. **Tempo und Zeilenabstand hängen zusammen:** Geschwindigkeit in em je Sekunde = Tempo mal Zeilenabstand
    (`main/index.ts:65-68`); wer den Zeilenabstand ändert, ändert die Lesegeschwindigkeit, ohne dass sich der Tempo-Wert ändert.
12. **Kein Theme-Knopf, kein Mac-Ziehbereich:** `html` trägt fest `dark`; der Kopf hat keinen `dragRegion` und keinen Einzug
    für die Mac-Ampel (`titleBarStyle: hiddenInset`, `main/index.ts:264`) — auf dem Mac liegt das Logo unter der Ampel
    (abgeleitet, nicht gemessen).
13. **Dateileser ohne Grenzen:** `readScriptFile` prüft keine Dateigröße und keinen Typ außer der Endung `.docx`; alles andere
    wird als UTF-8 gelesen (Nr. 71).
14. **Nicht gemessen:** das Verhalten des nativen Dateidialogs und der Bildschirmliste im gepackten Build, die Wirkung der
    Leertaste auf fokussierte Knöpfe (Nr. 100), die Darstellung des QR bei sehr langem Token, die Mac-Ampel, ob
    mDNS im LAN sichtbar ist.
