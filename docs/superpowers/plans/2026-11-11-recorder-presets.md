# Recorder 0.9.0 — Presets, Import/Export, Loopback-Stille Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aufnahme-Einstellungen als benannte Presets speichern, anwenden, löschen, als Datei zwischen PCs tragen — und Aufnahmen von „[Loopback]“-Eingängen in Echtzeitlänge schreiben, auch wenn Windows in der Stille nichts liefert.

**Architecture:** Reine Regeln (Normieren, Vergleichen, Namen, Zusammenführen, Dateiformat) in `src/shared/presets.ts`; Ablage + Import-Ablauf im Main (`src/main/presets.ts`, Dialoge in `ipc.ts`); der Renderer-Store wendet an und merkt sich das aktive Preset in der vorhandenen Einstellungsdatei (#291). Stille-Auffüllung: eine reine Uhr (`src/main/stille.ts`) plus Wächter-Intervall in `recorder.ts`, nur für Eingänge mit „[Loopback]“ im Namen.

**Tech Stack:** Electron 33 + electron-vite, React 18 + zustand 4, TypeScript; Selbsttests mit `tsx` im `ck()`-Muster (`apps/recorder/test/*.test.ts`), Attrappe statt `@jm/audio`.

**Spec:** Owner-Beschreibung, im Chat freigegeben 11.11.2026 20:04/20:06 (kein eigenes Dokument) — hier wörtlich zusammengefasst:
- Preset = alles außer Startzeit: Eingang (Gerät + Treiber), Kanäle, Samplerate, Zielordner, Dateiname, Einzelspuren, Verstärkung, Dauer.
- Zeile ganz oben: `Preset: [▾]  [Als Preset speichern…]  [Löschen]  [⋯]`. Auswählen setzt alle Felder. Danach geändert → „Name (geändert)“. Speichern unter vorhandenem Namen fragt vor dem Überschreiben.
- Während einer Aufnahme ist die Auswahl gesperrt. Offener Eingang + anderes Gerät/Kanäle/Samplerate → Eingang schließen und mit den neuen Werten neu öffnen.
- Gerät des Presets fehlt → derselbe Hinweis wie beim Neustart; es bleibt vorgemerkt, bis es auftaucht.
- Keine mitgelieferten Presets.
- Export: „⋯“ → „Presets exportieren…“ speichert ALLE in eine Datei (`Recorder-Presets.jmrec-presets`). Import: fügt hinzu; Namensgleichheit → einmal fragen „Überschreiben“ / „Beide behalten“ („Name (2)“).
- Auf dem anderen PC: Gerät über Name + Treiber; Zielordner fehlt → Hinweis beim Anwenden („neuen Ordner wählen und Preset neu speichern“). Datei wird geprüft, Werte begrenzt; kaputte/fremde Datei → verständliche Meldung, nichts überschrieben.
- System-Sound: „… [Loopback]“-Eingänge liefern in Stille nichts (gemessen 3 s → 0,00 s). Lücken mit echter Stille auffüllen; andere Geräte unberührt.
- Release als Recorder 0.9.0: heute, wenn fertig; sonst 12.11. 18:00.

## Global Constraints

- Version `0.9.0` in `apps/recorder/package.json` und `package-lock.json`.
- Alle UI-Texte Deutsch, typografische Anführungszeichen „…“; in `changelog.json` NIE ASCII-`"` in Notes.
- Preset-Ablage: `join(app.getPath('userData'), 'recorder-presets.json')`, Inhalt `{ "version": 1, "presets": RecPreset[] }`, atomar (tmp + rename) wie `einstellungen.ts`.
- Exportformat: `{ "format": "jm-recorder-presets", "version": 1, "exportiert": ISO-Zeit, "presets": RecPreset[] }`, Endung `.jmrec-presets`, Importdatei höchstens 1 000 000 Byte.
- Preset-Name: getrimmt, 1–60 Zeichen. Werte laufen IMMER durch `normiereEinstellungen` (Gain −12…24, Samplerate 8000…384000, Kanäle ≥ 1, Dauer ≥ 0, Dateiname ≤ 200).
- Loopback-Erkennung: Gerätename enthält `[Loopback]` (Groß/klein egal). Pause gilt ab `STILLE_PAUSE_MS = 250`, Wächter alle 100 ms.
- Bestehende #291-Tests (80 Prüfungen) bleiben grün; `npm run selftest -w @jm/recorder` unter Node 22 UND 24.
- Dateien sind LF.

## Review Focus

1. Preset anwenden, während eine **geplante** Aufnahme wartet → würde den Plan stillschweigend löschen (disarm räumt Timer). Erwartung: gesperrt wie während der Aufnahme. → Test in Task 3.
2. Importdatei mit Unsinnswerten (Gain 999, Samplerate „abc“, Name 500 Zeichen, doppelte Namen) → begrenzt/gekürzt/erster gewinnt, nie Absturz. → Test in Task 1.
3. Loopback-Aufnahme, die in Stille beginnt UND endet (kein einziger Block) → Datei hat trotzdem die volle Länge. → Test in Task 5.
4. „Beide behalten“, wenn „Name (2)“ schon existiert → „Name (3)“. → Test in Task 1.
5. Preset mit mehr Kanälen als das Gerät hier hat → auf das Gerät begrenzt; Eingang war offen → neu geöffnet mit begrenzter Zahl. → Test in Task 3.

---

### Task 1: Reine Preset-Regeln

**Files:**
- Create: `apps/recorder/src/shared/presets.ts`
- Modify: `apps/recorder/src/shared/types.ts` (Typen), `apps/recorder/src/shared/einstellungen.ts` (Feld `preset`)
- Test: `apps/recorder/test/presets.test.ts` (neu), `apps/recorder/test/einstellungen.test.ts` (1 Prüfung dazu)

**Interfaces:**
- Produces (types.ts):
  - `interface RecPreset { name: string; werte: RecEinstellungen }`
  - `RecEinstellungen.preset?: string` — Name des zuletzt angewandten/gespeicherten Presets (nur Einstellungsdatei, nie in `werte`)
  - `type KonfliktWahl = 'ueberschreiben' | 'beide' | 'abbrechen'`
  - `interface PresetDateiErgebnis { ok: boolean; error?: string; presets?: RecPreset[]; meldung?: string }`
- Produces (presets.ts):
  - `PRESET_NAME_MAX = 60`, `EXPORT_FORMAT = 'jm-recorder-presets'`, `EXPORT_MAX_BYTES = 1_000_000`
  - `presetWerte(raw: unknown): RecEinstellungen` — `normiereEinstellungen` ohne `preset`
  - `normierePreset(raw: unknown): RecPreset | null`
  - `sortiere(liste: RecPreset[]): RecPreset[]` — nach Name, `localeCompare(…, 'de')`
  - `gleicheWerte(a: RecEinstellungen, b: RecEinstellungen): boolean` — Vergleich nach `presetWerte`
  - `freierPresetName(name: string, vergeben: string[]): string`
  - `fuehreZusammen(vorhanden: RecPreset[], neu: RecPreset[], wahl: 'ueberschreiben' | 'beide'): { liste: RecPreset[]; hinzu: number; ersetzt: number }`
  - `baueExportDatei(liste: RecPreset[], jetzt: Date): string`
  - `leseExportDatei(text: string): { presets: RecPreset[]; uebersprungen: number }` — wirft `Error` mit Nutzertext

- [ ] **Step 1: Failing tests** in `test/presets.test.ts` (ck-Muster wie `einstellungen.test.ts`):
  - `presetWerte({ ...voll, preset: 'X', gainDb: 999 })` hat kein `preset`, `gainDb === 24`
  - `normierePreset({ name: '  Dante  ', werte: {...} })?.name === 'Dante'`; Name `''`/`'   '`/Zahl → `null`; Name mit 500 Zeichen → Länge 60
  - `gleicheWerte` true bei gleichem Inhalt in anderer Schlüsselreihenfolge; false bei anderem `sampleRate`; true wenn sich nur `preset` unterscheidet
  - `freierPresetName('A', ['A'])==='A (2)'`; `freierPresetName('A', ['A','A (2)'])==='A (3)'`; `freierPresetName('B', ['A'])==='B'`
  - `fuehreZusammen([A1,B], [A2,C], 'ueberschreiben')` → Namen `['A','B','C']`, A hat Werte von A2, `hinzu===1, ersetzt===1`
  - `fuehreZusammen([A1], [A2], 'beide')` → Namen `['A','A (2)']`, `hinzu===1, ersetzt===0`
  - Rundreise: `leseExportDatei(baueExportDatei([A,B], new Date(0))).presets` gleich `[A,B]`
  - `leseExportDatei('kein json')` wirft, Meldung enthält „keine Recorder-Preset-Datei“; `{"format":"anders",...}` wirft dieselbe; `version: 2` wirft „neueren Recorder-Version“; gültig, aber `presets: []` wirft „keine gültigen Presets“
  - Datei mit `[gut, {name:''}, gut-doppelt-gleicher-Name]` → 1 Preset, `uebersprungen === 2` (erster Name gewinnt)
  - Datei mit `werte: { gainDb: 999, sampleRate: 'abc', channels: -3 }` → `gainDb 24`, kein `sampleRate`, `channels 1`
  - in `einstellungen.test.ts`: `normiereEinstellungen({ preset: 'Dante' }).preset === 'Dante'`, `{ preset: 5 }` → kein Feld
- [ ] **Step 2:** `cd apps/recorder && npx tsx test/presets.test.ts` → FAIL (Modul fehlt)
- [ ] **Step 3: Implement** Typen + `presets.ts` + `preset`-Feld in `normiereEinstellungen` (`string`, nicht leer, auf 60 gekürzt). `gleicheWerte` = `JSON.stringify(presetWerte(a)) === JSON.stringify(presetWerte(b))` (normiere baut Schlüssel in fester Reihenfolge). Fehlertexte:
  - kaputt/fremd: `Die Datei ist keine Recorder-Preset-Datei.`
  - Version > 1: `Die Datei stammt aus einer neueren Recorder-Version – bitte den Recorder aktualisieren.`
  - leer: `Die Datei enthält keine gültigen Presets.`
- [ ] **Step 4:** `npx tsx test/presets.test.ts && npx tsx test/einstellungen.test.ts` → alles ok
- [ ] **Step 5: Commit** `feat(recorder): Preset-Regeln – Normieren, Vergleichen, Namen, Zusammenführen, Dateiformat`

### Task 2: Ablage + Import/Export im Main

**Files:**
- Create: `apps/recorder/src/main/presets.ts`
- Modify: `apps/recorder/src/main/ipc.ts`, `apps/recorder/src/preload/index.ts`, `apps/recorder/src/shared/types.ts` (`JmrecApi`)
- Test: `apps/recorder/test/presets-datei.test.ts` (neu)

**Interfaces:**
- Consumes: Task 1 (`normierePreset`, `sortiere`, `fuehreZusammen`, `leseExportDatei`, `baueExportDatei`, `EXPORT_MAX_BYTES`)
- Produces (main/presets.ts):
  - `ladePresets(datei: string): RecPreset[]` — fehlt/kaputt → `[]`
  - `speicherePresets(datei: string, liste: RecPreset[]): RecPreset[]` — normiert, sortiert, atomar; gibt die gespeicherte Liste zurück
  - `importiere(vorhanden: RecPreset[], text: string, frage: (konflikte: string[]) => Promise<KonfliktWahl>): Promise<PresetDateiErgebnis>`
- Produces (JmrecApi):
  - `presets: { list(): Promise<RecPreset[]>; speichern(p: RecPreset): Promise<RecPreset[]>; loeschen(name: string): Promise<RecPreset[]>; exportieren(): Promise<PresetDateiErgebnis>; importieren(): Promise<PresetDateiErgebnis> }`
  - `ordnerDa(dir: string): Promise<boolean>`
  - IPC-Kanäle: `presets:list`, `presets:speichern`, `presets:loeschen`, `presets:exportieren`, `presets:importieren`, `fs:ordnerDa`

- [ ] **Step 1: Failing tests** `test/presets-datei.test.ts` (tmp-Ordner wie `recorder.test.ts`):
  - `ladePresets(fehlend)` → `[]`; Datei mit Müll → `[]`
  - `speicherePresets` dann `ladePresets` → gleiche Liste, sortiert; keine `.tmp` übrig
  - `importiere([A], datei mit [B])` → `ok`, Namen `[A,B]`, `frage` NICHT aufgerufen, `meldung` enthält „1 Preset importiert“
  - `importiere([A], datei mit [A',C], frage→'beide')` → `frage` bekam `['A']`, Namen `['A','A (2)','C']`
  - `importiere(…, frage→'ueberschreiben')` → A hat Werte von A', `meldung` enthält „1 ersetzt“
  - `importiere(…, frage→'abbrechen')` → `ok:false`, kein `error`
  - `importiere([A], 'Müll', …)` → `ok:false`, `error` enthält „keine Recorder-Preset-Datei“
  - `uebersprungen > 0` → `meldung` enthält „übersprungen“
- [ ] **Step 2:** `npx tsx test/presets-datei.test.ts` → FAIL
- [ ] **Step 3: Implement** `main/presets.ts`; in `ipc.ts` Datei `recorder-presets.json` unter userData, Handler:
  - `speichern`: Liste laden, gleichnamigen ersetzen sonst anhängen, speichern, zurückgeben (Überschreiben-Rückfrage macht die UI)
  - `exportieren`: `dialog.showSaveDialog(win, { defaultPath: 'Recorder-Presets.jmrec-presets', filters: [{ name: 'Recorder-Presets', extensions: ['jmrec-presets'] }] })`, abgebrochen → `{ ok:false }`, sonst schreiben → `{ ok:true, meldung: 'N Presets exportiert: <Pfad>' }`; leere Liste → `{ ok:false, error:'Keine Presets zum Exportieren.' }`
  - `importieren`: `showOpenDialog` (Filter `.jmrec-presets` + „Alle Dateien“), `statSync().size > EXPORT_MAX_BYTES` → `error 'Die Datei ist zu groß für eine Preset-Datei.'`, sonst `importiere(…)` mit `frage` = `showMessageBox(win, { type:'question', buttons:['Überschreiben','Beide behalten','Abbrechen'], defaultId:1, cancelId:2, message:'N Preset(s) gibt es schon: „A“, „B“', detail:'Überschreiben ersetzt die vorhandenen. Beide behalten legt die neuen als „Name (2)“ an.' })`; bei `ok` speichern
  - Meldungstexte: `N Preset(s) importiert` + ` (M ersetzt)` + `, K ungültige übersprungen`
- [ ] **Step 4:** `npx tsx test/presets-datei.test.ts` → ok; `npm run typecheck -w @jm/recorder` → 0 Fehler
- [ ] **Step 5: Commit** `feat(recorder): Presets ablegen, exportieren, importieren (Main + IPC)`

### Task 3: Store — anwenden, speichern, löschen, merken

**Files:**
- Modify: `apps/recorder/src/renderer/src/store/recorder.ts`
- Test: `apps/recorder/test/store.test.ts` (Attrappe um `presets`, `ordnerDa`, `arm`, `disarm` erweitern; `state` per `onState`-Callback setzbar)

**Interfaces:**
- Consumes: Task 1 (`presetWerte`, `gleicheWerte`), Task 2 (`window.jmrec.presets.*`, `window.jmrec.ordnerDa`)
- Produces (RecStore):
  - `presets: RecPreset[]`, `aktivesPreset: string | null`
  - `presetAnwenden(name: string): Promise<void>`
  - `presetSpeichern(name: string): Promise<void>` (überschreibt ohne Rückfrage — die fragt die UI)
  - `presetLoeschen(name: string): Promise<void>`
  - `presetAbwaehlen(): void` — „— kein Preset —“, Werte bleiben
  - `presetsExportieren(): Promise<void>`, `presetsImportieren(): Promise<void>`
- Produces (Modul-Exports): `aktuelleWerte(s: RecStore): RecEinstellungen` (bisher `schnappschuss`, jetzt exportiert, inkl. `preset`), `presetGeaendert(s: RecStore): boolean`

Regeln für `presetAnwenden` (in dieser Reihenfolge):
1. `state.status === 'recording'` oder `state.scheduledStartAt != null` → nur `notice: 'Während einer laufenden oder geplanten Aufnahme lässt sich kein Preset anwenden.'`, sonst nichts.
2. Ordner (nur wenn `werte.dir`), Dateiname, Einzelspuren, Dauer setzen (fehlendes Feld = aktueller Wert bleibt); Gain über `setGain`.
3. `werte.eingang` gefunden → `waehleGemerkt(d, channels, sampleRate)` (begrenzt aufs Gerät). Nicht gefunden → `vorbehalt` setzen, `hinweisEingang: 'Eingang des Presets „<name>“ nicht gefunden: „<Gerät>“ (<Treiber>). Gerät/Treiber starten und „Geräte aktualisieren“ drücken.'`. Kein `eingang` → `setChannels`/`setSampleRate` mit den Preset-Werten.
4. `werte.dir` und `await ordnerDa(dir) === false` → `hinweisOrdner: 'Zielordner des Presets „<name>“ nicht erreichbar: <dir> — neuen Ordner wählen und das Preset neu speichern.'`
5. War `armed` und `deviceIndex`/`channels`/`sampleRate` weichen von vorher ab → `await disarm()` dann `await arm()`; Hinweis ` Eingang neu geöffnet.` an die Meldung.
6. `aktivesPreset = name`, `notice: 'Preset „<name>“ angewendet.'`

`init`: nach `settings.load` → `presets = await presets.list()`; `aktivesPreset = e.preset`, wenn es in der Liste steht, sonst `null`. `aktuelleWerte` schreibt `preset: aktivesPreset ?? undefined` mit (wird gemerkt).

- [ ] **Step 1: Failing tests** (neue Fälle 9–15 in `store.test.ts`):
  - 9: `presetSpeichern('Dante')` → `presets.speichern` mit `{ name:'Dante', werte }` ohne `preset`-Feld, `aktivesPreset==='Dante'`, `presetGeaendert === false`; danach `setFileName('x')` → `presetGeaendert === true`
  - 10: Preset mit FOCUS/8 ch/44100/`E:\\Show`/Gain 3 anwenden bei gewähltem DANTE → `deviceIndex===3, channels===8, sampleRate===44100, dir==='E:\\Show', gainDb===3`, `gain`-Spy zuletzt 3, `presetGeaendert===false`
  - 11 (Review 5): Preset mit FOCUS/32 ch bei `state.status==='armed'` → `channels===8`, `disarm` 1×, `arm` 1× mit `{ device: 3, channels: 8 }`
  - 12: offener Eingang, Preset ändert nur Dateiname → weder `disarm` noch `arm`
  - 13 (Review 1): `state.scheduledStartAt = Date.now()+60000` → `presetAnwenden` ändert nichts, `notice` enthält „geplanten Aufnahme“; dasselbe bei `status==='recording'`
  - 14: Preset-Gerät fehlt → `hinweisEingang` enthält Preset-Namen und Gerätenamen; gemerkt (nach `MERK_MS`) wird das Preset-Gerät; `presetGeaendert===false`
  - 15: `ordnerDa→false` → `hinweisOrdner` enthält den Pfad; `init` mit `e.preset==='Dante'` und Liste `[Dante]` → `aktivesPreset==='Dante'`; mit `e.preset==='Weg'` → `null`
- [ ] **Step 2:** `npx tsx test/store.test.ts` → neue Fälle FAIL, alte ok
- [ ] **Step 3: Implement** nach den Regeln oben; `presetLoeschen` setzt `aktivesPreset=null`, wenn es das gelöschte war; Export/Import setzen `notice` aus `meldung`/`error` (abgebrochen → nichts), Import übernimmt `presets`.
- [ ] **Step 4:** `npm run selftest -w @jm/recorder` → alles ok
- [ ] **Step 5: Commit** `feat(recorder): Presets im Store – anwenden, speichern, löschen, aktives Preset merken`

### Task 4: Preset-Leiste in der Oberfläche

**Files:**
- Create: `apps/recorder/src/renderer/src/components/PresetLeiste.tsx`
- Modify: `apps/recorder/src/renderer/src/views/RecorderView.tsx` (Leiste direkt unter der Kopfzeile, vor den Hinweisen)

**Interfaces:**
- Consumes: Task 3 (Store-Felder/Aktionen, `presetGeaendert`)

Verhalten:
- `<select aria-label="Preset">`: Option `''` = „— kein Preset —“, dann alle Presets; die aktive zeigt `„Name (geändert)“`, wenn `presetGeaendert`. `disabled` bei `loading || status==='recording' || scheduledStartAt != null`. Wahl `''` → `presetAbwaehlen()`, sonst `presetAnwenden(name)`.
- „Als Preset speichern…“ → Inline-Eingabe (vorbelegt mit `aktivesPreset ?? ''`, `maxLength={60}`, Enter = Speichern, Esc = Abbrechen). Name vorhanden → Inline-Rückfrage `„Name“ gibt es schon – überschreiben?` [Überschreiben] [Abbrechen].
- „Löschen“ (`disabled` ohne aktives Preset) → Inline-Rückfrage `Preset „Name“ löschen?` [Löschen] [Abbrechen].
- „⋯“ → kleines Menü: „Presets exportieren…“ (`disabled` bei 0 Presets), „Presets importieren…“; schließt nach Wahl und bei Klick daneben.
- Optik wie die übrigen Karten (`Card`, `Button size="sm" variant="outline"`, Feldklassen aus `RecorderView`).

- [ ] **Step 1:** Komponente + Einbau
- [ ] **Step 2:** `npm run typecheck -w @jm/recorder` → 0 Fehler; `npm run build -w @jm/recorder` → ok
- [ ] **Step 3:** Prüfstand (Task 6) deckt das Verhalten ab — hier nur Build
- [ ] **Step 4: Commit** `feat(recorder): Preset-Leiste – Auswahl, Speichern, Löschen, Export/Import`

### Task 5: Loopback-Stille auffüllen

**Files:**
- Create: `apps/recorder/src/main/stille.ts`
- Modify: `apps/recorder/src/main/recorder.ts`
- Test: `apps/recorder/test/stille.test.ts` (neu), `apps/recorder/test/recorder.test.ts` (2 Fälle)

**Interfaces:**
- Produces (stille.ts):
  - `STILLE_PAUSE_MS = 250`, `STILLE_TAKT_MS = 100`
  - `istLoopback(name: string): boolean`
  - `class StilleUhr { constructor(sampleRate: number, startMs: number); block(frames: number, jetztMs: number): number; fehlend(jetztMs: number): number; aufgefuellt(frames: number): void }`
    - `block` meldet einen echten Block und gibt zurück, wie viele Stille-Frames VOR ihm fehlen: `0`, wenn seit dem letzten Block (bzw. Start) < `STILLE_PAUSE_MS` vergingen; sonst `max(0, erwartet(jetzt) − frames − geschrieben)`; zählt danach `frames` dazu
    - `fehlend` (Wächter/Stopp): `0` während Blöcke fließen; sonst `max(0, erwartet(jetzt) − geschrieben)`
    - `erwartet(t) = floor((t − startMs) / 1000 × sampleRate)`

recorder.ts:
- `arm`: Name über `engine().listDevices()` nachschlagen → `loopback = istLoopback(name)`; wenn ja, Wächter `setInterval(STILLE_TAKT_MS)`.
- `startRecording`: `uhr = loopback ? new StilleUhr(sampleRate, Date.now()) : null`.
- `onFrames` (Aufnahme): vor dem Schreiben `n = uhr.block(frames, Date.now())`, `n > 0` → `schreibeStille(n)`.
- Wächter: wenn `Date.now() − letzterBlock ≥ STILLE_PAUSE_MS`: Pegel `0` senden; bei Aufnahme `schreibeStille(uhr.fehlend(now))` + `emitState()`.
- `stopRecording`/`disarm` (vor `finalize`): `schreibeStille(uhr.fehlend(now))`.
- `schreibeStille(n)`: in Stücken ≤ 1 s Nullen an `writer` und `multiWriter`, `recordedSec` mitzählen, `uhr.aufgefuellt`.
- `disarm` räumt Wächter und Uhr.

- [ ] **Step 1: Failing tests** `stille.test.ts` (reine Uhr, Zeiten von Hand):
  - `istLoopback('Lautsprecher (Realtek) [Loopback]')`, nicht `'Mikrofon (Realtek)'`
  - sr 1000, Start 0: `block(10, 10)===0`; Blöcke alle 10 ms bis 1000 → nie > 0; `fehlend(1005)===0`
  - Pause: letzter Block bei 1000 (gesamt 1000 Frames), `fehlend(1300)===300`, nach `aufgefuellt(300)` → `fehlend(1350)===50`; dann `block(10, 2000)` → `990`
  - Kein Block je (Review 3): `fehlend(600)===600`
  - Uhr vorgehend (mehr geschrieben als erwartet) → nie negativ
  - `recorder.test.ts`: Attrappe `listDevices` liefert Gerät 5 „Lautsprecher (Realtek) [Loopback]“ und Gerät 0 „Mikrofon“; Loopback, sr 1000, 2 ch: 1 Block (10 Frames), 700 ms echt warten, 1 Block, Stopp → Datenlänge / 8 zwischen 650 und 800 Frames; dasselbe mit Gerät 0 → genau 20 Frames
- [ ] **Step 2:** `npx tsx test/stille.test.ts` → FAIL
- [ ] **Step 3: Implement** wie oben
- [ ] **Step 4:** `npm run selftest -w @jm/recorder` → alles ok; Selftest-Skript um `presets.test.ts`, `presets-datei.test.ts`, `stille.test.ts` erweitert; CI-Schritt-Name in `ci-checks.yml` → `Recorder (Folgedateien, Überschreibschutz, Einstellungen, Presets, Loopback-Stille)`
- [ ] **Step 5: Commit** `feat(recorder): Loopback-Eingänge – Stille in Echtzeit auffüllen`

### Task 6: Prüfstand, Version, Release

**Files:**
- Modify: `apps/recorder/package.json` + `package-lock.json` (0.9.0), `packages/suite-manifest/{suite.json,changelog.json}` (eigener Commit auf Release-Branch, wie 0.8.0)

- [ ] **Step 1:** Selftest unter Node 22 (`npx -y node@22`) und 24; `npm run typecheck -w @jm/recorder`
- [ ] **Step 2:** Gepackte App (`PORTAUDIO_DLL=C:/Users/alexk/alexzvn/portaudio/build/Release/portaudio.dll npm run dist:win -w @jm/recorder`), CDP-Prüfstand (Scratchpad `szenario.mjs` erweitern; ohne `ELECTRON_RUN_AS_NODE`): Preset speichern → „(geändert)“ → anwenden → Neustart behält aktives Preset → Löschen; Export/Import mit Dialog-Attrappe über Main-Inspector (`--inspect`, `dialog.showSaveDialog/showOpenDialog/showMessageBox` ersetzen); Loopback-Eingang 5 s in Stille aufnehmen → Datei ≈ 5 s
- [ ] **Step 3:** Review durch frischen Subagent (ganzer Branch)
- [ ] **Step 4:** Version 0.9.0, Changelog-Text zur Owner-Freigabe, PR
- [ ] **Step 5:** Release: Tag `recorder-v0.9.0`, Installer hochladen, veröffentlichen + Manifest auf main — heute nach Owner-OK der Notes, sonst Windows-Aufgabe 12.11. 18:00 nach Muster `freigabe.ps1`
