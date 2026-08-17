# Zoom Stage 3: Ton je Teilnehmer in die NDI-Quelle

**Issue #197, Stufe 3 von 4.** Baut auf Stage 2 (Video je Teilnehmer als eigene
NDI-Quelle, Owner-Abnahme 13./14.08.2026, PR #226).

**Ziel in einem Satz:** Der Ton eines abonnierten Zoom-Teilnehmers läuft in
**derselben** NDI-Quelle mit, die bereits sein Bild führt.

---

## 1 · Was Stage 2 bereitstellt

- `packages/zoom-bridge/` mit `zoom-bridge.exe`: Befehle über stdin, Ereignisse
  als JSON-Zeilen über stdout, Klartext für Menschen über stderr.
- Eine Abo-Karte `g_subs` (`user_id → Sub`), **ausschließlich** vom Hauptthread
  verändert. Jedes `Sub` hält seinen eigenen `NdiSender`, seine eigene Sperre
  (`fieldMutex`), sowie `imAbbau` und `teilnehmerWeg` als Merkzeichen.
- `videoTick()` läuft im Hauptthread direkt nach `pumpOnce()`, alle 10 ms, und
  betreibt den Schwarzbild-Herzschlag.
- `sessionStartRawRecording()` — der Schalter, der Zooms Rohdaten-Rückrufe
  freigibt. Idempotent je Meeting. **Gilt für Bild und Ton gleichermaßen.**
- Der Abbau ist geordnet: `videoUnsubscribe`, `videoShutdownAll`,
  `videoMeetingEnded`.

## 2 · Gemessene Grundlagen

Aus den SDK-Kopfsätzen (`rawdata_audio_helper_interface.h`,
`zoom_sdk_raw_data_def.h`) und der NDI-6-SDK (`Processing.NDI.utilities.h`):

| Tatsache | Beleg |
| --- | --- |
| Ton wird **einmal global** abonniert, nicht je Person | `IZoomSDKAudioRawDataHelper::subscribe(pDelegate, bWithInterpreters)` |
| Danach kommt der Ton **aller** Teilnehmer herein | `onOneWayAudioRawDataReceived(AudioRawData*, uint32_t user_id)` |
| Der Rückruf liefert **nur** eine `user_id`, keinen Zeiger auf unser Abo | dieselbe Signatur |
| `bWithInterpreters = true` macht lokale Dolmetscher-Funktionen unbrauchbar | Kopfsatz wörtlich: *„it will cause your local interpreter related functions to be unavailable"* |
| Datenform: PCM16, mit Abtastrate und Kanalzahl dabei | `AudioRawData::GetBuffer/GetBufferLen/GetSampleRate/GetChannelNum/GetTimeStamp` |
| NDI nimmt **interleaved PCM16 direkt** — keine Umrechnung | `util_send_send_audio_interleaved_16s`, `NDIlib_audio_frame_interleaved_16s_t` |
| NDI kann die Taktung selbst erzeugen | `NDIlib_send_timecode_synthesize` |

**Der tragende Unterschied zu Stage 2:** Beim Bild hält jeder Delegate einen
rohen Zeiger auf sein `Sub` — kein Nachschlagen. Beim Ton **muss** in `g_subs`
nachgeschlagen werden, und diese Karte verändert der Hauptthread laufend.

**Und schärfer:** ein `videoUnsubscribe` baut den Renderer ab und stoppt damit
die **Bild**-Rückrufe. Den **Ton**-Rückruf stoppt es nicht — das Ton-Abo ist
global. Ein Tonpaket für einen soeben abgebauten Teilnehmer ist daher kein
Sonderfall, sondern zu erwarten.

## 3 · Owner-Entscheidungen (14.08.2026)

1. **Der Ton läuft in derselben NDI-Quelle wie das Bild.** Eine Person = ein
   Eingang im Switcher. Folge: Ton gibt es nur für Teilnehmer mit Bild-Abo.
2. **Bei Schweigen wird Stille gesendet**, der Tonstrom reißt nicht ab —
   Gegenstück zum Schwarzbild-Herzschlag.
3. **Der Ton ist je Abo schaltbar, Vorgabe an.** Wer den Zoom-Ton bereits auf
   anderem Weg im Saal hat, vermeidet so doppelten Ton.
4. **Betriebsgröße bleibt 5** gleichzeitige Zuschaltungen je Veranstaltung.

## 4 · Aufbau

**Neu:** `native/audio.h` / `native/audio.cpp` — Ton-Lauscher, Warteschlange,
Leeren, Stille-Herzschlag.

**Erweitert:** `NdiSender` um `sendAudio()` und `sendSilence()`;
`native/video.cpp` um den Aufruf des Leerens im Tick und um die Tonfelder je
`Sub`; `src/protocol.ts` und `src/state.ts` um Befehl, Ereignis und Zustand.

**Das Ton-Abo:** `GetAudioRawdataHelper()->subscribe(delegate, false)` läuft
beim **ersten** Abo mit eingeschaltetem Ton, idempotent je Meeting — dasselbe
Muster wie `sessionStartRawRecording()`, zurückgesetzt beim Meeting-Ende.
`unSubscribe()` beim Abbau des letzten Abos bzw. beim Prozessende.

