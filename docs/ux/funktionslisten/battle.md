# Funktionsliste JM Battle (Suite-UX-Update, Welle 1 · Battle)

Zweck (Spec `docs/superpowers/specs/2026-10-08-suite-ux-update-design.md`, Abschnitt 10 „Kein Funktionsverlust“, und
Anhang A „Battle“): jedes Bedienelement mit Handler, jedes Tastaturkürzel, jeder Dialog und jede Einstellung von Battle,
erhoben **vor dem Umbau** aus dem Code. Nach dem Umbau bekommt jede Zeile in der Spalte „künftig wo“ einen Haken mit dem Ort
im neuen Aufbau; ein Punkt ohne Haken blockiert die Welle.

- **Stand:** erhoben aus dem Code am 2026-11-22, Commit `210e1d9dcb` (`apps/battle` ist seither unverändert, 0 Commits auf
  diesem Zweig). Battle in der Version dieses Stands, 0.4.0 (`apps/battle/package.json` bei `210e1d9dcb`; die Version wird
  erst am Ende der Welle gesetzt). Die Abschnitte 8 bis 10 (IPC-Übersicht, Zuordnung, Befunde) beschreiben den Stand bei
  `210e1d9dcb`, vor dem Umbau, und werden nicht umgeschrieben. Nichts ausgeführt, kein Fenster geöffnet. Was nur aus dem Code
  abgeleitet ist, steht als „abgeleitet“, Unklares als „unklar“ bzw. „nicht gemessen“.
- **Gelesen, vollständig:** `apps/battle/src/renderer/**` (`renderer/index.html`, `main.tsx`, `App.tsx`, `globals.css` (nur
  Kopf, Zeilen 1-20), `jmbattle.d.ts`, `components/Competitors.tsx`, `components/Scoreboard.tsx`, `components/RemotePanel.tsx`,
  `components/ClipPanel.tsx`, `components/Settings.tsx`, `components/ConnectionsPanel.tsx`, `store/useBattle.ts`,
  `lib/capabilities.ts`, `lib/qr.ts`), `preload/index.ts`, `shared/types.ts`, `shared/scoring.ts`, `main/index.ts`
  (vollständig), `main/config.ts`, `main/coupling.ts`, `main/control-server.ts`, `main/clip.ts`, `main/remote-page.ts`, in
  `packages/suite-control-protocol/src/capabilities.ts` der Block `battle` (Zeilen 458-504), `ui/Modal.tsx` (vollständig,
  Tastenregel), `.github/workflows/ci-checks.yml` (Job „Selbsttests“, Kopf und Schrittnamen). Ausschnitte: `ui/SettingsPanel.tsx`
  (Zeilen 44-66, Tastenregel), `packages/app-runtime/src/index.ts` (Master-Link-Start, Zeilen 95-120 und 386-425),
  `test/selftest.ts` (nur Kopf, Zeilen 1-30). Nicht gelesen: `packages/remote/**` (`RemoteServer`, Endpunkte `/state`,
  `/events`, `/cmd`), `packages/discovery/**`, `packages/control-config/**`, `packages/show/**`, `packages/media/**`,
  `packages/suite-control-protocol/src/server.ts` und `packages/suite-control-protocol/src/client.ts`, der Rest von `test/selftest.ts`, `apps/battle/electron.vite.config.ts`,
  `apps/battle/electron-builder.yml`.
- **künftig wo** bleibt leer. Die Spalte wird nach dem Umbau gefüllt und abgehakt (Aufgabe e): jede Zeile der Abschnitte 1
  bis 7 trägt genau einen Haken.
- **Pfade:** ohne Präfix relativ zu `apps/battle/src/renderer/src/`; `main/…`, `preload/…`, `shared/…` und `renderer/…`
  relativ zu `apps/battle/src/`; `test/…` und `resources/…` relativ zu `apps/battle/`; `ui/…` = `packages/ui/src/components/…`; `packages/…`,
  `docs/…` und `.github/…` relativ zur Repo-Wurzel. Zeilennummern gelten für `210e1d9dcb` (die gelesenen Dateien unter
  `packages/` sind seit dann unverändert, geprüft per `git diff`). Dateien, die es nur zur Laufzeit gibt (unter `userData`
  oder `appData`: `battle.config.json`, `control.json`), stehen mit ihrem Laufzeitnamen, nicht als Repo-Pfad; sie sind von der
  Pfadprüfung ausgenommen.
- **Zustands-Kürzel** (Spalte „Zustand (sichtbar/aktiv)“): **imm.** = immer sichtbar, sobald `state` geladen ist (davor zeigt
  die Seite nur „Lädt …“) · **live** = VS on air (`state.live`) · **V** = Voting-Server läuft (`state.remote.running`) ·
  **Vo** = Voting der Runde offen (`state.votingOpen`) · **E** = alle Runden von der Jury entschieden (`decided`) · **Q** =
  Aufnahme-Quelle gesetzt (`config.recordingPath`) · **mod** = nur bei geöffnetem Dialog · **bed.** = nur während der Eingabe ·
  **Main** = Hauptprozess, ohne Oberfläche.
- **Nummerierung:** fortlaufend in den Abschnitten 1–7; die Zahlen stehen in der folgenden Zeile (vom Skript erzeugt, gleich der Zahl der Tabellenzeilen).
  Zeilen: 1 = 36, 2 = 18, 3 = 22, 4 = 0, 5 = 4, 6 = 6, 7 = 6; zusammen 92.
  Die Abschnitte 8 (IPC-Übersicht), 9 (Zuordnung zu Spec 6 / Anhang A) und 10 (Befunde) haben
  keine nummerierten Punkte und werden nicht abgehakt.

---

## 1 · Hauptfenster (ein Fenster, eine Seite)

