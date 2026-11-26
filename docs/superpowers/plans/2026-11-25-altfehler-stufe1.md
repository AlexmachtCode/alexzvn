# Altfehler Runde 1, Stufe 1: Studio-Control und Player — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die zehn Befunde der Stufe 1 erreichen das Zielverhalten der Spec. Das sind in Studio-Control SC-S1 bis SC-S3, im
Player PL-N, PL-T13, PL-4, PL-10, PL-11, PL-16a und PL-T14. Jeder behobene Befund hat einen Test, der vorher rot war.

**Architecture:**
- **Player zuerst (Task 1–4):**
  - Task 1 macht die Ausgabe verlässlich: Sie meldet „bereit“, und es gibt ein einziges Fenster.
  - Task 2 und 3 härten den Show-Ablauf im Store: Pause und Vorlauf, Fernbefehle, Ladefehler.
  - Task 4 betrifft die Bedienung im Fenster: Pad-Tasten, Löschen, Standby.
  - Neue Logik kommt in reine Module ohne Electron (`R/lib/*.ts`, `main/ausgabe-fenster.ts`), damit `tsx` sie testen kann.
- **Studio-Control danach (Task 5–6):**
  - Task 5 enthält die zwei kleinen Fixes: Gateway liest `control.json`, Panel nennt die Passwort-Datei. Dazu kommt die
    Messung des Erst-Kontos.
  - Task 6 baut den Zugang um: Nur das eigene Fenster ist ohne Anmeldung Admin, über ein Geheimnis je Start; fremde Ursprünge
    werden abgewiesen.
  - Die Entscheidungen liegen in `main/auth/zugang.ts` (rein, ohne Datenbank), weil `better-sqlite3` unter `tsx` nicht lädt.
- **Abschluss (Task 7–8):** Versionen, Changelog-Entwurf und Texttabelle für den Owner, dann Handbücher, Abnahme-Datei und
  Bestandsaufnahme.

**Tech Stack:** Electron 33, React 18, TypeScript, zustand, Socket.IO 4. Tests mit `tsx` und `@jm/ui/testhilfe` (`ok`,
`gleich`, `leseText`). Echt-Fenster-Messung per CDP wie in den Wellen.

**Spec:** `docs/superpowers/specs/2026-11-25-altfehler-runde1-design.md` (Owner-Freigabe 25.11.2026 14:08). Befund-IDs und
Zeilenangaben kommen aus `docs/ux/altfehler-inventar.md` (Stand main `cf42db4e4a`). Die Zeilen sind am Code nachgeprüft
(Stand `a47f0c40dc`).

## Global Constraints

- **Nur die Stellen der Spec, Abschnitt 5, ändern ihr Verhalten.** Alles andere bleibt, auch Protokolle, Ports, Verben und das
  Companion-Modul. Neu sind nur die IPC-Kanäle, die dieser Plan nennt.
- **TDD:** Jeder Test ist erst rot, dann grün. Logik bekommt eine Mutationsprobe: Die Änderung zurücknehmen, der Test wird
  rot. Das Ergebnis steht im Bericht.
- **Node 22:** `export PATH="/c/Users/alexk/AppData/Local/Temp/claude/5dcb13dfa9326af2/d9a2ccbe-f7cf-45d6-bb7e-1e766347e2af/scratchpad/node22:$PATH"`.
  Alle Befehle laufen im Worktree `C:/Users/alexk/alexzvn/.claude/worktrees/altfehler`.
- **Tests je App:**
  - `npm run selftest -w @jm/player` und `npm run typecheck -w @jm/player`;
  - `npm run selftest -w @jm/studio-control` und `npm run typecheck -w @jm/studio-control`.
  - Erwartet: Exit 0 und die Zeile `ALLE TESTS OK`.
- **Funktionslisten-Tests bleiben grün,** im normalen Lauf und mit `JM_FUNKTIONSLISTE_GIT=1`. Wie das geht:
  - Ändert ein Task eine Datei der App, nimmt er sie in `GEAENDERT` von `test/ui/funktionsliste.test.ts` auf.
  - Eine Zeile „unverändert (…)“ in `docs/ux/funktionslisten/<app>.md`, die diese Datei nennt, bekommt die Befund-ID als
    Verweis, etwa „Altfehler PL-4“.
  - Der Test erlaubt dafür genau die zehn IDs dieser Stufe. Beim Player gilt der Verweis wie ein E2/E3-Hinweis, bei
    Studio-Control als Eintrag in `ERLAUBT`.
  - Die Zahl der Zeilen und ihre Reihenfolge bleiben.
- **Texte:**
  - Alle neuen sichtbaren Texte stehen in den Textobjekten `PLAYER_TEXTE` bzw. `STUDIO_TEXTE` (oder in einer Konstante des
    neuen Moduls, die der Task nennt), nie verstreut im JSX.
  - Wortlaut wie in diesem Plan. Es sind Entwürfe; die Owner-Freigabe läuft über Task 7.
  - Typografische Anführungszeichen „…“, nie ASCII-`"` in Texten und Changelog.
- **Keine neuen Abhängigkeiten.** Kein `npm install` in einem Task. Den Stand im Worktree legt der Controller vorher an.
- **Git:**
  - Dateien mit LF; `git -c core.autocrlf=false` für add und commit.
  - Pfade einzeln stagen, nach jedem add `git status --short` lesen.
  - Nie `git config`, nie pushen.
  - Jeder Commit endet mit `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Studio-Control:** nur Testadressen 192.0.2.x, kein Licht-Node, keine echten Geräte.
- **Echt-Fenster-Messung** (Task 1, 3, 5, 6): Es gelten die Regeln im Abschnitt „Echt-Fenster-Messung“ unten.
- **Neue IPC-Kanäle (genau diese Namen):**
  - Player: `output:bereit` (send, vom Ausgabefenster), `player:protokoll` (invoke), `library:nutzung` (invoke).
  - Studio-Control: `studio:fensterGeheimnis` (invoke), `studio:erstPasswort` (invoke).
  - Studio-Control-Header `X-JMS-Fenster`; Feld `fenster` in `socket.handshake.auth`.

## Review Focus

1. **Ausgabe per Panel geöffnet, sofort GO:** Das Fenster ist offen, hört aber noch nicht zu. Erwartet: Das Video läuft.
   `sendToOutput` wartet auf „bereit“ des aktuellen Fensters. Test und Messung in Task 1.
2. **Pause im Vorlauf, dann Stop oder Panik:** Erwartet: Später startet kein Cue von selbst. Angehaltene Vorläufe sind weg
   (Task 2, Test „PL-11 Stop in der Pause räumt angehaltene Vorläufe“).
3. **GO in der Pause auf einen Cue mit Vorlauf:** Erwartet: Der Vorlauf steht angehalten und läuft erst mit „Weiter“ (Ruling
   A1). Task 2, Test „PL-11 GO in der Pause: Vorlauf wartet auf Weiter“.
4. **Browser auf einem anderen Gerät:** Origin und Host sind `http://192.168.x.y:7778`. Erwartet: Login und Socket gehen
   weiter. Ein Origin mit anderem Host oder Port wird abgewiesen, eine Anfrage ohne Origin nicht (Task 6, `zugang.test.ts`).