Der Lauscher ist ein einziges, prozesslanges Objekt. Er hat damit selbst keine
Lebensdauerfrage — nur die Abos haben eine, und die löst Abschnitt 5.

## 5 · Datenweg und Threads

**Der Ton-Rückruf berührt die Abo-Karte nie.**

1. SDK-Thread: `onOneWayAudioRawDataReceived(data, user_id)`.
2. `user_id`, Abtastrate, Kanalzahl und die Abtastwerte in einen freien Platz
   der Warteschlange kopieren.
3. Sofortige Rückkehr. Kein Blick in `g_subs`, kein Senden, keine `Sub`-Sperre.
4. Hauptthread, im Tick: Warteschlange leeren. Je Paket das Abo nachschlagen;
   fehlt es, ist der Ton aus oder `imAbbau` gesetzt → **verwerfen**.
5. **Erst hier** prüfen: die Pufferlänge muss ein Vielfaches von
   `channels × 2` sein. Passt sie nicht → `audioBufferMismatch`, **einmal je
   Abo**, Paket verworfen.
6. Senden.

**Warum die Prüfung im Hauptthread sitzt und nicht im Rückruf:** „einmal je
Abo" braucht ein Merkzeichen am `Sub` — und genau das darf der Rückruf nicht
anfassen. Eine Prüfung im Rückruf müsste entweder jedes fehlerhafte Paket
melden (dreißig Meldungen je Sekunde ertränken jede andere Ausgabe) oder eine
zweite Buchführung über die Abos aufmachen. Ein schlechtes Paket eine
Warteschlange weit mitzuschleppen kostet nichts; es wird verworfen, bevor es
gesendet wird.

Damit wird `g_subs` weiterhin **ausschließlich** vom Hauptthread berührt. Die
Lebensdauerfrage aus Abschnitt 2 entfällt, statt bewacht zu werden: ein Paket
für ein verschwundenes Abo findet nichts und wird verworfen — die richtige
Antwort.

**Die Warteschlange** hat feste Kapazität und eine eigene Sperre, die **nie**
über einen NDI-Sendeaufruf gehalten wird. Bei Überlauf fliegt das **älteste**
Paket heraus, nicht das neue: verspäteter Ton ist wertlos.

Verworfene Pakete verschwinden nicht still — aber die Meldung gehört **nicht**
an ein Abo: die Warteschlange ist eine, für alle Teilnehmer gemeinsam, und der
Rückruf, der verwirft, weiß gar nicht, zu welchem Abo das Paket gehört hätte.
Ein globaler Zähler wird darum im Rückruf hochgesetzt und im Tick **einmal**
als `audioQueueOverflow` gemeldet (`where:"audio"`, ohne `id`), danach erst
wieder nach dem Zurücksetzen beim Meeting-Ende. Ein Überlauf ist eine Aussage
über die Maschine, nicht über einen Gast.

**Auslegung:** bei 5 Teilnehmern, 32 kHz Mono und 10-ms-Paketen sind das rund
500 Pakete je Sekunde zu je etwa 640 Byte. Die Warteschlange fasst 256 Plätze
zu je 4 KB (1 MB), also gut eine halbe Sekunde Vorrat — reichlich für ein
Leeren alle 10 ms und klein genug, um bei einem Hänger nicht ins Uferlose zu
wachsen.

## 6 · Der Stille-Herzschlag

**Stille beginnt erst nach dem ersten echten Paket.** Vorher sind Abtastrate
und Kanalzahl unbekannt, und ein erfundener Wert ließe sich später nicht von
einem gemessenen unterscheiden. Das ist dieselbe Regel, nach der ein Abo ohne
je gesehenes Bild auf `subscribed` steht und **nicht** auf `cameraOff`.

Ab dem ersten Paket steht das Format fest. Bleibt der Ton länger als **40 ms**
aus, schiebt der Tick Nulldaten im zuletzt gesehenen Format nach, und zwar so
lange das Abo lebt. Die Blockgröße entspricht der Tick-Frist (10 ms), damit
Stille und echter Ton nahtlos ineinander übergehen.

**Die 40 ms sind ein Anfangswert, kein Messergebnis.** Zoom liefert Pakete
etwa alle 10–20 ms; 40 ms lassen also zwei bis drei aus, bevor der Herzschlag
greift, und genau dieses Loch könnte am Empfänger knacken. Abnahmepunkt 2
prüft das mit dem Ohr. Knackt es, gehört der Wert herunter — dann aber mit der
Messung als Beleg, nicht auf Verdacht.

**Praktische Folge:** ein von Anfang an stummgeschalteter Gast hat Bild ohne
Ton; in dem Moment, in dem er zum ersten Mal spricht, setzt der Tonstrom ein
und hört bis zum Ende des Abos nicht wieder auf.

## 7 · Protokoll

**Befehl** — ein Feld mehr, kein zweites Befehlspaar:

```
{ "cmd":"videoSubscribe", "id":16778240, "resolution":"720p", "audio":true }
```

