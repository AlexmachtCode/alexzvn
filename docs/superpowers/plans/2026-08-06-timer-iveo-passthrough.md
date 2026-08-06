# JM Timer — iveo-Felder in den Timer durchreichen (Sub-B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein aus iveo materialisierter Ablauf trägt bis ins Timer-`TimetableItem` Soll-Startzeit, Verantwortlich und Kategorie — ohne manuelles Nachtragen und ohne neue Timer-UI.

**Architecture:** `ShowAblaufItem` (@jm/show) wächst um drei optionale Felder, die identisch zu `TimetableItem`/`ParsedRow` heißen. Die reinen iveo-Mapper füllen sie über neue **optionale** Options (Signaturen bleiben rückwärtskompatibel); der Launcher setzt diese Options an allen Ablauf-Stellen in bind/switch/poll; der Timer reicht die Felder durch, womit Drift-Pille, Zeilen-Delta und V/K-Unterzeile automatisch greifen.

**Tech Stack:** TypeScript, Electron-Main (Launcher/Timer), `node --experimental-strip-types` bzw. esbuild-Bundle als Test-Harness.

## Global Constraints

- **Ziel-Release:** `timer-v0.11.0` (Minor; CI-gebaut). `apps/timer/package.json` heute `0.10.0`.
- **`@jm/show` ist GETEILT** (Timer, Rundown, Launcher) → Änderung **additiv**; Rundown + Launcher müssen grün bleiben.
- **`@jm/iveo`-Mapper-Signaturen bleiben rückwärtskompatibel** — alle neuen Parameter sind optionale Options-Felder; ohne Options ist das Verhalten **unverändert** (Regressionstests).
- **Zeitzone:** `plannedStartMs` = ms seit **lokaler Mitternacht der Maschine**. Primär `starts_at` (UTC mit Offset) → `new Date()` → `getHours()/getMinutes()/getSeconds()`. Fallback `starts_at_local` (Venue-Wanduhr) nur wenn `starts_at` fehlt. Beides unparsebar → `null`.
- **Nur der ERSTE Agenda-Punkt** bekommt `plannedStartMs` (Anker); den Rest rechnet Sub-As `computePlannedSchedule` als Kette. Kettenlogik NICHT duplizieren.
- **Speaker-Verknüpfung ist tolerant:** iveo v1 liefert sie oft nicht → `owner` bleibt leer. Das ist **kein Fehler** und darf nichts blockieren.
- **⚠️ Signatur-Stabilität:** `pollSideEvent` vergleicht `JSON.stringify(ablauf)` mit `active.lastSig`. Bind/Switch und Poll **müssen dieselben Felder** erzeugen — sonst RELOAD-Sturm und Feldverlust. Deshalb wird der Side-Event-Kontext auf `ActiveShow` hinterlegt und im Poll wiederverwendet (kein zusätzlicher API-Call).
- **Kein Token/PII-Leck:** `owner` ist nur ein Anzeigename (bereits in der Show), keine Bio/Fotos/Social-Links, kein Token.
- **CRLF:** EOL-bewusst editieren; `changelog.json` keine ASCII-Anführungszeichen, JSON validieren. `package-lock.json` nach `npm version` bei Fremd-Drift mit `git restore` zurücksetzen.

---

## File Structure

- `packages/show/src/index.ts` — **Modify:** `ShowAblaufItem` += `plannedStartMs?`/`owner?`/`category?`.
- `packages/iveo/src/mapper.ts` — **Modify:** `localTimeOfDayMs`, `ProgramMapOptions` += `withSchedule`/`speakerNamesById`, `programToAblaufItem`, neues `AgendaMapOptions` + `agendaToAblauf`, Helfer `ownerFromIds`.
- `packages/iveo/src/index.ts` — **unverändert** (`export * from './mapper'` deckt die neuen Namen automatisch ab).
- `packages/iveo/test/selftest.ts` — **Modify:** Tests für Konverter, Options und Regression ohne Options.
- `apps/launcher/src/main/iveo-sync.ts` — **Modify:** `ActiveShow` += `sideCtx`; Options an allen Ablauf-Stellen (bind, switch, pollFull, pollSideEvent).
- `apps/timer/src/main/index.ts` — **Modify:** `ablaufToTimetable` reicht die drei Felder durch.
- `apps/timer/package.json` — **Modify:** Version 0.11.0.
- `packages/suite-manifest/changelog.json` — **Modify:** Eintrag 0.11.0.

