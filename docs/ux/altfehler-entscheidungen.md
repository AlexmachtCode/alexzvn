# Altfehler Runde 1, Stufe 1 und Stufe 2: Entscheidungen und vermerkte Kleinigkeiten

Stufe 1 (Player, Studio-Control) steht in den Abschnitten 1 bis 5, Stufe 2 (Player 0.10.1, Interpreter, Stage Display, Caption, Recorder, Presenter mit Companion-Modul, Connect) im Teil „Stufe 2“ ab Abschnitt 6.

Für wen: spätere Entwickler, die an Player oder Studio-Control weiterarbeiten. Hier steht, was in dieser Stufe entschieden wurde, wo Spec und Code schwiegen, mit dem Grund und dem, was es kostet, wenn die Entscheidung falsch war. Der Owner hat A1 bis A10 zur Kenntnis bekommen (Texttabelle `docs/ux/altfehler-stufe1-texte.md`, Abschnitt „Entscheidungen“); die Rulings R1 bis R21 hat der Controller während der Umsetzung und nach der Gesamtprüfung getroffen. Danach das Ergebnis der Gesamtprüfung mit ihrer Fix-Welle, jede Kleinigkeit, die ein Prüfer vermerkt hat (behoben oder nicht), und die Kandidaten für eine spätere Runde.

Quellen: Spec `docs/superpowers/specs/2026-11-25-altfehler-runde1-design.md`, Plan `docs/superpowers/plans/2026-11-25-altfehler-stufe1.md`, Befunde `docs/ux/altfehler-inventar.md`. Die Befund-Kürzel (PL-N, SC-S2 und so weiter) sind die IDs aus dem Inventar. Pfade sind relativ zu `apps/<app>/src/`; `R/` steht für `renderer/src/`.

## 1. Entscheidungen des Plans (A1 bis A10)

| # | Befund | Entschieden | Grund | Kostet, wenn falsch |
| --- | --- | --- | --- | --- |
| A1 | PL-11 | Ein GO in der Pause auf einen Cue mit Vorlauf startet den Vorlauf angehalten; er läuft mit „Weiter“ weiter. Ein GO auf einen Cue ohne Vorlauf startet wie heute sofort und hebt die Pause auf; dann laufen auch angehaltene Vorläufe weiter. | Spec: „In der Pause startet kein Cue von selbst.“ | Ein Bediener, der in der Pause gezielt einen Cue mit Vorlauf feuert, muss „Weiter“ drücken; der Cue läuft dann nicht von selbst an. |
| A2 | PL-T14 | Nach einem Ladefehler gibt es kein automatisches Weiterschalten (Auto-Continue); der Standby steht schon auf dem nächsten Cue. Die Pause bleibt, wie sie vor dem Start war. | Ein stiller Sprung auf den nächsten Cue wäre ein zweiter, unsichtbarer Start. | Eine Show, die nach einem fehlenden Ton von selbst weiterlaufen sollte, bleibt stehen; der Bediener drückt GO. |
| A3 | PL-T14, PL-16a | Die Meldung im Fenster ist die bestehende Hinweisleiste (`notice`, 4 Sekunden). Die Log-Zeile geht über den neuen Kanal `player:protokoll` an `getLog().warn`. | Keine neue Anzeige für zwei Fälle; das Log erreicht der Renderer nur über IPC. | Ein Hinweis, der nach 4 Sekunden verschwindet, kann überlesen werden; dann hilft nur das Log. |
| A4 | PL-10 | Rückfragen kommen per `window.confirm`, wie heute „Diese Show löschen?“ (**für die zwei neuen Rückfragen ersetzt durch R16**; es gilt weiter für „Show löschen“). Der Standby folgt seinem Cue auch beim Umsortieren. Wird der Standby-Cue selbst gelöscht, steht der Standby wie heute auf dem Cue danach. | Gleiches Muster wie die bestehende Rückfrage; eine eigene Dialogkomponente wäre ein neues Bedienelement. | `window.confirm` blockiert den Renderer, solange die Rückfrage offen ist (wie schon „Show löschen“); bei einer späteren eigenen Dialogkomponente sind drei Aufrufstellen umzustellen. Eingetreten: Die Gesamtprüfung fand genau das als Show-Risiko, R16 stellte zwei der drei um. |
| A5 | PL-N | Auf „bereit“ des Ausgabefensters wird höchstens 5000 ms gewartet. Danach geht der Befehl trotzdem hinaus, und das Log bekommt eine Zeile. Das gilt auch für ein Fenster, das per Panel offen ist und noch lädt. | Eine harte Obergrenze statt einer Hängepartie; ein Befehl geht nie verloren. | Ein sehr langsames Fenster bekommt den Befehl vor seinem Abo (wie vor dieser Stufe). |
| A6 | PL-4 | Ein Pad löst auch bei gedrückter Umschalttaste aus; nur Strg, Alt und Meta sperren. | Die Spec nennt nur diese drei. | Umschalt+Taste löst ein Pad aus, obwohl ein Bediener das nicht erwartet; ein Wächter müsste `shiftKey` ergänzen. |
| A7 | SC-S2 | Das Fenster-Geheimnis hat 32 Zufallsbytes als Hex und gilt je Start. `studio:fensterGeheimnis` gibt es nur an die Webinhalte des Hauptfensters, nur im Hauptrahmen und nur auf der eigenen Seite (`file://…/renderer/index.html` oder im Dev die Vite-Adresse). Das Fenster schickt es als `X-JMS-Fenster` bzw. `auth.fenster`; `Authorization` geht weiter mit, damit Logout die Sitzung widerruft. | Wer das Geheimnis nicht hat, ist auch auf demselben Rechner nicht Admin; ohne den Token-Kopf liefe der Logout ins Leere. | Eine Seite, die das Geheimnis liest, hätte Admin-Rechte. Verschärfung durch R13. |
| A8 | SC-S2 | Als eigen gilt: kein `Origin` (Programme, sie brauchen ein Konto) und `Origin` gleich `http://` + `Host` (Browser vom Server selbst, ohne Groß/Klein); `null` und `file://` (das App-Fenster; ohne Geheimnis bleibt nur die Anmeldung). Nur ohne Paket (`!app.isPackaged`) kommen die Vite-Adressen `http://localhost:5174`, `http://127.0.0.1:5174` und der Ursprung von `ELECTRON_RENDERER_URL` dazu. Alles andere: HTTP 403 `{"error":"origin"}`; Socket.IO lehnt per `allowRequest` ab. | Browser auf einem anderen Gerät schicken Origin und Host mit derselben Adresse, also funktioniert die Anmeldung dort weiter. | Ein Browser, der hinter einem Namens-Proxy mit abweichendem `Host` hängt, wird abgewiesen; ein Programm ohne Origin wird nicht abgewiesen, aber auch nicht Admin. |
| A9 | SC-S1 | Der Panel-Abschnitt „Browser-Zugang“ nennt den Pfad der Erst-Passwort-Datei, solange die Datei besteht; gemessen wird beim Öffnen des Panels. Anmeldung und Konto beim ersten Start bleiben, weil die Messung in Task 5 kein bekanntes oder leeres Passwort fand. | Die Spec verlangt die Anzeige nur, wenn die Messung eine Lücke findet. | Fände eine spätere Messung doch ein bekanntes Passwort, wäre der Hinweis zu wenig und die Anmeldung müsste angepasst werden. |
| A10 | alle | Neue Versionen: Player 0.9.1 → 0.10.0, Studio-Control 0.7.0 → 0.8.0 (Minor, drei bis vier Release-Notizen). | Sichtbar geänderte Bedienung, nicht nur Fehlerkorrektur. | Eine falsche Zählung kostet nichts außer einem umzubenennenden Tag; die Versionen stehen noch in keinem Katalog. |

## 2. Rulings des Controllers (R1 bis R21)

