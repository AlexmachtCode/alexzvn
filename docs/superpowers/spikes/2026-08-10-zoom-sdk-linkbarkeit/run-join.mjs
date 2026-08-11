#!/usr/bin/env node
// Baut das JWT und startet damit 04-join-rawrecording.exe.
//
// Wie run-auth.mjs: Client-ID und Secret wandern NIE auf die Konsole und werden aus der
// Umgebung des Kindprozesses wieder entfernt — es bekommt nur das fertige JWT.
//
//   $env:ZOOM_SDK_DIR         = "…\SDKs\zoom-c-sharp-wrapper-7.1.5.43953"
//   $env:ZOOM_SDK_CREDENTIALS = "…\zoom-credentials.json"    # ausserhalb des Repos
//   $env:ZOOM_MEETING_ID       = "83034458134"
//   $env:ZOOM_MEETING_PASSCODE = "…"
//   node docs/superpowers/spikes/2026-08-10-zoom-sdk-linkbarkeit/run-join.mjs
//
// Meeting-Nummer und Kenncode gehoeren ebenfalls NICHT ins Repo.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const exe = join(here, 'build', '04-join-rawrecording.exe');

const sdk = process.env.ZOOM_SDK_DIR;
if (!sdk) {
  console.error('ZOOM_SDK_DIR nicht gesetzt.');
  process.exit(2);
}
if (!process.env.ZOOM_MEETING_ID) {
  console.error('ZOOM_MEETING_ID nicht gesetzt (Meeting-Nummer, nur Ziffern).');
  process.exit(2);
}
if (!existsSync(exe)) {
  console.error(`${exe} fehlt — erst build.mjs laufen lassen.`);
  process.exit(2);
}

let jwt;
try {
  jwt = execFileSync(process.execPath, [join(here, 'make-jwt.mjs')], {
    stdio: ['ignore', 'pipe', 'inherit'],
  })
    .toString()
    .trim();
} catch {
  process.exit(2);
}

const r = spawnSync(exe, [], {
  stdio: 'inherit',
  env: {
    ...process.env,
    ZOOM_SDK_JWT: jwt,
    PATH: `${join(sdk, 'x64', 'bin')};${process.env.PATH}`,
    ZOOM_SDK_CLIENT_ID: undefined,
    ZOOM_SDK_CLIENT_SECRET: undefined,
    ZOOM_SDK_CREDENTIALS: undefined,
  },
});
process.exit(r.status ?? 1);
