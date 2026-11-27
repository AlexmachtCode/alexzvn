# Altfehler Runde 1, Stufe 2: Texte zur Freigabe durch den Owner

Zweck: Alle neuen sichtbaren Texte und Log-Zeilen der Stufe 2 (die 19 Befunde der Spec und die vier Zusätze des Nachtrags in Player, Interpreter, Stage Display, Caption, Recorder, Presenter mit Companion-Modul und Connect) zur Freigabe durch den Owner. Dazu der Entwurf der Release-Notizen, die Änderungen in der Bedienung, die Entscheidungen, die Spec und Code offen ließen, die offenen Fragen und Hinweise.

Stand: Branch `feat/altfehler-stufe2`, Code-Stand `3a7184fe61` (Tasks 1 bis 9 fertig und geprüft). Die Versionen sind Player 0.10.1, Interpreter 0.3.1, Stage Display 0.8.0, Caption 0.7.0, Recorder 0.11.0, Presenter 0.15.1 und Connect 0.6.1, dazu das Companion-Modul 0.4.0. Das Datum der Changelog-Einträge (26.11.2026) ist ein Platzhalter; es wird auf den Tag der Veröffentlichung gesetzt.

Lesehilfe: ‹…› steht für den Teil, der sich zur Laufzeit ändert (eine Zahl, ein Name, ein Befehl oder ein Pfad). Beispiel: „Companion „‹…›“ abgelehnt: ‹…›“ erscheint als „Companion „ARM“ abgelehnt: Erst die Aufnahme stoppen.“ Die Nummer (z. B. REA3) nennst Du bitte bei jeder Änderung, die Du wünschst. Die Spalte „Ort“ nennt die Datei mit Zeile, in der der Text steht. Die Spalte „Befund“ nennt den Altfehler, zu dem der Text gehört. Steht dort „übernommen aus @jm/settings“ oder „übernommen aus @jm/ui“, ist der Text nicht neu: Das gemeinsame Paket hat ihn schon, das Werkzeug zeigt ihn jetzt zusätzlich an dieser Stelle.

Aufbau: je Werkzeug ein Abschnitt (Player, Interpreter, Stage Display, Caption, Recorder, Presenter, Companion-Modul, Connect), die Log-Zeilen, dann „Changelog“, „Geänderte Bedienung“, „Entscheidungen“, „Offene Fragen“, „Hinweise“ und „Handbuch“.

## Player

Keine neuen sichtbaren Texte. Player 0.10.1 ändert nur die Bedienung (PL-K1, PL-K2, siehe „Geänderte Bedienung“).

## Interpreter

„Startet …“ steht in `INTERPRETER_TEXTE.grund`, der Frist-Text als `START_FRIST_TEXT` in der Engine. INA1 erscheint als Grund unter der gesperrten Haupttaste „Starten“, solange der Start läuft, höchstens 15 Sekunden. INA2 erscheint im Fehlerband des Fensters und im Statuseintrag „Fehlermeldung“ (rot); die Taste ist dann wieder frei. IN-8 hat keinen neuen Text. Der Interpreter hat kein Handbuch (C7), die Änderung steht nur im Changelog.

| Nr. | Ort | Text | Befund |
| --- | --- | --- | --- |
| INA1 | `apps/interpreter/src/renderer/src/lib/oberflaeche.ts:31` (Grund der gesperrten Haupttaste „Starten“, solange der Start läuft) | „Startet …“ | IN-3 |
| INA2 | `apps/interpreter/src/renderer/src/core/engine.ts:33` (Fehler, wenn die Geräte 15 Sekunden nach „Starten“ nicht geantwortet haben; der halbe Start ist aufgeräumt, siehe Offene Frage 3) | „Start abgebrochen: keine Antwort der Geräte.“ | IN-3 |

## Stage Display

Die Texte stehen in `STAGE_TEXTE` bzw. in `PEERS_TEXTE` von `@jm/settings`. SDA1 und SDA2 sind die wechselnde Beschriftung des Knopfs neben dem PIN-Feld (Panel ⚙ › Presenter-Kopplung): „Anzeigen“, solange die PIN verdeckt ist, „Verbergen“, solange sie lesbar ist. SDA3 ist der Knopf daneben, der die PIN übernimmt; er heißt wie in den anderen Werkzeugen (D7). SDA4 ist der neue Knopf neben dem Nachrichtenfeld im Live-Bereich; Enter im Feld wirkt wie „Senden“. „Senden“ mit leerem Feld nimmt die Nachricht von der Bühne (C6). Einen eigenen Hinweis dazu gibt es im Fenster nicht; der Platzhalter „z. B. „Bitte Plätze einnehmen“ — leer = Timer-Nachricht“ bleibt und passt weiter. SDA5 steht in der Zeile einer Quelle (Panel ⚙ › Gegenstellen) und in der Statusleiste, wenn ein eingetragener Host nicht antwortet.

| Nr. | Ort | Text | Befund |
| --- | --- | --- | --- |
| SDA1 | `apps/stage-display/src/renderer/src/lib/oberflaeche.ts:81` (Knopf neben dem PIN-Feld, solange die PIN verdeckt ist; zeigt sie) | „Anzeigen“ | SD-5 |
| SDA2 | `apps/stage-display/src/renderer/src/lib/oberflaeche.ts:82` (derselbe Knopf, solange die PIN lesbar ist; verdeckt sie wieder) | „Verbergen“ | SD-5 |
| SDA3 | `packages/settings/src/abschnitte/peers.ts:47` (Knopf neben dem PIN-Feld; erst er übernimmt die PIN) | „Setzen“ | SD-5 (übernommen aus @jm/settings) |
| SDA4 | `apps/stage-display/src/renderer/src/lib/oberflaeche.ts:58` (Knopf neben dem Nachrichtenfeld; bringt den Entwurf auf die Bühne, mit leerem Feld nimmt er die Nachricht herunter) | „Senden“ | SD-1 |
| SDA5 | `packages/settings/src/abschnitte/peers.ts:42` (Zeile einer eingeschalteten Quelle mit eingetragenem Host, also weder 127.0.0.1 noch leer, ohne Verbindung; gelb) | „nicht erreichbar“ | SD-3 |

## Caption

CAA1 steht in `CAPTION_TEXTE.mikrofon`, CAA3 in `CA11_TEXTE` (`shared/fernbefehl.ts`). CAA2 und CAA4 bis CAA8 kommen unverändert aus `@jm/settings` bzw. `@jm/ui`. CAA1 und CAA2 stehen nach „Mikrofon: “ unter den Haupttasten und im Abschnitt „Audiogerät“, wenn der Browser bei einem Mikrofonfehler keine eigene Meldung mitgibt (Ruling R8): CAA2, wenn das Gerät fehlt, sonst CAA1. Mit Meldung steht die Meldung des Browsers da, wie bisher. CAA3 gibt es nur auf dem Mac; der Text steht im Fenster (Live-Bereich und Statuseintrag „Fehler“), sobald es nach der Ablehnung wieder offen ist, bis zum nächsten Start (Offene Fragen 1 und 2). CAA4 bis CAA8 stehen unter den Feldern „Schrift“ (16 bis 160, ganze Zahl; Panel ⚙ › Darstellung) und „Max. Äußerung (s)“ (2 bis 15; Panel ⚙ › Erkennung), solange der Wert nicht übernommen ist. CA-4 und CA-5 haben keine neuen Texte.

| Nr. | Ort | Text | Befund |
| --- | --- | --- | --- |
| CAA1 | `apps/caption/src/renderer/src/lib/oberflaeche.ts:47` (Grund nach „Mikrofon: “, wenn der Browser keine Meldung mitgibt und es nicht CAA2 ist) | „nicht verfügbar“ | CA-1 |
| CAA2 | `packages/settings/src/abschnitte/audio-device.ts:33` (Grund nach „Mikrofon: “, wenn das gewählte Gerät fehlt und der Browser keine Meldung mitgibt) | „Gerät nicht gefunden“ | CA-1 (übernommen aus @jm/settings) |
| CAA3 | `apps/caption/src/shared/fernbefehl.ts:7` (nur Mac: ein Fernbefehl „Transkription“ würde bei geschlossenem Fenster einschalten; ‹…› ist der Befehl, etwa TRANSCRIBE ON) | „Fernbefehl „‹…›“ abgelehnt: Das Fenster war geschlossen. Die Transkription läuft nicht.“ | CA-11 |
| CAA4 | `packages/ui/src/lib/texte.ts:29` (unter dem Feld, wenn es leer ist oder keine Zahl enthält) | „Bitte eine Zahl eingeben.“ | CA-8 (übernommen aus @jm/ui) |
| CAA5 | `packages/ui/src/lib/texte.ts:30` (unter „Schrift“, wenn die Zahl nicht ganz ist) | „Bitte eine ganze Zahl eingeben.“ | CA-8 (übernommen aus @jm/ui) |
| CAA6 | `packages/ui/src/lib/texte.ts:31` (unter dem Feld, wenn die Zahl zu klein ist; ‹…› ist 16 bzw. 2) | „Mindestens ‹…›.“ | CA-8 (übernommen aus @jm/ui) |
| CAA7 | `packages/ui/src/lib/texte.ts:32` (unter dem Feld, wenn die Zahl zu groß ist; ‹…› ist 160 bzw. 15) | „Höchstens ‹…›.“ | CA-8 (übernommen aus @jm/ui) |
| CAA8 | `packages/ui/src/lib/texte.ts:33` (unter dem Feld, wenn ein gültiger Wert gesendet ist, Caption ihn aber nach einer Frist noch nicht zurückgemeldet hat) | „Noch nicht übernommen.“ | CA-8 (übernommen aus @jm/ui) |

## Recorder

Die Texte stehen in `RECORDER_TEXTE` und in den Konstanten, auf die es verweist: `ERST_AUFNAHME_STOPPEN` und `FERNBEFEHL_ABGELEHNT` (`shared/types.ts`), `AUFNAHME_FEHLER_TEXTE` (`main/recorder.ts`), `SCHLIESSEN_TEXTE` (`shared/schliessen.ts`) und `PLATZ_TEXTE` (`lib/platz.ts`). Eine Ablehnung (REA3 mit REA2, REA4 oder REA5) und die Meldungen REA19 bis REA21 stehen als Band über den Tasten, bis „OK“ gedrückt ist. Der Hinweis zum Netzwerkordner aus der Show (REA6, mit der Taste REA7 und „×“) steht im Hinweisband, nie als Dialog; REA9 steht dort ebenfalls. Bei einem Fehler zeigt die Marke im Live-Bereich REA13 bis REA15 (rot, statt „Aufnahme“, „Bereit“ oder „Inaktiv“), der Statuseintrag „Aufnahme“ REA16 bis REA18 (rot), und die Aufnahme-Taste heißt REA11. Die Rückfrage beim Schließen (REA23 bis REA26) erscheint als Fenster im Recorder-Fenster, die Aufnahme läuft dabei weiter; meldet das Fenster nicht binnen 1 Sekunde, dass es die Frage zeigt, stellt der Recorder dieselbe Frage mit denselben Texten in einem Windows-Dialog („Weiter aufnehmen“ ist dort vorgewählt). Der Statuseintrag „Platz“ (REA27 bis REA33) steht hinter „Aufnahme“: grün ab 15 Minuten, gelb unter 15 Minuten, rot unter 5 Minuten; ein Klick öffnet Panel ⚙ › Ziel. Gesperrt wird nichts.

