# JM Timer — Verantwortlich + Kategorie je Ablaufpunkt (Sub-C2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Jeder Ablaufpunkt trägt zwei optionale Metadaten — Verantwortlich (`owner`) + Kategorie (`category`) — die beim XLSX-Import erkannt/zugeordnet, im Operator kompakt angezeigt/editiert und beim Export wieder ausgegeben werden.

**Architecture:** Zwei optionale String-Felder werden strikt nach dem etablierten `plannedStartMs`-Muster durch die Pipeline geführt: Modell (`ParsedRow` + `TimetableItem` + `ColumnMapping`), Erkennung (`OWNER_/CATEGORY_KEYWORDS` + `matchHeader`), reine Extraktion (`extractRowsFromMapping`), Export (`REGIEPLAN_HEADER` + `rowsToAoa`) und Operator-UI (2 Mapping-Dropdowns + kompakte Unterzeile). Additiv, geteilt mit Rundown.

**Tech Stack:** TypeScript, React/Zustand-Renderer, `xlsx` (SheetJS, lazy), `node --experimental-strip-types` als Test-Harness.

## Global Constraints

- **Ziel-Release:** `timer-v0.10.0` (Minor; CI-gebaut). package.json heute `0.9.0`.
- **`@jm/regieplan` ist GETEILT mit JM Rundown** → additiv/rückwärtskompatibel; **Rundown-Build muss grün bleiben**. `parseRegieplan`-Signatur/Verhalten unverändert; Rundown ignoriert owner/category.
- **owner/category sind optionale Strings** (freier Text, unvalidiert); leer = `undefined`. Reine Metadaten — **kein Timer-Verhalten** daraus.
- **`ColumnMapping.owner`/`.category` sind OPTIONAL nullable** (`owner?: string | null`) — damit ein Konsument, der ein Teil-Mapping baut (z. B. die UI-Konstante `EMPTY_MAPPING`), typkompatibel bleibt und **jeder Task für sich grün** ist.
- **⚠️ Kein bloßes `art` in `CATEGORY_KEYWORDS`** — „st**art**zeit" enthält „art"; die Startzeit-Spalte würde sonst zusätzlich als Kategorie erkannt. Keywords disjunkt zu Label/Start/Dauer/Notiz.
- **owner/category-Erkennung beansprucht nur unbelegte Spalten** (Guard gegen label/start/duration/note/einander).
- **Export-Spalten ANGEHÄNGT:** `Programmpunkt, Startzeit, Dauer, Notiz, Verantwortlich, Kategorie` (bestehende Reihenfolge stabil).
- **Sprecher-/Großanzeige unberührt.** Keine neuen tt-Commands (Felder Teil von `Omit<TimetableItem,'id'>`).
- **CRLF:** EOL-bewusst editieren; `changelog.json` keine ASCII-Anführungszeichen, JSON validieren. `package-lock.json` nach `npm version` bei Fremd-Drift mit `git restore` zurücksetzen.

---

## File Structure

- `packages/regieplan/src/index.ts` — **Modify:** `ParsedRow`/`ColumnMapping` += owner/category; `OWNER_KEYWORDS`/`CATEGORY_KEYWORDS`; `matchHeader`/`detectHeader`; `REGIEPLAN_HEADER` (6-spaltig); `extractRowsFromMapping`; `rowsToAoa`; `exportRegieplanXlsx` (Spaltenbreiten).
- `packages/regieplan/test/selftest.ts` — **Modify:** owner/category-Tests + 6-Spalten-Header-Erwartungen.
- `apps/timer/src/shared/timer-state.ts` — **Modify:** `TimetableItem` += owner/category.
- `apps/timer/src/renderer/src/lib/xlsx.ts` — **Modify:** `exportTimetable`-Parametertyp + `downloadTemplate`-Beispielzeilen (6-spaltig).
- `apps/timer/src/renderer/src/components/XlsxImport.tsx` — **Modify:** `EMPTY_MAPPING`, 2 Mapping-Dropdowns, Vorschau-Titelzelle kompakt.
- `apps/timer/src/renderer/src/components/TimetableRow.tsx` — **Modify:** owner/category-State + kompakte Unterzeile.
- `apps/timer/package.json` — **Modify:** Version 0.10.0.
- `packages/suite-manifest/changelog.json` — **Modify:** Eintrag 0.10.0.

