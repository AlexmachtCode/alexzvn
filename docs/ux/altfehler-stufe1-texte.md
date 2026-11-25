# Altfehler Runde 1, Stufe 1: Texte zur Freigabe durch den Owner

Zweck: Alle neuen sichtbaren Texte und Log-Zeilen der Stufe 1 (zehn Befunde in Player und Studio-Control) zur Freigabe durch den Owner. Dazu der Entwurf der Release-Notizen, die Änderungen in der Bedienung, die Entscheidungen, die Spec und Code offen ließen, und die offenen Fragen.

Stand: Branch `feat/altfehler`, Code-Stand `d459cef00d` (Aufgaben 1 bis 6 fertig und geprüft). Die Versionen sind Player 0.10.0 und Studio-Control 0.8.0; das Datum der Changelog-Einträge (25.11.2026) ist ein Platzhalter und wird am Tag der Veröffentlichung gesetzt. Nichts davon ist veröffentlicht.

Lesehilfe: ‹…› steht für den Teil, der sich zur Laufzeit ändert (eine Zahl, ein Name oder ein Pfad). Beispiel: „Cue ‹…› „‹…›“ spielt nicht: ‹…›“ erscheint als „Cue 3 „Intro“ spielt nicht: Datei fehlt oder ist nicht lesbar.“ Die Nummer (z. B. PLA5) nennst Du bitte bei jeder Änderung, die Du wünschst. Die Spalte „Ort“ nennt die Datei mit Zeile, in der der Text steht. Die Spalte „Befund“ nennt den Altfehler, zu dem der Text gehört.

Aufbau: je Werkzeug eine Tabelle („Player“, „Studio-Control“), die Log-Zeilen, dann „Changelog“, „Geänderte Bedienung“, „Entscheidungen“ und „Offene Fragen“.

## Player

Alle Texte stehen in `PLAYER_TEXTE` bzw. `SHOW_AUDIO_GRUND`. Hinweise erscheinen in der Hinweisleiste des Fensters (4 Sekunden); die Rückfragen kommen als Fenster mit „OK“ und „Abbrechen“, wie heute „Diese Show löschen?“.

| Nr. | Ort | Text | Befund |
| --- | --- | --- | --- |
| PLA1 | `apps/player/src/renderer/src/lib/oberflaeche.ts:47` (Hinweis, wenn Companion `CUE` oder `STANDBY` eine Nummer außerhalb der Show nennt) | „Companion „‹…› ‹…›“ abgelehnt: Die Show hat ‹…›.“ | PL-16a |
| PLA2 | `apps/player/src/renderer/src/lib/oberflaeche.ts:46` (letztes Wort von PLA1 bei einer leeren Show) | „keine Cues“ | PL-16a |
| PLA3 | `apps/player/src/renderer/src/lib/oberflaeche.ts:46` (bei genau einem Cue) | „1 Cue“ | PL-16a |
| PLA4 | `apps/player/src/renderer/src/lib/oberflaeche.ts:46` (bei mehreren Cues) | „‹…› Cues“ | PL-16a |
| PLA5 | `apps/player/src/renderer/src/lib/oberflaeche.ts:43` (Hinweis, wenn ein Ton-Cue beim GO nicht lädt; die Nummer zählt ab 1, der Name steht wie in der Cue-Zeile) | „Cue ‹…› „‹…›“ spielt nicht: ‹…›“ | PL-T14 |
| PLA6 | `apps/player/src/renderer/src/lib/show-audio.ts:7` (Grund in PLA5, wenn die Datei fehlt oder nicht lesbar ist) | „Datei fehlt oder ist nicht lesbar.“ | PL-T14 |
| PLA7 | `apps/player/src/renderer/src/lib/show-audio.ts:8` (Grund in PLA5, wenn sich die Datei nicht als Ton abspielen lässt) | „Datei lässt sich nicht als Ton abspielen.“ | PL-T14 |
| PLA8 | `apps/player/src/renderer/src/lib/oberflaeche.ts:36` (Rückfrage beim Entfernen eines Cues, solange die Show läuft) | „Die Show läuft. Cue ‹…› „‹…›“ trotzdem entfernen?“ | PL-10 |
| PLA9 | `apps/player/src/renderer/src/lib/oberflaeche.ts:40` (Rückfrage beim Entfernen eines Mediums aus der Bibliothek, das Cues oder Pads benutzen; das zweite ‹…› ist PLA10 bis PLA14) | „‹…› wird von ‹…› benutzt. Trotzdem aus der Bibliothek entfernen? Dort steht danach „Medium fehlt“.“ | PL-10 |
| PLA10 | `apps/player/src/renderer/src/lib/oberflaeche.ts:39` (Teil von PLA9, genau ein Cue) | „1 Cue“ | PL-10 |
| PLA11 | `apps/player/src/renderer/src/lib/oberflaeche.ts:39` (Teil von PLA9, mehrere Cues) | „‹…› Cues“ | PL-10 |
| PLA12 | `apps/player/src/renderer/src/lib/oberflaeche.ts:39` (Teil von PLA9, genau ein Pad) | „1 Pad“ | PL-10 |
| PLA13 | `apps/player/src/renderer/src/lib/oberflaeche.ts:39` (Teil von PLA9, mehrere Pads) | „‹…› Pads“ | PL-10 |
| PLA14 | `apps/player/src/renderer/src/lib/oberflaeche.ts:40` (Verbindung in PLA9, wenn Cues und Pads das Medium benutzen: „2 Cues und 1 Pad“) | „ und “ | PL-10 |

