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
- Dokument importieren: mit „+ PDF / Bilder“ bzw. „+ Office“ in der Werkzeugleiste des Editors oder per Ziehen ins Fenster. PDF/Bilder direkt, Office-Dateien werden per LibreOffice zu PDF gewandelt (PPTX-Aufbau-Animationen als Einzelschritte schaltet das Panel ⚙ › Import). Bei Bedarf mit „Speichern“ als **.jmpres**-Projekt speichern (behält Overlays/Reihenfolge).
- Optional **Overlays** je Folie setzen (Text/Logo/Bauchbinde, frei positioniert).
- **Publikumsansicht** auf den Beamer/zweiten Monitor legen (Vollbild): im Editor den Bildschirm im Panel ⚙ › Ausgabe auf Bildschirm wählen, dann mit der Haupttaste „Präsentieren“ rechts in der Werkzeugleiste starten (abhängig von Owner-Frage P1). Während der Präsentation den Bildschirm in der Leiste des Referenten wählen und mit „Auf diesen Bildschirm“ umziehen; die Wahl allein verschiebt nichts. Die **Referentenansicht** bleibt beim Operator (aktuelle + nächste Folie, Notizen) und bleibt dunkel, auch wenn der Editor hell ist.
- Handy-Clicker im Panel ⚙ › Handy-Fernsteuerung aktivieren (in Editor und Referent, auch vor der Präsentation): Netzwerkkarte und Port wählen und mit „Setzen“ übernehmen, „PIN-Schutz (empfohlen im offenen WLAN)“ anlassen, den Server einschalten („Server aktiv“), QR/URL und **PIN** aus dem Abschnitt ans Handy geben.
- Fernsteuerung: Companion/Rundown auf Port 8728 (Statusleiste „Fernsteuerung“, Panel ⚙ › Fernsteuerung); JM Timer für den Countdown im Panel ⚙ › Gegenstellen verbinden: in der Zeile „JM Timer“ „Aktiv“ einschalten, Host und Port (7777) eintragen und mit „Setzen“ übernehmen (Statusleiste „JM Timer“).
- **Gast-Klicker übers Internet** (für Remote-Gäste, z. B. per Zoom): im Panel ⚙ › Gast-Klicker (in Editor und Referent, auch vor der Präsentation) den Schalter einschalten („Gast-Klicker an“), **„Für den Zoom-Chat kopieren“** und den Link einmal in den Chat stellen (ein Link je Event; er bleibt nach einem Neustart gleich). Der Gast öffnet ihn im Browser, sieht ein kleines Bild der aktuellen Folie und klickt **Next/Back** oder nutzt die Pfeiltasten – ohne Installation.

### Während
- Navigieren mit `NEXT`/`PREV` (lokal mit den Haupttasten „Zurück“ und „Weiter“ unter der Folie im Referenten, dem Klicker oder den Pfeiltasten, per Handy oder Companion). Mit Schleife springt „Weiter“ auf der letzten Folie zur ersten. `GOTO` springt gezielt (lokal die Nummer ins Feld „Folie“ zwischen „Zurück“ und „Weiter“ tippen, dann Enter oder „Gehe zu“). Steht der Cursor in einem Textfeld, wirken die Tastenkürzel nicht; auf einer Auswahl (auch im Panel) und im Gast-Link blättert der Klicker weiter.
- `BLACK`/`WHITE` für Pausen/Umbau, `LIVE` holt die Folie zurück (lokal die Haupttasten „Schwarz“ links und „Weiß“ rechts unter der Folie oder B und W; ein zweiter Druck holt die Folie zurück, solange steht an der Taste „Schwarz · an“ bzw. „Weiß · an“).
- Referentenansicht im Blick behalten: Notizen + nächste Folie + Countdown (Timer-Leiste über „Nächste Folie“); das Publikum sieht nur die saubere Folie. ON AIR im Kopf leuchtet nur, solange das Publikum die Folie sieht, nicht bei Schwarz oder Weiß.
- Gast-Klicker: Die Anzeige **„Gast-Klick ●“** in der Leiste der Referentenansicht pausiert Gast-Klicks per Klick (**„Gast-Klick pausiert“**) und setzt sie fort. Der eigene Clicker und die Tastatur wirken immer.

