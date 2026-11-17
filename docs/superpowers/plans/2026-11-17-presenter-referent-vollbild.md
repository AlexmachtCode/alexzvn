# Presenter: Referentenansicht im Vollbild (#309) – Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Referentenansicht des Presenters lässt sich per Knopf und F11 ins echte Vollbild schalten (Taskleiste verdeckt), und der Zustand gilt auch für die nächste Präsentation.

**Architecture:** Ein kleiner, Electron-freier Kern (`src/main/referent-vollbild.ts`) entscheidet über ein schmales Fenster-Interface: anwenden, umschalten, Wechsel merken. `windows.ts` reicht das echte Referentenfenster hinein, `referent-config.ts` speichert `{ vollbild }` in `userData`. IPC + Preload geben Umschalten, Abfrage und Push an die Referentenansicht; dort sitzen Knopf und F11.

**Tech Stack:** Electron 33.4.11, React 18, TypeScript; Tests mit `tsx` (Selbsttest) und dem CDP-Prüfstand `test/pruefstand.mjs` gegen das gepackte Programm.

**Spec:** `docs/superpowers/specs/2026-11-17-presenter-referent-vollbild-design.md`

## Global Constraints

- Echtes Vollbild über `BrowserWindow.setFullScreen` – kein Kiosk-Modus, keine HTML-Fullscreen-API.
- Escape bleibt „Präsentation beenden“ (`usePresenterKeys`), unverändert.
- Gespeichert wird in `userData/referent-config.json` als `{ "vollbild": boolean }`; fehlt die Datei oder ist sie kaputt, gilt `vollbild: false`.
- Gemerkt wird nur bei einem echten Wechsel (`enter-full-screen`/`leave-full-screen`), nie durch das Schließen des Fensters.
- Beschriftungen: neuer Knopf „Vollbild“ (Referentenfenster), bisheriger Knopf „Publikum Vollbild“ (Wirkung unverändert).
- Arbeitsordner ist der Worktree `C:/Users/alexk/alexzvn/.claude/worktrees/presenter-vollbild-309`; `npm` nur dort und mit großem Laufwerksbuchstaben `C:` starten (sonst startet Vitest/npm in der Hauptkopie bzw. bricht ab).
- Frischer Worktree (17.11.): `npm ci` hat das NDI-Addon gebaut, aber Electrons Installskript nicht ausgeführt (`node_modules/electron/dist` fehlt). Paketieren geht trotzdem (electron-builder lädt Electron selbst); wer Electron direkt starten will, nimmt `.claude/worktrees/presenter-ndi-303/node_modules/electron/dist/electron.exe` (33.4.11).
- Gemessen (Electron 33.4.11, Windows): Das Standardmenü belegt F11 mit `togglefullscreen`. Ein Renderer-`keydown` mit `preventDefault()` unterdrückt das Menü (genau ein Umschalten). Beim Schließen eines Vollbildfensters kommt kein `leave-full-screen` (Windows; Mac ungeprüft).

## Review Focus

1. **Beenden im Vollbild** (■ Beenden oder Escape): Der gemerkte Zustand bleibt `true`; die nächste Präsentation öffnet im Vollbild. → Task 1 (Kern: `close` dann `leave-full-screen` speichert nichts) und Task 2 (Prüfstand: Escape im Vollbild, neu starten).
2. **F11 schaltet genau einmal** trotz F11 im Standardmenü. → Task 2 (Prüfstand: F11 aus, F11 an).
3. **Kaputte oder fehlende `referent-config.json`** → kein Vollbild, kein Absturz. → Task 1 (`normiereReferentConfig`).
4. **Taskleiste wirklich verdeckt**, nicht nur „maximiert“. → Task 2 (Prüfstand: `innerWidth/innerHeight` = `screen.width/height`).
5. **Knopf zeigt den echten Zustand**, auch nach F11 oder einem Wechsel durch das System. → Task 1 (`melde` bei jedem Wechsel) und Task 2 (Prüfstand: Knopf hervorgehoben nach F11).

---

### Task 1: Kern und Speicher

