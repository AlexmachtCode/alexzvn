# Presenter 0.12.0: Dateien hineinziehen (#298) und PDFs per Doppelklick öffnen (#299). Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dateien per Drag & Drop in den Presenter holen und PDFs per Doppelklick / „Öffnen mit“ öffnen (Windows + macOS), ohne dass der Presenter sich still zum PDF-Programm macht.

**Architecture:** Reine Regeln (Einordnung nach Endung, argv-Auswahl, Bündeln, Öffnen-Modus, Aufbau-Notizen) in `src/shared/dateien.ts`. Ein Lade-Weg im Main (`src/main/dateien-laden.ts`) für Hineinziehen, Doppelklick und `PRESENTER OPEN`. Die Nachricht `project:openFiles` trägt künftig einen Modus `ersetzen | anhaengen | fragen`; der Renderer-Store entscheidet und zeigt bei `fragen` eine Box. Anmeldung beim System: eigenes NSIS-Include (Windows) und `mac.extendInfo` (macOS).

**Tech Stack:** Electron 33 + electron-vite 2, React 18 + zustand 4, TypeScript; Selbsttests mit `tsx` im `ck()`-Muster (`apps/presenter/test/*.test.ts`); Prüfstand per Chrome DevTools Protocol gegen die gepackte App; electron-builder 24.13.3 (NSIS).

**Spec:** `docs/superpowers/specs/2026-11-13-presenter-dateien-oeffnen-design.md` (Owner-Freigabe 13.11.2026 „passt“). Beide Dokumente lesen.

## Global Constraints

- Version `0.12.0` in `apps/presenter/package.json` und `package-lock.json` (erst in Task 7).
- Alle UI-Texte Deutsch, typografische Anführungszeichen „…“. In `packages/suite-manifest/changelog.json` NIE ASCII-`"` in Notes; JSON vor dem Commit mit `node -e "JSON.parse(require('fs').readFileSync(...))"` prüfen.
- Unterstützte Endungen (Groß/Klein egal): PDF `.pdf`; Bilder `.png .jpg .jpeg .webp .gif .bmp`; Office `.pptx .ppt .odp .docx .doc .odt .rtf`; Projekt `.jmpres`.
- Windows: niemals den Standardwert von `Software\Classes\.pdf` schreiben, niemals `UserChoice` anfassen.
- Eine laufende Präsentation (`present.ts`, `payload`) wird von keinem neuen Weg verändert.
- `PRESENTER OPEN` ersetzt weiter immer und ohne Rückfrage.
- Selbsttests laufen unter Node 22 UND 24 (`npm run selftest -w @jm/presenter`); CI (`ci-checks.yml`) ruft genau dieses Skript.
- Release nur im Fenster 18:00–06:00 Berlin (COP31). Tag `presenter-v0.12.0` löst den CI-Build aus.
- Kein Test darf den auf diesem Rechner installierten Presenter (`%LOCALAPPDATA%\Programs\JM Presenter`) ersetzen oder deinstallieren.
- Commits enden mit `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Nur explizite Pfade stagen, nach jedem `git add` `git status --short` lesen.

## Review Focus

1. **Folien umsortieren ist auch Ziehen.** Ein Ziehen ohne Dateien (`dataTransfer.types` ohne `Files`) darf weder die Ablege-Fläche zeigen noch einen Import auslösen (Prüfstand-Fall in Task 3).
2. **Großbuchstaben, Leerzeichen, Umlaute im Pfad** (`C:\…\Präsentation März.PDF`) müssen überall funktionieren: Einordnung, argv, Laden (Selbsttest Task 1, Prüfstand Task 5).
3. **Ein bereits laufender Presenter** (installiert, gleicher Single-Instance-Lock) würde den Prüfstand still auf die falsche App umleiten → der Prüfstand bricht dann mit klarer Meldung ab (Task 3).
4. **Zweiter Doppelklick, während die Frage offen ist** → dieselbe Box, Dateien kommen dazu, derselbe Pfad nicht doppelt (Selbsttest Task 1 für das Bündeln, Prüfstand Task 5).
5. **Ordner oder kaputte Datei abgelegt** (Ordner ohne Endung, Ordner namens `x.pdf`, 0-Byte-PDF) → Hinweis in der Fehlerzeile, kein hängender „busy“-Zustand (Selbsttest Task 2, Prüfstand Task 3).

---

### Task 1: Reine Regeln `src/shared/dateien.ts`

**Files:**
- Create: `apps/presenter/src/shared/dateien.ts`
- Create: `apps/presenter/test/dateien.test.ts`
- Modify: `apps/presenter/package.json` (Skript `selftest`: `&& tsx test/dateien.test.ts` anhängen)

**Interfaces:**
- Consumes: `OfficeAnimations` aus `src/shared/types.ts` (nur Typ-Import).
- Produces (alle exportiert):
  - `type DateiArt = 'pdf' | 'image' | 'office' | 'projekt'`
  - `type OeffnenModus = 'ersetzen' | 'anhaengen' | 'fragen'`
  - `const SAMMEL_MS = 500`
  - `IMAGE_EXT: ReadonlySet<string>`, `OFFICE_EXT: ReadonlySet<string>` (mit Punkt, klein)
  - `dateiArt(pfad: string): DateiArt | null`
  - `dateiName(pfad: string): string` (letztes Segment, trennt an `/` UND `\`)
  - `interface DateiOrdnung { importieren: { pfad: string; art: 'pdf' | 'image' | 'office' }[]; projekt: string | null; nichtUnterstuetzt: string[]; projektUebersprungen: string[] }`
  - `ordneDateien(pfade: readonly string[]): DateiOrdnung`
  - `hinweiseAusOrdnung(o: DateiOrdnung): string[]`
  - `pfadeAusArgv(argv: readonly string[], istDatei: (p: string) => boolean): string[]`
  - `wieOeffnen(modus: OeffnenModus, folienVorhanden: boolean): OeffnenModus`
  - `erstelleSammler(warteMs: number, abgabe: (pfade: string[]) => void): (pfade: readonly string[]) => void`
  - `aufbauHinweise(anim: OfficeAnimations | undefined, seiten: number, expanded: boolean): { notizen: (string | null)[]; hinweis: string | null }`

- [ ] **Step 1: Failing test schreiben** (`test/dateien.test.ts`, `ck()`-Muster wie `test/wiedergabe.test.ts`, Import `../src/shared/dateien`). Assertions:

```ts
ck('pdf groß', d.dateiArt('C:\\Docs\\Präsentation März.PDF') === 'pdf');
ck('bild', d.dateiArt('/x/logo.webp') === 'image' && d.dateiArt('a.BMP') === 'image');
ck('office', d.dateiArt('deck.pptx') === 'office' && d.dateiArt('brief.rtf') === 'office');
ck('projekt', d.dateiArt('show.jmpres') === 'projekt');
ck('ohne endung / fremd', d.dateiArt('C:\\Ordner') === null && d.dateiArt('film.mp4') === null && d.dateiArt('x.jmshow') === null);
ck('dateiName beide trenner', d.dateiName('C:\\a\\b.pdf') === 'b.pdf' && d.dateiName('/a/b c.pdf') === 'b c.pdf');

