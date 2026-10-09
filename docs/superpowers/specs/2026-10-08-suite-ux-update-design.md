# Suite-UX-Update: ein Sendepult für alle Tools

> **Stand 2026-10-08.** Entwurf aus dem Brainstorming vom selben Tag; alle fünf Entwurfsabschnitte hat der Owner einzeln
> freigegeben („passt“). Löst die Phasen 2–5 der alten UX-Roadmap ab ([`docs/ux/suite-ux-roadmap.md`](../../ux/suite-ux-roadmap.md),
> Lane E in [`docs/roadmap.md`](../../roadmap.md)); Phase 1 (Titler-Pilot, PR #168) bleibt die Grundlage.

## 0 · Ziel und Erfolgskriterien

Jedes Tool der Suite bekommt **denselben Rahmen** und **dieselbe Bedienlogik der Oberfläche**: gleiche Kopfzeile, gleiche
Statusleiste, Einstellungen am selben Ort mit denselben Abschnitten, eine gemeinsame Bildsprache für „auf Sendung“, „bereit“
und „ausgewählt“. Leitprinzip bleibt: **Live-Bedienung sichtbar, Einrichtung weggeräumt.**

Fertig ist das Vorhaben, wenn für jedes Tool im Umfang (Abschnitt 9) gilt:

1. Es läuft im gemeinsamen `AppShell` (Kopfzeile, Statusleiste, Einstellungs-Panel).
2. Das wichtigste Live-Bedienelement ist ohne Klick sichtbar; die Haupttasten sind `TallyButton`s.
3. Wiederkehrende Einstellungen (NDI, Bildschirm-Ausgabe, Fernsteuerung, Audiogerät, iveo, DataLink, Gegenstellen) kommen aus
   `@jm/settings` und sehen in jedem Tool gleich aus.
4. Es nutzt nur Farb-Tokens, keine rohen Tailwind-Farben; Dunkel ist Standard, Hell ist wählbar.
5. Die Funktionsliste des Tools (Abschnitt 10) ist vollständig abgehakt — **keine Funktion und kein Tastaturkürzel fehlt**.

## 1 · Owner-Entscheidungen (08.10.2026)

| # | Frage | Entscheidung |
|---|---|---|
| U1 | Ziele | alle vier: **gleiches Bediengefühl überall**, **Live-Bedienung entrümpeln**, **schneller einrichten**, **Optik modernisieren** (bisher ein Nicht-Ziel) |
| U2 | Umfang | **alle Tools** nach einem gemeinsamen Muster; zuerst die gemeinsamen Bausteine, dann App für App nach Wichtigkeit im Live-Betrieb |
| U3 | Optik-Richtung | **„Sendepult mit der Dichte der Konsole“**: Statusleiste unten, Tally-Farben und große Haupttasten in jedem Tool; Inhalte und Einstellungen kompakt wie heute |
| U4 | Hell/Dunkel | **Dunkel Standard, Hell wählbar** — ein gemeinsamer Schalter in der Kopfzeile, gemerkt je Arbeitsplatz |
| U5 | Releases | **gesammelt je Welle**, nicht je App |
| U6 | Paket-Schnitt | **`@jm/ui` + neues `@jm/settings`**; jede App füllt Werte und Status selbst, kein Umbau im Hauptprozess |
| U7 | Entwurf | Abschnitte 1–5 (Bausteine, Optik-System, Seitenaufbau, Einstellungs-Abschnitte, Umsetzung/Tests/Abnahme) einzeln freigegeben |

Abweichung von der Skizze, bewusst und freigegeben: Die Skizze zu U3 zeigte noch einen Reiter „Steuerung | Einstellungen“.
Die Einstellungen kommen stattdessen als **Panel von rechts** (Abschnitt 5.1), damit man während der Show etwas einstellen
kann, ohne die Live-Ansicht zu verlassen.

## 2 · Ausgangslage (am Code gemessen, origin/main 2026-10-08)

- **26 App-Ordner**, davon 25 im Umfang (`cookbook-web` ist eine Astro-Website ohne Electron).
- **`@jm/ui` exportiert** `cn`, `dragRegion`/`noDragRegion`/`isElectronMac`, `Button`, `Card`, `Badge`, `Logo`, `Splitter`,
  `Collapsible`, `Modal`, `SettingsSection`, `Tabs`, dazu `base.css` mit Farb- und Schrift-Tokens (Manrope, Dunkel als
  `:root`/`.dark`, Hell als `.light`). **Es fehlen** Rahmen, Kopfzeile, Statusleiste/-pille, Feld, Schalter, Auswahl.
- **`Collapsible`/`SettingsSection`/`Tabs`** nutzen nur Titler und App Designer (je eine Datei).
- **Kopfzeilen:** drei Familien, jede App schreibt ihre eigene (`components/Topbar.tsx` o. ä.); 7 Apps ohne Logo
  (App Designer, Battle, Caption, Connect, Interpreter, Q&A, Rundown).
- **Status:** überall anders — Pillen (Titler), identisch kopierte `StatusPill`/`SyncPill` in Timer **und** Studio-Control,
  Punktlisten in Battle/Q&A/Rundown, `StatusChips` im Launcher, Textzeile in Connect.
- **Einstellungen an fünf Orten:** eigener Reiter (Titler, Switcher), Modal-Overlay `fixed inset-0` (Q&A, Battle, Launcher),
  Seitenleiste (Prompter, Stage-Display, Timer), Kopfzeile (Caption, Interpreter), Mini-Menü (Presenter).
- **Farben:** 24 Apps nutzen die Tokens; **4 Apps nutzen rohe `neutral-*`-Farben und sind nur dunkel** — Connect (103 Stellen,
  eigenes CSS ohne `base.css`), Battle (69), Caption (47), Interpreter (21).
- **Hell/Dunkel:** 10 Apps haben einen eigenen Knopf (Copy, Grafiktool, Launcher, Media-Converter, Player, Recorder,
  Studio-Control, Switcher, Sync, Timer), der Zustand lebt in `useState` und wird nicht gemerkt; die Live-Tools Titler,
  Prompter, Stage-Display, Transcribe, Q&A, Rundown, Battle haben keinen.
- **Wiederkehrende Einstellungen:** NDI/Bildschirm-Ausgabe in ~9 Apps, Fernsteuerung/Companion in ~8, Audiogerät in 6,
  iveo in 3–4, DataLink in 1 (Titler).
- **Lokale Kopien** von `Section` (5 Apps), `Field` (~8 Dateien), `Row` (5), `Toggle` (4), `Select` (2).
- `var(--warning)` ist heute **JM-Gelb** und wird an **22 Stellen** benutzt.

Quelle: Bestandsaufnahme vom 08.10.2026 (Sitzungs-Scratchpad `ux-inventar.md`), Einzelheiten je Tool in Anhang A.

## 3 · Bausteine in `@jm/ui`

Alle neuen Bausteine sind **rein darstellend**: Sie bekommen Werte und Rückrufe über Props und kennen keine IPC, kein
`window.*`-API und keinen Hauptprozess. Namen und Props sind der Vertrag für den Plan.

### 3.1 `AppShell`

```ts
interface AppShellProps {
  tool: string;                         // Anzeigename ohne „JM “, z. B. „Titler“
  headerCenter?: ReactNode;             // Show-/Master-Anzeige (2b R2: „Show vom Master: X · Stand hh:mm“)
  onAir?: { live: boolean; label?: string };   // On-Air-Anzeige in der Kopfzeile; fehlt = keine Anzeige
  status: StatusItem[];                 // Statusleiste (3.3)
  toolbar?: ReactNode;                  // nur Typ „Werkzeug“ (5.2)
  settings?: ReactNode;                 // Inhalt des Einstellungs-Panels; fehlt = kein ⚙
  settingsOpen: boolean;
  settingsSection?: string;             // beim Öffnen anzuspringender Abschnitt (id)
  onSettingsChange(open: boolean, sectionId?: string): void;
  dichte?: 'normal' | 'kompakt';        // Vorgabe 'normal'; 'kompakt' für dichte Werkzeuge (3.8)
  children: ReactNode;                  // Live-Bereich bzw. Arbeitsfläche
}
```

- Aufbau senkrecht: Kopfzeile (44 px) · Werkzeugleiste (optional) · Inhalt (füllt) · Statusleiste (28 px).
- Das Einstellungs-Panel öffnet rechts **neben** dem Inhalt und schiebt ihn zusammen (Breite 360 px, ab einer Fensterbreite
  unter 900 px liegt es über dem Inhalt). Es verdeckt die Kopfzeile und die Statusleiste nie.
- Escape schließt das Panel, wenn der Fokus darin liegt; sonst gehört Escape dem Tool (bestehende Kürzel, Abschnitt 10).

### 3.2 `AppHeader`

Wird von `AppShell` benutzt, ist aber auch einzeln exportiert (für Sonderfälle, 5.3).

- Links: `Logo` + Toolname. Auf macOS im Electron-Fenster Platz für die Ampel (`isElectronMac`); die Kopfzeile ist
  Ziehfläche (`dragRegion`), alle Bedienelemente darin `noDragRegion`.
- Mitte: `headerCenter`.
- Rechts: On-Air-Anzeige (wenn `onAir` gesetzt: rote Fläche mit „ON AIR“ bzw. `label`, sonst „bereit“ in Grün; nie nur
  Farbe), `ThemeToggle`, ⚙ (nur wenn `settings` gesetzt).

### 3.3 `StatusBar` und `StatusItem`

```ts
type StatusState = 'ok' | 'warn' | 'error' | 'off' | 'live';
type StatusGroup = 'verbindung' | 'ausgabe' | 'fernsteuerung' | 'tool';
interface StatusItem {
  id: string;                // stabil, z. B. 'ndi', 'companion', 'iveo', 'master-link'
  group: StatusGroup;
  label: string;             // kurz: „NDI“, „Companion“, „iveo“, „Master“
  state: StatusState;
  detail?: string;           // z. B. „JM Titler (REGIE-PC)“, „:8729 · 2 verbunden“
  settingsSection?: string;  // Klick öffnet das Panel bei diesem Abschnitt
}
```

- **Reihenfolge fest:** `verbindung` → `ausgabe` → `fernsteuerung` → `tool`, innerhalb einer Gruppe in der Reihenfolge des
  Arrays; ganz rechts die Uhrzeit (hh:mm:ss, gleich breite Ziffern).
- **Jeder Zustand hat Symbol und Text**, nicht nur Farbe: ok ● grün, warn ▲ orange, error ⚠ rot umrandet, off ○ grau,
  live ■ rot gefüllt. Das Detail steht als Text daneben, gekürzt mit vollem Text im Tooltip.
- Ein Eintrag mit `settingsSection` ist ein Knopf (öffnet das Panel dort), sonst reine Anzeige.
- Zu schmale Fenster: unter 900 px nur Symbol + Label, Detail im Tooltip.

### 3.4 `TallyButton`

```ts
interface TallyButtonProps {
  state: 'bereit' | 'live' | 'gesperrt';
  label: string;
  shortcut?: string;          // Anzeige, z. B. „F1“, „Leertaste“ — das Kürzel selbst bleibt im Tool
  disabledReason?: string;    // Pflicht bei 'gesperrt', als Tooltip und für Screenreader
  onClick?(): void;           // normaler Klick
  onPress?(): void;           // Halten: beim Drücken …
  onRelease?(): void;         // … und beim Loslassen ODER Abbrechen (pointerup, pointercancel, Fokusverlust)
}
```

- Mindesthöhe 48 px, gut mit Maus und Touch zu treffen. `live` = rot gefüllt mit „LIVE“-Kennung, `bereit` = neutral mit
  grüner Kante, `gesperrt` = gedimmt plus Grund.
- **Halten-zum-Sprechen** (Connect-Talkback) über `onPress`/`onRelease`; `onRelease` kommt in jedem Fall genau einmal, auch
  wenn der Zeiger das Fenster verlässt — ein hängender Talkback wäre ein Live-Fehler.
- **Auf Sendung und gesperrt** (Nachtrag, Owner 09.10.2026; Frage O2 im Fundament-Plan): `state` bleibt einer aus
  `'bereit' | 'live' | 'gesperrt'`. Ist `state` `'live'` und `disabledReason` gesetzt (nicht leer, nicht nur Leerzeichen),
  zeigt der Knopf weiter die LIVE-Fläche mit „LIVE“-Kennung, dazu den Grund wie bei `gesperrt` (sichtbar, als Tooltip und
  für Screenreader), und er ist nicht bedienbar; ein laufendes Halten endet wie beim Wechsel auf `gesperrt` (`onRelease`
  genau einmal). Auf der LIVE-Fläche steht der Grund in deren großer Schrift (Kontrast, 4.2). `live` ohne Grund und
  `gesperrt` bleiben unverändert. Beispiel: Switcher, Quelle auf Sendung, Knopf während einer Überblendung gesperrt.
  Vor dem Grund steht „Gesperrt: “ (wie die Sperre im `Field`), sichtbar, im Tooltip und für Screenreader: Die LIVE-Fläche
  sieht aus wie bei `live`, also nennt das Wort die Sperre (Nachbesserung nach Prüfung, 09.10.2026).
- Ein Tool zeigt höchstens **vier** `TallyButton`s nebeneinander (5.1). Ausnahme Studio-Control: Tallys je Gerätepanel,
  keine globale Leiste (Anhang A).
- Ein `shortcut` zeigt nur ein **vorhandenes** Kürzel an. Wo die Beschriftung heute falsch ist (Player: „GO ⏎“, ausgelöst
  wird aber die Leertaste), wird die Anzeige berichtigt, nicht das Kürzel geändert.

### 3.5 Eingaben

`Field` (Beschriftung, Hilfetext, Fehlertext, Sperrgrund), `TextInput`, `NumberInput` (Einheit, Min/Max), `Toggle`, `Select`
(nativ, gestylt). Alle 32 px hoch, mit `aria-invalid`/`aria-describedby` für Fehler und Sperrgrund. Sie ersetzen die lokalen
Kopien aus Abschnitt 2.

### 3.6 `SettingsPanel`

Seitenpanel mit Titel „Einstellungen“, Schließen-Knopf und einer senkrechten Liste von Abschnitten (`SettingsSection` bzw.
`Collapsible`, beide vorhanden). Springt beim Öffnen zu `settingsSection` und hebt ihn kurz hervor.

### 3.7 `ThemeToggle` und `useTheme`

- Dunkel ist Standard; Hell setzt die Klasse `light` auf `<html>` (die Tokens dafür gibt es schon).
- Gemerkt **je Tool** in `localStorage` (Schlüssel `jm-theme`); Lesen und Schreiben in `try/catch`, ein Fehler fällt auf
  Dunkel zurück. Dass ein Schalter alle Tools zugleich umstellt, bräuchte den Hauptprozess — das ist Folgeaufgabe F1.

### 3.8 Dichte und Umgebung

- `AppShell` hat eine Prop `dichte: 'normal' | 'kompakt'`. Kompakt (Kopfzeile 36 px, Statusleiste 24 px) ist für dichte
  Werkzeug-Flächen gedacht (Grafiktool, Editor, DAW).
- **Ohne Electron lauffähig:** Sync (PWA), Studio-Control (auch im Browser) und andere Renderer laufen teils im Browser.
  `AppShell`, alle Bausteine und `@jm/settings` setzen kein `window.jm*`-API voraus; `isElectronMac` ist dort `false`,
  `localStorage` wird nur in `try/catch` benutzt.
- **Zustand ohne Sitzung:** Ein Tool kann den Rahmen mit leerer Statusleiste und ohne Einstellungen zeigen (Studio-Control
  vor dem Login).
- **Ziehfläche auf macOS:** 11 Apps haben heute auf dem Mac keine Ziehfläche und keinen Ampel-Freiraum (Anhang A, A.0/5);
  der gemeinsame Header behebt das.

### 3.9 Status-Brücken (lesend)

Die Statusleiste darf nur **gemessene** Zustände zeigen (Abschnitt 7). Zwei davon kommen heute in den meisten Tools nicht
bis zur Oberfläche:

- **Master-Link:** `@jm/app-runtime` betreibt in 24 Tools schon einen `MasterLinkClient` mit Zustand
  (`aus | sucht | verbindet | verbunden(masterName) | fehler(code)`), aber kein Renderer liest ihn. Neu: **eine** lesende
  Brücke in `@jm/app-runtime` (Ereignis an den Renderer + Abfrage), einmal gebaut, in jedem Tool nutzbar.
- **Fernsteuerung (Companion):** 15 Tools haben einen Steuerserver; Port und Clientzahl sieht der Renderer heute nur bei
  Switcher, Titler und Connect. Neu: je Tool eine lesende Meldung `{läuft, port, clients, modus}` aus dem vorhandenen
  Steuerserver, gebaut in der Welle des Tools.

Das ist eine **bewusste, kleine Ausnahme von U6**: Die Brücken lesen nur vorhandene Zustände, sie ändern keine Logik,
keinen Port und kein Protokoll. Die Master-Link-Brücke berührt `@jm/app-runtime`, an dem 2b R2 und Zoom 4b gerade arbeiten;
sie kommt deshalb erst mit dem Titler-Pilot nach dem Merge beider (9.2). Freigabe: offene Frage UO3.

### 3.10 Galerie

Eine Seite, die **jeden** Baustein in **jedem** Zustand und in **beiden** Modi zeigt (auch `@jm/settings`, Abschnitt 6),
startbar ohne Electron im Browser (`npm run galerie -w @jm/ui`, Vite). Sie ist das Werkzeug für die Sichtprüfung im Plan und
in der Abnahme.

## 4 · Optik-System

### 4.1 Grundsatz: das Fundament ist rein additiv

Neue Tokens bekommen **neue Namen**, bestehende Tokens und bestehende Komponenten (`Button`, `Card`, `Badge`, …) ändern
**weder Wert noch Aussehen**. Grund: jede App bündelt `@jm/ui` beim Bau; eine Wertänderung käme mit dem nächsten Release
**jeder** App, auch außerhalb ihrer Welle — das wäre der Big Bang, den U5 ausschließt. Eine App bekommt den neuen Look erst,
wenn sie in ihrer Welle auf die neuen Bausteine umgestellt wird.

### 4.2 Farben mit fester Bedeutung

| Token (neu) | Bedeutung | Dunkel | Hell |
|---|---|---|---|
| `--tally-live` | auf Sendung | `oklch(0.62 0.23 27)` | `oklch(0.55 0.22 27)` |
| `--tally-ready` | bereit / verbunden | `oklch(0.72 0.17 145)` | `oklch(0.60 0.17 145)` |
| `--tally-selected` | ausgewählt / Marke | `var(--brand-yellow)` | `var(--brand-dark)` mit gelber Kante |
| `--status-warn` | Warnung | `oklch(0.76 0.16 60)` (Orange) | `oklch(0.66 0.16 55)` |
| `--status-error` | Fehler | `var(--destructive)` | `var(--destructive)` |
| `--status-off` | aus | `var(--muted-foreground)` | `var(--muted-foreground)` |

- **Gelb heißt nur noch „ausgewählt/Marke“**, Warnungen werden orange. Das bestehende `--warning` (Gelb) bleibt für die
  22 Altstellen unverändert und wird in jeder App beim Umbau auf `--status-warn` umgestellt.
- „Auf Sendung“ und „Fehler“ sind beide rot; sie unterscheiden sich **durch Form und Text** (gefüllt + „LIVE“ gegen
  Rahmen + ⚠ + Fehlertext), nie nur durch den Farbton.
- Kontrast: Text auf allen Flächen mindestens WCAG AA (4,5 : 1, große Schrift 3 : 1); der Plan misst die Paare.

### 4.3 Flächen, Größen, Schrift, Bewegung

- **Flächen:** drei Stufen — Hintergrund `--background`, Karte `--card`, Panel `--surface-raised` (neu, eine Stufe heller als
  `--card`), mit feinen Rändern `--border`.
- **Rundungen:** Bedienelemente `--radius-md` (6 px), Karten/Panel `--radius-lg` (8 px); vorhandene Tokens, nur andere Nutzung.
- **Größen (neu):** `--header-h: 44px`, `--statusbar-h: 28px`, `--control-h: 32px`, `--control-h-lg: 48px`,
  `--panel-w: 360px`.
- **Schrift:** Manrope bleibt; Zahlen und Zeiten mit gleich breiten Ziffern (`.tabular`); Abschnittsköpfe klein, Großbuchstaben,
  gesperrt (wie `SettingsSection` heute).
- **Bewegung:** nur Übergänge beim Zustandswechsel (≤ 150 ms), kein Blinken, kein Pulsieren; `prefers-reduced-motion`
  schaltet auch diese ab.

## 5 · Seitenaufbau je App-Typ

### 5.1 Typ „Live-Tool“

Titler, Switcher, Timer, Rundown, Q&A, Battle, Connect, Caption, Interpreter, Prompter, Stage-Display, Recorder, Player,
Studio-Control.

- **Kopfzeile** wie 3.2; `headerCenter` zeigt Show bzw. Master (bei Titler, Timer, Rundown kommt hier die Anzeige aus
  Master-Link 2b R2 hin, Abschnitt 9.2).
- **Live-Bereich:** das „immer sichtbare“ Element des Tools (Anhang A) oben bzw. links, ohne Klick erreichbar; darunter
  höchstens vier `TallyButton`s für die Haupttasten; Nebenbereiche als `Collapsible`, die ihren Zustand je Arbeitsplatz merken
  (`persistId`, vorhanden).
- **Einstellungen** im Panel (3.6), geöffnet über ⚙ oder einen Statuseintrag. Das Panel schiebt den Inhalt zusammen; das
  Live-Element bleibt sichtbar.
- **Statusleiste** nach 3.3. Typische Einträge: Master-Link, iveo · NDI, Bildschirm · Companion · toolspezifisch (Aufnahme,
  Audiogerät, Gegenstellen).

### 5.2 Typ „Werkzeug“

DAW, Editor, Grafiktool, App Designer, Copy, Media-Converter, Sync, Transcribe, Presenter (Editor-Ansicht).

Gleiche Kopfzeile und Statusleiste; darunter `toolbar` und die Arbeitsfläche (bestehende Splitter-Layouts bleiben).
Einstellungen ebenfalls im Panel. `TallyButton`s nur für echte Live-Aktionen (Presenter: „Präsentation starten“; DAW/Recorder-
ähnlich: Aufnahme). Topbar-Navigationen zwischen Bereichen (Copy, Grafiktool, Media-Converter, Sync, Studio-Control, Player)
nutzen `Tabs` statt handgebauter Leisten.

### 5.3 Sonderfälle

- **Launcher:** behält Katalog/Show-Aufbau; bekommt `AppHeader` und `StatusBar` (Verbund, iveo, Updates). Seine 9 Dialoge
  laufen über den vorhandenen `Modal` (einheitliche Größe, Kopf, Schließen, Escape). Kein Einstellungs-Panel für Tool-Starts.
- **NDI-Screen-Capture:** nur Kopfzeile, Statusleiste (NDI) und Einstellungen (Bildrate, Quelle).
- **Presenter:** zwei Ausprägungen in einer App — das Editor-Fenster als „Werkzeug“, das Referentenfenster als reduziertes
  Live-Tool (bleibt bühnendunkel, Haupttasten Zurück/Weiter/Schwarz/Weiß); das Publikumsfenster bekommt keinen Rahmen.
- **Studio-Control:** Live-Hub mit vielen Gerätepanels; statt einer globalen Haupttasten-Leiste bekommt jedes Gerätepanel
  seine `TallyButton`s (ATEM Cut/Auto/FTB/Aufnahme/Stream, OBS, PTZ). Vor dem Login zeigt der Rahmen den Zustand ohne
  Sitzung (3.8).
- **Ausgabefenster bleiben unverändert:** Titler-Output, Timer-Speaker, Prompter-Talent, Stage-Display-Bühne,
  Presenter-Audience, Player-Video-Ausgabe und alle NDI-Bilder sind **Programm**, nicht Bedienoberfläche. Sie gehören nicht
  zum Umfang.

## 6 · Einstellungs-Abschnitte in `@jm/settings`

Neues Paket `packages/settings` (`@jm/settings`, privat), hängt von `@jm/ui` ab und nur über **Typen** von
`@jm/control-config`. Kein IPC, kein Hauptprozess: Werte, Status und Aktionen kommen über Props.

### 6.1 Gemeinsamer Vertrag

```ts
interface SectionStatus { state: StatusState; text: string }      // StatusState aus 3.3
interface SectionBase {
  id: string;                  // Sprungziel für StatusItem.settingsSection
  status: SectionStatus;
  locked?: string;             // gesperrt + Grund, z. B. „Vom Master vorgegeben“
  error?: string;              // Fehlertext, immer unter den Feldern
}
```

- Kopf: Titel + Statuspille; Felder in fester Reihenfolge; Fehlertext immer an derselben Stelle.
- **Gesperrt nie ohne Grund.** Ist `locked` gesetzt, sind alle Felder gesperrt und der Grund steht sichtbar im Abschnitt.
- **Was ein Tool nicht kann, wird ausgeblendet**, nicht ausgegraut (gesteuert über `capabilities`-Props je Abschnitt).
- Texte (Titel, Feldnamen, Statustexte) liegen **fest im Paket**; ein Tool kann sie nicht umformulieren.

### 6.2 Die Abschnitte

| Abschnitt | Titel | Felder (in dieser Reihenfolge) | Status-Texte (Beispiele) |
|---|---|---|---|
| `NdiOutputSection` | NDI-Ausgabe | Ausgabe an/aus · Quellenname mit Vorschau des Namens im Netz · Auflösung* · Bildrate* · Transparenz* | „sendet“, „aus“, „Fehler: {detail}“ |
| `ScreenOutputSection` | Ausgabe auf Bildschirm | Bildschirm · Vollbild · Hintergrund* (z. B. Chroma-Grün) | „auf Bildschirm {n}“, „aus“, „Bildschirm fehlt“ |
| `RemoteControlSection` | Fernsteuerung | Modus offen/gesichert (Anzeige) · Port (Anzeige; Feld nur wo einstellbar, heute Switcher) · verbundene Clients · Hinweis Companion-Modul · Knopf „Im Launcher einrichten“ | „bereit · {n} verbunden“, „Neustart nötig“, „Port belegt“ |
| `AudioDeviceSection` | Audiogerät | ein oder mehrere benannte Geräte-Wahlen (z. B. Interpreter: Floor, Dolmetscher, Ausgabe) · je Wahl Pegelanzeige* | „{Gerät}“, „Gerät nicht gefunden, zuletzt: {name}“ |
| `IveoSection` | iveo | Status (verbunden, Event, Bühne) · Knopf „Im Launcher einrichten“ | „verbunden · {Event}“, „nicht eingerichtet“ |
| `PeersSection` (UO4) | Gegenstellen | je Rolle: Host · Port · Quelle (gefunden/manuell) · verbunden | „verbunden“, „nicht gefunden“, „manuell: {host}:{port}“ |
| `DataLinkSection` | DataLink | Ordner wählen · Status (Dateien gefunden, letzte Änderung) | „{n} Dateien · {hh:mm}“, „Ordner fehlt“, gesperrt „Vom Master vorgegeben“ |

`*` = nur wenn das Tool es kann (`capabilities`). Das iveo-Token bleibt wie heute ausschließlich im Launcher.

- **Fernsteuerung:** Modus und Token stehen in `control.json`, das nur der Launcher schreibt (`@jm/control-config`). In den
  Tools zeigt der Abschnitt deshalb Status und Modus und verweist zum Einrichten auf den Launcher; das Token erscheint nur
  im Launcher. Der Launcher nutzt denselben Abschnitt in **Vollform** (`variante: 'launcher'`: Modus schalten, Token
  erneuern/kopieren, TLS-Fingerabdruck) — so sieht die Einrichtung dort genauso aus wie die Anzeige in den Tools.
- **Audiogerät:** Geräte kommen aus zwei Quellen — Browser-Geräte (`MediaDevices`, Caption, Interpreter, Switcher, Sync) und
  PortAudio/ASIO über `@jm/audio` (Recorder, DAW). Der Abschnitt kennt nur `{ id: string; label: string }`; die App
  übersetzt ihre Quelle. Jede Wahl hat einen Namen, eine Richtung (Eingang/Ausgang), optional einen Pegel, einen Sperrgrund
  („Gesperrt, solange der Eingang offen ist“) und optional eine Warnung vor dem Wechsel („Ein Wechsel stoppt die laufende
  Verarbeitung“, Interpreter). Bei fehlendem Gerät wechselt er **nie still** auf den Standard, sondern zeigt den Text oben.
- **iveo-Knopf „Im Launcher einrichten“** öffnet den Launcher bei seinem iveo-Abschnitt (Deep-Link über `jmps://`; der Plan
  prüft, ob der vorhandene Weg das trägt).

Jeder Abschnitt exportiert neben der Komponente eine **reine Funktion**, die aus den Props den angezeigten Zustand ableitet
(Statuspille, Sperre, sichtbare Felder) — sie ist ohne Browser testbar (Abschnitt 11).

## 7 · Regeln für die Statusleiste (gegen lügende Statuszeilen)

Lehre aus #208 („dauerhafte Statuszeile lügt leichter als Schweigen“): eine immer sichtbare Anzeige muss in **jedem**
Zustand stimmen.

1. Jeder Eintrag wird im Plan als **Kreuzprodukt** seiner Eingangszustände getestet (z. B. NDI: aus/an × sendet/Fehler ×
   Name gesetzt/leer), nicht nur im Gut-Fall.
2. **Unbekannt ist nicht ok.** Weiß ein Tool einen Zustand (noch) nicht, zeigt der Eintrag `off` mit Text „unbekannt“,
   nie `ok`.
3. Ein Eintrag zeigt nur, was das Tool **gemessen** hat (Rückmeldung aus dem Hauptprozess), nicht, was es eingestellt hat.
   Wo ein Tool heute nur die Einstellung kennt, steht das im Text („an (ohne Rückmeldung)“) und in Anhang A als Lücke; für Master-Link und Fernsteuerung schließen die Status-Brücken (3.9) diese Lücke.
4. `live` gibt es nur für echte Sendezustände (On-Air-Quelle aus Anhang A), nie für „läuft“.

## 8 · Hell und Dunkel

Dunkel ist Standard, Hell wählbar über `ThemeToggle` in jeder Kopfzeile (3.7). Die zehn lokalen Knöpfe entfallen beim Umbau
der jeweiligen App. Die Tally-Bedeutungen (4.2) gelten in beiden Modi gleich. Connect, Battle, Caption und Interpreter
bekommen mit ihrem Umbau erstmals einen hellen Modus, weil sie dafür von rohen Farben auf Tokens umziehen.

## 9 · Rollout

### 9.1 Wellen

| Welle | Inhalt | Release |
|---|---|---|
| **0 · Fundament + Pilot** | `@jm/ui` (Abschnitt 3, 4), `@jm/settings` (6), Galerie (3.10); **Titler** als Pilot | Titler allein (Pakete werden mit den Apps gebündelt) |
| **1 · Live-Kern** | Switcher, Timer, Rundown, Q&A, Battle | gesammelt |
| **2 · übrige Live-Tools** | Connect, Caption, Interpreter, Presenter, Prompter, Stage-Display, Recorder, Player, Studio-Control | gesammelt |
| **3 · Launcher + Werkzeuge** | Launcher, Copy, Grafiktool, Media-Converter, Sync, DAW, Editor, Transcribe, App Designer, NDI-Screen-Capture | gesammelt |

Jede App einer Welle bekommt einen eigenen Versionssprung (Minor) und eigene Release-Notes; released wird nach der
Abnahme der Welle (Abschnitt 12) und nur mit Owner-Freigabe.

### 9.2 Reihenfolge mit den laufenden Vorhaben

- **Fundament (Welle 0 ohne Pilot) läuft sofort**, parallel zu Master-Link 2b R2 und Zoom 4b: es berührt nur
  `packages/ui` und das neue `packages/settings`, und es ist additiv (4.1).
- **Der Titler-Pilot beginnt erst nach dem Merge von 2b R2.** R2 baut in Titler, Timer und Rundown die Anzeige „Show vom
  Master“ ein und ändert deren Anwendungslogik; ein gleichzeitiger Umbau der Oberfläche ergäbe Konflikte in denselben
  Dateien. Beim Pilot wandert die R2-Anzeige in `headerCenter`, und die Master-Link-Brücke (3.9) kommt mit dem Pilot in `@jm/app-runtime` — nach dem Merge von 2b R2 und Zoom 4b, die dieses Paket gerade ändern.
- **Welle 1 beginnt erst nach der Owner-Abnahme des Pilots**, damit Erkenntnisse nicht in zehn Apps nachgebessert werden.
- **Connect erst in Welle 2 und erst nach dem Merge von Zoom 4b** (4b ändert die Zoom-Karte).

## 10 · Kein Funktionsverlust: Funktionsliste je App

- **Vor dem Umbau** einer App entsteht aus ihrem Code eine Funktionsliste: jedes Bedienelement mit Handler, jedes
  Tastaturkürzel, jeder Dialog, jede Einstellung (Datei `docs/ux/funktionslisten/<app>.md`).
- **Nach dem Umbau** wird jeder Punkt abgehakt, mit Ort im neuen Aufbau. Ein Punkt ohne Haken blockiert die Welle.
- **Tastaturkürzel bleiben gleich.** Kollisionen mit neuen Kürzeln (Escape im Panel, 3.1) löst der Plan zugunsten des
  bestehenden Kürzels.
- **Pflichtpunkt jeder Funktionsliste mit Einstellungs-Panel** (Nachtrag 09.10.2026 nach dem Fundament; entschieden
  09.10.2026 – Owner: wie umgesetzt, Frage O1 im Fundament-Plan unter „Umsetzung: Abweichungen vom Plantext“): was
  Leertaste und Escape auslösen, wenn der Fokus im Panel liegt – auf einem Feld (die Taste bleibt im Panel), auf einem
  Schalter oder Knopf (die Taste geht heute ans Tool: Leertaste = GO, der Schalter schaltet dann nicht) und Escape
  (schließt heute immer das Panel und erreicht das Tool nie, z. B. Player: Escape = Stop). Es gilt der Stand des
  Bausteins `SettingsPanel` (Owner-Entscheid 09.10.2026).
- **Bedienlogik, Protokolle, Ports, IPC und Hauptprozesse bleiben unverändert** (U6). Ändert sich beim Umbau doch etwas
  daran, ist das ein eigener, benannter Punkt im Plan.

## 11 · Tests

- **Bausteine und Abschnitte:** Render-Tests ohne Browser (`react-dom/server`, `renderToStaticMarkup`, unter `tsx`), die das
  erzeugte HTML prüfen — Texte, `aria-*`, Sperrgründe, Reihenfolge der Statusleiste, sichtbare Felder je `capabilities`.
  Dazu Logiktests der reinen Ableitungsfunktionen (6.2) und der Statusleisten-Regeln (7) als Kreuzprodukt.
  Neue Selbsttests: `npm run selftest -w @jm/ui`, `npm run selftest -w @jm/settings`, beide in den CI-Job „Selbsttests“.
- **Je App:** bestehende Selbsttests, Typprüfung und der CSP-Test (`@jm/app-runtime`) bleiben grün; neue Ableitungen (z. B.
  welche Statuseinträge ein Tool zeigt) bekommen einen Selbsttest der App.
- **Kontrast:** ein Test rechnet die Kontrastverhältnisse der Token-Paare (Text/Fläche, beide Modi) aus den oklch-Werten
  nach.
- **Grenze:** Kein Bildvergleich per Screenshot — Electron fehlt in der CI (Installation ohne Skripte). Das Aussehen prüfen
  Galerie (3.10) und Abnahme (12).

## 12 · Abnahme je Welle (Owner)

Datei `docs/ux/ABNAHME-UX-Welle-N.md` je Welle, mindestens:

1. Durchgang mit den echten, installierten Tools der Welle in einer Probe-Show.
2. Jedes Tool in Dunkel **und** Hell; Wechsel bleibt nach Neustart erhalten.
3. Kleines Fenster (< 900 px breit): Panel liegt über dem Inhalt, Statusleiste kompakt, nichts abgeschnitten.
4. Jeder Statuseintrag einmal in jedem erreichbaren Zustand (z. B. NDI aus/an, Companion verbunden/getrennt).
5. Haupttasten und Kürzel aus der Funktionsliste.
6. Einstellungen über ⚙ und über einen Statuseintrag öffnen; Sperrgründe sichtbar.

## 13 · Nicht-Ziele

- Keine Änderung der Live-Bedienlogik, der Protokolle, Ports oder Hauptprozesse.
- Keine Änderung der Ausgabefenster und NDI-Bilder (5.3).
- Keine gemeinsame Status-Leitung im Hauptprozess (F2) und kein suite-weiter Hell/Dunkel-Schalter (F1) in diesem Vorhaben.
- `cookbook-web` ist nicht dabei.

## 14 · Folgeaufgaben

- **F1** Hell/Dunkel suite-weit mit einem Schalter (braucht gemeinsame Einstellung über den Hauptprozess).
- **F2** Gemeinsame Status-Leitung: `@jm/app-runtime` meldet NDI/Companion/iveo/Master-Link selbst an die Oberfläche
  (Paket-Schnitt 3 aus dem Brainstorming); die Statusleisten aus diesem Vorhaben bleiben dabei unverändert.
- **F3** Alte UX-Roadmap `docs/ux/suite-ux-roadmap.md` auf eine Kurzfassung mit Verweis auf diese Spec kürzen (erledigt mit
  dem ersten Plan).
- **F4** Tastaturkürzel für die Live-Tools, die heute keine haben (UO5), suite-weit einheitlich (z. B. Leertaste = wichtigste
  Haupttaste).

## 15 · Risiken

| Risiko | Gegenmittel |
|---|---|
| Ein Token- oder Komponenten-Wert ändert sich und alle Apps sehen beim nächsten Release anders aus | 4.1 rein additiv; der Plan prüft per Test, dass bestehende Token-Werte unverändert sind |
| Konflikte mit 2b R2 (Titler, Timer, Rundown, Launcher) und 4b (Connect) | 9.2 Reihenfolge |
| Falsche Haupttasten oder „immer sichtbar“-Wahl je Tool | Anhang A ist Teil der Owner-Prüfung dieser Spec; der Pilot zeigt das Muster vor Welle 1 |
| Funktionsverlust beim Umbau | 10 Funktionsliste, blockierend |
| Statusleiste zeigt einen Zustand, der nicht stimmt | 7 Regeln + Kreuzprodukt-Tests |
| macOS: Ampel/Ziehfläche in der neuen Kopfzeile | 3.2 nutzt die vorhandenen `titlebar`-Helfer; Abnahme auch auf macOS, wo das Tool dort ausgeliefert wird |
| Aufwand über 25 Apps | Wellen mit eigener Abnahme; Welle 3 kann bei Bedarf geteilt werden |

## 16 · Offene Fragen an den Owner

| # | Frage | Vorgabe in dieser Spec |
|---|---|---|
| UO1 | Stimmen in Anhang A je Tool das „immer sichtbare“ Element und die Haupttasten? | die Vorschläge in Anhang A |
| UO2 | Soll das Fundament (Welle 0 ohne Pilot) schon starten, während 2b R2 umgesetzt wird? | ja (9.2) |
| UO3 | Dürfen die zwei **lesenden** Status-Brücken (Master-Link in `@jm/app-runtime`, Fernsteuerung je Tool) gebaut werden — eine kleine Ausnahme von „kein Umbau im Hauptprozess“ (3.9)? Ohne sie zeigen die meisten Tools „Master“ und „Companion“ als „unbekannt“. | ja |
| UO4 | Ein 7. gemeinsamer Abschnitt **„Gegenstellen“** (Host/Port je Rolle)? Battle, Q&A und Rundown haben dafür fast gleiche eigene Dialoge (69/73/89 Zeilen), Stage-Display ähnliche „Quellen“. | ja, als `PeersSection` in `@jm/settings` |
| UO5 | Zehn Live-Tools haben **gar keine** Tastaturkürzel (Titler, Switcher, Q&A, Battle, Connect, Caption, Interpreter, Stage-Display, Recorder, Studio-Control). Neue Kürzel wären neue Funktion. | nicht in diesem Vorhaben; Folgeaufgabe F4 |
| UO6 | Zählt beim App Designer „Auf Terminal starten“ als Live-Aktion (eigene Haupttaste)? | ja, eine Haupttaste |
| UO7 | Connect: GO und „Nächster Gast“ gibt es heute nur über Companion/Rundown, ohne Knopf. Eine Haupttaste dafür wäre neue Funktion. | nein, bleibt wie heute |
| UO8 | Player: Die Haupttasten (GO, Pause, Stop, Panic) gelten heute nur im Bereich „Cue-Show“. Sollen sie in allen drei Bereichen (Bibliothek, Soundboard, Cue-Show) sichtbar sein? | nein, nur in der Cue-Show; die Statusleiste zeigt laufende Cues überall |

---

## Anhang A · Je Tool

Stand: `origin/main`, gelesen am 2026-10-08 (per `git show` / `git grep`, nichts ausgeführt). Grundlage: `ux-inventar.md` (Methodik dort).
Pfade ohne Präfix sind relativ zu `apps/<app>/src/renderer/src/`. „(?)“ = nicht im Code bestätigt.
Verben = `packages/suite-control-protocol/src/capabilities.ts` (Companion/Rundown); STATE = dort gelistete Feedback-/Variablen-Schlüssel.

### A.0 Querschnitt-Befunde (gelten für mehrere Tools)

1. **Master-Link-Status gibt es schon in jedem Tool, aber nur im Main.** `@jm/app-runtime` startet in allen 24 Tools (außer Launcher, `masterLink: false`) einen `MasterLinkClient`; `getMasterLinkStatus()` liefert `aus | sucht | verbindet | verbunden(masterName) | fehler(code)` (`packages/master-link/src/client.ts`). Kein Renderer liest ihn heute. → **Eine** IPC-Brücke in app-runtime/preload speist den Statuseintrag „Master-Link“ suite-weit (im Folgenden „Master-Link¹“).
2. **Companion-Status liegt fast nirgends im Renderer.** 15 Apps haben einen Steuerserver (`src/main/control-server.ts`, Studio: `main/gateway/control-gateway.ts`; deckungsgleich mit den 15 Rollen in `capabilities.ts`). Die Ports sind als Konstante fest (bei Titler und Timer geprüft, sonst (?)), nur beim Switcher ist der Port einstellbar. Clientzahl/Port sieht der Renderer heute nur bei Switcher (`ControlStatus`), Titler (`status.suiteClients`) und Connect (`status.controlPort`). Für alle anderen braucht der Eintrag „Fernsteuerung“ eine neue IPC (im Folgenden „Companion²“). Modus/Token (open/secure) kommen aus `@jm/control-config` (`<appData>/JM Production Suite/control.json`, schreibt nur der Launcher). Im Tool zeigt der Abschnitt also nur Status an und bietet „Im Launcher einrichten“; nur Switcher hat ein Port-Feld.
3. **Es gibt zwei Arten von Audiogeräten.** MediaDevices-`deviceId` (Caption, Interpreter, Switcher, Sync) und PortAudio-Geräteindex (Recorder, DAW: `d.index`). Der Abschnitt „Audiogerät“ muss beide Quellen abbilden und mehrere Geräte zulassen (Interpreter hat drei: Floor, Dolmetscher, Ausgabe).
4. **Hell/Dunkel wird nirgends gespeichert.** Alle 10 vorhandenen Theme-Knöpfe sind lokal `useState<'dark'|'light'>('dark')` (z. B. `switcher/components/Topbar.tsx:12`), nach einem Neustart ist alles wieder dunkel. Connect, Battle, Caption und Interpreter sind wegen roher Farben nur dunkel. Der Umschalter im AppShell braucht eine gespeicherte Einstellung und vorher die Umstellung dieser Apps auf Tokens.
5. **Auf dem Mac fehlt die Ziehfläche.** Alle Hauptfenster laufen auf macOS mit `titleBarStyle: 'hiddenInset'`. `dragRegion`/`isElectronMac` (`packages/ui/src/lib/titlebar.ts`) nutzen aber nur 14 Apps. Ohne Ziehfläche und Ampel-Freiraum sind app-designer, battle, caption, connect, interpreter, prompter, qa, rundown, stage-display, titler und transcribe. Der gemeinsame Header behebt das nebenbei.
6. **„Verbindungen“ ist dreimal fast gleich gebaut.** `components/ConnectionsPanel.tsx` gibt es in battle (69 Z.), qa (73 Z.) und rundown (89 Z.), jeweils Modal mit Gegenstellen-Overrides (Host/Port je Rolle). Das ist ein Kandidat für einen 7. geteilten Abschnitt „Gegenstellen“ (nicht im freigegebenen Sechser-Set → Owner-Frage).
7. **Renderer laufen auch im Browser.** Sync (PWA, `platform.ts`), Timer (Speaker-View vom App-Server :7777) und Studio-Control (Socket :7778, `sync/client.ts`) laufen auch im Browser. AppShell und `@jm/settings` dürfen dort kein `window.jm*` voraussetzen.
8. **Tastenkürzel:** Live-Tools **ohne jedes Kürzel** sind Titler, Switcher, Q&A, Battle, Connect, Caption, Interpreter, Stage-Display, Recorder und Studio-Control. Mit Kürzeln: Timer (nur Countdown-Modus), Rundown, Presenter, Prompter, Player, DAW, Editor, Grafiktool, App Designer. TallyButtons zeigen nur vorhandene Kürzel; neue anzulegen ist eine Owner-Entscheidung, keine Migration.

---

### Welle 0

#### Titler (`apps/titler`) — Live-Tool, Pilot
- **Immer sichtbar:** CG-Vorschau-Canvas + Take/Clear (`views/OperatorView.tsx:285–310`); im Reiter „Steuerung“ oben Vorlage + „Inhalt“ (Namensfeld).
- **Haupttasten:** ● Take (`take()` aus `lib/engine.ts`, Verb `take`) · Clear (`clear()`, `clear`) · ◀ Eintrag / Eintrag ▶ (`window.jmtitler.stepEntry(∓1)`, Verben `prev`/`next`; nur bei aktivem DataLink). Kürzel: keine.
- **Tally/On-Air:** `live` aus `useTitlerEngine` → `reportState({onAir})` → STATE `on_air`.
- **Statuseinträge:** Master-Link¹ · iveo (`status.datenQuelle.art === 'show'`) · NDI (`status.ndiActive`, `connections` Empfänger) · 2. Bildschirm (`config.secondScreenEnabled`) · Companion (`status.suiteClients`, Port 8726 fest) · DataLink (`status.dataSources`, `dataError`, `hinweis` H1–H7, `entries`/`activeEntry`).
- **Einstellungen:** NDI-Ausgabe (Quellname, Auflösung, fps) · Ausgabe auf Bildschirm (Display, Chroma-Farbe, an/aus) · Fernsteuerung (heute **keine UI**, nur Pill) · iveo (Status-Text vorhanden, Z. 651) · DataLink (Watchfolder, „zurück zum eigenen Ordner“). Tool-eigen: Stil (Position, Größe, Farben Balken/Text/Akzent), Grafik-Vorlagen-Import (PSD/Grafiktool). Vorlage, Inhalt und Recall bleiben Bedienung, keine Einstellung.
- **Heute:** eigener Reiter „Einstellungen“ (`Tabs` + `SettingsSection`), letzte Wahl in `localStorage('titler.operator.tab')`; Header-Pills handgebaut; lokale `Field/Labeled/ColorField/Slider` (Z. 784–871). Rohe Farben: nein (1 Treffer).
- **Kürzel heute:** keine.
- **Besonderheiten/Risiken:** zwei Zusatzfenster `?view=output` (2. Bildschirm, `frame:false`, `main/index.ts:459`) und `?view=recall` (Recall-Board), dort kein AppShell. Kein mac-Drag. **Master-Link 2b R2 ändert gerade** DataLink/Datenquelle (`main/datalink.ts`, `show-quelle.ts`, `lib/datalink-anzeige.ts`, Hinweisblock in OperatorView). Ein Pilot auf derselben Datei braucht deshalb eine Merge-Absprache. Das Recall-Board zeigt dieselben Hinweise, damit es nicht auseinanderläuft.

### Welle 1

#### Switcher (`apps/switcher`) — Live-Tool
- **Immer sichtbar:** Preview/Program-Monitore + Cut/Auto/Dauer (`views/SwitcherView.tsx:537–590`). Der Mischer bleibt gemountet, während die Einstellungen offen sind (`App.tsx`: sonst bricht der Stream ab).
- **Haupttasten:** Cut (`engine.cut()`, `cut`) · Auto (`engine.auto()`, `auto`) · Aufnahme an/aus (`output.start/stopRecording`, `record`, toggleKey `recording`) · Stream an/aus (`output.start/stopStreaming`, `stream`, toggleKey `streaming`). Kürzel: keine.
- **Tally/On-Air:** Program ist immer „auf Sendung“. Kopf-Tally = `outputState.streaming` (LIVE) bzw. `recording` (REC). STATE `streaming`/`recording`, `program`.
- **Statuseinträge:** Master-Link¹ · NDI (`ndiOutState.active`, `.connections`, Quelle Program/Multiview) · 2. Bildschirm (`core/screenOutput.ts`, Stand im SettingsView) · Companion (`ControlStatus {running, port, clients}`, `window.jmswitch.control`) · Audio (`audioInputId`, Pegel/Mute im `AudioStrip`) · Aufnahme (`recPath`) · Stream-Ziel gesetzt ja/nein.
- **Einstellungen:** NDI-Ausgabe (Quellname) · Ausgabe auf Bildschirm (Zweiter Bildschirm) · Fernsteuerung (an/aus + **Port editierbar**, `store/settings.ts:23`) · Audiogerät (Programm-Audio, MediaDevices). Tool-eigen: Streaming (RTMP-URL inkl. Key, Bitrate), Aufnahme-Bitrate, Programm-Format (Auflösung/fps gilt für alle Ausgaben), Projekt (.jmswitch).
- **Heute:** eigener Topbar-Reiter „Einstellungen“ mit 6 `<section>`-Karten (`views/SettingsView.tsx`), Tab-Leiste handgebaut (`components/Topbar.tsx`), Theme-Knopf ungespeichert. Rohe Farben: wenig (SwitcherView 16× white/black, 7 Hex: Monitor-/Tally-Farben).
- **Kürzel heute:** keine (nur Enter/Esc beim Umbenennen).
- **Besonderheiten/Risiken:** sehr große View (SwitcherView 1823 Z.). 2. Bildschirm `frame:false` (`main/second-screen.ts`). Multiview-Overlay `fixed inset-0`. Die Projekt-Leiste (Neu/Öffnen/Speichern) gehört in die Toolbar. Ein Mischer ohne Kürzel ist eine Lücke (→ Owner).

#### Timer (`apps/timer`) — Live-Tool
- **Immer sichtbar:** laufende Zeit (`components/TimerDisplay.tsx`) mit Transport, je nach Modus `Countdown.tsx` (Start/Pause/Reset) oder `Timetable.tsx:150–190` (← Prev / Start·Resume / Pause / Reset / Next →).
- **Haupttasten:** Start/Pause (`start()`/`pause()`, Verben `start`/`stop`, Kürzel Leertaste nur im Countdown) · Reset (`reset()`, `reset`, Kürzel R nur im Countdown) · ← Prev / Next → (`ttPrev`/`ttNext`, Verb `goto`; ohne Kürzel).
- **Tally/On-Air:** STATE `running` (grün), `warning` (gelb), `overrun` (rot), ein Ampelzustand statt On-Air.
- **Statuseinträge:** Master-Link¹ · Sync-Socket (`SyncPill` in `components/Topbar.tsx`, Socket.IO :7777) · Speaker-Fenster (`window.jm.speaker.isOpen/onStatus`) · Companion² (Port 8724) · LAN-Remote (`RemoteInfo.tsx`: URLs, `auth.enabled`) · Drift Soll/Ist (`Timetable.tsx:68`).
- **Einstellungen:** Ausgabe auf Bildschirm (Speaker-Fenster; heute **keine Bildschirmwahl**, Main nimmt automatisch den 2. Monitor, `main/index.ts:~140`) · Fernsteuerung (Companion-Status + LAN-Remote-Token/URLs aus Modus „Remote“) · iveo (nur Status; der Ablauf kommt per Launcher-RELOAD, `shared/show-ablauf.ts`; im Renderer heute keine Anzeige). Tool-eigen: Farben/Timer-States (`ColorPicker.tsx`), Auto-Advance (`AutoAdvanceSettings.tsx`), Delay (`DelayControls.tsx`).
- **Heute:** Sidebar-Modi `clock/countdown/timetable/remote/settings(„Farben“)` (`components/Sidebar.tsx:13–17`). „Remote“ und „Farben“ wandern ins SettingsPanel, die drei Arbeitsmodi bleiben. Lokale `ui/StatusPill|Input|SectionHeader|Headline` (Duplikat Studio-Control). Theme-Knopf ungespeichert. Rohe Farben: nein.
- **Kürzel heute:** Leertaste = Start/Pause, R = Reset (`Countdown.tsx:43–49`, **nicht** im Timetable); MessageBar Enter = senden, Esc = leeren.
- **Besonderheiten/Risiken:** Speaker-View läuft zusätzlich im Browser (→ A.0/7). CSP `connect-src` für :7777 (`main/index.ts:380`, Falle „Lausch- ≠ Zieladresse“). **Master-Link 2b R2 ändert den Timer** (Show-Ablauf, RELOAD). Gleiche Kürzel im Timetable wären neu (→ Owner).

#### Rundown (`apps/rundown`) — Live-Tool
- **Immer sichtbar:** GO-Transport (`components/Transport.tsx`: ◀ / GO / ▶ + Quittung der zuletzt gefeuerten Zeile) und die scharfe Zeile in `RundownList.tsx`.
- **Haupttasten:** GO (`nav({t:'go'})`, Verb `go`, Leertaste) · ◀ Zurück (`prev`, ↑) · Weiter ▶ (`next`, ↓). Mehr nicht. `goto` läuft über einen Klick auf die Zeile.
- **Tally/On-Air:** keine eigene (Capabilities: `feedbacks: []`). Zeigt stattdessen die Tallys der verbundenen Tools (`ToolLinks.tsx:11`, truthy-Feedbacks je Rolle).
- **Statuseinträge:** Master-Link¹ · iveo (`state.iveoSpeakers`, `iveoSideEvents`) · Companion² (Port 8731) · je verbundenes Tool ein Eintrag (`state.links[].connected`, Quelle mDNS/manuell) · Hinweise (`state.hinweise`, stehend/kurz) · ungespeichert (`state.dirty`).
- **Einstellungen:** Fernsteuerung (nur Status) · iveo (nur Status). Tool-eigen: Gegenstellen/Verbindungen (`ConnectionsPanel.tsx`, Host/Port je Rolle, → A.0/6).
- **Heute:** einzige „Einstellung“ ist das Modal `ConnectionsPanel`. Header aus Text ohne Logo, Datei-Knöpfe als lokale `hdrBtn`. Kein Theme-Knopf. Rohe Farben: nein.
- **Kürzel heute:** Leertaste = GO, ↑ = Zurück, ↓ = Weiter (`App.tsx:34–53`, außerhalb von Eingabefeldern).
- **Besonderheiten/Risiken:** Der Transport sitzt heute **unten**, genau dort, wo die StatusBar hinkommt. Er muss nach oben bzw. unter die Liste. Die ToolLinks-Leiste ist bereits eine Statuszeile (Tally anderer Tools); Doppelung mit der StatusBar vermeiden. **Master-Link 2a/2b R2 ändert Rundown stark** (`shared/abgleich|scharf|sprung|zeilen.ts`, Hinweise, `RowEditor` mit iveo-Kennungen). Höchstes Konfliktrisiko in Welle 1.

#### Q&A (`apps/qa`) — Live-Tool
- **Immer sichtbar:** `components/ActivePanel.tsx` (aktiver Sprecher + Frage + „■ Beenden“ / „Nächste ▶“).
- **Haupttasten:** Nächste ▶ (`next()`, Verb `next`) · ■ Beenden (`endActive()`, `end`) · Saal-Einreichung an/aus (`setRemote(!remote.running)` in `RemotePanel.tsx`, STATE `remote`). „Redezeit verlängern“ (`extend`) und „Erledigte entfernen“ (`clear`) gibt es **nur** per Companion, ohne UI-Knopf; nicht als neue Taste anlegen.
- **Tally/On-Air:** STATE `live` (Sprecher am Wort).
- **Statuseinträge:** Master-Link¹ · Companion² (Port 8733) · Saal-QR-Server (`state.remote.running`, Port 7782) · Cloud/Extern (`state.cloud`, `CloudPanel.tsx`) · Kopplung Timer / Titler (`state.links` + `config.autoTimer/autoTitler`, Dreifarb-Logik `App.tsx:62–70`) · wartend (`{waiting}` im Header).
- **Einstellungen:** Fernsteuerung (Status). Tool-eigen: Redezeit, Auto-Timer, Auto-Bauchbinde, Titler-Vorlage, Moderation, Cloud (Proxy-URL, Proxy-Key verschlüsselt, Event, Presse-Code), Gegenstellen (`ConnectionsPanel`).
- **Heute:** Modal `components/Settings.tsx` (lokales `Row`) + Modal `ConnectionsPanel.tsx`. Kopplungs-Karte inline rechts (An/Aus-Knöpfe gehören eher in die StatusBar bzw. ins Panel). Text-Header ohne Logo. Rohe Farben: kaum (4).
- **Kürzel heute:** keine (nur Enter in `AddForm.tsx`).
- **Besonderheiten/Risiken:** QR-Code-Erzeugung lokal (`lib/qr.ts`, ebenso battle/prompter/connect). Ist die Kopplung aktiv, aber die Gegenstelle nicht gefunden, steht das heute ehrlich als Warnung da; diesen Zustand in der StatusBar erhalten (Lehre „Statuszeile lügt leichter“).

#### Battle (`apps/battle`) — Live-Tool
- **Immer sichtbar:** Header-Knopf „VS einblenden / ● VS on air“ (`App.tsx:40–47`) + `Scoreboard.tsx` (Runde, Jury-Entscheid, Stimmen).
- **Haupttasten:** VS on air (`setLive(!state.live)`, Verb `vs`, toggleKey `live`) · Voting öffnen/schließen (`setVotingOpen`, `voting`) · Nächste Runde (`nextRound()`, `next`; ◀ `prevRound`) · Replay-Clip (`clip()` in `ClipPanel.tsx`, `replay`). Kürzel: keine.
- **Tally/On-Air:** STATE `live` (VS-Bauchbinde on air), zusätzlich `voting` (gelb).
- **Statuseinträge:** Master-Link¹ · Companion² (Port 8734) · Voting-Server (`state.remote.running`, Port 7783, QR) · Titler-Kopplung (`titler?.connected`, `App.tsx:~73`) · Aufnahme-Quelle für Replay (`cfg.recordingPath` gesetzt?).
- **Einstellungen:** Fernsteuerung (Status). Tool-eigen: Runden, Publikums-Voting erlaubt, VS automatisch, Clip-Länge/Ordner, „Battle zurücksetzen“ (gefährlich, mit Bestätigung), Gegenstellen.
- **Heute:** Modal `components/Settings.tsx` (lokales `Modal`/`Row`) + Modal `ConnectionsPanel`. **Rohe Farben: ja** (79× neutral-*, nur dunkel). Text-Header ohne Logo.
- **Kürzel heute:** keine.
- **Besonderheiten/Risiken:** Die Token-Umstellung ist Voraussetzung für Hell/Dunkel. Jury-Entscheid A/B/Unentschieden bleibt im Scoreboard (pro Runde, keine Haupttaste). „Reset“ darf nicht in die Haupttasten.

### Welle 2

#### Connect (`apps/connect`) — Live-Tool
- **Immer sichtbar:** Gästeliste mit Phase + Aktionen (`App.tsx:313–363`, `GuestActions`: Freigeben/Ablehnen/Auf Sendung/Standby/Aus Sendung/Entfernen) + Talkback-Taste.
- **Haupttasten:** Raum öffnen / schließen (`openRoom`/`closeRoom`) · Talkback alle (`PttButton`: **Halten zum Sprechen**, `talkbackDown(null)`/`talkbackUp`, Verb `talkback`). GO (Standby → Sendung, Verb `go`) und „Nächster Gast“ (`next`) gibt es **nur** per Companion/Rundown (`App.tsx:216`), ohne UI-Knopf; eine GO-Taste wäre neue Funktion (→ Owner).
- **Tally/On-Air:** STATE `onair` (Anzahl Gäste auf Sendung, `onAirGuests(room)`), dazu `lobby` und `talkback` (gelb).
- **Statuseinträge:** Master-Link¹ · Raum/SFU (`connected`) · Proxy konfiguriert (`status.configured`, `proxyKeySource`) · Programm-Rückkanal (`ProgramBadge`, `status.programState/programSource`) · NDI je Gast (`ndiUp/ndiDown`, Pool) · Companion (`status.controlPort`, 8737) · Presenter gekoppelt (`status.presenterLinked`) · Zoom (`status.zoom` → `zoomZeile`).
- **Einstellungen:** Fernsteuerung (Status) · iveo (Status: Sprecher aus der Show, `ShowCard`). NDI-Namen sind automatisch je Gast, kein Abschnitt (?). Tool-eigen: Proxy-URL/Key (`ProxyCard`), Zoom-Einrichtung (SDK-Ordner, SDK-Schlüssel, Zugang; `zoom/ZoomCard.tsx` 808 Z.).
- **Heute:** einspaltige Seite `max-w-3xl`, Karten inline, Header als h1 mit Textzeilen rechts. **Rohe Farben: ja** (159 Treffer), eigenes `index.css` **ohne** `@jm/ui/base.css`, `color-scheme: dark` hart, `background:#121212`. Kein `@jm/ui`.
- **Kürzel heute:** keine (Enter in ProxyCard/ZoomCard-Feldern).
- **Besonderheiten/Risiken:** **Zoom 4b ändert gerade `ZoomCard.tsx` + `main/zoom/*`.** Connect deshalb ans Ende von Welle 2, ZoomCard nur umhängen, nicht umbauen. Unsichtbares Peer-Fenster (`peer.html`, `main/peer-window.ts`) bekommt kein AppShell. Eigene CSP-Meta in `renderer/index.html:8`. TallyButton muss Press-and-Hold (Pointer down/up/cancel) können. Größter Umbau von allen (kein Token, kein Layout-Raster).

#### Caption (`apps/caption`) — Live-Tool
- **Immer sichtbar:** Untertitel-Vorschau (Canvas aus `lib/ndi-engine.ts`) + Zeilenverlauf mit „letzte Zeile korrigieren“ (`App.tsx` unterer Teil).
- **Haupttasten:** ● Start / ■ Stopp (`start()`/`stop()`, Verb `transcribe`, toggleKey `running`) · Hold (`setHold`, `hold`) · Leeren (`clear()`, `clear`) · NDI an/aus (`ndiStart/ndiStop`, `ndi`). Kürzel: keine.
- **Tally/On-Air:** STATE `running` (+ `ndi`). Hold gelb.
- **Statuseinträge:** Master-Link¹ · NDI (`status.ndiActive`, `connections`) · Companion² (Port 8732) · Audiogerät (`config.audioInputDeviceId`, Pegel `level`) · Whisper-Engine (`whisperAvailable`, `busy`, `config.engine` server/cli, Modell) · Fehler (`state.error`).
- **Einstellungen:** NDI-Ausgabe (Quellname, Auflösung, fps) · Audiogerät (MediaDevices) · Fernsteuerung (Status). Tool-eigen: Modell, Sprache, Schrift/Zeilen/Band, Wörterbuch, Engine, Stille-Parameter (`CaptionConfig`).
- **Heute:** alles **inline im Header** (Modell/Sprache/Gerät neben Start) + eigene NDI-Leiste + „Erweitert“-Klappe. **Rohe Farben: ja** (59), kein Logo, kein `@jm/ui`.
- **Kürzel heute:** keine (Enter beim Korrigieren).
- **Besonderheiten/Risiken:** Beim Umzug ins SettingsPanel darf sich das Neustartverhalten des whisper-servers bei Modell- oder Engine-Wechsel nicht ändern (heutiges Verhalten nicht geprüft (?)). Inline-Bedienung des Headers schrumpft auf die Haupttasten.

#### Interpreter (`apps/interpreter`) — Live-Tool
- **Immer sichtbar:** Pegel Floor/Dolmetscher + Ducking-Anzeige „FLOOR ABGESENKT / Floor offen“ (`App.tsx:136–148`).
- **Haupttasten:** Starten / Stoppen (`toggle` → `InterpreterEngine.start/stop`). Mehr Live-Aktionen gibt es nicht. Kürzel: keine.
- **Tally/On-Air:** `state.running` (Engine). Ducking aktiv = `state.ducking`. Kein Steuerserver, kein STATE.
- **Statuseinträge:** Master-Link¹ · Ausgabe-Kabel (`detectCable`/`counterpartPresent`, Zoom-Gegenstück, `deviceCableNotice`) · Audiogeräte (Floor/Dolmetscher/Ausgabe gewählt + `labelsAvailable`) · Ducking (`state.ducking`).
- **Einstellungen:** Audiogerät (**drei** Picker: Floor, Dolmetscher, Ausgabe = virtuelles Kabel; MediaDevices). Tool-eigen: Ducking (Schwelle, Absenkung, Attack, Release, Nachlauf), Pegel Floor/Dolmetscher, „Werte zurücksetzen“ (`store/settings.ts`).
- **Heute:** einspaltige Seite `max-w-4xl`, h1-Header, Karten inline. **Rohe Farben: ja** (46). Kein `@jm/ui` (base.css ja).
- **Kürzel heute:** keine.
- **Besonderheiten/Risiken:** Ein Gerätewechsel stoppt heute die laufende Engine (`App.tsx:82`). Im SettingsPanel muss das sichtbar bleiben (Warnung vor dem Wechsel im Live-Betrieb). Kein Companion: der Abschnitt „Fernsteuerung“ entfällt.

#### Presenter (`apps/presenter`) — Sonderfall (Live-Tool mit drei Fenstern)
- **Immer sichtbar:** Editor-Fenster: „▶ Präsentieren“ (`components/Toolbar.tsx:270`). Referentenfenster: aktuelle + nächste Folie, Nav (`views/PresenterView.tsx:100–125`).
- **Haupttasten (Referentenansicht):** ◀ Zurück (`jmpr.present.prev`) · Weiter ▶ (`next`) · Schwarz (`setScreen('black')`, Taste B) · Weiß (`setScreen('white')`, W). Dazu „■ Beenden“ (`stop`, Esc) als Kopf-Aktion. Verben `prev/next/black/white/stop`.
- **Tally/On-Air:** STATE `active` (Präsentation läuft), `live`; `black`/`white` als Sonderzustand.
- **Statuseinträge:** Master-Link¹ · Publikums-Bildschirm (Display-Wahl `Toolbar.tsx:152`, Vollbild) · Companion² (Port 8728) · Handy-Fernsteuerung (`RemotePanel`: `status.running`, Port 7330, PIN) · JM-Timer-Sync (`timerConnected`, Host/Port 7777).
- **Einstellungen:** Ausgabe auf Bildschirm (Publikums-Bildschirm) · Fernsteuerung (Companion-Status + Handy-Remote: an/aus, Interface, Port, PIN). Tool-eigen: „Office-Animationen splitten“ (experimentell), Timer-Sync (an/aus, Host, Port).
- **Heute:** ⚙-Dropdown mit 2 Schaltern (`Toolbar.tsx:165–260`, `fixed inset-0`-Klickfänger) + Modal `RemotePanel` aus der Referentenansicht. Rohe Farben: PresenterView/RemotePanel dunkel fest (`white/black` 38×).
- **Kürzel heute:** 16 Tasten in `lib/usePresentation.ts:42–83` (→ ↓ PgDn Leertaste Enter = weiter; ← ↑ PgUp Backspace = zurück; Pos1/Ende; B/. schwarz; W/, weiß; Esc beenden), nur im Referentenfenster aktiv. Handy-Seite `main/remote-page.ts` eigene Tasten.
- **Besonderheiten/Risiken:** drei Fenster (`main/windows.ts`: Editor/Presenter/Audience). Das Audience-Fenster bekommt **kein** AppShell, das Referentenfenster ein reduziertes (Bühnen-Dunkel bleibt erwünscht). Der Editor ist eigentlich „Werkzeug“-Layout (3 Spalten). Das AppShell muss zwei Ausprägungen in einer App tragen.

#### Prompter (`apps/prompter`) — Live-Tool
- **Immer sichtbar:** Vorschau + Transport (`views/OperatorView.tsx:95–125`: Abschnitt ◀, GO/Pause, ▶ Abschnitt, −3 / Anfang / +3).
- **Haupttasten:** GO/Pause (`jmprompt.transport.toggle()`, Verb `scroll`, toggleKey `scrolling`, Leertaste) · An den Anfang (`transport.reset()`, `top`, Pos1) · ◀ Abschnitt / Abschnitt ▶ (`jumpMarker(∓1)`, ohne Kürzel).
- **Tally/On-Air:** STATE `scrolling`; Ausgabe offen = `outputOpen` (Store).
- **Statuseinträge:** Master-Link¹ · Talent-Monitor (`outputOpen`, Display) · Companion² (Port 8727) · Handy-Fernbedienung (`setRemote`, URLs/QR) · Tempo (`speed`).
- **Einstellungen:** Ausgabe auf Bildschirm (Talent-Monitor: Display, Vollbild öffnen/schließen) · Fernsteuerung (Companion-Status + Handy-QR). Tool-eigen: Lauf & Schrift, Lese-Linie, Darstellung (Spiegeln etc.).
- **Heute:** Sidebar mit lokalem `Section` (5 Abschnitte, `OperatorView.tsx:128–240`), lokales `Toggle`. Kein Theme-Knopf. Rohe Farben: nein.
- **Kürzel heute:** Leertaste = GO/Pause, ↑/↓ = nudge ±1 (mit Shift ±3), Pos1 = Anfang (`lib/useHotkeys.ts`); gelten auch im Ausgabefenster. Der Header zeigt sie heute als Text an (`OperatorView.tsx:47`).
- **Besonderheiten/Risiken:** Ausgabefenster über `@jm/output-window` (`PrompterOutputView.tsx`), dort kein AppShell. Kein mac-Drag.

#### Stage-Display (`apps/stage-display`) — Live-Tool
- **Immer sichtbar:** Live-Vorschau `components/StageScreen.tsx` + Ad-hoc-Nachricht (`views/OperatorView.tsx:163–170`).
- **Haupttasten:** Bühnenschirm öffnen / auf diesen Bildschirm / schließen (`openOutput`/`closeOutput`). Sonst keine Live-Aktion; die Nachricht ist ein Textfeld, keine Taste. Kürzel: keine.
- **Tally/On-Air:** keine echte; „Ausgabe offen“ = `outputOpen` (`store/stage.ts:6`). Kein Steuerserver.
- **Statuseinträge:** Master-Link¹ · Bühnenschirm (`outputOpen`, Display) · Quelle Timer (`state.timer.connected`, :7777) · Quelle Switcher (`state.switcher.connected`, Companion-Port 8723) · Quelle Presenter (`state.presenter.connected`, :7330).
- **Einstellungen:** Ausgabe auf Bildschirm (Bühnenschirm). Tool-eigen: Quellen (an/aus, Host, Port je Timer/Switcher/Presenter, Presenter-Modus), Anzeige-Elemente (Uhr/Timer/Switcher/Presenter/Nachricht). Das sind eher Gegenstellen (→ A.0/6).
- **Heute:** inline, lokales `Section`/`SectionHeader` (Ausgabe, Quellen, Elemente, Nachricht). Rohe Farben: im StageScreen (Bühnenbild, gewollt). Kein Theme-Knopf.
- **Kürzel heute:** keine.
- **Besonderheiten/Risiken:** Ausgabefenster `views/StageOutputView.tsx` via `@jm/output-window` ohne AppShell. Kein Companion → Abschnitt „Fernsteuerung“ entfällt. Kein mac-Drag.

#### Recorder (`apps/recorder`) — Live-Tool
- **Immer sichtbar:** Transport + Kanal-Meter (`views/RecorderView.tsx:116–150`, Meter ab Z. 215).
- **Haupttasten:** Eingang öffnen (`arm()`, Verb `arm`) · Aufnahme / Stopp (`record()`/`stop()`, `record`, toggleKey `recording`) · Eingang schließen (`disarm()`, `disarm`). Kürzel: keine.
- **Tally/On-Air:** STATE `recording` (rot), `armed` (gelb), Quelle `state.status` idle/armed/recording.
- **Statuseinträge:** Master-Link¹ · Companion² (Port 8729) · Audiogerät (`deviceIndex`, Kanäle, Samplerate) · Aufnahme (Dauer, `filePath`) · Zeitplan (Auto-Stopp-Badge, `ScheduleCard`).
- **Einstellungen:** Audiogerät (**PortAudio-Index**, Kanäle, Samplerate; gesperrt, solange offen). Tool-eigen: Zielordner, Dateiname, Spuren einzeln, Gain, Zeitplan (bleibt im Arbeitsbereich).
- **Heute:** inline Karten (Eingang/Kanäle/Samplerate/Ziel) mit lokalem `Field`. Theme-Knopf ungespeichert (`components/Topbar.tsx`). Rohe Farben: nein.
- **Kürzel heute:** keine.
- **Besonderheiten/Risiken:** Geräte-Felder sind gesperrt, solange der Eingang offen ist (`disabled={open}`), und das muss im SettingsPanel so bleiben. Geräte kommen aus dem nativen `@jm/audio` (PortAudio/ASIO, `main/recorder.ts:22`, lazy geladen); ohne gebautes Addon ist die Liste leer, und das gehört als Fehlerzustand in die StatusBar.

#### Player (`apps/player`) — Live-Tool
- **Immer sichtbar:** im Abschnitt „Cue-Show“ die Transportleiste (`views/ShowView.tsx:185–210`: Pause, Stop, Panic, GO). Bibliothek und Soundboard haben eigene Bedienung.
- **Haupttasten:** GO (`showGo`, Verb `go`, Leertaste) · Pause/Weiter (`showTogglePause`, `pause`) · Stop (`showStop`, `stop`, Esc) · Panic (`showPanic`, `panic`).
- **Tally/On-Air:** STATE `playing` (grün), `paused` (gelb); im Renderer `playingCueIds`/`showPaused`.
- **Statuseinträge:** Master-Link¹ · Video-Ausgabe (`window.jmplay.output.isOpen`, Display, Vollbild) · Companion² (Port 8725) · Standby-Cue / laufende Cues.
- **Einstellungen:** Ausgabe auf Bildschirm (Video-Ausgabe: Display-Wahl, Vollbild). Audio-Ausgabegerät: **keins** (kein `setSinkId` im Code). Tool-eigen: Cue-Einstellungen je Cue (⚙ an der Zeile, Modal), Soundboard-Pad-Hotkeys.
- **Heute:** Modal „Video-Ausgabe“ (`ShowView.tsx:234`, `fixed inset-0`) + Cue-Dialoge als Modals. Topbar-Abschnitte Bibliothek/Soundboard/Cue-Show, Theme-Knopf ungespeichert, lokales `Field`. Rohe Farben: kaum.
- **Kürzel heute:** Cue-Show: Leertaste = GO, Esc = Stop (`ShowView.tsx:38–53`). Soundboard: frei belegbare Pad-Hotkeys (`SoundboardView.tsx:42–55`, `cue.hotkey`). Bibliothek nur Enter/Esc.
- **Besonderheiten/Risiken:** Der GO-Knopf ist mit „GO ⏎“ beschriftet, ausgelöst wird aber die **Leertaste**, Enter nicht (Widerspruch, TallyButton-Kürzel richtig zeigen). Die Haupttasten gelten nur in der Cue-Show. Soll das Immer-sichtbar-Element abschnittsübergreifend sein? (→ Owner). Ausgabefenster `main/output-window.ts` ohne AppShell.

#### Studio-Control (`apps/studio-control`) — Sonderfall (Live-Hub)
- **Immer sichtbar:** Abschnitt „Video“ mit Gerätepanels (`views/Video.tsx`: Tricaster, ATEM, OBS, PTZ). Ein einzelnes primäres Element gibt es nicht.
- **Haupttasten:** keine globalen. Je Gerätepanel die vorhandenen Tasten als TallyButtons: ATEM Cut/Auto/FTB/Aufnahme/Stream (`AtemPanel.tsx:133–160`, `exec({type})`, Verben `atem_cut/atem_auto/atem_ftb/atem_record/atem_stream`), OBS Szene/Rec/Stream, PTZ-Presets. Kürzel: keine.
- **Tally/On-Air:** STATE `atem_pgm`, `atem_rec`, `atem_stream`, `obs_rec`, `obs_stream`, `lighting_blackout` (Gateway). Kopf-Tally = „irgendein Gerät nimmt auf oder streamt“ (?).
- **Statuseinträge:** Master-Link¹ · Studio-Server-Socket (`SyncPill`, Socket.IO :7778) · Geräte verbunden (atem/obs/tricaster/ptz/audio/lighting) · Companion-Gateway (Port 8735, `main/gateway/control-gateway.ts`; im Renderer kein Status) · Benutzer/Rolle (`useSession`).
- **Einstellungen:** Fernsteuerung (Gateway-Status). Tool-eigen: Setup (Geräte-Inventar, Discovery, Benutzer, `views/Setup.tsx`), Login/Logout.
- **Heute:** Topbar-Abschnitte Video/Audio/Licht/Setup (handgebaute Nav). Audio und Licht sind als „Coming soon“ beschriftet, obwohl `AudioView`/`LichtView` gerendert werden (`App.tsx:137–138`), die Beschriftung ist also veraltet. Lokale `ui/StatusPill|Input|SectionHeader|Headline` (Duplikat Timer). Theme-Knopf ungespeichert. Rohe Farben: nein.
- **Kürzel heute:** keine.
- **Besonderheiten/Risiken:** Login-Gate (`if (!user) return <LoginView/>`), das AppShell muss einen Zustand ohne Sitzung haben. Der Renderer läuft auch im Browser (→ A.0/7). Größte Fläche an Gerätepanels (27 tsx). „Max. 4 Haupttasten“ passt nicht auf einen Hub. Vorschlag: Tallys pro Panel, keine globale Leiste (→ Owner).

### Welle 3

#### Launcher (`apps/launcher`) — Sonderfall (Hub)
- **Immer sichtbar:** Reiter „Werkzeuge“ (`ToolboxView`) bzw. „JM Show“ (`ShowView` mit Aktions-Karten). Kopf mit `VerbundBadge` und Icon-Knöpfen (`components/Header.tsx`).
- **Haupttasten:** Show öffnen / starten (`openShow()`) · Side Events (`openSideEvents`, Verb `sideevent`; nur bei iveo-Show, live umschalten nur mit `iveoActive.canSwitch`). Mehr nicht; der Launcher hat keine Sende-Aktion.
- **Tally/On-Air:** keine. Mittiger Kopf-Slot = Show + Master-Link-Kopf (`lib/kopfanzeige.ts`, Farben gedämpft/neutral/grün/gelb/rot, Spec 5.4).
- **Statuseinträge:** Master-Link (Rolle Master/Slave, `store/verbund.ts`, `kopfanzeige.ts`) · iveo (`lib/iveo-status.ts`, Status-Chips) · Steuerebene (`getControlStatus()`: offen/sicher, TLS) · laufende Tools (`SystemStatusModal`, `runningCount` in TabBar) · Update-/Katalogquelle (GitHub/Proxy, `SettingsModal.tsx:231`) (?).
- **Einstellungen:** iveo in **Vollform** (Basis-URL; in den Tools nur Status) · Fernsteuerung in **Vollform** (Sichere Steuerebene aktivieren/erneuern/aus, Token, TLS-Fingerprint; Quelle von `control.json`). Tool-eigen: GitHub-Token, interner Proxy, Katalog-URL, Verbund/Master-Link (Rolle, Koppeln, `VerbundModal`).
- **Heute:** 9 Modals + Lade-Overlay (`App.tsx:64–75`), 12× `fixed inset-0`. Settings-Modal mit `ControlPlaneSection` + `VerbundSection`. Theme-Knopf ungespeichert. Rohe Farben: kaum (16× white/black).
- **Kürzel heute:** nur Esc in System-Status- und Verbund-Modal, Enter in Eingabefeldern.
- **Besonderheiten/Risiken:** **Master-Link 2b R2 ändert den Launcher stark** (Verbund*, show-lesen/-schreiben, iveo-sync, `kopfanzeige`). Deshalb Welle 3. Der Launcher ist Quelle der Wahrheit für iveo und Steuerebene, die Tool-Abschnitte verlinken hierher („Im Launcher einrichten“ braucht einen Deep-Link ins SettingsPanel). Startet selbst keinen MasterLinkClient über app-runtime.

#### Copy (`apps/copy`) — Werkzeug
- **Immer sichtbar:** im Abschnitt „Kopieren“ Quelle → Ziele → Optionen → Start/Abbrechen + Fortschritt (`views/CopyView.tsx:94–190`).
- **Haupttasten:** keine (Start/Abbrechen = Toolbar-Aktion eines Jobs, keine Sendeaktion).
- **Tally/On-Air:** keine. Laufender Job = `job.running`.
- **Statuseinträge:** Master-Link¹ · Job läuft / Fortschritt (`store/job.ts`) · Auto-Sync aktiv (`job.auto.mode` watch/interval, `views/SyncView.tsx:49`) (?).
- **Einstellungen:** keiner der sechs. Tool-eigen: Verifizieren/MHL/+MD5 (pro Job, bleibt im Arbeitsbereich), Ordnervorlagen.
- **Heute:** Topbar-Abschnitte copy/sync/templates/verify (handgebaut), alles inline. Lokale `Section` (SyncView), `Toggle`. Theme-Knopf ungespeichert. Rohe Farben: nein.
- **Kürzel heute:** keine (Enter in `TemplatesView.tsx:206`).
- **Besonderheiten/Risiken:** gering. Die Auto-Sync-Jobs laufen im Hintergrund, ein Statuseintrag macht das sichtbar.

#### Grafiktool (`apps/grafiktool`) — Werkzeug
- **Immer sichtbar:** Canvas + Tool-Dock + rechtes Panel (`views/EditorView.tsx`, `components/editor/*`).
- **Haupttasten:** keine.
- **Tally/On-Air:** keine.
- **Statuseinträge:** Master-Link¹ · KI-Maskenmodell verfügbar (`components/editor/useAiStatus.ts`) · Dokumentgröße/Zoom (?).
- **Einstellungen:** keiner der sechs. Tool-eigen: Werkzeugoptionen (`ToolOptionsBar`), Farben, Ebenen, Schriften.
- **Heute:** Topbar-Abschnitte editor/bibliothek + Tool-Dock, eigene `ui/Select.tsx`, lokales `Toggle`. Theme-Knopf ungespeichert. Rohe Farben: 16 Hex (Werkzeugfarben, eher gewollt).
- **Kürzel heute:** ca. 25 (`views/EditorView.tsx:11–90`): Werkzeuge V B E G M L W U T C I H Z, Strg+Z/Y/A/D/I/T, Entf/Rücktaste, X, [ ], Esc (`engine/render/EditorController.ts:766`).
- **Besonderheiten/Risiken:** dichte Editorfläche. Header und StatusBar dürfen keine Höhe kosten (Kompaktvariante). Ein-Buchstaben-Kürzel kollidieren nicht mit dem AppShell, solange dieses keine eigenen ohne Modifier anlegt.

#### Media-Converter (`apps/media-converter`) — Werkzeug
- **Immer sichtbar:** Drop-Zone + Liste + „Konvertieren“ (`views/VideoView.tsx`, `views/DocumentView.tsx:110`) + Jobs-Sidebar rechts.
- **Haupttasten:** keine.
- **Tally/On-Air:** keine.
- **Statuseinträge:** Master-Link¹ · Jobs laufend/fertig (`store/jobs.ts`) · Encoder/GPU-Unterstützung (`EncoderSupport`) · LibreOffice gefunden (`soffice`, `DocumentView.tsx:17`).
- **Einstellungen:** keiner der sechs. Tool-eigen: Presets, Ratensteuerung, Zielordner (bleiben im Arbeitsbereich).
- **Heute:** Topbar-Abschnitte video/office, eigene `components/Select.tsx`, lokales `Toggle`, `PreviewModal`. Theme-Knopf ungespeichert. Rohe Farben: kaum.
- **Kürzel heute:** keine.
- **Besonderheiten/Risiken:** gering. Die Jobs-Sidebar rechts konkurriert mit dem rechts einfahrenden SettingsPanel (Überlagerung statt Verdrängung).

#### Sync (`apps/sync`) — Werkzeug (Messgerät am Set)
- **Immer sichtbar:** Offset-Anzeige (`components/OffsetReadout.tsx`) + Verlauf (`HistoryGraph.tsx`) in `views/MeasureView.tsx`.
- **Haupttasten:** Messung starten / Stoppen (`start(false)`/`stop`, `MeasureView.tsx:157–173`). Im Generator: Starten/Stopp + Vollbild (`GeneratorView.tsx:103–110`). Kein Steuerserver, keine Verben.
- **Tally/On-Air:** keine. Messung läuft = lokaler Zustand (?).
- **Statuseinträge:** Master-Link¹ (nur Electron) · Video-/Audioquelle (`useSettings.videoId/audioId`, Berechtigungsfehler `NotReadable`) · Kalibrierung gesetzt (`store/calibration.ts`) (?).
- **Einstellungen:** Audiogerät (+ Videoquelle; MediaDevices). Tool-eigen: Kalibrierung (eigener Abschnitt „calibrate“).
- **Heute:** Topbar-Abschnitte measure/generator/calibrate, Geräte inline in MeasureView (lokales `Field`). Theme-Knopf ungespeichert. Rohe Farben: nein.
- **Kürzel heute:** keine (Doppelklick = Vollbild im Generator).
- **Besonderheiten/Risiken:** läuft auch als **PWA im Browser** (`platform.ts`, `public/manifest.webmanifest`). Dort gibt es weder Master-Link noch `window.jms`, und AppShell und `@jm/settings` müssen ohne Electron rendern.

#### DAW (`apps/daw`) — Werkzeug (mit Live-Transport)
- **Immer sichtbar:** Transport + RecordBar über der Timeline (`components/Transport.tsx`, `RecordBar.tsx`).
- **Haupttasten:** Play/Stop (`setPlaying`, Verben `play/stop/toggle`, Leertaste) · Aufnahme (`armFlow`/`startRecFlow`/`stopRecFlow`, Verb `rec`, toggleKey `recording`).
- **Tally/On-Air:** STATE `recording` (rot), `playing` (grün) (`lib/remote-control.ts`).
- **Statuseinträge:** Master-Link¹ · Companion² (Port 8730) · Aufnahme-Eingang (`rec.deviceIndex`, Kanäle, `rec.status` armed/recording) · Projekt ungespeichert (?).
- **Einstellungen:** Audiogerät (**PortAudio-Index**, Mono/Stereo; gesperrt, solange armed) · Fernsteuerung (Status). Tool-eigen: Export (`ExportDialog`), Mixer/AUX/Automation (Arbeitsbereich).
- **Heute:** Gerät inline in der RecordBar, Export als Modal. Lokales `Field` (2×). Kein Theme-Knopf. Rohe Farben: ja, wenig (21 Palette + 12 white/black, v. a. `Timeline.tsx`, `RecordBar.tsx`).
- **Kürzel heute:** 8 Aktionen (`App.tsx:64–92`): Strg+S (Speichern), Strg+Z, Strg+Y / Strg+Umschalt+Z, Strg+D (Duplizieren), Leertaste (Play/Stop), Entf/Rücktaste, S (Split), L (Loop).
- **Besonderheiten/Risiken:** Mixer-Popout als eigenes Fenster (`main/mixer-window.ts`, #95), ohne AppShell. Das S-Kürzel (Split) darf nicht mit einem App-Kürzel kollidieren.

#### Editor (`apps/editor`) — Werkzeug
- **Immer sichtbar:** Source-/Preview-Monitor + Timeline (`components/SourceMonitor.tsx`, `PreviewMonitor.tsx`, `Timeline.tsx`).
- **Haupttasten:** keine (Wiedergabe ist Bearbeiten, keine Sendung).
- **Tally/On-Air:** keine. Kein Steuerserver.
- **Statuseinträge:** Master-Link¹ · Export läuft/Fortschritt (`ExportDialog`) (?) · Projekt ungespeichert (?).
- **Einstellungen:** keiner der sechs. Tool-eigen: Export-Voreinstellungen (Dialog bleibt).
- **Heute:** Splitter-Layout wie DAW, `ExportDialog` als Modal, lokales `Field`/`Row`. Kein Theme-Knopf. Rohe Farben: wenig (8 + 9, Monitore/Timeline).
- **Kürzel heute:** 10 Aktionen (`App.tsx:58–90`): Strg+S, Strg+Z, Strg+Y / Strg+Umschalt+Z, Leertaste, Entf/Rücktaste, S, I, O, `,` (Einfügen), `.` (Überschreiben).
- **Besonderheiten/Risiken:** gering. Die Kompaktvariante von Header und StatusBar ist wie beim Grafiktool nötig.

#### Transcribe (`apps/transcribe`) — Werkzeug
- **Immer sichtbar:** Warteschlange + „Start“ (`views/OperatorView.tsx:77, 234`).
- **Haupttasten:** keine (Stapelverarbeitung).
- **Tally/On-Air:** keine.
- **Statuseinträge:** Master-Link¹ · Engine bereit (`engineReady`) · Modell fehlt (`modelMissing`) · Warteschlange/aktiver Job.
- **Einstellungen:** keiner der sechs. Tool-eigen: Aufgabe (transkribieren/übersetzen), Sprache, Ausgabeordner, Modelle (Download/Löschen).
- **Heute:** Header + 2 Spalten, Abschnitte „Einstellungen“ und „Modelle“ inline mit lokalem `Section`. Kein Theme-Knopf. Rohe Farben: nein.
- **Kürzel heute:** keine.
- **Besonderheiten/Risiken:** gering. Kein mac-Drag. Kleinste App (3 tsx).

#### App Designer (`apps/app-designer`) — Werkzeug (mit Kiosk-Ausgabe)
- **Immer sichtbar:** Canvas (`components/CanvasStage.tsx`) im Reiter „Gestalten“ bzw. Player im Reiter „Testen“ (`Tabs`, `App.tsx:12–15`).
- **Haupttasten:** „Auf Terminal starten“ / „Beenden“ (`openKioskDialog`/`window.jmapp.closeKiosk`, `components/Toolbar.tsx:141–157`). Das ist die einzige Ausgabe-Aktion; TallyButton nur, wenn der Owner Messe-Kiosk als „live“ wertet (?).
- **Tally/On-Air:** `kioskOpen` (Badge „Terminal läuft“). Kein Steuerserver.
- **Statuseinträge:** Master-Link¹ · Kiosk/Terminal (`kioskOpen`, Display) · Dokument ungespeichert (`dirty`).
- **Einstellungen:** Ausgabe auf Bildschirm (Kiosk-Display-Wahl, heute Modal „Auf welchem Bildschirm?“). Tool-eigen: App-Einstellungen im Inspector (`Collapsible "App"`, `components/Inspector.tsx:635`).
- **Heute:** 3 Spalten (Splitter) + Inspector, nutzt als Einziger neben dem Titler `Tabs`/`Collapsible`/`SettingsSection`, lokales `Row`. Kein Theme-Knopf. Rohe Farben: wenig (7 + 4 Hex).
- **Kürzel heute:** Strg+Z, Strg+Umschalt+Z / Strg+Y (`App.tsx:33–46`), Entf/Rücktaste, Esc (`CanvasStage.tsx:390–394`).
- **Besonderheiten/Risiken:** Der Kiosk ist ein Vollbildfenster über `@jm/output-window` + `jmapp://`-Protokoll mit eigener CSP-Logik (`main/app-protocol.ts`) und bekommt kein AppShell. Kein mac-Drag.

#### NDI-Screen-Capture (`apps/ndi-screen-capture`) — Werkzeug (mit Live-Aktion)
- **Immer sichtbar:** Vorschau + „NDI-Versand starten / Stoppen“ (`App.tsx:~297–305`) + vorhandene `components/StatusBar.tsx`.
- **Haupttasten:** NDI-Versand starten / Stoppen (`start()`/`stop()`). Die gleiche Aktion steht im Tray-Menü (`main/tray.ts`, `TrayCommand`). Kein Steuerserver.
- **Tally/On-Air:** `status.sendState === 'sending'`.
- **Statuseinträge:** Master-Link¹ · NDI (`sendState`, `ndiSourceName`, `connections` Empfänger, fps-Ist) · System-Audio an/aus · Fehler (`status.error`).
- **Einstellungen:** NDI-Ausgabe (Quellname (?), Ziel-fps; heute fps in `localStorage`) · Audiogerät: nur „System-Audio mitsenden (Windows)“-Schalter, kein Gerät. Tool-eigen: Quellwahl (Bildschirm/Fenster, `SourcePicker`).
- **Heute:** Single Page, Logo-Header mit `dragRegion`, **hat als einzige App schon eine StatusBar**. Lokaler Zustand (fps `localStorage`). Rohe Farben: nein.
- **Kürzel heute:** keine.
- **Besonderheiten/Risiken:** Schließen versteckt ins Tray, der Versand läuft weiter (`main/index.ts:64`). Der Tally muss auch mit verstecktem Fenster stimmen (Tray-Sync `traySync`). Die vorhandene StatusBar ist der natürliche Prüfstein für `@jm/ui StatusBar` (Mapping `sendState` → ok/live/error).

---

### A.Z Kurzübersicht

| App | Welle | Typ | Haupttasten (Anzahl) | Tally-Quelle | Kürzel | Rohe Farben |
|---|---|---|---|---|---|---|
| Titler | 0 | Live | Take, Clear, ◀/▶ Eintrag (4) | `on_air` | keine | nein |
| Switcher | 1 | Live | Cut, Auto, REC, Stream (4) | `streaming`/`recording` | keine | wenig |
| Timer | 1 | Live | Start/Pause, Reset, Prev, Next (4) | `running`/`warning`/`overrun` | Leertaste, R (nur Countdown) | nein |
| Rundown | 1 | Live | GO, Zurück, Weiter (3) | keine eigene | Leertaste, ↑, ↓ | nein |
| Q&A | 1 | Live | Nächste, Beenden, Saal an/aus (3) | `live` | keine | nein |
| Battle | 1 | Live | VS, Voting, Nächste Runde, Replay (4) | `live` | keine | **ja** |
| Connect | 2 | Live | Raum, Talkback-PTT (2) | `onair` | keine | **ja, kein base.css** |
| Caption | 2 | Live | Start/Stopp, Hold, Leeren, NDI (4) | `running` | keine | **ja** |
| Interpreter | 2 | Live | Start/Stopp (1) | `running` (lokal) | keine | **ja** |
| Presenter | 2 | Sonderfall | Zurück, Weiter, Schwarz, Weiß (4) | `active`/`live` | 16 Tasten | Referentenansicht fest dunkel |
| Prompter | 2 | Live | GO/Pause, Anfang, ◀/▶ Abschnitt (4) | `scrolling` | Leertaste, ↑↓, Pos1 | nein |
| Stage-Display | 2 | Live | Bühnenschirm auf/zu (1) | keine (`outputOpen`) | keine | nur Bühnenbild |
| Recorder | 2 | Live | Arm, REC/Stopp, Disarm (3) | `recording`/`armed` | keine | nein |
| Player | 2 | Live | GO, Pause, Stop, Panic (4) | `playing`/`paused` | Leertaste, Esc, Pad-Hotkeys | nein |
| Studio-Control | 2 | Sonderfall | je Panel (ATEM Cut/Auto/FTB…) | `atem_*`, `obs_*` | keine | nein |
| Launcher | 3 | Sonderfall | Show öffnen, Side Events (2) | keine | Esc in Modals | kaum |
| Copy | 3 | Werkzeug | keine | keine | keine | nein |
| Grafiktool | 3 | Werkzeug | keine | keine | ca. 25 | Hex (gewollt) |
| Media-Converter | 3 | Werkzeug | keine | keine | keine | nein |
| Sync | 3 | Werkzeug | Messung start/stop (1) | keine | keine | nein |
| DAW | 3 | Werkzeug | Play/Stop, Aufnahme (2) | `recording`/`playing` | 8 Aktionen | wenig |
| Editor | 3 | Werkzeug | keine | keine | 10 Aktionen | wenig |
| Transcribe | 3 | Werkzeug | keine | keine | keine | nein |
| App Designer | 3 | Werkzeug | Kiosk start/stop (1, ?) | `kioskOpen` | 4 | wenig |
| NDI-Screen-Capture | 3 | Werkzeug | NDI start/stop (1) | `sendState` | keine | nein |

## Anhang B · Bezug zur alten UX-Roadmap

| Alte Phase | Neu |
|---|---|
| 1 Fundament + Titler-Pilot (✅ PR #168) | Grundlage; `Collapsible`/`SettingsSection`/`Tabs` werden weiter benutzt, der Titler wird in Welle 0 auf den Rahmen umgestellt |
| 2 Switcher | Welle 1 |
| 3 Timer | Welle 1 (die vier lokalen Primitive gehen in 3.5 auf) |
| 4 Q&A + Rundown (Modal → Reiter) | Welle 1; Modal → Einstellungs-Panel statt Reiter |
| 5 Geteilte Sektions-Komponenten | `@jm/settings` (Abschnitt 6), vorgezogen in Welle 0 |
