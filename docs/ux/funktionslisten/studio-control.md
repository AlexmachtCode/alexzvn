# Funktionsliste JM Studio Control (Suite-UX-Update, Welle 2b · Studio-Control)

Zweck (Spec `docs/superpowers/specs/2026-10-08-suite-ux-update-design.md`, Abschnitt 10 „Kein Funktionsverlust“, und
Anhang A „Studio-Control“): jedes Bedienelement mit Handler, jedes Tastaturkürzel, jeder Dialog, jede Fernsteuerungs-Aktion, jedes
Fenster und jede Einstellung von Studio-Control, erhoben **vor dem Umbau** aus dem Code. Nach dem Umbau bekommt jede Zeile in der
Spalte „künftig wo“ einen Haken mit dem Ort im neuen Aufbau; ein Punkt ohne Haken blockiert die Welle.

- **Stand:** erhoben aus dem Code am 2026-11-23, Commit `481c998c08`, Studio-Control 0.6.0 (`package.json`). Die Nachmessung
  `docs/ux/welle2-nachmessung-2b.md` (Abschnitt 2, „N2b“) gilt für `0f589c3ee1`;
  `git diff 0f589c3ee1 481c998c08 -- apps/studio-control` ist leer, `git diff 481c998c08 HEAD -- apps/studio-control/src`
  ebenso (Task 13 brachte nur das Testgerüst unter `test/`, `tsconfig.test.json` sowie in `package.json` die Skripte
  `typecheck:test` und `selftest` und die Abhängigkeit `@jm/settings`; letzter Commit am Quellcode `9b6d952021`, 2026-06-28).
  Zeilennummern gelten für `481c998c08`. Was nur aus dem Code abgeleitet ist, steht als „abgeleitet“, Unklares als „unklar“
  bzw. „nicht gemessen“. Kleine Korrekturen an N2b: `R/views/Video.tsx` reicht bis Zeile 15 (N2b: 13), die Stufen der
  lokalen Pille stehen in `R/components/ui/StatusPill.tsx:6-12` (N2b: 8-14), und die lokale Pille wird 23-mal verwendet, 6-mal mit
  `live` (N2b: „13 Stellen“).
- **Vorher-Messung** (2026-11-23, Plan Task 14, Echt-Fenster-Messung in der weiten Lesart): der gebaute, unveränderte Stand lief in
  einem eigenen Profil (Benutzerordner, `APPDATA` und `LOCALAPPDATA` umgelenkt) mit gehaltenem Steuerport 8735, Anmeldung
  Admin/Admin über die Seite (`JM_STUDIO_DEV_ADMIN=1`); Geräte nur mit TEST-NET-1-Adressen über die Formulare der Seite angelegt
  (TriCaster 192.0.2.12, ATEM 192.0.2.10, OBS 192.0.2.11), dazu ein Scheinwerfer ohne Node, ein Inventargerät und die Benutzer
  „Bediener“ (operator) und „Gast“ (viewer); keine PTZ-Kamera, kein Pult, kein Node, kein Discovery-Lauf. Gemessen per CDP bei
  1400×900 und 1024×640 (Panel zu, ein Panel gibt es heute nicht) in 40 Zuständen je Größe, je Zustand das Rechteck **jedes**
  Bedienelements in Kopf, Reiterzeile, Inhalt und Anmeldekarte. Rohdaten liegen im Ledger der Welle („vorher-studio-control.json“,
  nicht im Repo). Was die Messung belegt, steht in den Zeilen als „gemessen“; die Zahlen stehen in Abschnitt 10 (Befunde 1 bis 7
  und 13).
- **Nachtrag Simulation** (2026-11-23, Controller-Ruling): was ohne Gerät nicht messbar war (PTZ mit Kamera, Licht mit Node und
  Blackout, Audio mit Pult, verbundene Geräte, OBS-Szenen, REC und STREAM aktiv), wurde im selben isolierten Aufbau im echten
  Fenster gemessen, nachdem der Stand **nur im Renderer** gesetzt war (zustand-Store `useApp` aus `R/store/app.ts`, per CDP; kein
  Gerät, kein Node, kein Pult, nichts im Netz): 11 Zustände je Größe, zwei Läufe ohne Abweichung. Diese Zahlen stehen in den
  Zeilen als „simuliert gemessen“ und in Befund 13; in der JSON trägt jeder dieser Zustände `simuliert: true` und den
  eingespielten Stand.
- **Gelesen, vollständig:** alle 34 Dateien unter `R/` (`R/App.tsx`, `R/main.tsx`, `R/globals.css`, `R/vite-env.d.ts`,
  `R/sync/client.ts`, `R/sync/jms.d.ts`, `R/store/app.ts`, `R/store/session.ts`, `R/types/admin.ts`, in `R/views/` Login, Setup,
  Video, Audio, Licht, in `R/components/` AppShell, Topbar, ComingSoon, die vier Dateien in `R/components/ui/`, die acht in
  `R/components/video/`, `R/components/audio/AudioPanel.tsx`, `R/components/lighting/LichtPanel.tsx`, die drei in
  `R/components/setup/`), `src/renderer/index.html`, `src/main/index.ts`, `src/main/server.ts`,
  `src/main/gateway/control-gateway.ts`, `src/preload/index.ts`, alle neun Dateien in `src/shared/` (atem, audio, device,
  lighting, obs, protocol, ptz, roles, tricaster), `package.json`. Ausschnitte: in `src/main/auth/` middleware, bootstrap,
  sessions, users; in `src/main/db/` sqlite, migrate, audit; `src/main/config/store.ts` und in den übrigen Dateien von
  `src/main/config/` nur Dateiname und Speichern; die Treiber nur bis zu den gemeldeten Zuständen
  (`src/main/drivers/tricaster/client.ts`, `src/main/drivers/tricaster/pool.ts`, `src/main/drivers/atem/client.ts`,
  `src/main/drivers/atem/pool.ts`, `src/main/drivers/obs/client.ts`, `src/main/drivers/panasonic-ptz/pool.ts`,
  `src/main/drivers/panasonic-ptz/client.ts`, `src/main/audio/manager.ts`), `src/main/lighting/engine.ts`,
  `src/main/discovery/index.ts`; `packages/app-runtime/src/index.ts` (nur `initAppRuntime`, `startSplash`, `startPresence`,
  `startMasterLink`), `packages/suite-control-protocol/src/capabilities.ts` (nur der Eintrag `studio`, Zeilen 531 bis 597),
  `packages/suite-control-protocol/src/server.ts` (nur Optionen, `resolve` und `start`, Zeilen 100 bis 200),
  `packages/ui/src/components/Card.tsx`. Nicht gelesen: die Discovery-Anbieter (mdns, artpoll, panasonic), die Pult-Adapter,
  `tools/`, die Selbsttests unter `test/`.
- **künftig wo** bleibt leer. Die Spalte wird nach dem Umbau gefüllt und abgehakt.
- **Pfade:** ohne Vorsatz relativ zu `apps/studio-control/` (`src/…`, `package.json`); `R/…` steht für `src/renderer/src/…`;
  `packages/…` und `docs/…` sind relativ zur Repo-Wurzel. Zeilenangaben hinter einer Datei (etwa „:12-34“) gelten für die zuletzt
  genannte Datei im selben Feld. Dateien im Benutzerordner der App (userData) und im Ledger stehen ohne Backticks in „…“, weil sie
  nicht im Repo liegen.
- **Fenster** (N2b 2.2): ein Hauptfenster (Abschnitt 1) mit Anmeldung und Rahmen; dazu das Tray, derselbe Renderer im Browser und
  der Ladescreen der Laufzeit (Abschnitt 4). Ein Ausgabefenster gibt es nicht (Abschnitt 5).
- **Zustands-Kürzel** (Spalte „Zustand (sichtbar/aktiv)“): **An** = Anmeldung (vor dem Login, ohne Rahmen) · **K** = Rahmen
  nach dem Login, in jedem Reiter · **V** = Reiter Video · **Au** = Reiter Audio · **Li** = Reiter Licht · **Se** = Reiter
  Setup mit **Se Inv**, **Se Disc**, **Se Ben** (Unterreiter Inventar, Discovery, Benutzer) · **+I** = mit mindestens einer
  Instanz des Panels, **−I** = ohne · **Sw** = mit mindestens einem Scheinwerfer · **ab Bed** = ab Rolle Bediener (`operator`) ·
  **Adm** = nur `admin` · **El** = nur im Electron-Fenster · **Br** = nur im Browser (ohne `window.jms`) · **Main** =
  Hauptprozess, ohne Oberfläche · **Srv** = eigener Server, Port 7778 · **Gw** = Companion-Gateway, Port 8735 · **Tray** =
  Tray-Menü. Ohne Rollenangabe gilt das Element für jede Rolle.
- **Nummerierung:** fortlaufend 1–195 in den Abschnitten 1–7.
  Zeilen je Abschnitt: 1 = 100, 2 = 25, 3 = 40, 4 = 8, 5 = 1, 6 = 7, 7 = 14; zusammen 195.
  Abschnitt 4 hat drei Teiltabellen (4a Tray 166–169, 4b Browser 170–172, 4c Ladescreen 173).
  Die Abschnitte 8 (IPC-Übersicht), 9 (Zuordnung zu Spec 6 / Anhang A) und 10 (Befunde) haben keine nummerierten Punkte und
  werden nicht abgehakt.
- **Pflichtzeilen** (Plan Task 14, Muster Teil 3):
  - Login-Gate und Socket vor dem Login: Nr. 8 bis 11, 126; Browser-Betrieb: Nr. 170 bis 172; die drei Rollen aus
    `src/shared/roles.ts` mit dem, was sie dürfen: Nr. 131 bis 133, dazu Loopback als Admin Nr. 130.
  - Hauptreihen je Panel mit der heutigen Mindestbreite: TriCaster Nr. 24 bis 28 (`min-w-[120px]`), ATEM Nr. 41 bis 45
    (`min-w-[110px]`), OBS Nr. 52 und 53 (`min-w-[120px]`), Licht-Blackout Nr. 73 (heute `size sm`, ohne Recht oder Node
    ausgeblendet, B16).
  - Geräteformulare Nr. 94 bis 100; jeder `window.confirm` Nr. 101 bis 110, dazu `window.prompt` Nr. 111 und `window.alert` Nr.
    112; stille Befehlsfehler Nr. 120 und 121; `localStorage` der Sitzung Nr. 182; LAN-URLs nur im Tray Nr. 168; englische Reste
    Nr. 7; Panel-Tasten Nr. 181; Standardmenü (N2b 0.3) Nr. 176; Zusatzfenster Tray und Browser in Abschnitt 4.
  - Jede Fernsteuerungs-Aktion als Ablauf: die 16 Verben Nr. 140 bis 155, Zustand Nr. 139, Gateway Nr. 138.
  - Jede Zeile der Nachmessung 2.1 mit ✏️, ❌ oder ➕ hat eine eigene Zeile mit dem heutigen Verhalten und dem Vermerk „N2b 2.1
    Nr. …“ (Nummer der Nachmessung → Zeilen dieser Liste): 6 (❌) → 24 bis 28, 30, 31, 32, 34; 7 (❌) → 69, 70, 73; 14 (➕) → 138;
    16 (➕) → 22, 33, 37, 46, 49, 54, 57, 66, 94 bis 104; 18 (➕) → 14; 19 (✏️) → 6; 22 (➕) → 8, 126; 26 (➕) → 4, 6; 27 (➕) → 21, 36,
    48, 56, 67, 72; 28 (➕) → 120; 29 (➕) → 29; 30 (➕) → 182; 31 (➕) → 168; 32 (➕) → 7.
- **`window.confirm`:** zehn (Nr. 101 bis 110), **`window.prompt`:** einer (Nr. 111), **`window.alert`:** einer (Nr. 112, nicht
  erreichbar). **`localStorage`/`persistId`:** ein Schlüssel, `jms.session` (Nr. 182); kein `persistId`, kein `jm-theme`.

---

## 1 · Hauptfenster

Ein Fenster (`src/main/index.ts:61-110`). Vor der Anmeldung zeigt `R/App.tsx` nur die Anmeldekarte, danach den eigenen Rahmen
(`R/components/AppShell.tsx`) mit Kopf und den Abschnitten Video, Audio, Licht und Setup. Globale Haupttasten gibt es nicht; je
Gerätepanel steht eine Hauptreihe (B16). Derselbe Renderer läuft im Browser (Abschnitt 4b).

