# Abnahme iveo-Paket (Owner; Rechner A Windows, Rechner B gekoppelt, ein Mac)

Spec: `docs/superpowers/specs/2026-10-16-iveo-paket-design.md`, Abschnitt 13. Plan:
`docs/superpowers/plans/2026-10-17-iveo-paket.md`. Rechner A ist der Rechner mit dem iveo-Token (Einzelplatz oder Master),
Rechner B gekoppelt wie in Teil 1 (`packages/master-link/ABNAHME.md`).

**Voraussetzungen:**
- Die Releases sind draußen (Spec 14.1, die Abnahme ist Nr. 9): Rechner A (Windows) hat Launcher 0.16.0 und Titler 0.12.1,
  über den Launcher installiert; der Mac hat Launcher 0.16.0 (Paket `JM.Production.Suite-0.16.0-mac-arm64.dmg` bzw.
  `JM.Production.Suite-0.16.0-mac-x64.dmg` vom Release `launcher-v0.16.0`).
- Für Schritt 14 Rechner B mit der Rolle „Mit Master verbinden“, gekoppelt mit A, mit **Titler 0.12.1** (ein älterer Titler
  verwirft das Feld der Organisationen).
- Für Schritt 15 hängen am Release `connect-v0.3.0` die zwei Mac-Pakete aus dem Nachlauf des Workflows `connect-mac.yml`
  (`JM.Connect-0.3.0-mac-arm64.dmg`, `JM.Connect-0.3.0-mac-x64.dmg`). Für Schritt 19 ist der Release-Proxy nach dem
  Trockenlauf neu bereitgestellt (sonst gilt dort nur der Weg über die GitHub-Quelle).
- In iveo (COP31) gibt es ein **unveröffentlichtes Test-Side-Event** mit Anhängen (mindestens eine Datei und ein Link) und
  einen **unveröffentlichten Test-Speaker** mit mehreren Organisationen (Annahme; sonst legt der Owner sie an). Geschrieben
  wird in iveo nur dort. Fehlen sie, gelten die Schritte 6, 7, 9, 10, 12 und 13 als „entfällt“; den Nachweis tragen dann
  die Selbsttests (Spec 12.3, 12.4).
- Auf A liegt eine bestehende COP31-Show mit iveo-Bindung; das Token für COP31 liegt auf A.
- In „Ergebnis“ steht „bestanden“, „Befund: …“ oder „entfällt (Grund)“; dazu Datum und Name.

