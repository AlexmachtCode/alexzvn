# JM Timer — Geplante Startzeiten + Soll/Ist-Drift (Sub-A) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Der JM Timer kennt pro Ablaufpunkt eine geplante Startzeit (Soll) — aus einer neuen xlsx-Startzeit-Spalte oder im Operator gesetzt — und zeigt daraus die Soll/Ist-Drift („Show +3:20 hinter Plan").

**Architecture:** Reine, testbare Helfer im plattformagnostischen `timer-state.ts` (`computePlannedSchedule`, `computeDrift`) und im geteilten `@jm/regieplan` (`parseTimeOfDay`/`formatTimeOfDay` + Startzeit-Spalte). Die Operator-UI zeigt Soll/Ist/Delta je Zeile + eine Drift-Pille. Geplante Zeiten sind reine Referenz — kein Auto-Start.

**Tech Stack:** TypeScript, React/Zustand-Renderer, `xlsx` (SheetJS, lazy), `node --experimental-strip-types` als Test-Harness.

## Global Constraints

- **Ziel-Release:** `timer-v0.8.0` (Minor; CI-gebaut, kein nativer Build). package.json heute `0.7.0`.
- **`@jm/regieplan` ist GETEILT mit JM Rundown** → jede Änderung additiv/rückwärtskompatibel; **Rundown-Build muss grün bleiben**. Rundown ignoriert das neue Feld; sein Export bekommt eine leere Startzeit-Spalte (akzeptiert).
- **Reine Helfer sind node-/DOM-frei** (`timer-state.ts`, die neuen `@jm/regieplan`-Funktionen) → laufen unter `node --experimental-strip-types`.
- **`plannedStartMs` = Millisekunden seit LOKALER Mitternacht** (Tageszeit, 0…86_399_999), zur Laufzeit gegen `midnightMsLocal(now)` aufgelöst. Über-Mitternacht = dokumentierter Edge-Case, NICHT behandelt.
- **Drift = projiziert − geplant** (positiv = hinter Plan). `driftMs` (Headline) = Delta des NÄCHSTEN Punktes (fällt auf den aktiven zurück) — **live-bewusste** Projektion (aktives Ende frühestens `now`, damit Überzug sichtbar wird).
- **Startzeit-Header-Erkennung VOR der Dauer-Erkennung** und die als Start erkannte Spalte aus der Dauer ausschließen (die Dauer-Regex matcht sonst „zeit" in „Startzeit").
- **Timetable-Header-Grid und TimetableRow-Grid müssen dieselben Spalten haben** (7 Spalten nach dieser Änderung).
- **CRLF:** EOL-bewusst editieren; `changelog.json` keine ASCII-Anführungszeichen, JSON validieren.

---

## File Structure

- `packages/regieplan/src/index.ts` — **Modify:** `parseTimeOfDay`/`formatTimeOfDay`, `START_KEYWORDS`, `matchHeader`, `DetectedColumns.start`, `ParsedRow.plannedStartMs`, `REGIEPLAN_HEADER`, `parseRegieplan`, `rowsToAoa`, `exportRegieplanXlsx`.
- `packages/regieplan/test/selftest.ts` — **Modify:** Tests für die neuen Funktionen + Startzeit-Spalte.
- `apps/timer/src/shared/timer-state.ts` — **Modify:** `TimetableItem.plannedStartMs`, `computePlannedSchedule`, `midnightMsLocal`, `computeDrift`, `DriftResult`.
- `apps/timer/test/selftest.ts` — **Create:** Test-Harness für die Timer-Helfer.
- `apps/timer/package.json` — **Modify:** `selftest`-Script.
- `apps/timer/src/renderer/src/store/timer.ts` — **Modify:** `computeDrift` re-exportieren.
- `apps/timer/src/renderer/src/lib/xlsx.ts` — **Modify:** `downloadTemplate`-Beispiel + `exportTimetable`-Parametertyp.
- `apps/timer/src/renderer/src/components/TimetableRow.tsx` — **Modify:** Startzeit-Eingabe + Delta + Grid.
- `apps/timer/src/renderer/src/components/Timetable.tsx` — **Modify:** Header-Grid + Drift-Pille + Props.
- `apps/timer/src/renderer/src/components/XlsxImport.tsx` — **Modify:** Startzeit in Vorschau/Meta.
- `packages/suite-manifest/changelog.json` — **Modify:** Eintrag 0.8.0.

---

### Task 1: `@jm/regieplan` — Tageszeit-Konverter (pur)

**Files:**
- Modify: `packages/regieplan/src/index.ts` (nach `formatHms`, ~Zeile 120)
- Test: `packages/regieplan/test/selftest.ts`

**Interfaces:**
- Produces: `parseTimeOfDay(value: unknown): number | null` (ms seit Mitternacht), `formatTimeOfDay(ms: number | null | undefined): string` (`"HH:MM"`).

- [ ] **Step 1: Failing tests ergänzen**

In `packages/regieplan/test/selftest.ts` den Import (Zeile 3) erweitern:

```ts
import { parseDuration, formatHms, rowsToAoa, parseRegieplan, parseTimeOfDay, formatTimeOfDay, REGIEPLAN_HEADER } from '../src/index.ts';
```

und VOR der `parseRegieplan`-Sektion (vor `const XLSX = await import('xlsx');`, ~Zeile 37) einfügen:

```ts
// parseTimeOfDay
ck('parseTimeOfDay HH:MM', parseTimeOfDay('09:30') === (9 * 60 + 30) * 60_000);
ck('parseTimeOfDay HH:MM:SS', parseTimeOfDay('09:30:15') === ((9 * 60 + 30) * 60 + 15) * 1000);
ck('parseTimeOfDay Excel-Bruch', parseTimeOfDay(9.5 / 24) === Math.round((9.5 / 24) * 86_400_000));
ck('parseTimeOfDay Date', parseTimeOfDay(new Date(Date.UTC(1899, 11, 31, 9, 30, 0))) === (9 * 60 + 30) * 60_000);
ck('parseTimeOfDay leer → null', parseTimeOfDay('') === null && parseTimeOfDay(null) === null);
ck('parseTimeOfDay Müll → null', parseTimeOfDay('abc') === null && parseTimeOfDay('99:99') === null);
ck('parseTimeOfDay nackte Zahl → null', parseTimeOfDay(5) === null);

// formatTimeOfDay
ck('formatTimeOfDay 09:30', formatTimeOfDay((9 * 60 + 30) * 60_000) === '09:30');
ck('formatTimeOfDay null → leer', formatTimeOfDay(null) === '' && formatTimeOfDay(undefined) === '');
```

- [ ] **Step 2: Run to verify fail**

Run: `npm run selftest -w @jm/regieplan`
Expected: FAIL — `parseTimeOfDay`/`formatTimeOfDay` sind kein Export (Import-Fehler oder FAIL-Zeilen).

- [ ] **Step 3: Konverter implementieren**

In `packages/regieplan/src/index.ts` nach `formatHms` (nach Zeile 120) einfügen:

```ts
/**
 * Eine Uhrzeit-Zelle als Millisekunden seit Mitternacht (Tageszeit). Akzeptiert
 * "HH:MM", "HH:MM:SS", Excel-Zeitbruch (0..1) und Date. `null`, wenn nicht
 * eindeutig als Uhrzeit parsebar (eine nackte Zahl ist mehrdeutig → null).
 */
export function parseTimeOfDay(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) {
    return (value.getUTCHours() * 60 + value.getUTCMinutes()) * 60_000 + value.getUTCSeconds() * 1000;
  }
  if (typeof value === 'number') {
    if (value > 0 && value < 1) return Math.round(value * 86_400_000); // Excel-Tageszeit-Bruch
    return null; // nackte Zahl bei einer Uhrzeit-Spalte ist mehrdeutig
  }
  if (typeof value === 'string') {
    const s = value.trim();
    const hms = s.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
    if (hms) {
      const h = Number(hms[1]), m = Number(hms[2]), sec = Number(hms[3]);
      if (h > 23 || m > 59 || sec > 59) return null;
      return (h * 60 + m) * 60_000 + sec * 1000;
    }
    const hm = s.match(/^(\d{1,2}):(\d{2})$/);
    if (hm) {
      const h = Number(hm[1]), m = Number(hm[2]);
      if (h > 23 || m > 59) return null;
      return (h * 60 + m) * 60_000;
    }
  }
  return null;
}

/** ms seit Mitternacht → "HH:MM" (Export-/Anzeigeformat). Leer bei null/undefined. */
export function formatTimeOfDay(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || ms < 0) return '';
  const totalMin = Math.round(ms / 60_000);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${pad(Math.floor(totalMin / 60) % 24)}:${pad(totalMin % 60)}`;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm run selftest -w @jm/regieplan`
Expected: PASS — alle bisherigen + die 9 neuen Prüfungen (`… passed, 0 failed`).

- [ ] **Step 5: Commit**

```bash
git add packages/regieplan/src/index.ts packages/regieplan/test/selftest.ts
git commit -m "feat(regieplan): parseTimeOfDay/formatTimeOfDay Tageszeit-Konverter (Timer #11/Sub-A)"
```

---

### Task 2: `@jm/regieplan` — Startzeit-Spalte in Erkennung/Parse/Export

**Files:**
- Modify: `packages/regieplan/src/index.ts` (Zeilen 15-82, 126-204)
- Test: `packages/regieplan/test/selftest.ts`

**Interfaces:**
- Consumes: `parseTimeOfDay`/`formatTimeOfDay` (Task 1).
- Produces: `ParsedRow.plannedStartMs?: number`; `REGIEPLAN_HEADER = ['Programmpunkt','Startzeit','Dauer','Notiz']`; `DetectedColumns.start`/`ParseResult.source.columns.start`; `rowsToAoa` akzeptiert `plannedStartMs?` je Zeile.

- [ ] **Step 1: Failing tests ergänzen**

In `packages/regieplan/test/selftest.ts` ans Ende (vor `console.log(\`\n${pass}...`)) einfügen:

```ts
// Startzeit-Spalte
ck('REGIEPLAN_HEADER hat Startzeit', REGIEPLAN_HEADER.join('|') === 'Programmpunkt|Startzeit|Dauer|Notiz');
const aoaS = rowsToAoa([{ label: 'A', plannedStartMs: (9 * 60) * 60_000, durationMs: 300_000, note: 'x' }]);
ck('rowsToAoa mit Startzeit', aoaS[1].join('|') === 'A|09:00|00:05:00|x');
function buildBufS(rows: (string)[][]): ArrayBuffer {
  const ws = XLSX.utils.aoa_to_sheet([['Programmpunkt', 'Startzeit', 'Dauer', 'Notiz'], ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Regieplan');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}
const bufS = buildBufS([['Keynote', '09:00', '00:30:00', '']]);
const parsedS = await parseRegieplan(bufS, { requireDuration: true });
ck('Startzeit-Spalte erkannt (getrennt von Dauer)', parsedS.source.columns.start !== null && parsedS.source.columns.duration !== null && parsedS.source.columns.start !== parsedS.source.columns.duration);
ck('plannedStartMs geparst', parsedS.rows[0]?.plannedStartMs === (9 * 60) * 60_000);
ck('Dauer weiterhin korrekt', parsedS.rows[0]?.durationMs === 1_800_000);
```