| Nr. | Ort | Text | Befund |
| --- | --- | --- | --- |
| REA1 | `apps/recorder/src/shared/types.ts:8` (Grund an der gesperrten Taste „Eingang schließen“ während der Aufnahme; derselbe Satz wie REA2 ohne Punkt) | „Erst die Aufnahme stoppen“ | RE-2 |
| REA2 | `apps/recorder/src/shared/types.ts:8` (Grund in REA3, wenn ARM oder DISARM während der Aufnahme kommt; auch die Antwort des Hauptprozesses) | „Erst die Aufnahme stoppen.“ | RE-2 |
| REA3 | `apps/recorder/src/shared/types.ts:16` (Meldung bis „OK“ bei einem abgelehnten Fernbefehl; erstes ‹…› der Befehl wie ARM, DISARM, RECORD ON, RECORD TOGGLE, zweites der Grund REA2, REA4 oder REA5) | „Companion „‹…›“ abgelehnt: ‹…›“ | RE-2, RE-2b, RE-7b |
| REA4 | `apps/recorder/src/renderer/src/lib/oberflaeche.ts:69` (Grund in REA3, wenn RECORD ohne Zielordner kommt) | „Kein Zielordner gewählt.“ | RE-2b |
| REA5 | `apps/recorder/src/renderer/src/lib/oberflaeche.ts:70` (Grund in REA3, wenn RECORD kommt, solange ein Netzwerkordner aus der Show auf „Übernehmen“ wartet) | „Der Netzwerkordner aus der Show ist noch nicht bestätigt.“ | RE-7b |
| REA6 | `apps/recorder/src/renderer/src/lib/oberflaeche.ts:80` (Hinweisband, wenn eine Show einen noch nicht bestätigten Netzwerkordner setzen will; erstes ‹…› der Pfad, zweites der Server) | „Die Show möchte in einem Netzwerkordner aufnehmen: ‹…› (Server ‹…›). Erst nach „Übernehmen“ ist er gesetzt – Windows meldet sich dann bei diesem Server an.“ | RE-7b |
| REA7 | `apps/recorder/src/renderer/src/lib/oberflaeche.ts:81` (Taste im Hinweisband REA6; setzt den Ordner und merkt ihn als bestätigt) | „Übernehmen“ | RE-7b |
| REA8 | `apps/recorder/src/main/ipc.ts:186` (Knopf im Windows-Dialog des Preset-Imports mit Netzwerkordnern; bestehender Text, merkt jetzt zusätzlich die Ordner als bestätigt, B4) | „Übernehmen“ | RE-7b (bestehender Text, neue Bedeutung) |
| REA9 | `apps/recorder/src/renderer/src/lib/oberflaeche.ts:82` (Hinweisband, wenn der Ordner aus der Show kein gültiger Ordner ist) | „Zielordner aus der Show ist kein gültiger Ordner und wurde nicht übernommen: ‹…›“ | RE-7b |
| REA10 | entfällt; stand bis 0.10.0 in `apps/recorder/src/renderer/src/store/recorder.ts:309` (alter Hinweis zu einem Netzwerkordner aus der Show; ersetzt durch REA6) | „Zielordner aus der Show liegt im Netzwerk: ‹…› – nur verwenden, wenn dieser Ordner bekannt ist.“ | RE-7b (entfällt) |
| REA11 | `apps/recorder/src/renderer/src/lib/oberflaeche.ts:42` (Aufnahme-Taste, solange ein Fehler steht; bei offenem Eingang bereit) | „Neu aufnehmen“ | RE-3 |
| REA12 | `apps/recorder/src/renderer/src/lib/oberflaeche.ts:58` (Grund an der gesperrten Taste REA11 bei geschlossenem Eingang, Ruling R17) | „Eingang öffnen, dann neu aufnehmen“ | RE-3 |
| REA13 | `apps/recorder/src/renderer/src/lib/oberflaeche.ts:90` (Marke im Live-Bereich nach einem Schreibfehler) | „Schreibfehler“ | RE-3 |
| REA14 | `apps/recorder/src/renderer/src/lib/oberflaeche.ts:90` (Marke, wenn vom Eingang 2 Sekunden lang nichts kam) | „Kein Eingang“ | RE-3 |
| REA15 | `apps/recorder/src/renderer/src/lib/oberflaeche.ts:90` (Marke, wenn der Start scheiterte) | „Nicht gestartet“ | RE-3 |
| REA16 | `apps/recorder/src/renderer/src/lib/oberflaeche.ts:92` (Statuseintrag „Aufnahme“ nach einem Schreibfehler; ‹…› ist der Grund des Systems) | „Schreibfehler – Aufnahme beendet: ‹…›“ | RE-3 |
| REA17 | `apps/recorder/src/renderer/src/lib/oberflaeche.ts:92` (Statuseintrag „Aufnahme“, wenn vom Eingang nichts kam; ‹…› ist REA22) | „‹…› – Aufnahme beendet“ | RE-3 |
| REA18 | `apps/recorder/src/renderer/src/lib/oberflaeche.ts:92` (Statuseintrag „Aufnahme“, wenn der Start scheiterte; ‹…› ist der Grund) | „Aufnahme nicht gestartet: ‹…›“ | RE-3 |
| REA19 | `apps/recorder/src/main/recorder.ts:83` (Meldung bis „OK“ nach einem Schreibfehler; erstes ‹…› die Datei, zweites der Grund) | „Aufnahme beendet: Schreibfehler in „‹…›“: ‹…›. Das bisher Aufgenommene ist gespeichert.“ | RE-3 |
| REA20 | `apps/recorder/src/main/recorder.ts:84` (Meldung bis „OK“, wenn der Dateikopf beim Stopp nicht geschrieben werden konnte; ‹…› ist die Aufnahmedatei oder die Spurdatei, die scheiterte, Ruling R21) | „Aufnahme beendet: Der Dateikopf von „‹…›“ konnte nicht geschrieben werden: ‹…›.“ | RE-3 |
| REA21 | `apps/recorder/src/main/recorder.ts:85` (Meldung bis „OK“, wenn vom Eingang 2 Sekunden lang nichts kam; nicht bei Loopback-Eingängen) | „Aufnahme beendet: Vom Eingang kamen 2 s lang keine Audiodaten. Das bisher Aufgenommene ist gespeichert.“ | RE-3 |
| REA22 | `apps/recorder/src/main/recorder.ts:86` (Grund in REA17) | „Keine Audiodaten vom Eingang“ | RE-3 |
| REA23 | `apps/recorder/src/shared/schliessen.ts:13` (Frage beim Schließen des Fensters während einer Aufnahme) | „Aufnahme läuft. Wirklich beenden?“ | RE-7a |
| REA24 | `apps/recorder/src/shared/schliessen.ts:14` (Satz unter der Frage REA23) | „Die Aufnahme wird abgeschlossen und gespeichert, danach schließt der Recorder.“ | RE-7a |
| REA25 | `apps/recorder/src/shared/schliessen.ts:15` (Knopf der Frage; schließt die Datei ab und den Recorder) | „Aufnahme beenden“ | RE-7a |
| REA26 | `apps/recorder/src/shared/schliessen.ts:16` (Knopf der Frage; lässt alles, wie es war, die Aufnahme läuft weiter) | „Weiter aufnehmen“ | RE-7a |
| REA27 | `apps/recorder/src/renderer/src/lib/platz.ts:18` (Titel des neuen Statuseintrags) | „Platz“ | RE-PLATZ |
| REA28 | `apps/recorder/src/renderer/src/lib/platz.ts:19` (Restzeit unter einer Stunde; ‹…› sind die Minuten) | „für ‹…› min“ | RE-PLATZ |
| REA29 | `apps/recorder/src/renderer/src/lib/platz.ts:19` (Restzeit ab einer Stunde, etwa „für 2 h 10 min“) | „für ‹…› h ‹…› min“ | RE-PLATZ |
| REA30 | `apps/recorder/src/renderer/src/lib/platz.ts:20` (Restzeit unter einer Minute; rot) | „für unter 1 min“ | RE-PLATZ |
| REA31 | `apps/recorder/src/renderer/src/lib/platz.ts:21` (kein freier Platz mehr; rot) | „voll“ | RE-PLATZ |
| REA32 | `apps/recorder/src/renderer/src/lib/platz.ts:22` (kein Zielordner gewählt) | „kein Zielordner“ | RE-PLATZ |
| REA33 | `packages/ui/src/lib/texte.ts:5` (Platz noch nicht gemessen oder nicht lesbar, auch nach 3 Sekunden ohne Antwort; die Statusleiste zeigt „Platz unbekannt“) | „unbekannt“ | RE-PLATZ (übernommen aus @jm/ui) |

## Presenter

Keine neuen sichtbaren Texte. Die Handy-Seite behält ihre Texte („4-stellige PIN.“, „Falsche PIN.“); neu ist nur, dass „Verbinden“ nichts schaltet (PS-15). Die Wahl an „Schwarz“ und „Weiß“ steht im Companion-Modul (nächster Abschnitt). PS-10 bekommt nur den Handbuchsatz (Task 11).

## Companion-Modul

Die Texte stehen in `SCHIRM_WAHL` (`lib.mjs`) und erscheinen in Companion als Option der Aktionen „Schwarz“ und „Weiß“ des JM Presenter. „Modus“ und „Umschalten“ heißen wie in der Wahl der übrigen Aktionen der Suite (`packages/suite-control-protocol/src/capabilities.ts:99` und `:103`); dort heißen die beiden anderen Wahlen „Start“ und „Stopp“, hier „An“ und „Aus“, wie beim Licht-Blackout (Spec PS-18).

| Nr. | Ort | Text | Befund |
| --- | --- | --- | --- |
| MOD1 | `packages/companion-jm-suite/lib.mjs:12` (Name der Option an „Schwarz“ und „Weiß“) | „Modus“ | PS-18 |
| MOD2 | `packages/companion-jm-suite/lib.mjs:16` (Wahl, Vorgabe; wie bisher, ein zweiter Druck zeigt wieder die Folie) | „Umschalten“ | PS-18 |
| MOD3 | `packages/companion-jm-suite/lib.mjs:17` (Wahl; Schwarz- bzw. Weißbild, auch beim zweiten Druck) | „An“ | PS-18 |
| MOD4 | `packages/companion-jm-suite/lib.mjs:18` (Wahl; zurück auf die Folie, wenn das Bild an ist, sonst nichts) | „Aus“ | PS-18 |