| # | Betrifft | Entschieden | Grund | Kostet, wenn falsch |
| --- | --- | --- | --- | --- |
| R1 | Task 2 gegen Task 3 (`startNow`) | Schlägt beim Start eines Ton-Cues das Laden fehl und war die Show vorher pausiert, setzt Task 3 `showPaused` wieder auf `true` und ruft `vorlaeufe.anhalten()`. A2 („Die Pause bleibt, wie sie war“) geht vor. Die Tonmaschine ist dann noch angehalten, weil `play` vor `ctx.resume()` scheitert. | Task 2 hebt die Pause bei jedem Start auf; Task 3 verlangt das Gegenteil nach einem Fehler. | Ein Vorlauf, der in den Millisekunden zwischen Start und Fehler fällig wird, startet trotzdem. Präzisiert durch R9. |
| R2 | Task 7 | Task 7 darf `npm install --ignore-scripts --package-lock-only` ausführen. „Kein npm install“ meint neue Abhängigkeiten und `node_modules`, nicht den Versions-Eintrag im Lock. | Die neuen Versionen stehen auch in `package-lock.json`. | Nichts: `node_modules` bleibt unberührt (danach Link-Prüfung). |
| R3 | Tests der Hauptprozess- und Preload-Dateien | Wächter-Tests am Quelltext sind für Electron-Hauptprozess und Preload erlaubt, weil `tsx` dort nicht ausführt (`better-sqlite3`, `electron`). Das Verhalten belegen die reinen Module und die Echt-Fenster-Messung. | Anders ist dieser Code in den Selbsttests nicht erreichbar. | Ein Wächter hält eine Form fest, die eine spätere Umstellung mit anpassen muss (siehe die vermerkten Kleinigkeiten zu Wächtern unten). |
| R4 | Task 1, Messung | Das Test-MP4 darf mit dem `ffmpeg-static` der Hauptkopie erzeugt werden (nur ausführen, Ausgabe in den Scratchpad). | Gleiche Regel wie für das Electron der Hauptkopie (nur lesend). | Nichts am Repo; die Hauptkopie bleibt unverändert. |
| R5 | Task 1, A5 | Die Wartegrenze gilt je Fenster, nicht je Befehl. Nach dem ersten Ablauf gilt das Fenster als bereit, weitere Befehle warten nicht; die Log-Zeile kommt einmal je Fenster. | Sonst wären es bei GO mit geschlossener Ausgabe zehn statt fünf Sekunden. | Ein Fenster, das später doch noch lädt, bekommt Befehle vor seinem Abo (wie vor dieser Stufe). |
| R6 | Task 1, Funktionsliste Player | Der Verweis „Altfehler ‹ID›“ wird an Dateien gebunden (Liste je ID, wie `ERLAUBT` in Studio-Control): Eine Zeile „unverändert (…)“ mit geänderter Datei gilt nur, wenn sie eine ID nennt, deren Liste diese Datei enthält. | Sonst nähme die Regel jede Änderung unter beliebiger ID hin. | Etwas mehr Pflege in den folgenden Tasks. |
| R7 | Task 1, Brief-Pfad | `JmplayApi` steht in `src/shared/types.ts`, nicht in `R/jmplay.d.ts`; die Änderung gehört dorthin. `ipc.ts:83` und `:90` geben das Promise schon zurück. Die Anpassung des Hash-Wächters in `rahmen.test.tsx` und der Funktionslisten-Zeilen 102/103/120–129 gehört zur Regel „Funktionslisten-Tests bleiben grün“. | Der Brief war ungenau. | Nichts. |
| R8 | Task 1, PL-N, Umfang | Task 1 darf `R/store/player.ts` im Video-Zweig von `startNow` ändern: `load` nach `open` nur, wenn der Cue noch der laufende Video-Cue ist. | Panik, Stop oder ein zweites GO während des Wartens auf „bereit“ ließen sonst das Video ohne ON AIR laufen; die Spec verlangt, dass ON AIR an das echte Abspielen gebunden bleibt. | Nichts außerhalb von PL-N. |
| R9 | Task 3, präzisiert R1 | Die Pause wird nach einem Ladefehler nur wiederhergestellt (und die Cue-ID nur entfernt), solange dieser Start noch der letzte Start der Show ist (Start-Kennung wie `dieserStart` im Video-Zweig; Stop, Panik und jeder neue Start lösen sie ab). | „Pause folgt Wirklichkeit“ (A1) geht vor; ohne die Kennung hinge die Wiederherstellung nur an der Cue-ID. | Nach einem späten Fehler bleibt die Pause aufgehoben, obwohl nichts klingt (sichtbar als „läuft“ ohne Ton bis zum nächsten Druck). |
| R10 | Testbauten | Die Testbauten (`win-unpacked`) beider Apps entstehen erst nach Task 6 statt nach Task 4. | Ein electron-builder-Lauf im selben Worktree kann `node_modules` leeren (Lehre „electron-builder räumt devDeps weg“) und hätte die Tests von Task 5 und 6 gestört. | Der Owner sieht den Player rund eine Stunde später. |
| R11 | Task 5, Pille | Die Statuspille des Abschnitts „Browser-Zugang“ („Datei vorhanden“ gelb, „keine Datei“ grün) bleibt vorläufig; die Texte stehen in der Texttabelle (SCA5, SCA6) und in Offener Frage 2. | Der Plan nennt die Pille nicht; sie schadet nicht. | Zwei Texte, die der Owner streicht. |
| R12 | Task 5, Messung | Ein leeres Passwort wird mit 400 statt 401 abgelehnt (zod `min(1)`); das genügt SC-S1. Der Modus „secure“ ist im Panel und in der Brücken-Meldung gemessen; die Statusleiste zeigt den Modus wie vor dem Task nicht (unverändert, kein Auftrag). `taskkill` der Mess-Instanz nach 10 s ist zulässig (nur Testprofil). | Alle drei sind Messdetails, die den Befund nicht ändern. | Nichts am Produkt. |
| R13 | Task 6, A7 | `istEigeneSeite(url: string, eigeneDatei: string, devUrl: string \| undefined): boolean` vergleicht mit genau der geladenen Datei. `eigeneDatei` ist `pathToFileURL(join(__dirname, '../renderer/index.html')).href` ohne `#` und `?`, der Vergleich ignoriert Groß/Klein des Laufwerks; `devUrl` gibt es nur bei `!app.isPackaged` (A7 „im Dev“). Keine `will-navigate`-Sperre: Sie würde Bedienung außerhalb der Spec ändern. | Der Plan prüfte nur die Endung `/renderer/index.html`; eine präparierte Datei (Download, UNC-Freigabe), per Ziehen ins Fenster geladen, hätte das Geheimnis bekommen. | Eine Seite, die genau die eigene Datei im Programmordner ersetzt (Schreibrecht dort), bekäme das Geheimnis; das ist schon heute Vollzugriff. Wer die Electron-Fuses ändert, muss das Fenster neu messen (`file://` ohne CORS hängt an der Standard-Fuse von Electron 33). |
| R14 | Testbauten | Die Testbauten entstehen erst nach der Gesamtprüfung und ihrer Fix-Welle (statt direkt nach Task 6, R10). | Sonst müsste nach einer Code-Änderung der Fix-Welle neu gebaut werden. | Der Owner wartet etwas länger auf die Testbauten. |
| R15 | Arbeitsbereich | Der Ordner `.superpowers/sdd/2026-11-25-altfehler-stufe1/` bleibt nach der Gesamtprüfung bis nach Abnahme und Release liegen und kommt dann wie in Welle 2b als tar.gz nach `sdd-archiv`. | Owner-Praxis; Messskripte und Belege dienen der Abnahme. | Ein git-ignorierter Ordner bleibt länger liegen. |
| R16 | Gesamtprüfung F2, ersetzt A4 für die neuen Rückfragen | Beide neuen Rückfragen (Cue löschen während der Show, benutztes Medium entfernen) laufen als Fenster im Fenster (`Modal` aus `@jm/ui`, `R/views/EntfernenFrage.tsx`), nicht als `window.confirm`. „Abbrechen“ steht zuerst und hat beim Öffnen den Fokus, Escape und der Hintergrund brechen ab, „Entfernen“ entfernt wie bisher. Die Show läuft währenddessen weiter, Fernbefehle wirken; die Cue-Show sperrt Leertaste und Escape wie bei den anderen Dialogen. „Show löschen“ bleibt `window.confirm`. | Eine blockierende Rückfrage während laufender Show hält Panik und Stop über Companion, das Ende eines Cues und Vorläufe an; Leertaste oder Enter bestätigten sie (Show-Risiko, Anti-Ziel). | Zwei neue Knopftexte („Abbrechen“ PLA15, „Entfernen“ PLA16) in der Texttabelle. |
| R17 | Gesamtprüfung F3, Offene Frage 1 | Pads lösen bei AltGr weiter aus wie vor der Stufe: Windows meldet AltGr als Strg+Alt, `getModifierState('AltGraph')` erlaubt dann (`padTasteErlaubt`, `R/lib/oberflaeche.ts`); gesperrt bleiben Strg, Alt und Meta ohne AltGr, Meta auch mit AltGr. | Anti-Ziel „Taste verhält sich ohne Owner-Entscheid anders“ geht vor; das Tastenfeld nimmt AltGr-Zeichen ohnehin an. | Nichts gegenüber heute: AltGr-Zeichen feuern wie vor dem Branch. Der Owner kann AltGr sperren lassen. |
| R18 | Triage der Kleinigkeiten der Gesamtprüfung | In die Fix-Welle kommen zusätzlich die vom Prüfer als „vor Release“ oder „billig und show-nah“ eingestuften Punkte K1 bis K7 (Abnahme AS3 und AP7; `Vorlaeufe` mit `performance.now()` und Obergrenze; Zeitreserven ≥ 90 ms; Test „Panik in der Pause“; Pause während des Wartens auf „bereit“; R9 gegen Pause-Wechsel; dieses Dokument bis R19). Alle übrigen Kleinigkeiten bleiben aufgeschoben (Abschnitt 4). | Billig und nah an der Show; der Rest ändert vor dem Release nichts Sichtbares. | Etwas mehr Arbeit in der Welle. |
| R19 | Gesamtprüfung, „Declined to judge“ | Drei Punkte bleiben außerhalb dieser Stufe und gehen als Kandidaten in die Bestandsaufnahme (Abschnitt 5, Inventar Abschnitt 7): Cue im Vorlauf löschen bricht den Vorlauf nicht ab (der Zeitgeber spielt den gelöschten Cue); GO ohne Vorlauf in der Pause lässt ein pausiertes Ausgabevideo stehen; Medium entfernen nimmt es still aus Playlists (`CASCADE`). Der Rest der Liste (A8 `null`/`file://`, 7-Tage-Sitzungen, Fuse, `loadMain`, `openExternal`, top-level await, 0.0.0.0, `atem:state`) ist Plan-Entscheid oder schon vermerkt. | Außerhalb des Auftrags dieser Stufe. | Der gelöschte Cue im Vorlauf bleibt bis Stufe 2 ein Show-Risiko; er steht darum als erster Kandidat in der Liste (PL-K1). |
| R20 | Nachprüfung der Fix-Welle, Minor zu F3 | Ob Windows auf einer deutschen Tastatur linkes Strg+Alt als AltGraph meldet, ist per CDP nicht messbar, und echte Tastendrücke sind beim Bau verboten. Die Abnahme AP6 bekommt den Beobachtungsschritt Strg+Alt+C, der Code bleibt. | Gegenüber dem Stand vor dem Branch keine Verschlechterung; messen kann es nur eine echte Tastatur. | Strg+Alt+Taste löst auf deutschen Tastaturen ein Pad aus wie AltGr; der Owner sieht es in AP6. |
| R21 | Bericht der Testbauten | Beide Testbauten werden für die ganze Abnahme nur mit einem Wegwerf-Profil gestartet (neues Rezept für den Player, das Rezept für Studio-Control gilt für alle AS-Zeilen); vorher wird die installierte App ganz beendet. | Ohne `--user-data-dir` öffnen die Testbauten die Daten der installierten Version (`%APPDATA%\@jm\player`, `%APPDATA%\@jm\studio-control`) und schreiben hinein; eine laufende installierte App hielte die Ports 8725, 7778 und 8735, dann spräche Telnet oder Companion mit der alten Version. | Der Owner richtet Test-Medien, Probe-Show und Konten im leeren Profil neu ein. |

## 3. Gesamtprüfung und Fix-Welle

Eine Prüfung über den ganzen Branch (`cf42db4e4a..2ed47ccacd`, Prüfer opus) nach Task 8.

- **Ergebnis:** bereit zum Merge „mit Korrekturen“, kein Critical. Drei Important:
  - F1: Companion braucht bei „secure“ Suite-Token **und** TLS-Fingerprint (der Launcher schreibt immer `tls` und `tlsFingerprint`, das Modul spricht TLS nur mit ausgefülltem Fingerprint und hängt mit Token allein bei „Authentifiziere …“); alle Texte sagten nur „den Schlüssel“.
  - F2: `window.confirm` beim Cue-Löschen während der Show und beim benutzten Medium blockierte das Player-Fenster (Companion STOP und PANIK, Ende eines Cues, Vorläufe warten), Leertaste oder Enter bestätigten. → R16.
  - F3: AltGr-Pads vor dem Release entscheiden. → R17.
- **In der Fix-Welle behoben** (eine Welle, ein Helfer; Liste `fix-welle.md` im Arbeitsbereich):
  - F1 nur in Texten: Changelog CL-SC2, Handbuch Studio-Control, Texttabelle, Abnahme AS6 (die Wegwerf-Probe mit Token allein prüft nur „ohne Token abgelehnt, mit Token angenommen“, ohne TLS). Kein Code von Studio-Control.
  - F2: Rückfrage im Fenster (`R/views/EntfernenFrage.tsx`, hooklose Abläufe `cueEntfernen` in `R/views/ShowView.tsx` und `mediumEntfernen` in `R/views/LibraryView.tsx`, `entfernenOderFragen` in `R/lib/oberflaeche.ts`); Tests `test/ui/rueckfrage.test.tsx` und `test/ui/store.test.ts`; Echt-Fenster-Messung im `out/`-Bau (Rückfrage erscheint, Companion `PLAYER STOP` wirkt, während sie offen ist, „Abbrechen“ lässt den Cue stehen).
  - F3: `padTasteErlaubt` mit `getModifierState('AltGraph')`; Tests „PL-4 AltGr+Q (@) löst aus“ und „PL-4 Strg+Alt ohne AltGr sperrt“.
  - K1: Abnahme AS3 entfernt das Testgerät wieder; AP7 löscht nur eigene Wegwerf-Medien.
  - K2: `Vorlaeufe` nehmen `performance.now()`; eine Uhr, die zurückspringt, macht die Restzeit nicht größer als die Vorlaufzeit (0 ≤ Rest ≤ ms).
  - K3: Zeitreserven echter Zeitgeber im Store-Test mindestens 90 ms.
  - K4: Test „PL-11 Panik in der Pause räumt angehaltene Vorläufe“.
  - K5: Ist die Show beim Senden von `load` pausiert (Pause während des Wartens auf „bereit“), folgt direkt ein `pause` an die Ausgabe (`R/store/player.ts`). Grund: Der Main hält das `pause` der Pause bis „bereit“ zurück und schickt es vor dem späteren `load`.
  - K6: R9 gilt auch gegen Pause-Wechsel: Nach einem Ladefehler kehrt die Pause nur zurück, wenn seit dem Start niemand Pause oder Weiter gedrückt hat (Zähler `pauseZaehler` wie `startZaehler`).
  - K7: dieses Dokument bis R19 und dieser Abschnitt; K8: drei Kandidaten im Inventar (Abschnitt 5 hier).
