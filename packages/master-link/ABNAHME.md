# Abnahme Master-Link Teil 1 (Owner, zwei echte Windows-Rechner)

Spec: `docs/superpowers/specs/2026-09-30-master-link-teil1-design.md`, Abschnitt 12.
Rechner A = Master („Regie-PC“), Rechner B = zweiter Rechner. Beide mit Launcher 0.12.0 und Timer 0.12.0.

| # | Vorbedingung | Schritt | Erwartung | Ergebnis / Datum |
| --- | --- | --- | --- | --- |
| 1 | Regel „JM Production Suite“ erlaubt eingehend im aktuellen Netzprofil (`docs/suite-verbund.md`) | An A Verbund → Rolle Master | A zeigt „Master · noch keine Rechner“, **keine** Firewall-Abfrage | ✅ wie beschrieben, 02.10.2026 |
| 2 | 1 erledigt | An B Rolle „Mit Master verbinden“, A in der Liste wählen, An A „Rechner koppeln“, Code an B tippen | B zeigt „Regie-PC ●“, A zeigt „Master · 1/1 Rechner online“ (grün) | ✅ wie beschrieben, 02.10.2026 |
| 3 | 2 erledigt | Launcher auf B beenden, **Timer auf B allein starten** | Timer erscheint an A unter B | ✅ wie beschrieben, 02.10.2026 |
| 4 | 2 erledigt | Timer auf A starten | erscheint unter „dieser Rechner“ | ✅ wie beschrieben, 02.10.2026 |
| 5a | 3 erledigt | Netzkabel an B ziehen | A zeigt B nach höchstens 25 s offline | ✅ wie beschrieben, 02.10.2026 |
| 5b | 5a | Kabel wieder einstecken | B kommt ohne Zutun zurück | ✅ wie beschrieben, 02.10.2026 |
| 5c | 4 erledigt | Netzkabel an A ziehen, einmal mit „Automatisch“, einmal mit gewählter Karte | Timer auf A bleibt verbunden (Loopback) | ✅ wie beschrieben, 02.10.2026 |
| 6 | 3 und 4 | A neu starten | alle kommen ohne Zutun zurück | ✅ wie beschrieben, 02.10.2026 |
| 7 | B verbunden | B an A **entfernen**, während B verbunden ist | B zeigt sofort „Vom Master entfernt: neu koppeln“ und versucht es nicht weiter | ✅ wie beschrieben, 02.10.2026 |
| 8a | B neu gekoppelt | An A Master-Modus **aus** (Launcher läuft) | B zeigt „Regie-PC nicht erreichbar“ — **nicht** „Firewall?“ | ✅ wie beschrieben, 02.10.2026 |
| 8b | Master-Modus an | An A eingehende **Blockregel nur für TCP 8738** anlegen (Portregel) | B zeigt „Regie-PC sichtbar, Port gesperrt: Firewall?“; Regel danach löschen | ✅ wie beschrieben, 02.10.2026 |
| 9 | Kopplungsfenster an A offen | An B fünfmal einen falschen Code | „noch n Versuche“ zählt herunter, danach ist der Code ungültig | ✅ wie beschrieben, 02.10.2026 |
| 10 | Netz ohne Internet-Gateway (Profil „Öffentlich“) | Koppeln und verbinden | klappt, sobald die Regel „Öffentlich“ erlaubt; ohne diese zeigt B den Firewall-Hinweis | ✅ wie beschrieben, 02.10.2026 |
| 11 | falls vorhanden: Rechner mit Hyper-V- oder zweiter Karte | koppeln; feste Adresse über eine VLAN-Grenze | richtige Adresse wird gewählt; feste Adresse funktioniert | optional, nicht einzeln bestätigt |
| 12 | alles erledigt | An A Master-Modus aus, **ein Rechner allein** | Show-Start, RELOAD und Anzeigen wie vorher | ✅ wie beschrieben, 02.10.2026 |
| 13 | B gekoppelt, **Launcher auf B läuft**, auf B laufen Timer 0.12.0 und ein noch nicht aktualisiertes Tool | Verbund-Modal auf B öffnen (danach dasselbe an A) | unter „Tools dieses Rechners“: Timer „mit Master verbunden“, das alte Tool „läuft, noch ohne Verbund (Update nötig)“; an A dieselbe Liste für A | ✅ wie beschrieben, 02.10.2026 |
| 14 | B verbunden | An A „Name des Masters“ ändern (z. B. „Regie-PC Saal 2“), dann Launcher auf A neu starten | B verbindet neu, Kopf auf B zeigt „Regie-PC Saal 2 ●“; in B's `master-link.json` steht der neue Name | ✅ wie beschrieben, 02.10.2026 |
| 15 | B gekoppelt; ein weiterer Rechner C (falls vorhanden) | B's `master-link.json` nach C kopieren (`%APPDATA%\JM Production Suite\`), Launcher auf C starten | einer von beiden zeigt „Kennung doppelt: neu koppeln“; dort Verbund → „Neue Kennung“ → bestätigen, mit neuem Code koppeln → B und C verbunden, an A zwei Einträge | optional, nicht einzeln bestätigt |

**Ergebnis 02.10.2026:** Owner-Rückmeldung „lief wie beschrieben“ (Gesamtaussage, keine Einzelwerte). Die Schritte 11 und 15
setzen Zusatzgeräte voraus („falls vorhanden“) und sind deshalb nicht einzeln als gelaufen vermerkt.

**macOS:** Die Regel `bind: '0.0.0.0'` für mDNS stammt aus dem Code von multicast-dns und ist nicht abgenommen. Ein Mac-Test folgt, sobald ein Mac im Aufbau steht.