| Nr. | Bereich | Element | Handler/IPC | Zustand (sichtbar/aktiv) | heute wo | künftig wo |
|---|---|---|---|---|---|---|
|1| Fenster | Fensterhülle: 1400×900, mindestens 1024×640, Hintergrund `#121212`, Titel „JM Studio Control“, Symbol aus `resources`, auf dem Mac `hiddenInset`, `autoHideMenuBar`, `sandbox`, `contextIsolation`, ohne `nodeIntegration`; Anzeige bei `ready-to-show`. Gemessen: auf dem Prüfrechner (Arbeitsfläche 1524×820) öffnet es mit 1401×820, daneben kurz der Ladescreen (Nr. 173) | `createMainWindow` | Main | `src/main/index.ts:61-110` | |
|2| Fenster | Schließen versteckt nur: das Kreuz (und abgeleitet Alt+F4 und Strg+W) schickt das Fenster ins Tray, die App läuft weiter; beendet wird über das Tray (Nr. 169) oder `before-quit` | `close`, `isQuitting` | Main | `src/main/index.ts:95-104`, `:227-229` | |
|3| Fenster | Externe Adressen: `window.open` öffnet jede Adresse im System-Browser (`shell.openExternal`, ohne Prüfung des Schemas) und verweigert das Fenster; kein Schutz bei `will-navigate` (abgeleitet) | `setWindowOpenHandler` | Main | `src/main/index.ts:90-93` | |
|4| Fenster | Aufbau (N2b 2.1 Nr. 26 ➕): eigener Rahmen `AppShell` (lokal, namensgleich mit `@jm/ui`): Kopf über einem scrollenden Inhalt (`main`, `overflow-auto`) mit höchstens 1400 Breite und Rand `px-7 py-6`; kein Panel, keine Statusleiste, kein ⚙. Gemessen: Kopf 60 hoch, Inhalt 811 hoch bei 1400×900 (innen 1390×871) und 551 bei 1024×640 (innen 1013×611); kein Element `fixed` oder `sticky`, alle Hinweise und Fehlerbänder im Fluss | `AppShell` | K | `R/components/AppShell.tsx:4-15`, `R/App.tsx:134-141` | |
|5| Fenster | Farben und Thema: `html` trägt fest `dark` (Nr. 17 schaltet nur die Klasse, ungemerkt); Tokens aus `@jm/ui`; rohe Farben laut N2b 2.1 Nr. 21: 9 Fundstellen (PGM-Vorschau, Rückfall `#2dd4bf` am Preview-Bus, `text-white` in ATEM, Audio, OBS, PTZ) | – (Anzeige) | An, K | `src/renderer/index.html:2`, `R/globals.css:1-50` | |
|6| Fenster | Lokale Bausteine (N2b 2.1 Nr. 19 ✏️, Nr. 26): `StatusPill`, `Input`, `SectionHeader`, `Headline` in `R/components/ui/` (der Timer hat seine Kopien in Welle 1 abgegeben); die Pille hat eigene Stufen `live` (Markengelb), `setup`, `done`, `error`, `info` und wird 23-mal verwendet, 6-mal mit `live`; `ComingSoon` liegt ungenutzt im Ordner | `StatusPill`, `Input`, `SectionHeader`, `Headline` | An, K | `R/components/ui/StatusPill.tsx:6-33`, `R/components/ui/Input.tsx:4-19`, `R/components/ui/SectionHeader.tsx:9-21`, `R/components/ui/Headline.tsx:19-22`, `R/components/ComingSoon.tsx:5-17` | |
|7| Texte | Englische Reste (N2b 2.1 Nr. 32 ➕): Pillen „Idle“, „Connected · v…“, „Polling …“, „Offline“, „Scanning“, Kopf „Sync“, „Light“/„Dark“, „Logout“, Reiter-Hinweis „Coming soon“, Inventar „Save“, Rollen „admin“/„operator“/„viewer“, Makro-Gruppen und -Namen („Switcher“, „Record · Start“, „Buffer · Next“, „Mute · Master“ …), rohe Fehlertexte des Servers und des Browsers („Failed to fetch“, „403: {…}“, abgeleitet). Gemessen im Kopf: „SYNC · ADMIN · ADMIN · LIGHT · LOGOUT“ | – (Anzeige) | An, K | `R/components/Topbar.tsx:15-20`, `:103`, `:114`, `:182`, `R/components/setup/DeviceTable.tsx:140-142`, `src/shared/tricaster.ts:99-137` | |
|8| Anmeldung | Login-Gate (N2b 2.1 Nr. 22 ➕): ohne Benutzer in der Sitzung nur die Anmeldekarte, ohne Kopf und ohne Rahmen: mittig, Logo 32, „JM Studio Control“, „/ Anmelden“; im Electron-Fenster läuft der Socket dabei schon (Nr. 126). Gemessen: Karte 420 breit, bei 1400×900 x 485–905, y 284–586 | `LoginView`, `if (!user)` | An | `R/App.tsx:132`, `R/views/Login.tsx:36-45` | |
|9| Anmeldung | Feld „Benutzer“: Fokus beim Öffnen, `autocomplete username`, Pflichtfeld; gemessen 358 breit | `setUsername` | An | `R/views/Login.tsx:47-56` | |
|10| Anmeldung | Feld „Passwort“: Pflichtfeld | `setPassword` | An | `R/views/Login.tsx:57-66` | |
|11| Anmeldung | „Anmelden“ (während der Anfrage „Anmelden …“ und gesperrt): POST `/api/login`; bei Erfolg Sitzung in `localStorage` (Nr. 182) und der Rahmen mit dem zuletzt gewählten Abschnitt (Nr. 193). Gemessen bei 1400×900 x 516–874, y 518–556, bei 1024×640 x 327–686, y 388–426; mit Fehlertext (Nr. 113) je 14 tiefer | `submit`, `apiFetch('/api/login')`, `setSession` | An | `R/views/Login.tsx:19-34`, `:72-74` | |
|12| Kopf | Kopf: Ziehfläche (`dragRegion`), auf dem Mac `pl-20` (`isElectronMac` prüft nur den User-Agent); Logo 28, „JM STUDIO“ und „Control“ erst ab Breite `md`; gelbe Verlaufslinie unten. Gemessen 60 hoch, kein Überlauf, auch bei 1024×640 | `Topbar` | K | `R/components/Topbar.tsx:46-71` | |
|13| Kopf | Reiter Video · Audio · Licht · Setup (N2b 2.1 Nr. 17): handgebaute Knöpfe, der aktive hinterlegt mit gelber Linie; Abschnitt im Store, Vorgabe Video (Nr. 193). Gemessen bei 1400×900 (mit Hinweis) Video 161–375, Audio 379–536, Licht 540–693, Setup 697–888, bei 1024×640 (ohne Hinweis) 161–226, 230–297, 300–362, 366–434, je y 11–48 | `setSection` | K | `R/components/Topbar.tsx:73-84`, `:121-165`, `R/store/app.ts:20`, `:85-86` | |
|14| Kopf | Hinweise an den Reitern (N2b 2.1 Nr. 18 ➕): „TriCaster · PTZ · Kumo“ (ATEM und OBS fehlen, Kumo gibt es nicht), „Coming soon“ an Audio und Licht, obwohl beide bedienbar sind, „Geräte · Benutzer“; nur ab Breite `lg` (gemessen: bei 1400 sichtbar, bei 1024 weg) | – (Anzeige) | K | `R/components/Topbar.tsx:15-20`, `:153-162` | |
|15| Kopf | Verbindungs-Pille „Sync“ (gelb) bzw. „Offline“ (rot) (N2b 2.1 Nr. 12): zeigt `connected` aus den Socket-Ereignissen `connect` und `disconnect`; gemessen „SYNC“ in jedem Zustand nach der Anmeldung | `SyncPill`, `setConnected` | K | `R/components/Topbar.tsx:88`, `:167-185`, `R/sync/client.ts:41-42` | |
|16| Kopf | Benutzer und Rolle „‹Name› · ‹rolle›“ (N2b 2.1 Nr. 15), Rolle englisch, ab Breite `md`; gemessen „ADMIN · ADMIN“ und „GAST · VIEWER“ | `useSession.user` | K | `R/components/Topbar.tsx:89-93` | |
|17| Kopf | Hell/Dunkel „Light“ bzw. „Dark“ (N2b 2.1 Nr. 20): schaltet die Klassen `dark` und `light` an `html`, ungemerkt; nach Abmelden und neuer Anmeldung wieder dunkel (abgeleitet). Gemessen 1219–1282 bei 1400 und 842–905 bei 1024, in Hell 3 schmaler | `setTheme` | K | `R/components/Topbar.tsx:29-35`, `:94-104` | |
|18| Kopf | „Logout“ (Abmelden, folgenreich): POST `/api/logout` mit dem Token (Netzfehler verschluckt), Sitzung gelöscht, zurück zur Anmeldung; ohne Rückfrage. Gemessen x 1289–1367 bei 1400 und 912–990 bei 1024, y 15–45, in allen 38 Zuständen nach der Anmeldung an derselben Stelle | `logout`, `clearSession` | K | `R/components/Topbar.tsx:37-44`, `:105-115` | |
|19| Video | Abschnitt Video (N2b 2.1 Nr. 1, 24, 25): vier Panels untereinander (TriCaster, ATEM, OBS, PTZ), kein einzelnes Live-Element; je Panel ist eine Instanz sichtbar. Gemessen mit je einer TriCaster-, ATEM- und OBS-Instanz: Inhalt 2416 hoch bei 1400×900 und 2864 bei 1024×640, das TriCaster-Panel allein 1437 bzw. 1868 | `VideoView` | V | `R/views/Video.tsx:6-15` | |
|20| TriCaster | Panel-Kopf „/ Video · TriCaster“, „Bildmischer“; Instanzwahl „‹Name› (‹Host›:‹Port›)“ (nur mit Instanz), gilt nur im Panel (Nr. 194) | `setSelectedId` | V+I | `R/components/video/TricasterPanel.tsx:85-107` | |
|21| TriCaster | Status-Pille (N2b 2.1 Nr. 27 ➕, Nr. 32): „Idle“ ohne Meldung, „Connected · v‹Version›“ in Markengelb (`live`), „Polling …“, „Offline“ (Tooltip mit dem Fehler); gemessen mit 192.0.2.12 nach wenigen Sekunden „Offline“, simuliert gemessen „Connected · v8.2“ | `StatusBadge` | V+I | `R/components/video/TricasterPanel.tsx:108`, `:219-229` | |
|22| TriCaster | „Bearbeiten“ bzw. „Schließen“ (N2b 2.1 Nr. 16 ➕): öffnet das Formular (Nr. 94) oben im Panel; gemessen schiebt es die Hauptreihe von y 220 auf 330 | `setEditing` | V+I, ab Bed | `R/components/video/TricasterPanel.tsx:109-117`, `:141-150` | |
|23| TriCaster | Leerzustand „Noch keine TriCaster-Instanz konfiguriert.“ mit „TriCaster hinzufügen“ (öffnet das Formular) bzw. für Betrachter „Frage einen Admin / Operator, eine TriCaster-Instanz im Setup anzulegen.“ (Nr. 123); gemessen „TriCaster hinzufügen“ x 50–253, y 202–239 | `setAdding` | V−I | `R/components/video/TricasterPanel.tsx:152-168` | |
|24| TriCaster | Haupttaste „Take“ (N2b 2.1 Nr. 6 ❌, B16): großer `Button`, `variant primary`, `min-w-[120px]`; sendet `tricaster_shortcut` mit `main_take`; gesperrt ohne Grund, solange die Rolle kein `tricaster:exec` hat oder der Zustand nicht `connected` ist. Gemessen x 50–170, y 220–265 bei beiden Größen (mit offenem Formular 330–375; simuliert gemessen ohne Fehlerband, also verbunden, die ganze Reihe bei y 172–217), bei `scrollTop` 0 sichtbar, nicht abgeschnitten | `exec('main_take')`, Socket `tricaster:exec` | V+I | `R/components/video/TricasterPanel.tsx:26-27`, `:172-185` | |
|25| TriCaster | Haupttaste „Auto“ (N2b 2.1 Nr. 6): `variant accent`, `min-w-[120px]`, sendet `main_auto`; Sperre wie Nr. 24; gemessen x 177–297 | `exec('main_auto')` | V+I | `R/components/video/TricasterPanel.tsx:28`, `:172-185` | |
|26| TriCaster | Haupttaste „Fade Black“ (N2b 2.1 Nr. 6): `variant destructive`, `min-w-[120px]`, sendet `main_fade_to_black`; der Zustand wird nicht gemeldet; gemessen x 304–448 (144 breit) | `exec('main_fade_to_black')` | V+I | `R/components/video/TricasterPanel.tsx:29`, `:172-185` | |
|27| TriCaster | Haupttaste „REC“ (N2b 2.1 Nr. 6): `variant outline`, `min-w-[120px]`, sendet `record_toggle_start`; keine Rückmeldung, die Beschriftung ändert sich nie; Stoppen gibt es nur als Makro „Record · Stop“ (Nr. 32; abgeleitet aus den Shortcut-Namen, am Gerät nicht gemessen); gemessen x 455–575 | `exec('record_toggle_start')` | V+I | `R/components/video/TricasterPanel.tsx:30`, `:172-185` | |
|28| TriCaster | Haupttaste „STREAM“ (N2b 2.1 Nr. 6): wie REC mit `streaming_toggle_start`, Stoppen über das Makro „Stream · Stop“; gemessen x 583–703 | `exec('streaming_toggle_start')` | V+I | `R/components/video/TricasterPanel.tsx:31`, `:172-185` | |
|29| TriCaster | PGM-Vorschau (N2b 2.1 Nr. 29 ➕): Platzhalter „/ PGM Vorschau“, „Phase 2“, „NDI · TriCaster PGM“, „Live-Vorschau folgt in Phase 2 (NDI 6 / NDI HX → re-encoded für Browser).“, Quelle „‹Name› (PGM)“, „Kein Stream“, „16:9“; ab Breite `xl` rechts neben der Hauptreihe (420 breit), darunter bei 1024 (gemessen: DSK rutscht von y 562 auf 898) | `PgmPreview` | V+I | `R/components/video/PgmPreview.tsx:9-56`, `R/components/video/TricasterPanel.tsx:186` | |
|30| TriCaster | DSK 1 bis 4 (N2b 2.1 Nr. 6): je „Auto“ (`main_dskN_auto`, animiert) und „Take“ (`main_dskN_take`, hart), Umschalter ohne Rückmeldung; Sperre wie Nr. 24 | `onExec` | V+I | `R/components/video/DskPanel.tsx:10-46`, `src/shared/tricaster.ts:63-71` | |
|31| TriCaster | DDR 1 bis 4 (N2b 2.1 Nr. 6): „▶“ (Tooltip „Play“), „❚❚“ („Pause“), „■“ („Stop“) und die Clipwahl „◀◀“ („Vorheriger Clip“), „▶▶“ („Nächster Clip“); Sperre wie Nr. 24 | `onExec` | V+I | `R/components/video/DdrPanel.tsx:10-79`, `src/shared/tricaster.ts:81-94` | |
|32| TriCaster | Makros „/ Macros“ (N2b 2.1 Nr. 6, 32): 14 Knöpfe in den Gruppen Switcher (Take, Auto, Fade to Black), Record (Record · Start, Record · Stop), Stream (Stream · Start, Stream · Stop), M/E (M/E 1 Take, M/E 1 Auto, M/E 2 Take, M/E 2 Auto), Buffers (Buffer · Previous, Buffer · Next), Audio (Mute · Master); DSK und DDR hier ausgeblendet; Sperre wie Nr. 24; gemessen ab y 814 (1400) bzw. 1245 (1024), größtenteils erst nach Scrollen | `MacroBrowser` | V+I | `R/components/video/TricasterPanel.tsx:194`, `:305-351`, `src/shared/tricaster.ts:99-137` | |
|33| TriCaster | „Weitere Instanz“ (N2b 2.1 Nr. 16): Formular (Nr. 94) unten im Panel | `setAdding` | V+I, ab Bed | `R/components/video/TricasterPanel.tsx:196-206` | |
|34| TriCaster | Protokoll „/ Letzte Aktionen“ (N2b 2.1 Nr. 6; Recht `audit:read`, ab Bediener): die 12 neuesten Einträge mit Uhrzeit, Benutzer, Aktion und Ziel, live über `audit:append`, sonst „Noch keine Aktionen.“; steht im TriCaster-Panel, auch ohne Instanz. Gemessen wächst es mit jeder Aktion (1, 4, 8, 10, 11 Zeilen) und schiebt ATEM, OBS und PTZ nach unten; Aktionen aus dem Fenster stehen unter „local“ (Nr. 130) | `AuditLogPanel` | V, ab Bed | `R/components/video/TricasterPanel.tsx:210-214`, `R/components/video/AuditLogPanel.tsx:13-43` | |
|35| ATEM | Panel-Kopf „/ Video · ATEM“, „Blackmagic-Mischer“; Instanzwahl „‹Name› (‹Host›)“, gilt nur im Panel | `setSelectedId` | V+I | `R/components/video/AtemPanel.tsx:55-77` | |
|36| ATEM | Status-Pille (N2b 2.1 Nr. 27): „Idle“, das Modell bzw. „Verbunden“ in Markengelb (`live`), „Verbinde …“, „Offline“ (Tooltip). Gemessen mit 192.0.2.10 bis zum Ende der Messung (82 s) „Verbinde …“: ohne Gegenstelle meldet der Treiber kein `down`, darum auch kein Fehlerband; simuliert gemessen das Modell „ATEM Mini Pro“ | `Badge` | V+I | `R/components/video/AtemPanel.tsx:78`, `:220-229`, `src/main/drivers/atem/client.ts:17-31` | |
|37| ATEM | „Bearbeiten“ bzw. „Schließen“ (N2b 2.1 Nr. 16): Formular (Nr. 95) oben im Panel; gemessen schiebt es die ATEM-Reihen um 110 nach unten | `setEditing` | V+I, ab Bed | `R/components/video/AtemPanel.tsx:79-83`, `:96-100` | |
|38| ATEM | Leerzustand „Noch kein ATEM konfiguriert.“ mit „ATEM hinzufügen“ bzw. „Ein Admin/Operator kann im Setup einen ATEM anlegen.“ (Nr. 123); gemessen „ATEM hinzufügen“ x 50–213, y 509–547 | `setAdding` | V−I | `R/components/video/AtemPanel.tsx:102-114` | |
|39| ATEM | Bus „Program“ 1 bis 8 (folgenreich, N2b 2.1 Nr. 3): Klick sendet `program` mit dem Eingang (Verb `atem_program`); der gemessene Program-Eingang ist rot hinterlegt; Knöpfe 45 × 41, gesperrt ohne Grund wie die Haupttasten. Gemessen x 50–462, bei 1400×900 je nach Zustand y 1340 bis 1804 (simuliert verbunden 1486–1527, Betrachter 1293–1334), bei `scrollTop` 0 nie sichtbar | `exec({type:'program'})` | V+I | `R/components/video/AtemPanel.tsx:117-123`, `:180-218` | |
|40| ATEM | Bus „Preview“ 1 bis 8: sendet `preview` (Verb `atem_preview`); der gemessene Preview-Eingang ist in `var(--accent, #2dd4bf)` hinterlegt; Sperre wie Nr. 39 | `exec({type:'preview'})` | V+I | `R/components/video/AtemPanel.tsx:124-130`, `:193` | |
|41| ATEM | Haupttaste „Cut“ (N2b 2.1 Nr. 3, B16): großer `Button`, `variant primary`, `min-w-[110px]`; gesperrt ohne Grund, solange die Rolle kein `atem:exec` hat oder nicht `connected`. Gemessen x 50–160; y 1793–1838 bei 1400×900 und 2224–2269 bei 1024×640 (Video mit Geräten, getrennt; sieben Lagen je Größe), bei `scrollTop` 0 nie sichtbar, nicht abgeschnitten | `exec({type:'cut'})`, Socket `atem:exec` | V+I | `R/components/video/AtemPanel.tsx:133-135` | |
|42| ATEM | Haupttaste „Auto“: `variant accent`, `min-w-[110px]`, Verb `atem_auto`; Sperre wie Nr. 41; gemessen x 167–277 | `exec({type:'auto'})` | V+I | `R/components/video/AtemPanel.tsx:136-138` | |
|43| ATEM | Haupttaste „FTB“: `variant destructive`, `min-w-[110px]`, Verb `atem_ftb`; der FTB-Zustand wird nicht gemeldet; gemessen x 284–394 | `exec({type:'ftb'})` | V+I | `R/components/video/AtemPanel.tsx:139-141` | |
|44| ATEM | Haupttaste „REC“ bzw. „● REC“: sendet `record` mit `on` = Gegenteil der gemessenen Aufnahme; rot bei laufender Aufnahme (Rückmeldung `recording` vom Gerät), sonst `outline`; `min-w-[110px]`; gemessen x 402–512, simuliert gemessen „● REC“ ebenso 110 breit | `exec({type:'record'})` | V+I | `R/components/video/AtemPanel.tsx:142-150` | |
|45| ATEM | Haupttaste „STREAM“ bzw. „● STREAM“: sendet `stream` mit `on` = Gegenteil des gemessenen Streams; `accent` bei laufendem Stream; `min-w-[110px]`; gemessen x 519–633, simuliert gemessen „● STREAM“ 519–645 (126 statt 113 breit) | `exec({type:'stream'})` | V+I | `R/components/video/AtemPanel.tsx:151-159` | |
|46| ATEM | „Weitere Instanz“ (N2b 2.1 Nr. 16): Formular (Nr. 95) unten im Panel | `setAdding` | V+I, ab Bed | `R/components/video/AtemPanel.tsx:162-173` | |
|47| OBS | Panel-Kopf „/ Video · OBS“, „OBS Studio“; Instanzwahl „‹Name› (‹Host›:‹Port›)“, gilt nur im Panel | `setSelectedId` | V+I | `R/components/video/ObsPanel.tsx:54-76` | |
|48| OBS | Status-Pille (N2b 2.1 Nr. 27): „Idle“, „Verbunden“ (`live`), „Verbinde …“, „Offline“ (Tooltip); gemessen mit 192.0.2.11 38 s „Verbinde …“, dann „Offline“ mit Fehlerband (Nr. 116); simuliert gemessen „Verbunden“ | `Badge` | V+I | `R/components/video/ObsPanel.tsx:77`, `:183-192`, `src/main/drivers/obs/client.ts:46-67` | |
|49| OBS | „Bearbeiten“ bzw. „Schließen“ (N2b 2.1 Nr. 16): Formular (Nr. 96) oben im Panel | `setEditing` | V+I, ab Bed | `R/components/video/ObsPanel.tsx:78-82`, `:96-100` | |
|50| OBS | Leerzustand „Noch keine OBS-Instanz konfiguriert.“ mit „OBS hinzufügen“ bzw. „Ein Admin/Operator kann im Setup eine OBS-Instanz anlegen.“ (Nr. 123); gemessen x 50–204, y 712–749, bei 1024×640 unter dem Rand | `setAdding` | V−I | `R/components/video/ObsPanel.tsx:102-114` | |
|51| OBS | Szenen (folgenreich, N2b 2.1 Nr. 4): je Szene ein Knopf in der Reihenfolge von OBS (oben zuerst), die gemessene aktuelle rot; Klick sendet `scene` (Verb `obs_scene`); Sperre wie Nr. 52; ohne Szenen „Keine Szenen.“, ohne Verbindung „Nicht verbunden.“ (gemessen). Simuliert gemessen mit fünf Szenen: eine Zeile von x 50 bis 512, 41 hoch, bei 1400×900 y 1893–1934 (Betrachter 1635–1677), bei 1024×640 y 2324–2365, bei `scrollTop` 0 nie sichtbar | `exec({type:'scene'})` | V+I | `R/components/video/ObsPanel.tsx:117-142` | |
|52| OBS | Haupttaste „Aufnahme“ bzw. „● Aufnahme“ (N2b 2.1 Nr. 4, B16): großer `Button`, `min-w-[120px]`, rot bei gemessener Aufnahme, sonst `outline`; sendet `record` ohne `on` (OBS schaltet um, Verb `obs_record`); gesperrt ohne Grund ohne `obs:exec` oder Verbindung. Gemessen x 50–186; y 2141–2186 bei 1400×900 und 2588–2633 bei 1024×640 (getrennt; sieben bzw. acht Lagen), bei `scrollTop` 0 nie sichtbar; simuliert gemessen „● Aufnahme“ 50–198 (149 statt 137 breit), verbunden ohne Fehlerband y 1953–1998 (1400) | `exec({type:'record'})` | V+I | `R/components/video/ObsPanel.tsx:145-153` | |
|53| OBS | Haupttaste „Stream“ bzw. „● Stream“: `min-w-[120px]`, `accent` bei gemessenem Stream, Umschalter (Verb `obs_stream`); gemessen x 194–314; simuliert gemessen „● Stream“ 206–331: die breitere „● Aufnahme“ schiebt die Taste um 12 nach rechts | `exec({type:'stream'})` | V+I | `R/components/video/ObsPanel.tsx:154-162` | |
|54| OBS | „Weitere Instanz“ (N2b 2.1 Nr. 16): Formular (Nr. 96) unten im Panel | `setAdding` | V+I, ab Bed | `R/components/video/ObsPanel.tsx:165-176` | |
|55| PTZ | Panel-Kopf „/ Video · PTZ“, „Kameras“; Instanzwahl „‹Name› (‹Host›:‹Port›)“, gilt nur im Panel | `setSelectedId` | V+I | `R/components/video/PtzPanel.tsx:92-114` | |
|56| PTZ | Status-Pille (N2b 2.1 Nr. 27): „Idle“, „Bereit“ bzw. „Standby“ in Markengelb (aus dem gemessenen Power-Zustand), „Suche …“, „Offline“ (Tooltip); simuliert gemessen „Bereit“ und „Offline“ | `StatusBadge` | V+I | `R/components/video/PtzPanel.tsx:115`, `:409-421` | |
|57| PTZ | „Bearbeiten“ bzw. „Schließen“ (N2b 2.1 Nr. 16): Formular (Nr. 97) oben im Panel | `setEditing` | V+I, ab Bed | `R/components/video/PtzPanel.tsx:116-120`, `:144-153` | |
|58| PTZ | Leerzustand „Noch keine PTZ-Kamera konfiguriert. Panasonic AW-Kameras werden im Setup-Tab via Discovery gefunden — hier mit ihrer IP hinzufügen.“ mit „Kamera hinzufügen“ bzw. „Frage einen Admin / Operator, eine Kamera im Setup anzulegen.“ (Nr. 123); gemessen „Kamera hinzufügen“ ohne Geräte y 914–952, bei beiden Größen unter dem Rand | `setAdding` | V−I | `R/components/video/PtzPanel.tsx:155-172` | |
|59| PTZ | Joystick „/ Schwenk · Neige“ (N2b 2.10 R5, B16): acht Pfeile als Halte-Knöpfe (`HoldButton`: beim Drücken `pan-tilt` mit Richtung mal Geschwindigkeit, beim Loslassen, Abbrechen oder Verlust des Zeigers Stopp; Pointer-Capture; kein `blur`, keine Tastatur), in der Mitte „■“ (Tooltip „Stopp“) als Klick; Raster 210 breit, Knöpfe `h-12` (`driveBtn`); gesperrt ohne Grund; Fahrten werden nicht protokolliert. Simuliert gemessen: Pfeile 66 × 45, links im Panel (bei 1400×900 x 50–260) | `HoldButton`, `exec(PTZ_STOP)` | V+I | `R/components/video/PtzPanel.tsx:176-205`, `:349-407` | |
|60| PTZ | Geschwindigkeit „Langsam“, „Mittel“, „Schnell“ (12, 28, 45 von 49), Vorgabe Mittel, nur im Panel, nie gesperrt | `setSpeed` | V+I | `R/components/video/PtzPanel.tsx:206-222`, `src/shared/ptz.ts:43` | |
|61| PTZ | Zoom „Wide −“ und „Tele +“ als Halte-Knöpfe (`zoom`, Loslassen = 0) | `HoldButton` | V+I | `R/components/video/PtzPanel.tsx:228-240` | |
|62| PTZ | Fokus „Nah“ und „Fern“ als Halte-Knöpfe (`focus`), dazu „AF an“ und „AF aus“ als Klick (`autofocus`) | `HoldButton`, `exec({kind:'autofocus'})` | V+I | `R/components/video/PtzPanel.tsx:241-263` | |
|63| PTZ | Kamera: „Power an“ (Klick, Verb `ptz_power`) und „Standby“ (erst Rückfrage Nr. 106); Anzeige „eingeschaltet“ bzw. „im Standby“ aus dem gemessenen Power-Zustand; simuliert gemessen „Power an“ 93 und „Standby“ 85 breit, rechts neben dem Joystick (1400×900) bzw. darunter (1024×640) | `exec({kind:'power'})` | V+I | `R/components/video/PtzPanel.tsx:266-285` | |
|64| PTZ | Presets 1 bis 12 (folgenreich, N2b 2.1 Nr. 5): Klick ruft das Preset ab (`preset-recall`, Verb `ptz_preset`); im Speichern-Modus erst die Rückfrage (Nr. 105), dann `preset-store`; 4 Spalten, ab `sm` 6; gesperrt ohne Grund. Simuliert gemessen: 6 Spalten in 2 Zeilen, je 208 breit (1400×900) bzw. 145 (1024×640), 45 hoch; „1“ bei 1400×900 y 2476–2521 mit allen Geräten, 1183–1228 nur mit PTZ, 1230–1275 mit Fehlerband, 2144–2189 als Betrachter; bei `scrollTop` 0 nie sichtbar | `onPreset` | V+I | `R/components/video/PtzPanel.tsx:83-90`, `:308-324` | |
|65| PTZ | „Speichern“ bzw. „Speichern aktiv“ (nur mit `ptz:exec`, nie gesperrt): Umschalter des Speichern-Modus, rot bei an; dann „Speichern-Modus: ein Klick legt die aktuelle Position auf den Preset.“ und rot umrandete Presets; simuliert gemessen „Speichern“ 90, „Speichern aktiv“ 128 breit, rechtsbündig über den Presets, der Hinweis schiebt nur „Weitere Kamera“ | `setStoreMode` | V+I, ab Bed | `R/components/video/PtzPanel.tsx:289-306`, `:325-329` | |
|66| PTZ | „Weitere Kamera“ (N2b 2.1 Nr. 16): Formular (Nr. 97) unten im Panel | `setAdding` | V+I, ab Bed | `R/components/video/PtzPanel.tsx:332-342` | |
|67| Audio | Abschnitt Audio: ein Panel „/ Audio · Mischpult“, „Pulte“; Instanzwahl „‹Name› · ‹Transport›“, Pille „Idle“, „Verbunden“ (`live`, N2b 2.1 Nr. 27), „Verbinde …“, „Offline“; „Bearbeiten“ (Formular Nr. 98, ab Bediener) | `AudioView`, `AudioPanel` | Au | `R/views/Audio.tsx:3-9`, `R/components/audio/AudioPanel.tsx:77-109`, `:131-140`, `:252-261` | |
|68| Audio | Leerzustand „Noch kein Pult verbunden. Yamaha QL1 (RCP/TCP) oder Allen & Heath SQ5 (MIDI/TCP) hinzufügen — Transport TCP, OSC-Bridge oder Dante-Netz.“ mit „Pult hinzufügen“ bzw. „Frage einen Admin / Operator, ein Pult im Setup anzulegen.“ (Nr. 123); gemessen ist „Pult hinzufügen“ das einzige Element im Inhalt | `setAdding` | Au, −I | `R/components/audio/AudioPanel.tsx:142-159` | |
|69| Audio | Kanalzüge (N2b 2.1 Nr. 7 ❌): je Kanal „CH n“, Pegel „‹dB› dB“ und ein Fader von −60 bis +10 dB in Schritten von 0,5; jede Bewegung sendet `audio:exec` mit `fader` und setzt den Wert sofort lokal (keine Rückmeldung vom Pult); gesperrt ohne Grund ohne `audio:exec` oder Verbindung; Raster 2, 3 bzw. 4 Spalten, höchstens 60 % der Fensterhöhe, darin scrollend. Simuliert gemessen mit 32 Kanälen: 4 Spalten bei 1400×900, 3 bei 1024×640; bei 1024×640 ist der Inhalt 19 höher als sichtbar | `setFader` | Au, +I | `R/components/audio/AudioPanel.tsx:47-54`, `:162-177`, `:218-233` | |
|70| Audio | „Mute“ bzw. „Muted“ je Kanal (N2b 2.1 Nr. 7): Umschalter, rot bei stumm, sendet `audio:exec` mit `mute`, lokal sofort; normaler Knopf (App-Werte) | `setMute` | Au, +I | `R/components/audio/AudioPanel.tsx:55-62`, `:234-247` | |
|71| Audio | „Weiteres Pult“: Formular (Nr. 98) unten im Panel | `setAdding` | Au, +I, ab Bed | `R/components/audio/AudioPanel.tsx:179-190` | |
|72| Licht | Abschnitt Licht: ein Panel „/ Licht · Art-Net“, „Beleuchtung“; Pille „Kein Node“ (`setup`), „Output → ‹Host›“ (`live`, ohne jede Messung, N2b 2.1 Nr. 27 ➕) bzw. „Blackout“ (`error`); gemessen „KEIN NODE“, simuliert gemessen „Output → 192.0.2.40“ und „Blackout“ | `LichtView`, `LichtPanel` | Li | `R/views/Licht.tsx:3-9`, `R/components/lighting/LichtPanel.tsx:71-87` | |
|73| Licht | Haupttaste Blackout (N2b 2.1 Nr. 7 ❌, B16): „Blackout“ (rot) bzw. „Blackout aus“ (`primary`), klein (`size sm`), rechts im Panel-Kopf; sendet `lighting:blackout` mit dem Gegenteil des Serverzustands (Verb `lighting_blackout`); heute **nur mit Recht `lighting:exec` und mit Node gezeigt, ohne Recht oder ohne Node ausgeblendet** (B16: künftig ohne Recht gesperrt mit dem Rollen-Grund, ohne Node weiter weg); Fehler still (Nr. 120). Simuliert gemessen mit Node: „Blackout“ x 1248–1340, „Blackout aus“ 1219–1340 bei 1400×900, 871–963 bzw. 842–963 bei 1024×640, je y 106–136, bei `scrollTop` 0 sichtbar; beim Betrachter fehlt die Taste (simuliert gemessen) | `toggleBlackout` | Li, Node, ab Bed | `R/components/lighting/LichtPanel.tsx:50-52`, `:88-96` | |
|74| Licht | Node-Zeile „Art-Net Node (Eurolite Node IV): ‹Host› · ‹fps› fps“ bzw. „— nicht konfiguriert“ mit „Ändern“ bzw. „Node einrichten“ (Formular Nr. 99, ab Bediener); gemessen „Node einrichten“ x 1183–1324, y 188–218 | `setEditingNode` | Li | `R/components/lighting/LichtPanel.tsx:100-123` | |
|75| Licht | Leer: „Noch keine Scheinwerfer gepatcht. Aputure-Leuchten (Nova P300C, LS 300X, LS 60X) mit Profil, Universe und DMX-Startadresse hinzufügen.“ | – (Anzeige) | Li | `R/components/lighting/LichtPanel.tsx:126-130` | |
|76| Licht | Scheinwerfer-Karte: Name, „‹Profil› · U‹Universe› · DMX ‹Adresse›“; „An“ bzw. „Aus“ (sendet `lighting:set` mit `on`; gesperrt ohne Recht oder ohne Node, nicht bei Blackout); „⋯“ (ab Bediener) öffnet das Formular (Nr. 100) in der Karte; 1, 2 bzw. 3 Spalten; bei Blackout halb durchsichtig; gemessen ohne Node „An“ gesperrt, simuliert gemessen mit Node bedienbar, auch bei Blackout | `send`, `setEditId` | Li, Sw | `R/components/lighting/LichtPanel.tsx:132-155`, `:175-234` | |
|77| Licht | Regler je Profil: „Intensität“ (0 bis 100 %), „Farbtemperatur“ (Bereich des Profils, Schritt 50 K), „Farbe“ (Farbwahl mit Hex-Anzeige); jede Bewegung sendet `lighting:set` und setzt lokal sofort; gesperrt ohne Recht, ohne Node oder bei Blackout; gemessen ohne Node gesperrt, simuliert gemessen mit Node bedienbar und bei Blackout gesperrt | `Fader`, `send` | Li, Sw | `R/components/lighting/LichtPanel.tsx:45-48`, `:236-322` | |
|78| Licht | „Scheinwerfer hinzufügen“: Formular (Nr. 100) unten im Panel; gemessen x 50–264, y 453–483 (mit einem Scheinwerfer) | `setAdding` | Li, ab Bed | `R/components/lighting/LichtPanel.tsx:158-170` | |
|79| Setup | Abschnitt Setup „/ Setup“, „Geräte · Discovery · Benutzer“ mit den Unterreitern „Inventar“, „Discovery“ und „Benutzer“ (nur mit `users:read`, also Admin; N2b 2.1 Nr. 16); Vorgabe Inventar, bei jedem Abschnittswechsel zurück. Gemessen bei beiden Größen x 26–127, 135–246, 253–357, y 141–179 | `setTab` | Se | `R/views/Setup.tsx:14-73` | |
|80| Inventar | Tabelle „Typ“, „Name / Alias“ (Alias, dahinter der Name in Klammern), „IP“, „MAC“, „Hersteller / Modell“; Typen TriCaster, PTZ Cam, PTZ Controller, AjA Kumo, Ultimatte, Artnet Node, Switch, Taktgenerator, Sonstiges; leer „Noch keine Geräte. Wechsle zum Discovery-Tab oder füge manuell hinzu.“; das Inventar steuert nichts (abgeleitet: kein Treiber liest es) | `DeviceTable` | Se Inv | `R/components/setup/DeviceTable.tsx:11-33`, `:51-101` | |
|81| Inventar | „Bearbeiten“: Zeile mit Typ, Alias (vorbelegt mit Alias oder Name), IP, MAC, Modell, „Save“ und „Abbr.“; speichert über `inventory:upsert` ohne Prüfung. Gemessen bei 1024×640 läuft die Zeile quer über: „Save“ und „Abbr.“ liegen bei x 985–1105 außerhalb des sichtbaren Inhalts (1013 breit), der Inhalt scrollt waagerecht | `setEditing`, `save` | Se Inv, ab Bed | `R/components/setup/DeviceTable.tsx:41-44`, `:89-91`, `:112-149` | |
|82| Inventar | „Entfernen“: Rückfrage (Nr. 109), dann `inventory:remove` | `remove` | Se Inv, ab Bed | `R/components/setup/DeviceTable.tsx:46-49`, `:92-94` | |
|83| Inventar | „+ Gerät hinzufügen“: Zeile Typ (Vorgabe Sonstiges), „Name“, „IP“, „MAC“, „Modell“, „Hinzufügen“ (ohne Name oder IP ohne Wirkung und ohne Hinweis), „Abbr.“; Kennung `dev-‹Zeit›`; gemessen bei 1024×640 ebenfalls quer übergelaufen („Hinzufügen“ x 985–1092) | `NewRow`, `save` | Se Inv, ab Bed | `R/components/setup/DeviceTable.tsx:103-107`, `:151-220` | |
|84| Discovery | „Scan starten“ bzw. „Scan läuft …“ (nur mit `discovery:run`, sonst gesperrt ohne Grund): mDNS, Art-Net-ArtPoll und Panasonic-Suche per Broadcast, 4 s; Pille „Scanning“ während des Laufs, danach „Letzter Scan: n Geräte · x.ys“; in der Messung nicht ausgelöst (Broadcasts ins Netz) | `startScan`, Socket `discovery:run` | Se Disc | `R/components/setup/DiscoverPanel.tsx:39-47`, `:86-99` | |
|85| Discovery | „Liste leeren“: leert die Ergebnisse, gesperrt nur während eines Scans; auch für Betrachter bedienbar (gemessen) | `clearDiscovery` | Se Disc | `R/components/setup/DiscoverPanel.tsx:90-92` | |
|86| Discovery | Ergebnistabelle „Protokoll“ (mDNS, Artnet, Panasonic, AjA), „Name“, „IP“, „MAC“, „Modell“; leer „Noch keine Ergebnisse.“ | – (Anzeige) | Se Disc | `R/components/setup/DiscoverPanel.tsx:101-145` | |
|87| Discovery | „Übernehmen“: legt das Gerät mit geratenem Typ ins Inventar (Kennung aus MAC oder IP) und bei einem TriCaster zusätzlich eine TriCaster-Instanz mit Port 80 an (dann steuerbar unter Video); ein Fehler der Instanz geht nur in die Konsole; danach verschwindet die Zeile aus der Liste | `addToInventory` | Se Disc, ab Bed | `R/components/setup/DiscoverPanel.tsx:18-27`, `:49-82`, `:129-133` | |
|88| Discovery | „Ausblenden“ (Tooltip „Aus der Liste ausblenden“) | `dismissDiscoveryResult` | Se Disc | `R/components/setup/DiscoverPanel.tsx:134-141` | |
|89| Benutzer | Benutzerliste „Benutzer“, „Rolle“, „Erstellt“ (Datum), nach Name sortiert; beim Öffnen per GET `/api/users` geladen, danach live über `users:state`; ein Fehler steht roh oben (etwa „403: {…}“) | `refresh` | Se Ben, Adm | `R/components/setup/UserManager.tsx:20-31`, `:77-91`, `:104-106` | |
|90| Benutzer | Rollen-Auswahl je Benutzer (admin, operator, viewer): die Wahl wirkt sofort (PATCH, ohne Rückfrage); die eigene gesperrt (gemessen) | `updateRole` | Se Ben, Adm | `R/components/setup/UserManager.tsx:48-55`, `:92-103` | |
|91| Benutzer | „Passwort“: Eingabe über `window.prompt` (Nr. 111); unter 6 Zeichen still verworfen, sonst PATCH; keine Bestätigung | `resetPassword` | Se Ben, Adm | `R/components/setup/UserManager.tsx:57-65`, `:108-110` | |
|92| Benutzer | „Löschen“: beim eigenen Benutzer gesperrt (gemessen), sonst Rückfrage (Nr. 110), dann DELETE; der Hinweis per `window.alert` (Nr. 112) ist darum nicht erreichbar | `remove` | Se Ben, Adm | `R/components/setup/UserManager.tsx:67-75`, `:111-113` | |
|93| Benutzer | „+ Benutzer anlegen“: Formular „Benutzer“, „Passwort“ (mindestens 6), „Rolle“ (Vorgabe operator), „Anlegen“, „Abbrechen“; Fehler (etwa ein doppelter Name) roh oben | `create`, `AddUserForm` | Se Ben, Adm | `R/components/setup/UserManager.tsx:33-46`, `:117-125`, `:130-182` | |
|94| Formular | TriCaster-Formular (N2b 2.1 Nr. 16 ➕): „Name“ (Vorgabe „TriCaster TC2“), „Host / IP“ (Platzhalter „192.168.10.10“), „Port“ (80); „Speichern“ (POST `/api/tricasters`; ohne Name, Host oder gültigen Port ohne Wirkung und ohne Hinweis), „Abbrechen“, beim Bearbeiten „Entfernen“ (Rückfrage Nr. 101); Kennung `tc-‹Zeit›`; Speicherfehler still (Nr. 121) | `TricasterForm`, `saveTricaster`, `deleteTricaster` | V, ab Bed | `R/components/video/TricasterPanel.tsx:64-83`, `:231-303` | |
|95| Formular | ATEM-Formular (N2b 2.1 Nr. 16): „Name“ („ATEM Mini“), „Host / IP“ („192.168.10.20“), kein Port (UDP 9910 fest); Speichern, Abbrechen, beim Bearbeiten Entfernen (Nr. 102) | `AtemForm`, `save`, `remove` | V, ab Bed | `R/components/video/AtemPanel.tsx:42-53`, `:231-281` | |
|96| Formular | OBS-Formular (N2b 2.1 Nr. 16): „Name“ („OBS“), „Host / IP“ (Vorgabe 127.0.0.1), „Port“ (4455), „Passwort“ (optional, wird im Klartext gespeichert, Nr. 185); Speichern, Abbrechen, Entfernen (Nr. 103) | `ObsForm`, `save`, `remove` | V, ab Bed | `R/components/video/ObsPanel.tsx:41-52`, `:194-261` | |
|97| Formular | PTZ-Formular (N2b 2.1 Nr. 16): „Name“ („AW-UE150“), „Host / IP“ („192.168.10.21“), „Port“ (80), das Modell bleibt beim Bearbeiten; Speichern, Abbrechen, Entfernen (Nr. 104) | `PtzForm`, `saveCamera`, `deleteCamera` | V, ab Bed | `R/components/video/PtzPanel.tsx:69-81`, `:423-496` | |
|98| Formular | Pult-Formular (N2b 2.1 Nr. 16): „Name“ („Yamaha QL1“), „Pult“ (Yamaha QL1, Allen & Heath SQ5), „Transport“ (TCP (nativ), OSC (Bridge/Relay), Dante-Netz (nativ über Dante-IP)), „Host / IP“ („192.168.30.20“), „Port“ (folgt Pult und Transport: 49280, 51325, bei OSC 8000), „Kanäle“ (folgt dem Pult: 32 bzw. 48, höchstens 64); Speichern, Abbrechen, Entfernen (Nr. 107) | `ConsoleForm`, `saveConsole`, `deleteConsole` | Au, ab Bed | `R/components/audio/AudioPanel.tsx:64-75`, `:263-385` | |
|99| Formular | Node-Formular: „Node Host / IP“ („192.168.40.10“), „Output-Rate (fps)“ (40, 1 bis 60), „Speichern“, „Abbrechen“ und beim Ändern „Trennen“ — Trennen ohne Rückfrage, die Art-Net-Ausgabe endet sofort | `NodeForm`, `saveNode` | Li, ab Bed | `R/components/lighting/LichtPanel.tsx:54-57`, `:324-373` | |
|100| Formular | Scheinwerfer-Formular: „Name“ (Platzhalter „Key Light“), „Profil“ (Aputure LS 60X, LS 300X, Nova P300C · CCT, Nova P300C · RGB, Dimmer (1 Kanal), RGB (3 Kanäle)), „Universe“ (0), „DMX-Startadresse“ (1; passt sie nicht, rot umrandet und „Speichern“ gesperrt ohne Grund), „belegt n Kanäle“; Speichern, Abbrechen, beim Bearbeiten Entfernen (Nr. 108) | `FixtureForm`, `saveFixture`, `removeFixture` | Li, ab Bed | `R/components/lighting/LichtPanel.tsx:59-69`, `:375-472`, `src/shared/lighting.ts:26-33` | |

