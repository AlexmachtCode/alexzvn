// Riegel: baut das native Addon nur auf Windows und nur mit vorhandenem DeckLink-SDK
// (DECKLINK_SDK_DIR). So bricht `npm install` in CI und im Linux-Codespace NICHT.
// Gleiches Muster wie packages/ndi/scripts/maybe-build.mjs.
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

if (process.platform !== 'win32') {
  console.log('[@jm/decklink] Nicht-Windows — nativer Build uebersprungen.');
  process.exit(0);
}

const sdk = process.env.DECKLINK_SDK_DIR;
if (!sdk) {
  console.log('[@jm/decklink] DECKLINK_SDK_DIR nicht gesetzt — nativer Build uebersprungen.');
  console.log('[@jm/decklink] Desktop-Video-SDK laden, DECKLINK_SDK_DIR setzen, dann `npm run rebuild -w @jm/decklink`.');
  process.exit(0);
}

if (!existsSync(join(sdk, 'Win', 'include', 'DeckLinkAPI.idl'))) {
  console.warn(`[@jm/decklink] DECKLINK_SDK_DIR="${sdk}" enthaelt kein Win/include/DeckLinkAPI.idl — Build uebersprungen.`);
  process.exit(0);
}

console.log(`[@jm/decklink] DeckLink-SDK gefunden (${sdk}) — baue natives Addon …`);
execSync('node scripts/generate-idl.mjs', { stdio: 'inherit' });
execSync('node-gyp rebuild', { stdio: 'inherit' });
