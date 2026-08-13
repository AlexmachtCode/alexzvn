# Zoom Stage 2 — Video jedes Teilnehmers als eigene NDI-Quelle

**Issue:** #197 · **Vorgänger:** Stage 1 (`packages/zoom-bridge`, PR #224, abgenommen 12.08.2026)
**Ziel in einem Satz:** Ein abonnierter Zoom-Teilnehmer erscheint im Switcher als eigene NDI-Quelle und zeigt sein Video.

---

## 1 · Was Stage 1 bereitstellt

`zoom-bridge.exe` tritt einem Meeting bei, führt die Teilnehmerliste (`roster`, `joined`, `left`, `renamed`),
holt die Aufnahme-Erlaubnis ein und geht sauber wieder heraus. Sie **zeichnet nichts auf** und gibt kein
Bild heraus. Der native Teil meldet ausschließlich Tatsachen als JSON-Zeilen auf stdout; jede Beurteilung
liegt in TypeScript. 174 Selbsttests laufen ohne SDK, ohne Compiler, ohne Meeting.

Stage 2 baut ausschließlich darauf auf und ändert an Stage 1 nichts außer der Abbau-Reihenfolge
(Abschnitt 8).

---

## 2 · Gemessene Grundlagen

Nicht angenommen, sondern in den Headern und im Quellbaum nachgesehen:

| Tatsache | Fundstelle |
| --- | --- |
| **Ein Renderer je Teilnehmer.** `createRenderer(&r, delegate)` / `destroyRenderer(r)` sind freie `SDK_API`-Funktionen; `r->subscribe(userId, RAW_DATA_TYPE_VIDEO)`, `r->unSubscribe()`, `r->getSubscribeId()`. | `h/rawdata/zoom_rawdata_api.h`, `h/rawdata/rawdata_renderer_interface.h` |
| **Auflösung je Abo:** `setRawDataResolution()` mit 90P / 180P / 360P / 720P / 1080P. | dito |
| **Das SDK sagt selbst, wann Video fließt:** `onRawDataStatusChanged(RawData_On \| RawData_Off)`. | dito |
| **Zoom liefert einen zusammenhängenden I420-Puffer:** `GetBuffer()` + `GetBufferLen()` neben den Ebenen-Zeigern `GetYBuffer()`/`GetUBuffer()`/`GetVBuffer()`. | `h/zoom_sdk_raw_data_def.h` |
| **NDI nimmt I420 nativ:** `NDIlib_FourCC_video_type_I420`, Ebenen zusammenhängend in einem Puffer erwartet. | `NDI 6 SDK/Include/Processing.NDI.structs.h:95` |
| **Der Switcher braucht keine Änderung:** er ruft schlicht `ndi.findSources(500)`. | `apps/switcher/src/utility/ndi-recv.ts:76` |
| **NDI-SDK wird über `NDI_SDK_DIR` gefunden** (bestehende Konvention). | `packages/ndi/binding.gyp` |

**Der bestehende Node-Addon `packages/ndi` wird NICHT benutzt und NICHT angefasst.** Er kann nur BGRA und
hält modul-globale Singletons (`g_send`/`g_recv`/`g_find`, `addon.cc:18-24`) — genau die Ursache der Regel
„ein NDI-Sender pro Prozess", die keine NDI-Grenze ist. Die Bridge ist eine eigene `.exe` und darf beliebig
viele `NDIlib_send_create` halten.

**Unbekannt und darum zu messen, nicht zu schätzen:** wie viele gleichzeitige Abos das Zoom-SDK zulässt.
Kein Header nennt eine Grenze.

---

## 3 · Entscheidungen (Owner, 12.08.2026)

**Abo nur auf Befehl.** Kein Teilnehmer bekommt selbsttätig eine Quelle. Jedes Abo ist ein dekodierter
Videostrom; die Last wächst mit jeder Person, und Stage 4 sieht ohnehin ein „einzeln laden/entladen" vor.

**Kamera aus heißt Schwarz, nicht Verschwinden.** Der NDI-Sender bleibt bestehen und schickt schwarze
Vollbilder weiter. Ein Standbild wäre die gefährlichere Wahl: es ist von echtem Video nicht zu
unterscheiden, die Regie schaltete auf einen Gast, der längst weg ist. Ein Abbau der Quelle wäre im
Livebetrieb hart — läge sie auf Programm, risse sie weg. Zusätzlich meldet die Bridge den Wechsel als
Ereignis, damit die Regie es **sieht** statt es zu erraten.