5. **Fenster als Operator angemeldet:** Erwartet: Am Server bleibt es „local“ (Admin) wie heute. Der Logout widerruft weiter
   die eigene Sitzung, weil `Authorization` unverändert mitgeht (Task 6, Test „SC-S2 apiFetch schickt Geheimnis und Token“).

---

## Vor Task 1 (Controller, kein Helfer)

1. **Stand:** `git log --oneline -1` zeigt den Plan-Commit über `a47f0c40dc`, `git status --short` ist leer.
2. **Abhängigkeiten:** `npm ci --ignore-scripts` im Worktree-Wurzelordner (Node 22). Danach `git status --short` lesen.
   Dann die **Link-Prüfung**:
   `node .superpowers/sdd/2026-11-25-altfehler-stufe1/referenz/links-schreibweise.mjs C:/Users/alexk/alexzvn/.claude/worktrees/altfehler`
   muss Exit 0 haben. Sonst die Links mit kleinem „c:“ per `rmdir` und `mklink /J` auf „C:“ umstellen, wie bei der Lehre
   „Junction mit kleinem c:“.
3. **Grundstand messen** und ins Ledger schreiben: die Selbsttests und Typprüfungen beider Apps (Befehle oben), einmal mit
   `JM_FUNKTIONSLISTE_GIT=1`.
4. **Ledger:** `.superpowers/sdd/2026-11-25-altfehler-stufe1/` mit `progress.md` (Ablauf, `Ruling:`-Zeilen). Dazu
   `referenz/` mit diesen Dateien aus `C:/Users/alexk/.claude/projects/c--Users-alexk-alexzvn/sdd-archiv/2026-11-25-ux-welle2b-superpowers.tar.gz`
   (entpacken mit `tar --force-local -xzf` in einen leeren Ordner im Scratchpad, dann kopieren):
   - `messung-vorlage.mjs`
   - `plz1-messung.mjs`, `plz1-fenster.cs`, `plz1-brief.md`, `plz1-report.md` (Player, erstes GO bei geschlossener Ausgabe)
   - `t14-messung.mjs`, `t14-sim-messung.mjs` (Studio-Control)
   - aus dem Scratchpad `links-schreibweise.mjs` (wird vor Schritt 2 gebraucht, darum zuerst kopieren)
5. Jeder Helfer bekommt den Abschnitt „Echt-Fenster-Messung“ wörtlich und den Pfad zu `referenz/`.

## Echt-Fenster-Messung (gilt für jede Aufgabe mit Messung)

- **Isoliert:**
  - eigenes Profil im Scratchpad (`--user-data-dir`), `APPDATA`, `LOCALAPPDATA` und `USERPROFILE` umgelenkt;
  - `ELECTRON_RUN_AS_NODE` aus der Umgebung nehmen;
  - echtes Profil vorher und nachher abbilden (Dateiliste mit Zeitstempeln) und vergleichen.
- **Ports:**
  - Vorher prüfen, dass 7778, 8725 und 8735 frei sind; sonst abbrechen und melden, nichts beenden.
  - Ein Blocker bindet den Steuerport der App (Player 8725, Studio-Control 8735) für die ganze Messung.
  - Einzige Ausnahme ist Task 5, Messung des Gateways. Dort läuft 8735 offen im Modus secure, und vorher ist geprüft, dass
    kein Companion-Prozess läuft.
- **Bedienung nur per CDP** (`--remote-debugging-port`), nie globale Tastendrücke oder Mausklicks, denn der Owner arbeitet am
  Rechner. Fensterzählung wie in `plz1-fenster.cs` nur lesend.
- **Medien:**
  - Nur Fake-Medien, keine Kamera und kein Mikrofon.
  - Test-Video und Test-Ton erzeugt der Helfer im Scratchpad: ein 3-s-MP4 und ein 2-s-WAV, wie in `plz1-messung.mjs`.
- **Native Module:**
  - Fehlt `better-sqlite3` für Electron im Worktree, wird es aus der Hauptkopie verzweigt (junction), nur bei gleicher
    Version.
  - Am Ende löst nur `rmdir` die Verzweigung, nie `del`.
- **Ergebnis:**
  - JSON und Log ins Ledger (`out/t<N>-messung.json`), Bericht mit den Zahlen.
  - Ein Geheimnis oder Passwort aus dem Testprofil erscheint nie in Log, Bericht oder Chat; das Skript meldet nur „ok“ oder
    „abgelehnt“.

## Entscheidungen, wo Spec und Code schweigen (Owner zur Kenntnis)

Jede steht als `Ruling:` im Ledger und kommt in Task 8 nach `docs/ux/altfehler-entscheidungen.md`.

- **A1 (PL-11):** Ein GO in der Pause auf einen Cue mit Vorlauf startet den Vorlauf angehalten. Er läuft mit „Weiter“ weiter.
  Ein GO auf einen Cue ohne Vorlauf startet wie heute sofort und hebt die Pause auf. Dann laufen auch angehaltene Vorläufe
  weiter. Grund: Spec „In der Pause startet kein Cue von selbst“.
- **A2 (PL-T14):**
  - Nach einem Ladefehler gibt es kein Auto-Continue; der Standby steht schon auf dem nächsten Cue.
  - Die Pause bleibt, wie sie vor dem Start war.
- **A3 (PL-T14, PL-16a):**
  - Die Meldung im Fenster ist die bestehende Hinweisleiste (`notice`, 4 s).
  - Die Log-Zeile geht über den neuen Kanal `player:protokoll` an `getLog().warn`.
- **A4 (PL-10):**
  - Rückfragen kommen per `window.confirm`, wie heute „Diese Show löschen?“.
  - Der Standby folgt seinem Cue auch beim Umsortieren.
  - Wird der Standby-Cue selbst gelöscht, steht der Standby wie heute auf dem Cue danach.
- **A5 (PL-N):**
  - Auf „bereit“ wird höchstens 5000 ms gewartet. Danach geht der Befehl trotzdem hinaus, und das Log bekommt eine Zeile.
  - Das gilt auch für ein Fenster, das per Panel offen ist und noch lädt.
- **A6 (PL-4):** Ein Pad löst auch bei gedrückter Umschalttaste aus; nur Strg, Alt und Meta sperren. Grund: Spec nennt nur
  diese drei.
- **A7 (SC-S2):**
  - Das Geheimnis hat 32 Zufallsbytes als Hex und gilt je Start.
  - `studio:fensterGeheimnis` gibt es nur an die Webinhalte des Hauptfensters, nur im Hauptrahmen und nur auf der eigenen Seite
    (`file://…/renderer/index.html` oder im Dev die Vite-Adresse).
  - Das Fenster schickt es als `X-JMS-Fenster` bzw. `auth.fenster`. `Authorization` geht weiter wie heute mit, damit Logout
    die Sitzung widerruft.
