#!/usr/bin/env node
// Baut das Einsatzpaket der Zoom-Bridge (README Abschnitt "Einsatzpaket").
//
//   npm run release:build    -w @jm/zoom-bridge   -> release\JM-Zoom-Bridge-<v>-win-x64.zip (OEFFENTLICH)
//   npm run release:komplett -w @jm/zoom-bridge   -> zusaetzlich ...-KOMPLETT-NICHT-VEROEFFENTLICHEN.zip
//
// ZWEI PAKETE, UND WARUM: das Repo ist oeffentlich, und die Weitergabe-Lizenz
// der Zoom-SDK-DLLs ist ungeklaert (Owner-Entscheidung 01.10.2026). Das
// oeffentliche Paket enthaelt darum KEINE einzige Datei aus <Zoom-SDK>\x64\bin
// - der WAECHTER unten bricht den Bau ab, wenn doch. Das Komplett-Paket
// enthaelt sie und wird NIE veroeffentlicht (der Name sagt es, und es liegt
// wie alles hier unter release\, das git ignoriert - und dort in einem
// EIGENEN Unterordner NICHT-VEROEFFENTLICHEN\, damit ein Hochladen per
// release\*.zip nur das oeffentliche ZIP trifft).
//
// Inhalt (beide Pakete, Komplett zusaetzlich mit den SDK-Dateien in bin\):
//   Zoom-Bridge starten.cmd   Doppelklick -> start.ps1 in eigenem Fenster (reines ASCII)
//   start.ps1                 fragt ab, startet zoom-join.exe (UTF-8 MIT BOM, CRLF)
//   zoom-join.exe             die Steuerung als Node "Single Executable Application"
//   LIESMICH.txt              fuer den Operator (UTF-8 MIT BOM, CRLF)
//   bin\zoom-bridge.exe       FRISCH gebaut - siehe Pruefung unten
//   bin\Processing.NDI.Lib.x64.dll   die NDI-Laufzeit (liefert die Suite schon
//                                    in ihren oeffentlichen Installern mit)
//   bin\msvcp140.dll, vcruntime140*.dll, ...   die Visual-C++-Laufzeit, app-lokal
//                                    (siehe "VC-Laufzeit" unten)
//   LIZENZEN\Processing.NDI.Lib.Licenses.txt
//   LIZENZEN\Node.js-LICENSE.txt     zoom-join.exe IST eine node.exe
//
// Die Quellen der Textdateien liegen in paket\, NICHT in release\: die
// Wurzel-.gitignore ignoriert jeden Ordner namens "release".
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
// Gemeinsam mit JM Connect (tools/bundle-zoom-bridge.mjs, tools/after-pack.cjs):
// EINE Namensliste, EINE VC-Suche, EINE Frische-Pruefung (Spec Stage 4, 5.1).
import {
  VC_PFLICHT,
  bridgeExeFrisch,
  dateienUnter,
  findeVcLaufzeit,
  linkerFassung,
  mindestens,
  sdkNamen,
  verboteneZoomDateien,
} from './auslieferung.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = join(here, '..');
const komplett = process.argv.includes('--komplett');

const version = JSON.parse(readFileSync(join(pkg, 'package.json'), 'utf8')).version;
const name = `JM-Zoom-Bridge-${version}`;
const releaseDir = join(pkg, 'release');
const bau = join(releaseDir, '.bau');
const oeffentlich = join(releaseDir, name);
const komplettBasis = join(releaseDir, '.komplett');
const komplettOrdner = join(komplettBasis, name);
const zipOeffentlich = join(releaseDir, `${name}-win-x64.zip`);
// NICHT neben dem oeffentlichen ZIP: ein `gh release upload ... release/*.zip`
// haette sonst die Zoom-DLLs veroeffentlicht (Sichtung 01.10.2026).
const privatDir = join(releaseDir, 'NICHT-VEROEFFENTLICHEN');
const zipKomplettName = `${name}-win-x64-KOMPLETT-NICHT-VEROEFFENTLICHEN.zip`;
const zipKomplett = join(privatDir, zipKomplettName);

// postject: der Wert, den Nodes SEA-Dokumentation fuer die Sicherung nennt.
const SEA_FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';
const POSTJECT = 'postject@1.0.0-alpha.6';

function abbruch(msg) {
  console.error(`\n[release] ABBRUCH: ${msg}`);
  process.exit(1);
}
const schritt = (msg) => console.log(`[release] ${msg}`);

