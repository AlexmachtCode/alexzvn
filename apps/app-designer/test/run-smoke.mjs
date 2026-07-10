// Treiber der Browser-Tests: baut aus jeder Vorlage ein echtes Export-Bundle und
// spielt es in Chromium durch.
//
//   node test/run-smoke.mjs         alle vier Spieltypen von file://
//   node test/run-smoke.mjs --csp   zusätzlich der Sandbox-Beweis unter Prod-CSP
//
// Ein Electron-Prozess pro Fall: zwei Fenster mit umgeschalteter CSP in einem
// Prozess scheiterten reproduzierbar am zweiten Laden.

import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(here, '..');
const repoRoot = resolve(appDir, '..', '..');
const outRoot = join(appDir, '.smoke');

const TEMPLATES = ['wheel', 'quiz', 'memory', 'dragdrop'];
const withCsp = process.argv.includes('--csp');

/**
 * Electron erbt `ELECTRON_RUN_AS_NODE` aus der Umgebung und startet dann als
 * reines Node — `app` wäre undefined. Die Variable muss für die Kindprozesse weg.
 */
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

function run(cmd, args, label) {
  const r = spawnSync(cmd, args, { cwd: appDir, env, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) {
    console.error(`\n✗ ${label} fehlgeschlagen (exit ${r.status})`);
    process.exit(1);
  }
}

rmSync(outRoot, { recursive: true, force: true });
mkdirSync(outRoot, { recursive: true });

// `--import` verlangt eine file://-URL; ein Windows-Pfad wie C:\… wird als
// Protokoll „c:" gelesen und abgelehnt.
const register = pathToFileURL(join(repoRoot, 'packages', 'appkit', 'test', 'register.mjs')).href;

for (const t of TEMPLATES) {
  const dir = join(outRoot, t);
  run(
    'node',
    ['--experimental-strip-types', '--import', register, 'test/make-bundle.ts', `resources/templates/${t}.json`, dir],
    `Bundle ${t}`,
  );
  run('npx', ['electron', 'test/smoke.cjs', dir, t], `Smoke ${t}`);
}

if (withCsp) {
  const dir = join(outRoot, 'wheel');
  run('npx', ['electron', 'test/csp.cjs', dir, 'none'], 'CSP frame-src none');
  run('npx', ['electron', 'test/csp.cjs', dir, 'jmapp'], 'CSP frame-src jmapp:');
}

console.log(`\nAlle Browser-Tests bestanden (${TEMPLATES.length} Spieltypen${withCsp ? ' + CSP-Beweis' : ''}).\n`);