---

### Task 1: `@jm/show` — `ShowAblaufItem` um drei optionale Felder erweitern

**Files:**
- Modify: `packages/show/src/index.ts:40-47`

**Interfaces:**
- Produces: `ShowAblaufItem` += `plannedStartMs?: number; owner?: string; category?: string;`

- [ ] **Step 1: Felder ergänzen**

In `packages/show/src/index.ts` das `ShowAblaufItem`-Interface (Zeile 40-47) ersetzen:

```ts
export interface ShowAblaufItem {
  /** Segment-/Programmpunkt-Titel. */
  label: string;
  /** Geplante Dauer in Millisekunden (optional). */
  durationMs?: number;
  /** Freie Notiz (optional). */
  note?: string;
  /** Geplante Startzeit als ms seit LOKALER Mitternacht (Tageszeit, optional). */
  plannedStartMs?: number;
  /** Verantwortlich (freier Text, optional). */
  owner?: string;
  /** Kategorie (freier Text, optional). */
  category?: string;
}
```

- [ ] **Step 2: Konsumenten bleiben grün**

Run: `npm run typecheck -w @jm/rundown && npm run typecheck -w @jm/timer && npm run typecheck -w @jm/launcher`
Expected: PASS (rein additiv — Rundown/Launcher ignorieren die Felder).

- [ ] **Step 3: Commit**

```bash
git add packages/show/src/index.ts
git commit -m "feat(show): ShowAblaufItem um plannedStartMs/owner/category erweitern (#11/Sub-B)"
```

---

### Task 2: `@jm/iveo` — `localTimeOfDayMs` + Options an den Mappern

**Files:**
- Modify: `packages/iveo/src/mapper.ts`
- Test: `packages/iveo/test/selftest.ts`

**Interfaces:**
- Consumes: `ShowAblaufItem` (Task 1), `extractSpeakerIds`, `speakerName` (bestehend).
- Produces:
  - `localTimeOfDayMs(p: { starts_at?: string | null; starts_at_local?: string | null }): number | null`
  - `ProgramMapOptions` += `withSchedule?: boolean; speakerNamesById?: Map<string, string>;`
  - `interface AgendaMapOptions { firstStartMs?: number | null; category?: string; speakerNamesById?: Map<string, string> }`
  - `agendaToAblauf(items: IveoAgendaItem[], opts?: AgendaMapOptions): ShowAblaufItem[]`

- [ ] **Step 1: Failing tests ergänzen**

In `packages/iveo/test/selftest.ts` den Import-Block (Zeile 5-27) um zwei Namen erweitern — `agendaToAblauf` steht schon drin, ergänzt werden `localTimeOfDayMs` und der Options-Typ:

```ts
  agendaToAblauf,
  localTimeOfDayMs,
```

Direkt NACH den bestehenden `agendaToAblauf`-Prüfungen (nach der Zeile mit `'agendaToAblauf: ohne Dauer → keine'`) einfügen:

```ts
  // localTimeOfDayMs — maschinen-lokale Tageszeit aus UTC (TZ-unabhängig geprüft,
  // indem der Erwartungswert mit derselben Date-API gebildet wird).
  const utcIso = '2026-11-12T09:30:00+00:00';
  const d = new Date(utcIso);
  const expectLocal = (d.getHours() * 60 + d.getMinutes()) * 60_000 + d.getSeconds() * 1000;
  ok(localTimeOfDayMs({ starts_at: utcIso }) === expectLocal, 'localTimeOfDayMs: starts_at → maschinen-lokale Tageszeit');
  ok(
    localTimeOfDayMs({ starts_at_local: '2026-11-12T14:05:00' }) === (14 * 60 + 5) * 60_000,
    'localTimeOfDayMs: starts_at_local-Fallback (Wanduhr)',
  );
  ok(localTimeOfDayMs({}) === null && localTimeOfDayMs({ starts_at: 'quatsch' }) === null, 'localTimeOfDayMs: fehlend/Müll → null');

  // Programm-Pfad mit Options
  const pSched = prog({ id: 'p9', title: 'Panel', starts_at: utcIso, duration_minutes: 30, format_slug: 'panel', type_slug: 'side-event', speaker_ids: ['sp1'] });
  const names = new Map([['sp1', 'Ada Lovelace']]);
  const withOpts = programToAblaufItem(pSched, { withSchedule: true, speakerNamesById: names });
  ok(withOpts.plannedStartMs === expectLocal, 'programToAblaufItem: plannedStartMs aus starts_at');
  ok(withOpts.category === 'panel', 'programToAblaufItem: category aus format_slug');
  ok(withOpts.owner === 'Ada Lovelace', 'programToAblaufItem: owner aus verknüpftem Speaker');
  const noOpts = programToAblaufItem(pSched);
  ok(
    noOpts.plannedStartMs === undefined && noOpts.category === undefined && noOpts.owner === undefined,
    'programToAblaufItem: ohne Options unverändert (Regression)',
  );

  // Agenda-Pfad mit Options — NUR Punkt 1 trägt den Anker, alle erben category
  const agOpts = agendaToAblauf(items, { firstStartMs: expectLocal, category: 'panel', speakerNamesById: names });
  ok(agOpts[0].plannedStartMs === expectLocal, 'agendaToAblauf: erster Punkt trägt Anker');
  ok(agOpts[1].plannedStartMs === undefined && agOpts[2].plannedStartMs === undefined, 'agendaToAblauf: Folgepunkte ohne Startzeit (Kette im Timer)');
  ok(agOpts.every((a) => a.category === 'panel'), 'agendaToAblauf: category vererbt');
  const agNo = agendaToAblauf(items);
  ok(
    agNo[0].plannedStartMs === undefined && agNo[0].category === undefined,
    'agendaToAblauf: ohne Options unverändert (Regression)',
  );
  ok(
    agendaToAblauf(items, { speakerNamesById: names })[0].owner === undefined,
    'agendaToAblauf: ohne Speaker-Verknüpfung bleibt owner leer (kein Fehler)',
  );
```

**Hinweis:** `programToAblaufItem` muss im Import-Block der Testdatei stehen; steht es noch nicht dort, in derselben Import-Liste ergänzen.

- [ ] **Step 2: Run to verify fail**

Run: `npm run selftest -w @jm/iveo`
Expected: FAIL — `localTimeOfDayMs` ist kein Export (Bundling-/Import-Fehler).

- [ ] **Step 3: `localTimeOfDayMs` + Owner-Helfer implementieren**

In `packages/iveo/src/mapper.ts` nach `programDayKey` (nach Zeile 55) einfügen:

```ts
/**
 * Startzeit als ms seit LOKALER Mitternacht (Zeitzone der ausführenden Maschine) —
 * dieselbe Semantik wie `midnightMsLocal` im Timer, damit die Soll/Ist-Drift stimmt.
 * Primär `starts_at` (UTC mit Offset): eindeutig parsebar, `getHours()` liefert die
 * maschinen-lokale Zeit. Fallback `starts_at_local` (Venue-Wanduhr ohne Offset) —
 * Best-Effort, stimmt nur bei gleicher Zeitzone. Sonst null.
 */
export function localTimeOfDayMs(
  p: { starts_at?: string | null; starts_at_local?: string | null },
): number | null {
  const utc = (p.starts_at || '').trim();
  if (utc) {
    const t = Date.parse(utc);
    if (Number.isFinite(t)) {
      const d = new Date(t);
      return (d.getHours() * 60 + d.getMinutes()) * 60_000 + d.getSeconds() * 1000;
    }
  }
  const local = (p.starts_at_local || '').trim();
  const m = local.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (m) {
    const h = Number(m[1]), min = Number(m[2]), sec = Number(m[3] ?? '0');
    if (h <= 23 && min <= 59 && sec <= 59) return (h * 60 + min) * 60_000 + sec * 1000;
  }
  return null;
}

/**
 * Anzeigename(n) verknüpfter Speaker als „Verantwortlich". Ohne Verknüpfung oder
 * ohne Namensauflösung leer (undefined) — iveo v1 liefert die Verknüpfung oft nicht,
 * das ist ausdrücklich kein Fehler.
 */
function ownerFromIds(source: unknown, namesById?: Map<string, string>): string | undefined {
  if (!namesById || namesById.size === 0) return undefined;
  const names = extractSpeakerIds(source)
    .map((id) => namesById.get(id))
    .filter((n): n is string => !!n && n.trim().length > 0);
  return names.length ? names.join(' · ') : undefined;
}
```

