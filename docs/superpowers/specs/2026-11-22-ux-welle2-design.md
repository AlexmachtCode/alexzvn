# UX-Update Welle 2: übrige Live-Tools in zwei Teilen (2a und 2b)

Stand 22.11.2026. Owner-Freigabe 22.11. 11:39 („freigabe erteilt“). Das fachliche Wie steht in der freigegebenen Spec
`docs/superpowers/specs/2026-10-08-suite-ux-update-design.md` (Owner 08.10., Vorgaben UO1–UO8), Anhang A „Welle 2“.
Anhang A ist am 22.11. am Code nachgemessen worden: `docs/ux/welle2-nachmessung-2a.md` und
`docs/ux/welle2-nachmessung-2b.md`. Wo die Nachmessung Anhang A widerspricht, gilt die Nachmessung. Dieses Dokument hält
fest, was am 22.11. für Welle 2 entschieden wurde.

## Warum

Owner 21.11. nach der COP31: Die Tools haben gut unterstützt, sie müssen aber benutzerfreundlicher werden. Welle 1 ist am
22.11. ausgeliefert (Switcher 0.12.0 und 0.12.1, Timer 0.15.0, Rundown 0.9.0, Q&A 0.7.0, Battle 0.5.0). Owner 22.11.
09:43: „dann gern danach weiter mit ux welle 2“. Die Bedingung aus Spec 9.2 für Connect (erst nach dem Merge von Zoom 4b)
ist erfüllt: 4b ist seit Connect 0.4.0 ausgeliefert.

## Ziele

- Die neun übrigen Live-Tools bekommen das Bediengefühl von Welle 1 nach Spec und Anhang A:
  - Kopf mit ON AIR, Statusleiste unten;
  - große Haupttasten mit Sperrgrund;
  - Einrichtung im Panel aus `@jm/settings`;
  - Hell/Dunkel.
- Kein Funktionsverlust (Spec 10): Jede App bekommt vor dem Umbau eine Funktionsliste aus dem Code
  (`docs/ux/funktionslisten/<app>.md`), nach dem Umbau wird jeder Punkt abgehakt. Ein Punkt ohne Haken blockiert den Teil.
- Was heute nur geglaubt ist, wird gemessen oder ehrlich als „ohne Rückmeldung“ gezeigt (Spec 7). Das betrifft
  Master-Link, Fernsteuerung, Ausgabefenster und ON AIR.

## Nicht-Ziele

- Bedienlogik, Protokolle, Ports, IPC-Befehle und Hauptprozesse ändern sich nicht (Spec U6 und Abschnitt 10). Ausnahmen
  sind nur die lesenden Ergänzungen unter „Festgelegt“ und die Player-Panik, die auch die Pads stoppt (W2-10).
- Keine neuen Tastenkürzel (UO5, Folgeaufgabe F4). Das Halten per Leertaste auf einer fokussierten Haupttaste bringt der
  Baustein mit; es ist kein Kürzel (W2-V2).
- Live-Sicherheit (Lane F) bleibt geparkt.
- #317 Stufe B, Zoom-Slots Stufe 2 und eine Standby-Markierung in Connect kommen nach 2b, je mit eigenem Entwurf (W2-6,
  W2-V1).
- Keine Bedienfläche für Werte, die heute keine haben, etwa die Stille-Parameter der Caption.
- Kein neues Protokoll am Studio-Server für den Browser (W2-V4).
- Welle 3.

## Anti-Ziele

- **Unerreichbar:** Eine Funktion, ein Kürzel oder ein Zustand ist nach dem Umbau nicht mehr erreichbar. Besonders
  gefährdet:
  - die Presenter-Kürzel im Publikumsfenster;
  - Esc = Stop und die Pad-Tasten im Player;
  - die Kürzel im Prompter-Ausgabefenster;
  - die Pflicht-Fußzeile in Connect (NDI-Markenhinweis, Logordner, Lizenzbedingungen).
- **Ungemessen:** Eine Statuszeile oder Taste zeigt etwas, das nicht gemessen ist (Lehre „Statuszeile lügt leichter als
  Schweigen“). Beispiele: rot ohne Sendung, „offen“ ohne Fenster, „bereit“, wo ein Gerät nichts zurückmeldet.
- **Unterbrochen:** Ein Umbau unterbricht, was live läuft. Panel auf/zu, Reiterwechsel und der neue Rahmen dürfen diese
  Teile nicht neu einhängen:
  - Caption: NDI-Engine und Aufnahme im Renderer;
  - Interpreter: die Engine (`destroy` beim Aushängen);
  - Recorder: `init` (Fernbefehle, Pegel, Zustand);
  - Connect: Raumverbindung und Talkback.