## Studio-Control

Alle Texte stehen in `STUDIO_TEXTE.browserZugang`. Der Abschnitt steht im Panel hinter ⚙ (nur im App-Fenster, nicht im Browser), unter „Fernsteuerung“. Er nennt nur den Ort der Datei, nie das Passwort. SCA5 und SCA6 sind die Pille am Abschnitt und nur vorläufig im Code (siehe Offene Frage 2).

| Nr. | Ort | Text | Befund |
| --- | --- | --- | --- |
| SCA1 | `apps/studio-control/src/renderer/src/lib/oberflaeche.ts:79` (Titel des Abschnitts) | „Browser-Zugang“ | SC-S1 |
| SCA2 | `apps/studio-control/src/renderer/src/lib/oberflaeche.ts:81` (Satz, solange die Datei mit dem Erst-Passwort besteht; ‹…› ist der Pfad der Datei) | „Das Erst-Passwort für „Admin“ steht in der Datei ‹…›. Nach der ersten Anmeldung das Passwort ändern und die Datei löschen.“ | SC-S1 |
| SCA3 | `apps/studio-control/src/renderer/src/lib/oberflaeche.ts:82` (Satz, wenn es die Datei nicht gibt) | „Keine Datei mit Erst-Passwort vorhanden. Konten verwaltet Setup › Benutzer.“ | SC-S1 |
| SCA4 | `apps/studio-control/src/renderer/src/lib/oberflaeche.ts:83` (Satz, solange der Hauptprozess noch nicht geantwortet hat) | „Ort der Passwort-Datei unbekannt.“ | SC-S1 |
| SCA5 | `apps/studio-control/src/renderer/src/lib/oberflaeche.ts:85` (Pille am Abschnitt, gelb, solange die Datei besteht; vorläufig, Offene Frage 2) | „Datei vorhanden“ | SC-S1 |
| SCA6 | `apps/studio-control/src/renderer/src/lib/oberflaeche.ts:86` (Pille am Abschnitt, grün, ohne Datei; vorläufig, Offene Frage 2) | „keine Datei“ | SC-S1 |

## Log-Zeilen

Diese Zeilen stehen im Log der App (Logordner), nicht im Fenster. Studio-Control schreibt in dieser Stufe keine neuen Log-Zeilen; abgewiesene Anfragen antworten mit HTTP 403 und `{"error":"origin"}`, das ist kein Text für Menschen.

| Nr. | Ort | Text | Befund |
| --- | --- | --- | --- |
| LOG1 | `apps/player/src/main/output-window.ts:21` (einmal je Ausgabefenster, wenn es nach 5 Sekunden nicht „bereit“ meldet; der Befehl geht dann trotzdem hinaus) | „Ausgabefenster meldete nicht bereit (‹…› ms)“ | PL-N |
| LOG2 | `apps/player/src/renderer/src/lib/fernbefehl.ts:14` (Gegenstück zu PLA1) | „Fernbefehl abgelehnt: ‹…› ‹…› (Show hat ‹…› Cues)“ | PL-16a |
| LOG3 | `apps/player/src/renderer/src/store/player.ts:591` (Gegenstück zu PLA5, dazu der Pfad der Datei) | „‹…› (‹…›)“ | PL-T14 |

## Changelog

Entwurf der Release-Notizen (`packages/suite-manifest/changelog.json`), wörtlich wie dort. Das Datum ist ein Platzhalter.