## 2 · Dialoge und Meldungen

| Nr. | Bereich | Element | Handler/IPC | Zustand (sichtbar/aktiv) | heute wo | künftig wo |
|---|---|---|---|---|---|---|
|101| Rückfrage | `window.confirm` „TriCaster-Instanz wirklich entfernen?“ (Entfernen im TriCaster-Formular, N2b 2.1 Nr. 16) | `deleteTricaster` | V, ab Bed | `R/components/video/TricasterPanel.tsx:76` | |
|102| Rückfrage | `window.confirm` „ATEM-Instanz wirklich entfernen?“ (N2b 2.1 Nr. 16) | `remove` | V, ab Bed | `R/components/video/AtemPanel.tsx:49` | |
|103| Rückfrage | `window.confirm` „OBS-Instanz wirklich entfernen?“ (N2b 2.1 Nr. 16) | `remove` | V, ab Bed | `R/components/video/ObsPanel.tsx:48` | |
|104| Rückfrage | `window.confirm` „PTZ-Kamera wirklich entfernen?“ (N2b 2.1 Nr. 16) | `deleteCamera` | V, ab Bed | `R/components/video/PtzPanel.tsx:77` | |
|105| Rückfrage | `window.confirm` „Aktuelle Position auf Preset ‹n› speichern? Überschreibt den bisherigen Wert.“ (nur im Speichern-Modus) | `onPreset` | V+I | `R/components/video/PtzPanel.tsx:85` | |
|106| Rückfrage | `window.confirm` „Kamera in Standby schalten?“ | `exec({kind:'power'})` | V+I | `R/components/video/PtzPanel.tsx:275` | |
|107| Rückfrage | `window.confirm` „Pult-Verbindung wirklich entfernen?“ | `deleteConsole` | Au, ab Bed | `R/components/audio/AudioPanel.tsx:71` | |
|108| Rückfrage | `window.confirm` „Scheinwerfer wirklich entfernen?“ | `removeFixture` | Li, ab Bed | `R/components/lighting/LichtPanel.tsx:66` | |
|109| Rückfrage | `window.confirm` „Gerät wirklich entfernen?“ (Inventar) | `remove` | Se Inv, ab Bed | `R/components/setup/DeviceTable.tsx:47` | |
|110| Rückfrage | `window.confirm` „Benutzer wirklich löschen?“ | `remove` | Se Ben, Adm | `R/components/setup/UserManager.tsx:72` | |
|111| Eingabe | `window.prompt` „Neues Passwort (min. 6 Zeichen)“ | `resetPassword` | Se Ben, Adm | `R/components/setup/UserManager.tsx:58` | |
|112| Hinweis | `window.alert` „Du kannst dich nicht selbst löschen.“ — über den Knopf nicht erreichbar, weil „Löschen“ beim eigenen Benutzer gesperrt ist | `remove` | Se Ben, Adm | `R/components/setup/UserManager.tsx:68-71` | |
|113| Meldung | Fehlertext der Anmeldung, rot, in Großbuchstaben, unter den Feldern: „Falsche Zugangsdaten“ nur bei genau `401` mit `invalid_credentials` (gemessen), sonst der rohe Fehlertext („Failed to fetch“, „400: {…}“, „login failed“, abgeleitet); schiebt „Anmelden“ um 14 nach unten | `setError` | An | `R/views/Login.tsx:29-31`, `:67-71` | |
|114| Meldung | Fehlerband TriCaster „Verbindung fehlgeschlagen: ‹Fehler› — Adresse http://‹Host›[:‹Port›]/v1/version prüfen.“, nur bei `down` mit Fehler; im Fluss über der Hauptreihe (gemessen: „Zeitüberschreitung (keine Antwort)“, 33 hoch); die Gründe kommen deutsch aus dem Treiber („Verbindung abgelehnt — falscher Port?“, „Host nicht erreichbar — Netzwerk/VLAN prüfen“ …) | – (Anzeige) | V+I | `R/components/video/TricasterPanel.tsx:123-139`, `src/main/drivers/tricaster/client.ts:62-83` | |
|115| Meldung | Fehlerband ATEM „Verbindung fehlgeschlagen: ‹Fehler›“, nur bei `down` (mit unerreichbarer Adresse nie, gemessen) | – (Anzeige) | V+I | `R/components/video/AtemPanel.tsx:89-94` | |
|116| Meldung | Fehlerband OBS „Verbindung fehlgeschlagen: ‹Fehler› — WebSocket-Server in OBS aktiv? (Werkzeuge → WebSocket-Server-Einstellungen)“ (gemessen nach 38 s mit „connect ETIMEDOUT 192.0.2.11:4455“) | – (Anzeige) | V+I | `R/components/video/ObsPanel.tsx:88-94` | |
|117| Meldung | Fehlerband PTZ „Kamera nicht erreichbar: ‹Fehler› — Adresse http://‹Host›[:‹Port›]/cgi-bin/aw_ptz prüfen.“ | – (Anzeige) | V+I | `R/components/video/PtzPanel.tsx:126-142` | |
|118| Meldung | Fehlerband Audio „Pult nicht erreichbar: ‹Fehler› — ‹Host›:‹Port› (‹Transport›).“ | – (Anzeige) | Au, +I | `R/components/audio/AudioPanel.tsx:111-122` | |
|119| Meldung | Hinweis bei Transport Dante: „Hinweis: Dante transportiert Audio, nicht die Pult-Steuerung. Diese Verbindung nutzt das native Protokoll über die Dante-Netz-IP des Pults.“ | – (Anzeige) | Au, +I | `R/components/audio/AudioPanel.tsx:124-129` | |
|120| Meldung | Stille Befehlsfehler (N2b 2.1 Nr. 28 ➕, N2b 2.10 R6): scheitert ein Befehl (Rolle, Nutzlast, Gerät, `not_connected`, Zeitüberschreitung), geht der Fehler bei ATEM, OBS, TriCaster und PTZ nur in die Konsole (`console.warn`), bei Audio und Licht (Fader, Mute, Regler, An/Aus, Blackout) ganz verloren (`.catch(() => {})`); die Taste bleibt, wie sie war. Scheitert die Ausführung am Gerät, schreibt der Server bei ATEM, OBS, TriCaster und PTZ `‹gerät›:exec:failed` ins Protokoll, sichtbar nur in „Letzte Aktionen“ (Nr. 34) | `exec`, `emitWithAck` | V, Au, Li | `R/components/video/AtemPanel.tsx:33-40`, `R/components/video/ObsPanel.tsx:32-39`, `R/components/video/TricasterPanel.tsx:52-62`, `R/components/video/PtzPanel.tsx:60-67`, `R/components/lighting/LichtPanel.tsx:45-52`, `R/components/audio/AudioPanel.tsx:47-62`, `src/main/server.ts:757-912` | |
|121| Meldung | Stille Formularfehler: Speichern und Entfernen in den Geräteformularen, im Inventar und bei Rolle, Passwort und Löschen der Benutzer werfen bei einem Serverfehler ohne Anzeige (unbehandelte Ablehnung, das Formular bleibt offen, abgeleitet); nur Anlegen und Laden der Benutzer zeigen den Fehler (Nr. 89, 93); „Übernehmen“ schreibt den Fehler der TriCaster-Instanz nur in die Konsole | `save`, `remove`, `apiFetch` | V, Au, Li, Se | `R/sync/client.ts:81-96`, `R/components/setup/DeviceTable.tsx:41-49`, `R/components/setup/UserManager.tsx:48-75`, `R/components/setup/DiscoverPanel.tsx:76-78` | |
|122| Meldung | Senden ohne Verbindung: `emitWithAck` lehnt mit `not_connected` ab (still, Nr. 120); `emit` schreibt „[jms] dropped emit — not connected“ in die Konsole (im Renderer ungenutzt) | `emitWithAck`, `emit` | El, Br | `R/sync/client.ts:55-74` | |
|123| Meldung | Hinweise für Betrachter im Leerzustand: „Frage einen Admin / Operator, … im Setup anzulegen.“ bzw. „Ein Admin/Operator kann im Setup … anlegen.“; angelegt wird aber im Panel des Video- bzw. Audio-Reiters, nicht im Setup (Nr. 23, 38, 50, 58, 68) | – (Anzeige) | V, Au, −I | `R/components/video/TricasterPanel.tsx:163-167`, `R/components/video/AtemPanel.tsx:111-113`, `R/components/video/ObsPanel.tsx:111-113`, `R/components/video/PtzPanel.tsx:167-171`, `R/components/audio/AudioPanel.tsx:154-158` | |
|124| Meldung | OBS ohne Szenenknöpfe: „Keine Szenen.“ bzw. „Nicht verbunden.“ (gemessen „Nicht verbunden.“) | – (Anzeige) | V+I | `R/components/video/ObsPanel.tsx:139-141` | |
|125| Meldung | Meldungen nur in der Konsole des Hauptprozesses: „companion gateway not started: ‹Fehler›“ (gemessen „listen EADDRINUSE“ bei gehaltenem 8735, die App lief weiter), „first-run admin created …“, „config ‹Datei› failed validation“ (die App arbeitet dann mit der Vorgabe, das nächste Speichern überschreibt die Datei, abgeleitet), „discovery ‹Anbieter› failed“; nichts davon erscheint im Fenster | `console.warn`, `console.log` | Main | `src/main/server.ts:1088-1096`, `src/main/auth/bootstrap.ts:24-63`, `src/main/config/store.ts:16-28`, `src/main/discovery/index.ts:45-47` | |

