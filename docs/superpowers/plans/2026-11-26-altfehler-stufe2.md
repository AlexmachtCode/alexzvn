# Altfehler Runde 1, Stufe 2: Player, Interpreter, Stage Display, Caption, Recorder, Presenter, Connect — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die 19 Befunde der Stufe 2 (Spec Abschnitt 5) und die vier Zusätze des Nachtrags (Abschnitt 8: PL-K1, PL-K2, RE-NAS,
RE-PLATZ) erreichen ihr Zielverhalten; PS-10 bekommt nur den Handbuchsatz. Jeder behobene Befund hat einen Test, der vorher rot war.

**Architecture:**
- **Je App ein Block, je Block ein Release** (Spec 2, Nachtrag „Release“). Reihenfolge: Player (Task 1), Interpreter (2), Stage
  Display (3), Caption (4–5), Recorder (6–7), Presenter mit Companion-Modul (8), Connect (9), dann Versionen und Texte (10) und Doku (11).
- **Neue Logik kommt in reine Module ohne Electron** (`src/shared/*.ts`, `R/lib/*.ts`, reine `main/*.ts` ohne `electron`-Import),
  damit `tsx` sie testet. Hauptprozess und Preload bekommen Quelltext-Wächter (Ruling R3 aus Stufe 1).
- **Funktionslisten:** Caption, Interpreter, Stage Display und Recorder bekommen zuerst die Bindung „Altfehler ‹ID›“ an Dateien
  (Map `ALTFEHLER`, Muster `apps/player/test/ui/funktionsliste.test.ts:134-190`); Player, Presenter und Connect haben ihren Weg schon.
- **Abgelehnte Fernbefehle** (Recorder RE-2, RE-2b, RE-7b; Caption CA-11) ändern nichts, Companion sieht es an den bestehenden
  Zustandswerten, das Fenster nennt den Grund, das Log hat eine Zeile. Protokoll und Companion-Modul bleiben dafür unverändert.

**Tech Stack:** Electron 33, React 18, TypeScript, zustand, Web Audio, `@jm/ui` (`Modal`, `NumberInput`, `TallyButton`),
`@jm/settings` (`PeersSection`). Tests mit `tsx` und `@jm/ui/testhilfe` (`ok`, `gleich`, `leseText`, `render`), ältere Ketten
mit eigenem `ck`. Echt-Fenster-Messung per CDP wie in Stufe 1.

**Spec:** `docs/superpowers/specs/2026-11-25-altfehler-runde1-design.md` (Owner-Freigabe 25.11.2026 14:08, Nachtrag Abschnitt 8
Owner 26.11.2026 12:13). Abschnitte 2 und 3, die Stufe-2-Tabellen in Abschnitt 5, „Abgelehnte Fernbefehle“ und Abschnitt 8 sind
bindend. Zeilenangaben dieses Plans gelten für `eb8670b224` (Code) und kommen aus den drei Bestandsaufnahmen unter
`.superpowers/sdd/2026-11-26-altfehler-stufe2/recon/`; die Festlegungen B1–B7, C1–C10 und P1–P9 stehen unten.

## Global Constraints

- **Nur die Stellen der Spec (Abschnitt 5, Stufe 2, und Abschnitt 8) ändern ihr Verhalten.** Alles andere bleibt: Ports, Verben,
  Protokoll `@jm/suite-control-protocol`, `capabilities.ts` (P1). Am Companion-Modul ändert sich nur die Wahl an „Schwarz“ und
  „Weiß“ (PS-18). Neu sind nur die IPC-Kanäle unten.
- **TDD:** Jeder Test ist erst rot, dann grün. Logik bekommt eine Mutationsprobe (Änderung zurücknehmen → Test rot); das Ergebnis
  steht im Bericht.
- **Node 22:** `export PATH="/c/Users/alexk/AppData/Local/Temp/claude/5dcb13dfa9326af2/d9a2ccbe-f7cf-45d6-bb7e-1e766347e2af/scratchpad/node22:$PATH"`.
  Alle Befehle laufen im Worktree `C:/Users/alexk/alexzvn/.claude/worktrees/altfehler2` (Branch `feat/altfehler-stufe2`).
  `ELECTRON_RUN_AS_NODE` vor jedem Testlauf aus der Umgebung nehmen.
- **Tests je App** (Exit 0, die UI-Läufe enden mit `ALLE TESTS OK`):
  - `npm run selftest -w @jm/<app>` und `npm run typecheck -w @jm/<app>` für `player`, `interpreter`, `stage-display`, `caption`,
    `recorder`, `presenter`, `connect`;
  - `npm run selftest -w @jm/settings` und `npm run typecheck -w @jm/settings` (nur Task 3);
  - `node packages/companion-jm-suite/test/selftest.mjs` (nur Task 8).
- **Funktionslisten-Tests bleiben grün,** im normalen Lauf und mit `JM_FUNKTIONSLISTE_GIT=1`:
  - Neue Dateien vor dem GIT-Lauf stagen (`git add`), sonst sieht `git diff` sie nicht.
  - Jede geänderte Datei der App steht in `GEAENDERT` von `apps/<app>/test/ui/funktionsliste.test.ts`.
  - Eine Zeile „unverändert (…)“ in `docs/ux/funktionslisten/<app>.md`, die eine geänderte Datei nennt, bekommt den Verweis
    „Altfehler ‹ID›“; die ID steht in der Map `ALTFEHLER` mit genau dieser Datei (Ruling R6). Bekommt eine Datei mehr als lesende
    Brücken, verlässt sie `NUR_MELDUNG`.
  - Zeilenzahl (`GESAMT`, `JE_ABSCHNITT`) und Reihenfolge bleiben; es kommt keine neue Zeile dazu.
  - Wächter, die altes Verhalten festschreiben, werden auf das neue umgestellt; der Testtext nennt die ID. In Abschnitt 10 der Liste
    bleibt der alte Satz stehen, dahinter kommt „Altfehler Stufe 2 (‹ID›): …“ (Lehre „Widerruf: alten Text stehen lassen“).
  - Die Switcher-Liste ist im GIT-Modus schon auf `eb8670b224` rot (P9); sie wird hier weder geprüft noch geändert.
- **Texte:**
  - Neue sichtbare Texte stehen in den Textobjekten der App (`CAPTION_TEXTE`, `INTERPRETER_TEXTE`, `STAGE_TEXTE`,
    `RECORDER_TEXTE`) oder in der Konstante eines neuen Moduls, die der Task nennt; nie verstreut im JSX.
  - Kein Textwert darf einem Text aus `@jm/settings` oder `@jm/ui` gleichen (Wächter in `oberflaeche.test.ts` aller vier Apps);
    gemeinsame Wörter werden aus dem Paket benutzt, nicht nachgebaut.
  - Wortlaut wie in diesem Plan. Es sind Entwürfe; die Owner-Freigabe läuft über Task 10.
  - Typografische Anführungszeichen „…“, nie ASCII-`"` in Texten und Changelog.
- **Keine neuen Abhängigkeiten, kein `npm install`** (Ausnahme Task 10: `npm install --ignore-scripts --package-lock-only`).
- **Git:** Dateien mit LF; `git -c core.autocrlf=false` für add und commit; Pfade einzeln stagen, nach jedem add
  `git status --short` lesen; nie `git config`, nie pushen; jeder Commit endet mit
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Edit/Write:** In Dateien, die mit Edit oder Write entstehen, nie `\u` mit vier Hexziffern schreiben (das Werkzeug macht daraus
  ein Zeichen); Windows-Pfade in Tests ohne `\u…`, etwa `'\\\\nas\\x'`.
- **Bauweise (C9):** Befunde, die dieselbe Datei ändern, entstehen nacheinander; innerhalb einer App nie parallel.
- **Neue IPC-Kanäle (genau diese Namen):**
  - Recorder: `recorder:ablehnung` (invoke), `recorder:netzordnerBestaetigen` (invoke), `fs:platz` (invoke),
    `recorder:schliessenFrage` (send, Main → Fenster), `recorder:schliessenAntwort` (invoke, Fenster → Main).
  - Caption: `caption:correctLine` ersetzt `caption:correctLast`.
  - Geänderte Rückgaben: Recorder `rec:disarm` → `OpResult`; `settings:load` liefert `ordnerDa: null`.

## Review Focus

1. **Recorder: Eine Show mit Netzwerkordner kommt während einer laufenden Aufnahme** (Launcher-Link, niemand am Rechner). Erwartet:
   Die Aufnahme schreibt weiter in ihren Ordner, Companion `RECORD OFF` stoppt sie, ein folgendes `RECORD ON` wird mit „noch nicht
   bestätigt“ abgelehnt, und die Einstellungen behalten den alten Ordner (Task 6, Test „RE-7b Show-Vorschlag während der Aufnahme“).
2. **Recorder: Der Zielordner besteht noch nicht oder ist eine UNC-Freigabe** (`\\nas\share\Neu\Tag1`, erster Start). Erwartet: Der
   Platz wird am nächsten vorhandenen Vorfahren gemessen, an der Freigabe-Wurzel hört die Suche auf, nie eine Schleife; sonst
   „Platz unbekannt“ (Task 7, Test „RE-PLATZ elternOrdner endet an der Wurzel“).
3. **Interpreter: Der Start scheitert sofort** (Mikrofon-Recht fehlt, `getUserMedia` lehnt ab). Erwartet: Die Sperre geht weg, der
   Fehler steht, „Starten“ ist frei und ein neuer Start geht (Task 2, Test „IN-3 Start scheitert: Sperre frei, nächster Start geht“).
4. **Player: Pause, während die Ausgabe noch auf „bereit“ wartet, dann GO auf einen Ton-Cue.** Erwartet: Das Video lädt und läuft,
   die Töne laufen, keine Pause bleibt hängen (Task 1, Test „PL-K2 Pause beim Warten auf bereit, dann GO auf Ton“).
5. **Connect: Die Slots fallen während der Sperrsekunde auf 0.** Erwartet: Ein Klick verlässt sofort wie heute, ohne zweite Frage
   (Task 9, Test „CN-MV keine Slots mehr während der Sperre: Klick verlässt“).

---

## Vor Task 1 (Controller, kein Helfer)

1. **Stand:** `git log --oneline -1` zeigt den Plan-Commit über `731f5aa8b8`, `git status --short` ist leer.
2. **Abhängigkeiten:** `node_modules` liegt im Worktree (Bestandsaufnahme). Link-Prüfung
   `node .superpowers/sdd/2026-11-26-altfehler-stufe2/vorlagen-stufe1/referenz/links-schreibweise.mjs C:/Users/alexk/alexzvn/.claude/worktrees/altfehler2`
   muss Exit 0 haben; sonst Links mit kleinem „c:“ per `rmdir` und `mklink /J` auf „C:“ umstellen.
3. **Grundstand:** liegt als `out/base3-*.log` im Ledger (alle sieben Apps, Typprüfung, GIT-Modus, Companion-Modul). Nach dem
   Plan-Commit nur die Link-Prüfung wiederholen.
4. **Ledger:** `.superpowers/sdd/2026-11-26-altfehler-stufe2/progress.md` (Ablauf, `Ruling:`-Zeilen). Messvorlagen in
   `vorlagen-stufe1/` (`t1-messung.mjs`, `t3-messung.mjs`, `t6-messung.mjs`, `referenz/plz1-*`, `referenz/messung-vorlage.mjs`),
   Prüfskript-Vorlage `vorlagen-stufe1/pruefe-texte.mjs`.
5. Jeder Helfer bekommt die Abschnitte „Global Constraints“, „Echt-Fenster-Messung“ (bei Messung) und die Festlegungen, die sein
   Task nennt, wörtlich.

## Echt-Fenster-Messung (gilt für jede Aufgabe mit Messung)

- **Isoliert:**
  - eigenes Profil im Scratchpad (`--user-data-dir`), `USERPROFILE`, `APPDATA` und `LOCALAPPDATA` umgelenkt (Pfadprobe vor dem Start:
    Der Pfad der Einstellungsdatei liegt im Scratchpad);
  - aus der Umgebung nehmen: `ELECTRON_RUN_AS_NODE`, `ELECTRON_RENDERER_URL`, `NODE_OPTIONS` und alle `JM_*`, `JMPS_*`, `ZOOM_*`;
    `JMPS_HUB_URL` zeigt auf einen eigenen Blocker;
  - echtes Profil vorher und nachher abbilden (Dateiliste mit Zeitstempeln) und vergleichen.
- **Ports:** Vorher prüfen, dass der Steuerport frei ist; sonst abbrechen und melden, nichts beenden. Ein Blocker bindet ihn für die
  ganze Messung: Player 8725, Recorder 8729, Caption 8732, Connect 8737 (dazu prüfen, dass der Launcher 8736 nicht hält). Interpreter
  und Stage Display haben keinen Steuerport. CDP und Inspector nur auf 127.0.0.1.
- **Bedienung nur per CDP** (`--remote-debugging-port`, für den Hauptprozess `--inspect=<port>`), nie globale Tastendrücke oder
  Mausklicks. Fensterzählung nur lesend wie in `referenz/plz1-fenster.cs`.
- **Medien:** nur Fake-Medien. Mikrofone über `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream`, dazu `--mute-audio`.
  Test-Video (3 s MP4, `ffmpeg-static` der Hauptkopie, R4) und Test-Ton (2 s WAV) erzeugt der Helfer im Scratchpad. Kein echtes Gerät,
  kein echtes Mikrofon, keine Kamera, kein Netzordner.
- **Laufzeit:**
  - Electron der Hauptkopie nur lesend: `C:/Users/alexk/alexzvn/node_modules/electron/dist/electron.exe` mit dem App-Ordner.
  - Bau vor der Messung: `npm run build -w @jm/<app>` (electron-vite, schreibt `apps/<app>/out`).
  - Fehlt ein natives Modul im Worktree (`better-sqlite3` für den Player, `packages/ndi/build` für Connect), wird es aus der
    Hauptkopie verzweigt (`cmd //c mklink /J`, Laufwerk groß `C:`), nur bei gleicher Version (`.forge-meta`). Am Ende löst nur
    `cmd //c rmdir` die Verzweigung, nie `del`; danach Link-Prüfung (Exit 0).
- **Ergebnis:** Skript `.superpowers/sdd/2026-11-26-altfehler-stufe2/t<N>-messung.mjs`, JSON und Log nach `out/t<N>-messung.json`
  bzw. `.log`, Bericht mit den Zahlen. Kein Geheimnis, keine PIN aus dem Testprofil in Log, Bericht oder Chat.

## Entscheidungen, wo Spec und Code schweigen (Owner zur Kenntnis)

Jede steht als `Ruling:` im Ledger und kommt in Task 11 nach `docs/ux/altfehler-entscheidungen.md`. B, C und P sind Festlegungen
des Controllers (Owner 26.11. 12:13 „los“, keine Rückfragen); D sind Festlegungen dieses Plans für die Lücken, die danach blieben.

### Recorder (B)

- **B1 – RE-3, Geräteverlust** (Task 7): Wächter im Hauptprozess, nur bei Eingängen, die kein Loopback sind. Kommen während einer
  Aufnahme 2 s lang keine Blöcke, geht es denselben Weg wie ein Schreibfehler: Die Aufnahme endet sauber, das Fehlerfeld bleibt.
  Grund: „nie REC, während nichts geschrieben wird“. *Kostet, wenn falsch:* Ein USB-Aussetzer über 2 s beendet die Aufnahme; die
  Datei bis dahin ist sicher, eine neue Aufnahme muss gestartet werden.
- **B2 – RE-3, Verhalten** (Task 7): Schreibfehler werden in `onFrames` immer abgefangen, keiner erreicht das Addon. Variante
  „sauber enden“: Datei abschließen, Zustand `armed`, neues Fehlerfeld bis zum nächsten Start oder Stopp; Companion sieht
  `recording=0`, der Steuerserver ändert sich nicht. Auch ein gescheiterter Start setzt das Fehlerfeld. Gemessen wird im Test mit
  einem Schreiber, der wirft; die Abnahme bekommt einen Schritt „USB-Stick während der Aufnahme abziehen“. *Kostet, wenn falsch:*
  Das Addon verhält sich am echten Datenträger anders; das zeigt die Abnahme.
- **B3 – RE-7a** (Task 7): Die Rückfrage beim Schließen erscheint im Fenster wie R16 im Player, per CDP messbar, ohne den
  Hauptprozess zu blockieren. Rückfall: Bestätigt das Fenster die Frage nicht binnen 1 s, fragt der Hauptprozess mit einem nicht
  blockierenden nativen Dialog. Abmelden oder Herunterfahren beenden ohne Frage, die Datei wird sauber abgeschlossen. Mac Cmd+Q:
  erst fragen, dann den Steuerserver beenden. *Kostet, wenn falsch:* ein zusätzlicher Rückfallweg im Code.
- **B4 – RE-7b** (Task 6): Ein unbestätigter Netzwerkordner aus einer Show setzt „kein Ordner“ nur im Speicher („wartet auf
  Bestätigung“); der gemerkte Ordner der Einstellungen wird erst überschrieben, wenn bestätigt oder neu gewählt ist. Ein Show-Ordner
  gleich dem gesetzten gilt als bestätigt. „Übernehmen“ im Preset-Import merkt den Netzwerkordner als bestätigt. Die Prüfung läuft
  ohne Blockade; das synchrone Lesen der Show-Datei bleibt und kommt als Kandidat ins Inventar. *Kostet, wenn falsch:* Ein Bediener
  bestätigt einen Ordner, den er schon kennt, einmal mehr.
- **B5 – RE-PLATZ** (Task 7): `fs.promises.statfs` alle 5 s, höchstens eine Abfrage je Pfad zugleich, Zeitgrenze 3 s, danach „Platz
  unbekannt“. Bytes je Sekunde = Kanäle × Samplerate × 4 (32-bit Float), × 2 bei „Spuren einzeln“ mit mehr als einem Kanal. Das
  Handbuch „~10 MB pro Kanal und Minute bei 24 bit“ wird zu 32-bit Float und 11,5 MB, doppelt mit „Spuren einzeln“. Keine neue
  Zeile in der Funktionsliste (138 fest); die Statusleisten-Zeile nennt den Eintrag. IDs: RE-NAS, RE-PLATZ. *Kostet, wenn falsch:*
  Die Restzeit ist am NAS ungenau oder öfter „unbekannt“.
- **B6 – Gemeinsamer Ablehnungsweg** (Task 6): reines Prüfmodul `R/lib/fernbefehl.ts` und Kanal `recorder:ablehnung` für Log und
  Meldung bis „OK“; RE-2 zusätzlich mit einem Wächter im Hauptprozess, damit ein ARM kurz nach RECORD ON keine Aufnahme beendet.
  *Kostet, wenn falsch:* ein Kanal mehr.
- **B7 – Funktionsliste Recorder** (Task 6, 7): eine Altfehler-Bindung je ID an Dateien wie im Player; Wächter des alten Verhaltens
  werden auf das neue umgestellt, jede Umstellung nennt die ID; `R/components/PresetLeiste.tsx` bleibt unberührt (Hash-Wächter
  `test/ui/live.test.tsx:449-451`).

### Caption, Interpreter, Stage Display (C)

- **C1 – CA-8** (Task 5): Zahlenfeld wie im Recorder (`NumberInput` aus `@jm/ui`): Ein ungültiger Wert zeigt einen Fehlertext und wirkt
  nicht. Zusätzlich zieht der Hauptprozess Werte aus Datei und IPC auf die Grenzen; eine Schriftgröße unter dem Mindestwert gibt es
  nirgends. *Kostet, wenn falsch:* „auf die Grenzen gezogen“ gilt nur für Datei und IPC, nicht im Feld.