const o1 = d.ordneDateien(['a.pdf', 'b.png', 'Video.mp4', 'c.pptx', 'Notizen.txt']);
ck('ordnung: reihenfolge + arten', JSON.stringify(o1.importieren) === JSON.stringify([
  { pfad: 'a.pdf', art: 'pdf' }, { pfad: 'b.png', art: 'image' }, { pfad: 'c.pptx', art: 'office' }]));
ck('ordnung: nicht unterstützt', o1.nichtUnterstuetzt.join('|') === 'Video.mp4|Notizen.txt' && o1.projekt === null);
ck('projekt allein', d.ordneDateien(['C:\\x\\Show.jmpres']).projekt === 'C:\\x\\Show.jmpres');
const o2 = d.ordneDateien(['Show.jmpres', 'a.pdf']);
ck('projekt im mix übersprungen', o2.projekt === null && o2.projektUebersprungen.join() === 'Show.jmpres' && o2.importieren.length === 1);
ck('hinweise text', JSON.stringify(d.hinweiseAusOrdnung(d.ordneDateien(['C:\\v\\Video.mp4', 'Notizen.txt', 'S.jmpres', 'a.pdf'])))
  === JSON.stringify(['Nicht unterstützt, übersprungen: Video.mp4, Notizen.txt', 'Projektdatei nur einzeln ablegen, übersprungen: S.jmpres']));
ck('keine hinweise', d.hinweiseAusOrdnung(d.ordneDateien(['a.pdf'])).length === 0);

const da = new Set(['C:\\D\\Präsentation März.PDF', 'C:\\D\\b.png', 'C:\\D\\x.jmshow', 'C:\\D\\c.pdf']);
const ist = (p: string) => da.has(p);
ck('argv: exe, schalter, links, --show-wert raus', JSON.stringify(d.pfadeAusArgv(
  ['C:\\P\\JM Presenter.exe', '--allow-file-access-from-files', 'jmps://open?show=x', '--show', 'C:\\D\\x.jmshow',
   'C:\\D\\Präsentation März.PDF', 'C:\\D\\b.png', 'C:\\D\\fehlt.pdf', 'C:\\D\\Präsentation März.PDF'], ist))
  === JSON.stringify(['C:\\D\\Präsentation März.PDF', 'C:\\D\\b.png']));
ck('argv: --show überspringt genau EIN Wert', JSON.stringify(d.pfadeAusArgv(['--show', 'C:\\D\\c.pdf'], ist)) === '[]');

ck('fragen + leer → ersetzen', d.wieOeffnen('fragen', false) === 'ersetzen');
ck('fragen + folien → fragen', d.wieOeffnen('fragen', true) === 'fragen');
ck('anhaengen/ersetzen bleiben', d.wieOeffnen('anhaengen', false) === 'anhaengen' && d.wieOeffnen('ersetzen', true) === 'ersetzen');

const abgaben: string[][] = [];
const s = d.erstelleSammler(60, (p) => abgaben.push(p));
s(['a.pdf']); await warte(30); s(['b.pdf', 'a.pdf']); await warte(30);
ck('sammler: wartet nach letzter eingabe', abgaben.length === 0);
await warte(60);
ck('sammler: eine abgabe, ohne doppelte', abgaben.length === 1 && abgaben[0].join() === 'a.pdf,b.pdf');
s(['c.pdf']); await warte(90);
ck('sammler: danach neuer vorgang', abgaben.length === 2 && abgaben[1].join() === 'c.pdf');

const anim = { perSlide: [0, 2, 1], animatedSlides: 2, totalBuilds: 3 };
const a1 = d.aufbauHinweise(anim, 3, false);
ck('aufbau: notizen', JSON.stringify(a1.notizen) === JSON.stringify([null,
  '▸ Original-Animation: 2 Aufbau-Klick(s) auf dieser Folie.', '▸ Original-Animation: 1 Aufbau-Klick(s) auf dieser Folie.']));