| # | Schritt | Erwartung | Ergebnis | Datum | Name |
| --- | --- | --- | --- | --- | --- |
| 1 | Versionen im Launcher ansehen | Launcher 0.16.0, Titler 0.12.1 | | | |
| 2 | Einstellungen öffnen; im Ergebnis notieren, ob eine Adresse eingetragen ist und welche | Feld „iveo Basis-URL (optional)“ zeigt die eingetragene Adresse oder ist leer mit dem Platzhalter „https://app.my-iveo.de/api/v1“; darunter „Standard für neue Bindungen und Shows ohne Adresse: ‹URL›“ mit der Adresse, die neue Bindungen bekommen. Speichern ohne Änderung, erneut öffnen → gleiche Anzeige. | | | |
| 3 | Show-Editor: neue Show, Basis-URL leer, „Events laden“, COP31 binden, speichern; die Show danach im Editor wieder öffnen | Events kommen von der Adresse aus Schritt 2 (ohne Eintrag: Production). Der Platzhalter des Felds nennt sie: „Basis-URL (leer = ‹Standardadresse dieses Rechners›)“, ohne Eintrag „Basis-URL (leer = https://app.my-iveo.de/api/v1)“. Meldung „„‹Event›“ übernommen — ‹p› Programmpunkte (Filter: ‹Filter›), ‹s› Speaker (Titler), davon ‹o› mit Organisation.“ mit ‹o› > 0. Die gespeicherte Show trägt `iveo.baseUrl` = diese Adresse; beim Wiederöffnen zeigt das Feld genau sie. | | | |
| 4 | Bestehende COP31-Show öffnen; im Timer einen Punkt laufen lassen und im Rundown eine Zeile scharf stellen; Launcher-Log beobachten | spätestens 5 min nach dem Öffnen genau eine Zeile „… die Speakerliste weicht von der Datei ab → Show neu geschrieben …“; Timer bleibt auf seinem Punkt, die scharfe Rundown-Zeile bleibt; danach etwa alle 4,5 min „iveo: Speakerliste aufgefrischt, unverändert (‹n› Speaker).“ | | | |
| 5 | Titler: Vorlage mit `{{name}}`, `{{organisation}}`, Untertitel `{{organisationen}}`; einen Speaker mit mehreren Organisationen abrufen, „Take“ (Live-Bereich der Oberfläche aus 0.12.0) | Hauptorganisation bzw. alle mit „ · “; ein Speaker ohne Organisation zeigt leere Felder; eine bestehende Vorlage ohne die Variablen sieht aus wie vorher | | | |
| 6 | Test-Speaker: Organisation oder Funktion in iveo ändern; Uhrzeit notieren | Änderung in der Bauchbinde spätestens 5 min später, ohne Programmänderung; im Listen-Modus und (Schritt 7) im Agenda-Modus | | | |
| 7 | Auf ein Side Event mit verknüpften Speakern umschalten, Schritt 6 wiederholen | wie Schritt 6 | | | |
| 8 | Side-Events-Panel, 📎 am Test-Side-Event aufklappen; dann das Panel schließen und wieder öffnen | Liste mit „Stand ‹hh:mm›“, die Zeit rückt bei unveränderter Liste etwa alle 45 s vor; nach dem Wiederöffnen sind alle Listen zugeklappt (kein hängendes „Lade Anhänge…“), und am aktiven Side Event steht „📎 ‹n›“ | | | |
| 9 | In iveo einen Anhang hinzufügen, Liste offen lassen | Liste zeigt ihn spätestens 45 s später, ohne Neuladen | | | |
| 10 | In iveo den Anhang löschen | verschwindet aus der Liste spätestens 45 s später; „Herunterladen“ eines vorher sichtbaren gelöschten Anhangs → Meldung „Anhang wurde in iveo gelöscht.“ | | | |
| 11 | Ordner: neben der Show „‹Show› – Side Events“ öffnen (Knopf „Ordner öffnen“ im Panel) | Unterordner je Side Event der Ablage-Menge mit Anhängen; Dateien vollständig; Links als `.url` öffnen den Browser; Kopfzeile „Ablage: „‹Name›“ · nächster Abgleich gegen ‹hh:mm›“; Zeile „Anhänge: ‹n› im Ordner · Stand ‹hh:mm›“; im Basisordner `.jm-ablage-sperre.json` mit dem Rechnernamen von A (Hinweis zu 11 und 20) | | | |
| 12 | Im Test-Side-Event: Anhang umbenennen, Datei ersetzen, Anhang entfernen; dabei M4 messen (Spec 12.11) | umbenannt; alte Fassung in `entfernt/… (ersetzt …)`; entfernter Anhang in `entfernt/`; nichts gelöscht; M4-Ergebnis in der Tabelle „M4“ unten | | | |
| 13 | Eine Datei im Ordner in PowerPoint öffnen, in iveo ersetzen | Zeile „… neue Fassung wartet, Datei ist geöffnet“; nach dem Schließen spätestens in der nächsten Runde getauscht | | | |
| 14 | Rechner B (Rolle „Mit Master verbinden“, gekoppelt, Titler 0.12.1): eine Kopie derselben Show öffnen, Side-Events-Panel ansehen; im Titler auf B eine Bauchbinde mit `{{organisation}}` abrufen | Kopfzeile „Dieser Rechner hat die Rolle „Mit Master verbinden“ und legt keine Anhänge ab.“; neben der Kopie entsteht kein Ordner; am Master läuft die Ablage weiter; die Bauchbinde auf B zeigt dieselbe Organisation wie auf A | | | |
| 15 | Mac: Launcher 0.16.0, Connect installieren und starten; eine Gast-Einladung öffnen; zwei Gäste und Talkback probieren | Installation ohne Fehler; Connect startet; Verhalten nach OF1 (Vorgabe A, vom Owner am 17.10.2026 bestätigt): Gast kommt in den Raum, keine NDI-Quelle, kein Programmbild und kein Programm-Ton beim Gast, keine Zoom-Karte; Gäste hören einander und die Regie (sonst streicht ein Katalog-Commit auf `main` den letzten Halbsatz der Connect-Beschreibung, Hinweis zu 15); eine `.url` aus Schritt 11 öffnet sich auf dem Mac im Browser | | | |
| 16 | Schalter „Anhänge in Side-Event-Ordnern ablegen“ aus (OF8, Vorgabe vom Owner bestätigt) | Kopfzeile „Ablage in Side-Event-Ordnern ausgeschaltet.“; keine Downloads mehr; Ordner unverändert; Sperrdatei weg. Wieder an → nächste Runde im nächsten Takt | | | |
| 17 (optional) | Eine Show mit eingetragener Staging-Adresse öffnen | fragt weiter Staging ab | | | |
| 18 | Auf Rechner A die offene Show-Datei im Explorer umbenennen, eine Runde abwarten, dann zurückbenennen | Kopfzeile „Show-Datei am Öffnungspfad nicht gefunden oder nicht lesbar. Ablage pausiert, bis sie wieder da ist.“, keine Downloads; nach dem Zurückbenennen läuft die Ablage im nächsten Takt weiter | | | |
| 19 | Mac: ein Tool installieren, dessen Releases laut Trockenlauf (Spec 10.7) kein passendes Paket für diesen Mac haben (gibt es keins, „entfällt“) | über den Proxy „Release-Abfrage fehlgeschlagen: Proxy 404: kein Release von ‹app› mit einem Paket für macOS (‹arch›)“, über die GitHub-Quelle „Kein Release mit einem Paket für diesen Rechner gefunden (macOS, Launcher-Architektur ‹arch›).“; kein Download | | | |
| 20 | Rechner A, Show mit laufender Ablage: (a) den Launcher im Task-Manager beenden (Absturz nachstellen), neu starten, dieselbe Show öffnen; (b) den Launcher normal beenden und in den Basisordner sehen; (c) im Panel einen Anhang mit ausführbarer Endung (falls im Test-Side-Event vorhanden) speichern | (a) weder „Ablage liegt bei Rechner „‹Name›“ …“ noch „Ablage von einem zweiten Launcher mit demselben Rechnernamen „‹Name›“ übernommen …“; nach „Ablage: „‹Name›“ · erster Abgleich folgt“ läuft die Ablage im ersten Takt weiter, keine `.jm-laden`-Reste des alten Prozesses; (b) `.jm-ablage-sperre.json` ist weg (sonst im Ergebnis notieren: Annahme aus Spec 9.2 widerlegt, ein zweiter Rechner wartet dann bis zu 15 min); (c) Vorschlag mit „_‹ext›“, Meldung „Gespeichert, nicht automatisch geöffnet (Endung „‹ext›“ gesperrt): ‹Dateiname›“, die Datei öffnet sich nicht | | | |

**M4 (Schritt 12, Spec 12.11):** Der Controller stellt wie bei M1 und M5 ein nur lesendes Prüfskript mit dem Owner-Token
bereit (nicht im Repo). Es ruft die Agenda des Test-Side-Events vor und nach dem Ersetzen der Datei ab und gibt je Feld nur
„geändert ja/nein“ aus, nie einen Wert. Ändert sich etwas außer der Größe, kommt es in die Inhaltssignatur (Folgepunkt
FP11); bis dahin gilt Risiko 3 der Spec.

| Feld | geändert ja/nein |
| --- | --- |
| `materials[].id` | |
| Form von `asset.url` | |
| `size_bytes` | |
| `updated_at` des Agenda-Punkts | |

**Hinweis zu 4 und 6 (Zeiten):** „spätestens 5 min“ gilt bei regelmäßigem Takt (alle 45 s); eine lange iveo-Abfrage
verschiebt den nächsten Takt. Die Zeile „… Show neu geschrieben …“ in Schritt 4 kommt nur, wenn die Speaker in iveo
Organisationen haben und die Show sie noch nicht trägt.

**Hinweis zu 11 und 20 (Rechnername):** Die Sperrdatei nennt den Windows-Rechnernamen (`os.hostname()`), nicht den Namen,
unter dem A im Verbund geführt wird; beide können verschieden sein. Die Kopfzeilen auf anderen Rechnern nennen den Namen aus
der Sperrdatei.

**Hinweis zu 15 (Katalog und Gatekeeper):** Der letzte Halbsatz der Connect-Beschreibung („einander und die Regie per
Talkback hören sie weiter“) ist bis zu diesem Schritt eine Annahme. Hören die Gäste einander oder die Regie auf dem Mac
nicht, streicht ein Katalog-Commit auf `main` den Halbsatz; der Proxy liefert den Katalog live, ohne Release. Das Mac-Paket
ist unsigniert wie alle Mac-Pakete aus der CI; blockt macOS den ersten Start, gilt der Gatekeeper-Hinweis aus
`docs/mac-build-windows-only-apps.md`, und das ist nur dann ein Befund, wenn andere CI-Mac-Pakete sich anders verhalten.

**Hinweis zu 19 (welches Tool):** Die Zeilen des Trockenlaufs (Zusatzprüfung 4) mit „neu: 404 kein Release von ‹app› mit
einem Paket für macOS (‹arch›)“ nennen die Kandidaten; der Mac der Abnahme hat seine eigene Architektur (arm64 oder x64).

## Zusatzprüfungen (nicht in Spec 13)

Diese Punkte prüfen, was weder ein Selbsttest noch die Tabelle erreicht: das echte Dateisystem des Macs, den
bereitgestellten Proxy und die Pakete am Release. Ergebnis, Datum und Name hinter jedem Punkt eintragen.

1. **Echtes Dateisystem auf macOS (Spec 12.4, Owner-Frage OFP3):** Auf dem Mac der Abnahme mit Node 22 oder neuer und
   einem Checkout des Merge-Commits im Repo-Ordner `npm ci --ignore-scripts`, dann in `apps/launcher`
   `npx tsx test/side-event-ordner-echt.test.ts`. Erwartet: die letzte Zeile `‹n› ok, 0 fehlgeschlagen.` mit derselben Zahl
   wie unter Windows und Exit 0. Ohne Node auf dem Mac „entfällt“; dann tragen der Windows-Lauf und der Linux-Lauf der CI
   den Nachweis, und APFS bleibt eine Annahme (Spec 9.6). Ergebnis / Datum / Name:
2. **Gegenprobe nach dem Proxy-Deploy (Spec 10.7):** Ohne Mac, mit dem Proxy-Key (nicht ins Ergebnis schreiben):
   `GET /tools/jm-connect/latest?platform=mac&arch=arm64` liefert `version` `0.3.0` und `fileName`
   `JM.Connect-0.3.0-mac-arm64.dmg`; `…&arch=x64` liefert `JM.Connect-0.3.0-mac-x64.dmg`; ein Windows-Tool (etwa
   `GET /tools/jm-timer/latest?platform=win`) liefert dieselbe Version wie im Trockenlauf vor dem Deploy. Ergebnis / Datum / Name:
3. **Artefaktnamen und Notes am Release (Spec 14.1 Nr. 8):** Am Release `launcher-v0.16.0` heißen die Pakete
   `JM.Production.Suite-0.16.0-mac-arm64.dmg`, `JM.Production.Suite-0.16.0-mac-x64.dmg` und
   `JM.Production.Suite-0.16.0-win-x64.exe` (Punkte statt Leerzeichen); am Release `titler-v0.12.1`
   `JM.Titler-0.12.1-win-x64.exe`. Der Launcher zeigt an beiden Updates die Notes aus Spec 14.2, und der Katalog nennt Titler
   0.12.1. Ergebnis / Datum / Name:
4. **Trockenlauf beim Owner (Spec 10.7):** Vor dem Deploy lief `node services/release-proxy/tools/trockenlauf.mjs`; jede Zeile
   mit „≠“ lag mit Begründung beim Owner, bevor er den Deploy freigab. Die Zahl der Zeilen mit Unterschied hier eintragen.
   Ergebnis / Datum / Name:
