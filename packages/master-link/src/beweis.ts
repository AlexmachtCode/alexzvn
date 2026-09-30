import {
  createHmac, createPrivateKey, createPublicKey, generateKeyPairSync, sign, timingSafeEqual, verify,
  X509Certificate,
} from 'node:crypto';
import { certFingerprint } from '@jm/auth-core';

// Kopplungsbeweise (Spec 3.3) und Anmeldung per Ed25519 (Spec 3.4).
// Die Trennzeichen „|“ sind eindeutig: kein Feld enthält „|“ (hex, base64, UUID).

const PRAEFIX = 'jm-master-link/1';

export interface KoppelDaten {
  /** SHA-256-Fingerprint: beim Slave der GESEHENE, beim Master der eigene. */
  fp: string;
  ns: string;
  nc: string;
  rechnerId: string;
  /** Öffentlicher Schlüssel des Slaves (SPKI-DER base64). */
  schluessel: string;
}

function hmac(code: string, teile: string[]): string {
  return createHmac('sha256', code).update(teile.join('|')).digest('hex');
}

export function slaveBeweis(code: string, d: KoppelDaten): string {
  return hmac(code, [`${PRAEFIX}/koppeln/slave`, d.fp, d.ns, d.nc, d.rechnerId, d.schluessel]);
}

export function masterBeweis(code: string, d: KoppelDaten, masterId: string): string {
  return hmac(code, [`${PRAEFIX}/koppeln/master`, d.fp, d.ns, d.nc, d.rechnerId, d.schluessel, masterId]);
}

/** Vergleich in konstanter Zeit; alles außer gleich langem Hex ist falsch. */
export function gleicherBeweis(erwartet: string, erhalten: unknown): boolean {
  if (typeof erhalten !== 'string' || erhalten.length !== erwartet.length || !/^[0-9a-f]+$/.test(erhalten)) {
    return false;
  }
  return timingSafeEqual(Buffer.from(erwartet, 'hex'), Buffer.from(erhalten, 'hex'));
}

export interface Schluesselpaar {
  /** PKCS8-DER base64. */
  privat: string;
  /** SPKI-DER base64. */
  oeffentlich: string;
}

export function erzeugeSchluesselpaar(): Schluesselpaar {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    privat: privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'),
    oeffentlich: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
  };
}

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

function oeffentlicherSchluessel(oeffentlich: unknown) {
  if (typeof oeffentlich !== 'string' || !BASE64.test(oeffentlich)) return null;
  try {
    const k = createPublicKey({ key: Buffer.from(oeffentlich, 'base64'), format: 'der', type: 'spki' });
    // GEMESSEN: createPublicKey nimmt auch RSA-SPKI an, und verify(null) klappt dann auch mit RSA.
    return k.asymmetricKeyType === 'ed25519' ? k : null;
  } catch {
    return null;
  }
}

export function istEd25519Oeffentlich(oeffentlich: unknown): boolean {
  return oeffentlicherSchluessel(oeffentlich) !== null;
}

function anmeldeText(fp: string, ns: string, rechnerId: string): Buffer {
  return Buffer.from([`${PRAEFIX}/anmelden`, fp, ns, rechnerId].join('|'), 'utf8');
}

function privaterSchluessel(privat: string) {
  return createPrivateKey({ key: Buffer.from(privat, 'base64'), format: 'der', type: 'pkcs8' });
}

/** Dieselbe Dekodierung wie signiereAnmeldung: was hier besteht, lässt das Signieren nicht werfen. */
export function istEd25519Privat(privat: unknown): boolean {
  if (typeof privat !== 'string') return false;
  try {
    // GEMESSEN: 'AAAA'/abgeschnitten → createPrivateKey wirft; RSA-/EC-PKCS8 lädt und signiert, aber nicht Ed25519.
    return privaterSchluessel(privat).asymmetricKeyType === 'ed25519';
  } catch {
    return false;
  }
}

export function signiereAnmeldung(privat: string, fp: string, ns: string, rechnerId: string): string {
  return sign(null, anmeldeText(fp, ns, rechnerId), privaterSchluessel(privat)).toString('base64');
}

/** Wirft nie: jeder Fehler (Müll-Schlüssel, falscher Typ, kaputte Signatur) → false. */
export function pruefeAnmeldung(
  oeffentlich: string,
  fp: string,
  ns: string,
  rechnerId: string,
  signatur: unknown,
): boolean {
  if (typeof signatur !== 'string' || !BASE64.test(signatur)) return false;
  const schluessel = oeffentlicherSchluessel(oeffentlich);
  if (!schluessel) return false;
  try {
    return verify(null, anmeldeText(fp, ns, rechnerId), schluessel, Buffer.from(signatur, 'base64'));
  } catch {
    return false;
  }
}

/** DER (getPeerCertificate().raw) → PEM mit LF. */
export function derZuPem(der: Buffer): string {
  return new X509Certificate(der).toString();
}

export function fingerprintVonPem(pem: string): string {
  return certFingerprint(pem);
}

export function kurzFingerprint(fp: string): string {
  return fp.slice(0, 16);
}
