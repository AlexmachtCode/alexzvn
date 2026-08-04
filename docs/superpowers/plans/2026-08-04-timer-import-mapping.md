# JM Timer — Import-Spalten-Mapping (Sub-C1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fremde Kunden-XLSX importieren, auch wenn die Auto-Erkennung Spalten nicht/falsch trifft — über eine vorbelegte Spalten-Zuordnung (4 Dropdowns) mit Live-Vorschau im Timer-Import-Dialog.

**Architecture:** `@jm/regieplan` wird auftrennt in `inspectRegieplan` (liest das Workbook einmal, liefert `availableColumns` + `rawRows` + Auto-`columns`) und die reine `extractRowsFromMapping` (baut Zeilen aus einem gegebenen Mapping, kein XLSX/DOM). `parseRegieplan` wird zum Wrapper über beide Bausteine — Verhalten und Signatur unverändert, Rundown bleibt grün. Der Timer-Dialog nutzt `inspectXlsx` + eine reaktive `extractRows`-Vorschau.

**Tech Stack:** TypeScript, React/Zustand-Renderer, `xlsx` (SheetJS, lazy), `node --experimental-strip-types` als Test-Harness.

## Global Constraints

- **Ziel-Release:** `timer-v0.9.0` (Minor; CI-gebaut, kein nativer Build). package.json heute `0.8.0`.
- **`@jm/regieplan` ist GETEILT mit JM Rundown** → jede Änderung additiv/rückwärtskompatibel; **Rundown-Build muss grün bleiben**. `parseRegieplan` behält Signatur **und** Verhalten (Rundown importiert es direkt).
- **Reine Bausteine sind node-/DOM-frei** (`extractRowsFromMapping`, `buildAvailableColumns`) → laufen unter `node --experimental-strip-types`; nur `readWorkbook`/`inspectRegieplan`/`parseRegieplan` importieren `xlsx` lazy.
- **`ColumnMapping` = `{ label; start; duration; note }`**, je Feld ein Spalten-Key (`'A'`,`'B'`,…) oder `null` — dieselbe Form wie die heutige Auto-Erkennung.
- **`headerRow === -1`** heißt positional (kein Header) → Extraktion ab Zeile 0, `AvailableColumn.header === ''`.
- **Dauer bleibt Pflicht** im Timer (`requireDuration: true`); ist Titel **oder** Dauer nicht zugeordnet, ist „Importieren" gesperrt.
- **Export bleibt kanonisch** (4-Spalten `REGIEPLAN_HEADER`) — C1 ist rein Import. Keine Kopfzeilen-Wahl, kein Mapping-Merken, keine neuen Datenspalten (das ist C2).
- **CRLF:** EOL-bewusst editieren; `changelog.json` keine ASCII-Anführungszeichen, JSON validieren. `package-lock.json` nach `npm version` bei Fremd-Drift mit `git restore` zurücksetzen.

---

## File Structure

- `packages/regieplan/src/index.ts` — **Modify:** neue Exports `ColumnMapping`/`AvailableColumn`/`InspectResult`/`inspectRegieplan`/`extractRowsFromMapping`; interne Helfer `readWorkbook`/`buildAvailableColumns`; `parseRegieplan` als Wrapper; `DetectedColumns` → `ColumnMapping`.
- `packages/regieplan/test/selftest.ts` — **Modify:** Tests für `extractRowsFromMapping` + `inspectRegieplan`.
- `apps/timer/src/renderer/src/lib/xlsx.ts` — **Modify:** `inspectXlsx` + `extractRows` + Typ-Re-Exports; `parseXlsx` entfällt (in Task 3).
- `apps/timer/src/renderer/src/components/XlsxImport.tsx` — **Modify (Vollersatz):** `inspection` + `mapping`-State, 4 Mapping-Dropdowns, Live-Vorschau.
- `apps/timer/package.json` — **Modify:** Version 0.9.0.
- `packages/suite-manifest/changelog.json` — **Modify:** Eintrag 0.9.0.

---

### Task 1: `@jm/regieplan` — inspect/extract-Auftrennung (pur + inspect)

**Files:**
- Modify: `packages/regieplan/src/index.ts`
- Test: `packages/regieplan/test/selftest.ts`

