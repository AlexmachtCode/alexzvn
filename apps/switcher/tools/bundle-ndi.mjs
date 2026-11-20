// Staged beim `prepackage` (vor electron-builder) die für den NDI-Empfang nötigen
// Binaries nach resources/bin/win/ — von dort lädt die App sie zur Laufzeit:
//   1. das gebaute native Addon (@jm/ndi → jm_ndi.node)
//   2. die NDI-Runtime-DLL (Processing.NDI.Lib.x64.dll aus dem NDI-SDK)
//   3. ihr Lizenztext (Processing.NDI.Lib.Licenses.txt, NDI-SDK-Lizenz Abschnitt 3). Fehlt er oder ist er leer,
//      bricht der Bau ab, bevor etwas kopiert ist. Vorbild: apps/presenter/tools/bundle-ndi.mjs.
// Beide sind gitignored und werden pro Build frisch bereitgestellt. Identisch zu
// apps/ndi-screen-capture/tools/bundle-ndi.mjs.
//
// NUR auf Windows mit gebautem Addon + gesetztem NDI_SDK_DIR sinnvoll.
import { existsSync, mkdirSync, copyFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(appRoot, '..', '..');

if (process.platform !== 'win32') {
  console.log('[bundle-ndi] Nicht-Windows — übersprungen (Mac/Linux später).');
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