**Files:**
- Create: `apps/presenter/src/main/referent-vollbild.ts`
- Create: `apps/presenter/src/main/referent-config.ts`
- Modify: `apps/presenter/src/shared/types.ts` (neben `TimerSyncConfig`)
- Create: `apps/presenter/test/referent-vollbild.test.ts`
- Modify: `apps/presenter/package.json` (Skript `selftest`: `&& tsx test/referent-vollbild.test.ts` anhängen)

**Interfaces:**
- Produces (`types.ts`): `export interface ReferentConfig { vollbild: boolean }`
- Produces (`referent-vollbild.ts`, nur `import type`, kein Electron zur Laufzeit):
  - `export interface VollbildFenster { isFullScreen(): boolean; setFullScreen(an: boolean): void; isDestroyed(): boolean; on(e: 'enter-full-screen', fn: () => void): unknown; on(e: 'leave-full-screen', fn: () => void): unknown; on(e: 'close', fn: () => void): unknown; }` – so geschnitten, dass ein echtes `BrowserWindow` ohne Cast passt (`typecheck:node` beweist es in Task 2).
  - `export interface VollbildSpeicher { lade(): ReferentConfig; speichere(c: ReferentConfig): void }`
  - `export function normiereReferentConfig(roh: unknown): ReferentConfig`
  - `export function referentVollbildAnwenden(win: VollbildFenster, speicher: VollbildSpeicher): void`
  - `export function referentVollbildVerdrahten(win: VollbildFenster, speicher: VollbildSpeicher, melde: (an: boolean) => void): void`
  - `export function referentVollbildUmschalten(win: VollbildFenster | null): boolean`
  - `export function referentVollbildStand(win: VollbildFenster | null): boolean`
- Produces (`referent-config.ts`): `loadReferentConfig(): ReferentConfig`, `saveReferentConfig(c: ReferentConfig): void` – Datei `referent-config.json` in `app.getPath('userData')`, Muster und Fehlerbehandlung wie `src/main/timer-config.ts` (Lesen → `normiereReferentConfig`, Fehler → `{ vollbild: false }`; Schreiben in try/catch, Fehler still).

- [ ] **Step 1: Failing test schreiben** – `test/referent-vollbild.test.ts` im Stil von `test/nur-ndi.test.ts` (`ck`, `eq`, Summe, Exit 1 bei FAIL). Attrappe `Fenster`: hält `voll`, `zerstoert`, eine Liste der `setFullScreen`-Aufrufe und Zuhörer je Ereignis; `setFullScreen(an)` setzt `voll` und ruft bei echtem Wechsel sofort die Zuhörer von `enter-full-screen` bzw. `leave-full-screen`; `feuere(e)` ruft Zuhörer von Hand. Speicher-Attrappe zählt `speichere`-Aufrufe. Fälle:
  - `normiereReferentConfig(undefined | null | 42 | [] | {} | { vollbild: 'true' } | { vollbild: 1 })` → `{ vollbild: false }`; `({ vollbild: true })` → `{ vollbild: true }`.
  - Anwenden: gemerkt `true` → genau ein `setFullScreen(true)`; gemerkt `false` → kein Aufruf; zerstörtes Fenster mit gemerkt `true` → kein Aufruf.
  - Verdrahten: `feuere('enter-full-screen')` → `speichere({vollbild:true})` und `melde(true)`; danach `feuere('leave-full-screen')` → `speichere({vollbild:false})` und `melde(false)`.
  - Verdrahten, Schließen: `feuere('close')`, dann `feuere('leave-full-screen')` → kein `speichere`, kein `melde`.
  - Umschalten: `null` → `false`, nichts passiert; zerstört → `false`, kein `setFullScreen`; normal aus → liefert `true`, Fenster voll; nochmal → liefert `false`, Fenster nicht voll.
  - Stand: `null` → `false`; zerstört → `false`; volles Fenster → `true`.
  - Ende-zu-Ende des Kerns: verdrahten + umschalten (an) → Speicher hat `{vollbild:true}`; neues Fenster mit diesem Speicher anwenden → voll.

- [ ] **Step 2: Test laufen lassen, er muss scheitern**
  Run: `cd "C:/Users/alexk/alexzvn/.claude/worktrees/presenter-vollbild-309/apps/presenter" && npx tsx test/referent-vollbild.test.ts`
  Expected: Abbruch beim Import (`referent-vollbild` fehlt).