- **Aufgeschoben:** alle übrigen Kleinigkeiten (Abschnitt 4, ohne den Vermerk „behoben“) und die drei Kandidaten aus R19 (Abschnitt 5).
- **Nachprüfung der Fix-Welle** (`2ed47ccacd..9b7dfbd59c`, Prüfer opus): F1 bis F3 und K1 bis K8 erledigt, nichts Neues der Stufen Critical oder Important. Drei Kleinigkeiten:
  - zwei als Kandidaten PL-K4 und PL-K5 (Abschnitt 5);
  - eine mit R20 als Beobachtung in der Abnahme AP6.
- **Testbauten** (Stand `f9a663e62f`, `win-unpacked` beider Apps): Bau gleich dem Commit, Rauchtest im isolierten Profil Player 16/16, Studio-Control 15/15. Der Bericht fand, dass ein normaler Start das echte Profil öffnet → R21.

## 4. Vermerkte Kleinigkeiten (Minor)

Jede Zeile ein Fund eines Prüfers, mit Datei und Zeile (Stand des Branches bei der Prüfung; die Zeilen können sich verschoben haben). Nichts davon blockierte die Freigabe der Stufe. Was die Fix-Welle nach der Gesamtprüfung behoben hat, trägt den Vermerk **behoben (Fix-Welle …)**; alles andere ist nicht behoben. Wo ein Punkt eine Frage an den Owner ist, steht er unter „Offene Fragen“ der Texttabelle.

### Player

Task 1 (Ausgabefenster, `main/`):
- M1 Neuladen (Strg+R) oder Absturz der Ausgabeseite setzt „bereit“ nicht zurück; Befehle vor dem neuen Abo gehen verloren (Altverhalten): `main/ausgabe-fenster.ts:67-69`.
- M2 Der Zweig „bereit eines unbekannten oder geschlossenen Fensters → sofort `false`“ hat keinen Test; `laufeAb` gibt bei einem unbekannten Fenster nicht frei: `main/ausgabe-fenster.ts:69`, `:84`.
- M3 `istNeuestes` beachtet den Schließ-Wunsch nicht; der Absturz eines schließenden Fensters ohne Nachfolger meldet „abgestürzt“ (wie vorher): `main/ausgabe-fenster.ts:38`.

Task 2 (Pause und Fernbefehle):
- Die Log-Zeile „Show hat 1 Cues“ steht ohne Einzahl: `R/lib/fernbefehl.ts:13`.
- Die Standard-Uhr `Date.now()` springt mit der Systemzeit; `performance.now()` wäre fest: `R/lib/vorlauf.ts:11`. **behoben (Fix-Welle K2)**
- Der Kommentar „mit seiner vollen Zeit“ ist ungenau: `R/lib/vorlauf.ts:30`. **behoben (Fix-Welle K2, jetzt „Restzeit“)**
- `selectShow` schreibt nach `await` erneut `showPaused: false`; ein Companion-`pause` in der Lücke lässt Vorläufe angehalten ohne sichtbare Pause: `R/store/player.ts:462-464`.
- Der letzte Wert im Test ist nach `showTogglePause()` trivial wahr: `test/store.test.ts:262-266`.
- Knappe Zeitreserven mit echten Zeitgebern (sonst 90 ms): `test/store.test.ts:299-301`, `:331`, `:381`. **behoben (Fix-Welle K3, alle mindestens 90 ms)**
- `protokolliere` im Preload hat kein `.catch`: `preload/player.ts:85`.
- Funktionsliste Nr. 94 nennt noch `showTimers`; Nr. 99/112/113: Beschreibung umgeschrieben, die Zeilenangaben `:64-66` und `:67-69` sind veraltet: `docs/ux/funktionslisten/player.md`.

Task 3 (Ton-Cue lädt nicht):
- Der Wächter für Nr. 128 („Show-Ton getrennt, kein `setSinkId`“) wurde ersatzlos entfernt; besser wäre eine Inhaltsprüfung `!/setSinkId/` statt „nicht in `GEAENDERT`“: `test/ui/funktionsliste.test.ts:685`.
- ROT für `show-audio` ist nur als Modul-Ladefehler belegt; der Test „kein Puffer im Cache nach Fehler“ wäre schon am alten Code grün: `test/show-audio.test.ts:69-74`.
- Der Testtext „play hat nach dem Fehler nichts im Cache gelassen“ sagt mehr, als die Prüfung zeigt: `test/show-audio.test.ts:83`.
- `show-audio.test` hängt am verborgenen Zustand des Einzelstücks (`ctx`) und hinterlässt einen Schein-Kontext: `test/show-audio.test.ts:7-36`, `:85-88`.
- Der Hinweis „Cue N …“ kommt auch nach einem Wechsel der Show und nennt dann eine Nummer der alten Show: `R/store/player.ts:574-577`.
- Die Reihenfolge in `GEAENDERT` stimmt nicht: `test/ui/funktionsliste.test.ts:96`.
- Die Map `letzterStart` wird bei neuer Show oder Panik nicht geleert (begrenzt durch die Zahl der Cue-IDs, harmlos): `R/store/player.ts`.

Task 4 (Pad-Tasten und Rückfragen):
- AltGr (Strg+Alt) sperrt Pads auf `@`, `€`, `{`, `[`, `\`, `~`, `|`; das Tastenfeld nimmt diese Tasten weiter an (Owner-Frage 1 der Texttabelle): `R/lib/oberflaeche.ts:415`, `R/views/SoundboardView.tsx:289-296`. **behoben (Fix-Welle F3, Ruling R17: AltGr löst weiter aus)**
- Kein Wächter für `padTasteErlaubt` gegenüber `istEingabeZiel` (`contentEditable`, `TEXTAREA`, `SELECT`): `test/oberflaeche.test.ts:686`, `:747`, `test/rahmen.test.tsx:277`.
- Die Zählung `confirm|prompt === 3` in `ShowView` gilt für beide zusammen statt getrennt: `test/ui/funktionsliste.test.ts:735`. **behoben (Fix-Welle F2, getrennt: prompt 1, confirm 1)**
- Toter Zweig und veralteter Text im Wächter Nr. 87–90: `test/ui/funktionsliste.test.ts:646-647`.
- Widersprüchliche Zelltexte in der Funktionsliste Nr. 19, 50, 77, 134: `docs/ux/funktionslisten/player.md:92`, `:123`, `:160`, `:249`.
- Die Rückfrage nennt einen Cue ohne Medium „—“ statt „Medium fehlt“ wie die Zeile: `R/views/ShowView.tsx:138` gegen `:374`.
- Scheitert `library.nutzung`, tut ✕ still nichts: `R/views/LibraryView.tsx:313-317`.
- `panelOffen` lässt das memoisierte Soundboard bei jedem Panel-Wechsel neu rendern; der Wächtertext sagt etwas anderes: `R/views/PlayerOberflaeche.tsx:190`, `test/rahmen.test.tsx:127-130`.
- Dritte Kopie der Kanal-Zählhilfe: `test/bruecken.test.ts:645`.
- Keine Verhaltensprüfung der Rückfrage-Verdrahtung (nur Quelltext): `R/views/ShowView.tsx:137-141`, `R/views/LibraryView.tsx:313-317`. **behoben (Fix-Welle F2: `test/ui/rueckfrage.test.tsx`, `test/ui/store.test.ts`)**

### Studio-Control

Task 5 (Gateway und Browser-Zugang):
- Das Wiederöffnen des Panels zeigt einen Takt lang die alte Antwort (gleiche Quellkennung): `R/StudioOberflaeche.tsx:127`, `packages/ui/src/lib/useBrueckenWert.ts:22-25`.
- Der Altfehler-Verweis ersetzt B2 statt ihn zu ergänzen; die B2-Einträge in `ERLAUBT` sind unerreichbar, die Probe „B2 entlastet nur ihre Dateien“ entfiel: `test/ui/funktionsliste.test.ts:358-362`.
- Die git-Prüfung der Altfehler-Listen vergleicht gegen `ERHEBUNG` statt gegen die Stufe-1-Basis; eine falsch gelistete Datei fällt nicht auf (Studio-Control `test/ui/funktionsliste.test.ts:511`, Player `:343`).
- Die Log-Zeile „companion gateway listening on tcp://0.0.0.0:…“ kann jetzt falsch sein, weil `bindHost` aus `control.json` kommen kann: `main/server.ts:1093`.
- Der IPC-Handler rechnet den Pfad doppelt, der Wächter friert den Quelltext ein: `main/index.ts:201`.

Task 6 (Ursprung und Geheimnis):
- Der Dev-CORS-Zweig spiegelt auch `Origin: null`: `main/server.ts:1045-1048` (A8).
- Die Reihenfolge `zugang.test` gegen `bruecken.test` hängt an einem `setImmediate`; `mit` löscht `window` statt es zurückzusetzen: `test/zugang.test.ts:92`, `:105-115`.
- Der Wächter zählt Kanalnennungen, nicht Aufrufe von `fensterGeheimnis()` in `index.ts`: `test/zugang.test.ts:207-216`.
- Kein IPv6-Fall `http://[::1]:7778`: `test/zugang.test.ts:42-61`.
- Messung: 2 bzw. 1 Verbindungen zum 8735-Blocker ohne geklärte Quelle (Bericht Task 6, Bedenken 5).
- Der Vergleich nach der URL-Normalisierung schließt bei ungewöhnlicher Prozent-Kodierung im Installationspfad (zum Beispiel „%“) aus; das Fenster fiele auf die Anmeldung zurück, niemand bekommt Rechte: `main/auth/zugang.ts:69`, `main/index.ts:214`.

### Dokumentation (Task 7)

- Der Satz unter der Texttabelle zu PLA5 nennt nur zwei Gründe, `R/store/player.ts:588-591` reicht aber jede Fehlermeldung durch: `docs/ux/altfehler-stufe1-texte.md`.
- Die Befund-Kürzel (PL-N, SC-S2 und so weiter) werden erst unten erklärt; ein Verweis in der Lesehilfe würde helfen.
- LOG3 ist nur ein Platzhalter; das Prüfskript prüft dort kaum etwas.

### Dokumentation (Task 8)

- Der Testbau teilt vermutlich das Profil der installierten Version; AS3 legte 192.0.2.10 an ohne den Schritt „Testgerät danach entfernen“: `docs/ux/ABNAHME-Altfehler-Stufe1.md:10`, `:52`. **AS3 behoben (Fix-Welle K1)**; das Profil des Testbaus bleibt offen.
- AS4: `fetch` aus einer fremden Seite kann schon im Browser scheitern; `curl` ist der verlässliche Teil: `docs/ux/ABNAHME-Altfehler-Stufe1.md:53`.
- Der Satz „Aus dem Code abgeleitet heißt …“ definierte eine Marke, die keine Zeile nutzte: `docs/ux/ABNAHME-Altfehler-Stufe1.md:5`. Seit der Fix-Welle nutzt AS6 sie (Hinweis zu TLS).
- Das Rezept des Wegwerf-Profils leert `JM_*`/`JMPS_*` nicht und setzt `JMPS_HUB_URL` nicht auf einen Blocker wie das Messskript (geringes Risiko, Profil ohne Kopplung).