**Wichtig:** `ownerFromIds` nutzt `extractSpeakerIds`, das weiter unten in der Datei definiert ist — das ist zulässig (Funktionsdeklarationen sind gehoistet).

- [ ] **Step 4: Programm-Pfad um Options erweitern**

(a) `ProgramMapOptions` (Zeile 66-71) ersetzen:

```ts
export interface ProgramMapOptions {
  /** Stage-Namen als Notiz ergänzen (aus einer stageId→Stage-Map). */
  stagesById?: Map<string, IveoStage>;
  /** Subtitle als Notiz nutzen, falls vorhanden (Default true). */
  includeSubtitle?: boolean;
  /**
   * Startzeit/Kategorie/Verantwortlich mit befüllen (#11 Sub-B). Default false →
   * Verhalten bestehender Aufrufer unverändert.
   */
  withSchedule?: boolean;
  /** id → Anzeigename, zur Auflösung verknüpfter Speaker (für `owner`). */
  speakerNamesById?: Map<string, string>;
}
```

(b) `programToAblaufItem` (Zeile 85-92) ersetzen:

```ts
/** Ein Programm → ein Ablauf-Punkt. */
export function programToAblaufItem(p: IveoProgram, opts: ProgramMapOptions = {}): ShowAblaufItem {
  const item: ShowAblaufItem = { label: p.title?.trim() || '(ohne Titel)' };
  const durationMs = durationMsOf(p);
  if (durationMs > 0) item.durationMs = durationMs;
  const note = noteFor(p, opts);
  if (note) item.note = note;
  if (opts.withSchedule) {
    const startMs = localTimeOfDayMs(p);
    if (startMs !== null) item.plannedStartMs = startMs;
    const category = (p.format_slug || p.type_slug || '').trim();
    if (category) item.category = category;
    const owner = ownerFromIds(p, opts.speakerNamesById);
    if (owner) item.owner = owner;
  }
  return item;
}
```

- [ ] **Step 5: Agenda-Pfad um Options erweitern**

`agendaToAblauf` (Zeile 107-119) ersetzen:

```ts
/** Options für den Agenda-Pfad (#11 Sub-B). */
export interface AgendaMapOptions {
  /**
   * Soll-Startzeit des ERSTEN Punktes (ms seit lokaler Mitternacht) — Anker der
   * Kette. Die Folgepunkte bleiben leer; ihre Zeiten rechnet der Timer aus den
   * Dauern (computePlannedSchedule), damit die Kettenlogik nur einmal existiert.
   */
  firstStartMs?: number | null;
  /** Kategorie, die alle Punkte des Side Events erben. */
  category?: string;
  /** id → Anzeigename, zur Auflösung verknüpfter Speaker je Agenda-Punkt. */
  speakerNamesById?: Map<string, string>;
}

/**
 * Agenda-Punkte EINES Programms → zentraler Ablauf (#11 Phase 3b): der Feinablauf
 * eines Side Events (Begrüßung/Panel/Q&A …). Nach `sort_order` sortiert; Dauer aus
 * `duration_minutes`, Notiz aus `notes`. Mit Options zusätzlich Startzeit-Anker,
 * geerbte Kategorie und Verantwortlich (#11 Sub-B).
 */
export function agendaToAblauf(items: IveoAgendaItem[], opts: AgendaMapOptions = {}): ShowAblaufItem[] {
  const category = (opts.category || '').trim();
  return [...items]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((it, idx) => {
      const item: ShowAblaufItem = { label: it.title?.trim() || '(ohne Titel)' };
      if (typeof it.duration_minutes === 'number' && it.duration_minutes > 0) {
        item.durationMs = Math.round(it.duration_minutes * MIN_PER_MS);
      }
      const note = (it.notes || '').trim();
      if (note) item.note = note;
      if (idx === 0 && typeof opts.firstStartMs === 'number') item.plannedStartMs = opts.firstStartMs;
      if (category) item.category = category;
      const owner = ownerFromIds(it, opts.speakerNamesById);
      if (owner) item.owner = owner;
      return item;
    });
}
```

- [ ] **Step 6: Exporte verifizieren (keine Änderung nötig)**

`packages/iveo/src/index.ts` enthält bereits `export * from './mapper';` (Zeile 9) — `localTimeOfDayMs` und `AgendaMapOptions` sind damit **automatisch** exportiert. Keine Änderung an `index.ts`.

