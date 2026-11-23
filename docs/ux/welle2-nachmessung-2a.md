# UX Welle 2a · Nachmessung Anhang A gegen den Code von heute (22.11.2026)

Stand: `main` `0f589c3ee1` (nach UX Welle 1, Switcher 0.12.1 und Anmeldung Teil 2). Nur gelesen, nichts ausgeführt. Stichproben am 22.11. gegen `main` `d7cdd79ce0` bestätigt.
Pfade ohne Präfix: relativ zu `apps/<app>/src/`; Renderer = `renderer/src/`. Zeilennummern gelten für diesen Stand.
Zeichen: ✅ stimmt noch · ✏️ geändert (Ist-Stand mit Beleg) · ❌ falsch · ➕ neu seit 08.10. · (abgeleitet) = aus Code gelesen, nicht gemessen.

Versionen heute: Caption 0.5.0, Interpreter 0.2.0, Prompter 0.7.0, Stage-Display 0.6.0, Recorder 0.9.1, Player 0.8.0.

---

## 0 · Querschnitt (gilt für alle sechs)

1. **Master-Link-Brücke:** Der Hauptprozess ist fertig. `initAppRuntime` registriert `jmps:master-link` in allen sechs (keiner setzt `masterLink: false`; `packages/app-runtime/src/index.ts:395`). **In keinem der sechs Preloads** gibt es `masterLink()`/`onMasterLink()`, und es gibt keine `lib/bruecken.ts`. Je App also: Preload-Ergänzung (Muster `apps/timer/src/preload/index.ts:57-65`) + `lib/bruecken.ts` (Muster `apps/timer/src/renderer/src/lib/bruecken.ts`). Kein Main-Code.
2. **Fernsteuerungs-Meldung (Companion²):** In allen vier Apps mit Steuerserver (Caption 8732, Prompter 8727, Recorder 8729, Player 8725) **fehlt** sie. Muster Timer: `shared/fernsteuerung.ts` (62 Zeilen, je App eine Kopie, Konvention bei allen sechs Welle-1-Apps), `main/control-server.ts:106-122` (`onStatus` + `server.modus()`), `main/index.ts:280-289` (IPC `<app>:fernsteuerung`). Der Server (`SuiteControlServer`, `packages/suite-control-protocol/src/server.ts:49,169,177`) liefert Status und Modus schon. Interpreter und Stage-Display haben keinen Steuerserver (kein Eintrag in `capabilities.ts`) → kein Abschnitt „Fernsteuerung“, kein Statuseintrag.
3. **`@jm/settings` fehlt in allen sechs `package.json`** (nur `@jm/ui` ist drin). Abhängigkeit + Lockfile-Änderung nötig.
4. **Mac-Ziehfläche/Ampel:** fehlt bei Caption, Interpreter, Prompter, Stage-Display (✅ wie Anhang A). Recorder und Player haben `dragRegion`/`isElectronMac` (`components/Topbar.tsx`). Der AppHeader löst es für alle.
5. **Theme:** Recorder und Player haben einen ungespeicherten lokalen Knopf (`components/Topbar.tsx:5-12`, ✅). Caption, Interpreter, Prompter, Stage-Display haben keinen. **`AppHeader` zeigt `ThemeToggle` immer** (`packages/ui/src/components/AppHeader.tsx:61`, keine Prop zum Ausblenden) → Caption und Interpreter (64 bzw. 48 rohe Farbklassen) müssen mit dem Umbau hell-fähig werden, sonst bietet der Kopf einen Schalter, der den Bildschirm unlesbar macht (Owner-Frage 2).
6. **Tastatur:** Kein Tool hat globale Kürzel (`globalShortcut`, `setApplicationMenu`, `before-input-event`: keine Treffer). Alle Kürzel sind `window`-Listener im Renderer. Für das Panel gilt Spec 10 / `panelTaste` (`SettingsPanel.tsx:49-63`): Felder (INPUT ohne Knopf-Typ, SELECT, TEXTAREA) behalten ihre Tasten, Escape schließt immer das Panel, Knöpfe und `role="switch"` (der `Toggle` ist ein `<button>`) lassen Leertaste ans Tool durch. Konkret: Prompter und Player lösen dann auf einem fokussierten Schalter GO aus (Pflichtpunkt der Funktionsliste, je App unten).
7. **Ausgabefenster „offen“ ist überall nur geglaubt** (Prompter, Stage-Display, Player): `OutputWindow` (`packages/output-window/src/index.ts:113-115`) setzt bei `closed` nur `this.win = null`, es gibt kein Ereignis. Der Renderer fragt `output.isOpen()` einmal beim Laden (`store/prompter.ts:35`, `store/stage.ts:29`; Player nur beim Öffnen des Modals, `ShowView.tsx:226-230`) und setzt `outputOpen` selbst nach Klick. Schließt jemand das Fenster anders (Alt+F4, Absturz, Bildschirm weg), bleibt „offen“ stehen. Das ist genau die Lüge-Klasse von #208 (Spec 7.1, 7.3). Siehe Owner-Frage 3.
8. **Rohe Farben (Zählung `bg|text|border…-(neutral|red|green|yellow|amber|white|black…)` + `'#hex'`/`rgb()` in Quotes im Renderer):** Caption 64 (59 Klassen + 5 Hex/rgba, davon 3 im Ausgabe-Zeichner `lib/caption-cg.ts:85-93`), Interpreter 48, Prompter 4 (QR `bg-white`/`#000`/`#fff`, Ausgabe `bg-black`: alle gewollt), Stage-Display 37 (36 in `components/StageScreen.tsx` und 1 in `views/StageOutputView.tsx:17`: Bühnenbild, gewollt, `OperatorView.tsx` selbst 0), Recorder 2 (1 Zeile, `RecorderView.tsx:62` `amber-500`), Player 7 (alles `bg-black`: Video-Fläche, Ausgabe, Modal-Schleier `bg-black/50`).

---

## 1 · Caption (`apps/caption`) — Typ Live-Tool

### 1.1 Anhang A gegen Code
| Aussage in Anhang A | Urteil | Beleg |
|---|---|---|
| Immer sichtbar: Untertitel-Vorschau (Canvas aus `lib/ndi-engine.ts`) + Zeilenverlauf mit „letzte Zeile korrigieren“ | ✅ | `App.tsx:336-410`; große Live-Zeile `:339`, NDI-Vorschau-Canvas `:358`, Verlauf `:376-408`. Korrigierbar ist nur die jüngste Zeile per Doppelklick (`:398`), Enter/Blur übernimmt (`:386-391`) |
| Haupttasten Start/Stopp, Hold, Leeren, NDI an/aus (4) | ✅ | `:185-206`, `:211-218`; Verben und `toggleKey` stimmen (`capabilities.ts:507-516`: `transcribe`/`running`, `hold`/`hold`, `ndi`/`ndi`, `clear`) |
| Kürzel: keine | ✅ | einziges `onKeyDown` = Enter in der Korrektur (`App.tsx:390`) |
| Tally STATE `running` (+ `ndi`), Hold gelb | ✅ | Hold-Gelb `:195`; Main-Zustand `main/index.ts:84-96` |
| Statuseintrag NDI (`status.ndiActive`, `connections`) | ✏️ | `ndiActive` heißt nur „Unterprozess existiert“ (`main/ndi/sender-process.ts:60` `child != null`) und wird beim Start sofort auf true gesetzt (`main/index.ts:141`); kein `exit`-Handler. Gemessen ist nur `connections` (Stat-Nachricht des Senders, `sender-process.ts:28-32`). Ein toter Sender bliebe „an“ |
| Companion² Port 8732 | ✅ (Meldung fehlt) | `main/control-server.ts:20`; keine IPC dazu |
| Audiogerät `config.audioInputDeviceId`, Pegel `level` | ✅ | Pegel nur bei laufender Aufnahme (`App.tsx:104`, `store/useCaption.ts:6`); Geräteliste per `enumerateDevices` + Mikrofon-Probe (`lib/capture.ts:25-39`) |
| Whisper-Engine (`whisperAvailable`, `busy`, `config.engine`) | ✅ | `main/index.ts:72`; „Modell fehlt“ wird erst bei der ersten Äußerung gemeldet (`main/transcriber.ts:98-100`) |
| Fehler `state.error` | ✅ | plus renderer-lokales `micError` (`App.tsx:54,115,332`), das **nicht** in `state.error` landet |
| Einstellungen: NDI (Quellname, Auflösung, fps), Audiogerät, Fernsteuerung; tool-eigen: Modell, Sprache, Schrift/Zeilen/Band, Wörterbuch, Engine, **Stille-Parameter** | ✏️ | Stille-Parameter (`silenceMs`, `silenceThreshold`) stehen in `CaptionConfig` (`shared/types.ts:21-23`), haben aber **keine Bedienfläche**; sie werden nur gelesen (`App.tsx:100-102`). Nicht ins Panel aufnehmen (wäre neue Funktion). Dazu: `maxUtteranceSec` hat ein Feld in „Erweitert“ (`:312-320`) |
| Heute alles inline im Header (Modell/Sprache/Gerät) + NDI-Leiste + „Erweitert“-Klappe | ✅ | `:143-207`, `:210-278`, `:281-324` |
| Rohe Farben ja (59), kein Logo, kein `@jm/ui` | ✅ (✏️ Zahl) | 59 Klassen + 5 Hex/rgba = 64; ein einziger `@jm/ui`-Import (`globals.css` `base.css`); Header `:144` nur Text „JM Caption“ |
| Risiko: whisper-server-Neustart bei Modell-/Engine-Wechsel unverändert lassen | ✅ (geklärt) | Neustart hängt am Auftrag, nicht an der UI: `ensureServer` startet neu, wenn `currentModel !== model` (`main/whisper-server.ts:44-47`), Modell wird je Äußerung aus `config()` gelesen. Ein Umzug der Felder ins Panel ändert daran nichts |
| ➕ seit 08.10. | ➕ | nur Release-Pflege: NDI-Lizenztext ins Paket (`52d82d33ac`, `753a93ce4d`, Release `b588253318` Caption 0.5.0). Keine Oberfläche geändert |

