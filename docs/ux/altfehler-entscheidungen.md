# Altfehler Runde 1, Stufe 1: Entscheidungen und vermerkte Kleinigkeiten

Für wen: spätere Entwickler, die an Player oder Studio-Control weiterarbeiten. Hier steht, was in dieser Stufe entschieden wurde, wo Spec und Code schwiegen, mit dem Grund und dem, was es kostet, wenn die Entscheidung falsch war. Der Owner hat A1 bis A10 zur Kenntnis bekommen (Texttabelle `docs/ux/altfehler-stufe1-texte.md`, Abschnitt „Entscheidungen“); die Rulings R1 bis R13 hat der Controller während der Umsetzung getroffen. Dazu im zweiten Teil jede Kleinigkeit, die ein Prüfer vermerkt und die Stufe nicht behoben hat.

Quellen: Spec `docs/superpowers/specs/2026-11-25-altfehler-runde1-design.md`, Plan `docs/superpowers/plans/2026-11-25-altfehler-stufe1.md`, Befunde `docs/ux/altfehler-inventar.md`. Die Befund-Kürzel (PL-N, SC-S2 und so weiter) sind die IDs aus dem Inventar. Pfade sind relativ zu `apps/<app>/src/`; `R/` steht für `renderer/src/`.

## 1. Entscheidungen des Plans (A1 bis A10)

