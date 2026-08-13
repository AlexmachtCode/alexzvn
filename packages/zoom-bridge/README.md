# @jm/zoom-bridge

## 1 · Was das ist

Ein natives Windows-Sidecar für JM Connect, das die Zoom-Meeting-SDK-Funktionen
anspricht, die Node/Electron nicht selbst können (eigene Win32-Nachrichtenschleife,
`InitSDK`, Rückrufe). Es deckt **Stage 1+2 von 4** der Zoom-Einbindung (Issue #197)
ab: Anmeldung, Meeting-Beitritt, Teilnehmerliste, Rohdaten-Aufnahme-Erlaubnis
(Stage 1) — und, mit dieser Erlaubnis, **Video je abonniertem Teilnehmer als
eigene NDI-Quelle** (Stage 2, siehe Abschnitt 7).

**Es schreibt keine Datei.** `StartRawRecording()` — die Meeting-**weite**
Aufnahme-API — steht nirgends im Quelltext; die Erlaubnis wird nur abgefragt
(`CanStartRawRecording()`/`RequestLocalRecordingPrivilege()`), nie für eine
eigene Aufzeichnung genutzt. Das heißt aber **nicht** „kein Bild verlässt den
Prozess": mit erteilter Erlaubnis und mindestens einem `videoSubscribe`-Abo
verlassen sehr wohl Bilder den Prozess — als **NDI**, nicht als Datei. Ton
fehlt weiterhin (Stage 3).

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

**Zwei Wachhunde, zwei Namen.** `JOIN_TIMEOUT` meldet, dass der **erste** Beitritt
nie eine Antwort gebracht hat. `RECONNECT_TIMEOUT` meldet, dass die Verbindung
**nach** einem bereits ruhenden Zustand wieder aufging und nicht zurückfand. Das
ist kein Sonderfall: mit aktiviertem Warteraum ist `connecting → waitingRoom →
reconnecting → connecting → inMeeting` der **Normalweg** (in der Owner-Abnahme in
jedem Lauf gemessen). Der Warteraum ist ruhend und schaltet den ersten Wachhund
ab — ohne den zweiten stünde die Einlassphase unbewacht da. Scharf gestellt wird
nur bei `connecting`/`reconnecting`: `disconnecting` bewacht bereits
`leaveTimeout` im nativen Teil, und `idle` folgt jedem sauber beendeten Meeting —
ein Wachhund darauf wäre ein Daueralarm.

Die Namen (`AUTHRET_…`, `SDKERR_…`, eigene Namen wie `JOIN_TIMEOUT`, `RECONNECT_TIMEOUT`, `LEAVE_TIMEOUT`) entstehen
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

## 7 · Video-Abos (Stage 2)

Je abonniertem Teilnehmer macht `zoom-bridge.exe` einen **eigenen NDI-Sender**
auf. Frames laufen aus dem Zoom-Rückruf direkt in den NDI-Puffer (`native/video.cpp`)
— **kein Umweg über den JS-Heap**, keine Kopie in TypeScript.

**Die zwei Befehle** (`cmd`, an stdin):

| `cmd` | Felder | Wirkung |
| --- | --- | --- |
| `videoSubscribe` | `id` (Teilnehmerkennung, **Zahl**, kein String), optional `resolution` (`90p`/`180p`/`360p`/`720p`/`1080p`, Vorgabe `720p`) | Abonniert das Rohvideo dieses Teilnehmers und legt dafür einen eigenen NDI-Sender an. |
| `videoUnsubscribe` | `id` | Baut das Abo ab und schließt seinen NDI-Sender. |

**Das `video`-Ereignis** (`ev`, von stdout):

| Feld | Bedeutung |
| --- | --- |
| `id` | Teilnehmerkennung (Zahl). |
| `state` | `subscribed` \| `live` \| `black` \| `unsubscribed`. |
| `source` | der **tatsächlich vergebene** NDI-Quellenname (siehe Namensvergabe unten). |
| `reason` | `command` \| `frames` \| `cameraOff` \| `participantLeft` \| `rebound` \| `bufferMismatch`. |
| `rebindable` | ob das Abo bei einem Wiederbeitritt umgehängt werden kann (`persistentId` des Teilnehmers ist nicht leer). |
| `rotation`, `limitedRange` | **nur vorhanden**, sobald ein Bild sie geliefert hat (`YUVRawDataI420::GetRotation()`/`IsLimitedI420()`) — bei `state:"subscribed"` fehlen sie also immer. Ein Wert wäre dort erfunden, und eine erfundene `0` ließe sich später nicht von einer gemessenen `0` unterscheiden. |

**Neun eigene Fehlerschlüssel** (`where:"video"` bzw. `where:"ndi"`, siehe `OWN_ERROR_NAMES` in `src/protocol.ts`):

| Schlüssel | Ursache |
| --- | --- |
| `videoNoPrivilege` | Die Rohdaten-Erlaubnis fehlt — Voraussetzung, kein Wunsch (dieselbe Erlaubnis wie in Abschnitt 6). |
| `videoUnknownParticipant` | Die Kennung steht nicht in der Teilnehmerliste — oder `id` fehlte/war keine gültige Zahl in der Befehlszeile. |
| `videoAlreadySubscribed` | Die Kennung ist bereits abonniert. |
| `videoNotSubscribed` | `videoUnsubscribe` auf eine nicht abonnierte Kennung. |
| `videoBadResolution` | Der `resolution`-Schlüssel ist keiner der fünf gültigen. |
| `videoRendererFailed` | Zoom-Seite: `createRenderer`/`subscribe` lieferte einen SDK-Fehler. |
| `videoSenderFailed` | NDI-Seite: `NDIlib_send_create` schlug fehl. **Absichtlich ein anderer Name** als `videoRendererFailed` — die beiden schicken die Suche an verschiedene Orte. |
| `videoBufferMismatch` | `GetBufferLen()` passt nicht zu Breite×Höhe×3/2 (siehe Falle unten). |
| `ndiInitFailed` | `NDIlib_initialize()` schlug fehl — die NDI-Laufzeit fehlt auf diesem Rechner. |

**Der Herzschlag** (`videoTick()`, läuft im Hauptthread alle 10 ms, direkt nach
`pumpOnce()`): fällt der Bildstrom eines Abos aus, sendet die Quelle statt eines
eingefrorenen letzten Bildes fortlaufend **Schwarz** — ein verschwindender
NDI-Sender wäre im Livebetrieb die gefährlichere Wahl, läge er auf Programm,
risse er weg. Zwei Zahlen sind dabei tragend: **200 ms Nachlauf**, bevor der
Strom als still gilt (kurze Aussetzer flackern damit nicht sofort auf Schwarz),
und **höchstens alle 100 ms** ein neues Schwarzbild (10 Bilder je Sekunde — hält
die Quelle für jeden Empfänger gültig, kostet fast nichts). Ein Abo, das noch
**nie** ein Bild gesehen hat, bleibt dabei auf `subscribed` stehen — es meldet
ausdrücklich **nicht** `cameraOff`, weil das SDK in diesem Fall nichts dergleichen
gesagt hat; `cameraOff` wäre ein SDK-Ereignis, das nie stattfand.

**Die Namensvergabe.** Der Name steht bei `videoSubscribe` fest und ändert sich
nie — einen NDI-Sender umzubenennen hieße, ihn ab- und wieder aufzubauen, die
Quelle wäre mitten in der Sendung weg. Grundform: `JM Connect – Zoom <Name>`
(**ohne** Doppelpunkt nach „Zoom" — gemessen gegen die echte NDI-Laufzeit: sie
ersetzt `:` durch ein Leerzeichen, mit Doppelpunkt entstünde ein doppeltes
Leerzeichen). Kollidiert der Name mit einem bereits offenen Sender (zwei
Teilnehmer mit demselben Anzeigenamen), hängt `uniqueSourceName()` einen
Zusatz `" (2)"`, `" (3)"`, … an, bis er frei ist. **Zusätzlich, und das ist
NDIs Verhalten, nicht unsere Wahl:** die NDI-Laufzeit stellt jedem Quellennamen
den **Rechnernamen in Klammern** voran — gemessen erscheint
`"JM Connect – Zoom Anna"` im Netz als `"RECHNERNAME (JM Connect – Zoom Anna)"`.
Wer im Switcher (oder in einem Prüfstand) auf diesen Namen prüft, muss darum auf
eine **Teilzeichenkette** prüfen, nie auf Gleichheit — `test/ndi-probe.mjs`
macht das exakt so vor (`.includes(ERWARTET)`).

**Die Abbau-Reihenfolge ist tragend.** Beim einzelnen Abo: erst den Renderer
abmelden und abbauen (`unSubscribe()`/`destroyRenderer()`), **dann** den
NDI-Sender schließen — sonst könnte ein bereits unterwegs befindlicher
Bild-Rückruf auf einen schon abgebauten Sender schreiben. Beim gesamten Prozess:
`videoShutdownAll()` läuft **vor** `sessionLeave()`/`DestroyMeetingService` — ein
laufender Renderer hält eine Referenz auf den Meeting-Dienst, ihn danach
abzubauen hieße, auf bereits abgeräumten Zustand zuzugreifen (dieselbe
Fehlerklasse, die in Stage 1 als `0xC0000005` gemessen wurde). Gilt für **beide**
Ausstiege — den `leave`-Befehl **und** das reguläre Prozessende (`main.cpp`).

**Ein Abo überlebt einen Wiederbeitritt.** Verlässt ein abonnierter Gast das
Meeting, bleibt sein Abo bestehen (`reason:"participantLeft"`, der Herzschlag
hält es schwarz) — die Quelle darf im Livebetrieb nicht wegbrechen. Kommt
derselbe Gast zurück (erkannt an einer nicht-leeren `persistentId`, siehe
`rebindable`), wird **derselbe** Sender auf die neue Kennung umgehängt
(`reason:"rebound"`) statt einen zweiten anzulegen — für den Switcher ist
nichts passiert.

**Zwei weitere Prüfstände, beide ohne Meeting:**

```powershell
$env:ZOOM_SDK_DIR = "<Pfad zum entpackten Zoom-Meeting-SDK>"
npm run ndi-probe -w @jm/zoom-bridge
npm run command-probe -w @jm/zoom-bridge
```

`test/ndi-probe.mjs` belegt **ohne Zoom, ohne Meeting und ohne Anmeldung**,
dass die Bridge einen auffindbaren NDI-Sender aufmacht — gesucht wird mit dem
bestehenden `@jm/ndi`-Addon, demselben Code, mit dem der Switcher seine Quellen
findet. `test/command-probe.mjs` belegt **ohne Meeting**, dass der native
Befehlsleser die Teilnehmerkennung wirklich als Zahl liest: ohne `init` bleibt
die Rohdaten-Erlaubnis immer verweigert, `videoNoPrivilege` beweist darum, dass
die Prüfkette die Kennung erfolgreich gelesen hat und eine Stufe weiterkam —
und unterscheidet das damit deterministisch von `videoUnknownParticipant`
(fehlende/unlesbare Kennung). Beide Prüfstände brauchen `%ZOOM_SDK_DIR%\x64\bin`
im `PATH`, obwohl sie `InitSDK` nie rufen: `zoom-bridge.exe` ist gegen die
Zoom-SDK-Importbibliothek gebunden, und der Windows-Lader löst das beim
Prozessstart auf, vor `main()` — ohne den Pfad scheitert der Start mit
`STATUS_DLL_NOT_FOUND` (0xC0000135), einem Zoom-Einrichtungsfehler, der sich
sonst als NDI-Problem tarnen würde.

**Der Messlauf.** `npm run video-limit -w @jm/zoom-bridge` (braucht ein echtes
Meeting mit mehreren fremden Teilnehmern, deren Kameras an sind) misst, wie
viele gleichzeitige Video-Abos das Zoom-SDK tatsächlich zulässt — eine Zahl,
die in keinem SDK-Header steht. Reichen die anwesenden Teilnehmer nicht aus, um
die Grenze zu erreichen, sagt der Lauf das **ausdrücklich**, statt die erreichte
Zahl als Obergrenze auszugeben — eine Untergrenze als Obergrenze zu melden wäre
genau die Sorte Messfehler, die dieses Vorhaben vermeiden will.

## 8 · Drei Fallen, die Zeit kosten

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

**`GetBufferLen()` wird geprüft, nicht geglaubt.** NDI erwartet den I420-Puffer
**zusammenhängend** (Y, dann U, dann V) in einem einzigen Block — genau das
verspricht `YUVRawDataI420::GetBuffer()`, aber ein Zeilenabstand mit Auffüllung
oder eine andere Anordnung würde ein Bild erzeugen, das wie ein **Kameradefekt**
aussieht, nicht wie ein Softwarefehler — man sucht dann am falschen Ende. Der
Bild-Rückruf (`Delegate::onRawDataFrameReceived`, `native/video.cpp`) prüft
darum vor jedem Senden `GetBufferLen() == Breite × Höhe × 3 / 2`; passt es
nicht, bleibt das Abo bestehen (der Herzschlag fällt es auf Schwarz), und
`videoBufferMismatch` wird **einmal je Abo**, nicht einmal je Bild, gemeldet —
sonst ertränken 30 Meldungen je Sekunde jede andere Ausgabe.

## 9 · Was diese Bridge (noch) nicht tut

- **Kein Ton.** `onOneWayAudioRawDataReceived`/`onMixedAudioRawDataReceived`
  werden nirgends gerufen — das ist Stage 3.
- **Kein Meeting-weites `StartRawRecording()`.** Video läuft ausschließlich über
  das **Pro-Teilnehmer-Abo** (`IZoomSDKRenderer::subscribe`, Stage 2, Abschnitt 7)
  — kein Meeting-weiter Mitschnitt, keine Datei (siehe Abschnitt 1).
- **Keine Anbindung an `apps/connect`.** `test/join.mjs`/`test/video-limit.mjs`
  sind die einzigen Aufrufer — kein UI, kein Operator-Workflow.
- **Kein Wiederbeitritt der Bridge selbst.** Bricht die Verbindung ab, endet die
  Bridge; sie verbindet sich nicht von selbst neu. (Ein **einzelnes Video-Abo**
  überlebt dagegen einen Wiederbeitritt **desselben Teilnehmers** — siehe
  Abschnitt 7.)
- **Kein Bündeln der Zoom-/NDI-DLLs.** `%ZOOM_SDK_DIR%\x64\bin` muss zur
  Laufzeit im `PATH` stehen (`test/join.mjs` und die Prüfstände setzen das für
  den eigenen Lauf selbst) — eine Auslieferungs-/Lizenzfrage bleibt für Stage 4
  offen.

Das alles ist Stage 3–4 (`docs/roadmap.md`): Ton je Person, Integration + Release.
