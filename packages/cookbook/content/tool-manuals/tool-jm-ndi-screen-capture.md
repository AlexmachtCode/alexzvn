---
id: tool-jm-ndi-screen-capture
title: "JM NDI Screen Capture — Bildschirm als NDI-Quelle"
category: Tool-Manuals
difficulty: einfach
setupTimeMin: 5
teamSize: "1"
tags: [ndi, screen-capture, bildschirm, fenster, tray, streaming, studio, manual]
relatedTools: [jm-ndi-screen-capture, jm-switcher, jm-stage-display]
prerequisites:
  - JM NDI Screen Capture installiert (über den Launcher)
  - Ein NDI-Empfänger im LAN (JM Switcher, NDI Studio Monitor, OBS-NDI, vMix …)
  - Studio-LAN mit funktionierendem mDNS/NDI-Discovery
equipmentOwner: jm
crewRoles:
  - Bildtechnik / Zuspielung
lastReviewed: 2026-07-05
owner: tech@jakobsmedien.com
summary: "Sendet einen Bildschirm oder ein Fenster als NDI-Quelle ins Studio-LAN — mit einstellbarer Bildrate (25/30/50/60), optionalem System-Audio (Windows) und Tray-Betrieb, sodass die NDI-Ausgabe im Hintergrund weiterläuft."
---

## Zutaten

### Voraussetzungen
- JM NDI Screen Capture installiert (über den Launcher). Nutzt die native NDI-Runtime.
- Ein **NDI-Empfänger** im selben LAN: JM Switcher, NDI Studio Monitor, OBS mit NDI-Plugin, vMix, TriCaster …
- Studio-LAN mit funktionierendem NDI-Discovery (mDNS). Kein zweiter Monitor nötig, aber praktisch (man erfasst ja einen Screen/ein Fenster).

### Netzwerk & Ausgabe
- Ausgabe als **NDI-Quelle** ins LAN — **kein Steuerserver, keine Show-Anbindung**.
- NDI-Quellname wird automatisch gebildet: `JM Capture (<Rechnername>) - <Quelle>` (z. B. „JM Capture (STUDIO-PC) - Display 1").

## Schritt-für-Schritt

### Einrichtung
- **Quelle** wählen: einen Monitor **oder** ein Fenster (mit Vorschau-Thumbnail). „Aktualisieren", falls ein Fenster neu ist.
- **Bildrate** wählen: 25 / 30 / 50 / 60 (passend zum Studio-Standard PAL/NTSC).
- Optional **System-Audio mitsenden** (nur Windows — Loopback des Ton-Ausgangs).

### Während
- **Start** — die Quelle geht als NDI ins LAN; der Empfänger (z. B. Switcher) wählt „JM Capture …" aus. Die Statusleiste zeigt Auflösung, gemessene fps und die Zahl verbundener Empfänger.
- Das Fenster kann **geschlossen** werden — die App **minimiert ins System-Tray** und sendet weiter. Steuerung (Start/Stopp, fps, Audio, Beenden) über das **Tray-Menü**.

### Nachbereitung
- Über das Tray-Menü **Stopp** bzw. **Beenden** (echtes Schließen nur dort).

## Profi-Tipps
- Bildrate an das Programm anpassen: 50 für PAL-Produktionen, 25/30 für einfache Zuspielung — höhere fps kostet Bandbreite.
- Ein **Fenster** statt des ganzen Monitors erfassen, wenn nur eine Anwendung (Folien, Browser, Scoreboard) ins Bild soll — sauberer als der volle Desktop.
- Nach dem Start das Fenster ruhig schließen — der Tray-Betrieb hält die Quelle stabil, ohne dass jemand versehentlich das Sende-Fenster wegklickt.
- Im JM Switcher als NDI-Quelle einbinden — Folien/Grafiken vom Zuspiel-PC ohne Kabel ins Programm.

## Pannenhilfe

| Risiko | Gegenmaßnahme |
| --- | --- |
| Empfänger sieht die Quelle nicht | Gleiches Subnetz? Firewall/mDNS für NDI offen? Empfänger neu suchen lassen |
| Schwarzes Bild | Auf Hybrid-GPU-Notebooks bekannt — die App entschärft das (WGC/HW-Beschleunigung aus); Quelle neu wählen |
| Kein NDI-Versand trotz Start | Native NDI-Komponente nicht installiert — Vorschau läuft, Versand nicht |
| System-Audio kommt nicht mit | Loopback ist nur unter Windows verfügbar |
| Fenster „verschwunden" | Es liegt im System-Tray — App läuft weiter, dort Beenden/Steuern |
| Ruckelnde Ausgabe | Niedrigere fps wählen; Netz-/CPU-Last prüfen |

## Checklisten

### Einrichtung
- [ ] Quelle (Monitor/Fenster) gewählt
- [ ] Bildrate passend zum Studio
- [ ] System-Audio nach Bedarf (Windows)

### Vor Live
- [ ] Empfänger sieht „JM Capture …" und zeigt das Bild
- [ ] Verbundene Empfänger + fps in der Statusleiste ok
- [ ] Tray-Betrieb bekannt (Fenster schließen = weiter senden)