- [ ] **Step 2: Run to verify fail**

Run: `npm run selftest -w @jm/regieplan`
Expected: FAIL — Startzeit-Prüfungen scheitern (Header hat noch 3 Spalten, `columns.start` existiert nicht).

- [ ] **Step 3: Typ + Header + Erkennung anpassen**

In `packages/regieplan/src/index.ts`:

(a) `ParsedRow` (Zeile 15-20) um ein Feld erweitern:

```ts
export interface ParsedRow {
  label: string;
  /** Dauer in ms; 0, wenn keine/keine parsebare Dauer-Spalte. */
  durationMs: number;
  note?: string;
  /** Geplante Startzeit als ms seit Mitternacht (Tageszeit), wenn eine Startzeit-Spalte vorhanden ist. */
  plannedStartMs?: number;
}
```

(b) `ParseResult.source.columns` (Zeile 27) um `start` erweitern:

```ts
    columns: { label: string | null; start: string | null; duration: string | null; note: string | null };
```

(c) `START_KEYWORDS` nach `DURATION_KEYWORDS` (nach Zeile 44) einfügen und `REGIEPLAN_HEADER` (Zeile 48) ersetzen:

```ts
const START_KEYWORDS = /startzeit|beginn|uhrzeit|clock|^\s*start\s*$/;
```
```ts
export const REGIEPLAN_HEADER = ['Programmpunkt', 'Startzeit', 'Dauer', 'Notiz'] as const;
```

(d) `DetectedColumns` (Zeile 50-54) + `matchHeader` (Zeile 56-68) ersetzen:

```ts
interface DetectedColumns {
  label: string | null;
  start: string | null;
  duration: string | null;
  note: string | null;
}

function matchHeader(row: Record<string, unknown>): DetectedColumns {
  const out: DetectedColumns = { label: null, start: null, duration: null, note: null };
  for (const [col, val] of Object.entries(row)) {
    const v = String(val ?? '').toLowerCase().trim();
    if (!v) continue;
    if (out.label === null && LABEL_KEYWORDS.test(v)) out.label = col;
    // Start VOR Dauer: "Startzeit" enthält "zeit" und würde sonst als Dauer erkannt.
    if (out.start === null && START_KEYWORDS.test(v)) out.start = col;
    if (out.duration === null && col !== out.start && DURATION_KEYWORDS.test(v)) out.duration = col;
    if (out.note === null && NOTE_KEYWORDS.test(v)) out.note = col;
  }
  return out;
}
```

(e) `detectHeader`-Fallback (Zeile 81) um `start: null` ergänzen:

```ts
  return { headerIdx: -1, columns: { label: 'A', start: null, duration: 'B', note: 'C' } };
```

- [ ] **Step 4: Parse + Export anpassen**

(a) In `parseRegieplan` (nach Zeile 151, wo `note` gelesen wird) die Startzeit lesen und in die Zeile schreiben. Den Block Zeile 149-157 ersetzen:

```ts
    const label = columns.label !== null ? String(row[columns.label] ?? '').trim() : '';
    const startRaw = columns.start !== null ? row[columns.start] : undefined;
    const durationRaw = columns.duration !== null ? row[columns.duration] : undefined;
    const note = columns.note !== null ? String(row[columns.note] ?? '').trim() : '';
    const durationMs = parseDuration(durationRaw);
    const plannedStartMs = parseTimeOfDay(startRaw);
    if (!label || (requireDuration && durationMs <= 0)) {
      skipped += 1;
      continue;
    }
    rows.push({ label, durationMs, note: note || undefined, plannedStartMs: plannedStartMs ?? undefined });
```

(b) `rowsToAoa` (Zeile 173-180) ersetzen:

```ts
/** Ablauf-Zeilen → AoA (Header + Zeilen) im Export-Format. */
export function rowsToAoa(
  rows: Array<{ label: string; durationMs?: number; note?: string; plannedStartMs?: number }>,
): string[][] {
  return [
    [...REGIEPLAN_HEADER],
    ...rows.map((r) => [r.label ?? '', formatTimeOfDay(r.plannedStartMs), formatHms(r.durationMs), r.note ?? '']),
  ];
}
```

(c) In `exportRegieplanXlsx` die Spaltenbreiten (Zeile 189) um eine Spalte erweitern:

```ts
  ws['!cols'] = [{ wch: 28 }, { wch: 10 }, { wch: 12 }, { wch: 32 }];
```

- [ ] **Step 5: Run to verify pass**

Run: `npm run selftest -w @jm/regieplan`
Expected: PASS — `… passed, 0 failed` (inkl. der neuen Startzeit-Prüfungen; die Alt-Prüfung `rowsToAoa Header` in Task-1-Datei erwartete noch `Programmpunkt|Dauer|Notiz` → **diese Alt-Zeile mit anpassen**, s. Step 6).

- [ ] **Step 6: Alt-Test an neues Header-Format anpassen**

In `packages/regieplan/test/selftest.ts` die bestehenden `rowsToAoa`-Prüfungen (die Zeilen mit `'Programmpunkt|Dauer|Notiz'`, `'A|00:05:00|x'`, `'B||'`) ersetzen durch:

```ts
ck('rowsToAoa Header', aoa[0].join('|') === 'Programmpunkt|Startzeit|Dauer|Notiz');
ck('rowsToAoa Zeile1', aoa[1].join('|') === 'A||00:05:00|x');
ck('rowsToAoa Zeile2 (leer)', aoa[2].join('|') === 'B|||');
```

Dann erneut `npm run selftest -w @jm/regieplan` → PASS.

- [ ] **Step 7: Rundown bleibt grün (geteiltes Paket)**

Run: `npm run typecheck -w @jm/rundown && npm run build -w @jm/rundown`
Expected: PASS (Rundown ignoriert `plannedStartMs`; sein Export hat jetzt eine leere Startzeit-Spalte — kein Fehler).

- [ ] **Step 8: Commit**

```bash
git add packages/regieplan/src/index.ts packages/regieplan/test/selftest.ts
git commit -m "feat(regieplan): optionale Startzeit-Spalte (additiv, Rundown-kompatibel) (#11/Sub-A)"
```

---

### Task 3: `timer-state.ts` — Modell + Drift-Helfer (pur) + Timer-Selftest

**Files:**
- Modify: `apps/timer/src/shared/timer-state.ts`
- Create: `apps/timer/test/selftest.ts`
- Modify: `apps/timer/package.json` (`selftest`-Script)

**Interfaces:**
- Produces:
  - `TimetableItem.plannedStartMs?: number` (ms seit lokaler Mitternacht)
  - `midnightMsLocal(now?: number): number`
  - `computePlannedSchedule(items: TimetableItem[]): Array<number | null>`
  - `interface DriftPerItem { plannedClockMs: number; projectedClockMs: number; deltaMs: number }`
  - `interface DriftResult { driftMs: number | null; perItem: Array<DriftPerItem | null> }`
  - `computeDrift(tt: TimetableState, cd: CountdownState, now?: number): DriftResult`

- [ ] **Step 1: `selftest`-Script anlegen**

In `apps/timer/package.json` in `scripts` nach `"typecheck": ...` einfügen:

```json
    "selftest": "node --experimental-strip-types test/selftest.ts",
```

- [ ] **Step 2: Failing test schreiben**

Create `apps/timer/test/selftest.ts`:

```ts
// Selbsttest der reinen Timetable-/Drift-Helfer:
//   node --experimental-strip-types test/selftest.ts
import {
  computePlannedSchedule,
  computeDrift,
  midnightMsLocal,
  type TimetableItem,
  type TimetableState,
  type CountdownState,
} from '../src/shared/timer-state.ts';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}`); }
}

const H = 3_600_000, MIN = 60_000;
function item(id: string, durMin: number, plannedStartMs?: number): TimetableItem {
  return { id, label: id, durationMs: durMin * MIN, ...(plannedStartMs !== undefined ? { plannedStartMs } : {}) };
}
function tt(items: TimetableItem[], activeIndex: number | null): TimetableState {
  return { items, activeIndex, autoAdvance: false, autoAdvanceGraceSec: 5 };
}

// computePlannedSchedule
ck('kein Anker → alle null', computePlannedSchedule([item('a', 10), item('b', 10)]).every((v) => v === null));
const sched = computePlannedSchedule([item('a', 10, 9 * H), item('b', 10), item('c', 5, 12 * H)]);
ck('Anker gesetzt', sched[0] === 9 * H);
ck('Kette: b = a + Dauer', sched[1] === 9 * H + 10 * MIN);
ck('Fixslot verankert neu', sched[2] === 12 * H);
const sched2 = computePlannedSchedule([item('a', 10), item('b', 10, 10 * H)]);
ck('vor erstem Anker → null', sched2[0] === null && sched2[1] === 10 * H);

// computeDrift (synthetische Uhrzeiten am heutigen Tag)
const base = midnightMsLocal(Date.now());
const items = [item('a', 10, 9 * H), item('b', 10)]; // A 09:00 (10min), B chained 09:10
// Aktiv A, gestartet 09:00, jetzt 09:05 (pünktlich, läuft)
const cdOnTime: CountdownState = { durationMs: 10 * MIN, delayMs: 0, startedAtMs: base + 9 * H, pausedRemainingMs: null };
const dOn = computeDrift(tt(items, 0), cdOnTime, base + 9 * H + 5 * MIN);
ck('pünktlich → Drift 0', dOn.driftMs === 0);
// Aktiv A, gestartet 09:00, jetzt 09:20 (10 min Überzug)
const dOver = computeDrift(tt(items, 0), cdOnTime, base + 9 * H + 20 * MIN);
ck('Überzug → +10min hinter Plan', dOver.driftMs === 10 * MIN);
// Kein Plan hinterlegt → driftMs null
const dNone = computeDrift(tt([item('a', 10), item('b', 10)], 0), cdOnTime, base + 9 * H);
ck('kein Plan → driftMs null', dNone.driftMs === null && dNone.perItem.every((v) => v === null));
// Idle (kein aktives Item) → null
ck('idle → null', computeDrift(tt(items, null), cdOnTime, base + 9 * H).driftMs === null);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

- [ ] **Step 3: Run to verify fail**

Run: `npm run selftest -w @jm/timer`
Expected: FAIL — `computePlannedSchedule`/`computeDrift`/`midnightMsLocal` sind kein Export.

- [ ] **Step 4: Modell + Helfer implementieren**

(a) In `apps/timer/src/shared/timer-state.ts` `TimetableItem` (Zeile 24-29) erweitern:

```ts
export interface TimetableItem {
  id: string;
  label: string;
  durationMs: number;
  note?: string;
  /** Geplante Startzeit als ms seit LOKALER Mitternacht (Tageszeit). Optional; leer = aus der Kette. */
  plannedStartMs?: number;
}
```

(b) Am Dateiende (nach `getProjectedSchedule`, nach Zeile 407) anfügen:

```ts
/** 00:00 des lokalen Tages von `now` als absolute ms. */
export function midnightMsLocal(now: number = Date.now()): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Geplante Tageszeit (ms seit Mitternacht) je Item, oder null. Ohne einen einzigen
 * expliziten `plannedStartMs` → alles null (kein Plan). Sonst Vorwärts-Kette ab dem
 * ersten Anker; ein expliziter Wert verankert die Kette neu (Fixslot); Items vor dem
 * ersten Anker bleiben null.
 */
export function computePlannedSchedule(items: TimetableItem[]): Array<number | null> {
  const out: Array<number | null> = new Array(items.length).fill(null);
  const hasAnchor = items.some((it) => it.plannedStartMs !== undefined && it.plannedStartMs !== null);
  if (!hasAnchor) return out;
  let cursor: number | null = null;
  for (let i = 0; i < items.length; i++) {
    const explicit = items[i].plannedStartMs;
    if (explicit !== undefined && explicit !== null) {
      out[i] = explicit;
      cursor = explicit + items[i].durationMs;
    } else if (cursor !== null) {
      out[i] = cursor;
      cursor += items[i].durationMs;
    }
  }
  return out;
}

export interface DriftPerItem {
  plannedClockMs: number;
  projectedClockMs: number;
  deltaMs: number;
}
export interface DriftResult {
  driftMs: number | null;
  perItem: Array<DriftPerItem | null>;
}

/**
 * Soll/Ist-Drift. Projektion ist LIVE-bewusst: das Ende des aktiven Punktes ist
 * frühestens `now` (damit Überzug in die Drift durchschlägt). driftMs (Headline) =
 * Delta des nächsten Punktes (fällt auf den aktiven zurück). null, wenn kein Plan.
 */
export function computeDrift(
  tt: TimetableState,
  cd: CountdownState,
  now: number = Date.now(),
): DriftResult {
  const items = tt.items;
  const plannedOfDay = computePlannedSchedule(items);
  const midnight = midnightMsLocal(now);
  const projected: Array<number | null> = new Array(items.length).fill(null);
  if (tt.activeIndex !== null) {
    projected[tt.activeIndex] = cd.startedAtMs ?? now;
    const plannedEnd = getProjectedEndMs(cd, now) ?? now + effectiveDurationMs(cd);
    let cursor = Math.max(plannedEnd, now);
    for (let i = tt.activeIndex + 1; i < items.length; i++) {
      projected[i] = cursor;
      cursor += items[i].durationMs;
    }
  }
  const perItem: Array<DriftPerItem | null> = items.map((_, i) => {
    const p = projected[i];
    const pod = plannedOfDay[i];
    if (p === null || pod === null) return null;
    const plannedClockMs = midnight + pod;
    return { plannedClockMs, projectedClockMs: p, deltaMs: p - plannedClockMs };
  });
  let driftMs: number | null = null;
  const idx = tt.activeIndex;
  if (idx !== null) {
    const nextItem = perItem[idx + 1];
    if (idx + 1 < perItem.length && nextItem) driftMs = nextItem.deltaMs;
    else if (perItem[idx]) driftMs = perItem[idx]!.deltaMs;
  }
  return { driftMs, perItem };
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npm run selftest -w @jm/timer`
Expected: PASS — `10 passed, 0 failed`.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck -w @jm/timer`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/timer/src/shared/timer-state.ts apps/timer/test/selftest.ts apps/timer/package.json
git commit -m "feat(timer): plannedStartMs + computePlannedSchedule/computeDrift + Selftest (#11/Sub-A)"
```

---

### Task 4: Store-Re-Export + Import/Export-Verdrahtung

**Files:**
- Modify: `apps/timer/src/renderer/src/store/timer.ts:94-101`
- Modify: `apps/timer/src/renderer/src/lib/xlsx.ts`

**Interfaces:**
- Consumes: `computeDrift` (Task 3), `formatTimeOfDay` (Task 1), `plannedStartMs` auf `ParsedRow`/`TimetableItem`.
- Produces: `computeDrift` aus `@/store/timer` importierbar; `downloadTemplate` mit Startzeit-Beispiel; `exportTimetable` reicht `plannedStartMs` durch.

- [ ] **Step 1: `computeDrift` re-exportieren**

In `apps/timer/src/renderer/src/store/timer.ts` den Re-Export-Block (Zeile 94-101) um `computeDrift` ergänzen:

```ts
export {
  effectiveDurationMs,
  getCountdownRemaining,
  getProjectedEndMs,
  getProjectedSchedule,
  computeDrift,
  isCountdownPaused,
  isCountdownRunning,
} from '@shared/timer-state';
```

- [ ] **Step 2: `downloadTemplate` mit Startzeit-Spalte**

In `apps/timer/src/renderer/src/lib/xlsx.ts` die `downloadTemplate`-Beispielzeilen (Zeile 18-30) ersetzen — die AoA muss zur neuen 4-Spalten-`REGIEPLAN_HEADER` passen (Programmpunkt, Startzeit, Dauer, Notiz):