## 5. Kandidaten für eine spätere Runde

Beobachtungen außerhalb des Auftrags dieser Stufe; sie stehen als Kandidaten in `docs/ux/altfehler-inventar.md`, Abschnitt 7, nicht als behoben:
- Studio-Control: Das Entfernen eines ATEM schickt kein neues `atem:state` (Altverhalten, Task 6).
- `setWindowOpenHandler` gibt jedes Schema an `shell.openExternal` (`main/index.ts:95-98`, Altverhalten).
- Eine ins Studio-Control-Fenster gezogene Datei navigiert weg (Bedienung, nicht mehr Sicherheit).
- `loadMain` lädt `ELECTRON_RENDERER_URL` auch im Paket (`main/index.ts:57-64`); das Geheimnis geht dorthin nicht (R13), das Fenster zeigt dann aber eine fremde Adresse.
- Player (R19, PL-K1): Ein Cue, der im Vorlauf gelöscht wird, startet trotzdem; der Zeitgeber spielt den gelöschten Cue (`removeShowCue` räumt keinen Vorlauf, `R/store/player.ts`).
- Player (R19, PL-K2): Ein GO ohne Vorlauf in der Pause hebt die Pause auf, lässt ein pausiertes Ausgabevideo aber stehen (kein `resume` an die Ausgabe).
- Player (R19, PL-K3): Ein Medium aus der Bibliothek zu entfernen nimmt es ohne Hinweis aus allen Playlists (`CASCADE`); die Rückfrage zählt nur Cues und Pads.
- Player (Nachprüfung, PL-K4): Die Rückfrage „Cue löschen“ bleibt offen, wenn Companion (`loadShow`) eine andere Show lädt; „Entfernen“ löscht dann den genannten Cue aus der vorigen Show.
- Player (Nachprüfung, PL-K5): Eine Pause während des Wartens auf „bereit“ verschluckt das Einblenden; nach „Weiter“ kommt das Video mit voller Lautstärke (gleiche Art wie Pause während einer Blende).

---

## Stufe 2

Für wen: spätere Entwickler, die an Player, Interpreter, Stage Display, Caption, Recorder, Presenter, dem Companion-Modul oder Connect weiterarbeiten. Hier steht, was in Stufe 2 entschieden wurde, wo Spec und Code schwiegen, mit dem Grund und dem, was es kostet, wenn die Entscheidung falsch war:
- die Festlegungen B1 bis B7, C1 bis C10, P1 bis P9 und D1 bis D11 des Plans (Abschnitt 6); B, C und P sind Festlegungen des Controllers (Owner 26.11. 12:13 „los“), D die des Plans; der Owner hat sie in der Texttabelle `docs/ux/altfehler-stufe2-texte.md`, Abschnitt „Entscheidungen“, zur Kenntnis;
- die Pre-flight-Rulings K1 bis K9 und G1 bis G22, die vor Task 1 galten und dem Plantext vorgingen (Abschnitt 7);
- die Rulings des Controllers während des Baus (Abschnitt 8). Sie heißen hier **S2-R1 bis S2-R25**, damit sie nicht mit R1 bis R21 der Stufe 1 verwechselt werden. S2-R5 bis S2-R25 tragen im Ledger und in der Texttabelle die Nummern R5 bis R25; S2-R1 bis S2-R4 hießen dort R1-Fokus, R2-Fokus, R3-Fokus und R4-mDNS.

Danach jede Kleinigkeit, die ein Prüfer vermerkt und aufgeschoben hat (Abschnitt 9), und die Kandidaten für eine spätere Runde (Abschnitt 10). Die Gesamtprüfung des Branches und ihre Fix-Welle folgen nach diesem Stand; ihre Entscheidungen kommen als eigener Abschnitt dazu.

Quellen: Spec `docs/superpowers/specs/2026-11-25-altfehler-runde1-design.md` (Abschnitt 5, Stufe 2, und Abschnitt 8), Plan `docs/superpowers/plans/2026-11-26-altfehler-stufe2.md`, Befunde `docs/ux/altfehler-inventar.md`, Abnahme `docs/ux/ABNAHME-Altfehler-Stufe2.md`. Pfade sind relativ zu `apps/<app>/src/`; `R/` steht für `renderer/src/`. Zeilenangaben gelten für den Stand bei der Prüfung und können sich verschoben haben.

### 6. Festlegungen des Plans (B1 bis B7, C1 bis C10, P1 bis P9, D1 bis D11)

Wo der Plan selbst keinen Grund oder keine Kosten nennt, steht „(im Plan nicht genannt)“ vor der Ergänzung.

