# Mac-Nachbau Editor 0.5.0 · Umsetzungsplan

> **Für ausführende Agenten:** PFLICHT-SUB-SKILL: superpowers:subagent-driven-development (empfohlen) oder
> superpowers:executing-plans, Aufgabe für Aufgabe. Schritte haben Checkboxen (`- [ ]`).

**Goal:** Ein Hand-Start-Workflow baut JM Editor 0.5.0 aus dem bestehenden Tag `editor-v0.5.0` je Mac-Art auf einem
Runner dieser Art, prüft jedes Paket und hängt die beiden DMGs samt ffmpeg-Lizenz, Build-Angaben und Quellen-Hinweis an
das bestehende Release, aber nur mit `probe=false`.

**Architecture:** Neue Datei `.github/workflows/mac-nachbau.yml` nach dem Muster von `connect-mac.yml`. Der Bau-Job ist
eine Matrix (`macos-26` für arm64, `macos-26-intel` für x64) mit nur Leserecht. Er holt die Quellen per `git init`/`fetch`
ohne Anmeldedaten und Prüfer, Sammler, Lesestand und Hinweis aus `github.sha` nach `werkzeug/`. Der Hochlade-Job hat
Schreibrecht und läuft ohne Checkout, npm und node, nur mit `gh`. Prüfer und Sammler sind reine `node:`-Skripte unter
`scripts/ci/`. Ihre Selbsttests laufen unter Linux und Windows, die macOS-Teile als Attrappe. Ein statischer Test hält die
Regeln des Workflows fest, und ein Schritt in `ci-checks.yml` führt alle drei Tests aus.

**Tech Stack:** GitHub Actions (workflow_dispatch, Matrix, actions/setup-node@v5, actions/upload-artifact@v4,
actions/download-artifact@v4, gh), Node 20 im Mac-Job, Node 22 in ci-checks, lokal Node 24, nur `node:`-Module;
electron-builder 24.13.3, ffmpeg-static 5.3.0 und ffprobe-static 3.1.0 kommen aus dem Tag.

**Spec:** `C:\Users\alexk\AppData\Local\Temp\claude\c--Users-alexk-alexzvn\cfc08999-1618-4a9d-bec9-ffdb8fe15280\scratchpad\mac-fassungen\entwurf.md`
(Abschnitt 2 „Stufe 1“, Abschnitt 4 F1–F4, Abschnitt 6 Prüfung). Ist-Karten im selben Ordner: `ist-editor.md`,
`ist-launcher-rest.md` (Abschnitt 3).

**Owner-Freigabe:** 20.10.2026 03:38 („passt“) für den Entwurf, Stufe 1 und F1–F4:
- **F1:** Editor 0.5.0 für den Mac aus dem bestehenden Tag `editor-v0.5.0` nachbauen. Kein neues Release, kein Katalog-Bump.
- **F2 (ii):** Der Bau-Job nimmt GPL-Text und Build-Angaben von ffmpeg-static mit, also das, was install.js neben das
  Programm legt. Der Hochlade-Job hängt beides mit einem kurzen Quellen-Hinweis ans Release. Das DMG bleibt wie im Tag.
  Die Restlücke hat der Owner bewusst akzeptiert.
- **F3:** Hochladen ohne Abnahme auf einem echten Mac. Dafür gibt es eine Laufzeitprobe in der CI: ffmpeg je Mac-Art,
  ffprobe im Intel-Job, minos gegen macOS 11. Der Quarantäne- und Rosetta-Hinweis kommt später als Eintrag in
  changelog.json, nicht in diesem Branch.
- **F4:** Intel-Macs mitversorgen.

Der neue Release-Proxy (Paketwahl nach Mac-Art) ist seit 19.10.2026 deployt.

## Global Constraints

- Arbeitsort ist der Worktree `C:\Users\alexk\alexzvn\.claude\worktrees\mac-nachbau`, Branch `ci/mac-nachbau` (von
  origin/main eb68b05fec). Verboten: push, tag, merge, rebase, release, Branch-Wechsel, `git stash`, `git reset --hard`,
  `git clean`, `git checkout`, `gh` (auch lesend), `wrangler`, `npm install`/`npm ci`, Netz, eine Electron-App starten,
  alles unter `%APPDATA%`. Keine Secrets.
- Der Worktree hat kein `node_modules`. Prüfer, Sammler und Tests nutzen nur `node:`-Module. Der Beilagen-Test lädt
  dazu `services/release-proxy/paketwahl.js`, das selbst nichts importiert. **Kein js-yaml im Repo-Code:** Es liegt
  nur transitiv im Lockfile (`package-lock.json:11021`, über electron-builder und astro), und die Tests müssen im
  Worktree ohne `npm ci` laufen. Zum reinen Messen darf js-yaml über den absoluten Pfad
  `C:\Users\alexk\alexzvn\.claude\worktrees\iveo-paket\node_modules\js-yaml` geladen werden, aus einem Skript im Scratchpad.