| Nr. | App, Version | Text |
| --- | --- | --- |
| CL-PL1 | Player 0.10.0 | „GO auf einen Video-Cue spielt jetzt auch, wenn die Ausgabe noch geschlossen ist. Es bleibt bei einem Ausgabefenster, auch nach schnellem Schließen und Öffnen.“ |
| CL-PL2 | Player 0.10.0 | „Die Pause hält jetzt auch die Vorlaufzeit an, Weiter setzt sie fort. Ein Ton-Cue, der nicht lädt, meldet das im Fenster und gilt nicht mehr als laufend.“ |
| CL-PL3 | Player 0.10.0 | „Pad-Tasten lösen mit Strg, Alt oder Cmd und bei offenem Dialog oder Panel nicht mehr aus. Beim Löschen anderer Cues bleibt der Standby auf seinem Cue; eine Rückfrage kommt beim Entfernen eines benutzten Mediums und beim Löschen eines Cues während der Show.“ |
| CL-PL4 | Player 0.10.0 | „Companion: CUE und STANDBY mit einer Nummer außerhalb der Show werden abgelehnt, der Standby bleibt stehen.“ |
| CL-SC1 | Studio-Control 0.8.0 | „Ohne Anmeldung ist nur noch das eigene Fenster Admin. Browser und Programme melden sich mit einem Konto an, auch auf demselben Rechner; fremde Webseiten werden abgewiesen.“ |
| CL-SC2 | Studio-Control 0.8.0 | „Companion-Gateway: Steht die Suite auf „secure“, braucht Companion jetzt den Schlüssel.“ |
| CL-SC3 | Studio-Control 0.8.0 | „Das Einstellungs-Panel nennt unter Browser-Zugang den Ort der Datei mit dem Erst-Passwort.“ |

## Geänderte Bedienung

Je Befund ein Satz, was Du anders erlebst.

- PL-N: GO auf einen Video-Cue spielt auch bei geschlossener Ausgabe (das Fenster öffnet sich und das Video startet), und ein Fenster, das nicht antwortet, hält den Befehl höchstens 5 Sekunden auf.
- PL-T13: Schnelles Schließen und Wieder-Öffnen der Ausgabe erzeugt nie zwei Ausgabefenster.
- PL-11: In der Pause startet ein Cue mit Vorlaufzeit angehalten, und „Weiter“ lässt die Vorlaufzeit weiterlaufen; Pause hält die Vorlaufzeiten jetzt an.
- PL-16a: Ein Companion-Befehl `CUE` oder `STANDBY` mit einer Nummer außerhalb der Show wird mit einem Hinweis abgelehnt, der Standby bleibt stehen.
- PL-T14: Ein Ton-Cue, der nicht lädt, zeigt den Hinweis PLA5, gilt nicht als laufend, und die Pause bleibt, wie sie vor dem GO war.
- PL-4: Pad-Tasten lösen mit Strg, Alt oder Cmd nicht aus und auch nicht, solange ein Dialog oder das Panel offen ist oder der Cursor in einem Feld steht.
- PL-10: Der Standby bleibt auf seinem Cue, wenn andere Cues gelöscht oder umsortiert werden, und zwei Rückfragen kommen neu (PLA8, PLA9).
- SC-S3: Das Companion-Gateway richtet sich nach dem Modus in `control.json`; im Modus „secure“ braucht Companion den Schlüssel.
- SC-S1: Das Panel nennt unter „Browser-Zugang“ den Ort der Datei mit dem Erst-Passwort, solange sie besteht.
- SC-S2: Ohne Anmeldung ist nur noch das eigene App-Fenster Admin; Browser und Programme brauchen ein Konto, fremde Webseiten bekommen HTTP 403.

## Entscheidungen

Wo Spec und Code schwiegen, steht hier, was gilt. Du kannst jede umstoßen.

