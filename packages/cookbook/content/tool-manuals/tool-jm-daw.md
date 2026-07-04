---
id: tool-jm-daw
title: "JM DAW — Mehrspur-Audio (Schnitt/Mix/Aufnahme)"
category: Tool-Manuals
difficulty: mittel
setupTimeMin: 15
teamSize: "1"
tags: [daw, audio, mehrspur, mix, aufnahme, mixer, effekte, export, companion, manual]
relatedTools: [jm-daw, jm-recorder, jm-editor, jm-rundown]
prerequisites:
  - JM DAW installiert (über den Launcher)
  - Für Aufnahme ein Audio-Eingang (Interface/ASIO/Dante)
  - Ausreichend Plattenplatz für Aufnahmen und Export
  - Optional Bitfocus Companion / JM Rundown für Transport-Fernsteuerung
equipmentOwner: jm
crewRoles:
  - Ton / Audio Editor
lastReviewed: 2026-07-05
owner: tech@jakobsmedien.com
summary: "Digitale Audio-Workstation: Mehrspur schneiden und mischen (Fader/Pan/Mute/Solo/Master), über die Soundkarte aufnehmen, Effekte (EQ/Kompressor/Reverb), Automation und AUX-Busse — Export als WAV/MP3/FLAC/AAC/OGG, Transport per Companion fernsteuerbar."
---

## Zutaten

### Voraussetzungen
- JM DAW installiert (über den Launcher). FFmpeg ist mitgebündelt (Export/Transkodierung).
- Für **Aufnahme**: ein Audio-Eingang (Interface, ASIO, Dante) — das native Audiomodul muss dafür gebaut sein. Wiedergabe/Schnitt/Mix/Export laufen auch ohne.
- Plattenplatz für Aufnahmen (`userData/recordings`) und Exporte.

### Netzwerk & Ports
- Port **8730** (TCP-Zeilenprotokoll): Steuerport für Companion / Rundown (**nur Transport/Aufnahme**). Auto-Discovery über mDNS (`jm-daw-ctl`, TXT `ctl=1`).

### Fernsteuer-Befehle (TCP 8730)
- `DAW PLAY` / `DAW STOP` / `DAW TOGGLE` — Wiedergabe starten/stoppen/umschalten
- `DAW REC ON` / `DAW REC OFF` / `DAW REC TOGGLE` — Aufnahme starten/stoppen/umschalten
- `STATE?` — Zustand abfragen. Gepushte STATE-Werte: `playing` (0/1), `recording` (0/1)

## Schritt-für-Schritt

### Einrichtung
- Audiodateien importieren (`wav, mp3, m4a, aac, flac, ogg …`) und auf Spuren anordnen; exotische Container werden automatisch zu 48-kHz-WAV dekodiert.
- Für Aufnahme: Eingangsgerät wählen, Spur scharfschalten. Ausgabe landet als WAV in `userData/recordings`.

### Während (Schnitt & Mix)
- Clips schneiden/verschieben, Fades setzen (Nulldurchgang-Hilfe für klickfreie Schnitte).
- **Mixer**: Fader (dB), Pan, Mute, Solo, Master. Optional das **Mixer-Popout-Fenster** auf einen zweiten Monitor.
- **Effekte** je Spur/Master: 3-Band-EQ, Kompressor (Threshold/Ratio/Attack/Release), Reverb.
- **Automation** (Lautstärke/Pan als Hüllkurven) und **AUX-Busse/Sends** für gemeinsame Effektwege.
- Transport per Companion/Rundown fernsteuerbar (`DAW PLAY`/`REC …`).

### Export
- Offline-Mix rendern und schreiben als **WAV** (16/24/32-bit), **MP3**, **FLAC**, **AAC** oder **OGG**.

## Profi-Tipps
- Für Weiterverarbeitung/Archiv **WAV** (24-bit), für Verteilung MP3/AAC. 32-bit-WAV geht ohne Re-Encode raus (verlustfrei).
- Aufnahmen lieber im **JM Audio Recorder** machen (spezialisiert, getrennte Spuren) und zum Mischen in die DAW importieren — beide teilen sich das Audiomodul.
- Solo/Mute großzügig nutzen, um einzelne Spuren beim Mischen freizustellen; Automation für saubere Ein-/Ausblendungen statt manuellem Fadern.
- `DAW REC TOGGLE` auf einen Companion-Button legen — ein Knopf mit `recording`-Tally als Rückmeldung.
- Über eine **`.jmshow`** öffnet die DAW ihr referenziertes `.jmdaw`-Projekt automatisch.

## Pannenhilfe

| Risiko | Gegenmaßnahme |
| --- | --- |
| Keine Geräteliste / Aufnahme nicht möglich | Natives Audiomodul (`@jm/audio`) gebaut? Eingang vorhanden und nicht belegt? |
| Aufnahme scheitert beim Scharfschalten | Gerät von anderer App belegt, falscher Treiber (ASIO/Dante) — Eingang prüfen |
| Export-FFmpeg-Fehler | Fehlerdetail lesen; Zielformat/-pfad prüfen |
| Import wird nicht erkannt | Exotisches Format — wird ggf. transkodiert; sonst vorab umwandeln |
| Companion steuert nicht | Port 8730 offen? `jm-daw-ctl` (ctl=1) im mDNS sichtbar? |
| Knackser an Schnittkanten | Fades/Nulldurchgang-Hilfe nutzen |

## Checklisten

### Einrichtung
- [ ] Spuren angelegt, Material importiert
- [ ] (Aufnahme) Eingangsgerät gewählt, Spur scharf
- [ ] Companion/Rundown auf 8730 verbunden (optional)

### Vor dem Export
- [ ] Mix final (Fader/Pan/Effekte/Automation)
- [ ] Solo/Mute zurückgesetzt
- [ ] Zielformat gewählt, Zielordner mit Platz