### 1.2 Für den Umbau
- **Immer sichtbar:** große Live-Zeile + NDI-Vorschau + Verlauf (mit Korrektur der letzten Zeile).
- **Haupttasten (4):** Start/Stopp (`start()`/`stop()` → IPC `caption:start|stop`, Verb `transcribe`), Hold (`caption:setHold`, `hold`), Leeren (`caption:clear`, `clear`), NDI (`caption:ndi-start|stop`, `ndi`).
- **Tally/On-Air:** echte Sendezustände = NDI sendet an Empfänger (mit Hold eingefroren). `running` allein ist „läuft“ (7.4), und `running` ist hier nur ein Merker im Main (`main/index.ts:111-118`), den die Aufnahme im Renderer erfüllen muss (`App.tsx:86-126`). Scheitert das Mikrofon (`:115`), bleibt `running` true, Companion meldet `running=1`. Vorschlag in Owner-Frage 1.
- **Statuseinträge (Quelle · gemessen?):** Master-Link (Brücke, neu) · NDI (`status.ndiActive` = Prozess existiert; `connections` gemessen; **Lücke:** „sendet“ nur belegbar, wenn die erste Stat-Nachricht kam oder der Prozess endet → kleine lesende Main-Ergänzung, sonst „an (ohne Rückmeldung)“ wie Spec 7.3) · Fernsteuerung (neu, 8732) · Audiogerät (Einstellung + gemessene Geräteliste; Pegel gemessen, nur bei `running`) · Whisper (`whisperAvailable`/`busy` gemessen; Modelldatei erst bei erster Äußerung geprüft) · Fehler (`state.error` und `micError`, heute zwei Quellen).
- **`@jm/settings`:** `NdiOutputSection` (Quellname; Auflösung `RES` `App.tsx:19-23`; Bildrate 25/30/50/60; **Transparenz: nicht anbieten**, die Quelle ist immer transparent, „Band“ ist etwas anderes), `AudioDeviceSection` (eine Wahl, Eingang, `defaultLabel` „System-Standard (Mikrofon)“, Pegel an, `onRefresh` für das ⟳), `RemoteControlSection` (Port fest, Modul „JM Caption“). Kein iveo, kein Bildschirm (kein Ausgabefenster), keine Gegenstellen. **Tool-eigen** (eigener Abschnitt): Modell, Sprache, Engine, Wörterbuch, max. Äußerung, Schrift, Zeilen, Band.
- **Kürzel:** nur Enter (Korrektur übernehmen). Pflichtpunkt Panel: Leertaste/Escape im Panel berühren Caption nicht (kein Kürzel, außer Escape = Panel zu).
- **Ohne AppShell:** keins (kein Ausgabefenster; NDI-Bild entsteht im Hauptfenster-Renderer).
- **Aktuelles Layout:** einspaltig, Header → NDI-Leiste → Erweitert → Warnbänder → Live-Zeile + 320-px-Vorschau → Pegel + Verlauf (`max-h-44`). Mindestfenster 900×600 (`main/index.ts:239`).
- **Master-Link:** fehlt im Preload (siehe 0.1). **Fernsteuerung:** fehlt (0.2).

### 1.3 Risiken
1. **Die NDI-Engine lebt im Renderer-`App`:** `useCaptionNdiEngine(...)` (`App.tsx:83`) zeichnet in `previewRef` und sendet über einen MessagePort (`lib/ndi-engine.ts:41-48`, Port-Empfang per `window.message`). Sie muss **unbedingt** und oben im `App` weiterlaufen und das Canvas darf nie unter einer Bedingung (Panel offen, `!state`) aus dem DOM fallen, sonst bricht das Ausgabebild ab, ohne dass `ndiActive` es merkt. Dasselbe gilt für die Aufnahme-Effekte (`:86-129`). `backgroundThrottling:false` (`main/index.ts`, `backgroundThrottling: false`) bleibt.
2. **Quellname-Änderung bei laufendem NDI wirkt nicht:** `startNdi(name)` liest den Namen nur beim Start (`main/index.ts:135-141`). Das Feld ist während NDI an editierbar (`App.tsx:219-224`). Würde der Abschnitt „Im Netz: {name}“ aus `config.ndiName` zeigen, stünde ein Name, der nicht mehr stimmt. `networkName` nur aus dem beim Start verwendeten Namen füllen (neuer, lesender Wert) oder weglassen.
3. **`running` ohne Mikrofon** (siehe 1.2): Der Start-Knopf würde `live` zeigen, obwohl nichts transkribiert wird. `micError` gehört in einen Statuseintrag `error` und in den Grund des Knopfes.
4. **Mikrofon-Probe beim Start:** `listAudioInputs` öffnet bei fehlenden Labels kurz `getUserMedia` (`lib/capture.ts:25-39`, beim Mounten `App.tsx:69-74`). Welle 1 hat das beim Switcher beim Start abgeschafft (R6). Hier unverändert lassen (U6), sonst „unbekannt“ bis zur Probe; das ist eine Entscheidung im Plan, kein Fund.
5. **Geräte-ID fehlt:** `audioInputDeviceId` fehlt in der Liste → `getUserMedia({deviceId:{exact}})` scheitert → nur `micError`. Der Abschnitt zeigt dann „Gerät nicht gefunden“, nie still Standard: passt zu `AUDIO_TEXTE` (`audio-device.ts:27-28`); `lastLabel` gibt es nicht (nur die ID wird gespeichert, `shared/types.ts:30`).
6. 64 Farbklassen auf Tokens: reiner Fleiß, aber das ist der größte Posten der App (siehe Frage 2).

### 1.4 Größe: **mittel** (vergleichbar Timer, mit weniger Logik). Ein Renderer-File (413 Zeilen) zerlegen, Farben migrieren, 4 lesende Ergänzungen (Master-Link-Preload, Fernsteuerung Main+Preload, NDI-„sendet“, Netz-Name).

---

## 2 · Interpreter (`apps/interpreter`) — Typ Live-Tool

