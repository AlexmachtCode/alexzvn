// Legt beim `prepackage` (vor electron-builder) die für den NDI-Versand nötigen Binaries nach
// resources/bin/win/ – von dort lädt @jm/ndi sie zur Laufzeit:
//   1. das gebaute native Addon (@jm/ndi → jm_ndi.node)
//   2. die NDI-Runtime-Lib (Processing.NDI.Lib.x64.dll)
//   3. ihr Lizenztext (Processing.NDI.Lib.Licenses.txt, Drittbibliotheken der Laufzeit; NDI-SDK-Lizenz Abschnitt 3,
//      Connect-Spec LP4) – liegt im Paket neben der DLL. Vorbild: apps/connect/tools/bundle-ndi.mjs.
// Alle sind gitignored und werden pro Build frisch bereitgestellt. Muster: apps/titler/tools/bundle-ndi.mjs.
// Nur Windows (#303): Das Mac-Paket baut die CI ohne NDI.
//
// Braucht ein gebautes Addon + gesetztes NDI_SDK_DIR. Fehlt eine Quelle oder ist sie leer, bricht der Lauf ab, bevor
// etwas kopiert ist: ein Windows-Paket ohne NDI oder ohne Lizenztext darf nie still entstehen.
import { existsSync, mkdirSync, copyFileSync, statSync } from 'node:fs';
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