| Nr. | Bereich | Element | Handler/IPC | Zustand (sichtbar/aktiv) | heute wo | künftig wo |
|---|---|---|---|---|---|---|
| 1 | Fenster | Aufbau: eine Seite ohne AppShell, ohne Reiter, ohne Statusleiste; Spalte aus Kopf und Mitte; die Mitte hat links die Live-Spalte (`flex-1`: Ecken, Scoreboard, Ergebnis-Karte), rechts eine feste Spalte `w-80` (Publikums-Voting, Instant-Replay, Titler-Karte); darüber bedingt zwei Modals (Nr. 37, Nr. 44). `main.tsx` rendert `App` unter `StrictMode`, ohne Provider und ohne Theme-Hook | `useBattle` (zustand-Store) | imm. | `App.tsx:32-93`, `main.tsx:9-13` |  |
| 2 | Fenster | Fensterhülle: 1200 mal 820, mindestens 980 mal 660, Titel „JM Battle“, Hintergrund `#0e0e10`, erst sichtbar bei `ready-to-show`, `autoHideMenuBar`, auf dem Mac `titleBarStyle: hiddenInset` (sonst `default`), `sandbox`, `contextIsolation`, kein `nodeIntegration`; Symbol `resources/icon.png` (gepackt: `process.resourcesPath`); ein zweiter Start holt das vorhandene Fenster nach vorn (Nr. 72) | `createMainWindow` | Main | `main/index.ts:389-426`, `main/index.ts:98-101` |  |
| 3 | Fenster | Ladeanzeige „Lädt …“ mittig, solange `state` noch `null` ist; `load` im Effekt: `getState` plus einmaliges Abonnement von `onState` und `onLinks` (Merker `subscribed` auf Modulebene, übersteht das zweite Mounten unter `StrictMode`); `onLinks` ersetzt nur `state.links` | `useBattle().load` → IPC `battle:getState`, Ereignisse `battle:state`, `battle:links` | vor dem ersten Zustand | `App.tsx:19-25`, `store/useBattle.ts:25-36` |  |
| 4 | Kopf | Text „JM Battle“ (fett, ohne Logo) | – | imm. | `App.tsx:35` |  |
| 5 | Kopf | Anzeige „Runde x/y“ (klein, gedämpft): x = `state.round`, y = Zahl der Runden | `state.round`, `state.rounds.length` | imm. | `App.tsx:36-38` |  |
| 6 | Kopf | **Haupttaste VS** (Kopf rechts): schaltet die VS-Bauchbinde des Titlers; Text „○ VS einblenden“ (aus) bzw. „● VS on air“ (rot umrandet); Tooltip „VS-Bauchbinde (Titler) on air“; nie gesperrt, auch ohne Titler-Verbindung (Befund 7); Rückmeldung nur über den Zustand der Taste. Wirkung im Main: bei an Vorlage `lowerthird`, Text „A_vs_B“ und „Runde_N“, `take`, bei aus `clear`, jeweils nur bei `autoTitler` (Nr. 67). Companion-Verb `vs` mit `toggleKey` `live` (Nr. 59) | `setLive(!state.live)` → IPC `battle:setLive` → `doSetLive` | imm. | `App.tsx:40-48`, `main/index.ts:219-224`, `main/index.ts:332-335` |  |
| 7 | Kopf | Knopf „Verbindungen“ öffnet das Modal „Tool-Verbindungen“ (Nr. 44) | `setShowConnections(true)` | imm. | `App.tsx:49` |  |
| 8 | Kopf | Knopf „Einstellungen“ öffnet das Modal „Einstellungen“ (Nr. 37) | `setShowSettings(true)` | imm. | `App.tsx:50` |  |
| 9 | Kopf | Nicht vorhanden: Logo, Theme-Knopf, Ziehfläche (`dragRegion`), Einzug für die Mac-Fensterknöpfe, Hilfe, Statusleiste. Die Seite startet fest dunkel (`class="dark"` in `renderer/index.html:2`), `useTheme` aus `@jm/ui` ist ungenutzt; auf dem Mac liegen die Fensterknöpfe damit abgeleitet über dem Text „JM Battle“ (nicht gemessen) | – | imm. | `App.tsx:34-52`, `renderer/index.html:2`, `main/index.ts:400-404` |  |
| 10 | Live | Ecken-Karte A und B (zwei Karten links und rechts neben „VS“): Kopfzeile „Ecke A“ bzw. „Ecke B“ und rechts „N Stimmen“ (Summe der Publikumsstimmen aller Runden dieser Seite), Name und Crew als Felder (Nr. 11, Nr. 12), darunter groß die Zahl der Jury-Rundensiege dieser Seite mit „Rundensiege“; oberer Rand in der Ecken-Farbe (A blau `#3da5ff`, B rot `#ff5c5c`); **Live-Element** (gehört mit dem Scoreboard zum Live-Bereich) | `voteTotals`, `juryWins` aus `shared/scoring.ts`; `state.competitors` | imm. | `components/Competitors.tsx:14-41`, `components/Competitors.tsx:43-57`, `shared/scoring.ts:38-57` |  |
| 11 | Live | Namensfeld je Ecke (zwei Felder, A und B): Künstlername, groß und mittig, ohne Rahmen; **schreibt bei jedem Tastendruck** (`onChange`, kein Abschluss mit Enter oder Verlassen): je Taste ein IPC-Aufruf, ein Schreiben von `battle.config.json` und ein Zustands-Push; bei VS on air löst jede Taste außerdem dreimal Titler-Zeilen aus (Nr. 68, Befund 3); keine Rechtschreibprüfung | `setCompetitor(side, { name })` → IPC `battle:setCompetitor` | imm. | `components/Competitors.tsx:22-27`, `main/index.ts:292-298`, `main/config.ts:80-84` |  |
| 12 | Live | Crew-Feld je Ecke (zwei Felder, A und B): „Crew / Stadt“ (Platzhalter), klein und mittig; schreibt ebenfalls bei jedem Tastendruck, Wirkung wie Nr. 11; die Crew geht nicht in die Bauchbinde (Nr. 67), nur auf die Voting-Seite (Nr. 78) | `setCompetitor(side, { crew })` → IPC `battle:setCompetitor` | imm. | `components/Competitors.tsx:28-34`, `main/index.ts:292-298` |  |
| 13 | Live | Knopf **⇄** zwischen den Karten, Tooltip „Ecken tauschen“, Beschriftung „VS“ darüber: tauscht die beiden Ecken (Name und Crew wechseln die Seite); Rundenergebnisse und Stimmen bleiben stehen; schreibt `battle.config.json`; bei VS on air werden die Titler-Zeilen neu gesendet; ohne Rückfrage | `swapCompetitors()` → IPC `battle:swapCompetitors` | imm. | `components/Competitors.tsx:46-55`, `main/index.ts:299-305` |  |
| 14 | Live | **Rundenknopf ◀** im Scoreboard: eine Runde zurück (bei Runde 1 bleibt es bei 1, `clampRound`); Rundenwechsel schließt das Voting; bei VS on air wird die Bauchbinde mit der neuen Runde neu gesendet. Companion-Verb `prev` (Nr. 56) | `prevRound()` → IPC `battle:prevRound` → `doGotoRound(round - 1)` | imm. | `components/Scoreboard.tsx:37`, `main/index.ts:202-207`, `main/index.ts:311-314` |  |
| 15 | Live | **Rundendirektsprung:** je Runde ein Knopf mit der Rundennummer (1 bis N, Quadrat, umbrechend); Klick springt sofort in diese Runde, ohne Rückfrage, auch über mehrere Runden; die aktuelle Runde hat gelben Rahmen (`--brand-yellow`); der Hintergrund trägt die Farbe des Jury-Entscheids (A blau, B rot, Unentschieden grau, offen leer); Tooltip „Runde n“ bzw. „Runde n: A“ (Wert der Seite, nicht der Name); schließt das Voting, bei live neue Bauchbinde | `gotoRound(r.round)` → IPC `battle:gotoRound` → `doGotoRound(n)` | imm.; Zahl der Knöpfe = `config.rounds` | `components/Scoreboard.tsx:38-54`, `main/index.ts:315-318` |  |
| 16 | Live | **Rundenknopf ▶** im Scoreboard (kein Haupttasten-Platz, Verb `next`): eine Runde weiter (in der letzten Runde bleibt es dabei); schließt das Voting; bei live neue Bauchbinde. Companion-Verb `next` (Nr. 55) | `nextRound()` → IPC `battle:nextRound` → `doGotoRound(round + 1)` | imm. | `components/Scoreboard.tsx:55`, `main/index.ts:307-310` |  |
| 17 | Live | Überschrift „Jury — Runde n“ (klein, Großbuchstaben) über den drei Jury-Knöpfen | `state.round` | imm. | `components/Scoreboard.tsx:58-60` |  |
| 18 | Live | **Jury-Knopf A** (Beschriftung = Name der Ecke A, sonst „A“): setzt den Jury-Sieger der aktuellen Runde auf A; **ein zweiter Klick auf den aktiven Knopf nimmt den Entscheid zurück** (setzt `null`); aktiv = Rand und Schrift in Blau; Companion-Verb `win a` (Nr. 57); ohne Rückfrage | `setJuryWinner(state.round, active ? null : 'A')` → IPC `battle:setJuryWinner` | imm. | `components/Scoreboard.tsx:13-28`, `components/Scoreboard.tsx:62`, `main/index.ts:209-212` |  |
| 19 | Live | **Jury-Knopf „Unentschieden“**: wie Nr. 18 mit Wert `tie`, grau (`#a3a3a3`) | `setJuryWinner(state.round, active ? null : 'tie')` | imm. | `components/Scoreboard.tsx:13-28`, `components/Scoreboard.tsx:63` |  |
| 20 | Live | **Jury-Knopf B** (Beschriftung = Name der Ecke B, sonst „B“): wie Nr. 18 mit Wert B, rot | `setJuryWinner(state.round, active ? null : 'B')` | imm. | `components/Scoreboard.tsx:13-28`, `components/Scoreboard.tsx:64` |  |
| 21 | Live | Textknopf **„zurücksetzen“** neben „Publikum — Runde n“: löscht die Publikumsstimmen **nur der aktuellen Runde** (beide Seiten auf 0); **ohne Rückfrage**, ungeschützt neben dem Voting-Balken (Befund 2); kein Companion-Verb dafür | `clearVotes(state.round)` → IPC `battle:clearVotes` | imm. | `components/Scoreboard.tsx:69-72`, `main/index.ts:327-331` |  |
| 22 | Live | Voting-Balken der aktuellen Runde: links Stimmen A (blau), rechts Stimmen B (rot), dazwischen ein geteilter Balken nach Prozent (bei 0 Stimmen 50 zu 50, gerundet) mit Breitenübergang | `cur.votesA`, `cur.votesB` | imm. | `components/Scoreboard.tsx:30-31`, `components/Scoreboard.tsx:73-80` |  |
| 23 | Live | **Live-Element Ergebnis-Karte** unter dem Scoreboard: Beschriftung „Ergebnis“, darunter „🏆 Name“ des Gesamtsiegers nach Jury-Rundensiegen oder „🤝 Unentschieden“ bei Gleichstand; gelb getönt (`--brand-yellow`); erscheint nur, wenn alle Runden entschieden sind (Unentschieden zählt als entschieden) | `decided(state.rounds)`, `overallWinner(state.rounds)` | E | `App.tsx:27-29`, `App.tsx:58-65`, `shared/scoring.ts:60-65`, `shared/scoring.ts:76-78` |  |
| 24 | Voting | Karte „Publikums-Voting“ in der rechten Spalte mit Überschrift | `RemotePanel` | imm. | `components/RemotePanel.tsx:26-29` |  |
| 25 | Voting | Schaltknopf **„◉ An“ / „○ Aus“** rechts in der Überschrift: startet bzw. stoppt den Voting-Server (`RemoteServer`, Port 7783, Token aus `control.json` falls gesetzt); grün umrandet, wenn er läuft; Fehler beim Starten nur im Log ohne Anzeige (Befund 28); ohne Rückfrage | `setRemote(!state.remote.running)` → IPC `battle:setRemote` → `setRemote` | imm. | `components/RemotePanel.tsx:30-37`, `main/index.ts:271-286`, `main/index.ts:350-353` |  |
| 26 | Voting | Hinweistext bei ausgeschaltetem Server: „Aus. Anschalten, damit das Publikum per Handy (QR) für die Runden abstimmt.“ | – | nicht V | `components/RemotePanel.tsx:62-64` |  |
| 27 | Voting | QR-Code (170 mal 170, weiße Kachel mit Rand, Alternativtext „QR zum Voting“) für die erste Voting-URL; schwarz auf weiß fest (`#000000`/`#ffffff`, Breite 240); Platzhalter „kein Netzwerk“, solange kein QR erzeugt ist (keine URL oder Fehler); Erzeugung im Effekt mit Abbruch-Merker | `toDataUrl(url)` aus `lib/qr.ts`; `state.remote.urls[0]` | V | `components/RemotePanel.tsx:10-24`, `components/RemotePanel.tsx:41-46`, `lib/qr.ts:5-11` |  |
| 28 | Voting | **Haupttaste Voting öffnen/schließen** (volle Breite unter dem QR): Text „Voting öffnen (Runde n)“ bzw. „Voting offen (Runde n) — schließen“ (gelb gefüllt); **nur sichtbar bei laufendem Server**; gesperrt (Deckkraft 40 Prozent), wenn „Publikums-Voting“ in den Einstellungen aus ist (Nr. 39); ohne Tooltip. Companion-Verb `voting` mit `toggleKey` `voting` (Nr. 58) | `setVotingOpen(!state.votingOpen)` → IPC `battle:setVotingOpen` → `doSetVotingOpen` | V; gesperrt bei nicht `votingEnabled` | `components/RemotePanel.tsx:47-55`, `main/index.ts:214-217`, `main/index.ts:323-326` |  |
| 29 | Voting | Liste der Voting-Adressen (LAN-URLs, mit `/?t=<Token>` angehängt, wenn die Suite ein Token hat), je eine Zeile, abgeschnitten; nur lesen | `state.remote.urls` | V | `components/RemotePanel.tsx:56-60`, `main/index.ts:49-54` |  |
| 30 | Replay | Karte „Instant-Replay“ in der rechten Spalte mit Überschrift | `ClipPanel` | imm. | `components/ClipPanel.tsx:16-18` |  |
| 31 | Replay | Knopf **„Aufnahme …“** öffnet den nativen Dateidialog (Nr. 51); daneben der Dateiname der gewählten Quelle (Tooltip: voller Pfad) oder „keine Quelle gewählt“ | `pickRecording()` → IPC `battle:pickRecording` | imm. | `components/ClipPanel.tsx:21-28`, `components/ClipPanel.tsx:4-8` |  |
| 32 | Replay | Knopf **„Zielordner …“** öffnet den nativen Ordnerdialog (Nr. 52); daneben der Ordnername (Tooltip: voller Pfad) oder „Standard (Videos/JM Battle Clips)“ | `pickClipDir()` → IPC `battle:pickClipDir` | imm. | `components/ClipPanel.tsx:29-36` |  |
| 33 | Replay | Zahlfeld **„Länge“** (3 bis 120, Schrittweite des Browsers) mit dem Zusatz „Sekunden (letzte)“: setzt die Clip-Länge; **schreibt bei jedem Tastendruck**, Werte unter 3 werden auf 3 angehoben, eine Obergrenze gilt nur als Attribut `max`, nicht im Code (Befund 18); wirkt auf den Knopf Nr. 34 | `setConfig({ clipSeconds })` → IPC `battle:setConfig` | imm. | `components/ClipPanel.tsx:37-48` |  |
| 34 | Replay | **Haupttaste Replay-Clip** (volle Breite, gelb): schneidet die letzten N Sekunden aus der Quell-Aufnahme; Text „⧉ Clip (letzte Ns)“, während ein Auftrag läuft „schneidet …“; gesperrt ohne Quelle (`recordingPath` leer) oder bei laufendem Auftrag; ohne Tooltip. Companion-Verb `replay` (Nr. 60); der Ablauf steht unter Nr. 70 | `clip()` → IPC `battle:clip` → `doClip` | gesperrt ohne Q oder bei laufendem Auftrag | `components/ClipPanel.tsx:14`, `components/ClipPanel.tsx:51-57`, `main/index.ts:379-382` |  |
| 35 | Replay | Liste der letzten Clip-Aufträge (höchstens 6, neuester oben), je Zeile ein Punkt (grün fertig, rot Fehler, gelb läuft) und der Text: Dateiname der Ausgabe, bei Fehler die Fehlermeldung, bei laufendem Auftrag „Ns …“; Tooltip: Fehlertext bzw. voller Pfad; nur lesen | `state.clips` | mindestens ein Auftrag | `components/ClipPanel.tsx:59-74`, `main/index.ts:260-262` |  |
| 36 | Titler | Karte der Titler-Kopplung (rechte Spalte, unten): Punkt (grün verbunden, grau sonst), Name der Rolle „JM Titler“, rechts „host:port“ bei Verbindung, sonst „getrennt“; Text „VS-Bauchbinde mit den Namen läuft über den Titler.“; nur lesen, zeigt nicht, ob `autoTitler` an ist (Befund 7) | `state.links` (Rolle `titler`), `roleLabel('titler')` | imm. | `App.tsx:30`, `App.tsx:71-80`, `lib/capabilities.ts:7-11` |  |