ck('aufbau: hinweis', a1.hinweis === '2 Folie(n) hatten Aufbau-Animationen (3 Klicks) — als Notiz vermerkt.');
ck('aufbau: seitenzahl passt nicht → keine notizen', d.aufbauHinweise(anim, 4, false).notizen.every((n) => n === null));
ck('aufbau: aufgeteilt', d.aufbauHinweise(undefined, 7, true).hinweis === 'Aufbau-Animationen als Einzelschritte importiert — 7 Schritt-Folien (experimentell).');
ck('aufbau: nichts', d.aufbauHinweise(undefined, 2, false).hinweis === null);
```

- [ ] **Step 2: Test laufen lassen, muss scheitern**
Run: `cd C:/Users/alexk/alexzvn/.claude/worktrees/master-link-2b/apps/presenter && npx tsx test/dateien.test.ts`
Expected: Abbruch, Modul `../src/shared/dateien` fehlt.

- [ ] **Step 3: `src/shared/dateien.ts` implementieren** (keine Node-/Electron-Importe; die Datei wird auch im Renderer gebündelt).
  - `pfadeAusArgv`: Eintrag überspringen, wenn er mit `-` beginnt, `://` enthält, direkt auf `--show` folgt, oder `dateiArt` null ist, oder `istDatei` false liefert; Reihenfolge erhalten, Dubletten raus. `argv[0]` braucht keine Sonderregel (`.exe` ist nicht unterstützt).
  - `erstelleSammler`: jede Eingabe hängt neue Pfade an (ohne Dubletten) und startet den Timer neu; nach `warteMs` Ruhe eine Abgabe, dann leer.
  - Texte in `hinweiseAusOrdnung` / `aufbauHinweise` exakt wie im Test (Namen über `dateiName`, getrennt mit `, `).
  - `control-open.ts` und `ipc.ts` bekommen ihre `IMAGE_EXT`/`OFFICE_EXT` in Task 2 von hier.

- [ ] **Step 4: Test grün**
Run: `npx tsx test/dateien.test.ts` → letzte Zeile `dateien: N ok, 0 FAIL`. Danach `npm run selftest` unter Node 22 UND 24 (alle drei Dateien grün).

- [ ] **Step 5: Commit** `feat(presenter): Regeln für Dateien öffnen – Einordnung, argv, Bündeln, Modus (#298, #299)`

---

### Task 2: Ein Lade-Weg im Main, neuer Nachrichtenvertrag, Store

**Files:**
- Create: `apps/presenter/src/main/office/import.ts`
- Create: `apps/presenter/src/main/dateien-laden.ts`
- Create: `apps/presenter/test/dateien-laden.test.ts`
- Modify: `apps/presenter/src/shared/types.ts` (`ImportedFile`, `OpenFilesPayload`, neu `GeladeneDateien`, `JmprApi.files`)
- Modify: `apps/presenter/src/main/ipc.ts` (Office-Rumpf raus, Handler `files:importPaths`, Endungen aus `@shared/dateien`)
- Modify: `apps/presenter/src/main/control-open.ts` (über `ladeDateien`, Modus `ersetzen`)
- Modify: `apps/presenter/src/main/windows.ts` (`sendeAnEditor`)
- Modify: `apps/presenter/src/preload/index.ts` (`importPaths`)
- Modify: `apps/presenter/src/renderer/src/store/project.ts`, `src/renderer/src/main.tsx`
- Modify: `apps/presenter/package.json` (selftest um `&& tsx test/dateien-laden.test.ts`)

**Interfaces:**
- Consumes: Task 1 (`ordneDateien`, `hinweiseAusOrdnung`, `dateiName`, `wieOeffnen`, `aufbauHinweise`, `OeffnenModus`).
- Produces:
  - `types.ts`: `ImportedFile` + optional `animations?: OfficeAnimations; expanded?: boolean`; `interface GeladeneDateien { files: ImportedFile[]; projekt: { name: string; bytes: Uint8Array } | null; hinweise: string[] }`; `interface OpenFilesPayload extends GeladeneDateien { modus: OeffnenModus }` (das Feld `replace` entfällt); `JmprApi.files.importPaths(pfade: string[], expandBuilds: boolean): Promise<GeladeneDateien>`.
  - `office/import.ts`: `importOfficeFile(inputPath: string, expandBuilds: boolean): Promise<OfficeImportResult>`, der bisherige Rumpf von `files:importOffice` ab `const base = …` unverändert.
  - `dateien-laden.ts`: `ladeDateien(pfade: readonly string[], opts: { expandBuilds: boolean }): Promise<GeladeneDateien>`
  - `windows.ts`: `sendeAnEditor(channel: string, payload: unknown): boolean` (das `sendWhenReady` aus `control-open.ts`, dorthin umgezogen)
  - Kanal `files:importPaths` (invoke) und Kanal `project:openFiles` (push, Payload `OpenFilesPayload`)
  - Store: `frage: { files: ImportedFile[] } | null`; `oeffneGeladene(g: GeladeneDateien, modus: OeffnenModus): Promise<void>`; `beantworteFrage(wahl: 'ersetzen' | 'anhaengen' | 'abbrechen'): Promise<void>`; `ingestImportedFiles(files, replace)` wendet `aufbauHinweise` je Datei an.

- [ ] **Step 1: Failing test** `test/dateien-laden.test.ts`. Muster wie `wiedergabe.test.ts`: `registerHooks` biegt `./office/import` auf eine Attrappe um (`importOfficeFile` liefert für `Deck.pptx` `{ ok: true, name: 'Deck.pdf', bytes: Uint8Array.of(1,2,3), animations: {perSlide:[1], animatedSlides:1, totalBuilds:1} }`, für `Kaputt.docx` `{ ok: false, error: 'LibreOffice nicht gefunden.' }` und merkt sich das übergebene `expandBuilds`). Echte Dateien in `fs.mkdtempSync(os.tmpdir())`: `a.pdf` (Bytes `%PDF-1.4`), `b.PNG`, `S.jmpres`, ein Unterordner `ordner.pdf`. Assertions:
  - `ladeDateien([a.pdf, b.PNG, Video.mp4], {expandBuilds:false})` → `files.map(f=>f.name+':'+f.kind)` = `['a.pdf:pdf','b.PNG:image']`, Bytes von a.pdf gleich, `hinweise` = `['Nicht unterstützt, übersprungen: Video.mp4']`, `projekt` null.
  - `[Deck.pptx]` mit `expandBuilds:true` → ein File `Deck.pdf`, `kind` `pdf`, `animations.totalBuilds === 1`, Attrappe sah `expandBuilds === true`.
  - `[Kaputt.docx]` → keine Files, `hinweise` = `['„Kaputt.docx“: LibreOffice nicht gefunden.']`.
  - `[fehlt.pdf]` und `[ordner.pdf]` → keine Files, je ein Hinweis, der mit `„fehlt.pdf“ konnte nicht geladen werden: ` bzw. `„ordner.pdf“ konnte nicht geladen werden: ` beginnt.
  - `[S.jmpres]` → `projekt.name === 'S.jmpres'`, Bytes gleich, keine Files.
  - `[S.jmpres, a.pdf]` → `projekt` null, ein File, Hinweis `Projektdatei nur einzeln ablegen, übersprungen: S.jmpres`.
  - Reihenfolge bleibt die der Eingabe, auch wenn Office dazwischen liegt.

