---
id: tool-jm-rundown
title: "JM Rundown — Ablaufregie einrichten"
category: Tool-Manuals
difficulty: mittel
setupTimeMin: 30
teamSize: "1"
tags: [rundown, ablauf, regie, companion, mdns, manual]
relatedTools: [jm-rundown, jm-timer, jm-prompter, jm-presenter, jm-titler, jm-switcher]
prerequisites:
  - JM Rundown installiert (über den Launcher)
  - Die anzusteuernden Tools im selben LAN (werden per mDNS gefunden)
  - Bitfocus Companion für Fern-GO (optional)
equipmentOwner: jm
crewRoles:
  - Regie / Ablaufregie
lastReviewed: 2026-06-25
owner: tech@jakobsmedien.com
summary: "Zeilenbasierter Ablaufplan: ein GO startet pro Segment mehrere Tools gleichzeitig (Timer, Prompter, Presenter, Titler, Switcher) — lokal oder per Companion über Port 8731."
---

## Zutaten

### Voraussetzungen
- JM Rundown installiert (über den Launcher)
- Ziel-Tools im selben LAN gestartet (Timer, Prompter, Presenter, Titler, Switcher)
- Optional: Bitfocus Companion für Fern-GO

### Netzwerk & Ports
- Port 8731 (TCP-Zeilenprotokoll): Steuerport von JM Rundown selbst — so kann ein Dirigent (Companion) den Ablauf fern-GO-en. mDNS-Name jm-rundown-ctl (TXT ctl=1).
- Fern-Befehle an Rundown: RUNDOWN GO | RUNDOWN NEXT | RUNDOWN PREV | RUNDOWN GOTO <n> | STATE?. Rundown pusht STATE (cue, total, label).
- Rundown findet die Ziel-Tools per mDNS (deren ctl=1-Endpunkte) und feuert pro Zeile auf deren Steuerports: Timer 8724, Titler 8726, Prompter 8727, Presenter 8728, Switcher (konfigurierter Port).

### Was pro Segment gesteuert wird
- Timer-Block (JM Timer) — z. B. TIMER GOTO/START
- Prompter-Skript (JM Prompter)
- Presenter-Folie (JM Presenter)
- Titler-Bauchbinde (JM Titler)
- Switcher-Szene (JM Switcher)

## Schritt-für-Schritt

### Einrichtung
- Ziel-Tools starten, damit JM Rundown sie per mDNS findet (Steuer-Endpunkt jm-<tool>-ctl)
- Rundown-Zeilen je Segment anlegen und die Aktionen pro Zeile zuordnen
- Live-Status der gefundenen Tools prüfen (grün = ansteuerbar)
- Optional: Companion auf Port 8731 / jm-rundown-ctl verbinden für Fern-GO
- Als .jmrundown speichern

### Während
- Pro Segment GO drücken — feuert alle zugeordneten Aktionen gleichzeitig (lokal oder per RUNDOWN GO)
- Live-Status / Tally im Blick behalten
- Bei Bedarf einzelne Aktionen per Override anpassen

### Nachbereitung
- .jmrundown sichern

## Profi-Tipps
- Tools vor der Probe starten, damit sie im mDNS auftauchen und zuweisbar sind — ein Tool, das erst nach dem Zuordnen startet, fehlt in der Zeile.
- Pro Zeile nur die wirklich nötigen Aktionen — das hält das GO vorhersehbar.
- Companion steuert beide Ebenen: RUNDOWN GO am Port 8731 löst die Zeile aus; alternativ einzelne Tools direkt (z. B. TIMER START an 8724), wenn ein Segment mal abweicht.
- Ein .jmshow kann Rundown samt Ziel-Tools koordiniert mitstarten.

## Pannenhilfe

| Risiko | Gegenmaßnahme |
| --- | --- |
| Tool wird nicht gefunden | Gleiches Subnetz? Tool gestartet? mDNS/Firewall frei? Der ctl=1-Endpunkt jm-<tool>-ctl muss sichtbar sein |
| GO feuert nicht alle Aktionen | Zuordnung je Zeile kontrollieren; Live-Status des betroffenen Tools prüfen |
| Companion-GO ohne Wirkung | Companion zeigt auf Port 8731 (jm-rundown-ctl)? Gemeinsames LAN? |
| Eine einzelne Aktion läuft ins Leere | Ziel-Tool neu gestartet → Port/Endpunkt erneut zuordnen |

## Checklisten

### Einrichtung
- [ ] Ziel-Tools laufen und sind gefunden (ctl=1 sichtbar)
- [ ] Zeilen und Aktionen angelegt
- [ ] Live-Status grün
- [ ] Als .jmrundown gespeichert

### Vor Live
- [ ] Probe-GO je Segment gelaufen
- [ ] Companion an Port 8731 getestet (optional)
