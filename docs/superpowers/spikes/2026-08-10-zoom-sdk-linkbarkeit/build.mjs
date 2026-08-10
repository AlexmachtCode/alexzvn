#!/usr/bin/env node
// Erzeugt die Import-Bibliothek fuer das Zoom-Meeting-SDK aus `sdk.dll` und uebersetzt
// die beiden Sondierlaeufe.
//
// WARUM ES DAS GIBT: Zooms C#-Wrapper-Paket bringt den vollstaendigen nativen C++-Kopfsatz
// mit (inklusive `h/rawdata/`), aber KEINE `sdk.lib`. Statt ein weiteres SDK-Paket zu laden,
// wird die Import-Bibliothek hier aus den Exporten der DLL selbst gebaut — das geht, weil
// `sdk.dll` unverzierte C-Namen exportiert und keine gemangelten C++-Symbole.
//
//   node docs/superpowers/spikes/2026-08-10-zoom-sdk-linkbarkeit/build.mjs
//
// Voraussetzung: ZOOM_SDK_DIR zeigt auf das entpackte Wrapper-Paket, also auf den Ordner,
// der `x64/bin/sdk.dll` und `x64/zoom_sdk_c_sharp_wrap/h/zoom_sdk.h` enthaelt.
import { execFileSync, execSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'build');

const sdk = process.env.ZOOM_SDK_DIR;
if (!sdk) {
  console.log('[zoom-spike] ZOOM_SDK_DIR nicht gesetzt — uebersprungen.');
  process.exit(0);
}
if (process.platform !== 'win32') {
  console.log('[zoom-spike] Nur Windows — uebersprungen.');
  process.exit(0);
}

const dll = join(sdk, 'x64', 'bin', 'sdk.dll');
const headers = join(sdk, 'x64', 'zoom_sdk_c_sharp_wrap', 'h');
for (const [what, p] of [
  ['sdk.dll', dll],
  ['Kopfdateien', headers],
]) {
  if (!existsSync(p)) {
    console.error(`[zoom-spike] ${what} nicht gefunden: ${p}`);
    process.exit(1);
  }
}

// --- MSVC finden -----------------------------------------------------------
const vswhere = join(
  process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)',
  'Microsoft Visual Studio',
  'Installer',
  'vswhere.exe',
);
if (!existsSync(vswhere)) {
  console.error('[zoom-spike] vswhere.exe nicht gefunden — Visual Studio Build Tools noetig.');
  process.exit(1);
}
const vsRoot = execFileSync(vswhere, [
  '-latest',
  '-products',
  '*',
  '-requires',
  'Microsoft.VisualStudio.Component.VC.Tools.x86.x64',
  '-property',
  'installationPath',
])
  .toString()
  .trim();
const vsDevCmd = join(vsRoot, 'Common7', 'Tools', 'VsDevCmd.bat');

mkdirSync(out, { recursive: true });

// --- Exporte auslesen und .def schreiben ------------------------------------
// dumpbin und lib laufen nur mit gesetzter MSVC-Umgebung, deshalb ueber VsDevCmd.
// execSync statt execFileSync('cmd.exe', ['/c', …]): Node maskiert dort die inneren
// Anfuehrungszeichen im MSVC-Stil (\"), den cmd.exe nicht versteht — der Aufruf scheitert
// dann still mit leerem stdout UND leerem stderr. execSync uebergibt die Zeile unveraendert.
//
// Die Shell ist hier NICHT vermeidbar: `call VsDevCmd.bat && …` ist genau der Mechanismus,
// mit dem die MSVC-Umgebung an dumpbin/lib/cl vererbt wird — ohne Shell keine Verkettung und
// keine geerbten Variablen. Eingesetzt werden nur zwei Werte: ZOOM_SDK_DIR aus der Umgebung
// des Entwicklers und der von vswhere gemeldete VS-Pfad. Kein Wert stammt aus einer fremden
// Quelle. Wer ZOOM_SDK_DIR setzt, darf auf diesem Rechner ohnehin Befehle ausfuehren.
const run = (line) => {
  try {
    return execSync(`call "${vsDevCmd}" -arch=x64 -host_arch=x64 >nul 2>&1 && ${line}`, {
      cwd: out,
      stdio: ['ignore', 'pipe', 'pipe'],
    }).toString();
  } catch (err) {
    // Ohne diese Aufbereitung wirft Node die Ausgabe als rohen Byte-Puffer aus — eine
    // Compiler-Fehlermeldung als Zahlenkolonne ist keine Fehlermeldung.
    const say = (b) => (b ? b.toString().trim() : '');
    console.error(`\n[zoom-spike] Befehl fehlgeschlagen:\n  ${line}\n`);
    const o = say(err.stdout);
    const e = say(err.stderr);
    if (o) console.error(o);
    if (e) console.error(e);
    if (!o && !e) console.error('(keine Ausgabe — meist eine falsch maskierte Befehlszeile)');
    process.exit(1);
  }
};

const exportsText = run(`dumpbin /nologo /exports "${dll}"`);
// Zeilenform: "   ordinal   hint   RVA   Name". [NONAME]-Eintraege haben keinen Namen
// und fallen durch das Muster — genau richtig, sie sind nicht bindbar.
const names = [...exportsText.matchAll(/^\s+\d+\s+[0-9A-Fa-f]+\s+[0-9A-Fa-f]{8}\s+(\S+)\s*$/gm)].map(
  (m) => m[1],
);
if (names.length === 0) {
  console.error('[zoom-spike] Keine Exportnamen erkannt — Ausgabeformat von dumpbin geaendert?');
  process.exit(1);
}
writeFileSync(join(out, 'sdk.def'), `LIBRARY sdk\r\nEXPORTS\r\n${names.map((n) => `    ${n}`).join('\r\n')}\r\n`);
console.log(`[zoom-spike] ${names.length} Exporte -> sdk.def`);

run('lib /nologo /def:sdk.def /machine:x64 /out:sdk.lib');
console.log('[zoom-spike] sdk.lib erzeugt');

for (const src of ['01-bindbarkeit.cpp', '02-initsdk.cpp', '03-auth.cpp']) {
  const exe = src.replace(/\.cpp$/, '.exe');
  // user32.lib: 03-auth.cpp braucht PeekMessage/TranslateMessage/DispatchMessage — die
  // Anmeldung antwortet asynchron und ohne Nachrichtenschleife kommt der Rueckruf nie an.
  run(
    `cl /nologo /EHsc /std:c++17 /I "${headers}" "${join(here, src)}" /link sdk.lib user32.lib /out:${exe}`,
  );
  console.log(`[zoom-spike] ${exe} uebersetzt`);
}

console.log(`\nFertig. Zum Laufen muss ${join(sdk, 'x64', 'bin')} im PATH stehen.`);
