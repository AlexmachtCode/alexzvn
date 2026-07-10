// Kopiert die gebaute @jm/appkit-Laufzeit nach resources/, damit electron-builder
// sie in die gepackte App legt (extraResources). Der Main-Prozess liest sie von
// dort und legt sie in jedes Export-Bundle bzw. hinter jmapp://.
//
// Muster wie apps/titler/tools/bundle-ndi.mjs: ein Artefakt aus einem anderen
// Workspace wird gestaged, nicht importiert.
//
// Ohne diesen Schritt exportiert die gepackte App leere Bundles — im Dev fällt
// das nicht auf, weil dort direkt aus packages/appkit/dist gelesen wird.

import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(here, '..');
const repoRoot = resolve(appDir, '..', '..');

const src = join(repoRoot, 'packages', 'appkit', 'dist', 'runtime.js');
const destDir = join(appDir, 'resources');
const dest = join(destDir, 'runtime.js');

if (!existsSync(src)) {
  console.error(
    `[bundle-runtime] ${src} fehlt.\n` +
      `  Zuerst bauen:  npm run build -w @jm/appkit`,
  );
  process.exit(1);
}

mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log(`[bundle-runtime] runtime.js → ${dest}`);