## 3 · Abläufe ohne eigenes Bedienelement (im Renderer, im Hauptprozess und am Gateway)

| Nr. | Bereich | Element | Handler/IPC | Zustand (sichtbar/aktiv) | heute wo | künftig wo |
|---|---|---|---|---|---|---|
|126| Socket | Verbindung zum eigenen Server (N2b 2.1 Nr. 22 ➕): im Electron-Fenster sofort beim Start, also **vor** der Anmeldung (ohne Token; der Server nimmt Loopback als Admin „local“, Nr. 130), im Browser erst mit Token; nur WebSocket, Neuversuch nach 200 bis 2000 ms; jede Änderung des Tokens (Anmelden, Abmelden) baut den Socket neu; „unauthorised“ beim Verbinden löscht die Sitzung (Nr. 171) | `connect`, `useEffect` | El, Br | `R/App.tsx:36-46`, `:127-130`, `R/sync/client.ts:28-49` | |
|127| Socket | Stand vom Server in den Store: beim Verbinden je einmal Inventar, TriCaster, PTZ, Licht, Audio, ATEM und OBS (Konfiguration und Status), dazu das Protokoll (100 Einträge, nur für Sockets mit `audit:read`) und die Benutzer (nur mit `users:read`); danach bei jeder Änderung der ganze Stand des Geräts, Protokolleinträge einzeln (`audit:append`, im Store höchstens 200), Discovery mit `discovery:start`, `discovery:result`, `discovery:done` | `onState` | El, Br | `R/App.tsx:47-124`, `R/store/app.ts:84-187`, `src/main/server.ts:618-687`, `:1064-1078` | |
|128| Socket | Toter Zweig: der Renderer verarbeitet `tricaster:status`, `ptz:status` und `audio:status`, der Server sendet sie nie (er schickt bei jeder Änderung den ganzen Stand, abgeleitet) | `setTricasterStatus`, `setPtzStatus`, `setAudioStatus` | El, Br | `R/App.tsx:61-63`, `:72-74`, `:88-90`, `src/shared/protocol.ts:176-205` | |
|129| Sitzung | Anmelden und Abmelden am Server: `/api/login` prüft Name und Passwort (scrypt), legt eine Sitzung für 7 Tage an und protokolliert `auth:login` unter dem Benutzernamen; Fehlversuche ohne Bremse und ohne Protokolleintrag (gemessen: der Fehlversuch steht nicht im Protokoll); `/api/logout` löscht die Sitzung (gemessen: nach drei Wechseln eine Sitzung übrig); `/api/me` nutzt der Renderer nicht | `handleApi` | Srv | `src/main/server.ts:224-265`, `src/main/auth/sessions.ts:5-61` | |
|130| Rechte | Loopback ist Admin (N2b 2.10 R7): jede HTTP-Anfrage und jeder Socket von 127.0.0.1 gilt als Benutzer „local“ mit Rolle admin, unabhängig von der Anmeldung im Fenster; die Rollen-Sperren im Electron-Fenster wirken darum nur im Renderer. Gemessen: Anlegen von Geräten, Scheinwerfer, Inventargerät und Benutzern aus dem Fenster steht im Protokoll unter „local“, nur `auth:login` unter dem Namen | `authenticateHttp`, `attachSocketAuth` | Srv | `src/main/auth/middleware.ts:11-44`, `:74-95` | |
|131| Rechte | Rolle `admin` (`src/shared/roles.ts`): alles aus Nr. 132 und dazu Benutzer lesen und verwalten (`users:read`, `users:write`), also der Unterreiter „Benutzer“ (Nr. 79, 89 bis 93) | `canDo` | alle | `src/shared/roles.ts:1-54` | |
|132| Rechte | Rolle `operator` (Bediener): alle Geräte bedienen (`tricaster:exec`, `atem:exec`, `obs:exec`, `ptz:exec`, `audio:exec`, `lighting:exec`), Geräte, Scheinwerfer, Node und Inventar anlegen, ändern und entfernen (`inventory:write`), Discovery starten (`discovery:run`), Protokoll lesen (`audit:read`); gemessen: Video wie beim Admin, Setup ohne „Benutzer“ | `canDo` | ab Bed | `src/shared/roles.ts:31-50` | |
|133| Rechte | Rolle `viewer` (Betrachter): nur lesen (`*:read`); alle Gerätetasten gesperrt ohne Grund, keine Formulare, kein „Bearbeiten“, „Weitere Instanz“, „⋯“, „Node einrichten“, kein Protokoll, kein Blackout, „Scan starten“ gesperrt, „Liste leeren“ bedienbar. Gemessen: im Video-Reiter kein bedienbarer Knopf im Inhalt; der Inhalt ist 1955 statt 2416 hoch, die ATEM-Reihe steht bei y 1481 statt 1793 | `canDo` | alle | `src/shared/roles.ts:31-50` | |
|134| Rechte | Erst-Zugang: hat die Datenbank keinen Benutzer, legt der Start „Admin“ an, mit Zufallspasswort in „first-run-credentials.txt“ (Rechte 0600); mit `JM_STUDIO_DEV_ADMIN=1` stattdessen Admin/Admin | `ensureInitialAdmin` | Main | `src/main/auth/bootstrap.ts:17-63`, `src/main/index.ts:207-215` | |
|135| Server | Eigener Server auf 0.0.0.0:7778 (N2b 2.1 Nr. 23): HTTP mit der REST-Schnittstelle (Abschnitt 8) und Socket.IO (Herkunft frei, Ping 2 s, Frist 4 s); liefert den gebauten Renderer aus „out/renderer“, unbekannte Pfade bekommen die Startseite; ohne Build der Text „No built renderer found.“; außerhalb des Pakets CORS für jede Herkunft; `/health` | `startServer`, `serveStatic` | Srv | `src/main/server.ts:131-133`, `:153-189`, `:986-1100` | |
|136| Server | Ausführen am Server: Recht des Sockets prüfen, Nutzlast prüfen (zod), Gerät suchen, ausführen, Antwort `ok` bzw. `ok:false` mit Fehler; protokolliert werden ATEM, OBS, TriCaster, PTZ (ohne Fahrten `pan-tilt`, `zoom`, `focus`), Blackout und Audio-Mute, nicht Fader und Licht-Regler; Licht-Regler gehen nicht an die anderen Clients (die sehen den alten Wert bis zur nächsten Strukturänderung, abgeleitet) | `attachSocketHandlers` | Srv | `src/main/server.ts:757-983` | |
|137| Server | Discovery-Lauf (ab Bediener): ein Lauf zur Zeit („already_scanning“), mDNS, ArtPoll und Panasonic parallel, Teilergebnisse sofort an alle, am Ende Anzahl und Dauer, Protokoll `discovery:run` | `runAll` | Srv | `src/main/server.ts:731-755`, `src/main/discovery/index.ts:26-56` | |
|138| Fernsteuerung | Companion-Gateway Port 8735 (N2b 2.1 Nr. 14 ➕, N2b 0.2): startet nach dem HTTP-Server bei jedem Programmstart ohne Schalter, Rolle `studio`, Annonce als Steuer-Endpunkt (`jm-studio-control-ctl`, `ctl=1`); bindet ohne Host (alle Schnittstellen) und liest die Suite-Konfiguration nicht (kein `appDataDir`), läuft also immer offen; ein Startfehler steht nur in der Konsole (Nr. 125, gemessen); `gatewayStatus()` gibt es, niemand ruft es, im Fenster gibt es keinen Eintrag; handelt als Benutzer „companion-gateway“, jeder Befehl landet im Protokoll als `gateway:‹verb›` bzw. `gateway:‹verb›:failed` | `startControlGateway`, `gatewayStatus` | Gw | `src/main/gateway/control-gateway.ts:59-62`, `:159-172`, `:307-340`, `src/main/server.ts:1085-1096`, `packages/suite-control-protocol/src/server.ts:107-115` | |
|139| Fernsteuerung | Zustand an Companion: `STATE ns=studio` mit `atem`, `atem_name`, `atem_pgm`, `atem_pvw`, `atem_rec`, `atem_stream`, `obs`, `obs_scene` (1-basiert), `obs_scene_name`, `obs_rec`, `obs_stream`, `tricaster`, `tricaster_name`, `ptz`, `ptz_name`, `ptz_power`, `audio`, `audio_name`, `lighting` (Node gesetzt), `lighting_blackout`; je Gerätetyp nur die erste Instanz; bei jeder Treiber-Änderung, nach jedem Befehl und auf `STATE?`; Rückmeldungen (Feedbacks) für Program, Preview, Aufnahme, Stream, OBS-Szene, PTZ-Power und Blackout | `buildState`, `pushState` | Gw | `src/main/gateway/control-gateway.ts:120-154`, `:291-303`, `:318-327`, `packages/suite-control-protocol/src/capabilities.ts:564-596` | |
|140| Fernsteuerung | Companion `STUDIO atem_program n` (Aktion `atem_program`, „ATEM: Program-Eingang“): erste ATEM-Instanz, Eingang n (mindestens 0) | `handleAtem` | Gw | `src/main/gateway/control-gateway.ts:186`, `packages/suite-control-protocol/src/capabilities.ts:542` | |
|141| Fernsteuerung | Companion `STUDIO atem_preview n` (Aktion `atem_preview`, „ATEM: Preview-Eingang“) | `handleAtem` | Gw | `src/main/gateway/control-gateway.ts:187`, `packages/suite-control-protocol/src/capabilities.ts:543` | |
|142| Fernsteuerung | Companion `STUDIO atem_cut` (Aktion `atem_cut`, „ATEM: Cut“) | `handleAtem` | Gw | `src/main/gateway/control-gateway.ts:188`, `packages/suite-control-protocol/src/capabilities.ts:544` | |
|143| Fernsteuerung | Companion `STUDIO atem_auto` (Aktion `atem_auto`, „ATEM: Auto (Übergang)“) | `handleAtem` | Gw | `src/main/gateway/control-gateway.ts:189`, `packages/suite-control-protocol/src/capabilities.ts:545` | |
|144| Fernsteuerung | Companion `STUDIO atem_ftb` (Aktion `atem_ftb`, „ATEM: Fade to Black“) | `handleAtem` | Gw | `src/main/gateway/control-gateway.ts:190`, `packages/suite-control-protocol/src/capabilities.ts:546` | |
|145| Fernsteuerung | Companion `STUDIO atem_record` (Aktion `atem_record`, „ATEM: Aufnahme“; Argument on oder off, sonst umschalten; Rückmeldung `atem_rec`) | `handleAtem`, `parseMode` | Gw | `src/main/gateway/control-gateway.ts:76-82`, `:191`, `packages/suite-control-protocol/src/capabilities.ts:547` | |
|146| Fernsteuerung | Companion `STUDIO atem_stream` (Aktion `atem_stream`, „ATEM: Stream“; on, off oder umschalten; Rückmeldung `atem_stream`) | `handleAtem` | Gw | `src/main/gateway/control-gateway.ts:192`, `packages/suite-control-protocol/src/capabilities.ts:548` | |
|147| Fernsteuerung | Companion `STUDIO obs_scene n` (Aktion `obs_scene`, „OBS: Szene wählen (Nr.)“): n-te Szene der gemessenen Liste (1-basiert); unbekannt oder ohne Liste ohne Wirkung | `handleObs` | Gw | `src/main/gateway/control-gateway.ts:206-212`, `packages/suite-control-protocol/src/capabilities.ts:550` | |
|148| Fernsteuerung | Companion `STUDIO obs_record` (Aktion `obs_record`, „OBS: Aufnahme“; on, off oder umschalten) | `handleObs` | Gw | `src/main/gateway/control-gateway.ts:213`, `packages/suite-control-protocol/src/capabilities.ts:551` | |
|149| Fernsteuerung | Companion `STUDIO obs_stream` (Aktion `obs_stream`, „OBS: Stream“; on, off oder umschalten) | `handleObs` | Gw | `src/main/gateway/control-gateway.ts:214`, `packages/suite-control-protocol/src/capabilities.ts:552` | |
|150| Fernsteuerung | Companion `STUDIO tricaster_shortcut ‹Name›` (Aktion `tricaster_shortcut`, „TriCaster: Shortcut/Makro“, Vorgabe `main_take`): beliebiger Shortcut-Name als ein Wort an die erste TriCaster-Instanz | `handleTricaster` | Gw | `src/main/gateway/control-gateway.ts:221-231`, `packages/suite-control-protocol/src/capabilities.ts:554` | |
|151| Fernsteuerung | Companion `STUDIO ptz_preset n` (Aktion `ptz_preset`, „PTZ: Preset abrufen“, 0 bis 99) an die erste Kamera | `handlePtz` | Gw | `src/main/gateway/control-gateway.ts:240-242`, `packages/suite-control-protocol/src/capabilities.ts:556` | |
|152| Fernsteuerung | Companion `STUDIO ptz_power` (Aktion `ptz_power`, „PTZ: Power“; on, off, sonst umschalten nach dem zuletzt gemessenen Power-Zustand) | `handlePtz` | Gw | `src/main/gateway/control-gateway.ts:243-248`, `packages/suite-control-protocol/src/capabilities.ts:557` | |
|153| Fernsteuerung | Companion `STUDIO audio_mute ‹Kanal› ‹on oder off›` (Aktion `audio_mute`, „Audio: Kanal stumm“; Kanal 1 bis 64, Vorgabe an, kein Umschalten) an das erste Pult | `handleAudio` | Gw | `src/main/gateway/control-gateway.ts:264-267`, `packages/suite-control-protocol/src/capabilities.ts:559` | |
|154| Fernsteuerung | Companion `STUDIO audio_fader ‹Kanal› ‹dB›` (Aktion `audio_fader`, „Audio: Fader (dB)“, −60 bis +10); ohne gültige Zahl ohne Wirkung | `handleAudio` | Gw | `src/main/gateway/control-gateway.ts:268-273`, `packages/suite-control-protocol/src/capabilities.ts:560` | |
|155| Fernsteuerung | Companion `STUDIO lighting_blackout` (Aktion `lighting_blackout`, „Licht: Blackout“; on, off oder umschalten; wirkt auch ohne Node; Rückmeldung `lighting_blackout`) | `handleLighting` | Gw | `src/main/gateway/control-gateway.ts:283-289`, `packages/suite-control-protocol/src/capabilities.ts:562` | |
|156| Treiber | TriCaster: je Instanz alle 5 s GET `/v1/version` mit 2 s Frist; Zustand `polling` bis zur ersten Antwort, dann `connected` (mit Version) oder `down` mit Grund; Befehle als GET `/v1/shortcut` mit 3 s Frist | `pollOne`, `shortcut` | Main | `src/main/drivers/tricaster/pool.ts:8`, `:39-91`, `src/main/drivers/tricaster/client.ts:22-83` | |
|157| Treiber | ATEM: `atem-connection` (UDP 9910), ereignisgesteuert; `connecting` bis verbunden und nach einer Trennung wieder `connecting`; `down` nur, wenn schon der Verbindungsaufbau scheitert (gemessen: mit unerreichbarer Adresse nie); Program, Preview, Aufnahme und Stream aus dem Gerät (M/E 1) | `AtemClient` | Main | `src/main/drivers/atem/client.ts:8-102`, `src/main/drivers/atem/pool.ts:32-59` | |
|158| Treiber | OBS: obs-websocket v5, ereignisgesteuert (Szenen, Aufnahme, Stream), nach einem Fehler neuer Versuch alle 3 s; `connecting` beim Start, dann `connected` oder `down` mit Fehler (gemessen nach 38 s) | `ObsClient` | Main | `src/main/drivers/obs/client.ts:4`, `:20-114` | |
|159| Treiber | PTZ: je Kamera alle 5 s die Power-Abfrage; `polling`, dann `connected` mit `on` oder `standby` bzw. `down` | `startPtzPolling` | Main | `src/main/drivers/panasonic-ptz/pool.ts:5`, `:34-82`, `src/main/drivers/panasonic-ptz/client.ts:48-62` | |
|160| Treiber | Audio: TCP (Yamaha RCP, Allen & Heath MIDI) bzw. OSC; `connecting`, `connected`, `down`, neuer Versuch nach 2,5 s; der gesendete Stand je Kanal wird gemerkt (Nr. 187) | `syncAudioFromConfig`, `sendAudio` | Main | `src/main/audio/manager.ts:14-90`, `:174-208` | |
|161| Licht | Licht-Ausgabe: mit Node Art-Net-DMX (UDP 6454) dauerhaft in der Bildrate des Nodes (Vorgabe 40 fps), ohne Node nichts; Blackout setzt alle Kanäle auf 0 und wird nicht gemerkt (beim Start aus) | `tick`, `setBlackout` | Main | `src/main/lighting/engine.ts:85-95`, `:128-136`, `:175-179` | |
|162| App | Programmstart: Datenbank anlegen (Tabellen `users`, `sessions`, `audit_log`), Erst-Zugang, Inventar und TriCaster laden, Server starten (lädt alle Geräte, startet Treiber und Abfragen, danach das Gateway), IPC, Tray, Fenster; startet der Server nicht (etwa 7778 belegt), kommt kein Fenster (abgeleitet: `await startServer()` lehnt ab) | `whenReady` | Main | `src/main/index.ts:207-221`, `src/main/db/migrate.ts:3-37`, `src/main/server.ts:986-1002` | |
|163| App | Laufzeit-Grundlage `initAppRuntime` (Kennung `jm-studio-control`, Name „JM Studio Control“): „main.log“, Absturz-Bericht, CSP (Verbindungen nur zu 127.0.0.1:7778 per http und ws), Ladescreen (Nr. 173), Anwesenheit beim Launcher (127.0.0.1:7799), Master-Link (N2b 2.1 Nr. 11: Abfrage und Ereignis `jmps:master-link` registriert, kein Preload liest ihn) | `initAppRuntime` | Main | `src/main/index.ts:31-37`, `packages/app-runtime/src/index.ts:573-670` | |
|164| App | Einzelinstanz: ein zweiter Start holt das Fenster nach vorn (wiederhergestellt, gezeigt, fokussiert) oder baut es neu | `second-instance` | Main | `src/main/index.ts:193-205` | |
|165| App | Programmende: nur über das Tray (Nr. 169) oder das System (`before-quit`); alle Fenster zu beendet nichts, das Tray hält die App; Server, Gateway, Treiber, Licht-Ausgabe und Datenbank werden beim Beenden nicht ausdrücklich gestoppt (`stopServer` ruft niemand, abgeleitet) | `window-all-closed`, `before-quit` | Main | `src/main/index.ts:223-229`, `src/main/server.ts:1102-1108` | |

