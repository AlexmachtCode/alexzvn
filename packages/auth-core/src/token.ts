import crypto from 'node:crypto';

// Token- und Challenge-Response-Primitive für den Steuer-Handshake (P1, #59).
// Reines node:crypto. Verwendet vom SuiteControlServer/-Client (TCP) und später
// von @jm/remote (WSS). Das ROHE Token wandert nie über die Leitung — der Client
// beweist seinen Besitz per HMAC über eine vom Server gesendete Nonce.

/** Kryptografisch starkes Zufalls-Token (hex). Default 32 Byte = 256 bit. */
export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/** Frische Nonce für genau eine Verbindung (hex). Default 16 Byte = 128 bit. */
export function randomNonce(bytes = 16): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Handshake-Beweis: HMAC-SHA256(key=token, msg=nonce) als hex. Server sendet die
 * Nonce, Client antwortet mit `hmacProof(token, nonce)`. Server berechnet
 * denselben Wert und vergleicht konstantzeitig (verifyProof). Pro Verbindung
 * frische Nonce ⇒ kein Replay; Token bleibt geheim.
 */
export function hmacProof(token: string, nonce: string): string {
  return crypto.createHmac('sha256', token).update(nonce).digest('hex');
}

/** Konstantzeit-Vergleich eines Beweises gegen den erwarteten HMAC. */
export function verifyProof(token: string, nonce: string, proof: string): boolean {
  if (typeof proof !== 'string' || !token || !nonce) return false;
  const expectedHex = hmacProof(token, nonce);
  // Längen-Vorabprüfung auf der Hex-Darstellung, bevor wir parsen.
  if (proof.length !== expectedHex.length) return false;
  const a = Buffer.from(proof, 'hex');
  const b = Buffer.from(expectedHex, 'hex');
  // Ungültiges Hex ⇒ kürzerer Buffer ⇒ Längen-Mismatch ⇒ Ablehnung.
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
