# JM Sync — Testen & QA

## Automatisiert (headless)

```bash
npm run selftest    # 18 Checks – reine Engine-Mathematik + End-to-End-Pipeline
npm run typecheck   # node + web
npm run build       # Electron-Renderer
npm run build:web   # PWA
```

Der Selbsttest ([tools/engine-selftest.ts](tools/engine-selftest.ts)) deckt ab:

- **Statistik** — Median, MAD, Ausreißer-Verwerfung.
- **Flanke** — zwei Blitze erkannt, Sub-Frame-Interpolation auf ~0,4 ms genau.
- **Onset** — Goertzel findet den Burst, kein Fehlalarm auf Rauschen.
- **Korrelator** — Paarung, „Audio führt"-Vorzeichen, verpasste/zusätzliche Events,
  keine Doppelzuordnung.
- **End-to-End** — simuliertes Capture (Luminanz-Rampe + Ton-Burst mit bekanntem
  Versatz) durch die *echten* Detektoren + Korrelator: Versatz wird auf ±12 ms
  zurückgewonnen, Jitter ~0.

> Nicht automatisierbar: `getUserMedia`, `requestVideoFrameCallback`, `AudioWorklet`
> und das Audio-/Video-Clock-Anchoring laufen nur im Browser/Electron mit echter
> Hardware — siehe manuellen Loopback-Test unten.

## Manueller Loopback-Test (echte Hardware)

Der schnellste Ende-zu-Ende-Check ohne Pipeline — bestätigt, dass Blitz- und
Piep-Erkennung zusammenspielen:

1. `npm run dev` (Desktop) **oder** `npm run dev:web` (Handy/PWA, über HTTPS bzw.
   im LAN öffnen).
2. Tab **Generator** → *Starten* (ggf. *Vollbild*). Es blitzt + piept im Takt.
3. Auf einem **zweiten Gerät** (oder Browserfenster) Tab **Messung** öffnen →
   *Zugriff erlauben & Geräte laden* → Quelle wählen → *Messung starten*.
4. Kamera auf den Generator-Screen, Mikro Richtung Lautsprecher halten.
5. Nach ein paar Zyklen erscheint eine stabile Ablesung + Verlaufsgraph.
6. Tab **Kalibrierung** → *Abgleich starten* → bei stabilem Wert *Als Null
   übernehmen*. Danach zeigt die Messung roh **und** kalibriert.

### Erwartungen / Akzeptanz

- Ablesung stabil, Jitter (MAD) niedrig (Größenordnung ≤ 5–10 ms je nach Quelle).
- Vorzeichen korrekt: Ton früher ⇒ „**Audio führt**" (positiv).
- Frequenz im Generator ändern ⇒ Messung lockt automatisch nach (geteilte
  Einstellung); Erkennung bleibt stabil.
- Gerät aus-/einstecken ⇒ Geräteliste aktualisiert sich (`devicechange`).
- Kalibrierung übersteht App-Neustart (localStorage).

### Echte Pipeline-Messung

Wie der Loopback, aber den Generator-Screen durch die Streaming-Kette schicken
(Encoder → Netzwerk → Player) und am Ausgang messen. Die Differenz = der von der
Pipeline eingebaute A/V-Versatz. Einmalige Kalibrierung vorher abziehen.

## Bekannte Grenzen

- Auflösung der Videoseite ist durch die Quell-Framerate begrenzt (60 fps ≈ 16 ms
  Schritte, per Interpolation feiner). Hardware-„Sync-It-Plus" ≈ 1 ms.
- **Browser-Tab als Quelle** (Desktop-Quick-Check) ist unzuverlässig — der Browser
  re-synchronisiert A/V selbst. Für echte Messungen Kamera/Mikro oder Capture-Card
  nutzen.