## 2 · Dialoge und Meldungen

| Nr. | Bereich | Element | Handler/IPC | Zustand (sichtbar/aktiv) | heute wo | künftig wo |
|---|---|---|---|---|---|---|
| 37 | Modal Einstellungen | Modal „Einstellungen“ (`Modal` aus `@jm/ui`, Breite 34 rem), geöffnet über Nr. 8; schließt mit Escape, Klick auf den Hintergrund oder ✕; Fokus geht beim Öffnen in den Dialog und beim Schließen zurück; Tab bleibt im Dialog (Nr. 83); enthält Nr. 38, Nr. 39, Nr. 40 und Nr. 41 | `showSettings` → `Settings`, `onClose` | mod | `App.tsx:84`, `components/Settings.tsx:20-24`, `ui/Modal.tsx:48-138` |  |
| 38 | Modal Einstellungen | Zahlfeld **„Runden“** („Anzahl der Battle-Runden.“, 1 bis 20): **schreibt bei jedem Tastendruck**; Eingaben werden auf 1 bis 20 geklemmt, eine leere oder ungültige Eingabe wird 1; im Main wird die Rundenliste angepasst (Ergebnisse der bleibenden Runden bleiben, neue sind leer) und die aktuelle Runde in den Bereich geklemmt; speichert `config.rounds` | `setConfig({ rounds })` → IPC `battle:setConfig` | mod | `components/Settings.tsx:25-34`, `main/index.ts:341-349`, `shared/scoring.ts:11-21` |  |
| 39 | Modal Einstellungen | Schalter **„Publikums-Voting“** („Abstimmung per QR/Handy zulassen.“, Kontrollkästchen): speichert `config.votingEnabled`; bei aus ist der Voting-Knopf (Nr. 28) gesperrt, `setVotingOpen` ergibt immer „zu“, und eingehende Stimmen werden verworfen; **ein bereits offenes Voting wird dadurch nicht geschlossen** (abgeleitet, Befund 6); die Voting-Seite zeigt „Publikums-Voting ist deaktiviert.“ | `setConfig({ votingEnabled })` → IPC `battle:setConfig` | mod | `components/Settings.tsx:36-38`, `main/index.ts:214-217`, `main/index.ts:237-247` |  |
| 40 | Modal Einstellungen | Schalter **„VS-Bauchbinde automatisch“** („JM Titler bei VS-Live mit den Namen ein-/ausblenden (text-Befehl vorwärtskompatibel).“, Kontrollkästchen): speichert `config.autoTitler`; bei aus sendet Battle nichts an den Titler (`applyVs` und `clearVs` kehren zurück), die Taste VS schaltet nur den eigenen Zustand | `setConfig({ autoTitler })` → IPC `battle:setConfig` | mod | `components/Settings.tsx:40-42`, `main/index.ts:189-199` |  |
| 41 | Modal Einstellungen | **Knopf „Battle zurücksetzen“** (rot umrandet, rechts unten): fragt mit dem nativen `confirm` nach (Nr. 42) und setzt bei Zustimmung zurück; Wirkung im Main: Rundenliste neu nach `config.rounds`, Runde 1, Voting zu, **VS wird ausgeschaltet** (`live=false` und `clear` an den Titler bei `autoTitler`), Namen und Einstellungen bleiben, die Clip-Liste bleibt (abgeleitet aus `doReset`); danach schließt das Modal. Companion-Verb `reset` (Nr. 61) wirkt ohne Rückfrage | `reset()` → IPC `battle:reset` → `doReset` | mod | `components/Settings.tsx:44-56`, `main/index.ts:226-235`, `main/index.ts:336-339` |  |
| 42 | Modal Einstellungen | **Nativer `window.confirm`** (Betriebssystem-Dialog, nicht der `Modal`): Text „Battle zurücksetzen? Runden/Stimmen werden geleert (Namen bleiben).“; Abbruch tut nichts (das Modal bleibt offen); **der Text nennt die Nebenwirkung „VS wird ausgeschaltet“ nicht** (Befund 1); Tasten (Enter, Escape) sind die des Betriebssystem-Dialogs (abgeleitet, nicht gemessen) | `confirm(…)` | mod; nach Klick auf Nr. 41 | `components/Settings.tsx:47` |  |
| 43 | Modal Einstellungen | Schließen des Einstellungs-Modals: ✕ in der Kopfzeile (Beschriftung „Schließen“), Escape, Klick auf den Hintergrund | `onClose` → `setShowSettings(false)` | mod | `App.tsx:84`, `ui/Modal.tsx:68-73`, `ui/Modal.tsx:119-132` |  |
| 44 | Modal Verbindungen | Modal „Tool-Verbindungen“ (`Modal` aus `@jm/ui`, Breite 38 rem), geöffnet über Nr. 7; Text: „Battle blendet die VS-Bauchbinde über den JM Titler ein. Standard ist automatisch (mDNS); für Cross-Subnet einen Host/Port manuell setzen. „Auto“ entfernt den Override.“ (im Code endet „Auto“ mit einem ASCII-Anführungszeichen, Befund 25); schließt mit Escape, Hintergrund oder ✕; zeigt nur die Rolle `titler` | `showConnections` → `ConnectionsPanel` | mod | `App.tsx:85-92`, `components/ConnectionsPanel.tsx:10-34`, `lib/capabilities.ts:7` |  |
| 45 | Modal Verbindungen | Statuszeile der Rolle „JM Titler“: „verbunden host:port (mDNS)“ bzw. „(manuell)“ (grün), „manuell host:port — suche …“ bei gesetztem Override ohne Verbindung, sonst „nicht verbunden“ | `link.connected`, `link.source`, `overrides.titler` | mod | `components/ConnectionsPanel.tsx:47-62` |  |
| 46 | Modal Verbindungen | Textfeld Host („IP (leer = mDNS)“): lokaler Zustand, wird nur beim Öffnen aus Override oder Verbindung vorbelegt und danach nicht nachgeführt (abgeleitet, Befund 21); schreibt erst mit Nr. 48 | `setHost` (lokal) | mod | `components/ConnectionsPanel.tsx:48`, `components/ConnectionsPanel.tsx:63` |  |
| 47 | Modal Verbindungen | Textfeld Port (numerische Tastatur, Vorbelegung Override, Verbindung oder Standardport der Rolle aus der Capability-Tabelle); schreibt erst mit Nr. 48 | `setPort` (lokal) | mod | `components/ConnectionsPanel.tsx:49`, `components/ConnectionsPanel.tsx:64` |  |
| 48 | Modal Verbindungen | Knopf **„Setzen“**: speichert den manuellen Steuer-Endpunkt des Titlers (Host getrimmt, Port als Zahl); ein leerer Host oder Port 0 entfernt den Override wie „Auto“ (`setOverride`); danach verbindet die Kopplung neu | `onSet(role, host.trim(), Number(port))` → `setEndpoint` → IPC `battle:setEndpoint` | mod | `components/ConnectionsPanel.tsx:65`, `main/index.ts:354-358`, `main/config.ts:89-97` |  |
| 49 | Modal Verbindungen | Knopf **„Auto“** (Tooltip „zurück auf Auto/mDNS“): entfernt den Override, die Kopplung sucht wieder per mDNS | `onSet(role, '', 0)` → `setEndpoint` | mod | `components/ConnectionsPanel.tsx:66`, `main/config.ts:92-93` |  |
| 50 | Modal Verbindungen | Schließen des Verbindungs-Modals: ✕, Escape, Klick auf den Hintergrund | `onClose` → `setShowConnections(false)` | mod | `App.tsx:90`, `ui/Modal.tsx:68-73` |  |
| 51 | Nativer Dateidialog | **Nativer Dateidialog 1 (`dialog.showOpenDialog`, Datei öffnen):** Filter „Video/Audio“ (mp4, mov, mkv, m4v, avi, wav, mp3, m4a, flac); bei Wahl wird `config.recordingPath` gesetzt und gespeichert; Abbruch ändert nichts und meldet nichts; der Pfad wird erst beim Clip geprüft (Nr. 70) | `pickRecording()` → IPC `battle:pickRecording` | nach Klick auf Nr. 31 | `main/index.ts:360-370` |  |
| 52 | Nativer Dateidialog | **Nativer Ordnerdialog 2 (`dialog.showOpenDialog`, Ordner öffnen, „Ordner anlegen“ erlaubt):** bei Wahl wird `config.clipDir` gesetzt und gespeichert; Abbruch ändert nichts; ein Zurücksetzen auf „Standard“ gibt es nicht (Befund 8) | `pickClipDir()` → IPC `battle:pickClipDir` | nach Klick auf Nr. 32 | `main/index.ts:371-378` |  |
| 53 | Meldung | Clip-Fehlertexte in der Clip-Liste (Nr. 35): „Aufnahmedatei nicht gefunden — bitte eine Quelle wählen.“, sonst die letzten zwei Zeilen von `ffmpeg` oder „ffmpeg endete mit Code n“ oder die Fehlermeldung der Ausnahme; zusätzlich Logzeilen „Battle-Replay: <Pfad>“ (Info) und „Battle-Replay fehlgeschlagen: …“ (Warnung) | `makeClip` → `ClipOutcome.error` | nach einem Auftrag | `main/clip.ts:22-58`, `main/index.ts:264-268`, `components/ClipPanel.tsx:68-70` |  |
| 54 | Meldung | Es gibt keine Toast-, Banner- oder Fehleranzeige im Renderer: der Start des Voting-Servers (`Battle-Voting: …`), das Laden eines Show-Deep-Links (`Show-Deep-Link konnte nicht geladen werden: …`) und das Starten des Steuerservers melden Fehler nur ins Log bzw. gar nicht (Befund 10) | `getLog().error` | Main | `main/index.ts:282-284`, `main/index.ts:454-456`, `main/index.ts:487` |  |

