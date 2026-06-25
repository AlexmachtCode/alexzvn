---
id: tool-jm-switcher
title: "JM Switcher — Video-Mischer einrichten"
category: Tool-Manuals
difficulty: mittel
setupTimeMin: 30
teamSize: "1"
tags: [switcher, ndi, streaming, rtmp, companion, manual]
relatedTools: [jm-switcher, jm-ndi-screen-capture, jm-titler, jm-stage-display]
prerequisites:
  - JM Switcher installiert (über den Launcher)
  - NDI-Runtime, falls NDI-Quellen genutzt werden
  - Capture-Karte inkl. Treiber, falls SDI/HDMI-Quellen
  - RTMP-Ziel (Stream-Key) + stabile Upload-Leitung (nur fürs Streaming)
  - Bitfocus Companion für die Fernsteuerung (optional)
equipmentOwner: jm
crewRoles:
  - Media Operator (Bildregie)
lastReviewed: 2026-06-25
owner: tech@jakobsmedien.com
summary: "Softwarebasierter Video-Mischer mit Program/Preview, NDI-/Capture-/Bildschirm-Quellen, Aufnahme und RTMP-Ausgang — Einrichtung, Companion-Fernsteuerung und Live-Bedienung."
---

## Zutaten

### Voraussetzungen
- JM Switcher installiert (über den Launcher)
- NDI-Runtime (für NDI-Quellen) bzw. Capture-Karten-Treiber (für SDI/HDMI)
- RTMP-Ziel + Upload-Leitung (nur fürs Streaming)

### Quellen
- Bildschirm oder einzelnes Fenster
- NDI-Quellen aus dem LAN (z. B. JM NDI Screen Capture, JM Titler)
- Capture-Karte (SDI/HDMI)

### Netzwerk & Steuerung
- TCP-Steuerport (Zeilenprotokoll): nicht fest verdrahtet — wird im Switcher aktiviert (Companion-/Steuerung-Einstellungen) bzw. per Umgebungsvariable JMSWITCH_CONTROL_PORT gesetzt. mDNS-Rolle switcher (jm-switcher-ctl).
- Fern-Befehle: PREVIEW <n> | PROGRAM <n> | CUT | AUTO | RECORD | STREAM | STATE?.
- Status-Push: STATE program, preview, recording, streaming, scenes — das Format ist rückwärtskompatibel zum alten Companion-Modul.

## Schritt-für-Schritt

### Einrichtung
- Quellen hinzufügen (Bildschirm/Fenster, NDI, Capture-Karte)
- Program/Preview prüfen, Reihenfolge der Quellen festlegen
- Audioquelle zuordnen und Pegel kontrollieren
- Aufnahme-Zielordner setzen
- Für Stream: RTMP-Ziel + Stream-Key hinterlegen und Verbindung testen
- Optional: Steuerport aktivieren und Companion verbinden (Tasten für CUT/AUTO/PROGRAM/Szenen)

### Während
- Quelle in Preview wählen (PREVIEW <n>)
- Mit CUT hart oder mit AUTO weich auf Program schalten
- Aufnahme (RECORD) und/oder Stream (STREAM) starten
- Stream-Status (Bitrate, Drops) und Audiopegel beobachten

### Nachbereitung
- Stream beenden, Aufnahme stoppen
- Aufnahme sichern und übergeben

## Profi-Tipps
- NDI-Quellen tauchen automatisch im LAN auf (mDNS) — alle Geräte ins gleiche Subnetz.
- JM Titler als eigene, transparente NDI-Quelle über das Programmbild legen.
- Companion-Belegung: PROGRAM <n> je Kamera auf eigene Taster, dazu CUT und AUTO — so schaltet die Bildregie blind.
- Vor Live einmal CUT und AUTO durchspielen; STATE? in Companion zeigt program/preview zur Kontrolle.

## Pannenhilfe

| Risiko | Gegenmaßnahme |
| --- | --- |
| NDI-Quelle erscheint nicht | Gleiches Subnetz prüfen, Firewall/mDNS freigeben |
| Kein Bild von der Capture-Karte | Treiber prüfen, Gerät nicht von anderem Programm belegt |
| Companion steuert nicht | Steuerport im Switcher aktiviert? Gleicher Port in Companion? Gemeinsames LAN? |
| Stream bricht ab | Bitrate senken, Upload prüfen, Backup-Uplink bereithalten |
| Kein Ton im Stream | Audioquelle zugeordnet? Pegel/Mute prüfen |

## Checklisten

### Einrichtung
- [ ] Quellen hinzugefügt
- [ ] Audio zugeordnet und gepegelt
- [ ] Aufnahme-Zielordner gesetzt
- [ ] RTMP-Verbindung getestet
- [ ] Steuerport aktiviert + Companion verbunden (optional)

### Vor Live
- [ ] Program/Preview korrekt
- [ ] CUT und AUTO getestet
- [ ] Aufnahme armiert
- [ ] Pegel ok
