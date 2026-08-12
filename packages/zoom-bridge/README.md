# @jm/zoom-bridge

## 1 · Was das ist

Ein natives Windows-Sidecar für JM Connect, das die Zoom-Meeting-SDK-Funktionen
anspricht, die Node/Electron nicht selbst können (eigene Win32-Nachrichtenschleife,
`InitSDK`, Rückrufe). Es ist **Stage 1 von 4** der Zoom-Einbindung (Issue #197):
Anmeldung, Meeting-Beitritt, Teilnehmerliste, Rohdaten-Aufnahme-Erlaubnis.

**Es zeichnet nichts auf.** `StartRawRecording()` steht nirgends im Quelltext —
Stage 1 fragt nur, ob die Erlaubnis da wäre (`CanStartRawRecording()` /
`RequestLocalRecordingPrivilege()`), sie tatsächlich zu nutzen ist Stage 2/3.

Der tragende Entwurfsgedanke: `zoom-bridge.exe` meldet **Tatsachen** als JSON-Zeilen
auf stdout, alles **Urteilen** (Namen, Zustandsmaschine, Zeitüberschreitungen)
passiert in TypeScript (`src/`). Deshalb sind Protokoll, Zustandsmaschine und die
Prozess-Schicht ohne SDK, ohne Compiler und ohne Meeting prüfbar.

## 2 · Bauen

```powershell
$env:ZOOM_SDK_DIR = "<Pfad zum entpackten Zoom-Meeting-SDK>"
npm run rebuild -w @jm/zoom-bridge
```

`npm install` ruft denselben Riegel automatisch auf (`scripts/maybe-build.mjs`).
**Ohne `ZOOM_SDK_DIR` gesetzt oder auf einem Nicht-Windows-Rechner überspringt der
Riegel den nativen Bau — `npm install` bricht dadurch NICHT ab.** Das ist Absicht:
CI und ein Linux-Codespace haben kein Zoom-SDK und sollen trotzdem installieren
können.

`zoom-bridge.exe` landet danach unter `build/Release/zoom-bridge.exe`
(`binPath()` in `src/bridge.ts` zeigt genau dorthin).

## 3 · Prüfen ohne SDK

```
npm run typecheck -w @jm/zoom-bridge
npm run selftest -w @jm/zoom-bridge
```

Beide laufen **überall** — auch auf Linux, auch ohne Compiler, auch ohne
`ZOOM_SDK_DIR`. Der Selbsttest (`test/selftest.ts`) prüft Protokoll,
Zustandsmaschine und die Prozess-Schicht (`Bridge`) gegen eine Attrappe
(`test/fake-bridge.mjs`), nicht gegen das echte SDK.

## 4 · Prüfen gegen ein echtes Meeting

```powershell
$env:ZOOM_SDK_DIR          = "<Pfad zum entpackten Zoom-Meeting-SDK>"
$env:ZOOM_SDK_CREDENTIALS  = "<Pfad ausserhalb des Repos>\zoom-credentials.json"
$env:ZOOM_MEETING_ID       = "<nur Ziffern>"
$env:ZOOM_MEETING_PASSCODE = "<Kenncode>"
npm run join -w @jm/zoom-bridge
```

`test/join.mjs` baut das JWT, startet `zoom-bridge.exe`, tritt dem Meeting bei,
druckt jedes Ereignis in Klartext und verlässt das Meeting nach `ZOOM_JOIN_SECONDS`
Sekunden wieder (Vorgabe 60, Strg+C beendet früher). Optional: `ZOOM_DISPLAY_NAME`
(Vorgabe `JM Connect`).

**Rückgabewert:**

| Wert | Bedeutung |
| --- | --- |
| `0` | Im Meeting angekommen **und** Rohdaten-Erlaubnis erteilt (`canRecordRaw`). |
| `3` | Im Meeting angekommen, aber **keine** Rohdaten-Erlaubnis (abgelehnt, Zeitüberschreitung, oder bei Strg+C noch nicht entschieden). |
| `4` | **Nicht** ins Meeting gekommen (falsche Nummer, falscher Kenncode, Warteraum/Verbindung ohne Endzustand, SDK-Fehler, …). Die Rohdaten-Frage wurde in diesem Fall nie gestellt. |
| `1` | Eine Vorbedingung fehlt oder ist falsch (`ZOOM_SDK_DIR`, `ZOOM_MEETING_ID`, Zugangsdaten, eine Meeting-Nummer mit Nicht-Ziffern). Bricht sofort ab, **bevor** überhaupt ein Kindprozess startet. |

Ein geglückter Beitritt ohne Rohdaten-Erlaubnis wird bewusst **nicht** mit `0`
quittiert — das wäre genau die Sorte Lüge, die dieses Werkzeug aufdecken soll.

**Ungeprüft gegen ein echtes Meeting:** der gesamte Pfad ab dem Beitritt — Teilnehmerliste,
Rollennamen, Weggang, Rohdaten-Aufnahme-Erlaubnis — ist bis heute ausschließlich gegen die
Attrappe (`test/fake-bridge.mjs`) geprüft. Die Punkte 4–7 der Abnahme in
[`docs/superpowers/specs/2026-08-11-zoom-bridge-geruest-design.md`](../../docs/superpowers/specs/2026-08-11-zoom-bridge-geruest-design.md)
(§12) sind Owner-Schritte, die noch ausstehen.

## 5 · Zugangsdaten

Client-ID und Client-Secret gehören in eine JSON-Datei **außerhalb des Repos**
(`{ "clientId": "…", "clientSecret": "…" }`), auf die `ZOOM_SDK_CREDENTIALS`
zeigt — oder in `ZOOM_SDK_CLIENT_ID`/`ZOOM_SDK_CLIENT_SECRET` direkt in der
Umgebung. `readCredentials()` (`src/jwt.ts`) liest sie ein; steht die Datei
innerhalb des Repos, findet `gitleaks` in CI sie garantiert nicht, weil sie dort
gar nicht erst committet werden kann.

`test/join.mjs` baut daraus im **eigenen** Node-Prozess das JWT (`buildJwt()`) und
übergibt `envRemove: ['ZOOM_SDK_CLIENT_ID', 'ZOOM_SDK_CLIENT_SECRET', 'ZOOM_SDK_CREDENTIALS']`
an `Bridge` — ein eigenes Feld in `BridgeOptions` (`src/bridge.ts`), **kein**
bloßes `delete` auf einem selbst gebauten Umgebungsobjekt: `start()` mischt die
übergebene Umgebung ohnehin ein zweites Mal mit `process.env`
(`{ ...process.env, ...this.opts.env }`) — eine dort bloß **fehlende** Variable
wäre für diesen Merge unsichtbar und käme aus `process.env` darunter zurück.
`envRemove` wird darum **nach** diesem Merge auf das fertige Objekt angewendet
und entfernt die genannten Schlüssel wirklich, bevor `spawn()` läuft. `zoom-bridge.exe`
bekommt also nie Client-ID oder Secret zu sehen — nur das fertige JWT, per
`auth`-Befehl über stdin. Meeting-Nummer und Kenncode kommen ausschließlich zur
Laufzeit aus der Umgebung, nie aus dem Quelltext, und `normalizeMeetingId()`
(`src/protocol.ts`) echot bei einer ungültigen Nummer nie den eingegebenen Wert
— der häufigste Vertipper ist, den Kenncode ins Nummernfeld zu schreiben.

## 6 · Das Protokoll

`zoom-bridge.exe` bekommt Befehle über **stdin** (eine JSON-Zeile pro Befehl) und
meldet Ereignisse über **stdout** (eine JSON-Zeile pro Ereignis) — **stdout ist
Maschine**. Klartext-Diagnose (Fehlermeldungen, unlesbare Zeilen, `kill()`-
Fehlschläge) geht über **stderr** — **stderr ist Mensch**.

**Wichtig:** das Zoom-SDK selbst schreibt unmittelbar nach `InitSDK` die Zeile
`getServiceHub` auf stdout — ungefragt, aus der DLL, nicht aus unserem Code.
Der Zeilenleser (`LineSplitter`/`parseWireEvent` in `src/protocol.ts`) muss
solche fremden, nicht-JSON Zeilen überstehen, ohne die Sitzung abzureißen. Das
ist keine vorsorgliche Härtung, sondern eine gemessene, ständig auftretende
Tatsache — eine kaputte oder fremde Zeile wird geloggt und übersprungen, nie als
Absturz behandelt.

**Befehle** (`cmd`, an stdin):

| `cmd` | Felder | Wirkung |
| --- | --- | --- |
| `init` | — | `InitSDK`, startet die Nachrichtenschleife. |
| `auth` | `jwt` | Anmeldung mit dem fertigen JWT. |
| `join` | `meetingId`, `passcode`, `displayName` | Tritt dem Meeting bei. |
| `leave` | — | Verlässt das Meeting, bleibt aber angemeldet. |
| `quit` | — | Beendet `zoom-bridge.exe` sauber. |

**Die Reihenfolge ist bindend, und der Aufrufer muss sie einhalten:** nach `auth`
**erst das `auth`-Ereignis abwarten**, dann `join` schicken. Wer `init`, `auth`
und `join` zusammen schickt, bekommt beim Beitritt `SDKERR_UNAUTHENTICATION (8)`
— gemessen, deterministisch, im ersten Owner-Lauf gegen ein echtes Meeting.
Ursache: `main()` arbeitet **alle** wartenden stdin-Zeilen in einem Rutsch ab und
pumpt erst danach wieder Nachrichten; `SDKAuth()` beantwortet sich aber
ausschließlich über diese Pumpe (`onAuthenticationReturn`). `Join()` läuft dann
los, während das SDK noch unangemeldet ist. Der native Teil meldet das korrekt
mit Namen — die Reihenfolge herzustellen ist Sache der aufrufenden Seite
(`test/join.mjs` zeigt es vor). Dieselbe Regel gilt für `leave` vor `quit`.

**Ereignisse** (`ev`, von stdout):

| `ev` | Bedeutung |
| --- | --- |
| `ready` | SDK initialisiert, `sdkVersion` mitgeliefert. |
| `auth` | Anmeldeergebnis (`code`, angereichert zu `result`, z. B. `AUTHRET_SUCCESS`). |
| `status` | Meeting-Statuswechsel (`status`, `raw`, `code`, angereichert zu `explain`). |
| `roster` | Vollständige Teilnehmerliste (`list`), ersetzt den bisherigen Stand. |
| `joined` | Ein Teilnehmer (`p`) ist dazugekommen oder wurde aktualisiert. |
| `left` | Ein Teilnehmer (`id`) ist weg. |
| `renamed` | Ein Teilnehmer (`id`) hat einen neuen Namen (`name`). |
| `privilege` | Stand der Rohdaten-Erlaubnis (`canRecordRaw`, `source`, optional `requested`/`denied`/`timedOut`). |
| `error` | Eine benannte Ursache (`where`, `code`, angereichert zu `name`) — nie ein stiller Abbruch. |
| `bye` | `zoom-bridge.exe` beendet sich sauber (siehe Ausnahme unten). |

Die Namen (`AUTHRET_…`, `SDKERR_…`, eigene Namen wie `JOIN_TIMEOUT`, `LEAVE_TIMEOUT`) entstehen
NICHT nativ, sondern ausschließlich in `src/protocol.ts` (`enrich()`) — auf der
Leitung stehen nur Zahlen bzw. eigene Schlüssel wie `joinTimeout`, `leaveTimeout`.

**Rückgabewert von `zoom-bridge.exe` selbst** (der Prozess-Exitcode, nicht der Inhalt einer
JSON-Zeile): normalerweise `0`, auch bei gemeldeten Fehlern — die stehen auf stdout, nicht im
Rückgabewert. **Eine Ausnahme:** läuft `sessionLeave()`s 5-Sekunden-Pumpobergrenze ab, während der
SDK-Thread nachweislich noch abwickelt (`leaveTimeout` auf stdout, `lastStatus` nennt den zuletzt
gesehenen Zustand), überspringt der Abbau `DestroyMeetingService`/`DestroyAuthService`/`CleanUPSDK`
— ein Aufruf während dieses Zustands hat den Prozess GEMESSEN mit `0xC0000005` beendet (Aufgabe 7,
5/5). Der Prozess endet dann über `TerminateProcess` mit dem eigenen Rückgabewert **`2`**, **ohne**
`{"ev":"bye"}` — das wäre eine Lüge über einen sauberen Abgang, den es in diesem Fall nicht gab.
`leaveTimeout` ist dann die letzte verwertbare Information vor dem Prozessende.

## 7 · Zwei Fallen, die Zeit kosten

**`ENABLE_CUSTOMIZED_UI_FLAG`.** Ohne dieses Flag in `InitParam.obConfigOpts`
(siehe `native/session.cpp`) hängt der Beitritt für immer bei `CONNECTING` — im
Stage-0-Spike waren das gemessene 90 Sekunden ohne jede weitere Meldung, bevor
der Wachhund griff. Sieht aus wie ein Netzwerkproblem, ist keins.

**`#if defined(WIN32)`-Wächter in den Rückruf-Schnittstellen.** Die
SDK-Callback-Klassen (`native/callbacks.h`) sind rein virtuell und
plattformabhängig: `ParticipantsListener` hat 25 Methoden (2 davon hinter
`#if defined(WIN32)`), `RecordingListener` hat 13 (3 davon). Ein `grep virtual`
über den Kopfsatz zeigt alle Methoden und **verschluckt die Wächter**: fehlt
eine WIN32-Methode, bleibt die Klasse abstrakt und übersetzt nicht; steht eine
zu viel drin (die es unter Windows nicht gibt), gibt es einen unverständlichen
`C2061` in einer fremden Zeile. Im Spike hat genau das einen Übersetzungsfehler
gekostet.

## 8 · Was Stage 1 nicht tut

- **Kein NDI.** Kein Bild verlässt den Prozess.
- **Keine Rohbilder/kein Ton.** `StartRawRecording()` wird nirgends gerufen.
- **Keine Anbindung an `apps/connect`.** `test/join.mjs` ist der einzige
  Aufrufer — kein UI, kein Operator-Workflow.
- **Kein Wiederbeitritt.** Bricht die Verbindung ab, endet die Bridge; sie
  verbindet sich nicht von selbst neu.
- **Kein Bündeln der Zoom-DLLs.** `%ZOOM_SDK_DIR%\x64\bin` muss zur Laufzeit im
  `PATH` stehen (`test/join.mjs` setzt das für den eigenen Lauf selbst) — eine
  Auslieferungs-/Lizenzfrage bleibt für Stage 4 offen.

Das alles ist Stage 2–4 (`docs/roadmap.md`): Video → NDI, Ton je Person,
Integration + Release.
