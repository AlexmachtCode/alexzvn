// @jm/auth-core — geteilter Krypto-/Token-Kern der Suite (P1, #59).
// Reines node:crypto, keine Native-Deps. Nur im Main-Prozess/Node verwenden.
export { hashPassword, verifyPassword } from './password.ts';
export { randomToken, randomNonce, hmacProof, verifyProof } from './token.ts';
