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
JM Stage Display ist ein reiner **Aggregator** — es hat keinen eigenen Steuerport und keine Handy-Fernbedienung. Es verbindet sich zu bis zu drei Quellen (Host/Port je Quelle im Panel ⚙ › Gegenstellen einstellbar, Standard `127.0.0.1`):
- **JM Timer** — Port **7777** (socket.io): Countdown, aktiver/nächster Programmpunkt, Nachricht
- **JM Switcher** — Port **8723** (TCP-Zeilenprotokoll): Programm-Szene + REC/Stream-Status
- **JM Presenter** — Port **7330** (HTTP/SSE, optional **PIN**): aktuelle Folie, Notizen, nächster Titel

Quellen, die noch auf der Vorgabe stehen (Host `127.0.0.1` oder leer), füllt die automatische Suche (mDNS) mit dem gefundenen Host und Port. Ein eingetragener oder einmal gefundener Host bleibt danach stehen: Die Suche ersetzt ihn nie mehr von selbst, auch nicht, wenn die Quelle ausfällt; dann zeigt sie „nicht erreichbar“ (die PIN bleibt manuell: Panel ⚙ › Presenter-Kopplung).

## Schritt-für-Schritt

### Einrichtung
- Im Panel ⚙ › Gegenstellen je Quelle den Schalter „Aktiv“ einschalten und **Host + Port** eintragen, dann mit „Setzen“ übernehmen (oder die mDNS-Vorbefüllung übernehmen). Für den Presenter zusätzlich die **PIN** im Panel ⚙ › Presenter-Kopplung wie in dessen Fernsteuerung eintragen und mit „Setzen“ übernehmen (der Abschnitt erscheint, sobald die Presenter-Quelle an ist). Die PIN steht verdeckt im Feld, „Anzeigen“ zeigt sie, „Verbergen“ deckt sie wieder zu; Tippen allein ändert nichts. In `stage-config.json` und in der Anfrage an den Presenter steht sie weiter im Klartext, weil das Protokoll des Presenters es so verlangt.
- Widgets mit den Schaltern „Anzeige-Elemente“ unter der Vorschau ein-/ausblenden: Uhr, Timer/Countdown, Switcher-Status, Referent (Folie/Notizen), Nachricht.
- Die **Ausgabe** im Vollbild auf den Bühnen-/Crew-Monitor legen: Bildschirm im Panel ⚙ › Ausgabe auf Bildschirm wählen, dann die Haupttaste „Vollbild-Ausgabe öffnen“ drücken (Statusleiste „Bühnenschirm“; ein offenes Fenster zieht mit „Auf diesen Bildschirm“ um).
- Statusleiste prüfen: jede aktive Quelle (Einträge „JM Timer“, „JM Switcher“, „JM Presenter“) sollte „verbunden“ zeigen (sonst „nicht gefunden“, bei eingetragenem Host „nicht erreichbar“; dieselbe Zeile steht im Panel ⚙ › Gegenstellen).

### Während
- Der Schirm aktualisiert sich automatisch: Countdown mit Farbschwellen (normal/Warnung/Überzug), „Endet HH:MM", Programmpunkt, PGM + REC/ON-AIR, Referenten-Folie mit Notizen und „Up Next".
- Bei Bedarf eine **Ad-hoc-Nachricht** im Feld „Nachricht“ direkt unter der Vorschau schreiben und mit „Senden“ oder Enter einblenden (hat Vorrang vor der Timer-Nachricht; die Statusleiste „Nachricht“ zeigt „auf dem Schirm“, sobald sie auf dem offenen Bühnenschirm steht) — z. B. „Bitte zum Schluss kommen". Das Tippen ist nur ein Entwurf: Auf die Bühne kommt der Text erst mit „Senden“, und „Senden“ mit leerem Feld nimmt die Nachricht wieder herunter. Nach einem Neustart steht keine Nachricht auf der Bühne, der letzte Text bleibt als Entwurf im Feld.
- Presenter-Feed im Panel ⚙ › Presenter-Kopplung wählbar (Umschalter „Anzeige“: „Referenzansicht“ bzw. „Hauptansicht“): **Referent** (Folie + Notizen + nächste, Confidence-Monitor) oder **Vollbild-Folie**.

### Nachbereitung
- Ausgabe mit der Haupttaste „Ausgabe schließen“ schließen; Quellen für die nächste Show ggf. im Panel ⚙ › Gegenstellen anpassen.

