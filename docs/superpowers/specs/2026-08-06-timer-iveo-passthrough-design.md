# JM Timer — iveo-Felder in den Timer durchreichen (Sub-B) — Design

> Sub-Projekt **B** der Timer-Erweiterung (Roadmap Lane A), nach Sub-A (geplante
> Startzeiten, `timer-v0.8.0`), Sub-C1 (Import-Mapping, `timer-v0.9.0`) und Sub-C2
> (Verantwortlich/Kategorie, `timer-v0.10.0`). Letztes offenes Slice der #11-Erweiterung.

**Stand:** 2026-08-06 · Branch `feat/timer-iveo-passthrough` (von `main`)

## Ausgangsbefund (am Code verifiziert)

Das ursprüngliche Sub-B-Ziel „iveo-Agenda-Items als Cues in den Timer" ist **bereits
umgesetzt** — wie seinerzeit Issue #11 selbst:

- **API:** `GET /events/{event}/programs/{program}/agenda-items` (dokumentiert).
- **`@jm/iveo`:** `IveoAgendaItem` (`types.ts`), `IveoClient.listAgendaItems()` (`client.ts`),
  `agendaToAblauf()` (`mapper.ts`).
- **Launcher:** `resolveSideEvent()` in `apps/launcher/src/main/iveo-sync.ts` ruft die Agenda in
  **bind und poll** ab; ohne gepflegte Agenda fällt es auf „Programm = 1 Punkt" zurück.
- **Timer:** `ablaufToTimetable()` in `apps/timer/src/main/index.ts` übernimmt den Ablauf.

**Die tatsächliche Lücke** ist der Transport-Typ: `ShowAblaufItem` trägt nur
`{ label, durationMs?, note? }`. Alles Weitere fällt auf dem Weg heraus — insbesondere genau
die Felder, die der Timer seit Sub-A/Sub-C2 kennt und anzeigt.

## Ziel

Die in iveo vorhandenen Angaben bis ins `TimetableItem` durchreichen, sodass ein aus iveo
materialisierter Ablauf **ohne manuelles Nachtragen** Soll-Zeiten (inkl. Drift), Verantwortlich
und Kategorie zeigt.

## Nicht-Ziele (YAGNI)

- **Keine neue Timer-UI** — Drift-Pille, Zeilen-Delta und die V/K-Unterzeile existieren bereits
  und greifen automatisch, sobald die Felder gefüllt sind.
- **Kein Rückschreiben nach iveo** (die API ist read-only genutzt).
- **Keine IANA-Zeitzonen-Bibliothek** und kein Mehrtages-/Über-Mitternacht-Handling
  (Sub-A-Semantik: Tageszeit gegen den heutigen lokalen Tag).
- **Keine neuen Endpunkte** — nur bereits abgerufene Daten.
- **Kein Token/PII-Leck:** owner ist ein bereits in der Show enthaltener Speaker-**Name**;
  keine Bios/Fotos/Social-Links, kein Token (unverändert zur bestehenden Allowlist-Praxis).

## Modell (`@jm/show`, additiv)

`ShowAblaufItem` bekommt drei optionale Felder — identisch benannt/typisiert wie in
`TimetableItem` (Timer) und `ParsedRow` (`@jm/regieplan`):

```ts
export interface ShowAblaufItem {
  label: string;
  durationMs?: number;
  note?: string;
  /** Geplante Startzeit als ms seit LOKALER Mitternacht (Tageszeit). */
  plannedStartMs?: number;
  /** Verantwortlich (freier Text). */
  owner?: string;
  /** Kategorie (freier Text). */
  category?: string;
}
```

`ShowAblaufItem` wird außerdem von **JM Rundown** (`apps/rundown/src/main/{index,store}.ts`) und
dem Launcher-Show-Editor konsumiert → die Erweiterung ist **additiv**, beide ignorieren die
neuen Felder.

## Zeitzonen-Entscheidung (wichtig)

Sub-As Drift rechnet gegen die **lokale Mitternacht der ausführenden Maschine**
(`midnightMsLocal(now)` + `Date.now()`). Eine Venue-Wanduhrzeit wäre bei abweichender Zeitzone um
den Offset falsch — die Drift-Anzeige würde in die Irre führen. Deshalb:

- **Primär `starts_at`** (UTC mit `+00:00`-Offset): `new Date(starts_at)` parst eindeutig; die
  Tageszeit wird mit `getHours()/getMinutes()/getSeconds()` gelesen — also **Maschinen-lokal**,
  exakt die Semantik von `midnightMsLocal`.
- **Fallback `starts_at_local`** (Venue-Wanduhr ohne Offset), nur wenn `starts_at` fehlt: der
  Zeitanteil `HH:MM(:SS)` wird direkt übernommen. Dokumentiert als Best-Effort — stimmt genau
  dann, wenn Venue- und Maschinen-Zeitzone übereinstimmen.
- Fehlen beide oder ist der Wert unparsebar → **kein** `plannedStartMs` (Feld bleibt leer).

Neuer reiner Helfer in `@jm/iveo/mapper.ts`:

```ts
/**
 * Startzeit eines Programms als ms seit LOKALER Mitternacht (Maschinen-Zeitzone).
 * Bevorzugt `starts_at` (UTC mit Offset) → maschinen-lokale Tageszeit; sonst
 * `starts_at_local` (Venue-Wanduhr) als Best-Effort. null, wenn nichts parsebar.
 */
export function localTimeOfDayMs(
  p: { starts_at?: string | null; starts_at_local?: string | null },
): number | null;
```