- **Hängt fest:** Talkback oder ein PTZ-Halten bleibt nach Loslassen, Fokuswechsel oder Abbruch offen.

## Ansätze

- **Gewählt (Owner 22.11., „b bitte“): zwei Teile**, je mit eigenem Plan, eigener Abnahme und eigenem Release.
  - **2a:** Caption, Interpreter, Prompter, Stage-Display, Recorder, Player. Seit dem 08.10. kaum verändert, das Muster
    von Welle 1 passt fast 1:1.
  - **2b:** Presenter, Studio-Control, Connect. Sonderfälle, zusammen etwa so groß wie Welle 1 (Nachmessung 2b,
    Abschnitt 5).
  - Weicht von Spec 9.1 („gesammelt“) ab; Owner-Entscheid.
- **Verworfen: alle neun Apps zusammen** (Spec 9.1). Das wäre etwa doppelt so groß wie Welle 1, die offenen Fragen zu den
  Sonderfällen hätten alles aufgehalten, und bis etwas ausgeliefert ist, dauerte es lange.
- **Festlegung des Entwurfs:** 2b wird geplant und gebaut, nachdem 2a gemergt ist, auf dem dann aktuellen `main`.

## Festgelegt

### Owner-Entscheide 22.11. („weiter mit deinen empfehlungen“)

**W2-1 · ON AIR nur bei gemessener Sendung** (Spec 7.4). Kopf-Anzeige und `live` der Haupttaste:

| App | ON AIR bzw. `live`, wenn | sonst im Kopf |
|---|---|---|
| Recorder | `status === 'recording'` (gemessen im Main) | „bereit“ |
| Caption | NDI sendet nachweislich **und** die Transkription läuft | „bereit“ |
| Interpreter | der Mix läuft (`running`); Beschriftung „MIX AKTIV“ | „bereit“ |
| Prompter | scrollt **und** der Talent-Monitor ist nachweislich offen (W2-2) | „bereit“ |
| Player | ein Show-Cue spielt wirklich (nicht in der Vorlaufzeit/Pre-Wait, nicht bevor das Video geladen ist, nicht bei pausierter Show; die Statusleiste zeigt dann „pausiert“, Festlegung des Entwurfs) **oder** ein Soundboard-Pad spielt (Owner 22.11.) | „bereit“ |
| Stage-Display | keine ON-AIR-Anzeige; die Taste „Bühnenschirm“ ist `live`, wenn er nachweislich offen ist | keine Anzeige |
| Presenter | das Publikum sieht Folien (`active && screen === 'live'`); Schwarz und Weiß sind Pausen | „bereit“ |
| Studio-Control | ATEM oder OBS nimmt nachweislich auf oder streamt, über alle Instanzen | keine Anzeige |
| Connect | mindestens ein Gast auf Sendung | keine Anzeige |

- Studio-Control und Connect zeigen ohne Sendung gar nichts, auch kein „bereit“: TriCaster, Licht und Zoom-Slots melden
  nicht zurück, ob sie senden.
- Dazu nötige lesende Ergänzungen:
  - **Caption:** Der Main weiß heute nur, dass der Sender-Prozess existiert (`ndiActive`, kein `exit`-Handler). „Sendet“
    braucht eine Meldung des Senders; endet der Prozess, wird sie zurückgenommen. Ein Mikrofonfehler (`micError`) wird
    sichtbar: als Statuseintrag und als Text der App direkt unter den Haupttasten. Die Start-Taste bleibt bedienbar,
    denn Stopp und erneuter Start sind der Weg zum Neuversuch. Bei einem Mikrofonfehler ist sie nie `live`.
    Festlegung des Entwurfs: Der `TallyButton` kennt keinen Hinweis ohne Sperre, und eine Sperre nähme den Neuversuch.
  - **Player:** Der Store trennt „wartet (Pre-Wait)“ von „spielt“, als **neues** Feld. Die Soundboard-Engine
    (`cueEngine` in `lib/cues.ts`) meldet, welche Pads gerade spielen; heute kennt sie das nur intern (`active`). Die
    Companion-Werte (`playing`, `playing_count`) bleiben genau wie heute und betreffen nur die Show. Kopf und Stream Deck
    dürfen also auseinanderliegen, wenn nur ein Pad spielt.

