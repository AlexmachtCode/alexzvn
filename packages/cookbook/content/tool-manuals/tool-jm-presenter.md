---
id: tool-jm-presenter
title: "JM Presenter — Folien mit Referenten- & Publikumsansicht"
category: Tool-Manuals
difficulty: mittel
setupTimeMin: 15
teamSize: "1"
tags: [presenter, folien, powerpoint, pdf, referentenansicht, publikum, clicker, pin, companion, manual]
relatedTools: [jm-presenter, jm-timer, jm-stage-display, jm-rundown]
prerequisites:
  - JM Presenter installiert (über den Launcher)
  - Foliendokument (.pdf, PowerPoint/Office, Bilder oder .jmpres)
  - LibreOffice installiert (nur für Office-Import PPTX/DOCX …)
  - Zweiter Monitor/Beamer für die Publikumsansicht
  - Optional Handy im WLAN als Clicker (mit PIN)
  - Optional Internet am Präsentationsrechner für den Gast-Klicker (Remote-Gäste schalten selbst weiter)
equipmentOwner: jm
crewRoles:
  - Präsentations-Operator / Regie
lastReviewed: 2026-07-04
owner: tech@jakobsmedien.com
summary: "Folien aus PDF/PowerPoint aufbereiten und mit getrennter Referenten- und Publikumsansicht präsentieren — Notizen, Black/White, Bauchbinden-Overlays, Handy-Clicker mit PIN, Companion-Steuerung und Timer-Countdown."
---

## Zutaten

### Voraussetzungen
- JM Presenter installiert (über den Launcher)
- Ein Foliendokument: **.pdf**, **Bilder** (PNG, JPEG, WebP, GIF, BMP, AVIF, SVG), ein **Office-Format** (PPTX/PPT/ODP/DOCX/…) oder ein editierbares **.jmpres**-Projekt
- **LibreOffice** (`soffice`) installiert — nur nötig für den Office-Import (Office → PDF)
- Zweiter Monitor/Beamer für die Publikumsansicht (Vollbild)
- Optional: Handy im WLAN als Clicker (PIN), JM Timer für den Countdown, Companion/Rundown

### Netzwerk & Ports
- Port **8728** (TCP-Zeilenprotokoll): Steuerport für Companion / Rundown. Auto-Discovery über mDNS (`jm-presenter-ctl`, TXT `ctl=1`).
- Port **7330** (HTTP/SSE): Handy-Clicker + Live-Folienbild — optional per **4-stelliger PIN** geschützt. Wird auch von JM Stage Display als Referenten-Feed genutzt.
- Port **7777** (socket.io, ausgehend): liest den JM-Timer-Countdown und spiegelt ihn in Referenten-/Publikumsansicht.
- **Gast-Klicker** (HTTPS/WebSocket, nur ausgehend zu `jm-gast-klicker.jm-production-suite.workers.dev`): kein eingehender Port nötig.

### Fernsteuer-Befehle (TCP 8728)
- `PRESENTER NEXT` / `PRESENTER PREV` — eine Folie vor/zurück
- `PRESENTER GOTO <n>` — zu Folie n springen (1-basiert)
- `PRESENTER BLACK` / `PRESENTER WHITE` — Pausenbild schwarz/weiß
- `PRESENTER LIVE` — zurück zur Folie (Pause aufheben)
- `PRESENTER OPEN <pfad>` — Dokument öffnen (.pdf/.pptx/.jmpres/Bild)
- `PRESENTER STOP` — Präsentation beenden
- `STATE?` — Zustand abfragen. Gepushte STATE-Werte: `slide`, `total`, `active`, `live`, `black`, `white`

## Schritt-für-Schritt

### Einrichtung
- Dokument importieren: PDF/Bilder direkt, Office-Dateien werden per LibreOffice zu PDF gewandelt. Bei Bedarf als **.jmpres**-Projekt speichern (behält Overlays/Reihenfolge).
- Optional **Overlays** je Folie setzen (Text/Logo/Bauchbinde, frei positioniert).
- **Publikumsansicht** auf den Beamer/zweiten Monitor legen (Vollbild); die **Referentenansicht** bleibt beim Operator (aktuelle + nächste Folie, Notizen).
- Handy-Clicker aktivieren: Port/Interface wählen, **PIN** setzen, QR/URL ans Handy geben.
- Fernsteuerung: Companion/Rundown auf Port 8728; JM Timer für den Countdown verbinden (7777).
- **Gast-Klicker übers Internet** (für Remote-Gäste, z. B. per Zoom): im Fenster **Fernsteuerung** den Abschnitt „Gast-Klicker“ einschalten, **„Für den Zoom-Chat kopieren“** und den Link einmal in den Chat stellen (ein Link je Event; er bleibt nach einem Neustart gleich). Der Gast öffnet ihn im Browser, sieht ein kleines Bild der aktuellen Folie und klickt **Next/Back** oder nutzt die Pfeiltasten – ohne Installation.