## 3 · Abläufe ohne eigenes Bedienelement

| Nr. | Bereich | Element | Handler/IPC | Zustand (sichtbar/aktiv) | heute wo | künftig wo |
|---|---|---|---|---|---|---|
| 55 | Fernsteuerung (Companion, Port 8734) | Befehl `BATTLE NEXT`: eine Runde weiter (`doGotoRound(round + 1)`), schließt das Voting, bei live neue Bauchbinde; Capability-Aktion `next` „Nächste Runde“ | `handleSuiteCommand` (`SuiteControlServer`, `onCommand`) | Steuerserver läuft | `main/index.ts:158-160`, `packages/suite-control-protocol/src/capabilities.ts:464` |  |
| 56 | Fernsteuerung | Befehl `BATTLE PREV`: eine Runde zurück; Aktion `prev` „Vorherige Runde“ | `handleSuiteCommand` | wie Nr. 55 | `main/index.ts:161-163`, `packages/suite-control-protocol/src/capabilities.ts:465` |  |
| 57 | Fernsteuerung | Befehl `BATTLE WIN a, b oder tie`: setzt den Jury-Sieger der **aktuellen** Runde (Groß-/Kleinschreibung egal); ein anderer Wert wird ignoriert; anders als der Jury-Knopf gibt es kein Zurücknehmen (kein `null`); Aktion `win` „Jury-Entscheid (aktuelle Runde)“ mit Auswahl Ecke A, Ecke B, Unentschieden | `doSetJuryWinner(round, winner)` | wie Nr. 55 | `main/index.ts:164-169`, `packages/suite-control-protocol/src/capabilities.ts:466-483` |  |
| 58 | Fernsteuerung | Befehl `BATTLE VOTING on, off oder toggle` (ohne Argument `toggle`; auch `1`, `0`, `true`, `false`): öffnet oder schließt das Voting der aktuellen Runde (wirkt nur bei `votingEnabled`); Aktion `voting` „Publikums-Voting“ mit `toggleKey` `voting`; **wirkt auch bei ausgeschaltetem Voting-Server** (die Oberfläche sperrt den Knopf dann, Befund 6) | `doSetVotingOpen(resolveMode(arg, votingOpen))` | wie Nr. 55 | `main/index.ts:170-172`, `main/control-server.ts:51-57`, `packages/suite-control-protocol/src/capabilities.ts:484` |  |
| 59 | Fernsteuerung | Befehl `BATTLE VS on, off oder toggle`: schaltet die VS-Bauchbinde wie Nr. 6; Aktion `vs` „VS-Bauchbinde (Titler)“ mit `toggleKey` `live` | `doSetLive(resolveMode(arg, live))` | wie Nr. 55 | `main/index.ts:173-175`, `packages/suite-control-protocol/src/capabilities.ts:485` |  |
| 60 | Fernsteuerung | Befehl `BATTLE REPLAY`: startet einen Clip wie Nr. 34; **ohne die Sperren der Oberfläche** (kein Prüfen auf laufenden Auftrag, Befund 19); Aktion `replay` „Instant-Replay-Clip“ | `void doClip()` | wie Nr. 55 | `main/index.ts:176-178`, `packages/suite-control-protocol/src/capabilities.ts:486` |  |
| 61 | Fernsteuerung | Befehl `BATTLE RESET`: setzt zurück wie Nr. 41, **ohne Rückfrage**; Aktion `reset` „Battle zurücksetzen“ | `doReset()` | wie Nr. 55 | `main/index.ts:179-181`, `packages/suite-control-protocol/src/capabilities.ts:487` |  |
| 62 | Fernsteuerung | Zustandsmeldung an die Steuer-Clients bei jeder Änderung (`broadcast` → `pushControlState`): `STATE ns=battle` mit den Schlüsseln `round`, `total`, `wins_a`, `wins_b`, `votes_a`, `votes_b`, `voting`, `live`, `leader` (A, B oder tie, sobald alle Runden entschieden sind, sonst „-“) und zusätzlich `vote_leader` (in der Capability-Tabelle nicht als Variable deklariert, Befund 9); 9 Variablen und 2 Rückmeldungen (`live` rot, `voting` gelb) sind deklariert; die Abfrage `STATE?` bedient die Bibliothek (nicht gelesen) | `buildSuiteState`, `pushControlState` | Steuerserver läuft | `main/index.ts:118-122`, `main/index.ts:136-154`, `packages/suite-control-protocol/src/capabilities.ts:489-503` |  |
| 63 | Fernsteuerung | Start des Steuerservers beim Programmstart: Rolle `battle`, Port 8734 fest, `controlEndpoint: true` (mDNS-Annonce, Name `jm-battle-ctl`); nur Befehle mit `ns === 'battle'` werden angenommen; **das Ergebnis des Starts wird verworfen** (`void`), ein Startfehler (Port belegt) ist weder in der Oberfläche noch im Log sichtbar (Befund 10); beim Beenden wird der Server gestoppt | `startControlServer`, `stopControlServer` | Main | `main/control-server.ts:14-45`, `main/index.ts:487`, `main/index.ts:490-494` |  |
| 64 | Voting | Eingehende Stimme der Voting-Seite (Nr. 78): wird nur gezählt, wenn das Voting offen ist und `votingEnabled` gilt, die Seite `A` oder `B` meldet und die gemeldete Runde (falls angegeben) die aktuelle ist; verspätete Stimmen anderer Runden werden verworfen; **keine Begrenzung je Gerät im Main** (die Sperre „eine Stimme je Runde“ liegt nur in der Seite, Befund 17); danach Zustands-Push | `RemoteServer.onCommand` → `handleVote` → `addVote` | V und Vo | `main/index.ts:77-83`, `main/index.ts:237-247` |  |
| 65 | Voting | Live-Zustand an die Voting-Seiten: bei jeder Änderung und laufendem Server sendet `broadcast` den öffentlichen Zustand (Runde, Rundenzahl, offen, erlaubt, Namen und Crews) über `/events`; Anfrage `/state` liefert abgeleitet denselben Inhalt (`packages/remote` nicht gelesen) | `remote.broadcast(publicRemoteState())`, `getState` | V | `main/index.ts:85-96`, `main/index.ts:121` |  |
| 66 | Spielablauf | Rundenwechsel jeder Art (◀, ▶, Direktsprung, `next`, `prev`): Runde wird in 1 bis N geklemmt, das Voting wird geschlossen (der Operator öffnet neu), bei VS on air wird die Bauchbinde neu gesendet (Vorlage, Text, `take`) | `doGotoRound` | Main | `main/index.ts:202-207`, `shared/scoring.ts:17-21` |  |
| 67 | Titler-Kopplung | Bauchbinden-Zeilen an den Titler (`coupling.fire('titler', …)`): bei VS an `TITLER TEMPLATE lowerthird`, `TITLER TEXT A_vs_B Runde_N` (Leerzeichen als `_`, leer als `-`, nur die Namen, nicht die Crew) und `TITLER TAKE`; bei VS aus `TITLER CLEAR`; jeweils nur bei `autoTitler`; ohne Verbindung geht nichts hinaus und niemand meldet es (`fire` liefert nur `false`, Befund 7) | `applyVs`, `clearVs`, `Coupling.fire` | live und `autoTitler` | `main/index.ts:185-199`, `main/coupling.ts:134-139`, `shared/scoring.ts:80-84` |  |
| 68 | Titler-Kopplung | Namensänderung oder Tausch bei VS on air: `applyVs` wird **bei jeder Änderung** neu gesendet, also bei Namensfeldern je Tastendruck dreimal (Vorlage, Text, `take`) (Befund 3) | `battle:setCompetitor`, `battle:swapCompetitors` | live | `main/index.ts:292-305` |  |
| 69 | Titler-Kopplung | Verbindung zum Titler: mDNS-Suche (`discover`, nur Rolle `titler` mit Steuer-Endpunkt), manuelle Overrides (Nr. 48), Aufbau und Auto-Reconnect eines `SuiteControlClient` mit Token und TLS aus `control.json` (geteilte Steuer-Konfig), Zustand des Titlers wird übernommen; Änderungen gehen als `battle:links` an das Fenster (auf 100 ms gedrosselt) | `Coupling.start`, `reconcile`, `broadcastLinks` | Main | `main/coupling.ts:28-132`, `main/index.ts:124-133`, `main/index.ts:485-486` |  |
| 70 | Replay | Ablauf eines Clips: Länge = übergebener Wert oder `config.clipSeconds` (mindestens 1 s); Zielordner = `config.clipDir` oder Videos/JM Battle Clips (wird angelegt, Fehler ignoriert); Auftrag mit Nummer und Zeitstempel in die Liste (höchstens 6); Dateiname `replay-R<Runde>-<Zeitstempel>` mit der Endung der Quelle; `ffmpeg` schneidet per Stream-Copy ab Dauer minus Länge (ohne Probe von vorn); danach Status fertig oder Fehler | `doClip`, `makeClip` | Main | `main/index.ts:249-269`, `main/clip.ts:22-58` |  |
| 71 | Show-Integration | Start über einen Show-Deep-Link: übernimmt aus der Show (Eintrag `jm-battle`) die Rundenzahl (mindestens 1) und die Namen und Crews der Ecken (Namen nur, wenn nicht leer), speichert beides; Lesefehler nur im Log; wirkt beim Start (`initialDeepLink`) und bei späteren Aufrufen (`onDeepLink`) | `applyShowFromDeepLink` | Main | `main/index.ts:428-457`, `main/index.ts:459-463`, `main/index.ts:484` |  |
| 72 | Start und Ende | Einzelinstanz: ein zweiter Start beendet sich, das vorhandene Fenster wird wiederhergestellt, gezeigt und fokussiert; beim Beenden: Kopplung, Steuerserver und Voting-Server stoppen; auf Windows und Linux beendet das Schließen des letzten Fensters die App, auf dem Mac nicht | `requestSingleInstanceLock`, `second-instance`, `before-quit`, `window-all-closed` | Main | `main/index.ts:465-499` |  |
| 73 | Start und Ende | Startablauf nach `whenReady`: Namen aus der Ablage laden, Rundenliste nach `config.rounds`, IPC registrieren, Fenster erzeugen, Deep-Link anwenden, Overrides setzen, Kopplung starten, Steuerserver starten; Laufzeitzustand (Runde, Stimmen, VS, Voting, Clips, Voting-Server) beginnt immer leer und aus | `app.whenReady` | Main | `main/index.ts:479-488`, `main/index.ts:56-65` |  |
| 74 | Fenster | Links, die das Fenster öffnen will, werden abgewiesen und im Standardbrowser geöffnet (`setWindowOpenHandler`); im Renderer gibt es keinen Link (abgeleitet) | `shell.openExternal` | Main | `main/index.ts:414-417` |  |
| 75 | Master-Link | Der Master-Link-Client läuft im Main über `initAppRuntime` (Standard an, Abfrage `jmps:master-link` im Main registriert); Battle hat **keinen Preload-Eintrag und keine Anzeige** dafür, nur die Abgrenzung (Befund 11) | `initAppRuntime` | Main | `main/index.ts:459-463`, `packages/app-runtime/src/index.ts:386-425`, `preload/index.ts:4-40` |  |
| 76 | Store | Zustandsfluss: `battle:state` (bei jeder Änderung, vollständiger `BattleState`) und `battle:links` (gedrosselt) landen im Store; jeder IPC-Aufruf liefert zusätzlich den neuen Zustand zurück und überschreibt den Store; der Merker `subscribed` verhindert doppelte Abos (Befund 29) | `useBattle` | imm. | `store/useBattle.ts:25-52`, `main/index.ts:103-133` |  |

