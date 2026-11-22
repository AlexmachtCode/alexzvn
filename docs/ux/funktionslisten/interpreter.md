# Funktionsliste JM Interpreter (Suite-UX-Update, Welle 2a · Interpreter)

Zweck (Spec `docs/superpowers/specs/2026-10-08-suite-ux-update-design.md`, Abschnitt 10 „Kein Funktionsverlust“, und
Anhang A „Interpreter“): jedes Bedienelement mit Handler, jeder Dialog, jede Einstellung, jeder Ablauf der Audio-Engine und des
Hauptprozesses und jeder gemerkte Wert des Interpreters, erhoben **vor dem Umbau** aus dem Code. Nach dem Umbau bekommt jede Zeile in
der Spalte „künftig wo“ einen Haken mit dem Ort im neuen Aufbau; ein Punkt ohne Haken blockiert die Welle.

- **Stand:** erhoben aus dem Code am 2026-11-22, Commit `d7cdd79ce0`, Interpreter 0.2.0 (`apps/interpreter/package.json`). Die
  Nachmessung `docs/ux/welle2-nachmessung-2a.md` (Abschnitt 2) gilt für `0f589c3ee1`; `git diff 0f589c3ee1 HEAD -- apps/interpreter`
  und `git diff d7cdd79ce0 HEAD -- apps/interpreter` waren zum Zeitpunkt der Erhebung (damals HEAD `dac9f53fba`) leer, der Code war
  seither unverändert (letzter Commit an der App `49e919f8a4`, 2026-08-07, Korrektur der Statuszeile des virtuellen Kabels nach dem
  Release 0.2.0 `78d6d6a69e`). Am Ende der Welle 2a gilt das nicht mehr: die Haken in „künftig wo“ nennen die geänderten
  Code-Dateien unter `apps/interpreter/src` (Tests, `package.json` und `tsconfig.test.json` stehen in keinem Haken). Bei der
  Erhebung wurde nichts ausgeführt und kein Fenster geöffnet. Was nur aus dem Code abgeleitet ist, steht als „abgeleitet“, Unklares
  als „unklar“ bzw. „nicht gemessen“. Die Nachmessung hat in 2.1 eine Zeile mit ❌ (Gerätewechsel stoppt die Engine: stimmt nicht) und
  eine mit ✏️ (Zahl der rohen Farben); sie stehen als Nr. 62 und 63. Die drei Risiken 2.3 stehen in Abschnitt 10 (Risiko 1 bis 3 gleich
  Befund 9, 1 und 4); die Pflichtpunkte des Auftrags haben diese Zeilen: Gerätewechsel im Betrieb Nr. 60, 61, 62; Bypass Nr. 29, 58,
  85; Kabel-Erkennung per Gerätename Nr. 68, 69, 70; `localStorage` `jm-interpreter-settings` Nr. 82; Panel-Tasten Nr. 78;
  Mikrofon-Probe beim Start Nr. 65; Haupttaste mit Sperrgrund Nr. 5, 6; Hinweiskarten mit Download-Knopf Nr. 14 bis 23;
  Meter, Ducking und alle Regler Nr. 24 bis 39, 54 bis 59.
- **Gelesen, vollständig:** `apps/interpreter/src/**` (`main/index.ts`, `preload/index.ts`, `shared/api.ts`, `shared/ducking.ts`,
  `shared/virtual-cable.ts`, `renderer/index.html`, `renderer/src/main.tsx`, `App.tsx`, `core/engine.ts`, `store/settings.ts`,
  `jminterpreter.d.ts`, `globals.css`; Dateinamen ohne Vorsatz in dieser Liste liegen unter `apps/interpreter/src/renderer/src`
  bzw. `apps/interpreter/src`), `apps/interpreter/package.json`, `apps/interpreter/electron.vite.config.ts` (Kopf),
  `apps/interpreter/electron-builder.yml` (Kopf), `apps/interpreter/test/selftest.ts` (Kopf und Gliederung). Ausschnitt:
  `.github/workflows/ci-checks.yml` (nur die Suche nach `interpreter`, 0 Treffer, Befund 11), `packages/ui/src/base.css` (nur der Schriftimport).
  Nicht gelesen: `packages/electron-kit/**` (`createMainWindow`, `setupSingleInstance`: Fensterhülle, Mac-Titelleiste, Link-Behandlung),
  `packages/app-runtime/**` (`initAppRuntime`: Absturz- und Protokollschicht, Inhaltssicherheitsrichtlinie), `packages/ui/**` sonst,
  der Rumpf von `test/selftest.ts`. Der Interpreter hatte zum Zeitpunkt der Erhebung keinen Ordner `test/ui` und keine
  `tsconfig.test.json` (0 Oberflächentests, nur `test/selftest.ts` für `ducking.ts` und `virtual-cable.ts`); der Umbau legt sie an.
- **künftig wo** ist nach dem Umbau gefüllt und abgehakt (Aufgabe e, ein Test unter `apps/interpreter/test`, den der Umbau anlegt): jede Zeile
  trägt ein ✓ in genau einer Form: `✓ ‹Ort›`, `✓ unverändert (‹Datei›)`, `✓ entfällt (E…)` oder `✓ ersetzt durch ‹Ort› (E…)`.
  Orte: Rahmen, Kopf, Live-Bereich (Haupttaste, Meter, Ducking-Pille, Überbrückt-Anzeige, Kabel-Karten), Statusleiste, Panel (Abschnitt
  Audiogeräte, Abschnitt Ducking). Der Main, die Engine und alles Unveränderte stehen als `unverändert (‹Datei›)`; Dateien, die nur
  die lesenden Brücken (E2) bekamen, stehen so mit diesem Hinweis im Haken. Dateien in den Haken: ohne Vorsatz im Renderer (core,
  store), mit dem Ordner main, preload oder shared unter `apps/interpreter/src`, mit dem Ordner packages oder docs ab der Repo-Wurzel.
  Wo ein Ablauf oder ein Wortlaut sich ändert, steht es im Haken; der alte Wortlaut, der entfällt oder sich ändert, kommt in die
  Texttabelle von Task Z1.
- **Pfade:** das Kürzel R vor einem Pfad steht für `apps/interpreter/src/renderer/src`, das Kürzel src für `apps/interpreter/src`; die
  Ordner packages, docs und .github sind relativ zur Repo-Wurzel. Zeilennummern gelten für `d7cdd79ce0`. Der Preload heißt
  `window.jminterpreter` und bleibt so; neue Funktionen kommen in dasselbe Objekt.
- **Zustands-Kürzel** (Spalte „Zustand (sichtbar/aktiv)“; `running`, `ducking`, `error` sind Felder von `EngineState`):
  **imm.** = immer sichtbar im Hauptfenster · **aus** = `running` false · **läuft** = `running` true · **Duck** = `ducking` true ·
  **Err** = `error` gesetzt · **Lädt** = `devicesLoaded` noch false (vor der ersten Geräteliste) · **Namen** = `labelsAvailable`
  false (keine Gerätenamen lesbar) · **Pend** = `pendingChange` (Ausgabe-Wert weicht vom Startwert ab, nur im Betrieb) ·
  **Eng** = Engine im Renderer, ohne Oberfläche · **Main** = Hauptprozess, ohne Oberfläche. Es gibt einen einzigen Abschnitt im
  Hauptfenster; Ansichten werden nicht gewechselt (`R/App.tsx:86-179`).
- **Nummerierung:** fortlaufend 1 bis 86 in den Abschnitten 1 bis 7.
  Zeilen je Abschnitt: 1 = 39, 2 = 7, 3 = 29, 4 = 0, 5 = 1, 6 = 5, 7 = 5; zusammen 86.
  Die Abschnitte 8 (IPC-Übersicht), 9 (Zuordnung zu Spec 6 / Anhang A) und 10 (Befunde) haben keine nummerierten Punkte und
  werden nicht abgehakt.
- **Fernsteuerung:** keine. Der Interpreter hat keinen Steuerserver (kein `control-server`, kein Eintrag in
  `packages/suite-control-protocol/src/capabilities.ts`), keine Verben, keinen Master-Link und keinen Kanal `interpreter:fernsteuerung`;
  der Umbau ergänzt weder Meldung noch Abschnitt noch Statuseintrag dafür. Entsprechend entfällt die Verben-Übersicht von Abschnitt 9.
