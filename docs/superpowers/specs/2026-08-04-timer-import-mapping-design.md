# JM Timer — Import-Spalten-Mapping (Sub-C1) — Design

> Sub-Projekt **C1** der Timer-Import/Export-Erweiterung (Roadmap Lane A), nach
> Sub-A (geplante Startzeiten, gemergt als `timer-v0.8.0`). Folge-Slice: **C2**
> weitere Datenspalten (Verantwortlich/Kategorie …). Dieses Design betrifft **nur C1**.

**Stand:** 2026-08-04 · Branch `feat/timer-import-mapping` (von `main`, enthält Sub-A)

## Ziel

Fremde Kunden-XLSX importieren, auch wenn die Auto-Erkennung Spalten **nicht** oder
**falsch** trifft. Der Import-Dialog zeigt nach dem Datei-Wählen immer eine
**vorbelegte Spalten-Zuordnung** (Titel/Startzeit/Dauer/Notiz → Tabellenspalte); der
Operator korrigiert per Dropdown, die Vorschau aktualisiert sich live. Trifft die
Erkennung alles, ändert er nichts.

## Nicht-Ziele (YAGNI)

- **Keine Kopfzeilen-Wahl** — die Header-Zeile bleibt, was die Erkennung fand (bzw.
  positional). Header-Zeile-Wählen ist als Sub-B/C2-Nachschlag **vorgemerkt**, nicht Teil von C1.
- **Kein Mapping-Merken** pro Kundenvorlage.
- **Keine neuen Datenspalten** (Verantwortlich/Kategorie … = C2).
- **Export bleibt kanonisch** (4-Spalten `REGIEPLAN_HEADER`) — C1 ist rein Import.
- **Rundown unberührt** — `parseRegieplan` behält Signatur und Verhalten.

## Architektur (`@jm/regieplan`, geteilt — additiv, rückwärtskompatibel)

Heute macht `parseRegieplan` **Workbook-Lesen + Header-Erkennung + Zeilen-Extraktion**
in einem Rutsch. Für Live-Mapping wird das entkoppelt, damit ein Re-Mapping **kein
erneutes `XLSX.read`** braucht (der teure Teil).

Neue Typen:

```ts
/** Spalten-Zuordnung: Feld → Tabellenspalten-Key ('A','B',…) oder null. Gleiche Form wie die Auto-Erkennung. */
export interface ColumnMapping {
  label: string | null;
  start: string | null;
  duration: string | null;
  note: string | null;
}

/** Eine wählbare Tabellenspalte für die Mapping-UI. */
export interface AvailableColumn {
  key: string;      // Spalten-Key wie von sheet_to_json(header:'A') — 'A','B',…
  header: string;   // Zelltext der Header-Zeile ('' bei positional/leer)
  sample: string;   // erster nicht-leerer Datenwert darunter (getrimmt, ≤40 Zeichen), '' wenn keiner
}

export interface InspectResult {
  sheetName: string;
  headerRow: number;                        // 0-basiert; -1 = positional (kein Header erkannt)
  columns: ColumnMapping;                   // Auto-Erkennung → Vorbelegung der Dropdowns
  availableColumns: AvailableColumn[];       // nach Key sortiert
  rawRows: Array<Record<string, unknown>>;   // Rohzeilen (bleiben im Renderer; kein IPC)
}
```

Neue Funktionen:

```ts
/** Liest das Workbook EINMAL und liefert alles fürs manuelle Mapping. */
export async function inspectRegieplan(
  data: ArrayBuffer | Uint8Array,
  opts?: ParseOptions,
): Promise<InspectResult>;

/**
 * REIN (kein XLSX, kein DOM): baut Zeilen aus einem gegebenen Mapping. Wird bei
 * jeder Dropdown-Änderung neu gerufen (billig). requireDuration verwirft Zeilen
 * ohne parsebare Dauer wie heute.
 */
export function extractRowsFromMapping(
  rawRows: Array<Record<string, unknown>>,
  headerRow: number,
  mapping: ColumnMapping,
  opts?: ParseOptions,
): { rows: ParsedRow[]; skippedRows: number };
```

Umbau (DRY, ohne Verhaltensänderung):
- Ein interner Helfer `readWorkbook(data)` → `{ sheetName, rawRows }` (kapselt `XLSX.read` +
  `sheet_to_json(header:'A', raw:true, defval:'', cellDates:true)`).
- `detectHeader`/`matchHeader` bleiben; ihr Ergebnis (`headerIdx`, `columns`) ist die
  Auto-Vorbelegung.
- **`parseRegieplan` = `readWorkbook` + `detectHeader` + `extractRowsFromMapping(rawRows,
  headerIdx, columns, opts)`** → assembliert die **unveränderte** `ParseResult`
  (`rows`, `source{sheetName, headerRow, columns, totalRows, skippedRows}`). Rundown ruft
  es unverändert.
