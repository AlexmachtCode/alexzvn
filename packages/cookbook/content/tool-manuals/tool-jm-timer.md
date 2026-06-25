---
id: tool-jm-timer
title: "JM Timer — Countdown & Sprecher-Timer"
category: Tool-Manuals
difficulty: einfach
setupTimeMin: 10
teamSize: "1"
tags: [timer, countdown, sprecher, companion, mdns, manual]
relatedTools: [jm-timer, jm-stage-display, jm-rundown]
prerequisites:
  - JM Timer installiert (über den Launcher)
  - Zweiter Bildschirm / Sprecher-Monitor (optional)
  - Netzwerk / Bitfocus Companion für die Fernsteuerung (optional)
equipmentOwner: jm
crewRoles:
  - Regie / Media Operator
lastReviewed: 2026-06-25
owner: tech@jakobsmedien.com
summary: "Countdown- und Produktions-Timer mit Sprecherfenster, LAN-Remote-View und TCP-Fernsteuerung — Einrichtung, Ports und Bedienung im Live-Betrieb."
---

## Zutaten

### Voraussetzungen
- JM Timer installiert (über den Launcher)
- Optional: zweiter Monitor für das Sprecherfenster
- Optional: Bitfocus Companion oder JM Rundown für die Fernsteuerung

### Netzwerk & Ports
- Port 7777 (Socket.IO/HTTP, 0.0.0.0): Operator- und Sprecherfenster, der LAN-Remote-View im Browser und JM Stage Display hängen hier dran.
- Remote-View (Read-Only-Spiegel für iPad/Backstage-Monitor): http://<host-ip>:7777/?view=remote (Dev-Modus Port 5173). Die kopierbaren URLs stehen in der Operator-Sidebar unter „Remote".
- Port 8724 (TCP-Zeilenprotokoll, getrennt von 7777): der Steuerport für Bitfocus Companion und JM Rundown.
- mDNS: zwei Adverts — role=timer (Socket.IO, von Stage Display genutzt) und jm-timer-ctl (TXT ctl=1, von Companion automatisch gefunden).
- Optional Token-Auth für den Remote-Zugriff (in den Einstellungen aktivierbar, Token neu generierbar).

### Fernsteuer-Befehle (TCP 8724)
- TIMER START / TIMER STOP / TIMER RESET — Lauf steuern
- TIMER ADD <Sekunden> — Zeit addieren (Nachschlag); TIMER SET <Sekunden> — Dauer neu setzen
- TIMER GOTO <Block> — Timetable-Block anspringen; TIMER NEXT / TIMER PREV — Block wechseln
- STATE? — Zustand abfragen. Der Timer pusht laufend STATE (remaining, running, overrun, warning, block_label)

## Schritt-für-Schritt

### Einrichtung
- Timetable bzw. Presets je Segment anlegen — Regieplan optional per XLSX importieren (Spalten Titel/Dauer/Notiz; Dauer als HH:MM:SS, MM:SS oder Minuten)
- Sprecherfenster auf den Talent-Monitor schieben (Vollbild)
- Remote-View bei Bedarf: URL aus der „Remote"-Sidebar an Backstage/iPad geben
- Fernsteuerung: Companion auf den Steuerport 8724 zeigen lassen (Auto-Discovery über jm-timer-ctl) — oder mit JM Rundown koppeln, das denselben Port nutzt

### Während
- Timer starten / stoppen / zurücksetzen (lokal oder per Companion: TIMER START/STOP/RESET)
- Nachschlag geben mit TIMER ADD 60; harte Korrektur mit TIMER SET 300
- Kurznachricht für die Bühne einblenden; Over-Time (Rotphase) im Blick behalten

### Nachbereitung
- Timer bzw. Timetable für das nächste Segment zurücksetzen

## Profi-Tipps
- Companion-Button „Segment 3 scharf": TIMER GOTO 3 gefolgt von TIMER START — ein Tastendruck springt den Block an und startet ihn.
- Mit JM Rundown koppeln: ein GO startet pro Segment automatisch den passenden Timer-Block (Rundown spricht denselben Port 8724).
- Den Countdown zusätzlich auf JM Stage Display für die Crew zeigen — das hängt am Socket.IO-Port 7777, nicht am Steuerport.
- Token-Auth nur einschalten, wenn das LAN nicht vertrauenswürdig ist — sonst hält es Backstage-Geräte unnötig auf.

## Pannenhilfe

| Risiko | Gegenmaßnahme |
| --- | --- |
| Remote-View im Browser lädt nicht | Host-IP + Port 7777 erreichbar? Gleiches LAN, Firewall für 7777 frei |
| Companion/Rundown steuert nicht | Das ist Port 8724, nicht 7777 — Steuerport offen? jm-timer-ctl im mDNS sichtbar? |
| Remote zeigt „nicht autorisiert" | Token-Auth aktiv → Token aus den Einstellungen verwenden oder neu generieren |
| Stage Display findet den Timer nicht | role=timer-Advert (nicht der ctl-Endpunkt), gleiches Subnetz, mDNS frei |
| Sprecherfenster auf falschem Monitor | Fenster auf den Talent-Monitor ziehen, Vollbild setzen |

## Checklisten

### Einrichtung
- [ ] Timetable/Presets je Segment angelegt (ggf. XLSX importiert)
- [ ] Sprecherfenster auf Talent-Monitor
- [ ] Remote-View-URL verteilt (optional)
- [ ] Companion auf Port 8724 / jm-timer-ctl verbunden (optional)

### Vor Live
- [ ] Test-Start gelaufen
- [ ] TIMER GOTO/START per Companion getestet (optional)
- [ ] Auf Stage Display sichtbar