## Connect

Keine neuen sichtbaren Texte. „Ja, verlassen“ bleibt, wie es ist; neu ist nur die Sperrzeit von 1 Sekunde (CN-MV, siehe „Geänderte Bedienung“).

## Log-Zeilen

Diese Zeilen stehen im Log der App (Logordner), nicht im Fenster. Player, Interpreter, Stage Display, Presenter und Connect schreiben in dieser Stufe keine neuen Log-Zeilen.

| Nr. | Ort | Text | Befund |
| --- | --- | --- | --- |
| LOG1 | `apps/caption/src/shared/fernbefehl.ts:8` (Gegenstück zu CAA3; ‹…› ist der Befehl) | „Fernbefehl abgelehnt: ‹…› (kein Fenster offen)“ | CA-11 |
| LOG2 | `apps/recorder/src/shared/types.ts:17` (Gegenstück zu REA3; erstes ‹…› der Befehl, zweites LOG3, LOG4 oder LOG5) | „Fernbefehl abgelehnt: ‹…› (‹…›)“ | RE-2, RE-2b, RE-7b |
| LOG3 | `apps/recorder/src/shared/types.ts:19` (Grund in LOG2 bei ARM oder DISARM während der Aufnahme, auch wenn der Hauptprozess sie im Wettlauf ablehnt, Ruling R11) | „Aufnahme läuft“ | RE-2 |
| LOG4 | `apps/recorder/src/renderer/src/lib/platz.ts:22` (Grund in LOG2 bei RECORD ohne Zielordner; derselbe Wortlaut wie REA32) | „kein Zielordner“ | RE-2b |
| LOG5 | `apps/recorder/src/renderer/src/lib/fernbefehl.ts:25` (Grund in LOG2 bei RECORD, solange ein Netzwerkordner aus der Show wartet) | „Netzwerkordner aus der Show nicht bestätigt“ | RE-7b |
| LOG6 | `apps/recorder/src/main/ipc.ts:55` (Öffnen oder Schließen des Eingangs scheiterte aus einem anderen Grund; erstes ‹…› ARM oder DISARM, zweites der Grund) | „‹…› fehlgeschlagen: ‹…›“ | RE-2 |
| LOG7 | `apps/recorder/src/main/index.ts:55` (eine Show nennt einen noch nicht bestätigten Netzwerkordner; ‹…› ist der Pfad) | „Show-Zielordner wartet auf Bestätigung: ‹…›“ | RE-7b |
| LOG8 | `apps/recorder/src/main/index.ts:58` (eine Show nennt einen ungültigen Ordner; Gegenstück zu REA9) | „Show-Zielordner ungültig, nicht übernommen: ‹…›“ | RE-7b |
| LOG9 | `apps/recorder/src/main/ipc.ts:40` (die Liste der bestätigten Netzwerkordner ließ sich nicht speichern; bis zum nächsten Start gilt die Bestätigung trotzdem) | „Netzwerkordner nicht gemerkt: ‹…›“ | RE-7b |
| LOG10 | `apps/recorder/src/main/recorder.ts:87` (Gegenstück zu REA19 bis REA21; erstes ‹…› die Art, schreiben oder eingang, dann Datei und Grund) | „Aufnahme beendet (‹…›): ‹…›: ‹…›“ | RE-3 |
| LOG11 | `apps/recorder/src/main/recorder.ts:89` (Fix-Welle, Ruling R26: ließ sich bei einer Schließ-Anfrage während der Aufnahme ein Dateikopf nicht neu schreiben; erstes ‹…› die Datei, zweites der Grund; die Frage kommt trotzdem, kein Fehlerzustand) | „Dateikopf bei der Schließ-Anfrage nicht aktualisiert: ‹…›: ‹…›“ | RE-7a |

## Changelog

Entwurf der Release-Notizen (`packages/suite-manifest/changelog.json`), wörtlich wie dort. Das Datum ist ein Platzhalter.

| Nr. | App, Version | Text |
| --- | --- | --- |
| CL-PL1 | Player 0.10.1 | „Ein Cue, der während seiner Vorlaufzeit gelöscht wird, startet nicht mehr, auch nicht in oder nach der Pause. Das gilt auch für einen Video-Cue, der noch auf das Ausgabefenster wartet.“ |
| CL-PL2 | Player 0.10.1 | „GO in der Pause auf einen Cue ohne Vorlaufzeit hebt die Pause jetzt ganz auf, wie „▶ Weiter“: Angehaltene Töne und ein angehaltenes Video in der Ausgabe laufen weiter. „▶ Weiter“ startet ein Video, das schon zu Ende gelaufen ist, nicht mehr neu.“ |
| CL-IN1 | Interpreter 0.3.1 | „„Starten“ ist gesperrt, solange der Start läuft („Startet …“); ein zweiter Klick verwirft den ersten Start nicht mehr. Antworten die Geräte 15 Sekunden lang nicht, bricht der Start mit einer Meldung ab, und die Taste ist wieder frei.“ |
| CL-IN2 | Interpreter 0.3.1 | „„Ducking-Werte zurücksetzen“ lässt die beiden Vorverstärkungen stehen.“ |
| CL-SD1 | Stage Display 0.8.0 | „Die Presenter-PIN steht verdeckt im Feld („Anzeigen“ zeigt sie) und gilt erst mit „Setzen“. In stage-config.json und in der Anfrage an den Presenter steht sie weiter im Klartext, weil das Protokoll des Presenters es so verlangt.“ |
| CL-SD2 | Stage Display 0.8.0 | „Die Nachricht ist ein Entwurf: Sie geht erst mit „Senden“ oder Enter auf die Bühne; „Senden“ mit leerem Feld nimmt sie wieder herunter. Nach einem Neustart steht keine Nachricht auf der Bühne, der letzte Text bleibt als Entwurf im Feld.“ |
| CL-SD3 | Stage Display 0.8.0 | „Die automatische Suche (mDNS) übernimmt einen gefundenen Rechner nur noch, solange eine Quelle auf 127.0.0.1 steht. Ein eingetragener oder früher gefundener Host bleibt stehen; ist er nicht erreichbar, steht in der Statusleiste „nicht erreichbar“.“ |
| CL-CA1 | Caption 0.7.0 | „Ein Mikrofonfehler beendet jetzt die Transkription: Die Haupttaste steht wieder auf „Start“, Companion meldet running=0, und Caption startet nicht mehr von selbst neu. Der Fehler bleibt im Fenster stehen, bis wieder gestartet wird.“ |
| CL-CA2 | Caption 0.7.0 | „„Leeren“ leert jetzt auch die NDI-Quelle, wenn Hold an ist; Hold bleibt an und hält das leere Bild. Eine Korrektur im Verlauf trifft die angeklickte Zeile, auch wenn inzwischen neue Zeilen kamen; Escape bricht die Korrektur ab.“ |
| CL-CA3 | Caption 0.7.0 | „„Schrift“ und „Max. Äußerung (s)“ gelten erst nach Enter oder beim Verlassen des Feldes. Ein leeres Feld oder eine Zahl außerhalb von 16 bis 160 bzw. 2 bis 15 wird nicht übernommen, unter dem Feld steht der Grund.“ |
| CL-CA4 | Caption 0.7.0 | „Mac: Schließt man das Fenster, endet die Transkription und Hold geht aus, auch für Companion; ein Klick aufs Dock öffnet das Fenster wieder. Companion „Transkription“ auf „Start“ wird bei geschlossenem Fenster abgelehnt. Nicht auf dem Mac gemessen.“ |
| CL-RE1 | Recorder 0.11.0 | „Companion: ARM und DISARM beenden keine laufende Aufnahme mehr, sie werden abgelehnt; beenden geht nur mit Stopp. RECORD ON ohne Zielordner wird abgelehnt, statt am Rechner einen Ordnerdialog zu öffnen. Den Grund zeigt das Fenster. Im Fenster ist „Eingang schließen“ während der Aufnahme gesperrt.“ |
| CL-RE2 | Recorder 0.11.0 | „Zielordner aus einer Show: Ein Netzwerkordner gilt erst, wenn ihn jemand im Fenster mit „Übernehmen“ bestätigt; danach ist er gemerkt und geht ohne Klick. Ungültige Pfade übernimmt der Recorder nicht. Das Prüfen eines Netzwerkordners hält weder den Start des Recorders noch den Wechsel zum nächsten Preset auf.“ |
| CL-RE3 | Recorder 0.11.0 | „Schreibfehler, etwa ein voller Datenträger oder ein Netzwerkordner, der wegfällt, und ein Eingang, der 2 Sekunden lang nichts liefert, beenden die Aufnahme jetzt sauber. Der Grund bleibt in Statusleiste und Haupttaste stehen, bis neu aufgenommen, gestoppt oder der Eingang geschlossen wird; „REC“ leuchtet dann nicht mehr, und Companion sieht, dass nicht aufgenommen wird. Fällt ein Gerät aus, schließt der Recorder auch den Eingang; er muss danach wieder geöffnet werden, bevor Companion „RECORD ON“ wirkt. Nicht am echten Datenträger gemessen.“ |
| CL-RE4 | Recorder 0.11.0 | „Wer das Fenster während einer Aufnahme schließt, wird jetzt gefragt; ohne Aufnahme schließt es wie bisher. Beim Abmelden oder Herunterfahren von Windows wird die Aufnahme ohne Frage sauber abgeschlossen (nicht gemessen).“ |
| CL-RE5 | Recorder 0.11.0 | „Neu in der Statusleiste: „Platz“ zeigt, wie lange der freie Speicher im Zielordner für das eingestellte Format reicht, vor und während der Aufnahme; gelb unter 15 Minuten, rot unter 5 Minuten. Gesperrt wird nichts. Am NAS nicht gemessen.“ |
| CL-PS1 | Presenter 0.15.1 | „Handy-Fernsteuerung: „Verbinden“ mit der PIN hebt ein Schwarz- oder Weißbild nicht mehr auf. Es bleibt stehen, bis jemand „Folie“ drückt oder weiterblättert.“ |
| CL-PS2 | Presenter 0.15.1 | „Companion: Die Aktionen „Schwarz“ und „Weiß“ haben eine Wahl „Umschalten“, „An“ oder „Aus“ (Companion-Modul 0.4.0, Datei jm-suite-companion-0.4.0.tgz am Release presenter-v0.15.1 auf GitHub; der Launcher lädt es nicht mit, in Companion über „Import custom module“ importieren). Vorgabe ist „Umschalten“, bestehende Tasten wirken wie bisher. Wer sicher schwarz will, stellt die Taste auf „An“. Presenter bis 0.15.0 schalten bei jeder Wahl um; erst ab Presenter 0.15.1 wirken „An“ und „Aus“.“ |
| CL-CN1 | Connect 0.6.1 | „„Meeting verlassen“ bei laufenden Slots: „Ja, verlassen“ nimmt erst nach einer Sekunde einen Klick an. Ein Doppelklick auf „Meeting verlassen“ verlässt das Meeting also nicht mehr.“ |