- **A8 (SC-S2):** Wann ein Ursprung als eigen gilt:
  - Erlaubt sind kein `Origin` (Programme, sie brauchen ein Konto) und `Origin` gleich `http://` + `Host` (Browser vom Server
    selbst, ohne Groß/Klein).
  - Ebenfalls erlaubt sind `null` und `file://` (das App-Fenster; ohne Geheimnis bleibt nur die Anmeldung).
  - Nur ohne Paket (`!app.isPackaged`) kommen die Vite-Adressen dazu: `http://localhost:5174`, `http://127.0.0.1:5174` und
    der Ursprung von `ELECTRON_RENDERER_URL`.
  - Alles andere: HTTP 403 `{"error":"origin"}`; Socket.IO lehnt per `allowRequest` ab.
- **A9 (SC-S1):** Der Panel-Abschnitt „Browser-Zugang“ nennt den Pfad, solange die Datei besteht. Gemessen wird beim Öffnen
  des Panels. Die Anmeldung und das Konto beim ersten Start bleiben, wenn die Messung in Task 5 kein bekanntes oder leeres
  Passwort findet.
- **A10:** Neue Versionen: Player 0.9.1 → **0.10.0**, Studio-Control 0.7.0 → **0.8.0** (Minor, drei bis vier Notizen).

---

## Aufgaben

### Task 1: Player · Ausgabe meldet „bereit“, nur ein Ausgabefenster (PL-N, PL-T13)

**Files:**
- Modify: `apps/player/src/main/ausgabe-fenster.ts` (Klasse `LebendeFenster` erweitern)
- Modify: `apps/player/src/main/output-window.ts` (Variable `outputWindow` entfällt; `openOutputWindow`, `closeOutputWindow`,
  `isOutputOpen`, `isOutputFullscreen`, `toggleOutputFullscreen`, `sendToOutput` lesen `lebende.aktuelles()`)
- Modify: `apps/player/src/main/ipc.ts:83`, `:90` (Rückgabe als Promise), neuer `ipcMain.on('output:bereit', …)`
- Modify: `apps/player/src/preload/index.ts` (`output.meldeBereit`), `apps/player/src/renderer/src/jmplay.d.ts`
- Modify: `apps/player/src/renderer/src/views/OutputView.tsx:49` (nach `onCommand` einmal `meldeBereit()`)
- Test: `apps/player/test/ui/bruecken.test.ts` (Klasse und Wächter), `apps/player/test/ui/funktionsliste.test.ts` (Regel oben)

**Interfaces:**
- Produces (`main/ausgabe-fenster.ts`, rein):
  - `LebendeFenster<T>.aktuelles(): T | null` gibt das neueste lebende Fenster ohne Schließ-Wunsch zurück.
  - `LebendeFenster<T>.schliesst(w: T): void` vermerkt den Schließ-Wunsch; `w` zählt danach nicht mehr als `aktuelles`.
  - `LebendeFenster<T>.meldeBereit(w: T): void`; ein unbekanntes `w` ist ohne Wirkung.
  - `LebendeFenster<T>.bereit(w: T, ms: number): Promise<boolean>`: `true`, sobald (oder falls schon) `meldeBereit(w)` kam;
    `false` nach `ms` oder wenn `w` vorher per `schliesse` endet.
  - `export const AUSGABE_BEREIT_MS = 5000`
  - `hinzu`, `schliesse` und `istNeuestes` bleiben mit ihrer heutigen Bedeutung.
- Produces (Preload): `window.jmplay.output.meldeBereit(): void` (send `output:bereit`).
  - `output.open(displayId?)` löst erst nach „bereit“ (oder `AUSGABE_BEREIT_MS`) auf.
  - `output.command(cmd)` löst auf, nachdem der Befehl gesendet ist.

- [ ] **Step 1: Failing tests in `bruecken.test.ts`:**
  - `PL-T13 aktuelles bleibt das neue Fenster, wenn das alte spät schließt`: `hinzu(a); schliesst(a); hinzu(b);` dann
    `schliesse(a) === false`, `aktuelles() === b`.
  - `PL-T13 Schließ-Wunsch ohne neues Fenster`: `hinzu(a); schliesst(a)` → `aktuelles() === null`.
  - `PL-N bereit wartet auf die Meldung`: `const p = bereit(a, 1000)`; nach 20 ms ist `p` noch offen (Wettlauf gegen ein
    20-ms-Versprechen); `meldeBereit(a)` → `await p === true`.
  - `PL-N bereit nach der Meldung sofort true`, `PL-N bereit läuft nach ms ab` (`bereit(a, 30)` → `false`),
    `PL-N bereit endet mit dem Fenster` (`schliesse(a)` während des Wartens → `false`).
  - Wächter am Code (`ohneKommentare`):
    - `output-window.ts` enthält kein `outputWindow` mehr;
    - `sendToOutput` ist `async` und wartet auf `lebende.bereit(` vor `webContents.send('output:cmd'`;
    - `openOutputWindow` gibt ein Promise zurück, das auf `lebende.bereit(` wartet;
    - `closeOutputWindow` ruft `lebende.schliesst(`;
    - `OutputView.tsx` ruft `meldeBereit()` nach `onCommand(` im selben Effekt;
    - der Preload sendet `output:bereit`.
- [ ] **Step 2:** Lauf zeigt die neuen Tests rot (Methoden fehlen bzw. Wächter rot).
- [ ] **Step 3: Implementieren:**
  - Die Klasse merkt je Fenster „bereit“ und die Wartenden.
  - `ipcMain.on('output:bereit', (e) => …)` ordnet über `BrowserWindow.fromWebContents(e.sender)` zu.
  - `sendToOutput` sendet nur, wenn das gewartete Fenster danach noch `aktuelles()` und nicht zerstört ist.
  - Bei Ablauf schreibt es eine Log-Zeile `Ausgabefenster meldete nicht bereit (5000 ms)` über `getLog().warn` und sendet
    trotzdem.
  - Mehrere wartende Befehle behalten ihre Reihenfolge.
  - Funktionslisten-Test nach der Regel oben nachführen.
- [ ] **Step 4:** Selbsttest und Typprüfung grün, auch mit `JM_FUNKTIONSLISTE_GIT=1`. Dazu die Mutationsprobe:
  - `schliesst` wirkungslos machen → PL-T13 rot;
  - `bereit` sofort `true` → PL-N rot.
- [ ] **Step 5: Echt-Fenster-Messung** auf Basis von `referenz/plz1-messung.mjs`:
  - a) Show mit einem Video-Cue, Ausgabe zu, ein GO → Video läuft (`currentTime` steigt im Ausgabefenster, ON AIR an), 3 Läufe.
  - b) Ausgabe per `window.jmplay.output.open()` öffnen und im selben Takt GO → Video läuft.
  - c) `close()` und sofort `open()` dreimal hintereinander → danach genau ein Fenster mit `#output` (CDP-Ziele und
    `plz1-fenster.cs`).
  - Ergebnis nach `out/t1-messung.json`.
- [ ] **Step 6: Commit** `fix(player): Ausgabe meldet bereit, nur ein Ausgabefenster (PL-N, PL-T13)`.

### Task 2: Player · Pause hält den Vorlauf, Fernbefehle prüfen die Nummer (PL-11, PL-16a)

**Files:**
- Create: `apps/player/src/renderer/src/lib/vorlauf.ts`, `apps/player/src/renderer/src/lib/fernbefehl.ts`
- Modify: `apps/player/src/renderer/src/store/player.ts:20-37` (Zeitgeber), `:61-105` (`handleRemoteCommand`), `:544-563`,
  `:567-602`
