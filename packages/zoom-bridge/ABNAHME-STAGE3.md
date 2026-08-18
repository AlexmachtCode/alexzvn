# Abnahme Stage 3 — Ton je Teilnehmer

Sechs von acht Punkten aus [Spec Abschnitt 9](../../docs/superpowers/specs/2026-08-14-zoom-stage3-audio-ndi-design.md)
sind offen. Sie brauchen ein echtes Meeting mit echten Menschen — kein Selbsttest kann sie
ersetzen. Dieses Drehbuch ordnet sie so, dass **ein** Meeting reicht.

**Stand 18.08.2026 — 7 von 8 durch:** ✅ 1) Ton hörbar · ✅ 2) `live`↔`silent` fünfmal, kein
Knacken · ✅ 3) `audio:false` liefert Bild ohne Ton (`off`/`command`) · ✅ 4) zwei Personen,
einzeln abgehört, sauber getrennt · ✅ 6) Weggang und Wiederbeitritt, Quellenname unverändert ·
✅ 7) Meeting-Ende meldet den Ton eigens mit `meetingEnded` · ✅ 8) Format gemessen (32 kHz Mono,
320 Werte je Paket, ~100 Pakete/s je Sprecher; zwei gleichzeitige Sprecher = 203/s ohne Überlauf).

⚠ **Offen ist nur noch Punkt 5: der Ton läuft dem Bild hinterher**, und zwar mit
**gleichbleibendem** Versatz — das schließt die Abtastwert-Buchhaltung aus und lässt die
Rohrleitung übrig. Dazu der Pegel als Nebenpunkt.

⛑ **Auf dem Weg dorthin fiel ein Absturz auf**, der seit Stage 2 im Meeting-Ende steckte und
unsichtbar war, weil der Rückgabewert des Kindprozesses nie angezeigt wurde. Behoben. Siehe
[README Abschnitt 8](README.md).

Die Reihenfolge unten ist nicht beliebig. Punkt 7 beendet das Meeting und muss darum zuletzt
kommen; Punkt 6 verändert Teilnehmerkennungen; Punkt 3 braucht einen eigenen Start, weil der
Ton-Schalter beim Abonnieren gesetzt wird und nicht im laufenden Betrieb.

---

## Vorher

**Menschen:** du als Gastgeber plus **zwei** Zugeschaltete mit Kamera *und* Mikrofon. Mit nur
einer zugeschalteten Person sind Punkt 4 und Punkt 6 nicht prüfbar — dann bleiben sie offen und
werden nicht „durch Nachdenken" abgehakt.

⛑ **Kopfhörer für jeden, der im selben Raum sitzt wie ein abonniertes Mikrofon.** Gemessen am
18.08.2026: über Lautsprecher läuft der Ton akustisch im Kreis und klingt doppelt und versetzt.
Das ist **kein** Fehler der Brücke — sie sendet nachweislich 101 % der angegebenen Rate (im
dritten Lauf sogar exakt 100 %), eine Dopplung wäre 200 %. Wer diesen Hinweis übergeht, misst
den Raum statt die Software.

**Offen im NDI-Monitor:** die Quellen heißen `JM Connect – Zoom <Name>` (Halbgeviertstrich, kein
Doppelpunkt — gemessen in Stage 2).

**Umgebung** (PowerShell, einmal je Fenster):

```powershell
$env:ZOOM_SDK_DIR          = "<Pfad zum entpackten Zoom-Meeting-SDK>"
$env:ZOOM_SDK_CREDENTIALS  = "<Pfad ausserhalb des Repos>\zoom-credentials.json"
$env:ZOOM_MEETING_ID       = "<nur Ziffern>"
$env:ZOOM_MEETING_PASSCODE = "<Kenncode>"
Remove-Item Env:\ZOOM_SDK_CLIENT_ID     -ErrorAction SilentlyContinue
Remove-Item Env:\ZOOM_SDK_CLIENT_SECRET -ErrorAction SilentlyContinue
```

Die letzten zwei Zeilen sind kein Zierrat: stehen die Werte in der Umgebung, gewinnen sie gegen
die Datei, und der Lauf prüft dann eine andere Anmeldung als die, die in Betrieb geht.

