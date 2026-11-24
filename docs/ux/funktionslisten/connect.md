# Funktionsliste JM Connect (Suite-UX-Update, Welle 2b · Connect)

Zweck (Spec `docs/superpowers/specs/2026-10-08-suite-ux-update-design.md`, Abschnitt 10 „Kein Funktionsverlust“, und
Anhang A „Connect“): jedes Bedienelement mit Handler, jedes Tastaturkürzel, jeder Dialog, jede Fernsteuerungs-Aktion, jedes
Fenster und jede Einstellung von JM Connect, erhoben **vor dem Umbau** aus dem Code. Nach dem Umbau bekommt jede Zeile in der
Spalte „künftig wo“ einen Haken mit dem Ort im neuen Aufbau (Task 25); ein Punkt ohne Haken blockiert die Welle.

- **Stand:** erhoben aus dem Code am 2026-11-24, Commit `481c998c08`, Connect 0.5.0 (`package.json`). Die Nachmessung
  `docs/ux/welle2-nachmessung-2b.md` (Abschnitt 3, „N2b“) gilt für `0f589c3ee1`; `git diff 0f589c3ee1 481c998c08 -- apps/connect`
  und `git diff 481c998c08 HEAD -- apps/connect` sind leer (letzter Commit an der App `f2764d2e46`, 2026-11-21). Zeilennummern
  gelten für `481c998c08`. Was nur aus dem Code abgeleitet ist, steht als „abgeleitet“, Unklares als „unklar“ bzw. „nicht
  gemessen“. Korrekturen an N2b: die Zoom-Zustände reichen von Z0 bis Z13 mit Z1a/Z1b, Z5a/Z5b, Z7b und Z9b
  (`src/shared/zoom-text.ts:113-141`; N2b 3.5 und der Plan nennen „Z0–Z11“); die Tray-Taste „Raum schließen“ ist nur bei
  mindestens einer NDI-Gastquelle aktiv (`src/main/tray.ts:88`, Nr. 169).
- **Vorher-Messung** (2026-11-24, Plan Task 20, Echt-Fenster-Messung in der weiten Lesart): der gebaute, unveränderte Stand lief
  unter Windows in einem eigenen Profil (Benutzerordner, `APPDATA` und `LOCALAPPDATA` umgelenkt, eigener `--user-data-dir`,
  Fake-Medien) mit gehaltenem Steuerport 8737. Connect sucht schon ohne Raum per mDNS nach JM Presenter und verbindet sich mit
  jedem gefundenen (Nr. 161), und es meldet sich beim Launcher (Nr. 163); darum lief jeder Mess-Lauf mit einer Netzwache im
  Hauptprozess (über `NODE_OPTIONS`, ohne eine Quelldatei zu ändern): sie verweigerte jede TCP-Verbindung, jeden UDP-Socket und
  jeden Utility-Prozess. Kein Cloud-Raum, keine Anmeldung, kein Zoom, kein NDI-Sender, kein Mikrofon. Gemessen per CDP bei
  1280×860 und 980×640 (Größen der Messung laut Plan-Block Connect, außen; Panel zu, ein Panel gibt es heute nicht), je Zustand
  das Rechteck **jedes** Bedienelements in Kopf, Cloud-Bereich, Gästeliste, Zoom-Karte und Fußzeile. Rohdaten liegen im Ledger
  der Welle („vorher-connect.json“, nicht im Repo). Was die Messung belegt, steht in den Zeilen als „gemessen“; die Zahlen
  stehen in Abschnitt 10 (Befunde 1 bis 6, 8, 9 und 12).
- **Simuliert gemessen:** Alles, was einen Raum, Gäste, Zoom oder NDI braucht, ist im selben Lauf im echten Fenster gemessen,
  nachdem der Zustand **nur im Renderer** gesetzt war (die useState-Hooks von `R/App.tsx` und `R/zoom/ZoomCard.tsx`, per CDP;
  der Hauptprozess erfährt nichts, nichts geht ins Netz). Diese Zustände stehen in den Zeilen als „simuliert gemessen“; in der
  JSON trägt jeder `simuliert: true`, den eingespielten Stand und den Stand vor und nach der Messung.
- **Gelesen, vollständig:** `R/App.tsx`, alle sechs Dateien in `R/zoom/` (ZoomCard, SlotBereich, SlotKachel,
  SlotEinstellungen, Messwerte, slot-vorschau), `R/lib/qr.ts`, `R/main.tsx`, `R/index.css`, `R/jmconnect.d.ts`,
  `src/renderer/index.html`, `src/renderer/peer.html`; in `src/main/` index.ts, ipc.ts, room.ts, raum-id.ts, secrets.ts,
  settings.ts, show-open.ts, tray.ts, control-server.ts, control-state.ts, kontextmenue.ts, presenter-link.ts, peer-window.ts,
  ndi-guests.ts, ndi-program.ts, zoom.ts; in `src/main/zoom/` fernsteuerung.ts, plattform.ts; in `src/main/zugang/` huelle.ts,
  halter.ts; `src/preload/index.ts`; in `src/shared/` app-status.ts, ipc.ts, raum-ansicht.ts, types.ts; `package.json`,
  `electron.vite.config.ts`. Ausschnitte: `src/main/zoom/kern.ts` (Erzeugen, Abbild, Einrichtung, Beitritt, Verlassen, Slots,
  Fernsteuerung, Zeilen 466 bis 560, 787 bis 1215, 1556 bis 1700, 1804 bis 1940, 2503 bis 3000), `src/main/zugang/regeln.ts`
  (Texte und Zeilen, 186 bis 338), `src/main/ndi-lage.ts` (Typen und Zählung), `src/shared/zoom-text.ts` und
  `src/shared/ndi-text.ts` (die Texte und Regeln, die die Oberfläche nutzt), `src/renderer/src/peer.tsx` (nur Talkback-Mikro und
  Abgrenzung), `packages/app-runtime/src/index.ts` (Anwesenheit, Master-Link, Laufzeit), `packages/electron-kit/src/index.ts`,
  `packages/discovery/src/index.ts`, `packages/suite-control-protocol/src/server.ts` (`start`) und
  `packages/suite-control-protocol/src/capabilities.ts` (nur der Eintrag `connect`, Zeilen 627 bis 709). Nur Kopf und Exporte (reine Regeln, die der
  Kern ruft, ohne eigene Oberfläche): die übrigen Dateien in `src/main/zoom/` (einstellungen, fristen, jwt-quelle, klartext,
  laufzeit, sdk-laden, sdk-paket, slot-eingabe, slots, teilnehmer) und `src/main/tray-symbol.ts`. Nicht gelesen: die
  Treiber-Innereien der Zoom-Bridge (`packages/zoom-bridge/**`), `src/utility/**`, die Selbsttests unter `test/`.
- **künftig wo** bleibt leer. Die Spalte wird nach dem Umbau gefüllt und abgehakt.
- **Pfade:** ohne Vorsatz relativ zu `apps/connect/` (`src/…`, `package.json`); `R/…` steht für `src/renderer/src/…`;
  `packages/…` und `docs/…` sind relativ zur Repo-Wurzel. Zeilenangaben hinter einer Datei (etwa „:12-34“) gelten für die zuletzt
  genannte Datei im selben Feld. Dateien im Benutzerordner der App (userData) und im Ledger stehen ohne Backticks in „…“, weil sie
  nicht im Repo liegen.
- **Fenster** (N2b 3.2): ein Hauptfenster (Abschnitt 1) ohne Rahmen aus `@jm/ui`; dazu das unsichtbare Peer-Fenster, das Tray
  und der Ladescreen der Laufzeit (Abschnitt 4). Ein Ausgabefenster gibt es nicht; die Ausgabe sind NDI-Quellen (Abschnitt 5).
- **Zustands-Kürzel** (Spalte „Zustand (sichtbar/aktiv)“): **oR** = ohne Raum (kein Client) · **C** = Client besteht (nach
  „Raum öffnen“) · **V** = mit Raumverbindung · **oV** = Client ohne Raumverbindung · **RA** = nach einem Raumabbruch (E57) ·
  **RB** = Raum-Zustand bekannt · **Sh** = Show geöffnet · **St** = Status des Hauptprozesses da · **Win** = nur Windows (Zoom-Karte)
  · **Mac** = nur macOS · **Z…** = Zoom-Zustände nach `zoomZ` (`src/shared/zoom-text.ts:113-141`): Z0 macOS, Z1a Einrichtung mit
  Mangel, Z1b Einrichtung läuft, Z2 bereit, Z3 meldet sich an, Z4 tritt bei, Z5a/Z5b Warteraum bzw. wartet auf den Host, Z6 im
  Meeting ohne Antwort zur Erlaubnis, Z7/Z7b ohne Erlaubnis, Z8/Z9/Z9b mit Erlaubnis, Z10/Z11 Abriss, Z12 verlässt, Z13 Fehler ·
  **Main** = Hauptprozess, ohne Oberfläche · **Fs** = Fernsteuerung, Port 8737 · **Tray** = Tray-Menü · **Peer** = unsichtbares
  Peer-Fenster.
- **Nummerierung:** fortlaufend 1–189 in den Abschnitten 1–7.
  Zeilen je Abschnitt: 1 = 104, 2 = 17, 3 = 44, 4 = 9, 5 = 1, 6 = 7, 7 = 7; zusammen 189.
  Abschnitt 4 hat drei Teiltabellen (4a Peer-Fenster, 4b Tray, 4c Ladescreen und „Über JM Connect“).
  Die Abschnitte 8 (IPC-Übersicht), 9 (Zuordnung zu Spec 6 / Anhang A) und 10 (Befunde) haben keine nummerierten Punkte und
  werden nicht abgehakt.
- **Pflichtzeilen** (Plan Task 20, Muster Teil 3):
  - Jede Fernsteuerungs-Aktion als Ablauf: die Verben `go`, `next`, `onair`, `off`, `approve`, `kick`, `standby`, `slides`,
    `talkback` Nr. 132 bis 140, dazu Weiche Nr. 131 und Unbekanntes Nr. 141; die sieben
    `zoom_*`-Verben (`src/main/zoom/fernsteuerung.ts:34-44`: `zoom_load`, `zoom_unload`, `zoom_delay`, `zoom_slot`, `zoom_slot_mode`,
    `zoom_slot_person`, `zoom_slot_audio`) Nr. 142 bis 148 mit dem Ergebnis Nr. 149; Steuerserver Nr. 130, STATE Nr. 128 und 129.
  - Tray „Raum schließen“ Nr. 150 (Menü Nr. 169); Regel V (`raumAnsicht`) Nr. 20; Pflicht-Fußzeile Nr. 103; T145 mit ® Nr. 9;
    Zoom-Einrichtung aufgeklappt bei Mangel Nr. 61; Standby ohne Anzeige (N2b 3.1 Nr. 31, bleibt) Nr. 45 und 138;
    Talkback nur per Zeiger, ohne `blur` (Befund 7) Nr. 35 und 40; Schließen ins Tray Nr. 2; Panel-Tasten Nr. 182;
    Standardmenü (N2b 0.3, „Strg+R lädt neu, die Raumverbindung fällt“) Nr. 177; Abschnitt 4 Zusatzfenster Peer-Fenster
    Nr. 166 bis 168 und Tray Nr. 169 bis 172 (dazu Ladescreen und „Über“ Nr. 173 und 174).
  - Jeder `window.confirm`: keiner, Nr. 105; jedes `localStorage`/`persistId`: keins, Nr. 183.
  - Jede Zeile der Nachmessung 3.1 mit ✏️, ❌ oder ➕ hat eine eigene Zeile mit dem heutigen Verhalten und dem Vermerk „N2b 3.1
    Nr. …“ (Nummer der Nachmessung → Zeilen dieser Liste): 1 (✏️, ➕) → 20, 36, 50; 4 (✏️) → 132, 133;
    5 (➕) → 129; 7 (➕) → 125; 8 (✏️) → 13; 9 (✏️) → 32; 10 (✏️) → 38, 155; 11 (✏️) →
    10; 13 (➕) → 12, 78; 15 (➕) → 155, 82; 16 (✏️) → 13, 14, 15; 17 (✏️) →
    50, 61 bis 68; 19 (✏️) → 6; 20 (✏️, ➕) → 178, 179; 21 (❌) → 50; 23 (➕) →
    7; 26 (➕) → 40, 41; 27 (➕) → 103; 28 (➕) → 23, 24, 29; 29 (➕) → 158; 30 (➕) →
    2, 169; 31 (➕) → 45; 32 (➕) → 157, 120.
- **`window.confirm`:** keiner (Nr. 105; Rückfragen sind Zeilen in der Seite). **`localStorage`/`persistId`:** keiner
  (Nr. 183); gemerkt wird nur im Hauptprozess (Abschnitt 7).

---

## 1 · Hauptfenster

Ein Fenster (`src/main/index.ts:50-73`) mit einem einspaltigen Inhalt aus `R/App.tsx`: Kopf, Cloud-Bereich (Cloud-Zugang, Show,
Raum, Einladen, Gästeliste), darunter die Zoom-Karte (nur Windows) und die Pflicht-Fußzeile. Kein Rahmen aus `@jm/ui`, kein
Panel, keine Statusleiste; die ganze Seite scrollt. Haupttasten sind „Raum öffnen“/„Raum schließen“ und „Talkback alle“ (B21);
die Zoom-Karte hat ihre eigenen folgenreichen Tasten.