- **C2 – CA-11** (Task 5): Fix im Code mit Test; Changelog „nicht auf dem Mac gemessen“. Kein lokal gebautes DMG; Release nur
  Windows wie in 2a (Info an den Owner, kein Blocker). Companion `transcribe on` bei geschlossenem Fenster wird abgelehnt.
  *Kostet, wenn falsch:* Auf dem Mac startet Companion die Transkription erst wieder, wenn jemand das Fenster über das Dock öffnet.
- **C3 – CA-1** (Task 4): Der Fehler steht im Fenster bis zum nächsten Start (einen Stopp gibt es nicht mehr, `running` ist schon 0).
  Ein Mikrofon, das im Lauf ausfällt, ist Kandidat CA-K1. *Kostet, wenn falsch:* Ein Ausfall mitten im Lauf bleibt bis zur nächsten
  Runde still.
- **C4 – IN-3** (Task 2): Die Startsperre hat eine Frist von 15 s. Danach gilt der Start als gescheitert: Fehler im Fenster, Taste
  frei, die Engine räumt den halben Start auf. *Kostet, wenn falsch:* Ein Gerät, das länger als 15 s zum Start braucht, wird
  abgebrochen.
- **C5 – SD-3** (Task 3): `@jm/settings` bekommt `PeerRow.eingerichtet?: boolean` und den Text „nicht erreichbar“; die anderen Apps
  bleiben unberührt. Gefundene andere Hosts werden nicht als Vorschläge angezeigt. *Kostet, wenn falsch:* Ein gemeinsames Paket
  ändert sich; die Typprüfung aller Workspaces in der CI deckt das ab (Folge im GIT-Modus: D10).
- **C6 – SD-1** (Task 3): Neues gemerktes Feld `nachrichtEntwurf`. „Senden“ mit leerem Entwurf nimmt die Nachricht von der Bühne; die
  Texttabelle nennt das. *Kostet, wenn falsch:* ein Klick mehr, um eine Nachricht abzunehmen.
- **C7 – Interpreter** (Task 10, 11): Kein Handbuch (Entscheid aus 2a); die Änderung steht nur im Changelog.
- **C8 – Funktionslisten** (Task 2, 3, 4, 6): Caption, Interpreter und Stage Display bekommen vorab die Bindung „Altfehler ‹ID›“ an
  Dateien wie der Player; das ist je App der erste Schritt.
- **C9 – Bauweise:** Befunde mit derselben Datei nacheinander, innerhalb einer App nie parallel.
- **C10 – Versionen** (Task 10): Caption 0.7.0, Interpreter 0.3.1, Stage Display 0.8.0, Recorder 0.11.0, Player 0.10.1.

### Presenter, Connect, Player (P)

- **P1 – PS-18, Ort der Wahl** (Task 8): Die Wahl steht nur im Companion-Modul (`lib.mjs`), nicht in `capabilities.ts`. Grund: Dort
  würde der GIT-Modus die Funktionslisten von acht Apps rot machen (gemessen, 50 Zeilen), und Rundown bekäme die Wahl. *Kostet, wenn
  falsch:* Die gemeinsame Tabelle kennt die Wahl nicht; Rundown bietet sie nicht an.
- **P2 – PS-18, Verträglichkeit und Bau** (Task 8): Fehlt die Wahl, gilt „umschalten“, im Modul und im Presenter; unbekannte Werte
  schalten ebenfalls um. Modul 0.4.0 mit einem Presenter bis 0.15.0 schaltet bei jeder Wahl um (Changelog, README). Abnahmeschritt
  mit echtem Companion. Bau: `node_modules` des Modulordners als Junction aus der Hauptkopie (nur lesen, `C:`), danach `rmdir`; kein
  `npm install`. Das Asset `jm-suite-companion-0.4.0.tgz` hängt am Release `presenter-v0.15.1`, nur mit Owner-OK. *Kostet, wenn
  falsch:* Fehlt der Rückfall, wirken alte Tasten anders; das fängt der Abnahmeschritt.
- **P3 – PL-K2, Umfang** (Task 1): Gilt nur für ein GO, das die Pause aufhebt (GO ohne Vorlauf); GO mit Vorlauf bleibt wie A1. Geweckt
  wird nur, was angehalten ist; ein Video, das von selbst zu Ende lief, startet nicht neu. Derselbe Fehler bei „Weiter“ nach dem
  natürlichen Ende kommt als Teil von PL-K2 mit eigenem Test hinein. *Kostet, wenn falsch:* etwas mehr Zustand im Store.
- **P4 – PL-K1, Randfall** (Task 1): Auch ein Video-Cue, der beim Warten auf „bereit“ (PL-N) gelöscht wird, startet nicht mehr.
  *Kostet, wenn falsch:* ein Test mehr.
- **P5 – PS-10** (Task 11): Nur Doku. Handbuchsatz: Esc beendet die Präsentation sofort und ohne Rückfrage, im Referenten, im
  Publikumsfenster und in der Übersicht; im Panel schließt Esc das Panel. „Handy-Fenster“ in Spec und Inventar ist seit 2b veraltet
  und wird im Inventar berichtigt.
- **P6 – CN-MV** (Task 9): „Ja, verlassen“ nimmt erst nach 1 s Klicks an (Tastenplatz-Regel W79, Plan 2b `:77-78`). `aria-disabled`
  oder `disabled` entscheidet die Messung; Kriterium: Der Tastaturfokus bleibt. Dass „Ja, verlassen“ nie verfällt, ist Kandidat
  CN-K1. *Kostet, wenn falsch:* Ein gewollter schneller zweiter Klick braucht 1 s länger.
- **P7 – PS-15** (Task 8): Die Handy-Seite prüft die PIN über `/events?pin=`; das schaltet nichts. Kein neues Verb in `remote.ts`.
  Die zehn betroffenen Zeilen und der Ort „Handy-Seite“ im Ortsregister werden nachgeführt.
- **P8 – Versionen** (Task 8, 10): Presenter 0.15.1, Connect 0.6.1, Companion-Modul 0.4.0.
- **P9 – Beobachtung außerhalb:** Die Switcher-Funktionsliste ist im GIT-Modus schon auf `eb8670b224` rot; Info an den Owner, kein Fix.

### Festlegungen dieses Plans (D)

- **D1 – RE-7b, Vorschlag verwerfen** (Task 6): Das „×“ des Hinweiskastens, „Ordner wählen“ und ein Preset, das einen Ordner setzt,
  beenden den Show-Vorschlag. Beim „×“ gilt wieder der Ordner von vorher (`dirGemerkt`). *Kostet, wenn falsch:* Wer „×“ nur zum
  Wegklicken drückt, nimmt im alten Ordner auf statt in keinem.
- **D2 – RE-7b, gleicher Ordner** (Task 6): Ein Show-Ordner, der normiert gleich dem gesetzten ist, wird gesetzt und gemerkt wie nach
  „Übernehmen“ (B4). *Kostet, wenn falsch:* ein Eintrag mehr in `recorder-netzordner.json`.
- **D3 – RE-3, Fehlerfeld** (Task 7): `RecorderFehler = { art: 'schreiben' | 'eingang' | 'start'; text; datei }`. Gelöscht wird es bei
  einem gelungenen Start, bei `arm`, beim Schließen des Eingangs und bei einem Stopp im Fehlerzustand; der Stopp ist dann eine
  Quittung (`ok: true`, ohne Datei). Ein Schreibfehler löscht auch geplante Start- und Stopp-Zeitgeber. Die Log-Zeile kommt über
  einen eingehängten Schreiber (`setProtokoll`), weil `main/recorder.ts` ohne `@jm/app-runtime` testbar bleiben muss. *Kostet, wenn
  falsch:* Ein geplanter Stopp nach einem Fehler meldet nichts mehr (heute meldet er ohnehin nichts, RE-13).
- **D4 – RE-7a, Ablauf** (Task 7): Die erste Antwort gilt, aus dem Fenster oder dem Rückfall-Dialog; greift der Rückfall, schließt der
  Main die Frage im Fenster (`recorder:schliessenFrage` mit `false`). Nach „Aufnahme beenden“ auf einen Cmd+Q hin beendet der Main
  die App; „Weiter aufnehmen“ verwirft den Wunsch. Endet die Aufnahme, während die Frage offen ist, bleibt sie offen bis zur
  Antwort. *Kostet, wenn falsch:* ein Klick mehr nach einem Fehler während der Frage.
- **D5 – PL-K2, „angehalten“** (Task 1): Das Ausgabevideo gilt als angehalten, wenn bei pausierter Show `videoCue !== null` ist; jeder
  Weg, der in der Pause einen Video-Cue hält, hat `pause` geschickt (Pause-Taste, K5). Ein eigener Merker entfällt; P3 bleibt
  erfüllt. *Kostet, wenn falsch:* Ein Video, das ohne `videoCue` angehalten wäre, bliebe stehen; einen solchen Weg gibt es laut Code
  nicht.
- **D6 – IN-3, Frist im Test** (Task 2): Die Frist ist ein Konstruktorwert der Engine (Standard `START_FRIST_MS`), damit der Test mit
  30 ms läuft; der Fehlertext ist eine Konstante in `R/core/engine.ts`. *Kostet, wenn falsch:* nichts am Verhalten.
- **D7 – SD-5, „Setzen“** (Task 3): Der Knopf nutzt `PEERS_TEXTE.setzen` aus `@jm/settings`; ein eigener Wert in `STAGE_TEXTE` würde
  den Wächter „kein STAGE_TEXTE-Wert gleicht einem Text aus @jm/settings“ (`test/ui/oberflaeche.test.ts:322`) rot machen.
- **D8 – CA-11, Grund der Ablehnung** (Task 5): Der Grund steht in `state.error`; das Fenster zeigt ihn, sobald es wieder offen ist
  (Live-Bereich und Statuseintrag „Fehler“), der nächste Start löscht ihn. Abgelehnt wird nur `transcribe`, wenn es einschalten würde.
  *Kostet, wenn falsch:* Ein Text bleibt stehen, bis jemand startet.
- **D9 – CN-MV, Darstellung** (Task 9): gebaut mit `aria-disabled`, der Klick wird während der Sperre verworfen, Platz und Text bleiben.
  Zeigt die Messung, dass der Fokus nicht bleibt, ist das ein BLOCKED-Bericht, kein Umbau auf `disabled` ohne Controller.
- **D10 – SD-3, Folge im GIT-Modus** (Task 3): Eine Änderung an `packages/settings/src/abschnitte/peers.ts` macht im GIT-Modus die
  Prüfung „PAKETE_GEAENDERT gleich den geänderten Quelldateien der Pakete“ in Connect, Presenter und Studio-Control rot (deren
  Erhebung liegt nach der letzten Änderung von `peers.ts`, `98e69e12b3`). Task 3 trägt die Datei dort in `PAKETE_GEAENDERT` ein.
  *Kostet, wenn falsch:* drei Testdateien mehr im Task.
- **D11 – Zusätzliche Messungen:** Spec 7 verlangt für Stufe 2 RE-7a und CN-MV. Weil „was im Betrieb sichtbar ist, ist im echten
  Fenster nachgemessen“ (Spec 1), messen die Tasks zusätzlich, was ohne Netz, Whisper und echtes Gerät geht: PL-K2 (Task 1), IN-3
  (Task 2), SD-1 (Task 3), CA-1 (Task 4), CA-8 (Task 5). CA-4 und CA-5 brauchen Whisper mit einer Sprachdatei und bleiben beim Test am
  Code und in der Abnahme. *Kostet, wenn falsch:* Messzeit.

---

## Aufgaben

### Task 1: Player 0.10.1 · gelöschter Cue startet nicht, GO hebt die Pause ganz auf (PL-K1, PL-K2)

**Files:**
- Modify: `apps/player/src/renderer/src/lib/vorlauf.ts:41-45` (`starte` mit Schlüssel), neu `abbrechen`
- Modify: `apps/player/src/renderer/src/store/player.ts:502-507` (`removeShowCue`), `:538-616` (`startNow`, `vorlaeufe.starte`),
  `:649-663` (`showTogglePause`)
- Modify: `apps/player/src/renderer/src/lib/oberflaeche.ts:210-211` (nur der Kommentar zum bekannten Irrtum)
- Modify: `apps/player/test/ui/funktionsliste.test.ts:134-190` (Map `ALTFEHLER`, Kommentare „sieben“ → „neun“ bei `:137`, `:369`),
  `docs/ux/funktionslisten/player.md` (Nr. 50, 94, 99)
- Test: `apps/player/test/ui/ablauf.test.ts`, `apps/player/test/ui/store.test.ts`

**Interfaces:**
- Produces (`R/lib/vorlauf.ts`):
  - `Vorlaeufe.starte(ms: number, f: () => void, schluessel?: number): void`; der Eintrag merkt den Schlüssel.
  - `Vorlaeufe.abbrechen(schluessel: number): number` löscht laufende und angehaltene Einträge dieses Schlüssels samt Zeitgeber und
    gibt ihre Zahl zurück; `angehalten` ändert sich nicht.
- Store (`R/store/player.ts`, nicht exportiert): `let videoWartet: { id: number; index: number; autoContinue: boolean } | null`, das
  `dieserStart`-Objekt eines Video-Cues zwischen `open` und `load`.
- Signaturen von `removeShowCue`, `fireCue`, `showTogglePause` bleiben.

- [ ] **Step 1: Failing tests `ablauf.test.ts`** (Schein-Uhr `scheinUhr`, Z. 10-42):
  - `PL-K1 abbrechen nimmt nur die Vorläufe dieses Cues`: `starte(1000, a, 13)`, `starte(1000, b, 14)`, `abbrechen(13) === 1`,
    `vor(1000)` → a 0-mal, b 1-mal, `anzahl === 0`.
  - `PL-K1 abbrechen im angehaltenen Zustand`: `starte(1000, a, 13)`, `anhalten()`, `abbrechen(13)`, `fortsetzen()`, `vor(1000)` →
    a 0-mal, `angehalten === false`.
  - `PL-K1 zweimal derselbe Cue`: zweimal `starte(…, 13)` → `abbrechen(13) === 2`; `abbrechen(99) === 0`.
- [ ] **Step 2: Failing tests `store.test.ts`** (Cues A=11, V=12, P=13 mit 30 ms Vorlauf, PV=14; `warte` ≥ 90 ms Reserve, K3):
  - `PL-K1 Ton-Cue im Vorlauf gelöscht startet nicht`: `neu(); p().fireCue(2)`, `serverCues = [A, V, PV]`,
    `await p().removeShowCue(13)`, `await warte(120)` → `zaehle('audio.play 13') === 0`, 13 weder in `vorlaufCueIds` noch in
    `playingCueIds`.
  - `PL-K1 Video-Cue im Vorlauf gelöscht lädt nicht`: `fireCue(3)`, `removeShowCue(14)`, `warte(120)` → `zaehle('output.load') === 0`,
    `videoCue === null`.
  - `PL-K1 in der Pause gelöscht startet auch nach Weiter nicht`: `fireCue(2)`, `showTogglePause()`, `removeShowCue(13)`,
    `showTogglePause()`, `warte(120)` → `zaehle('audio.play 13') === 0`.
  - `PL-K1 andere Vorläufe laufen weiter`: `fireCue(2)`, `fireCue(3)`, `removeShowCue(13)`, `warte(120)` → `zaehle('output.load') === 1`.
  - `PL-K1 Video-Cue beim Warten auf bereit gelöscht (P4)`, im Block mit `zuUndNeu`/`gibFrei`/`ausgabeLog` (`:756-776`):
    `zuUndNeu([V])`, `fireCue(0)`, `await warte(5)`, `serverCues = []`, `await p().removeShowCue(12)`, `await gibFrei()` →
    `ausgabeLog()` gleich `['output.open']`, `videoCue === null`, 12 nicht in `playingCueIds`.
  - `PL-K2 GO auf Ton in der Pause weckt das Ausgabevideo`: `neu(); fireCue(1)`, `warte(10)`, `showTogglePause()`, `log.length = 0`,
    `fireCue(0)` → `zaehle('output.resume') === 1`, `zaehle('audio.play 11') === 1`, `showPaused === false`.
  - `PL-K2 GO auf Video in der Pause weckt die Töne`: `fireCue(0)`, Pause, `log.length = 0`, `fireCue(1)`, `warte(5)` → `log` gleich
    `['audio.resume', 'output.load']`.
  - `PL-K2 ohne Video kein resume an die Ausgabe`: `fireCue(0)`, Pause, `log.length = 0`, `fireCue(0)` → `zaehle('output.resume') === 0`.
  - `PL-K2 Weiter nach dem natürlichen Ende startet das Video nicht neu` (P3): `fireCue(1)`, `warte(10)`, `p().onOutputEnded()`,
    Pause, `log.length = 0`, `showTogglePause()` → `zaehle('output.resume') === 0`, `zaehle('audio.resume') === 1`.
  - `PL-K2 Ladefehler hält auch das Video wieder an` (R1, R9, K6), im Block mit `ablehnen`/`ladefehler` (`:425-440`): V läuft, Pause,
    GO auf einen Ton-Cue, der ablehnt → `showPaused === true`, im Ausgabe-Protokoll erst `output.resume`, dann `output.pause`.
  - `PL-K2 GO mit Vorlauf in der Pause weckt nichts` (A1): `fireCue(1)`, Pause, `log.length = 0`, `fireCue(2)`, `warte(90)` →
    `zaehle('output.resume') === 0`, `zaehle('audio.resume') === 0`, `showPaused === true`.
  - **Review Focus 4** `PL-K2 Pause beim Warten auf bereit, dann GO auf Ton`: `zuUndNeu([V, A])`, `fireCue(0)`, `warte(5)`,
    `showTogglePause()`, `fireCue(1)`, `await gibFrei()` → `ausgabeLog()` gleich
    `['output.open', 'output.pause', 'output.resume', `output.load ${url(V)}`]`, `showPaused === false`, `zaehle('audio.play 11') === 1`.
  - Geänderte Erwartungen (Testtext nennt „Altfehler PL-K2“): `:272` wird `['audio.resume', 'audio.play 13']`, `:297` wird
    `['audio.resume', 'output.load']`, `:303` wird `['audio.resume']`; `:852` bleibt (dort hält `videoCue` das wartende Video).
- [ ] **Step 3:** Lauf zeigt die neuen Tests rot (`abbrechen` fehlt, `audio.play 13` steht einmal im Protokoll, kein `output.resume`).
- [ ] **Step 4: Implementieren:**
  - `fireCue`: `vorlaeufe.starte(cue.preWaitSec * 1000, startNow, cue.id)`.
  - `removeShowCue`: vor dem ersten `await` `vorlaeufe.abbrechen(cueId)`; `vorlaufCueIds` und `playingCueIds` ohne die ID; ist
    `videoWartet?.id === cueId` und `get().videoCue === videoWartet`, dann `videoWartet = null` und `videoCue`/`videoProgress` auf
    `null` (dann sendet `load` nichts, weil `videoCue !== dieserStart`). Ein laufendes Video stoppt ✕ weiter nicht (Nr. 50).
  - `startNow`, Video-Zweig: `videoWartet = dieserStart` vor `open`; `load()` setzt `videoWartet = null`.
  - `startNow`, wenn `warPausiert`: bei einem Video-Cue `void showAudio.resume()`; bei einem Ton-Cue mit `get().videoCue !== null`
    `void window.jmplay.output.command({ type: 'resume' })` und lokal `ausgabeGeweckt = true` (D5). Kein `pauseZaehler++`.
  - Fehlerzweig (`:591-594`): Wird die Pause wiederhergestellt und war `ausgabeGeweckt`, zusätzlich
    `void window.jmplay.output.command({ type: 'pause' })`.
  - `showTogglePause`, Zweig „Weiter“: `resume` an die Ausgabe nur, wenn `get().videoCue !== null` (P3).
  - Kommentar `R/lib/oberflaeche.ts:210-211` nachführen.
  - Funktionsliste: `ALTFEHLER` um `['PL-K1', [lib/vorlauf.ts, store/player.ts, lib/oberflaeche.ts]]` und
    `['PL-K2', [store/player.ts]]` (Pfade mit `apps/player/`); `player.md` Nr. 50 „bricht den Vorlauf ab, auch beim Warten auf die
    Ausgabe (Altfehler PL-K1)“, Nr. 94 mit PL-K1, Nr. 99 „hebt die Pause ganz auf, auch für Töne und ein angehaltenes Ausgabevideo;
    Weiter nach dem natürlichen Ende startet das Video nicht neu (Altfehler PL-K2)“. Der Wächter `:526-533` (Nr. 98/99 nennen
    „Befund 11“ und `store/player.ts`) bleibt erfüllt.