- [ ] **Step 2: Test laufen lassen, muss scheitern** (`npx tsx test/dateien-laden.test.ts`, Modul fehlt).

- [ ] **Step 3: Main implementieren.**
  - `office/import.ts` aus `ipc.ts` herauslösen; `files:importOffice` = Dialog + `importOfficeFile(inputPath, !!expandBuilds)`.
  - `ladeDateien`: `ordneDateien`, dann der Reihe nach (nicht parallel, LibreOffice verträgt keine Parallelläufe): PDF/Bild per `readFile`; Office per `importOfficeFile` → `ImportedFile { name: res.name ?? `${base}.pdf`, kind: 'pdf', bytes, animations, expanded }`, Fehlschlag → Hinweis `„<name>“: <res.error ?? 'Umwandlung fehlgeschlagen.'>`; Lesefehler → `„<name>“ konnte nicht geladen werden: <message>`. Hinweise aus der Ordnung zuerst.
  - `ipc.ts`: `ipcMain.handle('files:importPaths', (_e, pfade: unknown, expandBuilds: unknown) => …)`. Nur ein Array aus Strings annehmen, sonst `{ files: [], projekt: null, hinweise: [] }`; `expandBuilds === true`.
  - `control-open.ts`: `openByPath` = `ladeDateien([filePath], { expandBuilds: false })`, Hinweise ins Log; nichts geladen → `false`; sonst `sendeAnEditor('project:openFiles', { ...g, modus: 'ersetzen' })`. Log-Zeilen `PRESENTER OPEN: …` behalten.
  - Preload: `importPaths: (pfade, expandBuilds) => ipcRenderer.invoke('files:importPaths', pfade, expandBuilds)`.

- [ ] **Step 4: Renderer-Store.**
  - `ingestImportedFiles`: pro PDF-Datei `aufbauHinweise(f.animations, count, !!f.expanded)` → Notizen auf die neuen Folien, letzter nicht-leerer `hinweis` → `notice`.
  - `importOffice` nutzt danach `ingestImportedFiles([{ name: res.name ?? 'Dokument.pdf', kind: 'pdf', bytes: res.bytes, animations: res.animations, expanded: res.expanded }], false)`; Verhalten für den Knopf bleibt gleich (Prüfstand Task 3 vergleicht Folienzahl und Notiz).
  - `oeffneGeladene(g, modus)`: (1) `g.projekt`: bei `modus !== 'ersetzen'`, `dirty` und Folien vorhanden → `window.confirm(`Aktuelle Präsentation verwerfen und „${g.projekt.name}“ öffnen? Nicht gespeicherte Änderungen gehen verloren.`)`, Nein → Ende; dann `openProjectFromBytes`. (2) sonst `wieOeffnen(modus, slides.length > 0)`: `ersetzen` → `ingestImportedFiles(files, true)`, `anhaengen` → `(files, false)`, `fragen` → `frage = { files: [...(frage?.files ?? []), ...files] }` (gleicher `name` + gleiche Länge nicht doppelt). (3) ZULETZT, falls `g.hinweise.length`: `error = g.hinweise.join(' · ')` (ingest/open setzen `error` sonst wieder auf null).
  - `beantworteFrage`: `frage` lesen, auf `null` setzen; `ersetzen`/`anhaengen` → `ingestImportedFiles(files, wahl === 'ersetzen')`.
  - `main.tsx`: `onOpenFiles((p) => void useProject.getState().oeffneGeladene(p, p.modus))`. `onOpenProject` (Show-Deep-Link) bleibt unverändert.

- [ ] **Step 5: Grün + Typen.** `npm run selftest` (Node 22 und 24), `npm run typecheck` → beide ohne Fehler.

- [ ] **Step 6: Commit** `refactor(presenter): ein Lade-Weg für Pfade, Öffnen-Modus in project:openFiles (#298, #299)`

---

### Task 3: Hineinziehen ins Editor-Fenster + Prüfstand

**Files:**
- Create: `apps/presenter/src/renderer/src/components/DateiAblage.tsx`
- Create: `apps/presenter/test/pruefstand.mjs`
- Modify: `apps/presenter/src/preload/index.ts`, `src/shared/types.ts` (`pfadFuer`)
- Modify: `apps/presenter/src/renderer/src/views/EditorView.tsx` (Wurzel in `DateiAblage`, Text im leeren Zustand)

**Interfaces:**
- Consumes: Task 2 (`window.jmpr.files.importPaths`, `useProject.oeffneGeladene`, `busy`, `setNotice`), `getExpandPptxBuilds()` aus `lib/settings.ts`.
- Produces: `JmprApi.files.pfadFuer(file: File): string` (Preload: `webUtils.getPathForFile`, Muster `apps/copy/src/preload/index.ts`). Prüfstand-CLI `node test/pruefstand.mjs [--exe <pfad>] [--nur <gruppe,…>]`, Gruppen `ablage`, `navigation`, `doppelklick`; Ausgabe je Fall `  ok  …` / `FAIL  …` / `skip  … (Grund)`, letzte Zeile `pruefstand: N ok, M FAIL, K übersprungen`, Exit 1 bei FAIL.

