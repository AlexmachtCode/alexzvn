# Suite-UX-Roadmap — übersichtliche Steuerpulte (#165)

> **Kurzfassung, Stand 2026-10-08.** Diese Roadmap ist abgelöst. Maßgeblich ist die Spec
> [`docs/superpowers/specs/2026-10-08-suite-ux-update-design.md`](../superpowers/specs/2026-10-08-suite-ux-update-design.md),
> vom Owner am 2026-10-08 freigegeben (Vorgaben UO1–UO8). Die Einordnung in die Gesamtplanung steht als **Lane E** in
> [`docs/roadmap.md`](../roadmap.md). Die ausführliche Fassung vom 2026-08-07 liegt in der Git-Historie dieser Datei.

## Leitprinzip

**Live-Bedienung sichtbar, Einrichtung weggeräumt.** Es gilt unverändert (Spec Abschnitt 0).

## Phase 1 — erledigt

Fundament und Titler-Pilot, PR #168, gemergt am 2026-07-04:
[`Collapsible`](../../packages/ui/src/components/Collapsible.tsx),
[`SettingsSection`](../../packages/ui/src/components/SettingsSection.tsx) und
[`Tabs`](../../packages/ui/src/components/Tabs.tsx) liegen in `@jm/ui`, die Titler-
[`OperatorView`](../../apps/titler/src/renderer/src/views/OperatorView.tsx) nutzt sie. Die drei Bausteine bleiben in
Gebrauch.

## Phasen 2–5 — abgelöst durch die Wellen der Spec

Die alten Phasen werden nicht mehr einzeln geführt; welche Phase in welche Welle aufgeht, steht in Anhang B der Spec.
Es gelten die Wellen aus Spec Abschnitt 9.1:

| Welle | Inhalt |
|---|---|
| 0 · Fundament + Pilot | `@jm/ui` (Bausteine, Optik-System), neues `@jm/settings`, Galerie; Titler als Pilot |
| 1 · Live-Kern | Switcher, Timer, Rundown, Q&A, Battle |
| 2 · übrige Live-Tools | Connect, Caption, Interpreter, Presenter, Prompter, Stage-Display, Recorder, Player, Studio-Control |
| 3 · Launcher + Werkzeuge | Launcher, Copy, Grafiktool, Media-Converter, Sync, DAW, Editor, Transcribe, App Designer, NDI-Screen-Capture |

Plan für das Fundament (Welle 0 ohne Pilot):
[`docs/superpowers/plans/2026-10-08-suite-ux-fundament.md`](../superpowers/plans/2026-10-08-suite-ux-fundament.md).
Der Titler-Pilot bekommt einen eigenen Plan, nach dem Merge von Master-Link 2b R2 und Zoom 4b (Spec 9.2).

## Nicht-Ziele

Siehe Spec Abschnitt 13.