- [ ] **Step 3: `ReferentConfig`, `referent-vollbild.ts` und `referent-config.ts` schreiben** (Signaturen oben). `referentVollbildVerdrahten` merkt sich `close` in einer lokalen Variablen und ignoriert danach `leave-full-screen`. `referentVollbildUmschalten` setzt `!isFullScreen()` und gibt diesen Wert zurück.

- [ ] **Step 4: Test laufen lassen, er muss bestehen** – gleicher Befehl, Expected: nur `ok`-Zeilen, Exit 0. Dann `npm run selftest` (alle bisherigen Tests weiter grün) und `npm run typecheck`.

- [ ] **Step 5: Commit** – `git add` mit den fünf Pfaden einzeln, `git status --short` lesen, Commit `feat(presenter): Kern für Vollbild der Referentenansicht, gemerkt in referent-config.json (#309)`.

### Task 2: Fenster, IPC, Referentenansicht und Prüfstand

**Files:**
- Modify: `apps/presenter/src/main/windows.ts` (`openPresenterWindow`, neue Exporte)
- Modify: `apps/presenter/src/main/ipc.ts` (bei `present:toggleAudienceFullscreen`)
- Modify: `apps/presenter/src/preload/index.ts` (`present`-Block)
- Modify: `apps/presenter/src/shared/types.ts` (`present`-API)
- Modify: `apps/presenter/src/renderer/src/views/PresenterView.tsx`
- Modify: `apps/presenter/test/pruefstand.mjs` (neue Gruppe `vollbild`, in `GRUPPEN` eintragen)
- Modify: `apps/presenter/README.md` (Tastenliste bzw. Abschnitt Referentenansicht: F11, Knopf „Vollbild“, gemerkt)

**Interfaces:**
- Consumes: alles aus Task 1.
- Produces (`windows.ts`): `export function toggleReferentVollbild(): boolean` (= `referentVollbildUmschalten(presenterWindow)`), `export function getReferentVollbild(): boolean` (= `referentVollbildStand(presenterWindow)`). In `openPresenterWindow`: Speicher `{ lade: loadReferentConfig, speichere: saveReferentConfig }`; `referentVollbildVerdrahten(win, speicher, an => win.webContents.send('present:referentVollbildStand', an))` (nur solange nicht zerstört); in `ready-to-show` nach `win.show()` `referentVollbildAnwenden(win, speicher)`.
- Produces (IPC): `ipcMain.handle('present:toggleReferentVollbild', …)` → `boolean`; `ipcMain.handle('present:referentVollbild', …)` → `boolean`; Push-Kanal `present:referentVollbildStand` (`boolean`).
- Produces (Preload/Typen, `present`): `toggleReferentVollbild: () => Promise<boolean>`, `referentVollbild: () => Promise<boolean>`, `onReferentVollbild: (cb: (an: boolean) => void) => () => void` (Muster wie `onState`).

- [ ] **Step 1: Failing Prüfstand-Gruppe `vollbild` schreiben** – eigenes Profil (`eigenesProfil(path.join(d.dir, 'profil-vollbild'))`), Präsentation starten wie in `gruppeNavigation` (ablegen `d.a`, ▶ Präsentieren, `oeffneZiel(app, 'view=presenter')`). Hilfen: `domVollbildMass()` → `innerWidth === screen.width && innerHeight === screen.height`; F11 per `Input.dispatchKeyEvent` (`rawKeyDown`/`keyUp`, `key: 'F11'`, `code: 'F11'`, `windowsVirtualKeyCode: 122`), analog `drueckeEscape`. Fälle:
  1. Knöpfe: Kopf hat „Publikum Vollbild“ und „Vollbild“ (`domKnoepfe`).
  2. Knopf „Vollbild“ klicken → `referentVollbild()` = `true` und `domVollbildMass()` = `true` (Taskleiste verdeckt); Knopf hervorgehoben (aktive Klasse wie bei „Übersicht“).
  3. Einmal F11 → `false`, Maß `false`, Knopf nicht hervorgehoben; nochmal F11 → `true` (genau ein Umschalten je Druck).
  4. `referent-config.json` im Profil-`userData` enthält `"vollbild": true`.
  5. Escape im Vollbild → Präsentation endet; Datei weiter `true`; ▶ Präsentieren → neue Referentenansicht ist im Vollbild (`referentVollbild()` und Maß).
  6. App beenden, mit demselben Profil neu starten, präsentieren → Referentenansicht im Vollbild.
  7. Knopf „Vollbild“ aus, Präsentation beenden, neu präsentieren → normales Fenster (`false`, Maß `false`).