- [ ] **Step 1: Prüfstand-Gerüst** (`test/pruefstand.mjs`, Node ≥ 22, globales `WebSocket`; `pdf-lib` und `fflate` aus dem Workspace). Testdateien in einem frischen Ordner unter `os.tmpdir()`: `a.pdf` (2 Seiten), `eins.pdf` und `Präsentation März.PDF` (je 1 Seite), `b.png` (1×1), `brief.rtf` (`{\rtf1\ansi Hallo}`, Office-Weg), `film.mp4` (beliebige Bytes), ein Unterordner `ordner`.
  - Vorab: läuft ein Prozess `JM Presenter.exe` (`tasklist /FI "IMAGENAME eq JM Presenter.exe"`), Abbruch mit `Prüfstand: ein Presenter läuft schon (Single-Instance-Lock) – bitte erst schließen.` und Exit 2.
  - Start: `--exe` (Vorgabe `release/win-unpacked/JM Presenter.exe`) mit `--remote-debugging-port=9333`, Umgebung OHNE `ELECTRON_RUN_AS_NODE`. Ziele über `http://127.0.0.1:9333/json/list`, Editor = URL mit `view=editor`.
  - Hilfen: `auswerten(ziel, js)` (`Runtime.evaluate`, `awaitPromise`), `ablegen(ziel, pfade, x, y)` (`Input.dispatchDragEvent` `dragEnter` → `dragOver` → `drop`, `data: { items: [], files: pfade, dragOperationsMask: 1 }`), `folienZahl()` liest `Folien · N` aus dem DOM, `warteBis(fn, ms)`.
  - Ende: Prozessbaum mit `taskkill /PID <pid> /T /F` beenden, auch nach Fehlern.

- [ ] **Step 2: Vorher-Messung (Spec „Prüfung“).** Gruppe `navigation`, Fall „Ablegen aufs leere Editor-Fenster lässt die Seite stehen“: PDF ablegen, nach 1 s `location.href` des Editors prüfen. Gegen die installierte 0.11.0 laufen lassen:
  Run: `node test/pruefstand.mjs --nur navigation --exe "$LOCALAPPDATA/Programs/JM Presenter/JM Presenter.exe"` (nur, wenn der installierte Presenter gerade NICHT läuft; er wird dabei nur gestartet und beendet, nicht verändert).
  Ergebnis (URL vorher/nachher) in den Task-Bericht und später in den PR-Text. Erwartet laut Electron-Standard: FAIL (Seite wird zur PDF). Kommt etwas anderes heraus: so festhalten und Task 4 trotzdem bauen.

- [ ] **Step 3: Gruppe `ablage` schreiben** (gegen `dist:dir`-Build, muss jetzt scheitern):
  - Leerer Editor + PDF (2 Seiten) + PNG ablegen → `Folien · 3`, Fehlerzeile leer.
  - Danach `Präsentation März.PDF` (1 Seite) ablegen → `Folien · 4` (angehängt, erste Folie bleibt ausgewählt).
  - `brief.rtf` + `film.mp4` ablegen → `Folien · 5`, Fehlerzeile enthält `Nicht unterstützt, übersprungen: film.mp4`. Ohne LibreOffice (`C:\Program Files\LibreOffice` fehlt) → `skip`.
  - Ordner ablegen → Folienzahl gleich, Fehlerzeile nennt den Ordner; danach ist der Knopf „PDF / Bilder importieren“ wieder aktiv (kein hängendes busy).
  - Beim `dragOver` mit Datei steht `Dateien hier ablegen` im DOM; nach `drop` nicht mehr.
  - Folie 1 per `Input.dispatchDragEvent` OHNE `files` (nur `items: [{ mimeType: 'text/plain', data: 'x' }]`) auf Folie 3 ziehen → keine Ablege-Fläche, Folienzahl gleich.
  - Projekt: Der Prüfstand baut `Projekt.jmpres` selbst mit `fflate.zipSync` (Format aus `src/renderer/src/lib/project-file.ts`): `manifest.json` = `{ schemaVersion: 1, name: 'Projekt', sources: [{ id: 'src1', kind: 'pdf', name: 'eins.pdf', pageCount: 1 }], slides: [{ id: 's1', sourceId: 'src1', pageIndex: 0, title: 'Projektfolie', notes: '', hidden: false, overlays: [] }] }`, dazu `sources/src1` = 1-seitiges PDF. Ablegen auf das (ungespeicherte) Deck → JS-Dialog (`Page.javascriptDialogOpening`) mit Text, der `„Projekt.jmpres“ öffnen` enthält; per `Page.handleJavaScriptDialog { accept: true }` bestätigen → `Folien · 1`. Zusammen mit `a.pdf` abgelegt → kein Dialog, Folienzahl +2, Fehlerzeile enthält `Projektdatei nur einzeln ablegen, übersprungen: Projekt.jmpres`.
  Run: `npm run dist:dir` dann `node test/pruefstand.mjs --nur ablage` → FAIL (noch keine Ablage).

- [ ] **Step 4: `DateiAblage` implementieren.** Wrapper um den ganzen Editor (`EditorView`-Wurzel). Zähler für `dragenter`/`dragleave` (Kinder lösen beides aus). Nur wenn `e.dataTransfer.types.includes('Files')`: `preventDefault`, `dropEffect = 'copy'`, Fläche zeigen. Fläche: `absolute inset-0 z-40`, halbtransparent, Rahmen gestrichelt in `--primary`, Text groß `Dateien hier ablegen`, darunter klein `PDF, Bilder, PowerPoint`. Beim `drop` mit Dateien: Pfade über `window.jmpr.files.pfadFuer`, leere raus; `busy.active` → `setNotice('Import läuft noch – bitte danach erneut ablegen.')`; sonst `busy = { active: true, label: 'Lade Dateien…' }`, `importPaths(pfade, getExpandPptxBuilds())`, `busy` zurück (auch bei Fehler), dann `oeffneGeladene(g, 'anhaengen')`. Leerer Zustand: erster Satz wird `Importiere PDFs, Bilder oder Office-Dokumente – oder zieh sie einfach hierher.`

- [ ] **Step 5: Grün.** `npm run typecheck`, `npm run dist:dir`, `node test/pruefstand.mjs --nur ablage` → 0 FAIL.

- [ ] **Step 6: Commit** `feat(presenter): Dateien ins Editor-Fenster ziehen (#298)` (inkl. `test/pruefstand.mjs`).

---