- [ ] **Step 5:** Selbsttest und Typprüfung grün, auch mit `JM_FUNKTIONSLISTE_GIT=1`. Mutationsproben: `abbrechen` in
  `removeShowCue` weg → PL-K1 rot; Bedingung `videoCue !== null` beim Ton-Cue weg → „ohne Video kein resume“ rot; Bedingung in
  `showTogglePause` weg → „Weiter nach dem natürlichen Ende“ rot.
- [ ] **Step 6: Echt-Fenster-Messung** (Basis `vorlagen-stufe1/t1-messung.mjs`, `better-sqlite3` verzweigt, Blocker 8725): Show mit
  Video-Cue und Ton-Cue. a) Video-GO, nach 1 s Pause, Ton-GO → im Ausgabefenster `video.paused === false` und `currentTime` steigt
  über 1 s, 3 Läufe. b) Video läuft zu Ende, Pause, Ton-GO → das Video startet nicht neu (`currentTime` bleibt am Ende, `ended`).
  c) Ton-Cue mit 2 s Vorlauf: GO, nach 0,5 s per CDP ✕ an der Cue-Zeile und „Entfernen“ in der Rückfrage (R16), 3 s warten → kein
  Ton-Start (keine Zeile „laufend“, ON AIR aus). Ergebnis `out/t1-messung.json`.
- [ ] **Step 7: Commit** `fix(player): gelöschter Cue im Vorlauf startet nicht, GO in der Pause hebt sie ganz auf (PL-K1, PL-K2)`.

### Task 2: Interpreter · Altfehler-Bindung, Startsperre mit Frist, Zurücksetzen ohne Vorverstärkung (C8, IN-3, IN-8)

**Files:**
- Modify: `apps/interpreter/test/ui/funktionsliste.test.ts` (Map `ALTFEHLER` nach Player-Muster, wirksam in `zeilenFehler` `:167`
  und im git-Abgleich; Negativproben; `GEAENDERT`), `docs/ux/funktionslisten/interpreter.md` (Nr. 5, 6, 38, 49–54, 56, 57, 59, 75,
  82, Abschnitt 10 Befunde 3 und 8)
- Modify: `apps/interpreter/src/renderer/src/core/engine.ts:27-41`, `:110-117`, `:150-190`
- Modify: `apps/interpreter/src/renderer/src/lib/oberflaeche.ts:28` (Grund), `:370-382` (`hauptTaste`, Kommentar „Keine Sperre“)
- Modify: `apps/interpreter/src/renderer/src/store/settings.ts:23` und Dateiende (nach `:40`)
- Modify: `apps/interpreter/test/ui/testzustand.ts:23-50` (`motor()` mit `starting: false`)
- Create: `apps/interpreter/test/ui/engine.test.ts`, `apps/interpreter/test/ui/store.test.ts` (in `test/ui/selftest.ts` als
  `await lade('engine', …)` und `await lade('store', …)` vor `abschluss();`)
- Test: `apps/interpreter/test/ui/oberflaeche.test.ts:228-249`, `apps/interpreter/test/ui/live.test.tsx:69-80`

**Interfaces:**
- Produces (`R/core/engine.ts`):
  - `EngineState.starting: boolean` (Anfang `false`).
  - `export const START_FRIST_MS = 15000;`
  - `export const START_FRIST_TEXT = 'Start abgebrochen: Die Geräte haben nach 15 s nicht geantwortet.';`
  - `constructor(startFristMs: number = START_FRIST_MS)`; `start(devices: Devices): Promise<void>` bleibt in der Signatur.
- Produces (`R/lib/oberflaeche.ts`): `INTERPRETER_TEXTE.grund.startet = 'Startet …'`; `hauptTaste` liefert bei `engine.starting`
  `{ label: <Text von T.taste.starten>, state: 'gesperrt', disabledReason: 'Startet …' }`, nach der Prüfung „Lädt …“.
- Produces (`R/store/settings.ts`): `reset: () => set({ ...DUCKING_VORGABEN }),` in Zeile 23; am Dateiende
  `export const DUCKING_VORGABEN` mit `thresholdDb`, `duckDb`, `attackMs`, `releaseMs`, `holdMs` aus `DEFAULT_SETTINGS`.
  `src/shared/ducking.ts` bleibt unberührt.

- [ ] **Step 1: Bindung (C8).** `ALTFEHLER = new Map([['IN-3', [core/engine.ts, lib/oberflaeche.ts]], ['IN-8', [store/settings.ts]]])`
  (Pfade mit `apps/interpreter/src/renderer/src/`), `ALTFEHLER_VERWEIS`, `altfehlerIds`, `entlastet` wie im Player; die drei Dateien
  in `GEAENDERT`. Negativproben: ein Haken „unverändert (`core/engine.ts`)“ ohne ID ist rot, mit „Altfehler IN-8“ rot, mit
  „Altfehler IN-3“ grün. Lauf grün (die Dateien sind noch unverändert).
- [ ] **Step 2: Failing tests `engine.test.ts`** (Schein-Globals: `AudioContext` mit `createGain`, `createAnalyser`,
  `createMediaStreamDestination`, `createMediaStreamSource`, `resume`/`close` als Promise mit Zähler, `currentTime`; `Audio` mit
  `play`, `pause`, `setSinkId`; `navigator.mediaDevices.getUserMedia` mit Zähler, zurückhaltbar, Spuren mit `stop`-Zähler;
  `Object.defineProperty(globalThis, 'navigator', { configurable: true, … })`; am Ende jedes Falls `await e.stop()` und Globals
  zurück, Vorbild `apps/player/test/ui/show-audio.test.ts`):
  - `IN-3 zweiter Start während des ersten wird verworfen`: `void e.start(d); void e.start(d)`, eine Mikrotask → `getUserMedia` 1×,
    `close` 0×, `getState().starting === true`; nach Freigabe → `running === true`, `starting === false`, `getUserMedia` 2×.
  - `IN-3 Frist: Start ohne Antwort bricht ab` (`new InterpreterEngine(30)`, `getUserMedia` antwortet nie): nach 60 ms
    `starting === false`, `running === false`, `error === START_FRIST_TEXT`, `close` ≥ 1×. Danach antwortet das zurückgehaltene
    `getUserMedia` → dessen Spur ist 1× gestoppt, `running` bleibt `false`.
  - `IN-3 nach der Frist geht ein neuer Start`: danach `start(d)` mit antwortenden Attrappen → `running === true`, `error === null`.
  - **Review Focus 3** `IN-3 Start scheitert: Sperre frei, nächster Start geht`: `getUserMedia` lehnt mit
    `new Error('Permission denied')` ab → `starting === false`, `running === false`, `error === 'Permission denied'`; zweiter Start
    mit antwortenden Attrappen → `running === true`.
- [ ] **Step 3: Failing tests Ableitung, Render, Store:**
  - `oberflaeche.test.ts`: `hauptTaste(stand({ engine: motor({ starting: true }) }))` gleich
    `{ label: 'Starten', state: 'gesperrt', disabledReason: 'Startet …' }`.
  - `live.test.tsx`: Der Knopf zeigt „Startet …“; ein Klick über `tallyHandler` schreibt keinen `start:`-Eintrag ins Log.
  - `store.test.ts`: `useSettings.setState({ floorGainDb: 6, interpreterGainDb: -3, thresholdDb: -30, holdMs: 900, bypass: true,
    floorId: 'x' })`, `reset()` → `floorGainDb 6`, `interpreterGainDb -3`, `thresholdDb -42`, `holdMs 350`, `bypass true`,
    `floorId 'x'`; danach Zustand zurück.
- [ ] **Step 4:** Rot nachweisen.
- [ ] **Step 5: Implementieren:**
  - `start`: als Erstes `if (this.starting) return;`, dann `starting = true`, Startnummer hochzählen, `patch({ starting: true })`. Der
    Rumpf läuft gegen einen Zeitgeber von `startFristMs`; nach jedem `await` prüft er seine Startnummer, ein veralteter Lauf stoppt
    die Spuren seiner eben geholten Streams und kehrt ohne `patch({ running })` zurück. Bei Ablauf der Frist: Startnummer hoch,
    `await this.stop()`, `patch({ error: START_FRIST_TEXT })`. `finally`: `starting = false`, `patch({ starting: false })`.
    `stop()` fasst `starting` nicht an.
  - `hauptTaste` und Kommentar `:370-373`; `settings.ts` wie oben; `motor()` in der Testhilfe.
  - Funktionsliste: Haken der Nr. 5, 6, 49–54, 56, 57, 59 mit „Altfehler IN-3“, Nr. 38, 75, 82 mit „Altfehler IN-8“ (Nr. 38: „fünf
    Werte, nicht die Vorverstärkungen“); Wächter `:313-316` (`!/starting|startet/i`) und `:474-476`
    (`reset: () => set({ ...DEFAULT_SETTINGS }),`) auf das neue Verhalten, Testtext mit ID; `:523-541`, `:596-602`, `:625-631` über die
    Bindung; `:736-741` bleibt grün (Zeile 23, Rest am Dateiende).
- [ ] **Step 6:** Tests grün, auch mit `JM_FUNKTIONSLISTE_GIT=1`. Mutationsproben: `if (this.starting) return` weg → „zweiter Start“
  rot; Frist weg → „Frist“ rot; `reset` wieder `DEFAULT_SETTINGS` → IN-8 rot.
- [ ] **Step 7: Echt-Fenster-Messung** (kein Steuerport, Fake-Geräte, `--mute-audio`): Im Store Floor und Dolmetscher auf Fake-Geräte
  setzen, `getUserMedia` im Hauptkontext mit 1 s Verzögerung und Zähler umwickeln, im selben `Runtime.evaluate` zweimal
  `button.click()` → Screenshot zeigt „Startet …“, danach 2 Aufrufe statt 4 und „Stoppen“. Ergebnis `out/t2-messung.json`.
- [ ] **Step 8: Commit** `fix(interpreter): Start gesperrt mit Frist, Zurücksetzen lässt die Vorverstärkungen (IN-3, IN-8)`.

### Task 3: Stage Display · Bindung, PIN verdeckt, Nachricht als Entwurf, mDNS nur bei der Vorgabe (C8, SD-5, SD-1, SD-3)

**Files:**
- Modify: `apps/stage-display/test/ui/funktionsliste.test.ts` (Map `ALTFEHLER` mit SD-5, SD-1, SD-3, wirksam in `zeilenFehler` `:182`),
  `docs/ux/funktionslisten/stage-display.md` (Nr. 28, 39, 57–60, 88, 90–97, 98, 105, Abschnitt 10 Befunde 1, 3, 5)
- SD-5: Create `apps/stage-display/src/renderer/src/components/PinFeld.tsx`; Modify `R/views/Einstellungen.tsx:52-54`,
  `R/lib/oberflaeche.ts:70-77` (`STAGE_TEXTE.kopplung`)
- SD-1: Create `apps/stage-display/src/shared/konfig-regeln.ts`; Modify `src/shared/types.ts` (`StageConfig`, `PartialStageConfig`),
  `src/main/config.ts:11-13`, `:25-67`, `R/lib/aktionen.ts:44`, `R/views/LiveBereich.tsx:59-63`, `R/lib/oberflaeche.ts:47-60`
- SD-3: Create `apps/stage-display/src/shared/mdns.ts`; Modify `src/main/index.ts:100-141`, `R/lib/oberflaeche.ts:165-177`,
  `packages/settings/src/abschnitte/peers.ts:27-51`, `:69-77`, `packages/settings/test/peers.test.tsx:60-70`
- D10: Modify `apps/connect/test/ui/funktionsliste.test.ts:122`, `apps/presenter/test/ui/funktionsliste.test.ts:108`,
  `apps/studio-control/test/ui/funktionsliste.test.ts:126` (je `PAKETE_GEAENDERT` + `'packages/settings/src/abschnitte/peers.ts'`
  mit Kommentar „Altfehler SD-3, Stufe 2“)
- Test: `apps/stage-display/test/ui/panel.test.tsx`, `…/live.test.tsx`, `…/oberflaeche.test.ts`; Create `…/konfig-regeln.test.ts`,
  `…/mdns.test.ts` (statische `import './….test';` vor `abschluss();` in `test/ui/selftest.ts`)

**Interfaces:**
- Produces (`R/components/PinFeld.tsx`):
  - `PinFeldAnsicht(p: { entwurf: string; sichtbar: boolean; onTippen: (t: string) => void; onAnzeigen: () => void; onSetzen: () => void }): React.JSX.Element`
    ohne Hooks: `TextInput` mit `type={sichtbar ? 'text' : 'password'}`, `inputMode="numeric"`, `autoComplete="off"`, Platzhalter und
    Tooltip wie heute; Knopf „Anzeigen“/„Verbergen“ mit `aria-pressed={sichtbar}`; Knopf `PEERS_TEXTE.setzen` (D7). Kein `onKeyDown`.
  - `PinFeld(p: { wert: string; setzen: (pin: string) => void }): React.JSX.Element` mit `useState` (Entwurf, sichtbar) und
    `useEffect(() => setEntwurf(wert), [wert])` wie `PeerZeile`; „Setzen“ ruft `setzen(entwurf)`.
  - `STAGE_TEXTE.kopplung.anzeigen = 'Anzeigen'`, `STAGE_TEXTE.kopplung.verbergen = 'Verbergen'`.
- Produces (SD-1):
  - `StageConfig.nachrichtEntwurf?: string`, `PartialStageConfig.nachrichtEntwurf?: string`.
  - `src/shared/konfig-regeln.ts`: `DEFAULT_CONFIG: StageConfig` (aus `config.ts` verschoben, mit `nachrichtEntwurf: ''`, Hosts
    `VORGABE_HOST`); `konfigAusDatei(data: Partial<StageConfig>): StageConfig` (zusammenführen wie heute, dazu `message: ''` und
    `nachrichtEntwurf: data.nachrichtEntwurf ?? data.message ?? ''`); `konfigMischen(cur: StageConfig, patch: PartialStageConfig): StageConfig`.
  - `OberflaechenAktionen.entwurf(text: string): void` (`setConfig({ nachrichtEntwurf: text })`) und `senden(text: string): void`
    (`setConfig({ message: text })`) ersetzen `nachricht`.
  - `STAGE_TEXTE.live.senden = 'Senden'`.
- Produces (SD-3):
  - `src/shared/mdns.ts`: `export const VORGABE_HOST = '127.0.0.1'`;
    `mdnsUebernahme(cfg: StageConfig, verbunden: { timer: boolean; switcher: boolean; presenter: boolean }, dienste: readonly { role: string; host: string; port: number; ctl?: boolean }[]): PartialStageConfig`
    mit den Filtern von heute (`!ctl` für Timer und Presenter, nicht für den Switcher), dazu `cfg.<quelle>.host === VORGABE_HOST`.
  - `@jm/settings`: `PeerRow.eingerichtet?: boolean`; `PEERS_TEXTE.zeileNichtErreichbar = 'nicht erreichbar'`; `peerZeileStatus`
    nach dem Fall „verbunden“: `if (r.eingerichtet === true) return st('warn', PEERS_TEXTE.zeileNichtErreichbar)`.
  - Stage `quellenZeile` setzt `eingerichtet: (q?.host ?? '') !== VORGABE_HOST`.

- [ ] **Step 1: Bindung (C8)** nach Player-Muster mit `['SD-5', [components/PinFeld.tsx, views/Einstellungen.tsx, lib/oberflaeche.ts]]`,
  `['SD-1', [shared/types.ts, shared/konfig-regeln.ts, main/config.ts, lib/aktionen.ts, views/LiveBereich.tsx, lib/oberflaeche.ts]]`,
  `['SD-3', [shared/mdns.ts, main/index.ts, main/config.ts, lib/oberflaeche.ts, 'packages/settings/src/abschnitte/peers.ts']]`
  (App-Pfade mit `apps/stage-display/src/` bzw. `…/src/renderer/src/`). Negativproben wie in Task 2. Lauf grün.
- [ ] **Step 2: Failing tests SD-5** (`panel.test.tsx` bei `:76-95`):
  - `SD-5 PinFeldAnsicht verdeckt`: `input.type === 'password'`; mit `sichtbar: true` `'text'`; „Anzeigen“ hat `aria-pressed` `false`,
    „Verbergen“ `true`.
  - `SD-5 Tippen setzt nicht`: `onChange('9')` ruft nur `onTippen('9')`; „Setzen“ ruft `onSetzen` 1×.
  - `SD-5 Einstellungen verdrahtet`: `render(<Einstellungen … pin: '1234' />)` enthält `type="password"`, „Anzeigen“, „Setzen“; im
    Baum steckt ein `PinFeld` mit `props.wert === '1234'` und `props.setzen === aktionen.pin`. `a.pin('12a3-4567890')` ergibt weiter
    `12345678` (`:144-146`).
  - Wächter: `PinFeld.tsx` ohne `onKeyDown`, `Einstellungen.tsx` ohne `useEffect`.
- [ ] **Step 3: Failing tests SD-1:**
  - `konfig-regeln.test.ts`: `konfigAusDatei({ message: 'Bitte Plätze einnehmen' })` → `message ''`, `nachrichtEntwurf`
    „Bitte Plätze einnehmen“; `konfigAusDatei({ message: 'Alt', nachrichtEntwurf: 'Neu' })` → `''`/„Neu“; `konfigAusDatei({})` →
    `''`/`''`; `konfigMischen(c, { nachrichtEntwurf: 'X' })` lässt `message` stehen.
  - `live.test.tsx` (Baum `elemente(LiveBereich(…))`): `onChange('Pause')` am Feld → nur `setConfig{"nachrichtEntwurf":"Pause"}`;
    `onSubmit({ preventDefault })` am Formular `data-stage="nachricht"` → `preventDefault` 1×, `setConfig{"message":"‹Entwurf›"}`;
    leerer Entwurf → `setConfig{"message":""}`; das Feld zeigt den Entwurf, nicht `message`; ein Knopf `type="submit"` „Senden“.
  - `panel.test.tsx:139-142` auf `entwurf` und `senden` umstellen.
  - Wächter: `getConfig` nutzt `konfigAusDatei`, `patchConfig` nutzt `konfigMischen`; `LiveBereich.tsx` ohne `onKeyDown`.
- [ ] **Step 4: Failing tests SD-3:**
  - `mdns.test.ts`, Kreuzprodukt Host (Vorgabe/eingerichtet) × an × verbunden je Quelle: Timer an, Host `10.0.0.4`, nicht verbunden,
    Dienst Timer `10.0.0.9:7777` → `{}`; Host `127.0.0.1` → `{ timer: { host: '10.0.0.9', port: 7777 } }`; verbunden → `{}`; aus →
    `{}`; Timer-Dienst mit `ctl` wird ignoriert, Switcher-Dienst mit `ctl` nicht.
  - `oberflaeche.test.ts:108-124`: Quelle an, nicht verbunden, Host `10.0.0.4` → `warn nicht erreichbar`; Host `127.0.0.1` →
    `warn nicht gefunden`; „eine Wahrheit“ (`:136-149`) bleibt.
  - `packages/settings/test/peers.test.tsx:60-70`: neue Achse `eingerichtet` (`true` und nicht verbunden → `warn` „nicht erreichbar“;
    fehlt das Feld → wie heute).
  - Wächter: `onDiscovered` ruft `mdnsUebernahme(` und enthält `cfg.timer.host !== timer.host` nicht mehr.