Run: `grep -n "export \* from './mapper'" packages/iveo/src/index.ts`
Expected: eine Trefferzeile. Fehlt sie wider Erwarten, stattdessen `export { localTimeOfDayMs } from './mapper';` und `export type { AgendaMapOptions } from './mapper';` ergänzen.

- [ ] **Step 7: Run to verify pass**

Run: `npm run selftest -w @jm/iveo`
Expected: PASS — `ALLE TESTS OK` (inkl. der 12 neuen Prüfungen).

- [ ] **Step 8: Commit**

```bash
git add packages/iveo/src/mapper.ts packages/iveo/test/selftest.ts
git commit -m "feat(iveo): localTimeOfDayMs + Startzeit/Kategorie/Verantwortlich-Options an den Mappern (#11/Sub-B)"
```

---

### Task 3: Launcher — Options an allen Ablauf-Stellen (bind, switch, poll)

**Files:**
- Modify: `apps/launcher/src/main/iveo-sync.ts`

**Interfaces:**
- Consumes: `localTimeOfDayMs`, `ProgramMapOptions.withSchedule`/`speakerNamesById`, `AgendaMapOptions` (Task 2), `speakerName` (bestehend).
- Produces: `ActiveShow.sideCtx?: { firstStartMs: number | null; category?: string; speakerNames?: Array<[string, string]> }` — der beim Bind/Switch ermittelte Side-Event-Kontext, damit `pollSideEvent` **dieselben** Felder erzeugt (Signatur-Stabilität).

- [ ] **Step 1: Import + Namens-Helfer**

In `apps/launcher/src/main/iveo-sync.ts` den `@jm/iveo`-Import-Block (um Zeile 26-34) um `localTimeOfDayMs` und `speakerName` erweitern (falls `speakerName` schon importiert ist, nur `localTimeOfDayMs` ergänzen):

```ts
  localTimeOfDayMs,
  speakerName,
```

Direkt vor `resolveSideEvent` (vor Zeile 115) einen Helfer einfügen:

```ts
/** id → Anzeigename aller Event-Speaker (für „Verantwortlich" am Ablauf-Punkt). */
function speakerNameMap(speakers: Array<Parameters<typeof speakerName>[0]>): Map<string, string> {
  return new Map(speakers.map((s) => [s.id, speakerName(s)]));
}
```

- [ ] **Step 2: `ActiveShow` um den Side-Event-Kontext erweitern**

Das `ActiveShow`-Interface (Zeile 336-347) ersetzen:

```ts
interface ActiveShow {
  path: string;
  /** Kanonischer Event-Slug (Token-Schlüssel). */
  event: string;
  baseUrl: string;
  /** Letzter erfolgreicher Sync (ISO) — Basis fürs ?updated_since=. */
  lastSyncIso: string;
  /** Ablauf-Filter der Show (identisch zum Bind) — für konsistente Live-Updates. */
  filter: IveoProgramFilter;
  /** Signatur des zuletzt geschriebenen Ablaufs (Agenda-Modus) — verhindert unnötige RELOADs. */
  lastSig?: string;
  /**
   * Beim Bind/Switch ermittelter Side-Event-Kontext (#11 Sub-B). `pollSideEvent`
   * hat keinen Snapshot; ohne diesen Merker würde der Poll einen Ablauf OHNE
   * Startzeit/Kategorie/Verantwortlich erzeugen → andere `lastSig` bei jedem Poll
   * (RELOAD-Sturm) und Feldverlust in der Show. Namen als Array-Paare, damit der
   * Merker klonbar/serialisierbar bleibt.
   */
  sideCtx?: { firstStartMs: number | null; category?: string; speakerNames?: Array<[string, string]> };
}
```

- [ ] **Step 3: `resolveSideEvent` (Bind) — Options setzen + Kontext liefern**

In `resolveSideEvent` den Rückgabetyp (Zeile 121) erweitern und den Ablauf-Block (Zeile 144-150) ersetzen.

Rückgabetyp:

```ts
): Promise<{
  ablauf: ReturnType<typeof agendaToAblauf>;
  speakers: ShowIveoSpeaker[];
  warning?: string;
  sideCtx: { firstStartMs: number | null; category?: string; speakerNames?: Array<[string, string]> };
}> {
```

Ablauf-Block:

