---
id: tool-jm-recorder
title: "JM Audio Recorder — Mehrspur-Mitschnitt (WAV)"
category: Tool-Manuals
difficulty: einfach
setupTimeMin: 10
teamSize: "1"
tags: [recorder, aufnahme, audio, wav, mehrspur, mitschnitt, asio, dante, companion, manual]
relatedTools: [jm-recorder, jm-daw, jm-timer, jm-rundown]
prerequisites:
  - JM Audio Recorder installiert (über den Launcher)
  - Audio-Eingang am Rechner (Interface / ASIO / Dante Virtual Soundcard)
  - Zielordner mit genügend freiem Speicher (WAV ist unkomprimiert)
  - Optional Bitfocus Companion / JM Rundown für die Fernsteuerung
equipmentOwner: jm
crewRoles:
  - Ton / Recording Operator
lastReviewed: 2026-07-04
owner: tech@jakobsmedien.com
summary: "Mehrspur-Audiomitschnitt als WAV über die Soundkarte — Gerät/Kanäle wählen, Pegel (Gain) setzen, optional getrennte Spuren und zeitgesteuerte Aufnahme, per Companion fern-ausgelöst."
---

## Zutaten

### Voraussetzungen
- JM Audio Recorder installiert (über den Launcher). Native Aufnahme über PortAudio — Windows (macOS als lokaler Build).
- Ein Audio-Eingang: Audio-Interface, ASIO-Gerät oder Dante Virtual Soundcard. Mehrkanal wird unterstützt.
- Zielordner mit ausreichend Platz — die Aufnahme ist **WAV** (unkomprimiert, 32-bit Float, rund 11,5 MB je Kanal und Minute bei 48 kHz, doppelt mit „Spuren einzeln“ ab zwei Kanälen). Wie lange der Platz reicht, zeigt die Statusleiste „Platz“ (siehe Profi-Tipps).
- Optional: Bitfocus Companion oder JM Rundown, um Aufnahme fern zu starten/stoppen.

### Netzwerk & Ports
- Port **8729** (TCP-Zeilenprotokoll): Steuerport für Companion / Rundown. Auto-Discovery über mDNS (`jm-recorder-ctl`, TXT `ctl=1`).
- Bedienmodell: **Scharfschalten (Arm) → Aufnehmen (Record)**. „Arm“ öffnet den Eingang (Pegel laufen, noch keine Datei; lokal die Haupttaste „Eingang öffnen“ rechts); „Record“ schreibt die WAV (lokal die Haupttaste „Aufnahme“ links).

### Fernsteuer-Befehle (TCP 8729)
- `RECORDER ARM` / `RECORDER DISARM` — Eingang öffnen/schließen (Pegel ohne Datei). Während einer Aufnahme lehnt der Recorder beide ab, die Aufnahme läuft weiter; beenden geht nur mit `RECORD OFF` bzw. „Stopp“
- `RECORDER RECORD ON` / `RECORDER RECORD OFF` / `RECORDER RECORD TOGGLE` — Aufnahme starten/stoppen/umschalten. Ist kein Zielordner gewählt oder wartet ein Netzwerkordner aus der Show noch auf „Übernehmen“, lehnt der Recorder den Start ab, statt am Rechner einen Ordnerdialog zu öffnen
- `STATE?` — Zustand abfragen. Gepushte STATE-Werte: `recording` (0/1), `armed` (0/1), `status`. Ein abgelehnter Befehl ändert daran nichts; den Grund zeigt das Fenster als Meldung bis „OK“ (etwa „Companion „ARM“ abgelehnt: Erst die Aufnahme stoppen.“), dazu steht eine Zeile im Log

## Schritt-für-Schritt

### Einrichtung
- Eingangsgerät im Panel ⚙ › Audiogerät wählen (bevorzugt ASIO/Dante für latenzarme Mehrkanal-Aufnahme); Kanalzahl und Samplerate im Panel ⚙ › Format setzen (übernommen nach Enter oder beim Verlassen des Feldes) — Standard 2 Kanäle / 48000 Hz, folgt sonst dem Gerät.
- Zielordner und Basis-Dateinamen im Panel ⚙ › Ziel festlegen (ohne Namen = Zeitstempel).
- Aufnahme-Verstärkung (Gain, dB) bei Bedarf mit dem Schieber „GAIN“ bei den Pegeln im Live-Bereich anpassen — wirkt live auf Pegel **und** Aufnahme, wird gemerkt.
- Optional **getrennte Spuren**: zusätzlich jede Spur als eigene Mono-WAV in einen Unterordner (für den späteren Mix in JM DAW; Panel ⚙ › Ziel, „Spuren zusätzlich einzeln speichern“).
- Fernsteuerung (Statusleiste „Fernsteuerung“, Panel ⚙ › Fernsteuerung): Companion/Rundown auf Port 8729 zeigen lassen (Auto-Discovery `jm-recorder-ctl`).

