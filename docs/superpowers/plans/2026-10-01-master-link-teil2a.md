# Master-Link Teil 2a · Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Jeder Ablaufpunkt trägt eine feste Kennung von iveo bis in Timer und Rundown. Ein Abgleich verliert deshalb keine Aktionen, keine eigenen Zeilen und keine Position mehr, auch nicht beim Wechsel des Side Events. Das behebt #235 am Einzelplatz, ohne Master-Link-Code anzufassen.

**Architecture:**
- **`@jm/show` / `@jm/iveo`:** Das optionale Feld `ShowAblaufItem.id` wird normalisiert (doppelte → `#2`, `#3` …). Die iveo-Umwandler reichen die Programm- bzw. Agenda-ID durch.
- **Timer:** übernimmt die Kennung. Beim RELOAD findet er den laufenden Punkt über die Kennung statt über die Nummer.
- **Rundown:**
  - Datenmodell v2 mit Kontext und Archiv je Kontext.
  - Ein reiner Abgleich-Kern (`gleicheAb`, R0–R9) und reine Helfer (Sprung-Ziel, scharfe Zeile, Navigation, Ausgangsstand).
  - Im Main liegen Gedächtnis je Show-Datei-Pfad, `RUNDOWN RELOAD` und die Hinweise. Der Renderer sperrt Ablauf-Felder und zeigt die Hinweise.
- **Launcher:** Der iveo-Abgleich wandert in einen Electron-freien Kern mit injizierten Abhängigkeiten. Er schreibt atomar, meldet seinen Status bis ins Panel und schickt RELOAD auch an den Rundown. Der Show-Editor verliert beim Speichern nichts.

**Tech Stack:** TypeScript (ESM), Electron 33, React 18, Zustand 4, Selbsttests mit `node --experimental-strip-types` (Rundown, Timer), `tsx` (Launcher) und esbuild-Bündel (`@jm/iveo`).

**Spec:** `docs/superpowers/specs/2026-10-01-master-link-teil2a-design.md` (vom Owner freigegeben am 01.10.2026). Plan und Spec gehören zusammen. Bei Widerspruch gilt die Spec, und die Abweichung wird gemeldet.

**Wie dieser Plan entstanden ist:**
- Ein Gerüst hat Aufgaben und verbindliche Schnittstellen festgelegt. Sechs Agenten haben die Aufgaben ausformuliert und dabei gegen eine Kopie des Worktrees gerechnet.
- Zwei Probeläufer haben A4–A8 wörtlich aus dem Plan nachgebaut und ausgeführt (je rot → grün). Danach haben sie 98 absichtliche Fehler eingebaut. Am Anfang blieben 13 davon unentdeckt, nach den Korrekturen fangen die Tests alle 98.
- Eine Konsistenzprüfung hat alle rund 180 Vorher/Nachher-Ersetzungen von A1 bis A18 der Reihe nach eingespielt. Jeder Vorher-Ausschnitt kam dabei genau einmal vor. Auf dem Endstand sind grün: Rundown 309 + 45, iveo, Timer 41, Launcher 93 + 26 + 45 + 188, der Typecheck aller betroffenen Apps und der Build von Rundown, Timer und Launcher.
- Jede Aufgabe trägt am Ende ihre Abweichungen vom Gerüst sowie die Korrekturen aus Probelauf und Konsistenzprüfung.

## Globale Regeln (gelten für jede Aufgabe)

- G1 Nicht anfassen: `packages/master-link`, `packages/app-runtime`, `packages/suite-control-protocol`, Titler-Code (`apps/titler`), Companion-Module.
- G2 Rundown `src/shared/*.ts`: keine `electron`-, `node:`- oder Paket-Laufzeitimporte; zwischen Modulen nur `import type`. Grund: Selbsttest läuft mit `node --experimental-strip-types` (keine Pfad-Aliase, keine `.ts`-Endungen in Importen erlaubt durch tsconfig ohne `allowImportingTsExtensions`). Laufzeithelfer, die zwei Module brauchen, gehören in EIN Modul. Tests importieren mit `../src/shared/<datei>.ts`.
- G3 Timer `src/shared/show-ablauf.ts`: gleiche Regel wie G2 (nur `import type` aus `@jm/show`). `hatEigeneTimerListe` wird im Timer-Main aus `@jm/show` aufgerufen, nicht im shared-Modul.
- G4 Launcher-Kern `src/main/iveo-abgleich-kern.ts` und `src/main/show-schreiben.ts`: kein `electron`-Import. Tests mit `tsx` (wie `test/verbund.test.ts`).
- G5 Texte für die Oberfläche wortgleich aus Spec 4.6 bzw. 7.6. Deutsche Anführungszeichen „…“.
- G6 Logs: nie Token, nie Inhalte aus JSON-Parse-Fehlern; bei kaputtem JSON nur „kein gültiges JSON“.
- G7 Commits je Aufgabe, Nachricht deutsch im Stil `feat(rundown): …`, Trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Nie pushen. `git add` mit expliziten Pfaden, danach `git status --short` lesen.
- G8 TDD: erst Test rot sehen, dann Code. Jede Aufgabe endet mit `npm run typecheck -w <paket>` grün für jedes berührte Paket.
- G9 Kein bare `git stash`, kein `git reset --hard`, kein `git clean`, kein Branch-Wechsel.

## Testläufe (wie sie wirklich heißen)

| Paket | Befehl | Laufzeit |
| --- | --- | --- |
| `@jm/iveo` (inkl. `@jm/show`-Fälle) | `npm run selftest -w @jm/iveo` | esbuild-Bundle + node |
| `@jm/timer` | `npm run selftest -w @jm/timer` | node --experimental-strip-types |
| `@jm/rundown` | `npm run selftest -w @jm/rundown` | node --experimental-strip-types |
| `@jm/launcher` (neu) | `npm run selftest:iveo -w @jm/launcher` | tsx `test/iveo-abgleich.test.ts` + tsx `test/show-speichern.test.ts` |


## Review Focus (in die Tests der genannten Aufgabe)

1. Show-Datei beim RELOAD gesperrt oder kaputt (Windows EBUSY, halbes JSON) → Rundown behält Stand, Hinweis „Show nicht lesbar“, nächstes RELOAD heilt. → A9 `leseShowSicher` (EBUSY simuliert per nicht existierender/gesperrter Datei, kaputtes JSON).
2. Gedächtnis-Datei kaputt (Absturz beim Schreiben) → Rundown startet, Gedächtnis ignoriert (nicht gelöscht), Hinweis. → A9 `leseGedaechtnis` mit kaputtem JSON → `{ inhalt: null, fehler: 'kein-json' }`.
3. Titel, die wie Ersatz-Kennungen aussehen („Panel #2“, „ersatz:X“) oder doppelt sind → keine Schlüssel-Kollision. → A5 Test.
4. Großer Ablauf (51 Programme, 100 eigene Zeilen) → `gleicheAb` < 50 ms. → A5 Test.
5. `timer goto` mit `zielId`, aber Show ohne Ablauf (`ablaufSchluessel` leer) → `{ entfallen: true }`, nichts gesendet. → A7 Test.

## Aufgaben

---

### Aufgabe A1: `@jm/show` — Kennung am Ablaufpunkt, `normalizeAblauf`, `hatEigeneTimerListe`

**Spec:** `docs/superpowers/specs/2026-10-01-master-link-teil2a-design.md` Abschnitte 3.1 (Das Feld), 3.3 Zeile S1, 3.5 (Doppelte Kennungen, „In der Show“), 3.6 (Verträglichkeit), 6.1 letzter Punkt (`hatEigeneTimerListe`), 9.3 (letzter Punkt), 9.4 (letzter Punkt).

**Arbeitsverzeichnis:** `C:\Users\alexk\alexzvn\.claude\worktrees\suite-sofort-fixes` (Branch `feat/master-link-teil2a`). Alle Pfade unten relativ dazu.

**Dateien:**
- Modify: `packages/show/src/index.ts`
  - Zeilen 40–53 (`export interface ShowAblaufItem`)
  - Zeilen 146–158 (`function normalizeAblaufItem`), dahinter neu `freieKennung`, `normalizeAblauf`, `hatEigeneTimerListe`
  - Zeilen 239–243 (Ablauf in `migrateShow`)
- Test: `packages/iveo/test/selftest.ts`
  - Zeile 30 (Import aus `@jm/show`)
  - neuer Block direkt vor Zeile 449 (`if (failed > 0) {`)

Zeilenangaben gelten für den Stand vor dieser Aufgabe (Branch-Spitze `5a4b40eaa1`). Nach früheren Schritten derselben Aufgabe verschieben sie sich; maßgeblich ist immer der wortgleiche Vorher-Text.

Die `@jm/show`-Fälle stehen im iveo-Selbsttest, weil `@jm/show` keinen eigenen Testlauf hat und der iveo-Selbsttest `@jm/show` schon importiert (esbuild bündelt `@jm/show` mit). Testhilfe dort: `ok(cond: boolean, msg: string)`.

**Schnittstellen:**
- Consumes: keine (erste Aufgabe).
- Produces (exakt so, andere Aufgaben bauen darauf):
  ```ts
  export interface ShowAblaufItem { id?: string; label: string; durationMs?: number; note?: string; plannedStartMs?: number; owner?: string; category?: string }
  /** Liste normalisieren (je Punkt wie normalizeAblaufItem inkl. id), dann doppelte id auflösen: erste behält, weitere `<id>#2`, `#3` … (auch wenn `<id>#2` schon existiert → nächste freie Nummer). Nicht-Array → []. */
  export function normalizeAblauf(value: unknown): ShowAblaufItem[];
  /** true, wenn settings?.timetable ein Array mit mindestens einem Objekt (nicht null) ist — exakt die Bedingung, unter der Timer-parseTimetable eine Liste liefert. */
  export function hatEigeneTimerListe(settings: Record<string, unknown> | undefined): boolean;
  ```
  `migrateShow` (und damit `parseShow`/`serializeShow`) nutzt `normalizeAblauf`. `id`: String, nach `trim()` 1–200 Zeichen, sonst weg; gespeichert wird der getrimmte Wert, `id` als erstes Feld des Objekts.

**Regeln für diese Aufgabe:**
- Nicht anfassen: `packages/master-link`, `packages/app-runtime`, `packages/suite-control-protocol`, `apps/titler`, Companion-Module.
- TDD: erst den Test rot sehen, dann Code.
- Dateien im Arbeitsbaum haben CRLF-Zeilenenden (`core.autocrlf=true`). Änderungen mit dem Edit-Werkzeug machen (Vorher-Text exakt ersetzen), nicht mit `sed`.
- Kein bare `git stash`, kein `git reset --hard`, kein `git clean`, kein Branch-Wechsel, nie pushen.

---

- [ ] **Schritt 1: Fehlschlagenden Test schreiben** (`packages/iveo/test/selftest.ts`)

Ersetzung 1 (Zeile 30), Vorher:
```ts
import { createShow, parseShow, serializeShow } from '@jm/show';
```
Nachher:
```ts
import { createShow, hatEigeneTimerListe, normalizeAblauf, parseShow, serializeShow } from '@jm/show';
```

Ersetzung 2 (Zeilen 449–450), Vorher:
```ts
if (failed > 0) {
  console.error(`\n${failed} FEHLGESCHLAGEN`);
```
Nachher:
```ts
// ── @jm/show: Kennung am Ablaufpunkt, normalizeAblauf, hatEigeneTimerListe (Teil 2a) ──
{
  // Kennung wird übernommen, getrimmt und steht vorn (stabile Serialisierung).
  const a = normalizeAblauf([{ label: 'Begrüßung', id: '  ag-1  ', durationMs: 600_000 }]);
  ok(
    JSON.stringify(a) === '[{"id":"ag-1","label":"Begrüßung","durationMs":600000}]',
    '@jm/show: id übernommen, getrimmt, als erstes Feld',
  );

  // Ungültige Kennungen fallen weg, der Punkt selbst bleibt.
  const ungueltig = normalizeAblauf([
    { id: 42, label: 'Zahl' },
    { id: '', label: 'Leer' },
    { id: '   ', label: 'Nur Leerzeichen' },
    { id: 'k'.repeat(201), label: 'Zu lang' },
    { id: null, label: 'Null' },
  ]);
  ok(ungueltig.length === 5 && ungueltig.every((p) => !('id' in p)), '@jm/show: ungültige id entfällt, Punkt bleibt');
  ok(normalizeAblauf([{ id: 'k'.repeat(200), label: 'Grenze' }])[0].id === 'k'.repeat(200), '@jm/show: id mit 200 Zeichen bleibt');

  // Doppelte Kennungen: die erste behält ihre, jede weitere bekommt #2, #3 …
  const doppelt = normalizeAblauf([
    { id: 'X', label: 'a' },
    { id: 'X', label: 'b' },
    { id: 'X', label: 'c' },
  ]);
  ok(JSON.stringify(doppelt.map((p) => p.id)) === '["X","X#2","X#3"]', '@jm/show: doppelte id → #2, #3');
  // … und überspringt Nummern, die in der Liste schon vergeben sind.
  const belegt = normalizeAblauf([
    { id: 'X', label: 'a' },
    { id: 'X', label: 'b' },
    { id: 'X#2', label: 'c' },
  ]);
  ok(JSON.stringify(belegt.map((p) => p.id)) === '["X","X#3","X#2"]', '@jm/show: belegte #2 → nächste freie Nummer');
  ok(JSON.stringify(normalizeAblauf(belegt)) === JSON.stringify(belegt), '@jm/show: normalizeAblauf ist idempotent');
  // Lange Kennung: Der Zusatz bleibt in 200 Zeichen, sonst verwürfe das nächste Lesen die id.
  const grenze = normalizeAblauf([
    { id: 'k'.repeat(200), label: 'a' },
    { id: 'k'.repeat(200), label: 'b' },
  ]);
  ok(grenze[1].id === 'k'.repeat(198) + '#2', '@jm/show: Zusatz #2 kürzt eine 200-Zeichen-id');
  ok(JSON.stringify(normalizeAblauf(grenze)) === JSON.stringify(grenze), '@jm/show: gekürzte id übersteht erneutes Normalisieren');

  // Wie bisher: ohne Titel fällt der Punkt weg, ohne id bekommt er keine, kein Array → [].
  const gemischt = normalizeAblauf([{ id: 'p1', label: '  ' }, null, 'x', { label: 'Ohne id' }]);
  ok(JSON.stringify(gemischt) === '[{"label":"Ohne id"}]', '@jm/show: ohne Titel weg, ohne id bleibt ohne id');
  ok(
    normalizeAblauf(undefined).length === 0 && normalizeAblauf({ ablauf: [] }).length === 0 && normalizeAblauf('x').length === 0,
    '@jm/show: kein Array → leere Liste',
  );

  // parseShow/serializeShow laufen über migrateShow → normalizeAblauf.
  const gelesen = parseShow(
    JSON.stringify({ schemaVersion: 1, name: 'Doppelt', tools: [], ablauf: [{ id: 'u1', label: 'A' }, { id: 'u1', label: 'B' }] }),
  );
  ok(JSON.stringify(gelesen.ablauf?.map((p) => p.id)) === '["u1","u1#2"]', '@jm/show: doppelte id beim Lesen aufgelöst');
  const altText = serializeShow({ ...createShow('Alt'), ablauf: [{ label: 'A', durationMs: 60_000 }] });
  ok(!altText.includes('"id"'), '@jm/show: alte Show ohne Kennungen bleibt ohne id (byte-nah)');

  // hatEigeneTimerListe: genau dann, wenn settings.timetable ein Array mit mindestens einem Objekt ist.
  ok(hatEigeneTimerListe(undefined) === false, 'hatEigeneTimerListe: keine Einstellungen → nein');
  ok(hatEigeneTimerListe({}) === false, 'hatEigeneTimerListe: ohne timetable → nein');
  ok(hatEigeneTimerListe({ timetable: [] }) === false, 'hatEigeneTimerListe: leeres Array → nein');
  ok(hatEigeneTimerListe({ timetable: [null, 3, 'x'] }) === false, 'hatEigeneTimerListe: nur Nicht-Objekte → nein');
  ok(hatEigeneTimerListe({ timetable: 'x' }) === false, 'hatEigeneTimerListe: kein Array → nein');
  ok(hatEigeneTimerListe({ timetable: [{ label: 'A', durationMs: 60_000 }] }) === true, 'hatEigeneTimerListe: Array mit einem Objekt → ja');
  ok(hatEigeneTimerListe({ timetable: [null, {}] }) === true, 'hatEigeneTimerListe: ein Objekt genügt, auch ein leeres');
}

if (failed > 0) {
  console.error(`\n${failed} FEHLGESCHLAGEN`);
```

- [ ] **Schritt 2: Test laufen lassen (rot)**

```
npm run selftest -w @jm/iveo
```
Erwartet: esbuild bricht beim Bündeln ab, der Test läuft gar nicht erst, npm meldet einen Fehler-Exitcode:
```
X [ERROR] No matching export in "../show/src/index.ts" for import "hatEigeneTimerListe"
X [ERROR] No matching export in "../show/src/index.ts" for import "normalizeAblauf"
2 errors
```

- [ ] **Schritt 3: `ShowAblaufItem` um `id` erweitern** (`packages/show/src/index.ts`, Zeilen 40–42)

Vorher:
```ts
export interface ShowAblaufItem {
  /** Segment-/Programmpunkt-Titel. */
  label: string;
```
Nachher:
```ts
export interface ShowAblaufItem {
  /**
   * Feste Kennung des Punkts (Teil 2a, #235): iveo-Programm- bzw. Agenda-Punkt-ID oder eine
   * im Show-Editor erzeugte UUID. Optional, damit alte Shows weiter laden. Bleibt über
   * Umbenennen und Umsortieren gleich — daran hängen Rundown-Aktionen und der aktive Timer-Punkt.
   */
  id?: string;
  /** Segment-/Programmpunkt-Titel. */
  label: string;
```

- [ ] **Schritt 4: `normalizeAblaufItem` übernimmt `id`** (`packages/show/src/index.ts`, Zeilen 146–151)

Vorher:
```ts
function normalizeAblaufItem(value: unknown): ShowAblaufItem | null {
  if (!value || typeof value !== 'object') return null;
  const o = value as Record<string, unknown>;
  const label = typeof o.label === 'string' ? o.label : '';
  if (!label.trim()) return null; // ohne Titel kein sinnvoller Programmpunkt
  const item: ShowAblaufItem = { label };
```
Nachher:
```ts
/** Höchstlänge einer Kennung (Spec 3.1). Längere fallen beim Lesen weg. */
const ABLAUF_ID_MAX = 200;

function normalizeAblaufItem(value: unknown): ShowAblaufItem | null {
  if (!value || typeof value !== 'object') return null;
  const o = value as Record<string, unknown>;
  const label = typeof o.label === 'string' ? o.label : '';
  if (!label.trim()) return null; // ohne Titel kein sinnvoller Programmpunkt
  // Kennung nur als String mit 1–200 Zeichen nach trim, sonst entfällt das Feld (der Punkt
  // bleibt). `id` steht vorn, damit die Serialisierung eine feste Feldreihenfolge hat.
  const id = typeof o.id === 'string' ? o.id.trim() : '';
  const item: ShowAblaufItem = id && id.length <= ABLAUF_ID_MAX ? { id, label } : { label };
```

- [ ] **Schritt 5: `freieKennung`, `normalizeAblauf` und `hatEigeneTimerListe` anlegen** (`packages/show/src/index.ts`, direkt hinter dem Ende von `normalizeAblaufItem`, Zeilen 156–158)

Vorher (eindeutig, das Ende von `normalizeAblaufItem`):
```ts
  if (typeof o.category === 'string' && o.category) item.category = o.category;
  return item;
}
```
Nachher:
```ts
  if (typeof o.category === 'string' && o.category) item.category = o.category;
  return item;
}

/** Nächste freie Kennung `<basis>#n` ab n = 2, gekürzt auf 200 Zeichen (Spec 3.5). */
function freieKennung(basis: string, belegt: Set<string>): string {
  for (let n = 2; ; n++) {
    const zusatz = `#${n}`;
    // Kürzen statt überlaufen: eine id über 200 Zeichen verwürfe das nächste Lesen,
    // und normalizeAblauf wäre nicht mehr idempotent.
    const kandidat = basis.slice(0, ABLAUF_ID_MAX - zusatz.length) + zusatz;
    if (!belegt.has(kandidat)) return kandidat;
  }
}

/**
 * Ablauf normalisieren (Teil 2a, Spec 3.1/3.5): je Punkt wie beim Lesen einer Show (ohne Titel
 * fällt er weg, `id` nur als String mit 1–200 Zeichen nach trim), danach doppelte Kennungen
 * über die ganze Liste auflösen. Der erste Punkt behält seine Kennung, jeder weitere bekommt
 * `<id>#2`, `#3` … — jeweils die nächste Nummer, die in der Liste noch frei ist. Kein Array → [].
 * `migrateShow` nutzt sie, also gilt das bei jedem `parseShow` und `serializeShow`.
 */
export function normalizeAblauf(value: unknown): ShowAblaufItem[] {
  if (!Array.isArray(value)) return [];
  const items = (value as unknown[])
    .map(normalizeAblaufItem)
    .filter((a): a is ShowAblaufItem => a !== null);
  // Alle vorhandenen Kennungen vorab als belegt, damit ein umbenannter Doppelter nie die
  // Kennung eines nachfolgenden Punkts übernimmt (z. B. X, X, X#2 → X, X#3, X#2).
  const belegt = new Set<string>();
  for (const it of items) if (it.id !== undefined) belegt.add(it.id);
  const gesehen = new Set<string>();
  return items.map((it) => {
    if (it.id === undefined) return it;
    if (!gesehen.has(it.id)) {
      gesehen.add(it.id);
      return it;
    }
    const id = freieKennung(it.id, belegt);
    belegt.add(id);
    return { ...it, id };
  });
}

/**
 * Hat die Show eine eigene Timer-Liste (Teil 2a, Spec 6.1)? Genau dann, wenn
 * `settings.timetable` ein Array mit mindestens einem Objekt ist — dieselbe Bedingung, unter
 * der der Timer (`parseTimetable`) eine Liste liefert. Dann hat sie Vorrang vor `show.ablauf`,
 * und ihre Punkte tragen keine Kennungen. Timer und Rundown nutzen beide diese Funktion.
 */
export function hatEigeneTimerListe(settings: Record<string, unknown> | undefined): boolean {
  const liste = settings?.timetable;
  return Array.isArray(liste) && liste.some((it) => Boolean(it) && typeof it === 'object');
}
```
Hinweis: `{ ...it, id }` behält die Feldreihenfolge, weil `it` die `id` schon an erster Stelle trägt (Schritt 4).

- [ ] **Schritt 6: `migrateShow` nutzt `normalizeAblauf`** (`packages/show/src/index.ts`, Zeilen 239–243)

Vorher:
```ts
  const ablauf = Array.isArray(obj.ablauf)
    ? (obj.ablauf as unknown[])
        .map(normalizeAblaufItem)
        .filter((a): a is ShowAblaufItem => a !== null)
    : [];
```
Nachher:
```ts
  // Je Punkt normalisieren + doppelte Kennungen auflösen (Teil 2a, Spec 3.5).
  const ablauf = normalizeAblauf(obj.ablauf);
```

- [ ] **Schritt 7: Test laufen lassen (grün)**

```
npm run selftest -w @jm/iveo
```
Erwartet: keine Zeile mit `FAIL`, letzte Zeile `ALLE TESTS OK`, Exitcode 0. Unter anderem:
```
ok   @jm/show: id übernommen, getrimmt, als erstes Feld
ok   @jm/show: belegte #2 → nächste freie Nummer
ok   @jm/show: doppelte id beim Lesen aufgelöst
ok   hatEigeneTimerListe: ein Objekt genügt, auch ein leeres
```
(Unter Windows erscheint nach `ALLE TESTS OK` gelegentlich `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING) … async.c` von libuv beim Prozessende. Das ist harmlos, der Exitcode bleibt 0. Beobachtet auch ohne diese Änderung.)

- [ ] **Schritt 8: Typecheck**

`@jm/show` hat kein eigenes `typecheck`-Skript (auch CI prüft es nur über die Pakete, die es importieren). Deshalb die Verbraucher, die `ShowAblaufItem` nutzen:
```
npm run typecheck -w @jm/launcher
npm run typecheck -w @jm/timer
npm run typecheck -w @jm/rundown
```
Erwartet: jeweils keine Fehlermeldung von `tsc`, Exitcode 0. (Gegen den Planstand vorab geprüft: Launcher, Timer und Rundown typechecken mit dieser Fassung von `packages/show/src/index.ts` fehlerfrei.)

- [ ] **Schritt 9: Commit** (im Bash-Werkzeug / Git Bash; Commit-Text bewusst ohne Umlaute)

```
git add packages/show/src/index.ts packages/iveo/test/selftest.ts
git status --short
```
Erwartet genau:
```
M  packages/iveo/test/selftest.ts
M  packages/show/src/index.ts
```
(Die Bündeldatei `packages/iveo/test/selftest.bundle.mjs` ist per `packages/iveo/.gitignore` ausgeschlossen und erscheint nicht.) Dann:
```
git commit -m "feat(show): feste Kennung am Ablaufpunkt, normalizeAblauf und hatEigeneTimerListe (Teil 2a, #235)" -m "ShowAblaufItem bekommt id (String, 1-200 Zeichen nach trim, als erstes Feld). normalizeAblauf loest doppelte Kennungen auf (#2, #3, naechste freie Nummer), migrateShow nutzt sie, also gilt das bei jedem parseShow und serializeShow. hatEigeneTimerListe ist die gemeinsame Pruefung fuer Timer und Rundown, ob settings.timetable Vorrang vor show.ablauf hat." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
- Ergänzung, keine Änderung der Schnittstelle: Beim Auflösen doppelter Kennungen wird die Basis gekürzt, wenn `<id>#n` sonst länger als 200 Zeichen würde (`freieKennung`). Ohne das verwürfe das nächste `parseShow` eine so entstandene Kennung (Regel „1–200 Zeichen“), und `normalizeAblauf` wäre nicht idempotent. Der Test „gekürzte id übersteht erneutes Normalisieren“ hält das fest.
- Die Funktion `freieKennung` und die Konstante `ABLAUF_ID_MAX` sind modulintern (nicht exportiert).

---

### Aufgabe A2: `@jm/iveo` — Kennungen in den Umwandlern + Kennungs-Durchlauf

**Spec:** `docs/superpowers/specs/2026-10-01-master-link-teil2a-design.md` Abschnitte 3.2 (Woher die Kennung kommt: iveo-Zeilen), 3.3 Zeilen S4 und S5, 3.5 („In der Show“), 9.3 (Kennungs-Durchlauf, `@jm/iveo`-Teil).

**Arbeitsverzeichnis:** `C:\Users\alexk\alexzvn\.claude\worktrees\suite-sofort-fixes` (Branch `feat/master-link-teil2a`). Alle Pfade unten relativ dazu.

**Dateien:**
- Modify: `packages/iveo/src/mapper.ts`
  - Zeile 4 (Kopfkommentar, Zielform)
  - Zeilen 131–133 (Kopf von `programToAblaufItem`), davor neu `kennungVon`
  - Zeilen 181–182 (Punktbau in `agendaToAblauf`)
- Test: `packages/iveo/test/selftest.ts` — neuer Block direkt vor `if (failed > 0) {` (nach A1 etwa Zeile 518).

Zeilenangaben in `mapper.ts` gelten für den Stand vor dieser Aufgabe (A1 ändert `mapper.ts` nicht). Nach früheren Schritten verschieben sie sich; maßgeblich ist immer der wortgleiche Vorher-Text.

Testhilfen im iveo-Selbsttest (alle schon definiert, vor der Einfügestelle): `ok(cond, msg)`, `prog(over: Partial<IveoProgram>)` (Programm-Fixture mit Vorgabe `id: 'p'`), `snapshot` (Programme `p2`, `p1`, `p3`), `mkRes(status, body, headers?)` (nachgebaute fetch-Antwort). Importiert sind bereits `IveoClient`, `IveoFetchLike`, `agendaToAblauf`, `programsToAblauf`, `programToAblaufItem`, `snapshotToAblauf` (aus `../src/index`) und nach A1 `createShow`, `hatEigeneTimerListe`, `normalizeAblauf`, `parseShow`, `serializeShow` (aus `@jm/show`). Das Testskript ist ein ES-Modul mit Top-Level-`await`.

**Schnittstellen:**
- Consumes (aus A1, `@jm/show`):
  ```ts
  export interface ShowAblaufItem { id?: string; label: string; durationMs?: number; note?: string; plannedStartMs?: number; owner?: string; category?: string }
  export function normalizeAblauf(value: unknown): ShowAblaufItem[]; // je Punkt normalisiert (id 1–200 Zeichen nach trim, vorn), doppelte id → <id>#2, #3 …
  // parseShow/serializeShow laufen über migrateShow → normalizeAblauf
  ```
- Produces (Signaturen unverändert, nur Verhalten neu):
  - `programToAblaufItem(p, opts)` setzt `id` = `p.id` (wenn String und nach trim nicht leer; getrimmt), `id` als erstes Feld. Damit tragen auch `programsToAblauf`, `snapshotToAblauf` und der 1-Punkt-Ablauf eines Side Events ohne Agenda die Programm-ID.
  - `agendaToAblauf(items, opts)` setzt `id` = `it.id` (gleiche Regel), `id` als erstes Feld.
  - Ohne brauchbare iveo-ID: kein `id`-Feld (nie ein leerer String).

**Regeln für diese Aufgabe:**
- Nicht anfassen: `packages/master-link`, `packages/app-runtime`, `packages/suite-control-protocol`, `apps/titler`, Companion-Module. Den Launcher (`apps/launcher/src/main/iveo-sync.ts`) NICHT ändern — er nutzt die Umwandler und bekommt die Kennungen dadurch automatisch (Spec 3.3 S5); seine Signatur/Schreiblogik baut A13.
- TDD: erst den Test rot sehen, dann Code.
- Dateien im Arbeitsbaum haben CRLF-Zeilenenden (`core.autocrlf=true`). Änderungen mit dem Edit-Werkzeug machen, nicht mit `sed`.
- Kein bare `git stash`, kein `git reset --hard`, kein `git clean`, kein Branch-Wechsel, nie pushen.

---

- [ ] **Schritt 1: Fehlschlagenden Test schreiben** (`packages/iveo/test/selftest.ts`)

Vorher (eindeutig; steht nach A1 direkt hinter dem Block „@jm/show: Kennung am Ablaufpunkt …“):
```ts
if (failed > 0) {
  console.error(`\n${failed} FEHLGESCHLAGEN`);
```
Nachher:
```ts
// ── Kennungs-Durchlauf (Teil 2a, Spec 3.2/9.3): iveo-Antwort → Umwandler → Show → Lesen ──
{
  // Nachgebaute iveo-Antworten: Agenda eines Side Events (absichtlich unsortiert) und Programmliste.
  const agendaAntwort = [
    { id: 'ag-2', program_id: 'se1', sort_order: 1, title: 'Panel', duration_minutes: 45, notes: 'Bühne' },
    { id: 'ag-1', program_id: 'se1', sort_order: 0, title: 'Begrüßung', duration_minutes: 10 },
    { id: 'ag-3', program_id: 'se1', sort_order: 2, title: 'Q&A' },
  ];
  const programmAntwort = [
    prog({ id: 'p-b', title: 'Zweitens', starts_at: '2026-11-12T12:00:00+00:00', duration_minutes: 30 }),
    prog({ id: 'p-a', title: 'Erstens', starts_at: '2026-11-12T09:00:00+00:00', duration_minutes: 60 }),
  ];
  const seite = (data: unknown) => mkRes(200, { data, meta: { request_id: 'r', pagination: { next_cursor: null, limit: 200 } } });
  const fetchImpl: IveoFetchLike = async (url) => (url.includes('/agenda-items') ? seite(agendaAntwort) : seite(programmAntwort));
  const client = new IveoClient({ token: 'iveo_live_SECRET', fetchImpl });

  // Agenda-Modus: Kennung = iveo-Agenda-Punkt-ID, als erstes Feld.
  const agenda = agendaToAblauf(await client.listAgendaItems('cop30', 'se1'));
  ok(JSON.stringify(agenda.map((a) => a.id)) === '["ag-1","ag-2","ag-3"]', 'Kennungen: agendaToAblauf setzt die Agenda-Punkt-ID');
  ok(agenda.every((a) => Object.keys(a)[0] === 'id'), 'Kennungen: id steht im Agenda-Punkt vorn');

  // Listen-Modus: Kennung = iveo-Programm-ID, auch nach dem Sortieren nach Startzeit.
  const liste = programsToAblauf(await client.listPrograms('cop30'));
  ok(JSON.stringify(liste.map((a) => a.id)) === '["p-a","p-b"]', 'Kennungen: programsToAblauf setzt die Programm-ID');
  ok(liste.every((a) => Object.keys(a)[0] === 'id'), 'Kennungen: id steht im Programm-Punkt vorn');
  ok(snapshotToAblauf(snapshot).map((a) => a.id).join(',') === 'p1,p2,p3', 'Kennungen: snapshotToAblauf trägt die Programm-IDs');

  // Side Event ohne Agenda → 1 Punkt mit der Programm-ID (wie Binden/Abfrage/Umschalten ihn bauen).
  const einzeln = programToAblaufItem(prog({ id: 'se1', title: 'Side Event' }), { withSchedule: true });
  ok(einzeln.id === 'se1' && einzeln.label === 'Side Event', 'Kennungen: 1-Punkt-Ablauf trägt die Programm-ID');
  // Fremddaten ohne brauchbare ID → Punkt ohne id statt leerer Kennung.
  ok(!('id' in programToAblaufItem(prog({ id: '   ' }))), 'Kennungen: Programm mit leerer ID → kein id-Feld');
  ok(
    !('id' in agendaToAblauf([{ id: '', program_id: 'se1', title: 'Ohne ID' }])[0]),
    'Kennungen: Agenda-Punkt mit leerer ID → kein id-Feld',
  );

  // Umwandler-Ausgabe ist ein Fixpunkt von normalizeAblauf (Signatur im Launcher, Spec 7.2).
  ok(JSON.stringify(normalizeAblauf(agenda)) === JSON.stringify(agenda), 'Kennungen: normalizeAblauf lässt die Agenda unverändert');

  // Show schreiben und lesen: Kennungen und Feldreihenfolge überstehen den Round-Trip.
  const show = {
    ...createShow('Kennungen'),
    ablauf: normalizeAblauf(agenda),
    iveo: { event: 'cop30', filter: { programId: 'se1' } },
  };
  const gelesen = parseShow(serializeShow(show));
  ok(
    JSON.stringify(gelesen.ablauf?.map((a) => a.id)) === '["ag-1","ag-2","ag-3"]' &&
      JSON.stringify(gelesen.ablauf) === JSON.stringify(agenda),
    'Kennungs-Durchlauf: iveo-IDs überstehen Schreiben und Lesen',
  );

  // Doppelte Kennung aus iveo (darf nicht vorkommen, wird trotzdem aufgefangen) → #2.
  const doppelt = agendaToAblauf([
    { id: 'ag-x', program_id: 'se1', sort_order: 0, title: 'A' },
    { id: 'ag-x', program_id: 'se1', sort_order: 1, title: 'B' },
  ]);
  ok(
    JSON.stringify(normalizeAblauf(doppelt).map((a) => a.id)) === '["ag-x","ag-x#2"]',
    'Kennungs-Durchlauf: doppelte iveo-ID → normalizeAblauf vergibt #2',
  );
  // Von Hand verdoppelte Kennung in der Datei → beim Lesen aufgelöst.
  const roh = JSON.stringify({ schemaVersion: 1, name: 'Kopie', tools: [], ablauf: [...agenda, { ...agenda[0], label: 'Begrüßung (Kopie)' }] });
  ok(
    JSON.stringify(parseShow(roh).ablauf?.map((a) => a.id)) === '["ag-1","ag-2","ag-3","ag-1#2"]',
    'Kennungs-Durchlauf: doppelte id in der Datei → beim Lesen #2',
  );
}

if (failed > 0) {
  console.error(`\n${failed} FEHLGESCHLAGEN`);
```

- [ ] **Schritt 2: Test laufen lassen (rot)**

```
npm run selftest -w @jm/iveo
```
Erwartet: das Bündeln gelingt, der Lauf endet mit Exitcode 1 und genau diesen Fehlschlägen (alle übrigen Zeilen `ok`):
```
FAIL Kennungen: agendaToAblauf setzt die Agenda-Punkt-ID
FAIL Kennungen: id steht im Agenda-Punkt vorn
FAIL Kennungen: programsToAblauf setzt die Programm-ID
FAIL Kennungen: id steht im Programm-Punkt vorn
FAIL Kennungen: snapshotToAblauf trägt die Programm-IDs
FAIL Kennungen: 1-Punkt-Ablauf trägt die Programm-ID
FAIL Kennungs-Durchlauf: iveo-IDs überstehen Schreiben und Lesen
FAIL Kennungs-Durchlauf: doppelte iveo-ID → normalizeAblauf vergibt #2
FAIL Kennungs-Durchlauf: doppelte id in der Datei → beim Lesen #2

9 FEHLGESCHLAGEN
```
(Die zwei Fälle „… mit leerer ID → kein id-Feld“ und „normalizeAblauf lässt die Agenda unverändert“ sind schon jetzt grün; sie sichern ab, dass die Änderung keine leeren Kennungen erzeugt.)

- [ ] **Schritt 3: Kopfkommentar der Zielform anpassen** (`packages/iveo/src/mapper.ts`, Zeile 4)

Vorher:
```ts
// Zielform ist der zentrale Show-Ablauf `ShowAblaufItem {label, durationMs?, note?}`
```
Nachher:
```ts
// Zielform ist der zentrale Show-Ablauf `ShowAblaufItem {id?, label, durationMs?, note?}`
```

- [ ] **Schritt 4: `kennungVon` anlegen und `programToAblaufItem` setzt die Programm-ID** (`packages/iveo/src/mapper.ts`, Zeilen 131–133)

Vorher:
```ts
/** Ein Programm → ein Ablauf-Punkt. */
export function programToAblaufItem(p: IveoProgram, opts: ProgramMapOptions = {}): ShowAblaufItem {
  const item: ShowAblaufItem = { label: p.title?.trim() || '(ohne Titel)' };
```
Nachher:
```ts
/**
 * iveo-ID als Kennung eines Ablaufpunkts (Teil 2a, Spec 3.2): nur ein String, der nach trim
 * nicht leer ist — sonst keine Kennung (der Punkt bekommt dann kein `id`-Feld).
 */
function kennungVon(raw: unknown): string | undefined {
  const id = typeof raw === 'string' ? raw.trim() : '';
  return id || undefined;
}

/**
 * Ein Programm → ein Ablauf-Punkt. Kennung ist die iveo-Programm-ID (eventweit eindeutig,
 * bleibt über Umbenennen und Umsortieren gleich). `id` steht vorn: feste Feldreihenfolge
 * für eine stabile Serialisierung und Signatur.
 */
export function programToAblaufItem(p: IveoProgram, opts: ProgramMapOptions = {}): ShowAblaufItem {
  const label = p.title?.trim() || '(ohne Titel)';
  const id = kennungVon(p.id);
  const item: ShowAblaufItem = id ? { id, label } : { label };
```
Der Rest der Funktion (Dauer, Notiz, `withSchedule`) bleibt unverändert.

- [ ] **Schritt 5: `agendaToAblauf` setzt die Agenda-Punkt-ID** (`packages/iveo/src/mapper.ts`, Zeilen 181–182)

Vorher:
```ts
    .map((it, idx) => {
      const item: ShowAblaufItem = { label: it.title?.trim() || '(ohne Titel)' };
```
Nachher:
```ts
    .map((it, idx) => {
      // Kennung = iveo-Agenda-Punkt-ID (Teil 2a, Spec 3.2), vorn im Objekt.
      const label = it.title?.trim() || '(ohne Titel)';
      const id = kennungVon(it.id);
      const item: ShowAblaufItem = id ? { id, label } : { label };
```

- [ ] **Schritt 6: Test laufen lassen (grün)**

```
npm run selftest -w @jm/iveo
```
Erwartet: keine Zeile mit `FAIL`, letzte Zeile `ALLE TESTS OK`, Exitcode 0. Die bestehenden Fälle (`programsToAblauf: nach starts_at sortiert`, `agendaToAblauf: nach sort_order`, `programToAblaufItem: ohne Options unverändert (Regression)`, `@jm/show: materialisierter Ablauf übersteht Round-Trip` usw.) bleiben grün. (Unter Windows erscheint nach `ALLE TESTS OK` gelegentlich eine libuv-Zeile `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)`; harmlos, Exitcode bleibt 0.)

- [ ] **Schritt 7: Typecheck**

`@jm/iveo` hat kein eigenes `typecheck`-Skript; einziger Verbraucher ist der Launcher:
```
npm run typecheck -w @jm/launcher
```
Erwartet: keine Fehlermeldung von `tsc`, Exitcode 0. (Gegen den Planstand vorab geprüft.)

- [ ] **Schritt 8: Commit** (im Bash-Werkzeug / Git Bash; Commit-Text bewusst ohne Umlaute)

```
git add packages/iveo/src/mapper.ts packages/iveo/test/selftest.ts
git status --short
```
Erwartet genau:
```
M  packages/iveo/src/mapper.ts
M  packages/iveo/test/selftest.ts
```
Dann:
```
git commit -m "feat(iveo): Umwandler behalten die iveo-IDs als Kennung (Teil 2a, #235)" -m "programToAblaufItem setzt id = Programm-ID, agendaToAblauf setzt id = Agenda-Punkt-ID, jeweils als erstes Feld und nur, wenn die ID ein nicht leerer String ist. Damit tragen Listen-Modus, Agenda-Modus und der 1-Punkt-Ablauf feste Kennungen. Selbsttest: Kennungs-Durchlauf iveo-Antwort, Umwandler, normalizeAblauf, Show schreiben und lesen; doppelte Kennungen werden beim Lesen zu #2." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Hinweis zum Zwischenstand (kein Handlungsbedarf in dieser Aufgabe):** Bis A13 vergleicht der Launcher weiter `JSON.stringify(ablauf)` (`apps/launcher/src/main/iveo-sync.ts:639`, `:856`). Weil Abfrage und Umschalten dieselben Umwandler nutzen, enthalten beide Seiten die Kennung gleich; es entstehen keine zusätzlichen Schein-Änderungen außer der einmaligen, in Spec 7.2 („Bestands-Shows ohne Kennungen“) gewollten Nachschrift der Kennungen.

**Abweichungen vom Gerüst:**
- Die iveo-ID wird vor dem Setzen getrimmt (`kennungVon`), das Gerüst sagt „`id: p.id` (wenn String, nicht leer)“. Grund: So ist die Umwandler-Ausgabe ein Fixpunkt von `normalizeAblauf` (das ebenfalls trimmt); die Launcher-Signatur (A13, Spec 7.2) sieht dann im Speicher und in der gelesenen Datei dieselbe Kennung. Echte iveo-IDs sind UUIDs, für sie ändert sich nichts. Abgesichert durch den Test „normalizeAblauf lässt die Agenda unverändert“.
- Neue modulinterne Hilfsfunktion `kennungVon` (nicht exportiert).

---

### Aufgabe A3: Timer — Ablauf-Modul, Kennung, aktiver Punkt über die Kennung

**Spec:** `docs/superpowers/specs/2026-10-01-master-link-teil2a-design.md` Abschnitte 3.3 Zeilen S7 und S8, 3.6 (Zeilen „altes Tool“ und „neuer Timer“), 6.1 (Timer), 8 (Zeile Timer), 9.3 (Timer-Teil), 9.4 (Timer-Tests), 12 („Handänderungen im Timer“, „Eigene Timer-Liste“, „Show öffnen … `tt:setAll`“).

**Arbeitsverzeichnis:** `C:\Users\alexk\alexzvn\.claude\worktrees\suite-sofort-fixes` (Branch `feat/master-link-teil2a`). Alle Pfade unten relativ dazu.

**Dateien:**
- Create: `apps/timer/src/shared/show-ablauf.ts`
- Modify: `apps/timer/src/shared/timer-state.ts`
  - hinter Zeile 35 (Ende `TimetableItem`): neuer Typ `TimetableEingang`
  - Zeilen 98–99 (`Command`: `tt:setAll`, `tt:replaceItems`)
  - hinter Zeile 116 (Ende `makeId`): neu `kennungVerwertbar`, `mitKennungen`
  - Zeilen 259–263 (`case 'tt:setAll'`)
  - Zeilen 272–280 (`case 'tt:replaceItems'`)
  - vor Zeile 352 (`effectiveDurationMs`): neu `aktiverPunktVerschwunden`
- Modify: `apps/timer/src/main/index.ts`
  - Zeilen 16–19 (Importe)
  - Zeilen 296–323 (`parseTimetable`, `ablaufToTimetable` → entfernt, ziehen nach `show-ablauf.ts`)
  - Zeilen 350–354 (`applyShowFromPath`: Auswahl der Liste, `dispatch`, Logzeile)
- Test: `apps/timer/test/selftest.ts`
  - Zeilen 3–11 (Importe)
  - neue Blöcke direkt vor Zeile 73 (`console.log(`\n${pass} passed, ${fail} failed`);`)

Zeilenangaben gelten für den Stand vor dieser Aufgabe (A1/A2 ändern keine Timer-Datei). Nach früheren Schritten verschieben sie sich; maßgeblich ist immer der wortgleiche Vorher-Text.

**Testlauf:** `npm run selftest -w @jm/timer` = `node --experimental-strip-types test/selftest.ts`. Keine Pfad-Aliase, Importe im Test mit `.ts`-Endung und relativen Pfaden (wie der bestehende Import `../../../packages/app-runtime/src/csp.ts`). Testhilfen im Timer-Selbsttest: `ck(name: string, cond: boolean)`, Konstanten `H = 3_600_000`, `MIN = 60_000`, `item(id, durMin, plannedStartMs?)` → `TimetableItem` mit `label = id`, `tt(items, activeIndex)` → `TimetableState`.

**Wer `tt:setAll` / `tt:replaceItems` aufruft (geprüft, die neue Kennungsregel bricht keinen):**
- `tt:setAll`: Timer-Main `applyShowFromPath` (Modus `initial`, `apps/timer/src/main/index.ts:353`) und der XLSX-Import im Renderer (`apps/timer/src/renderer/src/components/XlsxImport.tsx:75` → `store/timer.ts:79` `ttSetAll` → Socket.IO `cmd` → `apps/timer/src/main/server.ts:148-150` `dispatch`). Die XLSX-Zeilen sind `@jm/regieplan`-`ParsedRow` ohne `id` → wie bisher `makeId()`.
- `tt:replaceItems`: nur Timer-Main `applyShowFromPath` (Modus `reload`).
- Socket `:7777` nimmt jedes `cmd` jedes verbundenen Clients an (Loopback immer, LAN mit Token, falls eingeschaltet). Im Repo sendet nur der Timer-Renderer selbst (`apps/timer/src/renderer/src/sync/client.ts:65`), auch in der Remote-Ansicht. Heute gewinnt wegen `{ id: makeId(), ...it }` eine mitgeschickte `id` immer, auch eine doppelte oder eine Zahl. Die neue Regel (Spec 6.1) ist strenger und schließt das: nur nicht leere Strings, die in der Liste noch frei sind.
- Gespeicherter Zustand (`apps/timer/src/main/state.ts`, `state.json`) und `tt:add` bleiben unberührt. Der Renderer-Typ `ttSetAll: (items: Array<Omit<TimetableItem, 'id'>>) => void` passt weiter, weil er sich `TimetableEingang[]` zuweisen lässt; er wird nicht geändert.

**Schnittstellen:**
- Consumes:
  - aus A1 (`@jm/show`):
    ```ts
    export interface ShowAblaufItem { id?: string; label: string; durationMs?: number; note?: string; plannedStartMs?: number; owner?: string; category?: string }
    export function normalizeAblauf(value: unknown): ShowAblaufItem[];
    export function hatEigeneTimerListe(settings: Record<string, unknown> | undefined): boolean;
    // parseShow / serializeShow / createShow wie bisher, laufen über normalizeAblauf
    ```
  - aus A2 (`packages/iveo/src/mapper.ts`): `agendaToAblauf(items, opts?)` setzt `id` = Agenda-Punkt-ID als erstes Feld (nur im Test genutzt, Kennungs-Durchlauf 9.3).
- Produces:
  ```ts
  // apps/timer/src/shared/timer-state.ts
  export type TimetableEingang = Omit<TimetableItem, 'id'> & { id?: string };
  // Command: { type: 'tt:setAll'; items: TimetableEingang[] } | { type: 'tt:replaceItems'; items: TimetableEingang[] }
  // id-Regel (setAll + replaceItems): mitgegebene id, wenn nicht leerer String (nur Leerzeichen = leer)
  //   und in dieser Liste noch nicht vergeben, sonst makeId().
  // tt:replaceItems: aktiver Punkt über id; fehlt er, heutiges Verhalten (Nummer halten, geklemmt);
  //   Countdown unangetastet.
  export function aktiverPunktVerschwunden(vorher: TimetableState, nachher: TimetableState, eingang?: TimetableEingang[]): boolean;

  // apps/timer/src/shared/show-ablauf.ts (aus index.ts verschoben)
  export type { TimetableEingang };                       // Re-Export aus ./timer-state
  export function parseTimetable(raw: unknown): TimetableEingang[] | null;   // Verhalten unverändert, ohne id
  export function ablaufToTimetable(ablauf: ShowAblaufItem[] | undefined): TimetableEingang[] | null; // gibt id mit
  ```
  Logzeile im Main nach `tt:replaceItems`, wenn `aktiverPunktVerschwunden(...)`: „Aktiver Punkt im neuen Ablauf nicht mehr vorhanden, Nummer gehalten“.

**Regeln für diese Aufgabe:**
- G3: `show-ablauf.ts` importiert aus `@jm/show` und `./timer-state` NUR mit `import type` (der Selbsttest löst keine Aliase auf, Typ-Importe fallen beim Stripping weg). `hatEigeneTimerListe` wird im Timer-Main aus `@jm/show` aufgerufen, nicht im shared-Modul.
- Nicht anfassen: `packages/master-link`, `packages/app-runtime`, `packages/suite-control-protocol`, `apps/titler`, Companion-Module, `apps/timer/src/main/control-server.ts` (RELOAD-Verb bleibt, wie es ist).
- TDD: erst den Test rot sehen, dann Code.
- Dateien im Arbeitsbaum haben CRLF-Zeilenenden (`core.autocrlf=true`). Änderungen mit dem Edit-Werkzeug machen, nicht mit `sed`.
- Kein bare `git stash`, kein `git reset --hard`, kein `git clean`, kein Branch-Wechsel, nie pushen.

---

## Zyklus 1: Ablauf-Modul `show-ablauf.ts`

- [ ] **Schritt 1: Fehlschlagenden Test schreiben** (`apps/timer/test/selftest.ts`)

Ersetzung 1 (Zeilen 10–11), Vorher:
```ts
} from '../src/shared/timer-state.ts';
import { buildCsp } from '../../../packages/app-runtime/src/csp.ts';
```
Nachher:
```ts
} from '../src/shared/timer-state.ts';
import { ablaufToTimetable, parseTimetable } from '../src/shared/show-ablauf.ts';
import { hatEigeneTimerListe } from '../../../packages/show/src/index.ts';
import { buildCsp } from '../../../packages/app-runtime/src/csp.ts';
```

Ersetzung 2 (Zeilen 73–74), Vorher:
```ts
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```
Nachher:
```ts
// ── Teil 2a: Show-Ablauf → Timer-Punkte (Spec 6.1, src/shared/show-ablauf.ts) ──
{
  const punkte = ablaufToTimetable([
    { id: 'ag-1', label: 'Begrüßung', durationMs: 10 * MIN, plannedStartMs: 9 * H, category: 'panel' },
    { label: 'Ohne Kennung', note: 'Notiz', owner: 'Ada' },
  ]);
  ck('ablaufToTimetable: gibt die Kennung mit', punkte?.[0].id === 'ag-1');
  ck(
    'ablaufToTimetable: id vorn, übrige Felder wie bisher',
    JSON.stringify(punkte?.[0]) ===
      JSON.stringify({ id: 'ag-1', label: 'Begrüßung', durationMs: 10 * MIN, plannedStartMs: 9 * H, category: 'panel' }),
  );
  ck(
    'ablaufToTimetable: ohne Kennung kein id-Feld',
    !!punkte && !('id' in punkte[1]) && punkte[1].durationMs === 0 && punkte[1].note === 'Notiz' && punkte[1].owner === 'Ada',
  );
  ck('ablaufToTimetable: leer/fehlend → null', ablaufToTimetable([]) === null && ablaufToTimetable(undefined) === null);

  // parseTimetable unverändert: drei Felder, keine Kennung (eigene Timer-Liste hat keine, Spec 12).
  ck(
    'parseTimetable: übernimmt label/durationMs/note, verwirft id',
    JSON.stringify(parseTimetable([{ id: 'x', label: 'A', durationMs: 5 * MIN, note: 'n', owner: 'o' }, null, { durationMs: -1 }])) ===
      JSON.stringify([{ label: 'A', durationMs: 5 * MIN, note: 'n' }, { label: '', durationMs: 0 }]),
  );
  ck(
    'parseTimetable: kein Array / nur Nicht-Objekte → null',
    parseTimetable('x') === null && parseTimetable([1, 'a', null]) === null && parseTimetable([]) === null,
  );

  // hatEigeneTimerListe (@jm/show) ist genau die Bedingung, unter der parseTimetable eine Liste liefert.
  const proben: unknown[] = [undefined, null, 'x', 3, {}, [], [null], [1, 'a'], [{}], [null, { label: 'A' }], [[]], [{ label: 'A', durationMs: 1 }]];
  ck(
    'hatEigeneTimerListe ⇔ parseTimetable liefert eine Liste',
    proben.every((raw) => hatEigeneTimerListe({ timetable: raw }) === (parseTimetable(raw) !== null)),
  );
  ck('hatEigeneTimerListe: ohne Einstellungen → nein', hatEigeneTimerListe(undefined) === false);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

- [ ] **Schritt 2: Test laufen lassen (rot)**

```
npm run selftest -w @jm/timer
```
Erwartet: Abbruch beim Laden, Exitcode 1:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…\apps\timer\src\shared\show-ablauf.ts' imported from …\apps\timer\test\selftest.ts
```

- [ ] **Schritt 3: Typ `TimetableEingang` anlegen** (`apps/timer/src/shared/timer-state.ts`, Zeilen 33–37)

Vorher:
```ts
  /** Kategorie (freier Text). Optional. */
  category?: string;
}

export interface TimetableState {
```
Nachher:
```ts
  /** Kategorie (freier Text). Optional. */
  category?: string;
}

/**
 * Ein Punkt, wie er in `tt:setAll`/`tt:replaceItems` hereinkommt (Teil 2a, Spec 6.1): wie ein
 * `TimetableItem`, aber `id` optional — die Kennung des Show-Ablaufpunkts, wenn es eine gibt.
 * Ob sie übernommen wird, entscheidet der Reducer (`reduce`), nicht der Absender.
 */
export type TimetableEingang = Omit<TimetableItem, 'id'> & { id?: string };

export interface TimetableState {
```

- [ ] **Schritt 4: `apps/timer/src/shared/show-ablauf.ts` neu anlegen** (ganzer Inhalt)

```ts
/**
 * Show → Timer-Punkte (Teil 2a, Spec 6.1). Aus `src/main/index.ts` hierher gezogen, damit der
 * Selbsttest es ohne Electron laden kann (`node --experimental-strip-types`).
 *
 * Regel (G3): aus `@jm/show` und `./timer-state` NUR Typen importieren — die fallen beim
 * Type-Stripping weg, Laufzeit-Importe würde der Selbsttest nicht auflösen (keine Pfad-Aliase).
 * `hatEigeneTimerListe` ruft deshalb der Main direkt aus `@jm/show` auf, nicht dieses Modul.
 */
import type { ShowAblaufItem } from '@jm/show';
import type { TimetableEingang } from './timer-state';

export type { TimetableEingang };

/**
 * Liest einen Ablaufplan aus den (untrusted) Show-Settings — defensiv. Verhalten unverändert:
 * nur label/durationMs/note, KEINE Kennung — eine eigene Timer-Liste hat keine (Spec 12) und
 * hält beim RELOAD über die Nummer.
 */
export function parseTimetable(raw: unknown): TimetableEingang[] | null {
  if (!Array.isArray(raw)) return null;
  const items = raw
    .filter((it): it is Record<string, unknown> => Boolean(it) && typeof it === 'object')
    .map((it) => ({
      label: typeof it.label === 'string' ? it.label : '',
      durationMs:
        typeof it.durationMs === 'number' && it.durationMs >= 0 ? it.durationMs : 0,
      ...(typeof it.note === 'string' ? { note: it.note } : {}),
    }));
  return items.length ? items : null;
}

/**
 * Zentralen Show-Ablauf (#78) in Timetable-Punkte überführen (gleiche Form). Gibt die Kennung
 * des Ablaufpunkts mit (Teil 2a), damit der Timer beim RELOAD seinen aktiven Punkt über die
 * Kennung hält statt über die Nummer. Ohne Kennung kein `id`-Feld — dann vergibt der Timer eine.
 */
export function ablaufToTimetable(ablauf: ShowAblaufItem[] | undefined): TimetableEingang[] | null {
  if (!ablauf || !ablauf.length) return null;
  return ablauf.map((a) => ({
    ...(a.id ? { id: a.id } : {}),
    label: a.label,
    durationMs: typeof a.durationMs === 'number' && a.durationMs > 0 ? a.durationMs : 0,
    ...(a.note ? { note: a.note } : {}),
    ...(typeof a.plannedStartMs === 'number' ? { plannedStartMs: a.plannedStartMs } : {}),
    ...(a.owner ? { owner: a.owner } : {}),
    ...(a.category ? { category: a.category } : {}),
  }));
}
```

- [ ] **Schritt 5: Test laufen lassen (grün)**

```
npm run selftest -w @jm/timer
```
Erwartet: Exitcode 0, die acht neuen Zeilen grün, Schlusszeile `20 passed, 0 failed` (12 bisherige + 8 neue):
```
  ok  ablaufToTimetable: gibt die Kennung mit
  ok  ablaufToTimetable: id vorn, übrige Felder wie bisher
  ok  ablaufToTimetable: ohne Kennung kein id-Feld
  ok  ablaufToTimetable: leer/fehlend → null
  ok  parseTimetable: übernimmt label/durationMs/note, verwirft id
  ok  parseTimetable: kein Array / nur Nicht-Objekte → null
  ok  hatEigeneTimerListe ⇔ parseTimetable liefert eine Liste
  ok  hatEigeneTimerListe: ohne Einstellungen → nein

20 passed, 0 failed
```

## Zyklus 2: Kennungsregel und aktiver Punkt im Reducer

- [ ] **Schritt 6: Fehlschlagenden Test schreiben** (`apps/timer/test/selftest.ts`)

Ersetzung 1 (Importe, Stand nach Schritt 1, Zeilen 3–12), Vorher:
```ts
import {
  computePlannedSchedule,
  computeDrift,
  midnightMsLocal,
  type TimetableItem,
  type TimetableState,
  type CountdownState,
} from '../src/shared/timer-state.ts';
import { ablaufToTimetable, parseTimetable } from '../src/shared/show-ablauf.ts';
import { hatEigeneTimerListe } from '../../../packages/show/src/index.ts';
```
Nachher:
```ts
import {
  computePlannedSchedule,
  computeDrift,
  midnightMsLocal,
  reduce,
  INITIAL_STATE,
  aktiverPunktVerschwunden,
  type TimetableItem,
  type TimetableState,
  type CountdownState,
  type SyncedState,
} from '../src/shared/timer-state.ts';
import { ablaufToTimetable, parseTimetable } from '../src/shared/show-ablauf.ts';
import { createShow, hatEigeneTimerListe, normalizeAblauf, parseShow, serializeShow } from '../../../packages/show/src/index.ts';
import { agendaToAblauf } from '../../../packages/iveo/src/mapper.ts';
```
(`packages/iveo/src/mapper.ts` und `packages/show/src/index.ts` haben nur Typ-Importe bzw. gar keine Importe und laden deshalb unter `--experimental-strip-types` direkt; vorab so ausgeführt.)

Ersetzung 2, Vorher (eindeutig, Schluss der Datei):
```ts
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```
Nachher:
```ts
// ── Teil 2a: Kennungen im Timer-Zustand (Spec 6.1, 9.4) ─────────────────────
const laufend: CountdownState = { durationMs: 10 * MIN, delayMs: 0, startedAtMs: 1_000_000, pausedRemainingMs: null };
function zustand(items: TimetableItem[], activeIndex: number | null): SyncedState {
  return { ...INITIAL_STATE, countdown: laufend, timetable: tt(items, activeIndex) };
}
const kennungen = (s: SyncedState): string => JSON.stringify(s.timetable.items.map((i) => i.id));

{
  // Einschub vor dem aktiven Punkt: activeIndex folgt der Kennung, der Countdown bleibt.
  const vorher = zustand([item('u1', 5), item('u2', 10), item('u3', 5)], 1);
  const eingang = [
    { id: 'u1', label: 'Begrüßung', durationMs: 5 * MIN },
    { id: 'neu', label: 'Einschub', durationMs: 3 * MIN },
    { id: 'u2', label: 'Panel', durationMs: 10 * MIN },
    { id: 'u3', label: 'Q&A', durationMs: 5 * MIN },
  ];
  const nachher = reduce(vorher, { type: 'tt:replaceItems', items: eingang });
  ck('replaceItems: mitgegebene Kennungen übernommen', kennungen(nachher) === '["u1","neu","u2","u3"]');
  ck('replaceItems: aktiver Punkt folgt seiner Kennung (Einschub davor)', nachher.timetable.activeIndex === 2);
  ck('replaceItems: Countdown bleibt unangetastet', nachher.countdown === vorher.countdown);
  ck('replaceItems: Kennung gefunden → keine Logzeile', !aktiverPunktVerschwunden(vorher.timetable, nachher.timetable, eingang));
}
{
  // Umsortieren: der aktive Punkt wandert nach vorn, die Markierung mit ihm.
  const vorher = zustand([item('u1', 5), item('u2', 10), item('u3', 5)], 1);
  const nachher = reduce(vorher, {
    type: 'tt:replaceItems',
    items: [
      { id: 'u2', label: 'u2', durationMs: 10 * MIN },
      { id: 'u1', label: 'u1', durationMs: 5 * MIN },
      { id: 'u3', label: 'u3', durationMs: 5 * MIN },
    ],
  });
  ck('replaceItems: umsortiert → aktiver Punkt an neuer Stelle', nachher.timetable.activeIndex === 0);
}
{
  // Aktiver Punkt entfällt: die Nummer bleibt (heutiges Verhalten), die Logzeile ist fällig.
  const vorher = zustand([item('u1', 5), item('u2', 10), item('u3', 5)], 1);
  const eingang = [
    { id: 'u1', label: 'u1', durationMs: 5 * MIN },
    { id: 'u3', label: 'u3', durationMs: 5 * MIN },
    { id: 'u4', label: 'u4', durationMs: 5 * MIN },
  ];
  const nachher = reduce(vorher, { type: 'tt:replaceItems', items: eingang });
  ck('replaceItems: aktiver Punkt weg → Nummer gehalten', nachher.timetable.activeIndex === 1);
  ck('replaceItems: aktiver Punkt weg → Countdown bleibt', nachher.countdown === vorher.countdown);
  ck('aktiverPunktVerschwunden: Kennung fehlt → ja', aktiverPunktVerschwunden(vorher.timetable, nachher.timetable, eingang));
  // … und am Ende der Liste wird die Nummer wie bisher begrenzt.
  const amEnde = zustand([item('u1', 5), item('u2', 10), item('u3', 5)], 2);
  const kurz = reduce(amEnde, { type: 'tt:replaceItems', items: eingang.slice(0, 2) });
  ck('replaceItems: aktiver Punkt weg, Liste kürzer → auf das Ende begrenzt', kurz.timetable.activeIndex === 1);
}
{
  // Doppelte, leere und fremde Kennungen (z. B. über den Socket :7777) → makeId().
  const s = reduce(INITIAL_STATE, {
    type: 'tt:setAll',
    items: [
      { id: 'x', label: 'a', durationMs: 0 },
      { id: 'x', label: 'b', durationMs: 0 },
      { id: '', label: 'c', durationMs: 0 },
      { id: '   ', label: 'd', durationMs: 0 },
      { id: 7 as unknown as string, label: 'e', durationMs: 0 },
    ],
  });
  const k = s.timetable.items.map((i) => i.id);
  ck('setAll: erste Kennung übernommen', k[0] === 'x');
  ck(
    'setAll: doppelte/leere/fremde Kennung → neu vergeben',
    k.slice(1).every((id) => typeof id === 'string' && id.trim() !== '' && id !== 'x'),
  );
  ck('setAll: alle Kennungen eindeutig', new Set(k).size === k.length);
  ck('setAll: setzt wie bisher zurück', s.timetable.activeIndex === null && s.countdown.startedAtMs === null);
}
{
  // Ohne Kennungen wie heute: Nummer gehalten (begrenzt), neue Zufallskennungen, keine Logzeile.
  const vorher = zustand([item('a', 5), item('b', 10), item('c', 5)], 2);
  const eingang = [
    { label: 'a', durationMs: 5 * MIN },
    { label: 'b', durationMs: 10 * MIN },
  ];
  const nachher = reduce(vorher, { type: 'tt:replaceItems', items: eingang });
  ck('ohne Kennungen: Nummer gehalten, auf das Ende begrenzt', nachher.timetable.activeIndex === 1);
  ck(
    'ohne Kennungen: frische, eindeutige Kennungen',
    nachher.timetable.items.every((i) => typeof i.id === 'string' && i.id.length > 0 && !['a', 'b', 'c'].includes(i.id)) &&
      new Set(nachher.timetable.items.map((i) => i.id)).size === 2,
  );
  ck('ohne Kennungen: Countdown bleibt', nachher.countdown === vorher.countdown);
  ck('ohne Kennungen: keine Logzeile', !aktiverPunktVerschwunden(vorher.timetable, nachher.timetable, eingang));
}
{
  // Ohne aktiven Punkt oder ohne gehaltene Nummer gibt es nichts zu melden.
  const nichtsAktiv = zustand([item('u1', 5)], null);
  ck(
    'aktiverPunktVerschwunden: nichts aktiv → nein',
    !aktiverPunktVerschwunden(nichtsAktiv.timetable, tt([item('u9', 5)], null), [{ id: 'u9', label: 'u9', durationMs: 0 }]),
  );
  const aktiv = zustand([item('u1', 5)], 0);
  const geleert = reduce(aktiv, { type: 'tt:replaceItems', items: [] });
  ck(
    'aktiverPunktVerschwunden: Liste leer, keine Nummer gehalten → nein',
    geleert.timetable.activeIndex === null && !aktiverPunktVerschwunden(aktiv.timetable, geleert.timetable, []),
  );
}
{
  // Kennungs-Durchlauf (Spec 9.3): iveo-Agenda → Show schreiben/lesen → Timer-Punkte tragen die iveo-ID.
  const agenda = agendaToAblauf([
    { id: 'ag-2', program_id: 'se1', sort_order: 1, title: 'Panel', duration_minutes: 45 },
    { id: 'ag-1', program_id: 'se1', sort_order: 0, title: 'Begrüßung', duration_minutes: 10 },
  ]);
  const show = parseShow(serializeShow({ ...createShow('Durchlauf'), ablauf: normalizeAblauf(agenda) }));
  const s = reduce(INITIAL_STATE, { type: 'tt:setAll', items: ablaufToTimetable(show.ablauf) ?? [] });
  ck('Kennungs-Durchlauf: Timer-Punkte tragen die iveo-Agenda-IDs', kennungen(s) === '["ag-1","ag-2"]');
  // RELOAD mit einem Einschub davor: der Timer bleibt auf „Panel“.
  const aufPanel = reduce(s, { type: 'tt:loadItem', index: 1 });
  const neu = agendaToAblauf([
    { id: 'ag-1', program_id: 'se1', sort_order: 0, title: 'Begrüßung', duration_minutes: 10 },
    { id: 'ag-0', program_id: 'se1', sort_order: 1, title: 'Grußwort', duration_minutes: 5 },
    { id: 'ag-2', program_id: 'se1', sort_order: 2, title: 'Panel', duration_minutes: 45 },
  ]);
  const nachReload = reduce(aufPanel, { type: 'tt:replaceItems', items: ablaufToTimetable(normalizeAblauf(neu)) ?? [] });
  ck(
    'Kennungs-Durchlauf: nach RELOAD steht der Timer weiter auf „Panel“',
    nachReload.timetable.activeIndex === 2 && nachReload.timetable.items[2].label === 'Panel',
  );
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

- [ ] **Schritt 7: Test laufen lassen (rot)**

```
npm run selftest -w @jm/timer
```
Erwartet: Abbruch beim Verknüpfen der Module, Exitcode 1:
```
SyntaxError: The requested module '../src/shared/timer-state.ts' does not provide an export named 'aktiverPunktVerschwunden'
```

- [ ] **Schritt 8: `Command` nimmt `TimetableEingang[]`** (`apps/timer/src/shared/timer-state.ts`, Zeilen 98–99)

Vorher:
```ts
  | { type: 'tt:setAll'; items: Array<Omit<TimetableItem, 'id'>> }
  | { type: 'tt:replaceItems'; items: Array<Omit<TimetableItem, 'id'>> }
```
Nachher:
```ts
  | { type: 'tt:setAll'; items: TimetableEingang[] }
  | { type: 'tt:replaceItems'; items: TimetableEingang[] }
```

- [ ] **Schritt 9: Kennungsregel `kennungVerwertbar` + `mitKennungen` anlegen** (`apps/timer/src/shared/timer-state.ts`, hinter `makeId`, Zeilen 115–116)

Vorher (eindeutig, Ende von `makeId`):
```ts
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
```
Nachher:
```ts
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Verwertbare Kennung aus dem Eingang: nicht leerer String (nur Leerzeichen zählt als leer). */
function kennungVerwertbar(id: unknown): id is string {
  return typeof id === 'string' && id.trim().length > 0;
}

/**
 * Kennungen für `tt:setAll`/`tt:replaceItems` vergeben (Teil 2a, Spec 6.1): die mitgegebene
 * `id`, wenn sie verwertbar ist und in DIESER Liste noch nicht vorkommt, sonst `makeId()`.
 * Gilt ebenso für Befehle über den Socket :7777 — dort kann alles ankommen. `id` wird zuletzt
 * gesetzt, damit eine unbrauchbare mitgegebene `id` sie nicht überschreibt.
 */
function mitKennungen(eingang: TimetableEingang[]): TimetableItem[] {
  const vergeben = new Set<string>();
  return eingang.map((it) => {
    const mitgegeben: unknown = it?.id;
    let id = kennungVerwertbar(mitgegeben) && !vergeben.has(mitgegeben) ? mitgegeben : makeId();
    while (vergeben.has(id)) id = makeId(); // makeId kollidiert praktisch nie; ausgeschlossen ist es so trotzdem
    vergeben.add(id);
    return { ...it, id };
  });
}
```

- [ ] **Schritt 10: `tt:setAll` nutzt die Kennungsregel** (`apps/timer/src/shared/timer-state.ts`, Zeilen 259–263)

Vorher:
```ts
    case 'tt:setAll': {
      const items: TimetableItem[] = cmd.items.map((it) => ({
        id: makeId(),
        ...it,
      }));
```
Nachher:
```ts
    case 'tt:setAll': {
      const items = mitKennungen(cmd.items);
```
Der Rest des Zweigs (`activeIndex: null`, Countdown zurücksetzen) bleibt unverändert.

- [ ] **Schritt 11: `tt:replaceItems` hält den aktiven Punkt über die Kennung** (`apps/timer/src/shared/timer-state.ts`, Zeilen 272–280)

Vorher:
```ts
      // Nicht-destruktives Ersetzen für Live-Updates (z. B. iveo-Reload während
      // der Show): tauscht die Items, hält den aktiven Index (geklemmt) und lässt
      // den Countdown UNANGETASTET — ein laufender Timer darf nie resetten.
      const items: TimetableItem[] = cmd.items.map((it) => ({ id: makeId(), ...it }));
      let activeIndex = tt.activeIndex;
      if (activeIndex !== null && (items.length === 0 || activeIndex >= items.length)) {
        activeIndex = items.length ? items.length - 1 : null;
      }
      return { ...state, timetable: { ...tt, items, activeIndex } };
```
Nachher:
```ts
      // Nicht-destruktives Ersetzen für Live-Updates (z. B. iveo-Reload während
      // der Show): tauscht die Items und lässt den Countdown UNANGETASTET — ein
      // laufender Timer darf nie resetten. Der aktive Punkt folgt seiner Kennung
      // (Teil 2a, Spec 6.1); fehlt sie im neuen Ablauf, hält der Timer wie bisher
      // die Nummer (geklemmt). Ohne Kennungen ist das genau das alte Verhalten.
      const items = mitKennungen(cmd.items);
      const aktivId = tt.activeIndex !== null ? tt.items[tt.activeIndex]?.id : undefined;
      const neueStelle = aktivId !== undefined ? items.findIndex((it) => it.id === aktivId) : -1;
      let activeIndex = tt.activeIndex;
      if (neueStelle !== -1) {
        activeIndex = neueStelle;
      } else if (activeIndex !== null && (items.length === 0 || activeIndex >= items.length)) {
        activeIndex = items.length ? items.length - 1 : null;
      }
      return { ...state, timetable: { ...tt, items, activeIndex } };
```

- [ ] **Schritt 12: `aktiverPunktVerschwunden` anlegen** (`apps/timer/src/shared/timer-state.ts`, direkt vor `effectiveDurationMs`, Zeile 352)

Vorher:
```ts
export function effectiveDurationMs(cd: CountdownState): number {
```
Nachher:
```ts
/**
 * Für die Logzeile im Main nach `tt:replaceItems` (Teil 2a, Spec 6.1): true, wenn vorher ein
 * Punkt aktiv war, seine Kennung im neuen Ablauf fehlt und der Timer deshalb die Nummer hält.
 * `eingang` = die mitgegebenen Punkte. Trägt keiner eine verwertbare Kennung (eigene
 * Timer-Liste, Show ohne Kennungen), gab es keinen Abgleich über die Kennung — dann false:
 * „wie heute“ hat keine Logzeile, und „nicht mehr vorhanden“ wäre dort gelogen.
 */
export function aktiverPunktVerschwunden(
  vorher: TimetableState,
  nachher: TimetableState,
  eingang?: TimetableEingang[],
): boolean {
  if (vorher.activeIndex === null || nachher.activeIndex === null) return false;
  const aktiv = vorher.items[vorher.activeIndex];
  if (!aktiv) return false;
  if (eingang && !eingang.some((it) => kennungVerwertbar(it?.id))) return false;
  return !nachher.items.some((it) => it.id === aktiv.id);
}

export function effectiveDurationMs(cd: CountdownState): number {
```

- [ ] **Schritt 13: Test laufen lassen (grün)**

```
npm run selftest -w @jm/timer
```
Erwartet: Exitcode 0, keine `FAIL`-Zeile, Schlusszeile `41 passed, 0 failed` (20 aus Zyklus 1 + 21 neue), darunter:
```
  ok  replaceItems: aktiver Punkt folgt seiner Kennung (Einschub davor)
  ok  replaceItems: Countdown bleibt unangetastet
  ok  replaceItems: aktiver Punkt weg → Nummer gehalten
  ok  setAll: doppelte/leere/fremde Kennung → neu vergeben
  ok  ohne Kennungen: keine Logzeile
  ok  Kennungs-Durchlauf: Timer-Punkte tragen die iveo-Agenda-IDs
  ok  Kennungs-Durchlauf: nach RELOAD steht der Timer weiter auf „Panel“

41 passed, 0 failed
```

## Zyklus 3: Timer-Main verdrahten

Der Main importiert Electron und ist im Selbsttest nicht ladbar. Die Logik steckt vollständig in den getesteten Funktionen (`hatEigeneTimerListe`, `parseTimetable`, `ablaufToTimetable`, `reduce`, `aktiverPunktVerschwunden`); hier wird nur verdrahtet. Prüfung: Selbsttest bleibt grün, Typecheck (er meldet auch ein vergessenes lokales `parseTimetable` als Konflikt mit dem Import), Build-Probe.

- [ ] **Schritt 14: Importe im Main umstellen** (`apps/timer/src/main/index.ts`, Zeilen 16–19)

Vorher:
```ts
import { parseShow, parseShowDeepLink, type ShowAblaufItem } from '@jm/show';
import type { TimetableItem } from '@shared/timer-state';
import { RENDERER_CSP } from '@shared/net';
import { loadState, dispatch } from './state';
```
Nachher:
```ts
import { hatEigeneTimerListe, parseShow, parseShowDeepLink } from '@jm/show';
import { aktiverPunktVerschwunden } from '@shared/timer-state';
import { ablaufToTimetable, parseTimetable } from '@shared/show-ablauf';
import { RENDERER_CSP } from '@shared/net';
import { loadState, dispatch, getState } from './state';
```
(`getState` ist in `apps/timer/src/main/state.ts` bereits exportiert; `dispatch` gibt den neuen Zustand zurück.)

- [ ] **Schritt 15: Lokale `parseTimetable`/`ablaufToTimetable` im Main entfernen** (`apps/timer/src/main/index.ts`, Zeilen 296–325)

Vorher:
```ts
/** Liest einen Ablaufplan aus den (untrusted) Show-Settings — defensiv. */
function parseTimetable(raw: unknown): Array<Omit<TimetableItem, 'id'>> | null {
  if (!Array.isArray(raw)) return null;
  const items = raw
    .filter((it): it is Record<string, unknown> => Boolean(it) && typeof it === 'object')
    .map((it) => ({
      label: typeof it.label === 'string' ? it.label : '',
      durationMs:
        typeof it.durationMs === 'number' && it.durationMs >= 0 ? it.durationMs : 0,
      ...(typeof it.note === 'string' ? { note: it.note } : {}),
    }));
  return items.length ? items : null;
}

/** Zentralen Show-Ablauf (#78) in Timetable-Items überführen (gleiche Form). */
function ablaufToTimetable(
  ablauf: ShowAblaufItem[] | undefined,
): Array<Omit<TimetableItem, 'id'>> | null {
  if (!ablauf || !ablauf.length) return null;
  return ablauf.map((a) => ({
    label: a.label,
    durationMs: typeof a.durationMs === 'number' && a.durationMs > 0 ? a.durationMs : 0,
    ...(a.note ? { note: a.note } : {}),
    ...(typeof a.plannedStartMs === 'number' ? { plannedStartMs: a.plannedStartMs } : {}),
    ...(a.owner ? { owner: a.owner } : {}),
    ...(a.category ? { category: a.category } : {}),
  }));
}

/**
```
Nachher:
```ts
// parseTimetable/ablaufToTimetable liegen seit Teil 2a in @shared/show-ablauf (ohne Electron,
// testbar im Selbsttest); ablaufToTimetable gibt dort die Kennung der Ablaufpunkte mit.

/**
```
(Das abschließende `/**` gehört zum Doc-Kommentar von `applyShowFromDeepLink` und bleibt stehen.)

- [ ] **Schritt 16: `applyShowFromPath` — Liste wählen, Kennung halten, Logzeile** (`apps/timer/src/main/index.ts`, Zeilen 350–354)

Vorher:
```ts
    const settings = show.tools.find((t) => t.appId === 'jm-timer')?.settings;
    const items = parseTimetable(settings?.timetable) ?? ablaufToTimetable(show.ablauf);
    if (items) {
      dispatch({ type: mode === 'reload' ? 'tt:replaceItems' : 'tt:setAll', items });
    }
```
Nachher:
```ts
    const settings = show.tools.find((t) => t.appId === 'jm-timer')?.settings;
    // Eigene Timer-Liste hat Vorrang vor dem Show-Ablauf. Die Prüfung kommt aus @jm/show,
    // damit Timer und Rundown dieselbe Liste meinen (Teil 2a, Spec 6.1/6.2).
    const items = hatEigeneTimerListe(settings)
      ? parseTimetable(settings?.timetable)
      : ablaufToTimetable(show.ablauf);
    if (items) {
      const vorher = getState().timetable;
      const nachher = dispatch({ type: mode === 'reload' ? 'tt:replaceItems' : 'tt:setAll', items }).timetable;
      // Der aktive Punkt folgt seiner Kennung; fehlt sie im neuen Ablauf, hält der Timer
      // die Nummer — das soll im Log stehen, statt still zu passieren.
      if (mode === 'reload' && aktiverPunktVerschwunden(vorher, nachher, items)) {
        getLog().info('Aktiver Punkt im neuen Ablauf nicht mehr vorhanden, Nummer gehalten');
      }
    }
```
Verhalten gleich wie vorher bei der Listenwahl: `hatEigeneTimerListe(settings)` ist genau dann wahr, wenn `parseTimetable(settings?.timetable)` eine Liste liefert (Test „hatEigeneTimerListe ⇔ parseTimetable liefert eine Liste“). Die Countdown-Vorgabe beim Erst-Öffnen, `currentShowPath` und `reloadCurrentShow` bleiben unverändert.

- [ ] **Schritt 17: Selbsttest erneut laufen lassen**

```
npm run selftest -w @jm/timer
```
Erwartet: unverändert `41 passed, 0 failed`, Exitcode 0.

- [ ] **Schritt 18: Typecheck**

```
npm run typecheck -w @jm/timer
```
Erwartet: keine Fehlermeldung von `tsc` (node- und web-Konfiguration; `src/shared/show-ablauf.ts` liegt in beiden), Exitcode 0. (Gegen den Planstand vorab geprüft.)

- [ ] **Schritt 19: Build-Probe** (prüft, dass electron-vite den Alias `@shared/show-ablauf` im Main bündelt; Ausgabe in `apps/timer/out/`, per `apps/timer/.gitignore` ausgeschlossen)

```
npm run build -w @jm/timer
```
Erwartet: drei Bundles (main, preload, renderer) mit `✓ built in …`, Exitcode 0. (Gegen den Planstand vorab gebaut; `out/main/index.cjs` enthält danach `hatEigeneTimerListe`, `mitKennungen`, `ablaufToTimetable` und die Logzeile.)

- [ ] **Schritt 20: Commit** (im Bash-Werkzeug / Git Bash; Commit-Text bewusst ohne Umlaute)

```
git add apps/timer/src/shared/show-ablauf.ts apps/timer/src/shared/timer-state.ts apps/timer/src/main/index.ts apps/timer/test/selftest.ts
git status --short
```
Erwartet genau:
```
M  apps/timer/src/main/index.ts
A  apps/timer/src/shared/show-ablauf.ts
M  apps/timer/src/shared/timer-state.ts
M  apps/timer/test/selftest.ts
```
(`*.tsbuildinfo` und `apps/timer/out/` sind ignoriert und erscheinen nicht.) Dann:
```
git commit -m "feat(timer): aktiver Punkt folgt beim RELOAD seiner Kennung (Teil 2a, #235)" -m "parseTimetable und ablaufToTimetable ziehen nach src/shared/show-ablauf.ts (ohne Electron, im Selbsttest pruefbar); ablaufToTimetable gibt die Kennung mit. tt:setAll und tt:replaceItems uebernehmen eine mitgegebene id nur, wenn sie ein nicht leerer, in der Liste freier String ist, sonst makeId (gilt auch fuer den Socket :7777). tt:replaceItems haelt den aktiven Punkt ueber die Kennung, sonst wie bisher die Nummer, mit Logzeile. Der Main waehlt die Liste ueber hatEigeneTimerListe aus @jm/show." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
- `TimetableEingang` ist in `timer-state.ts` definiert (neben `TimetableItem`, gebraucht von `Command`) und wird aus `show-ablauf.ts` per `export type { TimetableEingang }` weitergereicht. Beide Importpfade liefern also denselben Typ. Grund: `timer-state.ts` wäre sonst von `show-ablauf.ts` abhängig (Typ-Kreis), und `Command` gehört zum Reducer.
- `aktiverPunktVerschwunden` hat einen dritten, optionalen Parameter `eingang?: TimetableEingang[]` (die Zwei-Argument-Form des Gerüsts bleibt aufrufbar). Grund: Ohne Kennungen im Eingang (eigene Timer-Liste, Show ohne Kennungen) vergibt der Timer bei jedem RELOAD neue Zufallskennungen; die alte Kennung des aktiven Punkts fehlt dann immer. Die Zwei-Argument-Form würde dort bei jedem RELOAD „Aktiver Punkt im neuen Ablauf nicht mehr vorhanden“ loggen, obwohl der Punkt da ist; Spec 6.1 verlangt „Ohne Kennungen verhält sich alles wie heute“ (heute: keine Logzeile). Der Main übergibt `items`.
- `aktiverPunktVerschwunden` liefert auch dann false, wenn nach dem Tausch kein Punkt aktiv ist (`nachher.activeIndex === null`, leere Liste): Die Logzeile sagt „Nummer gehalten“, das stimmt dann nicht. Aus dem Main kommt eine leere Liste nie an (`ablaufToTimetable`/`parseTimetable` liefern dann `null`, es wird nicht dispatcht).
- Logzeile auf Stufe `info` (Spec sagt nur „Logzeile“; der Fall ist erwartbar, z. B. ein in iveo gelöschter Punkt).

**Bekannt und hingenommen:** Beim allerersten RELOAD nach dem Update einer Bestands-Show (der Launcher schreibt die Kennungen einmal nach, Spec 7.2) haben die Timer-Punkte noch Zufallskennungen, der Eingang aber echte. Der Timer hält dann einmal die Nummer (wie heute) und loggt die Zeile einmal. Danach greift die Kennung.

---

### Aufgabe A4: Rundown — Datenmodell v2 und Dateiformat (rein)

**Spec:** 4.1 (Datenmodell; `migrate` liest Version 1 und 2; Version 1 → `zuordnungOffen`; geschrieben wird immer Version 2; `zuordnungOffen` bleibt bis zum ersten Abgleich), 0.11 (`schemaVersion: 2`), 6.2 (`zielId` an der Aktion), 4.7/4.8 (`doc` trägt das Archiv), 9.1 Fall 24 (Teil 1: Version-1-Datei ohne Show gespeichert).

**Dateien:**
- Modify: `apps/rundown/src/shared/types.ts` — Zeilen 25–28 (Ende `RundownAction`, Kopfkommentar `RundownRow`) und Zeilen 40–48 (Ende `RundownRow`, ganzes `RundownDoc`)
- Create: `apps/rundown/src/shared/doc-format.ts`
- Modify: `apps/rundown/src/main/store.ts` — Zeilen 7–9 (Importe), 24–26 (`defaultDoc`), 39–75 (`normAction`, `normRow`, `migrate`), 84–86 (`docFromAblauf`)
- Test: `apps/rundown/test/selftest.ts` — Import hinter Zeile 4, neuer Block vor Zeile 83 (`console.log(failed === 0 …`)

**Schnittstellen:**
- Consumes: nichts aus früheren Aufgaben (A1 ist für A4 nicht nötig).
- Produces:
  ```ts
  // apps/rundown/src/shared/types.ts (exakt Spec 4.1)
  interface RundownAction { /* … wie heute … */ zielId?: string }
  interface RundownRow { /* … wie heute … */ quelle?: 'ablauf'; entfallen?: true }
  interface RundownDoc {
    schemaVersion: 2;
    name: string;
    rows: RundownRow[];
    kontext?: string;
    archiv?: Record<string, RundownRow[]>;
    zuordnungOffen?: true;
  }

  // apps/rundown/src/shared/doc-format.ts (rein, nur `import type`)
  export type NeueId = (praefix: 'r' | 'a') => string;
  export function migrate(raw: unknown, neueId: NeueId): RundownDoc;
  export function normRow(raw: unknown, neueId: NeueId): RundownRow;
  export function normAction(raw: unknown, neueId: NeueId): RundownAction;

  // apps/rundown/src/main/store.ts — Signaturen unverändert (bis A10; A10 entfernt docFromAblauf):
  export function migrate(raw: unknown): RundownDoc; // = migrate aus doc-format mit newId
  export function defaultDoc(): RundownDoc;          // jetzt schemaVersion 2
  export function docFromAblauf(name: string, items: ShowAblaufItem[]): RundownDoc;
  // readDoc, writeDoc, loadAutosave, saveAutosave unverändert
  ```

**Vorab (am Repo gemessen):**
- Die Arbeitskopie hat CRLF (`core.autocrlf=true`, im Index LF). Die Vorher-Ausschnitte unten sind ohne `\r` geschrieben; das Edit-Werkzeug gleicht das aus. Neue Dateien dürfen LF haben.
- `apps/rundown/test/` steht in keiner tsconfig. Der Selbsttest wird nur ausgeführt (`node --experimental-strip-types`), nicht typgeprüft. `schemaVersion: 1` im bestehenden Navigations-Testdokument (Zeile 33) ist deshalb zur Laufzeit harmlos; diese Aufgabe fasst es nicht an.
- G2: `doc-format.ts` importiert nur `import type { … } from './types'`. Den ID-Geber `newId` aus `@shared/conductor` darf es nicht zur Laufzeit importieren, deshalb der Parameter `neueId`. In der App übergibt `store.ts` `newId`.
- Erkennung der Version: `schemaVersion` ist eine Zahl ≥ 2 → Version 2. Alles andere (1, fehlt, kein Objekt) → Version 1.
- Ausgabe-Reihenfolge der Felder (wichtig für die JSON-Vergleiche im Test): Zeile `id, label, note, actions, durationMs?, quelle?, entfallen?`; Aktion `id, role, verb, args, enabled, delayMs?, zielId?`; Dokument `schemaVersion, name, rows, kontext?, archiv?, zuordnungOffen?`.

---

- [ ] **Schritt 1: Testimport ergänzen** in `apps/rundown/test/selftest.ts`.

<!-- edit: apps/rundown/test/selftest.ts -->
Vorher:
```ts
import type { RundownDoc } from '../src/shared/types.ts';
```
Nachher:
```ts
import type { RundownDoc } from '../src/shared/types.ts';
import { migrate } from '../src/shared/doc-format.ts';
```

- [ ] **Schritt 2: Fehlschlagenden Testblock einfügen** in `apps/rundown/test/selftest.ts`, direkt vor der Schlusszeile. Der Block steht in `{ … }`, damit seine Namen nicht mit den Blöcken anderer Aufgaben kollidieren.

<!-- edit: apps/rundown/test/selftest.ts -->
Vorher:
```ts
console.log(failed === 0 ? '\nALLE TESTS OK' : `\n${failed} FEHLER`);
```
Nachher:
```ts
// ── Dateiformat Version 2 (Master-Link 2a, Spec 4.1) ─────────────────────────
{
  let zaehler = 0;
  const neueId = (praefix: 'r' | 'a'): string => `${praefix}${++zaehler}`;

  // Version 1: alles wird eigene Zeile, Titel-Zuordnung steht aus.
  eq(
    migrate(
      {
        schemaVersion: 1,
        name: 'COP31 Tag 1',
        rows: [
          {
            id: 'r_alt1',
            label: 'Begrüßung',
            quelle: 'ablauf',
            entfallen: true,
            actions: [{ id: 'a_1', role: 'titler', verb: 'take', args: [], enabled: true }],
          },
          { label: 'Ohne id', durationMs: 90000.7, actions: [{ role: 'timer', verb: 'goto', args: [2], delayMs: 500, zielId: 'u1' }] },
        ],
        fremd: 'fällt weg',
      },
      neueId,
    ),
    {
      schemaVersion: 2,
      name: 'COP31 Tag 1',
      rows: [
        { id: 'r_alt1', label: 'Begrüßung', actions: [{ id: 'a_1', role: 'titler', verb: 'take', args: [], enabled: true }] },
        {
          id: 'r1',
          label: 'Ohne id',
          actions: [{ id: 'a2', role: 'timer', verb: 'goto', args: [2], enabled: true, delayMs: 500, zielId: 'u1' }],
          durationMs: 90000,
        },
      ],
      zuordnungOffen: true,
    },
    'migrate v1 → schemaVersion 2, zuordnungOffen, keine quelle/entfallen, fehlende IDs über neueId',
  );

  // Version 2: neue Felder bleiben, Unbekanntes und Ungültiges fällt weg.
  eq(
    migrate(
      {
        schemaVersion: 2,
        name: 'Gala',
        kontext: 'se:p1',
        rows: [
          {
            id: 'u1',
            quelle: 'ablauf',
            label: 'Keynote',
            actions: [{ id: 'a0', role: 'timer', verb: 'goto', args: [3], enabled: true, zielId: '' }],
          },
          {
            id: 'u2',
            quelle: 'ablauf',
            entfallen: true,
            label: 'Panel',
            actions: [{ id: 'a1', role: 'titler', verb: 'take', args: [], enabled: false, zielId: 'u1' }],
          },
          { id: 'r9', label: 'Eigene', quelle: 'iveo', entfallen: true, actions: [] },
        ],
        archiv: {
          'liste:2026-11-10|||0': [{ id: 'u7', quelle: 'ablauf', label: 'Alt', actions: [] }],
          kaputt: [{ id: 'k', label: 'kein Kontext', actions: [] }],
          'se:p2': 'kein Array',
        },
        zuordnungOffen: true,
        unbekannt: 1,
      },
      neueId,
    ),
    {
      schemaVersion: 2,
      name: 'Gala',
      rows: [
        { id: 'u1', label: 'Keynote', actions: [{ id: 'a0', role: 'timer', verb: 'goto', args: [3], enabled: true }], quelle: 'ablauf' },
        {
          id: 'u2',
          label: 'Panel',
          actions: [{ id: 'a1', role: 'titler', verb: 'take', args: [], enabled: false, zielId: 'u1' }],
          quelle: 'ablauf',
          entfallen: true,
        },
        { id: 'r9', label: 'Eigene', actions: [] },
      ],
      kontext: 'se:p1',
      archiv: { 'liste:2026-11-10|||0': [{ id: 'u7', label: 'Alt', actions: [], quelle: 'ablauf' }] },
      zuordnungOffen: true,
    },
    'migrate v2 → quelle/entfallen/kontext/archiv/zuordnungOffen bleiben, Ungültiges fällt weg',
  );

  // Kontext-Schlüssel, die keine sind (auch __proto__ aus JSON), fallen weg.
  eq(
    migrate(JSON.parse('{"schemaVersion":2,"name":"X","rows":[],"kontext":"__proto__","archiv":{"__proto__":[],"bogus":[]}}'), neueId),
    { schemaVersion: 2, name: 'X', rows: [] },
    'migrate v2 → ungültiger kontext und Archiv-Schlüssel fallen weg',
  );

  // Kaputtes JSON-Gerüst → leeres Version-1-Dokument.
  eq(migrate(null, neueId), { schemaVersion: 2, name: 'Ablauf', rows: [], zuordnungOffen: true }, 'migrate(null) → leeres Dokument');
  eq(migrate('kaputt', neueId), { schemaVersion: 2, name: 'Ablauf', rows: [], zuordnungOffen: true }, 'migrate(String) → leeres Dokument');

  // Spec 9.1 Fall 24, Teil 1: Version-1-Datei ohne Show gespeichert → bleibt zuordnungOffen.
  const einmal = migrate({ schemaVersion: 1, name: 'Alt', rows: [{ id: 'r1', label: 'A', actions: [] }] }, neueId);
  const zweimal = migrate(JSON.parse(JSON.stringify(einmal)), neueId);
  eq(zweimal, einmal, 'Fall 24 (Teil 1): v1 ohne Show als v2 gespeichert → zuordnungOffen bleibt');
}

console.log(failed === 0 ? '\nALLE TESTS OK' : `\n${failed} FEHLER`);
```

- [ ] **Schritt 3: Test laufen lassen (rot).**

```bash
npm run selftest -w @jm/rundown
```
Erwartet: Abbruch beim Laden, **kein** `ok`-Test läuft, Exit-Code 1:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…\apps\rundown\src\shared\doc-format.ts' imported from …\apps\rundown\test\selftest.ts
```

- [ ] **Schritt 4: `RundownAction` um `zielId` erweitern** in `apps/rundown/src/shared/types.ts`.

<!-- edit: apps/rundown/src/shared/types.ts -->
Vorher:
```ts
  delayMs?: number;
}

/** Eine Zeile/Segment im Ablaufplan. */
```
Nachher:
```ts
  delayMs?: number;
  /**
   * Schlüssel des Ablaufpunkts, auf den ein `timer goto` zielt (Master-Link 2a,
   * Spec 6.2). Gesetzt nur durch die Auswahl im Editor oder „an diesen Punkt
   * binden“; der Main rechnet daraus erst beim Senden die Nummer aus.
   */
  zielId?: string;
}

/** Eine Zeile/Segment im Ablaufplan. */
```

- [ ] **Schritt 5: `RundownRow` und `RundownDoc` auf Version 2 bringen** in `apps/rundown/src/shared/types.ts`.

<!-- edit: apps/rundown/src/shared/types.ts -->
Vorher:
```ts
  durationMs?: number;
}

/** Das Rundown-Dokument (Speicherformat `.jmrundown`). */
export interface RundownDoc {
  schemaVersion: 1;
  name: string;
  rows: RundownRow[];
}
```
Nachher:
```ts
  durationMs?: number;
  /**
   * 'ablauf' = Ablaufzeile: stammt aus dem Show-Ablauf, `id` ist der Schlüssel
   * des Ablaufpunkts (Master-Link 2a, Spec 4.1). Fehlt = eigene Zeile.
   */
  quelle?: 'ablauf';
  /**
   * Nur bei quelle 'ablauf': der Punkt fehlt im aktuellen Ablauf, die Zeile
   * bleibt wegen ihrer Aktionen stehen (R5). Entfallene Zeilen feuern nie.
   */
  entfallen?: true;
}

/** Das Rundown-Dokument (Speicherformat `.jmrundown`, Autosave, Gedächtnis). */
export interface RundownDoc {
  schemaVersion: 2;
  name: string;
  rows: RundownRow[];
  /** Kontext der aktuellen rows (Spec 4.4). Fehlt bei Dokumenten, die nie mit einer Show abgeglichen wurden. */
  kontext?: string;
  /** Zeilen anderer Kontexte derselben Show, je Kontext. */
  archiv?: Record<string, RundownRow[]>;
  /** true = Version-1-Dokument, dessen einmalige Titel-Zuordnung (Spec 4.9) noch aussteht. */
  zuordnungOffen?: true;
}
```

- [ ] **Schritt 6: `apps/rundown/src/shared/doc-format.ts` anlegen** (ganzer Inhalt).

<!-- neu: apps/rundown/src/shared/doc-format.ts -->
```ts
// Dateiformat des Rundown-Dokuments (.jmrundown, Autosave, Gedächtnis): tolerantes
// Einlesen von Version 1 und 2 (Master-Link 2a, Spec 4.1).
//
// Rein: kein electron, kein node:, keine Paket-Laufzeitimporte, zwischen Modulen
// nur `import type` — damit der Selbsttest es unter
// `node --experimental-strip-types` ohne Pfad-Aliase laden kann. Neue IDs kommen
// über den übergebenen `neueId` (in der App `newId` aus `@shared/conductor`).
import type { RundownAction, RundownDoc, RundownRow } from './types';

/** Liefert eine neue Zeilen- ('r') bzw. Aktions-ID ('a'). */
export type NeueId = (praefix: 'r' | 'a') => string;

/**
 * Gültiger Kontext-Schlüssel (Spec 4.4): `show`, `se:<programId>` oder
 * `liste:<…>`. Alles andere (auch `__proto__`) wird beim Einlesen verworfen.
 */
function istKontext(k: unknown): k is string {
  return typeof k === 'string' && /^(?:show$|se:.|liste:)/.test(k);
}

/** Eine Aktion tolerant normalisieren. */
export function normAction(raw: unknown, neueId: NeueId): RundownAction {
  const o = (raw ?? {}) as Partial<RundownAction>;
  const delay = typeof o.delayMs === 'number' && Number.isFinite(o.delayMs) ? Math.max(0, Math.trunc(o.delayMs)) : 0;
  return {
    id: typeof o.id === 'string' ? o.id : neueId('a'),
    role: typeof o.role === 'string' ? o.role : 'timer',
    verb: typeof o.verb === 'string' ? o.verb : 'start',
    args: Array.isArray(o.args) ? o.args.filter((x) => typeof x === 'string' || typeof x === 'number') : [],
    enabled: o.enabled !== false,
    // Optionales Feld nur setzen, wenn >0 — hält cookbook-/Doc-JSON schlank und
    // alte Dateien (ohne delayMs) verhalten sich unverändert.
    ...(delay > 0 ? { delayMs: delay } : {}),
    // Sprungziel (Spec 6.2) nur als nicht leerer String übernehmen.
    ...(typeof o.zielId === 'string' && o.zielId ? { zielId: o.zielId } : {}),
  };
}

/** Eine Zeile tolerant normalisieren (Version-2-Felder `quelle`/`entfallen` inklusive). */
export function normRow(raw: unknown, neueId: NeueId): RundownRow {
  const o = (raw ?? {}) as Partial<RundownRow>;
  const duration = typeof o.durationMs === 'number' && Number.isFinite(o.durationMs) ? Math.max(0, Math.trunc(o.durationMs)) : 0;
  const row: RundownRow = {
    id: typeof o.id === 'string' ? o.id : neueId('r'),
    label: typeof o.label === 'string' ? o.label : 'Zeile',
    note: typeof o.note === 'string' ? o.note : undefined,
    actions: Array.isArray(o.actions) ? o.actions.map((a) => normAction(a, neueId)) : [],
    // Optionales Feld nur bei >0 setzen — alte Dateien bleiben unverändert.
    ...(duration > 0 ? { durationMs: duration } : {}),
  };
  // `entfallen` gibt es nur an Ablaufzeilen (Spec 4.1).
  if (o.quelle === 'ablauf') {
    row.quelle = 'ablauf';
    if (o.entfallen === true) row.entfallen = true;
  }
  return row;
}

/** Version 1 kennt keine Ablaufzeilen: alles wird eigene Zeile (Spec 4.1). */
function alsEigeneZeile(row: RundownRow): RundownRow {
  const z = { ...row };
  delete z.quelle;
  delete z.entfallen;
  return z;
}

function normArchiv(raw: unknown, neueId: NeueId): Record<string, RundownRow[]> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const out: Record<string, RundownRow[]> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!istKontext(k) || !Array.isArray(v)) continue;
    out[k] = v.map((r) => normRow(r, neueId));
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * Beliebiges JSON tolerant in ein valides RundownDoc (Version 2) überführen.
 * - Version 1 (oder ohne Angabe): alle Zeilen werden eigene Zeilen, dazu
 *   `zuordnungOffen: true` für die einmalige Titel-Zuordnung (Spec 4.9).
 * - Version 2 und höher: `quelle`, `entfallen`, `kontext`, `archiv` und
 *   `zuordnungOffen` bleiben erhalten; unbekannte Felder fallen weg.
 * Geschrieben wird immer Version 2.
 */
export function migrate(raw: unknown, neueId: NeueId): RundownDoc {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const name = typeof o.name === 'string' ? o.name : 'Ablauf';
  const rohZeilen: unknown[] = Array.isArray(o.rows) ? o.rows : [];
  const version2 = typeof o.schemaVersion === 'number' && o.schemaVersion >= 2;
  if (!version2) {
    return {
      schemaVersion: 2,
      name,
      rows: rohZeilen.map((r) => alsEigeneZeile(normRow(r, neueId))),
      zuordnungOffen: true,
    };
  }
  const doc: RundownDoc = { schemaVersion: 2, name, rows: rohZeilen.map((r) => normRow(r, neueId)) };
  if (istKontext(o.kontext)) doc.kontext = o.kontext;
  const archiv = normArchiv(o.archiv, neueId);
  if (archiv) doc.archiv = archiv;
  if (o.zuordnungOffen === true) doc.zuordnungOffen = true;
  return doc;
}
```

- [ ] **Schritt 7: Test laufen lassen (grün).**

```bash
npm run selftest -w @jm/rundown
```
Erwartet: letzte Zeile `ALLE TESTS OK`, Exit-Code 0, **28** Zeilen beginnen mit `ok   ` (22 bestehende + 6 neue). Die neuen:
```
ok   migrate v1 → schemaVersion 2, zuordnungOffen, keine quelle/entfallen, fehlende IDs über neueId
ok   migrate v2 → quelle/entfallen/kontext/archiv/zuordnungOffen bleiben, Ungültiges fällt weg
ok   migrate v2 → ungültiger kontext und Archiv-Schlüssel fallen weg
ok   migrate(null) → leeres Dokument
ok   migrate(String) → leeres Dokument
ok   Fall 24 (Teil 1): v1 ohne Show als v2 gespeichert → zuordnungOffen bleibt
```

- [ ] **Schritt 8: `store.ts` — Importe umstellen** (`apps/rundown/src/main/store.ts`).

<!-- edit: apps/rundown/src/main/store.ts -->
Vorher:
```ts
import { newId } from '@shared/conductor';
import type { ShowAblaufItem } from '@jm/show';
import type { RundownAction, RundownDoc, RundownRow } from '@shared/types';
```
Nachher:
```ts
import { newId } from '@shared/conductor';
import { migrate as migrateFormat } from '@shared/doc-format';
import type { ShowAblaufItem } from '@jm/show';
import type { RundownAction, RundownDoc } from '@shared/types';
```

- [ ] **Schritt 9: `store.ts` — `defaultDoc` schreibt Version 2.**

<!-- edit: apps/rundown/src/main/store.ts -->
Vorher:
```ts
  return {
    schemaVersion: 1,
    name: 'Neuer Ablauf',
```
Nachher:
```ts
  return {
    schemaVersion: 2,
    name: 'Neuer Ablauf',
```

- [ ] **Schritt 10: `store.ts` — `normAction`/`normRow`/`migrate` durch den Aufruf von `doc-format` ersetzen.** Die Funktion `migrate(raw)` bleibt exportiert, damit `readDoc`, `loadAutosave` und `docFromAblauf` unverändert bleiben.

<!-- edit: apps/rundown/src/main/store.ts -->
Vorher:
```ts
function normAction(raw: unknown): RundownAction {
  const o = (raw ?? {}) as Partial<RundownAction>;
  const delay = typeof o.delayMs === 'number' && Number.isFinite(o.delayMs) ? Math.max(0, Math.trunc(o.delayMs)) : 0;
  return {
    id: typeof o.id === 'string' ? o.id : newId('a'),
    role: typeof o.role === 'string' ? o.role : 'timer',
    verb: typeof o.verb === 'string' ? o.verb : 'start',
    args: Array.isArray(o.args) ? o.args.filter((x) => typeof x === 'string' || typeof x === 'number') : [],
    enabled: o.enabled !== false,
    // Optionales Feld nur setzen, wenn >0 — hält cookbook-/Doc-JSON schlank und
    // alte Dateien (ohne delayMs) verhalten sich unverändert.
    ...(delay > 0 ? { delayMs: delay } : {}),
  };
}

function normRow(raw: unknown): RundownRow {
  const o = (raw ?? {}) as Partial<RundownRow>;
  const duration = typeof o.durationMs === 'number' && Number.isFinite(o.durationMs) ? Math.max(0, Math.trunc(o.durationMs)) : 0;
  return {
    id: typeof o.id === 'string' ? o.id : newId('r'),
    label: typeof o.label === 'string' ? o.label : 'Zeile',
    note: typeof o.note === 'string' ? o.note : undefined,
    actions: Array.isArray(o.actions) ? o.actions.map(normAction) : [],
    // Optionales Feld nur bei >0 setzen — alte Dateien bleiben unverändert.
    ...(duration > 0 ? { durationMs: duration } : {}),
  };
}

/** Beliebiges JSON tolerant in ein valides RundownDoc überführen. */
export function migrate(raw: unknown): RundownDoc {
  const o = (raw ?? {}) as Partial<RundownDoc>;
  return {
    schemaVersion: 1,
    name: typeof o.name === 'string' ? o.name : 'Ablauf',
    rows: Array.isArray(o.rows) ? o.rows.map(normRow) : [],
  };
}
```
Nachher:
```ts
/**
 * Beliebiges JSON tolerant in ein valides RundownDoc überführen. Die Regeln des
 * Dateiformats (Version 1 → `zuordnungOffen`, Version 2 mit quelle/entfallen/
 * kontext/archiv) stehen rein in `@shared/doc-format` und sind dort per
 * Selbsttest geprüft; hier kommt nur der ID-Geber `newId` dazu.
 */
export function migrate(raw: unknown): RundownDoc {
  return migrateFormat(raw, newId);
}
```

- [ ] **Schritt 11: `store.ts` — `docFromAblauf` liest als Version 2 ein.** Sonst bekäme ein Dokument aus dem Show-Ablauf bis A9/A10 `zuordnungOffen: true`, obwohl es keine Titel-Zuordnung braucht.

<!-- edit: apps/rundown/src/main/store.ts -->
Vorher:
```ts
export function docFromAblauf(name: string, items: ShowAblaufItem[]): RundownDoc {
  return migrate({ name: name || 'Ablauf', rows: items.map((it) => ({ ...it, actions: [] })) });
}
```
Nachher:
```ts
export function docFromAblauf(name: string, items: ShowAblaufItem[]): RundownDoc {
  // Als Version 2 einlesen: Zeilen aus dem Show-Ablauf brauchen keine Titel-Zuordnung (4.9).
  return migrate({ schemaVersion: 2, name: name || 'Ablauf', rows: items.map((it) => ({ ...it, actions: [] })) });
}
```

- [ ] **Schritt 12: Test erneut laufen lassen (grün).**

```bash
npm run selftest -w @jm/rundown
```
Erwartet: wie Schritt 7 (`ALLE TESTS OK`, 28 × `ok`, Exit-Code 0). `store.ts` hat keinen eigenen Selbsttest (es importiert `electron`); geprüft wird es im nächsten Schritt.

- [ ] **Schritt 13: Typecheck.**

```bash
npm run typecheck -w @jm/rundown
```
Erwartet: `typecheck:node` und `typecheck:web` laufen durch, keine Zeile mit `error TS`, Exit-Code 0. (Gegengeprüft an einer Kopie der App mit den echten `tsconfig.node.json`/`tsconfig.web.json`: beide grün.)

- [ ] **Schritt 14: Gegenprobe (Spec 9.2 sinngemäß für das Dateiformat).** Je Zeile der Tabelle: die Mutation per Edit einbauen, `npm run selftest -w @jm/rundown` laufen lassen, prüfen, dass **mindestens** die genannten `FAIL`-Zeilen erscheinen und der Exit-Code 1 ist, dann die Mutation per Edit wieder zurücknehmen (Nachher → Vorher). Gemessen am Prototyp auf genau diesem Stand.

| # | Mutation in `apps/rundown/src/shared/doc-format.ts` | muss rot werden (FAIL-Zeilen) |
| --- | --- | --- |
| F1 | Version 1 ohne `zuordnungOffen` | `migrate v1 → schemaVersion 2, …`, `migrate(null) → leeres Dokument`, `migrate(String) → leeres Dokument` (3) |
| F2 | Version 1 behält `quelle`/`entfallen` | `migrate v1 → schemaVersion 2, …` (1) |
| F3 | Version 2 verliert `zuordnungOffen` (Spec 4.1 „bleibt erhalten“) | `migrate v2 → …`, `Fall 24 (Teil 1): v1 ohne Show als v2 gespeichert → zuordnungOffen bleibt` (2) |
| F4 | Version 2 verliert das Archiv | `migrate v2 → …` (1) |

F1 —
<!-- mutation: apps/rundown/src/shared/doc-format.ts -->
Vorher:
```ts
      rows: rohZeilen.map((r) => alsEigeneZeile(normRow(r, neueId))),
      zuordnungOffen: true,
```
Mutation:
```ts
      rows: rohZeilen.map((r) => alsEigeneZeile(normRow(r, neueId))),
```

F2 —
<!-- mutation: apps/rundown/src/shared/doc-format.ts -->
Vorher:
```ts
      rows: rohZeilen.map((r) => alsEigeneZeile(normRow(r, neueId))),
```
Mutation:
```ts
      rows: rohZeilen.map((r) => normRow(r, neueId)), // MUTATION: v1 behält quelle/entfallen
```

F3 —
<!-- mutation: apps/rundown/src/shared/doc-format.ts -->
Vorher:
```ts
  if (o.zuordnungOffen === true) doc.zuordnungOffen = true;
```
Mutation:
```ts
  // MUTATION: zuordnungOffen geht beim Speichern verloren
```

F4 —
<!-- mutation: apps/rundown/src/shared/doc-format.ts -->
Vorher:
```ts
  if (archiv) doc.archiv = archiv;
```
Mutation:
```ts
  // MUTATION: Archiv geht verloren
```

Nach der letzten Rücknahme: `npm run selftest -w @jm/rundown` → `ALLE TESTS OK`, 28 × `ok`. Das Ergebnis (Mutation → rote Fälle) kommt in den Aufgabenbericht.

- [ ] **Schritt 15: Commit.**

```bash
git add apps/rundown/src/shared/types.ts apps/rundown/src/shared/doc-format.ts apps/rundown/src/main/store.ts apps/rundown/test/selftest.ts
git status --short
git commit -m "feat(rundown): Datenmodell v2 mit quelle, entfallen, zielId, kontext und archiv" -m "migrate liegt rein in src/shared/doc-format.ts und ist per Selbsttest geprüft: Version 1 wird zuordnungOffen, Version 2 behält die neuen Felder, geschrieben wird immer schemaVersion 2 (Spec 4.1). store.ts reicht nur newId durch." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
`git status --short` lesen, bevor committet wird: gestagt (erste Spalte `M`/`A`) sind genau `apps/rundown/src/main/store.ts`, `apps/rundown/src/shared/doc-format.ts`, `apps/rundown/src/shared/types.ts`, `apps/rundown/test/selftest.ts`. Fehlt einer, war `git add` unvollständig. Nicht pushen.

**Abweichungen vom Gerüst:**
1. `doc-format.ts` exportiert zusätzlich den Typ `NeueId` sowie `normRow` und `normAction` (beide mit `neueId`-Parameter). Das Gerüst nennt sie nur als Inhalt; die `migrate`-Signatur ist strukturell identisch mit dem Gerüst.
2. `store.ts` behält eine exportierte `migrate(raw)` als dünne Hülle um `doc-format` (`migrateFormat(raw, newId)`). So bleiben `readDoc`, `loadAutosave` und `docFromAblauf` wortgleich.
3. `docFromAblauf` übergibt `schemaVersion: 2`, damit Show-Abläufe bis zur Ablösung in A9/A10 nicht fälschlich `zuordnungOffen` bekommen. Die Funktion selbst und ihre Signatur bleiben.
4. `migrate` verwirft `kontext` und Archiv-Schlüssel, die nicht wie ein Kontext aus Spec 4.4 aussehen (`show`, `se:…`, `liste:…`), darunter auch `__proto__` aus fremdem JSON. Die Spec sagt dazu nichts; es ist eine Härtung des Einlesens.
5. Der Selbsttest-Teil von Fall 24 steht hier (Format: Speichern ohne Show behält `zuordnungOffen`); der Teil mit der Show steht in A6.

**Probelauf (Datum 2026-10-01):**

Nachbau außerhalb des Repos (`teil2a-plan/probe-kern/`): Kopie von `apps/rundown` (Stand `5a4b40eaa1`, CRLF wie im Arbeitsbaum) und `packages/show` mit A1 (Ersetzungen 3–6 wörtlich aus `aufgabe-A1.md`), `@jm/show` per Junction auf diese Kopie. Alle Edit- und Neu-Blöcke dieser Datei wurden per Skript **wörtlich** übernommen (jeder Vorher-Ausschnitt genau einmal gefunden). Selbsttest mit `node --experimental-strip-types test/selftest.ts` (Node 24.16), Typecheck mit dem `tsc` des Repos gegen die echten `tsconfig.node.json`/`tsconfig.web.json` (per `--traceResolution` geprüft: `@jm/show` löst auf die A1-Kopie auf).

| Schritt | Plan | gemessen |
| --- | --- | --- |
| 3 | rot, `ERR_MODULE_NOT_FOUND … doc-format.ts`, kein `ok` | genau so, Exit 1 |
| 7, 12 | 28 × `ok`, `ALLE TESTS OK` | 28 × `ok`, Exit 0 |
| 13 | Typecheck grün | `typecheck:node` 0, `typecheck:web` 0 |
| 14 | F1 3, F2 1, F3 2, F4 1 FAIL | F1 3, F2 1, F3 2, F4 1 — wortgleich die genannten Zeilen; danach wieder 28 × `ok` |

Eigene Fehler (zusätzlich eingebaut, je einzeln, danach zurückgenommen) — alle rot:
- E1 `entfallen` bleibt auch ohne `quelle: 'ablauf'` → `migrate v2 → …` rot.
- E2 jeder String gilt als Kontext → `migrate v2 → …` und `… ungültiger kontext und Archiv-Schlüssel fallen weg` rot.
- E3 Archiv-Zeilen werden nicht normalisiert → `migrate v2 → …` rot.
- E4 leere `zielId` bleibt erhalten → `migrate v2 → …` rot.

Korrekturen: keine. Plan-Code, Tests und erwartete Ausgaben stimmen.

Hinweis für den Umsetzer: Die Gegenprobe F1–F4 gilt für den Stand **nach A4** (28 Prüfungen). Später laufen auch Fälle aus A6 über `migrate`; dort werden F1 und F3 mit mehr `FAIL`-Zeilen rot (gemessen 7 bzw. 4). Das ist kein Fehler.

**Konsistenzprüfung:**
- Korrektur (nur Kommentar in „Produces“): `store.ts`-Signaturen bleiben „bis A10“, nicht „bis A9“. A9 lässt `store.ts` unverändert, A10 entfernt `docFromAblauf` samt `ShowAblaufItem`-Import (A9 Abweichung 1, A10 Schritt 24/25).
- Gesamtnachbau A1–A18: Alle Vorher-Ausschnitte dieser Aufgabe sind auch nach A1–A3 eindeutig; der Endstand des Rundown-Selbsttests ist grün (309 ok in `selftest.ts`, 45 ok im Gedächtnis-Test), Typecheck und Build grün.

---

### Aufgabe A5: Rundown — `gleicheAb` (R0–R9, 4.9), reiner Kern

**Spec:** 3.4 (Ersatz-Kennungen), 3.5 (doppelte Kennungen), 4.2 (`AbgleichBericht`, `gleicheAb`, `umbenannt`), 4.3 (R0–R9), 4.9 (einmalige Titel-Zuordnung), 9.1 Fälle 1–23 inkl. 5b, 12b, 12c, 12d, 14b, 19b, 19c (22/23 hier über `altformat`), 9.2 (Gegenprobe R0, R2, R5, R6, R7, R8, 4.9); Review Focus 3 (Titel wie Ersatz-Kennungen, Doppelte) und 4 (51 Programme + 100 eigene Zeilen < 50 ms).

**Dateien:**
- Create: `apps/rundown/src/shared/abgleich.ts` (Zyklus 1: Bericht und Schlüssel, 95 Zeilen; Zyklus 2: `gleicheAb` wird angehängt, danach 374 Zeilen)
- Test: `apps/rundown/test/selftest.ts` — Import hinter `import type { RundownDoc } from '../src/shared/types.ts';` (Zeile 4), Blöcke vor der Schlusszeile `console.log(failed === 0 …` (heute Zeile 83, nach A4 weiter unten)

**Schnittstellen:**
- Consumes:
  - A1: `ShowAblaufItem.id?: string` aus `@jm/show` (getrimmt, 1–200 Zeichen; `normalizeAblauf` hat doppelte ids schon aufgelöst). Ohne A1 meldet der Typecheck in `abgleich.ts` `TS2339: Property 'id' does not exist on type 'ShowAblaufItem'` (gemessen).
  - A4: `RundownRow.quelle?: 'ablauf'`, `RundownRow.entfallen?: true`, `RundownAction.zielId?: string` aus `apps/rundown/src/shared/types.ts`.
- Produces (exakt wie im Gerüst):
  ```ts
  export interface AbgleichBericht {
    geaendert: number; neu: number; entfallen: number; entfernt: number;
    zurueck: number; verschoben: number;
    scharfVerrueckt: { von: string; nach: string | null } | null;
  }
  export const LEERER_BERICHT: AbgleichBericht; // eingefroren (Object.freeze)
  export function berichtIstLeer(b: AbgleichBericht): boolean;
  export function ersatzSchluessel(ablauf: ShowAblaufItem[]): string[];
  export function gleicheAb(e: {
    alt: RundownRow[]; ablauf: ShowAblaufItem[]; scharfId: string | null; altformat: boolean;
  }): { rows: RundownRow[]; scharfId: string | null; bericht: AbgleichBericht; umbenannt: Record<string, string> };
  ```
  Dazu im Selbsttest (oberste Ebene, für A6 wiederverwendbar): `abBild`, `abAktion`, `abZeile`, `abEigene`, `abPunkt`, `abBericht`, `abEinfrieren`.

**Der Algorithmus in Worten** (Reihenfolge im Code):
1. **R9 Schlüssel** (`ersatzSchluessel`): Punkt mit `id` → die id; ohne → `ersatz:<Titel>`, ab dem zweiten gleichen Titel `#2`, `#3`. Danach über die ganze Liste Doppelte auflösen: der erste behält, jeder weitere bekommt die nächste Nummer `#n`, die weder schon vergeben ist noch irgendwo in der Liste vorkommt. Ein einmaliger Schlüssel behält so immer seinen Wortlaut (`X, X, X#2` → `X, X#3, X#2`).
2. **Kopien.** `alt = e.alt.map(kopiereZeile)`. Ab hier ist `alt[j]` immer dieselbe Zeile wie `e.alt[j]` (nur `id`/`quelle` können sich ändern). Alle weiteren Schritte sind `map` über `alt`, die Stellen bleiben gleich. Das ist der Träger für R6 und R7 (c): „alte Reihenfolge“ heißt im Code „Index `j` in `alt`“.
3. **4.9** (nur bei `altformat`): Eine eigene Zeile wird Ablaufzeile (`id` = Schlüssel, `quelle: 'ablauf'`), wenn ihr Titel im neuen Ablauf **und** unter den eigenen Zeilen je genau einmal vorkommt.
4. **Abwehr kaputter Dokumente:** Tragen mehrere alte Ablaufzeilen dieselbe `id`, bleibt nur die erste Ablaufzeile, jede weitere wird eigene Zeile (nichts geht verloren, Ablauf-ids sind eindeutig).
5. **R0 Titel-Brücke:** verwaist = alte Ablaufzeile (lebend oder entfallen), deren `id` unter den neuen Schlüsseln fehlt; ohne Gegenstück = Punkt, dessen Schlüssel unter den alten Ablaufzeilen fehlt. Titel je genau einmal in beiden Mengen → die Zeile übernimmt den Schlüssel. Nur diese Wechsel landen in `umbenannt`.
6. **Vorgänger vorher** für `verschoben`: Liste der lebenden Ablaufzeilen in `alt` (nach 3–5), je Zeile ihr Vorgänger.
7. **R2/R3:** Je Punkt in Ablaufreihenfolge: alte Ablaufzeile mit gleichem Schlüssel → bleibt mit `id`, `actions` (samt `delayMs`, `enabled`, `zielId`); Titel/Notiz/Dauer aus dem Punkt, nur wenn sie abweichen (`geaendert`, außer sie war entfallen); war sie entfallen → Markierung weg, `zurueck`. Sonst neue Zeile `{ id, quelle: 'ablauf', label, note?, durationMs?, actions: [] }`, `neu`. Status der alten Zeile: `anker`.
8. **R4/R5:** Übrige alte Ablaufzeilen: ohne Aktion → `weg`, `entfernt`; mit mindestens einer Aktion (auch ausgeschaltet) → bleibt mit `entfallen: true`, Text und Aktionen unverändert, `entfallen` nur wenn sie vorher lebte. Eigene Zeilen bleiben unverändert. Beide sind Anhänger.
9. **R6 + R1 Aufbau:** Ein Lauf über `alt` in alter Reihenfolge hält den letzten `anker`. Jeder Anhänger kommt in die Liste dieses Ankers, ohne Anker nach `oben`. Ergebnis = `oben` + je Schlüssel in Ablaufreihenfolge: lebende Zeile, dann ihre Anhänger.
10. **`verschoben`:** lebende Ablaufzeile vorher **und** nachher, deren Vorgänger unter den lebenden Ablaufzeilen gewechselt hat (wörtlich nach 4.2; ein eingefügter Punkt ändert den Vorgänger der Zeile dahinter, Fall 2).
11. **R7** über die `id`, siehe Nachweis.

**Nachweis R6 (Spec-Satz → Code → Fall):**

| Spec R6 | Code | Fall |
| --- | --- | --- |
| Anhänger = eigene Zeilen und entfallene Zeilen | R4/R5-Schleife: eigene → `ergebnisZeile[j] = r`; mit Aktionen → `entfallen: true`; Status bleibt `anhaenger` | 4, 7–10 |
| Anker = nächste Zeile **über** ihm in der **alten** Reihenfolge, die **nach** dem Abgleich lebende Ablaufzeile ist | Lauf über `alt` (= alte Reihenfolge, Index `j`), `anker = r.id` nur bei `status[j] === 'anker'`; `anker` wird erst nach R2/R3/R4/R5 ausgewertet | 8 (B verschwindet → x hängt an A) |
| … auch eine, die nach R2 zurückgekommen ist | Rückkehrer bekommen in R2 `status[j] = 'anker'` | 5b |
| Zeilen, die in diesem Abgleich entfallen, sind Anhänger, kein Anker | R5 setzt keinen `anker`-Status | 12, 15 (`B!` hängt an A) |
| Anhänger eines Ankers direkt hinter ihm, in alter Reihenfolge | `anhaengerVon.get(anker).push(z)` in Lauf-Reihenfolge; Aufbau: lebende Zeile, dann `anhaengerVon.get(k)` | 7, 10 |
| Anhänger ohne Anker ganz oben, in alter Reihenfolge | `oben.push(z)`, Ergebnis beginnt mit `[...oben]` | 9, 19b, R7 (a) |
| Wandert ein Anker (R1), wandern seine Anhänger mit | Aufbau läuft über `schluessel` (Ablaufreihenfolge) und hängt je Schlüssel dessen Anhänger an | 7, 10, 12d |

**Nachweis R7 (Spec-Satz → Code → Fall):**

| Spec R7 | Code | Fall |
| --- | --- | --- |
| (a) `scharfId` null oder nicht unter den **alten** Zeilen → erste nicht entfallene des Ergebnisses, ohne `scharfVerrueckt` | `iScharf = e.alt.findIndex(id)` über die **Original**-ids; `< 0` → `rows.find(nichtEntfallen)` | 14b, R7 (a), 16 |
| (b) bleibt als lebende Ablaufzeile oder eigene Zeile erhalten, auch über R0 (und 4.9), auch an neuer Stelle | `ergebnisZeile[iScharf]` ist genau die Zeile im Ergebnis (gleiches Objekt); nicht entfallen → deren (ggf. neue) `id` | 11, 12d, 19, 19c, 22, 21 |
| (c) entfallen (R5) oder verschwunden (R4) → erste Zeile, die in der **alten** Reihenfolge hinter ihr stand und im Ergebnis nicht entfallen ist (Suche über die id) | Schleife `j = iScharf + 1 … alt.length` über `ergebnisZeile[j]` (Index-Gleichheit = id-Suche, weil `ergebnisZeile[j]` genau das Ergebnisobjekt ist) | 12, 12b (C, nicht Nummer 2 = A), 12c |
| … sonst die letzte nicht entfallene des Ergebnisses; sonst `null` | `[...rows].reverse().find(nichtEntfallen)`; `?? null` | 13, 14 |
| Nur in (c) `scharfVerrueckt` | gesetzt nur im `else`-Zweig, `von` = alter Titel, `nach` = Titel im Ergebnis oder `null` | 11, 12d (null) gegen 12, 13, 14 |

**R8:** Kein eigener Tiefenvergleich. Jede Zeilenänderung entsteht nur in einer Regel, die zählt (R2 Text → `geaendert`, Rückkehr → `zurueck`, R3 → `neu`, R4 → `entfernt`, R5 → `entfallen`, Umordnung → `verschoben`). Bleibt alles gleich, zählt nichts. Gegenprobe M6 und M9 zeigen beide Richtungen. Ausnahme laut Spec 7.2 und R0: Eine Umbenennung über R0 ändert die `id`, der Bericht bleibt leer (Fall 19, 19c). Das gilt ebenso für die Titel-Zuordnung 4.9 (Fall 22). Der Aufrufer sieht diese Änderung an `umbenannt` bzw. am gelöschten `zuordnungOffen`.

---

#### Zyklus 1: Bericht und Schlüssel

- [ ] **Schritt 1: Testimport ergänzen** in `apps/rundown/test/selftest.ts`.

<!-- edit: apps/rundown/test/selftest.ts -->
Vorher:
```ts
import type { RundownDoc } from '../src/shared/types.ts';
```
Nachher:
```ts
import type { RundownDoc } from '../src/shared/types.ts';
import { LEERER_BERICHT, berichtIstLeer, ersatzSchluessel } from '../src/shared/abgleich.ts';
```

- [ ] **Schritt 2: Fehlschlagenden Testblock einfügen** direkt vor der Schlusszeile (hinter dem Block aus A4).

<!-- edit: apps/rundown/test/selftest.ts -->
Vorher:
```ts
console.log(failed === 0 ? '\nALLE TESTS OK' : `\n${failed} FEHLER`);
```
Nachher:
```ts
// ── Abgleich: Schlüssel und Bericht (Master-Link 2a, Spec 3.4, 3.5, R9) ──────
eq(ersatzSchluessel([{ id: 'u1', label: 'A' }, { label: 'B' }]), ['u1', 'ersatz:B'], 'Schlüssel: id, sonst ersatz:<Titel>');
eq(ersatzSchluessel([]), [], 'Schlüssel: leerer Ablauf → keine');
eq(
  ersatzSchluessel([{ label: 'X' }, { label: 'X' }, { label: 'X' }]),
  ['ersatz:X', 'ersatz:X#2', 'ersatz:X#3'],
  'Fall 17: gleiche Titel ohne Kennungen → ersatz:X, ersatz:X#2, ersatz:X#3',
);
eq(
  ersatzSchluessel([{ id: 'u1', label: 'A' }, { id: 'u1', label: 'B' }, { id: 'u1', label: 'C' }]),
  ['u1', 'u1#2', 'u1#3'],
  'Fall 18: doppelte Kennungen im Ablauf → #2, #3',
);
// Review-Focus 3: Titel, die wie Ersatz-Kennungen aussehen, kollidieren nicht.
eq(
  ersatzSchluessel([{ label: 'Panel' }, { label: 'Panel' }, { label: 'Panel#2' }]),
  ['ersatz:Panel', 'ersatz:Panel#2', 'ersatz:Panel#2#2'],
  'RF3: Titel „Panel#2“ neben zweimal „Panel“ → drei verschiedene Schlüssel',
);
eq(
  ersatzSchluessel([{ label: 'Panel' }, { label: 'Panel' }, { label: 'Panel #2' }]),
  ['ersatz:Panel', 'ersatz:Panel#2', 'ersatz:Panel #2'],
  'RF3: Titel „Panel #2“ (mit Leerzeichen) → eigener Schlüssel',
);
eq(
  ersatzSchluessel([{ id: 'ersatz:X', label: 'A' }, { label: 'X' }, { label: 'ersatz:X' }]),
  ['ersatz:X', 'ersatz:X#2', 'ersatz:ersatz:X'],
  'RF3: echte Kennung „ersatz:X“ und Titel „X“/„ersatz:X“ → keine Kollision',
);
eq(
  ersatzSchluessel([{ id: 'X', label: 'A' }, { id: 'X', label: 'B' }, { id: 'X#2', label: 'C' }]),
  ['X', 'X#3', 'X#2'],
  'R9: einmaliger Schlüssel „X#2“ behält seinen Wortlaut, die Doppelung weicht auf #3 aus',
);

eq(
  LEERER_BERICHT,
  { geaendert: 0, neu: 0, entfallen: 0, entfernt: 0, zurueck: 0, verschoben: 0, scharfVerrueckt: null },
  'LEERER_BERICHT: alle Zähler 0',
);
eq(Object.isFrozen(LEERER_BERICHT), true, 'LEERER_BERICHT ist eingefroren');
eq(berichtIstLeer(LEERER_BERICHT), true, 'berichtIstLeer(LEERER_BERICHT)');
eq(berichtIstLeer({ ...LEERER_BERICHT, verschoben: 1 }), false, 'berichtIstLeer: verschoben 1 → nicht leer');
eq(berichtIstLeer({ ...LEERER_BERICHT, scharfVerrueckt: { von: 'A', nach: null } }), false, 'berichtIstLeer: scharfVerrueckt → nicht leer');

console.log(failed === 0 ? '\nALLE TESTS OK' : `\n${failed} FEHLER`);
```

- [ ] **Schritt 3: Test laufen lassen (rot).**

```bash
npm run selftest -w @jm/rundown
```
Erwartet: Abbruch beim Laden, kein `ok`, Exit-Code 1:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…\apps\rundown\src\shared\abgleich.ts' imported from …\apps\rundown\test\selftest.ts
```

- [ ] **Schritt 4: `apps/rundown/src/shared/abgleich.ts` anlegen** (ganzer Inhalt von Zyklus 1).

<!-- neu: apps/rundown/src/shared/abgleich.ts -->
```ts
// Abgleich des Rundown-Dokuments mit dem Show-Ablauf (Master-Link 2a, #235).
//
// Jeder Ablaufpunkt hat einen festen Schlüssel (seine Kennung, sonst eine
// Ersatz-Kennung). Ablaufzeilen tragen ihn als `id`. Der Abgleich hält daran
// Aktionen, Position der eigenen Zeilen und die scharfe Zeile fest (Spec 4.3).
//
// Rein: kein electron, kein node:, keine Uhr, kein Zufall, keine Paket-
// Laufzeitimporte, zwischen Modulen nur `import type` (Selbsttest unter
// `node --experimental-strip-types`). Neue Ablaufzeilen bekommen ihren Schlüssel
// als id; die Funktionen vergeben keine Zufalls-IDs und verändern ihre
// Eingaben nicht.
import type { ShowAblaufItem } from '@jm/show';

export interface AbgleichBericht {
  /** lebende Ablaufzeilen mit neuem Titel, Notiz oder Dauer */
  geaendert: number;
  /** neu hinzugekommene Ablaufzeilen (R3) */
  neu: number;
  /** neu als entfallen markiert (R5) */
  entfallen: number;
  /** ohne Aktionen weggefallen (R4) */
  entfernt: number;
  /** vorher entfallen, jetzt wieder lebend (R2) */
  zurueck: number;
  /** lebende Ablaufzeilen, deren Vorgänger unter den lebenden Ablaufzeilen gewechselt hat */
  verschoben: number;
  /** Titel der scharfen Zeile vorher/nachher — nur bei R7 (c) */
  scharfVerrueckt: { von: string; nach: string | null } | null;
}

/** Bericht ohne jede Änderung (R8). Eingefroren, Aufrufer kopieren ihn. */
export const LEERER_BERICHT: AbgleichBericht = Object.freeze({
  geaendert: 0,
  neu: 0,
  entfallen: 0,
  entfernt: 0,
  zurueck: 0,
  verschoben: 0,
  scharfVerrueckt: null,
});

/** true, wenn der Bericht nichts meldet (alle Zähler 0, keine verrückte scharfe Zeile). */
export function berichtIstLeer(b: AbgleichBericht): boolean {
  return (
    b.geaendert === 0 &&
    b.neu === 0 &&
    b.entfallen === 0 &&
    b.entfernt === 0 &&
    b.zurueck === 0 &&
    b.verschoben === 0 &&
    b.scharfVerrueckt === null
  );
}

/**
 * Schlüssel je Ablaufpunkt, in Ablaufreihenfolge (Spec 3.4, 3.5, R9).
 * 1. Punkt mit `id` → die id. Punkt ohne → `ersatz:<Titel>`, beim zweiten
 *    Vorkommen desselben Titels unter den Punkten ohne id `ersatz:<Titel>#2`,
 *    beim dritten `#3` …
 * 2. Danach über die ganze Liste doppelte Schlüssel auflösen: der erste behält
 *    ihn, jeder weitere bekommt `#2`, `#3` … — jeweils die nächste Nummer, die
 *    weder schon vergeben ist noch irgendwo in der Liste als Schlüssel vorkommt.
 *    So behält ein einmaliger Schlüssel immer seinen Wortlaut.
 */
export function ersatzSchluessel(ablauf: ShowAblaufItem[]): string[] {
  const titelZaehler = new Map<string, number>();
  const roh = ablauf.map((p) => {
    if (typeof p.id === 'string' && p.id) return p.id;
    const n = (titelZaehler.get(p.label) ?? 0) + 1;
    titelZaehler.set(p.label, n);
    return n === 1 ? `ersatz:${p.label}` : `ersatz:${p.label}#${n}`;
  });
  return loeseDoppelteAuf(roh);
}

function loeseDoppelteAuf(roh: string[]): string[] {
  const vorhanden = new Set(roh);
  const vergeben = new Set<string>();
  const letzteNummer = new Map<string, number>();
  return roh.map((k) => {
    if (!vergeben.has(k)) {
      vergeben.add(k);
      return k;
    }
    let n = letzteNummer.get(k) ?? 1;
    let kandidat: string;
    do {
      n++;
      kandidat = `${k}#${n}`;
    } while (vergeben.has(kandidat) || vorhanden.has(kandidat));
    letzteNummer.set(k, n);
    vergeben.add(kandidat);
    return kandidat;
  });
}
```

- [ ] **Schritt 5: Test laufen lassen (grün).**

```bash
npm run selftest -w @jm/rundown
```
Erwartet: `ALLE TESTS OK`, Exit-Code 0, **41** × `ok` (28 + 13), darunter:
```
ok   Fall 17: gleiche Titel ohne Kennungen → ersatz:X, ersatz:X#2, ersatz:X#3
ok   Fall 18: doppelte Kennungen im Ablauf → #2, #3
ok   RF3: Titel „Panel#2“ neben zweimal „Panel“ → drei verschiedene Schlüssel
ok   R9: einmaliger Schlüssel „X#2“ behält seinen Wortlaut, die Doppelung weicht auf #3 aus
ok   LEERER_BERICHT ist eingefroren
```

- [ ] **Schritt 6: Typecheck.**

```bash
npm run typecheck -w @jm/rundown
```
Erwartet: keine Zeile mit `error TS`, Exit-Code 0 (setzt A1 voraus, siehe Consumes).

#### Zyklus 2: `gleicheAb`

- [ ] **Schritt 7: Testimporte erweitern** in `apps/rundown/test/selftest.ts`. Die Typen werden nur für die Lesbarkeit importiert (`import type` fällt beim Ausführen weg).

<!-- edit: apps/rundown/test/selftest.ts -->
Vorher:
```ts
import { LEERER_BERICHT, berichtIstLeer, ersatzSchluessel } from '../src/shared/abgleich.ts';
```
Nachher:
```ts
import { LEERER_BERICHT, berichtIstLeer, ersatzSchluessel, gleicheAb } from '../src/shared/abgleich.ts';
import type { AbgleichBericht } from '../src/shared/abgleich.ts';
import type { RundownAction, RundownRow } from '../src/shared/types.ts';
import type { ShowAblaufItem } from '@jm/show';
```

- [ ] **Schritt 8: Fehlschlagende Fälle 1–23, Review Focus 3/4 einfügen** direkt vor der Schlusszeile. Die Hilfen `abBild` … `abEinfrieren` stehen auf oberster Ebene (A6 nutzt sie), jeder Fall in eigenem `{ … }`. Kurzbild: Ablaufzeile `A`, entfallene `A!`, eigene `+x`, Aktionen `[a1]`. Ablaufpunkte und -zeilen heißen „Punkt <id>“, wenn nicht anders angegeben.

<!-- edit: apps/rundown/test/selftest.ts -->
Vorher:
```ts
console.log(failed === 0 ? '\nALLE TESTS OK' : `\n${failed} FEHLER`);
```
Nachher:
```ts
// ── gleicheAb: Abgleich im selben Kontext (Master-Link 2a, Spec 4.3, 4.9, 9.1) ─
// Kurzbild einer Zeilenliste: Ablaufzeile „id“, entfallene „id!“, eigene „+id“,
// dahinter die Aktions-IDs in [].
function abBild(rows: RundownRow[]): string[] {
  return rows.map(
    (r) =>
      `${r.quelle === 'ablauf' ? '' : '+'}${r.id}${r.entfallen ? '!' : ''}` +
      (r.actions.length ? `[${r.actions.map((a) => a.id).join(',')}]` : ''),
  );
}
function abAktion(id: string, extra: Partial<RundownAction> = {}): RundownAction {
  return { id, role: 'titler', verb: 'take', args: [], enabled: true, ...extra };
}
/** Ablaufzeile (quelle 'ablauf'), Titel „Punkt <id>“, wenn nicht angegeben. */
function abZeile(id: string, actions: RundownAction[] = [], extra: Partial<RundownRow> = {}): RundownRow {
  return { id, quelle: 'ablauf', label: `Punkt ${id}`, actions, ...extra };
}
function abEigene(id: string, actions: RundownAction[] = [], label = `Eigene ${id}`): RundownRow {
  return { id, label, actions };
}
/** Ablaufpunkt mit Kennung, Titel „Punkt <id>“, wenn nicht angegeben. */
function abPunkt(id: string, extra: Partial<ShowAblaufItem> = {}): ShowAblaufItem {
  return { id, label: `Punkt ${id}`, ...extra };
}
function abBericht(teil: Partial<AbgleichBericht> = {}): AbgleichBericht {
  return { ...LEERER_BERICHT, ...teil };
}
/** Tief einfrieren: jede Veränderung der Eingabe wirft im strikten Modus. */
function abEinfrieren<T>(x: T): T {
  if (x && typeof x === 'object') {
    for (const v of Object.values(x as Record<string, unknown>)) abEinfrieren(v);
    Object.freeze(x);
  }
  return x;
}

{
  // Fall 1: gleiche Schlüssel, neuer Titel/Notiz/Dauer → Text neu, Aktionen samt delayMs/enabled/zielId gleich.
  const a1 = abAktion('a1', { enabled: false, delayMs: 500, zielId: 'B' });
  const e = gleicheAb({
    alt: [abZeile('A', [a1], { note: 'alt', durationMs: 60000 }), abZeile('B')],
    ablauf: [abPunkt('A', { label: 'Punkt A neu', note: 'neu', durationMs: 90000 }), abPunkt('B')],
    scharfId: 'A',
    altformat: false,
  });
  eq(abBild(e.rows), ['A[a1]', 'B'], 'Fall 1: Zeilen');
  eq([e.rows[0]?.label, e.rows[0]?.note, e.rows[0]?.durationMs], ['Punkt A neu', 'neu', 90000], 'Fall 1: Titel, Notiz, Dauer aus dem Ablauf');
  eq(e.rows[0]?.actions, [{ id: 'a1', role: 'titler', verb: 'take', args: [], enabled: false, delayMs: 500, zielId: 'B' }], 'Fall 1: Aktionen unverändert (R2)');
  eq(e.scharfId, 'A', 'Fall 1: scharf bleibt');
  eq(e.bericht, abBericht({ geaendert: 1 }), 'Fall 1: geaendert 1');
  eq(e.umbenannt, {}, 'Fall 1: keine Umbenennung');
}
{
  // Fall 1b: Notiz und Dauer fehlen im neuen Ablauf → Felder fallen weg.
  const e = gleicheAb({
    alt: [abZeile('A', [], { note: 'weg', durationMs: 1000 })],
    ablauf: [abPunkt('A')],
    scharfId: 'A',
    altformat: false,
  });
  eq(e.rows, [{ id: 'A', quelle: 'ablauf', label: 'Punkt A', actions: [] }], 'Fall 1b: note/durationMs entfernt');
  eq(e.bericht, abBericht({ geaendert: 1 }), 'Fall 1b: geaendert 1');
}
{
  // Fall 1c: nur die Notiz ändert sich → Notiz neu, Aktionen bleiben.
  const e = gleicheAb({
    alt: [abZeile('A', [abAktion('a1')], { note: 'alt' })],
    ablauf: [abPunkt('A', { note: 'neu' })],
    scharfId: 'A',
    altformat: false,
  });
  eq(e.rows, [{ id: 'A', quelle: 'ablauf', label: 'Punkt A', actions: [abAktion('a1')], note: 'neu' }], 'Fall 1c: nur Notiz geändert → Notiz neu');
  eq(e.bericht, abBericht({ geaendert: 1 }), 'Fall 1c: geaendert 1');
}
{
  // Fall 1d: nur die Dauer ändert sich → Dauer neu.
  const e = gleicheAb({
    alt: [abZeile('A', [], { durationMs: 60000 })],
    ablauf: [abPunkt('A', { durationMs: 90000 })],
    scharfId: 'A',
    altformat: false,
  });
  eq(e.rows, [{ id: 'A', quelle: 'ablauf', label: 'Punkt A', actions: [], durationMs: 90000 }], 'Fall 1d: nur Dauer geändert → Dauer neu');
  eq(e.bericht, abBericht({ geaendert: 1 }), 'Fall 1d: geaendert 1');
}
{
  // Fall 2: neuer Punkt in der Mitte → neue Zeile an iveo-Stelle; B hat jetzt N als Vorgänger.
  const e = gleicheAb({
    alt: [abZeile('A', [abAktion('a1')]), abZeile('B', [abAktion('b1')])],
    ablauf: [abPunkt('A'), abPunkt('N', { note: 'Bühne 2', durationMs: 300000 }), abPunkt('B')],
    scharfId: 'A',
    altformat: false,
  });
  eq(abBild(e.rows), ['A[a1]', 'N', 'B[b1]'], 'Fall 2: Zeilen');
  eq(
    e.rows[1],
    { id: 'N', quelle: 'ablauf', label: 'Punkt N', note: 'Bühne 2', durationMs: 300000, actions: [] },
    'Fall 2: neue Zeile ohne Aktionen, Notiz und Dauer aus dem Punkt (R3)',
  );
  eq(e.bericht, abBericht({ neu: 1, verschoben: 1 }), 'Fall 2: neu 1, verschoben 1');
}
{
  // Fall 3: Punkt ohne Aktionen weg → Zeile weg.
  const e = gleicheAb({
    alt: [abZeile('A', [abAktion('a1')]), abZeile('B'), abZeile('C')],
    ablauf: [abPunkt('A'), abPunkt('B')],
    scharfId: 'A',
    altformat: false,
  });
  eq(abBild(e.rows), ['A[a1]', 'B'], 'Fall 3: Zeilen');
  eq(e.bericht, abBericht({ entfernt: 1 }), 'Fall 3: entfernt 1');
}
{
  // R4 gilt auch für eine schon entfallene Zeile, deren letzte Aktion inzwischen gelöscht wurde.
  const e = gleicheAb({
    alt: [abZeile('A'), abZeile('B', [], { entfallen: true })],
    ablauf: [abPunkt('A')],
    scharfId: 'A',
    altformat: false,
  });
  eq(abBild(e.rows), ['A'], 'R4: entfallene Zeile ohne Aktionen verschwindet');
  eq(e.bericht, abBericht({ entfernt: 1 }), 'R4: entfernt 1');
}
{
  // Fall 4: Punkt mit einer AUSGESCHALTETEN Aktion weg → bleibt, entfallen.
  const e = gleicheAb({
    alt: [abZeile('A'), abZeile('B'), abZeile('C', [abAktion('c1', { enabled: false })])],
    ablauf: [abPunkt('A'), abPunkt('B')],
    scharfId: 'A',
    altformat: false,
  });
  eq(abBild(e.rows), ['A', 'B', 'C![c1]'], 'Fall 4: Zeilen');
  eq([e.rows[2]?.label, e.rows[2]?.actions[0]?.enabled], ['Punkt C', false], 'Fall 4: Text und Aktion unverändert');
  eq(e.bericht, abBericht({ entfallen: 1 }), 'Fall 4: entfallen 1');
}
{
  // Fall 5: entfallener Punkt kommt zurück → Markierung weg, Aktionen da.
  const e = gleicheAb({
    alt: [abZeile('A'), abZeile('B', [abAktion('b1')], { entfallen: true })],
    ablauf: [abPunkt('A'), abPunkt('B')],
    scharfId: 'A',
    altformat: false,
  });
  eq(abBild(e.rows), ['A', 'B[b1]'], 'Fall 5: Zeilen');
  eq(e.rows[1] && 'entfallen' in e.rows[1], false, 'Fall 5: Markierung weg');
  eq(e.bericht, abBericht({ zurueck: 1 }), 'Fall 5: zurueck 1');
}
{
  // Fall 5b: alt A, B (entfallen, 1 Aktion), X (eigen); neu A, B → A, B, X.
  const e = gleicheAb({
    alt: [abZeile('A'), abZeile('B', [abAktion('b1')], { entfallen: true }), abEigene('X')],
    ablauf: [abPunkt('A'), abPunkt('B')],
    scharfId: 'A',
    altformat: false,
  });
  eq(abBild(e.rows), ['A', 'B[b1]', '+X'], 'Fall 5b: zurückgekommene Zeile ist wieder Anker');
  eq(e.bericht, abBericht({ zurueck: 1 }), 'Fall 5b: zurueck 1');
}
{
  // Fall 5c: entfallene Zeile kommt mit neuem Titel zurück → Text aus dem Ablauf (R2), zählt nur als zurueck.
  const e = gleicheAb({
    alt: [abZeile('A'), abZeile('B', [abAktion('b1')], { entfallen: true, note: 'alt' })],
    ablauf: [abPunkt('A'), abPunkt('B', { label: 'B neu' })],
    scharfId: 'A',
    altformat: false,
  });
  eq(e.rows[1], { id: 'B', quelle: 'ablauf', label: 'B neu', actions: [abAktion('b1')] }, 'Fall 5c: Titel neu, Notiz weg, Markierung weg');
  eq(e.bericht, abBericht({ zurueck: 1 }), 'Fall 5c: zurueck 1, nicht zusätzlich geaendert');
}
{
  // Fall 6: Umsortieren C, A statt A, C → iveo-Reihenfolge, Aktionen wandern mit.
  const e = gleicheAb({
    alt: [abZeile('A', [abAktion('a1')]), abZeile('C', [abAktion('c1')])],
    ablauf: [abPunkt('C'), abPunkt('A')],
    scharfId: 'A',
    altformat: false,
  });
  eq(abBild(e.rows), ['C[c1]', 'A[a1]'], 'Fall 6: Zeilen');
  eq(e.bericht, abBericht({ verschoben: 2 }), 'Fall 6: verschoben 2 (A und C haben neue Vorgänger)');
}
{
  // Fall 7: eigene Zeile hinter B, B wandert nach vorne → eigene Zeile wandert mit.
  const e = gleicheAb({
    alt: [abZeile('A'), abZeile('B'), abEigene('x')],
    ablauf: [abPunkt('B'), abPunkt('A')],
    scharfId: 'A',
    altformat: false,
  });
  eq(abBild(e.rows), ['B', '+x', 'A'], 'Fall 7: Zeilen');
  eq(e.bericht, abBericht({ verschoben: 2 }), 'Fall 7: verschoben 2');
}
{
  // Fall 8: eigene Zeile hinter B, B weg ohne Aktionen → eigene Zeile hängt an A.
  const e = gleicheAb({
    alt: [abZeile('A'), abZeile('B'), abEigene('x')],
    ablauf: [abPunkt('A')],
    scharfId: 'A',
    altformat: false,
  });
  eq(abBild(e.rows), ['A', '+x'], 'Fall 8: Zeilen');
  eq(e.bericht, abBericht({ entfernt: 1 }), 'Fall 8: entfernt 1');
}
{
  // Fall 9: eigene Zeilen ganz oben bleiben ganz oben, auch wenn oben ein Punkt dazukommt.
  const e = gleicheAb({
    alt: [abEigene('x'), abEigene('y'), abZeile('A'), abZeile('B')],
    ablauf: [abPunkt('N'), abPunkt('A'), abPunkt('B')],
    scharfId: 'A',
    altformat: false,
  });
  eq(abBild(e.rows), ['+x', '+y', 'N', 'A', 'B'], 'Fall 9: Zeilen');
  eq(e.bericht, abBericht({ neu: 1, verschoben: 1 }), 'Fall 9: neu 1, verschoben 1');
}
{
  // Fall 10: zwei eigene Zeilen hinter B behalten ihre Reihenfolge.
  const e = gleicheAb({
    alt: [abZeile('A'), abZeile('B'), abEigene('x'), abEigene('y')],
    ablauf: [abPunkt('B'), abPunkt('A')],
    scharfId: 'A',
    altformat: false,
  });
  eq(abBild(e.rows), ['B', '+x', '+y', 'A'], 'Fall 10: Zeilen');
}
{
  // Fall 11: scharfe Zeile wandert (an eine andere Nummer) → bleibt scharf.
  const e = gleicheAb({
    alt: [abZeile('A'), abZeile('B'), abZeile('C')],
    ablauf: [abPunkt('C'), abPunkt('A'), abPunkt('B')],
    scharfId: 'B',
    altformat: false,
  });
  eq(abBild(e.rows), ['C', 'A', 'B'], 'Fall 11: Zeilen');
  eq(e.scharfId, 'B', 'Fall 11: B bleibt scharf (jetzt Nummer 3)');
  eq(e.bericht, abBericht({ verschoben: 2 }), 'Fall 11: verschoben 2, scharfVerrueckt null');
}
{
  // Fall 12: scharfe Zeile entfällt mit Aktionen → nächste nicht entfallene dahinter.
  const e = gleicheAb({
    alt: [abZeile('A'), abZeile('B', [abAktion('b1')]), abZeile('C')],
    ablauf: [abPunkt('A'), abPunkt('C')],
    scharfId: 'B',
    altformat: false,
  });
  eq(abBild(e.rows), ['A', 'B![b1]', 'C'], 'Fall 12: Zeilen');
  eq(e.scharfId, 'C', 'Fall 12: C scharf');
  eq(
    e.bericht,
    abBericht({ entfallen: 1, verschoben: 1, scharfVerrueckt: { von: 'Punkt B', nach: 'Punkt C' } }),
    'Fall 12: entfallen 1, verschoben 1, scharfVerrueckt B → C',
  );
}
{
  // Fall 12b: alt A, B* (1 Aktion), C; neu C, A → B entfällt, scharf ist C (nicht die Nummer 2 = A).
  const e = gleicheAb({
    alt: [abZeile('A'), abZeile('B', [abAktion('b1')]), abZeile('C')],
    ablauf: [abPunkt('C'), abPunkt('A')],
    scharfId: 'B',
    altformat: false,
  });
  eq(abBild(e.rows), ['C', 'A', 'B![b1]'], 'Fall 12b: Zeilen');
  eq(e.scharfId, 'C', 'Fall 12b: C scharf');
  eq(
    e.bericht,
    abBericht({ entfallen: 1, verschoben: 2, scharfVerrueckt: { von: 'Punkt B', nach: 'Punkt C' } }),
    'Fall 12b: Bericht',
  );
}
{
  // Fall 12c: scharfe Zeile ohne Aktionen verschwindet (R4) → Nachfolger nach R7 (c).
  const e = gleicheAb({
    alt: [abZeile('A'), abZeile('B'), abZeile('C')],
    ablauf: [abPunkt('A'), abPunkt('C')],
    scharfId: 'B',
    altformat: false,
  });
  eq(abBild(e.rows), ['A', 'C'], 'Fall 12c: Zeilen');
  eq(e.scharfId, 'C', 'Fall 12c: C scharf');
  eq(
    e.bericht,
    abBericht({ entfernt: 1, verschoben: 1, scharfVerrueckt: { von: 'Punkt B', nach: 'Punkt C' } }),
    'Fall 12c: Bericht',
  );
}
{
  // Fall 12d: eine eigene Zeile ist scharf, ihr Anker wandert → bleibt scharf.
  const e = gleicheAb({
    alt: [abZeile('A'), abZeile('B'), abEigene('x')],
    ablauf: [abPunkt('B'), abPunkt('A')],
    scharfId: 'x',
    altformat: false,
  });
  eq(abBild(e.rows), ['B', '+x', 'A'], 'Fall 12d: Zeilen');
  eq(e.scharfId, 'x', 'Fall 12d: x bleibt scharf');
  eq(e.bericht.scharfVerrueckt, null, 'Fall 12d: scharfVerrueckt null');
}
{
  // Fall 13: scharfe Zeile ist die letzte und entfällt → letzte nicht entfallene.
  const e = gleicheAb({
    alt: [abZeile('A'), abZeile('B'), abZeile('C', [abAktion('c1')])],
    ablauf: [abPunkt('A'), abPunkt('B')],
    scharfId: 'C',
    altformat: false,
  });
  eq(abBild(e.rows), ['A', 'B', 'C![c1]'], 'Fall 13: Zeilen');
  eq(e.scharfId, 'B', 'Fall 13: B scharf');
  eq(e.bericht, abBericht({ entfallen: 1, scharfVerrueckt: { von: 'Punkt C', nach: 'Punkt B' } }), 'Fall 13: Bericht');
}
{
  // Fall 14: alle Zeilen entfallen → scharfId null.
  const e = gleicheAb({
    alt: [abZeile('A', [abAktion('a1')]), abZeile('B', [abAktion('b1')])],
    ablauf: [],
    scharfId: 'A',
    altformat: false,
  });
  eq(abBild(e.rows), ['A![a1]', 'B![b1]'], 'Fall 14: Zeilen');
  eq(e.scharfId, null, 'Fall 14: scharfId null');
  eq(e.bericht, abBericht({ entfallen: 2, scharfVerrueckt: { von: 'Punkt A', nach: null } }), 'Fall 14: Bericht');
}
{
  // Fall 14b: scharfId null, der Ablauf bringt wieder Punkte → erste Zeile scharf.
  const e = gleicheAb({
    alt: [abZeile('A', [abAktion('a1')], { entfallen: true }), abZeile('B', [abAktion('b1')], { entfallen: true })],
    ablauf: [abPunkt('A')],
    scharfId: null,
    altformat: false,
  });
  eq(abBild(e.rows), ['A[a1]', 'B![b1]'], 'Fall 14b: Zeilen');
  eq(e.scharfId, 'A', 'Fall 14b: A scharf');
  eq(e.bericht, abBericht({ zurueck: 1 }), 'Fall 14b: zurueck 1, scharfVerrueckt null');
}
{
  // R7 (a): unbekannte scharfId → erste nicht entfallene, ohne scharfVerrueckt.
  const e = gleicheAb({
    alt: [abZeile('A', [abAktion('a1')], { entfallen: true }), abEigene('x'), abZeile('B')],
    ablauf: [abPunkt('B')],
    scharfId: 'gibt-es-nicht',
    altformat: false,
  });
  eq(abBild(e.rows), ['A![a1]', '+x', 'B'], 'R7 (a): Zeilen');
  eq([e.scharfId, e.bericht.scharfVerrueckt], ['x', null], 'R7 (a): x (erste nicht entfallene) scharf, ohne Meldung');
}
{
  // Fall 15 (R8): zweimal derselbe Ablauf → gleiches Ergebnis, zweiter Bericht leer.
  const alt = [
    abEigene('oben'),
    abZeile('A', [abAktion('a1')]),
    abEigene('x'),
    abZeile('B', [abAktion('b1')]),
    abZeile('C'),
    abZeile('D', [abAktion('d1')], { entfallen: true }),
  ];
  const ablauf = [abPunkt('C', { label: 'C neu' }), abPunkt('N'), abPunkt('A')];
  const erst = gleicheAb({ alt, ablauf, scharfId: 'B', altformat: false });
  const zweit = gleicheAb({ alt: erst.rows, ablauf, scharfId: erst.scharfId, altformat: false });
  eq(abBild(erst.rows), ['+oben', 'C', 'D![d1]', 'N', 'A[a1]', '+x', 'B![b1]'], 'Fall 15: erstes Ergebnis');
  eq(
    [erst.scharfId, erst.bericht],
    ['C', abBericht({ geaendert: 1, neu: 1, entfallen: 1, verschoben: 2, scharfVerrueckt: { von: 'Punkt B', nach: 'C neu' } })],
    'Fall 15: erster Bericht',
  );
  eq(zweit.rows, erst.rows, 'Fall 15: zweites Ergebnis = erstes (tief)');
  eq(zweit.scharfId, erst.scharfId, 'Fall 15: scharfe Zeile gleich');
  eq(zweit.bericht, LEERER_BERICHT, 'Fall 15: zweiter Bericht leer');
}
{
  // Fall 16: Ablauf ohne Kennungen → Ersatz-Kennungen, zweimal hintereinander stabil.
  const ablauf: ShowAblaufItem[] = [{ label: 'Begrüßung' }, { label: 'Keynote', durationMs: 1800000 }];
  const erst = gleicheAb({ alt: [], ablauf, scharfId: null, altformat: false });
  eq(
    erst.rows,
    [
      { id: 'ersatz:Begrüßung', quelle: 'ablauf', label: 'Begrüßung', actions: [] },
      { id: 'ersatz:Keynote', quelle: 'ablauf', label: 'Keynote', durationMs: 1800000, actions: [] },
    ],
    'Fall 16: Ersatz-Kennungen als id',
  );
  eq([erst.scharfId, erst.bericht], ['ersatz:Begrüßung', abBericht({ neu: 2 })], 'Fall 16: erste Zeile scharf, neu 2');
  const zweit = gleicheAb({ alt: erst.rows, ablauf, scharfId: erst.scharfId, altformat: false });
  eq([zweit.rows, zweit.bericht], [erst.rows, LEERER_BERICHT], 'Fall 16: zweiter Lauf stabil, Bericht leer');
}
{
  // Fall 17/18 in gleicheAb: Zeilen tragen die aufgelösten Schlüssel.
  const e17 = gleicheAb({ alt: [], ablauf: [{ label: 'X' }, { label: 'X' }], scharfId: null, altformat: false });
  eq(abBild(e17.rows), ['ersatz:X', 'ersatz:X#2'], 'Fall 17: Zeilen ersatz:X, ersatz:X#2');
  const e18 = gleicheAb({ alt: [], ablauf: [abPunkt('u1'), abPunkt('u1', { label: 'Zweiter' })], scharfId: null, altformat: false });
  eq(abBild(e18.rows), ['u1', 'u1#2'], 'Fall 18: Zeilen u1, u1#2');
}
{
  // Review-Focus 3: Titel wie Ersatz-Kennungen, doppelt → keine Kollision, zweimal stabil.
  const ablauf: ShowAblaufItem[] = [
    { label: 'Panel' },
    { label: 'Panel' },
    { label: 'Panel#2' },
    { label: 'ersatz:X' },
    { label: 'X' },
    { id: 'ersatz:X', label: 'Echt' },
  ];
  const erst = gleicheAb({ alt: [], ablauf, scharfId: null, altformat: false });
  const ids = erst.rows.map((r) => r.id);
  eq(new Set(ids).size, 6, 'RF3: sechs verschiedene Schlüssel');
  const zweit = gleicheAb({ alt: erst.rows, ablauf, scharfId: erst.scharfId, altformat: false });
  eq([zweit.rows, zweit.bericht], [erst.rows, LEERER_BERICHT], 'RF3: zweiter Lauf stabil, Bericht leer');
}
{
  // Fall 19 (R0): Zeile ersatz:X mit Aktionen, neuer Ablauf { id: 'u1', label: 'X' } → Zeile u1.
  const e = gleicheAb({
    alt: [abZeile('ersatz:X', [abAktion('a1')], { label: 'X' })],
    ablauf: [{ id: 'u1', label: 'X' }],
    scharfId: 'ersatz:X',
    altformat: false,
  });
  eq(abBild(e.rows), ['u1[a1]'], 'Fall 19: Zeile u1 mit denselben Aktionen');
  eq(e.bericht, LEERER_BERICHT, 'Fall 19: neu 0, entfallen 0 (Bericht leer)');
  eq(e.umbenannt, { 'ersatz:X': 'u1' }, 'Fall 19: umbenannt ersatz:X → u1');
  eq(e.scharfId, 'u1', 'Fall 19: scharf folgt über R0');
}
{
  // Fall 19b: R0 mit doppeltem Titel → keine Brücke.
  const e1 = gleicheAb({
    alt: [abZeile('ersatz:X', [abAktion('a1')], { label: 'X' })],
    ablauf: [{ id: 'u1', label: 'X' }, { id: 'u2', label: 'X' }],
    scharfId: null,
    altformat: false,
  });
  eq(abBild(e1.rows), ['ersatz:X![a1]', 'u1', 'u2'], 'Fall 19b: Titel doppelt im Ablauf → alte Zeile entfällt');
  eq([e1.bericht, e1.umbenannt], [abBericht({ neu: 2, entfallen: 1 }), {}], 'Fall 19b: neu 2, entfallen 1, keine Brücke');
  const e2 = gleicheAb({
    alt: [abZeile('ersatz:X', [abAktion('a1')], { label: 'X' }), abZeile('ersatz:X#2', [], { label: 'X' })],
    ablauf: [{ id: 'u1', label: 'X' }],
    scharfId: null,
    altformat: false,
  });
  eq(abBild(e2.rows), ['ersatz:X![a1]', 'u1'], 'Fall 19b: Titel doppelt unter verwaisten Zeilen → entfällt bzw. verschwindet');
  eq([e2.bericht, e2.umbenannt], [abBericht({ neu: 1, entfallen: 1, entfernt: 1 }), {}], 'Fall 19b: Bericht ohne Brücke');
}
{
  // Fall 19c: R0 rückwärts — echte Kennung → nur noch Ersatz-Kennung, Aktionen bleiben.
  const e = gleicheAb({
    alt: [abZeile('u1', [abAktion('a1')], { label: 'X' })],
    ablauf: [{ label: 'X' }],
    scharfId: 'u1',
    altformat: false,
  });
  eq(abBild(e.rows), ['ersatz:X[a1]'], 'Fall 19c: Zeile ersatz:X mit Aktionen');
  eq([e.umbenannt, e.bericht, e.scharfId], [{ u1: 'ersatz:X' }, LEERER_BERICHT, 'ersatz:X'], 'Fall 19c: umbenannt, Bericht leer, scharf folgt');
}
{
  // Fall 20: „Als eigene Zeile behalten“, danach kommt der Punkt zurück → beide, keine doppelte id.
  const e = gleicheAb({
    alt: [abZeile('A'), abEigene('r_b', [abAktion('b1')], 'Punkt B')],
    ablauf: [abPunkt('A'), abPunkt('B')],
    scharfId: 'A',
    altformat: false,
  });
  eq(abBild(e.rows), ['A', '+r_b[b1]', 'B'], 'Fall 20: eigene Zeile und neue Ablaufzeile');
  eq(new Set(e.rows.map((r) => r.id)).size, e.rows.length, 'Fall 20: keine doppelte id');
  eq(e.bericht, abBericht({ neu: 1 }), 'Fall 20: neu 1');
}
{
  // Fall 21: Ablaufzeile duplizieren (Kopie = eigene Zeile), dann derselbe Ablauf → Kopie bleibt dahinter.
  const alt = [
    abZeile('A', [abAktion('a1')]),
    abEigene('r_kopie', [abAktion('a1k')], 'Punkt A (Kopie)'),
    abZeile('B'),
  ];
  const e = gleicheAb({ alt, ablauf: [abPunkt('A'), abPunkt('B')], scharfId: 'r_kopie', altformat: false });
  eq(e.rows, alt, 'Fall 21: Zeilen unverändert, Kopie direkt hinter dem Original');
  eq([e.scharfId, e.bericht], ['r_kopie', LEERER_BERICHT], 'Fall 21: Bericht leer');
}
{
  // Fall 22 (4.9): Altformat, Titel eindeutig → Zuordnung, Aktionen an der Ablaufzeile.
  const e = gleicheAb({
    alt: [
      abEigene('r1', [abAktion('a1')], 'Begrüßung'),
      abEigene('r2', [abAktion('a2')], 'Keynote'),
      abEigene('r3', [], 'Pause'),
    ],
    ablauf: [{ id: 'u1', label: 'Begrüßung' }, { id: 'u2', label: 'Keynote' }, { id: 'u3', label: 'Pause' }],
    scharfId: 'r2',
    altformat: true,
  });
  eq(abBild(e.rows), ['u1[a1]', 'u2[a2]', 'u3'], 'Fall 22: alte Zeilen werden Ablaufzeilen');
  eq([e.scharfId, e.bericht, e.umbenannt], ['u2', LEERER_BERICHT, {}], 'Fall 22: scharf folgt, Bericht leer');
}
{
  // Fall 23 (4.9): Altformat, Titel doppelt → keine Zuordnung, Ablaufzeilen kommen dazu.
  const e = gleicheAb({
    alt: [abEigene('r1', [abAktion('a1')], 'Panel'), abEigene('r2', [abAktion('a2')], 'Panel'), abEigene('r3', [abAktion('a3')], 'Pause')],
    ablauf: [{ id: 'u1', label: 'Panel' }, { id: 'u2', label: 'Panel' }, { id: 'u3', label: 'Pause' }],
    scharfId: null,
    altformat: true,
  });
  eq(abBild(e.rows), ['+r1[a1]', '+r2[a2]', 'u1', 'u2', 'u3[a3]'], 'Fall 23: doppelte Titel bleiben eigene Zeilen');
  eq(e.bericht, abBericht({ neu: 2, verschoben: 1 }), 'Fall 23: neu 2');
  const e2 = gleicheAb({
    alt: [abEigene('r1', [abAktion('a1')], 'Panel'), abEigene('r2', [abAktion('a2')], 'Panel')],
    ablauf: [{ id: 'u1', label: 'Panel' }],
    scharfId: null,
    altformat: true,
  });
  eq(abBild(e2.rows), ['+r1[a1]', '+r2[a2]', 'u1'], 'Fall 23: Titel einmal im Ablauf, zweimal alt → keine Zuordnung');
  const e3 = gleicheAb({
    alt: [abEigene('r1', [abAktion('a1')], 'Panel')],
    ablauf: [{ id: 'u1', label: 'Panel' }],
    scharfId: null,
    altformat: false,
  });
  eq(abBild(e3.rows), ['+r1[a1]', 'u1'], 'Fall 23: ohne altformat keine Titel-Zuordnung');
}
{
  // Kaputtes Dokument: zwei alte Ablaufzeilen mit derselben id → keine Zeile geht verloren.
  const e = gleicheAb({
    alt: [abZeile('A', [abAktion('a1')]), abZeile('A', [abAktion('a2')])],
    ablauf: [abPunkt('A')],
    scharfId: 'A',
    altformat: false,
  });
  eq(abBild(e.rows), ['A[a1]', '+A[a2]'], 'doppelte alte id: zweite Zeile wird eigene Zeile');
}
{
  // Eingaben bleiben unverändert (tief eingefroren; jede Schreibung würde werfen).
  const alt = abEinfrieren([
    abEigene('x', [abAktion('x1')]),
    abZeile('A', [abAktion('a1', { zielId: 'B' })], { note: 'n' }),
    abZeile('B', [abAktion('b1')]),
    abZeile('ersatz:Q', [abAktion('q1')], { label: 'Q' }),
  ]);
  const ablauf = abEinfrieren([abPunkt('B', { label: 'B neu' }), { id: 'q', label: 'Q' }]);
  const vorher = JSON.stringify([alt, ablauf]);
  gleicheAb({ alt, ablauf, scharfId: 'A', altformat: true });
  eq(JSON.stringify([alt, ablauf]), vorher, 'gleicheAb verändert seine Eingaben nicht');
}
{
  // Review-Focus 4: großer Ablauf (51 Programme, 100 eigene Zeilen) → unter 50 ms.
  const ablauf51 = Array.from({ length: 51 }, (_, i) => abPunkt(`p${i}`));
  const alt: RundownRow[] = [];
  ablauf51.forEach((p, i) => {
    alt.push(abZeile(p.id as string, [abAktion(`a${i}`), abAktion(`b${i}`)]));
    if (i < 50) alt.push(abEigene(`x${i}`, [abAktion(`x${i}`)]), abEigene(`y${i}`));
  });
  const neu = [...ablauf51.slice(5).reverse(), ...Array.from({ length: 5 }, (_, i) => abPunkt(`n${i}`))];
  const t0 = performance.now();
  const e = gleicheAb({ alt, ablauf: neu, scharfId: 'p10', altformat: false });
  const ms = performance.now() - t0;
  eq(ms < 50, true, `RF4: 51 Programme + 100 eigene Zeilen in ${ms.toFixed(2)} ms (< 50 ms)`);
  eq([e.rows.length, e.bericht.neu, e.bericht.entfallen, e.scharfId], [156, 5, 5, 'p10'], 'RF4: 156 Zeilen, neu 5, entfallen 5, scharf p10');
}

console.log(failed === 0 ? '\nALLE TESTS OK' : `\n${failed} FEHLER`);
```

- [ ] **Schritt 9: Test laufen lassen (rot).**

```bash
npm run selftest -w @jm/rundown
```
Erwartet: Abbruch beim Laden, kein `ok`, Exit-Code 1:
```
SyntaxError: The requested module '../src/shared/abgleich.ts' does not provide an export named 'gleicheAb'
```

- [ ] **Schritt 10: Typimport für Zeilen ergänzen** in `apps/rundown/src/shared/abgleich.ts`.

<!-- edit: apps/rundown/src/shared/abgleich.ts -->
Vorher:
```ts
import type { ShowAblaufItem } from '@jm/show';
```
Nachher:
```ts
import type { ShowAblaufItem } from '@jm/show';
import type { RundownRow } from './types';
```

- [ ] **Schritt 11: `gleicheAb` samt Hilfsfunktionen anhängen** in `apps/rundown/src/shared/abgleich.ts` (hinter `loeseDoppelteAuf`, Dateiende).

<!-- edit: apps/rundown/src/shared/abgleich.ts -->
Vorher:
```ts
    vergeben.add(kandidat);
    return kandidat;
  });
}
```
Nachher:
```ts
    vergeben.add(kandidat);
    return kandidat;
  });
}

// ── Abgleich im selben Kontext (Spec 4.3, 4.9) ──────────────────────────────

function istAblaufzeile(r: RundownRow): boolean {
  return r.quelle === 'ablauf';
}

function istEntfallen(r: RundownRow): boolean {
  return r.quelle === 'ablauf' && r.entfallen === true;
}

function kopiereZeile(r: RundownRow): RundownRow {
  return { ...r, actions: r.actions.map((a) => ({ ...a, args: a.args.slice() })) };
}

function alsEigene(r: RundownRow): RundownRow {
  const z = { ...r };
  delete z.quelle;
  delete z.entfallen;
  return z;
}

function zaehle(werte: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const w of werte) m.set(w, (m.get(w) ?? 0) + 1);
  return m;
}

/** Dauer wie im Dateiformat: ganze ms > 0, sonst 0 (= ohne). */
function dauerVon(p: ShowAblaufItem): number {
  return typeof p.durationMs === 'number' && p.durationMs > 0 ? Math.trunc(p.durationMs) : 0;
}

/** Weicht der Text der Zeile (Titel, Notiz, Dauer) vom Ablaufpunkt ab? */
function textWeichtAb(z: RundownRow, p: ShowAblaufItem): boolean {
  return z.label !== p.label || (z.note ?? '') !== (p.note ?? '') || (z.durationMs ?? 0) !== dauerVon(p);
}

/** Titel, Notiz und Dauer aus dem Ablaufpunkt übernehmen (R2). */
function uebernimmText(z: RundownRow, p: ShowAblaufItem): void {
  z.label = p.label;
  if (p.note) z.note = p.note;
  else delete z.note;
  const dauer = dauerVon(p);
  if (dauer > 0) z.durationMs = dauer;
  else delete z.durationMs;
}

/** R3: neue Ablaufzeile ohne Aktionen, id = Schlüssel. */
function neueAblaufzeile(k: string, p: ShowAblaufItem): RundownRow {
  const dauer = dauerVon(p);
  return {
    id: k,
    quelle: 'ablauf',
    label: p.label,
    ...(p.note ? { note: p.note } : {}),
    ...(dauer > 0 ? { durationMs: dauer } : {}),
    actions: [],
  };
}

/**
 * 4.9: einmalige Titel-Zuordnung für Version-1-Dokumente. Eine eigene Zeile
 * wird zur Ablaufzeile (id = Schlüssel), wenn ihr Titel im neuen Ablauf und
 * unter den eigenen Zeilen je genau einmal vorkommt. Aktionen bleiben.
 */
function ordneTitelZu(alt: RundownRow[], ablauf: ShowAblaufItem[], schluessel: string[]): RundownRow[] {
  const imAblauf = zaehle(ablauf.map((p) => p.label));
  const unterAlten = zaehle(alt.filter((r) => !istAblaufzeile(r)).map((r) => r.label));
  const zielSchluessel = new Map<string, string>(); // Titel → Schlüssel
  ablauf.forEach((p, i) => {
    if (imAblauf.get(p.label) === 1 && unterAlten.get(p.label) === 1) zielSchluessel.set(p.label, schluessel[i]);
  });
  return alt.map((r) => {
    if (istAblaufzeile(r)) return r;
    const k = zielSchluessel.get(r.label);
    return k === undefined ? r : { ...r, id: k, quelle: 'ablauf' };
  });
}

/**
 * Abwehr kaputter Dokumente: Tragen mehrere alte Ablaufzeilen dieselbe id,
 * gilt nur die erste als Ablaufzeile; jede weitere wird eigene Zeile. So geht
 * keine Zeile verloren und jede id ist unter den Ablaufzeilen eindeutig.
 */
function entdoppleAblaufzeilen(alt: RundownRow[]): RundownRow[] {
  const gesehen = new Set<string>();
  return alt.map((r) => {
    if (!istAblaufzeile(r)) return r;
    if (!gesehen.has(r.id)) {
      gesehen.add(r.id);
      return r;
    }
    return alsEigene(r);
  });
}

/**
 * R0 Titel-Brücke. Verwaist = alte Ablaufzeile (lebend oder entfallen), deren
 * id unter den neuen Schlüsseln fehlt. Ohne Gegenstück = neuer Punkt, dessen
 * Schlüssel unter den alten Ablaufzeilen fehlt. Gleicher Titel, der unter den
 * verwaisten Zeilen UND unter den Punkten ohne Gegenstück je genau einmal
 * vorkommt → die Zeile übernimmt den Schlüssel. Liefert alte id → Schlüssel.
 */
function titelBruecke(alt: RundownRow[], ablauf: ShowAblaufItem[], schluessel: string[]): Map<string, string> {
  const neueSchluessel = new Set(schluessel);
  const alteIds = new Set(alt.filter(istAblaufzeile).map((r) => r.id));
  const verwaist = alt.filter((r) => istAblaufzeile(r) && !neueSchluessel.has(r.id));
  const ohneGegenstueck = ablauf
    .map((p, i) => ({ label: p.label, k: schluessel[i] }))
    .filter(({ k }) => !alteIds.has(k));
  const titelVerwaist = zaehle(verwaist.map((r) => r.label));
  const titelOhne = zaehle(ohneGegenstueck.map(({ label }) => label));
  const bruecke = new Map<string, string>();
  for (const { label, k } of ohneGegenstueck) {
    if (titelOhne.get(label) !== 1 || titelVerwaist.get(label) !== 1) continue;
    const v = verwaist.find((r) => r.label === label);
    if (v) bruecke.set(v.id, k);
  }
  return bruecke;
}

/** Was nach dem Abgleich aus einer alten Zeile wird. */
type Status = 'anker' | 'anhaenger' | 'weg';

/**
 * Abgleich im selben Kontext (Spec 4.3). Reihenfolge:
 * Schlüssel (R9) → Titel-Zuordnung (4.9, nur `altformat`) → R0 → R2/R3 → R4/R5
 * → Aufbau R1+R6 → scharfe Zeile R7 → Bericht (R8 folgt aus den Regeln).
 *
 * `ablauf` ist normalisiert (`normalizeAblauf` aus @jm/show, bzw. über
 * `parseShow`). Die Eingaben werden nicht verändert.
 */
export function gleicheAb(e: {
  alt: RundownRow[];
  ablauf: ShowAblaufItem[];
  scharfId: string | null;
  altformat: boolean;
}): { rows: RundownRow[]; scharfId: string | null; bericht: AbgleichBericht; umbenannt: Record<string, string> } {
  const bericht: AbgleichBericht = { ...LEERER_BERICHT };

  // R9: Schlüssel des neuen Ablaufs.
  const schluessel = ersatzSchluessel(e.ablauf);

  // Kopien der alten Zeilen. Ab hier gilt: alt[j] ist dieselbe Zeile wie e.alt[j],
  // nur mit nachgeführter id/quelle (Index bleibt). Das trägt R6 und R7 (c).
  let alt = e.alt.map(kopiereZeile);
  if (e.altformat) alt = ordneTitelZu(alt, e.ablauf, schluessel);
  alt = entdoppleAblaufzeilen(alt);

  // R0: Titel-Brücke.
  const bruecke = titelBruecke(alt, e.ablauf, schluessel);
  alt = alt.map((r) => {
    const k = istAblaufzeile(r) ? bruecke.get(r.id) : undefined;
    return k === undefined ? r : { ...r, id: k };
  });

  // Vorgänger jeder lebenden Ablaufzeile VOR dem Abgleich (für `verschoben`).
  const vorgaengerAlt = new Map<string, string | null>();
  let vorige: string | null = null;
  for (const r of alt) {
    if (istAblaufzeile(r) && !istEntfallen(r)) {
      vorgaengerAlt.set(r.id, vorige);
      vorige = r.id;
    }
  }

  // R2/R3: jeder Punkt des neuen Ablaufs bekommt genau eine lebende Ablaufzeile.
  const altIndexVon = new Map<string, number>(); // id → Index, nur Ablaufzeilen
  alt.forEach((r, j) => {
    if (istAblaufzeile(r)) altIndexVon.set(r.id, j);
  });
  const status: Status[] = alt.map(() => 'anhaenger');
  const ergebnisZeile: (RundownRow | undefined)[] = alt.map(() => undefined);
  const lebend = new Map<string, RundownRow>(); // Schlüssel → lebende Ablaufzeile
  e.ablauf.forEach((p, i) => {
    const k = schluessel[i];
    const j = altIndexVon.get(k);
    if (j === undefined) {
      lebend.set(k, neueAblaufzeile(k, p)); // R3
      bericht.neu++;
      return;
    }
    // R2: alte Zeile bleibt mit id und actions; Text kommt aus dem Ablauf.
    const vorher = alt[j];
    const z: RundownRow = { ...vorher };
    if (textWeichtAb(vorher, p)) {
      uebernimmText(z, p);
      if (!istEntfallen(vorher)) bericht.geaendert++;
    }
    if (istEntfallen(vorher)) {
      delete z.entfallen;
      bericht.zurueck++;
    }
    lebend.set(k, z);
    status[j] = 'anker';
    ergebnisZeile[j] = z;
  });

  // R4/R5: verwaiste Ablaufzeilen. Eigene Zeilen bleiben unverändert Anhänger.
  alt.forEach((r, j) => {
    if (status[j] === 'anker') return;
    if (!istAblaufzeile(r)) {
      ergebnisZeile[j] = r;
      return;
    }
    if (r.actions.length === 0) {
      status[j] = 'weg'; // R4
      bericht.entfernt++;
      return;
    }
    if (!istEntfallen(r)) bericht.entfallen++; // R5
    ergebnisZeile[j] = istEntfallen(r) ? r : { ...r, entfallen: true };
  });

  // R6: Anker eines Anhängers = nächste Zeile ÜBER ihm (alte Reihenfolge), die
  // NACH dem Abgleich lebende Ablaufzeile ist (status 'anker'). Entfallene und
  // verschwundene Zeilen sind kein Anker.
  const oben: RundownRow[] = [];
  const anhaengerVon = new Map<string, RundownRow[]>();
  let anker: string | null = null;
  alt.forEach((r, j) => {
    if (status[j] === 'anker') {
      anker = r.id;
      return;
    }
    const z = ergebnisZeile[j];
    if (status[j] === 'weg' || !z) return;
    if (anker === null) {
      oben.push(z);
      return;
    }
    const liste = anhaengerVon.get(anker);
    if (liste) liste.push(z);
    else anhaengerVon.set(anker, [z]);
  });

  // R1: lebende Ablaufzeilen in Ablaufreihenfolge, je mit ihren Anhängern;
  // Anhänger ohne Anker ganz oben.
  const rows: RundownRow[] = [...oben];
  for (const k of schluessel) {
    const z = lebend.get(k);
    if (z) rows.push(z);
    rows.push(...(anhaengerVon.get(k) ?? []));
  }

  // verschoben: lebend vorher und nachher, Vorgänger unter den lebenden Ablaufzeilen gewechselt.
  let vorigeNeu: string | null = null;
  for (const k of schluessel) {
    if (vorgaengerAlt.has(k) && vorgaengerAlt.get(k) !== vorigeNeu) bericht.verschoben++;
    vorigeNeu = k;
  }

  // R7: scharfe Zeile über die id.
  const nichtEntfallen = (z: RundownRow | undefined): z is RundownRow => z !== undefined && !istEntfallen(z);
  const iScharf = e.scharfId === null ? -1 : e.alt.findIndex((r) => r.id === e.scharfId);
  let scharfId: string | null;
  if (iScharf < 0) {
    // (a) keine oder unbekannte scharfe Zeile → erste nicht entfallene.
    scharfId = rows.find((z) => nichtEntfallen(z))?.id ?? null;
  } else if (nichtEntfallen(ergebnisZeile[iScharf])) {
    // (b) bleibt als lebende Ablaufzeile oder eigene Zeile erhalten (auch über R0/4.9).
    scharfId = (ergebnisZeile[iScharf] as RundownRow).id;
  } else {
    // (c) entfallen oder verschwunden → erste Zeile, die in der ALTEN Reihenfolge
    // hinter ihr stand und im Ergebnis nicht entfallen ist; sonst die letzte
    // nicht entfallene des Ergebnisses; sonst null.
    let nach: RundownRow | undefined;
    for (let j = iScharf + 1; j < alt.length && !nach; j++) {
      if (nichtEntfallen(ergebnisZeile[j])) nach = ergebnisZeile[j];
    }
    if (!nach) nach = [...rows].reverse().find((z) => nichtEntfallen(z));
    scharfId = nach?.id ?? null;
    bericht.scharfVerrueckt = { von: e.alt[iScharf].label, nach: nach?.label ?? null };
  }

  return { rows, scharfId, bericht, umbenannt: Object.fromEntries(bruecke) };
}
```

- [ ] **Schritt 12: Test laufen lassen (grün).**

```bash
npm run selftest -w @jm/rundown
```
Erwartet: `ALLE TESTS OK`, Exit-Code 0, **142** × `ok` (41 + 101). Stichproben:
```
ok   Fall 1c: nur Notiz geändert → Notiz neu
ok   Fall 5c: Titel neu, Notiz weg, Markierung weg
ok   Fall 12b: C scharf
ok   Fall 15: zweiter Bericht leer
ok   Fall 19: umbenannt ersatz:X → u1
ok   Fall 23: doppelte Titel bleiben eigene Zeilen
ok   gleicheAb verändert seine Eingaben nicht
ok   RF4: 51 Programme + 100 eigene Zeilen in 0.14 ms (< 50 ms)
```
(Die Millisekunden schwanken; im Probelauf gemessen 0,14 ms.)

- [ ] **Schritt 13: Typecheck.**

```bash
npm run typecheck -w @jm/rundown
```
Erwartet: keine Zeile mit `error TS`, Exit-Code 0. (Gegengeprüft an einer Kopie der App mit den echten tsconfigs und A1-Typen: `typecheck:node` und `typecheck:web` grün.)

- [ ] **Schritt 14: Gegenprobe (Spec 9.2: R0, R2, R5, R6, R7, R8, 4.9).** Je Zeile: Mutation per Edit in `apps/rundown/src/shared/abgleich.ts` einbauen, `npm run selftest -w @jm/rundown`, prüfen, dass mindestens die **Pflicht**-Fälle als `FAIL` erscheinen (Exit-Code 1), Mutation zurücknehmen. Gemessen im Probelauf auf genau diesem Stand (142 Prüfungen); in Klammern die Zahl aller FAIL-Zeilen.

| # | Spec 9.2 | Mutation | Pflicht rot | weitere rote Fälle (gemessen) |
| --- | --- | --- | --- | --- |
| M1 | R0 fehlt | keine Brücke | Fall 19, 19c | – (5) |
| M2 | R2 übernimmt die Aktionen nicht | R2-Zeile mit `actions: []` | Fall 1 „Aktionen unverändert (R2)“ | 1c, 2, 3, 5, 5b, 5c, 6, 14b, 15, 19, 19c, 21, 22, 23, doppelte alte id (17) |
| M3a | R5 ohne Unterschied (alle verschwinden) | `if (true)` statt `r.actions.length === 0` | Fall 4 | 12, 12b, 13, 14, 14b, R7 (a), 15, 19b, RF4 (21) |
| M3b | R5 ohne Unterschied (alle bleiben) | `if (false)` statt `r.actions.length === 0` | Fall 3, 8 | R4 (entfallene Zeile ohne Aktionen), 12c, 19b (10) |
| M4 | R6: Anker = alte statt überlebende Zeile | jede alte Ablaufzeile setzt den Anker | Fall 8 | 4, 12, 12b, 13, 14, 14b, R7 (a), 15, 19b, RF4 (14) |
| M5 | R7 über die Nummer statt über die Kennung | scharf = Ergebniszeile an der alten Nummer | Fall 11, 12b | 12, 12c, 12d, 13, 14, 15, RF4 (13) |
| M6 | R8 ohne Idempotenz (Bericht zählt immer) | jede zugeordnete Zeile zählt `geaendert` | Fall 15 „zweiter Bericht leer“, 16, 21 | 1–9, 5b, 5c, R4, 11–13, RF3, 19, 19c, 20, 22, 23 (27) |
| M7 | 4.9 ohne Eindeutigkeitsprüfung | erste Zeile mit gleichem Titel wird zugeordnet | Fall 23 | – (3) |
| M8 | R7 (c) in neuer statt alter Reihenfolge (zusätzlich) | Nachfolger im Ergebnis suchen | Fall 12b | 15 (3) |
| M9 | R8 umgekehrt: Umordnung bleibt unbemerkt (zusätzlich) | `verschoben` wird nie gezählt | Fall 6, 7, 11 | 2, 9, 12, 12b, 12c, 15, 23 (10) |
| M10 | R2: zurückkehrende Zeile behält den alten Text (zusätzlich) | Text nur bei vorher lebender Zeile übernehmen | Fall 5c „Titel neu, Notiz weg, Markierung weg“ | – (1) |
| M11 | R2: reine Notiz-Änderung bleibt unbemerkt (zusätzlich) | `textWeichtAb` ohne Notiz | Fall 1c (beide Prüfungen) | – (2) |
| M12 | R2: reine Dauer-Änderung bleibt unbemerkt (zusätzlich) | `textWeichtAb` ohne Dauer | Fall 1d (beide Prüfungen) | – (2) |
| M13 | R3: neue Zeile ohne Notiz (zusätzlich) | `neueAblaufzeile` ohne `note` | Fall 2 „neue Zeile ohne Aktionen, Notiz und Dauer aus dem Punkt (R3)“ | – (1) |

M1 —
<!-- mutation: apps/rundown/src/shared/abgleich.ts -->
Vorher:
```ts
  const bruecke = titelBruecke(alt, e.ablauf, schluessel);
```
Mutation:
```ts
  const bruecke = new Map<string, string>(); // MUTATION: R0 fehlt
```

M2 —
<!-- mutation: apps/rundown/src/shared/abgleich.ts -->
Vorher:
```ts
    const z: RundownRow = { ...vorher };
```
Mutation:
```ts
    const z: RundownRow = { ...vorher, actions: [] }; // MUTATION: R2 ohne Aktionen
```

M3a —
<!-- mutation: apps/rundown/src/shared/abgleich.ts -->
Vorher:
```ts
    if (r.actions.length === 0) {
      status[j] = 'weg'; // R4
```
Mutation:
```ts
    if (true) { // MUTATION: R5 wie R4
      status[j] = 'weg'; // R4
```

M3b —
<!-- mutation: apps/rundown/src/shared/abgleich.ts -->
Vorher:
```ts
    if (r.actions.length === 0) {
      status[j] = 'weg'; // R4
```
Mutation:
```ts
    if (false) { // MUTATION: R4 wie R5
      status[j] = 'weg'; // R4
```

M4 —
<!-- mutation: apps/rundown/src/shared/abgleich.ts -->
Vorher:
```ts
    if (status[j] === 'anker') {
      anker = r.id;
      return;
    }
```
Mutation:
```ts
    if (istAblaufzeile(r)) anker = r.id; // MUTATION: Anker = alte Ablaufzeile, ob sie überlebt oder nicht
    if (status[j] === 'anker') return;
```

M5 —
<!-- mutation: apps/rundown/src/shared/abgleich.ts -->
Vorher:
```ts
  } else if (nichtEntfallen(ergebnisZeile[iScharf])) {
    // (b) bleibt als lebende Ablaufzeile oder eigene Zeile erhalten (auch über R0/4.9).
    scharfId = (ergebnisZeile[iScharf] as RundownRow).id;
  } else {
```
Mutation:
```ts
  } else if (true) {
    // MUTATION: scharfe Zeile über die alte Nummer statt über die id
    scharfId = rows[Math.min(iScharf, rows.length - 1)]?.id ?? null;
  } else {
```

M6 —
<!-- mutation: apps/rundown/src/shared/abgleich.ts -->
Vorher:
```ts
    if (textWeichtAb(vorher, p)) {
      uebernimmText(z, p);
      if (!istEntfallen(vorher)) bericht.geaendert++;
    }
```
Mutation:
```ts
    uebernimmText(z, p); // MUTATION: zählt jede zugeordnete Zeile als geändert
    if (!istEntfallen(vorher)) bericht.geaendert++;
```

M7 —
<!-- mutation: apps/rundown/src/shared/abgleich.ts -->
Vorher:
```ts
    if (imAblauf.get(p.label) === 1 && unterAlten.get(p.label) === 1) zielSchluessel.set(p.label, schluessel[i]);
```
Mutation:
```ts
    if (!zielSchluessel.has(p.label)) zielSchluessel.set(p.label, schluessel[i]); // MUTATION: ohne Eindeutigkeit
```

M8 —
<!-- mutation: apps/rundown/src/shared/abgleich.ts -->
Vorher:
```ts
    for (let j = iScharf + 1; j < alt.length && !nach; j++) {
      if (nichtEntfallen(ergebnisZeile[j])) nach = ergebnisZeile[j];
    }
```
Mutation:
```ts
    // MUTATION: Nachfolger in der NEUEN statt der alten Reihenfolge suchen
    const posNeu = rows.findIndex((z) => z === ergebnisZeile[iScharf]);
    for (let j = posNeu + 1; posNeu >= 0 && j < rows.length && !nach; j++) {
      if (nichtEntfallen(rows[j])) nach = rows[j];
    }
```

M9 —
<!-- mutation: apps/rundown/src/shared/abgleich.ts -->
Vorher:
```ts
    if (vorgaengerAlt.has(k) && vorgaengerAlt.get(k) !== vorigeNeu) bericht.verschoben++;
```
Mutation:
```ts
    // MUTATION: verschoben wird nie gezählt
```

M10 —
<!-- mutation: apps/rundown/src/shared/abgleich.ts -->
Vorher:
```ts
    if (textWeichtAb(vorher, p)) {
```
Mutation:
```ts
    if (textWeichtAb(vorher, p) && !istEntfallen(vorher)) { // MUTATION: Rückkehrer behalten den alten Text
```

M11 —
<!-- mutation: apps/rundown/src/shared/abgleich.ts -->
Vorher:
```ts
  return z.label !== p.label || (z.note ?? '') !== (p.note ?? '') || (z.durationMs ?? 0) !== dauerVon(p);
```
Mutation:
```ts
  return z.label !== p.label || (z.durationMs ?? 0) !== dauerVon(p); // MUTATION: Notiz-Änderung übersehen
```

M12 —
<!-- mutation: apps/rundown/src/shared/abgleich.ts -->
Vorher:
```ts
  return z.label !== p.label || (z.note ?? '') !== (p.note ?? '') || (z.durationMs ?? 0) !== dauerVon(p);
```
Mutation:
```ts
  return z.label !== p.label || (z.note ?? '') !== (p.note ?? ''); // MUTATION: Dauer-Änderung übersehen
```

M13 —
<!-- mutation: apps/rundown/src/shared/abgleich.ts -->
Vorher:
```ts
    ...(p.note ? { note: p.note } : {}),
```
Mutation:
```ts
    // MUTATION: neue Ablaufzeile ohne Notiz
```

Nach der letzten Rücknahme: `npm run selftest -w @jm/rundown` → `ALLE TESTS OK`, 142 × `ok`. Das Ergebnis (Mutation → rote Fälle) kommt in den Aufgabenbericht.

- [ ] **Schritt 15: Commit.**

```bash
git add apps/rundown/src/shared/abgleich.ts apps/rundown/test/selftest.ts
git status --short
git commit -m "feat(rundown): gleicheAb gleicht Zeilen über feste Kennungen ab (R0-R9, Titel-Zuordnung)" -m "Reiner Kern in src/shared/abgleich.ts: Ersatz-Kennungen, Titel-Brücke, entfallene Zeilen mit Aktionen bleiben, eigene Zeilen hängen an ihrem überlebenden Anker, scharfe Zeile über die id (Spec 4.3, 4.9). Selbsttest mit Spec 9.1 Fällen 1-23 und Gegenprobe 9.2." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
`git status --short` lesen: gestagt sind genau `apps/rundown/src/shared/abgleich.ts` (`A`) und `apps/rundown/test/selftest.ts` (`M`). Nicht pushen.

**Abweichungen vom Gerüst:**
1. Reihenfolge im Algorithmus: Die Schlüssel (R9) werden **vor** der Titel-Zuordnung 4.9 gebildet, weil 4.9 `id = Schlüssel` setzt. Das Gerüst nennt 4.9 zuerst; Ergebnis und Regeln sind dieselben (die Schlüsselbildung hängt nicht von den alten Zeilen ab).
2. `verschoben` wird wörtlich nach Spec 4.2 gezählt (Vorgänger unter allen lebenden Ablaufzeilen vorher bzw. nachher, gezählt für Zeilen, die vorher und nachher leben). Folge: Ein eingefügter oder weggefallener Punkt in der Mitte ändert den Vorgänger der Zeile dahinter und zählt `verschoben: 1` (Fall 2: `neu 1, verschoben 1`; Fall 12: `entfallen 1, verschoben 1`). Die Fälle 3 und 4 („ein nicht genannter Zähler ist 0“) entfernen deshalb den **letzten** Punkt.
3. Ein Text-Abgleich (R2) schreibt Titel/Notiz/Dauer nur, wenn sie abweichen, und vergleicht Dauer wie das Dateiformat (ganze ms > 0). So bleibt R8 auch bei Zeilen mit `note: ''` exakt.
4. Zusätzliche Abwehr: doppelte `id` unter den alten Ablaufzeilen → ab der zweiten eigene Zeile (Test „doppelte alte id“). Spec und Gerüst sagen dazu nichts; ohne sie ginge in der internen Zuordnung eine Zeile verloren.
5. Zusätzliche Gegenproben über die Spec-Liste hinaus: M8 (R7 (c) „alte Reihenfolge“), M9 (R8-Umkehrung über `verschoben`), M10–M13 (R2-Text bei Rückkehr, reine Notiz-/Dauer-Änderung, R3-Notiz; im Probelauf ergänzt, siehe unten).
6. Fall 22/23 stehen hier über `altformat: true`; über `wendeShowAn` (mit `zuordnungOffen`) stehen sie in A6.

**Probelauf (Datum 2026-10-01):**

Nachbau außerhalb des Repos (`teil2a-plan/probe-kern/`) auf dem Stand nach A1 und A4, alle Blöcke dieser Datei per Skript **wörtlich** übernommen. Selbsttest mit `node --experimental-strip-types` (Node 24.16), Typecheck mit dem `tsc` des Repos gegen die echten tsconfigs.

**Plan wie geschrieben (vor den Korrekturen):** Schritt 3 rot (`ERR_MODULE_NOT_FOUND … abgleich.ts`), Schritt 5 grün (41 × `ok`), Schritt 6 grün, Schritt 9 rot (`does not provide an export named 'gleicheAb'`), Schritt 12 grün (136 × `ok`), Schritt 13 grün. `abgleich.ts` hat nach Zyklus 1 genau 95, nach Zyklus 2 genau 374 Zeilen. Gegenprobe M1–M9: 5, 15, 21, 10, 14, 13, 26, 3, 3 und 10 `FAIL`-Zeilen, genau wie in der Tabelle. Die Consumes-Angabe ist nachgemessen: Ohne A1 meldet der Typecheck `TS2339: Property 'id' does not exist on type 'ShowAblaufItem'`.

**Eigene Fehler** (je einzeln eingebaut, getestet, zurückgenommen):

| Fehler | vor Korrektur | nach Korrektur |
| --- | --- | --- |
| E5 R7 (c) Off-by-one: Nachfolgersuche ab `iScharf + 2` | rot (12b, 15) | rot |
| E5b R7 (c) Off-by-one: letzte alte Zeile nie Nachfolger | rot (12b) | rot |
| E6 Anhänger ohne Anker unten statt oben | rot (9, R7 (a), 15, 19b, 23) | rot |
| E7 `verschoben` über die Nummer statt über den Vorgänger | rot (9, 11) | rot |
| E8 Ersatz-Kennung ohne `#n` | rot (RF3 „Panel#2“) | rot |
| E9 zurückkehrende Zeile behält den alten Text | **grün (überlebt)** | rot (5c) |
| E10 reine Notiz-Änderung wird nicht erkannt | **grün (überlebt)** | rot (1c) |
| E11 reine Dauer-Änderung wird nicht erkannt | **grün (überlebt)** | rot (1d) |
| E12 neue Ablaufzeile ohne Notiz | **grün (überlebt)** | rot (2) |
| E13 R2 ordnet auch eigene Zeilen zu | rot (doppelte alte id) | rot |
| E13b `umbenannt` bleibt leer | rot (19, 19c) | rot |
| E21 R5 zählt nur eingeschaltete Aktionen | rot (4) | rot |
| E22 `verschoben` zählt auch neue Zeilen | rot (2, 5, 9, 15, 16, …) | rot |

**Korrekturen:**
1. *Fehler:* R2 („`label`, `note` und `durationMs` kommen aus dem neuen Ablauf“) war für eine **zurückkehrende** Zeile ungetestet; Fall 5/5b/14b kehren mit unverändertem Titel zurück. Ein Code, der Rückkehrern den alten Text lässt, lief grün. *Korrektur:* Fall 5c ergänzt (Rückkehr mit neuem Titel → Titel neu, Notiz weg, Bericht nur `zurueck: 1`). Gegenprobe M10 aufgenommen. *Beleg:* M10 vorher 0 `FAIL`, jetzt 1 `FAIL` („Fall 5c: Titel neu, Notiz weg, Markierung weg“).
2. *Fehler:* Eine reine Notiz- bzw. reine Dauer-Änderung war ungetestet (Fall 1 ändert den Titel mit, Fall 1b Notiz und Dauer zugleich). `textWeichtAb` ohne Notiz bzw. ohne Dauer lief grün, die Änderung aus iveo wäre nie angekommen. *Korrektur:* Fall 1c (nur Notiz) und Fall 1d (nur Dauer) ergänzt, Gegenproben M11 und M12 aufgenommen. *Beleg:* M11 und M12 vorher 0, jetzt je 2 `FAIL`.
3. *Fehler:* R3 „`note?`“ war ungetestet (kein neuer Punkt trug eine Notiz). *Korrektur:* In Fall 2 trägt der neue Punkt N jetzt Notiz und Dauer, die Prüfung heißt „Fall 2: neue Zeile ohne Aktionen, Notiz und Dauer aus dem Punkt (R3)“. Gegenprobe M13 aufgenommen. *Beleg:* M13 vorher 0, jetzt 1 `FAIL`.
4. *Folge:* Schritt 12 erwartet jetzt **142** × `ok` (41 + 101), nicht 136. Gegenprobe-Tabelle neu gemessen auf 142 Prüfungen: M2 jetzt 17 (dazu 1c, 5c), M6 jetzt 27 (dazu 5c), alle übrigen unverändert. Die Stichproben in Schritt 12 nennen 1c und 5c, gemessen 0,14 ms für RF4.

Der Plan-Code (`abgleich.ts`) blieb unverändert; korrigiert wurden nur Tests, Zählungen und die Gegenprobe.

**Frischer Nachbau aus der korrigierten Datei:** Schritte 3, 5, 6, 9, 12 und 13 wie angegeben (rot, 41, grün, rot, **142**, grün). Gegenprobe M1–M13: 5, 17, 21, 10, 14, 13, 27, 3, 3, 10, 1, 2, 2 und 1 `FAIL`-Zeilen; nach jeder Rücknahme wieder 142 × `ok`.

Hinweis für den Umsetzer: Die Tabelle gilt für den Stand **nach A5**. Nach A6 laufen auch Fälle aus A6 über `gleicheAb`, dann zeigen mehrere Mutationen mehr `FAIL`-Zeilen (gemessen etwa M1 9, M2 24, M6 29). Das ist kein Fehler.

---

### Aufgabe A6: Rundown — `kontextVon` + `wendeShowAn` (4.4, Archiv, Umbenennungen)

**Spec:** 4.4 (Kontext und Kontextwechsel, Schritte 1–6), 4.2 (`umbenannt` schreibt `zielId` in Dokument und Archiv und `scharfId` um), 4.9 (danach `zuordnungOffen` gelöscht, `kontext` gesetzt), 5.2 („Show ohne Ablauf … das aktuelle Dokument bleibt unangetastet“; „Scharfe Zeile: aus dem Gedächtnis, wenn der Kontext gleich geblieben ist, sonst die erste nicht entfallene“), 9.1 Fälle 22–27, 9.3 (Rundown-Teil: Abgleich-Zeilen tragen die iveo-ID), 9.2 (4.4 ohne Archivierung, Kontext `liste` ohne Filter).

**Dateien:**
- Modify: `apps/rundown/src/shared/abgleich.ts` — Zeile 13 (Typimport, Stand nach A5) und Dateiende hinter `gleicheAb` (Zeile 373–374 nach A5)
- Test: `apps/rundown/test/selftest.ts` — Import hinter `import type { RundownDoc } from '../src/shared/types.ts';`, Block vor der Schlusszeile `console.log(failed === 0 …`

**Schnittstellen:**
- Consumes:
  - A5: `gleicheAb(e: { alt: RundownRow[]; ablauf: ShowAblaufItem[]; scharfId: string | null; altformat: boolean }): { rows; scharfId; bericht: AbgleichBericht; umbenannt: Record<string, string> }`, `AbgleichBericht`, `LEERER_BERICHT`; im Test die Hilfen `abBild`, `abAktion`, `abZeile`, `abEigene`, `abPunkt`, `abBericht`, `abEinfrieren` (oberste Ebene im Selbsttest).
  - A4: `RundownDoc` (Version 2 mit `kontext?`, `archiv?`, `zuordnungOffen?`), im Test `migrate(raw, neueId)` aus `../src/shared/doc-format.ts`.
  - A1: `parseShow`/`serializeShow` aus `@jm/show` behalten `id` und lösen doppelte ids zu `#2` auf (nur der Test 9.3 braucht das zur Laufzeit; der Selbsttest lädt `@jm/show` direkt, gemessen: geht unter `node --experimental-strip-types`).
- Produces (exakt wie im Gerüst, die Show-Typen als benannte Schnittstellen):
  ```ts
  export interface ShowKontextQuelle {
    iveo?: { filter?: { programId?: string; day?: string; typeSlug?: string; formatSlug?: string; excludeBlockers?: boolean } };
  }
  export interface ShowFuerAbgleich extends ShowKontextQuelle {
    name: string;
    ablauf?: ShowAblaufItem[]; // normalisiert (parseShow/normalizeAblauf)
  }
  export function kontextVon(show: ShowKontextQuelle): string;
  export function wendeShowAn(e: { doc: RundownDoc; scharfId: string | null; show: ShowFuerAbgleich }): {
    doc: RundownDoc; scharfId: string | null; bericht: AbgleichBericht | null; kontextGewechselt: boolean;
  };
  ```
  Eine `Show` aus `parseShow` ist beiden Typen zuweisbar (gemessen im Typecheck mit der App).

**Verhalten von `wendeShowAn` (vollständig):**

| Lage | `alt` für `gleicheAb` | `scharfId` hinein | `altformat` | Archiv | `bericht` | `kontextGewechselt` |
| --- | --- | --- | --- | --- | --- | --- |
| `show.ablauf` fehlt oder leer | – (kein Abgleich) | – | – | – | `null` | `false`; `doc` ist **dasselbe Objekt**, `scharfId` unverändert |
| `doc.kontext === kontextVon(show)` | `doc.rows` | `e.scharfId` (R7) | `doc.zuordnungOffen === true` | unverändert | Bericht aus `gleicheAb` | `false` |
| `doc.kontext` gesetzt, anders | `archiv[neu]` oder `[]`; Eintrag wird entnommen | `null` → erste nicht entfallene | `false` | `archiv[doc.kontext] = doc.rows` (ersetzt) | `null` | `true` |
| `doc.kontext` fehlt (nie abgeglichen) | `doc.rows` | `null` → erste nicht entfallene | `doc.zuordnungOffen === true` | nichts archiviert | `null` | `true` |

Danach immer: `umbenannt` (R0) schreibt `zielId` in allen Aktionen der Zeilen **und** aller Archiv-Einträge um; `scharfId` kommt umbenannt aus `gleicheAb`; `doc` = `{ schemaVersion: 2, name, rows, kontext: kontextVon(show), archiv? }` ohne `zuordnungOffen`. Eingaben werden nicht verändert (unberührte Zeilen dürfen als dieselben Objekte im Ergebnis stehen).

---

- [ ] **Schritt 1: Testimporte ergänzen** in `apps/rundown/test/selftest.ts`.

<!-- edit: apps/rundown/test/selftest.ts -->
Vorher:
```ts
import type { RundownDoc } from '../src/shared/types.ts';
```
Nachher:
```ts
import type { RundownDoc } from '../src/shared/types.ts';
import { kontextVon, wendeShowAn } from '../src/shared/abgleich.ts';
import { parseShow, serializeShow } from '@jm/show';
```

- [ ] **Schritt 2: Fehlschlagenden Testblock einfügen** direkt vor der Schlusszeile (hinter den Blöcken aus A4 und A5). Er nutzt die Hilfen aus A5.

<!-- edit: apps/rundown/test/selftest.ts -->
Vorher:
```ts
console.log(failed === 0 ? '\nALLE TESTS OK' : `\n${failed} FEHLER`);
```
Nachher:
```ts
// ── kontextVon / wendeShowAn (Master-Link 2a, Spec 4.4, 4.9, 9.1 Fälle 22–27) ──
eq(kontextVon({}), 'show', 'kontextVon: ohne iveo → show');
eq(kontextVon({ iveo: {} }), 'liste:|||0', 'kontextVon: iveo ohne Filter → liste mit leeren Teilen');
eq(kontextVon({ iveo: { filter: { programId: 'p-123', day: '2026-11-10' } } }), 'se:p-123', 'kontextVon: programId → se:');
eq(
  kontextVon({ iveo: { filter: { day: '2026-11-10', typeSlug: 'plenary', formatSlug: 'panel', excludeBlockers: true } } }),
  'liste:2026-11-10|plenary|panel|1',
  'kontextVon: Liste mit allen Filterteilen',
);
eq(kontextVon({ iveo: { filter: { day: '2026-11-11' } } }), 'liste:2026-11-11|||0', 'kontextVon: Liste Tag 2');

{
  // Show ohne Ablauf: Dokument bleibt unangetastet (5.2), kein Bericht.
  const doc: RundownDoc = { schemaVersion: 2, name: 'X', rows: [abEigene('x')] };
  const e = wendeShowAn({ doc, scharfId: 'x', show: { name: 'X' } });
  eq([e.doc === doc, e.scharfId, e.bericht, e.kontextGewechselt], [true, 'x', null, false], 'wendeShowAn: Show ohne Ablauf → nichts');
  const e2 = wendeShowAn({ doc, scharfId: 'x', show: { name: 'X', ablauf: [] } });
  eq(e2.doc === doc, true, 'wendeShowAn: leerer Ablauf → nichts');
}
{
  // Fall 22: Altformat (Version-1-Datei), Titel eindeutig → Zuordnung, zuordnungOffen gelöscht.
  const doc = migrate(
    {
      schemaVersion: 1,
      name: 'COP31',
      rows: [
        { id: 'r1', label: 'Begrüßung', actions: [abAktion('a1')] },
        { id: 'r2', label: 'Keynote', actions: [abAktion('a2')] },
      ],
    },
    (p) => `${p}-neu`,
  );
  const e = wendeShowAn({
    doc,
    scharfId: null,
    show: { name: 'COP31', ablauf: [{ id: 'u1', label: 'Begrüßung' }, { id: 'u2', label: 'Keynote' }, { id: 'u3', label: 'Pause' }] },
  });
  eq(abBild(e.doc.rows), ['u1[a1]', 'u2[a2]', 'u3'], 'Fall 22: Aktionen an den Ablaufzeilen (Kennungen aus der Show)');
  eq([e.doc.kontext, e.doc.zuordnungOffen, e.scharfId], ['show', undefined, 'u1'], 'Fall 22: kontext gesetzt, zuordnungOffen weg');
  eq([e.kontextGewechselt, e.bericht], [true, null], 'Fall 22: erster Abgleich zählt als Kontextwechsel (kein Bericht)');
}
{
  // Fall 23: Altformat, Titel doppelt → alte Zeilen bleiben eigene, Ablaufzeilen kommen dazu.
  const doc = migrate(
    {
      schemaVersion: 1,
      name: 'COP31',
      rows: [
        { id: 'r1', label: 'Panel', actions: [abAktion('a1')] },
        { id: 'r2', label: 'Panel', actions: [abAktion('a2')] },
      ],
    },
    (p) => `${p}-neu`,
  );
  const e = wendeShowAn({
    doc,
    scharfId: null,
    show: { name: 'COP31', ablauf: [{ id: 'u1', label: 'Panel' }, { id: 'u2', label: 'Panel' }] },
  });
  eq(abBild(e.doc.rows), ['+r1[a1]', '+r2[a2]', 'u1', 'u2'], 'Fall 23: keine Zuordnung, Ablaufzeilen zusätzlich');
  eq(e.doc.zuordnungOffen, undefined, 'Fall 23: zuordnungOffen trotzdem gelöscht');
}
{
  // Fall 24: Version-1-Datei ohne Show gespeichert (bleibt zuordnungOffen), danach in eine Show eingetragen.
  const neueId = (p: 'r' | 'a'): string => `${p}-neu`;
  const v1 = migrate({ schemaVersion: 1, name: 'Gala', rows: [{ id: 'r1', label: 'Keynote', actions: [abAktion('k1')] }] }, neueId);
  const gespeichert = migrate(JSON.parse(JSON.stringify(v1)), neueId);
  eq(gespeichert.zuordnungOffen, true, 'Fall 24: nach dem Speichern ohne Show noch zuordnungOffen');
  const e = wendeShowAn({ doc: gespeichert, scharfId: null, show: { name: 'Gala', ablauf: [{ id: 'u1', label: 'Keynote' }] } });
  eq([abBild(e.doc.rows), e.doc.zuordnungOffen], [['u1[k1]'], undefined], 'Fall 24: Titel-Zuordnung läuft beim ersten Abgleich');
}
{
  // Fall 25: Kontextwechsel A → B → A.
  const showA = { name: 'COP31', ablauf: [abPunkt('a1p'), abPunkt('a2p')], iveo: { filter: { programId: 'pA' } } };
  const showB = { name: 'COP31', ablauf: [abPunkt('b1p'), abPunkt('b2p')], iveo: { filter: { programId: 'pB' } } };
  const docA: RundownDoc = {
    schemaVersion: 2,
    name: 'COP31',
    kontext: 'se:pA',
    rows: [abZeile('a1p', [abAktion('k1')]), abEigene('x', [abAktion('k2')]), abZeile('a2p')],
  };
  const zuB = wendeShowAn({ doc: docA, scharfId: 'a2p', show: showB });
  eq([zuB.kontextGewechselt, zuB.bericht, zuB.doc.kontext], [true, null, 'se:pB'], 'Fall 25: A → B ist Kontextwechsel ohne Bericht');
  eq([abBild(zuB.doc.rows), zuB.scharfId], [['b1p', 'b2p'], 'b1p'], 'Fall 25: B neu, scharf die erste');
  eq(abBild(zuB.doc.archiv?.['se:pA'] ?? []), ['a1p[k1]', '+x[k2]', 'a2p'], 'Fall 25: A im Archiv');
  const zuA = wendeShowAn({ doc: zuB.doc, scharfId: 'b2p', show: showA });
  eq([zuA.kontextGewechselt, zuA.bericht, zuA.doc.kontext], [true, null, 'se:pA'], 'Fall 25: B → A ist Kontextwechsel ohne Bericht');
  eq([abBild(zuA.doc.rows), zuA.scharfId], [['a1p[k1]', '+x[k2]', 'a2p'], 'a1p'], 'Fall 25: A mit Aktionen und eigener Zeile zurück, scharf die erste');
  eq(Object.keys(zuA.doc.archiv ?? {}), ['se:pB'], 'Fall 25: Archiv hält jetzt nur B');
}
{
  // Fall 25b: Rückkehr in einen archivierten Kontext gleicht mit dem DANN aktuellen Ablauf ab
  // (4.4 Schritt 3): ein inzwischen eingefügter Punkt erscheint, Aktionen und eigene Zeile bleiben.
  const doc: RundownDoc = {
    schemaVersion: 2,
    name: 'COP31',
    kontext: 'se:pB',
    rows: [abZeile('b1p')],
    archiv: { 'se:pA': [abZeile('a1p', [abAktion('k1')]), abEigene('x', [abAktion('k2')]), abZeile('a2p')] },
  };
  const e = wendeShowAn({
    doc,
    scharfId: 'b1p',
    show: { name: 'COP31', ablauf: [abPunkt('a1p'), abPunkt('neu'), abPunkt('a2p')], iveo: { filter: { programId: 'pA' } } },
  });
  eq([e.kontextGewechselt, abBild(e.doc.rows), e.scharfId], [true, ['a1p[k1]', '+x[k2]', 'neu', 'a2p'], 'a1p'], 'Fall 25b: Rückkehr nach A gleicht mit dem aktuellen Ablauf ab');
}
{
  // 4.4 Schritt 4: Nach einem Kontextwechsel ist die erste nicht entfallene Zeile scharf, auch wenn
  // die bisher scharfe Kennung im neuen Kontext vorkommt (Liste Tag 1 → Liste alle Tage).
  const doc: RundownDoc = {
    schemaVersion: 2,
    name: 'COP31',
    kontext: 'liste:2026-11-10|||0',
    rows: [abZeile('p1'), abZeile('p2', [abAktion('k2')])],
    archiv: { 'liste:|||0': [abZeile('p1'), abZeile('p2'), abZeile('p3')] },
  };
  const e = wendeShowAn({ doc, scharfId: 'p2', show: { name: 'COP31', ablauf: [abPunkt('p1'), abPunkt('p2'), abPunkt('p3')], iveo: {} } });
  eq(
    [e.kontextGewechselt, abBild(e.doc.rows), e.scharfId],
    [true, ['p1', 'p2', 'p3'], 'p1'],
    'Kontextwechsel: scharf ist die erste Zeile, auch wenn die alte Kennung dort vorkommt',
  );
}
{
  // Fall 26: Liste Tag 1 → Side Event → Liste Tag 2 → Liste Tag 1.
  const tag1 = { name: 'COP31', ablauf: [abPunkt('t1a'), abPunkt('t1b')], iveo: { filter: { day: '2026-11-10' } } };
  const se = { name: 'COP31', ablauf: [abPunkt('s1')], iveo: { filter: { programId: 'pSE', day: '2026-11-10' } } };
  const tag2 = { name: 'COP31', ablauf: [abPunkt('t2a')], iveo: { filter: { day: '2026-11-11' } } };
  const start: RundownDoc = {
    schemaVersion: 2,
    name: 'COP31',
    kontext: 'liste:2026-11-10|||0',
    rows: [abZeile('t1a', [abAktion('k1')]), abZeile('t1b', [abAktion('k2')]), abEigene('y', [abAktion('k3')])],
  };
  const s1 = wendeShowAn({ doc: start, scharfId: 't1b', show: se });
  eq([s1.kontextGewechselt, abBild(s1.doc.rows)], [true, ['s1']], 'Fall 26: Tag 1 → Side Event');
  const s2 = wendeShowAn({ doc: s1.doc, scharfId: 's1', show: tag2 });
  eq([s2.kontextGewechselt, abBild(s2.doc.rows)], [true, ['t2a']], 'Fall 26: → Tag 2 zeigt nur Tag 2, nichts entfallen');
  const s3 = wendeShowAn({ doc: s2.doc, scharfId: 't2a', show: tag1 });
  eq([s3.kontextGewechselt, abBild(s3.doc.rows)], [true, ['t1a[k1]', 't1b[k2]', '+y[k3]']], 'Fall 26: → Tag 1 alles wieder da');
  eq(s3.doc.rows.some((r) => r.entfallen), false, 'Fall 26: keine Zeile von Tag 1 entfallen');
  eq(Object.keys(s3.doc.archiv ?? {}).sort(), ['liste:2026-11-11|||0', 'se:pSE'], 'Fall 26: Archiv hält Side Event und Tag 2');
}
{
  // Fall 27: R0-Umbenennung schreibt zielId in Zeilen und Archiv und scharfId um.
  const doc: RundownDoc = {
    schemaVersion: 2,
    name: 'Gala',
    kontext: 'show',
    rows: [
      abZeile('ersatz:Keynote', [abAktion('g1', { role: 'timer', verb: 'goto', args: [2], zielId: 'ersatz:Pause' })], { label: 'Keynote' }),
      abZeile('ersatz:Pause', [], { label: 'Pause' }),
    ],
    archiv: {
      'se:alt': [abEigene('z', [abAktion('g2', { role: 'timer', verb: 'goto', args: [1], zielId: 'ersatz:Keynote' })])],
    },
  };
  const e = wendeShowAn({
    doc,
    scharfId: 'ersatz:Pause',
    show: { name: 'Gala', ablauf: [{ id: 'u1', label: 'Keynote' }, { id: 'u2', label: 'Pause' }] },
  });
  eq(abBild(e.doc.rows), ['u1[g1]', 'u2'], 'Fall 27: Zeilen mit echten Kennungen');
  eq(e.doc.rows[0]?.actions[0]?.zielId, 'u2', 'Fall 27: zielId in den Zeilen umgeschrieben');
  eq(e.doc.archiv?.['se:alt']?.[0]?.actions[0]?.zielId, 'u1', 'Fall 27: zielId im Archiv umgeschrieben');
  eq([e.scharfId, e.kontextGewechselt, e.bericht], ['u2', false, LEERER_BERICHT], 'Fall 27: scharfId umgeschrieben, Bericht leer');
}
{
  // Gleicher Kontext liefert den Bericht (für den Hinweis 4.6) und hält die scharfe Zeile (R7).
  const doc: RundownDoc = {
    schemaVersion: 2,
    name: 'Gala',
    kontext: 'liste:|||0',
    rows: [abZeile('A', [abAktion('a1')]), abZeile('B')],
  };
  const e = wendeShowAn({ doc, scharfId: 'B', show: { name: 'Gala', ablauf: [abPunkt('A'), abPunkt('N'), abPunkt('B')], iveo: {} } });
  eq([e.kontextGewechselt, e.bericht, e.scharfId], [false, abBericht({ neu: 1, verschoben: 1 }), 'B'], 'wendeShowAn: gleicher Kontext → Bericht, scharf bleibt');
}
{
  // wendeShowAn verändert seine Eingaben nicht.
  const doc = abEinfrieren<RundownDoc>({
    schemaVersion: 2,
    name: 'Gala',
    kontext: 'se:p1',
    rows: [abZeile('ersatz:A', [abAktion('a1', { zielId: 'ersatz:A' })], { label: 'A' })],
    archiv: { 'se:p2': [abZeile('B', [abAktion('b1', { zielId: 'ersatz:A' })])] },
  });
  const vorher = JSON.stringify(doc);
  wendeShowAn({ doc, scharfId: 'ersatz:A', show: { name: 'Gala', ablauf: [{ id: 'u1', label: 'A' }], iveo: { filter: { programId: 'p1' } } } });
  wendeShowAn({ doc, scharfId: 'ersatz:A', show: { name: 'Gala', ablauf: [{ id: 'u1', label: 'A' }], iveo: { filter: { programId: 'p2' } } } });
  eq(JSON.stringify(doc), vorher, 'wendeShowAn verändert seine Eingaben nicht');
}

{
  // Spec 9.3 (Rundown-Teil): iveo-Kennungen überstehen serializeShow/parseShow und werden Zeilen-ids;
  // eine doppelte Kennung ist beim Lesen schon aufgelöst (#2).
  const show = parseShow(
    serializeShow({
      schemaVersion: 1,
      name: 'COP31',
      tools: [],
      ablauf: [
        { id: '7f0c1a52-0000-4000-8000-000000000001', label: 'Eröffnung' },
        { id: '7f0c1a52-0000-4000-8000-000000000002', label: 'Panel' },
        { id: '7f0c1a52-0000-4000-8000-000000000002', label: 'Panel (doppelt)' },
      ],
      iveo: { event: 'cop31', filter: { programId: 'p-se-1' } },
    }),
  );
  const e = wendeShowAn({ doc: { schemaVersion: 2, name: 'COP31', rows: [] }, scharfId: null, show });
  eq(
    e.doc.rows.map((r) => r.id),
    ['7f0c1a52-0000-4000-8000-000000000001', '7f0c1a52-0000-4000-8000-000000000002', '7f0c1a52-0000-4000-8000-000000000002#2'],
    '9.3: Zeilen tragen die iveo-Kennungen aus der Show-Datei',
  );
  eq([e.doc.kontext, e.scharfId], ['se:p-se-1', '7f0c1a52-0000-4000-8000-000000000001'], '9.3: Kontext Side Event, erste Zeile scharf');
}

console.log(failed === 0 ? '\nALLE TESTS OK' : `\n${failed} FEHLER`);
```

- [ ] **Schritt 3: Test laufen lassen (rot).**

```bash
npm run selftest -w @jm/rundown
```
Erwartet: Abbruch beim Laden, kein `ok`, Exit-Code 1:
```
SyntaxError: The requested module '../src/shared/abgleich.ts' does not provide an export named 'kontextVon'
```

- [ ] **Schritt 4: Typimport um `RundownDoc` erweitern** in `apps/rundown/src/shared/abgleich.ts`.

<!-- edit: apps/rundown/src/shared/abgleich.ts -->
Vorher:
```ts
import type { RundownRow } from './types';
```
Nachher:
```ts
import type { RundownDoc, RundownRow } from './types';
```

- [ ] **Schritt 5: `kontextVon`, `wendeShowAn` und die Show-Typen anhängen** in `apps/rundown/src/shared/abgleich.ts` (hinter `gleicheAb`, Dateiende).

<!-- edit: apps/rundown/src/shared/abgleich.ts -->
Vorher:
```ts
  return { rows, scharfId, bericht, umbenannt: Object.fromEntries(bruecke) };
}
```
Nachher:
```ts
  return { rows, scharfId, bericht, umbenannt: Object.fromEntries(bruecke) };
}

// ── Kontext und Anwenden einer Show (Spec 4.4) ──────────────────────────────

/** Was `kontextVon` von einer Show liest (eine `Show` aus `parseShow` passt). */
export interface ShowKontextQuelle {
  iveo?: {
    filter?: { programId?: string; day?: string; typeSlug?: string; formatSlug?: string; excludeBlockers?: boolean };
  };
}

/** Was `wendeShowAn` von einer Show liest (eine `Show` aus `parseShow` passt). */
export interface ShowFuerAbgleich extends ShowKontextQuelle {
  name: string;
  /** normalisiert (über `parseShow`/`normalizeAblauf`) */
  ablauf?: ShowAblaufItem[];
}

/**
 * Kontext der Show (Spec 4.4): `se:<programId>` für ein Side Event,
 * `liste:<day>|<typeSlug>|<formatSlug>|<0/1>` für eine gefilterte Programmliste
 * (fehlende Teile leer), `show` ohne iveo.
 */
export function kontextVon(show: ShowKontextQuelle): string {
  if (!show.iveo) return 'show';
  const f = show.iveo.filter;
  if (f?.programId) return `se:${f.programId}`;
  return `liste:${f?.day ?? ''}|${f?.typeSlug ?? ''}|${f?.formatSlug ?? ''}|${f?.excludeBlockers ? 1 : 0}`;
}

/** `zielId` aller Aktionen nach `umbenannt` (R0) umschreiben; unberührte Zeilen bleiben dieselben Objekte. */
function schreibeZieleUm(rows: RundownRow[], umbenannt: Record<string, string>): RundownRow[] {
  return rows.map((r) => {
    if (!r.actions.some((a) => a.zielId !== undefined && Object.hasOwn(umbenannt, a.zielId))) return r;
    return {
      ...r,
      actions: r.actions.map((a) =>
        a.zielId !== undefined && Object.hasOwn(umbenannt, a.zielId) ? { ...a, zielId: umbenannt[a.zielId] } : a,
      ),
    };
  });
}

/**
 * Show auf ein Dokument anwenden (Spec 4.4, 4.9).
 * - Show ohne Ablauf: nichts tun (`doc` unverändert, `bericht: null`).
 * - gleicher Kontext: `gleicheAb` mit der scharfen Zeile (R7), Bericht zurück.
 * - anderer Kontext: aktuelle Zeilen ins Archiv, Zeilen des neuen Kontexts aus
 *   dem Archiv holen und abgleichen, erste nicht entfallene Zeile scharf,
 *   `bericht: null` (angezeigt wird nur die Wechselmeldung).
 * - Dokument ohne `kontext` (nie abgeglichen: Version-1-Dokument, neues oder
 *   eigenes Dokument): wie ein Kontextwechsel, aber die aktuellen Zeilen sind
 *   der Ausgangsstand — mit Titel-Zuordnung (4.9), wenn `zuordnungOffen`.
 * Danach: `umbenannt` schreibt `zielId` in Zeilen und Archiv um, `kontext` ist
 * gesetzt, `zuordnungOffen` gelöscht.
 */
export function wendeShowAn(e: { doc: RundownDoc; scharfId: string | null; show: ShowFuerAbgleich }): {
  doc: RundownDoc;
  scharfId: string | null;
  bericht: AbgleichBericht | null;
  kontextGewechselt: boolean;
} {
  const ablauf = e.show.ablauf ?? [];
  if (ablauf.length === 0) return { doc: e.doc, scharfId: e.scharfId, bericht: null, kontextGewechselt: false };

  const neuerKontext = kontextVon(e.show);
  const archiv: Record<string, RundownRow[]> = { ...(e.doc.archiv ?? {}) };
  let alt: RundownRow[];
  let scharfId: string | null;
  let altformat = false;
  let gewechselt: boolean;
  if (e.doc.kontext === undefined) {
    // Erster Abgleich: nichts archivieren, die vorhandenen Zeilen sind der Ausgangsstand.
    alt = e.doc.rows;
    scharfId = null;
    altformat = e.doc.zuordnungOffen === true;
    gewechselt = true;
  } else if (e.doc.kontext === neuerKontext) {
    alt = e.doc.rows;
    scharfId = e.scharfId;
    altformat = e.doc.zuordnungOffen === true;
    gewechselt = false;
  } else {
    // 4.4 Schritte 1–3: archivieren, holen, ohne scharfe Zeile abgleichen.
    archiv[e.doc.kontext] = e.doc.rows;
    alt = archiv[neuerKontext] ?? [];
    delete archiv[neuerKontext];
    scharfId = null;
    gewechselt = true;
  }

  const erg = gleicheAb({ alt, ablauf, scharfId, altformat });
  const neuesArchiv: Record<string, RundownRow[]> = {};
  for (const [k, zeilen] of Object.entries(archiv)) neuesArchiv[k] = schreibeZieleUm(zeilen, erg.umbenannt);
  const doc: RundownDoc = {
    schemaVersion: 2,
    name: e.doc.name,
    rows: schreibeZieleUm(erg.rows, erg.umbenannt),
    kontext: neuerKontext,
    ...(Object.keys(neuesArchiv).length ? { archiv: neuesArchiv } : {}),
  };
  return { doc, scharfId: erg.scharfId, bericht: gewechselt ? null : erg.bericht, kontextGewechselt: gewechselt };
}
```

- [ ] **Schritt 6: Test laufen lassen (grün).**

```bash
npm run selftest -w @jm/rundown
```
Erwartet: `ALLE TESTS OK`, Exit-Code 0, **177** × `ok` (142 + 35), darunter:
```
ok   kontextVon: iveo ohne Filter → liste mit leeren Teilen
ok   Fall 22: erster Abgleich zählt als Kontextwechsel (kein Bericht)
ok   Fall 24: Titel-Zuordnung läuft beim ersten Abgleich
ok   Fall 25: A mit Aktionen und eigener Zeile zurück, scharf die erste
ok   Fall 25b: Rückkehr nach A gleicht mit dem aktuellen Ablauf ab
ok   Fall 26: → Tag 2 zeigt nur Tag 2, nichts entfallen
ok   Fall 27: zielId im Archiv umgeschrieben
ok   Kontextwechsel: scharf ist die erste Zeile, auch wenn die alte Kennung dort vorkommt
ok   9.3: Zeilen tragen die iveo-Kennungen aus der Show-Datei
```
Fallen genau die beiden Prüfungen „9.3: …“ durch (Zeilen-ids `ersatz:…` statt der UUIDs, scharf `ersatz:Eröffnung`), fehlt A1 (`normalizeAblauf` übernimmt `id`). Im Probelauf gegen das unveränderte `@jm/show` gemessen: 175 × `ok`, 2 × `FAIL`.

- [ ] **Schritt 7: Typecheck.**

```bash
npm run typecheck -w @jm/rundown
```
Erwartet: keine Zeile mit `error TS`, Exit-Code 0. (Gegengeprüft an einer Kopie der App mit den echten tsconfigs und A1-Typen.)

- [ ] **Schritt 8: Gegenprobe (Spec 9.2: 4.4 ohne Archivierung, Kontext `liste` ohne Filter; dazu vier eigene).** Je Zeile: Mutation per Edit in `apps/rundown/src/shared/abgleich.ts`, `npm run selftest -w @jm/rundown`, Pflicht-Fälle müssen als `FAIL` erscheinen (Exit-Code 1), Mutation zurücknehmen. Gemessen im Probelauf auf genau diesem Stand (177 Prüfungen).

| # | Spec 9.2 | Mutation | Pflicht rot | alle FAIL-Zeilen (gemessen) |
| --- | --- | --- | --- | --- |
| N1 | 4.4 ohne Archivierung | Schritt 1 (archivieren) fehlt | Fall 25 „A mit Aktionen und eigener Zeile zurück …“ | 25 (3×), 26 (2×) |
| N2 | Kontext `liste` ohne Filter | `kontextVon` liefert nur `liste` | Fall 26 „→ Tag 1 alles wieder da“ | kontextVon (3×), 26 (2×), gleicher Kontext (6) |
| N3 | zusätzlich: Erstabgleich verwirft die Zeilen (4.4 Schritt 2 wörtlich) | `alt = []` ohne `doc.kontext` | Fall 22, 24 | 23 (3) |
| N4 | zusätzlich: `umbenannt` nicht im Archiv | Archiv-Zeilen unverändert übernehmen | Fall 27 „zielId im Archiv umgeschrieben“ | – (1) |
| N5 | zusätzlich: Kontextwechsel hält die alte scharfe Kennung (4.4 Schritt 4) | `scharfId = e.scharfId` statt `null` | „Kontextwechsel: scharf ist die erste Zeile, auch wenn die alte Kennung dort vorkommt“ | – (1) |
| N6 | zusätzlich: Rückkehr in einen archivierten Kontext ohne Abgleich (4.4 Schritt 3) | Archivzeilen ungeprüft übernehmen | Fall 25b | – (1) |

N1 —
<!-- mutation: apps/rundown/src/shared/abgleich.ts -->
Vorher:
```ts
    archiv[e.doc.kontext] = e.doc.rows;
```
Mutation:
```ts
    // MUTATION: 4.4 ohne Archivierung
```

N2 —
<!-- mutation: apps/rundown/src/shared/abgleich.ts -->
Vorher:
```ts
  return `liste:${f?.day ?? ''}|${f?.typeSlug ?? ''}|${f?.formatSlug ?? ''}|${f?.excludeBlockers ? 1 : 0}`;
```
Mutation:
```ts
  return 'liste'; // MUTATION: Kontext liste ohne Filter
```

N3 —
<!-- mutation: apps/rundown/src/shared/abgleich.ts -->
Vorher:
```ts
    alt = e.doc.rows;
    scharfId = null;
```
Mutation:
```ts
    alt = []; // MUTATION: Erstabgleich verwirft die vorhandenen Zeilen
    scharfId = null;
```
(Der Vorher-Ausschnitt ist eindeutig: Er steht nur im Zweig `e.doc.kontext === undefined`; im Zweig „gleicher Kontext“ folgt `scharfId = e.scharfId;`.)

N4 —
<!-- mutation: apps/rundown/src/shared/abgleich.ts -->
Vorher:
```ts
  for (const [k, zeilen] of Object.entries(archiv)) neuesArchiv[k] = schreibeZieleUm(zeilen, erg.umbenannt);
```
Mutation:
```ts
  for (const [k, zeilen] of Object.entries(archiv)) neuesArchiv[k] = zeilen; // MUTATION: Archiv nicht umgeschrieben
```

N5 —
<!-- mutation: apps/rundown/src/shared/abgleich.ts -->
Vorher:
```ts
    delete archiv[neuerKontext];
    scharfId = null;
```
Mutation:
```ts
    delete archiv[neuerKontext];
    scharfId = e.scharfId; // MUTATION: scharfe Kennung über den Kontextwechsel halten
```

N6 —
<!-- mutation: apps/rundown/src/shared/abgleich.ts -->
Vorher:
```ts
  const erg = gleicheAb({ alt, ablauf, scharfId, altformat });
```
Mutation:
```ts
  // MUTATION: Rückkehr in einen archivierten Kontext übernimmt die Archivzeilen ohne Abgleich
  const erg =
    gewechselt && alt.length && e.doc.kontext !== undefined
      ? { rows: alt, scharfId: alt[0]?.id ?? null, bericht: { ...LEERER_BERICHT }, umbenannt: {} as Record<string, string> }
      : gleicheAb({ alt, ablauf, scharfId, altformat });
```

Nach der letzten Rücknahme: `npm run selftest -w @jm/rundown` → `ALLE TESTS OK`, 177 × `ok`. Das Ergebnis (Mutation → rote Fälle) kommt in den Aufgabenbericht.

- [ ] **Schritt 9: Commit.**

```bash
git add apps/rundown/src/shared/abgleich.ts apps/rundown/test/selftest.ts
git status --short
git commit -m "feat(rundown): wendeShowAn mit Kontext, Archiv und Kennungswechsel" -m "kontextVon bildet se:, liste: oder show (Spec 4.4). Kontextwechsel archiviert die Zeilen und holt die des neuen Kontexts zurück, scharf ist die erste nicht entfallene. R0-Umbenennungen schreiben zielId in Zeilen und Archiv um. Altdokumente bekommen beim ersten Abgleich die Titel-Zuordnung (4.9)." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
`git status --short` lesen: gestagt sind genau `apps/rundown/src/shared/abgleich.ts` und `apps/rundown/test/selftest.ts` (beide `M`). Nicht pushen.

**Abweichungen vom Gerüst:**
1. **Dokument ohne `kontext` (Auslegung von 4.4 Schritt 2):** Wörtlich verlangt 4.4 bei „anderem Kontext“ `alt = archiv[neuerKontext] ?? []` und nennt in Schritt 1 ausdrücklich den Fall „ohne `doc.kontext` (4.9, neues Dokument)“. Damit gingen die Zeilen eines Version-1-Dokuments verloren, bevor 4.9 sie zuordnen kann. Das widerspricht 4.9 und Fall 24. Umgesetzt ist deshalb: ohne `doc.kontext` sind die aktuellen Zeilen der Ausgangsstand (`altformat` = `zuordnungOffen`). Alles andere folgt 4.4: nichts archivieren, erste nicht entfallene Zeile scharf, `bericht: null`, `kontextGewechselt: true` (auch passend zu 5.2: „Kontext gleich geblieben“ gilt hier nicht). Gegenprobe N3 hält das fest.
2. Die Show-Parameter heißen `ShowKontextQuelle` und `ShowFuerAbgleich` (benannte Fassung der Gerüst-Literaltypen; `name` ist Pflicht wie im Gerüst, wird aber nicht gelesen).
3. Der Test 9.3 lädt `parseShow`/`serializeShow` aus `@jm/show` zur Laufzeit. Das betrifft nur den Selbsttest, nicht `src/shared` (G2 bleibt eingehalten).
4. Zusätzliche Gegenproben N3 bis N6 über die Spec-Liste hinaus (N5 und N6 im Probelauf ergänzt, siehe unten).

**Probelauf (Datum 2026-10-01):**

Nachbau außerhalb des Repos (`teil2a-plan/probe-kern/`) auf dem Stand nach A1, A4 und A5, alle Blöcke dieser Datei per Skript **wörtlich** übernommen. `@jm/show` lag zur Laufzeit als Junction auf der A1-Kopie (wie `node_modules/@jm/show` im Repo). Selbsttest mit `node --experimental-strip-types` (Node 24.16), Typecheck mit dem `tsc` des Repos.

**Plan wie geschrieben (vor den Korrekturen):** Schritt 3 rot (`does not provide an export named 'kontextVon'`), Schritt 6 grün (169 × `ok`), Schritt 7 grün. Gegenprobe N1–N4: 5, 6, 3 und 1 `FAIL`-Zeilen, wortgleich wie in der Tabelle. Zusätzlich nachgemessen:
- Eine `Show` aus `@jm/show` ist `kontextVon` und `wendeShowAn` zuweisbar. Geprüft mit einer Probe-Datei in `src/shared` (`declare const s: Show; kontextVon(s); wendeShowAn({ doc, scharfId: null, show: s })`), beide tsconfigs grün.
- Ohne A1 (Junction auf das unveränderte `@jm/show`) fallen genau die beiden Prüfungen „9.3: …“ durch, alle anderen sind grün. Der Satz unter Schritt 6 ist entsprechend präzisiert.

**Eigene Fehler** (je einzeln eingebaut, getestet, zurückgenommen):

| Fehler | vor Korrektur | nach Korrektur |
| --- | --- | --- |
| E14 Kontext `liste` ohne den Teil `excludeBlockers` | rot (kontextVon 3×, 26, gleicher Kontext) | rot |
| E14b Kontext `liste` ohne Tag | rot (kontextVon 2×, 26) | rot |
| E15 Kontextwechsel hält die alte scharfe Kennung | **grün (überlebt)** | rot (neuer Fall „Kontextwechsel: scharf ist die erste Zeile …“) |
| E16 Show ohne Ablauf wird trotzdem angewendet | rot (Show ohne Ablauf, leerer Ablauf) | rot |
| E17 Bericht auch beim Kontextwechsel | rot (22, 25 2×) | rot |
| E18 `zuordnungOffen` bleibt nach dem Abgleich | rot (22, 23, 24) | rot |
| E19 Erstabgleich ohne Titel-Zuordnung | rot (22 2×, 24) | rot |
| E20 Archiv-Eintrag des neuen Kontexts bleibt liegen | rot (25, 26) | rot |
| E24 Rückkehr in einen archivierten Kontext ohne Abgleich | **grün (überlebt)** | rot (Fall 25b) |

**Korrekturen:**
1. *Fehler:* 4.4 Schritt 4 („Die scharfe Zeile ist die erste nicht entfallene Zeile“) war nur mit Kennungen getestet, die im neuen Kontext nicht vorkommen. Fall 25 und 26 schalten zwischen Side Events bzw. Tagen mit disjunkten Kennungen. Ein Code, der beim Wechsel die alte `scharfId` weitergibt, lief deshalb grün. Gleiche Kennungen in zwei Kontexten gibt es im Betrieb, etwa bei „Liste Tag 1“ → „Liste alle Tage“, die dieselben Programm-IDs tragen. *Korrektur:* Neuer Fall „Kontextwechsel: scharf ist die erste Zeile, auch wenn die alte Kennung dort vorkommt“, Gegenprobe N5 aufgenommen. *Beleg:* N5 vorher 0, jetzt 1 `FAIL`.
2. *Fehler:* 4.4 Schritt 3 („`gleicheAb` mit diesem `alt`, dem neuen Ablauf“) war ungetestet, weil Fall 25 und 26 beim Zurückschalten denselben Ablauf liefern. Ein Code, der die Archivzeilen ungeprüft zurückholt, lief grün. iveo-Änderungen am Side Event A, die während der Arbeit auf B kamen, wären beim Zurückschalten nicht angekommen. *Korrektur:* Fall 25b ergänzt (Rückkehr nach A mit inzwischen eingefügtem Punkt → `a1p[k1]`, `+x[k2]`, `neu`, `a2p`), Gegenprobe N6 aufgenommen. *Beleg:* N6 vorher 0, jetzt 1 `FAIL`.
3. *Folge:* Schritt 6 erwartet jetzt **177** × `ok` (142 aus A4/A5 nach deren Korrektur + 35), nicht 169. Die Gegenprobe-Tabelle ist auf 177 Prüfungen neu gemessen: N1–N4 unverändert, dazu N5 und N6.

Der Plan-Code (`kontextVon`, `wendeShowAn`) blieb unverändert; korrigiert wurden nur Tests, Zählungen, ein Satz in Schritt 6 und die Gegenprobe.

**Frischer Nachbau aus den korrigierten Dateien A4, A5 und A6** (frische Kopie des Repo-Stands, A1, dann alle Blöcke wörtlich): Rot/Grün in jedem Schritt wie angegeben (A4: rot, 28, 28, Typecheck grün; A5: rot, 41, grün, rot, 142, grün; A6: rot, **177**, grün). Gegenprobe N1–N6: 5, 6, 3, 1, 1 und 1 `FAIL`-Zeilen, danach wieder 177 × `ok`. Alle 26 eigenen Fehler aus A4–A6 sind auf dem Endstand rot.

---

### Aufgabe A7: Rundown — Sprung-Ziel, scharfe Zeile, Navigation und Absicherungen (reine Helfer)

**Spec:** `docs/superpowers/specs/2026-10-01-master-link-teil2a-design.md`, Abschnitte 4.3 (Absatz „Entfallene Zeilen im Betrieb“), 4.5 (Absätze „Regieplan-Import“ und „Absicherung im Main“), 5.1 (letzter Punkt: 300 ms), 5.3, 5.4, 5.5, 6.2, 9.1 Fälle 28–34 und 36, 9.2 (Punkte „Navigation, die entfallene Zeilen nicht überspringt“, „6.2 sendet `args[0]` statt der Stelle der `zielId`“, „6.2 löst beim GO statt beim Senden auf“, „5.3 hält die Nummer statt `scharfId`“), Review Focus 5 im Gerüst.

Worum es geht, in den Worten der Spec:
- 4.3: „GO, Weiter und Zurück überspringen entfallene Zeilen, sie feuern nie. `RUNDOWN GOTO n` zählt alle sichtbaren Zeilen. Landet es auf einer entfallenen, wird die nächste nicht entfallene scharf, gibt es keine, die vorige.“
- 4.5: „Der Main nimmt in `rundown:setDoc` eine Zeile mit `quelle: 'ablauf'` nur an, wenn ihre `id` ein Schlüssel des aktuellen Ablaufs ist (lebend) oder schon vorher eine entfallene Zeile mit dieser `id` existierte (entfallen). Andere Zeilen mit `quelle` macht er zu eigenen Zeilen, ohne `quelle` und `entfallen`.“ — „„Ersetzen“ löscht alle eigenen Zeilen und setzt die importierten ans Ende. Ablaufzeilen und entfallene Zeilen bleiben.“
- 5.1: „Mehrere RELOADs binnen 300 ms werden zu einem Abgleich zusammengefasst, über eine kleine reine Hilfsfunktion mit übergebener Uhr, damit sie testbar ist.“
- 5.3: „Löschen oder Verschieben einer Zeile darüber verschiebt die Markierung nicht mehr.“ — „Wird die scharfe Zeile selbst gelöscht, gilt R7 (c) sinngemäß: die nächste nicht entfallene Zeile, die vorher hinter ihr stand, sonst die letzte nicht entfallene, sonst `null`.“
- 5.4: „Festgehalten werden die Aktionsobjekte […] Ein `timer goto` mit `zielId` wird erst beim Senden in eine Nummer umgerechnet (6.2).“
- 5.5: „Ist `basisRev < abgleichRev`, lief seit dem Stand des Renderers ein Abgleich. Die Änderung wird abgewiesen. Sonst wird sie angenommen, auch wenn `basisRev < rev` wegen eigener schneller Eingaben.“
- 6.2 (Auflösen): keine `zielId` oder eigene Timer-Liste → `{ n: args[0], gebunden: false }`; `zielId` steht in `ablaufSchluessel` → `{ n: Stelle + 1, gebunden: true }`; `zielId` fehlt → `{ entfallen: true }`.

**Dateien:**
- Create: `apps/rundown/src/shared/sprung.ts`
- Create: `apps/rundown/src/shared/scharf.ts`
- Modify: `apps/rundown/src/shared/conductor.ts` — Zeile 5 (Typ-Import) und Zeilen 51–78 (`navigate` samt Kommentar)
- Test: `apps/rundown/test/selftest.ts` — neue Importe direkt vor `let failed = 0;` (heute Zeile 6), neue Testblöcke direkt vor der Abschlusszeile `console.log(failed === 0 ? …` (heute Zeile 83). A4 bis A6 haben die Datei vorher erweitert; die Zeilennummern können sich verschoben haben, die beiden Anker-Texte sind eindeutig und werden von A4–A6 nicht verändert.

**Schnittstellen:**

Consumes (A4, `apps/rundown/src/shared/types.ts`, exakt Spec 4.1):
```ts
export interface RundownAction { id: string; role: string; verb: string; args: (string | number)[]; enabled: boolean; delayMs?: number; zielId?: string }
export interface RundownRow { id: string; label: string; note?: string; actions: RundownAction[]; durationMs?: number; quelle?: 'ablauf'; entfallen?: true }
export interface RundownDoc { schemaVersion: 2; name: string; rows: RundownRow[]; kontext?: string; archiv?: Record<string, RundownRow[]>; zuordnungOffen?: true }
```
Consumes (bestehend, `apps/rundown/src/shared/conductor.ts`): `clampIndex(i: number, len: number): number`, `buildActionLine(role: string, verb: string, args?: (string | number)[]): string`, `navigate(doc: RundownDoc, index: number, cmd: RundownNav): { index: number; fire: RundownAction[] }`. Im Selbsttest sind `navigate` und `buildActionLine` schon importiert (Zeile 3).

Produces (exakt wie im Gerüst, plus `alsEigeneZeile`, siehe Abweichungen):
```ts
// apps/rundown/src/shared/sprung.ts
export type SprungErgebnis = { n: number; gebunden: boolean } | { entfallen: true };
export function loeseSprungZiel(aktion: RundownAction, ablaufSchluessel: string[], eigeneTimerListe: boolean): SprungErgebnis;
// apps/rundown/src/shared/scharf.ts
export function scharfNachBearbeitung(alt: RundownRow[], neu: RundownRow[], scharfId: string | null): string | null;
export function indexVon(rows: RundownRow[], scharfId: string | null): number; // null/nicht gefunden/leer → 0, sonst Stelle
export function alsEigeneZeile(r: RundownRow, id: string): RundownRow;
export function bereinigeQuellen(rows: RundownRow[], ablaufSchluessel: string[], bisherEntfallen: Set<string>, neueId: () => string): RundownRow[];
export function nimmAenderungAn(basisRev: number, abgleichRev: number): boolean; // basisRev >= abgleichRev
export function erzeugeBuendler(ms: number, plane: (fn: () => void, ms: number) => unknown, storniere: (h: unknown) => void): (fn: () => void) => void;
export function ersetzeEigeneZeilen(rows: RundownRow[], neueZeilen: RundownRow[]): RundownRow[];
// apps/rundown/src/shared/conductor.ts — Signatur unverändert, Verhalten neu:
// navigate() überspringt entfallene Zeilen; fire enthält dieselben Aktionsobjekte wie die Zeile.
```

Regeln für diese Aufgabe (aus dem Gerüst):
- G2: Die drei shared-Dateien importieren kein `electron`, nichts aus `node:` und keine Pakete zur Laufzeit; untereinander nur `import type`. Der Selbsttest läuft mit `node --experimental-strip-types` und importiert mit `../src/shared/<datei>.ts`.
- G7/G9: `git add` nur mit expliziten Pfaden, danach `git status --short` lesen. Kein `git stash`, kein `git reset --hard`, kein `git clean`, kein Branch-Wechsel, nie pushen.
- Alle Befehle im Worktree-Wurzelverzeichnis `C:\Users\alexk\alexzvn\.claude\worktrees\suite-sofort-fixes` ausführen.

---

#### Zyklus 1: `loeseSprungZiel` (Fälle 30, 31, Review Focus 5)

- [ ] **Schritt 1: Importe für Zyklus 1 in den Selbsttest einfügen**

Datei `apps/rundown/test/selftest.ts`. Vorher (eindeutig):
```ts
let failed = 0;
function eq(actual: unknown, expected: unknown, msg: string): void {
```
Nachher:
```ts
import { loeseSprungZiel } from '../src/shared/sprung.ts';
import type { RundownAction as A7Aktion, RundownDoc as A7Doc, RundownRow as A7Zeile } from '../src/shared/types.ts';

let failed = 0;
function eq(actual: unknown, expected: unknown, msg: string): void {
```
Die Typen werden unter eigenen Namen (`A7Aktion`, `A7Doc`, `A7Zeile`) importiert, damit sie mit Importen aus A4–A6 nicht kollidieren.

- [ ] **Schritt 2: Fehlschlagende Tests für Fall 30, Review Focus 5 und Fall 31 einfügen**

Datei `apps/rundown/test/selftest.ts`. Vorher (eindeutig, Abschlusszeile):
```ts
console.log(failed === 0 ? '\nALLE TESTS OK' : `\n${failed} FEHLER`);
```
Nachher:
```ts
// ── Teil 2a · loeseSprungZiel (Fall 30, Review-Focus 5) ──────────────────────
{
  const sprung = (extra: Partial<A7Aktion>): A7Aktion => ({
    id: 'a-sprung30',
    role: 'timer',
    verb: 'goto',
    args: [2],
    enabled: true,
    ...extra,
  });
  eq(loeseSprungZiel(sprung({ zielId: 'p2' }), ['p1', 'p2', 'p3'], false), { n: 2, gebunden: true }, 'Fall 30: Ziel an seiner Stelle → Nummer 2, gebunden');
  eq(loeseSprungZiel(sprung({ zielId: 'p2' }), ['p3', 'p1', 'p2'], false), { n: 3, gebunden: true }, 'Fall 30: Ziel nach Umsortieren an neuer Stelle → Nummer 3');
  eq(loeseSprungZiel(sprung({ zielId: 'p2' }), ['p1', 'p3'], false), { entfallen: true }, 'Fall 30: Ziel entfallen → { entfallen: true }');
  eq(loeseSprungZiel(sprung({ zielId: 'p2' }), ['p3', 'p1', 'p2'], true), { n: 2, gebunden: false }, 'Fall 30: eigene Timer-Liste → args[0], nicht gebunden');
  eq(loeseSprungZiel(sprung({}), ['p3', 'p1', 'p2'], false), { n: 2, gebunden: false }, 'Fall 30: ohne zielId → args[0], nicht gebunden');
  eq(loeseSprungZiel(sprung({ args: ['4'] }), ['p1'], false), { n: 4, gebunden: false }, 'Fall 30: Nummer von Hand als Text → Zahl');
  eq(loeseSprungZiel(sprung({ zielId: 'ersatz:Panel' }), ['ersatz:Keynote', 'ersatz:Panel'], false), { n: 2, gebunden: true }, 'Fall 30: Ersatz-Kennung als Ziel');
  eq(loeseSprungZiel(sprung({ zielId: 'p2' }), [], false), { entfallen: true }, 'Review-Focus 5: zielId, aber Show ohne Ablauf → entfallen, nichts senden');
}

// ── Teil 2a · Fall 31: verzögertes timer goto wird beim Senden aufgelöst (5.4, 6.2) ──
{
  // Zeile „Punkt 2“ trägt ein um 2 s verzögertes „Timer springe zu Punkt 2“.
  const sprung31: A7Aktion = { id: 'a-sprung31', role: 'timer', verb: 'goto', args: [2], enabled: true, delayMs: 2000, zielId: 'p2' };
  const doc31: A7Doc = {
    schemaVersion: 2,
    name: 'Fall 31',
    rows: [
      { id: 'p1', label: 'Punkt 1', quelle: 'ablauf', actions: [] },
      { id: 'p2', label: 'Punkt 2', quelle: 'ablauf', actions: [sprung31] },
      { id: 'p3', label: 'Punkt 3', quelle: 'ablauf', actions: [] },
    ],
  };
  const schluesselBeimGo = ['p1', 'p2', 'p3'];
  // GO auf „Punkt 2“: festgehalten wird das Aktionsobjekt selbst (5.4).
  const go31 = navigate(doc31, 1, { t: 'go' });
  eq(go31.fire.length === 1 && go31.fire[0] === sprung31, true, 'Fall 31: GO hält das Aktionsobjekt selbst fest, keine festgeschriebene Kopie');
  eq(loeseSprungZiel(go31.fire[0], schluesselBeimGo, false), { n: 2, gebunden: true }, 'Fall 31: beim GO stünde das Ziel auf Nummer 2');
  // Während die 2 s laufen, fügt ein Abgleich einen Punkt vor „Punkt 2“ ein.
  // Der Main hält danach die Schlüssel des neuen Ablaufs (5.2).
  const schluesselBeimSenden = ['p1', 'p-neu', 'p2', 'p3'];
  const beimSenden = loeseSprungZiel(go31.fire[0], schluesselBeimSenden, false);
  eq(beimSenden, { n: 3, gebunden: true }, 'Fall 31: beim Senden gilt der neue Stand → Nummer 3');
  eq(
    'n' in beimSenden ? buildActionLine('timer', 'goto', [beimSenden.n]) : 'nicht gesendet',
    'TIMER GOTO 3',
    'Fall 31: gesendet wird TIMER GOTO 3, nicht die alte 2',
  );
}

console.log(failed === 0 ? '\nALLE TESTS OK' : `\n${failed} FEHLER`);
```
Fall 31 prüft die Auflösung zum Sendezeitpunkt: Beim GO hält `navigate` das Aktionsobjekt selbst fest. Dazwischen ändert ein Abgleich die Schlüssel, die der Main hält. Beim Senden liefert dieselbe Aktion die neue Nummer.

- [ ] **Schritt 3: Test laufen lassen (rot)**

```
npm run selftest -w @jm/rundown
```
Erwartet: Abbruch vor dem ersten Test mit
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…\apps\rundown\src\shared\sprung.ts' imported from …\apps\rundown\test\selftest.ts
```
npm meldet `Lifecycle script \`selftest\` failed`, Exit-Code 1.

- [ ] **Schritt 4: `apps/rundown/src/shared/sprung.ts` anlegen**

Ganzer Inhalt:
```ts
// Sprung-Aktionen über die Kennung (Master-Link Teil 2a, Spec 6.2).
//
// Ein `timer goto` mit `zielId` zielt auf einen Ablaufpunkt, nicht auf eine
// Nummer. Die Nummer wird erst beim Senden aus dem DANN aktuellen Ablauf
// errechnet — bei verzögerten Aktionen also erst nach Ablauf von `delayMs` (5.4).
// Rein: keine node-/electron-Importe, zwischen den shared-Modulen nur
// `import type` — der Selbsttest läuft mit `node --experimental-strip-types`.
import type { RundownAction } from './types';

/** Ergebnis der Auflösung: 1-basierte Nummer oder „Ziel entfallen“. */
export type SprungErgebnis = { n: number; gebunden: boolean } | { entfallen: true };

/**
 * Nummer, an die ein `timer goto` JETZT springen soll (6.2).
 *  - keine `zielId` oder eigene Timer-Liste → `{ n: args[0], gebunden: false }`;
 *    der Aufrufer sendet die Aktion dann unverändert wie heute
 *  - `zielId` steht in `ablaufSchluessel` → `{ n: Stelle + 1, gebunden: true }`
 *  - `zielId` fehlt, auch bei leerem Ablauf → `{ entfallen: true }`: nicht senden
 * `ablaufSchluessel` = Schlüssel des normalisierten `show.ablauf` in Reihenfolge,
 * also genau die Liste, die der Timer hat. Dieselbe Funktion nutzen `fireOne`
 * beim Senden, der Test-Knopf (`rundown:fireAction`), Chip und Vorschau.
 */
export function loeseSprungZiel(
  aktion: RundownAction,
  ablaufSchluessel: string[],
  eigeneTimerListe: boolean,
): SprungErgebnis {
  if (!aktion.zielId || eigeneTimerListe) return { n: Number(aktion.args[0]), gebunden: false };
  const stelle = ablaufSchluessel.indexOf(aktion.zielId);
  if (stelle < 0) return { entfallen: true };
  return { n: stelle + 1, gebunden: true };
}
```

- [ ] **Schritt 5: Test laufen lassen (grün)**

```
npm run selftest -w @jm/rundown
```
Erwartet: alle Zeilen `ok   …`, darunter `ok   Fall 30: Ziel nach Umsortieren an neuer Stelle → Nummer 3`, `ok   Review-Focus 5: zielId, aber Show ohne Ablauf → entfallen, nichts senden`, `ok   Fall 31: gesendet wird TIMER GOTO 3, nicht die alte 2`; letzte Zeile `ALLE TESTS OK`, Exit-Code 0.

- [ ] **Schritt 6: Typecheck**

```
npm run typecheck -w @jm/rundown
```
Erwartet: `tsc --noEmit -p tsconfig.node.json` und `tsc --noEmit -p tsconfig.web.json` ohne Ausgabe, Exit-Code 0.

- [ ] **Schritt 7: Commit**

```
git add apps/rundown/src/shared/sprung.ts apps/rundown/test/selftest.ts
git status --short
git commit -m "feat(rundown): Sprung-Ziel über die Kennung erst beim Senden auflösen (Teil 2a)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
`git status --short` muss genau diese zwei Pfade gestaged zeigen (`A  apps/rundown/src/shared/sprung.ts`, `M  apps/rundown/test/selftest.ts`). Eine Warnung „LF will be replaced by CRLF“ ist harmlos (core.autocrlf).

---

#### Zyklus 2: `navigate` überspringt entfallene Zeilen (Fall 28)

- [ ] **Schritt 8: Fehlschlagende Tests für Fall 28 einfügen**

Datei `apps/rundown/test/selftest.ts`. Vorher (eindeutig, Abschlusszeile):
```ts
console.log(failed === 0 ? '\nALLE TESTS OK' : `\n${failed} FEHLER`);
```
Nachher:
```ts
// ── Teil 2a · Navigation überspringt entfallene Zeilen (Fall 28) ─────────────
{
  const akt = (id: string): A7Aktion => ({ id, role: 'timer', verb: 'start', args: [], enabled: true });
  const navDoc: A7Doc = {
    schemaVersion: 2,
    name: 'Fall 28',
    rows: [
      { id: 'A', label: 'A', quelle: 'ablauf', actions: [akt('aA')] },
      { id: 'B', label: 'B', quelle: 'ablauf', entfallen: true, actions: [akt('aB')] },
      { id: 'X', label: 'X (eigen)', actions: [akt('aX')] },
      { id: 'D', label: 'D', quelle: 'ablauf', entfallen: true, actions: [akt('aD')] },
      { id: 'E', label: 'E', quelle: 'ablauf', actions: [] },
    ],
  };
  const goA = navigate(navDoc, 0, { t: 'go' });
  eq(goA.fire.map((a) => a.id), ['aA'], 'Fall 28: GO auf A feuert A');
  eq(goA.index, 2, 'Fall 28: GO auf A rückt über das entfallene B auf X');
  const goX = navigate(navDoc, 2, { t: 'go' });
  eq(goX.fire.map((a) => a.id), ['aX'], 'Fall 28: GO auf X feuert X');
  eq(goX.index, 4, 'Fall 28: GO auf X rückt über das entfallene D auf E');
  eq(navigate(navDoc, 4, { t: 'go' }).index, 4, 'Fall 28: GO auf der letzten nicht entfallenen Zeile bleibt stehen');
  eq(navigate(navDoc, 0, { t: 'next' }).index, 2, 'Fall 28: Weiter überspringt B');
  eq(navigate(navDoc, 4, { t: 'prev' }).index, 2, 'Fall 28: Zurück überspringt D');
  eq(navigate(navDoc, 2, { t: 'prev' }).index, 0, 'Fall 28: Zurück überspringt B');
  eq(navigate(navDoc, 0, { t: 'goto', n: 3 }).index, 2, 'Fall 28: GOTO zählt alle sichtbaren Zeilen (3 = X)');
  eq(navigate(navDoc, 0, { t: 'goto', n: 2 }).index, 2, 'Fall 28: GOTO 2 (entfallen) → nächste nicht entfallene (X)');
  eq(navigate(navDoc, 0, { t: 'goto', n: 4 }).index, 4, 'Fall 28: GOTO 4 (entfallen) → nächste nicht entfallene (E)');
  const goB = navigate(navDoc, 1, { t: 'go' });
  eq(goB.fire.map((a) => a.id), ['aX'], 'Fall 28: Markierung auf entfallener Zeile → GO feuert nie deren Aktionen, sondern die nächste');
  eq(goB.index, 4, 'Fall 28: … und rückt danach weiter auf E');
  const endeWeg: A7Doc = {
    schemaVersion: 2,
    name: 'Fall 28 Ende',
    rows: [
      { id: 'A', label: 'A', quelle: 'ablauf', actions: [] },
      { id: 'X', label: 'X (eigen)', actions: [] },
      { id: 'D', label: 'D', quelle: 'ablauf', entfallen: true, actions: [akt('aD')] },
    ],
  };
  eq(navigate(endeWeg, 0, { t: 'goto', n: 3 }).index, 1, 'Fall 28: GOTO auf entfallene ohne nicht entfallene dahinter → vorige (X)');
  eq(navigate(endeWeg, 1, { t: 'next' }).index, 1, 'Fall 28: Weiter vor einer entfallenen letzten Zeile bleibt stehen');
  const alleWeg: A7Doc = {
    schemaVersion: 2,
    name: 'Fall 28 alles entfallen',
    rows: [
      { id: 'B', label: 'B', quelle: 'ablauf', entfallen: true, actions: [akt('aB')] },
      { id: 'D', label: 'D', quelle: 'ablauf', entfallen: true, actions: [akt('aD')] },
    ],
  };
  const goWeg = navigate(alleWeg, 0, { t: 'go' });
  eq(goWeg.fire.length, 0, 'Fall 28: nur entfallene Zeilen → GO feuert nichts');
  eq(goWeg.index, 0, 'Fall 28: nur entfallene Zeilen → Markierung bleibt');
}

console.log(failed === 0 ? '\nALLE TESTS OK' : `\n${failed} FEHLER`);
```

- [ ] **Schritt 9: Test laufen lassen (rot)**

```
npm run selftest -w @jm/rundown
```
Erwartet: genau diese 13 Fehlschläge, alle übrigen Zeilen `ok`, letzte Zeile `13 FEHLER`, Exit-Code 1. Der Selbsttest druckt unter jedem `FAIL` zwei Zeilen `  erwartet: …` und `  bekommen: …`; hier die `FAIL`-Zeilen wörtlich und dahinter (nach `#`, nicht Teil der Ausgabe) erwartet → bekommen:
```
FAIL Fall 28: GO auf A rückt über das entfallene B auf X                                            # 2 → 1
FAIL Fall 28: GO auf X rückt über das entfallene D auf E                                            # 4 → 3
FAIL Fall 28: Weiter überspringt B                                                                  # 2 → 1
FAIL Fall 28: Zurück überspringt D                                                                  # 2 → 3
FAIL Fall 28: Zurück überspringt B                                                                  # 0 → 1
FAIL Fall 28: GOTO 2 (entfallen) → nächste nicht entfallene (X)                                     # 2 → 1
FAIL Fall 28: GOTO 4 (entfallen) → nächste nicht entfallene (E)                                     # 4 → 3
FAIL Fall 28: Markierung auf entfallener Zeile → GO feuert nie deren Aktionen, sondern die nächste  # ["aX"] → ["aB"]
FAIL Fall 28: … und rückt danach weiter auf E                                                       # 4 → 2
FAIL Fall 28: GOTO auf entfallene ohne nicht entfallene dahinter → vorige (X)                       # 1 → 2
FAIL Fall 28: Weiter vor einer entfallenen letzten Zeile bleibt stehen                              # 1 → 2
FAIL Fall 28: nur entfallene Zeilen → GO feuert nichts                                              # 0 → 1
FAIL Fall 28: nur entfallene Zeilen → Markierung bleibt                                             # 0 → 1
```

- [ ] **Schritt 10: Typ-Import in `conductor.ts` erweitern**

Datei `apps/rundown/src/shared/conductor.ts`, Zeile 5. Vorher:
```ts
import type { Endpoint, RundownAction, RundownDoc, RundownNav } from './types';
```
Nachher:
```ts
import type { Endpoint, RundownAction, RundownDoc, RundownNav, RundownRow } from './types';
```

- [ ] **Schritt 11: `navigate` in `conductor.ts` ersetzen**

Datei `apps/rundown/src/shared/conductor.ts`, Zeilen 51–78 (bis Dateiende). Vorher:
```ts
/**
 * Navigation auf dem Dokument auswerten. Liefert den neuen Index der scharfen
 * Zeile und — nur bei GO — die zu feuernden (aktivierten) Aktionen. GO rückt die
 * Markierung um eins weiter (Cue-Stack), NEXT/PREV/GOTO verschieben ohne Feuern.
 */
export function navigate(
  doc: RundownDoc,
  index: number,
  cmd: RundownNav,
): { index: number; fire: RundownAction[] } {
  const len = doc.rows.length;
  const cur = clampIndex(index, len);
  switch (cmd.t) {
    case 'go': {
      const row = doc.rows[cur];
      const fire = row ? row.actions.filter((a) => a.enabled) : [];
      return { index: clampIndex(cur + 1, len), fire };
    }
    case 'next':
      return { index: clampIndex(cur + 1, len), fire: [] };
    case 'prev':
      return { index: clampIndex(cur - 1, len), fire: [] };
    case 'goto':
      return { index: clampIndex(cmd.n - 1, len), fire: [] };
    default:
      return { index: cur, fire: [] };
  }
}
```
Nachher:
```ts
/** Nicht entfallene Zeile: feuert und kann scharf werden (Teil 2a, Spec 4.3). */
function lebt(row: RundownRow | undefined): boolean {
  return row !== undefined && row.entfallen !== true;
}

/** Ab `i` in Richtung `schritt` die erste nicht entfallene Zeile, sonst -1. */
function sucheLebende(rows: RundownRow[], i: number, schritt: 1 | -1): number {
  for (let j = i; j >= 0 && j < rows.length; j += schritt) if (lebt(rows[j])) return j;
  return -1;
}

/**
 * Auf eine nicht entfallene Zeile stellen: `i` selbst, sonst die nächste dahinter,
 * sonst die vorige. Gibt es keine (leer oder alles entfallen), bleibt es bei `i`.
 */
function aufLebende(rows: RundownRow[], i: number): number {
  if (lebt(rows[i])) return i;
  const naechste = sucheLebende(rows, i + 1, 1);
  if (naechste >= 0) return naechste;
  const vorige = sucheLebende(rows, i - 1, -1);
  return vorige >= 0 ? vorige : i;
}

/**
 * Navigation auf dem Dokument auswerten. Liefert den neuen Index der scharfen
 * Zeile und — nur bei GO — die zu feuernden (aktivierten) Aktionen. GO rückt die
 * Markierung um eins weiter (Cue-Stack), NEXT/PREV/GOTO verschieben ohne Feuern.
 *
 * Entfallene Zeilen (Teil 2a, Spec 4.3) feuern nie: GO, NEXT und PREV springen
 * über sie hinweg; steht `index` auf einer entfallenen, gilt die nächste nicht
 * entfallene als scharf. GOTO n zählt alle sichtbaren Zeilen; landet es auf
 * einer entfallenen, wird die nächste nicht entfallene scharf, sonst die vorige.
 * `fire` enthält dieselben Aktionsobjekte wie die Zeile — keine festgeschriebenen
 * Kopien, denn ein `timer goto` wird erst beim Senden aufgelöst (5.4, 6.2).
 */
export function navigate(
  doc: RundownDoc,
  index: number,
  cmd: RundownNav,
): { index: number; fire: RundownAction[] } {
  const rows = doc.rows;
  const cur = aufLebende(rows, clampIndex(index, rows.length));
  const weiter = (schritt: 1 | -1): number => {
    const j = sucheLebende(rows, cur + schritt, schritt);
    return j >= 0 ? j : cur;
  };
  switch (cmd.t) {
    case 'go': {
      const row = rows[cur];
      const fire = lebt(row) ? row.actions.filter((a) => a.enabled) : [];
      return { index: weiter(1), fire };
    }
    case 'next':
      return { index: weiter(1), fire: [] };
    case 'prev':
      return { index: weiter(-1), fire: [] };
    case 'goto':
      return { index: aufLebende(rows, clampIndex(cmd.n - 1, rows.length)), fire: [] };
    default:
      return { index: cur, fire: [] };
  }
}
```
Ohne entfallene Zeilen verhält sich `navigate` exakt wie bisher; die bestehenden Navigationstests bleiben grün.

- [ ] **Schritt 12: Test laufen lassen (grün)**

```
npm run selftest -w @jm/rundown
```
Erwartet: alle Zeilen `ok`, auch die alten (`ok   GO auf Zeile 0 → Index 1 (eins weiter)`, `ok   GOTO über Ende → letzte Zeile`) und Fall 28; letzte Zeile `ALLE TESTS OK`, Exit-Code 0.

- [ ] **Schritt 13: Typecheck**

```
npm run typecheck -w @jm/rundown
```
Erwartet: keine Ausgabe von `tsc`, Exit-Code 0.

- [ ] **Schritt 14: Commit**

```
git add apps/rundown/src/shared/conductor.ts apps/rundown/test/selftest.ts
git status --short
git commit -m "feat(rundown): Navigation überspringt entfallene Zeilen (Teil 2a)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
`git status --short` muss genau `M  apps/rundown/src/shared/conductor.ts` und `M  apps/rundown/test/selftest.ts` gestaged zeigen.

---

#### Zyklus 3: `scharf.ts` (Fälle 29, 32, 33, 34, 36, `indexVon`, „Als eigene Zeile behalten“)

- [ ] **Schritt 15: Importe für Zyklus 3 in den Selbsttest einfügen**

Datei `apps/rundown/test/selftest.ts`. Vorher (eindeutig):
```ts
let failed = 0;
function eq(actual: unknown, expected: unknown, msg: string): void {
```
Nachher:
```ts
import {
  alsEigeneZeile,
  bereinigeQuellen,
  erzeugeBuendler,
  ersetzeEigeneZeilen,
  indexVon,
  nimmAenderungAn,
  scharfNachBearbeitung,
} from '../src/shared/scharf.ts';

let failed = 0;
function eq(actual: unknown, expected: unknown, msg: string): void {
```

- [ ] **Schritt 16: Fehlschlagende Tests für Fälle 29, 32, 33, 34, 36 einfügen**

Datei `apps/rundown/test/selftest.ts`. Vorher (eindeutig, Abschlusszeile):
```ts
console.log(failed === 0 ? '\nALLE TESTS OK' : `\n${failed} FEHLER`);
```
Nachher:
```ts
// ── Teil 2a · scharfNachBearbeitung (Fall 29) und indexVon (5.3) ─────────────
{
  const z = (id: string, extra: Partial<A7Zeile> = {}): A7Zeile => ({ id, label: id, actions: [], ...extra });
  const weg = { quelle: 'ablauf', entfallen: true } as const;
  const alt = [z('A'), z('B'), z('C'), z('D')];
  const altKopie = JSON.stringify(alt);
  eq(scharfNachBearbeitung(alt, [z('B'), z('C'), z('D')], 'C'), 'C', 'Fall 29: Zeile darüber gelöscht → scharfe Zeile bleibt C');
  eq(scharfNachBearbeitung(alt, [z('B'), z('C'), z('A'), z('D')], 'C'), 'C', 'Fall 29: Zeile darüber verschoben → scharfe Zeile bleibt C');
  eq(scharfNachBearbeitung(alt, [z('C'), z('A'), z('B'), z('D')], 'C'), 'C', 'Fall 29: scharfe Zeile selbst verschoben → bleibt scharf an neuer Stelle');
  eq(scharfNachBearbeitung(alt, [z('A'), z('B'), z('D')], 'C'), 'D', 'Fall 29: scharfe Zeile gelöscht → Nachfolger D');
  eq(
    scharfNachBearbeitung([z('A'), z('B'), z('C'), z('D'), z('E')], [z('A'), z('B'), z('D'), z('E')], 'C'),
    'D',
    'Fall 29: scharfe Zeile mitten im Ablauf gelöscht → unmittelbarer Nachfolger D, nicht der übernächste',
  );
  eq(
    scharfNachBearbeitung([z('A'), z('C'), z('D', weg), z('E')], [z('A'), z('D', weg), z('E')], 'C'),
    'E',
    'Fall 29: scharfe Zeile gelöscht, Nachfolger entfallen → nächste nicht entfallene E',
  );
  eq(
    scharfNachBearbeitung([z('A'), z('B'), z('C')], [z('A'), z('B', weg), z('C')], 'B'),
    'C',
    'Fall 29: scharfe Zeile steht danach als entfallene da → wie gelöscht (R7 c): Nachfolger C',
  );
  eq(scharfNachBearbeitung(alt, [z('A'), z('B'), z('C')], 'D'), 'C', 'Fall 29: letzte Zeile scharf und gelöscht → letzte nicht entfallene C');
  eq(
    scharfNachBearbeitung([z('A'), z('B'), z('X', weg)], [z('A'), z('X', weg)], 'B'),
    'A',
    'Fall 29: dahinter nur Entfallene → letzte nicht entfallene A',
  );
  eq(scharfNachBearbeitung([z('A')], [], 'A'), null, 'Fall 29: einzige Zeile gelöscht → null');
  eq(scharfNachBearbeitung([], [z('X', weg), z('N')], null), 'N', 'Fall 29: ohne scharfe Zeile → erste nicht entfallene Zeile');
  eq(
    scharfNachBearbeitung([z('A'), z('B')], [z('X', weg), z('A'), z('B')], 'weg'),
    'A',
    'Fall 29: scharfe Kennung unter alt unbekannt → erste nicht entfallene Zeile (R7 a)',
  );
  eq(JSON.stringify(alt), altKopie, 'Fall 29: Eingabe unverändert');
  eq(indexVon([z('A'), z('B'), z('C')], 'C'), 2, 'indexVon: Stelle der scharfen Zeile');
  eq(indexVon([z('A')], 'weg'), 0, 'indexVon: unbekannte Kennung → 0');
  eq(indexVon([z('A')], null), 0, 'indexVon: null → 0');
  eq(indexVon([], null), 0, 'indexVon: leere Liste → 0');
}

// ── Teil 2a · Absicherung in setDoc (Fall 32, 4.5) und „Als eigene Zeile behalten“ (4.3) ──
{
  let zaehler = 0;
  const neueId = (): string => `r_neu${++zaehler}`;
  const aktion: A7Aktion = { id: 'a1', role: 'titler', verb: 'take', args: [], enabled: true };
  const eingang: A7Zeile[] = [
    { id: 'p1', label: 'Punkt 1', quelle: 'ablauf', actions: [] },
    { id: 'p9', label: 'Schein', quelle: 'ablauf', actions: [] },
    { id: 'p2', label: 'Punkt 2', quelle: 'ablauf', entfallen: true, actions: [aktion] },
    { id: 'p3', label: 'Punkt 3', quelle: 'ablauf', entfallen: true, actions: [] },
    { id: 'p1', label: 'Doppelt', quelle: 'ablauf', actions: [] },
    { id: 'x1', label: 'Eigen', entfallen: true, actions: [] },
    { id: 'p4', label: 'Eigen mit Schlüssel', actions: [] },
    { id: 'x2', label: 'Eigen 2', actions: [] },
    // Bisher entfallen, der Renderer schickt sie aber ohne Marke.
    { id: 'p5', label: 'Punkt 5', quelle: 'ablauf', actions: [aktion] },
  ];
  const vorher = JSON.stringify(eingang);
  const aus = bereinigeQuellen(eingang, ['p1', 'p3', 'p4'], new Set(['p2', 'p5']), neueId);
  eq(aus[1], { id: 'r_neu1', label: 'Schein', actions: [] }, 'Fall 32: Ablaufzeile mit unbekannter id → eigene Zeile mit neuer id');
  eq(
    aus[8],
    { id: 'p5', label: 'Punkt 5', quelle: 'ablauf', actions: [aktion], entfallen: true },
    'Fall 32: bisher entfallene Zeile ohne Marke vom Renderer → der Main setzt entfallen wieder',
  );
  eq(
    aus,
    [
      { id: 'p1', label: 'Punkt 1', quelle: 'ablauf', actions: [] },
      { id: 'r_neu1', label: 'Schein', actions: [] },
      { id: 'p2', label: 'Punkt 2', quelle: 'ablauf', entfallen: true, actions: [aktion] },
      { id: 'p3', label: 'Punkt 3', quelle: 'ablauf', actions: [] },
      { id: 'r_neu2', label: 'Doppelt', actions: [] },
      { id: 'x1', label: 'Eigen', actions: [] },
      { id: 'r_neu3', label: 'Eigen mit Schlüssel', actions: [] },
      { id: 'x2', label: 'Eigen 2', actions: [] },
      { id: 'p5', label: 'Punkt 5', quelle: 'ablauf', actions: [aktion], entfallen: true },
    ],
    'Fall 32: lebend nur mit Schlüssel, entfallen nur wenn vorher entfallen, Markierung setzt der Main',
  );
  eq(new Set(aus.map((r) => r.id)).size, aus.length, 'Fall 32: danach ist jede id eindeutig');
  eq(aus[0] === eingang[0] && aus[2] === eingang[2] && aus[7] === eingang[7], true, 'Fall 32: unveränderte Zeilen bleiben dieselben Objekte');
  eq(JSON.stringify(eingang), vorher, 'Fall 32: Eingabe unverändert');
  eq(
    alsEigeneZeile(eingang[2], 'r_eigen'),
    { id: 'r_eigen', label: 'Punkt 2', actions: [aktion] },
    '4.3: „Als eigene Zeile behalten“ → ohne quelle/entfallen, neue id, Aktionen bleiben',
  );
}

// ── Teil 2a · Annehmen oder Abweisen (Fall 33, 5.5) ──────────────────────────
{
  let rev = 5;
  let abgleichRev = 0;
  // Renderer kennt Stand 5 und tippt zweimal schnell, ohne dass ein Abgleich läuft.
  eq(nimmAenderungAn(5, abgleichRev), true, 'Fall 33: erste schnelle eigene Änderung angenommen');
  rev++;
  eq(nimmAenderungAn(5, abgleichRev), true, 'Fall 33: zweite schnelle eigene Änderung (basisRev < rev) angenommen');
  rev++;
  // Ein Abgleich läuft: rev steigt, abgleichRev merkt sich den Stand.
  rev++;
  abgleichRev = rev;
  eq(nimmAenderungAn(7, abgleichRev), false, 'Fall 33: Änderung auf einem Stand vor dem Abgleich → abgewiesen');
  eq(nimmAenderungAn(rev, abgleichRev), true, 'Fall 33: Änderung auf dem Stand nach dem Abgleich → angenommen');
}

// ── Teil 2a · RELOAD-Zusammenfassung (Fall 34, 5.1) ──────────────────────────
{
  let jetzt = 0;
  const geplant: { fn: () => void; bei: number; weg: boolean }[] = [];
  const plane = (fn: () => void, ms: number): unknown => {
    const h = { fn, bei: jetzt + ms, weg: false };
    geplant.push(h);
    return h;
  };
  const storniere = (h: unknown): void => {
    (h as { weg: boolean }).weg = true;
  };
  const laufeBis = (t: number): void => {
    jetzt = t;
    for (const h of geplant.slice()) {
      if (!h.weg && h.bei <= t) {
        h.weg = true;
        h.fn();
      }
    }
  };
  const buendle = erzeugeBuendler(300, plane, storniere);
  let abgleiche = 0;
  const reload = (): void => buendle(() => abgleiche++);
  reload();
  laufeBis(100);
  reload();
  laufeBis(250);
  reload();
  laufeBis(549);
  eq(abgleiche, 0, 'Fall 34: bis 300 ms nach dem letzten RELOAD noch kein Abgleich');
  laufeBis(550);
  eq(abgleiche, 1, 'Fall 34: drei RELOADs binnen 300 ms → ein Abgleich');
  laufeBis(2000);
  eq(abgleiche, 1, 'Fall 34: danach kein weiterer Abgleich');
  reload();
  laufeBis(2300);
  eq(abgleiche, 2, 'Fall 34: ein neues RELOAD danach gleicht wieder ab');
  let zuletzt = '';
  buendle(() => (zuletzt = 'erstes'));
  buendle(() => (zuletzt = 'zweites'));
  laufeBis(2600);
  eq(zuletzt, 'zweites', 'Fall 34: ausgeführt wird die zuletzt übergebene Funktion');
  eq(geplant.filter((h) => !h.weg).length, 0, 'Fall 34: danach ist nichts mehr geplant');
}

// ── Teil 2a · Regieplan-Import „Ersetzen“ (Fall 36, 4.5) ─────────────────────
{
  const aktion: A7Aktion = { id: 'a1', role: 'titler', verb: 'take', args: [], enabled: true };
  const zeilen: A7Zeile[] = [
    { id: 'p1', label: 'Punkt 1', quelle: 'ablauf', actions: [] },
    { id: 'x1', label: 'Eigen 1', actions: [aktion] },
    { id: 'p2', label: 'Punkt 2', quelle: 'ablauf', entfallen: true, actions: [aktion] },
    { id: 'x2', label: 'Eigen 2', actions: [] },
  ];
  const importiert: A7Zeile[] = [
    { id: 'r_imp1', label: 'Import 1', actions: [] },
    { id: 'r_imp2', label: 'Import 2', note: 'Bühne', actions: [] },
  ];
  const vorher = JSON.stringify(zeilen);
  eq(
    ersetzeEigeneZeilen(zeilen, importiert).map((r) => r.id),
    ['p1', 'p2', 'r_imp1', 'r_imp2'],
    'Fall 36: eigene Zeilen ersetzt, Ablaufzeilen und entfallene bleiben, Import am Ende',
  );
  eq(JSON.stringify(zeilen), vorher, 'Fall 36: Eingabe unverändert');
  eq(
    ersetzeEigeneZeilen([], [{ id: 'r_imp3', label: 'Schein', quelle: 'ablauf', entfallen: true, actions: [] }]),
    [{ id: 'r_imp3', label: 'Schein', actions: [] }],
    'Fall 36: importierte Zeilen sind immer eigene Zeilen',
  );
}

console.log(failed === 0 ? '\nALLE TESTS OK' : `\n${failed} FEHLER`);
```

- [ ] **Schritt 17: Test laufen lassen (rot)**

```
npm run selftest -w @jm/rundown
```
Erwartet: Abbruch vor dem ersten Test mit
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…\apps\rundown\src\shared\scharf.ts' imported from …\apps\rundown\test\selftest.ts
```
Exit-Code 1.

- [ ] **Schritt 18: `apps/rundown/src/shared/scharf.ts` anlegen**

Ganzer Inhalt:
```ts
// Reine Helfer für den Rundown-Main rund um die scharfe Zeile und die Annahme
// von Editor-Änderungen (Master-Link Teil 2a, Spec 4.3, 4.5, 5.1, 5.3, 5.5).
// Rein: keine node-/electron-Importe, keine Uhr, kein Zufall (neue IDs kommen
// über `neueId`), zwischen den shared-Modulen nur `import type` — der
// Selbsttest läuft mit `node --experimental-strip-types` (test/selftest.ts).
import type { RundownRow } from './types';

/** Nicht entfallen = feuert und kann scharf werden (4.3). */
function lebt(r: RundownRow): boolean {
  return r.entfallen !== true;
}

/**
 * Scharfe Zeile nach einer Bearbeitung im Editor (5.3). Gehalten wird über die
 * Kennung, nicht über die Nummer: Löschen oder Verschieben einer Zeile darüber
 * lässt die Markierung, wo sie ist.
 *  - `scharfId` null oder unter `alt` unbekannt → erste nicht entfallene Zeile von `neu`
 *  - die scharfe Zeile steht in `neu` und ist nicht entfallen → bleibt scharf,
 *    auch an neuer Stelle
 *  - sonst (gelöscht) R7 (c) sinngemäß: die erste Zeile, die in `alt` hinter ihr
 *    stand und in `neu` nicht entfallen ist; sonst die letzte nicht entfallene
 *    Zeile von `neu`; sonst null
 */
export function scharfNachBearbeitung(
  alt: RundownRow[],
  neu: RundownRow[],
  scharfId: string | null,
): string | null {
  const ersteLebende = neu.find(lebt)?.id ?? null;
  if (scharfId === null) return ersteLebende;
  const altStelle = alt.findIndex((r) => r.id === scharfId);
  if (altStelle < 0) return ersteLebende;
  const neuNachId = new Map(neu.map((r) => [r.id, r] as const));
  const jetzt = neuNachId.get(scharfId);
  if (jetzt && lebt(jetzt)) return jetzt.id;
  // R7 (c) sinngemäß: erste Zeile, die vorher hinter ihr stand und nicht entfallen ist …
  for (const r of alt.slice(altStelle + 1)) {
    const kandidat = neuNachId.get(r.id);
    if (kandidat && lebt(kandidat)) return kandidat.id;
  }
  // … sonst die letzte nicht entfallene, sonst keine.
  for (let i = neu.length - 1; i >= 0; i--) if (lebt(neu[i])) return neu[i].id;
  return null;
}

/**
 * Stelle der scharfen Zeile in `rows`. Der Main führt `scharfId` (5.3), die
 * Nummer wird daraus errechnet — für `navigate` und STATE `cue=`.
 * `scharfId` null oder nicht gefunden (auch bei leerer Liste) → 0, wie heute
 * der Anfangswert von `index`.
 */
export function indexVon(rows: RundownRow[], scharfId: string | null): number {
  if (scharfId === null) return 0;
  const i = rows.findIndex((r) => r.id === scharfId);
  return i < 0 ? 0 : i;
}

/**
 * Dieselbe Zeile als eigene Zeile: ohne `quelle` und `entfallen`, mit der
 * übergebenen `id`. Für die Absicherung in `setDoc` (4.5), den Regieplan-Import
 * und den Knopf „Als eigene Zeile behalten“ (4.3, dort mit `newId('r')`).
 */
export function alsEigeneZeile(r: RundownRow, id: string): RundownRow {
  const kopie: RundownRow = { ...r, id };
  delete kopie.quelle;
  delete kopie.entfallen;
  return kopie;
}

/**
 * Absicherung in `rundown:setDoc` (4.5). Eine Zeile mit `quelle: 'ablauf'` wird
 * nur angenommen,
 *  - lebend, wenn ihre `id` ein Schlüssel des aktuellen Ablaufs ist,
 *  - entfallen, wenn es vorher schon eine entfallene Zeile mit dieser `id` gab
 *    (`bisherEntfallen`: die Kennungen der entfallenen Zeilen des Dokuments VOR
 *    der Änderung).
 * Die Markierung `entfallen` setzt dabei der Main aus diesem Wissen, nicht der
 * Renderer. Je Kennung gilt nur die erste solche Zeile.
 * Jede andere Zeile mit `quelle` wird eine eigene Zeile mit neuer `id` aus
 * `neueId()`, damit sie nie mit einer Ablaufzeile gleichen Schlüssels
 * kollidiert (R3). Eigene Zeilen behalten ihre `id`, verlieren nur ein
 * unzulässiges `entfallen` und bekommen nur dann eine neue `id`, wenn ihre
 * schon vergeben ist (auch an einen Schlüssel des Ablaufs).
 * Nur anwenden, solange eine Show gemerkt ist: Ohne Show ist alles frei (4.5).
 * Verändert die Eingabe nicht; unveränderte Zeilen kommen als dasselbe Objekt zurück.
 */
export function bereinigeQuellen(
  rows: RundownRow[],
  ablaufSchluessel: string[],
  bisherEntfallen: Set<string>,
  neueId: () => string,
): RundownRow[] {
  const lebend = new Set(ablaufSchluessel);
  // 1. Durchgang: welche Ablaufzeilen werden angenommen (je Kennung nur die erste)?
  const angenommen = new Set<number>();
  const ablaufIds = new Set<string>();
  rows.forEach((r, i) => {
    if (r.quelle !== 'ablauf' || ablaufIds.has(r.id)) return;
    if (!lebend.has(r.id) && !bisherEntfallen.has(r.id)) return;
    angenommen.add(i);
    ablaufIds.add(r.id);
  });
  // 2. Durchgang: Markierung aus dem Wissen des Main, alles andere wird eigene Zeile.
  const vergeben = new Set<string>([...ablaufIds, ...lebend, ...bisherEntfallen]);
  return rows.map((r, i) => {
    if (angenommen.has(i)) {
      const sollEntfallen = !lebend.has(r.id);
      if ((r.entfallen === true) === sollEntfallen) return r;
      const kopie: RundownRow = { ...r };
      if (sollEntfallen) kopie.entfallen = true;
      else delete kopie.entfallen;
      return kopie;
    }
    const id = r.quelle !== undefined || vergeben.has(r.id) ? neueId() : r.id;
    vergeben.add(id);
    if (id === r.id && r.entfallen === undefined) return r;
    return alsEigeneZeile(r, id);
  });
}

/**
 * Annehmen oder abweisen (5.5). `rev` steigt bei jeder Änderung am Dokument,
 * `abgleichRev` hält fest, bei welchem `rev` der letzte Abgleich lief.
 * Abgewiesen wird nur, wenn seit dem Stand des Renderers (`basisRev`) ein
 * Abgleich lief. Eigene schnelle Eingaben (`basisRev < rev` ohne Abgleich)
 * gehen durch, wie heute beim schnellen Tippen.
 */
export function nimmAenderungAn(basisRev: number, abgleichRev: number): boolean {
  return basisRev >= abgleichRev;
}

/**
 * Bündler für RELOADs (5.1): Mehrere Aufrufe binnen `ms` werden zu einem
 * zusammengefasst. Jeder Aufruf storniert den noch ausstehenden und plant neu;
 * ausgeführt wird einmal, `ms` nach dem letzten Aufruf, und zwar die zuletzt
 * übergebene Funktion. Die Uhr kommt von außen (`plane`/`storniere`, in
 * Produktion setTimeout/clearTimeout), damit der Selbsttest ohne Warten läuft.
 */
export function erzeugeBuendler(
  ms: number,
  plane: (fn: () => void, ms: number) => unknown,
  storniere: (h: unknown) => void,
): (fn: () => void) => void {
  let offen = false;
  let handle: unknown = null;
  return (fn) => {
    if (offen) storniere(handle);
    offen = true;
    handle = plane(() => {
      offen = false;
      fn();
    }, ms);
  };
}

/**
 * Regieplan-Import „Ersetzen“, solange eine Show gemerkt ist (4.5): alle eigenen
 * Zeilen fallen weg, Ablaufzeilen (lebende und entfallene) bleiben in ihrer
 * Reihenfolge, die importierten kommen ans Ende — immer als eigene Zeilen.
 */
export function ersetzeEigeneZeilen(rows: RundownRow[], neueZeilen: RundownRow[]): RundownRow[] {
  return [
    ...rows.filter((r) => r.quelle === 'ablauf'),
    ...neueZeilen.map((r) => (r.quelle === undefined && r.entfallen === undefined ? r : alsEigeneZeile(r, r.id))),
  ];
}
```

- [ ] **Schritt 19: Test laufen lassen (grün)**

```
npm run selftest -w @jm/rundown
```
Erwartet: alle Zeilen `ok`, darunter `ok   Fall 29: Zeile darüber verschoben → scharfe Zeile bleibt C`, `ok   Fall 32: Ablaufzeile mit unbekannter id → eigene Zeile mit neuer id`, `ok   Fall 33: Änderung auf einem Stand vor dem Abgleich → abgewiesen`, `ok   Fall 34: drei RELOADs binnen 300 ms → ein Abgleich`, `ok   Fall 36: eigene Zeilen ersetzt, Ablaufzeilen und entfallene bleiben, Import am Ende`; letzte Zeile `ALLE TESTS OK`, Exit-Code 0.

- [ ] **Schritt 20: Typecheck**

```
npm run typecheck -w @jm/rundown
```
Erwartet: keine Ausgabe von `tsc`, Exit-Code 0.

- [ ] **Schritt 21: Commit**

```
git add apps/rundown/src/shared/scharf.ts apps/rundown/test/selftest.ts
git status --short
git commit -m "feat(rundown): scharfe Zeile über die Kennung, Absicherung in setDoc, RELOAD-Bündler und Import „Ersetzen“ (Teil 2a)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
`git status --short` muss genau `A  apps/rundown/src/shared/scharf.ts` und `M  apps/rundown/test/selftest.ts` gestaged zeigen.

---

#### Gegenprobe (Spec 9.2) — nach dem Commit, ohne neuen Commit

Jeder Fehler wird einzeln eingebaut, der Selbsttest muss rot werden, dann wird der Fehler mit der umgekehrten Ersetzung wieder entfernt. Nichts davon wird committet. Das Ergebnis (Fehler → roter Fall) kommt als Tabelle in den Bericht der Aufgabe. Die erwarteten Fehlerzahlen gelten für den Stand nach Schritt 21, an dem alle übrigen Tests der Datei grün sind.

- [ ] **Schritt 22: Fehler G1 einbauen — „6.2 sendet `args[0]` statt der Stelle der `zielId`“**

Datei `apps/rundown/src/shared/sprung.ts`. Vorher:
```ts
  return { n: stelle + 1, gebunden: true };
```
Nachher:
```ts
  return { n: Number(aktion.args[0]), gebunden: true }; // GEGENPROBE 6.2: args[0] statt Stelle
```

- [ ] **Schritt 23: Selbsttest mit G1 laufen lassen**

```
npm run selftest -w @jm/rundown
```
Erwartet `3 FEHLER`, Exit-Code 1:
```
FAIL Fall 30: Ziel nach Umsortieren an neuer Stelle → Nummer 3
FAIL Fall 31: beim Senden gilt der neue Stand → Nummer 3
FAIL Fall 31: gesendet wird TIMER GOTO 3, nicht die alte 2
```

- [ ] **Schritt 24: G1 zurückbauen**

Datei `apps/rundown/src/shared/sprung.ts`. Vorher (der eingebaute Fehler):
```ts
  return { n: Number(aktion.args[0]), gebunden: true }; // GEGENPROBE 6.2: args[0] statt Stelle
```
Nachher (wieder der committete Stand):
```ts
  return { n: stelle + 1, gebunden: true };
```

- [ ] **Schritt 25: Fehler G2a einbauen — „6.2 löst beim GO statt beim Senden auf“, Variante: GO hält eine festgeschriebene Kopie fest**

Datei `apps/rundown/src/shared/conductor.ts`. Vorher:
```ts
      const fire = lebt(row) ? row.actions.filter((a) => a.enabled) : [];
```
Nachher:
```ts
      const fire = lebt(row) ? row.actions.filter((a) => a.enabled).map((a) => ({ ...a, zielId: undefined })) : []; // GEGENPROBE 6.2: beim GO festgeschrieben
```

- [ ] **Schritt 26: Selbsttest mit G2a laufen lassen**

```
npm run selftest -w @jm/rundown
```
Erwartet `4 FEHLER`, Exit-Code 1:
```
FAIL Fall 31: GO hält das Aktionsobjekt selbst fest, keine festgeschriebene Kopie
FAIL Fall 31: beim GO stünde das Ziel auf Nummer 2
FAIL Fall 31: beim Senden gilt der neue Stand → Nummer 3
FAIL Fall 31: gesendet wird TIMER GOTO 3, nicht die alte 2
```

- [ ] **Schritt 27: G2a zurückbauen**

Datei `apps/rundown/src/shared/conductor.ts`. Vorher (der eingebaute Fehler):
```ts
      const fire = lebt(row) ? row.actions.filter((a) => a.enabled).map((a) => ({ ...a, zielId: undefined })) : []; // GEGENPROBE 6.2: beim GO festgeschrieben
```
Nachher (wieder der committete Stand):
```ts
      const fire = lebt(row) ? row.actions.filter((a) => a.enabled) : [];
```

- [ ] **Schritt 28: Fehler G2b einbauen — „6.2 löst beim GO statt beim Senden auf“, Variante: Ergebnis der ersten Auflösung (beim GO) wird festgehalten**

Datei `apps/rundown/src/shared/sprung.ts`. Vorher:
```ts
): SprungErgebnis {
  if (!aktion.zielId || eigeneTimerListe) return { n: Number(aktion.args[0]), gebunden: false };
```
Nachher:
```ts
): SprungErgebnis {
  // GEGENPROBE 6.2: Ergebnis beim ersten Aufruf (GO) festhalten statt beim Senden neu rechnen
  const fest = ((globalThis as Record<string, unknown>).__sprungFest ??= new Map()) as Map<string, SprungErgebnis>;
  const gemerkt = fest.get(aktion.id);
  if (gemerkt) return gemerkt;
  if (aktion.zielId && !eigeneTimerListe && ablaufSchluessel.includes(aktion.zielId)) {
    fest.set(aktion.id, { n: ablaufSchluessel.indexOf(aktion.zielId) + 1, gebunden: true });
  }
  if (!aktion.zielId || eigeneTimerListe) return { n: Number(aktion.args[0]), gebunden: false };
```

- [ ] **Schritt 29: Selbsttest mit G2b laufen lassen**

```
npm run selftest -w @jm/rundown
```
Erwartet `8 FEHLER`, Exit-Code 1:
```
FAIL Fall 30: Ziel nach Umsortieren an neuer Stelle → Nummer 3
FAIL Fall 30: Ziel entfallen → { entfallen: true }
FAIL Fall 30: eigene Timer-Liste → args[0], nicht gebunden
FAIL Fall 30: ohne zielId → args[0], nicht gebunden
FAIL Fall 30: Nummer von Hand als Text → Zahl
FAIL Review-Focus 5: zielId, aber Show ohne Ablauf → entfallen, nichts senden
FAIL Fall 31: beim Senden gilt der neue Stand → Nummer 3
FAIL Fall 31: gesendet wird TIMER GOTO 3, nicht die alte 2
```
Maßgeblich für 9.2 sind die beiden Fall-31-Zeilen.

- [ ] **Schritt 30: G2b zurückbauen**

Datei `apps/rundown/src/shared/sprung.ts`. Vorher (der eingebaute Fehler):
```ts
): SprungErgebnis {
  // GEGENPROBE 6.2: Ergebnis beim ersten Aufruf (GO) festhalten statt beim Senden neu rechnen
  const fest = ((globalThis as Record<string, unknown>).__sprungFest ??= new Map()) as Map<string, SprungErgebnis>;
  const gemerkt = fest.get(aktion.id);
  if (gemerkt) return gemerkt;
  if (aktion.zielId && !eigeneTimerListe && ablaufSchluessel.includes(aktion.zielId)) {
    fest.set(aktion.id, { n: ablaufSchluessel.indexOf(aktion.zielId) + 1, gebunden: true });
  }
  if (!aktion.zielId || eigeneTimerListe) return { n: Number(aktion.args[0]), gebunden: false };
```
Nachher (wieder der committete Stand):
```ts
): SprungErgebnis {
  if (!aktion.zielId || eigeneTimerListe) return { n: Number(aktion.args[0]), gebunden: false };
```

- [ ] **Schritt 31: Fehler G3 einbauen — „5.3 hält die Nummer statt `scharfId`“**

Datei `apps/rundown/src/shared/scharf.ts`. Vorher:
```ts
): string | null {
  const ersteLebende = neu.find(lebt)?.id ?? null;
```
Nachher:
```ts
): string | null {
  // GEGENPROBE 5.3: Nummer statt Kennung halten
  const altNummer = Math.max(0, alt.findIndex((r) => r.id === scharfId));
  if (neu.length >= 0) return neu[Math.min(altNummer, neu.length - 1)]?.id ?? null;
  const ersteLebende = neu.find(lebt)?.id ?? null;
```

- [ ] **Schritt 32: Selbsttest mit G3 laufen lassen**

```
npm run selftest -w @jm/rundown
```
Erwartet `8 FEHLER`, Exit-Code 1:
```
FAIL Fall 29: Zeile darüber gelöscht → scharfe Zeile bleibt C
FAIL Fall 29: Zeile darüber verschoben → scharfe Zeile bleibt C
FAIL Fall 29: scharfe Zeile selbst verschoben → bleibt scharf an neuer Stelle
FAIL Fall 29: scharfe Zeile gelöscht, Nachfolger entfallen → nächste nicht entfallene E
FAIL Fall 29: scharfe Zeile steht danach als entfallene da → wie gelöscht (R7 c): Nachfolger C
FAIL Fall 29: dahinter nur Entfallene → letzte nicht entfallene A
FAIL Fall 29: ohne scharfe Zeile → erste nicht entfallene Zeile
FAIL Fall 29: scharfe Kennung unter alt unbekannt → erste nicht entfallene Zeile (R7 a)
```

- [ ] **Schritt 33: G3 zurückbauen**

Datei `apps/rundown/src/shared/scharf.ts`. Vorher (der eingebaute Fehler):
```ts
): string | null {
  // GEGENPROBE 5.3: Nummer statt Kennung halten
  const altNummer = Math.max(0, alt.findIndex((r) => r.id === scharfId));
  if (neu.length >= 0) return neu[Math.min(altNummer, neu.length - 1)]?.id ?? null;
  const ersteLebende = neu.find(lebt)?.id ?? null;
```
Nachher (wieder der committete Stand):
```ts
): string | null {
  const ersteLebende = neu.find(lebt)?.id ?? null;
```

- [ ] **Schritt 34: Fehler G4 einbauen — „Navigation, die entfallene Zeilen nicht überspringt“**

Datei `apps/rundown/src/shared/conductor.ts`. Vorher:
```ts
  const rows = doc.rows;
  const cur = aufLebende(rows, clampIndex(index, rows.length));
```
Nachher:
```ts
  const rows = doc.rows;
  // GEGENPROBE Navigation: ohne Überspringen (Stand vor Teil 2a)
  if (rows.length >= 0) {
    const len = rows.length;
    const c = clampIndex(index, len);
    if (cmd.t === 'go') return { index: clampIndex(c + 1, len), fire: rows[c] ? rows[c].actions.filter((a) => a.enabled) : [] };
    if (cmd.t === 'next') return { index: clampIndex(c + 1, len), fire: [] };
    if (cmd.t === 'prev') return { index: clampIndex(c - 1, len), fire: [] };
    if (cmd.t === 'goto') return { index: clampIndex(cmd.n - 1, len), fire: [] };
  }
  const cur = aufLebende(rows, clampIndex(index, rows.length));
```

- [ ] **Schritt 35: Selbsttest mit G4 laufen lassen**

```
npm run selftest -w @jm/rundown
```
Erwartet `13 FEHLER`, Exit-Code 1 — dieselben 13 `FAIL Fall 28: …`-Zeilen wie in Schritt 9.

- [ ] **Schritt 36: G4 zurückbauen**

Datei `apps/rundown/src/shared/conductor.ts`. Vorher (der eingebaute Fehler):
```ts
  const rows = doc.rows;
  // GEGENPROBE Navigation: ohne Überspringen (Stand vor Teil 2a)
  if (rows.length >= 0) {
    const len = rows.length;
    const c = clampIndex(index, len);
    if (cmd.t === 'go') return { index: clampIndex(c + 1, len), fire: rows[c] ? rows[c].actions.filter((a) => a.enabled) : [] };
    if (cmd.t === 'next') return { index: clampIndex(c + 1, len), fire: [] };
    if (cmd.t === 'prev') return { index: clampIndex(c - 1, len), fire: [] };
    if (cmd.t === 'goto') return { index: clampIndex(cmd.n - 1, len), fire: [] };
  }
  const cur = aufLebende(rows, clampIndex(index, rows.length));
```
Nachher (wieder der committete Stand):
```ts
  const rows = doc.rows;
  const cur = aufLebende(rows, clampIndex(index, rows.length));
```

- [ ] **Schritt 37: Rückbau prüfen**

```
git status --short
npm run selftest -w @jm/rundown
```
Erwartet: `git status --short` zeigt keine der Dateien `apps/rundown/src/shared/sprung.ts`, `scharf.ts`, `conductor.ts` (Arbeitsstand = Commit aus Schritt 21); der Selbsttest endet mit `ALLE TESTS OK`, Exit-Code 0. Zeigt `git status --short` eine dieser Dateien noch als geändert, mit `git diff -- <pfad>` den Rest finden und von Hand zurückbauen (kein `git checkout`, kein `git stash`).

- [ ] **Schritt 38: Ergebnis der Gegenprobe in den Bericht schreiben**

Tabelle in den Aufgabenbericht (keine Datei im Repo):

| Eingebauter Fehler (9.2) | rote Fälle |
| --- | --- |
| G1 6.2 sendet `args[0]` statt der Stelle | Fall 30 (Umsortieren), Fall 31 (2 Zeilen) |
| G2a 6.2 beim GO aufgelöst: GO hält festgeschriebene Kopie | Fall 31 (4 Zeilen) |
| G2b 6.2 beim GO aufgelöst: erstes Ergebnis festgehalten | Fall 31 (2 Zeilen), Fall 30, Review Focus 5 |
| G3 5.3 hält die Nummer statt `scharfId` | Fall 29 (8 Zeilen) |
| G4 Navigation ohne Überspringen | Fall 28 (13 Zeilen) |

Weicht ein tatsächliches Ergebnis von der erwarteten Liste ab, das tatsächliche eintragen und die Abweichung nennen.

---

**Abweichungen vom Gerüst:**
1. **Zusätzlicher Export `alsEigeneZeile(r, id)`** in `scharf.ts`: Zeile ohne `quelle` und `entfallen`, mit der übergebenen `id`. `bereinigeQuellen` und `ersetzeEigeneZeilen` brauchen ihn; A10 kann ihn für den Knopf „Als eigene Zeile behalten“ (`alsEigeneZeile(row, newId('r'))`, Spec 4.3) nutzen, A11 für `duplicateRow` (Kopie ohne `quelle`/`entfallen`).
2. **`bereinigeQuellen` präzisiert 4.5:** Die Markierung `entfallen` einer angenommenen Ablaufzeile setzt der Main aus seinem Wissen (Schlüssel lebend → ohne `entfallen`; nur in `bisherEntfallen` → `entfallen: true`), nicht aus dem Feld, das der Renderer schickt. Je Kennung wird nur die erste Ablaufzeile angenommen. Eigene Zeilen behalten ihre `id`, außer sie ist schon vergeben oder ein Schlüssel des Ablaufs bzw. eine bisher entfallene Kennung — dann neue `id`. Grund: „keine doppelte `id`“ (Fall 20) soll auch bei manipulierten Eingaben halten. Nicht angenommene Zeilen mit `quelle` bekommen immer eine neue `id` aus `neueId()`.
3. **Aufrufer-Regel für A10:** `bereinigeQuellen` nur anwenden, solange eine Show gemerkt ist (Spec 4.5, letzte Tabellenzeile „keine Show gemerkt: frei“). `bisherEntfallen` = Kennungen der Zeilen mit `entfallen: true` im Dokument **vor** der Änderung.
4. **`loeseSprungZiel` bei nicht gebundenen Aktionen:** `n` ist `Number(args[0])` (bei fehlendem Argument `NaN`). Der Aufrufer (A10 `fireOne`, Test-Knopf) sendet eine nicht gebundene Aktion unverändert wie heute über `buildActionLine(a.role, a.verb, a.args)`; nur bei `gebunden: true` sendet er `buildActionLine('timer', 'goto', [n])`. So bleibt das heutige Verhalten exakt (fehlendes Argument → `TIMER GOTO`, nicht `TIMER GOTO NaN`).
5. **`navigate`:** Steht `index` auf einer entfallenen Zeile (kommt bei korrekter `scharfId`-Führung nicht vor), gilt die nächste nicht entfallene als scharf, sonst die vorige; GO feuert dann diese. Gibt es keine nicht entfallene Zeile, feuert GO nichts und der Index bleibt.
6. **`erzeugeBuendler`** fasst nachlaufend zusammen: jeder Aufruf storniert den ausstehenden und plant neu; es läuft einmal die zuletzt übergebene Funktion, `ms` nach dem letzten Aufruf.
7. **Gegenprobe „6.2 beim GO statt beim Senden“** in zwei Varianten (G2a in `navigate`, G2b in `loeseSprungZiel`), weil die Entscheidung „wann“ im Main liegt (A10 `fireOne`); in den reinen Funktionen ist sie nur über diese beiden Stellen angreifbar. Fall 31 prüft dazu, dass `navigate` beim GO die Aktionsobjekte selbst liefert.

---

**Probelauf (Datum 2026-10-01):**

Aufbau: Arbeitsordner `scratchpad/teil2a-plan/probe-helfer/`. Kopiert aus dem Worktree (Stand `5a4b40eaa1`, unverändert): `apps/rundown/src/shared/conductor.ts`, `apps/rundown/src/shared/types.ts`, `apps/rundown/test/selftest.ts`, dazu `packages/show/src/index.ts` nur für den Typecheck (`types.ts` holt `@jm/show` per `import type`, das `node --experimental-strip-types` entfernt; der Import in der Kopie blieb deshalb unverändert). CRLF der Arbeitskopie auf LF gebracht (wie im Index). Vorher nur der Typteil von A4 (Schritte 4 und 5). Alle Code-Blöcke wurden per Skript (`probe-helfer/nachbau.py`) **wörtlich** aus dieser Datei eingesetzt; jeder Vorher-Ausschnitt wurde genau einmal gefunden. Lauf: `node --experimental-strip-types test/selftest.ts` in `apps/rundown` (= `npm run selftest -w @jm/rundown`), Node 24.16.0. Typecheck: `tsc` 5.9.3 aus dem Worktree, Optionen wie `tsconfig.node.json` (ES2022, `@types/node`) und `tsconfig.web.json` (DOM), `strict`, über `src/shared/**`.

Ablauf (Plan wie geschrieben, vor den Korrekturen): Schritt 3 rot (`ERR_MODULE_NOT_FOUND … sprung.ts`, 0 × `ok`, Exit 1) → Schritt 5 grün (34 × `ok`) → Schritt 9 genau die 13 `FAIL`-Zeilen, auch die Werte erwartet/bekommen stimmen → Schritt 12 grün (51 × `ok`) → Schritt 17 rot (`… scharf.ts`) → Schritt 19 grün (84 × `ok`) → Typecheck nach 6, 13, 20 grün. Gegenprobe G1 3, G2a 4, G2b 8, G3 5, G4 13 `FAIL`-Zeilen, alle wortgleich wie erwartet; jeder Rückbau ergibt wieder exakt den Stand nach Schritt 21; Schritt 37 grün. Der Plan-Code (`sprung.ts`, `scharf.ts`, `navigate`) musste nicht geändert werden.

Eigene Gegenprobe (`probe-helfer/eigene_gegenprobe.py`, 33 Fehler in den drei Dateien, je einzeln eingebaut und zurückgenommen):

| # | Eingebauter Fehler | vorher rot? | nachher rot? | rote Fälle (nachher) |
| --- | --- | --- | --- | --- |
| E1 | 6.2 Off-by-one: `n: stelle` statt `stelle + 1` | ja | ja | Fall 30 (3), Fall 31 (3) |
| E2 | 6.2 Ziel fehlt → `args[0]` statt `{ entfallen: true }` | ja | ja | Fall 30 „Ziel entfallen“, Review-Focus 5 |
| E3 | 6.2 eigene Timer-Liste ignoriert | ja | ja | Fall 30 „eigene Timer-Liste“ |
| E4 | 6.2 `args[0]` ohne `Number()` | ja | ja | Fall 30 „Nummer von Hand als Text“ |
| E5 | 4.3 GOTO auf entfallene wird nicht übersprungen | ja | ja | Fall 28 (3 GOTO-Zeilen) |
| E6 | 4.3 GOTO auf entfallene → vorige statt nächste | ja | ja | Fall 28 (4) |
| E7 | 4.3 Markierung auf entfallener Zeile rückt nicht weiter | ja | ja | Fall 28 (2) |
| E8 | 4.3 GO feuert ohne Prüfung „nicht entfallen“ | ja | ja | Fall 28 „nur entfallene Zeilen → GO feuert nichts“ |
| E9 | 4.3 Zurück überspringt nicht | ja | ja | Fall 28 (2) |
| E10 | 4.3 kein Rückfall auf die aktuelle Zeile am Rand | ja | ja | 2 Bestandsfälle, Fall 28 (3) |
| E11 | 5.3/R7 (c) Off-by-one: übernächster statt nächster Nachfolger | **nein** | ja | Fall 29 „mitten im Ablauf gelöscht“ |
| E12 | 5.3 scharfe Zeile bleibt, obwohl sie danach entfallen ist | **nein** | ja | Fall 29 „steht danach als entfallene da“ |
| E13 | 5.3/R7 (a) unbekannte `scharfId` → `null` | **nein** | ja | Fall 29 „Kennung unter alt unbekannt“ |
| E14 | 5.3/R7 (a) erste Zeile statt erste nicht entfallene | **nein** | ja | Fall 29 (2) |
| E15 | 5.3 Rückfall: erste statt letzte nicht entfallene | ja | ja | Fall 29 „letzte Zeile scharf und gelöscht“ |
| E16 | 5.3 Nachfolger ohne Prüfung „nicht entfallen“ | ja | ja | Fall 29 (2) |
| E17 | `indexVon`: nicht gefunden → -1 | ja | ja | `indexVon: unbekannte Kennung → 0` |
| E18 | 4.5 `entfallen` vom Renderer übernommen | ja | ja | Fall 32 (2) |
| E19 | 4.5 `bisherEntfallen` ignoriert | ja | ja | Fall 32 (3) |
| E20 | 4.5 doppelte Ablaufzeile je Kennung angenommen | ja | ja | Fall 32 (2) |
| E21 | 4.5 eigene Zeile behält eine vergebene `id` | ja | ja | Fall 32 |
| E22 | 4.5 eigene Zeile behält `entfallen` | ja | ja | Fall 32 |
| E23 | 4.5 Eingabe wird verändert (keine Kopie) | ja | ja | Fall 32 „Eingabe unverändert“ |
| E24 | 4.3 `alsEigeneZeile` behält `quelle` | ja | ja | Fall 32 (2), 4.3, Fall 36 |
| E25 | 5.5 Annahme strikt (`>`) | ja | ja | Fall 33 „nach dem Abgleich → angenommen“ |
| E26 | 5.5 nimmt immer an | ja | ja | Fall 33 „vor dem Abgleich → abgewiesen“ |
| E27 | 5.1 Bündler vorlaufend (erstes sofort, Rest verworfen) | ja | ja | Fall 34 (2) |
| E28 | 5.1 Bündler ohne Stornieren | ja | ja | Fall 34 (4) |
| E29 | 5.1 Bündler drosselt (erster gewinnt) | ja | ja | Fall 34 (2) |
| E30 | 4.5 „Ersetzen“ wirft entfallene Zeilen weg | ja | ja | Fall 36 |
| E31 | 4.5 Import an den Anfang statt ans Ende | ja | ja | Fall 36 |
| E32 | 4.5 Import behält `quelle` | ja | ja | Fall 36 „importierte Zeilen sind immer eigene Zeilen“ |
| E33 | 4.5 Main setzt die fehlende `entfallen`-Marke nicht wieder | **nein** | ja | Fall 32 (2) |

Korrekturen (Fehler → Korrektur → Beleg):
1. **Fall 29 ließ E11–E14 durch.** In jedem Löschfall war der unmittelbare Nachfolger zugleich die letzte Zeile oder entfallen, also fiel ein Off-by-one in R7 (c) nicht auf. Eine scharfe Zeile, die danach entfallen dasteht, und eine unbekannte `scharfId` kamen nicht vor. „Ohne scharfe Zeile“ prüfte nur eine Liste ohne entfallene Zeile. → In Schritt 16 drei neue Prüfungen („mitten im Ablauf gelöscht → unmittelbarer Nachfolger D“, „steht danach als entfallene da → Nachfolger C“, „Kennung unter alt unbekannt → erste nicht entfallene“) und die bestehende Prüfung „ohne scharfe Zeile“ mit `[z('X', weg), z('N')]` statt `[z('N')]`. → Beleg: vor der Korrektur E11–E14 grün (0 `FAIL`), danach rot mit 1/1/1/2 `FAIL`; Plan-Code grün.
2. **Fall 32 ließ E33 durch.** Laut Doku setzt der Main die Marke `entfallen` aus seinem Wissen. Geprüft war aber nur das Entfernen (p3), nicht das Setzen. → In Schritt 16 Zeile `p5` (bisher entfallen, vom Renderer ohne Marke geschickt; `bisherEntfallen` = `p2`, `p5`), dazu die Prüfung „bisher entfallene Zeile ohne Marke vom Renderer → der Main setzt entfallen wieder“ und `p5` in der Gesamterwartung. → Beleg: vorher 0 `FAIL`, nachher 2 `FAIL`; Plan-Code grün.
3. **Erwartete Ausgabe G3 (Schritt 32)** wegen Korrektur 1: `8 FEHLER` statt `5`, die drei zusätzlichen Zeilen sind ergänzt; dazu die Tabelle in Schritt 38. → Beleg: frischer Nachbau, Ausgabe wortgleich mit der Liste.
4. **Schritt 9:** Der Ausgabeblock hängte Klammern an die `FAIL`-Zeilen, die der Selbsttest so nicht druckt. Jetzt stehen die `FAIL`-Zeilen wörtlich da, die Werte als `#`-Kommentar. Die Werte selbst waren richtig (gemessen).

Frischer Nachbau aus dieser korrigierten Datei (`nachbau.py bau3`): Rot/Grün in den Schritten 3, 5, 9, 12, 17, 19 und 37 wie angegeben. Die `FAIL`-Listen der Schritte 9, 23, 26, 29, 32 und 35 sind wortgleich mit der Ausgabe, und der Typecheck ist dreimal grün. Grün nach Schritt 19: 88 × `ok`, nämlich 22 Bestand + 12 + 17 + 37 aus dieser Aufgabe (ohne die Blöcke von A4–A6). Danach sind alle 33 eigenen Fehler rot. Die Zahl der `ok`-Zeilen im echten Lauf hängt von A4–A6 ab; maßgeblich sind die `FAIL`-Zeilen und `ALLE TESTS OK`. Die Blöcke von A4–A6 rufen keine der hier geänderten Funktionen auf, die Fehlerzahlen der Gegenprobe gelten also unverändert.

---

### Aufgabe A8: Rundown — Ausgangsstand beim Öffnen einer Show (rein)

**Spec:** `docs/superpowers/specs/2026-10-01-master-link-teil2a-design.md`, Abschnitte 4.7 (Inhalt des Gedächtnisses), 4.8 („Ausgangsstand beim Öffnen“), 5.2 (Zeile „Show-Deep-Link, andere Show als die gemerkte“ und „Übergangsregel für den alten Autosave“), Ergänzung 0.7, 9.1 Fall 35.

Worum es geht, in den Worten der Spec:
- 5.2: „**Ausgangsstand**, in dieser Reihenfolge: Gedächtnis bzw. eigene Rundown-Datei nach 4.8 → alter Autosave nach Übergangsregel (unten) → leeres Dokument. Dann `wendeShowAn`.“
- 4.8: „Gibt es kein Gedächtnis, gilt die Datei. Gibt es ein Gedächtnis, wird die Datei mit `gedaechtnis.datei` verglichen: Pfad, Größe, Änderungszeit, SHA-256. Weicht etwas ab, wurde sie außerhalb geändert oder ersetzt. Dann gilt die Datei, mit dem Hinweis aus 4.6. Sonst gilt das Gedächtnis. Weicht es inhaltlich vom Dateistand ab, steht „ungespeicherte Änderungen“ an. Eine hineinkopierte Datei behält unter Windows ihre alte Änderungszeit. Der Vergleich über den SHA-256 erkennt sie trotzdem.“
- 5.2 Übergangsregel: „Gilt beim ersten Öffnen einer Show, für die es weder Gedächtnis noch eigene Rundown-Datei gibt. Voraussetzung: Der beim Start geladene Autosave ist ein Version-1-Dokument mit `name === show.name`. Dann wird er Ausgangsstand mit `zuordnungOffen` (4.9). Vorher wird er einmal als `rundown.autosave.v1.jmrundown` gesichert und ist über „Öffnen…“ erreichbar. Das Beispiel-Dokument (`defaultDoc`) ist nie Ausgangsstand. Ein Autosave mit anderem Namen auch nicht.“
- 4.6, Hinweistext für den Aufrufer (A10), Art „kurz“: „Rundown-Datei wurde außerhalb geändert, Datei geladen.“
- 9.1 Fall 35: „Ausgangsstand (5.2): Gedächtnis vorhanden → Gedächtnis; Datei außerhalb geändert, auch mit alter Änderungszeit → Datei; alter Autosave mit gleichem Namen → übernommen mit `zuordnungOffen`; Autosave mit anderem Namen bzw. Beispiel-Dokument → leer.“

Die Funktion entscheidet nur. Lesen der Dateien, SHA-256, Sichern des alten Autosaves und das Anzeigen des Hinweises macht der Aufrufer (A9/A10).

**Dateien:**
- Create: `apps/rundown/src/shared/ausgangsstand.ts`
- Test: `apps/rundown/test/selftest.ts` — neue Importe direkt vor `let failed = 0;` (heute Zeile 6), neuer Testblock direkt vor der Abschlusszeile `console.log(failed === 0 ? …` (heute Zeile 83). A4 bis A7 haben die Datei vorher erweitert; die Zeilennummern können sich verschoben haben, die beiden Anker-Texte sind eindeutig und werden von A4–A7 nicht verändert.

**Schnittstellen:**

Consumes (A4, `apps/rundown/src/shared/types.ts`, exakt Spec 4.1):
```ts
export interface RundownDoc { schemaVersion: 2; name: string; rows: RundownRow[]; kontext?: string; archiv?: Record<string, RundownRow[]>; zuordnungOffen?: true }
export interface RundownRow { id: string; label: string; note?: string; actions: RundownAction[]; durationMs?: number; quelle?: 'ablauf'; entfallen?: true }
```
Ein Version-1-Dokument kommt nach A4-`migrate` als `schemaVersion: 2` mit `zuordnungOffen: true` an; ob die Datei auf der Platte Version 1 war, sagt der Aufrufer über `autosaveWarV1`.

Produces (exakt wie im Gerüst; A9 und A10 nutzen die Typen):
```ts
// apps/rundown/src/shared/ausgangsstand.ts
export interface DateiStand { pfad: string; mtimeMs: number; groesse: number; sha256: string }
export interface GedaechtnisInhalt { schemaVersion: 2; showPfad: string; showName: string; doc: RundownDoc; scharfId: string | null; gespeichertAm: string; datei?: DateiStand }
export type Ausgangsstand =
  | { quelle: 'gedaechtnis'; doc: RundownDoc; scharfId: string | null; ungespeichert: boolean }
  | { quelle: 'datei'; doc: RundownDoc; hinweisAusserhalb: boolean }
  | { quelle: 'autosave-v1'; doc: RundownDoc }
  | { quelle: 'leer' };
export function waehleAusgangsstand(e: {
  gedaechtnis: GedaechtnisInhalt | null;
  datei: { doc: RundownDoc; stand: DateiStand } | null; // eigene .jmrundown der Show, gelesen; null = keine oder unlesbar
  autosave: RundownDoc | null;   // beim Start geladener Autosave (migriert); null = es gab keinen (dann lief defaultDoc)
  autosaveWarV1: boolean;        // der Autosave ist ein Version-1-Dokument im Sinne von 4.1/4.9 (A10 übergibt autosave.zuordnungOffen === true)
  showName: string;
}): Ausgangsstand;
```

Regeln für diese Aufgabe (aus dem Gerüst):
- G2: `ausgangsstand.ts` importiert kein `electron`, nichts aus `node:` und keine Pakete zur Laufzeit; aus `./types` nur `import type`. Der Selbsttest läuft mit `node --experimental-strip-types` und importiert mit `../src/shared/<datei>.ts`.
- G7/G9: `git add` nur mit expliziten Pfaden, danach `git status --short` lesen. Kein `git stash`, kein `git reset --hard`, kein `git clean`, kein Branch-Wechsel, nie pushen.
- Alle Befehle im Worktree-Wurzelverzeichnis `C:\Users\alexk\alexzvn\.claude\worktrees\suite-sofort-fixes` ausführen.

---

- [ ] **Schritt 1: Importe in den Selbsttest einfügen**

Datei `apps/rundown/test/selftest.ts`. Vorher (eindeutig):
```ts
let failed = 0;
function eq(actual: unknown, expected: unknown, msg: string): void {
```
Nachher:
```ts
import { waehleAusgangsstand } from '../src/shared/ausgangsstand.ts';
import type { DateiStand as A8DateiStand, GedaechtnisInhalt as A8Gedaechtnis } from '../src/shared/ausgangsstand.ts';
import type { RundownDoc as A8Doc } from '../src/shared/types.ts';

let failed = 0;
function eq(actual: unknown, expected: unknown, msg: string): void {
```
Die Typen werden unter eigenen Namen (`A8DateiStand`, `A8Gedaechtnis`, `A8Doc`) importiert, damit sie mit Importen anderer Aufgaben nicht kollidieren.

- [ ] **Schritt 2: Fehlschlagende Tests für Fall 35 und die 4.8-Fälle einfügen**

Datei `apps/rundown/test/selftest.ts`. Vorher (eindeutig, Abschlusszeile):
```ts
console.log(failed === 0 ? '\nALLE TESTS OK' : `\n${failed} FEHLER`);
```
Nachher:
```ts
// ── Teil 2a · Ausgangsstand beim Öffnen einer Show (Fall 35, 4.8, 5.2) ───────
{
  const aktion = { id: 'a1', role: 'titler', verb: 'take', args: [], enabled: true };
  const docGedaechtnis: A8Doc = {
    schemaVersion: 2,
    name: 'COP31 Tag 1',
    rows: [{ id: 'p1', label: 'Eröffnung', quelle: 'ablauf', actions: [aktion] }],
    kontext: 'se:prog-1',
  };
  const docDatei: A8Doc = {
    schemaVersion: 2,
    name: 'COP31 Tag 1',
    rows: [{ id: 'p1', label: 'Eröffnung', quelle: 'ablauf', actions: [] }],
    kontext: 'se:prog-1',
  };
  const stand: A8DateiStand = { pfad: 'D:\\Shows\\cop31.jmrundown', mtimeMs: 1727780000000, groesse: 812, sha256: 'aa11' };
  const gedaechtnis = (datei?: A8DateiStand, doc: A8Doc = docGedaechtnis): A8Gedaechtnis => ({
    schemaVersion: 2,
    showPfad: 'D:\\Shows\\COP31 Tag 1.jmshow',
    showName: 'COP31 Tag 1',
    doc,
    scharfId: 'p1',
    gespeichertAm: '2026-10-01T09:00:00.000Z',
    ...(datei ? { datei } : {}),
  });
  const autosaveV1: A8Doc = { schemaVersion: 2, name: 'COP31 Tag 1', rows: [{ id: 'r_alt', label: 'Eröffnung', actions: [aktion] }] };
  const basis = { gedaechtnis: null, datei: null, autosave: null, autosaveWarV1: false, showName: 'COP31 Tag 1' };

  // Gedächtnis vorhanden, keine eigene Datei → Gedächtnis samt scharfer Zeile.
  eq(
    waehleAusgangsstand({ ...basis, gedaechtnis: gedaechtnis(), autosave: autosaveV1, autosaveWarV1: true }),
    { quelle: 'gedaechtnis', doc: docGedaechtnis, scharfId: 'p1', ungespeichert: false },
    'Fall 35: Gedächtnis vorhanden → Gedächtnis (auch vor einem passenden alten Autosave)',
  );
  // Eigene Datei, kein Gedächtnis → Datei, ohne Hinweis.
  eq(
    waehleAusgangsstand({ ...basis, datei: { doc: docDatei, stand } }),
    { quelle: 'datei', doc: docDatei, hinweisAusserhalb: false },
    '4.8: eigene Datei ohne Gedächtnis → Datei, ohne Hinweis',
  );
  // Datei unverändert, Gedächtnis weicht inhaltlich ab → Gedächtnis, „ungespeicherte Änderungen“.
  eq(
    waehleAusgangsstand({ ...basis, gedaechtnis: gedaechtnis({ ...stand }), datei: { doc: docDatei, stand } }),
    { quelle: 'gedaechtnis', doc: docGedaechtnis, scharfId: 'p1', ungespeichert: true },
    '4.8: Datei unverändert, Gedächtnis weicht ab → Gedächtnis, ungespeichert',
  );
  // Datei unverändert, gleicher Inhalt in anderer Feldreihenfolge → nicht ungespeichert.
  const docDateiUmgestellt: A8Doc = {
    kontext: 'se:prog-1',
    rows: [{ actions: [aktion], quelle: 'ablauf', label: 'Eröffnung', id: 'p1' }],
    name: 'COP31 Tag 1',
    schemaVersion: 2,
  };
  eq(
    waehleAusgangsstand({ ...basis, gedaechtnis: gedaechtnis({ ...stand }), datei: { doc: docDateiUmgestellt, stand } }),
    { quelle: 'gedaechtnis', doc: docGedaechtnis, scharfId: 'p1', ungespeichert: false },
    '4.8: Datei unverändert und inhaltsgleich (andere Feldreihenfolge) → Gedächtnis, nicht ungespeichert',
  );
  // Datei außerhalb geändert: neuere Änderungszeit, andere Größe → Datei mit Hinweis.
  eq(
    waehleAusgangsstand({
      ...basis,
      gedaechtnis: gedaechtnis({ ...stand }),
      datei: { doc: docDatei, stand: { ...stand, mtimeMs: stand.mtimeMs + 60000, groesse: 900, sha256: 'bb22' } },
    }),
    { quelle: 'datei', doc: docDatei, hinweisAusserhalb: true },
    'Fall 35: Datei außerhalb geändert → Datei, mit Hinweis',
  );
  // Hineinkopiert: gleiche Änderungszeit und Größe, anderer SHA-256 → Datei mit Hinweis.
  eq(
    waehleAusgangsstand({
      ...basis,
      gedaechtnis: gedaechtnis({ ...stand }),
      datei: { doc: docDatei, stand: { ...stand, sha256: 'cc33' } },
    }),
    { quelle: 'datei', doc: docDatei, hinweisAusserhalb: true },
    'Fall 35: Datei mit alter Änderungszeit hineinkopiert → Datei (SHA-256), mit Hinweis',
  );
  // Gleicher Inhalt, neu gespeichert: nur die Änderungszeit ist anders → Datei mit Hinweis.
  eq(
    waehleAusgangsstand({
      ...basis,
      gedaechtnis: gedaechtnis({ ...stand }),
      datei: { doc: docDatei, stand: { ...stand, mtimeMs: stand.mtimeMs + 1000 } },
    }),
    { quelle: 'datei', doc: docDatei, hinweisAusserhalb: true },
    '4.8: nur die Änderungszeit anders → Datei, mit Hinweis',
  );
  // Verglichen wird über alle vier Merkmale (4.8), also auch über die Größe allein.
  eq(
    waehleAusgangsstand({
      ...basis,
      gedaechtnis: gedaechtnis({ ...stand }),
      datei: { doc: docDatei, stand: { ...stand, groesse: stand.groesse + 1 } },
    }),
    { quelle: 'datei', doc: docDatei, hinweisAusserhalb: true },
    '4.8: nur die Größe anders → Datei, mit Hinweis',
  );
  // Anderer Pfad (Show zeigt jetzt auf eine andere Datei) → Datei mit Hinweis.
  eq(
    waehleAusgangsstand({
      ...basis,
      gedaechtnis: gedaechtnis({ ...stand }),
      datei: { doc: docDatei, stand: { ...stand, pfad: 'D:\\Shows\\cop31-neu.jmrundown' } },
    }),
    { quelle: 'datei', doc: docDatei, hinweisAusserhalb: true },
    '4.8: anderer Pfad → Datei, mit Hinweis',
  );
  // Gedächtnis hat die Datei nie gesehen (früher keine eigene Datei) → Datei mit Hinweis.
  eq(
    waehleAusgangsstand({ ...basis, gedaechtnis: gedaechtnis(), datei: { doc: docDatei, stand } }),
    { quelle: 'datei', doc: docDatei, hinweisAusserhalb: true },
    '4.8: Gedächtnis ohne Dateistand, Show hat jetzt eine Datei → Datei, mit Hinweis',
  );
  // Übergangsregel: alter Autosave (Version 1) mit gleichem Namen → übernommen mit zuordnungOffen.
  eq(
    waehleAusgangsstand({ ...basis, autosave: autosaveV1, autosaveWarV1: true }),
    { quelle: 'autosave-v1', doc: { ...autosaveV1, zuordnungOffen: true } },
    'Fall 35: alter Autosave mit gleichem Namen → übernommen mit zuordnungOffen',
  );
  eq(autosaveV1.zuordnungOffen, undefined, 'Fall 35: der übergebene Autosave bleibt unverändert');
  eq(
    waehleAusgangsstand({ ...basis, autosave: { ...autosaveV1, name: 'COP31 Tag 2' }, autosaveWarV1: true }),
    { quelle: 'leer' },
    'Fall 35: Autosave mit anderem Namen → leer',
  );
  eq(
    waehleAusgangsstand({ ...basis, autosave: autosaveV1, autosaveWarV1: false }),
    { quelle: 'leer' },
    'Fall 35: Autosave schon Version 2 → leer (Übergangsregel nur für Version 1)',
  );
  eq(waehleAusgangsstand({ ...basis }), { quelle: 'leer' }, 'Fall 35: kein Autosave (Beispiel-Dokument) → leer');
  eq(
    waehleAusgangsstand({ ...basis, datei: { doc: docDatei, stand }, autosave: autosaveV1, autosaveWarV1: true }),
    { quelle: 'datei', doc: docDatei, hinweisAusserhalb: false },
    '5.2: Übergangsregel nur ohne eigene Datei → Datei gilt',
  );
}

console.log(failed === 0 ? '\nALLE TESTS OK' : `\n${failed} FEHLER`);
```

- [ ] **Schritt 3: Test laufen lassen (rot)**

```
npm run selftest -w @jm/rundown
```
Erwartet: Abbruch vor dem ersten Test mit
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…\apps\rundown\src\shared\ausgangsstand.ts' imported from …\apps\rundown\test\selftest.ts
```
npm meldet `Lifecycle script \`selftest\` failed`, Exit-Code 1.

- [ ] **Schritt 4: `apps/rundown/src/shared/ausgangsstand.ts` anlegen**

Ganzer Inhalt:
```ts
// Ausgangsstand beim Öffnen einer Show (Master-Link Teil 2a, Spec 4.8 und 5.2):
// Gedächtnis bzw. eigene Rundown-Datei der Show → alter Autosave aus Rundown 0.5
// (Übergangsregel) → leer. Danach gleicht der Aufrufer mit `wendeShowAn` ab.
// Rein: Dateien liest der Aufrufer und reicht Inhalt und Dateistand herein.
// Keine node-/electron-Importe, zwischen den shared-Modulen nur `import type` —
// der Selbsttest läuft mit `node --experimental-strip-types` (test/selftest.ts).
import type { RundownDoc } from './types';

/** Stand einer eigenen Rundown-Datei, wie das Gedächtnis sie gesehen hat (4.7, 4.8). */
export interface DateiStand {
  pfad: string;
  mtimeMs: number;
  groesse: number;
  sha256: string;
}

/** Inhalt von `<userData>/regie/<schlüssel>.json` (4.7). */
export interface GedaechtnisInhalt {
  schemaVersion: 2;
  showPfad: string;
  showName: string;
  /** Aktuelle Zeilen samt Archiv. */
  doc: RundownDoc;
  scharfId: string | null;
  gespeichertAm: string;
  /** Stand der eigenen Rundown-Datei beim letzten Laden oder Speichern (4.8). */
  datei?: DateiStand;
}

export type Ausgangsstand =
  | { quelle: 'gedaechtnis'; doc: RundownDoc; scharfId: string | null; ungespeichert: boolean }
  | { quelle: 'datei'; doc: RundownDoc; hinweisAusserhalb: boolean }
  | { quelle: 'autosave-v1'; doc: RundownDoc }
  | { quelle: 'leer' };

/** Gleicher Dateistand: Pfad, Größe, Änderungszeit UND SHA-256 (4.8). */
function gleicherStand(a: DateiStand, b: DateiStand): boolean {
  return a.pfad === b.pfad && a.groesse === b.groesse && a.mtimeMs === b.mtimeMs && a.sha256 === b.sha256;
}

/** JSON mit sortierten Schlüsseln: Inhaltsvergleich unabhängig von der Feldreihenfolge. */
function stabil(wert: unknown): string {
  return JSON.stringify(wert, (_k, v: unknown) => {
    if (v === null || typeof v !== 'object' || Array.isArray(v)) return v;
    const o = v as Record<string, unknown>;
    return Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
  });
}

/**
 * Ausgangsstand beim Öffnen einer Show (5.2, Reihenfolge wie dort):
 *  1. Eigene Rundown-Datei der Show (`datei`, gelesen) nach 4.8:
 *     - kein Gedächtnis → die Datei gilt
 *     - Gedächtnis, dessen `datei` in Pfad, Größe, Änderungszeit und SHA-256
 *       gleich ist → das Gedächtnis gilt; `ungespeichert`, wenn sein Dokument
 *       inhaltlich von der Datei abweicht
 *     - sonst (außerhalb geändert, hineinkopiert, ersetzt, nie gesehen) → die
 *       Datei gilt, mit `hinweisAusserhalb`
 *  2. Ohne Datei: das Gedächtnis, falls vorhanden.
 *  3. Übergangsregel (Ergänzung 0.7): weder Gedächtnis noch Datei, der beim
 *     Start geladene Autosave war ein Version-1-Dokument und heißt wie die
 *     Show → er wird Ausgangsstand, mit `zuordnungOffen` (4.9). Das Sichern als
 *     `rundown.autosave.v1.jmrundown` erledigt der Aufrufer vorher.
 *  4. Sonst leer. Das Beispiel-Dokument ist nie Ausgangsstand: Gab es keinen
 *     Autosave, übergibt der Aufrufer `autosave: null`.
 * Verändert die Eingaben nicht.
 */
export function waehleAusgangsstand(e: {
  gedaechtnis: GedaechtnisInhalt | null;
  datei: { doc: RundownDoc; stand: DateiStand } | null;
  autosave: RundownDoc | null;
  autosaveWarV1: boolean;
  showName: string;
}): Ausgangsstand {
  const { gedaechtnis, datei } = e;
  if (datei) {
    if (!gedaechtnis) return { quelle: 'datei', doc: datei.doc, hinweisAusserhalb: false };
    if (gedaechtnis.datei && gleicherStand(gedaechtnis.datei, datei.stand)) {
      return {
        quelle: 'gedaechtnis',
        doc: gedaechtnis.doc,
        scharfId: gedaechtnis.scharfId,
        ungespeichert: stabil(gedaechtnis.doc) !== stabil(datei.doc),
      };
    }
    return { quelle: 'datei', doc: datei.doc, hinweisAusserhalb: true };
  }
  if (gedaechtnis) {
    return { quelle: 'gedaechtnis', doc: gedaechtnis.doc, scharfId: gedaechtnis.scharfId, ungespeichert: false };
  }
  if (e.autosave && e.autosaveWarV1 && e.autosave.name === e.showName) {
    return { quelle: 'autosave-v1', doc: { ...e.autosave, zuordnungOffen: true } };
  }
  return { quelle: 'leer' };
}
```

- [ ] **Schritt 5: Test laufen lassen (grün)**

```
npm run selftest -w @jm/rundown
```
Erwartet: alle Zeilen `ok`, darunter `ok   Fall 35: Gedächtnis vorhanden → Gedächtnis (auch vor einem passenden alten Autosave)`, `ok   Fall 35: Datei mit alter Änderungszeit hineinkopiert → Datei (SHA-256), mit Hinweis`, `ok   Fall 35: alter Autosave mit gleichem Namen → übernommen mit zuordnungOffen`, `ok   Fall 35: Autosave mit anderem Namen → leer`, `ok   Fall 35: kein Autosave (Beispiel-Dokument) → leer`; letzte Zeile `ALLE TESTS OK`, Exit-Code 0.

- [ ] **Schritt 6: Typecheck**

```
npm run typecheck -w @jm/rundown
```
Erwartet: `tsc --noEmit -p tsconfig.node.json` und `tsc --noEmit -p tsconfig.web.json` ohne Ausgabe, Exit-Code 0.

- [ ] **Schritt 7: Commit**

```
git add apps/rundown/src/shared/ausgangsstand.ts apps/rundown/test/selftest.ts
git status --short
git commit -m "feat(rundown): Ausgangsstand beim Öffnen einer Show wählen — Gedächtnis, eigene Datei, alter Autosave (Teil 2a)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
`git status --short` muss genau `A  apps/rundown/src/shared/ausgangsstand.ts` und `M  apps/rundown/test/selftest.ts` gestaged zeigen. Eine Warnung „LF will be replaced by CRLF“ ist harmlos (core.autocrlf).

---

#### Gegenprobe — nach dem Commit, ohne neuen Commit

Zwei Fehler werden einzeln eingebaut, der Selbsttest muss rot werden, dann wird der Fehler wieder entfernt. Nichts davon wird committet. Das Ergebnis kommt als Tabelle in den Bericht der Aufgabe. Die erwarteten Fehlerzahlen gelten für den Stand nach Schritt 7, an dem alle übrigen Tests der Datei grün sind.

- [ ] **Schritt 8: Fehler G5 einbauen — „Vergleich ohne SHA-256“ (4.8)**

Datei `apps/rundown/src/shared/ausgangsstand.ts`. Vorher:
```ts
  return a.pfad === b.pfad && a.groesse === b.groesse && a.mtimeMs === b.mtimeMs && a.sha256 === b.sha256;
```
Nachher:
```ts
  return a.pfad === b.pfad && a.groesse === b.groesse && a.mtimeMs === b.mtimeMs; // GEGENPROBE 4.8: ohne SHA-256
```

- [ ] **Schritt 9: Selbsttest mit G5 laufen lassen**

```
npm run selftest -w @jm/rundown
```
Erwartet `1 FEHLER`, Exit-Code 1:
```
FAIL Fall 35: Datei mit alter Änderungszeit hineinkopiert → Datei (SHA-256), mit Hinweis
```

- [ ] **Schritt 10: G5 zurückbauen**

Datei `apps/rundown/src/shared/ausgangsstand.ts`. Vorher (der eingebaute Fehler):
```ts
  return a.pfad === b.pfad && a.groesse === b.groesse && a.mtimeMs === b.mtimeMs; // GEGENPROBE 4.8: ohne SHA-256
```
Nachher (wieder der committete Stand):
```ts
  return a.pfad === b.pfad && a.groesse === b.groesse && a.mtimeMs === b.mtimeMs && a.sha256 === b.sha256;
```

- [ ] **Schritt 11: Fehler G6 einbauen — „Übergangsregel ohne Namensprüfung“ (5.2)**

Datei `apps/rundown/src/shared/ausgangsstand.ts`. Vorher:
```ts
  if (e.autosave && e.autosaveWarV1 && e.autosave.name === e.showName) {
```
Nachher:
```ts
  if (e.autosave && e.autosaveWarV1) { // GEGENPROBE 5.2: ohne Namensprüfung
```

- [ ] **Schritt 12: Selbsttest mit G6 laufen lassen**

```
npm run selftest -w @jm/rundown
```
Erwartet `1 FEHLER`, Exit-Code 1:
```
FAIL Fall 35: Autosave mit anderem Namen → leer
```

- [ ] **Schritt 13: G6 zurückbauen**

Datei `apps/rundown/src/shared/ausgangsstand.ts`. Vorher (der eingebaute Fehler):
```ts
  if (e.autosave && e.autosaveWarV1) { // GEGENPROBE 5.2: ohne Namensprüfung
```
Nachher (wieder der committete Stand):
```ts
  if (e.autosave && e.autosaveWarV1 && e.autosave.name === e.showName) {
```

- [ ] **Schritt 14: Rückbau prüfen**

```
git status --short
npm run selftest -w @jm/rundown
```
Erwartet: `git status --short` zeigt `apps/rundown/src/shared/ausgangsstand.ts` nicht (Arbeitsstand = Commit aus Schritt 7); der Selbsttest endet mit `ALLE TESTS OK`, Exit-Code 0. Zeigt `git status --short` die Datei noch als geändert, mit `git diff -- apps/rundown/src/shared/ausgangsstand.ts` den Rest finden und von Hand zurückbauen (kein `git checkout`, kein `git stash`).

- [ ] **Schritt 15: Ergebnis der Gegenprobe in den Bericht schreiben**

Tabelle in den Aufgabenbericht (keine Datei im Repo):

| Eingebauter Fehler | rote Fälle |
| --- | --- |
| G5 4.8 Dateistand ohne SHA-256 verglichen | Fall 35 „hineinkopiert“ |
| G6 5.2 Übergangsregel ohne Namensprüfung | Fall 35 „Autosave mit anderem Namen“ |

Weicht ein tatsächliches Ergebnis ab, das tatsächliche eintragen und die Abweichung nennen.

---

**Abweichungen vom Gerüst:**
1. **Gedächtnis ohne `datei`, Show hat jetzt eine eigene Datei:** gilt als „weicht ab“ → `{ quelle: 'datei', hinweisAusserhalb: true }`. Das Gedächtnis hat diese Datei nie gesehen; die Spec sagt „Weicht etwas ab … Dann gilt die Datei, mit dem Hinweis“.
2. **Datei referenziert, aber unlesbar:** Der Aufrufer übergibt `datei: null`; dann gilt ein vorhandenes Gedächtnis (`ungespeichert: false`), sonst die Übergangsregel bzw. leer. Den Lesefehler meldet der Aufrufer.
3. **Pfadvergleich exakt** (Groß-/Kleinschreibung zählt). Der Aufrufer bildet `DateiStand.pfad` beim Speichern und beim Öffnen auf dieselbe Weise (`path.resolve` relativ zur Show-Datei, Spec 4.8 erster Punkt).
4. **`ungespeichert`** vergleicht das Gedächtnis-Dokument mit dem Datei-Dokument inhaltlich, unabhängig von der Feldreihenfolge (JSON mit sortierten Schlüsseln), damit Dokumente aus verschiedenen Normalisierern (A4 `migrate`, A5 `gleicheAb`) nicht fälschlich als ungespeichert gelten.
5. **`autosave-v1`** setzt `zuordnungOffen: true` selbst, auch wenn A4-`migrate` es schon gesetzt hat; der übergebene Autosave wird nicht verändert (flache Kopie).

---

**Probelauf (Datum 2026-10-01):**

Aufbau: wie in A7 (Arbeitsordner `scratchpad/teil2a-plan/probe-helfer/`). Kopiert aus dem Worktree (Stand `5a4b40eaa1`): `apps/rundown/src/shared/types.ts`, `conductor.ts`, `apps/rundown/test/selftest.ts` sowie `packages/show/src/index.ts`, das nur der Typecheck braucht (`import type`, unverändert). LF wie im Index. Vorher eingespielt: der Typteil von A4 (Schritte 4 und 5) und A7 vollständig. Die Code-Blöcke kamen per Skript (`probe-helfer/nachbau.py`) wörtlich aus dieser Datei; jeder Vorher-Ausschnitt wurde genau einmal gefunden. Lauf mit `node --experimental-strip-types test/selftest.ts` in `apps/rundown`, Node 24.16.0. Typecheck mit `tsc` 5.9.3 aus dem Worktree, Optionen wie `tsconfig.node.json`/`tsconfig.web.json`, über `src/shared/**`.

Ablauf (Plan wie geschrieben, vor der Korrektur):
- Schritt 3: rot (`ERR_MODULE_NOT_FOUND … ausgangsstand.ts`, 0 × `ok`, Exit 1).
- Schritt 5: grün (14 neue `ok`).
- Typecheck: grün.
- Gegenprobe: G5 und G6 je genau die erwartete `FAIL`-Zeile, Rückbau wortgleich, Schritt 14 grün.
- Der Plan-Code von `ausgangsstand.ts` musste nicht geändert werden.

Eigene Gegenprobe (`probe-helfer/eigene_gegenprobe.py`, 14 Fehler in `ausgangsstand.ts`, je einzeln eingebaut und zurückgenommen):

| # | Eingebauter Fehler | vorher rot? | nachher rot? | rote Fälle (nachher) |
| --- | --- | --- | --- | --- |
| F1 | 4.8 Dateistand ohne Änderungszeit verglichen | **nein** | ja | „4.8: nur die Änderungszeit anders …“ |
| F2 | 4.8 Dateistand ohne Größe verglichen | **nein** | ja | „4.8: nur die Größe anders …“ |
| F3 | 4.8 Dateistand ohne Pfad verglichen | ja | ja | „4.8: anderer Pfad …“ |
| F4 | 4.8 Gedächtnis ohne `datei` gilt als gleicher Stand | ja | ja | „4.8: Gedächtnis ohne Dateistand …“ |
| F5 | 4.8 `ungespeichert` immer false | ja | ja | „4.8: Datei unverändert, Gedächtnis weicht ab …“ |
| F6 | 4.8 `ungespeichert` hängt an der Feldreihenfolge | ja | ja | „… (andere Feldreihenfolge) …“ |
| F7 | 4.8 Datei ohne Gedächtnis mit Hinweis | ja | ja | 2 Fälle |
| F8 | 5.2 Gedächtnis ohne Datei ignoriert | ja | ja | Fall 35 „Gedächtnis vorhanden …“ |
| F9 | 5.2 Übergangsregel ohne Prüfung auf Version 1 | ja | ja | Fall 35 „Autosave schon Version 2 …“ |
| F10 | 4.9 Autosave ohne `zuordnungOffen` | ja | ja | Fall 35 „… mit zuordnungOffen“ |
| F11 | Autosave an Ort und Stelle verändert | ja | ja | Fall 35 „… bleibt unverändert“ |
| F12 | 5.2 Übergangsregel vor Gedächtnis und Datei | ja | ja | 2 Fälle |
| F13 | 5.2 Gedächtnis ohne scharfe Zeile | ja | ja | Fall 35 „Gedächtnis vorhanden …“ |
| F14 | 4.8 abweichende Datei, aber Dokument aus dem Gedächtnis | ja | ja | 6 Fälle |

Korrektur (Fehler → Korrektur → Beleg):
1. **Spec 4.8 vergleicht über vier Merkmale: Pfad, Größe, Änderungszeit, SHA-256.** Jeder Test mit abweichendem Stand wich aber auch im SHA-256 oder im Pfad ab. Fiel der Vergleich über die Änderungszeit (F1) oder über die Größe (F2) weg, blieb der Selbsttest grün. Praxisfall für F1: Die Datei wird mit gleichem Inhalt neu gespeichert. Laut 4.8 gilt dann die Datei, mit Hinweis. → In Schritt 2 zwei neue Prüfungen hinter „hineinkopiert“: „4.8: nur die Änderungszeit anders → Datei, mit Hinweis“ und „4.8: nur die Größe anders → Datei, mit Hinweis“. → Beleg: Vor der Korrektur waren F1 und F2 grün (0 `FAIL`), danach je 1 `FAIL`. Der Plan-Code bleibt grün mit 16 neuen `ok`. G5 und G6 bleiben bei je 1 `FAIL`, die Erwartungen in den Schritten 9 und 12 stimmen weiter.

Frischer Nachbau aus dieser korrigierten Datei (`nachbau.py bau3`):
- Schritt 3: rot.
- Schritt 5: grün, 104 × `ok` (88 aus Bestand und A7 + 16).
- Typecheck: grün.
- Gegenprobe: die `FAIL`-Zeilen der Schritte 9 und 12 sind wortgleich.
- Schritt 14: grün.
- Alle 14 eigenen Fehler: rot.

Offen, nicht geändert:
- Abweichung 2 (eine referenzierte, aber unlesbare Rundown-Datei wird wie „keine Datei“ behandelt, die Übergangsregel darf dann greifen) ist eine Auslegung von Spec 5.2 „weder Gedächtnis noch eigene Rundown-Datei“.
- A10 (`leseRundownDatei` → `null`) setzt sie so um. Ob der alte Autosave in diesem Fall übernommen werden soll, ist eine Owner-Frage.

**Konsistenzprüfung:**
- Klarstellung (Kommentar in „Produces“, kein Code): `autosaveWarV1` meint ein Version-1-Dokument im Sinne von Spec 4.1/4.9. A10 übergibt `autosaveDoc?.zuordnungOffen === true`; das trifft auch einen alten Autosave, der zwischendurch ohne Show als Version 2 gespeichert wurde (`zuordnungOffen` bleibt nach 4.1 erhalten). Vorher stand hier „die Autosave-Datei war beim Start ein Version-1-Dokument“, das widersprach der Übergabe in A10. Funktion und Tests unverändert.

---

### Aufgabe A9: Rundown Main — Gedächtnis, Zeiger und sicheres Lesen der Show (Dateiebene)

**Spec:** 4.7 (Gedächtnis: Ort `<userData>/regie/<schlüssel>.json`, Schlüssel = 16 Hex-Zeichen SHA-256 über den mit `path.resolve` normalisierten, kleingeschriebenen Show-Pfad, Inhalt, atomar geschrieben; Zeiger `regie/zuletzt.json` mit `{ showPfad, schluessel }`), 4.8 (eigene Rundown-Datei relativ zur Show-Datei auflösen; Dateistand Pfad, Größe, Änderungszeit, SHA-256), 5.2 („Übergangsregel“: alten Autosave einmal als `rundown.autosave.v1.jmrundown` sichern; „Bei jedem Lesen der Show … hält fest: die Schlüssel des normalisierten `show.ablauf` in Reihenfolge … ob die Show eine eigene Timer-Liste hat“; „Show beim RELOAD nicht lesbar: Der Stand bleibt stehen“), 6.1 (letzter Punkt, `hatEigeneTimerListe`), 6.2 (`ablaufSchluessel`), 7.4 sinngemäß (bis zu 5 Versuche à 50 ms bei `EPERM`/`EBUSY`/`EACCES`), G6, Review-Focus 1 und 2 aus dem Gerüst.

**Dateien:**
- Create: `apps/rundown/src/main/gedaechtnis.ts`
- Create: `apps/rundown/test/gedaechtnis.test.ts`
- Create: `apps/rundown/test/register.mjs` und `apps/rundown/test/resolve-ts.mjs` (wortgleiche Kopien von `packages/appkit/test/register.mjs` und `packages/appkit/test/resolve-ts.mjs`)
- Modify: `apps/rundown/package.json` — Zeile 16 (Skript `selftest`)
- Nicht geändert: `apps/rundown/src/main/store.ts` (siehe „Abweichungen vom Gerüst“, Punkt 1)

**Schnittstellen:**

Consumes (aus früheren Aufgaben, exakt):
```ts
// A1 · @jm/show
export interface ShowAblaufItem { id?: string; label: string; durationMs?: number; note?: string; plannedStartMs?: number; owner?: string; category?: string }
export function migrateShow(raw: unknown): Show;          // normalisiert ablauf über normalizeAblauf (id erhalten, Doppelte → #2 …)
export function hatEigeneTimerListe(settings: Record<string, unknown> | undefined): boolean;
// A4 · apps/rundown/src/shared/doc-format.ts
export type NeueId = (praefix: 'r' | 'a') => string;
export function migrate(raw: unknown, neueId: NeueId): RundownDoc;
// A5 · apps/rundown/src/shared/abgleich.ts
export function ersatzSchluessel(ablauf: ShowAblaufItem[]): string[];
// A8 · apps/rundown/src/shared/ausgangsstand.ts
export interface DateiStand { pfad: string; mtimeMs: number; groesse: number; sha256: string }
export interface GedaechtnisInhalt { schemaVersion: 2; showPfad: string; showName: string; doc: RundownDoc; scharfId: string | null; gespeichertAm: string; datei?: DateiStand }
// bestehend · apps/rundown/src/shared/conductor.ts
export function newId(prefix?: string): string;
```

Produces (`apps/rundown/src/main/gedaechtnis.ts`; Gerüst plus die unter „Abweichungen“ genannten Ergänzungen):
```ts
export const REGIE_ORDNER = 'regie';
export function gedaechtnisSchluessel(showPfad: string): string; // 16 hex, sha256(path.resolve(p).toLowerCase())
export function leseGedaechtnis(ordner: string, schluessel: string): { inhalt: GedaechtnisInhalt | null; fehler?: 'kein-json' | 'unlesbar' };
export function schreibeGedaechtnis(ordner: string, inhalt: GedaechtnisInhalt): boolean; // atomar, Dateiname aus inhalt.showPfad
export function sichereDefektesGedaechtnis(ordner: string, schluessel: string): string | null; // → <schlüssel>.defekt.json
export function leseZeiger(ordner: string): { showPfad: string; schluessel: string } | null;
export function schreibeZeiger(ordner: string, z: { showPfad: string; schluessel: string }): boolean;
export function loescheZeiger(ordner: string): void;
export function sichereAltenAutosave(userData: string): boolean; // true = Sicherung liegt vor
export type ShowGelesen =
  | { ok: true; show: Show; ablaufSchluessel: string[]; eigeneTimerListe: boolean }
  | { ok: false; grund: string };
export function leseShowSicher(pfad: string): ShowGelesen;
export function rundownDateiDerShow(showPfad: string, show: Show): string | null;
export function dateiStand(pfad: string): DateiStand | null;
```
`ordner` ist immer `<userData>/regie`. Dazu: `npm run selftest -w @jm/rundown` führt ab jetzt `test/selftest.ts` **und** `test/gedaechtnis.test.ts` aus (für A17/CI ohne weiteres Skript).

**Vorab (am Repo und am Prototyp gemessen):**
- `gedaechtnis.ts` liegt in `src/main` und braucht zur Laufzeit `migrate` (A4), `ersatzSchluessel` (A5), `newId` und `@jm/show`. Unter `node --experimental-strip-types` scheitern relative Importe ohne Endung (`ERR_MODULE_NOT_FOUND`), mit `.ts`-Endung scheitert `tsc` (kein `allowImportingTsExtensions`). Das Repo löst genau das schon in `packages/appkit`: Ein Resolver-Hook (`--import ./test/register.mjs`) ergänzt im Test die Endung `.ts`. Diese Aufgabe kopiert die beiden Hook-Dateien wortgleich nach `apps/rundown/test/`.
- Deshalb importiert `gedaechtnis.ts` die shared-Module **relativ** (`../shared/…`), nicht über `@shared/…`: Der Hook kennt keine Aliase. electron-vite löst beides auf dieselbe Datei auf; im gebauten Main gibt es weiter genau ein `newId` (gemessen am Bundle).
- `@jm/show` lädt unter `node --experimental-strip-types` direkt: Der Workspace-Link zeigt auf `packages/show/src/index.ts`, Node löst den echten Pfad auf (nicht unter `node_modules`). Gemessen mit Node 24; CI nutzt Node 22 mit demselben Resolver. A6 lädt `@jm/show` im Selbsttest genauso.
- Die shared-Module von A4/A5/A8 haben nur `import type` untereinander (G2), sie laden also unter dem Hook ohne Weiteres.
- Gegengeprüft an einer Kopie der App mit dem Code von A4–A8 aus deren Prototypen und `@jm/show` nach A1: Test 45 × `ok`, `typecheck:node` und `typecheck:web` grün.
- Die Arbeitskopie hat CRLF; das Edit-Werkzeug gleicht das aus. Neue Dateien dürfen LF haben.

---

- [ ] **Schritt 1: Resolver-Hook für den Test anlegen** — zwei neue Dateien, wortgleich aus `packages/appkit/test/` kopiert (am einfachsten per Kopie: `cp packages/appkit/test/register.mjs packages/appkit/test/resolve-ts.mjs apps/rundown/test/`).

Neue Datei `apps/rundown/test/register.mjs`, ganzer Inhalt:

```js
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register('./resolve-ts.mjs', pathToFileURL(import.meta.filename));
```

Neue Datei `apps/rundown/test/resolve-ts.mjs`, ganzer Inhalt:

```js
// Node-Resolver-Hook für den Selbsttest.
//
// Die Quellen nutzen Bundler-Resolution (`import './model'` ohne Endung), weil
// Vite/electron-vite sie so auflösen. Node-ESM verlangt dagegen eine Endung.
// Statt den Produktionscode für den Test zu verbiegen (das hieße
// `allowImportingTsExtensions` in jedem konsumierenden tsconfig), ergänzt dieser
// Hook die `.ts`-Endung beim Auflösen.

import { existsSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && !/\.[cm]?[jt]s$/.test(specifier)) {
    const parentDir = context.parentURL ? dirname(fileURLToPath(context.parentURL)) : process.cwd();
    for (const suffix of ['.ts', '/index.ts']) {
      const candidate = resolvePath(parentDir, specifier + suffix);
      if (existsSync(candidate)) {
        return nextResolve(pathToFileURL(candidate).href, context);
      }
    }
  }
  return nextResolve(specifier, context);
}
```

- [ ] **Schritt 2: Fehlschlagenden Test schreiben** — neue Datei mit eigener `eq`-Hilfe im Stil von `test/selftest.ts`, aber mit sortierten Schlüsseln (die Feldreihenfolge der Normalisierer aus A4 soll den Vergleich nicht kippen). Arbeitet nur in einem Temp-Ordner und räumt ihn im `finally` weg.

Neue Datei `apps/rundown/test/gedaechtnis.test.ts`, ganzer Inhalt:

```ts
// Selbsttest der Gedächtnis-Dateiebene (Spec 4.7, 4.8, 5.2) auf einem Temp-Ordner, ohne Electron:
//   node --experimental-strip-types --import ./test/register.mjs test/gedaechtnis.test.ts
// Der Hook (test/register.mjs → test/resolve-ts.mjs) ergänzt die `.ts`-Endung der relativen
// Importe in src/main/gedaechtnis.ts, wie es im Build electron-vite tut.
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  dateiStand,
  gedaechtnisSchluessel,
  leseGedaechtnis,
  leseShowSicher,
  leseZeiger,
  loescheZeiger,
  rundownDateiDerShow,
  schreibeGedaechtnis,
  schreibeZeiger,
  sichereAltenAutosave,
  sichereDefektesGedaechtnis,
} from '../src/main/gedaechtnis.ts';
import type { GedaechtnisInhalt } from '../src/shared/ausgangsstand.ts';

let failed = 0;
/** Schlüssel rekursiv sortieren: der Vergleich hängt nicht an der Feldreihenfolge der Normalisierer. */
function sortiert(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortiert);
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return Object.fromEntries(Object.keys(o).sort().map((k) => [k, sortiert(o[k])]));
  }
  return v;
}
function eq(actual: unknown, expected: unknown, msg: string): void {
  const a = JSON.stringify(sortiert(actual));
  const e = JSON.stringify(sortiert(expected));
  if (a !== e) {
    failed++;
    console.error(`FAIL ${msg}\n  erwartet: ${e}\n  bekommen: ${a}`);
  } else {
    console.log(`ok   ${msg}`);
  }
}

const tmp = mkdtempSync(join(tmpdir(), 'jm-rundown-gedaechtnis-'));
const ordner = join(tmp, 'regie');
try {
  // ── gedaechtnisSchluessel (4.7) ────────────────────────────────────────────
  const showPfad = join(tmp, 'Shows', 'Tag 1.jmshow');
  const s1 = gedaechtnisSchluessel(showPfad);
  eq(/^[0-9a-f]{16}$/.test(s1), true, 'Schlüssel: 16 Hex-Zeichen');
  eq(gedaechtnisSchluessel(join(tmp, 'shows', 'x', '..', 'TAG 1.jmshow')), s1, 'Schlüssel: Pfad aufgelöst und kleingeschrieben');
  eq(gedaechtnisSchluessel(join(tmp, 'Shows', 'Tag 2.jmshow')) === s1, false, 'Schlüssel: andere Show-Datei → anderer Schlüssel');

  // ── Gedächtnis schreiben und lesen ─────────────────────────────────────────
  eq(leseGedaechtnis(ordner, s1), { inhalt: null }, 'kein Gedächtnis → inhalt null, kein Fehler');
  const inhalt: GedaechtnisInhalt = {
    schemaVersion: 2,
    showPfad,
    showName: 'Tag 1',
    doc: {
      schemaVersion: 2,
      name: 'Tag 1',
      kontext: 'se:p1',
      rows: [
        {
          id: 'u1',
          label: 'Begrüßung',
          quelle: 'ablauf',
          actions: [{ id: 'a1', role: 'timer', verb: 'goto', args: [2], enabled: true, zielId: 'u2' }],
        },
        {
          id: 'u2',
          label: 'Panel',
          quelle: 'ablauf',
          entfallen: true,
          actions: [{ id: 'a2', role: 'titler', verb: 'take', args: [], enabled: false }],
        },
        { id: 'r_eigen', label: 'Einspieler', actions: [] },
      ],
      archiv: { 'se:p2': [{ id: 'v1', label: 'Andere Agenda', quelle: 'ablauf', actions: [] }] },
    },
    scharfId: 'u1',
    gespeichertAm: '2026-10-01T10:00:00.000Z',
  };
  eq(schreibeGedaechtnis(ordner, inhalt), true, 'schreibeGedaechtnis → true (Ordner wird angelegt)');
  eq(readdirSync(ordner), [`${s1}.json`], 'Datei heißt <schlüssel>.json, keine Zwischendatei übrig');
  eq(leseGedaechtnis(ordner, s1), { inhalt }, 'Gedächtnis kommt unverändert zurück (Archiv, Markierung, zielId, scharfId)');
  const mitDatei: GedaechtnisInhalt = {
    ...inhalt,
    datei: { pfad: join(tmp, 'eigen.jmrundown'), mtimeMs: 1727776800000, groesse: 42, sha256: 'a'.repeat(64) },
  };
  schreibeGedaechtnis(ordner, mitDatei);
  eq(leseGedaechtnis(ordner, s1).inhalt?.datei, mitDatei.datei, 'datei-Stand (4.8) bleibt erhalten');

  // ── Review-Focus 2: kaputtes Gedächtnis ────────────────────────────────────
  const gPfad = join(ordner, `${s1}.json`);
  const halbGeschrieben = '{"schemaVersion":2,"showPfad":"GEHEIM","doc":{"rows":[';
  writeFileSync(gPfad, halbGeschrieben);
  eq(leseGedaechtnis(ordner, s1), { inhalt: null, fehler: 'kein-json' }, 'kaputtes JSON → inhalt null, fehler kein-json');
  eq(readFileSync(gPfad, 'utf8'), halbGeschrieben, 'kaputte Datei bleibt liegen (nicht gelöscht)');
  const beiseite = sichereDefektesGedaechtnis(ordner, s1);
  eq(beiseite, join(ordner, `${s1}.defekt.json`), 'defektes Gedächtnis → <schlüssel>.defekt.json');
  eq(beiseite ? readFileSync(beiseite, 'utf8') : null, halbGeschrieben, 'Sicherung enthält den defekten Stand');
  writeFileSync(gPfad, JSON.stringify({ schemaVersion: 1, showPfad: 'x', doc: {} }));
  eq(leseGedaechtnis(ordner, s1), { inhalt: null, fehler: 'unlesbar' }, 'falsche Form → fehler unlesbar');
  eq(schreibeGedaechtnis(ordner, inhalt), true, 'nach dem Defekt: Schreiben gelingt');
  eq(leseGedaechtnis(ordner, s1).inhalt?.scharfId, 'u1', 'nach dem Defekt: Gedächtnis wieder lesbar');

  // ── atomar: Umbenennen scheitert ───────────────────────────────────────────
  const zweiterPfad = join(tmp, 'Shows', 'Tag 2.jmshow');
  mkdirSync(join(ordner, `${gedaechtnisSchluessel(zweiterPfad)}.json`));
  eq(schreibeGedaechtnis(ordner, { ...inhalt, showPfad: zweiterPfad }), false, 'Ziel ist ein Ordner → false');
  eq(readdirSync(ordner).filter((n) => n.endsWith('.tmp')), [], 'gescheitertes Schreiben räumt die Zwischendatei weg');

  // ── Zeiger regie/zuletzt.json (4.7) ────────────────────────────────────────
  eq(leseZeiger(ordner), null, 'kein Zeiger → null');
  eq(schreibeZeiger(ordner, { showPfad, schluessel: s1 }), true, 'Zeiger geschrieben');
  eq(leseZeiger(ordner), { showPfad, schluessel: s1 }, 'Zeiger gelesen');
  writeFileSync(join(ordner, 'zuletzt.json'), JSON.stringify({ showPfad, schluessel: '../../boese' }));
  eq(leseZeiger(ordner), null, 'Zeiger mit ungültigem Schlüssel → null');
  writeFileSync(join(ordner, 'zuletzt.json'), '{"showPfad":');
  eq(leseZeiger(ordner), null, 'kaputter Zeiger → null');
  loescheZeiger(ordner);
  eq(readdirSync(ordner).includes('zuletzt.json'), false, 'Zeiger gelöscht');
  loescheZeiger(ordner);
  eq(true, true, 'Zeiger zweimal löschen wirft nicht');

  // ── alter Autosave (5.2, Übergangsregel) ───────────────────────────────────
  const userData = join(tmp, 'userData');
  mkdirSync(userData);
  eq(sichereAltenAutosave(userData), false, 'ohne Autosave → false');
  const altText = JSON.stringify({ schemaVersion: 1, name: 'COP31', rows: [] });
  writeFileSync(join(userData, 'rundown.autosave.jmrundown'), altText);
  eq(sichereAltenAutosave(userData), true, 'alter Autosave gesichert → true');
  eq(readFileSync(join(userData, 'rundown.autosave.v1.jmrundown'), 'utf8'), altText, 'Sicherung = alter Autosave');
  writeFileSync(join(userData, 'rundown.autosave.jmrundown'), '{"schemaVersion":2,"name":"neu","rows":[]}');
  eq(sichereAltenAutosave(userData), true, 'Sicherung liegt schon vor → true');
  eq(readFileSync(join(userData, 'rundown.autosave.v1.jmrundown'), 'utf8'), altText, 'vorhandene Sicherung wird nicht überschrieben');

  // ── Review-Focus 1: Show lesen ─────────────────────────────────────────────
  mkdirSync(join(tmp, 'Shows'), { recursive: true });
  eq(leseShowSicher(showPfad), { ok: false, grund: 'Datei nicht gefunden' }, 'fehlende Show → nicht lesbar');
  writeFileSync(showPfad, '{"schemaVersion":1,"name":"Geheimname","tools":[');
  const halb = leseShowSicher(showPfad);
  eq(halb, { ok: false, grund: 'kein gültiges JSON' }, 'halb geschriebene Show → kein gültiges JSON');
  eq(JSON.stringify(halb).includes('Geheimname'), false, 'Grund enthält keinen Dateiinhalt (G6)');
  eq(leseShowSicher(join(tmp, 'Shows')).ok, false, 'Ordner statt Datei → nicht lesbar, wirft nicht');
  writeFileSync(showPfad, '[1,2]');
  eq(leseShowSicher(showPfad), { ok: false, grund: 'keine Show-Datei' }, 'JSON ohne Objekt → keine Show-Datei');
  writeFileSync(
    showPfad,
    JSON.stringify({
      schemaVersion: 1,
      name: 'Tag 1',
      tools: [
        { appId: 'jm-timer', settings: { timetable: [{ label: 'X', durationMs: 1000 }] } },
        { appId: 'jm-rundown', document: 'rd/tag1.jmrundown' },
      ],
      ablauf: [{ id: 'u1', label: 'A' }, { label: 'B' }, { label: 'B' }, { id: 'u1', label: 'C' }],
    }),
  );
  const gut = leseShowSicher(showPfad);
  eq(gut.ok, true, 'reparierte Show wieder lesbar (das nächste RELOAD heilt)');
  if (gut.ok) {
    eq(gut.show.name, 'Tag 1', 'Show-Name gelesen');
    eq(gut.ablaufSchluessel, ['u1', 'ersatz:B', 'ersatz:B#2', 'u1#2'], 'Schlüssel: Kennung, Ersatz-Kennungen, Doppelte aufgelöst');
    eq(gut.eigeneTimerListe, true, 'eigene Timer-Liste erkannt');
    eq(rundownDateiDerShow(showPfad, gut.show), join(tmp, 'Shows', 'rd', 'tag1.jmrundown'), 'eigene Rundown-Datei relativ zur Show (4.8)');
  }
  const absolutRd = join(tmp, 'absolut.jmrundown');
  writeFileSync(
    showPfad,
    JSON.stringify({ schemaVersion: 1, name: 'Tag 1', tools: [{ appId: 'jm-rundown', document: absolutRd }] }),
  );
  const ohneAblauf = leseShowSicher(showPfad);
  eq(ohneAblauf.ok ? [ohneAblauf.ablaufSchluessel, ohneAblauf.eigeneTimerListe] : null, [[], false], 'Show ohne Ablauf → keine Schlüssel, keine Timer-Liste');
  eq(ohneAblauf.ok ? rundownDateiDerShow(showPfad, ohneAblauf.show) : 'x', absolutRd, 'absoluter Verweis bleibt absolut');
  writeFileSync(showPfad, JSON.stringify({ schemaVersion: 1, name: 'Tag 1', tools: [] }));
  const ohneVerweis = leseShowSicher(showPfad);
  eq(ohneVerweis.ok ? rundownDateiDerShow(showPfad, ohneVerweis.show) : 'x', null, 'ohne Verweis → null');

  // ── dateiStand (4.8) ───────────────────────────────────────────────────────
  const rdPfad = join(tmp, 'eigen.jmrundown');
  writeFileSync(rdPfad, '{"a":1}');
  const st = dateiStand(rdPfad);
  eq(st ? [st.pfad, st.groesse, /^[0-9a-f]{64}$/.test(st.sha256), st.mtimeMs > 0] : null, [rdPfad, 7, true, true], 'dateiStand: Pfad, Größe, SHA-256, Änderungszeit');
  writeFileSync(rdPfad, '{"a":2}');
  const st2 = dateiStand(rdPfad);
  eq(st2 !== null && st !== null && st2.groesse === st.groesse && st2.sha256 !== st.sha256, true, 'gleiche Größe, anderer Inhalt → anderer SHA-256');
  eq(dateiStand(join(tmp, 'fehlt.jmrundown')), null, 'fehlende Datei → null');
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log(failed === 0 ? '\nALLE TESTS OK' : `\n${failed} FEHLER`);
process.exit(failed === 0 ? 0 : 1);
```

- [ ] **Schritt 3: Selbsttest-Skript erweitern**, damit `npm run selftest -w @jm/rundown` (und damit CI aus A17) beide Tests ausführt.

Datei `apps/rundown/package.json` (Zeile 16).

Vorher:
```json
    "selftest": "node --experimental-strip-types test/selftest.ts",
```
Nachher:
```json
    "selftest": "node --experimental-strip-types test/selftest.ts && node --experimental-strip-types --import ./test/register.mjs test/gedaechtnis.test.ts",
```

- [ ] **Schritt 4: Test laufen lassen (rot).**

```bash
npm run selftest -w @jm/rundown
```
Erwartet: `test/selftest.ts` läuft wie bisher bis `ALLE TESTS OK`; danach bricht `test/gedaechtnis.test.ts` beim Laden ab, ohne eine `ok`-Zeile, Exit-Code 1:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…\apps\rundown\src\main\gedaechtnis.ts' imported from …\apps\rundown\test\gedaechtnis.test.ts
```

- [ ] **Schritt 5: Implementierung anlegen.**

Neue Datei `apps/rundown/src/main/gedaechtnis.ts`, ganzer Inhalt:

```ts
// Gedächtnis des Rundowns je Show-Datei (Spec 4.7, 4.8, 5.2) — die Dateiebene.
//
// Bewusst OHNE Electron: Ordner (`<userData>/regie`) und userData-Pfad kommen als
// Argument. So prüft test/gedaechtnis.test.ts das Modul mit
// `node --experimental-strip-types` auf einem Temp-Ordner. Die relativen Importe
// unten haben keine Endung; im Build löst electron-vite sie auf, im Test der Hook
// test/resolve-ts.mjs. Deshalb hier keine `@shared/…`-Aliase.
import { createHash } from 'node:crypto';
import {
  constants,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { hatEigeneTimerListe, migrateShow, type Show } from '@jm/show';
import { ersatzSchluessel } from '../shared/abgleich';
import { newId } from '../shared/conductor';
import { migrate } from '../shared/doc-format';
import type { DateiStand, GedaechtnisInhalt } from '../shared/ausgangsstand';

/** Unterordner in userData für Gedächtnis und Zeiger (4.7). */
export const REGIE_ORDNER = 'regie';
const ZEIGER_DATEI = 'zuletzt.json';
const AUTOSAVE_DATEI = 'rundown.autosave.jmrundown';
const AUTOSAVE_V1_DATEI = 'rundown.autosave.v1.jmrundown';
/** Windows: Umbenennen scheitert kurz, solange ein anderer Prozess die Datei offen hat. */
const WIEDERHOLBAR = new Set(['EPERM', 'EBUSY', 'EACCES']);

function fehlerCode(e: unknown): string {
  return (e as NodeJS.ErrnoException | null)?.code ?? 'EIO';
}

function schlafeSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Zwischendatei im selben Ordner schreiben, dann umbenennen. Scheitert das
 * Umbenennen an einer Windows-Sperre, bis zu 5 Versuche im Abstand von 50 ms
 * (wie Spec 7.4). Scheitert alles: Zwischendatei weg, false.
 */
function schreibeAtomar(ziel: string, inhalt: string): boolean {
  const zwischen = `${ziel}.${process.pid}.${Date.now()}.tmp`;
  try {
    mkdirSync(dirname(ziel), { recursive: true });
    writeFileSync(zwischen, inhalt, 'utf8');
  } catch {
    try {
      unlinkSync(zwischen);
    } catch {
      /* gab es nie */
    }
    return false;
  }
  for (let versuch = 1; ; versuch++) {
    try {
      renameSync(zwischen, ziel);
      return true;
    } catch (e) {
      if (!WIEDERHOLBAR.has(fehlerCode(e)) || versuch >= 5) {
        try {
          unlinkSync(zwischen);
        } catch {
          /* schon weg */
        }
        return false;
      }
      schlafeSync(50);
    }
  }
}

/**
 * Schlüssel des Gedächtnisses einer Show (4.7): die ersten 16 Hex-Zeichen von
 * SHA-256 über den mit `path.resolve` normalisierten, kleingeschriebenen Pfad.
 */
export function gedaechtnisSchluessel(showPfad: string): string {
  return createHash('sha256').update(resolve(showPfad).toLowerCase()).digest('hex').slice(0, 16);
}

function pruefeDateiStand(v: unknown): DateiStand | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (typeof o.pfad !== 'string' || !o.pfad) return null;
  if (typeof o.mtimeMs !== 'number' || !Number.isFinite(o.mtimeMs)) return null;
  if (typeof o.groesse !== 'number' || !Number.isFinite(o.groesse)) return null;
  if (typeof o.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(o.sha256)) return null;
  return { pfad: o.pfad, mtimeMs: o.mtimeMs, groesse: o.groesse, sha256: o.sha256 };
}

function pruefeGedaechtnis(roh: unknown): GedaechtnisInhalt | null {
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return null;
  const o = roh as Record<string, unknown>;
  if (o.schemaVersion !== 2 || typeof o.showPfad !== 'string' || !o.showPfad) return null;
  if (!o.doc || typeof o.doc !== 'object') return null;
  const datei = pruefeDateiStand(o.datei);
  return {
    schemaVersion: 2,
    showPfad: o.showPfad,
    showName: typeof o.showName === 'string' ? o.showName : '',
    doc: migrate(o.doc, newId),
    scharfId: typeof o.scharfId === 'string' ? o.scharfId : null,
    gespeichertAm: typeof o.gespeichertAm === 'string' ? o.gespeichertAm : '',
    ...(datei ? { datei } : {}),
  };
}

/**
 * Gedächtnis `<ordner>/<schlüssel>.json` lesen. Fehlt es: `{ inhalt: null }`.
 * Kaputt oder fremd: `inhalt: null` plus Fehlerart; die Datei bleibt liegen
 * (Review-Focus 2). Die Parser-Meldung wird nie weitergegeben (G6).
 */
export function leseGedaechtnis(
  ordner: string,
  schluessel: string,
): { inhalt: GedaechtnisInhalt | null; fehler?: 'kein-json' | 'unlesbar' } {
  let text: string;
  try {
    text = readFileSync(join(ordner, `${schluessel}.json`), 'utf8');
  } catch (e) {
    return fehlerCode(e) === 'ENOENT' ? { inhalt: null } : { inhalt: null, fehler: 'unlesbar' };
  }
  let roh: unknown;
  try {
    roh = JSON.parse(text);
  } catch {
    return { inhalt: null, fehler: 'kein-json' };
  }
  const inhalt = pruefeGedaechtnis(roh);
  return inhalt ? { inhalt } : { inhalt: null, fehler: 'unlesbar' };
}

/** Gedächtnis atomar schreiben; der Dateiname kommt aus `inhalt.showPfad`. */
export function schreibeGedaechtnis(ordner: string, inhalt: GedaechtnisInhalt): boolean {
  const schluessel = gedaechtnisSchluessel(inhalt.showPfad);
  return schreibeAtomar(join(ordner, `${schluessel}.json`), JSON.stringify(inhalt, null, 2) + '\n');
}

/**
 * Ein defektes Gedächtnis als `<schlüssel>.defekt.json` daneben sichern, bevor
 * das nächste Schreiben es ersetzt. Liefert den Pfad der Sicherung oder null.
 */
export function sichereDefektesGedaechtnis(ordner: string, schluessel: string): string | null {
  const ziel = join(ordner, `${schluessel}.defekt.json`);
  try {
    copyFileSync(join(ordner, `${schluessel}.json`), ziel);
    return ziel;
  } catch {
    return null;
  }
}

/** Zeiger auf die gemerkte Show (`<ordner>/zuletzt.json`, 4.7) oder null. */
export function leseZeiger(ordner: string): { showPfad: string; schluessel: string } | null {
  try {
    const roh = JSON.parse(readFileSync(join(ordner, ZEIGER_DATEI), 'utf8')) as unknown;
    if (!roh || typeof roh !== 'object') return null;
    const o = roh as Record<string, unknown>;
    if (typeof o.showPfad !== 'string' || !o.showPfad) return null;
    // Der Schlüssel landet in einem Dateinamen → nur genau 16 Hex-Zeichen.
    if (typeof o.schluessel !== 'string' || !/^[0-9a-f]{16}$/.test(o.schluessel)) return null;
    return { showPfad: o.showPfad, schluessel: o.schluessel };
  } catch {
    return null;
  }
}

export function schreibeZeiger(ordner: string, z: { showPfad: string; schluessel: string }): boolean {
  return schreibeAtomar(
    join(ordner, ZEIGER_DATEI),
    JSON.stringify({ showPfad: z.showPfad, schluessel: z.schluessel }, null, 2) + '\n',
  );
}

export function loescheZeiger(ordner: string): void {
  try {
    unlinkSync(join(ordner, ZEIGER_DATEI));
  } catch {
    /* gibt es schon nicht */
  }
}

/**
 * Übergangsregel 5.2: den alten Autosave einmal als `rundown.autosave.v1.jmrundown`
 * sichern. Eine vorhandene Sicherung wird nie überschrieben. true = eine Sicherung
 * liegt vor (gerade angelegt oder schon da), false = kein Autosave oder Kopie gescheitert.
 */
export function sichereAltenAutosave(userData: string): boolean {
  const ziel = join(userData, AUTOSAVE_V1_DATEI);
  if (existsSync(ziel)) return true;
  try {
    copyFileSync(join(userData, AUTOSAVE_DATEI), ziel, constants.COPYFILE_EXCL);
    return true;
  } catch (e) {
    return fehlerCode(e) === 'EEXIST';
  }
}

export type ShowGelesen =
  | { ok: true; show: Show; ablaufSchluessel: string[]; eigeneTimerListe: boolean }
  | { ok: false; grund: string };

/**
 * Show lesen, ohne zu werfen (Review-Focus 1). `ablaufSchluessel` sind die
 * Schlüssel des normalisierten `show.ablauf` in Reihenfolge (R9, für 6.2),
 * `eigeneTimerListe` die Bedingung aus 6.1. `grund` enthält nie Dateiinhalt (G6).
 */
export function leseShowSicher(pfad: string): ShowGelesen {
  let text: string;
  try {
    text = readFileSync(pfad, 'utf8');
  } catch (e) {
    const code = fehlerCode(e);
    if (code === 'ENOENT') return { ok: false, grund: 'Datei nicht gefunden' };
    if (WIEDERHOLBAR.has(code)) return { ok: false, grund: `Datei gesperrt oder kein Zugriff (${code})` };
    return { ok: false, grund: `Lesefehler (${code})` };
  }
  let roh: unknown;
  try {
    roh = JSON.parse(text);
  } catch {
    return { ok: false, grund: 'kein gültiges JSON' };
  }
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return { ok: false, grund: 'keine Show-Datei' };
  const show = migrateShow(roh);
  const timerSettings = show.tools.find((t) => t.appId === 'jm-timer')?.settings;
  return {
    ok: true,
    show,
    ablaufSchluessel: ersatzSchluessel(show.ablauf ?? []),
    eigeneTimerListe: hatEigeneTimerListe(timerSettings),
  };
}

/** Eigene `.jmrundown` der Show (4.8): relativ zur Show-Datei aufgelöst, null ohne Verweis. */
export function rundownDateiDerShow(showPfad: string, show: Show): string | null {
  const ref = show.tools.find((t) => t.appId === 'jm-rundown')?.document?.trim();
  if (!ref) return null;
  return isAbsolute(ref) ? resolve(ref) : resolve(dirname(resolve(showPfad)), ref);
}

/** Stand einer Datei für den Vergleich in 4.8 (Pfad, Größe, Änderungszeit, SHA-256) oder null. */
export function dateiStand(pfad: string): DateiStand | null {
  try {
    const abs = resolve(pfad);
    const st = statSync(abs);
    const sha256 = createHash('sha256').update(readFileSync(abs)).digest('hex');
    return { pfad: abs, mtimeMs: st.mtimeMs, groesse: st.size, sha256 };
  } catch {
    return null;
  }
}
```

- [ ] **Schritt 6: Test laufen lassen (grün).**

```bash
npm run selftest -w @jm/rundown
```
Erwartet: zweimal `ALLE TESTS OK` (erst `selftest.ts`, dann `gedaechtnis.test.ts`), Exit-Code 0. `gedaechtnis.test.ts` druckt 45 Zeilen `ok   …`, darunter:
```
ok   Schlüssel: Pfad aufgelöst und kleingeschrieben
ok   Gedächtnis kommt unverändert zurück (Archiv, Markierung, zielId, scharfId)
ok   kaputtes JSON → inhalt null, fehler kein-json
ok   kaputte Datei bleibt liegen (nicht gelöscht)
ok   gescheitertes Schreiben räumt die Zwischendatei weg
ok   Zeiger mit ungültigem Schlüssel → null
ok   vorhandene Sicherung wird nicht überschrieben
ok   halb geschriebene Show → kein gültiges JSON
ok   Grund enthält keinen Dateiinhalt (G6)
ok   reparierte Show wieder lesbar (das nächste RELOAD heilt)
ok   Schlüssel: Kennung, Ersatz-Kennungen, Doppelte aufgelöst
ok   eigene Rundown-Datei relativ zur Show (4.8)
ok   gleiche Größe, anderer Inhalt → anderer SHA-256
```
Unter Windows dauert der Fall „Ziel ist ein Ordner → false“ etwa 250 ms (5 Versuche bei `EPERM`); unter Linux scheitert das Umbenennen sofort mit `EISDIR`. Fällt nur „Schlüssel: Kennung, Ersatz-Kennungen, Doppelte aufgelöst“ durch, fehlt A1 (`normalizeAblauf`) oder A5 (`ersatzSchluessel`).

- [ ] **Schritt 7: Typecheck.**

```bash
npm run typecheck -w @jm/rundown
```
Erwartet: `typecheck:node` und `typecheck:web` ohne Ausgabe von `tsc`, Exit-Code 0 (`gedaechtnis.ts` liegt in `src/main` und wird von `tsconfig.node.json` geprüft; die relativen Importe ohne Endung sind unter `moduleResolution: "Bundler"` gültig).

- [ ] **Schritt 8: Commit.**

```bash
git add apps/rundown/src/main/gedaechtnis.ts apps/rundown/test/gedaechtnis.test.ts apps/rundown/test/register.mjs apps/rundown/test/resolve-ts.mjs apps/rundown/package.json
git status --short
git commit -m "feat(rundown): Gedächtnis je Show-Datei, Zeiger und sicheres Lesen der Show" -m "gedaechtnis.ts (ohne Electron) schreibt regie/<schlüssel>.json und regie/zuletzt.json atomar, sichert den alten Autosave einmal als rundown.autosave.v1.jmrundown und liest die Show, ohne zu werfen: Schlüssel des Ablaufs, eigene Timer-Liste, Grund ohne Dateiinhalt (Spec 4.7, 4.8, 5.2). Eigener Test auf einem Temp-Ordner, ausgeführt mit dem Resolver-Hook aus packages/appkit." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
`git status --short` vor dem Commit lesen: gestagt sind genau `apps/rundown/package.json` (`M`), `apps/rundown/src/main/gedaechtnis.ts`, `apps/rundown/test/gedaechtnis.test.ts`, `apps/rundown/test/register.mjs`, `apps/rundown/test/resolve-ts.mjs` (je `A`). Fehlt einer, war `git add` unvollständig. Nicht pushen.

**Abweichungen vom Gerüst:**
1. **`store.ts` bleibt unverändert.** Ob der Autosave geschrieben wird (nur ohne gemerkte Show, 4.7), entscheidet der Aufrufer in A10 (`sichere()`); `loadAutosave`/`saveAutosave`/`readDoc`/`writeDoc` reichen dafür, wie sie nach A4 sind. Die dann ungenutzte `docFromAblauf` entfernt A10 zusammen mit ihrer letzten Nutzung in `index.ts`.
2. **Zusätzliche Exporte:** `REGIE_ORDNER`; Typ `ShowGelesen` (das Ergebnis von `leseShowSicher` als Namen, A10 braucht ihn); `sichereDefektesGedaechtnis` (Review-Focus 2 „nicht gelöscht“ hält so auch über das nächste Schreiben hinaus: A10 legt den defekten Stand als `<schlüssel>.defekt.json` beiseite, bevor das Gedächtnis neu geschrieben wird); `rundownDateiDerShow` (4.8 erster Punkt, relativ zur Show-Datei, im Test geprüft).
3. **`sichereAltenAutosave` liefert `true`, sobald eine Sicherung vorliegt** — gerade angelegt oder schon vorhanden. `false` heißt: kein Autosave da oder Kopie gescheitert. Eine vorhandene Sicherung wird nie überschrieben (`COPYFILE_EXCL`). A10 macht davon abhängig, ob der Autosave als übernommen gilt.
4. **`leseShowSicher`** gibt feste Gründe ohne Dateiinhalt (G6): „Datei nicht gefunden“, „Datei gesperrt oder kein Zugriff (<Code>)“ bei `EPERM`/`EBUSY`/`EACCES`, „Lesefehler (<Code>)“ sonst, „kein gültiges JSON“, „keine Show-Datei“ (gültiges JSON, aber kein Objekt). Dafür ruft es `migrateShow` nach eigenem `JSON.parse` statt `parseShow`. `EBUSY` lässt sich im Test nicht portabel erzeugen; geprüft werden fehlende Datei, Ordner statt Datei (`EISDIR`), halbes JSON und Nicht-Objekt.
5. **`leseZeiger`** nimmt nur einen Schlüssel aus genau 16 Hex-Zeichen an (er wird Teil eines Dateinamens).
6. **`schreibeGedaechtnis`** bildet den Dateinamen aus `inhalt.showPfad`; Name und Inhalt können so nicht auseinanderlaufen.
7. **Testlauf** mit dem Resolver-Hook aus `packages/appkit` (`--import ./test/register.mjs`); `selftest` ruft beide Testskripte nacheinander auf (`&&`), CI braucht kein weiteres Skript.

---

### Aufgabe A10: Rundown Main — Verdrahtung (Ladewege, RELOAD, Gedächtnis, Hinweise, scharfe Zeile über die Kennung, Sprung beim Senden)

**Spec:** 4.5 („Absicherung im Main“), 4.6 (Kanal und Texte, wortgleich), 4.7 (Autosave nur noch ohne gemerkte Show, Gedächtnis bei jeder Änderung des Dokuments oder der scharfen Zeile, Zeiger), 4.8 (eigene Rundown-Datei: relativ auflösen, Ausgangsstand, „Speichern“ aktualisiert `gedaechtnis.datei`), 5.1 (`case 'reload'`, Warnung wortgleich zum Timer, `default`-Zweig, 300 ms), 5.2 (alle Ladewege inkl. Start ohne Deep-Link über den Zeiger, Übergangsregel, „Show ohne Ablauf“, „Bei jedem Lesen der Show“, „Show beim RELOAD nicht lesbar“), 5.3 (`scharfId` statt `index`, STATE `cue=`), 5.4 (Abgleich und Bearbeiten brechen nichts ab; andere Show/Datei/„Neu“ brechen ab), 5.5 (`rev`, `abgleichRev`, Abweisung, Abweisungszähler), 6.2 (Auflösung in `fireOne` beim Senden; Test-Knopf per `rowId`/`actionId`; Quittung `{ role: 'timer', line: 'TIMER GOTO (Ziel entfallen)', delivered: false }`).

**Dateien:**
- Create: `apps/rundown/src/shared/hinweise.ts` (Texte aus 4.6, rein, getestet)
- Create: `apps/rundown/src/shared/zeilen.ts` (reine Helfer für Main und Renderer, getestet)
- Modify: `apps/rundown/src/main/index.ts` — Zeilen 4–12 (Importe), 21–29 (Zustand), 38–40 (`buildState`), 48–49 (`buildSuiteState`), 73–79 (`handleSuiteCommand`), 92–102 (`setDoc`), 116–121 (`fireOne`), 150–155 (`doNav`), 163–170 (`openDialog`), 184–187 (`saveDialog`), 199–204 (`rundown:fireAction`), 238–247 (`rundown:setDoc`, `rundown:new`), 262–292 (`applyShowFromDeepLink`), 362–367 (`whenReady`). Alle Zeilenangaben: Stand vor dieser Aufgabe (A4–A9 ändern `index.ts` nicht).
- Modify: `apps/rundown/src/shared/types.ts` — `RundownState` (Stand nach A4 etwa Zeilen 107–132)
- Modify: `apps/rundown/src/main/store.ts` — Import `ShowAblaufItem` und `docFromAblauf` (Stand nach A4)
- Modify: `apps/rundown/src/main/control-server.ts` — Kopfkommentar Zeilen 5–6
- Test: `apps/rundown/test/selftest.ts` — Importe vor `let failed = 0;`, zwei Blöcke vor der Schlusszeile

**Schnittstellen:**

Consumes (exakt):
```ts
// A4 · types.ts
interface RundownAction { /* … */ zielId?: string }
interface RundownRow { /* … */ quelle?: 'ablauf'; entfallen?: true }
interface RundownDoc { schemaVersion: 2; name: string; rows: RundownRow[]; kontext?: string; archiv?: Record<string, RundownRow[]>; zuordnungOffen?: true }
// A4 · store.ts (unverändert nutzbar)
export function defaultDoc(): RundownDoc;  export function readDoc(path: string): RundownDoc;
export function writeDoc(path: string, doc: RundownDoc): void;
export function loadAutosave(): RundownDoc | null;  export function saveAutosave(doc: RundownDoc): void;
export function migrate(raw: unknown): RundownDoc;  // = migrate aus doc-format mit newId
// A5/A6 · abgleich.ts
export interface AbgleichBericht { geaendert: number; neu: number; entfallen: number; entfernt: number; zurueck: number; verschoben: number; scharfVerrueckt: { von: string; nach: string | null } | null }
export function berichtIstLeer(b: AbgleichBericht): boolean;
export function wendeShowAn(e: { doc: RundownDoc; scharfId: string | null; show: ShowFuerAbgleich }): { doc: RundownDoc; scharfId: string | null; bericht: AbgleichBericht | null; kontextGewechselt: boolean };
// A7 · sprung.ts, scharf.ts, conductor.ts
export type SprungErgebnis = { n: number; gebunden: boolean } | { entfallen: true };
export function loeseSprungZiel(aktion: RundownAction, ablaufSchluessel: string[], eigeneTimerListe: boolean): SprungErgebnis;
export function scharfNachBearbeitung(alt: RundownRow[], neu: RundownRow[], scharfId: string | null): string | null;
export function indexVon(rows: RundownRow[], scharfId: string | null): number;
export function alsEigeneZeile(r: RundownRow, id: string): RundownRow;
export function bereinigeQuellen(rows: RundownRow[], ablaufSchluessel: string[], bisherEntfallen: Set<string>, neueId: () => string): RundownRow[];
export function nimmAenderungAn(basisRev: number, abgleichRev: number): boolean;
export function erzeugeBuendler(ms: number, plane: (fn: () => void, ms: number) => unknown, storniere: (h: unknown) => void): (fn: () => void) => void;
export function navigate(doc: RundownDoc, index: number, cmd: RundownNav): { index: number; fire: RundownAction[] }; // überspringt entfallene
// A8 · ausgangsstand.ts
export interface DateiStand { pfad: string; mtimeMs: number; groesse: number; sha256: string }
export interface GedaechtnisInhalt { schemaVersion: 2; showPfad: string; showName: string; doc: RundownDoc; scharfId: string | null; gespeichertAm: string; datei?: DateiStand }
export function waehleAusgangsstand(e: { gedaechtnis: GedaechtnisInhalt | null; datei: { doc: RundownDoc; stand: DateiStand } | null; autosave: RundownDoc | null; autosaveWarV1: boolean; showName: string }): Ausgangsstand;
// A9 · main/gedaechtnis.ts
export const REGIE_ORDNER = 'regie';
export function gedaechtnisSchluessel(showPfad: string): string;
export function leseGedaechtnis(ordner: string, schluessel: string): { inhalt: GedaechtnisInhalt | null; fehler?: 'kein-json' | 'unlesbar' };
export function schreibeGedaechtnis(ordner: string, inhalt: GedaechtnisInhalt): boolean;
export function sichereDefektesGedaechtnis(ordner: string, schluessel: string): string | null;
export function leseZeiger(ordner: string): { showPfad: string; schluessel: string } | null;
export function schreibeZeiger(ordner: string, z: { showPfad: string; schluessel: string }): boolean;
export function loescheZeiger(ordner: string): void;
export function sichereAltenAutosave(userData: string): boolean;
export type ShowGelesen = { ok: true; show: Show; ablaufSchluessel: string[]; eigeneTimerListe: boolean } | { ok: false; grund: string };
export function leseShowSicher(pfad: string): ShowGelesen;
export function rundownDateiDerShow(showPfad: string, show: Show): string | null;
export function dateiStand(pfad: string): DateiStand | null;
```

Produces:
```ts
// types.ts — RundownState (Gerüst) + benannter Hinweis-Typ
export interface RundownState { /* … wie bisher … */ scharfId: string | null; rev: number; hinweise: RundownHinweis[]; abweisungen: number; ablaufSchluessel: string[]; eigeneTimerListe: boolean; showGemerkt: boolean; showMitIveo: boolean }
export interface RundownHinweis { id: number; text: string; art: 'kurz' | 'stehend' }
// IPC im Main (Preload/Renderer folgen in A11):
//   'rundown:setDoc' (doc: RundownDoc, basisRev: number) → RundownState
//   'rundown:fireAction' (rowId: string, actionId: string) → boolean
//   'rundown:hinweisWeg' (id: number) → RundownState
//   'rundown:alsEigeneZeile' (rowId: string) → RundownState
// shared/hinweise.ts
export const RELOAD_OHNE_SHOW: string; export const DATEI_AUSSERHALB: string; export const GEDAECHTNIS_DEFEKT: string;
export function berichtText(b: AbgleichBericht, mitIveo: boolean): string | null;
export function scharfVerruecktText(v: { von: string; nach: string | null }): string;
export function kontextWechselText(kontext: string, sideEvents: ShowIveoProgramRef[]): string;
export function showNichtLesbarText(grund: string): string;
export function abweisungText(mitIveo: boolean): string;
export function sprungEntfallenText(titel: string): string;
// shared/zeilen.ts (A11 erweitert die Datei)
export function kontextIstIveo(kontext: string | undefined): boolean;
export function ersteLebendeZeile(rows: RundownRow[]): string | null;
export function ablaufSchluesselAusZeilen(rows: RundownRow[]): string[];
export function istSprung(a: RundownAction): boolean;
export function sendeArgs(a: RundownAction, loese: (a: RundownAction) => SprungErgebnis): (string | number)[] | null;
export function sprungZielTitel(rows: RundownRow[], a: RundownAction): string;
```

**Vorab (am Repo und am Prototyp gemessen):**
- `index.ts` ist seit dem Ausgangsstand unverändert (A4–A9 fassen es nicht an); alle Vorher-Ausschnitte unten sind wortgleich daraus und je genau einmal vorhanden. Die Ausschnitte aus `types.ts` und `store.ts` sind der Stand nach A4 (wortgleich aus dem Nachher von A4).
- Die 14 Ersetzungen in `index.ts` (Schritte 10–23) in der angegebenen Reihenfolge ausführen; jede ist für sich eindeutig. Zwischen den Einzelschritten ist `index.ts` nicht typrein (alte Aufrufe von `setDoc`/`index`), deshalb kommt der Typecheck erst nach allen Ersetzungen (Schritt 26).
- G2: `hinweise.ts` und `zeilen.ts` haben nur `import type`. Die Sprung-Auflösung (`loeseSprungZiel`, A7) bekommt `sendeArgs` als Funktion übergeben, damit `zeilen.ts` nicht zur Laufzeit aus `sprung.ts` importieren muss.
- Gegengeprüft an einer Kopie der App mit dem Code von A4–A9 aus den Prototypen: Selbsttest grün, `typecheck:node`/`typecheck:web` grün, `electron-vite build` grün. Zusätzlich lief die fertige Verdrahtung in einem Rauchtest mit nachgebautem Electron (esbuild-Bundle von `index.ts`, Electron/Conductor/Steuerserver als Attrappen): 46 von 46 Prüfungen grün — Start per Deep-Link mit Übergangsregel, Bearbeiten mit `basisRev`, GO mit `TIMER GOTO 2`, drei RELOADs → ein Abgleich mit neuer Reihenfolge und gehaltener scharfer Zeile, Abweisung mit stehendem Hinweis, Sprung nach dem Abgleich mit neuer Nummer (`TIMER GOTO 3`), entfallenes Ziel → nichts gesendet, „Als eigene Zeile behalten“, Neustart über den Zeiger (Zeilen per `JSON.stringify` byte-gleich, scharfe Zeile gleich), kaputte Show beim Start (Gedächtnis, Hinweis, Log ohne Inhalt, RELOAD heilt), RELOAD ohne Änderung (kein neuer `rev`, kein Hinweis), Side-Event-Wechsel hin und zurück, eigene Rundown-Datei relativ zur Show, Speichern → `gedaechtnis.datei`, Datei außerhalb geändert → Hinweis, „Neu“ vergisst die Show, RELOAD ohne Show warnt, unbekanntes Verb → Warnung, STATE `cue=` aus `scharfId`. Das Gerüst des Rauchtests liegt im Scratchpad unter `teil2a-plan/proto-rundown/smoke/` (für A17 nutzbar).
- **Zwischenstand bis A11:** Nach diesem Commit erwartet der Main `rundown:setDoc(doc, basisRev)` und `rundown:fireAction(rowId, actionId)`, die Preload-Brücke schickt aber noch die alten Argumente (A11 stellt sie um). Bis A11 committet ist, weist der Main jede Bearbeitung ab und der Test-Knopf sendet nichts. Zwischen A10 und A11 die App nicht bauen und starten, um etwas zu prüfen; Typecheck und Selbsttest sind davon nicht betroffen.

---

#### Zyklus 1: Hinweistexte und Zeilen-Helfer (rein, getestet)

- [ ] **Schritt 1: Testimporte einfügen** in `apps/rundown/test/selftest.ts`. Namensraum-Importe, damit nichts mit den Importen aus A4–A8 kollidiert (A7 importiert z. B. schon `loeseSprungZiel`).

Datei `apps/rundown/test/selftest.ts`. Vorher (eindeutig, auch nach A4–A8):
```ts
let failed = 0;
function eq(actual: unknown, expected: unknown, msg: string): void {
```
Nachher:
```ts
import * as hinweisModul from '../src/shared/hinweise.ts';
import * as zeilenModul from '../src/shared/zeilen.ts';
import * as sprungModul from '../src/shared/sprung.ts';

let failed = 0;
function eq(actual: unknown, expected: unknown, msg: string): void {
```

- [ ] **Schritt 2: Fehlschlagende Tests einfügen** direkt vor der Schlusszeile. Die Blöcke stehen in `{ … }`, damit ihre Namen nicht mit denen anderer Aufgaben kollidieren. Die Texte sind wortgleich aus Spec 4.6 (G5), der Timer-Text wortgleich aus `apps/timer/src/main/index.ts` (`reloadCurrentShow`).

Datei `apps/rundown/test/selftest.ts`. Vorher (eindeutig):
```ts
console.log(failed === 0 ? '\nALLE TESTS OK' : `\n${failed} FEHLER`);
```
Nachher:
```ts
// ── A10: Hinweistexte (Spec 4.6, wortgleich) ─────────────────────────────────
{
  const { berichtText, scharfVerruecktText, kontextWechselText, showNichtLesbarText, abweisungText, sprungEntfallenText } =
    hinweisModul;
  const leer = { geaendert: 0, neu: 0, entfallen: 0, entfernt: 0, zurueck: 0, verschoben: 0, scharfVerrueckt: null };
  eq(
    berichtText({ geaendert: 2, neu: 1, entfallen: 1, entfernt: 0, zurueck: 1, verschoben: 2, scharfVerrueckt: null }, true),
    'iveo: 2 geändert · 1 neu · 1 entfallen · 1 wieder da · neu sortiert',
    'Bericht: Beispiel aus 4.6 wortgleich',
  );
  eq(berichtText({ ...leer, entfallen: 1, entfernt: 2 }, false), 'Show: 3 entfallen', 'Bericht ohne iveo: „Show:“, entfallen + entfernt zusammen');
  eq(berichtText({ ...leer, neu: 3 }, true), 'iveo: 3 neu', 'Bericht: nur Teile mit Zähler > 0');
  eq(berichtText({ ...leer, scharfVerrueckt: { von: 'A', nach: 'B' } }, true), null, 'Bericht nur mit scharfVerrueckt → kein Kurz-Hinweis');
  eq(
    scharfVerruecktText({ von: 'Panel', nach: 'Pause' }),
    'Deine scharfe Zeile „Panel“ ist entfallen. Scharf ist jetzt „Pause“.',
    'scharfVerrueckt mit Nachfolger',
  );
  eq(
    scharfVerruecktText({ von: 'Panel', nach: null }),
    'Deine scharfe Zeile „Panel“ ist entfallen. Es gibt keine Zeile mehr.',
    'scharfVerrueckt ohne Nachfolger',
  );
  eq(kontextWechselText('se:p1', [{ id: 'p1', title: 'Klima-Panel' }]), 'Side Event gewechselt: Klima-Panel', 'Wechsel zu se: mit Titel');
  eq(kontextWechselText('se:p9', []), 'Side Event gewechselt: p9', 'Wechsel zu se: ohne Titel → programId');
  eq(kontextWechselText('liste:2026-11-12|panel||0', []), 'iveo: Programmliste 2026-11-12', 'Wechsel zu liste: mit Tag');
  eq(kontextWechselText('liste:|||0', []), 'iveo: Programmliste alle Tage', 'Wechsel zu liste: ohne Tag');
  eq(kontextWechselText('show', []), 'Show-Ablauf (ohne iveo)', 'Wechsel zu show');
  eq(showNichtLesbarText('kein gültiges JSON'), 'Show nicht lesbar: kein gültiges JSON', 'Show nicht lesbar');
  eq(
    abweisungText(true),
    'Gleichzeitig kam ein iveo-Abgleich. Deine letzte Änderung wurde nicht übernommen, bitte wiederholen.',
    'Abweisung mit iveo',
  );
  eq(
    abweisungText(false),
    'Gleichzeitig kam ein Abgleich mit der Show. Deine letzte Änderung wurde nicht übernommen, bitte wiederholen.',
    'Abweisung ohne iveo',
  );
  eq(sprungEntfallenText('Panel'), 'Sprung nicht gesendet: Ziel „Panel“ ist entfallen.', 'Sprung-Ziel entfallen');
  eq(
    hinweisModul.RELOAD_OHNE_SHOW,
    'RELOAD empfangen, aber keine Show geladen (nicht per Show gestartet) — nichts neu eingelesen.',
    'RELOAD ohne Show: wortgleich zur Timer-Warnung',
  );
  eq(hinweisModul.DATEI_AUSSERHALB, 'Rundown-Datei wurde außerhalb geändert, Datei geladen.', 'Datei außerhalb geändert');
}

// ── A10: Zeilen-Helfer im Main (5.2, 6.2) ────────────────────────────────────
{
  const { ablaufSchluesselAusZeilen, ersteLebendeZeile, kontextIstIveo, sendeArgs, sprungZielTitel } = zeilenModul;
  const zeilen = [
    { id: 'u2', label: 'Panel', quelle: 'ablauf' as const, entfallen: true as const, actions: [] },
    { id: 'u1', label: 'Begrüßung', quelle: 'ablauf' as const, actions: [] },
    { id: 'r1', label: 'Einspieler', actions: [] },
  ];
  eq(ablaufSchluesselAusZeilen(zeilen), ['u1'], 'Schlüssel aus Zeilen: nur lebende Ablaufzeilen');
  eq(ersteLebendeZeile(zeilen), 'u1', 'erste nicht entfallene Zeile');
  eq(ersteLebendeZeile([zeilen[0]]), null, 'nur entfallene → null');
  eq(
    [kontextIstIveo('se:p1'), kontextIstIveo('liste:|||0'), kontextIstIveo('show'), kontextIstIveo(undefined)],
    [true, true, false, false],
    'Kontext mit iveo',
  );

  // 9.1 Fall 31 im Main: fireOne ruft sendeArgs erst beim Senden, gegen den dann aktuellen Ablauf.
  const sprung = { id: 'a9', role: 'timer', verb: 'goto', args: [2], enabled: true, zielId: 'u3' };
  const loese = (schluessel: string[], eigeneListe: boolean) => (a: typeof sprung) =>
    sprungModul.loeseSprungZiel(a, schluessel, eigeneListe);
  eq(sendeArgs(sprung, loese(['u1', 'u2', 'u3'], false)), [3], 'Sprung beim GO: Stelle der zielId');
  eq(sendeArgs(sprung, loese(['u1', 'neu', 'u2', 'u3'], false)), [4], 'Abgleich vor dem Senden → neue Nummer');
  eq(sendeArgs(sprung, loese(['u1'], false)), null, 'Ziel entfallen → nichts senden');
  eq(sendeArgs(sprung, loese([], false)), null, 'Show ohne Ablauf → nichts senden');
  eq(sendeArgs(sprung, loese(['u1', 'u2', 'u3'], true)), [2], 'eigene Timer-Liste → Argumente unverändert');
  const ohneZiel = { id: 'a7', role: 'timer', verb: 'goto', args: [], enabled: true };
  eq(sendeArgs(ohneZiel, loese(['u1'], false)), [], 'ohne zielId und ohne Nummer → unverändert (kein NaN)');
  const start = { id: 'a8', role: 'timer', verb: 'start', args: [], enabled: true };
  eq(
    sendeArgs(start, () => {
      throw new Error('darf nicht auflösen');
    }),
    [],
    'andere Aktionen: Argumente unverändert, keine Auflösung',
  );
  eq(sprungZielTitel(zeilen, { ...sprung, zielId: 'u2' }), 'Panel', 'Titel des Sprung-Ziels aus der Zeile');
  eq(sprungZielTitel(zeilen, sprung), 'Punkt 2', 'Ziel ohne Zeile → „Punkt <args[0]>“');
}

console.log(failed === 0 ? '\nALLE TESTS OK' : `\n${failed} FEHLER`);
```

- [ ] **Schritt 3: Test laufen lassen (rot).**

```bash
npm run selftest -w @jm/rundown
```
Erwartet: Abbruch beim Laden von `test/selftest.ts`, keine `ok`-Zeile, Exit-Code 1:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…\apps\rundown\src\shared\hinweise.ts' imported from …\apps\rundown\test\selftest.ts
```

- [ ] **Schritt 4: `hinweise.ts` anlegen.**

Neue Datei `apps/rundown/src/shared/hinweise.ts`, ganzer Inhalt:

```ts
// Texte der Hinweise an den Bediener (Spec 4.6), wortgleich zur Spec. Rein und
// ohne Laufzeit-Importe (G2), damit test/selftest.ts sie ohne Electron prüft.
// Der Main hängt sie an RundownState.hinweise; der Renderer zeigt sie nur an.
import type { ShowIveoProgramRef } from '@jm/show';
import type { AbgleichBericht } from './abgleich';

/** RELOAD ohne gemerkte Show (5.1): wortgleich zur Log-Warnung des Timers. */
export const RELOAD_OHNE_SHOW =
  'RELOAD empfangen, aber keine Show geladen (nicht per Show gestartet) — nichts neu eingelesen.';

/** Eigene Rundown-Datei wurde außerhalb geändert (4.8). */
export const DATEI_AUSSERHALB = 'Rundown-Datei wurde außerhalb geändert, Datei geladen.';

/**
 * Defektes Gedächtnis (Review-Focus 2). Steht NICHT in Spec 4.6 — der Text ist
 * eine Ergänzung dieser Umsetzung (im Plan unter „offene Fragen“ vermerkt).
 */
export const GEDAECHTNIS_DEFEKT =
  'Gespeicherter Stand dieser Show war beschädigt und wurde beiseitegelegt.';

/**
 * Kurzer Hinweis nach einem Abgleich: „iveo: 2 geändert · 1 neu · 1 entfallen ·
 * 1 wieder da · neu sortiert“. Nur Teile mit Zähler > 0; `entfallen` und
 * `entfernt` zählen zusammen als „entfallen“. null, wenn kein Teil zu nennen ist.
 */
export function berichtText(b: AbgleichBericht, mitIveo: boolean): string | null {
  const teile: string[] = [];
  if (b.geaendert > 0) teile.push(`${b.geaendert} geändert`);
  if (b.neu > 0) teile.push(`${b.neu} neu`);
  const weg = b.entfallen + b.entfernt;
  if (weg > 0) teile.push(`${weg} entfallen`);
  if (b.zurueck > 0) teile.push(`${b.zurueck} wieder da`);
  if (b.verschoben > 0) teile.push('neu sortiert');
  if (teile.length === 0) return null;
  return `${mitIveo ? 'iveo' : 'Show'}: ${teile.join(' · ')}`;
}

/** Stehender Hinweis, wenn die scharfe Zeile entfallen ist (R7 c). */
export function scharfVerruecktText(v: { von: string; nach: string | null }): string {
  const anfang = `Deine scharfe Zeile „${v.von}“ ist entfallen.`;
  return v.nach === null ? `${anfang} Es gibt keine Zeile mehr.` : `${anfang} Scharf ist jetzt „${v.nach}“.`;
}

/** Kurzer Hinweis beim Kontextwechsel (4.4). */
export function kontextWechselText(kontext: string, sideEvents: ShowIveoProgramRef[]): string {
  if (kontext.startsWith('se:')) {
    const programId = kontext.slice('se:'.length);
    const titel = sideEvents.find((s) => s.id === programId)?.title;
    return `Side Event gewechselt: ${titel || programId}`;
  }
  if (kontext.startsWith('liste:')) {
    const tag = kontext.slice('liste:'.length).split('|')[0];
    return `iveo: Programmliste ${tag || 'alle Tage'}`;
  }
  return 'Show-Ablauf (ohne iveo)';
}

export function showNichtLesbarText(grund: string): string {
  return `Show nicht lesbar: ${grund}`;
}

/** Stehender Hinweis bei einer abgewiesenen Änderung (5.5). */
export function abweisungText(mitIveo: boolean): string {
  const abgleich = mitIveo ? 'ein iveo-Abgleich' : 'ein Abgleich mit der Show';
  return `Gleichzeitig kam ${abgleich}. Deine letzte Änderung wurde nicht übernommen, bitte wiederholen.`;
}

/** Kurzer Hinweis, wenn ein Sprung beim GO nicht gesendet wird (6.2). */
export function sprungEntfallenText(titel: string): string {
  return `Sprung nicht gesendet: Ziel „${titel}“ ist entfallen.`;
}
```

- [ ] **Schritt 5: `zeilen.ts` anlegen.** Ein gebundener `timer goto` bekommt die aufgelöste Nummer; nicht gebundene Aktionen gehen unverändert raus (so wird aus einem fehlenden Argument nie `TIMER GOTO NaN`, vgl. A7 Abweichung 4).

Neue Datei `apps/rundown/src/shared/zeilen.ts`, ganzer Inhalt:

```ts
// Kleine reine Helfer rund um Zeilen und Sprung-Aktionen (Spec 4.4, 5.2, 6.2),
// die Main und Renderer gleich brauchen. Ohne Laufzeit-Importe (G2): die
// Auflösung des Sprungs (`loeseSprungZiel` aus sprung.ts) wird übergeben.
import type { SprungErgebnis } from './sprung';
import type { RundownAction, RundownRow } from './types';

/** Kontext einer iveo-Show (4.4): Side Event oder Programmliste. */
export function kontextIstIveo(kontext: string | undefined): boolean {
  return !!kontext && (kontext.startsWith('se:') || kontext.startsWith('liste:'));
}

/** Kennung der ersten nicht entfallenen Zeile, sonst null. */
export function ersteLebendeZeile(rows: RundownRow[]): string | null {
  return rows.find((r) => r.entfallen !== true)?.id ?? null;
}

/**
 * Schlüssel der lebenden Ablaufzeilen in Reihenfolge. Nach einem Abgleich ist
 * das genau die Schlüsselliste des Ablaufs (R1, R3). Der Main nutzt sie nur,
 * wenn die gemerkte Show beim Start nicht lesbar ist (5.2).
 */
export function ablaufSchluesselAusZeilen(rows: RundownRow[]): string[] {
  return rows.filter((r) => r.quelle === 'ablauf' && r.entfallen !== true).map((r) => r.id);
}

/** `timer goto` — die einzige Aktion mit Sprung-Ziel (6.2). */
export function istSprung(a: RundownAction): boolean {
  return a.role === 'timer' && a.verb === 'goto';
}

/**
 * Argumente, mit denen eine Aktion JETZT gesendet würde (6.2). Nur ein
 * gebundener `timer goto` bekommt die aufgelöste Nummer in `args[0]`; nicht
 * gebundene Aktionen gehen unverändert raus wie bisher. null = Ziel entfallen,
 * nichts senden. `loese` ist `(a) => loeseSprungZiel(a, ablaufSchluessel, eigeneTimerListe)`.
 */
export function sendeArgs(
  a: RundownAction,
  loese: (a: RundownAction) => SprungErgebnis,
): (string | number)[] | null {
  if (!istSprung(a)) return a.args;
  const z = loese(a);
  if ('entfallen' in z) return null;
  return z.gebunden ? [z.n, ...a.args.slice(1)] : a.args;
}

/** Titel des Sprung-Ziels für Hinweis und Log; ohne Zeile „Punkt <args[0]>“. */
export function sprungZielTitel(rows: RundownRow[], a: RundownAction): string {
  return rows.find((r) => r.id === a.zielId)?.label ?? `Punkt ${String(a.args[0] ?? '?')}`;
}
```

- [ ] **Schritt 6: Test laufen lassen (grün).**

```bash
npm run selftest -w @jm/rundown
```
Erwartet: zweimal `ALLE TESTS OK` (Selbsttest, dann Gedächtnis-Test aus A9), Exit-Code 0. Neu sind 30 Zeilen `ok`, darunter:
```
ok   Bericht: Beispiel aus 4.6 wortgleich
ok   Bericht ohne iveo: „Show:“, entfallen + entfernt zusammen
ok   scharfVerrueckt ohne Nachfolger
ok   Wechsel zu liste: ohne Tag
ok   Abweisung ohne iveo
ok   RELOAD ohne Show: wortgleich zur Timer-Warnung
ok   Abgleich vor dem Senden → neue Nummer
ok   Show ohne Ablauf → nichts senden
ok   ohne zielId und ohne Nummer → unverändert (kein NaN)
ok   Ziel ohne Zeile → „Punkt <args[0]>“
```

#### Zyklus 2: Verdrahtung (geprüft über Typecheck, Build und — in A17 — den Durchgang)

- [ ] **Schritt 7: `RundownState` — Kommentar zu `index` und neues Feld `scharfId`.**

Datei `apps/rundown/src/shared/types.ts` (Zeilen 109–110). Stand nach A4.

Vorher:
```ts
  /** Index der scharfen Zeile. */
  index: number;
```
Nachher:
```ts
  /** Index der scharfen Zeile — aus `scharfId` errechnet (5.3), für Anzeige und STATE `cue=`. */
  index: number;
  /** Kennung der scharfen Zeile (5.3); null bei leerem Dokument. */
  scharfId: string | null;
```

- [ ] **Schritt 8: `RundownState` — neue Felder und `RundownHinweis`.**

Datei `apps/rundown/src/shared/types.ts` (Zeilen 127–130). Stand nach A4.

Vorher:
```ts
   * die offene Show live auf das gewählte Side Event (Ablauf=Agenda + Speaker).
   */
  iveoSideEvents: ShowIveoProgramRef[];
}
```
Nachher:
```ts
   * die offene Show live auf das gewählte Side Event (Ablauf=Agenda + Speaker).
   */
  iveoSideEvents: ShowIveoProgramRef[];
  /** Änderungszähler des Dokuments (5.5); der Renderer schickt ihn als `basisRev` zurück. */
  rev: number;
  /** Hinweise an den Bediener (4.6); kurze entfernt der Main nach 6 s selbst. */
  hinweise: RundownHinweis[];
  /** Abgewiesene Änderungen (5.5); geht in die React-Schlüssel der Editor-Felder ein. */
  abweisungen: number;
  /** Schlüssel des normalisierten Show-Ablaufs in Reihenfolge (6.2); leer ohne Show. */
  ablaufSchluessel: string[];
  /** Die gemerkte Show hat eine eigene Timer-Liste (6.2: Sprünge über die Nummer). */
  eigeneTimerListe: boolean;
  /** Eine Show ist gemerkt (5.2) — nur dann sind Ablaufzeilen gesperrt (4.5). */
  showGemerkt: boolean;
  /**
   * Texte mit „iveo“ statt „Show“ (4.5, 4.6): die gemerkte Show hat eine
   * iveo-Bindung. Ohne gemerkte Show entscheidet der Kontext des Dokuments.
   */
  showMitIveo: boolean;
}

/** Ein Hinweis an den Bediener (4.6). Kurze verschwinden nach 6 s, stehende per `hinweisWeg`. */
export interface RundownHinweis {
  id: number;
  text: string;
  art: 'kurz' | 'stehend';
}
```

- [ ] **Schritt 9: Steuerserver-Kommentar um RELOAD ergänzen.** Gefiltert wird dort nur der Namensraum (`cmd.ns === 'rundown'`), `RUNDOWN RELOAD` kommt also schon bei `handleSuiteCommand` an; der Katalog in `packages/suite-control-protocol` bleibt unberührt (G1, Spec 5.1).

Datei `apps/rundown/src/main/control-server.ts` (Zeilen 5–6).

Vorher:
```ts
//   Client → Rundown:  RUNDOWN GO | RUNDOWN NEXT | RUNDOWN PREV |
//                      RUNDOWN GOTO <n> | STATE?
```
Nachher:
```ts
//   Client → Rundown:  RUNDOWN GO | RUNDOWN NEXT | RUNDOWN PREV |
//                      RUNDOWN GOTO <n> | STATE?
//                      RUNDOWN RELOAD — intern vom Launcher nach einer
//                      iveo-Änderung (Teil 2a, Spec 5.1), wie TIMER RELOAD
//                      nicht im Companion-Katalog
```

- [ ] **Schritt 10: Importe in `index.ts`: `parseShow` und `docFromAblauf` fallen weg, die neuen Module kommen dazu.**

Datei `apps/rundown/src/main/index.ts` (Zeilen 4–12). Zeilen: Stand vor A10.

Vorher:
```ts
import { initAppRuntime, getLog } from '@jm/app-runtime';
import { parseShow, parseShowDeepLink, type ShowIveoProgramRef, type ShowIveoSpeaker } from '@jm/show';
import { buildActionLine, navigate } from '@shared/conductor';
import type { SuiteCommand, SuiteState } from '@jm/suite-control-protocol';
import type { FireReport, RundownAction, RundownDoc, RundownNav, RundownRow, RundownState } from '@shared/types';
import { Conductor } from './conductor';
import { getOverrides, setOverride } from './config';
import { startControlServer, stopControlServer, pushControlState } from './control-server';
import { defaultDoc, docFromAblauf, loadAutosave, readDoc, saveAutosave, writeDoc } from './store';
```
Nachher:
```ts
import { initAppRuntime, getLog } from '@jm/app-runtime';
import { parseShowDeepLink, type Show, type ShowIveoProgramRef, type ShowIveoSpeaker } from '@jm/show';
import { berichtIstLeer, wendeShowAn } from '@shared/abgleich';
import { waehleAusgangsstand, type DateiStand, type GedaechtnisInhalt } from '@shared/ausgangsstand';
import { buildActionLine, navigate, newId } from '@shared/conductor';
import {
  abweisungText,
  berichtText,
  DATEI_AUSSERHALB,
  GEDAECHTNIS_DEFEKT,
  kontextWechselText,
  RELOAD_OHNE_SHOW,
  scharfVerruecktText,
  showNichtLesbarText,
  sprungEntfallenText,
} from '@shared/hinweise';
import {
  alsEigeneZeile,
  bereinigeQuellen,
  erzeugeBuendler,
  indexVon,
  nimmAenderungAn,
  scharfNachBearbeitung,
} from '@shared/scharf';
import { loeseSprungZiel } from '@shared/sprung';
import {
  ablaufSchluesselAusZeilen,
  ersteLebendeZeile,
  kontextIstIveo,
  sendeArgs,
  sprungZielTitel,
} from '@shared/zeilen';
import type { SuiteCommand, SuiteState } from '@jm/suite-control-protocol';
import type {
  FireReport,
  RundownAction,
  RundownDoc,
  RundownHinweis,
  RundownNav,
  RundownRow,
  RundownState,
} from '@shared/types';
import { Conductor } from './conductor';
import { getOverrides, setOverride } from './config';
import { startControlServer, stopControlServer, pushControlState } from './control-server';
import {
  dateiStand,
  gedaechtnisSchluessel,
  leseGedaechtnis,
  leseShowSicher,
  leseZeiger,
  loescheZeiger,
  REGIE_ORDNER,
  rundownDateiDerShow,
  schreibeGedaechtnis,
  schreibeZeiger,
  sichereAltenAutosave,
  sichereDefektesGedaechtnis,
  type ShowGelesen,
} from './gedaechtnis';
import { defaultDoc, loadAutosave, migrate, readDoc, saveAutosave, writeDoc } from './store';
```

- [ ] **Schritt 11: Zustand: `scharfId` statt `index`, dazu gemerkte Show, Gedächtnis-Daten, `rev`/`abgleichRev`/`abweisungen` und die Hinweisliste.**

Datei `apps/rundown/src/main/index.ts` (Zeilen 21–29). Zeilen: Stand vor A10.

Vorher:
```ts
let doc: RundownDoc = defaultDoc();
let index = 0;
let filePath: string | null = null;
let dirty = false;
let lastFired: FireReport | null = null;
/** iveo-Speaker der zuletzt geöffneten Show (für Titler-Cues im Row-Editor). */
let iveoSpeakers: ShowIveoSpeaker[] = [];
/** iveo-Side-Events der zuletzt geöffneten Show (für LAUNCHER-SIDEEVENT-Cues). */
let iveoSideEvents: ShowIveoProgramRef[] = [];
```
Nachher:
```ts
// Das Dokument steht im Main immer in der Form von `migrate` (feste Feldreihenfolge):
// so ist der Stand nach einem Neustart aus dem Gedächtnis gleich dem davor.
let doc: RundownDoc = migrate(defaultDoc());
/** Scharfe Zeile über ihre Kennung (5.3); `index` wird bei Bedarf daraus errechnet. */
let scharfId: string | null = null;
let filePath: string | null = null;
let dirty = false;
let lastFired: FireReport | null = null;
/** iveo-Speaker der zuletzt geöffneten Show (für Titler-Cues im Row-Editor). */
let iveoSpeakers: ShowIveoSpeaker[] = [];
/** iveo-Side-Events der zuletzt geöffneten Show (für LAUNCHER-SIDEEVENT-Cues). */
let iveoSideEvents: ShowIveoProgramRef[] = [];

// ── Gemerkte Show, Gedächtnis und Abgleich (Teil 2a, Spec 4.6–4.8, 5.1–5.5) ──
/** Absoluter Pfad der gemerkten Show (5.2) oder null. */
let showPfad: string | null = null;
/** Name der gemerkten Show (steht im Gedächtnis). */
let showName = '';
/** Die gemerkte Show hat eine iveo-Bindung. */
let showHatIveo = false;
/** Eigene `.jmrundown` der gemerkten Show (4.8), aufgelöst, oder null. */
let showRundownDatei: string | null = null;
/** Stand der eigenen Rundown-Datei, wie das Gedächtnis ihn zuletzt sah (4.8). */
let gedaechtnisDatei: DateiStand | null = null;
/** Schlüssel des normalisierten show.ablauf in Reihenfolge (6.2). */
let ablaufSchluessel: string[] = [];
/** Die gemerkte Show hat eine eigene Timer-Liste (6.2). */
let eigeneTimerListe = false;
/** Was in der Autosave-Datei steht (Übergangsregel 5.2); null = beim Start gab es keinen. */
let autosaveDoc: RundownDoc | null = null;
/** Steigt bei jeder Änderung am Dokument (5.5). */
let rev = 0;
/** `rev`, bei dem der letzte Abgleich lief (5.5). */
let abgleichRev = 0;
/** Abgewiesene Änderungen (5.5). */
let abweisungen = 0;
let hinweise: RundownHinweis[] = [];
let hinweisNr = 0;
```

- [ ] **Schritt 12: `buildState` mit den neuen Feldern; dazu `mitIveo`, `regieOrdner`, `hinweis`/`entferneHinweis` (kurze nach 6 s weg, höchstens 6) und `sichere` (mit gemerkter Show ins Gedächtnis, sonst in den Autosave, 4.7).**

Datei `apps/rundown/src/main/index.ts` (Zeilen 38–40). Zeilen: Stand vor A10.

Vorher:
```ts
function buildState(): RundownState {
  return { doc, index, filePath, dirty, links: conductor.snapshot(), overrides: getOverrides(), lastFired, iveoSpeakers, iveoSideEvents };
}
```
Nachher:
```ts
/** Texte mit „iveo“ (4.5, 4.6): Bindung der gemerkten Show, ohne Show der Kontext des Dokuments. */
function mitIveo(): boolean {
  return showPfad !== null ? showHatIveo : kontextIstIveo(doc.kontext);
}

function buildState(): RundownState {
  return {
    doc,
    index: indexVon(doc.rows, scharfId),
    scharfId,
    filePath,
    dirty,
    links: conductor.snapshot(),
    overrides: getOverrides(),
    lastFired,
    iveoSpeakers,
    iveoSideEvents,
    rev,
    hinweise,
    abweisungen,
    ablaufSchluessel,
    eigeneTimerListe,
    showGemerkt: showPfad !== null,
    showMitIveo: mitIveo(),
  };
}

function regieOrdner(): string {
  return join(app.getPath('userData'), REGIE_ORDNER);
}

/** Hinweis an den Renderer anhängen (4.6). Kurze entfernt der Main nach 6 s; höchstens 6 gleichzeitig. */
function hinweis(text: string, art: RundownHinweis['art']): void {
  const id = ++hinweisNr;
  hinweise = [...hinweise, { id, text, art }].slice(-6);
  if (art === 'kurz') setTimeout(() => entferneHinweis(id), 6000);
}

function entferneHinweis(id: number): void {
  const vorher = hinweise.length;
  hinweise = hinweise.filter((h) => h.id !== id);
  if (hinweise.length !== vorher) broadcast();
}

/** Stand sichern (4.7): mit gemerkter Show ins Gedächtnis, sonst wie bisher in den Autosave. */
function sichere(): void {
  if (showPfad) {
    const ok = schreibeGedaechtnis(regieOrdner(), {
      schemaVersion: 2,
      showPfad,
      showName,
      doc,
      scharfId,
      gespeichertAm: new Date().toISOString(),
      ...(gedaechtnisDatei ? { datei: gedaechtnisDatei } : {}),
    });
    if (!ok) getLog().warn('Gedächtnis der Show konnte nicht geschrieben werden.');
  } else {
    saveAutosave(doc);
    autosaveDoc = doc;
  }
}
```

- [ ] **Schritt 13: `buildSuiteState`: STATE `cue=` aus `indexVon(doc.rows, scharfId)` (5.3).**

Datei `apps/rundown/src/main/index.ts` (Zeilen 48–49). Zeilen: Stand vor A10.

Vorher:
```ts
function buildSuiteState(): SuiteState {
  const cur = doc.rows[index];
```
Nachher:
```ts
function buildSuiteState(): SuiteState {
  // STATE cue= aus der Kennung der scharfen Zeile errechnet (5.3).
  const index = indexVon(doc.rows, scharfId);
  const cur = doc.rows[index];
```

- [ ] **Schritt 14: `handleSuiteCommand`: `case 'reload'` über den 300-ms-Bündler, `default` mit Warnung (5.1).**

Datei `apps/rundown/src/main/index.ts` (Zeilen 73–79). Zeilen: Stand vor A10.

Vorher:
```ts
    case 'goto': {
      const n = Number(cmd.args[0]);
      if (Number.isFinite(n)) doNav({ t: 'goto', n: Math.trunc(n) });
      break;
    }
  }
}
```
Nachher:
```ts
    case 'goto': {
      const n = Number(cmd.args[0]);
      if (Number.isFinite(n)) doNav({ t: 'goto', n: Math.trunc(n) });
      break;
    }
    case 'reload':
      // Vom Launcher nach einer iveo-Änderung (7.1). Intern wie TIMER RELOAD, nicht
      // im Companion-Katalog. Mehrere binnen 300 ms → ein Abgleich (5.1).
      buendleReload(() => reloadShow());
      break;
    default:
      getLog().warn(`RUNDOWN ${cmd.verb.toUpperCase()}: unbekannter Befehl, ignoriert.`);
  }
}

/** Fasst RELOADs binnen 300 ms zu einem Abgleich zusammen (5.1). */
const buendleReload = erzeugeBuendler(
  300,
  (fn, ms) => setTimeout(fn, ms),
  (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
);
```

- [ ] **Schritt 15: `setDoc` wird aufgeteilt: `ersetzeDoc` (Öffnen, Neu — bricht ab wie bisher), `uebernimmBearbeitung` (Editor — bricht nichts ab, 4.5-Absicherung nur mit gemerkter Show, `scharfNachBearbeitung`, Ergebnis in `migrate`-Form) und `vergissShow`.**

Datei `apps/rundown/src/main/index.ts` (Zeilen 92–102). Zeilen: Stand vor A10.

Vorher:
```ts
function setDoc(next: RundownDoc, nextPath: string | null, markDirty: boolean): void {
  // Dokumentwechsel/-Edit bricht noch ausstehende verzögerte Aktionen ab — sie
  // gehörten zum alten Stand.
  cancelPendingFires();
  doc = next;
  if (index > doc.rows.length - 1) index = Math.max(0, doc.rows.length - 1);
  filePath = nextPath;
  dirty = markDirty;
  saveAutosave(doc);
  broadcast();
}
```
Nachher:
```ts
/**
 * Dokument ersetzen („Öffnen…“, „Neu“): bricht ausstehende verzögerte Aktionen ab
 * wie bisher (5.4) — sie gehörten zum alten Stand. Scharf ist die erste nicht
 * entfallene Zeile.
 */
function ersetzeDoc(next: RundownDoc, nextPath: string | null): void {
  cancelPendingFires();
  lastFired = null;
  doc = migrate(next);
  scharfId = ersteLebendeZeile(doc.rows);
  filePath = nextPath;
  dirty = false;
  rev++;
  sichere();
  broadcast();
}

/**
 * Bearbeitung aus dem Editor übernehmen. Bricht KEINE GO-Folge ab (5.4). Mit
 * gemerkter Show gilt die Absicherung aus 4.5; die scharfe Zeile hält
 * `scharfNachBearbeitung` über ihre Kennung (5.3). Kontext, Archiv und
 * Zuordnungs-Marke führt der Main, nicht der Renderer.
 */
function uebernimmBearbeitung(next: RundownDoc): void {
  let rows = next.rows;
  if (showPfad) {
    const bisherEntfallen = new Set(doc.rows.filter((r) => r.entfallen).map((r) => r.id));
    rows = bereinigeQuellen(rows, ablaufSchluessel, bisherEntfallen, () => newId('r'));
  }
  const neu = migrate({
    schemaVersion: 2,
    name: next.name,
    rows,
    ...(doc.kontext !== undefined ? { kontext: doc.kontext } : {}),
    ...(doc.archiv ? { archiv: doc.archiv } : {}),
    ...(doc.zuordnungOffen ? { zuordnungOffen: true as const } : {}),
  });
  scharfId = scharfNachBearbeitung(doc.rows, neu.rows, scharfId);
  doc = neu;
  rev++;
  dirty = true;
  sichere();
  broadcast();
}

/** „Öffnen…“ und „Neu“ (5.2): gemerkte Show und Zeiger vergessen; ein folgendes RELOAD warnt. */
function vergissShow(): void {
  showPfad = null;
  showName = '';
  showHatIveo = false;
  showRundownDatei = null;
  gedaechtnisDatei = null;
  ablaufSchluessel = [];
  eigeneTimerListe = false;
  loescheZeiger(regieOrdner());
}
```

- [ ] **Schritt 16: `fireOne` löst den Sprung erst beim Senden auf (6.2); bei entfallenem Ziel Quittung, Logzeile, kurzer Hinweis, nichts gesendet.**

Datei `apps/rundown/src/main/index.ts` (Zeilen 116–121). Zeilen: Stand vor A10.

Vorher:
```ts
function fireOne(row: RundownRow, a: RundownAction, sent: FireReport['sent']): void {
  const line = buildActionLine(a.role, a.verb, a.args);
  const delivered = conductor.fire(a.role, line);
  sent.push({ role: a.role, line, delivered });
  getLog().info(`GO „${row.label}": ${line}${delivered ? '' : ' (offline)'}`);
}
```
Nachher:
```ts
/** Argumente, mit denen eine Aktion JETZT gesendet würde (6.2); null = Sprung-Ziel entfallen. */
function argsZumSenden(a: RundownAction): (string | number)[] | null {
  return sendeArgs(a, (x) => loeseSprungZiel(x, ablaufSchluessel, eigeneTimerListe));
}

function fireOne(row: RundownRow, a: RundownAction, sent: FireReport['sent']): void {
  // 6.2: Das Sprung-Ziel wird erst beim Senden aufgelöst — bei verzögerten
  // Aktionen also nach delayMs, gegen den dann aktuellen Ablauf (5.4).
  const args = argsZumSenden(a);
  if (!args) {
    const titel = sprungZielTitel(doc.rows, a);
    sent.push({ role: 'timer', line: 'TIMER GOTO (Ziel entfallen)', delivered: false });
    getLog().warn(`GO „${row.label}": TIMER GOTO nicht gesendet, Ziel „${titel}" ist entfallen`);
    hinweis(sprungEntfallenText(titel), 'kurz');
    return;
  }
  const line = buildActionLine(a.role, a.verb, args);
  const delivered = conductor.fire(a.role, line);
  sent.push({ role: a.role, line, delivered });
  getLog().info(`GO „${row.label}": ${line}${delivered ? '' : ' (offline)'}`);
}
```

- [ ] **Schritt 17: `doNav` rechnet über `scharfId` und schreibt das Gedächtnis, wenn eine Show gemerkt ist.**

Datei `apps/rundown/src/main/index.ts` (Zeilen 150–155). Zeilen: Stand vor A10.

Vorher:
```ts
  cancelPendingFires();
  const res = navigate(doc, index, cmd);
  if (cmd.t === 'go') fireRow(doc.rows[index], res.fire);
  index = res.index;
  broadcast();
}
```
Nachher:
```ts
  cancelPendingFires();
  const index = indexVon(doc.rows, scharfId);
  const res = navigate(doc, index, cmd);
  if (cmd.t === 'go') fireRow(doc.rows[index], res.fire);
  scharfId = doc.rows[res.index]?.id ?? null;
  // Die scharfe Zeile gehört ins Gedächtnis (4.7); der Autosave kennt sie nicht.
  if (showPfad) sichere();
  broadcast();
}
```

- [ ] **Schritt 18: „Öffnen…“ vergisst die gemerkte Show (5.2); G6: keine JSON-Meldung ins Log.**

Datei `apps/rundown/src/main/index.ts` (Zeilen 163–170). Zeilen: Stand vor A10.

Vorher:
```ts
  try {
    const d = readDoc(r.filePaths[0]);
    index = 0;
    lastFired = null;
    setDoc(d, r.filePaths[0], false);
  } catch (err) {
    getLog().error(`Öffnen fehlgeschlagen: ${(err as Error).message}`);
  }
```
Nachher:
```ts
  try {
    const d = readDoc(r.filePaths[0]);
    vergissShow();
    ersetzeDoc(d, r.filePaths[0]);
  } catch (err) {
    // G6: Die JSON-Meldung zitiert Dateiinhalt → nur „kein gültiges JSON“ ins Log.
    const grund = err instanceof SyntaxError ? 'kein gültiges JSON' : (err as Error).message;
    getLog().error(`Öffnen fehlgeschlagen: ${grund}`);
  }
```

- [ ] **Schritt 19: „Speichern“ der eigenen Rundown-Datei der Show aktualisiert `gedaechtnis.datei` (4.8).**

Datei `apps/rundown/src/main/index.ts` (Zeilen 184–187). Zeilen: Stand vor A10.

Vorher:
```ts
    writeDoc(target, doc);
    filePath = target;
    dirty = false;
    broadcast();
```
Nachher:
```ts
    writeDoc(target, doc);
    filePath = target;
    dirty = false;
    // 4.8: „Speichern“ der eigenen Rundown-Datei der Show → ihr Stand kommt ins Gedächtnis.
    if (showPfad && showRundownDatei && path.resolve(target).toLowerCase() === showRundownDatei.toLowerCase()) {
      // Stand unter dem Pfad aus der Show bilden — so vergleicht 4.8 beim nächsten Öffnen gleich.
      gedaechtnisDatei = dateiStand(showRundownDatei);
      sichere();
    }
    broadcast();
```

- [ ] **Schritt 20: Test-Knopf per `rowId`/`actionId`, Auflösung wie beim GO (6.2).**

Datei `apps/rundown/src/main/index.ts` (Zeilen 199–204). Zeilen: Stand vor A10.

Vorher:
```ts
  ipcMain.handle('rundown:fireAction', (_e, role: string, verb: string, args: (string | number)[]) => {
    const line = buildActionLine(role, verb, args);
    const delivered = conductor.fire(role, line);
    getLog().info(`Test-Fire ${line}${delivered ? '' : ' (offline)'}`);
    return delivered;
  });
```
Nachher:
```ts
  ipcMain.handle('rundown:fireAction', (_e, rowId: string, actionId: string) => {
    // Test-Knopf (6.2): Der Main sucht die Aktion und löst auf wie beim GO.
    const a = doc.rows.find((r) => r.id === rowId)?.actions.find((x) => x.id === actionId);
    if (!a) return false;
    const args = argsZumSenden(a);
    if (!args) {
      getLog().warn('Test-Fire TIMER GOTO nicht gesendet: Ziel entfallen');
      return false;
    }
    const line = buildActionLine(a.role, a.verb, args);
    const delivered = conductor.fire(a.role, line);
    getLog().info(`Test-Fire ${line}${delivered ? '' : ' (offline)'}`);
    return delivered;
  });
```

- [ ] **Schritt 21: `rundown:setDoc` mit `basisRev` und Abweisung (5.5); neu `rundown:hinweisWeg` und `rundown:alsEigeneZeile` (A7 `alsEigeneZeile`); „Neu“ vergisst die Show.**

Datei `apps/rundown/src/main/index.ts` (Zeilen 238–247). Zeilen: Stand vor A10.

Vorher:
```ts
  ipcMain.handle('rundown:setDoc', (_e, next: RundownDoc) => {
    setDoc(next, filePath, true);
    return buildState();
  });
  ipcMain.handle('rundown:new', () => {
    index = 0;
    lastFired = null;
    setDoc(defaultDoc(), null, false);
    return buildState();
  });
```
Nachher:
```ts
  ipcMain.handle('rundown:setDoc', (_e, next: RundownDoc, basisRev: number) => {
    // 5.5: Abgewiesen wird nur, wenn seit dem Stand des Renderers ein Abgleich lief.
    if (typeof basisRev !== 'number' || !nimmAenderungAn(basisRev, abgleichRev)) {
      abweisungen++;
      hinweis(abweisungText(mitIveo()), 'stehend');
      getLog().warn(`Änderung abgewiesen: Stand ${String(basisRev)}, letzter Abgleich bei ${abgleichRev}.`);
      broadcast();
      return buildState();
    }
    uebernimmBearbeitung(next);
    return buildState();
  });
  ipcMain.handle('rundown:hinweisWeg', (_e, id: number) => {
    entferneHinweis(id);
    return buildState();
  });
  ipcMain.handle('rundown:alsEigeneZeile', (_e, rowId: string) => {
    // 4.3: Eine entfallene Zeile wird an derselben Stelle zur eigenen Zeile mit
    // neuer id; war sie scharf, bleibt sie es.
    const i = doc.rows.findIndex((r) => r.id === rowId);
    const alt = doc.rows[i];
    if (alt && alt.quelle === 'ablauf' && alt.entfallen) {
      const eigen = alsEigeneZeile(alt, newId('r'));
      const rows = doc.rows.slice();
      rows[i] = eigen;
      if (scharfId === rowId) scharfId = eigen.id;
      doc = migrate({ ...doc, rows });
      rev++;
      dirty = true;
      sichere();
      broadcast();
    }
    return buildState();
  });
  ipcMain.handle('rundown:new', () => {
    vergissShow();
    ersetzeDoc(defaultDoc(), null);
    return buildState();
  });
```

- [ ] **Schritt 22: Die Show-Integration wird ersetzt: `merkeShowDaten`, `zeigeAbgleichHinweise`, `leseGedaechtnisMitMeldung`, `leseRundownDatei`, `ladeAndereShow` (Ausgangsstand → `wendeShowAn`), `reloadShow`, `applyShowFromDeepLink` (liefert jetzt `boolean`: war es ein Show-Link?) und `starteOhneDeepLink` (Zeiger).**

Datei `apps/rundown/src/main/index.ts` (Zeilen 262–292). Zeilen: Stand vor A10.

Vorher:
```ts
/**
 * Show-Integration: Wird Rundown über einen Show-Deep-Link gestartet, lädt es den
 * Ablauf aus der Show. Zwei Quellen, in dieser Reihenfolge:
 *  1. Referenziert die Show ein eigenes `.jmrundown` (ShowToolRef.document von
 *     jm-rundown), gewinnt dieses — voller Ablauf inkl. GO-Aktionen.
 *  2. Sonst der ZENTRALE Show-Ablauf (#78, show.ablauf): die Programmpunkte
 *     werden zu Zeilen (ohne Aktionen). So muss der Ablauf nur einmal beim
 *     Erstellen der Show gepflegt werden, nicht separat in Rundown.
 */
function applyShowFromDeepLink(url: string): void {
  const showPath = parseShowDeepLink(url);
  if (!showPath) return;
  try {
    const show = parseShow(readFileSync(showPath, 'utf8'));
    // iveo-Speaker + Side Events der Show für die Row-Editor-Cues bereitstellen (#11).
    iveoSpeakers = show.iveo?.speakers ?? [];
    iveoSideEvents = show.iveo?.sideEvents ?? [];
    const ref = show.tools.find((t) => t.appId === 'jm-rundown');
    if (ref?.document) {
      index = 0;
      lastFired = null;
      setDoc(readDoc(ref.document), ref.document, false);
    } else if (show.ablauf && show.ablauf.length) {
      index = 0;
      lastFired = null;
      setDoc(docFromAblauf(show.name, show.ablauf), null, false);
    }
  } catch (err) {
    getLog().error(`Show-Deep-Link konnte nicht geladen werden: ${(err as Error).message}`);
  }
}
```
Nachher:
```ts
// ── Show-Integration (Teil 2a, Spec 5.2): Ladewege über Gedächtnis und Abgleich ──
// Die Show liefert den Ablauf (show.ablauf, aus iveo oder dem Show-Editor); der
// Rundown gleicht ihn mit seinem Stand ab (wendeShowAn), statt ihn zu ersetzen.
// Eine eigene `.jmrundown` der Show ist nur noch der Ausgangsstand (4.8).

/** Bei jedem Lesen der Show auffrischen (5.2): iveo-Listen und die Daten für 6.2. */
function merkeShowDaten(g: Extract<ShowGelesen, { ok: true }>): void {
  iveoSpeakers = g.show.iveo?.speakers ?? [];
  iveoSideEvents = g.show.iveo?.sideEvents ?? [];
  ablaufSchluessel = g.ablaufSchluessel;
  eigeneTimerListe = g.eigeneTimerListe;
  showHatIveo = !!g.show.iveo;
  showName = g.show.name;
}

/** Hinweise zu einem Abgleich (4.6): Kontextwechsel ODER Bericht, dazu ggf. die verrückte scharfe Zeile. */
function zeigeAbgleichHinweise(res: ReturnType<typeof wendeShowAn>, show: Show): void {
  if (res.kontextGewechselt) {
    hinweis(kontextWechselText(res.doc.kontext ?? '', show.iveo?.sideEvents ?? []), 'kurz');
  } else if (res.bericht && !berichtIstLeer(res.bericht)) {
    const text = berichtText(res.bericht, !!show.iveo);
    if (text) hinweis(text, 'kurz');
  }
  if (res.bericht?.scharfVerrueckt) hinweis(scharfVerruecktText(res.bericht.scharfVerrueckt), 'stehend');
}

/** Gedächtnis lesen; ein defektes wird beiseitegelegt und gemeldet (Review-Focus 2). */
function leseGedaechtnisMitMeldung(schluessel: string): GedaechtnisInhalt | null {
  const gelesen = leseGedaechtnis(regieOrdner(), schluessel);
  if (gelesen.fehler) {
    const kopie = sichereDefektesGedaechtnis(regieOrdner(), schluessel);
    getLog().warn(
      `Gedächtnis ${schluessel}.json nicht lesbar (${gelesen.fehler}), ${kopie ? 'als .defekt.json beiseitegelegt' : 'Sicherung gescheitert'}.`,
    );
    hinweis(GEDAECHTNIS_DEFEKT, 'stehend');
  }
  return gelesen.inhalt;
}

/** Eigene Rundown-Datei der Show lesen (4.8); null, wenn sie fehlt oder kaputt ist. */
function leseRundownDatei(pfad: string): { doc: RundownDoc; stand: DateiStand } | null {
  const stand = dateiStand(pfad);
  if (!stand) {
    getLog().warn(`Rundown-Datei der Show nicht gefunden: ${pfad}`);
    return null;
  }
  try {
    return { doc: readDoc(pfad), stand };
  } catch (err) {
    // G6: die JSON-Meldung zitiert Dateiinhalt → nur die Art des Fehlers.
    const grund = err instanceof SyntaxError ? 'kein gültiges JSON' : ((err as NodeJS.ErrnoException).code ?? 'Lesefehler');
    getLog().warn(`Rundown-Datei der Show nicht lesbar (${grund}): ${pfad}`);
    return null;
  }
}

/**
 * Andere Show laden (5.2, Zeile „andere Show“; auch Start über den Zeiger):
 * Show merken, Ausgangsstand wählen (Gedächtnis bzw. eigene Datei nach 4.8 →
 * alter Autosave nach der Übergangsregel → leer), dann wendeShowAn. Bricht
 * laufende GO-Folgen ab wie bisher (5.4).
 */
function ladeAndereShow(pfad: string, g: Extract<ShowGelesen, { ok: true }>): void {
  const schluessel = gedaechtnisSchluessel(pfad);
  const gedaechtnis = leseGedaechtnisMitMeldung(schluessel);
  const rdPfad = rundownDateiDerShow(pfad, g.show);
  const datei = rdPfad ? leseRundownDatei(rdPfad) : null;

  merkeShowDaten(g);
  showPfad = pfad;
  showRundownDatei = rdPfad;
  if (!schreibeZeiger(regieOrdner(), { showPfad: pfad, schluessel })) {
    getLog().warn('Zeiger auf die gemerkte Show konnte nicht geschrieben werden.');
  }

  if (g.ablaufSchluessel.length === 0 && !rdPfad && !gedaechtnis) {
    // 5.2: Show ohne Ablauf und ohne eigene Rundown-Datei → merken, das Dokument
    // bleibt unangetastet. Bekommt sie danach einen Ablauf, gleicht RELOAD ab.
    gedaechtnisDatei = null;
    rev++;
    abgleichRev = rev;
    sichere();
    broadcast();
    return;
  }

  const a = waehleAusgangsstand({
    gedaechtnis,
    datei,
    autosave: autosaveDoc,
    autosaveWarV1: autosaveDoc?.zuordnungOffen === true,
    showName: g.show.name,
  });
  let start: RundownDoc = { schemaVersion: 2, name: g.show.name, rows: [] };
  let startScharf: string | null = null;
  switch (a.quelle) {
    case 'gedaechtnis':
      start = a.doc;
      startScharf = a.scharfId;
      dirty = a.ungespeichert;
      filePath = rdPfad;
      gedaechtnisDatei = rdPfad ? (gedaechtnis?.datei ?? null) : null;
      break;
    case 'datei':
      start = a.doc;
      dirty = false;
      filePath = rdPfad;
      gedaechtnisDatei = datei?.stand ?? null;
      if (a.hinweisAusserhalb) hinweis(DATEI_AUSSERHALB, 'kurz');
      break;
    case 'autosave-v1': {
      start = a.doc;
      dirty = false;
      filePath = null;
      gedaechtnisDatei = null;
      // Übergangsregel 5.2: vorher einmal sichern. Danach gilt der Autosave als
      // übernommen (Ergänzung 0.7: einmalig) und wird ohne Altformat-Marke abgelegt.
      if (sichereAltenAutosave(app.getPath('userData'))) {
        if (autosaveDoc) {
          const uebernommen: RundownDoc = { ...autosaveDoc };
          delete uebernommen.zuordnungOffen;
          saveAutosave(uebernommen);
          autosaveDoc = uebernommen;
        }
        getLog().info('Alter Autosave übernommen, gesichert als rundown.autosave.v1.jmrundown.');
      } else {
        getLog().warn('Alter Autosave übernommen, die Sicherung rundown.autosave.v1.jmrundown ist gescheitert.');
      }
      break;
    }
    case 'leer':
      dirty = false;
      filePath = null;
      gedaechtnisDatei = null;
      break;
  }

  cancelPendingFires();
  lastFired = null;
  const res = wendeShowAn({ doc: start, scharfId: startScharf, show: g.show });
  doc = migrate(res.doc);
  scharfId = res.scharfId;
  rev++;
  abgleichRev = rev;
  // Hinweise nur bei einem schon abgeglichenen Vorstand; ein leeres oder nie
  // abgeglichenes Dokument „ändert“ sich nicht, es entsteht.
  if (start.kontext !== undefined) zeigeAbgleichHinweise(res, g.show);
  sichere();
  broadcast();
}

/**
 * RUNDOWN RELOAD (5.1) bzw. dieselbe Show erneut per Deep-Link: Show neu lesen und
 * abgleichen, Position nach R7 bzw. 4.4. Bricht keine GO-Folge ab (5.4). Ist die
 * Show nicht lesbar, bleibt der Stand stehen (Review-Focus 1).
 */
function reloadShow(): void {
  if (!showPfad) {
    getLog().warn(RELOAD_OHNE_SHOW);
    hinweis(RELOAD_OHNE_SHOW, 'kurz');
    broadcast();
    return;
  }
  const g = leseShowSicher(showPfad);
  if (!g.ok) {
    getLog().error(`RELOAD: ${showNichtLesbarText(g.grund)}`);
    hinweis(showNichtLesbarText(g.grund), 'kurz');
    broadcast();
    return;
  }
  merkeShowDaten(g);
  showRundownDatei = rundownDateiDerShow(showPfad, g.show);
  const res = wendeShowAn({ doc, scharfId, show: g.show });
  const neu = migrate(res.doc);
  if (res.scharfId !== scharfId || JSON.stringify(neu) !== JSON.stringify(doc)) {
    doc = neu;
    scharfId = res.scharfId;
    rev++;
    abgleichRev = rev;
    if (filePath) dirty = true;
    sichere();
  }
  zeigeAbgleichHinweise(res, g.show);
  broadcast();
}

/** Show-Deep-Link (5.2). Liefert true, wenn es ein Show-Link war. */
function applyShowFromDeepLink(url: string): boolean {
  const roh = parseShowDeepLink(url);
  if (!roh) return false;
  const pfad = path.resolve(roh);
  if (showPfad && gedaechtnisSchluessel(pfad) === gedaechtnisSchluessel(showPfad)) {
    // Dieselbe Show erneut: Abgleich wie RELOAD, Position bleibt (R7).
    reloadShow();
    return true;
  }
  const g = leseShowSicher(pfad);
  if (!g.ok) {
    getLog().error(`Show-Deep-Link konnte nicht geladen werden: ${g.grund}`);
    hinweis(showNichtLesbarText(g.grund), 'kurz');
    broadcast();
    return true;
  }
  ladeAndereShow(pfad, g);
  return true;
}

/**
 * Start ohne Show-Deep-Link (5.2: Launcher-Kachel, Neustart nach Absturz). Der
 * Zeiger führt zur gemerkten Show: lesbar → wie „andere Show“; nicht lesbar →
 * Gedächtnisstand laden, die Show bleibt gemerkt, das nächste RELOAD versucht es
 * erneut. Ohne Zeiger oder ohne Gedächtnis bleibt der Autosave wie bisher.
 */
function starteOhneDeepLink(): void {
  const z = leseZeiger(regieOrdner());
  if (!z) return;
  const g = leseShowSicher(z.showPfad);
  if (g.ok) {
    ladeAndereShow(z.showPfad, g);
    return;
  }
  getLog().error(`Gemerkte Show: ${showNichtLesbarText(g.grund)}`);
  hinweis(showNichtLesbarText(g.grund), 'kurz');
  const gedaechtnis = leseGedaechtnisMitMeldung(gedaechtnisSchluessel(z.showPfad));
  if (gedaechtnis) {
    showPfad = z.showPfad;
    showName = gedaechtnis.showName;
    doc = gedaechtnis.doc;
    const gemerkt = gedaechtnis.scharfId;
    scharfId = gemerkt !== null && doc.rows.some((r) => r.id === gemerkt) ? gemerkt : ersteLebendeZeile(doc.rows);
    gedaechtnisDatei = gedaechtnis.datei ?? null;
    showRundownDatei = gedaechtnisDatei?.pfad ?? null;
    filePath = showRundownDatei;
    // Ohne lesbare Show: Schlüssel aus den lebenden Ablaufzeilen (Stand des letzten
    // Abgleichs), iveo aus dem Kontext; die eigene Timer-Liste ist unbekannt.
    ablaufSchluessel = ablaufSchluesselAusZeilen(doc.rows);
    eigeneTimerListe = false;
    showHatIveo = kontextIstIveo(doc.kontext);
    rev++;
    abgleichRev = rev;
  }
  broadcast();
}
```

- [ ] **Schritt 23: Start: Autosave merken, erste lebende Zeile scharf, Deep-Link vor Zeiger (5.2).**

Datei `apps/rundown/src/main/index.ts` (Zeilen 362–367). Zeilen: Stand vor A10.

Vorher:
```ts
    // Letzten Stand wiederherstellen (sofern kein Deep-Link kommt).
    const saved = loadAutosave();
    if (saved) doc = saved;
    registerIpc();
    createMainWindow();
    if (runtime.initialDeepLink) applyShowFromDeepLink(runtime.initialDeepLink);
```
Nachher:
```ts
    // Letzten Stand wiederherstellen (sofern weder Deep-Link noch Zeiger greift).
    const saved = loadAutosave();
    autosaveDoc = saved;
    if (saved) doc = saved;
    scharfId = ersteLebendeZeile(doc.rows);
    registerIpc();
    createMainWindow();
    // Ein Show-Deep-Link hat Vorrang; sonst führt der Zeiger zur gemerkten Show (5.2).
    const perShowLink = runtime.initialDeepLink ? applyShowFromDeepLink(runtime.initialDeepLink) : false;
    if (!perShowLink) starteOhneDeepLink();
```

- [ ] **Schritt 24: `docFromAblauf` entfernen** — die letzte Nutzung ist mit Schritt 10/22 aus `index.ts` verschwunden (das Gerüst sah das Entfernen „mit A9“ vor; die Nutzung liegt in `index.ts`, also hier).

Datei `apps/rundown/src/main/store.ts` (Zeilen 50–60). Stand nach A4 (wortgleich aus dessen Nachher). Die Leerzeile direkt hinter der Funktion mit löschen, sodass zwischen `migrate` und `readDoc` genau eine Leerzeile bleibt.

Vorher:
```ts
/**
 * Zentralen Show-Ablauf (#78) in ein RundownDoc überführen — jeder Programmpunkt
 * wird zu einer Zeile OHNE Aktionen (die GO-Aktionen bleiben Rundown-spezifisch
 * und ergänzt der Nutzer in Rundown). Über `migrate` normalisiert (frische IDs,
 * optionale Felder). So muss der Ablauf nur einmal zentral in der Show gepflegt
 * werden, statt in jedem Tool separat.
 */
export function docFromAblauf(name: string, items: ShowAblaufItem[]): RundownDoc {
  // Als Version 2 einlesen: Zeilen aus dem Show-Ablauf brauchen keine Titel-Zuordnung (4.9).
  return migrate({ schemaVersion: 2, name: name || 'Ablauf', rows: items.map((it) => ({ ...it, actions: [] })) });
}
```
Nachher: *(leer — der Vorher-Block entfällt ersatzlos)*

- [ ] **Schritt 25: Den dann ungenutzten Typ-Import entfernen.**

Datei `apps/rundown/src/main/store.ts` (Zeilen 8–10). Stand nach A4.

Vorher:
```ts
import { migrate as migrateFormat } from '@shared/doc-format';
import type { ShowAblaufItem } from '@jm/show';
import type { RundownAction, RundownDoc } from '@shared/types';
```
Nachher:
```ts
import { migrate as migrateFormat } from '@shared/doc-format';
import type { RundownAction, RundownDoc } from '@shared/types';
```

- [ ] **Schritt 26: Typecheck.**

```bash
npm run typecheck -w @jm/rundown
```
Erwartet: `typecheck:node` und `typecheck:web` ohne Ausgabe von `tsc`, Exit-Code 0. (Der Renderer liest `RundownState` nur, die neuen Felder brechen ihn nicht.) Prüfen, dass `grep -n "docFromAblauf\|parseShow(" apps/rundown/src/main/index.ts apps/rundown/src/main/store.ts` nichts mehr findet.

- [ ] **Schritt 27: Build.**

```bash
npm run build -w @jm/rundown
```
Erwartet: drei Zeilen `✓ built in …` (main, preload, renderer), keine Zeile mit `error`, Exit-Code 0.

- [ ] **Schritt 28: Selbsttest erneut (grün).**

```bash
npm run selftest -w @jm/rundown
```
Erwartet: wie Schritt 6 (zweimal `ALLE TESTS OK`, Exit-Code 0).

- [ ] **Schritt 29: Commit.**

```bash
git add apps/rundown/src/shared/hinweise.ts apps/rundown/src/shared/zeilen.ts apps/rundown/src/shared/types.ts apps/rundown/src/main/index.ts apps/rundown/src/main/store.ts apps/rundown/src/main/control-server.ts apps/rundown/test/selftest.ts
git status --short
git commit -m "feat(rundown): RELOAD gleicht mit der Show ab, statt sie zu ersetzen" -m "Der Main merkt sich die Show (Zeiger regie/zuletzt.json), lädt den Ausgangsstand aus Gedächtnis, eigener Datei oder altem Autosave und wendet die Show mit wendeShowAn an. RUNDOWN RELOAD (gebündelt auf 300 ms) bricht keine GO-Folge ab, die scharfe Zeile läuft über ihre Kennung, Änderungen auf einem Stand vor einem Abgleich werden abgewiesen, Sprünge werden erst beim Senden aufgelöst. Hinweise wortgleich aus Spec 4.6 (#235)." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
`git status --short` vor dem Commit lesen: gestagt sind genau `apps/rundown/src/shared/hinweise.ts`, `apps/rundown/src/shared/zeilen.ts` (je `A`) sowie `apps/rundown/src/shared/types.ts`, `apps/rundown/src/main/index.ts`, `apps/rundown/src/main/store.ts`, `apps/rundown/src/main/control-server.ts`, `apps/rundown/test/selftest.ts` (je `M`). Nicht pushen.

**Neue Logzeilen (für A17 und die Abnahme):** `RELOAD empfangen, aber keine Show geladen (nicht per Show gestartet) — nichts neu eingelesen.` (Warnung), `RUNDOWN <VERB>: unbekannter Befehl, ignoriert.` (Warnung), `RELOAD: Show nicht lesbar: <Grund>` (Fehler), `Gemerkte Show: Show nicht lesbar: <Grund>` (Fehler), `Show-Deep-Link konnte nicht geladen werden: <Grund>` (Fehler), `GO „<Zeile>": TIMER GOTO nicht gesendet, Ziel „<Titel>" ist entfallen` (Warnung), `Test-Fire TIMER GOTO nicht gesendet: Ziel entfallen` (Warnung), `Änderung abgewiesen: Stand <n>, letzter Abgleich bei <n>.` (Warnung), `Gedächtnis <schlüssel>.json nicht lesbar (<kein-json|unlesbar>), als .defekt.json beiseitegelegt.` (Warnung), `Alter Autosave übernommen, gesichert als rundown.autosave.v1.jmrundown.` (Info).

**Abweichungen vom Gerüst:**
1. **Zwei neue reine Module** `src/shared/hinweise.ts` und `src/shared/zeilen.ts` (Gerüst nennt für A10 nur `index.ts`, `types.ts`, `control-server.ts`). So sind die Texte aus 4.6 wortgleich getestet (G5, G8) und die Sende-Auflösung (`sendeArgs`) ist dieselbe Funktion in Main (`fireOne`, Test-Knopf) und Renderer (Chip, Vorschau, A11).
2. **`store.ts`:** `docFromAblauf` und der Import `ShowAblaufItem` entfallen hier (letzte Nutzung war in `index.ts`).
3. **`control-server.ts`:** filtert RELOAD nicht (nur `cmd.ns`); geändert wird nur der Kopfkommentar.
4. **`RundownHinweis`** als benannte Schnittstelle (strukturell gleich dem Gerüst-Literal). **`showMitIveo` ohne gemerkte Show** kommt aus dem Kontext des Dokuments (`se:`/`liste:`), damit entfallene Zeilen auch dann „in iveo entfallen“ zeigen (4.5, letzte Tabellenzeile).
5. **Übergangsregel:** `autosaveWarV1` = der Autosave trägt `zuordnungOffen` (A4: Version 1 wird beim Lesen zu `zuordnungOffen`, und das bleibt bis zum ersten Abgleich erhalten, auch wenn ohne Show zwischendurch als Version 2 gespeichert wurde — „Version-1-Dokument“ im Sinne von 4.1/4.9). Nach der Übernahme schreibt der Main den Autosave einmal ohne `zuordnungOffen` zurück, aber nur, wenn die Sicherung `rundown.autosave.v1.jmrundown` vorliegt — sonst würde ein zweites Öffnen einer gleichnamigen Show ohne Gedächtnis (z. B. „Tag 2“ mit demselben Namen) ihn erneut übernehmen; Ergänzung 0.7 verlangt „einmalig“.
6. **„Show ohne Ablauf und ohne eigene Rundown-Datei“ (5.2)** greift nur, wenn es für diese Show auch **kein Gedächtnis** gibt. Sonst würde das gerade offene, fremde Dokument das Gedächtnis dieser Show überschreiben.
7. **Deep-Link auf eine andere, nicht lesbare Show:** Stand bleibt, Fehler ins Log, Hinweis „Show nicht lesbar: <Grund>“; die Show wird nicht gemerkt (die Spec regelt „nicht lesbar“ nur für den Start ohne Deep-Link und für RELOAD).
8. **Start über den Zeiger, Show nicht lesbar und kein Gedächtnis vorhanden:** der Autosave bleibt, die Show wird nicht gemerkt (5.2 setzt „Der Gedächtnisstand wird geladen“ voraus). Mit Gedächtnis wie in der Spec; `ablaufSchluessel` kommt dann aus den lebenden Ablaufzeilen, `eigeneTimerListe` ist unbekannt (`false`), bis ein RELOAD gelingt.
9. **Hinweise beim Laden einer anderen Show** nur, wenn der Ausgangsstand schon einen Kontext hatte (Gedächtnis, Datei Version 2). Ein leeres oder nie abgeglichenes Dokument „ändert“ sich nicht, es entsteht — sonst käme bei jedem Erst-Öffnen „Side Event gewechselt“.
10. **`abgleichRev`** steigt auch beim Laden einer anderen Show (eine verspätete Bearbeitung des alten Dokuments würde sonst das neue überschreiben). Ein RELOAD ohne Änderung (Tiefenvergleich von Dokument und `scharfId`) erhöht weder `rev` noch `abgleichRev` — keine falschen Abweisungen.
11. **`rundown:setDoc`:** `kontext`, `archiv` und `zuordnungOffen` übernimmt der Main aus seinem eigenen Dokument, nicht aus dem des Renderers. Die Absicherung 4.5 (`bereinigeQuellen`) läuft nur bei gemerkter Show (A7 Abweichung 3).
12. **Nicht gebundene Sprünge** gehen unverändert raus (A7 Abweichung 4); nur gebundene bekommen die aufgelöste Nummer.
13. **Speichern:** Der Dateistand fürs Gedächtnis wird unter dem Pfad aus der Show gebildet (`dateiStand(showRundownDatei)`), weil A8 Pfade exakt vergleicht (Groß-/Kleinschreibung aus dem Speichern-Dialog kann abweichen).
14. **Defektes Gedächtnis:** Hinweis-Text „Gespeicherter Stand dieser Show war beschädigt und wurde beiseitegelegt.“ steht nicht in 4.6 (Review-Focus 2 verlangt nur „Hinweis“) — siehe offene Fragen.
15. **G6 nebenbei:** „Öffnen fehlgeschlagen“ loggt bei kaputtem JSON nur noch „kein gültiges JSON“ statt der Parser-Meldung.
16. **Kanonische Form des Dokuments:** Der Main hält `doc` immer in der Form von `migrate` aus `store.ts` (beim Start, nach jedem Laden, Abgleich und jeder Bearbeitung). Nach einem Neustart kommt das Dokument über `migrate` aus dem Gedächtnis zurück; ohne diese Regel unterschiede sich danach nur die Feldreihenfolge der Zeilen (gemessen im Rauchtest), und ein strenger Vergleich wie in A17 Schritt 7a/7b (`JSON.stringify(st.doc.rows) === JSON.stringify(vor.doc.rows)`) schlüge fehl. Nebenbei werden Eingaben des Renderers normalisiert. Der Abgleich-Vergleich in `reloadShow` vergleicht ebenfalls die kanonische Form.

---

### Aufgabe A11: Rundown Preload und Renderer — Sperren, Hinweise, Abweisung, Sprung-Auswahl

**Spec:** 4.3 (Knopf „Als eigene Zeile behalten“), 4.5 (Tabelle: was gesperrt ist, Hinweise; gesperrte Felder gesteuert; Duplizieren = eigene Zeile; Regieplan-Import „Ersetzen“ nur eigene Zeilen), 4.6 (Hinweise anzeigen, stehende wegklicken über `rundown:hinweisWeg`), 5.5 (`basisRev` mitschicken, Abweisungszähler in den React-Schlüsseln der Editor-Felder), 6.2 (Auswahl der Ablaufpunkte als „<n> · <Titel>“, „Nummer von Hand“, „Nummer von Hand: <n> (<Titel an Stelle n>)“ mit „an diesen Punkt binden“, Chip und Vorschau mit aufgelöster Nummer bzw. „Ziel entfallen“, Test-Knopf per `fireAction(rowId, actionId)`), 9.1 Fall 21.

**Dateien:**
- Modify: `apps/rundown/src/shared/zeilen.ts` (aus A10) — Typ-Import Zeile 5, Anhang hinter `sprungZielTitel` (Zeilen 47–50)
- Modify: `apps/rundown/src/shared/types.ts` — `JmRundownApi` (Stand nach A10: Zeilen 167–168 und 175–176)
- Modify: `apps/rundown/src/preload/index.ts` — Zeilen 18–19 und 25
- Modify: `apps/rundown/src/renderer/src/store/useRundown.ts` — Zeilen 8, 13–15, 34, 39–42
- Modify: `apps/rundown/src/renderer/src/lib/doc.ts` — Zeilen 3–4, 40–43, 63–78
- Modify: `apps/rundown/src/renderer/src/components/RowEditor.tsx` — Zeilen 1–3, 20–53, 65–69, 85–97, 112, 119–123, 165–171, 229, 303
- Modify: `apps/rundown/src/renderer/src/components/RundownList.tsx` — Zeilen 1–2, 15–24, 46–54, 67, 74–78, 98–117, 128–135, 156
- Modify: `apps/rundown/src/renderer/src/App.tsx` — Zeilen 4, 15, 56–57, 70–77, 103–105, 140, 149–161
- Unverändert: `apps/rundown/src/renderer/src/jmrundown.d.ts` (es typisiert `window.jmrundown` als `JmRundownApi`; die neue Signatur kommt von dort)
- Test: `apps/rundown/test/selftest.ts` — Import hinter dem A10-Import von `sprung.ts`, Block vor der Schlusszeile

Alle Zeilenangaben: Stand vor A11 (Preload und Renderer sind seit dem Ausgangsstand unverändert).

**Schnittstellen:**

Consumes (exakt):
```ts
// A4 · types.ts
interface RundownAction { /* … */ zielId?: string }
interface RundownRow { /* … */ quelle?: 'ablauf'; entfallen?: true }
interface RundownDoc { schemaVersion: 2; name: string; rows: RundownRow[]; kontext?: string; archiv?: Record<string, RundownRow[]>; zuordnungOffen?: true }
// A5 · abgleich.ts (nur im Test)
export function gleicheAb(e: { alt: RundownRow[]; ablauf: ShowAblaufItem[]; scharfId: string | null; altformat: boolean }): { rows: RundownRow[]; scharfId: string | null; bericht: AbgleichBericht; umbenannt: Record<string, string> };
export function berichtIstLeer(b: AbgleichBericht): boolean;
// A7 · sprung.ts / scharf.ts
export function loeseSprungZiel(aktion: RundownAction, ablaufSchluessel: string[], eigeneTimerListe: boolean): SprungErgebnis;
export function ersetzeEigeneZeilen(rows: RundownRow[], neueZeilen: RundownRow[]): RundownRow[];
// A10 · types.ts / IPC im Main
interface RundownState { /* … */ scharfId: string | null; rev: number; hinweise: RundownHinweis[]; abweisungen: number; ablaufSchluessel: string[]; eigeneTimerListe: boolean; showGemerkt: boolean; showMitIveo: boolean }
interface RundownHinweis { id: number; text: string; art: 'kurz' | 'stehend' }
//   'rundown:setDoc' (doc, basisRev: number) · 'rundown:fireAction' (rowId, actionId) → boolean
//   'rundown:hinweisWeg' (id: number) · 'rundown:alsEigeneZeile' (rowId: string)
// A10 · shared/zeilen.ts
export function istSprung(a: RundownAction): boolean;
export function sendeArgs(a: RundownAction, loese: (a: RundownAction) => SprungErgebnis): (string | number)[] | null;
```

Produces:
```ts
// types.ts · JmRundownApi (geändert/neu)
fireAction: (rowId: string, actionId: string) => Promise<boolean>;
setDoc: (doc: RundownDoc, basisRev: number) => Promise<RundownState>;
hinweisWeg: (id: number) => Promise<RundownState>;
alsEigeneZeile: (rowId: string) => Promise<RundownState>;
// store/useRundown.ts
setDoc: (doc: RundownDoc, basisRev: number) => Promise<void>;
fireAction: (rowId: string, actionId: string) => Promise<boolean>;
hinweisWeg: (id: number) => Promise<void>;
alsEigeneZeile: (rowId: string) => Promise<void>;
// lib/doc.ts
export function applyImportedRows(doc: RundownDoc, rows: RundownRow[], replace: boolean, showGemerkt?: boolean): RundownDoc;
// shared/zeilen.ts (Anhang)
export interface ShowSicht { showGemerkt: boolean; mitIveo: boolean; ablaufSchluessel: string[]; eigeneTimerListe: boolean }
export type ZeilenArt = 'ablauf' | 'entfallen' | 'eigen';
export function zeilenArt(row: RundownRow): ZeilenArt;
export interface Sperren { text: boolean; verschieben: boolean; loeschen: boolean }
export function sperrenFuer(row: RundownRow, showGemerkt: boolean): Sperren;
export function zeilenHinweis(row: RundownRow, showGemerkt: boolean, mitIveo: boolean): string | null;
export interface AblaufPunkt { n: number; id: string; label: string }
export function ablaufPunkte(rows: RundownRow[], ablaufSchluessel: string[]): AblaufPunkt[];
export function dupliziereZeile(doc: RundownDoc, rowId: string, neueId: (praefix: 'r' | 'a') => string): RundownDoc;
```

**Vorab (am Repo und am Prototyp gemessen):**
- `lib/doc.ts` importiert `newId` zur Laufzeit über den Alias `@shared/conductor`; unter `node --experimental-strip-types` gibt es keine Aliase. Die neue, testbare Logik liegt deshalb rein in `src/shared/zeilen.ts` (G2: nur `import type`), `lib/doc.ts` reicht nur `newId` durch. `ersetzeEigeneZeilen` (A7) ist schon in A7 getestet (Fall 36).
- Die Hinweistexte an den Zeilen sind wortgleich aus Tabelle 4.5: „kommt aus iveo“, „kommt aus der Show, im Show-Editor ändern“, „in iveo entfallen“, „in der Show entfallen“, Knopf „Als eigene Zeile behalten“.
- Ein `key` aus Zeilen-ID **und** `state.abweisungen` am ganzen `RowEditor` baut nach einer Abweisung alle ungesteuerten Felder neu auf (Spec 5.5); dasselbe am Namensfeld im Kopf.
- Gegengeprüft an einer Kopie der App mit A4–A10: Selbsttest grün (Fall 21 gegen das echte `gleicheAb` aus A5), `typecheck:node`/`typecheck:web` grün, `electron-vite build` grün.

---

#### Zyklus 1: reine Helfer für Sperren, Hinweise, Auswahl und Duplizieren

- [ ] **Schritt 1: Testimport ergänzen** in `apps/rundown/test/selftest.ts` (hinter dem Import aus A10).

Datei `apps/rundown/test/selftest.ts`.

Vorher:
```ts
import * as sprungModul from '../src/shared/sprung.ts';
```
Nachher:
```ts
import * as sprungModul from '../src/shared/sprung.ts';
import * as abgleichModul from '../src/shared/abgleich.ts';
```

- [ ] **Schritt 2: Fehlschlagende Tests einfügen** direkt vor der Schlusszeile (in `{ … }`). Fall 21 läuft gegen das echte `gleicheAb` aus A5.

Datei `apps/rundown/test/selftest.ts`. Vorher (eindeutig):
```ts
console.log(failed === 0 ? '\nALLE TESTS OK' : `\n${failed} FEHLER`);
```
Nachher:
```ts
// ── A11: Sperren, Hinweise, Sprung-Auswahl, Duplizieren (4.5, 6.2) ───────────
{
  const { zeilenArt, sperrenFuer, zeilenHinweis, ablaufPunkte, dupliziereZeile } = zeilenModul;
  const titler = { id: 'a1', role: 'titler', verb: 'take', args: ['x'], enabled: true };
  const lebend = { id: 'u1', label: 'Begrüßung', quelle: 'ablauf' as const, actions: [titler] };
  const weg = { id: 'u2', label: 'Panel', quelle: 'ablauf' as const, entfallen: true as const, actions: [] };
  const eigen = { id: 'r1', label: 'Einspieler', actions: [] };
  eq([zeilenArt(lebend), zeilenArt(weg), zeilenArt(eigen)], ['ablauf', 'entfallen', 'eigen'], 'Zeilenarten');
  eq(sperrenFuer(lebend, true), { text: true, verschieben: true, loeschen: true }, '4.5: lebende Ablaufzeile gesperrt, nicht löschbar');
  eq(sperrenFuer(weg, true), { text: true, verschieben: true, loeschen: false }, '4.5: entfallene Zeile gesperrt, aber löschbar');
  eq(sperrenFuer(eigen, true), { text: false, verschieben: false, loeschen: false }, '4.5: eigene Zeile frei');
  eq(sperrenFuer(lebend, false), { text: false, verschieben: false, loeschen: false }, '4.5: ohne gemerkte Show alles frei');
  eq(zeilenHinweis(lebend, true, true), 'kommt aus iveo', '4.5: Hinweis Ablaufzeile mit iveo');
  eq(zeilenHinweis(lebend, true, false), 'kommt aus der Show, im Show-Editor ändern', '4.5: Hinweis Ablaufzeile ohne iveo');
  eq(zeilenHinweis(lebend, false, true), null, '4.5: ohne gemerkte Show kein Hinweis an Ablaufzeilen');
  eq(zeilenHinweis(weg, true, true), 'in iveo entfallen', '4.5: Hinweis entfallen mit iveo');
  eq(zeilenHinweis(weg, false, false), 'in der Show entfallen', '4.5: ohne Show behält die entfallene Zeile ihren Hinweis');
  eq(zeilenHinweis(eigen, true, true), null, '4.5: eigene Zeile ohne Hinweis');
  eq(
    ablaufPunkte([lebend, weg, eigen], ['u1', 'u9']),
    [
      { n: 1, id: 'u1', label: 'Begrüßung' },
      { n: 2, id: 'u9', label: 'u9' },
    ],
    '6.2: Auswahl in Ablaufreihenfolge mit Nummer und Titel',
  );

  const doc: RundownDoc = { schemaVersion: 2, name: 'T', kontext: 'se:p1', rows: [lebend, weg, eigen] };
  let k = 0;
  const neueId = (p: 'r' | 'a'): string => `${p}_k${++k}`;
  const d = dupliziereZeile(doc, 'u1', neueId);
  eq(d.rows.map((r) => r.id), ['u1', 'r_k1', 'u2', 'r1'], 'Duplizieren: Kopie direkt hinter dem Original');
  eq(
    d.rows[1],
    { id: 'r_k1', label: 'Begrüßung (Kopie)', actions: [{ ...titler, id: 'a_k2' }] },
    'Duplizieren: eigene Zeile ohne quelle, neue ids, Titel mit „(Kopie)“',
  );
  eq(d.rows[1].actions[0].args !== titler.args, true, 'Duplizieren: args kopiert, nicht geteilt');
  eq(dupliziereZeile(doc, 'fehlt', neueId) === doc, true, 'Duplizieren: unbekannte Zeile → Dokument unverändert');
  eq('entfallen' in dupliziereZeile(doc, 'u2', neueId).rows[2], false, 'Duplizieren einer entfallenen Zeile → ohne entfallen');

  // 9.1 Fall 21 mit dem echten Abgleich: Kopie bleibt eigene Zeile hinter dem Original, Bericht leer.
  const basis: RundownDoc = { schemaVersion: 2, name: 'T', kontext: 'se:p1', rows: [lebend] };
  const kopiert = dupliziereZeile(basis, 'u1', neueId);
  const g = abgleichModul.gleicheAb({
    alt: kopiert.rows,
    ablauf: [{ id: 'u1', label: 'Begrüßung' }],
    scharfId: 'u1',
    altformat: false,
  });
  eq(g.rows.map((r) => r.id), kopiert.rows.map((r) => r.id), 'Fall 21: Kopie bleibt direkt hinter dem Original');
  eq('quelle' in g.rows[1], false, 'Fall 21: Kopie bleibt eigene Zeile');
  eq(abgleichModul.berichtIstLeer(g.bericht), true, 'Fall 21: Bericht leer');
}

console.log(failed === 0 ? '\nALLE TESTS OK' : `\n${failed} FEHLER`);
```

- [ ] **Schritt 3: Test laufen lassen (rot).**

```bash
npm run selftest -w @jm/rundown
```
Erwartet: Die bisherigen Blöcke laufen durch (`ok …`), dann Abbruch mit Exit-Code 1:
```
TypeError: zeilenArt is not a function
```

- [ ] **Schritt 4: Typ-Import in `zeilen.ts` um `RundownDoc` erweitern.**

Datei `apps/rundown/src/shared/zeilen.ts` (Zeile 5). Stand nach A10.

Vorher:
```ts
import type { RundownAction, RundownRow } from './types';
```
Nachher:
```ts
import type { RundownAction, RundownDoc, RundownRow } from './types';
```

- [ ] **Schritt 5: Helfer an `zeilen.ts` anhängen.**

Datei `apps/rundown/src/shared/zeilen.ts` (Zeilen 47–50). Stand nach A10 (Dateiende).

Vorher:
```ts
/** Titel des Sprung-Ziels für Hinweis und Log; ohne Zeile „Punkt <args[0]>“. */
export function sprungZielTitel(rows: RundownRow[], a: RundownAction): string {
  return rows.find((r) => r.id === a.zielId)?.label ?? `Punkt ${String(a.args[0] ?? '?')}`;
}
```
Nachher:
```ts
/** Titel des Sprung-Ziels für Hinweis und Log; ohne Zeile „Punkt <args[0]>“. */
export function sprungZielTitel(rows: RundownRow[], a: RundownAction): string {
  return rows.find((r) => r.id === a.zielId)?.label ?? `Punkt ${String(a.args[0] ?? '?')}`;
}

// ── Für den Renderer: Sperren, Hinweise, Sprung-Auswahl, Duplizieren (4.5, 6.2) ──

/** Was Liste und Editor über die gemerkte Show wissen (aus RundownState). */
export interface ShowSicht {
  showGemerkt: boolean;
  mitIveo: boolean;
  ablaufSchluessel: string[];
  eigeneTimerListe: boolean;
}

export type ZeilenArt = 'ablauf' | 'entfallen' | 'eigen';

/** Lebende Ablaufzeile, entfallene Zeile oder eigene Zeile (Begriffe, Spec 2). */
export function zeilenArt(row: RundownRow): ZeilenArt {
  if (row.quelle !== 'ablauf') return 'eigen';
  return row.entfallen ? 'entfallen' : 'ablauf';
}

/** Was an einer Zeile gesperrt ist (Tabelle 4.5). Aktionen und Duplizieren sind immer frei. */
export interface Sperren {
  /** Titel, Notiz und Dauer. */
  text: boolean;
  verschieben: boolean;
  loeschen: boolean;
}

export function sperrenFuer(row: RundownRow, showGemerkt: boolean): Sperren {
  const art = zeilenArt(row);
  if (!showGemerkt || art === 'eigen') return { text: false, verschieben: false, loeschen: false };
  return { text: true, verschieben: true, loeschen: art === 'ablauf' };
}

/** Hinweis an der Zeile (Tabelle 4.5); null = kein Hinweis. */
export function zeilenHinweis(row: RundownRow, showGemerkt: boolean, mitIveo: boolean): string | null {
  switch (zeilenArt(row)) {
    case 'ablauf':
      if (!showGemerkt) return null;
      return mitIveo ? 'kommt aus iveo' : 'kommt aus der Show, im Show-Editor ändern';
    case 'entfallen':
      // Auch ohne gemerkte Show behalten entfallene Zeilen Markierung und Hinweis.
      return mitIveo ? 'in iveo entfallen' : 'in der Show entfallen';
    default:
      return null;
  }
}

export interface AblaufPunkt {
  n: number;
  id: string;
  label: string;
}

/** Auswahl für `timer goto` (6.2): Ablaufpunkte in Ablaufreihenfolge, Titel aus der Zeile. */
export function ablaufPunkte(rows: RundownRow[], ablaufSchluessel: string[]): AblaufPunkt[] {
  return ablaufSchluessel.map((id, i) => ({ n: i + 1, id, label: rows.find((r) => r.id === id)?.label ?? id }));
}

/** Kopie ohne Herkunft: ohne `quelle` und `entfallen` = eigene Zeile (wie `alsEigeneZeile` in scharf.ts, G2). */
function ohneHerkunft(r: RundownRow): RundownRow {
  const kopie: RundownRow = { ...r };
  delete kopie.quelle;
  delete kopie.entfallen;
  return kopie;
}

/**
 * Zeile duplizieren (4.5): Die Kopie ist immer eine eigene Zeile — neue ids für
 * Zeile und Aktionen, ohne `quelle`/`entfallen`, Titel mit „(Kopie)“, direkt
 * hinter dem Original. `args` werden kopiert, nicht geteilt.
 */
export function dupliziereZeile(
  doc: RundownDoc,
  rowId: string,
  neueId: (praefix: 'r' | 'a') => string,
): RundownDoc {
  const idx = doc.rows.findIndex((r) => r.id === rowId);
  if (idx < 0) return doc;
  const src = doc.rows[idx];
  const kopie: RundownRow = {
    ...ohneHerkunft(src),
    id: neueId('r'),
    label: `${src.label} (Kopie)`,
    actions: src.actions.map((a) => ({ ...a, id: neueId('a'), args: a.args.slice() })),
  };
  const rows = doc.rows.slice();
  rows.splice(idx + 1, 0, kopie);
  return { ...doc, rows };
}
```

- [ ] **Schritt 6: Test laufen lassen (grün).**

```bash
npm run selftest -w @jm/rundown
```
Erwartet: zweimal `ALLE TESTS OK`, Exit-Code 0. Neu sind 20 Zeilen `ok`, darunter:
```
ok   4.5: lebende Ablaufzeile gesperrt, nicht löschbar
ok   4.5: entfallene Zeile gesperrt, aber löschbar
ok   4.5: ohne gemerkte Show alles frei
ok   4.5: Hinweis Ablaufzeile ohne iveo
ok   4.5: ohne Show behält die entfallene Zeile ihren Hinweis
ok   6.2: Auswahl in Ablaufreihenfolge mit Nummer und Titel
ok   Duplizieren: eigene Zeile ohne quelle, neue ids, Titel mit „(Kopie)“
ok   Duplizieren einer entfallenen Zeile → ohne entfallen
ok   Fall 21: Kopie bleibt direkt hinter dem Original
ok   Fall 21: Bericht leer
```

#### Zyklus 2: Preload, Store und Oberfläche (geprüft über Typecheck und Build; Verhalten im Durchgang A17)

- [ ] **Schritt 7: `JmRundownApi.fireAction` auf `rowId`/`actionId` umstellen (6.2).**

Datei `apps/rundown/src/shared/types.ts` (Zeilen 167–168). Stand nach A10.

Vorher:
```ts
  /** Eine einzelne Aktion sofort feuern (Test im Editor). Liefert „zugestellt". */
  fireAction: (role: string, verb: string, args: (string | number)[]) => Promise<boolean>;
```
Nachher:
```ts
  /**
   * Test-Knopf im Editor: Aktion `actionId` der Zeile `rowId` sofort feuern. Der
   * Main löst ein Sprung-Ziel auf wie beim GO (6.2). Liefert „zugestellt"; false
   * auch, wenn das Ziel entfallen ist — dann wird nichts gesendet.
   */
  fireAction: (rowId: string, actionId: string) => Promise<boolean>;
```

- [ ] **Schritt 8: `JmRundownApi.setDoc` mit `basisRev`; neu `hinweisWeg` und `alsEigeneZeile`.**

Datei `apps/rundown/src/shared/types.ts` (Zeilen 175–176). Stand nach A10.

Vorher:
```ts
  /** Dokument ersetzen (Editor speichert den ganzen Doc zurück). */
  setDoc: (doc: RundownDoc) => Promise<RundownState>;
```
Nachher:
```ts
  /**
   * Dokument ersetzen (Editor speichert den ganzen Doc zurück). `basisRev` ist der
   * `rev` des Stands, auf dem die Änderung beruht (5.5). Lief seitdem ein Abgleich,
   * weist der Main sie ab und zählt `abweisungen` hoch.
   */
  setDoc: (doc: RundownDoc, basisRev: number) => Promise<RundownState>;
  /** Stehenden Hinweis wegklicken (4.6). */
  hinweisWeg: (id: number) => Promise<RundownState>;
  /** „Als eigene Zeile behalten“ für eine entfallene Zeile (4.3). */
  alsEigeneZeile: (rowId: string) => Promise<RundownState>;
```

- [ ] **Schritt 9: Preload: `fireAction` schickt `rowId`, `actionId`.**

Datei `apps/rundown/src/preload/index.ts` (Zeilen 18–19).

Vorher:
```ts
  fireAction: (role: string, verb: string, args: (string | number)[]) =>
    ipcRenderer.invoke('rundown:fireAction', role, verb, args) as Promise<boolean>,
```
Nachher:
```ts
  fireAction: (rowId: string, actionId: string) =>
    ipcRenderer.invoke('rundown:fireAction', rowId, actionId) as Promise<boolean>,
```

- [ ] **Schritt 10: Preload: `setDoc` mit `basisRev`, dazu `hinweisWeg` und `alsEigeneZeile`.**

Datei `apps/rundown/src/preload/index.ts` (Zeile 25).

Vorher:
```ts
  setDoc: (doc: RundownDoc) => ipcRenderer.invoke('rundown:setDoc', doc) as Promise<RundownState>,
```
Nachher:
```ts
  setDoc: (doc: RundownDoc, basisRev: number) =>
    ipcRenderer.invoke('rundown:setDoc', doc, basisRev) as Promise<RundownState>,
  hinweisWeg: (id: number) => ipcRenderer.invoke('rundown:hinweisWeg', id) as Promise<RundownState>,
  alsEigeneZeile: (rowId: string) =>
    ipcRenderer.invoke('rundown:alsEigeneZeile', rowId) as Promise<RundownState>,
```

- [ ] **Schritt 11: Store: Typ von `setDoc`.**

Datei `apps/rundown/src/renderer/src/store/useRundown.ts` (Zeile 8).

Vorher:
```ts
  setDoc: (doc: RundownDoc) => Promise<void>;
```
Nachher:
```ts
  /** `basisRev` = `state.rev` des Stands, aus dem `doc` berechnet wurde (5.5). */
  setDoc: (doc: RundownDoc, basisRev: number) => Promise<void>;
```

- [ ] **Schritt 12: Store: Typen von `fireAction`, `hinweisWeg`, `alsEigeneZeile`.**

Datei `apps/rundown/src/renderer/src/store/useRundown.ts` (Zeilen 13–15).

Vorher:
```ts
  fireAction: (role: string, verb: string, args: (string | number)[]) => Promise<boolean>;
  setEndpoint: (role: string, host: string, port: number) => Promise<void>;
}
```
Nachher:
```ts
  fireAction: (rowId: string, actionId: string) => Promise<boolean>;
  setEndpoint: (role: string, host: string, port: number) => Promise<void>;
  hinweisWeg: (id: number) => Promise<void>;
  alsEigeneZeile: (rowId: string) => Promise<void>;
}
```

- [ ] **Schritt 13: Store: `setDoc` reicht `basisRev` durch (`useRundown.ts:34`, Spec 5.5).**

Datei `apps/rundown/src/renderer/src/store/useRundown.ts` (Zeile 34).

Vorher:
```ts
  setDoc: async (doc) => set({ state: await window.jmrundown.setDoc(doc) }),
```
Nachher:
```ts
  setDoc: async (doc, basisRev) => set({ state: await window.jmrundown.setDoc(doc, basisRev) }),
```

- [ ] **Schritt 14: Store: `fireAction`, `hinweisWeg`, `alsEigeneZeile`.**

Datei `apps/rundown/src/renderer/src/store/useRundown.ts` (Zeilen 39–42).

Vorher:
```ts
  fireAction: (role, verb, args) => window.jmrundown.fireAction(role, verb, args),
  setEndpoint: async (role, host, port) =>
    set({ state: await window.jmrundown.setEndpoint(role, host, port) }),
}));
```
Nachher:
```ts
  fireAction: (rowId, actionId) => window.jmrundown.fireAction(rowId, actionId),
  setEndpoint: async (role, host, port) =>
    set({ state: await window.jmrundown.setEndpoint(role, host, port) }),
  hinweisWeg: async (id) => set({ state: await window.jmrundown.hinweisWeg(id) }),
  alsEigeneZeile: async (rowId) => set({ state: await window.jmrundown.alsEigeneZeile(rowId) }),
}));
```

- [ ] **Schritt 15: `lib/doc.ts`: Importe.**

Datei `apps/rundown/src/renderer/src/lib/doc.ts` (Zeilen 3–4).

Vorher:
```ts
import { newId } from '@shared/conductor';
import type { RundownAction, RundownDoc, RundownRow } from '@shared/types';
```
Nachher:
```ts
import { newId } from '@shared/conductor';
import { ersetzeEigeneZeilen } from '@shared/scharf';
import { dupliziereZeile } from '@shared/zeilen';
import type { RundownAction, RundownDoc, RundownRow } from '@shared/types';
```

- [ ] **Schritt 16: `lib/doc.ts`: Import „Ersetzen“ ersetzt mit gemerkter Show nur eigene Zeilen (4.5).**

Datei `apps/rundown/src/renderer/src/lib/doc.ts` (Zeilen 40–43).

Vorher:
```ts
/** Importierte Zeilen ins Dokument übernehmen — ersetzen oder anhängen. */
export function applyImportedRows(doc: RundownDoc, rows: RundownRow[], replace: boolean): RundownDoc {
  return withRows(doc, replace ? rows : [...doc.rows, ...rows]);
}
```
Nachher:
```ts
/**
 * Importierte Zeilen ins Dokument übernehmen — ersetzen oder anhängen. Ist eine
 * Show gemerkt, ersetzt „Ersetzen“ nur die eigenen Zeilen: Ablaufzeilen und
 * entfallene Zeilen bleiben, die importierten kommen ans Ende (4.5).
 */
export function applyImportedRows(
  doc: RundownDoc,
  rows: RundownRow[],
  replace: boolean,
  showGemerkt = false,
): RundownDoc {
  if (!replace) return withRows(doc, [...doc.rows, ...rows]);
  return withRows(doc, showGemerkt ? ersetzeEigeneZeilen(doc.rows, rows) : rows);
}
```

- [ ] **Schritt 17: `lib/doc.ts`: `duplicateRow` liefert immer eine eigene Zeile (4.5).**

Datei `apps/rundown/src/renderer/src/lib/doc.ts` (Zeilen 63–78).

Vorher:
```ts
 * `args` wird kopiert (kein geteiltes Array). Label bekommt einen „(Kopie)"-Zusatz.
 */
export function duplicateRow(doc: RundownDoc, rowId: string): RundownDoc {
  const idx = doc.rows.findIndex((r) => r.id === rowId);
  if (idx < 0) return doc;
  const src = doc.rows[idx];
  const copy: RundownRow = {
    ...src,
    id: newId('r'),
    label: `${src.label} (Kopie)`,
    actions: src.actions.map((a) => ({ ...a, id: newId('a'), args: a.args.slice() })),
  };
  const rows = doc.rows.slice();
  rows.splice(idx + 1, 0, copy);
  return withRows(doc, rows);
}
```
Nachher:
```ts
 * `args` wird kopiert (kein geteiltes Array). Label bekommt einen „(Kopie)"-Zusatz.
 * Die Kopie ist immer eine eigene Zeile, auch die einer Ablaufzeile (4.5). Die
 * Logik liegt in @shared/zeilen, damit der Selbsttest sie ohne Vite prüft.
 */
export function duplicateRow(doc: RundownDoc, rowId: string): RundownDoc {
  return dupliziereZeile(doc, rowId, newId);
}
```

- [ ] **Schritt 18: `RowEditor.tsx`: Importe.**

Datei `apps/rundown/src/renderer/src/components/RowEditor.tsx` (Zeilen 1–3).

Vorher:
```tsx
import { useState } from 'react';
import { buildActionLine } from '@shared/conductor';
import { CAPABILITIES, KNOWN_ROLES, capAction } from '@/lib/capabilities';
```
Nachher:
```tsx
import { useState } from 'react';
import { buildActionLine } from '@shared/conductor';
import { loeseSprungZiel } from '@shared/sprung';
import {
  ablaufPunkte,
  istSprung,
  sendeArgs,
  sperrenFuer,
  zeilenArt,
  zeilenHinweis,
  type AblaufPunkt,
  type ShowSicht,
} from '@shared/zeilen';
import { CAPABILITIES, KNOWN_ROLES, capAction } from '@/lib/capabilities';
```

- [ ] **Schritt 19: `RowEditor.tsx`: Kopf des Editors — gesperrte Felder gesteuert (`value` + `readOnly`), Notiz als Text, Hinweis an der Zeile, Knopf „Als eigene Zeile behalten“ (4.3, 4.5).**

Datei `apps/rundown/src/renderer/src/components/RowEditor.tsx` (Zeilen 20–53).

Vorher:
```tsx
export function RowEditor({
  doc,
  row,
  iveoSpeakers,
  iveoSideEvents,
  onDoc,
}: {
  doc: RundownDoc;
  row: RundownRow;
  iveoSpeakers: ShowIveoSpeaker[];
  iveoSideEvents: ShowIveoProgramRef[];
  onDoc: (doc: RundownDoc) => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--border)] p-3">
        <label className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">Zeilen-Titel</label>
        <input
          key={row.id}
          defaultValue={row.label}
          onBlur={(e) => onDoc(updateRow(doc, row.id, { label: e.target.value }))}
          className={input}
        />
        <label className="mt-2 block text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
          Dauer (mm:ss · optional, für Timer-Austausch)
        </label>
        <input
          key={`${row.id}:dur`}
          defaultValue={formatClock(row.durationMs)}
          placeholder="z. B. 5:00"
          onBlur={(e) => onDoc(updateRow(doc, row.id, { durationMs: parseClock(e.target.value) }))}
          className={input}
        />
      </div>
```
Nachher:
```tsx
export function RowEditor({
  doc,
  row,
  iveoSpeakers,
  iveoSideEvents,
  sicht,
  onDoc,
  onAlsEigeneZeile,
}: {
  doc: RundownDoc;
  row: RundownRow;
  iveoSpeakers: ShowIveoSpeaker[];
  iveoSideEvents: ShowIveoProgramRef[];
  /** Gemerkte Show: Sperren (4.5) und Sprung-Auswahl (6.2). */
  sicht: ShowSicht;
  onDoc: (doc: RundownDoc) => void;
  onAlsEigeneZeile: (rowId: string) => void;
}) {
  const sperre = sperrenFuer(row, sicht.showGemerkt);
  const hinweis = zeilenHinweis(row, sicht.showGemerkt, sicht.mitIveo);
  const entfallen = zeilenArt(row) === 'entfallen';
  const punkte = ablaufPunkte(doc.rows, sicht.ablaufSchluessel);
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--border)] p-3">
        <label className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">Zeilen-Titel</label>
        {sperre.text ? (
          // 4.5: Gesperrte Felder sind gesteuert (value + readOnly) — ein Abgleich ist sofort sichtbar.
          <input value={row.label} readOnly className={`${input} opacity-70`} />
        ) : (
          <input
            key={row.id}
            defaultValue={row.label}
            onBlur={(e) => onDoc(updateRow(doc, row.id, { label: e.target.value }))}
            className={input}
          />
        )}
        <label className="mt-2 block text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
          Dauer (mm:ss · optional, für Timer-Austausch)
        </label>
        {sperre.text ? (
          <input value={formatClock(row.durationMs)} readOnly className={`${input} opacity-70`} />
        ) : (
          <input
            key={`${row.id}:dur`}
            defaultValue={formatClock(row.durationMs)}
            placeholder="z. B. 5:00"
            onBlur={(e) => onDoc(updateRow(doc, row.id, { durationMs: parseClock(e.target.value) }))}
            className={input}
          />
        )}
        {sperre.text && row.note && (
          <p className="mt-2 whitespace-pre-wrap text-xs text-[var(--muted-foreground)]">{row.note}</p>
        )}
        {hinweis && (
          <div className="mt-2 flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
            <span className={entfallen ? 'text-[var(--warning)]' : ''}>{hinweis}</span>
            {entfallen && (
              <button
                onClick={() => onAlsEigeneZeile(row.id)}
                className="ml-auto rounded border border-[var(--border)] px-1.5 py-0.5 text-xs text-[var(--foreground)] hover:bg-[var(--highlight)]"
              >
                Als eigene Zeile behalten
              </button>
            )}
          </div>
        )}
      </div>
```

- [ ] **Schritt 20: `RowEditor.tsx`: `sicht` und `punkte` an `ActionRow` weitergeben.**

Datei `apps/rundown/src/renderer/src/components/RowEditor.tsx` (Zeilen 65–69).

Vorher:
```tsx
            iveoSpeakers={iveoSpeakers}
            iveoSideEvents={iveoSideEvents}
            onDoc={onDoc}
          />
        ))}
```
Nachher:
```tsx
            iveoSpeakers={iveoSpeakers}
            iveoSideEvents={iveoSideEvents}
            sicht={sicht}
            punkte={punkte}
            onDoc={onDoc}
          />
        ))}
```

- [ ] **Schritt 21: `RowEditor.tsx`: `ActionRow` — Vorschau über `sendeArgs`, Auswahl-Bedingung, Nummer von Hand.**

Datei `apps/rundown/src/renderer/src/components/RowEditor.tsx` (Zeilen 85–97).

Vorher:
```tsx
  iveoSpeakers,
  iveoSideEvents,
  onDoc,
}: {
  doc: RundownDoc;
  rowId: string;
  action: RundownAction;
  iveoSpeakers: ShowIveoSpeaker[];
  iveoSideEvents: ShowIveoProgramRef[];
  onDoc: (doc: RundownDoc) => void;
}) {
  const cap = capAction(action.role, action.verb);
  const line = buildActionLine(action.role, action.verb, action.args);
```
Nachher:
```tsx
  iveoSpeakers,
  iveoSideEvents,
  sicht,
  punkte,
  onDoc,
}: {
  doc: RundownDoc;
  rowId: string;
  action: RundownAction;
  iveoSpeakers: ShowIveoSpeaker[];
  iveoSideEvents: ShowIveoProgramRef[];
  sicht: ShowSicht;
  punkte: AblaufPunkt[];
  onDoc: (doc: RundownDoc) => void;
}) {
  const cap = capAction(action.role, action.verb);
  // 6.2: Vorschau mit der Nummer, die jetzt gesendet würde; null = Ziel entfallen.
  const sendArgs = sendeArgs(action, (x) => loeseSprungZiel(x, sicht.ablaufSchluessel, sicht.eigeneTimerListe));
  const line = sendArgs ? buildActionLine(action.role, action.verb, sendArgs) : null;
  // 6.2: Für `timer goto` die Ablaufpunkte zur Auswahl — nicht bei eigener Timer-Liste.
  const sprungAuswahl = istSprung(action) && !sicht.eigeneTimerListe && (punkte.length > 0 || !!action.zielId);
  const handNr = Number(action.args[0]);
  const handPunkt = Number.isInteger(handNr) ? punkte[handNr - 1] : undefined;
```

- [ ] **Schritt 22: `RowEditor.tsx`: Test-Knopf per `rowId`/`actionId` (6.2).**

Datei `apps/rundown/src/renderer/src/components/RowEditor.tsx` (Zeile 112).

Vorher:
```tsx
    const ok = await window.jmrundown.fireAction(action.role, action.verb, action.args);
```
Nachher:
```tsx
    // 6.2: Der Main sucht die Aktion über ihre Kennung und löst auf wie beim GO.
    const ok = await window.jmrundown.fireAction(rowId, action.id);
```

- [ ] **Schritt 23: `RowEditor.tsx`: Rolle/Verb wechseln löscht `zielId`; `waehleZiel` schreibt `zielId` und Nummer (6.2).**

Datei `apps/rundown/src/renderer/src/components/RowEditor.tsx` (Zeilen 119–123).

Vorher:
```tsx
    onDoc(updateAction(doc, rowId, action.id, { role, verb, args: defaultArgs(role, verb) }));
  }
  function setVerb(verb: string): void {
    onDoc(updateAction(doc, rowId, action.id, { verb, args: defaultArgs(action.role, verb) }));
  }
```
Nachher:
```tsx
    onDoc(updateAction(doc, rowId, action.id, { role, verb, args: defaultArgs(role, verb), zielId: undefined }));
  }
  function setVerb(verb: string): void {
    onDoc(updateAction(doc, rowId, action.id, { verb, args: defaultArgs(action.role, verb), zielId: undefined }));
  }
  /** 6.2: Eine Auswahl schreibt sofort zielId und die Nummer in args[0]; '' = Nummer von Hand. */
  function waehleZiel(id: string): void {
    if (!id) {
      onDoc(updateAction(doc, rowId, action.id, { zielId: undefined }));
      return;
    }
    const p = punkte.find((x) => x.id === id);
    if (p) onDoc(updateAction(doc, rowId, action.id, { zielId: p.id, args: [p.n, ...action.args.slice(1)] }));
  }
```

- [ ] **Schritt 24: `RowEditor.tsx`: Test-Knopf bei entfallenem Ziel gesperrt (6.2).**

Datei `apps/rundown/src/renderer/src/components/RowEditor.tsx` (Zeilen 165–171).

Vorher:
```tsx
          <button
            onClick={test}
            title="diese Aktion jetzt an das Tool senden"
            className="rounded border border-[var(--border)] px-1.5 py-0.5 text-xs text-[var(--foreground)] hover:bg-[var(--highlight)]"
          >
            Test
          </button>
```
Nachher:
```tsx
          <button
            onClick={test}
            disabled={!line}
            title={line ? 'diese Aktion jetzt an das Tool senden' : 'Ziel entfallen — wird nicht gesendet'}
            className="rounded border border-[var(--border)] px-1.5 py-0.5 text-xs text-[var(--foreground)] hover:bg-[var(--highlight)] disabled:opacity-40"
          >
            Test
          </button>
```

- [ ] **Schritt 25: `RowEditor.tsx`: Auswahl der Ablaufpunkte, „Nummer von Hand: <n> (<Titel>)“, „an diesen Punkt binden“; das Zahlenfeld nur ohne gebundenes Ziel (6.2).**

Datei `apps/rundown/src/renderer/src/components/RowEditor.tsx` (Zeile 229).

Vorher:
```tsx
      {!speakerPicker && !sideEventPicker && cap?.args && cap.args.length > 0 && (
```
Nachher:
```tsx
      {sprungAuswahl && (
        <div className="mt-2 space-y-1">
          <label className="text-xs text-[var(--muted-foreground)]">
            Ablaufpunkt (Timer springt dorthin)
            <select
              value={action.zielId ?? ''}
              onChange={(e) => waehleZiel(e.target.value)}
              className={`${input} mt-0.5`}
            >
              <option value="">Nummer von Hand</option>
              {punkte.map((p) => (
                <option key={p.id} value={p.id}>
                  {`${p.n} · ${p.label}`}
                </option>
              ))}
              {action.zielId && !punkte.some((p) => p.id === action.zielId) && (
                <option value={action.zielId}>Ziel entfallen</option>
              )}
            </select>
          </label>
          {!action.zielId && (
            <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
              <span>
                {`Nummer von Hand: ${String(action.args[0] ?? '')}`}
                {handPunkt ? ` (${handPunkt.label})` : ''}
              </span>
              {handPunkt && (
                <button
                  onClick={() => waehleZiel(handPunkt.id)}
                  className="ml-auto rounded border border-[var(--border)] px-1.5 py-0.5 text-xs text-[var(--foreground)] hover:bg-[var(--highlight)]"
                >
                  an diesen Punkt binden
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {!speakerPicker && !sideEventPicker && !(sprungAuswahl && action.zielId) && cap?.args && cap.args.length > 0 && (
```

- [ ] **Schritt 26: `RowEditor.tsx`: Vorschau zeigt „Ziel entfallen“ (6.2).**

Datei `apps/rundown/src/renderer/src/components/RowEditor.tsx` (Zeile 303).

Vorher:
```tsx
          {delayMs > 0 && <span className="text-[var(--muted-foreground)]">+{delayMs} ms </span>}→ {line}
```
Nachher:
```tsx
          {delayMs > 0 && <span className="text-[var(--muted-foreground)]">+{delayMs} ms </span>}→{' '}
          {line ?? <span className="text-[var(--warning)]">Ziel entfallen</span>}
```

- [ ] **Schritt 27: `RundownList.tsx`: Importe.**

Datei `apps/rundown/src/renderer/src/components/RundownList.tsx` (Zeilen 1–2).

Vorher:
```tsx
import { useState } from 'react';
import { actionLabel } from '@/lib/capabilities';
```
Nachher:
```tsx
import { useState } from 'react';
import { loeseSprungZiel } from '@shared/sprung';
import { sendeArgs, sperrenFuer, zeilenArt, zeilenHinweis, type ShowSicht } from '@shared/zeilen';
import { actionLabel } from '@/lib/capabilities';
```

- [ ] **Schritt 28: `RundownList.tsx`: neue Eigenschaft `sicht`.**

Datei `apps/rundown/src/renderer/src/components/RundownList.tsx` (Zeilen 15–24).

Vorher:
```tsx
  onSetCue,
  onDoc,
}: {
  doc: RundownDoc;
  index: number;
  selectedId: string | null;
  onSelect: (rowId: string) => void;
  onSetCue: (rowIndex: number) => void;
  onDoc: (doc: RundownDoc) => void;
}) {
```
Nachher:
```tsx
  onSetCue,
  onDoc,
  sicht,
}: {
  doc: RundownDoc;
  index: number;
  selectedId: string | null;
  onSelect: (rowId: string) => void;
  onSetCue: (rowIndex: number) => void;
  onDoc: (doc: RundownDoc) => void;
  /** Gemerkte Show: Sperren (4.5) und aufgelöste Sprung-Nummern (6.2). */
  sicht: ShowSicht;
}) {
```

- [ ] **Schritt 29: `RundownList.tsx`: Sperren je Zeile; gesperrte Zeilen sind nicht ziehbar (4.5).**

Datei `apps/rundown/src/renderer/src/components/RundownList.tsx` (Zeilen 46–54).

Vorher:
```tsx
          const isDropTarget = overIdx === i && dragIdx !== null && dragIdx !== i;
          return (
            <div
              key={row.id}
              draggable
              onDragStart={(e) => {
                setDragIdx(i);
                e.dataTransfer.effectAllowed = 'move';
              }}
```
Nachher:
```tsx
          const isDropTarget = overIdx === i && dragIdx !== null && dragIdx !== i;
          // 4.5: Ablaufzeilen (lebend oder entfallen) sind bei gemerkter Show nicht verschiebbar.
          const sperre = sperrenFuer(row, sicht.showGemerkt);
          const art = zeilenArt(row);
          const hinweis = zeilenHinweis(row, sicht.showGemerkt, sicht.mitIveo);
          return (
            <div
              key={row.id}
              draggable={!sperre.verschieben}
              onDragStart={(e) => {
                if (sperre.verschieben) return;
                setDragIdx(i);
                e.dataTransfer.effectAllowed = 'move';
              }}
```

- [ ] **Schritt 30: `RundownList.tsx`: Zeiger-Cursor für gesperrte, entfallene Zeilen gedimmt.**

Datei `apps/rundown/src/renderer/src/components/RundownList.tsx` (Zeile 67).

Vorher:
```tsx
              className={`cursor-grab rounded-lg border px-3 py-2 active:cursor-grabbing ${
```
Nachher:
```tsx
              className={`${sperre.verschieben ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'} rounded-lg border px-3 py-2 ${
                art === 'entfallen' ? 'opacity-60' : ''
              } ${
```

- [ ] **Schritt 31: `RundownList.tsx`: Griff nur bei verschiebbaren Zeilen, entfallene durchgestrichen, Hinweis-Marke („iveo“/„Show“ mit vollem Hinweis als Tooltip, bei entfallenen der Hinweis selbst).**

Datei `apps/rundown/src/renderer/src/components/RundownList.tsx` (Zeilen 74–78).

Vorher:
```tsx
                <span className="select-none text-xs text-[var(--muted-foreground)]" title="ziehen zum Umsortieren">
                  ⠿
                </span>
                <span className="tabular w-6 text-right text-xs text-[var(--muted-foreground)]">{i + 1}</span>
                <span className="font-medium">{row.label}</span>
```
Nachher:
```tsx
                <span
                  className={`select-none text-xs text-[var(--muted-foreground)] ${sperre.verschieben ? 'invisible' : ''}`}
                  title="ziehen zum Umsortieren"
                >
                  ⠿
                </span>
                <span className="tabular w-6 text-right text-xs text-[var(--muted-foreground)]">{i + 1}</span>
                <span className={`font-medium ${art === 'entfallen' ? 'line-through' : ''}`}>{row.label}</span>
                {hinweis && (
                  <span
                    className={`rounded px-1.5 text-[10px] ${
                      art === 'entfallen' ? 'text-[var(--warning)]' : 'text-[var(--muted-foreground)]'
                    }`}
                    title={hinweis}
                  >
                    {art === 'entfallen' ? hinweis : sicht.mitIveo ? 'iveo' : 'Show'}
                  </span>
                )}
```

- [ ] **Schritt 32: `RundownList.tsx`: ↑/↓ bei gesperrten Zeilen aus.**

Datei `apps/rundown/src/renderer/src/components/RundownList.tsx` (Zeilen 98–117).

Vorher:
```tsx
                  <button
                    title="nach oben"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDoc(moveRow(doc, i, i - 1));
                    }}
                    className={iconBtn}
                  >
                    ↑
                  </button>
                  <button
                    title="nach unten"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDoc(moveRow(doc, i, i + 1));
                    }}
                    className={iconBtn}
                  >
                    ↓
                  </button>
```
Nachher:
```tsx
                  <button
                    title={sperre.verschieben ? (hinweis ?? 'nach oben') : 'nach oben'}
                    disabled={sperre.verschieben}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDoc(moveRow(doc, i, i - 1));
                    }}
                    className={`${iconBtn} disabled:opacity-30`}
                  >
                    ↑
                  </button>
                  <button
                    title={sperre.verschieben ? (hinweis ?? 'nach unten') : 'nach unten'}
                    disabled={sperre.verschieben}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDoc(moveRow(doc, i, i + 1));
                    }}
                    className={`${iconBtn} disabled:opacity-30`}
                  >
                    ↓
                  </button>
```

- [ ] **Schritt 33: `RundownList.tsx`: Löschen bei lebenden Ablaufzeilen aus (4.5).**

Datei `apps/rundown/src/renderer/src/components/RundownList.tsx` (Zeilen 128–135).

Vorher:
```tsx
                  <button
                    title="Zeile löschen"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDoc(removeRow(doc, row.id));
                    }}
                    className={iconBtn}
                  >
```
Nachher:
```tsx
                  <button
                    title={sperre.loeschen ? (hinweis ?? 'Zeile löschen') : 'Zeile löschen'}
                    disabled={sperre.loeschen}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDoc(removeRow(doc, row.id));
                    }}
                    className={`${iconBtn} disabled:opacity-30`}
                  >
```

- [ ] **Schritt 34: `RundownList.tsx`: Aktions-Chip mit aufgelöster Nummer bzw. „Ziel entfallen“ (6.2).**

Datei `apps/rundown/src/renderer/src/components/RundownList.tsx` (Zeile 156).

Vorher:
```tsx
                      {actionLabel(a.role, a.verb, a.args)}
```
Nachher:
```tsx
                      {actionLabel(
                        a.role,
                        a.verb,
                        sendeArgs(a, (x) => loeseSprungZiel(x, sicht.ablaufSchluessel, sicht.eigeneTimerListe)) ?? [
                          'Ziel entfallen',
                        ],
                      )}
```

- [ ] **Schritt 35: `App.tsx`: Importe.**

Datei `apps/rundown/src/renderer/src/App.tsx` (Zeile 4).

Vorher:
```tsx
import { applyImportedRows, rowsFromImport } from '@/lib/doc';
```
Nachher:
```tsx
import { applyImportedRows, rowsFromImport } from '@/lib/doc';
import { zeilenArt, type ShowSicht } from '@shared/zeilen';
import type { RundownDoc } from '@shared/types';
```

- [ ] **Schritt 36: `App.tsx`: `hinweisWeg` und `alsEigeneZeile` aus dem Store.**

Datei `apps/rundown/src/renderer/src/App.tsx` (Zeile 15).

Vorher:
```tsx
  const { state, load, nav, setDoc, newDoc, open, save, saveAs, setEndpoint } = useRundown();
```
Nachher:
```tsx
  const { state, load, nav, setDoc, newDoc, open, save, saveAs, setEndpoint, hinweisWeg, alsEigeneZeile } =
    useRundown();
```

- [ ] **Schritt 37: `App.tsx`: `sicht` und `aendere` (jede Bearbeitung mit `state.rev`, 5.5).**

Datei `apps/rundown/src/renderer/src/App.tsx` (Zeilen 56–57).

Vorher:
```tsx
  const selectedRow =
    state.doc.rows.find((r) => r.id === selectedId) ?? state.doc.rows[state.index] ?? null;
```
Nachher:
```tsx
  const selectedRow =
    state.doc.rows.find((r) => r.id === selectedId) ?? state.doc.rows[state.index] ?? null;
  // Was Liste und Editor über die gemerkte Show wissen (4.5, 6.2).
  const sicht: ShowSicht = {
    showGemerkt: state.showGemerkt,
    mitIveo: state.showMitIveo,
    ablaufSchluessel: state.ablaufSchluessel,
    eigeneTimerListe: state.eigeneTimerListe,
  };
  // 5.5: Jede Bearbeitung trägt den rev des Stands, aus dem sie berechnet wurde.
  // Nach einer Abweisung baut `state.abweisungen` im Schlüssel des Editors die
  // ungesteuerten Felder neu auf, damit sie den gespeicherten Stand zeigen.
  const aendere = (d: RundownDoc): void => void setDoc(d, state.rev);
```

- [ ] **Schritt 38: `App.tsx`: Regieplan-Import „Ersetzen“ mit gemerkter Show nur für eigene Zeilen (4.5).**

Datei `apps/rundown/src/renderer/src/App.tsx` (Zeilen 70–77).

Vorher:
```tsx
      const replace =
        state.doc.rows.length === 0
          ? true
          : window.confirm(
              `${rows.length} Regieplan-Punkte aus „${file.name}" gefunden.\n\n` +
                'OK = aktuellen Ablauf ERSETZEN\nAbbrechen = anhängen',
            );
      await setDoc(applyImportedRows(state.doc, rows, replace));
```
Nachher:
```tsx
      // 4.5: Mit gemerkter Show ersetzt „Ersetzen“ nur die eigenen Zeilen.
      const ersetzbar = state.showGemerkt
        ? state.doc.rows.filter((r) => zeilenArt(r) === 'eigen').length
        : state.doc.rows.length;
      const replace =
        ersetzbar === 0
          ? true
          : window.confirm(
              `${rows.length} Regieplan-Punkte aus „${file.name}" gefunden.\n\n` +
                (state.showGemerkt
                  ? 'OK = eigene Zeilen ERSETZEN (Zeilen aus der Show bleiben)\n'
                  : 'OK = aktuellen Ablauf ERSETZEN\n') +
                'Abbrechen = anhängen',
            );
      await setDoc(applyImportedRows(state.doc, rows, replace, state.showGemerkt), state.rev);
```

- [ ] **Schritt 39: `App.tsx`: Namensfeld mit `basisRev` und Abweisungszähler im Schlüssel.**

Datei `apps/rundown/src/renderer/src/App.tsx` (Zeilen 103–105).

Vorher:
```tsx
          key={`${state.doc.name}|${state.filePath ?? ''}`}
          defaultValue={state.doc.name}
          onBlur={(e) => void setDoc({ ...state.doc, name: e.target.value })}
```
Nachher:
```tsx
          key={`${state.doc.name}|${state.filePath ?? ''}|${state.abweisungen}`}
          defaultValue={state.doc.name}
          onBlur={(e) => aendere({ ...state.doc, name: e.target.value })}
```

- [ ] **Schritt 40: `App.tsx`: Hinweis-Leiste unter dem Kopf (4.6).**

Datei `apps/rundown/src/renderer/src/App.tsx` (Zeile 140).

Vorher:
```tsx
      <ToolLinks links={state.links} onOpenConnections={() => setShowConnections(true)} />
```
Nachher:
```tsx
      <ToolLinks links={state.links} onOpenConnections={() => setShowConnections(true)} />

      {state.hinweise.length > 0 && (
        // 4.6: Kurze Hinweise entfernt der Main nach 6 s, stehende klickt der Bediener weg.
        <div className="space-y-1 border-b border-[var(--border)] px-4 py-1.5">
          {state.hinweise.map((h) => (
            <div
              key={h.id}
              className={`flex items-center gap-2 text-xs ${
                h.art === 'stehend' ? 'text-[var(--warning)]' : 'text-[var(--muted-foreground)]'
              }`}
            >
              <span className="min-w-0 flex-1">{h.text}</span>
              {h.art === 'stehend' && (
                <button
                  onClick={() => void hinweisWeg(h.id)}
                  title="Hinweis schließen"
                  className="rounded px-1.5 py-0.5 text-xs hover:bg-[var(--highlight)]"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}
```

- [ ] **Schritt 41: `App.tsx`: Liste und Editor bekommen `sicht`, `aendere`, den Schlüssel mit `abweisungen` und `onAlsEigeneZeile`.**

Datei `apps/rundown/src/renderer/src/App.tsx` (Zeilen 149–161).

Vorher:
```tsx
            onSetCue={(i) => void nav({ t: 'goto', n: i + 1 })}
            onDoc={(d) => void setDoc(d)}
          />
        </div>
        <div className="w-[26rem] shrink-0">
          {selectedRow ? (
            <RowEditor
              doc={state.doc}
              row={selectedRow}
              iveoSpeakers={state.iveoSpeakers ?? []}
              iveoSideEvents={state.iveoSideEvents ?? []}
              onDoc={(d) => void setDoc(d)}
            />
```
Nachher:
```tsx
            onSetCue={(i) => void nav({ t: 'goto', n: i + 1 })}
            onDoc={aendere}
            sicht={sicht}
          />
        </div>
        <div className="w-[26rem] shrink-0">
          {selectedRow ? (
            <RowEditor
              key={`${selectedRow.id}:${state.abweisungen}`}
              doc={state.doc}
              row={selectedRow}
              iveoSpeakers={state.iveoSpeakers ?? []}
              iveoSideEvents={state.iveoSideEvents ?? []}
              sicht={sicht}
              onDoc={aendere}
              onAlsEigeneZeile={(rowId) => void alsEigeneZeile(rowId)}
            />
```

- [ ] **Schritt 42: Typecheck.**

```bash
npm run typecheck -w @jm/rundown
```
Erwartet: `typecheck:node` (Preload gegen `JmRundownApi`) und `typecheck:web` (Renderer) ohne Ausgabe von `tsc`, Exit-Code 0.

- [ ] **Schritt 43: Build.**

```bash
npm run build -w @jm/rundown
```
Erwartet: drei Zeilen `✓ built in …`, keine Zeile mit `error`, Exit-Code 0. Ab jetzt passen Main und Preload wieder zusammen (siehe A10 „Zwischenstand“).

- [ ] **Schritt 44: Selbsttest erneut.**

```bash
npm run selftest -w @jm/rundown
```
Erwartet: wie Schritt 6.

- [ ] **Schritt 45: Commit.**

```bash
git add apps/rundown/src/shared/zeilen.ts apps/rundown/src/shared/types.ts apps/rundown/src/preload/index.ts apps/rundown/src/renderer/src/store/useRundown.ts apps/rundown/src/renderer/src/lib/doc.ts apps/rundown/src/renderer/src/components/RowEditor.tsx apps/rundown/src/renderer/src/components/RundownList.tsx apps/rundown/src/renderer/src/App.tsx apps/rundown/test/selftest.ts
git status --short
git commit -m "feat(rundown): Ablaufzeilen gesperrt, Hinweise, Abweisung und Sprung-Auswahl im Editor" -m "Ablaufzeilen aus der Show sind bei gemerkter Show gesperrt (gesteuerte Felder, nicht verschieb- oder löschbar), entfallene tragen ihren Hinweis und den Knopf Als eigene Zeile behalten. Hinweise aus dem Main erscheinen unter dem Kopf, stehende lassen sich wegklicken. Bearbeitungen schicken basisRev; nach einer Abweisung baut der Editor seine Felder neu auf. timer goto wählt den Ablaufpunkt über die Kennung, Chip und Vorschau zeigen die aufgelöste Nummer, der Test-Knopf geht per rowId/actionId (Spec 4.5, 4.6, 5.5, 6.2)." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
`git status --short` vor dem Commit lesen: gestagt (`M`) sind genau die neun genannten Dateien. Nicht pushen.

**Abweichungen vom Gerüst:**
1. **`jmrundown.d.ts` bleibt unverändert** — es typisiert `window.jmrundown` als `JmRundownApi`; die neuen Signaturen kommen aus `types.ts`.
2. **Testbare Logik in `src/shared/zeilen.ts`** statt in `lib/doc.ts` (dort hängt `newId` zur Laufzeit am Alias, Gerüst: „sonst Logik nach shared verschieben“). `lib/doc.ts` delegiert `duplicateRow` an `dupliziereZeile` und `applyImportedRows` an `ersetzeEigeneZeilen` (A7). `zeilen.ts` hat einen eigenen, privaten `ohneHerkunft` (gleich `alsEigeneZeile` aus A7 ohne neue id), weil es nach G2 nicht zur Laufzeit aus `scharf.ts` importieren darf.
3. **`ShowSicht`** bündelt, was Liste und Editor aus `RundownState` brauchen (`showGemerkt`, `mitIveo` = `state.showMitIveo`, `ablaufSchluessel`, `eigeneTimerListe`).
4. **Abweisungszähler im Schlüssel des ganzen `RowEditor`** (`key={`${selectedRow.id}:${state.abweisungen}`}`) und des Namensfelds; das baut alle ungesteuerten Felder auf einmal neu auf (5.5), statt jeden Feld-Schlüssel einzeln zu ändern.
5. **Notiz:** Der Editor hatte kein Notizfeld; bei gesperrten Zeilen wird die Notiz aus der Show jetzt als Text gezeigt (der Abgleich ändert sie).
6. **Liste:** Gesperrte Zeilen sind nicht ziehbar (Griff unsichtbar), ↑/↓ aus; Löschen nur bei lebenden Ablaufzeilen aus. Lebende Ablaufzeilen tragen eine kleine Marke „iveo“ bzw. „Show“ mit dem vollen Hinweis als Tooltip; entfallene sind gedimmt, durchgestrichen und zeigen „in iveo entfallen“ bzw. „in der Show entfallen“.
7. **Neue Oberflächentexte, die nicht in 4.6 stehen** (keine Hinweise im Sinne von 4.6): Bestätigungsdialog beim Import mit gemerkter Show „OK = eigene Zeilen ERSETZEN (Zeilen aus der Show bleiben)“, Feldbeschriftung „Ablaufpunkt (Timer springt dorthin)“, Tooltip „Ziel entfallen — wird nicht gesendet“, Tooltip „Hinweis schließen“.
8. **Sprung-Auswahl:** sichtbar bei `timer goto`, wenn die Show Ablaufpunkte hat oder die Aktion schon gebunden ist (dann auch ohne Show, damit man sie auf „Nummer von Hand“ zurückstellen kann); nicht bei eigener Timer-Liste (dort das Zahlenfeld wie bisher, 6.2). Ist die gebundene `zielId` nicht mehr im Ablauf, steht die Option „Ziel entfallen“ da. „an diesen Punkt binden“ erscheint nur, wenn es an Stelle n einen Punkt gibt. Rolle oder Verb wechseln löscht `zielId`.
9. **Test-Knopf** ist bei entfallenem Ziel gesperrt; der Main sendet in dem Fall ohnehin nichts (A10).

---

### Aufgabe A12: Launcher – Show atomar schreiben (`show-schreiben.ts`)

**Spec:** 7.0 (neu `src/main/show-schreiben.ts`, ohne Electron), 7.4 (Show sicher schreiben), 9.6 Nr. 11, 9.7 (neues Skript `selftest:iveo`). Globale Regeln G4, G6, G7, G8, G9.

**Dateien:**
- Create: `apps/launcher/src/main/show-schreiben.ts`
- Create: `apps/launcher/test/iveo-abgleich.test.ts` (A13 und A14 erweitern diese Datei; Einfügemarke ist die Zeile `// --- Zusammenfassung ---`)
- Modify: `apps/launcher/package.json`, Zeile 19 (`"selftest:verbund": …`), eine Zeile dahinter einfügen

**Schnittstellen:**
- Consumes (besteht seit Teil 1, unverändert): `export function fehlerCode(e: unknown): string` aus `apps/launcher/src/main/verbund/fehlercode.ts` — liefert nur den Code (`EPERM`, `EBUSY` …), ohne Code `'UNBEKANNT'`, nie den Fehlertext.
- Produces (exakt wie im Gerüst):
  ```ts
  export interface DateiSystem { writeFileSync(p: string, d: string, enc: 'utf8'): void; renameSync(a: string, b: string): void; unlinkSync(p: string): void; }
  export function schreibeShowAtomar(pfad: string, inhalt: string, fs: DateiSystem, warte: (ms: number) => void, log: (m: string) => void): boolean;
  ```
  zusätzlich (für die Hülle in A15):
  ```ts
  /** Synchrones Warten für die Produktion (Atomics.wait auf einem SharedArrayBuffer). */
  export function warteSync(ms: number): void;
  ```
- Skript: `"selftest:iveo": "tsx test/iveo-abgleich.test.ts"` in `apps/launcher/package.json`.

**Verhalten (Spec 7.4, verbindlich):**
- `schreibeShowAtomar` schreibt `inhalt` in eine Zwischendatei im **selben Ordner** (`<pfad>.<pid>.tmp`) und benennt sie dann auf `pfad` um. Rückgabe `true` oder `false`.
- Scheitert das Umbenennen mit `EPERM`, `EBUSY` oder `EACCES`, gibt es **bis zu 5 Versuche** im Abstand von **50 ms**, **synchron** (`warte(50)` zwischen den Versuchen, also höchstens 4 Pausen).
- Scheitert alles, ein anderer Fehlercode oder schon das Anlegen der Zwischendatei: **eine** Warnung über `log` (nur der Fehlercode, nie Pfad oder Inhalt, G6), Zwischendatei löschen, `false`. Das Original bleibt unberührt.
- Kein `electron`-Import (G4). Synchron ist Absicht: Der Kern (A13) prüft „active === a && generation === gen“ und schreibt danach ohne `await` dazwischen (Spec 7.3).

- [ ] **Schritt 1: Fehlschlagenden Test schreiben**

Neue Datei `apps/launcher/test/iveo-abgleich.test.ts` mit genau diesem Inhalt (Prüfhilfe `ck` wie in `test/verbund.test.ts`):

```ts
// iveo-Abgleich des Launchers OHNE Electron (tsx): npm run selftest:iveo -w @jm/launcher
// Master-Link Teil 2a, Spec 7 und 9.6: atomares Schreiben der Show (show-schreiben.ts) und der Abgleich-Kern
// (iveo-abgleich-kern.ts) mit nachgebautem iveo-Client — ohne Netz, ohne Fenster.
import { mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { schreibeShowAtomar, warteSync, type DateiSystem } from '../src/main/show-schreiben';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}

// --- schreibeShow: Zwischendatei + Umbenennen, Wiederholung bei Sperre (Spec 7.4, 9.6 Nr. 11) -----------------
{
  const PFAD = 'C:/Shows/Tag1.jmshow';
  const gesperrt = (code: string): Error => Object.assign(new Error(`${code}: Datei gesperrt`), { code });
  /** Nachgebautes fs: Dateien im Speicher. `umbenennen` gibt je Versuch einen Fehlercode vor, null = gelingt. */
  function nachgebautesFs(umbenennen: Array<string | null>, anlegeFehler: string | null = null) {
    const dateien = new Map<string, string>([[PFAD, 'ALT']]);
    const aufrufe: string[] = [];
    let versuch = 0;
    const fs: DateiSystem = {
      writeFileSync(p, inhalt) {
        aufrufe.push(`schreibe ${p}`);
        if (anlegeFehler) throw gesperrt(anlegeFehler);
        dateien.set(p, inhalt);
      },
      renameSync(von, nach) {
        aufrufe.push(`benenne ${von}`);
        const f = umbenennen[versuch++] ?? null;
        if (f) throw gesperrt(f);
        dateien.set(nach, dateien.get(von)!);
        dateien.delete(von);
      },
      unlinkSync(p) {
        aufrufe.push(`loesche ${p}`);
        if (!dateien.delete(p)) throw gesperrt('ENOENT');
      },
    };
    return { fs, dateien, aufrufe, versuche: () => aufrufe.filter((a) => a.startsWith('benenne')).length };
  }
  const pausen: number[] = [];
  const warte = (ms: number): void => { pausen.push(ms); };
  const logZeilen: string[] = [];
  const log = (m: string): void => { logZeilen.push(m); };

  const zwei = nachgebautesFs(['EBUSY', 'EBUSY', null]);
  ck('Nr. 11: Umbenennen scheitert zweimal mit EBUSY → der dritte Versuch gelingt', schreibeShowAtomar(PFAD, 'NEU', zwei.fs, warte, log) === true);
  ck('Nr. 11: … drei Versuche, dazwischen zweimal 50 ms', zwei.versuche() === 3 && JSON.stringify(pausen) === '[50,50]');
  ck('Nr. 11: … die Show trägt den neuen Inhalt, keine Zwischendatei bleibt liegen', zwei.dateien.get(PFAD) === 'NEU' && zwei.dateien.size === 1);
  ck('Nr. 11: … kein Logeintrag', logZeilen.length === 0);
  const zwischen = zwei.aufrufe[0].slice('schreibe '.length);
  ck('Zwischendatei liegt im selben Ordner wie die Show und ist nicht die Show', dirname(zwischen) === dirname(PFAD) && zwischen !== PFAD);

  pausen.length = 0;
  const immer = nachgebautesFs(['EBUSY', 'EBUSY', 'EBUSY', 'EBUSY', 'EBUSY', 'EBUSY']);
  ck('Nr. 11: scheitert es immer → false', schreibeShowAtomar(PFAD, 'NEU', immer.fs, warte, log) === false);
  ck('Nr. 11: … genau 5 Versuche, 4 Pausen à 50 ms', immer.versuche() === 5 && JSON.stringify(pausen) === '[50,50,50,50]');
  ck('Nr. 11: … Zwischendatei gelöscht, Original unverändert',
    immer.aufrufe.includes(`loesche ${zwischen}`) && immer.dateien.get(PFAD) === 'ALT' && immer.dateien.size === 1);
  ck('Nr. 11: … eine Warnung mit dem Code, ohne Inhalt und ohne Pfad',
    logZeilen.length === 1 && logZeilen[0].includes('EBUSY') && !logZeilen[0].includes('NEU') && !logZeilen[0].includes(PFAD));

  pausen.length = 0;
  const andere = nachgebautesFs(['EPERM', 'EACCES', null]);
  ck('EPERM und EACCES gelten ebenso als vorübergehend',
    schreibeShowAtomar(PFAD, 'NEU', andere.fs, warte, log) === true && andere.dateien.get(PFAD) === 'NEU' && pausen.length === 2);

  pausen.length = 0;
  logZeilen.length = 0;
  const fremd = nachgebautesFs(['EXDEV']);
  ck('anderer Fehler beim Umbenennen (EXDEV) → sofort false, ohne Pause',
    schreibeShowAtomar(PFAD, 'NEU', fremd.fs, warte, log) === false && fremd.versuche() === 1 && pausen.length === 0);
  ck('… Zwischendatei gelöscht, Original unverändert, eine Warnung',
    fremd.aufrufe.includes(`loesche ${zwischen}`) && fremd.dateien.get(PFAD) === 'ALT' && fremd.dateien.size === 1 && logZeilen.length === 1);

  logZeilen.length = 0;
  const voll = nachgebautesFs([], 'ENOSPC');
  ck('Zwischendatei nicht anlegbar (ENOSPC) → false, kein Umbenennen, Original unverändert',
    schreibeShowAtomar(PFAD, 'NEU', voll.fs, warte, log) === false && voll.versuche() === 0
    && voll.dateien.get(PFAD) === 'ALT' && logZeilen.length === 1 && logZeilen[0].includes('ENOSPC'));

  // Echtes Dateisystem: ein Durchlauf in einem Temp-Ordner (so verdrahtet die Hülle es in der Produktion).
  const ordner = mkdtempSync(join(tmpdir(), 'jmiveo-'));
  try {
    const datei = join(ordner, 'Tag 1.jmshow');
    writeFileSync(datei, 'ALT', 'utf8');
    const ok = schreibeShowAtomar(datei, 'NEU', { writeFileSync, renameSync, unlinkSync }, warteSync, log);
    ck('echtes fs: geschrieben, im Ordner liegt nur die Show',
      ok && readFileSync(datei, 'utf8') === 'NEU' && JSON.stringify(readdirSync(ordner)) === JSON.stringify(['Tag 1.jmshow']));
  } finally {
    rmSync(ordner, { recursive: true, force: true });
  }
  const t0 = Date.now();
  warteSync(30);
  ck('warteSync wartet synchron (30 ms)', Date.now() - t0 >= 25);
}

// --- Zusammenfassung ---
console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);
```

- [ ] **Schritt 2: Testskript eintragen**

In `apps/launcher/package.json` (Zeile 19). Die Datei hat im Arbeitsbaum CRLF-Zeilenenden (`core.autocrlf=true`): mit dem Edit-Werkzeug ersetzen (wortgleicher Vorher-Text), nicht mit `sed`.

Vorher:
```json
    "selftest:verbund": "tsx test/verbund.test.ts",
```

Nachher:
```json
    "selftest:verbund": "tsx test/verbund.test.ts",
    "selftest:iveo": "tsx test/iveo-abgleich.test.ts",
```

- [ ] **Schritt 3: Test laufen lassen (rot)**

```
npm run selftest:iveo -w @jm/launcher
```

Erwartet: Abbruch vor dem ersten Fall, Exit-Code ≠ 0, mit
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…\apps\launcher\src\main\show-schreiben' imported from …\apps\launcher\test\iveo-abgleich.test.ts
```

- [ ] **Schritt 4: Implementierung**

Neue Datei `apps/launcher/src/main/show-schreiben.ts` mit genau diesem Inhalt:

```ts
// ─────────────────────────────────────────────────────────────────────────────
// Show-Datei sicher schreiben (Master-Link Teil 2a, Spec 7.4) — OHNE Electron, per tsx getestet
// (test/iveo-abgleich.test.ts). Die fs-Funktionen und das Warten kommen von außen.
//
// Zwischendatei im selben Ordner, dann umbenennen: Ein Tool, das die Show gerade liest, sieht nie eine halbe
// Datei. Unter Windows scheitert das Umbenennen, solange ein Tool die Show offen hat (EPERM/EBUSY/EACCES) →
// bis zu 5 Versuche im Abstand von 50 ms, SYNCHRON. Synchron ist Absicht: Der iveo-Kern prüft „active === a &&
// generation === gen“ und schreibt danach ohne await dazwischen (Spec 7.3).
// ─────────────────────────────────────────────────────────────────────────────

import { fehlerCode } from './verbund/fehlercode';

/** Die drei fs-Funktionen, die das Schreiben braucht. In der Produktion node:fs, im Test nachgebaut. */
export interface DateiSystem {
  writeFileSync(p: string, d: string, enc: 'utf8'): void;
  renameSync(a: string, b: string): void;
  unlinkSync(p: string): void;
}

/** Vorübergehende Sperren unter Windows (Tool liest gerade, Virenscanner, Indexer). */
const WIEDERHOLBAR = new Set(['EPERM', 'EBUSY', 'EACCES']);
const VERSUCHE = 5;
const PAUSE_MS = 50;

/** Synchrones Warten für die Produktion (blockiert den Main-Prozess höchstens 4 × 50 ms je Schreiben). */
export function warteSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Schreibt `inhalt` atomar nach `pfad`. `true` = die Datei trägt jetzt den neuen Inhalt. `false` = nichts
 * geändert: Warnung im Log (nur der Fehlercode, nie Pfad oder Inhalt), Zwischendatei gelöscht, Original unberührt.
 */
export function schreibeShowAtomar(
  pfad: string,
  inhalt: string,
  fs: DateiSystem,
  warte: (ms: number) => void,
  log: (m: string) => void,
): boolean {
  // Synchron, deshalb überschneiden sich zwei Schreibvorgänge desselben Prozesses nie: die PID genügt als Name.
  const zwischen = `${pfad}.${process.pid}.tmp`;
  const verwerfen = (): void => {
    try {
      fs.unlinkSync(zwischen);
    } catch {
      /* Zwischendatei gibt es nicht (mehr) */
    }
  };
  try {
    fs.writeFileSync(zwischen, inhalt, 'utf8');
  } catch (e) {
    verwerfen();
    log(`Show nicht geschrieben (${fehlerCode(e)}): Zwischendatei nicht anlegbar, Original unverändert.`);
    return false;
  }
  for (let versuch = 1; ; versuch++) {
    try {
      fs.renameSync(zwischen, pfad);
      return true;
    } catch (e) {
      const code = fehlerCode(e);
      if (!WIEDERHOLBAR.has(code) || versuch >= VERSUCHE) {
        verwerfen();
        log(`Show nicht geschrieben (${code} nach ${versuch} Versuch${versuch === 1 ? '' : 'en'}), Original unverändert.`);
        return false;
      }
      warte(PAUSE_MS);
    }
  }
}
```

- [ ] **Schritt 5: Test laufen lassen (grün)**

```
npm run selftest:iveo -w @jm/launcher
```

Erwartet: 15 Zeilen `  ok  …`, keine `FAIL`-Zeile, letzte Zeile
```
15 ok, 0 fehlgeschlagen.
```
Exit-Code 0.

- [ ] **Schritt 6: Typecheck**

```
npm run typecheck -w @jm/launcher
```

Erwartet: `typecheck:node` und `typecheck:web` laufen ohne Fehlermeldung durch, Exit-Code 0. (Die Testdatei liegt außerhalb von `tsconfig.node.json` und wird nur von tsx ausgeführt, wie `test/verbund.test.ts`.)

- [ ] **Schritt 7: Commit**

```
git add apps/launcher/src/main/show-schreiben.ts apps/launcher/test/iveo-abgleich.test.ts apps/launcher/package.json
git status --short
```

`git status --short` muss genau diese drei Zeilen zeigen (sonst anhalten und prüfen, nichts weiter stagen):
```
M  apps/launcher/package.json
A  apps/launcher/src/main/show-schreiben.ts
A  apps/launcher/test/iveo-abgleich.test.ts
```

```
git commit -m "feat(launcher): Show atomar schreiben - Zwischendatei, Wiederholung bei EBUSY (Teil 2a, #235)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Nicht pushen (G7).

**Abweichungen vom Gerüst:**
- Zusätzlicher Export `warteSync(ms)`: Das Gerüst legt fest, dass `warte` in der Produktion `Atomics.wait` auf einem `SharedArrayBuffer` ist. Damit die Hülle (A15) das nicht selbst nachbaut, liegt es hier neben `schreibeShowAtomar` und ist mitgetestet. Verdrahtung in A15 (`writeFileSync`, `renameSync`, `unlinkSync` aus `node:fs`, `serializeShow` aus `@jm/show`):
  ```ts
  schreibeShow: (pfad, show) =>
    schreibeShowAtomar(pfad, serializeShow(show, new Date().toISOString()), { writeFileSync, renameSync, unlinkSync }, warteSync, (m) =>
      getLog().warn(`iveo: ${m}`),
    ),
  ```
- Das Skript `selftest:iveo` startet hier nur `tsx test/iveo-abgleich.test.ts`. Das Gerüst nennt für das Skript zusätzlich `tsx test/show-speichern.test.ts`; diese Datei entsteht erst in A16. A15 hängt `tsx test/iveo-huelle.test.ts` an, A16 danach `tsx test/show-speichern.test.ts`; Endstand: `"selftest:iveo": "tsx test/iveo-abgleich.test.ts && tsx test/iveo-huelle.test.ts && tsx test/show-speichern.test.ts"`. So ist das Skript nach jeder Aufgabe lauffähig.
- Name der Zwischendatei `<pfad>.<pid>.tmp` (ohne Zeitstempel): Das Schreiben ist synchron, zwei Schreibvorgänge desselben Prozesses überschneiden sich nie; die PID trennt Prozesse.

**Konsistenzprüfung:**
- Korrektur (nur Text, Abweichungen): Die Skript-Kette stimmt jetzt mit A15/A16 überein. A15 hängt `tsx test/iveo-huelle.test.ts` an, A16 `tsx test/show-speichern.test.ts`; vorher stand hier, A16 hänge `show-speichern` direkt an `iveo-abgleich`. Die Schritte dieser Aufgabe sind unverändert.
- `warteSync` wird ab A15 in der Hülle tatsächlich genutzt (dort korrigiert).

---

### Aufgabe A13: Launcher – Abgleich-Kern ohne Electron: Abfrage (Listen- und Agenda-Modus)

**Spec:** 0 Nr. 1 und Nr. 10, 7.0 (Kern und Hülle), 7.1 (Rundown benachrichtigen), 7.2 (Signatur, Merker erst nach erfolgreichem Schreiben), 7.3 (Generation, Abfragen nacheinander), 7.6 (Abfragefehler sichtbar); Tests 9.6 Nr. 1–7, 9, 10, 12. Globale Regeln G4, G5, G6, G7, G8, G9.

**Dateien:**
- Create: `apps/launcher/src/main/iveo-abgleich-kern.ts`
- Modify: `apps/launcher/test/iveo-abgleich.test.ts` (Stand nach A12): Zeilen 6–7 (Importe) und Zeilen 100–101 (Zusammenfassung; der neue Abschnitt kommt davor)

Zeilenangaben gelten für den Stand vor dieser Aufgabe; nach früheren Schritten derselben Aufgabe verschieben sie sich. Maßgeblich ist immer der wortgleiche Vorher-Text (Edit-Werkzeug).

**Schnittstellen:**
- Consumes:
  - A1 (`@jm/show`, `packages/show/src/index.ts`): `ShowAblaufItem` hat `id?: string`; `export function normalizeAblauf(value: unknown): ShowAblaufItem[];` (je Punkt wie `normalizeAblaufItem` inkl. `id`, danach doppelte `id` → `<id>#2`, `#3` …; Nicht-Array → `[]`).
  - A2 (`@jm/iveo`, `packages/iveo/src/mapper.ts`): `programToAblaufItem` setzt `id: p.id`, `agendaToAblauf` setzt `id: it.id`.
  - A12: `apps/launcher/test/iveo-abgleich.test.ts` mit Prüfhilfe `ck(name, cond)` und der Einfügemarke `// --- Zusammenfassung ---`.
  - Bestehend aus `@jm/iveo` (unverändert): `IveoClient` mit `listProgramsUpdatedSince(event, sinceIso)`, `getEventSnapshot(event, now, opts?)`, `listAgendaItems(event, programId)`, `getProgram(event, programId)`, `listSpeakers(event)`; `IveoApiError` (`status`, `code`, `isUnauthorized`, `isNotFoundOrOutOfScope`); `agendaToAblauf`, `buildShowMetadata`, `extractSpeakerIds`, `filterPrograms`, `localTimeOfDayMs`, `programDayKey`, `programToAblaufItem`, `programsToAblauf`, `snapshotToShowSpeakers`, `speakerName`; Typen `IveoProgram`, `IveoProgramFilter`, `IveoSnapshot`.
- Produces (exakt wie im Gerüst; `umschalten` und `offeneShowGespeichert` füllt A14):
  ```ts
  export type IveoClientLike = Pick<IveoClient, 'listProgramsUpdatedSince' | 'getEventSnapshot' | 'listAgendaItems' | 'getProgram' | 'listSpeakers'>;
  export interface IveoSyncStatus { ok: boolean; text?: string; seit?: string }
  export interface KernAbhaengigkeiten {
    clientFabrik(token: string, baseUrl: string): IveoClientLike;
    token(event: string): string | undefined;
    leseShow(pfad: string): Show | null;
    schreibeShow(pfad: string, show: Show): boolean; // serialisiert + A12, synchron
    benachrichtige(appId: 'jm-timer' | 'jm-titler' | 'jm-rundown', zeile: string): number;
    schreibeCache(meta: unknown): void;
    log: { info(m: string): void; warn(m: string): void };
    jetztIso(): string;
    meldeStatus(s: IveoSyncStatus): void;
    meldeAktiv(): void; // ersetzt emitActiveChanged
    baseUrlStandard(): string;
  }
  export function ablaufSignatur(ablauf: ShowAblaufItem[], speakers: ShowIveoSpeaker[]): string;
  export function erzeugeKern(d: KernAbhaengigkeiten): IveoKern;
  export interface IveoKern {
    showGeoeffnet(pfad: string, show: Show): void;
    showGeschlossen(): void;
    abfrage(): Promise<void>;
    umschalten(input: { programId?: string; day?: string }): Promise<{ ok: boolean; message: string }>; // A14
    offeneShowGespeichert(pfad: string, neuGebunden: boolean): void; // A14
    aktiv(): { path: string; event: string; filter: IveoProgramFilter } | null;
  }
  ```
  zusätzlich (aus `iveo-sync.ts` in den Kern gezogen, damit Binden und Discover in der Hülle sie importieren, A15):
  ```ts
  export function einPunktAblauf(programm: IveoProgram, namen?: Map<string, string>): ShowAblaufItem; // 1-Punkt-Ablauf ohne stagesById (7.2)
  export function compactFilter(f: IveoProgramFilter): NonNullable<Show['iveo']>['filter'] | undefined;
  export function speakerNameMap(speakers: Array<Parameters<typeof speakerName>[0]>): Map<string, string>;
  export function scheduleSafeForList(filter: IveoProgramFilter, programs: IveoProgram[]): boolean;
  export function toClientError(e: unknown): { code?: string; error: string };
  ```

**Verhalten (verbindlich, aus der Spec):**
- `showGeoeffnet(pfad, show)`: Generation + 1, Pfad der offenen Show merken (auch ohne iveo, für A14). Ohne `show.iveo.event`: kein Abgleich, Status ok. Mit Bindung, aber ohne Token: kein Abgleich, Status gestört mit „kein iveo-Token auf diesem Rechner, nur Offline-Ablauf“. Mit Token: `active` mit `baseUrl` (Bindung, sonst `baseUrlStandard()`), `lastSyncIso` (`syncedAt`, sonst jetzt), Kopie des Filters und **`lastSig` aus der Datei** (`ablaufSignatur(show.ablauf ?? [], show.iveo.speakers ?? [])`, Spec 7.2), Status ok. Danach immer `meldeAktiv()`.
- `ablaufSignatur` = `JSON.stringify` aus den Punkten nach `normalizeAblauf` in der festen Feldreihenfolge `id, label, durationMs, note, plannedStartMs, owner, category` und den Speakern (`name, title`).
- `abfrage()`: läuft schon eine, kehrt sie sofort zurück (7.3). Sie hält `a = active` und `gen = generation` fest und arbeitet nur mit `a`. Token fehlt → Status „kein iveo-Token …“, kein Abruf. Mit `filter.programId` Agenda-Modus, sonst Listen-Modus. Vor dem Schreiben `active === a && generation === gen`, danach ohne `await` lesen, vergleichen, schreiben.
- **Listen-Modus:** `listProgramsUpdatedSince(event, lastSyncIso)`; leer → Status ok, fertig. Sonst Snapshot (Programme essenziell), Ablauf wie bisher (`filterPrograms`, `programsToAblauf` mit `stagesById`, `scheduleSafeForList`, `speakerNameMap`), Speaker = alle, Cache schreiben. Signatur gleich → **nicht schreiben, kein RELOAD, `lastSyncIso` rückt trotzdem vor**. Sonst schreiben; erst nach `true` rücken `lastSig` und `lastSyncIso` vor, dann RELOAD.
- **Agenda-Modus:** `listAgendaItems` scheitert → Abbruch, nichts geschrieben, kein RELOAD (Spec 0 Nr. 1). Fehlt der Side-Event-Kontext, wird er über `getProgram` nachgeladen (Speakernamen über `listSpeakers` nur bei verknüpften ids, Fehler dort still); scheitert `getProgram` → Abbruch. Nur eine **erfolgreich leere** Agenda wird zum 1-Punkt-Ablauf `einPunktAblauf(detail, namen)` (ohne `stagesById`). Speaker und Name kommen aus der Datei. Signatur gleich → nicht schreiben, Kontext merken. Sonst schreiben; erst nach `true` rücken `lastSig` und Kontext vor, dann RELOAD.
- **Schreiben** (früher `rewriteShowAblauf`): Datei lesen (`leseShow`), `ablauf` ersetzen, `iveo` neu als `{ event, baseUrl, name, syncedAt, speakers?, sideEvents? (aus der Datei), filter? (compactFilter) }`, dann `schreibeShow`. Datei nicht lesbar → Status „Show-Datei nicht lesbar“; `schreibeShow` liefert `false` → Status „Show konnte nicht geschrieben werden“, kein RELOAD, Merker bleiben (die nächste Abfrage mit gleichem iveo-Stand schreibt erneut).
- **RELOAD (7.1):** `TIMER RELOAD` an `jm-timer`, `TITLER RELOAD` an `jm-titler`, `RUNDOWN RELOAD` an `jm-rundown`; Logzeile wortgleich `iveo: RELOAD → <n> Timer, <n> Titler, <n> Rundown benachrichtigt.`
- **Status (7.6):** jeder Fehlschlag einer Abfrage → `{ ok: false, text, seit }`, die erste erfolgreiche danach → `{ ok: true }`. `meldeStatus` nur bei einem Wechsel. HTTP 401 → „Token ungültig oder widerrufen“; sonst `toClientError(e).error`. Log: der erste Fehlschlag und jeder neue Fehlertext als Warnung `iveo-Abgleich gestört: <Text>`, gleichbleibende Wiederholungen nicht. Eine veraltete Abfrage (andere Show/Generation) setzt keinen Status.
- Das Token geht nur an `clientFabrik`, nie in Log, Status, Show oder Cache.

- [ ] **Schritt 1: Importe der Testdatei ergänzen**

In `apps/launcher/test/iveo-abgleich.test.ts` (Zeilen 6–7).

Vorher:
```ts
import { dirname, join } from 'node:path';
import { schreibeShowAtomar, warteSync, type DateiSystem } from '../src/main/show-schreiben';
```

Nachher:
```ts
import { dirname, join } from 'node:path';
import { parseShow, serializeShow, type Show, type ShowAblaufItem, type ShowIveoSpeaker } from '@jm/show';
import {
  IveoApiError,
  agendaToAblauf,
  filterPrograms,
  localTimeOfDayMs,
  programsToAblauf,
  type IveoAgendaItem,
  type IveoProgram,
  type IveoSnapshot,
  type IveoSpeaker,
  type IveoStage,
} from '@jm/iveo';
import {
  ablaufSignatur, einPunktAblauf, erzeugeKern, type IveoClientLike, type IveoKern, type IveoSyncStatus,
} from '../src/main/iveo-abgleich-kern';
import { schreibeShowAtomar, warteSync, type DateiSystem } from '../src/main/show-schreiben';
```

- [ ] **Schritt 2: Fehlschlagende Tests schreiben (Prüfstand + Fälle 9.6 Nr. 1–7, 9, 10, 12)**

In derselben Datei vor der Zusammenfassung (Zeilen 100–101) einfügen.

Vorher:
```ts
// --- Zusammenfassung ---
console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
```

Nachher:
```ts
// --- Abgleich-Kern: Prüfstand (nachgebautes iveo, Show-Dateien im Speicher) -------------------------------------
const EVENT = 'cop31';
const BASIS = 'https://iveo.test/api/v1';
const TOKEN = 'iveo_live_geheim';
const SHOW_PFAD = 'C:/Shows/COP31 Tag 1.jmshow';
const TAG = '2026-11-10';

type Abruf = 'geaendert' | 'snapshot' | 'agenda' | 'programm' | 'speakers';
/** Nachgebautes iveo: Daten, Fehler je Abruf, Sperren („Abfrage läuft gerade“) und Mitschrift der Abrufe. */
interface NachgebautesIveo {
  programme: IveoProgram[];
  agenda: Record<string, IveoAgendaItem[]>;
  speakers: IveoSpeaker[];
  stages: IveoStage[];
  /** Antwort auf ?updated_since= */
  geaendert: IveoProgram[];
  fehler: Partial<Record<Abruf, unknown>>;
  sperre: (abruf: Abruf, arg: string) => Promise<void> | null;
  abrufe: string[];
}

function programm(id: string, title: string, extra: Partial<IveoProgram> = {}): IveoProgram {
  return {
    id, event_id: 'ev-1', title, type_slug: 'side-event', duration_minutes: 60,
    starts_at: `${TAG}T09:00:00+00:00`, starts_at_local: `${TAG}T10:00:00`, ...extra,
  };
}
function punkt(programId: string, id: string, title: string, sort: number, minuten = 10): IveoAgendaItem {
  return { id, program_id: programId, sort_order: sort, title, duration_minutes: minuten };
}
/** P1 mit drei Agenda-Punkten, P2 mit zwei, P3 ohne Agenda (alle am 10.11.), P4 am 11.11. */
function neuesIveo(): NachgebautesIveo {
  return {
    programme: [
      programm('P1', 'Side Event Klima', { stage_id: 'S1', subtitle: 'Raum A' }),
      programm('P2', 'Side Event Wasser', { starts_at: `${TAG}T11:00:00+00:00`, starts_at_local: `${TAG}T12:00:00` }),
      programm('P3', 'Side Event Wald', { starts_at: `${TAG}T13:00:00+00:00`, starts_at_local: `${TAG}T14:00:00`, stage_id: 'S1' }),
      programm('P4', 'Side Event Ozean', { starts_at: '2026-11-11T09:00:00+00:00', starts_at_local: '2026-11-11T10:00:00' }),
    ],
    agenda: {
      P1: [punkt('P1', 'a1', 'Begrüßung', 1, 5), punkt('P1', 'a2', 'Panel', 2, 40), punkt('P1', 'a3', 'Fragen', 3, 15)],
      P2: [punkt('P2', 'b1', 'Einführung', 1), punkt('P2', 'b2', 'Diskussion', 2, 30)],
    },
    speakers: [{ id: 'sp1', event_id: 'ev-1', first_name: 'Ana', last_name: 'Silva', title: 'Ministerin' }],
    stages: [{ id: 'S1', event_id: 'ev-1', name: 'Bühne 1' }],
    geaendert: [],
    fehler: {},
    sperre: () => null,
    abrufe: [],
  };
}

function nachgebauterClient(iv: NachgebautesIveo): IveoClientLike {
  const schritt = async (abruf: Abruf, arg: string): Promise<void> => {
    iv.abrufe.push(`${abruf}:${arg}`);
    const halt = iv.sperre(abruf, arg);
    if (halt) await halt;
    if (iv.fehler[abruf]) throw iv.fehler[abruf];
  };
  return {
    async listProgramsUpdatedSince(_event: string, seit: string) {
      await schritt('geaendert', seit);
      return iv.geaendert;
    },
    async getEventSnapshot(event: string, jetzt: string): Promise<IveoSnapshot> {
      await schritt('snapshot', jetzt);
      return {
        event: { id: 'ev-1', slug: event, name: 'COP31', starts_at: null, ends_at: null, timezone: null },
        programs: iv.programme, speakers: iv.speakers, organisations: [], stages: iv.stages, fetchedAt: jetzt,
      };
    },
    async listAgendaItems(_event: string, programId: string) {
      await schritt('agenda', programId);
      return iv.agenda[programId] ?? [];
    },
    async getProgram(_event: string, programId: string) {
      await schritt('programm', programId);
      const p = iv.programme.find((x) => x.id === programId);
      if (!p) throw new IveoApiError(404, 'not_found', `Programm ${programId} fehlt`);
      return p;
    },
    async listSpeakers() {
      await schritt('speakers', '');
      return iv.speakers;
    },
  };
}

/** Agenda-Ablauf, wie ihn das Binden schreibt (Startzeit-Anker und Kategorie aus dem Programm). */
function agendaAblauf(iv: NachgebautesIveo, programId: string): ShowAblaufItem[] {
  const p = iv.programme.find((x) => x.id === programId)!;
  return agendaToAblauf(iv.agenda[programId] ?? [], { firstStartMs: localTimeOfDayMs(p), category: p.type_slug });
}
/** Listen-Ablauf eines Tages, wie ihn das Binden schreibt. */
function listenAblauf(iv: NachgebautesIveo, day: string): ShowAblaufItem[] {
  return programsToAblauf(filterPrograms(iv.programme, { day }), {
    stagesById: new Map(iv.stages.map((s) => [s.id, s])),
    withSchedule: true,
    speakerNamesById: new Map([['sp1', 'Ana Silva']]),
  });
}
const ANA: ShowIveoSpeaker = { name: 'Ana Silva', title: 'Ministerin' };
function showMit(ablauf: ShowAblaufItem[], filter: NonNullable<Show['iveo']>['filter'], speakers: ShowIveoSpeaker[] = []): Show {
  return {
    schemaVersion: 1,
    name: 'COP31 Tag 1',
    tools: [{ appId: 'jm-timer' }, { appId: 'jm-titler' }, { appId: 'jm-rundown' }],
    ablauf,
    iveo: {
      event: EVENT, baseUrl: BASIS, name: 'COP31', syncedAt: '2026-10-01T08:00:00.000Z',
      ...(speakers.length ? { speakers } : {}),
      sideEvents: [{ id: 'P1', title: 'Side Event Klima' }, { id: 'P2', title: 'Side Event Wasser' }],
      filter,
    },
  };
}

interface Umgebung {
  kern: IveoKern;
  iveo: NachgebautesIveo;
  dateien: Map<string, string>;
  token: string | undefined;
  schreibFehler: boolean;
  schreibversuche: number;
  reloads: string[];
  antworten: Record<'jm-timer' | 'jm-titler' | 'jm-rundown', number>;
  status: IveoSyncStatus[];
  aktivMeldungen: number;
  info: string[];
  warn: string[];
  clients: string[];
}
/** Show-Datei anlegen, Kern bauen, Show öffnen (wie onShowOpened). */
function umgebung(baue: (iv: NachgebautesIveo) => Show, opt: { ohneToken?: boolean } = {}): Umgebung {
  let uhr = Date.parse('2026-10-01T10:00:00.000Z');
  const iveo = neuesIveo();
  const u: Umgebung = {
    kern: undefined as unknown as IveoKern,
    iveo,
    dateien: new Map([[SHOW_PFAD, serializeShow(baue(iveo))]]),
    token: opt.ohneToken ? undefined : TOKEN,
    schreibFehler: false,
    schreibversuche: 0,
    reloads: [],
    antworten: { 'jm-timer': 1, 'jm-titler': 1, 'jm-rundown': 1 },
    status: [],
    aktivMeldungen: 0,
    info: [],
    warn: [],
    clients: [],
  };
  u.kern = erzeugeKern({
    clientFabrik: (token, baseUrl) => {
      u.clients.push(`${token}@${baseUrl}`);
      return nachgebauterClient(u.iveo);
    },
    token: () => u.token,
    leseShow: (p) => {
      const text = u.dateien.get(p);
      if (text === undefined) return null;
      try {
        return parseShow(text);
      } catch {
        return null;
      }
    },
    schreibeShow: (p, show) => {
      u.schreibversuche++;
      if (u.schreibFehler) return false;
      u.dateien.set(p, serializeShow(show));
      return true;
    },
    benachrichtige: (appId, zeile) => {
      u.reloads.push(`${appId} ${zeile}`);
      return u.antworten[appId];
    },
    schreibeCache: () => {},
    log: { info: (m) => u.info.push(m), warn: (m) => u.warn.push(m) },
    jetztIso: () => new Date((uhr += 1000)).toISOString(),
    meldeStatus: (s) => u.status.push({ ...s }),
    meldeAktiv: () => { u.aktivMeldungen++; },
    baseUrlStandard: () => 'https://standard.test/api/v1',
  });
  u.kern.showGeoeffnet(SHOW_PFAD, parseShow(u.dateien.get(SHOW_PFAD)!));
  return u;
}
const datei = (u: Umgebung, pfad = SHOW_PFAD): Show => parseShow(u.dateien.get(pfad)!);
const ids = (show: Show): string => (show.ablauf ?? []).map((p) => p.id ?? '-').join(',');
const warteMs = (ms: number): Promise<void> => new Promise<void>((r) => setTimeout(r, ms));
function sperre(): { halt: Promise<void>; frei: () => void } {
  let frei: () => void = () => {};
  const halt = new Promise<void>((r) => { frei = r; });
  return { halt, frei };
}
const agendaP1 = (iv: NachgebautesIveo): Show => showMit(agendaAblauf(iv, 'P1'), { day: TAG, programId: 'P1' });

// --- ablaufSignatur (Spec 7.2) ---------------------------------------------------------------------------------
{
  const a: ShowAblaufItem[] = [{ id: 'a1', label: 'Begrüßung', durationMs: 300_000, category: 'side-event' }];
  const umgestellt: ShowAblaufItem[] = [{ category: 'side-event', durationMs: 300_000, label: 'Begrüßung', id: 'a1' }];
  ck('Signatur: Feldreihenfolge im Objekt zählt nicht', ablaufSignatur(a, []) === ablaufSignatur(umgestellt, []));
  ck('Signatur: die Kennung zählt (Bestands-Show ohne id ≠ mit id)',
    ablaufSignatur(a, []) !== ablaufSignatur([{ label: 'Begrüßung', durationMs: 300_000, category: 'side-event' }], []));
  ck('Signatur: Speaker zählen (Funktion geändert)', ablaufSignatur(a, [ANA]) !== ablaufSignatur(a, [{ name: 'Ana Silva', title: 'Botschafterin' }]));
  ck('Signatur: so normalisiert wie die Datei (Punkt ohne Titel fällt weg, doppelte id → #2)',
    ablaufSignatur([...a, { label: '  ' }], []) === ablaufSignatur(a, [])
    && ablaufSignatur([{ id: 'x', label: 'A' }, { id: 'x', label: 'B' }], []) === ablaufSignatur([{ id: 'x', label: 'A' }, { id: 'x#2', label: 'B' }], []));
}

// --- 9.6 Nr. 1: Öffnen + erste Abfrage mit gleichem Stand → kein Schreiben, kein RELOAD -------------------------
// (Im Log von #235: 45 s nach dem Öffnen ein RELOAD ohne Änderung, weil lastSig beim Öffnen fehlte.)
{
  const u = umgebung(agendaP1);
  ck('Öffnen: aktiv() trägt Pfad, Event und Filter, das Panel ist benachrichtigt',
    JSON.stringify(u.kern.aktiv()) === JSON.stringify({ path: SHOW_PFAD, event: EVENT, filter: { day: TAG, programId: 'P1' } })
    && u.aktivMeldungen === 1);
  await u.kern.abfrage();
  ck('Nr. 1: gleicher Stand → nichts geschrieben, kein RELOAD', u.schreibversuche === 0 && u.reloads.length === 0);
  ck('Nr. 1: … der Client nutzt Token und Basis-URL der Bindung', u.clients[0] === `${TOKEN}@${BASIS}`);
  ck('Nr. 1: … der Side-Event-Kontext wurde nachgeladen', u.iveo.abrufe.includes('programm:P1'));
  await u.kern.abfrage();
  ck('Nr. 1: zweite Abfrage: Kontext gemerkt, wieder nichts geschrieben',
    u.iveo.abrufe.filter((x) => x === 'programm:P1').length === 1 && u.schreibversuche === 0 && u.reloads.length === 0);
}

// --- 9.6 Nr. 2: Listen-Modus, updated_since trifft, Ablauf gleich → kein Schreiben --------------------------------
{
  const u = umgebung((iv) => showMit(listenAblauf(iv, TAG), { day: TAG }, [ANA]));
  u.iveo.geaendert = [u.iveo.programme[3]]; // geändert hat sich nur P4 (anderer Tag)
  await u.kern.abfrage();
  ck('Nr. 2: Listen-Modus, Treffer, gefilterter Ablauf gleich → nichts geschrieben, kein RELOAD',
    u.schreibversuche === 0 && u.reloads.length === 0);
  await u.kern.abfrage();
  const seit = u.iveo.abrufe.filter((x) => x.startsWith('geaendert:')).map((x) => x.slice('geaendert:'.length));
  const snap1 = u.iveo.abrufe.find((x) => x.startsWith('snapshot:'))?.slice('snapshot:'.length) ?? '(kein Snapshot)';
  ck('Nr. 2: … das updated_since-Fenster rückt trotzdem vor', seit[0] === '2026-10-01T08:00:00.000Z' && seit[1] === snap1);
  u.iveo.programme[1] = { ...u.iveo.programme[1], title: 'Side Event Wasser und Meer' };
  await u.kern.abfrage();
  ck('Nr. 2: Gegenprobe: echte Änderung → geschrieben und RELOAD',
    u.schreibversuche === 1 && u.reloads.length === 3 && datei(u).ablauf?.[1]?.label === 'Side Event Wasser und Meer');
  ck('Nr. 2: … die Datei trägt die iveo-Programm-IDs als Kennungen', ids(datei(u)) === 'P1,P2,P3');
  ck('Nr. 2: … Filter, Speaker und Side-Event-Liste bleiben in der Bindung',
    datei(u).iveo?.filter?.day === TAG && datei(u).iveo?.speakers?.[0]?.name === 'Ana Silva' && datei(u).iveo?.sideEvents?.length === 2);
}

// --- 9.6 Nr. 3: Agenda-Abruf scheitert → kein Schreiben, gestört; danach Erfolg → ok ------------------------------
{
  const u = umgebung(agendaP1);
  u.iveo.agenda.P1 = u.iveo.agenda.P1.slice(0, 2); // in iveo geändert …
  u.iveo.fehler.agenda = new Error('fetch failed'); // … aber nicht abrufbar
  await u.kern.abfrage();
  ck('Nr. 3: Agenda-Abruf scheitert → nichts geschrieben, kein RELOAD, kein 1-Punkt-Ablauf',
    u.schreibversuche === 0 && u.reloads.length === 0 && datei(u).ablauf?.length === 3);
  const st = u.status[0];
  ck('Nr. 3: … Zustand gestört mit Text und Zeit', u.status.length === 1 && st.ok === false && st.text === 'fetch failed' && typeof st.seit === 'string');
  const gestoertWarnungen = (): number => u.warn.filter((w) => w.startsWith('iveo-Abgleich gestört')).length;
  ck('Nr. 3: … eine Warnung im Log', gestoertWarnungen() === 1);
  await u.kern.abfrage();
  ck('Nr. 3: derselbe Fehler noch einmal → keine neue Meldung, keine neue Warnung', u.status.length === 1 && gestoertWarnungen() === 1);
  u.iveo.fehler.agenda = new IveoApiError(503, 'unavailable', 'iveo HTTP 503 @ /events [HTTP 503]');
  await u.kern.abfrage();
  ck('Nr. 3: anderer Fehlertext → neue Meldung und Warnung, „seit“ bleibt',
    u.status.length === 2 && u.status[1].text !== 'fetch failed' && u.status[1].seit === st.seit && gestoertWarnungen() === 2);
  delete u.iveo.fehler.agenda;
  await u.kern.abfrage();
  ck('Nr. 3: danach Erfolg → ok, der neue Stand ist geschrieben',
    u.status.at(-1)?.ok === true && u.schreibversuche === 1 && datei(u).ablauf?.length === 2 && u.reloads.length === 3);
}

// --- 9.6 Nr. 4: getProgram scheitert bei fehlendem sideCtx → kein Schreiben, gestört ------------------------------
{
  const u = umgebung(agendaP1);
  u.iveo.agenda.P1 = u.iveo.agenda.P1.slice(0, 2);
  u.iveo.fehler.programm = new Error('socket hang up');
  await u.kern.abfrage();
  ck('Nr. 4: getProgram scheitert bei fehlendem Kontext → nichts geschrieben (kein Ablauf ohne Startzeit/Kategorie)',
    u.schreibversuche === 0 && u.reloads.length === 0);
  ck('Nr. 4: … Zustand gestört', u.status.at(-1)?.ok === false && u.status.at(-1)?.text === 'socket hang up');
  delete u.iveo.fehler.programm;
  await u.kern.abfrage();
  const a = datei(u).ablauf ?? [];
  ck('Nr. 4: nächster Versuch klappt → mit Startzeit-Anker und Kategorie geschrieben',
    u.schreibversuche === 1 && a.length === 2 && a[0].plannedStartMs === localTimeOfDayMs(u.iveo.programme[0]) && a[0].category === 'side-event');
}

// --- 9.6 Nr. 5: leere Agenda → 1-Punkt-Ablauf; gleich gebunden und abgefragt → kein Schein-„geändert“ -------------
{
  const u = umgebung(agendaP1);
  u.iveo.agenda.P1 = [];
  await u.kern.abfrage();
  const a = datei(u).ablauf ?? [];
  ck('Nr. 5: erfolgreich leere Agenda → das Programm als ein Punkt, mit iveo-Programm-ID, RELOAD',
    a.length === 1 && a[0].label === 'Side Event Klima' && a[0].id === 'P1' && u.reloads.length === 3);
  ck('Nr. 5: … Notiz ohne Bühnennamen (ohne stagesById, Spec 7.2)', a[0].note === 'Raum A');
  const v = umgebung((iv) => showMit([einPunktAblauf(iv.programme[2])], { day: TAG, programId: 'P3' }));
  await v.kern.abfrage();
  await v.kern.abfrage();
  ck('Nr. 5: so gebunden (einPunktAblauf) und abgefragt → nichts geschrieben, kein RELOAD', v.schreibversuche === 0 && v.reloads.length === 0);
}

// --- 9.6 Nr. 6: HTTP 401 → „Token ungültig oder widerrufen“ -------------------------------------------------------
{
  const u = umgebung(agendaP1);
  u.iveo.fehler.agenda = new IveoApiError(401, 'token_revoked', 'Token revoked @ /events/cop31/programs/P1/agenda-items [HTTP 401 token_revoked]');
  await u.kern.abfrage();
  ck('Nr. 6: HTTP 401 → Text „Token ungültig oder widerrufen“', u.status.at(-1)?.ok === false && u.status.at(-1)?.text === 'Token ungültig oder widerrufen');
  ck('Nr. 6: … das Token steht nirgends im Log', ![...u.info, ...u.warn].some((z) => z.includes(TOKEN)));
  const v = umgebung((iv) => showMit(listenAblauf(iv, TAG), { day: TAG }, [ANA]));
  v.iveo.fehler.geaendert = new IveoApiError(401, 'unauthorized', 'iveo HTTP 401 @ /events/cop31/programs [HTTP 401]');
  await v.kern.abfrage();
  ck('Nr. 6: … ebenso im Listen-Modus', v.status.at(-1)?.text === 'Token ungültig oder widerrufen' && v.schreibversuche === 0);
}

// --- 9.6 Nr. 7: kein Token → „kein iveo-Token auf diesem Rechner, nur Offline-Ablauf“ -----------------------------
{
  const u = umgebung(agendaP1, { ohneToken: true });
  ck('Nr. 7: kein Token beim Öffnen → Status-Text', u.status.at(-1)?.ok === false && u.status.at(-1)?.text === 'kein iveo-Token auf diesem Rechner, nur Offline-Ablauf');
  ck('Nr. 7: … kein aktiver Abgleich, das Panel ist trotzdem benachrichtigt', u.kern.aktiv() === null && u.aktivMeldungen === 1);
  await u.kern.abfrage();
  ck('Nr. 7: … eine Abfrage fragt iveo nicht', u.clients.length === 0 && u.iveo.abrufe.length === 0);
  const v = umgebung(agendaP1);
  v.token = undefined;
  await v.kern.abfrage();
  ck('Nr. 7: Token fehlt bei einer Abfrage → derselbe Text, kein Abruf',
    v.status.at(-1)?.text === 'kein iveo-Token auf diesem Rechner, nur Offline-Ablauf' && v.clients.length === 0);
  const w = umgebung(() => ({ schemaVersion: 1, name: 'Ohne iveo', tools: [], ablauf: [{ id: 'x1', label: 'Begrüßung' }] }));
  ck('Show ohne iveo: kein Abgleich, Status bleibt ok', w.kern.aktiv() === null && w.status.length === 0);
}

// --- 9.6 Nr. 9 und 7.3: Show-Wechsel während einer Abfrage; Abfragen nacheinander ---------------------------------
{
  const u = umgebung(agendaP1);
  u.iveo.agenda.P1 = u.iveo.agenda.P1.slice(0, 2); // die Abfrage hätte etwas zu schreiben
  const s = sperre();
  u.iveo.sperre = (abruf) => (abruf === 'agenda' ? s.halt : null);
  const lauf = u.kern.abfrage();
  const zweite = await Promise.race([u.kern.abfrage().then(() => 'fertig'), warteMs(500).then(() => 'hängt')]);
  ck('7.3: läuft noch eine Abfrage, startet keine zweite (kehrt sofort zurück, kein zweiter Abruf)',
    zweite === 'fertig' && u.iveo.abrufe.filter((x) => x.startsWith('agenda:')).length === 1);
  const tag2 = 'C:/Shows/COP31 Tag 2.jmshow';
  u.dateien.set(tag2, serializeShow({ schemaVersion: 1, name: 'COP31 Tag 2', tools: [] }));
  u.kern.showGeoeffnet(tag2, datei(u, tag2));
  s.frei();
  await lauf;
  ck('Nr. 9: Show-Wechsel während einer Abfrage → nichts geschrieben, kein RELOAD', u.schreibversuche === 0 && u.reloads.length === 0);
  ck('Nr. 9: … beide Dateien unverändert', datei(u).ablauf?.length === 3 && datei(u, tag2).ablauf === undefined);

  const v = umgebung(agendaP1);
  v.iveo.agenda.P1 = v.iveo.agenda.P1.slice(0, 2);
  const s2 = sperre();
  v.iveo.sperre = (abruf) => (abruf === 'agenda' ? s2.halt : null);
  const lauf2 = v.kern.abfrage();
  v.kern.showGeschlossen();
  s2.frei();
  await lauf2;
  ck('Nr. 9: Show geschlossen während einer Abfrage → nichts geschrieben', v.schreibversuche === 0 && v.reloads.length === 0 && v.kern.aktiv() === null);
}

// --- 9.6 Nr. 10: Schreiben scheitert → kein RELOAD, lastSig unverändert; die nächste Abfrage schreibt erneut -------
{
  const u = umgebung(agendaP1);
  u.iveo.agenda.P1 = u.iveo.agenda.P1.slice(0, 2);
  u.schreibFehler = true;
  await u.kern.abfrage();
  ck('Nr. 10: Schreiben scheitert → kein RELOAD, Datei unverändert', u.schreibversuche === 1 && u.reloads.length === 0 && datei(u).ablauf?.length === 3);
  ck('Nr. 10: … Zustand gestört „Show konnte nicht geschrieben werden“', u.status.at(-1)?.text === 'Show konnte nicht geschrieben werden');
  u.schreibFehler = false;
  await u.kern.abfrage();
  ck('Nr. 10: nächste Abfrage mit gleichem iveo-Stand schreibt erneut und schickt RELOAD',
    u.schreibversuche === 2 && u.reloads.length === 3 && datei(u).ablauf?.length === 2 && u.status.at(-1)?.ok === true);
  await u.kern.abfrage();
  ck('Nr. 10: … danach gleicher Stand → nichts mehr', u.schreibversuche === 2 && u.reloads.length === 3);

  const v = umgebung((iv) => showMit(listenAblauf(iv, TAG), { day: TAG }, [ANA]));
  v.iveo.geaendert = [v.iveo.programme[1]];
  v.iveo.programme[1] = { ...v.iveo.programme[1], title: 'Side Event Wasser und Meer' };
  v.schreibFehler = true;
  await v.kern.abfrage();
  v.schreibFehler = false;
  await v.kern.abfrage();
  const seit = v.iveo.abrufe.filter((x) => x.startsWith('geaendert:'));
  ck('Nr. 10: Listen-Modus: nach dem Schreibfehler fragt die nächste Abfrage dasselbe Fenster ab und schreibt',
    seit.length === 2 && seit[0] === seit[1] && v.schreibversuche === 2 && v.reloads.length === 3);
}

// --- 9.6 Nr. 12: RELOAD-Zählung enthält den Rundown (Spec 7.1) -------------------------------------------------
{
  const u = umgebung(agendaP1);
  u.antworten = { 'jm-timer': 1, 'jm-titler': 0, 'jm-rundown': 2 };
  u.iveo.agenda.P1 = [...u.iveo.agenda.P1, punkt('P1', 'a4', 'Abschluss', 4)];
  await u.kern.abfrage();
  ck('Nr. 12: RELOAD geht an Timer, Titler und Rundown',
    JSON.stringify(u.reloads) === JSON.stringify(['jm-timer TIMER RELOAD', 'jm-titler TITLER RELOAD', 'jm-rundown RUNDOWN RELOAD']));
  ck('Nr. 12: … die Logzeile zählt den Rundown', u.info.includes('iveo: RELOAD → 1 Timer, 0 Titler, 2 Rundown benachrichtigt.'));
}

// --- 7.2: Bestands-Show ohne Kennungen → die erste Abfrage schreibt sie einmal nach -------------------------------
{
  const u = umgebung((iv) => showMit(agendaAblauf(iv, 'P1').map(({ id: _id, ...rest }) => rest), { day: TAG, programId: 'P1' }));
  ck('7.2: Ausgangslage: Datei ohne Kennungen', ids(datei(u)) === '-,-,-');
  await u.kern.abfrage();
  ck('7.2: erste Abfrage schreibt die Kennungen einmal nach und schickt RELOAD',
    u.schreibversuche === 1 && u.reloads.length === 3 && ids(datei(u)) === 'a1,a2,a3');
  await u.kern.abfrage();
  ck('7.2: … danach stabil', u.schreibversuche === 1 && u.reloads.length === 3);
}

// --- Zusammenfassung ---
console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
```

- [ ] **Schritt 3: Test laufen lassen (rot)**

```
npm run selftest:iveo -w @jm/launcher
```

Erwartet: Abbruch vor dem ersten Fall, Exit-Code ≠ 0, mit
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…\apps\launcher\src\main\iveo-abgleich-kern' imported from …\apps\launcher\test\iveo-abgleich.test.ts
```

- [ ] **Schritt 4: Implementierung**

Neue Datei `apps/launcher/src/main/iveo-abgleich-kern.ts` mit genau diesem Inhalt:

```ts
// ─────────────────────────────────────────────────────────────────────────────
// iveo-Abgleich-Kern (Master-Link Teil 2a, Spec 7.0–7.6) — OHNE Electron, per tsx getestet
// (test/iveo-abgleich.test.ts, mit nachgebautem iveo-Client). iveo-sync.ts ist die dünne Electron-Hülle darüber:
// Einstellungen, Token, Health, Renderer-Ereignisse, Takt (Muster wie verbund/kern.ts).
//
// Der Kern hält die offene Show (`active`), fragt iveo ab (Listen- und Agenda-Modus), vergleicht über die
// Signatur (7.2), schreibt die Show über `schreibeShow` (7.4) und benachrichtigt Timer, Titler UND Rundown (7.1).
// Abfrage und Umschalten überholen sich nicht: Generation + Prüfung „active === a“ direkt vor dem Schreiben (7.3).
// Merker (lastSig, lastSyncIso, filter, sideCtx) rücken erst nach erfolgreichem Schreiben vor (7.2).
//
// SICHERHEIT: Das Token kommt nur über `token(event)` herein und geht nur an `clientFabrik` — nie in Log,
// Status, Show oder Cache.
// ─────────────────────────────────────────────────────────────────────────────

import { normalizeAblauf, type Show, type ShowAblaufItem, type ShowIveoSpeaker } from '@jm/show';
import {
  IveoApiError,
  agendaToAblauf,
  buildShowMetadata,
  extractSpeakerIds,
  filterPrograms,
  localTimeOfDayMs,
  programDayKey,
  programToAblaufItem,
  programsToAblauf,
  snapshotToShowSpeakers,
  speakerName,
  type IveoClient,
  type IveoProgram,
  type IveoProgramFilter,
} from '@jm/iveo';

/** Die Teilmenge des iveo-Clients, die der Kern braucht. Im Test nachgebaut. */
export type IveoClientLike = Pick<
  IveoClient,
  'listProgramsUpdatedSince' | 'getEventSnapshot' | 'listAgendaItems' | 'getProgram' | 'listSpeakers'
>;

/** Zustand des Abgleichs fürs iveo-Panel (Ereignis `iveo-sync-status`, Spec 7.6). */
export interface IveoSyncStatus {
  ok: boolean;
  text?: string;
  /** ISO-Zeit, seit der der Abgleich gestört ist. */
  seit?: string;
}

export interface KernAbhaengigkeiten {
  /** Client für eine Abfrage. Die Hülle setzt hier den fetchImpl mit 15-s-Zeitgrenze ein (7.0). */
  clientFabrik(token: string, baseUrl: string): IveoClientLike;
  /** Token für dieses Event auf diesem Rechner, sonst undefined. */
  token(event: string): string | undefined;
  /** Show-Datei lesen (parseShow). null = nicht lesbar. */
  leseShow(pfad: string): Show | null;
  /** Show serialisieren und atomar schreiben (show-schreiben.ts). SYNCHRON; true = geschrieben. */
  schreibeShow(pfad: string, show: Show): boolean;
  /** Steuerbefehl an alle verbundenen Instanzen eines Tools; Rückgabe = Anzahl. */
  benachrichtige(appId: 'jm-timer' | 'jm-titler' | 'jm-rundown', zeile: string): number;
  /** Token-freien Metadaten-Cache schreiben (IveoShowMetadata). */
  schreibeCache(meta: unknown): void;
  log: { info(m: string): void; warn(m: string): void };
  jetztIso(): string;
  /** Neuer Abgleich-Zustand. Kommt nur bei einem Wechsel. */
  meldeStatus(s: IveoSyncStatus): void;
  /** aktiv() hat sich geändert (Öffnen, Umschalten, Speichern der offenen Show): die Hülle meldet das Panel neu. */
  meldeAktiv(): void;
  /** Basis-URL, wenn die Show keine trägt (resolveIveoBaseUrl). */
  baseUrlStandard(): string;
}

export interface IveoKern {
  /** Show geöffnet: active aus der Datei, lastSig aus der Datei, Generation + 1, Status. */
  showGeoeffnet(pfad: string, show: Show): void;
  /** Keine Show mehr offen: Generation + 1, active = null. */
  showGeschlossen(): void;
  /** Ein Takt. Läuft noch eine Abfrage, kehrt sie sofort zurück. Wirft nie. */
  abfrage(): Promise<void>;
  /** Auf ein Side Event (programId) oder die Tagesübersicht (day) umschalten. Wirft nie. */
  umschalten(input: { programId?: string; day?: string }): Promise<{ ok: boolean; message: string }>;
  /** Der Show-Editor hat eine Show gespeichert; zählt nur, wenn es die offene ist (Spec 7.5). */
  offeneShowGespeichert(pfad: string, neuGebunden: boolean): void;
  /** Für Panel und STATE: offene iveo-Show mit Token, sonst null. */
  aktiv(): { path: string; event: string; filter: IveoProgramFilter } | null;
}

// ── Texte (Spec 7.6, wortgleich) ─────────────────────────────────────────────
const TEXT_TOKEN_UNGUELTIG = 'Token ungültig oder widerrufen';
const TEXT_KEIN_TOKEN = 'kein iveo-Token auf diesem Rechner, nur Offline-Ablauf';
/** Spec 7.2 (Umschalten); derselbe Text, wenn eine Abfrage nicht schreiben kann. */
const TEXT_NICHT_GESCHRIEBEN = 'Show konnte nicht geschrieben werden';
const TEXT_SHOW_NICHT_LESBAR = 'Show-Datei nicht lesbar';

// ── Reine Helfer (aus iveo-sync.ts hierher gezogen; die Hülle importiert sie für Binden/Discover) ──────────

/** Nur die gesetzten Filter-Kriterien in ein token-freies Show-Filter-Objekt übernehmen. */
export function compactFilter(f: IveoProgramFilter): NonNullable<Show['iveo']>['filter'] | undefined {
  const out: NonNullable<NonNullable<Show['iveo']>['filter']> = {};
  if (f.typeSlug) out.typeSlug = f.typeSlug;
  if (f.formatSlug) out.formatSlug = f.formatSlug;
  if (f.day) out.day = f.day;
  if (f.excludeBlockers) out.excludeBlockers = true;
  if (f.programId) out.programId = f.programId;
  return Object.keys(out).length ? out : undefined;
}

/** id → Anzeigename aller Event-Speaker (für „Verantwortlich" am Ablauf-Punkt). */
export function speakerNameMap(speakers: Array<Parameters<typeof speakerName>[0]>): Map<string, string> {
  return new Map(speakers.map((s) => [s.id, speakerName(s)]));
}

/**
 * F3: `withSchedule` (Soll-Startzeit/Kategorie/Verantwortlich je Punkt) im
 * Listen-Pfad (mehrere Programme, KEIN Side Event „im Detail") nur setzen, wenn
 * der gefilterte Ablauf eindeutig EINEM Kalendertag zugehört. Ohne diese Bremse
 * behandelt die Timer-Kettenrechnung jede gesetzte Startzeit als neuen Anker; bei
 * einem mehrtägigen iveo-Plan OHNE Tagesfilter (Uhrzeit ohne Datum) springt die
 * Soll-Uhr für Tag 2 zurück auf dessen erste Startzeit, und die Drift-Pille meldet
 * zweistellige Stunden-Abweichungen gegen die heutige Mitternacht. Ein gesetzter
 * Tagesfilter macht die Zugehörigkeit explizit; ohne ihn (z. B. eintägige Events,
 * für die der Editor gar keinen Tagesfilter anbietet, weil `days.length <= 1`)
 * genügt es, dass alle gefilterten Programme mit Datum denselben Kalendertag
 * tragen. Keine Zahl ist im Livebetrieb besser als eine falsche → im Zweifel false.
 * Der Side-Event-/Agenda-Pfad ist NICHT betroffen — dort gibt es genau einen Anker.
 */
export function scheduleSafeForList(filter: IveoProgramFilter, programs: IveoProgram[]): boolean {
  if ((filter.day || '').trim()) return true;
  const days = new Set<string>();
  for (const p of programs) {
    const d = programDayKey(p);
    if (d) days.add(d);
  }
  return days.size <= 1;
}

// Fehler → nutzerfreundlich, ohne rohe Upstream-Antwort.
function humanize(e: IveoApiError): string {
  if (e.isUnauthorized) return 'Token ungültig/abgelaufen oder API-Zugang deaktiviert (401).';
  if (e.isNotFoundOrOutOfScope) return 'Event nicht gefunden oder außerhalb des Token-Scopes (404).';
  if (e.status >= 500)
    return `iveo-Server-Fehler (HTTP ${e.status}) — vorübergehend oder serverseitiger Bug. Bitte an den iveo-Entwickler melden (Details im Launcher-Log).`;
  return `iveo-Fehler (${e.code}).`;
}
export function toClientError(e: unknown): { code?: string; error: string } {
  if (e instanceof IveoApiError) return { code: e.code, error: humanize(e) };
  return { error: (e as Error)?.message || 'iveo: unbekannter Fehler.' };
}

/** Statustext eines Abfragefehlers (Spec 7.6): 401 eigens, sonst die bestehende Abbildung toClientError. */
function stoerungsText(e: unknown): string {
  if (e instanceof IveoApiError && e.isUnauthorized) return TEXT_TOKEN_UNGUELTIG;
  return toClientError(e).error;
}

/**
 * Signatur eines Ablaufs samt Speakern (Spec 7.2). Gleich = nichts zu schreiben, kein RELOAD. Die Punkte so, wie
 * sie in der Datei stehen (normalizeAblauf), Felder in fester Reihenfolge; dazu die Speaker (Name, Funktion).
 */
export function ablaufSignatur(ablauf: ShowAblaufItem[], speakers: ShowIveoSpeaker[]): string {
  const punkte = normalizeAblauf(ablauf).map((p) => [
    p.id ?? null,
    p.label,
    p.durationMs ?? null,
    p.note ?? null,
    p.plannedStartMs ?? null,
    p.owner ?? null,
    p.category ?? null,
  ]);
  const sprecher = speakers
    .map((s) => [s.name.trim(), s.title?.trim() || null] as const)
    .filter(([name]) => name.length > 0);
  return JSON.stringify([punkte, sprecher]);
}

/**
 * 1-Punkt-Ablauf eines Side Events ohne Agenda: das Programm selbst als ein Punkt. Binden, Abfrage und Umschalten
 * bilden ihn gleich, OHNE stagesById (Spec 7.2) — sonst trüge nur das Binden den Bühnennamen in der Notiz, und
 * jede Abfrage danach meldete ein Schein-„geändert“.
 */
export function einPunktAblauf(programm: IveoProgram, namen?: Map<string, string>): ShowAblaufItem {
  return programToAblaufItem(programm, { withSchedule: true, speakerNamesById: namen });
}

type SideKontext = { firstStartMs: number | null; category?: string; speakerNames?: Array<[string, string]> };

interface AktiveShow {
  path: string;
  /** Kanonischer Event-Slug (Token-Schlüssel). */
  event: string;
  baseUrl: string;
  /** Letzter erfolgreicher Abgleich (ISO) — Basis fürs ?updated_since=. */
  lastSyncIso: string;
  /** Ablauf-Filter der Show (identisch zum Binden). */
  filter: IveoProgramFilter;
  /** Signatur des Stands in der Datei (7.2). */
  lastSig: string;
  /**
   * Side-Event-Kontext (Startzeit-Anker, Kategorie, Speakernamen). Die Agenda-Abfrage hat keinen Snapshot; ohne
   * diesen Merker fehlten Startzeit/Kategorie/Verantwortlich. Namen als Array-Paare (klonbar).
   */
  sideCtx?: SideKontext;
}

export function erzeugeKern(d: KernAbhaengigkeiten): IveoKern {
  let active: AktiveShow | null = null;
  /** Pfad der offenen Show, auch ohne iveo (Spec 7.5). */
  let offenePfad: string | null = null;
  /** Steigt bei Öffnen, Schließen, Umschalten und Speichern der offenen Show (7.3). */
  let generation = 0;
  let abfrageLaeuft = false;
  let status: IveoSyncStatus = { ok: true };

  /** 7.3: Ergebnis gilt nur, wenn Show UND Generation noch dieselben sind wie beim Start. */
  const istAktuell = (a: AktiveShow, gen: number): boolean => active === a && generation === gen;

  // Spec 7.6: nur Wechsel melden. Der erste Fehlschlag und jeder neue Fehlertext kommen als Warnung ins Log,
  // gleichbleibende Wiederholungen nicht (sonst wüchse das Log alle 45 s).
  function statusOk(): void {
    if (status.ok) return;
    status = { ok: true };
    d.log.info('iveo-Abgleich wieder in Ordnung.');
    d.meldeStatus(status);
  }
  function statusGestoert(text: string): void {
    if (!status.ok && status.text === text) return;
    // „seit“ = Beginn der Störung; ein neuer Text innerhalb derselben Störung behält ihn.
    status = { ok: false, text, seit: status.ok ? d.jetztIso() : status.seit };
    d.log.warn(`iveo-Abgleich gestört: ${text}`);
    d.meldeStatus(status);
  }

  /** Spec 7.1: an allen drei Stellen geht auch RUNDOWN RELOAD hinaus. */
  function benachrichtigeAlle(): void {
    const timer = d.benachrichtige('jm-timer', 'TIMER RELOAD');
    const titler = d.benachrichtige('jm-titler', 'TITLER RELOAD');
    const rundown = d.benachrichtige('jm-rundown', 'RUNDOWN RELOAD');
    d.log.info(`iveo: RELOAD → ${timer} Timer, ${titler} Titler, ${rundown} Rundown benachrichtigt.`);
  }

  /**
   * Ablauf + Speaker + token-freie Bindung (inkl. Filter) in die Show schreiben (früher rewriteShowAblauf).
   * SYNCHRON — der Aufrufer prüft direkt davor `istAktuell`. `basis` ist die eben gelesene Datei; ihre
   * Side-Event-Liste bleibt erhalten (fürs Live-Umschalten).
   */
  function schreibeAblauf(
    pfad: string,
    basis: Show,
    w: { slug: string; baseUrl: string; name: string; ablauf: ShowAblaufItem[]; speakers: ShowIveoSpeaker[]; filter: IveoProgramFilter },
  ): boolean {
    const sideEvents = basis.iveo?.sideEvents;
    const compact = compactFilter(w.filter);
    const show: Show = {
      ...basis,
      ablauf: w.ablauf,
      iveo: {
        event: w.slug,
        baseUrl: w.baseUrl,
        name: w.name,
        syncedAt: d.jetztIso(),
        ...(w.speakers.length ? { speakers: w.speakers } : {}),
        ...(sideEvents?.length ? { sideEvents } : {}),
        ...(compact ? { filter: compact } : {}),
      },
    };
    return d.schreibeShow(pfad, show);
  }

  /**
   * `active` aus einer gelesenen Show neu aufsetzen. Generation + 1: eine laufende Abfrage verwirft ihr Ergebnis.
   * lastSig kommt aus der Datei (7.2) — sonst schrieb die erste Abfrage nach jedem Öffnen ohne Änderung neu und
   * schickte ein Schein-RELOAD (im Log von #235 sichtbar).
   */
  function setzeAuf(pfad: string, show: Show): AktiveShow | null {
    generation++;
    offenePfad = pfad;
    active = null;
    const binding = show.iveo;
    if (!binding?.event) {
      statusOk();
      return null;
    }
    if (!d.token(binding.event)) {
      // Show auf einem anderen Rechner gebunden: der Ablauf aus der Datei läuft offline weiter (7.6).
      statusGestoert(TEXT_KEIN_TOKEN);
      return null;
    }
    active = {
      path: pfad,
      event: binding.event,
      baseUrl: binding.baseUrl || d.baseUrlStandard(),
      lastSyncIso: binding.syncedAt || d.jetztIso(),
      filter: { ...(binding.filter ?? {}) },
      lastSig: ablaufSignatur(show.ablauf ?? [], binding.speakers ?? []),
    };
    statusOk();
    d.log.info(`iveo: Live-Abgleich für Event „${binding.event}“ aktiv.`);
    return active;
  }

  function showGeoeffnet(pfad: string, show: Show): void {
    setzeAuf(pfad, show);
    d.meldeAktiv();
  }

  function showGeschlossen(): void {
    generation++;
    active = null;
    offenePfad = null;
    statusOk();
  }

  async function abfrage(): Promise<void> {
    // 7.3: Abfragen laufen nacheinander. Läuft noch eine, startet der Takt keine zweite.
    if (abfrageLaeuft) return;
    const a = active;
    if (!a) return;
    const gen = generation;
    abfrageLaeuft = true;
    try {
      const tok = d.token(a.event);
      if (!tok) {
        statusGestoert(TEXT_KEIN_TOKEN);
        return;
      }
      const client = d.clientFabrik(tok, a.baseUrl);
      // Agenda-Modus (ein Side Event): Agenda-Änderungen erhöhen das Programm-`updated_at` NICHT (§8) → die Agenda
      // bei jeder Abfrage direkt holen und nur bei echter Änderung schreiben.
      if (a.filter.programId) await abfrageAgenda(client, a, gen);
      else await abfrageListe(client, a, gen);
    } catch (e) {
      // Netz, 5xx, 429, 401: der Takt läuft weiter, Zustand „gestört“ (7.6). Eine veraltete Abfrage zählt nicht.
      if (istAktuell(a, gen)) statusGestoert(stoerungsText(e));
    } finally {
      abfrageLaeuft = false;
    }
  }

  /** Listen-Modus (früher pollOnce): nur bei einem `updated_since`-Treffer den Snapshot holen, dann Signatur (7.2). */
  async function abfrageListe(client: IveoClientLike, a: AktiveShow, gen: number): Promise<void> {
    const geaendert = await client.listProgramsUpdatedSince(a.event, a.lastSyncIso);
    if (!geaendert.length) {
      if (istAktuell(a, gen)) statusOk();
      return; // nichts Neues seit dem letzten Abgleich
    }
    // Programme ESSENZIELL (kein programsBestEffort): ein transienter 500 soll den Ablauf nicht mit [] überschreiben.
    const snap = await client.getEventSnapshot(a.event, d.jetztIso(), {
      onSubError: (resource, e) => d.log.warn(`iveo poll: Metadaten „${resource}" übersprungen (${(e as Error).message})`),
    });
    // Ab hier kein await mehr: Prüfen und Schreiben stehen direkt hintereinander (7.3).
    if (!istAktuell(a, gen)) return;
    const listPrograms = filterPrograms(snap.programs, a.filter);
    const ablauf = programsToAblauf(listPrograms, {
      stagesById: new Map(snap.stages.map((s) => [s.id, s])),
      // F3: nur bei eindeutiger Tageszugehörigkeit (s. scheduleSafeForList).
      withSchedule: scheduleSafeForList(a.filter, listPrograms),
      speakerNamesById: speakerNameMap(snap.speakers),
    });
    const speakers = snapshotToShowSpeakers(snap);
    d.schreibeCache(buildShowMetadata(snap, a.baseUrl));
    const sig = ablaufSignatur(ablauf, speakers);
    if (sig === a.lastSig) {
      // 7.2: nichts geändert → nicht schreiben, kein RELOAD; das Abfragefenster rückt trotzdem vor.
      a.lastSyncIso = snap.fetchedAt;
      d.log.info(`iveo: ${geaendert.length} Programm(e) geändert, Ablauf unverändert.`);
      statusOk();
      return;
    }
    const basis = d.leseShow(a.path);
    if (!basis) {
      statusGestoert(TEXT_SHOW_NICHT_LESBAR);
      return;
    }
    d.log.info(`iveo: ${geaendert.length} Programm(e) geändert → Ablauf neu (${ablauf.length} Punkte).`);
    const ok = schreibeAblauf(a.path, basis, {
      slug: snap.event.slug,
      baseUrl: a.baseUrl,
      name: snap.event.name,
      ablauf,
      speakers,
      filter: a.filter,
    });
    if (!ok) {
      // 7.2: kein RELOAD, Merker bleiben → die nächste Abfrage mit demselben iveo-Stand schreibt erneut.
      statusGestoert(TEXT_NICHT_GESCHRIEBEN);
      return;
    }
    a.lastSig = sig;
    a.lastSyncIso = snap.fetchedAt;
    statusOk();
    benachrichtigeAlle();
  }

  /**
   * Agenda-Modus (früher pollSideEvent). Spec 7.6: Scheitert die Agenda oder das Nachladen des Side-Event-Kontexts,
   * bricht die Abfrage ab (nichts geschrieben, kein RELOAD, „gestört“). Nur eine erfolgreich LEERE Agenda wird zum
   * 1-Punkt-Ablauf. Speaker und Name kommen aus der Datei (neu eingegrenzt wird nur beim Binden und Umschalten).
   */
  async function abfrageAgenda(client: IveoClientLike, a: AktiveShow, gen: number): Promise<void> {
    const programId = a.filter.programId!;
    const agenda = await client.listAgendaItems(a.event, programId);
    let detail: IveoProgram | null = null;
    let ctx = a.sideCtx;
    if (!ctx) {
      // Nach dem Öffnen einer gespeicherten Show fehlt der Kontext (er entsteht beim Binden/Umschalten). Ohne ihn
      // fehlten Startzeit, Kategorie und Verantwortlich → nachladen; scheitert das, bricht die Abfrage ab (7.6).
      detail = await client.getProgram(a.event, programId);
      const ids = [
        ...new Set<string>([...extractSpeakerIds(detail), ...agenda.flatMap((it) => extractSpeakerIds(it))]),
      ];
      let speakerNames: Array<[string, string]> | undefined;
      if (ids.length) {
        try {
          speakerNames = [...speakerNameMap(await client.listSpeakers(a.event))];
        } catch {
          /* Speakerliste nicht ladbar → owner bleibt leer, kein Fehler */
        }
      }
      ctx = {
        firstStartMs: localTimeOfDayMs(detail),
        category: ((detail.format_slug || detail.type_slug) || '').trim() || undefined,
        speakerNames,
      };
    }
    const names = ctx.speakerNames ? new Map(ctx.speakerNames) : undefined;
    let ablauf = agendaToAblauf(agenda, {
      firstStartMs: ctx.firstStartMs,
      category: ctx.category,
      speakerNamesById: names,
    });
    if (!ablauf.length) {
      // Erfolgreich leere Agenda → das Programm selbst als ein Punkt, wie beim Binden und Umschalten (7.2).
      if (!detail) detail = await client.getProgram(a.event, programId);
      ablauf = [einPunktAblauf(detail, names)];
    }
    // Ab hier kein await mehr: Prüfen und Schreiben stehen direkt hintereinander (7.3).
    if (!istAktuell(a, gen)) return;
    const basis = d.leseShow(a.path);
    if (!basis) {
      statusGestoert(TEXT_SHOW_NICHT_LESBAR);
      return;
    }
    const speakers = basis.iveo?.speakers ?? [];
    const sig = ablaufSignatur(ablauf, speakers);
    if (sig === a.lastSig) {
      // Die Datei entspricht genau diesem Kontext → merken, sonst lädt jede Abfrage ihn neu.
      a.sideCtx = ctx;
      statusOk();
      return; // nichts geändert → kein RELOAD
    }
    d.log.info(`iveo: Agenda von Side Event geändert → ${ablauf.length} Punkte neu.`);
    const ok = schreibeAblauf(a.path, basis, {
      slug: a.event,
      baseUrl: a.baseUrl,
      name: basis.iveo?.name || a.event,
      ablauf,
      speakers,
      filter: a.filter,
    });
    if (!ok) {
      statusGestoert(TEXT_NICHT_GESCHRIEBEN);
      return;
    }
    a.lastSig = sig;
    a.sideCtx = ctx;
    statusOk();
    benachrichtigeAlle();
  }

  /** Umschalten (Spec 7.2, 7.3, 7.6). Aufgabe A14 ersetzt diesen Platzhalter. */
  async function umschalten(_input: { programId?: string; day?: string }): Promise<{ ok: boolean; message: string }> {
    return { ok: false, message: 'noch nicht verdrahtet' };
  }

  /** Speichern der offenen Show im Show-Editor (Spec 7.5). Aufgabe A14 ersetzt diesen Platzhalter. */
  function offeneShowGespeichert(_pfad: string, _neuGebunden: boolean): void {
    /* Platzhalter, siehe A14 */
  }

  function aktiv(): { path: string; event: string; filter: IveoProgramFilter } | null {
    return active ? { path: active.path, event: active.event, filter: { ...active.filter } } : null;
  }

  return { showGeoeffnet, showGeschlossen, abfrage, umschalten, offeneShowGespeichert, aktiv };
}
```

- [ ] **Schritt 5: Test laufen lassen (grün)**

```
npm run selftest:iveo -w @jm/launcher
```

Erwartet: keine `FAIL`-Zeile, letzte Zeile
```
63 ok, 0 fehlgeschlagen.
```
Exit-Code 0. (15 Fälle aus A12, 48 neue.) Meldet tsx stattdessen `SyntaxError: The requested module '@jm/show' does not provide an export named 'normalizeAblauf'`, fehlt A1; tragen die Dateien in den Fällen „Kennungen“ `-` statt `a1,a2,a3` bzw. `P1,P2,P3`, fehlt A2. Dann anhalten, nicht am Kern drehen.

- [ ] **Schritt 6: Typecheck**

```
npm run typecheck -w @jm/launcher
```

Erwartet: `typecheck:node` und `typecheck:web` ohne Fehlermeldung, Exit-Code 0.

- [ ] **Schritt 7: Commit**

```
git add apps/launcher/src/main/iveo-abgleich-kern.ts apps/launcher/test/iveo-abgleich.test.ts
git status --short
```

`git status --short` muss genau diese zwei Zeilen zeigen:
```
A  apps/launcher/src/main/iveo-abgleich-kern.ts
M  apps/launcher/test/iveo-abgleich.test.ts
```

```
git commit -m "feat(launcher): iveo-Abgleich-Kern ohne Electron - Abfrage mit Signatur, Generation und Status (Teil 2a, #235)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Nicht pushen (G7).

**Gegenprobe (beim Planen am Prototyp gemessen, kein Umsetzungsschritt):** Jede dieser absichtlichen Abweichungen im Kern macht mindestens einen Fall rot: `lastSig` beim Öffnen leer → Nr. 1, Nr. 2, Nr. 5; ohne Prüfung „active === a && generation === gen“ → Nr. 9; `lastSig` vor dem Schreiben → Nr. 10; kein `RUNDOWN RELOAD` → Nr. 12 u. a.; 1-Punkt-Ablauf mit `stagesById` → Nr. 5; Agenda-Fehler verschluckt → Nr. 3; Kontext-Fehler verschluckt → Nr. 4; keine Abfrage-Sperre → „7.3: läuft noch eine Abfrage …“; Listen-Modus ohne Signatur → Nr. 2; 401 ohne eigenen Text → Nr. 6; Statuswarnung bei jeder Wiederholung → Nr. 3; Abfragefenster rückt bei gleichem Stand nicht vor → Nr. 2.

**Abweichungen vom Gerüst:**
- Zusätzliche Exporte `einPunktAblauf`, `compactFilter`, `speakerNameMap`, `scheduleSafeForList`, `toClientError`: Der Kern braucht sie, und Binden/Discover/Materialien in der Hülle brauchen sie weiter. Sie sind wortgleich aus `iveo-sync.ts` übernommen (`einPunktAblauf` neu, Spec 7.2). **Übergabe an A15:** die Kopien in `iveo-sync.ts` löschen und aus `./iveo-abgleich-kern` importieren; beim Binden ohne Agenda `einPunktAblauf(source, names)` statt `programToAblaufItem(source, { stagesById, … })` (`iveo-sync.ts:185-190`).
- Schreibfehler und nicht lesbare Show-Datei in einer **Abfrage** setzen ebenfalls „gestört“ („Show konnte nicht geschrieben werden“ bzw. „Show-Datei nicht lesbar“). Spec 7.6 sagt „jeder Fehlschlag einer Abfrage“; 7.2 nennt für die Abfrage nur „kein RELOAD“. Ohne Statuszeile bliebe ein dauerhafter Schreibfehler unsichtbar.
- Bei **gleicher Signatur** merkt der Agenda-Modus den nachgeladenen Kontext (`sideCtx`), obwohl nicht geschrieben wurde. Die Datei entspricht genau diesem Kontext; ohne Merken lüde jede Abfrage alle 45 s `getProgram` (und ggf. `listSpeakers`) neu. Spec 7.2 („Merker erst nach erfolgreichem Schreiben“) zielt auf den Fall, dass Speicher und Datei auseinanderlaufen; das tun sie hier nicht.
- Token fehlt bei einer Abfrage: Status „kein iveo-Token …“, `active` bleibt (früher `stopIveoPolling`). Kommt das Token zurück, läuft der Abgleich ohne Neuöffnen weiter.
- `meldeAktiv()` kommt bei **jedem** `showGeoeffnet`, auch ohne iveo-Bindung. **Übergabe an A15:** Die Hülle baut daraus `iveo-active-changed` aus ihrem `openShowIveo` und `kern.aktiv()` (ohne `openShowIveo` das leere Panel-Ereignis wie heute in `onShowOpened`); den Tag fürs Panel nimmt sie aus `kern.aktiv()?.filter.day ?? openShowIveo.day`.
- `showGeoeffnet` und `showGeschlossen` setzen den Status auf ok zurück: Eine Störung gehört zur vorigen Show. „seit“ ist der Beginn der Störung; ein neuer Fehlertext innerhalb derselben Störung behält ihn.
- `umschalten` und `offeneShowGespeichert` sind Platzhalter (`{ ok: false, message: 'noch nicht verdrahtet' }` bzw. ohne Wirkung), wie im Gerüst; kein Test prüft sie hier. A14 ersetzt sie.
- `schreibeCache(meta: unknown)` bleibt wie im Gerüst `unknown`; übergeben wird immer ein `IveoShowMetadata` aus `buildShowMetadata`.

---

### Aufgabe A14: Launcher – Abgleich-Kern: Umschalten und Speichern der offenen Show

**Spec:** 0 Nr. 2, 7.2 (1-Punkt-Ablauf ohne `stagesById`, Umschalten setzt `lastSig`, Schreibfehler → `ok: false`), 7.3 (Generation steigt bei jedem Umschalten, Umschaltungen nacheinander, Umschalten wartet nicht auf eine Abfrage), 7.5 Punkt 2 (Speichern der offenen Show), 7.6 (Umschalten: Agenda nicht abrufbar); Tests 9.6 Nr. 8 und 13. Globale Regeln G4, G5, G6, G7, G8, G9.

**Dateien:**
- Modify: `apps/launcher/src/main/iveo-abgleich-kern.ts` (Stand nach A13): Zeile 15 (Import `@jm/show`), Zeilen 27–28 (Import `@jm/iveo`), Zeile 90 (Texte), Zeilen 179–180 (Ende `einPunktAblauf`), Zeilen 208–209 (Zustand), Zeilen 311–312 (Anfang `abfrage`), Zeilen 467–475 (Platzhalter `umschalten` und `offeneShowGespeichert`)
- Modify: `apps/launcher/test/iveo-abgleich.test.ts` (Stand nach A13): Zeilen 523–524 (Zusammenfassung; der neue Abschnitt kommt davor)

Zeilenangaben gelten für den Stand vor dieser Aufgabe; nach früheren Schritten derselben Aufgabe verschieben sie sich. Maßgeblich ist immer der wortgleiche Vorher-Text (Edit-Werkzeug).

**Schnittstellen:**
- Consumes (aus A13, `apps/launcher/src/main/iveo-abgleich-kern.ts`; innerhalb von `erzeugeKern` als Closure verfügbar):
  - Zustand: `let active: AktiveShow | null`, `let offenePfad: string | null`, `let generation: number`, `let abfrageLaeuft: boolean`
  - `AktiveShow { path; event; baseUrl; lastSyncIso; filter: IveoProgramFilter; lastSig: string; sideCtx?: SideKontext }`, `type SideKontext = { firstStartMs: number | null; category?: string; speakerNames?: Array<[string, string]> }`
  - `istAktuell(a: AktiveShow, gen: number): boolean`, `statusGestoert(text: string): void`, `benachrichtigeAlle(): void`
  - `schreibeAblauf(pfad: string, basis: Show, w: { slug; baseUrl; name; ablauf; speakers; filter }): boolean`
  - `setzeAuf(pfad: string, show: Show): AktiveShow | null` (Generation + 1, `offenePfad`, `active` aus der Datei, `lastSig` aus der Datei, Status)
  - Modul-Ebene: `ablaufSignatur(ablauf, speakers)`, `einPunktAblauf(programm, namen?)`, `speakerNameMap(speakers)`, `scheduleSafeForList(filter, programs)`, `toClientError(e)`, `TEXT_NICHT_GESCHRIEBEN = 'Show konnte nicht geschrieben werden'`, `TEXT_SHOW_NICHT_LESBAR = 'Show-Datei nicht lesbar'`
  - Testdatei aus A13 mit `umgebung(baue, { ohneToken? })`, `showMit`, `agendaAblauf`, `listenAblauf`, `agendaP1`, `datei`, `ids`, `sperre`, `warteMs`, `ANA`, `TAG`, `SHOW_PFAD`
  - Bestehend aus `@jm/iveo`: `speakersToShowSpeakers(speakers: IveoSpeaker[]): ShowIveoSpeaker[]`, Typ `IveoAgendaItem`
- Produces: die in A13 als Platzhalter angelegten Methoden mit den Gerüst-Signaturen
  ```ts
  umschalten(input: { programId?: string; day?: string }): Promise<{ ok: boolean; message: string }>;
  offeneShowGespeichert(pfad: string, neuGebunden: boolean): void;
  ```
  `resolveSideEventLight` und die Tagesübersicht aus `switchSideEvent` (`iveo-sync.ts:749-873`) wandern in den Kern; A15 macht `switchSideEvent(input)` zu `kern.umschalten(input)`.

**Verhalten (verbindlich, aus der Spec):**
- `umschalten`: ohne `active` → `{ ok: false, message: 'Kein iveo-Token für die offene Show — Live-Umschalten nicht möglich.' }`; Token fehlt → `{ ok: false, message: 'iveo-Token nicht mehr vorhanden.' }` (beides wie heute). Sonst **Generation + 1** (eine laufende Abfrage verwirft ihr Ergebnis, das Umschalten wartet **nicht** auf sie). Umschaltungen laufen **nacheinander** (Kette). Während eines Umschaltens startet der Takt keine Abfrage.
  - Mit `programId`: Side Event leicht auflösen (Detail + Agenda). **Scheitert `listAgendaItems` → `{ ok: false, message: 'Agenda von iveo nicht abrufbar, bitte erneut versuchen' }`, nichts geschrieben** (7.6). Leere Agenda → 1-Punkt-Ablauf `einPunktAblauf(detail, namen)` ohne `stagesById` (7.2). Speaker nur bei Verknüpfung neu eingegrenzt, sonst bleibt die Liste der Datei (Meldung mit Hinweis wie heute).
  - Ohne `programId`: Tagesübersicht (`day` aus der Eingabe, sonst der bisherige), voller Snapshot, Ablauf wie im Listen-Modus.
  - Leerer Ablauf → `{ ok: false, message: 'Side Event nicht auflösbar (leerer Ablauf).' }` (wie heute).
  - Vor dem Schreiben `istAktuell(a, gen)`; danach ohne `await` lesen und schreiben. Schreiben scheitert → `{ ok: false, message: 'Show konnte nicht geschrieben werden' }`, **Merker unverändert** (7.2). Erst nach erfolgreichem Schreiben: `filter`, `sideCtx`, `lastSig` (`ablaufSignatur` des geschriebenen Stands), `lastSyncIso`; dann RELOAD an Timer, Titler, Rundown (Logzeile aus 7.1) und `meldeAktiv()`.
- `offeneShowGespeichert(pfad, neuGebunden)`: zählt nur für die gerade offene Show (Pfad ohne Rücksicht auf Groß-/Kleinschreibung, auch ohne iveo, Spec 0 Nr. 2). `active` wird aus der Datei neu aufgesetzt (Generation + 1, Filter, `lastSig`). Gleiche Bindung (`neuGebunden === false`, gleiches Event): Abfragefenster bleibt; gleiches Side Event: Kontext bleibt. Neu gebunden: beides frisch. Danach RELOAD an alle drei und `meldeAktiv()`.
- **Aufrufvertrag für die Hülle (A15):** `offeneShowGespeichert` synchron direkt nach dem synchronen Schreiben der Show aufrufen, ohne `await` dazwischen. Sonst könnte eine laufende Abfrage zwischen Schreiben und Meldung noch ihr altes Ergebnis über die gespeicherte Datei schreiben.

- [ ] **Schritt 1: Fehlschlagende Tests schreiben (Nr. 8, Nr. 13, Umschalten, Fehlerfälle)**

In `apps/launcher/test/iveo-abgleich.test.ts` vor der Zusammenfassung (Zeilen 523–524) einfügen.

Vorher:
```ts
// --- Zusammenfassung ---
console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
```

Nachher:
```ts
// --- Umschalten: Side Event, 1-Punkt, Tagesübersicht (Spec 7.2) ------------------------------------------------
{
  const u = umgebung((iv) => showMit(agendaAblauf(iv, 'P1'), { day: TAG, programId: 'P1' }, [ANA]));
  const r = await u.kern.umschalten({ programId: 'P2' });
  ck('Umschalten auf ein Side Event: ok, RELOAD an alle drei, Panel benachrichtigt',
    r.ok && u.schreibversuche === 1 && u.reloads.length === 3 && u.aktivMeldungen === 2);
  ck('… Meldung nennt die fehlende Speaker-Verknüpfung',
    r.message === 'Umgeschaltet — iveo verknüpft keine Speaker mit diesem Side Event — bestehende Speakerliste bleibt.');
  ck('… Datei: Agenda von P2 mit Kennungen, Filter P2, Tag und Speaker bleiben',
    ids(datei(u)) === 'b1,b2' && datei(u).iveo?.filter?.programId === 'P2' && datei(u).iveo?.filter?.day === TAG
    && datei(u).iveo?.speakers?.[0]?.name === 'Ana Silva');
  ck('… aktiv() zeigt das neue Side Event', u.kern.aktiv()?.filter.programId === 'P2');
  await u.kern.abfrage();
  ck('… die nächste Abfrage findet denselben Stand: nichts geschrieben (lastSig gesetzt, Kontext gemerkt)',
    u.schreibversuche === 1 && u.reloads.length === 3 && !u.iveo.abrufe.slice(2).includes('programm:P2'));
}
{
  const u = umgebung(agendaP1);
  const r = await u.kern.umschalten({ programId: 'P3' }); // P3 hat keine Agenda
  const a = datei(u).ablauf ?? [];
  ck('Umschalten auf ein Side Event ohne Agenda → 1 Punkt mit Programm-ID, ohne Bühnennamen (Spec 7.2)',
    r.ok && a.length === 1 && a[0].id === 'P3' && a[0].note === undefined);
  await u.kern.abfrage();
  ck('… danach kein Schein-„geändert“', u.schreibversuche === 1 && u.reloads.length === 3);
}
{
  const u = umgebung(agendaP1);
  const r = await u.kern.umschalten({ day: '2026-11-11' });
  ck('Tagesübersicht: ok, Filter ohne Side Event, neuer Tag',
    r.ok && u.kern.aktiv()?.filter.programId === undefined && u.kern.aktiv()?.filter.day === '2026-11-11');
  ck('… Datei: die Side Events dieses Tages, Bindung ohne programId', ids(datei(u)) === 'P4' && datei(u).iveo?.filter?.programId === undefined);
  u.iveo.geaendert = [u.iveo.programme[0]];
  await u.kern.abfrage();
  const seit = u.iveo.abrufe.filter((x) => x.startsWith('geaendert:')).map((x) => x.slice('geaendert:'.length));
  const snap = u.iveo.abrufe.find((x) => x.startsWith('snapshot:'))?.slice('snapshot:'.length) ?? '(kein Snapshot)';
  ck('… die nächste Listen-Abfrage fragt ab dem Umschalt-Snapshot ab und schreibt nichts', seit[0] === snap && u.schreibversuche === 1);
}

// --- Umschalten: Fehler (Spec 7.6, 7.2) ---------------------------------------------------------------------------
{
  const u = umgebung(agendaP1);
  u.iveo.fehler.agenda = new Error('fetch failed');
  const r = await u.kern.umschalten({ programId: 'P2' });
  ck('7.6: Agenda nicht abrufbar → Umschalten scheitert mit „Agenda von iveo nicht abrufbar, bitte erneut versuchen“',
    !r.ok && r.message === 'Agenda von iveo nicht abrufbar, bitte erneut versuchen');
  ck('7.6: … nichts geschrieben, kein RELOAD, Filter unverändert',
    u.schreibversuche === 0 && u.reloads.length === 0 && u.kern.aktiv()?.filter.programId === 'P1');
}
{
  const u = umgebung(agendaP1);
  u.schreibFehler = true;
  const r = await u.kern.umschalten({ programId: 'P2' });
  ck('7.2: Schreiben scheitert beim Umschalten → ok:false „Show konnte nicht geschrieben werden“',
    !r.ok && r.message === 'Show konnte nicht geschrieben werden');
  ck('7.2: … Merker nicht vorgerückt (Filter P1), kein RELOAD', u.kern.aktiv()?.filter.programId === 'P1' && u.reloads.length === 0);
  u.schreibFehler = false;
  await u.kern.abfrage();
  ck('7.2: … die nächste Abfrage läuft weiter auf P1 und findet den Stand der Datei', u.schreibversuche === 1 && u.iveo.abrufe.includes('agenda:P1'));
}
{
  const u = umgebung(agendaP1, { ohneToken: true });
  const r = await u.kern.umschalten({ programId: 'P2' });
  ck('Umschalten ohne Token → abgelehnt wie bisher',
    !r.ok && r.message === 'Kein iveo-Token für die offene Show — Live-Umschalten nicht möglich.' && u.clients.length === 0);
}

// --- 9.6 Nr. 8 und 7.3: Umschalten während laufender Abfrage; Umschaltungen nacheinander --------------------------
{
  const u = umgebung(agendaP1);
  u.iveo.agenda.P1 = u.iveo.agenda.P1.slice(0, 2); // die Abfrage hätte etwas zu schreiben
  const s = sperre();
  u.iveo.sperre = (abruf, arg) => (abruf === 'agenda' && arg === 'P1' ? s.halt : null);
  const abfrage = u.kern.abfrage();
  const r = await Promise.race([u.kern.umschalten({ programId: 'P2' }), warteMs(1000).then(() => null)]);
  ck('Nr. 8: Umschalten während laufender Abfrage → wartet nicht, gelingt', r !== null && r.ok);
  s.frei();
  await abfrage;
  ck('Nr. 8: … die Abfrage verwirft ihr Ergebnis: nur das Umschalten hat geschrieben',
    u.schreibversuche === 1 && u.reloads.length === 3 && ids(datei(u)) === 'b1,b2' && datei(u).iveo?.filter?.programId === 'P2');
}
{
  const u = umgebung(agendaP1);
  const s = sperre();
  u.iveo.sperre = (abruf, arg) => (abruf === 'agenda' && arg === 'P2' ? s.halt : null);
  const erstes = u.kern.umschalten({ programId: 'P2' });
  const zweites = u.kern.umschalten({ programId: 'P3' });
  await warteMs(20);
  ck('7.3: Umschaltungen laufen nacheinander (das zweite wartet auf das erste)', !u.iveo.abrufe.includes('programm:P3'));
  await u.kern.abfrage();
  ck('7.3: während eines Umschaltens startet keine Abfrage', !u.iveo.abrufe.includes('agenda:P1'));
  s.frei();
  const [r1, r2] = await Promise.all([erstes, zweites]);
  ck('7.3: … beide gelingen, am Ende gilt das zweite',
    r1.ok && r2.ok && u.kern.aktiv()?.filter.programId === 'P3' && datei(u).iveo?.filter?.programId === 'P3');
}
{
  const u = umgebung(agendaP1);
  const s = sperre();
  u.iveo.sperre = (abruf, arg) => (abruf === 'agenda' && arg === 'P2' ? s.halt : null);
  const lauf = u.kern.umschalten({ programId: 'P2' });
  await warteMs(20);
  u.kern.offeneShowGespeichert(SHOW_PFAD, false);
  s.frei();
  const r = await lauf;
  ck('7.3: die Show wird gespeichert, während ein Umschalten läuft → Umschalten verworfen, nichts geschrieben',
    !r.ok && u.schreibversuche === 0 && u.kern.aktiv()?.filter.programId === 'P1');
}

// --- 9.6 Nr. 13: Speichern der offenen Show im Editor (Spec 7.5) ---------------------------------------------------
{
  const u = umgebung((iv) => showMit(listenAblauf(iv, TAG), { day: TAG }, [ANA]));
  // Der Show-Editor bindet neu an Side Event P2 und speichert (synchron); dann meldet die Hülle es dem Kern.
  u.dateien.set(SHOW_PFAD, serializeShow(showMit(agendaAblauf(u.iveo, 'P2'), { day: TAG, programId: 'P2' })));
  u.kern.offeneShowGespeichert(SHOW_PFAD, true);
  ck('Nr. 13: Speichern der offenen Show → RELOAD an Timer, Titler und Rundown mit der Logzeile aus 7.1',
    u.reloads.length === 3 && u.info.includes('iveo: RELOAD → 1 Timer, 1 Titler, 1 Rundown benachrichtigt.'));
  ck('Nr. 13: … active neu aufgesetzt (neuer Filter), Panel benachrichtigt', u.kern.aktiv()?.filter.programId === 'P2' && u.aktivMeldungen === 2);
  await u.kern.abfrage();
  ck('Nr. 13: bei neuer Bindung nutzt die nächste Abfrage den neuen Filter (Agenda von P2)',
    u.iveo.abrufe.includes('agenda:P2') && !u.iveo.abrufe.some((x) => x.startsWith('geaendert:')));
  ck('Nr. 13: … und schreibt nichts (lastSig aus der gespeicherten Datei)', u.schreibversuche === 0);
}
{
  const u = umgebung(agendaP1);
  await u.kern.abfrage(); // Kontext geladen
  u.dateien.set(SHOW_PFAD, serializeShow({ ...datei(u), name: 'COP31 Tag 1 (umbenannt)' }));
  u.kern.offeneShowGespeichert(SHOW_PFAD, false);
  await u.kern.abfrage();
  ck('7.5: gleiche Bindung gespeichert → Side-Event-Kontext bleibt (kein zweiter Detail-Abruf), nichts geschrieben',
    u.iveo.abrufe.filter((x) => x === 'programm:P1').length === 1 && u.schreibversuche === 0 && u.reloads.length === 3);
}
{
  const u = umgebung(agendaP1);
  u.iveo.agenda.P1 = u.iveo.agenda.P1.slice(0, 2);
  const s = sperre();
  u.iveo.sperre = (abruf) => (abruf === 'agenda' ? s.halt : null);
  const lauf = u.kern.abfrage();
  u.kern.offeneShowGespeichert(SHOW_PFAD, false);
  s.frei();
  await lauf;
  ck('7.5: Speichern während einer Abfrage → die Abfrage verwirft ihr Ergebnis (Generation)', u.schreibversuche === 0);
}
{
  const u = umgebung(() => ({ schemaVersion: 1, name: 'Ohne iveo', tools: [], ablauf: [{ id: 'x1', label: 'Begrüßung' }] }));
  u.kern.offeneShowGespeichert('C:/Shows/Andere.jmshow', false);
  ck('7.5: eine ANDERE Show gespeichert → kein RELOAD', u.reloads.length === 0);
  u.kern.offeneShowGespeichert(SHOW_PFAD.toUpperCase(), false);
  ck('Spec 0.2: offene Show ohne iveo gespeichert (Pfad in anderer Schreibweise) → RELOAD an alle drei',
    u.reloads.length === 3 && u.kern.aktiv() === null);
}

// --- Zusammenfassung ---
console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
```

- [ ] **Schritt 2: Test laufen lassen (rot)**

```
npm run selftest:iveo -w @jm/launcher
```

Erwartet: Exit-Code ≠ 0, letzte Zeile
```
69 ok, 24 fehlgeschlagen.
```
darunter u. a.
```
FAIL  Umschalten auf ein Side Event: ok, RELOAD an alle drei, Panel benachrichtigt
FAIL  7.6: Agenda nicht abrufbar → Umschalten scheitert mit „Agenda von iveo nicht abrufbar, bitte erneut versuchen“
FAIL  Nr. 8: Umschalten während laufender Abfrage → wartet nicht, gelingt
FAIL  Nr. 13: Speichern der offenen Show → RELOAD an Timer, Titler und Rundown mit der Logzeile aus 7.1
FAIL  Spec 0.2: offene Show ohne iveo gespeichert (Pfad in anderer Schreibweise) → RELOAD an alle drei
```

- [ ] **Schritt 3: Implementierung – Importe**

In `apps/launcher/src/main/iveo-abgleich-kern.ts`, Zeile 15.

Vorher:
```ts
import { normalizeAblauf, type Show, type ShowAblaufItem, type ShowIveoSpeaker } from '@jm/show';
```

Nachher:
```ts
import { resolve } from 'node:path';
import { normalizeAblauf, type Show, type ShowAblaufItem, type ShowIveoSpeaker } from '@jm/show';
```

Und Zeilen 27–28.

Vorher:
```ts
  speakerName,
  type IveoClient,
```

Nachher:
```ts
  speakerName,
  speakersToShowSpeakers,
  type IveoAgendaItem,
  type IveoClient,
```

- [ ] **Schritt 4: Implementierung – Texte**

Zeile 90.

Vorher:
```ts
const TEXT_SHOW_NICHT_LESBAR = 'Show-Datei nicht lesbar';
```

Nachher:
```ts
const TEXT_SHOW_NICHT_LESBAR = 'Show-Datei nicht lesbar';
/** Spec 7.6 (Umschalten), wortgleich. */
const TEXT_AGENDA_NICHT_ABRUFBAR = 'Agenda von iveo nicht abrufbar, bitte erneut versuchen';
const TEXT_UMSCHALTEN_VERWORFEN = 'Show wurde inzwischen gewechselt oder gespeichert, Umschalten verworfen.';
```

- [ ] **Schritt 5: Implementierung – Pfadvergleich**

Zeilen 179–180 (Ende von `einPunktAblauf`).

Vorher:
```ts
  return programToAblaufItem(programm, { withSchedule: true, speakerNamesById: namen });
}
```

Nachher:
```ts
  return programToAblaufItem(programm, { withSchedule: true, speakerNamesById: namen });
}

/** Windows: Groß-/Kleinschreibung im Pfad zählt nicht (gleiche Regel wie der Gedächtnis-Schlüssel, Spec 4.7). */
function pfadSchluessel(p: string): string {
  return resolve(p).toLowerCase();
}
```

- [ ] **Schritt 6: Implementierung – Zustand für Umschalten**

Zeilen 208–209 (in `erzeugeKern`).

Vorher:
```ts
  let abfrageLaeuft = false;
  let status: IveoSyncStatus = { ok: true };
```

Nachher:
```ts
  let abfrageLaeuft = false;
  /** Während eines Umschaltens startet der Takt keine Abfrage — sie rechnete noch mit dem alten Filter. */
  let umschaltenLaeuft = false;
  /** Umschaltungen laufen nacheinander (7.3). */
  let kette: Promise<unknown> = Promise.resolve();
  let status: IveoSyncStatus = { ok: true };
```

- [ ] **Schritt 7: Implementierung – keine Abfrage während eines Umschaltens**

Zeilen 311–312 (Anfang von `abfrage`).

Vorher:
```ts
    // 7.3: Abfragen laufen nacheinander. Läuft noch eine, startet der Takt keine zweite.
    if (abfrageLaeuft) return;
```

Nachher:
```ts
    // 7.3: Abfragen laufen nacheinander. Läuft noch eine (oder ein Umschalten), startet der Takt keine zweite.
    if (abfrageLaeuft || umschaltenLaeuft) return;
```

- [ ] **Schritt 8: Implementierung – Umschalten und Speichern der offenen Show**

Zeilen 467–475 (die beiden Platzhalter) ersetzen.

Vorher:
```ts
  /** Umschalten (Spec 7.2, 7.3, 7.6). Aufgabe A14 ersetzt diesen Platzhalter. */
  async function umschalten(_input: { programId?: string; day?: string }): Promise<{ ok: boolean; message: string }> {
    return { ok: false, message: 'noch nicht verdrahtet' };
  }

  /** Speichern der offenen Show im Show-Editor (Spec 7.5). Aufgabe A14 ersetzt diesen Platzhalter. */
  function offeneShowGespeichert(_pfad: string, _neuGebunden: boolean): void {
    /* Platzhalter, siehe A14 */
  }
```

Nachher:
```ts
  /**
   * Ein Side Event leichtgewichtig auflösen (früher resolveSideEventLight): Detail + Agenda, KEIN voller Snapshot.
   * Spec 7.6: Scheitert die Agenda, scheitert das Umschalten (null) — nie ein Ersatz-Ablauf aus dem Detail.
   * Speaker werden nur neu eingegrenzt, wenn iveo eine Verknüpfung liefert; sonst bleibt die Liste der Datei.
   */
  async function loeseSideEventLeicht(
    client: IveoClientLike,
    event: string,
    programId: string,
    ersatzSpeakers: ShowIveoSpeaker[],
  ): Promise<{ ablauf: ShowAblaufItem[]; speakers: ShowIveoSpeaker[]; warning?: string; sideCtx?: SideKontext } | null> {
    const detail = await client.getProgram(event, programId).catch((e: unknown) => {
      d.log.warn(`iveo switch: Detail „${programId}" nicht abrufbar (${(e as Error).message}).`);
      return null;
    });
    let agenda: IveoAgendaItem[];
    try {
      agenda = await client.listAgendaItems(event, programId);
    } catch (e) {
      d.log.warn(`iveo switch: agenda-items „${programId}" nicht abrufbar (${(e as Error).message}).`);
      return null;
    }
    const ids = [
      ...new Set<string>([...extractSpeakerIds(detail), ...agenda.flatMap((it) => extractSpeakerIds(it))]),
    ];
    let speakers = ersatzSpeakers;
    let warning: string | undefined;
    // Namensquelle für „Verantwortlich“: nur die volle Speakerliste trägt ids. Ohne Verknüpfung bleibt owner leer.
    let namen: Map<string, string> | undefined;
    if (ids.length) {
      try {
        const alle = await client.listSpeakers(event);
        speakers = speakersToShowSpeakers(alle.filter((s) => ids.includes(s.id)));
        namen = speakerNameMap(alle);
        d.log.info(`iveo switch: ${ids.length} Speaker verknüpft, ${speakers.length} aufgelöst.`);
      } catch {
        /* Speakerliste nicht ladbar → Ersatzliste bleibt, owner bleibt leer */
      }
    } else {
      if (detail) d.log.info(`iveo switch: Programm-Detail-Felder = ${Object.keys(detail).join(', ')}`);
      if (agenda[0]) d.log.info(`iveo switch: Agenda-Item-Felder = ${Object.keys(agenda[0]).join(', ')}`);
      warning = 'iveo verknüpft keine Speaker mit diesem Side Event — bestehende Speakerliste bleibt.';
    }
    const firstStartMs = detail ? localTimeOfDayMs(detail) : null;
    const category = ((detail?.format_slug || detail?.type_slug) || '').trim() || undefined;
    let ablauf = agendaToAblauf(agenda, { firstStartMs, category, speakerNamesById: namen });
    if (!ablauf.length && detail) ablauf = [einPunktAblauf(detail, namen)];
    d.log.info(
      `iveo: Side Event „${detail?.title?.trim() || programId}" — Agenda-Punkte: ${agenda.length}` +
        `${agenda.length ? '' : ' (keine → Programm als 1 Punkt)'}.`,
    );
    return {
      ablauf,
      speakers,
      warning,
      // Ohne Detail keinen Kontext merken: die nächste Abfrage lädt ihn nach (7.6) und trägt Startzeit/Kategorie nach.
      sideCtx: detail ? { firstStartMs, category, speakerNames: namen ? [...namen] : undefined } : undefined,
    };
  }

  /**
   * Ein Umschalten (früher switchSideEvent). Generation + 1: eine laufende Abfrage verwirft ihr Ergebnis, das
   * Umschalten wartet NICHT auf sie (7.3) — so bleibt `LAUNCHER SIDEEVENT` per Rundown-GO schnell, wenn iveo hängt.
   * Merker (filter, sideCtx, lastSig, lastSyncIso) erst nach erfolgreichem Schreiben (7.2).
   */
  async function umschaltenJetzt(input: { programId?: string; day?: string }): Promise<{ ok: boolean; message: string }> {
    const a = active;
    if (!a) return { ok: false, message: 'Kein iveo-Token für die offene Show — Live-Umschalten nicht möglich.' };
    const tok = d.token(a.event);
    if (!tok) return { ok: false, message: 'iveo-Token nicht mehr vorhanden.' };
    const gen = ++generation;
    umschaltenLaeuft = true;
    try {
      const client = d.clientFabrik(tok, a.baseUrl);
      const programId = input.programId?.trim();
      let ablauf: ShowAblaufItem[];
      let speakers: ShowIveoSpeaker[];
      let filter: IveoProgramFilter;
      let sideCtx: SideKontext | undefined;
      let warning: string | undefined;
      let name: string | undefined;
      let lastSyncIso = a.lastSyncIso;
      if (programId) {
        const r = await loeseSideEventLeicht(client, a.event, programId, d.leseShow(a.path)?.iveo?.speakers ?? []);
        if (!r) return { ok: false, message: TEXT_AGENDA_NICHT_ABRUFBAR };
        ({ ablauf, speakers, warning, sideCtx } = r);
        filter = { ...a.filter, programId };
      } else {
        // Tagesübersicht: alle Side Events des Tages (voller Snapshot nötig).
        const day = input.day || a.filter.day;
        const snap = await client.getEventSnapshot(a.event, d.jetztIso(), { onSubError: () => {} });
        filter = { ...a.filter, programId: undefined, day };
        const listPrograms = filterPrograms(snap.programs, filter);
        ablauf = programsToAblauf(listPrograms, {
          stagesById: new Map(snap.stages.map((s) => [s.id, s])),
          // F3: nur bei eindeutiger Tageszugehörigkeit (s. scheduleSafeForList).
          withSchedule: scheduleSafeForList(filter, listPrograms),
          speakerNamesById: speakerNameMap(snap.speakers),
        });
        speakers = snapshotToShowSpeakers(snap);
        name = snap.event.name;
        lastSyncIso = snap.fetchedAt;
        d.schreibeCache(buildShowMetadata(snap, a.baseUrl));
      }
      if (!ablauf.length) return { ok: false, message: 'Side Event nicht auflösbar (leerer Ablauf).' };
      // Ab hier kein await mehr (7.3): Show inzwischen gewechselt oder gespeichert → verwerfen, nichts schreiben.
      if (!istAktuell(a, gen)) return { ok: false, message: TEXT_UMSCHALTEN_VERWORFEN };
      const basis = d.leseShow(a.path);
      const geschrieben =
        basis !== null &&
        schreibeAblauf(a.path, basis, {
          slug: a.event,
          baseUrl: a.baseUrl,
          name: name ?? (basis.iveo?.name || a.event),
          ablauf,
          speakers,
          filter,
        });
      if (!geschrieben) return { ok: false, message: TEXT_NICHT_GESCHRIEBEN };
      a.filter = filter;
      a.sideCtx = sideCtx;
      a.lastSig = ablaufSignatur(ablauf, speakers);
      a.lastSyncIso = lastSyncIso;
      d.log.info(`iveo: Side-Event-Umschaltung → ${ablauf.length} Punkte, ${speakers.length} Speaker.`);
      benachrichtigeAlle();
      d.meldeAktiv();
      return { ok: true, message: warning ? `Umgeschaltet — ${warning}` : `Umgeschaltet (${ablauf.length} Punkte).` };
    } catch (e) {
      d.log.warn(`iveo switch fehlgeschlagen: ${(e as Error).message}`);
      return { ok: false, message: toClientError(e).error };
    } finally {
      umschaltenLaeuft = false;
    }
  }

  /** Umschaltungen nacheinander (7.3); ein Umschalten wartet nie auf eine Abfrage. */
  function umschalten(input: { programId?: string; day?: string }): Promise<{ ok: boolean; message: string }> {
    const lauf = kette.then(() => umschaltenJetzt(input));
    kette = lauf.catch(() => {});
    return lauf;
  }

  /**
   * Spec 7.5: Der Show-Editor hat eine Show gespeichert. Zählt nur für die gerade offene Show (auch ohne iveo).
   * Die Hülle ruft das SYNCHRON direkt nach dem synchronen Schreiben auf, ohne await dazwischen — sonst könnte
   * eine laufende Abfrage die eben gespeicherte Datei noch überschreiben. Generation + 1, `active` aus der Datei
   * neu (Filter, lastSig), RELOAD an Timer, Titler und Rundown.
   */
  function offeneShowGespeichert(pfad: string, neuGebunden: boolean): void {
    if (offenePfad === null || pfadSchluessel(pfad) !== pfadSchluessel(offenePfad)) return;
    const vorher = active;
    const show = d.leseShow(offenePfad);
    if (show) {
      const neu = setzeAuf(offenePfad, show);
      // Gleiche Bindung: Abfragefenster und Side-Event-Kontext gelten weiter. Neu gebunden: beides frisch.
      if (neu && vorher && !neuGebunden && vorher.event === neu.event) {
        neu.lastSyncIso = vorher.lastSyncIso;
        if (vorher.filter.programId === neu.filter.programId) neu.sideCtx = vorher.sideCtx;
      }
    } else {
      // Gerade gespeichert und doch nicht lesbar: lieber anhalten als mit dem alten Filter weiterschreiben.
      generation++;
      active = null;
      statusGestoert(TEXT_SHOW_NICHT_LESBAR);
    }
    benachrichtigeAlle();
    d.meldeAktiv();
  }
```

- [ ] **Schritt 9: Test laufen lassen (grün)**

```
npm run selftest:iveo -w @jm/launcher
```

Erwartet: keine `FAIL`-Zeile, letzte Zeile
```
93 ok, 0 fehlgeschlagen.
```
Exit-Code 0.

- [ ] **Schritt 10: Typecheck**

```
npm run typecheck -w @jm/launcher
```

Erwartet: `typecheck:node` und `typecheck:web` ohne Fehlermeldung, Exit-Code 0.

- [ ] **Schritt 11: Commit**

```
git add apps/launcher/src/main/iveo-abgleich-kern.ts apps/launcher/test/iveo-abgleich.test.ts
git status --short
```

`git status --short` muss genau diese zwei Zeilen zeigen:
```
M  apps/launcher/src/main/iveo-abgleich-kern.ts
M  apps/launcher/test/iveo-abgleich.test.ts
```

```
git commit -m "feat(launcher): iveo-Kern - Umschalten ohne Warten auf die Abfrage, Speichern der offenen Show laedt alle Tools neu (Teil 2a, #235)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Nicht pushen (G7).

**Gegenprobe (beim Planen am Prototyp gemessen, kein Umsetzungsschritt):** Umschalten ohne Generation + 1 → Nr. 8; Merker vor dem Schreiben → „7.2: … Merker nicht vorgerückt“; Agenda-Fehler beim Umschalten toleriert (alter Stand) → „7.6: …“; ohne Kette → „7.3: Umschaltungen laufen nacheinander“; Umschalten wartet auf die Abfrage → Nr. 8 (Zeitgrenze 1 s statt Hänger); Speichern ohne Generation → „7.5: Speichern während einer Abfrage“ und „7.3: … während ein Umschalten läuft“; Pfadvergleich mit Groß-/Kleinschreibung → „Spec 0.2“; Abfrage während eines Umschaltens erlaubt → „7.3: während eines Umschaltens startet keine Abfrage“; Kontext beim Speichern nie übernommen → „7.5: gleiche Bindung gespeichert“.

**Abweichungen vom Gerüst:**
- Während eines Umschaltens startet der Takt **keine Abfrage** (`umschaltenLaeuft`). Spec 7.3 regelt nur, dass das Umschalten nicht auf eine laufende Abfrage wartet. Eine Abfrage, die erst während des Umschaltens startet, trüge schon die neue Generation und rechnete noch mit dem alten Filter: Endete sie vor dem Umschalten, schriebe sie den alten Stand samt RELOAD, und die Tools sprängen kurz zurück.
- Wird die Show gewechselt oder gespeichert, während ein Umschalten läuft, verwirft es sein Ergebnis mit `{ ok: false, message: 'Show wurde inzwischen gewechselt oder gespeichert, Umschalten verworfen.' }`. Dieser Text steht nicht in der Spec.
- Liefert iveo beim Umschalten das Programm-Detail nicht, wird kein Side-Event-Kontext gemerkt (heute: ein leerer). Die nächste Abfrage lädt ihn nach (7.6) und trägt Startzeit und Kategorie nach, statt sie für den Rest der Sitzung wegzulassen.
- Tagesübersicht: `lastSyncIso` rückt auf den Zeitpunkt des Umschalt-Snapshots vor (heute bleibt es stehen). Spec 7.2 zählt `lastSyncIso` zu den Merkern, die nach erfolgreichem Schreiben vorrücken.
- Ein erfolgloses Umschalten ändert den Abgleich-Status nicht; der Fehler steht in der Antwort (`message`). Der Status beschreibt die Abfrage (7.6).
- Speichern der offenen Show, die danach nicht lesbar ist: Abgleich angehalten (`active = null`), Status „Show-Datei nicht lesbar“, RELOAD trotzdem. Lieber anhalten, als mit dem alten Filter über die neue Datei zu schreiben.
- **Übergabe an A15:** `switchSideEvent(input)` → `kern.umschalten(input)`; `saveShow` muss die gerade offene Show synchron schreiben (A12, `schreibeShowAtomar`) und direkt danach `kern.offeneShowGespeichert(pfad, neuGebunden)` aufrufen. `openShowIveo.day` setzt die Hülle nicht mehr selbst; der Tag kommt aus `kern.aktiv()?.filter.day`.

---

### Aufgabe A15: Launcher-Hülle `iveo-sync.ts`, Status bis ins Panel, Binden ohne `stagesById`, Speichern meldet dem Kern

**Spec:** 7.0 (Kern und Hülle, `JMPS_IVEO_POLL_MS`, `AbortSignal.timeout(15000)`), 7.1 (RELOAD an alle drei, im Kern), 7.2 (1-Punkt-Ablauf ohne `stagesById` beim Binden), 7.5 (Speichern der offenen Show → Kern), 7.6 (Ereignis `iveo-sync-status`, Zeile im iveo-Panel), 8 (Launcher Shared/Preload/Renderer).

**Dateien:**
- Create: `apps/launcher/src/main/iveo-huelle-hilfen.ts` (Takt, Zeitgrenze, Pfadvergleich — ohne Electron, testbar)
- Create: `apps/launcher/src/renderer/src/lib/iveo-status.ts` (Statuszeile fürs Panel — rein, testbar)
- Create: `apps/launcher/test/iveo-huelle.test.ts` (tsx)
- Modify: `apps/launcher/package.json` (Skript `selftest:iveo`, von A12 angelegt)
- Modify: `apps/launcher/src/main/iveo-sync.ts` — wird vollständig neu geschrieben (heute 972 Zeilen; Zeilen 399–873 „Live-Polling“ bis Ende `switchSideEvent` wandern in den Kern aus A13/A14)
- Modify: `apps/launcher/src/main/show.ts:1-11` (Importe), `:97-123` (`saveShow`)
- Modify: `apps/launcher/src/main/ipc.ts:106` (`show:save`)
- Modify: `apps/launcher/src/preload/index.ts:53` (`saveShow`)
- Modify: `apps/launcher/src/shared/types.ts:168-170` (`IveoSideEventsResult`), `:345-348` (`AppEvent`), `:375-379` (`JmpsApi.saveShow`)
- Modify: `apps/launcher/src/renderer/src/store/tools.ts:5-20, 72, 100, 205, 260-269, 403-409, 370-374`
- Modify: `apps/launcher/src/renderer/src/components/SideEventsPanel.tsx:1-3, 35, 44, 89-93`
- Nicht geändert: `apps/launcher/src/main/index.ts` (der Emitter aus `setIveoEmitter` reicht schon jedes `AppEvent` an den Renderer, Zeilen 82-87)

**Schnittstellen:**
- Consumes (A12, `apps/launcher/src/main/show-schreiben.ts`):
  ```ts
  export interface DateiSystem { writeFileSync(p: string, d: string, enc: 'utf8'): void; renameSync(a: string, b: string): void; unlinkSync(p: string): void; }
  export function schreibeShowAtomar(pfad: string, inhalt: string, fs: DateiSystem, warte: (ms: number) => void, log: (m: string) => void): boolean;
  /** Synchrones Warten für die Produktion (Atomics.wait auf einem SharedArrayBuffer). */
  export function warteSync(ms: number): void;
  ```
- Consumes (A13/A14, `apps/launcher/src/main/iveo-abgleich-kern.ts`):
  ```ts
  export interface KernAbhaengigkeiten {
    clientFabrik(token: string, baseUrl: string): IveoClientLike;
    token(event: string): string | undefined;
    leseShow(pfad: string): Show | null;
    schreibeShow(pfad: string, show: Show): boolean;
    benachrichtige(appId: 'jm-timer' | 'jm-titler' | 'jm-rundown', zeile: string): number;
    schreibeCache(meta: unknown): void;
    log: { info(m: string): void; warn(m: string): void };
    jetztIso(): string;
    meldeStatus(s: IveoSyncStatus): void;
    meldeAktiv(): void;
    baseUrlStandard(): string;
  }
  export interface IveoSyncStatus { ok: boolean; text?: string; seit?: string }
  export function erzeugeKern(d: KernAbhaengigkeiten): IveoKern;
  export interface IveoKern {
    showGeoeffnet(pfad: string, show: Show): void;
    showGeschlossen(): void;
    abfrage(): Promise<void>;
    umschalten(input: { programId?: string; day?: string }): Promise<{ ok: boolean; message: string }>;
    offeneShowGespeichert(pfad: string, neuGebunden: boolean): void;
    aktiv(): { path: string; event: string; filter: IveoProgramFilter } | null;
  }
  // reine Helfer, die A13 ausdrücklich für die Hülle exportiert (Binden/Discover):
  export function speakerNameMap(speakers: Array<Parameters<typeof speakerName>[0]>): Map<string, string>;
  export function scheduleSafeForList(filter: IveoProgramFilter, programs: IveoProgram[]): boolean;
  export function toClientError(e: unknown): { code?: string; error: string };
  export function einPunktAblauf(programm: IveoProgram, namen?: Map<string, string>): ShowAblaufItem; // ohne stagesById (7.2)
  ```
  Verhalten aus A13/A14, auf das die Hülle baut: `showGeoeffnet` und `offeneShowGespeichert` rufen am Ende selbst `meldeAktiv()`; `showGeoeffnet`/`showGeschlossen` setzen den Status zurück und `meldeStatus` kommt nur bei einem Wechsel; `abfrage()` wirft nie und kehrt ohne aktive Show sofort zurück; `offeneShowGespeichert` muss synchron direkt nach dem synchronen Schreiben kommen und prüft selbst (ohne Groß-/Kleinschreibung), ob es die offene Show ist.
- Produces (für A16, A17):
  ```ts
  // apps/launcher/src/main/iveo-sync.ts — bisherige Exporte mit gleichen Namen und Signaturen:
  export async function discoverIveoEvents(input: IveoDiscoverInput): Promise<IveoDiscoverResult>;
  export async function bindIveoEvent(input: IveoBindInput): Promise<IveoBindResult>;
  export function setIveoEmitter(fn: (e: AppEvent) => void): void;
  export function iveoStateKv(): Record<string, string>;
  export function onShowOpened(showPath: string, show: Show): void;
  export function stopIveoPolling(): void;
  export function listSideEvents(input?: IveoSideEventsInput): IveoSideEventsResult;
  export async function switchSideEvent(input: IveoSwitchInput): Promise<ActionResult>;
  export async function listSideEventMaterials(input: IveoMaterialsInput): Promise<IveoMaterialsResult>;
  export async function downloadSideEventMaterial(input: IveoDownloadInput): Promise<ActionResult>;
  // neu:
  export function speichereShowDatei(pfad: string, show: Show, neuGebunden: boolean): boolean;
  // apps/launcher/src/main/iveo-huelle-hilfen.ts
  export const IVEO_ABFRAGE_TAKT_MS = 45_000;
  export const IVEO_ABFRAGE_TAKT_MIN_MS = 500;
  export const IVEO_ABRUF_ZEITGRENZE_MS = 15_000;
  export function abfrageTakt(wert: string | undefined): number;
  export type FetchMitSignal = (url: string, init?: { method?: string; headers?: Record<string, string>; redirect?: 'follow' | 'manual'; signal?: AbortSignal }) => Promise<IveoFetchResponse>;
  export function mitZeitgrenze(f: FetchMitSignal, ms: number): IveoFetchLike;
  export function gleicherShowPfad(a: string, b: string): boolean;
  // apps/launcher/src/renderer/src/lib/iveo-status.ts
  export function iveoStatusZeile(s: IveoAbgleichStatus | null | undefined): string | null;
  // apps/launcher/src/shared/types.ts
  export interface IveoAbgleichStatus { ok: boolean; text?: string; seit?: string }
  // AppEvent neu: | ({ type: 'iveo-sync-status' } & IveoAbgleichStatus)
  // IveoSideEventsResult neu: syncStatus?: IveoAbgleichStatus
  // JmpsApi.saveShow: (show: Show, targetPath?: string, neuGebunden?: boolean) => Promise<ActionResult>
  // apps/launcher/src/main/show.ts
  export async function saveShow(show: Show, targetPath?: string, neuGebunden?: boolean): Promise<ActionResult>; // Default false
  // apps/launcher/src/renderer/src/store/tools.ts
  //   iveoSync: IveoAbgleichStatus | null
  //   saveShow: (show: Show, targetPath?: string, neuGebunden?: boolean) => Promise<boolean>
  ```

**Was zu wissen ist (für den Umsetzer):**
- Wer die heutigen Exporte importiert (gegrept): `control-server.ts:16` (`switchSideEvent`, `iveoStateKv`), `index.ts:15` (`setIveoEmitter`, `iveoStateKv`), `ipc.ts:47-54` (`discoverIveoEvents`, `bindIveoEvent`, `listSideEvents`, `switchSideEvent`, `listSideEventMaterials`, `downloadSideEventMaterial`), `show.ts:10` (`onShowOpened`). `stopIveoPolling` nutzt heute niemand außerhalb; der Export bleibt trotzdem.
- Die Logik aus `pollOnce`, `pollSideEvent`, `rewriteShowAblauf`, `resolveSideEventLight`, `readShowSpeakers` und dem Rumpf von `switchSideEvent` lebt seit A13/A14 im Kern. In der Hülle bleibt: Discover, Binden (inkl. `resolveSideEvent`), Metadaten-Cache (braucht `app.getPath`), Side-Event-Liste aus dem Cache, Materialien (Dialog, Shell), Renderer-Ereignisse, Takt.
- G4/G6: kein Token in Logs; die Hülle loggt nur, was der Code heute schon loggt.
- Zeilenenden: Der Worktree hat `core.autocrlf=true`; `show.ts`, `store/tools.ts` u. a. liegen dort mit CRLF, `shared/types.ts` mit LF. Die Vorher-Ausschnitte sind mit LF geschrieben und wurden gegen den echten Code geprüft (nach LF-Angleichung je genau ein Treffer). Trifft eine Ersetzung nicht, zuerst die Zeilenenden prüfen.
- Geprüft beim Planen (Scratch-Kopie, Prüfskripte in `teil2a-plan/pruef-a15-a18/`): Mit dem Code aus den Aufgaben A12, A13 und A14 (und einem `@jm/show` mit `id` und `normalizeAblauf` wie in A1) laufen `tsc -p tsconfig.node.json` und `tsc -p tsconfig.web.json` nach allen Schritten dieser Aufgabe ohne Fehler; `test/iveo-huelle.test.ts` ergibt `26 ok`.

- [ ] **Schritt 0: Vorbedingungen prüfen (A12–A14 erledigt, `iveo-sync.ts` unverändert seit dem Spec-Commit)**

```bash
grep -n "export function schreibeShowAtomar\|export interface DateiSystem" apps/launcher/src/main/show-schreiben.ts
grep -n "export function erzeugeKern\|export interface KernAbhaengigkeiten\|export interface IveoKern\|export interface IveoSyncStatus\|offeneShowGespeichert\|umschalten(\|export function einPunktAblauf\|export function toClientError\|export function speakerNameMap\|export function scheduleSafeForList" apps/launcher/src/main/iveo-abgleich-kern.ts
git diff --quiet 5a4b40eaa1 -- apps/launcher/src/main/iveo-sync.ts && echo "iveo-sync.ts unverändert"
node -p "require('./apps/launcher/package.json').scripts['selftest:iveo']"
```

Erwartet: je eine Fundstelle für die beiden Exporte aus A12, Fundstellen für alle Namen aus A13/A14, die Zeile `iveo-sync.ts unverändert` und als Skript `tsx test/iveo-abgleich.test.ts`. Fehlt etwas: A12–A14 zuerst abschließen, hier nicht weitermachen.

- [ ] **Schritt 1: Fehlschlagenden Test schreiben — `apps/launcher/test/iveo-huelle.test.ts` (neu)**

```ts
// iveo-Hülle des Launchers OHNE Electron (tsx): npm run selftest:iveo -w @jm/launcher
// Master-Link Teil 2a: Takt und Zeitgrenze (Spec 7.0), offene Show erkennen (7.5),
// Statuszeile im iveo-Panel (7.6). Der Rest der Hülle ist Electron-Verdrahtung und
// wird im Durchgang mit gebauten Programmen geprüft (Spec 9.8, apps/rundown/test/e2e-teil2a.mjs).
import { createServer, type AddressInfo } from 'node:http';
import { IveoClient, type IveoFetchResponse } from '@jm/iveo';
import {
  abfrageTakt, gleicherShowPfad, IVEO_ABFRAGE_TAKT_MS, IVEO_ABRUF_ZEITGRENZE_MS, mitZeitgrenze, type FetchMitSignal,
} from '../src/main/iveo-huelle-hilfen';
import { iveoStatusZeile } from '../src/renderer/src/lib/iveo-status';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}

console.log('— Abfragetakt (JMPS_IVEO_POLL_MS, Spec 7.0)');
ck('ohne Variable → 45 s', abfrageTakt(undefined) === 45_000);
ck('leer → 45 s', abfrageTakt('') === 45_000);
ck('2000 → 2 s (Durchgang 9.8)', abfrageTakt('2000') === 2000);
ck('2000.7 → 2000', abfrageTakt('2000.7') === 2000);
ck('500 → 500 (kürzester erlaubter Takt)', abfrageTakt('500') === 500);
ck('499 → 45 s (zu kurz, iveo nicht im Dauerfeuer)', abfrageTakt('499') === 45_000);
ck('0 → 45 s', abfrageTakt('0') === 45_000);
ck('60000 → 45 s (die Variable kann nur verkürzen)', abfrageTakt('60000') === 45_000);
ck('abc → 45 s', abfrageTakt('abc') === 45_000);
ck('Betriebstakt ist 45 s', IVEO_ABFRAGE_TAKT_MS === 45_000);
ck('Zeitgrenze je Abruf ist 15 s', IVEO_ABRUF_ZEITGRENZE_MS === 15_000);

console.log('— Zeitgrenze je Abruf (AbortSignal.timeout im fetchImpl)');
{
  let gesehen: Parameters<FetchMitSignal>[1];
  const haengt: FetchMitSignal = (_url, init) => {
    gesehen = init;
    return new Promise<IveoFetchResponse>((_ok, fehler) => {
      init?.signal?.addEventListener('abort', () => fehler(init.signal?.reason));
    });
  };
  // AbortSignal.timeout hält den Prozess nicht wach (unref) — ohne diesen Takt endete
  // node hier, bevor die Zeitgrenze feuert. In Electron läuft die Ereignisschleife ohnehin.
  const wach = setInterval(() => {}, 1000);
  const t0 = Date.now();
  const e = await mitZeitgrenze(haengt, 40)('http://127.0.0.1/x', { headers: { Authorization: 'Bearer t' }, redirect: 'manual' })
    .then(() => null, (x: unknown) => x);
  const dauer = Date.now() - t0;
  clearInterval(wach);
  ck('hängender Abruf bricht nach der Zeitgrenze ab', e !== null && dauer >= 30 && dauer < 2000);
  ck('… mit TimeoutError', (e as Error | null)?.name === 'TimeoutError');
  ck('Kopfzeilen und redirect bleiben erhalten', gesehen?.headers?.Authorization === 'Bearer t' && gesehen?.redirect === 'manual');

  const signale: Array<AbortSignal | undefined> = [];
  const merkt: FetchMitSignal = async (_url, init) => {
    signale.push(init?.signal);
    return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({}), text: async () => '{}', arrayBuffer: async () => new ArrayBuffer(0) };
  };
  const f = mitZeitgrenze(merkt, 1000);
  await f('http://127.0.0.1/a');
  await f('http://127.0.0.1/b');
  ck('jeder Abruf bekommt ein eigenes Signal', signale.length === 2 && !!signale[0] && !!signale[1] && signale[0] !== signale[1]);
}
{
  // Echter fetch gegen einen Server, der nie antwortet (iveo hängt): der Client gibt auf.
  const server = createServer(() => { /* antwortet nie */ });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as AddressInfo).port;
  const client = new IveoClient({ token: 't', baseUrl: `http://127.0.0.1:${port}/api/v1`, fetchImpl: mitZeitgrenze(fetch, 100), maxRetries: 0 });
  const t0 = Date.now();
  const e = await client.listAgendaItems('ev', 'p1').then(() => null, (x: unknown) => x);
  ck('IveoClient mit echtem fetch: hängender Server → Fehler nach der Zeitgrenze', e !== null && Date.now() - t0 < 3000);
  server.closeAllConnections();
  await new Promise<void>((r) => server.close(() => r()));
}

console.log('— offene Show erkennen (Spec 7.5)');
ck('gleicher Pfad', gleicherShowPfad('/shows/a.jmshow', '/shows/a.jmshow'));
ck('andere Schreibweise (Windows-Pfad)', gleicherShowPfad('C:\\Shows\\Gala.jmshow', 'c:\\shows\\GALA.jmshow'));
ck('mit .. im Pfad', gleicherShowPfad('/shows/x/../a.jmshow', '/shows/a.jmshow'));
ck('andere Datei', !gleicherShowPfad('/shows/a.jmshow', '/shows/b.jmshow'));

console.log('— Statuszeile im iveo-Panel (Spec 7.6)');
const seit = new Date(2026, 9, 1, 14, 5, 30).toISOString(); // 14:05 Ortszeit
ck('ok → keine Zeile', iveoStatusZeile({ ok: true }) === null);
ck('kein Status → keine Zeile', iveoStatusZeile(null) === null);
ck('401 → Text und Uhrzeit', iveoStatusZeile({ ok: false, text: 'Token ungültig oder widerrufen', seit }) === 'iveo-Abgleich gestört: Token ungültig oder widerrufen (seit 14:05)');
ck('kein Token → Text und Uhrzeit', iveoStatusZeile({ ok: false, text: 'kein iveo-Token auf diesem Rechner, nur Offline-Ablauf', seit }) === 'iveo-Abgleich gestört: kein iveo-Token auf diesem Rechner, nur Offline-Ablauf (seit 14:05)');
ck('ohne seit → ohne Klammer', iveoStatusZeile({ ok: false, text: 'X' }) === 'iveo-Abgleich gestört: X');
ck('unlesbares seit → ohne Klammer', iveoStatusZeile({ ok: false, text: 'X', seit: 'kaputt' }) === 'iveo-Abgleich gestört: X');

console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);
```

- [ ] **Schritt 2: Test laufen lassen, Fehlschlag sehen**

Run: `npx tsx apps/launcher/test/iveo-huelle.test.ts`
Expected: Abbruch mit `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…\apps\launcher\src\main\iveo-huelle-hilfen'` (das Modul gibt es noch nicht).

- [ ] **Schritt 3: `apps/launcher/src/main/iveo-huelle-hilfen.ts` anlegen (ganzer Inhalt)**

```ts
// Reine Helfer der iveo-Hülle (iveo-sync.ts), ohne Electron — testbar mit tsx
// (test/iveo-huelle.test.ts). Master-Link Teil 2a, Spec 7.0 und 7.5.
import { resolve } from 'node:path';
import type { IveoFetchLike, IveoFetchResponse } from '@jm/iveo';

/** Abfragetakt im Betrieb (Spec 7.0). */
export const IVEO_ABFRAGE_TAKT_MS = 45_000;
/** Kürzester Takt, den JMPS_IVEO_POLL_MS setzen darf — schützt iveo vor Dauerfeuer. */
export const IVEO_ABFRAGE_TAKT_MIN_MS = 500;
/** Zeitgrenze je Abruf (Spec 7.0). */
export const IVEO_ABRUF_ZEITGRENZE_MS = 15_000;

/**
 * Abfragetakt aus JMPS_IVEO_POLL_MS (nur für Tests, Spec 9.8). Eine Zahl von 500
 * bis 45000 verkürzt den Takt; alles andere (fehlt, keine Zahl, zu kurz, länger
 * als 45 s) lässt ihn bei 45 s — die Variable kann nur verkürzen.
 */
export function abfrageTakt(wert: string | undefined): number {
  if (!wert) return IVEO_ABFRAGE_TAKT_MS;
  const n = Math.trunc(Number(wert));
  if (!Number.isFinite(n) || n < IVEO_ABFRAGE_TAKT_MIN_MS || n > IVEO_ABFRAGE_TAKT_MS) return IVEO_ABFRAGE_TAKT_MS;
  return n;
}

/** fetch-Vertrag mit Abbruchsignal — der globale fetch erfüllt ihn. */
export type FetchMitSignal = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; redirect?: 'follow' | 'manual'; signal?: AbortSignal },
) => Promise<IveoFetchResponse>;

/**
 * Jeder Abruf bekommt sein eigenes Signal mit Zeitgrenze (Spec 7.0). Hängt iveo,
 * bricht der Abruf nach `ms` mit einem TimeoutError ab. Der Client wertet das wie
 * einen Netzfehler (Wiederholung, danach Fehler), statt die Abfrage ewig zu halten.
 */
export function mitZeitgrenze(f: FetchMitSignal, ms: number): IveoFetchLike {
  return (url, init) => f(url, { ...init, signal: AbortSignal.timeout(ms) });
}

/**
 * Meint `b` dieselbe Show-Datei wie `a`? Absolut aufgelöst und ohne Groß-/Klein-
 * schreibung verglichen (Windows-Pfade; wie der Gedächtnis-Schlüssel, Spec 4.7).
 */
export function gleicherShowPfad(a: string, b: string): boolean {
  return resolve(a).toLowerCase() === resolve(b).toLowerCase();
}
```

- [ ] **Schritt 4: `apps/launcher/src/renderer/src/lib/iveo-status.ts` anlegen (ganzer Inhalt)**

```ts
// Statuszeile des iveo-Abgleichs im iveo-Panel (Master-Link Teil 2a, Spec 7.6).
// Rein (zur Laufzeit keine Importe) — läuft im Renderer und im tsx-Test.
import type { IveoAbgleichStatus } from '@shared/types';

/** Uhrzeit „HH:MM“ (Ortszeit) aus einem ISO-Zeitpunkt; null, wenn nicht lesbar. */
function uhrzeit(iso: string | undefined): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return new Date(t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

/** „iveo-Abgleich gestört: <Text> (seit <Uhrzeit>)“ bei ok=false, sonst null. */
export function iveoStatusZeile(s: IveoAbgleichStatus | null | undefined): string | null {
  if (!s || s.ok) return null;
  const zeit = uhrzeit(s.seit);
  return `iveo-Abgleich gestört${s.text ? `: ${s.text}` : ''}${zeit ? ` (seit ${zeit})` : ''}`;
}
```

- [ ] **Schritt 5: Gemeinsame Typen — `apps/launcher/src/shared/types.ts`**

Ersetzung 1 (`IveoSideEventsResult`, Zeilen 168-170).
Vorher:
```ts
  /** Liegt hier ein Token → ist Live-Umschalten möglich? */
  canSwitch?: boolean;
}
```
Nachher:
```ts
  /** Liegt hier ein Token → ist Live-Umschalten möglich? */
  canSwitch?: boolean;
  /** Zustand des iveo-Abgleichs (Spec 7.6) — das Panel zeigt ihn beim Öffnen sofort. */
  syncStatus?: IveoAbgleichStatus;
}

/** Zustand des iveo-Abgleichs der offenen Show (Master-Link Teil 2a, Spec 7.6). */
export interface IveoAbgleichStatus {
  ok: boolean;
  /** Bei ok=false der Grund, z. B. „Token ungültig oder widerrufen“. */
  text?: string;
  /** ISO-Zeitpunkt, seit dem der Abgleich gestört ist. */
  seit?: string;
}
```

Ersetzung 2 (`AppEvent`, Zeilen 345-348).
Vorher:
```ts
  | { type: 'iveo-active-changed'; event: string; day?: string; activeProgramId?: string; canSwitch: boolean }
  // Master-Link Teil 1: Rolle, Kopplung, Teilnehmer oder Client-Zustand haben sich geändert.
```
Nachher:
```ts
  | { type: 'iveo-active-changed'; event: string; day?: string; activeProgramId?: string; canSwitch: boolean }
  // iveo-Abgleich (Spec 7.6): ok=false → das iveo-Panel zeigt „iveo-Abgleich gestört: <Text> (seit <Uhrzeit>)“.
  | ({ type: 'iveo-sync-status' } & IveoAbgleichStatus)
  // Master-Link Teil 1: Rolle, Kopplung, Teilnehmer oder Client-Zustand haben sich geändert.
```

Ersetzung 3 (`JmpsApi.saveShow`, Zeilen 375-379).
Vorher:
```ts
  /**
   * Zusammengestellte Show als .jmshow speichern. Mit `targetPath` (Bearbeiten)
   * wird direkt an diese Datei zurückgeschrieben; ohne fragt ein Save-Dialog.
   */
  saveShow: (show: Show, targetPath?: string) => Promise<ActionResult>;
```
Nachher:
```ts
  /**
   * Zusammengestellte Show als .jmshow speichern. Mit `targetPath` (Bearbeiten)
   * wird direkt an diese Datei zurückgeschrieben; ohne fragt ein Save-Dialog.
   * `neuGebunden`: im Editor neu an iveo gebunden — ist es die offene Show, nimmt
   * der Launcher die neue Bindung sofort auf (Spec 7.5).
   */
  saveShow: (show: Show, targetPath?: string, neuGebunden?: boolean) => Promise<ActionResult>;
```

- [ ] **Schritt 6: Skript `selftest:iveo` ergänzen — `apps/launcher/package.json`**

Vorher (so legt A12 die Zeile an):
```json
    "selftest:iveo": "tsx test/iveo-abgleich.test.ts",
```
Nachher:
```json
    "selftest:iveo": "tsx test/iveo-abgleich.test.ts && tsx test/iveo-huelle.test.ts",
```
Steht in Schritt 0 mehr in der Zeile, bleibt das Vorhandene stehen und ` && tsx test/iveo-huelle.test.ts` kommt direkt hinter `tsx test/iveo-abgleich.test.ts`.

- [ ] **Schritt 7: Test laufen lassen, Erfolg sehen**

Run: `npx tsx apps/launcher/test/iveo-huelle.test.ts`
Expected: letzte Zeile `26 ok, 0 fehlgeschlagen.`, Exit-Code 0.

Run: `npm run selftest:iveo -w @jm/launcher`
Expected: beide Testdateien grün (A12–A14-Fälle unverändert grün, danach `26 ok, 0 fehlgeschlagen.`).

- [ ] **Schritt 8: Typecheck**

Run: `npm run typecheck -w @jm/launcher`
Expected: ohne Fehler.

- [ ] **Schritt 9: Commit (Helfer)**

```bash
git add apps/launcher/src/main/iveo-huelle-hilfen.ts apps/launcher/src/renderer/src/lib/iveo-status.ts apps/launcher/test/iveo-huelle.test.ts apps/launcher/src/shared/types.ts apps/launcher/package.json
git status --short
git commit -m "feat(launcher): Takt, Zeitgrenze und Statuszeile für den iveo-Abgleich (reine Helfer)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
`git status --short` darf danach nur noch fremde, nicht zu dieser Aufgabe gehörende Pfade zeigen (keinen der fünf).

- [ ] **Schritt 10: `apps/launcher/src/main/iveo-sync.ts` als Hülle neu schreiben (ganzer neuer Inhalt)**

Die Datei wird vollständig ersetzt (Schritt 0 hat gezeigt, dass sie noch dem Stand von `5a4b40eaa1` entspricht). Gegenüber heute:
- Zeilen 399–873 (`ActiveShow`, `active`, `pollTimer`, `pollOnce`, `pollSideEvent`, `rewriteShowAblauf`, `readShowSpeakers`, `resolveSideEventLight`, Rumpf von `switchSideEvent`) entfallen — das macht der Kern.
- `compactFilter` (Zeilen 88-97) entfällt (nur `rewriteShowAblauf` nutzte ihn; er liegt jetzt im Kern).
- `speakerNameMap`, `scheduleSafeForList`, `humanize`, `toClientError` (Zeilen 111-139, 250-261) entfallen hier; `speakerNameMap`, `scheduleSafeForList` und `toClientError` kommen aus dem Kern.
- `resolveSideEvent`: 1-Punkt-Ablauf über `einPunktAblauf` aus dem Kern, also ohne `stagesById` (heute Zeilen 181, 189), kein `sideCtx` mehr im Ergebnis.
- `bindIveoEvent`: `sideCtx`-Merker (Zeilen 327, 335) und der Re-Bind-Block (Zeilen 349-364) entfallen.
- Discover, Binden und Materialliste nutzen den Client mit Zeitgrenze; das Herunterladen einer Datei nicht.

```ts
// ─────────────────────────────────────────────────────────────────────────────
// iveo-Live-Sync (#11) — der Launcher ist der EINZIGE iveo-Client/Token-Halter.
//
// Seit Master-Link Teil 2a (Spec 7.0) die dünne Electron-Hülle um den Kern
// `iveo-abgleich-kern.ts` (ohne Electron, testbar):
//   • discoverIveoEvents  — Token einmal prüfen + lesbare Events auflisten (GET /).
//   • bindIveoEvent       — Token (verschlüsselt, pro Event) ablegen, Event-Snapshot
//                           holen, zentralen Ablauf materialisieren (für den Show-
//                           Editor) + sanitisierten Metadaten-Cache schreiben.
//   • onShowOpened/Takt   — Abfrage, Umschalten, Signatur, Generation, Schreiben und
//                           Status macht der Kern; die Hülle liefert Einstellungen,
//                           Token, Health, Cache, Renderer-Ereignisse und den Takt.
//   • speichereShowDatei  — Show aus dem Show-Editor atomar schreiben; ist es die
//                           offene Show, setzt sich der Kern neu auf (Spec 7.5).
//   • Materialien         — Auflisten/Herunterladen (Dialog, Shell) bleibt hier.
//
// SICHERHEIT: Das Bearer-Token verlässt diesen Prozess NIE — weder in die
// (portable) .jmshow noch in den Cache noch in den Renderer. In die Show/den Cache
// kommen nur Daten (Ablauf + sanitisierte, feld-allowlistete Metadaten).
// ─────────────────────────────────────────────────────────────────────────────

import { app, dialog, shell } from 'electron';
import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getLog } from '@jm/app-runtime';
import { parseShow, serializeShow, type Show } from '@jm/show';
import {
  IveoClient,
  agendaToAblauf,
  buildShowMetadata,
  extractSpeakerIds,
  type IveoMaterial,
  filterPrograms,
  localTimeOfDayMs,
  programDayKey,
  programTaxonomy,
  programsToAblauf,
  snapshotToShowSpeakers,
  speakersToShowSpeakers,
  type IveoProgram,
  type IveoProgramFilter,
  type IveoShowMetadata,
  type IveoSnapshot,
} from '@jm/iveo';
import type { ShowIveoSpeaker } from '@jm/show';
import {
  getIveoToken,
  getIveoBaseToken,
  resolveIveoBaseUrl,
  setIveoToken,
  setIveoBaseToken,
} from './settings';
import { sendControlCommand } from './health';
import {
  einPunktAblauf,
  erzeugeKern,
  scheduleSafeForList,
  speakerNameMap,
  toClientError,
  type IveoKern,
  type IveoSyncStatus,
} from './iveo-abgleich-kern';
import { abfrageTakt, gleicherShowPfad, IVEO_ABRUF_ZEITGRENZE_MS, mitZeitgrenze } from './iveo-huelle-hilfen';
import { schreibeShowAtomar, warteSync } from './show-schreiben';
import type {
  ActionResult,
  AppEvent,
  IveoBindInput,
  IveoBindResult,
  IveoDiscoverInput,
  IveoDiscoverResult,
  IveoDownloadInput,
  IveoMaterialRef,
  IveoMaterialsInput,
  IveoMaterialsResult,
  IveoProgramRef,
  IveoSideEventsInput,
  IveoSideEventsResult,
  IveoSwitchInput,
} from '@shared/types';

/** Abfragetakt fürs Live-Update der offenen Show: 45 s; nur Tests verkürzen ihn (JMPS_IVEO_POLL_MS, Spec 7.0). */
const POLL_INTERVAL_MS = abfrageTakt(process.env['JMPS_IVEO_POLL_MS']);

function nowIso(): string {
  return new Date().toISOString();
}

/** Ablauf-Filter für Log/UI knapp beschreiben (leer = „alle"). */
function describeFilter(f: IveoProgramFilter): string {
  if (f.programId) return 'ein Side Event (Agenda)';
  const parts: string[] = [];
  if (f.day) parts.push(`Tag ${f.day}`);
  if (f.typeSlug) parts.push(`Typ ${f.typeSlug}`);
  if (f.formatSlug) parts.push(`Format ${f.formatSlug}`);
  if (f.excludeBlockers) parts.push('ohne Blocker');
  return parts.length ? parts.join(', ') : 'alle';
}

/** Leichte Programm-Referenzen (id/title/day) für die Side-Event-Auswahl im Editor. */
function toProgramList(programs: IveoProgram[]): IveoProgramRef[] {
  return [...programs]
    .sort((a, b) => {
      const da = programDayKey(a);
      const db = programDayKey(b);
      if (da !== db) return da.localeCompare(db);
      return (a.starts_at_local || a.starts_at || '').localeCompare(b.starts_at_local || b.starts_at || '');
    })
    .map((p) => ({ id: p.id, title: p.title?.trim() || '(ohne Titel)', day: programDayKey(p) }));
}

// speakerNameMap, scheduleSafeForList (F3), toClientError und einPunktAblauf liegen
// seit Teil 2a im Kern (iveo-abgleich-kern.ts) und werden von dort importiert.

/**
 * EIN Side Event „im Detail" auflösen (#11 Phase 3b): Ablauf = dessen Agenda-Punkte
 * (Fallback: das Programm selbst als ein Punkt), Speaker auf dieses Programm
 * eingegrenzt. iveo v1 verknüpft Programme nicht einheitlich mit Speakern — daher
 * tolerant (Detail + Listen-Programm auswerten) mit Fallback auf ALLE Speaker.
 * Den 1-Punkt-Ablauf baut `einPunktAblauf` aus dem Kern, OHNE `stagesById` — genau
 * wie Abfrage und Umschalten. Sonst brächte die erste Abfrage nach dem Binden bei
 * jedem Side Event ohne Agenda ein Schein-„geändert“ (Spec 7.2).
 */
async function resolveSideEvent(
  client: IveoClient,
  event: string,
  programId: string,
  snap: IveoSnapshot,
  onNote: (msg: string) => void,
): Promise<{
  ablauf: ReturnType<typeof agendaToAblauf>;
  speakers: ShowIveoSpeaker[];
  warning?: string;
}> {
  const listProgram = snap.programs.find((p) => p.id === programId);
  let detail: IveoProgram | null = null;
  try {
    detail = await client.getProgram(event, programId);
  } catch (e) {
    onNote(`Programm-Detail „${programId}" nicht abrufbar (${(e as Error).message}) — Listen-Daten genutzt.`);
  }
  let agenda: Awaited<ReturnType<IveoClient['listAgendaItems']>> = [];
  let agendaError = false;
  try {
    agenda = await client.listAgendaItems(event, programId);
  } catch (e) {
    agendaError = true;
    getLog().warn(`iveo: agenda-items „${programId}" nicht abrufbar (${(e as Error).message}).`);
    onNote(`Agenda nicht abrufbar (${(e as Error).message}).`);
  }
  const source = detail ?? listProgram;
  const title = source?.title?.trim() || programId;
  // Diagnose deutlich in den Haupt-Log: Agenda leer vs. Fehler vs. vorhanden.
  if (!agendaError) {
    getLog().info(`iveo: Side Event „${title}" — Agenda-Punkte: ${agenda.length}${agenda.length ? '' : ' (in iveo keine Agenda gepflegt → Programm als 1 Punkt)'}.`);
  }
  const names = speakerNameMap(snap.speakers);
  const firstStartMs = source ? localTimeOfDayMs(source) : null;
  const category = ((source?.format_slug || source?.type_slug) || '').trim() || undefined;
  const ablauf =
    agenda.length > 0
      ? agendaToAblauf(agenda, { firstStartMs, category, speakerNamesById: names })
      : source
        ? [einPunktAblauf(source, names)]
        : [];
  // Speaker-Verknüpfung tolerant aus Detail + Listen-Programm + Agenda-Items ziehen
  // (iveo v1 surft die Verknüpfung bislang nicht; sobald sie kommt — egal ob am
  // Programm oder an den Agenda-Punkten — greift das hier automatisch).
  const ids = new Set<string>([
    ...extractSpeakerIds(detail),
    ...extractSpeakerIds(listProgram),
    ...agenda.flatMap((it) => extractSpeakerIds(it)),
  ]);
  let speakers: ShowIveoSpeaker[];
  let warning: string | undefined;
  if (ids.size > 0) {
    speakers = speakersToShowSpeakers(snap.speakers.filter((s) => ids.has(s.id)));
    getLog().info(`iveo: Side Event „${title}" — ${ids.size} Speaker verknüpft, ${speakers.length} im Event aufgelöst.`);
  } else {
    // Diagnose: welche Felder tragen Detail UND ein Agenda-Item? (nur Schlüssel,
    // keine PII) — zeigt eine evtl. anders benannte/verschobene Speaker-Verknüpfung.
    if (detail) getLog().info(`iveo: Programm-Detail-Felder = ${Object.keys(detail).join(', ')}`);
    if (agenda[0]) getLog().info(`iveo: Agenda-Item-Felder = ${Object.keys(agenda[0]).join(', ')}`);
    speakers = snapshotToShowSpeakers(snap);
    warning = 'iveo verknüpft für dieses Side Event keine Speaker — es werden alle Event-Speaker gezeigt.';
  }
  return { ablauf, speakers, warning };
}

// ── Metadaten-Cache (appData, token-frei) ────────────────────────────────────
function cacheDir(): string {
  return join(app.getPath('userData'), 'iveo-cache');
}
function cacheFile(slug: string): string {
  return join(cacheDir(), `${slug.replace(/[^a-z0-9_-]/gi, '_')}.json`);
}
function writeCache(meta: IveoShowMetadata): void {
  try {
    mkdirSync(cacheDir(), { recursive: true });
    writeFileSync(cacheFile(meta.slug), JSON.stringify(meta, null, 2), { mode: 0o600 });
  } catch (e) {
    getLog().warn(`iveo: Metadaten-Cache schreiben fehlgeschlagen: ${(e as Error).message}`);
  }
}
function readCache(slug: string): IveoShowMetadata | null {
  try {
    return JSON.parse(readFileSync(cacheFile(slug), 'utf8')) as IveoShowMetadata;
  } catch {
    return null; // kein Cache (Show auf anderem Rechner gebunden) — kein Fehler
  }
}

/** Tag (YYYY-MM-DD) eines gecachten Programms — camelCase, NICHT über programDayKey. */
function metaProgramDay(p: IveoShowMetadata['programs'][number]): string {
  return (p.startsAtLocal || p.startsAt || '').slice(0, 10);
}
/** Lokale Uhrzeit (HH:MM) eines gecachten Programms, falls vorhanden. */
function metaProgramTime(p: IveoShowMetadata['programs'][number]): string | undefined {
  const s = p.startsAtLocal || '';
  const m = /T(\d{2}:\d{2})/.exec(s);
  return m ? m[1] : undefined;
}

/** iveo-Client mit Zeitgrenze je Abruf (15 s, Spec 7.0) — Abfrage, Umschalten, Binden, Listen. */
function iveoClient(token: string, baseUrl: string): IveoClient {
  return new IveoClient({
    token,
    baseUrl,
    fetchImpl: mitZeitgrenze((url, init) => fetch(url, init), IVEO_ABRUF_ZEITGRENZE_MS),
  });
}

// ── Discover / Bind (vom Show-Editor via IPC aufgerufen) ─────────────────────

export async function discoverIveoEvents(input: IveoDiscoverInput): Promise<IveoDiscoverResult> {
  const baseUrl = input.baseUrl?.trim() || resolveIveoBaseUrl();
  // C4: kein Token im Feld → den für diese Basis gemerkten nutzen (ein Token gilt
  // basis-weit — die Discovery listet ALLE lesbaren Events), damit ein neues Event
  // derselben Org kein erneutes Einfügen erzwingt. Discover persistiert selbst nichts.
  const token = input.token?.trim() || getIveoBaseToken(baseUrl);
  if (!token) return { ok: false, error: 'Token fehlt.' };
  try {
    const client = iveoClient(token, baseUrl);
    const events = await client.discovery();
    return { ok: true, events };
  } catch (e) {
    getLog().warn(`iveo discover fehlgeschlagen: ${(e as Error).message}`);
    return { ok: false, ...toClientError(e) };
  }
}

export async function bindIveoEvent(input: IveoBindInput): Promise<IveoBindResult> {
  const baseUrl = input.baseUrl?.trim() || resolveIveoBaseUrl();
  // C4: Token-Fallback wie bei discover (basis-weit gemerkter Token).
  const token = input.token?.trim() || getIveoBaseToken(baseUrl);
  const event = input.event?.trim();
  if (!token || !event) return { ok: false, error: 'Token und Event erforderlich.' };
  try {
    const client = iveoClient(token, baseUrl);
    // Initialer Bind resilient: ein serverseitiger 500 (z. B. auf /programs) soll
    // nicht ALLES blockieren — Event + verfügbare Daten binden, Rest als Warnung.
    const skipped: string[] = [];
    const snap = await client.getEventSnapshot(event, nowIso(), {
      programsBestEffort: true,
      onSubError: (resource, e) => {
        skipped.push(resource);
        getLog().warn(`iveo bind: „${resource}" übersprungen (${(e as Error).message})`);
      },
    });
    // Programm-Filter (#11): nur gewählten Typ/Format/Tag in den Ablauf (z. B. Side
    // Events). Taxonomie + Programm-Liste aus ALLEN Programmen für die Auswahl im Editor.
    const taxonomy = programTaxonomy(snap.programs);
    const programList = toProgramList(snap.programs);
    // Side Events des Tages (token-frei, id+title) → in die Show backen, damit
    // Launcher-Panel/Rundown live umschalten können (ohne selbst iveo abzufragen).
    const dayFilter: IveoProgramFilter = {
      typeSlug: input.typeSlug,
      formatSlug: input.formatSlug,
      day: input.day,
      excludeBlockers: input.excludeBlockers,
    };
    const sideEvents = toProgramList(filterPrograms(snap.programs, dayFilter)).map((p) => ({
      id: p.id,
      title: p.title,
    }));
    const filter: IveoProgramFilter = {
      typeSlug: input.typeSlug,
      formatSlug: input.formatSlug,
      day: input.day,
      excludeBlockers: input.excludeBlockers,
      programId: input.programId,
    };
    const subWarnings: string[] = [];
    let ablauf: ReturnType<typeof programsToAblauf>;
    let speakers: ShowIveoSpeaker[];
    let agendaMode = false;
    if (input.programId) {
      // Mode B (#11 Phase 3b): EIN Side Event „im Detail" — Ablauf aus dessen
      // Agenda, Speaker auf dieses Programm eingegrenzt.
      agendaMode = true;
      const resolved = await resolveSideEvent(client, event, input.programId, snap, (m) => subWarnings.push(m));
      ablauf = resolved.ablauf;
      speakers = resolved.speakers;
      if (resolved.warning) subWarnings.push(resolved.warning);
    } else {
      // Mode A: Liste (Tag/Typ/Format, ohne Blocker) → mehrere Side Events als Ablauf.
      const stagesById = new Map(snap.stages.map((s) => [s.id, s]));
      const listPrograms = filterPrograms(snap.programs, filter);
      ablauf = programsToAblauf(listPrograms, {
        stagesById,
        // F3: nur bei eindeutiger Tageszugehörigkeit (s. scheduleSafeForList).
        withSchedule: scheduleSafeForList(filter, listPrograms),
        speakerNamesById: speakerNameMap(snap.speakers),
      });
      speakers = snapshotToShowSpeakers(snap);
    }
    // Den Side-Event-Kontext der laufenden Abfrage frischt das Binden nicht mehr auf:
    // ihn hält der Kern (Spec 7.0). Speichert der Show-Editor die neu gebundene
    // offene Show, setzt sich der Kern aus der Datei neu auf und holt den Kontext bei
    // der nächsten Abfrage nach (speichereShowDatei → offeneShowGespeichert).
    const meta = buildShowMetadata(snap, baseUrl);
    // Token verschlüsselt ablegen (Schlüssel = kanonischer Slug), Cache schreiben.
    setIveoToken(snap.event.slug, token);
    // C4: zusätzlich basis-weit merken → nächstes Event derselben Org ohne Neu-Eingabe.
    setIveoBaseToken(baseUrl, token);
    writeCache(meta);
    const warnParts = [
      ...(skipped.length ? [`iveo lieferte für ${skipped.join(', ')} keine Daten (Server-Fehler)`] : []),
      ...subWarnings,
    ];
    const warning = warnParts.length ? warnParts.join(' · ') : undefined;
    const filterLabel = describeFilter(filter);
    getLog().info(
      `iveo: Event „${snap.event.name}" gebunden — ${ablauf.length}/${snap.programs.length} Programmpunkte ` +
        `(Filter: ${filterLabel}), ${speakers.length} Speaker${skipped.length ? ` (übersprungen: ${skipped.join(', ')})` : ''}.`,
    );
    return {
      ok: true,
      ablauf,
      speakers,
      event: { slug: snap.event.slug, name: snap.event.name },
      programTypes: taxonomy,
      programList,
      sideEvents,
      programCount: ablauf.length,
      agenda: agendaMode,
      ...(warning ? { warning } : {}),
    };
  } catch (e) {
    getLog().warn(`iveo bind fehlgeschlagen: ${(e as Error).message}`);
    return { ok: false, ...toClientError(e) };
  }
}

// ── Kern und Takt (Master-Link Teil 2a, Spec 7.0–7.6) ────────────────────────
// Abfrage (Listen- und Agenda-Modus), Umschalten, Signatur, Generation, sicheres
// Schreiben und Status liegen im Electron-freien Kern (iveo-abgleich-kern.ts). Die
// Hülle reicht Einstellungen, Token, Health, Cache und Renderer-Ereignisse hinein
// und treibt den Takt.

/** Dateizugriffe fürs atomare Schreiben (show-schreiben.ts); synchron gewartet wird mit `warteSync` von dort. */
const dateiSystem = { writeFileSync, renameSync, unlinkSync };

function leseShowDatei(pfad: string): Show | null {
  try {
    return parseShow(readFileSync(pfad, 'utf8'));
  } catch {
    return null; // gesperrt, fehlt oder kein gültiges JSON — der Kern entscheidet
  }
}

/** Show atomar schreiben: Zwischendatei, dann umbenennen; bei EPERM/EBUSY/EACCES bis zu 5 Versuche (Spec 7.4). */
function schreibeShowDatei(pfad: string, show: Show): boolean {
  return schreibeShowAtomar(pfad, serializeShow(show, nowIso()), dateiSystem, warteSync, (m) => getLog().warn(m));
}

/**
 * Token-freier Merker der aktuell offenen iveo-Show (auch wenn HIER kein Token
 * liegt) — für das Auflisten der Side Events im Launcher-Panel und die Basis-URL
 * der Materialien. Ob live umgeschaltet werden kann, weiß der Kern (`aktiv()`).
 */
interface OpenShowIveo {
  path: string;
  slug: string;
  name: string;
  day?: string;
  /** Basis-URL der Bindung, wie der Kern sie nutzt. */
  baseUrl: string;
}
let openShowIveo: OpenShowIveo | null = null;
/** Pfad der offenen Show, auch ohne iveo (Spec 7.5: Speichern im Editor erkennen). */
let offeneShowPfad: string | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
/**
 * Letzter Zustand des Abgleichs (Spec 7.6), wie der Kern ihn gemeldet hat (er meldet
 * nur Wechsel und setzt beim Öffnen/Schließen einer Show selbst auf ok zurück). Das
 * Panel liest ihn beim Öffnen nach.
 */
let syncStatus: IveoSyncStatus = { ok: true };

/** Renderer-Emitter (aus index.ts injiziert) — Panel über aktive Show/Side-Event informieren. */
let emitIveo: ((e: AppEvent) => void) | null = null;
export function setIveoEmitter(fn: (e: AppEvent) => void): void {
  emitIveo = fn;
}

function setzeStatus(s: IveoSyncStatus): void {
  syncStatus = s;
  emitIveo?.({
    type: 'iveo-sync-status',
    ok: s.ok,
    ...(s.text ? { text: s.text } : {}),
    ...(s.seit ? { seit: s.seit } : {}),
  });
}

let kernInstanz: IveoKern | null = null;
function kern(): IveoKern {
  if (!kernInstanz) {
    kernInstanz = erzeugeKern({
      clientFabrik: (token, baseUrl) => iveoClient(token, baseUrl),
      token: (event) => getIveoToken(event),
      leseShow: leseShowDatei,
      schreibeShow: schreibeShowDatei,
      benachrichtige: (appId, zeile) => sendControlCommand(appId, zeile),
      schreibeCache: (meta) => writeCache(meta as IveoShowMetadata),
      log: { info: (m) => getLog().info(m), warn: (m) => getLog().warn(m) },
      jetztIso: nowIso,
      meldeStatus: (s) => setzeStatus(s),
      meldeAktiv: () => emitActiveChanged(),
      baseUrlStandard: () => resolveIveoBaseUrl(),
    });
  }
  return kernInstanz;
}

function merkeOffeneShow(showPath: string, show: Show): void {
  const binding = show.iveo;
  openShowIveo = binding?.event
    ? {
        path: showPath,
        slug: binding.event,
        name: binding.name || binding.event,
        day: binding.filter?.day,
        baseUrl: binding.baseUrl || resolveIveoBaseUrl(),
      }
    : null;
}

function emitActiveChanged(): void {
  if (!openShowIveo) {
    emitIveo?.({ type: 'iveo-active-changed', event: '', canSwitch: false }); // Panel leeren
    return;
  }
  const a = kern().aktiv();
  emitIveo?.({
    type: 'iveo-active-changed',
    event: openShowIveo.name,
    day: a?.filter.day ?? openShowIveo.day,
    activeProgramId: a?.filter.programId,
    canSwitch: a !== null,
  });
}

/** STATE-Werte für den Launcher-Steuerserver (Companion-Variablen, #11). */
export function iveoStateKv(): Record<string, string> {
  const a = kern().aktiv();
  return {
    iveo_event: openShowIveo?.name ?? '',
    iveo_day: a?.filter.day ?? openShowIveo?.day ?? '',
    iveo_side_event: a?.filter.programId ?? '',
  };
}

/**
 * Takt starten, sobald eine Show offen ist — auch ohne iveo: Bindet der Show-Editor
 * die offene Show neu, fragt der Kern ab dem nächsten Takt ab. Ohne aktive iveo-Show
 * kehrt `abfrage()` sofort zurück; eine laufende Abfrage startet keine zweite.
 */
function starteTakt(): void {
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    void kern().abfrage(); // wirft nie (Vertrag des Kerns); Fehler landen im Status
  }, POLL_INTERVAL_MS);
}

/**
 * Nach dem Öffnen einer Show: Kern aufsetzen (Signatur aus der Datei, Generation + 1,
 * Status zurück auf ok bzw. „kein iveo-Token …“ bei fehlendem Token; danach meldet der
 * Kern `meldeAktiv()` → Panel) und den Takt sicherstellen. Fehlt das Token (Show auf
 * anderem Rechner gebunden), läuft der Ablauf aus der Datei offline weiter.
 */
export function onShowOpened(showPath: string, show: Show): void {
  offeneShowPfad = showPath;
  merkeOffeneShow(showPath, show); // vor dem Kern: dessen meldeAktiv() braucht den Merker
  kern().showGeoeffnet(showPath, show);
  starteTakt();
  const a = kern().aktiv();
  if (a) getLog().info(`iveo: Live-Polling für Event „${a.event}" aktiv (alle ${POLL_INTERVAL_MS / 1000}s).`);
}

export function stopIveoPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  kern().showGeschlossen();
}

/**
 * Show aus dem Show-Editor schreiben (Spec 7.4, 7.5): atomar. Ist es die offene
 * Show, setzt der Kern direkt danach — ohne await dazwischen (Aufrufvertrag aus A14) —
 * seinen Stand aus der Datei neu auf (Generation + 1, Filter, Signatur, Kontext),
 * schickt RELOAD an Timer, Titler und Rundown und meldet `meldeAktiv()`.
 * `neuGebunden` = im Editor neu an iveo gebunden.
 */
export function speichereShowDatei(pfad: string, show: Show, neuGebunden: boolean): boolean {
  if (!schreibeShowDatei(pfad, show)) return false;
  if (offeneShowPfad && gleicherShowPfad(offeneShowPfad, pfad)) {
    // Merker (Name, Tag, Basis-URL) aus der geschriebenen Show, bevor der Kern meldeAktiv() ruft.
    merkeOffeneShow(offeneShowPfad, show);
    kern().offeneShowGespeichert(offeneShowPfad, neuGebunden);
    starteTakt();
  }
  return true;
}

// ── Live-Umschalter für Side Events (#11) ────────────────────────────────────
// Die .jmshow bindet Event+Tag EINMAL; welches Side Event „live" läuft, ist
// Laufzeit-Zustand — kein neues Show-File je Side Event. Auflisten geht token-frei
// aus dem Cache; Umschalten braucht das Token (Launcher = single-holder) und läuft
// im Kern (nacheinander, Generation + 1, Spec 7.3).

/** Side Events der offenen Show (aus dem Cache, token-frei) für das Umschalt-Panel. */
export function listSideEvents(input: IveoSideEventsInput = {}): IveoSideEventsResult {
  if (!openShowIveo) return { ok: false, error: 'Keine iveo-gebundene Show geöffnet.' };
  const a = kern().aktiv();
  const meta = readCache(openShowIveo.slug);
  if (!meta) {
    return {
      ok: false,
      error: 'Kein iveo-Cache vorhanden (Show auf anderem Rechner gebunden?).',
      event: openShowIveo.name,
      canSwitch: a !== null,
      syncStatus,
    };
  }
  const dayMap = new Map<string, number>();
  for (const p of meta.programs) {
    const d = metaProgramDay(p);
    if (d) dayMap.set(d, (dayMap.get(d) ?? 0) + 1);
  }
  const days = [...dayMap.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((x, y) => x.value.localeCompare(y.value));
  const day = input.day || a?.filter.day || openShowIveo.day || days[0]?.value || '';
  const programs: IveoProgramRef[] = meta.programs
    .filter((p) => !day || metaProgramDay(p) === day)
    .sort((x, y) => (x.startsAtLocal || x.startsAt || '').localeCompare(y.startsAtLocal || y.startsAt || ''))
    .map((p) => {
      const time = metaProgramTime(p);
      return { id: p.id, title: p.title, day: metaProgramDay(p), ...(time ? { time } : {}) };
    });
  return {
    ok: true,
    event: meta.name,
    day,
    days,
    programs,
    activeProgramId: a?.filter.programId,
    canSwitch: a !== null,
    syncStatus,
  };
}

/**
 * Live auf ein Side Event umschalten (oder zurück auf die Tagesübersicht). Der Kern
 * schreibt Ablauf+Speaker in die offene Show und schickt RELOAD an Timer, Titler und
 * Rundown; scheitert das Schreiben, kommt ok:false zurück (Spec 7.2).
 */
export async function switchSideEvent(input: IveoSwitchInput): Promise<ActionResult> {
  return kern().umschalten({ programId: input.programId, day: input.day });
}

// ── Materialien eines Side Events (#11 Phase 4) ──────────────────────────────
// Präsentationen/Dateien hängen in iveo an den Agenda-Punkten eines Programms
// (materials[]). Datei-Assets werden über die 302-Indirektion mit Token geladen
// (der Launcher hält es); die signierte URL wird NIE gespeichert.

const MIME_EXT: Record<string, string> = {
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/zip': '.zip',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
  'text/plain': '.txt',
  'video/mp4': '.mp4',
};
/** Passende Dateiendung: liegt sie schon im Label, keine ergänzen; sonst aus dem MIME. */
function extFor(label: string, mime?: string | null): string {
  if (/\.[a-z0-9]{2,5}$/i.test(label || '')) return '';
  return (mime && MIME_EXT[mime.toLowerCase()]) || '';
}

/** Basis-URL der offenen iveo-Show (wie der Kern sie nutzt). */
function offeneBaseUrl(): string {
  return openShowIveo?.baseUrl ?? resolveIveoBaseUrl();
}

/** Alle Materialien eines Side Events (aus dessen Agenda-Punkten) auflisten. */
export async function listSideEventMaterials(input: IveoMaterialsInput): Promise<IveoMaterialsResult> {
  const a = kern().aktiv();
  if (!a) return { ok: false, error: 'Keine iveo-Show mit Token geöffnet.' };
  const token = getIveoToken(a.event);
  if (!token) return { ok: false, error: 'Kein iveo-Token für die offene Show.' };
  const programId = input.programId?.trim();
  if (!programId) return { ok: false, error: 'programId fehlt.' };
  try {
    const client = iveoClient(token, offeneBaseUrl());
    const agenda = await client.listAgendaItems(a.event, programId);
    const materials: IveoMaterialRef[] = [];
    for (const item of agenda) {
      for (const m of item.materials ?? []) {
        materials.push({
          id: m.id,
          label: m.label || '(ohne Titel)',
          kind: m.kind,
          agendaTitle: item.title,
          mimeType: m.asset?.mime_type ?? null,
          sizeBytes: m.asset?.size_bytes ?? null,
          externalUrl: m.external_url ?? null,
          hasAsset: !!m.asset?.url,
        });
      }
    }
    getLog().info(`iveo: Side Event „${programId}" — ${materials.length} Material(ien).`);
    return { ok: true, materials };
  } catch (e) {
    getLog().warn(`iveo materials: ${(e as Error).message}`);
    return { ok: false, ...toClientError(e) };
  }
}

/** Ein Material herunterladen (Datei speichern + öffnen) bzw. öffnen (Link). */
export async function downloadSideEventMaterial(input: IveoDownloadInput): Promise<ActionResult> {
  const a = kern().aktiv();
  if (!a) return { ok: false, message: 'Keine iveo-Show mit Token geöffnet.' };
  const token = getIveoToken(a.event);
  if (!token) return { ok: false, message: 'Kein iveo-Token für die offene Show.' };
  try {
    // Ohne Zeitgrenze: eine große Datei darf länger als 15 s laden (die Grenze gilt
    // den JSON-Abrufen, Spec 7.0).
    const client = new IveoClient({ token, baseUrl: offeneBaseUrl() });
    const agenda = await client.listAgendaItems(a.event, input.programId);
    let target: IveoMaterial | undefined;
    for (const item of agenda) {
      const m = (item.materials ?? []).find((x) => x.id === input.materialId);
      if (m) {
        target = m;
        break;
      }
    }
    if (!target) return { ok: false, message: 'Material nicht gefunden.' };
    // Link → einfach im Browser öffnen (kein Token nötig).
    if (target.kind === 'link' || (!target.asset?.url && target.external_url)) {
      if (!target.external_url) return { ok: false, message: 'Kein Link vorhanden.' };
      await shell.openExternal(target.external_url);
      return { ok: true, message: `Link geöffnet: ${target.label}` };
    }
    if (!target.asset?.url) return { ok: false, message: 'Kein Datei-Asset vorhanden.' };
    // Datei-Asset: mit Token holen (302-Follow im Client), dann speichern.
    const { bytes, contentType } = await client.fetchAsset(target.asset.url);
    const ext = extFor(target.label, target.asset.mime_type ?? contentType);
    const safe = (target.label || 'material').replace(/[\\/:*?"<>|]/g, '_');
    const r = await dialog.showSaveDialog({ title: 'Material speichern', defaultPath: `${safe}${ext}` });
    if (r.canceled || !r.filePath) return { ok: false };
    writeFileSync(r.filePath, Buffer.from(bytes));
    void shell.openPath(r.filePath); // zum Testen gleich öffnen
    getLog().info(`iveo: Material „${target.label}" gespeichert (${bytes.byteLength} Bytes) → ${r.filePath}`);
    return { ok: true, message: `Gespeichert & geöffnet: ${target.label}` };
  } catch (e) {
    getLog().warn(`iveo download: ${(e as Error).message}`);
    return { ok: false, message: toClientError(e).error };
  }
}
```

Hinweis zur Typprüfung: `clientFabrik` gibt einen `IveoClient` zurück; der erfüllt `IveoClientLike` aus A13 strukturell (Teilmenge seiner Methoden). `mitZeitgrenze((url, init) => fetch(url, init), …)` übergibt `init` samt `signal` an den globalen `fetch` (Electron 33 / Node 20).

- [ ] **Schritt 11: `apps/launcher/src/main/show.ts` — Speichern atomar, offene Show meldet dem Kern**

Ersetzung 1 (Importe, Zeilen 1-11).
Vorher:
```ts
import { dialog } from 'electron';
import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { parseShow, serializeShow, showOpenUrl, SHOW_FILE_EXT, type Show } from '@jm/show';
import { getLog } from '@jm/app-runtime';
import type { ActionResult, AppEvent } from '@shared/types';
import { getTool } from './manifest';
import { openTool } from './launch';
import { startShowTools } from './show-launch';
import { onShowOpened } from './iveo-sync';
import { pushRecentShow } from './settings';
```
Nachher:
```ts
import { dialog } from 'electron';
import { readFileSync } from 'node:fs';
import { parseShow, showOpenUrl, SHOW_FILE_EXT, type Show } from '@jm/show';
import { getLog } from '@jm/app-runtime';
import type { ActionResult, AppEvent } from '@shared/types';
import { getTool } from './manifest';
import { openTool } from './launch';
import { startShowTools } from './show-launch';
import { onShowOpened, speichereShowDatei } from './iveo-sync';
import { pushRecentShow } from './settings';
```

Ersetzung 2 (`saveShow`, Zeilen 97-123).
Vorher:
```ts
/**
 * Speichert eine im Launcher zusammengestellte Show als .jmshow. Mit `targetPath`
 * (Bearbeiten) wird direkt an diese Datei zurückgeschrieben; ohne (Neu) fragt ein
 * Save-Dialog nach dem Ziel.
 */
export async function saveShow(show: Show, targetPath?: string): Promise<ActionResult> {
  let filePath = targetPath;
  if (!filePath) {
    const ext = SHOW_FILE_EXT.replace(/^\./, '');
    const safeName = (show.name || 'show').replace(/[\\/:*?"<>|]/g, '_');
    const result = await dialog.showSaveDialog({
      title: 'Show speichern',
      defaultPath: `${safeName}.${ext}`,
      filters: [{ name: 'JM Show', extensions: [ext] }],
    });
    if (result.canceled || !result.filePath) return { ok: false };
    filePath = result.filePath;
  }
  try {
    await writeFile(filePath, serializeShow(show, new Date().toISOString()), 'utf8');
  } catch (e) {
    const message = `Show konnte nicht gespeichert werden: ${(e as Error).message}`;
    getLog().error(message);
    return { ok: false, message };
  }
  return { ok: true, message: `Show „${show.name}" ${targetPath ? 'aktualisiert' : 'gespeichert'}.` };
}
```
Nachher:
```ts
/**
 * Speichert eine im Launcher zusammengestellte Show als .jmshow. Mit `targetPath`
 * (Bearbeiten) wird direkt an diese Datei zurückgeschrieben; ohne (Neu) fragt ein
 * Save-Dialog nach dem Ziel. Geschrieben wird atomar (Spec 7.4). Ist es die gerade
 * offene Show, setzt sich der iveo-Kern neu auf und Timer, Titler und Rundown
 * bekommen RELOAD (Spec 7.5). `neuGebunden` = im Editor neu an iveo gebunden.
 */
export async function saveShow(show: Show, targetPath?: string, neuGebunden = false): Promise<ActionResult> {
  let filePath = targetPath;
  if (!filePath) {
    const ext = SHOW_FILE_EXT.replace(/^\./, '');
    const safeName = (show.name || 'show').replace(/[\\/:*?"<>|]/g, '_');
    const result = await dialog.showSaveDialog({
      title: 'Show speichern',
      defaultPath: `${safeName}.${ext}`,
      filters: [{ name: 'JM Show', extensions: [ext] }],
    });
    if (result.canceled || !result.filePath) return { ok: false };
    filePath = result.filePath;
  }
  if (!speichereShowDatei(filePath, show, neuGebunden)) {
    const message = 'Show konnte nicht gespeichert werden (Datei gesperrt oder nicht beschreibbar, Details im Launcher-Log).';
    getLog().error(message);
    return { ok: false, message };
  }
  return { ok: true, message: `Show „${show.name}" ${targetPath ? 'aktualisiert' : 'gespeichert'}.` };
}
```

- [ ] **Schritt 12: IPC und Preload — `neuGebunden` durchreichen**

`apps/launcher/src/main/ipc.ts`, Zeile 106.
Vorher:
```ts
  ipcMain.handle('show:save', (_e, show: Show, targetPath?: string) => saveShow(show, targetPath));
```
Nachher:
```ts
  // neuGebunden: im Editor neu an iveo gebunden → der Kern nimmt die Bindung der offenen Show auf (Spec 7.5).
  ipcMain.handle('show:save', (_e, show: Show, targetPath?: string, neuGebunden?: boolean) =>
    saveShow(show, targetPath, neuGebunden === true),
  );
```

`apps/launcher/src/preload/index.ts`, Zeile 53.
Vorher:
```ts
  saveShow: (show: Show, targetPath?: string) => invoke<ActionResult>('show:save', show, targetPath),
```
Nachher:
```ts
  saveShow: (show: Show, targetPath?: string, neuGebunden?: boolean) =>
    invoke<ActionResult>('show:save', show, targetPath, neuGebunden),
```

- [ ] **Schritt 13: Store — `apps/launcher/src/renderer/src/store/tools.ts`**

Ersetzung 1 (Typ-Import, Zeilen 9-11).
Vorher:
```ts
  InstallProgress,
  IveoMaterialRef,
  IveoSideEventsResult,
```
Nachher:
```ts
  InstallProgress,
  IveoAbgleichStatus,
  IveoMaterialRef,
  IveoSideEventsResult,
```

Ersetzung 2 (Interface, Zeilen 72-73).
Vorher:
```ts
  sideEvents: IveoSideEventsResult | null;
  sideEventsOpen: boolean;
```
Nachher:
```ts
  sideEvents: IveoSideEventsResult | null;
  /** iveo-Abgleich (Spec 7.6): letzter Zustand; ok=false zeigt das Panel als Störung. */
  iveoSync: IveoAbgleichStatus | null;
  sideEventsOpen: boolean;
```

Ersetzung 3 (Interface, Zeile 100).
Vorher:
```ts
  saveShow: (show: Show, targetPath?: string) => Promise<boolean>;
```
Nachher:
```ts
  saveShow: (show: Show, targetPath?: string, neuGebunden?: boolean) => Promise<boolean>;
```

Ersetzung 4 (Startwerte, Zeilen 205-206).
Vorher:
```ts
    sideEvents: null,
    sideEventsOpen: false,
```
Nachher:
```ts
    sideEvents: null,
    iveoSync: null,
    sideEventsOpen: false,
```

Ersetzung 5 (Ereignis, Zeilen 267-269).
Vorher:
```ts
            if (useTools.getState().sideEventsOpen) await useTools.getState().loadSideEvents();
          }
        });
```
Nachher:
```ts
            if (useTools.getState().sideEventsOpen) await useTools.getState().loadSideEvents();
          } else if (e.type === 'iveo-sync-status') {
            // iveo-Abgleich gestört bzw. wieder in Ordnung (Spec 7.6) → Statuszeile im Panel.
            set({ iveoSync: { ok: e.ok, text: e.text, seit: e.seit } });
          }
        });
```

Ersetzung 6 (`saveShow`, Zeilen 370-374).
Vorher:
```ts
    saveShow: async (show, targetPath) => {
      const res = await window.jmps.saveShow(show, targetPath);
```
Nachher:
```ts
    saveShow: async (show, targetPath, neuGebunden) => {
      const res = await window.jmps.saveShow(show, targetPath, neuGebunden);
```

Ersetzung 7 (`loadSideEvents`, Zeile 405).
Vorher:
```ts
        set({ sideEvents: await window.jmps.listIveoSideEvents(day ? { day } : undefined) });
```
Nachher:
```ts
        const res = await window.jmps.listIveoSideEvents(day ? { day } : undefined);
        // Der Main liefert den Abgleich-Zustand mit: kam das Ereignis, bevor dieses
        // Fenster zuhörte, zeigt das Panel die Störung trotzdem (Spec 7.6).
        set(res.syncStatus ? { sideEvents: res, iveoSync: res.syncStatus } : { sideEvents: res });
```

- [ ] **Schritt 14: Panel — `apps/launcher/src/renderer/src/components/SideEventsPanel.tsx`**

Ersetzung 1 (Importe, Zeilen 1-3).
Vorher:
```tsx
import { useState } from 'react';
import { Button, Card, cn } from '@jm/ui';
import { useTools } from '@/store/tools';
```
Nachher:
```tsx
import { useState } from 'react';
import { Button, Card, cn } from '@jm/ui';
import { iveoStatusZeile } from '@/lib/iveo-status';
import { useTools } from '@/store/tools';
```

Ersetzung 2 (Hook, Zeile 35).
Vorher:
```tsx
  const downloadMaterial = useTools((s) => s.downloadMaterial);
```
Nachher:
```tsx
  const downloadMaterial = useTools((s) => s.downloadMaterial);
  const iveoSync = useTools((s) => s.iveoSync);
```

Ersetzung 3 (Zeile 44).
Vorher:
```tsx
  const programs = data?.programs ?? [];
```
Nachher:
```tsx
  const programs = data?.programs ?? [];
  // Spec 7.6: „iveo-Abgleich gestört: <Text> (seit <Uhrzeit>)“, solange eine Abfrage scheitert.
  const stoerung = iveoStatusZeile(iveoSync);
```

Ersetzung 4 (unter dem Kopf, Zeilen 89-93).
Vorher:
```tsx
            {canSwitch ? 'Live' : 'Nur Anzeige'}
          </span>
        </div>

        {data && !data.ok ? (
```
Nachher:
```tsx
            {canSwitch ? 'Live' : 'Nur Anzeige'}
          </span>
        </div>

        {stoerung && (
          <p
            role="status"
            className="mt-4 text-[11px] rounded-[var(--radius)] border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 px-3 py-2 text-[var(--destructive)] break-words"
          >
            {stoerung}
          </p>
        )}

        {data && !data.ok ? (
```

- [ ] **Schritt 15: Typecheck und Build**

Run: `npm run typecheck -w @jm/launcher`
Expected: ohne Fehler (node + web).

Run: `npm run build -w @jm/launcher`
Expected: electron-vite baut main, preload und renderer ohne Fehler.

- [ ] **Schritt 16: Alle Launcher-Tests**

Run: `npm run selftest -w @jm/launcher && npm run selftest:verbund -w @jm/launcher && npm run selftest:iveo -w @jm/launcher`
Expected: alle drei grün; letzte Zeile von `selftest:iveo` ist `26 ok, 0 fehlgeschlagen.`

Die Verdrahtung selbst (Takt mit `JMPS_IVEO_POLL_MS`, RELOAD bis in den Rundown, Statuszeile, Speichern der offenen Show) prüft der Durchgang mit gebauten Programmen in A17.

- [ ] **Schritt 17: Commit (Hülle)**

```bash
git add apps/launcher/src/main/iveo-sync.ts apps/launcher/src/main/show.ts apps/launcher/src/main/ipc.ts apps/launcher/src/preload/index.ts apps/launcher/src/shared/types.ts apps/launcher/src/renderer/src/store/tools.ts apps/launcher/src/renderer/src/components/SideEventsPanel.tsx
git status --short
git commit -m "feat(launcher): iveo-sync wird Hülle um den Abgleich-Kern, Status ins Panel, Speichern meldet dem Kern" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
1. `apps/launcher/src/main/index.ts` bleibt unverändert: der Emitter aus `setIveoEmitter` (Zeilen 82-87) reicht jedes `AppEvent` an den Renderer, also auch `iveo-sync-status`.
2. Neu `iveo-huelle-hilfen.ts`, `lib/iveo-status.ts` und `test/iveo-huelle.test.ts`: die testbaren Teile der Hülle (Takt, Zeitgrenze, Pfadvergleich, Statuszeile), damit G8 auch hier mit einem roten Test beginnt. `iveo-sync.ts` selbst importiert `electron` und ist nur per Typecheck/Build und im Durchgang A17 prüfbar.
3. Die „IPC gespeichert“ ist kein neuer Kanal: `show:save` bekommt den dritten Parameter `neuGebunden`, `saveShow` schreibt über `speichereShowDatei` (Hülle) atomar und synchron und meldet die offene Show sofort dem Kern. Damit liegt zwischen Schreiben und Generation + 1 kein `await`.
4. Der Re-Bind-Block in `bindIveoEvent` (heute Zeilen 349-364, frischt `active.sideCtx` auf) entfällt, weil `active` jetzt im Kern lebt. Ersatz: Speichert der Editor die neu gebundene offene Show, setzt `offeneShowGespeichert` den Kern aus der Datei neu auf; der Kontext wird bei der nächsten Abfrage nachgeladen (7.6: scheitert das, wird übersprungen).
5. Die Zeitgrenze von 15 s gilt für alle JSON-Abrufe (Abfrage, Umschalten, Discover, Binden, Materialliste), nicht für das Herunterladen einer Material-Datei (`fetchAsset`), damit große Dateien nicht nach 15 s abbrechen.
6. Der Status kommt zusätzlich über `listSideEvents().syncStatus`, damit das Panel eine Störung auch zeigt, wenn das Ereignis vor dem Öffnen des Fensters kam.
7. Der Takt läuft, sobald eine Show offen ist, auch ohne iveo (`abfrage()` kehrt dann sofort zurück). Sonst würde eine im Editor neu gebundene offene Show erst nach erneutem Öffnen abgefragt.
8. Gemeinsamer Typ `IveoAbgleichStatus` in `shared/types.ts`: der Renderer kann `IveoSyncStatus` aus dem Kern (Main) nicht importieren; beide Typen haben dieselbe Form.
9. `describeFilter` und `toProgramList` bleiben in der Hülle (nur Binden nutzt sie). `speakerNameMap`, `scheduleSafeForList`, `toClientError` und `einPunktAblauf` importiert die Hülle aus dem Kern (A13 exportiert sie dafür); so gibt es keine zweite Fassung, und der 1-Punkt-Ablauf ist beim Binden garantiert derselbe wie bei Abfrage und Umschalten.
10. Die Hülle setzt den Status beim Öffnen nicht selbst zurück und meldet das Panel nach `showGeoeffnet`/`offeneShowGespeichert` nicht selbst: beides macht der Kern (A13/A14). Die Hülle spiegelt nur den zuletzt gemeldeten Status für `listSideEvents`.

**Konsistenzprüfung:**
- Korrektur: Die Hülle baute das synchrone Warten selbst nach (`warteZelle`/`warteSynchron` mit `Atomics.wait`), obwohl A12 dafür `warteSync` exportiert („damit die Hülle das nicht selbst nachbaut“, A12 Abweichungen). Jetzt importiert `iveo-sync.ts` `warteSync` aus `./show-schreiben` und übergibt es an `schreibeShowAtomar`; die eigene Kopie ist entfernt, `warteSync` steht in den Consumes. Verhalten unverändert.
- Beleg: Gesamtnachbau aller Aufgaben A1–A18 in einer Scratch-Kopie des Worktrees (alle Vorher-Ausschnitte der Reihe nach je genau einmal gefunden): `npm run typecheck -w @jm/launcher` und `npm run build -w @jm/launcher` grün, `selftest:iveo` 93/26/45 ok, `selftest` und `selftest:verbund` grün.

---

### Aufgabe A16: Show-Editor verliert nichts (`baueGespeicherteShow`)

**Spec:** 7.5 (Laden, Speichern einer bearbeiteten Show, Dauern, Kennungen, neue Shows, Speichern der offenen Show Regel 1), 3.2/3.3 (S2, S3: Kennungen im Editor), 9.5 (Tests), Ergänzung 0.2.

**Dateien:**
- Create: `apps/launcher/src/renderer/src/lib/show-speichern.ts`
- Create: `apps/launcher/test/show-speichern.test.ts` (tsx)
- Modify: `apps/launcher/package.json` (Skript `selftest:iveo`, Stand nach A15)
- Modify: `apps/launcher/src/renderer/src/components/ShowEditorModal.tsx:1-12, 21-39, 65, 71-72, 80-87, 116-126, 162-165, 233-243, 285-325, 347-350, 357-440`
- Modify: `apps/launcher/src/main/show.ts` (neu `readShowFile`, vor `pickShowDocument`)
- Modify: `apps/launcher/src/main/ipc.ts:32, 107` (`show:read`)
- Modify: `apps/launcher/src/preload/index.ts:54` (`readShow`)
- Modify: `apps/launcher/src/shared/types.ts` (`JmpsApi.readShow`, hinter `loadShowForEdit`)
- Nicht geändert: `apps/launcher/src/renderer/src/lib/scenarios.ts` (siehe Abweichungen)

**Schnittstellen:**
- Consumes (A1, `@jm/show`): `ShowAblaufItem.id?: string`; `parseShow`/`serializeShow` erhalten `id` (über `normalizeAblauf`).
- Consumes (A15): `window.jmps.saveShow(show: Show, targetPath?: string, neuGebunden?: boolean): Promise<ActionResult>`; Store `saveShow: (show: Show, targetPath?: string, neuGebunden?: boolean) => Promise<boolean>`; Skript `"selftest:iveo": "tsx test/iveo-abgleich.test.ts && tsx test/iveo-huelle.test.ts"`.
- Produces (`apps/launcher/src/renderer/src/lib/show-speichern.ts`), exakt wie im Gerüst plus Helfer:
  ```ts
  export interface AblaufZeile { id?: string; label: string; minutes: string; note: string; plannedStartMs?: number; owner?: string; category?: string; geladenDurationMs?: number; geladenMinutes?: string }
  export interface FormularStand { name: string; tools: Array<{ appId: string; document: string; host: string }>; ablauf: AblaufZeile[]; battle: { nameA: string; nameB: string; rounds: string }; qaSpeak: string; iveoNeuGebunden: ShowIveoBinding | null }
  export function baueGespeicherteShow(geladen: Show | null, f: FormularStand, aktuelleDatei: Show | null, neueId: () => string): Show;
  // Helfer (zusätzlich):
  export interface EditorBindung { event: string; name: string; baseUrl?: string; speakers?: ShowIveoSpeaker[]; sideEvents?: ShowIveoProgramRef[]; filter?: ShowIveoBinding['filter'] }
  export function formularAusShow(show: Show): FormularStand;
  export function zeilenAusAblauf(ablauf: ShowAblaufItem[] | undefined): AblaufZeile[];
  export function zeilenAusSeed(seed: Array<{ label: string; minutes?: number; note?: string }> | undefined, neueId: () => string): AblaufZeile[];
  export function bindungAusEditor(b: EditorBindung): ShowIveoBinding;
  export function baueAblauf(zeilen: AblaufZeile[], neueId: () => string): ShowAblaufItem[];
  ```
- Produces (IPC): `window.jmps.readShow(path: string): Promise<Show | null>` (Kanal `show:read`, Main `readShowFile(path: string): Show | null`).

**Regeln aus Spec 7.5 (so umgesetzt):**
- Mit geladener Show (`editPath` gesetzt) geht das Ergebnis von `geladen` aus. Überschrieben wird nur, was das Formular zeigt, und nur, wenn es im Formular anders ist als beim Laden (Vergleich gegen `formularAusShow(geladen)`): `name`; die Tool-Liste (abgewählte fallen weg, neue kommen ans Ende, die übrigen behalten ihre Reihenfolge); je Tool `document` und `network.host` (alle anderen Felder bleiben, auch `network.port` und `settings`); bei `jm-battle` die Schlüssel `nameA`/`nameB`/`rounds`, bei `jm-qa` `speakSeconds` (andere Einstellungsschlüssel bleiben); `ablauf`; `iveo` nur bei neuer Bindung.
- Dauern: Ist der Minuten-Text einer Zeile unverändert, wird die geladene `durationMs` sekundengenau geschrieben.
- Regel 1: Ist die Show gebunden, wurde nicht neu gebunden und ist der Ablauf im Formular unverändert, kommen `ablauf` und `iveo` aus der **aktuell gelesenen Datei** (`aktuelleDatei`).
- Kennungen: Zeilen behalten ihre `id`. Neue Zeilen und Szenario-Zeilen bekommen sie beim Anlegen (`crypto.randomUUID()`). Wird der Ablauf geändert, bekommen Zeilen ohne Kennung (Altshow) beim Speichern `neueId()`.
- Neue Show (`geladen` = null): wie heute aus dem Formular gebaut, mit Kennungen.

**Zeilenenden:** Der Worktree hat `core.autocrlf=true`; `ShowEditorModal.tsx`, `show.ts` u. a. liegen dort mit CRLF. Die Vorher-Ausschnitte sind mit LF geschrieben und wurden gegen den echten Code (Stand nach A15) geprüft: nach LF-Angleichung je genau ein Treffer. Trifft eine Ersetzung nicht, zuerst die Zeilenenden prüfen.

**Geprüft beim Planen:** Mit einem `@jm/show`, das `id` wie in A1 erhält, ergibt `test/show-speichern.test.ts` `45 ok`; `tsc` (node + web) läuft nach A15 + A16 ohne Fehler.

- [ ] **Schritt 0: Vorbedingungen prüfen (A1, A15)**

```bash
grep -n "id?: string" packages/show/src/index.ts
grep -n "neuGebunden" apps/launcher/src/shared/types.ts apps/launcher/src/renderer/src/store/tools.ts apps/launcher/src/preload/index.ts
node -p "require('./apps/launcher/package.json').scripts['selftest:iveo']"
```
Expected: `ShowAblaufItem` hat `id?: string`; `neuGebunden` steht in allen drei Dateien; das Skript lautet `tsx test/iveo-abgleich.test.ts && tsx test/iveo-huelle.test.ts`.

- [ ] **Schritt 1: Fehlschlagenden Test schreiben — `apps/launcher/test/show-speichern.test.ts` (neu)**

```ts
// Show-Editor ohne Electron (tsx): npm run selftest:iveo -w @jm/launcher
// Master-Link Teil 2a, Spec 7.5 (Show-Editor verliert nichts mehr) und Tests 9.5.
import { isDeepStrictEqual } from 'node:util';
import { parseShow, serializeShow, type Show } from '@jm/show';
import {
  baueAblauf, baueGespeicherteShow, bindungAusEditor, formularAusShow, zeilenAusAblauf, zeilenAusSeed, type FormularStand,
} from '../src/renderer/src/lib/show-speichern';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}

/** Kennungs-Erzeuger mit Zähler — zeigt, ob und wie viele neue Kennungen entstanden. */
function zaehler(): { neueId: () => string; anzahl: () => number } {
  let n = 0;
  return { neueId: () => `neu-${++n}`, anzahl: () => n };
}
/** Show ohne updatedAt (das setzt erst serializeShow beim Schreiben). */
function ohneZeit(s: Show): Omit<Show, 'updatedAt'> {
  const { updatedAt: _zeit, ...rest } = s;
  return rest;
}

const ROH = {
  schemaVersion: 1,
  name: 'COP31 Tag 1',
  updatedAt: '2026-09-29T08:00:00.000Z',
  tools: [
    { appId: 'jm-timer', network: { host: '10.0.0.5', port: 7777 }, settings: { timetable: [{ label: 'Eigene Liste', durationMs: 90_000 }], durationMs: 300_000 } },
    { appId: 'jm-presenter', document: 'folien/tag1.jmpres', settings: { pin: '4711' } },
    { appId: 'jm-battle', settings: { nameA: 'Team Rot', nameB: 'Team Blau', rounds: 3, crewA: ['Ada'], crewB: ['Bo'] } },
    { appId: 'jm-qa', settings: { speakSeconds: 90, moderation: true, autoTimer: true } },
    { appId: 'jm-rundown', document: 'regie.jmrundown' },
  ],
  ablauf: [
    { id: 'aaaa-1', label: 'Begrüßung', durationMs: 90_000, note: 'kurz', plannedStartMs: 36_000_000, owner: 'Ada', category: 'side-event' },
    { id: 'aaaa-2', label: 'Panel', durationMs: 1_200_000 },
    { id: 'aaaa-3', label: 'Abschluss' },
  ],
  iveo: {
    event: 'cop31',
    baseUrl: 'https://my-iveo.de/api/v1',
    name: 'COP31',
    syncedAt: '2026-09-29T07:59:00.000Z',
    speakers: [{ name: 'Ada Lovelace', title: 'Moderation' }],
    sideEvents: [{ id: 'p1', title: 'Side Event A' }],
    filter: { programId: 'p1' },
  },
};
const geladen = parseShow(JSON.stringify(ROH));
const tool = (s: Show, id: string) => s.tools.find((t) => t.appId === id);

console.log('— Laden und Speichern ohne Änderung (9.5)');
{
  const z = zaehler();
  const ergebnis = baueGespeicherteShow(geladen, formularAusShow(geladen), geladen, z.neueId);
  ck('deepEqual(geladen, ergebnis) bis auf updatedAt', isDeepStrictEqual(ohneZeit(ergebnis), ohneZeit(geladen)));
  const AT = '2026-10-01T12:00:00.000Z';
  ck('Datei byte-gleich (serializeShow)', serializeShow(ergebnis, AT) === serializeShow(geladen, AT));
  ck('keine neuen Kennungen erfunden', z.anzahl() === 0);
  ck('eigene Timer-Liste bleibt', isDeepStrictEqual(tool(ergebnis, 'jm-timer')?.settings, ROH.tools[0].settings));
  ck('Presenter-PIN bleibt', tool(ergebnis, 'jm-presenter')?.settings?.pin === '4711');
  ck('network.port bleibt', tool(ergebnis, 'jm-timer')?.network?.port === 7777);
  ck('iveo.syncedAt bleibt', ergebnis.iveo?.syncedAt === ROH.iveo.syncedAt);
  ck('90-s-Dauer sekundengenau', ergebnis.ablauf?.[0].durationMs === 90_000);
  ck('Kennungen bleiben', ergebnis.ablauf?.map((a) => a.id).join(',') === 'aaaa-1,aaaa-2,aaaa-3');
  const ohneDatei = baueGespeicherteShow(geladen, formularAusShow(geladen), null, z.neueId);
  ck('… auch wenn die aktuelle Datei nicht lesbar ist', isDeepStrictEqual(ohneZeit(ohneDatei), ohneZeit(geladen)));
}

console.log('— iveo-Abfrage zwischen Laden und Speichern (7.5 Regel 1)');
{
  const nachAbfrage = parseShow(JSON.stringify({
    ...ROH,
    ablauf: [...ROH.ablauf, { id: 'aaaa-4', label: 'Nachtrag aus iveo', durationMs: 600_000 }],
    iveo: { ...ROH.iveo, syncedAt: '2026-09-29T08:30:00.000Z' },
  }));
  const f: FormularStand = { ...formularAusShow(geladen), name: 'COP31 Tag 1 (Regie)' };
  const ergebnis = baueGespeicherteShow(geladen, f, nachAbfrage, zaehler().neueId);
  ck('Ablauf unverändert → Ablauf der aktuellen Datei', isDeepStrictEqual(ergebnis.ablauf, nachAbfrage.ablauf));
  ck('… Bindung der aktuellen Datei (neues syncedAt)', ergebnis.iveo?.syncedAt === '2026-09-29T08:30:00.000Z');
  ck('… Name aus dem Formular', ergebnis.name === 'COP31 Tag 1 (Regie)');
  const basis = formularAusShow(geladen);
  const geaendert: FormularStand = { ...basis, ablauf: basis.ablauf.map((r, i) => (i === 1 ? { ...r, minutes: '25' } : r)) };
  const mitFormular = baueGespeicherteShow(geladen, geaendert, nachAbfrage, zaehler().neueId);
  ck('Ablauf im Formular geändert → das Formular gilt', mitFormular.ablauf?.length === 3 && mitFormular.ablauf?.[1].durationMs === 1_500_000);
  ck('… unveränderte Zeile bleibt in allen Feldern gleich', isDeepStrictEqual(mitFormular.ablauf?.[0], geladen.ablauf?.[0]));
  ck('… Bindung bleibt die geladene (ohne neue Bindung)', mitFormular.iveo?.syncedAt === ROH.iveo.syncedAt);
}

console.log('— Tools: nur document, network.host und die Formularfelder');
{
  const basis = formularAusShow(geladen);
  const f: FormularStand = {
    ...basis,
    tools: [
      ...basis.tools.filter((t) => t.appId !== 'jm-rundown').map((t) => (t.appId === 'jm-timer' ? { ...t, host: '10.0.0.9' } : t)),
      { appId: 'jm-titler', document: '', host: '' },
    ],
    battle: { ...basis.battle, nameA: 'Team Grün' },
    qaSpeak: '',
  };
  const e = baueGespeicherteShow(geladen, f, null, zaehler().neueId);
  ck('abgewähltes Tool fällt weg', !tool(e, 'jm-rundown'));
  ck('neues Tool kommt ans Ende, ohne leere Felder', e.tools[e.tools.length - 1].appId === 'jm-titler' && isDeepStrictEqual(tool(e, 'jm-titler'), { appId: 'jm-titler' }));
  ck('Reihenfolge der übrigen bleibt', e.tools.map((t) => t.appId).join(',') === 'jm-timer,jm-presenter,jm-battle,jm-qa,jm-titler');
  ck('Host geändert, Port bleibt', tool(e, 'jm-timer')?.network?.host === '10.0.0.9' && tool(e, 'jm-timer')?.network?.port === 7777);
  ck('Timer-Einstellungen bleiben', isDeepStrictEqual(tool(e, 'jm-timer')?.settings, ROH.tools[0].settings));
  const battle = tool(e, 'jm-battle')?.settings;
  ck('Battle: nameA neu, andere Schlüssel bleiben', battle?.nameA === 'Team Grün' && battle?.nameB === 'Team Blau' && battle?.rounds === 3 && isDeepStrictEqual(battle?.crewA, ['Ada']));
  const qa = tool(e, 'jm-qa')?.settings;
  ck('Q&A: Redezeit geleert → Schlüssel weg, andere bleiben', !!qa && !('speakSeconds' in qa) && qa.moderation === true && qa.autoTimer === true);
  ck('Ablauf unverändert, keine aktuelle Datei → geladener Ablauf', isDeepStrictEqual(e.ablauf, geladen.ablauf));
  const ohneHost = baueGespeicherteShow(geladen, { ...basis, tools: basis.tools.map((t) => (t.appId === 'jm-timer' ? { ...t, host: '' } : t)) }, null, zaehler().neueId);
  ck('Host geleert → nur der Port bleibt', isDeepStrictEqual(tool(ohneHost, 'jm-timer')?.network, { port: 7777 }));
}

console.log('— Dauern und Kennungen im geänderten Ablauf');
{
  const alt = parseShow(JSON.stringify({ schemaVersion: 1, name: 'Alt', tools: [{ appId: 'jm-rundown' }], ablauf: [{ label: 'A', durationMs: 90_000 }, { label: 'B', durationMs: 120_000 }] }));
  const basis = formularAusShow(alt);
  ck('Minuten-Text der 90-s-Zeile ist „2“', basis.ablauf[0].minutes === '2');
  const z = zaehler();
  const f: FormularStand = {
    ...basis,
    ablauf: [...basis.ablauf.map((r, i) => (i === 1 ? { ...r, minutes: '3' } : r)), { id: 'neu-x', label: 'C', minutes: '1.5', note: '' }],
  };
  const e = baueGespeicherteShow(alt, f, null, z.neueId);
  ck('unveränderte Minuten → geladene Dauer (90 s)', e.ablauf?.[0].durationMs === 90_000);
  ck('geänderte Minuten → Eingabe gilt', e.ablauf?.[1].durationMs === 180_000);
  ck('neue Zeile mit 1,5 min und ihrer Kennung', e.ablauf?.[2].durationMs === 90_000 && e.ablauf?.[2].id === 'neu-x');
  ck('Zeilen ohne Kennung bekommen beim Speichern eine', e.ablauf?.[0].id === 'neu-1' && e.ablauf?.[1].id === 'neu-2' && z.anzahl() === 2);
  const unveraendert = baueGespeicherteShow(alt, basis, null, zaehler().neueId);
  ck('Altshow ohne Änderung bleibt byte-gleich (keine Kennungen nachgetragen)', serializeShow(unveraendert, 'x') === serializeShow(alt, 'x'));
  ck('leere Titel fallen weg', baueAblauf([{ label: '  ', minutes: '5', note: '' }], z.neueId).length === 0);
  ck('zeilenAusAblauf trägt Kennung und geladene Dauer mit', isDeepStrictEqual(
    zeilenAusAblauf([{ id: 'x', label: 'L', durationMs: 90_000, owner: 'O' }])[0],
    { id: 'x', label: 'L', minutes: '2', note: '', owner: 'O', geladenDurationMs: 90_000, geladenMinutes: '2' },
  ));
}

console.log('— Name');
{
  const unbenannt = parseShow(JSON.stringify({ schemaVersion: 1, name: '', tools: [{ appId: 'jm-timer' }] }));
  ck('„Unbenannte Show“ erscheint als leeres Namensfeld', formularAusShow(unbenannt).name === '');
  ck('… und bleibt beim Speichern', baueGespeicherteShow(unbenannt, formularAusShow(unbenannt), null, zaehler().neueId).name === 'Unbenannte Show');
}

console.log('— Neue Bindung');
{
  const neu = bindungAusEditor({ event: 'cop31', name: 'COP31', speakers: [], sideEvents: [{ id: 'p2', title: 'Side Event B' }], filter: { programId: 'p2' } });
  ck('Bindung ohne leere Felder', isDeepStrictEqual(neu, { event: 'cop31', name: 'COP31', sideEvents: [{ id: 'p2', title: 'Side Event B' }], filter: { programId: 'p2' } }));
  ck('leerer Filter fällt weg', !('filter' in bindungAusEditor({ event: 'e', name: 'E', filter: {} })));
  const basis = formularAusShow(geladen);
  const zeilen = zeilenAusAblauf([{ id: 'b-1', label: 'Keynote', durationMs: 1_800_000 }]);
  const e = baueGespeicherteShow(geladen, { ...basis, ablauf: zeilen, iveoNeuGebunden: neu }, geladen, zaehler().neueId);
  ck('neue Bindung ersetzt iveo (ohne altes syncedAt)', isDeepStrictEqual(e.iveo, neu));
  ck('… und der neue Ablauf gilt', e.ablauf?.length === 1 && e.ablauf?.[0].id === 'b-1' && e.ablauf?.[0].durationMs === 1_800_000);
}

console.log('— Neue Show (ohne editPath)');
{
  const z = zaehler();
  const f: FormularStand = {
    name: ' Gala ',
    tools: [{ appId: 'jm-battle', document: '', host: '' }, { appId: 'jm-qa', document: ' fragen.jmqa ', host: ' 10.0.0.7 ' }],
    ablauf: [...zeilenAusSeed([{ label: 'Begrüßung', minutes: 5 }], z.neueId), { label: 'ohne Kennung', minutes: '', note: ' Notiz ' }],
    battle: { nameA: 'Rot', nameB: '', rounds: '3' },
    qaSpeak: '120',
    iveoNeuGebunden: null,
  };
  const e = baueGespeicherteShow(null, f, null, z.neueId);
  ck('Name getrimmt', e.name === 'Gala');
  ck('Tools wie bisher gebaut', isDeepStrictEqual(e.tools, [
    { appId: 'jm-battle', settings: { nameA: 'Rot', rounds: 3 } },
    { appId: 'jm-qa', document: 'fragen.jmqa', network: { host: '10.0.0.7' }, settings: { speakSeconds: 120 } },
  ]));
  ck('Szenario-Zeile trägt ihre Kennung', e.ablauf?.[0].id === 'neu-1' && e.ablauf?.[0].durationMs === 300_000);
  ck('Zeile ohne Kennung bekommt eine', e.ablauf?.[1].id === 'neu-2' && e.ablauf?.[1].note === 'Notiz');
  ck('ohne Bindung kein iveo', !('iveo' in e));
  ck('Schema-Version gesetzt', e.schemaVersion === 1);
}

console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);
```

- [ ] **Schritt 2: Test laufen lassen, Fehlschlag sehen**

Run: `npx tsx apps/launcher/test/show-speichern.test.ts`
Expected: Abbruch mit `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…\apps\launcher\src\renderer\src\lib\show-speichern'`.

- [ ] **Schritt 3: `apps/launcher/src/renderer/src/lib/show-speichern.ts` anlegen (ganzer Inhalt)**

```ts
// ─────────────────────────────────────────────────────────────────────────────
// Show-Editor: was beim Speichern in die .jmshow geht (Master-Link Teil 2a, Spec 7.5).
//
// Der Editor baute die Show beim Speichern bisher neu und verlor dabei Tool-
// Einstellungen (eigene Timer-Liste, Presenter-PIN …), `network.port` und
// `iveo.syncedAt` und rundete Dauern auf ganze Minuten. `baueGespeicherteShow`
// geht deshalb von der GELADENEN Show aus und überschreibt nur, was das Formular
// zeigt — und auch das nur, wenn es im Formular geändert wurde.
//
// Rein: zur Laufzeit nur `@jm/show` (keine Electron-, keine Alias-Importe) → läuft
// im Renderer und im tsx-Test (test/show-speichern.test.ts).
// ─────────────────────────────────────────────────────────────────────────────

import {
  createShow,
  type Show,
  type ShowAblaufItem,
  type ShowIveoBinding,
  type ShowIveoProgramRef,
  type ShowIveoSpeaker,
  type ShowToolRef,
} from '@jm/show';

/** Eine Zeile des zentralen Ablaufs im Editor (#78; Kennungen Spec 3.3, Dauern 7.5). */
export interface AblaufZeile {
  /** Feste Kennung des Ablaufpunkts: iveo-ID oder beim Anlegen erzeugt (Spec 3.2). */
  id?: string;
  label: string;
  /** Dauer in Minuten als Eingabe-Text (z. B. "5" oder "2.5"). Leer = ohne Dauer. */
  minutes: string;
  /** Freie Notiz. */
  note: string;
  /**
   * Durchreich-Felder aus einer iveo-Bindung (#11/Sub-B/Sub-C, F1): im Editor nicht
   * editierbar, müssen den Editor aber unverändert durchlaufen.
   */
  plannedStartMs?: number;
  owner?: string;
  category?: string;
  /** Geladene Dauer in ms — wird sekundengenau geschrieben, solange `minutes` unverändert bleibt. */
  geladenDurationMs?: number;
  /** Der aus `geladenDurationMs` erzeugte Minuten-Text (Vergleichswert für `minutes`). */
  geladenMinutes?: string;
}

/** Stand des Show-Editor-Formulars beim Speichern. */
export interface FormularStand {
  /** Name im Formular; leer = „Unbenannte Show“. */
  name: string;
  /** Gewählte Tools in Formular-Reihenfolge. */
  tools: Array<{ appId: string; document: string; host: string }>;
  ablauf: AblaufZeile[];
  battle: { nameA: string; nameB: string; rounds: string };
  /** Q&A-Redezeit in Sekunden als Eingabe-Text. */
  qaSpeak: string;
  /** Nur gesetzt, wenn in diesem Editor neu gebunden wurde („Ablauf übernehmen“). */
  iveoNeuGebunden: ShowIveoBinding | null;
}

/** iveo-Bindung, wie der Editor sie anzeigt (token-frei). */
export interface EditorBindung {
  event: string;
  name: string;
  baseUrl?: string;
  speakers?: ShowIveoSpeaker[];
  sideEvents?: ShowIveoProgramRef[];
  filter?: ShowIveoBinding['filter'];
}

type ToolZeile = FormularStand['tools'][number];

const UNBENANNT = 'Unbenannte Show';

/** Dauer → Minuten-Text der Editor-Zeile (wie bisher auf ganze Minuten gerundet). */
function minutenText(durationMs: number | undefined): string {
  return durationMs ? String(Math.round(durationMs / 60000)) : '';
}

/** Ablaufpunkte (aus der Show oder dem Bind-Ergebnis) → Editor-Zeilen; Kennung und Dauer laufen mit. */
export function zeilenAusAblauf(ablauf: ShowAblaufItem[] | undefined): AblaufZeile[] {
  return (ablauf ?? []).map((a) => {
    const minutes = minutenText(a.durationMs);
    return {
      ...(a.id ? { id: a.id } : {}),
      label: a.label,
      minutes,
      note: a.note ?? '',
      // 0 ist ein gültiger plannedStartMs-Wert (00:00 Uhr).
      ...(typeof a.plannedStartMs === 'number' ? { plannedStartMs: a.plannedStartMs } : {}),
      ...(a.owner ? { owner: a.owner } : {}),
      ...(a.category ? { category: a.category } : {}),
      ...(typeof a.durationMs === 'number' ? { geladenDurationMs: a.durationMs } : {}),
      geladenMinutes: minutes,
    };
  });
}

/** Szenario-Vorlage → Editor-Zeilen; jede Zeile bekommt beim Übernehmen eine Kennung (Spec 3.2). */
export function zeilenAusSeed(
  seed: Array<{ label: string; minutes?: number; note?: string }> | undefined,
  neueId: () => string,
): AblaufZeile[] {
  return (seed ?? []).map((a) => ({
    id: neueId(),
    label: a.label,
    minutes: a.minutes != null ? String(a.minutes) : '',
    note: a.note ?? '',
  }));
}

/** Formularstand, den eine geladene Show im Editor ergibt („Bestehende öffnen…“). */
export function formularAusShow(show: Show): FormularStand {
  const battle = show.tools.find((t) => t.appId === 'jm-battle')?.settings;
  const qa = show.tools.find((t) => t.appId === 'jm-qa')?.settings;
  return {
    name: show.name === UNBENANNT ? '' : show.name,
    tools: show.tools.map((t) => ({ appId: t.appId, document: t.document ?? '', host: t.network?.host ?? '' })),
    ablauf: zeilenAusAblauf(show.ablauf),
    battle: {
      nameA: typeof battle?.nameA === 'string' ? battle.nameA : '',
      nameB: typeof battle?.nameB === 'string' ? battle.nameB : '',
      rounds: typeof battle?.rounds === 'number' ? String(battle.rounds) : '',
    },
    qaSpeak: typeof qa?.speakSeconds === 'number' ? String(qa.speakSeconds) : '',
    iveoNeuGebunden: null,
  };
}

/** Editor-Bindung → token-freie Show-Bindung; leere Listen und ein leerer Filter fallen weg. */
export function bindungAusEditor(b: EditorBindung): ShowIveoBinding {
  const f = b.filter;
  return {
    event: b.event,
    name: b.name,
    ...(b.baseUrl ? { baseUrl: b.baseUrl } : {}),
    ...(b.speakers?.length ? { speakers: b.speakers } : {}),
    ...(b.sideEvents?.length ? { sideEvents: b.sideEvents } : {}),
    ...(f && (f.typeSlug || f.formatSlug || f.day || f.excludeBlockers || f.programId) ? { filter: f } : {}),
  };
}

/** Minuten-Text unverändert → geladene Dauer sekundengenau; sonst die Eingabe (Spec 7.5). */
function dauerAusZeile(r: AblaufZeile): number | undefined {
  if (r.geladenMinutes !== undefined && r.minutes === r.geladenMinutes) return r.geladenDurationMs;
  const min = parseFloat(r.minutes);
  return Number.isFinite(min) && min > 0 ? Math.round(min * 60000) : undefined;
}

/** Editor-Zeilen → Ablaufpunkte (Titel Pflicht); Zeilen ohne Kennung bekommen `neueId()`. */
export function baueAblauf(zeilen: AblaufZeile[], neueId: () => string): ShowAblaufItem[] {
  return zeilen
    .filter((r) => r.label.trim())
    .map((r) => {
      const durationMs = dauerAusZeile(r);
      const note = r.note.trim();
      return {
        id: r.id ?? neueId(),
        label: r.label.trim(),
        ...(durationMs ? { durationMs } : {}),
        ...(note ? { note } : {}),
        ...(typeof r.plannedStartMs === 'number' ? { plannedStartMs: r.plannedStartMs } : {}),
        ...(r.owner ? { owner: r.owner } : {}),
        ...(r.category ? { category: r.category } : {}),
      };
    });
}

/** Hat sich der Ablauf im Formular gegenüber dem Laden verändert? (Kennung, Titel, Minuten, Notiz) */
function gleicheZeilen(a: AblaufZeile[], b: AblaufZeile[]): boolean {
  return (
    a.length === b.length &&
    a.every((r, i) => r.id === b[i].id && r.label === b[i].label && r.minutes === b[i].minutes && r.note === b[i].note)
  );
}

/** Battle-Einstellungen eines neu gewählten Tools (wie bisher). */
function battleEinstellungen(b: FormularStand['battle']): Record<string, unknown> | undefined {
  const s: Record<string, unknown> = {};
  if (b.nameA.trim()) s.nameA = b.nameA.trim();
  if (b.nameB.trim()) s.nameB = b.nameB.trim();
  const r = parseInt(b.rounds, 10);
  if (Number.isFinite(r) && r > 0) s.rounds = r;
  return Object.keys(s).length ? s : undefined;
}

/** Ein im Formular neu gewähltes Tool (oder jedes Tool einer neuen Show) — wie bisher gebaut. */
function neuesTool(t: ToolZeile, f: FormularStand): ShowToolRef {
  const ref: ShowToolRef = { appId: t.appId };
  const doc = t.document.trim();
  if (doc) ref.document = doc;
  const host = t.host.trim();
  if (host) ref.network = { host };
  if (t.appId === 'jm-battle') {
    const s = battleEinstellungen(f.battle);
    if (s) ref.settings = s;
  }
  if (t.appId === 'jm-qa') {
    const sec = parseInt(f.qaSpeak, 10);
    if (Number.isFinite(sec) && sec > 0) ref.settings = { speakSeconds: sec };
  }
  return ref;
}

function setzeText(s: Record<string, unknown>, key: string, wert: string): void {
  const v = wert.trim();
  if (v) s[key] = v;
  else delete s[key];
}
function setzeZahl(s: Record<string, unknown>, key: string, wert: string): void {
  const n = parseInt(wert, 10);
  if (Number.isFinite(n) && n > 0) s[key] = n;
  else delete s[key];
}

/** Ein schon geladenes Tool: nur im Formular geänderte Felder anfassen, alle anderen bleiben. */
function aktualisiereTool(ref: ShowToolRef, vorher: ToolZeile | undefined, t: ToolZeile, basis: FormularStand, f: FormularStand): ShowToolRef {
  const out: ShowToolRef = { ...ref };
  if (t.document !== (vorher?.document ?? '')) {
    const doc = t.document.trim();
    if (doc) out.document = doc;
    else delete out.document;
  }
  if (t.host !== (vorher?.host ?? '')) {
    const network = { ...(ref.network ?? {}) };
    const host = t.host.trim();
    if (host) network.host = host;
    else delete network.host;
    if (network.host !== undefined || network.port !== undefined) out.network = network;
    else delete out.network;
  }
  if (ref.appId === 'jm-battle') {
    const b = basis.battle;
    const n = f.battle;
    if (n.nameA !== b.nameA || n.nameB !== b.nameB || n.rounds !== b.rounds) {
      const s: Record<string, unknown> = { ...(ref.settings ?? {}) };
      if (n.nameA !== b.nameA) setzeText(s, 'nameA', n.nameA);
      if (n.nameB !== b.nameB) setzeText(s, 'nameB', n.nameB);
      if (n.rounds !== b.rounds) setzeZahl(s, 'rounds', n.rounds);
      if (Object.keys(s).length) out.settings = s;
      else delete out.settings;
    }
  }
  if (ref.appId === 'jm-qa' && f.qaSpeak !== basis.qaSpeak) {
    const s: Record<string, unknown> = { ...(ref.settings ?? {}) };
    setzeZahl(s, 'speakSeconds', f.qaSpeak);
    if (Object.keys(s).length) out.settings = s;
    else delete out.settings;
  }
  return out;
}

/** Tool-Liste: abgewählte fallen weg, geladene behalten Reihenfolge und Felder, neue kommen ans Ende. */
function baueTools(alt: ShowToolRef[], basis: FormularStand, f: FormularStand): ShowToolRef[] {
  const imFormular = new Map(f.tools.map((t) => [t.appId, t]));
  const out: ShowToolRef[] = [];
  const drin = new Set<string>();
  for (const ref of alt) {
    const t = imFormular.get(ref.appId);
    if (!t) continue; // im Formular abgewählt
    drin.add(ref.appId);
    out.push(aktualisiereTool(ref, basis.tools.find((b) => b.appId === ref.appId), t, basis, f));
  }
  for (const t of f.tools) {
    if (drin.has(t.appId)) continue;
    drin.add(t.appId);
    out.push(neuesTool(t, f));
  }
  return out;
}

/**
 * Show zum Speichern bauen (Spec 7.5).
 * - `geladen` = die beim Öffnen gelesene Show (null bei einer neuen Show).
 * - `aktuelleDatei` = dieselbe Datei, wie sie JETZT auf der Platte liegt (null, wenn
 *   nicht lesbar) — eine iveo-Abfrage kann sie seit dem Laden neu geschrieben haben.
 * - `neueId` = Kennung für Ablaufzeilen ohne `id`.
 */
export function baueGespeicherteShow(geladen: Show | null, f: FormularStand, aktuelleDatei: Show | null, neueId: () => string): Show {
  if (!geladen) {
    const ablauf = baueAblauf(f.ablauf, neueId);
    return {
      ...createShow(f.name.trim() || UNBENANNT),
      tools: f.tools.map((t) => neuesTool(t, f)),
      ...(ablauf.length ? { ablauf } : {}),
      ...(f.iveoNeuGebunden ? { iveo: f.iveoNeuGebunden } : {}),
    };
  }
  const basis = formularAusShow(geladen);
  const show: Show = { ...geladen, tools: baueTools(geladen.tools, basis, f) };
  if (f.name !== basis.name) show.name = f.name.trim() || UNBENANNT;
  const ablaufGleich = gleicheZeilen(f.ablauf, basis.ablauf);
  if (ablaufGleich && geladen.iveo && !f.iveoNeuGebunden && aktuelleDatei) {
    // Regel 1: gleiche Bindung, Ablauf unverändert → Ablauf und Bindung so, wie sie
    // JETZT in der Datei stehen. Eine iveo-Abfrage seit dem Laden bleibt erhalten.
    if (aktuelleDatei.ablauf) show.ablauf = aktuelleDatei.ablauf;
    else delete show.ablauf;
    if (aktuelleDatei.iveo) show.iveo = aktuelleDatei.iveo;
    else delete show.iveo;
    return show;
  }
  if (!ablaufGleich) {
    const ablauf = baueAblauf(f.ablauf, neueId);
    if (ablauf.length) show.ablauf = ablauf;
    else delete show.ablauf;
  }
  if (f.iveoNeuGebunden) show.iveo = f.iveoNeuGebunden;
  return show;
}
```

- [ ] **Schritt 4: Skript `selftest:iveo` ergänzen — `apps/launcher/package.json`**

Vorher (Stand nach A15):
```json
    "selftest:iveo": "tsx test/iveo-abgleich.test.ts && tsx test/iveo-huelle.test.ts",
```
Nachher:
```json
    "selftest:iveo": "tsx test/iveo-abgleich.test.ts && tsx test/iveo-huelle.test.ts && tsx test/show-speichern.test.ts",
```

- [ ] **Schritt 5: Test laufen lassen, Erfolg sehen**

Run: `npx tsx apps/launcher/test/show-speichern.test.ts`
Expected: letzte Zeile `45 ok, 0 fehlgeschlagen.`, Exit-Code 0.

Run: `npm run selftest:iveo -w @jm/launcher`
Expected: alle drei Testdateien grün.

- [ ] **Schritt 6: Main liest die aktuelle Datei — `apps/launcher/src/main/show.ts`**

Vorher:
```ts
/** Datei-Dialog zur Auswahl eines Tool-Dokuments (z. B. .jmpres, .jmdaw). */
```
Nachher:
```ts
/**
 * Eine .jmshow so lesen, wie sie gerade auf der Platte liegt — der Show-Editor
 * braucht das beim Speichern (Spec 7.5, Regel 1). Nur .jmshow-Dateien; nicht
 * lesbar → null.
 */
export function readShowFile(path: string): Show | null {
  if (!path.toLowerCase().endsWith(SHOW_FILE_EXT)) return null;
  try {
    return parseShow(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

/** Datei-Dialog zur Auswahl eines Tool-Dokuments (z. B. .jmpres, .jmdaw). */
```

- [ ] **Schritt 7: IPC `show:read` — `apps/launcher/src/main/ipc.ts`, Preload, Typ**

`apps/launcher/src/main/ipc.ts`, Ersetzung 1 (Zeile 32).
Vorher:
```ts
import { openShowDialog, openShow, saveShow, pickShowDocument, loadShowForEdit } from './show';
```
Nachher:
```ts
import { openShowDialog, openShow, saveShow, pickShowDocument, loadShowForEdit, readShowFile } from './show';
```

`apps/launcher/src/main/ipc.ts`, Ersetzung 2.
Vorher:
```ts
  ipcMain.handle('show:loadForEdit', () => loadShowForEdit());
```
Nachher:
```ts
  ipcMain.handle('show:loadForEdit', () => loadShowForEdit());
  // Show-Editor beim Speichern: die Datei so, wie sie JETZT ist (Spec 7.5, Regel 1).
  ipcMain.handle('show:read', (_e, path: string) => (typeof path === 'string' ? readShowFile(path) : null));
```

`apps/launcher/src/preload/index.ts`.
Vorher:
```ts
  loadShowForEdit: () => invoke<{ path: string; show: Show } | null>('show:loadForEdit'),
```
Nachher:
```ts
  loadShowForEdit: () => invoke<{ path: string; show: Show } | null>('show:loadForEdit'),
  readShow: (path: string) => invoke<Show | null>('show:read', path),
```

`apps/launcher/src/shared/types.ts`.
Vorher:
```ts
  /** Bestehende .jmshow zum Bearbeiten laden (Datei-Dialog) → Pfad + geparste Show. */
  loadShowForEdit: () => Promise<{ path: string; show: Show } | null>;
```
Nachher:
```ts
  /** Bestehende .jmshow zum Bearbeiten laden (Datei-Dialog) → Pfad + geparste Show. */
  loadShowForEdit: () => Promise<{ path: string; show: Show } | null>;
  /** Eine .jmshow so lesen, wie sie gerade auf der Platte liegt (Show-Editor, Spec 7.5); nicht lesbar → null. */
  readShow: (path: string) => Promise<Show | null>;
```

- [ ] **Schritt 8: Show-Editor verdrahten — `apps/launcher/src/renderer/src/components/ShowEditorModal.tsx`**

Ersetzung 1 (Importe, Zeilen 1-12).
Vorher:
```tsx
import { useEffect, useState } from 'react';
import { Button, Card, cn } from '@jm/ui';
import {
  createShow,
  type Show,
  type ShowAblaufItem,
  type ShowIveoProgramRef,
  type ShowIveoSpeaker,
  type ShowToolRef,
} from '@jm/show';
import type { IveoEventStub, IveoProgramRef, IveoProgramTaxonomy } from '@shared/types';
import { useTools } from '@/store/tools';
```
Nachher:
```tsx
import { useEffect, useState } from 'react';
import { Button, Card, cn } from '@jm/ui';
import type { Show } from '@jm/show';
import type { IveoEventStub, IveoProgramRef, IveoProgramTaxonomy } from '@shared/types';
import { useTools } from '@/store/tools';
import {
  baueGespeicherteShow,
  bindungAusEditor,
  formularAusShow,
  zeilenAusAblauf,
  zeilenAusSeed,
  type AblaufZeile,
  type EditorBindung,
  type FormularStand,
} from '@/lib/show-speichern';
```

Ersetzung 2 (lokale `AblaufRow` entfällt, Zeilen 21-39).
Vorher:
```tsx
/** Eine Zeile des zentralen Show-Ablaufs (#78) im Editor. */
interface AblaufRow {
  label: string;
  /** Dauer in Minuten als Eingabe-String (z. B. "5" oder "2.5"). Leer = ohne Dauer. */
  minutes: string;
  /** Freie Notiz (optional). */
  note: string;
  /**
   * Reine Durchreich-Felder aus einer iveo-Bindung (#11/Sub-B/Sub-C) — im Editor
   * NICHT editierbar (keine UI dafür), aber müssen den Editor unverändert
   * durchlaufen, sonst gehen Soll-Zeit/Verantwortlich/Kategorie beim Speichern
   * verloren (F1: der Editor ist der einzige Schreiber nach einem Bind).
   */
  plannedStartMs?: number;
  owner?: string;
  category?: string;
}

const EMPTY_ENTRY: Entry = { included: false, document: '', host: '' };
```
Nachher:
```tsx
const EMPTY_ENTRY: Entry = { included: false, document: '', host: '' };
```

Ersetzung 3 (Zeile 65).
Vorher:
```tsx
  const [ablauf, setAblauf] = useState<AblaufRow[]>([]);
```
Nachher:
```tsx
  const [ablauf, setAblauf] = useState<AblaufZeile[]>([]);
```

Ersetzung 4 (Zeilen 71-72).
Vorher:
```tsx
  // Bearbeiten (statt neu): Pfad der geladenen Show — Speichern schreibt dorthin zurück.
  const [editPath, setEditPath] = useState<string | null>(null);
```
Nachher:
```tsx
  // Bearbeiten (statt neu): Pfad der geladenen Show — Speichern schreibt dorthin zurück.
  const [editPath, setEditPath] = useState<string | null>(null);
  // Bearbeiten: die geladene Show unverändert — Speichern geht von ihr aus und
  // überschreibt nur, was das Formular zeigt (Spec 7.5, baueGespeicherteShow).
  const [geladen, setGeladen] = useState<Show | null>(null);
  // In diesem Editor neu an iveo gebunden („Ablauf übernehmen“) → die Bindung wird geschrieben.
  const [iveoNeuGebunden, setIveoNeuGebunden] = useState(false);
```

Ersetzung 5 (Zeilen 80-87).
Vorher:
```tsx
  const [iveoBinding, setIveoBinding] = useState<{
    event: string;
    name: string;
    baseUrl?: string;
    speakers?: ShowIveoSpeaker[];
    sideEvents?: ShowIveoProgramRef[];
    filter?: { typeSlug?: string; formatSlug?: string; day?: string; excludeBlockers?: boolean; programId?: string };
  } | null>(null);
```
Nachher:
```tsx
  const [iveoBinding, setIveoBinding] = useState<EditorBindung | null>(null);
```

Ersetzung 6 (Szenario-Seed, Zeilen 116-122).
Vorher:
```tsx
    setAblauf(
      (editorSeed.ablauf ?? []).map((a) => ({
        label: a.label,
        minutes: a.minutes != null ? String(a.minutes) : '',
        note: a.note ?? '',
      })),
    );
```
Nachher:
```tsx
    // Szenario-Zeilen bekommen beim Übernehmen je eine feste Kennung (Spec 3.2).
    setAblauf(zeilenAusSeed(editorSeed.ablauf, () => crypto.randomUUID()));
```

Ersetzung 7 (Ende des Seed-Effekts, Zeilen 125-126).
Vorher:
```tsx
    setEditPath(null);
    clearEditorSeed();
```
Nachher:
```tsx
    setEditPath(null);
    setGeladen(null);
    setIveoNeuGebunden(false);
    clearEditorSeed();
```

Ersetzung 8 (Zeilen 162-165).
Vorher:
```tsx
  const addAblaufRow = (): void =>
    setAblauf((rows) => [...rows, { label: '', minutes: '', note: '' }]);
  const setAblaufRow = (i: number, patch: Partial<AblaufRow>): void =>
```
Nachher:
```tsx
  // Eine neue Zeile bekommt sofort ihre feste Kennung, die mitgespeichert wird (Spec 3.2).
  const addAblaufRow = (): void =>
    setAblauf((rows) => [...rows, { id: crypto.randomUUID(), label: '', minutes: '', note: '' }]);
  const setAblaufRow = (i: number, patch: Partial<AblaufZeile>): void =>
```

Ersetzung 9 (Bind-Ergebnis, Zeilen 233-243).
Vorher:
```tsx
      const rows: AblaufRow[] = (res.ablauf ?? []).map((a) => ({
        label: a.label,
        minutes: a.durationMs ? String(Math.round(a.durationMs / 60000)) : '',
        note: a.note ?? '',
        // Durchreich-Felder aus iveo (F1) — im Editor nicht sichtbar/editierbar,
        // müssen aber bis buildAblauf() erhalten bleiben (0 ist gültig = 00:00 Uhr).
        ...(typeof a.plannedStartMs === 'number' ? { plannedStartMs: a.plannedStartMs } : {}),
        ...(a.owner ? { owner: a.owner } : {}),
        ...(a.category ? { category: a.category } : {}),
      }));
      setAblauf(rows);
```
Nachher:
```tsx
      // Kennungen, Durchreich-Felder (F1) und die sekundengenaue Dauer laufen mit (Spec 3.3, 7.5).
      const rows = zeilenAusAblauf(res.ablauf);
      setAblauf(rows);
      setIveoNeuGebunden(true);
```

Ersetzung 10 (`buildAblauf` und `buildRef` werden zu `formular`, Zeilen 285-325).
Vorher:
```tsx
  /** Editor-Zeilen → zentrale Show-Ablauf-Items (Titel Pflicht, Dauer/Notiz optional). */
  const buildAblauf = (): ShowAblaufItem[] =>
    ablauf
      .filter((r) => r.label.trim())
      .map((r) => {
        const min = parseFloat(r.minutes);
        const durationMs = Number.isFinite(min) && min > 0 ? Math.round(min * 60000) : undefined;
        const note = r.note.trim();
        return {
          label: r.label.trim(),
          ...(durationMs ? { durationMs } : {}),
          ...(note ? { note } : {}),
          // Durchreich-Felder aus iveo (F1): nicht editierbar, aber müssen erhalten
          // bleiben — 0 ist ein gültiger plannedStartMs-Wert (00:00 Uhr).
          ...(typeof r.plannedStartMs === 'number' ? { plannedStartMs: r.plannedStartMs } : {}),
          ...(r.owner ? { owner: r.owner } : {}),
          ...(r.category ? { category: r.category } : {}),
        };
      });

  const buildRef = (id: string): ShowToolRef => {
    const e = entries[id];
    const ref: ShowToolRef = { appId: id };
    const doc = e?.document.trim();
    if (doc) ref.document = doc;
    const host = e?.host.trim();
    if (host) ref.network = { host };
    if (id === 'jm-battle') {
      const s: Record<string, unknown> = {};
      if (battleA.trim()) s.nameA = battleA.trim();
      if (battleB.trim()) s.nameB = battleB.trim();
      const r = parseInt(battleRounds, 10);
      if (Number.isFinite(r) && r > 0) s.rounds = r;
      if (Object.keys(s).length) ref.settings = s;
    }
    if (id === 'jm-qa') {
      const sec = parseInt(qaSpeak, 10);
      if (Number.isFinite(sec) && sec > 0) ref.settings = { speakSeconds: sec };
    }
    return ref;
  };
```
Nachher:
```tsx
  /**
   * Formularstand für baueGespeicherteShow: gewählte Tools in Katalog-Reihenfolge,
   * dahinter gewählte Tools, die der Katalog nicht kennt (aus der geladenen Show) —
   * sie bleiben so erhalten, statt beim Speichern still wegzufallen.
   */
  const formular = (): FormularStand => {
    const katalog = new Set(sorted.map((t) => t.id));
    const ids = [
      ...sorted.filter((t) => entries[t.id]?.included).map((t) => t.id),
      ...Object.keys(entries).filter((id) => entries[id]?.included && !katalog.has(id)),
    ];
    return {
      name,
      tools: ids.map((id) => ({ appId: id, document: entries[id]?.document ?? '', host: entries[id]?.host ?? '' })),
      ablauf,
      battle: { nameA: battleA, nameB: battleB, rounds: battleRounds },
      qaSpeak,
      iveoNeuGebunden: iveoNeuGebunden && iveoBinding ? bindungAusEditor(iveoBinding) : null,
    };
  };
```

Ersetzung 11 (`resetForm`, Zeilen 347-350).
Vorher:
```tsx
    setIveoProgramList([]);
    setEditPath(null);
  };
```
Nachher:
```tsx
    setIveoProgramList([]);
    setEditPath(null);
    setGeladen(null);
    setIveoNeuGebunden(false);
  };
```

Ersetzung 12 (`loadForEdit` und `onSave`, Zeilen 357-440).
Vorher:
```tsx
  /** Bestehende .jmshow laden und das Formular damit füllen (Bearbeiten). */
  const loadForEdit = async (): Promise<void> => {
    const r = await window.jmps.loadShowForEdit();
    if (!r) return;
    const { path, show } = r;
    resetForm();
    setEditPath(path);
    setName(show.name === 'Unbenannte Show' ? '' : show.name);
    const next: Record<string, Entry> = {};
    for (const ref of show.tools) {
      next[ref.appId] = { included: true, document: ref.document ?? '', host: ref.network?.host ?? '' };
    }
    setEntries(next);
    setAblauf(
      (show.ablauf ?? []).map((a) => ({
        label: a.label,
        minutes: a.durationMs ? String(Math.round(a.durationMs / 60000)) : '',
        note: a.note ?? '',
        // Durchreich-Felder aus iveo (F1) — s. Kommentar in bindIveo().
        ...(typeof a.plannedStartMs === 'number' ? { plannedStartMs: a.plannedStartMs } : {}),
        ...(a.owner ? { owner: a.owner } : {}),
        ...(a.category ? { category: a.category } : {}),
      })),
    );
    const battle = show.tools.find((t) => t.appId === 'jm-battle')?.settings as
      | Record<string, unknown>
      | undefined;
    setBattleA(typeof battle?.nameA === 'string' ? battle.nameA : '');
    setBattleB(typeof battle?.nameB === 'string' ? battle.nameB : '');
    setBattleRounds(typeof battle?.rounds === 'number' ? String(battle.rounds) : '');
    const qa = show.tools.find((t) => t.appId === 'jm-qa')?.settings as Record<string, unknown> | undefined;
    setQaSpeak(typeof qa?.speakSeconds === 'number' ? String(qa.speakSeconds) : '');
    setIveoBinding(
      show.iveo
        ? {
            event: show.iveo.event,
            name: show.iveo.name ?? show.iveo.event,
            baseUrl: show.iveo.baseUrl,
            speakers: show.iveo.speakers,
            sideEvents: show.iveo.sideEvents,
            filter: show.iveo.filter,
          }
        : null,
    );
  };

  const onSave = async (): Promise<void> => {
    const ablaufItems = buildAblauf();
    const show: Show = {
      ...createShow(name.trim() || 'Unbenannte Show'),
      tools: sorted.filter((t) => entries[t.id]?.included).map((t) => buildRef(t.id)),
      ...(ablaufItems.length ? { ablauf: ablaufItems } : {}),
      // Token-freie iveo-Bindung (nur Slug/Name/Base-URL) — für das Live-Polling.
      ...(iveoBinding
        ? {
            iveo: {
              event: iveoBinding.event,
              name: iveoBinding.name,
              ...(iveoBinding.baseUrl ? { baseUrl: iveoBinding.baseUrl } : {}),
              ...(iveoBinding.speakers?.length ? { speakers: iveoBinding.speakers } : {}),
              ...(iveoBinding.sideEvents?.length ? { sideEvents: iveoBinding.sideEvents } : {}),
              ...(iveoBinding.filter &&
              (iveoBinding.filter.typeSlug ||
                iveoBinding.filter.formatSlug ||
                iveoBinding.filter.day ||
                iveoBinding.filter.excludeBlockers ||
                iveoBinding.filter.programId)
                ? { filter: iveoBinding.filter }
                : {}),
            },
          }
        : {}),
    };
    setBusy(true);
    try {
      const ok = await saveShow(show, editPath ?? undefined);
      if (ok) {
        resetForm();
        close();
      }
    } finally {
      setBusy(false);
    }
  };
```
Nachher:
```tsx
  /** Bestehende .jmshow laden und das Formular damit füllen (Bearbeiten). */
  const loadForEdit = async (): Promise<void> => {
    const r = await window.jmps.loadShowForEdit();
    if (!r) return;
    const { path, show } = r;
    resetForm();
    setEditPath(path);
    // Unverändert festhalten: Speichern überschreibt nur, was das Formular zeigt (Spec 7.5).
    setGeladen(show);
    const f = formularAusShow(show);
    setName(f.name);
    setEntries(
      Object.fromEntries(f.tools.map((t) => [t.appId, { included: true, document: t.document, host: t.host }])),
    );
    setAblauf(f.ablauf);
    setBattleA(f.battle.nameA);
    setBattleB(f.battle.nameB);
    setBattleRounds(f.battle.rounds);
    setQaSpeak(f.qaSpeak);
    setIveoBinding(
      show.iveo
        ? {
            event: show.iveo.event,
            name: show.iveo.name ?? show.iveo.event,
            baseUrl: show.iveo.baseUrl,
            speakers: show.iveo.speakers,
            sideEvents: show.iveo.sideEvents,
            filter: show.iveo.filter,
          }
        : null,
    );
  };

  const onSave = async (): Promise<void> => {
    setBusy(true);
    try {
      const f = formular();
      // Bearbeiten: die Datei so lesen, wie sie JETZT ist — eine iveo-Abfrage kann sie
      // seit dem Laden neu geschrieben haben (Spec 7.5, Regel 1).
      const aktuelleDatei = editPath ? await window.jmps.readShow(editPath) : null;
      const show = baueGespeicherteShow(editPath ? geladen : null, f, aktuelleDatei, () => crypto.randomUUID());
      const ok = await saveShow(show, editPath ?? undefined, f.iveoNeuGebunden !== null);
      if (ok) {
        resetForm();
        close();
      }
    } finally {
      setBusy(false);
    }
  };
```

- [ ] **Schritt 9: Typecheck und Build**

Run: `npm run typecheck -w @jm/launcher`
Expected: ohne Fehler. (Hinweis: Meldet TypeScript `Entry` als unbenutzt o. ä., gibt es eine übersehene Stelle; `Entry` wird weiter von `entries` genutzt.)

Run: `npm run build -w @jm/launcher`
Expected: Build ohne Fehler.

- [ ] **Schritt 10: Alle Launcher-Tests**

Run: `npm run selftest -w @jm/launcher && npm run selftest:verbund -w @jm/launcher && npm run selftest:iveo -w @jm/launcher`
Expected: alle grün; `show-speichern.test.ts` endet mit `45 ok, 0 fehlgeschlagen.`

- [ ] **Schritt 11: Commit**

```bash
git add apps/launcher/src/renderer/src/lib/show-speichern.ts apps/launcher/test/show-speichern.test.ts apps/launcher/package.json apps/launcher/src/renderer/src/components/ShowEditorModal.tsx apps/launcher/src/main/show.ts apps/launcher/src/main/ipc.ts apps/launcher/src/preload/index.ts apps/launcher/src/shared/types.ts
git status --short
git commit -m "feat(launcher): Show-Editor verliert beim Speichern nichts mehr (baueGespeicherteShow)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
1. Zusätzliche Exporte in `show-speichern.ts`: `formularAusShow`, `zeilenAusAblauf`, `zeilenAusSeed`, `bindungAusEditor`, `baueAblauf` und der Typ `EditorBindung`. Grund: Laden (S3: `loadForEdit`, Bind-Ergebnis, Szenario) und Speichern sollen dieselbe Umrechnung nutzen, und der Test 9.5 „Laden und Speichern ohne Änderung“ braucht den Formularstand, den das Laden erzeugt.
2. `lib/scenarios.ts` bleibt unverändert: Die Vorlage selbst trägt keine Kennungen; jede Zeile bekommt ihre Kennung beim Übernehmen in den Editor (`zeilenAusSeed`, Spec 3.2 „je Zeile beim Übernehmen“).
3. Neue IPC `show:read` (`window.jmps.readShow`): Für Regel 1 braucht der Renderer die Datei so, wie sie beim Speichern auf der Platte liegt. Bisher gab es nur `loadShowForEdit` mit Dialog.
4. Die Felder werden nur geschrieben, wenn sie im Formular anders sind als beim Laden. Das ist strenger als „überschreibt nur …“ und nötig, damit Laden und Speichern ohne Änderung byte-gleich bleibt (9.5), auch bei Werten mit Leerzeichen.
5. Altshows ohne Kennungen bekommen ihre Kennungen beim Speichern nur, wenn der Ablauf im Formular geändert wurde. Ungeändert bleibt die Datei byte-gleich (9.5); die Kennungen kommen dann mit der ersten iveo-Abfrage bzw. der ersten Ablauf-Änderung (Spec 3.4, R0 im Rundown).
6. Tools, die der Katalog nicht kennt, aber in der geladenen Show stehen, bleiben beim Speichern erhalten (bisher fielen sie still weg, weil `onSave` nur über die Katalogliste lief).

---

### Aufgabe A17: CI-Job `selftests` erweitern + Durchgang mit gebauten Programmen (`e2e-teil2a.mjs`)

**Spec:** 9.7 (CI), 9.8 (Durchgang mit gebauten Programmen), 6.4 (Titler nur nachmessen), 7.1 (Logzeile), 4.6 (Hinweistexte), 4.7 (Gedächtnis-Ort und -Schlüssel), 5.2 (Ladewege), 6.1/6.2 (Timer, Sprung über die Kennung).

**Dateien:**
- Modify: `.github/workflows/ci-checks.yml:49-50` (Job `selftests`, hinter dem Verbund-Schritt)
- Create: `apps/rundown/test/e2e-teil2a.mjs` (nicht in CI)
- Bericht: die vollständige Konsolenausgabe des Durchgangs und die Zeile `MESSUNG 6.4: …` gehören in den Aufgabenbericht (Abschnitt „Durchgang 9.8“); die Titler-Messung geht von dort in den PR-Text und in die 2b-Spec (Spec 6.4).

**Schnittstellen:**
- Consumes (alles aus früheren Aufgaben, so wie das Gerüst sie festlegt):
  - A2: `agendaToAblauf` setzt `id: it.id` (Feld zuerst); `normalizeAblauf`/`serializeShow` erhalten `id` (A1).
  - A3: Timer-Punkte tragen die Kennung (`ablaufToTimetable` gibt `id` mit); `tt:replaceItems` hält den aktiven Punkt über die Kennung; Logzeile „Aktiver Punkt im neuen Ablauf nicht mehr vorhanden, Nummer gehalten“.
  - A4: `RundownRow.quelle?: 'ablauf'`, `RundownRow.entfallen?: true`, `RundownAction.zielId?: string`, `RundownDoc.schemaVersion: 2`.
  - A9: Gedächtnis `<userData>/regie/<schlüssel>.json`, Schlüssel = erste 16 Hex-Zeichen von SHA-256 über `path.resolve(showPfad).toLowerCase()`, Inhalt `{ schemaVersion: 2, showPfad, showName, doc, scharfId, gespeichertAm, datei? }`.
  - A10/A11: `window.jmrundown.getState(): Promise<RundownState>`, `window.jmrundown.setDoc(doc, basisRev): Promise<RundownState>`, `window.jmrundown.nav(cmd): Promise<RundownState>`; `RundownState` mit `rev`, `scharfId`, `hinweise: { id: number; text: string; art: 'kurz' | 'stehend' }[]`, `showGemerkt`, `showMitIveo`, `links`, `lastFired`; STATE `cue=` aus `indexVon(scharfId)`; Rundown-Warnung wortgleich zum Timer „RELOAD empfangen, aber keine Show geladen (nicht per Show gestartet) — nichts neu eingelesen.“
  - A13/A14: Launcher-Logzeile „iveo: RELOAD → <n> Timer, <n> Titler, <n> Rundown benachrichtigt.“ an allen drei Stellen (Listen-Abfrage, Agenda-Abfrage, Umschalten).
  - A15: Takt aus `JMPS_IVEO_POLL_MS`, Logzeile „iveo: Live-Polling für Event „<slug>" aktiv (alle <n>s).“
- Produces: `apps/rundown/test/e2e-teil2a.mjs` (Aufruf siehe Skriptkopf); CI-Job `selftests` mit den vier Testläufen aus 9.7.

**Was zu wissen ist (für den Umsetzer):**
- Die CI installiert mit `npm ci --ignore-scripts`; dabei fehlt das Electron-Binary. Ein Test, der `electron` lädt, bricht dort ab — das ist die Prüfung „keiner dieser Tests darf Electron laden“ (9.7). Im Worktree fehlt `node_modules/electron/dist` aus demselben Grund.
- Den Jobnamen `Selbsttests (Master-Link + Launcher)` NICHT ändern: `ci-checks.yml` schützt `main`, ein umbenannter Pflicht-Check meldet sich nie mehr und blockiert jeden Merge.
- Zeilenenden: Der Worktree hat `core.autocrlf=true`; `ci-checks.yml` liegt dort mit CRLF. Die Vorher-Ausschnitte unten sind mit LF geschrieben. Trifft eine Ersetzung nicht, zuerst die Zeilenenden prüfen, nicht den Inhalt (geprüft: der Ausschnitt steht nach LF-Angleichung genau einmal in der Datei).
- Der Durchgang braucht eine Windows-Sitzung mit Bildschirm (Electron-Fenster), lokale Tools aus dem Worktree und ein vorhandenes `electron.exe` derselben Version wie `node -p "require('./node_modules/electron/package.json').version"` (33.4.11). Teil 1 nutzte `C:/Users/alexk/alexzvn/node_modules/electron/dist/electron.exe` (nur ausführen, dort nichts ändern).

- [ ] **Schritt 1: Die vier CI-Testläufe lokal laufen lassen (sie müssen schon grün sein)**

Run:
```bash
npm run selftest -w @jm/rundown
npm run selftest -w @jm/iveo
npm run selftest -w @jm/timer
npm run selftest:iveo -w @jm/launcher
node -p "require('./apps/rundown/package.json').scripts.selftest"
ls apps/rundown/test
```
Expected: alle vier grün (Rundown: `test/selftest.ts` bis `ALLE TESTS OK`, danach der Gedächtnis-Test; Timer mit `… passed, 0 failed`; Launcher-iveo mit `45 ok, 0 fehlgeschlagen.` als letzter Datei). Die letzten beiden Befehle zeigen, ob der Gedächtnis-Test aus A9 (`apps/rundown/test/gedaechtnis.test.ts`) im Skript `selftest` steckt — A9 legt das so an (`… test/selftest.ts && node --experimental-strip-types --import ./test/register.mjs test/gedaechtnis.test.ts`); dann braucht die CI keinen eigenen Schritt dafür. Ist er rot: nicht hier reparieren, sondern in der Aufgabe, der der Test gehört (A1–A16), mit `superpowers:systematic-debugging`.

- [ ] **Schritt 2: CI erweitern — `.github/workflows/ci-checks.yml`**

Vorher (Zeilen 49-50):
```yaml
      - name: Launcher (Verbund-Rollen Master/Slave)
        run: npm run selftest:verbund -w @jm/launcher
```
Nachher:
```yaml
      - name: Launcher (Verbund-Rollen Master/Slave)
        run: npm run selftest:verbund -w @jm/launcher
      # Master-Link Teil 2a (Spec 9.7). Keiner dieser Tests lädt Electron — ohne
      # Postinstalls fehlt das Binary, ein Electron-Import bricht hier also ab.
      - name: Launcher (iveo-Abgleich-Kern, Hülle, Show-Editor)
        run: npm run selftest:iveo -w @jm/launcher
      - name: iveo + Show-Format (Kennungen von iveo bis in die Show)
        run: npm run selftest -w @jm/iveo
      - name: Timer (aktiver Punkt über die Kennung)
        run: npm run selftest -w @jm/timer
      - name: Rundown (Abgleich, Sprung, scharfe Zeile)
        run: npm run selftest -w @jm/rundown
```
Nur falls Schritt 1 zeigte, dass das Skript `selftest` den Gedächtnis-Test aus A9 NICHT aufruft (Abweichung von A9), kommt direkt dahinter dieser Schritt dazu (Arbeitsverzeichnis wie in A9, wegen `./test/register.mjs`):
```yaml
      - name: Rundown (Gedächtnis-Dateien auf einem Temp-Ordner)
        working-directory: apps/rundown
        run: node --experimental-strip-types --import ./test/register.mjs test/gedaechtnis.test.ts
```

- [ ] **Schritt 3: YAML prüfen**

Run:
```bash
node -e "const y=require('js-yaml').load(require('fs').readFileSync('.github/workflows/ci-checks.yml','utf8'));const j=y.jobs.selftests;const runs=j.steps.map(s=>s.run).filter(Boolean);for(const c of ['npm run selftest:iveo -w @jm/launcher','npm run selftest -w @jm/iveo','npm run selftest -w @jm/timer','npm run selftest -w @jm/rundown','npm run selftest:verbund -w @jm/launcher']){if(!runs.includes(c))throw new Error('fehlt: '+c)}if(j['timeout-minutes']!==15||j.name!=='Selbsttests (Master-Link + Launcher)')throw new Error('Zeitgrenze oder Name verändert');console.log('ci-checks.yml ok:',runs.length,'Schritte mit run')"
```
Expected: `ci-checks.yml ok: 8 Schritte mit run` (Install + 7 Testläufe; mit dem Gedächtnis-Schritt `9 Schritte mit run`).

- [ ] **Schritt 4: Commit (CI)**

```bash
git add .github/workflows/ci-checks.yml
git status --short
git commit -m "ci: Selbsttests Launcher-iveo, iveo, Timer und Rundown im Job selftests (Teil 2a)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Schritt 5: Durchgang schreiben — `apps/rundown/test/e2e-teil2a.mjs` (neu, ganzer Inhalt)**

```js
// ─────────────────────────────────────────────────────────────────────────────
// Durchgang Master-Link Teil 2a mit den GEBAUTEN Programmen (Spec 9.8, Titler-Messung 6.4).
// NICHT in CI: startet Launcher, Timer, Titler und Rundown aus diesem Repo als echte
// Electron-Apps und dazu einen nachgebauten iveo-Server auf 127.0.0.1.
//
// Aufruf (Repo-Wurzel, nach `npm run build -w @jm/launcher -w @jm/timer -w @jm/rundown -w @jm/titler`):
//   ELECTRON_EXE=<Pfad zu electron.exe> node node_modules/tsx/dist/cli.mjs apps/rundown/test/e2e-teil2a.mjs
// tsx, weil das Skript Suite-Pakete als TypeScript-Quelle lädt (Steuer-Client, Show-Format, iveo-Umwandler).
//
// Vorher darf kein Launcher/Timer/Titler/Rundown laufen (Ports 7777, 8724, 8726, 8731, 8736, 8738, 9334 frei).
// Das Skript legt die Daten, die es verändert, VOR dem Lauf beiseite (umbenennen nach <name>.e2e-vorher) und
// stellt sie in jedem Ausgang wieder her (auch Abbruch und Strg+C):
//   %APPDATA%\@jm\rundown\regie, rundown.autosave.jmrundown, rundown.autosave.v1.jmrundown,
//   %APPDATA%\@jm\timer\state.json, %APPDATA%\@jm\titler\titler-config.json, %APPDATA%\@jm\titler\iveo-data,
//   %APPDATA%\JM Production Suite\master-link.json (der Dev-Launcher soll nicht als Master/Slave mitlaufen).
// Nebenwirkung: Der Dev-Launcher meldet sich als Empfänger für jmps://-Links an; der installierte Launcher
// holt sich das bei seinem nächsten Start zurück.
//
// Messpunkte (9.8): Gedächtnis-Datei regie/<schlüssel>.json · STATE des Rundowns auf 8731 · Timer-Socket 7777 ·
// Logzeilen der drei Programme. Den Rundown liest und bedient das Skript über seine Preload-Brücke
// window.jmrundown (Chrome-DevTools-Protokoll auf Port 9334) — derselbe Weg wie der Editor.
// Reihenfolge: 1–7b, dann 9 (Titler hängt an Show 1), zuletzt 8 (wechselt den Rundown auf Show 2).
// ─────────────────────────────────────────────────────────────────────────────
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { connect } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { io } from 'socket.io-client';
import { controlClientOptions, readControlConfig } from '@jm/control-config';
import { agendaToAblauf, localTimeOfDayMs } from '@jm/iveo';
import { serializeShow } from '@jm/show';
import { SuiteControlClient } from '@jm/suite-control-protocol/client';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const ELECTRON = process.env.ELECTRON_EXE ?? join(REPO, 'node_modules/electron/dist/electron.exe');
const APPDATA = process.env.APPDATA ?? '';
/** userData eines Dev-Starts: Electron nimmt den Paketnamen @jm/<app>. */
const DEV = (app) => join(APPDATA, '@jm', app);
const LOGS = Object.fromEntries(['launcher', 'timer', 'titler', 'rundown'].map((a) => [a, join(DEV(a), 'logs', 'main.log')]));
const TOKEN = 'e2e-teil2a-token';
const EVENT = 'e2e-teil2a';
const CDP_RUNDOWN = 9334;
const PORTS = { timerSocket: 7777, timer: 8724, titler: 8726, rundown: 8731, launcher: 8736, verbund: 8738, rundownDevTools: CDP_RUNDOWN };
const VORHER = '.e2e-vorher';
const SICHERN = [
  join(DEV('rundown'), 'regie'),
  join(DEV('rundown'), 'rundown.autosave.jmrundown'),
  join(DEV('rundown'), 'rundown.autosave.v1.jmrundown'),
  join(DEV('timer'), 'state.json'),
  join(DEV('titler'), 'titler-config.json'),
  join(DEV('titler'), 'iveo-data'),
  join(APPDATA, 'JM Production Suite', 'master-link.json'),
];
const env = { ...process.env, JMPS_IVEO_TOKEN: TOKEN, JMPS_IVEO_POLL_MS: '2000' };
delete env.ELECTRON_RUN_AS_NODE;

// ── Kleinkram ─────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function bis(f, maxMs, schrittMs = 200) {
  const ende = Date.now() + maxMs;
  while (Date.now() < ende) {
    const v = await f();
    if (v) return v;
    await sleep(schrittMs);
  }
  return f();
}
function portFrei(port) {
  return new Promise((r) => {
    const s = connect({ port, host: '127.0.0.1' });
    s.once('connect', () => { s.destroy(); r(false); });
    s.once('error', () => r(true));
  });
}
const ergebnisse = [];
function pruefe(name, ok, detail = '') {
  ergebnisse.push({ name, ok: !!ok });
  console.log(`${ok ? 'ok  ' : 'FEHL'} ${name}${detail ? ` — ${detail}` : ''}`);
}
const ids = (st) => (st?.doc?.rows ?? []).map((r) => r.id);
const zeile = (st, id) => (st?.doc?.rows ?? []).find((r) => r.id === id);
const zeilenKurz = (st) =>
  (st?.doc?.rows ?? []).map((r) => `${r.id}${r.entfallen ? '(entfallen)' : ''}${r.quelle ? '' : '(eigen)'}:${r.label}:${r.actions.length}`).join(' | ');

// ── Logs: nur was seit einer Marke dazukam (Bytes; rotiert die Datei, zählt alles) ─
function logMarke(app) {
  return existsSync(LOGS[app]) ? statSync(LOGS[app]).size : 0;
}
function logAb(app, marke) {
  if (!existsSync(LOGS[app])) return '';
  const buf = readFileSync(LOGS[app]);
  return (buf.length >= marke ? buf.subarray(marke) : buf).toString('utf8');
}
function reloadZaehler(text) {
  const t = [...text.matchAll(/iveo: RELOAD → (\d+) Timer, (\d+) Titler, (\d+) Rundown benachrichtigt\./g)].at(-1);
  return t ? { timer: Number(t[1]), titler: Number(t[2]), rundown: Number(t[3]) } : null;
}

// ── Gedächtnis (Spec 4.7) ─────────────────────────────────────────────────────
function gedaechtnisPfad(showPfad) {
  const schluessel = createHash('sha256').update(resolve(showPfad).toLowerCase()).digest('hex').slice(0, 16);
  return join(DEV('rundown'), 'regie', `${schluessel}.json`);
}
function leseGedaechtnis(showPfad) {
  try {
    return JSON.parse(readFileSync(gedaechtnisPfad(showPfad), 'utf8'));
  } catch {
    return null;
  }
}

// ── Nachgebautes iveo (Endpunkte, die IveoClient nutzt) ───────────────────────
const START = Date.now() - 3_600_000;
const iveo = {
  event: { id: 'ev-e2e', slug: EVENT, name: 'E2E Teil 2a', starts_at: null, ends_at: null, timezone: 'Europe/Berlin' },
  programs: [
    { id: 'p-a', event_id: 'ev-e2e', type_slug: 'side-event', title: 'Side Event A', starts_at_local: '2026-10-01T10:00:00', duration_minutes: 60, updated_at: new Date(START).toISOString() },
    { id: 'p-b', event_id: 'ev-e2e', type_slug: 'side-event', title: 'Side Event B', starts_at_local: '2026-10-01T14:00:00', duration_minutes: 45, updated_at: new Date(START).toISOString() },
  ],
  agenda: {
    'p-a': [
      { id: 'a-1', program_id: 'p-a', sort_order: 1, title: 'Begrüßung', duration_minutes: 10 },
      { id: 'a-2', program_id: 'p-a', sort_order: 2, title: 'Panel', duration_minutes: 20 },
      { id: 'a-3', program_id: 'p-a', sort_order: 3, title: 'Abschluss', duration_minutes: 10 },
    ],
    'p-b': [
      { id: 'b-1', program_id: 'p-b', sort_order: 1, title: 'Keynote', duration_minutes: 30 },
      { id: 'b-2', program_id: 'p-b', sort_order: 2, title: 'Fragen', duration_minutes: 15 },
    ],
  },
  // Einwort-Namen: STATE trennt an Leerzeichen, so liest der Titler-Messpunkt den ganzen Namen.
  speakers: [
    { id: 's-1', event_id: 'ev-e2e', first_name: 'Ada', last_name: '', title: 'Moderation' },
    { id: 's-2', event_id: 'ev-e2e', first_name: 'Grace', last_name: '', title: 'Keynote' },
    { id: 's-3', event_id: 'ev-e2e', first_name: 'Alan', last_name: '', title: 'Panel' },
    { id: 's-4', event_id: 'ev-e2e', first_name: 'Hedy', last_name: '', title: 'Panel' },
  ],
};
let BASE = '';
const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  const sende = (status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  const fehler = (status, code) => sende(status, { errors: [{ code, message: code }], meta: { request_id: 'e2e' } });
  const eins = (data) => sende(200, { data, meta: { request_id: 'e2e' } });
  const liste = (data) => sende(200, { data, meta: { request_id: 'e2e', pagination: { next_cursor: null, limit: 200 } } });
  if (req.headers.authorization !== `Bearer ${TOKEN}`) return fehler(401, 'unauthorized');
  const teile = url.pathname.replace(/^\/api\/v1/, '').split('/').filter(Boolean).map(decodeURIComponent);
  if (teile[0] !== 'events' || teile[1] !== EVENT) return fehler(404, 'not_found');
  if (teile.length === 2) return eins(iveo.event);
  if (teile[2] === 'programs' && teile.length === 3) {
    const seit = url.searchParams.get('updated_since');
    return liste(seit ? iveo.programs.filter((p) => Date.parse(p.updated_at) > Date.parse(seit)) : iveo.programs);
  }
  if (teile[2] === 'programs' && teile.length === 4) {
    const p = iveo.programs.find((x) => x.id === teile[3]);
    return p ? eins(p) : fehler(404, 'not_found');
  }
  if (teile[2] === 'programs' && teile[4] === 'agenda-items') return liste(iveo.agenda[teile[3]] ?? []);
  if (teile[2] === 'speakers') return liste(iveo.speakers);
  if (teile[2] === 'organisations') return liste([]);
  if (teile[2] === 'stages') return eins([]);
  return fehler(404, 'not_found');
});

/** Ablauf eines Side Events, wie der Launcher-Kern ihn im Agenda-Modus baut (ohne verknüpfte Speaker). */
function agendaAblauf(programId) {
  const p = iveo.programs.find((x) => x.id === programId);
  return agendaToAblauf(iveo.agenda[programId], { firstStartMs: localTimeOfDayMs(p), category: p.type_slug });
}
function speakerListe() {
  return iveo.speakers.map((s) => ({ name: [s.first_name, s.last_name].filter(Boolean).join(' '), ...(s.title ? { title: s.title } : {}) }));
}
/** Show-Datei mit Bindung an den nachgebauten Server (tools leer: die Tools startet das Skript selbst). */
function schreibeShowDatei(pfad, { name, programId, mitKennung }) {
  const ablauf = agendaAblauf(programId).map((a) => {
    if (mitKennung) return a;
    const { id: _ohne, ...rest } = a;
    return rest;
  });
  const show = {
    schemaVersion: 1,
    name,
    tools: [],
    ablauf,
    iveo: {
      event: EVENT,
      baseUrl: BASE,
      name: iveo.event.name,
      syncedAt: new Date().toISOString(),
      speakers: speakerListe(),
      sideEvents: iveo.programs.map((p) => ({ id: p.id, title: p.title })),
      filter: { programId },
    },
  };
  writeFileSync(pfad, serializeShow(show, new Date().toISOString()), 'utf8');
}

// ── Prozesse ──────────────────────────────────────────────────────────────────
const kinder = [];
function starte(app, args = [], schalter = []) {
  const p = spawn(ELECTRON, [...schalter, join(REPO, 'apps', app), ...args], { env, stdio: 'ignore' });
  kinder.push(p);
  return p;
}
const warteAufPort = (port, maxMs) => bis(async () => !(await portFrei(port)), maxMs, 300);

// Rundown über DevTools: getState/setDoc/nav der Preload-Brücke.
let rundown = null;
let rdWs = null;
let rdNaechste = 1;
const rdWarten = new Map();
async function verbindeRundown() {
  const ziel = await bis(async () => {
    try {
      const l = await (await fetch(`http://127.0.0.1:${CDP_RUNDOWN}/json/list`)).json();
      return l.find((t) => t.type === 'page' && t.url.includes('index.html')) ?? null;
    } catch {
      return null;
    }
  }, 30_000, 300);
  if (!ziel) throw new Error('Rundown-Fenster per DevTools nicht erreichbar');
  rdWs = new WebSocket(ziel.webSocketDebuggerUrl);
  await new Promise((r, f) => { rdWs.addEventListener('open', r, { once: true }); rdWs.addEventListener('error', f, { once: true }); });
  rdWs.addEventListener('message', (m) => {
    const d = JSON.parse(m.data);
    const w = rdWarten.get(d.id);
    if (w) { rdWarten.delete(d.id); w(d); }
  });
  if (!(await bis(async () => (await rd('typeof window.jmrundown?.getState === "function"')) === true, 15_000))) {
    throw new Error('window.jmrundown fehlt im Rundown-Fenster');
  }
}
function rd(ausdruck, ms = 15_000) {
  return new Promise((ok, fehler) => {
    const id = rdNaechste++;
    const t = setTimeout(() => { rdWarten.delete(id); fehler(new Error(`DevTools-Frist: ${ausdruck.slice(0, 60)}`)); }, ms);
    rdWarten.set(id, (d) => {
      clearTimeout(t);
      if (d.result?.exceptionDetails) fehler(new Error(d.result.exceptionDetails.exception?.description ?? 'Fehler im Rundown-Fenster'));
      else ok(d.result?.result?.value);
    });
    rdWs.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression: ausdruck, returnByValue: true, awaitPromise: true } }));
  });
}
/**
 * Hinweise (4.6) sammeln: kurze verschwinden nach 6 s, deshalb bei jedem Blick merken.
 * Schlüssel = Rundown-Lauf + Hinweis-id (die id beginnt nach einem Neustart neu).
 */
let rdLauf = 0;
const gesehen = new Map();
const hinweisTexte = () => [...gesehen.values()];
async function mitHinweisen(p) {
  const st = await p;
  for (const h of st?.hinweise ?? []) gesehen.set(`${rdLauf}:${h.id}`, h.text);
  return st;
}
const rdStand = () => mitHinweisen(rd('window.jmrundown.getState()'));
const rdSetzeDoc = (doc, rev) => mitHinweisen(rd(`window.jmrundown.setDoc(${JSON.stringify(doc)}, ${rev})`));
const rdNav = (cmd) => mitHinweisen(rd(`window.jmrundown.nav(${JSON.stringify(cmd)})`));
async function starteRundown(args) {
  rdLauf += 1;
  rundown = starte('rundown', args, [`--remote-debugging-port=${CDP_RUNDOWN}`]);
  await verbindeRundown();
}
async function beendeRundown() {
  const p = rundown;
  rundown = null;
  try { rdWs?.close(); } catch { /* schon zu */ }
  rdWs = null;
  if (!p || p.exitCode !== null) return;
  const weg = new Promise((r) => p.once('exit', r));
  try {
    const v = await (await fetch(`http://127.0.0.1:${CDP_RUNDOWN}/json/version`)).json();
    const wb = new WebSocket(v.webSocketDebuggerUrl);
    await new Promise((r, f) => { wb.addEventListener('open', r, { once: true }); wb.addEventListener('error', f, { once: true }); });
    wb.send(JSON.stringify({ id: 1, method: 'Browser.close' })); // Fenster zu → window-all-closed → quit
  } catch { /* Endpunkt weg: die Frist entscheidet */ }
  if ((await Promise.race([weg.then(() => 'weg'), sleep(15_000).then(() => 'frist')])) === 'frist') {
    p.kill();
    await weg;
  }
  await bis(() => portFrei(PORTS.rundown), 10_000, 200);
}

async function wartRundown(bedingung, maxMs, name) {
  let letzter = null;
  const ok = await bis(async () => {
    letzter = await rdStand();
    return bedingung(letzter);
  }, maxMs, 200);
  if (!ok) console.log(`  (Frist abgelaufen: ${name}) Zeilen: ${zeilenKurz(letzter)}`);
  return letzter;
}

// Steuer-Clients (open- oder secure-Modus wie die Tools: control.json in %APPDATA%).
const sicherheit = controlClientOptions(readControlConfig(APPDATA));
const steuer = [];
function steuerClient(port) {
  let zustand = null;
  const c = new SuiteControlClient({ ...sicherheit, reconnectMs: 500, onState: (st) => { zustand = st; } });
  c.connect('127.0.0.1', port);
  steuer.push(c);
  return { sende: (z) => c.send(z), kv: () => zustand?.kv ?? {}, bereit: () => zustand !== null };
}
let timerStand = null;
let timerSocket = null;
const timerKurz = () => {
  const t = timerStand?.timetable;
  return t ? `aktiv ${t.activeIndex} (${t.items[t.activeIndex ?? -1]?.id ?? '-'}) in ${t.items.map((i) => i.id).join(',')}` : 'kein Timer-Zustand';
};

// ── Beiseitelegen / Aufräumen ─────────────────────────────────────────────────
const gesichert = [];
let beiseiteGelegt = false;
let TMP = '';
function legeBeiseite() {
  for (const p of SICHERN) {
    if (existsSync(p + VORHER)) {
      console.log(`ABBRUCH vor dem Start: ${p + VORHER} liegt noch da (voriger Lauf?) — erst von Hand zurückbenennen.`);
      process.exit(3);
    }
  }
  for (const p of SICHERN) {
    if (existsSync(p)) {
      renameSync(p, p + VORHER);
      gesichert.push(p);
    }
  }
  beiseiteGelegt = true;
}
let aufgeraeumt = false;
async function raeumeAuf() {
  if (aufgeraeumt) return;
  aufgeraeumt = true;
  try { timerSocket?.close(); } catch { /* schon zu */ }
  for (const c of steuer) c.disconnect();
  await beendeRundown().catch(() => {});
  for (const p of kinder) {
    try { if (p.exitCode === null) p.kill(); } catch { /* schon beendet */ }
  }
  await sleep(2_000); // Windows gibt Dateien erst nach dem Prozessende frei
  server.closeAllConnections();
  server.close();
  if (beiseiteGelegt) {
    for (const p of SICHERN) {
      rmSync(p, { recursive: true, force: true }); // was der Lauf angelegt hat
      if (gesichert.includes(p)) renameSync(p + VORHER, p);
    }
    rmSync(join(DEV('launcher'), 'iveo-cache', `${EVENT}.json`), { force: true });
  }
  if (TMP) rmSync(TMP, { recursive: true, force: true });
  console.log('aufgeräumt: Prozesse beendet, Dev-Daten wiederhergestellt.');
  console.log('Hinweis: jmps:// zeigt bis zum nächsten Start des installierten Launchers auf den Dev-Launcher.');
}
process.on('SIGINT', () => { void raeumeAuf().then(() => process.exit(130)); });

// ── Ablauf ────────────────────────────────────────────────────────────────────
async function main() {
  for (const app of ['launcher', 'timer', 'titler', 'rundown']) {
    if (!existsSync(join(REPO, 'apps', app, 'out', 'main', 'index.cjs'))) {
      console.log(`ABBRUCH: apps/${app} ist nicht gebaut — erst npm run build -w @jm/${app}.`);
      process.exit(2);
    }
  }
  if (!existsSync(ELECTRON)) {
    console.log(`ABBRUCH: ${ELECTRON} fehlt — ELECTRON_EXE auf eine electron.exe (Version 33) setzen.`);
    process.exit(2);
  }
  for (const [name, port] of Object.entries(PORTS)) {
    if (!(await portFrei(port))) {
      console.log(`ABBRUCH: Port ${port} (${name}) belegt — läuft noch ein Launcher, Timer, Titler oder Rundown?`);
      process.exit(2);
    }
  }
  legeBeiseite();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  BASE = `http://127.0.0.1:${server.address().port}/api/v1`;
  TMP = mkdtempSync(join(tmpdir(), 'jm-e2e-2a-'));
  const SHOW1 = join(TMP, 'E2E Teil 2a.jmshow');
  const SHOW2 = join(TMP, 'E2E Bestand.jmshow');
  schreibeShowDatei(SHOW1, { name: 'E2E Teil 2a', programId: 'p-a', mitKennung: true });

  // Tools zuerst (mit Show 1), dann der Launcher.
  starte('timer', ['--show', SHOW1]);
  starte('titler', ['--show', SHOW1]);
  await starteRundown(['--show', SHOW1]);
  for (const port of [PORTS.timer, PORTS.titler, PORTS.rundown, PORTS.timerSocket]) {
    if (!(await warteAufPort(port, 60_000))) throw new Error(`Port ${port} kommt nicht hoch`);
  }
  const rundownSt = steuerClient(PORTS.rundown);
  const timerSt = steuerClient(PORTS.timer);
  const titlerSt = steuerClient(PORTS.titler);
  timerSocket = io(`http://127.0.0.1:${PORTS.timerSocket}`, { transports: ['websocket'], reconnectionDelay: 500 });
  timerSocket.on('state', (s) => { timerStand = s; });
  starte('launcher');
  if (!(await warteAufPort(PORTS.launcher, 60_000))) throw new Error('Launcher-Steuerport 8736 kommt nicht hoch');
  const launcherSt = steuerClient(PORTS.launcher);
  await bis(() => rundownSt.bereit() && timerSt.bereit() && titlerSt.bereit() && launcherSt.bereit(), 15_000);
  const mOeffnen = logMarke('launcher');
  starte('launcher', [`jmps://open?show=${encodeURIComponent(SHOW1)}`]); // zweite Instanz reicht den Deep-Link weiter
  pruefe('Launcher fragt die Show im 2-s-Takt ab', await bis(() => logAb('launcher', mOeffnen).includes(`Live-Polling für Event „${EVENT}" aktiv (alle 2s)`), 20_000));

  console.log('\n— 1 · Show öffnen');
  let st = await wartRundown((s) => ids(s).join(',') === 'a-1,a-2,a-3', 20_000, 'drei Agenda-Punkte');
  pruefe('1 · Rundown zeigt die drei Agenda-Punkte mit ihren iveo-Kennungen', ids(st).join(',') === 'a-1,a-2,a-3' && st.doc.rows.every((r) => r.quelle === 'ablauf'), zeilenKurz(st));
  pruefe('1 · Rundown hat die Show gemerkt (mit iveo)', st.showGemerkt === true && st.showMitIveo === true);
  const mtime0 = statSync(SHOW1).mtimeMs;
  await sleep(5_000); // mindestens zwei Abfragen
  pruefe('1 · Abfragen mit gleichem Stand schreiben nicht (kein Schein-RELOAD nach dem Öffnen)', statSync(SHOW1).mtimeMs === mtime0 && !logAb('launcher', mOeffnen).includes('RELOAD →'));

  console.log('\n— Fühler: erreicht das RELOAD des Launchers die Tools?');
  let erreicht = null;
  for (let i = 0; i < 10 && !erreicht; i++) {
    const m = logMarke('launcher');
    launcherSt.sende('LAUNCHER SIDEEVENT p-a'); // auf dasselbe Side Event: schreibt, schickt RELOAD, ändert nichts
    const z = await bis(() => reloadZaehler(logAb('launcher', m)), 8_000);
    if (z && z.timer >= 1 && z.rundown >= 1) erreicht = z;
    else await sleep(2_000);
  }
  pruefe('RELOAD erreicht Timer und Rundown (Logzeile 7.1)', !!erreicht, erreicht ? `${erreicht.timer} Timer, ${erreicht.titler} Titler, ${erreicht.rundown} Rundown` : 'der Launcher findet die Tools nicht (mDNS?)');
  if (!erreicht) throw new Error('ohne RELOAD-Weg ist der Rest des Durchgangs sinnlos');

  console.log('\n— 2 · Aktionen an Punkt 2, eigene Zeile hinter Punkt 1');
  st = await rdStand();
  const doc2 = structuredClone(st.doc);
  doc2.rows.find((r) => r.id === 'a-2').actions = [
    { id: 'e2e-recall', role: 'titler', verb: 'recall', args: ['1'], enabled: true },
    { id: 'e2e-goto', role: 'timer', verb: 'goto', args: [2], enabled: true, delayMs: 8_000, zielId: 'a-2' },
  ];
  doc2.rows.splice(1, 0, { id: 'e2e-eigen', label: 'Eigene Zeile (Einspieler)', actions: [] });
  st = await rdSetzeDoc(doc2, st.rev);
  pruefe('2 · Änderung angenommen', ids(st).join(',') === 'a-1,e2e-eigen,a-2,a-3' && zeile(st, 'a-2')?.actions.length === 2, zeilenKurz(st));
  st = await wartRundown((s) => s.links.some((l) => l.role === 'timer' && l.connected), 30_000, 'Rundown verbunden mit dem Timer');
  pruefe('2 · Rundown ist mit dem Timer verbunden', st.links.some((l) => l.role === 'timer' && l.connected),
    `Titler ${st.links.some((l) => l.role === 'titler' && l.connected) ? 'auch verbunden' : 'nicht verbunden (für 2–8 unnötig)'}`);

  console.log('\n— 3 · GO auf Punkt 2, dann Einschub davor und Umbenennung in iveo');
  st = await rdNav({ t: 'goto', n: 3 }); // sichtbare Zeilen: Punkt 1, eigene Zeile, Punkt 2, Punkt 3
  pruefe('3 · Punkt 2 ist scharf', st.scharfId === 'a-2', `scharf ${st.scharfId}`);
  const mLauncher3 = logMarke('launcher');
  st = await rdNav({ t: 'go' });
  const goZeit = Date.now();
  const [a1, a2, a3] = iveo.agenda['p-a'];
  iveo.agenda['p-a'] = [
    { ...a1, sort_order: 1 },
    { id: 'n-1', program_id: 'p-a', sort_order: 2, title: 'Einschub', duration_minutes: 5 },
    { ...a2, sort_order: 3 },
    { ...a3, sort_order: 4, title: 'Abschluss (neu)' },
  ];
  st = await wartRundown((s) => ids(s).join(',') === 'a-1,e2e-eigen,n-1,a-2,a-3', 10_000, 'Abgleich nach dem Einschub');
  const abgleichMs = Date.now() - goZeit;
  pruefe('3 · Abgleich kam, bevor das verzögerte TIMER GOTO fällig war', ids(st).join(',') === 'a-1,e2e-eigen,n-1,a-2,a-3' && abgleichMs < 8_000, `${abgleichMs} ms nach GO`);
  st = await wartRundown((s) => (s.lastFired?.sent ?? []).some((x) => x.role === 'timer'), 12_000, 'verzögertes TIMER GOTO');

  console.log('\n— 4 · Prüfen');
  const gesendet = (st.lastFired?.sent ?? []).find((x) => x.role === 'timer');
  pruefe('4 · TIMER GOTO ging mit der NEUEN Nummer raus', gesendet?.line === 'TIMER GOTO 3' && gesendet.delivered === true, gesendet ? `${gesendet.line} (zugestellt: ${gesendet.delivered})` : 'nicht gesendet');
  pruefe('4 · Timer steht auf Punkt 2 (Kennung a-2)', await bis(() => { const t = timerStand?.timetable; return !!t && t.activeIndex !== null && t.items[t.activeIndex]?.id === 'a-2'; }, 5_000), timerKurz());
  pruefe('4 · Rundown in iveo-Reihenfolge, eigene Zeile hinter Punkt 1', ids(st).join(',') === 'a-1,e2e-eigen,n-1,a-2,a-3', zeilenKurz(st));
  pruefe('4 · Aktionen an Punkt 2 erhalten', zeile(st, 'a-2')?.actions.map((a) => a.id).join(',') === 'e2e-recall,e2e-goto');
  pruefe('4 · Punkt 3 umbenannt, Kennung gleich', zeile(st, 'a-3')?.label === 'Abschluss (neu)');
  pruefe('4 · scharfe Zeile über die Kennung (nach dem GO Punkt 3)', st.scharfId === 'a-3', `scharf ${st.scharfId}`);
  pruefe('4 · STATE cue auf 8731 zeigt dieselbe Zeile', await bis(() => Number(rundownSt.kv().cue) === ids(st).indexOf('a-3') + 1, 3_000), `cue=${rundownSt.kv().cue}`);
  pruefe('4 · Hinweis zum Abgleich (4.6)', hinweisTexte().some((t) => t.startsWith('iveo: 1 geändert · 1 neu')), hinweisTexte().join(' | '));
  const z3 = reloadZaehler(logAb('launcher', mLauncher3));
  pruefe('4 · Launcher-Logzeile nennt den Rundown', !!z3 && z3.rundown >= 1, z3 ? `${z3.rundown} Rundown` : 'keine RELOAD-Zeile');
  const ged = leseGedaechtnis(SHOW1);
  pruefe('4 · Gedächtnis-Datei trägt Zeilen und scharfe Zeile', ged?.schemaVersion === 2 && ged?.scharfId === 'a-3' && (ged?.doc?.rows ?? []).map((r) => r.id).join(',') === ids(st).join(','), ged ? `scharf ${ged.scharfId}` : `fehlt: ${gedaechtnisPfad(SHOW1)}`);

  console.log('\n— 5 · Punkt mit Aktionen in iveo löschen');
  const mTimer5 = logMarke('timer');
  iveo.agenda['p-a'] = iveo.agenda['p-a'].filter((x) => x.id !== 'a-2');
  st = await wartRundown((s) => zeile(s, 'a-2')?.entfallen === true, 10_000, 'Punkt 2 entfallen');
  pruefe('5 · Punkt 2 bleibt markiert stehen, Aktionen erhalten', zeile(st, 'a-2')?.entfallen === true && zeile(st, 'a-2')?.actions.length === 2, zeilenKurz(st));
  pruefe('5 · Hinweis „1 entfallen“', hinweisTexte().some((t) => t.startsWith('iveo:') && t.includes('1 entfallen')), hinweisTexte().join(' | '));
  await rdNav({ t: 'goto', n: 3 }); // Einschub
  st = await rdNav({ t: 'next' });
  pruefe('5 · Weiter überspringt die entfallene Zeile', st.scharfId === 'a-3', `scharf ${st.scharfId}`);
  st = await rdNav({ t: 'prev' });
  pruefe('5 · Zurück überspringt sie ebenso', st.scharfId === 'n-1', `scharf ${st.scharfId}`);
  st = await rdNav({ t: 'goto', n: 4 });
  pruefe('5 · GOTO auf die entfallene Zeile → die nächste', st.scharfId === 'a-3', `scharf ${st.scharfId}`);
  pruefe('5 · Timer: aktiver Punkt weg → Nummer gehalten, Logzeile', await bis(() => logAb('timer', mTimer5).includes('Aktiver Punkt im neuen Ablauf nicht mehr vorhanden, Nummer gehalten'), 5_000));

  console.log('\n— 6 · Side Event wechseln und zurück');
  launcherSt.sende('LAUNCHER SIDEEVENT p-b');
  st = await wartRundown((s) => ids(s).join(',') === 'b-1,b-2', 15_000, 'Side Event B');
  pruefe('6 · Side Event B: neue Agenda ohne Aktionen', ids(st).join(',') === 'b-1,b-2' && st.doc.rows.every((r) => r.actions.length === 0), zeilenKurz(st));
  pruefe('6 · Hinweis „Side Event gewechselt: Side Event B“', hinweisTexte().includes('Side Event gewechselt: Side Event B'), hinweisTexte().join(' | '));
  pruefe('6 · scharf ist die erste Zeile', st.scharfId === 'b-1', `scharf ${st.scharfId}`);
  launcherSt.sende('LAUNCHER SIDEEVENT p-a');
  st = await wartRundown((s) => ids(s).includes('e2e-eigen'), 15_000, 'zurück auf Side Event A');
  pruefe('6 · zurück: Zeilen, eigene Zeile und Aktionen wieder da', ids(st).join(',') === 'a-1,e2e-eigen,n-1,a-2,a-3' && zeile(st, 'a-2')?.entfallen === true && zeile(st, 'a-2')?.actions.length === 2, zeilenKurz(st));
  pruefe('6 · scharf ist wieder die erste Zeile', st.scharfId === 'a-1', `scharf ${st.scharfId}`);

  console.log('\n— 7a · Rundown beenden und ohne Deep-Link starten (wie die Kachel)');
  timerSt.sende('TIMER START');
  await bis(() => typeof timerStand?.countdown?.startedAtMs === 'number', 5_000);
  const countdownVorher = JSON.stringify(timerStand?.countdown);
  const vor7a = await rdStand();
  await beendeRundown();
  const mRd = logMarke('rundown');
  await starteRundown([]);
  st = await wartRundown((s) => ids(s).join(',') === ids(vor7a).join(','), 20_000, 'Stand nach dem Neustart');
  pruefe('7a · Stand nach dem Neustart über die Kachel', JSON.stringify(st.doc.rows) === JSON.stringify(vor7a.doc.rows), zeilenKurz(st));
  pruefe('7a · scharfe Zeile nach dem Neustart', st.scharfId === vor7a.scharfId, `scharf ${st.scharfId}`);
  pruefe('7a · Show bleibt gemerkt', st.showGemerkt === true);
  iveo.agenda['p-a'] = iveo.agenda['p-a'].map((x) => (x.id === 'a-1' ? { ...x, title: 'Begrüßung (neu)' } : x));
  st = await wartRundown((s) => zeile(s, 'a-1')?.label === 'Begrüßung (neu)', 15_000, 'RELOAD nach dem Neustart');
  pruefe('7a · ein folgendes RELOAD gleicht ab', zeile(st, 'a-1')?.label === 'Begrüßung (neu)');
  pruefe('7a · keine Warnung „RELOAD ohne Show“ im Rundown-Log', !logAb('rundown', mRd).includes('RELOAD empfangen, aber keine Show geladen'));
  pruefe('7a · Timer-Countdown unverändert', JSON.stringify(timerStand?.countdown) === countdownVorher, `${countdownVorher} → ${JSON.stringify(timerStand?.countdown)}`);

  console.log('\n— 7b · Rundown beenden und per Show-Deep-Link starten');
  const vor7b = await rdStand();
  await beendeRundown();
  await starteRundown(['--show', SHOW1]);
  st = await wartRundown((s) => ids(s).join(',') === ids(vor7b).join(','), 20_000, 'Stand nach dem Start per Deep-Link');
  await sleep(1_000); // der Deep-Link gleicht nach dem Laden des Gedächtnisses noch ab
  st = await rdStand();
  pruefe('7b · Stand und scharfe Zeile nach dem Start per Deep-Link', JSON.stringify(st.doc.rows) === JSON.stringify(vor7b.doc.rows) && st.scharfId === vor7b.scharfId, `scharf ${st.scharfId}`);

  console.log('\n— 9 · Titler-Messung (6.4): Bauchbinde auf Sendung, dann ein Speaker davor');
  launcherSt.sende('LAUNCHER SIDEEVENT'); // Tagesübersicht: Listen-Modus, alle Event-Speaker
  await bis(() => launcherSt.kv().iveo_side_event === '', 15_000);
  const vier = await bis(() => Number(titlerSt.kv().entry_count) === 4, 15_000);
  titlerSt.sende('TITLER RECALL 3');
  await bis(() => titlerSt.kv().entry === 'Alan', 5_000);
  titlerSt.sende('TITLER TAKE');
  await bis(() => titlerSt.kv().on_air === '1', 10_000);
  const vorher9 = { ...titlerSt.kv() };
  iveo.speakers.unshift({ id: 's-0', event_id: 'ev-e2e', first_name: 'Neu', last_name: '', title: 'Gast' });
  iveo.programs = iveo.programs.map((p) => (p.id === 'p-a' ? { ...p, updated_at: new Date().toISOString() } : p));
  const fuenf = await bis(() => Number(titlerSt.kv().entry_count) === 5, 15_000);
  await sleep(1_000); // der Titler liest seinen Datenordner entprellt neu
  const nachher9 = { ...titlerSt.kv() };
  console.log(
    `MESSUNG 6.4: auf Sendung vorher „${vorher9.entry}“ (Eintrag ${vorher9.entry_index}/${vorher9.entry_count}, on_air=${vorher9.on_air}), ` +
      `nach dem Einfügen „${nachher9.entry}“ (Eintrag ${nachher9.entry_index}/${nachher9.entry_count}, on_air=${nachher9.on_air}) ` +
      `→ Name wechselt auf Sendung: ${vorher9.entry !== nachher9.entry ? 'JA' : 'nein'}`,
  );
  pruefe('9 · Messung durchgeführt (Bauchbinde auf Sendung, Speaker-Liste von 4 auf 5)', !!vier && !!fuenf && vorher9.on_air === '1');

  console.log('\n— 8 · Bestands-Show ohne Kennungen: Aktion anlegen, dann schreibt der Launcher die Kennungen');
  schreibeShowDatei(SHOW2, { name: 'E2E Bestand', programId: 'p-b', mitKennung: false });
  starte('rundown', ['--show', SHOW2]); // zweite Instanz reicht den Deep-Link an den laufenden Rundown
  st = await wartRundown((s) => ids(s).join(',') === 'ersatz:Keynote,ersatz:Fragen', 20_000, 'Bestands-Show im Rundown');
  pruefe('8 · Rundown bildet Ersatz-Kennungen', ids(st).join(',') === 'ersatz:Keynote,ersatz:Fragen', zeilenKurz(st));
  const doc8 = structuredClone(st.doc);
  doc8.rows.find((r) => r.id === 'ersatz:Fragen').actions = [{ id: 'e2e-fragen', role: 'titler', verb: 'recall', args: ['2'], enabled: true }];
  st = await rdSetzeDoc(doc8, st.rev);
  pruefe('8 · Aktion an „Fragen“ angelegt', zeile(st, 'ersatz:Fragen')?.actions.length === 1, zeilenKurz(st));
  const vor8 = new Set(gesehen.keys());
  starte('launcher', [`jmps://open?show=${encodeURIComponent(SHOW2)}`]);
  st = await wartRundown((s) => ids(s).join(',') === 'b-1,b-2', 20_000, 'Kennungen nachgeschrieben');
  pruefe('8 · der Launcher hat die Kennungen in die Show geschrieben', readFileSync(SHOW2, 'utf8').includes('"id": "b-2"'));
  pruefe('8 · Rundown wechselt über die Titel-Brücke (R0) auf die echten Kennungen', ids(st).join(',') === 'b-1,b-2', zeilenKurz(st));
  pruefe('8 · keine Zeile entfallen, Aktion an „Fragen“ erhalten', st.doc.rows.every((r) => !r.entfallen) && zeile(st, 'b-2')?.actions[0]?.id === 'e2e-fragen');
  const neu8 = [...gesehen].filter(([k]) => !vor8.has(k)).map(([, t]) => t);
  pruefe('8 · kein Hinweis „entfallen“', !neu8.some((t) => t.includes('entfallen')), neu8.join(' | ') || 'keine neuen Hinweise');
  pruefe('8 · Gedächtnis der Bestands-Show angelegt', leseGedaechtnis(SHOW2)?.showName === 'E2E Bestand');
}

let code = 1;
try {
  await main();
  const fehl = ergebnisse.filter((e) => !e.ok);
  console.log(`\n${ergebnisse.length - fehl.length}/${ergebnisse.length} Prüfungen ok.`);
  code = fehl.length === 0 ? 0 : 1;
} catch (e) {
  console.log(`ABBRUCH: ${e.message}`);
} finally {
  await raeumeAuf();
}
process.exit(code);
```

- [ ] **Schritt 6: Apps bauen**

Run: `npm run build -w @jm/launcher -w @jm/timer -w @jm/rundown -w @jm/titler`
Expected: alle vier ohne Fehler; danach gibt es `apps/<app>/out/main/index.cjs`.

- [ ] **Schritt 7: Durchgang laufen lassen**

Run (Bash, Repo-Wurzel; installierte Suite-Programme vorher beenden):
```bash
ELECTRON_EXE="C:/Users/alexk/alexzvn/node_modules/electron/dist/electron.exe" node node_modules/tsx/dist/cli.mjs apps/rundown/test/e2e-teil2a.mjs 2>&1 | tee "$TEMP/e2e-teil2a.log"
```
Expected: alle Prüfzeilen beginnen mit `ok  `, eine Zeile `MESSUNG 6.4: …`, am Ende `45/45 Prüfungen ok.`, danach `aufgeräumt: …`, Exit-Code 0.

Bei `FEHL`: Ursache mit `superpowers:systematic-debugging` suchen, den Fehler in der Aufgabe beheben, der der Code gehört (A1–A16; mit Test dort), neu bauen, Durchgang wiederholen. Eine Prüfung im Skript wird nur geändert, wenn sie nachweislich etwas anderes prüft als die Spec verlangt (dann im Bericht begründen). Bricht der Lauf mit `ABBRUCH vor dem Start: … .e2e-vorher liegt noch da` ab, den genannten Pfad von Hand zurückbenennen.

- [ ] **Schritt 8: Bericht**

In den Aufgabenbericht (Abschnitt „Durchgang 9.8“): die vollständige Ausgabe aus `$TEMP/e2e-teil2a.log`, die Zeile `MESSUNG 6.4` wortgleich und ein Satz, ob die Bauchbinde auf Sendung den Namen wechselt (Ergebnis für PR-Text und 2b-Spec, Spec 6.4). Keine Datei im Repo dafür anlegen.

- [ ] **Schritt 9: Commit (Durchgang)**

```bash
git add apps/rundown/test/e2e-teil2a.mjs
git status --short
git commit -m "test(rundown): Durchgang Teil 2a mit gebauten Programmen und nachgebautem iveo (Spec 9.8, Titler-Messung 6.4)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Abweichungen vom Gerüst:**
1. Der Jobname `Selbsttests (Master-Link + Launcher)` bleibt (Pflicht-Check für `main`); die neuen Schritte sind namentlich benannt.
2. Der Durchgang hat keine eigene Rot-Phase: er prüft fertigen Code aus A1–A16. Die Gegenproben (absichtlich eingebaute Fehler) laufen für die reinen Funktionen in A5/A7 nach 9.2.
3. Reihenfolge im Skript: Schritte 1–7b, dann 9 (Titler hängt an Show 1), zuletzt 8 (wechselt den Rundown auf die Bestands-Show).
4. Das Skript läuft über tsx (`node node_modules/tsx/dist/cli.mjs …`), weil es Suite-Pakete als TypeScript-Quelle importiert.
5. Zusätzlich zu den Rundown-, Timer- und Titler-Daten legt das Skript `master-link.json` beiseite, damit der Dev-Launcher nicht als Master oder Slave des Owners läuft (wie der Prüfstand aus Teil 1).
6. Einwort-Speaker-Namen im nachgebauten iveo: STATE trennt an Leerzeichen; so liest der Titler-Messpunkt (`entry`) den ganzen Namen.
7. Der „Fühler“ vor Schritt 2 (Umschalten auf dasselbe Side Event, bis die RELOAD-Logzeile Timer und Rundown nennt) ist nicht Teil von 9.8: er stellt sicher, dass der Launcher die Tools per mDNS gefunden hat, bevor gemessen wird.
8. Messpunkt „Launcher fragt im 2-s-Takt“ und „kein Schein-RELOAD nach dem Öffnen“ (Schritt 1) sind zusätzlich: sie prüfen `JMPS_IVEO_POLL_MS` (A15) und die Signatur beim Öffnen (7.2, Ursache aus dem Log von #235).

---

### Aufgabe A18: Abnahme-Checkliste, Doku „Rundown folgt dem Ablauf“, Release-Vorbereitung (ohne Push)

**Spec:** 10 (Abnahme, wortgetreu), 11 (Release: Versionen, Changelog, Release-Notes, Tags einzeln, alles Weitere erst nach Freigabe), 12 (Grenzen, für die Doku), 4.5/4.6 (Texte „kommt aus iveo“ usw. für die Doku).

**Dateien:**
- Create: `apps/rundown/ABNAHME-2a.md`
- Modify: `docs/jm-show.md:39` (Feldtabelle), `:79` (Tabelle „Was die einzelnen Tools beim Öffnen tun“), Dateiende (neuer Abschnitt 8)
- Modify: `docs/README.md:5-7` (Eintrag JM Show)
- Modify: `apps/launcher/package.json:3`, `apps/timer/package.json:3`, `apps/rundown/package.json:3` (Versionen)
- Modify: `package-lock.json:291-293`, `:702-704`, `:544-546` (dieselben drei Versionen)
- Modify: `packages/suite-manifest/changelog.json` (je ein neuer erster Eintrag unter `launcher`, `timer`, `rundown`)

**Schnittstellen:**
- Consumes: den fertigen Stand von A1–A17 (Texte der Oberfläche aus Spec 4.6/7.6, wie A10/A11/A15 sie umsetzen; Ergebnis des Durchgangs A17).
- Produces: Launcher **0.13.0**, Timer **0.13.0**, Rundown **0.6.0** in `package.json` und `package-lock.json`; Changelog-Einträge; `apps/rundown/ABNAHME-2a.md`. Kein Tag, kein Push, kein PR.

**Was zu wissen ist (für den Umsetzer):**
- `paths-ignore: ["**/*.md"]` in `ci-checks.yml`: reine Doku-Commits lösen keine CI aus. Das ist gewollt.
- Changelog: keine ASCII-Anführungszeichen (`"`) in den Texten (Memory „changelog.json quote trap“); die Texte unten enthalten auch keine typografischen. Vor dem Commit JSON prüfen (Schritt 6).
- `suite.json` (`latestVersion`) NICHT anfassen: das zieht nach dem Release der GitHub-Bot nach (`chore(manifest): … latestVersion → …`).
- Zeilenenden: `core.autocrlf=true`; einige Dateien liegen im Worktree mit CRLF. Die Vorher-Ausschnitte sind mit LF geschrieben und gegen den echten Code geprüft (nach LF-Angleichung je genau ein Treffer). Trifft eine Ersetzung nicht, zuerst die Zeilenenden prüfen.

- [ ] **Schritt 0: Vorbedingung — A17 grün**

Run: `npm run selftest -w @jm/rundown && npm run selftest -w @jm/iveo && npm run selftest -w @jm/timer && npm run selftest:iveo -w @jm/launcher && npm run selftest:verbund -w @jm/launcher && npm run selftest -w @jm/launcher`
Expected: alles grün. Der Durchgang A17 endete mit `45/45 Prüfungen ok.` (steht im Bericht von A17). Sonst hier nicht weitermachen.

- [ ] **Schritt 1: `apps/rundown/ABNAHME-2a.md` anlegen (ganzer Inhalt, wortgetreu nach Spec 10)**

```markdown
# Abnahme Master-Link Teil 2a (Owner, ein Rechner, echtes iveo-Event auf Prod)

Spec: `docs/superpowers/specs/2026-10-01-master-link-teil2a-design.md`, Abschnitt 10.

**Voraussetzungen:**
- Ein eigenes, **unveröffentlichtes Test-Side-Event** im Prod-Event mit mindestens drei Agenda-Punkten. Die Schritte 5, 6 und 8 ändern dessen Agenda. Am Ende wird der Ausgangszustand wiederhergestellt.
- Das echte iveo-Token wird **nie** in iveo widerrufen. Es gilt org-weit, ein Widerruf legt alle Events und Rechner der Org lahm.

| # | Schritt | Erwartung | Ergebnis / Datum |
| --- | --- | --- | --- |
| 1 | Launcher 0.13.0, Timer 0.13.0 und Rundown 0.6.0 installieren | Versionen im Launcher sichtbar | |
| 2 | Bestands-Show (von vor dem Update, mit Aktionen im Rundown) öffnen und die erste Abfrage abwarten | alle Aktionen da, kein Hinweis „entfallen“ (Übergang 0.6/0.7) | |
| 3 | Show an das Test-Side-Event binden und öffnen | Rundown zeigt die Punkte, gesperrte Felder mit „kommt aus iveo“ | |
| 4 | An Punkt 2 eine Bauchbinde und „Timer springe zu Punkt 2“ anlegen; eine eigene Zeile hinter Punkt 1; eine Zeile duplizieren | gespeichert; die Kopie ist frei bearbeitbar | |
| 5 | In iveo vor Punkt 2 einen Punkt einfügen und Punkt 3 umbenennen; bis zu 45 s warten | Hinweis „iveo: 1 geändert · 1 neu …“; Aktionen weiter an „Punkt 2“; eigene Zeile und Kopie an ihrem Platz; scharfe Zeile unverändert | |
| 6 | Timer auf Punkt 2 laufen lassen, Schritt 5 sinngemäß wiederholen (noch ein Punkt davor) | Timer bleibt auf demselben Punkt, Countdown läuft weiter | |
| 7 | GO mit der Sprung-Aktion | Timer springt auf den richtigen Punkt, nicht auf die alte Nummer; Chip zeigt die neue Nummer | |
| 8 | In iveo den Punkt mit Aktionen löschen | Zeile „in iveo entfallen“, Weiterschalten überspringt sie | |
| 9 | Aus dem Rundown per GO auf ein anderes Side Event umschalten, dann zurück; im Panel die Tagesübersicht eines anderen Tages wählen und zurück | neue Agenda ohne Aktionen; nach dem Zurückschalten alle Aktionen wieder da; kein „entfallen“ durch den Tageswechsel | |
| 10a | Rundown schließen und **über die Launcher-Kachel** neu starten | Stand und scharfe Zeile wie vorher; die nächste iveo-Änderung kommt an; Timer-Countdown unverändert | |
| 10b | Rundown schließen und über „Show öffnen“ neu starten | Stand und scharfe Zeile wie vorher. Hinweis: Der Timer wird dabei wie heute zurückgesetzt. | |
| 11 | Show im Show-Editor öffnen und ohne Änderung speichern | Timer-Liste, Einstellungen, Dauern sekundengenau und Kennungen unverändert (Datei vorher/nachher vergleichen); die Tools bekommen RELOAD, nichts springt | |
| 12 | Launcher beenden und mit `JMPS_IVEO_TOKEN=ungueltig` starten, Show öffnen, eine Abfrage abwarten; danach ohne die Variable neu starten | Zeile „iveo-Abgleich gestört: Token ungültig oder widerrufen“, Rundown behält seinen Stand; nach dem Neustart verschwindet die Zeile mit der ersten Abfrage | |
| 13 | Agenda des Test-Side-Events auf den Ausgangszustand zurücksetzen | – | |
```

Prüfen: `grep -c "^| " apps/rundown/ABNAHME-2a.md` → `16` (Kopf, Trennzeile, 14 Schritte: 1–9, 10a, 10b, 11–13).

- [ ] **Schritt 2: Doku — `docs/jm-show.md`**

Ersetzung 1 (Feldtabelle in Abschnitt 2, Zeile 39).
Vorher:
```markdown
| `tools[].settings` | Tool-eigene Einstellungen (z. B. Timer-Ablaufplan, Presenter-PIN) |
```
Nachher:
```markdown
| `tools[].settings` | Tool-eigene Einstellungen (z. B. Timer-Ablaufplan, Presenter-PIN) |
| `ablauf[]` | Zentraler Ablauf: Programmpunkte mit Titel, Dauer, Notiz und fester Kennung (`id`) — lesen Rundown und Timer (Abschnitt 8) |
```

Ersetzung 2 (Tabelle in Abschnitt 4, Zeile 79).
Vorher:
```markdown
| **Stage Display** | **verbindet sich** mit allen Quellen, die in derselben Show stehen (Timer/Switcher/Presenter) — Host/Port aus deren `network`-Angabe, sonst Standard/localhost. Die Presenter-PIN kommt aus `settings.pin`. |
```
Nachher:
```markdown
| **Stage Display** | **verbindet sich** mit allen Quellen, die in derselben Show stehen (Timer/Switcher/Presenter) — Host/Port aus deren `network`-Angabe, sonst Standard/localhost. Die Presenter-PIN kommt aus `settings.pin`. |
| **Rundown** | den **zentralen Ablauf** (`ablauf`) als Zeilen, bzw. sein referenziertes `.jmrundown` (relativ zur Show). Ändert sich der Ablauf, gleicht er ab, statt neu aufzubauen (Abschnitt 8). |
```

Ersetzung 3 (Dateiende, neuer Abschnitt 8).
Vorher:
```markdown
- **Ältere Show-Dateien:** Das Format wird beim Öffnen automatisch auf das
  aktuelle Schema migriert — ältere `.jmshow` öffnen also weiterhin.
```
Nachher:
```markdown
- **Ältere Show-Dateien:** Das Format wird beim Öffnen automatisch auf das
  aktuelle Schema migriert — ältere `.jmshow` öffnen also weiterhin.

---

## 8. Rundown folgt dem Ablauf (iveo)

Seit Rundown 0.6.0, Timer 0.13.0 und Launcher 0.13.0 trägt jeder Punkt des
zentralen Ablaufs eine **feste Kennung** (`ablauf[].id`): die iveo-ID, bei Punkten
aus dem Show-Editor eine beim Anlegen erzeugte. Darüber halten Timer und Rundown
ihren Punkt, auch wenn sich die Reihenfolge ändert.

**Was beim Abgleich passiert.** Ändert sich der Ablauf — eine iveo-Änderung, die
der Launcher abfragt, oder Speichern im Show-Editor —, bekommen Timer, Titler und
Rundown ein Neu-Laden. Der Rundown gleicht dann ab, statt neu aufzubauen:

- Die Zeilen aus dem Ablauf stehen in dessen Reihenfolge. Titel, Notiz und Dauer
  kommen aus der Show, die Aktionen bleiben an ihrer Zeile.
- Neue Punkte erscheinen an ihrer Stelle, ohne Aktionen.
- Eigene Zeilen wandern mit dem Ablaufpunkt über ihnen.
- Ein weggefallener Punkt ohne Aktionen verschwindet. Hat er Aktionen, bleibt er
  als „in iveo entfallen“ bzw. „in der Show entfallen“ stehen, feuert nie und wird
  beim Weiterschalten übersprungen. „Als eigene Zeile behalten“ macht ihn zu einer
  normalen eigenen Zeile.
- Die scharfe Zeile bleibt scharf, auch an neuer Stelle. Entfällt sie, wird die
  nächste Zeile scharf, und ein Hinweis bleibt stehen.
- Ein kurzer Hinweis fasst den Abgleich zusammen, z. B.
  „iveo: 2 geändert · 1 neu · neu sortiert“.

**Was im Rundown gesperrt ist.** Titel, Notiz und Dauer einer Ablaufzeile ändert
man in iveo bzw. im Show-Editor; der Rundown zeigt dazu „kommt aus iveo“ bzw.
„kommt aus der Show, im Show-Editor ändern“. Aktionen sind frei. Duplizieren
ergibt immer eine eigene Zeile.

**Side Events.** Schaltet der Launcher auf ein anderes Side Event oder eine
andere Tagesübersicht, merkt sich der Rundown Zeilen und Aktionen je Side Event
bzw. Tagesübersicht. Beim Zurückschalten ist alles wieder da.

**Timer-Sprünge.** Eine Aktion „Timer springe zu“ zielt auf den Ablaufpunkt,
nicht auf eine Nummer. Umgerechnet wird beim Senden, also auch nach einem
Umsortieren richtig. Ist das Ziel entfallen, wird nichts gesendet. Ältere
Sprünge mit fester Nummer bleiben, bis man sie mit „an diesen Punkt binden“
bindet.

**Neustart.** Der Rundown merkt sich die zuletzt geöffnete Show samt Stand und
scharfer Zeile. Ein Start über die Launcher-Kachel kehrt zu ihr zurück, ohne den
Timer zurückzusetzen. „Show öffnen“ setzt den Timer dagegen wie bisher zurück.

**Eigene `.jmrundown` in der Show.** Auch sie wird mit dem Ablauf abgeglichen.
In die Datei geschrieben wird nur bei „Speichern“.

**Show-Editor.** Speichern ändert nur, was im Formular steht: Tool-Einstellungen,
Port und der Zeitpunkt des letzten iveo-Abgleichs bleiben, Dauern sekundengenau.
Speichert man die gerade offene Show, laden Timer, Titler und Rundown sofort neu.

**Wenn der Abgleich hakt.** Scheitert eine iveo-Abfrage, bleibt der Ablauf, wie
er ist. Das Side-Events-Panel im Launcher zeigt dann „iveo-Abgleich gestört:
<Grund> (seit <Uhrzeit>)“, etwa „Token ungültig oder widerrufen“ oder „kein
iveo-Token auf diesem Rechner, nur Offline-Ablauf“.

**Grenzen.** Das gilt am Einzelplatz: Tools auf einem anderen Rechner lesen
weiter ihre eigene Show-Datei (folgt mit Master-Link Teil 2b). Sprünge aus
Companion (`RUNDOWN GOTO n`, `TIMER GOTO n`) und `TITLER RECALL <nr>` bleiben
nummernbasiert. Wird eine Show-Datei umbenannt oder verschoben, beginnt der
Rundown für sie neu. Ein älterer Rundown (bis 0.5), der eine neue `.jmrundown`
speichert, verliert deren Archiv und Markierungen.
```

- [ ] **Schritt 3: Doku-Index — `docs/README.md`**

Vorher (Zeilen 5-7):
```markdown
- **[JM Show](jm-show.md)** — eine ganze Produktion auf einen Klick öffnen.
  *Für alle, die Shows anlegen und nutzen.* Format, Show-Editor, was jedes Tool
  beim Öffnen lädt, Beispiel-`.jmshow`, Stolpersteine.
```
Nachher:
```markdown
- **[JM Show](jm-show.md)** — eine ganze Produktion auf einen Klick öffnen.
  *Für alle, die Shows anlegen und nutzen.* Format, Show-Editor, was jedes Tool
  beim Öffnen lädt, Beispiel-`.jmshow`, Stolpersteine, wie der Rundown dem
  Ablauf aus iveo folgt.
```

- [ ] **Schritt 4: Commit (Doku)**

```bash
git add apps/rundown/ABNAHME-2a.md docs/jm-show.md docs/README.md
git status --short
git commit -m "docs(rundown): Abnahme-Checkliste Teil 2a und Abschnitt Rundown folgt dem Ablauf" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Schritt 5: Versionen**

`apps/launcher/package.json`, Zeile 3.
Vorher:
```json
  "name": "@jm/launcher",
  "version": "0.12.0",
```
Nachher:
```json
  "name": "@jm/launcher",
  "version": "0.13.0",
```

`apps/timer/package.json`, Zeile 3.
Vorher:
```json
  "name": "@jm/timer",
  "version": "0.12.0",
```
Nachher:
```json
  "name": "@jm/timer",
  "version": "0.13.0",
```

`apps/rundown/package.json`, Zeile 3.
Vorher:
```json
  "name": "@jm/rundown",
  "version": "0.5.0",
```
Nachher:
```json
  "name": "@jm/rundown",
  "version": "0.6.0",
```

`package-lock.json`, Zeilen 291-293.
Vorher:
```json
    "apps/launcher": {
      "name": "@jm/launcher",
      "version": "0.12.0",
```
Nachher:
```json
    "apps/launcher": {
      "name": "@jm/launcher",
      "version": "0.13.0",
```

`package-lock.json`, Zeilen 702-704.
Vorher:
```json
    "apps/timer": {
      "name": "@jm/timer",
      "version": "0.12.0",
```
Nachher:
```json
    "apps/timer": {
      "name": "@jm/timer",
      "version": "0.13.0",
```

`package-lock.json`, Zeilen 544-546.
Vorher:
```json
    "apps/rundown": {
      "name": "@jm/rundown",
      "version": "0.5.0",
```
Nachher:
```json
    "apps/rundown": {
      "name": "@jm/rundown",
      "version": "0.6.0",
```

- [ ] **Schritt 6: Changelog — `packages/suite-manifest/changelog.json`**

Datum: der Tag des Release-Commits im Format `JJJJ-MM-TT` (`node -e "console.log(new Date().toISOString().slice(0,10))"`). Unten steht `2026-10-01`; ist heute ein anderer Tag, in allen drei Einträgen diesen Tag eintragen.

Ersetzung 1 (`launcher`).
Vorher:
```json
    "app": "launcher",
    "name": "JM Production Suite",
    "entries": [
      {
        "version": "0.12.0",
```
Nachher:
```json
    "app": "launcher",
    "name": "JM Production Suite",
    "entries": [
      {
        "version": "0.13.0",
        "date": "2026-10-01",
        "notes": [
          "Behebt #235: Ändert sich der Ablauf in iveo, bekommt jetzt auch der Rundown das Neu-Laden, nicht nur Timer und Titler.",
          "Jeder Ablaufpunkt trägt seine feste iveo-Kennung in der Show. Timer und Rundown halten ihren Punkt darüber, auch wenn sich die Reihenfolge ändert.",
          "Weniger unnötiges Neu-Laden: Nach dem Öffnen einer Show und in der Programmliste schreibt der Launcher die Show nur noch, wenn sich in iveo wirklich etwas geändert hat.",
          "Scheitert eine iveo-Abfrage, bleibt der Ablauf, wie er ist, statt kurz auf einen einzigen Punkt zu schrumpfen. Das Side-Events-Panel zeigt dann iveo-Abgleich gestört mit Grund und Uhrzeit, etwa bei ungültigem Token oder wenn auf diesem Rechner kein Token liegt.",
          "Die Show wird sicher geschrieben, erst in eine Zwischendatei und dann umbenannt. Liest ein Tool sie gerade, versucht es der Launcher kurz darauf erneut. Jeder iveo-Abruf hat eine Zeitgrenze von 15 Sekunden.",
          "Show-Editor: Speichern verliert nichts mehr. Eigene Timer-Liste, Presenter-PIN und andere Tool-Einstellungen, der Port und der Zeitpunkt des letzten iveo-Abgleichs bleiben erhalten, Dauern sekundengenau. Speichern der gerade offenen Show lädt Timer, Titler und Rundown sofort neu."
        ]
      },
      {
        "version": "0.12.0",
```

Ersetzung 2 (`timer`).
Vorher:
```json
    "app": "timer",
    "name": "JM Timer",
    "entries": [
      {
        "version": "0.12.0",
```
Nachher:
```json
    "app": "timer",
    "name": "JM Timer",
    "entries": [
      {
        "version": "0.13.0",
        "date": "2026-10-01",
        "notes": [
          "Lädt der Timer nach einer iveo-Änderung neu, hält er seinen aktiven Punkt über dessen feste Kennung, auch wenn davor Punkte eingefügt oder umsortiert wurden. Der Countdown läuft unverändert weiter.",
          "Fehlt der aktive Punkt im neuen Ablauf, bleibt die Nummer wie bisher, dazu steht ein Hinweis im Protokoll."
        ]
      },
      {
        "version": "0.12.0",
```

Ersetzung 3 (`rundown`).
Vorher:
```json
    "app": "rundown",
    "name": "JM Rundown",
    "entries": [
      {
        "version": "0.5.0",
```
Nachher:
```json
    "app": "rundown",
    "name": "JM Rundown",
    "entries": [
      {
        "version": "0.6.0",
        "date": "2026-10-01",
        "notes": [
          "Behebt #235: Der Rundown folgt jeder Änderung des Show-Ablaufs aus iveo oder dem Show-Editor, ohne Position oder Aktionen zu verlieren. Neue Punkte erscheinen an ihrer Stelle, eigene Zeilen wandern mit ihrem Punkt.",
          "Ein Punkt mit Aktionen, der in iveo gelöscht wurde, bleibt als entfallen markiert stehen. Er feuert nie, das Weiterschalten überspringt ihn, und Als eigene Zeile behalten macht ihn zur normalen Zeile.",
          "Side Events und Tagesübersichten: Zeilen und Aktionen bleiben je Side Event erhalten und sind nach dem Zurückschalten wieder da.",
          "Timer-Sprünge zielen auf den Ablaufpunkt statt auf eine feste Nummer und treffen auch nach dem Umsortieren den richtigen Punkt.",
          "Der Rundown merkt sich die zuletzt geöffnete Show samt scharfer Zeile über einen Neustart, auch beim Start über die Launcher-Kachel.",
          "Titel, Notiz und Dauer von Ablaufzeilen pflegt man in iveo bzw. im Show-Editor, der Rundown zeigt sie gesperrt mit dem Hinweis, woher sie kommen. Eine eigene Rundown-Datei in der Show wird ebenfalls abgeglichen.",
          "Der alte Autosave wird beim ersten Öffnen einer passenden Show übernommen und vorher als rundown.autosave.v1.jmrundown gesichert.",
          "Bringt zum ersten Mal den Verbund-Client aus Master-Link Teil 1 mit. Er wird erst aktiv, wenn dieser Rechner im Verbund gekoppelt ist."
        ]
      },
      {
        "version": "0.5.0",
```

- [ ] **Schritt 7: Prüfen (JSON, Versionen, keine ASCII-Anführungszeichen)**

Run:
```bash
node -e "JSON.parse(require('fs').readFileSync('packages/suite-manifest/changelog.json','utf8'))"
node -e "const c=require('./packages/suite-manifest/changelog.json');const soll={launcher:'0.13.0',timer:'0.13.0',rundown:'0.6.0'};for(const [app,v] of Object.entries(soll)){const e=c.find(x=>x.app===app).entries[0];if(e.version!==v)throw new Error(app+' '+e.version);if(e.notes.some(n=>n.includes('\"')))throw new Error(app+': ASCII-Anführungszeichen');}const p=(f)=>require('./'+f).version;const l=require('./package-lock.json').packages;if(p('apps/launcher/package.json')!=='0.13.0'||p('apps/timer/package.json')!=='0.13.0'||p('apps/rundown/package.json')!=='0.6.0')throw new Error('package.json');if(l['apps/launcher'].version!=='0.13.0'||l['apps/timer'].version!=='0.13.0'||l['apps/rundown'].version!=='0.6.0')throw new Error('package-lock.json');console.log('Release-Vorbereitung ok')"
npm run typecheck -w @jm/launcher -w @jm/timer -w @jm/rundown
```
Expected: erster Befehl ohne Ausgabe (JSON gültig), zweiter `Release-Vorbereitung ok`, Typecheck ohne Fehler.

- [ ] **Schritt 8: Commit (Release-Vorbereitung)**

```bash
git add apps/launcher/package.json apps/timer/package.json apps/rundown/package.json package-lock.json packages/suite-manifest/changelog.json
git status --short
git commit -m "release(suite): launcher 0.13.0, timer 0.13.0, rundown 0.6.0 — Master-Link Teil 2a" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Schritt 9: Stand melden — NICHT pushen**

Run: `git log --oneline -25` und `git status --short`.
Im Aufgabenbericht nennen: die Commits von A1–A18, dass nichts gepusht ist, und die Schritte nach der Owner-Freigabe (nicht ausführen):
1. `git push -u origin feat/master-link-teil2a`, PR „Master-Link Teil 2a: feste Kennungen und Abgleich ohne Verlust (#235)“ mit der Titler-Messung aus A17 im PR-Text.
2. Nach dem Merge die Tags **einzeln** pushen (mehr als drei Tags in einem Push lösen keine Workflows aus): `launcher-v0.13.0`, dann `timer-v0.13.0`, dann `rundown-v0.6.0`.
3. Abnahme nach `apps/rundown/ABNAHME-2a.md` durch den Owner.

**Abweichungen vom Gerüst:**
1. Die Doku steht in `docs/jm-show.md` (neuer Abschnitt 8, je eine Zeile in den Tabellen der Abschnitte 2 und 4) statt in `docs/suite-verbund.md`: 2a betrifft den Einzelplatz, nicht den Verbund; `jm-show.md` erklärt schon, was jedes Tool aus der Show lädt. Dazu ein Halbsatz im Index `docs/README.md`.
2. `ABNAHME-2a.md` ist wortgetreu nach Spec 10. Der Satz zu den Agenda-Schritten war in der Spec falsch („4, 5 und 7“) und ist dort wie hier auf „5, 6 und 8“ berichtigt (Schritt 4 legt nur Aktionen an, 7 ist das GO).
3. Das Datum im Changelog ist der Tag des Release-Commits; vorbelegt ist `2026-10-01`.
4. Die Spalte „Ergebnis / Datum“ heißt wie in der Abnahme-Checkliste von Teil 1 (`packages/master-link/ABNAHME.md`).