**W2-2 · Ausgabefenster-Rückmeldung.** Das Ausgabefenster meldet seinen Zustand als Ereignis. Prompter, Stage-Display
und Player bekommen je einen lesenden IPC-Kanal; Statuseintrag und Taste folgen der Meldung. Das erweitert UO3 (lesende
Brücken) um eine dritte Brücke.

- **Zustände:**
  - **offen;**
  - **zu**, auch nach Alt+F4;
  - **Bildschirm fehlt:** Der gewählte Bildschirm ist weg. Das System schiebt das Fenster dann auf einen anderen
    Bildschirm, meist den des Operators; `closed` kommt dabei nicht.
  - **abgestürzt:** Der Renderer der Ausgabe ist weg, das Fenster steht noch.
- **Nur melden:** Das Paket schließt das Fenster in diesen Fällen nicht und lädt es nicht neu; kein Verhalten ändert sich.
  ON AIR bzw. `live` gibt es nur im Zustand „offen“.
- **Player:** hat ein eigenes Ausgabefenster (`apps/player/src/main/output-window.ts`) statt `@jm/output-window`. Er
  bekommt dieselbe Meldung dort und zieht nicht auf das Paket um.
- Festlegung des Entwurfs: die zwei Zustände neben offen/zu und der Verbleib des Player-Fensters.

**W2-3 · Presenter, Fenster und Tasten.**

- **Editor:** AppShell Typ „Werkzeug“ (Spec 5.2). Es ist der erste Werkzeug-Rahmen der Suite und das Muster für Welle 3.
  Eine Haupttaste „Präsentieren“ / „Beenden“.
- **Referent:** reduzierter Live-Rahmen mit Statusleiste, fest dunkel und ohne Hell/Dunkel-Schalter.
  - Haupttasten unter der aktuellen Folie: Zurück · Weiter · Schwarz · Weiß. Am Rand sind Zurück und Weiter mit Grund
    gesperrt (neue Texte).
  - „Beenden“ ist die Kopf-Aktion.
  - Die übrigen Kopfknöpfe (heute 14 Elemente) wandern in eine Leiste unter dem Kopf.
  - Schwarz und Weiß sind Umschalter ohne Sendezustand: `bereit` mit wechselnder Beschriftung, wie Battle „Voting“ und
    Q&A „Saal“ in Welle 1.
- **Publikum und NDI:** ohne Rahmen.

**W2-4 · Presenter, Einstellungen.** Ein Panel in Editor und Referent, im Referenten ohne die Import-Option. Das
📱-Modal entfällt; Handy-Fernsteuerung und Gast-Klicker lassen sich schon vor der Präsentation einrichten. Im Editor
schiebt das Panel den Inhalt (Spec 3.1), das Raster bleibt. Dass die Bühne bei offenem Panel schmal wird, sieht der Owner
in der Abnahme an.

**W2-5 · Connect, Aufbau.**

- **Zwei Spalten:** links der Cloud-Raum (Raum, Talkback, Einladen, Gäste), rechts Zoom (Meeting, Slots, Teilnehmer). Bei
  schmalem Fenster stehen sie untereinander, unter macOS gibt es nur die linke.
- **Ins Panel:** Zoom-Einrichtung, Zoom-Vorgaben (Slot-Vorgaben, Sprecher-Haltezeit, „Person im NDI-Namen“) und
  Cloud-Zugang.
- **Im Live-Bereich bleiben:** Meldungen, Beitreten/Verlassen, Bild-Versatz, Vorschau-Schalter, Kacheln mit Start/Stopp
  und Slot-Einstellungen, Teilnehmer, Messwerte, Hinweise.
- **Mängel sichtbar halten:** Hat die Zoom-Einrichtung einen Mangel, zeigt ein Statuseintrag ihn und öffnet das Panel an
  dieser Stelle. Heute steht die Einrichtung dann offen im Arbeitsbereich.

**W2-6 · Connect vor #317 Stufe B.** Erst der Connect-Umbau, danach #317 Stufe B und Zoom-Slots Stufe 2 auf der neuen
Struktur. Die Teilnehmerzeile lässt Platz für Kennzeichen, die Slot-Einstellungen bleiben je Kachel. Für Stufe B gibt es
noch kein Issue.

**W2-7 · Studio-Control, Aufbau.**

- **Haupttasten je Gerätepanel:** die vorhandene Hauptreihe als Haupttasten, ohne Obergrenze 4 (ATEM 5, TriCaster 5,
  OBS 2, Licht 1). Busse, Szenen, Presets, Joystick, DSK, DDR und Makros bleiben normale Knöpfe.
