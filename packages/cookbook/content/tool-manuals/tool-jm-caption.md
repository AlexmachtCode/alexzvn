---
id: tool-jm-caption
title: "JM Caption — Live-Untertitel (NDI) einrichten"
category: Tool-Manuals
difficulty: mittel
setupTimeMin: 20
teamSize: "1"
tags: [caption, untertitel, ndi, whisper, barrierefreiheit, bitv, companion, manual]
relatedTools: [jm-caption, jm-switcher, jm-studio-control]
prerequisites:
  - Windows mit installierter NDI-Runtime
  - JM Caption installiert (über den Launcher)
  - Audioeingang (Mikrofon oder Saal-/Stream-Mix)
  - Whisper-Modell (Basismodell mitgeliefert, größere nachladbar)
equipmentOwner: jm
crewRoles:
  - Media Operator (Untertitel)
lastReviewed: 2026-06-25
owner: tech@jakobsmedien.com
summary: "Live-Untertitel offline via whisper.cpp als transparente NDI-Quelle — für Politik-Streams, Pressekonferenzen und Barrierefreiheit (BITV), fernsteuerbar per Companion über Port 8732."
---

## Zutaten

### Voraussetzungen
- Windows + NDI-Runtime
- JM Caption (über den Launcher)
- Audioeingang (Mikrofon oder besser ein sauberer Mix)
- Whisper-Modell (Basis mitgeliefert, größere für mehr Genauigkeit nachladbar)

### Netzwerk & Steuerung
- Port 8732 (TCP-Zeilenprotokoll): Steuerport für Bitfocus Companion. mDNS-Name jm-caption-ctl (TXT ctl=1, Auto-Discovery).
- Fern-Befehle: CAPTION transcribe on|off|toggle | CAPTION hold on|off|toggle | CAPTION ndi on|off|toggle | CAPTION clear | STATE?.
- Status-Push: STATE running, hold, ndi, connections, lines.
- Ausgabe ist eine eigene, transparente NDI-Quelle — im LAN per mDNS sichtbar, wird im Mischer (TriCaster/vMix/OBS) als Quelle eingebunden.

## Schritt-für-Schritt

### Einrichtung
- Audioquelle wählen (sauberer Pult-Mix bevorzugt gegenüber Raummikrofon)
- Sprache und Whisper-Modell setzen (größer = genauer, aber mehr CPU-Last)
- Stil und Position der Untertitel anpassen
- NDI-Ausgabe in TriCaster / vMix / OBS als Quelle einbinden
- Optional: Companion auf Port 8732 verbinden (Transkription an/aus, Hold, NDI, Clear)

### Während
- Transkription starten (lokal oder CAPTION transcribe on)
- Bei Fehlern CAPTION hold on zum Einfrieren, letzte Zeile korrigieren, dann hold off
- CAPTION clear leert die Anzeige hart (z. B. vor einem neuen Sprecher)
- Lesbarkeit und Timing im Blick behalten

### Nachbereitung
- Transkription stoppen (CAPTION transcribe off), NDI bei Bedarf abschalten

## Profi-Tipps
- Größeres Modell = bessere Genauigkeit, aber mehr CPU-Last — vorab unter Realbedingungen testen, Aussetzer = Modell kleiner wählen.
- Sauberer Ton (Pult-Mix statt Raummikro) verbessert die Erkennung deutlich.
- Companion-Hold als eigener Taster: in heiklen Momenten (O-Ton, Versprecher) einfrieren statt löschen.
- NDI separat halten: Transkription kann laufen, während die NDI-Ausgabe per CAPTION ndi off kurz aus dem Programm genommen wird.

## Pannenhilfe

| Risiko | Gegenmaßnahme |
| --- | --- |
| NDI-Quelle erscheint nicht im Mixer | NDI-Runtime installiert? Gleiches Subnetz, mDNS/Firewall frei |
| Companion steuert nicht | Port 8732 (jm-caption-ctl) erreichbar? Gemeinsames LAN? |
| Untertitel zu spät oder falsch | Modell/Sprache prüfen, Audioqualität (Pult-Mix) verbessern |
| Aussetzer / Ruckeln | CPU-Last beobachten, kleineres Whisper-Modell wählen |

## Checklisten

### Einrichtung
- [ ] Audioquelle gewählt (Mix bevorzugt)
- [ ] Modell und Sprache gesetzt
- [ ] NDI-Quelle im Mixer sichtbar
- [ ] Companion an Port 8732 verbunden (optional)

### Vor Live
- [ ] Probesatz korrekt erkannt
- [ ] Hold getestet (CAPTION hold on/off)
- [ ] Lesbarkeit und Position ok