```ts
  const stagesById = new Map(snap.stages.map((s) => [s.id, s]));
  const names = speakerNameMap(snap.speakers);
  const firstStartMs = source ? localTimeOfDayMs(source) : null;
  const category = ((source?.format_slug || source?.type_slug) || '').trim() || undefined;
  const ablauf =
    agenda.length > 0
      ? agendaToAblauf(agenda, { firstStartMs, category, speakerNamesById: names })
      : source
        ? [programToAblaufItem(source, { stagesById, withSchedule: true, speakerNamesById: names })]
        : [];
  const sideCtx = { firstStartMs, category, speakerNames: [...names] as Array<[string, string]> };
```

und die `return`-Zeile am Funktionsende (Zeile 172) ersetzen:

```ts
  return { ablauf, speakers, warning, sideCtx };
```

- [ ] **Step 4: Bind-Aufrufer — Kontext merken + Listen-Pfad mit Options**

Im Bind (um Zeile 283-299) den `if/else`-Block ersetzen, sodass `sideCtx` gemerkt und der Listen-Pfad mit Options gebaut wird:

```ts
    const subWarnings: string[] = [];
    let ablauf: ReturnType<typeof programsToAblauf>;
    let speakers: ShowIveoSpeaker[];
    let agendaMode = false;
    let sideCtx: ActiveShow['sideCtx'];
    if (input.programId) {
      // Mode B (#11 Phase 3b): EIN Side Event „im Detail" — Ablauf aus dessen
      // Agenda, Speaker auf dieses Programm eingegrenzt.
      agendaMode = true;
      const resolved = await resolveSideEvent(client, event, input.programId, snap, (m) => subWarnings.push(m));
      ablauf = resolved.ablauf;
      speakers = resolved.speakers;
      sideCtx = resolved.sideCtx;
      if (resolved.warning) subWarnings.push(resolved.warning);
    } else {
      // Mode A: Liste (Tag/Typ/Format, ohne Blocker) → mehrere Side Events als Ablauf.
      const stagesById = new Map(snap.stages.map((s) => [s.id, s]));
      ablauf = programsToAblauf(filterPrograms(snap.programs, filter), {
        stagesById,
        withSchedule: true,
        speakerNamesById: speakerNameMap(snap.speakers),
      });
      speakers = snapshotToShowSpeakers(snap);
    }
```

Anschließend dort, wo `active` gesetzt wird (die Zuweisung `active = { … }` in derselben Funktion), das Feld `sideCtx` mit aufnehmen — also `sideCtx,` in das Objektliteral ergänzen.

- [ ] **Step 5: `pollFull` — Listen-Pfad mit Options**

Die Zeile 468 ersetzen:

```ts
    const ablauf = programsToAblauf(filterPrograms(snap.programs, active.filter), {
      stagesById,
      withSchedule: true,
      speakerNamesById: speakerNameMap(snap.speakers),
    });
```

- [ ] **Step 6: `pollSideEvent` — gemerkten Kontext verwenden (Signatur-Stabilität)**

In `pollSideEvent` den Ablauf-Block (Zeile 502-507) ersetzen:

```ts
  const ctx = a.sideCtx;
  const names = ctx?.speakerNames ? new Map(ctx.speakerNames) : undefined;
  let ablauf = agendaToAblauf(agenda, {
    firstStartMs: ctx?.firstStartMs ?? null,
    category: ctx?.category,
    speakerNamesById: names,
  });
  if (!ablauf.length) {
    // Kein/leerer Agenda → das Programm selbst als ein Punkt (Detail best-effort).
    const detail = await client.getProgram(a.event, programId).catch(() => null);
    if (detail) ablauf = [programToAblaufItem(detail, { withSchedule: true, speakerNamesById: names })];
  }
```

- [ ] **Step 7: `resolveSideEventLight` (Switch) — Options + Kontext**

In `resolveSideEventLight` den Rückgabetyp (Zeile 624) erweitern:

```ts
): Promise<{
  ablauf: ReturnType<typeof agendaToAblauf>;
  speakers: ShowIveoSpeaker[];
  warning?: string;
  sideCtx: { firstStartMs: number | null; category?: string; speakerNames?: Array<[string, string]> };
}> {
```

Den Ablauf-Block (Zeile 635-636) ersetzen:

```ts
  const firstStartMs = detail ? localTimeOfDayMs(detail) : null;
  const category = ((detail?.format_slug || detail?.type_slug) || '').trim() || undefined;
  const namesMap = speakerNameMap(fallbackSpeakers.map((s) => ({ id: s.id, first_name: s.name, last_name: '' })));
  let ablauf = agendaToAblauf(agenda, { firstStartMs, category, speakerNamesById: namesMap });
  if (!ablauf.length && detail) {
    ablauf = [programToAblaufItem(detail, { withSchedule: true, speakerNamesById: namesMap })];
  }
```

**Hinweis zur Namensquelle:** Im Switch-Pfad liegt kein Snapshot vor; `fallbackSpeakers` sind bereits sanitisierte `ShowIveoSpeaker` mit `{id, name}`. Sie werden hier auf die von `speakerName` erwartete Form gehoben (Vorname = fertiger Anzeigename, Nachname leer) — das Ergebnis ist exakt der Anzeigename. Löst iveo später echte Verknüpfungen auf, greift derselbe Weg.

Die `return`-Zeile der Funktion (Zeile 659) ersetzen:

```ts
  return { ablauf, speakers, warning, sideCtx: { firstStartMs, category, speakerNames: [...namesMap] as Array<[string, string]> } };
```

- [ ] **Step 8: `switchSideEvent` — Kontext übernehmen**

In `switchSideEvent` im `if (programId)`-Zweig nach `warning = r.warning;` ergänzen:

```ts
      active.sideCtx = r.sideCtx;
```

und im `else`-Zweig (Tagesübersicht) den `programsToAblauf`-Aufruf (Zeile 692) ersetzen sowie den Kontext löschen:

```ts
      ablauf = programsToAblauf(filterPrograms(snap.programs, f), {
        stagesById,
        withSchedule: true,
        speakerNamesById: speakerNameMap(snap.speakers),
      });
      active.sideCtx = undefined;
```

- [ ] **Step 9: Typecheck + Build**

Run: `npm run typecheck -w @jm/launcher && npm run build -w @jm/launcher`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add apps/launcher/src/main/iveo-sync.ts
git commit -m "feat(launcher): iveo-Startzeit/Kategorie/Verantwortlich an allen Ablauf-Stellen (#11/Sub-B)"
```

---

### Task 4: Timer — Felder ins `TimetableItem` durchreichen

**Files:**
- Modify: `apps/timer/src/main/index.ts:310-320`

**Interfaces:**
- Consumes: `ShowAblaufItem.plannedStartMs/owner/category` (Task 1).

- [ ] **Step 1: `ablaufToTimetable` erweitern**

In `apps/timer/src/main/index.ts` die `ablaufToTimetable`-Funktion (ab Zeile 310) so ersetzen, dass die drei Felder mitwandern — der bestehende `.map()` bleibt, nur das erzeugte Objekt wächst:

```ts
function ablaufToTimetable(
  ablauf: ShowAblaufItem[] | undefined,
): Array<Omit<TimetableItem, 'id'>> | null {
  if (!ablauf || !ablauf.length) return null;
  return ablauf.map((a) => ({
    label: (a.label || '').trim() || '(ohne Titel)',
    durationMs: typeof a.durationMs === 'number' && a.durationMs > 0 ? a.durationMs : 0,
    ...(a.note ? { note: a.note } : {}),
    ...(typeof a.plannedStartMs === 'number' ? { plannedStartMs: a.plannedStartMs } : {}),
    ...(a.owner ? { owner: a.owner } : {}),
    ...(a.category ? { category: a.category } : {}),
  }));
}
```

**Wichtig:** Die bestehende Feld-Logik für `label`/`durationMs`/`note` in der Datei kann leicht abweichen (z. B. andere Defaults). Vor dem Ersetzen die aktuellen Zeilen lesen und **nur** die drei neuen Spread-Zeilen ergänzen, statt vorhandenes Verhalten zu ändern.

- [ ] **Step 2: Typecheck + Build**

Run: `npm run typecheck -w @jm/timer && npm run build -w @jm/timer`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/timer/src/main/index.ts
git commit -m "feat(timer): iveo-Ablauf reicht Startzeit/Verantwortlich/Kategorie durch (#11/Sub-B)"
```

---

### Task 5: Version-Bump 0.11.0 + Changelog

**Files:**
- Modify: `apps/timer/package.json`
- Modify: `packages/suite-manifest/changelog.json`

- [ ] **Step 1: Sicherheitsnetz (alle betroffenen Pakete)**

