# Nachmessung UX Welle 2b: Presenter, Studio-Control, Connect

Stand: 22.11.2026, gemessen an `main` `0f589c3ee1` (nach UX Welle 1, Switcher 0.12.1 und Anmeldung Teil 2); Stichproben am 22.11. gegen
`main` `d7cdd79ce0` bestätigt. Nur gelesen, nichts gebaut, kein Fenster
geöffnet. Was nur aus dem Code abgeleitet ist, steht als „abgeleitet“.

- **Vergleichsstand 08.10.:** `b7e959866d` (letzter Commit auf `main` am 08.10.2026, Merge #249). Damals Connect 0.2.2,
  Presenter 0.10.1, Studio-Control 0.6.0. Heute Connect 0.5.0, Presenter 0.14.0, Studio-Control 0.6.0.
- **Commits seit 08.10.:** Presenter 58, Connect 150, Studio-Control **0** (letzter Commit `9b6d952021`, 28.06.2026).
- **Pfade:** ohne Präfix relativ zu `apps/<app>/src/renderer/src/`; `main/…`, `preload/…`, `shared/…`, `renderer/…`
  relativ zu `apps/<app>/src/`; `packages/…`, `docs/…` relativ zur Repo-Wurzel.
- **Rohe Farben** gezählt mit einem einmaligen Zählskript (nicht im Repo): Regex des Battle-Wächters
  (`apps/battle/test/ui/panel.test.tsx:175-195`) über alle `.ts/.tsx/.css/.html` des Renderers, Kommentare entfernt.
  Gezählt werden Fundstellen (nicht Zeilen): Palettenklassen (`neutral-800`, `amber-400` …), `white/black`-Klassen,
  Hex (3/4/6/8 Ziffern), `rgb()/rgba()/hsl()`.
- **Legende:** ✅ stimmt noch · ✏️ geändert (heute, mit Ort) · ❌ falsch (auch schon am 08.10.) · ➕ neu seit 08.10. bzw.
  in Anhang A nicht erfasst.

---

## 0 · Querschnitt (gilt für alle drei)

1. **Master-Link:** Der Hauptprozess-Teil steht in allen drei Apps (`initAppRuntime` in `main/index.ts`; Abfrage und
   Ereignis `jmps:master-link` an alle Fenster, `packages/app-runtime/src/master-link-ipc.ts:18-49`). **Kein Preload und
   kein Renderer liest ihn** (nur Battle, Q&A, Rundown, Switcher, Timer, Titler haben `masterLink` im Preload). Muster:
   `apps/switcher/src/preload/index.ts:127-134`. Das Ereignis geht auch an das unsichtbare Connect-Peer-Fenster und das
   NDI-Fenster des Presenters (harmlos).
2. **Fernsteuerung (Companion²):** In keiner der drei Apps ist der Steuerserver-Zustand gemessen im Renderer.
   Presenter: `void startControlServer()` ohne Auswertung (`apps/presenter/src/main/index.ts:165`), kein `onStatus`.
   Connect: `status.controlPort` ist eine **Konstante** (`main/control-server.ts:21`, `shared/app-status.ts`), kein
   `onStatus`; nur ein Startfehler geht ins Log (`main/index.ts:177`). Studio-Control: `gatewayStatus()` existiert,
   wird aber **nirgends aufgerufen** (`main/gateway/control-gateway.ts:338-340`). Muster für die Meldung:
   `apps/timer/src/shared/fernsteuerung.ts` (R1, R14).
3. **Elektron-Standardmenü:** Keine der drei Apps setzt ein eigenes Anwendungsmenü (kein `setApplicationMenu`). Damit
   gelten in allen Fenstern die Kürzel des Standardmenüs (F11 Vollbild, Strg+R Neu laden, Strg+Umschalt+I, Strg+W, Zoom
   Strg +/−/0), abgeleitet, nicht gemessen. Der Presenter nutzt das bewusst (Kommentar `PresenterView.tsx:34-35`). Für
   Connect heißt Strg+R: Renderer lädt neu, die Raum-WebSocket fällt (abgeleitet). Gehört als Zeile in jede
   Funktionsliste (Abschnitt „Tastatur“), ist aber kein Umbau-Thema.
4. **TallyButton und Umschalter ohne Sendezustand:** Der Baustein kennt nur `bereit | live | gesperrt`
   (`packages/ui/src/components/TallyButton.tsx:8-20`); `live` zeigt „LIVE“. Welle 1 hat Umschalter ohne Sendezustand mit
   `bereit` und wechselnder Beschriftung gebaut (Battle „Voting“ `apps/battle/src/renderer/src/lib/oberflaeche.ts:118-125`,
   Q&A „Saal“ `apps/qa/src/renderer/src/lib/oberflaeche.ts:154`). Diese Präzedenz deckt Presenter Schwarz/Weiß, Connect
   Talkback (gehalten) und Studio-Control TriCaster-REC/STREAM ohne Rückmeldung; dafür ist **kein** Owner-Entscheid nötig.
5. **Halten:** `erzeugeHalten` (`packages/ui/src/lib/halten.ts`) ist nicht aus `@jm/ui` exportiert (`packages/ui/src/index.ts`).
   Der TallyButton ist mindestens 48 px hoch und `w-full` (`TallyButton.tsx:148-152`) und passt nicht in eine Gastzeile.
   Zwei Stellen brauchen kleine Halte-Knöpfe: Connect-Talkback je Gast (`apps/connect/src/renderer/src/App.tsx:488-498`)
   und der PTZ-Joystick (`apps/studio-control/src/renderer/src/components/video/PtzPanel.tsx:361-405`).
6. **Kopfzeile „bereit“:** `AppHeader` zeigt bei `onAir={live:false}` „bereit“ in Grün
   (`packages/ui/src/components/AppHeader.tsx`). Für Tools mit ungemessenen Sendewegen (Studio-Control: TriCaster und
   Licht melden nichts; Connect: Zoom-Slots haben kein Tally) wäre „bereit“ eine Aussage ohne Messung (Spec 7.2, 7.3).
   `onAir` weglassen heißt „keine Anzeige“ (Spec 3.1).
7. **Tests:** Presenter hat Selbsttests (14 Dateien, `apps/presenter/package.json` „selftest“), zwei lesen Renderer-Quellen
   (`test/ndi-schalter.test.ts`, `test/publikumsbild.test.ts`). Connect hat viele Quelltext-Wächter auf genau die
   Dateien, die umgebaut werden (Abschnitt 3.10). **Studio-Control hat weder `test/` noch ein „selftest“-Skript und läuft
   nicht im CI** (`.github/workflows/ci-checks.yml`, kein Eintrag).

---

## 1 · Presenter (`apps/presenter`, 0.14.0)

### 1.1 Anhang A gegen heute

| # | Aussage in Anhang A (08.10.) | Befund | heute |
|---|---|---|---|
| 1 | Immer sichtbar im Editor: „▶ Präsentieren“ (`components/Toolbar.tsx:270`) | ✏️ | `components/Toolbar.tsx:296-306`; während einer Präsentation an derselben Stelle „■ Beenden“ (`:287-294`) |
| 2 | Immer sichtbar im Referentenfenster: aktuelle + nächste Folie, Nav (`views/PresenterView.tsx:100-125`) | ✏️ | Rumpf `views/PresenterView.tsx:145-199`: aktuelle Folie `:147-151`, Nav `:152-176`, nächste Folie `:182-191`, Notizen `:192-197`, Timer-Leiste `:181` |
| 3 | Haupttasten: ◀ Zurück (`jmpr.present.prev`) · Weiter ▶ (`next`) | ✅ | `views/PresenterView.tsx:153-155`, `:173-175`; am Rand gesperrt (`disabled`, ohne Grund) |
| 4 | Schwarz (`setScreen('black')`, Taste B) · Weiß (`setScreen('white')`, W) | ✅ | Kopf-Knöpfe ⬛/⬜ `views/PresenterView.tsx:103-116`; Umschalter, `main/present.ts:145-150` (zweiter Druck = zurück auf „live“) |
| 5 | „■ Beenden“ (`stop`, Esc) als Kopf-Aktion | ✅ | `views/PresenterView.tsx:138-140` |
| 6 | Verben `prev/next/black/white/stop` | ✅ (unvollständig) | dazu `goto`, `live`, `open` (`packages/suite-control-protocol/src/capabilities.ts:340-353`, `main/control-server.ts:41-75`) |
| 7 | Tally: STATE `active`, `live`; `black`/`white` als Sonderzustand | ✅ | `main/suite-state.ts:103-112`; `live = active && screen==='live'` (#228, Launcher zeigt bei `live=1` „ON AIR“) |
| 8 | Status: Master-Link¹ | ✅ (Lücke) | Main ja, Preload nein (Abschnitt 0.1) |
| 9 | Status: Publikums-Bildschirm (Display-Wahl `Toolbar.tsx:152`, Vollbild) | ✏️ | `components/Toolbar.tsx:163-186`, neu mit „Keiner – nur NDI“ (nur Windows, `:181-185`, #303); im Referenten `views/PresenterView.tsx:82-100` |
| 10 | Status: Companion² (Port 8728) | ✅ (Lücke) | `main/control-server.ts:24`; keine Meldung an den Renderer |
| 11 | Status: Handy-Fernsteuerung (`RemotePanel`: `status.running`, Port 7330, PIN) | ✅ | `components/RemotePanel.tsx:20-31`, `RemoteStatus` `shared/types.ts:194-203` (gemessen: `running`, `url`, `pin`, `error`) |
| 12 | Status: JM-Timer-Sync (`timerConnected`, Host/Port 7777) | ✅ | `components/Toolbar.tsx:37-38`, `:55-57`; `TimerSource.connected` `shared/types.ts:255-265` |
| 13 | Einstellungen: Ausgabe auf Bildschirm (Publikums-Bildschirm) | ✅ | wie Nr. 9; dazu „Publikum Vollbild“ nur im Referenten `views/PresenterView.tsx:118-124` |
| 14 | Einstellungen: Fernsteuerung (Companion-Status + Handy-Remote: an/aus, Interface, Port, PIN) | ✅ | `components/RemotePanel.tsx:62-128`; nur aus dem Referentenfenster erreichbar (📱 `views/PresenterView.tsx:135-137`) |
| 15 | Tool-eigen: „Office-Animationen splitten“ (experimentell), Timer-Sync (an/aus, Host, Port) | ✅ | ⚙-Menü `components/Toolbar.tsx:204-224` (`localStorage` `jmpr.expandPptxBuilds`, `lib/settings.ts`), `:228-281` |
| 16 | Heute: ⚙-Dropdown mit 2 Schaltern (`Toolbar.tsx:165-260`, `fixed inset-0`-Klickfänger) | ✏️ | `components/Toolbar.tsx:190-285`, Klickfänger `:201` |
| 17 | Heute: Modal `RemotePanel` aus der Referentenansicht | ✅ | `views/PresenterView.tsx:237`, Überlagerung `components/RemotePanel.tsx:50` |
| 18 | Rohe Farben: PresenterView/RemotePanel dunkel fest (`white/black` 38×) | ✏️ | **129 Fundstellen** (96 white/black, 15 Palette, 15 Hex, 3 rgb): PresenterView 36, RemotePanel 26, GastKlickerAbschnitt 19, OeffnenFrage 8, TimerBar 8, NdiSchalter 7, GastKlickerPille 6, Rest ≤ 4 |
| 19 | Kürzel: 16 Tasten in `lib/usePresentation.ts:42-83`, **nur im Referentenfenster aktiv** | ❌ | `lib/usePresentation.ts:44-96`; aktiv im Referenten **und im Publikumsfenster** (`views/AudienceView.tsx:19`, `usePresenterKeys(true)`; war am 08.10. schon so, `b7e959866d`) |
| 20 | Handy-Seite `main/remote-page.ts` eigene Tasten | ✅ | `main/remote-page.ts:146`, `:155-166` |
| 21 | Drei Fenster (`main/windows.ts`: Editor/Presenter/Audience) | ✏️ | **vier**: dazu das unsichtbare NDI-Fenster (`main/windows.ts:327-348`, `?view=ndi`, ohne React-Baum `main.tsx:31-34`, #303) |
| 22 | Audience bekommt kein AppShell, Referent ein reduziertes (Bühnen-Dunkel), Editor eigentlich „Werkzeug“ (3 Spalten) | ✅ | Editor-Raster `views/EditorView.tsx:49` (`260px | 1fr | 320px`) |
| 23 | AppShell muss zwei Ausprägungen in einer App tragen | ✅ (verschärft) | siehe 1.10 R1–R3: Theme fest dunkel, Mac-Titelleiste des Referenten |
| ➕ 24 | – | ➕ #303 | NDI-Schalter mit Empfängerzahl in Editor und Referent (`components/NdiSchalter.tsx:23-46`), Status `NdiStatus` `shared/types.ts:283-294` (gemessen) |
| ➕ 25 | – | ➕ #309 | Referentenansicht Vollbild: Knopf `views/PresenterView.tsx:125-131`, F11 `:36-44`, gemerkt in `referent-config.json` |
| ➕ 26 | – | ➕ #317 Stufe A | Gast-Klicker: Abschnitt im Fernsteuerungs-Modal (`components/GastKlickerAbschnitt.tsx:8-121`), Pille im Referentenkopf (`components/GastKlickerPille.tsx:89-119`), Status `GastKlickerStatus` `shared/gast-klicker.ts:13-22` (gemessen), Dienst `services/gast-klicker` |
| ➕ 27 | – | ➕ #293 | Schleife im Referentenkopf (`views/PresenterView.tsx:117`, `:249-266`), rechte Editor-Spalte mit Reitern „Folie“/„Übergänge“ (`views/EditorView.tsx:75-102`) |
| ➕ 28 | – | ➕ #298/#299 | Drag & Drop über das ganze Editorfenster (`components/DateiAblage.tsx`, um alles in `views/EditorView.tsx:25`), Öffnen-Frage als Overlay mit Esc (`components/OeffnenFrage.tsx:23-39`) |
| ➕ 29 | – | ➕ | Referentenfenster hat auf dem Mac **keinen** `hiddenInset` (`main/windows.ts:150-163`), der Editor schon (`:124`) |
| ➕ 30 | – | ➕ | Weitere Referent-Kopfknöpfe: „Publikum Vollbild“ (`:118-124`), „Übersicht“ (`:132-134`, Overlay `:202-235`), „Gehe zu“ (`:156-172`), Uhr (`components/Clock.tsx`) |

### 1.2 Fenster und Rahmen

| Fenster | Ansicht | heute | Rahmen nach Spec 5.3 |
|---|---|---|---|
| Editor | `?view=editor` (`main.tsx:13`, `views/EditorView.tsx`) | eigener Kopf `components/Toolbar.tsx:110-119` (h-14, Logo, „JM PRESENTER / Folien-Editor & Präsentation“, Ziehfläche, Mac-Einzug), 3-Spalten-Raster, Fehler-/Hinweisband `views/EditorView.tsx:28-44`; Fenster 1320×880, min. 900×640 (`main/windows.ts:109-112`) | AppShell Typ „Werkzeug“: `toolbar` = Datei-Knöpfe, Arbeitsfläche = Raster |
| Referent | `?view=presenter` (`views/PresenterView.tsx`) | fest dunkel `bg-[#0c0c0c] text-white` (`:67`), Kopf mit 14 Bedienelementen (`:71-142`); Fenster 1500×920, min. 1024×620, `backgroundColor '#0c0c0c'`, ohne `hiddenInset` (`main/windows.ts:150-163`) | reduziertes Live-Tool, bühnendunkel |
| Publikum | `?view=audience` (`views/AudienceView.tsx`) | Vollbild, schwarz (`main/windows.ts:212-232`) | kein Rahmen (Programm) |
| NDI | `?view=ndi`, unsichtbar (`main/windows.ts:327-348`) | kein React-Baum | kein Rahmen |

### 1.3 Immer sichtbar und Haupttasten

- **Editor:** Folienliste, Bühne, rechte Spalte; einzige echte Live-Aktion „▶ Präsentieren“ / „■ Beenden“
  (`startPresentation` `components/Toolbar.tsx:79-91` → `jmpr.present.start(payload, startZielFuer(…))`; `present.stop()`
  `:290`). Gesperrt heute ohne Grund bei `busy.active || visibleCount === 0` (`:299`); beim Klick ohne sichtbare Folie
  zusätzlich Fehler „Keine sichtbaren Folien zum Präsentieren.“ (`:80-83`). Kürzel: keins.
- **Referent (Live-Bereich):**

| Taste | Handler | Verb | Kürzel (heute) | Sperre heute |
|---|---|---|---|---|
| ‹ Zurück | `jmpr.present.prev()` (`views/PresenterView.tsx:153`) | `prev` | ← ↑ Bild↑ Rücktaste | `index <= 0`, ohne Grund |
| Weiter › | `jmpr.present.next()` (`:173`) | `next` | → ↓ Bild↓ Leertaste Enter | `index >= total-1`, ohne Grund |
| Schwarz ⬛ | `setScreen('black')` (`:104`), Umschalter | `black` | B, b, `.` | nie |
| Weiß ⬜ | `setScreen('white')` (`:111`), Umschalter | `white` | W, w, `,` | nie |
| ■ Beenden (Kopf-Aktion) | `present.stop()` (`:138`) | `stop` | Esc | nie |

  Dazu ohne Kürzel: Pos1/Ende springen (`lib/usePresentation.ts:64-71`, Verb `goto`), „Gehe zu“ (Formular, Enter).
  Schwarz/Weiß als TallyButton: nach Präzedenz (0.4) `bereit` mit Beschriftung „Schwarz · an“ o. ä., nicht `live`.

### 1.4 Tally / On-Air (nur echte Sendezustände, Spec 7.4)

- Quelle: `PresentationState` aus dem Main (`present:state`, `shared/types.ts:90-99`). Echter Sendezustand = Publikum
  sieht Folien: `active && screen === 'live'` (dieselbe Regel wie STATE `live`, `main/suite-state.ts:108`).
  Schwarz/Weiß sind Pausen, kein „auf Sendung“. Gemessen ist das als Zustand des Hauptprozesses; ob das Publikumsfenster
  tatsächlich sichtbar ist bzw. NDI sendet, steht separat (Status Bildschirm/NDI).
- Kopfanzeige in **beiden** Fenstern sinnvoll (Editor zeigt während der Präsentation „■ Beenden“).

### 1.5 Statuseinträge (Quelle, gemessen oder nur Einstellung)

| Eintrag | Gruppe | Quelle im Code | gemessen? |
|---|---|---|---|
| Master-Link | verbindung | fehlt im Preload (0.1) | Main: ja; Renderer: Brücke fehlt |
| Timer (JM Timer) | verbindung | `timer:state` → `TimerSource.connected` (`preload/index.ts:149-158`) | **gemessen** (Socket) |
| Publikums-Bildschirm | ausgabe | `present.displays()` mit `current` = Fenster steht dort (`main/windows.ts:382-396`); keine Push-Meldung, Liste nur beim Einhängen (`components/Toolbar.tsx:47-53`) | Lage des Fensters **gemessen** beim Abruf; Vollbild **nicht** (Umschalter liefert nur den angeforderten Wert, `main/windows.ts:253-258`) |
| NDI | ausgabe | `NdiStatus {an, lage, empfaenger, grund}` per Push (`lib/useNdiStatus.ts`) | **gemessen** (`sendet` erst mit bereitem Fenster, Empfänger vom Sender); nur Windows |
| Companion | fernsteuerung | keine Meldung | **Lücke** (Companion²) |
| Handy-Fernsteuerung | fernsteuerung | `RemoteStatus` per Push (`remote:status`) | **gemessen** (`running`, `error` z. B. Port belegt) |
| Gast-Klicker | fernsteuerung | `GastKlickerStatus` per Push (`gastKlicker:status`) | **gemessen** (`verbunden/verbindet/getrennt/abgelehnt`, Gästezahl, pausiert) |
| Präsentation / Folie n von m | tool | `PresentationState` | gemessen (Main-Zustand) |

Kein Eintrag misst „Publikumsfenster im Vollbild“; Spec 7.2: „unbekannt“ bzw. weglassen.

### 1.6 Einstellungen: `@jm/settings` gegen tool-eigen

| Abschnitt | Passt? | Bemerkung |
|---|---|---|
| `ScreenOutputSection` | teilweise | Bildschirmwahl + Vollbild (`capabilities.fullscreen`). „Keiner – nur NDI“ ist **keine** Bildschirm-ID (`StartZiel = number|null|'keiner'`, `shared/types.ts:300`) und kennt der Abschnitt nicht (`selectedId: number|null`, `packages/settings/src/abschnitte/screen-output.ts:11-22`). Lösung im Plan: eigener Schalter „nur NDI“ im NDI-Abschnitt oder tool-eigene Zeile. |
| `NdiOutputSection` | ja | nur `capabilities.toggle`; Name fest „JM Presenter“ (`shared/ndi.ts:6`), Auflösung/Bildrate fest (1920×1080, 25 fps) → als Hinweis, nicht als Felder. Unter macOS ausblenden (Spec 6.1 „was ein Tool nicht kann, wird ausgeblendet“; heute gesperrt `components/NdiSchalter.tsx:32`). |
| `RemoteControlSection` (Variante `tool`) | ja | Companion, Port 8728 fest, braucht die Meldung (0.2). |
| `PeersSection` (Modell Stage-Display: `capabilities.toggle`, ohne Auto) | ja | „JM Timer“: an/aus, Host, Port, verbunden (`components/Toolbar.tsx:228-281`). |
| tool-eigen „Handy-Fernsteuerung“ | – | an/aus, Netzwerkkarte, Port, PIN, QR/URL/PIN (`components/RemotePanel.tsx:62-128`); Präzedenz Timer LAN-Remote im Panel (R11). |
| tool-eigen „Gast-Klicker“ | – | an/aus, Link, „Für den Zoom-Chat kopieren“, Pause, „Neuer Link“ mit `window.confirm` (`components/GastKlickerAbschnitt.tsx:48-117`, `:104`). |
| tool-eigen „Import“ | – | „PPTX-Aufbau-Animationen als Einzelschritte“ (experimentell, `components/Toolbar.tsx:204-224`), nur im Editor sinnvoll. |
| `IveoSection`, `AudioDeviceSection`, `DataLinkSection` | nein | kommt im Presenter nicht vor. |

### 1.7 Kürzel (vollständig, heute)

| Fenster | Taste | Wirkung | Ort |
|---|---|---|---|
| Referent **und Publikum** | → ↓ Bild↓ Leertaste Enter | weiter | `lib/usePresentation.ts:48-56` |
| Referent und Publikum | ← ↑ Bild↑ Rücktaste | zurück | `:57-63` |
| Referent und Publikum | Pos1 / Ende | erste / letzte Folie | `:64-71` |
| Referent und Publikum | B b `.` / W w `,` | Schwarz / Weiß (Umschalter) | `:72-84` |
| Referent und Publikum | Esc | Präsentation beenden | `:85-88` |
| Referent | F11 | Referentenansicht Vollbild (mit `preventDefault` gegen das Standardmenü) | `views/PresenterView.tsx:36-44` |
| Referent | Enter im Feld „Folie“ | „Gehe zu“ | `:156-172` |
| Editor | Esc | Öffnen-Frage abbrechen | `components/OeffnenFrage.tsx:26-31` |
| Editor | Enter in Übergangs-Feldern | Feld verlassen (übernehmen) | `components/UebergaengePanel.tsx:208-210` |
| alle | Standardmenü (F11, Strg+R …) | abgeleitet | 0.3 |
| Handy-Seite | eigene Tasten | – | `main/remote-page.ts:146`, `:155-166` |

Die Fenster-Kürzel hängen an `window` (nicht am Fokus). Mit Panel im Referenten gilt der `SettingsPanel`-Vertrag
(`packages/ui/src/components/SettingsPanel.tsx:49-63`): Esc im Panel schließt nur das Panel (React-`stopPropagation`
erreicht den `window`-Hörer nicht, abgeleitet), Leertaste/Enter auf Knopf oder Schalter im Panel blättern weiter.

### 1.8 Rohe Farben

129 Fundstellen (1.1 Nr. 18). Gewollt und Programm: `views/AudienceView.tsx` (4), `ndi/ndi-ansicht.ts` (1),
`lib/paint.ts`/`lib/pdf.ts` (Canvas). Echte Umzüge: Referent (PresenterView 36, RemotePanel 26, GastKlicker 25,
TimerBar 8, NdiSchalter 7) und OeffnenFrage (8, Editor-Overlay in dunkel fest `bg-white/5`).

### 1.9 Master-Link und Fernsteuerung

Master-Link: Main vorhanden, Brücke im Preload fehlt. Fernsteuerung: Meldung fehlt ganz (Start-Ergebnis verworfen,
`main/index.ts:165`). Beides nach Welle-1-Muster nachrüsten (E2 / R1 / R14).

### 1.10 Risiken

- **R1 Bühnendunkel gegen ThemeToggle:** `AppHeader` rendert `ThemeToggle` immer (`packages/ui/src/components/AppHeader.tsx`),
  `useTheme` merkt je Tool in `localStorage` `jm-theme`. Editor, Referent und Publikum teilen den Ursprung (alle aus
  demselben Bündel geladen, `main/windows.ts:50-57`). Ein „Hell“ im Editor schaltet beim nächsten Öffnen auch den
  Referenten hell (abgeleitet). Ein fest dunkler Referent braucht eine additive Prop in `@jm/ui` oder einen Rahmen ohne
  `AppHeader`.
- **R2 Mac-Titelleiste:** Der Referent hat eine echte Titelleiste (kein `hiddenInset`, `main/windows.ts:150-163`), aber
  `isElectronMac` prüft nur den User-Agent (`packages/ui/src/lib/titlebar.ts`). Der `AppHeader` setzt dann 80 px
  Ampel-Einzug ohne Ampel. `AppHeader` hat `mac`, `AppShell` reicht es nicht durch (`packages/ui/src/components/AppShell.tsx:73-81`).
- **R3 Kürzel im Publikumsfenster:** Anhang A nennt nur den Referenten (❌ Nr. 19). Wer das Publikumsfenster anklickt
  (Vollbild auf Bildschirm 2), blättert dort per Klicker. Die Funktionsliste muss das als eigene Zeile führen, der Umbau
  darf `usePresenterKeys` in `AudienceView` nicht verlieren.
- **R4 Editor-Raster und Panel:** 260 + 320 px feste Spalten (`views/EditorView.tsx:49`) plus 360 px Panel: Ab 900 px
  schiebt das Panel (Spec 3.1). Bei 1320 px bleiben ~380 px Bühne, bei 1000 px nur ~60 px (gerechnet, nicht gemessen).
- **R5 TallyButton in der Werkzeugleiste:** „Präsentieren“ ist eine echte Live-Aktion (Spec 5.2), der TallyButton ist
  mindestens 48 px hoch, die Werkzeugleiste `py-1.5` (`AppShell.tsx:82-86`). Der Plan muss den Ort festlegen (rechts in der
  Leiste oder eigener Streifen).
- **R6 Drag & Drop:** Die Ablage umschließt heute das ganze Editorfenster samt Kopf (`views/EditorView.tsx:25`).
  `AppShell` muss **innerhalb** von `DateiAblage` stehen, sonst importiert ein Ablegen auf Kopf oder Statusleiste nichts
  (die Navigation sperrt der Main ohnehin, `main/windows.ts:88-96`). Ein Ablegen auf das offene Panel importiert dann
  ebenfalls (abgeleitet).
- **R7 Einstellungen in zwei Fenstern:** Handy-Fernsteuerung und Gast-Klicker sind heute nur im Referenten erreichbar
  (also nur während einer Präsentation), Timer-Sync und Import-Option nur im Editor. Beide Fenster sind getrennte
  Renderer: Ein Panel in beiden heißt zweimal dieselbe Abfrage (Push-Kanäle gehen an alle Fenster, `broadcastAll`
  `main/windows.ts:398-403`).
- **R8 Erster „Werkzeug“-Rahmen der Suite:** Welle 1 hatte nur Live-Tools. Der Presenter-Editor setzt das Muster für
  Welle 3 (Spec 5.2).
- **R9 Gesperrte Nav ohne Grund:** Zurück/Weiter sind am Rand `disabled` ohne Text (`:153`, `:173`); TallyButton verlangt
  einen Grund („Erste Folie“/„Letzte Folie“, neue Texte zur Freigabe).

### 1.11 Owner-Entscheidungen Presenter

**P1 · Rahmen der Fenster (eine App, zwei Ausprägungen?)**

| Option | Inhalt | Für | Gegen |
|---|---|---|---|
| A | Editor = AppShell „Werkzeug“; Referent = AppShell reduziert: Kopf mit ON AIR, **fest dunkel ohne ThemeToggle**, Statusleiste, ⚙; Publikum und NDI ohne Rahmen | spec-treu (5.3), gleiche Statusleiste in beiden Bedienfenstern | zwei additive Props in `@jm/ui` (Theme fest, `mac` durch AppShell) |
| B | Editor = AppShell; Referent behält den eigenen Bühnenkopf, bekommt nur TallyButtons und Tokens, keine Statusleiste | kleinster Umbau im Referenten, keine Baustein-Änderung | Referent ohne gemeinsamen Rahmen, Status nur im Editor sichtbar (der während der Show oft verdeckt ist) |
| C | Referent bekommt den vollen AppShell inkl. Hell/Dunkel | keine Baustein-Änderung | Hell im Referenten widerspricht „bühnendunkel“ (Anhang A), Gefahr R1 |

**Empfehlung A.** Die zwei Props sind additiv (Spec 4.1) und gehen in einen vorgezogenen Baustein-Task (X1).

**P2 · Welches Fenster ist der Live-Bereich, wohin die übrigen Kopfknöpfe?**

| Option | Inhalt | Für | Gegen |
|---|---|---|---|
| A | Referent = Live-Bereich: 4 TallyButtons Zurück · Weiter · Schwarz · Weiß unter der aktuellen Folie; „■ Beenden“ als Kopf-Aktion; Bildschirm, Publikum Vollbild, Vollbild, Schleife, Übersicht, NDI, Gast-Klick in eine Werkzeugleiste unter dem Kopf. Editor: eine TallyButton „Präsentieren/Beenden“ | Haupttasten wie in Anhang A, Kopf wird frei (heute 14 Elemente, bricht um, `b44316d9bf`) | Werkzeugleiste ist nach Spec 5.2 eigentlich „Werkzeug“-Sache (Präzedenz fehlt) |
| B | wie A, aber Schwarz/Weiß bleiben kleine Kopf-Knöpfe, Haupttasten nur Zurück/Weiter | weniger Fläche unter der Folie | weicht von Anhang A ab (UO1) |
| C | wie A, aber Nebenknöpfe (Vollbild, Schleife, Bildschirm) ins Panel | ruhigster Live-Bereich | Live-Knöpfe hinter einem Klick (Schleife und Publikum Vollbild sind Live-Bedienung) |

**Empfehlung A.**

**P3 · Ist der Editor ein „Werkzeug“-Layout, und was passiert mit dem Raster bei offenem Panel?**

| Option | Inhalt | Für | Gegen |
|---|---|---|---|
| A | Werkzeug-Layout nach Spec 5.2, Panel schiebt (Spec 3.1), `dichte='kompakt'`; Raster bleibt | kein Sonderweg, spec-treu | Bühne schrumpft bei offenem Panel stark (R4) |
| B | wie A, aber die rechte Spalte (Folie/Übergänge) klappt bei offenem Panel weg | Bühne bleibt brauchbar | neues Verhalten, eigener Test |
| C | Panel liegt im Editor immer über dem Inhalt | Raster unberührt | neue AppShell-Prop, verdeckt Inspector |

**Empfehlung A** (Einstellungen sind im Editor selten offen; der Owner sieht es in der Abnahme).

**P4 · Wo liegen die Einstellungen?**

| Option | Inhalt | Für | Gegen |
|---|---|---|---|
| A | Eine Panel-Komponente in Editor **und** Referent; im Referenten ohne die Import-Option; 📱-Modal entfällt (⚙ bzw. Statuseintrag öffnet „Handy-Fernsteuerung“/„Gast-Klicker“) | Handy und Gast-Klicker auch vor der Präsentation einrichtbar; überall gleich | zwei Renderer fragen denselben Zustand ab (R7); im Referenten ist das Panel fest dunkel (folgt aus P1-A) |
| B | Panel nur im Editor; Referent behält das 📱-Modal | kleiner Umbau im Referenten | Einstellungen an zwei Orten wie heute (Spec 0: „am selben Ort“ verfehlt) |
| C | Panel nur im Referenten | – | Timer-Sync/Import ohne Präsentation unerreichbar |

**Empfehlung A.**

---

## 2 · Studio-Control (`apps/studio-control`, 0.6.0, seit 28.06. unverändert)

### 2.1 Anhang A gegen heute

| # | Aussage in Anhang A (08.10.) | Befund | heute |
|---|---|---|---|
| 1 | Immer sichtbar: Abschnitt „Video“ mit Gerätepanels (`views/Video.tsx`: Tricaster, ATEM, OBS, PTZ); kein einzelnes primäres Element | ✅ | `views/Video.tsx:6-13` |
| 2 | Haupttasten: keine globalen | ✅ | – |
| 3 | ATEM Cut/Auto/FTB/Aufnahme/Stream (`AtemPanel.tsx:133-160`, `exec({type})`, Verben `atem_*`) | ✅ | `components/video/AtemPanel.tsx:132-161`; Busse Program/Preview `:117-130` |
| 4 | OBS Szene/Rec/Stream | ✅ | Szenen `components/video/ObsPanel.tsx:119-130`, Rec/Stream `:145-162` |
| 5 | PTZ-Presets | ✅ (unvollständig) | Presets und Speichern-Modus `components/video/PtzPanel.tsx:290-320`; dazu Joystick und Zoom/Fokus als **Halten**-Knöpfe (`:176-251`, `HoldButton` `:361-405`), Autofokus `:254-260`, Power `:269-278` |
| 6 | (nicht genannt) | ❌ | **TriCaster** hat eine eigene Hauptreihe Take/Auto/Fade Black/REC/STREAM (`components/video/TricasterPanel.tsx:26-32`, `:172-184`), dazu DSK (`DskPanel.tsx`), DDR (`DdrPanel.tsx`), Makros (`TricasterPanel.tsx:194`), Audit-Log (`:210-214`) |
| 7 | (nicht genannt) | ❌ | **Licht** Blackout (`components/lighting/LichtPanel.tsx:88-96`), **Audio** Mute/Fader je Kanal (`components/audio/AudioPanel.tsx:172-173`, `:230-237`) |
| 8 | Kürzel: keine | ✅ | kein `keydown` im Renderer |
| 9 | Tally: STATE `atem_pgm`, `atem_rec`, `atem_stream`, `obs_rec`, `obs_stream`, `lighting_blackout` | ✅ | `packages/suite-control-protocol/src/capabilities.ts:586-596`; dazu `ptz_power`, `obs_scene` |
| 10 | Kopf-Tally = „irgendein Gerät nimmt auf oder streamt“ (?) | offen | gemessen nur ATEM/OBS (`recording`, `streaming`, `shared/protocol.ts:105-134`); TriCaster meldet nur die Verbindung (`:47-55`) → Owner (S2) |
| 11 | Status: Master-Link¹ | ✅ (Lücke) | Main ja (`main/index.ts:31`), Preload nein (`preload/index.ts:6-16`) |
| 12 | Status: Studio-Server-Socket (`SyncPill`, Socket.IO :7778) | ✅ | `components/Topbar.tsx:88`, `:167-185`; Quelle `sync/client.ts:41-43` |
| 13 | Status: Geräte verbunden (atem/obs/tricaster/ptz/audio/lighting) | ✅ | Status-Ereignisse in `store/app.ts`; Licht ohne Rückmeldung (Art-Net) |
| 14 | Status: Companion-Gateway (Port 8735), im Renderer kein Status | ✅ (Lücke) | `main/gateway/control-gateway.ts:59`, `gatewayStatus()` vorhanden, aber **ungenutzt** (`:338-340`) ➕ |
| 15 | Status: Benutzer/Rolle (`useSession`) | ✅ | `components/Topbar.tsx:89-93` |
| 16 | Einstellungen: Fernsteuerung (Gateway-Status); tool-eigen Setup (Inventar, Discovery, Benutzer, `views/Setup.tsx`), Login/Logout | ✅ (unvollständig) | `views/Setup.tsx:12-46` (Reiter, „Benutzer“ nur Admin `:34-38`); dazu ➕ Geräte-Formulare **im jeden Gerätepanel** („Bearbeiten“, „Weitere Instanz“, „Entfernen“ mit `confirm`, z. B. `AtemPanel.tsx:79-99`, `:163-174`) |
| 17 | Heute: Topbar-Abschnitte Video/Audio/Licht/Setup (handgebaut) | ✅ | `components/Topbar.tsx:15-20`, `:73-84` |
| 18 | Audio und Licht als „Coming soon“ beschriftet, obwohl gerendert (`App.tsx:137-138`) | ✅ | `components/Topbar.tsx:17-18`; ➕ auch der Video-Hinweis ist veraltet: „TriCaster · PTZ · Kumo“ (`:16`), ATEM/OBS fehlen, Kumo gibt es nicht |
| 19 | Lokale `ui/StatusPill|Input|SectionHeader|Headline` (Duplikat Timer) | ✏️ | in Studio-Control unverändert (`components/ui/*`); der Timer hat seine Kopien in Welle 1 abgegeben (`apps/timer/src/renderer/src/components/` ohne `ui/`) |
| 20 | Theme-Knopf ungespeichert | ✅ | `components/Topbar.tsx:29-35`, `:94-104` („Light“/„Dark“, englisch) |
| 21 | Rohe Farben: nein | ✅ (fast) | **9 Fundstellen**: `PgmPreview.tsx` 3× rgba + `bg-black/40`, `AtemPanel.tsx:193` Hex-Rückfall `#2dd4bf` + `text-white`, je 1× `text-white` in Audio/OBS/PTZ |
| 22 | Login-Gate (`if (!user) return <LoginView/>`) | ✅ | `App.tsx:132`; im Electron-Fenster verbindet der Socket schon **vor** dem Login (`App.tsx:36-46`) ➕ |
| 23 | Renderer läuft auch im Browser | ✅ | `sync/client.ts:7-16`; Server bindet `0.0.0.0` (`main/server.ts:132`) |
| 24 | Größte Fläche an Gerätepanels (27 tsx) | ✅ | 27 `.tsx` im Renderer |
| 25 | „Max. 4 Haupttasten“ passt nicht auf einen Hub; Tallys pro Panel | ✅ | ATEM und TriCaster haben je **5** Haupttasten |
| ➕ 26 | – | ➕ | Lokale Komponente heißt **`AppShell`** (`components/AppShell.tsx:1-15`) und `StatusPill` (`components/ui/StatusPill.tsx`) – Namensgleich mit `@jm/ui` |
| ➕ 27 | – | ➕ | Lokale `StatusPill` färbt **„Verbunden“ als `live` = Markengelb** (`components/ui/StatusPill.tsx:8-14`; 13 Stellen, z. B. `AtemPanel.tsx:222`, `TricasterPanel.tsx:222`, `LichtPanel.tsx:82` „Output → host“ ohne Messung). Widerspricht Spec 4.2 (Gelb = ausgewählt) und 7.4 |
| ➕ 28 | – | ➕ | Befehlsfehler verschwinden in `console.warn` (`AtemPanel.tsx:37`, `ObsPanel.tsx:37`, `TricasterPanel.tsx:60`, `PtzPanel.tsx:65`) bzw. `.catch(() => {})` (`LichtPanel.tsx:47`, `:51`) |
| ➕ 29 | – | ➕ | `PgmPreview` ist ein Platzhalter „Live-Vorschau folgt in Phase 2“ (`components/video/PgmPreview.tsx:9-56`) |
| ➕ 30 | – | ➕ | Sitzung in `localStorage` schreibt **ohne** `try/catch` (`store/session.ts:22-29`); Spec 3.8 verlangt `try/catch` |
| ➕ 31 | – | ➕ | LAN-URLs für Browser-Clients nur im Tray (`main/index.ts:124-162`); `jms.remote.getUrls` im Preload, im Renderer ungenutzt |
| ➕ 32 | – | ➕ | Englische Reste: „Idle“, „Connected · v…“, „Polling …“, „Scanning“, „Offline“, „Logout“, „Light/Dark“, „Coming soon“ |

### 2.2 Fenster und Rahmen

- **Ein Hauptfenster** (`main/index.ts:61-80`, 1400 breit, min. 1024, `hiddenInset` auf dem Mac, `sandbox: true`),
  Inhalt aus der Datei (`:55-57`), Socket zu `127.0.0.1:7778`. Dazu Tray (Fenster zeigen, LAN-URLs, Server, Beenden).
- **Derselbe Renderer im Browser** (vom eigenen Server, Port 7778, `window.jms` fehlt). Rahmen nur ohne `window.jm*`
  (Spec 3.8): `@jm/ui` erfüllt das (`isElectronMac` false, `localStorage` in `try/catch` im Theme).
- **Login-Gate:** vor der Anmeldung `LoginView` (eigene zentrierte Karte mit Logo, `views/Login.tsx:36-75`).
- **Navigation:** Video · Audio · Licht · Setup (`store/app.ts` `section`, nicht gemerkt), Setup mit eigenen Reitern.

### 2.3 Haupttasten je Gerätepanel (Spec 3.4: „Tallys je Gerätepanel, keine globale Leiste“)

| Panel | Taste | Handler | Verb | Sperre heute | Rückmeldung |
|---|---|---|---|---|---|
| ATEM | Cut / Auto / FTB | `exec({type})` (`AtemPanel.tsx:132-142`) | `atem_cut/auto/ftb` | `!canExec || !live`, ohne Grund | FTB-Zustand **nicht** gemeldet |
| ATEM | REC / STREAM | `exec({type, on})` (`:143-160`) | `atem_record/stream` | dito | `recording`/`streaming` **gemessen** |
| TriCaster | Take / Auto / Fade Black / REC / STREAM | `exec(shortcut)` (`TricasterPanel.tsx:172-184`) | `tricaster_shortcut` | `!canExec || state !== 'connected'` | REC/STREAM **ohne** Rückmeldung (Umschalt-Shortcut) |
| OBS | Aufnahme / Stream | `exec({type})` (`ObsPanel.tsx:145-162`) | `obs_record/stream` | dito | **gemessen** |
| OBS | Szenen | `exec({type:'scene'})` (`:119-130`) | `obs_scene` | dito | aktuelle Szene gemessen (Auswahl, keine Tally) |
| PTZ | Presets, Joystick/Zoom/Fokus (Halten), Power | `PtzPanel.tsx:176-320` | `ptz_preset`, `ptz_power` | dito | Power gemessen |
| Licht | Blackout | `toggleBlackout` (`LichtPanel.tsx:51`, `:88-96`) | `lighting_blackout` | Knopf fehlt ohne Recht/Node | Zustand des Servers (Art-Net ohne Rückmeldung) |
| Audio | Mute / Fader je Kanal | `AudioPanel.tsx:172-173` | `audio_mute`, `audio_fader` | dito | – |

Sperrgründe für TallyButton (Pflicht): „Rolle {Betrachter} darf nicht schalten“ (`shared/roles.ts`, `canDo(role, '*:exec')`)
und „{Gerät} nicht verbunden“. Beides neue Texte zur Freigabe.

### 2.4 Tally / On-Air

- **Echte Sendezustände (gemessen):** ATEM `recording`/`streaming`, OBS `recording`/`streaming` (Geräte-Rückmeldung über
  die Treiber, `shared/protocol.ts:105-134`), ATEM-Program-Bus (Eingang auf Sendung), PTZ Power (kein Sendezustand).
- **Nicht gemessen:** TriCaster REC/STREAM, FTB, Licht-Blackout (Serverzustand, kein Gerät meldet zurück).
- Es wird immer **nur eine Instanz je Gerätetyp** gezeigt (Auswahl oben im Panel, z. B. `AtemPanel.tsx:67-75`); die
  Tallys der anderen Instanzen sind unsichtbar.

### 2.5 Statuseinträge

| Eintrag | Gruppe | Quelle | gemessen? |
|---|---|---|---|
| Master-Link | verbindung | fehlt im Preload; im Browser gar nicht verfügbar | Brücke fehlt |
| Studio-Server | verbindung | `useSession.connected` (Socket-Ereignisse `sync/client.ts:41-43`) | **gemessen** |
| ATEM, OBS, TriCaster, PTZ, Audio | verbindung | Status-Ereignisse je Instanz (`store/app.ts`) | **gemessen** (`connected/connecting|polling/down`, `lastError`) |
| Licht | ausgabe | `LIGHTING_STATE {config, blackout}` | **nur Einstellung** (Node konfiguriert, Art-Net ohne Rückmeldung) → „an (ohne Rückmeldung)“ |
| Companion-Gateway | fernsteuerung | `gatewayStatus()` ungenutzt | **Lücke**; im Browser über IPC nicht erreichbar |
| Benutzer / Rolle | tool | `useSession.user` | gemessen (Sitzung) |

### 2.6 Einstellungen

- `RemoteControlSection` (Variante `tool`): Gateway, Port 8735 fest. Sonst passt **kein** `@jm/settings`-Abschnitt
  (keine NDI-Ausgabe, kein Bildschirm, kein Audiogerät; Geräte-Inventar ist keine „Gegenstelle“ im Sinn von
  `PeersSection`).
- Tool-eigen: Setup (Inventar 220 Z. Tabelle `components/setup/DeviceTable.tsx`, Discovery `DiscoverPanel.tsx`, Benutzer
  `UserManager.tsx`), Geräte-Formulare je Panel, Login/Logout. Die Breite von Tabelle und Benutzerverwaltung passt nicht
  in 360 px (Spec 3.1).

### 2.7 Kürzel

Keine im Renderer. Nur Standardmenü (0.3), im Browser die Browser-Kürzel.

### 2.8 Rohe Farben

9 Fundstellen (2.1 Nr. 21). Der eigentliche Farbumbau ist die **Bedeutung**: 13× `StatusPill status="live"` (Gelb) für
„verbunden“ wird `ok`, „Idle“ ohne Status wird „unbekannt“ (Spec 7.2), Licht „Output → host“ wird „an (ohne
Rückmeldung)“ (Spec 7.3).

### 2.9 Master-Link und Fernsteuerung

Beide fehlen im Renderer. Besonderheit: Der Renderer läuft auch im Browser; eine IPC-Brücke erreicht nur das
Electron-Fenster. Für den Browser gäbe es nur einen neuen lesenden Weg über den eigenen Server (Socket-Ereignis oder
HTTP), also einen Protokoll-Zusatz (U6) → Owner (S5).

### 2.10 Risiken

- **R1 Kein Testgerüst:** kein `test/`, kein „selftest“, nicht im CI (0.7). Welle 1 prüft Ableitungen, Statusleiste und
  Funktionsliste per `tsx`-Selbsttest; das muss für Studio-Control erst angelegt und ins CI gehängt werden.
- **R2 Start ungeprüft:** Der OBS-Interop-Fix (#91) steht auf `main` (`main/drivers/obs/client.ts:1-12`), trägt aber im
  Commit „[REVIEW-ONLY · ungetestet]“ (`742b491e82`); seit 28.06. kein Commit. Eine Sichtprüfung braucht einen lokalen
  Start mit nativem Rebuild (`better-sqlite3`, `@julusian/freetype2`, `package.json` „postinstall“). Nicht gemessen.
- **R3 Namensgleichheit:** lokales `AppShell` und `StatusPill` gegen `@jm/ui` (`components/AppShell.tsx`,
  `components/ui/StatusPill.tsx`). Beim Umbau löschen statt parallel halten, sonst Verwechslung in Importen.
- **R4 Breite:** Panels mit `max-w-[1400px] px-7` (`components/AppShell.tsx:8-9`); mit 360 px Panel bei 1024 px Fenster
  bleiben ~660 px; TriCaster-Raster `xl:grid-cols-[1fr_420px]` (`TricasterPanel.tsx:171`) und PTZ `lg:grid-cols-[auto_1fr]`
  (`PtzPanel.tsx:175`) springen dann um (abgeleitet).
- **R5 Halten im PTZ:** eigener `HoldButton` mit `pointerup/cancel/lostpointercapture`, aber ohne `blur` und ohne Tastatur
  (`PtzPanel.tsx:376-405`). Bleibt er lokal, bleibt er so; ein Wechsel auf `halten.ts` braucht den Export (0.5).
- **R6 Stille Fehler:** Befehlsfehler nur in der Konsole (2.1 Nr. 28). Spec 7 verbietet keine fehlende Anzeige, aber ein
  TallyButton, der „bereit“ bleibt, wenn der Befehl scheitert, ist die Lehre „Diagnose, die niemand anzeigt“. Anzeige
  wäre neue Funktion → nur benennen.
- **R7 Rolle Betrachter:** Fast alle Tasten sind für `viewer` gesperrt (`shared/roles.ts:31-50`); mit TallyButton ist das
  ein sichtbarer Grund an jeder Taste (bisher nur gedimmt).

### 2.11 Owner-Entscheidungen Studio-Control

**S1 · Tallys je Gerätepanel statt globaler Haupttasten-Leiste**

| Option | Inhalt | Für | Gegen |
|---|---|---|---|
| A | Je Panel wird die vorhandene Hauptreihe TallyButtons, ohne Obergrenze 4: ATEM 5, TriCaster 5, OBS 2, Licht 1. Busse, Szenen, Presets, Joystick, DSK/DDR/Makros bleiben normale Knöpfe | entspricht Spec 3.4/5.3 („Ausnahme Studio-Control“), nichts verschwindet | 5 große Tasten nebeneinander brauchen Breite (R4) |
| B | Je Panel höchstens 4 (FTB bzw. Fade Black wird normaler Knopf in Reihe 2) | gleiche Regel wie überall | FTB ist eine Live-Aktion, die man schnell finden muss |
| C | Nur Zustandstasten (REC, STREAM, Blackout) werden TallyButtons; Cut/Auto/FTB/Take bleiben `Button` | wenig Umbau | Cut/Auto, die wichtigsten Live-Tasten, bleiben ohne gemeinsamen Look und ohne Sperrgrund |

**Empfehlung A.** TriCaster-REC/STREAM bleiben `bereit` mit Hinweis „ohne Rückmeldung“ (0.4).

**S2 · Was heißt ON AIR im Kopf eines Hubs?**

| Option | Inhalt | Für | Gegen |
|---|---|---|---|
| A | ON AIR nur, wenn ein Gerät **gemessen** streamt oder aufnimmt (ATEM/OBS, alle Instanzen, nicht nur die angezeigte), Beschriftung „LIVE“ bzw. „REC“ wie Switcher (E8); sonst **keine** Kopfanzeige (kein „bereit“) | nie gelogen: TriCaster/Licht melden nichts (0.6) | neue Kopf-Logik „nur bei wahr“ (`onAir` weglassen statt `live:false`) |
| B | wie Switcher: immer anzeigen, „bereit“, wenn ATEM/OBS nichts senden | einheitlich mit Welle 1 | „bereit“, während ein TriCaster streamt |
| C | gar keine Kopfanzeige | einfachste Lösung | eine REC/STREAM-Instanz außerhalb der Ansicht bleibt unsichtbar (2.4) |

**Empfehlung A.**

**S3 · Rahmen ohne Sitzung, und wohin Benutzer/Abmelden und die Navigation?**

| Option | Inhalt | Für | Gegen |
|---|---|---|---|
| A | Login im AppShell (Kopf mit Logo und Hell/Dunkel, leere Statusleiste, kein ⚙, Spec 3.8). Nach Login: Reiter Video · Audio · Licht · Setup als `Tabs` in der Werkzeugleiste, rechts darin „Benutzer · Rolle“ und „Abmelden“ | Spec 3.8 + 5.2 („Topbar-Navigation → Tabs“), Kopf bleibt frei für ON AIR | Werkzeugleiste in einem Live-Hub (wie P2-A) |
| B | Login bleibt eigene Seite ohne Rahmen; nach Login wie A | kleinster Umbau | widerspricht 3.8 |
| C | wie A, aber Benutzer/Abmelden als Panel-Abschnitt „Sitzung“ | Werkzeugleiste nur Reiter | Abmelden hinter einem Klick |

**Empfehlung A.** Die veralteten Hinweise „Coming soon“ und „Kumo“ werden Texte zur Freigabe (R9), kein Entscheid.

**S4 · Setup und Geräte-Formulare: Panel oder Reiter?**

| Option | Inhalt | Für | Gegen |
|---|---|---|---|
| A | Setup bleibt Reiter (Inventar/Discovery/Benutzer), „Bearbeiten“-Formulare bleiben im Gerätepanel; das Panel enthält nur „Fernsteuerung“ | passt in die Breite, kein Funktionsumzug | weicht von Anhang A ab („Setup → Einstellungen“) |
| B | Setup komplett ins Panel | Spec-Muster „Einrichtung weggeräumt“ | Tabelle und Benutzerverwaltung passen nicht in 360 px |
| C | Setup bleibt Reiter, die Geräte-Formulare ziehen aus den Panels in den Setup-Reiter | Live-Panels werden ruhiger | Funktionsumzug (eigener Punkt), „Bearbeiten“ während der Show weiter weg |

**Empfehlung A.**

**S5 · Status-Brücken, wenn der Renderer im Browser läuft**

| Option | Inhalt | Für | Gegen |
|---|---|---|---|
| A | Master-Link und Gateway über IPC (Welle-1-Muster); im Browser fehlen beide Einträge (ausgeblendet, Spec 6.1) | kein Protokoll-Zusatz (U6) | Browser-Bediener sehen Companion nicht |
| B | Gateway zusätzlich als neue **lesende** Socket-Meldung des Servers an alle Clients | auch im Browser sichtbar | Protokoll-Zusatz am Studio-Server, Rechte (Rolle) mitdenken |
| C | keine Gateway-Anzeige | nichts zu bauen | Lücke bleibt („unbekannt“) |

**Empfehlung A.**

---

## 3 · Connect (`apps/connect`, 0.5.0)

### 3.1 Anhang A gegen heute

| # | Aussage in Anhang A (08.10.) | Befund | heute |
|---|---|---|---|
| 1 | Immer sichtbar: Gästeliste mit Phase + Aktionen (`App.tsx:313-363`, `GuestActions` …) + Talkback-Taste | ✏️ | Gästeliste `App.tsx:452-540`, `GuestActions` `:940-968`, Talkback alle `:454-461`; sichtbar nur nach `raumAnsicht` (Regel V, `shared/raum-ansicht.ts`, `App.tsx:325`) ➕. **Zweiter Live-Bereich ➕:** Zoom-Karte mit Slots (`App.tsx:544`, `zoom/ZoomCard.tsx`) |
| 2 | Haupttasten: Raum öffnen / schließen (`openRoom`/`closeRoom`) | ✅ | `App.tsx:152-215`, `:242-266`; Knöpfe `:384-397`, `:419-421`; „Raum öffnen“ gesperrt bei `!status.configured` **ohne Grund** (`:387`); kein Verb (nur Tray „Raum schließen“, E58) |
| 3 | Talkback alle (`PttButton`, Halten, `talkbackDown(null)`/`talkbackUp`, Verb `talkback`) | ✅ | `App.tsx:83-95`, `PttButton` `:741-776` (nur Zeiger: `pointerdown/up/cancel`, kein `blur`, keine Tastatur) |
| 4 | GO und „Nächster Gast“ nur per Companion/Rundown (`App.tsx:216`), kein Knopf | ✏️ | `App.tsx:295-305`; weiter ohne Knopf |
| 5 | Tally: STATE `onair` (Anzahl), `lobby`, `talkback` | ✅ | `App.tsx:108-121`; ➕ `zoom_live`, `zoom_alarm`, `zoom_slot{n}_live`, `ndi_alarm` (`capabilities.ts:686-700`) |
| 6 | Status: Master-Link¹ | ✅ (Lücke) | Main ja, Preload nein |
| 7 | Status: Raum/SFU (`connected`) | ✅ | `App.tsx:33`, `:173`, `:180`; ➕ Raumabbruch nach Ablauf (E57) `:183-189` |
| 8 | Status: Proxy konfiguriert (`status.configured`, `proxyKeySource`) | ✏️ | Zeile „Cloud-Zugang“ aus dem Launcher-Halter `status.cloudZugang {text, ton}` (`shared/types.ts:59`), Karte `App.tsx:564-651` (Anmeldung Teil 2) |
| 9 | Status: Programm-Rückkanal (`ProgramBadge`, `status.programState/programSource`) | ✏️ | `status.ndiProgramm` mit 9 Zuständen (`App.tsx:789-816`), Kopfzeile mit Neustart/Logordner `:888-911` |
| 10 | Status: NDI je Gast (`ndiUp/ndiDown`, Pool) | ✏️ | gemessene Lage je Quelle `status.ndiGaeste[]` (`startet/sendet/ohneBild/neustart/gescheitert`), Abzeichen `App.tsx:476-487`, Grundzeile mit „NDI neu starten“ `:519-533` |
| 11 | Status: Companion (`status.controlPort`, 8737) | ✏️ | `controlPort` ist eine **Konstante**, kein Messwert (0.2) → braucht Companion² |
| 12 | Status: Presenter gekoppelt (`status.presenterLinked`) | ✅ | `App.tsx:895-897` (mDNS) |
| 13 | Status: Zoom (`status.zoom` → `zoomZeile`) | ✅ | `App.tsx:365`; ➕ Slot-Zählung `ZoomKurz.slotsLaufen/…` (`shared/types.ts:135-160`) |
| 14 | Einstellungen: Fernsteuerung (Status) · iveo (Status: Sprecher aus der Show, `ShowCard`) | ✅ | `ShowCard` `App.tsx:653-695` („n Sprecher einladen“ ist Bedienung, kein Status) |
| 15 | NDI-Namen automatisch je Gast, kein Abschnitt (?) | ✅ | Name kommt vom Raum (`App.tsx:145`); ➕ Zoom-Slots haben eigene NDI-Namen je Slot und „Person im NDI-Namen“ (`zoom/SlotBereich.tsx:205-217`, #287) |
| 16 | Tool-eigen: Proxy-URL/Key (`ProxyCard`) | ✏️ | nur noch Adresse + „Key entfernen“ für einen alten Key; keine Key-Eingabe mehr (`App.tsx:611-632`, `11b510ab5a`) |
| 17 | Tool-eigen: Zoom-Einrichtung (SDK-Ordner, SDK-Schlüssel, Zugang; `ZoomCard.tsx` 808 Z.) | ✏️ | Einrichtung `zoom/ZoomCard.tsx:405-507`: SDK wählen, **SDK laden** (Freigabe `zoom-sdk`), Schlüssel und Zugang nur noch „Entfernen“ im Übergang, Anmeldezeile, „Einrichtung prüfen“. ZoomCard **655 Z.** + `SlotBereich` 310 + `SlotKachel` 174 + `SlotEinstellungen` 259 + `Messwerte` 78 + `slot-vorschau` 92 = **1568 Z.** Zoom-Oberfläche |
| 18 | Heute: einspaltig `max-w-3xl`, Karten inline, Header als h1 mit Textzeilen rechts | ✅ | `App.tsx:356-367` |
| 19 | Rohe Farben: ja (159 Treffer), `index.css` ohne `base.css`, `color-scheme: dark`, `#121212`; kein `@jm/ui` | ✏️ | **260 Fundstellen** (239 Palette, 12 white/black, 9 Hex): App 129, ZoomCard 60, SlotKachel 24, SlotEinstellungen 20, SlotBereich 19, Messwerte 4. `index.css:1-12` unverändert; kein `@jm/ui`, auch keine Manrope-Schrift (`package.json` ohne `@fontsource-variable/manrope`, `index.css:9` `system-ui`) |
| 20 | Kürzel: keine (Enter in ProxyCard/ZoomCard-Feldern) | ✏️ | Enter: Cloud-Adresse (`App.tsx:617-619`), Beitritt (Formular `ZoomCard.tsx:511-517`), Bild-Versatz (`:604-606`), Haltezeit (`SlotBereich.tsx`); ➕ Rechtsklick-Menü in Feldern (#301, `main/index.ts:85-93`) |
| 21 | Zoom 4b ändert gerade `ZoomCard.tsx` + `main/zoom/*`; ZoomCard nur umhängen | ❌ (überholt) | 4b ist gemergt und released (0.4.0 bis 0.5.0); keine parallele Arbeit. Geplant: #317 Stufe B, Zoom-Slots Stufe 2 (`docs/roadmap.md:844-845`, ohne Issue) |
| 22 | Unsichtbares Peer-Fenster (`peer.html`, `main/peer-window.ts`) ohne AppShell | ✅ | `main/peer-window.ts:18-21` (`show:false`), `renderer/peer.html` ohne Oberfläche |
| 23 | Eigene CSP-Meta in `renderer/index.html:8` | ✅ | `renderer/index.html:6-9`; ➕ zusätzlich Laufzeit-CSP `connectSrc ['https:','wss:']` (`main/index.ts:38`); Meta ohne `font-src` → `default-src 'self'` deckt eine gebündelte Schrift (abgeleitet), `img-src 'self' data:` deckt QR und Zoom-Vorschau (`zoom/SlotKachel.tsx:50`) |
| 24 | TallyButton muss Press-and-Hold können | ✅ (erfüllt) | `packages/ui/src/lib/halten.ts`, `TallyButton.tsx:73-126` |
| 25 | Größter Umbau von allen | ✅ | siehe 5 |
| ➕ 26 | – | ➕ | Je Gast: Talkback 🎙 (Halten, `App.tsx:488-498`), Folien 📊 (Verb `slides`, `:499-514`) |
| ➕ 27 | – | ➕ | Pflicht-Fußzeile: NDI-Markenhinweis T134, „Logordner öffnen“, „Lizenzbedingungen“ (`App.tsx:917-927`, E35/E55/LP3) |
| ➕ 28 | – | ➕ | Hinweise T141/T144/T146 und Fehlerfeld (`App.tsx:369`, `:376-381`, `:435-437`); CZ8 nennt Raum-ID und Admin-Weg (`main/zugang/regeln.ts:203-205`) |
| ➕ 29 | – | ➕ | Ton-Limiter −6 dBFS je Zoom-Slot (0.4.6) sitzt in der nativen Brücke (`packages/zoom-bridge/native/audio_limiter.h`), **ohne** Oberfläche; Pegelzeile nur im Log |
| ➕ 30 | – | ➕ | Schließen versteckt ins Tray (`main/index.ts:58-63`); Tray zeigt Gäste- und Zoom-Zeile (`main/tray.ts`) |
| ➕ 31 | – | ➕ | Der **Standby-Gast** wird nirgends angezeigt: „Standby“ setzt `standbyId` (`App.tsx:962`), die Oberfläche liest es nicht (nur STATE `:117-118`) |
| ➕ 32 | – | ➕ | Talkback-Mikro = Standardmikrofon des Systems, keine Gerätewahl (`peer.tsx:780-782`); Fehler nur im Peer-Log (`:789`) |

### 3.2 Fenster und Rahmen

| Fenster | heute | Rahmen |
|---|---|---|
| Hauptfenster | `createMainWindow` aus `@jm/electron-kit` (1280×860, min. 980×640, `hiddenInset` auf dem Mac, `packages/electron-kit/src/index.ts:52-60`); Schließen = ins Tray | AppShell Live-Tool |
| Peer (unsichtbar) | WebRTC, Talkback-Mikro, NDI-Bilder (`main/peer-window.ts`, `renderer/src/peer.tsx` 838 Z.) | kein Rahmen |
| Tray | Statuszeilen, Raum schließen, Meeting verlassen | außerhalb des Umfangs |

### 3.3 Immer sichtbar und Haupttasten

- **Immer sichtbar:** (a) Cloud-Raum: Raum-Taste, Talkback alle, Gästeliste mit Phase, NDI-Abzeichen und Aktionen;
  (b) Zoom (nur Windows): Meldung, Beitritt/Verlassen, Slots mit Start/Stopp. Unter macOS steht statt (b) die Zeile T95
  (`App.tsx:544`, `MAC_ZEILE`).

| Taste | Handler | Verb | Kürzel | Sperre heute |
|---|---|---|---|---|
| Raum öffnen / Raum schließen | `openRoom` / `closeRoom` (`App.tsx:152`, `:242`) | – (Tray: schließen) | – | öffnen: `!status.configured`, ohne Grund |
| Talkback alle (**Halten**) | `talkbackDown(null)` beim Drücken, `talkbackUp` beim Loslassen/Abbrechen (`App.tsx:454-461`) | `talkback` (on/off/toggle, `:278-284`) | – | `!ansicht.wsKnoepfeBedienbar`, ohne Grund; Handler prüfen zusätzlich `verbundenRef` (`:85`, `:92`) |
| je Gast: Talkback 🎙 (Halten) | `talkbackDown(g.id)` | `talkback` nur „alle“ | – | dito |
| je Gast: Freigeben/Ablehnen/Auf Sendung/Standby/Aus Sendung/Entfernen/📊 | `send({t:…})` (`App.tsx:940-968`, `:499-514`) | `approve`/–/`onair`/`standby`/`off`/`kick`/`slides` | – | dito |
| Zoom: Beitreten / Meeting verlassen / Erneut beitreten | `ZoomCard.tsx:510-569`, `:572-587`, `:363-371` | keins (Spec: kein Beitritt per Fernsteuerung) | Enter im Formular | Einrichtung, laufende Aufrufe |
| Zoom: Slot Start/Stopp | `zoomSlotStart` (`zoom/SlotKachel.tsx:119-127`) | `zoom_slot` (toggleKey `zoom_slot{n}_on`) | – | laufender Aufruf |
| GO / Nächster Gast | nur Steuerprotokoll (`App.tsx:295-305`) | `go`, `next` | – | – |

Talkback als TallyButton: während des Haltens nach Präzedenz `bereit` mit „Regie spricht — alle Gäste“ (0.4), nicht `live`.

### 3.4 Tally / On-Air

- **Echter Sendezustand:** Gast in Phase `onair` (vom Raum-DO autoritativ, `onAirGuests`, `App.tsx:109`, `:446`).
- **Kein Sendezustand im Sinn von 7.4:** `lobby` (Warteraum), `talkback`, Zoom-Slot „live“ (= NDI-Bild läuft; ob es im
  Programm ist, weiß Connect nicht, `ZoomCard.tsx:48` „kein Tally“). Zoom-Slots als Statuseintrag `ok`, nicht `live`.

### 3.5 Statuseinträge

| Eintrag | Gruppe | Quelle | gemessen? |
|---|---|---|---|
| Master-Link | verbindung | fehlt im Preload | Brücke fehlt |
| Cloud-Zugang | verbindung | `status.cloudZugang` (Launcher-Halter) | gemessen (Antwort des Launchers/Workers) |
| Raum | verbindung | `connected` + `raumAnsicht` (Client besteht, Raumabbruch) | **gemessen** (WebSocket) |
| Zoom | verbindung | `status.zoom` (`zoomZeile`, Zustände Z0–Z11) | **gemessen** (Bridge) |
| Programm (NDI-Rückkanal) | verbindung | `status.ndiProgramm.zustand` | **gemessen** |
| Presenter | verbindung | `status.presenterLinked` | mDNS-Fund (gemessen), keine Verbindung |
| NDI Gäste | ausgabe | `status.ndiGaeste[]` | **gemessen** |
| Zoom-Slots | ausgabe | `ZoomKurz.slotsLaufen/slotsErsatz/slotsOffen/slotsAn` | **gemessen** |
| Companion | fernsteuerung | `controlPort` Konstante | **Lücke** |
| Warteraum / auf Sendung | tool | `lobbyCount`, `onAirGuests` | gemessen (Raum-DO) |

### 3.6 Einstellungen

| Abschnitt | Passt? | Bemerkung |
|---|---|---|
| `RemoteControlSection` (`tool`) | ja | Port 8737 fest, braucht die Meldung (0.2) |
| `IveoSection` | teilweise | Connect kennt nur die Show aus dem Deep-Link (Name, Event, Sprecher, Raum); `delivery` ist ungemessen → Status „unbekannt“ (`packages/settings/src/abschnitte/iveo.ts:9-15`); „Sprecher einladen“ bleibt Bedienung im Live-Bereich |
| `NdiOutputSection` | nein | viele Quellen (je Gast, je Slot) statt einer Ausgabe |
| `AudioDeviceSection` | nein | keine Gerätewahl (3.1 Nr. 32); eine Wahl wäre neue Funktion |
| `PeersSection` | nein | Presenter nur per mDNS, ohne Host/Port |
| tool-eigen „Cloud-Zugang“ | – | Adresse, „Key entfernen“ (`App.tsx:564-651`) |
| tool-eigen „Zoom-Einrichtung“ | – | `ZoomCard.tsx:405-507` (heute aufgeklappt, solange Mängel bestehen, `:183`, `:406-411`) |
| tool-eigen „Zoom-Vorgaben“ | – | Slot-Vorgaben (Auflösung, Ton), Sprecher-Einstellungen (Haltezeit), Person im NDI-Namen, Vorschau (`zoom/SlotBereich.tsx:171-240`) |

### 3.7 Kürzel

Keine eigenen Tastenkürzel. Enter in Feldern (3.1 Nr. 20), Standardmenü (0.3). Der TallyButton bringt Halten per
Leertaste/Enter auf dem fokussierten Talkback-Knopf mit (`TallyButton.tsx:109-123`); heute geht Talkback nur mit dem Zeiger.

### 3.8 Rohe Farben

260 Fundstellen, alles nur dunkel. Gewollt: Vorschauflächen der Slots (`bg-black`, `bg-white`, `#232323` gekoppelt an
`kachel_logik.h`, Schachbrett; `zoom/SlotKachel.tsx:48-58`) und QR (`lib/qr.ts`). Alles andere wird Token, erstmals
mit Hell-Modus (Spec 8).

### 3.9 Master-Link und Fernsteuerung

Beide fehlen. Die Fernsteuerung braucht `onStatus` am vorhandenen `SuiteControlServer` (`main/control-server.ts:34-49`)
und eine Meldung in `AppStatus` oder eigenem Kanal.

### 3.10 Risiken

- **R1 Quelltext-Wächter:** `test/ndi-text.test.ts:738-860` (u. a. „C12 PK56: App.tsx enthält keines der Literale …“,
  Importform `@shared/ndi-text`), `test/zoom-teile.test.ts:424-600` (liest `ZoomCard.tsx`, `SlotBereich.tsx`,
  `SlotKachel.tsx`, `SlotEinstellungen.tsx`), `test/raum-zugang.test.ts:168-170`, `test/zoom-text.test.ts`. Jeder
  Datei-Umzug muss diese Wächter mitziehen (Präzedenz R2: gleiche Zahl, gleiche Strenge, Gegenprobe).
- **R2 Kein `@jm/ui`, keine Tokens, keine Schrift:** neue Abhängigkeiten (`@jm/ui`, `@jm/settings`, Manrope) heißen
  `npm install` im richtigen Ordner und eine geänderte `package-lock.json` (Memory „npm install im falschen Ordner“).
- **R3 Zwei Live-Bereiche:** Fenster min. 980 px, heute `max-w-3xl` (768 px). Mit offenem Panel bleiben bei 1280 px
  ~920 px; Slot-Kacheln haben feste 192×108-Vorschau (`zoom/SlotKachel.tsx:131`) und eine Container-Query (2 Spalten
  breit, 1 schmal, `SlotBereich.tsx:300-301`).
- **R4 Halten in der Gastzeile:** TallyButton zu groß (0.5); der lokale `PttButton` hat kein `blur`-Abbrechen (ein
  Fokuswechsel während des Haltens lässt das Mikro offen, abgeleitet). Ein kleiner Halte-Knopf auf `halten.ts` braucht
  den Export.
- **R5 Pflicht-Fußzeile:** T134/Lizenz muss sichtbar bleiben (`App.tsx:917-927`); die Statusleiste sitzt genau dort.
- **R6 Einrichtung ins Panel:** Solange ein Mangel besteht, ist die Einrichtung heute **offen** im Arbeitsbereich
  (`ZoomCard.tsx:183`). Im Panel braucht der Mangel einen Statuseintrag, der das Panel an der Stelle öffnet; sonst sieht
  man ihn nicht.
- **R7 Renderer importiert aus dem Main:** `App.tsx:9` (`../../main/zugang/regeln`); beim Aufteilen in neue Dateien
  beibehalten oder nach `shared/` ziehen (Wächter `raum-zugang.test.ts` beachten).
- **R8 Spätere Vorhaben:** #317 Stufe B (Spotlight erkennen, Privat-Chat mit persönlichem Link,
  `docs/superpowers/specs/2026-11-18-presenter-gast-klicker-design.md:223-226`) braucht je Zoom-Teilnehmer eine
  Kennzeichnung und einen Schalter; Zoom-Slots Stufe 2 (Galerie, fps 25/50/60, Dolmetscherton, QoS, Logo,
  `docs/superpowers/specs/2026-10-17-connect-zoom-slots-design.md:82`, `:1867-1871`) erweitert die Slot-Einstellungen
  und die Messwerte je Slot.
- **R9 Live-Kritisch:** Connect läuft in Shows mit Gästen; ein Fehler im Rahmen (Panel, Escape, Halten) trifft direkt die
  Sendung. Abnahme braucht Raum + Zoom + Launcher-Freigaben (Anmeldung Teil 2), also zwei Rechner.

### 3.11 Owner-Entscheidungen Connect

**C1 · GO und „Nächster Gast“ als Knöpfe?** (UO7 vom 08.10.: „nein, bleibt wie heute“)

| Option | Inhalt | Für | Gegen |
|---|---|---|---|
| A | bleibt ohne Knopf (UO7) | keine neue Funktion; „Auf Sendung“ je Gast deckt die Bedienung | Standby ist in Connect unsichtbar (3.1 Nr. 31) |
| B | GO und „Nächster“ als TallyButtons im Gästebereich | Regie ohne Companion | neue Funktion, Gefahr Doppelbedienung mit Rundown |
| C | kein Knopf, aber der Standby-Gast wird in der Liste markiert (vorhandener Zustand `standbyId`) | „Standby“-Klick hat endlich eine sichtbare Wirkung | kleine neue Anzeige, eigener Text |

**Empfehlung A**, C als eigener kleiner Wunsch nach 2b.

**C2 · Wo leben Gästeliste und Zoom-Slots?**

| Option | Inhalt | Für | Gegen |
|---|---|---|---|
| A | Zwei Spalten, sobald der Inhalt breit genug ist (links Cloud-Raum: Raum, Talkback, Einladen, Gäste; rechts Zoom: Meeting, Slots, Teilnehmer), darunter einspaltig; unter macOS nur links | beide Live-Bereiche ohne Klick sichtbar (Spec 5.1) | Breite (R3), Container-Queries in beiden Spalten |
| B | Reiter „Gäste | Zoom“ | einfache Fläche | ein Live-Bereich ist immer verdeckt |
| C | untereinander wie heute, beide als `Collapsible` mit `persistId` | kleinster Umbau | Zoom rutscht bei vielen Gästen unter den Rand |

**Empfehlung A.**

**C3 · Wie viel der Zoom-Karte geht ins Panel?**

| Option | Inhalt | Für | Gegen |
|---|---|---|---|
| A | nur „Zoom-Einrichtung“ (SDK, Laden, Schlüssel/Zugang, Prüfen) ins Panel | geringster Umzug, wenig Wächter | Vorgaben und Sprecher-Einstellungen bleiben im Live-Bereich |
| B | Einrichtung + „Zoom-Vorgaben“ (Slot-Vorgaben, Sprecher-Einstellungen, Person im NDI-Namen) + Cloud-Zugang ins Panel; im Arbeitsbereich bleiben Meldung, Beitritt/Verlassen, Bild-Versatz, Vorschau-Schalter, Slots (Kacheln mit Start/Stopp und Slot-Einstellungen), Teilnehmer, Messwerte, Hinweise, Logordner | „Live sichtbar, Einrichtung weggeräumt“; Bild-Versatz und Vorschau bleiben live | mittlerer Umzug, Wächter in `zoom-teile.test.ts` neu schreiben |
| C | alles außer Kacheln und Teilnehmern ins Panel | ruhigster Live-Bereich | Versatz und Meldungen hinter einem Klick, Meldung braucht Quittung im Blick |

**Empfehlung B.**

**C4 · Platz für #317 Stufe B und Zoom-Slots Stufe 2, und die Reihenfolge**

| Option | Inhalt | Für | Gegen |
|---|---|---|---|
| A | Connect 2b zuerst; die Teilnehmerzeile bekommt einen Platz für Kennzeichen (Spotlight, Klick-Link), Slot-Einstellungen bleiben je Kachel (dort landen fps, Galerie, Dolmetscherton, Logo), „Zoom-Vorgaben“ im Panel nimmt eine fps-Vorgabe auf; Stufe B und 2 bauen danach auf der neuen Struktur | ein Umbau, kein Nacharbeiten | Stufe B wartet auf 2b |
| B | Stufe B (und ggf. Slots Stufe 2) zuerst, 2b danach | Wunsch des Owners früher | 2b muss dann mehr Code umziehen |
| C | Connect aus 2b herauslösen, bis Stufe 2 da ist | keine Kollision | Connect bleibt am längsten ohne Rahmen und nur dunkel |

**Empfehlung A.** Für #317 Stufe B gibt es noch kein Issue (`docs/roadmap.md:844-845`).

**C5 · Kopfanzeige ON AIR**

| Option | Inhalt | Für | Gegen |
|---|---|---|---|
| A | „ON AIR · n Gäste“ bei `onAirGuests > 0`, sonst „bereit“ | spec-Wortlaut 3.2 | „bereit“, während Zoom-Slots ohne Tally im Programm laufen können (0.6) |
| B | ON AIR nur bei Gästen auf Sendung, sonst **keine** Anzeige | nie gelogen, gleiche Regel wie S2-A | weicht vom Switcher-Muster ab |

**Empfehlung B** (gleiche Kopf-Regel wie Studio-Control S2-A).

**C6 · Talkback per Tastatur** (Folge des Bausteins, klein)

| Option | Inhalt | Für | Gegen |
|---|---|---|---|
| A | übernehmen: fokussierter Talkback-Knopf hält auch mit Leertaste/Enter (Spec 3.4) | barrierearm, Baustein-Vertrag | neuer Bedienweg (kein neues Kürzel) |
| B | Tasten-Halten für Talkback abschalten (neue Baustein-Prop) | Verhalten genau wie heute | Sonderweg im Baustein |

**Empfehlung A.**

---

## 4 · Querschnitt-Entscheidung

**X1 · Baustein-Ergänzungen in `@jm/ui` für 2b** (additiv nach Spec 4.1; jede App bündelt `@jm/ui`)

Gebraucht: (1) fester Dunkel-Modus bzw. `ThemeToggle` ausblendbar (Presenter-Referent, P1), (2) `mac` durch `AppShell`
(Referent ohne `hiddenInset`, 1.10 R2), (3) Kopf-ON-AIR „nur bei wahr“ (S2, C5; heute reicht `onAir` weglassen, nur die
Regel festhalten), (4) kleiner Halte-Knopf oder Export von `erzeugeHalten` (Connect je Gast, PTZ; 0.5).

| Option | Inhalt | Für | Gegen |
|---|---|---|---|
| A | ein vorgezogener Baustein-Task im 2b-Plan (wie Welle-1 Task 1 „Vormerkungen“), mit Galerie und Selbsttest | einmal gebaut, geprüft, in allen drei Apps gleich | eine Fundament-Änderung vor den Apps |
| B | je App lokal lösen (eigener Kopf im Referenten, lokaler Halte-Knopf) | `@jm/ui` bleibt unberührt | Abweichungen je App, genau das, was das Vorhaben abschaffen will |

**Empfehlung A.**

---

## 5 · Größe und Reihenfolge

Bezug Switcher = 1,0 (vor dem Umbau 84 Handler, 4283 Renderer-Zeilen, Funktionsliste 164 Punkte, 6 Tasks im Welle-1-Plan).
Zum Vergleich vor dem Umbau: Timer 89/2939 (184 Punkte), Rundown 43/1423 (141), Q&A 48/956 (135), Battle 25/618 (92);
Welle 1 gesamt ≈ 3,7 Switcher.

| App | Handler / Zeilen (heute) | Treiber | Schätzung |
|---|---|---|---|
| Presenter | 97 / 3966 | zwei Rahmen (erster „Werkzeug“-Rahmen der Suite), 4 Fenster, 17 Fenster-Kürzel, 129 rohe Farben, zwei Brücken fehlen, Panel in zwei Fenstern | **≈ 1,3** (Liste ~200–230 Punkte) |
| Studio-Control | 161 / 4046 (27 tsx) | breit, aber flach: 6 Gerätepanels mit eigenen Tallys, Login-Gate, Browser-Betrieb, Bedeutungs-Umbau der Pillen; **Testgerüst und CI neu**, Start ungeprüft; Optik fast fertig (9 rohe Farben) | **≈ 1,2** (Liste ~200 Punkte, bei S4-A) |
| Connect | 84 / 3403 (+838 Peer ohne Oberfläche) | 260 rohe Farben, kein `@jm/ui`, erster Hell-Modus, zwei Live-Bereiche, Halten zweimal, ~50 Wächter umziehen, Pflicht-Fußzeile, live-kritisch | **≈ 1,6** (Liste ~240 Punkte) |

2b gesamt ≈ 4,1 Switcher, also etwa so groß wie Welle 1.

**Empfohlene Reihenfolge in 2b:**

1. **X1 Baustein-Task** (`@jm/ui`: Theme fest, `mac`-Durchreichung, Halte-Knopf/Export; Galerie, Selbsttest).
2. **Presenter:** keine parallele Arbeit, setzt die Muster „Werkzeug“ und „reduziertes Live-Tool“, die Studio-Control
   (Werkzeugleiste mit Reitern) und Welle 3 brauchen.
3. **Studio-Control:** zuerst Testgerüst + CI und ein Start-Nachweis (R1, R2), dann Rahmen; nutzt die Werkzeugleiste
   aus Schritt 2 und legt das Muster „Tallys je Panel“ fest.
4. **Connect zuletzt:** größter und live-kritischster Umbau, profitiert von den Halte- und Kopf-Regeln aus 1–3;
   danach #317 Stufe B und Zoom-Slots Stufe 2 auf der neuen Struktur (C4-A).

## 6 · Was blockiert

- **Nichts hart.** 2b wartet nach Auftrag ohnehin auf 2a.
- **Vor dem Plan nötig:** die Owner-Entscheide P1–P4, S1–S5, C1–C6, X1 (C1 ist durch UO7 eigentlich entschieden; nur
  bestätigen).
- **Weich:** Studio-Control hat kein Testgerüst und einen ungeprüften Start (`742b491e82` „ungetestet“; die Memory
  „startet in Dev nicht“ ist durch den Fix auf `main` vermutlich überholt, aber nicht gemessen). Connect-Abnahme braucht
  zwei Rechner mit Launcher-Freigaben. Für #317 Stufe B fehlt das Issue.