```ts
export async function downloadTemplate(): Promise<void> {
  await exportRegieplanXlsx(
    [
      [...REGIEPLAN_HEADER],
      ['Begrüßung', '09:00', '00:05:00', 'Einlauf / Moderation'],
      ['Keynote', '', '00:30:00', ''],
      ['Pause', '', '00:15:00', 'Catering'],
      ['Podiumsdiskussion', '12:00', '00:45:00', '3 Gäste (Fixslot)'],
      ['Abschluss', '', '00:10:00', ''],
    ],
    'JM-Timer-Regieplan-Vorlage.xlsx',
  );
}
```

- [ ] **Step 3: `exportTimetable` reicht `plannedStartMs` durch**

In `apps/timer/src/renderer/src/lib/xlsx.ts` die `exportTimetable`-Signatur (Zeile 36-40) erweitern, damit `plannedStartMs` an `rowsToAoa` gelangt:

```ts
export async function exportTimetable(
  items: Array<{ label: string; durationMs: number; note?: string; plannedStartMs?: number }>,
): Promise<void> {
  await exportRegieplanXlsx(rowsToAoa(items), 'JM-Timer-Ablauf.xlsx');
}
```

- [ ] **Step 4: Typecheck + Build**

Run: `npm run typecheck -w @jm/timer && npm run build -w @jm/timer`
Expected: PASS. (`ttSetAll(result.rows)`/`ttAdd(row)` tragen `plannedStartMs` automatisch — `ParsedRow` ist zu `Omit<TimetableItem,'id'>` strukturkompatibel, der Reducer spreadt `...it`.)

- [ ] **Step 5: Commit**

```bash
git add apps/timer/src/renderer/src/store/timer.ts apps/timer/src/renderer/src/lib/xlsx.ts
git commit -m "feat(timer): computeDrift re-export + Startzeit in Vorlage/Export (#11/Sub-A)"
```

---

### Task 5: Operator-UI — Startzeit-Eingabe, Delta je Zeile, Drift-Pille

**Files:**
- Modify: `apps/timer/src/renderer/src/components/TimetableRow.tsx`
- Modify: `apps/timer/src/renderer/src/components/Timetable.tsx`
- Modify: `apps/timer/src/renderer/src/components/XlsxImport.tsx`

**Interfaces:**
- Consumes: `computeDrift` (Task 4 re-export), `formatTimeOfDay`/`parseTimeOfDay` (Task 1), `item.plannedStartMs`.
- Produces: `TimetableRow` nimmt neue Props `plannedStartMs`- (aus dem Item) + `deltaMs: number | null`.

- [ ] **Step 1: TimetableRow — Import, Props, State**

In `apps/timer/src/renderer/src/components/TimetableRow.tsx`:

(a) Import ergänzen (nach Zeile 3):

```ts
import { formatTimeOfDay, parseTimeOfDay } from '@jm/regieplan';
```

(b) `Props` (Zeile 9-16) um `deltaMs` erweitern:

```ts
interface Props {
  item: TimetableItem;
  index: number;
  total: number;
  status: 'past' | 'active' | 'upcoming';
  /** projected wall-clock start time, ms, or null when not projectable */
  projectedStartMs: number | null;
  /** Soll/Ist-Delta in ms (positiv = hinter Plan), oder null wenn kein Plan. */
  deltaMs: number | null;
}
```

(c) Signatur (Zeile 18) + State (nach Zeile 27) erweitern:

```ts
export function TimetableRow({ item, index, total, status, projectedStartMs, deltaMs }: Props) {
```
```ts
  const [plannedDraft, setPlannedDraft] = useState(formatTimeOfDay(item.plannedStartMs));
  const [plannedError, setPlannedError] = useState<string | null>(null);
```

(d) Sync-Effekt (nach Zeile 31) + Commit-Funktion (nach `commitNote`, Zeile 47) ergänzen:

```ts
  useEffect(() => setPlannedDraft(formatTimeOfDay(item.plannedStartMs)), [item.plannedStartMs]);
```
```ts
  function commitPlanned() {
    const t = plannedDraft.trim();
    if (t === '') {
      if (item.plannedStartMs !== undefined) ttUpdate(item.id, { plannedStartMs: undefined });
      setPlannedError(null);
      return;
    }
    const ms = parseTimeOfDay(t);
    if (ms === null) { setPlannedError('HH:MM'); return; }
    setPlannedError(null);
    if (ms !== item.plannedStartMs) ttUpdate(item.id, { plannedStartMs: ms });
  }
```

- [ ] **Step 2: TimetableRow — Grid + Startzeit-Eingabe + Delta**

(a) Das Grid der Row-Wurzel (Zeile 52) auf 7 Spalten erweitern (Soll nach dem Titel):

```ts
        'grid grid-cols-[36px_minmax(0,1fr)_96px_120px_minmax(0,1fr)_96px_136px] items-center gap-3 px-4 py-3 rounded-[var(--radius-md)]',
```

(b) Direkt NACH dem Label-`Input` (nach Zeile 73, vor dem Dauer-`<div className="flex flex-col">`) die Startzeit-Eingabe einfügen:

```tsx
      <div className="flex flex-col">
        <Input
          value={plannedDraft}
          onChange={(e) => setPlannedDraft(e.target.value)}
          onBlur={commitPlanned}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          placeholder="—:—"
          className="text-center"
          title="Geplante Startzeit (leer = aus der Kette)"
        />
        {plannedError && (
          <span className="text-[10px] text-[var(--destructive)] mt-1 text-center">{plannedError}</span>
        )}
      </div>
```

(c) Die Status/Start-Zelle (Zeile 102-114) ersetzen, sodass unter der projizierten Ist-Uhrzeit das Delta erscheint:

```tsx
      <div className="text-xs text-center text-[var(--muted-foreground)] tabular">
        {status === 'active' ? (
          <StatusPill status="live">Live</StatusPill>
        ) : status === 'past' ? (
          <StatusPill status="done">Done</StatusPill>
        ) : projectedStartMs !== null ? (
          <div className="flex flex-col items-center leading-tight">
            <span className="tracking-wide">{formatWallClock(projectedStartMs)}</span>
            {deltaMs !== null && (
              <span className="text-[10px] font-bold tabular" style={{ color: driftColor(deltaMs) }}>
                {formatDelta(deltaMs)}
              </span>
            )}
          </div>
        ) : (
          <span className="text-[var(--muted-foreground)]">—</span>
        )}
      </div>
```

(d) Am Dateiende (nach `formatWallClock`, nach Zeile 189) zwei Helfer ergänzen:

```ts
function formatDelta(ms: number): string {
  const sign = ms > 0 ? '+' : ms < 0 ? '−' : '±';
  const total = Math.round(Math.abs(ms) / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${sign}${m}:${String(s).padStart(2, '0')}`;
}
function driftColor(ms: number): string {
  if (ms > 30_000) return 'var(--destructive)'; // > 30s hinter Plan
  if (ms < -30_000) return 'var(--primary)'; // > 30s vor Plan
  return 'var(--muted-foreground)';
}
```

- [ ] **Step 3: Timetable — Drift berechnen, Header-Grid, Pille, Props durchreichen**

In `apps/timer/src/renderer/src/components/Timetable.tsx`:

(a) `computeDrift` importieren (in den Block Zeile 2-9 aufnehmen):

```ts
  computeDrift,
```

(b) Nach `const schedule = getProjectedSchedule(tt, cd, now);` (Zeile 38) ergänzen:

```ts
  const drift = computeDrift(tt, cd, now);
```

(c) Das Header-Grid der Programmpunkte-Tabelle (Zeile 215-222) auf 7 Spalten bringen (Soll ergänzen):

```tsx
            <div className="grid grid-cols-[36px_minmax(0,1fr)_96px_120px_minmax(0,1fr)_96px_136px] gap-3 px-4 py-2 text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)] font-extrabold">
              <span className="text-center">#</span>
              <span>Titel</span>
              <span className="text-center">Soll</span>
              <span className="text-center">Dauer</span>
              <span>Notiz</span>
              <span className="text-center">Ist / Δ</span>
              <span className="text-right">Aktionen</span>
            </div>
```

(d) In der Row-Schleife (Zeile 234-243) `deltaMs` durchreichen:

```tsx
                  <TimetableRow
                    key={item.id}
                    item={item}
                    index={idx}
                    total={tt.items.length}
                    status={status}
                    projectedStartMs={schedule[idx]}
                    deltaMs={drift.perItem[idx]?.deltaMs ?? null}
                  />
```

(e) In der Kopfzeile-Leiste (nach dem `StatusPill`, Zeile 58) die Drift-Pille einsetzen:

```tsx
          <StatusPill status={status}>{statusLabel}</StatusPill>
          {drift.driftMs !== null && (
            <span
              className="text-xs font-extrabold tabular px-2 py-1 rounded-[var(--radius)]"
              style={{
                color: drift.driftMs > 30_000 ? 'var(--destructive)' : drift.driftMs < -30_000 ? 'var(--primary)' : 'var(--muted-foreground)',
                background: 'var(--card)',
              }}
              title="Soll/Ist-Drift der Show"
            >
              {driftPillText(drift.driftMs)}
            </span>
          )}
