# Presenter 0.13.0: NDI-Ausgang mit Alphakanal (#303). Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Der Presenter gibt sein Publikumsbild zusätzlich als NDI-Quelle „JM Presenter“ aus (1920×1080, 25 fps, BGRA mit straight alpha, nur Windows): freie Ränder transparent, Schalter gemerkt, auf Wunsch ganz ohne Publikumsfenster („Keiner – nur NDI“).

**Architecture:** Ein verstecktes Fenster (`?view=ndi`, ohne React) zeichnet das Publikumsbild ein zweites Mal auf ein 1920×1080-Canvas, nur bei Änderungen und während einer Überblendung im 40-ms-Takt, und schickt BGRA über einen MessagePort (Main als Brücke, Titler-Muster) an einen Utility-Prozess. Der hält das letzte Bild und gibt es driftfrei mit 25 fps an `@jm/ndi`. Welche Folie, welche Pause, welcher Übergang mit welcher Dauer entscheiden reine Funktionen in `src/shared/publikumsbild.ts`, die Publikumsansicht und NDI-Ansicht beide aufrufen; sonst bleibt die Publikumsansicht unberührt. `src/main/ndi/ausgang.ts` hält Schalter (userData-JSON), Fenster- und Senderleben, Empfängerzahl und Fehlerzustand. Windows-Installer lokal mit gebündeltem NDI, Mac-Paket per CI ohne NDI.

