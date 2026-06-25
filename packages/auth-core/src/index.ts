// @jm/auth-core — geteilter Krypto-/Token-Kern der Suite (P1, #59).
// Reines node:crypto, keine Native-Deps. Nur im Main-Prozess/Node verwenden.
// Endungslose Imports (wie der Rest des Repos) — sonst lehnt tsc in den Apps,
// die auth-core via @jm/suite-control-protocol/server ziehen, die .ts-Endung ab
// (TS5097, ohne allowImportingTsExtensions). esbuild/tsx/Bundler lösen das auf.
export { hashPassword, verifyPassword } from './password';
export { randomToken, randomNonce, hmacProof, verifyProof } from './token';
export { certFingerprint, normalizeFingerprint } from './cert';
