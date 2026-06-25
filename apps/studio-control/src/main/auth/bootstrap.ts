import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { countUsers, createUser } from './users';

// First-run admin seeding.
//
// Default (production): generate a strong RANDOM password and write it to a
// 0600 file in userData — the operator reads it once and changes it. The secret
// is NOT echoed to stdout (logs may be captured/forwarded).
//
// Opt-in (dev/review only): set env JM_STUDIO_DEV_ADMIN=1 to seed the
// well-known Admin/Admin account so a reviewer can log in without hunting for a
// generated password. Never enable this in a shipped build.
const ADMIN_USERNAME = 'Admin';
const DEV_SEED = process.env.JM_STUDIO_DEV_ADMIN === '1';

/** Strong, human-copyable random password (~22 chars, url-safe alphabet). */
function generatePassword(): string {
  return crypto.randomBytes(16).toString('base64url');
}

export function ensureInitialAdmin(): { created: boolean; credentialsPath?: string } {
  if (countUsers() > 0) return { created: false };

  const password = DEV_SEED ? 'Admin' : generatePassword();
  createUser({ username: ADMIN_USERNAME, password, role: 'admin' });

  const credentialsPath = path.join(
    app.getPath('userData'),
    'first-run-credentials.txt',
  );
  const header = DEV_SEED
    ? `JM Studio Control — First-run admin credentials (DEV SEED — JM_STUDIO_DEV_ADMIN=1)`
    : `JM Studio Control — First-run admin credentials`;
  const note = DEV_SEED
    ? `⚠ WEAK DEV CREDENTIALS — never use in a shipped build.\n`
    : `Change this password after first login, then delete this file.\n`;
  const body =
    `${header}\n\n` +
    `username: ${ADMIN_USERNAME}\n` +
    `password: ${password}\n\n` +
    note;
  try {
    fs.writeFileSync(credentialsPath, body, { mode: 0o600 });
  } catch {
    // disk errors must not crash the app
  }

  if (DEV_SEED) {
    // Dev seed is a well-known value already — safe to echo for convenience.
    console.log(
      `[jm-studio-control] first-run admin created — username=${ADMIN_USERNAME} password=Admin (DEV SEED)`,
    );
  } else {
    // Never log the generated secret; point the operator at the 0600 file.
    console.log(
      `[jm-studio-control] first-run admin '${ADMIN_USERNAME}' created — password written to ${credentialsPath}`,
    );
  }
  return { created: true, credentialsPath };
}
