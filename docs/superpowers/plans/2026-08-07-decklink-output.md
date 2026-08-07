# `@jm/decklink` — natives DeckLink-Addon (Lane D2a) — Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein natives Addon, das eine Blackmagic-DeckLink-Karte findet, ihre Ausgabe-Normen wahrheitsgemäß beschreibt, eine davon öffnet und BGRA-Vollbilder taktfest über SDI ausgibt — und dabei jeden Bildverlust getrennt zählt.

**Architecture:** COM-Anbindung an den Desktop-Video-Treiber in einem N-API-Addon. Der Header entsteht erst beim Bau per MIDL aus der IDL des SDK. Das Urteil darüber, welche Norm benutzbar ist, liegt bewusst **nicht** im C++, sondern als reines TypeScript-Modul daneben — damit es ohne Hardware prüfbar ist. Die Ausgabe läuft als geplante Wiedergabe mit kleinem Vorlauf; der Treiber-Rückruf zählt nur atomar und fasst niemals JavaScript an.

**Tech Stack:** C++ (N-API / node-addon-api 8), MIDL aus dem Windows SDK, node-gyp, TypeScript via `node --experimental-strip-types`.

**Spec:** `docs/superpowers/specs/2026-08-07-decklink-output-design.md`

## Global Constraints

- **Nur Windows.** `maybe-build.mjs` und `generate-idl.mjs` beenden sich auf anderen Plattformen mit Erfolg und ohne Wirkung, damit `npm install` in CI und im Linux-Codespace durchläuft.
- **Ohne `DECKLINK_SDK_DIR` passiert nichts** — überspringen, nicht scheitern. Gleiches Muster wie `packages/ndi/scripts/maybe-build.mjs`.
- ⚑ **`DECKLINK_SDK_DIR` enthält drei Leerzeichen:** `C:\Users\alexk\Documents\Jakobs Medien\Production Suite\SDKs\Blackmagic_DeckLink_SDK_16.0\Blackmagic DeckLink SDK 16.0`. **Jeder Pfad in jeder Werkzeugzeile muss zitiert werden.**
- **Das SDK liefert nur IDL.** `DeckLinkAPI.h` und `DeckLinkAPI_i.c` entstehen bei jedem Bau neu. Sie sind Bau-Erzeugnisse und gehören nicht in git.
- **Nichts mitzuliefern:** kein DLL-Bündeln. Die Implementierung kommt zur Laufzeit aus dem installierten Desktop-Video-Treiber.
- **Keine Skalierung, keine Farbwandlung.** Passt ein Bild nicht zur geöffneten Norm, wird es **abgewiesen**, nicht zurechtgebogen.
- **Kein Ton, keine Halbbilder, kein Multiview, kein Genlock, keine Karten-Eingänge, kein 4K, kein Mac.**
- **Der Treiber-Rückruf fasst kein JavaScript an** — nur `std::atomic`-Zähler. Deshalb braucht dieses Addon **keine** `ThreadSafeFunction`.
- **Kein Release.** Das Paket ist `"private": true` und wird nicht getaggt.
- Umlaute in Commit-Botschaften vermeiden (ue/oe/ae). In deutschen Quelltext-Kommentaren ebenfalls transliterieren — die Datei wird von MSVC übersetzt und die Kodierung ist nicht garantiert.
- Beim Stagen ausschließlich eigene Pfade nennen; im Arbeitsverzeichnis liegt eine fremde Änderung an `apps/ndi-screen-capture/resources/bin/win/jm_ndi.node`, die nicht angefasst wird. Nach jedem `git add` `git status --short` lesen.

## Bewusste Abweichungen von der Spec

Beide fielen beim Lesen des erzeugten Headers auf, nicht beim Entwerfen:

1. **Kein BGRA→UYVY-Fallback.** Die Spec sah vor, im Addon nach UYVY zu wandeln, wenn die Karte BGRA nicht kann. Das ist eine Farbmatrix samt Chroma-Unterabtastung — echte Arbeit, die **hier an keiner Hardware prüfbar** ist. Stattdessen: `listOutputModes` meldet `supportsBGRA` je Norm, `judgeModes` stuft Normen ohne BGRA als unbenutzbar mit dem Grund `'pixelformat'` ein, und `openOutput` weist sie mit klarer Meldung ab. Die Oberfläche bietet sie dann gar nicht erst an. Der UYVY-Weg wird eine eigene Scheibe, **wenn** eine echte Karte ihn verlangt.
2. **`bmdProgressiveSegmentedFrame` ist ein eigener Fall.** Die Feldkennung kennt fünf Werte, nicht zwei. PsF ist weder echtes Halbbild noch schlichtes Vollbild. `DisplayMode` trägt deshalb `segmented` zusätzlich zu `interlaced`, und `Unusable` bekommt den Wert `'segmented'`.

## Dateien

| Datei | Verantwortung |
|---|---|
| `packages/decklink/package.json` | Paketdefinition, Skripte (`install`/`rebuild`/`selftest`/`spike`). |
| `packages/decklink/.gitignore` | `build/` und `generated/` heraushalten. |
| `packages/decklink/scripts/generate-idl.mjs` | MIDL-Lauf → `generated/`. Idempotent. |
| `packages/decklink/scripts/maybe-build.mjs` | Riegel: ohne SDK/Windows passiert nichts. |
| `packages/decklink/src/modes.ts` | **Reine** Logik: `DisplayMode`, `judgeModes`, `modeToProgramSettings`. |
| `packages/decklink/test/selftest.ts` | Selbsttest der reinen Logik, ohne Hardware. |
| `packages/decklink/binding.gyp` | Addon-Ziel, `generated/` als Include + GUID-Quelle. |
| `packages/decklink/src/addon.cc` | Die COM-Anbindung. |
| `packages/decklink/index.js` / `index.d.ts` | Ladepfad + Typen. |
| `packages/decklink/test/spike.mjs` | Sondierlauf an echter Karte, bewegtes Testbild. |

---

### Task 1: Paketgerüst und MIDL-Erzeugung

Der riskanteste Schritt zuerst. Danach steht der Header, gegen den alles Weitere übersetzt.

**Files:**
- Create: `packages/decklink/package.json`
- Create: `packages/decklink/.gitignore`
- Create: `packages/decklink/scripts/generate-idl.mjs`
- Create: `packages/decklink/scripts/maybe-build.mjs`

**Interfaces:**
- Consumes: nichts.
- Produces: `packages/decklink/generated/DeckLinkAPI.h` und `generated/DeckLinkAPI_i.c` (Bau-Erzeugnisse, von Task 3 benötigt). Skripte: `npm run generate -w @jm/decklink`, `npm run rebuild -w @jm/decklink`.

- [ ] **Step 1: Paketdefinition anlegen**

`packages/decklink/package.json`:

```json
{
  "name": "@jm/decklink",
  "version": "0.1.0",
  "private": true,
  "description": "Native DeckLink-Bindings (SDI-Ausgabe) fuer die JM Production Suite",
  "main": "index.js",
  "types": "index.d.ts",
  "scripts": {
    "install": "node scripts/maybe-build.mjs",
    "generate": "node scripts/generate-idl.mjs",
    "rebuild": "node scripts/generate-idl.mjs && node-gyp rebuild",
    "selftest": "node --experimental-strip-types test/selftest.ts",
    "spike": "node --experimental-strip-types test/spike.mjs"
  },
  "dependencies": {
    "bindings": "^1.5.0",
    "node-addon-api": "^8.0.0"
  },
  "devDependencies": {
    "node-gyp": "^10.0.0"
  }
}
```

`packages/*` ist bereits eine Workspace-Glob in der Wurzel-`package.json` — es ist **nichts** zu registrieren.

- [ ] **Step 2: Bau-Erzeugnisse aus git heraushalten**

`packages/decklink/.gitignore`:

```
build/
generated/
```

- [ ] **Step 3: Den MIDL-Lauf schreiben**

`packages/decklink/scripts/generate-idl.mjs`:

```js
// Erzeugt DeckLinkAPI.h + DeckLinkAPI_i.c aus der IDL des DeckLink-SDK.
//
// WARUM ueberhaupt: das SDK liefert NUR .idl-Dateien (21 Stueck) und genau einen
// fertigen Header (DeckLinkAPIVersion.h). Anders als beim NDI-SDK gibt es weder
// fertige Header noch eine Import-Bibliothek — die Schnittstelle ist COM, und die
// GUIDs stecken in der erzeugten _i.c. Blackmagics eigene Beispiele loesen das ueber
// einen MSBuild-<Midl>-Schritt; node-gyp hat den nicht, also erzeugen wir vorher.
//
// MIDL braucht die Visual-Studio-Umgebung (Praeprozessor + Windows-SDK-Includes),
// deshalb der Umweg ueber VsDevCmd.bat.
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const genDir = join(pkgRoot, 'generated');

if (process.platform !== 'win32') {
  console.log('[@jm/decklink] Nicht-Windows — MIDL uebersprungen.');
  process.exit(0);
}

const sdk = process.env.DECKLINK_SDK_DIR;
if (!sdk) {
  console.log('[@jm/decklink] DECKLINK_SDK_DIR nicht gesetzt — MIDL uebersprungen.');
  process.exit(0);
}

const idl = join(sdk, 'Win', 'include', 'DeckLinkAPI.idl');
if (!existsSync(idl)) {
  console.warn(`[@jm/decklink] DeckLinkAPI.idl nicht gefunden unter "${idl}" — MIDL uebersprungen.`);
  process.exit(0);
}

// Idempotent, aber nicht naiv: statt "Header neuer als IDL" merken wir uns, AUS WELCHER
// IDL der Header entstand — Pfad, Groesse und Aenderungszeit. Ein blosser Zeitvergleich
// laesst sich austricksen: wird DECKLINK_SDK_DIR auf eine aeltere SDK-Fassung umgebogen
// oder ein Archiv mit alten Zeitstempeln daruebergelegt, gilt der ALTE Header weiter als
// aktuell. Bei einem COM-Header waere das fatal — falsche GUIDs und vtable-Layouts
// uebersetzen anstandslos und scheitern erst zur Laufzeit.
const header = join(genDir, 'DeckLinkAPI.h');
const iid = join(genDir, 'DeckLinkAPI_i.c');
const stampFile = join(genDir, '.source-stamp.json');

const idlStat = statSync(idl);
const stamp = { idl, size: idlStat.size, mtimeMs: idlStat.mtimeMs };

function stampMatches() {
  if (!existsSync(header) || !existsSync(iid) || !existsSync(stampFile)) return false;
  try {
    const prev = JSON.parse(readFileSync(stampFile, 'utf8'));
    return prev.idl === stamp.idl && prev.size === stamp.size && prev.mtimeMs === stamp.mtimeMs;
  } catch {
    return false; // unlesbarer Stempel: lieber neu erzeugen als raten
  }
}

if (stampMatches()) {
  console.log('[@jm/decklink] Header ist aktuell — MIDL uebersprungen.');
  process.exit(0);
}

// Visual Studio finden. vswhere liegt an einem festen Ort, seit VS 2017.
const vswhere = join(
  process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)',
  'Microsoft Visual Studio',
  'Installer',
  'vswhere.exe',
);
if (!existsSync(vswhere)) {
  console.error('[@jm/decklink] vswhere.exe nicht gefunden — Visual Studio (Build Tools) noetig.');
  process.exit(1);
}

const vsRoot = execSync(`"${vswhere}" -latest -products * -property installationPath`, {
  encoding: 'utf8',
})
  .trim()
  .split(/\r?\n/)[0];

const vsDevCmd = join(vsRoot, 'Common7', 'Tools', 'VsDevCmd.bat');
if (!existsSync(vsDevCmd)) {
  console.error(`[@jm/decklink] VsDevCmd.bat nicht gefunden unter "${vsDevCmd}".`);
  process.exit(1);
}

mkdirSync(genDir, { recursive: true });

// Alles zitieren: SDK-Pfad UND VS-Pfad enthalten Leerzeichen.
// >nul unterdrueckt nur das Banner von VsDevCmd, nicht MIDLs Meldungen.
const line =
  `"${vsDevCmd}" -arch=x64 -host_arch=x64 >nul && ` +
  `midl /nologo /env x64 /h DeckLinkAPI.h /iid DeckLinkAPI_i.c /out "${genDir}" "${idl}"`;

console.log('[@jm/decklink] MIDL laeuft …');
execSync(line, { stdio: 'inherit', windowsHide: true });

if (!existsSync(header) || !existsSync(iid)) {
  console.error('[@jm/decklink] MIDL meldete Erfolg, aber die Dateien fehlen.');
  process.exit(1);
}
// Stempel ERST nach der Erfolgspruefung schreiben — sonst gaebe ein halb gescheiterter
// Lauf beim naechsten Mal faelschlich "ist aktuell" zurueck.
writeFileSync(stampFile, JSON.stringify(stamp, null, 2), 'utf8');
console.log('[@jm/decklink] Header erzeugt.');
```

Der Schlusstest ist Absicht: ein Werkzeug, das „Erfolg" meldet und nichts hinterlässt, ist eine
bekannte Falle. Die Prüfung kostet nichts und fängt sie.

Der **Quell-Stempel** statt eines Zeitvergleichs ist die zweite Absicht. „Header neuer als IDL"
lässt sich austricksen: wird `DECKLINK_SDK_DIR` auf eine ältere SDK-Fassung umgebogen oder ein
Archiv mit alten Zeitstempeln darübergelegt, gilt der alte Header weiter als aktuell. Bei einem
**COM**-Header wäre das der schlimmste Fall — falsche GUIDs und vtable-Layouts übersetzen
anstandslos und scheitern erst zur Laufzeit.

- [ ] **Step 4: Den Bauriegel schreiben**

`packages/decklink/scripts/maybe-build.mjs`:

```js
// Riegel: baut das native Addon nur auf Windows und nur mit vorhandenem DeckLink-SDK
// (DECKLINK_SDK_DIR). So bricht `npm install` in CI und im Linux-Codespace NICHT.
// Gleiches Muster wie packages/ndi/scripts/maybe-build.mjs.
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

if (process.platform !== 'win32') {
  console.log('[@jm/decklink] Nicht-Windows — nativer Build uebersprungen.');
  process.exit(0);
}

const sdk = process.env.DECKLINK_SDK_DIR;
if (!sdk) {
  console.log('[@jm/decklink] DECKLINK_SDK_DIR nicht gesetzt — nativer Build uebersprungen.');
  console.log('[@jm/decklink] Desktop-Video-SDK laden, DECKLINK_SDK_DIR setzen, dann `npm run rebuild -w @jm/decklink`.');
  process.exit(0);
}

if (!existsSync(join(sdk, 'Win', 'include', 'DeckLinkAPI.idl'))) {
  console.warn(`[@jm/decklink] DECKLINK_SDK_DIR="${sdk}" enthaelt kein Win/include/DeckLinkAPI.idl — Build uebersprungen.`);
  process.exit(0);
}

console.log(`[@jm/decklink] DeckLink-SDK gefunden (${sdk}) — baue natives Addon …`);
execSync('node scripts/generate-idl.mjs', { stdio: 'inherit' });
execSync('node-gyp rebuild', { stdio: 'inherit' });
```

- [ ] **Step 5: Den MIDL-Lauf ausführen**

Run: `npm run generate -w @jm/decklink`
Expected: `[@jm/decklink] Header erzeugt.`

- [ ] **Step 6: Das Erzeugnis prüfen**

Run:
```bash
ls -l packages/decklink/generated/
grep -c "IDeckLinkOutput" packages/decklink/generated/DeckLinkAPI.h
```
Expected: `DeckLinkAPI.h` (rund 758 KB), `DeckLinkAPI_i.c` (rund 19 KB), `DeckLinkAPI.tlb`.
Die Zählung für `IDeckLinkOutput` muss **deutlich über 100** liegen (auf dem Referenzrechner: 538).

- [ ] **Step 7: Prüfen, dass der zweite Lauf nichts tut — und dass der Stempel wirklich greift**

Run: `npm run generate -w @jm/decklink`
Expected: `[@jm/decklink] Header ist aktuell — MIDL uebersprungen.`

Dann die Gegenprobe, die ein reiner Zeitvergleich **nicht** bestanden hätte: die IDL künstlich
altern lassen und noch einmal laufen.

```bash
touch -d "2020-01-01" "$DECKLINK_SDK_DIR/Win/include/DeckLinkAPI.idl"
npm run generate -w @jm/decklink
```
Expected: **erzeugt neu** (`Header erzeugt.`). Danach den Zeitstempel zurücksetzen und ein
letztes Mal laufen, damit der Stempel wieder passt:

```bash
touch "$DECKLINK_SDK_DIR/Win/include/DeckLinkAPI.idl"
npm run generate -w @jm/decklink
```

- [ ] **Step 8: Prüfen, dass nichts Erzeugtes in git landet**

Run: `git status --short packages/decklink/`
Expected: **nur** `package.json`, `.gitignore` und die beiden Skripte erscheinen als neu.
`generated/` darf **nicht** auftauchen.

- [ ] **Step 9: Commit**

```bash
git add packages/decklink/package.json packages/decklink/.gitignore packages/decklink/scripts/generate-idl.mjs packages/decklink/scripts/maybe-build.mjs
git status --short
git commit -m "feat(decklink): Paketgeruest + MIDL-Erzeugung aus der SDK-IDL (Lane D2a)"
```

---

### Task 2: Reine Normen-Logik und Selbsttest

Kein C++, keine Hardware. Das ist die einzige Stelle mit echter Entscheidungslogik — deshalb liegt sie
hier und nicht im Addon.

**Files:**
- Create: `packages/decklink/src/modes.ts`
- Create: `packages/decklink/test/selftest.ts`

