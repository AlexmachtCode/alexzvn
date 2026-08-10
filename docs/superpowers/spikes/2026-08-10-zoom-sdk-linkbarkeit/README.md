# Zoom-Meeting-SDK: Ist es ohne `sdk.lib` bindbar? — Sondierlauf 2026-08-10

**Ergebnis: ja.** Der Download eines weiteren SDK-Pakets entfällt. Der C#-Wrapper allein genügt.

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

**Nicht geklärt — und aus diesem Lauf auch nicht klärbar:** `HasRawdataLicense()` meldet `false`.
Das ist **kein** Beweis, daß die Rohdaten-Berechtigung fehlt. Die Berechtigung hängt am Konto und
kommt über das JWT bei der Anmeldung — und angemeldet wurde hier nicht, weil dafür die
Marketplace-App nötig ist. Vor der Anmeldung ist `false` die nichtssagende Antwort, nicht die
negative.

Genau dafür gibt es **Lauf 3** (`03-auth.cpp`) — siehe unten. Er ist gebaut und wartet nur auf
Zugangsdaten.

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
$env:ZOOM_SDK_DIR         = "…\SDKs\zoom-c-sharp-wrapper-7.1.5.43953"
$env:ZOOM_SDK_CREDENTIALS = "C:\Users\<du>\Documents\zoom-credentials.json"
node docs/superpowers/spikes/2026-08-10-zoom-sdk-linkbarkeit/run-auth.mjs
```

`run-auth.mjs` reicht das JWT ausschließlich durch die Umgebung des Kindprozesses weiter und nimmt
dabei die Zugangsdaten selbst aus dessen Umgebung heraus — `03-auth.exe` sieht Client-ID und Secret
nie. Alternativ gehen `ZOOM_SDK_CLIENT_ID` und `ZOOM_SDK_CLIENT_SECRET` direkt als
Umgebungsvariablen.

### Wie das Ergebnis zu lesen ist

| Ausgabe | Bedeutung |
|---|---|
| `AUTHRET_SUCCESS` + `HasRawdataLicense() -> TRUE` | **Stage 0 durch.** Stage 1 kann beginnen. |
| `AUTHRET_SUCCESS` + `HasRawdataLicense() -> FALSE` | Anmeldung gut, aber **keine Rohdaten-Berechtigung**. Dann greift der Ausweg VideoCom Bridge aus der Roadmap. |
| `AUTHRET_JWTTOKENWRONG` | JWT fehlerhaft — meist die Uhrzeit (`iat`/`exp`) oder ein falsches Secret. |
| `AUTHRET_KEYORSECRETWRONG` | Client-ID/Secret passen nicht zur App. |
| `AUTHRET_ACCOUNTNOTENABLESDK` | Das Konto hat das Meeting-SDK nicht freigeschaltet. |
| kein Rückruf in 30 s | **Kein** Beweis für Scheitern — es kam nur kein Ergebnis. Netz, Uhrzeit oder Nachrichtenschleife prüfen. |

## Nachbauen

```powershell
$env:ZOOM_SDK_DIR = "…\SDKs\zoom-c-sharp-wrapper-7.1.5.43953"
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
