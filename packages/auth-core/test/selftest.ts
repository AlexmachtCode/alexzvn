// Mini-Selbsttest (kein Framework): node --experimental-strip-types test/selftest.ts
// Deckt scrypt-Passwörter + Token/HMAC-Challenge-Response ab. Reines node:crypto,
// keine Workspace-Deps → läuft eigenständig.
import {
  hashPassword,
  verifyPassword,
  randomToken,
  randomNonce,
  hmacProof,
  verifyProof,
  certFingerprint,
  normalizeFingerprint,
} from '../src/index.ts';

// Throwaway-Testzertifikat (selbstsigniert, EC P-256) — KEIN Secret.
const TEST_CERT = `-----BEGIN CERTIFICATE-----
MIIBhTCCASugAwIBAgIUZLJSpXBBLzdFiJ5UTC3cbMRNE/kwCgYIKoZIzj0EAwIw
GDEWMBQGA1UEAwwNam0tc3VpdGUtdGVzdDAeFw0yNjA2MjUxMTUxMTNaFw0zNjA2
MjIxMTUxMTNaMBgxFjAUBgNVBAMMDWptLXN1aXRlLXRlc3QwWTATBgcqhkjOPQIB
BggqhkjOPQMBBwNCAASZ7WcDFrl9KKTv7ydif+LzX4KYDwPErBYpWiBZi1HmTxzH
ecORNwa1nSIVJPKvrMLy0WoM5ZNcKYaZTPDTorN4o1MwUTAdBgNVHQ4EFgQUqGQ3
4yn1tK5lTD5/+bFXBX3+rw8wHwYDVR0jBBgwFoAUqGQ34yn1tK5lTD5/+bFXBX3+
rw8wDwYDVR0TAQH/BAUwAwEB/zAKBggqhkjOPQQDAgNIADBFAiEAiC4dDZ3a4uhj
ksAGWLma4tGILo8EoFtRJKtJnDEB31ICIDvShBjtwkEf58/8PLBYwfPbmxt/2OJC
AovVbb6Rel2Y
-----END CERTIFICATE-----
`;
const TEST_CERT_FP = '4d1d1af17136c8e094c8c29b0055613e61b6d540d5493c54a16bca9753fd7237';

let failed = 0;
function ok(cond: boolean, msg: string): void {
  if (cond) {
    console.log(`ok   ${msg}`);
  } else {
    failed++;
    console.error(`FAIL ${msg}`);
  }
}

// ── Passwörter (scrypt) ──────────────────────────────────────────────────────
const stored = hashPassword('correct horse battery staple');
ok(stored.startsWith('scrypt$'), 'hashPassword liefert scrypt$-Format');
ok(verifyPassword('correct horse battery staple', stored) === true, 'verifyPassword akzeptiert korrektes Passwort');
ok(verifyPassword('wrong', stored) === false, 'verifyPassword lehnt falsches Passwort ab');
ok(verifyPassword('x', 'kaputt$nicht$valide') === false, 'verifyPassword lehnt defekten Hash ab');
ok(hashPassword('a') !== hashPassword('a'), 'gleiche Eingabe → unterschiedliche Hashes (Salt)');

// ── Token / Nonce ────────────────────────────────────────────────────────────
const t1 = randomToken();
const t2 = randomToken();
ok(/^[0-9a-f]{64}$/.test(t1), 'randomToken: 32 Byte hex (256 bit)');
ok(t1 !== t2, 'randomToken: zwei Tokens unterscheiden sich');
ok(/^[0-9a-f]{32}$/.test(randomNonce()), 'randomNonce: 16 Byte hex (128 bit)');

// ── Challenge-Response (HMAC) ────────────────────────────────────────────────
const token = randomToken();
const nonce = randomNonce();
const proof = hmacProof(token, nonce);
ok(/^[0-9a-f]{64}$/.test(proof), 'hmacProof: SHA-256 hex');
ok(hmacProof(token, nonce) === proof, 'hmacProof ist deterministisch (gleiches token+nonce)');
ok(verifyProof(token, nonce, proof) === true, 'verifyProof akzeptiert korrekten Beweis');
ok(verifyProof(token, randomNonce(), proof) === false, 'verifyProof lehnt Beweis für andere Nonce ab (Anti-Replay)');
ok(verifyProof(randomToken(), nonce, proof) === false, 'verifyProof lehnt Beweis mit falschem Token ab');
ok(verifyProof(token, nonce, proof.slice(0, -2) + '00') === false, 'verifyProof lehnt manipulierten Beweis ab');
ok(verifyProof(token, nonce, 'nicht-hex') === false, 'verifyProof lehnt Nicht-Hex/zu kurzen Beweis ab');
ok(verifyProof(token, nonce, '') === false, 'verifyProof lehnt leeren Beweis ab');

// ── Zertifikats-Fingerprint (TOFU-Pinning) ───────────────────────────────────
ok(normalizeFingerprint('AB:CD:EF') === 'abcdef', 'normalizeFingerprint: Doppelpunkte weg + lowercase');
ok(certFingerprint(TEST_CERT) === TEST_CERT_FP, 'certFingerprint: bekannter SHA-256 des Testzertifikats');
ok(certFingerprint(TEST_CERT) === certFingerprint(TEST_CERT), 'certFingerprint ist deterministisch');

if (failed > 0) {
  console.error(`\n${failed} FEHLGESCHLAGEN`);
  process.exit(1);
}
console.log('\nALLE TESTS OK');