---

## Lauf 0 — Kennungen ablesen (~30 s)

Kennungen gelten **nur für dieses Meeting** und stehen vorher nicht fest.

```powershell
$env:ZOOM_JOIN_SECONDS    = "30"
$env:ZOOM_VIDEO_SUBSCRIBE = ""
$env:ZOOM_AUDIO_OFF       = ""
npm run join -w @jm/zoom-bridge
```

Aus dem Teilnehmer-Block die beiden Zahlen links notieren.

**Dabei schon hinsehen:** steht bei einem Gast `[ohne persistentId → Wiederbeitritt nicht
umhaengbar]`, dann sagt das **vorher**, wie Punkt 6 ausgehen wird — das Umhängen läuft dann über
den Anzeigenamen und nur bei Eindeutigkeit. Zwei Gäste mit demselben Namen: die Brücke verweigert
das Umhängen. Das ist richtig so, keine Panne — eine Personenverwechslung auf Sendung wäre der
teurere Fehler.

---

## Lauf A — Punkte 1, 2, 4, 5, 6, 7 (~10 min)

```powershell
$env:ZOOM_JOIN_SECONDS    = "900"
$env:ZOOM_VIDEO_SUBSCRIBE = "<id1>,<id2>"
$env:ZOOM_AUDIO_OFF       = ""
npm run join -w @jm/zoom-bridge
```

Die Rohdaten-Erlaubnis im Zoom-Client bestätigen, sobald sie erscheint. Der Lauf **wartet**
darauf, bevor er abonniert — eine Zeitfrage soll nicht als fehlende Berechtigung erscheinen.

### A1 · Punkt 1 bestätigen, Messung mitnehmen

Person 1 spricht. Erwartet:

```
audio <id1>: waiting (command)
audio <id1>: live (packets)  32000 Hz, 1 Kanal/Kanaele
[zoom-bridge] Ton-Messung fuer <id1>: ~100 Pakete in ~1000 ms, ~32000 Abtastwerte …
[zoom-bridge]   Passt: gesendete Menge und angegebene Rate stimmen ueberein.
```

Kommt statt „Passt" eine **ACHTUNG**-Zeile mit einem Prozentwert, ist das der interessanteste
Befund des ganzen Laufs — mitschreiben, nichts reparieren.

### A2 · Punkt 4 — zwei Personen, zwei getrennte Töne

Erst abwechselnd sprechen, dann **gleichzeitig**, mindestens 10 s.

Der entscheidende Test steht im NDI-Monitor, nicht im Protokoll: **jede Quelle einzeln abhören.**
In `JM Connect – Zoom <Person 1>` darf Person 2 **nicht** zu hören sein. Zwei `live`-Zeilen mit
zwei verschiedenen Kennungen beweisen nur, dass zwei Abos laufen — nicht, dass sie getrennt sind.

**Gleichzeitig auf `AUDIO_QUEUE_OVERFLOW` achten.** Das ist die ehrliche Prüfung der Summenrate:
dass fünf Sprecher 500 Pakete/s ergeben, ist Arithmetik aus einer Einzelmessung. Ob die
Warteschlange (256 Plätze) reicht, sagt nur der Betrieb. Keine Überlauf-Meldung bei zwei
gleichzeitig Sprechenden = zwei Sprecher sind unbedenklich. Über fünf sagt das nichts.

### A3 · Punkt 5 — Lippensynchronität

**Einmal scharf in die Kamera klatschen**, dreimal wiederholt. Reden taugt dafür nicht: ein
Versatz von 80 ms fällt beim Sprechen kaum auf, beim Klatschen sofort. Ton und
zusammentreffende Hände müssen im NDI-Monitor zusammenfallen.

**GEMESSEN am 18.08.2026: der Ton läuft dem Bild HINTERHER.** Was jetzt gebraucht wird, ist nicht
noch eine Bestätigung, sondern die Unterscheidung: **zweimal klatschen — einmal kurz nach dem
Abonnieren, einmal nach vier Minuten.**