## 4 · Zusatzfenster

Keine. Battle hat genau ein `BrowserWindow` (`main/index.ts:389-426`); kein Tray, kein Menü, kein Einstellungsfenster, kein
Vorschaufenster. Einstellungen (Nr. 37) und Verbindungen (Nr. 44) sind Modals im Fenster.
Abschnitt 4 hat 0 Zeilen.

## 5 · Ausgabefenster (nur Abgrenzung, bleibt unverändert)

| Nr. | Bereich | Element | Handler/IPC | Zustand (sichtbar/aktiv) | heute wo | künftig wo |
|---|---|---|---|---|---|---|
| 77 | Ausgabe | Battle hat **kein Ausgabefenster und kein NDI**: die VS-Bauchbinde zeigt der Titler (Abgrenzung, Nr. 67); das Bild verlässt Battle nie | – | – | `main/index.ts:389-426`, `main/index.ts:185-199` |  |
| 78 | Voting-Webseite | **Voting-Webseite für das Publikum** (Abgrenzung, keine Fensterfläche von Battle): eine selbsterhaltende HTML-Seite, vom Voting-Server unter `/` ausgeliefert (Port 7783, Adresse per QR Nr. 27); Titel „Wer hat die Runde?“, Zeile „Runde n / N“, zwei große Knöpfe A und B (Name und Crew), Statuszeile; fest dunkel mit eigenen Farben (A blau, B rot); **bleibt unverändert** (Spec 5.3), Battle ändert die Seite nicht | `REMOTE_PAGE` | V | `main/remote-page.ts:5-77`, `main/index.ts:77-83` |  |
| 79 | Voting-Webseite | Statustexte der Seite je Zustand: „Publikums-Voting ist deaktiviert.“ (nicht erlaubt), „Voting geschlossen — warte auf die nächste Runde.“ (zu), „Stimme jetzt ab.“ (offen), „Danke, deine Stimme zählt!“ (nach der Stimme, grün); die Knöpfe sind nur bei offenem Voting und ohne bereits abgegebene Stimme der Runde bedienbar | `apply(s)` in der Seite | Seite im Browser des Handys | `main/remote-page.ts:48-63` |  |
| 80 | Voting-Webseite | Stimmabgabe der Seite: Klick auf A oder B sendet `POST /cmd` mit Art `vote`, Seite und Runde; **die Seite zeigt „Danke“, bevor eine Antwort kommt**, und merkt die Stimme je Runde im `localStorage` des Handys (`jmbattle_voted_<Runde>`); Zustand kommt per `/state` und `/events`, das Token aus `?t=` in der Adresse wird an jeden Aufruf gehängt; die Endpunkte der Bibliothek `packages/remote` sind **nicht gelesen** | `vote(side)`, `connect()` in der Seite | Seite im Browser des Handys | `main/remote-page.ts:44-75` |  |