### 2.1 Anhang A gegen Code
| Aussage | Urteil | Beleg |
|---|---|---|
| Immer sichtbar: Pegel Floor/Dolmetscher + Ducking-Anzeige „FLOOR ABGESENKT / Floor offen“ (`App.tsx:136–148`) | ✅ | `:136-149`, `Meter` `:221-240`, Pille `:139-145` |
| Haupttaste Starten/Stoppen (`toggle`), keine weiteren, keine Kürzel | ✅ | `:81-84`, `:93-102`; „Erst beide Eingänge wählen“ ist schon ein Sperrgrund (`:95-96`, passt auf `TallyButton disabledReason`) |
| Tally `state.running`, Ducking `state.ducking`, kein Steuerserver | ✅ | `core/engine.ts:30-37`; `publish` (`:262-270`) |
| Statuseintrag Ausgabe-Kabel (`detectCable`/`counterpartPresent`, `deviceCableNotice`) | ✅ | `:320-395`; Erkennung per Gerätename (`shared/virtual-cable.ts`) = Namensmuster, nicht gemessene Funktion |
| Einstellungen: drei Pickers (Floor, Dolmetscher, Ausgabe), MediaDevices | ✅ | `:110-123`; Ausgabe hat `allowDefault` „Systemstandard“, die zwei Eingänge „— bitte wählen —“ (`:204`) → `required: true` bei den Eingängen |
| **Risiko: „Ein Gerätewechsel stoppt heute die laufende Engine (App.tsx:82)“** | ❌ **falsch** | `:82` ist `if (state.running) void engine.stop()` im Start/Stopp-Knopf. Ein Gerätewechsel im Betrieb ändert nur den Store (`:110-123`); die Engine liest die IDs ausschließlich in `start()` (`core/engine.ts:158-162,184`). Der Mix läuft auf dem **alten** Gerät weiter, die UI warnt bisher **nur beim Ausgabegerät** (`pendingChange` `:435-445`), **nicht** bei Floor und Dolmetscher (deren Streams bleiben ebenfalls bis zum Neustart die alten). Der feste Text `AUDIO_TEXTE.wechselStoppt` („Ein Wechsel stoppt die laufende Verarbeitung“, `packages/settings/.../audio-device.ts:43`) wäre also eine Lüge. `changeWarning` ist aber ein App-Text (`:20`, `:95`), kein fester Paket-Text → wahrheitsgemäß setzen („Wirkt erst nach Stopp und erneutem Start.“) |
| Kein Companion: Abschnitt „Fernsteuerung“ entfällt | ✅ | kein `control-server`, kein `capabilities.ts`-Eintrag |
| Einstellungen tool-eigen: Ducking (Schwelle, Absenkung, Attack, Release, Nachlauf), Pegel Floor/Dolmetscher, „Werte zurücksetzen“ | ✅ | `:151-178`; Store `store/settings.ts` (persist `jm-interpreter-settings`); plus ein Bypass „Überbrücken“ (`:155`), den Anhang A nicht nennt |
| Heute einspaltig `max-w-4xl`, h1-Header, Karten inline; rohe Farben ja (46); kein `@jm/ui` | ✅ (✏️ Zahl) | 48 Farbklassen; einziger `@jm/ui`-Bezug ist `base.css`; kein Logo, kein Theme-Knopf |
| ➕ seit 08.10. | – | keine Commits an `apps/interpreter` seit 08.10. |

### 2.2 Für den Umbau
- **Immer sichtbar:** die beiden Meter + Ducking-Pille + (neu in der Sicht) „Überbrückt“, wenn `bypass` an ist (`engine.ts:262-263`: `ducking = !bypass && …`; bei Bypass zeigt die Pille „Floor offen“, obwohl der Operator das Ducking ausgeschaltet hat, heute nur am Häkchen weiter unten erkennbar).
- **Haupttaste (1):** Starten/Stoppen, `TallyButton` `live` bei `running`, `gesperrt` mit Grund „Erst beide Eingänge wählen“. Kein Verb, kein `toggleKey`, kein Kürzel.
- **Tally/On-Air:** `state.running` = „der Mix läuft ans gewählte Ausgabegerät“ (`engine.route` `:231-247`, `startedOutputId`). Ob Zoom/Webex ihn hört, ist nicht messbar. Vorschlag in Owner-Frage 1.
- **Statuseinträge:** Master-Link (neu) · Audiogeräte (Floor/Dolmetscher: Einstellung gegen gemessene Liste; `labelsAvailable` gemessen) · Ausgabe/Kabel (gemessene Liste + Namenserkennung; `startedOutputId` gemessen) · Ducking (`ducking`, `bypass`) · Engine-Fehler (`state.error` gemessen, `core/engine.ts:179-182`).
- **`@jm/settings`:** `AudioDeviceSection` mit **drei** `choices` (Floor `input`, Dolmetscher `input`, Ausgabe `output`, `defaultLabel` „Systemstandard“), `capabilities {level: true, refresh: false}` (Pegel je Eingang aus `floorDb`/`interpreterDb`), `changeWarning` je Wahl wahrheitsgemäß, `lockedReason` **nicht** setzen (heute sind die Picker im Betrieb frei). `lastLabel` gibt es nicht (nur IDs gespeichert). Kein NDI, Bildschirm, Fernsteuerung, iveo, Gegenstellen. **Tool-eigen** (eigener Abschnitt): Ducking-Regler, Vorverstärkung, „Werte zurücksetzen“, Bypass. Die Kabel-Erklärkarten (`CableStatus`, Download-Knopf, `openCableDownload` über IPC `cable:openDownload`) bleiben tool-eigen, am besten im Live-Bereich unter den Metern, solange sie eine Handlung erklären.
- **Kürzel:** keine. **Ohne AppShell:** keins. **Fenster** 900×640 min (`main/index.ts`), `backgroundThrottling:false` bleibt (Regelschleife `setInterval`, `engine.ts:5-9`).
- **Master-Link:** fehlt im Preload; Preload hat sonst nur `openCableDownload` (`preload/index.ts`).

### 2.3 Risiken
1. **Die Engine lebt in `App` (`useRef`, `:9-11`) und wird in `useEffect`-Cleanup zerstört (`:26-29`).** Wird beim Umbau die Komponente umgehängt oder remountet (Panel offen/zu, AppShell-Wechsel), stoppt `engine.destroy()` die laufende Konferenz-Einspeisung. Engine und Effekte in eine Komponente legen, die über Panel-Wechsel stabil bleibt.
2. **Falscher Warntext** (siehe Tabelle): nicht den festen Paket-Text nehmen.
3. **Bestehender Hinweistext möglicherweise falsch (abgeleitet):** „… derzeit nicht verfügbar. Der Mix geht auf den Systemstandard“ (`:326-327`). `route()` ruft `setSinkId(outputId)` mit einer unbekannten ID, das lehnt ab → `start()` fängt es und stoppt (`engine.ts:178-182`). Dann geht der Mix gerade **nicht** auf den Standard. Nicht unbesehen in einen Status übernehmen; vor der Übernahme gegen den echten Ablauf prüfen.
4. **`ducking` ist kein Sendezustand, `bypass` kann es verfälschen** (siehe 2.2).
5. **Mikrofon-Probe beim Start** (`listDevices(true)`, `engine.ts:63-86`, `App.tsx:41-71`): bewusst, weil Kabel-Erkennung Labels braucht; unverändert lassen.
6. 48 Farbklassen + `Notice`-Töne `emerald/yellow` (`:287-291`) auf `ok`/`warn`-Tokens abbilden (4.2 der Spec).
7. Keine Tests außer `selftest.ts` (nur Ducking-Logik); es gibt keinen UI-Selbsttest wie `apps/timer/test/ui`.

### 2.4 Größe: **klein bis mittel** (eine Datei, 449 Zeilen, kein Hauptprozess-Umbau außer Master-Link-Preload; Aufwand = 3-Wahlen-Abschnitt, Farben, die Engine stabil halten).

---

## 3 · Prompter (`apps/prompter`) — Typ Live-Tool