| # | Befund | Entschieden | Grund | Kostet, wenn falsch |
| --- | --- | --- | --- | --- |
| B1 | RE-3, Geräteverlust (Task 7) | Ein Wächter im Hauptprozess, nur bei Eingängen, die kein Loopback sind: Kommen während einer Aufnahme 2 s lang keine Blöcke, endet die Aufnahme wie bei einem Schreibfehler, das Fehlerfeld bleibt. | „Nie REC, während nichts geschrieben wird.“ | Ein USB-Aussetzer über 2 s beendet die Aufnahme; die Datei bis dahin ist sicher, eine neue Aufnahme muss gestartet werden. |
| B2 | RE-3, Verhalten (Task 7) | Schreibfehler werden in `onFrames` immer abgefangen, keiner erreicht das Addon. Variante „sauber enden“: Datei abschließen, Zustand `armed`, Fehlerfeld bis zum nächsten Start oder Stopp; Companion sieht `recording=0`, der Steuerserver ändert sich nicht. Auch ein gescheiterter Start setzt das Fehlerfeld. Gemessen im Test mit einem Schreiber, der wirft; die Abnahme zieht einen USB-Stick ab (AR7). | (im Plan nicht genannt) Was das Addon mit einem Wurf tut, war nie gemessen (Inventar Abschnitt 5); Abfangen ist der sichere Weg. | Das Addon verhält sich am echten Datenträger anders; das zeigt die Abnahme. |
| B3 | RE-7a (Task 7) | Die Rückfrage erscheint im Fenster wie R16 im Player, per CDP messbar, ohne den Hauptprozess zu blockieren. Rückfall: Bestätigt das Fenster die Frage nicht binnen 1 s, fragt der Hauptprozess mit einem nicht blockierenden nativen Dialog. Abmelden oder Herunterfahren beenden ohne Frage, die Datei wird sauber abgeschlossen. Mac Cmd+Q: erst fragen, dann den Steuerserver beenden (zum Mac siehe S2-R14 und S2-R19). | (im Plan nicht genannt) Ein hängendes Fenster darf das Schließen nicht verhindern, und eine Rückfrage darf den Hauptprozess nicht anhalten. | Ein zusätzlicher Rückfallweg im Code. |
| B4 | RE-7b (Task 6) | Ein unbestätigter Netzwerkordner aus einer Show setzt „kein Ordner“ nur im Speicher („wartet auf Bestätigung“); der gemerkte Ordner der Einstellungen wird erst überschrieben, wenn bestätigt oder neu gewählt ist. Ein Show-Ordner gleich dem gesetzten gilt als bestätigt. „Übernehmen“ im Preset-Import merkt den Netzwerkordner als bestätigt. Die Prüfung läuft ohne Blockade; das synchrone Lesen der Show-Datei bleibt und ist Kandidat RE-K1. | (im Plan nicht genannt) Spec RE-7b: einmal bestätigen, danach gemerkt, nie ein Dialog, nie den Hauptprozess blockieren. | Ein Bediener bestätigt einen Ordner, den er schon kennt, einmal mehr. |
| B5 | RE-PLATZ (Task 7) | `fs.promises.statfs` alle 5 s, höchstens eine Abfrage je Pfad zugleich, Zeitgrenze 3 s, danach „Platz unbekannt“. Bytes je Sekunde = Kanäle × Samplerate × 4 (32-bit Float), × 2 bei „Spuren einzeln“ mit mehr als einem Kanal. Das Handbuch nennt 32-bit Float und 11,5 MB je Kanal und Minute, doppelt mit „Spuren einzeln“. Keine neue Zeile in der Funktionsliste (138 fest); die Statusleisten-Zeile nennt den Eintrag. | (im Plan nicht genannt) Spec RE-PLATZ: Restzeit für das aktuelle Format, nie eine erfundene Zahl; ein langsames NAS darf nichts aufhalten. | Die Restzeit ist am NAS ungenau oder öfter „unbekannt“. |
| B6 | RE-2, RE-2b, RE-7b, gemeinsamer Ablehnungsweg (Task 6) | Reines Prüfmodul `R/lib/fernbefehl.ts` und Kanal `recorder:ablehnung` für Log und Meldung bis „OK“; RE-2 zusätzlich mit einem Wächter im Hauptprozess, damit ein ARM kurz nach RECORD ON keine Aufnahme beendet. | (im Plan nicht genannt) Spec „Abgelehnte Fernbefehle“: Grund im Fenster, eine Zeile im Log; den Wettlauf sieht nur der Hauptprozess. | Ein Kanal mehr. |
| B7 | Funktionsliste Recorder (Task 6, 7) | Eine Altfehler-Bindung je ID an Dateien wie im Player; Wächter des alten Verhaltens werden auf das neue umgestellt, jede Umstellung nennt die ID; `R/components/PresetLeiste.tsx` bleibt unberührt (Hash-Wächter `test/ui/live.test.tsx:449-451`). | (im Plan nicht genannt) Gleiches Muster wie im Player (Ruling R6 der Stufe 1). | (im Plan nicht genannt) Etwas mehr Pflege in den Tests. |
| C1 | CA-8 (Task 5) | Zahlenfeld wie im Recorder (`NumberInput` aus `@jm/ui`): Ein ungültiger Wert zeigt einen Fehlertext und wirkt nicht. Zusätzlich zieht der Hauptprozess Werte aus Datei und IPC auf die Grenzen; eine Schriftgröße unter dem Mindestwert gibt es nirgends. | (im Plan nicht genannt) Dasselbe Feld wie im Recorder (E13); Datei und Fernsteuerung gehen am Feld vorbei. | „Auf die Grenzen gezogen“ gilt nur für Datei und IPC, nicht im Feld. |
| C2 | CA-11 (Task 5) | Fix im Code mit Test; Changelog „nicht auf dem Mac gemessen“. Kein lokal gebautes DMG; Release nur Windows wie in 2a. Companion `transcribe on` bei geschlossenem Fenster wird abgelehnt (Owner-Frage nach K9). | (im Plan nicht genannt) Es gibt keinen Mac zum Messen; Caption wird wie bisher nur für Windows ausgeliefert. | Auf dem Mac startet Companion die Transkription erst wieder, wenn jemand das Fenster über das Dock öffnet. |
| C3 | CA-1 (Task 4) | Der Fehler steht im Fenster bis zum nächsten Start (einen Stopp gibt es nicht mehr, `running` ist schon 0). Ein Mikrofon, das im Lauf ausfällt, ist Kandidat CA-K1. | (im Plan nicht genannt) Spec CA-1: Companion darf nicht `running=1` melden, während keine Untertitel kommen. | Ein Ausfall mitten im Lauf bleibt bis zur nächsten Runde still. |
| C4 | IN-3 (Task 2) | Die Startsperre hat eine Frist von 15 s. Danach gilt der Start als gescheitert: Fehler im Fenster, Taste frei, die Engine räumt den halben Start auf. | (im Plan nicht genannt) Eine Sperre ohne Frist könnte die Taste für immer sperren, wenn ein Gerät nicht antwortet. | Ein Gerät, das länger als 15 s zum Start braucht, wird abgebrochen. |
| C5 | SD-3 (Task 3) | `@jm/settings` bekommt `PeerRow.eingerichtet?: boolean` und den Text „nicht erreichbar“; die anderen Apps bleiben unberührt. Gefundene andere Hosts werden nicht als Vorschläge angezeigt (die Spec sagt „nur noch Vorschläge“; der Owner hat das über die Texttabelle zur Kenntnis). | (im Plan nicht genannt) Der Text gehört zum gemeinsamen Abschnitt „Gegenstellen“; Vorschläge wären ein neues Bedienelement. | Ein gemeinsames Paket ändert sich; die Typprüfung aller Workspaces in der CI deckt das ab (Folge im GIT-Modus: D10). |
| C6 | SD-1 (Task 3) | Neues gemerktes Feld `nachrichtEntwurf`. „Senden“ mit leerem Entwurf nimmt die Nachricht von der Bühne; die Texttabelle nennt das. | (im Plan nicht genannt) Spec SD-1: Der Entwurf überlebt den Neustart, die Bühne nicht; ein eigener Löschknopf wäre ein neues Bedienelement. | Ein Klick mehr, um eine Nachricht abzunehmen. |
| C7 | Interpreter (Task 10, 11) | Kein Handbuch (Entscheid aus 2a); die Änderung steht nur im Changelog. | Entscheid aus 2a. | (im Plan nicht genannt) Die Crew findet IN-3 und IN-8 nur in den Release-Notizen. |
| C8 | Funktionslisten (Task 2, 3, 4, 6) | Caption, Interpreter und Stage Display bekommen vorab die Bindung „Altfehler ‹ID›“ an Dateien wie der Player; das ist je App der erste Schritt. | (im Plan nicht genannt) Ohne Bindung nähme die Regel jede Änderung unter beliebiger ID hin (Ruling R6 der Stufe 1). | (im Plan nicht genannt) Etwas mehr Pflege in den Tests. |
| C9 | Bauweise | Befunde, die dieselbe Datei ändern, entstehen nacheinander; innerhalb einer App nie parallel. | (im Plan nicht genannt) Gleichzeitige Änderungen an einer Datei kommen sich in die Quere. | (im Plan nicht genannt) Längere Bauzeit. |
| C10 | Versionen (Task 10) | Caption 0.7.0, Interpreter 0.3.1, Stage Display 0.8.0, Recorder 0.11.0, Player 0.10.1. | (im Plan nicht genannt) Regel der Wellen (Spec 7): Patch bei einer bis zwei Notizen, Minor bei drei bis vier; der Recorder hat fünf, Minor ist die höchste Stufe der Regel. | (im Plan nicht genannt) Ein umzubenennender Tag; die Versionen stehen noch in keinem Katalog. |
| P1 | PS-18, Ort der Wahl (Task 8) | Die Wahl steht nur im Companion-Modul (`lib.mjs`), nicht in `capabilities.ts`. | Dort würde der GIT-Modus die Funktionslisten von acht Apps rot machen (gemessen, 50 Zeilen), und Rundown bekäme die Wahl. | Die gemeinsame Tabelle kennt die Wahl nicht; Rundown bietet sie nicht an. |
| P2 | PS-18, Verträglichkeit und Bau (Task 8) | Fehlt die Wahl, gilt „umschalten“, im Modul und im Presenter; unbekannte Werte schalten ebenfalls um. Modul 0.4.0 mit einem Presenter bis 0.15.0 schaltet bei jeder Wahl um (Changelog, README; Wortlaut S2-R24). Abnahmeschritt mit echtem Companion. Bau: `node_modules` des Modulordners als Junction aus der Hauptkopie (nur lesen, `C:`), danach `rmdir`; kein `npm install`. Das Asset `jm-suite-companion-0.4.0.tgz` hängt am Release `presenter-v0.15.1`, nur mit Owner-OK. | (im Plan nicht genannt) Spec PS-18: Bestehende Tasten wirken unverändert; das Modul wird getrennt vom Presenter installiert. | Fehlt der Rückfall, wirken alte Tasten anders; das fängt der Abnahmeschritt (AP2, AP3). |
| P3 | PL-K2, Umfang (Task 1) | Gilt nur für ein GO, das die Pause aufhebt (GO ohne Vorlauf); GO mit Vorlauf bleibt wie A1. Geweckt wird nur, was angehalten ist; ein Video, das von selbst zu Ende lief, startet nicht neu. Derselbe Fehler bei „Weiter“ nach dem natürlichen Ende kommt als Teil von PL-K2 mit eigenem Test hinein. | (im Plan nicht genannt) Spec PL-K2: „hebt sie ganz auf, wie Weiter“; A1 bleibt. | Etwas mehr Zustand im Store. |
| P4 | PL-K1, Randfall (Task 1) | Auch ein Video-Cue, der beim Warten auf „bereit“ (PL-N) gelöscht wird, startet nicht mehr. | (im Plan nicht genannt) Spec PL-K1: „Der Cue startet nicht mehr“ gilt für jeden Cue. | Ein Test mehr. |
| P5 | PS-10 (Task 11) | Nur Doku. Handbuchsatz: Esc beendet die Präsentation sofort und ohne Rückfrage, im Referenten, im Publikumsfenster und in der Übersicht; im Panel schließt Esc das Panel. „Handy-Fenster“ in Spec und Inventar ist seit 2b veraltet und im Inventar berichtigt. | Owner 25.11. 12:49, Frage 5 A: gewolltes Verhalten. | (im Plan nicht genannt) Nichts am Verhalten. |
| P6 | CN-MV (Task 9) | „Ja, verlassen“ nimmt erst nach 1 s Klicks an (Tastenplatz-Regel W79, Plan 2b). `aria-disabled` oder `disabled` entscheidet die Messung; Kriterium: Der Tastaturfokus bleibt. Dass „Ja, verlassen“ nie verfällt, ist Kandidat CN-K1. | (im Plan nicht genannt) Nach der Tastenplatz-Regel bleibt die Taste an ihrem Platz; also eine Sperrzeit statt einer anderen Stelle. | Ein gewollter schneller zweiter Klick braucht 1 s länger. |
| P7 | PS-15 (Task 8) | Die Handy-Seite prüft die PIN über `/events?pin=`; das schaltet nichts. Kein neues Verb in `remote.ts`. Die zehn betroffenen Zeilen und der Ort „Handy-Seite“ im Ortsregister der Funktionsliste werden nachgeführt. | (im Plan nicht genannt) Der lesende Strom antwortet auf eine falsche PIN schon mit 401. | (im Plan nicht genannt) Nichts außerhalb der Handy-Seite. |
| P8 | Versionen (Task 8, 10) | Presenter 0.15.1, Connect 0.6.1, Companion-Modul 0.4.0. | (im Plan nicht genannt) Regel der Wellen (Spec 7); das Modul bekommt eine neue Option. | (im Plan nicht genannt) Ein umzubenennender Tag. |
| P9 | Beobachtung außerhalb | Die Switcher-Funktionsliste ist im GIT-Modus schon auf `eb8670b224` rot; Info an den Owner (Texttabelle, Hinweis 1), kein Fix. | Nicht aus dieser Stufe. | (im Plan nicht genannt) Nichts in dieser Stufe. |
| D1 | RE-7b, Vorschlag verwerfen (Task 6) | Das „×“ des Hinweiskastens, „Ordner wählen“ und ein Preset, das einen Ordner setzt, beenden den Show-Vorschlag. Beim „×“ gilt wieder der Ordner von vorher (`dirGemerkt`). | (im Plan nicht genannt) Ein Vorschlag darf nicht ewig stehen; „×“ heißt „nicht dieser Ordner“. | Wer „×“ nur zum Wegklicken drückt, nimmt im alten Ordner auf statt in keinem. |
| D2 | RE-7b, gleicher Ordner (Task 6) | Ein Show-Ordner, der normiert gleich dem gesetzten ist, wird gesetzt und gemerkt wie nach „Übernehmen“ (B4). | (im Plan nicht genannt) Der Bediener hat ihn schon gewählt. | Ein Eintrag mehr in `recorder-netzordner.json`. |
| D3 | RE-3, Fehlerfeld (Task 7) | `RecorderFehler = { art: 'schreiben' \| 'eingang' \| 'start'; text; datei }`. Die Löschliste des Plans ist durch Pre-flight K7 ersetzt: Es löschen nur ein gelungener Start, die Quittung eines Stopps im Fehlerzustand und ein „Eingang schließen“, das ein Bediener auslöst. Ein Schreibfehler löscht auch geplante Start- und Stopp-Zeitgeber. Die Log-Zeile kommt über einen eingehängten Schreiber (`setProtokoll`). | `main/recorder.ts` muss ohne `@jm/app-runtime` testbar bleiben. | Ein geplanter Stopp nach einem Fehler meldet nichts mehr (heute meldet er ohnehin nichts, RE-13). |
| D4 | RE-7a, Ablauf (Task 7) | Die erste Antwort gilt, aus dem Fenster oder dem Rückfall-Dialog; greift der Rückfall, schließt der Main die Frage im Fenster (`recorder:schliessenFrage` mit `false`). Nach „Aufnahme beenden“ auf ein Cmd+Q hin beendet der Main die App; „Weiter aufnehmen“ verwirft den Wunsch. Endet die Aufnahme, während die Frage offen ist, bleibt sie offen bis zur Antwort. | (im Plan nicht genannt) Zwei offene Fragen dürfen sich nicht widersprechen. | Ein Klick mehr nach einem Fehler während der Frage. |
| D5 | PL-K2, „angehalten“ (Task 1) | Das Ausgabevideo gilt als angehalten, wenn bei pausierter Show `videoCue !== null` ist; ein eigener Merker entfällt; P3 bleibt erfüllt. | Jeder Weg, der in der Pause einen Video-Cue hält, hat `pause` geschickt (Pause-Taste, K5 der Stufe 1). | Ein Video, das ohne `videoCue` angehalten wäre, bliebe stehen; laut Code gibt es keinen solchen Weg. Die Prüfung von Task 1 fand doch einen, für Millisekunden (Abschnitt 9, Player). |
| D6 | IN-3, Frist im Test (Task 2) | Die Frist ist ein Konstruktorwert der Engine (Standard `START_FRIST_MS`), damit der Test mit 30 ms läuft; der Fehlertext ist eine Konstante in `R/core/engine.ts`. | (im Plan nicht genannt) Ein schneller Test ohne 15 s Wartezeit. | Nichts am Verhalten. |
| D7 | SD-5, „Setzen“ (Task 3) | Der Knopf nutzt `PEERS_TEXTE.setzen` aus `@jm/settings`. | Ein eigener Wert in `STAGE_TEXTE` würde den Wächter „kein STAGE_TEXTE-Wert gleicht einem Text aus @jm/settings“ (`test/ui/oberflaeche.test.ts:322`) rot machen. | (im Plan nicht genannt) Nichts am Wortlaut. |
| D8 | CA-11, Grund der Ablehnung (Task 5) | Der Grund steht in `state.error`; das Fenster zeigt ihn, sobald es wieder offen ist (Live-Bereich und Statuseintrag „Fehler“), der nächste Start löscht ihn. Abgelehnt wird nur `transcribe`, wenn es einschalten würde. | (im Plan nicht genannt) Ohne Fenster gibt es keinen anderen Ort; Hold, NDI und Leeren schaden ohne Fenster nicht. | Ein Text bleibt stehen, bis jemand startet. |
| D9 | CN-MV, Darstellung (Task 9) | Gebaut mit `aria-disabled`, der Klick wird während der Sperre verworfen, Platz und Text bleiben. Zeigt die Messung, dass der Fokus nicht bleibt, ist das ein BLOCKED-Bericht, kein Umbau auf `disabled` ohne Controller. Gemessen: Der Fokus bleibt (Task 9). | (im Plan nicht genannt) `disabled` nähme der Taste den Tastaturfokus. | (im Plan nicht genannt) Dass `@jm/ui` `aria-disabled` durchreicht, belegt nur die Messung. |
| D10 | SD-3, Folge im GIT-Modus (Task 3) | Eine Änderung an `packages/settings/src/abschnitte/peers.ts` macht im GIT-Modus die Prüfung „PAKETE_GEAENDERT gleich den geänderten Quelldateien der Pakete“ in Connect, Presenter und Studio-Control rot; Task 3 trägt die Datei dort in `PAKETE_GEAENDERT` ein. | Deren Erhebung liegt nach der letzten Änderung von `peers.ts` (`98e69e12b3`). | Drei Testdateien mehr im Task. |
| D11 | Zusätzliche Messungen | Spec 7 verlangt für Stufe 2 RE-7a und CN-MV. Zusätzlich gemessen ist, was ohne Netz, Whisper und echtes Gerät geht: PL-K2 (Task 1), IN-3 (Task 2), SD-1 (Task 3), CA-1 (Task 4), CA-8 (Task 5). CA-4 und CA-5 brauchen Whisper mit einer Sprachdatei und bleiben beim Test am Code und in der Abnahme. | Spec 1: „Was im Betrieb sichtbar ist, ist im echten Fenster nachgemessen.“ | Messzeit. |