**Interfaces:**
- Consumes: `parseDuration`, `parseTimeOfDay`, `detectHeader` (bestehend).
- Produces:
  - `interface ColumnMapping { label: string|null; start: string|null; duration: string|null; note: string|null }`
  - `interface AvailableColumn { key: string; header: string; sample: string }`
  - `interface InspectResult { sheetName: string; headerRow: number; columns: ColumnMapping; availableColumns: AvailableColumn[]; rawRows: Array<Record<string, unknown>> }`
  - `inspectRegieplan(data: ArrayBuffer|Uint8Array, opts?: ParseOptions): Promise<InspectResult>`
  - `extractRowsFromMapping(rawRows, headerRow: number, mapping: ColumnMapping, opts?: ParseOptions): { rows: ParsedRow[]; skippedRows: number }`

- [ ] **Step 1: Failing tests ergänzen**

In `packages/regieplan/test/selftest.ts` die Import-Zeile (Zeile 3) erweitern:

```ts
import { parseDuration, formatHms, rowsToAoa, parseRegieplan, parseTimeOfDay, formatTimeOfDay, REGIEPLAN_HEADER, extractRowsFromMapping, inspectRegieplan } from '../src/index.ts';
```

Ans Ende (vor `console.log(\`\n${pass}...`)) einfügen:

```ts
// extractRowsFromMapping (rein, ohne XLSX)
const rawMap = [
  { A: 'Programmpunkt', B: 'Dauer', C: 'Notiz' },
  { A: 'Keynote', B: '00:30:00', C: 'Bühne' },
  { A: 'Talk', B: '', C: '' },
];
const ex = extractRowsFromMapping(rawMap, 0, { label: 'A', start: null, duration: 'B', note: 'C' }, { requireDuration: true });
ck('extract: Talk ohne Dauer verworfen', ex.rows.length === 1 && ex.skippedRows === 1);
ck('extract: Keynote Dauer+Notiz', ex.rows[0].durationMs === 1_800_000 && ex.rows[0].note === 'Bühne');
// Remap: Start B, Dauer C, positional ab Zeile 0
const rawPos = [{ A: 'Begrüßung', B: '09:00', C: '00:05:00' }];
const exPos = extractRowsFromMapping(rawPos, -1, { label: 'A', start: 'B', duration: 'C', note: null }, { requireDuration: true });
ck('extract positional (headerRow -1)', exPos.rows.length === 1 && exPos.rows[0].plannedStartMs === (9 * 60) * 60_000 && exPos.rows[0].durationMs === 300_000);

// inspectRegieplan (über ein echtes Workbook)
function buildBufAoa(aoa: unknown[][]): ArrayBuffer {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Regieplan');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}
const insBuf = buildBufAoa([
  ['Programmpunkt', 'Startzeit', 'Dauer', 'Notiz'],
  ['Keynote', '09:00', '00:30:00', 'Bühne'],
]);
const ins = await inspectRegieplan(insBuf, { requireDuration: true });
ck('inspect: headerRow 0', ins.headerRow === 0);
ck('inspect: Auto-columns (label A, start B, duration C)', ins.columns.label === 'A' && ins.columns.start === 'B' && ins.columns.duration === 'C');
ck('inspect: 4 availableColumns', ins.availableColumns.length === 4);
ck('inspect: Dauer-Spalte Header+Sample', (() => { const c = ins.availableColumns.find((x) => x.key === 'C'); return c?.header === 'Dauer' && c?.sample === '00:30:00'; })());
ck('inspect: rawRows durchgereicht', ins.rawRows.length === 2);
const posBuf = buildBufAoa([['Meeting', '00:10:00'], ['Talk', '00:20:00']]);
const insPos = await inspectRegieplan(posBuf, { requireDuration: true });
ck('inspect positional: headerRow -1', insPos.headerRow === -1);
ck('inspect positional: Header leer, Sample gesetzt', insPos.availableColumns[0].header === '' && insPos.availableColumns[0].sample === 'Meeting');
```

- [ ] **Step 2: Run to verify fail**

Run: `npm run selftest -w @jm/regieplan`
Expected: FAIL — `extractRowsFromMapping`/`inspectRegieplan` sind kein Export (Import-Fehler).

- [ ] **Step 3: Typen + interne Helfer einführen**

In `packages/regieplan/src/index.ts`:

(a) Nach `ParseResult` (nach Zeile 33) die neuen Interfaces einfügen:

```ts
/** Feld → Tabellenspalten-Key ('A','B',…) oder null. Gleiche Form wie die Auto-Erkennung. */
export interface ColumnMapping {
  label: string | null;
  start: string | null;
  duration: string | null;
  note: string | null;
}

/** Eine wählbare Tabellenspalte für die Mapping-UI. */
export interface AvailableColumn {
  key: string;    // Spalten-Key wie von sheet_to_json(header:'A') — 'A','B',…
  header: string; // Zelltext der Header-Zeile ('' bei positional/leer)
  sample: string; // erster nicht-leerer Datenwert darunter (getrimmt, ≤40 Zeichen)
}

export interface InspectResult {
  sheetName: string;
  headerRow: number;                        // 0-basiert; -1 = positional
  columns: ColumnMapping;                   // Auto-Erkennung → Vorbelegung
  availableColumns: AvailableColumn[];
  rawRows: Array<Record<string, unknown>>;  // bleiben im Renderer; kein IPC
}
```

(b) `ParseResult.source.columns` (Zeile 29) auf `ColumnMapping` umstellen (gleiche Form, DRY):

```ts
    columns: ColumnMapping;
```

(c) Die private `interface DetectedColumns { … }` (Zeile 53-58) **löschen** und in `matchHeader` (Rückgabetyp + `const out`) sowie `detectHeader` (`columns: DetectedColumns`) jeweils `DetectedColumns` durch `ColumnMapping` ersetzen. Ergebnis:

```ts
function matchHeader(row: Record<string, unknown>): ColumnMapping {
  const out: ColumnMapping = { label: null, start: null, duration: null, note: null };
  for (const [col, val] of Object.entries(row)) {
    const v = String(val ?? '')
      .toLowerCase()
      .trim();
    if (!v) continue;
    if (out.label === null && LABEL_KEYWORDS.test(v)) out.label = col;
    // Start VOR Dauer: "Startzeit" enthält "zeit" und würde sonst als Dauer erkannt.
    if (out.start === null && START_KEYWORDS.test(v)) out.start = col;
    if (out.duration === null && col !== out.start && DURATION_KEYWORDS.test(v)) out.duration = col;
    if (out.note === null && NOTE_KEYWORDS.test(v)) out.note = col;
  }
  return out;
}

function detectHeader(
  rows: Array<Record<string, unknown>>,
  requireDuration: boolean,
): { headerIdx: number; columns: ColumnMapping } {
  const scanLimit = Math.min(5, rows.length);
  for (let i = 0; i < scanLimit; i++) {
    const cols = matchHeader(rows[i]);
    const ok = requireDuration ? cols.label !== null && cols.duration !== null : cols.label !== null;
    if (ok) return { headerIdx: i, columns: cols };
  }
  // Fallback — Spalte A = Titel, B = Dauer, C = Notiz (positionsbasiert).
  return { headerIdx: -1, columns: { label: 'A', start: null, duration: 'B', note: 'C' } };
}
```

- [ ] **Step 4: `readWorkbook` + `extractRowsFromMapping` + `buildAvailableColumns` + `inspectRegieplan` + `parseRegieplan`-Umbau**

Die bestehende `parseRegieplan` (Zeile 168-218) **komplett ersetzen** durch:

```ts
/** XLSX/XLS/CSV lesen → Blattname + Rohzeilen (Spalten-Keys 'A','B',…). Lazy SheetJS. */
async function readWorkbook(
  data: ArrayBuffer | Uint8Array,
): Promise<{ sheetName: string; rawRows: Array<Record<string, unknown>> }> {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(data, { type: 'array', cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error('Datei enthält kein Tabellenblatt.');
  const ws = wb.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    header: 'A',
    raw: true,
    defval: '',
  });
  return { sheetName, rawRows };
}

/** Excel-Spalten-Keys ordnen: 'A'<'B'<…<'Z'<'AA' (erst Länge, dann lexikalisch). */
function compareColumnKeys(a: string, b: string): number {
  return a.length - b.length || (a < b ? -1 : a > b ? 1 : 0);
}

/** Wählbare Spalten für die Mapping-UI: Vereinigung aller Keys + Header + erster Sample-Wert. */
function buildAvailableColumns(
  rawRows: Array<Record<string, unknown>>,
  headerIdx: number,
): AvailableColumn[] {
  const keys = new Set<string>();
  for (const row of rawRows) for (const k of Object.keys(row)) keys.add(k);
  const dataStart = headerIdx + 1;
  return [...keys].sort(compareColumnKeys).map((key) => {
    const header = headerIdx >= 0 ? String(rawRows[headerIdx]?.[key] ?? '').trim() : '';
    let sample = '';
    for (let i = dataStart; i < rawRows.length; i++) {
      const v = String(rawRows[i]?.[key] ?? '').trim();
      if (v) {
        sample = v.length > 40 ? `${v.slice(0, 40)}…` : v;
        break;
      }
    }
    return { key, header, sample };
  });
}

/**
 * REIN (kein XLSX, kein DOM): baut Ablauf-Zeilen aus einem gegebenen Spalten-Mapping.
 * Wird bei jeder Mapping-Änderung neu gerufen (billig). requireDuration verwirft
 * Zeilen ohne Titel bzw. ohne parsebare Dauer.
 */
export function extractRowsFromMapping(
  rawRows: Array<Record<string, unknown>>,
  headerRow: number,
  mapping: ColumnMapping,
  opts: ParseOptions = {},
): { rows: ParsedRow[]; skippedRows: number } {
  const requireDuration = opts.requireDuration ?? false;
  const rows: ParsedRow[] = [];
  let skippedRows = 0;
  for (let i = headerRow + 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    const label = mapping.label !== null ? String(row[mapping.label] ?? '').trim() : '';
    const startRaw = mapping.start !== null ? row[mapping.start] : undefined;
    const durationRaw = mapping.duration !== null ? row[mapping.duration] : undefined;
    const note = mapping.note !== null ? String(row[mapping.note] ?? '').trim() : '';
    const durationMs = parseDuration(durationRaw);
    const plannedStartMs = parseTimeOfDay(startRaw);
    if (!label || (requireDuration && durationMs <= 0)) {
      skippedRows += 1;
      continue;
    }
    rows.push({ label, durationMs, note: note || undefined, plannedStartMs: plannedStartMs ?? undefined });
  }
  return { rows, skippedRows };
}

/** Workbook EINMAL lesen und alles fürs manuelle Mapping liefern (UI-Einstieg). */
export async function inspectRegieplan(
  data: ArrayBuffer | Uint8Array,
  opts: ParseOptions = {},
): Promise<InspectResult> {
  const requireDuration = opts.requireDuration ?? false;
  const { sheetName, rawRows } = await readWorkbook(data);
  const { headerIdx, columns } = detectHeader(rawRows, requireDuration);
  return {
    sheetName,
    headerRow: headerIdx,
    columns,
    availableColumns: buildAvailableColumns(rawRows, headerIdx),
    rawRows,
  };
}

/**
 * Eine XLSX/XLS/CSV-Datei in Regieplan-Zeilen parsen (Auto-Erkennung). `requireDuration`
 * steuert, ob eine Dauer nötig ist (Timer) oder optional (Rundown). Wrapper über
 * readWorkbook + detectHeader + extractRowsFromMapping.
 */
export async function parseRegieplan(
  data: ArrayBuffer | Uint8Array,
  opts: ParseOptions = {},
): Promise<ParseResult> {
  const { sheetName, rawRows } = await readWorkbook(data);
  const { headerIdx, columns } = detectHeader(rawRows, opts.requireDuration ?? false);
  const { rows, skippedRows } = extractRowsFromMapping(rawRows, headerIdx, columns, opts);
  return {
    rows,
    source: {
      sheetName,
      headerRow: headerIdx,
      columns,
      totalRows: rawRows.length - (headerIdx + 1),
      skippedRows,
    },
  };
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npm run selftest -w @jm/regieplan`
Expected: PASS — alle bisherigen + die 10 neuen Prüfungen (`… passed, 0 failed`).

- [ ] **Step 6: Rundown bleibt grün (geteiltes Paket)**

Run: `npm run typecheck -w @jm/rundown && npm run build -w @jm/rundown`
Expected: PASS (parseRegieplan-Signatur/Verhalten unverändert; `source.columns` ist strukturgleich).

- [ ] **Step 7: Commit**

```bash
git add packages/regieplan/src/index.ts packages/regieplan/test/selftest.ts
git commit -m "feat(regieplan): inspect/extract-Auftrennung fuer manuelles Spalten-Mapping (#11/Sub-C1)"
```

---

### Task 2: Timer `lib/xlsx.ts` — `inspectXlsx` + `extractRows`

**Files:**
- Modify: `apps/timer/src/renderer/src/lib/xlsx.ts`

