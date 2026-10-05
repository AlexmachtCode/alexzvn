// Staged beim `prepackage` (nach bundle-ndi, vor electron-builder) die Zoom-Bridge
// fuer JM Connect nach resources/zoom-bridge/ (Spec Stage 4, 10.1 und 10.2):
//   1. zoom-bridge.exe aus packages/zoom-bridge/build/Release - frisch gebaut
//   2. die Visual-C++-Laufzeit (alle *.dll aus Microsoft.VC14x.CRT), app-lokal
// KEINE Datei aus <Zoom-SDK>\x64\bin: die waehlt der Bediener einmal je PC (E2).
// Waechter 1 prueft das unten am ganzen resources-Ordner; Waechter 2
// (tools/after-pack.cjs) prueft es noch einmal am fertigen win-unpacked samt app.asar.
//
// Eigener Unterordner, NICHT resources/bin/win: dort setzt @jm/ndi den Ordner vorn
// auf PATH der Gast-Sender (packages/ndi/index.js:30-53) - eine fremde VC-Laufzeit
// dort wuerde in deren Prozesse geladen (Spec 10.1).
//
// resources/zoom-bridge/ ist gitignored und wird bei jedem Lauf frisch gefuellt.
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  VC_PFLICHT,
  bridgeExeFrisch,
  findeVcLaufzeit,
  linkerFassung,
  mindestens,
  verboteneZoomDateien,
} from '../../../packages/zoom-bridge/scripts/auslieferung.mjs';

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(appRoot, '..', '..');
const pkgDir = join(repoRoot, 'packages', 'zoom-bridge');

if (process.platform !== 'win32') {
  console.log('[bundle-zoom-bridge] Nicht-Windows — übersprungen.');
  process.exit(0);
}

function abbruch(msg) {
  console.error(`\n[bundle-zoom-bridge] ABBRUCH: ${msg}`);
  process.exit(1);
}

// 2. Die EXE muss aus dem aktuellen Stand gebaut sein (Texte wie im Einsatzpaket).
const frisch = bridgeExeFrisch(pkgDir);
if (!frisch.ok) abbruch(frisch.text);

// 3. VC-Laufzeit: mindestens die Fassung des Linkers, der die EXE gebaut hat
//    (die STL ist nur rueckwaerts kompatibel).
let linker;
try {
  linker = linkerFassung(frisch.exe);
} catch (e) {
  abbruch(e.message);
}
const vc = findeVcLaufzeit(pkgDir);
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

// 4. resources/zoom-bridge/ leeren und fuellen.
const resources = join(appRoot, 'resources');
const ziel = join(resources, 'zoom-bridge');
rmSync(ziel, { recursive: true, force: true });
mkdirSync(ziel, { recursive: true });
copyFileSync(frisch.exe, join(ziel, 'zoom-bridge.exe'));
const vcDateien = readdirSync(vcLaufzeit.dir).filter((f) => /\.dll$/i.test(f));
for (const f of vcDateien) copyFileSync(join(vcLaufzeit.dir, f), join(ziel, f));
console.log(`bundled zoom-bridge.exe → ${join(ziel, 'zoom-bridge.exe')}`);
console.log(
  `bundled VC-Laufzeit ${vcLaufzeit.fassung.join('.')} (Linker der Bridge: ${linker.join('.')}) aus ${vcLaufzeit.dir}: ${vcDateien.join(', ')}`,
);

// 5. Waechter 1: keine Zoom-SDK-Datei irgendwo unter resources/. Mit ZOOM_SDK_DIR
//    gegen die echte Liste, sonst gegen die feste fuer 7.1.5.43953.
const sdkBin = process.env.ZOOM_SDK_DIR ? join(process.env.ZOOM_SDK_DIR, 'x64', 'bin') : null;
const treffer = verboteneZoomDateien(resources, { sdkBin });
if (treffer.length > 0) abbruch(`Zoom-SDK-Dateien in ${resources}:\n  ${treffer.join('\n  ')}`);
console.log(
  `[bundle-zoom-bridge] Waechter 1: keine Zoom-SDK-Datei unter ${resources} ` +
    `(geprueft gegen ${sdkBin && existsSync(sdkBin) ? `das SDK unter ${sdkBin}` : 'die feste Liste fuer 7.1.5.43953'}).`,
);