- A1 (PL-11): Ein GO in der Pause auf einen Cue mit Vorlaufzeit startet die Vorlaufzeit angehalten; sie läuft mit „Weiter“. Ein GO auf einen Cue ohne Vorlaufzeit startet wie heute sofort und hebt die Pause auf.
- A2 (PL-T14): Nach einem Ladefehler gibt es kein automatisches Weiterschalten; der Standby steht schon auf dem nächsten Cue. Die Pause bleibt, wie sie war.
- A3 (PL-T14, PL-16a): Die Meldung im Fenster ist die bestehende Hinweisleiste (4 Sekunden), die Log-Zeile geht ins Log der App.
- A4 (PL-10): Die Rückfragen sind normale Fenster mit „OK“ und „Abbrechen“. Der Standby folgt seinem Cue auch beim Umsortieren; wird der Standby-Cue selbst gelöscht, steht er danach auf dem nächsten.
- A5 (PL-N): Auf „bereit“ wird höchstens 5 Sekunden gewartet, danach geht der Befehl trotzdem hinaus und das Log bekommt eine Zeile.
- A6 (PL-4): Ein Pad löst auch mit gedrückter Umschalttaste aus; nur Strg, Alt und Cmd sperren.
- A7 (SC-S2): Das Fenster-Geheimnis hat 32 Zufallsbytes, gilt je Start und geht nur an die eigene Seite des Hauptfensters.
- A8 (SC-S2): Als eigen gelten Anfragen ohne Herkunft (Programme, sie brauchen ein Konto), vom Server selbst und das App-Fenster; nur ohne Installation kommt die Entwicklungsadresse dazu. Alles andere bekommt 403.
- A9 (SC-S1): Der Abschnitt „Browser-Zugang“ nennt den Pfad, solange die Datei besteht, und wird beim Öffnen des Panels gemessen. Anmeldung und Konto beim ersten Start bleiben.
- A10: Neue Versionen: Player 0.9.1 → 0.10.0, Studio-Control 0.7.0 → 0.8.0.
- R5: Die 5 Sekunden Wartezeit gelten je Fenster, nicht je Befehl; nach dem ersten Ablauf wartet das Fenster nicht mehr, und das Log bekommt die Zeile nur einmal.
- R8: Stoppt, panikt oder startet man während des Wartens auf ein Ausgabefenster etwas anderes, startet das Video dort nicht mehr nachträglich.
- R9: Nach einem Ladefehler kehrt die Pause nur zurück, wenn dieser Start noch der letzte der Show ist (kein Stop, keine Panik, kein neuer Start dazwischen).
- R13: Das Fenster-Geheimnis geht nur an genau die Datei, die das App-Fenster lädt, nicht an jede Seite namens `index.html`.

## Offene Fragen

Hier entscheidest Du.