`audio` ist optional, Vorgabe `true`. Der Schalter steht beim Abonnieren fest.
Umschalten heißt kündigen und neu abonnieren (siehe Abschnitt 10).

**Ereignis** `audio` — eigenständig, nicht ein Feld am `video`-Ereignis: Bild
und Ton wechseln unabhängig voneinander, und eine Zeile darf nicht zwei Dinge
behaupten.

| Feld | Bedeutung |
| --- | --- |
| `id` | Teilnehmerkennung |
| `state` | `waiting` \| `live` \| `silent` \| `off` |
| `reason` | `command` \| `packets` \| `gap` \| `participantLeft` \| `meetingEnded` |
| `sampleRate`, `channels` | **nur vorhanden**, sobald ein Paket sie geliefert hat |

| `state` | wann |
| --- | --- |
| `waiting` | Ton eingeschaltet, noch **nie** ein Paket — Format unbekannt |
| `live` | Pakete fließen |
| `silent` | der Herzschlag füllt eine Lücke |
| `off` | Ton für dieses Abo bewusst aus (`audio:false`) oder das Abo endet |

**Vier neue Fehlerschlüssel**, jeder schickt die Suche an einen anderen Ort:

| Schlüssel | Ursache |
| --- | --- |
| `audioHelperMissing` | `GetAudioRawdataHelper()` gab nichts heraus — kein Meeting oder SDK nicht bereit |
| `audioSubscribeFailed` | das eine globale Ton-Abo ging nicht durch (SDK-Fehler auf stderr) |
| `audioBufferMismatch` | Pufferlänge passt nicht zu Kanalzahl × 2 — geprüft, nicht geglaubt |
| `audioQueueOverflow` | Pakete verworfen, weil das Leeren nicht nachkam |

## 8 · Lippensynchronität

Bild und Ton gehen zunächst **beide** mit `NDIlib_send_timecode_synthesize`
raus — NDI erzeugt die Taktung selbst. Ob das trägt, ist **nicht** aus den
Kopfsätzen zu beantworten und wird in der Abnahme **gemessen** (Abschnitt 9,
Punkt 5). Läuft es auseinander, bauen wir eigene Zeitstempel aus Zooms
`GetTimeStamp()` — aber erst dann, und mit der Messung als Beleg.

Das ist das größte verbleibende Risiko dieser Stufe. Es wird ausdrücklich
getragen, nicht wegdefiniert.

## 9 · Prüfen

**Ohne SDK, ohne Meeting** (`npm run selftest`): das neue Befehlsfeld, das
`audio`-Ereignis in allen vier Zuständen, die Zustandsmaschine, die
Fehlerschlüssel — gegen `test/fake-bridge.mjs`, das ein `audio`-Skript
dazubekommt.

**Ohne Meeting, mit SDK:** `--ndi-selftest` sendet zusätzlich Ton.
**Offene Frage, ehrlich benannt:** ob der Empfänger in `@jm/ndi` Ton überhaupt
beobachten kann, ist ungeprüft. Kann er es, belegt `ndi-probe` den Tonweg ohne
Meeting; kann er es nicht, wird das **so dokumentiert** und der Tonweg ist erst
in der Owner-Abnahme belegt. Nicht versprechen, was nicht gemessen ist.

**Owner-Abnahme am echten Meeting:**

1. Ton fließt und ist im NDI-Monitor **hörbar** (`waiting` → `live`).
2. Stummschalten und Aufheben: `live` ↔ `silent`, **kein Knacken**.
3. `audio:false` liefert Bild ohne Ton, gemeldet als `off`/`command`.
4. Zwei Personen gleichzeitig: zwei Quellen, zwei getrennte Töne, keine
   Vermischung.
5. **Lippensynchronität** angesehen und angehört.
6. Weggang und Wiederbeitritt: der Ton kommt mit der umgehängten Quelle zurück.
7. Meeting-Ende meldet den Ton mit `meetingEnded`.
8. **Gemessen mitgeschrieben:** welche Abtastrate und Kanalzahl Zoom
   tatsächlich liefert.

## 10 · Ausdrücklich nicht enthalten

- **Kein Mischton.** `onMixedAudioRawDataReceived` bleibt ungenutzt.
- **Kein Bildschirmton.** `onShareAudioRawDataReceived` bleibt ungenutzt.
- **Kein Dolmetscherton.** `bWithInterpreters` bleibt `false` — ein `true`
  würde die lokalen Dolmetscher-Funktionen unbrauchbar machen und damit die
  Dolmetscher-App (#208) beschädigen.
- **Kein Ton zurück nach Zoom.** `setExternalAudioSource` und der virtuelle
  Mikrofon-Weg bleiben unangetastet; Talkback ist bei Zoom ohnehin nur ein
  gemeinsamer Kanal.
- **Kein nachträgliches Umschalten** des Tonschalters an einem laufenden Abo.
- **Kein Pegeln, kein Mischen, keine Verzögerungskorrektur.** Das ist Sache des
  Switchers.
- **Keine Anbindung an `apps/connect`.** Das ist Stage 4.