- [ ] **Step 5:** Rot nachweisen.
- [ ] **Step 6: Implementieren** in der Reihenfolge SD-5, SD-1, SD-3 (C9):
  - SD-5 wie in den Interfaces; `Einstellungen.tsx:53` wird `<PinFeld wert={p.pin} setzen={aktionen.pin} />`.
  - SD-1: `LiveBereich` bekommt `<form data-stage="nachricht" onSubmit={…}>` mit Feld (`value={c.nachrichtEntwurf ?? ''}`,
    `onChange={aktionen.entwurf}`) und `<Button type="submit">`; Enter im Feld schickt das Formular ab. `StageScreen.tsx`,
    `nachricht.ts` und `StageOutputView.tsx` bleiben unverändert (Wächter `funktionsliste.test.ts:420-426`, `test/nachricht.test.tsx`).
  - SD-3: `onDiscovered` wird `const patch = mdnsUebernahme(getConfig(), { timer: lastTimer.connected, switcher: lastSwitcher.connected, presenter: lastPresenter.connected }, services)`;
    der Rest (`patchConfig`, `applyConnections`, `broadcast`) bleibt.
  - D10: die drei `PAKETE_GEAENDERT`-Einträge.
  - Funktionsliste: Nr. 28, 98 (SD-5), 39, 88, 105 (SD-1; das Entwurfsfeld gehört in Nr. 105), 57–60, 90–97 (SD-3); die neuen Dateien
    in einem Haken nennen; Wächter `:361-364` auf `onChange={aktionen.entwurf}` und `entwurf: (text) => …` umstellen (Testtext mit ID).
- [ ] **Step 7:** Tests grün für Stage Display und `@jm/settings`, auch mit `JM_FUNKTIONSLISTE_GIT=1` für Stage Display, Connect,
  Presenter und Studio-Control (nur die UI-Läufe, je im Ordner `apps/<app>`:
  `JM_FUNKTIONSLISTE_GIT=1 npx tsx --tsconfig tsconfig.test.json test/ui/selftest.ts`).
  Typprüfung aller Apps mit `PeersSection` (`battle`, `presenter`, `qa`, `rundown`, `stage-display`): Exit 0. Mutationsproben:
  `VORGABE_HOST`-Bedingung weg → `mdns.test` rot; `message: ''` in `konfigAusDatei` weg → SD-1 rot; `type`-Wechsel weg → SD-5 rot.
- [ ] **Step 8: Echt-Fenster-Messung SD-1** (kein Steuerport, keine Medien, Quellen aus): `stage-config.json` vorbelegt mit
  `message: 'Alt'`, `widgets.message: true`. Per CDP `window.jmstage.output.open()`; im Bühnenschirm-Ziel kein „Alt“, im Feld „Alt“.
  „Neu“ per `Input.insertText` → Bühne unverändert; Enter per `Input.dispatchKeyEvent` → „Neu“ auf der Bühne; App neu starten →
  Bühne leer, Feld zeigt „Neu“. Ergebnis `out/t3-messung.json`.
- [ ] **Step 9: Commit** `fix(stage-display): PIN verdeckt, Nachricht als Entwurf, mDNS nur bei der Vorgabe (SD-5, SD-1, SD-3)`.

### Task 4: Caption A · Bindung, Mikrofonfehler, Leeren bei Hold, Korrektur je Zeile (C8, CA-1, CA-4, CA-5)

**Files:**
- Modify: `apps/caption/test/ui/funktionsliste.test.ts` (Map `ALTFEHLER`, wirksam in `zeilenFehler` `:180`), `docs/ux/funktionslisten/caption.md`
  (Nr. 25, 33, 34, 53, 54, 61, 73–76, 80, Abschnitt 8 IPC-Übersicht, Abschnitt 10 Befunde 1, 4, 5)
- CA-1: Modify `apps/caption/src/renderer/src/lib/aktionen.ts`, `R/views/CaptionOberflaeche.tsx:91-131`
- CA-4: Modify `src/shared/types.ts:64-77`, `src/main/index.ts:99-101`, `:155-158`, `R/lib/ndi-engine.ts:17-130`,
  `R/views/CaptionOberflaeche.tsx:88`
- CA-5: Create `apps/caption/src/shared/zeilen.ts`; Modify `src/main/index.ts:237-244`, `src/preload/index.ts:41`,
  `src/shared/types.ts:107`, `R/store/useCaption.ts:14`, `:37`, `R/lib/aktionen.ts:15`, `:33-34`, `:67`, `R/views/LiveBereich.tsx:136-149`
- Modify: `apps/caption/test/ui/testzustand.ts:61-80` (`caption()` mit `leerungen: 0`, `store()` mit `correctLine`)
- Create: `apps/caption/test/ui/altfehler.test.ts` (`await lade('altfehler', …)` vor `abschluss();`)
- Test: `apps/caption/test/ui/live.test.tsx:179-185`, `:282-308`, `apps/caption/test/ui/rahmen.test.tsx:104`, `:109-149`,
  `apps/caption/test/ui/ndi.test.ts:179-180`

**Interfaces:**
- Produces:
  - `R/lib/aktionen.ts`: `mikrofonGescheitert(store: Pick<CaptionStore, 'stop'>, setzeFehler: (m: string) => void, e: unknown): void`
    setzt `String((e as Error)?.message ?? e)` und ruft `void store.stop()`.
  - `CaptionState.leerungen: number` (jedes `doClear` seit dem Start).
  - `R/lib/ndi-engine.ts`:
    `export function angezeigterText(vorher: { text: string; leerung: number }, lines: CaptionLine[], hold: boolean, leerungen: number): { text: string; leerung: number }`
    (ohne Hold: Text der jüngsten Zeile; mit Hold und neuer Leerung: `''`; sonst der vorige Text).
    Hook: `useCaptionNdiEngine(config, lines, hold, leerungen, ndiActive, previewRef)`.
  - `src/shared/zeilen.ts`: `korrigiereZeile(lines: CaptionLine[], id: string, text: string): CaptionLine[] | null` (unbekannte ID → `null`).
  - IPC `caption:correctLine(id, text)`; `JmCaptionApi.correctLine(id: string, text: string): Promise<CaptionState>`; Store
    `correctLine(id, text)`; `LiveAktionen.korrigieren(id: string, text: string)`.

- [ ] **Step 1: Bindung (C8)** mit `['CA-1', [lib/aktionen.ts, views/CaptionOberflaeche.tsx]]`,
  `['CA-4', [shared/types.ts, main/index.ts, lib/ndi-engine.ts, views/CaptionOberflaeche.tsx]]`,
  `['CA-5', [shared/zeilen.ts, shared/types.ts, main/index.ts, preload/index.ts, store/useCaption.ts, lib/aktionen.ts, views/LiveBereich.tsx]]`
  (Pfade mit `apps/caption/src/…`). Negativproben wie in Task 2. Lauf grün.
- [ ] **Step 2: Failing tests `altfehler.test.ts`:**
  - `CA-1 Mikrofonfehler stoppt die Transkription`: `mikrofonGescheitert(store(log), (m) => log.push('micError:' + m), new Error('Requested device not found'))`
    → `log` gleich `['micError:Requested device not found', 'stop']`; mit `'kaputt'` → `'micError:kaputt'`.
  - `CA-4 Leeren bei Hold leert das Bild`: `angezeigterText({ text: 'Bitte nehmen Sie Platz.', leerung: 0 }, [], true, 1)` →
    `{ text: '', leerung: 1 }`; danach mit einer Zeile „Neu“, `true`, `1` → `''`; mit `hold` `false` → „Neu“; gleiche Leerung bei Hold →
    voriger Text.
  - `CA-5 korrigiereZeile trifft die Kennung`: nur `l2` trägt „Neu“, `l3` bleibt; `korrigiereZeile(ZEILEN, 'weg', 'x') === null`.
  - Wächter: das `.catch` des Aufnahme-Effekts ruft `mikrofonGescheitert(`; `doClear` erhöht `leerungen`; `buildState` enthält
    `leerungen`; `frame()` ruft `angezeigterText(`; `src/main/index.ts` hat `caption:correctLine` mit `korrigiereZeile` und kein
    `caption:correctLast`; der Preload bietet `correctLine`; `buildSuiteState` liest weiter `running`.
- [ ] **Step 3: Failing tests Baum** (`live.test.tsx:282-298` ersetzen): Feld an `'l2'` (inzwischen kam `l3`):
  `onBlur({ target: { value: 'Neu' } })` → `log` gleich `['correctLine:l2:Neu', 'bearbeiten:null']`;
  `onKeyDown({ key: 'Escape', preventDefault, currentTarget: feld, target: feld })` und danach `onBlur` → nur `['bearbeiten:null']`;
  unveränderter Text beim Verlassen → kein `correctLine`.
- [ ] **Step 4:** Rot nachweisen.
- [ ] **Step 5: Implementieren** in der Reihenfolge CA-1, CA-4, CA-5 (C9):
  - CA-1: `.catch((e: unknown) => mikrofonGescheitert({ stop }, setMicError, e))`, auch wenn der Versuch schon abgebrochen ist; `stop`
    aus `useCaption()`. Kein neuer Kanal.
  - CA-4: Zähler im Main, `frame()` über `angezeigterText`, Aufruf `CaptionOberflaeche.tsx:88` mit `state?.leerungen ?? 0`.
  - CA-5: Kanal umbenennen, Main überträgt nur bei Treffer; `LiveBereich` ohne Hooks: `onBlur` sendet nur bei geändertem Text
    `aktionen.korrigieren(l.id, …)`, dann `bearbeiten(null)`; Escape: `preventDefault`, Wert auf `l.text`, `bearbeiten(null)`. Der
    Doppelklick bleibt auf der jüngsten Zeile, der Tooltip bleibt.
  - Wächter nachführen: `rahmen.test.tsx` (`ALT_AUFNAHME` `.catch`-Zeile, Engine-Aufruf `:104`), `funktionsliste.test.ts:294-297`,
    `:448-452` (`!/Escape/` kippt, `korrigieren`), `:507`, `:516-525`, `:536-542`, `:556-559`; `ndi.test.ts:179-180`. `zeilen.ts`
    steht in einem Haken (Pflicht `:676-681`).
- [ ] **Step 6:** Tests grün, auch mit `JM_FUNKTIONSLISTE_GIT=1`. Mutationsproben: `void store.stop()` weg → CA-1 rot; Leerungs-Zweig
  weg → CA-4 rot; `korrigiereZeile` auf „jüngste Zeile“ → CA-5 rot.
- [ ] **Step 7: Echt-Fenster-Messung CA-1** (Blocker 8732, Fake-Geräte): `caption.config.json` mit `audioInputDeviceId: 'gibt-es-nicht'`.
  Per CDP `getUserMedia` zählen, „Start“ klicken → danach `window.jmcaption.getState()` mit `running === false`, „Mikrofon: …“ im DOM,
  über 5 s kein weiterer `getUserMedia`-Aufruf. Startet die App ohne `@jm/ndi` nicht, Verzweigung nach den Mess-Regeln. Ergebnis
  `out/t4-messung.json`.
- [ ] **Step 8: Commit** `fix(caption): Mikrofonfehler stoppt, Leeren leert NDI bei Hold, Korrektur trifft die Zeile (CA-1, CA-4, CA-5)`.

### Task 5: Caption B · Zahlenfelder mit Grenzen, Fenster zu beendet die Transkription (CA-8, CA-11)

**Files:**
- Create: `apps/caption/src/shared/konfig.ts`, `apps/caption/src/shared/fernbefehl.ts`
- Modify: `apps/caption/src/renderer/src/views/Einstellungen.tsx:83-93`, `:105-115`
- Modify: `apps/caption/src/main/index.ts:78-85` (`loadConfig`), `:123-140` (`handleSuiteCommand`), `:215-220` (`caption:setConfig`),
  `:306-313` (`closed`), `:355-367` (`activate`)
- Modify: `apps/caption/test/ui/funktionsliste.test.ts` (Map um CA-8, CA-11; Wächter `:313-319`, `:400-409`, `:561-563`),
  `docs/ux/funktionslisten/caption.md` (Nr. 16, 23, 49, 50, 84, 94, 101, 105, 113, Abschnitt 10 Befunde 8, 11)
- Test: `apps/caption/test/ui/altfehler.test.ts`, `apps/caption/test/ui/panel.test.tsx:85`, `:93`, `:119-122`, `:151-158`

**Interfaces:**
- Produces (`src/shared/konfig.ts`): `CAPTION_GRENZEN = { ndiFontSize: { min: 16, max: 160 }, maxUtteranceSec: { min: 2, max: 15 } } as const`;
  `pruefeKonfig(patch: Partial<CaptionConfig>): Partial<CaptionConfig>` (nicht endliche Zahlen fallen weg, Werte außerhalb auf die
  Grenzen, andere Schlüssel unverändert).
- Produces (`src/shared/fernbefehl.ts`):
  `transcribeAblehnung(arg: string | undefined, ziel: boolean, fensterOffen: boolean): { hinweis: string; log: string } | null`.
  Nur `ziel && !fensterOffen` lehnt ab. Verb im Text: `TRANSCRIBE ${String(arg ?? 'toggle').toUpperCase()}`. Texte:
  - `hinweis`: `Companion „TRANSCRIBE ON“ abgelehnt: Das Caption-Fenster ist geschlossen. Ein Klick aufs Dock öffnet es.`
  - `log`: `Fernbefehl abgelehnt: TRANSCRIBE ON (kein Fenster offen)`.
- Feld: `<NumberInput value={c.…} min={…} max={…} onChange={(n) => aktionen.konfigurieren({ …: n })} className="w-24" />`; „Schrift“
  mit `ganzzahl`, „Max. Äußerung (s)“ ohne. Die Fehlertexte kommen aus `@jm/ui` (`UI_TEXTE`), nicht aus Caption.

- [ ] **Step 1: Failing tests `altfehler.test.ts`:**
  - `CA-8 pruefeKonfig`: `{ ndiFontSize: 0 }` → `{ ndiFontSize: 16 }`; `400` → `160`; `{ maxUtteranceSec: NaN }` → `{}`;
    `{ maxUtteranceSec: 7.5 }` bleibt; `{ ndiName: 'X' }` bleibt.
  - `CA-8 Feldlogik mit den Caption-Grenzen` (`zahlSchritt` aus `@jm/ui`): `'0'` übernehmen bei Schrift → Fehler „Mindestens 16.“, kein
    `neuerWert`; `''` → „Bitte eine Zahl eingeben.“; `'54,5'` mit `ganzzahl` → „Bitte eine ganze Zahl eingeben.“; `'7,5'` bei Max.
    Äußerung → `neuerWert 7.5`.
  - `CA-11 transcribeAblehnung`: `('on', true, false)` → Hinweis und Log genau wie oben; `('on', true, true)` → `null`;
    `('off', false, false)` → `null`; `(undefined, true, false)` nennt `TRANSCRIBE TOGGLE`.
  - Wächter: `caption:setConfig` und `loadConfig` nutzen `pruefeKonfig`; der Rumpf von `win.on('closed', …)` enthält nach den
    bestehenden Zeilen `setRunning(false)` und `setHoldState(false)` (Muster `:561-563` bleibt grün); `app.on('activate'` ruft
    `createMainWindow()` nur ohne `mainWindow`; `case 'transcribe'` ruft `transcribeAblehnung(` und bei Ablehnung `error =`,
    `getLog().warn(` und `broadcast()`, ohne `setRunning(`.
- [ ] **Step 2: Failing tests Baum** (`panel.test.tsx:151-158` ersetzen): `elemente(Einstellungen(…))` enthält genau zwei
  `NumberInput` mit (`min 2`, `max 15`, `value 6`) und (`min 16`, `max 160`, `value 72`); `props.onChange(96)` →
  `setConfig:{"ndiFontSize":96}`; im HTML kein `type="number"`. `:166` (ohne Hooks, ohne `onKeyDown`) bleibt grün.
- [ ] **Step 3:** Rot nachweisen.
- [ ] **Step 4: Implementieren:** CA-8 (Feld, Main `config = { ...config, ...pruefeKonfig(patch) }`, `loadConfig` über dieselbe
  Funktion), dann CA-11 (C2, D8): `closed` setzt `setRunning(false); setHoldState(false);` (plattformunabhängig), `activate` öffnet ohne
  Fenster ein neues; `case 'transcribe'`: `const ziel = resolveMode(arg, running)`, `const a = transcribeAblehnung(arg, ziel, mainWindow !== null)`;
  bei `a` `error = a.hinweis; getLog().warn(a.log); broadcast();`. `hold`, `ndi`, `clear` bleiben. Funktionsliste: Map
  `['CA-8', [shared/konfig.ts, main/index.ts, views/Einstellungen.tsx]]`, `['CA-11', [shared/fernbefehl.ts, main/index.ts]]`; Zeilen
  nachführen, Nr. 101 („NumberInput nach E13 gilt für Caption nicht“) → „gilt seit Altfehler CA-8“; beide neuen Dateien in einem Haken.
- [ ] **Step 5:** Tests grün, auch mit `JM_FUNKTIONSLISTE_GIT=1`. Mutationsproben: Klemmen in `pruefeKonfig` weg → CA-8 rot;
  `fensterOffen`-Prüfung weg → CA-11 rot.
- [ ] **Step 6: Echt-Fenster-Messung CA-8** (Blocker 8732, kein Mikrofon): per CDP „Schrift“ leeren und das Feld verlassen → Fehlertext
  sichtbar, `getState().config.ndiFontSize` bleibt 54; „96“ und Enter → 96. Ergebnis `out/t5-messung.json`.
- [ ] **Step 7: Commit** `fix(caption): Zahlenfelder mit Grenzen, Fenster zu beendet die Transkription (CA-8, CA-11)`.

### Task 6: Recorder A · Bindung, Ablehnungsweg, ARM/DISARM, RECORD ON, Show-Ordner, NAS-Prüfung (B7, B6, RE-2, RE-2b, RE-7b, RE-NAS)

**Files:**
- Modify: `apps/recorder/test/ui/funktionsliste.test.ts` (Map `ALTFEHLER` wirksam in `zeilenFehler` `:177` und im git-Abgleich;
  Negativprobe `:241-249`; `GEAENDERT` `:52-80`; `NUR_MELDUNG` `:86-91` ohne `main/index.ts`, `preload/index.ts`, `shared/types.ts`),
  `docs/ux/funktionslisten/recorder.md` (Nr. 2, 14, 22, 24, 48–53, 56, 72, 73, 77, 80, 96, 97, 104, 107–109, 111, 124, 138,
  Abschnitt 10 Befunde 2, 7; die 56 Zeilen mit „✓ unverändert (…)“ aus der Bestandsaufnahme bekommen ihre ID)
- B6, RE-2, RE-2b: Create `apps/recorder/src/renderer/src/lib/fernbefehl.ts`; Modify `src/main/recorder.ts:211-213`, neu
  `schliesseEingang`; `src/main/ipc.ts:27`; `src/preload/index.ts:40`; `src/shared/types.ts:169`; `R/store/recorder.ts:333-348`, `:491-494`;
  `R/lib/oberflaeche.ts:40-45`, `:374-378`
