// Staged beim `prepackage` (vor electron-builder) die für den NDI-Versand nötigen
// Binaries nach resources/bin/<plat>/ — von dort lädt @jm/ndi sie zur Laufzeit:
//   1. das gebaute native Addon (@jm/ndi → jm_ndi.node)
//   2. die NDI-Runtime-Lib (Win: Processing.NDI.Lib.x64.dll, Mac: libndi.dylib)
//   3. der Lizenztext der NDI-Laufzeit (NDI-SDK-Lizenz, Abschnitt 3; Win: Processing.NDI.Lib.Licenses.txt, Mac: die
//      Lizenzdateien wie bei Connect). Fehlt er oder ist er leer, bricht der Bau ab, bevor etwas kopiert ist.
// Vorbild: apps/presenter/tools/bundle-ndi.mjs (Windows), apps/connect/tools/bundle-ndi.mjs (Mac).
// Beide sind gitignored und werden pro Build frisch bereitgestellt. Muster:
// apps/titler/tools/bundle-ndi.mjs.
//
// Braucht ein gebautes Addon + gesetztes NDI_SDK_DIR (Win-DLL bzw. Mac-dylib).
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, copyFileSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(appRoot, '..', '..');

// ── macOS (arm64) ─────────────────────────────────────────────────────────────
// macOS findet Libs über @rpath/install_name, nicht über PATH. Wir legen
// libndi.dylib neben das Addon und biegen die Lib-Referenz der .node auf
// @loader_path/libndi.dylib um (+ rpath @loader_path als Fallback). So braucht der
// Zielrechner KEIN NDI-SDK/-Runtime.
if (process.platform === 'darwin') {
  const sdk = process.env.NDI_SDK_DIR;
  if (!sdk) {
    throw new Error('[bundle-ndi] NDI_SDK_DIR nicht gesetzt — kann libndi.dylib nicht finden.');
  }
  const destDir = join(appRoot, 'resources', 'bin', 'mac');

  const nodeSrc = join(repoRoot, 'packages', 'ndi', 'build', 'Release', 'jm_ndi.node');
  if (!existsSync(nodeSrc)) {
    throw new Error(`[bundle-ndi] Addon nicht gefunden: ${nodeSrc} — erst \`npm run rebuild -w @jm/ndi\`.`);
  }

  // libndi.dylib aus dem SDK (Symlink → echte Datei auflösen) nach destDir.
  const dylibLink = join(sdk, 'lib', 'macOS', 'libndi.dylib');
  if (!existsSync(dylibLink)) {
    throw new Error(`[bundle-ndi] libndi.dylib nicht gefunden: ${dylibLink}`);
  }
  const dylibReal = lstatSync(dylibLink).isSymbolicLink() ? realpathSync(dylibLink) : dylibLink;
  // Lizenzdateien wie Connect (dynamisch, nur hier: die Probe im Temp-Baum läuft ohne Connect-Dateien). Das Apple-SDK
  // legt libndi_licenses.txt dreimal gleich ab, lizenzAuswahl legt sie einmal bei. Alles prüfen, bevor etwas kopiert ist.
  const { lizenzDateien, lizenzAuswahl } = await import('../../connect/tools/bundle-ndi.mjs');
  const dateien = readdirSync(sdk, { recursive: true })
    .map((p) => String(p).replaceAll('\\', '/'))
    .filter((rel) => statSync(join(sdk, rel)).isFile());
  const lizenzen = lizenzDateien(dateien);
  if (!lizenzen.length) throw new Error(`[bundle-ndi] keine Lizenzdatei der NDI-Laufzeit (.txt mit „licen“ im Pfad) unter ${sdk}`);
  const sha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
  const { kopieren: lizenzKopien } = lizenzAuswahl(lizenzen, (rel) => sha256(join(sdk, rel)));
  // Eine leere Lizenzdatei (0 Byte) gilt wie eine fehlende: Abbruch vor jeder Kopie.
  const leer = lizenzKopien.filter((l) => statSync(join(sdk, l)).size === 0);
  if (leer.length) throw new Error(`[bundle-ndi] Lizenzdatei leer: ${leer.join(', ')}`);

  mkdirSync(destDir, { recursive: true });
  const nodeDest = join(destDir, 'jm_ndi.node');
  copyFileSync(nodeSrc, nodeDest);
  const dylibDest = join(destDir, 'libndi.dylib');
  copyFileSync(dylibReal, dylibDest);
  for (const l of lizenzKopien) copyFileSync(join(sdk, l), join(destDir, basename(l)));

  // Die von der .node referenzierte libndi-Load-Command finden (otool -L) und auf
  // @loader_path/libndi.dylib umbiegen.
  const otool = execFileSync('otool', ['-L', nodeDest], { encoding: 'utf8' });
  const ref = otool
    .split('\n')
    .map((l) => l.trim().split(' ')[0])
    .find((p) => /libndi.*\.dylib$/.test(p));
  if (ref && ref !== '@loader_path/libndi.dylib') {
    execFileSync('install_name_tool', ['-change', ref, '@loader_path/libndi.dylib', nodeDest]);
  }
  try {
    execFileSync('install_name_tool', ['-add_rpath', '@loader_path', nodeDest], { stdio: 'pipe' });
  } catch (err) {
    if (!/would duplicate|already/.test(String(err.stderr || err.message || ''))) throw err;
  }
  console.log(`bundled jm_ndi.node + libndi.dylib + ${lizenzKopien.length} Lizenzdatei(en) → ${destDir}`);
  process.exit(0);
}

// ── Windows ───────────────────────────────────────────────────────────────────
if (process.platform !== 'win32') {
  console.log('[bundle-ndi] Nicht-Windows/Mac — übersprungen (Linux später).');
  process.exit(0);
}

const sdk = process.env.NDI_SDK_DIR;
if (!sdk) {
  throw new Error('[bundle-ndi] NDI_SDK_DIR nicht gesetzt — kann Runtime-DLL nicht finden.');
}

const destDir = join(appRoot, 'resources', 'bin', 'win');

const sources = [
  {
    name: 'jm_ndi.node',
    src: join(repoRoot, 'packages', 'ndi', 'build', 'Release', 'jm_ndi.node'),
  },
  {
    name: 'Processing.NDI.Lib.x64.dll',
    src: join(sdk, 'Bin', 'x64', 'Processing.NDI.Lib.x64.dll'),
  },
  {
    name: 'Processing.NDI.Lib.Licenses.txt',
    src: join(sdk, 'Bin', 'x64', 'Processing.NDI.Lib.Licenses.txt'),
  },
];

// Erst alle Quellen prüfen, dann kopieren: Bei einem Abbruch liegt nichts Halbes in resources/bin/win.
const fehlen = sources.filter(({ src }) => !existsSync(src) || !statSync(src).isFile() || statSync(src).size === 0);
if (fehlen.length) {
  throw new Error(`[bundle-ndi] Quelle fehlt oder ist leer: ${fehlen.map(({ name, src }) => `${name} (${src})`).join(', ')}`);
}

mkdirSync(destDir, { recursive: true });
for (const { name, src } of sources) {
  const dest = join(destDir, name);
  copyFileSync(src, dest);
  console.log(`bundled ${name} → ${dest}`);
}
