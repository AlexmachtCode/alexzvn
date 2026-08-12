# Zoom-Meeting-SDK — Stage-0-Sondierläufe, 2026-08-10

Drei Läufe, drei Antworten:

| Frage | Antwort |
|---|---|
| Ist das SDK **ohne `sdk.lib`** bindbar? | ✅ **Ja.** Der Download eines weiteren SDK-Pakets entfällt. |
| Trägt das **Fundament** (Init, Dienste, Anmeldung, Nachrichtenschleife)? | ✅ **Ja**, alles gemessen. |
| Hat das Konto die **Rohdaten-Lizenz**? | ❌ **Nein.** `HasRawdataLicense()` meldet nach erfolgreicher Anmeldung `FALSE`. |
| Trägt der **zweite Weg** (Aufnahme-Erlaubnis im Meeting)? | ✅ **JA — gemessen am echten Meeting.** |

## ✅ Stage 0 ist durch

Die Konto-Lizenz fehlt, **aber sie wird nicht gebraucht**. Erteilt der Gastgeber im Meeting die
lokale Aufnahme-Erlaubnis, meldet `CanStartRawRecording()` Erfolg — und damit sind Rohvideo und
Rohton erreichbar. Da wir laut Owner-Entscheid ohnehin **Host** sind, erteilen wir sie uns selbst.

**Stage 1 (Bridge-Gerüst) kann beginnen.**

> ⚠️ **Zwei Berichtigungen im Verlauf.** Erst stand hier, ohne Konto-Freischaltung gebe es „keine
> Zoom-Einbindung in der geplanten Form" — das war voreilig, weil `HasRawdataLicense()` nur einer von
> zwei Wegen ist. Der zweite wurde dann gemessen und trägt.

## Die Frage