### 3.1 Anhang A gegen Code
| Aussage | Urteil | Beleg |
|---|---|---|
| Immer sichtbar: Vorschau + Transport (`OperatorView.tsx:95–125`) | ✅ | `:89-125`; Beschriftungen: „⏮ Marke“ / „Marke ⏭“ (nicht „◀ Abschnitt“), „↑ zurück“ = −3, „⟲ Anfang“, „↓ vor“ = +3, GO/„❙❙ Pause“ |
| Haupttasten GO/Pause (`transport.toggle`, `scroll`/`scrolling`, Leertaste), An den Anfang (`reset`, `top`, Pos1), ◀/▶ Abschnitt (`jumpMarker`, ohne Kürzel) | ✅ | `:100-124`, `:28-37`; Hotkeys `lib/useHotkeys.ts:12-26`. Vier Haupttasten passen genau (GO, Anfang, Marke−, Marke+); die zwei ±3-Knöpfe bleiben normale Knöpfe |
| Tally STATE `scrolling`; Ausgabe offen = `outputOpen` | ✅ (Ausgabe: geglaubt) | `store/prompter.ts:7,35,59`; siehe 0.7 |
| Statuseinträge: Talent-Monitor, Companion² 8727, Handy-Fernbedienung, Tempo | ✅ | Handy-Remote `remote.isRunning()` ist gemessen (`main/index.ts:70-73`); Port 7781 (`:24`); Companion 8727 (`main/control-server.ts:20`). Tempo = Einstellung, im Main geführt (stimmt, weil der Main sie ist) |
| Kürzel: Leertaste, ↑/↓ nudge ±1 (Shift ±3), Pos1; **gelten auch im Ausgabefenster**; Header zeigt sie als Text (`:47`) | ✅ | `useHotkeys.ts` (Ausnahme: INPUT/TEXTAREA/`isContentEditable`); `views/PrompterOutputView.tsx:9` ruft den Hook auch dort auf; Text `:47-49` |
| Heute: Sidebar mit lokalem `Section` (5 Abschnitte, `:128–240`), lokales `Toggle`; kein Theme-Knopf | ✅ | 5 `Section`: Lauf & Schrift, Lese-Linie, Darstellung, Ausgabe, Fernbedienung (`:128-243`); lokale `Slider`/`Toggle` `:268-322`. **Nicht** „Sidebar“: ein 400-px-Steuerpult rechts neben der Skript-Textarea (`:52-88`) |
| Rohe Farben: nein; kein mac-Drag | ✅ | 4 Treffer, alle gewollt (0.8); Header ohne `dragRegion` `:41` |
| Risiko: Ausgabefenster über `@jm/output-window`, kein AppShell | ✅ | `main/index.ts:28`, `views/PrompterOutputView.tsx` |
| ➕ seit 08.10. | ➕ | nur `e3f4e65aaa` Release 0.7.0 (Auffrisch-Runde), keine Oberflächenänderung am Operator; Fernbedienungs-URL trägt seit dem Suite-Token `?t=…` (`main/index.ts:40-45`, schon vor 08.10. möglich) |

### 3.2 Für den Umbau
- **Immer sichtbar:** Vorschau (`PrompterScroller`, 16:9) + Transport, **dazu das Tempo**, siehe Frage 4.
- **Haupttasten (4):** GO/Pause (IPC `prompter:toggle`, Verb `scroll`, `toggleKey scrolling`, Leertaste) · An den Anfang (`prompter:reset`, `top`, Pos1) · Marke zurück/vor (`jumpMarker` → `prompter:seek`, kein Verb, kein Kürzel). Weitere Companion-Verben ohne Knopf: `speed`, `faster`, `slower` (`capabilities.ts:323-325`, Regler `Tempo` ersetzt sie).
- **Tally/On-Air:** `scrolling` (Main-Transport, `positionEm`-Anker) ist der echte Laufzustand; „auf Sendung“ am Talent heißt: scrollt **und** Talent-Monitor offen. Siehe Frage 1.
- **Statuseinträge:** Master-Link (neu) · Talent-Monitor (nur geglaubt; mit Frage 3 gemessen) · Fernsteuerung/Companion (neu) · Handy-Fernbedienung (`state.remote.running` gemessen; Adressen `urls`) · Tempo (Einstellung = Main-Wahrheit).
- **`@jm/settings`:** `ScreenOutputSection` (`enabled`=Fenster soll offen sein, `windowOpen`, `screens` aus `output.displays()`, `selectedId = outputDisplayId`, `capabilities {toggle, fullscreen:false, background:false}`; Bildschirmwahl lädt die Liste heute erst bei Fokus `:196`, die Liste sollte beim Öffnen des Abschnitts frisch geholt werden) · `RemoteControlSection` (Companion, Port fest, Modul „JM Prompter“). **Tool-eigen:** Lauf & Schrift (Tempo, Schriftgröße, Zeilenabstand, Seitenrand), Lese-Linie, Darstellung (Spiegeln ⇄/⇅, Fett), **Handy-Fernbedienung** (an/aus, Adressen, QR `components/RemoteQr.tsx`): eine zweite Fernsteuerung, **keine** Companion-Fernsteuerung, passt nicht in `RemoteControlSection`. Skript-Textarea + „Datei laden“ bleiben der Hauptbereich.
- **Kürzel:** Leertaste GO/Pause, ↑/↓ ±1 (Shift ±3), Pos1 Anfang; im Ausgabefenster dieselben. **Pflichtpunkt Panel:** Escape im Panel schließt es (der Prompter hat sonst kein Escape); Leertaste auf einem fokussierten Schalter/Knopf im Panel löst GO aus (der Handler nimmt nur INPUT/TEXTAREA/`contentEditable` aus, `useHotkeys.ts:7`; ein `<button role="switch">` ist kein INPUT) und schaltet den Schalter nicht (Spec 10, Stand des Bausteins).
- **Ohne AppShell:** `views/PrompterOutputView.tsx` (Hash `#output`, `bg-black`, Cursor aus).
- **Aktuelles Layout:** Kopf 56 px, links Skript, rechts 400 px Steuerpult. Mindestfenster 940×620 (`main/index.ts:258`): mit offenem 360-px-Panel blieben für Skript + Pult 580 px. Das Pult ersetzt dann seine Abschnitte durch das Panel, sonst wird die Textarea zu schmal.
- **Master-Link:** fehlt im Preload (`preload/index.ts`, 43 Zeilen). **Fernsteuerung:** fehlt.

### 3.3 Risiken
1. **„Talent-Monitor offen“ geglaubt** (0.7): Fällt das Talent-Fenster weg, steht die Statusleiste weiter auf „offen“, während GO scrollt und niemand es sieht.
2. **Handy-Fernbedienung: Startfehler unsichtbar:** `setRemote` fängt Fehler nur mit `console.error` (`main/index.ts:152-158`). `remoteEnabled` ist dann true, `remote.running` false, die UI zeigt „Keine LAN-Adresse gefunden“ (`OperatorView.tsx:240-242`), auch bei belegtem Port. Wer das als Status übernimmt, behauptet „keine Adresse“ statt „Port belegt“.
3. **Die Hotkeys hängen am Operator-`View`** (`OperatorView.tsx:20`) und im Output (`PrompterOutputView.tsx:9`): Beim Umbau muss der Hook im neuen Live-Bereich bleiben, sonst entfällt Leertaste im Hauptfenster.
4. **Skript-Textarea hält die Tasten:** Leertaste im Skript tippt Leerzeichen (gewollt). Wer GO per Leertaste will, muss Fokus aus dem Feld nehmen; das ist heute so und der Header weist darauf hin (`:47`). Kopfzeilen-Hinweis fällt mit dem AppHeader weg; er gehört dann an die Haupttaste (`TallyButton shortcut`) und in den Live-Bereich.
5. **Stiller Wechsel der Seitenaufteilung:** siehe Layout oben.

### 3.4 Größe: **klein bis mittel** (322-Zeilen-View, 2 Abschnitte aus `@jm/settings`, 4 Haupttasten, Fernsteuerung + Master-Link + optional Ausgabe-Rückmeldung).

---

## 4 · Stage-Display (`apps/stage-display`) — Typ Live-Tool