- Modify: `apps/player/src/main/ipc.ts` (`player:protokoll`), `apps/player/src/preload/index.ts`, `R/jmplay.d.ts`
- Test: `apps/player/test/ui/ablauf.test.ts` (neu, reine Tests für `Vorlaeufe` und `pruefeFernNummer`; in `selftest.ts`
  als `await lade('ablauf', …)` vor `abschluss();`), `apps/player/test/ui/store.test.ts`

**Interfaces:**
- Produces (`R/lib/vorlauf.ts`, rein):
  ```ts
  export interface Uhr { jetzt(): number; setze(f: () => void, ms: number): unknown; loesche(t: unknown): void }
  export class Vorlaeufe {
    constructor(uhr?: Uhr)               // Standard: Date.now/setTimeout/clearTimeout
    starte(ms: number, f: () => void): void  // angehalten: nur merken, Restzeit = ms
    anhalten(): void                     // laufende Zeitgeber weg, Restzeit je Vorlauf gemerkt
    fortsetzen(): void                   // jeder gemerkte Vorlauf läuft mit seiner Restzeit
    leeren(): void                       // alles weg, nicht mehr angehalten
    readonly angehalten: boolean
    readonly anzahl: number
  }
  ```
- Produces (`R/lib/fernbefehl.ts`, rein):
  `pruefeFernNummer(verb: 'CUE' | 'STANDBY', n: number, anzahl: number): { ok: true } | { ok: false; hinweis: string; log: string }`.
  Gültig ist `1 ≤ n ≤ anzahl`. Texte:
  - `hinweis`: `Companion „CUE 7“ abgelehnt: Die Show hat 5 Cues.`, bei 1 `… hat 1 Cue.`, bei 0 `… hat keine Cues.`
    (für STANDBY entsprechend).
  - `log`: `Fernbefehl abgelehnt: CUE 7 (Show hat 5 Cues)`.
- Produces (Preload): `window.jmplay.protokolliere(text: string): Promise<void>`. Main: `ipcMain.handle('player:protokoll', …)`
  → `getLog().warn(text)`, nur für `typeof text === 'string'`, auf 500 Zeichen gekürzt.

- [ ] **Step 1: Failing tests `ablauf.test.ts`:**
  - `Vorlaeufe` mit einer Schein-Uhr (fester Zeitwert, Zeitgeber per Liste):
    - `PL-11 Vorlauf startet nach ms`;
    - `PL-11 anhalten nach 300 von 1000 ms: nichts startet; fortsetzen: startet nach weiteren 700 ms, nicht bei 699`;
    - `PL-11 starte im angehaltenen Zustand wartet auf fortsetzen`;
    - `PL-11 leeren: nichts startet mehr, angehalten false`;
    - `PL-11 zweimal anhalten ändert die Restzeit nicht`.
  - `pruefeFernNummer` mit genauen Texten:
    - `PL-16a 5 Cues: 0, 6 und -1 abgelehnt, 1 und 5 gültig`;
    - `PL-16a Einzahl „1 Cue“ und „keine Cues“`;
    - `PL-16a STANDBY im Hinweis und in der Log-Zeile`.
- [ ] **Step 2: Failing tests in `store.test.ts`** (echte Zeitgeber, Cue `P` mit 30 ms Vorlauf):
  - `PL-11 Pause hält den Vorlauf`: GO auf P, sofort Pause, 80 ms warten → kein `audio.play 13`; Weiter, 80 ms warten →
    genau ein `audio.play 13`.
  - `PL-11 Stop in der Pause räumt angehaltene Vorläufe`: GO auf P, Pause, Stop, 80 ms → kein `audio.play 13`. Danach Pause
    und Weiter, 80 ms → weiterhin keiner.
  - `PL-11 GO in der Pause: Vorlauf wartet auf Weiter` (A1).
  - Über den Fernbefehl-Rückruf der Attrappe (Variable `fernbefehl` in `store.test.ts`):
    - `PL-16a cue 0, cue 5 und cue -1 bei 4 Cues abgelehnt`: Standby unverändert, kein `audio.play`, `notice` gleich dem
      Hinweis, `protokolliere` mit der Log-Zeile;
    - `PL-16a standby 0 und 5 abgelehnt`;
    - `PL-16a cue 4 und standby 1 wirken wie heute`.
  - Die Attrappe bekommt `protokolliere`.
- [ ] **Step 3:** Rot nachweisen.
- [ ] **Step 4: Implementieren:**
  - `showTimers` und `clearShowTimers` werden zu einem modulweiten `Vorlaeufe`; `clearShowTimers()` ruft `leeren()`.
  - `showTogglePause` ruft `anhalten()` bzw. `fortsetzen()`.
  - `startNow` ruft `fortsetzen()`, wenn die Show vor dem Start pausiert war.
  - `handleRemoteCommand` prüft `cue` und `standby` mit `pruefeFernNummer`. Bei Ablehnung: `set({ notice: hinweis })`,
    `void window.jmplay.protokolliere(log)`, keine weitere Wirkung.
  - `next` und `prev` bleiben.
- [ ] **Step 5:** Tests grün, Mutationsprobe für `anhalten` und für die Grenze `n > anzahl`, Funktionslisten-Test nachführen.
- [ ] **Step 6: Commit** `fix(player): Pause hält den Vorlauf, Companion lehnt ungültige Cue-Nummern ab (PL-11, PL-16a)`.

### Task 3: Player · Ton-Cue, der nicht lädt (PL-T14)

**Files:**
- Modify: `apps/player/src/renderer/src/lib/show-audio.ts:21-36` (Fehler mit Grund werfen)
- Modify: `apps/player/src/renderer/src/store/player.ts:456-467` (Vorladen ohne unbehandelte Ablehnung), `:536-541`
- Modify: `apps/player/src/renderer/src/lib/oberflaeche.ts` (`PLAYER_TEXTE.cueFehler`)
- Test: `apps/player/test/ui/store.test.ts`, `apps/player/test/ui/show-audio.test.ts` (neu, in `selftest.ts`)

**Interfaces:**
- Consumes: `window.jmplay.protokolliere` (Task 2).
- Produces:
  - `export const SHOW_AUDIO_GRUND = { datei: 'Datei fehlt oder ist nicht lesbar.', format: 'Datei lässt sich nicht als Ton abspielen.' } as const`.
  - `showAudio.preload` wirft `new Error(SHOW_AUDIO_GRUND.datei)`, wenn `fetch` wirft oder `!res.ok` ist, und
    `new Error(SHOW_AUDIO_GRUND.format)`, wenn `decodeAudioData` wirft. `play` reicht das weiter.
  - `PLAYER_TEXTE.cueFehler(nr: number, name: string, grund: string): string` ergibt `Cue 3 „Gong“ spielt nicht: Datei fehlt oder ist nicht lesbar.`
    Der Name ist `label`, sonst `media.fileName`, sonst `—`, wie in der Cue-Zeile (`ShowView.tsx:368`). Die Nummer ist
    `index + 1`.
  - Die Log-Zeile ist der Hinweis mit dem Pfad dahinter: `Cue 3 „Gong“ spielt nicht: Datei fehlt oder ist nicht lesbar. (C:/Medien/m111.wav)`.

