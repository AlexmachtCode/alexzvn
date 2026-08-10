#!/usr/bin/env node
// Baut das JWT und startet damit 03-auth.exe. Das Geheimnis wandert ausschliesslich
// durch die Umgebung des Kindprozesses — es erscheint NICHT auf der Konsole, nicht in
// der Prozessliste und in keinem Protokoll.
//
//   $env:ZOOM_SDK_DIR      = "…\SDKs\zoom-c-sharp-wrapper-7.1.5.43953"
//   $env:ZOOM_SDK_CREDENTIALS = "…\zoom-credentials.json"   # ausserhalb des Repos!
//   node docs/superpowers/spikes/2026-08-10-zoom-sdk-linkbarkeit/run-auth.mjs
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const exe = join(here, 'build', '03-auth.exe');

const sdk = process.env.ZOOM_SDK_DIR;
if (!sdk) {
  console.error('ZOOM_SDK_DIR nicht gesetzt.');
  process.exit(2);
}
if (!existsSync(exe)) {
  console.error(`${exe} fehlt — erst build.mjs laufen lassen.`);
  process.exit(2);
}

// stdout = nur das JWT, stderr durchreichen (dort steht die Gueltigkeitsdauer).
let jwt;
try {
  jwt = execFileSync(process.execPath, [join(here, 'make-jwt.mjs')], {
    stdio: ['ignore', 'pipe', 'inherit'],
  })
    .toString()
    .trim();
} catch {
  process.exit(2); // make-jwt.mjs hat den Grund schon nach stderr geschrieben
}

if (!jwt.includes('.')) {
  console.error('make-jwt.mjs lieferte kein JWT.');
  process.exit(2);
}

const r = spawnSync(exe, [], {
  stdio: 'inherit',
  env: {
    ...process.env,
    ZOOM_SDK_JWT: jwt,
    PATH: `${join(sdk, 'x64', 'bin')};${process.env.PATH}`,
    // Zugangsdaten NICHT an das Kind weiterreichen — es braucht nur das JWT.
    ZOOM_SDK_CLIENT_ID: undefined,
    ZOOM_SDK_CLIENT_SECRET: undefined,
    ZOOM_SDK_CREDENTIALS: undefined,
  },
});
process.exit(r.status ?? 1);