**Auflösung je Abo wählbar, Vorgabe 720p.** Der Switcher gibt heute 720p aus, Full-HD steht auf seiner
Liste; eine harte Decke in der Bridge würde später zum Engpass.

---

## 4 · Architektur

Zwei neue native Einheiten, jede mit **einer** Aufgabe und einer Grenze, hinter der die andere nichts weiß:

**`native/ndi_sender.h/.cpp` — eine Hülle um EINEN NDI-Sender.**
Erzeugen mit einem Namen, ein I420-Bild senden, ein schwarzes Bild senden, abbauen. Kennt Zoom nicht.
Hält seine eigene Sperre (Abschnitt 6).

**`native/video.h/.cpp` — die Abo-Verwaltung.**
Je Abo ein Bündel aus Zoom-Renderer, Delegate und Sender. Kennt NDI-Interna nicht, nur die Hülle oben.
Bietet `videoSubscribe(userId, resolution)`, `videoUnsubscribe(userId)`, `videoTick()` (Herzschlag,
Abschnitt 6) und `videoShutdownAll()`.

**TypeScript** — `src/protocol.ts` (Befehle, Ereignisse, Namenskatalog), `src/state.ts` (Abos im
Sitzungsbild). Unverändertes Muster aus Stage 1: auf der Leitung stehen Zahlen und Schlüssel, die Namen
entstehen ausschließlich in `enrich()`.

---

## 5 · Protokoll

### Befehle

```json
{ "cmd": "videoSubscribe",   "id": 16778240, "resolution": "720p" }
{ "cmd": "videoUnsubscribe", "id": 16778240 }
```

`id` ist die **numerische Teilnehmerkennung aus der Teilnehmerliste** — dieselbe, die `roster`, `joined`,
`left` und `renamed` schon führen. Der Aufrufer benutzt also durchgehend eine Kennung.
`resolution` ist optional; ohne Angabe `"720p"`. Erlaubt: `"90p"`, `"180p"`, `"360p"`, `"720p"`, `"1080p"`.

### Ereignis

```json
{ "ev": "video", "id": 16778240, "state": "live", "source": "JM Connect – Zoom Anna Beispiel",
  "reason": "frames", "rebindable": true, "rotation": 0, "limitedRange": true }
```

| Feld | Bedeutung |
| --- | --- |
| `state` | `subscribed` (Sender steht, noch kein Bild) · `live` (Bilder fließen) · `black` (kein Bild, Schwarz wird gesendet) · `unsubscribed` (Sender abgebaut) |
| `reason` | warum dieser Zustand: `command` (Befehl des Aufrufers) · `frames` (Bilder fließen) · `cameraOff` (das SDK meldet `RawData_Off`) · `participantLeft` (der Teilnehmer ist weg) · `rebound` (Abo auf eine neue Kennung umgehängt) · `bufferMismatch` (Bilder kommen, sind aber unbrauchbar — Abschnitt 6) |
| `source` | der **tatsächlich vergebene** NDI-Name (siehe Abschnitt 7) |
| `rebindable` | ob dieses Abo einen Wiederbeitritt überstehen kann (Abschnitt 7) |
| `rotation` | `GetRotation()` des zuletzt empfangenen Bildes — 0, 90, 180 oder 270. **Fehlt, solange noch kein Bild kam** (bei `state: "subscribed"` also immer): ein Wert wäre dort erfunden, und eine erfundene 0 ließe sich später nicht von einer gemessenen unterscheiden |
| `limitedRange` | `IsLimitedI420()` des zuletzt empfangenen Bildes — **fehlt** unter derselben Bedingung und aus demselben Grund |

`state` und `reason` sind bewusst **getrennt**: derselbe Zustand `black` hat zwei verschiedene Ursachen
(Kamera aus, Teilnehmer weg), und zwei Ursachen dürfen nie denselben Namen bekommen. Wer sie
zusammenlegte, könnte im Protokoll später nicht mehr unterscheiden, ob jemand die Kamera zugedeckt hat
oder aus dem Meeting geflogen ist.

