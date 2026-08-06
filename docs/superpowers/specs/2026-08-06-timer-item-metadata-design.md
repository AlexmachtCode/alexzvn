# JM Timer — Verantwortlich + Kategorie je Ablaufpunkt (Sub-C2) — Design

> Sub-Projekt **C2** der Timer-Import/Export-Erweiterung (Roadmap Lane A), nach
> Sub-C1 (Import-Spalten-Mapping, released `timer-v0.9.0`). Danach folgt **Sub-B**
> (iveo-Agenda-Cues). Dieses Design betrifft **nur C2**.

**Stand:** 2026-08-06 · Branch `feat/timer-item-metadata` (von `main`, enthält C1)

## Ziel

Jeder Ablaufpunkt kann zwei zusätzliche, benannte Metadaten tragen — **Verantwortlich
(`owner`)** und **Kategorie (`category`)**. Sie werden beim XLSX-Import erkannt/zugeordnet,
im Operator kompakt angezeigt und editiert, und beim Export wieder ausgegeben (Round-Trip,
auch mit JM Rundown). Sie sind **reine Metadaten** — der Timer leitet daraus kein Verhalten ab.

## Nicht-Ziele (YAGNI)

- **Kein Timer-Verhalten** aus den Feldern (keine Kategorie-Farben, keine Filter/Gruppierung).
- **Kein generischer Spalten-Beutel** — genau zwei feste Felder (Ansatz A). Beliebige
  Fremdspalten zu erhalten wäre ein eigenes Slice.
- **Sprecher-/Großanzeige unberührt** — operator-fokussiert.
- **Keine neuen tt-Commands** — die Felder sind Teil des Items (`Omit<TimetableItem,'id'>`)
  und werden von `tt:update`/`tt:setAll`/`tt:add` automatisch mitgeführt.

## Modell (additiv, zwei Ebenen parallel zu `plannedStartMs`)

- **`ParsedRow`** (`packages/regieplan/src/index.ts`) bekommt `owner?: string; category?: string;`.
- **`TimetableItem`** (`apps/timer/src/shared/timer-state.ts`) bekommt dieselben zwei Felder.
- **`ColumnMapping`** (`@jm/regieplan`) wächst auf sechs Felder:
  `{ label, start, duration, note, owner, category }` (je Spalten-Key oder `null`).
- Rundown ignoriert die Felder → bleibt grün; sein Export bekommt zwei leere Zusatzspalten (akzeptiert).

## Erkennung + Mapping + Export (`@jm/regieplan`, geteilt)

- **Neue Keyword-Regex** (nach `NOTE_KEYWORDS`):
  - `OWNER_KEYWORDS = /verantwortlich|verantwortung|owner|responsible|zust(ä|ae)ndig/`
  - `CATEGORY_KEYWORDS = /kategorie|category|rubrik|typ|type/`
  - ⚠️ **Fallstrick (im Code kommentieren):** **kein** bloßes `art` in `CATEGORY_KEYWORDS` —
    „st**art**zeit" enthält „art" → die Startzeit-Spalte würde sonst zusätzlich als Kategorie
    erkannt. Die gewählten Keywords sind mit Label/Start/Dauer/Notiz **disjunkt** (geprüft).
- **`matchHeader`** erkennt zusätzlich `owner` + `category` — und beansprucht dabei nur Spalten,
  die noch **keinem** anderen Feld zugeordnet sind (Guard `col !== out.label && col !== out.start
  && col !== out.duration && col !== out.note`, analog zum bestehenden `col !== out.start` der
  Dauer). `detectHeader`-Fallback ergänzt `owner: null, category: null`.
- **`extractRowsFromMapping`** liest owner/category aus den gemappten Keys (getrimmter String;
  leer → `undefined`), exakt wie `note`.
- **`REGIEPLAN_HEADER`** → `['Programmpunkt','Startzeit','Dauer','Notiz','Verantwortlich','Kategorie']`
  (**angehängt**, damit bestehende Import-Reihenfolge/Erkennung stabil bleibt).
- **`rowsToAoa`** schreibt die zwei neuen Spalten (leer, wenn nicht gesetzt);
  `exportRegieplanXlsx`-Spaltenbreiten um zwei Einträge erweitert.
- **`InspectResult.columns`** trägt owner/category automatisch (ist `ColumnMapping`).

## UI

### Import-Dialog (`XlsxImport.tsx`) — zwei weitere Mapping-Dropdowns

Die 4 bestehenden Dropdowns (Titel/Startzeit/Dauer/Notiz) bekommen zwei Nachbarn
**Verantwortlich** + **Kategorie** (beide **optional**, kein Pflicht-Gate). Grid der
Mapping-Zeile von 4 auf 6 Spalten (`md:grid-cols-3` in zwei Reihen, damit es nicht quetscht).
Import-Vorschau: owner/category werden je Zeile **kompakt** unter dem Titel gezeigt
(`V: … · K: …`, nur wenn gesetzt) — keine neuen Vorschau-Spalten.

### Operator-Zeile (`TimetableRow.tsx`) — kompakte Unterzeile

Das 7-Spalten-Raster bleibt. Unter dem Titel-Input eine schmale, editierbare Zeile mit zwei
kleinen `Input`s:
```
V: [ Anna        ]   K: [ Live        ]
```
- Lokaler Draft-State + Sync-Effekt (wie `note`), Commit per `onBlur`/Enter →
  `ttUpdate(item.id, { owner })` bzw. `{ category }`. Leerer Wert committet `undefined` (Feld weg).
- Die Unterzeile spannt unter Titel/Soll/Dauer (kein zusätzliches Grid — separater Block unter
  der Row-Grid-Zeile, dezent, `text-xs`).
- **Sprecher-/Großanzeige unberührt.**

## Fehlerbehandlung

owner/category sind optional und unvalidiert (freier Text) — kein Fehlerpfad. Import-/Parse-
Fehler bleiben wie in C1.

## Tests + Verifikation

- **Reine Helfer** (`packages/regieplan/test/selftest.ts`):
  - `extractRowsFromMapping` mit owner/category-Mapping → Felder korrekt gesetzt; nicht gemappt → `undefined`.
  - `matchHeader`/`inspectRegieplan` erkennen „Verantwortlich"/„Kategorie" als eigene Spalten
    (getrennt von Notiz/Label).
  - `REGIEPLAN_HEADER` 6-spaltig; `rowsToAoa` schreibt owner/category an Position 5/6.
  - Bestehende 42 Prüfungen bleiben grün (Header-Erwartungen anpassen, wo nötig).
- **Typecheck** (node+web) für `@jm/timer` + Build; **Rundown** Typecheck + Build grün.
- **Manuell (Owner/Windows-GUI):** XLSX mit Verantwortlich/Kategorie-Spalten importieren →
  Zuordnung + Anzeige stimmen; im Operator editieren; exportieren → Spalten wieder da; Round-Trip
  mit Rundown.

## Release

Timer wird von der CI gebaut → nach Merge Tag **`timer-v0.10.0`** (Minor: neue Fähigkeit) +
automatischer Katalog-Bump. Die `@jm/regieplan`-Erweiterung (owner/category + zwei Export-Spalten)
wandert transitiv auch in Rundown — additiv, kein Zwang zum Sofort-Release.