Pflichtsätze: P2 (Modul 0.4.0 mit einem Presenter bis 0.15.0 schaltet bei jeder Wahl um, erst ab 0.15.1 wirken „An“ und „Aus“, bestehende Tasten bleiben „Umschalten“) steht in CL-PS2 („Vorgabe ist „Umschalten“, bestehende Tasten wirken wie bisher.“ und „Presenter bis 0.15.0 schalten bei jeder Wahl um; erst ab Presenter 0.15.1 wirken „An“ und „Aus“.“). C2 („nicht auf dem Mac gemessen“) steht in CL-CA4.

## Geänderte Bedienung

Je Befund ein Satz, was Du anders erlebst.

- PL-K1: Ein Cue, den man während seiner Vorlaufzeit löscht, startet nicht mehr, auch nicht in oder nach der Pause und auch nicht, wenn er als Video noch auf das Ausgabefenster wartet; andere Vorläufe laufen weiter.
- PL-K2: GO in der Pause auf einen Cue ohne Vorlaufzeit hebt die Pause ganz auf wie „▶ Weiter“: Angehaltene Töne, Vorläufe und das Ausgabevideo laufen weiter, dann startet der neue Cue; ein GO auf einen Cue mit Vorlaufzeit wartet weiter bis „▶ Weiter“ (A1), und „▶ Weiter“ startet ein schon zu Ende gelaufenes Video nicht neu.
- IN-3: Während des Starts ist „Starten“ gesperrt mit „Startet …“ (INA1), ein Doppelklick startet nur einmal; antworten die Geräte 15 Sekunden lang nicht, steht INA2 im Fenster, und die Taste ist wieder frei.
- IN-8: „Ducking-Werte zurücksetzen“ setzt nur noch die fünf Ducking-Werte zurück; die beiden Vorverstärkungen bleiben, auch im laufenden Mix.
- SD-5: Die PIN steht verdeckt im Feld, „Anzeigen“ und „Verbergen“ (SDA1, SDA2) schalten die Sicht um, und sie gilt erst mit „Setzen“ (SDA3); Tippen allein ändert nichts mehr.
- SD-1: Getippter Text ist ein Entwurf; erst „Senden“ (SDA4) oder Enter bringt ihn auf die Bühne, „Senden“ mit leerem Feld nimmt die Nachricht herunter, und nach einem Neustart ist die Bühne ohne Nachricht, der Entwurf steht im Feld.
- SD-3: Eine Quelle mit eingetragenem Host (weder 127.0.0.1 noch leer) wechselt nie mehr von selbst auf einen gefundenen Rechner; ohne Verbindung zeigt sie „nicht erreichbar“ (SDA5).
- CA-1: Ein Mikrofonfehler beendet die Transkription (Haupttaste wieder „Start“, Companion running=0), Caption startet nicht von selbst neu, und der Grund steht nach „Mikrofon: “ unter den Haupttasten, bis wieder gestartet wird (bei leerer Meldung CAA1 oder CAA2).
- CA-4: „Leeren“ leert bei Hold auch das NDI-Bild; Hold bleibt an und hält das leere Bild.
- CA-5: Eine Korrektur im Verlauf trifft die angeklickte Zeile, auch wenn inzwischen neue Zeilen kamen; Escape bricht die Korrektur ab und lässt den alten Text.
- CA-8: „Schrift“ und „Max. Äußerung (s)“ gelten erst nach Enter oder beim Verlassen des Feldes; ein leeres Feld oder eine Zahl außerhalb der Grenzen wirkt nicht, unter dem Feld steht der Grund (CAA4 bis CAA8).
- CA-11 (nur Mac): Fenster schließen beendet Transkription und Hold, auch für Companion, und ein Klick aufs Dock öffnet das Fenster wieder; ein Companion „Transkription“, das einschalten würde („Start“, oder „Umschalten“ bei gestoppter Transkription), wird bei geschlossenem Fenster abgelehnt (CAA3, LOG1).
- RE-2: Während der Aufnahme lehnt der Recorder Companion ARM und DISARM ab (REA3 mit REA2), und „Eingang schließen“ ist gesperrt mit „Erst die Aufnahme stoppen“ (REA1); beenden geht nur mit Stopp.
- RE-2b: Companion RECORD ON ohne Zielordner wird abgelehnt (REA3 mit REA4), am Rechner öffnet sich kein Ordnerdialog mehr; von Hand im Fenster öffnet „Aufnahme“ den Dialog wie bisher.
- RE-7b: Ein Netzwerkordner aus einer Show steht als Hinweis mit „Übernehmen“ im Fenster (REA6, REA7) und gilt erst danach, bestätigt ist er gemerkt und geht beim nächsten Mal ohne Klick; bis dahin ist kein Ordner gesetzt, RECORD wird mit REA5 abgelehnt, und „×“ stellt den Ordner von vorher wieder her (D1); ein ungültiger Ordner wird nicht übernommen (REA9).
- RE-NAS: Die Prüfung eines Netzwerkordners hält weder den Start des Recorders noch das nächste Preset auf; der Netzwerkordner eines Presets gilt erst nach seiner Prüfung, und hängt sie, bleibt bis zur Antwort der Ordner von vorher (Ruling R13).
- RE-3: Ein Schreibfehler oder 2 Sekunden ohne Audio vom Eingang beenden die Aufnahme sauber, die Datei bis dahin ist abgeschlossen, „REC“ ist aus; der Grund steht als Meldung bis „OK“, als Marke, im Statuseintrag „Aufnahme“ und an der Taste „Neu aufnehmen“, bis eine Aufnahme gelingt, ein Stopp ihn quittiert oder jemand den Eingang schließt. Fällt der Eingang weg, schließt der Recorder ihn dabei (Companion armed=0); dann erst „Eingang öffnen“ und neu aufnehmen (R28).
- RE-7a: Schließen während einer Aufnahme fragt „Aufnahme läuft. Wirklich beenden?“ mit „Weiter aufnehmen“ und „Aufnahme beenden“ (REA23 bis REA26), die Aufnahme läuft währenddessen weiter; ohne Aufnahme schließt das Fenster wie bisher, und Abmelden oder Herunterfahren von Windows schließen die Aufnahme ohne Frage ab (nicht gemessen). Jede Schließ-Anfrage während der Aufnahme schreibt den Dateikopf neu; beendet danach ein Update den Recorder hart, spielt die Datei bis zur Anfrage ab (R26).
- RE-PLATZ: Neu in der Statusleiste steht „Platz“ mit der Restzeit für das eingestellte Format, vor und während der Aufnahme, gelb unter 15 Minuten, rot unter 5 Minuten; gesperrt wird nichts, und ohne Messwert steht „Platz unbekannt“.
- PS-15: „Verbinden“ auf der Handy-Seite hebt ein Schwarz- oder Weißbild nicht mehr auf; es bleibt, bis jemand „Folie“ drückt oder weiterblättert.
- PS-18: Die Companion-Aktionen „Schwarz“ und „Weiß“ haben die Option „Modus“ mit „Umschalten“ (Vorgabe, wie bisher), „An“ und „Aus“ (MOD1 bis MOD4); mit einem Presenter bis 0.15.0 schalten alle drei um.
- PS-10: Unverändert: Esc beendet die Präsentation sofort und ohne Rückfrage; das Handbuch nennt es (Task 11).
- CN-MV: Bei laufenden Slots nimmt „Ja, verlassen“ erst nach einer Sekunde einen Klick an, ein Doppelklick auf „Meeting verlassen“ verlässt also nicht; Platz, Text und Tastaturfokus der Taste bleiben, und ohne laufende Slots verlässt ein Klick sofort wie bisher. Auch ein gehaltenes Enter oder eine gehaltene Leertaste verlässt nicht (R29).

## Entscheidungen

Wo Spec und Code schwiegen, steht hier, was gilt: die Festlegungen B, C, P und D des Plans in Kurzform, darunter die Rulings aus dem Bau, die etwas Sichtbares ändern. Du kannst jede umstoßen. Die vollständige Liste mit Grund und „Kostet, wenn falsch“ steht in `docs/ux/altfehler-entscheidungen.md`, Abschnitt „Stufe 2“.

