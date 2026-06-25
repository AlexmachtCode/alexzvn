---
id: tool-jm-battle
title: "JM Battle — BattleRap-Voting & Replay"
category: Tool-Manuals
difficulty: mittel
setupTimeMin: 25
teamSize: "1-2"
tags: [battle, voting, jury, qr, replay, companion, manual]
relatedTools: [jm-battle, jm-titler, jm-recorder]
prerequisites:
  - JM Battle installiert (über den Launcher)
  - Netz/WLAN für das Publikums-Voting per QR-Code
  - JM Titler im selben LAN (VS-Bauchbinde)
  - Eine laufende Aufnahme als Quelle für den Instant-Replay
equipmentOwner: jm
crewRoles:
  - Battle-Operator
lastReviewed: 2026-06-25
owner: tech@jakobsmedien.com
summary: "BattleRap-Toolkit: zwei Kontrahenten, Runden mit Jury-Entscheid und Publikums-Voting per QR (Port 7783), VS-Bauchbinde via Titler, Instant-Replay aus der Aufnahme — fernsteuerbar per Companion über Port 8734."
---

## Zutaten

### Voraussetzungen
- JM Battle (über den Launcher)
- Netz/WLAN für das QR-Voting der Gäste
- JM Titler im selben LAN (VS-Bauchbinde)
- Laufende Aufnahme (Quelle für den Instant-Replay)

### Netzwerk & Ports
- Port 7783 (@jm/remote, HTTP): Publikums-Voting. Gäste scannen den QR und landen auf http://<host-ip>:7783/.
- Port 8734 (TCP-Zeilenprotokoll): Steuerport für Bitfocus Companion. mDNS-Name jm-battle-ctl (TXT ctl=1, Auto-Discovery).
- Fern-Befehle: BATTLE NEXT | BATTLE PREV | BATTLE WIN a|b|tie | BATTLE VOTING on|off|toggle | BATTLE VS on|off|toggle | BATTLE REPLAY | BATTLE RESET | STATE?.
- Status-Push: STATE round, total, wins_a, wins_b, votes_a/votes_b, live.
- Instant-Replay schneidet die letzten Sekunden aus der laufenden Aufnahme (via @jm/media/ffmpeg).

## Schritt-für-Schritt

### Einrichtung
- Kontrahenten und Runden anlegen
- VS-Bauchbinde über JM Titler prüfen (BATTLE VS on/off blendet sie ein/aus)
- Voting konfigurieren (Jury-Entscheid und/oder Publikum per QR, Port 7783)
- Aufnahmequelle für den Instant-Replay verbinden
- Optional: Companion auf Port 8734 verbinden

### Während
- Runde starten, VS-Bauchbinde einblenden (BATTLE VS on)
- Voting öffnen (BATTLE VOTING on), dann schließen (off); Sieger setzen mit BATTLE WIN a|b|tie
- Bei Bedarf BATTLE REPLAY — letzte Sekunden aus der Aufnahme abspielen
- Mit BATTLE NEXT in die nächste Runde

### Nachbereitung
- Ergebnisse sichern; BATTLE RESET für das nächste Battle

## Profi-Tipps
- Voting-Fenster bewusst kurz halten (BATTLE VOTING on → off) — das hält die Dramaturgie straff.
- Replay-Länge vorab testen, damit der Ausschnitt sitzt; die Aufnahme muss dafür durchgehend laufen.
- Companion-Layout für den Live-Flow: VS, VOTING, WIN a/b und REPLAY auf eigene Taster — der Operator bleibt am Geschehen statt in Menüs.
- QR fürs Publikum groß auf den Stream/eine Folie legen.

## Pannenhilfe

| Risiko | Gegenmaßnahme |
| --- | --- |
| QR-Voting kommt nicht an | Gäste-WLAN erreicht Port 7783 am Host? http://<host-ip>:7783/ testen |
| VS-Bauchbinde fehlt | JM Titler im selben LAN gestartet? BATTLE VS on gesendet? |
| Instant-Replay ist leer | Läuft die Aufnahme (Recorder) durchgehend? Quelle/Verbindung prüfen |
| Companion steuert nicht | Port 8734 (jm-battle-ctl) erreichbar? Gemeinsames LAN? |

## Checklisten

### Einrichtung
- [ ] Kontrahenten und Runden angelegt
- [ ] Titler verbunden (VS-Bauchbinde)
- [ ] Voting konfiguriert (Port 7783 erreichbar)
- [ ] Aufnahme für Replay verbunden
- [ ] Companion an Port 8734 verbunden (optional)

### Vor Live
- [ ] Test-Voting durchgeführt
- [ ] Test-Replay erzeugt