## 4 · Zusatzfenster

Kein zweites Bedienfenster. Neben dem Hauptfenster gibt es das Tray mit eigenem Menü (4a), denselben Renderer im Browser, ausgeliefert
vom eigenen Server (4b), und den Ladescreen der Laufzeit (4c).

### 4a · Tray

| Nr. | Bereich | Element | Handler/IPC | Zustand (sichtbar/aktiv) | heute wo | künftig wo |
|---|---|---|---|---|---|---|
|166| Tray | Tray-Symbol (Windows 16 px aus icon.ico, Mac 18 px als Vorlage), Tooltip „JM Studio Control · :7778“; Klick (nicht Mac) zeigt bzw. versteckt das Fenster | `setupTray`, `toggleMainWindow` | Tray | `src/main/index.ts:112-122`, `:165-183` | |
|167| Tray | Menü „Fenster verbergen“ bzw. „Fenster anzeigen“: die Beschriftung wird nur beim Bau des Menüs gesetzt (beim Start, Fenster noch unsichtbar) und steht darum fest auf „Fenster anzeigen“, auch wenn das Fenster offen ist (abgeleitet); Klick schaltet um | `rebuildTrayMenu` | Tray | `src/main/index.ts:108`, `:124-133` | |
|168| Tray | Menü „LAN-URLs“ (N2b 2.1 Nr. 31 ➕): je IPv4-Adresse „http://‹IP›:‹Port›/“, Klick öffnet sie im Browser, ohne Adresse „Keine LAN-Adresse gefunden“; nur beim Start berechnet; außerhalb des Pakets mit Port 5174 (Vite) statt 7778, also bei einem gebauten, nicht gepackten Start falsch (abgeleitet); die Adressen gibt es nur hier, `window.jms.remote.getUrls` nutzt der Renderer nicht | `getRemoteUrls` | Tray | `src/main/index.ts:135-144`, `src/main/server.ts:1110-1127` | |
|169| Tray | Menü „Server :7778“ (gesperrt, nur Anzeige) und „JM Studio Control beenden“ (zerstört das Fenster und beendet die App, ohne Rückfrage) | `app.quit` | Tray | `src/main/index.ts:146-158` | |

