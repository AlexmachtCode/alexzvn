#!/usr/bin/env node
// Riegel: baut das native Sidecar nur auf Windows und nur mit vorhandenem
// Zoom-SDK (ZOOM_SDK_DIR). So bricht `npm install` in CI und im Linux-Codespace
// NICHT. Gleiches Muster wie packages/decklink/scripts/maybe-build.mjs.
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

if (process.platform !== 'win32') {
  console.log('[@jm/zoom-bridge] Nicht-Windows - nativer Build uebersprungen.');
  process.exit(0);
}

const sdk = process.env.ZOOM_SDK_DIR;
if (!sdk) {
  console.log('[@jm/zoom-bridge] ZOOM_SDK_DIR nicht gesetzt - nativer Build uebersprungen.');
  console.log('[@jm/zoom-bridge] Zoom-Meeting-SDK entpacken, ZOOM_SDK_DIR darauf richten, dann `npm run rebuild -w @jm/zoom-bridge`.');
  process.exit(0);
}

if (!existsSync(join(sdk, 'x64', 'zoom_sdk_c_sharp_wrap', 'h', 'zoom_sdk.h'))) {
  console.warn(`[@jm/zoom-bridge] ZOOM_SDK_DIR="${sdk}" enthaelt kein x64/zoom_sdk_c_sharp_wrap/h/zoom_sdk.h - Build uebersprungen.`);
  process.exit(0);
}

console.log(`[@jm/zoom-bridge] Zoom-SDK gefunden (${sdk}) - baue zoom-bridge.exe …`);
execSync('node scripts/make-implib.mjs', { stdio: 'inherit' });
execSync('cmake -S . -B build -A x64', { stdio: 'inherit' });
execSync('cmake --build build --config Release', { stdio: 'inherit' });