/** Startet ein Programm; bricht mit seiner Ausgabe ab, wenn es scheitert. */
function lauf(exe, args, opts = {}) {
  const r = spawnSync(exe, args, { encoding: 'utf8', ...opts });
  if (r.error) abbruch(`${exe} liess sich nicht starten: ${r.error.message}`);
  if (r.status !== 0) {
    abbruch(`${exe} ${args.join(' ')}\n  Rueckgabewert ${r.status}\n${r.stdout ?? ''}${r.stderr ?? ''}`);
  }
  return r;
}

/**
 * Textdatei ins Paket schreiben: Zeilenenden CRLF, wahlweise mit BOM. Die
 * Quellen werden von git je nach core.autocrlf mit LF oder CRLF ausgecheckt -
 * normalisiert wird darum HIER, nicht im Repo.
 */
function textdatei(quelle, ziel, { bom, nurAscii = false }) {
  let t = readFileSync(quelle, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
  if (nurAscii && /[^\x00-\x7F]/.test(t)) abbruch(`${quelle} muss reines ASCII sein (cmd.exe liest in der OEM-Codepage).`);
  writeFileSync(ziel, (bom ? '\uFEFF' : '') + t, 'utf8');
}

// --- 1. Vorbedingungen ---------------------------------------------------------
if (process.platform !== 'win32') abbruch('das Einsatzpaket wird nur unter Windows gebaut.');

const sdkDir = process.env.ZOOM_SDK_DIR;
const sdkBin = sdkDir ? join(sdkDir, 'x64', 'bin') : null;
if (komplett) {
  if (!sdkBin || !existsSync(join(sdkBin, 'sdk.dll'))) {
    abbruch('release:komplett braucht ZOOM_SDK_DIR mit x64\\bin\\sdk.dll darin.');
  }
  if (!existsSync(join(sdkDir, 'OSS-LICENSE.pdf'))) abbruch(`OSS-LICENSE.pdf fehlt in ${sdkDir}`);
}

// zoom-bridge.exe muss AUS DEM AKTUELLEN STAND gebaut sein. Ein Paket mit einer
// alten .exe saehe aus wie der neue Stand und waere es nicht - eine Abnahme
// im Projekt maesse dann etwas anderes als das, was im Repo steht.
// Pruefung und Texte stehen in auslieferung.mjs (bridgeExeFrisch) - JM Connect
// prueft beim Packen genau dasselbe.
const frisch = bridgeExeFrisch(pkg);
if (!frisch.ok) abbruch(frisch.text);
const bridgeExe = frisch.exe;

// Die NDI-Laufzeit samt Lizenztext DANEBEN - nur ein Ordner, der beides hat.
const ndiKandidaten = [
  process.env.NDI_RUNTIME_DIR_V6,
  'C:\\Program Files\\NDI\\NDI 6 Runtime\\v6',
  process.env.NDI_SDK_DIR && join(process.env.NDI_SDK_DIR, 'Bin', 'x64'),
  'C:\\Program Files\\NDI\\NDI 6 SDK\\Bin\\x64',
].filter(Boolean);
const ndiDir = ndiKandidaten.find(
  (d) => existsSync(join(d, 'Processing.NDI.Lib.x64.dll')) && existsSync(join(d, 'Processing.NDI.Lib.Licenses.txt')),
);
if (!ndiDir) abbruch(`NDI-Laufzeit mit Lizenztext nicht gefunden. Gesucht in:\n  ${ndiKandidaten.join('\n  ')}`);

// VC-LAUFZEIT, app-lokal (Sichtung 01.10.2026, Schwere hoch). zoom-bridge.exe
// ist mit /MD gebaut und importiert MSVCP140/VCRUNTIME140/VCRUNTIME140_1 -
// und, wichtiger: sdk.dll und fast alle uebrigen Zoom-DLLs tun es auch
// (gemessen: 79 von 119 Dateien in x64\bin + Bridge brauchen msvcp140.dll;
// dazu einmal msvcp140_codecvt_ids.dll). Das Zoom-SDK liefert sie fuer x64
// NICHT mit. Ohne installierte VC-Laufzeit stirbt die Bridge darum mit
// 0xC0000135, ohne eine Zeile - und das sah aus wie ein Anmeldefehler.
// Statisch linken (/MT) allein hilft nicht, weil die Zoom-DLLs sie trotzdem
// brauchen. Also: die Redist-Dateien des Toolsets NEBEN zoom-bridge.exe
// legen. Der Windows-Lader sucht zuerst im Ordner der .exe - auch fuer die
// Abhaengigkeiten von sdk.dll -, und eine aeltere msvcp140.dll im System
// (< 14.40 stuerzt mit neu gebautem Code in mutex::lock ab) wird so nicht
// gezogen. Microsoft gibt diese Dateien als "Distributable Code" frei
// (VC\Redist\MSVC\...\Microsoft.VC14x.CRT).
//
// Die Redist-Fassung muss MINDESTENS die Fassung des Linkers sein, der
// zoom-bridge.exe gebaut hat (die STL ist nur rueckwaerts kompatibel).
// VC_PFLICHT und findeVcLaufzeit stehen in auslieferung.mjs (gemeinsam mit JM Connect).
let linker;
try {
  linker = linkerFassung(bridgeExe);
} catch (e) {
  abbruch(e.message);
}
const vc = findeVcLaufzeit(pkg);
const vcLaufzeit = vc.brauchbar[0];
if (!vcLaufzeit) {
  abbruch(
    `Visual-C++-Laufzeit (Microsoft.VC14x.CRT mit ${VC_PFLICHT.join(', ')}) nicht gefunden.\n` +
      `  Gesucht in:\n  ${vc.kandidaten.join('\n  ') || '(keine Visual-Studio-Installation gefunden)'}\n` +
      '  Mit VC_CRT_DIR auf den Ordner ...\\VC\\Redist\\MSVC\\<Fassung>\\x64\\Microsoft.VC14x.CRT zeigen.',
  );
}
if (!mindestens(vcLaufzeit.fassung, linker)) {
  abbruch(
    `Die Visual-C++-Laufzeit ${vcLaufzeit.fassung.join('.')} (${vcLaufzeit.dir}) ist AELTER als der Linker ${linker.join('.')}, ` +
      'der zoom-bridge.exe gebaut hat - die Bridge koennte damit abstuerzen. Die Redist-Dateien desselben Toolsets nehmen (VC_CRT_DIR).',
  );
}
const vcDateien = readdirSync(vcLaufzeit.dir).filter((f) => /\.dll$/i.test(f));

// zoom-join.exe IST eine node.exe (Single Executable Application) - Node
// wird damit weitergegeben, samt V8, OpenSSL, ICU, libuv. Deren Lizenzen
// verlangen den Lizenztext bei der Binaerweitergabe. Er liegt im Repo, an die
// Node-FASSUNG gebunden: baut eine andere Node, fehlt die Datei, und der Bau
// bricht ab, statt einen falschen Text beizulegen. (C:\Program Files\nodejs
// enthaelt KEINE LICENSE - gemessen.)
const nodeLizenz = join(pkg, 'paket', 'LIZENZEN', `Node.js-${process.version}-LICENSE.txt`);
if (!existsSync(nodeLizenz) || !readFileSync(nodeLizenz, 'utf8').startsWith('Node.js is licensed for use as follows')) {
  abbruch(
    `Lizenztext fuer Node ${process.version} fehlt: ${nodeLizenz}\n` +
      `  Die Datei LICENSE vom Tag ${process.version} (https://github.com/nodejs/node) dort ablegen - zoom-join.exe enthaelt genau diese Node-Fassung.`,
  );
}

// --- 2. Die Start-EXE ------------------------------------------------------------
rmSync(bau, { recursive: true, force: true });
mkdirSync(bau, { recursive: true });

schritt('buendle cli\\zoom-join.mjs (esbuild) …');
let esbuild;
try {
  esbuild = await import('esbuild');
} catch {
  abbruch('esbuild nicht gefunden - im Repo-Wurzelverzeichnis `npm install` ausfuehren.');
}
const buendel = join(bau, 'zoom-join.cjs');
await esbuild.build({
  entryPoints: [join(pkg, 'cli', 'zoom-join.mjs')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  outfile: buendel,
  logLevel: 'warning',
  // import.meta gibt es in CommonJS nicht - esbuild setzte {} ein, und
  // src/bridge.ts ruft beim LADEN fileURLToPath(import.meta.url) (binPath()).
  // Das waere ein Absturz vor der ersten Zeile. __filename ist in einer
  // Single Executable Application die EXE selbst (gemessen, Node 24.16).
  define: {
    'import.meta.url': '__jm_import_meta_url',
    __JM_ZOOM_BRIDGE_VERSION__: JSON.stringify(version),
  },
  banner: { js: "const __jm_import_meta_url = require('node:url').pathToFileURL(__filename).href;" },
});

schritt('setze die Single Executable Application zusammen …');
const seaConfig = join(bau, 'sea-config.json');
const blob = join(bau, 'sea-prep.blob');
// RELATIVE Pfade, aufgeloest gegen cwd = .bau: Node schreibt den Pfad von
// "main" in den Blob - mit absolutem Pfad stand im oeffentlichen ZIP
// "C:\Users\<name>\...\release\.bau\zoom-join.cjs" (Sichtung 01.10.2026).
// Der Waechter unten prueft das am fertigen Paket.
writeFileSync(
  seaConfig,
  JSON.stringify({ main: 'zoom-join.cjs', output: 'sea-prep.blob', disableExperimentalSEAWarning: true, useSnapshot: false, useCodeCache: false }),
);
lauf(process.execPath, ['--experimental-sea-config', 'sea-config.json'], { cwd: bau });
if (!existsSync(blob)) abbruch(`${blob} fehlt nach --experimental-sea-config.`);
const startExe = join(bau, 'zoom-join.exe');
copyFileSync(process.execPath, startExe);

// Die Signatur von node.exe entfernen, wie es Nodes SEA-Anleitung verlangt -
// nach dem Einsetzen des Blobs waere sie ohnehin ungueltig. Ohne signtool
// geht es auch (postject warnt dann "signature seems corrupted").
const kits = 'C:\\Program Files (x86)\\Windows Kits\\10\\bin';
const signtool = existsSync(kits)
  ? readdirSync(kits)
      .filter((d) => /^10\./.test(d))
      .sort()
      .reverse()
      .map((d) => join(kits, d, 'x64', 'signtool.exe'))
      .find((p) => existsSync(p))
  : undefined;
if (signtool) lauf(signtool, ['remove', '/s', startExe]);
else schritt('signtool nicht gefunden - die Signatur von node.exe bleibt (ungueltig) stehen.');

// npx ist eine .cmd - die startet Node nur ueber die Shell. Darum EINE
// fertige Befehlszeile mit selbst gesetzten Anfuehrungszeichen (Pfade mit
// Leerzeichen); eine Argumentliste mit shell:true verbindet Node bloss mit
// Leerzeichen und warnt davor (DEP0190).
const q = (a) => `"${a}"`;
lauf(['npx', '--yes', POSTJECT, q(startExe), 'NODE_SEA_BLOB', q(blob), '--sentinel-fuse', SEA_FUSE].join(' '), [], { shell: true });

// Lebenszeichen: die EXE muss starten, ihre Fassung nennen und - hier ohne
// bin\ daneben - mit Rueckgabe 1 und der Meldung zu zoom-bridge.exe enden.
const env = { ...process.env };
delete env.ZOOM_SDK_DIR;
const probe = spawnSync(startExe, [], { encoding: 'utf8', env, timeout: 30_000 });
if (probe.status !== 1 || !probe.stdout.includes(`JM Zoom Bridge ${version}`) || !probe.stderr.includes('zoom-bridge.exe fehlt')) {
  abbruch(`die Start-EXE verhaelt sich nicht wie erwartet (Rueckgabe ${probe.status}):\n${probe.stdout}${probe.stderr}`);
}
schritt(`zoom-join.exe startet: "${probe.stdout.trim().split('\n')[0]}"`);

// --- 3. Oeffentliches Paket zusammensetzen ---------------------------------------
schritt(`setze ${name} zusammen …`);
rmSync(oeffentlich, { recursive: true, force: true });
mkdirSync(join(oeffentlich, 'bin'), { recursive: true });
mkdirSync(join(oeffentlich, 'LIZENZEN'), { recursive: true });
const paket = join(pkg, 'paket');
textdatei(join(paket, 'Zoom-Bridge starten.cmd'), join(oeffentlich, 'Zoom-Bridge starten.cmd'), { bom: false, nurAscii: true });
textdatei(join(paket, 'start.ps1'), join(oeffentlich, 'start.ps1'), { bom: true });
textdatei(join(paket, 'LIESMICH.txt'), join(oeffentlich, 'LIESMICH.txt'), { bom: true });
copyFileSync(startExe, join(oeffentlich, 'zoom-join.exe'));
copyFileSync(bridgeExe, join(oeffentlich, 'bin', 'zoom-bridge.exe'));
copyFileSync(join(ndiDir, 'Processing.NDI.Lib.x64.dll'), join(oeffentlich, 'bin', 'Processing.NDI.Lib.x64.dll'));
copyFileSync(join(ndiDir, 'Processing.NDI.Lib.Licenses.txt'), join(oeffentlich, 'LIZENZEN', 'Processing.NDI.Lib.Licenses.txt'));
for (const f of vcDateien) copyFileSync(join(vcLaufzeit.dir, f), join(oeffentlich, 'bin', f));
textdatei(nodeLizenz, join(oeffentlich, 'LIZENZEN', 'Node.js-LICENSE.txt'), { bom: true });
schritt(`VC-Laufzeit ${vcLaufzeit.fassung.join('.')} (Linker der Bridge: ${linker.join('.')}) aus ${vcLaufzeit.dir}: ${vcDateien.join(', ')}`);
const eigeneBin = dateienUnter(join(oeffentlich, 'bin')).length;

// --- 4. DER WAECHTER -------------------------------------------------------------
// Keine Datei im oeffentlichen Paket darf so heissen wie eine Datei im
// Zoom-SDK x64\bin. Gegen die ECHTE Liste, wenn ZOOM_SDK_DIR gesetzt ist -
// sonst gegen die feste Liste oben. Verglichen ohne Gross-/Kleinschreibung,
// weil Windows-Dateinamen sie nicht unterscheiden.
// Liste und Vergleich stehen in auslieferung.mjs - derselbe Waechter prueft den
// Installer von JM Connect (tools/bundle-zoom-bridge.mjs, tools/after-pack.cjs).
const echteListe = sdkBin && existsSync(sdkBin);
const verbotenNamen = sdkNamen({ sdkBin });
const oeffentlicheDateien = dateienUnter(oeffentlich);
const verboten = verboteneZoomDateien(oeffentlich, { sdkBin });
if (verboten.length > 0) {
  abbruch(`Zoom-SDK-Dateien im OEFFENTLICHEN Paket:\n  ${verboten.join('\n  ')}`);
}
schritt(
  `Waechter: keine der ${verbotenNamen.size} Zoom-SDK-Dateinamen im oeffentlichen Paket ` +
    `(geprueft gegen ${echteListe ? `das SDK unter ${sdkBin}` : 'die feste Liste fuer 7.1.5.43953'}).`,
);
// start.ps1 MUSS mit BOM ausgeliefert werden (Windows PowerShell 5.1).
if (!readFileSync(join(oeffentlich, 'start.ps1')).subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))) {
  abbruch('start.ps1 hat keinen UTF-8-BOM.');
}
// Kein Bau-Pfad des Entwickler-Rechners im oeffentlichen Paket (Benutzername,
// Ordnerstruktur). Gesucht als ASCII und als UTF-16, in jeder Datei.
const heim = homedir();
const spuren = [heim, heim.toLowerCase(), pkg].flatMap((s) => [Buffer.from(s, 'latin1'), Buffer.from(s, 'utf16le')]);
for (const f of oeffentlicheDateien) {
  const b = readFileSync(join(oeffentlich, f));
  if (spuren.some((s) => b.includes(s))) abbruch(`${f} enthaelt einen Pfad des Bau-Rechners (${heim}).`);
}
schritt(`keine Pfade des Bau-Rechners in ${oeffentlicheDateien.length} Dateien des oeffentlichen Pakets.`);