| # | Befund | Entschieden | Grund | Kostet, wenn falsch |
| --- | --- | --- | --- | --- |
| A1 | PL-11 | Ein GO in der Pause auf einen Cue mit Vorlauf startet den Vorlauf angehalten; er läuft mit „Weiter“ weiter. Ein GO auf einen Cue ohne Vorlauf startet wie heute sofort und hebt die Pause auf; dann laufen auch angehaltene Vorläufe weiter. | Spec: „In der Pause startet kein Cue von selbst.“ | Ein Bediener, der in der Pause gezielt einen Cue mit Vorlauf feuert, muss „Weiter“ drücken; der Cue läuft dann nicht von selbst an. |
| A2 | PL-T14 | Nach einem Ladefehler gibt es kein automatisches Weiterschalten (Auto-Continue); der Standby steht schon auf dem nächsten Cue. Die Pause bleibt, wie sie vor dem Start war. | Ein stiller Sprung auf den nächsten Cue wäre ein zweiter, unsichtbarer Start. | Eine Show, die nach einem fehlenden Ton von selbst weiterlaufen sollte, bleibt stehen; der Bediener drückt GO. |
| A3 | PL-T14, PL-16a | Die Meldung im Fenster ist die bestehende Hinweisleiste (`notice`, 4 Sekunden). Die Log-Zeile geht über den neuen Kanal `player:protokoll` an `getLog().warn`. | Keine neue Anzeige für zwei Fälle; das Log erreicht der Renderer nur über IPC. | Ein Hinweis, der nach 4 Sekunden verschwindet, kann überlesen werden; dann hilft nur das Log. |
| A4 | PL-10 | Rückfragen kommen per `window.confirm`, wie heute „Diese Show löschen?“. Der Standby folgt seinem Cue auch beim Umsortieren. Wird der Standby-Cue selbst gelöscht, steht der Standby wie heute auf dem Cue danach. | Gleiches Muster wie die bestehende Rückfrage; eine eigene Dialogkomponente wäre ein neues Bedienelement. | `window.confirm` blockiert den Renderer, solange die Rückfrage offen ist (wie schon „Show löschen“); bei einer späteren eigenen Dialogkomponente sind drei Aufrufstellen umzustellen. |
| A5 | PL-N | Auf „bereit“ des Ausgabefensters wird höchstens 5000 ms gewartet. Danach geht der Befehl trotzdem hinaus, und das Log bekommt eine Zeile. Das gilt auch für ein Fenster, das per Panel offen ist und noch lädt. | Eine harte Obergrenze statt einer Hängepartie; ein Befehl geht nie verloren. | Ein sehr langsames Fenster bekommt den Befehl vor seinem Abo (wie vor dieser Stufe). |
| A6 | PL-4 | Ein Pad löst auch bei gedrückter Umschalttaste aus; nur Strg, Alt und Meta sperren. | Die Spec nennt nur diese drei. | Umschalt+Taste löst ein Pad aus, obwohl ein Bediener das nicht erwartet; ein Wächter müsste `shiftKey` ergänzen. |
| A7 | SC-S2 | Das Fenster-Geheimnis hat 32 Zufallsbytes als Hex und gilt je Start. `studio:fensterGeheimnis` gibt es nur an die Webinhalte des Hauptfensters, nur im Hauptrahmen und nur auf der eigenen Seite (`file://…/renderer/index.html` oder im Dev die Vite-Adresse). Das Fenster schickt es als `X-JMS-Fenster` bzw. `auth.fenster`; `Authorization` geht weiter mit, damit Logout die Sitzung widerruft. | Wer das Geheimnis nicht hat, ist auch auf demselben Rechner nicht Admin; ohne den Token-Kopf liefe der Logout ins Leere. | Eine Seite, die das Geheimnis liest, hätte Admin-Rechte. Verschärfung durch R13. |
| A8 | SC-S2 | Als eigen gilt: kein `Origin` (Programme, sie brauchen ein Konto) und `Origin` gleich `http://` + `Host` (Browser vom Server selbst, ohne Groß/Klein); `null` und `file://` (das App-Fenster; ohne Geheimnis bleibt nur die Anmeldung). Nur ohne Paket (`!app.isPackaged`) kommen die Vite-Adressen `http://localhost:5174`, `http://127.0.0.1:5174` und der Ursprung von `ELECTRON_RENDERER_URL` dazu. Alles andere: HTTP 403 `{"error":"origin"}`; Socket.IO lehnt per `allowRequest` ab. | Browser auf einem anderen Gerät schicken Origin und Host mit derselben Adresse, also funktioniert die Anmeldung dort weiter. | Ein Browser, der hinter einem Namens-Proxy mit abweichendem `Host` hängt, wird abgewiesen; ein Programm ohne Origin wird nicht abgewiesen, aber auch nicht Admin. |
| A9 | SC-S1 | Der Panel-Abschnitt „Browser-Zugang“ nennt den Pfad der Erst-Passwort-Datei, solange die Datei besteht; gemessen wird beim Öffnen des Panels. Anmeldung und Konto beim ersten Start bleiben, weil die Messung in Task 5 kein bekanntes oder leeres Passwort fand. | Die Spec verlangt die Anzeige nur, wenn die Messung eine Lücke findet. | Fände eine spätere Messung doch ein bekanntes Passwort, wäre der Hinweis zu wenig und die Anmeldung müsste angepasst werden. |
| A10 | alle | Neue Versionen: Player 0.9.1 → 0.10.0, Studio-Control 0.7.0 → 0.8.0 (Minor, drei bis vier Release-Notizen). | Sichtbar geänderte Bedienung, nicht nur Fehlerkorrektur. | Eine falsche Zählung kostet nichts außer einem umzubenennenden Tag; die Versionen stehen noch in keinem Katalog. |

## 2. Rulings des Controllers (R1 bis R13)

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

## 3. Vermerkte Kleinigkeiten, nicht behoben (Minor)

Jede Zeile ein Fund eines Prüfers, mit Datei und Zeile (Stand des Branches bei der Prüfung; die Zeilen können sich verschoben haben). Nichts davon blockierte die Freigabe der Stufe. Wo ein Punkt eine Frage an den Owner ist, steht er unter „Offene Fragen“ der Texttabelle.

### Player

Task 1 (Ausgabefenster, `main/`):
- M1 Neuladen (Strg+R) oder Absturz der Ausgabeseite setzt „bereit“ nicht zurück; Befehle vor dem neuen Abo gehen verloren (Altverhalten): `main/ausgabe-fenster.ts:67-69`.
- M2 Der Zweig „bereit eines unbekannten oder geschlossenen Fensters → sofort `false`“ hat keinen Test; `laufeAb` gibt bei einem unbekannten Fenster nicht frei: `main/ausgabe-fenster.ts:69`, `:84`.
- M3 `istNeuestes` beachtet den Schließ-Wunsch nicht; der Absturz eines schließenden Fensters ohne Nachfolger meldet „abgestürzt“ (wie vorher): `main/ausgabe-fenster.ts:38`.