---

### Task 1: `@jm/regieplan` — owner/category durch Modell, Erkennung, Extraktion, Export

**Files:**
- Modify: `packages/regieplan/src/index.ts`
- Test: `packages/regieplan/test/selftest.ts`

**Interfaces:**
- Consumes: `parseDuration`, `parseTimeOfDay`, `formatHms`, `formatTimeOfDay` (bestehend).
- Produces:
  - `ParsedRow` += `owner?: string; category?: string;`
  - `ColumnMapping` += `owner?: string | null; category?: string | null;`
  - `REGIEPLAN_HEADER = ['Programmpunkt','Startzeit','Dauer','Notiz','Verantwortlich','Kategorie']`
  - `extractRowsFromMapping` liest owner/category; `rowsToAoa(rows: Array<{…; owner?: string; category?: string}>)` schreibt sie.

- [ ] **Step 1: Failing tests ergänzen**

In `packages/regieplan/test/selftest.ts` **die bestehenden `rowsToAoa`-Zeilen (33-35)** ersetzen:

```ts
ck('rowsToAoa Header', aoa[0].join('|') === 'Programmpunkt|Startzeit|Dauer|Notiz|Verantwortlich|Kategorie');
ck('rowsToAoa Zeile1', aoa[1].join('|') === 'A||00:05:00|x||');
ck('rowsToAoa Zeile2 (leer)', aoa[2].join('|') === 'B|||||');
```

**die Startzeit-Prüfungen (75, 77)** ersetzen:

```ts
ck('REGIEPLAN_HEADER 6-spaltig', REGIEPLAN_HEADER.join('|') === 'Programmpunkt|Startzeit|Dauer|Notiz|Verantwortlich|Kategorie');
```
```ts
ck('rowsToAoa mit Startzeit', aoaS[1].join('|') === 'A|09:00|00:05:00|x||');
```

und **ans Ende** (vor `console.log(\`\n${pass}...`)) einfügen:

```ts
// owner/category
const rawOC = [
  { A: 'Titel', B: 'Wer', C: 'Kat' },
  { A: 'Keynote', B: 'Anna', C: 'Live' },
];
const exOC = extractRowsFromMapping(rawOC, 0, { label: 'A', start: null, duration: null, note: null, owner: 'B', category: 'C' }, {});
ck('extract owner/category gesetzt', exOC.rows[0]?.owner === 'Anna' && exOC.rows[0]?.category === 'Live');
const exNoOC = extractRowsFromMapping(rawOC, 0, { label: 'A', start: null, duration: null, note: null }, {});
ck('extract owner/category nicht gemappt → undefined', exNoOC.rows[0]?.owner === undefined && exNoOC.rows[0]?.category === undefined);
const aoaOC = rowsToAoa([{ label: 'A', durationMs: 300_000, note: 'n', owner: 'Anna', category: 'Live' }]);
ck('rowsToAoa owner/category Spalten', aoaOC[1].join('|') === 'A||00:05:00|n|Anna|Live');
const insOC = await inspectRegieplan(buildBufAoa([
  ['Programmpunkt', 'Verantwortlich', 'Kategorie', 'Dauer'],
  ['Keynote', 'Anna', 'Live', '00:30:00'],
]), { requireDuration: true });
ck('inspect: owner/category erkannt', insOC.columns.owner === 'B' && insOC.columns.category === 'C');
const insArt = await inspectRegieplan(buildBufAoa([
  ['Programmpunkt', 'Startzeit', 'Dauer'],
  ['Keynote', '09:00', '00:30:00'],
]), { requireDuration: true });
ck('inspect: Startzeit nicht als Kategorie (kein bloßes art)', insArt.columns.start === 'B' && insArt.columns.category == null && insArt.columns.duration === 'C');
```