### 4b · Browser (`http://‹IP›:7778/`)

| Nr. | Bereich | Element | Handler/IPC | Zustand (sichtbar/aktiv) | heute wo | künftig wo |
|---|---|---|---|---|---|---|
|170| Browser | Seite im Browser (N2b 2.1 Nr. 23): derselbe Renderer, vom eigenen Server ausgeliefert (gemessen: GET auf 127.0.0.1:7778 ergibt 200, `text/html`); `window.jms` fehlt, die Server-Adresse kommt aus der Adresse der Seite mit Port 7778 | `resolveServerUrl`, `serveStatic` | Br | `R/sync/client.ts:7-16`, `src/main/server.ts:153-189` | |
|171| Browser | Anmeldung im Browser: vor der Anmeldung kein Socket, mit Token verbindet er; ein abgelaufenes oder gelöschtes Token ergibt „unauthorised“, die Sitzung wird gelöscht, zurück zur Anmeldung; eigene Sitzung im `localStorage` des Browsers (getrennt vom Fenster) | `connect`, `clearSession` | Br | `R/App.tsx:36-46`, `R/store/session.ts:11-29` | |
|172| Browser | Was im Browser fehlt oder anders ist: Tray, LAN-URLs, Master-Link und Gateway-Zustand sind nicht erreichbar; Kürzel des Browsers statt des Standardmenüs; ein Browser auf demselben Rechner (127.0.0.1) gilt beim Server als Admin „local“ (Nr. 130); keine CSP aus der Laufzeit (abgeleitet) | – | Br | `src/main/auth/middleware.ts:11-19`, `src/main/index.ts:31-37` | |

