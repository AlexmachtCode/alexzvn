#!/usr/bin/env node
// Entscheidungslogik der Zoom-Slots in C++, ohne SDK (Spec 11.1, E27, B86): uebersetzt jede Testdatei aus
// TESTDATEIEN mit dem ersten gefundenen C++-Compiler zu einem eigenen Programm und startet es. Kein CMake, kein
// Zoom- oder NDI-Header, keine Bibliothek - darum laeuft es auch in der CI unter Linux (Job selftests, nach
// `npm ci --ignore-scripts`).
//
//   npm run logik-test -w @jm/zoom-bridge
//
// Compiler in dieser Reihenfolge (GEP13): g++ (-std=c++17 -Wall -Werror), clang++ (dieselben Schalter), unter
// Windows cl (/nologo /std:c++17 /W4 /WX /EHsc /utf-8) in der Umgebung von VsDevCmd.bat, gefunden ueber
// vswhere.exe (Muster scripts/make-implib.mjs:27-65; cl liegt sonst nur in der Developer-Shell im PATH).
// LOGIK_TEST_COMPILER=g++|clang++|cl|keiner erzwingt die Wahl (der Selbsttest prueft damit Rueckgabe 2).
//
// Ausgabe nach os.tmpdir()/jm-logik-test-<pid>/, nie ins Repo; danach geloescht. Programme mit vollem Pfad
// gestartet (NoDefaultCurrentDirectoryInExePath). Eine Zeile je Programm; bei Rot davor die Ausgabe des Compilers
// bzw. die FEHLER-Zeilen des Programms. Rueckgabe 0 = alles gruen, 1 = Uebersetzen oder Pruefung gescheitert,
// 2 = kein Compiler gefunden (nie still gruen). Rot ist auch ein Programm, das trotz gefallener Pruefungen 0
// zurueckgibt, und eines, das die Zeitgrenze von 60 s ueberschreitet (es haelt den CI-Schritt sonst bis zur
// Jobgrenze fest; Nachbesserung a2, NB-a2-2).
import { execFileSync, execSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const paket = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Je Datei ein Programm mit main(). Der Selbsttest prueft, dass jede native/*_test.cpp hier steht. */
const TESTDATEIEN = ['native/slot_logic_test.cpp', 'native/audio_mix_test.cpp', 'native/delay_line_test.cpp'];

const GNU_SCHALTER = ['-std=c++17', '-Wall', '-Werror'];
const CL_SCHALTER = ['/nologo', '/std:c++17', '/W4', '/WX', '/EHsc', '/utf-8'];
const WAHLEN = ['g++', 'clang++', 'cl', 'keiner'];
const KEIN_COMPILER = 'logik-test: kein C++-Compiler gefunden (g++, clang++, cl über vswhere).';
/** Zeitgrenze je Pruefprogramm (sie laufen in Millisekunden; die Grenze faengt nur ein haengendes). */
const ZEITGRENZE_MS = 60_000;

const wahl = process.env.LOGIK_TEST_COMPILER ?? '';
if (wahl !== '' && !WAHLEN.includes(wahl)) {
  console.error(`logik-test: LOGIK_TEST_COMPILER muss g++, clang++, cl oder keiner sein (ist: ${wahl}).`);
  process.exit(2);
}

/** Ob `programm --version` im PATH laeuft. */
function vorhanden(programm) {
  const r = spawnSync(programm, ['--version'], { stdio: 'ignore' });
  return !r.error && r.status === 0;
}

/** Umgebung der Developer-Shell samt vollem Pfad von cl.exe, sonst null (kein Windows, kein Visual Studio). */
function msvc() {
  if (process.platform !== 'win32') return null;
  const vswhere = join(
    process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)',
    'Microsoft Visual Studio',
    'Installer',
    'vswhere.exe',
  );
  if (!existsSync(vswhere)) return null;
  let vsRoot = '';
  try {
    vsRoot = execFileSync(vswhere, [
      '-latest', '-products', '*',
      '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64',
      '-property', 'installationPath',
    ]).toString().trim();
  } catch {
    return null;
  }
  const vsDevCmd = join(vsRoot, 'Common7', 'Tools', 'VsDevCmd.bat');
  if (!vsRoot || !existsSync(vsDevCmd)) return null;
  let text = '';
  try {
    // execSync statt execFileSync('cmd.exe', ...): Node maskiert dort die inneren Anfuehrungszeichen im
    // MSVC-Stil, den cmd.exe nicht versteht (gemessen, scripts/make-implib.mjs:44-46).
    text = execSync(`call "${vsDevCmd}" -arch=x64 -host_arch=x64 >nul 2>&1 && set`, {
      stdio: ['ignore', 'pipe', 'pipe'],
    }).toString();
  } catch {
    return null;
  }
  const env = {};
  for (const zeile of text.split(/\r?\n/)) {
    const i = zeile.indexOf('=');
    if (i > 0) env[zeile.slice(0, i)] = zeile.slice(i + 1);
  }
  const pfad = Object.keys(env).find((k) => k.toUpperCase() === 'PATH');
  const cl = (pfad ? env[pfad].split(delimiter) : []).map((d) => join(d, 'cl.exe')).find((p) => existsSync(p));
  return cl ? { name: 'cl', programm: cl, env } : null;
}

