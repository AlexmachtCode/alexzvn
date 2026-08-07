# JM Switcher — Streaming sagt die Wahrheit (Lane D1) — Design

**Stand:** 2026-08-07 · Branch `feat/switcher-stream-truth` (von `main`) · Ziel-Release `switcher-v0.10.0`

Erstes von zwei Vorhaben der Roadmap-Spur **Lane D** (Switcher-Ausgabe). Das zweite — der physische
SDI-Ausgang über ein natives DeckLink-Addon — bekommt eine eigene Spec und wartet ohnehin auf Hardware
am Zielrechner.

## Ausgangsbefund (am Code verifiziert)

Der Owner meldete, der Switcher streame „nur mit 1280×720p25", und wünschte Full-HD als Option.

**Full-HD kann der Switcher bereits.** Die Programm-Auflösung ist einstellbar
(`store/settings.ts`: `ProgramResolution = '720p' | '1080p'`), steht per Vorgabe sogar auf **1080p**,
`SwitcherView` legt sie auf den Engine-Canvas, und der ffmpeg-Aufruf in `main/output.ts` enthält
**weder `-s`/`scale` noch `-r`** — er reicht durch, was der Canvas liefert.

Was in die Irre führt, ist die Oberfläche. In `views/SettingsView.tsx` steht fest verdrahtet:

> Auflösung: **1280×720 @ 30 fps** · Ton: stille AAC-Spur (Audio-Mix kommt in v0.2)

Beide Aussagen sind überholt: die Auflösung folgt der Einstellung, und Programmton gibt es seit
`switcher-v0.8.0`. Es ist dieselbe Fehlerklasse wie in `timer-v0.11.1` und `interpreter-v0.2.0`:
**die Anzeige behauptet etwas, das der Code nicht mehr tut.**

Zwei echte Defekte stecken daneben:

1. **Die Bildratenwahl wirkt nicht im Stream.** `core/output.ts` ruft `c.captureStream(30)` — fest 30.
   `outputFps` (25/30/50/60) erreicht heute nur NDI und den Zweitbildschirm
   (`SwitcherView`: `ndiOut.setFps` / `screenOut.setFps`). Wer 50 wählt, bekommt im Stream höchstens 30.
   Die beobachteten 25 passen dazu: der Canvas wird mit 25 gezeichnet, mehr kann der Abgriff nicht liefern.
2. **Die Bitraten-Hinweise nennen nur 720p-Werte** (Stream „~3000–6000", Aufnahme „~8000–16000").
   Wer auf 1080p schaltet und die Bitrate stehen lässt, bekommt Full-HD, das schlechter aussieht als 720p.

## Ziel

Die Einstellungen zeigen die tatsächlichen Werte, und die Bildratenwahl wirkt bis in Stream und Aufnahme.

## Nicht-Ziele (YAGNI)

- **Keine Skalierung in ffmpeg.** Die Auflösung kommt aus dem Canvas — nicht hochskalieren.
- Keine Änderung an NDI-Ausgabe, Zweitbildschirm, Multiview (bleibt bewusst 720p) oder Audio-Mix.
- Kein neuer Codec, keine neuen Ausgabeziele.
- **Die Bitrate wird beim Auflösungswechsel NICHT automatisch mitgezogen** — das überschriebe einen vom
  Operator gesetzten Wert. Der Hinweistext genügt.
- Eine laufende Aufnahme/Sendung wird **nie** neu gestartet, um eine Einstellung anzuwenden.

## Änderungen

### 1 · Bildrate wirkt im Ausgabepfad

`core/output.ts` (`OutputController`) bekommt eine Bildrate wie `NdiOutputController` sie schon führt:

```ts
/** Bildrate des Canvas-Abgriffs. Wirkt auf Aufnahme UND Stream. */
setFps(fps: number): void;
```

- `ensureCanvasStream()` benutzt den Wert statt der festen `30`.
- Ändert sich die Rate und läuft **kein** Recorder, wird der zwischengespeicherte `canvasStream`
  verworfen (Spuren stoppen, `null` setzen), damit der nächste Start mit der neuen Rate greift.
- Läuft ein Recorder, bleibt der Stream stehen: **MediaRecorder-Spuren sind nach dem Start
  unveränderlich.** Genau das ist für den Ton bereits in `core/audio.ts` dokumentiert. Die neue Rate
  greift beim nächsten Start; die Oberfläche sagt das (siehe 3).

`views/SwitcherView.tsx` reicht `outputFps` an `output` weiter — an derselben Stelle, an der es heute
schon an NDI und Zweitbildschirm geht.

### 2 · Bitraten-Empfehlung als reine Funktion

Neu in `store/settings.ts`, damit sie prüfbar ist (der Switcher hat bislang keinen Selbsttest):

```ts
/** Empfohlene Videobitrate in kbit/s je Auflösung und Senke. */
export function recommendedBitrate(
  resolution: ProgramResolution,
  kind: 'stream' | 'record',
): { min: number; max: number };
```

Werte: Stream 720p **3000–6000**, 1080p **6000–12000**; Aufnahme 720p **8000–16000**,
1080p **16000–32000**. Reine Zahlenlieferung, keine Nebenwirkung, kein Schreiben in die Einstellungen.

### 3 · Die Anzeige wird ehrlich

In `views/SettingsView.tsx`:

- Der feste Satz „1280×720 @ 30 fps" wird aus `RESOLUTIONS[programResolution]` und `outputFps` gebildet.
- Der Satz „Ton: stille AAC-Spur (Audio-Mix kommt in v0.2)" weicht der Wahrheit: Programmton, wenn eine
  Audioquelle gewählt ist, sonst die stille AAC-Spur.
- Beide Bitraten-Hinweise nennen die Werte aus `recommendedBitrate(programResolution, …)`.
- Bei Aufnahme und Stream steht der Hinweis, dass eine Änderung der Bildrate erst beim **nächsten Start**
  wirkt, solange gerade aufgenommen oder gesendet wird.

## Fehlerbehandlung

Alle Änderungen sind anzeigend oder betreffen den Aufbau des Canvas-Abgriffs. Eine ungültige oder fehlende
Bildrate fällt auf den bisherigen Wert zurück (`fps > 0 ? fps : DEFAULT`), wie es `NdiOutputController`
bereits handhabt. Kein Pfad kann Aufnahme oder Stream abbrechen.

## Tests

- **Neuer Selbsttest** `apps/switcher/test/selftest.ts` plus `selftest`-Skript in `apps/switcher/package.json`
  (Muster wie `@jm/timer` und `@jm/interpreter`): `recommendedBitrate` liefert für alle vier Kombinationen
  aufsteigende, plausible Bereiche; 1080p liegt in beiden Senken über 720p; `min < max`.
- Typecheck und Build für `@jm/switcher`.
- **Manuell (Owner, Windows):** 1080p und 50 fps einstellen, Stream starten, am Ziel prüfen, dass
  1920×1080 mit 50 fps ankommt. Gegenprobe: während laufender Sendung die Bildrate ändern → Hinweis
  erscheint, die Sendung läuft unverändert weiter.

## Release

`switcher-v0.10.0` (Minor, CI-gebaut) samt Katalogeintrag.