```

(f) Am Dateiende (nach `formatWallClock`, nach Zeile 284) den Pillen-Text-Helfer ergänzen:

```ts
function driftPillText(ms: number): string {
  const abs = Math.abs(ms);
  if (abs <= 30_000) return 'pünktlich';
  const total = Math.round(abs / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const hms = h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
  return ms > 0 ? `${hms} hinter Plan` : `${hms} vor Plan`;
}
```

- [ ] **Step 4: XlsxImport — Startzeit in Vorschau + Meta**

In `apps/timer/src/renderer/src/components/XlsxImport.tsx`:

(a) In der Spalten-`Meta` (Zeile 148-157) den Start-Eintrag ergänzen — den Array-Block ersetzen:

```tsx
                      [
                        result.source.columns.label && `T:${result.source.columns.label}`,
                        result.source.columns.start && `S:${result.source.columns.start}`,
                        result.source.columns.duration && `D:${result.source.columns.duration}`,
                        result.source.columns.note && `N:${result.source.columns.note}`,
                      ]
```

(b) Vorschau-Grid: das Kopf-Grid (Zeile 177-182) und die Zeilen-Grids (Zeile 187) von 4 auf 5 Spalten bringen und Startzeit anzeigen. Kopf ersetzen:

```tsx
                  <div className="grid grid-cols-[40px_minmax(0,1fr)_80px_110px_minmax(0,1fr)] gap-2 px-3 py-2 bg-[var(--card)]/60 text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)] font-extrabold">
                    <span>#</span>
                    <span>Titel</span>
                    <span className="text-center">Start</span>
                    <span className="text-center">Dauer</span>
                    <span>Notiz</span>
                  </div>
```

Zeilen-`div` (Zeile 185-199) ersetzen:

```tsx
                      <div
                        key={i}
                        className="grid grid-cols-[40px_minmax(0,1fr)_80px_110px_minmax(0,1fr)] gap-2 px-3 py-2 text-sm"
                      >
                        <span className="text-[var(--muted-foreground)] tabular text-xs">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <span className="truncate font-semibold">{row.label}</span>
                        <span className="text-center tabular text-xs">
                          {formatTimeOfDay(row.plannedStartMs) || '—'}
                        </span>
                        <span className="text-center tabular">{formatHMS(row.durationMs)}</span>
                        <span className="truncate text-[var(--muted-foreground)] text-xs">
                          {row.note ?? '—'}
                        </span>
                      </div>
```

(c) Import für `formatTimeOfDay` ergänzen (Zeile 2-3 Bereich):

```ts
import { formatTimeOfDay } from '@jm/regieplan';
```

- [ ] **Step 5: Typecheck:web + Build**

Run: `npm run typecheck:web -w @jm/timer && npm run build -w @jm/timer`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/timer/src/renderer/src/components/TimetableRow.tsx apps/timer/src/renderer/src/components/Timetable.tsx apps/timer/src/renderer/src/components/XlsxImport.tsx
git commit -m "feat(timer): Operator-UI Startzeit-Eingabe + Soll/Ist-Delta + Drift-Pille (#11/Sub-A)"
```

---

### Task 6: Version-Bump 0.8.0 + Changelog

**Files:**
- Modify: `apps/timer/package.json`
- Modify: `packages/suite-manifest/changelog.json`

- [ ] **Step 1: Repo-weiter Typecheck + beide Selftests (Sicherheitsnetz)**

Run: `npm run selftest -w @jm/regieplan && npm run selftest -w @jm/timer && npm run typecheck -w @jm/timer && npm run typecheck -w @jm/rundown`
Expected: alle PASS (Rundown wegen des geteilten Pakets).

- [ ] **Step 2: Version bump**

Run: `npm version 0.8.0 --no-git-tag-version -w @jm/timer`
Expected: `apps/timer/package.json` steht auf `"version": "0.8.0"`.
**Hinweis:** `npm version` kann `package-lock.json` repo-weit re-synchronisieren (fremde Native-Release-Drift). **Nur** `apps/timer/package.json` stagen; `package-lock.json` mit `git restore package-lock.json` zurücksetzen (wie bei caption 0.4.0), sofern der Diff mehr als die Timer-Zeile enthält.

- [ ] **Step 3: Changelog-Eintrag (textuell, quote-frei)**

In `packages/suite-manifest/changelog.json` beim Tool `jm-timer` (bzw. `"app": "timer"`) einen `0.8.0`-Eintrag als NEUESTEN (oben in `entries`) einfügen, Format wie die Nachbar-Einträge, Datum `2026-08-04`, Notes ohne ASCII-Anführungszeichen:

```
Geplante Startzeiten: Programmpunkte koennen eine Soll-Uhrzeit tragen (Spalte Startzeit im XLSX oder im Operator). Leere Punkte ergeben sich aus der Kette; feste Uhrzeiten sind Fixslots.
Soll-Ist-Drift: Der Operator zeigt je Zeile die projizierte Ist-Uhrzeit samt Delta und oben eine Pille Show hinter/vor Plan.
```

- [ ] **Step 4: JSON validieren**

Run: `node -e "JSON.parse(require('fs').readFileSync('packages/suite-manifest/changelog.json','utf8')); console.log('changelog.json ok')"`
Expected: `changelog.json ok`.

- [ ] **Step 5: Commit**

```bash
git add apps/timer/package.json packages/suite-manifest/changelog.json
git commit -m "release(timer): 0.8.0 — geplante Startzeiten + Soll/Ist-Drift (#11/Sub-A)"
```

- [ ] **Step 6: Release-Übergabe (Owner/CI)**

Timer wird von der CI gebaut → nach Merge Tag `timer-v0.8.0` pushen (CI baut mac+win + Katalog-Bump). **Manuell auf dem Windows-Rechner verifizieren:** xlsx mit Startzeit-Spalte importieren → Soll-Zeiten + Drift stimmen; Fixslot-Zeile prüfen. Bei Erfolg **#11 als erledigt kommentieren/schließen** (bereits vor Sub-A umgesetzt; Sub-A ist die Erweiterung).

---

## Self-Review

- **Spec-Abdeckung:** Modell (`plannedStartMs`/`computePlannedSchedule`/`computeDrift`) → Task 3. xlsx-Startzeit-Spalte inkl. „zeit"-Fallstrick → Task 2. UI (Zeilen-Soll/Ist/Delta + Drift-Pille, nur Operator) → Task 5. Konverter → Task 1. Wiring/Vorlage → Task 4. Release → Task 6. Nicht-Ziele (kein Auto-Start, keine Mehrtageslogik) eingehalten. ✔
- **Platzhalter:** keine — jeder Code-Schritt zeigt vollständigen Code.
- **Typkonsistenz:** `plannedStartMs?: number` identisch in `TimetableItem` (Task 3) und `ParsedRow` (Task 2); `computeDrift(tt, cd, now)` + `DriftResult.perItem[i].deltaMs` in Task 3 definiert, in Task 4 re-exportiert, in Task 5 (`deltaMs`-Prop, `drift.perItem[idx]?.deltaMs`) genutzt; `formatTimeOfDay`/`parseTimeOfDay` in Task 1 definiert, in Task 2/5 genutzt; `REGIEPLAN_HEADER` (4 Spalten) in Task 2 gesetzt, Task 4 (`downloadTemplate`) + Task 6 richten sich danach. ✔
- **Geteiltes Paket:** Rundown-Grün als expliziter Schritt (Task 2 Step 7, Task 6 Step 1). ✔