**Interfaces:**
- Consumes: `inspectRegieplan`, `extractRowsFromMapping`, `ColumnMapping`, `InspectResult`, `AvailableColumn` (Task 1).
- Produces: `inspectXlsx(buffer): Promise<InspectResult>`; `extractRows(rawRows, headerRow, mapping): { rows: ParsedRow[]; skippedRows: number }`; Re-Exports der Typen. (`parseXlsx` bleibt in dieser Task noch bestehen — entfällt erst in Task 3, damit der Build zwischendurch grün bleibt.)

- [ ] **Step 1: Imports + Wrapper ergänzen**

In `apps/timer/src/renderer/src/lib/xlsx.ts` die Import-Zeile (Zeile 5) ersetzen und den Typ-Import ergänzen:

```ts
import { parseRegieplan, inspectRegieplan, extractRowsFromMapping, rowsToAoa, exportRegieplanXlsx, REGIEPLAN_HEADER } from '@jm/regieplan';
import type { ColumnMapping } from '@jm/regieplan';
```

Die Zeile `export type { ParsedRow, ParseResult } from '@jm/regieplan';` (Zeile 7) ersetzen durch:

```ts
export type { ParsedRow, ParseResult, InspectResult, ColumnMapping, AvailableColumn } from '@jm/regieplan';
```

Direkt nach `parseXlsx` (nach Zeile 12) einfügen:

```ts
/** Datei inspizieren (Timer: Dauer für die Auto-Vorbelegung bevorzugt). */
export function inspectXlsx(buffer: ArrayBuffer) {
  return inspectRegieplan(buffer, { requireDuration: true });
}

/** Zeilen aus einem (evtl. manuell korrigierten) Mapping bauen — Timer: Dauer Pflicht. */
export function extractRows(
  rawRows: Array<Record<string, unknown>>,
  headerRow: number,
  mapping: ColumnMapping,
) {
  return extractRowsFromMapping(rawRows, headerRow, mapping, { requireDuration: true });
}
```

- [ ] **Step 2: Typecheck + Build**

Run: `npm run typecheck:web -w @jm/timer && npm run build -w @jm/timer`
Expected: PASS (parseXlsx noch vorhanden → XlsxImport unverändert baubar).

- [ ] **Step 3: Commit**

```bash
git add apps/timer/src/renderer/src/lib/xlsx.ts
git commit -m "feat(timer): inspectXlsx + extractRows Wrapper (#11/Sub-C1)"
```

---

### Task 3: `XlsxImport.tsx` — Mapping-Dropdowns + Live-Vorschau (Vollersatz) + `parseXlsx` entfernen

**Files:**
- Modify (Vollersatz): `apps/timer/src/renderer/src/components/XlsxImport.tsx`
- Modify: `apps/timer/src/renderer/src/lib/xlsx.ts` (`parseXlsx` löschen)

**Interfaces:**
- Consumes: `inspectXlsx`, `extractRows`, `InspectResult`, `ColumnMapping` (Task 2), `formatTimeOfDay` (`@jm/regieplan`), `formatHMS` (`@/lib/time`), `ttSetAll`/`ttAdd` (Store).

- [ ] **Step 1: `XlsxImport.tsx` komplett ersetzen**

Den **gesamten** Inhalt von `apps/timer/src/renderer/src/components/XlsxImport.tsx` ersetzen durch:

```tsx
import { useMemo, useRef, useState } from 'react';
import {
  inspectXlsx,
  extractRows,
  downloadTemplate,
  exportTimetable,
  type InspectResult,
  type ColumnMapping,
} from '@/lib/xlsx';
import { formatTimeOfDay } from '@jm/regieplan';
import { formatHMS } from '@/lib/time';
import { useStore } from '@/store/timer';
import { Button } from '@jm/ui';
import { Card } from '@jm/ui';
import { SectionHeader } from './ui/SectionHeader';
import { cn } from '@jm/ui';

interface Props {
  open: boolean;
  onClose: () => void;
}

const EMPTY_MAPPING: ColumnMapping = { label: null, start: null, duration: null, note: null };

export function XlsxImport({ open, onClose }: Props) {
  const ttSetAll = useStore((s) => s.ttSetAll);
  const ttAdd = useStore((s) => s.ttAdd);
  const items = useStore((s) => s.timetable.items);
  const [inspection, setInspection] = useState<InspectResult | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>(EMPTY_MAPPING);
  const [filename, setFilename] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'replace' | 'append'>('replace');
  const inputRef = useRef<HTMLInputElement | null>(null);

  const extracted = useMemo(
    () =>
      inspection
        ? extractRows(inspection.rawRows, inspection.headerRow, mapping)
        : { rows: [], skippedRows: 0 },
    [inspection, mapping],
  );

  if (!open) return null;

  async function handleFile(file: File) {
    setError(null);
    setFilename(file.name);
    try {
      const buf = await file.arrayBuffer();
      const r = await inspectXlsx(buf);
      if (r.availableColumns.length === 0) {
        setError('Die Datei enthält keine lesbaren Spalten.');
        setInspection(null);
        return;
      }
      setInspection(r);
      setMapping(r.columns);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Datei konnte nicht gelesen werden.');
      setInspection(null);
    }
  }

  function setField(field: keyof ColumnMapping, key: string) {
    setMapping((m) => ({ ...m, [field]: key === '' ? null : key }));
  }

  const canImport = !!mapping.label && !!mapping.duration && extracted.rows.length > 0;

  function confirmImport() {
    if (!canImport) return;
    if (mode === 'replace') {
      ttSetAll(extracted.rows);
    } else {
      for (const row of extracted.rows) ttAdd(row);
    }
    handleClose();
  }

  function handleClose() {
    setInspection(null);
    setMapping(EMPTY_MAPPING);
    setFilename(null);
    setError(null);
    setMode('replace');
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[820px] max-h-[85vh] overflow-hidden">
        <Card>
          <div className="p-6 flex flex-col gap-5 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <SectionHeader>XLSX · Regieplan importieren</SectionHeader>
              <button
                type="button"
                onClick={handleClose}
                className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-sm"
                aria-label="Schließen"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-[var(--muted-foreground)]">
              Die App erkennt Spalten für <b>Titel</b>, <b>Startzeit</b>, <b>Dauer</b> und <b>Notiz</b>{' '}
              automatisch. Passt die Zuordnung nicht, korrigiere sie unten — die Vorschau aktualisiert sich sofort.
            </p>

            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.xlsm,.csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = '';
              }}
            />

            <div className="flex items-center gap-3">
              <Button onClick={() => inputRef.current?.click()}>Datei auswählen</Button>
              <Button variant="outline" onClick={() => void downloadTemplate()}>
                Vorlage herunterladen
              </Button>
              <Button
                variant="outline"
                onClick={() => void exportTimetable(items)}
                disabled={items.length === 0}
                title="Aktuellen Ablauf als Regieplan (Excel) exportieren — z. B. für JM Rundown"
              >
                Ablauf exportieren
              </Button>
              {filename && <span className="text-sm text-[var(--muted-foreground)] truncate">{filename}</span>}
            </div>
            <p className="-mt-2 text-xs text-[var(--muted-foreground)]">
              Noch keine Datei? Lade die Vorlage herunter, fülle sie aus und importiere sie wieder.
            </p>

            {error && <div className="text-sm text-[var(--destructive)]">{error}</div>}

            {inspection && (
              <>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <Meta label="Tabellenblatt" value={inspection.sheetName} />
                  <Meta
                    label="Kopfzeile"
                    value={
                      inspection.headerRow >= 0
                        ? `Zeile ${inspection.headerRow + 1}`
                        : 'Ohne Kopfzeile (positional)'
                    }
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)] font-extrabold">
                    Spalten-Zuordnung
                  </span>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <MapSelect label="Titel" required field="label" value={mapping.label} columns={inspection.availableColumns} onChange={setField} />
                    <MapSelect label="Startzeit" field="start" value={mapping.start} columns={inspection.availableColumns} onChange={setField} />
                    <MapSelect label="Dauer" required field="duration" value={mapping.duration} columns={inspection.availableColumns} onChange={setField} />
                    <MapSelect label="Notiz" field="note" value={mapping.note} columns={inspection.availableColumns} onChange={setField} />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 text-xs">
                  <Meta label="Items erkannt" value={`${extracted.rows.length}`} accent />
                  <Meta label="Übersprungen" value={`${extracted.skippedRows}`} />
                  <Meta label="Gesamt-Dauer" value={formatHMS(extracted.rows.reduce((s, r) => s + r.durationMs, 0))} />
                </div>

                <div className="rounded-[var(--radius-md)] border border-[var(--border)]/40 overflow-hidden">
                  <div className="grid grid-cols-[40px_minmax(0,1fr)_80px_110px_minmax(0,1fr)] gap-2 px-3 py-2 bg-[var(--card)]/60 text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)] font-extrabold">
                    <span>#</span>
                    <span>Titel</span>
                    <span className="text-center">Start</span>
                    <span className="text-center">Dauer</span>
                    <span>Notiz</span>
                  </div>
                  <div className="divide-y divide-[var(--border)]/40 max-h-[260px] overflow-y-auto">
                    {extracted.rows.slice(0, 50).map((row, i) => (
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
                        <span className="truncate text-[var(--muted-foreground)] text-xs">{row.note ?? '—'}</span>
                      </div>
                    ))}
                    {extracted.rows.length === 0 && (
                      <div className="px-3 py-6 text-center text-xs text-[var(--muted-foreground)]">
                        Keine Zeilen — prüfe die Spalten-Zuordnung (Titel und Dauer nötig).
                      </div>
                    )}
                    {extracted.rows.length > 50 && (
                      <div className="px-3 py-2 text-center text-xs text-[var(--muted-foreground)]">
                        … +{extracted.rows.length - 50} weitere
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-2">
                  <div className="flex rounded-[var(--radius)] overflow-hidden border border-[var(--border)]">
                    <ToggleBtn active={mode === 'replace'} onClick={() => setMode('replace')}>
                      Ersetzen
                    </ToggleBtn>
                    <ToggleBtn active={mode === 'append'} onClick={() => setMode('append')}>
                      Anhängen
                    </ToggleBtn>
                  </div>
                  <div className="flex items-center gap-2">
                    {!canImport && (
                      <span className="text-xs text-[var(--muted-foreground)]">
                        Ordne Titel und Dauer einer Spalte zu.
                      </span>
                    )}
                    <Button variant="outline" onClick={handleClose}>
                      Abbrechen
                    </Button>
                    <Button variant="primary" onClick={confirmImport} disabled={!canImport}>
                      Importieren
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function MapSelect({
  label,
  field,
  value,
  columns,
  onChange,
  required,
}: {
  label: string;
  field: keyof ColumnMapping;
  value: string | null;
  columns: Array<{ key: string; header: string; sample: string }>;
  onChange: (field: keyof ColumnMapping, key: string) => void;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 min-w-0">
      <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)] font-extrabold">
        {label}
        {required && <span className="text-[var(--destructive)]"> *</span>}
      </span>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(field, e.target.value)}
        className={cn(
          'h-10 px-2 rounded-[var(--radius)] bg-[var(--background)]/40 border text-sm truncate',
          required && !value ? 'border-[var(--destructive)]/60' : 'border-[var(--border)]',
        )}
      >
        <option value="">— (keine)</option>
        {columns.map((c) => (
          <option key={c.key} value={c.key}>
            {(c.header || `Spalte ${c.key}`) + (c.sample ? ` · Bsp: ${c.sample}` : '')}
          </option>
        ))}
      </select>
    </label>
  );
}

function Meta({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-1 p-3 rounded-[var(--radius)] bg-[var(--background)]/40 border border-[var(--border)]/40">
      <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">{label}</span>
      <span className={cn('text-sm font-extrabold tabular', accent && 'text-[var(--primary)]')}>{value}</span>
    </div>
  );
}

function ToggleBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-10 px-4 text-xs uppercase tracking-wide font-extrabold transition-colors',
        active
          ? 'bg-[var(--accent)] text-[var(--foreground)]'
          : 'bg-transparent text-[var(--muted-foreground)] hover:bg-[var(--highlight)]',
      )}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 2: `parseXlsx` aus `lib/xlsx.ts` entfernen**

In `apps/timer/src/renderer/src/lib/xlsx.ts` die (jetzt ungenutzte) `parseXlsx`-Funktion **löschen**:

```ts
/** XLSX/XLS/CSV in Timetable-Items parsen — Timer: Dauer-Spalte erforderlich. */
export function parseXlsx(buffer: ArrayBuffer) {
  return parseRegieplan(buffer, { requireDuration: true });
}
```

und den nun ungenutzten `parseRegieplan`-Import aus Zeile 5 streichen (die Import-Zeile lautet danach):

```ts
import { inspectRegieplan, extractRowsFromMapping, rowsToAoa, exportRegieplanXlsx, REGIEPLAN_HEADER } from '@jm/regieplan';
```

- [ ] **Step 3: Typecheck:web + Build**

Run: `npm run typecheck:web -w @jm/timer && npm run build -w @jm/timer`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/timer/src/renderer/src/components/XlsxImport.tsx apps/timer/src/renderer/src/lib/xlsx.ts
git commit -m "feat(timer): Import-Dialog mit Spalten-Mapping + Live-Vorschau (#11/Sub-C1)"
```