// --- 5. ZIP ------------------------------------------------------------------------
// Das tar von Windows (bsdtar) - NICHT das aus Git Bash, das kein ZIP kann.
const tar = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe');
if (!existsSync(tar)) abbruch(`${tar} fehlt (Windows 10 1803 oder neuer noetig).`);

function zippe(zip, basis, ordnerName) {
  rmSync(zip, { force: true });
  lauf(tar, ['-a', '-c', '-f', zip, '-C', basis, ordnerName]);
}

function sha256(datei) {
  return createHash('sha256').update(readFileSync(datei)).digest('hex');
}

const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;

// Ein Komplett-ZIP aus einem frueheren Bau lag direkt in release\ - dort
// traefe es ein `release\*.zip`. Weg damit; es liegt jetzt in privatDir.
for (const f of readdirSync(releaseDir)) {
  if (/KOMPLETT/i.test(f) && /\.zip$/i.test(f)) rmSync(join(releaseDir, f), { force: true });
}
zippe(zipOeffentlich, releaseDir, name);
// Gegenprobe am fertigen ZIP: was drin steht, nicht was hineingehen sollte.
const imZip = lauf(tar, ['-t', '-f', zipOeffentlich]).stdout.split(/\r?\n/).filter((l) => l && !l.endsWith('/'));
const imZipVerboten = imZip.filter((p) => verbotenNamen.has(p.split('/').pop().toLowerCase()));
if (imZipVerboten.length > 0) abbruch(`Zoom-SDK-Dateien im oeffentlichen ZIP:\n  ${imZipVerboten.join('\n  ')}`);