### Task 4: Navigation absperren (alle drei Fenster)

**Files:**
- Modify: `apps/presenter/src/main/windows.ts`
- Modify: `apps/presenter/test/pruefstand.mjs` (Gruppe `navigation` ergänzen)

**Interfaces:**
- Consumes: Prüfstand aus Task 3.
- Produces: `sperreNavigation(win: BrowserWindow): void` in `windows.ts`, aufgerufen in `createEditorWindow`, `openPresenterWindow`, `openAudienceWindow`.

- [ ] **Step 1: Gruppe `navigation` erweitern:**
  - Der Editor-Fall aus Task 3 Step 2 bleibt drin (seit Task 3 ok, weil `DateiAblage` das Ablegen abfängt).
  - `location.reload()` im Editor → nach dem Laden ist `view=editor` wieder da (Neu laden geht weiter).
  - Deck mit `a.pdf` per Ablegen füllen, Knopf `▶ Präsentieren` per DOM-Klick; Ziele `view=presenter` / `view=audience` in `/json/list` abwarten. Auf beide je `eins.pdf` ablegen → `location.href` beider unverändert, `window.jmpr.present.getState()` weiter `active: true`, Index gleich.
  Run gegen den Build aus Task 3 → die beiden Präsentationsfälle FAIL.

- [ ] **Step 2: Implementieren.** `win.webContents.on('will-navigate', (e) => e.preventDefault())`. Keine Seite des Presenters navigiert absichtlich (geprüft: kein `location.href =` / `<a href>` im Renderer). Neu laden löst kein `will-navigate` aus; das bestätigt der Reload-Fall.

- [ ] **Step 3: Grün.** `npm run dist:dir`, `node test/pruefstand.mjs --nur ablage,navigation` → 0 FAIL.

- [ ] **Step 4: Commit** `fix(presenter): abgelegte Dateien navigieren kein Fenster mehr weg (#298)`

---

### Task 5: Doppelklick / „Öffnen mit“ – Pfade annehmen, Frage im Editor

**Files:**
- Create: `apps/presenter/src/main/datei-oeffnen.ts`
- Create: `apps/presenter/src/renderer/src/components/OeffnenFrage.tsx`
- Modify: `apps/presenter/src/main/index.ts`
- Modify: `apps/presenter/src/renderer/src/views/EditorView.tsx` (Box einhängen)
- Modify: `apps/presenter/test/pruefstand.mjs` (Gruppe `doppelklick`)

**Interfaces:**
- Consumes: Task 1 (`pfadeAusArgv`, `erstelleSammler`, `SAMMEL_MS`), Task 2 (`ladeDateien`, `sendeAnEditor`, Store `frage`, `beantworteFrage`, `dirty`), `createEditorWindow` aus `windows.ts`.
- Produces: `registriereDateiOeffnen(): void` (in `index.ts` im `gotLock`-Zweig VOR `app.whenReady()` aufrufen), `oeffneStartDateien(): void` (in `whenReady` direkt nach `createEditorWindow()`).

- [ ] **Step 1: Gruppe `doppelklick`** (muss scheitern):
  - Start mit `Präsentation März.PDF` als Argument (Prüfstand startet die Exe mit dem Pfad) → leerer Editor lädt ohne Frage: `Folien · 1`, keine Box im DOM.
  - Zweite Instanz mit `a.pdf` starten (zweiter Prozess, gleiche Exe, Pfad als Argument, OHNE `--remote-debugging-port`; er beendet sich selbst) → Box mit Titel `„a.pdf“ öffnen` und den drei Knöpfen `Ersetzen`, `Anhängen`, `Abbrechen`; Folienzahl unverändert.
  - Während die Box offen ist, zweite Instanz mit `b.png` und noch einmal mit `a.pdf` → dieselbe EINE Box, Titel `2 Dateien öffnen`.
  - `Anhängen` klicken → Folienzahl +3 (2 Seiten + Bild).
  - Projekt verändern (Folie ausblenden per Knopf, `dirty`), zweite Instanz mit `a.pdf` → Box zeigt `Beim Ersetzen gehen nicht gespeicherte Änderungen verloren.`; `Abbrechen` → Folienzahl gleich; erneut, `Ersetzen` → `Folien · 2`.
  - Präsentation läuft, zweite Instanz mit `a.pdf`, `Ersetzen` → `window.jmpr.present.getPayload()` in der Publikumsansicht hat dieselbe Folienzahl wie vorher.
  - Show-Link nicht geschluckt: zweite Instanz mit `jmps://open?show=<pfad einer .jmshow im tmp>` → keine Box, kein Fehler im Editor (der Show-Weg selbst bleibt unverändert; wenn die `.jmshow` kein Presenter-Dokument nennt, passiert sichtbar nichts).

- [ ] **Step 2: `datei-oeffnen.ts` implementieren.**
  - `istDatei = (p) => { try { return statSync(p).isFile(); } catch { return false; } }`.
  - Ein Sammler `erstelleSammler(SAMMEL_MS, abgabe)`. `abgabe(pfade)`: `ladeDateien(pfade, { expandBuilds: false })` → `createEditorWindow()` (holt das vorhandene Fenster nach vorn oder baut es neu) → `sendeAnEditor('project:openFiles', { ...g, modus: 'fragen' })`. Nichts geladen und keine Hinweise → nichts senden.
  - `registriereDateiOeffnen`: `app.on('open-file', (e, p) => { e.preventDefault(); … })` und `app.on('second-instance', (_e, argv) => sammler(pfadeAusArgv(argv, istDatei)))`. Vor `oeffneStartDateien` eintreffende Pfade puffern (Mac schickt `open-file` vor `ready`).
  - `oeffneStartDateien`: Puffer + `pfadeAusArgv(process.argv, istDatei)` in den Sammler, danach direkt durchreichen.
  - Der bestehende `second-instance`-Zuhörer in `index.ts` und der in `@jm/app-runtime` bleiben unverändert.