- **TriCaster-REC/STREAM** melden nichts zurück: `bereit` mit dem Hinweis „ohne Rückmeldung“.
- **Sperrgründe:** „Rolle darf nicht schalten“ und „Gerät nicht verbunden“ (neue Texte).
- **Anmeldung:** steht im gemeinsamen Rahmen, mit leerer Statusleiste und ohne ⚙ (Spec 3.8).
- **Nach der Anmeldung:** Video · Audio · Licht · Setup als Reiter in der Werkzeugleiste, rechts daneben Benutzer · Rolle
  · Abmelden.
- **Setup:** bleibt Reiter, die Geräteformulare bleiben in den Panels. Das Einstellungs-Panel enthält nur die
  Fernsteuerung. Das weicht von Anhang A ab, weil Inventar und Benutzerverwaltung nicht in 360 px passen.
- **Lokale Kopien:** Die lokalen `AppShell` und `StatusPill` werden gelöscht, nicht neben `@jm/ui` gehalten. „Verbunden“
  wird `ok` statt Markengelb.

**W2-8 · Regler im Live-Bereich.**

- **Prompter:** Das Tempo bleibt unter dem Transport. Schriftgröße, Zeilenabstand, Seitenrand, Lese-Linie, Spiegeln und
  Fett gehen ins Panel.
- **Stage-Display:** Die Anzeige-Elemente bleiben als Schalterreihe unter der Vorschau, das Nachricht-Feld steht direkt
  darunter. Quellen und Bildschirm gehen ins Panel.

**W2-9 · Hell-Modus.** Alle neun Apps werden hell-fähig. Caption (64 feste Farbstellen), Interpreter (48) und Connect
(260) bekommen Tokens.

- **Ausgenommen sind Programmflächen:** der NDI-Zeichner der Caption, `StageScreen`, die Ausgabefenster, die
  Slot-Vorschau in Connect und QR-Codes.
- **Presenter-Referent:** bleibt fest dunkel (W2-3).

**W2-10 · Player, Stop und Panik überall.** GO und Pause/Weiter bleiben nur in der Cue-Show (UO8). Stop und Panik sind in
allen Reitern erreichbar: in der Cue-Show im Transport, in Bibliothek und Soundboard in einer festen Fußleiste. Die
Kürzel (Leertaste = GO, Esc = Stop) bleiben nur in der Cue-Show.

- **Panik stoppt auch die Pads** (Owner 22.11., „1. a“). Das gilt per Klick und per Companion (`panic`), sodass der
  Tooltip „Sofort alles stoppen“ endlich stimmt. Heute stoppt `showPanic` nur Show-Cues und Ausgabe; die Pads stoppt nur
  „■ Alle stoppen“ im Soundboard (`cueEngine.stopAll()`). Das ist die einzige gewollte Änderung der Bedienlogik in
  Welle 2.
- **Stop** stoppt wie heute nur die Show. „■ Alle stoppen“ im Soundboard bleibt.

### Vorgaben (Owner 22.11., ohne Widerspruch übernommen)

- **W2-V1:** In Connect bleiben GO und „Nächster Gast“ ohne Knopf (UO7). Die Standby-Markierung ist ein eigener Wunsch
  nach 2b.
- **W2-V2:** Talkback hält auch per Leertaste oder Enter auf dem fokussierten Knopf; das bringt der Baustein mit.
- **W2-V3:** Interpreter: Bei allen drei Gerätewahlen steht „Wirkt erst nach Stopp und erneutem Start.“. Der feste
  Paket-Text `AUDIO_TEXTE.wechselStoppt` wäre hier falsch, denn ein Wechsel stoppt nichts. Der Text geht in die
  Texttabelle.
- **W2-V4:** Läuft Studio-Control im Browser, sind die Einträge Master-Link und Fernsteuerung ausgeblendet (Spec 6.1).
  Im Electron-Fenster kommen sie über IPC.
- **W2-V5:** 2b beginnt mit einem Baustein-Task. Danach kommen Presenter, dann Studio-Control und zuletzt Connect.

### Für beide Teile (wie in Welle 1)

- **Brücken:**
  - Je App die Master-Link-Brücke (Preload plus `lib/bruecken.ts`, Muster Timer).
  - Die Fernsteuerungs-Meldung (`shared/fernsteuerung.ts`, Muster Timer) nur für Apps mit Steuerserver. Interpreter und
    Stage-Display haben keinen.
  - Studio-Control meldet den Gateway-Status über IPC (`gatewayStatus()` gibt es schon).
