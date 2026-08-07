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
import { existsSync, mkdirSync, statSync } from 'node:fs';
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

// Idempotent: ist der Header neuer als die IDL, ist nichts zu tun.
const header = join(genDir, 'DeckLinkAPI.h');
const iid = join(genDir, 'DeckLinkAPI_i.c');
if (existsSync(header) && existsSync(iid) && statSync(header).mtimeMs >= statSync(idl).mtimeMs) {
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
console.log('[@jm/decklink] Header erzeugt.');
