# Connect: Ton-Limiter und Pegelmessung in der Zoom-Bridge — Kurzentwurf

Stand 2026-11-14 · Größe: kleine Änderung · Ansatz B (Owner-Wahl 14.11.)

## Anlass und Warum

Am Do 12.11. zwischen 8 und 11 Uhr sahen die Kollegen am TC einen sehr starken Pegelausschlag auf einem Zoom-Kanal. Die Logs vom Bridge-PC zeigen: Connect sendete in dem Fenster Mischton (fast nur Slot 4, 08:21–09:57; kurz Slot 1 und 2), technisch sauber (32 kHz mono, nichts verworfen, kein Stau, kein Pufferfehler). Die Bridge reicht Zooms PCM16 heute 1:1 an NDI weiter (`ndi_sender.cpp`, `reference_level = 0`). **Pegel stehen nirgends im Log** — der Ausschlag selbst ist nicht nachweisbar, und der Zoom-Pegel wurde nie gemessen („Pegel plausibel?“ steht offen auf der Abnahmeliste).

Ziel: Spitzen aus dem Meeting erreichen den TC nicht mehr in voller Höhe, und ein nächster Vorfall ist im Log mit Uhrzeit und Slot sichtbar.

## Ziele

1. **Limiter je Slot** direkt vor dem NDI-Versand: kein Abtastwert über der Grenze.
2. **Normale Sprache bleibt unverändert**: solange der Limiter nicht eingreift, gehen die Abtastwerte bitgenau durch.
3. **Pegelzeile im Log** alle 10 s je Slot, der Ton sendet (plus Anlauf-Sekunde, wie die Ton-Messung).

## Nicht-Ziele

- Keine Pegelanzeige in der Connect-Oberfläche, kein Schalter, keine neue Einstellung.
- Kein Kompressor, kein automatischer Pegelausgleich (Ansatz C verworfen).
- `reference_level` bleibt 0.

## Anti-Ziele (wäre ein Fehlschlag, selbst wenn es „funktioniert“)

- Der Grundpegel am TC verschiebt sich mitten in der COP (Tonleute müssten ihre Eingänge neu einpegeln).
- Hörbares Pumpen oder Verzerren bei normaler Sprache.
- Zusätzliche Latenz, die Bild und Ton auseinanderbringt.

## Ansätze

- **A — reine Notbremse:** Limiter mit fester Grenze, sonst nichts. Kleinster Eingriff, aber ein nächster Vorfall bliebe wieder unsichtbar, und die Grenze wäre geraten.
- **B — Notbremse + Pegelmessung (gewählt):** wie A, dazu die Pegelzeile. Macht den nächsten Vorfall sichtbar und lässt die Grenze nach gemessenem Zoom-Pegel setzen.
- **C — Kompressor/Pegelausgleich (verworfen):** verändert den Klang, kann pumpen, arbeitet gegen Zooms eigene Pegelregelung und nimmt dem Ton am TC die Kontrolle.

## Entwurf

**Ort:** in `NdiSender::sendAudio` (eigener Zustand je Sender, also je Slot). Damit sind beide Sendewege abgedeckt: direkt (`paketSenden`, Mischton/Person/Computerton) und Mischer (`mischerAusgeben`, Mischton + Computerton). Die Stille (`sendSilence`) bleibt unberührt. Die Rechenlogik kommt als reine Kopfdatei `native/audio_limiter.h` mit `native/audio_limiter_test.cpp` in `scripts/logik-test.mjs` (wie `audio_mix.h`): ohne Zoom, ohne NDI, ohne Meeting prüfbar.

**Verhalten:**
- Grenze als Konstante in dBFS. **Startwert −6 dBFS** (Vorschlag, siehe Abnahme).
- Einsatz sofort (ohne Vorausschau, also keine zusätzliche Latenz), Rückkehr weich in ca. 150 ms, danach wieder exakt Verstärkung 1.
- Mehrkanal (Computerton kann Stereo sein): eine gemeinsame Absenkung für alle Kanäle.
- Formatwechsel (Rate/Kanäle) setzt den Zustand zurück.

**Pegelzeile** (Werte VOR dem Limiter, also so, wie Zoom geliefert hat), Muster der bestehenden Zeilen:

```
Ton-Pegel Slot 4 [Dauerbetrieb]: Spitze -3,1 dBFS, Mittel -27,4 dBFS, Vollausschlag 0 Abtastwerte, Limiter griff in 0 von 1000 Paketen ein, staerkste Absenkung 0,0 dB.
```

„Vollausschlag“ zählt Abtastwerte bei ±32767/−32768, also Übersteuerung schon in Zoom. Stille wird als solche benannt, nicht als Zahl.

## Abnahme

1. Logik-Tests: unter der Grenze bitgenau; nie ein Wert über der Grenze; Rückkehr auf exakt 1; Stereo gemeinsam; Formatwechsel; Vollausschlag-Zählung.
2. **Testmeeting vor dem Release:** normale Sprache, laut sprechen, klatschen. Pegelzeilen lesen. **Die Grenze so setzen, dass normale Sprache den Limiter nie auslöst.** Erst dann steht im Code eine gemessene Zahl statt −6.
3. Mit dem gemessenen Wert „Pegel plausibel?“ auf der Abnahmeliste beantworten.

## Rahmen

- Release als Connect 0.4.3 (nur die Bridge ändert sich; Windows-Paket lokal gebaut). Während der COP nur im Fenster 18–06 Uhr; Patch-Notes zur Owner-Freigabe.

## Dem Bauenden überlassen

Ganzzahl- oder Gleitkommarechnung, genaue Rückkehrkurve, Aufbau des 10-s-Fensters im Mischer-Weg (dort gibt es heute keine Ton-Messung), Formulierung der Stille-Zeile.

## Meine Entscheidungen (zur Prüfung)

- Kein Schalter: eine abschaltbare Notbremse wird im Zweifel abgeschaltet; Rückweg ist die Vorversion.
- Startwert −6 dBFS, vor dem Release per Testmeeting ersetzt.
- Werte vor dem Limiter messen, damit die Zeile zeigt, was aus dem Meeting kam.

## Nachtrag 20.11.2026 (Owner-Entscheidungen bei der Wiederaufnahme)

- Release als **Connect 0.4.6** (0.4.3 bis 0.4.5 sind inzwischen vergeben), zusammen mit dem Fix „Slot-Einstellungen erscheinen sofort, auch ohne laufende Bridge“.
- Owner 20.11. 16:39: **vorläufiger fester Wert −6 dBFS, keine Einstellung.** Das Testmeeting (Abnahme 2 und 3 oben) entfällt vorerst; die endgültige Grenze kommt per Folge-Release aus den Pegelzeilen echter Einsätze. Abnahme 2 und 3 gelten damit für dieses Folge-Release, nicht für 0.4.6. Der Text oben bleibt als Stand vom 14.11. stehen.
- Die Abnahmeliste der Bridge (`packages/zoom-bridge/ABNAHME-STAGE3.md`, „Pegel plausibel?“) hat dazu einen Nachtrag: ab 0.4.6 zeigt der NDI-Monitor nie mehr über −6 dBFS, gemessen wird über die Pegelzeile.