- B1 (RE-3): Kommen an einem Eingang, der kein Loopback ist, während der Aufnahme 2 Sekunden lang keine Audioblöcke, endet die Aufnahme wie bei einem Schreibfehler; ein USB-Aussetzer über 2 Sekunden beendet sie also.
- B2 (RE-3): Kein Schreibfehler erreicht das Audio-Modul; die Aufnahme endet sauber (Datei abgeschlossen, Eingang bleibt offen, Fehler bleibt stehen), Companion sieht recording=0; fällt der Eingang weg, schließt er seit R28 mit. Auch ein gescheiterter Start setzt den Fehler. Die Abnahme zieht einen USB-Stick während der Aufnahme ab.
- B3 (RE-7a): Die Rückfrage erscheint im Fenster, ohne den Recorder anzuhalten; zeigt das Fenster sie nicht binnen 1 Sekunde, fragt der Recorder mit einem nicht blockierenden Windows-Dialog. Abmelden und Herunterfahren schließen ohne Frage ab (nicht gemessen, R27).
- B4 (RE-7b): Ein unbestätigter Netzwerkordner aus einer Show setzt nur vorläufig „kein Ordner“; der gemerkte Ordner bleibt, bis bestätigt oder neu gewählt ist. „Übernehmen“ im Preset-Import merkt den Netzwerkordner ebenfalls als bestätigt.
- B5 (RE-PLATZ): Der freie Platz wird alle 5 Sekunden gelesen, mit 3 Sekunden Zeitgrenze, danach „Platz unbekannt“. Datenrate: Kanäle × Samplerate × 4 Byte (32-bit Float), doppelt mit „Spuren einzeln“ ab zwei Kanälen.
- B6 (RE-2, RE-2b, RE-7b): Ein gemeinsamer Weg für abgelehnte Fernbefehle, mit Meldung bis „OK“ und Log-Zeile; dazu ein Wächter im Hauptprozess, damit ein ARM kurz nach RECORD ON keine Aufnahme beendet.
- B7 (Recorder): Die Funktionsliste bindet jede ID an ihre Dateien wie im Player; die Preset-Leiste bleibt unberührt.
- C1 (CA-8): Zahlenfelder wie im Recorder: Ein ungültiger Wert zeigt den Grund und wirkt nicht; Werte aus der Datei und über die Fernsteuerung zieht Caption auf die Grenzen.
- C2 (CA-11): Fix mit Test, nicht auf dem Mac gemessen; kein Mac-Bau (siehe Offene Frage 1).
- C3 (CA-1): Der Fehler steht im Fenster bis zum nächsten Start. Ein Mikrofon, das mitten im Lauf ausfällt, ist Kandidat CA-K1.
- C4 (IN-3): Der Start hat eine Frist von 15 Sekunden; danach gilt er als gescheitert, die Taste ist frei, der halbe Start ist aufgeräumt.
- C5 (SD-3): „nicht erreichbar“ kommt in `@jm/settings`; andere gefundene Rechner erscheinen nicht als Vorschläge.
- C6 (SD-1): Der Entwurf wird gemerkt; „Senden“ mit leerem Entwurf nimmt die Nachricht von der Bühne.
- C7 (Interpreter): Kein Handbuch; die Änderung steht nur im Changelog.
- C8 (Funktionslisten): Caption, Interpreter und Stage Display binden jede ID an ihre Dateien wie der Player.
- C9 (Bauweise): Befunde mit derselben Datei entstanden nacheinander.
- C10 (Versionen): Caption 0.7.0, Interpreter 0.3.1, Stage Display 0.8.0, Recorder 0.11.0, Player 0.10.1.
- P1 (PS-18): Die Wahl steht nur im Companion-Modul, nicht in der gemeinsamen Tabelle der Suite; Rundown bietet sie darum nicht an und schaltet weiter um.
- P2 (PS-18): Ohne Wahl oder mit unbekannter Wahl wird umgeschaltet, im Modul und im Presenter. Modul 0.4.0 mit einem Presenter bis 0.15.0 schaltet bei jeder Wahl um. Die Datei des Moduls hängt am Release presenter-v0.15.1, nur mit Deinem OK; die Abnahme prüft mit echtem Companion.
- P3 (PL-K2): Gilt nur für ein GO ohne Vorlaufzeit; geweckt wird nur, was angehalten ist, ein von selbst zu Ende gelaufenes Video startet nicht neu, auch nicht mit „▶ Weiter“.
- P4 (PL-K1): Auch ein Video-Cue, der beim Warten auf das Ausgabefenster gelöscht wird, startet nicht.
- P5 (PS-10): Nur der Handbuchsatz: Esc beendet die Präsentation sofort und ohne Rückfrage, im Referenten, im Publikumsfenster und in der Übersicht; im Panel schließt Esc das Panel.
- P6 (CN-MV): „Ja, verlassen“ nimmt erst nach 1 Sekunde Klicks an. Dass die Rückfrage nie verfällt, ist Kandidat CN-K1.
- P7 (PS-15): Die Handy-Seite prüft die PIN über den lesenden Strom `/events`, der nichts schaltet; kein neuer Befehl.
- P8 (Versionen): Presenter 0.15.1, Connect 0.6.1, Companion-Modul 0.4.0.
- P9: Die Switcher-Funktionsliste ist im GIT-Modus schon auf `main` rot (siehe Hinweise); kein Fix in dieser Stufe.
- D1 (RE-7b): „×“ am Hinweis, „Ordner wählen“ und ein Preset, das einen Ordner setzt, beenden den Vorschlag der Show; bei „×“ gilt wieder der Ordner von vorher.
- D2 (RE-7b): Ein Ordner aus der Show, der gleich dem gesetzten ist, gilt als bestätigt und wird gemerkt.
- D3 (RE-3): Der Fehler hat eine Art (Schreiben, Eingang, Start), einen Text und die Datei. Ihn löschen nur eine gelungene Aufnahme, die Quittung eines Stopps im Fehlerzustand und ein „Eingang schließen“ durch einen Bediener (Pre-flight K7; ein ARM und das Neu-Öffnen bei einem Preset-Wechsel löschen ihn nicht). Ein Schreibfehler löscht auch geplante Start- und Stoppzeiten.
- D4 (RE-7a): Die erste Antwort gilt, aus dem Fenster oder aus dem Windows-Dialog. Endet die Aufnahme, während die Frage offen ist, bleibt die Frage offen bis zur Antwort.
- D5 (PL-K2): Das Ausgabevideo gilt in der Pause als angehalten, solange ein Video-Cue gehalten ist.
- D6 (IN-3): Die Frist ist im Code einstellbar, damit der Test schnell läuft; am Verhalten ändert das nichts.
- D7 (SD-5): „Setzen“ kommt aus `@jm/settings` (SDA3), kein eigener Text.
- D8 (CA-11): Der Grund der Ablehnung steht im Fenster, sobald es wieder offen ist, bis zum nächsten Start. Abgelehnt wird nur ein „Transkription“, das einschalten würde; Hold, NDI und Leeren wirken weiter.
- D9 (CN-MV): In der Sperrzeit ist „Ja, verlassen“ als gesperrt markiert, der Klick wird verworfen, Platz, Text und Tastaturfokus bleiben (gemessen).
- D10 (SD-3): Die Änderung in `@jm/settings` ist in den Funktionslisten von Connect, Presenter und Studio-Control nachgetragen.
- D11: Zusätzlich zu RE-7a und CN-MV ist im echten Fenster gemessen: PL-K2, IN-3, SD-1, CA-1 und CA-8.
- R5 (SD-5): Der PIN-Knopf wechselt seine Beschriftung („Anzeigen“, „Verbergen“); einen zusätzlichen Zustand „gedrückt“ für Screenreader hat er nicht.
- R6 (SD-3): Ein leerer Host gilt wie 127.0.0.1 als nicht eingerichtet; die Suche darf ihn füllen, und er heißt nie „nicht erreichbar“.
- R8 (CA-1): Gibt der Browser bei einem Mikrofonfehler keine Meldung mit, steht „Gerät nicht gefunden“ (fehlendes Gerät) oder „nicht verfügbar“ da, nie ein leeres „Mikrofon:“.
- R11 (RE-2): Lehnt der Hauptprozess ARM oder DISARM im Wettlauf ab, kommen dieselbe Meldung und eine Log-Zeile wie bei jeder Ablehnung.
- R13 (RE-NAS): Hängt die Prüfung eines Netzwerkordners aus einem Preset, gilt bis zur Antwort der Ordner von vorher; die Abnahme prüft das eigens.
- R14, R19 (RE-7a, Mac): Auf dem Mac fehlt der Schutz durch die Rückfrage bei Cmd+Q, Abmelden und Herunterfahren; der Recorder wird nur für Windows gebaut (Kandidat RE-K3).
- R16 (RE-PLATZ): Ein Netzwerkpfad mit Schrägstrichen wird an der Freigabe gemessen, nie an der Platte des Rechners; nie eine erfundene Zahl.
- R17 (RE-3): Die Haupttaste zeigt den Fehler auch bei geschlossenem Eingang (REA11 mit REA12).
- R18 (RE-3): Ein verspäteter Takt des Wächters gilt als Stau, nicht als fehlender Eingang; „kein Zielordner“ steht einmal im Code.
- R20 (RE-7a): Mehrfaches Schließen verschiebt den Windows-Dialog nicht; er kommt 1 Sekunde nach dem ersten Schließen.
- R21 (RE-3): Lässt sich beim Stopp der Kopf einer Spurdatei nicht schreiben, meldet der Recorder REA20 mit dieser Spurdatei statt „Gespeichert“.
- R23 (PS-15): Die Handy-Seite verbindet sich auch auf älteren Handys (iOS vor 12.2, Chrome vor 66).
- R26 (RE-7a, Gesamtprüfung): Jede Schließ-Anfrage während einer Aufnahme schreibt zuerst die Dateiköpfe mit den aktuellen Größen neu, ohne zu schließen. Ein Update oder eine Deinstallation über den Launcher beendet den Recorder nach der Anfrage hart; die Datei spielt dann bis zur Anfrage ab. Das Handbuch rät, vor einem Update zu stoppen; der Launcher-Kandidat LA-K1 steht im Inventar.
- R27 (RE-7a, Gesamtprüfung): Abmelden und Herunterfahren von Windows sind nicht gemessen; Changelog, Handbuch und diese Tabelle sagen das, die Abnahme hat dafür den optionalen Schritt AR14.
- R28 (RE-3, Gesamtprüfung; ändert B2 für den Fall „Eingang“): Kommen 2 Sekunden lang keine Audiodaten, schließt der Recorder nach dem Abschluss der Datei auch den Eingang; Companion sieht armed=0, die Haupttaste zeigt REA11 mit REA12, der Fehler bleibt stehen. Bei Dante, das sich erholen könnte, öffnet der Bediener den Eingang selbst wieder.
- R29 (CN-MV, Gesamtprüfung): Hält jemand Enter oder die Leertaste auf „Ja, verlassen“, verlässt die Tastenwiederholung das Meeting nicht.

## Offene Fragen

Hier entscheidest Du. Was nur zur Kenntnis ist, steht unter „Hinweise“.

1. Caption auf dem Mac: Companion `transcribe on` bei geschlossenem Fenster wird abgelehnt (C2). Vorschlag: so lassen; sonst startet Companion eine Transkription ohne Fenster. Das ändert die Wirkung eines Befehls, darum fragen wir ausdrücklich. Zur Kenntnis dazu: Es gibt kein lokal gebautes DMG; Caption wird wie in 2a nur für Windows ausgeliefert, CA-11 (CL-CA4, CAA3, LOG1) kommt also erst mit einem späteren Mac-Bau an. Entschieden (Owner 27.11.2026 10:00, Freigabe mit den Vorschlägen): Die Ablehnung bleibt.
2. Wortlaut von CAA3: Heute „Companion „‹…›“ abgelehnt: Das Caption-Fenster ist geschlossen. Ein Klick aufs Dock öffnet es.“ Gelesen wird der Text aber erst, wenn das Fenster wieder offen ist, und jeder Client des Steuerservers kann `transcribe` senden, nicht nur Companion. Vorschlag: „Fernbefehl „‹…›“ abgelehnt: Das Fenster war geschlossen. Die Transkription läuft nicht.“ Player (PL-16a) und Recorder (REA3) sagen „Companion „…“ abgelehnt“ auch für andere Clients; wer den Gleichklang will, nimmt „Companion „‹…›“ abgelehnt: Das Fenster war geschlossen. Die Transkription läuft nicht.“ Entschieden (Owner 27.11.2026 10:00, Freigabe mit den Vorschlägen): CAA3 heißt „Fernbefehl „‹…›“ abgelehnt: Das Fenster war geschlossen. Die Transkription läuft nicht.“
3. Länge von INA2: Steht der Frist-Text im Statuseintrag „Fehlermeldung“, kürzt er die übrigen Einträge der Statusleiste („Mast…“, „Flo…“, „Dolmetsch…“; gemessen in Task 2). Vorschlag, kürzer: „Start abgebrochen: keine Antwort der Geräte.“ (44 statt 64 Zeichen); die 15 Sekunden nennt dann nur der Changelog (CL-IN1). Entschieden (Owner 27.11.2026 10:00, Freigabe mit den Vorschlägen): INA2 heißt „Start abgebrochen: keine Antwort der Geräte.“

