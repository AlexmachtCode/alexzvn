# Connect: Hochkant-Zuschaltungen in 16:9 einpassen (#310)

**Stand:** 17.11.2026, Entwurf. Owner-Entscheidungen im Gespräch 17.11.2026 (siehe „Entscheidungen“).
Code-Stand der Angaben: origin/main bf45fba713. P = `packages/zoom-bridge`, C = `apps/connect`.

## Absicht

Die Show-Crew schaltet Personen per Zoom-App vom Handy zu. Hält jemand das Handy hochkant, kommt das NDI-Bild im
Mischer (vMix, OBS, TriCaster) mit schwarzen Seitenrändern an; die Crew muss jede Hochkant-Quelle von Hand
zuschneiden. Dreht die Person das Handy mitten in der Sendung, stimmt der Zuschnitt nicht mehr (#310).

Ziel: Eine Hochkant-Quelle ist ohne Handarbeit im Mischer nutzbar und bleibt es, wenn das Handy gedreht wird.

## Ist-Zustand (gemessen 17.11.2026, Owner-Testmeeting, Connect 0.4.4)

- Zoom liefert ein Hochkant-Handy **nativ hochkant**: Messzeile/Log `360×640`, dann `720×1280` bei 23,5 fps (1080p
  bestellt, `resGot 4`), Zooms `recvVideo 720×1280`. Gedreht: `1280×720`. Die Größe wechselt also mit der Haltung.
- Die Bridge gibt Zooms Größe unverändert weiter: `Slot::bildAnkunft` (P/native/video.cpp:2165) →
  `sender.sendI420(buf, w, h)` (:2212). Das Livebild ist **I420 ohne Alphakanal** (P/native/ndi_sender.cpp:101).
  Nur das durchsichtige Ersatzbild ist UYVA (:87-96, :118).
- Die schwarzen Ränder entstehen also im Mischer, der ein 720×1280-Bild in seinen 16:9-Eingang einpasst; weil die
  Quelle kein Alpha hat, füllt er die Seiten deckend. Beim Drehen springt das NDI-Format (720×1280 ↔ 1280×720) –
  genau das macht einen Hand-Zuschnitt kaputt.
- Ersatzbilder richten sich nach der letzten Livegröße (`ersatzbildTick`, video.cpp:1569-1570), die Zoom-Kachel
  ebenso (`kachelGroesse`, slot_logic.h:614).

## Ziele

1. Neue Einstellung je Slot **„Bildformat“** mit zwei Werten:
   - **„Original“** (Vorgabe): genau wie heute, byte-gleiches Verhalten.
   - **„16:9 einpassen“**: Jedes Bild, das nicht 16:9 ist, wird verkleinert bzw. vergrößert und mittig in einen
     16:9-Rahmen in der Slot-Auflösung gesetzt (360p → 640×360, 720p → 1280×720, 1080p → 1920×1080); die Fläche
     daneben ist durchsichtig (Alpha 0). Gesendet als UYVA. Bilder, die schon 16:9 sind, gehen unverändert raus
     (Größe und Format wie heute).
2. Ein gedrehtes Handy liefert damit immer ein 16:9-Bild: hochkant eingepasst im Rahmen, quer unverändert.
   Der Mischer muss nichts zuschneiden; der Eingang füllt sich in beiden Fällen ohne Rand.
3. Im Modus „16:9 einpassen“ gehen auch Ersatzbilder (transparent, eingefroren, schwarz, weiß, Zoom-Kachel) durch
   dieselbe Einpassung: Sie nehmen genau die Fläche ein, die das Livebild hatte; das Format springt beim Aussetzer
   nicht. „Transparent“ bleibt vollständig durchsichtig.
4. Die Einstellung lässt sich bei laufendem Slot umschalten (wie heute das Ersatzbild), ohne Neuabo und ohne
   Umbenennen der NDI-Quelle.
5. Die Messzeile der Kachel zeigt weiter, was Zoom liefert, und zusätzlich, was ins NDI geht, wenn das abweicht.

## Nicht-Ziele

- Kein „16:9 füllen/zuschneiden“ (Owner: „A reicht“; bei Hochkant bliebe nur ein waagerechter Streifen).
- Keine Änderung der Vorgabe: Bestehende Slots bleiben „Original“.
- Keine Fernsteuerung der neuen Einstellung über Companion / Suite-Control (dort sind heute weder Ersatzbild noch
  Auflösung erreichbar, C/src/main/zoom/fernsteuerung.ts:41-68).
- 16:9-Bilder werden nicht auf die Slot-Auflösung gezogen (bleiben bei Zooms Größe, wie heute).
- Die kleine Vorschau in Connect zeigt weiter das Rohbild von Zoom, nicht den Rahmen.
- Der Gastlink-Weg (WebRTC, C/src/renderer/src/peer.tsx) bleibt unverändert.
- Keine libyuv, solange die Messung (unten) reicht.

## Anti-Ziele

- Slots auf „Original“ dürfen sich in nichts ändern – kein zusätzliches Kopieren, kein anderes Format, keine
  andere Größe.
- Die Einpassung darf den Zoom-Rückruf-Thread nie blockieren: kein Lock während des Skalierens, kein
  Speicheranlegen pro Bild (Puffer wiederverwenden).
- Keine zusätzliche Verzögerung des Bildes über die Rechenzeit hinaus; NDI-Quellnamen bleiben unverändert.

## Ansätze

| Ansatz | Bewertung |
|---|---|
| **1 – Fester Rahmen in Slot-Auflösung, nur Nicht-16:9 wird eingepasst, eigener glättender Skalierer in der Bridge** | **Gewählt (Owner 17.11.).** Konstante, kalkulierbare NDI-Größe; Rechenarbeit nur im Bildbereich (bei 1080p rund 608×1080 Bildpunkte je Hochkantbild); keine neue Abhängigkeit. |
| 2 – Rahmen um das Bild herum ohne Skalieren (Höhe = gelieferte Höhe, z. B. 2276×1280) | Verworfen: bis zu dreimal so große NDI-Bilder (NDI-Codieren, Bandbreite bei 5 Slots), Größe springt mit Zooms Lieferung. |
| 3 – Wie 1, Skalieren/Umwandeln mit libyuv | Nur als Rückfall, falls die Messung von 1 nicht reicht: schnellste Lösung, aber neue Abhängigkeit mit Lizenz im Bau der Bridge. |
| Zuschneiden im Mischer | Verworfen: genau die Handarbeit, die die Crew loswerden will. |
| Zweiter Prozess, der Connects NDI empfängt und neu sendet | Verworfen: zusätzliche Verzögerung, doppelte Last, neue Quellnamen (Mischer verliert die Zuordnung). |

## Entscheidungen (Owner, 17.11.2026)

- Nur „16:9 einpassen, Ränder durchsichtig“, kein Füllen; Vorgabe „Original“, Wahl je Slot.
- Ansatz 1; libyuv erst, wenn die Messung nicht reicht.
- Ersatzbild, eingefrorenes Bild und Zoom-Kachel bekommen im Modus „einpassen“ dieselbe Rahmengröße.

## Entwurf

### Einstellung und Wege

- `ZoomSlotEinstellung` (C/src/shared/types.ts:228) bekommt `bildformat: ZoomSlotBildformat` mit
  `type ZoomSlotBildformat = 'original' | 'einpassen'`. `normiereSlot` (C/src/main/zoom/einstellungen.ts:207)
  setzt fehlend/unbekannt auf `'original'` – damit braucht `connect-settings.json` keine Umstellung.
- Weitergabe an die Bridge wie `ersatzbild`: `AENDERBAR` (C/src/main/zoom/slot-eingabe.ts:45), `slotOnBefehl`
  mit Abbildungstabelle (C/src/main/zoom/slots.ts:130-157), Unterschied in `slotSetFuer` (C/src/main/zoom/kern.ts:2613).
- Leitung (P/src/protocol.ts): neues Feld `frame: 'native' | 'fit'` an `slotOn` und `slotSet`, **auf slotOn
  optional** (fehlt = `native`), damit CLI (`cli/steuerung.mjs`), Messläufe und ältere Aufrufer unverändert
  gelten. Ein unbekannter Wert ist ein Fehler wie bei `fallback` (neuer Fehlerschlüssel `frameInvalid`, in
  `SLOT_ERROR_KEYS`, Fake-Bridge und `slot-pruefung-faelle.json` nachziehen).
- Nativ (P/native/main.cpp:260-340): `leseName` gegen eine neue Namenstabelle; Enum `Bildformat { Original, Einpassen }`
  mit `BILDFORMAT_NAMEN` in slot_logic.h nach dem Muster `Fallback`/`FALLBACK_NAMEN`; Logzeile „Felder gelesen“
  um „Format …“ ergänzen (Prüfstände command-probe/bool-probe nachziehen).
- Am Slot ein `std::atomic<Bildformat> format` (Muster `fallback`, video.cpp:136), damit `bildAnkunft` es lesen
  kann; `slotSet` speichert es wie `fallback` (video.cpp:1839) ohne Neuabo.

### Die Einpassung (rein, testbar)

Neue Kopfdatei `P/native/bild_einpassen.h`, ohne `windows.h` (Muster `kachel_logik.h`), mit:

- `bool ist16zu9(int w, int h)` – 16:9 innerhalb 1 % (`|w·9 − h·16| ≤ h·16/100`); 640×360, 1280×720, 1920×1080
  gelten, 720×1280, 4:3, 16:10 nicht.
- `Rechteck bildFlaeche(int w, int h, int W, int H)` – größtes Rechteck mit dem Seitenverhältnis des Bildes, das in
  W×H passt, mittig; Breite, Höhe und linker Rand **gerade** (UYVY-Paare, 4:2:0-Quelle).
- `void rahmenVorbereiten(Puffer&, int W, int H, Rechteck)` – füllt UYVY mit 128/16/128/16 und Alpha 0, nur wenn
  sich W, H oder die Fläche geändert haben.
- `void einpassen(const uint8_t* i420, int w, int h, Puffer&, int W, int H, Rechteck)` – schreibt nur die Fläche:
  bilinear, Festkomma, Y aus der Y-Ebene, U/V aus den Viertel-Ebenen (4:2:0 → 4:2:2 durch Abtasten an der
  Ausgabezeile), Alpha 255. Keine Farbumrechnung (bleibt YCbCr, begrenzter Bereich wie überall in der Bridge,
  ndi_sender.cpp:57-65).
- UYVA-Aufbau wie `fillTransparentUYVA` (ndi_sender.cpp:87-96): UYVY-Ebene `W·H·2` (Zeilenabstand `2·W`), direkt
  danach Alpha-Ebene `W·H`.

Der Name darf nicht mit `slot` beginnen: Der Selbsttest verbietet in `bildAnkunft` jeden `slot\w*(`-Aufruf
(P/test/selftest.ts:4792-4798).

### Livebild

In `bildAnkunft` (SDK-Thread, vor `sendI420`, außerhalb jeder Sperre – video.cpp:2212):

- `format == Original` **oder** `ist16zu9(w, h)` → wie heute `sendI420(buf, w, h)`.
- sonst → `einpassen` in den Live-Rahmen des Slots (eigener Puffer, nur dieser Thread schreibt ihn) und
  `sender.sendUyvaBild(rahmen, W, H)`.
- Die Abfrage des Riegels muss vor dem Senden bleiben (selftest.ts:3676-3681); `vorschauBild(nr, aboZiel, buf, w, h, …)`
  bekommt weiter das Rohbild (selftest.ts:3862-3865).
- Neben `lastW/lastH` (Zooms Größe, bleibt für Messzeile und Statistik) merkt sich das Ziel `ausgabeW/ausgabeH`
  (was zuletzt ins NDI ging).

### Sender und Bild-Versatz

- Neue Methode `NdiSender::sendUyvaBild(const uint8_t*, int W, int H)`: ohne Versatz direkt `fillFrameUyva`
  (wie `sendI420`), mit Versatz Kopie in die Warteschlange.
- `delay_line.h`: neue `Bildart::Uyva` mit Daten (Länge `3·W·H`); `releaseDueLocked` sendet sie über
  `fillFrameUyva`; `speicherBytes` zählt die echte Länge statt der I420-Schätzung (ndi_sender.cpp:158, 272).
  Selbsttest-Regex der Bildart-Liste (selftest.ts:3518-3550) nachziehen.
- Ein Formatwechsel mitten im Lauf leert die Warteschlange nicht: Jedes Bild trägt seine Art.

### Ersatzbilder (Hauptthread, `ersatzbildTick`, video.cpp:1495-1610)

Im Modus „einpassen“, wenn das letzte Livebild eingepasst war (`ausgabe` ≠ Zooms Größe):

- **eingefroren / gehalten:** die I420-Kopie `last` bleibt Rohbild (kein teureres Kopieren pro Bild); beim Senden
  wird sie mit derselben Einpassung in einen **eigenen** Rahmen des Hauptthreads eingepasst.
- **schwarz / weiß:** das I420-Ersatzbild in Zooms letzter Größe wird eingepasst – die Bildfläche ist schwarz bzw.
  weiß, die Seiten bleiben durchsichtig (Ergebnis je Größe zwischenspeichern).
- **Zoom-Kachel:** wie heute in der Livegröße gezeichnet (`kachelGroesse`), dann eingepasst.
- **transparent:** ganzer Rahmen W×H durchsichtig.
- War das letzte Livebild 16:9 (nicht eingepasst), bleibt alles wie heute.

### Messzeile

- `slotStats` bekommt optional `outW`/`outH` (P/src/protocol.ts:318-325, Schlüsselliste selftest.ts:3019); nur
  gemeldet, wenn ein Bild des Fensters eingepasst wurde.
- Messzeile (C/src/shared/zoom-text.ts, `MESS_ZEILE`): „1080p · Zoom liefert 720×1280 · 23,5 Bilder/s ·
  NDI 1920×1080 eingepasst“. Neue Textnummer, `test/zoom-text.test.ts`.
- `memKb` zählt beide Rahmen mit (video.cpp:1679).

### Oberfläche

`SlotEinstellungen.tsx` (C/src/renderer/src/zoom/SlotEinstellungen.tsx:155-185): drittes Auswahlfeld
„Bildformat“ in der Zeile mit Auflösung und Ersatzbild, Werte „Original“ und „16:9 einpassen“, mit Hinweis
„Hochkant-Bilder mittig in 16:9, Seiten durchsichtig“. Texte in zoom-text.ts mit neuen Nummern.

## Messen (Leistungsgrenze)

Die Bridge läuft live, bis zu 5 Slots gleichzeitig (Owner-Betriebsgröße). Ohne künstliche Bildquelle (die
vorhandenen Lastläufe brauchen ein echtes Meeting) wird zweistufig gemessen:

1. **Zeitmessung der reinen Einpassung** (Release-Bau, Messlauf neben `logik-test`): 720×1280 → 1920×1080 und
   360×640 → 1280×720, je 500 Bilder. **Grenze: Median ≤ 2 ms, 95. Perzentil ≤ 4 ms je Bild** auf dem Rechner der
   Sitzung (Kategorie Show-Rechner). Das sind bei 5 Hochkant-Slots × 25 Bilder/s höchstens ~250 ms Rechenzeit je
   Sekunde, verteilt auf die SDK-Threads. Wird die Grenze gerissen → Ansatz 3 (libyuv).
2. **Testmeeting** mit dem Handy des Owners hochkant, 1080p-Slot auf „einpassen“: `workUs` je Slot und `cpuPct` der
   Bridge gegen denselben Slot auf „Original“; Drehen hoch → quer → hoch; Aussetzer (Kamera kurz aus) mit Ersatzbild
   „transparent“ und „Zoom-Kachel“.

## Prüfen

- **Logik (logik-test, g++/cl mit -Werror bzw. /WX):** neue `bild_einpassen_test.cpp` (in `TESTDATEIEN`,
  selftest.ts:3272-3276): `ist16zu9`-Grenzfälle, `bildFlaeche` (gerade Werte, mittig, 720×1280 in 1920×1080 →
  608×1080 bei x 656), Seitenränder Alpha 0 und UYVY 128/16, Fläche Alpha 255, Farbtreue eines einfarbigen Bildes
  (Y/U/V unverändert), Hochskalieren (360×640) und ungerade Quellgrößen; `delay_line_test.cpp` für `Bildart::Uyva`.
- **Selbsttests:** Bridge `npm run selftest` (Quell-Wächter, Protokoll-Katalog, Fake-Bridge-Feld, Fehlerschlüssel);
  Connect `npm run selftest` (Feldanzahl 11 → 12 in zoom-teile/zoom-settings/zoom-slots-abgleich/zoom-slots-Tests,
  `normiereSlot`-Vorgabe, `AENDERBAR`, `slotSetFuer`-Unterschied, `slotOnBefehl`-Abbildung, Texte).
- **NDI Ende zu Ende ohne Zoom:** `--ndi-selftest` (main.cpp:422-490) sendet zusätzlich ein eingepasstes
  künstliches Hochkantbild; `test/ndi-probe.mjs` empfängt es und prüft 1920×1080, Alpha 0 an den Seiten,
  Alpha 255 in der Mitte.
- **Testmeeting:** siehe „Messen“ Stufe 2, dazu Mischer-Probe mit dem Mischer der Crew (Owner).

## Auslieferung

Connect 0.4.5 mit neuer Bridge; während COP31 nur im Fenster 18–06 Uhr bzw. an einem vom Owner genannten Off-Tag.
Vorher Testmeeting (Stufe 2). Changelog-Texte legt die Sitzung dem Owner vor.

## Calls der Sitzung (zur Prüfung)

- `frame` auf slotOn optional (fehlt = native) statt Pflicht wie `fallback` – ältere Aufrufer bleiben gültig.
- Gilt in allen drei Modi (Teilnehmer, Sprecher, Freigabe): Eine 16:10-Bildschirmfreigabe wird ebenso eingepasst.
- 16:9-Erkennung mit 1 % Spielraum.
- Ersatzbilder nehmen im Modus „einpassen“ die Fläche des Livebilds ein (schwarz = schwarze Bildfläche, Seiten
  durchsichtig), nicht den ganzen Rahmen.
- Die Kopie für „eingefroren“ bleibt Rohbild und wird erst beim Senden eingepasst.
- Bilinear statt einfacher Pixelwahl (wie die Vorschau): Verkleinern um ~0,84 bzw. Vergrößern um ~1,7 sähe sonst
  treppig aus.
- Messgrenze 2 ms Median / 4 ms P95 je Bild.

## Für den Bau offen

- Genaue Aufteilung von `bild_einpassen.h` (Hilfsfunktionen, Festkomma-Stellen).
- Ob die Zeitmessung ein eigenes npm-Skript bekommt oder in `logik-test` einen Messschalter.
