# Abnahme Master-Link Teil 2a (Owner, ein Rechner, echtes iveo-Event auf Prod)

Spec: `docs/superpowers/specs/2026-10-01-master-link-teil2a-design.md`, Abschnitt 10.

**Voraussetzungen:**
- Ein eigenes, **unveröffentlichtes Test-Side-Event** im Prod-Event mit mindestens drei Agenda-Punkten. Die Schritte 5, 6 und 8 ändern dessen Agenda. Am Ende wird der Ausgangszustand wiederhergestellt.
- Das echte iveo-Token wird **nie** in iveo widerrufen. Es gilt org-weit, ein Widerruf legt alle Events und Rechner der Org lahm.

| # | Schritt | Erwartung | Ergebnis / Datum |
| --- | --- | --- | --- |
| 1 | Launcher 0.13.0, Timer 0.13.0 und Rundown 0.6.0 installieren | Versionen im Launcher sichtbar | |
| 2 | Bestands-Show (von vor dem Update, mit Aktionen im Rundown) öffnen und die erste Abfrage abwarten | alle Aktionen da, kein Hinweis „entfallen“ (Übergang über Titel-Brücke und Übernahme des alten Autosaves: Spec-Ergänzungen 0.6/0.7, keine Versionsnummern) | |
| 3 | Show an das Test-Side-Event binden und öffnen | Rundown zeigt die Punkte, gesperrte Felder mit „kommt aus iveo“ | |
| 4 | An Punkt 2 eine Bauchbinde und „Timer springe zu Punkt 2“ anlegen; eine eigene Zeile hinter Punkt 1; eine Zeile duplizieren | gespeichert; die Kopie ist frei bearbeitbar | |
| 5 | In iveo vor Punkt 2 einen Punkt einfügen und Punkt 3 umbenennen; bis zu 45 s warten | Hinweis „iveo: 1 geändert · 1 neu …“; Aktionen weiter an „Punkt 2“; eigene Zeile und Kopie an ihrem Platz; scharfe Zeile unverändert | |
| 6 | Timer auf Punkt 2 laufen lassen, Schritt 5 sinngemäß wiederholen (noch ein Punkt davor) | Timer bleibt auf demselben Punkt, Countdown läuft weiter | |
| 7 | GO mit der Sprung-Aktion | Timer springt auf den richtigen Punkt, nicht auf die alte Nummer; Chip zeigt die neue Nummer | |
| 8 | In iveo den Punkt mit Aktionen löschen | Zeile „in iveo entfallen“, Weiterschalten überspringt sie | |
| 9 | Aus dem Rundown per GO auf ein anderes Side Event umschalten, dann zurück; im Panel die Tagesübersicht eines anderen Tages wählen und zurück | neue Agenda ohne Aktionen; nach dem Zurückschalten alle Aktionen wieder da; kein „entfallen“ durch den Tageswechsel | |
| 10a | Rundown schließen und **über die Launcher-Kachel** neu starten | Stand und scharfe Zeile wie vorher; die nächste iveo-Änderung kommt an; Timer-Countdown unverändert | |
| 10b | Rundown schließen und über „Show öffnen“ neu starten | Stand und scharfe Zeile wie vorher. Hinweis: Der Timer wird dabei wie heute zurückgesetzt. | |
| 11 | Show im Show-Editor öffnen und ohne Änderung speichern | Timer-Liste, Einstellungen, Dauern sekundengenau und Kennungen unverändert (Datei vorher/nachher vergleichen); die Tools bekommen RELOAD, nichts springt | |
| 12 | Launcher beenden und mit `JMPS_IVEO_TOKEN=ungueltig` starten, Show öffnen, eine Abfrage abwarten; danach ohne die Variable neu starten | Zeile „iveo-Abgleich gestört: Token ungültig oder widerrufen“, Rundown behält seinen Stand; nach dem Neustart verschwindet die Zeile mit der ersten Abfrage | |
| 13 | Agenda des Test-Side-Events auf den Ausgangszustand zurücksetzen | – | |