### Nachbereitung
- `STOP` beendet die Präsentation (lokal „■ Beenden“ ganz rechts im Kopf des Referenten oder Esc außerhalb des Panels, im Editor „Beenden“ in der Werkzeugleiste; abhängig von Owner-Fragen P1 und P2); Projekt (.jmpres) mit „Speichern“ sichern, falls Overlays/Anpassungen erhalten bleiben sollen.

## Profi-Tipps
- Office vorab importieren und als **.jmpres** speichern — der LibreOffice-Wandlungsschritt passiert dann einmal in Ruhe, nicht unter Live-Druck.
- Notizen in der Quelldatei pflegen — sie erscheinen in der Referentenansicht und (optional) auf dem JM Stage Display als Confidence-Monitor.
- Handy-Clicker mit **PIN** betreiben, sonst kann jeder im WLAN weiterklicken. Dieselbe PIN braucht das Stage Display für den Folien-Feed.
- Gast-Klicker: Wer den Link hat, kann vor/zurück klicken. Ist Publikum im Zoom-Chat, den Link **privat** an den Gast schicken. Wurde ein Link weitergegeben, im Panel ⚙ › Gast-Klicker **„Neuer Link“** – der alte wirkt dann nicht mehr.
- `BLACK` auf einen Companion-Button — schneller sauberer „Vorhang" zwischen zwei Programmpunkten.
- Über eine **`.jmshow`** öffnet der Presenter sein `.jmpres` automatisch; das Stage Display zieht Referenten-Feed + PIN aus derselben Show.

## Pannenhilfe

| Risiko | Gegenmaßnahme |
| --- | --- |
| Office-Import schlägt fehl | LibreOffice installiert und auffindbar? Sonst als PDF exportieren und dieses importieren |
| „Port belegt“ bei der Fernbedienung | Den Fehler zeigen das Panel ⚙ › Handy-Fernsteuerung und die Statusleiste „Handy-Fernsteuerung“. Dort einen anderen Port eintragen (Standard 7330), mit „Setzen“ übernehmen und den Server wieder einschalten („Server aktiv“); „Setzen“ allein startet ihn nach dem Fehler nicht |
| Handy/Clicker meldet 401 | Falsche/fehlende PIN — PIN am Handy eingeben; dieselbe PIN im Stage Display |
| Kein Bild auf dem Beamer | Statusleiste „Publikum“ ansehen: Sie nennt den Bildschirm, auf dem das Publikumsfenster wirklich steht. Falscher Monitor: in der Leiste des Referenten den richtigen wählen und „Auf diesen Bildschirm“ drücken. Vollbild aktiv („Publikum Vollbild“ in der Leiste)? |
| Countdown bleibt leer | JM Timer läuft und ist auf 7777 erreichbar? Statusleiste „JM Timer“ ansehen; im Panel ⚙ › Gegenstellen „Aktiv“ an, Host und Port mit „Setzen“ übernommen? |
| Gast sieht „Presenter offline“ / Anzeige „Gast-Klick getrennt“ | Gast-Klicker im Panel ⚙ › Gast-Klicker eingeschaltet (Statusleiste „Gast-Klicker“)? Internet am Präsentationsrechner prüfen; der Presenter verbindet von selbst neu. Bis dahin weiter wie gewohnt selbst klicken |
| Gast sieht „This link is not active“ | Der Link ist veraltet (inzwischen „Neuer Link“ erzeugt), war noch nie verbunden oder 7 Tage unbenutzt – im Panel ⚙ › Gast-Klicker den aktuellen Link kopieren, dem Gast schicken, Gast lädt die Seite neu |
| Companion steuert nicht | Statusleiste „Fernsteuerung“ ansehen (bereit, Port belegt, Fehler); Port 8728 offen? `jm-presenter-ctl` (ctl=1) im mDNS? |

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