### Während
- Navigieren mit `NEXT`/`PREV` (lokal, Handy oder Companion). `GOTO` springt gezielt.
- `BLACK`/`WHITE` für Pausen/Umbau, `LIVE` holt die Folie zurück.
- Referentenansicht im Blick behalten: Notizen + nächste Folie + Countdown; das Publikum sieht nur die saubere Folie.
- Gast-Klicker: Die Anzeige **„Gast-Klick ●“** in der Referentenansicht pausiert Gast-Klicks per Klick (**„Gast-Klick pausiert“**) und setzt sie fort. Der eigene Clicker und die Tastatur wirken immer.

### Nachbereitung
- `STOP` beendet die Präsentation; Projekt (.jmpres) sichern, falls Overlays/Anpassungen erhalten bleiben sollen.

## Profi-Tipps
- Office vorab importieren und als **.jmpres** speichern — der LibreOffice-Wandlungsschritt passiert dann einmal in Ruhe, nicht unter Live-Druck.
- Notizen in der Quelldatei pflegen — sie erscheinen in der Referentenansicht und (optional) auf dem JM Stage Display als Confidence-Monitor.
- Handy-Clicker mit **PIN** betreiben, sonst kann jeder im WLAN weiterklicken. Dieselbe PIN braucht das Stage Display für den Folien-Feed.
- Gast-Klicker: Wer den Link hat, kann vor/zurück klicken. Ist Publikum im Zoom-Chat, den Link **privat** an den Gast schicken. Wurde ein Link weitergegeben, im Fenster Fernsteuerung **„Neuer Link“** – der alte wirkt dann nicht mehr.
- `BLACK` auf einen Companion-Button — schneller sauberer „Vorhang" zwischen zwei Programmpunkten.
- Über eine **`.jmshow`** öffnet der Presenter sein `.jmpres` automatisch; das Stage Display zieht Referenten-Feed + PIN aus derselben Show.

## Pannenhilfe

| Risiko | Gegenmaßnahme |
| --- | --- |
| Office-Import schlägt fehl | LibreOffice installiert und auffindbar? Sonst als PDF exportieren und dieses importieren |
| „Port belegt" bei der Fernbedienung | Anderen Remote-Port wählen (Standard 7330) |
| Handy/Clicker meldet 401 | Falsche/fehlende PIN — PIN am Handy eingeben; dieselbe PIN im Stage Display |
| Kein Bild auf dem Beamer | Publikumsfenster geöffnet + richtiger Monitor? Vollbild aktiv? |
| Countdown bleibt leer | JM Timer läuft und ist auf 7777 erreichbar, Timer-Sync aktiv? |
| Gast sieht „Presenter offline“ / Anzeige „Gast-Klick getrennt“ | Gast-Klicker eingeschaltet? Internet am Präsentationsrechner prüfen; der Presenter verbindet von selbst neu. Bis dahin weiter wie gewohnt selbst klicken |
| Gast sieht „This link is not active“ | Der Link ist veraltet (inzwischen „Neuer Link“ erzeugt), war noch nie verbunden oder 7 Tage unbenutzt – im Fenster Fernsteuerung den aktuellen Link kopieren, dem Gast schicken, Gast lädt die Seite neu |
| Companion steuert nicht | Port 8728 offen? `jm-presenter-ctl` (ctl=1) im mDNS? |

## Checklisten

### Einrichtung
- [ ] Dokument importiert (Office → PDF via LibreOffice) / als .jmpres gespeichert
- [ ] Overlays gesetzt (falls nötig)
- [ ] Publikumsansicht auf Beamer/Monitor (Vollbild), Referentenansicht beim Operator
- [ ] Handy-Clicker mit PIN aktiv (QR/URL verteilt)
- [ ] Companion 8728 + JM Timer 7777 verbunden (optional)

### Vor Live
- [ ] Durch alle Folien geklickt (Reihenfolge/Overlays ok)
- [ ] Black/White + LIVE getestet
- [ ] Notizen erscheinen in der Referentenansicht
- [ ] Countdown läuft
