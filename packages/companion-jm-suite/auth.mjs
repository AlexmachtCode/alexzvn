// Pure Krypto-Helfer für den sicheren Steuer-Handshake (P1, #59) — node:crypto,
// frei von @companion-module/base, damit test/selftest.mjs sie ohne Companion-
// Runtime prüfen kann. Spiegelt @jm/auth-core (hmacProof) + die Fingerprint-
// Normalisierung aus @jm/auth-core/cert. Die PROTOKOLL-Grammatik (AUTHREQ/AUTH/
// AUTHOK/AUTHFAIL) kommt dagegen aus ./generated/protocol.mjs (eine Quelle).
//
// Das rohe Token wandert nie über die Leitung: der Server schickt eine Nonce,
// das Modul antwortet mit HMAC-SHA256(token, nonce). Bei TLS pinnt das Modul den
// SHA-256-Fingerprint des Server-Zertifikats (selbstsigniert, keine CA → TOFU).
import crypto from 'node:crypto';

/** Handshake-Beweis: HMAC-SHA256(key=token, msg=nonce) als hex (= @jm/auth-core). */
export function computeAuthProof(token, nonce) {
  return crypto.createHmac('sha256', String(token)).update(String(nonce)).digest('hex');
}

/**
 * Fingerprint vergleichbar machen: Doppelpunkte + Whitespace weg, klein. Der
 * Launcher zeigt den Wert bereits doppelpunktfrei/klein an; Node liefert ihn mit
 * Doppelpunkten (`AB:CD:…`). Beide Seiten gleich normalisieren → vergleichbar.
 */
export function normalizeFingerprint(fp) {
  return String(fp || '')
    .replace(/:/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}