Task 2 (Pause und Fernbefehle):
- Die Log-Zeile „Show hat 1 Cues“ steht ohne Einzahl: `R/lib/fernbefehl.ts:13`.
- Die Standard-Uhr `Date.now()` springt mit der Systemzeit; `performance.now()` wäre fest: `R/lib/vorlauf.ts:11`.
- Der Kommentar „mit seiner vollen Zeit“ ist ungenau: `R/lib/vorlauf.ts:30`.
- `selectShow` schreibt nach `await` erneut `showPaused: false`; ein Companion-`pause` in der Lücke lässt Vorläufe angehalten ohne sichtbare Pause: `R/store/player.ts:462-464`.
- Der letzte Wert im Test ist nach `showTogglePause()` trivial wahr: `test/store.test.ts:262-266`.
- Knappe Zeitreserven mit echten Zeitgebern (sonst 90 ms): `test/store.test.ts:299-301`, `:331`, `:381`.
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
- AltGr (Strg+Alt) sperrt Pads auf `@`, `€`, `{`, `[`, `\`, `~`, `|`; das Tastenfeld nimmt diese Tasten weiter an (Owner-Frage 1 der Texttabelle): `R/lib/oberflaeche.ts:415`, `R/views/SoundboardView.tsx:289-296`.
- Kein Wächter für `padTasteErlaubt` gegenüber `istEingabeZiel` (`contentEditable`, `TEXTAREA`, `SELECT`): `test/oberflaeche.test.ts:686`, `:747`, `test/rahmen.test.tsx:277`.
- Die Zählung `confirm|prompt === 3` in `ShowView` gilt für beide zusammen statt getrennt: `test/ui/funktionsliste.test.ts:735`.
- Toter Zweig und veralteter Text im Wächter Nr. 87–90: `test/ui/funktionsliste.test.ts:646-647`.
- Widersprüchliche Zelltexte in der Funktionsliste Nr. 19, 50, 77, 134: `docs/ux/funktionslisten/player.md:92`, `:123`, `:160`, `:249`.
- Die Rückfrage nennt einen Cue ohne Medium „—“ statt „Medium fehlt“ wie die Zeile: `R/views/ShowView.tsx:138` gegen `:374`.
- Scheitert `library.nutzung`, tut ✕ still nichts: `R/views/LibraryView.tsx:313-317`.
- `panelOffen` lässt das memoisierte Soundboard bei jedem Panel-Wechsel neu rendern; der Wächtertext sagt etwas anderes: `R/views/PlayerOberflaeche.tsx:190`, `test/rahmen.test.tsx:127-130`.
- Dritte Kopie der Kanal-Zählhilfe: `test/bruecken.test.ts:645`.
- Keine Verhaltensprüfung der Rückfrage-Verdrahtung (nur Quelltext): `R/views/ShowView.tsx:137-141`, `R/views/LibraryView.tsx:313-317`.

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

## 4. Kandidaten für eine spätere Runde

Beobachtungen außerhalb des Auftrags dieser Stufe; sie stehen als Kandidaten in `docs/ux/altfehler-inventar.md`, Abschnitt 7, nicht als behoben:
- Studio-Control: Das Entfernen eines ATEM schickt kein neues `atem:state` (Altverhalten, Task 6).
- `setWindowOpenHandler` gibt jedes Schema an `shell.openExternal` (`main/index.ts:95-98`, Altverhalten).
- Eine ins Studio-Control-Fenster gezogene Datei navigiert weg (Bedienung, nicht mehr Sicherheit).
- `loadMain` lädt `ELECTRON_RENDERER_URL` auch im Paket (`main/index.ts:57-64`); das Geheimnis geht dorthin nicht (R13), das Fenster zeigt dann aber eine fremde Adresse.
