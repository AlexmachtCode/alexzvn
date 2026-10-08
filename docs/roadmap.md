# JM Production Suite — Roadmap

> **Lebendes Dokument.** Aktualisieren, nicht neu bauen. Stand: **2026-10-08**.
> Zwei Leitprojekte: die **Zoom-Einbindung (Welle 6.7)**, Abschnitt 1, und seit dem 30.09. der
> **Master-Launcher / Suite im Netz**, Abschnitt 1b. Alles andere läuft in den Parallel-Spuren (Abschnitt 2).
>
> **Nachgeführt am 2026-10-08, am Code, an den Releases und an den GitHub-Issues gemessen.** Der Stand vom
> 07.08. war in beide Richtungen veraltet: Zoom Stage 4 und Master-Launcher Teil 0–2b fehlten ganz, und
> #61, #57, #234 standen noch als offen da. Die Reihenfolge der nächsten Arbeit steht in Abschnitt 3.

**Status-Legende:** ⛔ blockiert/Gate · 🟢 jetzt/aktiv · 🔵 als Nächstes · 🟡 Code fertig, Owner-Abnahme offen · ⚪ später/geparkt · ✅ erledigt

---

## 1 · Leitprojekt: Zoom-Einbindung (Welle 6.7)

**Issue [#197](https://github.com/AlexmachtCode/alexzvn/issues/197).** Zoom-Einwahldaten eintragen, dann
einzelne Teilnehmer als Gäste/Quellen laden. Owner-Entscheidungen: wir sind **Host** · **Mischton genügt**
(getrennter Ton nimmt das native SDK aber gratis mit) · **in JM Connect bauen** (nicht zukaufen) · **nur Zoom**.

### Architektur (Recherche abgeschlossen — nicht erneut recherchieren)

Zwei Abkürzungen sind tot: **Zoom ISO** (Liminal, nur macOS 14+) und das **Zoom Meeting SDK for Web**
(gibt keinerlei Roh-Medien heraus). Einziger tragfähiger Weg: **natives Zoom Meeting SDK für Windows (C++)**.

- Eigenständige **`zoom-bridge.exe`** (C++-Sidecar), linkt Zoom-SDK **und** NDI-SDK, macht je Teilnehmer
  selbst einen NDI-Sender auf, wird per JSON über stdin/stdout gesteuert. **Frames sehen den JS-Heap nie.**
- „Ein NDI-Sender pro Prozess" ist **kein NDI-Limit** — es kommt aus den Modul-Singletons unseres eigenen
  Addons. In C++ hält ein Prozess beliebig viele `NDIlib_send_create`. Zoom liefert **I420**, und **NDI nimmt
  I420 nativ** → keine Farbraumwandlung.
- Zoom-Teilnehmer sind **keine `Guest`s** → eigene Entität `ZoomParticipant`, die den **Durable Object nicht
  berührt** (Zoom bleibt lokal am Raum-PC). Damit bleibt die **EU-Residenz-Aussage aus 6.6 gültig**.
  `zoom_*`-Verben zweigen in `App.tsx` **vor** dem DO-Mapping ab. Passcode/SDK-Secret gehen nie an den Worker.
- Paketierung: `packages/zoom-bridge/` mit **CMake** + `maybe-build.mjs`-Guard (kein `binding.gyp`, weil
  node-gyp auf `.node`-Ausgabe + Electron-ABI verdrahtet ist). `connect-v` steht schon in der CI-Ausnahmeliste.

### Stages

| Stage | Inhalt | Status |
|---|---|---|
| **0 · Beschaffung + De-Risking-Spike** | **Owner:** ~~private Marketplace-App~~ ✅ · ~~Windows-Meeting-SDK laden~~ ✅ · **Rohdaten-Freischaltung des Kontos** ⛔ · Testmeeting mit Co-Host/„local recording permission" · DLL-Weiterverteilungs-Lizenz klären. **Spike:** ✅ **komplett durch** (2026-08-10/11). Bindung ohne `sdk.lib`, `InitSDK`, Anmeldung, Nachrichtenschleife, Meeting-Beitritt und `CanStartRawRecording()` — alles gemessen. Die Konto-**Lizenz** fehlt (Weg 1), wird aber **nicht gebraucht**: mit der lokalen Aufnahme-Erlaubnis des Gastgebers (Weg 2) meldet `CanStartRawRecording()` Erfolg. **Ausweg VideoCom Bridge vom Tisch.** ⚑ Pflicht für Stage 1: `ENABLE_CUSTOMIZED_UI_FLAG`, sonst hängt der Beitritt ewig bei `CONNECTING`. | ✅ **durch** |

**Stand der Beschaffung, gemessen am 2026-08-10** in
`C:\Users\alexk\Documents\Jakobs Medien\Production Suite\SDKs`:

| | |
|---|---|
| Rohdaten-Header (`zoom_rawdata_api.h`, `rawdata_renderer_interface.h`, `rawdata_audio_helper_interface.h`) | ✅ da, im **C#-Wrapper-Paket** (`zoom-c-sharp-wrapper-7.1.5.43953/x64/zoom_sdk_c_sharp_wrap/h/`) |
| `sdk.dll` (Laufzeit, x64, 2.086 KB) | ✅ da |
| ~~`sdk.lib` (Import-Bibliothek)~~ | ✅ **erledigt — wird nicht gebraucht**, siehe Sondierlauf unten |
| Marketplace-App (Client-ID/Secret) | ✅ **erstellt und geprüft** — `AUTHRET_SUCCESS` |
| Rohdaten-**Lizenz** des Kontos (Weg 1) | ❌ fehlt — **wird aber nicht gebraucht** |
| **Lokale Aufnahme-Erlaubnis im Meeting (Weg 2)** | ✅ **trägt** — `CanStartRawRecording()` = 0 nach Freigabe |
| Testmeeting mit Host-/Co-Host-Rechten | ✅ durchgeführt 2026-08-11 |
| DLL-Weiterverteilungs-Lizenz | ✅ **entschieden 2026-10-06:** Zooms Nutzungsbedingungen erlauben nur interne Nutzung → die DLLs werden nur auf JM-Rechner nachgeladen (Connect 0.2.2), nie öffentlich verteilt |

⚠️ **Das geladene „Plugin SDK" ist ein anderes Produkt** und hilft hier nicht: es spricht per IPC
(`zToolSuiteIPCProxy.lib`) mit dem laufenden Zoom-Client und liefert **keine Rohmedien**. Der
C#-Wrapper dagegen enthält den vollständigen nativen C++-Kopfsatz inklusive `h/rawdata/`.

**De-Risking-Spike gelaufen 2026-08-10** → [`docs/superpowers/spikes/2026-08-10-zoom-sdk-linkbarkeit/`](superpowers/spikes/2026-08-10-zoom-sdk-linkbarkeit/README.md)

Die fehlende `sdk.lib` war **kein Beschaffungsproblem**: `sdk.dll` exportiert 23 **unverzierte
C-Namen** statt gemangelter C++-Symbole, deshalb ist der Weg `dumpbin /exports` → `.def` →
`lib /def:` gangbar. Gemessen, nicht vermutet:

```
GetSDKVersion()                   -> 7.1.5 (43953)
InitSDK()                         -> SDKError=0     (OHNE Zugangsdaten)
CreateAuthService()               -> SDKError=0, gueltiger Zeiger
CreateMeetingService()            -> SDKError=0, gueltiger Zeiger
CleanUPSDK()                      -> sauber, exit=0
```

Auch `GetRawdataVideoSourceHelper` und `GetAudioRawdataHelper` sind bindbar und liefern Zeiger.
**Damit steht das Fundament von Stage 1 auf gemessenem Boden**, und ein SDK-Download entfällt.

⛔ **Die Berechtigungsfrage ist beantwortet — negativ.** Mit der am 2026-08-10 erstellten
Marketplace-App gemessen:

```
onAuthenticationReturn              -> AUTHRET_SUCCESS
nach Anmeldung: HasRawdataLicense() -> FALSE
```

`AUTHRET_SUCCESS` beweist, daß Client-ID, Secret, JWT-Aufbau, Uhrzeit und die Nachrichtenschleife
stimmen — die Anmeldung ist kein Verdächtiger mehr. Und **nach** geglückter Anmeldung ist
`HasRawdataLicense() == false` die belastbare, negative Antwort: **dieses Konto hat die
Rohdaten-Berechtigung nicht.**

> ### ⚠️ Berichtigung vom 2026-08-10 (später am Tag): das war voreilig
>
> Hier stand zuerst „der einzige verbliebene Blocker · Ausweg VideoCom Bridge". **Am SDK-Kopfsatz
> nachgemessen ist das zu pessimistisch.** `HasRawdataLicense()` ist **nur einer von zwei** Wegen zu
> den Rohdaten. Der zweite steht in
> `meeting_service_components/meeting_recording_interface.h` und ist die **Aufnahme-Erlaubnis im
> Meeting**:
>
> ```cpp
> // IMeetingRecordingController
> virtual SDKError CanStartRawRecording() = 0;   // darf dieser Nutzer Rohdaten aufnehmen?
> virtual SDKError StartRawRecording()   = 0;
> virtual SDKError RequestLocalRecordingPrivilege() = 0;   // Gastgeber fragen
> virtual SDKError IsSupportRequestLocalRecordingPrivilege() = 0;
> // IMeetingRecordingCtrlEvent
> virtual void onLocalRecordingPrivilegeRequestStatus(RequestLocalRecordingStatus) = 0;
> // Gastgeberseite: GrantLocalRecordingPrivilege() / DenyLocalRecordingPrivilege()
> ```
>
> Genau diesen Weg hatte Stage 0 von Anfang an vorgesehen — die Zeile
> „Testmeeting mit Co-Host/**local recording permission**" steht seit jeher in der Tabelle oben. Der
> Spike hat sie nur nicht geprüft, weil er gar nicht erst in ein Meeting geht.
>
> **Der Befund lautet daher richtig:** dem Konto fehlt die **Rohdaten-Lizenz** (Weg 1). Ob Weg 2
> trägt, war zu diesem Zeitpunkt **ungeprüft** — und da wir laut Owner-Entscheid ohnehin **Host**
> sind, war er der naheliegendere: der Host kann die Erlaubnis selbst erteilen.
>
> **Nachtrag 2026-08-11: gemessen, Weg 2 trägt.** Siehe direkt darunter. Die Berichtigung war
> berechtigt — der ursprüngliche Schluß „blockiert, VideoCom Bridge erwägen" wäre eine
> Fehlentscheidung mit Kostenfolge gewesen.

### ✅ Weg 2 trägt — Stage 0 ist durch (gemessen 2026-08-11)

Lauf 4 ist einem echten Testmeeting beigetreten:

```
CanStartRawRecording()                    -> SDKError=12  (SDKERR_NO_PERMISSION)
IsSupportRequestLocalRecordingPrivilege() -> SDKError=0
onLocalRecordingPrivilegeRequestStatus    -> GRANTED
CanStartRawRecording() erneut             -> SDKError=0   (JA)
```

**Die Konto-Lizenz wird nicht gebraucht.** Erteilt der Gastgeber die lokale Aufnahme-Erlaubnis, sind
Rohvideo und Rohton erreichbar — und da wir laut Owner-Entscheid **Host** sind, erteilen wir sie uns
selbst. Der Ausweg **VideoCom Bridge** ist damit **vom Tisch**.

### ⚑ Pflicht für Stage 1: `ENABLE_CUSTOMIZED_UI_FLAG`

Der erste Beitrittsversuch blieb **90 Sekunden bei `CONNECTING` stehen** — kein Fehler, kein Abbruch,
keine Meldung. Ursache: in der Vorgabe läuft das SDK im **Zoom-UI-Modus** und will ein eigenes
Meeting-Fenster aufmachen. Eine Konsolenanwendung hat keines — und der `utilityProcess` der Bridge
später ebenso wenig. Der Beitritt scheitert nicht, er **hängt**.

```cpp
p.obConfigOpts.optionalFeatures = ENABLE_CUSTOMIZED_UI_FLAG;   // (1 << 5)
```

Mit dieser Zeile lief der Beitritt sofort durch. **Ohne sie wäre Stage 1 in einen Hänger gelaufen,
der wie ein Netzwerkproblem aussieht.** Zusammen mit der eigenen Nachrichtenschleife ist das die
zweite Fenster-bedingte Voraussetzung der Bridge.

**Damit sind alle Stage-0-Fragen beantwortet.** Offen bleibt nur die
**DLL-Weiterverteilungs-Lizenz** — eine kaufmännische Frage, die Stage 1–3 nicht blockiert, sondern
erst die Auslieferung in Stage 4.
| **1 · Bridge-Gerüst** | [`packages/zoom-bridge/`](../packages/zoom-bridge/README.md) — CMake + `maybe-build.mjs`-Riegel · eigene Win32-Nachrichtenschleife · `InitSDK` mit `ENABLE_CUSTOMIZED_UI_FLAG` · Anmeldung, Meeting-Beitritt, Teilnehmerliste und Rohdaten-Erlaubnis per JSON über stdin/stdout. Zeichnet **nichts** auf. Selbsttests laufen ohne SDK, ohne Compiler, ohne Meeting. **Owner-Abnahme am 12.08.2026 gegen ein echtes Meeting durch, alle vier Läufe:** Beitritt mit Warteraum + Erlaubnis erteilt (0), Erlaubnis abgelehnt (3), erfundene Meeting-Nummer (4), Strg+C verlässt das Meeting ohne verwaisten Prozess. [Spec](superpowers/specs/2026-08-11-zoom-bridge-geruest-design.md) · [Plan](superpowers/plans/2026-08-11-zoom-bridge-stage1.md) | ✅ durch |
| **2 · Video → NDI** | `onVideoRawDataReceived` (I420 nativ) → **mehrere NDI-Sender in EINEM Prozess** · Quelle „JM Connect – Zoom \<Name\>" (ohne Doppelpunkt, gemessen) erscheint ohne Switcher-Änderung. **Owner-Abnahme am 13./14.08.2026 gegen ein echtes Meeting durch:** Bild fließt, Bild im NDI-Monitor angesehen (Lage + Farben richtig), Kamera aus/an mehrfach, **fünf Abos gleichzeitig** (= die Betriebsgröße, Owner: höchstens 5 Zuschaltungen je Veranstaltung), Weggang + Wiederbeitritt hängen dieselbe Quelle um, Meeting-Ende räumt die Abos ab, 20 Ab-/Anmeldungen unter laufendem Bild ohne Absturz. **Zwei Messbefunde, die den Entwurf korrigiert haben:** `StartRawRecording()` ist der Schalter für die Rohdaten (der Name lügt, es schreibt keine Datei), und Zooms `persistentId` überlebt einen Wiederbeitritt **nicht** — das Umhängen läuft darum über den Anzeigenamen, nur bei Eindeutigkeit (`reboundByName`). Offen bleibt nur Befund I6 als **unbelegte** Annahme. ⚑ **Nachtrag 18.08.2026:** auf diesem Weg steckte seit Stage 2 ein **Absturz** — nach dem Meeting-Ende beendete `unSubscribe()` auf dem Renderer den Prozess mit `0xC0000005`. Die Abnahme „Meeting-Ende räumt die Abos ab“ war trotzdem richtig: die Abos *wurden* abgeräumt. Dass der Prozess **danach** starb, konnte niemand sehen, weil der Rückgabewert des Kindprozesses (`detail`) von keinem Anzeiger ausgegeben wurde. Behoben in Stage 3; Einzelheiten im [README Abschnitt 8](../packages/zoom-bridge/README.md). [README Abschnitt 7](../packages/zoom-bridge/README.md). | ✅ durch |
| **3 · Ton je Person** | `onOneWayAudioRawDataReceived` (PCM16 je `node_id`) → NDI-Audio je Teilnehmer, in derselben Quelle wie das Bild. Code fertig, ein Ton-Abo braucht dabei `JoinVoip()` — ohne den Beitritt zum Tonkanal antwortet Zoom mit `SDKERR_NOT_JOIN_AUDIO` (32), und Video kennt diese Bedingung nicht (`packages/zoom-bridge/native/audio.cpp`, [README Abschnitt 7](../packages/zoom-bridge/README.md)). **Owner-Abnahme am echten Meeting: 7 von 8 Punkten durch (18.08.2026).** ✅ 1) Ton fließt und ist im NDI-Monitor **hörbar**; ✅ 2) `live`↔`silent` fünfmal über drei Abos, **kein Knacken** — die frühere Notiz „kein `silent`, Zoom sendet durchgehend“ war ein voreiliger Schluss aus zwei ereignislosen Läufen; ✅ 3) `audio:false` liefert Bild ohne Ton (`off`/`command`); ✅ 4) zwei Personen gleichzeitig, zwei Quellen, **im NDI-Monitor einzeln abgehört und sauber getrennt**; ✅ 6) Weggang und Wiederbeitritt: `black`/`off (participantLeft)` → `subscribed`/`waiting (reboundByName)` unter **neuer** Kennung, **Quellenname unverändert**, Ton zurück; ✅ 7) Meeting-Ende meldet den Ton eigens mit `meetingEnded`; ✅ 8) **gemessen mitgeschrieben:** 32 kHz Mono, 320 Abtastwerte je Paket, rund 100 Pakete je Sekunde und Sprecher (= genau 10 ms je Paket). Dazu **erstmals die Summenrate mit ZWEI gleichzeitigen Sprechern: 101 + 102 Pakete/s, kein `AUDIO_QUEUE_OVERFLOW`** — über fünf sagt das weiterhin nichts. ❌ **5) Lippensynchronität: der Ton läuft dem Bild hinterher** (Owner, 18.08.2026, geschätzt knapp eine halbe Sekunde, gleichbleibend). **GEMESSEN: unser eigener Anteil sind rund 6 ms** — die Brücke schreibt seit dem 18.08. mit, wie lange jedes Paket zwischen SDK-Rückruf und Senden wartet (das ist die volle Verzögerung gegenüber dem Bild, denn das Bild geht direkt aus seinem Rückruf raus): drei Zehn-Sekunden-Fenster ergaben mittel 5,5–5,9 ms, max 15,6 ms, Senderate durchgehend 100 %. Das liegt eine Größenordnung unter der Wahrnehmungsschwelle — **der Versatz ist nicht unserer.** Zwei eigene Erklärungen sind dabei durch Messung ausgeschieden: „die Warteschlange staut“ (sie wird je Tick vollständig geleert) und „Zoom schüttet beim Abonnieren einen Rückstau aus“ (ein Lauf zeigte 149 %, der nächste 100 % — ein Burst, der nicht immer auftritt, erklärt keinen Versatz, der immer da ist). ⚑ **Zooms Anteil ist von innen NICHT messbar:** `YUVRawDataI420` hat keinen Zeitstempel, nur `AudioRawData` hat `GetTimeStamp()` — die in `ndi_sender.cpp` vorgeschlagene Ausrichtung über Zoom-Zeitstempel ist damit nicht gangbar. Bleibt ein **gemessener, einstellbarer Versatz**. ✅ **Gebaut am 30.09.2026:** Befehl `videoDelay` verzögert das **Bild** (ein Wert für alle Zoom-Quellen, 0–1000 ms, jederzeit änderbar; bei 0 ms exakt der Weg von vor Punkt 5), geprüft ohne Meeting (`delay-test` 44/44, `delay-probe` 12/12; Review mit Gegenprüfung am 30.09., 9 Befunde eingearbeitet — der wichtigste: die Ausgabe lief zunächst im Raster der Hauptschleife statt in Zooms Bildtakt). Die Owner-Abnahme per Klatschtest ([ABNAHME-STAGE3.md, A3](../packages/zoom-bridge/ABNAHME-STAGE3.md)) sollte zugleich den Vorgabewert für Connect (Stage 4) liefern. ✅ **01.10.2026: Klatschtest vom Owner als bestanden gemeldet — der eingestellte Wert wurde NICHT notiert.** Er wird im Projekttest mit dem Pre-Release **`zoom-bridge-v0.1.0`** nachgemessen (Einsatzpaket ohne Node: `zoom-join.exe` + Start-Skript, öffentliches ZIP ohne Zoom-DLLs + privates Komplett-ZIP; die Start-EXE merkt sich den zuletzt bestätigten Wert — [README Abschnitt 10](../packages/zoom-bridge/README.md)) und dann in README Abschnitt 7 und hier eingetragen. Bis dahin gibt es **keinen** Vorgabewert für Connect. Nebenbei behoben: `numberFromJson()` las `42.7` als Kennung `42`. Offen bleibt nur noch **ob der Pegel plausibel ist** (`reference_level = 0` ist NDI-seitig zitiert, Zoom-seitig angenommen). ⛑ **Betriebshinweis, gemessen:** die Quelle nicht über Lautsprecher abhören, wenn das abonnierte Mikrofon im selben Raum steht — der Ton läuft sonst akustisch im Kreis und klingt doppelt. Nicht die Brücke: sie sendet nachweislich 101 % der angegebenen Rate, und mit Kopfhörern ist die Dopplung weg. | 🟡 Abnahme 8/8 mit Vorbehalt — Punkt 5 bestanden (Owner, 01.10.2026), Versatz-Wert nicht notiert → Nachmessen im Projekttest mit Pre-Release `zoom-bridge-v0.1.0`; Pegel offen |
| **4 · Integration + Release** | Aufgeteilt in **4a** und **4b**. [Spec](superpowers/specs/2026-10-02-zoom-stage4-connect-design.md) · [Plan 4a](superpowers/plans/2026-10-02-zoom-stage4a-connect.md). **4a ✅ released 06.10.2026 als `connect-v0.2.0`:** Karte „Zoom-Meeting“ im Connect-Fenster, die Bridge läuft als Kindprozess, einzelne Teilnehmer lassen sich als NDI-Quelle laden und entladen, Ton je Quelle schaltbar, Bild-Versatz einstellbar. **`connect-v0.2.1`** (06.10.): Zugangsdaten auch von Hand eintragen. **`connect-v0.2.2`** (06.10.): Knopf „Zoom-SDK laden“; das SDK kommt aus dem privaten Repo `jm-zoom-sdk` über den Proxy (eigener SDK-Schlüssel) — [Spec](superpowers/specs/2026-10-06-connect-zoom-sdk-laden-design.md). **Lizenz-Entscheid:** nur interne Nutzung erlaubt → DLLs nur auf JM-Rechner nachladen, nie in öffentlichem Repo, Release oder Installer. **4b 🟢 in Arbeit seit 08.10. (Connect 0.3.0):** Betrieb und Auslieferung laut Spec Abschnitt 18, dazu der Nachtrag vom 06.10.: Entzug der Aufnahme-Erlaubnis stoppt laufende Quellen und lädt sie nach der Wiedererteilung automatisch wieder · keine Teilnehmernamen im Log, Löschfrist 14 Tage für alle Suite-Apps · Companion-Modul 0.2.0 · die gesammelten Randfälle aus 0.2.0. Spec-Nachtrag und Plan liegen auf dem Branch `feat/zoom-stage4b`. | 🟡 4a released, Owner-Abnahme 0.2.2 offen · 🟢 4b in Arbeit |

### Harte Grenzen (gehören ins Handbuch)

Zoom-Teilnehmer bekommen **kein Tally**, **kein privates Talkback/IFB** und **kein Mix-Minus pro Person**
(Zoom-Audio ist EIN gemeinsamer Kanal). Das sind Zoom-Grenzen, keine Designentscheidungen.

**Zeitrahmen ehrlich: mehrwöchiges C++-Vorhaben.** Beginnt auf eigenem Branch von `main`, nachdem Stage 0 steht.

### Nach Stage 4 (Stand 2026-10-08)

- 🟡 **Meetings fremder Zoom-Konten.** Der Spike auf `spike/zoom-obf` trägt: OAuth über die Proxy-Weiterleitung, das OBF-Token
  kommt an und wirkt in eigenen Meetings. In fremden Meetings antwortet Zoom mit Fehler 63, weil die App nicht veröffentlicht
  ist. Dafür braucht es das **Marketplace-Review**. Die Unterlagen liegen auf dem Spike-Branch unter `docs/zoom-marketplace/`.
  ⛔ Owner: Entscheidungen E1–E6, dann einreichen. Danach in Connect: OAuth/OBF, Endpunkt für den Entzug der Autorisierung,
  eigene Domain.
- ⚪ **Aktiver Sprecher als eigene NDI-Quelle** [#227](https://github.com/AlexmachtCode/alexzvn/issues/227) — für digitale
  Pressekonferenzen. Das SDK meldet den Sprecherwechsel (`onActiveSpeakerVideoUserChanged`).
- ⚪ **Bildschirmfreigaben als eigene NDI-Quelle** (Owner-Wunsch 08.10.2026, noch ohne Issue). Laut SDK-Headern 7.1.5 machbar:
  Der Renderer abonniert eine Freigabe mit `subscribe(shareSourceID, RAW_DATA_TYPE_SHARE)`, `onSharingStatus` meldet Beginn,
  Ende und Pause, der Ton der Freigabe kommt über `onShareAudioRawDataReceived`. ⚠️ Die Review-Unterlagen sagen bisher
  ausdrücklich „keine Bildschirmfreigabe“; das muss vor dem Einreichen entschieden werden. Gehört mit #227 in eine eigene
  Stufe „zusätzliche Quellen“.
- 🟡 **Bild-Versatz:** Den Wert aus dem Klatschtest (01.10.) hat niemand notiert. Connect hat deshalb noch keinen Vorgabewert.

---

## 1b · Leitprojekt: Master-Launcher / Suite im Netz

**Anlass (Owner, 30.09.2026):** Auf einem Rechner läuft die Suite gut. Über mehrere Rechner hinweg ließen sich Tools nicht
öffnen und bekamen keine iveo-Live-Daten. Ziel: **ein Launcher ist Master** für alle Tools, wenn eine iveo-Show aktiv ist.
Ansatz „Stern zum Master“: Jedes Tool und jeder Slave-Launcher verbindet sich selbst zum Master; die Daten laufen übers Netz,
nicht über Freigaben; Rechner werden einmal mit einem Code gekoppelt.

| Teil | Inhalt | Stand |
|---|---|---|
| **0 · Sofort-Fixes** | Launcher 0.11.1, Timer 0.11.2, Titler 0.8.2 (30.09., PR #237/#238) | ✅ released |
| **1 · Master-Link-Fundament** | Rolle Master/Slave, Koppeln per Code, Finden per mDNS je Netzwerkkarte, Netzwerkwahl ([#234](https://github.com/AlexmachtCode/alexzvn/issues/234), geschlossen), verschlüsselte Leitung. Launcher 0.12.0, Timer 0.12.0, Titler 0.9.0 (01.10., PR #239). [Spec](superpowers/specs/2026-09-30-master-link-teil1-design.md) · [Abnahme](../packages/master-link/ABNAHME.md) | ✅ released, Zwei-PC-Abnahme bestanden (01.10.) |
| **2a · Stabile Ablauf-Kennungen** | Jeder Ablauf-Punkt behält seine Kennung; Timer und Rundown gleichen nach einer iveo-Änderung ohne Positions- oder Aktionsverlust ab. Behebt [#235](https://github.com/AlexmachtCode/alexzvn/issues/235) am Einzelplatz. Launcher/Timer 0.13.0, Rundown 0.6.0 (02.10.); Restbefunde in Launcher 0.13.1 (02.10.). [Spec](superpowers/specs/2026-10-01-master-link-teil2a-design.md) | ✅ released · 🟡 Owner: [ABNAHME-2a.md](../apps/rundown/ABNAHME-2a.md) |
| **2b R1 · Titler hält seinen Speaker** | Speaker-Kennung aus iveo bis in den Titler, ein Abruffehler leert die Speaker nicht mehr, Rundown-Speaker-Aktion über die Kennung. Launcher 0.13.2 (Vorbereitung) und 0.14.0, Titler 0.10.0, Rundown 0.7.0 (05.10.). Bekannte Grenze: Trägt nach einer Änderung ein **anderer** Speaker den Namen der Person auf Sendung, zeigt der Titler dessen Angaben. [Spec](superpowers/specs/2026-10-02-master-link-teil2b-design.md) Teil A | ✅ released · 🟡 Owner: Test in der Suite, [ABNAHME-2b-R1.md](../apps/titler/ABNAHME-2b-R1.md) |
| **2b R2 · Show-Daten über den Verbund** | `abo` → `stand` → `aenderung` über die Leitung aus Teil 1; Timer, Titler und Rundown auf Rechner B folgen der offenen Show des Masters, auch ohne Launcher auf B. Spec Teil B (ab Abschnitt 12) ist freigegeben, der Plan fehlt. Dazu fünf Restbefunde aus R1. | 🔵 Plan als Nächstes |
| **2c · iveo live je Bühne** | gegen den Prod-Server: je Bühne Abfrage von `/stages/{s}/live`, Anwesenheit je Speaker | ⚪ |
| **Binärdaten** | Dokumente bis 33 MB, Materialien, Fotos über den Verbund | ⚪ |
| **3 · Fernstart** | Tools auf anderen Rechnern starten | ⚪ |
| **4 · Show-Zentrale** | eigenes Fenster am Master (Muster Titler-Recall-Board) | ⚪ |

---

## 2 · Parallel-Spuren

Laufen neben den beiden Leitprojekten. Alle Spuren sind freigegeben.

### Lane A — Kunden-Features 🟢 **offene Meldungen aus dem Launcher**

Stand 2026-10-08, am Code nachgesehen:

- **Presenter [#228](https://github.com/AlexmachtCode/alexzvn/issues/228)** 🟢 „On Air“ erst im Präsentationsmodus.
  Ursache gefunden: `apps/presenter/src/main/control-server.ts` meldet `live: s.screen === 'live'`, und `screen` steht
  schon beim Start auf `'live'` (= „nicht schwarz/weiß“). Der Launcher zeigt bei `live=1` „ON AIR“. Abhilfe in einer Zeile:
  `live` nur bei laufender Präsentation.
- **App Designer [#231](https://github.com/AlexmachtCode/alexzvn/issues/231)** 🟢 Variablenname nimmt nur einen Buchstaben.
  Ursache gefunden: Die Zeilen im Variablen-Feld haben den Namen selbst als React-`key`
  (`apps/app-designer/src/renderer/src/components/SidePanels.tsx`), jede Taste baut die Zeile neu und der Fokus geht verloren.
  Dazu verwaisen Regeln, die die Variable beim alten Namen nennen.
- **App Designer [#232](https://github.com/AlexmachtCode/alexzvn/issues/232)** Schriftart wählbar, eigenes App-Icon statt
  Electron-Standard · **[#230](https://github.com/AlexmachtCode/alexzvn/issues/230)** Objekte mit mehreren Zuständen, Farbe
  ändern bei Wenn → Dann. Gehören zu Welle 3 ([#200](https://github.com/AlexmachtCode/alexzvn/issues/200)).
- **Launcher [#236](https://github.com/AlexmachtCode/alexzvn/issues/236)** Show-Fenster läuft über den Bildschirm. Gemeldet
  mit Launcher 0.11.0; vermutlich mit 0.13.1 behoben (die Fußzeile bleibt im Fenster, gleiches Muster wie #233).
  🟡 Owner prüft, dann schließen.
- **Rundown [#235](https://github.com/AlexmachtCode/alexzvn/issues/235)** folgt iveo live: gebaut in Master-Launcher 2a/2b
  (Abschnitt 1b). 🟡 Nach dem Test in der Suite schließen.
- **Battle [#213](https://github.com/AlexmachtCode/alexzvn/issues/213)** 🟢 **offen, noch nicht geplant.**
  „Aktuell nur ein Jurypunkt pro Runde möglich, bitte auf 7 Judges erweitern." Betrifft Wertung und
  VS-Titler-Anzeige in [`apps/battle`](../apps/battle/); braucht eine eigene Brainstorming-Runde
  (Wie werden 7 Wertungen dargestellt? Summe, Mittel, Streichresultat? Wer trägt sie ein?).
- **Caption [#204](https://github.com/AlexmachtCode/alexzvn/issues/204)** ✅ `caption-v0.4.0` — Fachwörter-Wörterbuch
  (`--prompt`) und persistenter `whisper-server` statt Modell-Reload je Chunk. Issue geschlossen.
- **Timer [#11](https://github.com/AlexmachtCode/alexzvn/issues/11)** ✅ in vier Scheiben:
  `v0.8.0` geplante Startzeiten + Soll/Ist-Drift · `v0.9.0` Import-Mapping (Spaltenzuordnung mit Vorschau) ·
  `v0.10.0` Verantwortlich/Kategorie je Punkt · `v0.11.0` iveo reicht Startzeit/Verantwortlich/Kategorie
  bis ins Timetable durch. **Issue geschlossen.**
- **Interpreter [#208](https://github.com/AlexmachtCode/alexzvn/issues/208)** ✅ `interpreter-v0.2.0` — virtuelles
  Kabel erkennen, Zoom-Gegenstück beim Namen nennen, Download-Verweis wenn keins da ist. Issue **noch offen
  bis zum Runtime-Test**.

**Zwei Feldfehler dazwischen, beide behoben:** `timer-v0.11.1` — die CSP erlaubte die *Lausch*-Adresse
(`0.0.0.0`) statt der *Verbindungs*-Adresse (`127.0.0.1`); der Timer stand in **jedem Installer ab 0.5.0**
dauerhaft auf „Offline", jeder Knopf wirkungslos. Im Dev nie sichtbar, weil die CSP dort alles durchlässt.
Es war der zweite Fall dieser Falle nach JM Connect — der Selbsttest von `@jm/app-runtime` hält sie fest.

### Lane B — Welle-6-Abschluss (vor allem Verifikation, wenig Code)

- Live-Test **Bildschirmfreigabe** im gepackten Build (6.3a — Permission-Handler-Pfad existiert nur im Paket).
- Live-Test **iveo-QR nach App-Neustart** (6.3b — `safeStorage`-Persistenz des Raum-Secrets).
- **Interpreter-Ducking-Live-Test** [#164](https://github.com/AlexmachtCode/alexzvn/issues/164) (VB-Cable + hörbares Ducking) → danach #164 schließen.
  Seit `interpreter-v0.2.0` sagt die App selbst, welches Gerät in Zoom zu wählen ist — der Test wird dadurch einfacher.
- **Runtime-Tests der Lane-A-Releases:** Timer (iveo-Felder + Drift-Pille, #11) und Interpreter (Kabel-Erkennung, #208).
- **50-Gäste-Lasttest** (die Gästeobergrenze ist eine Schutzgrenze, kein gemessener Wert).
- **Abnahmen aus den Leitprojekten** (Stand 08.10.): Connect [ABNAHME-0.2.2.md](../apps/connect/ABNAHME-0.2.2.md) samt
  Owner-Schritten am Proxy (Token-Zugriff auf `jm-zoom-sdk`, `ZOOM_SDK_KEY` setzen) · Master-Launcher 2a und 2b R1
  (Abschnitt 1b).

### Lane C — Security & Betrieb

- ✅ **Proxy-Härtung** [#61](https://github.com/AlexmachtCode/alexzvn/issues/61): Rate-Limit, Größenlimits und
  Fehler-Redaktion (PR #133) sind deployt, das GitHub-Token liegt verschlüsselt (PR #134). #61 und das Sammel-Issue
  [#57](https://github.com/AlexmachtCode/alexzvn/issues/57) sind am 08.10.2026 geschlossen.
- **Studio-Control: CORS auf Whitelist** [#246](https://github.com/AlexmachtCode/alexzvn/issues/246) (Befund A3 aus #61,
  noch offen: `cors: { origin: '*' }`).
- **iveo-Prod-URL** scharfschalten (📌 langstehend; Staging-Base bleibt bis dahin).
- *Optional:* **Installer signieren (C3)** [#245](https://github.com/AlexmachtCode/alexzvn/issues/245) — braucht Zertifikat/Budget, zurückgestellt.
- **Kleintickets aus Zoom 0.2.x** (noch ohne Issue): Warnung `MODULE_TYPELESS_PACKAGE_JSON` in den Proxy-Tests ·
  NDI-Kindprozesse erben `JMPS_*`-Umgebungsvariablen · `worker.test.mjs` läuft nicht in der CI · Bridge-Selbsttest
  gelegentlich wackelig.
- ⚪ **RELOAD im secure-Modus vor der Auth** (Rest aus Master-Link Teil 2a, vorbestehend): Der Launcher setzt
  `connected` schon beim (TLS-)Verbindungsaufbau (`apps/launcher/src/main/health.ts:86-91`), die Auth läuft erst
  danach. `sendControlCommand` (`health.ts:195-204`) zählt ein `… RELOAD` in diesem Fenster als erreicht, also holt
  der Merker aus `reload-nachholen.ts` es nicht nach. Der Server wertet eine Befehlszeile vor der AUTH-Zeile als
  Fehlversuch (`packages/suite-control-protocol/src/server.ts:274-281`: AUTHFAIL, Verbindung zu, zählt zur Sperre).
  Folge: Timer, Titler oder Rundown bleiben bis zur nächsten Änderung auf altem Stand. Abhilfe: erst nach dem ersten
  STATE (= Auth durch) als erreichbar zählen. Kein Issue angelegt.

### Lane D — Switcher-Ausgabe

**D1 — Streaming sagt die Wahrheit: ✅ released 2026-08-07 als `switcher-v0.10.0`** (PR #215).
Ausgelöst durch die Meldung „streamt nur 1280×720p25". Full-HD lief längst — die Einstellungen behaupteten
vier Dinge, die der Code seit 0.8.0/0.9.0 nicht mehr tat. Daneben ein echter Defekt: der Canvas wurde mit
fest verdrahteten 30 fps abgegriffen, die Bildratenwahl erreichte nur NDI und den Zweitbildschirm.
Jetzt: Anzeige liest die tatsächlichen Werte, `OutputController.setFps` wirkt bis in Aufnahme und RTMP,
„NDI-Bildrate" heißt „Ausgabe-Bildrate", Bitraten-Empfehlung folgt der Auflösung, Aufnahme-Vorgabe 16.000
statt 12.000 kbit/s. Dazu der **erste Selbsttest des Switchers** (16 Prüfungen).
✅ **Erledigt 2026-08-10:** Installer lokal gebaut, [Release `switcher-v0.10.0`](https://github.com/AlexmachtCode/alexzvn/releases/tag/switcher-v0.10.0)
samt Asset veröffentlicht, `suite.json` auf 0.10.0 (PR #219). Das Tag stand seit dem 07.08. auf origin, aber
ohne Release — der Katalog stand deshalb zu Recht noch auf 0.9.0: ein früherer Bump hätte eine Aktualisierung
angeboten, die es nicht zum Herunterladen gab.
📌 **Offen (Owner, Laufzeit):** 1080p + 50 fps senden und am Ziel messen.
📌 **Zu prüfen (Betrieb), 10 Sekunden:** Launcher öffnen — steht dort Switcher **0.10.0**, ist alles gut
und **nichts** zu tun.

> **Berichtigung vom 2026-08-10.** Hier stand zuerst „Proxy neu ausrollen". Am Code nachgemessen ist das
> falsch: `worker.js` holt `suite.json` und `changelog.json` bei **jedem Aufruf** live über die
> GitHub-API vom Branch in `MANIFEST_REF` (60 s Cache). Ein Katalog-Bump auf `main` ist damit sofort
> live — genau dafür ist es so gebaut („damit neue Tools ohne Launcher-Release oder Worker-Deploy
> erscheinen"). Ein Deploy ist nur nötig, wenn sich `worker.js` oder eine Variable **ändert**.
>
> Offen bleibt nur eine Frage, die von hier aus nicht beantwortbar ist: ob der **ausgerollte** Worker
> schon `MANIFEST_REF = "main"` trägt. In `wrangler.toml` steht `main`, aber ob seit dieser Änderung
> einmal deployt wurde, sieht man ohne Cloudflare-Zugang nicht — die Route `/suite.json` ist
> schlüsselgeschützt (401 ohne `PROXY_KEY`). Zeigt der Launcher 0.10.0, ist die Frage beantwortet.
> Zeigt er 0.9.0, dann einmal `cd services/release-proxy && npx wrangler deploy`.

**D2a — natives DeckLink-Addon: ✅ gemergt 2026-08-10** (PR #218), `packages/decklink`.
Privat (`"private": true`), **kein Release** — es wird erst mit D2b als Teil des Switchers ausgeliefert.
Kann: Karten und Normen auflisten, Ausgang öffnen, BGRA-Vollbilder in geplanter Wiedergabe einreihen,
Verluste **getrennt nach Ursache** zählen. Dazu ein Sondierlauf mit bewegtem Testbild (`npm run spike`).
Zwei Setzungen, die D2b erbt: das SDK liefert **nur eine IDL** (Header entstehen zur Bauzeit per MIDL, es
gibt **keine DLL zum Mitliefern** — COM holt die Umsetzung aus dem Desktop-Video-Treiber), und das **Urteil
über brauchbare Normen liegt in TypeScript** (`src/modes.ts`, 22 Selbsttests), nicht in C++ — dadurch ohne
Karte prüfbar.
📌 **Offen (Owner, Kartenrechner):** die Prüfliste in der Spec abarbeiten. Punkt 1 zuerst — kommt der
Rückruf überhaupt an? Bleiben `zu-spät`/`verworfen` hartnäckig 0, während der Laufbalken springt, ist die
Karten-Seite von `stats()` blind und **alle** weiteren Messungen sind wertlos.

**D2b — Anbindung an den Switcher:** utilityProcess + Kartenauswahl in den Einstellungen, Programmbild raus
über SDI. Der Frameweg steht schon: der Renderer wandelt sein Programmbild heute für NDI nach BGRA — kann
die Karte BGRA, geht **derselbe Puffer ohne jede Farbwandlung** hinaus. Baubar ohne Karte, verifizierbar nur
am Kartenrechner. **Kein Issue → neu anlegen.**
Für D2b vorgemerkt (aus dem Abschluss-Review von D2a):
- **Drift-Wächter für die Spiegel-Konstanten.** `COMPOSABLE` == `RESOLUTIONS` und `OFFERED_FPS` ==
  `OUTPUT_FPS_OPTIONS` stimmen heute (nachgemessen), aber `OUTPUT_FPS_OPTIONS` liegt im Renderer-Store, aus
  dem ein Paket nicht importieren kann → nach `src/shared/` ziehen oder per Selbsttest vergleichen.
- **`napi_add_env_cleanup_hook` fehlt:** stirbt der Trägerprozess ohne `destroy()`, bleibt
  `DisableVideoOutput` aus.
- **Ton** bleibt die dritte Scheibe (Owner-Vorgabe: Slice 1 nur Bild).

### Lane E — Steuerpulte vereinheitlichen (#165)

Eigene Roadmap: [`docs/ux/suite-ux-roadmap.md`](ux/suite-ux-roadmap.md). Leitprinzip: **Live-Bedienung
sichtbar, Einrichtung weggeräumt.** Stand am 2026-08-07 **am Code gemessen** (das UX-Dokument selbst war
nicht nachgeführt, und drei seiner fünf Dateipfade zeigen inzwischen ins Leere — alle Apps haben ein
`src/` dazubekommen):

| Phase | Stand |
|---|---|
| 1 · Fundament + Titler-Pilot | ✅ **fertig**, PR #168 gemergt 2026-07-04. `Collapsible`/`SettingsSection`/`Tabs` liegen in `@jm/ui`, die Titler-`OperatorView` nutzt sie durchgehend. |
| 2 · Switcher | ❌ **nicht begonnen.** `SettingsView.tsx` hat null `@jm/ui`-Importe und baut eigene `<section>`-Karten. |
| 3 · Timer | ~ **halb.** `Sidebar.tsx` zieht nur `Logo` und `cn`; die vier eigenen Primitive liegen weiter unter `components/ui/`. |
| 4 · Q&A + Rundown | ~ **halb, und die Hälfte war still erledigt.** Die Token-Migration ist durch (keine rohen `neutral-*`-Klassen mehr in beiden Apps). Offen bleibt Modal → Reiter: `apps/qa/.../Settings.tsx` ist weiter ein `fixed inset-0`-Overlay. |
| 5 · Geteilte Sektions-Komponenten | ❌ **nie begonnen.** |

⚠️ **Doppelt geführt:** „Onboarding-Reste D1-Teil-2 (timer/switcher-Primitive auf `@jm/ui`)" unter
*Geparkt* meint dieselbe Arbeit wie Phase 2+3. Bei der nächsten Runde zusammenführen, nicht zweimal planen.

Phase 2 ist der billigste Einstieg (eine Datei, rein anzeigend) und wäre gut in einem Zug mit der
nächsten Switcher-Änderung zu erledigen.

**Nachgemessen am 2026-10-08: unverändert seit dem 07.08.** Die Tabelle oben stimmt weiter. Dazu:
- Die Einstellungs-Bausteine (`SettingsSection`, `Collapsible`, `Tabs`) nutzen nur **Titler** und **App Designer**.
  **Connect** hat keinen einzigen `@jm/ui`-Import.
- Issue #165 ist „JM Titler“ und seit dem 05.07. geschlossen. Die Spur lebt nur in diesem Dokument und in
  `docs/ux/suite-ux-roadmap.md`.
- 🔵 **Owner 08.10.2026: „UX-Update für alle Tools“.** Der bisherige Plan deckt nur 5 der 26 Apps ab. Vor dem
  nächsten Schritt den Umfang klären (Brainstorming): welche Tools, in welcher Reihenfolge, und ob Phase 5 (geteilte
  Sektionen) vorgezogen wird, damit nicht jede App einzeln umgebaut wird.

---

## 3 · Was läuft wann

**Stand 2026-10-08 (Owner-Auswahl vom selben Tag):**

- 🟢 **Läuft:** Zoom 4b (Connect 0.3.0), subagent-driven.
- 🟢 **Parallel dazu:** diese Roadmap nachführen · #228 Presenter und #231 App Designer beheben · UX-Spur: Umfang klären ·
  Master-Launcher 2b R2: Plan schreiben.
- 🟡 **Beim Owner:** Abnahmen und Live-Tests (Lane B), Review-Entscheidungen E1–E6 für Zoom, Prüfung von #236.
- 🔵 **Danach:** UX-Spur nach geklärtem Umfang · 2b R2 umsetzen · Zoom „zusätzliche Quellen“ (#227 + Freigaben) ·
  #213 Battle-Judges · Lane D2b.
- ⚪ **Später:** 2c, Fernstart, Show-Zentrale · App-Designer-Welle 3 · C3.

<details>
<summary>Planung vom 2026-08-07 (überholt, stehen gelassen)</summary>

- **Während Stage 0** (Owner beschafft) 🟢 **Jetzt-Block:**
  ~~Lane D2a (DeckLink-Addon)~~ ✅ gemergt 2026-08-10 · Lane C (Proxy-Deploy #61 — jetzt zusätzlich nötig,
  damit 0.10.0 im Launcher ankommt · iveo-URL) · Lane B (Live-Tests, inkl. Runtime-Test #208) ·
  Lane A #213 Battle-Judges.
  ⛔ **Stage 0 ist am 2026-08-10 an einer Konto-Berechtigung hängengeblieben, nicht an Code.**
  Bindung, `InitSDK`, Anmeldung und Nachrichtenschleife sind gemessen und tragen; die
  Rohdaten-Freischaltung fehlt. Bis Zoom antwortet, ist am Zoom-Strang **nichts** zu bauen — das
  Wartefenster wird also länger, nicht kürzer. Der Jetzt-Block trägt die Arbeit allein.
- **Während Stage 1–2** (C++-Bau läuft) 🔵:
  Lane D2b Switcher-Anbindung · Lane E Phase 2+3 (billig, gut nebenher) · neue Kundenwünsche in Lane A.
- **Nach Zoom-Release** ⚪: Härtung, Lane E Phase 4+5, dann geparkte Wünsche nach Bedarf.

</details>

---

## 4 · Issue-Hygiene (Aufräum-Empfehlung)

- ✅ **08.10.2026 geschlossen:** [#57](https://github.com/AlexmachtCode/alexzvn/issues/57) Optimierung (Sammel-Issue),
  [#61](https://github.com/AlexmachtCode/alexzvn/issues/61) P3 und [#234](https://github.com/AlexmachtCode/alexzvn/issues/234)
  Netzwerkwahl. Die Reste aus #61 laufen als [#246](https://github.com/AlexmachtCode/alexzvn/issues/246) (A3) und
  [#245](https://github.com/AlexmachtCode/alexzvn/issues/245) (C3) weiter.
- **[#235](https://github.com/AlexmachtCode/alexzvn/issues/235) Rundown** und **[#236](https://github.com/AlexmachtCode/alexzvn/issues/236) Launcher:**
  vermutlich erledigt (Abschnitt 1b bzw. Launcher 0.13.1) → nach Owner-Prüfung schließen.
- **[#197](https://github.com/AlexmachtCode/alexzvn/issues/197) Zoom:** bleibt offen, bis 4b released ist; die Folgearbeit (fremde Konten, #227, Freigaben) bekommt eigene Issues.
- **[#164](https://github.com/AlexmachtCode/alexzvn/issues/164) Interpreter:** gebaut+released → **nach bestandenem Ducking-Test schließen**.
- **[#11](https://github.com/AlexmachtCode/alexzvn/issues/11) Timer:** ✅ **geschlossen.**
  **[#208](https://github.com/AlexmachtCode/alexzvn/issues/208) Interpreter:** ausgeliefert → **nach Runtime-Test schließen**.
  ⚠️ Deutschsprachige PR-Texte schließen Issues **nicht** automatisch — GitHub erkennt nur englische Schlüsselwörter.
- **Neu anlegen:** Switcher-Decklink/SDI-Issue — D2a ist ohne Issue gebaut und gemergt (PR #218); das Issue
  gehört jetzt an **D2b** (Anbindung an den Switcher) und an die Kartenrechner-Verifikation.
- **[#200](https://github.com/AlexmachtCode/alexzvn/issues/200) App-Designer W3:** bleibt offen, niedrige Prio → geparkt.
- ✅ **Drei tote Remote-Branches** (`feat/jm-production-suite`, `fix/suite-titler-launcher-caption`,
  `feat/jm-sync-phase2`) sind gelöscht, am 2026-10-08 nachgesehen.

---

## 5 · Geparkt / niedrige Priorität

- **App-Designer Welle 3** [#200](https://github.com/AlexmachtCode/alexzvn/issues/200) (Bundle-Optimierung, CSV-Auswertung, Autosave) — ausdrücklich „nach Bedarf".
- **Onboarding-Reste:** D2/D3-Reste. (D1-Teil-2 „timer/switcher-Primitive auf `@jm/ui`" ist **dieselbe
  Arbeit wie Lane E Phase 2+3** — dort geführt, hier nicht noch einmal.)
- **C4-c iveo-Speaker-Join** — extern blockiert (iveo-API v1 liefert `program_speakers` nicht).
- **Kochbuch:** Polaris-API-Vertrag (Endpoint + Schema-Steuerung, Owner liefert nach) + cookbook-web-Deploy.
- **Binär-Signierung C3** [#245](https://github.com/AlexmachtCode/alexzvn/issues/245) — Zertifikate/Budget offen.
- **VB-CABLE-Lizenzen** — der Interpreter empfiehlt VB-CABLE; privat ist es Donationware, **gewerblich
  lizenzpflichtig pro PC**, Weitergabe ab zehn Einheiten nur per Vertriebsabkommen mit VB-Audio.
  Einkaufsentscheidung, keine Entwicklungsaufgabe. Deshalb wird der Treiber auch **nicht mitgebundelt**
  (signierter Kernel-Treiber → Adminrechte, Neustart, Haftung für fremden Code).
- **Timer-Import:** Kopfzeilen-Wahl, Mapping pro Vorlage merken, generischer Spalten-Beutel — vorgemerkt, nicht gebaut.

---

## Anhang · Ausgeliefert

### Seit dem 2026-08-07 (nachgetragen am 2026-10-08)

- **Switcher** `0.10.0` (10.08.) — Streaming sagt die Wahrheit (Lane D1). **DeckLink-Addon** (D2a) gemergt, ohne Release.
- **Zoom-Bridge** Pre-Release `zoom-bridge-v0.1.0` (01.10.) — Einsatzpaket für Projekttests, öffentlich ohne Zoom-DLLs.
- **JM Connect** `0.2.0`, `0.2.1`, `0.2.2` (06.10.) — Zoom in Connect, Zugang von Hand, SDK nachladen (Abschnitt 1).
- **Master-Launcher** (Abschnitt 1b): Launcher `0.11.1` → `0.14.0`, Timer `0.11.2` → `0.13.0`, Titler `0.8.2` → `0.10.0`,
  Rundown `0.6.0` → `0.7.0` (30.09.–05.10.).

### Baseline vom 2026-08-07

`main` trug damals **24 Werkzeuge** (heute 26 App-Ordner unter `apps/`). Damals bereits released:

- **Welle 1–5** — Steuerebene (mDNS/Discovery, `.jmshow`, Health-Dashboard), ATEM/OBS-Bridge, Companion-Gateway (8735).
- **Welle 6 „JM Connect"** (`connect-v0.1.0`) — Green Room (Lobby/Approve/Tally), Rückkanal + Mix-Minus, Talkback-PTT, Gast-Bildschirm als eigene NDI-Quelle, iveo-Provisionierung, Folien-Kopplung an Presenter. EU-Pinning (6.6).
- **JM Interpreter** (`interpreter-v0.2.0`) — Floor/Dolmetscher-Ducking; seit 0.2.0 erkennt er bekannte virtuelle
  Kabel und nennt das in Zoom zu wählende Gerät (Live-Ducking-Test noch offen → Lane B).
- **JM Timer** (`timer-v0.11.1`) — geplante Startzeiten mit Soll/Ist-Drift, Import-Spaltenzuordnung mit Vorschau,
  Verantwortlich/Kategorie je Punkt, iveo-Felder bis ins Timetable durchgereicht.
- **JM Caption** (`caption-v0.4.0`) — Fachwörter-Wörterbuch, persistenter whisper-server statt Reload je Chunk.
- **JM App Designer** (`app-designer-v0.1.0`) — vier Spieltypen, Editor, Sandbox, Kiosk, Export.
- **Switcher** — NDI-Programmton (`0.8.0`), echtes Full-HD + Zweitbildschirm (`0.9.0`).
- **titler / caption / ndi-screen-capture** — rAF-/Background-Throttle-Fix (`0.x.1`).
- **Onboarding-Roadmap A/B/C/D** — Setup-Automatik, First-Run-Assistent, Szenario-Start, Tool-Manuals (alle 21 Katalog-Tools), Token-Migration, Barrierefreiheit-Modal.
- **Security P0–P4** — Auth+TLS-Transport, sandbox+CSP suite-weit, signierte mDNS, Proxy-Härtung (Deploy offen → Lane C).
- **Kochbuch** — 41 Rezepte, live über Proxy, im Launcher ab `0.5.2`.
