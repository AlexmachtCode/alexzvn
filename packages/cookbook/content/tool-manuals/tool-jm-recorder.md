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
- Zielordner mit ausreichend Platz — die Aufnahme ist **WAV** (unkomprimiert; grob ~10 MB pro Kanal und Minute bei 48 kHz/24 bit).
- Optional: Bitfocus Companion oder JM Rundown, um Aufnahme fern zu starten/stoppen.

### Netzwerk & Ports
- Port **8729** (TCP-Zeilenprotokoll): Steuerport für Companion / Rundown. Auto-Discovery über mDNS (`jm-recorder-ctl`, TXT `ctl=1`).
- Bedienmodell: **Scharfschalten (Arm) → Aufnehmen (Record)**. „Arm" öffnet den Eingang (Pegel laufen, noch keine Datei); „Record" schreibt die WAV.

### Fernsteuer-Befehle (TCP 8729)
- `RECORDER ARM` / `RECORDER DISARM` — Eingang öffnen/schließen (Pegel ohne Datei)
- `RECORDER RECORD ON` / `RECORDER RECORD OFF` / `RECORDER RECORD TOGGLE` — Aufnahme starten/stoppen/umschalten
- `STATE?` — Zustand abfragen. Gepushte STATE-Werte: `recording` (0/1), `armed` (0/1), `status`

## Schritt-für-Schritt

### Einrichtung
- Eingangsgerät wählen (bevorzugt ASIO/Dante für latenzarme Mehrkanal-Aufnahme); Kanalzahl und Samplerate setzen — Standard 2 Kanäle / 48000 Hz, folgt sonst dem Gerät.
- Zielordner und Basis-Dateinamen festlegen (ohne Namen = Zeitstempel).
- Aufnahme-Verstärkung (Gain, dB) bei Bedarf anpassen — wirkt live auf Pegel **und** Aufnahme, wird gemerkt.
- Optional **getrennte Spuren**: zusätzlich jede Spur als eigene Mono-WAV in einen Unterordner (für den späteren Mix in JM DAW).
- Fernsteuerung: Companion/Rundown auf Port 8729 zeigen lassen (Auto-Discovery `jm-recorder-ctl`).

### Während
- Vor dem Start **Arm** drücken und die Pegel prüfen — nicht ins Clipping fahren (Gain reduzieren, falls nötig).
- **Record** startet den Mitschnitt (lokal oder per Companion `RECORDER RECORD ON`). Der Zustand (`recording`) wird an Companion gemeldet.
- Für einen unbeaufsichtigten Mitschnitt die **zeitgesteuerte Aufnahme** nutzen: Startzeit und/oder Auto-Stopp nach N Minuten setzen.

### Nachbereitung
- **Record OFF** beendet und finalisiert die WAV sauber (Datei erst danach vollständig lesbar).
- Aufnahme kontrollieren (Pegel, Vollständigkeit); Dateien sichern. Für Schnitt/Mix in JM DAW importieren.

## Profi-Tipps
- Immer erst **Arm** und ein paar Sekunden Pegel beobachten, bevor es live wird — so fällt ein totes Kabel/falscher Eingang vor der Aufnahme auf, nicht danach.
- **Getrennte Spuren** aktivieren, wenn hinterher gemischt wird — die Mono-WAVs pro Kanal landen direkt auf der DAW-Timeline.
- `RECORD TOGGLE` auf einen Companion-Button legen: ein Knopf für Start und Stopp, mit rückgemeldetem `recording`-Zustand als Tally.
- Zeitgesteuerte Aufnahme für Vorträge/Streams, die pünktlich beginnen — Startzeit setzen, der Recorder scharf lassen, fertig.
- Über eine **`.jmshow`** lassen sich Zielordner, Dateiname, getrennte Spuren, Kanäle und Samplerate pro Produktion vorbelegen (das Eingangsgerät bleibt bewusst lokal).

## Pannenhilfe

| Risiko | Gegenmaßnahme |
| --- | --- |
| Kein Eingang / „Gerät konnte nicht geöffnet werden" | Richtiges Gerät gewählt? ASIO-/Dante-Treiber aktiv, Gerät nicht von anderer App belegt? |
| Kein Pegel trotz Arm | Falscher Eingang/Kanal, Kabel/Phantomspeisung prüfen; Gain nicht zu niedrig |
| Übersteuerung (Clipping) | Gain reduzieren, am Interface/Pult zurücknehmen — vor Record prüfen |
| Companion startet nicht | Port 8729 offen? `jm-recorder-ctl` im mDNS sichtbar (sonst Adresse manuell eintragen)? |
| WAV unvollständig/nicht abspielbar | Aufnahme sauber mit **Record OFF** beenden — die Datei wird erst beim Stopp finalisiert |
| Platte voll mitten in der Aufnahme | Vorher Speicher prüfen; WAV ist groß — bei langen/mehrkanaligen Mitschnitten großzügig planen |

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