## 6 · Tastatur (Pflichtpunkt Spec 10)

| Nr. | Bereich | Element | Handler/IPC | Zustand (sichtbar/aktiv) | heute wo | künftig wo |
|---|---|---|---|---|---|---|
| 81 | Tastenkürzel | **Keine eigenen.** Kein `keydown`, `keyup`, `keypress`, `onKey…`, `addEventListener`, `accelerator`, `globalShortcut` und kein `before-input-event` in `apps/battle/src` (grep, außer in der Voting-Seite, die nur `onclick` nutzt); keine im Renderer-Code für Runden, VS, Voting oder Clip. **Aktiv ist aber das Electron-Standardmenü** (Kürzel abgeleitet aus den Menü-Rollen von Electron, nicht gemessen): Strg+R und Strg+Umschalt+R (neu laden), Strg+Umschalt+I (Entwicklerwerkzeuge), Strg+0, Strg+Plus und Strg+Minus (Zoom), F11 (Vollbild), Strg+M (minimieren), Strg+W (Fenster schließen), Alt (Menüleiste, `autoHideMenuBar`); dazu die Bearbeiten-Kürzel Strg+Z, Strg+Y, Strg+X, Strg+C, Strg+V, Strg+A. Strg+R lädt nur den Renderer neu, der Live-Zustand liegt im Main und bleibt (abgeleitet aus `main/index.ts:56-65`) | Rollen des Electron-Standardmenüs | imm. | `main/index.ts:405` |  |
| 82 | Tastatur nativ | Tab-Fokus; Leertaste und Enter lösen den fokussierten Knopf aus (Browser-Standard); in Zahlfeldern ändern Pfeil hoch und runter den Wert; die Namens- und Crew-Felder behalten jede Taste, Enter tut nichts Besonderes (kein Handler). Ein Kontrollkästchen schaltet die Leertaste. Rundenknöpfe, ◀, ▶, die Jury-Knöpfe, VS, Voting und Clip sind per Tab erreichbar. | Browser | überall | – |  |
| 83 | Tastatur im Modal | `Modal` (beide Dialoge): **Escape schließt**, Fokus geht beim Öffnen auf das erste fokussierbare Element (in den Einstellungen das Zahlfeld „Runden“) und kehrt beim Schließen zurück; Tab bleibt im Dialog gefangen (Umschalt+Tab in umgekehrter Richtung); die Escape-Taste wird in der Aufnahmephase abgefangen, bevor App-Handler sie sehen (Battle hat keine) | `ui/Modal.tsx` (`keydown` im Dokument, Aufnahmephase) | mod | `ui/Modal.tsx:59-100` |  |
| 84 | Tastatur im Rückfrage-Dialog | Der native `confirm` des Zurücksetzens hat die Tasten des Betriebssystem-Dialogs (Enter bestätigt, Escape bricht ab; abgeleitet, nicht gemessen); die Modal-Tastenregel gilt dort nicht | `confirm` | nach Klick auf Nr. 41 | `components/Settings.tsx:47` |  |
| 85 | Pflichtpunkt Panel-Tasten | **Leertaste und Escape mit Fokus im Panel (O1).** Heute: kein Panel; die Einstellungen sind ein `Modal`, in dem Escape schließt (Nr. 83), Felder behalten ihre Tasten (Browser) und auf Kontrollkästchen und Knöpfen wirkt die Taste nativ; die Leertaste geht nie ans Tool, weil Battle keine Tastenkürzel hat. Mit `SettingsPanel` (abgeleitet aus `ui/SettingsPanel.tsx:49-62`, nicht gemessen): Felder (Text, Zahl, Auswahl) behalten jede Taste; auf Knopf oder Schalter geht die Leertaste weiter ans Tool (Battle hat dafür keinen Handler, der Knopf löst nativ aus); Escape schließt das Panel (nur wenn nicht `defaultPrevented`) und erreicht Battle nicht | – | – | `components/Settings.tsx:24`, `ui/Modal.tsx:68-73`, `ui/SettingsPanel.tsx:49-62` |  |
| 86 | Tastatur im Namensfeld | Namens- und Crew-Felder (vier) sind die einzigen Textfelder der Oberfläche außerhalb der Dialoge; weil Battle keine Kürzel hat, kann keine Taste ein Feld stören (Befund 14 zu später hinzukommenden Kürzeln); die Felder schreiben je Taste (Nr. 11) | `onChange` | imm. | `components/Competitors.tsx:22-34` |  |

## 7 · Gemerkte Zustände (localStorage, sonstige Ablage)

| Nr. | Bereich | Element | Handler/IPC | Zustand (sichtbar/aktiv) | heute wo | künftig wo |
|---|---|---|---|---|---|---|
| 87 | localStorage | **Keiner** im Renderer: kein `localStorage`, kein `sessionStorage`, kein IndexedDB, kein `persistId` (grep über `apps/battle/src`, nur die Voting-Seite nutzt `localStorage`, Nr. 92); kein Reiter, kein Theme, keine eingeklappten Bereiche | – | – | `renderer/index.html:2` |  |
| 88 | Hell/Dunkel | **Fest dunkel**: `class="dark"` im Wurzelelement, kein Umschalter, nichts gemerkt; zusätzlich Fensterhintergrund `#0e0e10` im Main | – | – | `renderer/index.html:2`, `main/index.ts:400` |  |
| 89 | Ablage (Main) | `battle.config.json` unter `userData` (Zeitpunkt: bei jeder Änderung, ohne Atomarität, Fehler ignoriert): `config` (6 Felder `rounds`, `votingEnabled`, `autoTitler`, `clipSeconds`, `recordingPath`, `clipDir`, Standardwerte 3, an, an, 30, leer, leer), `competitors` (Name und Crew je Ecke, Standard „Kontrahent A“ und „Kontrahent B“), `overrides` (manueller Endpunkt je Rolle); gelesen einmal und im Speicher gehalten | `getConfig`, `patchConfig`, `setCompetitors`, `setOverride` | Main | `main/config.ts:9-33`, `main/config.ts:59-97` |  |
| 90 | Ablage (Main) | **Nicht gemerkt:** aktuelle Runde, Jury-Entscheide, Stimmen, Voting offen, VS on air, Clip-Liste, Voting-Server an oder aus; ein Neustart beginnt mit Runde 1, leeren Runden (Zahl aus der Einstellung), allem aus; ein Neuladen des Renderers verliert nichts | – | Main | `main/index.ts:56-65`, `main/index.ts:480-481` |  |
| 91 | Ablage (gelesen) | `control.json` unter `appData`: nur gelesen, das geteilte Suite-Token für Voting-Server und Titler-Verbindung (vom Launcher geschrieben); ohne Token läuft alles offen | `readControlConfig` | Main | `main/index.ts:43-54`, `main/coupling.ts:49-54` |  |
| 92 | localStorage (Voting-Seite) | `jmbattle_voted_<Runde>` (`1`) im Browser des Handys: merkt je Runde, dass dieses Gerät abgestimmt hat (Abgrenzung, nicht im Battle-Fenster; ohne Fehlerbehandlung beim Lesen) | `votedKey(r)` in der Seite | Seite im Browser des Handys | `main/remote-page.ts:47`, `main/remote-page.ts:54`, `main/remote-page.ts:66-67` |  |