- RE-7b: Create `apps/recorder/src/shared/netzordner.ts`, `apps/recorder/src/main/netzordner.ts`; Modify `src/main/index.ts:26-50`,
  `src/main/ipc.ts:35-38`, `:109-131`, `src/shared/types.ts:83-89`, `:138`, `R/store/recorder.ts:229`, `:304-312`, `:475-478`, `:585-603`,
  `R/views/LiveBereich.tsx:103-117`, `R/views/RecorderOberflaeche.tsx:33`, `:81-90`, `:121`
- RE-NAS: Modify `R/store/recorder.ts:131-206` (`wendeAn`), `:231-245` (`presetAnwenden`)
- Create: `apps/recorder/test/ui/fernbefehl.test.ts`, `apps/recorder/test/ui/netzordner.test.ts`, `apps/recorder/test/ui/altfehler.test.ts`
  (je `await lade('…', …)` vor `abschluss();` in `test/ui/selftest.ts`)
- Test: `apps/recorder/test/store.test.ts` (Attrappe `starte`), `apps/recorder/test/recorder.test.ts`, `apps/recorder/test/ui/oberflaeche.test.ts:270`,
  `apps/recorder/test/ui/live.test.tsx:154-158`, `:187-188`

**Interfaces:**
- Produces (`R/lib/fernbefehl.ts`, rein):
  `pruefeFernbefehl(cmd: RecorderRemoteCommand, lage: { status: RecorderStatus; dir: string | null; netzordnerOffen: string | null }): { ok: true } | { ok: false; hinweis: string; log: string }`.
  Abgelehnt: `arm`/`disarm` bei `recording`; `record` `on` oder `toggle` außerhalb einer Aufnahme ohne `dir` (mit `netzordnerOffen`
  der eigene Grund). `record off` nie. Texte:
  - Hinweis `RECORDER_TEXTE.fernbefehl.abgelehnt(verb, grund)` = `Companion „${verb}“ abgelehnt: ${grund}`; Verben `ARM`, `DISARM`,
    `RECORD ON`, `RECORD TOGGLE`; Gründe `RECORDER_TEXTE.fernbefehl.grund`: `aufnahmeLaeuft: 'Erst die Aufnahme stoppen.'`,
    `keinOrdner: 'Kein Zielordner gewählt.'`, `netzordnerOffen: 'Der Netzwerkordner aus der Show ist noch nicht bestätigt.'`.
  - Log: `Fernbefehl abgelehnt: ARM (Aufnahme läuft)`, `… DISARM (Aufnahme läuft)`, `… RECORD ON (kein Zielordner)`,
    `… RECORD TOGGLE (kein Zielordner)`, `… RECORD ON (Netzwerkordner aus der Show nicht bestätigt)`.
- Produces (IPC `recorder:ablehnung`, invoke `{ hinweis: string; log: string }`): Main schreibt `getLog().warn(log.slice(0, 500))`
  und schickt `hinweis` (500 Zeichen) als `recorder:notice` an das Fenster (Band bis „OK“). Preload
  `ablehnung(a: { hinweis: string; log: string }): Promise<void>`.
- Produces (`main/recorder.ts`): `arm()` beginnt mit `if (state.status === 'recording') return { ok: false, error: 'Erst die Aufnahme stoppen.' }`;
  `export function schliesseEingang(): OpResult` (in der Aufnahme dasselbe `ok: false`, sonst `disarm()` und `{ ok: true }`).
  `rec:disarm` ruft `schliesseEingang()`; `JmrecApi.disarm: () => Promise<OpResult>`; Store `disarm` setzt bei `!r.ok` `notice`.
  `disarm()` bleibt für `shutdown()` und `arm()`. `'Erst den Eingang öffnen (Arm).'` bleibt wörtlich in `main/recorder.ts`.
- Produces (`R/lib/oberflaeche.ts`): `RECORDER_TEXTE.grund.aufnahmeLaeuft = 'Erst die Aufnahme stoppen'`; bei `nimmtAuf(z)`
  `taste(T.taste.eingangSchliessen, 'gesperrt', T.grund.aufnahmeLaeuft)`.