- [ ] **Step 3: `OeffnenFrage.tsx`.** Rendert nur bei `frage !== null`, als Overlay `fixed inset-0 z-50` mit Karte (Stil wie `RemotePanel`). Titel: 1 Datei → `„<name>“ öffnen`; mehrere, alle `.pdf` → `<n> PDFs öffnen`; sonst `<n> Dateien öffnen`. Text `Im Presenter liegt schon eine Präsentation.`, bei `dirty` zusätzlich `Beim Ersetzen gehen nicht gespeicherte Änderungen verloren.` Knöpfe in dieser Reihenfolge `Ersetzen`, `Anhängen` (primär, bekommt den Fokus), `Abbrechen`; `Escape` = Abbrechen. In `EditorView` neben `DateiAblage` einhängen.

- [ ] **Step 4: Grün.** `npm run selftest` (Node 22 + 24), `npm run typecheck`, `npm run dist:dir`, `node test/pruefstand.mjs` (alle Gruppen) → 0 FAIL.

- [ ] **Step 5: Commit** `feat(presenter): PDFs per Doppelklick/„Öffnen mit“ öffnen, Frage bei offenem Deck (#299)`

---

### Task 6: Anmeldung beim System (Windows-Installer, macOS)

**Files:**
- Create: `apps/presenter/build/installer.nsh` (UTF-8 MIT BOM, sonst landen Umlaute falsch in der Registry)
- Create: `apps/presenter/test/installer-pruefung.ps1`
- Modify: `apps/presenter/electron-builder.yml`
- Modify: `docs/superpowers/specs/2026-11-13-presenter-dateien-oeffnen-design.md` (zwei Abweichungen nachtragen, siehe unten)

**Interfaces:**
- Consumes: NSIS-Defines von electron-builder: `APP_ID`, `PRODUCT_NAME`, `APP_EXECUTABLE_FILENAME`, Makro `${isUpdated}`, Wurzel `SHELL_CONTEXT`.
- Produces: Registry-Einträge unter HKCU (Spec §5); `CFBundleDocumentTypes` im Mac-`Info.plist`.

**Zwei Entscheidungen gegenüber der Spec (dort nachtragen):**
- ProgID = `${APP_ID}.pdf` (→ `gmbh.jakobs.presenter.pdf`) statt `JMPresenter.pdf`, damit ein Prüfbau mit eigener `appId` nichts vom echten Presenter überschreibt.
- macOS über `mac.extendInfo.CFBundleDocumentTypes` statt `mac.fileAssociations`, weil electron-builder 24.13.3 dort kein `LSItemContentTypes` kennt. Wirkt ebenfalls nur auf den Mac.

- [ ] **Step 1: Prüfskript** `test/installer-pruefung.ps1 -Installer <pfad> -Produkt "JM Presenter Pruefbau" -AppId gmbh.jakobs.presenter.pruefbau`. Ablauf und Prüfungen (PowerShell `Get-ItemProperty`, keine `reg.exe`-Ausgabe parsen):
  1. Vorher: Standardwert von `HKCU:\Software\Classes\.pdf` merken (darf fehlen).
  2. `& $Installer /S`, warten bis Prozess fertig.
  3. Prüfen: `HKCU:\Software\Classes\<AppId>.pdf` Standardwert `PDF-Dokument`; `…\shell\open\command` = `"<LOCALAPPDATA>\Programs\<Produkt>\<Produkt>.exe" "%1"`; `HKCU:\Software\Classes\.pdf\OpenWithProgids` hat Wert `<AppId>.pdf`; `HKCU:\Software\Classes\Applications\<Produkt>.exe\SupportedTypes` hat `.pdf`; `HKCU:\Software\Jakobs Medien\<Produkt>\Capabilities` `ApplicationDescription` = `PDFs und Präsentationen vorführen`, `FileAssociations` `.pdf` = `<AppId>.pdf`; `HKCU:\Software\RegisteredApplications` Wert `<Produkt>`; Standardwert von `.pdf` UNVERÄNDERT.
  4. Update: denselben Installer noch einmal `/S` → alle Einträge aus 3 noch da.
  5. Deinstallation: `& "<LOCALAPPDATA>\Programs\<Produkt>\Uninstall <Produkt>.exe" /S`, bis 30 s pollen → alle Einträge aus 3 weg, `.pdf`-Standardwert unverändert, `OpenWithProgids` ohne `<AppId>.pdf`.
  Ausgabe `ok`/`FAIL` je Punkt, Exit 1 bei FAIL.

- [ ] **Step 2: Prüfbau ohne installer.nsh bauen und Prüfung laufen lassen** (muss bei 3 scheitern):
  Run (in `apps/presenter`): `npx electron-vite build && npx electron-builder --win nsis -c.appId=gmbh.jakobs.presenter.pruefbau -c.productName="JM Presenter Pruefbau" -c.nsis.shortcutName="JM Presenter Pruefbau" -c.directories.output=release-pruefbau`, dann `powershell -File test/installer-pruefung.ps1 -Installer "release-pruefbau/JM Presenter Pruefbau-<version>-win-x64.exe" -Produkt "JM Presenter Pruefbau" -AppId gmbh.jakobs.presenter.pruefbau` → FAIL bei 3. `release-pruefbau/` in `apps/presenter/.gitignore` aufnehmen.

- [ ] **Step 3: `build/installer.nsh`** (exakt diese Einträge, Spec §5):

