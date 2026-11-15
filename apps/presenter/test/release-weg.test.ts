// #303: Bündelkette des NDI-Ausgangs (nur Windows). npm run selftest -w @jm/presenter
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}
const require = createRequire(import.meta.url);
const pfad = (rel: string): string => fileURLToPath(new URL(rel, import.meta.url));
// CRLF → LF: unter Windows (autocrlf) liegen die Dateien mit \r\n im Arbeitsverzeichnis.
const lies = (rel: string): string => readFileSync(pfad(rel), 'utf8').replace(/\r\n/g, '\n');
const alleTs = (rel: string): string[] => {
  const aus: string[] = [];
  const geh = (d: string): void => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) geh(p);
      else if (/\.tsx?$/.test(n)) aus.push(p);
    }
  };
  geh(pfad(rel));
  return aus;
};

const pkg = JSON.parse(lies('../package.json'));
ck('@jm/ndi ist Abhängigkeit', pkg.dependencies['@jm/ndi'] === '*');
ck('prepackage bündelt NDI', pkg.scripts.prepackage === 'node tools/bundle-ndi.mjs');
for (const s of ['dist', 'dist:dir', 'dist:win', 'dist:mac']) {
  ck(`${s} ruft prepackage`, pkg.scripts[s].startsWith('electron-vite build && npm run prepackage && electron-builder'));
}
const eb = lies('../electron-builder.yml');
ck('npmRebuild aus', /^npmRebuild: false$/m.test(eb));
ck('electronVersion = Workspace-Electron', eb.includes(`\nelectronVersion: ${require('electron/package.json').version}\n`));
ck('resources/bin nie im Repo', lies('../.gitignore').split(/\r?\n/).includes('resources/bin'));
// Mac baut und startet ohne NDI: kein Wert-Import von @jm/ndi außer im Utility-Einstieg
const code = /from\s+['"]@jm\/ndi['"]|import\(\s*['"]@jm\/ndi['"]\s*\)|require\(\s*['"]@jm\/ndi['"]\s*\)/;
const treffer = alleTs('../src/').filter((f) =>
  readFileSync(f, 'utf8').split(/\r?\n/).some((z) => code.test(z) && !/^\s*(import type |\/\/|\*)/.test(z)));
ck('@jm/ndi nur in src/utility/ndi-sender.ts geladen', treffer.length === 1 && treffer[0].endsWith(join('utility', 'ndi-sender.ts')));

// Lizenztext der Drittbibliotheken in der NDI-Laufzeit (NDI-SDK-Lizenz Abschnitt 3, Connect-Spec LP4): liegt im
// Windows-Paket neben der DLL. Vorbild apps/connect/tools/bundle-ndi.mjs.
const bundle = lies('../tools/bundle-ndi.mjs');
ck('bundle-ndi legt den Lizenztext neben die DLL', bundle.includes("name: 'Processing.NDI.Lib.Licenses.txt'")
  && bundle.includes("join(sdk, 'Bin', 'x64', 'Processing.NDI.Lib.Licenses.txt')"));
// Echter Lauf gegen einen SDK-Ordner mit DLL, aber ohne Lizenztext. Windows: Abbruch, der den Lizenztext nennt, bevor
// etwas nach resources/bin/win kopiert ist. Sonst (Mac-CI): übersprungen wie bisher, ebenfalls ohne Kopie.
const binWin = pfad('../resources/bin/win');
const binStand = (): string => (existsSync(binWin)
  ? readdirSync(binWin).sort().map((n) => { const s = statSync(join(binWin, n)); return `${n}:${s.size}:${s.mtimeMs}`; }).join('|')
  : 'fehlt');
const sdkAttrappe = mkdtempSync(join(tmpdir(), 'jm-presenter-ndi-sdk-'));
try {
  mkdirSync(join(sdkAttrappe, 'Bin', 'x64'), { recursive: true });
  writeFileSync(join(sdkAttrappe, 'Bin', 'x64', 'Processing.NDI.Lib.x64.dll'), 'Attrappe');
  const vorher = binStand();
  const lauf = spawnSync(process.execPath, [pfad('../tools/bundle-ndi.mjs')], {
    env: { ...process.env, NDI_SDK_DIR: sdkAttrappe },
    encoding: 'utf8',
  });
  const ausgabe = `${lauf.stdout ?? ''}${lauf.stderr ?? ''}`;
  if (process.platform === 'win32') {
    ck('bundle-ndi ohne Lizenztext: Abbruch mit Hinweis, nichts kopiert',
      lauf.status !== 0 && ausgabe.includes('Processing.NDI.Lib.Licenses.txt') && binStand() === vorher);
  } else {
    ck('bundle-ndi außerhalb Windows: übersprungen wie bisher, nichts kopiert', lauf.status === 0
      && ausgabe.includes('[bundle-ndi] Nur Windows: Mac-Presenter ohne NDI (#303) – übersprungen.') && binStand() === vorher);
  }
} finally {
  rmSync(sdkAttrappe, { recursive: true, force: true });
}

// Release-Weg ab 0.13.0: Windows mit NDI baut der Owner lokal, die CI nur das Mac-Paket.
const wf = lies('../../../.github/workflows/suite-release.yml');
ck('plan: Presenter nur macOS', wf.includes(`presenter-v*) echo 'os=["macos-latest"]' >> "$GITHUB_OUTPUT" ;;`));
ck('plan: sonst macOS + Windows', wf.includes(`*) echo 'os=["macos-latest","windows-latest"]' >> "$GITHUB_OUTPUT" ;;`));
ck('release: Liste aus plan', wf.includes('needs: plan') && wf.includes('os: ${{ fromJSON(needs.plan.outputs.os) }}'));
const releaseIf = wf.split('\n').find((z) => z.includes("!startsWith(github.ref_name, 'ndi-screen-capture-v')"))!;
ck('Presenter nicht vom Release-Job ausgeschlossen (Mac baut weiter)', !releaseIf.includes("'presenter-v'"));
ck('kein Katalog-Bump für den Presenter', wf.includes("if: ${{ needs.release.result == 'success' && !startsWith(github.ref_name, 'presenter-v') }}"));

console.log(`\n${pass} ok, ${fail} FAIL`);
if (fail) process.exit(1);