- Produces (`src/shared/netzordner.ts`, rein): `normiereOrdner(p: string): string` (Schrägstriche zu `\`, klein, ohne `\` am Ende);
  `pruefeShowOrdner(dir: string, istBestaetigt: (p: string) => boolean): { art: 'setzen' | 'bestaetigen' | 'ungueltig'; dir: string }`
  (`!istErlaubterOrdner` → `ungueltig`; `istNetzwerkPfad` ohne Bestätigung → `bestaetigen`; sonst `setzen`).
- Produces (`main/netzordner.ts`, ohne Electron): `class NetzordnerListe { constructor(datei: string); laden(): void; enthaelt(p: string): boolean; merke(p: string): void }`;
  Datei `{ version: 1, ordner: string[] }`, Schreiben über Zwischendatei und Umbenennen wie `main/einstellungen.ts:19-25`, kaputte oder
  fehlende Datei = leere Liste. `main/ipc.ts`: `netzordnerDatei()` = `userData/recorder-netzordner.json`, `export function netzordnerListe(): NetzordnerListe`
  (einmal erzeugt, `laden()` beim ersten Aufruf).
- Produces (IPC `recorder:netzordnerBestaetigen`, invoke `pfad: string` → `boolean`): `istNetzwerkPfad && istErlaubterOrdner` → merken,
  `true`. Preload `netzordnerBestaetigen(pfad: string): Promise<boolean>`. Import-Dialog „Übernehmen“ (`ipc.ts:109-131`) merkt jeden
  Netzwerkordner (B4).
- Produces (`shared/types.ts`): `RecShowSettings.netzordnerOffen?: string`, `.ordnerUngueltig?: string`; `dir` kommt nur bei `setzen`.
  `settings:load` ohne `existsSync`, `ordnerDa: null`.
- Produces (Store): Felder `netzordnerOffen: string | null`, `dirGemerkt: string | null`; Aktion `netzordnerUebernehmen(): Promise<void>`;
  `LiveWerte.netzordnerOffen: string | null`, `LiveAktionen.netzordnerUebernehmen(): void`.
  Texte `RECORDER_TEXTE.netzordner`: `hinweis(pfad, server)` = `Die Show möchte in einem Netzwerkordner aufnehmen: ${pfad} (Server ${server}). Erst nach „Übernehmen“ ist er gesetzt – Windows meldet sich dann bei diesem Server an.`
  (`netzwerkServer`, `saeubereAnzeige`), `uebernehmen: 'Übernehmen'`, `ungueltig(pfad)` =
  `Zielordner aus der Show ist kein gültiger Ordner und wurde nicht übernommen: ${pfad}`. Logs im Main:
  `Show-Zielordner wartet auf Bestätigung: ‹Pfad›`, `Show-Zielordner ungültig, nicht übernommen: ‹Pfad›`. Der Text „Zielordner aus der
  Show liegt im Netzwerk: … – nur verwenden, wenn dieser Ordner bekannt ist.“ (`R/store/recorder.ts:309`) entfällt.
- Produces (RE-NAS): `wendeAn(name): Promise<string | undefined>` gibt den zu prüfenden Ordner zurück; `presetAnwenden` kettet nur
  `wendeAn`, sein Ergebnis-Versprechen ist `lauf.then(pruefeOrdner)`; `pruefeOrdner(dir, name)` setzt `hinweisOrdner` nur, solange
  `get().dir === dir`; läuft für denselben Pfad schon eine Prüfung, wird sie wiederverwendet (Map im Store-Modul).

- [ ] **Step 1: Bindung (B7)** mit `['RE-2', [main/recorder.ts, main/ipc.ts, preload/index.ts, shared/types.ts, store/recorder.ts, lib/fernbefehl.ts, lib/oberflaeche.ts]]`,
  `['RE-2b', [store/recorder.ts, lib/fernbefehl.ts, main/ipc.ts, preload/index.ts, shared/types.ts]]`,
  `['RE-7b', [shared/netzordner.ts, main/netzordner.ts, main/index.ts, main/ipc.ts, preload/index.ts, shared/types.ts, store/recorder.ts, lib/oberflaeche.ts, views/LiveBereich.tsx, views/RecorderOberflaeche.tsx]]`,
  `['RE-NAS', [store/recorder.ts]]` (Pfade mit `apps/recorder/src/…`). Der Verweis-Regex mit `(?![\w-])` trennt `RE-2` und `RE-2b`.
  Negativprobe: „Altfehler RE-2“ entlastet `views/LiveBereich.tsx` nicht. Lauf grün.
- [ ] **Step 2: Failing tests RE-2, RE-2b:**
  - `fernbefehl.test.ts`: `RE-2 arm und disarm bei recording abgelehnt, bei armed und idle ok`; `RE-2b record on und toggle ohne dir abgelehnt, off nie, mit dir ok`;
    `RE-7b record on mit netzordnerOffen nennt den eigenen Grund`; alle Hinweise und Log-Zeilen wörtlich wie oben.
  - `oberflaeche.test.ts:270`: Erwartung für `recording` `'Eingang schließen/gesperrt/Erst die Aufnahme stoppen | Stopp/live/-'`.
  - `live.test.tsx:154-158` `[T.taste.eingangSchliessen, 'gesperrt']`; ORAKEL `:187-188` `'recording/0': ['stop']`, `'recording/null': ['stop']`.
  - `store.test.ts` (Attrappe fängt `onRemoteCommand` als `fernbefehl`, bekommt `ablehnung`, `dialog.pickDir` und `startRecording`
    als Zähler): `RE-2 Companion ARM in der Aufnahme` (`setzeZustand({ status: 'recording' })`, `{ t: 'arm' }` → `aufrufe.arm` leer,
    `ablehnung` mit `{ hinweis: 'Companion „ARM“ abgelehnt: Erst die Aufnahme stoppen.', log: 'Fernbefehl abgelehnt: ARM (Aufnahme läuft)' }`);
    dasselbe für `disarm`; `RE-2 ARM bei armed wirkt wie heute` (arm 1×); `RE-2b Companion RECORD ON ohne Zielordner` (kein `pickDir`,
    kein `startRecording`, Ablehnung „Kein Zielordner gewählt.“); dasselbe mit `toggle` bei `armed`; `RE-2b mit Zielordner` →
    `startRecording` 1×.
  - `recorder.test.ts`: `RE-2 arm in der Aufnahme abgelehnt` (start, 10 Frames, `rec.arm(…)` → `ok false`, `error 'Erst die Aufnahme stoppen.'`,
    `status 'recording'`, `gestoppt` gleich; 10 Frames, Stopp → `dataLaenge === 160`); `RE-2 schliesseEingang in der Aufnahme abgelehnt, bei armed ok`.
- [ ] **Step 3: Failing tests RE-7b:**
  - `netzordner.test.ts`: `normiereOrdner('//nas/x/') === normiereOrdner('\\\\NAS\\x')`; `pruefeShowOrdner('\\\\nas\\x', () => false)` →
    `bestaetigen`; mit `(p) => normiereOrdner(p) === normiereOrdner('\\\\NAS\\x\\')` → `setzen`; `'\\\\?\\C:\\x'`, `'\\\\.\\COM1'`,
    `'\\\\nas'`, relativ → `ungueltig`; `'D:\\Show'` → `setzen`. `NetzordnerListe` (vergleicht normiert): `merke('\\\\NAS\\x')` schreibt
    in eine Temp-Datei, eine neue Liste liest sie wieder und `enthaelt('//nas/x/')` ist wahr; kaputte Datei → leer.
  - `store.test.ts` (Attrappe bekommt `netzordnerBestaetigen`, fängt `onShowSettings` als `schickeShow`):
    `RE-7b Show mit netzordnerOffen`: `dir null`, `netzordnerOffen` gesetzt, kein `ordnerDa`-Aufruf; `RE-7b netzordnerUebernehmen` ruft
    `netzordnerBestaetigen('\\\\nas\\x')` und setzt `dir`; `RE-7b pickDir leert netzordnerOffen`; `RE-7b × stellt den Ordner von vorher her` (D1);
    `RE-7b gleicher Ordner gilt als bestätigt` (D2: `dir` gesetzt, `netzordnerBestaetigen` 1×, kein Hinweis); `RE-7b Preset mit Ordner beendet den Vorschlag`;
    `RE-7b Einstellungen behalten den alten Ordner, solange die Frage offen ist` (nach `MERK_MS` ist das zuletzt gespeicherte `dir` der alte).
  - **Review Focus 1** `RE-7b Show-Vorschlag während der Aufnahme` (geladen mit `dir: 'E:\\Alt'`):
    `setzeZustand({ status: 'recording', filePath: 'E:\\Alt\\Tag.wav' })`,
    `schickeShow({ netzordnerOffen: '\\\\nas\\x' })` → kein `disarm`, kein `stopRecording`; Companion `{ t: 'record', mode: 'off' }` →
    `stopRecording` 1×; danach `setzeZustand({ status: 'armed' })` und `{ t: 'record', mode: 'on' }` → `startRecording` 0×,
    Ablehnung mit „Der Netzwerkordner aus der Show ist noch nicht bestätigt.“; nach `MERK_MS` gespeichertes `dir === 'E:\\Alt'`.
  - Fall 24 (`:463-471`) wird „bestätigter Netzwerkordner → gesetzt, kein Hinweis“; Fall 5 (`:164-169`) nutzt `lage.ordnerDa = false`;
    neu `RE-7b settings:load wartet nicht` (`ordnerDa` antwortet nie → `loading === false`, `deviceIndex` gesetzt).
  - `live.test.tsx`: `RE-7b Hinweis mit Taste „Übernehmen“` (Klick ruft `netzordnerUebernehmen`; ohne `netzordnerOffen` keine Taste).
  - `altfehler.test.ts` (Wächter): `main/index.ts` ruft `pruefeShowOrdner(` und übernimmt `s.dir` nicht mehr direkt;
    `settings:load` in `main/ipc.ts` ohne `existsSync`; der Import-Zweig „uebernehmen“ ruft `netzordnerListe().merke(`.
- [ ] **Step 4: Failing tests RE-NAS** (`store.test.ts`):
  - `RE-NAS langsame Ordnerprüfung hält das nächste Preset nicht auf`: Presets „Fo“ (`E:\Show`, Gerät 3) und „Mi“ (`\\nas\x`, Gerät 0),
    `ordnerDa('E:\\Show')` antwortet nie, Eingang `armed`; `presetAnwenden('Fo')`, `presetAnwenden('Mi')`, 60 ms → `aufrufe.arm` enthält 0.
  - `RE-NAS späte Antwort für einen alten Ordner überschreibt den Hinweis nicht`.
  - `RE-NAS zwei Prüfungen desselben Pfads zugleich: ein ordnerDa-Aufruf`.
  - Fälle 15, 23, 26 bleiben grün (das Ergebnis-Versprechen schließt die Prüfung ein).
- [ ] **Step 5:** Rot nachweisen.
- [ ] **Step 6: Implementieren** in der Reihenfolge B6/RE-2, RE-2b, RE-7b, RE-NAS (C9):
  - Store-Fernweg (`:333-348`): vor jeder Wirkung `pruefeFernbefehl(cmd, { status: s.state.status, dir: s.dir, netzordnerOffen: s.netzordnerOffen })`;
    bei Ablehnung nur `void window.jmrec.ablehnung({ hinweis, log })`. `record()` bleibt (von Hand weiter mit Dialog, Spec).
  - `applyShowSettings`: bei `netzordnerOffen` → gleich dem normierten `dir` (D2) wie `dir` behandeln und merken, sonst
    `set({ dirGemerkt: <bei schon offenem Vorschlag das alte dirGemerkt, sonst get().dir>, dir: null, netzordnerOffen: p, hinweisOrdner: null })`
    (ein zweiter Vorschlag ersetzt den ersten, der Ordner von vorher bleibt gemerkt); bei `ordnerUngueltig` → `hinweisOrdner`
    mit `ungueltig(pfad)`, `dir` bleibt; bei `dir` → wie heute ohne den Netzwerk-Hinweis.
  - `netzordnerUebernehmen`, `pickDir`, `hinweiseSchliessen` (D1: `dir = dirGemerkt`), Preset mit Ordner: jeweils `netzordnerOffen: null`.
  - Merken (`starteMerken`): solange `netzordnerOffen !== null`, geht `dirGemerkt` statt `dir` in die gespeicherten Werte;
    `aktuelleWerte` bleibt (Presets).
  - `init`: nach dem Setzen von `dir` `void window.jmrec.ordnerDa(e.dir).then(…)`; der Hinweis kommt nur, solange `get().dir === e.dir`.
  - Main `applyShowFromDeepLink`: `pruefeShowOrdner(s.dir, (p) => netzordnerListe().enthaelt(p))`, Ergebnis in `out.dir`,
    `out.netzordnerOffen` oder `out.ordnerUngueltig`, bei den letzten beiden eine Log-Zeile. `readFileSync` der Show bleibt (B4).
  - `PresetLeiste.tsx` bleibt unberührt (B7).
  - Funktionsliste: Zeilen und Wächter nachführen: `:372-373` (Nr. 22/80), `:380-381` (Nr. 24, Prüfung und Text neu), `:388-389`
    (der Store enthält „Erst den Eingang öffnen“ weiter nicht), `:445-446` (Nr. 48–52), `:451-452` (Nr. 53, Text neu), `:503-506`
    (Nr. 107–109 → „Altfehler RE-2“), `:579` (Abschnitt 10, Befunde 2 und 7 mit angehängtem Satz).
- [ ] **Step 7:** Tests grün, auch mit `JM_FUNKTIONSLISTE_GIT=1`. Mutationsproben: `recording`-Prüfung in `pruefeFernbefehl` weg →
  RE-2 rot; Main-Wächter in `arm()` weg → „arm in der Aufnahme“ rot; `dir`-Prüfung weg → RE-2b rot; `istBestaetigt` immer wahr →
  RE-7b rot; Ordnerprüfung zurück in die Kette → RE-NAS rot.
- [ ] **Step 8: Commit** `fix(recorder): Companion lehnt ARM/DISARM in der Aufnahme und RECORD ON ohne Ordner ab, Show-Netzwerkordner nur nach Bestätigung (RE-2, RE-2b, RE-7b, RE-NAS)`.

### Task 7: Recorder B · Fehlerzustand, Rückfrage beim Schließen, freier Platz (RE-3, RE-7a, RE-PLATZ)

**Files:**
- RE-3: Create `apps/recorder/src/main/eingang-waechter.ts`; Modify `src/main/recorder.ts:115-155` (`onFrames`), `:186-206`
  (`waechterTakt`), `:211-245` (`arm`), `:297-375` (`startRecording`, `stopRecording`), `:381-395`; `src/main/ipc.ts`
  (`rec.setProtokoll`); `src/shared/types.ts:13-24`; `R/lib/oberflaeche.ts:183-185`, `:299-306`, `:366-385`; `R/views/LiveBereich.tsx:54-59`
- RE-7a: Create `apps/recorder/src/shared/schliessen.ts`, `apps/recorder/src/renderer/src/views/SchliessenFrage.tsx`; Modify
  `src/main/index.ts:116-126`, `:174-183`; `src/preload/index.ts`; `src/shared/types.ts`; `R/store/recorder.ts` (Feld, Abo in `init`);
  `R/views/RecorderOberflaeche.tsx`
- RE-PLATZ: Create `apps/recorder/src/main/platz.ts`, `apps/recorder/src/renderer/src/lib/platz.ts`; Modify `src/main/ipc.ts`
  (`fs:platz`), `src/main/recorder.ts` (`spuren`), `src/preload/index.ts`, `src/shared/types.ts`, `R/lib/oberflaeche.ts:128`, `:340-350`,
  `R/store/recorder.ts`, `R/views/RecorderOberflaeche.tsx`
- Modify: `apps/recorder/test/ui/funktionsliste.test.ts` (Map um RE-3, RE-7a, RE-PLATZ; Wächter `:288-291`, `:451-452`),
  `docs/ux/funktionslisten/recorder.md` (Nr. 2, 23, 25, 53, 62, 79, 87–90, 134, 138, die Statusleisten-Zeile für RE-PLATZ,
  Abschnitt 10 Befund 3)
- Modify: `apps/recorder/test/ui/testzustand.ts:31` (Zustand mit `fehler: null`, `spuren: false`, sonst scheitert die Typprüfung)
- Create: `apps/recorder/test/ui/schliessen.test.tsx`, `apps/recorder/test/ui/platz.test.ts` (je `await lade(…)` vor `abschluss();`)
- Test: `apps/recorder/test/recorder.test.ts`, `apps/recorder/test/store.test.ts`, `apps/recorder/test/ui/oberflaeche.test.ts:215`,
  `:222`, `apps/recorder/test/ui/live.test.tsx`, `apps/recorder/test/ui/altfehler.test.ts`

**Interfaces:**
- Produces (`shared/types.ts`): `export interface RecorderFehler { art: 'schreiben' | 'eingang' | 'start'; text: string; datei: string | null }`;
  `RecorderState.fehler: RecorderFehler | null`; `RecorderState.spuren: boolean` (in `startRecording` = `multiWriter !== null`).
- Produces (`main/eingang-waechter.ts`, rein): `export const KEINE_BLOECKE_MS = 2000; export const BLOECKE_TAKT_MS = 250;`
  `bloeckeLage(l: { jetzt: number; letzterBlock: number; letzterTakt: number }): 'ok' | 'stau' | 'fehlen'` (`stau`, wenn
  `jetzt - letzterTakt >= KEINE_BLOECKE_MS`; sonst `fehlen`, wenn `jetzt - letzterBlock >= KEINE_BLOECKE_MS`; sonst `ok`).
- Produces (`main/recorder.ts`): `export function setProtokoll(f: (zeile: string) => void): void` (Standard: nichts; `main/ipc.ts`
  hängt `getLog().warn` ein); intern `schreibfehler(art: RecorderFehler['art'], e: unknown, kopf?: boolean): void` (D3): Stille nicht
  mehr auffüllen, Block-Wächter und Zeitgeber lösen (`clearTimers`), `finalize` beider Schreiber je in `try`, `status = 'armed'`,
  `fehler` setzen, `notice`, Log, `emitState()`. Block-Wächter nur bei Nicht-Loopback während der Aufnahme
  (`setInterval(…, BLOECKE_TAKT_MS)`, `unref`), bei `stau` Grundlinie neu (`letzterBlockMs = jetzt`), bei `fehlen`
  `schreibfehler('eingang', …)`. `export const AUFNAHME_FEHLER_TEXTE`:
  - `schreiben(datei, grund)` = `Aufnahme beendet: Schreibfehler in „${datei}“: ${grund}. Das bisher Aufgenommene ist gespeichert.`
  - `kopf(datei, grund)` = `Aufnahme beendet: Der Dateikopf von „${datei}“ konnte nicht geschrieben werden: ${grund}.`
  - `eingang` = `Aufnahme beendet: Vom Eingang kamen 2 s lang keine Audiodaten. Das bisher Aufgenommene ist gespeichert.`
  - `eingangGrund` = `Keine Audiodaten vom Eingang` (Text des Fehlerfelds bei `art: 'eingang'`)
  - Log `log(art, datei, grund)` = `Aufnahme beendet (${art}): ${datei}: ${grund}`.
  `main/control-server.ts` ändert sich nicht (B2).
- Produces (`R/lib/oberflaeche.ts`): `kopfOnAir` nie live bei `zustand.fehler`; `aufnahmeItem` bei `fehler` `state: 'error'` mit
  `RECORDER_TEXTE.fehler.detail(f)`: `schreiben` → `Schreibfehler – Aufnahme beendet: ${f.text}`, `eingang` →
  `Keine Audiodaten vom Eingang – Aufnahme beendet`, `start` → `Aufnahme nicht gestartet: ${f.text}`; `hauptTasten(...).aufnahme` bei
  `fehler` `RECORDER_TEXTE.taste.neuAufnehmen = 'Neu aufnehmen'` (bereit); Marke `RECORDER_TEXTE.fehler.marke` =
  `{ schreiben: 'Schreibfehler', eingang: 'Kein Eingang', start: 'Nicht gestartet' }`, Tönung `destructive` (nie „Fehler“, das ist
  `UI_TEXTE.zustand.error`).
- Produces (`shared/schliessen.ts`, rein): `export const SCHLIESSEN_RUECKFALL_MS = 1000;`
  `export const SCHLIESSEN_TEXTE = { frage: 'Aufnahme läuft. Wirklich beenden?', detail: 'Die Aufnahme wird abgeschlossen und gespeichert, danach schließt der Recorder.', beenden: 'Aufnahme beenden', weiter: 'Weiter aufnehmen' } as const;`
  `schliessenEntscheid(l: { status: RecorderStatus; bestaetigt: boolean; frageOffen: boolean }): 'schliessen' | 'fragen' | 'warten'`;
  `class SchliessenAblauf { constructor(uhr?: { setze(f: () => void, ms: number): unknown; loesche(t: unknown): void }); get offen(): boolean; stelle(rueckfall: () => void): boolean; gezeigt(): void; antwort(): boolean }`
  (`stelle` startet die 1-s-Frist und gibt `false`, wenn schon offen; `gezeigt` löscht die Frist; `antwort` schließt und gibt `true`
  nur für die erste Antwort, D4). `RECORDER_TEXTE.schliessen = SCHLIESSEN_TEXTE`.
- Produces (IPC): `recorder:schliessenFrage` (send, `offen: boolean`), `recorder:schliessenAntwort` (invoke,
  `'gezeigt' | 'beenden' | 'weiter'`). Preload `onSchliessenFrage(cb: (offen: boolean) => void): () => void`,
  `schliessenAntwort(a: 'gezeigt' | 'beenden' | 'weiter'): Promise<void>`. Store-Feld `schliessenFrage: boolean`.
- Produces (`R/views/SchliessenFrage.tsx`): `SchliessenFrage({ onWeiter, onBeenden }: { onWeiter: () => void; onBeenden: () => void })`
  mit `Modal` aus `@jm/ui` wie `apps/player/src/renderer/src/views/EntfernenFrage.tsx`: Frage und Detail, „Weiter aufnehmen“ zuerst
  (Fokus beim Öffnen), dann „Aufnahme beenden“ (`destructive`); Escape und Hintergrund = weiter; `onWeiter` stabil (`useCallback`).
- Produces (`main/platz.ts`, ohne Electron): `elternOrdner(p: string): string | null` (`path.win32` für Pfade mit Laufwerk oder `\\`,
  sonst `path.posix`; `null`, wenn `dirname(p) === p`); `freierPlatz(dir: string, statfs?: (p: string) => Promise<{ bavail: number | bigint; bsize: number | bigint }>): Promise<number | null>`
  (Standard `fs.promises.statfs`; bei `ENOENT` zum Elternordner, sonst `null`; Ergebnis `bavail × bsize`);
  `export const PLATZ_GRENZE_MS = 3000;` `class PlatzAbfrage { constructor(messe?: typeof freierPlatz, grenzeMs?: number); frage(dir: string): Promise<number | null> }`
  (je Pfad höchstens eine Messung zugleich, gleichzeitige Fragen teilen sie; nach `grenzeMs` antwortet sie `null`, die alte Messung
  läuft im Hintergrund aus). IPC `fs:platz` (invoke, `dir: unknown` → `number | null`), Preload `platz(dir: string): Promise<number | null>`.
- Produces (`R/lib/platz.ts`, rein): `export const PLATZ_TAKT_MS = 5000;` `bytesProSekunde(f: { kanaele: number; rate: number; spuren: boolean }): number`
  (`kanaele × rate × 4 × (spuren && kanaele > 1 ? 2 : 1)`); `platzOrdner(z: RecorderState | undefined, dir: string | null): string | null`
  (in der Aufnahme der Ordner von `z.filePath`, Trenner `\` und `/`; sonst `dir`); `restzeitSek(frei: number, bps: number): number`;
  `platzEintrag(frei: number | null | undefined, bps: number, ordner: string | null): StatusItem` (Titel `RECORDER_TEXTE.platz.titel`,
  Gruppe `ausgabe`, `settingsSection: 'ziel'`; ab 900 s `ok`, unter 900 s `warn`, unter 300 s `error`; `null`/`undefined` →
  `unbekannt(…)` aus `@jm/ui`; ohne Ordner `off` mit `keinOrdner`; nie gesperrt). Texte `RECORDER_TEXTE.platz`:
  `titel: 'Platz'`, `fuer(h, m)` = `für ${h} h ${m} min` bzw. `für ${m} min` bei `h === 0`, `unterMinute: 'für unter 1 min'`,
  `voll: 'voll'`, `keinOrdner: 'kein Zielordner'`. Werte: vor der Aufnahme Store-Wunsch (`channels`, `sampleRate`, `separateTracks`),
  bei offenem Eingang und in der Aufnahme `zustand.channels`, `zustand.sampleRate`, in der Aufnahme `zustand.spuren`.
- Produces (Store): `platzFrei: number | null | undefined`; Abfrage in `init` über `useRec.subscribe` (sofort bei Wechsel von Ordner,
  Format, Spuren oder Status) und einen Takt `PLATZ_TAKT_MS`, höchstens eine Abfrage zugleich. `OberflaechenStand.platz?: { frei: number | null | undefined; spuren: boolean; dir: string | null }`
  (optional); `statusLeiste` fügt den Eintrag nach `aufnahmeItem` ein.

- [ ] **Step 1: Failing tests RE-3** (`recorder.test.ts`; Fehler per `WavWriter.prototype.writeBlock = () => { throw Object.assign(new Error('ENOSPC: no space left on device, write'), { code: 'ENOSPC' }) }`,
  danach zurücklegen; die `setInterval`-Umleitung merkt zusätzlich jede Rückruffunktion mit `ms` in `intervalle`; Zeit über ein
  umgelegtes `Date.now`; `setProtokoll` fängt die Zeilen):
  - `RE-3 Schreibfehler im Block wirft nicht` (`aufFrames(…)` wirft nicht).
  - `RE-3 Zustand nach Schreibfehler`: `status 'armed'`, `fehler.art 'schreiben'`, `fehler.text` enthält „ENOSPC“, `filePath` bleibt,
    `dataLaenge === 80` (10 Frames vor dem Fehler), eine Log-Zeile `Aufnahme beendet (schreiben): …`.
  - `RE-3 Spurfehler` (`MultiWavWriter.prototype.writeBlock` wirft) → derselbe Zustand.
  - `RE-3 Stille-Schreibfehler (Loopback, Gerät 5)` → `fehler` gesetzt.
  - `RE-3 Kopf beim Stopp nicht schreibbar` (`WavWriter.prototype.finalize` wirft) → `fehler` gesetzt, `status 'armed'`.
  - `RE-3 gescheiterter Start setzt fehler` (`art 'start'`), `RE-3 Neustart löscht fehler`, `RE-3 Stopp im Fehlerzustand quittiert`
    (`ok true`, kein `filePath`, `fehler === null`).
  - `RE-3 Schreibfehler löscht den geplanten Stopp`: `schedule` mit Dauer, Fehler → `scheduledStopAt === null`.
  - `RE-3 kein Block 2 s (Gerät 0)`: start, 10 Frames, Uhr in Schritten von 250 ms bis +2250 vorstellen und je Schritt den Block-Wächter
    aus `intervalle` rufen → `status 'armed'`, `fehler.art 'eingang'`, `dataLaenge === 80`.
  - `RE-3 Ereignisschleife hing`: ein Takt erst nach +2100 → kein `fehler`, `status 'recording'`.
  - `RE-3 Loopback ohne Block-Wächter` (Gerät 5): kein neuer Eintrag in `intervalle` mit `BLOECKE_TAKT_MS`.
  - `eingang-waechter` rein (in `altfehler.test.ts`): `bloeckeLage` an den Grenzen 1999/2000 für beide Zweige.
- [ ] **Step 2: Failing tests RE-3 Anzeige** (`oberflaeche.test.ts`, `live.test.tsx`): `RE-3 Statusleiste aufnahme bei fehler` (je Art
  der Text oben, `state 'error'`); `RE-3 ON AIR nie live bei fehler`; `RE-3 Haupttaste „Neu aufnehmen“ bereit`; Marke „Schreibfehler“.
  Wächter (`altfehler.test.ts`): `toSuiteState` in `main/control-server.ts` liest nur `status` und `recordedSec`.
- [ ] **Step 3: Failing tests RE-7a** (`schliessen.test.tsx`):
  - `RE-7a schliessenEntscheid`: `recording` → `fragen`; `armed`, `idle` → `schliessen`; `recording` + `bestaetigt` → `schliessen`;
    `recording` + `frageOffen` → `warten`.
  - `RE-7a SchliessenAblauf` (Schein-Uhr): `stelle(r)` → `true`, zweites `stelle` → `false`; ohne `gezeigt` ruft die Uhr nach 1000 ms `r`
    1×, nicht bei 999; mit `gezeigt` nie; erste `antwort()` → `true`, zweite → `false`.
  - `RE-7a Texte`: `SCHLIESSEN_TEXTE` wörtlich wie oben.
  - `RE-7a Fenster`: Render von `SchliessenFrage` → erster Knopf „Weiter aufnehmen“, zweiter „Aufnahme beenden“; Klick auf „Aufnahme
    beenden“ ruft `onBeenden` 1×; `Modal` bekommt `onClose === onWeiter`.
  - Wächter (`altfehler.test.ts`): `main/index.ts` enthält `win.on('close'`, `preventDefault()`, `schliessenEntscheid(`,
    `recorder:schliessenFrage`, `dialog.showMessageBox(win` mit `SCHLIESSEN_TEXTE`, `session-end` und kein `showMessageBoxSync`;
    `closed` ruft weiter `shutdown()`; `before-quit` ruft `stopControlServer` nicht mehr, `will-quit` ruft es.
    `recorder.test.ts:51-58` (shutdown während der Aufnahme) bleibt unverändert.
- [ ] **Step 4: Failing tests RE-PLATZ** (`platz.test.ts`):
  - `RE-PLATZ bytesProSekunde`: `(2, 48000, false) === 384000`; `(8, 96000, true) === 6144000`; `(1, 48000, true) === 192000`.
  - `RE-PLATZ Restzeit und Stufen`: frei = 384000 × 7800 → „für 2 h 10 min“ `ok`; 899 s `warn`, 900 s `ok`; 299 s `error`, 300 s `warn`;
    59 s „für unter 1 min“ `error`; 0 → „voll“ `error`; `null` → „unbekannt“; ohne Ordner → `off` „kein Zielordner“.
  - `RE-PLATZ in der Aufnahme zählt der Zustand, nicht der Wunsch` (`platzOrdner` nimmt den Ordner von `filePath`, `channels` und
    `sampleRate` aus dem Zustand).
  - `RE-PLATZ freierPlatz`: nicht vorhandener Ordner → gemessen am nächsten vorhandenen Vorfahren (Attrappe zählt die Pfade),
    `bavail × bsize`; anderer Fehler → `null`; echter Temp-Ordner > 0.
  - **Review Focus 2** `RE-PLATZ elternOrdner endet an der Wurzel`: `elternOrdner('\\\\nas\\share\\Neu') === '\\\\nas\\share\\'`,
    `elternOrdner('\\\\nas\\share\\') === null`, `elternOrdner('D:\\') === null`, `elternOrdner('/srv/aufnahme') === '/srv'`; `freierPlatz`
    für `\\nas\share\Neu\Tag1`, wenn alle Ebenen `ENOENT` melden → `null` nach höchstens drei Aufrufen.
  - `RE-PLATZ PlatzAbfrage`: zwei Fragen zugleich → eine Messung; Messung antwortet nie → `null` nach `grenzeMs` (30 ms im Test).
  - `store.test.ts`: `RE-PLATZ nur eine Abfrage zugleich; Ordnerwechsel fragt sofort neu`; offener Netzwerkvorschlag (RE-7b) → keine
    Abfrage.
  - `oberflaeche.test.ts:215` (Reihenfolge mit `'platz'`) und `:222` (eine Gruppe mehr) als geänderte Erwartung mit ID.
- [ ] **Step 5:** Rot nachweisen.
- [ ] **Step 6: Implementieren** in der Reihenfolge RE-3, RE-7a, RE-PLATZ (C9):
  - RE-3: `onFrames` fasst Stille, beide `writeBlock` und `recordedSec` in `try`, `catch` → `schreibfehler('schreiben', e)`; ebenso
    `waechterTakt` und `stopRecording` (Kopf: `kopf = true`, Fehlerfeld `art 'schreiben'`); `startRecording`-`catch` setzt
    `fehler = { art: 'start', text: message, datei: null }` und `emitState()`. Gelöscht wird `fehler` nach D3.
  - RE-7a (B3, D4) in `createMainWindow` mit `const ablauf = new SchliessenAblauf()`: `win.on('close', (e) => …)` mit
    `schliessenEntscheid({ status, bestaetigt, frageOffen: ablauf.offen })`; bei `fragen` `preventDefault()`, `ablauf.stelle(rueckfall)`
    und `win.webContents.send('recorder:schliessenFrage', true)`; bei `warten` nur `preventDefault()`. Antwort `gezeigt` →
    `ablauf.gezeigt()`; `beenden` → nur bei `ablauf.antwort()` `bestaetigt = true`, `win.close()`, bei Cmd+Q-Wunsch `app.quit()`;
    `weiter` → `ablauf.antwort()`, Wunsch verwerfen. `rueckfall`: `send(…, false)`, dann
    `dialog.showMessageBox(win, { type: 'warning', message: SCHLIESSEN_TEXTE.frage, detail: SCHLIESSEN_TEXTE.detail, buttons: [SCHLIESSEN_TEXTE.beenden, SCHLIESSEN_TEXTE.weiter], defaultId: 1, cancelId: 1 })`
    asynchron, Antwort 0 wie `beenden`, sonst wie `weiter`. Nie `showMessageBoxSync`. `win.on('session-end', …)`: `bestaetigt = true`, `shutdown()`.
    `before-quit` merkt nur den Beenden-Wunsch, `will-quit` ruft `stopControlServer()`. Fenster: Store-Abo `onSchliessenFrage`; bei
    `true` sofort `schliessenAntwort('gezeigt')` und `SchliessenFrage` zeigen; `RecorderOberflaeche` reicht Weiter/Beenden durch.
  - RE-PLATZ: Main `PlatzAbfrage` hinter `fs:platz`; `RecorderState.spuren`; Store-Takt; Statusleiste.
  - Funktionsliste: Map `['RE-3', [main/recorder.ts, main/eingang-waechter.ts, main/ipc.ts, shared/types.ts, lib/oberflaeche.ts, views/LiveBereich.tsx]]`,
    `['RE-7a', [shared/schliessen.ts, main/index.ts, preload/index.ts, shared/types.ts, store/recorder.ts, views/SchliessenFrage.tsx, views/RecorderOberflaeche.tsx, lib/oberflaeche.ts]]`,
    `['RE-PLATZ', [main/platz.ts, main/ipc.ts, main/recorder.ts, preload/index.ts, shared/types.ts, lib/platz.ts, lib/oberflaeche.ts, store/recorder.ts, views/RecorderOberflaeche.tsx]]`;
    `:288-291` (Nr. 2 mit „Altfehler RE-7a“), `:451-452` (Nr. 53, Text neu); die Statusleisten-Zeile (Haken nennt `statusLeiste`) bekommt
    „Platz … (Altfehler RE-PLATZ)“, ohne neue Zeile (B5).
- [ ] **Step 7:** Tests grün, auch mit `JM_FUNKTIONSLISTE_GIT=1`. Mutationsproben: `try` in `onFrames` weg → „wirft nicht“ rot; Block-
  Wächter weg → „kein Block 2 s“ rot; `stau`-Zweig weg → „Ereignisschleife hing“ rot; `preventDefault` weg → Wächter rot; Grenze
  `< 900` zu `<= 900` → Stufen rot; Wurzel-Abbruch in `elternOrdner` weg → Review Focus 2 rot.
- [ ] **Step 8: Echt-Fenster-Messung RE-7a** (Pflicht, Spec 7; Blocker 8729):
  - Bau `npm run build -w @jm/recorder`; Attrappen-Addon `apps/recorder/out/node_modules/@jm/audio/index.js` (git-ignoriert) mit
    `init`, `listHostApis`, `listDevices` (ein Gerät „Attrappe“, 1024 Eingangskanäle, 48000 Hz), `openInput` (alle 10 ms
    `cb(new Float32Array(ch*480), ch, 480)`), `stopInput`, `terminate`; geladen ist es, wenn das Panel „Attrappe“ zeigt. Kein
    `jm_audio.node`. `recorder-settings.json` im Testprofil mit `dir` im Scratchpad und `eingang` = Attrappe.
  - a) „Eingang öffnen“, „Aufnahme“, 2 s → WAV wächst. `window.close()` im Renderer → das CDP-Ziel lebt, die Rückfrage steht im DOM,
    die Marke zeigt „Aufnahme“, die WAV wächst weiter. „Weiter aufnehmen“ per CDP → Fenster bleibt, Aufnahme läuft.
  - b) erneut `window.close()`, „Aufnahme beenden“ → der Prozess endet, die WAV hat einen Kopf mit Länge > 0.
  - c) ohne Aufnahme (nur „Eingang öffnen“): `window.close()` → der Prozess endet ohne Rückfrage.
  - d) Rückfall: Renderer per CDP `Debugger.pause`, Schließen über den Inspector des Hauptprozesses
    (`BrowserWindow.getAllWindows()[0].close()`) → nach 1–2 s zeigt die Fensterzählung (nur lesend) ein Dialogfenster `#32770` des
    Prozesses; danach die Test-Instanz per `taskkill /PID` beenden (nur sie).
  - e) nebenbei RE-PLATZ: Statuseintrag „Platz …“ bei 1024 Kanälen und 48 kHz sichtbar (Stufe und Text ins Ergebnis).
  - Ergebnis `out/t7-messung.json`.
- [ ] **Step 9: Commit** `fix(recorder): Schreibfehler beendet sauber, Rückfrage beim Schließen, freier Platz als Restzeit (RE-3, RE-7a, RE-PLATZ)`.

### Task 8: Presenter 0.15.1 und Companion-Modul 0.4.0 · PIN-Prüfung schaltet nichts, Wahl an Schwarz und Weiß (PS-15, PS-18)

**Files:**
- PS-15: Modify `apps/presenter/src/main/remote-page.ts:137-145`; Create `apps/presenter/test/handy-seite.test.ts` (in die Kette
  `selftest` von `apps/presenter/package.json`)
- PS-18 Presenter: Create `apps/presenter/src/main/schirm-wahl.ts`, `apps/presenter/test/schirm-wahl.test.ts` (in die Kette); Modify
  `apps/presenter/src/main/control-server.ts:6-10`, `:73-78`
- PS-18 Modul: Modify `packages/companion-jm-suite/lib.mjs:6-48`, `main.js:108-118`, `:139-160`, `package.json:3`,
  `companion/manifest.json:6`, `README.md`, `test/selftest.mjs`
- Modify: `apps/presenter/test/ui/funktionsliste.test.ts` (`GEAENDERT` `:60-105`, `ORTE` `:34-46`, `ERLAUBT` `:133-140`, Wächter
  `:600`, Negativproben `:386-397`), `docs/ux/funktionslisten/presenter.md` (Nr. 77, 78, 169–176, 213, 221, Abschnitt 9 Z. 466-469,
  Abschnitt 10 Befunde 15, 18)

**Interfaces:**
- PS-15 (P7): `controllerHtml(pinRequired: boolean): string` bleibt. Der Klick auf „Verbinden“ ruft
  `fetch('/events?pin=' + encodeURIComponent(pin), { signal })` mit `AbortController`: 401 → „Falsche PIN.“ und das Tor bleibt;
  sonst `abort()`, Tor zu, `connect()`. Kein `/cmd` mit `action:'live'` mehr in diesem Weg; `remote.ts` bleibt unverändert.
- PS-18 Presenter (`src/main/schirm-wahl.ts`, nur `import type { ScreenMode } from '@shared/types'`):
  `schirmBefehl(aktuell: ScreenMode, ziel: 'black' | 'white', wahl: string | undefined): ScreenMode | null` (Groß/Klein egal;
  `on`/`1`/`true` → `aktuell === ziel ? null : ziel`; `off`/`0`/`false` → `aktuell === ziel ? 'live' : null`; alles andere → `ziel`).
  `control-server.ts`: `case 'black': { const m = schirmBefehl(getState().screen, 'black', cmd.args[0]); if (m) setScreen(m); break; }`,
  ebenso `white`; Kopfkommentar `PRESENTER BLACK|WHITE [ON|OFF|TOGGLE]`. `present.ts` bleibt unverändert.
- PS-18 Modul (`lib.mjs`, P1):
  - `export const SCHIRM_WAHL = { id: 'mode', label: 'Modus', type: 'dropdown', default: 'toggle', choices: [{ id: 'toggle', label: 'Umschalten' }, { id: 'on', label: 'An' }, { id: 'off', label: 'Aus' }] }`.
  - `export function aktionenFuer(cap)`: `cap.actions`; bei `cap.role === 'presenter'` bekommen `black` und `white` ohne eigene
    `args` `args: [SCHIRM_WAHL]`.
  - `buildCommandLine`: `let val = options?.[arg.id] ?? arg.default`; ein Argument `mode` immer groß. Kein `toggleKey` an Schwarz
    und Weiß (Umschalten löst der Presenter auf).
  - `main.js`: `buildActions` und `buildPresets` iterieren `aktionenFuer(cap)`. Kein Upgrade-Skript.
  - Version 0.4.0 in `package.json` und `companion/manifest.json`. README: Abschnitt „Rolle „JM Presenter“ (ab Modul 0.4.0)“ mit der
    Wahl, der Vorgabe und dem Satz „Ein Presenter bis 0.15.0 schaltet bei jeder Wahl um.“

- [ ] **Step 1: Failing test PS-15** (`handy-seite.test.ts`, `node:vm` mit Attrappen für `document`, `localStorage`, `EventSource`,
  `fetch`): `PS-15 PIN-Prüfung schaltet nichts`: `pin.value = '1234'`, Klick-Hörer von `connect` → kein Aufruf an `/cmd`, kein Body
  mit `"action":"live"`, genau ein GET auf `/events?pin=1234`; bei 401 „Falsche PIN.“ in `gateErr`, Tor bleibt; bei 200 ist `gate`
  versteckt und eine `EventSource('/events?pin=1234')` offen. Gegenprobe: „Folie“ (`data-screen="live"`) sendet weiter `/cmd` mit
  `action:'live'`.
- [ ] **Step 2: Failing test PS-18 Presenter** (`schirm-wahl.test.ts`):
  - Tabelle für `black` (aktuell, wahl → Ergebnis): live, — → black; black, — → black; live, ON → black; black, on → null;
    white, ON → black; black, OFF → live; live, off → null; white, OFF → null; black, TOGGLE → black; live, UNDEFINED → black;
    dieselbe Tabelle für `white`.
  - Mit dem echten `present.ts` und Fenster-Attrappe (Muster `test/wiedergabe.test.ts:12-31`): Präsentation starten, zweimal `ON` →
    `getState().screen === 'black'`; `OFF` → `'live'`; ohne Wahl zweimal → `'live'`.
  - Wächter (`test/ui/bruecken.test.ts`): `control-server.ts` ruft in `case 'black'` und `case 'white'`
    `schirmBefehl(getState().screen, '<ziel>', cmd.args[0])`.
- [ ] **Step 3: Failing test Modul** (`test/selftest.mjs`): Aktion aus `aktionenFuer(CAPABILITIES.presenter)`: `{ mode: 'on' }` →
  `PRESENTER BLACK ON`; `{ mode: 'off' }` → `PRESENTER BLACK OFF`; `{ mode: 'toggle' }` → `PRESENTER BLACK TOGGLE`; `{}` (Taste aus
  0.3.0) → `PRESENTER BLACK TOGGLE`; für `white` ebenso. Option „Modus“, Vorgabe `toggle`, Wahlen „Umschalten“, „An“, „Aus“. Der
  Round-Trip (Z. 62-82) läuft über `aktionenFuer`; bestehende Zeilen (Z. 24-36) unverändert. Wächter: `main.js` nutzt
  `aktionenFuer(cap)` in `buildActions` und `buildPresets`. Version 0.4.0 in beiden Dateien (Z. 155-159).
- [ ] **Step 4:** Rot nachweisen.
- [ ] **Step 5: Implementieren** wie in den Interfaces. Funktionsliste: `remote-page.ts` und `schirm-wahl.ts` in `GEAENDERT`;
  `ERLAUBT` um `['apps/presenter/src/main/remote-page.ts', ['PS-15']]`, `control-server.ts` von `['B2']` auf `['B2', 'PS-18']`;
  `ORTE` um „Handy-Seite“; die zehn Haken Nr. 169–176, 213, 221 mit „PS-15“ (Nr. 169: „die PIN prüft die Seite über `/events`, ohne
  zu schalten (PS-15)“), Nr. 77/78 mit „PS-18“; Wächter `:600` „nur mit PS-15“; Negativprobe „remote-page.ts ohne PS-15 ergibt
  geänderte Datei“; Abschnitt 9 (`BLACK`/`WHITE` mit Wahl, „PIN-Prüfung“ beim Verb `live` streichen), Abschnitt 10 je ein Satz
  „Altfehler Stufe 2 …“.
- [ ] **Step 6:** Presenter-Selbsttest und Typprüfung grün, auch mit `JM_FUNKTIONSLISTE_GIT=1`; Modul-Selbsttest grün;
  `node scripts/sync-companion-protocol.mjs` mit anschließendem `git diff --exit-code packages/companion-jm-suite/generated`
  (Exit 0, P1). Mutationsproben: Rückfall `?? arg.default` weg → `{}`-Fall rot; `on`-Zweig auf Umschalten → Tabelle rot; Handy-Seite
  zurück auf `/cmd` → PS-15 rot.
- [ ] **Step 7: Bau des Moduls (P2):** In `packages/companion-jm-suite` die Junction `node_modules` →
  `C:/Users/alexk/alexzvn/packages/companion-jm-suite/node_modules` (`cmd //c mklink /J`, `C:` groß); vorher und nachher
  `ls -la C:/Users/alexk/alexzvn/packages/companion-jm-suite/node_modules/.cache 2>&1` festhalten (entsteht dort etwas: melden, nicht
  löschen). `node build-local.mjs` (Node 22) → `pkg.tgz`; kopieren nach
  `.superpowers/sdd/2026-11-26-altfehler-stufe2/out/jm-suite-companion-0.4.0.tgz`; `tar -xOzf … pkg/companion/manifest.json` zeigt
  `"version": "0.4.0"`. Danach `cmd //c rmdir node_modules`, `pkg/` und `pkg.tgz` im Modulordner löschen (git-ignoriert, keine
  Junction), Link-Prüfung Exit 0, `git status --short` ohne Spuren.
- [ ] **Step 8: Commit** `fix(presenter): PIN-Prüfung der Handy-Seite schaltet nichts, Schwarz/Weiß mit Wahl; Companion-Modul 0.4.0 (PS-15, PS-18)`.

### Task 9: Connect 0.6.1 · Doppelklick auf „Meeting verlassen“ verlässt nie (CN-MV)

**Files:**
- Create: `apps/connect/src/renderer/src/zoom/verlassen.ts` (rein, ohne `window`; nicht in `zoom-text.ts` wegen
  `funktionsliste.test.ts:429-434`)
- Modify: `apps/connect/src/renderer/src/zoom/ZoomCard.tsx:60`, `:106-114`, `:146-153`, `:287-305`
- Create: `apps/connect/test/ui/verlassen.test.ts` (statischer Import in `test/ui/selftest.ts` vor `abschluss();`)
- Modify: `apps/connect/test/ui/funktionsliste.test.ts` (`GEAENDERT` `:74 ff.`, GIT-Wächter `:466-480`),
  `docs/ux/funktionslisten/connect.md` (Nr. 75 Z. 202, Nr. 122 Z. 255, Zeilenangaben der Haken)
- Test: `apps/connect/test/ui/live.test.tsx:333-347` (bleibt), `:352-440` (Muster `pruefe`)

**Interfaces:**
- Produces (`R/zoom/verlassen.ts`):
  - `export const VERLASSEN_SPERRE_MS = 1000;`
  - `verlassenSchritt(n: number, frageSeit: number | null, jetzt: number): 'verlassen' | 'fragen' | 'warten'` (n = 0 → `verlassen`;
    ohne Frage → `fragen`; `jetzt - frageSeit < VERLASSEN_SPERRE_MS` → `warten`; sonst `verlassen`).
  - `verlassenGesperrt(frageSeit: number | null, jetzt: number): boolean`.
  - `verlassenBedienung(b: { n: number; frageSeit: number | null; setzeFrageSeit: (t: number | null) => void; jetzt: () => number; verlasse: () => void }): () => void`
    (hooklose Verdrahtung, Muster `slotWahl`).
- `ZoomCard`: `useState<number | null>(null)` (`frageSeit`) statt des Booleans; `frage = frageSeit !== null && n > 0`; ein `setTimeout`
  auf das Ende der Sperre zeichnet neu; während der Sperre `aria-disabled="true"`, gleiche Abschwächung wie gesperrt, Klick verworfen
  (D9). Element, Platz, Text und Variante bleiben; drei `flex flex-row-reverse` bleiben. Kein neuer Text, kein IPC.

- [ ] **Step 1: Failing tests `verlassen.test.ts`:**
  - `CN-MV Doppelklick verlässt nie` (rein): `verlassenSchritt(2, null, 0) === 'fragen'`; `(2, 0, 120)` und `(2, 0, 999)` → `warten`;
    `(2, 0, 1000) === 'verlassen'`; `(0, null, 0) === 'verlassen'`.
  - `CN-MV Verdrahtung`: Klick bei t = 0 setzt die Frage; Klick bei t = 120 ruft `verlasse` nicht; Klick bei t = 1000 ruft es genau 1×.
  - **Review Focus 5** `CN-MV keine Slots mehr während der Sperre: Klick verlässt`: Frage bei t = 0 mit n = 2, dann n = 0, Klick bei
    t = 120 → `verlasse` 1×; `verlassenSchritt(0, 0, 120) === 'verlassen'`.
  - Render-Gegenprobe: `ZoomCard` mit `zoomAbbild({ kurz: { zustand: 'im_meeting', slotsLaufen: 2 } })` zeigt „Meeting verlassen“.
  - Wächter: der `verlassen`-Handler in `ZoomCard.tsx` ruft `verlassenSchritt`; `zaehle(zc, 'flex flex-row-reverse') === 3`.
- [ ] **Step 2:** Rot nachweisen (Modul fehlt; `pruefe` zählt das Werfen als FAIL).
- [ ] **Step 3: Implementieren.** Funktionsliste: `verlassen.ts` und `verlassen.test.ts` in `GEAENDERT`; im GIT-Wächter `:466-480`
  den Block „Verlassen“ aus der Zeichengleichheit nehmen (Kommentar „Altfehler CN-MV“), die übrigen Blöcke bleiben; Nr. 75 und 122:
  „erst nach 1 s Sperrzeit (Altfehler CN-MV)“, Zeilenangaben nachziehen.
- [ ] **Step 4:** Selbsttest und Typprüfung grün, auch mit `JM_FUNKTIONSLISTE_GIT=1`. Mutationsprobe: Sperrzeit auf 0 → Doppelklick-Test
  rot.
- [ ] **Step 5: Echt-Fenster-Messung CN-MV** (Pflicht, Spec 7; Blocker 8737, kein Cloud-Raum, keine Zoom-Anmeldung, kein NDI-Sender):
  - Bau `npm run build -w @jm/connect`, Start mit Electron der Hauptkopie (`ELECTRON_OVERRIDE_DIST_PATH=C:/Users/alexk/alexzvn/node_modules/electron/dist`),
    `--remote-debugging-port` und `--inspect=<port>`. Fehlt `packages/ndi/build`, Verzweigung nach den Mess-Regeln oder vorher messen,
    dass die App ohne NDI startet.
  - Zustand nur im Renderer: per CDP `zoomAbbild` der Wurzel-View (`R/views/ConnectOberflaeche.tsx:114`) auf ein Abbild im Meeting mit
    `slotsLaufen: 2` setzen (Vorlage `test/ui/testzustand.ts:90-118`); Stand vor und nach der Messung festhalten (`onZoom` `:425` kann
    überschreiben).
  - Zählen im Hauptprozess: per Inspector `ipcMain.removeHandler('jmc:zoom-verlassen')` und ein Zähler als Handler; der echte Kern wird
    nie gerufen.
  - Eingaben per `Input.dispatchMouseEvent` auf den Mittelpunkt: Doppelklick (`clickCount` 1, nach 80–120 ms `clickCount` 2) → Zähler 0,
    die Taste zeigt „Ja, verlassen (2 Slots laufen)“; zweiter Klick nach 600 ms → 0; nach ≥ 1100 ms ein Klick → 1. Tastatur: Fokus,
    Enter, nach 100 ms Enter → 0; nach 1100 ms Enter → 1 (Fokus blieb, P6). n = 0: ein Klick → 1 sofort.
  - Größen 1280×860 und 980×640: Rechteck der Taste vor und nach dem ersten Klick gleich.
  - Ergebnis `out/t9-messung.json`.
- [ ] **Step 6: Commit** `fix(connect): „Ja, verlassen“ erst nach einer Sekunde, Doppelklick verlässt nie (CN-MV)`.

### Task 10: Versionen, Changelog-Entwurf und Texttabelle

**Files:**
- Modify: `apps/player/package.json` (0.10.1), `apps/interpreter/package.json` (0.3.1), `apps/stage-display/package.json` (0.8.0),
  `apps/caption/package.json` (0.7.0), `apps/recorder/package.json` (0.11.0), `apps/presenter/package.json` (0.15.1),
  `apps/connect/package.json` (0.6.1), `package-lock.json` (`npm install --ignore-scripts --package-lock-only`)
- Modify: `packages/suite-manifest/changelog.json`: je App ein neuer Eintrag oben, `"date": "2026-11-26"` als Platzhalter
- Create: `docs/ux/altfehler-stufe2-texte.md`, `.superpowers/sdd/2026-11-26-altfehler-stufe2/pruefe-texte.mjs` (ungetrackt)

**Interfaces:** Consumes alle Texte aus Task 1–9.

- [ ] **Step 1: Texttabelle** im Aufbau von `docs/ux/altfehler-stufe1-texte.md` (Zweck, Stand, Lesehilfe mit ‹…›, Aufbau):
  - Je App eine Tabelle mit Nr., Ort (Datei:Zeile), Text, Befund: `## Interpreter` (`INA…`), `## Stage Display` (`SDA…`, mit „nicht
    erreichbar“ in `packages/settings/src/abschnitte/peers.ts`), `## Caption` (`CAA…`, die Feldtexte aus `@jm/ui` mit Ort
    `packages/ui/src/lib/texte.ts:29-33`), `## Recorder` (`REA…`, dazu die Zeile „entfällt“ für den alten Netzwerk-Hinweis),
    `## Companion-Modul` (`MOD…`: „Modus“, „Umschalten“, „An“, „Aus“). Player, Presenter und Connect: ein Satz „keine neuen
    sichtbaren Texte“.
  - `## Log-Zeilen` (`LOG…`), `## Changelog` (Entwürfe unten), `## Geänderte Bedienung` (je Befund ein Satz), `## Entscheidungen`
    (B1–B7, C1–C10, P1–P9, D1–D11 in Kurzform), `## Offene Fragen` (nur Infos: P9 Switcher; C2 kein DMG, Caption nur Windows).
  - Letzte Zeile genau: `Freigabe: ☐ alle Texte wie hier ☐ mit Änderungen (bitte je Nr. notieren)`.
  - Changelog-Entwürfe (wörtlich so in `changelog.json`):
    - CL-PL1 (Player 0.10.1) `Ein Cue, der während seiner Vorlaufzeit gelöscht wird, startet nicht mehr, auch nicht in oder nach der Pause. Das gilt auch für einen Video-Cue, der noch auf das Ausgabefenster wartet.`
    - CL-PL2 `GO in der Pause auf einen Cue ohne Vorlaufzeit hebt die Pause jetzt ganz auf, wie „▶ Weiter“: Angehaltene Töne und ein angehaltenes Video in der Ausgabe laufen weiter. „▶ Weiter“ startet ein Video, das schon zu Ende gelaufen ist, nicht mehr neu.`
    - CL-IN1 (Interpreter 0.3.1) `„Starten“ ist gesperrt, solange der Start läuft („Startet …“); ein zweiter Klick verwirft den ersten Start nicht mehr. Antworten die Geräte 15 Sekunden lang nicht, bricht der Start mit einer Meldung ab, und die Taste ist wieder frei.`
    - CL-IN2 `„Ducking-Werte zurücksetzen“ lässt die beiden Vorverstärkungen stehen.`
    - CL-SD1 (Stage Display 0.8.0) `Die Presenter-PIN steht verdeckt im Feld („Anzeigen“ zeigt sie) und gilt erst mit „Setzen“. In stage-config.json und in der Anfrage an den Presenter steht sie weiter im Klartext, weil das Protokoll des Presenters es so verlangt.`
    - CL-SD2 `Die Nachricht ist ein Entwurf: Sie geht erst mit „Senden“ oder Enter auf die Bühne; „Senden“ mit leerem Feld nimmt sie wieder herunter. Nach einem Neustart steht keine Nachricht auf der Bühne, der letzte Text bleibt als Entwurf im Feld.`
    - CL-SD3 `Die automatische Suche (mDNS) übernimmt einen gefundenen Rechner nur noch, solange eine Quelle auf 127.0.0.1 steht. Ein eingetragener oder früher gefundener Host bleibt stehen; ist er nicht erreichbar, steht in der Statusleiste „nicht erreichbar“.`
    - CL-CA1 (Caption 0.7.0) `Ein Mikrofonfehler beendet jetzt die Transkription: Die Haupttaste steht wieder auf „Start“, Companion meldet running=0, und Caption startet nicht mehr von selbst neu. Der Fehler bleibt im Fenster stehen, bis wieder gestartet wird.`
    - CL-CA2 `„Leeren“ leert jetzt auch die NDI-Quelle, wenn Hold an ist; Hold bleibt an und hält das leere Bild. Eine Korrektur im Verlauf trifft die angeklickte Zeile, auch wenn inzwischen neue Zeilen kamen; Escape bricht die Korrektur ab.`
    - CL-CA3 `„Schrift“ und „Max. Äußerung (s)“ gelten erst nach Enter oder beim Verlassen des Feldes. Ein leeres Feld oder eine Zahl außerhalb von 16 bis 160 bzw. 2 bis 15 wird nicht übernommen, unter dem Feld steht der Grund.`
    - CL-CA4 `Mac: Schließt man das Fenster, endet die Transkription und Hold geht aus, auch für Companion; ein Klick aufs Dock öffnet das Fenster wieder. Companion „Transkription“ auf „Start“ wird bei geschlossenem Fenster abgelehnt. Nicht auf dem Mac gemessen.`
    - CL-RE1 (Recorder 0.11.0) `Companion: ARM und DISARM beenden keine laufende Aufnahme mehr, sie werden abgelehnt; beenden geht nur mit Stopp. RECORD ON ohne Zielordner wird abgelehnt, statt am Rechner einen Ordnerdialog zu öffnen. Den Grund zeigt das Fenster. Im Fenster ist „Eingang schließen“ während der Aufnahme gesperrt.`
    - CL-RE2 `Zielordner aus einer Show: Ein Netzwerkordner gilt erst, wenn ihn jemand im Fenster mit „Übernehmen“ bestätigt; danach ist er gemerkt und geht ohne Klick. Ungültige Pfade übernimmt der Recorder nicht. Das Prüfen eines Netzwerkordners hält weder den Start des Recorders noch den Wechsel zum nächsten Preset auf.`
    - CL-RE3 `Schreibfehler, etwa ein voller Datenträger oder ein Netzwerkordner, der wegfällt, und ein Eingang, der 2 Sekunden lang nichts liefert, beenden die Aufnahme jetzt sauber. Der Grund bleibt in Statusleiste und Haupttaste stehen, bis neu aufgenommen oder der Eingang geschlossen wird; „REC“ leuchtet dann nicht mehr, und Companion sieht, dass nicht aufgenommen wird. Nicht am echten Datenträger gemessen.`
    - CL-RE4 `Wer das Fenster während einer Aufnahme schließt, wird jetzt gefragt; ohne Aufnahme schließt es wie bisher. Beim Abmelden oder Herunterfahren von Windows wird die Aufnahme ohne Frage sauber abgeschlossen.`
    - CL-RE5 `Neu in der Statusleiste: „Platz“ zeigt, wie lange der freie Speicher im Zielordner für das eingestellte Format reicht, vor und während der Aufnahme; gelb unter 15 Minuten, rot unter 5 Minuten. Gesperrt wird nichts. Am NAS nicht gemessen.`
    - CL-PS1 (Presenter 0.15.1) `Handy-Fernsteuerung: „Verbinden“ mit der PIN hebt ein Schwarz- oder Weißbild nicht mehr auf. Es bleibt stehen, bis jemand „Folie“ drückt oder weiterblättert.`
    - CL-PS2 `Companion: Die Aktionen „Schwarz“ und „Weiß“ haben eine Wahl „Umschalten“, „An“ oder „Aus“ (Companion-Modul 0.4.0, Datei jm-suite-companion-0.4.0.tgz am Release presenter-v0.15.1 auf GitHub; der Launcher lädt es nicht mit, in Companion über „Import custom module“ importieren). Vorgabe ist „Umschalten“, bestehende Tasten wirken wie bisher. Wer sicher schwarz will, stellt die Taste auf „An“. Ältere Presenter schalten bei jeder Wahl um.`
    - CL-CN1 (Connect 0.6.1) `„Meeting verlassen“ bei laufenden Slots: „Ja, verlassen“ nimmt erst nach einer Sekunde einen Klick an. Ein Doppelklick auf „Meeting verlassen“ verlässt das Meeting also nicht mehr.`
- [ ] **Step 2: Prüfskript** nach `vorlagen-stufe1/pruefe-texte.mjs`: Zeilen `^\| (INA|SDA|CAA|REA|MOD|LOG|CL-(PL|IN|SD|CA|RE|PS|CN))\d+ \|`;
  App und Version je Präfix (`CL-PL` player 0.10.1, `CL-IN` interpreter 0.3.1, `CL-SD` stage-display 0.8.0, `CL-CA` caption 0.7.0,
  `CL-RE` recorder 0.11.0, `CL-PS` presenter 0.15.1, `CL-CN` connect 0.6.1); jeder Tabellentext steht wörtlich (‹…› beliebig, ±2
  Zeilen) in der genannten Datei; jede Notiz wörtlich im neuen Eintrag; kein ASCII-`"`. Gegenprobe: ein absichtlich falscher Text meldet
  einen Fehler.
- [ ] **Step 3: Prüfen:** `node -e "JSON.parse(require('fs').readFileSync('packages/suite-manifest/changelog.json','utf8'))"`; Prüfskript
  `ok`; Selbsttests und Typprüfungen der sieben Apps; Link-Prüfung Exit 0; `git status --short` lesen.
- [ ] **Step 4: Commit** `chore(altfehler): Versionen, Changelog-Entwurf und Texttabelle Stufe 2 (Texte zur Owner-Freigabe)`.

### Task 11: Handbücher, Abnahme-Datei, Bestandsaufnahme, Entscheidungen, Roadmap

**Files:**
- Modify (Kochbuch, LF): `packages/cookbook/content/tool-manuals/tool-jm-player.md` (Z. 47, 56), `…/tool-jm-stage-display.md`
  (Z. 38, 43, 50, 60, 67, 77, 78, 87), `…/tool-jm-caption.md` (Z. 42, 47–49, 53, ab 61), `…/tool-jm-recorder.md` (Z. 28, 35-38, 58-63,
  65-74, neu: Schließen), `…/tool-jm-presenter.md` (Z. 43, 66, 73), `…/tool-jm-connect.md` (Z. 150). Interpreter: kein Handbuch (C7).
- Regenerate: `packages/cookbook/cookbook.json` (`npm run cookbook:build`, dann `npm run cookbook:check`, ohne `\r`)
- Create: `docs/ux/ABNAHME-Altfehler-Stufe2.md`
- Modify: `docs/ux/altfehler-entscheidungen.md` (neuer Abschnitt Stufe 2), `docs/ux/altfehler-inventar.md`, `docs/roadmap.md`
  (Block 5, `:662 ff.`), `docs/ux/altfehler-stufe2-texte.md` (Abschnitt `## Handbuch` mit `-`/`+` je Stelle)

- [ ] **Step 1: Handbücher** nachführen, in den Worten der Crew. Pflichtsätze: Recorder Z. 28 „32-bit Float, rund 11,5 MB je Kanal und
  Minute bei 48 kHz, doppelt mit „Spuren einzeln““ (B5); Presenter Esc-Satz nach P5; Presenter Z. 43 und 73 mit `ON`/`OFF`/`TOGGLE` und
  „für sicher schwarz die Taste auf „An“ stellen“; Connect Z. 150 „(bei laufenden Slots fragt der Knopf einmal nach; „Ja, verlassen“
  wirkt erst nach einer Sekunde, ein Doppelklick verlässt nicht)“; Recorder: Abmelden/Herunterfahren schließt ohne Frage ab (B3).
  Bauen und prüfen.
- [ ] **Step 2: Abnahme-Datei** im Aufbau von `docs/ux/ABNAHME-Altfehler-Stufe1.md` (Kopf mit Spec, Plan, Texttabelle, Entscheidungen;
  Nummern AL Player, AI Interpreter, AD Stage Display, AC Caption, AR Recorder, AP Presenter, AN Connect, RF Review Focus):
  - Voraussetzungen je App mit **Wegwerf-Profil-Rezept** (R21): eigener Ordner `C:\Temp\<app>-abnahme\home` mit `AppData\Roaming` und
    `AppData\Local`, in **einer** PowerShell `$env:USERPROFILE`, `$env:APPDATA`, `$env:LOCALAPPDATA` umlenken, EXE mit
    `--user-data-dir=C:\Temp\<app>-abnahme\profil` starten, Beweis vor der Prüfung (leere Bibliothek, leere Presets, leere Show-Liste o. ä.),
    danach Ordner löschen und die installierte App prüfen. Installierte App vorher ganz beenden (Ports: Player 8725, Recorder 8729,
    Caption 8732, Presenter 8728, Connect 8737).
  - Je Befund eine Prüfung mit Erwartung, dazu RF1–RF5. Pflichtschritte: Recorder USB-Stick während der Aufnahme abziehen (B2); Recorder
    Fenster schließen in der Aufnahme, „Weiter aufnehmen“ und „Aufnahme beenden“; Recorder Show-Link mit NAS-Ordner während der Aufnahme
    (RF1); Recorder Platz-Anzeige vor und während der Aufnahme; Presenter mit echtem Companion und Modul 0.4.0: alte Taste „Schwarz“
    ohne Wahl, dann neue Taste „An“ zweimal, dann „Aus“ (P2); Presenter Handy mit PIN bei Schwarzbild „Verbinden“; Connect im echten
    Meeting mit zwei Slots Doppelklick auf „Meeting verlassen“; Caption „Leeren“ bei Hold mit echtem Mikrofon und NDI-Empfänger
    (CA-4), Korrektur einer älteren Zeile (CA-5); Player Cue im Vorlauf löschen, GO in der Pause mit Video.
  - „Aus dem Code abgeleitet“ für CA-11 (Mac) und RE-3 am echten Datenträger.
- [ ] **Step 3: Entscheidungen** nach `docs/ux/altfehler-entscheidungen.md`, neuer Abschnitt „Stufe 2“ mit Tabelle B1–B7, C1–C10, P1–P9,
  D1–D11 und allen `Ruling:`-Zeilen aus dem Ledger (Spalten wie Abschnitt 1: Befund, Entschieden, Grund, Kostet, wenn falsch).
- [ ] **Step 4: Bestandsaufnahme:** Abschnitt „Stufe 2: behoben auf `feat/altfehler-stufe2` (Abnahme offen)“ wie Abschnitt 0, Vermerk
  „✅ behoben auf `feat/altfehler-stufe2`, Task N“ an jeder Stufe-2-ID in Abschnitt 2; PS-10 als „vom Owner bestätigt, kein Altfehler“
  mit der Berichtigung „Handy-Fenster gibt es seit 2b nicht mehr“ (P5); PL-K1 und PL-K2 in Abschnitt 7 als behoben. Neue Kandidaten in
  Abschnitt 7: CA-K1 (Mikrofon fällt im Lauf aus, C3), CN-K1 („Ja, verlassen“ verfällt nie, P6), RE-K1 (Show-Datei wird synchron
  gelesen, `main/index.ts:30`, B4) und die vier Punkte der 0.9.2-Liste (englischer Präfix der Fehlermeldungen, ungenutztes Feld
  `netzwerk`, Export-Grenze erst nach dem Dialog, Aufnahmezeit je Block aus dem Addon; Spec 8).
- [ ] **Step 5: Roadmap** Block 5: „Altfehler Stufe 2 gebaut auf `feat/altfehler-stufe2`, Abnahme offen“; Recorder-Plattenplatz und die
  0.9.2-Liste mit dem Stand (NAS-Prüfung und Platz gebaut, vier Punkte im Inventar).
- [ ] **Step 6: Prüfen:** `npm run cookbook:check`; Prüfskript aus Task 10, zusätzlich „jede `+ `-Zeile des Abschnitts Handbuch steht im
  Handbuch“ → `ok`; Link-Prüfung Exit 0; `git status --short`.
- [ ] **Step 7: Commit** `docs(altfehler): Handbücher, Abnahme, Bestandsaufnahme und Entscheidungen Stufe 2`.

---

## Nach der Umsetzung (Controller, nicht in den Tasks)

1. **Gesamtprüfung** des Branches auf dem stärksten Modell, eine Fix-Welle, Nachprüfung; Entscheidungen daraus nach
   `docs/ux/altfehler-entscheidungen.md`.
2. **Testbauten** (`win-unpacked`) erst danach (R14), je App mit `-c.npmRebuild=false` (Lehre „electron-builder räumt devDeps weg“),
   native Bausteine nur lesend aus der Hauptkopie (Recorder: welcher der zwei `jm_audio.node` der Hauptkopie, legt der Controller fest;
   `PORTAUDIO_DLL` auf die DLL der Hauptkopie). Rauchtest im Wegwerf-Profil.
3. **Owner:**
   - Texttabelle freigeben, dann Abnahme nach `docs/ux/ABNAHME-Altfehler-Stufe2.md`.
   - Erst danach Push, PR, Release je App und Merge, jeder Schritt mit frischem Owner-OK. Wege (Spec 3): Player, Stage Display,
     Interpreter über die CI; Presenter Windows lokal mit NDI, Mac-DMG aus der CI; Caption, Recorder, Connect lokal. `main` vor den Tags,
     Tags einzeln; nach jedem CI-Tag `latestVersion` nachlesen. Lokal gebaute Apps: `node scripts/bump-manifest.mjs <app> <version>`.
   - `jm-suite-companion-0.4.0.tgz` aus `out/` am Release `presenter-v0.15.1`, mit eigenem Owner-OK (P2).
4. **Aufräumen:** Ledger als tar.gz ins `sdd-archiv`, Worktree erst nach Merge abbauen (Links zuerst, nie `--force`).

## Selbstprüfung

- **Spec-Abdeckung:**
  - CA-1, CA-4, CA-5 → Task 4; CA-8, CA-11 → Task 5;
  - IN-3, IN-8 → Task 2;
  - SD-5, SD-1, SD-3 → Task 3;
  - RE-7b, RE-2, RE-2b, RE-NAS → Task 6; RE-3, RE-7a, RE-PLATZ → Task 7;
  - PS-15, PS-18 (mit Modul 0.4.0) → Task 8; PS-10 → Task 11 (Handbuch, Inventar);
  - CN-MV → Task 9; PL-K1, PL-K2 → Task 1;
  - „Abgelehnte Fernbefehle“ → Task 6 (`recorder:ablehnung`, Fenster und Log) und Task 5 (`state.error` und Log); Protokoll und Modul
    unverändert bis auf PS-18;
  - Texttabelle und Changelog → Task 10; Handbücher, Abnahme, Inventar, Roadmap → Task 11;
  - Messpflicht Spec 7 (RE-7a, CN-MV) → Task 7 Step 8 und Task 9 Step 5; zusätzlich gemessen (D11) PL-K2, IN-3, SD-1, CA-1, CA-8;
  - Anti-Ziele: keine Taste ändert sich ohne Entscheid (Schwarz/Weiß Vorgabe „Umschalten“, Esc bleibt); Companion-Tasten brechen nicht
    (Rückfall in Modul und Presenter); neue Rückfrage nur beim Schließen während der Aufnahme; kein Fernbefehl öffnet ein Fenster
    (RE-2b, CA-11).
- **Typen:** `Vorlaeufe.abbrechen`, `START_FRIST_MS`/`START_FRIST_TEXT`, `DUCKING_VORGABEN`, `PinFeld`/`PinFeldAnsicht`, `konfigAusDatei`,
  `konfigMischen`, `mdnsUebernahme`, `VORGABE_HOST`, `PeerRow.eingerichtet`, `mikrofonGescheitert`, `angezeigterText`, `korrigiereZeile`,
  `correctLine`, `pruefeKonfig`, `CAPTION_GRENZEN`, `transcribeAblehnung`, `pruefeFernbefehl`, `schliesseEingang`, `pruefeShowOrdner`,
  `normiereOrdner`, `NetzordnerListe`, `netzordnerListe`, `netzordnerUebernehmen`, `dirGemerkt`, `RecorderFehler`, `bloeckeLage`,
  `setProtokoll`, `AUFNAHME_FEHLER_TEXTE`, `SCHLIESSEN_TEXTE`, `SchliessenAblauf` (Klasse in `shared/schliessen.ts`), `SchliessenFrage`
  (Ansicht in `views/SchliessenFrage.tsx`), `schliessenEntscheid`, `elternOrdner`, `freierPlatz`, `PlatzAbfrage`, `platzEintrag`, `schirmBefehl`,
  `SCHIRM_WAHL`, `aktionenFuer`, `verlassenSchritt`, `verlassenBedienung` tragen in jedem Task dieselben Namen.
- **Abweichungen vom vorgegebenen Schnitt:** keine im Schnitt. Zusätzlich: Task 3 fasst drei fremde Funktionslisten-Tests an (D10), Task 1,
  2, 3, 4 und 5 messen zusätzlich (D11).
