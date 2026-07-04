---
id: tool-jm-stage-display
title: "JM Stage Display — Bühnen- & Crew-Monitor"
category: Tool-Manuals
difficulty: einfach
setupTimeMin: 10
teamSize: "1"
tags: [stage-display, buehne, crew-monitor, countdown, uhr, programm, referent, confidence, manual]
relatedTools: [jm-stage-display, jm-timer, jm-switcher, jm-presenter]
prerequisites:
  - JM Stage Display installiert (über den Launcher)
  - Quell-Tools laufen und sind erreichbar (JM Timer / Switcher / Presenter)
  - Zweiter Monitor als Bühnen-/Crew-Schirm
  - Bei sicherer Steuerebene die control.json provisioniert (für den Switcher)
equipmentOwner: jm
crewRoles:
  - Regie / Stage Manager
lastReviewed: 2026-07-04
owner: tech@jakobsmedien.com
summary: "Bühnen-/Crew-Schirm, der Timer-Countdown, Uhr, Switcher-Programm (REC/Stream), Referenten-Folie mit Notizen und Nachrichten aus den laufenden Tools zusammenführt und im Vollbild auf einen zweiten Monitor legt."
---

## Zutaten

### Voraussetzungen
- JM Stage Display installiert (über den Launcher)
- Die **Quell-Tools** laufen und sind erreichbar — je nach gewünschtem Inhalt: JM Timer, JM Switcher, JM Presenter
- Zweiter Monitor als Bühnen-/Crew-Schirm (Vollbild-Ausgabe)
- Netz-Erreichbarkeit im LAN (oder alles auf einem Rechner über `127.0.0.1`)
- Für einen **sicher** betriebenen Switcher: die geteilte `control.json` (Token/TLS) muss provisioniert sein

### Netzwerk & Ports
JM Stage Display ist ein reiner **Aggregator** — es hat keinen eigenen Steuerport und keine Handy-Fernbedienung. Es verbindet sich zu bis zu drei Quellen (Host/Port je Quelle einstellbar, Standard `127.0.0.1`):
- **JM Timer** — Port **7777** (socket.io): Countdown, aktiver/nächster Programmpunkt, Nachricht
- **JM Switcher** — Port **8723** (TCP-Zeilenprotokoll): Programm-Szene + REC/Stream-Status
- **JM Presenter** — Port **7330** (HTTP/SSE, optional **PIN**): aktuelle Folie, Notizen, nächster Titel

Nicht verbundene Quellen werden per mDNS automatisch mit Host/Port vorbefüllt (die PIN bleibt manuell).

## Schritt-für-Schritt

### Einrichtung
- Je Quelle den Schalter aktivieren und **Host/IP + Port** eintragen (oder die mDNS-Vorbefüllung übernehmen). Für den Presenter zusätzlich die **PIN** wie in dessen Fernsteuerung.
- Widgets ein-/ausblenden: Uhr, Timer/Countdown, Switcher-Status, Referent (Folie/Notizen), Nachricht.
- Die **Ausgabe** im Vollbild auf den Bühnen-/Crew-Monitor legen (Display wählen).
- Verbindungs-Badges prüfen: jede aktive Quelle sollte „verbunden" zeigen (sonst „getrennt").

### Während
- Der Schirm aktualisiert sich automatisch: Countdown mit Farbschwellen (normal/Warnung/Überzug), „Endet HH:MM", Programmpunkt, PGM + REC/ON-AIR, Referenten-Folie mit Notizen und „Up Next".
- Bei Bedarf eine **Ad-hoc-Nachricht** einblenden (hat Vorrang vor der Timer-Nachricht) — z. B. „Bitte zum Schluss kommen".
- Presenter-Feed wählbar: **Referent** (Folie + Notizen + nächste, Confidence-Monitor) oder **Vollbild-Folie**.

### Nachbereitung
- Ausgabe schließen; Quellen für die nächste Show ggf. anpassen.

## Profi-Tipps
- Alles auf einem Rechner? Dann tragen die Standardwerte `127.0.0.1` + die bekannten Ports schon; nur die Quellen aktivieren.
- Über eine **`.jmshow`** aktivieren sich die Quellen automatisch anhand der in der Show enthaltenen Tools — Host/Port kommen aus deren Netzwerk-Bindung, die Presenter-PIN aus den Show-Einstellungen. Kein manuelles Eintragen im Standardfall.
- Referentenansicht (Notizen + nächste Folie) als Confidence-Monitor für die Bühne — der/die Vortragende sieht Stichworte, das Publikum nicht.
- Bei getrennten Event-Netzen (mDNS blockiert) Host/Port je Quelle von Hand eintragen — Stage Display braucht dafür keine Discovery.
- Countdown-Farbschwellen als stille Regie: Warnfarbe = „bitte zum Punkt kommen", Überzug = „überziehst gerade".

## Pannenhilfe

| Risiko | Gegenmaßnahme |
| --- | --- |
| Quelle bleibt „getrennt" | Host/Port richtig? Tool läuft? Bei Firewall/getrenntem Netz Adresse von Hand eintragen |
| Switcher „getrennt" trotz Erreichbarkeit | Läuft der Switcher sicher (Token/TLS)? Dann muss die geteilte control.json auch hier provisioniert sein |
| „Folie nicht verfügbar" | Läuft eine Präsentation? Presenter-Fernsteuerung an? PIN korrekt? |
| Presenter-Feed friert ein | Kurzer Netz-Aussetzer — der Watchdog verbindet nach ~35 s neu; sonst Presenter prüfen |
| Kein Bild auf dem Bühnen-Monitor | Ausgabe geöffnet + richtiger Monitor (Vollbild)? |
| Countdown/Programmpunkt fehlt | JM Timer aktiviert und auf 7777 verbunden? |

## Checklisten

### Einrichtung
- [ ] Quellen aktiviert, Host/Port gesetzt (oder mDNS-Vorbefüllung)
- [ ] Presenter-PIN eingetragen (falls Presenter genutzt)
- [ ] Widgets ausgewählt (Uhr/Timer/Switcher/Referent/Nachricht)
- [ ] Ausgabe auf Bühnen-Monitor (Vollbild)
- [ ] Alle aktiven Quellen zeigen „verbunden"

### Vor Live
- [ ] Countdown + Programmpunkt kommen an
- [ ] Switcher PGM/REC sichtbar (falls genutzt)
- [ ] Referenten-Folie + Notizen erscheinen (falls genutzt)
- [ ] Ad-hoc-Nachricht getestet