- Prüfer und Sammler laufen im Mac-Job unter Node 20. Darum nur APIs bis Node 20 (`util.parseArgs`, `Object.hasOwn`, `?.`).
- Commits nur mit expliziten Pfaden, nie `git add -A` oder `git add .`. Danach `git status --short` lesen. Die
  Commit-Nachricht endet mit der Zeile `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, der Betreff ist ohne
  Umlaute wie im Repo üblich.
- Neue Dateien bekommen LF. `.github/workflows/ci-checks.yml` und `docs/mac-build-windows-only-apps.md` sind im Repo LF
  (`git ls-files --eol`: `i/lf w/crlf`). Der Checkout ist CRLF, weil `core.autocrlf=true` in der System-Gitconfig steht.
  Ändern nur mit dem Edit-Werkzeug; der Commit bleibt LF. Zeilenenden misst man mit `git ls-files --eol` oder mit node,
  **nicht** mit `grep -c $'\r'` in Git Bash: Das zählt dort jede Zeile (gemessen).
- Texte für Menschen sind deutsch und ohne ASCII-Anführungszeichen; angeführt wird nur mit „ “. Das gilt für
  Workflow-Meldungen, Prüfer-Ausgaben, den Quellen-Hinweis und die Doku.
- Gegenproben werden mit dem Edit-Werkzeug gesetzt und genauso zurückgenommen, nie mit `git checkout` oder
  `git stash`. Danach muss der Test wieder grün sein. Nach einem Commit zeigt `git status --short` die Datei nicht mehr.
  In den Gegenproben-Tabellen ist `|` als `\|` maskiert; im Code steht `||`.
- Die Runner sind fest: arm64 auf `macos-26`, x64 auf `macos-26-intel`, nie `-latest`.
- Die Konfiguration aus dem Tag bleibt byte-gleich: `electronVersion` und `npmRebuild` werden nicht angehängt.
- Nicht in diesem Branch: `packages/suite-manifest/changelog.json`, Lesestand-Werte, Stufe 2, Änderungen an
  `suite-release.yml`, `suite-build.yml` und `connect-mac.yml`.

## Am Code belegt (vor dem Plan gemessen)

| Frage | Ergebnis | Beleg |
|---|---|---|
| Wo liegen ffmpeg und ffprobe in der gepackten App? | `JM Editor.app/Contents/Resources/bin/mac/ffmpeg` und `…/ffprobe` | `editor-v0.5.0:apps/editor/electron-builder.yml:14-18` (extraResources `resources` → `.`), `editor-v0.5.0:packages/media/bundle-ffmpeg.mjs:18-21` (`resources/bin/mac`), `…/src/locate.ts:17-19` (`process.resourcesPath/bin/mac`) |
| Ausgabeordner je Art | arm64: `release/mac-arm64/`, x64: `release/mac/` | `app-builder-lib/out/platformPackager.js:84-86` mit `builder-util/out/arch.js:31-33` (Suffix nur für die Nicht-Standard-Art); Connect-Lauf 39321705107, Log Z. 206 und 212 |
| DMG-Name | `JM Editor-0.5.0-mac-arm64.dmg` bzw. `…-mac-x64.dmg`; am Release steht ein Punkt statt des Leerzeichens | `electron-builder.yml:2-3`; `suite.json`, Editor-Eintrag `JM Editor-${version}-mac-${arch}.dmg` |
| App-Programm | `Contents/MacOS/JM Editor` | `app-builder-lib/out/macPackager.js:361`, `out/electron/electronMac.js:224` |
| Was install.js neben ffmpeg legt | `node_modules/ffmpeg-static/ffmpeg`, `ffmpeg.README`, `ffmpeg.LICENSE`, geladen aus `<plat>-<arch>.README` bzw. `.LICENSE` des Release b6.1.1; bei 404 gibt es nur eine Warnung | `ffmpeg-static/install.js:163-188`, `:29-32`; `index.js:32-35`; im Tag liegt ffmpeg-static im obersten node_modules (`editor-v0.5.0:package-lock.json:9382`) |
| ffprobe | In beiden Ordnern x86_64 (`cf fa ed fe 07 00 00 01`). SHA-256 `bin/darwin/arm64/ffprobe` = `5b592e56f87ff754d94dadf99f38b4d0fb7d463eb780b50e0ca061d668d0e3f7`, `bin/darwin/x64/ffprobe` = `90fddf93d25a520bbda09e02f1f53a91f04acd1ef9b79e6dc602dc4dc6951f67`; die Lock-Integrität ist in Tag und HEAD gleich | lokal gemessen (`od`, `sha256sum`, Lockfile) |
| Paketwahl | auf dem Mac nur `.dmg`, unter Windows nur `.exe`. Ein genauer Katalogname zählt nur unter Paketen, die schon passen. | `services/release-proxy/paketwahl.js:26-33`, `apps/launcher/src/main/release-wahl.ts:50-57`, `:82-84` |
| Import von paketwahl.js aus `.mjs` | Läuft unter Node 22 und 24. Node meldet dazu `MODULE_TYPELESS_PACKAGE_JSON` auf stderr; das ist harmlos und bei `worker.test.mjs` genauso. | gemessen |
| gh-Upload mehrerer Dateien | Ob ein Aufruf sie der Reihe nach hochlädt, ist nicht belegt. Darum je ein Aufruf: x64, dann arm64, dann die Beilagen (Entwurf: „ein Upload, x64 zuerst“; Reihenfolge so sicher) | — |

## Review Focus

1. **Runner-Label oder Node-Art passt nicht** (`macos-26-intel` fehlt, Node unter Rosetta). Erwartet: Abbruch mit klarer
   Meldung, nichts hochgeladen. Abgedeckt durch den Schritt „Runner-Art prüfen“ (Task 3), R8 hält die Labels fest. Ob es
   das Label gibt, zeigt erst der Probelauf (Nach der Umsetzung, Schritt 4).
2. **`npm ci` mit der Lockfile vom Juni scheitert auf macOS 26** (Install-Skripte von electron, sharp,
   onnxruntime-node, electron-rebuild). Erwartet: roter Bau-Job, der Hochlade-Job startet nicht. Abgedeckt durch `needs`
   auf die ganze Matrix (R11); ob npm ci durchläuft, misst nur der Probelauf.
3. **LICENSE oder README von ffmpeg-static fehlen, oder LICENSE ist kein GPL-Volltext.** install.js warnt bei 404 nur.
   Erwartet: Abbruch statt eines Uploads ohne Beilagen, im Protokoll Größe, SHA-256 und Anfang von LICENSE und README.
   Abgedeckt durch B4, B8 und B12 (Task 2). **Wahrscheinlich tritt der Fall ein:** Die Mac-LICENSE im Release b6.1.1 hat
   4 346 bzw. 4 376 B, ein GPL-Volltext 17 984 B (v2) bzw. 35 147 B (v3). Dann endet schon der Probelauf im Sammler, und
   F2 (ii) ist in der freigegebenen Form nicht erfüllbar; das ist eine offene Owner-Frage (Task 2, Prüfung Runde 1, W1).
4. **Ein Tag mit Schadtext oder eine fremde App erreicht ein Skript.** Erwartet: Abbruch vor jedem git-, npm- oder
   gh-Aufruf. Abgedeckt durch R17 (Eingaben nur über env, kein `${{ }}` in run) und durch die Messung mit der
   gh-Attrappe in Task 3, Step 6. Diese Messung ist nicht im Repo, weil sie js-yaml braucht.
5. **Der Prüfer liest den App-Ordner, nicht das gemountete DMG.** electron-builder baut das DMG aus genau diesem Ordner
   (wie bei Connect, `pruefe-mac-paket.mjs`), gemessen ist das nicht. Kein Test deckt das ab; bewusst so belassen. Die
   Nachabnahme auf einem echten Mac (F3) schließt die Lücke.

## Dateistruktur

| Datei | Aufgabe | Task |
|---|---|---|
| `scripts/ci/pruefe-mac-nachbau.mjs` (neu) | Prüfer: Mach-O-Kopf, minos, Namen und Pfade, Ablauf am release-Ordner, Lesestand, macOS-Teile (injiziert), Kommandozeile | 1 |
| `scripts/ci/mac-nachbau-lesestand.json` (neu) | Lesestand, anfangs `{}`; die Werte kommen nach dem Probelauf mit Owner-OK | 1 |
| `scripts/ci/test/pruefe-mac-nachbau.test.mjs` (neu) | Selbsttest des Prüfers | 1 |
| `scripts/ci/sammle-ffmpeg-beilagen.mjs` (neu) | Sammler: prüft ffmpeg-static und kopiert LICENSE, README und Hinweis unter festen Asset-Namen | 2 |
| `scripts/ci/ffmpeg-quellen-hinweis.txt` (neu) | Wortlaut des Quellen-Hinweises; der Owner liest ihn im PR | 2 |
| `scripts/ci/test/sammle-ffmpeg-beilagen.test.mjs` (neu) | Selbsttest des Sammlers, Namensprobe gegen `paketwahl.js`, Wortlaut-Probe | 2 |
| `.github/workflows/mac-nachbau.yml` (neu) | der Workflow | 3 |
| `scripts/ci/test/mac-nachbau-workflow.test.mjs` (neu) | statischer Test des Workflows mit Gegenproben je Regel | 3 |
| `.github/workflows/ci-checks.yml` (ändern, Job `selftests`, nach Z. 101-102) | ein Schritt für die drei Tests | 4 |
| `docs/mac-nachbau.md` (neu) | Bedienung: Probe, Lesestand, echter Lauf | 4 |
| `docs/mac-build-windows-only-apps.md` (ändern, Abschnitt 5, Z. 215) | ein Verweis auf `mac-nachbau.md` | 4 |

**Warum `scripts/ci/`:** `scripts/` hält schon Repo-Werkzeuge (`bump-manifest.mjs`). `ci/` trennt die CI-Werkzeuge.
Es gibt dort kein package.json, also auch keinen Workspace, und `npm ci` lässt den Ordner in Ruhe. Prüfer und Sammler
liegen nebeneinander, weil der Sammler `appPfade` aus dem Prüfer importiert und der Workflow beide in denselben Ordner
`werkzeug/scripts/ci/` holt.

**Warum eine neue Doku-Datei:** `docs/mac-build-windows-only-apps.md` ist ein Runbook für den lokalen Bau der NDI- und
whisper-Tools. Der Nachbau dagegen ist ein CI-Ablauf für bestehende Tags beliebiger Apps, und Stufe 2 erweitert ihn.
Darum bekommt er eine eigene Datei, und im alten Runbook steht nur ein Verweis.

**Abweichung vom Entwurf, mit Grund:** Der Entwurf sagt „beide in einem einzigen `gh release upload`, x64 zuerst“.
Ob gh mehrere Dateien eines Aufrufs der Reihe nach hochlädt, ist nicht belegt. Darum gibt es zwei getrennte Aufrufe
(x64, dann arm64), danach einen für die Beilagen. Die Absicht des Entwurfs (x64 zuerst) bleibt so gewahrt, und das
verlangt auch der Auftrag.

---

### Task 1: Prüfer mit Lesestand und Selbsttest

**Files:**
- Create: `scripts/ci/pruefe-mac-nachbau.mjs`
- Create: `scripts/ci/mac-nachbau-lesestand.json`
- Test: `scripts/ci/test/pruefe-mac-nachbau.test.mjs`

**Interfaces:**
- Consumes: nichts.
- Produces (Task 2 und 3 nutzen das):
  - `export const APPS = { editor: { produkt: 'JM Editor' } }`
  - `export const ARTEN = { arm64: { cpu: 0x0100000c, otool: 'arm64', ordner: 'mac-arm64' }, x64: { cpu: 0x01000007, otool: 'x86_64', ordner: 'mac' } }`
  - `machoArten(kopf: Buffer): string[] | null`: Arten in Dateireihenfolge, dünn oder Fat; `'unbekannt:0x…'` für fremde CPU-Typen; `null`, wenn es kein Mach-O ist.
  - `leseMinos(otoolText: string): string | null` und `ueberMacos11(minos: string): boolean`.
  - `erwarteterDmgName(app, version, art): string` und `appPfade(release, app, art): { programm, ffmpeg, ffprobe }`.
  - `pruefeMacNachbau({ release, app, version, art, lesestand, probe }, macos): { ok, fehler: string[], warnungen: string[], hinweise: string[], gemessen: { ffmpeg?, ffprobe? } }`.
    `macos` ist `{ starte(pfad, args) → { status, error?, stdout, stderr }, otool(pfad, otoolArt) → string }` oder `null`.
    Bei `null` entfallen Laufzeitprobe und minos: mit `probe` nur ein Hinweis, sonst ein Fehler (fail closed; nach F3
    ist die Laufzeitprobe die Bedingung fürs Hochladen).
  - Kommandozeile: `node scripts/ci/pruefe-mac-nachbau.mjs --app <app> --version <x.y.z> --art arm64|x64 --release <Ordner> --lesestand <json> [--probe]`.
    Exit 0 heißt in Ordnung, 1 heißt Abweichung (stderr), 2 heißt falscher Aufruf. Warnungen gehen als
    `::warning::pruefe-mac-nachbau: …` auf stdout, damit sie in der Lauf-Übersicht stehen. Die echten macOS-Werkzeuge
    laufen nur unter `darwin`.

- [ ] **Step 1: Den Test schreiben** (`scripts/ci/test/pruefe-mac-nachbau.test.mjs`, LF)

````js
// Selbsttest für scripts/ci/pruefe-mac-nachbau.mjs (Mac-Nachbau, Entwurf mac-fassungen Stufe 1). Läuft unter Linux und
// Windows: nachgebaute release-Ordner im Temp-Ordner, gefälschte Mach-O-Köpfe, und die macOS-Teile (Programmstart,
// otool) als Attrappe. Die Kommandozeile entfällt unter macOS, weil sie dort echte Werkzeuge auf die Attrappen ansetzt.
//   node scripts/ci/test/pruefe-mac-nachbau.test.mjs
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  appPfade, erwarteterDmgName, leseMinos, machoArten, pruefeMacNachbau, ueberMacos11,
} from '../pruefe-mac-nachbau.mjs';

const hier = dirname(fileURLToPath(import.meta.url));
const skript = join(hier, '..', 'pruefe-mac-nachbau.mjs');

let failures = 0;
function assert(cond, name) {
  if (cond) console.log(`  ok  ${name}`);
  else {
    failures++;
    console.error(`FAIL  ${name}`);
  }
}

function datei(pfad, inhalt = '') {
  mkdirSync(dirname(pfad), { recursive: true });
  writeFileSync(pfad, inhalt);
}
const sha = (inhalt) => createHash('sha256').update(inhalt).digest('hex');

// Mach-O-Köpfe: x64 wie gemessen an node_modules/ffprobe-static/bin/darwin/arm64/ffprobe (cf fa ed fe 07 00 00 01).
const KOPF = {
  x64: Buffer.from('cffaedfe07000001030000800200000000000000', 'hex'),
  arm64: Buffer.from('cffaedfe0c000001000000000200000000000000', 'hex'),
};
function fat(groesse, ...cpus) {
  const b = Buffer.alloc(8 + cpus.length * groesse);
  b.writeUInt32BE(groesse === 20 ? 0xcafebabe : 0xcafebabf, 0);
  b.writeUInt32BE(cpus.length, 4);
  cpus.forEach((c, i) => b.writeUInt32BE(c, 8 + i * groesse));
  return b;
}
const CPU = { x64: 0x01000007, arm64: 0x0100000c };

const ORDNER = { arm64: 'mac-arm64', x64: 'mac' };
const ordner = [];
/**
 * Ein release-Ordner wie von electron-builder 24.13.3 mit --mac dmg --<art>: ein DMG samt Beiwerk und eine .app. ffmpeg in
 * der Art des Jobs, ffprobe immer x64 (ffprobe-static 3.1.0). Liefert Ordner, Inhalte und den passenden Lesestand.
 */
function bau(art, { ffmpegKopf = KOPF[art], ffprobeKopf = KOPF.x64, programmKopf = KOPF[art] } = {}) {
  const d = mkdtempSync(join(tmpdir(), 'jm-mac-nachbau-'));
  ordner.push(d);
  datei(join(d, `JM Editor-0.5.0-mac-${art}.dmg`), 'dmg');
  datei(join(d, `JM Editor-0.5.0-mac-${art}.dmg.blockmap`), 'x');
  datei(join(d, 'latest-mac.yml'), 'x');
  datei(join(d, 'builder-debug.yml'), 'x');
  const inhalt = { ffmpeg: Buffer.concat([ffmpegKopf, Buffer.from(`ffmpeg-${art}`)]), ffprobe: Buffer.concat([ffprobeKopf, Buffer.from('ffprobe')]) };
  const c = join(d, ORDNER[art], 'JM Editor.app', 'Contents');
  datei(join(c, 'MacOS', 'JM Editor'), programmKopf);
  datei(join(c, 'Resources', 'bin', 'mac', 'ffmpeg'), inhalt.ffmpeg);
  datei(join(c, 'Resources', 'bin', 'mac', 'ffprobe'), inhalt.ffprobe);
  datei(join(c, 'Resources', 'app.asar'), 'asar');
  const lesestand = { editor: { '0.5.0': { [art]: { ffmpeg: sha(inhalt.ffmpeg), ffprobe: sha(inhalt.ffprobe) } } } };
  return { d, inhalt, lesestand };
}
const optionen = (art, b, mehr = {}) => ({ release: b.d, app: 'editor', version: '0.5.0', art, lesestand: b.lesestand, probe: false, ...mehr });

const BUILD = 'Load command 9\n      cmd LC_BUILD_VERSION\n  cmdsize 32\n platform 1\n    minos 11.0\n      sdk 14.0\n   ntools 1\n     tool 3\n  version 1015.7\n';
const ALT = 'Load command 8\n      cmd LC_VERSION_MIN_MACOSX\n  cmdsize 16\n  version 10.9\n      sdk 10.15\n';
/** macOS-Attrappe: protokolliert jeden Aufruf; Rückgabe und otool-Text lassen sich je Fall setzen. */
function attrappe({ status = 0, error = undefined, otool = BUILD } = {}) {
  const aufrufe = [];
  return {
    aufrufe,
    starte(pfad, args) {
      aufrufe.push(`starte ${pfad.split(/[\\/]/).pop()} ${args.join(' ')}`);
      return { status, error, stdout: 'ffmpeg version 6.1.1 Copyright (c) 2000-2023\nweiter', stderr: status ? 'dyld: Bad CPU type' : '' };
    },
    otool(pfad, arch) {
      aufrufe.push(`otool ${arch} ${pfad.split(/[\\/]/).pop()}`);
      return otool;
    },
  };
}

try {
  console.log('pruefe-mac-nachbau — Mach-O-Kopf, minos, Namen:');
  assert(JSON.stringify(machoArten(KOPF.x64)) === '["x64"]', 'N1: dünnes x86_64 (cf fa ed fe 07 00 00 01) → x64');
  assert(JSON.stringify(machoArten(KOPF.arm64)) === '["arm64"]', 'N1: dünnes arm64 (cf fa ed fe 0c 00 00 01) → arm64');
  assert(JSON.stringify(machoArten(fat(20, CPU.x64, CPU.arm64))) === '["x64","arm64"]', 'N1: Fat/Universal (cafebabe) → beide Arten');
  assert(JSON.stringify(machoArten(fat(32, CPU.x64, CPU.arm64))) === '["x64","arm64"]', 'N1: Fat mit 64-Bit-Einträgen (cafebabf, 32 Bytes je Eintrag) → beide Arten');
  assert(JSON.stringify(machoArten(Buffer.from('cffaedfe0c000000', 'hex'))) === '["unbekannt:0x0000000c"]', 'N1: unbekannter CPU-Typ wird benannt, nicht geraten');
  // 4096 Bytes wie kopfVon im Prüfer: Nur so trägt der Schutz n > 30, sonst fiele die Klasse schon an der Länge durch.
  assert(machoArten(Buffer.concat([Buffer.from('cafebabe00000034', 'hex'), Buffer.alloc(4088)])) === null, 'N1: Java-Klasse (cafebabe, Fassung 52, 4096 Bytes) → kein Mach-O');
  assert(machoArten(Buffer.from('#!/bin/sh\n')) === null && machoArten(Buffer.from('cffa', 'hex')) === null, 'N1: Skript und zu kurzer Kopf → kein Mach-O');
  assert(leseMinos(BUILD) === '11.0', 'N2: LC_BUILD_VERSION → minos 11.0 (nicht die Werkzeug-Fassung 1015.7)');
  assert(leseMinos(ALT) === '10.9', 'N2: LC_VERSION_MIN_MACOSX → version 10.9');
  assert(leseMinos(ALT + BUILD.replace('11.0', '12.0')) === '12.0', 'N2: beide da → LC_BUILD_VERSION gilt');
  assert(leseMinos(BUILD.replace(/\n/g, '\r\n')) === '11.0' && leseMinos('') === null, 'N2: CRLF gelesen, leere Ausgabe → null');
  assert(!ueberMacos11('11.0') && !ueberMacos11('10.9') && ueberMacos11('11.1') && ueberMacos11('12.0'), 'N2: über macOS 11 heißt größer als 11.0');
  assert(erwarteterDmgName('editor', '0.5.0', 'arm64') === 'JM Editor-0.5.0-mac-arm64.dmg', 'N3: DMG-Name wie artifactName und Katalog');
  assert(appPfade('/r', 'editor', 'arm64').ffmpeg === join('/r', 'mac-arm64', 'JM Editor.app', 'Contents', 'Resources', 'bin', 'mac', 'ffmpeg')
    && appPfade('/r', 'editor', 'x64').programm === join('/r', 'mac', 'JM Editor.app', 'Contents', 'MacOS', 'JM Editor'),
  'N3: Pfade in der App (release/mac-arm64 bzw. release/mac, bin/mac aus extraResources)');

  console.log('pruefe-mac-nachbau — Ablauf am nachgebauten release-Ordner:');
  // Ohne macOS (Linux, Windows) ist nur der Probe-Lauf in Ordnung; der echte Lauf braucht Laufzeitprobe und minos (F3).
  {
    const r = pruefeMacNachbau(optionen('arm64', bau('arm64'), { probe: true }), null);
    assert(r.ok && r.fehler.length === 0 && r.warnungen.length === 0, 'N4: sauberer arm64-Bau mit passendem Lesestand → in Ordnung (Probe)');
    assert(r.hinweise.some((h) => h.startsWith('Ausnahme: ffprobe ist ein Intel-Programm (x86_64)')), 'N4: ffprobe x86_64 im arm64-Paket → gedruckte Ausnahme, kein Abbruch');
    assert(r.hinweise.includes('macOS-Teile (Laufzeitprobe, minos) übersprungen: nur unter macOS.'), 'N4: ohne macOS im Probe-Lauf → Hinweis, dass Laufzeitprobe und minos fehlen');
    const s = pruefeMacNachbau(optionen('arm64', bau('arm64')), null);
    assert(!s.ok && JSON.stringify(s.fehler) === JSON.stringify(['Laufzeitprobe und minos fehlen (nur unter macOS); ohne sie wird nicht hochgeladen.']),
      'N4 Gegenprobe: echter Lauf ohne macOS → rot, nie still in Ordnung');
  }
  {
    const r = pruefeMacNachbau(optionen('x64', bau('x64'), { probe: true }), null);
    assert(r.ok && !r.hinweise.some((h) => h.startsWith('Ausnahme:')), 'N5: sauberer x64-Bau → in Ordnung, ohne Ausnahme (Probe)');
  }
  {
    const b = bau('arm64');
    datei(join(b.d, 'JM Editor-0.5.0-mac-x64.dmg'), 'dmg');
    const r = pruefeMacNachbau(optionen('arm64', b), null);
    assert(!r.ok && r.fehler.includes('genau ein DMG „JM Editor-0.5.0-mac-arm64.dmg“ erwartet, gefunden 2: JM Editor-0.5.0-mac-arm64.dmg, JM Editor-0.5.0-mac-x64.dmg.'),
      'N6 Gegenprobe: zwei DMGs (ohne Zielnamen baute --arm64 beide) → rot');
  }
  {
    const b = bau('arm64');
    rmSync(join(b.d, 'JM Editor-0.5.0-mac-arm64.dmg'));
    const r = pruefeMacNachbau(optionen('arm64', b), null);
    assert(!r.ok && r.fehler.includes('genau ein DMG „JM Editor-0.5.0-mac-arm64.dmg“ erwartet, gefunden 0.'),
      'N6 Gegenprobe: kein DMG (nur die App gebaut) → rot');
  }
  {
    const b = bau('x64');
    const r = pruefeMacNachbau(optionen('arm64', b), null);
    assert(!r.ok && r.fehler[0] === 'genau ein DMG „JM Editor-0.5.0-mac-arm64.dmg“ erwartet, gefunden 1: JM Editor-0.5.0-mac-x64.dmg.'
      && r.fehler[1] === 'genau eine App „mac-arm64/JM Editor.app“ erwartet, gefunden 1: mac/JM Editor.app.',
    'N7 Gegenprobe: x64-Bau im arm64-Job → rot (DMG und App der falschen Art)');
  }
  {
    const b = bau('arm64');
    datei(join(b.d, 'mac', 'JM Editor.app', 'Contents', 'MacOS', 'JM Editor'), KOPF.x64);
    const r = pruefeMacNachbau(optionen('arm64', b), null);
    assert(!r.ok && r.fehler.length === 1 && r.fehler[0] === 'genau eine App „mac-arm64/JM Editor.app“ erwartet, gefunden 2: mac-arm64/JM Editor.app, mac/JM Editor.app.',
      'N8 Gegenprobe: zwei .app → rot, und nichts weiter geprüft');
  }
  {
    const r = pruefeMacNachbau(optionen('arm64', bau('arm64', { ffmpegKopf: KOPF.x64 })), null);
    assert(!r.ok && r.fehler.includes('ffmpeg hat x64, erwartet arm64 (die Mac-Art der App).'), 'N9 Gegenprobe: x64-ffmpeg im arm64-Paket → rot');
    const s = pruefeMacNachbau(optionen('x64', bau('x64', { ffmpegKopf: KOPF.arm64 })), null);
    assert(!s.ok && s.fehler.includes('ffmpeg hat arm64, erwartet x64 (die Mac-Art der App).'), 'N9 Gegenprobe: arm64-ffmpeg im Intel-Paket (Juni-Fehler) → rot');
  }
  {
    const r = pruefeMacNachbau(optionen('arm64', bau('arm64', { ffmpegKopf: fat(20, CPU.x64, CPU.arm64) }), { probe: true }), null);
    assert(r.ok, 'N10: universelles ffmpeg (x64+arm64) enthält die Art → in Ordnung');
  }
  {
    const r = pruefeMacNachbau(optionen('x64', bau('x64', { ffprobeKopf: KOPF.arm64 })), null);
    assert(!r.ok && r.fehler.includes('ffprobe hat arm64, erwartet x64.'), 'N11 Gegenprobe: arm64-ffprobe im Intel-Paket → rot (dort gibt es keine Ausnahme)');
    const s = pruefeMacNachbau(optionen('arm64', bau('arm64', { ffprobeKopf: Buffer.from('#!/bin/sh\nexit 0\n') })), null);
    assert(!s.ok && s.fehler.some((f) => f.startsWith('ffprobe ist kein Mach-O-Programm:')), 'N11 Gegenprobe: ffprobe kein Mach-O → rot');
    // CPU-Typ 0x12 (PowerPC): weder arm64 noch die Ausnahme x86_64.
    const t = pruefeMacNachbau(optionen('arm64', bau('arm64', { ffprobeKopf: Buffer.from('cffaedfe12000000000000000200000000000000', 'hex') })), null);
    assert(!t.ok && t.fehler.includes('ffprobe hat unbekannt:0x00000012, erwartet arm64 oder die festgelegte Ausnahme x64.'),
      'N11 Gegenprobe: ffprobe fremder Art im arm64-Job → rot (die Ausnahme gilt nur für genau x86_64)');
  }
  {
    const b = bau('arm64');
    rmSync(join(b.d, 'mac-arm64', 'JM Editor.app', 'Contents', 'Resources', 'bin', 'mac', 'ffmpeg'));
    const r = pruefeMacNachbau(optionen('arm64', b), null);
    assert(!r.ok && r.fehler.some((f) => f.startsWith('ffmpeg fehlt:')), 'N11 Gegenprobe: ffmpeg fehlt im Paket → rot');
  }
  {
    const r = pruefeMacNachbau(optionen('arm64', bau('arm64', { programmKopf: KOPF.x64 })), null);
    assert(!r.ok && r.fehler.includes('App-Programm hat x64, erwartet arm64.'), 'N12 Gegenprobe: App-Programm der falschen Art → rot');
  }

  console.log('pruefe-mac-nachbau — Lesestand (SHA-256 von ffmpeg und ffprobe):');
  // ffprobe im arm64-Job: Das x86_64-Programm wird dort nicht gestartet; der SHA-256 ist seine einzige Sicherung.
  for (const name of ['ffmpeg', 'ffprobe']) {
    const b = bau('arm64');
    b.lesestand.editor['0.5.0'].arm64[name] = '0'.repeat(64);
    for (const probe of [false, true]) {
      const r = pruefeMacNachbau(optionen('arm64', b, { probe }), null);
      assert(!r.ok && r.fehler.includes(`SHA-256 von ${name} weicht vom Lesestand ab: gemessen ${sha(b.inhalt[name])}, Lesestand ${'0'.repeat(64)}.`)
        && r.fehler.filter((f) => f.startsWith('SHA-256 von')).length === 1,
      `N13 Gegenprobe: ${name} weicht vom Lesestand ab → rot (probe=${probe})`);
    }
  }
  {
    const b = bau('x64');
    const vorschlag = JSON.stringify({ editor: { '0.5.0': { x64: { ffmpeg: sha(b.inhalt.ffmpeg), ffprobe: sha(b.inhalt.ffprobe) } } } });
    const r = pruefeMacNachbau(optionen('x64', b, { lesestand: {}, probe: true }), null);
    assert(r.ok && r.warnungen.length === 1 && r.warnungen[0].startsWith('Lesestand für editor 0.5.0 x64 ist leer.')
      && r.warnungen[0].endsWith(`Zum Nachtragen (mit Owner-OK): ${vorschlag}`), 'N14: leerer Lesestand im Probe-Lauf → Warnung mit den gemessenen Werten, kein Abbruch');
    assert(r.gemessen.ffmpeg === sha(b.inhalt.ffmpeg) && r.gemessen.ffprobe === sha(b.inhalt.ffprobe), 'N14: gemessene SHA-256 im Ergebnis');
    const s = pruefeMacNachbau(optionen('x64', b, { lesestand: {}, probe: false }), null);
    assert(!s.ok && s.fehler.some((f) => f.startsWith('Lesestand für editor 0.5.0 x64 ist leer; ohne Lesestand wird nicht hochgeladen.')),
      'N14 Gegenprobe: leerer Lesestand im echten Lauf → rot');
  }
  {
    const b = bau('arm64');
    delete b.lesestand.editor['0.5.0'].arm64.ffprobe;
    const r = pruefeMacNachbau(optionen('arm64', b, { probe: true }), null);
    assert(!r.ok && r.fehler.includes('Lesestand für editor 0.5.0 arm64 ist unvollständig oder ungültig (erwartet ffmpeg und ffprobe als SHA-256 in Kleinbuchstaben).'),
      'N15 Gegenprobe: halber Lesestand-Eintrag → rot, auch im Probe-Lauf');
  }

  console.log('pruefe-mac-nachbau — macOS-Teile (Attrappe):');
  {
    const m = attrappe();
    const r = pruefeMacNachbau(optionen('arm64', bau('arm64')), m);
    assert(r.ok && JSON.stringify(m.aufrufe) === JSON.stringify(['starte ffmpeg -version', 'otool arm64 JM Editor', 'otool arm64 ffmpeg']),
      'N16: arm64-Job startet nur ffmpeg und liest minos von App-Programm und ffmpeg (otool -arch arm64)');
    assert(r.hinweise.includes('Laufzeitprobe ffmpeg: ffmpeg version 6.1.1 Copyright (c) 2000-2023')
      && r.hinweise.includes('Laufzeitprobe ffprobe nur im Intel-Job (x64).') && r.hinweise.includes('minos App-Programm: 11.0'),
    'N16: Laufzeitprobe und minos werden gedruckt');
  }
  {
    const m = attrappe({ otool: ALT });
    const r = pruefeMacNachbau(optionen('x64', bau('x64')), m);
    assert(r.ok && JSON.stringify(m.aufrufe) === JSON.stringify(['starte ffmpeg -version', 'starte ffprobe -version', 'otool x86_64 JM Editor', 'otool x86_64 ffmpeg'])
      && r.hinweise.includes('minos ffmpeg: 10.9') && r.warnungen.length === 0, 'N16: Intel-Job startet auch ffprobe; minos 10.9 → keine Warnung');
  }
  {
    const r = pruefeMacNachbau(optionen('arm64', bau('arm64')), attrappe({ otool: BUILD.replace('11.0', '12.0') }));
    assert(r.ok && r.warnungen.includes('minos von ffmpeg ist 12.0, also über macOS 11 (Electron 33 läuft ab macOS 11).'),
      'N16: minos über macOS 11 → Warnung, kein Abbruch');
    const s = pruefeMacNachbau(optionen('arm64', bau('arm64')), attrappe({ otool: '' }));
    assert(s.ok && s.warnungen.includes('minos von App-Programm nicht lesbar (otool -l).'), 'N16: otool liefert nichts → Warnung');
  }
  {
    const r = pruefeMacNachbau(optionen('x64', bau('x64')), attrappe({ status: 1 }));
    assert(!r.ok && r.fehler.includes('Laufzeitprobe: ffmpeg -version endete mit Rückgabe 1 (dyld: Bad CPU type).')
      && r.fehler.includes('Laufzeitprobe: ffprobe -version endete mit Rückgabe 1 (dyld: Bad CPU type).'), 'N16 Gegenprobe: Programm startet nicht → rot');
    const e = Object.assign(new Error('spawnSync EACCES'), { code: 'EACCES' });
    const s = pruefeMacNachbau(optionen('arm64', bau('arm64')), attrappe({ status: null, error: e }));
    assert(!s.ok && s.fehler.some((f) => f.startsWith('Laufzeitprobe: ffmpeg -version endete mit EACCES')), 'N16 Gegenprobe: nicht ausführbar (EACCES) → rot');
  }
  {
    const r = pruefeMacNachbau({ release: join(tmpdir(), 'jm-mac-nachbau-gibt-es-nicht'), app: 'editor', version: '0.5.0', art: 'x64', lesestand: {}, probe: true }, null);
    assert(!r.ok && r.fehler.length === 1 && r.fehler[0].startsWith('Ordner „'), 'N17: release-Ordner fehlt → rot');
  }

  if (process.platform === 'darwin') {
    console.log('  --  N18 (Kommandozeile) übersprungen: unter macOS liefen echte Werkzeuge gegen die Attrappen.');
  } else {
    console.log('pruefe-mac-nachbau — Kommandozeile:');
    const lauf = (...args) => spawnSync(process.execPath, [skript, ...args], { encoding: 'utf8' });
    const stand = (b) => {
      const p = join(b.d, '..', `${b.d.split(/[\\/]/).pop()}-lesestand.json`);
      ordner.push(p);
      writeFileSync(p, JSON.stringify(b.lesestand));
      return p;
    };
    const args = (art, b, lesestand) => ['--app', 'editor', '--version', '0.5.0', '--art', art, '--release', b.d, '--lesestand', lesestand];
    {
      const b = bau('arm64');
      const k = lauf(...args('arm64', b, stand(b)), '--probe');
      assert(k.status === 0 && k.stdout.includes('pruefe-mac-nachbau: in Ordnung (editor 0.5.0 arm64, Probe).')
        && k.stdout.includes('pruefe-mac-nachbau: macOS-Teile (Laufzeitprobe, minos) übersprungen: nur unter macOS.'), 'N18: sauber mit --probe → Exit 0, Hinweise auf stdout');
      const echt = lauf(...args('arm64', b, stand(b)));
      assert(echt.status === 1 && echt.stderr.includes('pruefe-mac-nachbau: Laufzeitprobe und minos fehlen (nur unter macOS); ohne sie wird nicht hochgeladen.'),
        'N18 Gegenprobe: sauber, aber ohne --probe und ohne macOS → Exit 1');
    }
    {
      const b = bau('arm64');
      datei(join(b.d, 'JM Editor-0.5.0-mac-x64.dmg'), 'dmg');
      const k = lauf(...args('arm64', b, stand(b)));
      assert(k.status === 1 && k.stderr.includes('pruefe-mac-nachbau: genau ein DMG „JM Editor-0.5.0-mac-arm64.dmg“ erwartet, gefunden 2'),
        'N18 Gegenprobe: zwei DMGs → Exit 1, Grund auf stderr');
    }
    {
      const b = bau('x64');
      const leer = join(b.d, '..', `${b.d.split(/[\\/]/).pop()}-leer.json`);
      ordner.push(leer);
      writeFileSync(leer, '{}\n');
      const probe = lauf(...args('x64', b, leer), '--probe');
      const echt = lauf(...args('x64', b, leer));
      assert(probe.status === 0 && probe.stdout.includes('::warning::pruefe-mac-nachbau: Lesestand für editor 0.5.0 x64 ist leer.')
        && probe.stdout.includes('pruefe-mac-nachbau: in Ordnung (editor 0.5.0 x64, Probe).') && echt.status === 1
        && echt.stderr.includes('pruefe-mac-nachbau: Lesestand für editor 0.5.0 x64 ist leer; ohne Lesestand wird nicht hochgeladen.'),
      'N18: leerer Lesestand → mit --probe Exit 0 und ::warning::, ohne --probe Exit 1');
      const kaputt = lauf(...args('x64', b, join(b.d, 'gibt-es-nicht.json')));
      assert(kaputt.status === 1 && kaputt.stderr.includes('pruefe-mac-nachbau: Lesestand „'), 'N18 Gegenprobe: Lesestand unlesbar → Exit 1');
    }
    {
      const b = bau('x64');
      const ohne = lauf();
      const app = lauf('--app', 'titler', '--version', '0.12.1', '--art', 'x64', '--release', b.d, '--lesestand', 'x.json');
      const art = lauf('--app', 'editor', '--version', '0.5.0', '--art', 'universal', '--release', b.d, '--lesestand', 'x.json');
      const fremd = lauf('--app', 'editor', '--version', '0.5.0', '--art', 'x64', '--release', b.d, '--lesestand', 'x.json', '--hochladen');
      const version = lauf('--app', 'editor', '--version', '0.5', '--art', 'x64', '--release', b.d, '--lesestand', 'x.json');
      assert([ohne, app, art, fremd, version].every((k) => k.status === 2)
        && app.stderr.includes('pruefe-mac-nachbau: App „titler“ ist nicht freigegeben (bekannt: editor).'),
      'N18 Gegenprobe: falscher Aufruf (nichts, App titler, Art universal, fremde Option, Version 0.5) → Exit 2');
    }
    {
      // Wie pruefe-mac-paket (EP7): über einen Ordner-Link aufgerufen muss das Skript prüfen, statt still mit Exit 0 zu enden.
      const echt = mkdtempSync(join(tmpdir(), 'jm-mac-nachbau-skript-'));
      ordner.push(echt);
      copyFileSync(skript, join(echt, 'pruefe-mac-nachbau.mjs'));
      const linkOrdner = mkdtempSync(join(tmpdir(), 'jm-mac-nachbau-link-'));
      const link = join(linkOrdner, 'werkzeug');
      symlinkSync(echt, link, 'junction');
      try {
        const ohne = spawnSync(process.execPath, [join(link, 'pruefe-mac-nachbau.mjs')], { encoding: 'utf8' });
        const b = bau('arm64');
        datei(join(b.d, 'JM Editor-0.5.0-mac-x64.dmg'), 'dmg');
        // --probe, damit Exit 1 nur von den zwei DMGs kommt (ohne macOS endete der echte Lauf ohnehin mit 1).
        const schlecht = spawnSync(process.execPath, [join(link, 'pruefe-mac-nachbau.mjs'), ...args('arm64', b, stand(b)), '--probe'], { encoding: 'utf8' });
        assert(ohne.status === 2 && schlecht.status === 1, 'N18: Aufruf über einen Ordner-Link → prüft (Exit 2 ohne Argumente, 1 bei zwei DMGs), nie still Exit 0');
      } finally {
        unlinkSync(link);
        rmSync(linkOrdner, { recursive: true, force: true });
      }
    }
  }
} finally {
  for (const d of ordner) rmSync(d, { recursive: true, force: true });
}

console.log(failures === 0 ? '\nAlle pruefe-mac-nachbau-Tests bestanden.' : `\n${failures} pruefe-mac-nachbau-Test(s) fehlgeschlagen.`);
process.exit(failures === 0 ? 0 : 1);
````

- [ ] **Step 2: Rot-Lauf**

Run (im Worktree): `node scripts/ci/test/pruefe-mac-nachbau.test.mjs`
Expected: Exit 1 mit `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…\scripts\ci\pruefe-mac-nachbau.mjs' imported from …\scripts\ci\test\pruefe-mac-nachbau.test.mjs`.