## 8 · IPC-Übersicht `window.jmbattle` (Preload `preload/index.ts`)

| Methode | Kanal | Aufrufer im Renderer | Main-Handler |
|---|---|---|---|
| `getState` | `battle:getState` | `store/useBattle.ts:35` | `main/index.ts:290` |
| `onState` | `battle:state` (Ereignis) | `store/useBattle.ts:32` | gesendet `main/index.ts:119` |
| `onLinks` | `battle:links` (Ereignis) | `store/useBattle.ts:33` | gesendet `main/index.ts:130` |
| `setCompetitor` | `battle:setCompetitor` | `store/useBattle.ts:37` (`components/Competitors.tsx:25`, `:32`) | `main/index.ts:292` |
| `swapCompetitors` | `battle:swapCompetitors` | `store/useBattle.ts:38` (`components/Competitors.tsx:49`) | `main/index.ts:299` |
| `nextRound` | `battle:nextRound` | `store/useBattle.ts:39` (`components/Scoreboard.tsx:55`) | `main/index.ts:307` |
| `prevRound` | `battle:prevRound` | `store/useBattle.ts:40` (`components/Scoreboard.tsx:37`) | `main/index.ts:311` |
| `gotoRound` | `battle:gotoRound` | `store/useBattle.ts:41` (`components/Scoreboard.tsx:45`) | `main/index.ts:315` |
| `setJuryWinner` | `battle:setJuryWinner` | `store/useBattle.ts:42` (`components/Scoreboard.tsx:17`) | `main/index.ts:319` |
| `setVotingOpen` | `battle:setVotingOpen` | `store/useBattle.ts:43` (`components/RemotePanel.tsx:48`) | `main/index.ts:323` |
| `clearVotes` | `battle:clearVotes` | `store/useBattle.ts:44` (`components/Scoreboard.tsx:71`) | `main/index.ts:327` |
| `setLive` | `battle:setLive` | `store/useBattle.ts:45` (`App.tsx:41`) | `main/index.ts:332` |
| `reset` | `battle:reset` | `store/useBattle.ts:46` (`components/Settings.tsx:48`) | `main/index.ts:336` |
| `setConfig` | `battle:setConfig` | `store/useBattle.ts:47` (`components/Settings.tsx:31`, `:37`, `:41`; `components/ClipPanel.tsx:44`) | `main/index.ts:341` |
| `setRemote` | `battle:setRemote` | `store/useBattle.ts:48` (`components/RemotePanel.tsx:31`) | `main/index.ts:350` |
| `setEndpoint` | `battle:setEndpoint` | `store/useBattle.ts:49` (`App.tsx:89`) | `main/index.ts:354` |
| `pickRecording` | `battle:pickRecording` | `store/useBattle.ts:50` (`components/ClipPanel.tsx:22`) | `main/index.ts:360` |
| `pickClipDir` | `battle:pickClipDir` | `store/useBattle.ts:51` (`components/ClipPanel.tsx:30`) | `main/index.ts:371` |
| `clip` | `battle:clip` | `store/useBattle.ts:52` (`components/ClipPanel.tsx:52`, ohne Argument) | `main/index.ts:379` |
| `platform` | – | **im Renderer ungenutzt** | – |
| (nicht im Preload) | `jmps:master-link` | **im Renderer nicht vorhanden** (Befund 11) | `packages/app-runtime/src/index.ts:395` |

## 9 · Einstellungen nach Spec 6 / Anhang A (Zuordnung der Ist-Elemente)

| Abschnitt (Anhang A) | Ist-Elemente | Bemerkung (belegt) |
|---|---|---|
| Haupttaste VS on air | Nr. 6 | Kopf, nie gesperrt; Verb `vs`, `toggleKey` `live` |
| Haupttaste Voting öffnen/schließen | Nr. 28 | heute nur bei laufendem Server sichtbar, gesperrt bei nicht erlaubtem Voting; muss erhalten bleiben |
| Haupttaste Nächste Runde | Nr. 16; ◀ Nr. 14 und die Rundenknöpfe Nr. 15 bleiben im Scoreboard | Verben `next` und `prev` |
| Haupttaste Replay-Clip | Nr. 34 | gesperrt ohne Quelle oder bei laufendem Auftrag |
| Live-Element | Nr. 10, Nr. 22, Nr. 18, Nr. 19, Nr. 20, Nr. 23 | Jury-Entscheid bleibt im Scoreboard; Ergebnis-Karte bei `decided` |
| Statuseintrag Master-Link | – | heute keine Anzeige und kein Preload (Nr. 75) |
| Statuseintrag Titler | Nr. 36, Nr. 45 | `state.links` und `config.autoTitler`; Warnung „getrennt bei Kopplung an“ heute nirgends |
| Statuseintrag Voting | Nr. 25, Nr. 28, Nr. 27 | `state.remote.running`, `config.votingEnabled`, `state.votingOpen` |
| Statuseintrag Aufnahme-Quelle | Nr. 31 | `config.recordingPath` |
| Statuseintrag Fernsteuerung | – | heute keine Anzeige, Port 8734 nur in `main/control-server.ts:14`, Startergebnis verworfen (Nr. 63) |
| Panel Abschnitt „Battle“ | Nr. 38, Nr. 39, Nr. 40 | Runden, Publikums-Voting erlaubt, VS automatisch |
| Panel Abschnitt „Instant-Replay“ | Nr. 32, Nr. 33, Nr. 31 | liegen heute im rechten Panel der Live-Seite, nicht in den Einstellungen |
| Panel Abschnitt „Zurücksetzen“ | Nr. 41, Nr. 42 | gefährlich, mit Rückfrage; nicht in die Haupttasten |
| Panel Gegenstellen | Nr. 44, Nr. 45, Nr. 46, Nr. 47, Nr. 48, Nr. 49 | nur Rolle `titler` |
| Namen und Crews | Nr. 11, Nr. 12, Nr. 13 | Eingabe je Tastendruck; Tausch |
| Voting-Server an/aus | Nr. 25, Nr. 26, Nr. 29 | heute in der rechten Spalte |
| Stimmen zurücksetzen | Nr. 21 | in Anhang A nicht genannt (Befund 2) |
| Tastatur | Nr. 81, Nr. 85 | keine Kürzel; Panel-Tasten nach O1 |

## 10 · Befunde für den Umbau (belegt, ohne Wertung als Fehler)

1. **Der Rückfragetext des Zurücksetzens nennt die Nebenwirkung nicht:** der Text sagt „Runden/Stimmen werden geleert (Namen
   bleiben).“ (`components/Settings.tsx:47`); `doReset` schaltet aber auch ein laufendes VS aus und sendet `clear` an den
   Titler (`main/index.ts:226-235`). Die Clip-Liste und die Einstellungen bleiben. Das Verb `reset` hat keine Rückfrage
   (`main/index.ts:179-181`).
2. **„Stimmen zurücksetzen“ ist ungeschützt:** der Textknopf steht klein neben der Überschrift „Publikum“
   (`components/Scoreboard.tsx:71`), ohne Rückfrage, und löscht die Stimmen der aktuellen Runde (`main/index.ts:327-331`).
   Es gibt dafür kein Companion-Verb (`packages/suite-control-protocol/src/capabilities.ts:463-488`). Anhang A nennt ihn nicht.
3. **Namensfelder schreiben je Tastendruck und lösen bei VS on air die Bauchbinde neu aus:** jeder `onChange` ist ein
   IPC-Aufruf, ein Schreiben von `battle.config.json` (`main/config.ts:59-65`, synchron) und ein Zustands-Push
   (`main/index.ts:292-298`); bei `live` sendet `applyVs` je Taste drei Zeilen an den Titler (`main/index.ts:295`,
   `main/index.ts:189-196`). Die Bestandsaufnahme (Abschnitt 7.2 der Bestandsaufnahme im Planordner) vermutete das Gegenteil; der Code
   liest es so, gemessen ist es nicht.
4. **Tausch ⇄ tauscht Name und Crew, nicht die Ergebnisse:** Rundenentscheide und Stimmen bleiben bei ihrer Seite
   (`main/index.ts:299-305`); danach stimmen Jury-Rundensiege und Namen nicht mehr zusammen (abgeleitet). Ohne Rückfrage.
5. **Rundenwechsel ist immer ohne Rückfrage und schließt das Voting:** ▶ in der letzten und ◀ in der ersten Runde ändern
   nichts, ohne Rückmeldung (`shared/scoring.ts:17-21`); der Direktsprung springt über beliebig viele Runden und schließt
   ein offenes Voting (`main/index.ts:204`); Companion `next` und `prev` ebenso.
6. **Voting-Knopf, Server und Erlaubnis sind drei Zustände:** der Knopf erscheint nur bei laufendem Server
   (`components/RemotePanel.tsx:40-61`) und ist bei nicht erlaubtem Voting gesperrt (`:49`); das Companion-Verb `voting` wirkt
   dagegen auch ohne Server (`main/index.ts:170-172`). Das Abschalten der Erlaubnis in den Einstellungen schließt ein
   bereits offenes Voting nicht: `battle:setConfig` fasst `votingOpen` nicht an (`main/index.ts:341-349`), Stimmen werden
   dann verworfen (`main/index.ts:240`), die Oberfläche zeigt aber weiter „Voting offen“ (abgeleitet).