- [ ] **Step 2: Gegen das bisherige Paket laufen lassen, die Gruppe muss scheitern**
  Run (PowerShell, im Worktree `apps/presenter`): `$env:CSC_IDENTITY_AUTO_DISCOVERY="false"; npm run dist:dir -- -c.electronVersion=33.4.11 -c.npmRebuild=false; node test/pruefstand.mjs --nur vollbild`
  Expected: FAIL bei Fall 1 (Knopf „Publikum Vollbild“ fehlt) und den folgenden.

- [ ] **Step 3: `windows.ts`, IPC, Preload und Typen** wie unter Interfaces.

- [ ] **Step 4: `PresenterView.tsx`** – Zustand `vollbild` aus `referentVollbild()` beim Laden und `onReferentVollbild` (Aufräumen beim Abbau); eigener `keydown`-Effekt nur hier (nicht in `usePresenterKeys`, das auch das Publikum nutzt): `F11` → `preventDefault()` + `toggleReferentVollbild()`. Kopf: bisheriger Knopf heißt „Publikum Vollbild“ (sonst unverändert, auch der Tooltip bei „nur NDI“); neuer `HeaderBtn` „Vollbild“ direkt dahinter, `active={vollbild}`, `title="Referentenansicht im Vollbild (F11)"`.

- [ ] **Step 5: README** – F11 und Knopf „Vollbild“ der Referentenansicht ergänzen, mit dem Hinweis, dass der Zustand gemerkt wird und Escape weiter die Präsentation beendet.

- [ ] **Step 6: Prüfen** – `npm run typecheck`, `npm run selftest`, neu paketieren (Befehl aus Step 2), `node test/pruefstand.mjs --nur vollbild` → alle Fälle `ok`; dann `node test/pruefstand.mjs --nur navigation` als Regressionswache (Referentenfenster).

- [ ] **Step 7: Commit** – Pfade einzeln, `git status --short`, Commit `feat(presenter): Referentenansicht per Knopf und F11 im Vollbild, „Publikum Vollbild“ (#309)`.

### Task 3: Version 0.13.1 und Changelog-Entwurf

**Files:**
- Modify: `apps/presenter/package.json` (`version` → `0.13.1`), `package-lock.json` (nur der Eintrag `apps/presenter`)
- Modify: `packages/suite-manifest/changelog.json` (Eintrag `presenter` `0.13.1`, Datum des Releases) – **Texte vorher dem Owner vorlegen**, typografische Anführungszeichen „…“, nie ASCII-`"` im Text; JSON vor dem Commit mit `node -e "JSON.parse(require('fs').readFileSync('packages/suite-manifest/changelog.json','utf8'))"` prüfen.

- [ ] **Step 1:** Version setzen, `npm run selftest` (enthält `release-weg.test.ts`) grün.
- [ ] **Step 2:** Changelog-Text als Entwurf im Chat vorlegen; erst nach Freigabe eintragen und committen (`chore(release): presenter 0.13.1 (#309)`).

## Auslieferung (nicht Teil der Tasks, je Schritt mit Owner-OK, nur im Fenster 18–06 Uhr)

Reihenfolge laut `apps/presenter/README.md` „Release-Weg“: Branch pushen + PR → Changelog auf main → Tag `presenter-v0.13.1` einzeln pushen (Mac-CI baut beide DMGs) → Windows-exe lokal mit NDI bauen (`npm run dist:win -- --publish never`) und mit `gh release upload` anhängen → `node scripts/bump-manifest.mjs presenter 0.13.1` auf main → PR mergen, #309 schließen.