## Profi-Tipps
- Alles auf einem Rechner? Dann tragen die Standardwerte `127.0.0.1` + die bekannten Ports schon; nur die Quellen im Panel ⚙ › Gegenstellen aktivieren.
- Über eine **`.jmshow`** aktivieren sich die Quellen automatisch anhand der in der Show enthaltenen Tools — Host/Port kommen aus deren Netzwerk-Bindung, die Presenter-PIN aus den Show-Einstellungen. Kein manuelles Eintragen im Standardfall.
- Referentenansicht (Notizen + nächste Folie) als Confidence-Monitor für die Bühne — der/die Vortragende sieht Stichworte, das Publikum nicht.
- Bei getrennten Event-Netzen (mDNS blockiert) Host/Port je Quelle von Hand im Panel ⚙ › Gegenstellen eintragen und mit „Setzen“ übernehmen — Stage Display braucht dafür keine Discovery. Ein so eingetragener Host bleibt stehen; die Suche ersetzt ihn nicht, auch wenn im Netz ein anderer Rechner mit demselben Tool auftaucht.
- Countdown-Farbschwellen als stille Regie: Warnfarbe = „bitte zum Punkt kommen", Überzug = „überziehst gerade".

## Pannenhilfe

| Risiko | Gegenmaßnahme |
| --- | --- |
| Quelle bleibt „nicht gefunden“ oder „nicht erreichbar“ (Statusleiste, Panel ⚙ › Gegenstellen) | „nicht gefunden“: Die Quelle steht auf der Vorgabe (`127.0.0.1` oder leer), und nichts antwortet. „nicht erreichbar“: Ein eingetragener oder früher gefundener Host antwortet nicht; die Suche wechselt dann nicht von selbst auf einen anderen Rechner. Host/Port richtig? Tool läuft? Bei Firewall/getrenntem Netz Adresse von Hand im Panel ⚙ › Gegenstellen eintragen und mit „Setzen“ übernehmen. Soll die Suche den Host wieder füllen, ihn auf `127.0.0.1` setzen oder leeren |
| Switcher „nicht gefunden“ bzw. „nicht erreichbar“ trotz Erreichbarkeit | Läuft der Switcher sicher (Token/TLS)? Dann muss die geteilte control.json auch hier provisioniert sein |
| „Folie nicht verfügbar" | Läuft eine Präsentation? Presenter-Fernsteuerung an? PIN im Panel ⚙ › Presenter-Kopplung korrekt? |
| Presenter-Feed friert ein | Kurzer Netz-Aussetzer — der Watchdog verbindet nach ~35 s neu; sonst Presenter prüfen |
| Kein Bild auf dem Bühnen-Monitor | Statusleiste „Bühnenschirm“ ansehen (zu, Bildschirm fehlt, abgestürzt); Ausgabe mit der Haupttaste „Vollbild-Ausgabe öffnen“ geöffnet + richtiger Monitor (Vollbild) im Panel ⚙ › Ausgabe auf Bildschirm gewählt? Pille und „Steht auf“ im Abschnitt nennen den Bildschirm, auf dem der Schirm wirklich steht. Nach dem Wiederanstecken bleibt „Bildschirm fehlt“ stehen, bis „Auf diesen Bildschirm“ das Fenster verschiebt oder es neu geöffnet wird |
| Countdown/Programmpunkt fehlt | JM Timer aktiviert und auf 7777 verbunden (Statusleiste „JM Timer“)? |

## Checklisten

### Einrichtung
- [ ] Quellen aktiviert, Host/Port gesetzt (oder mDNS-Vorbefüllung; ein eingetragener Host bleibt stehen)
- [ ] Presenter-PIN eingetragen und mit „Setzen“ übernommen (falls Presenter genutzt)
- [ ] Widgets ausgewählt (Uhr/Timer/Switcher/Referent/Nachricht)
- [ ] Ausgabe auf Bühnen-Monitor (Vollbild)
- [ ] Alle aktiven Quellen zeigen in der Statusleiste „verbunden“

### Vor Live
- [ ] Countdown + Programmpunkt kommen an
- [ ] Switcher PGM/REC sichtbar (falls genutzt)
- [ ] Referenten-Folie + Notizen erscheinen (falls genutzt)
- [ ] Ad-hoc-Nachricht getestet (mit „Senden“ auf die Bühne, mit leerem „Senden“ wieder herunter)