### Während
- Vor dem Start **Arm** drücken (Haupttaste „Eingang öffnen“) und die Pegel im Live-Bereich prüfen — nicht ins Clipping fahren (Gain reduzieren, falls nötig).
- **Record** startet den Mitschnitt (lokal mit der Haupttaste „Aufnahme“ oder per Companion `RECORDER RECORD ON`). Der Zustand (`recording`) wird an Companion gemeldet; die Kopfzeile zeigt dann „REC“.
- Für einen unbeaufsichtigten Mitschnitt die **zeitgesteuerte Aufnahme** nutzen: Startzeit und/oder Auto-Stopp nach N Minuten in der Karte „Geplante Aufnahme“ unter dem Live-Bereich setzen (Statusleiste „Zeitplan“).

### Nachbereitung
- **Record OFF** (Haupttaste „Stopp“) beendet und finalisiert die WAV sauber (Datei erst danach vollständig lesbar).
- Aufnahme kontrollieren (Pegel, Vollständigkeit); Dateien sichern. Für Schnitt/Mix in JM DAW importieren.
- **Schließen:** Läuft eine Aufnahme, fragt der Recorder beim Schließen des Fensters „Aufnahme läuft. Wirklich beenden?“, als Fenster im Recorder-Fenster; die Aufnahme läuft dabei weiter. „Weiter aufnehmen“ lässt alles, wie es war, „Aufnahme beenden“ schließt die Datei sauber ab und beendet den Recorder. Antwortet das Fenster nicht binnen einer Sekunde, stellt der Recorder dieselbe Frage als Windows-Dialog („Weiter aufnehmen“ ist vorgewählt). Ohne Aufnahme schließt das Fenster wie bisher. Beim Abmelden oder Herunterfahren von Windows schließt der Recorder die Aufnahme ohne Frage sauber ab.

## Profi-Tipps
- Immer erst **Arm** („Eingang öffnen“) und ein paar Sekunden Pegel beobachten, bevor es live wird — so fällt ein totes Kabel/falscher Eingang vor der Aufnahme auf, nicht danach.
- **Getrennte Spuren** im Panel ⚙ › Ziel aktivieren, wenn hinterher gemischt wird — die Mono-WAVs pro Kanal landen direkt auf der DAW-Timeline. Sie brauchen noch einmal so viel Platz wie die Aufnahme selbst.
- Vor langen Mitschnitten auf die Statusleiste **„Platz“** schauen: Sie zeigt vor und während der Aufnahme, wie lange der freie Speicher im Zielordner für das eingestellte Format reicht (etwa „Platz für 2 h 10 min“), gelb unter 15 Minuten, rot unter 5 Minuten. Gesperrt wird nie, eine Aufnahme startet auch bei wenig Platz. Lässt sich der Platz nicht lesen (etwa ein NAS, das nicht binnen 3 Sekunden antwortet), steht „Platz unbekannt“ da. Ein Klick auf den Eintrag öffnet Panel ⚙ › Ziel.
- `RECORD TOGGLE` auf einen Companion-Button legen: ein Knopf für Start und Stopp, mit rückgemeldetem `recording`-Zustand als Tally. Endet eine Aufnahme mit einem Fehler (Datenträger voll, Eingang weg), geht `recording` sofort auf 0.
- Zeitgesteuerte Aufnahme für Vorträge/Streams, die pünktlich beginnen — Startzeit in der Karte „Geplante Aufnahme“ setzen, der Recorder scharf lassen, fertig. Ein Schreibfehler löscht auch die geplanten Start- und Stoppzeiten.
- Über eine **`.jmshow`** lassen sich Zielordner, Dateiname, getrennte Spuren, Kanäle und Samplerate pro Produktion vorbelegen (das Eingangsgerät bleibt bewusst lokal). Ein Ordner auf einem Laufwerk gilt sofort; ein Netzwerkordner aus der Show gilt erst, wenn ihn jemand im Fenster mit „Übernehmen“ bestätigt, danach ist er gemerkt und geht beim nächsten Mal ohne Klick. Ein ungültiger Pfad wird nicht übernommen.

## Pannenhilfe