**Interfaces:**
- Consumes: nichts aus Task 1.
- Produces: `type DisplayMode`, `type Unusable`, `interface JudgedMode`, `const COMPOSABLE`, `const OFFERED_FPS`, `function judgeModes(modes: DisplayMode[]): JudgedMode[]`, `function modeToProgramSettings(m: DisplayMode): { resolution: '720p' | '1080p'; fps: number }` — alle aus `packages/decklink/src/modes.ts`. Task 3 re-exportiert `DisplayMode` aus `index.d.ts`.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`packages/decklink/test/selftest.ts` neu anlegen:

```ts
// Selbsttest der reinen Normen-Logik (Lane D2a). Braucht KEINE Karte und KEIN SDK.
//   npm run selftest -w @jm/decklink
import { judgeModes, modeToProgramSettings, type DisplayMode } from '../src/modes.ts';

let failures = 0;
function assert(cond: boolean, name: string): void {
  if (cond) console.log(`  ok  ${name}`);
  else {
    failures++;
    console.error(`FAIL  ${name}`);
  }
}

/** Baut eine Norm, wie die Karte sie liefern wuerde. fpsN/fpsD = Zeitskala/Dauer. */
function mode(over: Partial<DisplayMode>): DisplayMode {
  return {
    mode: 'Hp25',
    name: '1080p25',
    width: 1920,
    height: 1080,
    fpsN: 25000,
    fpsD: 1000,
    interlaced: false,
    segmented: false,
    supportsBGRA: true,
    ...over,
  };
}

console.log('modes — Urteil je Norm:');
{
  const judged = judgeModes([
    mode({}), // 1080p25 — benutzbar
    mode({ mode: 'Hp50', name: '1080p50', fpsN: 50000 }), // benutzbar
    mode({ mode: 'hp50', name: '720p50', width: 1280, height: 720, fpsN: 50000 }), // benutzbar
    mode({ mode: 'Hi50', name: '1080i50', interlaced: true }), // Halbbild
    mode({ mode: 'Hp2f', name: '1080PsF25', segmented: true }), // segmentiert
    mode({ mode: '4k25', name: '2160p25', width: 3840, height: 2160 }), // Aufloesung
    mode({ mode: 'Hp23', name: '1080p23.98', fpsN: 24000, fpsD: 1001 }), // Bildrate
    mode({ mode: 'Hp30', name: '1080p30', fpsN: 30000, supportsBGRA: false }), // Pixelformat
  ]);
  const by = (m: string) => judged.find((j) => j.mode === m)!;

  assert(by('Hp25').usable && by('Hp25').reason === undefined, '1080p25 ist benutzbar, ohne Grund');
  assert(by('Hp50').usable, '1080p50 ist benutzbar');
  assert(by('hp50').usable, '720p50 ist benutzbar');
  assert(!by('Hi50').usable && by('Hi50').reason === 'interlaced', '1080i50: Grund interlaced');
  assert(!by('Hp2f').usable && by('Hp2f').reason === 'segmented', 'PsF: Grund segmented');
  assert(!by('4k25').usable && by('4k25').reason === 'resolution', '2160p25: Grund resolution');
  assert(!by('Hp23').usable && by('Hp23').reason === 'framerate', '23.98p: Grund framerate');
  assert(!by('Hp30').usable && by('Hp30').reason === 'pixelformat', 'ohne BGRA: Grund pixelformat');

  // Kein stilles Weglassen: JEDE eingehende Norm kommt zurueck, und jede unbenutzbare
  // traegt einen Grund. Eine Liste, aus der etwas kommentarlos fehlt, ist eine Anzeige,
  // die luegt — die Lehre aus switcher-v0.10.0.
  assert(judged.length === 8, 'jede eingehende Norm kommt zurueck');
  assert(
    judged.every((j) => j.usable || j.reason !== undefined),
    'jede unbenutzbare Norm traegt einen Grund',
  );
}

console.log('modes — Abbildung auf Switcher-Einstellungen:');
{
  assert(
    modeToProgramSettings(mode({})).resolution === '1080p',
    '1920x1080 wird zu 1080p',
  );
  assert(
    modeToProgramSettings(mode({ width: 1280, height: 720 })).resolution === '720p',
    '1280x720 wird zu 720p',
  );
  assert(modeToProgramSettings(mode({})).fps === 25, '25000/1000 wird zu 25');
  // Bruchraten sind zugelassen und driften bewusst: 30000/1001 ist 29,97, nicht 30.
  // Der Switcher taktet danach 0,1 % schneller als die Karte — sichtbar in den
  // repeated/rejected-Zaehlern, nicht wegdefiniert.
  assert(
    modeToProgramSettings(mode({ fpsN: 30000, fpsD: 1001 })).fps === 30,
    '30000/1001 wird auf 30 gerundet',
  );
  assert(
    modeToProgramSettings(mode({ fpsN: 60000, fpsD: 1001 })).fps === 60,
    '60000/1001 wird auf 60 gerundet',
  );
}

if (failures) {
  console.error(`\n${failures} Selbsttest(s) fehlgeschlagen.`);
  process.exit(1);
}
console.log('\nAlle @jm/decklink-Selbsttests gruen.');
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npm run selftest -w @jm/decklink`
Expected: FAIL mit `ERR_MODULE_NOT_FOUND` für `../src/modes.ts`.

- [ ] **Step 3: Die reine Logik schreiben**

`packages/decklink/src/modes.ts` neu anlegen:

```ts
// Reine Normen-Logik der DeckLink-Ausgabe. BEWUSST ohne jede native Abhaengigkeit,
// damit der Selbsttest sie unter blossem Node laden kann — dieselbe Trennung wie
// @shared/output-quality im Switcher.
//
// Das Addon BESCHREIBT nur, was die Karte kann; das Urteil faellt hier.

/** Eine Ausgabe-Norm, so wie die Karte sie meldet. */
export interface DisplayMode {
  /** BMD-Kennung als Vierzeichenkuerzel, z. B. 'Hp25'. Damit wird geoeffnet. */
  mode: string;
  /** Name, wie die Karte ihn liefert, z. B. '1080p25'. */
  name: string;
  width: number;
  height: number;
  /** Bildrate als Bruch: fps = fpsN / fpsD. 1080p25 meldet 25000/1000. */
  fpsN: number;
  fpsD: number;
  /** Echtes Halbbild (unteres oder oberes Feld zuerst). */
  interlaced: boolean;
  /** Progressive Segmented Frame — weder echtes Halbbild noch schlichtes Vollbild. */
  segmented: boolean;
  /** Kann diese Karte diese Norm mit BGRA ausgeben? */
  supportsBGRA: boolean;
}

/** Aufloesungen, die der Switcher komponieren kann (Spiegel von RESOLUTIONS dort). */
export const COMPOSABLE: ReadonlyArray<{ w: number; h: number }> = [
  { w: 1280, h: 720 },
  { w: 1920, h: 1080 },
];

/** Bildraten, die der Switcher anbietet (Spiegel von OUTPUT_FPS_OPTIONS dort). */
export const OFFERED_FPS: readonly number[] = [25, 30, 50, 60];

/** Warum eine Norm nicht benutzbar ist. Wird angezeigt, nie verschwiegen. */
export type Unusable = 'interlaced' | 'segmented' | 'resolution' | 'framerate' | 'pixelformat';

export interface JudgedMode extends DisplayMode {
  usable: boolean;
  /** Nur gesetzt, wenn `usable` falsch ist. */
  reason?: Unusable;
}

/** Gerundete Bildrate der Norm. 30000/1001 ergibt 30. */
function roundedFps(m: DisplayMode): number {
  if (!m.fpsD) return 0;
  return Math.round(m.fpsN / m.fpsD);
}

/**
 * Jede Norm einstufen — und JEDE zurueckgeben. Unbenutzbare tragen einen Grund, damit
 * die Oberflaeche sie ausgegraut MIT Begruendung zeigen kann. Eine Liste, aus der etwas
 * kommentarlos fehlt, ist eine Anzeige, die luegt (Lehre aus switcher-v0.10.0).
 *
 * Reihenfolge der Gruende ist Absicht: die grundsaetzlichste Unvertraeglichkeit zuerst.
 */
export function judgeModes(modes: DisplayMode[]): JudgedMode[] {
  return modes.map((m) => {
    let reason: Unusable | undefined;
    if (m.interlaced) reason = 'interlaced';
    else if (m.segmented) reason = 'segmented';
    else if (!COMPOSABLE.some((c) => c.w === m.width && c.h === m.height)) reason = 'resolution';
    else if (!OFFERED_FPS.includes(roundedFps(m))) reason = 'framerate';
    else if (!m.supportsBGRA) reason = 'pixelformat';
    return reason ? { ...m, usable: false, reason } : { ...m, usable: true };
  });
}

/**
 * Norm → Switcher-Einstellungen. Nur fuer benutzbare Normen sinnvoll.
 *
 * Bruchraten werden gerundet und driften dadurch bewusst: 29,97p wird zu 30, der Switcher
 * taktet danach 0,1 % schneller als die Karte. Das ist keine Nachlaessigkeit, sondern die
 * Folge fehlender Synchronisation — sichtbar in den repeated/rejected-Zaehlern der Ausgabe.
 */
export function modeToProgramSettings(m: DisplayMode): { resolution: '720p' | '1080p'; fps: number } {
  return {
    resolution: m.width >= 1920 ? '1080p' : '720p',
    fps: roundedFps(m),
  };
}
```