## Hinweise

Zur Kenntnis, keine Frage.

1. P9: Die Funktionsliste des Switchers ist im GIT-Modus schon auf `main` (`eb8670b224`) rot. Das kommt nicht aus dieser Stufe; sie wird hier weder geprüft noch geändert.
2. R14, R19: Beim Recorder auf dem Mac (Cmd+Q, Abmelden, Herunterfahren) fehlt der Schutz durch die Rückfrage. Weil der Recorder nur für Windows gebaut wird, ist das Kandidat RE-K3.
3. Caption: Im schmalen Zahlenfeld bricht der Fehlertext zweizeilig um („Mindestens“ / „16.“). Das ist dasselbe Muster wie im Recorder und nur kosmetisch.
4. Recorder, REA3: Das Band sagt immer „Companion „…“ abgelehnt“, auch wenn der Befehl von Rundown kommt oder der Hauptprozess einen Wettlauf abfängt (R11); der Wortlaut folgt dem Player (PL-16a).
5. Recorder, „Übernehmen“ (REA7 und REA8): gleicher Wortlaut, gleiche Bedeutung: Der Netzwerkordner gilt, und Windows meldet sich bei diesem Server an; im Import kommen zusätzlich die Presets dazu. Seit B4 merkt auch REA8 den Ordner für spätere Shows als bestätigt. Der Satz im Import-Dialog („Nur übernehmen, wenn dieser Ordner bekannt ist – beim Anwenden meldet sich Windows bei diesem Server an.“, `apps/recorder/src/main/presets.ts:129`) sagt das nicht; er ist in dieser Stufe unverändert.
6. Recorder, REA20 („Dateikopf“): Der Text nennt immer eine Datei, die Aufnahmedatei oder seit R21 die Spurdatei, die scheiterte; ein Ordner erscheint dort nicht mehr. Offen und klein: Ein Schreibfehler einer Spur mitten in der Aufnahme nennt in REA19 die Aufnahmedatei statt der Spurdatei, und REA19 und REA21 sagen „gespeichert“ auch dann, wenn dabei der Kopf einer Spurdatei scheiterte.
7. Player 0.10.1: keine neuen Texte; die Bedienung ändert sich nur bei PL-K1 und PL-K2.
8. Connect 0.6.1: „Ja, verlassen“ ist unverändert; die Sperrzeit von 1 Sekunde hat keinen eigenen Text und keinen Hinweis für Screenreader.
9. Recorder, REA3 im Fenster (R11): Klickt jemand im Fenster auf „Eingang schließen“, genau während Companion eine Aufnahme startet, lehnt der Hauptprozess das im Wettlauf ab, und das Band meldet es als „Companion „DISARM“ abgelehnt: Erst die Aufnahme stoppen.“ (REA3 mit REA2), obwohl der Klick aus dem Fenster kam; der Hauptprozess unterscheidet nicht, woher ein DISARM kommt.
10. Recorder, „×“ im Hinweisband (D1): Das Band hat ein einziges „×“. Es verwirft alle Hinweise darin, auch einen offenen Vorschlag der Show für einen Netzwerkordner (REA6); danach gilt wieder der Ordner von vorher.

## Handbuch

Die sechs Handbücher im Kochbuch (Player, Stage Display, Caption, Recorder, Presenter, Connect) nennen jetzt die geänderte Bedienung, in den Worten der Crew: was man sieht und tut. Der Interpreter hat kein Handbuch (C7); seine Änderung steht nur im Changelog. Je Stelle steht oben der alte Wortlaut (`-`), darunter der neue (`+`); Stellen, die es vorher nicht gab, haben nur `+`-Zeilen. Der Kochbuch-Bau (`npm run cookbook:build`) hat `packages/cookbook/cookbook.json` neu erzeugt.

### Player

- `` Beim Aufräumen: Der Standby bleibt auf seinem Cue, wenn man andere Cues löscht oder umsortiert (wird der Standby-Cue selbst gelöscht, steht er danach auf dem nächsten). Der Player fragt nach, wenn man mit ✕ einen Cue löscht, während in der Show etwas läuft („Die Show läuft. Cue 3 „Intro“ trotzdem entfernen?“), und wenn man ein Medium mit ✕ aus der Bibliothek entfernt, das Cues oder Pads benutzen („‹Titel› wird von 2 Cues und 1 Pad benutzt. Trotzdem aus der Bibliothek entfernen? Dort steht danach „Medium fehlt“.“). Die Rückfrage erscheint als Fenster im Player-Fenster, die Show läuft währenddessen weiter (auch Companion-Befehle wirken); „Abbrechen“ ist vorgewählt und lässt wie Escape alles, wie es war, „Entfernen“ entfernt ``
+ Beim Aufräumen: Der Standby bleibt auf seinem Cue, wenn man andere Cues löscht oder umsortiert (wird der Standby-Cue selbst gelöscht, steht er danach auf dem nächsten). Der Player fragt nach, wenn man mit ✕ einen Cue löscht, während in der Show etwas läuft („Die Show läuft. Cue 3 „Intro“ trotzdem entfernen?“), und wenn man ein Medium mit ✕ aus der Bibliothek entfernt, das Cues oder Pads benutzen („‹Titel› wird von 2 Cues und 1 Pad benutzt. Trotzdem aus der Bibliothek entfernen? Dort steht danach „Medium fehlt“.“). Die Rückfrage erscheint als Fenster im Player-Fenster, die Show läuft währenddessen weiter (auch Companion-Befehle wirken); „Abbrechen“ ist vorgewählt und lässt wie Escape alles, wie es war, „Entfernen“ entfernt. Ein Cue, den man so während seiner Vorlaufzeit entfernt, startet danach nicht mehr, auch nicht, wenn die Vorlaufzeit in der Pause angehalten ist oder ein Video-Cue noch auf das Ausgabefenster wartet; die Vorlaufzeiten der anderen Cues laufen weiter

- `` `PAUSE` für kurze Unterbrechung: Sie hält laufende Cues und auch die Vorlaufzeit (Pre-Wait) noch nicht gestarteter Cues an; „▶ Weiter“ setzt beides fort, und eine angefangene Vorlaufzeit läuft mit der Restzeit weiter, nicht von vorn. Ein `GO` mitten in der Pause auf einen Cue mit Vorlaufzeit stellt ihn an, lässt ihn aber warten, bis „▶ Weiter“ gedrückt wird; ein `GO` auf einen Cue ohne Vorlaufzeit startet sofort und hebt die Pause auf. `STOP` beendet sauber, `PANIC` bei Bedarf hart abwürgen (lokal die Haupttasten „❚❚ Pause“, „■ Stop“ und „⛔ Panik“ im Transport der Cue-Show; „■ Stop“ und „⛔ Panik“ stehen auch in der Fußleiste von Bibliothek und Soundboard, Panik stoppt jetzt auch die Pads) ``
+ `PAUSE` für kurze Unterbrechung: Sie hält laufende Cues und auch die Vorlaufzeit (Pre-Wait) noch nicht gestarteter Cues an; „▶ Weiter“ setzt beides fort, und eine angefangene Vorlaufzeit läuft mit der Restzeit weiter, nicht von vorn. Ein `GO` mitten in der Pause auf einen Cue mit Vorlaufzeit stellt ihn an, lässt ihn aber warten, bis „▶ Weiter“ gedrückt wird; ein `GO` auf einen Cue ohne Vorlaufzeit hebt die Pause ganz auf wie „▶ Weiter“: Angehaltene Töne, Vorlaufzeiten und ein angehaltenes Video in der Ausgabe laufen weiter, dann startet der neue Cue. „▶ Weiter“ startet ein Video, das schon zu Ende gelaufen ist, nicht neu. `STOP` beendet sauber, `PANIC` bei Bedarf hart abwürgen (lokal die Haupttasten „❚❚ Pause“, „■ Stop“ und „⛔ Panik“ im Transport der Cue-Show; „■ Stop“ und „⛔ Panik“ stehen auch in der Fußleiste von Bibliothek und Soundboard, Panik stoppt jetzt auch die Pads)

### Stage Display

- `` Nicht verbundene Quellen werden per mDNS automatisch mit Host/Port vorbefüllt (die PIN bleibt manuell: Panel ⚙ › Presenter-Kopplung). ``
+ Quellen, die noch auf der Vorgabe stehen (Host `127.0.0.1` oder leer), füllt die automatische Suche (mDNS) mit dem gefundenen Host und Port. Ein eingetragener oder einmal gefundener Host bleibt danach stehen: Die Suche ersetzt ihn nie mehr von selbst, auch nicht, wenn die Quelle ausfällt; dann zeigt sie „nicht erreichbar“ (die PIN bleibt manuell: Panel ⚙ › Presenter-Kopplung).

- `` Im Panel ⚙ › Gegenstellen je Quelle den Schalter „Aktiv“ einschalten und **Host + Port** eintragen, dann mit „Setzen“ übernehmen (oder die mDNS-Vorbefüllung übernehmen). Für den Presenter zusätzlich die **PIN** im Panel ⚙ › Presenter-Kopplung wie in dessen Fernsteuerung (der Abschnitt erscheint, sobald die Presenter-Quelle an ist). ``
+ Im Panel ⚙ › Gegenstellen je Quelle den Schalter „Aktiv“ einschalten und **Host + Port** eintragen, dann mit „Setzen“ übernehmen (oder die mDNS-Vorbefüllung übernehmen). Für den Presenter zusätzlich die **PIN** im Panel ⚙ › Presenter-Kopplung wie in dessen Fernsteuerung eintragen und mit „Setzen“ übernehmen (der Abschnitt erscheint, sobald die Presenter-Quelle an ist). Die PIN steht verdeckt im Feld, „Anzeigen“ zeigt sie, „Verbergen“ deckt sie wieder zu; Tippen allein ändert nichts. In `stage-config.json` und in der Anfrage an den Presenter steht sie weiter im Klartext, weil das Protokoll des Presenters es so verlangt.

- `` Statusleiste prüfen: jede aktive Quelle (Einträge „JM Timer“, „JM Switcher“, „JM Presenter“) sollte „verbunden“ zeigen (sonst „nicht gefunden“; dieselbe Zeile steht im Panel ⚙ › Gegenstellen). ``
+ Statusleiste prüfen: jede aktive Quelle (Einträge „JM Timer“, „JM Switcher“, „JM Presenter“) sollte „verbunden“ zeigen (sonst „nicht gefunden“, bei eingetragenem Host „nicht erreichbar“; dieselbe Zeile steht im Panel ⚙ › Gegenstellen).

