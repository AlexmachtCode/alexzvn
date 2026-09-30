# Abnahme Master-Link Teil 1 (Owner, zwei echte Windows-Rechner)

Spec: `docs/superpowers/specs/2026-09-30-master-link-teil1-design.md`, Abschnitt 12.
Rechner A = Master („Regie-PC“), Rechner B = zweiter Rechner. Beide mit Launcher 0.12.0 und Timer 0.12.0.

| # | Vorbedingung | Schritt | Erwartung | Ergebnis / Datum |
| --- | --- | --- | --- | --- |
| 1 | Regel „JM Production Suite“ erlaubt eingehend im aktuellen Netzprofil (`docs/suite-verbund.md`) | An A Verbund → Rolle Master | A zeigt „Master · noch keine Rechner“, **keine** Firewall-Abfrage | |
| 2 | 1 erledigt | An B Rolle „Mit Master verbinden“, A in der Liste wählen, An A „Rechner koppeln“, Code an B tippen | B zeigt „Regie-PC ●“, A zeigt „Master · 1/1 Rechner online“ (grün) | |
| 3 | 2 erledigt | Launcher auf B beenden, **Timer auf B allein starten** | Timer erscheint an A unter B | |
| 4 | 2 erledigt | Timer auf A starten | erscheint unter „dieser Rechner“ | |
| 5a | 3 erledigt | Netzkabel an B ziehen | A zeigt B nach höchstens 25 s offline | |
| 5b | 5a | Kabel wieder einstecken | B kommt ohne Zutun zurück | |
| 5c | 4 erledigt | Netzkabel an A ziehen, einmal mit „Automatisch“, einmal mit gewählter Karte | Timer auf A bleibt verbunden (Loopback) | |
| 6 | 3 und 4 | A neu starten | alle kommen ohne Zutun zurück | |
| 7 | B verbunden | B an A **entfernen**, während B verbunden ist | B zeigt sofort „Vom Master entfernt: neu koppeln“ und versucht es nicht weiter | |
| 8a | B neu gekoppelt | An A Master-Modus **aus** (Launcher läuft) | B zeigt „Regie-PC nicht erreichbar“ — **nicht** „Firewall?“ | |
| 8b | Master-Modus an | An A eingehende **Blockregel nur für TCP 8738** anlegen (Portregel) | B zeigt „Regie-PC sichtbar, Port gesperrt: Firewall?“; Regel danach löschen | |
| 9 | Kopplungsfenster an A offen | An B fünfmal einen falschen Code | „noch n Versuche“ zählt herunter, danach ist der Code ungültig | |
| 10 | Netz ohne Internet-Gateway (Profil „Öffentlich“) | Koppeln und verbinden | klappt, sobald die Regel „Öffentlich“ erlaubt; ohne diese zeigt B den Firewall-Hinweis | |
| 11 | falls vorhanden: Rechner mit Hyper-V- oder zweiter Karte | koppeln; feste Adresse über eine VLAN-Grenze | richtige Adresse wird gewählt; feste Adresse funktioniert | |
| 12 | alles erledigt | An A Master-Modus aus, **ein Rechner allein** | Show-Start, RELOAD und Anzeigen wie vorher | |

**macOS:** Die Regel `bind: '0.0.0.0'` für mDNS stammt aus dem Code von multicast-dns und ist nicht abgenommen. Ein Mac-Test folgt, sobald ein Mac im Aufbau steht.