- [ ] **Step 4: Test laufen lassen, grün bestätigen**

Run: `npm run selftest -w @jm/decklink`
Expected: PASS, 15 Prüfungen, Abschlusszeile `Alle @jm/decklink-Selbsttests gruen.`

- [ ] **Step 5: Commit**

```bash
git add packages/decklink/src/modes.ts packages/decklink/test/selftest.ts
git status --short
git commit -m "feat(decklink): reine Normen-Logik + Selbsttest ohne Hardware (Lane D2a)"
```

---

### Task 3: Addon Teil 1 — COM, Karten und Normen auflisten

Ab hier C++. Diese Hälfte ist **auf diesem Rechner prüfbar**: ohne Karte muss `listDevices()` eine
leere Liste liefern, nicht abstürzen.

**Files:**
- Create: `packages/decklink/binding.gyp`
- Create: `packages/decklink/src/addon.cc`
- Create: `packages/decklink/index.js`
- Create: `packages/decklink/index.d.ts`

**Interfaces:**
- Consumes: `generated/DeckLinkAPI.h` und `generated/DeckLinkAPI_i.c` aus Task 1; `DisplayMode` aus Task 2 (`src/modes.ts`).
- Produces: `init()`, `listDevices()`, `listOutputModes(deviceIndex)`, `destroy()` — plus die Hilfsfunktionen `NewIterator()`, `DeviceAt()`, `TakeBstr()`, `FourCcToString()`, `StringToFourCc()` in `addon.cc`, die Task 4 weiterbenutzt.

- [ ] **Step 1: Die Bauvorschrift schreiben**

`packages/decklink/binding.gyp`:

```python
{
  "targets": [
    {
      "target_name": "jm_decklink",
      # DeckLinkAPI_i.c traegt die COM-GUIDs. Es gibt KEINE Import-Bibliothek —
      # anders als beim NDI-SDK. Beide Dateien erzeugt scripts/generate-idl.mjs.
      "sources": ["src/addon.cc", "generated/DeckLinkAPI_i.c"],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "generated"
      ],
      "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS", "NOMINMAX", "WIN32_LEAN_AND_MEAN"],
      "conditions": [
        ["OS=='win'", {
          # ole32: CoInitializeEx/CoCreateInstance. oleaut32: SysStringLen/SysFreeString (BSTR).
          "libraries": ["ole32.lib", "oleaut32.lib"]
        }]
      ]
    }
  ]
}
```

- [ ] **Step 2: Den Ladepfad und die Typen schreiben**

`packages/decklink/index.js`:

```js
// Laedt das native Addon (jm_decklink.node).
//
// Anders als @jm/ndi gibt es hier NICHTS mitzuliefern: die DeckLink-Implementierung
// kommt zur Laufzeit ueber COM aus dem installierten Desktop-Video-Treiber. Deshalb
// kein PATH-Gefummel, kein DLL-Buendeln, kein resources/bin-Sonderweg.
const path = require('node:path');
const fs = require('node:fs');

function bundledBinDir() {
  const res = process.resourcesPath;
  if (!res || process.platform !== 'win32') return null;
  const dir = path.join(res, 'bin', 'win');
  return fs.existsSync(path.join(dir, 'jm_decklink.node')) ? dir : null;
}

let addon;
try {
  const bundled = bundledBinDir();
  addon = bundled
    ? require(path.join(bundled, 'jm_decklink.node'))
    : require('bindings')('jm_decklink');
} catch (err) {
  throw new Error(
    '@jm/decklink: natives Addon konnte nicht geladen werden.\n' +
      '  Build (Windows): DECKLINK_SDK_DIR setzen, dann `npm run rebuild -w @jm/decklink`\n' +
      '  Laufzeit: Blackmagic Desktop Video installiert?\n' +
      'Urspruenglicher Fehler: ' +
      (err && err.message ? err.message : String(err)),
  );
}

module.exports = addon;
```

`packages/decklink/index.d.ts`:

```ts
/** Natives DeckLink-Addon (nur SDI-AUSGABE, nur Bild). Alle Aufrufe sind synchron. */

// DisplayMode lebt in src/modes.ts, damit die reine Logik und ihr Selbsttest ohne
// .d.ts-Import auskommen. Hier nur weitergereicht.
export type { DisplayMode } from './src/modes.ts';
import type { DisplayMode } from './src/modes.ts';

export interface DeckLinkDevice {
  index: number;
  /** Anzeigename der Karte, wie Desktop Video ihn nennt. */
  name: string;
  /** Hat die Karte einen Ausgang? Reine Eingangskarten melden false. */
  hasOutput: boolean;
}

/** COM hochfahren. Muss vor allem anderen laufen. */
export function init(): boolean;

/** Alle Karten auflisten. Leere Liste = keine Karte, das ist KEIN Fehler. */
export function listDevices(): DeckLinkDevice[];

/** Alle Ausgabe-Normen einer Karte. Beschreibt nur — das Urteil faellt judgeModes(). */
export function listOutputModes(deviceIndex: number): DisplayMode[];

/** Ausgang oeffnen. prerollFrames: 2–6, Vorgabe 2. */
export function openOutput(deviceIndex: number, mode: string, prerollFrames?: number): boolean;

/** Ein BGRA-Vollbild einreihen (tight packed, stride = width*4). */
export function scheduleFrameBGRA(buf: Uint8Array, width: number, height: number): boolean;

export interface OutputStats {
  /** Bilder, die die Karte noch vor sich hat. */
  queued: number;
  /** Von der KARTE als zu spaet gemeldet — deutet auf zu kleinen Vorlauf. */
  late: number;
  /** Von der KARTE verworfen. */
  dropped: number;
  /** Von UNS gezaehlt, weil die Warteschlange leerlief — deutet auf Drift oder stockenden Zulieferer. */
  repeated: number;
  /** Von UNS abgewiesen, weil die Warteschlange volllief. */
  rejected: number;
  /** Insgesamt eingereiht. */
  scheduled: number;
}
export function stats(): OutputStats;

export function closeOutput(): void;

/** Ausgang schliessen und COM herunterfahren. */
export function destroy(): void;
```

- [ ] **Step 3: Das Addon-Gerüst und die Aufzählung schreiben**

`packages/decklink/src/addon.cc`:

```cpp
// N-API-Addon fuer die Blackmagic-DeckLink-AUSGABE (SDI). Nur Windows, nur Ausgang,
// nur Bild — Ton, Halbbilder und Karten-Eingaenge sind ausdrueckliche Nicht-Ziele.
// Entwurf: docs/superpowers/specs/2026-08-07-decklink-output-design.md
//
// Die Schnittstelle ist COM. DeckLinkAPI.h und die GUID-Datei entstehen erst beim Bau
// aus der IDL des SDK (scripts/generate-idl.mjs) — das SDK liefert KEINE fertigen
// Header und KEINE Import-Bibliothek. Zur Laufzeit kommt die Implementierung aus dem
// installierten Desktop-Video-Treiber; mitzuliefern ist nichts.

#include <napi.h>
#include <windows.h>
#include "DeckLinkAPI.h"

#include <atomic>
#include <cstring>
#include <string>

namespace {

bool g_comReady = false;

void ThrowJs(napi_env env, const char* message) {
  napi_throw_error(env, nullptr, message);
}

/** BSTR nach UTF-8 uebernehmen UND freigeben. */
std::string TakeBstr(BSTR bstr) {
  if (!bstr) return std::string();
  const int wlen = static_cast<int>(SysStringLen(bstr));
  std::string out;
  if (wlen > 0) {
    const int len = WideCharToMultiByte(CP_UTF8, 0, bstr, wlen, nullptr, 0, nullptr, nullptr);
    if (len > 0) {
      out.resize(static_cast<size_t>(len));
      WideCharToMultiByte(CP_UTF8, 0, bstr, wlen, &out[0], len, nullptr, nullptr);
    }
  }
  SysFreeString(bstr);
  return out;
}

/** BMDDisplayMode ist ein FourCC. Als lesbares Vierzeichenkuerzel ausgeben ('Hp25'). */
std::string FourCcToString(uint32_t code) {
  const char s[5] = {
      static_cast<char>((code >> 24) & 0xFF),
      static_cast<char>((code >> 16) & 0xFF),
      static_cast<char>((code >> 8) & 0xFF),
      static_cast<char>(code & 0xFF),
      0,
  };
  return std::string(s);
}

uint32_t StringToFourCc(const std::string& s) {
  if (s.size() != 4) return 0;
  return (static_cast<uint32_t>(static_cast<unsigned char>(s[0])) << 24) |
         (static_cast<uint32_t>(static_cast<unsigned char>(s[1])) << 16) |
         (static_cast<uint32_t>(static_cast<unsigned char>(s[2])) << 8) |
         static_cast<uint32_t>(static_cast<unsigned char>(s[3]));
}

/** Iterator anlegen. nullptr heisst: Desktop Video ist nicht installiert. */
IDeckLinkIterator* NewIterator() {
  IDeckLinkIterator* it = nullptr;
  const HRESULT hr = CoCreateInstance(CLSID_CDeckLinkIterator, nullptr, CLSCTX_ALL,
                                      IID_IDeckLinkIterator, reinterpret_cast<void**>(&it));
  return SUCCEEDED(hr) ? it : nullptr;
}

/** Die n-te Karte holen. Aufrufer gibt frei. nullptr, wenn es sie nicht gibt. */
IDeckLink* DeviceAt(uint32_t index) {
  IDeckLinkIterator* it = NewIterator();
  if (!it) return nullptr;
  IDeckLink* dev = nullptr;
  uint32_t i = 0;
  while (it->Next(&dev) == S_OK) {
    if (i == index) {
      it->Release();
      return dev;
    }
    dev->Release();
    dev = nullptr;
    i++;
  }
  it->Release();
  return nullptr;
}

// init(): COM hochfahren.
// MTA, NICHT STA: der utilityProcess, der dieses Addon spaeter traegt, hat keine
// Windows-Nachrichtenschleife — ein Wohnungsmodell mit Pumpe wuerde dort verklemmen.
// Die DeckLink-Schnittstellen sind frei threadfaehig und brauchen keine Pumpe.
Napi::Value Init(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (!g_comReady) {
    const HRESULT hr = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
    // RPC_E_CHANGED_MODE heisst nur: COM laeuft schon, in einem anderen Modell.
    // Fuer uns kein Fehler.
    if (FAILED(hr) && hr != RPC_E_CHANGED_MODE) {
      ThrowJs(env, "CoInitializeEx fehlgeschlagen.");
      return env.Undefined();
    }
    g_comReady = true;
  }
  return Napi::Boolean::New(env, true);
}

// listDevices(): alle Karten. EINE LEERE LISTE IST EIN GUELTIGES ERGEBNIS —
// nur ein fehlender Treiber wirft.
Napi::Value ListDevices(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  IDeckLinkIterator* it = NewIterator();
  if (!it) {
    ThrowJs(env, "Blackmagic Desktop Video ist nicht installiert.");
    return env.Undefined();
  }

  Napi::Array out = Napi::Array::New(env);
  IDeckLink* dev = nullptr;
  uint32_t i = 0;
  while (it->Next(&dev) == S_OK) {
    BSTR nameBstr = nullptr;
    const std::string name =
        (dev->GetDisplayName(&nameBstr) == S_OK) ? TakeBstr(nameBstr) : std::string("DeckLink");

    IDeckLinkOutput* outIface = nullptr;
    const bool hasOutput =
        dev->QueryInterface(IID_IDeckLinkOutput, reinterpret_cast<void**>(&outIface)) == S_OK;
    if (outIface) outIface->Release();

    Napi::Object o = Napi::Object::New(env);
    o.Set("index", Napi::Number::New(env, i));
    o.Set("name", Napi::String::New(env, name));
    o.Set("hasOutput", Napi::Boolean::New(env, hasOutput));
    out.Set(i, o);

    dev->Release();
    dev = nullptr;
    i++;
  }
  it->Release();
  return out;
}

// listOutputModes(deviceIndex): BESCHREIBT jede Norm der Karte. Das Urteil, welche
// benutzbar ist, faellt bewusst in src/modes.ts — dort ist es ohne Hardware pruefbar.
Napi::Value ListOutputModes(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 1 || !info[0].IsNumber()) {
    ThrowJs(env, "listOutputModes(deviceIndex: number) erwartet");
    return env.Undefined();
  }
  const uint32_t index = info[0].As<Napi::Number>().Uint32Value();

  IDeckLink* dev = DeviceAt(index);
  if (!dev) {
    ThrowJs(env, "Keine Karte mit diesem Index.");
    return env.Undefined();
  }

  IDeckLinkOutput* outIface = nullptr;
  if (dev->QueryInterface(IID_IDeckLinkOutput, reinterpret_cast<void**>(&outIface)) != S_OK) {
    dev->Release();
    ThrowJs(env, "Diese Karte hat keinen Ausgang.");
    return env.Undefined();
  }

  IDeckLinkDisplayModeIterator* modeIt = nullptr;
  if (outIface->GetDisplayModeIterator(&modeIt) != S_OK) {
    outIface->Release();
    dev->Release();
    ThrowJs(env, "Normen der Karte nicht lesbar.");
    return env.Undefined();
  }

  Napi::Array arr = Napi::Array::New(env);
  IDeckLinkDisplayMode* mode = nullptr;
  uint32_t n = 0;
  while (modeIt->Next(&mode) == S_OK) {
    BSTR nameBstr = nullptr;
    const std::string name =
        (mode->GetName(&nameBstr) == S_OK) ? TakeBstr(nameBstr) : std::string();

    const BMDDisplayMode code = mode->GetDisplayMode();

    // ACHTUNG Reihenfolge: erst die DAUER, dann die Zeitskala.
    // Bildrate = timeScale / frameDuration (1080p25 meldet 1000 und 25000).
    BMDTimeValue frameDuration = 0;
    BMDTimeScale timeScale = 0;
    mode->GetFrameRate(&frameDuration, &timeScale);

    // Die Feldkennung kennt FUENF Werte, nicht zwei. PsF ist ein eigener Fall.
    const BMDFieldDominance fd = mode->GetFieldDominance();

    BMDDisplayMode actual = code;
    BOOL supported = FALSE;
    outIface->DoesSupportVideoMode(bmdVideoConnectionUnspecified, code, bmdFormat8BitBGRA,
                                   bmdNoVideoOutputConversion, bmdSupportedVideoModeDefault,
                                   &actual, &supported);

    Napi::Object o = Napi::Object::New(env);
    o.Set("mode", Napi::String::New(env, FourCcToString(static_cast<uint32_t>(code))));
    o.Set("name", Napi::String::New(env, name));
    o.Set("width", Napi::Number::New(env, static_cast<double>(mode->GetWidth())));
    o.Set("height", Napi::Number::New(env, static_cast<double>(mode->GetHeight())));
    o.Set("fpsN", Napi::Number::New(env, static_cast<double>(timeScale)));
    o.Set("fpsD", Napi::Number::New(env, static_cast<double>(frameDuration)));
    o.Set("interlaced",
          Napi::Boolean::New(env, fd == bmdLowerFieldFirst || fd == bmdUpperFieldFirst));
    o.Set("segmented", Napi::Boolean::New(env, fd == bmdProgressiveSegmentedFrame));
    o.Set("supportsBGRA", Napi::Boolean::New(env, supported == TRUE));
    arr.Set(n, o);

    mode->Release();
    mode = nullptr;
    n++;
  }
  modeIt->Release();
  outIface->Release();
  dev->Release();
  return arr;
}

// destroy(): in Task 4 um das Schliessen des Ausgangs erweitert.
Napi::Value Destroy(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (g_comReady) {
    CoUninitialize();
    g_comReady = false;
  }
  return env.Undefined();
}

Napi::Object InitModule(Napi::Env env, Napi::Object exports) {
  exports.Set("init", Napi::Function::New(env, Init));
  exports.Set("listDevices", Napi::Function::New(env, ListDevices));
  exports.Set("listOutputModes", Napi::Function::New(env, ListOutputModes));
  exports.Set("destroy", Napi::Function::New(env, Destroy));
  return exports;
}

}  // namespace

NODE_API_MODULE(jm_decklink, InitModule)
```

- [ ] **Step 4: Übersetzen**

Run: `npm run rebuild -w @jm/decklink`
Expected: MIDL überspringt (Header aktuell), `node-gyp rebuild` läuft ohne Fehler durch.
Ergebnis: `packages/decklink/build/Release/jm_decklink.node`.

**Wenn der Übersetzer meckert:** die Fehlermeldung ernst nehmen und die Signatur im erzeugten
Header nachlesen (`packages/decklink/generated/DeckLinkAPI.h`). Nicht raten — der Header ist die
Wahrheit, und er liegt vor.

- [ ] **Step 5: Ohne Karte laufen lassen — der eigentliche Test dieser Scheibe**

Run:
```bash
node -e "const d=require('./packages/decklink'); d.init(); const l=d.listDevices(); console.log('Karten:', l.length, JSON.stringify(l)); d.destroy();"
```
Expected auf diesem Rechner: `Karten: 0 []` und **kein Absturz**.
Eine leere Liste ist das richtige Ergebnis, kein Fehler.

