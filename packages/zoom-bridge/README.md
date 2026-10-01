# @jm/zoom-bridge

## 1 · Was das ist

Ein natives Windows-Sidecar für JM Connect, das die Zoom-Meeting-SDK-Funktionen
anspricht, die Node/Electron nicht selbst können (eigene Win32-Nachrichtenschleife,
`InitSDK`, Rückrufe). Es deckt **Stage 1–3 von 4** der Zoom-Einbindung (Issue #197)
ab: Anmeldung, Meeting-Beitritt, Teilnehmerliste, Rohdaten-Aufnahme-Erlaubnis
(Stage 1) — und, mit dieser Erlaubnis, **Video je abonniertem Teilnehmer als
eigene NDI-Quelle** (Stage 2) samt **Ton in derselben Quelle** (Stage 3, siehe
Abschnitt 7).

**Es schreibt keine Datei.** Weder Cloud- noch lokale Aufzeichnung wird je
gestartet, es entsteht keine Datei auf keiner Platte. Das heißt aber **nicht**
„kein Bild verlässt den Prozess": mit erteilter Erlaubnis und mindestens einem
`videoSubscribe`-Abo verlassen sehr wohl Bild **und Ton** den Prozess — als
**NDI**, nicht als Datei.

> **`StartRawRecording()` heißt nicht, was es heißt — und das hat echte Zeit
> gekostet.** Der Aufruf schreibt **keine Datei**; er ist der Schalter, der
> Zooms Rohdaten-Rückrufe überhaupt erst freigibt. Zooms Schrittfolge lautet:
> im Meeting → Erlaubnis vom Gastgeber → **`StartRawRecording()`** → Bilder
> über die Delegates. Stage 1 hat den Aufruf **ausdrücklich vermieden**, weil
> der Name nach Mitschnitt klingt — mit der Folge, dass in Stage 2 **jedes**
> `videoSubscribe` an `createRenderer()` scheiterte, obwohl der Gastgeber die
> Erlaubnis erteilt hatte (GEMESSEN am 2026-08-13). Seither ruft
> `sessionStartRawRecording()` ihn beim **ersten** Abo, idempotent, je Meeting.
>
> **`HasRawdataLicense()` ist dabei eine Sackgasse.** Auf dem Entwicklungskonto
> liefert es `false`, und das ist **kein Hinderungsgrund**: Zoom hat das alte
> Entitlement-Modell abgeschafft, der Zugriff hängt heute allein an Rolle und
> Erlaubnis **im laufenden Meeting** (Zoom-Staff wörtlich: *„you do not need
> rawdatalicense for this. this is a legacy licensing model."*). Die Brücke
> meldet den Wert weiterhin nach jeder Anmeldung auf stderr — aber als
> **Auskunft**, nicht als Bedingung. Wer ihn für die Ursache hält, sucht am
> falschen Ende; genau das ist hier passiert.

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
(Vorgabe `JM Connect`), `ZOOM_VIDEO_SUBSCRIBE` (kommagetrennte Kennungen) und
`ZOOM_AUDIO_OFF` (Teilmenge davon, abonniert mit `audio:false` — Bild ohne Ton).

Die Logik dahinter steht seit dem Einsatzpaket (01.10.2026) in
`cli/steuerung.mjs` — dieselbe, die im Paket als `zoom-join.exe` läuft
(Abschnitt 10). `test/join.mjs` legt nur fest, was den Prüfstand unterscheidet:
`zoom-bridge.exe` aus `build/Release`, die Zoom-DLLs aus `%ZOOM_SDK_DIR%\x64\bin`,
feste Laufdauer.

**Live-Befehle während des Laufs** (Zeile tippen + Enter, ohne `readline`, damit
Strg+C ein SIGINT bleibt):

| Eingabe | Wirkung |
| --- | --- |
| `<Zahl>` | Bild-Versatz in ms für alle Zoom-Quellen (`videoDelay`). Die **Bridge** prüft 0–1000/ganzzahlig — `4.5` erreicht sie und kommt als `VIDEO_BAD_DELAY` zurück (Drehbuch A3 e). |
| `+<id>` | Bild **und** Ton dieser Kennung abonnieren (720p, Feld `audio` weggelassen = Vorgabefall des Protokolls). |
| `+<id> stumm` | dasselbe mit `audio:false`. |
| `-<id>` | Abo beenden (`videoUnsubscribe`). ⚑ **Bewusste Änderung:** `-<Zahl>` war bis dahin ein (ungültiger) negativer Versatz und heißt jetzt abbestellen. |
| `liste` | Teilnehmer (Format wie der Teilnehmer-Block, samt „(das sind wir)" und `persistentId`-Hinweis), laufende Abos, bestätigter Versatz. |
| `ende` | wie Strg+C: Meeting verlassen, sauber beenden. |
| `hilfe` / `?` | Befehlsübersicht. Eine kurze Fassung steht einmal unter dem ersten Teilnehmer-Block. |

Vor dem Senden eines `+<id>` wird geprüft, was die Bridge sonst mit einer
irreführenden Meldung beantworten würde: **fehlt die Rohdaten-Erlaubnis**, geht
nichts raus, sondern die Erklärung, dass der Gastgeber sie im Zoom-Client erteilen
muss (eine Zeitfrage soll nicht als `VIDEO_NO_PRIVILEGE` erscheinen); eine
**unbekannte Kennung** (nicht im Teilnehmerzustand) wird gemeldet und nicht
gesendet; ab dem **6. gleichzeitigen Abo** kommt eine Warnung (gemessen sind 5),
gesendet wird trotzdem. Tritt jemand während des Laufs bei, steht unter der
`+ Name (id)`-Zeile `abonnieren mit +<id>`.

**Nur anmelden:** `ZOOM_NUR_ANMELDEN=1` macht nur `init` + `auth`, druckt
SDK-Fassung und Anmeldeergebnis und beendet sauber — **ohne Beitritt**, ohne
Meeting-Nummer. Rückgabe `0` bei `AUTHRET_SUCCESS`, `1` bei Ablehnung oder
Zeitüberschreitung. So lässt sich die Einrichtung gegen das echte Zoom prüfen,
ohne einem Meeting beizutreten; im Einsatzpaket heißt das „nur Zugangsdaten
prüfen". (Hier wird enger gewartet als beim Beitritt: nur auf die
Anmelde-Antwort oder das Ende der Bridge — ein `NDI_INIT_FAILED` soll in diesem
Modus nicht als „Anmeldung nicht durchgekommen" erscheinen.)

➜ **Für die noch offenen Abnahmepunkte von Stage 3 gibt es ein Drehbuch:**
[`ABNAHME-STAGE3.md`](ABNAHME-STAGE3.md). Es ordnet die sechs offenen Punkte so,
dass ein Meeting reicht, nennt zu jedem die erwarteten Zeilen und sagt, woran ein
Befund zu erkennen ist, der **nicht** nach einem Fehler aussieht.

**Rückgabewert:**

| Wert | Bedeutung |
| --- | --- |
| `0` | Im Meeting angekommen **und** Rohdaten-Erlaubnis erteilt (`canRecordRaw`). |
| `3` | Im Meeting angekommen, aber **keine** Rohdaten-Erlaubnis (abgelehnt, Zeitüberschreitung, oder bei Strg+C noch nicht entschieden). |
| `4` | **Nicht** ins Meeting gekommen (falsche Nummer, falscher Kenncode, Warteraum/Verbindung ohne Endzustand, SDK-Fehler, …). Die Rohdaten-Frage wurde in diesem Fall nie gestellt. |
| `1` | Eine Vorbedingung fehlt oder ist falsch (`ZOOM_SDK_DIR`, `ZOOM_MEETING_ID`, Zugangsdaten, eine Meeting-Nummer mit Nicht-Ziffern). Bricht sofort ab, **bevor** überhaupt ein Kindprozess startet. |

Ein geglückter Beitritt ohne Rohdaten-Erlaubnis wird bewusst **nicht** mit `0`
quittiert — das wäre genau die Sorte Lüge, die dieses Werkzeug aufdecken soll.

**Gemessen und offen — der Stand, nicht die Absicht:** Stage 1 (Beitritt,
Teilnehmerliste, Rollennamen, Weggang, Rohdaten-Aufnahme-Erlaubnis) ist **in der
Owner-Abnahme am 12.08.2026 gegen ein echtes Meeting gemessen** worden; der
Normalweg mit Warteraum aus Abschnitt 6 stammt wörtlich aus diesen Läufen.
**Stage 2 ist teilweise abgenommen.** Am **13./14.08.2026** gegen ein echtes
Meeting gemessen (Referenz: die acht Punkte in
[`docs/superpowers/specs/2026-08-12-zoom-stage2-video-ndi-design.md`](../../docs/superpowers/specs/2026-08-12-zoom-stage2-video-ndi-design.md), §10):

| Gemessen | Ergebnis |
| --- | --- |
| Bild fließt (`subscribed` → `live`) | ✅ mit Gastgeber **und** mit einem zweiten Gast (Mobilgerät) |
| Kamera aus / an | ✅ mehrfach hintereinander, `cameraOff` ↔ `frames` |
| Gastgeber beendet die Sitzung | ✅ `ended`, Abos werden mit `meetingEnded` abgebaut |
| Abbau nach beendetem Meeting | ✅ `unSubscribe()`/`destroyRenderer()` ohne Absturz |
| Kein Ereignis **nach** `unsubscribed` | ✅ (war ein Befund, siehe `Sub::imAbbau` in `native/video.cpp`) |
| `IsLimitedI420()` | **`true`** — begrenzter Wertebereich, passt zu unserem Schwarz (`Y=16`) |
| `GetRotation()` | **`0`**, auch von einem Mobilgerät |
| **Das Bild angesehen** | ✅ im NDI-Monitor geprüft, Lage und Farben richtig — damit ist `rotation=0` **bestätigt** und nicht nur behauptet |
| Zwei Abos **gleichzeitig** | ✅ zwei eigene Quellen, jede mit eigenem Zustand: eine ging mehrfach `cameraOff`↔`frames`, während die andere durchgehend `live` blieb |
| Der Messlauf meldet ehrlich | ✅ bei zwei Teilnehmern meldete er ausdrücklich „die Grenze wurde **NICHT** erreicht" statt `2` als Obergrenze auszugeben |
| Belastungslauf zu Befund I6 | ✅ **20 von 20** Wechseln mit laufendem Bild, zwei Abos gleichzeitig, kein Absturz (`npm run video-stress`) — **kein Beweis**, siehe unten |
| **Fünf** Abos gleichzeitig | ✅ die Betriebsgröße (Owner: höchstens 5 je Veranstaltung) trägt |
| Weggang und Wiederbeitritt | ✅ über `reboundByName` — Gast ging, kam mit **neuer** Kennung zurück, **dieselbe** Quelle hängte sich an, danach mehrfach Kamera aus/an. Über die `persistentId` greift es **nicht**, siehe Abschnitt 7 |

**Die funktionale Abnahme von Stage 2 ist damit durch.** Offen bleibt genau
eine Sache, und sie bleibt es absichtlich:

- **Befund I6 — und das ist Absicht.** Der Belastungslauf hat 20
  Wechsel unter laufendem Bild überstanden, und das ist der stärkste Beleg, der
  ohne formalen Beweis zu haben ist. Er **beweist nichts**: ein Wettlauf, den
  man 20-mal nicht trifft, ist immer noch ein Wettlauf, und dass Rückrufe
  während des Abbaus laufen, ist **gemessen** (siehe `Sub::imAbbau`). Wer je
  einen `0xC0000005` unmittelbar nach einem `unsubscribed` sieht, hat die
  Antwort — dann muss die Lebensdauer selbst verwaltet werden. Bis dahin steht
  die Annahme als **unbelegt** im Quelltext, nicht als erledigt.

Für Stage 4 vorzumerken (keine Störung, eine Beobachtung): wer über ein Handy
beitritt, erscheint mit dem **Gerätenamen** — die NDI-Quelle hieß im Messlauf
`JM Connect – Zoom Samsung SM-S931B`. Der Quellenname steht bei
`videoSubscribe` absichtlich fest (Umbenennen hieße, die Quelle abzureißen,
siehe Abschnitt 7), ein späteres `renamed` ändert ihn also nicht.

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
| `leave` | — | Verlässt das Meeting, bleibt aber angemeldet. Baut **vorher** alle Video-Abos ab (jedes meldet sich einzeln, siehe Abschnitt 7). |
| `quit` | — | Beendet `zoom-bridge.exe` sauber. |
| `videoSubscribe` | `id`, optional `resolution` | Abonniert das Video eines Teilnehmers als eigene NDI-Quelle — **Einzelheiten in Abschnitt 7**. |
| `videoUnsubscribe` | `id` | Baut dieses Abo ab — **Einzelheiten in Abschnitt 7**. |

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
| `video` | Zustand eines Video-Abos (`id`, `state`, `source`, `reason`, `rebindable`, gemessen auch `rotation`/`limitedRange`) — **Einzelheiten in Abschnitt 7**. |
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
| `reason` | `command` \| `frames` \| `cameraOff` \| `participantLeft` \| `rebound` \| `reboundByName` \| `bufferMismatch` \| `meetingEnded`. |
| `rebindable` | ob das Abo bei einem Wiederbeitritt umgehängt werden kann (`persistentId` des Teilnehmers ist nicht leer). |
| `rotation`, `limitedRange` | **nur vorhanden**, sobald ein Bild sie geliefert hat (`YUVRawDataI420::GetRotation()`/`IsLimitedI420()`) — bei `state:"subscribed"` fehlen sie also immer. Ein Wert wäre dort erfunden, und eine erfundene `0` ließe sich später nicht von einer gemessenen `0` unterscheiden. |

**Elf eigene Fehlerschlüssel** (`where:"video"` bzw. `where:"ndi"`, siehe `OWN_ERROR_NAMES` in `src/protocol.ts`):

Jedes dieser Ereignisse trägt `id` — **außer**, wenn die Befehlszeile gar keine
lesbare Kennung enthielt. Das Fehlen ist dort selbst die Auskunft, und eine
gedruckte `0` wäre eine erfundene Angabe. *(Nachgetragen nach dem Owner-Lauf vom
18.08.2026: dort stand `VIDEO_UNKNOWN_PARTICIPANT` neben zwei abonnierten
Kennungen, ohne zu sagen, welche gemeint war — bei fünf Abos, der festgelegten
Betriebsgröße, ist das nicht mehr zu erraten. `test/command-probe.mjs` prüft
beide Fälle, den mit und den ohne Kennung.)*

| Schlüssel | Ursache |
| --- | --- |
| `videoNoPrivilege` | Die Rohdaten-Erlaubnis fehlt — Voraussetzung, kein Wunsch (dieselbe Erlaubnis wie in Abschnitt 6). |
| `videoUnknownParticipant` | Die Kennung steht nicht in der Teilnehmerliste (dann **mit** `id`) — oder `id` fehlte/war keine gültige Zahl in der Befehlszeile (dann **ohne**). Das Vorhandensein des Feldes trennt die beiden Fälle. |
| `videoAlreadySubscribed` | Die Kennung ist bereits abonniert. |
| `videoNotSubscribed` | `videoUnsubscribe` auf eine nicht abonnierte Kennung. |
| `videoBadResolution` | Der `resolution`-Schlüssel ist keiner der fünf gültigen. |
| `videoBadAudioFlag` | Das Feld `audio` trägt weder `true` noch `false` (z. B. `"audio":"false"` als Zeichenkette oder `"audio":0`). Das Abo wird **nicht** angelegt — genau wie bei `videoBadResolution`. **Fehlt** das Feld, ist das kein Fehler: dann gilt die Vorgabe `true`. |
| `videoRendererFailed` | Zoom-Seite: `createRenderer`/`subscribe` lieferte einen SDK-Fehler. Die Brücke schreibt dabei den SDK-Code auf stderr — ohne ihn sind die beiden Aufrufe nicht zu unterscheiden. |
| `videoRawRecordingFailed` | `StartRawRecording()` ging nicht durch — der Schalter, der Zooms Rohdaten-Rückrufe freigibt (siehe Abschnitt 1; er schreibt **keine** Datei). **Absichtlich ein anderer Name** als `videoRendererFailed`: hier ist das Meeting oder die Rolle schuld, dort das einzelne Abo. |
| `videoSenderFailed` | NDI-Seite: `NDIlib_send_create` schlug fehl. **Absichtlich ein anderer Name** als `videoRendererFailed` — die beiden schicken die Suche an verschiedene Orte. |
| `videoBufferMismatch` | `GetBufferLen()` passt nicht zu Breite×Höhe×3/2 (siehe Falle unten). |
| `ndiInitFailed` | `NDIlib_initialize()` schlug fehl — die NDI-Laufzeit fehlt auf diesem Rechner. Gemeldet beim `init` **und** bei jedem späteren `videoSubscribe` (`where:"ndi"`, nicht `"video"`) — der Abo-Versuch würde sonst `videoSenderFailed` melden und die Suche zu einem einzelnen Abo statt zur fehlenden Installation schicken. |

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
**Jedes Abo meldet sich dabei einzeln** (`state:"unsubscribed"`,
`reason:"command"`), bevor es abgebaut wird: beim `leave` läuft die Bridge
weiter, und eine aufrufende Seite, die ihre Abos führt, hielte sonst Quellen
fest, die es nicht mehr gibt.

**Ein Abo überlebt sein Meeting NICHT.** Endet die Sitzung (`ended`/`failed` —
der Gastgeber beendet sie, oder man wird entfernt), werden alle Abos abgebaut
und **einzeln** gemeldet, mit `reason:"meetingEnded"` — ausdrücklich **nicht**
`command`, denn niemand hat etwas befohlen. GEMESSEN am 2026-08-13, bevor es
diesen Weg gab: das Abo überlebte das Ende seiner Sitzung, der Herzschlag hielt
eine NDI-Quelle am Leben, zu der es kein Meeting mehr gab, und der letzte
gemeldete Stand war `black`/`cameraOff` — „jemand hat die Kamera aus" für eine
beendete Sitzung.

> **Bekannte Grenze, gemessen:** unmittelbar **vor** `disconnecting` schiebt das
> SDK noch ein `RawData_Off` nach, das als `black`/`cameraOff` gemeldet wird.
> Zu diesem Zeitpunkt weiß niemand, dass das Meeting endet — die Statusmeldung
> kommt erst danach. Diese eine Zeile bleibt also mehrdeutig; **der letzte**
> Stand des Abos ist mit `meetingEnded` jedoch eindeutig.

**Ein Abo überlebt einen Wiederbeitritt.** Verlässt ein abonnierter Gast das
Meeting, bleibt sein Abo bestehen (`reason:"participantLeft"`, der Herzschlag
hält es schwarz) — die Quelle darf im Livebetrieb nicht wegbrechen. Kommt
derselbe Gast zurück, wird **derselbe** Sender auf die neue Kennung umgehängt
statt einen zweiten anzulegen — für den Switcher ist nichts passiert.

> **GEMESSEN AM 14.08.2026: `GetPersistentId()` überlebt einen Wiederbeitritt
> nicht.** Derselbe Gast kam mit einer **anderen** Kennung zurück
> (`821B5E…` → `448CB9…`, beide 36 Zeichen, beide wohlgeformt — also zwei
> verschiedene Werte, keine verstümmelte Kopie). Der Weg über die Kennung
> greift für Gäste damit **nie**. Deshalb gibt es einen **zweiten Weg**.

**Zwei Wege dorthin, und sie heißen verschieden**, weil einer schwächer ist:

| `reason` | Grundlage | Wann |
| --- | --- | --- |
| `rebound` | die `persistentId` | wenn Zoom sie durchhält — bei Gästen **gemessen nicht**, siehe oben |
| `reboundByName` | der **Anzeigename** | nur wenn der Name **eindeutig** ist: genau ein Teilnehmer **und** genau ein Abo tragen ihn |

Ist der Name mehrdeutig, passiert **nichts** — die Quelle bleibt schwarz, und
der Grund steht auf stderr. Zwei Gäste mit demselben Anzeigenamen sind kein
Sonderfall, sondern der Regelfall bei Handys (`Samsung SM-S931B`); sie auf gut
Glück umzuhängen wäre eine **Personenverwechslung auf Sendung**, und die ist
teurer als ein Handgriff des Operators (Owner-Entscheidung, 14.08.2026). Wer im
Protokoll `reboundByName` liest, weiß, dass die Zuordnung auf einem Namen
beruht und nicht auf einer Kennung.

**Zwei weitere Prüfstände, beide ohne Meeting:**

```powershell
$env:ZOOM_SDK_DIR = "<Pfad zum entpackten Zoom-Meeting-SDK>"
npm run ndi-probe -w @jm/zoom-bridge
npm run command-probe -w @jm/zoom-bridge
npm run delay-probe -w @jm/zoom-bridge     # Bild-Versatz, siehe Abschnitt 8
npm run delay-test -w @jm/zoom-bridge      # Warteschlange des Versatzes, ohne .exe
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

**Ton (Stage 3).** Der Schalter sitzt am Befehl: `videoSubscribe` kennt ein
optionales Feld `audio` (Vorgabe `true`). Anders als beim Bild gibt es dafür
**kein** eigenes Abo je Teilnehmer — Zooms Ton-Rückruf liefert ohnehin nur eine
`user_id`, kein Renderer-Objekt, das man ab- und aufbauen könnte. Stattdessen
läuft **ein einziges globales Zoom-Ton-Abo** (`audioEnsureSubscribed()`,
`native/audio.cpp`), das für die ganze Meeting-Dauer gilt. Ein nachträgliches
Umschalten an einem laufenden Abo ist **nicht** vorgesehen (Spec Abschnitt 10).

Freigegeben wird dieses Abo beim **Meeting-Ende** (auch wenn der Gastgeber es
beendet) und beim **Prozessende** — und ausdrücklich **nicht** schon, wenn das
letzte Teilnehmer-Abo abgebaut wird, obwohl Spec Abschnitt 4 das so vorsieht.
Diese Abweichung ist bewusst und in `native/audio.h` samt Preis begründet: der
Rückweg `subscribe()` → `unSubscribe()` → `subscribe()` *innerhalb* eines
Meetings ist nirgends gemessen, und ginge er schief, wäre der Preis eine
stumme Sendung statt etwas verschenkter Kopierarbeit.

**Das `audio`-Ereignis** trägt dieselbe `id` wie das zugehörige `video`-Ereignis
und kennt vier Zustände:

| `state` | Bedeutung |
| --- | --- |
| `waiting` | Ton eingeschaltet, noch kein Paket gesehen. |
| `live` | Pakete kommen an. |
| `silent` | seit mindestens 40 ms (Anfangswert, siehe Herzschlag unten) kein Paket mehr — die Quelle sendet weiter, und zwar echte Stille. |
| `off` | kein Ton — per Befehl, weil das SDK ihn verweigert hat, oder weil Abo/Teilnehmer/Meeting weg sind. |

`reason` sagt, WARUM: `command` (Aufrufer hat Ton nicht angefordert oder das
Abo wird auf Befehl abgebaut), `audioUnavailable` (Ton war gewollt, aber
`audioEnsureSubscribed()` ist gescheitert — ein **eigener** Wert, nicht
`command`, siehe `src/protocol.ts`; **für dieses Abo ist das endgültig**:
`audioOn` bleibt dauerhaft aus, nichts versucht es erneut, auch ein
Umhängen nicht. Die einzige Erholung ist `videoUnsubscribe` und ein neues
`videoSubscribe` — wer darauf wartet, dass der Ton von selbst kommt,
wartet vergeblich), `packets` (erstes/erneutes Paket),
`gap` (der Stille-Herzschlag hat zugeschlagen), `participantLeft`,
`meetingEnded`, sowie `rebound`/`reboundByName` — der Ton folgt hier
**demselben Grund** wie das umgehängte Video-Abo, es gibt keinen eigenen
Ton-Mechanismus fürs Umhängen. `sampleRate`/`channels` stehen **nur** dabei,
sobald ein Paket sie geliefert hat — dieselbe Regel wie `rotation`/
`limitedRange` beim Bild: eine erfundene Zahl ließe sich später nicht von einer
gemessenen unterscheiden.

**Vier eigene Fehlerschlüssel** (`where:"audio"`):

| Schlüssel | Ursache |
| --- | --- |
| `audioHelperMissing` | Das SDK gab keinen Ton-Helfer heraus — kein Meeting oder SDK nicht bereit. |
| `audioSubscribeFailed` | Das eine globale Ton-Abo (`helper->subscribe()`) ging nicht durch. |
| `audioBufferMismatch` | Pufferlänge passt nicht zu Kanalzahl × 2 (siehe `AudioPacket::bufferLen`) — **mit** `id`, weil die Aussage genau ein Abo betrifft. **Verworfen wird je Paket, gemeldet je Abo einmal:** das fehlerhafte Paket geht verloren, das nächste wohlgeformte läuft normal durch (und setzt das Abo wieder auf `live`/`packets`); nur die Wiederholung der Meldung wird unterdrückt. Ein Abo geht davon **nicht** dauerhaft still. |
| `audioQueueOverflow` | Die Warteschlange lief über, weil das Leeren nicht nachkam — **ohne** `id`, eine Aussage über die Maschine, nicht über einen Gast: der verwerfende Rückruf weiß gar nicht, zu welchem Abo das Paket gehört hätte. Trägt `dropped` (wie viele Pakete bis zu dieser Meldung verworfen wurden) und kommt **einmal je Meeting**, nicht je Tick (Spec Abschnitt 5) — bei anhaltendem Überlauf gäbe es sonst bis zu 100 Zeilen je Sekunde. Was nach der einen Meldung noch verlorengeht, steht darum in keiner Zahl. |

**Der Stille-Herzschlag** (`videoTick()`, dieselbe 10-ms-Schleife wie beim
Bild): bleibt ein Abo 40 ms ohne neues Paket, sendet die Quelle fortlaufend
**echte Stille** im zuletzt gemessenen Format, damit der Tonstrom nicht
abreißt. (Anders als beim Bild geht es dabei **nicht** um eine eingefrorene
letzte Sekunde: ein NDI-Empfänger wiederholt keinen Ton, wie ein
Bild-Empfänger das letzte Bild hält — er bekäme schlicht nichts. Der
Herzschlag hält den Strom durchgehend und gültig, das ist der ganze Zweck.)

**Wieviel Stille, das rechnet die verstrichene Zeit aus** — nicht die
Tick-Frist. Bis zum 18.08.2026 stand hier `Blockgröße = Tick-Frist`, also
genau 10 ms Ton je Tick; die Schleife (`pumpOnce(); videoTick(); stdin;
Sleep(10)`) braucht aber **immer** mehr als 10 ms, mit Windows'
Standard-Zeitgeberauflösung von 15,6 ms deutlich mehr. Eine längere Stille
lieferte dadurch systematisch zu wenig Ton je Wanduhrzeit. Jetzt führt jedes
Abo mit (`Sub::silenceBisMs`), bis wann sein Strom gefüllt ist, und der Tick
schiebt genau die verstrichene Zeit nach. **Obergrenze 200 ms je Tick,
gewählt und nicht gemessen:** nach einem langen Hänger wird der Rest
fallengelassen statt nachgeholt — Stille trägt keine Information, und sie im
Zwanzigfachen der Echtzeit nachzuschieben ließe den Tonstrom dem Bild
davonlaufen.

**Die 40 ms sind ausdrücklich ein Anfangswert, kein Messergebnis** — Zoom
liefert nach bisheriger Kenntnis etwa alle 10–20 ms, mehr ist dazu nicht
bekannt. Ob der Übergang von Stille auf Ton **nahtlos** ist oder hörbar
knackt, ist Abnahmepunkt 2 der Owner-Abnahme (Spec Abschnitt 9) und am
18.08.2026 **nicht geprüft** — weder mit der alten noch mit der neuen
Rechnung; von dieser Prüfung hängt ab, ob der Wert bleibt.

**Der Weg über die Warteschlange, und warum er nötig ist.** Weil das
Ton-Abo global ist und keinen eigenen Renderer hat, stoppt ein einzelnes
`videoUnsubscribe` den Ton-**Rückruf** für diesen Teilnehmer **nicht** — der
nächste Rückruf für diese `user_id` kommt trotzdem. Der Rückruf
(`onOneWayAudioRawDataReceived`) kopiert sein Paket darum nur in eine globale
Warteschlange (`native/audio.cpp`) und kehrt sofort zurück; `g_subs`
anzufassen wäre ein SDK-Thread, der mit dem Hauptthread um dieselbe Karte
konkurriert. Der Hauptthread schlägt beim Leeren (`videoTick()`) in `g_subs`
nach und verwirft alles, wofür kein aktives, ton-eingeschaltetes, nicht
gerade abgebautes **und nicht bereits weggegangenes** Abo (mehr) existiert —
ein Paket für ein soeben abgebautes Abo, oder für einen Gast, den
`onUserLeft` schon gemeldet hat, ist damit der **erwartete** Fall, keine
Ausnahme, kein Fehler. Der Stille-Herzschlag oben prüft dieselbe Bedingung
aus demselben Grund: ohne sie würde er einem nachweislich abwesenden Gast
weiter Stille senden und `silent`/`gap` melden, obwohl `participantLeft`
diese Quelle bereits auf `off` gesetzt hat — Stille für jemanden, der nicht
da ist, wäre eine Aussage über eine Person, die es im Meeting nicht mehr
gibt.

Zwei verschiedene Reihenfolgen, zwei verschiedene Gründe. **Beim Abbau**
(`videoUnsubscribe`/`videoAbbauAlle`) meldet sich der Ton **vor** der
zugehörigen Video-Zeile mit `state:"off"` ab — die Aussage über den Ton wird
zurückgezogen, bevor die Sache selbst verschwindet. **Beim Weggang**
(`videoParticipantLeft`) ist es umgekehrt: die Video-Zeile (`black`) läuft
zuerst, die Ton-Zeile (`off`) folgt danach — genau wie beim Abonnieren
(`emitAudio` **nach** `emitVideo("subscribed")`), weil hier nicht das Abo
selbst verschwindet, sondern nur ein neuer Zustand gilt, und erst die
Video-Zeile diesen Zustand bekannt macht, worüber die Ton-Zeile dann eine
Aussage sein kann.

**Ohne Meeting geprüft — und zwar genau zwei Ketten.**
`npm run ndi-probe -w @jm/zoom-bridge` (`--ndi-selftest`, siehe oben) sendet
48 kHz Mono-Stille über `sendSilence()` → `sendAudioLocked()` → NDI und weist
mit `@jm/ndi` nach, dass sie **ankommt**. Der Sender ist dabei der **eigene
Selbsttest-Sender der Brücke**, nicht Zoom: belegt ist der NDI-Weg, nicht der
Zoom-Weg. `npm run bool-probe -w @jm/zoom-bridge` belegt, dass der Befehlsleser
`audio:true`/`audio:false` wirklich liest und einen **unlesbaren** Wert meldet,
statt ihn still als „an" durchgehen zu lassen — das sind vier Kommandozeilen,
eine stderr-Zeile je Abo und eine stdout-Zeile.

### Am echten Meeting gemessen (18.08.2026)

**Zoom liefert 32 kHz Mono, 320 Abtastwerte je Paket, rund 100 Pakete je
Sekunde und Sprecher** — also genau 10 ms je Paket. Das steht in keinem
SDK-Header und war bis dahin geraten; die Brücke schreibt es beim ersten Abo
selbst auf stderr mit (`Ton-Messung fuer <id>: …`, einmal je Abo). Damit ist
**Abnahmepunkt 8** beantwortet und die Auslegung der Warteschlange in
`native/audio.cpp` gerechnet statt vermutet.

Die 48 kHz Mono aus `ndi-probe` sind davon zu unterscheiden: das ist der
**eigene Selbsttest-Sender**, nicht Zoom.

**Ein Ton-Abo braucht `JoinVoip()`.** Ohne den Beitritt zum Tonkanal des
Meetings antwortet `subscribe()` des Roh-Ton-Helfers mit
`SDKERR_NOT_JOIN_AUDIO` (32). Video kennt diese Bedingung nicht — deshalb lief
das Bild und der Ton nicht. Siehe `sessionJoinVoip()` in `native/session.cpp`.

> **⚑ Betriebshinweis: die Quelle nicht über Lautsprecher abhören, wenn das
> abonnierte Mikrofon im selben Raum steht.** GEMESSEN am 18.08.2026: der Ton
> war doppelt und zeitversetzt zu hören. Die Brücke war nicht schuld — die
> Messung wies nach, dass sie 101 % der angegebenen Rate sendet (also genau
> ein Paket Fenster-Überhang, keine Verdopplung), und mit Kopfhörern war die
> Dopplung weg. Ursache ist ein akustischer Kreis: die Quelle führt das
> Mikrofon einer Person, und wer dieses Mikrofon über Lautsprecher im selben
> Raum ausgibt, lässt es sich selbst wieder aufnehmen. Das gilt für jedes
> Talent-Mikrofon und ist keine Eigenheit von Zoom oder NDI.

**Owner-Abnahme, Stand 18.08.2026: 5 von 8.** Durch sind 1) hörbarer Ton,
2) `live`↔`silent` fünfmal über drei Abos **ohne Knacken**, 4) zwei Personen
gleichzeitig, im NDI-Monitor **einzeln abgehört und sauber getrennt**,
6) Weggang und Wiederbeitritt (`black`/`off (participantLeft)` →
`subscribed`/`waiting (reboundByName)` unter neuer Kennung, **Quellenname
unverändert**), 8) das Format. Erstmals gemessen: **zwei gleichzeitige
Sprecher = 101 + 102 Pakete/s, kein `AUDIO_QUEUE_OVERFLOW`** — für fünf sagt
das weiterhin nichts.

⚠ **Punkt 5 ist GEFALLEN: der Ton läuft dem Bild hinterher**, geschätzt knapp eine
halbe Sekunde, mit **gleichbleibendem** Versatz.

**Unser eigener Anteil daran ist gemessen und beträgt rund 6 ms.** Die Brücke
schreibt seit dem 18.08.2026 mit, wie lange jedes Ton-Paket zwischen
SDK-Rückruf und Senden in der Warteschlange liegt — das ist die **vollständige**
Verzögerung, die der Ton gegenüber dem Bild hat, denn das Bild geht direkt aus
seinem Rückruf raus. Über drei Zehn-Sekunden-Fenster im Dauerbetrieb: **mittel
5,5–5,9 ms, Maximum 15,6 ms** (ein einzelner Ausreißer bei 58 ms). Die
Senderate lag in allen Fenstern bei **100 %** — es staut sich also nichts auf.

Damit ist der Versatz **nicht unserer**. 6 ms liegen eine Größenordnung unter
der Wahrnehmungsschwelle für nacheilenden Ton (rund 45 ms), und keine
Umstrukturierung dieser Warteschlange könnte daran etwas ändern. Übrig bleiben
Zooms eigene Ton-Zustellung und die Pufferung des NDI-Empfängers.

**Zwei Erklärungen sind auf dem Weg dorthin durch Messung ausgeschieden:**

- *„Die Warteschlange staut."* — Sie wird bei jedem Tick vollständig geleert
  (`while (audioPop(&p))`), und die Messung bestätigt es.
- *„Zoom schüttet beim Abonnieren einen Rückstau aus, der dauerhaft eingebaut
  wird."* — Ein Lauf zeigte tatsächlich **149 %** im Anlauf-Fenster (1,49 s Ton
  in 1 s Wanduhr) und 477 ms Wartezeit. Der nächste Lauf zeigte im selben
  Fenster **100 %**. Ein Burst, der nicht in jedem Lauf auftritt, kann keinen
  Versatz erklären, der in jedem Lauf da ist.

⚑ **Zooms eigenen Anteil kann die Brücke NICHT messen:** `YUVRawDataI420` hat
**keinen Zeitstempel** — nachgesehen, alle vierzehn Methoden. Nur
`AudioRawData` hat `GetTimeStamp()`. Zwei Ströme lassen sich nicht über einen
Zeitstempel ausrichten, den nur einer von beiden hat; die Notiz in
`ndi_sender.cpp`, die genau diesen Weg vorschlug, ist damit **nicht gangbar**.
Bleibt als Abhilfe ein **gemessener, einstellbarer Versatz** — einmal in die
Kamera klatschen, die Differenz ablesen, sie fest einstellen.

#### Die Abhilfe: Bild-Versatz (`videoDelay`, gebaut 30.09.2026)

**Verzögert wird das Bild**, nicht der Ton — der Ton kommt bei Zoom später an,
und was zu früh kommt, muss warten. **Ein Wert für alle Zoom-Quellen** (Owner,
30.09.2026), jederzeit änderbar, auch vor dem Beitritt:

```json
{"cmd":"videoDelay","ms":480}          → {"ev":"videoDelay","ms":480}
{"cmd":"videoDelay","ms":4.5}          → {"ev":"error","where":"video","code":"videoBadDelay"}
```

Erlaubt ist eine **ganze Zahl von 0 bis 1000**; alles andere (Zeichenkette,
Kommazahl, Exponent, negativ, fehlend, Überlauf) beantwortet die Bridge mit
`videoBadDelay` und **lässt den geltenden Wert stehen**. Die Bestätigung nennt
den Wert, der ab jetzt gilt. Die Bridge merkt sich nichts über ihr Ende hinaus
— den kalibrierten Wert hält JM Connect (Stage 4).

**Wie es gebaut ist** (`native/delay_line.h`, `native/ndi_sender.cpp`):

- **Bei 0 ms** und leerer Warteschlange läuft **genau der Weg von vor Punkt 5**:
  das Bild geht direkt aus Zooms Rückruf an NDI. Die Abnahme von Stage 2 bleibt
  damit gültig.
- **Über 0 ms** kopiert der Rückruf das Bild in einen wiederverwendeten Puffer
  und gibt aus, was fällig ist (Ankunft + Versatz ≤ jetzt). **Angestoßen wird die
  Ausgabe vom nächsten eintreffenden Bild** — die Quelle behält Zooms eigenen
  Bildtakt statt des 15-ms-Rasters der Hauptschleife. Nach dem **letzten** Bild
  (Kamera aus, Gast weg) gibt `videoTick()` den Rest aus (`NdiSender::pump()`),
  aber **nur Bilder, die länger als 70 ms überfällig sind**
  (`DelayLine::kNachlaufKarenz`). ⚑ **Berichtigt nach dem Review vom 30.09.2026:**
  die erste Fassung gab in `pump()` alles Fällige aus — und weil der Tick
  (~15 ms) fast immer vor dem nächsten Bild (~33 ms) kam, lief die Quelle
  gerechnet zu 77–100 % im Raster der Schleife, also genau so, wie es der Satz
  davor ausschließt. **Ob es jetzt trägt, zeigt eine Zeile alle 10 s je Quelle:**
  `… <a> Bilder im Takt der Ankunft, <b> im Nachlauf, <c> verworfen` — bei
  laufender Kamera muss b nahe 0 stehen ([ABNAHME-STAGE3.md, A3 c′](ABNAHME-STAGE3.md)).
- **Schwarzbilder** laufen durch dieselbe Warteschlange — sonst überholte das
  Schwarz die letzten Bilder vor dem Kamera-Aus.
- **Ein geänderter Wert wirkt sofort**, auch auf wartende Bilder: vergrößert →
  das Bild steht kurz, verkleinert → es springt. Sind mehr als **3** Bilder auf
  einmal fällig, geht nur das jüngste raus und der Rest wird verworfen (auf
  stderr gemeldet), statt einen Schwall synchroner Sendeaufrufe auf Zooms
  Rückruf-Thread zu legen. **Darum vor der Sendung kalibrieren, nicht während.**
- **Die Meldungen `live`/`black` beschreiben den Eingang**, die Quelle folgt um
  den Versatz später. Das ist kein Widerspruch, sondern die Bauart.

**Speicher**, gerechnet: je Quelle rund `Versatz × 30 Bilder/s × Bildgröße` —
bei 500 ms sind das für 720p rund **21 MB**, für 1080p rund **47 MB**; bei fünf
Quellen 104 bzw. 233 MB. Die Warteschlange ist auf 90 Bilder begrenzt, der
Vorrat wiederverwendbarer Puffer auf 4 (`kMaxSpare`) — ohne diesen Deckel
blieb nach einem kurzen Ausflug auf 1000 ms der Spitzenspeicher bis zum
Abo-Ende belegt (Review 30.09.2026).

**Die Diagnosezeile `Ton-Wartezeit …`** sagt nur ohne Versatz „Das ist UNSER
Anteil am Bild-Ton-Versatz". Mit Versatz nennt sie ihn und sagt ausdrücklich,
dass die Zahl dann **nicht** unser Anteil ist — das Bild wartet ja absichtlich.

**Stand 01.10.2026 — Klatschtest bestanden, Wert offen.** Der Owner hat den
Klatschtest (ABNAHME-STAGE3.md, A3) am 01.10.2026 als **bestanden** gemeldet. Der
dabei eingestellte Wert wurde **nicht notiert**. Er wird im Projekttest mit dem
Pre-Release `zoom-bridge-v0.1.0` nachgemessen (die Start-EXE merkt sich den
zuletzt bestätigten Wert, Abschnitt 10) und **dann hier eingetragen**. Bis dahin
gibt es keinen belegten Vorgabewert — auch keinen geschätzten.

**Geprüft ohne Meeting:** `npm run delay-test` (die Warteschlange mit
eingespeister Uhr, 44 Prüfungen) und `npm run delay-probe` (die Antworten der
echten `.exe` auf zwölf Befehlszeilen; die Obergrenze liest es aus
`src/protocol.ts`, damit TS- und native Grenze nicht auseinanderlaufen). **Nicht** ohne Meeting prüfbar und darum
auf der Owner-Abnahme: ob ein Wert Lippensynchronität herstellt, ob das Bild bei
fünf Quellen ruckelt, und der tatsächliche Speicher
([ABNAHME-STAGE3.md, A3](ABNAHME-STAGE3.md)).

⚑ **Nebenbefund beim Bau, behoben:** `numberFromJson()` las `42.7` als `42` und
`1e3` als `1`, obwohl sein Kopfsatz Nachkommastellen und Exponenten ausschloss.
Das betraf auch die Teilnehmerkennung — eine abgeschnittene Zahl kann auf einen
**fremden**, existierenden Teilnehmer zeigen. Jetzt muss die Zahl an `,` oder
`}` enden; `test/command-probe.mjs` prüft den Fall.

**Was gegen ein echtes Meeting weiterhin nicht geprüft ist, vollständig:**
weder der Überlauf- noch der Mismatch-Pfad, weder Meeting-Ende noch
Prozessende auf dem Ton-Weg, und der Ton-Schalter `audio:false`. Von dem, was
**Zoom** liefert, ist der Pegel offen, ebenso die Summenrate bei **fünf**
gleichzeitig Sprechenden (gemessen sind zwei; dass fünf linear 500 Pakete je
Sekunde ergeben, ist Arithmetik, keine Beobachtung). Das gehört in die

Owner-Abnahme (acht Punkte, siehe
[`docs/superpowers/specs/2026-08-14-zoom-stage3-audio-ndi-design.md`](../../docs/superpowers/specs/2026-08-14-zoom-stage3-audio-ndi-design.md), §9,
und `docs/roadmap.md`).

## 8 · Fünf Fallen, die Zeit kosten

**Nach dem Meeting-Ende ist der Renderer schon tot — ihn anzufassen bringt den
Prozess um.** GEMESSEN am 18.08.2026: sobald der Gastgeber die Sitzung
beendet, endet `zoom-bridge.exe` mit `exitCode 3221225477` = `0xC0000005` =
`STATUS_ACCESS_VIOLATION`. Der Absturz sitzt in `unSubscribe()` auf dem
Video-Renderer; das SDK hat seine Rohdaten-Einrichtung zu diesem Zeitpunkt
bereits abgeräumt. Der Ton-Helfer sagt an derselben Stelle dasselbe, nur
höflicher: sein `unSubscribe()` antwortet `SDKERR_WRONG_USAGE` (2), statt den
Prozess mitzunehmen. `videoAbbauAlle()` trennt darum zwei Lagen — Meeting lebt
noch (`leave`/`quit`/EOF) → ordentlich abmelden; Meeting ist zu Ende → den
Renderer **gar nicht** anfassen, nur den NDI-Sender schließen.

Drei Dinge daran sind es wert, festgehalten zu werden:

1. **Zwei falsche Verdächtige, beide durch Messung ausgeschieden.** Zuerst
   Befund I6 (zerstörte `Sub`-Objekte unter laufenden Rückrufen) — die
   Abbau-Marken zeigten, dass es nie so weit kommt. Dann Re-Entranz (Aufruf
   ins SDK aus dessen eigenem Rückruf) — der Abbau wurde nach `pumpOnce()`
   verlagert, und es stürzte weiter ab. Erst der dritte Anlauf traf.
2. **Der Aufrufort ist Teil der Messung.** In `videoMeetingEnded()` stand eine
   Sicherheitsbegründung mit dem Wort „gemessen statt gehofft". Der Satz war
   wahr — er beschrieb aber `videoShutdownAll()`, aufgerufen aus `main()`.
   Als dieselbe Arbeit später aus dem Rückruf lief, wanderte die Begründung
   mit, ohne dass jemand nachmaß. Sie steht heute als **widerrufen** im
   Quelltext, samt Grund.
3. **Der Absturz war seit Stage 2 da und unsichtbar.** Er hängt nicht am Ton
   (er kam auch mit `audio:false`). Sichtbar wurde er erst, als das Feld
   `detail` — der Rückgabewert des Kindprozesses, den `bridge.ts` längst
   füllte — endlich angezeigt wurde. Stage 2 hat „Meeting-Ende räumt die Abos
   ab" abgenommen; das stimmte auch. Dass der Prozess danach starb, konnte
   niemand sehen. **Ein Wert, der erzeugt und still verworfen wird, lässt
   Abnahmen durchgehen, die nicht durchgehen dürften.**

⚑ **Ungeprüft geblieben und bewusst so:** ob `destroyRenderer()` auf diesem Weg
überlebt hätte. Es zu versuchen hätte einen weiteren abgestürzten Lauf
gekostet. Der Preis ist ein womöglich liegengelassener Renderer je Meeting —
bei höchstens fünf Abos begrenzt, und wahrscheinlich gar keiner, denn dass
`unSubscribe()` abstürzt heißt ja gerade, dass das SDK ihn schon weggeräumt
hat. Die Abbau-Marken auf stderr bleiben stehen: stirbt der Prozess je wieder
hier, ist die letzte gedruckte Marke die einzige Auskunft, die es geben wird.


**Eine fehlende DLL sieht aus wie ein Anmeldefehler.** `zoom-bridge.exe` ist
gegen die Zoom-**und** (seit Stage 2) gegen die NDI-Importbibliothek gebunden.
Der Windows-Lader löst beide beim Prozessstart auf, **vor `main()`** — fehlt
eine davon im `PATH`, stirbt das Kind mit `STATUS_DLL_NOT_FOUND` (`0xC0000135`)
und schreibt **keine einzige Zeile**, weder auf stdout noch auf stderr. Die
Brücke kann dann nur `EXITED_UNEXPECTEDLY` melden, und der Prüfstand rät auf
Zugangsdaten. GEMESSEN am 2026-08-13: genau so ist es passiert, weil das
Verzeichnis der NDI-Laufzeit auf dem Entwicklungsrechner **in keinem** PATH
steht (weder Maschine noch Benutzer) und `test/join.mjs` ein **eigenes** `PATH`
mitgibt, das den Merge in `bridge.ts` gewinnt. Seither setzt `Bridge.start()`
die NDI-Laufzeit **nach** dem Merge selbst dazu (`src/ndi-path.ts`). Bei
„startet nicht, sagt nichts" also **zuerst die DLLs prüfen**, nicht die
Zugangsdaten.

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

- **Kein Mischton.** `onMixedAudioRawDataReceived` bleibt ungenutzt (leerer
  Rumpf in `AudioDelegate`, siehe `native/audio.cpp`) — nur der Ton je
  einzelnem Teilnehmer wird gesendet.
- **Kein Bildschirmton.** `onShareAudioRawDataReceived` bleibt ebenso
  ungenutzt.
- **Kein Dolmetscherton.** `bWithInterpreters` steht fest auf `false` — ein
  `true` würde laut SDK-Kopfsatz die lokalen Dolmetscher-Funktionen
  unbrauchbar machen und damit die Dolmetscher-App (#208) beschädigen.
- **Kein Ton-Rückweg nach Zoom.** `setExternalAudioSource` und der virtuelle
  Mikrofon-Weg bleiben unangetastet; Talkback ist bei Zoom ohnehin nur ein
  gemeinsamer Kanal.
- **Kein Mitschnitt.** `StartRawRecording()` wird zwar gerufen (es ist der
  Schalter für die Rohdaten-Rückrufe, siehe Abschnitt 1), aber es entsteht
  **keine Datei** — weder Cloud- noch lokale Aufzeichnung. Bild läuft
  ausschließlich über das **Pro-Teilnehmer-Abo**
  (`IZoomSDKRenderer::subscribe`, Abschnitt 7), nie über einen Meeting-weiten
  Mitschnitt.
- **Keine Anbindung an `apps/connect`.** Aufrufer sind `test/join.mjs`/
  `test/video-limit.mjs` und — seit dem Einsatzpaket (Abschnitt 10) — die
  Konsolen-Start-EXE `zoom-join.exe` mit Start-Skript. Kein UI.
- **Kein Wiederbeitritt der Bridge selbst.** Bricht die Verbindung ab, endet die
  Bridge; sie verbindet sich nicht von selbst neu. (Ein **einzelnes Video-Abo**
  überlebt dagegen einen Wiederbeitritt **desselben Teilnehmers** — siehe
  Abschnitt 7.)
- **Kein Bündeln der Zoom-/NDI-DLLs — außer im Einsatzpaket.** Im Repo müssen
  beide zur Laufzeit im `PATH` stehen, und sie kommen aus **verschiedenen
  Händen**: `%ZOOM_SDK_DIR%\x64\bin` setzt der Aufrufer (`test/join.mjs`,
  `test/video-limit.mjs` und die Prüfstände tun das für den eigenen Lauf
  selbst), das Verzeichnis der **NDI-Laufzeit** setzt `Bridge.start()` selbst
  (`src/ndi-path.ts`) — dort, weil kein Aufrufer es vergessen darf. Das
  Einsatzpaket (Abschnitt 10) legt die NDI-Laufzeit neben `zoom-bridge.exe`;
  die Zoom-DLLs liegen nur im **privaten** Komplett-Paket bei. Die
  Weitergabe-Lizenz der Zoom-DLLs ist weiterhin **ungeklärt** (Stage 4).

Die vier Ton-Punkte oben sind **ausdrücklich nicht** vorgesehen (Spec Abschnitt 10),
keine spätere Stage — der Rest ist Stage 4 (`docs/roadmap.md`): Integration +
Release.

## 10 · Einsatzpaket (Release)

**Warum es das gibt:** Die Bridge muss in einem echten Projekt getestet werden,
bevor Stage 4 sie in JM Connect einbaut (Owner, 01.10.2026). Dafür wird sie
**einmal einzeln** als Pre-Release `zoom-bridge-v0.1.0` veröffentlicht (Fassung
aus `package.json`). Auf dem Projekt-PC ist **kein Node** installiert — darum
eine eigene Start-EXE und ein Start-Skript statt `npm run join`.

### Bauen

```powershell
$env:ZOOM_SDK_DIR = "<Pfad zum entpackten Zoom-Meeting-SDK>"
$env:NDI_SDK_DIR  = "C:\Program Files\NDI\NDI 6 SDK"
npm run rebuild          -w @jm/zoom-bridge   # zoom-bridge.exe frisch aus dem aktuellen Stand
npm run release:build    -w @jm/zoom-bridge   # nur das öffentliche ZIP
npm run release:komplett -w @jm/zoom-bridge   # zusätzlich das private Komplett-ZIP
```

`scripts/build-release.mjs` bricht ab, wenn `build\Release\zoom-bridge.exe`
**älter** ist als eine Datei in `native\` oder `CMakeLists.txt` — ein Paket mit
alter `.exe` sähe aus wie der neue Stand. Die Quellen der Textdateien liegen in
`paket\` (die Wurzel-`.gitignore` ignoriert **jeden** Ordner namens `release`),
das Ergebnis in `release\` (ignoriert, so gewollt).

### Die zwei ZIPs

| | `JM-Zoom-Bridge-<v>-win-x64.zip` | `JM-Zoom-Bridge-<v>-win-x64-KOMPLETT-NICHT-VEROEFFENTLICHEN.zip` |
| --- | --- | --- |
| Wohin | **öffentliches** GitHub-Release | **nie** veröffentlichen — nur direkt an den Projekt-PC |
| `Zoom-Bridge starten.cmd`, `start.ps1`, `zoom-join.exe`, `LIESMICH.txt` | ✅ | ✅ |
| `bin\zoom-bridge.exe`, `bin\Processing.NDI.Lib.x64.dll` | ✅ | ✅ |
| `LIZENZEN\Processing.NDI.Lib.Licenses.txt` | ✅ | ✅ |
| kompletter Inhalt von `<Zoom-SDK>\x64\bin` (rekursiv, 153 Dateien) in `bin\` | ❌ | ✅ |
| `LIZENZEN\OSS-LICENSE.pdf` (aus dem Zoom-SDK) | ❌ | ✅ |

**Warum die Zoom-DLLs nicht ins öffentliche Paket gehören:** Das Repo ist
öffentlich, und ob Zooms Laufzeit-DLLs weitergegeben werden dürfen, ist
**ungeklärt**. Darum ein **Wächter** im Bau: enthält das öffentliche Paket eine
Datei, deren Name in `<Zoom-SDK>\x64\bin` vorkommt, bricht der Bau ab — geprüft
gegen die **echte** Liste, wenn `ZOOM_SDK_DIR` gesetzt ist, sonst gegen eine feste
Liste der 152 Namen aus SDK 7.1.5.43953; ein zweites Mal am **fertigen** ZIP. Die
NDI-Laufzeit darf hinein: die Suite liefert genau diese DLL schon in ihren
öffentlichen Installern mit (`apps/connect`), der Lizenztext liegt bei. Wer das
öffentliche Paket benutzt, kopiert einmal den Inhalt von `<Zoom-SDK>\x64\bin`
nach `bin\` — oder setzt `ZOOM_SDK_DIR`.

### Die Start-EXE `zoom-join.exe`

`cli/zoom-join.mjs` → `cli/steuerung.mjs` (dieselbe Steuerung wie `test/join.mjs`,
Abschnitt 4) → per esbuild **eine** CommonJS-Datei → Node **Single Executable
Application** (Node 24, `--experimental-sea-config` + `postject`, Signatur von
`node.exe` vorher mit `signtool remove /s` entfernt). Rund 92 MB, weil Node
darin steckt. Zwei Stellen, die ohne Messung falsch gewesen wären:

- **`import.meta.url` gibt es in CommonJS nicht.** `src/bridge.ts` ruft beim
  **Laden** `fileURLToPath(import.meta.url)` — esbuild setzte `{}` ein, und die
  EXE stürbe vor der ersten Zeile. Der Bau ersetzt es durch die URL von
  `__filename`; in einer Single Executable Application ist `__filename` die EXE
  selbst (gemessen, Node 24.16).
- **Wo liegt die Bridge?** `dirname(process.execPath)` ist der Paketordner;
  `zoom-bridge.exe` liegt in `bin\`. Die Zoom-DLLs (`cli/laufzeit.mjs`): liegt
  `bin\sdk.dll` vor → dieses `bin` vorn auf den PATH des Kindes; sonst
  `%ZOOM_SDK_DIR%\x64\bin` (muss `sdk.dll` enthalten); sonst Rückgabe `1` mit
  beiden Auswegen — **bevor** das Kind startet, denn ohne `sdk.dll` stirbt es mit
  `STATUS_DLL_NOT_FOUND`, ohne eine Zeile zu schreiben (Abschnitt 8). Die
  NDI-Laufzeit liegt neben `zoom-bridge.exe`, wo der Windows-Lader zuerst sucht;
  `withNdiRuntimeOnPath` bleibt als Rückfall.

Die EXE läuft **bis `ende`, Strg+C oder Meeting-Ende** (Endlos-Lauf; beendet sie
sich bei Meeting-Ende, ist der Rückgabewert wie bisher `canRecordRaw ? 0 : 3`).
Mit `ZOOM_JOIN_SECONDS` läuft sie wie der Prüfstand eine feste Zeit. Am Ende
schreibt sie den zuletzt **bestätigten** Bild-Versatz in `ZOOM_VERSATZ_DATEI`,
falls gesetzt — so schlägt das Start-Skript den im Projekt nachgestellten Wert
beim nächsten Start vor.

### Das Start-Skript

`Zoom-Bridge starten.cmd` (reines ASCII) ruft `powershell -NoProfile
-ExecutionPolicy Bypass -File start.ps1`. `start.ps1` (Windows PowerShell 5.1,
UTF-8 **mit** BOM — ohne BOM liest 5.1 die Datei in der ANSI-Codepage und
zerlegt die Umlaute; der Bau prüft den BOM) fragt ab: Zugangsdaten-Datei
(geprüft: existiert, gültiges JSON, Client-ID- und Secret-Schlüssel vorhanden —
**ohne** einen Wert zu zeigen; auch die Fehlermeldung von `ConvertFrom-Json` wird
nicht gezeigt, weil sie Inhalt zitiert), Modus (Meeting beitreten / nur
Zugangsdaten prüfen), Meeting-Nummer, Kenncode (verdeckt), Anzeigename,
Bild-Versatz. In `%APPDATA%\JM Zoom Bridge\einstellungen.json` stehen danach
**nur** Zugangsdaten-Pfad, Anzeigename und Versatz — **nie** Meeting-Nummer oder
Kenncode. Es entfernt `ZOOM_SDK_CLIENT_ID`/`_SECRET` aus der Umgebung, startet
`zoom-join.exe` im selben Fenster und deutet danach den Rückgabewert in Klartext.
`-OhneFragen` nimmt alle Werte aus der Umgebung (für automatische Prüfungen).

### Geprüft am 01.10.2026 — und was nicht

Geprüft (ohne einem Meeting beizutreten): die Steuerung samt Live-Befehlen,
Nur-Anmelden, Endlos-Lauf mit Meeting-Ende gegen die Attrappe
(`npm run selftest`); beide ZIPs in einen frischen Ordner **mit Leerzeichen** im
Pfad entpackt, `PATH` ohne Node: das öffentliche ohne `ZOOM_SDK_DIR` → Rückgabe
`1` mit Meldung; mit `ZOOM_SDK_DIR` und `ZOOM_NUR_ANMELDEN=1` → `SDK: 7.1.5
(43953)`, `AUTHRET_SUCCESS`, Rückgabe `0`; das Komplett-Paket ohne `ZOOM_SDK_DIR`
ebenso `0`, danach kein `zoom-bridge.exe`/`zoom-join.exe` mehr im Speicher;
`start.ps1 -OhneFragen` im Komplett-Ordner → Klartext-Deutung, Rückgabe `0`,
`einstellungen.json` ohne Meeting-Nummer und Kenncode.

**Nicht** geprüft: ein **Beitritt** mit `zoom-join.exe` (das ist der
Projekttest), Strg+C im Start-Skript (Windows fragt danach unter Umständen
„Batchvorgang abbrechen (J/N)?" — darum ist `ende` der empfohlene Weg), und die
interaktiven Fragen von `start.ps1` (nur `-OhneFragen` lief automatisch).

### Veröffentlichen

Das Tag `zoom-bridge-v<v>` löst **keinen** CI-Bau aus: `.github/workflows/suite-release.yml`
nimmt `zoom-bridge-v` aus (wie `connect-v`) — es gibt kein `apps/zoom-bridge`,
und die Zoom-/NDI-SDKs fehlen auf GitHub-Runnern. Das Release wird von Hand
angelegt (`gh release create zoom-bridge-v<v> --prerelease`, **nur** das
öffentliche ZIP hochladen). Der Launcher wählt Releases über das Präfix
`<app>-v` eines Katalog-Tools (`apps/launcher/src/main/release-source.ts`,
`services/release-proxy/worker.js`); `zoom-bridge` ist kein Katalog-Tool und kein
Präfix eines solchen — das Tag wird dort nicht als Fassung eines Tools gelesen.