- [ ] **Step 1: Failing tests:**
  - `show-audio.test.ts` mit Schein-`fetch` und Schein-`AudioContext`:
    - `PL-T14 404 ergibt den Grund datei`;
    - `PL-T14 fetch wirft ergibt datei`;
    - `PL-T14 decode wirft ergibt format`;
    - `PL-T14 kein Puffer im Cache nach Fehler` (zweiter Versuch fragt `fetch` erneut).
  - `store.test.ts`, `showAudio.play` lehnt mit `SHOW_AUDIO_GRUND.datei` ab:
    - `PL-T14 Cue verlässt laufend`: `playingCueIds` leer, der letzte Bericht an Companion (`berichte`) hat
      `playing: false`, `kopfOnAir` aus.
    - `notice` gleich `cueFehler(1, 'Gong', SHOW_AUDIO_GRUND.datei)`.
    - `protokolliere` genau einmal mit der Log-Zeile aus den Interfaces.
    - Kein Auto-Continue bei einem Cue mit `autoContinue` (A2).
    - `showPaused` wie vor dem Start (A2).
- [ ] **Step 2:** Rot nachweisen.
- [ ] **Step 3: Implementieren:**
  - Im Audio-Zweig von `startNow` hängt ein `.catch` an `showAudio.play`.
  - Das Vorladen in `selectShow` und `refreshShowCues` bekommt `.catch(() => {})`. Die Meldung kommt erst beim GO.
- [ ] **Step 4:** Tests grün, Mutationsprobe (`.catch` ohne Entfernen aus `playingCueIds` → rot), Funktionslisten-Test
  nachführen.
- [ ] **Step 5: Echt-Fenster-Messung:**
  - Ton-Cue importieren, die Datei im Scratchpad löschen, GO.
  - Gemessen wird: Hinweistext im DOM, ON AIR aus nach höchstens 1 s, eine Zeile `spielt nicht` im Log des Testprofils.
  - Ergebnis nach `out/t3-messung.json`.
- [ ] **Step 6: Commit** `fix(player): Ton-Cue, der nicht lädt, meldet sich und gilt nicht als laufend (PL-T14)`.

### Task 4: Player · Pad-Tasten, Löschen und Standby (PL-4, PL-10)

**Files:**
- Modify: `apps/player/src/renderer/src/lib/oberflaeche.ts` (Funktionen und Texte unten)
- Modify: `apps/player/src/renderer/src/views/SoundboardView.tsx:18`, `:48-60` (Prop `panelOffen`, Tastenfilter)
- Modify: `apps/player/src/renderer/src/views/PlayerOberflaeche.tsx:28`, `:190` (`<Soundboard panelOffen={panelOffen} />`)
- Modify: `apps/player/src/renderer/src/store/player.ts:460-468` (`refreshShowCues`: Standby folgt dem Cue)
- Modify: `apps/player/src/renderer/src/views/ShowView.tsx:287` (Rückfrage), `apps/player/src/renderer/src/views/LibraryView.tsx:366`
- Modify: `apps/player/src/main/library.ts` (`mediumNutzung`), `apps/player/src/main/ipc.ts`, Preload, `R/jmplay.d.ts`
- Test: `apps/player/test/ui/oberflaeche.test.ts`, `apps/player/test/ui/store.test.ts`, `apps/player/test/ui/bruecken.test.ts`

**Interfaces:**
- Produces (`R/lib/oberflaeche.ts`, rein):
  - `padTasteErlaubt(e: { ctrlKey: boolean; altKey: boolean; metaKey: boolean; target: EventTarget | null }, z: { dialogOffen: boolean; panelOffen: boolean }): boolean`
    ist falsch bei Strg, Alt oder Meta, bei offenem Dialog oder Panel und bei `istEingabeZiel(target)`.
  - `cueEntfernenFrage(s: { playingCueIds: number[]; videoCue: unknown }, nr: number, name: string): string | null` ergibt
    `null`, wenn nichts läuft, sonst `Die Show läuft. Cue 2 „Einspieler“ trotzdem entfernen?`
  - `mediumEntfernenFrage(titel: string, n: { cues: number; pads: number }): string | null` ergibt `null` bei 0/0. Sonst:
    - `„Gong“ wird von 2 Cues und 1 Pad benutzt. Trotzdem aus der Bibliothek entfernen? Dort steht danach „Medium fehlt“.`
    - Einzahl und Mehrzahl je Teil; ein Teil mit 0 fällt weg.
- Produces (Main): `mediumNutzung(id: number): { cues: number; pads: number }` zählt `show_cues` und `cues` mit dieser
  `media_id`. Über `ipcMain.handle('library:nutzung', …)` und `window.jmplay.library.nutzung(id): Promise<{ cues: number; pads: number }>`.
- `refreshShowCues` behält den Standby auf der Cue-ID, die vorher Standby war. Fehlt sie oder stand der Standby am Ende, gilt
  wie heute `Math.min(standbyIndex, cues.length)`.

- [ ] **Step 1: Failing tests:**
  - `oberflaeche.test.ts`:
    - `PL-4 Strg+C, Alt+C, Meta+C lösen nicht aus`;
    - `PL-4 C ohne Umschalttaste löst aus` (`Shift` erlaubt, A6);
    - `PL-4 offener Dialog oder Panel sperrt`;
    - `PL-4 Eingabefeld sperrt`;
    - `PL-10 cueEntfernenFrage null ohne Lauf, Text mit Lauf (auch nur videoCue)`;
    - `PL-10 mediumEntfernenFrage: 0/0 null, 1/0, 0/1, 2/3 mit genauen Texten`.
  - `store.test.ts`:
    - `PL-10 Standby folgt dem Cue`: Standby auf V (Index 1), A wird entfernt, Cues neu `[V, P, PV]` → `standbyIndex === 0`.
    - `PL-10 Standby folgt beim Umsortieren`.
    - `PL-10 Standby-Cue selbst gelöscht: Cue danach`.
    - `PL-10 Standby am Ende bleibt am Ende`.
  - `bruecken.test.ts` (Wächter):
    - `SoundboardView` ruft `padTasteErlaubt` mit `editSlot != null` und `panelOffen`;
    - `PlayerOberflaeche` reicht `panelOffen` an `Soundboard`;
    - `ShowView` fragt vor `removeShowCue` mit `cueEntfernenFrage`;
    - `LibraryView` fragt vor `removeItem` mit `library.nutzung` und `mediumEntfernenFrage`;
    - `library.ts` zählt beide Tabellen.
- [ ] **Step 2:** Rot nachweisen.
- [ ] **Step 3:** Implementieren, Funktionslisten-Test nachführen.
- [ ] **Step 4:** Tests grün, Mutationsprobe (Strg-Prüfung entfernen → rot; Standby wieder per Index → rot).
- [ ] **Step 5: Commit** `fix(player): Pad-Tasten ohne Strg/Alt, Rückfragen beim Löschen, Standby folgt dem Cue (PL-4, PL-10)`.

### Task 5: Studio-Control · Gateway liest control.json, Panel nennt die Passwort-Datei (SC-S3, SC-S1)

