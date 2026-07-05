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

export interface AdvertisementTrust {
  /** Annonce durchreichen? `false` = verwerfen (Manipulation, oder Phase-2-unsigniert). */
  accept: boolean;
  /** War überhaupt eine `sig` vorhanden? (Diagnose/Badge, Phase-2-Grundlage). */
  signed: boolean;
  /** Signatur vorhanden UND gültig — bzw. keine Prüfung angefordert (`verified:true`). */
  verified: boolean;
}

/**
 * Vertrauens-Entscheidung für eine mDNS-Annonce (P1, #59) — reine Logik, damit sie
 * ohne bonjour testbar ist. Zwei-Phasen-Rollout, absichtlich konservativ:
 *
 *  - **kein `key`** (open-Modus / keine Prüfung angefordert) → immer akzeptieren
 *    (`verified:true`), unverändertes Legacy-Verhalten.
 *  - **`key` + gültige Signatur** → akzeptieren (`verified:true`).
 *  - **`key` + Signatur vorhanden, aber falsch** → IMMER verwerfen. Das ist der
 *    einzige Fall echter Manipulation/Spoofing (jemand ohne Key hat signiert).
 *  - **`key` + keine Signatur** → in **Phase 1 tolerieren** (`accept:true`): ein
 *    legitimes, noch nicht aktualisiertes Tool signiert noch nicht und darf im
 *    secure-Modus nicht verschwinden, solange nicht alle Maschinen upgedatet sind.
 *    Mit **`strict` (Phase 2)** auch unsignierte verwerfen → volle Vertrauenswürdigkeit,
 *    erst sicher, wenn die ganze Suite signiert ausgeliefert ist.
 */
export function assessAdvertisement(
  key: string | undefined,
  f: AdvertisedIdentity,
  sig: unknown,
  strict = false,
): AdvertisementTrust {
  const signed = sig != null && sig !== '';
  if (!key) return { accept: true, signed, verified: true };
  if (!signed) return { accept: !strict, signed: false, verified: false };
  const verified = verifyAdvertisement(key, f, sig);
  return { accept: verified, signed: true, verified };
}
