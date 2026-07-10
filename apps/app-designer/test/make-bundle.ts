// Baut ein echtes Export-Bundle aus einer Vorlage — für den Smoke-Test.
//
//   node --experimental-strip-types --import ../../packages/appkit/test/register.mjs \
//        test/make-bundle.ts <vorlage.json> <zielordner>
//
// Nutzt bewusst dieselbe buildIndexHtml(), die auch der Designer benutzt: der Test
// prüft das Artefakt, das Kunden bekommen, nicht eine Nachbildung davon.

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildIndexHtml, migrateProject } from '@jm/appkit';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..', '..');

const [templateArg, outArg, ...rest] = process.argv.slice(2);
if (!templateArg || !outArg) {
  console.error('usage: make-bundle.ts <vorlage.json> <zielordner> [--idle=<ms>]');
  process.exit(1);
}

/** Der Attract-Reset steht in den Vorlagen auf 60 s — zum Testen kürzen. */
const idleArg = rest.find((a) => a.startsWith('--idle='));

const runtimeSrc = join(repoRoot, 'packages', 'appkit', 'dist', 'runtime.js');
const doc = migrateProject(JSON.parse(readFileSync(templateArg, 'utf8')));
if (idleArg) doc.idleResetMs = Number(idleArg.slice('--idle='.length));

mkdirSync(outArg, { recursive: true });
writeFileSync(join(outArg, 'index.html'), buildIndexHtml({ doc }), 'utf8');
copyFileSync(runtimeSrc, join(outArg, 'runtime.js'));

console.log(`Bundle: ${outArg}${idleArg ? ` (idleResetMs=${doc.idleResetMs})` : ''}`);