- `` Bei Bedarf eine **Ad-hoc-Nachricht** im Feld „Nachricht“ direkt unter der Vorschau einblenden (hat Vorrang vor der Timer-Nachricht; die Statusleiste „Nachricht“ zeigt „auf dem Schirm“, sobald sie auf dem offenen Bühnenschirm steht) — z. B. „Bitte zum Schluss kommen". ``
+ Bei Bedarf eine **Ad-hoc-Nachricht** im Feld „Nachricht“ direkt unter der Vorschau schreiben und mit „Senden“ oder Enter einblenden (hat Vorrang vor der Timer-Nachricht; die Statusleiste „Nachricht“ zeigt „auf dem Schirm“, sobald sie auf dem offenen Bühnenschirm steht) — z. B. „Bitte zum Schluss kommen". Das Tippen ist nur ein Entwurf: Auf die Bühne kommt der Text erst mit „Senden“, und „Senden“ mit leerem Feld nimmt die Nachricht wieder herunter. Nach einem Neustart steht keine Nachricht auf der Bühne, der letzte Text bleibt als Entwurf im Feld.

- `` Bei getrennten Event-Netzen (mDNS blockiert) Host/Port je Quelle von Hand im Panel ⚙ › Gegenstellen eintragen und mit „Setzen“ übernehmen — Stage Display braucht dafür keine Discovery. ``
+ Bei getrennten Event-Netzen (mDNS blockiert) Host/Port je Quelle von Hand im Panel ⚙ › Gegenstellen eintragen und mit „Setzen“ übernehmen — Stage Display braucht dafür keine Discovery. Ein so eingetragener Host bleibt stehen; die Suche ersetzt ihn nicht, auch wenn im Netz ein anderer Rechner mit demselben Tool auftaucht.

- `` | Quelle bleibt „nicht gefunden“ (Statusleiste, Panel ⚙ › Gegenstellen) | Host/Port richtig? Tool läuft? Bei Firewall/getrenntem Netz Adresse von Hand im Panel ⚙ › Gegenstellen eintragen und mit „Setzen“ übernehmen | ``
- `` | Switcher „nicht gefunden“ trotz Erreichbarkeit | Läuft der Switcher sicher (Token/TLS)? Dann muss die geteilte control.json auch hier provisioniert sein | ``
+ | Quelle bleibt „nicht gefunden“ oder „nicht erreichbar“ (Statusleiste, Panel ⚙ › Gegenstellen) | „nicht gefunden“: Die Quelle steht auf der Vorgabe (`127.0.0.1` oder leer), und nichts antwortet. „nicht erreichbar“: Ein eingetragener oder früher gefundener Host antwortet nicht; die Suche wechselt dann nicht von selbst auf einen anderen Rechner. Host/Port richtig? Tool läuft? Bei Firewall/getrenntem Netz Adresse von Hand im Panel ⚙ › Gegenstellen eintragen und mit „Setzen“ übernehmen. Soll die Suche den Host wieder füllen, ihn auf `127.0.0.1` setzen oder leeren |
+ | Switcher „nicht gefunden“ bzw. „nicht erreichbar“ trotz Erreichbarkeit | Läuft der Switcher sicher (Token/TLS)? Dann muss die geteilte control.json auch hier provisioniert sein |

- `` [ ] Quellen aktiviert, Host/Port gesetzt (oder mDNS-Vorbefüllung) ``
- `` [ ] Presenter-PIN eingetragen (falls Presenter genutzt) ``
+ [ ] Quellen aktiviert, Host/Port gesetzt (oder mDNS-Vorbefüllung; ein eingetragener Host bleibt stehen)
+ [ ] Presenter-PIN eingetragen und mit „Setzen“ übernommen (falls Presenter genutzt)

- `` [ ] Ad-hoc-Nachricht getestet ``
+ [ ] Ad-hoc-Nachricht getestet (mit „Senden“ auf die Bühne, mit leerem „Senden“ wieder herunter)

### Caption

- `` Stil und Position der Untertitel im Panel ⚙ › Darstellung anpassen (Schrift, Zeilen, Band) ``
+ Stil und Position der Untertitel im Panel ⚙ › Darstellung anpassen (Schrift, Zeilen, Band). „Schrift“ (16 bis 160) und „Max. Äußerung (s)“ im Panel ⚙ › Erkennung (2 bis 15) gelten erst nach Enter oder beim Verlassen des Feldes; ein leeres Feld oder eine Zahl außerhalb der Grenzen wird nicht übernommen, unter dem Feld steht der Grund (etwa „Bitte eine Zahl eingeben.“ oder „Mindestens 16.“)

- `` Transkription starten (lokal mit der Haupttaste „Start“ oder CAPTION transcribe on) ``
- `` Bei Fehlern mit der Haupttaste „Hold“ bzw. CAPTION hold on einfrieren, die letzte Zeile per Doppelklick im Verlauf korrigieren, dann Hold wieder lösen („Hold ✓“ bzw. hold off) ``
- `` Die Haupttaste „Leeren“ bzw. CAPTION clear leert die Anzeige hart (z. B. vor einem neuen Sprecher) ``
+ Transkription starten (lokal mit der Haupttaste „Start“ oder CAPTION transcribe on). Scheitert das Mikrofon beim Start, endet die Transkription gleich wieder: Die Haupttaste steht auf „Start“, Companion sieht running=0, und unter den Haupttasten steht „Mikrofon: …“ mit dem Grund (etwa „Gerät nicht gefunden“), bis wieder gestartet wird; Caption startet nicht von selbst neu
+ Bei Fehlern mit der Haupttaste „Hold“ bzw. CAPTION hold on einfrieren, die jüngste Zeile per Doppelklick im Verlauf korrigieren (Enter oder ein Klick daneben übernimmt, Escape bricht ab und lässt den alten Text; kommen beim Tippen neue Zeilen dazu, trifft die Korrektur trotzdem die angeklickte Zeile), dann Hold wieder lösen („Hold ✓“ bzw. hold off)
+ Die Haupttaste „Leeren“ bzw. CAPTION clear leert die Anzeige hart (z. B. vor einem neuen Sprecher); bei Hold leert sie auch die NDI-Quelle, Hold bleibt an und hält das leere Bild

- `` Transkription stoppen (Haupttaste „Stopp“ bzw. CAPTION transcribe off), NDI bei Bedarf abschalten (Haupttaste „NDI an“ oder Schalter „Ausgabe“ im Panel ⚙ › NDI-Ausgabe) ``
+ Transkription stoppen (Haupttaste „Stopp“ bzw. CAPTION transcribe off), NDI bei Bedarf abschalten (Haupttaste „NDI an“ oder Schalter „Ausgabe“ im Panel ⚙ › NDI-Ausgabe). Auf dem Mac (nicht gemessen, Caption wird nur für Windows ausgeliefert): Schließt man das Fenster, endet die Transkription und Hold geht aus, auch für Companion; ein Klick aufs Dock öffnet das Fenster wieder, und solange es zu ist, lehnt Caption ein CAPTION transcribe on ab

+ | Transkription geht nach „Start“ gleich wieder aus, unter den Haupttasten steht „Mikrofon: …“ | Der Grund steht hinter „Mikrofon:“ (etwa „Gerät nicht gefunden“: das gewählte Gerät ist abgezogen oder heißt anders). Gerät im Panel ⚙ › Audiogerät prüfen oder neu wählen, dann „Start“; Caption versucht es nicht von selbst neu, Companion sieht so lange running=0. Fällt ein Mikrofon erst mitten im Lauf aus, meldet Caption das noch nicht: Pegel im Live-Bereich im Blick behalten |
+ | „Schrift“ oder „Max. Äußerung (s)“ wirkt nicht, unter dem Feld steht ein Grund | Der Wert ist leer, keine (ganze) Zahl oder außerhalb der Grenzen (Schrift 16 bis 160, Max. Äußerung 2 bis 15): korrigieren und mit Enter übernehmen; bis dahin gilt der alte Wert |

### Recorder

- `` Zielordner mit ausreichend Platz — die Aufnahme ist **WAV** (unkomprimiert; grob ~10 MB pro Kanal und Minute bei 48 kHz/24 bit). ``
+ Zielordner mit ausreichend Platz — die Aufnahme ist **WAV** (unkomprimiert, 32-bit Float, rund 11,5 MB je Kanal und Minute bei 48 kHz, doppelt mit „Spuren einzeln“ ab zwei Kanälen). Wie lange der Platz reicht, zeigt die Statusleiste „Platz“ (siehe Profi-Tipps).

- `` `RECORDER ARM` / `RECORDER DISARM` — Eingang öffnen/schließen (Pegel ohne Datei) ``
- `` `RECORDER RECORD ON` / `RECORDER RECORD OFF` / `RECORDER RECORD TOGGLE` — Aufnahme starten/stoppen/umschalten ``
- `` `STATE?` — Zustand abfragen. Gepushte STATE-Werte: `recording` (0/1), `armed` (0/1), `status` ``
+ `RECORDER ARM` / `RECORDER DISARM` — Eingang öffnen/schließen (Pegel ohne Datei). Während einer Aufnahme lehnt der Recorder beide ab, die Aufnahme läuft weiter; beenden geht nur mit `RECORD OFF` bzw. „Stopp“
+ `RECORDER RECORD ON` / `RECORDER RECORD OFF` / `RECORDER RECORD TOGGLE` — Aufnahme starten/stoppen/umschalten. Ist kein Zielordner gewählt oder wartet ein Netzwerkordner aus der Show noch auf „Übernehmen“, lehnt der Recorder den Start ab, statt am Rechner einen Ordnerdialog zu öffnen
+ `STATE?` — Zustand abfragen. Gepushte STATE-Werte: `recording` (0/1), `armed` (0/1), `status`. Ein abgelehnter Befehl ändert daran nichts; den Grund zeigt das Fenster als Meldung bis „OK“ (etwa „Companion „ARM“ abgelehnt: Erst die Aufnahme stoppen.“), dazu steht eine Zeile im Log

+ **Schließen:** Läuft eine Aufnahme, fragt der Recorder beim Schließen des Fensters „Aufnahme läuft. Wirklich beenden?“, als Fenster im Recorder-Fenster; die Aufnahme läuft dabei weiter. „Weiter aufnehmen“ lässt alles, wie es war, „Aufnahme beenden“ schließt die Datei sauber ab und beendet den Recorder. Antwortet das Fenster nicht binnen einer Sekunde, stellt der Recorder dieselbe Frage als Windows-Dialog („Weiter aufnehmen“ ist vorgewählt). Ohne Aufnahme schließt das Fenster wie bisher. Beim Abmelden oder Herunterfahren von Windows schließt der Recorder die Aufnahme ohne Frage sauber ab (nicht gemessen).
+ **Update:** Vor einem Update über den Launcher die Aufnahme stoppen: Das Update beendet den Recorder; die Datei bleibt bis zur Schließ-Anfrage abspielbar.