- [ ] **Step 3: Den Prüfer und den leeren Lesestand anlegen**

`scripts/ci/mac-nachbau-lesestand.json` enthält genau `{}` und einen Zeilenumbruch (LF). `scripts/ci/pruefe-mac-nachbau.mjs` (LF):

````js
// Prüfer für den Mac-Nachbau aus einem bestehenden Tag (.github/workflows/mac-nachbau.yml; Entwurf mac-fassungen,
// Stufe 1; Owner-Freigabe 20.10.2026, F1–F4). Läuft im Bau-Job je Mac-Art nach electron-builder, vor dem Artefakt:
//
//   node scripts/ci/pruefe-mac-nachbau.mjs --app editor --version 0.5.0 --art arm64 \
//     --release apps/editor/release --lesestand scripts/ci/mac-nachbau-lesestand.json [--probe]
//
// Geprüft: genau ein DMG (das der Job-Art, Name wie artifactName), genau eine .app; App-Programm und ffmpeg haben die
// Job-Art (Mach-O-Kopf, auch Fat); ffprobe ist die Job-Art oder, im arm64-Job, die festgelegte Ausnahme x86_64
// (ffprobe-static 3.1.0 hat kein arm64-Programm); SHA-256 von ffmpeg und ffprobe gegen den Lesestand (Abweichung =
// Abbruch; leer = mit --probe Warnung samt Messwerten, sonst Abbruch). Unter macOS dazu: ffmpeg -version (im Intel-Job
// auch ffprobe -version) muss mit 0 enden; minos von App-Programm und ffmpeg wird gedruckt, über macOS 11 = Warnung.
// Ohne macOS entfallen Laufzeitprobe und minos: mit --probe nur ein Hinweis, sonst Abbruch.
// Exit 0: in Ordnung (Hinweise auf stdout, Warnungen als ::warning::). Exit 1: jede Abweichung als Zeile auf stderr.
// Exit 2: Aufruf falsch. Nur node:-Module: Der Workflow holt diese Datei aus seinem eigenen Commit (werkzeug/).
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, existsSync, openSync, readdirSync, readFileSync, readSync, realpathSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

/** Apps, die der Nachbau kennt. Stufe 2 erweitert die Liste, zusammen mit ERLAUBTE_APPS im Workflow. */
export const APPS = { editor: { produkt: 'JM Editor' } };

/** Mac-Arten: CPU-Typ im Mach-O-Kopf, Name für otool -arch, Ausgabeordner von electron-builder 24.13.3. */
export const ARTEN = {
  arm64: { cpu: 0x0100000c, otool: 'arm64', ordner: 'mac-arm64' },
  x64: { cpu: 0x01000007, otool: 'x86_64', ordner: 'mac' },
};

const MH_MAGIC = 0xfeedface;
const MH_MAGIC_64 = 0xfeedfacf;
const FAT_MAGIC = 0xcafebabe;
const FAT_MAGIC_64 = 0xcafebabf;
const HEX64 = /^[0-9a-f]{64}$/;

function artVonCpu(cpu) {
  for (const [art, a] of Object.entries(ARTEN)) if (a.cpu === cpu) return art;
  return `unbekannt:0x${cpu.toString(16).padStart(8, '0')}`;
}

/** Mac-Arten aus dem Mach-O-Kopf (dünn oder Fat), in Dateireihenfolge; null = kein Mach-O. */
export function machoArten(kopf) {
  if (!kopf || kopf.length < 8) return null;
  const le = kopf.readUInt32LE(0);
  if (le === MH_MAGIC_64 || le === MH_MAGIC) return [artVonCpu(kopf.readUInt32LE(4))];
  const be = kopf.readUInt32BE(0);
  if (be === MH_MAGIC_64 || be === MH_MAGIC) return [artVonCpu(kopf.readUInt32BE(4))];
  if (be !== FAT_MAGIC && be !== FAT_MAGIC_64) return null;
  const n = kopf.readUInt32BE(4);
  const groesse = be === FAT_MAGIC ? 20 : 32;
  // Java-Klassen beginnen auch mit cafebabe; dort steht an dieser Stelle die Klassenfassung (ab 45), nie eine kleine Zahl.
  if (n < 1 || n > 30 || kopf.length < 8 + n * groesse) return null;
  return Array.from({ length: n }, (_, i) => artVonCpu(kopf.readUInt32BE(8 + i * groesse)));
}

/** minos aus der Ausgabe von otool -l: LC_BUILD_VERSION (minos) vor LC_VERSION_MIN_MACOSX (version); null = keins. */
export function leseMinos(otoolText) {
  let build = null;
  let alt = null;
  for (const block of String(otoolText).split(/^Load command \d+\s*$/m)) {
    const cmd = /^\s*cmd (\S+)\s*$/m.exec(block)?.[1];
    if (cmd === 'LC_BUILD_VERSION' && build === null) build = /^\s*minos (\S+)\s*$/m.exec(block)?.[1] ?? null;
    if (cmd === 'LC_VERSION_MIN_MACOSX' && alt === null) alt = /^\s*version (\S+)\s*$/m.exec(block)?.[1] ?? null;
  }
  return build ?? alt;
}

/** Liegt minos über macOS 11.0? Electron 33 läuft ab macOS 11; ein Teil, der mehr verlangt, startet dort nicht. */
export function ueberMacos11(minos) {
  const [a = 0, b = 0] = String(minos).split('.').map((n) => parseInt(n, 10) || 0);
  return a > 11 || (a === 11 && b > 0);
}

/** Name des DMG wie artifactName "${productName}-${version}-${os}-${arch}.${ext}" und der Katalog (suite.json). */
export function erwarteterDmgName(app, version, art) {
  return `${APPS[app].produkt}-${version}-mac-${art}.dmg`;
}

/** Pfade in der gepackten App (extraResources resources → Contents/Resources, bundle-ffmpeg nach bin/mac). */
export function appPfade(release, app, art) {
  const produkt = APPS[app].produkt;
  const contents = join(release, ARTEN[art].ordner, `${produkt}.app`, 'Contents');
  const bin = join(contents, 'Resources', 'bin', 'mac');
  return { programm: join(contents, 'MacOS', produkt), ffmpeg: join(bin, 'ffmpeg'), ffprobe: join(bin, 'ffprobe') };
}

function kopfVon(pfad) {
  const fd = openSync(pfad, 'r');
  try {
    const puffer = Buffer.alloc(4096);
    return puffer.subarray(0, readSync(fd, puffer, 0, puffer.length, 0));
  } finally {
    closeSync(fd);
  }
}

const sha256 = (pfad) => createHash('sha256').update(readFileSync(pfad)).digest('hex');
const liste = (namen) => `${namen.length}${namen.length ? `: ${namen.join(', ')}` : ''}`;

/**
 * Prüft den release-Ordner eines Bau-Jobs. `macos` ist { starte(pfad, args) → { status, error?, stdout, stderr },
 * otool(pfad, otoolArt) → string } oder null (nicht unter macOS: Laufzeitprobe und minos entfallen; mit probe ein
 * Hinweis, sonst ein Fehler).
 */
export function pruefeMacNachbau({ release, app, version, art, lesestand, probe }, macos) {
  const fehler = [];
  const warnungen = [];
  const hinweise = [];
  const gemessen = {};
  const ergebnis = () => ({ ok: fehler.length === 0, fehler, warnungen, hinweise, gemessen });
  if (!existsSync(release) || !statSync(release).isDirectory()) {
    fehler.push(`Ordner „${release}“ fehlt.`);
    return ergebnis();
  }
  const eintraege = readdirSync(release, { withFileTypes: true });
  const dmgs = eintraege.filter((e) => e.isFile() && e.name.endsWith('.dmg')).map((e) => e.name).sort();
  const dmg = erwarteterDmgName(app, version, art);
  if (dmgs.length !== 1 || dmgs[0] !== dmg) fehler.push(`genau ein DMG „${dmg}“ erwartet, gefunden ${liste(dmgs)}.`);
  const apps = eintraege
    .filter((e) => e.isDirectory() && e.name.startsWith('mac'))
    .flatMap((e) => readdirSync(join(release, e.name), { withFileTypes: true })
      .filter((a) => a.isDirectory() && a.name.endsWith('.app'))
      .map((a) => `${e.name}/${a.name}`))
    .sort();
  const app1 = `${ARTEN[art].ordner}/${APPS[app].produkt}.app`;
  if (apps.length !== 1 || apps[0] !== app1) {
    fehler.push(`genau eine App „${app1}“ erwartet, gefunden ${liste(apps)}.`);
    return ergebnis();
  }

  const pfade = appPfade(release, app, art);
  const artenVon = (name, pfad) => {
    if (!existsSync(pfad)) {
      fehler.push(`${name} fehlt: ${pfad}`);
      return null;
    }
    const arten = machoArten(kopfVon(pfad));
    if (!arten) fehler.push(`${name} ist kein Mach-O-Programm: ${pfad}`);
    return arten;
  };
  const programm = artenVon('App-Programm', pfade.programm);
  if (programm && !programm.includes(art)) fehler.push(`App-Programm hat ${programm.join('+')}, erwartet ${art}.`);
  const ffmpeg = artenVon('ffmpeg', pfade.ffmpeg);
  if (ffmpeg && !ffmpeg.includes(art)) fehler.push(`ffmpeg hat ${ffmpeg.join('+')}, erwartet ${art} (die Mac-Art der App).`);
  const ffprobe = artenVon('ffprobe', pfade.ffprobe);
  if (ffprobe && !ffprobe.includes(art)) {
    if (art === 'arm64' && ffprobe.join() === 'x64') {
      hinweise.push('Ausnahme: ffprobe ist ein Intel-Programm (x86_64); ffprobe-static 3.1.0 liefert unter darwin/arm64 kein arm64-Programm. Auf Apple Silicon braucht der Medien-Import Rosetta 2.');
    } else {
      fehler.push(`ffprobe hat ${ffprobe.join('+')}, erwartet ${art}${art === 'arm64' ? ' oder die festgelegte Ausnahme x64' : ''}.`);
    }
  }

  if (ffmpeg && ffprobe) {
    gemessen.ffmpeg = sha256(pfade.ffmpeg);
    gemessen.ffprobe = sha256(pfade.ffprobe);
    hinweise.push(`SHA-256 ffmpeg ${gemessen.ffmpeg}, ffprobe ${gemessen.ffprobe}`);
    const e = lesestand?.[app]?.[version]?.[art];
    const werte = `Gemessen: ffmpeg ${gemessen.ffmpeg}, ffprobe ${gemessen.ffprobe}.`;
    if (e === undefined) {
      const vorschlag = JSON.stringify({ [app]: { [version]: { [art]: { ffmpeg: gemessen.ffmpeg, ffprobe: gemessen.ffprobe } } } });
      if (probe) warnungen.push(`Lesestand für ${app} ${version} ${art} ist leer. ${werte} Zum Nachtragen (mit Owner-OK): ${vorschlag}`);
      else fehler.push(`Lesestand für ${app} ${version} ${art} ist leer; ohne Lesestand wird nicht hochgeladen. ${werte}`);
    } else if (!e || typeof e !== 'object' || !HEX64.test(String(e.ffmpeg)) || !HEX64.test(String(e.ffprobe))) {
      fehler.push(`Lesestand für ${app} ${version} ${art} ist unvollständig oder ungültig (erwartet ffmpeg und ffprobe als SHA-256 in Kleinbuchstaben).`);
    } else {
      for (const name of ['ffmpeg', 'ffprobe']) {
        if (e[name] !== gemessen[name]) fehler.push(`SHA-256 von ${name} weicht vom Lesestand ab: gemessen ${gemessen[name]}, Lesestand ${e[name]}.`);
      }
    }
  }

  if (!macos) {
    // Fail closed: Nach F3 ist die Laufzeitprobe die Bedingung fürs Hochladen ohne Abnahme auf einem echten Mac.
    if (probe) hinweise.push('macOS-Teile (Laufzeitprobe, minos) übersprungen: nur unter macOS.');
    else fehler.push('Laufzeitprobe und minos fehlen (nur unter macOS); ohne sie wird nicht hochgeladen.');
    return ergebnis();
  }
  const starte = (name, pfad) => {
    const r = macos.starte(pfad, ['-version']);
    if (r.status === 0) {
      hinweise.push(`Laufzeitprobe ${name}: ${String(r.stdout).split(/\r?\n/)[0]}`);
      return;
    }
    const grund = r.error ? (r.error.code ?? String(r.error)) : `Rückgabe ${r.status}`;
    const zeile = String(r.stderr ?? '').split(/\r?\n/)[0];
    fehler.push(`Laufzeitprobe: ${name} -version endete mit ${grund}${zeile ? ` (${zeile})` : ''}.`);
  };
  if (ffmpeg?.includes(art)) starte('ffmpeg', pfade.ffmpeg);
  if (art === 'x64') {
    if (ffprobe?.includes('x64')) starte('ffprobe', pfade.ffprobe);
  } else {
    hinweise.push('Laufzeitprobe ffprobe nur im Intel-Job (x64).');
  }
  for (const [name, pfad, arten] of [['App-Programm', pfade.programm, programm], ['ffmpeg', pfade.ffmpeg, ffmpeg]]) {
    if (!arten?.includes(art)) continue;
    const minos = leseMinos(macos.otool(pfad, ARTEN[art].otool));
    if (minos === null) {
      warnungen.push(`minos von ${name} nicht lesbar (otool -l).`);
      continue;
    }
    hinweise.push(`minos ${name}: ${minos}`);
    if (ueberMacos11(minos)) warnungen.push(`minos von ${name} ist ${minos}, also über macOS 11 (Electron 33 läuft ab macOS 11).`);
  }
  return ergebnis();
}

/** Die echten macOS-Werkzeuge (nur unter darwin benutzt). */
const MACOS = {
  starte: (pfad, args) => spawnSync(pfad, args, { encoding: 'utf8', timeout: 60_000 }),
  otool: (pfad, arch) => {
    const r = spawnSync('otool', ['-arch', arch, '-l', pfad], { encoding: 'utf8', timeout: 60_000 });
    return r.status === 0 ? r.stdout : '';
  },
};

const AUFRUF = 'Aufruf: node scripts/ci/pruefe-mac-nachbau.mjs --app <app> --version <x.y.z> --art arm64|x64 --release <Ordner> --lesestand <json> [--probe]';

function hauptprogramm(argv) {
  let werte;
  try {
    ({ values: werte } = parseArgs({
      args: argv.slice(2),
      options: {
        app: { type: 'string' }, version: { type: 'string' }, art: { type: 'string' },
        release: { type: 'string' }, lesestand: { type: 'string' }, probe: { type: 'boolean', default: false },
      },
    }));
  } catch (e) {
    console.error(`pruefe-mac-nachbau: ${e.message}`);
    console.error(AUFRUF);
    return 2;
  }
  const { app, version, art, release, probe } = werte;
  if (!app || !version || !art || !release || !werte.lesestand) {
    console.error(AUFRUF);
    return 2;
  }
  if (!Object.hasOwn(APPS, app)) {
    console.error(`pruefe-mac-nachbau: App „${app}“ ist nicht freigegeben (bekannt: ${Object.keys(APPS).join(', ')}).`);
    return 2;
  }
  if (!Object.hasOwn(ARTEN, art)) {
    console.error(`pruefe-mac-nachbau: Art „${art}“ unbekannt (arm64 oder x64).`);
    return 2;
  }
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    console.error(`pruefe-mac-nachbau: Version „${version}“ hat nicht die Form x.y.z.`);
    return 2;
  }
  let lesestand;
  try {
    lesestand = JSON.parse(readFileSync(resolve(werte.lesestand), 'utf8'));
  } catch (e) {
    console.error(`pruefe-mac-nachbau: Lesestand „${werte.lesestand}“ unlesbar: ${e.message}`);
    return 1;
  }
  const r = pruefeMacNachbau({ release: resolve(release), app, version, art, lesestand, probe },
    process.platform === 'darwin' ? MACOS : null);
  for (const h of r.hinweise) console.log(`pruefe-mac-nachbau: ${h}`);
  for (const w of r.warnungen) console.log(`::warning::pruefe-mac-nachbau: ${w}`);
  if (r.ok) {
    console.log(`pruefe-mac-nachbau: in Ordnung (${app} ${version} ${art}${probe ? ', Probe' : ''}).`);
    return 0;
  }
  for (const f of r.fehler) console.error(`pruefe-mac-nachbau: ${f}`);
  return 1;
}