## Befüllung (`@jm/iveo/mapper.ts`, rein + testbar)

Beide bestehenden Mapper bekommen **optionale Options** — die Signaturen bleiben
rückwärtskompatibel (bestehende Aufrufer ohne Options verhalten sich unverändert).

**Programm-Pfad** — `programToAblaufItem(p, opts)` / `programsToAblauf(programs, opts)`,
`ProgramMapOptions` wächst um:
```ts
  /** Startzeit + Kategorie + Verantwortlich mit befüllen (Default false — Verhalten unverändert). */
  withSchedule?: boolean;
  /** id → Anzeigename, zur Auflösung verknüpfter Speaker. */
  speakerNamesById?: Map<string, string>;
```
- `plannedStartMs` = `localTimeOfDayMs(p)` (nur wenn `withSchedule`).
- `category` = `p.format_slug ?? p.type_slug` (getrimmt, leer → weg).
- `owner` = Namen der über `extractSpeakerIds(p)` gefundenen Speaker, mit `' · '` verbunden;
  keine Treffer → Feld bleibt leer.

**Agenda-Pfad** — `agendaToAblauf(items, opts)` mit neuem `AgendaMapOptions`:
```ts
export interface AgendaMapOptions {
  /** Soll-Startzeit des ersten Punktes (ms seit lokaler Mitternacht) — Anker der Kette. */
  firstStartMs?: number | null;
  /** Kategorie, die alle Punkte des Side Events erben. */
  category?: string;
  /** id → Anzeigename, zur Auflösung verknüpfter Speaker je Agenda-Punkt. */
  speakerNamesById?: Map<string, string>;
}
```
- **Nur der erste** Punkt erhält `plannedStartMs = firstStartMs`; die übrigen bleiben leer und
  werden im Timer von Sub-As `computePlannedSchedule` als **Kette aus den Dauern** berechnet
  (bewusst kein Duplizieren der Kettenlogik).
- `category` erben alle Punkte (sie gehören zum selben Side Event).
- `owner` je Punkt aus `extractSpeakerIds(item)` (die Verknüpfung kann fehlen → leer).

## Verdrahtung

**Launcher** (`apps/launcher/src/main/iveo-sync.ts`): der Launcher setzt `withSchedule: true` an
**jeder** Stelle, an der er einen Ablauf baut, und reicht eine aus `snap.speakers` gebaute
`Map<id, name>` mit:

1. **Programmlisten-Pfad** (`programsToAblauf`) — hier tragen die Programme echte Startzeiten,
   das ist der wertvollste Fall.
2. **Side-Event-Agenda** (`agendaToAblauf`) — `firstStartMs = localTimeOfDayMs(source)` und
   `category` aus dem Programm (`format_slug ?? type_slug`).
3. **Side-Event-Fallback** ohne gepflegte Agenda (`programToAblaufItem(source, …)`) — das eine
   Item ist das Programm selbst, bekommt also dessen Startzeit/Kategorie.

Betrifft **alle** Aufrufstellen in bind **und** poll, damit ein iveo-Reload während der Show
dieselben Felder liefert.

**Timer** (`apps/timer/src/main/index.ts`, `ablaufToTimetable`): die drei Felder ans
`TimetableItem` weiterreichen. Danach greifen Drift-Pille, Zeilen-Delta und V/K-Unterzeile
**ohne weitere Änderung**.

## Fehlerbehandlung

Alle drei Felder sind optional und rein additiv: fehlende Startzeit, fehlende Speaker-Verknüpfung
(iveo v1 liefert sie laut Code-Kommentar bislang nicht zuverlässig) oder fehlender Slug führen
**nur** dazu, dass das jeweilige Feld leer bleibt — nie zu einem Fehler oder Abbruch. Die
bestehende Launcher-Diagnose (Feld-Schlüssel ins Log, Warnung bei fehlender Verknüpfung) bleibt.

## Tests + Verifikation

- **Reine Mapper-Tests** (`packages/iveo/test/selftest.ts`):
  - `localTimeOfDayMs`: `starts_at` (UTC) → maschinen-lokale Tageszeit (TZ-unabhängig geprüft,
    indem der Erwartungswert mit derselben `Date`-API gebildet wird); `starts_at_local`-Fallback;
    beides fehlend/Müll → `null`.
  - `programToAblaufItem` mit `withSchedule`: `plannedStartMs` + `category` gesetzt; **ohne**
    Options unverändert (Regression).
  - `agendaToAblauf` mit Options: **nur** Punkt 1 trägt `plannedStartMs`, alle erben `category`;
    ohne Options unverändert (Regression).
  - Speaker-Auflösung: mit Treffern → verbundener Name; **ohne Verknüpfung → Feld leer** (kein Fehler).
- **Typecheck + Build** für `@jm/timer`, `@jm/rundown`, `@jm/launcher` (alle konsumieren
  `ShowAblaufItem`); `@jm/iveo`- und `@jm/regieplan`-Selftests grün.
- **Manuell (Owner/Windows-GUI):** Show mit iveo-Event + Side Event öffnen → Timer zeigt
  Soll-Zeiten (Drift-Pille aktiv), Kategorie und — falls iveo verknüpft — Verantwortlich; ein
  iveo-Reload während der Show liefert dieselben Felder.

## Release

Timer wird von der CI gebaut → nach Merge Tag **`timer-v0.11.0`** (Minor) + automatischer
Katalog-Bump. `@jm/show` und `@jm/iveo` wandern transitiv in Timer, Rundown und Launcher —
additiv, kein Zwang zu deren Sofort-Release.
