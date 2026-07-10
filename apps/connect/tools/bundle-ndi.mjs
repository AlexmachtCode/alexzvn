// Staged beim `prepackage` (vor electron-builder) die für den NDI-Versand nötigen
// Binaries nach resources/bin/win/ — von dort lädt die App sie zur Laufzeit:
//   1. das gebaute native Addon (@jm/ndi → jm_ndi.node)
//   2. die NDI-Runtime-DLL (Processing.NDI.Lib.x64.dll aus dem NDI-SDK)
// Beide sind gitignored und werden pro Build frisch bereitgestellt.
// Wortgleich zu apps/ndi-screen-capture/tools/bundle-ndi.mjs — jede App staged ihre
// eigenen Binaries (kein geteiltes Bundle), siehe dort.
//
// NUR auf Windows mit gebautem Addon + gesetztem NDI_SDK_DIR sinnvoll. Deshalb ist
// jm-connect im suite-release-Workflow von CI ausgenommen (das SDK fehlt auf Runnern).
import { existsSync, mkdirSync, copyFileSync } from 'node:fs';
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