/** Hauptprogramm? Beide Seiten über realpath, sonst endete ein Aufruf über einen Ordner-Link still mit Exit 0 (EP7). */
function istHauptprogramm(arg) {
  if (!arg) return false;
  try {
    return realpathSync(resolve(arg)) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (istHauptprogramm(process.argv[1])) process.exitCode = hauptprogramm(process.argv);
````

- [ ] **Step 4: Grün-Lauf**

Run: `node scripts/ci/test/pruefe-mac-nachbau.test.mjs`
Expected: 54 Zeilen `  ok  …` (N1–N18), kein `FAIL`, letzte Zeile `Alle pruefe-mac-nachbau-Tests bestanden.`, Exit 0. Unter
macOS stünde statt der sieben N18-Zeilen `  --  N18 (Kommandozeile) übersprungen …`.
Dann: `node -e "console.log(require('fs').readdirSync(require('os').tmpdir()).filter(n=>n.startsWith('jm-mac-nachbau')))"`
→ `[]`. Der Test räumt seine Temp-Ordner weg.

- [ ] **Step 5: Gegenproben** (je eine Änderung im Prüfer, Test laufen lassen, Änderung zurücknehmen; gemessen am
  20.10.2026 mit Node 24)

| Nr. | Absichtlicher Fehler in `pruefe-mac-nachbau.mjs` | Erwartet rot (FAIL-Zeilen) |
|---|---|---|
| G1 | `if (ffmpeg && !ffmpeg.includes(art)) fehler.push(` → `if (false) fehler.push(` | 2: beide `N9 Gegenprobe` |
| G2 | `if (art === 'arm64' && ffprobe.join() === 'x64') {` → `if (false) {` | 8: `N4` (3×: sauber, Ausnahme, Gegenprobe echter Lauf), `N10`, `N16` (3×: arm64-Job, minos über 11, otool leer), `N18: sauber mit --probe` |
| G3 | `if (probe) warnungen.push(` → `if (true) warnungen.push(` | 2: `N14 Gegenprobe: leerer Lesestand im echten Lauf`, `N18: leerer Lesestand …` |
| G4 | `if (ffprobe?.includes('x64')) starte('ffprobe', pfade.ffprobe);` → `;` | 2: `N16: Intel-Job startet auch ffprobe …`, `N16 Gegenprobe: Programm startet nicht` |
| G5 | `if (dmgs.length !== 1 \|\| dmgs[0] !== dmg)` → `if (dmgs.length < 1)` | 4: `N6 Gegenprobe: zwei DMGs`, `N7`, `N18 Gegenprobe: zwei DMGs`, `N18: Aufruf über einen Ordner-Link` |
| G6 | `return realpathSync(resolve(arg)) === realpathSync(fileURLToPath(import.meta.url));` → `return resolve(arg) === fileURLToPath(import.meta.url);` | 1: `N18: Aufruf über einen Ordner-Link` |
| G7 | `if (n < 1 \|\| n > 30 \|\| kopf.length` → `if (n < 1 \|\| kopf.length` (Java-Schutz weg) | 1: `N1: Java-Klasse (… 4096 Bytes)` |
| G8 | `for (const name of ['ffmpeg', 'ffprobe']) {` → `for (const name of ['ffmpeg']) {` (ffprobe nicht gegen den Lesestand) | 2: `N13 Gegenprobe: ffprobe weicht vom Lesestand ab` (probe=false, probe=true) |
| G9 | `if (dmgs.length !== 1 \|\| dmgs[0] !== dmg)` → `if (dmgs.length > 1 \|\| (dmgs.length === 1 && dmgs[0] !== dmg))` (kein DMG hingenommen) | 1: `N6 Gegenprobe: kein DMG` |
| G10 | `const groesse = be === FAT_MAGIC ? 20 : 32;` → `const groesse = 20;` | 1: `N1: Fat mit 64-Bit-Einträgen …` |
| G11 | `if (art === 'arm64' && ffprobe.join() === 'x64') {` → `if (art === 'arm64') {` (Ausnahme für jede Art) | 1: `N11 Gegenprobe: ffprobe fremder Art im arm64-Job` |
| G12 | `else fehler.push('Laufzeitprobe und minos fehlen` → `else hinweise.push('Laufzeitprobe und minos fehlen` (ohne macOS auch im echten Lauf nur Hinweis) | 2: `N4 Gegenprobe: echter Lauf ohne macOS`, `N18 Gegenprobe: sauber, aber ohne --probe und ohne macOS` |

G6 und G7 kamen bei der Umsetzung dazu; mit dem ursprünglichen 8-Byte-Java-Kopf blieb G7 grün, darum hat der Test in
N1 einen 4096-Byte-Kopf wie `kopfVon`. G8–G12 kamen mit der Prüfung Runde 1 (dort M2, M16, M3, M4 und Befund 5). Nicht
messbar unter Linux und Windows: eine kaputte Weiche `process.platform === 'darwin'` (dort ist `macos` immer `null`).
Seit G12 endet der echte Lauf dann aber auch auf dem Mac-Runner rot, statt still ohne Laufzeitprobe grün.

Nach jeder Gegenprobe zurücknehmen. Am Ende Step 4 noch einmal: 54 ok, Exit 0.

- [ ] **Step 6: Zeilenenden**

Run: `node -e "for (const f of ['scripts/ci/pruefe-mac-nachbau.mjs','scripts/ci/mac-nachbau-lesestand.json','scripts/ci/test/pruefe-mac-nachbau.test.mjs']) console.log(f, (require('fs').readFileSync(f,'utf8').match(/\r/g)||[]).length)"`
Expected: dreimal `0`.

- [ ] **Step 7: Commit**

```bash
git add scripts/ci/pruefe-mac-nachbau.mjs scripts/ci/mac-nachbau-lesestand.json scripts/ci/test/pruefe-mac-nachbau.test.mjs
git commit -F - <<'EOF'
feat(ci): Pruefer fuer den Mac-Nachbau (ein DMG je Art, ffmpeg-Art, Lesestand, Laufzeitprobe)

Entwurf mac-fassungen Stufe 1, Owner-Freigabe 20.10.2026 (F1-F4). Nur node:-Module; macOS-Teile
(Programmstart, otool) nur unter darwin, im Selbsttest als Attrappe. Lesestand anfangs leer.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
git status --short
```
Expected: `git status --short` zeigt keine dieser drei Dateien mehr.

---

### Task 2: Sammler für ffmpeg-Lizenz und Build-Angaben, Quellen-Hinweis

**Files:**
- Create: `scripts/ci/sammle-ffmpeg-beilagen.mjs`
- Create: `scripts/ci/ffmpeg-quellen-hinweis.txt`
- Test: `scripts/ci/test/sammle-ffmpeg-beilagen.test.mjs`

**Interfaces:**
- Consumes (Task 1): `APPS`, `ARTEN`, `appPfade(release, app, art).ffmpeg`, alle aus `./pruefe-mac-nachbau.mjs`. Import
  über den relativen Pfad; der Workflow holt beide Dateien in denselben Ordner.
- Produces (Task 3 nutzt das):
  - `export const BELEGT = { ffmpegStatic: '5.3.0', binaerRelease: 'b6.1.1' }`
  - `export const UMLENKUNGEN = ['FFMPEG_BIN', 'FFMPEG_BINARY_RELEASE', 'FFMPEG_BINARIES_URL']`
  - `beilagenNamen(art) → { lizenz: 'ffmpeg-mac-<art>.LICENSE.txt', angaben: 'ffmpeg-mac-<art>.README.txt', quellen: 'ffmpeg-QUELLEN.txt' }`
  - `sammleFfmpegBeilagen({ ffmpegStatic, appFfmpeg, hinweis, ziel, art, env }) → { ok, fehler: string[], dateien: string[], steckbrief: string[] }`.
    Kopiert wird nur, wenn alles stimmt. `steckbrief` (Größe, SHA-256 und bis zu 10 Zeilen von LICENSE und README,
    entschärft fürs Protokoll) ist immer gefüllt; die Kommandozeile druckt ihn im Gutfall auf stdout, beim Abbruch auf stderr.
  - Kommandozeile: `node scripts/ci/sammle-ffmpeg-beilagen.mjs --app <app> --art arm64|x64 --release <Ordner> --ffmpeg-static <Ordner> --hinweis <Datei> --ziel <Ordner>`, Exit 0, 1 oder 2.

- [ ] **Step 1: Den Test schreiben** (`scripts/ci/test/sammle-ffmpeg-beilagen.test.mjs`, LF)

````js
// Selbsttest für scripts/ci/sammle-ffmpeg-beilagen.mjs (Mac-Nachbau, F2 (ii)): nachgebautes ffmpeg-static im Temp-Ordner,
// dazu die Namensprobe gegen die echte Paketwahl des Proxys (services/release-proxy/paketwahl.js; der Launcher hat dieselbe
// Regel in apps/launcher/src/main/release-wahl.ts, beide prüfen test/paketwahl-faelle.json) und der Wortlaut des Hinweises.
//   node scripts/ci/test/sammle-ffmpeg-beilagen.test.mjs
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { waehleRelease } from '../../../services/release-proxy/paketwahl.js';
import { appPfade } from '../pruefe-mac-nachbau.mjs';
import { beilagenNamen, sammleFfmpegBeilagen } from '../sammle-ffmpeg-beilagen.mjs';

const hier = dirname(fileURLToPath(import.meta.url));
const skript = join(hier, '..', 'sammle-ffmpeg-beilagen.mjs');
const hinweisImRepo = join(hier, '..', 'ffmpeg-quellen-hinweis.txt');

let failures = 0;
function assert(cond, name) {
  if (cond) console.log(`  ok  ${name}`);
  else {
    failures++;
    console.error(`FAIL  ${name}`);
  }
}
function datei(pfad, inhalt = '') {
  mkdirSync(dirname(pfad), { recursive: true });
  writeFileSync(pfad, inhalt);
}
const sha = (inhalt) => createHash('sha256').update(inhalt).digest('hex');
/** Byte für Byte gleich; fehlt eine Seite, ist das ungleich und kein Absturz. */
const gleich = (a, b) => existsSync(a) && existsSync(b) && readFileSync(a).equals(readFileSync(b));

/** Wie ein GPL-Volltext: Kopf, Schluss und `bytes` Bytes (gemessen: GPLv2 17 984 B, GPLv3 35 147 B). */
function gplText({ kopf = '                    GNU GENERAL PUBLIC LICENSE', bytes = 18000, schluss = true } = {}) {
  const anfang = `${kopf}\r\n                       Version 3, 29 June 2007\r\n\r\n                       TERMS AND CONDITIONS\r\n\r\n`;
  const ende = schluss ? '\r\n                     END OF TERMS AND CONDITIONS\r\n' : '\r\n';
  const zeile = '  Absatz der Lizenz.\r\n';
  const rest = bytes - anfang.length - ende.length;
  return anfang + zeile.repeat(Math.floor(rest / zeile.length)) + ' '.repeat(rest % zeile.length) + ende;
}
const GPL = gplText();
const README = 'FFmpeg 64-bit static build\n\nVersion: 6.1.1\n';
const HINWEIS = 'Hinweis\n';
/** So ungefähr sieht FFmpegs LICENSE.md aus (sinngemäß); 4 316 B wie R1 der Prüfung, Release b6.1.1 hat 4 346 bzw. 4 376 B. */
const LIZENZ_MD = (() => {
  const kopf = '# License\n\nMost files in FFmpeg are under the GNU Lesser General Public License version 2.1\nor later (LGPL v2.1+).\n';
  const zeile = 'Einige optionale Teile stehen unter der GPL.\n';
  const rest = 4316 - kopf.length;
  return kopf + zeile.repeat(Math.floor(rest / zeile.length)) + '-'.repeat(rest % zeile.length);
})();

const ordner = [];
/** ffmpeg-static nach npm ci auf einem Mac (install.js legt ffmpeg, ffmpeg.LICENSE, ffmpeg.README), dazu die App. */
function lage(art = 'arm64', { version = '5.3.0', release = 'b6.1.1', lizenz = GPL } = {}) {
  const d = mkdtempSync(join(tmpdir(), 'jm-ffmpeg-beilagen-'));
  ordner.push(d);
  const fs = join(d, 'node_modules', 'ffmpeg-static');
  datei(join(fs, 'package.json'), JSON.stringify({ name: 'ffmpeg-static', version, 'ffmpeg-static': { 'binary-release-tag': release } }));
  datei(join(fs, 'ffmpeg'), `ffmpeg-${art}`);
  datei(join(fs, 'ffmpeg.LICENSE'), lizenz);
  datei(join(fs, 'ffmpeg.README'), README);
  const release1 = join(d, 'apps', 'editor', 'release');
  datei(appPfade(release1, 'editor', art).ffmpeg, `ffmpeg-${art}`);
  datei(join(d, 'hinweis.txt'), HINWEIS);
  return {
    d, ffmpegStatic: fs, release: release1,
    optionen: { ffmpegStatic: fs, appFfmpeg: appPfade(release1, 'editor', art).ffmpeg, hinweis: join(d, 'hinweis.txt'), ziel: join(d, 'paket'), art, env: {} },
  };
}

try {
  console.log('sammle-ffmpeg-beilagen — Namen gegen die Paketwahl:');
  {
    const n = beilagenNamen('arm64');
    assert(n.lizenz === 'ffmpeg-mac-arm64.LICENSE.txt' && n.angaben === 'ffmpeg-mac-arm64.README.txt' && n.quellen === 'ffmpeg-QUELLEN.txt',
      'B1: Beilagen-Namen je Art (LICENSE, README) und ein Quellen-Hinweis');
    const beilagen = ['x64', 'arm64'].flatMap((a) => Object.values(beilagenNamen(a)));
    const asset = (name) => ({ name });
    const voll = [{
      tag_name: 'editor-v0.5.0', draft: false,
      assets: ['JM.Editor-0.5.0-win-x64.exe', 'JM.Editor-0.5.0-mac-x64.dmg', 'JM.Editor-0.5.0-mac-arm64.dmg', ...beilagen].map(asset),
    }];
    const w = (rel, p, a) => waehleRelease(rel, 'editor-v', p, a);
    assert(w(voll, 'mac', 'arm64').asset?.name === 'JM.Editor-0.5.0-mac-arm64.dmg' && w(voll, 'mac', 'x64').asset?.name === 'JM.Editor-0.5.0-mac-x64.dmg'
      && w(voll, 'win', 'x64').asset?.name === 'JM.Editor-0.5.0-win-x64.exe', 'B2: Release mit DMGs, exe und Beilagen → die Paketwahl nimmt DMG bzw. exe');
    const nurBeilagen = [{ tag_name: 'editor-v0.5.0', draft: false, assets: beilagen.map(asset) }];
    assert(['arm64', 'x64'].every((a) => w(nurBeilagen, 'mac', a).art === 'kein-paket') && w(nurBeilagen, 'win', 'x64').art === 'kein-paket',
      'B2 Gegenprobe: Release nur mit Beilagen → kein Paket für Mac (arm64, x64) und Windows; keine Beilage passt aufs Paketmuster');
  }

  console.log('sammle-ffmpeg-beilagen — Einsammeln:');
  {
    const l = lage('arm64');
    const r = sammleFfmpegBeilagen(l.optionen);
    const z = l.optionen.ziel;
    // Ohne Zielordner eine FAIL-Zeile statt eines Absturzes, der alle folgenden Prüfungen verschluckte.
    const ziel = existsSync(z) ? readdirSync(z).sort() : [];
    // Die drei Quellen unterscheiden sich; nur so fällt eine vertauschte Kopie auf.
    assert(new Set([GPL, README, HINWEIS]).size === 3 && r.ok
      && JSON.stringify(ziel) === JSON.stringify(['ffmpeg-QUELLEN.txt', 'ffmpeg-mac-arm64.LICENSE.txt', 'ffmpeg-mac-arm64.README.txt'])
      && gleich(join(z, 'ffmpeg-mac-arm64.LICENSE.txt'), join(l.ffmpegStatic, 'ffmpeg.LICENSE'))
      && gleich(join(z, 'ffmpeg-mac-arm64.README.txt'), join(l.ffmpegStatic, 'ffmpeg.README'))
      && gleich(join(z, 'ffmpeg-QUELLEN.txt'), l.optionen.hinweis), 'B3: sauber → genau drei Dateien, jede Byte für Byte aus ihrer Quelle');
    const s = r.steckbrief ?? [];
    const iReadme = s.indexOf(`ffmpeg.README: ${README.length} B, SHA-256 ${sha(README)}`);
    assert(s[0] === `ffmpeg.LICENSE: ${GPL.length} B, SHA-256 ${sha(GPL)}` && s[1] === '  | GNU GENERAL PUBLIC LICENSE'
      && iReadme >= 2 && iReadme <= 11 && s[iReadme + 1] === '  | FFmpeg 64-bit static build' && s[iReadme + 2] === '  | Version: 6.1.1',
    'B3: Steckbrief fürs Protokoll (Größe, SHA-256 und Anfang von LICENSE und README, je höchstens 10 Zeilen)');
  }
  {
    const l = lage();
    rmSync(join(l.ffmpegStatic, 'ffmpeg.LICENSE'));
    rmSync(join(l.ffmpegStatic, 'ffmpeg.README'));
    const r = sammleFfmpegBeilagen(l.optionen);
    assert(!r.ok && r.fehler.some((f) => f.startsWith('fehlt: ') && f.endsWith('ffmpeg.LICENSE')) && r.fehler.some((f) => f.endsWith('ffmpeg.README'))
      && readdirSync(l.d).every((n) => n !== 'paket'), 'B4 Gegenprobe: install.js hat LICENSE und README nicht geladen (404 = nur Warnung) → rot, nichts kopiert');
  }
  {
    const l = lage();
    writeFileSync(l.optionen.appFfmpeg, 'ffmpeg-anders');
    const r = sammleFfmpegBeilagen(l.optionen);
    assert(!r.ok && r.fehler.includes('ffmpeg im Paket ist nicht das aus ffmpeg-static; LICENSE und README gehörten dann zu einem anderen Programm.'),
      'B5 Gegenprobe: ffmpeg im Paket weicht von ffmpeg-static ab → rot');
  }
  {
    const a = sammleFfmpegBeilagen(lage('x64', { version: '5.2.0' }).optionen);
    const b = sammleFfmpegBeilagen(lage('x64', { release: 'b6.0' }).optionen);
    assert(!a.ok && a.fehler.includes('ffmpeg-static 5.2.0, der Quellen-Hinweis ist für 5.3.0 geschrieben.')
      && !b.ok && b.fehler.includes('Binär-Release b6.0, der Quellen-Hinweis ist für b6.1.1 geschrieben.'),
    'B6 Gegenprobe: andere ffmpeg-static-Fassung oder anderes Binär-Release → rot (der Hinweis nennt 5.3.0 und b6.1.1)');
  }
  // Fest geschrieben, nicht aus UMLENKUNGEN abgeleitet: index.js:16-17 und install.js:163-172 von ffmpeg-static 5.3.0.
  for (const v of ['FFMPEG_BIN', 'FFMPEG_BINARY_RELEASE', 'FFMPEG_BINARIES_URL']) {
    const r = sammleFfmpegBeilagen({ ...lage().optionen, env: { [v]: 'x' } });
    assert(!r.ok && r.fehler.includes(`${v} ist gesetzt; der Quellen-Hinweis gilt nur für das Standard-Release von ffmpeg-static.`),
      `B7 Gegenprobe: Umlenkung per ${v} → rot`);
  }
  {
    // Je Fall fehlt genau ein Merkmal des Volltexts, damit jede Teilprüfung allein rot werden kann.
    const ein = (lizenz) => sammleFfmpegBeilagen(lage('arm64', { lizenz }).optionen).fehler;
    const kopf = ein(gplText({ kopf: '                  GNU LESSER GENERAL PUBLIC LICENSE' }));
    assert(JSON.stringify(kopf) === JSON.stringify(['ffmpeg.LICENSE ist kein GPL-Volltext: erste Zeile „GNU LESSER GENERAL PUBLIC LICENSE“ ohne GNU GENERAL PUBLIC LICENSE.']),
      'B8 Gegenprobe: LGPL-Volltext (Länge und Schluss passen) → rot wegen der ersten Zeile');
    const kurz = ein(gplText({ kopf: 'GNU GENERAL PUBLIC LICENSE (Auszug)', bytes: 4337 }));
    assert(JSON.stringify(kurz) === JSON.stringify(['ffmpeg.LICENSE ist kein GPL-Volltext: 4337 B statt mindestens 15000 B.']),
      'B8 Gegenprobe (R2): 4 337 B mit GPL-Kopf und Schluss → rot wegen der Länge');
    const ohneSchluss = ein(gplText({ schluss: false }));
    assert(JSON.stringify(ohneSchluss) === JSON.stringify(['ffmpeg.LICENSE ist kein GPL-Volltext: ohne Schluss END OF TERMS AND CONDITIONS.']),
      'B8 Gegenprobe: GPL-Kopf und Länge, aber ohne Schluss → rot');
    const md = ein(LIZENZ_MD);
    assert(JSON.stringify(md) === JSON.stringify(['ffmpeg.LICENSE ist kein GPL-Volltext: erste Zeile „# License“ ohne GNU GENERAL PUBLIC LICENSE; '
      + '4316 B statt mindestens 15000 B; ohne Schluss END OF TERMS AND CONDITIONS.']), 'B8 Gegenprobe (R1): Text wie FFmpegs LICENSE.md → rot, alle drei Mängel genannt');
  }
  for (const [inhalt, name] of [['', 'leer'], ['\n\n \r\n\t\n', 'nur Leerzeilen']]) {
    const l = lage();
    writeFileSync(l.optionen.hinweis, inhalt);
    const s = sammleFfmpegBeilagen(l.optionen);
    assert(!s.ok && s.fehler.some((f) => f.startsWith('Quellen-Hinweis fehlt oder ist leer:')), `B8 Gegenprobe: Quellen-Hinweis ${name} → rot`);
  }

  console.log('sammle-ffmpeg-beilagen — Kommandozeile und Hinweis im Repo:');
  {
    const env = { ...process.env };
    for (const v of ['FFMPEG_BIN', 'FFMPEG_BINARY_RELEASE', 'FFMPEG_BINARIES_URL']) delete env[v];
    const lauf = (args, mitEnv = env) => spawnSync(process.execPath, [skript, ...args], { encoding: 'utf8', env: mitEnv });
    const argsFuer = (l, art) => ['--app', 'editor', '--art', art, '--release', l.release, '--ffmpeg-static', l.ffmpegStatic,
      '--hinweis', l.optionen.hinweis, '--ziel', l.optionen.ziel];
    const l = lage('x64');
    const args = argsFuer(l, 'x64');
    const gut = lauf(args);
    assert(gut.status === 0 && gut.stdout.includes('sammle-ffmpeg-beilagen: in Ordnung (ffmpeg-mac-x64.LICENSE.txt, ffmpeg-mac-x64.README.txt, ffmpeg-QUELLEN.txt).')
      && gut.stdout.includes(`sammle-ffmpeg-beilagen: ffmpeg.README: ${README.length} B, SHA-256 ${sha(README)}\n`),
    'B9: Kommandozeile sauber → Exit 0, Steckbrief im Protokoll');
    rmSync(join(l.ffmpegStatic, 'ffmpeg.LICENSE'));
    const schlecht = lauf(args);
    const ohne = lauf([]);
    const app = lauf(args.map((a) => (a === 'editor' ? 'titler' : a)));
    assert(schlecht.status === 1 && schlecht.stderr.includes('sammle-ffmpeg-beilagen: fehlt: ') && ohne.status === 2 && app.status === 2,
      'B9 Gegenprobe: Kommandozeile mit fehlender LICENSE → Exit 1; ohne Argumente oder fremde App → Exit 2');

    // Die Kommandozeile muss die echte Umgebung durchreichen; der Workflow ruft genau sie auf.
    const u = lage('x64');
    const umgelenkt = lauf(argsFuer(u, 'x64'), { ...env, FFMPEG_BINARY_RELEASE: 'b9.9' });
    assert(umgelenkt.status === 1 && umgelenkt.stderr.includes('sammle-ffmpeg-beilagen: FFMPEG_BINARY_RELEASE ist gesetzt;')
      && !existsSync(u.optionen.ziel), 'B7 Gegenprobe (Kommandozeile): FFMPEG_BINARY_RELEASE in der Umgebung → Exit 1, nichts kopiert');

    // Bricht der Sammler ab, muss das Protokoll schon die Grundlage für den Entscheid tragen (Prüfung Task 2, W1).
    const m = lage('arm64', { lizenz: LIZENZ_MD });
    const abbruch = lauf(argsFuer(m, 'arm64'));
    assert(abbruch.status === 1
      && abbruch.stderr.includes('sammle-ffmpeg-beilagen: ffmpeg.LICENSE ist kein GPL-Volltext: erste Zeile „# License“')
      && abbruch.stderr.includes(`sammle-ffmpeg-beilagen: ffmpeg.LICENSE: 4316 B, SHA-256 ${sha(LIZENZ_MD)}\n`)
      && abbruch.stderr.includes('sammle-ffmpeg-beilagen:   | # License\n')
      && abbruch.stderr.includes('sammle-ffmpeg-beilagen:   | or later (LGPL v2.1+).\n')
      && abbruch.stderr.includes(`sammle-ffmpeg-beilagen: ffmpeg.README: ${README.length} B, SHA-256 ${sha(README)}\n`)
      && abbruch.stderr.includes('sammle-ffmpeg-beilagen:   | Version: 6.1.1\n'),
    'B12: Abbruch → stderr nennt Größe, SHA-256 und Anfang von LICENSE und README');

    // Text aus dem Netz darf im Protokoll keinen Workflow-Befehl bilden: Der Runner trennt Zeilen auch an \r, und ##[…]
    // wirkt an jeder Stelle der Zeile.
    const f = lage('arm64', { lizenz: '# Lizenz\r::error::falsch ##[add-mask]geheim\n' });
    const falle = lauf(argsFuer(f, 'arm64'));
    const zeilen = falle.stderr.split(/\r\n|\r|\n/);
    assert(falle.status === 1 && falle.stderr.includes('Lizenz') && falle.stderr.includes('geheim')
      && zeilen.every((z) => !z.trimStart().startsWith('::')) && !falle.stderr.includes('##['),
    'B12 Gegenprobe: Steuerzeichen und ##[ aus LICENSE werden im Protokoll entschärft');

    // Wie pruefe-mac-nachbau (N18, EP7): Über einen Ordner-Link aufgerufen muss der Sammler arbeiten, statt still mit Exit 0
    // und ohne Beilagen zu enden. Der Prüfer kommt mit, weil der Sammler ihn über den relativen Pfad lädt.
    const echt = mkdtempSync(join(tmpdir(), 'jm-ffmpeg-beilagen-skript-'));
    ordner.push(echt);
    copyFileSync(skript, join(echt, 'sammle-ffmpeg-beilagen.mjs'));
    copyFileSync(join(hier, '..', 'pruefe-mac-nachbau.mjs'), join(echt, 'pruefe-mac-nachbau.mjs'));
    const linkOrdner = mkdtempSync(join(tmpdir(), 'jm-ffmpeg-beilagen-link-'));
    const link = join(linkOrdner, 'werkzeug');
    symlinkSync(echt, link, 'junction');
    try {
      const ueberLink = (...a) => spawnSync(process.execPath, [join(link, 'sammle-ffmpeg-beilagen.mjs'), ...a], { encoding: 'utf8', env });
      const k = lage('arm64');
      const leer = ueberLink();
      const sauber = ueberLink(...argsFuer(k, 'arm64'));
      assert(leer.status === 2 && sauber.status === 0 && existsSync(join(k.optionen.ziel, 'ffmpeg-mac-arm64.LICENSE.txt')),
        'B11: Aufruf über einen Ordner-Link → arbeitet (Exit 2 ohne Argumente, sauber Exit 0 mit Beilagen), nie still Exit 0');
    } finally {
      unlinkSync(link);
      rmSync(linkOrdner, { recursive: true, force: true });
    }
  }
  {
    const text = readFileSync(hinweisImRepo, 'utf8');
    // Die Beilagen-Namen kommen aus beilagenNamen; quellen ist der Hinweis selbst und steht darum nicht im Text.
    const namen = ['x64', 'arm64'].flatMap((a) => [beilagenNamen(a).lizenz, beilagenNamen(a).angaben]);
    assert(['ffmpeg-static 5.3.0', 'b6.1.1', 'GPL', 'evermeet.cx', 'osxexperts.net', 'ffprobe-static 3.1.0', 'FFmpeg 4.0.2', '4.4-tessus', ...namen]
      .every((s) => text.includes(s)) && namen.length === 4,
    'B10: Hinweis im Repo nennt Fassungen (ffmpeg und ffprobe), Binär-Release, Lizenz, Herkunft und alle vier Beilagen aus beilagenNamen');
    assert(!/["']/.test(text), 'B10: Hinweis ohne ASCII-Anführungszeichen');
  }
} finally {
  for (const d of ordner) rmSync(d, { recursive: true, force: true });
}

console.log(failures === 0 ? '\nAlle sammle-ffmpeg-beilagen-Tests bestanden.' : `\n${failures} sammle-ffmpeg-beilagen-Test(s) fehlgeschlagen.`);
process.exit(failures === 0 ? 0 : 1);
````

- [ ] **Step 2: Rot-Lauf**

Run: `node scripts/ci/test/sammle-ffmpeg-beilagen.test.mjs`
Expected: Exit 1 mit `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…\scripts\ci\sammle-ffmpeg-beilagen.mjs' imported from …\scripts\ci\test\sammle-ffmpeg-beilagen.test.mjs`.

Nachbesserung Runde 1 (gemessen): der Test unten gegen den Sammler aus Commit `8c4327c77a` → Exit 1, 15 ok, 10 FAIL
(B3 Steckbrief, B8 viermal GPL-Volltext und einmal Hinweis nur Leerzeilen, B9, B12 zweimal, B10). Die Gegenprobe B12 war
dabei echt rot: Der alte Fehlertext gab `##[` und ein einzelnes `\r` aus LICENSE ungefiltert ins Protokoll.

- [ ] **Step 3: Den Sammler und den Quellen-Hinweis anlegen**

`scripts/ci/sammle-ffmpeg-beilagen.mjs` (LF):

````js
// Sammelt GPL-Text und Build-Angaben von ffmpeg-static für das Release (Mac-Nachbau, Entwurf mac-fassungen F2 (ii),
// Owner-Freigabe 20.10.2026). install.js von ffmpeg-static legt beides neben das Programm (ffmpeg.LICENSE und
// ffmpeg.README, install.js:175-176, :184, :187), lädt es ohne Prüfsumme und warnt bei 404 nur (:29-32). Darum hier:
// Beides muss da sein, das ffmpeg im Paket muss Byte für Byte das aus ffmpeg-static sein, und Fassung und Binär-Release
// müssen die sein, für die ffmpeg-quellen-hinweis.txt geschrieben ist. LICENSE muss ein GPL-Volltext sein; die Mac-Dateien
// im Release b6.1.1 sind laut gh release view nur 4 346 bzw. 4 376 B groß, also wohl keiner (Prüfung Task 2, W1). Darum
// druckt der Sammler immer Größe, SHA-256 und Anfang von LICENSE und README, auch beim Abbruch.
//
//   node scripts/ci/sammle-ffmpeg-beilagen.mjs --app editor --art arm64 --release apps/editor/release \
//     --ffmpeg-static node_modules/ffmpeg-static --hinweis scripts/ci/ffmpeg-quellen-hinweis.txt --ziel paket
//
// Exit 0: drei Dateien in --ziel. Exit 1: Abweichung (stderr), nichts kopiert. Exit 2: Aufruf falsch. Nur node:-Module und
// der Prüfer daneben; der Workflow holt beide aus seinem eigenen Commit (werkzeug/scripts/ci/).
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { APPS, ARTEN, appPfade } from './pruefe-mac-nachbau.mjs';

/** Fassung, für die ffmpeg-quellen-hinweis.txt geschrieben ist (editor-v0.5.0:package-lock.json, ffmpeg-static/package.json). */
export const BELEGT = { ffmpegStatic: '5.3.0', binaerRelease: 'b6.1.1' };
/** Damit lenkt ffmpeg-static Programm, Release oder Quelle um (index.js:16-17, install.js:163-172). */
export const UMLENKUNGEN = ['FFMPEG_BIN', 'FFMPEG_BINARY_RELEASE', 'FFMPEG_BINARIES_URL'];

/** Asset-Namen am Release. Keiner endet auf .dmg oder .exe, keiner passt also auf die Paketwahl (paketwahl.js:26-33). */
export function beilagenNamen(art) {
  return { lizenz: `ffmpeg-mac-${art}.LICENSE.txt`, angaben: `ffmpeg-mac-${art}.README.txt`, quellen: 'ffmpeg-QUELLEN.txt' };
}

/** Merkmale eines GPL-Volltexts (gemessen: GPLv2 17 984 B, GPLv3 35 147 B; LGPL beginnt mit GNU LESSER …). */
const GPL_VOLLTEXT = { kopf: 'GNU GENERAL PUBLIC LICENSE', mindestBytes: 15000, schluss: 'END OF TERMS AND CONDITIONS' };
/** So viele Zeilen von LICENSE und README kommen ins Protokoll. */
const STECKBRIEF_ZEILEN = 10;

const istDatei = (p) => existsSync(p) && statSync(p).isFile();
const sha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const zeilen = (p) => readFileSync(p, 'utf8').split(/\r?\n/).map((z) => z.trim()).filter((z) => z !== '');
/**
 * Text aus dem Netz fürs CI-Protokoll: Der Runner trennt Zeilen auch an einem einzelnen \r (danach könnte ::befehl::
 * stehen), und ##[befehl] wirkt an jeder Stelle der Zeile. Darum Steuerzeichen als ? und ##[ als #?[, höchstens 160 Zeichen.
 */
const fuersProtokoll = (z) => z.replace(/[\u0000-\u001f\u007f-\u009f]/g, '?').replaceAll('##[', '#?[').slice(0, 160);

/** Größe, SHA-256 und Anfang einer Datei, damit schon das Protokoll eines Abbruchs zeigt, was ffmpeg-static geliefert hat. */
function steckbrief(p, name) {
  if (!istDatei(p)) return [`${name}: fehlt`];
  return [`${name}: ${statSync(p).size} B, SHA-256 ${sha256(p)}`, ...zeilen(p).slice(0, STECKBRIEF_ZEILEN).map((z) => `  | ${fuersProtokoll(z)}`)];
}

/**
 * Prüft ffmpeg-static und kopiert LICENSE, README und Hinweis nach `ziel` (nur wenn alles stimmt).
 * @returns {{ ok: boolean, fehler: string[], dateien: string[], steckbrief: string[] }}
 */
export function sammleFfmpegBeilagen({ ffmpegStatic, appFfmpeg, hinweis, ziel, art, env }) {
  const fehler = [];
  for (const v of UMLENKUNGEN) {
    if (env[v]) fehler.push(`${v} ist gesetzt; der Quellen-Hinweis gilt nur für das Standard-Release von ffmpeg-static.`);
  }
  let pkg = null;
  try {
    pkg = JSON.parse(readFileSync(join(ffmpegStatic, 'package.json'), 'utf8'));
  } catch {
    fehler.push(`package.json von ffmpeg-static fehlt oder ist unlesbar: ${ffmpegStatic}`);
  }
  if (pkg) {
    if (pkg.version !== BELEGT.ffmpegStatic) fehler.push(`ffmpeg-static ${pkg.version}, der Quellen-Hinweis ist für ${BELEGT.ffmpegStatic} geschrieben.`);
    const rel = pkg['ffmpeg-static']?.['binary-release-tag'];
    if (rel !== BELEGT.binaerRelease) fehler.push(`Binär-Release ${rel}, der Quellen-Hinweis ist für ${BELEGT.binaerRelease} geschrieben.`);
  }
  const quelle = join(ffmpegStatic, 'ffmpeg');
  const lizenz = join(ffmpegStatic, 'ffmpeg.LICENSE');
  const angaben = join(ffmpegStatic, 'ffmpeg.README');
  for (const p of [quelle, lizenz, angaben]) if (!istDatei(p)) fehler.push(`fehlt: ${p}`);
  if (!istDatei(appFfmpeg)) fehler.push(`ffmpeg im Paket fehlt: ${appFfmpeg}`);
  if (istDatei(quelle) && istDatei(appFfmpeg) && sha256(quelle) !== sha256(appFfmpeg)) {
    fehler.push('ffmpeg im Paket ist nicht das aus ffmpeg-static; LICENSE und README gehörten dann zu einem anderen Programm.');
  }
  if (istDatei(lizenz)) {
    const erste = zeilen(lizenz)[0];
    const groesse = statSync(lizenz).size;
    const maengel = [];
    if (!erste?.includes(GPL_VOLLTEXT.kopf)) maengel.push(erste ? `erste Zeile „${fuersProtokoll(erste)}“ ohne ${GPL_VOLLTEXT.kopf}` : 'keine Textzeile');
    if (groesse < GPL_VOLLTEXT.mindestBytes) maengel.push(`${groesse} B statt mindestens ${GPL_VOLLTEXT.mindestBytes} B`);
    if (!readFileSync(lizenz, 'utf8').includes(GPL_VOLLTEXT.schluss)) maengel.push(`ohne Schluss ${GPL_VOLLTEXT.schluss}`);
    if (maengel.length) fehler.push(`ffmpeg.LICENSE ist kein GPL-Volltext: ${maengel.join('; ')}.`);
  }
  if (!istDatei(hinweis) || zeilen(hinweis).length === 0) fehler.push(`Quellen-Hinweis fehlt oder ist leer: ${hinweis}`);
  const brief = [...steckbrief(lizenz, 'ffmpeg.LICENSE'), ...steckbrief(angaben, 'ffmpeg.README')];
  if (fehler.length) return { ok: false, fehler, dateien: [], steckbrief: brief };

  const namen = beilagenNamen(art);
  mkdirSync(ziel, { recursive: true });
  copyFileSync(lizenz, join(ziel, namen.lizenz));
  copyFileSync(angaben, join(ziel, namen.angaben));
  copyFileSync(hinweis, join(ziel, namen.quellen));
  return { ok: true, fehler, dateien: [namen.lizenz, namen.angaben, namen.quellen], steckbrief: brief };
}

const AUFRUF = 'Aufruf: node scripts/ci/sammle-ffmpeg-beilagen.mjs --app <app> --art arm64|x64 --release <Ordner> --ffmpeg-static <Ordner> --hinweis <Datei> --ziel <Ordner>';

function hauptprogramm(argv) {
  let w;
  try {
    ({ values: w } = parseArgs({
      args: argv.slice(2),
      options: {
        app: { type: 'string' }, art: { type: 'string' }, release: { type: 'string' },
        'ffmpeg-static': { type: 'string' }, hinweis: { type: 'string' }, ziel: { type: 'string' },
      },
    }));
  } catch (e) {
    console.error(`sammle-ffmpeg-beilagen: ${e.message}`);
    console.error(AUFRUF);
    return 2;
  }
  if (!w.app || !w.art || !w.release || !w['ffmpeg-static'] || !w.hinweis || !w.ziel
    || !Object.hasOwn(APPS, w.app) || !Object.hasOwn(ARTEN, w.art)) {
    console.error(AUFRUF);
    return 2;
  }
  const r = sammleFfmpegBeilagen({
    ffmpegStatic: resolve(w['ffmpeg-static']), appFfmpeg: appPfade(resolve(w.release), w.app, w.art).ffmpeg,
    hinweis: resolve(w.hinweis), ziel: resolve(w.ziel), art: w.art, env: process.env,
  });
  if (!r.ok) {
    for (const f of r.fehler) console.error(`sammle-ffmpeg-beilagen: ${f}`);
    for (const z of r.steckbrief) console.error(`sammle-ffmpeg-beilagen: ${z}`);
    return 1;
  }
  for (const z of r.steckbrief) console.log(`sammle-ffmpeg-beilagen: ${z}`);
  console.log(`sammle-ffmpeg-beilagen: in Ordnung (${r.dateien.join(', ')}).`);
  return 0;
}

/** Hauptprogramm? Beide Seiten über realpath (wie pruefe-mac-nachbau.mjs, EP7). */
function istHauptprogramm(arg) {
  if (!arg) return false;
  try {
    return realpathSync(resolve(arg)) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (istHauptprogramm(process.argv[1])) process.exitCode = hauptprogramm(process.argv);
````

`scripts/ci/ffmpeg-quellen-hinweis.txt` (LF). Das ist der Wortlaut, den der Owner vor dem echten Lauf liest. Er nennt
nur, was belegt ist: ffmpeg-static `package.json` und README Z. 20 und 51-54, `ist-lizenz.md` K6 und Z. 145-147, die
gemessenen ffprobe-Köpfe und die FFmpeg-Fassungen von ffprobe (in den Programmen gelesen: `bin/darwin/x64/ffprobe`
„FFmpeg version 4.0.2“, `bin/darwin/arm64/ffprobe` „FFmpeg version 4.4-tessus“; `require('ffprobe-static').path` wählt
nach `os.arch()`, also landet 4.0.2 im Intel-Paket und 4.4 im Apple-Silicon-Paket).

````text
ffmpeg und ffprobe in den Mac-Paketen dieses Releases
=====================================================

Die Mac-Pakete (DMG) dieses Releases enthalten die Programme ffmpeg und ffprobe
im Programmordner unter Contents/Resources/bin/mac/. Die App startet sie als
eigene Programme.

ffmpeg
------
Herkunft: npm-Paket ffmpeg-static 5.3.0
(https://github.com/eugeneware/ffmpeg-static), Binär-Release b6.1.1
(https://github.com/eugeneware/ffmpeg-static/releases/tag/b6.1.1), FFmpeg 6.1.1.
Laut ffmpeg-static stammt der Build für Intel-Macs (x64) von evermeet.cx und der
für Apple Silicon (arm64) von osxexperts.net.
Lizenz: Es ist ein GPL-Build von FFmpeg (GNU General Public License).
Lizenztext und Build-Angaben, wie ffmpeg-static sie zum Programm liefert, hängen
an diesem Release:
  ffmpeg-mac-x64.LICENSE.txt    ffmpeg-mac-x64.README.txt
  ffmpeg-mac-arm64.LICENSE.txt  ffmpeg-mac-arm64.README.txt

ffprobe
-------
Herkunft: npm-Paket ffprobe-static 3.1.0
(https://github.com/joshwnj/ffprobe-static). Auch ffprobe ist ein GPL-Build von
FFmpeg: im Intel-Paket FFmpeg 4.0.2, im Apple-Silicon-Paket FFmpeg 4.4 (Kennung
4.4-tessus). In beiden Paketen ist es ein Intel-Programm (x86_64); auf Apple
Silicon läuft es über Rosetta 2.

Quelltext
---------
FFmpeg: https://ffmpeg.org/download.html und https://github.com/FFmpeg/FFmpeg
Build-Seiten laut ffmpeg-static: https://evermeet.cx/pub/ffmpeg/ und https://osxexperts.net/
````

- [ ] **Step 4: Grün-Lauf**

Run: `node scripts/ci/test/sammle-ffmpeg-beilagen.test.mjs`
Expected: 25 Zeilen `  ok  …` (B1–B12), letzte Zeile `Alle sammle-ffmpeg-beilagen-Tests bestanden.`, Exit 0. Auf
stderr steht dazu eine Warnung `[MODULE_TYPELESS_PACKAGE_JSON] … paketwahl.js …`; die ist harmlos (siehe „Am Code belegt“).
Dann: `node -e "console.log(require('fs').readdirSync(require('os').tmpdir()).filter(n=>n.startsWith('jm-ffmpeg-beilagen')))"`
→ `[]`.

Gegen echte Lizenztexte gemessen (Funktion direkt, Temp-Ordner): GPLv3 aus `node_modules/ffmpeg-static/LICENSE`
(35 149 B) und `ffmpeg.exe.LICENSE` (35 147 B) sowie GPLv2 `xz/COPYING.GPLv2` aus Git für Windows (17 984 B) →
`ok=true`; LGPLv2.1 `gcc-libs/COPYING.LIB` (26 527 B) → rot nur wegen der ersten Zeile.

- [ ] **Step 5: Gegenproben** (je eine Änderung im Sammler, laufen lassen, zurücknehmen)

Gemessen am 20.10.2026 mit Node 24 an einer Kopie außerhalb des Worktrees (je Mutation ändern, Test, zurückschreiben;
die Kopie war vorher per `cmp` gleich zu den Dateien unten).

| Nr. | Absichtlicher Fehler in `sammle-ffmpeg-beilagen.mjs` | Erwartet rot (FAIL-Zeilen) |
|---|---|---|
| SG1 | `if (istDatei(quelle) && istDatei(appFfmpeg) && sha256(quelle) !== sha256(appFfmpeg)) {` → `if (false) {` | 1: `B5 Gegenprobe` |
| SG2 | in `beilagenNamen` `LICENSE.txt` → `LICENSE.dmg` (eine Beilage passte dann aufs Paketmuster) | 6: `B1`, `B2 Gegenprobe`, `B3: sauber`, `B9: Kommandozeile sauber`, `B11`, `B10: Hinweis im Repo nennt …` |
| SG3 | `if (!erste?.includes(GPL_VOLLTEXT.kopf)) maengel.push(` → `if (false) maengel.push(` | 3: `B8 Gegenprobe: LGPL-Volltext`, `B8 Gegenprobe (R1)`, `B12: Abbruch` |
| SG4 | `    if (env[v]) fehler.push(` → `    if (false) fehler.push(` | 4: `B7` je Variable (3×), `B7 Gegenprobe (Kommandozeile)` |
| SG5 | `if (pkg.version !== BELEGT.ffmpegStatic) fehler.push(` → `if (false) fehler.push(` | 1: `B6 Gegenprobe` |
| SG6 | `if (rel !== BELEGT.binaerRelease) fehler.push(` → `if (false) fehler.push(` | 1: `B6 Gegenprobe` |
| SG7 | `for (const p of [quelle, lizenz, angaben]) if` → `for (const p of [quelle, lizenz]) if` (README nicht verlangt) | 1: `B4 Gegenprobe` |
| SG8 | `if (!istDatei(hinweis) \|\| zeilen(hinweis).length === 0) fehler.push(` → `if (!istDatei(hinweis)) fehler.push(` | 2: `B8 Gegenprobe: Quellen-Hinweis leer`, `… nur Leerzeilen` |
| SG9 | `return realpathSync(resolve(arg)) === realpathSync(fileURLToPath(import.meta.url));` → `return resolve(arg) === fileURLToPath(import.meta.url);` | 1: `B11` |
| SG10 | `if (groesse < GPL_VOLLTEXT.mindestBytes) maengel.push(` → `if (false) maengel.push(` | 2: `B8 Gegenprobe (R2)`, `B8 Gegenprobe (R1)` |
| SG11 | `if (!readFileSync(lizenz, 'utf8').includes(GPL_VOLLTEXT.schluss)) maengel.push(` → `if (false) maengel.push(` | 2: `B8 Gegenprobe: … ohne Schluss`, `B8 Gegenprobe (R1)` |
| SG12 | `zeilen(hinweis).length === 0` → `statSync(hinweis).size === 0` (Stand vor der Nachbesserung) | 1: `B8 Gegenprobe: Quellen-Hinweis nur Leerzeilen` |
| SG13 | Zeile `for (const z of r.steckbrief) console.error(…)` gestrichen (Abbruch ohne Steckbrief) | 1: `B12: Abbruch` |
| SG14 | Zeile `for (const z of r.steckbrief) console.log(…)` gestrichen (Gutfall ohne Steckbrief) | 1: `B9: Kommandozeile sauber` |
| SG15 | `fuersProtokoll` gibt den Text roh zurück (`(z) => z`) | 1: `B12 Gegenprobe` |
| SG16 | `.replaceAll('##[', '#?[')` gestrichen | 1: `B12 Gegenprobe` |
| SG17 | `.replace(/[\u0000-\u001f\u007f-\u009f]/g, '?')` gestrichen | 1: `B12 Gegenprobe` |
| SG18 | `const STECKBRIEF_ZEILEN = 10;` → `20` | 1: `B3: Steckbrief` |
| SG19 | im Fehlertext `„${fuersProtokoll(erste)}“` → `„${erste}“` | 1: `B12 Gegenprobe` |
| EG1 | `copyFileSync(angaben, join(ziel, namen.angaben));` → `copyFileSync(lizenz, …)` | 1: `B3: sauber` |
| EG2 | `copyFileSync(hinweis, join(ziel, namen.quellen));` → `copyFileSync(angaben, …)` | 1: `B3: sauber` |
| EG3 | `UMLENKUNGEN` nur noch `['FFMPEG_BINARIES_URL']` | 3: `B7 … FFMPEG_BIN`, `B7 … FFMPEG_BINARY_RELEASE`, `B7 Gegenprobe (Kommandozeile)` |
| EG4 | Kommandozeile mit `env: {}` statt `env: process.env` | 1: `B7 Gegenprobe (Kommandozeile)` |
| EG5 | erst kopieren (Fehler beim Kopieren geschluckt), dann prüfen | 2: `B4 Gegenprobe`, `B7 Gegenprobe (Kommandozeile)` |
| EG6 | Kommandozeile setzt die Art für die Namen fest auf `'arm64'` | 1: `B9: Kommandozeile sauber` |

Herkunft: SG1–SG3 aus dem Plan (SG3 seit der Nachbesserung auf die Kopfzeile des Volltexts bezogen). SG4–SG9 kamen bei
der Umsetzung dazu; SG9 blieb mit dem Plan-Test grün, darum B11. EG1–EG7 setzte die Prüfung Runde 1; EG1–EG4 blieben
grün (K1, K2) und sind jetzt rot, EG7 ist SG9. SG10–SG19 kamen mit der Nachbesserung (W1, K3).

Danach Step 4 noch einmal: 25 ok, Exit 0. Task 1 bleibt grün: `node scripts/ci/test/pruefe-mac-nachbau.test.mjs` → Exit 0.

**Abweichungen vom ursprünglichen Plan-Code, mit Grund** (die Blöcke oben sind bytegleich mit den Dateien):
1. B3 liest den Zielordner nur, wenn er existiert. Sonst stürzte der Test bei einem Sammler ab, der nichts kopiert, und
   alle späteren Prüfungen liefen nicht (gemessen im Rot-Lauf der Umsetzung).
2. B11 (Aufruf über einen Ordner-Link) ist neu, weil SG9 sonst grün blieb, dieselbe Klasse wie N18 in Task 1.
3. Im Hinweis steht „(GNU General Public License)“ ohne „, Version 3“: `--enable-version3` ist nur für den evermeet-Build
   (x64) belegt, für osxexperts (arm64) nur `--enable-gpl` (`ist-lizenz.md` Z. 158).
4. Nachbesserung Runde 1: GPL-Volltext statt nur der ersten Zeile (Kopf, mindestens 15 000 B, Schluss
   `END OF TERMS AND CONDITIONS`), Steckbrief im Protokoll mit entschärftem Fremdtext (W1); B3 vergleicht alle drei
   Beilagen Byte für Byte (K1); B7 je Variable fest geschrieben und einmal über die Kommandozeile (K2); ein Hinweis nur
   aus Leerzeilen gilt als leer (K3); der Hinweis nennt die FFmpeg-Fassungen von ffprobe, B10 nimmt die Namen aus
   `beilagenNamen` (K5). `angabenKopf` heißt jetzt `steckbrief` und umfasst LICENSE und README.

**Offene Owner-Frage (Prüfung Runde 1, W1), vor dem Probelauf:** F2 (ii) verlangt den GPL-Text, den install.js neben das
Programm legt. Für den Mac ist das nach der Größe kein GPL-Volltext (siehe Review Focus 3), also wird der Sammler im
Probelauf sehr wahrscheinlich abbrechen, fail closed und mit Steckbrief im Protokoll. Ein naheliegender Weg, über den nur
der Owner entscheidet: den GPLv3-Text aus `node_modules/ffmpeg-static/LICENSE` (35 149 B, im npm-Tarball, über die
Integrität im Lockfile gesichert) zusätzlich beilegen und die Mac-`ffmpeg.LICENSE` unter einem Namen mitgeben, der keinen
GPL-Text verspricht; Hinweis und Asset-Namen änderten sich dann. Dieser Branch setzt das nicht um.

- [ ] **Step 6: Zeilenenden** wie in Task 1, Step 6, für die drei neuen Dateien: dreimal `0`.

- [ ] **Step 7: Commit**

```bash
git add scripts/ci/sammle-ffmpeg-beilagen.mjs scripts/ci/ffmpeg-quellen-hinweis.txt scripts/ci/test/sammle-ffmpeg-beilagen.test.mjs
git commit -F - <<'EOF'
feat(ci): ffmpeg-Lizenz, Build-Angaben und Quellen-Hinweis fuer den Mac-Nachbau einsammeln

F2 (ii) der Owner-Freigabe 20.10.2026: GPL-Text und Build-Angaben, die ffmpeg-static neben das
Programm legt, muessen da sein und zum ffmpeg im Paket gehoeren; ffmpeg-static 5.3.0 / b6.1.1 wie im
Hinweis. Asset-Namen enden auf .txt und passen nie auf die Paketwahl (Test gegen paketwahl.js).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
git status --short
```

---

### Task 3: Workflow Mac-Nachbau und statischer Workflow-Test

**Files:**
- Create: `.github/workflows/mac-nachbau.yml`
- Test: `scripts/ci/test/mac-nachbau-workflow.test.mjs`

**Interfaces:**
- Consumes: `APPS` (Task 1); `beilagenNamen` (Task 2). Der Workflow ruft die Kommandozeilen aus Task 1 und 2 aus
  `werkzeug/scripts/ci/` auf.
- Produces:
  - Workflow `Mac-Nachbau` mit den Eingaben `tag` (Pflicht) und `probe` (boolean, Vorgabe true).
  - Artefakte `mac-nachbau-arm64` und `mac-nachbau-x64`: je DMG, `ffmpeg-mac-<art>.LICENSE.txt`,
    `ffmpeg-mac-<art>.README.txt` und `ffmpeg-QUELLEN.txt`, einen Tag lang aufbewahrt.

- [ ] **Step 1: Den Test schreiben** (`scripts/ci/test/mac-nachbau-workflow.test.mjs`, LF)

Die Regeln R1–R17 stehen im Test selbst (`pruefeWorkflow`). Jede hat eine eingebaute Gegenprobe: Die echte Datei wird
an genau einer Stelle verändert, und genau diese Regel muss anschlagen. Findet eine Gegenprobe ihre Stelle nicht, ist
sie rot („Stelle nicht gefunden“), sie bleibt also nie still grün.

````js
// Statischer Test für .github/workflows/mac-nachbau.yml (Mac-Nachbau, Entwurf mac-fassungen Stufe 1): nur Hand-Start,
// Rechte je Job, kein actions/checkout im Bau, Hochlade-Job ohne Code aus dem Repo, Eingaben nur über env, erlaubte Apps
// wie im Prüfer, feste Runner, x64 vor arm64, Beilagen-Namen wie im Sammler. Ohne js-yaml: Der Worktree hat kein
// node_modules, js-yaml liegt nur transitiv im Lockfile (electron-builder, astro), und der Test soll überall ohne npm ci
// laufen. Die Regeln lesen diese eine, von uns geschriebene Datei zeilenweise (Kommentarzeilen zählen nicht, CRLF egal).
// Jede Regel hat eine Gegenprobe: dieselbe Datei mit einem absichtlichen Fehler muss genau diesen Fehler melden.
//   node scripts/ci/test/mac-nachbau-workflow.test.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { APPS } from '../pruefe-mac-nachbau.mjs';
import { beilagenNamen } from '../sammle-ffmpeg-beilagen.mjs';

const hier = dirname(fileURLToPath(import.meta.url));
const original = readFileSync(join(hier, '..', '..', '..', '.github', 'workflows', 'mac-nachbau.yml'), 'utf8').replace(/\r\n/g, '\n');

let failures = 0;
function assert(cond, name) {
  if (cond) console.log(`  ok  ${name}`);
  else {
    failures++;
    console.error(`FAIL  ${name}`);
  }
}

const tiefe = (z) => z.length - z.trimStart().length;
/** Zeilen unter Zeile i, die tiefer eingerückt sind als `ab` (Leerzeilen gehören dazu). */
function unter(zeilen, i, ab = tiefe(zeilen[i])) {
  const aus = [];
  for (let k = i + 1; k < zeilen.length && (zeilen[k].trim() === '' || tiefe(zeilen[k]) > ab); k++) aus.push(zeilen[k]);
  return aus;
}
const werte = (zeilen) => zeilen.map((z) => z.trim()).filter((z) => z !== '');
/** Inhalt aller run:-Schlüssel (Block mit | oder einzeilig). */
function runs(zeilen) {
  const aus = [];
  zeilen.forEach((z, i) => {
    const m = /^(\s*)(- )?run:\s*(.*)$/.exec(z);
    if (!m) return;
    if (m[3] !== '|' && m[3] !== '>') aus.push(m[3]);
    else aus.push(unter(zeilen, i, m[1].length + (m[2] ? 2 : 0)).join('\n'));
  });
  return aus;
}

/** Alle Regelverstöße einer Workflow-Datei. */
function pruefeWorkflow(text) {
  const fehler = [];
  const zeilen = text.replace(/\r\n/g, '\n').split('\n').filter((z) => !/^\s*#/.test(z));
  const oben = (name) => {
    const i = zeilen.indexOf(`${name}:`);
    return i < 0 ? [] : unter(zeilen, i);
  };

  const on = oben('on');
  const ausloeser = werte(on.filter((z) => tiefe(z) === 2));
  if (ausloeser.join() !== 'workflow_dispatch:') fehler.push(`R1 Auslöser: nur workflow_dispatch, gefunden ${ausloeser.join(' ') || 'keiner'}`);
  const eingabe = (name) => {
    const i = on.indexOf(`      ${name}:`);
    return i < 0 ? {} : Object.fromEntries(werte(unter(on, i)).map((z) => z.split(/:\s*/, 2)));
  };
  const eingaben = werte(on.filter((z) => tiefe(z) === 6));
  const tag = eingabe('tag');
  const probe = eingabe('probe');
  if (eingaben.join() !== 'tag:,probe:' || tag.required !== 'true' || tag.type !== 'string' || probe.type !== 'boolean' || probe.default !== 'true') {
    fehler.push('R2 Eingaben: genau tag (Pflicht, string) und probe (boolean, Vorgabe true)');
  }
  if (werte(oben('permissions')).join() !== 'contents: read') fehler.push('R3 oberste Rechte: nur contents: read');
  const apps = werte(oben('env')).find((z) => z.startsWith('ERLAUBTE_APPS:'))?.slice('ERLAUBTE_APPS:'.length).trim().split(/\s+/).sort() ?? [];
  if (apps.join() !== Object.keys(APPS).sort().join()) fehler.push(`R4 ERLAUBTE_APPS (${apps.join(' ')}) weicht von APPS im Prüfer ab (${Object.keys(APPS).join(' ')})`);

  const jobs = {};
  let job = null;
  for (const z of oben('jobs')) {
    const m = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(z);
    if (m) jobs[(job = m[1])] = [];
    else if (job) jobs[job].push(z);
  }
  if (Object.keys(jobs).join() !== 'bau,hochladen') fehler.push(`R5 Jobs: genau bau und hochladen, gefunden ${Object.keys(jobs).join(' ')}`);
  const rechte = (j) => {
    const i = (jobs[j] ?? []).indexOf('    permissions:');
    return i < 0 ? '' : werte(unter(jobs[j], i)).join();
  };
  const bau = jobs.bau ?? [];
  const hoch = jobs.hochladen ?? [];
  const bauText = bau.join('\n');
  const hochRuns = runs(hoch).join('\n');

  if (rechte('bau') !== 'contents: read') fehler.push('R6 bau: Rechte nur contents: read');
  if (/actions\/checkout/.test(bauText)) fehler.push('R7 bau: kein actions/checkout (Quellen per git init/fetch ohne Anmeldedaten)');
  const matrix = [...bauText.matchAll(/- art: (\S+)\n\s+runner: (\S+)/g)].map((m) => `${m[1]}=${m[2]}`).join();
  if (matrix !== 'arm64=macos-26,x64=macos-26-intel' || !bau.includes('    runs-on: ${{ matrix.runner }}') || /-latest/.test(bauText)
    || !bau.includes('      fail-fast: false')) {
    fehler.push(`R8 bau: Runner fest arm64=macos-26 und x64=macos-26-intel, nie -latest, fail-fast aus (gefunden ${matrix || 'keine Matrix'})`);
  }
  const bauRuns = runs(bau).join('\n');
  if (!bauRuns.includes('npx electron-builder --mac dmg "--$ART" --publish never') || !bauRuns.includes('node werkzeug/scripts/ci/pruefe-mac-nachbau.mjs')
    || !bauRuns.includes('node werkzeug/scripts/ci/sammle-ffmpeg-beilagen.mjs')) {
    fehler.push('R9 bau: electron-builder nur für die Job-Art, Prüfer und Sammler aus werkzeug/');
  }
  if ([...runs(zeilen).join('\n').matchAll(/>>\s*(\S+)/g)].some((m) => m[1] !== '"$GITHUB_OUTPUT"')) {
    fehler.push('R10 >> nur nach $GITHUB_OUTPUT (nichts an die Konfiguration aus dem Tag anhängen)');
  }

  if (!hoch.includes('    needs: bau') || !hoch.includes('    if: ${{ inputs.probe == false }}')) fehler.push('R11 hochladen: needs bau und nur bei probe=false');
  if (rechte('hochladen') !== 'contents: write') fehler.push('R12 hochladen: Rechte contents: write');
  const uses = hoch.filter((z) => /^\s*(- )?uses:/.test(z)).map((z) => z.trim().replace(/^- /, ''));
  if (uses.some((u) => u !== 'uses: actions/download-artifact@v4') || uses.length !== 2
    || /\b(npm|npx|node|git)\b|werkzeug|\.\/|\.mjs/.test(hochRuns)) {
    fehler.push('R13 hochladen: kein Code aus dem Repo (nur download-artifact und gh, kein git/npm/node)');
  }
  const uploads = hochRuns.split('\n').filter((z) => z.includes('gh release upload')).map((z) => z.trim());
  const upload = (was) => `gh release upload "$TAG" ${was} --repo "$GITHUB_REPOSITORY" --clobber`;
  if (uploads.join('\n') !== [upload('"${dmg_x64[0]}"'), upload('"${dmg_arm64[0]}"'), upload('"${beilagen[@]}"')].join('\n')) {
    fehler.push('R14 hochladen: erst x64-DMG, dann arm64-DMG, dann Beilagen, je ein gh release upload');
  }
  const namen = ['x64', 'arm64'].flatMap((a) => [beilagenNamen(a).lizenz, beilagenNamen(a).angaben].map((n) => `pakete/${a}/${n}`));
  if (!namen.every((n) => hochRuns.includes(n)) || !hochRuns.includes(`pakete/x64/${beilagenNamen('x64').quellen}`)) {
    fehler.push('R15 hochladen: Beilagen-Namen wie beilagenNamen() im Sammler');
  }
  if (!hochRuns.includes('gh release view') || /gh release (create|edit|delete)/.test(zeilen.join('\n'))) fehler.push('R16 Release muss existieren, nie anlegen');

  const eingabeZeilen = zeilen.filter((z) => z.includes('inputs.'));
  const erlaubt = (z) => /^\s+[A-Z][A-Z0-9_]*: \$\{\{ inputs\.(tag|probe) \}\}$/.test(z) || z === '    if: ${{ inputs.probe == false }}';
  if (!eingabeZeilen.every(erlaubt) || runs(zeilen).some((r) => r.includes('${{'))) fehler.push('R17 Eingaben nur über env, kein ${{ }} in run');
  return fehler;
}

/** Die Datei mit genau einer absichtlichen Änderung; null, wenn die Stelle nicht (genau einmal) vorkommt. */
function mutiere(alt, neu) {
  return original.split(alt).length === 2 ? original.replace(alt, neu) : null;
}
function gegenprobe(regel, alt, neu, name) {
  const text = mutiere(alt, neu);
  const f = text === null ? null : pruefeWorkflow(text);
  assert(f !== null && f.some((x) => x.startsWith(regel)), `${regel} Gegenprobe: ${name}${text === null ? ' (Stelle nicht gefunden)' : ''}`);
}

console.log('mac-nachbau.yml — Regeln:');
{
  const f = pruefeWorkflow(original);
  assert(f.length === 0, `W0: der Workflow hält alle Regeln ein${f.length ? ` (verletzt: ${f.join('; ')})` : ''}`);
  assert(f.length === 0 && pruefeWorkflow(original.replace(/\n/g, '\r\n')).length === 0, 'W0: dieselbe Datei mit CRLF (Windows-Checkout) ebenso');
}
console.log('mac-nachbau.yml — Gegenproben:');
gegenprobe('R1', '  workflow_dispatch:\n', '  push:\n    tags: ["editor-v*"]\n  workflow_dispatch:\n', 'Tag-Push als zweiter Auslöser');
gegenprobe('R2', '        default: true', '        default: false', 'probe mit Vorgabe false');
gegenprobe('R3', 'permissions:\n  contents: read\n\nenv:', 'permissions:\n  contents: write\n\nenv:', 'oberste Rechte write');
gegenprobe('R4', '  ERLAUBTE_APPS: editor', '  ERLAUBTE_APPS: editor titler', 'titler erlaubt, ohne Prüfer-Eintrag');
gegenprobe('R5', '  hochladen:\n', '  nebenbei:\n    runs-on: ubuntu-latest\n  hochladen:\n', 'dritter Job');
gegenprobe('R6','    permissions:\n      contents: read\n    steps:', '    permissions:\n      contents: write\n    steps:', 'bau mit Schreibrecht');
gegenprobe('R7', '      - uses: actions/setup-node@v5', '      - uses: actions/checkout@v5\n      - uses: actions/setup-node@v5', 'actions/checkout im bau');
gegenprobe('R8', '            runner: macos-26-intel', '            runner: macos-latest', 'Intel-Job auf macos-latest');
gegenprobe('R9', 'npx electron-builder --mac dmg "--$ART" --publish never', 'npx electron-builder --mac --publish never', 'electron-builder ohne Zielnamen und Art (baute beide DMGs)');
gegenprobe('R10', '          grep -q \'^npmRebuild: false\'', '          printf \'npmRebuild: false\\n\' >> "$cfg"\n          grep -q \'^npmRebuild: false\'', 'npmRebuild an die Konfiguration anhängen');
gegenprobe('R11', '    if: ${{ inputs.probe == false }}\n', '', 'hochladen auch im Probe-Lauf');
gegenprobe('R12', '    permissions:\n      contents: write', '    permissions:\n      contents: read', 'hochladen ohne Schreibrecht');
gegenprobe('R13', '          set -euo pipefail\n          if ! printf', '          set -euo pipefail\n          node werkzeug/scripts/ci/pruefe-mac-nachbau.mjs\n          if ! printf', 'node im Hochlade-Job');
gegenprobe('R14', 'gh release upload "$TAG" "${dmg_x64[0]}"', 'gh release upload "$TAG" "${dmg_arm64[0]}" "${dmg_x64[0]}"', 'beide DMGs in einem Aufruf, arm64 zuerst');
gegenprobe('R15', 'pakete/arm64/ffmpeg-mac-arm64.README.txt', 'pakete/arm64/ffmpeg-arm64.README.txt', 'Beilage anders benannt als im Sammler');
gegenprobe('R16', '>/dev/null 2>&1; then', '>/dev/null 2>&1 || gh release create "$TAG" --repo "$GITHUB_REPOSITORY"; then', 'Release anlegen, wenn es fehlt');
gegenprobe('R17', '          TAG: ${{ steps.tag.outputs.tag }}\n          REPO:', '          TAG: ${{ steps.tag.outputs.tag }}\n          X: ${{ inputs.tag }}-\n          REPO:', 'Eingabe als Teil eines env-Werts');
gegenprobe('R17', '          node werkzeug/scripts/ci/pruefe-mac-nachbau.mjs', '          echo "${{ inputs.tag }}"\n          node werkzeug/scripts/ci/pruefe-mac-nachbau.mjs', 'Eingabe direkt im run-Skript');

console.log(failures === 0 ? '\nAlle mac-nachbau-Workflow-Tests bestanden.' : `\n${failures} mac-nachbau-Workflow-Test(s) fehlgeschlagen.`);
process.exit(failures === 0 ? 0 : 1);
````

- [ ] **Step 2: Rot-Lauf**

Run: `node scripts/ci/test/mac-nachbau-workflow.test.mjs`
Expected: Exit 1 mit `Error: ENOENT: no such file or directory, open '…\.github\workflows\mac-nachbau.yml'`.

- [ ] **Step 3: Den Workflow anlegen** (`.github/workflows/mac-nachbau.yml`, LF)

````yaml
name: Mac-Nachbau

# Mac-Pakete (arm64 und x64, unsigniert) aus einem BESTEHENDEN Tag nachbauen und an dessen Release hängen (Entwurf
# mac-fassungen, Stufe 1; Owner-Freigabe 20.10.2026, F1–F4). Heute nur der Editor: Der Tag-Lauf von editor-v0.5.0
# scheiterte am doppelten electronVersion/npmRebuild; ein Re-Run oder ein neues Tag nähme wieder den Workflow aus dem
# Tag-Commit. Ein Hand-Start nimmt diesen Workflow vom gestarteten Zweig (main).
#   - nur Hand-Start; probe (Vorgabe true) baut und prüft nur. Hochgeladen wird nur mit probe=false.
#   - ein Bau-Job je Mac-Art auf einem Runner dieser Art: ffmpeg-static lädt ffmpeg nur für die Art des Bau-Rechners.
#   - Bau nur mit Leserecht (fremder Code aus npm ci); Hochladen mit Schreibrecht, ohne Code aus dem Repo, nur gh.
#   - kein neues Release, kein Katalog-Bump (suite.json nennt die Version schon), keine Änderung an der Tag-Konfiguration.
# Bedienung: docs/mac-nachbau.md.
on:
  workflow_dispatch:
    inputs:
      tag:
        description: "Bestehendes Tag, z. B. editor-v0.5.0"
        required: true
        type: string
      probe:
        description: "Nur bauen und prüfen, nichts hochladen"
        required: false
        type: boolean
        default: true

permissions:
  contents: read

env:
  # Apps, deren Tags dieser Workflow nachbauen darf. Stufe 2 erweitert die Liste, zusammen mit APPS im Prüfer
  # (scripts/ci/pruefe-mac-nachbau.mjs); der Selbsttest hält beide gleich.
  ERLAUBTE_APPS: editor

jobs:
  bau:
    name: Bauen und prüfen (${{ matrix.art }})
    strategy:
      # Beide Arten laufen zu Ende, auch wenn eine scheitert: Der Probelauf soll beide Lesestände zeigen.
      fail-fast: false
      matrix:
        include:
          - art: arm64
            runner: macos-26
          - art: x64
            runner: macos-26-intel
    runs-on: ${{ matrix.runner }}
    timeout-minutes: 60
    permissions:
      contents: read
    steps:
      # Eingaben gehen nur über env in Skripte.
      - name: Tag prüfen
        id: tag
        shell: bash
        env:
          TAG: ${{ inputs.tag }}
        run: |
          if ! printf '%s' "$TAG" | grep -Eq '^[a-z][a-z-]*-v[0-9]+\.[0-9]+\.[0-9]+$'; then
            echo "::error::Tag „$TAG“ hat nicht die Form ‹App›-v‹Version› (z. B. editor-v0.5.0)."
            exit 1
          fi
          app="${TAG%-v*}"
          case " $ERLAUBTE_APPS " in
            *" $app "*) ;;
            *) echo "::error::App „$app“ ist für den Nachbau nicht freigegeben (erlaubt: $ERLAUBTE_APPS)."; exit 1 ;;
          esac
          echo "tag=$TAG" >> "$GITHUB_OUTPUT"
          echo "app=$app" >> "$GITHUB_OUTPUT"
          echo "version=${TAG##*-v}" >> "$GITHUB_OUTPUT"

      # Quellen aus dem Tag, Prüfer und Sammler aus dem Commit dieses Workflows, beides OHNE Anmeldedaten. Kein
      # actions/checkout: Alle alten Tags tragen den Gitlink portaudio ohne .gitmodules, daran scheitert es mit
      # persist-credentials: false (connect-mac.yml, Erstlauf 19.10.2026). Gibt es das Tag nicht, scheitert dieser Schritt.
      - name: Quellen aus dem Tag und Prüfer holen (ohne Anmeldedaten)
        shell: bash
        env:
          TAG: ${{ steps.tag.outputs.tag }}
          REPO: ${{ github.repository }}
          WERKZEUG_SHA: ${{ github.sha }}
        run: |
          git init -q .
          git remote add origin "https://github.com/$REPO"
          git -c protocol.version=2 fetch -q --no-tags --depth=1 origin "+refs/tags/$TAG:refs/tags/$TAG"
          git checkout -q --force "refs/tags/$TAG"
          git log -1 --format='Tag-Commit %H' "refs/tags/$TAG"
          git -c protocol.version=2 fetch -q --no-tags --depth=1 origin "$WERKZEUG_SHA"
          mkdir -p werkzeug/scripts/ci
          for f in pruefe-mac-nachbau.mjs sammle-ffmpeg-beilagen.mjs mac-nachbau-lesestand.json ffmpeg-quellen-hinweis.txt; do
            git show "$WERKZEUG_SHA:scripts/ci/$f" > "werkzeug/scripts/ci/$f"
          done
          echo "Prüfer, Sammler, Lesestand und Quellen-Hinweis aus $WERKZEUG_SHA"

      - uses: actions/setup-node@v5
        with:
          node-version: 20

      # ffmpeg-static lädt ffmpeg nach os.arch() (install.js:167). Läuft Node in einer anderen Art als der Job, stimmt
      # das ffmpeg im Paket nicht; der Prüfer fände es, hier fällt es Minuten früher auf.
      - name: Runner-Art prüfen
        shell: bash
        env:
          ART: ${{ matrix.art }}
        run: |
          ist=$(node -p 'process.arch')
          echo "Runner $(uname -m), macOS $(sw_vers -productVersion), Node $(node --version) ($ist)"
          if [ "$ist" != "$ART" ]; then
            echo "::error::Der Job für $ART läuft mit Node für $ist."
            exit 1
          fi

      # Der Artefaktname kommt aus apps/<app>/package.json (artifactName in electron-builder.yml): Version und Tag gleich.
      - name: Version im Tag prüfen
        shell: bash
        env:
          APP: ${{ steps.tag.outputs.app }}
          VERSION: ${{ steps.tag.outputs.version }}
        run: |
          ist=$(node -p "require('./apps/' + process.env.APP + '/package.json').version")
          if [ "$ist" != "$VERSION" ]; then
            echo "::error::apps/$APP/package.json nennt $ist, das Tag $VERSION."
            exit 1
          fi

      - name: Install (workspaces)
        run: npm ci

      - name: Build renderer/main (electron-vite)
        shell: bash
        env:
          APP: ${{ steps.tag.outputs.app }}
        run: npm run build -w "@jm/$APP"

      # Beim Editor: tools/bundle-ffmpeg.mjs kopiert ffmpeg (ffmpeg-static) und ffprobe (ffprobe-static) nach
      # resources/bin/mac; extraResources legt sie nach Contents/Resources/bin/mac.
      - name: Prepackage (ffmpeg und ffprobe bündeln)
        shell: bash
        env:
          APP: ${{ steps.tag.outputs.app }}
        run: npm run prepackage -w "@jm/$APP" --if-present

      # Die Konfiguration aus dem Tag bleibt byte-gleich: Sie muss electronVersion und npmRebuild selbst tragen. Dieser
      # Workflow hängt nichts an (das doppelte Anhängen war der Fehler von editor-v0.5.0).
      - name: Konfiguration aus dem Tag prüfen (nichts anhängen)
        shell: bash
        env:
          APP: ${{ steps.tag.outputs.app }}
        run: |
          cfg="apps/$APP/electron-builder.yml"
          grep -q '^electronVersion:' "$cfg" || { echo "::error::$cfg trägt kein electronVersion; dieser Workflow hängt nichts an."; exit 1; }
          grep -q '^npmRebuild: false' "$cfg" || { echo "::error::$cfg trägt kein npmRebuild: false; dieser Workflow hängt nichts an."; exit 1; }
          git diff --exit-code -- "$cfg"

      # dmg und die Art auf der Kommandozeile: Ohne Zielnamen baute --arm64 beide DMGs, weil die Konfiguration
      # arm64 und x64 nennt.
      - name: Paket bauen (electron-builder, unsigniert, nur diese Art)
        shell: bash
        env:
          APP: ${{ steps.tag.outputs.app }}
          ART: ${{ matrix.art }}
          CSC_IDENTITY_AUTO_DISCOVERY: "false"
        run: |
          cd "apps/$APP"
          npx electron-builder --mac dmg "--$ART" --publish never

      # Scheitert die Prüfung, entsteht kein Artefakt, und hochladen startet nicht.
      - name: Prüfen (ein DMG dieser Art, ffmpeg-Art, Lesestand, Laufzeitprobe, minos)
        shell: bash
        env:
          APP: ${{ steps.tag.outputs.app }}
          VERSION: ${{ steps.tag.outputs.version }}
          ART: ${{ matrix.art }}
          PROBE: ${{ inputs.probe }}
        run: |
          if [ "$PROBE" = "true" ]; then set -- --probe; else set --; fi
          node werkzeug/scripts/ci/pruefe-mac-nachbau.mjs --app "$APP" --version "$VERSION" --art "$ART" \
            --release "apps/$APP/release" --lesestand werkzeug/scripts/ci/mac-nachbau-lesestand.json "$@"

      # F2 (ii): GPL-Text und Build-Angaben, die ffmpeg-static neben das Programm gelegt hat, dazu der Quellen-Hinweis.
      - name: ffmpeg-Lizenz und Build-Angaben einsammeln
        shell: bash
        env:
          APP: ${{ steps.tag.outputs.app }}
          ART: ${{ matrix.art }}
        run: |
          node werkzeug/scripts/ci/sammle-ffmpeg-beilagen.mjs --app "$APP" --art "$ART" --release "apps/$APP/release" \
            --ffmpeg-static node_modules/ffmpeg-static --hinweis werkzeug/scripts/ci/ffmpeg-quellen-hinweis.txt --ziel paket
          cp "apps/$APP/release/"*.dmg paket/
          ls -l paket

      - name: Paket und Beilagen als Artefakt ablegen
        uses: actions/upload-artifact@v4
        with:
          name: mac-nachbau-${{ matrix.art }}
          path: paket/
          if-no-files-found: error
          retention-days: 1

  hochladen:
    name: An das Release hängen (x64 zuerst)
    needs: bau
    if: ${{ inputs.probe == false }}
    runs-on: ubuntu-latest
    timeout-minutes: 15
    permissions:
      contents: write
    steps:
      # Kein Checkout, kein npm, kein node: Dieser Job führt nur gh aus und hat als einziger das Schreibrecht.
      - name: x64-Paket aus dem Bau holen
        uses: actions/download-artifact@v4
        with:
          name: mac-nachbau-x64
          path: pakete/x64

      - name: arm64-Paket aus dem Bau holen
        uses: actions/download-artifact@v4
        with:
          name: mac-nachbau-arm64
          path: pakete/arm64

      # Je Art genau vier Dateien: ein DMG mit der Tag-Version und Art im Namen, LICENSE, README und Quellen-Hinweis.
      # Erst x64, dann arm64, je ein eigener Aufruf: Ein arm64-Mac startet x64 unter Rosetta, ein Intel-Mac arm64 nie.
      # Die Beilagen enden auf .txt und passen nie auf die Paketwahl (.dmg/.exe). --clobber nur für diese Dateien.
      - name: Pakete und Beilagen an das Release hängen
        shell: bash
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAG: ${{ inputs.tag }}
        run: |
          set -euo pipefail
          if ! printf '%s' "$TAG" | grep -Eq '^[a-z][a-z-]*-v[0-9]+\.[0-9]+\.[0-9]+$'; then
            echo "::error::Tag „$TAG“ hat nicht die Form ‹App›-v‹Version›."
            exit 1
          fi
          app="${TAG%-v*}"
          version="${TAG##*-v}"
          case " $ERLAUBTE_APPS " in
            *" $app "*) ;;
            *) echo "::error::App „$app“ ist für den Nachbau nicht freigegeben."; exit 1 ;;
          esac
          shopt -s nullglob
          for art in x64 arm64; do
            dmgs=(pakete/$art/*.dmg)
            alle=(pakete/$art/*)
            if [ ${#dmgs[@]} -ne 1 ] || [ ${#alle[@]} -ne 4 ]; then
              echo "::error::Für $art genau ein DMG und vier Dateien erwartet, gefunden ${#dmgs[@]} DMG und ${#alle[@]} Dateien."
              exit 1
            fi
            case "${dmgs[0]}" in
              *"-$version-mac-$art.dmg") ;;
              *) echo "::error::DMG „${dmgs[0]}“ passt nicht zu Version $version und Art $art."; exit 1 ;;
            esac
          done
          dmg_x64=(pakete/x64/*.dmg)
          dmg_arm64=(pakete/arm64/*.dmg)
          beilagen=(
            pakete/x64/ffmpeg-mac-x64.LICENSE.txt
            pakete/x64/ffmpeg-mac-x64.README.txt
            pakete/arm64/ffmpeg-mac-arm64.LICENSE.txt
            pakete/arm64/ffmpeg-mac-arm64.README.txt
            pakete/x64/ffmpeg-QUELLEN.txt
          )
          for f in "${beilagen[@]}"; do
            if [ ! -s "$f" ]; then echo "::error::Beilage fehlt oder ist leer: $f"; exit 1; fi
          done
          if ! cmp -s pakete/x64/ffmpeg-QUELLEN.txt pakete/arm64/ffmpeg-QUELLEN.txt; then
            echo "::error::Der Quellen-Hinweis der beiden Bau-Jobs ist verschieden."
            exit 1
          fi
          if gh release view "$TAG" --repo "$GITHUB_REPOSITORY" >/dev/null 2>&1; then
            echo "Release $TAG gefunden."
          else
            echo "::error::Zum Tag $TAG gibt es kein Release; dieser Workflow legt keins an."
            exit 1
          fi
          gh release upload "$TAG" "${dmg_x64[0]}" --repo "$GITHUB_REPOSITORY" --clobber
          gh release upload "$TAG" "${dmg_arm64[0]}" --repo "$GITHUB_REPOSITORY" --clobber
          gh release upload "$TAG" "${beilagen[@]}" --repo "$GITHUB_REPOSITORY" --clobber
          echo "Hochgeladen: ${dmg_x64[0]}, ${dmg_arm64[0]}, ${beilagen[*]}"
````

- [ ] **Step 4: Grün-Lauf**

Run: `node scripts/ci/test/mac-nachbau-workflow.test.mjs`
Expected: 20 Zeilen `  ok  …` (W0 2×, R1–R17 mit R17 2×), letzte Zeile `Alle mac-nachbau-Workflow-Tests bestanden.`, Exit 0.

- [ ] **Step 5: Gegenproben** (Regeln im Test aushebeln bzw. die echte Datei verderben; laufen lassen, zurücknehmen)

| Nr. | Absichtlicher Fehler | Erwartet rot |
|---|---|---|
| WG1 | im Test `if (rechte('bau') !== 'contents: read') fehler.push(` → `if (false) fehler.push(` | 1: `R6 Gegenprobe: bau mit Schreibrecht` |
| WG2 | im Test die Bedingung der Regel R17 (`!eingabeZeilen.every(erlaubt) \|\| runs(zeilen).some(…)`) → `false` | 2: beide `R17 Gegenprobe` |
| WG3 | im Workflow, Job `bau`: `contents: read` → `contents: write` | 4: `W0` (2×, „verletzt: R6 bau: Rechte nur contents: read“), `R6 Gegenprobe … (Stelle nicht gefunden)`, `R12 Gegenprobe … (Stelle nicht gefunden)` |

Danach Step 4 noch einmal: 20 ok, Exit 0.

- [ ] **Step 6: Messung der Skripte mit einer gh-Attrappe** (nicht im Repo, weil js-yaml nur zum Messen erlaubt ist)

In Git Bash. `$M` ist ein neuer Ordner im Scratchpad, z. B.
`C:\Users\alexk\AppData\Local\Temp\claude\c--Users-alexk-alexzvn\cfc08999-1618-4a9d-bec9-ffdb8fe15280\scratchpad\mac-fassungen\hochlade-probe`.
Die run-Blöcke werden mit js-yaml aus dem Worktree iveo-paket herausgeschnitten und mit einem gh-Stub ausgeführt:

Die Pfade stehen mit `C:/`, nicht mit `/c/`: In einem `node -e`-Text übersetzt Git Bash keine Pfade, und node läse
`C:\c\Users\…` (gemessen).

```bash
W=C:/Users/alexk/alexzvn/.claude/worktrees/mac-nachbau
M=C:/Users/alexk/AppData/Local/Temp/claude/c--Users-alexk-alexzvn/cfc08999-1618-4a9d-bec9-ffdb8fe15280/scratchpad/mac-fassungen/hochlade-probe
rm -rf "$M" && mkdir -p "$M/bin" && cd "$M"
node -e "
const y=require('C:/Users/alexk/alexzvn/.claude/worktrees/iveo-paket/node_modules/js-yaml');
const w=y.load(require('fs').readFileSync('$W/.github/workflows/mac-nachbau.yml','utf8'));
require('fs').writeFileSync('hochladen.sh', w.jobs.hochladen.steps[2].run);
require('fs').writeFileSync('tag.sh', w.jobs.bau.steps[0].run);
console.log(Object.keys(w.on).join(), JSON.stringify(w.jobs.bau.strategy), w.jobs.bau.steps.length, w.jobs.hochladen.steps.length);"
printf '#!/usr/bin/env bash\necho "gh $*" >> "$GH_LOG"\nif [ "$1 $2" = "release view" ] && [ -n "$KEIN_RELEASE" ]; then exit 1; fi\nexit 0\n' > bin/gh && chmod +x bin/gh
fuellen() { rm -rf pakete; for a in x64 arm64; do mkdir -p pakete/$a; echo d > "pakete/$a/JM Editor-0.5.0-mac-$a.dmg"; echo l > pakete/$a/ffmpeg-mac-$a.LICENSE.txt; echo r > pakete/$a/ffmpeg-mac-$a.README.txt; echo q > pakete/$a/ffmpeg-QUELLEN.txt; done; }
lauf() { : > gh.log; GH_LOG=$PWD/gh.log PATH="$PWD/bin:$PATH" TAG="$1" ERLAUBTE_APPS=editor GITHUB_REPOSITORY=AlexmachtCode/alexzvn bash -eo pipefail hochladen.sh; echo "-> Exit $?"; cat gh.log; }
fuellen; lauf editor-v0.5.0
fuellen; lauf editor-v0.5.1
fuellen; lauf titler-v0.12.1
fuellen; echo x > pakete/arm64/extra.txt; lauf editor-v0.5.0
fuellen; echo anders > pakete/arm64/ffmpeg-QUELLEN.txt; lauf editor-v0.5.0
fuellen; KEIN_RELEASE=1 lauf editor-v0.5.0
fuellen; lauf 'editor-v0.5.0; echo PWNED'
for t in editor-v0.5.0 titler-v0.12.1 'editor-v0.5.0$(id)'; do : > out; GITHUB_OUTPUT=$PWD/out ERLAUBTE_APPS=editor TAG="$t" bash -eo pipefail tag.sh; echo "[$t] Exit $? $(tr '\n' ' ' < out)"; done
```

Expected (gemessen am 20.10.2026):
- erste Zeile (js-yaml): `workflow_dispatch {"fail-fast":false,"matrix":{"include":[{"art":"arm64","runner":"macos-26"},{"art":"x64","runner":"macos-26-intel"}]}} 13 3`
- `editor-v0.5.0`: Exit 0. gh-Protokoll der Reihe nach: `gh release view editor-v0.5.0 …`, dann
  `gh release upload editor-v0.5.0 pakete/x64/JM Editor-0.5.0-mac-x64.dmg … --clobber`, dann dasselbe für arm64, dann ein
  Upload mit den fünf Beilagen.
- `editor-v0.5.1`: `::error::DMG „pakete/x64/JM Editor-0.5.0-mac-x64.dmg“ passt nicht zu Version 0.5.1 und Art x64.`, Exit 1, kein gh-Aufruf.
- `titler-v0.12.1`: `::error::App „titler“ ist für den Nachbau nicht freigegeben.`, Exit 1.
- fünfte Datei: `::error::Für arm64 genau ein DMG und vier Dateien erwartet, gefunden 1 DMG und 5 Dateien.`, Exit 1.
- verschiedene Hinweise: `::error::Der Quellen-Hinweis der beiden Bau-Jobs ist verschieden.`, Exit 1.
- kein Release: `::error::Zum Tag editor-v0.5.0 gibt es kein Release; dieser Workflow legt keins an.`, Exit 1, nur `gh release view`.
- Schadtext: `::error::Tag „editor-v0.5.0; echo PWNED“ hat nicht die Form ‹App›-v‹Version›.`, Exit 1, kein gh-Aufruf.
- Tag-Schritt: `[editor-v0.5.0] Exit 0 tag=editor-v0.5.0 app=editor version=0.5.0`; `titler-v0.12.1` und `editor-v0.5.0$(id)` → Exit 1 mit `::error::`.

- [ ] **Step 7: Zeilenenden** wie in Task 1, Step 6, für die zwei neuen Dateien: zweimal `0`.

- [ ] **Step 8: Commit**

```bash
git add .github/workflows/mac-nachbau.yml scripts/ci/test/mac-nachbau-workflow.test.mjs
git commit -F - <<'EOF'
feat(ci): Workflow Mac-Nachbau (Hand-Start, Bau je Mac-Art, Hochladen nur mit probe=false)

Stufe 1 der Mac-Fassungen, Owner-Freigabe 20.10.2026: editor-v0.5.0 aus dem Tag fuer arm64 (macos-26)
und x64 (macos-26-intel). Bau nur mit Leserecht und ohne Anmeldedaten, Hochladen ohne Code aus dem Repo,
x64 vor arm64, Release muss existieren. Statischer Test haelt die Regeln mit Gegenproben fest.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
git status --short
```

---

### Task 4: CI-Schritt in ci-checks und Doku

**Files:**
- Modify: `.github/workflows/ci-checks.yml` (Job `selftests`, nach dem Schritt „Release-Proxy (Paketwahl, Routing)“, Z. 101-102)
- Create: `docs/mac-nachbau.md`
- Modify: `docs/mac-build-windows-only-apps.md` (Überschrift von Abschnitt 5, Z. 215)

**Interfaces:**
- Consumes: die drei Testdateien aus Task 1 bis 3 (Aufruf je `node <Datei>`, Exit 0 = grün).
- Produces: CI-Schritt „Mac-Nachbau (Prüfer, ffmpeg-Beilagen, Workflow-Regeln)“; Bedienungsdoku.

- [ ] **Step 1: Rot (der Schritt fehlt)**

Run: `grep -c 'scripts/ci/test/' .github/workflows/ci-checks.yml`
Expected: `0`.

- [ ] **Step 2: Den Schritt einfügen** (Edit-Werkzeug; die Datei ist im Checkout CRLF, im Repo LF)

old_string:
```yaml
      - name: Release-Proxy (Paketwahl, Routing)
        run: node --experimental-strip-types services/release-proxy/test/worker.test.mjs
```
new_string:
```yaml
      - name: Release-Proxy (Paketwahl, Routing)
        run: node --experimental-strip-types services/release-proxy/test/worker.test.mjs

      # Mac-Nachbau (Entwurf mac-fassungen, Stufe 1): Prüfer, ffmpeg-Beilagen und Workflow-Regeln. Nur node:-Module,
      # ohne macOS (otool und Programmstart laufen nur im Workflow selbst). Der Beilagen-Test lädt
      # services/release-proxy/paketwahl.js; Node meldet dazu MODULE_TYPELESS_PACKAGE_JSON auf stderr, harmlos.
      - name: Mac-Nachbau (Prüfer, ffmpeg-Beilagen, Workflow-Regeln)
        run: node scripts/ci/test/pruefe-mac-nachbau.test.mjs && node scripts/ci/test/sammle-ffmpeg-beilagen.test.mjs && node scripts/ci/test/mac-nachbau-workflow.test.mjs
```

- [ ] **Step 3: Grün**

Run: `grep -c 'scripts/ci/test/' .github/workflows/ci-checks.yml` → `1` (eine Zeile mit drei Aufrufen).
Run: `node scripts/ci/test/pruefe-mac-nachbau.test.mjs > /dev/null && node scripts/ci/test/sammle-ffmpeg-beilagen.test.mjs > /dev/null && node scripts/ci/test/mac-nachbau-workflow.test.mjs > /dev/null; echo "Exit $?"`
→ `Exit 0`.
Messung (nur Messen, js-yaml aus iveo-paket):
`node -e "const y=require('C:/Users/alexk/alexzvn/.claude/worktrees/iveo-paket/node_modules/js-yaml');const w=y.load(require('fs').readFileSync('.github/workflows/ci-checks.yml','utf8'));const s=w.jobs.selftests.steps.at(-1);console.log(s.name,'|',s.run.split('&&').length)"`
→ `Mac-Nachbau (Prüfer, ffmpeg-Beilagen, Workflow-Regeln) | 3`.
`git diff --stat -- .github/workflows/ci-checks.yml` → `1 file changed, 6 insertions(+)`, also kein Umbruch der ganzen Datei.

- [ ] **Step 4: Gegenprobe (die Kette wird rot)**

Im Workflow `  ERLAUBTE_APPS: editor` → `  ERLAUBTE_APPS: editor titler`, dann die Kette aus Step 3.
Expected (gemessen): `FAIL  W0: der Workflow hält alle Regeln ein (verletzt: R4 ERLAUBTE_APPS (editor titler) weicht von APPS im Prüfer ab (editor))`,
`FAIL  W0: dieselbe Datei mit CRLF …`, `Exit 1`. Danach zurücknehmen; die Kette ist wieder `Exit 0`.

- [ ] **Step 5: Die Doku anlegen** (`docs/mac-nachbau.md`, LF)

````markdown
# Mac-Nachbau aus einem bestehenden Tag

Der Workflow **Mac-Nachbau** (`.github/workflows/mac-nachbau.yml`) baut die Mac-Pakete eines Tools aus einem Tag, das es
schon gibt, und hängt sie an dessen Release. Er legt kein Release an, setzt kein neues Tag und hebt den Katalog nicht an:
`packages/suite-manifest/suite.json` nennt die Version schon, und der Release-Proxy liest die Releases bei jedem Aufruf neu.

Heute ist nur der **Editor** freigegeben (Stufe 1 des Entwurfs mac-fassungen, Owner-Freigabe 20.10.2026). Der Tag-Lauf
von `editor-v0.5.0` war an doppelten Schlüsseln in der Konfiguration gescheitert; ein Re-Run oder ein neues Tag nähme
wieder den Workflow aus dem Tag-Commit. Ein Hand-Start dagegen nimmt den Workflow von `main`.

## Ablauf: drei Läufe, jeder nur mit Owner-OK

1. **Probelauf.** GitHub, Actions, Mac-Nachbau, Run workflow: Zweig `main`, tag `editor-v0.5.0`, probe angehakt
   (Vorgabe). Oder: `gh workflow run mac-nachbau.yml -f tag=editor-v0.5.0 -f probe=true`.
   Der Lauf baut und prüft beide Mac-Arten und lädt nichts hoch. Solange der Lesestand leer ist, endet er grün mit je
   einer Warnung, die die gemessenen SHA-256 von ffmpeg und ffprobe nennt, samt fertigem JSON-Stück.
2. **Lesestand nachtragen.** Die beiden JSON-Stücke (arm64 und x64) zusammen in `scripts/ci/mac-nachbau-lesestand.json`
   eintragen, als eigener Commit auf `main`, mit Owner-OK. Form:
   `{ "editor": { "0.5.0": { "arm64": { "ffmpeg": "…", "ffprobe": "…" }, "x64": { "ffmpeg": "…", "ffprobe": "…" } } } }`.
   Ab jetzt bricht jeder Lauf ab, wenn ffmpeg oder ffprobe abweichen (ffmpeg-static lädt ohne Prüfsumme).
3. **Echter Lauf.** Wie 1, aber probe abgehakt (`-f probe=false`). Erst wenn beide Bau-Jobs grün sind, hängt der Job
   hochladen die Dateien an das bestehende Release.

## Was jeder Bau-Job prüft

- arm64 läuft auf `macos-26`, x64 auf `macos-26-intel`, und Node muss dieselbe Art haben. ffmpeg-static lädt ffmpeg nur
  für die Art des Bau-Rechners; ein Intel-Paket vom arm64-Runner hätte ein arm64-ffmpeg.
- Version in `apps/<app>/package.json` gleich der Tag-Version; die Konfiguration aus dem Tag trägt `electronVersion` und
  `npmRebuild: false` selbst und bleibt unverändert.
- Prüfer `scripts/ci/pruefe-mac-nachbau.mjs`: genau ein DMG (das der Job-Art) und genau eine App; App-Programm und
  ffmpeg in der Job-Art; ffprobe im arm64-Paket als gedruckte Ausnahme x86_64 (ffprobe-static 3.1.0 hat kein
  arm64-Programm, auf Apple Silicon braucht der Import Rosetta 2); SHA-256 gegen den Lesestand; `ffmpeg -version`
  muss starten, im Intel-Job auch `ffprobe -version`; minos von App-Programm und ffmpeg wird gedruckt, über macOS 11
  gibt es eine Warnung.
- Sammler `scripts/ci/sammle-ffmpeg-beilagen.mjs`: GPL-Text und Build-Angaben, die ffmpeg-static neben das Programm
  legt, müssen da sein und zum ffmpeg im Paket gehören; der GPL-Text muss ein Volltext sein; ffmpeg-static muss 5.3.0
  mit Binär-Release b6.1.1 sein, denn dafür ist der Quellen-Hinweis geschrieben. Größe, SHA-256 und Anfang von LICENSE
  und README stehen immer im Protokoll.

## Was am Release landet

Der Reihe nach, je ein eigener Upload: zuerst `JM.Editor-0.5.0-mac-x64.dmg`, dann `JM.Editor-0.5.0-mac-arm64.dmg`
(GitHub macht aus dem Leerzeichen einen Punkt). Ein arm64-Mac kann das x64-Paket unter Rosetta starten, ein Intel-Mac
das arm64-Paket nie. Danach `ffmpeg-mac-x64.LICENSE.txt`, `ffmpeg-mac-x64.README.txt`, `ffmpeg-mac-arm64.LICENSE.txt`,
`ffmpeg-mac-arm64.README.txt` und `ffmpeg-QUELLEN.txt` (Wortlaut: `scripts/ci/ffmpeg-quellen-hinweis.txt`). Die Beilagen
enden auf `.txt` und passen nie auf die Paketwahl von Proxy und Launcher, die nur `.dmg` bzw. `.exe` nimmt. Das DMG
selbst bleibt wie im Tag; GPL-Text und Quellen liegen nicht im Paket (vom Owner bewusst akzeptierte Restlücke, F2).

Hinweise für Nutzer (Quarantäne beim Laden von Hand, Rosetta für ffprobe) kommen als Eintrag in
`packages/suite-manifest/changelog.json`; der Launcher zeigt diese Notes, nicht die von GitHub.

## Fehlerbilder

| Meldung | Bedeutung |
|---|---|
| App „…“ ist für den Nachbau nicht freigegeben | Tag einer App außerhalb von `ERLAUBTE_APPS` |
| Der Job für x64 läuft mit Node für arm64 | Runner-Label zeigt auf die falsche Art |
| genau ein DMG „…“ erwartet | electron-builder hat mehr oder andere Pakete gebaut |
| ffmpeg hat arm64, erwartet x64 | falsches ffmpeg im Paket, der Fehler aus dem Juni |
| Lesestand … ist leer; ohne Lesestand wird nicht hochgeladen | echter Lauf vor dem Lesestand-Commit |
| SHA-256 von ffmpeg weicht vom Lesestand ab | ffmpeg-static hat ein anderes Programm geladen: nicht hochladen, Ursache klären |
| Laufzeitprobe und minos fehlen (nur unter macOS) | echter Lauf, aber der Prüfer lief nicht unter macOS: ohne Laufzeitprobe wird nicht hochgeladen |
| fehlt: …/ffmpeg.LICENSE | install.js hat LICENSE oder README nicht geladen (bei 404 nur eine Warnung) |
| ffmpeg.LICENSE ist kein GPL-Volltext: … | ffmpeg-static hat keinen GPL-Volltext neben das Programm gelegt; Steckbrief im Protokoll lesen, nicht hochladen, Owner fragen |
| Zum Tag … gibt es kein Release | der Workflow legt keins an |

## Eine App aufnehmen (später, Stufe 2)

`ERLAUBTE_APPS` im Workflow und `APPS` im Prüfer gemeinsam erweitern (der Selbsttest hält beide gleich), Lesestand je
Version und Art nachtragen, und für Apps mit NDI oder whisper fehlen die Schritte aus Stufe 2 noch ganz.
````

- [ ] **Step 6: Verweis im alten Runbook** (Edit-Werkzeug, eine Zeile als old_string)

old_string: `## 5. CI (optional, nach lokalem Erfolg)`
new_string:
```markdown
## 5. CI (optional, nach lokalem Erfolg)

> Nachbau eines bestehenden Tags in der CI, je Mac-Art auf eigenem Runner (heute nur der Editor):
> [mac-nachbau.md](mac-nachbau.md).
```
Run: `git diff --stat -- docs/mac-build-windows-only-apps.md` → `1 file changed, 3 insertions(+)`.

- [ ] **Step 7: Commit**

```bash
git add .github/workflows/ci-checks.yml docs/mac-nachbau.md docs/mac-build-windows-only-apps.md
git commit -F - <<'EOF'
ci: Mac-Nachbau-Selbsttests in ci-checks; docs: Bedienung des Mac-Nachbaus

Ein Schritt im Job Selbsttests fuehrt Pruefer-, Beilagen- und Workflow-Test aus (nur node:, ohne macOS).
docs/mac-nachbau.md beschreibt Probelauf, Lesestand mit Owner-OK und echten Lauf.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
git status --short
git ls-files --eol .github/workflows/ci-checks.yml docs/mac-build-windows-only-apps.md docs/mac-nachbau.md .github/workflows/mac-nachbau.yml scripts/ci
```
Expected: In der letzten Ausgabe beginnt jede Zeile mit `i/lf`.

---

## Selbstprüfung

**1. Abdeckung des SOLL**

| SOLL | Task |
|---|---|
| nur workflow_dispatch mit tag (Pflicht) und probe (boolean, Vorgabe true) | 3 (R1, R2) |
| zunächst nur Tags `editor-v<Version>`, Liste erlaubter Apps im Workflow, Eingaben nur über env, oberste Rechte contents: read | 3 (Tag-Schritt, R3, R4, R17) |
| Matrix arm64 auf macos-26, x64 auf macos-26-intel, nicht -latest | 3 (R8) |
| Tag prüfen; Quellen und Prüfer ohne Anmeldedaten; setup-node 20; Versionsprüfung; npm ci; build; prepackage --if-present | 3 (Bau-Schritte 1–8) |
| electronVersion/npmRebuild nicht anhängen, Konfiguration prüfen und abbrechen, falls sie fehlen | 3 (Schritt „Konfiguration aus dem Tag prüfen“, R10) |
| `npx electron-builder --mac dmg --<art> --publish never` im App-Ordner, CSC_IDENTITY_AUTO_DISCOVERY=false | 3 (R9) |
| Prüfer, Beilagen einsammeln, nur DMG und Beilagen als Artefakt, ein Tag aufbewahrt | 1, 2, 3 |
| Hochlade-Job: needs auf den ganzen Bau, nur bei probe=false, contents: write, ohne Checkout, npm und node, nur gh | 3 (R11–R13) |
| Release muss existieren, nie anlegen | 3 (R16, Messung Step 6) |
| genau ein DMG je Art; x64 vor arm64 in zwei Aufrufen; dann die Beilagen | 3 (R14, Messung Step 6) |
| Asset-Namen passen nie auf das Paketmuster (geprüft gegen paketwahl.js und release-wahl.ts) | 2 (B2) |
| Quellen-Hinweis als Datei im Repo, auf Deutsch | 2 (B10) |
| --clobber nur für diese Dateien | 3 (R14 vergleicht die drei Upload-Zeilen genau; der Vier-Dateien-Check je Art) |
| Prüfer: genau ein DMG der Job-Art, genau eine .app, ffmpeg in der Art (auch Fat), ffprobe-Ausnahme gedruckt | 1 (N1, N4–N12) |
| SHA-256-Lesestand je App, Version und Art, anfangs leer; Abweichung bricht ab; leer: im Probe-Lauf Warnung mit Werten, sonst Abbruch | 1 (N13–N15, N18) |
| Laufzeitprobe ffmpeg -version, im Intel-Job auch ffprobe; minos drucken, Warnung über macOS 11; nur unter darwin, ohne darwin bricht der echte Lauf ab | 1 (N16, Attrappe; N4, N18) |
| reine Teile im Selbsttest unter Linux und Windows | 1–3 (alle Tests ohne macOS, CLI-Fälle unter macOS übersprungen) |
| jeder neue Test mit genannter, gemessener Gegenprobe | 1 (G1–G5), 2 (SG1–SG19, EG1–EG6), 3 (WG1–WG3 und R1–R17 eingebaut), 4 (Step 4) |
| optionaler statischer Workflow-Test | 3 |
| CI-Schritt in ci-checks im Job Selbsttests | 4 |
| Doku, begründet | 4 („Warum eine neue Doku-Datei“) |
| nicht: changelog.json, Lesestand-Werte, Stufe 2, suite-release/suite-build/connect-mac | Global Constraints; kein Task fasst sie an |

**2. Schritte:** Jeder Code-Schritt trägt die volle Datei, so wie sie am 20.10.2026 in
`…\scratchpad\mac-fassungen\plan-probe\` gemessen wurde (Rot, Grün und alle Gegenproben dort gelaufen). Jeder Prüfschritt
nennt Befehl und Ausgabe.

**3. Namen:** Task 2 importiert `APPS`, `ARTEN` und `appPfade` aus Task 1, Task 3 importiert `APPS` und `beilagenNamen`.
Der Workflow ruft `--app/--version/--art/--release/--lesestand/--probe` (Prüfer) und
`--app/--art/--release/--ffmpeg-static/--hinweis/--ziel` (Sammler) so auf, wie die Kommandozeilen sie lesen. Die
Artefaktnamen `mac-nachbau-<art>` stimmen zwischen Upload und Download, die Beilagen-Namen im Hochlade-Skript prüft R15
gegen `beilagenNamen`.

**4. Review Focus:** fünf Zeilen, jede mit Test oder Messung bzw. ausdrücklich als Probelauf-Messung oder Restlücke benannt.

**5. Umfang:** Der Plan trägt den vollen Code, weil der Auftrag das verlangt. Der Text daneben beschränkt sich auf
Entscheidungen, Belege und Prüfausgaben.

## Nach der Umsetzung (nur Controller und Owner)

Das hier ist beschreibend. Der Umsetzer führt nichts davon aus.

1. **Gesamtprüfung des Branches** (Controller): Review gegen diesen Plan und den Entwurf. Dabei liest der Owner den
   Wortlaut von `scripts/ci/ffmpeg-quellen-hinweis.txt` und `docs/mac-nachbau.md`.
2. **PR** (Controller, mit Owner-OK zum Push): `ci/mac-nachbau` → `main`. ci-checks muss grün sein, auch der neue
   Schritt im Job Selbsttests. Den Workflow `Mac-Nachbau` gibt es erst nach dem Merge auf main zum Starten.
3. **Merge** auf main durch den Owner.
4. **Probelauf** mit Owner-OK: Actions, Mac-Nachbau, Run workflow auf `main`, tag `editor-v0.5.0`, probe angehakt. Erwartet:
   - Beide Bau-Jobs sind grün, `hochladen` ist übersprungen.
   - „Runner-Art prüfen“ zeigt `arm64` bzw. `x64`. Startet der Intel-Job nicht, weil es das Label nicht gibt, wird der
     Lauf abgebrochen und mit dem Owner entschieden.
   - Der Prüfer druckt die Ausnahme ffprobe (nur arm64), die Laufzeitprobe (`ffmpeg version 6.1.1 …`, im Intel-Job auch
     ffprobe) und minos von App-Programm und ffmpeg. Jede Warnung über macOS 11 geht vor dem echten Lauf an den Owner.
   - Je Job eine Warnung „Lesestand für editor 0.5.0 <art> ist leer“ mit den SHA-256.
   - **Gegenprobe der Messung:** ffprobe muss im arm64-Job `5b592e56f87ff754d94dadf99f38b4d0fb7d463eb780b50e0ca061d668d0e3f7`
     sein und im x64-Job `90fddf93d25a520bbda09e02f1f53a91f04acd1ef9b79e6dc602dc4dc6951f67` (lokal gemessen, gleiche
     Lock-Integrität). Weicht ein Wert ab, wird nicht nachgetragen; erst die Ursache klären.
   - Der Sammler druckt Größe, SHA-256 und Anfang von LICENSE und README. Der Controller vergleicht die Build-Angaben
     mit dem Quellen-Hinweis (evermeet.cx für x64, osxexperts.net für arm64). Widerspricht er, kommt erst eine Korrektur
     des Hinweises mit Owner-OK.
   - Wahrscheinlich bricht der Sammler in beiden Jobs mit „ffmpeg.LICENSE ist kein GPL-Volltext: …“ ab (Review Focus 3).
     Dann tragen die Lesestand-Warnungen des Prüfers trotzdem die SHA-256, weil der Prüfer vorher läuft; der Steckbrief
     geht mit der offenen Owner-Frage aus Task 2 (W1) an den Owner, vor jedem weiteren Schritt.
   - Scheitert ein Job (npm ci, fehlende LICENSE): nicht weiter, Befund an den Owner.
5. **Lesestand-Commit** mit Owner-OK: Beide JSON-Stücke aus den Warnungen kommen zusammen nach
   `scripts/ci/mac-nachbau-lesestand.json`, als eigener Commit auf main (per PR wie üblich).
   Selbsttest bleibt grün. Danach optional ein zweiter Probelauf: Er muss ohne Lesestand-Warnung grün enden.
6. **changelog.json-Hinweis** (eigener Commit ohne Bump, Wortlaut mit Owner-Freigabe, vor oder mit dem echten Lauf):
   Quarantäne beim Laden von Hand (Rechtsklick, Öffnen bzw. `xattr -dr com.apple.quarantine`) und Rosetta 2 für den
   Medien-Import auf Apple Silicon (ffprobe). Der Launcher zeigt diese Notes (`apps/launcher/src/main/changelog.ts:8-11`).
7. **Echter Lauf** mit Owner-OK: wie Schritt 4, probe abgehakt. Erwartet: beide Bau-Jobs grün, `hochladen` grün. Am
   Release `editor-v0.5.0` hängen dann:
   - die Windows-exe (unverändert)
   - `JM.Editor-0.5.0-mac-x64.dmg` und `JM.Editor-0.5.0-mac-arm64.dmg`, x64 zuerst hochgeladen
   - die vier Beilagen und `ffmpeg-QUELLEN.txt`

   Nichts wurde angelegt, kein Katalog-Bump.
8. **Nachkontrolle:** Der Proxy liefert für Mac arm64 und x64 die Version 0.5.0 mit dem passenden DMG (Trockenlauf
   `services/release-proxy/tools/trockenlauf.mjs` mit Owner-OK). Auf einem Mac mit einem Editor, den der Launcher
   installiert hat, steht „Update auf 0.5.0“ an. Sobald ein Mac zur Hand ist, folgt die Nachabnahme nach F3: Start,
   Import, Export.
9. **Erinnerung:** Ein erneuter echter Lauf überschreibt die Dateien mit `--clobber`. ffmpeg und ffprobe hält der
   Lesestand fest, das DMG selbst nicht. Also nur mit Owner-OK neu laufen lassen.