1. AltGr auf deutschen Tastaturen: AltGr ist für Windows Strg und Alt zugleich. Deshalb löst ein Pad auf `@`, `€`, `{`, `[`, `\`, `~` oder `|` nicht mehr aus, obwohl das Tastenfeld solche Tasten weiter annimmt. Entweder darf AltGr für Pads erlaubt werden (dann löst auch ein Strg+Alt-Kürzel aus), oder das Tastenfeld weist solche Tasten ab. Empfehlung: das Tastenfeld weist sie ab, weil Strg+Alt nie Pads auslösen soll.
2. Pille im Abschnitt „Browser-Zugang“ (SCA5, SCA6): behalten oder streichen? Ohne Pille stehen nur Titel und Satz. Mit Pille ist „Datei vorhanden“ gelb, „keine Datei“ grün.

## Handbuch

Die zwei Handbücher im Kochbuch (Player, Studio-Control) nennen jetzt die geänderte Bedienung, in den Worten der Crew: was man sieht und tut. Je Stelle steht oben der alte Wortlaut (`-`), darunter der neue (`+`); Stellen, die es vorher nicht gab, haben nur `+`-Zeilen. Der Kochbuch-Bau (`npm run cookbook:build`) hat `packages/cookbook/cookbook.json` neu erzeugt.

### Player

- `` `PLAYER CUE <Nr.>` — einen bestimmten Show-Cue direkt feuern ``
+ `PLAYER CUE <Nr.>` — einen bestimmten Show-Cue direkt feuern. Nennt `CUE` oder `STANDBY` eine Nummer, die es in der Show nicht gibt (null, zu groß oder die Show ist leer), lehnt der Player den Befehl ab: Im Fenster erscheint kurz der Hinweis „Companion „CUE 99“ abgelehnt: Die Show hat 4 Cues.“, der Standby bleibt, wo er war, und das nächste `GO` feuert weiter den bisherigen Standby-Cue

+ Beim Aufräumen: Der Standby bleibt auf seinem Cue, wenn man andere Cues löscht oder umsortiert (wird der Standby-Cue selbst gelöscht, steht er danach auf dem nächsten). Der Player fragt nach, wenn man mit ✕ einen Cue löscht, während in der Show etwas läuft („Die Show läuft. Cue 3 „Intro“ trotzdem entfernen?“), und wenn man ein Medium mit ✕ aus der Bibliothek entfernt, das Cues oder Pads benutzen („‹Titel› wird von 2 Cues und 1 Pad benutzt. Trotzdem aus der Bibliothek entfernen? Dort steht danach „Medium fehlt“.“); „Abbrechen“ lässt alles, wie es war

- `` Soundboard-Pads im Reiter „Soundboard“ für Applaus/Stinger/Jingle sofort auslösen (`PAD <Slot>`) ``
- `` `PAUSE` für kurze Unterbrechung, `STOP` beendet sauber, `PANIC` bei Bedarf hart abwürgen (lokal die Haupttasten „❚❚ Pause“, „■ Stop“ und „⛔ Panik“ im Transport der Cue-Show; „■ Stop“ und „⛔ Panik“ stehen auch in der Fußleiste von Bibliothek und Soundboard, Panik stoppt jetzt auch die Pads) ``
+ Soundboard-Pads im Reiter „Soundboard“ für Applaus/Stinger/Jingle sofort auslösen (`PAD <Slot>`). Die Pad-Taste löst nur eine einzelne Taste aus: Mit Strg, Alt (damit auch AltGr, etwa für @ oder €) oder Cmd gedrückt bleibt das Pad stumm, damit Strg+C oder ein Fenster-Kürzel keinen Ton auf die PA schickt. Auch solange ein Pad-Dialog oder das Einstellungs-Panel ⚙ offen ist oder der Cursor in einem Feld steht, löst keine Taste ein Pad aus; Umschalttaste (Großbuchstabe) sperrt nicht
+ Ein `GO` auf einen Video-Cue spielt auch dann, wenn das Ausgabefenster noch zu ist: Der Player öffnet es und startet das Video, sobald es bereit ist (höchstens 5 Sekunden Wartezeit, dann geht der Befehl trotzdem hinaus). Es gibt immer nur ein Ausgabefenster, auch wenn man „Ausgabe“ schnell aus- und wieder einschaltet
+ `PAUSE` für kurze Unterbrechung: Sie hält laufende Cues und auch die Vorlaufzeit (Pre-Wait) noch nicht gestarteter Cues an; „▶ Weiter“ setzt beides fort, und eine angefangene Vorlaufzeit läuft mit der Restzeit weiter, nicht von vorn. Ein `GO` mitten in der Pause auf einen Cue mit Vorlaufzeit stellt ihn an, lässt ihn aber warten, bis „▶ Weiter“ gedrückt wird; ein `GO` auf einen Cue ohne Vorlaufzeit startet sofort und hebt die Pause auf. `STOP` beendet sauber, `PANIC` bei Bedarf hart abwürgen (lokal die Haupttasten „❚❚ Pause“, „■ Stop“ und „⛔ Panik“ im Transport der Cue-Show; „■ Stop“ und „⛔ Panik“ stehen auch in der Fußleiste von Bibliothek und Soundboard, Panik stoppt jetzt auch die Pads)

- `| Kein Ton/Bild beim GO | Ton: richtiges Standard-Wiedergabegerät in Windows (der Player hat keine eigene Wahl)? Video: Statusleiste „Video-Ausgabe“ und Panel ⚙ › Ausgabe auf Bildschirm prüfen (Pille und „Steht auf“ nennen den Bildschirm, auf dem das Fenster wirklich steht; nach dem Wiederanstecken bleibt „Bildschirm fehlt“ stehen, bis „Auf diesen Bildschirm“ das Fenster verschiebt oder es neu geöffnet wird). Kabel/Pegel am Mischer prüfen |`
+ | Kein Ton/Bild beim GO | Video bei geschlossener Ausgabe: Das erste `GO` öffnet das Fenster und spielt (das Fenster braucht dafür einen Moment, bis 5 Sekunden). Ton: richtiges Standard-Wiedergabegerät in Windows (der Player hat keine eigene Wahl)? Video: Statusleiste „Video-Ausgabe“ und Panel ⚙ › Ausgabe auf Bildschirm prüfen (Pille und „Steht auf“ nennen den Bildschirm, auf dem das Fenster wirklich steht; nach dem Wiederanstecken bleibt „Bildschirm fehlt“ stehen, bis „Auf diesen Bildschirm“ das Fenster verschiebt oder es neu geöffnet wird). Kabel/Pegel am Mischer prüfen |

- `| Soundboard-Pad reagiert nicht | Richtiger Slot? Datei in der Bibliothek vorhanden/lesbar? |`
+ | Soundboard-Pad reagiert nicht | Richtiger Slot? Datei in der Bibliothek vorhanden/lesbar? Per Tastatur: Ist Strg, Alt oder Cmd gedrückt, ein Pad-Dialog oder das Panel ⚙ offen oder der Cursor in einem Feld? Dann löst die Taste bewusst nichts aus |
+ | Ton-Cue klingt nicht, Hinweis „Cue 3 „Intro“ spielt nicht: …“ | Der Grund steht im Hinweis (zum Beispiel „Datei fehlt oder ist nicht lesbar.“): Datei in der Bibliothek prüfen und neu zuweisen. Der Cue zählt nicht als laufend (kein ON AIR, kein „1 laufend“), der Standby steht schon auf dem nächsten Cue, und eine Pause bleibt so, wie sie vor dem `GO` war; die Zeile mit dem Pfad steht im Log der App |
+ | Companion-Knopf `CUE`/`STANDBY` tut nichts | Hinweis „Companion … abgelehnt: Die Show hat …“ im Fenster? Die Nummer gibt es in der Show nicht; Knopf auf eine vorhandene Nummer (ab 1) umstellen |

### Studio-Control

+ Anmeldung: Ohne Anmeldung ist nur das eigene App-Fenster Admin. Ein Browser, auch der auf demselben Rechner wie Studio Control (`http://localhost:7778/`), und jedes Programm melden sich mit einem Konto an. Anfragen von fremden Webseiten (eine andere Herkunft als der Server selbst) weist Studio Control mit „403“ ab.