**Files:**
- Modify: `apps/studio-control/src/main/gateway/control-gateway.ts:317-339`, `apps/studio-control/src/main/server.ts:1088`
- Modify: `apps/studio-control/src/main/auth/bootstrap.ts:30-33` (`erstPasswortDatei()`), `apps/studio-control/src/main/index.ts:197-204`
- Modify: `apps/studio-control/src/preload/index.ts`, `R/sync/jms.d.ts`, `R/lib/oberflaeche.ts`, `R/views/Einstellungen.tsx`,
  `R/views/StudioOberflaeche.tsx` (lesen beim Öffnen des Panels, wie die übrigen Brücken)
- Test: `apps/studio-control/test/ui/bruecken.test.ts`, `apps/studio-control/test/ui/oberflaeche.test.ts`, `…/panel.test.tsx`

**Interfaces:**
- Produces:
  - `startControlGateway(appDataDir: string, onMeldung?: (e: FernsteuerungEreignis) => void)`. Der Aufruf in `server.ts`
    übergibt `app.getPath('appData')`, und `appDataDir` geht unverändert an `new SuiteControlServer({ appDataDir, … })`.
  - `erstPasswortDatei(): string` liefert `path.join(app.getPath('userData'), 'first-run-credentials.txt')`;
    `ensureInitialAdmin` nutzt sie.
  - IPC `studio:erstPasswort` → `{ datei: string; vorhanden: boolean }`. `vorhanden` per `fs.existsSync` je Aufruf.
  - Preload `erstPasswort(): Promise<{ datei: string; vorhanden: boolean } | null>` mit `.catch(() => null)`.
  - `browserZugang(e: { datei: string; vorhanden: boolean } | null | undefined): { titel: string; text: string }` mit
    `titel` = `Browser-Zugang`. Texte:
    - vorhanden: `Das Erst-Passwort für „Admin“ steht in der Datei {datei}. Nach der ersten Anmeldung das Passwort ändern und die Datei löschen.`
    - nicht vorhanden: `Keine Datei mit Erst-Passwort vorhanden. Konten verwaltet Setup › Benutzer.`
    - `null` oder `undefined`: `Ort der Passwort-Datei unbekannt.`
  - `OberflaechenStand` bekommt `erstPasswort: { datei: string; vorhanden: boolean } | null | undefined`. `Einstellungen`
    zeigt unter dem Fernsteuerungs-Abschnitt einen `SectionFrame` mit diesem Inhalt. Das Panel gibt es nur im Fenster.

- [ ] **Step 1: Failing tests:**
  - `browserZugang` alle drei Fälle mit genauem Text.
  - Panel-Render zeigt Titel und Pfad.
  - Wächter:
    - `control-gateway.ts` übergibt `appDataDir` an `SuiteControlServer`;
    - `server.ts` ruft `startControlGateway(app.getPath('appData')`;
    - der Preload nutzt `studio:erstPasswort`;
    - `index.ts` antwortet mit `existsSync(erstPasswortDatei())`.
- [ ] **Step 2:** Rot nachweisen.
- [ ] **Step 3:** Implementieren, Funktionslisten-Test nachführen.
- [ ] **Step 4:** Tests grün; Mutationsprobe (`appDataDir` weglassen → Wächter rot).
- [ ] **Step 5: Echt-Fenster-Messung** (Build `out/`, isoliertes Profil, ohne `JM_STUDIO_DEV_ADMIN`):
  - **SC-S1:**
    - Erster Start → Datei `first-run-credentials.txt` im Testprofil, genau ein Konto.
    - `POST /api/login` mit `Admin`/`Admin` → 401; mit leerem Passwort → 401; mit dem Passwort aus der Datei → 200.
    - Das Skript liest die Datei, zeigt das Passwort nie.
    - Das Panel zeigt den Pfad.
    - Ergibt die Messung ein bekanntes oder leeres Passwort, ist das ein Befund: stoppen und als BLOCKED melden.
  - **SC-S3:**
    - `<APPDATA>/JM Production Suite/control.json` im Testprofil auf `secure` mit einem Test-Token (Felder nach
      `packages/control-config/src/index.ts`).
    - Start ohne Blocker auf 8735, vorher geprüft: kein Companion-Prozess.
    - Die Statusleiste meldet den Modus secure.
    - Ein TCP-Client auf 127.0.0.1:8735 sendet ohne Anmeldung den Gateway-Befehl Namensraum `studio`, Verb
      `lighting_blackout`, Argument `on` (Zeilenformat nach `packages/suite-control-protocol`) → abgelehnt. Der
      Licht-Zustand bleibt, und das Audit-Log hat keine Zeile `companion-gateway` (kein Node eingerichtet).
    - Gegenprobe ohne `control.json` (Modus open): derselbe Befehl wirkt wie heute; der Blackout-Zustand wechselt.
  - Ergebnis nach `out/t5-messung.json`.
- [ ] **Step 6: Commit** `fix(studio-control): Gateway folgt control.json, Panel nennt die Passwort-Datei (SC-S3, SC-S1)`.

### Task 6: Studio-Control · nur das eigene Fenster ist ohne Anmeldung Admin (SC-S2)

**Files:**
- Create: `apps/studio-control/src/main/auth/zugang.ts` (rein: nur `node:crypto`)
- Modify: `apps/studio-control/src/main/auth/middleware.ts:11-44`, `:74-95` (Loopback-Regel entfällt)
- Modify: `apps/studio-control/src/main/server.ts:1008-1059` (Ursprung vor `handleApi`, Dev-CORS, Socket.IO)
- Modify: `apps/studio-control/src/main/index.ts:197-204` (`studio:fensterGeheimnis`)
- Modify: `apps/studio-control/src/preload/index.ts`, `R/sync/jms.d.ts`, `R/sync/client.ts`, `R/main.tsx`
- Test: `apps/studio-control/test/ui/zugang.test.ts` (neu, Import in `selftest.ts` vor `abschluss();`), `…/bruecken.test.ts`

**Interfaces:**
- Produces (`main/auth/zugang.ts`):
  - `export const FENSTER_HEADER = 'x-jms-fenster'`
  - `neuesFensterGeheimnis(): string` (32 Bytes, Hex)
  - `istFensterGeheimnis(angeboten: unknown, geheimnis: string): boolean` ist nur bei gleich langer Zeichenkette und
    `crypto.timingSafeEqual` wahr; leer, Zahl oder Array ergibt `false`.
  - `ursprungErlaubt(origin: string | undefined, host: string | undefined, zusaetzlich: readonly string[]): boolean` nach A8.
  - `istEigeneSeite(url: string, devUrl: string | undefined): boolean` ist wahr für `file://…/renderer/index.html` (ohne
    `#`/`?`) und für den Ursprung von `devUrl`.
- Produces (`middleware.ts`):
  - `fensterGeheimnis(): string`, einmal je Prozess erzeugt.
  - `authenticateHttp` setzt `LOOPBACK_ADMIN` nur bei gültigem `X-JMS-Fenster`, sonst gilt der Bearer-Token wie heute.
  - `attachSocketAuth` setzt `LOOPBACK_ADMIN` nur bei gültigem `handshake.auth.fenster`, sonst gilt der Token wie heute.
  - `isLoopbackAddr` entfällt.