- **`inspectRegieplan` = `readWorkbook` + `detectHeader` + `buildAvailableColumns(rawRows,
  headerIdx)`**.
- `buildAvailableColumns(rawRows, headerIdx)`: Vereinigung aller Spalten-Keys über alle
  Rohzeilen (sortiert); `header` = `String(rawRows[headerIdx][key] ?? '')` (leer bei
  `headerIdx < 0`); `sample` = erster nicht-leerer Wert in Zeilen **nach** dem Header
  (getrimmt, auf 40 Zeichen gekürzt).

`extractRowsFromMapping` kapselt exakt die heutige Extraktions-Schleife (Zeilen ab
`headerRow+1`; `label`/`start`/`duration`/`note` aus den gemappten Keys; `parseDuration`,
`parseTimeOfDay`; `requireDuration`-Filter; `plannedStartMs ?? undefined`).

## Datenfluss + UI (`apps/timer`, nur Operator)

`lib/xlsx.ts` — dünne Timer-Wrapper (Dauer Pflicht):

```ts
export function inspectXlsx(buffer: ArrayBuffer) { return inspectRegieplan(buffer, { requireDuration: true }); }
export function extractRows(rawRows, headerRow, mapping) {
  return extractRowsFromMapping(rawRows, headerRow, mapping, { requireDuration: true });
}
export type { InspectResult, ColumnMapping, AvailableColumn } from '@jm/regieplan';
```
(`parseXlsx` **entfällt** — sein einziger Aufrufer war der Import-Dialog, der künftig
`inspectXlsx` nutzt. Rundown importiert `parseRegieplan` direkt aus `@jm/regieplan`, nicht
Timers Wrapper — daher unberührt.)

`XlsxImport.tsx`:
- **State:** `inspection: InspectResult | null`, `mapping: ColumnMapping`.
- **Datei wählen** → `inspectXlsx(buf)` → `setInspection(r)` + `setMapping(r.columns)`.
- **Abgeleitet** (`useMemo` über `inspection` + `mapping`): `{ rows, skippedRows } =
  extractRows(inspection.rawRows, inspection.headerRow, mapping)`.
- **Mapping-Zeile:** 4 `<select>` (Titel · Startzeit · Dauer · Notiz). Optionen = **„— (keine)"**
  + je `availableColumns`-Eintrag als `«header || "Spalte "+key» · Bsp: «sample»`. Titel + Dauer
  tragen ein „Pflicht"-Kennzeichen.
- **Vorschau + Zähler** („Items erkannt"/„Übersprungen"/„Gesamt-Dauer") hängen an den
  abgeleiteten `rows` → aktualisieren sofort bei jeder Zuordnungs-Änderung.
- **„Importieren"** disabled, wenn `!mapping.label || !mapping.duration || rows.length === 0`;
  Hinweistext „Ordne Titel und Dauer einer Spalte zu." `confirmImport` nutzt die aktuellen
  `rows` (mode `replace` → `ttSetAll(rows)`, `append` → `ttAdd` je Zeile) — wie heute.
- Die bisherige separate „Spalten"-Meta-Kachel entfällt (die Dropdowns zeigen die Zuordnung).
  Sheet/Header-Meta, Replace/Append, Vorlage/Export-Buttons bleiben.

## Fehlerbehandlung

- Datei-Lese-/Parse-Fehler und leeres Tabellenblatt → wie heute (catch → Meldung; `inspect`
  wirft bei fehlendem Sheet).
- „0 Items nach Mapping" ist **kein harter Fehler** — live korrigierbar; nur der Import-Button
  bleibt gesperrt (mit Hinweis).

## Tests + Verifikation

- **Reine Helfer unit-getestet** (`packages/regieplan/test/selftest.ts`):
  - `extractRowsFromMapping`: explizites Mapping → korrekte Zeilen; `requireDuration` verwirft
    dauerlose; `note`/`start` optional; `plannedStartMs` geparst; ein `null`-Feld → leer.
  - `inspectRegieplan`: `availableColumns` trägt Header + Sample; `columns` = Auto-Erkennung;
    positional-Fall (`headerRow === -1`, `header === ''`); rawRows vorhanden.
  - **Regression:** `parseRegieplan`-Bestandsprüfungen bleiben grün (unverändertes Verhalten).
- **Rundown** Typecheck + Build grün (geteiltes Paket).
- **Timer** `typecheck:web` + Build.
- **Manuell (Owner/Windows-GUI):** fremde XLSX mit unpassenden Headern importieren → Auto-Mapping
  danebengelegt → per Dropdown korrigieren → Vorschau/Import stimmen; Datei ohne Header (positional)
  → Spalten manuell zuordnen.

## Release

Timer wird von der CI gebaut → nach Merge Tag **`timer-v0.9.0`** (Minor: neue Fähigkeit) +
automatischer Katalog-Bump. Die `@jm/regieplan`-Erweiterung (neue Exports) wandert transitiv
auch in Rundown — additiv, kein Zwang zum Sofort-Release.
