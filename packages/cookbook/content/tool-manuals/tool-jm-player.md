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
- Medien im Reiter „Bibliothek“ aufnehmen und taggen; Playlist(s) dort anlegen — z. B. „Lounge", „Einlauf", „Pause"
- Show-Cues im Reiter „Cue-Show“ in Reihenfolge bringen (eine andere Show dort mit der Show-Auswahl wählen und mit „Setzen“ übernehmen, das dann rechts im Kopf der Cue-Show vor „▦ Ausgabe“ erscheint; erst „Setzen“ wechselt die Show und räumt die laufende); Soundboard-Pads im Reiter „Soundboard“ mit Instant-Effekten/Stingern belegen
- Ausgabewege einrichten: Der Ton von Show-Cues, Pads und Video läuft über das Standard-Wiedergabegerät von Windows, eine eigene Gerätewahl hat der Player nicht (PA/Mischer-Eingang dort als Standard setzen); den Bildschirm für Video-Cues im Panel ⚙ › Ausgabe auf Bildschirm wählen, der Schalter „Ausgabe“ öffnet dort das Fenster
- Fernsteuerung (Statusleiste „Fernsteuerung“, Panel ⚙ › Fernsteuerung): Companion/Rundown auf Port 8725 zeigen lassen (Auto-Discovery `jm-player-ctl`)

### Während
- Standby setzen und mit `GO` feuern (lokal in der Cue-Show mit der Haupttaste „GO“ ganz rechts im Transport oder der Leertaste, oder per Companion) — `NEXT`/`PREV` schiebt den Standby
- Soundboard-Pads im Reiter „Soundboard“ für Applaus/Stinger/Jingle sofort auslösen (`PAD <Slot>`)
- `PAUSE` für kurze Unterbrechung, `STOP` beendet sauber, `PANIC` bei Bedarf hart abwürgen (lokal die Haupttasten „❚❚ Pause“, „■ Stop“ und „⛔ Panik“ im Transport der Cue-Show; „■ Stop“ und „⛔ Panik“ stehen auch in der Fußleiste von Bibliothek und Soundboard, Panik stoppt jetzt auch die Pads)

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
| Kein Ton/Bild beim GO | Ton: richtiges Standard-Wiedergabegerät in Windows (der Player hat keine eigene Wahl)? Video: Statusleiste „Video-Ausgabe“ und Panel ⚙ › Ausgabe auf Bildschirm prüfen (Pille und „Steht auf“ nennen den Bildschirm, auf dem das Fenster wirklich steht; nach dem Wiederanstecken bleibt „Bildschirm fehlt“ stehen, bis „Auf diesen Bildschirm“ das Fenster verschiebt oder es neu geöffnet wird). Kabel/Pegel am Mischer prüfen |
| Companion/Rundown steuert nicht | Statusleiste „Fernsteuerung“ ansehen; Port 8725 offen? `jm-player-ctl` im mDNS sichtbar? |
| Falscher Cue läuft | Standby in der Standby-Anzeige über den Tasten der Cue-Show bzw. in der Statusleiste „Cue-Show“ prüfen (`STATE` `standby`/`standby_label`) — `GO` feuert immer den Standby, nicht die Auswahl |
| Soundboard-Pad reagiert nicht | Richtiger Slot? Datei in der Bibliothek vorhanden/lesbar? |
| Cue hängt / lässt sich nicht stoppen | `PANIC` (Hard-Stop; lokal „⛔ Panik“ im Transport oder in der Fußleiste), danach neu auf Standby legen |

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