---

### Task 4: Version-Bump 0.9.0 + Changelog

**Files:**
- Modify: `apps/timer/package.json`
- Modify: `packages/suite-manifest/changelog.json`

- [ ] **Step 1: Sicherheitsnetz (Selftests + Typechecks)**

Run: `npm run selftest -w @jm/regieplan && npm run typecheck -w @jm/timer && npm run typecheck -w @jm/rundown`
Expected: alle PASS (Rundown wegen des geteilten Pakets).

- [ ] **Step 2: Version bump**

Run: `npm version 0.9.0 --no-git-tag-version -w @jm/timer`
Expected: `apps/timer/package.json` steht auf `"version": "0.9.0"`.
**Hinweis:** `npm version` kann `package-lock.json` repo-weit re-synchronisieren (fremde Native-Release-Drift). **Nur** `apps/timer/package.json` stagen; `package-lock.json` mit `git restore package-lock.json` zurücksetzen, sofern der Diff mehr als die Timer-Zeile enthält.

- [ ] **Step 3: Changelog-Eintrag (textuell, quote-frei)**

In `packages/suite-manifest/changelog.json` beim Tool `timer` einen `0.9.0`-Eintrag als NEUESTEN (oben in `entries`) einfügen, Datum `2026-08-04`, Notes ohne ASCII-Anführungszeichen:

