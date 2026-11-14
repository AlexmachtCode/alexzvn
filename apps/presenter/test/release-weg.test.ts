// #303: Bündelkette des NDI-Ausgangs (nur Windows). npm run selftest -w @jm/presenter
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
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

console.log(`\n${pass} ok, ${fail} FAIL`);
if (fail) process.exit(1);
