import { X509Certificate } from 'node:crypto';

// Zertifikats-Fingerprint für TOFU-Pinning (P1, #59). Im secure-Modus nutzt der
// Steuer-Transport selbstsignierte Zertifikate (keine CA): der Client pinnt den
// SHA-256-Fingerprint des Server-Zertifikats. Reines node:crypto.

/** Fingerprint normalisieren: Doppelpunkte weg, klein — vergleichbar gemacht. */
export function normalizeFingerprint(fp: string): string {
  return fp.replace(/:/g, '').toLowerCase();
}

/**
 * SHA-256-Fingerprint eines Zertifikats (PEM oder DER), normalisiert (hex,
 * lowercase, ohne Doppelpunkte). Diesen Wert gibt der Launcher beim Pairing aus
 * und der Client vergleicht ihn mit dem tatsächlichen Server-Zertifikat.
 */
export function certFingerprint(cert: string | Buffer): string {
  return normalizeFingerprint(new X509Certificate(cert).fingerprint256);
}
