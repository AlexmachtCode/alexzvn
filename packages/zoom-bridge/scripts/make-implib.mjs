#!/usr/bin/env node
// Erzeugt sdk.lib aus sdk.dll. Das Zoom-Paket bringt KEINE Import-Bibliothek mit;
// sie ist aber ableitbar, weil sdk.dll unverzierte C-Namen exportiert und keine
// gemangelten C++-Symbole (im Stage-0-Spike gemessen: 23 Exporte).
//
// sdk.lib kommt NICHT ins Repo: sie ist an die DLL-Fassung gebunden, und eine
// mitcommittete Lib liefe bei einem SDK-Wechsel still daneben.
import { execFileSync, execSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = join(here, '..');

const sdk = process.env.ZOOM_SDK_DIR;
if (!sdk) {
  console.error('[@jm/zoom-bridge] ZOOM_SDK_DIR ist nicht gesetzt.');
  process.exit(1);
}
const dll = join(sdk, 'x64', 'bin', 'sdk.dll');
if (!existsSync(dll)) {
  console.error(`[@jm/zoom-bridge] sdk.dll nicht gefunden: ${dll}`);
  process.exit(1);
}

const vswhere = join(
  process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)',
  'Microsoft Visual Studio',
  'Installer',
  'vswhere.exe',
);
if (!existsSync(vswhere)) {
  console.error('[@jm/zoom-bridge] vswhere.exe nicht gefunden - Visual Studio Build Tools noetig.');
  process.exit(1);
}
const vsRoot = execFileSync(vswhere, [
  '-latest', '-products', '*',
  '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64',
  '-property', 'installationPath',
]).toString().trim();
const vsDevCmd = join(vsRoot, 'Common7', 'Tools', 'VsDevCmd.bat');

// execSync statt execFileSync('cmd.exe', ['/c', …]): Node maskiert dort die inneren
// Anfuehrungszeichen im MSVC-Stil (\"), den cmd.exe nicht versteht - der Aufruf
// scheitert dann still mit leerem stdout UND leerem stderr.
const run = (line) => {
  try {
    return execSync(`call "${vsDevCmd}" -arch=x64 -host_arch=x64 >nul 2>&1 && ${line}`, {
      cwd: pkg,
      stdio: ['ignore', 'pipe', 'pipe'],
    }).toString();
  } catch (err) {
    // Ohne diese Aufbereitung wirft Node die Ausgabe als rohen Byte-Puffer aus -
    // eine Fehlermeldung als Zahlenkolonne ist keine Fehlermeldung.
    const say = (b) => (b ? b.toString().trim() : '');
    console.error(`\n[@jm/zoom-bridge] Befehl fehlgeschlagen:\n  ${line}\n`);
    const o = say(err.stdout);
    const e = say(err.stderr);
    if (o) console.error(o);
    if (e) console.error(e);
    if (!o && !e) console.error('(keine Ausgabe - meist eine falsch maskierte Befehlszeile)');
    process.exit(1);
  }
};

const exportsText = run(`dumpbin /nologo /exports "${dll}"`);
// Zeilenform: "   ordinal   hint   RVA   Name". [NONAME]-Eintraege haben keinen
// Namen, fallen durch das Muster und sind auch nicht bindbar - genau richtig.
const names = [...exportsText.matchAll(/^\s+\d+\s+[0-9A-Fa-f]+\s+[0-9A-Fa-f]{8}\s+(\S+)\s*$/gm)].map((m) => m[1]);
if (names.length === 0) {
  console.error('[@jm/zoom-bridge] Keine Exportnamen erkannt - Ausgabeformat von dumpbin geaendert?');
  process.exit(1);
}

// names.length > 0 beweist nicht, dass ALLE Zeilen erkannt wurden - aendert sich
// das dumpbin-Ausgabeformat nur fuer einen Teil der Zeilen, kommen z.B. 10 statt
// 23 Namen heraus, kein Fehler hier, aber sdk.lib waere still verkuerzt. Das
// fiele erst viel spaeter als "unresolved external symbol" beim Binden auf und
// saehe dann wie ein Fehler im C++-Code aus, nicht wie einer im Werkzeug. Diese
// fuenf Kernsymbole braucht das Paket nachweislich (CMakeLists.txt/native/*.cpp
// binden dagegen); sie sind im Stage-0-Spike gemessen worden.
const CORE_SYMBOLS = ['InitSDK', 'CleanUPSDK', 'GetSDKVersion', 'CreateAuthService', 'CreateMeetingService'];
const missingCore = CORE_SYMBOLS.filter((s) => !names.includes(s));
if (missingCore.length > 0) {
  console.error(`[@jm/zoom-bridge] Kernsymbole fehlen in den dumpbin-Exporten: ${missingCore.join(', ')} (von ${names.length} erkannten Namen insgesamt). Ausgabeformat von dumpbin geaendert?`);
  process.exit(1);
}

// Die Fassung 7.1.5.43953 exportiert 23 namentlich bindbare Symbole (gemessen im
// Stage-0-Spike, docs/superpowers/spikes/2026-08-10-zoom-sdk-linkbarkeit/README.md).
// Eine neue SDK-Fassung darf mehr oder weniger exportieren - das ist kein
// Abbruchgrund, nur ein Hinweis, damit ein stiller Teilverlust trotzdem auffaellt.
const EXPECTED_EXPORT_COUNT = 23;
if (names.length !== EXPECTED_EXPORT_COUNT) {
  console.warn(`[@jm/zoom-bridge] WARNUNG: ${names.length} Exportnamen erkannt, erwartet waren ${EXPECTED_EXPORT_COUNT} (Fassung 7.1.5.43953). Neue SDK-Fassung?`);
}

writeFileSync(join(pkg, 'sdk.def'), `LIBRARY sdk\r\nEXPORTS\r\n${names.map((n) => `    ${n}`).join('\r\n')}\r\n`);
run('lib /nologo /def:sdk.def /machine:x64 /out:sdk.lib');
console.log(`[@jm/zoom-bridge] ${names.length} Exporte -> sdk.lib`);
