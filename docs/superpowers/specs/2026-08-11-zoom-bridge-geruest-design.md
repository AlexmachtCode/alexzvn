# Zoom-Bridge, Stage 1 — das Gerüst (Design)

**Vorhaben:** JM Connect Welle 6.7, Zoom-Einbindung · Issue
[#197](https://github.com/AlexmachtCode/alexzvn/issues/197) · Stage 1 von 4
**Stand:** 2026-08-11 · **Voraussetzung:** Stage 0 ✅ durch
([Spike](../spikes/2026-08-10-zoom-sdk-linkbarkeit/README.md))
**Zielpaket:** `packages/zoom-bridge/` (`@jm/zoom-bridge`)

---

## 1 · Zweck

Stage 1 baut das **Gerüst**, auf dem Stage 2 (Video → NDI) und Stage 3 (Ton je Person) stehen:
ein eigenständiges Windows-Programm `zoom-bridge.exe`, das sich beim Zoom-Meeting-SDK anmeldet,
einem Meeting beitritt, meldet wer darin sitzt, und die Rohdaten-Erlaubnis einholt.

**Am Ende von Stage 1 gilt:** ein Lauf auf der Konsole tritt einem echten Meeting bei, druckt die
Anwesenden mit Namen, holt die Aufnahme-Erlaubnis und verlässt das Meeting sauber wieder — beliebig
oft wiederholbar, ohne dass die Electron-App beteiligt ist.

**Stage 1 zeichnet nichts auf.** `StartRawRecording()` wird nicht gerufen. Die Bridge fragt nur, ob
sie dürfte.

## 2 · Was Stage 0 bereits gemessen hat

Diese Punkte sind belegt und werden **nicht erneut untersucht**:

| Frage | Antwort | Wo gemessen |
|---|---|---|
| Bindung ohne `sdk.lib` | ✅ `dumpbin` → `.def` → `lib /def:` trägt; 23 unverzierte C-Exporte | Lauf 1 |
| `InitSDK` ohne Zugangsdaten | ✅ `SDKError=0`, Dienst-Fabriken liefern gültige Zeiger | Lauf 2 |
| Anmeldung per JWT (HS256) | ✅ `AUTHRET_SUCCESS` | Lauf 3 |
| Antwort kommt **asynchron** | ✅ ohne Win32-Nachrichtenschleife kommt `onAuthenticationReturn` nie an | Lauf 3 |
| Rohdaten-**Konto-Lizenz** (Weg 1) | ❌ fehlt — **wird nicht gebraucht** | Lauf 3 |
| Lokale **Aufnahme-Erlaubnis** (Weg 2) | ✅ `CanStartRawRecording()` 12 → 0 nach Freigabe | Lauf 4 |
| `ENABLE_CUSTOMIZED_UI_FLAG` | ⚑ **Pflicht** — ohne die Zeile hängt der Beitritt bei `CONNECTING` | Lauf 4 |

Offen bleibt allein die **DLL-Weiterverteilungs-Lizenz**. Sie ist kaufmännisch, blockiert Stage 1–3
nicht und wird erst für die Auslieferung in Stage 4 gebraucht.

## 3 · Architektur — der Schnitt

Ein Paket, zwei Hälften, eine scharfe Naht.

**C++ macht nur, was nur C++ kann:** SDK-Aufrufe, Win32-Nachrichtenschleife, Rückrufe entgegennehmen.
Es **meldet Tatsachen und nimmt Befehle — es urteilt nicht.**

**TypeScript urteilt:** Zustandsmaschine, Namensgebung, Bewertung dessen, was ein Fehler ist und was
nur Rauschen. Diese Hälfte ist mit Selbsttests abgedeckt, die **ohne SDK, ohne Compiler und ohne
Meeting** laufen.

Der Grund für diesen Schnitt ist bezahlte Erfahrung: bei `@jm/decklink` liegt die einzige echte
Entscheidungslogik in `src/modes.ts` mit 22 Selbsttests, die den gesamten Branch über grün liefen,
ohne dass je eine Karte im Rechner steckte. Bei Zoom ist die Alternative teurer als dort — jeder
Prüflauf gegen die C++-Seite kostet ein Meeting und eine Freigabe von Hand.

Warum ein **eigenes Programm** und kein Node-Addon: ein `utilityProcess` hat keine
Win32-Nachrichtenschleife, und ein Addon im Electron-Hauptprozess würde dessen Schleife blockieren.
Beide Voraussetzungen — eigene Nachrichtenschleife *und* kein eigenes Fenster — sind am echten SDK
gemessen, nicht angenommen.

## 4 · Dateien und Verantwortlichkeiten

```
packages/zoom-bridge/
  package.json            @jm/zoom-bridge · install → maybe-build · typecheck · selftest · join
  CMakeLists.txt          baut zoom-bridge.exe (kein binding.gyp — das ist kein Node-Addon)
  .gitignore              build/  sdk.lib  sdk.def
  README.md               Nachbauen, Umgebungsvariablen, Rückgabewerte
  scripts/
    maybe-build.mjs       Riegel: nur Windows + ZOOM_SDK_DIR, sonst überspringen
    make-implib.mjs       sdk.dll → dumpbin /exports → sdk.def → lib /def: → sdk.lib
  native/
    main.cpp              Nachrichtenschleife, stdin-Leser, Befehlsverteilung, Herunterfahren
    session.h/.cpp        Lebenszyklus: InitSDK · Auth · Join · Leave · Destroy · CleanUP
    callbacks.h/.cpp      die vier Rückruf-Klassen (Auth · Meeting · Teilnehmer · Aufnahme)
    emit.h/.cpp           ein Ereignis als genau eine JSON-Zeile nach stdout
  src/
    protocol.ts           Befehls-/Ereignistypen + Zeilen-Parser (rein, kennt keinen Prozess)
    state.ts              Zustandsmaschine: aus Ereignissen wird ein Bild der Sitzung
    jwt.ts                HS256-JWT aus clientId/clientSecret (node:crypto)
    bridge.ts             spawn, Zeilen lesen, protocol+state füttern, nach außen melden
    index.ts              öffentliche Fläche für Stage 4, inklusive binPath()
  test/
    selftest.ts           läuft überall — ohne SDK, ohne Compiler, ohne Meeting
    join.mjs              Konsolen-Prüfstand gegen ein echtes Meeting
```

Jede Datei hat eine Aufgabe. `protocol.ts` kennt keinen Prozess und keine Zeit; `state.ts` kennt
keinen Kindprozess; `bridge.ts` kennt keine SDK-Begriffe außer denen aus `protocol.ts`. Damit ist
alles außer `bridge.ts` und dem C++-Teil ohne Aufbau prüfbar.

## 5 · Das Protokoll

**JSON Lines, eine Zeile ein Objekt, UTF-8, `\n` als Trenner.**

`stdout` ist unser **Maschinenkanal** — wir schreiben dort nur JSON. Diagnose und Rauschen laufen
als Klartext über `stderr` und landen in der Logdatei der App. Dasselbe Muster wie in
`apps/connect/src/main/ndi-guests.ts`, wo `stdio: 'pipe'` genau deshalb gesetzt ist: eine gepackte
Windows-GUI-App hat keine Konsole, an die ein Kindprozess erben könnte.

### ⚑ Der Kanal gehört uns nicht allein (gemessen 2026-08-11)

Hier stand zuerst „ein **reiner** Maschinenkanal — dort geht kein Menschentext durch". **Das ist
falsch, und zwar messbar.** Ein Programm, das nur `InitSDK` ruft, gibt aus:

```
getServiceHub                                  <- vom Zoom-SDK, auf STDOUT
{"ev":"ready","sdkVersion":"7.1.5 (43953)"}    <- von uns
{"ev":"bye"}                                   <- von uns
```

Nachgemessen mit getrennter Umleitung: `getServiceHub` kommt auf **stdout**, nicht auf stderr. Die
DLL schreibt in unseren Kanal, und wir können es nicht abstellen.

**Folge:** Die Regel aus Abschnitt 11.1 — *„eine kaputte Zeile darf die Sitzung nicht abreißen"* —
ist damit **keine Vorsichtsmaßnahme mehr, sondern tragend.** Ohne sie stolperte jede Sitzung über
die allererste Zeile. `parseWireEvent` gibt bei Nicht-JSON `null` zurück, `bridge.ts` meldet die
Zeile als Rauschen auf dem Diagnoseweg und überspringt sie. Genau dafür ist das gebaut.

Wer diese Toleranz später „aufräumt", weil sie überflüssig aussieht, bricht die Bridge im ersten
Moment jeder Sitzung.

### 5.1 Befehle (stdin → Bridge)

```ts
type Command =
  | { cmd: 'init' }
  | { cmd: 'auth'; jwt: string }
  | { cmd: 'join'; meetingId: string; passcode: string; displayName: string }
  | { cmd: 'leave' }
  | { cmd: 'quit' };
```

`meetingId` ist eine reine Ziffernfolge ohne Leerzeichen. Die Bridge nimmt sie so, wie sie kommt;
das Aufräumen der Eingabe („111 2222 3333" → `11122223333`) macht `bridge.ts` und ist selbstgetestet.

### 5.2 Ereignisse (Bridge → stdout)

```ts
type MeetingStatus =
  | 'idle' | 'connecting' | 'waitingForHost' | 'waitingRoom' | 'inMeeting'
  | 'disconnecting' | 'reconnecting' | 'ended' | 'failed' | 'other';

interface Participant {
  id: number;             // GetUserID()      — nur innerhalb dieser Sitzung gültig
  name: string;           // GetUserName()
  persistentId: string;   // GetPersistentId() — über Wiederverbindungen stabil, kann leer sein
  self: boolean;          // IsMySelf()
  videoOn: boolean;       // IsVideoOn()
  hasCamera: boolean;     // HasCamera()
  inWaitingRoom: boolean; // IsInWaitingRoom()
  role: 'none' | 'host' | 'coHost' | 'panelist' | 'breakoutModerator' | 'attendee';
}

type WireEvent =
  | { ev: 'ready'; sdkVersion: string }
  | { ev: 'auth'; code: number }
  | { ev: 'status'; status: MeetingStatus; raw: number; code: number }
  | { ev: 'roster'; list: Participant[] }
  | { ev: 'joined'; p: Participant }
  | { ev: 'left'; id: number }
  | { ev: 'renamed'; id: number; name: string }
  | { ev: 'privilege'; canRecordRaw: boolean; requested?: boolean; denied?: boolean }
  | { ev: 'error'; where: string; code: number | string }
  | { ev: 'bye' };
```

**Zwei Schichten, ein Ereignis.** Auf der Rohrleitung stehen **Zahlen**, keine Namen: die Bridge
meldet `{"ev":"error","where":"join","code":12}`. Den Namen (`SDKERR_NO_PERMISSION`) setzt
TypeScript beim Lesen dazu und reicht nach außen ein `BridgeEvent` weiter — dasselbe Objekt plus
`name` und, bei `auth`, plus `result`.

Der Grund ist nicht Sparsamkeit, sondern **eine Tabelle an genau einer Stelle**. Läge der
Namenskatalog in C++, wäre er nur mit SDK und Compiler prüfbar; in TypeScript ist er es überall, und
die Prüfungen aus Abschnitt 11.1 (jeder Code genau ein Name, kein Name doppelt, unbekannter Code
wird nicht gerundet) laufen ohne Meeting. Die C++-Seite schreibt den Klartextnamen zusätzlich auf
**stderr**, damit ein Mensch beim Mitlesen der Rohausgabe nicht Zahlen nachschlagen muss — das ist
Diagnose, kein Protokoll, und darf sich doppeln.

`bye` quittiert `quit`, bevor der Prozess endet — damit die aufrufende Seite ein sauberes Ende von
einem Absturz unterscheiden kann.

**Wann `roster` kommt:** einmal beim Erreichen von `inMeeting` (Vollbild aller Anwesenden), danach
nicht mehr. Alle weiteren Änderungen laufen über `joined`/`left`/`renamed`. Ein zweites `roster`
schickt die Bridge nur nach einem `reconnecting` → `inMeeting`, weil sich die Teilnehmer-IDs dabei
ändern können.

### 5.3 ⚑ Die Bedeutung von `code` hängt vom Status ab

`onMeetingStatusChanged(MeetingStatus status, int iResult)` liefert in `iResult`:

- bei `MEETING_STATUS_FAILED` einen Wert aus **`MeetingFailCode`**,
- bei `MEETING_STATUS_ENDED` einen Wert aus **`MeetingEndReason`**,
- sonst nichts Verwertbares.

Zwei verschiedene Aufzählungen auf demselben Feld. Wer `code: 3` liest, ohne den Status
mitzulesen, liest Kaffeesatz. Deshalb trägt jedes `status`-Ereignis **beide** Werte — `raw` ist der
SDK-Statuswert, `code` das `iResult` —, und `state.ts` löst den Namen erst **paarweise** auf.

### 5.4 ⚑ Zwei Wartezustände, die nicht verschmelzen dürfen

Das SDK unterscheidet:

| SDK | Bedeutung | unser Name |
|---|---|---|
| `MEETING_STATUS_WAITINGFORHOST` | Meeting noch nicht gestartet, wir warten auf den Gastgeber | `waitingForHost` |
| `MEETING_STATUS_IN_WAITING_ROOM` | Meeting läuft, wir stehen im Warteraum und müssen eingelassen werden | `waitingRoom` |

Das sind **zwei verschiedene Handlungsanweisungen** an den Operator: einmal „Meeting starten",
einmal „Bridge einlassen". Sie auf einen Namen zu legen wäre genau der Fehler aus Abschnitt 8.

Unbekannte oder für uns bedeutungslose SDK-Status (`WEBINAR_PROMOTE`, `JOIN_BREAKOUT_ROOM`, …)
werden als `other` gemeldet — **mit** ihrem `raw`-Wert, nie stillschweigend verschluckt.

## 6 · Zustandsmaschine (`state.ts`)

Reine Funktion: `reduce(state, event) → state`. Kein Zeitbegriff, kein Prozess, keine Seiteneffekte.

```ts
interface Session {
  phase: 'start' | 'ready' | 'authed' | 'joining' | 'inMeeting' | 'left' | 'error';
  meeting: MeetingStatus;
  participants: Map<number, Participant>;
  canRecordRaw: boolean;
  privilegeRequested: boolean;
  lastError: { where: string; code: number | string; name: string } | null;
}
```

Festgelegtes Verhalten:

- `roster` **ersetzt** die Teilnehmerkarte vollständig; `joined`/`left`/`renamed` ändern sie punktuell.
- `left` für eine unbekannte ID ist **kein Fehler** — Ereignisse können sich überholen.
- `joined` für eine bekannte ID **aktualisiert** den Eintrag, statt zu verdoppeln.
- `renamed` für eine unbekannte ID wird verworfen und als Rauschen behandelt.
- `phase: 'error'` wird nur aus einem `error`-Ereignis erreicht, nie aus einem Status.
- Ein `status: 'ended'` nach `leave` ist der Normalfall, kein Fehler.

## 7 · Grenzfälle — neun Festlegungen

1. **`ENABLE_CUSTOMIZED_UI_FLAG` (1 << 5) wird in `obConfigOpts.optionalFeatures` gesetzt.** Ohne
   diese Zeile will das SDK ein eigenes Meeting-Fenster; die Bridge hat keines, und der Beitritt
   **hängt** — er scheitert nicht. Gemessen: 90 Sekunden Schweigen bei `CONNECTING`.
2. **Beitritts-Wachhund, 30 Sekunden.** ⚑ Der Wachhund läuft **nicht** gegen „irgendeine
   Statusänderung" — `connecting` kommt sofort, und genau *dort* hing der Spike 90 Sekunden lang.
   Er läuft gegen das **Erreichen eines ruhenden Zustands**: `inMeeting`, `waitingRoom`,
   `waitingForHost`, `failed` oder `ended`. Ist nach 30 Sekunden keiner davon erreicht, meldet die
   Bridge `{"ev":"error","where":"join","code":"timeout","name":"JOIN_TIMEOUT"}` samt dem zuletzt
   gesehenen Status. Ein Hänger muss sich als Hänger melden — ein Wachhund, der beim ersten
   Lebenszeichen einschläft, hätte genau diesen Fall verschlafen.
3. **Warteraum ist kein Fehler.** `waitingRoom` und `waitingForHost` sind Zustände; die Bridge wartet
   und meldet.
4. **Erlaubnis-Choreografie.** Bei `inMeeting`: `CanStartRawRecording()` fragen. Ist sie da → 
   `{"privilege":{"canRecordRaw":true}}`. Fehlt sie und `IsSupportRequestLocalRecordingPrivilege()`
   meldet Erfolg → `RequestLocalRecordingPrivilege()` rufen und
   `{"canRecordRaw":false,"requested":true}` melden. Freigabe → `canRecordRaw:true`. Ablehnung →
   `{"canRecordRaw":false,"denied":true}`. Steht beim Gastgeber
   `IsAutoAllowLocalRecordingRequest()` auf an, kommt die Freigabe ohne Klick zurück.
5. **Stage 1 zeichnet nichts auf.** `StartRawRecording()` wird nicht gerufen.
6. **Aufräumen in dieser Reihenfolge:** `Leave` → Nachrichtenschleife weiterpumpen, bis der Status
   `ended`/`idle` meldet oder 5 Sekunden vergangen sind → `DestroyMeetingService` →
   `DestroyAuthService` → `CleanUPSDK`. Der Spike ist mit `0xC0000005` abgestürzt, weil er mitten in
   `CONNECTING` sofort zerstört hat.
7. **Verbindungsabbruch** wird als `reconnecting` gemeldet. **Kein automatischer Wiederbeitritt** in
   Stage 1 — diese Entscheidung gehört zur Operator-UI in Stage 4 und wäre hier geraten.
8. **stdin-EOF bedeutet `quit`.** Stirbt die aufrufende Seite, darf keine verwaiste Bridge in einem
   fremden Meeting sitzen bleiben. Ohne diese Regel wird der Grenzfall peinlich statt nur ärgerlich.
9. **Alle rein virtuellen Rückrufe werden umgesetzt**, samt der `#if defined(WIN32)`-Wächter in
   `IMeetingParticipantsCtrlEvent` (rund 30 Methoden), `IMeetingServiceEvent`,
   `IMeetingRecordingCtrlEvent` und `IAuthServiceEvent`. Nicht gebrauchte bekommen einen leeren
   Rumpf. ⚑ **`grep virtual` über den Kopfsatz lügt** — es zeigt alle Methoden und verschluckt die
   Präprozessor-Wächter. Im Spike hat das einen `C2061` gekostet.

## 8 · Fehler: eine Ursache, ein Name

**Regel:** Jeder gemeldete Fehler trägt seine **Zahl und seinen Namen**, und **zwei verschiedene
Ursachen bekommen nie dieselbe Meldung.**

Diese Regel ist nicht dekorativ. In der DeckLink-Woche hat ein weggeworfener HRESULT vier
verschiedene Ursachen zu einer Meldung verschmolzen — „Treiber fehlt", obwohl er installiert war.
Der Fehler kostete einen halben Tag, und er war im Code unsichtbar, weil die Meldung *plausibel*
klang.

Umgesetzt heißt das:

- Kein `SDKError` wird verworfen. Jeder Rückgabewert wird geprüft und im Fehlerfall gemeldet.
- Der Namenskatalog liegt in **`src/protocol.ts`**, gepflegt aus `zoom_sdk_def.h` (`SDKERR_SUCCESS`=0,
  `SDKERR_UNINITIALIZE`=7, `SDKERR_NO_PERMISSION`=12, …). Ein unbekannter Code wird als
  `SDKERR_UNKNOWN(<n>)` gemeldet — **nie** als der nächstähnliche bekannte.
- `where` benennt die Stelle (`init`, `auth`, `join`, `leave`, `privilege`, `roster`), damit derselbe
  Code an zwei Stellen unterscheidbar bleibt.
- `AuthResultName` ist die Aufzählung aus `auth_service_interface.h`: `AUTHRET_SUCCESS`,
  `AUTHRET_KEYORSECRETEMPTY`, `AUTHRET_KEYORSECRETWRONG`, `AUTHRET_ACCOUNTNOTSUPPORT`,
  `AUTHRET_ACCOUNTNOTENABLESDK`, `AUTHRET_UNKNOWN`, `AUTHRET_SERVICE_BUSY`, `AUTHRET_NONE`,
  `AUTHRET_OVERTIME`, `AUTHRET_NETWORKISSUE`, `AUTHRET_CLIENT_INCOMPATIBLE`,
  `AUTHRET_JWTTOKENWRONG`, `AUTHRET_LIMIT_EXCEEDED_EXCEPTION` — ebenfalls in `protocol.ts`, aus
  demselben Grund.

## 9 · Zugangsdaten und Datenschutz

- Das **JWT baut TypeScript** (`src/jwt.ts`, `node:crypto`, HS256 über
  `{ appKey, iat, exp, tokenExp }`). Client-ID und Secret erreichen den C++-Teil **nie** — die Bridge
  sieht ausschließlich das fertige JWT.
- `join.mjs` reicht das JWT über die Umgebung des Kindprozesses und **entfernt dabei**
  `ZOOM_SDK_CLIENT_ID`, `ZOOM_SDK_CLIENT_SECRET` und `ZOOM_SDK_CREDENTIALS` aus dessen Umgebung.
  Gleiche Setzung wie `run-auth.mjs` im Spike.
- Zugangsdaten liegen in einer Datei **außerhalb des Repos**. Grund: in der CI läuft ein
  gitleaks-Scan über den Dateibaum — was nicht im Baum liegt, kann nicht committet werden.
- **Meeting-Nummer und Kenncode kommen nie ins Repo**, weder als Beispiel noch im Test. Sie kommen
  aus der Umgebung.
- Kein Ereignis und keine Diagnosezeile enthält JWT, Secret oder Kenncode. Ein Selbsttest prüft das.

## 10 · Bauen

- **CMake**, kein `binding.gyp`: `zoom-bridge.exe` ist ein eigenes Programm, kein Node-Addon.
  `node-gyp` ist auf `.node`-Ausgabe und Electron-ABI verdrahtet und passt hier nicht.
- **`scripts/maybe-build.mjs`** ist derselbe Riegel wie bei `@jm/decklink`: nicht-Windows →
  überspringen; kein `ZOOM_SDK_DIR` → überspringen mit Hinweis, wie man es nachholt. `npm install`
  bricht damit weder in CI noch im Linux-Codespace.
- **`sdk.lib` und `sdk.def` entstehen zur Bauzeit** aus `sdk.dll` und kommen **nicht** ins Repo. Sie
  sind an die DLL-Fassung gebunden; eine mitcommittete Lib liefe bei einem SDK-Wechsel still daneben.
  Dasselbe Muster wie bei `@jm/decklink`, wo die Header per MIDL aus der IDL entstehen.
- **`typecheck`-Skript im Paket** (`tsc --noEmit`). Ohne das prüft CI den TypeScript-Kopf in Stage 1
  überhaupt nicht, weil ihn noch keine App importiert — `npm run typecheck --workspaces
  --if-present` liefe schlicht daran vorbei.
- CI baut nichts Natives: `ci-checks.yml` läuft mit `npm ci --ignore-scripts`, der `install`-Haken
  springt dort gar nicht erst an.
- Zur Laufzeit muss `%ZOOM_SDK_DIR%\x64\bin` im `PATH` stehen. Das Bündeln der DLLs ist Stage 4.

## 11 · Prüfung

### 11.1 Selbsttests — laufen überall

`npm run selftest -w @jm/zoom-bridge` (`node --experimental-strip-types`), ohne SDK, ohne Compiler,
ohne Meeting, auch auf Linux:

- **JWT:** HS256 gegen einen festen Vektor · die von Zoom verlangten Felder (`appKey`, `iat`, `exp`,
  `tokenExp`) sind vollständig · `iat` liegt **30 Sekunden in der Vergangenheit** (Vorlauf gegen
  Uhrendrift — die Setzung aus dem Spike) · `exp` in der Zukunft · `tokenExp` ≥ `exp` · das Secret
  taucht in keiner Ausgabe auf.
- **Ruhende Zustände:** die Prädikatsfunktion des Beitritts-Wachhunds meldet für `connecting`,
  `reconnecting`, `disconnecting`, `idle` und `other` **nicht ruhend** und für `inMeeting`,
  `waitingRoom`, `waitingForHost`, `failed`, `ended` **ruhend**. `connecting` darf den Wachhund
  nicht stillstellen — das ist der Spike-Hänger als Testfall.
- **Meeting-Nummer aufräumen:** `"111 2222 3333"`, `"111-2222-3333"` und `"11122223333"` ergeben
  dieselbe Ziffernfolge; Buchstaben werden abgewiesen statt still entfernt.
- **Parser:** wohlgeformte Zeilen · **halbe Zeilen** (die Puffergrenze fällt mitten ins JSON) ·
  mehrere Zeilen in einem Puffer · unbekannte Ereignisnamen · kaputtes JSON. **Eine kaputte Zeile
  darf die Sitzung nicht abreißen** — sie wird als Rauschen gemeldet und übersprungen.
- **Zustandsmaschine** gegen aufgezeichnete Ereignisfolgen: sauberer Beitritt · Warteraum, dann
  eingelassen · Gastgeber startet erst später (`waitingForHost` → `inMeeting`) · Erlaubnis kommt
  verspätet · Teilnehmer kommt, wird umbenannt, geht · Abbruch mitten im Satz · Ereignisse in
  falscher Reihenfolge (`left` vor `joined`) · **Wiederverbindung**: `inMeeting` → `reconnecting` →
  `inMeeting` mit zweitem `roster` und **anderen IDs** ersetzt die Karte vollständig und lässt keine
  Karteileichen zurück.
- **Fehlerkatalog:** jeder Code hat genau einen Namen · keine zwei Codes teilen sich einen Namen ·
  ein unbekannter Code wird als `SDKERR_UNKNOWN(<n>)` gemeldet, nicht auf den nächstähnlichen
  gerundet.
- **Status-Paar:** `code` wird nur zusammen mit `status` ausgelegt; `failed` und `ended` mit
  demselben `code` ergeben **verschiedene** Klartexte.

### 11.2 Konsolen-Prüfstand — gegen ein echtes Meeting

```powershell
$env:ZOOM_SDK_DIR          = "…\SDKs\zoom-c-sharp-wrapper-7.1.5.43953"
$env:ZOOM_SDK_CREDENTIALS  = "…\zoom-credentials.json"   # ausserhalb des Repos
$env:ZOOM_MEETING_ID       = "830…"
$env:ZOOM_MEETING_PASSCODE = "…"
npm run join -w @jm/zoom-bridge
```

Baut das JWT, startet die exe, druckt jedes Ereignis in Klartext und verlässt das Meeting nach
`ZOOM_JOIN_SECONDS` (Vorgabe 60) oder auf Strg+C.

**Rückgabewerte — bewusst dieselben wie im Spike**, damit Läufe vergleichbar bleiben:

| Wert | Bedeutung |
|---|---|
| `0` | im Meeting **und** Rohdaten-Erlaubnis |
| `3` | im Meeting, aber keine Erlaubnis |
| `4` | nicht ins Meeting gekommen |
| `1` | Fehler davor (Bau, Init, Anmeldung) |

Ein geglückter Beitritt ohne Erlaubnis mit `0` zu quittieren wäre genau die Sorte Lüge, die dieses
Werkzeug aufdecken soll.

## 12 · Abnahme

Stage 1 ist fertig, wenn **alle** dieser Punkte gemessen sind:

1. `npm install` läuft auf Linux und auf Windows ohne `ZOOM_SDK_DIR` durch, ohne zu bauen und ohne
   zu scheitern.
2. `npm run typecheck -w @jm/zoom-bridge` und `npm run selftest -w @jm/zoom-bridge` sind grün — auf
   einem Rechner ohne SDK.
3. Auf einem Windows-Rechner mit gesetztem `ZOOM_SDK_DIR` baut `npm run rebuild -w @jm/zoom-bridge`
   `zoom-bridge.exe`.
4. `npm run join -w @jm/zoom-bridge` gegen ein echtes Meeting: Beitritt gelingt, die
   **Teilnehmerliste erscheint mit echten Namen**, die Erlaubnis wird angefragt und nach der Freigabe
   als `canRecordRaw:true` gemeldet, Rückgabewert `0`.
5. Derselbe Lauf **ohne** Freigabe endet mit `3` — nicht mit `0` und nicht mit einem Absturz.
6. Ein Lauf gegen eine falsche Meeting-Nummer endet mit `4` und einer benannten Ursache, nicht mit
   einem Hänger.
7. Wird der Prüfstand mit Strg+C beendet, verschwindet die Bridge aus dem Meeting und hinterlässt
   keinen Prozess.

Punkte 4–6 sind Owner-Schritte: sie brauchen ein Meeting und eine Freigabe von Hand.

## 13 · Was Stage 1 ausdrücklich nicht tut

Kein NDI. Keine Rohbilder, kein Rohton, keine Aufzeichnung. Keine Anbindung an `apps/connect`, kein
UI, keine `ZoomParticipant`-Entität. Kein automatischer Wiederbeitritt. Kein Bündeln der rund 100
Begleit-DLLs. Kein ZAK-Weg (die Bridge tritt als Teilnehmer bei, nicht als Gastgeber).

## 14 · Für Stage 2 vorgemerkt

- `GetPersistentId()` ist der stabile Schlüssel für die NDI-Quellennamen — `GetUserID()` gilt nur
  innerhalb einer Sitzung und wechselt bei Wiederverbindung.
- `InitParam.rawdataOpts` muss gesetzt sein, **bevor** Rohdaten fließen. Steht bereits in Lauf 2.
- `StartRawRecording()` ist der Schalter, der in Stage 2 zum ersten Mal umgelegt wird — mit allem,
  was das für Aufzeichnungs-Hinweise im Meeting bedeutet.
- Zoom liefert **I420**, NDI nimmt I420 nativ. Keine Farbraumwandlung.