**Ist Desktop Video hier nicht installiert**, wirft `listDevices()` stattdessen
„Blackmagic Desktop Video ist nicht installiert." — auch das ist ein bestandener Test dieser Scheibe.
Welcher der beiden Fälle eintrat, gehört in den Bericht.

- [ ] **Step 6: Commit**

```bash
git add packages/decklink/binding.gyp packages/decklink/src/addon.cc packages/decklink/index.js packages/decklink/index.d.ts
git status --short
git commit -m "feat(decklink): Addon Teil 1 — COM, Karten und Normen auflisten (Lane D2a)"
```

---

### Task 4: Addon Teil 2 — Ausgang öffnen, Bilder einreihen, Verlust zählen

**Files:**
- Modify: `packages/decklink/src/addon.cc`

**Interfaces:**
- Consumes: alle Hilfsfunktionen aus Task 3 (`NewIterator`, `DeviceAt`, `TakeBstr`, `StringToFourCc`, `ThrowJs`).
- Produces: `openOutput(deviceIndex, mode, prerollFrames?)`, `scheduleFrameBGRA(buf, width, height)`, `stats()`, `closeOutput()`; `destroy()` schließt jetzt zusätzlich den Ausgang.

- [ ] **Step 1: Zustand und Rückruf ergänzen**

In `packages/decklink/src/addon.cc` **direkt nach** `DeviceAt(...)` einfügen:

```cpp
// ===================== AUSGANG =====================
//
// Es gibt genau EINEN offenen Ausgang je Prozess — mehrere gleichzeitig sind
// Nicht-Ziel (gleiche Setzung wie @jm/ndi).

IDeckLink* g_device = nullptr;
IDeckLinkOutput* g_output = nullptr;
long g_width = 0;
long g_height = 0;
BMDTimeValue g_frameDuration = 0;
BMDTimeScale g_timeScale = 0;
uint32_t g_preroll = 2;
BMDTimeValue g_nextDisplayTime = 0;

// Zaehler. atomic, weil ScheduledFrameCompleted auf dem TREIBER-Thread laeuft.
// Getrennt gefuehrt, weil sie verschiedene Ursachen haben: late/dropped kommen von
// der Karte und deuten auf zu kleinen Vorlauf, repeated/rejected kommen von uns und
// deuten auf Drift oder einen stockenden Zulieferer. Ein gemeinsamer Zaehler
// "Bildfehler" wuerde genau die Diagnose zerstoeren, fuer die man ihn braucht.
std::atomic<uint64_t> g_late{0};
std::atomic<uint64_t> g_dropped{0};
std::atomic<uint64_t> g_repeated{0};
std::atomic<uint64_t> g_rejected{0};
std::atomic<uint64_t> g_scheduled{0};

// Der Treiber ruft ScheduledFrameCompleted auf SEINEM Thread. Hier darf NICHTS mit
// JavaScript passieren — nur atomare Zaehler. Genau deshalb braucht dieses Addon
// keine ThreadSafeFunction.
//
// Das uebergebene Bild ist GELIEHEN: ScheduleVideoFrame haelt seine eigene Referenz
// und gibt sie nach Abschluss selbst frei. Hier NICHT Release aufrufen.
class OutputCallback : public IDeckLinkVideoOutputCallback {
 public:
  HRESULT STDMETHODCALLTYPE ScheduledFrameCompleted(IDeckLinkVideoFrame*,
                                                    BMDOutputFrameCompletionResult result) override {
    if (result == bmdOutputFrameDisplayedLate) {
      g_late.fetch_add(1, std::memory_order_relaxed);
    } else if (result == bmdOutputFrameDropped) {
      g_dropped.fetch_add(1, std::memory_order_relaxed);
    }
    return S_OK;
  }
  HRESULT STDMETHODCALLTYPE ScheduledPlaybackHasStopped() override { return S_OK; }

  // Der Rueckruf ist ein statisches Objekt und lebt so lange wie das Modul —
  // eine echte Referenzzaehlung waere hier nur Zierrat.
  HRESULT STDMETHODCALLTYPE QueryInterface(REFIID, LPVOID*) override { return E_NOINTERFACE; }
  ULONG STDMETHODCALLTYPE AddRef() override { return 1; }
  ULONG STDMETHODCALLTYPE Release() override { return 1; }
};

OutputCallback g_callback;

/** Ein schwarzes Bild einreihen (Vorlauf). Gibt false zurueck, wenn es nicht klappt. */
bool ScheduleBlackFrame() {
  if (!g_output) return false;
  IDeckLinkMutableVideoFrame* frame = nullptr;
  if (g_output->CreateVideoFrame(static_cast<int>(g_width), static_cast<int>(g_height),
                                 static_cast<int>(g_width) * 4, bmdFormat8BitBGRA,
                                 bmdFrameFlagDefault, &frame) != S_OK) {
    return false;
  }
  void* bytes = nullptr;
  if (frame->GetBytes(&bytes) == S_OK && bytes) {
    std::memset(bytes, 0, static_cast<size_t>(g_width) * static_cast<size_t>(g_height) * 4);
  }
  const HRESULT hr =
      g_output->ScheduleVideoFrame(frame, g_nextDisplayTime, g_frameDuration, g_timeScale);
  frame->Release();  // der Treiber haelt seine eigene Referenz
  if (FAILED(hr)) return false;
  g_nextDisplayTime += g_frameDuration;
  return true;
}

/** Ausgang schliessen. Idempotent. */
void CloseOutputInternal() {
  if (g_output) {
    BMDTimeValue actualStop = 0;
    g_output->StopScheduledPlayback(0, &actualStop, g_timeScale ? g_timeScale : 1000);
    g_output->SetScheduledFrameCompletionCallback(nullptr);
    g_output->DisableVideoOutput();
    g_output->Release();
    g_output = nullptr;
  }
  if (g_device) {
    g_device->Release();
    g_device = nullptr;
  }
  g_width = 0;
  g_height = 0;
  g_frameDuration = 0;
  g_timeScale = 0;
  g_nextDisplayTime = 0;
}
```

- [ ] **Step 2: `openOutput` schreiben**

**Direkt vor** `Napi::Value Destroy(...)` einfügen:

```cpp
// openOutput(deviceIndex, mode, prerollFrames?)
Napi::Value OpenOutput(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 2 || !info[0].IsNumber() || !info[1].IsString()) {
    ThrowJs(env, "openOutput(deviceIndex: number, mode: string, prerollFrames?: number) erwartet");
    return env.Undefined();
  }
  const uint32_t index = info[0].As<Napi::Number>().Uint32Value();
  const std::string modeStr = info[1].As<Napi::String>().Utf8Value();
  uint32_t preroll = 2;
  if (info.Length() >= 3 && info[2].IsNumber()) {
    preroll = info[2].As<Napi::Number>().Uint32Value();
  }
  // Vorgabe 2 (bei 25p rund 80 ms bis zum Bild) — der Ausgang bedient auch das
  // Saalbild, und dort ist Versatz gegen einen live sprechenden Menschen das
  // teurere Uebel. Bewusst die riskantere Einstellung; wer Ruckler sieht, dreht hoch.
  if (preroll < 2) preroll = 2;
  if (preroll > 6) preroll = 6;

  CloseOutputInternal();

  IDeckLink* dev = DeviceAt(index);
  if (!dev) {
    ThrowJs(env, "Keine Karte mit diesem Index.");
    return env.Undefined();
  }

  IDeckLinkOutput* out = nullptr;
  if (dev->QueryInterface(IID_IDeckLinkOutput, reinterpret_cast<void**>(&out)) != S_OK) {
    dev->Release();
    ThrowJs(env, "Diese Karte hat keinen Ausgang.");
    return env.Undefined();
  }

  const BMDDisplayMode wanted = static_cast<BMDDisplayMode>(StringToFourCc(modeStr));

  // Norm suchen und ihre Masse uebernehmen.
  IDeckLinkDisplayModeIterator* modeIt = nullptr;
  bool found = false;
  if (out->GetDisplayModeIterator(&modeIt) == S_OK) {
    IDeckLinkDisplayMode* m = nullptr;
    while (modeIt->Next(&m) == S_OK) {
      if (m->GetDisplayMode() == wanted) {
        g_width = m->GetWidth();
        g_height = m->GetHeight();
        m->GetFrameRate(&g_frameDuration, &g_timeScale);
        found = true;
      }
      m->Release();
      m = nullptr;
      if (found) break;
    }
    modeIt->Release();
  }
  if (!found) {
    out->Release();
    dev->Release();
    ThrowJs(env, "Diese Norm kennt die Karte nicht.");
    return env.Undefined();
  }

  // BGRA ist Pflicht. Kann die Karte es fuer diese Norm nicht, wird abgewiesen —
  // eine Wandlung nach UYVY ist ausdruecklich eine spaetere Scheibe, und ungepruefte
  // Farbmathematik waere hier schlimmer als eine klare Absage.
  BMDDisplayMode actual = wanted;
  BOOL supported = FALSE;
  out->DoesSupportVideoMode(bmdVideoConnectionUnspecified, wanted, bmdFormat8BitBGRA,
                            bmdNoVideoOutputConversion, bmdSupportedVideoModeDefault, &actual,
                            &supported);
  if (supported != TRUE) {
    out->Release();
    dev->Release();
    ThrowJs(env, "Diese Karte kann diese Norm nicht mit BGRA ausgeben.");
    return env.Undefined();
  }

  out->SetScheduledFrameCompletionCallback(&g_callback);

  const HRESULT hr = out->EnableVideoOutput(wanted, bmdVideoOutputFlagDefault);
  if (FAILED(hr)) {
    out->SetScheduledFrameCompletionCallback(nullptr);
    out->Release();
    dev->Release();
    ThrowJs(env, hr == E_ACCESSDENIED ? "Die Karte wird von einem anderen Programm benutzt."
                                      : "Ausgang konnte nicht aktiviert werden.");
    return env.Undefined();
  }

  g_device = dev;
  g_output = out;
  g_preroll = preroll;
  g_nextDisplayTime = 0;
  g_late = 0;
  g_dropped = 0;
  g_repeated = 0;
  g_rejected = 0;
  g_scheduled = 0;

  // Vorlauf mit Schwarzbildern fuellen, dann die Wiedergabe starten.
  for (uint32_t i = 0; i < g_preroll; i++) {
    if (!ScheduleBlackFrame()) break;
  }
  if (FAILED(g_output->StartScheduledPlayback(0, g_timeScale, 1.0))) {
    CloseOutputInternal();
    ThrowJs(env, "Wiedergabe konnte nicht gestartet werden.");
    return env.Undefined();
  }

  return Napi::Boolean::New(env, true);
}
```