### 4c · Ladescreen

| Nr. | Bereich | Element | Handler/IPC | Zustand (sichtbar/aktiv) | heute wo | künftig wo |
|---|---|---|---|---|---|---|
|173| Ladescreen | Ladescreen der Laufzeit: rahmenloses Fenster 440×260, immer oben, nicht in der Taskleiste, bis das erste Fenster bereit ist; gemessen beim Start mit 442×262 neben dem Hauptfenster offen | `startSplash` | Main | `packages/app-runtime/src/index.ts:459-541` | |

## 5 · Ausgabe (nur Abgrenzung, bleibt unverändert)

| Nr. | Bereich | Element | Handler/IPC | Zustand (sichtbar/aktiv) | heute wo | künftig wo |
|---|---|---|---|---|---|---|
|174| Ausgabe | Studio-Control hat **kein Ausgabefenster** (kein Vollbild, kein zweiter Bildschirm, kein NDI, kein Kanal `output:zustand`); seine Ausgänge sind die Gerätebefehle aus dem Hauptprozess (HTTP an TriCaster und PTZ, UDP an den ATEM, WebSocket an OBS, TCP bzw. OSC an das Pult) und Art-Net-DMX an den Node (Nr. 161); die PGM-Vorschau ist ein Platzhalter (Nr. 29) | – | – | `src/main/server.ts:757-983`, `src/main/lighting/engine.ts:85-95` | |

## 6 · Tastatur (Pflichtpunkt Spec 10)

| Nr. | Bereich | Element | Handler/IPC | Zustand (sichtbar/aktiv) | heute wo | künftig wo |
|---|---|---|---|---|---|---|
|175| Kürzel | Keine eigenen Kürzel (N2b 2.1 Nr. 8, N2b 2.7): kein `keydown` im Renderer, jede Taste wirkt nur auf das Element mit Fokus | – | An, K | `R/App.tsx:1-142` | |
|176| Kürzel | Standardmenü (N2b 0.3): kein `setApplicationMenu`, also das Standardmenü von Electron (versteckt, Alt zeigt es): F11 Vollbild; Strg+R neu laden (die Sitzung bleibt aus `localStorage`, der Abschnitt springt auf Video, offene Formulare, Instanzwahl und Discovery-Ergebnisse sind weg, der Socket holt Geräte, Protokoll und Benutzer neu); Strg+W schließt das Fenster, das heißt versteckt es ins Tray (Nr. 2); Strg+Umschalt+I Entwicklerwerkzeuge; Strg +/−/0 Zoom; abgeleitet, nicht gemessen. Im Browser gelten die Kürzel des Browsers | Electron-Standardmenü | El | `src/main/index.ts:67-86` | |
|177| Tasten im Feld | Enter in einem Feld sendet das Formular (Anmeldung, Geräteformulare, Node, Scheinwerfer, Benutzer anlegen); die Inventarzeilen sind keine Formulare, dort bewirkt Enter nichts (abgeleitet) | `onSubmit` | An, V, Au, Li, Se | `R/views/Login.tsx:46`, `R/components/setup/DeviceTable.tsx:112-220` | |
|178| Tasten auf Knöpfen | Leertaste und Enter lösen den Knopf mit Fokus aus (Standard des Browsers), auch Haupttasten, Busse und „Logout“ (abgeleitet) | – | K, V, Au, Li, Se | `R/components/video/AtemPanel.tsx:132-160`, `R/components/Topbar.tsx:105-115` | |
|179| Tasten auf Halte-Knöpfen | Joystick, Zoom und Fokus reagieren nur auf den Zeiger; Leertaste und Enter bewirken dort nichts (kein `onClick`, N2b 2.10 R5); „■“ (Stopp) reagiert auf Tasten | `HoldButton` | V+I | `R/components/video/PtzPanel.tsx:182-191`, `:361-407` | |
|180| Tasten auf Auswahl und Reglern | Pfeiltasten auf einer Auswahl wählen sofort (Instanzwahl nur Anzeige; die Rollen-Auswahl im Benutzer-Reiter ändert die Rolle sofort, Nr. 90); Pfeiltasten auf einem Regler senden (Audio-Fader, Licht-Regler); abgeleitet | `onChange` | V, Au, Li, Se | `R/components/setup/UserManager.tsx:92-103`, `R/components/audio/AudioPanel.tsx:224-233`, `R/components/lighting/LichtPanel.tsx:310-319` | |
|181| Panel-Tasten | **Panel-Tasten nach O1 (gilt im neuen Aufbau):** Felder behalten ihre Tasten; Leertaste auf einem Knopf oder Schalter im Panel geht ans Tool; Escape im Panel schließt nur das Panel. Heute gibt es kein Panel und keine Kürzel des Tools; das künftige Panel enthält nur „Fernsteuerung“ (`RemoteControlSection`, nur Electron); Escape bewirkt heute nirgends etwas | – | K | `R/components/AppShell.tsx:4-15` | |

## 7 · Gemerkte Zustände (localStorage, Benutzerordner, Datenbank)

| Nr. | Bereich | Element | Handler/IPC | Zustand (sichtbar/aktiv) | heute wo | künftig wo |
|---|---|---|---|---|---|---|
|182| localStorage | `jms.session` (N2b 2.1 Nr. 30 ➕): Token und Benutzer (Kennung, Name, Rolle); Lesen beim Laden mit `try/catch`, Schreiben und Löschen **ohne** `try/catch` (Spec 3.8 verlangt es); der Benutzer wird beim Start nicht beim Server geprüft, im Fenster wird eine abgelaufene Sitzung nie abgewiesen (Loopback), der Kopf zeigt weiter Name und Rolle (abgeleitet); Fenster (`file://`) und Browser haben je eine eigene Ablage | `loadPersisted`, `savePersisted` | An, K | `R/store/session.ts:4-55` | |
|183| Datei | „config/tricasters.json“ im Benutzerordner: TriCaster-Instanzen (Kennung, Name, Host, Port); eine ungültige Datei wird beim Laden verworfen (Vorgabe leer) | `loadTricasters`, `upsertTricaster` | Main | `src/main/config/tricasters.ts:8-35`, `src/main/config/store.ts:6-39` | |
|184| Datei | „config/atem.json“: ATEM-Instanzen (Kennung, Name, Host) | `loadAtem`, `upsertAtem` | Main | `src/main/config/atem.ts:4-31` | |
|185| Datei | „config/obs.json“: OBS-Instanzen samt Passwort im Klartext | `loadObs`, `upsertObs` | Main | `src/main/config/obs.ts:4-31` | |
|186| Datei | „config/ptz-cameras.json“: Kameras (Kennung, Name, Host, Port, Modell) | `loadPtzCameras`, `upsertPtzCamera` | Main | `src/main/config/ptz.ts:8-35` | |
|187| Datei | „config/audio.json“: Pulte und der zuletzt gesendete Stand je berührtem Kanal (Pegel, stumm), 1,5 s verzögert gespeichert | `loadAudioConsoles`, `updateChannelState` | Main | `src/main/config/audio.ts:8-67` | |
|188| Datei | „config/lighting.json“: Node und Scheinwerfer samt Zustand (an, Intensität, Farbtemperatur, Farbe); Regler-Bewegungen 1,5 s verzögert; Blackout wird nicht gemerkt | `loadLighting`, `saveLighting` | Main | `src/main/config/lighting.ts:8-24`, `src/main/lighting/engine.ts:21`, `:128-136` | |
|189| Datei | „config/devices.json“: das Inventar | `loadDevices`, `upsertDevice` | Main | `src/main/config/devices.ts:4-43` | |
|190| Datenbank | „data/studio-control.sqlite“: Benutzer (Passwort als scrypt), Sitzungen (7 Tage), Protokoll (alle Einträge; der Server schickt dem Fenster 100, es zeigt 12) | `getDb`, `migrate` | Main | `src/main/db/sqlite.ts:8-12`, `src/main/db/migrate.ts:3-37` | |
|191| Datei | „first-run-credentials.txt“ im Benutzerordner: der Erst-Zugang (Nr. 134); bleibt liegen, bis jemand die Datei löscht | `ensureInitialAdmin` | Main | `src/main/auth/bootstrap.ts:24-63` | |
|192| Suite | Laufzeit-Dateien über `initAppRuntime`: „logs/main.log“ (14 Tage), Absturzbericht, Master-Link-Datei im Suite-Ordner; „renderer.log“ entsteht nicht (gemessen: fehlt, der Renderer schickt keine Logs); „control.json“ der Suite liest Studio-Control nicht (Nr. 138) | `initAppRuntime` | Main | `src/main/index.ts:31-37`, `packages/app-runtime/src/index.ts:573-670` | |
|193| Nicht gemerkt | Abschnitt (Vorgabe Video; im laufenden Fenster bleibt er auch über das Abmelden hinweg stehen, gemessen: nach der Anmeldung als Bediener und als Admin stand „Setup“), Setup-Unterreiter (zurück auf Inventar), Hell/Dunkel | `useApp.section`, `useState` | K | `R/store/app.ts:85-86`, `R/views/Setup.tsx:17`, `R/components/Topbar.tsx:29` | |
|194| Nicht gemerkt | Instanzwahl je Panel (bei jedem Reiterwechsel wieder die erste, abgeleitet), offene Formulare, PTZ-Geschwindigkeit (Mittel) und Speichern-Modus | `useState` | V, Au | `R/components/video/AtemPanel.tsx:22-24`, `R/components/video/PtzPanel.tsx:42-46` | |
|195| Nicht gemerkt | Discovery-Ergebnisse, Protokoll im Store (höchstens 200) und Benutzerliste gelten bis zum Neuladen; Lage und Größe des Fensters (immer 1400×900) | `useApp` | El, Br, Main | `R/store/app.ts:158-186`, `src/main/index.ts:67-71` | |

## 8 · IPC-Übersicht `window.jms` (Preload `src/preload/index.ts`)

Der Preload legt `window.jms` an (Typ in `R/sync/jms.d.ts`). Keine Master-Link-Funktion, keine Fernsteuerungs-Meldung (beides
ergänzt der Umbau, nur im Electron-Fenster).

| Funktion | Kanal | Richtung | Wirkung |
|---|---|---|---|
| `platform` | – | – | `process.platform` |
| `versions` | – | – | `process.versions` |
| `serverUrl` | – | – | fest `http://127.0.0.1:7778` |
| `isElectron` | – | – | `true`; entscheidet, ob der Socket vor der Anmeldung verbindet (Nr. 126) |
| `remote.getUrls()` | `remote:getUrls` | invoke | LAN-URLs (Nr. 168); im Renderer ungenutzt |
| `remote.getAddresses()` | `remote:getAddresses` | invoke | IPv4-Adressen; im Renderer ungenutzt |
| `closeWindow()` | `window:close` | invoke | Fenster schließen (also verstecken); im Renderer ungenutzt |

Nicht über den Preload: `jmps:master-link` und `jmps:log` (von der Laufzeit registriert, ohne Zugang), die Schnittstelle des
eigenen Servers auf Port 7778 (unten), das TCP-Gateway auf Port 8735, die mDNS-Annonce des Gateways und die Anwesenheit beim
Launcher (127.0.0.1:7799).

Schnittstelle des eigenen Servers (Port 7778, `src/main/server.ts`):

| Weg | Recht | Wirkung |
|---|---|---|
| POST `/api/login`, POST `/api/logout` | – | Sitzung anlegen bzw. löschen (Nr. 129) |
| GET `/api/me` | angemeldet | eigener Benutzer; im Renderer ungenutzt |
| GET und POST `/api/users`, PATCH und DELETE `/api/users/:id` | `users:read`, `users:write` | Benutzerverwaltung (Nr. 89 bis 93) |
| GET und POST `/api/tricasters`, `/api/atem`, `/api/obs`, `/api/ptz`, `/api/audio`, DELETE `/api/‹typ›/:id` | `‹typ›:read`, `inventory:write` | Instanzen (Nr. 94 bis 98) |
| GET `/api/lighting`, POST `/api/lighting/node`, POST `/api/lighting/fixture`, DELETE `/api/lighting/fixture/:id` | `lighting:read`, `inventory:write` | Node und Scheinwerfer (Nr. 99, 100) |
| GET `/api/audit` | `audit:read` | Protokoll; im Renderer ungenutzt (es kommt über den Socket) |
| GET `/health` | – | `ok` |
| Socket `inventory:upsert`, `inventory:remove` | `inventory:write` | Inventar (Nr. 81 bis 83, 87) |
| Socket `discovery:run` | `discovery:run` | Scan (Nr. 84, 137) |
| Socket `tricaster:exec`, `atem:exec`, `obs:exec`, `ptz:exec`, `audio:exec` | `‹typ›:exec` | Befehle (Nr. 24 bis 70, 136) |
| Socket `lighting:set`, `lighting:blackout` | `lighting:exec` | Licht (Nr. 73, 76, 77) |
| Socket vom Server: `inventory:state`, `tricaster:state`, `ptz:state`, `lighting:state`, `audio:state`, `atem:state`, `obs:state`, `discovery:start`, `discovery:result`, `discovery:done`, `audit:state`, `audit:append`, `users:state` | je Lese-Recht | Stand an alle (Nr. 127) |