- **`window.confirm`:** keiner (Nr. 40). **`window.prompt`, `window.alert`:** keiner. **`localStorage`:** genau einer, der Schlüssel
  `jm-interpreter-settings` (Nr. 82); **`sessionStorage`**, **`persistId`**: keine (0 Treffer). **Tastatur:** keine Kürzel, kein `keydown`,
  kein `globalShortcut` (Nr. 77). Gemerkt wird nur der `localStorage`-Schlüssel (Abschnitt 7).

---

## 1 · Hauptfenster (Interpreter)

Ein Fenster, eine Ansicht (`App`), einspaltig, Karten untereinander: Kopf mit Haupttaste, Fehlerband, Geräte-Wahl, Kabel-Hinweis,
„Pegel“, „Ducking“, „Vorverstärkung“. Keine Navigation, kein Panel, keine Statusleiste (so zum Zeitpunkt der Erhebung). Alle
Beschriftungen stehen in der Schreibweise des Quelltexts; die Bedienelemente sind einfache `button`-, `select`- und `input`-Elemente
ohne `@jm/ui`.

| Nr. | Bereich | Element | Handler/IPC | Zustand (sichtbar/aktiv) | heute wo | künftig wo |
|---|---|---|---|---|---|---|
|1| Fenster | Aufbau: `App` ist eine einzige Spalte (`mx-auto flex h-full max-w-4xl flex-col gap-4 overflow-y-auto p-6`) mit fünf Blöcken von oben nach unten: Kopf (Titel, Starten/Stoppen), Fehlerband (nur bei Fehler), Geräte-Wahl (drei Auswahlfelder), Kabel-Hinweis (je nach Zustand ein bis zwei Karten), Karte „Pegel“, Karte „Ducking“, Karte „Vorverstärkung“. Kein `AppShell`, kein `@jm/ui`-Bauteil (nur `base.css`), kein Panel, keine Statusleiste, kein Router, keine Ansichten. Die Engine (`InterpreterEngine`) lebt in diesem einen `App` (`useRef`, Nr. 47); `StrictMode` ist an | `App`, `StrictMode` | imm. | `R/App.tsx:86-179`, `R/main.tsx:7-12` | |
|2| Fenster | Fensterhülle: 1100 mal 780, mindestens 900 mal 640, Titel „JM Interpreter“, Symbol `icon.png` aus `resources`, `sandbox`, **`backgroundThrottling: false`** (die Regelschleife läuft im Renderer, Chromium darf ihren Takt nicht drosseln, sonst bleibt der O-Ton bei verdecktem oder minimiertem Fenster abgesenkt oder offen stehen); Renderer aus `ELECTRON_RENDERER_URL` (Entwicklung) oder `renderer/index.html`. Alles Weitere der Hülle (Hintergrundfarbe, Mac-Titelleiste, Links im Fenster, `contextIsolation`) liegt in `createMainWindow` (`packages/electron-kit`), **nicht gelesen** | `createMainWindow` | Main | `src/main/index.ts:26-43` | |
|3| Fenster | Dokument: `<html lang="de" class="dark">`, Titel „JM Interpreter“, ein `div#root`; die Klasse `dark` ist fest gesetzt, es gibt keinen Hell/Dunkel-Schalter und keinen Code, der sie ändert. `globals.css`: Tailwind, `@jm/ui/base.css`, Schrift Manrope, `body` mit `overflow: hidden` und `user-select: none` (Felder wieder wählbar), Markierungsfarbe Gelb auf Dunkel | `index.html`, `globals.css` | imm. | `apps/interpreter/src/renderer/index.html:2-11`, `R/globals.css:1-47` | |
|4| Kopf | Kopf: Titel „JM Interpreter“ (`h1`, fett) und Untertitel „Floor/Dolmetscher-Ducking · Einspeisung in Zoom/Webex“; links bündig, die Haupttaste rechts. Kein Logo, kein `AppHeader`, kein Theme-Knopf, keine Ziehfläche und kein Einzug für die Mac-Ampel (Aussehen auf dem Mac nicht gemessen) | – | imm. | `R/App.tsx:88-92` | |
|5| Haupttaste | **Starten / Stoppen**: ein Knopf, Beschriftung „Starten“ (gelb auf dunkel) bzw. „Stoppen“ (weiß auf rot), je nach `state.running`; ein Klick ruft bei laufendem Betrieb `engine.stop()`, sonst `engine.start({ floorId, interpreterId, outputId })` mit den drei Werten aus dem Speicher (Nr. 49, 52). Kein Kürzel, kein Verb, keine Rückfrage vor dem Stoppen | `toggle`, `engine.start`, `engine.stop` | imm. | `R/App.tsx:81-84`, `R/App.tsx:93-102` | |
|6| Haupttaste | **Sperrgrund der Haupttaste:** `disabled`, solange `floorId` oder `interpreterId` leer ist; dann zeigt der Tooltip (`title`) „Erst beide Eingänge wählen“, sonst keinen Tooltip; Ausgabe zählt nicht. Die Regel gilt **auch bei laufendem Betrieb** (Befund 2), die Taste ist während des Startvorgangs nicht gesperrt (Befund 3), Deckkraft 40 Prozent im gesperrten Zustand | `disabled`, `title` | imm. | `R/App.tsx:95-97` | |
|7| Meldung | **Fehlerband:** roter Kasten mit dem rohen `state.error` (die `message` der Ausnahme, nicht übersetzt), sichtbar nur bei gesetztem Fehler; er wird vom nächsten **erfolgreichen** Start gelöscht, nicht vom Stoppen und nicht vom Gerätewechsel (Befund 6) | `state.error` | Err | `R/App.tsx:105-107`, `R/core/engine.ts:185-188` | |
|8| Einstellung | Auswahlfeld **„Floor (O-Ton)“:** Auswahl der Eingabegeräte, erste Option „— bitte wählen —“ (Wert leer), dann je ein Eintrag je Eingabegerät; jede Wahl wird sofort in den Speicher geschrieben (`floorId`, Nr. 84); im Betrieb **frei bedienbar**, wirkt aber erst nach Stopp und erneutem Start, ohne Hinweis (Nr. 60) | `Picker`, `s.set('floorId')` | imm. | `R/App.tsx:110`, `R/App.tsx:183-213` | |
|9| Einstellung | Auswahlfeld **„Dolmetscher“:** wie „Floor (O-Ton)“, gleiche Geräteliste, Speicherwert `interpreterId`; derselbe Eintrag darf in beiden Feldern gewählt werden (keine Prüfung) | `Picker`, `s.set('interpreterId')` | imm. | `R/App.tsx:111-116` | |
|10| Einstellung | Auswahlfeld **„Ausgabe (virtuelles Kabel)“:** Auswahl der Ausgabegeräte, erste Option „Systemstandard“ (Wert leer, `allowDefault`); Speicherwert `outputId`; im Betrieb frei bedienbar, die Karte „Ausgabegerät wurde geändert“ (Nr. 14) meldet, dass die Änderung erst nach Neustart wirkt; die Kabel-Karten beziehen sich auf das **gestartete** Gerät (Nr. 15) | `Picker allowDefault`, `s.set('outputId')` | imm. | `R/App.tsx:117-123` | |
|11| Einstellung | Geräteliste der drei Felder: `inputs` und `outputs` aus `enumerateDevices`, Beschriftung je Eintrag das Label des Browsers, bei leerem Label Ersatz `‹Art› ‹erste sechs Zeichen der ID›` (z. B. `audioinput 3f9a1c`); Chromium liefert zusätzlich die Sammeleinträge „Standard - …“ bzw. „Default - …“ und „Kommunikation - …“ (abgeleitet, nicht gemessen); es gibt keinen Aktualisieren-Knopf, die Liste zieht sich über `devicechange` nach (Nr. 64). Eine gespeicherte ID, die nicht in der Liste steht, erzeugt bei den zwei Eingängen **keine** Meldung (Befund 5) | `listDevices`, `Picker` | imm. | `R/core/engine.ts:66-89`, `R/App.tsx:204-209` | |
|12| Kabel-Hinweis | **Kabel-Hinweis, Vorbedingung:** `CableStatus` zeigt nichts, bis die erste Geräteliste da ist (`devicesLoaded`); das verhindert, dass eine gespeicherte Ausgabe-ID sofort „nicht verfügbar“ behauptet (Fehlalarm aus #208) | `CableStatus`, `devicesLoaded` | Lädt | `R/App.tsx:16-20`, `R/App.tsx:418-420` | |
|13| Kabel-Hinweis | **Karte „Gerätenamen nicht lesbar“** (gelber Rahmen): „Gerätenamen nicht lesbar — bitte die Mikrofonfreigabe erteilen. Ohne sie kann der Interpreter das virtuelle Kabel nicht erkennen.“; erscheint, wenn kein einziges Gerät ein Label hat; ersetzt dann alle anderen Kabel-Karten (auch die „geändert“-Karte) | `CableStatus` | Namen | `R/App.tsx:422-429` | |
|14| Kabel-Hinweis | **Karte „Ausgabegerät geändert“** (gelb): „Das Ausgabegerät wurde geändert, der Interpreter sendet aber noch auf das beim Start gewählte Gerät. Die Änderung wirkt erst, wenn er **gestoppt und erneut gestartet** wird.“; erscheint, wenn der Betrieb läuft und der Wert des Ausgabe-Feldes vom Startwert abweicht (`pendingChange`); der einzige Gerätewechsel-Hinweis der App (N2a 2.1, Nr. 62) | `CableStatus` | läuft, Pend | `R/App.tsx:431-445` | |
|15| Kabel-Hinweis | **Bezugsgerät der Kabel-Karte:** während des Betriebs (und gesetztem `startedOutputId`) gilt das beim Start gewählte Ausgabegerät, sonst der aktuelle Wert des Feldes; die Karten darunter (Nr. 16 bis 21) beziehen sich auf dieses Gerät | `effectiveOutputId` | imm. | `R/App.tsx:435-436`, `R/App.tsx:446` | |
|16| Kabel-Hinweis | **Karte „Ausgabegerät nicht verfügbar“** (gelb): „Das gewählte Ausgabegerät ist derzeit nicht verfügbar. Der Mix geht auf den Systemstandard und erreicht die Konferenz nicht.“; erscheint, wenn die Ausgabe-ID gesetzt, aber nicht in der Ausgabeliste ist. Ob der zweite Satz stimmt, ist offen (Befund 4, N2a Risiko 3) | `deviceCableNotice` | imm. | `R/App.tsx:320-330` | |
|17| Kabel-Hinweis | **Karte „Kabel erkannt, Gegenseite fehlt“** (gelb): „‹Kabelname› erkannt, aber unter dem Namen ‹Soll-Name› wurde keine Aufnahmeseite gefunden. Mögliche Ursachen: der Treiber ist unvollständig installiert, das Gerät ist in den Windows-Sound-Einstellungen deaktiviert — oder es wurde dort umbenannt.“; Auslöser: Ausgabe passt auf ein bekanntes Kabel, aber keine Eingabe passt auf dessen Gegenstück (Nr. 68) | `deviceCableNotice`, `counterpartPresent` | imm. | `R/App.tsx:335-344` | |
|18| Kabel-Hinweis | **Karte „Kabel erkannt“** (grün, die einzige grüne Fläche): „‹Kabelname› erkannt. In Zoom als Mikrofon wählen: ‹tatsächlich gefundener Geräte-Name›“; der Name kommt aus der Eingabeliste ohne Chromium-Vorsatz (Nr. 70), nicht aus der Konstante | `deviceCableNotice`, `zoomInputDisplayName` | imm. | `R/App.tsx:346-364` | |
|19| Kabel-Hinweis | **Karte „VoiceMeeter erkannt“** (gelb statt grün, `needsRouting`): wie die grüne Karte, dazu der Zusatzsatz je Kabel („Ein- und Ausgang sind nur verbunden, wenn im VoiceMeeter der Bus B1 (B2, B3) auf dem Virtual-Input-Strip aktiviert ist und VoiceMeeter laeuft.“) | `deviceCableNotice`, `routingHint` | imm. | `R/App.tsx:350-358`, `src/shared/virtual-cable.ts:76-108` | |
|20| Kabel-Hinweis | **Karte „Kein virtuelles Kabel gewählt“** (gelb, größer): Überschrift und Absatz zur Funktion des virtuellen Kabels („Zoom und Webex können nur ein Mikrofon abgreifen … Ohne Kabel geht der Mix auf den Systemstandard und erreicht die Konferenz nicht.“), mit Lizenzsatz und Download-Knopf; erscheint bei leerem Ausgabe-Feld (Systemstandard) | `deviceCableNotice` | imm. | `R/App.tsx:367-378` | |
|21| Kabel-Hinweis | **Karte „kein bekanntes virtuelles Kabel“** (gelb, größer): Überschrift „‹Gerätename›: kein bekanntes virtuelles Kabel“ und Absatz („Der Mix geht auf dieses Gerät. Es ist aber kein virtuelles Kabel, das der Interpreter kennt …“), mit Lizenzsatz und Download-Knopf; erscheint, wenn ein Gerät gewählt ist, das auf kein Kabelmuster passt (z. B. Dante, Realtek) | `deviceCableNotice` | imm. | `R/App.tsx:381-394` | |
|22| Kabel-Hinweis | Lizenzsatz unter den zwei großen Karten: „VB-CABLE ist für private Nutzung Donationware; der gewerbliche Einsatz ist lizenzpflichtig.“ | `CableDownloadFooter` | imm. | `R/App.tsx:298-300` | |
|23| Kabel-Hinweis | **Knopf „VB-CABLE herunterladen“:** öffnet über den Hauptprozess die Bezugsquelle `https://vb-audio.com/Cable/` im Standardbrowser; der Aufruf geht über `window.jminterpreter?.openCableDownload()` (fehlt der Preload, passiert nichts), Fehler werden still geschluckt, keine Rückmeldung | `openCableDownload`, Kanal `cable:openDownload` | imm. | `R/App.tsx:301-310`, `src/main/index.ts:15-20`, `src/main/index.ts:62` | |
|24| Pegel | Karte „Pegel“: Titel „Pegel“ und rechts die **Ducking-Pille**: bei `state.ducking` gelb „FLOOR ABGESENKT“, sonst grau „Floor offen“; bei Bypass zeigt sie immer „Floor offen“ (Nr. 29, Befund 7), nach dem Stoppen ebenfalls | `state.ducking` | imm. | `R/App.tsx:136-146`, `R/core/engine.ts:275-277` | |
|25| Pegel | **Meter „Floor“:** Beschriftung links, rechts der Pegel in dBFS mit einer Nachkommastelle („-23.4 dB“) oder „—“ bei Stille und im Stand; gelber Balken 0 bis 100 Prozent mit Übergang 75 ms; ohne Schwellenmarke | `Meter` | imm. | `R/App.tsx:147`, `R/App.tsx:221-240` | |
|26| Pegel | **Meter „Dolmetscher“:** wie „Floor“, zusätzlich eine rote Schwellenmarke (schmale Marke, Tooltip „Schwelle ‹Wert› dB“) an der Stelle des eingestellten Schwellenwerts | `Meter threshold` | imm. | `R/App.tsx:148`, `R/App.tsx:230-236` | |
|27| Pegel | Skala beider Meter: −60 dBFS (0 Prozent) bis 0 dBFS (100 Prozent), darunter nichts mehr sichtbar; `-Infinity` und alles Nichtendliche zeigt 0 Prozent. Die Pegel kommen aus der Engine höchstens etwa alle 66 ms, ein Wechsel des Duck-Zustands sofort (Nr. 59) | `meterWidth` | imm. | `R/App.tsx:215-219` | |
|28| Ducking | Karte „Ducking“, Titel | – | imm. | `R/App.tsx:151-153` | |
|29| Ducking | **Kontrollkästchen „Überbrücken (zum Vergleichshören)“** (Bypass): schaltet das Ducking aus, beide Wege unbearbeitet in den Mix (Nr. 58); Speicherwert `bypass`, **bleibt über Neustarts gemerkt** (Befund 7); wirkt sofort auch im Betrieb; die einzige Anzeige ist das Kästchen selbst, die Pille bleibt auf „Floor offen“ | `s.set('bypass')`, `engine.setBypass` | imm. | `R/App.tsx:154-157`, `R/App.tsx:77-79` | |
|30| Ducking | **Regler „Schwelle“** (dB): −70 bis −10, Schritt 1, Vorgabe −42; Hinweis „Ab diesem Dolmetscher-Pegel wird der O-Ton abgesenkt.“; Anzeige „‹Wert› dB“ oben rechts | `Slider`, `thresholdDb` | imm. | `R/App.tsx:159-160`, `src/shared/ducking.ts:25` | |
|31| Ducking | **Regler „Absenkung“** (dB): −40 bis 0, Schritt 1, Vorgabe −18; Hinweis „Wie weit der O-Ton zurückgeht, solange gesprochen wird.“ | `Slider`, `duckDb` | imm. | `R/App.tsx:161-162`, `src/shared/ducking.ts:26` | |
|32| Ducking | **Regler „Attack“** (ms): 5 bis 300, Schritt 5, Vorgabe 60; Hinweis „Wie schnell abgesenkt wird.“ | `Slider`, `attackMs` | imm. | `R/App.tsx:163-164`, `src/shared/ducking.ts:27` | |
|33| Ducking | **Regler „Release“** (ms): 50 bis 2000, Schritt 10, Vorgabe 400; Hinweis „Wie schnell der O-Ton zurückkommt.“ | `Slider`, `releaseMs` | imm. | `R/App.tsx:165-166`, `src/shared/ducking.ts:28` | |
|34| Ducking | **Regler „Nachlauf“** (ms, intern `holdMs`): 0 bis 1500, Schritt 10, Vorgabe 350; Hinweis „Atempausen kürzer als der Nachlauf reißen den O-Ton nicht hoch (verhindert Pumpen).“ | `Slider`, `holdMs` | imm. | `R/App.tsx:167-168`, `src/shared/ducking.ts:29` | |
|35| Vorverstärkung | Karte „Vorverstärkung“, Titel | – | imm. | `R/App.tsx:171-172` | |
|36| Vorverstärkung | **Regler „Floor“** (Vorverstärkung, dB): −24 bis 12, Schritt 1, Vorgabe 0, ohne Hinweis; wirkt auf den Floor-Weg vor dem Meter und vor dem Ducking (Nr. 57) | `Slider`, `floorGainDb` | imm. | `R/App.tsx:173`, `src/shared/ducking.ts:30` | |
|37| Vorverstärkung | **Regler „Dolmetscher“** (Vorverstärkung, dB): −24 bis 12, Schritt 1, Vorgabe 0; wirkt auf den Dolmetscher-Weg vor dem Meter und damit auf das Auslösen des Duckings | `Slider`, `interpreterGainDb` | imm. | `R/App.tsx:174`, `src/shared/ducking.ts:31` | |
|38| Vorverstärkung | **Knopf „Ducking-Werte zurücksetzen“:** setzt die sieben Werte Schwelle, Absenkung, Attack, Release, Nachlauf und beide Vorverstärkungen auf die Vorgaben (Nr. 30 bis 37); **nicht** zurückgesetzt werden Bypass und die drei Geräte; keine Rückfrage; steht in der Karte „Vorverstärkung“, nicht in „Ducking“ (Befund 8) | `s.reset`, `DEFAULT_SETTINGS` | imm. | `R/App.tsx:175-177`, `R/store/settings.ts:23` | |
|39| Ducking | Regler und Vorverstärkung wirken **sofort auch im Betrieb**: bei jeder Änderung des Speichers (jeder Regelschritt) ruft der Renderer `engine.setSettings(duckSettings(s))` und separat bei Bypass-Wechsel `engine.setBypass`; die Geräte-IDs gehören nicht dazu (Nr. 60) | `useEffect`, `setSettings`, `setBypass` | imm. | `R/App.tsx:73-79`, `R/core/engine.ts:136-148` | |

## 2 · Dialoge und Meldungen

Der Interpreter hat keinen Dialog, keinen Toast und keine Rückfrage. Meldungen laufen über die Karten und das Fehlerband des
Hauptfensters (Abschnitt 1, Nr. 7 und 13 bis 21); dazu zwei Tooltips. Die Texte stehen in der Schreibweise des Quelltexts.

| Nr. | Bereich | Element | Handler/IPC | Zustand (sichtbar/aktiv) | heute wo | künftig wo |
|---|---|---|---|---|---|---|
|40| Rückfrage | **Kein `window.confirm`, kein `window.prompt`, kein `window.alert`, kein Dialog über dem Fenster, kein Toast** (Suche über `apps/interpreter/src`, 0 Treffer). Auch „Stoppen“, „Ducking-Werte zurücksetzen“, das Umstellen der Geräte im Betrieb und das Schließen des Fensters fragen nicht zurück; Schließen beendet die App samt laufender Einspeisung | – | imm. | `apps/interpreter/src` (Suche), `src/main/index.ts:68-70` | |
|41| Freigabe | Mikrofon-Freigabe: der Hauptprozess erlaubt im Standard-Sitzungsobjekt nur die Berechtigung `media` und lehnt alles andere ab (Anfrage-Hörer und Prüf-Hörer); es gibt keine Rückfrage der App. Ob das Betriebssystem beim ersten Zugriff fragt (Windows-Datenschutz, Mac), ist nicht gemessen | `setPermissionRequestHandler`, `setPermissionCheckHandler` | Main | `src/main/index.ts:59-60` | |
|42| Fehlertext | Fehlertexte des Starts: es gibt keinen eigenen Wortlaut; jede Ausnahme in `start()` (Gerät nicht zu öffnen, Freigabe verweigert, `setSinkId` abgelehnt, `play` abgelehnt) erscheint als rohe `message` des Browsers im Fehlerband (Nr. 7), z. B. aus `getUserMedia` mit einer nicht vorhandenen Geräte-ID (nicht gemessen, welche Texte Chromium dort liefert) | `catch` | Err | `R/core/engine.ts:185-189` | |
|43| Meldung | Die übrigen Meldungen sind die Karten und Pillen des Hauptfensters: Fehlerband (Nr. 7), „Gerätenamen nicht lesbar“ (Nr. 13), „Ausgabegerät geändert“ (Nr. 14), „nicht verfügbar“ (Nr. 16), „Gegenseite fehlt“ (Nr. 17), „Kabel erkannt“ (Nr. 18), „VoiceMeeter“ (Nr. 19), „Kein Kabel gewählt“ (Nr. 20), „kein bekanntes Kabel“ (Nr. 21), Pille „FLOOR ABGESENKT / Floor offen“ (Nr. 24), Sperr-Tooltip (Nr. 6), Schwellen-Tooltip (Nr. 26) | – | imm. | `R/App.tsx:105`, `R/App.tsx:139-145` | |
|44| Protokoll | Der Interpreter schreibt selbst keine Protokollzeile (kein `console`, kein Logger im eigenen Code, Suche über `apps/interpreter/src`); `initAppRuntime` bringt die Absturz- und Protokollschicht der Suite mit (nicht gelesen) | `initAppRuntime` | Main | `src/main/index.ts:12` | |
|45| Tooltip | Tooltips (`title`): „Erst beide Eingänge wählen“ (Nr. 6) und „Schwelle ‹Wert› dB“ an der Schwellenmarke (Nr. 26); alle anderen Elemente haben keinen | `title` | imm. | `R/App.tsx:96`, `R/App.tsx:232` | |
|46| Platzhalter | Auswahltexte der leeren Wahl: „— bitte wählen —“ (die zwei Eingänge) und „Systemstandard“ (Ausgabe) | `Picker` | imm. | `R/App.tsx:204` | |

## 3 · Abläufe ohne eigenes Bedienelement (Audio-Engine, Gerätelisten, Hauptprozess)

Die gesamte Audio-Kette lebt im Renderer (Web Audio); der Hauptprozess ist bewusst dünn (Berechtigung, Download-Kanal, Fenster). Die
Zeilen zur Engine tragen das Kürzel **Eng**.

| Nr. | Bereich | Element | Handler/IPC | Zustand (sichtbar/aktiv) | heute wo | künftig wo |
|---|---|---|---|---|---|---|
|47| Engine | **Lebensdauer der Engine:** `App` legt die Engine einmal an (`useRef`, Konstruktor ohne Nebenwirkung, damit die verworfene Instanz des doppelten `StrictMode`-Durchlaufs unschädlich bleibt) und meldet sich im Effekt an; der Aufräumschritt ruft `engine.destroy()` (Stop und Hörer löschen). Wird `App` in der neuen Oberfläche umgehängt oder neu eingehängt (Panel auf und zu, Wechsel des Rahmens), stoppt `destroy()` die laufende Einspeisung in die Konferenz (N2a 2.3 Risiko 1, Befund 9). Im Entwicklungsmodus ruft `StrictMode` den Aufräumschritt einmal beim Einhängen auf (abgeleitet) | `useRef`, `useEffect`, `destroy` | imm. | `R/App.tsx:6-30`, `R/core/engine.ts:283-286` | |
|48| Engine | Zustandsabo: `engine.subscribe` ruft bei jeder Zustandsänderung `setState(engine.getState())` (Kopie); `EngineState` hat die Felder `running`, `ducking`, `floorDb`, `interpreterDb`, `error`, `startedOutputId` (Nr. 15) | `subscribe`, `getState`, `patch` | Eng | `R/core/engine.ts:27-41`, `R/core/engine.ts:120-134` | |
|49| Engine | **Start:** (1) `stop()` zuerst, (2) neuer `AudioContext` mit `latencyHint: 'interactive'`, (3) Floor-Eingang öffnen, dann Dolmetscher-Eingang (`getUserMedia` mit `deviceId: exact`, leere ID heißt Systemstandard), (4) je ein Verstärkungsknoten mit der Vorverstärkung, (5) je ein Messknoten (`fftSize` 2048) hinter der Vorverstärkung, (6) Ziel `MediaStreamAudioDestination`, Verdrahtung beider Wege in den Mix, (7) `route(outputId)`, (8) `ctx.resume()`, (9) Ducking-Zustand zurücksetzen, Regeltakt starten, (10) `running` true, `error` leer, `startedOutputId` = gewähltes Ausgabegerät. Die Geräte-IDs werden **nur hier** gelesen (Nr. 60) | `start` | Eng | `R/core/engine.ts:150-190` | |
|50| Engine | Aufnahme ohne Aufbereitung: beide Eingänge werden mit `echoCancellation`, `noiseSuppression` und `autoGainControl` jeweils aus geöffnet, damit die Aufbereitung die Ducking-Regelung nicht verfälscht | `RAW_AUDIO`, `open` | Eng | `R/core/engine.ts:20-25`, `R/core/engine.ts:213-217` | |
|51| Engine | **Ausgabe:** der Mix läuft über ein unsichtbares `Audio`-Element (`srcObject` = Mix-Strom, `autoplay`); bei gesetzter Ausgabe-ID wird `setSinkId` darauf gerufen, danach `play()`; ohne ID spielt das Element auf dem Systemstandard. Das Element ist der ganze Weg zum virtuellen Kabel, aus dem Zoom oder Webex den Ton als Mikrofon greifen; es gibt kein eigenes Gerät (bräuchte einen signierten Treiber, außerhalb des Umfangs) | `route`, `setSinkId` | Eng | `R/core/engine.ts:219-236` | |
|52| Engine | **Stopp:** Regeltakt anhalten, `Audio`-Element pausieren und verwerfen, alle Spuren beider Eingänge stoppen, Knoten verwerfen, `AudioContext` schließen (Fehler still), dann `running`, `ducking` aus, beide Pegel auf −Unendlich, `startedOutputId` leer; `error` bleibt stehen (Nr. 7). Der Stopp läuft auch am Anfang jedes Starts und im Fehlerfall | `stop` | Eng | `R/core/engine.ts:192-211` | |
|53| Engine | **Fehlerfall des Starts:** jede Ausnahme in `start()` ruft `stop()` und setzt danach `error` auf `message` (bzw. den Text der Ausnahme); die Taste bleibt auf „Starten“, es gibt keine Wiederholung. Wirft `setSinkId` bei einer nicht vorhandenen Ausgabe-ID, stoppt der Start also, statt auf den Systemstandard zu fallen (abgeleitet, nicht gemessen; Befund 4) | `start` (catch) | Err | `R/core/engine.ts:186-189` | |
|54| Engine | **Regeltakt:** `setInterval` alle 10 ms (bewusst nicht `requestAnimationFrame`, das bei verdecktem Fenster ruht): Effektivwert des Dolmetscher-Weges lesen, Entscheidung treffen, Verstärkung des Floor-Weges anfahren, Floor-Pegel lesen, Pegel melden (Nr. 59); ohne Kontext oder Knoten tut der Takt nichts | `tick` | läuft | `R/core/engine.ts:1-19`, `R/core/engine.ts:238-262` | |
|55| Engine | **Ducking-Entscheidung** (reine Logik, ohne Web-Audio): Dolmetscher-Pegel über der Schwelle heißt „spricht“, dann Absenkung an und Nachlauf neu gesetzt; unter der Schwelle endet die Absenkung erst, wenn die Nachlaufzeit abgelaufen ist (Pumpen-Schutz); Zielverstärkung des Floors = Vorverstärkung, bei Absenkung zusätzlich die Absenkung in dB; Zeitkonstante = Attack bzw. Release geteilt durch 1000 und durch 3, mindestens 0,001 s | `step`, `dbToGain`, `rmsDb` | läuft | `src/shared/ducking.ts:67-93` | |
|56| Engine | Rampe nur bei Zieländerung: `setTargetAtTime` wird nur bei **geändertem** Ziel erneut aufgerufen (sonst käme die Exponentialrampe nie an); `setSettings` und `setBypass` setzen den Merker zurück, damit der Floor neu angefahren wird | `ramp`, `lastTarget` | läuft | `R/core/engine.ts:107`, `R/core/engine.ts:264-268` | |
|57| Engine | **Vorverstärkung:** der Dolmetscher-Weg bekommt bei jeder Änderung `setTargetAtTime(…, 0,01)` direkt in `setSettings`; der Floor-Weg wird über die Regelschleife (Nr. 54) angefahren; gemessen wird **hinter** der Vorverstärkung („was man hört, löst auch aus“) | `setSettings` | läuft | `R/core/engine.ts:136-142`, `R/core/engine.ts:173-177` | |
|58| Engine | **Bypass:** bei gesetztem Bypass setzt jeder Takt den Ducking-Zustand zurück und fährt den Floor auf seine Vorverstärkung (Zeitkonstante 0,01 s); es gibt keine Absenkung; die Vorverstärkung beider Wege **bleibt** wirksam (Bypass heißt „ohne Ducking“, nicht „ohne Pegel“); der Pegel des Dolmetschers wird weiter gemessen und angezeigt; die Meldung `ducking` ist bei Bypass immer false | `setBypass`, `tick` | läuft | `R/core/engine.ts:144-148`, `R/core/engine.ts:251-253`, `R/core/engine.ts:275-277` | |
|59| Engine | **Meldetakt:** Pegel höchstens alle 66 ms an die Oberfläche; ein Wechsel des Ducking-Zustands wird sofort gemeldet (die Bedingung ist: gleicher Zustand **und** unter 66 ms seit der letzten Meldung ergibt keine Meldung) | `publish` | läuft | `R/core/engine.ts:270-281` | |
|60| Engine | **Gerätewechsel im Betrieb, Eingänge (Pflichtzeile):** wer „Floor (O-Ton)“ oder „Dolmetscher“ im laufenden Betrieb umstellt, ändert nur den Speicher; die Engine liest die IDs ausschließlich in `start()`, die Ströme bleiben die alten; die Umstellung wirkt **erst nach Stopp und erneutem Start**; **es gibt keinen Hinweis** (kein Text, keine Karte, kein Tooltip) | `start`, `Picker` | läuft | `R/core/engine.ts:150-162`, `R/App.tsx:110-116` | |
|61| Engine | **Gerätewechsel im Betrieb, Ausgabe (Pflichtzeile):** gleiches Verhalten, `route()` läuft nur in `start()`; der Mix bleibt auf dem beim Start gewählten Gerät; **nur hier** warnt die Oberfläche (Karte „Ausgabegerät geändert“, Nr. 14) und zeigt die Kabel-Karte für das **gestartete** Gerät (Nr. 15) | `route`, `pendingChange` | läuft, Pend | `R/core/engine.ts:179`, `R/App.tsx:435-445` | |
|62| N2a 2.1 (❌) | **N2a 2.1, Aussage „Ein Gerätewechsel stoppt heute die laufende Engine (App.tsx:82)“ ist falsch:** `App.tsx:82` ist das Stoppen im Start/Stopp-Knopf. **Heutiges Verhalten:** ein Gerätewechsel im Betrieb stoppt **nichts**; der Mix läuft auf dem alten Gerät weiter (Nr. 60, 61); der feste Paket-Text „Ein Wechsel stoppt die laufende Verarbeitung“ stimmte also nicht, Entscheidung E10 und Owner-Vorschlag 6 setzen „Wirkt erst nach Stopp und erneutem Start.“ für alle drei Wahlen | `toggle` | läuft | `R/App.tsx:81-84`, `R/core/engine.ts:150-162` | |
|63| N2a 2.1 (✏️) | **N2a 2.1, Zahl der rohen Farben (Anhang A: 46, Nachmessung: 48):** heute 48 rohe Farbstellen (Klassen `bg`, `text`, `border`, `accent` mit `neutral`, `red`, `yellow`, `emerald`, `white`) in `App.tsx`, 0 `#hex` und 0 `rgb()` in Anführungszeichen; mit dem Umbau auf Tokens fällt das weg (N2a Frage 2) | Tailwind-Klassen | imm. | `R/App.tsx:87-449` | |
|64| Geräte | **Geräteliste laden:** beim Einhängen einmal `listDevices(!knownLabels)`; die Ergebnisse (Eingänge, Ausgänge, `labelsAvailable`) gehen nur durch, wenn der Aufruf der jüngste ist (Zählerstand `generation`); `devicesLoaded` wird erst mit dem ersten Ergebnis wahr (Nr. 12) | `listDevices`, `generation` | imm. | `R/App.tsx:41-58`, `R/App.tsx:65` | |
|65| Geräte | **Mikrofon-Probe beim Start (Pflichtzeile):** solange noch keine echten Gerätenamen bekannt sind, öffnet `listDevices` zuerst `getUserMedia({ audio: true })` auf dem Standardgerät und schließt alle Spuren sofort wieder (damit der Browser die Namen herausgibt); eine verweigerte Freigabe wird still geschluckt und die Liste ohne Namen angezeigt; sobald einmal Namen da waren (`knownLabels`), entfällt die Probe bei jedem späteren Nachladen; bleiben die Namen aus, wiederholt sie sich bei jedem `devicechange` | `listDevices(withProbe)` | Lädt | `R/core/engine.ts:55-78`, `R/App.tsx:43-56` | |
|66| Geräte | `labelsAvailable` ist wahr, sobald **irgendein** Gerät ein nicht leeres Label hat; nur Eingänge und Ausgänge der Arten `audioinput` und `audiooutput` werden übernommen | `listDevices` | imm. | `R/core/engine.ts:79-88` | |
|67| Geräte | **Liste nachziehen ohne Neustart:** auf `devicechange` (Windows meldet es bei einer Treiberinstallation mehrfach) wartet ein nachlaufender Zeitgeber 500 ms und lädt dann neu; ein älterer, langsamerer Aufruf darf einen jüngeren nicht überschreiben (Zählerstand); beim Abbau werden Hörer und Zeitgeber entfernt. Wer VB-CABLE nachinstalliert, sieht die Hinweiskarte ohne Neustart verschwinden | `devicechange`, `debounceTimer` | imm. | `R/App.tsx:32-71` | |
|68| Kabel | **Kabel-Erkennung per Gerätename (Pflichtzeile):** `detectCable(label)` prüft den Namen des gewählten **Ausgabegeräts** gegen eine **feste Liste** von acht Mustern (Nr. 69); kein Treffer heißt „unbekanntes Gerät“, kein Fehler; `counterpartPresent(kind, inputLabels)` prüft, ob unter den Eingabegeräten das Gegenstück existiert. Es gibt keine Heuristik „ähnlich benanntes Gerät“ (Dante meldet Sende- und Empfangsgerät, die nicht verbunden sind) | `detectCable`, `counterpartPresent` | imm. | `src/shared/virtual-cable.ts:9-12`, `src/shared/virtual-cable.ts:111-123` | |
|69| Kabel | Die acht Kabelarten (Kennung, Anzeigename, Ausgabe-Muster, Soll-Name der Aufnahmeseite): `vb-cable` VB-CABLE „CABLE Output (VB-Audio Virtual Cable)“; `vb-cable-a`, `-b`, `-c`, `-d` VB-CABLE A bis D („CABLE-A Output (VB-Audio Cable A)“ usw.); `voicemeeter-aux` VoiceMeeter AUX; `voicemeeter-vaio3` VoiceMeeter VAIO3; `voicemeeter` VoiceMeeter („VoiceMeeter Output (VB-Audio VoiceMeeter VAIO)“). Die drei VoiceMeeter-Arten tragen `needsRouting` und einen Routing-Satz (Bus B2, B3, B1); alle Muster sind Teilstring-Ausdrücke ohne Zeilenanfang und ohne Beachtung der Groß-/Kleinschreibung | `CABLE_KINDS` | Eng | `src/shared/virtual-cable.ts:40-109` | |
|70| Kabel | **Name für Zoom:** `zoomInputDisplayName` nimmt den **tatsächlich gefundenen** Eingabenamen und entfernt die Chromium-Vorsätze „Standard - “, „Default - “ und „Kommunikation - “ (auch mehrfach), die Zoom nicht zeigt; nur wenn nichts gefunden wird, gilt der Soll-Name der Kabelart | `zoomInputDisplayName`, `stripDevicePrefix` | imm. | `src/shared/virtual-cable.ts:125-148` | |
|71| Hauptprozess | **Download-Kanal:** `ipcMain.handle('cable:openDownload')` ruft `shell.openExternal` mit der festen Adresse `https://vb-audio.com/Cable/`; der Kanal nimmt bewusst **keine** Adresse an (kein offener `openExternal` aus dem Renderer) | `cable:openDownload` | Main | `src/main/index.ts:15-20`, `src/main/index.ts:62` | |
|72| Hauptprozess | **Einzelinstanz:** ein zweiter Start holt das vorhandene Fenster nach vorn (wiederherstellen, zeigen, fokussieren) oder legt es neu an; auf dem Mac legt `activate` bei geschlossenem Fenster ein neues an | `setupSingleInstance`, `showOrCreateWindow` | Main | `src/main/index.ts:45-56`, `src/main/index.ts:65` | |
|73| Hauptprozess | **Beenden:** sind alle Fenster zu, beendet sich die App (nicht auf dem Mac); eine laufende Einspeisung endet damit ohne Rückfrage | `window-all-closed` | Main | `src/main/index.ts:68-70` | |
|74| Hauptprozess | Start der Laufzeitschicht: `initAppRuntime` mit `csp: true`, Kennung `jm-interpreter`, Name „JM Interpreter“; keine nativen Abhängigkeiten, deshalb in der CI baubar; kein Steuerserver, kein Master-Link, kein Deep-Link, kein Tray, kein Anwendungsmenü im eigenen Code | `initAppRuntime` | Main | `src/main/index.ts:12` | |
|75| Speicher | **Speichern und Laden:** der Speicher `useSettings` (zustand mit `persist`) schreibt bei jeder Änderung (jeder Regelschritt) und liest beim Start, ohne Version, ohne Prüfung und ohne Klemmen der Werte; Einzelheiten Nr. 82 | `persist` | imm. | `R/store/settings.ts:14-31` | |

## 4 · Zusatzfenster

Keine. Der Interpreter hat genau ein `BrowserWindow` (`src/main/index.ts:26-43`); kein Tray, kein Menü im eigenen Code, kein
Einstellungsfenster, keine Seite im Netz. Abschnitt 4 hat 0 Zeilen.

## 5 · Ausgabefenster (nur Abgrenzung, bleibt unverändert)

| Nr. | Bereich | Element | Handler/IPC | Zustand (sichtbar/aktiv) | heute wo | künftig wo |
|---|---|---|---|---|---|---|
|76| Ausgabe | Der Interpreter hat **kein Ausgabefenster** (kein Vollbild, kein `@jm/output-window`, kein Kanal `output:zustand`, keine NDI-Quelle); seine Ausgabe ist Ton: der Mix auf dem gewählten Ausgabegerät (Nr. 51), gespielt vom Renderer des Hauptfensters, das deshalb unter jeder Bedingung geladen bleiben muss (Nr. 47) | – | – | `R/core/engine.ts:219-236`, `src/main/index.ts:26-43` | |

## 6 · Tastatur (Pflichtpunkt Spec 10)

Der Interpreter hat **keine Tastaturkürzel**. Der Abschnitt hält außerdem fest, wie die Felder heute auf die Tastatur reagieren.

| Nr. | Bereich | Element | Handler/IPC | Zustand (sichtbar/aktiv) | heute wo | künftig wo |
|---|---|---|---|---|---|---|
|77| Kürzel | Keine Kürzel im Hauptfenster: kein `keydown`-Hörer, kein `onKeyDown`, kein `globalShortcut`, kein `before-input-event`, kein eigenes Anwendungsmenü (Suche über `apps/interpreter/src`, 0 Treffer); Leertaste und Enter am Haupttaste-Knopf lösen nur dessen Klick aus (Standard des Browsers, wenn der Knopf den Fokus hat). Es gibt weder Kürzel für Start/Stopp noch für Bypass | – | imm. | `apps/interpreter/src` (Suche), `R/App.tsx:93-102` | |
|78| Panel-Tasten | **Panel-Tasten nach O1 (gilt im neuen Aufbau):** Felder behalten ihre Tasten (Auswahlfelder, Regler, Kontrollkästchen: Leertaste und Pfeile gehören dem Feld); Leertaste auf einem Knopf oder Schalter im Panel geht ans Tool, und weil der Interpreter keine Kürzel hat, geschieht dabei nichts außer dem Klick des Knopfes; Escape schließt das Panel und sonst nichts; heute gibt es kein Panel, die Zeile ist Pflichtpunkt des Umbaus | `panelTaste` (neu) | imm. | `packages/ui/src/components/SettingsPanel.tsx:49-63`, `apps/interpreter/src` (Suche) | |
|79| Tasten im Feld | Regler (`type=range`, sieben Stück: fünf Ducking-Werte und zwei Vorverstärkungen, Nr. 30 bis 37): Pfeile links/rechts bzw. oben/unten ändern um einen Schritt, Bild auf/ab und Pos1/Ende springen (Standard des Browsers); jeder Schritt wirkt sofort über `onChange` und schreibt den Speicher | `<input type=range>` | imm. | `R/App.tsx:269-277` | |
|80| Tasten im Feld | Auswahlfelder (drei): Pfeiltasten wechseln den Wert und lösen die Wahl aus (jeder Schritt ist ein Speicherwert, im Betrieb ohne Wirkung auf die Engine, Nr. 60), Buchstaben springen zum passenden Eintrag (Standard des Browsers) | `<select>` | imm. | `R/App.tsx:199-210` | |
|81| Tasten im Feld | Knöpfe und Kontrollkästchen: Enter und Leertaste lösen den Klick aus, die Leertaste schaltet „Überbrücken“; Tab-Reihenfolge ist die Reihenfolge im Dokument (Haupttaste, drei Auswahlfelder, Download-Knopf falls sichtbar, Kästchen, Regler, Reset); die Karten selbst sind kein Fokusziel | `<button>`, `<input>` | imm. | `R/App.tsx:93-102`, `R/App.tsx:154-157`, `R/App.tsx:175-177` | |

## 7 · Gemerkte Zustände (`localStorage` des Fensters)

Gemerkt wird in genau einem `localStorage`-Schlüssel des Renderers und in nichts sonst (keine Datei im Benutzerordner, keine
Konfigurationsdatei des Hauptprozesses, kein `persistId`).

| Nr. | Bereich | Element | Handler/IPC | Zustand (sichtbar/aktiv) | heute wo | künftig wo |
|---|---|---|---|---|---|---|
|82| Speicher | **`localStorage`-Schlüssel `jm-interpreter-settings`** (Pflichtzeile): der gesamte `zustand`-Speicher, JSON im `localStorage` des Fensters (Ablage im Profil der App, abgeleitet); gespeichert werden die Felder `thresholdDb`, `duckDb`, `attackMs`, `releaseMs`, `holdMs`, `floorGainDb`, `interpreterGainDb`, `floorId`, `interpreterId`, `outputId`, `bypass`; die Funktionen `set` und `reset` fallen beim Schreiben als JSON weg; kein `partialize`, keine Version, keine Umstellung alter Stände, geladene Werte werden nicht geprüft | `persist`, Name `jm-interpreter-settings` | imm. | `R/store/settings.ts:14-31` | |
|83| Einstellung | Gemerkte Ducking-Werte und Vorgaben: Schwelle −42 dB, Absenkung −18 dB, Attack 60 ms, Release 400 ms, Nachlauf 350 ms, Vorverstärkung Floor 0 dB, Vorverstärkung Dolmetscher 0 dB (Nr. 30 bis 37); „Ducking-Werte zurücksetzen“ schreibt diese Vorgaben zurück (Nr. 38) | `DEFAULT_SETTINGS` | imm. | `src/shared/ducking.ts:24-32`, `R/store/settings.ts:23` | |
|84| Einstellung | Gemerkte Geräte: `floorId`, `interpreterId`, `outputId`, jeweils leer vorbelegt; **nur die Geräte-ID des Browsers wird gespeichert, nie der Name** (kein `lastLabel`); die IDs können sich ändern, wenn die Freigabe sich ändert (nicht gemessen); steht eine gespeicherte ID nicht in der Liste, sieht der Operator bei den Eingängen nichts Besonderes (Befund 5), bei der Ausgabe die Karte „nicht verfügbar“ (Nr. 16) | `s.set` | imm. | `R/store/settings.ts:6-8`, `R/store/settings.ts:20-22` | |
|85| Einstellung | Gemerkter Bypass: `bypass` (Vorgabe aus), **bleibt über Neustarts bestehen**; der Renderer reicht ihn beim Einhängen an die Engine (Nr. 29, Befund 7) | `bypass` | imm. | `R/store/settings.ts:9`, `R/store/settings.ts:24`, `R/App.tsx:77-79` | |
|86| nicht gemerkt | **Nicht gemerkt** (alles im Speicher der Sitzung, mit der App weg): `running` (nach dem Start immer aus, auch wenn die App mit laufender Einspeisung beendet wurde), `error`, `startedOutputId`, Pegel, Ducking-Pille, die Geräteliste, `labelsAvailable`, `devicesLoaded`; Fensterlage und -größe (Start immer 1100 mal 780); Hell/Dunkel gibt es nicht (Klasse `dark` fest). **Kein `persistId`, kein `sessionStorage`, keine Datei im Benutzerordner, keine Konfigurationsdatei** (Suche über `apps/interpreter/src`; außer `jm-interpreter-settings` 0 Treffer) | – | imm. | `apps/interpreter/src` (Suche), `R/core/engine.ts:110-117` | |

## 8 · IPC-Übersicht `window.jminterpreter` (Preload `src/preload/index.ts`)

Der Preload legt das Objekt `window.jminterpreter` an (Typ `JmInterpreterApi`, `src/shared/api.ts:3-11`, Erklärung in
`R/jminterpreter.d.ts`); bei ausgeschalteter Kontextisolation hängt er es direkt an `window` (`src/preload/index.ts:13-18`). Keine
Master-Link-Funktion (`masterLink`, `onMasterLink`), kein Fernsteuerungs-Zustand und kein Ausgabe-Zustand (`output:zustand`): Der
Interpreter bekommt keine Fernsteuerung (Entscheidung E10 und Teil 2 der Welle-2a-Regeln); ob die lesende Master-Link-Brücke (E2)
auch hier ergänzt wird, entscheidet der Umbau. Der einzige Kanal trägt das Präfix `cable:`, nicht den App-Namen; ein Ereignis vom Hauptprozess in den
Renderer gibt es nicht.

| Funktion | Kanal | Richtung | Wirkung |
|---|---|---|---|
| `platform` | – | – | `process.platform`; im Renderer nirgends benutzt (Suche, Befund 13) |
| `openCableDownload()` | `cable:openDownload` | invoke | öffnet `https://vb-audio.com/Cable/` im Standardbrowser (Nr. 71, 23); nimmt keine Adresse an |

Hauptprozess, nicht über den Preload: Berechtigung `media` (Nr. 41), Einzelinstanz (Nr. 72), Beenden (Nr. 73).

## 9 · Einstellungen nach Spec 6 / Anhang A (Zuordnung der Ist-Elemente)

Die Spalte „Nr.“ ordnet die heutigen Elemente den Bausteinen der Spec und den Entscheidungen der Welle 2a zu (Quelle:
`docs/ux/welle2-nachmessung-2a.md` 2.2, Entscheidung E10). Der Interpreter hat keine Verben und keine Fernsteuerung; eine
Verben-Übersicht gibt es nicht.

| Ist-Element | Nr. | Baustein im neuen Aufbau |
|---|---|---|
| Haupttaste Starten/Stoppen mit Sperrgrund „Erst beide Eingänge wählen“ | 5, 6 | Haupttaste (Spec 3.4), `live` bei `running` (E4), Sperrgrund bleibt |
| Meter Floor und Dolmetscher, Ducking-Pille | 25, 26, 24 | Live-Bereich; „Überbrückt“ bei `bypass` (E10) |
| Kabel-Hinweiskarten, Download-Knopf, Lizenzsatz | 12 bis 23 | Live-Bereich unter den Metern, tool-eigen (`CableStatus`) |
| Auswahlfelder Floor, Dolmetscher, Ausgabe | 8, 9, 10 | `AudioDeviceSection` mit drei Wahlen (Eingänge Pflicht, Ausgabe „Systemstandard“), Fähigkeiten `level` an, `refresh` aus; `changeWarning` aller drei = „Wirkt erst nach Stopp und erneutem Start.“ (E10), kein `lockedReason` |
| Statuseinträge `floor`, `dolmetscher`, `ausgabe`, `ducking`, `fehler`, `master-link` | 13 bis 21, 7, 24 | Statusleiste (neu); Quellen wie in `docs/ux/welle2-nachmessung-2a.md` 2.2 |
| Regler Schwelle, Absenkung, Attack, Release, Nachlauf; Vorverstärkung Floor und Dolmetscher | 30 bis 37 | tool-eigener Abschnitt „Ducking“ im Panel |
| Bypass „Überbrücken“, „Ducking-Werte zurücksetzen“ | 29, 38 | tool-eigener Abschnitt „Ducking“ im Panel (Bypass in Anhang A nicht genannt, Nachmessung 2.1) |
| Engine mit Mikrofon-Probe | 47, 65 | bleibt in einer Komponente, die über Panel-Wechsel stabil ist (N2a 2.3 Risiko 1) |
| Bestandstests (bleiben) | – | `apps/interpreter/test/selftest.ts` (Selbsttest von `ducking.ts` und `virtual-cable.ts`, Skript `selftest`); der Lauf steht **nicht** im Job „Selbsttests“ von `.github/workflows/ci-checks.yml` (Befund 11) |

## 10 · Befunde für den Umbau (belegt, ohne Wertung als Fehler)

1. **Gerätewechsel im Betrieb wirkt erst nach Stopp und Start, gewarnt wird nur bei der Ausgabe:** die Engine liest die Geräte-IDs
   nur in `start()` (`R/core/engine.ts:150-162`, `:179`); die Wahl im Feld ändert nur den Speicher. Die Karte „Ausgabegerät geändert“
   gibt es nur für das Ausgabegerät (`R/App.tsx:435-445`); bei Floor und Dolmetscher sieht der Operator ein Feld mit neuem Wert, während
   der Mix mit dem alten Gerät weiterläuft (Nr. 60, 61). Die Aussage in Anhang A, ein Wechsel stoppe die Engine, stimmt nicht (Nr. 62; N2a Risiko 2).
2. **Die Haupttaste ist auch bei laufendem Betrieb gesperrt, sobald ein Eingang leer ist:** `disabled={!s.floorId || !s.interpreterId}`
   gilt unabhängig von `running` (`R/App.tsx:95`). Wählt der Operator im Betrieb „— bitte wählen —“ (Wert leer, wählbar), zeigt die Taste
   „Stoppen“ und lässt sich nicht bedienen, die Einspeisung läuft weiter und endet nur mit dem Schließen des Fensters (abgeleitet,
   nicht gemessen).
3. **Der Startvorgang ist nicht gesperrt:** `start()` wartet nacheinander auf Stopp, zwei Geräte-Öffnungen, `setSinkId`, `play` und
   `resume`; solange steht `running` auf false, die Taste zeigt „Starten“ und ist bedienbar. Ein zweiter Klick ruft `start()` erneut,
   das zuerst `stop()` ruft und die laufende Verdrahtung des ersten Aufrufs verwirft (abgeleitet, nicht gemessen: `R/core/engine.ts:150-157`,
   `R/App.tsx:81-84`).
4. **Der Satz „Der Mix geht auf den Systemstandard“ ist gegen den Ablauf nicht belegt (N2a Risiko 3):** die Karte „nicht verfügbar“
   (Nr. 16) behauptet das für eine gespeicherte, aber nicht gefundene Ausgabe-ID. Ruft der Start `setSinkId` mit einer
   unbekannten ID, lehnt der Browser vermutlich ab, und `start()` stoppt mit Fehler (`R/core/engine.ts:186-189`), der Mix geht dann
   gerade nicht auf den Standard (abgeleitet, nicht gemessen). Im Betrieb zeigt die Karte das **gestartete** Gerät (`R/App.tsx:435-436`);
   was Chromium tut, wenn das Gerät während des Betriebs verschwindet, ist nicht gemessen. E10 sieht vor, den Text gegen den Ablauf zu prüfen.
5. **Eine gespeicherte Eingangs-ID, die nicht in der Liste steht, bleibt still:** für Floor und Dolmetscher gibt es keine „Gerät nicht
   gefunden“-Anzeige (für die Ausgabe schon, Nr. 16); das Feld hat dann keinen passenden Eintrag (angezeigt wird vermutlich der erste Eintrag,
   abgeleitet), die Haupttaste ist freigegeben, und `getUserMedia` mit genau dieser ID scheitert erst beim Start mit dem rohen
   Fehlertext (Nr. 42). Nachmessung 2.3 Punkt 5 beschreibt das für den neuen Aufbau (Anzeige „Gerät nicht gefunden“).
6. **Das Fehlerband bleibt stehen:** `error` wird nur vom nächsten erfolgreichen Start gelöscht (`R/core/engine.ts:185`), nicht von
   `stop()`, nicht vom Gerätewechsel; der Text ist die rohe Browser-Meldung (Nr. 7, 42).
7. **Bypass ist gemerkt, die Anzeige schweigt:** `bypass` steht im `localStorage` (Nr. 85) und wirkt nach einem Neustart beim Einhängen
   von `App` sofort (`R/App.tsx:77-79`); die Pille zeigt bei Bypass immer „Floor offen“ (`R/core/engine.ts:276`), erkennbar ist er nur am Kästchen
   in der Karte „Ducking“. Eine Anzeige „Überbrückt“ gibt es heute nicht (N2a 2.2, E10).
8. **„Ducking-Werte zurücksetzen“ liegt in der falschen Karte und setzt mehr zurück, als der Name sagt:** der Knopf steht unter „Vorverstärkung“
   und setzt auch beide Vorverstärkungen zurück (sieben Werte), nicht aber Bypass und Geräte (`R/store/settings.ts:23`, `R/App.tsx:175-177`).
9. **Die Engine lebt in `App` (N2a Risiko 1):** `engine.destroy()` im Aufräumschritt des Effekts stoppt die laufende Einspeisung, sobald
   `App` ausgehängt wird (`R/App.tsx:23-30`). Jede Umstellung, die `App` unter einem anderen Elternknoten neu einhängt (Panel, Rahmen), unterbricht die Konferenz.
10. **Die Mikrofon-Probe öffnet das Standardmikrofon bei jedem App-Start und bei jedem `devicechange`, solange keine Namen da sind:**
    `listDevices(true)` fragt `getUserMedia({ audio: true })` auf dem Systemstandard, nicht auf dem gewählten Floor-Gerät
    (`R/core/engine.ts:71-78`); bei verweigerter Freigabe wiederholt sich das bei jedem Ereignis (`R/App.tsx:43-56`). Das Mikrofon blitzt
    kurz auf (Kommentar im Code); wie das auf einem Gerät mit Aufnahme-Anzeige wirkt, ist nicht gemessen.
11. **Der Selbsttest läuft nicht in der CI:** `.github/workflows/ci-checks.yml` enthält keinen Schritt `npm run selftest -w @jm/interpreter`
    (Suche nach `interpreter`: 0 Treffer; der Job „Selbsttests“ nennt Prompter, Player, Stage-Display, Caption, Recorder u. a.). Teil 2 der Welle-2a-Regeln
    nimmt an, der Interpreter stehe dort; der Schritt muss neu dazu. Das Skript heißt heute `node --experimental-strip-types test/selftest.ts`
    (`apps/interpreter/package.json:16`), ohne `tsx` und ohne `tsconfig.test.json`.
12. **Hell/Dunkel gibt es nicht:** `index.html` setzt die Klasse `dark` fest; 48 rohe Farbklassen in `App.tsx` (Nr. 63); der `AppHeader`
    zeigt den Schalter immer (Nachmessung 0.5, Owner-Frage 2). Ohne Umstellung auf Tokens bietet der neue Kopf einen Schalter, der den Schirm unlesbar macht.
13. **Nicht benutzte Teile:** `window.jminterpreter.platform` (im Renderer 0 Treffer), `gainToDb` nur intern; kein Befund, nur Bestand.
14. **Mac nicht gemessen:** keine Ziehfläche und kein Ampel-Einzug im Kopf (Nr. 4); was `createMainWindow` auf dem Mac setzt, ist nicht gelesen (Nr. 2).
15. **Tests:** nur `test/selftest.ts` (reine Logik: Pegelrechnung, Zustandsautomat, Kabelmuster); es gibt keinen Test der Oberfläche, der Engine
    (Web Audio läuft nicht ohne Browser), des Speichers oder des Hauptprozesses; `test/ui` legt der Umbau an.
16. **Die Geräteliste zeigt die Sammeleinträge von Chromium** („Standard - …“, „Kommunikation - …“) neben den echten Geräten (abgeleitet, nicht gemessen);
    die Kabel-Erkennung greift auch auf deren Namen (die Muster haben keinen Zeilenanfang), der angezeigte Zoom-Name wird bereinigt (Nr. 70).