- **Texte:** Neue sichtbare Texte gehen vor dem Release als Tabelle zur Owner-Freigabe (`docs/ux/welle2a-texte.md`,
  `docs/ux/welle2b-texte.md`). Das gilt für Beschriftungen, Status- und Sperrtexte und Release-Notes.
- **Entscheidungen:** R1–R31 aus `docs/ux/welle1-entscheidungen.md` gelten weiter, wo sie passen. Neue Entscheidungen
  während der Umsetzung kommen nach `docs/ux/welle2-entscheidungen.md`.
- **Abnahme:** `docs/ux/ABNAHME-UX-Welle-2a.md` und `docs/ux/ABNAHME-UX-Welle-2b.md` nach Spec 12. Die
  Connect-Abnahme braucht zwei Rechner mit Launcher-Freigaben.
- **Versionen:** je App ein Minor-Sprung mit eigenen Release-Notes.
  - 2a: Caption 0.6.0, Interpreter 0.3.0, Prompter 0.8.0, Stage-Display 0.7.0, Recorder 0.10.0, Player 0.9.0.
  - 2b: Stand beim 2b-Plan.
- **Release:** je Teil nach der Owner-Abnahme und nur mit Owner-Freigabe. Der Release-Weg je App ist derselbe wie beim
  letzten Release dieser App (CI oder lokaler Bau).
- **Arbeitsweg wie in Welle 1:**
  - eigener Worktree;
  - `npm install` nur im Worktree-Wurzelordner und mit `--ignore-scripts`;
  - Tests unter Node 22;
  - Dateien mit LF.

### 2a: Vorarbeit

- **Fundament-Task:** W2-2 in `@jm/output-window`, mit Test, vor den Apps.
- **Abhängigkeit:** `@jm/settings` kommt in die `package.json` der sechs Apps; die Lockfile ändert sich mit.

### 2b: Vorarbeit

- **Baustein-Task in `@jm/ui`** (additiv nach Spec 4.1, mit Galerie und Selbsttest):
  - fester Dunkel-Modus bzw. ausblendbarer `ThemeToggle`;
  - `mac` wird durch `AppShell` durchgereicht, weil der Referent eine echte Titelleiste hat;
  - ein kleiner Halte-Knopf auf Basis von `erzeugeHalten`, der auch bei Fokusverlust loslässt (Connect je Gast,
    PTZ-Joystick).
- **Studio-Control vor dem Umbau:**
  - Start-Nachweis mit den nativen Modulen (`better-sqlite3`, `@julusian/freetype2`);
  - Testgerüst;
  - CI-Eintrag.

  Startet es nicht, geht das als eigener Befund an den Owner, bevor umgebaut wird.

## Dem Bauenden überlassen

- **Zuschnitt und Tests:** der Zuschnitt der Aufgaben je App nach dem Muster von Welle 1 (Funktionsliste, Ableitungen,
  Rahmen, Live-Bereich, Panel, Abhaken) und die Teststruktur je App.
- **Reihenfolge in 2a:** Die Reihenfolge der sechs Apps nach dem Fundament-Task.
- **Caption, Name im Netz:** lesend aus dem Namen, mit dem der Sender gestartet wurde, oder weglassen. Nie den aktuellen
  Feldwert zeigen; ein geänderter Name wirkt erst beim nächsten Start.
- **Player, Vollbild der Ausgabe:** aus dem Main lesen oder in `ScreenOutputSection` nicht anbieten. Nie den geratenen
  Wert zeigen.
- **Recorder, Fehler:** Ein Schreib- oder Gerätefehler, der heute nur als 5-Sekunden-Meldung erscheint, bleibt sichtbar,
  bis er bestätigt ist. Die Statuszeile darf dabei nicht weiter „Aufnahme läuft“ in Grün zeigen, ohne dass das gemessen
  ist.
- **Interpreter, Hinweis „Der Mix geht auf den Systemstandard“:** ist vermutlich falsch (Nachmessung 2a, 2.3 Nr. 3). Vor
  einer Übernahme gegen den echten Ablauf prüfen; eine Korrektur geht als Text in die Tabelle.
- **Layout:** Breiten, Umbrüche und Container-Queries.
- **Beschriftungen und Texte:** Sie kommen in die Texttabelle.
- **Nachziehen:** was nach dem Bau einer App am Plan der nächsten nachgezogen wird.
