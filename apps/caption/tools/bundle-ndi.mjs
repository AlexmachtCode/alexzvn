// Staged beim `prepackage` (vor electron-builder) die für den NDI-Versand nötigen
// Binaries nach resources/bin/<plat>/ — von dort lädt @jm/ndi sie zur Laufzeit:
//   1. das gebaute native Addon (@jm/ndi → jm_ndi.node)
//   2. die NDI-Runtime-Lib (Win: Processing.NDI.Lib.x64.dll, Mac: libndi.dylib)
// Beide sind gitignored und werden pro Build frisch bereitgestellt. Muster:
// apps/titler/tools/bundle-ndi.mjs.
//
// Braucht ein gebautes Addon + gesetztes NDI_SDK_DIR (Win-DLL bzw. Mac-dylib).
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, copyFileSync, realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';
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
  mkdirSync(destDir, { recursive: true });

  // Addon kopieren.
  const nodeSrc = join(repoRoot, 'packages', 'ndi', 'build', 'Release', 'jm_ndi.node');
  if (!existsSync(nodeSrc)) {
    throw new Error(`[bundle-ndi] Addon nicht gefunden: ${nodeSrc} — erst \`npm run rebuild -w @jm/ndi\`.`);
  }
  const nodeDest = join(destDir, 'jm_ndi.node');
  copyFileSync(nodeSrc, nodeDest);

  // libndi.dylib aus dem SDK (Symlink → echte Datei auflösen) nach destDir.
  const dylibLink = join(sdk, 'lib', 'macOS', 'libndi.dylib');
  if (!existsSync(dylibLink)) {
    throw new Error(`[bundle-ndi] libndi.dylib nicht gefunden: ${dylibLink}`);
  }
  const dylibReal = lstatSync(dylibLink).isSymbolicLink() ? realpathSync(dylibLink) : dylibLink;
  const dylibDest = join(destDir, 'libndi.dylib');
  copyFileSync(dylibReal, dylibDest);

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
  console.log(`bundled jm_ndi.node + libndi.dylib → ${destDir}`);
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
mkdirSync(destDir, { recursive: true });

const sources = [
  {
    name: 'jm_ndi.node',
    src: join(repoRoot, 'packages', 'ndi', 'build', 'Release', 'jm_ndi.node'),
  },
  {
    name: 'Processing.NDI.Lib.x64.dll',
    src: join(sdk, 'Bin', 'x64', 'Processing.NDI.Lib.x64.dll'),
  },
];

for (const { name, src } of sources) {
  if (!existsSync(src)) {
    throw new Error(`[bundle-ndi] Quelle für ${name} nicht gefunden: ${src}`);
  }
  const dest = join(destDir, name);
  copyFileSync(src, dest);
  console.log(`bundled ${name} → ${dest}`);
}