### Fehlerursachen (`where: "video"`)

Jede bekommt einen **eigenen** Eintrag in `OWN_ERROR_NAMES`, kein Sammelbegriff:

| Schlüssel | Name | Wann |
| --- | --- | --- |
| `videoNoPrivilege` | `VIDEO_NO_PRIVILEGE` | `videoSubscribe` ohne erteilte Rohdaten-Erlaubnis |
| `videoUnknownParticipant` | `VIDEO_UNKNOWN_PARTICIPANT` | die Kennung steht nicht in der Teilnehmerliste |
| `videoAlreadySubscribed` | `VIDEO_ALREADY_SUBSCRIBED` | für diese Kennung läuft schon ein Abo |
| `videoNotSubscribed` | `VIDEO_NOT_SUBSCRIBED` | `videoUnsubscribe` ohne laufendes Abo |
| `videoRendererFailed` | `VIDEO_RENDERER_FAILED` | `createRenderer`/`subscribe` liefert einen SDK-Fehler (Zahl im `detail`) |
| `videoSenderFailed` | `VIDEO_SENDER_FAILED` | `NDIlib_send_create` schlägt fehl |
| `videoBadResolution` | `VIDEO_BAD_RESOLUTION` | unbekannter Auflösungsschlüssel |
| `videoBufferMismatch` | `VIDEO_BUFFER_MISMATCH` | `GetBufferLen()` passt nicht zu Breite×Höhe×3/2 (Abschnitt 6) |

**Die Erlaubnis ist Voraussetzung, kein Wunsch.** Rohvideo hängt an derselben Aufnahme-Erlaubnis, die
Stage 1 einholt. Ein Abo ohne Erlaubnis wird mit `VIDEO_NO_PRIVILEGE` abgewiesen — nicht stillschweigend
zu einer Quelle, die für immer schwarz bliebe. Genau diese stille Variante wäre die schlimmere: sie sähe
aus wie „Gast hat die Kamera aus".

---

## 6 · Datenfluss, Threads und der Herzschlag

**Der schnelle Weg.** Zoom-Thread → `onRawDataFrameReceived(YUVRawDataI420* d)` → ein
`NDIlib_video_frame_v2_t` mit `FourCC = NDIlib_FourCC_video_type_I420`, `p_data = d->GetBuffer()`,
`line_stride_in_bytes = d->GetStreamWidth()` → `NDIlib_send_send_video_v2`. **Keine Farbraumwandlung,
keine Kopie, kein JS-Heap.** `NDIlib_send_send_video_v2` kehrt erst zurück, wenn der Puffer ausgelesen
ist; wir senden synchron im Rückruf und brauchen darum kein `AddRef()`.

**Der Puffer wird geprüft, nicht geglaubt.** Vor dem Senden: `GetBufferLen() == width * height * 3 / 2`.
Trifft das nicht zu (Zeilenabstand mit Auffüllung, unerwartete Ebenen-Anordnung), wird das Bild **nicht**
gesendet und `VIDEO_BUFFER_MISMATCH` gemeldet — **einmal je Abo**, nicht je Bild, sonst ertränkte ein
kaputter Strom mit 30 Meldungen je Sekunde jede andere Ausgabe. Das Abo bleibt bestehen und fällt über den
Herzschlag auf Schwarz (`state: "black"`, `reason: "cameraOff"` trifft hier nicht zu — der Grund ist
`bufferMismatch`, ein **eigener** Wert von `reason`). Ein falsch ausgelegter Puffer erzeugte sonst ein
Bild, das aussieht wie ein Defekt der Kamera — die teuerste Sorte Fehler, weil man ihn am falschen Ende
sucht.

**Zwei Schreiber, eine Sperre je Sender.** Auf denselben Sender schreiben der Bild-Rückruf (Zoom-Thread)
und der Schwarzbild-Herzschlag. Jede Sender-Hülle hält deshalb ihre **eigene** Sperre. Keine globale
Sperre: zwei Abos dürfen sich nicht gegenseitig ausbremsen.

