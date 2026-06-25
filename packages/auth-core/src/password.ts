import crypto from 'node:crypto';

// scrypt is part of Node core — no native compile step, unlike argon2/bcrypt.
// Parameters: N=2^15, r=8, p=1, salt=16B, hash=64B. ~50ms on modern hardware.
// Übernommen aus apps/studio-control/src/main/auth/password.ts (P1, #59): bisher
// das einzige echte Auth-Vorbild der Suite — hier promotet, damit Steuer-Protokoll
// und Remote dieselbe Basis nutzen (kein zweites Auth-System).

const N = 1 << 15;
const R = 8;
const P = 1;
const KEYLEN = 64;
const SALTLEN = 16;
// Node's scrypt default maxmem is 32 MB; N=2^15,r=8 needs ~128 MB.
const MAXMEM = 256 * 1024 * 1024;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(SALTLEN);
  const derived = crypto.scryptSync(password, salt, KEYLEN, {
    N,
    r: R,
    p: P,
    maxmem: MAXMEM,
  });
  return `scrypt$${N}$${R}$${P}$${salt.toString('hex')}$${derived.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = Buffer.from(parts[4], 'hex');
  const expected = Buffer.from(parts[5], 'hex');
  let actual: Buffer;
  try {
    actual = crypto.scryptSync(password, salt, expected.length, {
      N: n,
      r,
      p,
      maxmem: MAXMEM,
    });
  } catch {
    return false;
  }
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}