- Produces (Renderer `R/sync/client.ts`):
  - `ladeFensterGeheimnis(): Promise<void>` (Browser: kein Preload → bleibt `null`);
  - `handshakeAuth(token: string | null): { token?: string; fenster?: string }`.
  - `connect` nutzt `handshakeAuth`. `apiFetch` schickt `X-JMS-Fenster`, wenn ein Geheimnis da ist, und `Authorization` wie
    heute.
  - `main.tsx` wartet `await ladeFensterGeheimnis()` vor dem ersten Render.
- Server:
  - Vor `handleApi` steht `if (!ursprungErlaubt(req.headers.origin, req.headers.host, devUrspruenge)) → 403 {"error":"origin"}`.
  - Die Dev-CORS-Header kommen nur für erlaubte Ursprünge, mit `Access-Control-Allow-Headers: Content-Type, Authorization, X-JMS-Fenster`.
  - Socket.IO: ohne `cors: { origin: '*' }`, mit `allowRequest: (req, cb) => cb(null, ursprungErlaubt(…))`.
  - `devUrspruenge: string[]` ist leer, wenn `app.isPackaged`.
- IPC `studio:fensterGeheimnis` liefert `fensterGeheimnis()` nur, wenn alles gilt, sonst `null`:
  - `e.sender === mainWindow?.webContents`;
  - `e.senderFrame === e.sender.mainFrame`;
  - `istEigeneSeite(e.senderFrame.url, process.env.ELECTRON_RENDERER_URL)`.

- [ ] **Step 1: Failing tests `zugang.test.ts`:**
  - `istFensterGeheimnis` richtig, falsch, andere Länge, leer, `undefined`, Zahl, Array.
  - `neuesFensterGeheimnis` hat 64 Hex-Zeichen, und zwei Aufrufe ergeben zwei Werte.
  - `ursprungErlaubt`:
    - ohne Origin wahr;
    - `http://192.168.1.5:7778` bei Host `192.168.1.5:7778` wahr, auch in Großschreibung;
    - `http://192.168.1.5:7779` falsch, `http://evil.example` falsch, `null` und `file://` wahr;
    - Vite-Adresse nur mit `zusaetzlich`;
    - Origin gesetzt, Host fehlt → falsch.
  - `istEigeneSeite`:
    - wahr für `file:///C:/x/resources/app.asar/out/renderer/index.html#/video`;
    - falsch für `https://evil.example/renderer/index.html` und für `file:///C:/x/andere.html`;
    - Dev-Ursprung nur mit `devUrl`.
  - `SC-S2 apiFetch schickt Geheimnis und Token` (Schein-`fetch`, Schein-`window.jms.fensterGeheimnis`): beide Header da; im
    Browser (ohne Preload) nur `Authorization`.
  - `handshakeAuth` beide Fälle.
  - Wächter:
    - `middleware.ts` ohne `remoteAddress`, `handshake.address` und `isLoopback`;
    - `server.ts` ohne `origin: '*'`, mit `allowRequest` und `ursprungErlaubt` vor `handleApi(`;
    - `index.ts`-Handler prüft `mainFrame` und `istEigeneSeite`.
- [ ] **Step 2:** Rot nachweisen.
- [ ] **Step 3:** Implementieren, Funktionslisten-Test nachführen. In `docs/ux/funktionslisten/studio-control.md`
  bekommt die Zeile zu Befund 4 („Loopback ist Admin“) den Verweis `Altfehler SC-S2`, ohne dass sich die Zeilenzahl ändert.
- [ ] **Step 4:** Tests grün; Mutationsprobe (Loopback-Regel zurück → Wächter rot; Host-Vergleich weg → `ursprungErlaubt`
  rot).
- [ ] **Step 5: Echt-Fenster-Messung, zweimal: Build `out/` und gepackt (`win-unpacked`, `-c.npmRebuild=false`):**
  - a) Das Fenster ohne Anmeldung zeigt Geräte und legt ein ATEM-Gerät `192.0.2.10` an und entfernt es wieder (HTTP über
    das Fenster). Per CDP-Netzwerk wird gemessen, welcher `Origin` beim Abruf und beim Socket-Handshake ins Ergebnis kommt.
  - b) Node-Skript auf 127.0.0.1:
    - `GET /api/me` ohne Token → 401 (heute 200 „local“);
    - mit `Origin: http://evil.example` → 403;
    - Socket.IO ohne Token → `connect_error unauthorised`;
    - Socket.IO mit fremdem `Origin` → abgelehnt.
  - c) Login mit dem Passwort aus der Datei (Task 5): Token → `/api/me` 200 mit Rolle admin, Socket mit Token verbindet.
  - d) Fenster als zweites Konto mit Rolle Operator anmelden (Konto im Testprofil anlegen) → das Audit-Log schreibt weiter
    „local“ für eine Aktion aus dem Fenster.
  - Ergebnis nach `out/t6-messung.json`.
- [ ] **Step 6: Commit** `fix(studio-control): nur das eigene Fenster ist ohne Anmeldung Admin, fremde Ursprünge abgewiesen (SC-S2)`.

### Task 7: Versionen, Changelog-Entwurf und Texttabelle

**Files:**
- Modify: `apps/player/package.json` (0.10.0), `apps/studio-control/package.json` (0.8.0), `package-lock.json`
  (`npm install --ignore-scripts --package-lock-only`)
- Modify: `packages/suite-manifest/changelog.json`: je App ein neuer Eintrag oben, Datum `2026-11-25` als Platzhalter
- Create: `docs/ux/altfehler-stufe1-texte.md`

**Interfaces:** Consumes alle Texte aus Task 1–6.

- [ ] **Step 1: Texttabelle** nach dem Aufbau von `docs/ux/welle2b-texte.md`:
  - `## Player` (`PLA1…`) und `## Studio-Control` (`SCA1…`), je Zeile Nr., Ort (Datei:Zeile), Text, Befund.
  - `## Log-Zeilen`.
  - `## Changelog` mit `CL-PL1…4` und `CL-SC1…3` (Entwürfe unten).
  - `## Geänderte Bedienung` je Befund in einem Satz.
  - `## Entscheidungen` A1–A10 (Kurzform).
  - Letzte Zeile genau: `Freigabe: ☐ alle Texte wie hier ☐ mit Änderungen (bitte je Nr. notieren)`.
  - Changelog-Entwürfe:
    - CL-PL1 `GO auf einen Video-Cue spielt jetzt auch, wenn die Ausgabe noch geschlossen ist. Es bleibt bei einem Ausgabefenster, auch nach schnellem Schließen und Öffnen.`
    - CL-PL2 `Die Pause hält jetzt auch die Vorlaufzeit an, Weiter setzt sie fort. Ein Ton-Cue, der nicht lädt, meldet das im Fenster und gilt nicht mehr als laufend.`
    - CL-PL3 `Pad-Tasten lösen mit Strg, Alt oder Cmd und bei offenem Dialog oder Panel nicht mehr aus. Beim Löschen anderer Cues bleibt der Standby auf seinem Cue; eine Rückfrage kommt beim Entfernen eines benutzten Mediums und beim Löschen eines Cues während der Show.`
    - CL-PL4 `Companion: CUE und STANDBY mit einer Nummer außerhalb der Show werden abgelehnt, der Standby bleibt stehen.`
    - CL-SC1 `Ohne Anmeldung ist nur noch das eigene Fenster Admin. Browser und Programme melden sich mit einem Konto an, auch auf demselben Rechner; fremde Webseiten werden abgewiesen.`
    - CL-SC2 `Companion-Gateway: Steht die Suite auf „secure“, braucht Companion jetzt den Schlüssel.`
    - CL-SC3 `Das Einstellungs-Panel nennt unter Browser-Zugang den Ort der Datei mit dem Erst-Passwort.`