### 7. Pre-flight-Rulings (K1 bis K9, G1 bis G22)

Ein Scan von Plan, Spec und Code vor Task 1 fand neun Konflikte (K) und 22 Lücken (G); der Controller hat jeden mit dem vorgeschlagenen Ruling übernommen (`preflight-rulings.md` im Arbeitsbereich, verbindlich vor dem Plantext). Kurzform; wo das Ledger keine eigenen Kosten nennt, gilt seine Sammelzeile „Nacharbeit im Test-Gerüst“.

| # | Befund | Entschieden | Grund | Kostet, wenn falsch |
| --- | --- | --- | --- | --- |
| K1 | Tasks 3, 8, 9: GIT-Modus der Funktionslisten Connect und Presenter | Ihr GIT-Lauf läuft nach dem Task-Commit; Rotes wird in einem Folge-Commit des Tasks behoben. Für Stage Display und Studio-Control reicht Stagen. | Connect und Presenter vergleichen `ERHEBUNG..HEAD` und sehen nur Committetes; gestagte Änderungen fehlen dort. | Ein Commit mehr je Task. |
| K2 | Tasks 2, 3, 4, 6: Bindung im ersten Schritt | Trägt Step 1 Dateien in `GEAENDERT` ein, bekommen im selben Step alle „unverändert“-Zeilen, die diese Dateien nennen, ihren Verweis „Altfehler ‹ID›“; den GIT-Modus prüft erst der letzte Testschritt. | Das Muster des Players verlangt jede Datei einer Altfehler-Liste in `GEAENDERT`; sonst ist der Lauf sofort rot. | Nacharbeit im Test-Gerüst. |
| K3 | Tasks 3, 4, 5, 6: `NUR_MELDUNG` | Dateien mit mehr als lesenden Brücken verlassen `NUR_MELDUNG`; die betroffenen Zeilen bekommen ihre ID (Stage Display Nr. 2, 44, 45, 52, 53, 61–67, 69; Caption Nr. 2, 37, 40, 45, 48, 51, 52, 55, 62, 63, 68, 72, 78, 85, 87, 92, 93, 107, 111). | Globale Regel; sonst deckte `NUR_MELDUNG` Änderungen an der Logik. | Nacharbeit im Test-Gerüst. |
| K4 | Texte | Ein Text darf in einer benannten, exportierten Konstante stehen, die der Task nennt, auch in einer bestehenden Datei (`START_FRIST_TEXT`, `CA11_TEXTE`, `ERST_AUFNAHME_STOPPEN`, `AUFNAHME_FEHLER_TEXTE`). Doppelte Wortlaute gibt es nicht. | Einige Sätze braucht der Hauptprozess; im Textobjekt des Renderers stünden sie doppelt. | Nacharbeit im Test-Gerüst. |
| K5 | Task 8: Companion-Modul | „Modus immer groß“ und der Rückfall `?? arg.default` gelten nur für `SCHIRM_WAHL`; ein Modul-Selbsttest hält die Connect-Zeile `SLIDES … toggle` zeichengleich. | Globale Regel: Am Modul ändert sich nur die Wahl an „Schwarz“ und „Weiß“; sonst änderte sich auch `CONNECT SLIDES`. | Nichts. |
| K6 | Task 6: RE-NAS | Bei einem Netzwerkordner setzt `pruefeOrdner` `dir` erst, wenn `ordnerDa` geantwortet hat, und nicht, wenn inzwischen eine spätere Wahl den Ordner ersetzt hat; dazu ein Test. | Spec-Nachtrag RE-NAS; der Plan setzte den Ordner sofort. | Ein Preset-Ordner erscheint verzögert (Folge: S2-R13). |
| K7 | Task 7: Fehlerfeld | Das Fehlerfeld löschen nur ein gelungener Start, die Quittung eines Stopps im Fehlerzustand und ein „Eingang schließen“ durch einen Bediener; nicht `arm` und nicht das Neu-Öffnen bei einem Preset-Wechsel. Ersetzt die Löschliste von D3. | Spec RE-3: „bis jemand stoppt oder neu startet“. | Ein Fehler bleibt länger stehen. |
| K8 | TDD | Tests, die schon vor der Änderung grün sind, sind Wächter; ihr Beweis ist die Mutationsprobe. Rot zuerst gilt für Verhaltenstests; jeder Bericht trennt beide Arten. | Mehrere Tests des Plans waren auf dem alten Code schon grün. | Nacharbeit im Test-Gerüst. |
| K9 | Tasks 5, 10: CA-11 | Das Ablehnen von `transcribe on` ohne Fenster (nur Mac) wird gebaut und in der Texttabelle als ausdrückliche Owner-Frage geführt, Vorschlag „so lassen“ (Offene Frage 1). | Anti-Ziel: Ein Verb ändert seine Wirkung nur mit Owner-Entscheid. | Der Owner entscheidet anders; kleiner Rückbau. |
| G1 | Task 2 | Die Zeilen Nr. 66 und 76 (`core/engine.ts` als unverändert) bekommen „Altfehler IN-3“. | Lücke im Plan; der Lauf wäre rot. | Nacharbeit im Test-Gerüst. |
| G2 | Task 2 | Den GIT-Wächter „Engine/Store unverändert“ ohne `engine.ts` und `settings.ts` neu fassen. | Beide Dateien ändern sich. | Nacharbeit im Test-Gerüst. |
| G3 | Task 2 | `test/ui/oberflaeche.test.ts`, eigenes `motor()`: `starting: false` ergänzen. | Sonst scheitert die Typprüfung. | Nacharbeit im Test-Gerüst. |
| G4 | Task 3 | Nr. 46 (`main/config.ts`) bekommt „Altfehler SD-1“. | Lücke im Plan. | Nacharbeit im Test-Gerüst. |
| G5 | Task 3 | `shared/mdns.ts` mit `VORGABE_HOST` schon bei SD-1 anlegen; SD-3 ergänzt die Datei. | `konfig-regeln.ts` braucht die Vorgabe, SD-3 kam erst danach. | Nacharbeit im Test-Gerüst. |
| G6 | Task 3 | `packages/settings/src/abschnitte/peers.ts` auch in `PAKETE_GEAENDERT` des Stage Displays. | Lücke im Plan. | Nacharbeit im Test-Gerüst. |
| G7 | Task 3 | Die Files bei `peers.ts` umfassen auch `PeerRow`. | Lücke im Plan. | Nacharbeit im Test-Gerüst. |
| G8 | Task 4 | Die Umbenennung `correctLast` → `correctLine` trifft auch `R/views/CaptionOberflaeche.tsx`; die Datei kommt in die CA-5-Files und in die Map. | Sonst scheitert die Typprüfung. | Nacharbeit im Test-Gerüst. |
| G9 | Task 4 | `test/ui/oberflaeche.test.ts` bekommt `leerungen: 0`. | Sonst scheitert die Typprüfung. | Nacharbeit im Test-Gerüst. |
| G10 | Task 5 | Caption hat keinen `activate`-Hörer (die Stelle des Plans ist `second-instance`); der Hörer wird neu angelegt. | Der Plan nannte eine Stelle, die es nicht gibt. | Nacharbeit im Test-Gerüst. |
| G11 | Task 6 | `test/ui/live.test.tsx` bekommt `netzordnerOffen` und `netzordnerUebernehmen`. | Sonst scheitert die Typprüfung. | Nacharbeit im Test-Gerüst. |
| G12 | Task 7 | `test/ui/oberflaeche.test.ts` bekommt `fehler: null, spuren: false`. | Sonst scheitert die Typprüfung. | Nacharbeit im Test-Gerüst. |
| G13 | Tasks 6, 7 | Jede neue Datei unter `src/` wird im Hook ihrer Zeile genannt. | Regel der Recorder-Funktionsliste (eine Fehllesung im Scan klärt S2-R10). | Nacharbeit im Test-Gerüst. |
| G14 | Task 6 | `lauf.then((d) => pruefeOrdner(d, name))`. | Die Prüfung liegt außerhalb der Preset-Kette (RE-NAS). | Nacharbeit im Test-Gerüst. |
| G15 | Task 7 | Reihenfolge in `platzEintrag`: noch keine Antwort → „Platz unbekannt“; kein Zielordner → „kein Zielordner“; kein Messwert → „Platz unbekannt“. | Der Plan nannte zwei Fälle widersprüchlich; der bestehende Test „off unbekannt“ bleibt gültig. | Vor der ersten Antwort steht einen Takt lang „unbekannt“ statt „kein Zielordner“. |
| G16 | Task 8 | `test/handy-seite.test.ts` und `test/schirm-wahl.test.ts` kommen in `GEAENDERT` des Presenters. | Auch Testdateien zählen als geänderte Dateien der App. | Nacharbeit im Test-Gerüst. |
| G17 | Task 8 | Nur Nr. 169 zieht an den Ort „Handy-Seite“; die übrigen Handy-Zeilen bleiben „(unverändert)“, mit PS-15 über `ERLAUBT`. | Nur die PIN-Prüfung ändert sich. | Nacharbeit im Test-Gerüst. |
| G18 | Task 9 | ZoomCard verdrahtet `verlassenBedienung`, und der Wächter prüft genau das. | Der Plan nannte zwei Namen für dieselbe Verdrahtung. | Nacharbeit im Test-Gerüst. |
| G19 | Task 9 | `aria-disabled` nur, wenn `frage && verlassenGesperrt(…)`; fallen die Slots auf 0, ist die Taste nicht gesperrt und verlässt mit einem Klick (Review Focus 5). | Ohne laufende Slots gibt es nichts zu schützen. | Ein Klick in der Sperrsekunde verlässt, wenn die Slots gerade ausfielen. |
| G20 | Tasks 10, 11 | In der Texttabelle bleibt die Freigabe-Zeile die letzte; Task 10 legt die Tabelle ohne `## Handbuch` an, Task 11 setzt den Abschnitt davor und nimmt die Handbuch-Prüfung ins Prüfskript auf. | So stand es in Stufe 1; die Vorlage des Prüfskripts hätte Task 10 sonst rot gemacht. | Nichts. |
| G21 | alle Tasks | Code über den zitierten Anker suchen, nicht über die Zeilennummer. | Die Nummern verschieben sich nach früheren Tasks. | Nichts. |
| G22 | Task 1 | Den neuen `resume`-Block für die Ausgabe hinter `set({ … showPaused: false })` setzen; der Wächter der Funktionsliste erlaubt dort 1200 Zeichen. | Lücke im Plan. | Nacharbeit im Test-Gerüst. |