**Tech Stack:** Electron 33.4.11, electron-vite 2 (zusätzlicher Main-Entry `ndi-sender`), React 18, TypeScript; natives `@jm/ndi` (N-API, Sender mit `clock_video`); Selbsttests mit `tsx` im `ck()`-Muster, Attrappen per `registerHooks` (`apps/presenter/test/*.test.ts`); CDP-Prüfstand gegen die gepackte App mit echtem NDI-Empfang; electron-builder 24.13.3; GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-14-presenter-ndi-ausgang-design.md` (Owner-Freigabe 14.11.2026, Ansatz B). Beide Dokumente lesen.

Arbeitsordner (legt Task 1 an): `C:\Users\alexk\alexzvn\.claude\worktrees\presenter-ndi-303`, im Plan **WT**; App-Ordner **WT/apps/presenter**. Alle Befehle dort, nie in der Hauptkopie `C:\Users\alexk\alexzvn`.

## Global Constraints

- NDI-Quelle: Name `JM Presenter` (das SDK ergänzt den Rechnernamen), 1920×1080, 25 fps: `sendVideoBGRA(buf, 1920, 1080, 25, 1)`, BGRA straight alpha, nur Windows. Keine adaptive Bildrate, keine Einstellungen für Name/Auflösung/Bildrate, kein Ton, kein Video, kein Companion-Befehl.
- Inhalt = Publikumsbild: eingepasst wie `SlideCanvas` im Publikumsfenster (verkleinern, nie vergrößern, mittig), Overlays, Schnitt/Überblendung. Freie Ränder transparent, PNG-Alpha bleibt, PDF-/PowerPoint-Folien deckend weiß. Pause Schwarz → vollständig transparent; Weiß → weiß; nichts geöffnet / gestoppt → vollständig transparent.
- `AudienceView.tsx` wird nicht umgebaut: Sie bekommt nur die Entscheidungen aus `src/shared/publikumsbild.ts`; CSS-Stapel, Zeiten und Sicherungen bleiben.
- `@jm/ndi` lädt nur der Utility-Einstieg `src/utility/ndi-sender.ts`, per `require('@jm/ndi')` in einem Lade-Rückruf, den der Kern im `try` aufruft (Muster `apps/connect/src/utility/ndi-guest-sender.ts`). Kein `import('@jm/ndi')`: Rollup 4 lässt externe `import()` im CJS-Bündel als echtes ESM-`import()` stehen (`dynamicImportInCjs`, Vorgabe `true`), und das liefert vom Lader (`module.exports` = Addon) nur `default`. Nirgends sonst ein Wert-Import (`import type` ist erlaubt). Das Mac-Paket baut und startet ohne NDI.
- Schalter: Vorgabe aus; Zustand in `userData/ndi-config.json` (`{ "an": boolean }`); ist er an, entstehen Sender und NDI-Fenster ab App-Start, unabhängig von Projekt und Präsentation.
- Fehlerfall (Addon/Laufzeit fehlt, Sender endet): kein Absturz, kein Dialog; Schalter „NDI nicht verfügbar“, eine Log-Zeile `[ndi] …`, Präsentation und Bildschirm laufen weiter.
- Wert-Importe aus `src/shared` in Main, Utility und Renderer relativ (`../shared/…`, `../../shared/…`, `../../../shared/…`); `@shared/…` nur für `import type`. Sonst finden die tsx-Selbsttests das Modul nicht.
- Takt im NDI-Fenster und im Utility-Prozess mit `setTimeout`, nie `requestAnimationFrame` (verstecktes Fenster; Titler-Lehre). Ein Wurf im Takt darf den Takt nicht beenden.
- Texte und Kommentare Deutsch, Umlaute wörtlich (keine `\uXXXX`-Escapes: Edit/Write dekodieren sie), typografische Anführungszeichen „…“.
- Selbsttests: `npm run selftest -w @jm/presenter` unter Node 22 UND 24 grün; neue Tests als `.ts` über `tsx` im `ck()`-Muster; CI ruft genau dieses Skript. Keine neuen typlosen `.js`.
- Version `0.13.0` (erst Task 9). Release nur 18:00–06:00 Berlin und erst nach Owner-Freigabe der Notes. In `packages/suite-manifest/changelog.json` nie ASCII-`"` in Notes; JSON vor jedem Commit per `JSON.parse` prüfen.
- Kein Test ersetzt oder deinstalliert den installierten Presenter; der Prüfstand startet die App nur mit eigenem `USERPROFILE` und bricht ab, wenn schon ein Presenter läuft.
- Commits: nur explizite Pfade stagen, nach jedem `git add` `git status --short` lesen; jede Nachricht endet mit `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **App schließen bei NDI an.** Das versteckte NDI-Fenster hielte den Prozess am Leben (kein `window-all-closed`, Single-Instance-Lock bleibt, NDI sendet weiter). Erwartet: Schließt das letzte sichtbare Fenster, schließt das NDI-Fenster mit, die App endet. → Code Task 4, Prüfstand-Fälle 11 und 14 in Task 8.
2. **Zweite Instanz / PDF-Doppelklick bei geschlossenem Editor** darf das unsichtbare NDI-Fenster nicht nach vorn holen (`second-instance` nimmt heute `getAllWindows()[0]`). → Code Task 4, Prüfstand-Fall 14 in Task 8.
3. **NDI einschalten, während eine Präsentation läuft:** NDI zeigt die laufende Folie, nicht Transparenz. → Selbsttest Task 4 (Payload-Weitergabe), Prüfstand-Fall 13 in Task 8.
4. **Schnelles Weiterklicken während Überblendungen:** NDI endet auf derselben Folie wie der Bildschirm, keine alte Schicht bleibt stehen. → Selbsttest Task 5 (Zeichenplan mit drei Schichten) plus Gleichlauf-Prüfung Task 2/5.
5. **NDI fällt aus oder wird ausgeschaltet, während „Keiner – nur NDI“ läuft:** Präsentation läuft weiter, der nächste Start nimmt wieder den gewählten Bildschirm. → Selbsttest Task 7 (`startZielFuer`, `pruefeStartZiel`), Prüfstand-Fall 9 in Task 8.

---

### Task 1: Arbeitsplatz und Dokumente

**Files:**
- Create: `docs/superpowers/specs/2026-11-14-presenter-ndi-ausgang-design.md`
- Create: `docs/superpowers/plans/2026-11-14-presenter-ndi-ausgang.md`

**Interfaces:**
- Consumes: nichts.
- Produces: Worktree WT auf `feat/presenter-ndi-303` (von `origin/main`) mit eigenem `node_modules` und gebautem `packages/ndi/build/Release/jm_ndi.node`.

- [ ] **Step 1: Worktree anlegen.** In der Hauptkopie (dort nichts auschecken): `git -C C:/Users/alexk/alexzvn fetch origin`, dann `git -C C:/Users/alexk/alexzvn worktree add -b feat/presenter-ndi-303 C:/Users/alexk/alexzvn/.claude/worktrees/presenter-ndi-303 origin/main`. Expected: „Preparing worktree (new branch 'feat/presenter-ndi-303')“.
- [ ] **Step 2: Mit NDI-SDK installieren.** In WT (PowerShell): `Test-Path "$env:NDI_SDK_DIR\Bin\x64\Processing.NDI.Lib.x64.dll"` → `True` (sonst Owner fragen, nicht raten), dann `npm ci`. Expected: Exit 0 und die Zeile `[@jm/ndi] NDI-SDK gefunden (…) — baue natives Addon …`.
- [ ] **Step 3: Worktree-Falle ausschließen.** In WT/apps/presenter: `node -p "require.resolve('@jm/ndi/package.json')"` und `node -p "require.resolve('electron/package.json')"`. Expected: beide beginnen mit `C:\Users\alexk\alexzvn\.claude\worktrees\presenter-ndi-303\node_modules\`. Zeigt einer auf `C:\Users\alexk\alexzvn\node_modules\`, testet man die alte Hauptkopie → STOPP, Installation in WT reparieren. Dazu `Test-Path ..\..\packages\ndi\build\Release\jm_ndi.node` → `True` (sonst `npm run rebuild -w @jm/ndi`).
- [ ] **Step 4: Ausgangsstand messen.** In WT: `npm run selftest -w @jm/presenter` → jede Datei „0 FAIL“ (Zahlen notieren); `npm run typecheck -w @jm/presenter` → keine Fehler.
- [ ] **Step 5: Dokumente ablegen, Commit.** Den Entwurf `C:\Users\alexk\AppData\Local\Temp\claude\5dcb13dfa9326af2\e776f323-90b6-41ce-8459-49af4e6ed967\scratchpad\2026-11-14-presenter-ndi-ausgang-design.md` und diesen Plan (`…\scratchpad\2026-11-14-presenter-ndi-ausgang.md`) unverändert an die zwei Zielpfade kopieren. `git add` beider Pfade, `git status --short` (genau zwei `A`), Commit `docs(presenter): Entwurf und Plan NDI-Ausgang (#303)`.

---

### Task 2: Gemeinsame Entscheidungen des Publikumsbilds

**Files:**
- Create: `apps/presenter/src/shared/publikumsbild.ts`
- Modify: `apps/presenter/src/renderer/src/views/AudienceView.tsx` (nur Import, `current`, Effekt-Rumpf, die zwei Pausen-Abfragen)
- Create: `apps/presenter/test/publikumsbild.test.ts`
- Modify: `apps/presenter/package.json` (`selftest` bekommt `&& tsx test/publikumsbild.test.ts`)

**Interfaces:**
- Consumes: `uebergangFuer(slide, w)` aus `src/shared/wiedergabe.ts`; Typen `PresentationState`, `Slide`, `Wiedergabe`.
- Produces (`src/shared/publikumsbild.ts`, ohne DOM/Electron):
  - `type BildArt = 'leer' | 'schwarz' | 'weiss' | 'folie'`
  - `type Auflegen = { art: 'leeren' } | { art: 'bleibt' } | { art: 'neu'; slide: Slide; blendeMs: number }`
  - `const MAX_ALTE_SCHICHTEN = 2`
  - `aktuelleFolie(state: PresentationState, slides: readonly Slide[] | null): Slide | null`
  - `bildArt(state: PresentationState, folie: Slide | null): BildArt`
  - `naechsteSchicht(obenId: string | null, folie: Slide | null, w: Wiedergabe): Auflegen`

- [ ] **Step 1: Failing test schreiben** (`test/publikumsbild.test.ts`, `ck()` wie `test/wiedergabe.test.ts`, `folie()`-Helfer von dort, `eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)`):

```ts
const pb = await import('../src/shared/publikumsbild');
const W = { uebergang: { art: 'blende' as const, dauerMs: 800 }, schleife: false, standzeitSek: 10 };
const a = folie('a'), b = folie('b'), c = folie('c', { uebergang: { art: 'schnitt', dauerMs: 500 } });
const live = (index: number, screen: ScreenMode = 'live'): PresentationState => ({ active: true, index, total: 3, screen });
const aus: PresentationState = { active: false, index: 0, total: 0, screen: 'live' };
ck('aktuelle Folie nach Index', pb.aktuelleFolie(live(1), [a, b, c]) === b);
// Bildschirm unverändert (Anti-Ziel): aktuelleFolie wählt wie HEUTE die AudienceView, auch gestoppt.
// „gestoppt → transparent“ entscheidet nur bildArt/ndiFuellung im NDI-Weg.
ck('gestoppt → Folie nach Index wie heute', pb.aktuelleFolie(aus, [a, b, c]) === a);
ck('ohne Folien / Index außerhalb → keine', pb.aktuelleFolie(live(0), null) === null && pb.aktuelleFolie(live(7), [a]) === null);
ck('Schwarzbild', pb.bildArt(live(0, 'black'), a) === 'schwarz');
ck('Weißbild', pb.bildArt(live(0, 'white'), a) === 'weiss');
ck('Folie', pb.bildArt(live(0), a) === 'folie');
ck('keine Folie → leer', pb.bildArt(live(0), null) === 'leer');
ck('gestoppt → leer, auch mit Folie', pb.bildArt(aus, a) === 'leer');
ck('erste Folie ohne Übergang', eq(pb.naechsteSchicht(null, a, W), { art: 'neu', slide: a, blendeMs: 0 }));
ck('gleiche Folie bleibt', pb.naechsteSchicht('a', a, W).art === 'bleibt');
ck('nächste mit Blende des Projekts', eq(pb.naechsteSchicht('a', b, W), { art: 'neu', slide: b, blendeMs: 800 }));
ck('eigener Schnitt der Folie gewinnt', eq(pb.naechsteSchicht('b', c, W), { art: 'neu', slide: c, blendeMs: 0 }));
ck('keine Folie → leeren', pb.naechsteSchicht('a', null, W).art === 'leeren');
ck('höchstens zwei alte Schichten', pb.MAX_ALTE_SCHICHTEN === 2);
// Gleichlauf-Schutz (Spec): die Ansicht entscheidet nichts selbst, sie ruft die gemeinsamen Funktionen.
const quelle = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
const pruefeAnsicht = (name: string, text: string) => {
  for (const f of ['aktuelleFolie(', 'bildArt(', 'naechsteSchicht(', 'MAX_ALTE_SCHICHTEN']) ck(`${name} nutzt ${f}`, text.includes(f));
  ck(`${name} entscheidet den Übergang nicht selbst`, !text.includes('uebergangFuer('));
};
pruefeAnsicht('Publikumsansicht', quelle('../src/renderer/src/views/AudienceView.tsx'));
```

- [ ] **Step 2: Test laufen lassen, muss scheitern.** Skript `selftest` ergänzen. Run (WT/apps/presenter): `npx tsx test/publikumsbild.test.ts`. Expected: Abbruch, Modul `../src/shared/publikumsbild` fehlt.
- [ ] **Step 3: `src/shared/publikumsbild.ts` umsetzen** nach den Signaturen; `aktuelleFolie` übernimmt die heutige Auswahl-Zeile aus `AudienceView` 1:1 (sie beachtet `active` nicht — vorher nachlesen; weicht die heutige Zeile ab, gilt sie und der Test aus Step 1 wird an sie angepasst, nie umgekehrt); `naechsteSchicht` liefert für eine neue Folie `blendeMs = obenId !== null && u.art === 'blende' ? u.dauerMs : 0` mit `u = uebergangFuer(folie, w)` (heutige Regel aus `AudienceView`).
- [ ] **Step 4: `AudienceView.tsx` umstellen, sonst nichts.** Import `uebergangFuer` raus, `aktuelleFolie, bildArt, naechsteSchicht, MAX_ALTE_SCHICHTEN` aus `'../../../shared/publikumsbild'` rein; `const current = aktuelleFolie(state, slides);`; Pausen über `const art = bildArt(state, current)` (`'schwarz'` → bisheriges schwarzes `div`, `'weiss'` → bisheriges weißes `div`). Der Effekt behält Abhängigkeiten `[current, wiedergabe]`, der Rumpf wird:

```ts
setSchichten((alt) => {
  const e = naechsteSchicht(alt[alt.length - 1]?.slide.id ?? null, current, wiedergabe);
  if (e.art === 'leeren') return [];
  if (e.art === 'bleibt') return alt;
  zaehler.current += 1;
  return [...alt.slice(-MAX_ALTE_SCHICHTEN), { key: zaehler.current, slide: e.slide, blendeMs: e.blendeMs, sichtbar: false }];
});
```

  Keine sichtbare Änderung der Publikumsansicht, auch nicht beim Beenden (Controller-Entscheidung 14.11.: eine frühere Fassung dieses Plans ließ beim Beenden kurz „Bereit“ aufblitzen — verworfen, Anti-Ziel „Bildschirm-Ausgang unverändert“).
- [ ] **Step 5: Tests grün.** `npx tsx test/publikumsbild.test.ts` → 0 FAIL; `npm run selftest` und `npm run typecheck` → grün.
- [ ] **Step 6: Bildschirm-Ausgang unverändert (Regressionswache).** `npm run dist:dir -- -c.electronVersion=33.4.11 -c.npmRebuild=false`, dann `node test/pruefstand.mjs --nur navigation,doppelklick`. Expected: `0 FAIL` (Fälle „Präsentation starten … beide Fenster erscheinen“, „Publikum behält seine Folienzahl“).
- [ ] **Step 7: Commit** `refactor(presenter): Entscheidungen des Publikumsbilds gemeinsam (#303)` mit den vier Dateien.

---

### Task 3: NDI-Sender im Utility-Prozess und Bündelkette

**Files:**
- Create: `apps/presenter/src/shared/ndi.ts`
- Create: `apps/presenter/src/utility/ndi-sender-kern.ts`, `apps/presenter/src/utility/ndi-sender.ts`
- Create: `apps/presenter/tools/bundle-ndi.mjs`
- Modify: `apps/presenter/package.json` (Abhängigkeit, Skripte), `package-lock.json`, `apps/presenter/electron.vite.config.ts`, `apps/presenter/electron-builder.yml`, `apps/presenter/tsconfig.node.json`, `apps/presenter/.gitignore`
- Create: `apps/presenter/test/ndi-sender-kern.test.ts`, `apps/presenter/test/release-weg.test.ts`

**Interfaces:**
- Consumes: `@jm/ndi` (`init`, `createSender`, `sendVideoBGRA`, `connections`, `destroy`; `packages/ndi/index.d.ts`).
- Produces:
  - `src/shared/ndi.ts`: `NDI_NAME = 'JM Presenter'`, `NDI_BREITE = 1920`, `NDI_HOEHE = 1080`, `NDI_FPS = 25`, `NDI_TAKT_MS = 40`, `NDI_BILD_BYTES = 1920 * 1080 * 4`; `type AnSender = { type: 'init' } | { type: 'bild'; buffer: ArrayBuffer } | { type: 'stop' }`; `type VomSender = { type: 'bereit' } | { type: 'fehler'; grund: string } | { type: 'stat'; empfaenger: number }`.
  - `src/utility/ndi-sender-kern.ts`: `interface KernPort { on(ereignis: 'message', cb: (e: { data: unknown }) => void): unknown; postMessage(nachricht: unknown): void }`; `type NdiSendeModul = Pick<typeof NdiApi, 'init' | 'createSender' | 'sendVideoBGRA' | 'connections' | 'destroy'>` mit `import type * as NdiApi from '@jm/ndi'`; `starteNdiSenderKern(port: KernPort, ladeNdi: () => Promise<NdiSendeModul>, taktMs?: number): void` (Vorgabe `NDI_TAKT_MS`).
  - Build: `out/main/ndi-sender.cjs`; Skript `prepackage` legt `resources/bin/win/{jm_ndi.node, Processing.NDI.Lib.x64.dll}` ab.

- [ ] **Step 1: Failing tests schreiben.**
  `test/ndi-sender-kern.test.ts`: Attrappen-Port (`rein(daten)` ruft den registrierten Lauscher mit `{ data }`, `raus: VomSender[]`) und Attrappen-NDI (zählt `init`, merkt Namen, gesendete Puffer und `[w, h, fpsN, fpsD]`, `connections()` liefert 2, optional `dauerMs` Leerlauf je Senden). Echte Timer, `taktMs` 40. Vier Läufe, je eigener Port/Attrappe: `p1` Laden scheitert; `p2`/`n2` `init()` wirft; `p3`/`n3` Normalfall; `n4` mit `dauerMs: 10`, `zaehl4` = Sendungen in den 2 s nach einem `bild`:

```ts
// Laufzeit fehlt: Laden scheitert → Meldung, kein Wurf
k.starteNdiSenderKern(p1.port, () => Promise.reject(new Error('Addon fehlt\nDetails')), 40); p1.rein({ type: 'init' }); await warte(100);
ck('Laufzeit fehlt → eine Meldung fehler mit erster Zeile', eq(p1.raus, [{ type: 'fehler', grund: 'Addon fehlt' }]));
// init() wirft
ck('init wirft → fehler, nichts gesendet', p2.raus[0]?.type === 'fehler' && n2.log.gesendet.length === 0);
// Normalfall
p3.rein({ type: 'init' }); await warte(130);
ck('bereit gemeldet', p3.raus.some((m) => m.type === 'bereit'));
ck('Quelle heißt JM Presenter', n3.log.namen.join() === 'JM Presenter');
ck('Format 1920×1080, 25/1', eq(n3.log.format, [1920, 1080, 25, 1]));
ck('vor dem ersten Bild: transparent', n3.log.gesendet[0].length === NDI_BILD_BYTES && n3.log.gesendet[0].every((v) => v === 0));
p3.rein({ type: 'bild', buffer: new Uint8Array(NDI_BILD_BYTES).fill(7).buffer });
const vor = n3.log.gesendet.length; await warte(2000);
const neu = n3.log.gesendet.slice(vor);
ck('Standbild: 2 s → 48 bis 52 Sendungen', neu.length >= 48 && neu.length <= 52);
ck('wiederholt das letzte Bild', neu.slice(2).every((b) => b[0] === 7));
ck('Empfängerzahl etwa jede Sekunde', p3.raus.filter((m) => m.type === 'stat' && m.empfaenger === 2).length >= 1);
p3.rein({ type: 'bild', buffer: new ArrayBuffer(100) }); await warte(100);
ck('falsche Größe verworfen (nativer Code läse sonst über das Ende)', n3.log.gesendet.at(-1)![0] === 7);
p3.rein({ type: 'stop' }); const n = n3.log.gesendet.length; await warte(200);
ck('stop: destroy, danach nichts mehr', n3.log.destroy === 1 && n3.log.gesendet.length === n);
// driftfrei: Senden dauert 10 ms (ein setInterval(40) käme nur auf ~40 in 2 s)
ck('langsames Senden: 2 s → 48 bis 52 Sendungen', zaehl4 >= 48 && zaehl4 <= 52);
```

  `test/release-weg.test.ts` (Bündelkette; Task 9 erweitert ihn):

```ts
const pkg = JSON.parse(lies('../package.json'));
ck('@jm/ndi ist Abhängigkeit', pkg.dependencies['@jm/ndi'] === '*');
ck('prepackage bündelt NDI', pkg.scripts.prepackage === 'node tools/bundle-ndi.mjs');
for (const s of ['dist', 'dist:dir', 'dist:win', 'dist:mac']) ck(`${s} ruft prepackage`, pkg.scripts[s].startsWith('electron-vite build && npm run prepackage && electron-builder'));
const eb = lies('../electron-builder.yml');
ck('npmRebuild aus', /^npmRebuild: false$/m.test(eb));
ck('electronVersion = Workspace-Electron', eb.includes(`\nelectronVersion: ${require('electron/package.json').version}\n`));
ck('resources/bin nie im Repo', lies('../.gitignore').split(/\r?\n/).includes('resources/bin'));
// Mac baut und startet ohne NDI: kein Wert-Import von @jm/ndi außer im Utility-Einstieg
const code = /from\s+['"]@jm\/ndi['"]|import\(\s*['"]@jm\/ndi['"]\s*\)|require\(\s*['"]@jm\/ndi['"]\s*\)/;
const treffer = alleTs('../src/').filter((f) => readFileSync(f, 'utf8').split(/\r?\n/).some((z) => code.test(z) && !/^\s*(import type |\/\/|\*)/.test(z)));
ck('@jm/ndi nur in src/utility/ndi-sender.ts geladen', treffer.length === 1 && treffer[0].endsWith(join('utility', 'ndi-sender.ts')));
```

  (`lies(rel)` liest relativ zu `import.meta.url`, `require` per `createRequire(import.meta.url)`, `alleTs(rel)` liefert absolute Pfade aller `.ts`/`.tsx` darunter.)
- [ ] **Step 2: Tests laufen lassen, müssen scheitern.** Beide in `selftest` anhängen. Run: `npx tsx test/ndi-sender-kern.test.ts` → Abbruch (Modul fehlt); `npx tsx test/release-weg.test.ts` → FAIL bei Abhängigkeit, Skripten, Config, `.gitignore`.
- [ ] **Step 3: `src/shared/ndi.ts`** mit Konstanten und den zwei Nachrichtentypen (nur Typen und Zahlen, keine Importe).
- [ ] **Step 4: `src/utility/ndi-sender-kern.ts` umsetzen.**
  - `init` (nur das erste zählt): `await ladeNdi()`, `init()`, `createSender(NDI_NAME)` in einem `try`; Fehler → `{ type: 'fehler', grund: <erste Zeile der Meldung> }`, sonst `{ type: 'bereit' }` und Takt starten.
  - Letztes Bild anfangs `new Uint8Array(NDI_BILD_BYTES)` (alles 0 = transparent). `bild` nur übernehmen, wenn `buffer instanceof ArrayBuffer && buffer.byteLength === NDI_BILD_BYTES`; auch vor `bereit` übernehmen.
  - Takt driftfrei: `soll += taktMs; setTimeout(tick, Math.max(0, soll - performance.now()))`; liegt `soll` mehr als zwei Takte zurück, `soll = performance.now()` (kein Nachholen im Stoß). Je Tick `sendVideoBGRA(letztes, NDI_BREITE, NDI_HOEHE, NDI_FPS, 1)`; jede 25. Sendung `{ type: 'stat', empfaenger: connections() }`. Wirft das Senden: einmal `fehler` melden, Takt beenden.
  - `stop`: Takt beenden, `destroy()`.
- [ ] **Step 5: Einstieg `src/utility/ndi-sender.ts`:** `starteNdiSenderKern(process.parentPort, async () => require('@jm/ndi') as NdiSendeModul)`. Kopfkommentar: einziger Ort, der `@jm/ndi` lädt; warum `require` statt `import()` (Global Constraints).
- [ ] **Step 6: Bündelkette.**
  - `package.json`: `"@jm/ndi": "*"` unter `dependencies`; Skripte `prepackage` und die vier `dist*` exakt wie im Test. Danach in WT `npm install`; `git diff --stat package-lock.json` zeigt nur den Block `apps/presenter`.
  - `electron.vite.config.ts` (main): `input` um `'ndi-sender': resolve(__dirname, 'src/utility/ndi-sender.ts')`; `output` zusätzlich `chunkFileNames: 'chunks/[name]-[hash].cjs'` (das Paket ist `"type": "module"`: ein gemeinsamer Chunk mit `.js` wäre ESM und `require` scheiterte zur Laufzeit). `@jm/ndi` NICHT in die `exclude`-Liste.
  - `tsconfig.node.json`: `"src/utility/**/*.ts"` in `include`.
  - `tools/bundle-ndi.mjs`: Windows-Teil 1:1 aus `apps/titler/tools/bundle-ndi.mjs` (Addon aus `packages/ndi/build/Release`, DLL aus `$NDI_SDK_DIR\Bin\x64`, fehlt eins → `throw`; ein Windows-Paket ohne NDI darf nie still entstehen). Statt des Mac-Teils: jede Nicht-Windows-Plattform → `console.log('[bundle-ndi] Nur Windows: Mac-Presenter ohne NDI (#303) – übersprungen.')`, `process.exit(0)`.
  - `electron-builder.yml` am Ende:

```yaml
# NDI (#303): Das Windows-Paket baut der Owner LOKAL mit gebündeltem NDI (bundle-ndi.mjs → resources/bin/win),
# das Mac-Paket die CI ohne NDI. electron ist ans Workspace-Root gehoistet → Version hier; npmRebuild aus, weil
# das Addon nicht von electron-builder gebaut wird. electronVersion bei Electron-Upgrade nachziehen.
electronVersion: 33.4.11
npmRebuild: false
```

  - `.gitignore`: Zeile `resources/bin`.
- [ ] **Step 7: Tests grün.** `npx tsx test/ndi-sender-kern.test.ts`, `npx tsx test/release-weg.test.ts` → 0 FAIL; `npm run selftest`, `npm run typecheck` grün.
- [ ] **Step 8: Bau prüfen.** `npm run build`; dann (PowerShell): `Test-Path out/main/ndi-sender.cjs` → True; `Select-String out/main/ndi-sender.cjs -Pattern 'require\(.@jm/ndi.\)'` → genau ein Treffer, innerhalb des Lade-Rückrufs (nicht auf oberster Ebene); `Select-String out/main/ndi-sender.cjs -Pattern 'import\(.@jm/ndi'` → kein Treffer; `Select-String out/main/index.cjs, out/preload/index.cjs -Pattern '@jm/ndi'` → kein Treffer; `Get-ChildItem out/main -Recurse -Filter *.js` → leer. `npm run prepackage` → zwei Dateien in `resources/bin/win`; `git status --short` zeigt kein `resources/bin`.
- [ ] **Step 9: Commit** `feat(presenter): NDI-Sender im Utility-Prozess, Bündelkette nur Windows (#303)` mit allen Dateien der Liste.

---

### Task 4: Main-Seite: NDI-Fenster, Schalterzustand, Senderleben, Fehlerfall

**Files:**
- Modify: `apps/presenter/src/shared/types.ts`, `apps/presenter/src/shared/ndi.ts`
- Create: `apps/presenter/src/main/ndi/config.ts`, `apps/presenter/src/main/ndi/sender-process.ts`, `apps/presenter/src/main/ndi/ausgang.ts`
- Modify: `apps/presenter/src/main/windows.ts`, `apps/presenter/src/main/ipc.ts`, `apps/presenter/src/main/index.ts`, `apps/presenter/src/preload/index.ts`, `apps/presenter/src/renderer/src/main.tsx`
- Create: `apps/presenter/test/ndi-ausgang.test.ts`
- Modify: `apps/presenter/package.json` (`selftest` um den neuen Test)

**Interfaces:**
- Consumes: `AnSender`, `VomSender`, Konstanten aus `src/shared/ndi.ts`; `subscribe`, `getPayload` aus `src/main/present.ts`; Build-Ausgabe `out/main/ndi-sender.cjs` (Task 3).
- Produces:
  - `types.ts`: `ViewName` um `'ndi'`; `type NdiLage = 'aus' | 'startet' | 'sendet' | 'nicht-verfuegbar'`; `interface NdiStatus { an: boolean; lage: NdiLage; empfaenger: number; grund: string | null }`; `JmprApi.ndi: { status(): Promise<NdiStatus>; setzeAn(an: boolean): Promise<NdiStatus>; onStatus(cb: (s: NdiStatus) => void): () => void; onPayload(cb: (p: PresentationPayload | null) => void): () => void; fensterBereit(): void }`.
  - `shared/ndi.ts`: `NDI_STATUS_AUS: NdiStatus = { an: false, lage: 'aus', empfaenger: 0, grund: null }`; `ndiLiefertBild(s: NdiStatus): boolean` (= `s.an && s.lage === 'sendet'`).
  - `windows.ts`: `openNdiWindow(): BrowserWindow`, `closeNdiWindow(): void`, `getNdiWindow(): BrowserWindow | null`, `sendeAnNdi(channel: string, payload: unknown): void`; `broadcastAll` bedient auch das NDI-Fenster.
  - `main/ndi/config.ts`: `interface NdiConfig { an: boolean }`, `ladeNdiConfig(): NdiConfig`, `speichereNdiConfig(c: NdiConfig): void`.
  - `main/ndi/sender-process.ts`: `interface SenderMeldungen { bereit(): void; fehler(grund: string): void; empfaenger(n: number): void; beendet(code: number): void }`, `starteSender(m: SenderMeldungen): boolean`, `verbindeFenster(win: BrowserWindow): void`, `stoppeSender(): void`.
  - `main/ndi/ausgang.ts`: `initNdiAusgang(): void`, `ndiStatus(): NdiStatus`, `setzeNdiAn(an: boolean): NdiStatus`, `ndiLiefert(): boolean`, `ndiFensterBereit(): void`, `beendeNdi(): void`.
  - IPC: `ndi:status` (invoke und Push an alle Fenster), `ndi:setzeAn` (invoke), `ndi:fensterBereit` (send, nur vom NDI-Fenster), Push `present:payload` nur ans NDI-Fenster, Port-Nachricht `jmpr:ndi-port`.

- [ ] **Step 1: Failing test schreiben** (`test/ndi-ausgang.test.ts`). Ganz oben `Object.defineProperty(process, 'platform', { value: 'win32' })` (CI läuft unter Linux). `registerHooks` lenkt `'./windows'` UND `'../windows'` auf eine Fenster-Attrappe `w = globalThis.__w` (`openNdiWindow`: ist `w.aktuell` leer, neues Schein-Fenster `{ once(e, cb), isDestroyed: () => false, webContents: {} }` anlegen, `w.offen++`, `closed`-Rückruf in `w.closed`; liefert `w.aktuell`. `closeNdiWindow`: `w.zu++`, `w.aktuell = null`. `getNdiWindow` → `w.aktuell`. `sendeAnNdi` sammelt in `w.anNdi`, `broadcastAll('ndi:status', …)` in `w.status`; dazu die fünf Exporte, die `present.ts` braucht), `'./sender-process'` auf eine Sender-Attrappe `s = globalThis.__s` (`starteSender` merkt die Meldungen in `s.m`, zählt `s.gestartet`, liefert `s.datei`; zählt `s.gestoppt`, `s.verbunden`) und `'electron'` auf `export const app = { getPath: () => globalThis.__userData }` (Temp-Ordner, `datei` = `ndi-config.json` darin). Dann `cfg` (`../src/main/ndi/config`), `a` (`../src/main/ndi/ausgang`), `p` (`../src/main/present`), `ndi` (`../src/shared/ndi`) importieren; `payload` = kleines `PresentationPayload` mit zwei Folien:

```ts
ck('ohne Datei → aus', eq(cfg.ladeNdiConfig(), { an: false }));
fs.writeFileSync(datei, 'kaputt'); ck('Müll → aus', eq(cfg.ladeNdiConfig(), { an: false }));
fs.writeFileSync(datei, '{"an":true}'); a.initNdiAusgang();
ck('gemerkt an → Sender und Fenster ab App-Start', s.gestartet === 1 && w.offen === 1 && a.ndiStatus().lage === 'startet');
s.m.bereit(); ck('bereit → sendet, liefert Bild', a.ndiStatus().lage === 'sendet' && a.ndiLiefert());
const vor = w.status.length; s.m.empfaenger(2); s.m.empfaenger(2);
ck('Empfängerzahl einmal gemeldet', a.ndiStatus().empfaenger === 2 && w.status.length === vor + 1);
a.ndiFensterBereit(); ck('Fenster bereit → Port verbunden', s.verbunden === 1);
p.startPresentation(payload, null); p.next();
ck('Präsentationsstart → Folien genau einmal ans NDI-Fenster', w.anNdi.filter(([c, x]) => c === 'present:payload' && x === payload).length === 1);
p.stopPresentation(); ck('Stopp → null ans NDI-Fenster', eq(w.anNdi.at(-1), ['present:payload', null]));
s.m.fehler('Addon fehlt');
ck('Fehler → nicht verfügbar mit Grund, kein Wurf', a.ndiStatus().lage === 'nicht-verfuegbar' && a.ndiStatus().grund!.includes('Addon fehlt') && !a.ndiLiefert());
p.startPresentation(payload, null); ck('Präsentation unberührt', p.getState().active); p.stopPresentation();
a.setzeNdiAn(false);
ck('aus → Sender gestoppt, Fenster zu, gemerkt', s.gestoppt >= 1 && w.zu === 1 && a.ndiStatus().lage === 'aus' && eq(JSON.parse(fs.readFileSync(datei, 'utf8')), { an: false }));
const alterRueckruf = w.closed!; a.setzeNdiAn(true); const g1 = s.gestoppt; alterRueckruf();
ck('schnelles Aus/An: closed des alten Fensters beendet den neuen Sender nicht', s.gestoppt === g1);
s.m.beendet(3);
ck('Sender endet → nicht verfügbar', a.ndiStatus().lage === 'nicht-verfuegbar' && a.ndiStatus().grund === 'NDI-Sender beendet (Code 3).');
const [o1, st1, v1] = [w.offen, s.gestartet, s.verbunden]; a.setzeNdiAn(true);
ck('Neustart bei offenem Fenster: neuer Sender, kein zweites Fenster, Port sofort', s.gestartet === st1 + 1 && w.offen === o1 && s.verbunden === v1 + 1);
const gestoppt = s.gestoppt; w.aktuell = null; w.closed!(); ck('NDI-Fenster zu (letztes Fenster geschlossen) → Sender gestoppt', s.gestoppt > gestoppt);
a.setzeNdiAn(false); s.datei = false; const offen = w.offen; a.setzeNdiAn(true);
ck('Sender-Datei fehlt → nicht verfügbar, kein Fenster', a.ndiStatus().grund === 'NDI-Sender fehlt im Paket.' && w.offen === offen);
a.setzeNdiAn(false); s.datei = true; Object.defineProperty(process, 'platform', { value: 'darwin' }); const st = s.gestartet; a.setzeNdiAn(true);
ck('Mac → nicht verfügbar, kein Sender', a.ndiStatus().grund === 'NDI-Ausgang gibt es nur unter Windows.' && s.gestartet === st);
ck('ndiLiefertBild nur bei an + sendet', ndi.ndiLiefertBild({ an: true, lage: 'sendet', empfaenger: 0, grund: null }) && !ndi.ndiLiefertBild({ an: false, lage: 'sendet', empfaenger: 0, grund: null }) && !ndi.ndiLiefertBild({ an: true, lage: 'startet', empfaenger: 0, grund: null }));
```

- [ ] **Step 2: Test laufen lassen, muss scheitern.** In `selftest` anhängen. Run: `npx tsx test/ndi-ausgang.test.ts` → Abbruch, Module fehlen.
- [ ] **Step 3: Typen und `shared/ndi.ts`** wie unter Produces.
- [ ] **Step 4: `main/ndi/config.ts`** nach dem Muster `remote-config.ts`: Datei `ndi-config.json` in `userData`, `an === true` sonst `false`, Schreibfehler still.
- [ ] **Step 5: `main/ndi/sender-process.ts`** nach `apps/titler/src/main/ndi/sender-process.ts`, mit diesen Abweichungen: `starteSender` liefert `false`, wenn `join(__dirname, 'ndi-sender.cjs')` fehlt; sonst `utilityProcess.fork`, `{ type: 'init' }` senden, `VomSender` auf `bereit`/`fehler`/`empfaenger` abbilden; `exit` ruft `beendet(code)` nur, wenn nicht `stoppeSender` den Prozess beendet hat. `verbindeFenster(win)`: alten Port schließen, neuer `MessageChannelMain`, `port2`-Nachrichten mit `type === 'bild'` ohne Transfer an das Kind (transferiert käme `null` an), `port1` per `win.webContents.postMessage('jmpr:ndi-port', null, [port1])`. `stoppeSender` idempotent: `{ type: 'stop' }`, `kill()`, Port zu.
- [ ] **Step 6: `windows.ts`.** `openNdiWindow` (liefert ein offenes zurück): `show: false`, 1920×1080, `skipTaskbar: true`, Titel `JM Presenter · NDI`, `webPreferences: { ...baseWebPreferences, backgroundThrottling: false }`, `sperreNavigation(win)`, `loadView(win, 'ndi')`, `closed` → Verweis nur dann `null`, wenn er noch auf dieses Fenster zeigt. `closeNdiWindow`: Verweis SOFORT `null`, dann `close()` (wie `closePresentationWindows`; ein schnelles Wieder-Einschalten bekommt so nie das schließende Fenster). `getNdiWindow`, `sendeAnNdi` (nur wenn offen). `broadcastAll` nimmt `ndiWindow` in die Liste. Neu: Nach jedem `closed` von Editor, Referent und Publikum: Ist keins der drei mehr offen, `closeNdiWindow()` (sonst endet die App nie, Review Focus 1).
- [ ] **Step 7: `main/ndi/ausgang.ts`.** Status startet bei `NDI_STATUS_AUS`; jede echte Änderung → `broadcastAll('ndi:status', status)`; jeder Übergang nach `nicht-verfuegbar` → `console.error('[ndi] nicht verfügbar:', grund)`.
  - Starten (Grundtexte wie im Test): Plattform ≠ `win32` → `nicht-verfuegbar`; `starteSender(…) === false` → `nicht-verfuegbar`, kein Fenster; sonst `lage: 'startet'`, gemerkter Payload := `getPayload()`. War noch kein NDI-Fenster offen: `openNdiWindow()` und `once('closed', …)`, das nur dann `stoppeSender()` ruft, wenn danach `getNdiWindow() === null` (ein schnelles Aus/An darf den neuen Sender nicht beenden); das neue Fenster meldet sich selbst per `ndi:fensterBereit`. War es schon offen (Neustart nach Fehler): sofort `verbindeFenster(win)`. Ob Addon und Laufzeit da sind, prüft der Utility-Prozess beim Laden (Meldung `fehler`); der Main prüft Plattform und Sender-Datei. Damit gilt die Spec-Regel „nur gestartet, wenn Datei und Addon vorhanden“ im Ergebnis: Auf dem Mac startet nie ein Sender, unter Windows wird ein fehlendes Addon gemeldet statt abzustürzen.
  - Meldungen: `bereit` → `sendet`; `fehler(g)` → `nicht-verfuegbar`, Grund `g`; `empfaenger(n)` → Zahl; `beendet(c)` → `nicht-verfuegbar`.
  - `setzeNdiAn(an)`: speichern; an → (neu) starten, wenn `lage` nicht `startet`/`sendet`; aus → `stoppeSender()`, `closeNdiWindow()`, `NDI_STATUS_AUS`. Liefert den Status.
  - `initNdiAusgang()`: einmal `subscribe(...)`: ist NDI an und `getPayload()` ein anderes Objekt als der gemerkte → merken und `sendeAnNdi('present:payload', p)`; dann gemerkten Schalter anwenden. Auf Nicht-Windows nur Status `{ an: false, lage: 'nicht-verfuegbar', … }` setzen.
  - `ndiFensterBereit()` → `verbindeFenster(getNdiWindow())`, wenn Fenster und Sender da; `beendeNdi()` → `stoppeSender()`.
- [ ] **Step 8: Verdrahten.** `ipc.ts`: `ndi:status` → `ndiStatus()`; `ndi:setzeAn` → `setzeNdiAn(an === true)`; `ipcMain.on('ndi:fensterBereit', (e) => e.sender === getNdiWindow()?.webContents && ndiFensterBereit())`; am Ende von `registerIpc` `initNdiAusgang()`; in `will-quit` `beendeNdi()`. `index.ts` (`second-instance`): Ersatzfenster `BrowserWindow.getAllWindows().find((w) => w !== getNdiWindow())`, sonst `createEditorWindow()`. Preload: `parseView` kennt `'ndi'`; nur für `view === 'ndi'`: `ipcRenderer.on('jmpr:ndi-port', (e) => window.postMessage('jmpr:ndi-port', '*', e.ports))`; `jmpr.ndi` nach Produces (`onStatus` auf Kanal `ndi:status`, `onPayload` auf `present:payload`, `fensterBereit` per `ipcRenderer.send`). `main.tsx`: für `view === 'ndi'` nichts rendern (Task 5 hängt dort die NDI-Ansicht ein).
- [ ] **Step 9: Tests grün.** `npx tsx test/ndi-ausgang.test.ts` → 0 FAIL; `npm run selftest`, `npm run typecheck` grün.
- [ ] **Step 10: Rauchprobe (Windows, echtes NDI).** `npm run dev`; im Editor-DevTools `await jmpr.ndi.setzeAn(true)` → nach höchstens 5 s `lage: 'sendet'`. In WT: `node packages/ndi/test/recv-spike.cjs "<RECHNERNAME> (JM Presenter)"` → Videobilder 1920×1080 kommen an. Danach `setzeAn(false)`; App über das Editor-Fenster schließen → kein `JM Presenter`/`electron`-Prozess bleibt (Task-Manager).
- [ ] **Step 11: Commit** `feat(presenter): NDI-Fenster, Schalterzustand und Senderleben im Main (#303)`.

---

### Task 5: NDI-Bild zeichnen

**Files:**
- Create: `apps/presenter/src/shared/ndi-bild.ts`
- Create: `apps/presenter/src/renderer/src/ndi/ndi-ansicht.ts`
- Modify: `apps/presenter/src/renderer/src/lib/paint.ts` (`clearOverlayBitmaps`), `apps/presenter/src/renderer/src/main.tsx`
- Create: `apps/presenter/test/ndi-bild.test.ts`
- Modify: `apps/presenter/test/publikumsbild.test.ts` (Gleichlauf auch für die NDI-Ansicht), `apps/presenter/package.json` (`selftest`)

**Interfaces:**
- Consumes: `aktuelleFolie`, `bildArt`, `naechsteSchicht`, `MAX_ALTE_SCHICHTEN`, `BildArt` (Task 2); `NDI_*` (Task 3); `jmpr.present.getPayload/getState/onState`, `jmpr.ndi.onPayload/fensterBereit`, Port `jmpr:ndi-port` (Task 4); `renderBase`, `clearPdfCaches` (`lib/pdf.ts`), `ensureOverlayBitmaps`, `paintSlide` (`lib/paint.ts`), `putSource`, `putImage`, `clearAssets` (`lib/assets.ts`), `normiereWiedergabe`.
- Produces:
  - `shared/ndi-bild.ts`: `interface Rechteck { x: number; y: number; w: number; h: number }`; `einpassen(bw: number, bh: number): Rechteck`; `easeInOut(t: number): number` (CSS `ease-in-out` = `cubic-bezier(0.42, 0, 0.58, 1)`, t auf 0..1 begrenzt); `interface SchichtZeit { key: number; blendeMs: number; bereitAbMs: number | null }`; `interface Zeichenplan { zeichnen: { key: number; alpha: number }[]; deckendAb: number | null; blendeLaeuft: boolean }`; `zeichenplan(schichten: readonly SchichtZeit[], jetztMs: number): Zeichenplan`; `rgbaZuBgra(px: Uint8Array | Uint8ClampedArray): void`; `type NdiFuellung = 'transparent' | 'weiss' | 'schichten'`; `ndiFuellung(art: BildArt): NdiFuellung`.
  - `paint.ts`: `clearOverlayBitmaps(): void` (Bitmaps schließen, Map leeren).
  - `ndi/ndi-ansicht.ts`: `starteNdiAnsicht(): void`.

- [ ] **Step 1: Failing tests schreiben.** `test/ndi-bild.test.ts`:

```ts
ck('16:9 füllt', eq(b.einpassen(1920, 1080), { x: 0, y: 0, w: 1920, h: 1080 }));
ck('Hochkant-PDF: volle Höhe, mittig', eq(b.einpassen(1920, 3413), { x: 656, y: 0, w: 608, h: 1080 }));
ck('4:3-Bild', eq(b.einpassen(1920, 1440), { x: 240, y: 0, w: 1440, h: 1080 }));
ck('kleines Bild nicht vergrößert (wie Publikumsfenster)', eq(b.einpassen(640, 480), { x: 640, y: 300, w: 640, h: 480 }));
ck('21:9 mittig', eq(b.einpassen(1920, 823), { x: 0, y: 129, w: 1920, h: 823 }));
ck('ease 0, 1, Mitte', b.easeInOut(0) === 0 && b.easeInOut(1) === 1 && Math.abs(b.easeInOut(0.5) - 0.5) < 1e-6);
ck('ease wie CSS (0,25 → 0,1292; 0,1 → 0,0197)', Math.abs(b.easeInOut(0.25) - 0.1292) < 1e-3 && Math.abs(b.easeInOut(0.1) - 0.0197) < 1e-3);
ck('ease begrenzt', b.easeInOut(-1) === 0 && b.easeInOut(2) === 1);
const alt = { key: 1, blendeMs: 0, bereitAbMs: 0 };
ck('leer', eq(b.zeichenplan([], 0), { zeichnen: [], deckendAb: null, blendeLaeuft: false }));
ck('nicht gemalt → nichts', eq(b.zeichenplan([{ key: 1, blendeMs: 0, bereitAbMs: null }], 0).zeichnen, []));
ck('kein Schwarzblitz: alte bleibt, bis die neue gemalt ist', eq(b.zeichenplan([alt, { key: 2, blendeMs: 0, bereitAbMs: null }], 100).zeichnen, [{ key: 1, alpha: 1 }]));
ck('Schnitt: neue deckt', eq(b.zeichenplan([alt, { key: 2, blendeMs: 0, bereitAbMs: 50 }], 100), { zeichnen: [{ key: 2, alpha: 1 }], deckendAb: 2, blendeLaeuft: false }));
const v = b.zeichenplan([alt, { key: 2, blendeMs: 1000, bereitAbMs: 0 }], 250);
ck('Blende nach 1/4: alt voll, neu 0,129 darüber (Schichtfolge wie CSS-Stapel)', v.zeichnen.length === 2 && eq(v.zeichnen[0], { key: 1, alpha: 1 }) && Math.abs(v.zeichnen[1].alpha - 0.1292) < 1e-3 && v.deckendAb === 1 && v.blendeLaeuft);
ck('Blende fertig: nur neu', eq(b.zeichenplan([alt, { key: 2, blendeMs: 1000, bereitAbMs: 0 }], 1000), { zeichnen: [{ key: 2, alpha: 1 }], deckendAb: 2, blendeLaeuft: false }));
const drei = [alt, { key: 2, blendeMs: 500, bereitAbMs: 0 }, { key: 3, blendeMs: 500, bereitAbMs: 400 }];
const z = b.zeichenplan(drei, 600);
ck('schnell geklickt: Mitte fertig, oben halb → Mitte + oben', z.zeichnen.map((e) => e.key).join() === '2,3' && z.deckendAb === 2 && z.blendeLaeuft);
ck('schnell geklickt: am Ende nur die oberste', eq(b.zeichenplan(drei, 900), { zeichnen: [{ key: 3, alpha: 1 }], deckendAb: 3, blendeLaeuft: false }));
const px = Uint8ClampedArray.of(1, 2, 3, 4, 10, 20, 30, 40); b.rgbaZuBgra(px);
ck('RGBA → BGRA, Alpha bleibt', eq([...px], [3, 2, 1, 4, 30, 20, 10, 40]));
ck('Füllung: Schwarz und leer transparent, Weiß weiß, Folie Schichten', b.ndiFuellung('schwarz') === 'transparent' && b.ndiFuellung('leer') === 'transparent' && b.ndiFuellung('weiss') === 'weiss' && b.ndiFuellung('folie') === 'schichten');
```

  In `test/publikumsbild.test.ts` ergänzen: `pruefeAnsicht('NDI-Ansicht', quelle('../src/renderer/src/ndi/ndi-ansicht.ts'))`.
- [ ] **Step 2: Tests laufen lassen, müssen scheitern.** `ndi-bild` in `selftest`. Run: `npx tsx test/ndi-bild.test.ts` → Abbruch (Modul fehlt); `npx tsx test/publikumsbild.test.ts` → Abbruch (Datei `ndi-ansicht.ts` fehlt).
- [ ] **Step 3: `shared/ndi-bild.ts` umsetzen.** `einpassen`: Faktor `Math.min(1, 1920 / bw, 1080 / bh)`, alle vier Werte `Math.round`. `easeInOut`: Bézier-Parameter zu x per Bisektion (~40 Schritte), dann y. `zeichenplan`: Blende-Fortschritt `t = (jetzt − bereitAbMs) / blendeMs`, begrenzt auf 0..1; eine Blende deckt erst bei `t >= 1`. `rgbaZuBgra` über eine `Uint32Array`-Sicht (Formel aus `apps/titler/src/renderer/src/lib/engine.ts`).
- [ ] **Step 4: `paint.ts`:** `clearOverlayBitmaps()` exportieren.
- [ ] **Step 5: `ndi/ndi-ansicht.ts` umsetzen** (kein React, kein DOM-Element im Fenster):
  - Zustand im Modul: `slides`, `wiedergabe`, `state`, `schichten: { key, slide, blendeMs, bereitAbMs: number | null, bild: HTMLCanvasElement | null, rechteck: Rechteck | null }[]`, `port`, Zähler, ein Takt-Timer.
  - Start: Canvas 1920×1080 mit `getContext('2d', { willReadFrequently: true })`; `message`-Lauscher auf `'jmpr:ndi-port'` (Port merken, `start()`, sofort zeichnen); `onPayload` und `onState` abonnieren, ERST DANACH `getPayload()` und `getState()` holen und anwenden (so geht keine Lieferung verloren); zuletzt `jmpr.ndi.fensterBereit()`.
  - Payload anwenden: `clearPdfCaches()`, `clearAssets()`, `clearOverlayBitmaps()`, Quellen/Bilder registrieren, `normiereWiedergabe`, `schichten = []` (neue Präsentation: erste Folie ohne Übergang); `null` → alles leer, `slides = null`.
  - Bei jeder Änderung: `folie = aktuelleFolie(state, slides)`; `naechsteSchicht(oberste?.slide.id ?? null, folie, wiedergabe)` mit denselben drei Fällen wie `AudienceView` (`MAX_ALTE_SCHICHTEN`); für eine neue Schicht zusammensetzen; dann zeichnen.
  - Zusammensetzen: einmal vorab `document.fonts.load('500 48px "Manrope Variable"')` und `'700 48px …'` abwarten (das versteckte Fenster zeigt keinen Text, der die Schrift sonst lädt); `renderBase(sourceId, pageIndex, 1920)`, `ensureOverlayBitmaps([slide])`, `rechteck = einpassen(base.width, base.height)`, eigenes Canvas in Rechteckgröße, `paintSlide(ctx, base.canvas, slide, rechteck.w, rechteck.h)`, damit je Takt nur 1:1 kopiert wird. Fehler → `bild = null` (wie `SlideCanvas`: ein Fehler hält den Wechsel nicht fest). Danach, nur wenn die Schicht noch in `schichten` steht: `bereitAbMs = performance.now()`, zeichnen.
  - Zeichnen (in `try/catch`): `clearRect`; `ndiFuellung(bildArt(state, folie))`: `weiss` → ganzes Bild `#ffffff`; `schichten` → `zeichenplan(…, performance.now())`, je Eintrag mit Bild `globalAlpha = alpha`, `drawImage(bild, rechteck.x, rechteck.y)`, danach `globalAlpha = 1`; Schichten unter `deckendAb` entfernen. Mit Port: `getImageData(0, 0, 1920, 1080)`, `rgbaZuBgra(img.data)`, `port.postMessage({ type: 'bild', buffer: img.data.buffer })` ohne Transferliste. Läuft eine Blende: genau ein `setTimeout(zeichnen, NDI_TAKT_MS)`, sonst kein Timer (Standbild kostet nichts, der Utility-Prozess wiederholt).
- [ ] **Step 6: `main.tsx`:** `view === 'ndi'` → `starteNdiAnsicht()`, sonst wie bisher `createRoot(…).render(…)`.
- [ ] **Step 7: Tests grün.** `npx tsx test/ndi-bild.test.ts`, `npx tsx test/publikumsbild.test.ts` → 0 FAIL; `npm run selftest`, `npm run typecheck` grün. (Das echte Bild prüft Task 8 Pixel für Pixel.)
- [ ] **Step 8: Commit** `feat(presenter): NDI-Bild mit transparenten Rändern, Pausen und Überblendung (#303)`.

---

### Task 6: Schalter in Werkzeugleiste und Referentenansicht

**Files:**
- Modify: `apps/presenter/src/shared/ndi.ts` (`ndiSchalterText`)
- Create: `apps/presenter/src/renderer/src/lib/useNdiStatus.ts`, `apps/presenter/src/renderer/src/components/NdiSchalter.tsx`
- Modify: `apps/presenter/src/renderer/src/components/Toolbar.tsx`, `apps/presenter/src/renderer/src/views/PresenterView.tsx`
- Create: `apps/presenter/test/ndi-schalter.test.ts`; Modify: `apps/presenter/package.json` (`selftest`)

**Interfaces:**
- Consumes: `NdiStatus`, `NDI_STATUS_AUS`, `jmpr.ndi.status/setzeAn/onStatus` (Task 4).
- Produces: `ndiSchalterText(s: NdiStatus): string`; `useNdiStatus(): { status: NdiStatus; setzeAn: (an: boolean) => void }`; `NdiSchalter({ variante }: { variante: 'editor' | 'referent' })`.

- [ ] **Step 1: Failing test schreiben** (`test/ndi-schalter.test.ts`):

```ts
const st = (lage: NdiLage, an = true, empfaenger = 0): NdiStatus => ({ an, lage, empfaenger, grund: null });
ck('aus', n.ndiSchalterText(st('aus', false)) === 'NDI aus');
ck('startet', n.ndiSchalterText(st('startet')) === 'NDI startet …');
ck('sendet, 0 Empfänger', n.ndiSchalterText(st('sendet')) === 'NDI ● an · 0 Empfänger');
ck('sendet, 2 Empfänger', n.ndiSchalterText(st('sendet', true, 2)) === 'NDI ● an · 2 Empfänger');
ck('ausgefallen', n.ndiSchalterText(st('nicht-verfuegbar')) === 'NDI nicht verfügbar');
ck('Mac', n.ndiSchalterText(st('nicht-verfuegbar', false)) === 'NDI nicht verfügbar');
```

- [ ] **Step 2: Test laufen lassen, muss scheitern.** In `selftest`. Run: `npx tsx test/ndi-schalter.test.ts` → FAIL (`ndiSchalterText` fehlt).
- [ ] **Step 3: Umsetzen.** `ndiSchalterText` exakt wie im Test. `useNdiStatus`: Start mit `NDI_STATUS_AUS`, dann `status()` holen, `onStatus` abonnieren; `setzeAn` ruft `jmpr.ndi.setzeAn`. `NdiSchalter`: Knopf mit `ndiSchalterText(status)`, Klick → `setzeAn(!status.an)`, `disabled` genau dann, wenn `window.jmpr.platform !== 'win32'`; Tooltip `status.grund ?? 'NDI-Ausgang „JM Presenter“: 1920×1080, 25 fps, transparente Ränder'`; Aussehen wie `btn` (Toolbar) bzw. `HeaderBtn` (PresenterView), `sendet` in der Primärfarbe wie `HeaderBtn active`, `an` + `nicht-verfuegbar` in Bernstein. Einbau: Toolbar direkt rechts neben dem Auswahlfeld „Publikums-Bildschirm“ (`variante="editor"`), PresenterView-Kopf direkt nach dem Auswahlfeld (`variante="referent"`).
- [ ] **Step 4: Tests grün.** `npx tsx test/ndi-schalter.test.ts` → 0 FAIL; `npm run selftest`, `npm run typecheck` grün.
- [ ] **Step 5: Sichtprüfung.** `npm run dev`: Knopf in Editor und Referentenansicht; Klick schaltet beide gleichzeitig (gleicher Status per Push); `recv-spike.cjs` verbunden → beide zeigen „1 Empfänger“ binnen etwa 1 s.
- [ ] **Step 6: Commit** `feat(presenter): NDI-Schalter mit Empfängerzahl in Werkzeugleiste und Referentenansicht (#303)`.

---

### Task 7: „Keiner – nur NDI“

**Files:**
- Modify: `apps/presenter/src/shared/types.ts` (`StartZiel`, `JmprApi.present.start`), `apps/presenter/src/shared/ndi.ts`
- Modify: `apps/presenter/src/main/present.ts`, `apps/presenter/src/main/ipc.ts`, `apps/presenter/src/preload/index.ts`
- Modify: `apps/presenter/src/renderer/src/components/Toolbar.tsx`, `apps/presenter/src/renderer/src/views/PresenterView.tsx`
- Create: `apps/presenter/test/nur-ndi.test.ts`; Modify: `apps/presenter/package.json` (`selftest`)

**Interfaces:**
- Consumes: `ndiLiefertBild`, `ndiLiefert()` (Task 4), `useNdiStatus` (Task 6).
- Produces: `type StartZiel = number | null | 'keiner'`; `pruefeStartZiel(roh: unknown, ndiLiefert: boolean): StartZiel`; `startZielFuer(nurNdi: boolean, status: NdiStatus, bildschirm: number | null): StartZiel`; `startPresentation(next: PresentationPayload, ziel: StartZiel): void`; `jmpr.present.start(payload, ziel: StartZiel)`.

- [ ] **Step 1: Failing test schreiben** (`test/nur-ndi.test.ts`; Fenster-Attrappe für `'./windows'` wie in `wiedergabe.test.ts`, zählt `openPresenterWindow`, sammelt die Argumente von `openAudienceWindow`, merkt den Rückruf aus `setPresentationClosedHandler`):

```ts
ck('keiner + NDI liefert → keiner', n.pruefeStartZiel('keiner', true) === 'keiner');
ck('keiner ohne NDI → automatischer Bildschirm', n.pruefeStartZiel('keiner', false) === null);
ck('Bildschirm-ID bleibt', n.pruefeStartZiel(7, false) === 7);
ck('Unsinn → null', n.pruefeStartZiel('x', true) === null && n.pruefeStartZiel(NaN, true) === null && n.pruefeStartZiel(undefined, true) === null);
const sendet: NdiStatus = { an: true, lage: 'sendet', empfaenger: 0, grund: null };
ck('nur NDI gewählt, NDI sendet → keiner', n.startZielFuer(true, sendet, 5) === 'keiner');
ck('nur NDI gewählt, NDI aus → bisherige Bildschirmwahl', n.startZielFuer(true, { ...sendet, an: false, lage: 'aus' }, 5) === 5);
ck('nur NDI gewählt, NDI ausgefallen → bisherige Bildschirmwahl', n.startZielFuer(true, { ...sendet, lage: 'nicht-verfuegbar', grund: 'x' }, 5) === 5);
ck('nicht gewählt → Bildschirm', n.startZielFuer(false, sendet, null) === null);
p.startPresentation(payload, 'keiner');
ck('nur NDI: Referentenansicht, kein Publikumsfenster', g.__w.referent === 1 && g.__w.publikum.length === 0 && p.getState().active);
g.__w.geschlossen();
ck('Referentenansicht zu → Präsentation beendet', p.getState().active === false);
p.startPresentation(payload, 3); p.stopPresentation(); p.startPresentation(payload, null); p.stopPresentation();
ck('sonst unverändert: Publikumsfenster auf 3, dann automatisch', eq(g.__w.publikum, [3, null]));
```

- [ ] **Step 2: Test laufen lassen, muss scheitern.** In `selftest`. Run: `npx tsx test/nur-ndi.test.ts` → FAIL (Funktionen fehlen, `openAudienceWindow` wird bei `'keiner'` gerufen).
- [ ] **Step 3: Umsetzen.**
  - `shared/ndi.ts`: `pruefeStartZiel` (`'keiner'` nur bei `ndiLiefert`, sonst `null`; endliche Zahl bleibt; alles andere `null`); `startZielFuer` (= `'keiner'` nur bei `nurNdi && ndiLiefertBild(status)`, sonst `bildschirm`).
  - `present.ts`: `openPresenterWindow()` wie bisher; `openAudienceWindow(ziel)` nur bei `ziel !== 'keiner'`. Sonst nichts an Start/Stopp.
  - `ipc.ts` `present:start`: `startPresentation(payload, pruefeStartZiel(ziel, ndiLiefert()))`. Preload und `JmprApi`: zweiter Parameter `ziel: StartZiel`.
  - `Toolbar.tsx`: Zustand `nurNdi` (Vorgabe `false`), `audienceDisplay` bleibt die bisherige Bildschirmwahl; `waehlbar = ndiLiefertBild(status)`; Effekt: nicht `waehlbar` → `nurNdi = false`. Auswahlfeld: Wert `nurNdi ? 'keiner' : audienceDisplay ?? ''`; zusätzliche letzte Option `<option value="keiner" disabled={!waehlbar}>Keiner – nur NDI</option>`, nur bei `window.jmpr.platform === 'win32'`; Auswahl `keiner` → `nurNdi = true`, sonst `nurNdi = false` und Bildschirm setzen. Start: `present.start(payload, startZielFuer(nurNdi, status, audienceDisplay))`.
  - `PresenterView.tsx`: ist kein Bildschirm `current` (nur NDI), ist das Auswahlfeld gesperrt und zeigt die eine Option „Keiner – nur NDI“.
- [ ] **Step 4: Tests grün.** `npx tsx test/nur-ndi.test.ts`, `npx tsx test/wiedergabe.test.ts` → 0 FAIL; `npm run selftest`, `npm run typecheck` grün.
- [ ] **Step 5: Commit** `feat(presenter): Publikums-Bildschirm „Keiner – nur NDI“ (#303)`.

---

### Task 8: Prüfstand mit echtem NDI-Empfang

**Files:**
- Create: `apps/presenter/test/ndi-messung.mjs`
- Modify: `apps/presenter/test/pruefstand.mjs` (Gruppe `ndi`, Testdaten, Helfer)

**Interfaces:**
- Consumes: alles aus Task 2–7 in der gepackten App; `@jm/ndi` Empfang (`init`, `findSources`, `createReceiver`, `receive`, `closeReceiver`, `destroy`); `@electron/asar` aus dem Workspace (transitiv über electron-builder).
- Produces: `zaehleBilder(ndi, ms: number): { bilder: number; laengsteLueckeMs: number; luecken80: number }` (Export aus `ndi-messung.mjs`); CLI `node test/ndi-messung.mjs [--quelle "<NAME>"] [--sekunden N]` → Zeile `Bilder <n> von <25·N> (<fps> fps), längste Lücke <x> ms, Lücken über 80 ms: <k>`, Exit 1 bei `n < 25·N − 2` oder `k > 0`; Prüfstand-Gruppe `ndi`.

- [ ] **Step 1: `test/ndi-messung.mjs` schreiben.** `@jm/ndi` per `createRequire(import.meta.url)`; Quelle: `--quelle` oder die einzige, die auf `(JM Presenter)` endet; `zaehleBilder` ruft `receive(100)` in einer Schleife, zählt nur Videobilder, misst Abstände mit `performance.now()`. CLI-Teil nur, wenn die Datei direkt gestartet wird. Kurzprobe gegen `npm run dev` mit NDI an: `node test/ndi-messung.mjs --sekunden 5` → `Bilder 125 von 125` ± 2, Exit 0.
- [ ] **Step 2: Gruppe `ndi` schreiben** (bestehende Helfer `mitApp`, `fall`, `erwarte`, `bisWert`, `oeffneZiel`, `auswerten`, `imDom`, `ablegen`, `zweiteInstanz`, `presenterLaeuft`). Testdaten in `baueTestdateien`: `quer.pdf` (480×270, Seite schwarz gefüllt), `hoch.pdf` (270×480, weiß), `bild.png` 900×1600 (obere Hälfte `#ff0000` deckend, untere Hälfte Alpha 0; PNG in Node mit `zlibSync` aus fflate und eigener CRC32), `ndi.jmpres` (Format wie `d.projekt`; Folien quer, hoch, Bild; `wiedergabe: { uebergang: { art: 'blende', dauerMs: 1000 }, schleife: false, standzeitSek: 10 }`). Eigenes Profil P: `{ USERPROFILE: <d.dir>\ndi-profil }` mit angelegtem `AppData\Roaming` und `AppData\Local`. Empfang: `init()` einmal; Quelle = die auf `(JM Presenter)` endende, die mit `os.hostname()` beginnt (groß/klein egal); `pixel(bild, x, y) → [b, g, r, a]` über `lineStride`. Lässt sich `@jm/ndi` nicht laden: FAIL, nie überspringen. Auswahlfeld (React) per nativem `value`-Setter von `HTMLSelectElement.prototype` und `change`-Ereignis mit `bubbles: true` setzen; NDI-Knopf = der Knopf, dessen Text mit `NDI` beginnt. Fälle:
  - App A (Profil P, Argument `ndi.jmpres`):
    1. Erster Start: `jmpr.ndi.status()` → `{ an: false, lage: 'aus' }`, kein Ziel `view=ndi`, Knopf „NDI aus“.
    2. `jmpr.ndi.setzeAn(true)` → binnen 10 s `sendet`, Ziel `view=ndi` da, Quelle gefunden; Bild 1920×1080, FourCC `BGRA` (0x41524742), `fpsN/fpsD` 25/1, an (5,5), (960,540), (1915,1075) Alpha 0 (keine Präsentation → transparent).
    3. Knopf zeigt „NDI ● an · 1 Empfänger“ binnen 5 s.
    4. Auswahlfeld auf „Keiner – nur NDI“, „▶ Präsentieren“ → `view=presenter` da, nach 3 s kein `view=audience`; NDI (960,540) = [0,0,0,255], (5,5) Alpha 255.
    5. `present.next()` → in den folgenden 1,5 s mindestens 5 Bilder mit (960,540)-Blau strikt zwischen 10 und 245 (Blende sichtbar); danach (960,540) = [255,255,255,255], (100,540) Alpha 0.
    6. `present.next()` (Bild) → nach 1,5 s: (960,270) = [0,0,255,255], (960,810) Alpha 0, (100,540) Alpha 0.
    7. `zaehleBilder(ndi, 10000)` → `bilder >= 248`, `luecken80 === 0`.
    8. `setScreen('black')` → an den drei Messpunkten Alpha 0; nochmal (zurück) → Bild wie in 6; `setScreen('white')` → (100,540) = [255,255,255,255]; zurück.
    9. `ndi.setzeAn(false)` → `present.getState().active` bleibt `true`, `view=presenter` bleibt, Knopf „NDI aus“, Auswahlfeld zeigt nicht mehr „Keiner – nur NDI“; `ndi.setzeAn(true)` → wieder `sendet`.
    10. `present.stop()` → binnen 2 s an den drei Messpunkten Alpha 0.
    11. Editor per `window.close()` schließen (keine Präsentation) → binnen 15 s kein Presenter-Prozess mehr.
  - App B (Profil P, ohne Argument):
    12. Neustart: ohne Zutun binnen 10 s `sendet`, Quelle wieder da.
    13. `ndi.setzeAn(false)`; `a.pdf` ablegen, normal präsentieren (mit Publikumsfenster); `ndi.setzeAn(true)` → binnen 5 s NDI (960,540) = [255,255,255,255].
    14. Editor per `window.close()` schließen (Präsentation läuft), `zweiteInstanz(exe, [], P)` → im Ziel `view=ndi` gilt weiter `document.visibilityState === 'hidden'`; dann `present.stop()` über das Referentenfenster → binnen 15 s kein Presenter-Prozess mehr.
  - App C (Kopie ohne NDI, Profil P mit gemerktem an):
    15. `release/win-unpacked` nach `d.dir` kopieren; dort `resources/bin/win` löschen und aus `resources/app.asar` per `@electron/asar` (`extractAll`, `node_modules/@jm/ndi` löschen, `createPackage`) das Paket entfernen. Start → Knopf „NDI nicht verfügbar“ binnen 10 s; „▶ Präsentieren“ mit `a.pdf` → `view=presenter` und `view=audience` da; die App lebt nach 5 s noch. Das Original `release/win-unpacked` bleibt unberührt.
- [ ] **Step 3: Gepackte App bauen.** WT/apps/presenter: `npm run dist:dir` (mit `NDI_SDK_DIR`; jetzt mit `prepackage` und den Config-Schlüsseln). Expected: `release/win-unpacked/resources/bin/win/jm_ndi.node` und `Processing.NDI.Lib.x64.dll` vorhanden.
- [ ] **Step 4: Gruppe laufen lassen.** `node test/pruefstand.mjs --nur ndi`. Expected: `0 FAIL, 0 übersprungen`. Jeder FAIL: Ursache suchen (superpowers:systematic-debugging), im zuständigen Task-Code beheben, wo möglich mit Selbsttest, neu bauen, erneut laufen lassen.
- [ ] **Step 5: Alle Gruppen.** `node test/pruefstand.mjs` → `0 FAIL` (Zahlen notieren).
- [ ] **Step 6: Commit** `test(presenter): Prüfstand mit echtem NDI-Empfang, NDI-Messung (#303)`.

---

### Task 9: Release vorbereiten

**Files:**
- Modify: `.github/workflows/suite-release.yml`
- Modify: `apps/presenter/test/release-weg.test.ts`
- Modify: `apps/presenter/package.json`, `package-lock.json` (Version 0.13.0)
- Modify: `apps/presenter/README.md` (Abschnitt NDI-Ausgang, Release-Weg)

**Interfaces:**
- Consumes: Bündelkette (Task 3), Prüfstand (Task 8).
- Produces: Release-Commit (Version 0.13.0) auf dem Branch, lokal gebauter `apps/presenter/release/JM Presenter-0.13.0-win-x64.exe` aus genau diesem Commit, PR, Mac-Probe-DMGs, Notes-Entwurf mit Owner-Freigabe.

- [ ] **Step 1: Failing test ergänzen** (`test/release-weg.test.ts`; `wf = lies('../../../.github/workflows/suite-release.yml')` mit `\r\n` → `\n`):

```ts
ck('plan: Presenter nur macOS', wf.includes(`presenter-v*) echo 'os=["macos-latest"]' >> "$GITHUB_OUTPUT" ;;`));
ck('plan: sonst macOS + Windows', wf.includes(`*) echo 'os=["macos-latest","windows-latest"]' >> "$GITHUB_OUTPUT" ;;`));
ck('release: Liste aus plan', wf.includes('needs: plan') && wf.includes('os: ${{ fromJSON(needs.plan.outputs.os) }}'));
const releaseIf = wf.split('\n').find((z) => z.includes("!startsWith(github.ref_name, 'ndi-screen-capture-v')"))!;
ck('Presenter nicht vom Release-Job ausgeschlossen (Mac baut weiter)', !releaseIf.includes("'presenter-v'"));
ck('kein Katalog-Bump für den Presenter', wf.includes("if: ${{ needs.release.result == 'success' && !startsWith(github.ref_name, 'presenter-v') }}"));
```

  Run: `npx tsx test/release-weg.test.ts` → FAIL bei allen fünf.
