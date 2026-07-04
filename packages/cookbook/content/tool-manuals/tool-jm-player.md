---
id: tool-jm-player
title: "JM Player — Zuspieler, Playlists & Soundboard"
category: Tool-Manuals
difficulty: einfach
setupTimeMin: 10
teamSize: "1"
tags: [player, zuspieler, playlist, soundboard, cues, einlaufmusik, companion, manual]
relatedTools: [jm-player, jm-switcher, jm-rundown, jm-timer]
prerequisites:
  - JM Player installiert (über den Launcher)
  - Medien lokal verfügbar (Video/Audio) — Bibliothek liegt lokal (SQLite)
  - Optional Audio-/Video-Ausgabegerät (Bühnen-PA, Mischer-Eingang)
  - Optional Bitfocus Companion / JM Rundown für die Fernsteuerung
equipmentOwner: jm
crewRoles:
  - Media Operator / Ton
lastReviewed: 2026-07-04
owner: tech@jakobsmedien.com
summary: "Video-/Audio-Zuspieler mit Playlists (Lounge-/Einlaufmusik), Show-Cues und Soundboard-Pads für Instant-Effekte — Standby/GO-Bedienung und TCP-Fernsteuerung."
---

## Zutaten

### Voraussetzungen
- JM Player installiert (über den Launcher)
- Medien lokal verfügbar — die Bibliothek (Playlists, Soundboard, Tags) liegt lokal in einer SQLite-Datei
- Ausgabegerät: Bühnen-PA / Mischer-Eingang (Audio) bzw. Bildmischer (Video)
- Optional: Bitfocus Companion oder JM Rundown für die Fernsteuerung

### Netzwerk & Ports
- Port **8725** (TCP-Zeilenprotokoll): Steuerport für Companion / Rundown. Auto-Discovery über mDNS (`jm-player-ctl`, TXT `ctl=1`).
- Bedienmodell: **Standby → GO**. Ein Cue steht auf Standby, `GO` feuert ihn; Soundboard-Pads triggern sofort (unabhängig vom Standby).

### Fernsteuer-Befehle (TCP 8725)
- `PLAYER GO` — den Standby-Cue feuern; `PLAYER STANDBY <Nr.>` — Standby setzen; `PLAYER NEXT` / `PLAYER PREV` — Standby ±1
- `PLAYER CUE <Nr.>` — einen bestimmten Show-Cue direkt feuern
- `PLAYER STOP` (alle Cues) · `PLAYER PAUSE` (Pause/Resume) · `PLAYER PANIC` (Hard-Stop)
- `PLAYER PAD <Slot>` — Soundboard-Pad triggern
- `PLAYER SHOW <Name oder DB-Nr.>` — gespeicherte Show/Playlist aufrufen
- `STATE?` — Zustand abfragen. Gepushte STATE-Werte: `playing`, `paused`, `standby`, `standby_label`, `cues`, `playing_count`

## Schritt-für-Schritt

### Einrichtung
- Medien in die Bibliothek aufnehmen und taggen; Playlist(s) anlegen — z. B. „Lounge", „Einlauf", „Pause"
- Show-Cues in Reihenfolge bringen; Soundboard-Pads mit Instant-Effekten/Stingern belegen
- Ausgabegerät wählen (PA/Mischer-Eingang bzw. Videoausgang)
- Fernsteuerung: Companion/Rundown auf Port 8725 zeigen lassen (Auto-Discovery `jm-player-ctl`)

### Während
- Standby setzen und mit `GO` feuern (lokal oder per Companion) — `NEXT`/`PREV` schiebt den Standby
- Soundboard-Pads für Applaus/Stinger/Jingle sofort auslösen (`PAD <Slot>`)
- `PAUSE` für kurze Unterbrechung, `STOP` beendet sauber, `PANIC` bei Bedarf hart abwürgen

### Nachbereitung
- Alle Cues stoppen; nächste Playlist (z. B. „Ausklang") auf Standby legen

## Profi-Tipps
- Einlaufmusik als eigene Playlist auf Standby — ein `GO` startet den Einlauf, ohne suchen zu müssen.
- Mit JM Rundown koppeln: ein GO pro Segment feuert automatisch den passenden Player-Cue (gleicher Port 8725).
- Soundboard-Pads für die Momente, die keine Verzögerung dulden (Applaus, Buzzer) — Pads gehen sofort, unabhängig vom Standby-Cue.
- `PANIC` auf einen roten Companion-Button legen — der Not-Aus für den Ton, wenn ein Cue entgleist.

## Pannenhilfe

| Risiko | Gegenmaßnahme |
| --- | --- |
| Kein Ton/Bild beim GO | Richtiges Ausgabegerät gewählt? Kabel/Pegel am Mischer prüfen |
| Companion/Rundown steuert nicht | Port 8725 offen? `jm-player-ctl` im mDNS sichtbar? |
| Falscher Cue läuft | Standby prüfen (`STATE` `standby`/`standby_label`) — `GO` feuert immer den Standby, nicht die Auswahl |
| Soundboard-Pad reagiert nicht | Richtiger Slot? Datei in der Bibliothek vorhanden/lesbar? |
| Cue hängt / lässt sich nicht stoppen | `PANIC` (Hard-Stop), danach neu auf Standby legen |

## Checklisten

### Einrichtung
- [ ] Medien in der Bibliothek + getaggt
- [ ] Playlists angelegt (Lounge/Einlauf/Pause)
- [ ] Show-Cues in Reihenfolge, Soundboard-Pads belegt
- [ ] Ausgabegerät gewählt
- [ ] Companion/Rundown auf Port 8725 verbunden (optional)

### Vor Live
- [ ] Test-`GO` + Pegel geprüft
- [ ] Soundboard-Pads getestet
- [ ] `PANIC`-Button erreichbar