+ Companion und „secure“: Das Gateway richtet sich nach dem Modus der Suite (`control.json`, im Panel ⚙ › Fernsteuerung). Steht die Suite auf „secure“, nimmt es Befehle nur mit dem Schlüssel der Suite an; Companion braucht dann den Schlüssel. Auf „open“ geht es wie bisher ohne.

+ Beim ersten Start legt Studio Control das Konto „Admin“ mit einem Erst-Passwort an, das in einer Datei neben den Einstellungen des Programms liegt. Das Panel ⚙ › Abschnitt „Browser-Zugang“ (nur im App-Fenster, unter „Fernsteuerung“) nennt den Ort dieser Datei, solange es sie gibt, nie das Passwort selbst. Nach der ersten Anmeldung das Passwort ändern und die Datei löschen; danach steht dort „Keine Datei mit Erst-Passwort vorhanden.“
+ Für das Tablet oder einen Browser am Regie-Rechner: `http://‹IP›:7778/` öffnen (Tray › „LAN-URLs“) und mit einem Konto aus Setup › Benutzer anmelden; nur das Fenster der App selbst braucht keine Anmeldung

- `| Companion-Gateway reagiert nicht | Im App-Fenster Statusleiste „Fernsteuerung“ bzw. Panel ⚙ › Fernsteuerung ansehen (bereit, Port belegt, Fehler; das Gateway hat keinen eigenen Schalter); Port 8735 (jm-studio-control-ctl) erreichbar? |`
+ | Browser oder Programm bekommt keinen Zugriff, auch am Regie-Rechner | Mit einem Konto aus Setup › Benutzer anmelden (die Anmeldung gilt auch auf demselben Rechner). Antwort „403“ heißt: Die Seite kommt nicht vom Server selbst (fremde Webseite) und wird abgewiesen; die Adresse `http://‹IP›:7778/` direkt öffnen |
+ | Passwort für „Admin“ vergessen oder unbekannt | Im App-Fenster Panel ⚙ › „Browser-Zugang“: Dort steht der Ort der Datei mit dem Erst-Passwort, solange sie besteht. Steht dort „Keine Datei …“, ein anderes Admin-Konto in Setup › Benutzer nutzen |
+ | Companion-Gateway reagiert nicht | Im App-Fenster Statusleiste „Fernsteuerung“ bzw. Panel ⚙ › Fernsteuerung ansehen (bereit, Port belegt, Fehler; das Gateway hat keinen eigenen Schalter); steht die Suite auf „secure“, braucht Companion den Schlüssel, ohne ihn lehnt das Gateway ab; Port 8735 (jm-studio-control-ctl) erreichbar? |

+ [ ] Erst-Passwort geändert und die Datei gelöscht (Panel ⚙ › „Browser-Zugang“ zeigt „Keine Datei …“)

Freigabe: ☐ alle Texte wie hier ☐ mit Änderungen (bitte je Nr. notieren)