function waehle() {
  if (wahl === 'keiner') return null;
  for (const name of ['g++', 'clang++']) {
    if ((wahl === '' || wahl === name) && vorhanden(name)) return { name, programm: name, env: process.env };
  }
  if (wahl === '' || wahl === 'cl') return msvc();
  return null;
}

const compiler = waehle();
if (!compiler) {
  console.error(KEIN_COMPILER);
  process.exit(2);
}

const schalter = compiler.name === 'cl' ? CL_SCHALTER : GNU_SCHALTER;
console.log(`logik-test: Compiler ${compiler.name} (${schalter.join(' ')})`);
const aus = join(tmpdir(), `jm-logik-test-${process.pid}`);
mkdirSync(aus, { recursive: true });
let rot = 0;
try {
  for (const datei of TESTDATEIEN) {
    const name = datei.split('/').pop();
    const quelle = join(paket, ...datei.split('/'));
    const programm = join(aus, name.replace(/\.cpp$/, process.platform === 'win32' ? '.exe' : ''));
    const argumente = compiler.name === 'cl'
      ? [...schalter, `/Fe${programm}`, quelle]
      : [...schalter, '-o', programm, quelle];
    const bau = spawnSync(compiler.programm, argumente, { cwd: aus, env: compiler.env, encoding: 'utf8' });
    if (bau.error || bau.status !== 0) {
      process.stdout.write(`${bau.stdout ?? ''}${bau.stderr ?? ''}`);
      console.log(`logik-test: ${name}: Übersetzen gescheitert (Rückgabe ${bau.status ?? bau.error?.message}).`);
      rot++;
      continue;
    }
    const lauf = spawnSync(programm, [], { cwd: aus, encoding: 'utf8', timeout: ZEITGRENZE_MS });
    const ausgabe = `${lauf.stdout ?? ''}${lauf.stderr ?? ''}`;
    if (lauf.error?.code === 'ETIMEDOUT') {
      process.stdout.write(ausgabe);
      console.log(`logik-test: ${name}: nach ${ZEITGRENZE_MS / 1000} s abgebrochen (Zeitgrenze).`);
      rot++;
      continue;
    }
    const summe = /(\d+) Pruefungen, (\d+) gefallen\./.exec(ausgabe);
    // Rot auch, wenn das Programm trotz gefallener Pruefungen 0 zurueckgibt: die Summenzeile zaehlt mit.
    if (lauf.error || lauf.status !== 0 || !summe || summe[2] !== '0') {
      process.stdout.write(ausgabe);
      rot++;
    }
    console.log(`logik-test: ${name}: ${summe ? summe[0] : 'keine Summenzeile'} (Rückgabe ${lauf.status ?? lauf.error?.message})`);
  }
} finally {
  rmSync(aus, { recursive: true, force: true });
}
process.exit(rot === 0 ? 0 : 1);