```nsis
; JM Presenter: PDF anbieten (#299), nie übernehmen.
; Kein Schreiben auf den Standardwert von Software\Classes\.pdf, kein UserChoice.
!define JM_PDF_PROGID "${APP_ID}.pdf"
!define JM_CAPS "Software\Jakobs Medien\${PRODUCT_NAME}\Capabilities"

!macro customInstall
  WriteRegStr SHELL_CONTEXT "Software\Classes\${JM_PDF_PROGID}" "" "PDF-Dokument"
  WriteRegStr SHELL_CONTEXT "Software\Classes\${JM_PDF_PROGID}\DefaultIcon" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME},0"
  WriteRegStr SHELL_CONTEXT "Software\Classes\${JM_PDF_PROGID}\shell\open\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
  WriteRegStr SHELL_CONTEXT "Software\Classes\.pdf\OpenWithProgids" "${JM_PDF_PROGID}" ""
  WriteRegStr SHELL_CONTEXT "Software\Classes\Applications\${APP_EXECUTABLE_FILENAME}" "FriendlyAppName" "${PRODUCT_NAME}"
  WriteRegStr SHELL_CONTEXT "Software\Classes\Applications\${APP_EXECUTABLE_FILENAME}\SupportedTypes" ".pdf" ""
  WriteRegStr SHELL_CONTEXT "Software\Classes\Applications\${APP_EXECUTABLE_FILENAME}\shell\open\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
  WriteRegStr SHELL_CONTEXT "${JM_CAPS}" "ApplicationName" "${PRODUCT_NAME}"
  WriteRegStr SHELL_CONTEXT "${JM_CAPS}" "ApplicationDescription" "PDFs und Präsentationen vorführen"
  WriteRegStr SHELL_CONTEXT "${JM_CAPS}\FileAssociations" ".pdf" "${JM_PDF_PROGID}"
  WriteRegStr SHELL_CONTEXT "Software\RegisteredApplications" "${PRODUCT_NAME}" "${JM_CAPS}"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend

!macro customUnInstall
  ${ifNot} ${isUpdated}
    DeleteRegValue SHELL_CONTEXT "Software\Classes\.pdf\OpenWithProgids" "${JM_PDF_PROGID}"
    DeleteRegKey SHELL_CONTEXT "Software\Classes\${JM_PDF_PROGID}"
    DeleteRegKey SHELL_CONTEXT "Software\Classes\Applications\${APP_EXECUTABLE_FILENAME}"
    DeleteRegValue SHELL_CONTEXT "Software\RegisteredApplications" "${PRODUCT_NAME}"
    DeleteRegKey SHELL_CONTEXT "Software\Jakobs Medien\${PRODUCT_NAME}"
    DeleteRegKey /ifempty SHELL_CONTEXT "Software\Jakobs Medien"
    System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
  ${endIf}
!macroend
```

  In `electron-builder.yml` unter `nsis:` `include: build/installer.nsh`. Unter `mac:`:

```yaml
  extendInfo:
    CFBundleDocumentTypes:
      - CFBundleTypeName: PDF
        CFBundleTypeRole: Viewer
        LSHandlerRank: Alternate
        LSItemContentTypes: [com.adobe.pdf]
        CFBundleTypeExtensions: [pdf]
```

- [ ] **Step 4: Prüfbau neu bauen, Prüfung grün.** Befehle aus Step 2 → 0 FAIL. Danach `release-pruefbau/` löschen; prüfen, dass `%LOCALAPPDATA%\Programs\JM Presenter Pruefbau` weg ist und `%LOCALAPPDATA%\Programs\JM Presenter` unberührt (Änderungsdatum der Exe vorher/nachher gleich).

- [ ] **Step 5: Mac-`Info.plist`.** Versuch lokal: `npx electron-builder --mac dir --x64 -c.directories.output=release-mac-pruef` und in `release-mac-pruef/mac/JM Presenter.app/Contents/Info.plist` den `CFBundleDocumentTypes`-Block mit `LSHandlerRank` `Alternate` und `com.adobe.pdf` nachlesen. Scheitert der Mac-Build unter Windows: Ergebnis notieren; Prüfung dann über `gh workflow run suite-build.yml --ref feat/presenter-298-299-dateien -f app=presenter` und das Mac-Artefakt — lässt sich die `.dmg` hier nicht öffnen (kein 7-Zip), als offene Abnahme in den PR (zusammen mit dem Finder-Doppelklick). Nichts davon still weglassen.

- [ ] **Step 6: Commit** `feat(presenter): beim System für PDF anmelden – Windows nur anbieten, Mac als Alternative (#299)` (inkl. Spec-Nachtrag, `.gitignore`).

---

### Task 7: Version, Texte, PR, Release

**Files:**
- Modify: `apps/presenter/package.json`, `package-lock.json` (0.12.0)
- Modify: `packages/suite-manifest/changelog.json` (Eintrag presenter 0.12.0, erst nach Owner-Freigabe der Texte)

- [ ] **Step 1: Gesamtprüfung auf dem Endstand.** `npm run selftest` unter Node 22 und 24, `npm run typecheck`, `npm run dist:dir`, `node test/pruefstand.mjs` (alle Gruppen), Installer-Prüfung aus Task 6 noch einmal. Alle Zahlen notieren.
- [ ] **Step 2: Version 0.12.0** (`npm version 0.12.0 -w @jm/presenter --no-git-tag-version`), `git diff --stat` = genau die zwei Dateien. Commit `chore(release): presenter 0.12.0 (#298, #299)`.
- [ ] **Step 3: Changelog-Entwurf** (3–4 Sätze, Stil wie 0.11.0: Hineinziehen; Doppelklick/„Öffnen mit“ und wie man den Presenter selbst als Standard wählt; Frage bei offenem Deck; abgelegte Dateien verändern keine Präsentation). Dem Owner zur Freigabe vorlegen, NICHT committen, bevor er zustimmt.
- [ ] **Step 4: Branch pushen, PR** gegen `main` mit `Closes #298`, `Closes #299` (englisches Schlüsselwort; „Schließt“ schließt nichts). Im PR-Text: Vorher-Messung aus Task 3, Prüfzahlen, offene Abnahmen (Mac-Finder-Doppelklick, ggf. Mac-`Info.plist`), Hinweis „nach Release mergen“.
- [ ] **Step 5: Release im Fenster 18:00–06:00.** Nach Owner-OK: Changelog-Commit `[skip ci]` auf `main`, DANN Tag `presenter-v0.12.0` auf den Release-Commit pushen (CI baut und setzt `latestVersion`). Lauf und Release-Assets (win-exe + 2 Mac-dmg) prüfen, Katalog `latestVersion` 0.12.0 auf `main` nachlesen. PR erst danach mergen (Owner).
