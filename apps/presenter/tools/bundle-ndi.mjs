// Legt beim `prepackage` (vor electron-builder) die für den NDI-Versand nötigen Binaries nach
// resources/bin/win/ – von dort lädt @jm/ndi sie zur Laufzeit:
//   1. das gebaute native Addon (@jm/ndi → jm_ndi.node)
//   2. die NDI-Runtime-Lib (Processing.NDI.Lib.x64.dll)
// Beide sind gitignored und werden pro Build frisch bereitgestellt. Muster: apps/titler/tools/bundle-ndi.mjs.
// Nur Windows (#303): Das Mac-Paket baut die CI ohne NDI.
//
// Braucht ein gebautes Addon + gesetztes NDI_SDK_DIR. Fehlt eins davon, bricht der Lauf ab: ein Windows-Paket
// ohne NDI darf nie still entstehen.
import { existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(appRoot, '..', '..');

if (process.platform !== 'win32') {
  console.log('[bundle-ndi] Nur Windows: Mac-Presenter ohne NDI (#303) – übersprungen.');
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