| Beobachtung | Was daraus folgt |
|---|---|
| Versatz bleibt gleich | Rohrleitung: Bild geht direkt im SDK-Rückruf raus, Ton erst beim Tick über die Warteschlange. Größenordnung eine Tick-Länge. |
| Versatz wächst | Abtastwert-Buchhaltung: der Stille-Herzschlag füllt zu wenig, und der Ton-Zeitstrahl bleibt gegenüber der Wanduhr zurück. |

Die beiden verlangen **verschiedene** Abhilfen. Eine Reparatur vor dieser Unterscheidung wäre
geraten, nicht gemessen — und träfe im schlechteren Fall die falsche der beiden Ursachen.

### A4 · Punkt 2 — Stummschalten und Aufheben

Person 1 schaltet sich im Zoom-Client **stumm**. Erwartet binnen etwa einer Sekunde:

```
audio <id1>: silent (gap)
```

Die Schwelle steht auf 40 ms ohne Paket. Aufheben → `audio <id1>: live (packets)`. Dreimal
wiederholen und **beim Übergang hinhören**: knackt es?

**Der Übergang findet statt** — im dritten Lauf am 18.08. kam `audio 16778240: silent (gap)`.
Eine frühere Notiz behauptete das Gegenteil; sie war ein voreiliger Schluss aus zwei Läufen, in
denen nichts kam. **Nicht festgestellt ist, was ihn auslöst.** Darum hier ausdrücklich zweimal
messen: einmal nur schweigen (Mikrofon offen), einmal stummschalten. Kommt `silent` schon beim
Schweigen, ist die Schwelle von 40 ms für Sprechpausen gedacht; kommt es nur beim Stummschalten,
ist der Herzschlag ein Netz für einen abreißenden Strom. Das ist ein Unterschied, den nur der
Versuch trennt — nicht die Überlegung.

### A5 · Punkt 6 — Weggang und Wiederbeitritt

Person 2 **verlässt das Meeting ganz** und tritt mit **demselben Anzeigenamen** wieder bei.

Beim Weggang erwartet:

```
video <id2>: black (participantLeft)
audio <id2>: off (participantLeft)
```

**`black`, nicht `unsubscribed`** — hier stand zuerst das Falsche. Das Bild-Abo **bleibt bestehen**,
damit die NDI-Quelle im Livebetrieb nicht wegbricht; der Herzschlag hält sie schwarz, bis das
Umhängen greift. Der Ton dagegen geht wirklich auf `off`: Stille für jemanden, der nicht da ist,
wäre eine Aussage über eine Person, die es im Meeting nicht mehr gibt. Zwei verschiedene
Behandlungen, und beide sind Absicht.

Beim Wiederbeitritt erwartet — unter einer **neuen** Kennung:

```
video <neu>: … (reboundByName)
audio <neu>: waiting (reboundByName)
audio <neu>: live (packets)
```

**Der Name der NDI-Quelle darf sich dabei nicht ändern.** Das ist Absicht: der Name eines Abos
bleibt fest, sonst verlöre der Bildmischer die Quelle mitten in der Sendung.

### A6 · Punkt 7 — Meeting-Ende

Gastgeber beendet das Meeting **für alle**. Erwartet für **jedes** laufende Abo:

```
audio <id>: off (meetingEnded)
video <id>: unsubscribed (meetingEnded)
```

Der Ton meldet sich **eigens** — nicht bloß das Bild. Dazu auf stderr die Abbau-Marken:

```
Abbau beginnt (meetingEnded), N Abo(s), SDK abmelden: nein - Meeting ist zu Ende
Abbau <id>: Renderer NICHT angefasst - das SDK hat ihn schon abgeraeumt
Abbau <id>: NDI-Sender schliessen
Abbau <id>: fertig
Abbau fertig, Karte ist leer
Meeting-Ende: Abbau zurueckgekehrt, Bruecke laeuft weiter
```

**Und dann das Wichtigste: es darf KEIN `EXITED_UNEXPECTEDLY` kommen.** Genau dort steckte bis zum
18.08.2026 ein Absturz (`exitCode=3221225477` = `0xC0000005`), den niemand sehen konnte. Kommt die
Zeile doch, steht darunter jetzt der Rückgabewert — und die zuletzt gedruckte Abbau-Marke sagt, wo
es passiert ist. Beides mitschicken.