### 8. Rulings des Controllers (S2-R1 bis S2-R25)

Im Ledger stehen 31 Zeilen mit „Ruling“: sechs davon sind die Pre-flight-Rulings aus Abschnitt 7 (K1, K5, K6, K7, K9 und die Sammelzeile K2, K3, K4, K8 mit G1 bis G22), die übrigen 25 stehen hier.

| # | Befund | Entschieden | Grund | Kostet, wenn falsch |
| --- | --- | --- | --- | --- |
| S2-R1 | Task 1, Messung (Ledger: R1-Fokus) | Gemessene Fenster dürfen den Fokus des Owners nicht nehmen: per Inspector sofort nach dem Erzeugen `setFocusable(false)` oder `blur`, Fokus per CDP protokollieren, einen Lauf mit echter Eingabe verwerfen; Nachtrag in den globalen Regeln. | Im ersten Messlauf landete eine echte Taste des Owners im Vollbild-Ausgabefenster (Lauf verworfen); eine echte Taste kann eine Messung verfälschen oder etwas auslösen. | Etwas mehr Messskript. |
| S2-R2 | Task 2, Messung (Ledger: R2-Fokus) | Der Fokus-Haken aus Task 2 (`--inspect-brk`, Haken vor der ersten App-Zeile, Abbruch bei Fehler) ist ab Task 3 Pflicht-Vorlage (`vorlagen/fokus-haken-vorlage.mjs`). | Zwei Läufe mit einem selbst gebauten Haken versagten, das Fenster war bis etwa 10 s fokussierbar. | Nichts außer Übernahme-Aufwand. |
| S2-R3 | Task 3, Messung (Ledger: R3-Fokus) | Kriterium ist der Fokus des Betriebssystems (`isFocused()` und `isFocusable()` false, kein Fenster im Vordergrund); `document.hasFocus()` nach einer CDP-Eingabe zählt nicht. | CDP fokussiert die Seite intern; das nimmt dem Owner nichts. | Nichts. |
| S2-R4 | Task 3, Messung (Ledger: R4-mDNS) | mDNS-Anfragen der gemessenen App auf UDP 5353 im echten LAN sind erlaubt, solange keine Quelle eingeschaltet ist und keine Verbindung entsteht. | Passive Suche ohne Wirkung. | Das LAN sieht kurz eine Suchanfrage. |
| S2-R5 | SD-5, Prüfung Task 3 (Important, vom Plan verlangt) | Die PIN-Taste behält die wechselnde Beschriftung „Anzeigen“/„Verbergen“; `aria-pressed` entfällt (der Brief verlangte beides). | WAI-ARIA: Die wechselnde Beschriftung trägt den Zustand; mit `aria-pressed` hieße es bei sichtbarer PIN „Verbergen, gedrückt“. | Nichts am Verhalten. |
| S2-R6 | SD-3, Prüfung Task 3 (Minor 1 und 2) | Ein leerer Host gilt wie 127.0.0.1 als nicht eingerichtet: mDNS darf ihn füllen, der Status heißt nie „nicht erreichbar“; eine Hilfsfunktion `aufVorgabe(host)` in `shared/mdns.ts` für Übernahme-Regel und Status. | Spec „also nie eingerichtet“; `PeerRow.host ''` heißt „automatisch“; vorher füllte mDNS leere Hosts. | Wer den Host bewusst leert, um mDNS zu verhindern, bekommt wieder Automatik. |
| S2-R7 | SD-1, Funktionsliste (Prüfung Task 3, Minor 5) | Abschnitt 9 der Funktionsliste Stage Display (Nachricht „wirkt wie heute mit jedem Tastendruck“) bekommt in Task 11 den Satz „Altfehler Stufe 2 (SD-1): …“ hinter dem alten Text. Umgesetzt in Task 11. | Der Plan wies Abschnitt 9 keinem Task zu. | Nichts. |
| S2-R8 | CA-1, Prüfung Task 4 (Important, vom Plan verlangt) | Leere Fehlermeldung beim Mikrofon: OverconstrainedError oder NotFoundError → der vorhandene Text „Gerät nicht gefunden“ aus `@jm/settings` (importiert); andere leere Meldungen → neue Konstante „nicht verfügbar“ (Texttabelle CAA1); der Panel-Abschnitt zeigt denselben Text. | CA-1 „der Fehler steht im Fenster“; ein Bediener braucht einen Grund statt eines leeren „Mikrofon:“. | Ein neuer kurzer Text. |
| S2-R9 | CA-4, CA-5, Prüfung Task 4 (Minor 1) | Der Testtext der Funktionsliste lautet „6–8 und 11–13 offen; 4 und 5 behoben (CA-4, CA-5)“ (Fix-Runde 1). | Globale Regel „Der Testtext nennt die ID“. | Nichts. |
| S2-R10 | RE-7b, Funktionsliste (Task 6) | Die Zeile „netzordner → Nr. 24“ im Pre-flight-Scan war ein Versehen; verbindlich ist G13 („jede neue Datei im Hook ihrer Zeile“), erfüllt in Nr. 52, 72, 73, 124 und 80, 107–109, 111. | Die Lesart des Helfers deckt sich mit dem verbindlichen Ruling. | Nichts. |
| S2-R11 | RE-2, Prüfung Task 6 (Minor 1) | Eine Ablehnung durch den Wächter des Hauptprozesses (`rec:arm`/`rec:disarm` im Wettlauf) bekommt eine Log-Zeile (`getLog().warn` bei `!ok`) und den Text des Hinweisbands wie die Ablehnung im Store; gebaut mit Task 7, mit Test. | Spec „Das Log hat eine Zeile“. | Eine Zeile. |
| S2-R12 | Tippfehler, Prüfung Task 6 (Minor 6) | U+05D3 statt „×“ in `R/views/LiveBereich.tsx` (Kommentarzeile, die der Commit berührt) wird mit Task 7 korrigiert. | Vom Commit berührte Zeile. | Nichts. |
| S2-R13 | RE-NAS, Folge von K6 (Task 6) | Hängt die NAS-Prüfung eines Presets, gilt bis zur Antwort der alte Ordner; das ist ein eigener Abnahmeschritt (AR6) und steht hier. | Spec-Nachtrag RE-NAS und K6: Der Netzwerkordner eines Presets gilt erst nach der Prüfung. | Eine Aufnahme landet bis zur SMB-Zeitgrenze im alten Ordner. |
| S2-R14 | RE-7a, Mac Cmd+Q (Prüfung Task 7, Important 2, vom Plan verlangt) | Bleibt in dieser Stufe: Der Recorder wird nur für Windows gebaut und ausgeliefert (die CI schließt `recorder-v*` aus, der lokale Bau ist nur Windows). Kandidat RE-K3: Bei Cmd+Q laufen Presence-bye und Master-Link-Stopp in `before-quit` schon vor der Frage. | Es gibt keinen Mac-Bau; ein Umbau von `@jm/app-runtime` läge außerhalb der Stufe. | Ein künftiger Mac-Bau meldet nach „Weiter aufnehmen“ den Recorder als weg. |
| S2-R15 | RE-7a, Mac Abmelden (Prüfung Task 7, Important 3, vom Plan verlangt) | `powerMonitor` „shutdown“ (macOS und Linux) setzt „bestätigt“ und beendet ohne Frage, mit Quelltext-Wächter; nicht auf dem Mac gemessen. **Abgelöst durch S2-R19.** | B3: „Abmelden oder Herunterfahren beenden ohne Frage.“ | Wenige Zeilen. |
| S2-R16 | RE-PLATZ (Prüfung Task 7, Minor 5, nach der Wirkung Important) | `elternOrdner` nutzt `path.win32` für Pfade mit Laufwerk oder doppeltem Schräg- oder Backslash am Anfang; Test für `//nas/share/x`. | Spec RE-PLATZ „nie eine erfundene Zahl“: Ein UNC-Pfad mit Schrägstrichen lief bis `statfs('//')`, und das misst die lokale Platte. | Nichts. |
| S2-R17 | RE-3 (Prüfung Task 7, Minor 7) | Die Haupttaste zeigt den Fehler auch bei geschlossenem Eingang: „Neu aufnehmen“ gesperrt mit dem Grund „Eingang öffnen, dann neu aufnehmen“ (Texttabelle REA12). | Spec RE-3 „in Statusleiste und Haupttaste sichtbar“. | Ein Text. |
| S2-R18 | RE-3, Fehlerpfad (Prüfung Task 7, Minor 4, 6, 8, 9) | Der Wächter zählt einen verspäteten Takt (mindestens 2 × Takt) als Stau; ein Fehler der Spurdatei nennt die richtige Datei und finalisiert nicht doppelt; „kein Zielordner“ steht einmal im Code (K4); Testdaten mit doppelten Backslashes. | Billig und im selben Fehlerpfad. | Etwas Mehrarbeit. |
| S2-R19 | RE-7a, Herunterfahren (Nachprüfung Task 7, N1) | `powerMonitor` „shutdown“ nur unter Linux (`process.platform === 'linux'`); Abmelden, Herunterfahren und Cmd+Q auf dem Mac gehören zum Kandidaten RE-K3 (Recorder nur für Windows, S2-R14). Ersetzt S2-R15. | Cmd+Q darf auf dem Mac nie ohne Frage beenden (B3), und „shutdown“ feuert dort vermutlich auch bei Cmd+Q. | Auf dem Mac fragt Abmelden weiter nach (einen Mac-Bau gibt es nicht). |
| S2-R20 | RE-7a, Rückfall (Nachprüfung Task 7, N2, nach der Wirkung Important) | `erneut()` behält eine laufende Frist (1 s ab dem ersten Schließen); wiederholte Klicks verschieben den nativen Rückfall nicht. | Bei hängendem Fenster klickt ein Bediener wiederholt; B3 sagt „binnen 1 s“. | Nichts. |
| S2-R21 | RE-3, Spurdateien (Nachprüfung Task 7, OOS-1) | `MultiWavWriter.finalize` versucht alle Spuren und wirft danach den ersten Fehler mit dem Pfad der Spurdatei; `main/wav.ts` wird an RE-3 gebunden; der Schreibfehler nennt dann die Spurdatei. | Spec RE-3 „Ein Schreibfehler setzt den Zustand Fehler“; sonst meldete der Recorder „Gespeichert“ bei kaputten Spurdateien. | Eine Bindung mehr. |
| S2-R22 | Werkzeug (Bericht Task 8) | Junctions nur aus PowerShell anlegen und lösen, mit `Test-Path`-Nachweis; Nachtrag in den globalen Regeln. | `mklink /J` aus Git Bash legt still nichts an. | Nichts. |
| S2-R23 | PS-15 (Prüfung Task 8, Minor 1, nach der Wirkung Important) | `AbortController` auf der Handy-Seite mit Rückfall (Prüfung mit `typeof`, sonst `r.body.cancel`). | Ein Handy, das sich vorher verbinden konnte (iOS vor 12.2, Chrome vor 66), könnte es sonst gar nicht mehr; die Seite muss auf jedem Handy gehen. | Zwei Zeilen. |
| S2-R24 | PS-18, Changelog (Prüfung Task 10, Minor 1) | Den P2-Satz genau fassen: „Presenter bis 0.15.0 schalten bei jeder Wahl um; erst ab Presenter 0.15.1 wirken „An“ und „Aus“.“ im Changelog (Presenter 0.15.1, Notiz 2) und in CL-PS2 der Texttabelle. Umgesetzt in Task 11. | Das Modul wird getrennt vom Presenter installiert; „Ältere Presenter“ ließ offen, welche. | Nichts. |
| S2-R25 | Doku, Prüfung Task 11 (Minor 1, 2 und 4) | Im selben Durchgang wie die Fix-Runde: Abschnitt 8 der Funktionsliste Recorder (IPC-Übersicht) bekommt die neuen Kanäle `recorder:ablehnung`, `recorder:netzordnerBestaetigen`, `fs:platz`, `recorder:schliessenFrage`, `recorder:schliessenAntwort` und die geänderten Rückgaben (`rec:disarm` → `OpResult`, `settings:load` mit `ordnerDa: null`), je mit „Altfehler Stufe 2 (‹ID›)“ und ohne neue Zeile; das Rezept des Wegwerf-Profils sagt, wie `$a` und `$h` je App zu setzen sind; RE-K4 bis RE-K7 stehen im Wortlaut der 0.9.2-Liste von PR #296. Umgesetzt in Fix-Runde 1 von Task 11. | Billig und nah an Abnahme und Inventar; die eigene Lesung der Liste war an zwei Punkten ungenau (RE-K6, RE-K7). | Nichts. |