**Der Herzschlag braucht keinen neuen Thread.** Die Hauptschleife in `main.cpp` tickt bereits alle 10 ms.
Sie ruft `videoTick()`: liegt der letzte Bildempfang eines Abos länger als **200 ms** zurück, wird ein
schwarzes Vollbild in der abonnierten Auflösung gesendet, höchstens jedoch alle **100 ms** (also 10 Bilder
je Sekunde). Das hält die Quelle für jeden Empfänger gültig und kostet fast nichts. 200 ms Nachlauf statt
sofort: bei kurzen Aussetzern soll nicht zwischen Bild und Schwarz geflackert werden.

**Zustandswechsel kommen aus zwei Quellen, und beide zählen.** `onRawDataStatusChanged(RawData_Off)` ist
die Aussage des SDK; der ausbleibende Bildfluss ist die Beobachtung. Beide führen zu `state: "black"`, aber
mit unterschiedlichem `reason`. Ein `left`-Ereignis der Teilnehmerliste setzt `reason: "participantLeft"`.

---

## 7 · Quellenname und Wiederbeitritt

**Der Name steht bei `subscribe` fest:** `JM Connect – Zoom <Anzeigename>`. Er folgt **keiner**
Umbenennung. Einen NDI-Sender umzubenennen hieße, ihn abzubauen und neu aufzubauen — die Quelle wäre
mitten in der Sendung weg, genau das, was Abschnitt 3 ausschließt. Ist der Name bereits durch ein anderes
laufendes Abo belegt, wird ` (2)`, ` (3)` … angehängt. Die Bridge meldet den **tatsächlich vergebenen**
Namen im `video`-Ereignis zurück, statt den Aufrufer raten zu lassen.

**Berichtigung, gemessen am 13.08.2026 (frühere Fassung dieser Spec war falsch):** Der Name enthält
**keinen Doppelpunkt**. Die NDI-Laufzeit ersetzt `:` durch ein Leerzeichen, und `JM Connect – Zoom:` hätte
deshalb ein doppeltes Leerzeichen hinterlassen. Gemessen mit `packages/ndi` gegen die echte Laufzeit:

```
angelegt:  "JM Connect – Zoom: Anna Beispiel"
gefunden:  "NITROVONALEX (JM Connect – Zoom  Anna Beispiel)"
```

Der Gedankenstrich `–` überlebt unverändert. **Zweite, wichtigere Tatsache aus derselben Messung:** NDI
stellt jedem Quellennamen den **Rechnernamen in Klammern** voran — was der Operator im Switcher sieht,
lautet also `RECHNERNAME (JM Connect – Zoom <Anzeigename>)`. Das ist NDIs Format, nicht unsere Wahl, und
gilt für jede NDI-Quelle der Suite gleichermaßen. Wer im Switcher oder in einem Prüfstand auf den Namen
prüft, muss deshalb **auf Teilzeichenketten prüfen**, nie auf Gleichheit.