## 9 · Einstellungen nach Spec 6 / Anhang A (Zuordnung der Ist-Elemente)

Verben-Übersicht (Pflicht): jedes Verb in jeder Schicht, in der es heute existiert.

| Verb | Oberfläche | Fernsteuerung (`STUDIO …`, Port 8735) | Socket | Recht |
|---|---|---|---|---|
| ATEM Program | Bus „Program“ (Nr. 39) | `atem_program` (Nr. 140) | `atem:exec` `program` | `atem:exec` |
| ATEM Preview | Bus „Preview“ (Nr. 40) | `atem_preview` (Nr. 141) | `atem:exec` `preview` | `atem:exec` |
| ATEM Cut, Auto, FTB | „Cut“, „Auto“, „FTB“ (Nr. 41 bis 43) | `atem_cut`, `atem_auto`, `atem_ftb` (Nr. 142 bis 144) | `atem:exec` | `atem:exec` |
| ATEM Aufnahme, Stream | „REC“, „STREAM“ (Nr. 44, 45; mit `on`) | `atem_record`, `atem_stream` (Nr. 145, 146; on, off, umschalten) | `atem:exec` | `atem:exec` |
| OBS Szene | Szenenknöpfe (Nr. 51; nach Name) | `obs_scene n` (Nr. 147; nach Nummer) | `obs:exec` `scene` | `obs:exec` |
| OBS Aufnahme, Stream | „Aufnahme“, „Stream“ (Nr. 52, 53; umschalten) | `obs_record`, `obs_stream` (Nr. 148, 149) | `obs:exec` | `obs:exec` |
| TriCaster Shortcut | Hauptreihe, DSK, DDR, Makros (Nr. 24 bis 32; feste Namen) | `tricaster_shortcut` (Nr. 150; jeder Name) | `tricaster:exec` | `tricaster:exec` |
| PTZ Preset | Presets (Nr. 64; Abruf und Speichern) | `ptz_preset` (Nr. 151; nur Abruf) | `ptz:exec` | `ptz:exec` |
| PTZ Power | „Power an“, „Standby“ (Nr. 63) | `ptz_power` (Nr. 152) | `ptz:exec` | `ptz:exec` |
| PTZ Fahrt, Zoom, Fokus, AF | Joystick, Zoom, Fokus (Nr. 59 bis 62) | – | `ptz:exec` | `ptz:exec` |
| Audio Mute, Fader | Kanalzüge (Nr. 69, 70) | `audio_mute`, `audio_fader` (Nr. 153, 154; nur erstes Pult) | `audio:exec` | `audio:exec` |
| Licht Blackout | „Blackout“ (Nr. 73; nur mit Node) | `lighting_blackout` (Nr. 155; auch ohne Node) | `lighting:blackout` | `lighting:exec` |
| Licht Scheinwerfer | An/Aus und Regler (Nr. 76, 77) | – | `lighting:set` | `lighting:exec` |

Weitere Zuordnung (Plan-Block Studio-Control, B15, B16):

| Spec-Baustein | Ist-Nr. | Bemerkung |
|---|---|---|
| Rahmen `AppShell` aus `@jm/ui` (B15), Anmeldung im Rahmen (N2b S3-A) | Nr. 4, 8 bis 11, 12 | heute eigener Rahmen und Anmeldung ohne Rahmen; gelöscht werden laut B16 `R/components/AppShell.tsx`, `R/components/Topbar.tsx`, `R/components/ui/StatusPill.tsx` |
| `Tabs` in der Werkzeugleiste, Abschnitt bleibt in `R/store/app.ts`, nicht gemerkt | Nr. 13, 14, 193 | heute Knöpfe im Kopf mit veralteten Hinweisen |
| Benutzer · Rolle und Abmelden in der Werkzeugleiste (N2b S3-A) | Nr. 16, 18 | „Logout“ ist folgenreich (Messung) |
| Hell/Dunkel im Kopf | Nr. 17 | heute „Light“/„Dark“, ungemerkt |
| Haupttasten je Panel (B16) | Nr. 24 bis 28, 41 bis 45, 52, 53, 73 | Reihenfolge und Mindestbreite bleiben (ATEM 110, TriCaster und OBS 120, Licht neu 110); Sperrgründe heute keine |
| Normale Knöpfe (Busse, Szenen, Presets, Joystick, DSK, DDR, Makros, Mute, Fader) | Nr. 30 bis 32, 39, 40, 51, 59 bis 65, 69, 70 | folgenreich für die Messung: Program-Busse, Szenen, Presets |
| Halte-Knopf für PTZ (B16) | Nr. 59, 61, 62, 179 | heute `HoldButton` ohne Tastatur und ohne `blur` |
| Pillen über `StatusPill` aus `@jm/ui` (B16) | Nr. 21, 36, 48, 56, 67, 72 | heute „verbunden“ in Markengelb, „Idle“ statt „unbekannt“, Licht „Output → ‹Host›“ ohne Messung |
| Statusleiste: `master-link` | Nr. 163 | heute ohne Preload; im Browser entfällt der Eintrag |
| Statusleiste: `server` | Nr. 15, 126 | heute Pille „Sync“/„Offline“ im Kopf |
| Statusleiste: `atem`, `obs`, `tricaster`, `ptz`, `audio` | Nr. 21, 36, 48, 56, 67, 156 bis 160 | Status je Instanz gemessen |
| Statusleiste: `licht` | Nr. 72, 161 | nur Einstellung, keine Rückmeldung vom Node |
| Statusleiste: `fernsteuerung` | Nr. 138 | heute keine Meldung, `gatewayStatus()` ungenutzt; im Browser entfällt der Eintrag |
| Statusleiste: `benutzer` | Nr. 16 | `useSession.user` |
| Panel: nur `RemoteControlSection` (Modul „JM Studio Control“, nur Electron) | Nr. 138 bis 155 | Port 8735 fest |
| `onAir` (B3) | Nr. 44, 45, 52, 53, 139 | gemessen sind nur ATEM und OBS (Aufnahme, Stream); TriCaster und Licht melden nichts |
| Setup bleibt Reiter, Geräteformulare bleiben im Panel (N2b S4-A) | Nr. 79 bis 100 | |
| Browser ohne Master-Link und Fernsteuerung (N2b S5-A) | Nr. 170 bis 172 | |

## 10 · Befunde für den Umbau (belegt, ohne Wertung als Fehler)

1. **Haupttasten-Plätze, gemessen** (Video mit drei Geräten, getrennt; Fenster 1402×902 außen, innen 1390×871 bzw. 1026×642 und
   1013×611; Kopf 60 hoch, Inhalt ab y 60): TriCaster-Reihe bei beiden Größen y 220–265, Take 50–170, Auto 177–297, Fade Black
   304–448, REC 455–575, STREAM 583–703, bei `scrollTop` 0 sichtbar. ATEM-Reihe x Cut 50–160, Auto 167–277, FTB 284–394, REC
   402–512, STREAM 519–633, y 1793–1838 bei 1400×900 und 2224–2269 bei 1024×640; Program-Bus x 50–462, y 1652–1693 bzw.
   2083–2124; OBS Aufnahme 50–186, Stream 194–314, y 2141–2186 bzw. 2588–2633. ATEM, Program-Bus und OBS sind bei `scrollTop` 0
   in keinem gemessenen Zustand sichtbar (erst nach 822 bis 2022 Pixel Scrollen). Keine Haupttaste ist abgeschnitten
   (`scrollWidth` nie größer als `clientWidth`). Die Mindestbreiten halten: ATEM 110 (STREAM 114), TriCaster 120 (Fade Black
   144), OBS 120 (Aufnahme 136).
2. **Folgenreiche Tasten wandern mit dem Zustand, gemessen:** Über die 13 Video-Zustände mit Geräten je Größe hat die
   TriCaster-Reihe zwei Lagen (y 220 und 330, Formular oben offen), die ATEM-Reihe und der Program-Bus sieben, die OBS-Reihe
   sieben (1400) bzw. acht (1024); ATEM „Cut“ etwa zwischen y 1481 und 1949 bei 1400×900. Ursachen: das Protokoll im
   TriCaster-Panel wächst (gemessen 1 bis 11 Zeilen, höchstens 12; beim Betrachter fehlt es), Fehlerbänder erscheinen
   (TriCaster sofort, OBS nach 38 s), offene Formulare, die Rolle (Betrachter ohne „Bearbeiten“ und „Weitere Instanz“).
   „Logout“ steht in allen 38 Zuständen nach der Anmeldung fest. Für die Tastenplatz-Regel heißt „alter Platz“ darum die
   Vereinigung aller Rechtecke je Größe; die JSON enthält alle 40 gemessenen Zustände je Größe mit jedem Bedienelement (2 912
   Elemente, davon 596 folgenreich), dazu 11 simulierte je Größe (1 550 Elemente, 370 folgenreich, Befund 13).
3. **Kopf und Anmeldung, gemessen:** der Kopf ist 60 hoch und läuft bei 1024×640 nicht über; die Reiter-Hinweise fallen unter
   Breite `lg` weg, damit schrumpft „Video“ von 214 auf 65 Breite. Anmeldekarte 420 breit, „Anmelden“ x 516–874, y 518–556
   (1400×900) bzw. x 327–686, y 388–426 (1024×640), mit Fehlertext 14 tiefer.
4. **Loopback ist Admin, gemessen:** alle Aktionen aus dem Electron-Fenster laufen am Server als „local“ mit Rolle admin, egal wer
   angemeldet ist (Protokoll des zweiten Laufs: 7 Einträge „local“, 4 `auth:login` unter Admin, Gast, Bediener, Admin). Die Rollen
   wirken im Fenster nur über die Sperren im Renderer; der Socket des Fensters verbindet vor der Anmeldung und bekäme jeden Befehl
   durch (abgeleitet). Ein Fehlversuch bei der Anmeldung steht nicht im Protokoll.
5. **Geräte ohne Gegenstelle, gemessen:** TriCaster nach wenigen Sekunden „Offline“ mit „Zeitüberschreitung (keine Antwort)“,
   OBS 38 s „Verbinde …“, dann „Offline“ mit „connect ETIMEDOUT“; ATEM bleibt bis zum Ende der Messung (82 s nach dem Anlegen) bei
   „Verbinde …“ ohne Fehlerband (Nr. 36, 157).
6. **Inventarzeilen laufen bei 1024×640 quer über, gemessen:** in „Bearbeiten“ und „+ Gerät hinzufügen“ ist der Inhalt 1105 bzw.
   1157 breit bei 1013 sichtbar; „Save“, „Hinzufügen“ und „Abbr.“ sind nur nach waagerechtem Scrollen erreichbar (Nr. 81, 83).
   Beim Bearbeiten eines Scheinwerfers bei 1024×640 ist der Inhalt 6 höher als sichtbar.
7. **Grenzen der Messung:** echt gemessen ist kein verbundener Zustand; PTZ, Kanalzüge, Licht mit Node und Blackout, OBS-Szenen,
   Pillen „Verbunden“ und „● REC“ sind nur simuliert gemessen (Befund 13). Gar nicht gemessen sind Discovery, die Tastenwege (Nr.
   176 bis 180), der Mac und der Browser über das GET auf 7778 hinaus. Das Fenster lag für die Messung auf dem
   größeren Bildschirm (Skalierung 1,26), weil der Hauptbildschirm nur 1524×820 Arbeitsfläche hat. Zwei Läufe ergaben dieselben
   Rechtecke (2 912 Vergleiche, 0 Abweichungen).
8. **Stille Fehler:** Befehle und Formulare melden Fehler nicht im Fenster (Nr. 120 bis 122); bei ATEM, OBS, TriCaster und PTZ steht
   ein Scheitern am Gerät nur im Protokoll. Eine Anzeige wäre neue Funktion (N2b 2.10 R6).
9. **Wahl wirkt sofort:** die Rollen-Auswahl in der Benutzerliste ändert die Rolle beim Wählen, auch per Pfeiltaste (Nr. 90, 180);
   die Instanzwahl der Panels ist nur Anzeige.
10. **Toter oder veralteter Code:** `R/components/ComingSoon.tsx` ungenutzt; `tricaster:status`, `ptz:status`, `audio:status` sendet
    niemand (Nr. 128); `remote.getUrls`, `remote.getAddresses` und `closeWindow` im Preload ungenutzt; `/api/me` und `/api/audit`
    ungenutzt; `stopServer` ruft niemand (Nr. 165); die Reiter-Hinweise nennen Kumo und „Coming soon“ (Nr. 14); die Leerzustände
    schicken Betrachter ins Setup (Nr. 123).
11. **Gateway:** liest „control.json“ nicht und läuft offen auf allen Schnittstellen; `gatewayStatus()` liefert `running`, `port`,
    `clients`, wird aber nirgends gelesen (Nr. 138). Die TriCaster-Tasten REC und STREAM senden nur die Start-Shortcuts (Nr. 27,
    28), über Companion geht jeder Shortcut (Nr. 150).
12. **Tray:** die Beschriftung „Fenster anzeigen“ wird nie nachgeführt, und die LAN-URLs zeigen ungepackt den Vite-Port 5174
    (Nr. 167, 168).
13. **Simuliert gemessen** (Nachtrag, Stand nur im Renderer gesetzt, 11 Zustände je Größe, zwei Läufe mit 1 550 Vergleichen und 0
    Abweichungen): Verbunden fällt das Fehlerband weg und die TriCaster-Reihe steht bei y 172–217 statt 220–265 (dritte Lage neben
    330). „● STREAM“ (ATEM) ist 126 statt 113 breit, „● Aufnahme“ (OBS) 149 statt 137 und schiebt „Stream“ von 194–314 auf 206–331;
    „● REC“ bleibt 110. Die fünf OBS-Szenen, die ATEM-Reihe, der Program-Bus und die zwölf Presets liegen mit allen Geräten
    weit unter dem Rand (Presets bei 1400×900 ab y 2476, bei 1024×640 ab 3115); nur mit PTZ ab y 1183 bzw. 1391. Blackout steht
    oben rechts im Licht-Panel (1400×900: x 1248–1340, als „Blackout aus“ 1219–1340, y 106–136) und ist bei `scrollTop` 0
    sichtbar; beim Betrachter fehlt er. Der eingespielte Stand blieb vom Einspielen bis zum Ende jeder Messung stehen (vor und
    nach jeder Messung geprüft); den (leeren) Stand des Servers schickt der Socket nur beim Verbinden, darum wurde nach der
    Anmeldung als Betrachter neu eingespielt.