### 9. Vermerkte Kleinigkeiten (Minor), aufgeschoben

Jede Zeile ein Fund eines Prüfers, den der Controller als „minor (deferred)“ ins Ledger übernommen hat, mit Datei und Zeile (Stand der Prüfung). Nichts davon blockierte einen Task; behoben ist bis Task 11 nur, was den Vermerk **behoben** trägt. Was die Gesamtprüfung und ihre Fix-Welle davon beheben, bekommt dort den Vermerk.

#### Player (Task 1)
- Läuft Video 1 und kommt GO auf Video 2, das während seines `isOpen`-Rundlaufs gelöscht wird, ist `videoCue` leer, obwohl Video 1 weiterläuft; „Weiter“ weckt es nicht, sein natürliches Ende wird übergangen. Das Fenster ist Millisekunden kurz; der Kostensatz von D5 („kein solcher Weg“) stimmt dafür nicht: `R/store/player.ts:510-516`, `:581`, `:687`.
- Ein Companion-GO während des IPC von `removeShowCue` kann den gelöschten Cue noch starten (`showCues` hält ihn bis `refreshShowCues`): `R/store/player.ts:517-518`.
- Der Test „PL-K2 GO auf Ton in der Pause weckt das Ausgabevideo“ prüft Zählungen, nicht die Reihenfolge `resume` → `play`: `test/store.test.ts:416`.

#### Interpreter (Task 2)
- Der Frist-Pfad wartet mit der Freigabe der Sperre auf `stop()` und `ctx.close()`; hinge `close()`, bliebe „Startet …“ stehen (theoretisch, in Chromium): `R/core/engine.ts:194-202`, `:279`.
- Zwei Veraltungs-Prüfungen ohne Test (nach `await this.stop()` und nach `await ctx.resume()`): `R/core/engine.ts:213-214`, `:254-255`.
- Die Testausgabe ist nicht sauber: zustand-persist warnt „Unable to update item 'jm-interpreter-settings'“ zweimal je Lauf (Speicher im Test stubben): `test/store.test.ts`.
- Der Testname `test/engine.test.ts:517` behauptet mehr, als geprüft wird (die Wurzel-View baut die Engine ohne Wert).

#### Stage Display (Task 3)
- Der K8-Wächter „eine Wahrheit“ hat keinen Mutationsbeweis; Probe: nur `:225` mit `eingerichtet: undefined`: `test/ui/oberflaeche.test.ts:162-165`.
- Randfall des PIN-Filters: Ist der gefilterte Entwurf gleich der gemerkten PIN, bleibt der alte Entwurf im verdeckten Feld: `R/components/PinFeld.tsx:46-47`.

#### Caption (Task 4 und 5)
- Veraltete Kommentare: `R/lib/aktionen.ts:25` (LiveAktionen „Korrektur der jüngsten Zeile“) und `R/views/LiveBereich.tsx:4`.
- Ein abgebrochener Startversuch ruft `stop()` und kann einen neueren Lauf beenden (der Brief verlangte es; ein Versuchszähler würde es schließen): `R/views/CaptionOberflaeche.tsx:122`.
- Der Deep-Link `applyShowFromDeepLink` schreibt die Konfiguration ohne `pruefeKonfig`; heute sicher, weil der Patch keine Zahlen hat: `main/index.ts:363`.
- Funktionsliste Caption Nr. 95 (STATE) nennt nicht, dass Fenster schließen `running=0` und `hold=0` schickt (CA-11).
- `test/ui/funktionsliste.test.ts:881`, `:890`: `indexOf`-Anker ohne Schutz gegen −1.
- Der Fall „96“ der Feldlogik hat keine eigene Mutationsprobe: `test/altfehler.test.ts:201`.

#### Recorder (Task 6)
- Eine späte Startprüfung des gemerkten Ordners kann einen neueren Hinweis überschreiben: `R/store/recorder.ts:489-491`.
- Ein `try` umfasst die ganze Bestätigungsschleife (`main/ipc.ts:174-178`); `merke` fügt in den Speicher ein, bevor geschrieben ist (`main/netzordner.ts:39`).
- „Übernehmen“ scheitert still, wenn der Hauptprozess `false` antwortet (heute unerreichbar): `R/store/recorder.ts:321`.
- Die K4-Konstante steht im Vertragsmodul `shared/types.ts:8`; `R/lib/oberflaeche.ts:48` leitet die Fassung ohne Punkt per Regex ab.
- Funktionsliste Recorder Nr. 96 ist ungenau: Ein Preset mit Netzwerkordner beendet den Show-Vorschlag erst nach der Prüfung.

#### Recorder (Task 7)
- Die Klassen des Fehler-Badges sind kopiert (`R/views/LiveBereich.tsx:75`); Kandidat: eine Tönung „destructive“ in `@jm/ui`.
- Ein gescheiterter Start nach `new WavWriter` lässt den Schreiber offen, es bleibt eine verwaiste 44-Byte-WAV (Altbestand): `main/recorder.ts:440-447`, `:466-471`.
- Laufen alle Takte des Wächters mindestens 500 ms zu spät, wird ein Geräteverlust nie erkannt (nur bei Dauerüberlast des Hauptprozesses): `main/recorder.ts:260-268`.
- Die Antwort eines noch offenen nativen Dialogs gilt für eine später neu geöffnete Frage (Altbestand; eine Runden-Kennung würde es schließen): `shared/schliessen.ts:174-180`.
- Der Testname `test/schliessen.test.tsx:281-298` behauptet „nach ohneFrage … ohne Frage“, prüft es aber nicht mehr (er setzt `idle` vorher).
- Der Pfad des Schreibfehlers schluckt einen `SpurFehler`: Die Meldung sagt „Das bisher Aufgenommene ist gespeichert“ auch bei kaputtem Spurkopf (Altbestand): `main/recorder.ts:299-306`.
- Ein Schreibfehler einer Spur mitten in der Aufnahme (`onFrames`) nennt die Kombidatei statt der Spurdatei.
- `disarm()`: Ein Fehler im Dateikopf beim Fensterschließen oder Herunterfahren bleibt für beide Schreiber still (Altbestand, betrifft „Aufnahme beenden“ von RE-7a): `main/recorder.ts:369-384`.

#### Presenter (Task 8)
- Der Startpfad mit gemerkter PIN ist nicht per Test festgehalten (beim Lesen: kein `/cmd`): `main/remote-page.ts:161`.
- An der PIN-Prüfung fehlt ein `.catch`: Ein Netzfehler lässt das Tor ohne Meldung (wie vorher): `main/remote-page.ts:142-144`.

#### Connect (Task 9)
- Ein gehaltenes Enter oder eine gehaltene Leertaste (Tastenwiederholung) verlässt nach 1 s; `!e.repeat` würde es schließen. Laut Ledger der einzige Rest nahe an der Show-Sicherheit: `R/zoom/ZoomCard.tsx` (um `:314`).
- Fallen die Slots auf 0 und steigen wieder, bleibt `frageSeit`; „Ja, verlassen“ ist entsperrt, und ein Klick verlässt ohne neue Frage (Altbestand).
- Während der Sperre gibt es keinen Hinweis für Screenreader; Zeitgeber und Aufräumen beim Abbau sind nur per Quelltext-Wächter belegt.

#### Dokumentation (Task 10 und 11)
- Der Recorder-Eintrag im Changelog hat fünf Notizen (Regel: Minor drei bis vier); das Prüfskript gleicht die Presenter-Version nicht mit `lib.mjs` ab.
- Abschnitt 8 der Funktionsliste Recorder (IPC-Übersicht, „Stand der Erhebung“) nennt die neuen Kanäle der Stufe 2 nicht (`recorder:ablehnung`, `recorder:netzordnerBestaetigen`, `fs:platz`, `recorder:schliessenFrage`, `recorder:schliessenAntwort`). Die Berichte von Task 6 und 7 wiesen das Task 11 zu; die verbindlichen Hinweise für Task 11 nennen es nicht, darum ist es offen. **behoben (Fix-Runde 1 von Task 11, S2-R25)**: Abschnitt 8 nennt die fünf Kanäle und die zwei geänderten Rückgaben, ohne neue Zeile.

### 10. Kandidaten für eine spätere Runde

Beobachtungen außerhalb des Auftrags dieser Stufe; sie stehen als Kandidaten in `docs/ux/altfehler-inventar.md`, Abschnitt 7, nicht als behoben:
- Caption (C3, CA-K1): Ein Mikrofon, das mitten im Lauf ausfällt, meldet keinen Fehler.
- Caption (Task 4, CA-K2): Jeder Start fragt das Mikrofon zweimal an (Altbestand).
- Connect (P6, CN-K1): „Ja, verlassen“ verfällt nie.
- Recorder (B4, RE-K1): Die Show-Datei wird synchron gelesen; beim Start einer Aufnahme legt der Hauptprozess den Ordner synchron an und prüft ihn synchron.
- Recorder (S2-R14, S2-R19, RE-K3): Auf dem Mac fehlt der Schutz durch die Rückfrage bei Cmd+Q, Abmelden und Herunterfahren.
- Recorder (Spec 8, RE-K4 bis RE-K7): die Punkte 2 bis 5 der 0.9.2-Liste aus PR #296: Fehlertexte von `presets:speichern` und `presets:loeschen` tragen Electrons englischen Präfix; `PresetDateiErgebnis.netzwerk` hat keinen Nutzer mehr; die Export-Grenze greift erst nach dem Speicherdialog; langfristig die Aufnahmezeit je Block aus dem Addon (`inputBufferAdcTime`). Punkt 1, die langsame NAS-Prüfung, die das nächste Preset aufhält, ist RE-NAS und in dieser Stufe behoben.

Aus den Berichten, noch nicht im Inventar (der Controller entscheidet, ob sie Kandidaten werden):
- Recorder (Bericht Task 6): Einen bestätigten Netzwerkordner kann man nur in der Datei `recorder-netzordner.json` von Hand wieder vergessen; die Liste wächst ohne Grenze.
- `@jm/ui` (Bericht Task 7): Der `Badge` kennt keine Tönung „destructive“; der Recorder baut sie nach (siehe Abschnitt 9).
