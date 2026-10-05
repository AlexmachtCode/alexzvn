# Abnahme Master-Link Teil 2b, Release 1 (Owner, ein Rechner, echtes iveo-Event auf Prod)

Spec: `docs/superpowers/specs/2026-10-02-master-link-teil2b-design.md`, Abschnitt 10.

**Voraussetzungen:**
- Die noch offene 2a-Abnahme (`apps/rundown/ABNAHME-2a.md`) läuft im selben Termin, vor den Schritten dieser Tabelle. Release 1 wartet nicht auf sie.
- In iveo wird nichts geschrieben.
- Schritt 12 nur mit einem unveröffentlichten Test-Speaker.

| # | Schritt | Erwartung | Ergebnis / Datum |
| --- | --- | --- | --- |
| 1 | Launcher 0.14.0, Titler 0.10.0, Rundown 0.7.0 installieren | Versionen im Launcher sichtbar | |
| 2 | Im Titler eine Vorlage mit `{{name}}` und `{{funktion}}` wählen. Eine Bestands-Show mit iveo öffnen (vor dem Update gespeichert, ihre Speaker haben noch keine Kennung). Einen Speaker abrufen, TAKE. Dann im Panel die Tagesübersicht wählen; das schreibt die Kennungen nach (5.3). | Daten / Recall zeigt „Quelle: Show „⟨Show⟩“ · ⟨n⟩ Speaker“. Dieselbe Person bleibt auf Sendung, **kein** Hinweis „nicht mehr in der Liste“ (Brücke, 7.3). Log: „… hält seinen Eintrag, Schlüssel wechselt …“ | |
| 3 | Ein Side Event suchen, mit dem iveo Speaker verknüpft (beim Umschalten kommt **keine** Meldung „verknüpft keine Speaker“). Zurück auf die Tagesübersicht, einen Speaker abrufen, der dort **nicht** verknüpft ist. TAKE. | Bauchbinde zeigt ihn | |
| 4 | Im Panel auf dieses Side Event umschalten | Dieselbe Person bleibt auf Sendung, Hinweis „… ist nicht mehr in der Liste. Die Bauchbinde bleibt stehen …“ | |
| 5 | Ausblenden | Nach etwa 1 s Hinweis „… Bitte einen Eintrag abrufen.“ | |
| 6 | Zurück auf die Tagesübersicht, einen Speaker abrufen, TAKE, dann auf ein Side Event umschalten, das ihn verknüpft | Dieselbe Person bleibt, ohne Hinweis | |
| 7 | Im Rundown an eine Zeile „Titler · Eintrag abrufen“ hängen, im Picker einen Speaker wählen, GO | Die richtige Person wird abgerufen. Chip zeigt den Namen. | |
| 8 | Titler schließen und über die **Kachel** neu starten | Liste und Quelle wie vorher. Die nächste Umschaltung im Panel kommt an. | |
| 9 | Im Titler einen eigenen DataLink-Ordner mit einer CSV wählen | Quelle „eigener Ordner“. Die Show-Liste ist weg. | |
| 10 | Show erneut öffnen, dann „Zurück zum eigenen Ordner“ | erst Quelle Show, dann wieder der eigene Ordner mit der CSV | |
| 11 | Companion: `TITLER RECALL 2` und Weiter | wie bisher über die Nummer | |
| 11b | Companion: `TITLER RECALL Niemand` (ein Name, den die Liste nicht hat), ohne Sendung, dann TAKE | Hinweis „Abruf „Niemand“: nicht in der Liste …“; die Bauchbinde zeigt **nicht** den vorher aktiven Speaker | |
| 12 (optional) | Nur mit einem unveröffentlichten Test-Speaker und im **Listen-Modus** (Tagesübersicht): dessen Funktion in iveo ändern, während er auf Sendung ist, auf die nächste Programmänderung warten. Im Agenda-Modus kommen Speaker-Änderungen nie an (2.3, Nr. 5). | Funktion auf Sendung wechselt, Name bleibt. Zeigt der Titler stattdessen „… ist nicht mehr in der Liste“, hat iveo die ID beim Bearbeiten gewechselt (M1 b). | |

**Hinweis zu Schritt 2 (Entscheidung des Owners vom 05.10.2026, Zweig B):** Die iveo-Kennung wird noch nicht in Show, Titler und Rundown übernommen; der Titler hält seinen Speaker über Datei und Namen (Ersatz-Schlüssel). Schritt 2 erwartet deshalb in Zweig B keine Logzeile zum Schlüsselwechsel („… hält seinen Eintrag, Schlüssel wechselt …“) und bewertet nur: dieselbe Person bleibt auf Sendung, kein Hinweis „nicht mehr in der Liste“.

**Hinweis zu Schritt 12 (Zweig B):** Die iveo-ID spielt in Zweig B keine Rolle, die Deutung „hat iveo die ID beim Bearbeiten gewechselt (M1 b)“ entfällt. Zeigt der Titler „… ist nicht mehr in der Liste“, hat sich der Name des Test-Speakers geändert, so wie die Show ihn schreibt, oder es gibt in der Liste einen zweiten Speaker gleichen Namens; dann hält der Titler bewusst nicht (Spec 5.4, 23). Sonst ist es ein Befund.