### 4.1 Anhang A gegen Code
| Aussage | Urteil | Beleg |
|---|---|---|
| Immer sichtbar: Live-Vorschau `StageScreen` + Ad-hoc-Nachricht (`OperatorView.tsx:163–170`) | ✅ (✏️ Zeilen) | Vorschau `:33-38`, Nachricht-Feld `:162-170` (am Seitenende, **unter** Quellen und Elementen) |
| Haupttasten: Bühnenschirm öffnen / auf diesen Bildschirm / schließen; Nachricht ist Textfeld; keine Kürzel | ✅ | `:57-70`; Nachricht wirkt **sofort mit jedem Tastendruck** (`:166` → `setConfig` → Persistenz + Broadcast, `main/index.ts:211-216`), es gibt kein „Senden“ |
| Tally: keine echte; `outputOpen` (`store/stage.ts:6`); kein Steuerserver | ✅ | `store/stage.ts:6`; geglaubt (0.7) |
| Statuseinträge: Bühnenschirm, Quelle Timer (`state.timer.connected`, :7777), Switcher (Companion-Port 8723), Presenter (:7330) | ✅ | `main/index.ts:44-49`; Ports `main/config.ts:6-13`; 8723 `capabilities.ts:147`; `connected` je Client gemessen (`timer-client.ts`, `switcher-client.ts`, `presenter-client.ts`) |
| Einstellungen: Ausgabe auf Bildschirm; tool-eigen: Quellen (an/aus, Host, Port je Quelle, Presenter-Modus), Anzeige-Elemente (5) | ✅ | `:41-72`, `:75-144`, `:147-160`; dazu Presenter-**PIN** (`:106,255-264`), die `PeerRow` nicht kennt |
| Heute inline, lokales `Section`/`SectionHeader`; rohe Farben nur im StageScreen; kein Theme-Knopf | ✅ | `:275-290`; 0 rohe Farben in `OperatorView.tsx`; 36 im `StageScreen.tsx` (Bühnenbild) |
| Risiko: Ausgabefenster `views/StageOutputView.tsx` ohne AppShell; Companion entfällt; kein mac-Drag | ✅ | |
| ➕ seit 08.10. | ➕ | `a7cb346e97`: Ad-hoc-/Timer-Nachricht erscheint **auch in der Kopfzeile der Presenter-Ansichten** (`components/StageScreen.tsx`, Regel in `lib/nachricht.ts:9-19`); erster Selbsttest in CI (`test/nachricht.test.tsx`, Skript `selftest`, `package.json`). Release 0.6.0 (`e3f4e65aaa`). Das ändert die Live-Wirkung der Nachricht: sie steht jetzt in mehr Ansichten |

### 4.2 Für den Umbau
- **Immer sichtbar:** Vorschau (`StageScreen` mit `state`/`now`, bleibt unverändert) + Nachricht-Feld direkt darunter (heute ganz unten).
- **Haupttasten (1):** „Bühnenschirm“ öffnen (`openOutput`, IPC `output:open`) / schließen (`output:close`). Auf diesen Bildschirm = erneutes Öffnen (`OutputWindow.open` zieht um). Kein Verb, kein Kürzel. Der Knopf zeigt `live`, wenn der Bühnenschirm **gemessen** offen ist, sonst `bereit`.
- **Tally/On-Air:** keine echte Sendeanzeige im Sinne Q&A/Battle. Der Bühnenschirm (offen) ist der Sendezustand. Siehe Fragen 1 und 3.
- **Statuseinträge:** Master-Link (neu) · Bühnenschirm (geglaubt → Frage 3) · Quelle Timer · Quelle Switcher · Quelle Presenter (je `connected` gemessen; nur anzeigen, wenn `enabled`, sonst `off` „aus“; `STATUS_UNBEKANNT` solange `state` fehlt).
- **`@jm/settings`:** `ScreenOutputSection` (Bildschirm; `outputDisplayId`; `capabilities {toggle}`) und **`PeersSection` im Modell ohne Auto** (die Paket-Doku nennt Stage-Display ausdrücklich: `peers.ts:3-6`, `source` undefined, `capabilities {toggle: true}`; Rollen timer/switcher/presenter, `defaultPort` 7777/8723/7330, `connected` gemessen). **Nicht abgedeckt, bleibt tool-eigen (unter/neben den Gegenstellen):** Presenter-PIN, Presenter-Anzeige (Referenz/Haupt), die fünf Anzeige-Elemente (`widgets`).
- **Kürzel:** keine. Pflichtpunkt Panel: Leertaste/Escape berühren das Tool nicht (Escape = Panel zu).
- **Ohne AppShell:** `views/StageOutputView.tsx` (`#output`, `bg-black`).
- **Layout:** Kopf 56 px, mittig `max-w-[900px]` einspaltig, scrollt. Fenster 1080×760, min 880×600.
- **Master-Link:** fehlt im Preload (27 Zeilen). **Fernsteuerung:** entfällt.

### 4.3 Risiken
1. **Nachricht ist live und persistent:** jeder Buchstabe geht sofort auf den Bühnenschirm und in `stage-config.json` (`main/config.ts`); die Nachricht überlebt einen Neustart. Eine alte Nachricht erscheint beim nächsten Start auf der Bühne (steht im Feld, `config.message`). Der Umbau darf daran nichts „verbessern“ (U6), aber das Feld verdient im Live-Bereich ein sichtbares „auf dem Schirm“-Zeichen, wenn `widgets.message` an und der Schirm offen ist (Statusleiste: eigener Eintrag, nicht nur Haken).
2. **mDNS überschreibt eingetragene Hosts:** `onDiscovered` (`main/index.ts:100-140`) übernimmt gefundene Host/Port, sobald die Quelle `enabled` und **nicht verbunden** ist und der Host abweicht. Ein von Hand getippter Host wird so still ersetzt. `PeersSection` im „ohne Auto“-Modell zeigt weder „gefunden“ noch „manuell“; es wäre eine Lüge, „manuell: host:port“ zu zeigen. Zeile zeigt nur `verbunden`/„aus“.
3. **Port-Eingabe `Math.max(1, Number(…) || port)`** (`:252`) ist ein anderes Verhalten als das Zahlenfeld aus `@jm/ui` (R21/R26: Übernahme bei Enter/Blur, Pfeiltasten tot). Als Abweichung in der Funktionsliste führen.
4. **Presenter-PIN im Klartext, nur Ziffern, 8 Stellen** (`:258`): bleibt; im Panel nicht in einem Abschnitt, der später Screenshots/Exports zeigt (Spec: Token nur im Launcher; die PIN ist eine andere Sache).
5. **`StageScreen` doppelt genutzt** (Vorschau im Operator und Ausgabe): nicht anfassen, keine Farbmigration dort (Bühnenbild, 36 Treffer sind richtig).

### 4.4 Größe: **klein bis mittel** (290-Zeilen-View, Gegenstellen- und Bildschirm-Abschnitt passen fast 1:1; Aufwand: Rest-Abschnitt für PIN/Modus/Elemente, Nachricht nach oben, Master-Link, Ausgabe-Rückmeldung).

---

## 5 · Recorder (`apps/recorder`) — Typ Live-Tool