- [ ] **Step 2: `suite-release.yml` ändern.** Vor `release:` diesen Job einfügen; in `release:` `needs: plan` und `os: ${{ fromJSON(needs.plan.outputs.os) }}` statt der festen Liste (`if:` bleibt); `bump-manifest` bekommt das `if` aus dem Test. Kommentare: Kopfblock des Release-Jobs um „presenter ab 0.13.0: Windows lokal mit NDI (#303), hier nur macOS“ ergänzen, Bump-Kommentar um „presenter: latestVersion zieht der Owner lokal nach, wenn exe und beide dmg am Release hängen“.

```yaml
  # Presenter ab 0.13.0 (#303): Das Windows-Paket mit NDI baut der Owner lokal; die CI baut nur das Mac-Paket ohne NDI.
  # Job-`if` kennt matrix nicht, darum die Plattformliste aus diesem Job.
  plan:
    name: Plattformen bestimmen
    runs-on: ubuntu-latest
    outputs:
      os: ${{ steps.os.outputs.os }}
    steps:
      - id: os
        shell: bash
        env:
          TAG: ${{ github.ref_name }}
        run: |
          case "$TAG" in
            presenter-v*) echo 'os=["macos-latest"]' >> "$GITHUB_OUTPUT" ;;
            *) echo 'os=["macos-latest","windows-latest"]' >> "$GITHUB_OUTPUT" ;;
          esac
```

- [ ] **Step 3: Test grün.** `npx tsx test/release-weg.test.ts` → 0 FAIL.
- [ ] **Step 4: Version und README.** `npm version 0.13.0 -w @jm/presenter --no-git-tag-version`; `git diff --stat` → nur `apps/presenter/package.json` und `package-lock.json` (je eine Versionszeile). README: Funktionsliste um „NDI-Ausgang (Windows)“ (Quelle, Schalter, „Keiner – nur NDI“, Transparenz-Regeln); unter „Entwicklung“: Windows-Paket nur mit `NDI_SDK_DIR` (`npm run dist:win -- --publish never`, `CSC_IDENTITY_AUTO_DISCOVERY=false`), Mac-Paket per CI ohne NDI, `latestVersion` erst nach exe + dmg.
- [ ] **Step 5: Gesamtprüfung unter Node 24 und 22.** `npm run selftest -w @jm/presenter` und `npm run typecheck -w @jm/presenter` (Node 24). Node 22 (CI): `$n22 = (Get-ChildItem "$env:LOCALAPPDATA\npm-cache\_npx" -Recurse -Filter node.exe -ErrorAction SilentlyContinue | Where-Object { (& $_.FullName -v) -like 'v22.*' } | Select-Object -First 1).FullName` (keiner da: `npx -y node@22 -v` legt einen an); in WT/apps/presenter jede Datei des `selftest`-Skripts einzeln mit `& $n22 ..\..\node_modules\tsx\dist\cli.mjs test\<datei>` (die erste mit `& $n22 --experimental-strip-types test\suite-state.test.ts`). Expected: überall 0 FAIL; Zahlen notieren.
- [ ] **Step 6: Commit** `chore(release): presenter 0.13.0, Release-Weg Windows lokal / Mac per CI (#303)` mit Workflow, Test, `package.json`, `package-lock.json`, README. SHA notieren: Das ist der Release-Commit.
- [ ] **Step 7: Endbau aus dem Release-Commit.** `git status --short` leer, `git rev-parse HEAD` = notierter SHA. In WT/apps/presenter: `$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"`; `npm run dist:win -- --publish never` → `release/JM Presenter-0.13.0-win-x64.exe` und `release/win-unpacked`; darauf `node test/pruefstand.mjs` → 0 FAIL (Zahlen notieren). Kommt danach noch ein Commit auf den Branch, Release-SHA neu notieren und diesen Schritt wiederholen.
- [ ] **Step 8: Branch pushen, PR.** `git push -u origin feat/presenter-ndi-303`; `gh pr create --base main` mit Titel `Presenter 0.13.0: NDI-Ausgang mit Alphakanal (#303)`, im Text `Closes #303` (englisches Schlüsselwort), Prüfzahlen (Selbsttest Node 22/24, Prüfstand), offene Hand-Abnahme (Task 10), „erst nach dem Release mergen (Owner)“, Schluss `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. CI-Checks des PR grün abwarten.
- [ ] **Step 9: Mac-Probe aus der CI.** `gh workflow run suite-build.yml --ref feat/presenter-ndi-303 -f app=presenter`; Lauf abwarten. Expected: Job `presenter · macos-latest` grün mit `[bundle-ndi] Nur Windows …` im Log und Artefakt mit zwei DMGs (arm64, x64); `presenter · windows-latest` scheitert erwartbar an `NDI_SDK_DIR nicht gesetzt` (im PR vermerken). DMGs mit `gh run download <id> -n jm-presenter-macos-latest` für Task 10 holen.
- [ ] **Step 10: Notes-Entwurf zur Owner-Freigabe** (NICHT committen, bevor der Owner zustimmt). Vorschlag:
  - „Neu: NDI-Ausgang (Windows). Der Presenter gibt sein Publikumsbild zusätzlich als NDI-Quelle „JM Presenter“ aus, 1920×1080 mit 25 Bildern pro Sekunde. Was die Folie nicht ausfüllt, ist durchsichtig: Ein Hochkant-Bild vom Handy lässt sich in OBS, vMix oder TriCaster direkt über das Livebild legen, ohne Zuschneiden.“
  - „Eingeschaltet wird NDI mit dem Knopf „NDI“ in der Werkzeugleiste oder in der Referentenansicht; er zeigt, wie viele Empfänger verbunden sind. Der Presenter merkt sich die Einstellung und startet NDI beim nächsten Mal von selbst.“
  - „Übergänge, Einblendungen und Weißbild erscheinen in NDI wie auf dem Bildschirm. Schwarzbild und eine beendete Präsentation sind in NDI durchsichtig, damit nichts Schwarzes über dem Livebild liegt.“
  - „Ohne zweiten Bildschirm: Bei eingeschaltetem NDI gibt es im Feld „Publikums-Bildschirm“ den Eintrag „Keiner – nur NDI“. Dann öffnet „Präsentieren“ nur die Referentenansicht, und das Bild geht allein über NDI.“
  - „Auf dem Mac gibt es den NDI-Ausgang noch nicht; dort zeigt der Knopf „NDI nicht verfügbar“.“

---

### Task 10: Hand-Abnahme mit dem Owner

**Files:** keine (Ergebnisse als PR-Kommentar).

**Interfaces:**
- Consumes: exe aus Task 9 Step 7, Mac-DMGs aus Task 9 Step 9, `test/ndi-messung.mjs`.
- Produces: protokollierte Abnahme 1–7 des Entwurfs; Freigabe oder Stopp für Task 11.

- [ ] **Step 1: Installieren.** Nur mit Owner-OK (ersetzt dort die installierte Fassung): exe 0.13.0 auf dem Arbeitsrechner und auf dem Show-Rechner der Kolleg:innen (bzw. dem schwächsten vorgesehenen); NDI im Presenter an.
- [ ] **Step 2: Abnahme 1–5 in OBS oder vMix** (TriCaster, wenn verfügbar): Quelle „<Rechner> (JM Presenter)“ erscheint; Hochkant-Bild liegt mit transparenten Rändern über einem Livebild; Überblendung und Schnitt wie auf dem Bildschirm; Schwarz → transparent, Weiß → weiß, gestoppt → transparent; „Keiner – nur NDI“ ohne Publikums-Bildschirm; Neustart mit NDI an → Quelle kommt von selbst.
- [ ] **Step 3: Abnahme 6 auf dem Show-Rechner.** Projekt mit Blende 1 s und Schleife (Standzeit 5 s) 30 Minuten laufen lassen. Vom Arbeitsrechner im selben Netz: `node test/ndi-messung.mjs --quelle "<SHOWRECHNER> (JM Presenter)" --sekunden 1800` → Exit 0 (mindestens 44 998 Bilder, keine Lücke über 80 ms); NDI Studio Monitor parallel ohne Ruckler. CPU (Summe aller JM-Presenter-Prozesse im Task-Manager) bei Standbild und während einer Blende notieren; Weiterschalten ohne spürbare Verzögerung; Bildschirm-Ausgang unverändert. Schafft der Rechner die 25 fps während Blenden nicht: STOPP, dem Owner berichten, keine adaptive Bildrate.
- [ ] **Step 4: Abnahme 7.** Mac-DMG aus der Probe auf einem Mac starten → Knopf „NDI nicht verfügbar“, Präsentation mit Publikumsfenster läuft. Ohne Mac: als offene Abnahme im PR, Owner entscheidet. (Windows ohne Laufzeit belegt Prüfstand-Fall 15.)
- [ ] **Step 5: Protokoll** mit allen Zahlen als PR-Kommentar; Owner entscheidet über Task 11.

---

### Task 11: Release im Fenster 18:00–06:00 Berlin

**Files:**
- Modify (auf `main`): `packages/suite-manifest/changelog.json`, danach `packages/suite-manifest/suite.json`

**Interfaces:**
- Consumes: Owner-Freigabe der Notes (Task 9 Step 10) und der Abnahme (Task 10); Release-Commit-SHA und exe (Task 9 Step 7).
- Produces: GitHub-Release `presenter-v0.13.0` mit genau drei Installern; Katalog `latestVersion` 0.13.0.

- [ ] **Step 1: Vorbedingungen.** Owner-Freigabe der Notes und der Abnahme liegen vor; Uhrzeit Berlin zwischen 18:00 und 06:00; `git rev-parse HEAD` in WT = Release-SHA; exe-Zeitstempel nach dem Release-Commit.
- [ ] **Step 2: Changelog auf `main`.** Eigener Worktree: `git -C C:/Users/alexk/alexzvn worktree add --detach C:/Users/alexk/alexzvn/.claude/worktrees/presenter-ndi-303-main origin/main` (nie `git checkout main` in einem geteilten Worktree). Dort im Block `"app": "presenter"` als ersten Eintrag `{ "version": "0.13.0", "date": "<Tag des Release>", "notes": [<freigegebene Texte>] }`. Prüfen: `node -e "JSON.parse(require('fs').readFileSync('packages/suite-manifest/changelog.json','utf8'))"` ohne Fehler, keine ASCII-`"` innerhalb der Notes, Zeilenenden wie vorher. Commit `chore(manifest): Changelog presenter 0.13.0 (#303) [skip ci]`, `git push origin HEAD:main`.
- [ ] **Step 3: Tag pushen** (allein, ein Tag je Push): `git tag presenter-v0.13.0 <Release-SHA>`; `git push origin presenter-v0.13.0`. Der Lauf nimmt `suite-release.yml` aus dem Tag-Commit; der Release-Commit enthält die neue Fassung (Task 9 Step 6).
- [ ] **Step 4: CI beobachten.** `gh run list --workflow suite-release.yml --limit 1`, `gh run watch <id>`. Expected: `plan` und `macos-latest` grün, kein Windows-Job, `bump-manifest` übersprungen; Release `presenter-v0.13.0` mit `JM Presenter-0.13.0-mac-arm64.dmg` und `JM Presenter-0.13.0-mac-x64.dmg`. Läuft ein Windows-Job mit oder ist der Mac-Job rot: STOPP, nichts hochladen, Katalog nicht anfassen, Owner fragen.
- [ ] **Step 5: Windows-Installer anhängen.** `gh release upload presenter-v0.13.0 "apps/presenter/release/JM Presenter-0.13.0-win-x64.exe"`. `gh release view presenter-v0.13.0 --json assets --jq '.assets[] | .name + " " + (.size|tostring)'` → genau die drei Namen, exe-Größe = lokale Dateigröße.
- [ ] **Step 6: Katalog nachziehen.** Im Worktree aus Step 2: `git pull --ff-only origin main`; `node scripts/bump-manifest.mjs presenter 0.13.0`; `git add packages/suite-manifest/suite.json`, `git status --short`; Commit `chore(manifest): presenter latestVersion → 0.13.0 [skip ci]`; `git push origin HEAD:main`. Worktree danach entfernen.
- [ ] **Step 7: Nachprüfen.** Launcher zeigt Presenter 0.13.0 mit den Notes (fehlen sie: Proxy-Katalog `MANIFEST_REF`, Memory „launcher-catalog-publishing“). Update auf einem Rechner mit 0.12.0 über den Launcher. PR erst danach mergen, nur mit Owner-OK.
