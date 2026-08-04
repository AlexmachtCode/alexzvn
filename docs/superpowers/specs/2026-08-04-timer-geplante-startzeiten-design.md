# JM Timer — Geplante Startzeiten + Soll/Ist-Drift (Sub-A) — Design

> Sub-Projekt A der Timer-Erweiterung (Roadmap Lane A, nach dem bereits erledigten
> Issue #11). Folge-Sub-Projekte: **B** feinere iveo-Kopplung (Agenda-Items als Cues),
> **C** Import/Export weitere Spalten + Mapping. Dieses Design betrifft **nur A**.

**Stand:** 2026-08-04 · Branch `feat/timer-planned-startzeiten`

## Ziel

Der Timer soll pro Ablaufpunkt eine **geplante Startzeit (Soll)** kennen und daraus die
**Soll/Ist-Drift** anzeigen — „Show +3:20 hinter Plan / pünktlich / 1:10 vor Plan". Die geplanten
Zeiten kommen aus einer neuen **xlsx-Startzeit-Spalte** oder werden im Operator gesetzt. Die
geplanten Zeiten sind **reine Referenz** — sie steuern den Ablauf nicht (kein Auto-Start).

## Nicht-Ziele (YAGNI)

- **Kein Auto-Start** zur Uhrzeit — der Timer läuft weiter auf Dauern; Soll-Zeiten zeigen nur Drift.
- **Keine Mehrtages-Datumslogik** — Soll-Zeiten sind **Tageszeit** (gegen den heutigen lokalen Tag
  aufgelöst). Über-Mitternacht-Shows sind ein dokumentierter Edge-Case (siehe unten).
- **Kein Warte-/Idle-Verhalten** bei Fixslots.
- **Sprecher-/Großanzeige unberührt** — Drift ist operator-fokussiert.
- Kein Sub-B/Sub-C-Inhalt (weitere Spalten, iveo-Agenda) — eigene Specs.

## Modell (Datenmodell + reine Rechnung)

Alle Änderungen in `apps/timer/src/shared/timer-state.ts` (plattformagnostisch: kein DOM/Node —
Main **und** Renderer nutzen es).

- `TimetableItem` bekommt **`plannedStartMs?: number`** — Soll-Startzeit als **Millisekunden seit
  lokaler Mitternacht** (Tageszeit, 0…86_399_999). Optional: leer = keine explizite Soll-Zeit.
  Wird von `tt:update`/`tt:setAll`/`tt:replaceItems` automatisch mitgeführt (Teil des Items;
  `Omit<TimetableItem,'id'>`), also **keine neuen Commands** nötig.

- **`computePlannedSchedule(items): Array<number | null>`** — je Item die geplante Tageszeit (ms
  seit Mitternacht) oder `null`:
  - Hat **kein** Item ein explizites `plannedStartMs` → **alle `null`** (kein Plan hinterlegt → Drift aus).
  - Sonst **Vorwärts-Kette ab dem ersten expliziten Anker:** ein Item mit `plannedStartMs` ist ein
    **Anker** (`planned[i] = plannedStartMs`, Cursor `= plannedStartMs + durationMs`); ein leeres Item
    nach einem Anker folgt (`planned[i] = cursor`, `cursor += durationMs`); Items **vor** dem ersten
    Anker bleiben `null` (üblich setzt Punkt 1 die Show-Startzeit). Ein späterer expliziter Wert
    ist ein **harter Fixslot**, der die Kette dort neu verankert.

- **`computeDrift(items, tt, cd, now): DriftResult`** mit
  `interface DriftResult { driftMs: number | null; perItem: Array<{ plannedClockMs: number; projectedClockMs: number; deltaMs: number } | null> }`.
  - **Projizierte Ist-Uhrzeit** je Item aus dem bestehenden `getProjectedSchedule(tt, cd, now)`
    (absolute ms; `null` für vergangene/idle Items).
  - **Geplante Ist-Uhrzeit** = `resolvePlannedClock(computePlannedSchedule(items)[i], now)` = heutige
    lokale Mitternacht + Tageszeit-ms.
  - `perItem[i]` nur gesetzt, wenn **beide** vorliegen (`deltaMs = projected − planned`, positiv = hinter Plan).
  - **`driftMs`** (Headline) = `deltaMs` des **aktiven** Items (bzw. `null`, wenn kein Plan/kein aktives Item).
  - Hilfsfunktion `midnightMsLocal(now)` (00:00 des lokalen Tages) — pur, testbar; Über-Mitternacht:
    Soll-Zeiten kleiner als die Startzeit könnten am Folgetag liegen — **Edge-Case dokumentiert, nicht
    behandelt** (Shows über Mitternacht bleiben Sub-Projekt-Backlog).

## xlsx-Startzeit-Spalte (`packages/regieplan`, geteilt — additiv, rückwärtskompatibel)

Geteilt mit **JM Rundown** → jede Änderung ist additiv; Rundown ignoriert das neue Feld.

- **`REGIEPLAN_HEADER`** bekommt die Spalte **„Startzeit"** (Export-Reihenfolge:
  `Programmpunkt, Startzeit, Dauer, Notiz`). Import ist spalten-**reihenfolgeunabhängig** (Header-Erkennung).