### 5.1 Anhang A gegen Code
| Aussage | Urteil | Beleg |
|---|---|---|
| Immer sichtbar: Transport + Kanal-Meter (`RecorderView.tsx:116–150`, Meter ab Z. 215) | ✏️ | Transport jetzt `:143-234` (Taste, Anzeige, Uhr `:178-183`, Ziel `:187-222`), Pegel `:239-301`, dazwischen `ScheduleCard` `:237`. Die Seite scrollt (`App.tsx:25`); Transport und Pegel stehen nicht gemeinsam im Blick (Pegel ganz unten, Karte „Geplante Aufnahme“ davor) |
| Haupttasten Eingang öffnen (`arm`), Aufnahme/Stopp (`record`/`stop`, `toggleKey recording`), Eingang schließen (`disarm`); keine Kürzel | ✅ | `:146-176`; Verben `capabilities.ts:373-375` |
| Tally STATE `recording` (rot), `armed` (gelb), Quelle `state.status` | ✅ | gemessen im Main (`main/recorder.ts`, `control-server.ts:31-38`) |
| Statuseinträge: Companion² 8729, Audiogerät (`deviceIndex`, Kanäle, Samplerate), Aufnahme (Dauer, `filePath`), Zeitplan | ✅ | `RecorderState` (`shared/types.ts:11-22`): `status`, `device`, `channels`, `sampleRate`, `filePath`, `recordedSec`, `scheduledStartAt/StopAt` sind **gemessen** (Main). Im Zustand **idle** sind Gerät/Kanäle/Rate nur Einstellungen des Stores |
| Einstellungen: Audiogerät (PortAudio-Index, Kanäle, Samplerate; gesperrt, solange offen); tool-eigen: Zielordner, Dateiname, Spuren einzeln, Gain, Zeitplan | ✅ | `:80-141` (`disabled={open}`), Gain `:249-273` (live wirksam, **nicht** gesperrt) |
| Heute inline Karten mit lokalem `Field`; Theme-Knopf ungespeichert; rohe Farben: nein | ✅ (✏️ Farbe) | `Field` `:408`; Theme `components/Topbar.tsx:5-12`; 1 Zeile `amber-500` im Hinweisband (`:62`) |
| Risiko: Geräte-Felder gesperrt solange offen; ohne gebautes Addon ist die Liste leer → Fehlerzustand in die StatusBar | ✅ | `main/recorder.ts:20-25` (lazy `require('@jm/audio')`) |
| ➕ seit 08.10. | ➕ viel | (a) **Presets** (`components/PresetLeiste.tsx`, 224 Z.: Auswahl, Speichern, Löschen, Export/Import, „geändert“, neu anwenden; `main/presets.ts`, `RecPreset { name, werte }` mit Eingang, Kanäle, Rate, Ordner, Dateiname, Spuren, Gain, Plandauer; `shared/types.ts:100-117`); Presets lassen sich bei laufender/geplanter Aufnahme nicht anwenden (`store/recorder.ts:136`). (b) **Alle Einstellungen merken** (0.8.0, #291; `main/einstellungen.ts`), mit Hinweisband **„gemerkter Eingang/Ordner passt nicht“** (`hinweisEingang`/`hinweisOrdner`, `RecorderView.tsx:58-77`, `store/recorder.ts:157-195,308-420`), Netzwerkordner-Rückfrage. (c) **Loopback-Eingänge: Stille in Echtzeit auffüllen** (0.9.0; `main/stille.ts`, `recorder.ts:216-232,172-208`). (d) **Folgedatei ab 4 GB**, nie überschreiben, Aufnahme beim Schließen abschließen (0.8.0; `main/wav.ts`, `dateiname.ts`). (e) Show-Deep-Link setzt Eingang/Ordner (`takeShowSettings`, `preload`). (f) Meldungen als 5-s-Toast (`notice`, `App.tsx:12-33`). Tests: 8 Dateien unter `test/` (`store.test.ts`, `recorder.test.ts` …) |

### 5.2 Für den Umbau
- **Immer sichtbar:** Aufnahmetaste + Uhr + Badge **und** die Kanal-Meter, gemeinsam. Meter müssen im Live-Bereich fest über dem Fold stehen (heute nicht garantiert).
- **Haupttasten (≤ 4):** Eingang öffnen (`arm`) / Eingang schließen (`disarm`) · Aufnahme / Stopp (`record`/`stop`). Zeitplan, Preset-Leiste und Ziel sind keine Haupttasten.
- **Tally/On-Air:** `status === 'recording'` (Main, Schreiber läuft) ist der echte Sendezustand → Kopf `onAir {live: recording, label: 'REC'}`, Aufnahmetaste `live`. `armed` ist `bereit`, nicht `live`.
- **Statuseinträge:** Master-Link (neu) · Fernsteuerung (neu, 8729; Befehle laufen **über den Renderer**: Main → `recorder:remote-cmd` → `store/recorder.ts:333-345`; ohne offenes Hauptfenster passiert nichts) · Audiogerät (offen: gemessen `state.device/channels/sampleRate`; sonst nur gemerkter Wunsch, „Gerät nicht gefunden“ aus dem `hinweisEingang`) · Aufnahme (Dauer, Datei, gemessen) · Zeitplan (`scheduledStartAt/StopAt`, gemessen) · **Fehler/Addon fehlt** (Liste leer + `loading` aus).
- **`@jm/settings`:** `AudioDeviceSection` (Wahl `input`, `id = String(device.index)`, `label = „Name — hostApi (n ch)“`; `lockedReason: AUDIO_TEXTE.sperreEingangOffen`; Pegel `capabilities.level` **nicht** nötig, Meter bleiben im Live-Bereich; `onRefresh` = „Geräte aktualisieren“ `:51`). Kanäle (mit „Max“), Samplerate und der ASIO-Hinweis (`:136-140`) sind tool-eigen (`NumberInput`, ebenfalls gesperrt bei offen). Kein NDI/Bildschirm/iveo/Gegenstellen. `RemoteControlSection` (Modul „JM Audio Recorder“). **Tool-eigen:** Zielordner, Dateiname, „Spuren einzeln“, Gain (alles, was ein Preset trägt) und die Preset-Leiste; Zeitplan bleibt im Arbeitsbereich (Anhang A).
- **Kürzel:** keine. Pflichtpunkt Panel: Leertaste/Escape berühren das Tool nicht.
- **Ohne AppShell:** keins (ein Fenster).
- **Layout:** Topbar 64 px (Theme), `max-w-[1100px]` einspaltig mit Karten (Preset, Hinweis, Eingang, Transport+Ziel, Zeitplan, Pegel). Fenster 1180×820, min 920×620.
- **Master-Link:** fehlt im Preload (83 Zeilen). **Fernsteuerung:** fehlt.

### 5.3 Risiken
1. **Fernbefehle brauchen den Renderer-Store:** `init()` (`store/recorder.ts:300-345`) ist der einzige Ort, der `onRemoteCommand`, `onState`, `onLevels`, `onNotice` verdrahtet; er läuft in `App.tsx:11-13`. Bleibt `init` im `App`-Wurzelknoten, ist alles gut; wird er in eine Teilansicht gehängt, die bei Panel-Wechsel unmountet, sterben Companion-Befehle, Pegel und Zustand still.
2. **`hinweisEingang`/`hinweisOrdner` überschneiden `AudioDeviceSection`:** beide sagen „Gerät nicht gefunden“. Bei Doppelung entstehen zwei Wahrheiten. Plan: der Abschnitt zeigt den Status, das Hinweisband bleibt (nicht schließbar nach Panel-Öffnen verschwinden lassen), der Text kommt aus dem Store, nicht aus `AUDIO_TEXTE`.
3. **Kein Fehlerzustand im Aufnahmezustand:** `RecorderState` hat kein `error`; Fehler laufen nur als flüchtiger 5-s-Toast (`App.tsx:17-22`, `store/recorder.ts:228`, Schreibfehler `main/recorder.ts:205-209`). Eine Statuszeile „Aufnahme läuft“ würde nach einem Schreibfehler/Gerätverlust weiter grün stehen. Wie weit der Main `status` bei Gerätverlust zurücknimmt, ist nicht belegt (nicht gemessen). Mindestens: Toast-Text zusätzlich als sichtbarer `warn`-Eintrag halten, bis bestätigt.
4. **Presets und Panel:** `anwenden` öffnet den Eingang neu und schreibt Einstellungen nacheinander (Commits `fcf0d09b03`, `0c6c7f3b58`). Felder im Panel und die Leiste dürfen nicht um denselben Store konkurrieren; die Preset-Leiste bleibt im Live-Bereich (sie wählt Eingang+Ziel in einem Zug) und das Panel zeigt nur den aktuellen Stand.
5. **Zahlenfelder:** Kanäle/Samplerate/Dauer sind native `type=number` (↑/↓ funktionieren, `:100,126,385`). Mit dem `NumberInput` aus `@jm/ui` werden sie Textfelder (R26: Pfeile tot, Übernahme bei Enter/Blur, R21). Die Funktionsliste muss das als Änderung nennen; der Store-Test `store.test.ts` kennt die Felder.
6. **Theme-Persistenz neu:** `ThemeToggle` speichert (`jm-theme`), heute startet der Recorder immer dunkel.
7. Aufnahme, die beim Schließen abschließt (`f643d1d6aa`): AppShell/Fenster-Schließen darf daran nichts ändern.

### 5.4 Größe: **mittel** (vergleichbar Timer/Q&A; viel Zustand und viele Sonderfälle seit 0.8/0.9, aber geringe Farbmigration. Der Store (603 Z.) und die Tests bleiben, die Oberfläche wird neu zusammengesetzt).

---

## 6 · Player (`apps/player`) — Typ Live-Tool

### 6.1 Anhang A gegen Code
| Aussage | Urteil | Beleg |
|---|---|---|
| Immer sichtbar (im Abschnitt „Cue-Show“): Transportleiste Pause/Stop/Panic/GO (`ShowView.tsx:185–210`) | ✅ (✏️ Zeilen) | `:177-210`; zusätzlich links „Standby“-Anzeige `:179-186` |
| Haupttasten GO (`showGo`, `go`, Leertaste), Pause/Weiter, Stop (Esc), Panic | ✅ | `:189-209`; Verben `capabilities.ts:208-211` (`go`, `stop`, `pause`, `panic`; weitere ohne Knopf: `cue`, `standby`, `next`, `prev`, `pad`, `show`). **Pause/Weiter ist gesperrt** ohne laufende Cues (`:189`, ohne Grund), GO gesperrt ohne Standby-Cue (`:200`, ohne Grund) → beide brauchen `disabledReason` |
| Tally STATE `playing` (grün), `paused` (gelb); `playingCueIds`/`showPaused` | ✏️ | `store/player.ts:40-41`: `playing = playingCueIds.length > 0 \|\| videoCue !== null`. `playingCueIds` enthält **auch Cues in der Pre-Wait-Phase** (`:514`, „pending“) und Cues, deren Video noch nicht im Ausgabefenster steht (`:487`, `videoCue` vor `load`). „playing“ ist also nicht gleich „ist auf Sendung“ (siehe 6.3) |
| Statuseinträge: Video-Ausgabe (`output.isOpen`), Companion² 8725, Standby-Cue / laufende Cues | ✅ | `output.isOpen()` nur beim Öffnen des Modals gefragt (`ShowView.tsx:230`); Companion-Zustand läuft über `remote:reportState` aus dem Store (`store/player.ts:39-110`) |
| Einstellungen: Ausgabe auf Bildschirm (Display-Wahl, Vollbild); **Audio-Ausgabegerät: keins**; tool-eigen: Cue-Einstellungen, Pad-Hotkeys | ✅ | kein `setSinkId` im ganzen `apps/player/src`. Vollbild-Umschalter `output:toggleFullscreen`; **`isFs` im Modal ist geraten** (`useState(true)`, `ShowView.tsx:226-230`, Kommentar „öffnet immer Vollbild“) |
| Heute Modal „Video-Ausgabe“ (`ShowView.tsx:234`, `fixed inset-0`), Cue-Dialoge als Modals; Topbar-Abschnitte Bibliothek/Soundboard/Cue-Show; Theme ungespeichert; lokales `Field`; rohe Farben kaum | ✅ | drei handgebaute Modals in `ShowView.tsx` (`:234` Ausgabe, `:404` Cues hinzufügen, `:479` Cue-Einstellungen) + `SoundboardView.tsx:243`; Topbar `components/Topbar.tsx:13-17,50-57`; 7× `bg-black` (alles Schleier/Video) |
| Kürzel: Cue-Show Leertaste = GO, Esc = Stop (`ShowView.tsx:38–53`); Soundboard frei belegbare Pad-Hotkeys (`:42–55`); Bibliothek nur Enter/Esc | ✅ | Show: nur wenn `ShowView` gemountet **und** kein Dialog offen **und** Ziel nicht INPUT/TEXTAREA/SELECT (`:40-46`); Soundboard-Hotkeys `:44-55` (Ziel gleiche Ausnahme, Pads mit `cue.hotkey`); Bibliothek `LibraryView.tsx:75-77`, Soundboard-Dialog `:282-284` |
| Risiko: Knopf „GO ⏎“, ausgelöst wird Leertaste | ✅ bestätigt | Beschriftung `ShowView.tsx:208`; Handler `e.code === 'Space'` `:44`; Enter löst nichts aus. Spec 3.4 entscheidet: Anzeige berichtigen, Kürzel bleibt → `TallyButton shortcut="Leertaste"` |
| Die Haupttasten gelten nur in der Cue-Show; Immer-sichtbar abschnittsübergreifend? | ✅ + Spec-Vorgabe UO8 | Abschnittswechsel mountet die Views um (`App.tsx:30-38`), der Listener verschwindet. Die Wiedergabe selbst läuft im Store weiter (`store/player.ts`) |
| Ausgabefenster `main/output-window.ts` ohne AppShell | ✅ | Hash `#output` → `views/OutputView.tsx` (`main.tsx:8-14`) |
| ➕ seit 08.10. | – | keine Commits an `apps/player` |

### 6.2 Für den Umbau
- **Immer sichtbar:** Die Transportleiste der Cue-Show (Standby + Pause/Stop/Panik/GO). Je nach Frage 5 abschnittsübergreifend.
- **Haupttasten (4 = Maximum):** GO (`showGo`, `go`, Leertaste) · Pause/Weiter (`showTogglePause`, `pause`) · Stop (`showStop`, `stop`, Escape) · Panik (`showPanic`, `panic`; Tooltip „Sofort alles stoppen“ steht schon `:193`).
- **Tally/On-Air:** `live` nur für „spielt wirklich“. Der Store trennt Pre-Wait und Spiel nicht. Siehe 6.3 und Frage 1.
- **Statuseinträge:** Master-Link (neu) · Fernsteuerung (neu, 8725) · Video-Ausgabe (geglaubt → Frage 3; Anzeige Display/Vollbild nur aus gemessener Quelle) · Laufende Cues/Standby (Store, gemessen im Sinn von 6.3) · Pausiert (`showPaused`, Store).
- **`@jm/settings`:** `ScreenOutputSection` (Bildschirm = ein Tipp auf eine Karte öffnet sofort das Fenster `OutputModal:~245`; `enabled` = Fenster offen, `windowOpen`, `screens`, `selectedId = outputDisplayId` aus dem Store, `capabilities {toggle, fullscreen}`); `RemoteControlSection` (Modul „JM Player“). Kein Audiogerät (gibt es nicht), kein NDI, iveo, Gegenstellen. **Tool-eigen** (nur wo sie schon sind): Cue-Einstellungen je Cue (`CueSettingsModal` `ShowView.tsx:~470`, Fades, Pre-Wait, Auto-Continue, Gain, Loop) und Pad-Einstellungen (`SoundboardView.tsx:~215`), bleiben Dialoge, laufen aber über `Modal` aus `@jm/ui` (Spec 5.3: einheitliche Dialoge).
- **Navigation:** Bibliothek/Soundboard/Cue-Show als `Tabs` in der `toolbar` (Spec 5.2).
- **Kürzel:** Cue-Show: Leertaste = GO, Esc = Stop. Soundboard: Pad-Hotkeys (frei belegbar, beliebige Tasten, `normalizeKey`). Bibliothek: Enter/Esc beim Playlist-Namen. **Pflichtpunkt Panel (Spec 10, ausdrücklich Player):** Escape im Panel schließt immer das Panel, **Esc = Stop** erreicht das Tool dann nicht; Leertaste auf einem Schalter/Knopf **im Panel** löst GO aus (der Show-Listener nimmt nur INPUT/TEXTAREA/SELECT aus, `ShowView.tsx:41`), und der Schalter schaltet nicht. Ein offenes Panel zählt **nicht** als „Dialog offen“ (`:40` kennt nur `addOpen`, `outputOpen`, `editCue`): die Leertaste feuert auch bei offenem Panel. Konsequenz bei einem Pad-Hotkey wie „M“ im Panel: nicht betroffen (Felder behalten die Tasten), aber ein Knopf-Fokus im Panel + Leertaste = Cue feuert live.
- **Ohne AppShell:** `views/OutputView.tsx` (`#output`, `bg-black`).
- **Layout heute:** Topbar 64 px mit Nav; `main` `overflow-hidden`; Bibliothek = Liste + 440-px-Vorschau-Aside (`LibraryView.tsx:526`); Show = Kopf, Cue-Liste, Videofortschritt, Transport. Fenster 1320×880, min 1040×660.
- **Master-Link:** fehlt im Preload (122 Z.). **Fernsteuerung:** fehlt.

### 6.3 Risiken
1. **„spielt“ ist nicht „auf Sendung“:** `playingCueIds` führt Pre-Wait-Cues mit (`store/player.ts:514`) und ein Video-Cue steht dort schon vor `output.command({type:'load'})` und vor dem Öffnen des Ausgabefensters (`:487-501`; öffnet das Fenster nur, wenn `isOpen()` false). `onAir.live = playing` würde bis zu `preWaitSec` zu früh rot. Für ein ehrliches `live` braucht der Store die Trennung (neues Feld im Store, kein Main-Umbau).
2. **Companion-Zustand und Oberfläche teilen dieselbe Ableitung** (`computeRemoteState`, `:39-47`): ändert man `playingCueIds` oder den Bezug, ändert sich auch `playing`/`playing_count` der Stream-Deck-Feedbacks. Test-Reihenfolge: erst Store-Test, dann Oberfläche.
3. **Die Leertaste feuert auch auf „Knopf mit Fokus“:** Folge des neuen Panels siehe 6.2; ein `TallyButton` selbst hat Fokus nach Mausklick, Leertaste darauf löst per Handler GO aus, **nicht** den Knopf (`preventDefault`, `:44-45`) — wie heute bei GO ⏎.
4. **Abschnittswechsel unmountet `ShowView` samt Listener** (`App.tsx:30-38`): ein laufendes Cue ist dann nur noch über die Statusleiste sichtbar und per Maus in der Cue-Show stoppbar. Mit dem Tab-Umbau darf das nicht schlimmer werden. Siehe Frage 5.
5. **`OutputModal` rät `isFs`** (`useState(true)`): wird `ScreenOutputSection` mit `fullscreen` beschickt, steht ein geratener Wert in einem Feld, das „gemessen“ behauptet. Entweder Vollbild-Zustand aus dem Main lesen (neu, lesend) oder `fullscreen` nicht anbieten.
6. **Pad-Hotkeys sind beliebige Tasten** (`SoundboardView.tsx:44-55`): bei offenem Panel feuern sie, solange das Ziel kein Feld ist. Zusammen mit Punkt 3 der eigentliche Live-Fehler-Kandidat; in der Funktionsliste als eigener Pflichtpunkt führen.
7. **Library-Vorschau spielt im Hauptfenster** (`LibraryView.tsx:533,540`, `<video>`/`<audio autoPlay>`): wird von `playing` nicht erfasst, geht über das Standard-Audiogerät. Kein Statuseintrag nötig, aber nicht als „Ausgabe“ ausgeben.

### 6.4 Größe: **mittel bis groß** (Recorder/Timer als Maßstab: etwas größer): 4 Views (≈1900 Zeilen) bleiben, aber 4 handgebaute Modals → `Modal`, Topbar → `AppShell` + `Tabs`, Transport → 4 `TallyButton` mit Sperrgründen, Store-Trennung pending/playing, Ausgabe-Abschnitt, Master-Link + Fernsteuerung. Die Bibliothek (836 Z.) selbst bleibt unangetastet.

---

## 7 · Offene Fragen an den Owner (nur Entscheidungen, die den Bau ändern)

1. **Was heißt „ON AIR“ in Caption, Interpreter, Prompter, Player (und Stage-Display)?** Spec 7.4: `live` nur für echte Sendezustände. Vorschlag: Caption `live = NDI sendet UND Transkription läuft` (Label „LIVE“; die Taste Start/Stopp zeigt `live` nur bei `running`, mit sichtbarem Mikrofonfehler); Interpreter `live = Mix läuft` (Label „MIX AKTIV“, Warnzeile, wenn das Ausgabegerät kein bekanntes Kabel ist, siehe 2.2); Prompter `live = scrollt UND Talent-Monitor offen`; Player `live = ein Cue spielt wirklich (ohne Pre-Wait)`; Recorder `live = nimmt auf` (unstrittig); Stage-Display **keine** On-Air-Anzeige (nur „Bühnenschirm offen“ als Knopfzustand). Begründung: sonst steht „rot“ für etwas, das nichts sendet (Caption ohne Mikrofon, Player im Pre-Wait).
2. **Hell-Modus für Caption und Interpreter jetzt mitbauen?** (Caption 64, Interpreter 48 rohe Farbstellen auf Tokens.) Der AppHeader zeigt den Hell/Dunkel-Schalter immer (`AppHeader.tsx:61`). Empfehlung: ja, mit dem Umbau, weil ein Schalter, der den Schirm unlesbar macht, schlimmer ist als gar keiner; der Ausgabe-Zeichner `lib/caption-cg.ts` (NDI-Bild) bleibt unberührt.
3. **Dürfen wir eine dritte lesende Brücke bauen: „Ausgabefenster ist offen“?** (Prompter, Stage-Display, Player; ein `onChange`-Ereignis in `@jm/output-window` plus ein IPC-Kanal je App; kein Verhalten ändert sich.) UO3 deckt nur Master-Link und Fernsteuerung. Empfehlung: ja, klein, behebt 0.7. Ohne sie zeigt die Statusleiste „an (ohne Rückmeldung)“ (Warnfarbe, wie Switcher-Zweitbildschirm E4) und der Knopf kann nie `live` sein.
4. **Welche Regler bleiben im Live-Bereich statt im Panel?** Prompter-**Tempo** und Stage-Display-**Anzeige-Elemente** (Uhr/Timer/Switcher/Presenter/Nachricht ein-/ausblenden) werden während der Sendung bedient; Companion hat dafür sogar `speed`/`faster`/`slower`. Empfehlung: Tempo bleibt unter dem Transport (ein Regler), Schriftgröße/Spiegeln/Lese-Linie wandern ins Panel; Stage-Display-Elemente bleiben als eine Reihe Schalter unter der Vorschau; Quellen und Bildschirm wandern ins Panel.
5. **Player UO8 bestätigen:** Haupttasten nur in der Cue-Show (Spec-Vorgabe „nein“), die Statusleiste zeigt laufende Cues überall. Empfehlung: bestätigen, **aber** Leertaste/Esc auch dann nicht abschnittsübergreifend machen (wäre eine neue Funktion). Die Alternative „Panik/Stop als feste Fußleiste in allen Abschnitten“ ist ein Layout, keine neue Funktion; sie kostet einen halben Tag und schließt das Risiko 6.3.4. Entscheiden, ob gewollt.
6. **Interpreter-Warntext (Wortlaut):** der feste Paket-Text „Ein Wechsel stoppt die laufende Verarbeitung“ ist hier falsch (2.1). Empfehlung: App-eigener Text „Wirkt erst nach Stopp und erneutem Start“ je Wahl (nicht nur beim Ausgabegerät, wie heute), zur Freigabe in der Texttabelle (R28), ohne Änderung des Verhaltens.

Bewusst **nicht** gefragt (entschieden oder Empfehlung reicht): GO-Beschriftung → Spec 3.4 (`TallyButton shortcut="Leertaste"`); keine neuen Kürzel (UO5/F4); keine Companion-Fernsteuerung für Interpreter/Stage-Display (existiert nicht); Preset-Leiste im Recorder bleibt im Live-Bereich.

## 8 · Blocker / Voraussetzungen
- Keine harten Blocker. `@jm/ui` (`AppShell`, `AppHeader`, `StatusBar`, `TallyButton`, `SettingsPanel`, `Tabs`, `Modal`, `Toggle`, `NumberInput`, `ThemeToggle`) und `@jm/settings` (`NdiOutputSection`, `ScreenOutputSection`, `RemoteControlSection`, `AudioDeviceSection`, `PeersSection` inkl. Stage-Display-Modell) sind da; Master-Link-Hauptprozess ist fertig.
- Vor dem Plan klären: Frage 1, 3 und 4 (ändern Umfang). 2, 5, 6 können im Plan mit Vorgabe laufen.
- Vorarbeit je App (`package.json`: `@jm/settings`, Lockfile), `test/ui` neu (nur Recorder und Stage-Display haben vorher Renderer-nahe Tests).
- Die Release-Reihenfolge ist Sache des Owners (Welle 2 gesammelt, Spec 9.1). Presenter, Connect, Studio-Control sind nicht Teil von 2a.

## 9 · Größen im Überblick (Maßstab: Timer, Q&A = mittel)
| App | Größe | Treiber |
|---|---|---|
| Caption | mittel | 64 Farben, NDI-Engine im Renderer schützen, 4 lesende Ergänzungen |
| Interpreter | klein bis mittel | 1 Datei, 48 Farben, Engine-Lebensdauer, falscher Warntext |
| Prompter | klein bis mittel | 2 Abschnitte, Ausgabe-Rückmeldung, Tempo bleibt live |
| Stage-Display | klein bis mittel | Gegenstellen passen fast fertig, Rest-Abschnitt PIN/Modus/Elemente |
| Recorder | mittel | viel Zustand seit 0.8/0.9, Presets, Hinweisband, Zahlenfeld-Änderung |
| Player | mittel bis groß | 4 Modals, Tabs, Tally-Wahrheit, Store-Trennung pending/playing |