Die Brücke **läuft danach weiter** — sie ist absichtlich so gebaut, dass sie ein Meeting-Ende
überlebt. Erst Strg+C beendet sie; im Task-Manager darf danach kein `zoom-bridge.exe` übrig sein.

---

## Lauf B — Punkt 3: Bild ohne Ton (~2 min)

Braucht einen eigenen Start, weil der Ton-Schalter beim Abonnieren gesetzt wird. Neues Meeting →
**neue Kennungen**, also Lauf 0 wiederholen.

```powershell
$env:ZOOM_JOIN_SECONDS    = "120"
$env:ZOOM_VIDEO_SUBSCRIBE = "<id1>"
$env:ZOOM_AUDIO_OFF       = "<id1>"
npm run join -w @jm/zoom-bridge
```

Erwartet:

```
  Video wird abonniert: <id1> (720p)  OHNE Ton (audio:false)
audio <id1>: off (command)
```

Person 1 spricht, Bild läuft, die Quelle bleibt **still**.

**Auf den Grund achten, nicht nur auf den Zustand.** `off (command)` heißt „wir haben den Ton
ausgeschaltet". `off (audioUnavailable)` hieße „wir wollten Ton und bekamen keinen" — derselbe
Zustand, eine völlig andere Ursache. Wer nur `off` liest, hält einen Ausfall für einen Erfolg.

---

## Nebenpunkt: ist der Pegel plausibel?

Im NDI-Monitor die Aussteuerungsanzeige während normalen Sprechens ansehen.

| Beobachtung | Deutung |
|---|---|
| Spitzen etwa −12 … −6 dBFS | plausibel |
| dauerhaft am Anschlag (0 dBFS) | zu heiß, `reference_level` prüfen |
| kaum sichtbarer Ausschlag | zu leise, dito |

`reference_level = 0` ist NDI-seitig belegt, Zoom-seitig **angenommen**. Diese Anzeige ist die
einzige Messung, die die Annahme prüft.

---

## Wenn etwas schiefgeht

| Meldung | Was sie heißt |
|---|---|
| `AUDIO_VOIP_JOIN_FAILED` | Beitritt zum **Tonkanal** scheiterte. Ohne ihn gibt es keine Rohdaten — Video kennt diese Bedingung nicht. |
| `AUDIO_SUBSCRIBE_FAILED` mit `SDKError=32` | `SDKERR_NOT_JOIN_AUDIO`. Sollte seit `JoinVoip()` nicht mehr auftreten; tritt es auf, ist der VoIP-Beitritt verlorengegangen. |
| `AUDIO_HELPER_MISSING` | Das SDK gab keinen Roh-Ton-Helfer heraus. |
| `AUDIO_BUFFER_MISMATCH` | Pufferlänge passt nicht zur Kanalzahl. Deutet auf ein anderes Format als gemessen. |
| `AUDIO_QUEUE_OVERFLOW` | Die Warteschlange lief über — die Hauptschleife kam nicht nach. Der interessanteste Fehler von allen. |
| `VIDEO_BAD_AUDIO_FLAG` | Das Feld `audio` war weder `true` noch `false`. Tippfehler in `ZOOM_AUDIO_OFF`. |

⛑ **`HasRawdataLicense: false` ist NICHT die Ursache.** Der Wert steht bei jedem Ton- und
Bildfehler mit in der Ausgabe und sieht jedes Mal wie die Antwort aus. Zoom hat das
Entitlement-Modell abgeschafft; alles funktioniert, während der Wert `false` liest. Er wurde in
diesem Projekt bereits **zweimal** fälschlich beschuldigt.

---

## Ergebnis eintragen

Nach dem Lauf gehören die Befunde in [`docs/roadmap.md`](../../docs/roadmap.md), Zeile „3 · Ton je
Person", und die gemessenen Tatsachen in [README Abschnitt 7](README.md).

Ein Punkt gilt als durch, wenn er **beobachtet** wurde — nicht, wenn er plausibel ist.