- ⚠️ **Fallstrick (im Code kommentieren):** die Dauer-Erkennung matcht heute `…|time|zeit`. Eine
  „Startzeit"-Spalte enthält „zeit" → sie würde als Dauer erkannt. Fix: neue
  **`START_KEYWORDS = /startzeit|start|beginn|uhrzeit|clock/`** **vor** der Dauer prüfen und die als
  Start erkannte Spalte aus der Dauer-Erkennung **ausschließen**.
- **`parseTimeOfDay(value): number | null`** (pur) → ms seit Mitternacht aus `"HH:MM"`, `"HH:MM:SS"`,
  Excel-Zeit-Bruch (`0…1` → `×86_400_000`) oder `Date`; sonst `null`.
- **`formatTimeOfDay(ms): string`** (pur) → `"HH:MM"` für den Export.
- **`ParsedRow`** bekommt `plannedStartMs?: number`; `parseRegieplan` füllt es; `rowsToAoa` +
  `exportRegieplanXlsx` schreiben die Spalte (leer, wenn keine Zeit). Timer-Import mappt
  `ParsedRow.plannedStartMs → TimetableItem.plannedStartMs`.

## UI (nur Operator)

- **Timetable-Zeilen** (`Timetable.tsx`/`TimetableRow.tsx`): pro Zeile **Soll-Uhrzeit · projizierte
  Ist-Uhrzeit · Delta** (farbig: pünktlich neutral/grün, hinter Plan `warning`/`destructive`, vor Plan
  dezent). Neben Dauer eine **Zeit-Eingabe** (`HH:MM`) zum Setzen/Löschen von `plannedStartMs`
  (leer = Kette). Delta/Ist nur, wenn ein Plan existiert und das Item projiziert wird.
- **Operator-Kopf** (`Operator.tsx`/`Topbar`): **Drift-Pille** aus `computeDrift(...).driftMs`
  („Show +3:20 hinter Plan" / „pünktlich" / „1:10 vor Plan"), versteckt wenn `driftMs === null`.
- **Import-Vorlage** (`downloadTemplate` in `lib/xlsx.ts`): Beispielzeilen bekommen eine
  `Startzeit`-Spalte (z. B. `09:00`, dann leer/fix gemischt), damit das Format klar ist.
- **Sprecher-/Großanzeige unberührt.**

## Tests + Verifikation

- **Reine Helfer unit-getestet:** `computePlannedSchedule` (kein Anker → alle null; Kette; Fixslot
  verankert neu; Items vor erstem Anker null), `computeDrift` (Delta-Vorzeichen, kein Plan → null,
  aktives Item), `parseTimeOfDay` (HH:MM, HH:MM:SS, Excel-Bruch, Müll → null), `formatTimeOfDay`,
  `midnightMsLocal`. Test-Harness analog zum bestehenden Muster (Timer/Regieplan-Selftest; im
  Plan-Schritt gegen die tatsächliche Test-Einrichtung prüfen).
- **Typecheck** (node+web) für `@jm/timer` + Build. Repo-weiter Typecheck, weil `@jm/regieplan`
  geteilt ist (Rundown muss grün bleiben).
- **Manuell (Owner/Windows-GUI):** xlsx mit Startzeit-Spalte importieren → Soll-Zeiten erscheinen;
  Timer laufen lassen → Drift-Pille + Zeilen-Delta stimmen; Fixslot-Zeile testen.

## Release

Timer wird von der **CI gebaut** (nicht nativ) → nach Merge Tag `timer-v0.8.0` (Minor: neue Fähigkeit)
+ Katalog-Bump. `@jm/regieplan`-Änderung wird transitiv in Timer **und** Rundown gebündelt → beim
nächsten Rundown-Release ist die Spalte auch dort verfügbar (kein Zwang, sofort zu releasen).