```
Import-Zuordnung: Beim XLSX-Import ordnest du Titel, Startzeit, Dauer und Notiz jetzt selbst einer Tabellenspalte zu, falls die automatische Erkennung danebenliegt. Die Vorschau aktualisiert sich sofort.
Auch Dateien ohne saubere Kopfzeile lassen sich so importieren.
```

- [ ] **Step 4: JSON validieren**

Run: `node -e "JSON.parse(require('fs').readFileSync('packages/suite-manifest/changelog.json','utf8')); console.log('changelog.json ok')"`
Expected: `changelog.json ok`.

- [ ] **Step 5: Commit**

```bash
git add apps/timer/package.json packages/suite-manifest/changelog.json
git commit -m "release(timer): 0.9.0 — Import-Spalten-Mapping (#11/Sub-C1)"
```

- [ ] **Step 6: Release-Übergabe (CI)**

Timer wird von der CI gebaut → nach Merge Tag `timer-v0.9.0` pushen (CI baut mac+win + Katalog-Bump). **Manuell (Owner/Windows-GUI):** fremde XLSX mit unpassenden/fehlenden Headern importieren → Zuordnung per Dropdown korrigieren → Vorschau/Import stimmen; Datei ohne Kopfzeile (positional) testen.

---

## Self-Review

- **Spec-Abdeckung:** inspect/extract-Auftrennung + `parseRegieplan`-Wrapper → Task 1. `availableColumns` (Header+Sample, positional) → Task 1 (`buildAvailableColumns`). Timer-Wrapper `inspectXlsx`/`extractRows` → Task 2. Mapping-Dropdowns + Live-Vorschau + Dauer-Pflicht-Gate + `parseXlsx` entfällt → Task 3. Release → Task 4. Nicht-Ziele (keine Kopfzeilen-Wahl, kein Merken, keine neuen Spalten, Export kanonisch) eingehalten. ✔
- **Platzhalter:** keine — jeder Code-Schritt zeigt vollständigen Code.
- **Typkonsistenz:** `ColumnMapping`/`AvailableColumn`/`InspectResult` in Task 1 definiert, in Task 2 (Wrapper-Signaturen) + Task 3 (`InspectResult`/`ColumnMapping`-State, `MapSelect`-`columns`-Typ = `AvailableColumn`-Form) genutzt; `extractRowsFromMapping(rawRows, headerRow, mapping, opts) → {rows, skippedRows}` in Task 1 definiert, in Task 2 (`extractRows`) gewrappt, in Task 3 (`extracted.rows`/`extracted.skippedRows`) konsumiert; `inspectRegieplan`/`inspectXlsx → InspectResult` mit `availableColumns`/`rawRows`/`headerRow`/`columns` durchgängig. ✔
- **Geteiltes Paket:** Rundown-Grün als expliziter Schritt (Task 1 Step 6, Task 4 Step 1); `parseRegieplan` Signatur+Verhalten unverändert. ✔
- **Build-Grün-Zwischenschritte:** Task 2 lässt `parseXlsx` stehen (Build grün), Task 3 entfernt es zusammen mit dem neuen Dialog (Build grün). ✔