Zoom-Einbindung (#197) ist das Leitprojekt und hing an Stage 0. Im SDKs-Ordner lagen die
Rohdaten-Kopfdateien und `sdk.dll`, aber **keine `sdk.lib`** — ohne Import-Bibliothek läßt sich
gegen eine DLL nicht binden. Die naheliegende Antwort wäre gewesen, das schlichte
„Meeting SDK for Windows"-Paket nachzuladen. Vorher war die billigere Frage zu klären: läßt sich
die Bibliothek aus der DLL selbst erzeugen?

## Warum es geht

`sdk.dll` exportiert **23 unverzierte C-Namen**, keine gemangelten C++-Symbole:

```
CleanUPSDK  CreateAuthService  CreateCustomizedUIMgr  CreateMeetingService
CreateNetworkConnectionHelper  CreateSettingService  DestroyAuthService …
GetAudioRawdataHelper  GetRawdataShareSourceHelper  GetRawdataVideoSourceHelper
GetSDKVersion  GetZoomLastError  HasRawdataLicense  InitSDK  SwitchDomain
createRenderer  destroyRenderer
```

Damit ist der Weg `dumpbin /exports` → `.def` → `lib /def:` gangbar; bei gemangelten Symbolen wäre
er es nicht gewesen. Die C++-Schnittstellen (`IMeetingService` und Verwandte) brauchen keine eigenen
Exporte — ihre vtables liegen in der DLL, erreicht werden sie über die Fabrikfunktionen oben.

Die drei `[NONAME]`-Exporte sind ordinal-only und fallen absichtlich aus der `.def`: sie sind nicht
namentlich bindbar und werden nicht gebraucht.

## Was gemessen wurde

**Lauf 1 — Bindbarkeit** (`01-bindbarkeit.cpp`, ohne `InitSDK`):

```
GetSDKVersion()             -> 7.1.5 (43953)
HasRawdataLicense()         -> false
GetRawdataVideoSourceHelper -> 0000024455E4BFD0
GetAudioRawdataHelper       -> 0000024455DFFCF0
CreateMeetingService()      -> SDKError=7, ptr=0000000000000000
```

`SDKError=7` ist `SDKERR_UNINITIALIZE` — die erwartete, korrekte Antwort, denn `InitSDK` wurde
absichtlich nicht gerufen. Das Programm stürzte beim Beenden ab (`0xC0000409`), was ebenfalls zum
uninitialisierten Zustand paßt; Lauf 2 beendet sauber.

**Lauf 2 — Fundament** (`02-initsdk.cpp`, mit `InitSDK`, **ohne** Zugangsdaten):

```
vor  InitSDK: HasRawdataLicense() -> false
InitSDK()                         -> SDKError=0
nach InitSDK: HasRawdataLicense() -> false
CreateAuthService()               -> SDKError=0, ptr=00007FFB950E4DF0
CreateMeetingService()            -> SDKError=0, ptr=00007FFB95101DF0
CleanUPSDK()                      -> ok
exit=0
```

## Was das heißt — und was ausdrücklich nicht

**Geklärt:** Die Bindung trägt. Übersetzen, Binden, echte Werte aus der DLL, sauberes Herunterfahren.
`InitSDK` gelingt **ohne** Marketplace-Zugangsdaten, die Dienst-Fabriken liefern gültige Zeiger. Das
Fundament von Stage 1 (Bridge-Gerüst) steht damit auf gemessenem Boden.

**Aus Lauf 1 und 2 nicht klärbar:** `HasRawdataLicense()` meldet dort `false`, aber vor der
Anmeldung ist das die nichtssagende Antwort, nicht die negative. Die Berechtigung hängt am Konto und
kommt über das JWT. Dafür gibt es Lauf 3.

**Lauf 3 — Anmeldung** (`03-auth.cpp`, mit Marketplace-Zugangsdaten, 2026-08-10):

```
InitSDK()                           -> ok
vor  Anmeldung: HasRawdataLicense() -> false
SDKAuth()                           -> SDKError=0 (nur Annahme, Ergebnis kommt asynchron)
onAuthenticationReturn              -> AUTHRET_SUCCESS
nach Anmeldung: HasRawdataLicense() -> FALSE
exit=3
```

**Damit ist die Frage beantwortet — negativ.** `AUTHRET_SUCCESS` beweist, daß Client-ID, Secret,
JWT-Aufbau, Uhrzeit und die Nachrichtenschleife alle stimmen. Die Anmeldung ist kein Verdächtiger
mehr. Und **nach** einer geglückten Anmeldung ist `HasRawdataLicense() == false` die belastbare,
negative Antwort: **dieses Konto hat die Rohdaten-Berechtigung nicht.**

## Der zweite Weg — und warum der erste Schluß voreilig war

`HasRawdataLicense()` prüft eine **Konto-Lizenz**. Sie ist **nicht** die einzige Tür zu den Rohdaten.
Der SDK-Kopfsatz nennt eine zweite, in
`meeting_service_components/meeting_recording_interface.h`:

```cpp
// IMeetingRecordingController
virtual SDKError CanStartRawRecording() = 0;   // darf dieser Nutzer Rohdaten aufnehmen?
virtual SDKError StartRawRecording()   = 0;
virtual SDKError RequestLocalRecordingPrivilege() = 0;        // den Gastgeber fragen
virtual SDKError IsSupportRequestLocalRecordingPrivilege() = 0;

// IMeetingRecordingCtrlEvent
virtual void onLocalRecordingPrivilegeRequestStatus(RequestLocalRecordingStatus) = 0;

// Gastgeberseite (IRequestLocalRecordingPrivilegeHandler)
virtual SDKError GrantLocalRecordingPrivilege() = 0;
virtual SDKError DenyLocalRecordingPrivilege()  = 0;
```

Das ist die **lokale Aufnahme-Erlaubnis im Meeting**. Genau diesen Weg hatte die Roadmap für Stage 0
von Anfang an vorgesehen („Testmeeting mit Co-Host/**local recording permission**") — Lauf 3 hat ihn
nur nicht berührt, weil er gar nicht erst in ein Meeting geht.

**Und wir sind laut Owner-Entscheid ohnehin Host.** Ein Host kann die Erlaubnis selbst erteilen. Weg 2
ist damit nicht der Notnagel, sondern der naheliegendere.

**Was der `false`-Befund also wirklich heißt:** Weg 1 ist zu. Über Weg 2 sagt er **nichts**.

## Lauf 4 — der Beweis am echten Meeting

`04-join-rawrecording.cpp`, gelaufen am 2026-08-11 gegen ein echtes Testmeeting:

```
Anmeldung                    -> AUTHRET_SUCCESS
HasRawdataLicense() (Weg 1)  -> FALSE
  Status: CONNECTING
  Status: IN_WAITING_ROOM
  Status: INMEETING

CanStartRawRecording()       -> SDKError=12  (SDKERR_NO_PERMISSION)
IsSupportRequestLocalRecordingPrivilege() -> SDKError=0
  onRecordPrivilegeChanged   -> darf aufnehmen
onLocalRecordingPrivilegeRequestStatus -> GRANTED
CanStartRawRecording() erneut -> SDKError=0  (JA)
exit=0
```

Der Ablauf ist damit vollständig belegt: ohne Erlaubnis `SDKERR_NO_PERMISSION`, nach der Freigabe
durch den Gastgeber `SDKERR_SUCCESS`. Es wurde **nichts aufgezeichnet** — der Lauf fragt nur nach
der Erlaubnis und verläßt das Meeting wieder.

### ⚑ Die Falle, die Stage 1 sonst Tage gekostet hätte

Der erste Beitrittsversuch blieb **90 Sekunden bei `CONNECTING` stehen** — kein Fehler, kein
Abbruch, keine Meldung. Die Ursache steht in `zoom_sdk_def.h`:

```cpp
#define ENABLE_CUSTOMIZED_UI_FLAG (1 << 5)
// optionalFeatures & ENABLE_CUSTOMIZED_UI_FLAG == true -> eigener UI-Modus,
// sonst Zoom-UI-Modus (Vorgabe)
```

In der Vorgabe will das SDK ein **eigenes Meeting-Fenster** aufmachen. In einer Konsolenanwendung —
und später ebenso im `utilityProcess` — gibt es dafür keinen Platz, und der Beitritt kommt nie zum
Abschluß. Er scheitert nicht, er **hängt**.

```cpp
p.obConfigOpts.optionalFeatures = ENABLE_CUSTOMIZED_UI_FLAG;
```

Mit dieser einen Zeile lief der Beitritt sofort durch. **Für Stage 1 ist das Pflicht**, und zwar aus
demselben Grund, aus dem die Bridge eine eigene Nachrichtenschleife braucht: sie hat kein Fenster.

### Was der Owner dafür einstellen mußte

Im Zoom-Web-Portal unter **Einstellungen → Aufzeichnung** die **lokale Aufzeichnung** einschalten,
samt der Unteroption, daß Hosts Teilnehmern die lokale Aufnahme gestatten dürfen. Im Meeting selbst
erteilt der Gastgeber sie dann — entweder von sich aus oder auf die Anfrage hin, die
`RequestLocalRecordingPrivilege()` bei ihm auslöst.

### Nachbauen

```powershell
$env:ZOOM_SDK_DIR          = "<Pfad zum entpackten Zoom-Meeting-SDK>"
$env:ZOOM_SDK_CREDENTIALS  = "<Pfad ausserhalb des Repos zur zoom-credentials.json>"   # ausserhalb des Repos
$env:ZOOM_MEETING_ID       = "<nur Ziffern>"                      # nur Ziffern
$env:ZOOM_MEETING_PASSCODE = "<Kenncode>"
node docs/superpowers/spikes/2026-08-10-zoom-sdk-linkbarkeit/run-join.mjs
```

Rückgabewerte: `0` = Rohdaten-Aufnahme erlaubt · `3` = im Meeting, aber nicht erlaubt ·
`4` = die Frage konnte gar nicht gestellt werden (nicht ins Meeting gekommen) · `1` = Fehler davor.

Sollte Zoom die Konto-Lizenz doch noch erteilen, wird Weg 2 überflüssig: `run-auth.mjs` erneut
laufen lassen, Rückgabewert `0` statt `3` heißt, Weg 1 ist offen.

## Lauf 3 — die Berechtigungsfrage beantworten

`make-jwt.mjs` baut das JWT (HS256 über `{appKey, iat, exp, tokenExp}`), `03-auth.cpp` meldet sich
damit an und fragt **danach** `HasRawdataLicense()`. Erst diese Antwort zählt.

Der Lauf beweist nebenbei die zweite Voraussetzung von Stage 1: `SDKAuth` antwortet **asynchron**
über `onAuthenticationReturn`. Ohne laufende Win32-Nachrichtenschleife kommt der Rückruf **nie** an —
und ein `utilityProcess` hat keine. Die Bridge muß ihre eigene mitbringen; hier läuft sie zum ersten
Mal gegen das echte SDK.

### Zugangsdaten — nirgends hinschreiben, wo sie bleiben

Client-ID und Secret gehören **nicht** ins Repo, nicht in die Konsole und nicht in ein Protokoll.
In der CI läuft ein gitleaks-Scan über den Dateibaum. Deshalb: Datei **außerhalb** des Repos anlegen,
dann kann sie gar nicht erst committet werden.

```json
{ "clientId": "…", "clientSecret": "…" }
```

```powershell
$env:ZOOM_SDK_DIR         = "<Pfad zum entpackten Zoom-Meeting-SDK>"
$env:ZOOM_SDK_CREDENTIALS = "<Pfad ausserhalb des Repos zur zoom-credentials.json>"
node docs/superpowers/spikes/2026-08-10-zoom-sdk-linkbarkeit/run-auth.mjs
```

`run-auth.mjs` reicht das JWT ausschließlich durch die Umgebung des Kindprozesses weiter und nimmt
dabei die Zugangsdaten selbst aus dessen Umgebung heraus — `03-auth.exe` sieht Client-ID und Secret
nie. Alternativ gehen `ZOOM_SDK_CLIENT_ID` und `ZOOM_SDK_CLIENT_SECRET` direkt als
Umgebungsvariablen.

### Wie das Ergebnis zu lesen ist

| Ausgabe | Rückgabewert | Bedeutung |
|---|---|---|
| `AUTHRET_SUCCESS` + `HasRawdataLicense() -> TRUE` | `0` | **Stage 0 durch.** Stage 1 kann beginnen. |
| `AUTHRET_SUCCESS` + `HasRawdataLicense() -> FALSE` | `3` | Anmeldung gut, aber **keine Rohdaten-Berechtigung**. ← *Stand 2026-08-10* |
| `AUTHRET_JWTTOKENWRONG` | `1` | JWT fehlerhaft — meist die Uhrzeit (`iat`/`exp`) oder ein falsches Secret. |
| `AUTHRET_KEYORSECRETWRONG` | `1` | Client-ID/Secret passen nicht zur App. |
| `AUTHRET_ACCOUNTNOTENABLESDK` | `1` | Das Konto hat das Meeting-SDK nicht freigeschaltet. |
| kein Rückruf in 30 s | `1` | **Kein** Beweis für Scheitern — es kam nur kein Ergebnis. Netz, Uhrzeit oder Nachrichtenschleife prüfen. |

Der Rückgabewert beantwortet **die Frage dieses Laufs**, nicht die Teilfrage „hat die Anmeldung
geklappt". Eine geglückte Anmeldung ohne Berechtigung mit `0` zu quittieren wäre genau die Sorte
Lüge, die dieses Werkzeug aufdecken soll — deshalb der eigene Wert `3`.

## Nachbauen

```powershell
$env:ZOOM_SDK_DIR = "<Pfad zum entpackten Zoom-Meeting-SDK>"
node docs/superpowers/spikes/2026-08-10-zoom-sdk-linkbarkeit/build.mjs
$env:PATH = "$env:ZOOM_SDK_DIR\x64\bin;$env:PATH"
.\docs\superpowers\spikes\2026-08-10-zoom-sdk-linkbarkeit\build\02-initsdk.exe
```

`ZOOM_SDK_DIR` zeigt auf den Ordner mit `x64/bin/sdk.dll` und
`x64/zoom_sdk_c_sharp_wrap/h/zoom_sdk.h`. Ohne die Variable und auf Nicht-Windows bricht das Skript
nicht ab, es überspringt — gleiche Setzung wie bei `@jm/decklink`.

`sdk.def` liegt zur Ansicht daneben; `build.mjs` erzeugt sie ohnehin neu, damit ein SDK-Wechsel nicht
still an einer veralteten Liste vorbeiläuft.

## Für Stage 1 mitgenommen

- Die Import-Bibliothek gehört **nicht** ins Repo: sie ist aus der DLL ableitbar und an deren Fassung
  gebunden. `packages/zoom-bridge/` erzeugt sie zur Bauzeit — dasselbe Muster wie `@jm/decklink`, wo
  die Header per MIDL aus der IDL entstehen.
- Die DLL-Weiterverteilungs-Lizenz bleibt zu klären: `sdk.dll` und ihre rund 100 Begleit-DLLs müssen
  mit ausgeliefert werden.
- `InitParam.rawdataOpts` muß gesetzt sein, bevor Rohdaten fließen. In Lauf 2 steht es bereits.
