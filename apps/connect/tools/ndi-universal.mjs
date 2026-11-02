// Universelles NDI-Addon für das Mac-Paket von JM Connect (Spec Zoom-Slots 22.7 „Universelles Addon“, E46): baut
// packages/ndi einmal für arm64 und einmal für x64 (node-gyp rebuild --arch=…), legt beide Ergebnisse beiseite und vereint
// sie mit lipo -create nach packages/ndi/build/Release/jm_ndi.node. extraResources legt dasselbe Addon in beide Apps; ein
// Addon nur für die Architektur des Rechners ließe die NDI-Prozesse der anderen App beim Laden sterben. Dass der x64-Bau
// auf einem arm64-Rechner gegen die universelle libndi.dylib gelingt, ist Annahme AN29 (Probelauf, ND12).
//   npm run rebuild:native:mac -w @jm/connect     (nur macOS; NDI_SDK_DIR auf einen Pfad OHNE Leerzeichen)
// binding.gyp setzt NDI_SDK_DIR ohne Anführungszeichen in die Pfade (packages/ndi/binding.gyp:8, :19); darum zeigt
// NDI_SDK_DIR auf einen Link ohne Leerzeichen (docs/mac-build-windows-only-apps.md, Leerzeichen-Falle).
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { machOArchitekturen } from './pruefe-mac-paket.mjs';

const ndiDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'packages', 'ndi');
const ziel = join(ndiDir, 'build', 'Release', 'jm_ndi.node');
/** node-gyp-Name und Mach-O-Name (wie lipo -archs) je Architektur. */
const ARCHS = [['arm64', 'arm64'], ['x64', 'x86_64']];

if (process.platform !== 'darwin') {
  console.error('[ndi-universal] nur unter macOS (node-gyp für arm64 und x64, lipo); auf diesem Rechner wird nichts gebaut.');
  process.exit(2);
}
const sdk = process.env.NDI_SDK_DIR;
if (!sdk || /\s/.test(sdk)) {
  console.error(`[ndi-universal] NDI_SDK_DIR ${sdk ? `enthält ein Leerzeichen (${sdk})` : 'nicht gesetzt'}: auf einen Link ohne Leerzeichen zur Wurzel des NDI-SDK für Apple zeigen lassen.`);
  process.exit(1);
}
const nodeGyp = createRequire(join(ndiDir, 'package.json')).resolve('node-gyp/bin/node-gyp.js');
const ablage = mkdtempSync(join(tmpdir(), 'jm-ndi-universal-'));
try {
  const teile = [];
  for (const [gyp, macho] of ARCHS) {
    execFileSync(process.execPath, [nodeGyp, 'rebuild', `--arch=${gyp}`], { cwd: ndiDir, stdio: 'inherit' });
    const archs = machOArchitekturen(readFileSync(ziel));
    if (archs.length !== 1 || archs[0] !== macho) {
      throw new Error(`[ndi-universal] node-gyp --arch=${gyp} lieferte ${archs.join(', ') || 'kein Mach-O'} statt ${macho}.`);
    }
    const teil = join(ablage, `jm_ndi-${gyp}.node`);
    copyFileSync(ziel, teil);
    teile.push(teil);
    console.log(`[ndi-universal] ${macho}: ${teil}`);
  }
  execFileSync('lipo', ['-create', '-output', ziel, ...teile], { stdio: 'inherit' });
  const archs = machOArchitekturen(readFileSync(ziel));
  if (!archs.includes('arm64') || !archs.includes('x86_64')) {
    throw new Error(`[ndi-universal] lipo -create lieferte ${archs.join(', ') || 'kein Mach-O'} statt arm64 und x86_64.`);
  }
  console.log(`[ndi-universal] universell (${archs.join(', ')}): ${ziel}`);
} finally {
  rmSync(ablage, { recursive: true, force: true });
}