- `` **Getrennte Spuren** im Panel ⚙ › Ziel aktivieren, wenn hinterher gemischt wird — die Mono-WAVs pro Kanal landen direkt auf der DAW-Timeline. ``
- `` `RECORD TOGGLE` auf einen Companion-Button legen: ein Knopf für Start und Stopp, mit rückgemeldetem `recording`-Zustand als Tally. ``
- `` Zeitgesteuerte Aufnahme für Vorträge/Streams, die pünktlich beginnen — Startzeit in der Karte „Geplante Aufnahme“ setzen, der Recorder scharf lassen, fertig. ``
- `` Über eine **`.jmshow`** lassen sich Zielordner, Dateiname, getrennte Spuren, Kanäle und Samplerate pro Produktion vorbelegen (das Eingangsgerät bleibt bewusst lokal). ``
+ **Getrennte Spuren** im Panel ⚙ › Ziel aktivieren, wenn hinterher gemischt wird — die Mono-WAVs pro Kanal landen direkt auf der DAW-Timeline. Sie brauchen noch einmal so viel Platz wie die Aufnahme selbst.
+ Vor langen Mitschnitten auf die Statusleiste **„Platz“** schauen: Sie zeigt vor und während der Aufnahme, wie lange der freie Speicher im Zielordner für das eingestellte Format reicht (etwa „Platz für 2 h 10 min“), gelb unter 15 Minuten, rot unter 5 Minuten. Gesperrt wird nie, eine Aufnahme startet auch bei wenig Platz. Lässt sich der Platz nicht lesen (etwa ein NAS, das nicht binnen 3 Sekunden antwortet), steht „Platz unbekannt“ da. Ein Klick auf den Eintrag öffnet Panel ⚙ › Ziel.
+ `RECORD TOGGLE` auf einen Companion-Button legen: ein Knopf für Start und Stopp, mit rückgemeldetem `recording`-Zustand als Tally. Endet eine Aufnahme mit einem Fehler (Datenträger voll, Eingang weg), geht `recording` sofort auf 0.
+ Zeitgesteuerte Aufnahme für Vorträge/Streams, die pünktlich beginnen — Startzeit in der Karte „Geplante Aufnahme“ setzen, der Recorder scharf lassen, fertig. Ein Schreibfehler löscht auch die geplanten Start- und Stoppzeiten.
+ Über eine **`.jmshow`** lassen sich Zielordner, Dateiname, getrennte Spuren, Kanäle und Samplerate pro Produktion vorbelegen (das Eingangsgerät bleibt bewusst lokal). Ein Ordner auf einem Laufwerk gilt sofort; ein Netzwerkordner aus der Show gilt erst, wenn ihn jemand im Fenster mit „Übernehmen“ bestätigt, danach ist er gemerkt und geht beim nächsten Mal ohne Klick. Ein ungültiger Pfad wird nicht übernommen.

- `` | Companion startet nicht | Statusleiste „Fernsteuerung“ ansehen; Port 8729 offen? `jm-recorder-ctl` im mDNS sichtbar (sonst Adresse manuell eintragen)? | ``
- `` | WAV unvollständig/nicht abspielbar | Aufnahme sauber mit **Record OFF** beenden (Haupttaste „Stopp“) — die Datei wird erst beim Stopp finalisiert | ``
- `` | Platte voll mitten in der Aufnahme | Vorher Speicher prüfen; WAV ist groß — bei langen/mehrkanaligen Mitschnitten großzügig planen | ``
+ | Companion startet nicht | Statusleiste „Fernsteuerung“ ansehen; Port 8729 offen? `jm-recorder-ctl` im mDNS sichtbar (sonst Adresse manuell eintragen)? Steht im Fenster „Companion „…“ abgelehnt: …“? Dann nennt die Meldung den Grund: „Kein Zielordner gewählt.“ (Ordner wählen), „Der Netzwerkordner aus der Show ist noch nicht bestätigt.“ (im Hinweisband „Übernehmen“ drücken) oder „Erst die Aufnahme stoppen.“ (`ARM`/`DISARM` während der Aufnahme) |
+ | WAV unvollständig/nicht abspielbar | Aufnahme sauber mit **Record OFF** beenden (Haupttaste „Stopp“) — die Datei wird erst beim Stopp finalisiert. Fenster schließen während der Aufnahme fragt nach (siehe „Schließen“); Abmelden oder Herunterfahren von Windows schließt die Datei ohne Frage sauber ab (nicht gemessen) |
+ | Platte voll mitten in der Aufnahme | Vorher die Statusleiste „Platz“ ansehen (gelb unter 15 min, rot unter 5 min); WAV ist groß — bei langen/mehrkanaligen Mitschnitten großzügig planen. Läuft der Datenträger trotzdem voll, endet die Aufnahme sauber (siehe nächste Zeile) |
+ | „Schreibfehler“ oder „Kein Eingang“ statt „REC“ | Die Aufnahme ist mit einem Fehler sauber zu Ende gegangen: „REC“ ist aus, Companion sieht `recording` 0, die Datei bis dahin ist abgeschlossen (ließ sich auch ihr Dateikopf nicht mehr schreiben, etwa weil der USB-Stick abgezogen wurde, sagt die Meldung das). „Schreibfehler“: Datenträger voll, abgezogen oder Netzwerkordner weg. „Kein Eingang“: Vom Gerät kamen 2 Sekunden lang keine Audiodaten (Interface abgezogen, Treiber hängt); der Recorder schließt dann den Eingang selbst, Companion sieht `armed` 0. Der Grund steht als Meldung bis „OK“, im Statuseintrag „Aufnahme“ und an der Taste „Neu aufnehmen“. Der Fehler bleibt stehen, bis jemand neu aufnimmt, stoppt (Companion `RECORD OFF` quittiert ihn) oder den Eingang von Hand schließt; das Schließen durch den Recorder löscht ihn nicht. Ursache beheben: bei „Schreibfehler“ einen neuen Zielordner im Panel ⚙ › Ziel wählen, dann „Neu aufnehmen“; bei „Kein Eingang“ Gerät prüfen, Eingang wieder öffnen, dann neu aufnehmen |
+ | Hinweis „Die Show möchte in einem Netzwerkordner aufnehmen: …“ | Ist der Ordner bekannt, „Übernehmen“ drücken; danach ist er gemerkt. „×“ verwirft den Vorschlag, dann gilt wieder der Ordner von vorher. Bis dahin ist kein Ordner gesetzt, und Companion kann nicht starten |
+ | Preset mit Netzwerkordner wechselt den Ordner nicht sofort | Der Netzwerkordner eines Presets gilt erst, wenn seine Prüfung geantwortet hat; der Rest des Presets wirkt sofort, und ein nächstes Preset wartet nicht. Antwortet das NAS nicht (ausgeschaltet, Netz weg), gilt bis zur Antwort der Ordner von vorher, und die Preset-Auswahl zeigt „(geändert)“ |

### Presenter

- `` `PRESENTER BLACK` / `PRESENTER WHITE` — Pausenbild schwarz/weiß ``
+ `PRESENTER BLACK` / `PRESENTER WHITE` — Pausenbild schwarz/weiß. Ohne Zusatz oder mit `TOGGLE` holt ein zweiter Befehl die Folie zurück (wie bisher); mit `ON` bleibt das Bild an, auch beim zweiten Mal; mit `OFF` geht es zurück zur Folie, wenn das Bild an ist, sonst passiert nichts. In Companion (Modul ab 0.4.0) ist das die Option „Modus“ der Aktionen „Schwarz“ und „Weiß“: „Umschalten“ (Vorgabe), „An“ und „Aus“; für sicher schwarz die Taste auf „An“ stellen. Ein Presenter bis 0.15.0 schaltet bei jeder Wahl um

- `` `STOP` beendet die Präsentation (lokal „■ Beenden“ ganz rechts im Kopf des Referenten, bei schmalem Fenster als letzte Taste rechts in der Leiste, oder Esc außerhalb des Panels, im Editor „Beenden“ in der Werkzeugleiste); Projekt (.jmpres) mit „Speichern“ sichern, falls Overlays/Anpassungen erhalten bleiben sollen. ``
+ `STOP` beendet die Präsentation (lokal „■ Beenden“ ganz rechts im Kopf des Referenten, bei schmalem Fenster als letzte Taste rechts in der Leiste, oder Esc außerhalb des Panels, im Editor „Beenden“ in der Werkzeugleiste). Esc beendet die Präsentation sofort und ohne Rückfrage, im Referenten, im Publikumsfenster und in der Übersicht; im Panel schließt Esc das Panel. Projekt (.jmpres) mit „Speichern“ sichern, falls Overlays/Anpassungen erhalten bleiben sollen.

- `` `BLACK` auf einen Companion-Button — schneller sauberer „Vorhang" zwischen zwei Programmpunkten. ``
+ `BLACK` auf einen Companion-Button — schneller sauberer „Vorhang" zwischen zwei Programmpunkten. Für sicher schwarz die Taste auf „An“ stellen (Option „Modus“, `ON`): Ein zweiter Druck bleibt schwarz. Eine zweite Taste mit „Aus“ (`OFF`) holt die Folie zurück; „Umschalten“ (`TOGGLE`, Vorgabe) wirkt wie bisher.

### Connect

- `` „Meeting verlassen“ (bei laufenden Slots fragt der Knopf einmal nach) oder Connect über das Tray beenden. Beides verlässt das Meeting sauber; die Zoom-Quellen verschwinden aus dem Switcher. Gespeicherte Slots bleiben samt Einstellungen für das nächste Meeting; vorübergehende sind weg, und per ZOOM_LOAD nur für dieses Meeting eingeschaltete Slots sind wieder aus. ``
+ „Meeting verlassen“ (bei laufenden Slots fragt der Knopf einmal nach; „Ja, verlassen“ wirkt erst nach einer Sekunde, ein Doppelklick verlässt nicht) oder Connect über das Tray beenden. Beides verlässt das Meeting sauber; die Zoom-Quellen verschwinden aus dem Switcher. Gespeicherte Slots bleiben samt Einstellungen für das nächste Meeting; vorübergehende sind weg, und per ZOOM_LOAD nur für dieses Meeting eingeschaltete Slots sind wieder aus.

Freigabe: ☒ alle Texte wie hier, mit den Vorschlägen zu den Offenen Fragen 1 bis 3 (Owner 27.11.2026 10:00: „freigabe für texte und abnahme“) ☐ mit Änderungen (bitte je Nr. notieren)