| Risiko | Gegenmaßnahme |
| --- | --- |
| Kein Eingang / „Gerät konnte nicht geöffnet werden" | Richtiges Gerät im Panel ⚙ › Audiogerät gewählt (Statusleiste „Eingang“)? ASIO-/Dante-Treiber aktiv, Gerät nicht von anderer App belegt? |
| Kein Pegel trotz Arm | Falscher Eingang/Kanal, Kabel/Phantomspeisung prüfen; Gain (Schieber „GAIN“ bei den Pegeln) nicht zu niedrig |
| Übersteuerung (Clipping) | Gain reduzieren, am Interface/Pult zurücknehmen — vor Record prüfen |
| Companion startet nicht | Statusleiste „Fernsteuerung“ ansehen; Port 8729 offen? `jm-recorder-ctl` im mDNS sichtbar (sonst Adresse manuell eintragen)? Steht im Fenster „Companion „…“ abgelehnt: …“? Dann nennt die Meldung den Grund: „Kein Zielordner gewählt.“ (Ordner wählen), „Der Netzwerkordner aus der Show ist noch nicht bestätigt.“ (im Hinweisband „Übernehmen“ drücken) oder „Erst die Aufnahme stoppen.“ (`ARM`/`DISARM` während der Aufnahme) |
| WAV unvollständig/nicht abspielbar | Aufnahme sauber mit **Record OFF** beenden (Haupttaste „Stopp“) — die Datei wird erst beim Stopp finalisiert. Fenster schließen während der Aufnahme fragt nach (siehe „Schließen“); Abmelden oder Herunterfahren von Windows schließt die Datei ohne Frage sauber ab |
| Platte voll mitten in der Aufnahme | Vorher die Statusleiste „Platz“ ansehen (gelb unter 15 min, rot unter 5 min); WAV ist groß — bei langen/mehrkanaligen Mitschnitten großzügig planen. Läuft der Datenträger trotzdem voll, endet die Aufnahme sauber (siehe nächste Zeile) |
| „Schreibfehler“ oder „Kein Eingang“ statt „REC“ | Die Aufnahme ist mit einem Fehler sauber zu Ende gegangen: „REC“ ist aus, Companion sieht `recording` 0, die Datei bis dahin ist abgeschlossen (ließ sich auch ihr Dateikopf nicht mehr schreiben, etwa weil der USB-Stick abgezogen wurde, sagt die Meldung das). „Schreibfehler“: Datenträger voll, abgezogen oder Netzwerkordner weg. „Kein Eingang“: Vom Gerät kamen 2 Sekunden lang keine Audiodaten (Interface abgezogen, Treiber hängt). Der Grund steht als Meldung bis „OK“, im Statuseintrag „Aufnahme“ und an der Taste „Neu aufnehmen“, bis eine Aufnahme gelingt, der Eingang geschlossen wird oder Companion `RECORD OFF` ihn quittiert. Ursache beheben (neuer Zielordner im Panel ⚙ › Ziel, Gerät prüfen), dann „Neu aufnehmen“ |
| Hinweis „Die Show möchte in einem Netzwerkordner aufnehmen: …“ | Ist der Ordner bekannt, „Übernehmen“ drücken; danach ist er gemerkt. „×“ verwirft den Vorschlag, dann gilt wieder der Ordner von vorher. Bis dahin ist kein Ordner gesetzt, und Companion kann nicht starten |
| Preset mit Netzwerkordner wechselt den Ordner nicht sofort | Der Netzwerkordner eines Presets gilt erst, wenn seine Prüfung geantwortet hat; der Rest des Presets wirkt sofort, und ein nächstes Preset wartet nicht. Antwortet das NAS nicht (ausgeschaltet, Netz weg), gilt bis zur Antwort der Ordner von vorher, und die Preset-Auswahl zeigt „(geändert)“ |

## Checklisten

### Einrichtung
- [ ] Eingangsgerät gewählt (ASIO/Dante bevorzugt), Kanäle + Samplerate gesetzt
- [ ] Zielordner + Dateiname festgelegt, Speicher geprüft
- [ ] Gain gesetzt, Pegel im grünen Bereich
- [ ] Getrennte Spuren nach Bedarf aktiviert
- [ ] Companion/Rundown auf Port 8729 verbunden (optional)

### Vor Live
- [ ] Arm + Pegel geprüft (kein Clipping, alle Kanäle da)
- [ ] Test-Aufnahme kurz gemacht und abgespielt
- [ ] Zeitplan/Auto-Stopp gesetzt (falls unbeaufsichtigt)