- [ ] **Step 2: Prüfskript `.superpowers/sdd/2026-11-25-altfehler-stufe1/pruefe-texte.mjs`** (ungetrackt):
  - Jeder Text der Tabelle steht wörtlich im Code der genannten Datei. Platzhalter wie `{n}` gelten als beliebiger Wert.
  - Jede Changelog-Notiz steht wörtlich im neuen Eintrag von `changelog.json`.
  - Kein ASCII-`"` in Notizen.
  - Gegenprobe: Ein absichtlich falscher Tabellentext meldet einen Fehler.
- [ ] **Step 3: Prüfen:**
  - `node -e "JSON.parse(require('fs').readFileSync('packages/suite-manifest/changelog.json','utf8'))"`;
  - das Prüfskript meldet `ok`;
  - die Selbsttests und Typprüfungen beider Apps;
  - Link-Prüfung wie unter „Vor Task 1“ (Exit 0);
  - `git status --short` lesen.
- [ ] **Step 4: Commit** `chore(altfehler): Versionen, Changelog-Entwurf und Texttabelle Stufe 1 (Texte zur Owner-Freigabe)`.

### Task 8: Handbücher, Abnahme-Datei, Bestandsaufnahme, Entscheidungen

**Files:**
- Modify: `packages/cookbook/content/tool-manuals/tool-jm-player.md`, `…/tool-jm-studio-control.md`. Gemeint ist jede Stelle,
  die eine geänderte Bedienung nennt oder nennen muss: Pad-Tasten, Rückfragen, Pause, Browser-Zugang, Anmeldung am eigenen
  Rechner, Companion mit secure.
- Regenerate: `packages/cookbook/cookbook.json` (`npm run cookbook:build`, dann `npm run cookbook:check`, ohne `\r`).
- Create: `docs/ux/ABNAHME-Altfehler-Stufe1.md` (Aufbau wie `docs/ux/ABNAHME-UX-Welle-2b.md`), `docs/ux/altfehler-entscheidungen.md`.
- Modify: `docs/ux/altfehler-inventar.md` (Spalte bzw. Vermerk je Stufe-1-ID: „behoben auf `feat/altfehler`, Task N“),
  `docs/roadmap.md` (Block 5, erster Punkt: „Stufe 1 gebaut auf `feat/altfehler`, Abnahme offen“), `docs/ux/altfehler-stufe1-texte.md`
  (Abschnitt `## Handbuch` mit alt/neu je Stelle).

- [ ] **Step 1: Handbücher nachführen und bauen.**
- [ ] **Step 2: Abnahme-Datei:**
  - Voraussetzungen: Testbauten beider Apps, ein Test-Video, ein Test-Ton, für Studio-Control zwei Konten (Admin, Operator)
    und ein zweites Gerät mit Browser.
  - Je Befund eine Prüfung mit Erwartung, dazu Review Focus 1–5.
  - Player: GO bei geschlossener Ausgabe; Alt+F4 auf der Ausgabe und sofort GO; Pause im Vorlauf; Strg+C im Soundboard;
    Medium löschen, das ein Pad benutzt; Companion `PLAYER CUE 99`; Ton-Cue mit gelöschter Datei.
  - Studio-Control: Browser auf dem Tablet meldet sich an; Browser am Regie-Rechner meldet sich an; das Fenster ohne
    Anmeldung legt ein Gerät an; Companion bei secure mit und ohne Schlüssel.
- [ ] **Step 3: Entscheidungen** A1–A10 und alle weiteren `Ruling:`-Zeilen aus dem Ledger nach
  `docs/ux/altfehler-entscheidungen.md`, Bestandsaufnahme und Roadmap nachführen. Dann prüfen:
  - Link-Prüfung (Exit 0);
  - Prüfskript aus Task 7, zusätzlich „jede `+ `-Zeile des Abschnitts Handbuch steht im Handbuch“ → `ok`.
- [ ] **Step 4: Commit** `docs(altfehler): Handbücher, Abnahme und Bestandsaufnahme Stufe 1`.

---

## Nach der Umsetzung (Controller, nicht in den Tasks)

1. **Testbauten** (`win-unpacked`) beider Apps erzeugen und dem Owner anbieten, nach Task 4 (Player) und nach Task 6
   (Studio-Control). Native Bausteine nur lesend aus der Hauptkopie, `-c.npmRebuild=false`.
2. **Gesamtprüfung** des Branches auf dem stärksten Modell, eine Fix-Welle, Nachprüfung. Die Entscheidungen daraus kommen in
   `docs/ux/altfehler-entscheidungen.md`.
3. **Owner:**
   - Texttabelle freigeben, dann Abnahme nach `docs/ux/ABNAHME-Altfehler-Stufe1.md`.
   - Erst danach Push, PR, Release je App (beide über die CI) und Merge. `main` geht vor den Tags, Tags einzeln.
   - Nach jedem CI-Tag `latestVersion` im Katalog nachlesen.
   - Jeder Schritt nur mit Owner-OK.

## Selbstprüfung

- **Spec-Abdeckung:**
  - SC-S1 → Task 5 (Messung, Panel);
  - SC-S2 → Task 6;
  - SC-S3 → Task 5;
  - PL-N, PL-T13 → Task 1;
  - PL-11, PL-16a → Task 2;
  - PL-T14 → Task 3;
  - PL-4, PL-10 → Task 4;
  - „Abgelehnte Fernbefehle“ (Fenster, Log, Protokoll unverändert) → Task 2 (Kanal `player:protokoll`, kein Protokollwechsel);
  - Texttabelle und Changelog → Task 7;
  - Handbuch → Task 8;
  - die Messpflicht der Spec (PL-N, PL-T13, SC-S2) → Task 1 Step 5 und Task 6 Step 5. PL-T14 und SC-S1/SC-S3 werden
    zusätzlich gemessen.
- **Typen:**
  - `LebendeFenster`, `Vorlaeufe`, `pruefeFernNummer`, `protokolliere`, `SHOW_AUDIO_GRUND`, `cueFehler`, `padTasteErlaubt`,
    `cueEntfernenFrage`, `mediumEntfernenFrage`, `mediumNutzung` und `library.nutzung` tragen in jedem Task dieselben Namen.
  - Ebenso `startControlGateway(appDataDir, onMeldung)`, `erstPasswortDatei`, `browserZugang`, `zugang.ts` (vier
    Funktionen), `fensterGeheimnis`, `ladeFensterGeheimnis` und `handshakeAuth`.
- **Stufe 2** (Caption, Interpreter, Stage Display, Recorder, Presenter, Connect) ist nicht Teil dieses Plans und bekommt
  einen eigenen.