Run: `npm run selftest -w @jm/iveo && npm run selftest -w @jm/regieplan && npm run typecheck -w @jm/timer && npm run typecheck -w @jm/rundown && npm run typecheck -w @jm/launcher`
Expected: alle PASS.

- [ ] **Step 2: Version bump**

Run: `npm version 0.11.0 --no-git-tag-version -w @jm/timer`
Expected: `apps/timer/package.json` steht auf `"version": "0.11.0"`.
**Hinweis:** `npm version` kann `package-lock.json` repo-weit re-synchronisieren (fremde Native-Release-Drift). **Nur** `apps/timer/package.json` stagen; `package-lock.json` mit `git restore package-lock.json` zurücksetzen, sofern der Diff mehr als die Timer-Zeile enthält.

- [ ] **Step 3: Changelog-Eintrag (textuell, quote-frei)**

In `packages/suite-manifest/changelog.json` beim Tool `timer` einen `0.11.0`-Eintrag als NEUESTEN (oben in `entries`) einfügen, Datum `2026-08-06`, Notes ohne ASCII-Anführungszeichen:

```
Aus iveo uebernommene Ablaeufe bringen jetzt die geplanten Startzeiten mit — die Soll-Ist-Drift steht sofort, ohne Zeiten nachzutragen.
Ausserdem uebernimmt der Timer Kategorie und (sofern iveo sie verknuepft) Verantwortlich je Programmpunkt.
```

- [ ] **Step 4: JSON validieren**

Run: `node -e "JSON.parse(require('fs').readFileSync('packages/suite-manifest/changelog.json','utf8')); console.log('changelog.json ok')"`
Expected: `changelog.json ok`.

- [ ] **Step 5: Commit**

```bash
git add apps/timer/package.json packages/suite-manifest/changelog.json
git commit -m "release(timer): 0.11.0 — iveo-Startzeiten/Verantwortlich/Kategorie im Timer (#11/Sub-B)"
```

- [ ] **Step 6: Release-Übergabe (CI)**

Timer wird von der CI gebaut → nach Merge Tag `timer-v0.11.0` pushen (CI baut mac+win + Katalog-Bump). **Manuell (Owner/Windows-GUI):** Show mit iveo-Event + Side Event öffnen → Timer zeigt Soll-Zeiten (Drift-Pille aktiv) und Kategorie; Verantwortlich nur, wenn iveo Speaker verknüpft. Einen iveo-Reload während der Show auslösen → dieselben Felder, **kein** RELOAD-Sturm (Signatur stabil).

---

## Self-Review

- **Spec-Abdeckung:** `ShowAblaufItem`-Erweiterung → Task 1. `localTimeOfDayMs` inkl. Zeitzonen-Entscheidung (starts_at primär, starts_at_local Fallback) → Task 2. Programm-/Agenda-Options inkl. „nur erster Punkt trägt Anker" und geerbter Kategorie → Task 2. Alle Launcher-Stellen (bind Liste + Side Event, switch beide Zweige, pollFull, pollSideEvent) → Task 3. Timer-Durchreichung → Task 4. Release → Task 5. Nicht-Ziele (keine neue Timer-UI, kein Rückschreiben, keine TZ-Bibliothek, keine neuen Endpunkte) eingehalten. ✔
- **Platzhalter:** keine — jeder Code-Schritt zeigt vollständigen Code.
- **Typkonsistenz:** `plannedStartMs?: number`/`owner?: string`/`category?: string` identisch in `ShowAblaufItem` (Task 1), `TimetableItem` (bestehend, Sub-A/C2) und den Mapper-Ausgaben (Task 2); `localTimeOfDayMs(p) → number|null` (Task 2) in Task 3 genutzt; `AgendaMapOptions{firstStartMs, category, speakerNamesById}` (Task 2) exakt so in Task 3 befüllt; `ActiveShow.sideCtx` (Task 3, Step 2) wird in Step 3/4/6/7/8 konsistent gesetzt und gelesen. ✔
- **Rückwärtskompatibilität:** Mapper ohne Options unverändert (eigene Regressionstests in Task 2); `@jm/show` additiv mit Typecheck aller drei Konsumenten (Task 1 Step 2). ✔
- **Signatur-Stabilität:** ausdrücklicher Constraint + `sideCtx`-Mechanik (Task 3) + manuelle Reload-Prüfung (Task 5 Step 6). ✔