**Wiederbeitritt.** Wer aus dem Meeting fliegt und zurückkommt, hat bei Zoom eine **neue** numerische
Kennung — die Teilnehmerliste aus Stage 1 hält das bereits fest („nach einer Wiederverbindung sind die IDs
andere"). Ein Abo auf die alte Kennung bliebe für immer schwarz, obwohl die Person wieder da ist.

Deshalb merkt sich jedes Abo zusätzlich die `persistentId` des Teilnehmers (die Teilnehmerliste führt sie
schon mit). Taucht später ein Teilnehmer mit **derselben** `persistentId` unter neuer Kennung auf, wird das
Abo selbsttätig auf die neue Kennung umgehängt: `state: "live"`, `reason: "rebound"`. **Der NDI-Sender
bleibt derselbe** — für den Switcher ist nichts passiert, was er merken müsste.

**Ehrlich über die Grenze:** ob Zoom die `persistentId` über einen Wiederbeitritt hinweg stabil hält, ist
**unbelegt** und gehört in die Abnahme. Ist sie leer (Zoom liefert sie für nicht angemeldete Gäste nicht
immer), kann dieses Abo den Wiederbeitritt nicht überstehen — dann meldet das `video`-Ereignis
`rebindable: false`, statt eine Zusicherung vorzutäuschen, die nicht trägt.

---

## 8 · Abbau

Die Reihenfolge aus Stage 1 ist bindend und bekommt **davor** einen neuen Schritt:

1. **alle Abos abbauen** — je Abo: `unSubscribe()` → `destroyRenderer()` → `NDIlib_send_destroy()`
2. `Leave()` — wie bisher
3. Pumpen bis `ENDED`/`IDLE` oder 5 s — wie bisher
4. `DestroyMeetingService` → `DestroyAuthService` → `CleanUPSDK` — wie bisher

**Warum die Abos zuerst:** ein laufender Renderer hält eine Referenz auf den Meeting-Dienst. Ihn nach
`DestroyMeetingService` abzubauen hieße, auf abgeräumten Zustand zuzugreifen — dieselbe Klasse von Fehler,
die in Aufgabe 7 als `0xC0000005` gemessen wurde. **Erst der Renderer, dann der Sender:** andersherum
könnte ein Bild-Rückruf, der schon unterwegs ist, auf einen abgebauten Sender schreiben.

Nach dem Abbau darf **keine** `JM Connect – Zoom …`-Quelle mehr im Netz stehen. Das ist ein
Abnahmekriterium, kein Wunsch.

---

## 9 · Prüfbarkeit

**Ohne SDK, ohne NDI, ohne Meeting** (Selbsttests wie in Stage 1, gegen `test/fake-bridge.mjs`):
Befehlsbau, Ereignis-Auswertung, Namenskatalog, Zustandsmaschine (Abo-Buchführung, Zustandswechsel,
Umhängen bei `rebound`), Namensvergabe samt Kollisionszusatz, Auflösungsschlüssel und deren Abweisung.

**Nur nativ prüfbar** und darum Sache der Abnahme: das Senden selbst, die Pufferprüfung, der Herzschlag,
die Abbau-Reihenfolge.

**Der Messlauf.** Ein eigener Prüfstand abonniert Teilnehmer, bis es klemmt, und **nennt die Zahl**, bei
der `createRenderer` oder `subscribe` einen Fehler liefert oder Bilder ausbleiben. Diese Zahl steht in
keinem Header; sie zu schätzen wäre eine Behauptung.

---

## 10 · Abnahme gegen ein echtes Meeting

| # | Lauf | Erwartung |
| --- | --- | --- |
| 1 | Gast abonnieren | Quelle `JM Connect – Zoom <Name>` erscheint im Switcher und zeigt den Gast |
| 2 | Gast schaltet die Kamera aus | Quelle **bleibt**, wird schwarz, Ereignis `state: black, reason: cameraOff` |
| 3 | Gast schaltet wieder ein | Quelle wird wieder lebendig, `reason: frames` |
| 4 | Gast verlässt das Meeting | Quelle bleibt schwarz, `reason: participantLeft` |
| 5 | Gast kommt zurück | Abo hängt selbsttätig um (`reason: rebound`) — **oder** es wird gemessen, dass die `persistentId` das nicht trägt, und das Ergebnis festgehalten |
| 6 | Abo ohne erteilte Erlaubnis | benannte Abweisung `VIDEO_NO_PRIVILEGE`, keine tote Quelle |
| 7 | Messlauf | die Zahl gleichzeitig möglicher Abos steht fest |
| 8 | Strg+C | alle Sender abgebaut, **keine** Quelle bleibt im Netz, kein verwaister Prozess |

Zusätzlich festzuhalten, weil es die Bildqualität bestimmt und heute niemand weiß: welchen Wert
`IsLimitedI420()` liefert und ob `GetRotation()` je von 0 abweicht.

---

## 11 · Was Stage 2 ausdrücklich nicht tut

- **Kein Ton.** Das ist Stage 3 (`onOneWayAudioRawDataReceived`).
- **Keine Bedienoberfläche.** Das ist Stage 4; Stage 2 liefert nur die Befehle, auf denen sie aufsetzt.
- **Keine Bildschirmfreigabe.** `RAW_DATA_TYPE_SHARE` bleibt unangetastet.
- **Kein Drehen des Bildes.** Liefert ein Handy-Gast `GetRotation() != 0`, wird das im `video`-Ereignis
  **gemeldet**, aber nicht ausgeglichen — Drehen bräche das Null-Kopieren und lohnt erst, wenn die Abnahme
  zeigt, dass der Fall überhaupt auftritt. Sichtbar statt still.
- **Keine Änderung am Switcher** und **keine Änderung an `packages/ndi`.**