| Nr. | Bereich | Element | Handler/IPC | Zustand (sichtbar/aktiv) | heute wo | künftig wo |
|---|---|---|---|---|---|---|
|1| Fenster | Fensterhülle aus `createMainWindow`: 1280×860, mindestens 980×640, Hintergrund `#121212`, Titel „JM Connect“, Symbol aus `resources`, auf dem Mac `hiddenInset`, `autoHideMenuBar`, `sandbox`, `contextIsolation`, ohne `nodeIntegration`; Anzeige bei `ready-to-show`. Gemessen: auf dem Prüfrechner (Hauptbildschirm 1524×820 Arbeitsfläche) öffnet es mit 1281×820; für die Messung außen 1282×862 (innen 1269×832) und 982×642 (innen 969×611) bei Skalierung 1,26 | `createMainWindow` | Main | `src/main/index.ts:50-58`, `packages/electron-kit/src/index.ts:44-90` | |
|2| Fenster | Schließen versteckt ins Tray (N2b 3.1 Nr. 30 ➕): das Kreuz (und abgeleitet Alt+F4 und Strg+W) ruft `hide`, solange nicht beendet wird; Zuschaltungen, NDI und Zoom laufen weiter; beendet wird nur über das Tray (Nr. 171) oder das Abmelden von Windows | `close`, `isQuitting` | Main | `src/main/index.ts:59-65`, `:199-202` | |
|3| Fenster | Fensterzustand an die Zoom-Vorschau: show, hide, minimize, restore, ready-to-show melden „sichtbar“ an den Zoom-Kern (Vorschau nur bei sichtbarem Fenster); bei der Abmeldung von Windows verlässt Connect das Meeting (Frist `BEENDEN_FRIST_MS`) | `verdrahteZoomFenster`, `session-end` | Main, Win | `src/main/index.ts:66-71`, `src/main/zoom.ts:303-313` | |
|4| Fenster | Externe Adressen: `window.open` öffnet jede Adresse im System-Browser und verweigert das Fenster; der Renderer ruft `window.open` nirgends (abgeleitet) | `setWindowOpenHandler` | Main | `packages/electron-kit/src/index.ts:73-76` | |
|5| Fenster | Aufbau (N2b 3.1 Nr. 18): ein Block `mx-auto max-w-3xl p-6` (768 breit, innen 720), alle Teile untereinander im Fluss; die Seite selbst scrollt, es gibt keinen eigenen Scrollbereich, kein Element ist `fixed` oder `sticky`. Gemessen: Inhalt bei x 266–986 (1280×860 mit Bildlaufleiste) bzw. 275–995 (ohne), bei 980×640 x 116–836 bzw. 125–845; derselbe Zustand hat bei beiden Größen dieselben Höhen | `App` | St | `R/App.tsx:355-548` | |
|6| Fenster | Farben und Schrift (N2b 3.1 Nr. 19 ✏️): nur dunkel (`color-scheme: dark`, `#121212`), Schrift `system-ui`, Tailwind-Palettenklassen statt Tokens (260 rohe Fundstellen laut N2b), kein `@jm/ui`, kein Hell-Modus, keine Manrope | – (Anzeige) | St | `R/index.css:1-12`, `src/renderer/index.html:1-16`, `package.json:26-56` | |
|7| Fenster | CSP (N2b 3.1 Nr. 23 ➕): Meta-CSP im HTML (`connect-src 'self' https: wss:`, `img-src 'self' data:`) und dazu die Laufzeit-CSP mit `connectSrc` https und wss, weil der Renderer selbst mit dem Raum spricht | `initAppRuntime({ csp })` | Main | `src/renderer/index.html:6-9`, `src/main/index.ts:31-42` | |
|8| Kopf | Kopf als `header` mit `h1` „JM Connect“ links und drei Textzeilen rechts; keine Knöpfe. Gemessen 48 hoch (y 24–72) | – (Anzeige) | St | `R/App.tsx:357-367` | |
|9| Kopf | Untertitel T145 „Remote-Zuschaltungen als NDI®-Quellen — Green Room“ mit ® an der ersten Nennung von NDI (LP3/PK52, B9) | `NDI_TEXT.t145` | St | `R/App.tsx:360`, `src/shared/ndi-text.ts:76` | |
|10| Kopf | „Steuerport 8737“ (N2b 3.1 Nr. 11 ✏️): die Konstante `controlPort`, ohne Status die Vorgabe 8737; ob der Steuerserver läuft, steht nirgends (gemessen: mit belegtem Port 8737 steht dieselbe Zeile) | `status.controlPort` | St | `R/App.tsx:363`, `src/main/control-server.ts:21` | |
|11| Kopf | „● Raum verbunden“ bzw. „○ Raum nicht verbunden“ aus `connected` (N2b 3.1 Nr. 7): verbunden erst nach `onOpen` der Raum-WebSocket | `connected` | St | `R/App.tsx:364` | |
|12| Kopf | Zoom-Zeile `zoomZeile(status.zoom)` (N2b 3.1 Nr. 13 ➕ Slot-Zählung): dieselbe Zeile wie im Tray, je Zustand Z1a bis Z13 (etwa „△ Zoom: Einrichtung unvollständig“, gemessen; „● Zoom: 6 Slots laufen, 2 mit Ersatzbild“, simuliert gemessen); unter macOS und ohne Status keine Zeile | `zoomZeile` | St, Win | `R/App.tsx:365`, `src/shared/zoom-text.ts:158-195` | |
|13| Cloud-Zugang | Karte zu (N2b 3.1 Nr. 8 ✏️, Nr. 16 ✏️): eine Zeile „Cloud-Zugang: ‹Adresse› · ‹Zugangszeile›“, abgeschnitten (`truncate`), die Zugangszeile kommt fertig aus dem Main (CZ1 bis CZ10) und ist nach Ton gefärbt; Knopf „ändern“. Gemessen: Karte y 96–139, „ändern“ x 927–982 bzw. 919–973 (ohne/mit Bildlaufleiste), y 105–130; im Messbild ist die Zeile bei beiden Größen abgeschnitten | `CloudZugangKarte`, `status.cloudZugang` | St | `R/App.tsx:564-603`, `src/main/zugang/regeln.ts:281-315` | |
|14| Cloud-Zugang | Karte offen nach „ändern“: Titel „Cloud-Zugang“, die Zugangszeile, Feld „Adresse“ (Platzhalter „https://…workers.dev“, Enter speichert, Nr. 178); kein Key-Feld mehr (Anmeldung Teil 2). Gemessen: Feld x 279–973, y 181–210; „Raum öffnen“ rückt von y 155 auf 281 | `setOpen(true)`, `setUrl` | St | `R/App.tsx:606-620` | |
|15| Cloud-Zugang | „Key entfernen“ (CZ10 „Alter Proxy-Key: hinterlegt, nur noch im Übergang.“): nur bei einem alten Key mit Herkunft `stored` oder `session`; `setProxy({ key: '' })`, ohne Rückfrage. Simuliert gemessen: x 862–973, y 222–252, „Speichern“ und „Schließen“ rücken auf y 264 | `dropKey`, IPC `jmc:set-proxy` | St | `R/App.tsx:586-588`, `:622-632` | |
|16| Cloud-Zugang | „Speichern“: `setProxy({ url })`; leere Adresse setzt die Vorgabe (abgeleitet aus `src/main/settings.ts`); ist danach eine Adresse da, schließt die Karte; gesperrt, solange gespeichert wird. Gemessen x 279–366, y 222–252 | `save`, IPC `jmc:set-proxy` | St | `R/App.tsx:575-584`, `:634-641`, `src/main/ipc.ts:125-130` | |
|17| Cloud-Zugang | „Schließen“: Karte zu, eine geänderte, nicht gespeicherte Adresse bleibt im Feld stehen (abgeleitet). Gemessen x 889–973, y 222–252 | `setOpen(false)` | St | `R/App.tsx:642-647` | |
|18| Show | Show-Karte (N2b 3.1 Nr. 14): nur nach einem Show-Deep-Link (Nr. 151): Name der Veranstaltung, „n Sprecher aus iveo · Raum ‹Raum-ID›“, die Sprecher als Chips mit Funktion. Simuliert gemessen: Karte y 155–245, alles darunter rückt um 106 nach unten | `ShowCard` | Sh | `R/App.tsx:373`, `:653-695` | |
|19| Show | „n Sprecher einladen“ bzw. „Alle eingeladen“: je noch nicht eingeladenem Sprecher ein Join-Link (`mintGuests`, Reihenfolge der Show), Audit „provision“; gesperrt ohne Raumverbindung (Tooltip „Erst den Raum öffnen“), ohne Sprecher und wenn n ≤ 0. Die Zahl zählt alle Einladungen, nicht nur die der Sprecher (abgeleitet). Simuliert gemessen x 844–973, y 170–202 | `inviteSpeakers`, IPC `jmc:mint-guests` | Sh | `R/App.tsx:228-240`, `:674-681` | |
|20| Raum | Regel V (`raumAnsicht`, N2b 3.1 Nr. 1 ✏️): was im Raum-Bereich steht und was bedienbar ist, folgt nur aus „Client besteht“, Raumverbindung, Raum-Zustand bekannt und Raumabbruch: ohne Client „Raum öffnen“; nach einem Raumabbruch dazu T144 und „Raum schließen“; mit Client die Einladen-Zeile; die Gästeliste, sobald der Raum-Zustand bekannt ist (ohne Verbindung mit T141); Talkback, Folien, Gast-Tasten und „Link erzeugen“ nur mit Raumverbindung | `raumAnsicht` | oR, C, V, RA, RB | `R/App.tsx:325`, `src/shared/raum-ansicht.ts:37-51` | |
|21| Raum | Haupttaste „Raum öffnen“ bzw. mit Show „Raum „‹Raum›“ öffnen“ (N2b 3.1 Nr. 2, folgenreich): `openRoom` über die Raum-Folge (Nr. 126), holt beim Main die Freigabe und öffnet den Raum in der Cloud, dann die Raum-WebSocket; gesperrt **ohne Grund**, solange `!status.configured` (keine Adresse) oder kein Status da ist; großer gelber Knopf, kein Verb. Gemessen x 275–412 (ohne Bildlaufleiste) bzw. 266–404, y 155–203, mit Show 266–552; acht Lagen je Größe zwischen y 155 und 322, bei `scrollTop` 0 immer sichtbar, nie abgeschnitten | `openRoom`, IPC `jmc:open-room` | oR | `R/App.tsx:152-215`, `:382-392` | |
|22| Raum | „Raum schließen“ in der Raum-Zeile (folgenreich): nur ohne Client nach einem Raumabbruch (`raumSchliessen && !gastEinladen`), neben „Raum öffnen“. Simuliert gemessen x 412–542, y 262 bzw. 282 | `closeRoom`, IPC `jmc:close-room` | RA | `R/App.tsx:393-397` | |
|23| Raum | Fehlerfeld (rot, über allem unter dem Kopf): Fehler von „Raum öffnen“ (Nr. 107), „Link erzeugen“, „Sprecher einladen“, „Raum schließen“ und der Wachhund T146 (Nr. 109); bleibt bis zum nächsten Öffnen oder zur Verbindung (N2b 3.1 Nr. 28 ➕). Simuliert gemessen: der Kasten mit T146 bzw. CZ7 ist 66 hoch und schiebt alles darunter um 82 nach unten | `error`, `setError` | oR, C | `R/App.tsx:369` | |
|24| Raum | Hinweis T144 nach einem Raumabbruch (E57, N2b 3.1 Nr. 28 ➕), mit Zusatz bei bekanntem Raum-Zustand („Die Gästeliste zeigt den letzten Stand …“). Simuliert gemessen: Kasten y 155–261 | `ansicht.t144`, `NDI_TEXT.t144` | RA | `R/App.tsx:376-381`, `src/shared/ndi-text.ts:72-75` | |
|25| Einladen | Feld „Gast einladen“ (Platzhalter „Name des Gasts“); leer bedeutet „Gast“; kein Enter (Nr. 178). Simuliert gemessen x 266–719, y 175–213 | `setGuestName` | C | `R/App.tsx:400-411` | |
|26| Einladen | „Link erzeugen“: Join-Link für einen Gast (`mintGuest`, Name höchstens 60 Zeichen im Token, 12 Stunden gültig), danach Feld leer; gesperrt ohne Raumverbindung (ohne Grund). Simuliert gemessen x 727–848, y 177–213 | `inviteGuest`, IPC `jmc:mint-guest` | C, V | `R/App.tsx:217-225`, `:412-418`, `src/main/room.ts:129-142` | |
|27| Einladen | „Raum schließen“ in der Einladen-Zeile (folgenreich, B21: entfällt zugunsten der Haupttaste): `closeRoom` über die Raum-Folge; WebSocket zu, Einladungen weg, Gästeliste weg, im Main NDI-Quellen und Programm-Empfang aus, Raum in der Cloud gelöscht und das Secret verworfen (alle Links tot); ohne Rückfrage. Simuliert gemessen x 856–986 (1280×860) bzw. 706–836, y 175, 257 oder 281 je nach Show | `closeRoom`, IPC `jmc:close-room` | C | `R/App.tsx:242-266`, `:419-421`, `src/main/ipc.ts:115-120`, `src/main/room.ts:145-166` | |
|28| Einladen | Einladungen: je Link eine Karte mit QR (96×96, aus `R/lib/qr.ts`), Name, voller Link und „Link kopieren“ (Zwischenablage, danach 1,5 s „Kopiert ✓“); zwei Spalten ab Breite `sm`. Simuliert gemessen: zwei Karten y 335–545, „Link kopieren“ x 387–476 und 753–842, y 508–532 | `InviteCard`, `copy` | C | `R/App.tsx:424-430`, `:698-729`, `R/lib/qr.ts:1-10` | |
|29| Raum | Hinweis T141 über der Gästeliste (N2b 3.1 Nr. 28 ➕): Client besteht, keine Raumverbindung, Raum-Zustand bekannt | `ansicht.t141`, `NDI_TEXT.t141` | oV, RB | `R/App.tsx:435-437`, `src/shared/ndi-text.ts:64-65` | |
|30| Gästeliste | Kopfzeile der Gästeliste: steht mit Raumverbindung immer, ohne sie nur, wenn der Programm-Empfang nicht „aus“ ist (simuliert gemessen mit „Programm sucht …“ ohne Raum); links die Zählung „n Gäste · n im Warteraum · n auf Sendung“ (nur mit Raumverbindung) | `Kopfzeile`, `kopfzeileSichtbar` | V, St | `R/App.tsx:441-450`, `:888-911`, `src/shared/ndi-text.ts:206-208` | |
|31| Gästeliste | Abzeichen „📊 Presenter“, solange ein JM Presenter im LAN gekoppelt ist (N2b 3.1 Nr. 12) | `status.presenterLinked` | V, St | `R/App.tsx:895-897` | |
|32| Gästeliste | Programm-Abzeichen T120 bis T128 (N2b 3.1 Nr. 9 ✏️) nach `status.ndiProgramm`, Farbe je Zustand, voller Text als Tooltip; höchstens 60 % breit. Gemessen: auch das kurze „Programm: aus“ ist abgeschnitten (93 breit, „Programm: …“), ebenso „Programm sucht …“ und „Programm ● ‹Quelle›“ (simuliert gemessen) | `ProgramBadge`, `programmAbzeichen` | V, St | `R/App.tsx:789-816`, `src/shared/ndi-text.ts:197-199` | |
|33| Gästeliste | Link „ndi.video“ (T133, Tooltip „NDI-Website öffnen (ndi.video)“): öffnet nur https://ndi.video/; scheitert es, steht T143 daneben. Gemessen x 932–981, y 231–247 | `NdiLink`, IPC `jmc:ndi-seite` | V, St | `R/App.tsx:899`, `R/zoom/SlotBereich.tsx:134-144` | |
|34| Gästeliste | Grundzeile T128 im Zustand „gescheitert“ mit „Programm neu starten“ (nicht bei `keinPeer`) und „Logordner öffnen“; beide per IPC, auch ohne Raumverbindung bedienbar. Simuliert gemessen: „Programm neu starten“ x 743–880, y 253–274, „Logordner öffnen“ x 266–377, y 282–304 | `Grundzeile`, IPC `jmc:programm-neustart`, `jmc:logordner` | V, St | `R/App.tsx:860-882`, `:902-908` | |
|35| Talkback | Haupttaste „Talkback alle“ (N2b 3.1 Nr. 3, folgenreich, **Befund**): `PttButton` volle Breite, „🎙 Halten zum Sprechen (alle Gäste)“ bzw. gehalten „🎙 Regie spricht — alle Gäste“ (gelb); Drücken sendet `talkback` an alle mit Audit, Loslassen `off`. **Nur per Zeiger** (`pointerdown`, `pointerup`, `pointercancel`, Zeiger eingefangen); **kein `blur`**, keine Tastatur: ein Fokuswechsel während des Haltens lässt das Mikro offen (abgeleitet, N2b 3.10 R4). Gesperrt ohne Raumverbindung, ohne Grund; die Handler prüfen zusätzlich die Verbindung. Gemessen x 266–986 (1280×860) bzw. 116–836, 44 hoch, sieben Lagen zwischen y 257 und 810; mit Show und Einladungen bei 980×640 unter dem Rand | `PttButton`, `talkbackDown(null)`, `talkbackUp` | RB, V | `R/App.tsx:83-95`, `:454-461`, `:741-776` | |
|36| Gästeliste | Gästeliste (N2b 3.1 Nr. 1): alle Gäste außer „verlassen“ und „entfernt“ in der Reihenfolge des Raums, je Zeile eine Karte; ohne Gäste „Noch keine Gäste — Link erzeugen und teilen.“. Simuliert gemessen mit je Phase einem Gast: sechs Zeilen, 50 hoch, die Zeile mit Bildschirm 86 (zweizeilig); Liste y 313–686 | `guests`, `PHASE_LABEL` | RB | `R/App.tsx:19-28`, `:322`, `:463-538` | |
|37| Gästeliste | Gastzeile: Name (`flex-1`), Abzeichen „🖥 Bildschirm“ bei geteiltem Bildschirm (Tooltip T113 mit dem NDI-Namen der Bildschirm-Quelle) | `g.hasScreen`, `bildschirmTooltip` | RB | `R/App.tsx:469-474` | |
|38| Gästeliste | NDI-Abzeichen je Quelle (N2b 3.1 Nr. 10 ✏️): für Kamera und Bildschirm nach der Lage im Main T107 „NDI startet …“, T108 „NDI ● n Empfänger“, T109 „NDI: kein Bild“, T110 „NDI ausgefallen · Neustart k von 3 …“, T111 „NDI ausgefallen“; ohne Eintrag nach 3 s T140 „NDI: keine Quelle“; ohne Status keins; höchstens 40 % breit, voller Text als Tooltip. Simuliert gemessen | `gastNdi`, `gastAbzeichen`, `useOhneEintragSeit` | RB, St | `R/App.tsx:328-353`, `:476-487`, `:838-854`, `src/shared/ndi-text.ts:163-171` | |
|39| Gästeliste | Phase-Abzeichen: „verbindet“, „Warteraum“, „freigegeben“, „AUF SENDUNG“ (rot), „aus Sendung“, „getrennt“ | `PhaseBadge` | RB | `R/App.tsx:515`, `:929-937` | |
|40| Gästeliste | je Gast Talkback „🎙“ (folgenreich, N2b 3.1 Nr. 26 ➕): nur freigegeben, auf Sendung oder aus Sendung; Halten wie Nr. 35 (nur Zeiger, kein `blur`), Ziel nur dieser Gast (Tooltip „Halten: nur ‹Name› hört die Regie“), gehalten gelb. Simuliert gemessen 28×24, x je nach Zeile zwischen 567 und 929 | `talkbackDown(g.id)` | RB, V | `R/App.tsx:488-498`, `:732-734` | |
|41| Gästeliste | je Gast „📊“ Folien (folgenreich, N2b 3.1 Nr. 26 ➕): erteilt bzw. entzieht dem Gast das Weiterblättern im JM Presenter (`slides`, Audit), blau bei erteilt; Tooltip je nach gefundenem Presenter; nur wie Nr. 40 | `folien` | RB, V | `R/App.tsx:97-105`, `:499-514` | |
|42| Gast-Aktionen | „Freigeben“ (Warteraum, folgenreich): `approve` an den Raum | `send({ t: 'approve' })` | RB, V | `R/App.tsx:942-948` | |
|43| Gast-Aktionen | „Ablehnen“ (Warteraum, folgenreich): `deny` an den Raum; dafür gibt es kein Verb (Nr. 141) | `send({ t: 'deny' })` | RB, V | `R/App.tsx:946` | |
|44| Gast-Aktionen | „Auf Sendung“ (freigegeben oder aus Sendung, folgenreich): `onair` | `send({ t: 'onair' })` | RB, V | `R/App.tsx:958-961` | |
|45| Gast-Aktionen | „Standby“ (freigegeben oder aus Sendung, folgenreich): `standby` setzt `standbyId` im Raum; **Standby ohne Anzeige** (N2b 3.1 Nr. 31 ➕, bleibt, C1-A): die Oberfläche liest `standbyId` nicht, nur der STATE meldet ihn (Nr. 128). Simuliert gemessen: mit gesetztem Standby sind alle Rechtecke, Texte und Abzeichen gleich wie ohne | `send({ t: 'standby' })` | RB, V | `R/App.tsx:962`, `:117-118` | |
|46| Gast-Aktionen | „Aus Sendung“ (auf Sendung, folgenreich): `off` | `send({ t: 'off' })` | RB, V | `R/App.tsx:950-953` | |
|47| Gast-Aktionen | „Entfernen“ (freigegeben, auf Sendung, aus Sendung; folgenreich): `kick`, ohne Rückfrage; nicht im Warteraum (dort „Ablehnen“), nicht bei „verbindet“ und „getrennt“ | `send({ t: 'kick' })` | RB, V | `R/App.tsx:954`, `:963` | |
|48| Gast-Aktionen | Lage der Gast-Tasten: rechts in der Zeile nach den Abzeichen, gesperrt ohne Raumverbindung (ohne Grund); bei „verbindet“ und „getrennt“ keine Taste. Simuliert gemessen: in der Zeile mit Bildschirm brechen „Auf Sendung“, „Standby“, „Entfernen“ in eine zweite Reihe (x 279–503 bzw. 373–597); dieselbe Taste steht je nach Phase, Abzeichen und Zeile an drei verschiedenen x-Lagen (Befund 2) | `GuestActions` | RB | `R/App.tsx:940-968` | |
|49| Gästeliste | Grundzeile T111 einer ausgefallenen Quelle (Kamera oder Bildschirm) mit „NDI neu starten“ (nicht bei `keinPeer`) und „Logordner öffnen“; per IPC, auch ohne Raumverbindung. Simuliert gemessen: „NDI neu starten“ x 751–852, „Logordner öffnen“ 860–971, y 620–641 | `Grundzeile`, IPC `jmc:ndi-neustart`, `jmc:logordner` | RB, St | `R/App.tsx:519-533`, `:860-882` | |
|50| Zoom | Zoom-Karte (N2b 3.1 Nr. 1 ➕ zweiter Live-Bereich, Nr. 17 ✏️, Nr. 21 ❌ überholt): nur unter Windows, unter dem Raum-Bereich, unabhängig vom Cloud-Raum; Zoom-Oberfläche in sechs Dateien, keine parallele Arbeit mehr daran. Gemessen ab y 227 ohne Raum; mit Gästen und Show ab y 1067 | `ZoomCard` | Win | `R/App.tsx:544`, `R/zoom/ZoomCard.tsx:91-655` | |
|51| Zoom | Unter macOS steht statt der Karte T95 „Zoom-Slots gibt es nur unter Windows: Die Zoom-Bridge läuft nur dort.“ (nicht gemessen) | `MAC_ZEILE` | Mac | `R/App.tsx:544`, `src/shared/zoom-text.ts:1473` | |
|52| Zoom | Karte vor dem ersten Abbild: nur „Zoom-Meeting“, bei einem Fehler des Abrufs dessen Text. Simuliert gemessen: 54 hoch | `abbild === null`, `ladeFehler` | Win | `R/zoom/ZoomCard.tsx:117-133`, `:209-216` | |
|53| Zoom | Statuszeile rechts neben „Zoom-Meeting“ (`kartenZeile`), je Zustand (etwa Z1a „Zoom ist nicht vollständig eingerichtet: SDK-Ordner fehlt.“, gemessen), in Z11 mit Countdown (tickt alle 250 ms) | `kartenZeile` | Win | `R/zoom/ZoomCard.tsx:169-176`, `:351-354`, `src/shared/zoom-text.ts:223-275` | |
|54| Zoom | Antwort am Ort „karte“: abgelehnte Aufrufe ohne eigenen Ort und unerwartete IPC-Fehler, rot unter der Statuszeile | `antwort`, `fuehreAus` | Win | `R/zoom/ZoomCard.tsx:186-207`, `:355` | |
|55| Zoom | Meldungsbereich (info, warnung, fehler; mit Detail in Monospace): in jedem Zustand, bis quittiert; die Knöpfe je Fall aus `zoomKnoepfe` | `a.meldung`, `zoomKnoepfe` | Win | `R/zoom/ZoomCard.tsx:358-403`, `src/shared/zoom-text.ts:566-599` | |
|56| Zoom | „Erneut beitreten“ (folgenreich): in Z13 mit gemerkten Daten und in Z2 nach der Meldung „Meeting beendet“; Beitritt mit Nummer und Kenncode aus dem Arbeitsspeicher; kein Verb. Simuliert gemessen x 296–400, y 317–342 (Z2) bzw. 337–363 (Z13) | `zoomErneut` | Win, Z2, Z13 | `R/zoom/ZoomCard.tsx:363-371` | |
|57| Zoom | „Schließen“ in der Meldung (Z13, Z2 nach Meeting-Ende): Meldung weg, Nummer, Kenncode und gemerkte Daten im Arbeitsspeicher geleert, das Feld „Meeting-Nummer“ leer, danach das gemerkte Meeting neu geholt. Simuliert gemessen x 408–478 | `zoomSchliessen` | Win, Z2, Z13 | `R/zoom/ZoomCard.tsx:372-384` | |
|58| Zoom | „OK“ in jeder anderen Meldung (etwa Ergebnis von „Einrichtung prüfen“): Meldung weg | `zoomMeldungWeg` | Win | `R/zoom/ZoomCard.tsx:385-392` | |
|59| Zoom | „Logordner öffnen“ in einer Meldung mit „Details im Log“. Simuliert gemessen x 486–599 | `zoomLogordner` | Win | `R/zoom/ZoomCard.tsx:393-399` | |
|60| Zoom-Einrichtung | Knopf „Einrichtung“ (nur ohne Mangel): klappt die Einrichtung auf und zu, ungemerkt; auch im Meeting (dann alles gesperrt mit Tooltip S10). Simuliert gemessen x 283–363, y 277–302; im Meeting aufgeklappt rücken „Meeting verlassen“ (y 314 auf 405) und alle Kacheln um 91 nach unten | `setEinrichtungAuf` | Win | `R/zoom/ZoomCard.tsx:406-410` | |
|61| Zoom-Einrichtung | **Zoom-Einrichtung aufgeklappt bei Mangel** (N2b 3.10 R6, Pflicht): solange ein Mangel besteht (Z1a, Z1b), steht die Einrichtung offen im Arbeitsbereich, mit dem Hinweis „Zoom ist gesperrt, bis das Zoom-SDK eingerichtet ist.“; der Knopf „Einrichtung“ fehlt dann. Gemessen im isolierten Profil (Mangel „SDK-Ordner fehlt“) | `kn.einrichtungOffen`, `kn.sperrHinweis` | Win, Z1a, Z1b | `R/zoom/ZoomCard.tsx:183`, `:411-413`, `src/shared/zoom-text.ts:596-597` | |
|62| Zoom-Einrichtung | Zeile „Zoom-SDK: nicht eingerichtet“ bzw. „Zoom-SDK ‹Fassung› eingerichtet“ und Knopf „SDK-Ordner wählen …“ bzw. „Neu wählen …“: Ordnerdialog (Nr. 106), dann prüfen und kopieren; gesperrt außer in Z1a, Z2 ohne Prüfung und Z13 (Tooltip S10). Gemessen x 708–847 bzw. 700–838, y 317–342 | `zoomSdkWaehlen` | Win | `R/zoom/ZoomCard.tsx:414-426`, `src/main/zoom.ts:185-190` | |
|63| Zoom-Einrichtung | „Zoom-SDK laden“: holt beim Launcher die Freigabe `zoom-sdk`, lädt das SDK über den Suite-Proxy (etwa 315 MB nach `%LOCALAPPDATA%`), prüft, entpackt, kopiert; gesperrt wie Nr. 62. Gemessen x 855–965 bzw. 846–957 | `zoomSdkLaden` | Win | `R/zoom/ZoomCard.tsx:427-435`, `src/main/zoom/kern.ts:1031-1045` | |
|64| Zoom-Einrichtung | Ladezeile („Zoom-SDK wird geladen … n von m MB“, „wird geprüft …“, „wird entpackt …“) mit „Abbrechen“ (bis zum Entpacken) und Balken für Download und Kopie; S17 „Laden abgebrochen …“ grau, andere Texte rot. Simuliert gemessen: „Abbrechen“ x 880–957, y 350–376 | `sdkLadenZeile`, `zoomSdkLadenAbbrechen`, `sdkBalken` | Win, Z1b | `R/zoom/ZoomCard.tsx:438-456` | |
|65| Zoom-Einrichtung | Zeile „Zoom-Anmeldung“ (ZA1 bis ZA11) aus dem Main; gemessen ZA4 „Zoom-Anmeldung über den Launcher; die Freigabe holt Connect beim ersten Beitritt.“ | `a.einrichtung.anmeldung` | Win | `R/zoom/ZoomCard.tsx:458`, `src/main/zugang/regeln.ts:317-338` | |
|66| Zoom-Einrichtung | Übergangszeile „Alter SDK-Schlüssel: hinterlegt, nur noch im Übergang.“ bzw. „SDK-Schlüssel: aus der Umgebung“ mit „Entfernen“ (nur hinterlegt oder Sitzung), ohne Rückfrage. Simuliert gemessen x 886–957, y 393–418 | `zoomSdkSchluesselLoeschen` | Win | `R/zoom/ZoomCard.tsx:459-474` | |
|67| Zoom-Einrichtung | Übergangszeile der alten Zugangsdaten (ZU1, ZU3, A4, A6) mit „Entfernen“ (hinterlegt, Sitzung oder unlesbar) und einem Fehlertext darunter, ohne Rückfrage. Simuliert gemessen x 886–957, y 430–456 | `zoomZugangLoeschen` | Win | `R/zoom/ZoomCard.tsx:475-496` | |
|68| Zoom-Einrichtung | „Einrichtung prüfen“ bzw. „Prüfe …“ (nur Z2): startet die Bridge, meldet sich bei Zoom an, beendet sie, ohne Meeting; Ergebnis als Meldung. Simuliert gemessen x 296–415, y 393–419 | `zoomPruefen` | Win, Z2 | `R/zoom/ZoomCard.tsx:497-505`, `src/main/zoom/kern.ts:1556-1570` | |
|69| Zoom-Beitritt | Feld „Meeting-Nummer“ (Z2, Z13; vorgefüllt mit der gemerkten Nummer, wenn das Feld leer ist). Simuliert gemessen x 283–506, y 334–364 | `setNummer`, `holeLetztes` | Win, Z2, Z13 | `R/zoom/ZoomCard.tsx:145-167`, `:518-527` | |
|70| Zoom-Beitritt | Feld „Kenncode“ (Passwort): leer bei gleicher Nummer gilt der gemerkte Kenncode (Platzhalter „Kenncode gespeichert“ bzw. „Kenncode für diese Sitzung gemerkt“), darunter ggf. „Kenncode gilt nur für diese Sitzung …“; nach „Beitreten“ geleert | `setKenncode`, `kenncodePlatzhalter` | Win, Z2, Z13 | `R/zoom/ZoomCard.tsx:528-541` | |
|71| Zoom-Beitritt | Feld „Anzeigename in Zoom“ (Vorgabe „JM Connect“, 1 bis 64 Zeichen, beim Beitritt gespeichert) | `setAnzeigename` | Win, Z2, Z13 | `R/zoom/ZoomCard.tsx:542-550` | |
|72| Zoom-Beitritt | „Beitreten“ (folgenreich, gelb): Beitritt über die Bridge, Kenncode geht nur hier in den Main; gesperrt, solange „Einrichtung prüfen“ oder „Vergessen“ läuft; kein Verb (Spec: kein Beitritt per Fernsteuerung). Simuliert gemessen x 283–348 bzw. 291–357 (ohne Bildlaufleiste), y zwischen 372 und 1236 je nach Zustand | `beitreten`, `zoomBeitreten` | Win, Z2, Z13 | `R/zoom/ZoomCard.tsx:239-246`, `:552-554`, `src/main/zoom/kern.ts:1609-1650` | |
|73| Zoom-Beitritt | „Vergessen“ (Tooltip „Gemerkte Meeting-Nummer und Kenncode löschen“): nur mit gemerkter Nummer oder nach einem gescheiterten Vergessen; leert Felder und Gemerktes. Simuliert gemessen x 369–441, y 372–397 | `vergessen`, `zoomVergessen` | Win, Z2, Z13 | `R/zoom/ZoomCard.tsx:256-267`, `:555-565` | |
|74| Zoom-Beitritt | Antwort am Ort „beitritt“ neben den Knöpfen (rot) | `antwortText('beitritt')` | Win | `R/zoom/ZoomCard.tsx:566` | |
|75| Zoom | „Meeting verlassen“ (folgenreich, Z3 bis Z11): ohne laufende Slots sofort; mit n laufenden Slots wird es beim ersten Klick rot „Ja, verlassen (n Slots laufen)“, der zweite verlässt; kein Verb (Tray „Zoom-Meeting verlassen“, Nr. 170). Simuliert gemessen x 283–399, als Rückfrage 283–451, y 314–340 ohne Raum | `verlassen`, `zoomVerlassen`, `verlassenFrage` | Win, Z3–Z11 | `R/zoom/ZoomCard.tsx:269-276`, `:572-576`, `src/shared/zoom-text.ts:1367-1369` | |
|76| Zoom | „Abbrechen“ (nur Z11): Wiederbeitritt beenden, Nummer und Kenncode bleiben für „Erneut beitreten“. Simuliert gemessen x 407–484, y 314–340 | `zoomAbbrechen` | Win, Z11 | `R/zoom/ZoomCard.tsx:577-585` | |
|77| Zoom | Feld „Bild-Versatz (ms)“ (0 bis 1000, Enter oder Verlassen des Felds übernimmt; ungültig rot mit Q13, nichts gesendet), darunter „bestätigt: n ms“ bzw. „gilt ab dem nächsten Beitritt“, ggf. T92 gelb, und T81. Gemessen x 291–978 bzw. 283–969, y 415–445 ohne Raum | `uebernimmVersatz`, `zoomVersatz` | Win | `R/zoom/ZoomCard.tsx:279-297`, `:590-618` | |
|78| Zoom-Slots | Slot-Bereich (N2b 3.1 Nr. 13 ➕): „Zoom-Slots“, Link „ndi.video“ (T133) und die Zählung T31 „a von 16 Slots · e eingeschaltet · n laufen“. Gemessen: Link x 386–434, y 511–527 ohne Raum | `SlotBereich`, `slotKopfZeile` | Win | `R/zoom/SlotBereich.tsx:146-179` | |
|79| Zoom-Slots | „Slot hinzufügen“ (gelb): legt einen dauerhaften Slot mit den Vorgaben an, auch ohne Meeting; gesperrt bei 16 Slots (Tooltip T32). Gemessen x 304–406 bzw. 296–398, y 538–562 ohne Raum | `zoomSlotAnlegen` | Win | `R/zoom/SlotBereich.tsx:181-189` | |
|80| Zoom-Slots | „Vorgaben …“ klappt die Vorgaben auf (ungemerkt): T77, Auswahl „Auflösung“ (360p, 720p, 1080p) und Schalter „Ton“; jede Änderung wird sofort gesendet. Gemessen: Knopf x 414–497, y 537–563 | `setVorgabenAuf`, `zoomSlotVorgaben` | Win | `R/zoom/SlotBereich.tsx:190-192`, `:223-257` | |
|81| Zoom-Slots | Schalter „Vorschau“ (Vorgabe an): sendet sofort | `zoomVorschauSchalten` | Win | `R/zoom/SlotBereich.tsx:193-204` | |
|82| Zoom-Slots | Schalter „Person im NDI-Namen“ (N2b 3.1 Nr. 15 ➕, #287; Vorgabe aus, langer Tooltip): sendet sofort, gilt ab dem nächsten Start eines Teilnehmer-Slots | `zoomPersonImNdiNamen` | Win | `R/zoom/SlotBereich.tsx:205-218` | |
|83| Zoom-Slots | „Sprecher-Einstellungen …“ klappt auf (ungemerkt): drei Optionsfelder für das Sprecher-Signal (sofort gesendet), Feld „Haltezeit“ in Sekunden (Enter oder Verlassen, ungültig T74) mit T73. Gemessen: Knopf x 723–878 bzw. 714–870 | `setSprecherAuf`, `zoomSprecher` | Win | `R/zoom/SlotBereich.tsx:219-221`, `:258-293` | |
|84| Zoom-Slots | Antwort am Ort „slots“, T90 (Einstellungsdatei unlesbar, gesichert), T92 (nur für diese Sitzung) und T30 „Noch keine Slots …“ | `AntwortZeile`, `EINSTELLUNG_TEXT` | Win | `R/zoom/SlotBereich.tsx:294-298` | |
|85| Zoom-Slots | Kacheln: nach Nummer, zwei Spalten ab 34rem Breite des Bereichs (Container-Query), sonst eine; je Kachel Kopf „n · ‹NDI-Name›“ mit Modus-Kennzeichen. Gemessen bei beiden Größen zwei Spalten | `SlotKachel` | Win | `R/zoom/SlotBereich.tsx:300-306`, `R/zoom/SlotKachel.tsx:99-104` | |
|86| Zoom-Slots | Kennzeichen T96 „vorübergehend“ bzw. T96b „nur dieses Meeting an“ mit Tooltip und Knopf „Behalten“ (macht den Slot dauerhaft) | `slotKennzeichen`, `zoomSlotBehalten` | Win | `R/zoom/SlotKachel.tsx:105-118` | |
|87| Zoom-Slots | „Start“ (gelb) bzw. „Stopp“ je Kachel (folgenreich, N2b 3.3): Start-Taste des Slots, gespeichert; ab dem 6. eingeschalteten Slot die Nachfrage T40 (Nr. 115); Verb `zoom_slot` (Nr. 145). Rechts im Kopf der Kachel; simuliert gemessen in zwei Spalten (1280×860: x 558–607 bzw. 565–607 und 894–944 bzw. 902–944) zwischen y 507 und 2917, bei `scrollTop` 0 nur die erste Kachelreihe sichtbar (Befund 2) | `starte`, `zoomSlotStart` | Win | `R/zoom/SlotKachel.tsx:119-127` | |
|88| Zoom-Slots | Vorschau 192×108 (Tooltip T52): Bild, letzte Fläche, Ersatzbild-Fläche oder Text T53 bis T57; keine Bedienung (B5, Programmfläche) | `vorschauFlaeche` | Win | `R/zoom/SlotKachel.tsx:129-142`, `R/zoom/slot-vorschau.ts:67-92` | |
|89| Zoom-Slots | Zeilen der Kachel aus dem Kern: Zustand (T10 bis T29), Messung (T50, T51), Ton (T58, T75, T76), Fehler, NDI-Namenswarnung T46 | `lage.text`, `messText`, `tonText`, `fehler`, `ndiWarnung` | Win | `R/zoom/SlotKachel.tsx:143-147` | |
|90| Zoom-Slots | „Welche Person?“ bei Doppelname oder Zweifel: je Kandidat ein Knopf mit Hinweis; wählt die Person für diese Sitzung | `zoomSlotPerson` | Win | `R/zoom/SlotKachel.tsx:148-165` | |
|91| Zoom-Slots | „Einstellungen“ je Kachel klappt die Felder auf (ungemerkt, je Kachel) | `setEinstellungenAuf` | Win | `R/zoom/SlotKachel.tsx:168-171` | |
|92| Slot-Einstellungen | Feld „NDI-Name“: gesperrt, solange der Slot an ist (Tooltip T35) oder stoppt; Enter oder Verlassen übernimmt | `zoomSlotAendern({ ndiName })` | Win | `R/zoom/SlotEinstellungen.tsx:107-123` | |
|93| Slot-Einstellungen | „Modus“: drei Knöpfe Teilnehmer, Aktiver Sprecher, Bildschirmfreigabe (gewählter gelb); sendet sofort | `zoomSlotAendern({ modus })` | Win | `R/zoom/SlotEinstellungen.tsx:124-133` | |
|94| Slot-Einstellungen | Feld „Person“ (nur Teilnehmer, Platzhalter T48, Vorschläge aus der Teilnehmerliste, freie Eingabe): Enter oder Verlassen übernimmt | `zoomSlotAendern({ person })` | Win | `R/zoom/SlotEinstellungen.tsx:134-156` | |
|95| Slot-Einstellungen | Auswahlen „Auflösung“, „Ersatzbild“ (je Modus erlaubte Werte), „Bildformat“ (Original, 16:9 einpassen; bei Freigabe gesperrt mit Hinweis): jede Wahl wird sofort gesendet | `zoomSlotAendern` | Win | `R/zoom/SlotEinstellungen.tsx:157-204` | |
|96| Slot-Einstellungen | Schalter „Ton“, Tonart „Mischton“ und „Person“ (Person nur im Modus Teilnehmer), „Computerton der Freigabe“ (nur Freigabe), „Teilnehmer ohne Kamera zeigen“ (nur Sprecher); sofort gesendet | `zoomSlotAendern` | Win | `R/zoom/SlotEinstellungen.tsx:205-232` | |
|97| Slot-Einstellungen | „Löschen“ (rot): gesperrt, solange der Slot an ist (T36) oder stoppt; öffnet die Rückfrage T37 in der Kachel mit „Löschen“ und „Abbrechen“ (Nr. 114). Simuliert gemessen in Kachel 1 (Z2): „Löschen“ x 317–378, y 1183–1207, die Rückfrage-Knöpfe darunter y 1263–1289 | `setLoeschFrage`, `zoomSlotLoeschen` | Win | `R/zoom/SlotEinstellungen.tsx:233-256` | |
|98| Zoom-Teilnehmer | Teilnehmerliste (ohne eigene Zeile; Host und Co-Host zuerst): Name, Kennzeichen „Host“, „Co-Host“, „Kamera aus“, „keine Kamera“, „im Warteraum“, „Name doppelt“ (rot); Antwort und Nachfrage je Zeile | `zeile` | Win | `R/zoom/ZoomCard.tsx:301-323`, `:624` | |
|99| Zoom-Teilnehmer | „Als Slot laden“ (T38, gelb): legt für die Person einen Slot an und schaltet ihn ein; nur im Meeting, gesperrt im Warteraum (Tooltip T98 am Rahmen); sonst statt des Knopfs T39 bis T39d („läuft in Slot …“, „Slot n ist an …“) | `TeilnehmerSlotAngabe`, `zoomSlotAusPerson` | Win, Z6–Z9b | `R/zoom/SlotBereich.tsx:59-86`, `src/shared/zoom-text.ts:1165-1176` | |
|100| Zoom | „Messwerte“ klappt auf (ungemerkt): der Text des Kerns T61 bis T69 ohne Namen, neu geholt bei jeder Änderung; „Messwerte kopieren“ (Zwischenablage, 1,5 s T68). Gemessen: Knopf x 291–368 bzw. 283–359, y 616–642 ohne Raum, bei 980×640 unter dem Rand | `Messwerte`, `zoomMesswerteText` | Win | `R/zoom/Messwerte.tsx:13-78` | |
|101| Zoom | „Hinweise“: die letzten 5 (Fernsteuerung F1 bis F14, Ton-Überlauf, Wiederbeitritt) | `a.hinweise` | Win | `R/zoom/ZoomCard.tsx:632-641` | |
|102| Zoom | Fußzeile der Karte: „Zoom-Quellen haben kein Tally, kein Talkback und kein Mix-Minus — das sind Grenzen von Zoom.“ und „Logordner öffnen“. Gemessen x 864–978 bzw. 856–969, y 667–692 ohne Raum | `FUSSZEILE`, `zoomLogordner` | Win | `R/zoom/ZoomCard.tsx:644-652` | |
|103| Fußzeile | **Pflicht-Fußzeile** (N2b 3.1 Nr. 27 ➕, E35, E55, LP3, LP5): T134 „NDI® is a registered trademark of Vizrt NDI AB.“ links, rechts „Logordner öffnen“ und „Lizenzbedingungen“ (öffnet nur LIZENZ.txt im Paket); immer gerendert, scrollt mit. Gemessen: Knöpfe x 755–866 und 874–995 bzw. 597–707 und 715–836, y 754–775 ohne Raum; bei 980×640 schon ohne Raum unter dem Rand | `Fusszeile`, IPC `jmc:logordner`, `jmc:lizenz` | St | `R/App.tsx:546`, `:917-927`, `src/main/ipc.ts:136-137` | |
|104| Fußzeile | T143 neben einem Öffnen-Knopf, wenn das letzte Öffnen an dieser Stelle scheiterte (Logordner, Lizenz, ndi.video); der Knopf bleibt bedienbar. Simuliert gemessen an der Fußzeile: die Knöpfe rücken in eine zweite Reihe (y 778–799 statt 754–775), „Logordner öffnen“ springt nach links (x 275–385), „Lizenzbedingungen“ bleibt rechts | `OeffnenKnopf`, `oeffnenMeldung` | St | `R/zoom/SlotBereich.tsx:94-131`, `src/shared/ndi-text.ts:214-226` | |


## 2 · Dialoge und Meldungen

| Nr. | Bereich | Element | Handler/IPC | Zustand (sichtbar/aktiv) | heute wo | künftig wo |
|---|---|---|---|---|---|---|
|105| Dialog | Kein `window.confirm`, kein `window.alert`, kein `window.prompt` in der Oberfläche (gemessen: 0 Aufrufe); Rückfragen stehen als Zeilen in der Seite (Nr. 113, 114, 115) | – | – | `R/App.tsx:1-968`, `R/zoom/ZoomCard.tsx:1-655` | |
|106| Dialog | Systemdialog „Ordner wählen“ für das Zoom-SDK (ein offener Dialog genügt, ein Doppelklick öffnet keinen zweiten); abgebrochen ändert nichts | `dialog.showOpenDialog`, `waehlePfad` | Win | `src/main/zoom.ts:85-95`, `:185-190` | |
|107| Meldung | Fehler von „Raum öffnen“ im Fehlerfeld (Nr. 23): CZ7 „Raum öffnen nicht möglich: ‹Grund›“ mit den Gründen CG1 bis CG10 (etwa „Kein Launcher mit Anmeldung gefunden …“), CZ8 Raum vergeben (mit Raum-ID und Admin-Weg), CZ9 Freigabe abgelehnt, „Raum öffnen fehlgeschlagen (Proxy n).“, „Cloud-Proxy nicht konfiguriert (…)“; nach einem Fehler ist „Raum öffnen“ wieder bedienbar. Simuliert gemessen mit CZ7 und CG1 | `openRoom` (catch), `openRoom` im Main | oR | `R/App.tsx:204-209`, `src/main/room.ts:57-86`, `src/main/zugang/regeln.ts:188-232` | |
|108| Meldung | Fehler von „Link erzeugen“ („Kein offener Raum.“), „Sprecher einladen“ und „Raum schließen“ im selben Fehlerfeld | `setError` | C | `R/App.tsx:217-225`, `:228-240`, `:259-263` | |
|109| Meldung | Wachhund T146 „Keine Verbindung zum Raum „‹Raum›“. Adresse und Cloud-Zugang prüfen — im Hintergrund wird weiter versucht.“ 8 s nach „Raum öffnen“ ohne `onOpen`; verschwindet mit der Verbindung, mit „Raum schließen“ und beim Raumabbruch, andere Fehler bleiben stehen | `watchdogRef`, `wachhundWeg` | C | `R/App.tsx:53-72`, `:197-203` | |
|110| Meldung | T143 „… ließ sich nicht öffnen: ‹Pfad›“ neben Logordner, Lizenz oder ndi.video, wenn das System das Öffnen ablehnt (Nr. 104); dazu eine Logzeile | `oeffnenMeldung`, `meldeOeffnen` | St | `src/shared/ndi-text.ts:69-71`, `src/main/ipc.ts:61-65` | |
|111| Meldung | Abgelehnte Zoom-Aufrufe (`ZoomErgebnis.text`) erscheinen am Ort des Aufrufs: unter der Statuszeile, in der Einrichtung, am Beitritt, an einer Teilnehmerzeile, an einer Kachel oder im Kopf der Slots (etwa T32, T35, T36, Q2, N0, Mängel); leere Texte zeigt die Karte nicht. Simuliert gemessen an der Karte, am Beitritt, an Kachel 3 und im Kopf der Slots | `fuehreAus`, `antwortText` | Win | `R/zoom/ZoomCard.tsx:186-207`, `:230`, `R/zoom/SlotKachel.tsx:17-20` | |
|112| Meldung | Meldungen des Kerns im Meldungsbereich (Nr. 55), etwa Meeting beendet (Warnung), Ergebnis von „Einrichtung prüfen“ (Info oder Fehler), endgültige Fehler mit Detail; simuliert gemessen Warnung, Info und Fehler | `a.meldung` | Win | `R/zoom/ZoomCard.tsx:358-403` | |
|113| Rückfrage | Verlassen mit laufenden Slots: erster Klick macht aus „Meeting verlassen“ den roten Knopf „Ja, verlassen (n Slots laufen)“ (T80), zweiter verlässt; fällt weg, wenn Verlassen nicht mehr geht | `verlassenFrage` | Win, Z3–Z11 | `R/zoom/ZoomCard.tsx:180-182`, `:269-276` | |
|114| Rückfrage | Löschen eines Slots: T37 „Slot n „‹Name›“ löschen? Seine Einstellungen gehen verloren.“ mit „Löschen“ und „Abbrechen“ in der Kachel | `loeschFrage`, `loeschenFrage` | Win | `R/zoom/SlotEinstellungen.tsx:238-256`, `src/shared/zoom-text.ts:1108-1110` | |
|115| Rückfrage | Nachfrage ab dem 6. eingeschalteten Slot: T40 am Ort des Aufrufs (Kachel oder Teilnehmerzeile) mit „Trotzdem einschalten“ (T41, wiederholt den Aufruf mit Zustimmung) und „Abbrechen“ (T42). Simuliert gemessen an Kachel 10 und an einer Teilnehmerzeile | `NachfrageZeile`, `starte` | Win | `R/zoom/SlotKachel.tsx:23-39`, `R/zoom/ZoomCard.tsx:329-335` | |
|116| Tooltip | Tooltips am Rahmen gesperrter Knöpfe (Chromium gibt gesperrten Knöpfen keine Mausereignisse): S10 an Einrichtung und Laden, T32 an „Slot hinzufügen“, T35 am NDI-Namen, T36 an „Löschen“, T98 an „Als Slot laden“ | `MitTooltip` | Win | `R/zoom/ZoomCard.tsx:82-89`, `R/zoom/SlotEinstellungen.tsx:42-48` | |
|117| Meldung | Bild-Versatz ungültig: Feld rot und Q13 „Bild-Versatz: erlaubt sind ganze Zahlen von 0 bis 1000 ms.“, nichts gesendet; Haltezeit ungültig: T74. Simuliert gemessen (Q13) | `versatzFehler`, `haltezeitFehler` | Win | `R/zoom/ZoomCard.tsx:279-286`, `:617`, `R/zoom/SlotBereich.tsx:158-169`, `:291` | |
|118| Stille Fehler | Ohne Raumverbindung tun Talkback, Folien und Gast-Tasten nichts (kein Senden, kein Audit), die Knöpfe sind gesperrt ohne Grund; ein Steuerbefehl ohne Raumverbindung verpufft ohne Meldung (abgeleitet, `send` prüft nur `clientRef`) | `verbundenRef`, `send` | oR, oV | `R/App.tsx:74-95`, `:304-305` | |
|119| Stille Fehler | Ein Folien-Cue eines Gasts ohne gefundenen JM Presenter steht nur im Log („Folien-Cue ohne Empfänger …“); die Oberfläche zeigt es nur als Tooltip am 📊 | `slideCue` | V | `src/main/ipc.ts:174-179`, `R/App.tsx:503-507` | |
|120| Stille Fehler | Talkback-Mikro nicht verfügbar: nur eine Zeile im Peer-Log („FEHLER Talkback-Mikro nicht verfügbar“), keine Anzeige (N2b 3.1 Nr. 32 ➕) | `ensureTalkbackMic` | Peer | `src/renderer/src/peer.tsx:775-794` | |
|121| Protokoll | Audit-Zeilen ins Laufzeit-Log: Talkback an und aus (Bedienfeld und Steuerprotokoll), Folien erteilt und entzogen (mit Gast-ID), Provisionierung, Raumabbruch; Folien-Cues mit Richtung und Anzahl der Presenter | `window.jmconnect.audit`, IPC `jmc:audit` | V | `R/App.tsx:87`, `:94`, `:102`, `:189`, `:236`, `:282`, `:292`, `src/main/ipc.ts:165-179` | |


## 3 · Abläufe ohne eigenes Bedienelement (im Renderer, im Hauptprozess und an der Fernsteuerung)

| Nr. | Bereich | Element | Handler/IPC | Zustand (sichtbar/aktiv) | heute wo | künftig wo |
|---|---|---|---|---|---|---|
|122| Raum | Raum-WebSocket: „Raum öffnen“ legt einen `SignallingClient` an und verbindet; `welcome` und `state` setzen den Raum-Zustand (autoritativ vom Raum) und melden den Raum-Teil des STATE; der Client verbindet bei Misserfolg still und endlos neu (abgeleitet) | `openRoom`, `handleMessage` | C | `R/App.tsx:123-150`, `:152-215` | |
|123| Raum | NDI-Effekte des Raums: `ndi` mit `up` bzw. `down` je Quelle (Kamera oder Bildschirm eines Gasts) startet bzw. beendet im Main einen NDI-Sender (Nr. 155); nur dieser Weg startet einen Sender | `handleMessage`, IPC `jmc:ndi-up`, `jmc:ndi-down` | V | `R/App.tsx:142-147`, `src/main/ipc.ts:148-154` | |
|124| Raum | Folien-Cue eines freigegebenen Gasts (`cue` mit Richtung) geht an jeden gefundenen JM Presenter als `PRESENTER NEXT` bzw. `PRESENTER PREV` (Nr. 161) | IPC `jmc:slide-cue`, `slideCue` | V | `R/App.tsx:139-141`, `src/main/presenter-link.ts:84-93` | |
|125| Raum | Raumabbruch (E57, N2b 3.1 Nr. 7 ➕): schließt der Raum die Verbindung und ist die Anmeldung von Connect (8 Stunden ab „Raum öffnen“) abgelaufen, gibt der Client auf: kein Client, Raumabbruch gesetzt, Wachhund weg, Audit „raumabbruch“; ein spätes Schließen eines ersetzten Clients zählt nicht | `onClose`, `raumAbbruch` | C | `R/App.tsx:175-190`, `src/shared/raum-ansicht.ts:57-59`, `src/main/room.ts:20` | |
|126| Raum | Raum-Folge (OE3): „Raum schließen“ (Knopf und Tray) wartet auf ein laufendes „Raum öffnen“ und überholt es nie; ein zweiter Klick auf „Raum öffnen“ während des Öffnens tut nichts | `erzeugeRaumFolge`, `openingRef` | oR, C | `R/App.tsx:49`, `:155-159`, `src/shared/raum-ansicht.ts:74-92` | |
|127| Raum | Raum im Main: Raum-ID aus der Show oder zufällig (8 Zeichen), Freigabe `connect-raum` beim Launcher (sonst der alte Proxy-Key), POST an den Suite-Proxy, Secret verschlüsselt gemerkt (Nr. 186), Operator-Token 8 Stunden; danach Peer verbinden und Programm-Empfang starten (Nr. 156); „Raum schließen“ löscht den Raum in der Cloud und verwirft das Secret | `openRoom`, `closeRoom`, `peerConnectInfo` | Main | `src/main/room.ts:57-166`, `src/main/raum-id.ts:6-10`, `src/main/ipc.ts:92-120` | |
|128| Fernsteuerung | STATE, Raum-Teil (N2b 3.1 Nr. 5): `room`, `guests` (ohne verlassen und entfernt), `lobby`, `onair` (Anzahl), `active_label` (erster Gast auf Sendung), `standby`, `standby_label`, `talkback` (1/0); bei jedem Raum-Zustand vom Renderer gemeldet. Die Variable `connected` aus der Capability-Liste meldet niemand (Befund 13) | `pushControlState`, IPC `jmc:control-state` | V, Fs | `R/App.tsx:108-121`, `src/main/control-state.ts:12`, `packages/suite-control-protocol/src/capabilities.ts:659-668` | |
|129| Fernsteuerung | STATE aus drei Teilen (N2b 3.1 Nr. 5 ➕ Zoom- und NDI-Werte; Raum vom Renderer, Zoom von der Zoom-Hülle, NDI von der NDI-Lage), jeder Push ersetzt nur seinen Teil; Zoom-Teil `zoom_status`, `zoom_sources`, `zoom_live`, `zoom_privilege`, `zoom_alarm`, `zoom_cmd`, `zoom_cmd_rejected` und je Slot `zoom_slot{n}_on/_live/_alarm/_audio/_mode/_target/_state` (nur Windows); NDI-Teil `ndi_sources`, `ndi_failed`, `ndi_program`, `ndi_alarm` | `erzeugeStateSpeicher`, `aenderungsMelder` | Main, Fs | `src/main/control-state.ts:34-70`, `src/main/control-server.ts:59-71`, `src/main/zoom.ts:69-79` | |
|130| Fernsteuerung | Steuerserver: TCP Port 8737 fest, Namensraum `connect`, startet bei jedem Programmstart, offen oder gesichert nach „control.json“ der Suite, nach erfolgreichem Start per mDNS als `jm-connect-ctl` mit `ctl=1` annonciert; ein Startfehler steht nur im Log. Gemessen: mit belegtem Port „[ERROR] … Steuerserver-Start fehlgeschlagen: listen EADDRINUSE“, die Oberfläche zeigt nichts (N2b 0.2) | `startControlServer`, `SuiteControlServer` | Main, Fs | `src/main/control-server.ts:21-56`, `src/main/index.ts:170-177`, `packages/suite-control-protocol/src/server.ts:192-236` | |
|131| Fernsteuerung | Weiche: Verben mit `zoom_` gehen an die Zoom-Hülle im Main (nie an den Renderer oder den Raum), alle anderen an den Renderer, der sie über die Raum-WebSocket an den Raum schickt | `leiteSteuerbefehl` | Fs | `src/main/control-state.ts:82-85`, `src/main/index.ts:170-176` | |
|132| Fernsteuerung | Verb `go` (Pflicht): „GO — Standby-Gast auf Sendung“, `{ t: 'go' }` an den Raum; kein Knopf (N2b 3.1 Nr. 4 ✏️, C1-A) | `onControlCommand` | V, Fs | `R/App.tsx:295-305`, `packages/suite-control-protocol/src/capabilities.ts:632` | |
|133| Fernsteuerung | Verb `next` (Pflicht): „Nächsten Gast vormerken (Standby)“, `{ t: 'next' }`; kein Knopf | `onControlCommand` | V, Fs | `R/App.tsx:297`, `packages/suite-control-protocol/src/capabilities.ts:633` | |
|134| Fernsteuerung | Verb `onair ‹Gast-ID›` (Pflicht): wie „Auf Sendung“ | `onControlCommand` | V, Fs | `R/App.tsx:299`, `packages/suite-control-protocol/src/capabilities.ts:635` | |
|135| Fernsteuerung | Verb `off ‹Gast-ID›` (Pflicht): wie „Aus Sendung“ | `onControlCommand` | V, Fs | `R/App.tsx:300`, `packages/suite-control-protocol/src/capabilities.ts:636` | |
|136| Fernsteuerung | Verb `approve ‹Gast-ID›` (Pflicht): wie „Freigeben“ | `onControlCommand` | V, Fs | `R/App.tsx:301`, `packages/suite-control-protocol/src/capabilities.ts:637` | |
|137| Fernsteuerung | Verb `kick ‹Gast-ID›` (Pflicht): wie „Entfernen“, ohne Rückfrage | `onControlCommand` | V, Fs | `R/App.tsx:302`, `packages/suite-control-protocol/src/capabilities.ts:641` | |
|138| Fernsteuerung | Verb `standby ‹Gast-ID›` (Pflicht): wie „Standby“, ohne Anzeige in der Oberfläche (Nr. 45) | `onControlCommand` | V, Fs | `R/App.tsx:298`, `packages/suite-control-protocol/src/capabilities.ts:634` | |
|139| Fernsteuerung | Verb `slides ‹Gast-ID› [on, off, toggle]` (Pflicht): Folien-Steuerung; der Modus ist das zweite Argument (Vorgabe toggle, gegen den letzten Raum-Zustand); Audit mit Gast-ID | `onControlCommand` | V, Fs | `R/App.tsx:286-294`, `packages/suite-control-protocol/src/capabilities.ts:640` | |
|140| Fernsteuerung | Verb `talkback [on, off, toggle]` (Pflicht): nur „alle Gäste“ (ein Gast-Ziel gibt es nur am Knopf); toggle gegen den letzten Raum-Zustand; Audit „(Steuerprotokoll)“ | `onControlCommand` | V, Fs | `R/App.tsx:278-284`, `packages/suite-control-protocol/src/capabilities.ts:638` | |
|141| Fernsteuerung | Andere Verben für den Renderer tun nichts; `deny` (Ablehnen), `mute` und ein Gast-Ziel für Talkback gibt es nicht als Verb; ohne Raumverbindung verpufft jedes Verb (Nr. 118) | `onControlCommand` | Fs | `R/App.tsx:295-305` | |
|142| Fernsteuerung | Verb `zoom_load ‹Name›` (Pflicht): nur im Meeting mit Erlaubnis; findet die Person nach normiertem Namen (F2 niemand, F3 mehrdeutig, F4 Warteraum); ist ein Teilnehmer-Slot dieser Person an, nichts; sonst geht der kleinste an (dauerhafter nur für dieses Meeting) oder es entsteht ein vorübergehender Slot (F14 ohne freie Nummer); über 5 eingeschaltete mit F8 | `fernSlotAnlegen` | Win, Fs | `src/main/zoom/fernsteuerung.ts:30-49`, `src/main/zoom/kern.ts:2873-2904` | |
|143| Fernsteuerung | Verb `zoom_unload ‹Name›` (Pflicht): schaltet alle eingeschalteten Teilnehmer-Slots dieser Person aus, vorübergehende verschwinden; ohne Treffer F5 | `fernSlotEntladen` | Win, Fs | `src/main/zoom/fernsteuerung.ts:30-49`, `src/main/zoom/kern.ts:2906-2923` | |
|144| Fernsteuerung | Verb `zoom_delay ‹ms›` (Pflicht): Bild-Versatz 0 bis 1000 ms, sonst F6 | `versatz` | Win, Fs | `src/main/zoom/fernsteuerung.ts:42-44`, `src/main/zoom/kern.ts:2975-2978` | |
|145| Fernsteuerung | Verb `zoom_slot ‹n› on, off, toggle` (Pflicht): Start-Taste des Slots wie an der Kachel; über 5 ohne Nachfrage mit F8 und gesetzter Zustimmung; unbekannte Nummer F9, falscher Wert F13 | `fernSlot` | Win, Fs | `src/main/zoom/fernsteuerung.ts:56-69`, `src/main/zoom/kern.ts:2925-2933` | |
|146| Fernsteuerung | Verb `zoom_slot_mode ‹n› teilnehmer, sprecher, freigabe` (Pflicht): wie „Modus“ an der Kachel; falscher Modus F10 | `fernAendern` | Win, Fs | `src/main/zoom/fernsteuerung.ts:66-69`, `src/main/zoom/kern.ts:2935-2944` | |
|147| Fernsteuerung | Verb `zoom_slot_person ‹n› ‹Name›` (Pflicht): setzt die Person und den Modus Teilnehmer; leerer Name F11 | `fernAendern` | Win, Fs | `src/main/zoom/fernsteuerung.ts:65`, `src/main/zoom/kern.ts:2985-2987` | |
|148| Fernsteuerung | Verb `zoom_slot_audio ‹n› on, off, toggle` (Pflicht): off macht den Slot still und merkt Ton und Computerton, on stellt sie her; F12 warnt bei Person-Ton außerhalb von Teilnehmer | `fernSlotTon` | Win, Fs | `src/main/zoom/fernsteuerung.ts:70-72`, `src/main/zoom/kern.ts:2946-2959` | |
|149| Fernsteuerung | Ergebnis jedes `zoom_*`-Befehls: `zoom_cmd` und `zoom_cmd_rejected` im STATE, der Text als Hinweis in der Karte (Nr. 101), das Log nur mit Kennung und Verb; ohne Kern (macOS) nur eine Logzeile; kein Beitritt per Fernsteuerung | `steuerbefehl`, `zoomSteuerbefehl` | Main, Fs | `src/main/zoom/kern.ts:2961-3000`, `src/main/zoom.ts:347-358` | |
|150| Tray | Tray „Raum schließen“ (E58, Pflicht): schickt `closeRoom` an das Hauptfenster, das dieselbe Funktion wie der Knopf ruft (über die Raum-Folge); ohne Fenster wirkungslos (abgeleitet); aktiv nur bei mindestens einer NDI-Gastquelle (Nr. 169) | `onTrayCommand`, IPC `jmc:tray-command` | Tray | `R/App.tsx:307-310`, `src/main/tray.ts:88`, `src/main/index.ts:184-193` | |
|151| Show | Show-Deep-Link (`jmps://open?show=…`, auch beim Kaltstart): liest Name, Veranstaltung und Sprecher aus der Show-Datei, Raum-ID aus den Einstellungen des Tools oder aus dem Namen (mindestens 6 Zeichen, sonst mit Hash ergänzt); Push an das Fenster, beim Start abgefragt | `handleShowDeepLink`, IPC `jmc:get-show`, `jmc:show-info` | Main | `src/main/show-open.ts:20-62`, `src/main/index.ts:41`, `:183`, `R/App.tsx:271-272` | |
|152| Status | AppStatus: beim Start abgefragt und bei jeder Änderung gepusht (NDI-Lage, Zoom-Kurzform, Presenter-Fund, Zugang, Raum öffnen und schließen); an Fenster und Tray; nur über `baueAppStatus` gebaut | `currentStatus`, IPC `jmc:status` | Main | `src/main/ipc.ts:36-54`, `src/shared/app-status.ts:20-32`, `R/App.tsx:269`, `:273` | |
|153| Zugang | Halter der Freigaben (Anmeldung Teil 2): holt je Zweck (`connect-raum`, `zoom-jwt`, `zoom-sdk`) beim Launcher eine Freigabe, erst bei Bedarf (Raum öffnen, Beitritt, SDK laden), hält und erneuert sie, löscht alte Keys genau einmal; die Zeilen „Cloud-Zugang“ und „Zoom-Anmeldung“ zeigen den Stand | `starteZugang`, `erzeugeZugangsHalter` | Main | `src/main/zugang/huelle.ts:32-58`, `src/main/zugang/halter.ts:49-172`, `src/main/index.ts:98` | |
|154| NDI | NDI-Lage: eine reine Lage für alle Gastquellen und den Programm-Empfang auf der monotonen Uhr, Takt jede Sekunde; jede Änderung geht als Status an Fenster und Tray und als NDI-Teil in den STATE | `erzeugeNdiLage`, `tick` | Main | `src/main/index.ts:105-150`, `src/main/ndi-lage.ts:297-300` | |
|155| NDI | NDI-Gastquellen (N2b 3.1 Nr. 10 ✏️, Nr. 15 ➕): je Quelle ein Utility-Prozess mit einem NDI-Sender, Name vom Raum („JM Connect – ‹Name›“, Bildschirm extra); Neustart bis dreimal, dann „gescheitert“; Bilder kommen vom Peer-Fenster; die Kamera eines Gasts beendet auch seinen Bildschirm | `spinUp`, `gastHandlung`, `tearDown` | Main | `src/main/ndi-guests.ts:47-176` | |
|156| NDI | Programm-Empfang (Rückkanal): bei „Raum öffnen“ ein Utility-Prozess, der die NDI-Quelle „JM Switcher“ sucht (überschreibbar mit `JMPS_PROGRAM_NDI`) und die Bilder an das Peer-Fenster gibt; bei „Raum schließen“ und beim Beenden aus | `startProgram`, `stopProgram` | Main | `src/main/ndi-program.ts:58-88`, `src/main/ipc.ts:96-98` | |
|157| Talkback | Talkback-Weg (N2b 3.1 Nr. 32 ➕): der Raum ist autoritativ; das Peer-Fenster folgt seinem Zustand, öffnet beim ersten Talkback das **Standardmikrofon des Systems** (keine Gerätewahl, danach bleibt es offen) und schaltet es über Gains nur ins Ohr der Ziel-Gäste, nie ins Programm | `applyTalkback`, `ensureTalkbackMic` | Peer | `src/renderer/src/peer.tsx:775-811` | |
|158| Zoom | Ton-Limiter −6 dBFS je Zoom-Slot (N2b 3.1 Nr. 29 ➕) sitzt in der nativen Bridge, ohne Oberfläche; die Pegelzeile steht nur im Log | – | Win | `packages/zoom-bridge/native/audio_limiter.h` | |
|159| Zoom | Zoom-Kern (nur Windows): entsteht beim Start mit der Laufzeit in „%LOCALAPPDATA%\JM Connect\zoom-laufzeit“, prüft dort das SDK (gemessen im isolierten Profil: Mangel „SDK-Ordner fehlt“), startet die Bridge erst bei „Einrichtung prüfen“ oder „Beitreten“; Abbild als Push (höchstens alle 100 ms), Kurzform an Tray, Kopf und STATE | `startZoom`, `erzeugeZoomKern` | Main, Win | `src/main/zoom.ts:97-179`, `src/main/zoom/kern.ts:466-482` | |
|160| Zoom | Wiederbeitritt: verliert Connect das Meeting, versucht es bis zu fünfmal selbst nach 2, 5, 10, 20 und 30 s (Z11 mit Countdown), dann Fehler; Zoom kann vorher selbst neu verbinden (Z10) | `folge`, `abriss` | Main, Win | `src/main/zoom/kern.ts:514-518`, `src/main/zoom/fristen.ts:18`, `src/shared/zoom-text.ts:186-189` | |
|161| Presenter | Folien-Kopplung: sucht schon beim Start per mDNS jeden JM Presenter mit Steuer-Endpunkt (`ctl=1`) im LAN und verbindet sich mit jedem (TCP, offen oder gesichert nach „control.json“); gefunden heißt „📊 Presenter“ (Nr. 31). Gemessen: im isolierten Lauf nur ein verweigerter UDP-Socket (Netzwache), kein Presenter gefunden | `startPresenterLink`, `discover` | Main | `src/main/presenter-link.ts:33-77`, `packages/discovery/src/index.ts:152-201` | |
|162| Laufzeit | Master-Link (N2b 3.1 Nr. 6): der Client läuft im Main (`initAppRuntime`, Abfrage und Ereignis `jmps:master-link` an alle Fenster, auch an das Peer-Fenster); Preload und Renderer lesen ihn nicht; ohne „master-link.json“ untätig | `startMasterLink` | Main | `src/main/index.ts:31-42`, `packages/app-runtime/src/index.ts:386-416` | |
|163| Laufzeit | Anwesenheit beim Launcher: POST an 127.0.0.1:7799 beim Start, alle 10 s und beim Beenden; Fehler verschluckt. Gemessen: 22 Versuche in einem Lauf von 214 s, alle von der Netzwache verweigert, ohne Folgen in der Oberfläche | `startPresence` | Main | `packages/app-runtime/src/index.ts:327-372` | |
|164| Laufzeit | Start: eine Instanz (eine zweite zeigt das vorhandene Fenster), Freigabe nur für das Mikrofon, Rechtsklick-Menü für jedes Fenster, Reihenfolge Zugang, NDI-Lage, Peer-Fenster, IPC, Zoom, Presenter-Link, Steuerserver, Fenster, Tray | `setupSingleInstance`, `whenReady` | Main | `src/main/index.ts:88-197` | |
|165| Laufzeit | Beenden (nur Tray oder Abmeldung): läuft Zoom, wartet `before-quit` höchstens 15 s (`BEENDEN_FRIST_MS`), dass das Meeting verlassen ist; dann NDI-Quellen, Programm, Peer, Steuerserver, Presenter-Link und Tray abgebaut; „window-all-closed“ beendet nie | `before-quit` | Main | `src/main/index.ts:199-224`, `src/main/zoom/fristen.ts:19` | |


## 4 · Zusatzfenster

Connect hat neben dem Hauptfenster das unsichtbare Peer-Fenster, das Tray-Menü und kurz den Ladescreen der Laufzeit (N2b 3.2).
Gemessen: im Lauf zeigte die Seitenliste des Renderers das Hauptfenster, das Peer-Fenster („JM Connect — Peer“, unsichtbar,
801×601) und beim Start den Ladescreen.

### 4a · Peer-Fenster (unsichtbar, bleibt unverändert)

| Nr. | Bereich | Element | Handler/IPC | Zustand (sichtbar/aktiv) | heute wo | künftig wo |
|---|---|---|---|---|---|---|
|166| Peer | Unsichtbares Fenster (`show: false`, `sandbox`, Autoplay ohne Geste, `backgroundThrottling: false`) mit WebRTC zur SFU über den Raum (N2b 3.1 Nr. 22): zieht die Spuren der Gäste und gibt die Bilder an die NDI-Sender, sendet das Programm und je Gast den Rückkanal (Mix-Minus); keine Oberfläche, kein Rahmen; stürzt es ab oder schließt es, gehen alle Quellen auf „gescheitert“ (T119) | `createPeerWindow` | Peer | `src/main/peer-window.ts:18-65`, `src/renderer/peer.html:1-10` | |
|167| Peer | Verbinden erst nach „Raum öffnen“: der Main schickt Raum-WebSocket und ICE-Adresse, der Peer holt die ICE-Daten selbst (ohne sie weiter ohne TURN, nur ein Log) | `PEER_CONNECT` | Peer | `src/renderer/src/peer.tsx:132-160`, `src/main/ipc.ts:94-96` | |
|168| Peer | Diagnose des Peers als Zeilen „[peer] …“ im Log des Mains; Entwicklerwerkzeuge nur mit `JMPS_PEER_DEVTOOLS` im Dev | IPC `jmc:peer-log` | Peer | `src/main/ipc.ts:160-163`, `src/main/peer-window.ts:38-46` | |

### 4b · Tray (bleibt unverändert)

| Nr. | Bereich | Element | Handler/IPC | Zustand (sichtbar/aktiv) | heute wo | künftig wo |
|---|---|---|---|---|---|---|
|169| Tray | Menü (N2b 3.1 Nr. 30 ➕): Gäste-Zeile (T129 bis T131, ohne Quelle „○ Gäste: keine NDI-Quelle“ bzw. „△ Gäste: Cloud nicht eingerichtet“), Zoom-Zeile (wie im Kopf, nur Windows), Trenner, „Fenster anzeigen“, „Raum schließen“ (aktiv nur bei mindestens einer NDI-Gastquelle, auch ausgefallen; Nr. 150), „Zoom-Meeting verlassen“ (nur Windows, aktiv in Z3 bis Z11), Trenner, „Beenden“; Startwert vor dem ersten Status „nichts gemessen“ | `rebuild`, `gaesteZeile`, `zoomZeile` | Tray | `src/main/tray.ts:79-100`, `src/shared/zoom-text.ts:282-363` | |
|170| Tray | „Zoom-Meeting verlassen“: wirkt immer als Verlassen (ohne Rückfrage, auch mit laufenden Slots) | `zoomVerlassen` | Tray, Win | `src/main/tray.ts:90-96`, `src/main/zoom.ts:330-335` | |
|171| Tray | „Beenden“: der einzige Weg aus dem Programm (außer der Abmeldung von Windows), Nr. 165 | `onQuit` | Tray | `src/main/tray.ts:97`, `src/main/index.ts:188-191` | |
|172| Tray | Symbol und Tooltip „JM Connect — Zuschaltungen aktiv · NDI-Ausfall · Zoom-Verbindung unterbrochen …“; Klick und Doppelklick zeigen das Fenster; unter macOS ein Vorlagenbild | `trayTooltip`, `trayBild`, `showWindow` | Tray | `src/main/tray.ts:29-65`, `src/shared/zoom-text.ts:341-352` | |

### 4c · Ladescreen und „Über JM Connect“

| Nr. | Bereich | Element | Handler/IPC | Zustand (sichtbar/aktiv) | heute wo | künftig wo |
|---|---|---|---|---|---|---|
|173| Ladescreen | Ladescreen der Laufzeit (440×260, ohne Rahmen, „JM Connect wird geladen…“) bis das Hauptfenster bereit ist (mindestens 700 ms, höchstens 15 s); gemessen nur als Seite in der Liste beim Start, ohne Rechteck | `startSplash` | Main | `packages/app-runtime/src/index.ts:430-470` | |
|174| Mac | Unter macOS trägt „Über JM Connect“ im Standardmenü den Markenhinweis T134 (Lizenzpflicht); nicht gemessen | `setAboutPanelOptions` | Mac | `src/main/index.ts:179-180` | |

## 5 · Ausgabe (nur Abgrenzung, bleibt unverändert)

| Nr. | Bereich | Element | Handler/IPC | Zustand (sichtbar/aktiv) | heute wo | künftig wo |
|---|---|---|---|---|---|---|
|175| Ausgabe | Kein Ausgabefenster: die Ausgabe sind NDI-Quellen im lokalen Netz, je Gast Kamera und Bildschirm (Utility-Prozess je Quelle, Nr. 155) und je laufendem Zoom-Slot (in der nativen Bridge); dazu empfängt Connect das Programm per NDI (Nr. 156) und gibt es über das Peer-Fenster an die Gäste. Nichts davon hat eine Oberfläche; gemessen wurde keine Quelle (Netzwache, kein Raum) | `ndi-guest-sender.cjs`, `ndi-program-receiver.cjs` | Main | `src/main/ndi-guests.ts:66-126`, `src/main/ndi-program.ts:96-146`, `electron.vite.config.ts:27-40` | |

## 6 · Tastatur (Pflichtpunkt Spec 10)

| Nr. | Bereich | Element | Handler/IPC | Zustand (sichtbar/aktiv) | heute wo | künftig wo |
|---|---|---|---|---|---|---|
|176| Kürzel | Keine eigenen Kürzel (N2b 3.7): kein `keydown` im Fenster, jede Taste wirkt nur auf das Element mit Fokus | – | St | `R/App.tsx:1-968` | |
|177| Kürzel | Standardmenü (N2b 0.3): kein `setApplicationMenu`, also das Standardmenü von Electron (versteckt, Alt zeigt es): **Strg+R lädt neu, die Raumverbindung fällt** (der Client im Renderer ist weg, der Raum in der Cloud und im Main bleibt offen, Gästeliste, Einladungen, offene Karten und Kenncode-Feld sind leer; abgeleitet); F11 Vollbild; Strg+W schließt das Fenster, das heißt versteckt es ins Tray (Nr. 2); Strg+Umschalt+I Entwicklerwerkzeuge; Strg +/−/0 Zoom; abgeleitet, nicht gemessen | Electron-Standardmenü | St | `src/main/index.ts:1-225` | |
|178| Tasten im Feld | Enter übernimmt in einem Feld (N2b 3.1 Nr. 20 ✏️): Cloud-Adresse (speichert), Beitritt (Formular), Bild-Versatz, Haltezeit, NDI-Name und Person einer Kachel; das Feld „Gast einladen“ reagiert nicht auf Enter (abgeleitet); Verlassen des Felds übernimmt bei Bild-Versatz, Haltezeit, NDI-Name und Person ebenfalls | `onKeyDown`, `onSubmit`, `onBlur` | St, Win | `R/App.tsx:617-619`, `R/zoom/ZoomCard.tsx:511-517`, `:603-606`, `R/zoom/SlotBereich.tsx:283-286`, `R/zoom/SlotEinstellungen.tsx:114-117`, `:143-146` | |
|179| Tasten im Feld | Rechtsklick-Menü in bearbeitbaren Feldern (N2b 3.1 Nr. 20 ➕, #301): Ausschneiden, Kopieren, Einfügen; in allen Fenstern | `kontextMenueVorlage` | St | `src/main/index.ts:86-93`, `src/main/kontextmenue.ts:9-19` | |
|180| Tasten auf Knöpfen | Leertaste und Enter lösen den Knopf mit Fokus aus (Standard des Browsers), auch „Raum öffnen“, Gast-Tasten, „Beitreten“, „Meeting verlassen“ und „Start“/„Stopp“; **nicht** Talkback (nur Zeiger, Nr. 35, 40; N2b 3.7); abgeleitet | – | St | `R/App.tsx:741-776` | |
|181| Tasten auf Auswahl und Schaltern | Pfeiltasten auf einer Auswahl und Leertaste auf einem Schalter senden sofort (Wahl ≠ Bewegung betroffen): Vorgaben-Auflösung und -Ton, Vorschau, Person im NDI-Namen, Sprecher-Signal, Auflösung, Ersatzbild, Bildformat, Ton, Computerton, ohne Kamera einer Kachel; abgeleitet | `onChange` | Win | `R/zoom/SlotBereich.tsx:193-271`, `R/zoom/SlotEinstellungen.tsx:157-232` | |
|182| Panel-Tasten | **Panel-Tasten nach O1 (gilt im neuen Aufbau):** Felder behalten ihre Tasten; Leertaste auf einem Knopf oder Schalter im Panel geht ans Tool; Escape im Panel schließt nur das Panel. Heute gibt es kein Panel und keine Kürzel des Tools; das künftige Panel enthält „Fernsteuerung“, „Cloud-Zugang“, „Zoom-Einrichtung“ und „Zoom-Vorgaben“ (B20); Escape bewirkt heute nirgends etwas | – | St | `R/App.tsx:355-548` | |

## 7 · Gemerkte Zustände (Benutzerordner, Suite-Dateien; kein localStorage)

| Nr. | Bereich | Element | Handler/IPC | Zustand (sichtbar/aktiv) | heute wo | künftig wo |
|---|---|---|---|---|---|---|
|183| localStorage | Kein `localStorage`, kein `sessionStorage`, kein `persistId` im Renderer (Pflicht): nichts der Oberfläche wird im Fenster gemerkt | – | – | `R/App.tsx:1-968` | |
|184| Datei | „connect-settings.json“ im Benutzerordner: Proxy-Adresse, alter Proxy-Key (verschlüsselt), alte Zoom-Zugangsdaten und SDK-Schlüssel (verschlüsselt), Zoom-Laufzeit (Ordner, Fassung), Anzeigename, Bild-Versatz, dauerhafte Slots (höchstens 16), Slot-Vorgaben, Sprecher-Einstellungen, Person im NDI-Namen, Vorschau, Zustimmung über 5, letzte Meeting-Nummer und Kenncode (verschlüsselt); unlesbar wird sie beim nächsten Schreiben gesichert (T90), nicht schreibbar gilt ein Wert nur für die Sitzung (T92). Gemessen: im isolierten Profil entsteht die Datei nicht (nichts geändert) | `read`, `write` | Main | `src/main/settings.ts:33-120` | |
|185| Datei | „connect-zugang.bin“ im Benutzerordner: die gehaltenen Freigaben des Launchers, verschlüsselt (safeStorage) | `starteZugang` | Main | `src/main/zugang/huelle.ts:11-58` | |
|186| Datei | „connect-rooms.bin“ im Benutzerordner: Raum-ID → Secret, verschlüsselt; ohne Schlüsselbund nicht gespeichert (dann überleben vorab verteilte Links keinen Neustart); „Raum schließen“ löscht den Eintrag | `saveRoomSecret`, `dropRoomSecret` | Main | `src/main/secrets.ts:18-70` | |
|187| Datei | Zoom-Laufzeit in „%LOCALAPPDATA%\JM Connect\zoom-laufzeit“ (nicht im servergespiegelten Profil, etwa 315 MB) | `startZoom` | Main, Win | `src/main/zoom.ts:99-101` | |
|188| Suite | Suite-Dateien, nur gelesen: „control.json“ (Steuerserver und Presenter-Link, offen oder gesichert), „master-link.json“ (Master-Link); dazu die Laufzeit-Dateien „logs/main.log“ (gemessen: einzige Fehlerzeile der belegte Steuerport), „logs/renderer.log“ (gemessen: entsteht nicht, der Renderer schickt keine Logs) und der Absturzbericht (gemessen: keiner) | `readControlConfig`, `initAppRuntime` | Main | `src/main/presenter-link.ts:36-38`, `src/main/control-server.ts:34-49`, `packages/app-runtime/src/index.ts:386-416` | |
|189| Nicht gemerkt | Raum und Gäste, Client und Verbindung, Einladungen, Fehlerfeld, offene Cloud-Karte, Feld „Gast einladen“, offene Einrichtung, Vorgaben, Sprecher-Einstellungen, Messwerte und Kachel-Einstellungen, Kenncode-Feld, Antworten und Nachfragen; Lage und Größe des Fensters (immer 1280×860) | `useState` | St, Win | `R/App.tsx:31-59`, `R/zoom/ZoomCard.tsx:92-115`, `R/zoom/SlotBereich.tsx:147-151`, `R/zoom/SlotKachel.tsx:78` | |


## 8 · IPC-Übersicht `window.jmconnect` (Preload `src/preload/index.ts`)

Der Preload legt `window.jmconnect` an (Typ `JmConnectApi` in `src/shared/types.ts:328-417`, Deklaration in `R/jmconnect.d.ts`);
gemessen 55 Schlüssel. Keine Master-Link-Funktion, keine Fernsteuerungs-Meldung (beides ergänzt der Umbau, B2). Dasselbe Preload
lädt auch das Peer-Fenster; es reicht dort Frame-Ports, Programm-Port und Verbindungsdaten per `window.postMessage` weiter.

| Funktion | Kanal | Richtung | Wirkung |
|---|---|---|---|
| `platform` | – | – | `process.platform`; entscheidet über Zoom-Karte oder T95 (Nr. 50, 51) |
| `openRoom(room?)`, `closeRoom()` | `jmc:open-room`, `jmc:close-room` | invoke | Raum öffnen bzw. schließen (Nr. 21, 27, 127) |
| `mintGuest(name)`, `mintGuests(names)` | `jmc:mint-guest`, `jmc:mint-guests` | invoke | Join-Links (Nr. 26, 19) |
| `getShow()`, `onShow(cb)` | `jmc:get-show`, `jmc:show-info` | invoke, Ereignis | Show aus dem Deep-Link (Nr. 151) |
| `ndiUp(key, label)`, `ndiDown(key)` | `jmc:ndi-up`, `jmc:ndi-down` | send | NDI-Sender einer Gastquelle (Nr. 123) |
| `pushControlState(kv)` | `jmc:control-state` | send | Raum-Teil des STATE (Nr. 128) |
| `peerLog(msg)`, `audit(event, detail)` | `jmc:peer-log`, `jmc:audit` | send | Logzeilen (Nr. 168, 121) |
| `slideCue(dir, guestId)` | `jmc:slide-cue` | send | Folien an JM Presenter (Nr. 124) |
| `getProxy()`, `setProxy(p)` | `jmc:get-proxy`, `jmc:set-proxy` | invoke | Cloud-Zugang (Nr. 13 bis 17) |
| `getStatus()`, `onStatus(cb)` | `jmc:status` | invoke, Ereignis | AppStatus (Nr. 152) |
| `onTrayCommand(cb)` | `jmc:tray-command` | Ereignis | Tray „Raum schließen“ (Nr. 150) |
| `logordner()`, `lizenz()`, `ndiSeite()` | `jmc:logordner`, `jmc:lizenz`, `jmc:ndi-seite` | invoke | Öffnen mit T143 (Nr. 103, 33, 104) |
| `ndiNeustart(p)`, `programmNeustart()` | `jmc:ndi-neustart`, `jmc:programm-neustart` | invoke | Neustart einer Quelle bzw. des Programm-Empfangs (Nr. 49, 34) |
| `onControlCommand(cb)` | `jmc:control-command` | Ereignis | Verben für den Raum (Nr. 132 bis 141) |
| `zoomGet()`, `onZoom(cb)` | `jmc:zoom-get`, `jmc:zoom` | invoke, Ereignis | Zoom-Abbild (Nr. 159) |
| `zoomSdkWaehlen`, `zoomSdkLaden`, `zoomSdkLadenAbbrechen`, `zoomZugangLoeschen`, `zoomSdkSchluesselLoeschen`, `zoomPruefen` | `jmc:zoom-sdk-waehlen` und folgende | invoke | Einrichtung (Nr. 62 bis 68) |
| `zoomBeitreten`, `zoomVerlassen`, `zoomAbbrechen`, `zoomErneut`, `zoomSchliessen`, `zoomMeldungWeg`, `zoomVersatz` | `jmc:zoom-beitreten` und folgende | invoke | Meeting (Nr. 72, 75, 76, 56, 57, 58, 77) |
| `zoomLetztesMeeting`, `zoomVergessen` | `jmc:zoom-letztes-meeting`, `jmc:zoom-vergessen` | invoke | gemerktes Meeting (Nr. 69, 73) |
| `zoomSlotAnlegen`, `zoomSlotAendern`, `zoomSlotLoeschen`, `zoomSlotStart`, `zoomSlotAusPerson`, `zoomSlotPerson`, `zoomSlotBehalten` | `jmc:zoom-slot-…` | invoke | Slots (Nr. 79 bis 97, 99) |
| `zoomSlotVorgaben`, `zoomSprecher`, `zoomVorschauSchalten`, `zoomPersonImNdiNamen` | `jmc:zoom-slot-vorgaben` und folgende | invoke | Vorgaben und Schalter (Nr. 80 bis 83) |
| `zoomMesswerteText()`, `onZoomVorschauBild(cb)`, `zoomLogordner()` | `jmc:zoom-messwerte-text`, `jmc:zoom-vorschau-bild`, `jmc:zoom-logordner` | invoke, Ereignis | Messwerte, Vorschau, Logordner (Nr. 100, 88, 102) |

Nicht über den Preload: `jmps:master-link` und `jmps:log` (von der Laufzeit registriert, ohne Zugang), die Kanäle zum Peer
(`jmc:peer-frame-port`, `jmc:peer-program-port`, `jmc:peer-connect`), der Steuerserver auf Port 8737, die Suche nach JM Presenter
per mDNS, die Anwesenheit beim Launcher (127.0.0.1:7799) und die Annonce des Steuerservers. Der Kanal `jmc:program-status` ist
definiert, wird aber nirgends benutzt (`src/shared/ipc.ts:34-35`).

## 9 · Einstellungen nach Spec 6 / Anhang A (Zuordnung der Ist-Elemente)

Verben-Übersicht (Pflicht): jedes Verb in jeder Schicht, in der es heute existiert.

| Verb | Oberfläche | Fernsteuerung (`CONNECT …`, Port 8737) | Ziel |
|---|---|---|---|
| GO | – (kein Knopf, C1-A) | `go` (Nr. 132) | Raum |
| Nächster Gast | – | `next` (Nr. 133) | Raum |
| Auf Sendung | „Auf Sendung“ (Nr. 44) | `onair ‹Gast-ID›` (Nr. 134) | Raum |
| Aus Sendung | „Aus Sendung“ (Nr. 46) | `off ‹Gast-ID›` (Nr. 135) | Raum |
| Freigeben | „Freigeben“ (Nr. 42) | `approve ‹Gast-ID›` (Nr. 136) | Raum |
| Ablehnen | „Ablehnen“ (Nr. 43) | – | Raum |
| Entfernen | „Entfernen“ (Nr. 47) | `kick ‹Gast-ID›` (Nr. 137) | Raum |
| Standby | „Standby“ (Nr. 45, ohne Anzeige) | `standby ‹Gast-ID›` (Nr. 138) | Raum |
| Folien | „📊“ je Gast (Nr. 41) | `slides ‹Gast-ID› [Modus]` (Nr. 139) | Raum |
| Talkback | „Talkback alle“ und „🎙“ je Gast, Halten (Nr. 35, 40) | `talkback [Modus]`, nur alle (Nr. 140) | Raum |
| Raum öffnen und schließen | Haupttaste, „Raum schließen“ zweimal (Nr. 21, 22, 27) | – (Tray „Raum schließen“, Nr. 150) | Cloud |
| Zoom: Person als Slot | „Als Slot laden“ (Nr. 99) | `zoom_load ‹Name›` (Nr. 142) | Zoom-Kern |
| Zoom: Slot entladen | „Stopp“ (Nr. 87) | `zoom_unload ‹Name›` (Nr. 143) | Zoom-Kern |
| Zoom: Bild-Versatz | Feld „Bild-Versatz (ms)“ (Nr. 77) | `zoom_delay ‹ms›` (Nr. 144) | Zoom-Kern |
| Zoom: Slot ein/aus | „Start“/„Stopp“ (Nr. 87) | `zoom_slot ‹n› [Modus]` (Nr. 145) | Zoom-Kern |
| Zoom: Slot-Modus | „Modus“ (Nr. 93) | `zoom_slot_mode ‹n› ‹Modus›` (Nr. 146) | Zoom-Kern |
| Zoom: Slot-Person | „Person“ und Wahl bei Doppelname (Nr. 94, 90) | `zoom_slot_person ‹n› ‹Name›` (Nr. 147) | Zoom-Kern |
| Zoom: Slot-Ton | „Ton“ (Nr. 96) | `zoom_slot_audio ‹n› [Modus]` (Nr. 148) | Zoom-Kern |
| Zoom: Beitreten, Verlassen, Erneut beitreten | Knöpfe (Nr. 72, 75, 56) | – (Tray „Zoom-Meeting verlassen“, Nr. 170) | Zoom-Kern |

Weitere Zuordnung (Plan-Block Connect, B19 bis B22):

| Spec-Baustein | Ist-Nr. | Bemerkung |
|---|---|---|
| Rahmen `AppShell`, T145 erste Zeile des Inhalts (B9, B19) | Nr. 5, 8, 9 | heute eigener Kopf mit Untertitel und drei Textzeilen |
| Zwei Spalten ab 56rem: links Cloud-Raum, rechts Zoom; macOS eine Spalte (B19) | Nr. 13 bis 49, 50 bis 102, 51 | heute eine Spalte, Zoom unter dem Raum |
| Pflicht-Fußzeile über volle Breite, immer gerendert (B19) | Nr. 103, 104 | heute im Fluss nach der Zoom-Karte |
| Kennzeichen-Platz je Teilnehmerzeile (B19, W2-6) | Nr. 98 | heute keiner |
| Haupttaste Raum (B21, B6), Sperrgrund aus `status.cloudZugang` bzw. „Cloud-Zugang fehlt“ | Nr. 21, 22 | heute gesperrt ohne Grund; die zweite Taste in der Einladen-Zeile (Nr. 27) entfällt |
| Haupttaste Talkback alle mit Halten (B21, B1, C6-A), Sperrgrund „Raum nicht verbunden“ | Nr. 35 | heute nur Zeiger, ohne `blur` |
| Halte-Knopf je Gast (B21) | Nr. 40 | heute `PttButton` 28×24 |
| Panel: `RemoteControlSection`, „Cloud-Zugang“, „Zoom-Einrichtung“, „Zoom-Vorgaben“ (B20) | Nr. 130, 13 bis 17, 60 bis 68, 80, 82, 83 | heute alles im Arbeitsbereich |
| Mangel der Zoom-Einrichtung als Statuseintrag, der das Panel öffnet (B22) | Nr. 61 | heute offen im Arbeitsbereich |
| Statusleiste: `master-link` | Nr. 162 | heute ohne Preload |
| Statusleiste: `cloud-zugang` | Nr. 13 | Zeile kommt fertig aus dem Main |
| Statusleiste: `raum` | Nr. 11, 20, 125 | heute Kopfzeile „● Raum verbunden“ |
| Statusleiste: `zoom`, `zoom-einrichtung` | Nr. 12, 61 | Windows; Zustände Z1a bis Z13 |
| Statusleiste: `programm`, `presenter` | Nr. 32, 31 | heute in der Kopfzeile der Gästeliste |
| Statusleiste: `ndi-gaeste`, `zoom-slots` | Nr. 38, 169, 78 | heute je Gast und im Tray |
| Statusleiste: `fernsteuerung` | Nr. 10, 130 | heute nur die Konstante 8737 |
| Statusleiste: `gaeste` (`live` bei Gästen auf Sendung) | Nr. 30, 39 | heute Zählung in der Kopfzeile |
| `onAir` nur bei Gästen auf Sendung, sonst keine Anzeige (B3, C5-B) | Nr. 39, 128 | heute keine Kopfanzeige |
| Tray, Peer-Fenster, Ausgabe bleiben (Global Constraints) | Abschnitt 4, 5 | |

## 10 · Befunde für den Umbau (belegt, ohne Wertung als Fehler)

1. **Haupttasten-Plätze, gemessen** (Fenster außen 1282×862, innen 1269×832, bzw. außen 982×642, innen 969×611, Skalierung 1,26;
   Inhalt 720 breit, Kopf y 24–72): „Raum öffnen“ x 275–412 ohne bzw. 266–404 mit Bildlaufleiste (980×640: 125–262 bzw. 116–254),
   y 155–203 ohne Show und Fehler, mit Show 266–552 breit; acht Lagen je Größe in sieben Höhen (y 155, Fehlerfeld 237,
   Raumabbruch 257 bzw. mit Zusatz 277, Show 261, offene Cloud-Karte 281, alter Key 322; bei 155 zwei x-Lagen), in allen 54 Zuständen
   je Größe bei `scrollTop` 0 sichtbar, zweimal gesperrt (keine Adresse, kein Status). „Talkback alle“ 720×44, sieben Lagen zwischen y 257 und 810; bei `scrollTop` 0 nicht
   sichtbar in 2 von 16 Zuständen bei 1280×860 und in 5 von 16 bei 980×640 (mit Show und Einladungen). „Raum schließen“ in der
   Einladen-Zeile x 856–986 (980×640: 706–836), y 175, 257 oder 281. Keine folgenreiche Taste ist abgeschnitten (`scrollWidth`
   nie größer als `clientWidth`, 1 074 folgenreiche Elemente geprüft).
2. **Folgenreiche Tasten wandern mit dem Zustand, gemessen:** Der Inhalt ist ein Block im Fluss; alles unter dem Kopf rückt mit
   Fehlerfeld (+82), offener Cloud-Karte (+126), Show-Karte (+106), Einladungen (zwei Karten +225) und T144 (+102, mit Zusatz +122). Die Gast-Tasten
   stehen je Phase und Abzeichen an drei verschiedenen x-Lagen („Auf Sendung“ x 279, 373 oder 749 bei 1280×860) und zwischen
   y 383 und 1169; in einer Zeile mit Bildschirm-Abzeichen brechen die Gast-Aktionen in eine zweite Reihe. Zoom: „Beitreten“
   y 372–1236, „Meeting verlassen“ y 314–1180, „Erneut beitreten“ y 317–363, „Start“/„Stopp“ der Kacheln y 507–2917 in zwei
   Spalten (x 558–607 bzw. 565–607 und 894–944 bzw. 902–944 bei 1280×860; 408–457 bzw. 415–457 und 744–794 bzw. 752–794 bei
   980×640), davon bei `scrollTop` 0 sichtbar 46 von 172 bzw. 34 von 172. Für die Tastenplatz-Regel heißt „alter Platz“ darum
   die Vereinigung aller Rechtecke je Größe; die JSON enthält 71 Zustände je Größe mit jedem Bedienelement (3 952 Elemente, davon
   1 074 folgenreich).
3. **Eine Bildlaufleiste verschiebt alles, gemessen:** Der Block ist zentriert; scrollt die Seite, rückt der ganze Inhalt um
   8 bis 9 nach links („Raum öffnen“ 275 → 266, „Beitreten“ 291 → 283). Bei 980×640 scrollt schon der Start (799 hoch bei 611
   sichtbar); dort liegen „Messwerte“, die Fußzeile der Zoom-Karte und die Pflicht-Fußzeile (y 754–775) ohne Raum unter dem Rand.
   Beide Größen haben je Zustand dieselben Höhen (der Block ist 768 breit), nur der sichtbare Teil unterscheidet sich.
4. **Live-Elemente unter dem Rand, gemessen:** Mit je Phase einem Gast stehen bei 1280×860 alle 18 folgenreichen Tasten bei
   `scrollTop` 0 im Bild, bei 980×640 13 von 18. Mit Show und zwei Einladungen sind es 9 bzw. 1 von 18 (nur „Raum schließen“), mit
   Zoom im Meeting dazu 9 bzw. 1 von 31; die Zoom-Karte beginnt dann bei y 1067, die Seite ist 4 040 hoch (16 Slots ohne Raum: 3 701).
   Im Meeting ohne Raum sind 4 von 14 folgenreichen Tasten sichtbar („Raum öffnen“, „Meeting verlassen“, die Start/Stopp-Tasten
   der ersten Kachelreihe). Kein Element ist `fixed` oder `sticky`, kein Hinweis liegt über einer Taste.
5. **Abgeschnittene Anzeigen, gemessen:** Das Programm-Abzeichen ist in jedem gemessenen Zustand abgeschnitten, auch das kurze
   „Programm: aus“ (93 breit, zu lesen ist „Programm: …“), ebenso „Programm sucht …“ (105), „Programm-Empfang ausgefallen“ (149)
   und „Programm ● ‹Quelle›“ (200 bzw. 257); der volle Text steht nur im Tooltip (Nr. 32). Die Zeile der Cloud-Karte ist
   im Bild abgeschnitten (Nr. 13). Felder mit langem Wert laufen innen über (Haltezeit, NDI-Name, Person, „Gast einladen“),
   keine Taste.
6. **Standby ohne Anzeige, gemessen:** Mit gesetztem `standbyId` sind Rechtecke, Texte, Gastzeilen und Abzeichen gleich wie ohne
   (Nr. 45); wer im Standby steht, sieht nur Companion über den STATE.
7. **Talkback nur per Zeiger, ohne `blur`:** „Talkback alle“ und „🎙“ je Gast hören nur auf `pointerdown`, `pointerup` und
   `pointercancel` (Zeiger eingefangen); Leertaste und Enter bewirken nichts, ein Fokuswechsel während des Haltens beendet das
   Sprechen nicht (abgeleitet, N2b 3.10 R4). Der Halte-Knopf aus Task 2 bringt Tasten und den Abbruch bei Fensterverlust mit (B1,
   C6-A).
8. **Grenzen der Messung:** echt gemessen sind nur die Zustände ohne Raum (sechs je Größe: Start, Cloud-Karte offen, Messwerte,
   Vorgaben, Sprecher-Einstellungen, alle drei offen); alle 65 übrigen sind simuliert gemessen (Befund 12). **Nicht erreicht:**
   macOS (eine Spalte mit T95, Mac-Tooltips, „Über JM Connect“, Tray-Vorlagenbild; die Messung lief unter Windows); ein echter Raum,
   echte Gäste, echte NDI-Quellen, ein echtes Zoom-Meeting und echte Vorschaubilder (Isolation); der Ladescreen (nur als Seite
   gesehen), das Tray-Menü und der Ordnerdialog (kein Rechteck in der Seite); das Peer-Fenster (unsichtbar). **Erreichbar, aber
   nicht gemessen:** die Zoom-Zustände Z5b, Z7b, Z8 und Z9 (nur Z9b und Z6, Z7 gemessen; anderer Text in derselben Zeile), Z11 mit
   laufendem Countdown (gemessen ohne Zeitpunkt, damit beide Läufe gleich sind), die Ladephasen „link“ und „entpacken“ (nur
   Download und Prüfen gemessen), der Mangel „Laufzeit unvollständig“, eine Antwort am Ort „einrichtung“ und an einer
   Teilnehmerzeile, T74 an der Haltezeit, T68 nach „Messwerte kopieren“, T143 neben „ndi.video“ und in einer Grundzeile (nur an der
   Fußzeile gemessen), die Lösch-Rückfrage im Meeting (nur in Z2), eine Fehler- und eine T75/T76-Tonzeile an einer Kachel, die
   Zugangszeilen außer CZ1, CZ2, CZ4, CZ7 und ZA4, die Tastenwege (Nr. 177 bis 181). Zwei Läufe ergaben dieselben
   Rechtecke (3 952 Element-Vergleiche und 2 118 weitere, 0 Abweichungen).
9. **Netz beim Start, gemessen:** Ohne Raum öffnet Connect selbst Verbindungen: die mDNS-Suche nach JM Presenter (ein UDP-Socket
   auf 5353, danach TCP zu jedem gefundenen Presenter mit `ctl=1`) und die Anwesenheit beim Launcher (127.0.0.1:7799 alle 10 s,
   22 Versuche in 214 s). Im isolierten Lauf hat die Netzwache beides verweigert (ein Socket, 22 TCP-Versuche, 0 Utility-Prozesse,
   0 Kindprozesse); der Steuerserver meldete den belegten Port nur im Log. Jede spätere Echt-Fenster-Messung von Connect (Task 24)
   braucht dieselbe Wache.
10. **Sperren ohne Grund:** „Raum öffnen“ (ohne Adresse oder ohne Status), „Talkback alle“, die Gast-Tasten, 🎙, 📊 und „Link
    erzeugen“ (ohne Raumverbindung), „Sprecher einladen“ (Tooltip nur „Erst den Raum öffnen“) sind gesperrt ohne sichtbaren Grund
    (B21 verlangt ihn für die Haupttasten). Die Zoom-Karte nennt ihre Sperren als Tooltip am Rahmen (S10, T32, T35, T36, T98).
11. **Wahl wirkt sofort:** jede Auswahl und jeder Schalter der Zoom-Slots sendet bei der Änderung, auch per Pfeiltaste (Nr.
    181); Folgenreiches hängt daran nicht (Start/Stopp ist ein eigener Knopf).
12. **Simuliert gemessen** (Stand nur im Renderer gesetzt, 65 Zustände je Größe, zwei Läufe ohne Abweichung): Cloud-Raum mit
    Client, Verbindung, je Phase einem Gast, Talkback alle und an einen Gast, Standby, Einladungen (zwei und drei, „Kopiert ✓“), Show,
    NDI-Lagen (startet, sendet, ohne Bild, Neustart, gescheitert mit und ohne Neustart-Knopf), Programm verbunden, sucht und
    gescheitert, Presenter gefunden, Raumabbruch mit und ohne Raum-Zustand, T141, Fehlerfeld (T146, CZ7), Status fehlt, T143; Zoom
    in Z1a mit einem und zwei Mängeln, Z1b (Download, Prüfen, Kopie), Z2 (zu, aufgeklappt, gemerktes Meeting, alte Werte, Prüfung,
    Meldung Meeting beendet, Info, Antworten, zwei Slots mit Einstellungen und Lösch-Rückfrage, Einstellungsdatei unlesbar), Z3,
    Z4, Z5a, Z6, Z7, Z9b (zwölf Kacheln in allen Zuständen im Meeting, zehn Teilnehmer, Hinweise, Verlassen-Rückfrage, Nachfrage an
    Kachel und Zeile, offene Einstellungen dreier Kacheln, Vorgaben, Sprecher und Messwerte offen, laufende Aufrufe, Einrichtung
    aufgeklappt, 16 Slots, Antworten), Z10, Z11, Z12, Z13 und die Karte vor dem ersten Abbild; dazu drei Kreuzungen voller
    Cloud-Bereich × Zoom. Die Texte der Kacheln folgen den Vorlagen in `src/shared/zoom-text.ts`, die Namen sind erfunden; echte
    Namen und Texte können andere Breiten und Zeilenumbrüche haben. Der eingespielte Stand blieb vom Einspielen bis zum Ende jeder
    Messung stehen (vor und nach jeder Messung geprüft).
13. **Zustände, Verben und Reste:** Die Zoom-Zustände heißen im Code Z0 bis Z13 mit Unterzuständen (Plan und N2b: „Z0–Z11“). Die
    Capability-Variable `connected` (SFU verbunden) meldet niemand (Nr. 128); `deny` (Ablehnen) und `mute` haben kein Verb,
    `mute` auch keinen Knopf; der Kanal `jmc:program-status` ist ungenutzt (Abschnitt 8). Der Tray-Eintrag „Raum schließen“ ist nur
    mit mindestens einer NDI-Gastquelle aktiv, bei offenem Raum ohne Gast also gesperrt (abgeleitet, Nr. 169).