7. **VS ist nie gesperrt und die Kopplung ist unsichtbar:** bei `autoTitler` an und getrenntem Titler wird `live` wahr und
   die Taste rot, `fire` liefert nur `false` (`main/index.ts:186-188`, `main/coupling.ts:134-139`); die Titler-Karte zeigt
   „getrennt“ (`App.tsx:76`), die Taste nichts. Bei `autoTitler` aus schaltet die Taste nur den Zustand. Die Karte zeigt
   `autoTitler` nicht an.
8. **Zwei native Dateidialoge:** Aufnahme (mit Dateifilter) und Zielordner (`main/index.ts:360-378`); Abbruch ohne Meldung,
   der Pfad wird erst beim Clip geprüft (`main/clip.ts:26-28`); den Zielordner kann man nicht auf „Standard“ zurücksetzen.
9. **Variable `vote_leader`:** der Zustand sendet sie (`main/index.ts:151`), die Capability-Tabelle deklariert nur neun
   Variablen ohne sie (`packages/suite-control-protocol/src/capabilities.ts:489-499`). Verben, Variablen und Rückmeldungen
   bleiben unverändert (Spec U6).
10. **Start- und Fehlermeldungen nur im Log oder gar nicht:** das Ergebnis von `startControlServer` wird verworfen
    (`main/index.ts:487`); der Voting-Server meldet Startfehler nur ins Log (`main/index.ts:282-284`); Show-Deep-Link-Fehler
    ebenso (`main/index.ts:454-456`). Der Port 8734 steht nicht im Zustand (`shared/types.ts:73-88`).
11. **Master-Link:** der Client läuft im Main (`packages/app-runtime/src/index.ts:386-425`), aber der Preload hat weder
    `masterLink` noch `onMasterLink` (`preload/index.ts:4-40`) und `JmBattleApi` keinen Typ dafür (`shared/types.ts:91-117`).
12. **CI:** Battle steht nicht im Job „Selbsttests“ von `.github/workflows/ci-checks.yml` (kein Schritt `npm run selftest -w
    @jm/battle`; Job beginnt in Zeile 32); nur die Typprüfung läuft über `npm run typecheck --workspaces --if-present`
    (Zeile 30; ob Battle als Arbeitsbereich dort mitläuft, ist abgeleitet). Task 24 trägt den Schritt ein.
13. **Tests:** nur `test/selftest.ts` für `shared/scoring.ts` (`node --experimental-strip-types`); keine Oberflächen-,
    Main- oder Companion-Tests, kein `tsx`, keine Datei tsconfig.test.json, kein Skript `test` (`apps/battle/package.json`, Abschnitt
    `scripts`).
14. **Kürzel später:** Heute 0 Kürzel; Namens-, Crew-, Runden- und Längenfelder sind Eingabefelder, neue Kürzel müssten sie
    ausnehmen (Spec: keine für Battle).
15. **Rohe Farben:** 69 Vorkommen `neutral-…` und 10 feste Hex-Farben im Renderer (grep -o); Ecken-Farben `#3da5ff` und
    `#ff5c5c` (`components/Competitors.tsx:45`, `:56`, `components/Scoreboard.tsx:4-5`), Grau `#a3a3a3`, `#3f3f46`, `#d4d4d8`
    (`components/Scoreboard.tsx:20-22`, `:41`, `:63`); Signalfarben `green-500` und `red-500` in `App.tsx:43`,
    `components/RemotePanel.tsx:33`, `components/ClipPanel.tsx:65`; `bg-white` für die QR-Kachel (`components/RemotePanel.tsx:43`). Die
    Dialoge `Settings` und `ConnectionsPanel` nutzen schon Token. Die Ecken-Farben tragen Hex-Alpha (`${color}22`, `${mark}33`,
    `components/Scoreboard.tsx:21`, `:47`) und funktionieren nur mit sechsstelligem Hex.
16. **Bausteine:** aus `@jm/ui` nur `Modal` (`components/Settings.tsx:1`, `components/ConnectionsPanel.tsx:2`); `@jm/settings`
    ist keine Abhängigkeit; lokal sind `Row` (`components/Settings.tsx:7-17`), `RoleRow`, Stilkonstanten und nackte
    Kontrollkästchen. `globals.css` hat `@source` nur für `packages/ui/src` (`renderer/src/globals.css:3`), nicht für
    `packages/settings/src` (Kopf gelesen).
17. **Die Stimmsperre je Gerät liegt nur in der Voting-Seite:** `localStorage` je Runde (`main/remote-page.ts:47`, `:66-67`);
    der Main zählt jede eingehende Stimme der aktuellen Runde (`main/index.ts:237-247`); die Seite zeigt „Danke“ vor einer
    Antwort (`main/remote-page.ts:68-71`). Die Endpunkte der Bibliothek `packages/remote` sind nicht gelesen.
18. **Länge und Runden schreiben je Tastendruck:** Länge wird nur nach unten geklemmt (`components/ClipPanel.tsx:44`), der Main
    rundet und klemmt auf mindestens 1 (`main/index.ts:251`); Runden werden auf 1 bis 20 geklemmt
    (`components/Settings.tsx:31`). Wer die Länge löscht, bekommt sofort 3 im Feld (abgeleitet).
19. **Clip über das Verb kennt die Sperre nicht:** `replay` ruft `doClip` ohne Prüfung auf einen laufenden Auftrag oder eine
    gesetzte Quelle (`main/index.ts:176-178`); die Oberfläche sperrt beides (`components/ClipPanel.tsx:53`); zwei Aufträge
    können parallel laufen (abgeleitet). Die Clip-Liste behält 6 Einträge (`main/index.ts:261`) und wird vom Zurücksetzen
    nicht geleert.
20. **Standard-Zielordner:** Videos/JM Battle Clips unter dem Videos-Ordner des Benutzers (`main/index.ts:252`), Anzeige
    „Standard (Videos/JM Battle Clips)“ (`components/ClipPanel.tsx:34`).
21. **Verbindungs-Modal merkt sich nur den Öffnungsstand:** `useState` wird nur beim ersten Anzeigen aus Override oder
    Verbindung gefüllt (`components/ConnectionsPanel.tsx:48-49`); wechselt der gefundene Host im geöffneten Modal, bleibt
    das Feld stehen (abgeleitet). „Setzen“ mit leerem Host wirkt wie „Auto“ (`main/config.ts:92-93`).
22. **Mac:** `titleBarStyle: 'hiddenInset'` (`main/index.ts:404`), der Kopf hat keine Ziehfläche und keinen Einzug (kein
    `dragRegion` in `apps/battle/src`, grep).
23. **Maße:** Fenster 1200 mal 820, mindestens 980 mal 660 (`main/index.ts:396-399`); rechte Spalte fest 20 rem
    (`App.tsx:68`), scrollt getrennt; linke Spalte scrollt (`App.tsx:55`).
24. **Standardwert `autoTitler` an:** `autoTitler` ist standardmäßig an (`main/config.ts:12`), der
    Titler wird also bei jedem VS-Wechsel angesprochen, auch wenn kein Titler läuft (Befund 7).
25. **ASCII-Anführungszeichen in Nutzertexten:** der Text im Verbindungs-Modal schließt „Auto mit einem ASCII-Zeichen
    (`components/ConnectionsPanel.tsx:25`). In dieser Liste ist es als „Auto“ wiedergegeben.
26. **Einzelne Texte mit Ortsangaben:** „Anschalten, damit das Publikum per Handy (QR) für die Runden abstimmt.“
    (`components/RemotePanel.tsx:63`) und der Verbindungstext (`components/ConnectionsPanel.tsx:23-26`) beschreiben
    Orte und Namen („Einstellungen“, „Verbindungen“), die nach dem Umbau anders heißen könnten.
27. **Dateiname des Clips trägt die Runde zum Zeitpunkt des Starts:** `replay-R<Runde>-<Zeitstempel>`
    (`main/index.ts:264`), nicht die Runde des Mitschnitts (abgeleitet).
28. **Voting-Server-Start:** der Port 7783 ist fest (`main/index.ts:39`), ein Fehler beim Start (Port belegt) wird nur ins
    Log geschrieben, `remoteRunning` bleibt falsch, die Oberfläche zeigt weiter „○ Aus“ (`main/index.ts:271-286`).
29. **Abo-Merker:** `subscribed` liegt auf Modulebene des Stores (`store/useBattle.ts:25`); beim Umbau darf er nicht doppelt
    entstehen, sonst gäbe es doppelte Push-Handler.
30. **Ungenutzte Preload-Teile:** `platform` (`preload/index.ts:5`) und der Parameter `seconds` von `clip`
    (`preload/index.ts:39`, vom Renderer nie gesetzt, `components/ClipPanel.tsx:52`); `ToolLink.state` wird im Renderer nicht
    gelesen (abgeleitet aus den gelesenen Dateien).
