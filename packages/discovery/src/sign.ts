import crypto from 'node:crypto';

// mDNS-Annoncen-Signatur (P1, #59, Befund A5). Annoncen sind im LAN fälschbar:
// jedes Gerät kann einen `_jmps._tcp`-Dienst mit beliebigen TXT-Records ausgeben.
// Mit einem geteilten Pairing-Key signiert der Annoncierende die identitäts-
// stiftenden Felder (appId|role|port) per HMAC; Aggregatoren mit demselben Key
// prüfen die Signatur und ignorieren gefälschte/unsignierte Dienste.
//
// Reines node:crypto, bewusst OHNE bonjour-Import → eigenständig testbar.

export interface AdvertisedIdentity {
  appId: string;
  role: string;
  port: number;
}

/** Kanonische, signierte Darstellung der Dienst-Identität. */
function canonical(f: AdvertisedIdentity): string {
  return `${f.appId}|${f.role}|${f.port}`;
}

/** HMAC-SHA256-Signatur der Annonce (hex). */
export function signAdvertisement(key: string, f: AdvertisedIdentity): string {
  return crypto.createHmac('sha256', key).update(canonical(f)).digest('hex');
}

/** Signatur konstantzeitig prüfen. */
export function verifyAdvertisement(key: string, f: AdvertisedIdentity, sig: unknown): boolean {
  if (typeof sig !== 'string' || !key) return false;
  const expected = signAdvertisement(key, f);
  if (sig.length !== expected.length) return false;
  const a = Buffer.from(sig, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