- [ ] **Step 3: `scheduleFrameBGRA` schreiben**

Direkt darunter einfügen:

```cpp
// scheduleFrameBGRA(buf, width, height)
Napi::Value ScheduleFrameBGRA(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 3 || !info[0].IsTypedArray() || !info[1].IsNumber() || !info[2].IsNumber()) {
    ThrowJs(env, "scheduleFrameBGRA(buf: Uint8Array, width: number, height: number) erwartet");
    return env.Undefined();
  }
  if (!g_output) {
    ThrowJs(env, "Kein Ausgang offen.");
    return env.Undefined();
  }

  Napi::Uint8Array buf = info[0].As<Napi::Uint8Array>();
  const long width = static_cast<long>(info[1].As<Napi::Number>().Int64Value());
  const long height = static_cast<long>(info[2].As<Napi::Number>().Int64Value());

  // Masse muessen exakt passen. NICHT skalieren — die Aufloesung kommt aus der Quelle.
  if (width != g_width || height != g_height) {
    return Napi::Boolean::New(env, false);
  }
  const size_t need = static_cast<size_t>(g_width) * static_cast<size_t>(g_height) * 4;
  if (buf.ByteLength() != need) {
    ThrowJs(env, "Puffergroesse passt nicht zu width*height*4.");
    return env.Undefined();
  }

  unsigned int buffered = 0;
  g_output->GetBufferedVideoFrameCount(&buffered);

  // Warteschlange laeuft voll: die Karte kommt nicht hinterher bzw. wir liefern zu
  // schnell. Das eingehende Bild faellt weg — gezaehlt, nicht verschwiegen.
  if (buffered > g_preroll + 2) {
    g_rejected.fetch_add(1, std::memory_order_relaxed);
    return Napi::Boolean::New(env, false);
  }

  // Warteschlange leergelaufen: die Karte hatte nichts mehr. Wir zaehlen es UND setzen
  // die Zeitachse auf die Hardware-Uhr zurueck. Ohne diese Neusetzung planten wir ab
  // hier dauerhaft in die Vergangenheit, und ALLES kaeme fuer immer zu spaet.
  if (buffered == 0 && g_scheduled.load(std::memory_order_relaxed) > 0) {
    g_repeated.fetch_add(1, std::memory_order_relaxed);
    BMDTimeValue streamTime = 0;
    double speed = 0.0;
    if (g_output->GetScheduledStreamTime(g_timeScale, &streamTime, &speed) == S_OK) {
      g_nextDisplayTime = streamTime + g_frameDuration;
    }
  }

  IDeckLinkMutableVideoFrame* frame = nullptr;
  if (g_output->CreateVideoFrame(static_cast<int>(g_width), static_cast<int>(g_height),
                                 static_cast<int>(g_width) * 4, bmdFormat8BitBGRA,
                                 bmdFrameFlagDefault, &frame) != S_OK) {
    return Napi::Boolean::New(env, false);
  }
  void* bytes = nullptr;
  if (frame->GetBytes(&bytes) != S_OK || !bytes) {
    frame->Release();
    return Napi::Boolean::New(env, false);
  }
  std::memcpy(bytes, buf.Data(), need);

  const HRESULT hr =
      g_output->ScheduleVideoFrame(frame, g_nextDisplayTime, g_frameDuration, g_timeScale);
  frame->Release();  // der Treiber haelt seine eigene Referenz bis zum Abschluss
  if (FAILED(hr)) return Napi::Boolean::New(env, false);

  g_nextDisplayTime += g_frameDuration;
  g_scheduled.fetch_add(1, std::memory_order_relaxed);
  return Napi::Boolean::New(env, true);
}

// stats(): der ehrliche Blick auf die Ausgabe.
Napi::Value Stats(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  unsigned int buffered = 0;
  if (g_output) g_output->GetBufferedVideoFrameCount(&buffered);

  Napi::Object o = Napi::Object::New(env);
  o.Set("queued", Napi::Number::New(env, buffered));
  o.Set("late", Napi::Number::New(env, static_cast<double>(g_late.load())));
  o.Set("dropped", Napi::Number::New(env, static_cast<double>(g_dropped.load())));
  o.Set("repeated", Napi::Number::New(env, static_cast<double>(g_repeated.load())));
  o.Set("rejected", Napi::Number::New(env, static_cast<double>(g_rejected.load())));
  o.Set("scheduled", Napi::Number::New(env, static_cast<double>(g_scheduled.load())));
  return o;
}

Napi::Value CloseOutput(const Napi::CallbackInfo& info) {
  CloseOutputInternal();
  return info.Env().Undefined();
}
```

- [ ] **Step 4: `destroy` erweitern und die neuen Funktionen ausführen**

`Destroy` ersetzen durch:

```cpp
Napi::Value Destroy(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  CloseOutputInternal();
  if (g_comReady) {
    CoUninitialize();
    g_comReady = false;
  }
  return env.Undefined();
}
```

In `InitModule` die vier neuen Einträge ergänzen (die bestehenden bleiben unverändert):

```cpp
  exports.Set("openOutput", Napi::Function::New(env, OpenOutput));
  exports.Set("scheduleFrameBGRA", Napi::Function::New(env, ScheduleFrameBGRA));
  exports.Set("stats", Napi::Function::New(env, Stats));
  exports.Set("closeOutput", Napi::Function::New(env, CloseOutput));
```

- [ ] **Step 5: Übersetzen**

Run: `npm run rebuild -w @jm/decklink`
Expected: ohne Fehler durch.

- [ ] **Step 6: Ohne Karte gegenprüfen**

Run:
```bash
node -e "const d=require('./packages/decklink'); d.init(); console.log('stats ohne Ausgang:', JSON.stringify(d.stats())); d.closeOutput(); d.destroy(); console.log('sauber beendet');"
```
Expected: alle Zähler auf `0`, `closeOutput()` ohne offenen Ausgang tut nichts, kein Absturz.

- [ ] **Step 7: Selbsttest erneut laufen lassen**

Run: `npm run selftest -w @jm/decklink`
Expected: unverändert 15 Prüfungen grün — Task 4 berührt die reine Logik nicht.

- [ ] **Step 8: Commit**

```bash
git add packages/decklink/src/addon.cc
git status --short
git commit -m "feat(decklink): Addon Teil 2 — Ausgang, geplante Wiedergabe, Verlustzaehler (Lane D2a)"
```

---

### Task 5: Der Sondierlauf mit bewegtem Testbild

Das Werkzeug, mit dem am Kartenrechner geprüft wird — und mit dem künftig jede fremde Karte geprüft
wird, bevor jemand den Switcher anfasst.

**Files:**
- Create: `packages/decklink/test/spike.mjs`

**Interfaces:**
- Consumes: das gesamte Addon (Tasks 3+4) und `judgeModes` aus Task 2.
- Produces: `npm run spike -w @jm/decklink [-- --device n --mode Hp25 --seconds 15 --preroll 2]`.

- [ ] **Step 1: Den Sondierlauf schreiben**

`packages/decklink/test/spike.mjs`:

```js
// Sondierlauf an echter Hardware: Karten auflisten, Normen mit Urteil und Grund zeigen,
// eine Norm oeffnen und ein BEWEGTES Testbild senden.
//
// Warum bewegt: ein Standbild sieht auf dem Monitor gleich aus, ob 25 Bilder je Sekunde
// ankommen oder eines. Es beweist nur, dass irgendwann irgendein Bild durchging. Der
// Laufbalken unten wandert genau einen Schritt je Bild — faellt eines aus, springt er.
//
//   npm run spike -w @jm/decklink
//   npm run spike -w @jm/decklink -- --device 0 --mode Hp50 --seconds 30 --preroll 3
//
// Das Skript ist .mjs, importiert aber modes.ts — deshalb laeuft es ueber
// `node --experimental-strip-types` (siehe package.json). Ohne die Schalterangabe
// scheitert der Import mit ERR_UNKNOWN_FILE_EXTENSION.
import dl from '../index.js';
import { judgeModes } from '../src/modes.ts';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
}

const wantDevice = Number(arg('device', 0));
const wantMode = arg('mode', null);
const seconds = Number(arg('seconds', 15));
const preroll = Number(arg('preroll', 2));

dl.init();

const devices = dl.listDevices();
if (devices.length === 0) {
  console.log('Keine Blackmagic-Karte gefunden. (Desktop Video installiert? Karte gesteckt?)');
  dl.destroy();
  process.exit(0);
}

console.log('Karten:');
for (const d of devices) {
  console.log(`  [${d.index}] ${d.name}${d.hasOutput ? '' : '  (KEIN Ausgang)'}`);
}

const dev = devices.find((d) => d.index === wantDevice);
if (!dev) {
  console.error(`Karte ${wantDevice} gibt es nicht.`);
  dl.destroy();
  process.exit(1);
}
if (!dev.hasOutput) {
  console.error(`Karte ${wantDevice} hat keinen Ausgang.`);
  dl.destroy();
  process.exit(1);
}

const judged = judgeModes(dl.listOutputModes(wantDevice));
const GRUND = {
  interlaced: 'Halbbild',
  segmented: 'segmentiertes Vollbild (PsF)',
  resolution: 'Aufloesung koennen wir nicht komponieren',
  framerate: 'Bildrate bieten wir nicht an',
  pixelformat: 'Karte kann diese Norm nicht mit BGRA',
};

console.log(`\nNormen von "${dev.name}":`);
for (const m of judged) {
  const mark = m.usable ? ' ok ' : '  - ';
  const why = m.usable ? '' : `   (${GRUND[m.reason]})`;
  console.log(
    `${mark}${m.mode}  ${m.name.padEnd(22)} ${m.width}x${m.height} @ ${(m.fpsN / m.fpsD).toFixed(2)}${why}`,
  );
}

const usable = judged.filter((m) => m.usable);
const chosen = wantMode ? usable.find((m) => m.mode === wantMode) : usable[0];
if (!chosen) {
  console.error(
    wantMode ? `\nNorm ${wantMode} ist nicht benutzbar.` : '\nKeine benutzbare Norm gefunden.',
  );
  dl.destroy();
  process.exit(1);
}

const W = chosen.width;
const H = chosen.height;
const FPS = Math.round(chosen.fpsN / chosen.fpsD);
console.log(`\nOeffne ${chosen.name} (${W}x${H} @ ${FPS}), Vorlauf ${preroll} Bilder …`);
dl.openOutput(wantDevice, chosen.mode, preroll);

// Acht Farbbalken als Hintergrund (BGRA, also B,G,R,A je Bildpunkt).
const BARS = [
  [255, 255, 255], [0, 255, 255], [255, 255, 0], [0, 255, 0],
  [255, 0, 255], [0, 0, 255], [255, 0, 0], [0, 0, 0],
];
const frame = new Uint8Array(W * H * 4);
const barW = Math.floor(W / 8);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const c = BARS[Math.min(7, Math.floor(x / barW))];
    const i = (y * W + x) * 4;
    frame[i] = c[0];
    frame[i + 1] = c[1];
    frame[i + 2] = c[2];
    frame[i + 3] = 255;
  }
}
const bars = frame.slice(); // unveraenderte Vorlage zum Zuruecksetzen

const PULSE_H = Math.max(1, Math.floor(H * 0.05));
const SWEEP_W = 8;
const step = W / FPS; // eine volle Bahn je Sekunde

let n = 0;
const started = Date.now();

const timer = setInterval(() => {
  // Hintergrund zuruecksetzen (nur die beiden bemalten Baender, nicht das ganze Bild).
  frame.set(bars.subarray(0, PULSE_H * W * 4), 0);
  const sweepTop = H - PULSE_H;
  frame.set(bars.subarray(sweepTop * W * 4), sweepTop * W * 4);

  // Pulsstreifen oben: wechselt im Sekundentakt. Gegen eine Stoppuhr gehalten zeigt er,
  // ob die Karte im richtigen Tempo laeuft.
  const on = Math.floor(n / FPS) % 2 === 0;
  const v = on ? 255 : 0;
  for (let y = 0; y < PULSE_H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      frame[i] = v;
      frame[i + 1] = v;
      frame[i + 2] = v;
    }
  }

  // Laufbalken unten: genau ein Schritt je Bild. DAS ist die eigentliche Messung —
  // faellt ein Bild aus, springt er sichtbar.
  const px = Math.floor((n * step) % W);
  for (let y = sweepTop; y < H; y++) {
    for (let dx = 0; dx < SWEEP_W; dx++) {
      const i = (y * W + ((px + dx) % W)) * 4;
      frame[i] = 255;
      frame[i + 1] = 255;
      frame[i + 2] = 255;
    }
  }

  dl.scheduleFrameBGRA(frame, W, H);
  n++;

  if ((Date.now() - started) / 1000 >= seconds) {
    clearInterval(timer);
    finish();
  }
}, Math.round(1000 / FPS));

function finish() {
  const s = dl.stats();
  console.log(`\nGesendet: ${n} Bilder in ${seconds} s (erwartet rund ${FPS * seconds}).`);
  console.log(
    `stats: eingereiht=${s.scheduled} warteschlange=${s.queued} ` +
      `zu-spaet=${s.late} verworfen=${s.dropped} leergelaufen=${s.repeated} abgewiesen=${s.rejected}`,
  );
  if (s.late || s.dropped) {
    console.log('  → zu-spaet/verworfen kommen von der KARTE: der Vorlauf ist zu klein. --preroll erhoehen.');
  }
  if (s.repeated) {
    console.log('  → leergelaufen kommt von UNS: der Zulieferer stockt oder die Takte driften.');
  }
  if (s.rejected) {
    console.log('  → abgewiesen kommt von UNS: wir liefern schneller, als die Karte abnimmt.');
  }
  if (!s.late && !s.dropped && !s.repeated && !s.rejected) {
    console.log('  → sauber, kein einziges Bild verloren.');
  }
  dl.closeOutput();
  dl.destroy();
}

process.on('SIGINT', () => {
  clearInterval(timer);
  finish();
  process.exit(0);
});
```

- [ ] **Step 2: Ohne Karte laufen lassen**

Run: `npm run spike -w @jm/decklink`
Expected auf diesem Rechner: `Keine Blackmagic-Karte gefunden. (Desktop Video installiert? Karte gesteckt?)`
und Beenden mit Rückgabewert 0. **Kein Absturz, keine Ausnahme.**

Ist Desktop Video hier nicht installiert, wirft bereits `listDevices()` — dann diesen Fall im Bericht nennen.

- [ ] **Step 3: Commit**

```bash
git add packages/decklink/test/spike.mjs
git status --short
git commit -m "feat(decklink): Sondierlauf mit bewegtem Testbild (Lane D2a)"
```

---

## Verifikation am Kartenrechner (Owner)

Auf dem Rechner mit der DeckLink-Karte, nach `git pull` und `npm install`:

1. `DECKLINK_SDK_DIR` setzen, `npm run rebuild -w @jm/decklink` — muss durchlaufen.
2. `npm run spike -w @jm/decklink` — die Karte muss mit Namen erscheinen, die Normenliste muss
   plausibel sein (jede unbenutzbare mit Grund), und auf dem SDI-Monitor müssen **Farbbalken mit
   einem gleichmäßig wandernden Balken** und einem im Sekundentakt blinkenden Streifen stehen.
3. Ruckelt der Laufbalken oder springt er, sagt `stats` warum: `zu-spaet`/`verworfen` heißt
   Vorlauf erhöhen (`-- --preroll 4`), `leergelaufen` heißt der Zulieferer stockt.
4. Gegenprobe mit `-- --seconds 60`: über eine Minute darf `leergelaufen` allenfalls im
   einstelligen Bereich stehen. Bei einer Bruchraten-Norm (29,97p) ist ein langsames Ansteigen
   **erwartet** — das ist die Drift, kein Fehler.
5. Gegenprobe Formattreue: eine 720p- und eine 1080p-Norm nacheinander öffnen, am Monitor die
   gemeldete Auflösung prüfen.

Erst wenn das steht, beginnt **D2b** (Switcher-Anbindung) mit eigener Spec.
