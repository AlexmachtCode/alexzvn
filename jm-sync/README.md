# JM Sync

A/V-Versatz-Messung (Lipsync) für Live-Streaming — Softwareersatz für das
**Sync-It-Plus**. Teil der JM Production Suite.

## Prinzip

Es braucht **keine** synchronisierten Uhren zwischen Quelle und Messpunkt:

1. **Generator** löst Blitz + Piep exakt **gleichzeitig** aus (digitales
   Klappenbrett) und schickt sie durch die Streaming-Pipeline.
2. **Messung** erfasst beide Signale mit **einer** Uhr. Die gemessene Differenz
   Blitz↔Piep ist der A/V-Versatz, den die Pipeline eingebaut hat.

Messquellen: **Handy-Kamera + Mikro** (PWA, robustestes Prinzip) sowie
**Capture-Card + Audio-Interface** (Electron, fürs Studio). Beide werden als
normaler `MediaStream` konsumiert — ein Messpfad für beide.

## Stack

Wie die übrige Suite: Electron + electron-vite + React + Tailwind + Zustand +
Manrope. Eine Codebasis, zwei Ziele:

- **Electron-Hülle** (`src/main`, `src/preload`) — Desktop/Studio.
- **PWA-Build** (`vite.web.config.ts` → `dist-web/`) — Handy. Braucht in
  Produktion HTTPS-Hosting für den Kamerazugriff.

Plattformspezifisches läuft über [`src/renderer/src/platform.ts`](src/renderer/src/platform.ts);
die Mess-Engine liegt framework-neutral unter [`src/renderer/src/core/`](src/renderer/src/core/).

## Skripte

| Befehl | Zweck |
| --- | --- |
| `npm run dev` | Electron-App im Dev-Modus (Port 5177) |
| `npm run dev:web` | PWA im Dev-Modus (Port 5187) |
| `npm run build` | Electron-Build (`out/`) |
| `npm run build:web` | PWA-Build (`dist-web/`) |
| `npm run typecheck` | Typecheck (node + web) |
| `npm run dist:win` / `dist:mac` | Installer bauen |
| `npm run start:codespace` | Headless-Start unter xvfb |

## Mess-Engine

Framework-neutral unter [`src/renderer/src/core/`](src/renderer/src/core/):

- [edge.ts](src/renderer/src/core/edge.ts) — adaptive Anstiegsflanke mit Sub-Frame-Interpolation.
- [video-flash.ts](src/renderer/src/core/video-flash.ts) — `requestVideoFrameCallback` → ROI-Luminanz → Flanke.
- [audio-onset-core.ts](src/renderer/src/core/audio-onset-core.ts) / [audio-onset.worklet.js](src/renderer/src/core/audio-onset.worklet.js) — Goertzel-Onset auf dem Audio-Thread (Twin: Core ist testbar, Worklet läuft im AudioWorklet).
- [audio-onset.ts](src/renderer/src/core/audio-onset.ts) — Worklet-Wrapper, rechnet auf die `performance`-Uhr um.
- [correlator.ts](src/renderer/src/core/correlator.ts) + [stats.ts](src/renderer/src/core/stats.ts) — Paarung + Median/MAD mit Ausreißer-Verwerfung.
- [sync-meter.ts](src/renderer/src/core/sync-meter.ts) — Orchestrator (Stream → beide Detektoren → Korrelator → Live-Update).

Reine Mathematik per `npm run selftest` gegen synthetische Signale verifiziert.

## Status

**Phase 0 — Scaffold (fertig).** Hülle, Tabs, Plattform-Adapter, beide Builds grün.

**Phase 1 — Mess-Engine (fertig):** Blitz-/Piep-Erkennung + Korrelator + robuste
Statistik, in [MeasureView](src/renderer/src/views/MeasureView.tsx) verdrahtet
(Quellenwahl, Start/Stopp, Live-Ablesung „Audio/Video führt X ms"). Selbsttest
grün (11 Checks).

**Phase 2 — Generator, Kalibrierung, Graph (fertig):**

- [GeneratorView](src/renderer/src/views/GeneratorView.tsx) + [generator.ts](src/renderer/src/core/generator.ts) — Blitz + Piep gleichzeitig, Intervall/Frequenz live einstellbar, Vollbild.
- [CalibrateView](src/renderer/src/views/CalibrateView.tsx) + [store/calibration.ts](src/renderer/src/store/calibration.ts) — Null-Abgleich per Loopback, Baseline in localStorage, „Als Null übernehmen".
- Kalibrierung wird in der Messung abgezogen (roh + korrigiert sichtbar); [HistoryGraph](src/renderer/src/components/HistoryGraph.tsx) zeigt den Versatz-Verlauf.

**Phase 3 — Feinschliff & Robustheit (fertig):**

- Geteilter [Settings-Store](src/renderer/src/store/settings.ts) (zustand+persist): **eine** Frequenz für Generator *und* Messung (Mismatch ist unmöglich), gemerktes Intervall und Geräte.
- Geräte: Auto-Enumerieren, `devicechange`-Aktualisierung beim Aus-/Einstecken, gemerkte Auswahl mit Fallback.
- [Korrelator](src/renderer/src/core/correlator.ts): globale Minimal-Distanz-Paarung — tolerant gegen verpasste/zusätzliche Events, keine Doppelzuordnung.

**Testing:** `npm run selftest` = **18 Checks** inkl. End-to-End-Integration
(echte Detektoren auf simuliertem Capture). Manuelle QA-Anleitung in
[TESTING.md](TESTING.md). Typecheck + beide Builds + Headless-Start grün.

Offen / Ausblick: explizites Zähler-Pattern (bei normaler Taktung nicht nötig,
daher bewusst zurückgestellt), signierter Installer + PWA-Hosting.