- [ ] **Step 2: Run to verify fail**

Run: `npm run selftest -w @jm/regieplan`
Expected: FAIL — die 6-Spalten-Header-Prüfungen scheitern (Header noch 4-spaltig) und `columns.owner`/`.category` existieren nicht.

- [ ] **Step 3: Modell + Keywords + Header**

In `packages/regieplan/src/index.ts`:

(a) `ParsedRow` (nach `plannedStartMs`, Zeile 21) erweitern:

```ts
  /** Geplante Startzeit als ms seit Mitternacht (Tageszeit), wenn eine Startzeit-Spalte vorhanden ist. */
  plannedStartMs?: number;
  /** Verantwortlich (freier Text), wenn eine solche Spalte vorhanden ist. */
  owner?: string;
  /** Kategorie (freier Text), wenn eine solche Spalte vorhanden ist. */
  category?: string;
```

(b) `ColumnMapping` (Zeile 36-41) erweitern — owner/category **optional** (Teil-Mappings bleiben typkompatibel):

```ts
export interface ColumnMapping {
  label: string | null;
  start: string | null;
  duration: string | null;
  note: string | null;
  owner?: string | null;
  category?: string | null;
}
```

(c) Nach `NOTE_KEYWORDS` (Zeile 71) einfügen — **kein bloßes `art`** (sonst „st**art**zeit"-Kollision):

```ts
const OWNER_KEYWORDS = /verantwortlich|verantwortung|owner|responsible|zust(ä|ae)ndig/;
const CATEGORY_KEYWORDS = /kategorie|category|rubrik|typ|type/;
```

(d) `REGIEPLAN_HEADER` (Zeile 74) ersetzen:

```ts
export const REGIEPLAN_HEADER = ['Programmpunkt', 'Startzeit', 'Dauer', 'Notiz', 'Verantwortlich', 'Kategorie'] as const;
```

(e) `matchHeader` (Zeile 76-90) ersetzen — owner/category erkennen, nur unbelegte Spalten beanspruchen:

```ts
function matchHeader(row: Record<string, unknown>): ColumnMapping {
  const out: ColumnMapping = { label: null, start: null, duration: null, note: null, owner: null, category: null };
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
    // owner/category nur auf noch unbelegte Spalten (disjunkte Keywords, plus Guard).
    if (out.owner == null && col !== out.label && col !== out.start && col !== out.duration && col !== out.note && OWNER_KEYWORDS.test(v)) out.owner = col;
    if (out.category == null && col !== out.label && col !== out.start && col !== out.duration && col !== out.note && col !== out.owner && CATEGORY_KEYWORDS.test(v)) out.category = col;
  }
  return out;
}
```

(f) `detectHeader`-Fallback (Zeile 103) ergänzen:

```ts
  return { headerIdx: -1, columns: { label: 'A', start: null, duration: 'B', note: 'C', owner: null, category: null } };
```

- [ ] **Step 4: Extraktion + Export**

(a) `extractRowsFromMapping` (Zeile 242-255, die Schleife) — owner/category lesen und in die Zeile schreiben. Den Schleifenkörper ersetzen:

```ts
  for (let i = headerRow + 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    const label = mapping.label !== null ? String(row[mapping.label] ?? '').trim() : '';
    const startRaw = mapping.start !== null ? row[mapping.start] : undefined;
    const durationRaw = mapping.duration !== null ? row[mapping.duration] : undefined;
    const note = mapping.note !== null ? String(row[mapping.note] ?? '').trim() : '';
    const owner = mapping.owner != null ? String(row[mapping.owner] ?? '').trim() : '';
    const category = mapping.category != null ? String(row[mapping.category] ?? '').trim() : '';
    const durationMs = parseDuration(durationRaw);
    const plannedStartMs = parseTimeOfDay(startRaw);
    if (!label || (requireDuration && durationMs <= 0)) {
      skippedRows += 1;
      continue;
    }
    rows.push({
      label,
      durationMs,
      note: note || undefined,
      plannedStartMs: plannedStartMs ?? undefined,
      owner: owner || undefined,
      category: category || undefined,
    });
  }
```

(b) `rowsToAoa` (Zeile 301-308) ersetzen:

```ts
/** Ablauf-Zeilen → AoA (Header + Zeilen) im Export-Format. */
export function rowsToAoa(
  rows: Array<{ label: string; durationMs?: number; note?: string; plannedStartMs?: number; owner?: string; category?: string }>,
): string[][] {
  return [
    [...REGIEPLAN_HEADER],
    ...rows.map((r) => [
      r.label ?? '',
      formatTimeOfDay(r.plannedStartMs),
      formatHms(r.durationMs),
      r.note ?? '',
      r.owner ?? '',
      r.category ?? '',
    ]),
  ];
}
```

(c) `exportRegieplanXlsx` Spaltenbreiten (Zeile 317) um zwei erweitern:

```ts
  ws['!cols'] = [{ wch: 28 }, { wch: 10 }, { wch: 12 }, { wch: 32 }, { wch: 18 }, { wch: 14 }];
```

- [ ] **Step 5: Run to verify pass**

Run: `npm run selftest -w @jm/regieplan`
Expected: PASS — alle bisherigen (angepasst) + 5 neue Prüfungen (`… passed, 0 failed`).

- [ ] **Step 6: Rundown bleibt grün**

Run: `npm run typecheck -w @jm/rundown && npm run build -w @jm/rundown`
Expected: PASS (parseRegieplan unverändert; `columns` trägt zwei zusätzliche optionale Felder; Export bekommt zwei leere Spalten).

- [ ] **Step 7: Commit**

```bash
git add packages/regieplan/src/index.ts packages/regieplan/test/selftest.ts
git commit -m "feat(regieplan): owner/category-Spalten (Verantwortlich/Kategorie), additiv (#11/Sub-C2)"
```

---

### Task 2: `timer-state.ts` + `lib/xlsx.ts` — Modell-Plumbing

**Files:**
- Modify: `apps/timer/src/shared/timer-state.ts`
- Modify: `apps/timer/src/renderer/src/lib/xlsx.ts`

**Interfaces:**
- Consumes: `rowsToAoa` (owner/category, Task 1).
- Produces: `TimetableItem` += `owner?: string; category?: string;`; `exportTimetable` reicht owner/category durch; `downloadTemplate` mit 6-spaltigen Beispielzeilen.

- [ ] **Step 1: `TimetableItem` erweitern**

In `apps/timer/src/shared/timer-state.ts` `TimetableItem` (Zeile 24-30, nach `plannedStartMs`) ergänzen:

```ts
export interface TimetableItem {
  id: string;
  label: string;
  durationMs: number;
  note?: string;
  /** Geplante Startzeit als ms seit LOKALER Mitternacht (Tageszeit). Optional; leer = aus der Kette. */
  plannedStartMs?: number;
  /** Verantwortlich (freier Text). Optional. */
  owner?: string;
  /** Kategorie (freier Text). Optional. */
  category?: string;
}
```

- [ ] **Step 2: `exportTimetable` + `downloadTemplate`**

In `apps/timer/src/renderer/src/lib/xlsx.ts`:

(a) `exportTimetable`-Signatur (Zeile 46-48) erweitern, damit owner/category an `rowsToAoa` gelangen:

```ts
export async function exportTimetable(
  items: Array<{ label: string; durationMs: number; note?: string; plannedStartMs?: number; owner?: string; category?: string }>,
): Promise<void> {
  await exportRegieplanXlsx(rowsToAoa(items), 'JM-Timer-Ablauf.xlsx');
}
```

(b) `downloadTemplate`-Beispielzeilen (Zeile 29-39) auf 6 Spalten bringen (Verantwortlich/Kategorie beispielhaft gefüllt/leer gemischt):

```ts
  await exportRegieplanXlsx(
    [
      [...REGIEPLAN_HEADER],
      ['Begrüßung', '09:00', '00:05:00', 'Einlauf / Moderation', 'Anna', 'Moderation'],
      ['Keynote', '', '00:30:00', '', 'Dr. Berg', 'Vortrag'],
      ['Pause', '', '00:15:00', 'Catering', '', 'Pause'],
      ['Podiumsdiskussion', '12:00', '00:45:00', '3 Gäste (Fixslot)', 'Lena', 'Talk'],
      ['Abschluss', '', '00:10:00', '', 'Anna', 'Moderation'],
    ],
    'JM-Timer-Regieplan-Vorlage.xlsx',
  );
```

- [ ] **Step 3: Typecheck + Build**

Run: `npm run typecheck -w @jm/timer && npm run build -w @jm/timer`
Expected: PASS. (`ttSetAll`/`ttAdd` tragen owner/category automatisch — `ParsedRow` ist zu `Omit<TimetableItem,'id'>` strukturkompatibel.)

- [ ] **Step 4: Commit**

```bash
git add apps/timer/src/shared/timer-state.ts apps/timer/src/renderer/src/lib/xlsx.ts
git commit -m "feat(timer): TimetableItem owner/category + Export/Vorlage durchgereicht (#11/Sub-C2)"
```

---

### Task 3: `XlsxImport.tsx` — zwei Mapping-Dropdowns + kompakte Vorschau

**Files:**
- Modify: `apps/timer/src/renderer/src/components/XlsxImport.tsx`

**Interfaces:**
- Consumes: `ColumnMapping` (owner/category, Task 1), `InspectResult`, `formatTimeOfDay`.
- Produces: Import-Dialog mit 6 Zuordnungs-Dropdowns; owner/category in der Vorschau-Titelzelle.

- [ ] **Step 1: `EMPTY_MAPPING` + zwei Dropdowns**

In `apps/timer/src/renderer/src/components/XlsxImport.tsx`:

(a) `EMPTY_MAPPING` (Zeile 23) ersetzen:

```ts
const EMPTY_MAPPING: ColumnMapping = { label: null, start: null, duration: null, note: null, owner: null, category: null };
```

(b) Die Mapping-Zeile (Zeile 169-174) ersetzen — Grid `md:grid-cols-4` → `md:grid-cols-3`, zwei Dropdowns ergänzen:

```tsx
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <MapSelect label="Titel" required field="label" value={mapping.label} columns={inspection.availableColumns} onChange={setField} />
                    <MapSelect label="Startzeit" field="start" value={mapping.start} columns={inspection.availableColumns} onChange={setField} />
                    <MapSelect label="Dauer" required field="duration" value={mapping.duration} columns={inspection.availableColumns} onChange={setField} />
                    <MapSelect label="Notiz" field="note" value={mapping.note} columns={inspection.availableColumns} onChange={setField} />
                    <MapSelect label="Verantwortlich" field="owner" value={mapping.owner ?? null} columns={inspection.availableColumns} onChange={setField} />
                    <MapSelect label="Kategorie" field="category" value={mapping.category ?? null} columns={inspection.availableColumns} onChange={setField} />
                  </div>
```

- [ ] **Step 2: Vorschau-Titelzelle mit owner/category**

Die Titel-`<span>` der Vorschauzeile (Zeile 200) ersetzen — Titel + kompakte zweite Zeile (nur wenn gesetzt):

```tsx
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{row.label}</span>
                          {(row.owner || row.category) && (
                            <span className="block truncate text-[10px] text-[var(--muted-foreground)]">
                              {[row.owner && `V: ${row.owner}`, row.category && `K: ${row.category}`].filter(Boolean).join(' · ')}
                            </span>
                          )}
                        </span>
```

- [ ] **Step 3: Typecheck:web + Build**

Run: `npm run typecheck:web -w @jm/timer && npm run build -w @jm/timer`
Expected: PASS. (`MapSelect`s `field: keyof ColumnMapping` akzeptiert `"owner"`/`"category"`.)

- [ ] **Step 4: Commit**

```bash
git add apps/timer/src/renderer/src/components/XlsxImport.tsx
git commit -m "feat(timer): Import-Dialog Verantwortlich/Kategorie-Zuordnung + Vorschau (#11/Sub-C2)"
```

---

### Task 4: `TimetableRow.tsx` — kompakte Unterzeile (owner/category editierbar)

**Files:**
- Modify: `apps/timer/src/renderer/src/components/TimetableRow.tsx`

**Interfaces:**
- Consumes: `item.owner`/`item.category` (Task 2), `ttUpdate`.
- Produces: editierbare Unterzeile je Ablaufpunkt.

- [ ] **Step 1: State + Sync-Effekte + Commit-Funktionen**

In `apps/timer/src/renderer/src/components/TimetableRow.tsx`:

(a) Nach den bestehenden Draft-States (nach Zeile 32) ergänzen:

```ts
  const [ownerDraft, setOwnerDraft] = useState(item.owner ?? '');
  const [categoryDraft, setCategoryDraft] = useState(item.category ?? '');
```

(b) Nach den bestehenden Sync-Effekten (nach Zeile 37) ergänzen:

```ts
  useEffect(() => setOwnerDraft(item.owner ?? ''), [item.owner]);
  useEffect(() => setCategoryDraft(item.category ?? ''), [item.category]);
```

(c) Nach `commitPlanned` (nach Zeile 68) ergänzen:

```ts
  function commitOwner() {
    if (ownerDraft !== (item.owner ?? '')) ttUpdate(item.id, { owner: ownerDraft.trim() || undefined });
  }
  function commitCategory() {
    if (categoryDraft !== (item.category ?? '')) ttUpdate(item.id, { category: categoryDraft.trim() || undefined });
  }
```

- [ ] **Step 2: Unterzeile im Grid (col-span-full)**

Direkt VOR dem schließenden `</div>` der Grid-Wurzel (nach dem Aktionen-Block, nach Zeile 184) einfügen — eine volle Zeile unter den Zellen:

```tsx
      <div className="col-span-full flex items-center gap-4 pl-[calc(36px+0.75rem)] text-xs">
        <label className="flex items-center gap-1 min-w-0 flex-1">
          <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted-foreground)] font-extrabold shrink-0">V</span>
          <Input
            value={ownerDraft}
            onChange={(e) => setOwnerDraft(e.target.value)}
            onBlur={commitOwner}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            placeholder="Verantwortlich"
            className="!h-7 text-xs"
          />
        </label>
        <label className="flex items-center gap-1 min-w-0 flex-1">
          <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted-foreground)] font-extrabold shrink-0">K</span>
          <Input
            value={categoryDraft}
            onChange={(e) => setCategoryDraft(e.target.value)}
            onBlur={commitCategory}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            placeholder="Kategorie"
            className="!h-7 text-xs"
          />
        </label>
      </div>
```

- [ ] **Step 3: Typecheck:web + Build**

Run: `npm run typecheck:web -w @jm/timer && npm run build -w @jm/timer`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/timer/src/renderer/src/components/TimetableRow.tsx
git commit -m "feat(timer): Operator-Unterzeile Verantwortlich/Kategorie editierbar (#11/Sub-C2)"
```

---

### Task 5: Version-Bump 0.10.0 + Changelog

**Files:**
- Modify: `apps/timer/package.json`
- Modify: `packages/suite-manifest/changelog.json`

- [ ] **Step 1: Sicherheitsnetz**

Run: `npm run selftest -w @jm/regieplan && npm run typecheck -w @jm/timer && npm run typecheck -w @jm/rundown`
Expected: alle PASS.

- [ ] **Step 2: Version bump**

Run: `npm version 0.10.0 --no-git-tag-version -w @jm/timer`
Expected: `apps/timer/package.json` steht auf `"version": "0.10.0"`.
**Hinweis:** `npm version` kann `package-lock.json` repo-weit re-synchronisieren (fremde Native-Release-Drift). **Nur** `apps/timer/package.json` stagen; `package-lock.json` mit `git restore package-lock.json` zurücksetzen, sofern der Diff mehr als die Timer-Zeile enthält.

- [ ] **Step 3: Changelog-Eintrag (textuell, quote-frei)**

In `packages/suite-manifest/changelog.json` beim Tool `timer` einen `0.10.0`-Eintrag als NEUESTEN (oben in `entries`) einfügen, Datum `2026-08-06`, Notes ohne ASCII-Anführungszeichen:

```
Verantwortlich + Kategorie: Jeder Programmpunkt kann jetzt Verantwortlich und Kategorie tragen (Spalten im XLSX oder im Operator unter dem Titel editierbar) und exportiert sie wieder mit.
```

- [ ] **Step 4: JSON validieren**

Run: `node -e "JSON.parse(require('fs').readFileSync('packages/suite-manifest/changelog.json','utf8')); console.log('changelog.json ok')"`
Expected: `changelog.json ok`.

- [ ] **Step 5: Commit**

```bash
git add apps/timer/package.json packages/suite-manifest/changelog.json
git commit -m "release(timer): 0.10.0 — Verantwortlich + Kategorie je Ablaufpunkt (#11/Sub-C2)"
```

- [ ] **Step 6: Release-Übergabe (CI)**

Timer wird von der CI gebaut → nach Merge Tag `timer-v0.10.0` pushen (CI baut mac+win + Katalog-Bump). **Manuell (Owner/Windows-GUI):** XLSX mit Verantwortlich/Kategorie importieren → Zuordnung/Anzeige stimmen; im Operator editieren; exportieren → Spalten wieder da; Round-Trip mit Rundown.

---

## Self-Review

- **Spec-Abdeckung:** Modell (owner/category auf ParsedRow + TimetableItem + ColumnMapping) → Task 1/2. Erkennung + „art"-Fallstrick + Guard → Task 1 (matchHeader). Extraktion + Export-Spalten → Task 1. Mapping-Dropdowns + Vorschau → Task 3. Operator-Unterzeile → Task 4. Release → Task 5. Nicht-Ziele (kein Verhalten, keine Großanzeige, kein generischer Beutel) eingehalten. ✔
- **Platzhalter:** keine — jeder Code-Schritt zeigt vollständigen Code.
- **Typkonsistenz:** `owner?/category?: string` identisch in `ParsedRow` (Task 1) + `TimetableItem` (Task 2); `ColumnMapping.owner/.category?: string|null` (Task 1) in `EMPTY_MAPPING` (Task 3) + `MapSelect field="owner"/"category"` genutzt; `extractRowsFromMapping`/`rowsToAoa` owner/category (Task 1) → `exportTimetable` (Task 2) → Operator/Vorschau (Task 3/4). `REGIEPLAN_HEADER` 6-spaltig (Task 1) steuert Vorlage (Task 2) + Tests (Task 1). ✔
- **Build-Grün-Zwischenschritte:** `ColumnMapping.owner/category` optional → `EMPTY_MAPPING` bleibt bis Task 3 typkompatibel, jeder Task für sich grün. Rundown-Grün expliziter Schritt (Task 1 Step 6, Task 5 Step 1). ✔