console.log(`\nOEFFENTLICH  ${zipOeffentlich}`);
console.log(`  ${mb(statSync(zipOeffentlich).size)}, sha256 ${sha256(zipOeffentlich)}`);
for (const f of imZip) console.log(`    ${f}`);

// --- 6. Komplett-Paket (nie veroeffentlichen) ---------------------------------------
if (komplett) {
  schritt('setze das KOMPLETT-Paket zusammen (NICHT veroeffentlichen) …');
  rmSync(komplettBasis, { recursive: true, force: true });
  mkdirSync(komplettBasis, { recursive: true });
  cpSync(oeffentlich, komplettOrdner, { recursive: true });
  // Keine SDK-Datei darf eine eigene ueberschreiben (zoom-bridge.exe, die
  // NDI-Laufzeit) - sonst liefe im Projekt etwas anderes als gebaut.
  const eigene = new Set(dateienUnter(join(komplettOrdner, 'bin')).map((f) => f.toLowerCase()));
  const kollision = dateienUnter(sdkBin).filter((f) => eigene.has(f.toLowerCase()));
  if (kollision.length > 0) abbruch(`SDK-Dateien wuerden eigene ueberschreiben:\n  ${kollision.join('\n  ')}`);
  cpSync(sdkBin, join(komplettOrdner, 'bin'), { recursive: true });
  copyFileSync(join(sdkDir, 'OSS-LICENSE.pdf'), join(komplettOrdner, 'LIZENZEN', 'OSS-LICENSE.pdf'));
  const sdkAnzahl = dateienUnter(sdkBin).length;
  const imBin = dateienUnter(join(komplettOrdner, 'bin')).length;
  if (imBin !== sdkAnzahl + eigeneBin || !existsSync(join(komplettOrdner, 'bin', 'sdk.dll'))) {
    abbruch(`bin\\ hat ${imBin} Dateien, erwartet ${sdkAnzahl} aus dem SDK + ${eigeneBin} eigene.`);
  }
  mkdirSync(privatDir, { recursive: true });
  zippe(zipKomplett, komplettBasis, name);
  const imKomplett = lauf(tar, ['-t', '-f', zipKomplett]).stdout.split(/\r?\n/).filter((l) => l && !l.endsWith('/'));
  console.log(`\nKOMPLETT (NICHT VEROEFFENTLICHEN)  ${zipKomplett}`);
  console.log(`  ${mb(statSync(zipKomplett).size)}, ${imKomplett.length} Dateien (davon ${sdkAnzahl} aus <Zoom-SDK>\\x64\\bin), sha256 ${sha256(zipKomplett)}`);
  const eigeneNamen = new Set(dateienUnter(join(oeffentlich, 'bin')).map((f) => f.toLowerCase()));
  for (const f of imKomplett.filter((p) => !/\/bin\/./.test(p) || eigeneNamen.has(p.split('/').pop().toLowerCase()) || /\/bin\/sdk\.dll$/.test(p))) {
    console.log(`    ${f}`);
  }
  console.log(`    … plus ${sdkAnzahl - 1} weitere SDK-Dateien in bin\\`);
}

// Zum Hochladen: in release\ selbst liegt nur das oeffentliche ZIP.
const obenZips = readdirSync(releaseDir).filter((f) => /\.zip$/i.test(f));
if (obenZips.length !== 1 || obenZips[0] !== `${name}-win-x64.zip`) {
  abbruch(`in ${releaseDir} soll nur das oeffentliche ZIP liegen, gefunden: ${obenZips.join(', ')}`);
}

console.log(`\nzoom-bridge.exe aus build\\Release vom ${new Date(statSync(bridgeExe).mtimeMs).toLocaleString('de-DE')}`);
console.log(`NDI-Laufzeit aus ${ndiDir}`);
console.log(`(Quellen: ${relative(pkg, paket)}\\, Ergebnis: ${relative(pkg, releaseDir)}\\ - von git ignoriert)`);
