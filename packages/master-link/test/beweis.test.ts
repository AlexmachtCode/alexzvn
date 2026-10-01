import { createHmac, generateKeyPairSync, sign, X509Certificate } from 'node:crypto';
import { certFingerprint } from '@jm/auth-core';
import { abschnitt, gleich, pruefe } from './helfer';
import { erzeugeTestZertifikat } from './zertifikate';
import {
  derZuPem, erzeugeSchluesselpaar, fingerprintVonPem, gleicherBeweis, istEd25519Oeffentlich, istEd25519Privat,
  kurzFingerprint, masterBeweis, pruefeAnmeldung, signiereAnmeldung, slaveBeweis, type KoppelDaten,
} from '../src/beweis';

export async function laufe(): Promise<void> {
  abschnitt('Beweise (HMAC)');
  const d: KoppelDaten = { fp: 'ab'.repeat(32), ns: '11'.repeat(16), nc: '22'.repeat(16), rechnerId: 'r-1', schluessel: 'P' };
  const code = 'K7QXM3PRTH';
  const erwartetSlave = createHmac('sha256', code)
    .update(`jm-master-link/1/koppeln/slave|${d.fp}|${d.ns}|${d.nc}|${d.rechnerId}|${d.schluessel}`)
    .digest('hex');
  gleich(slaveBeweis(code, d), erwartetSlave, 'Slave-Beweis = HMAC über die Felder in Spec-Reihenfolge');
  const erwartetMaster = createHmac('sha256', code)
    .update(`jm-master-link/1/koppeln/master|${d.fp}|${d.ns}|${d.nc}|${d.rechnerId}|${d.schluessel}|M-1`)
    .digest('hex');
  gleich(masterBeweis(code, d, 'M-1'), erwartetMaster, 'Master-Beweis enthält masterId');
  pruefe(slaveBeweis(code, d) !== masterBeweis(code, d, 'M-1'), 'Slave- und Master-Beweis unterscheiden sich');
  pruefe(slaveBeweis(code, { ...d, fp: 'cd'.repeat(32) }) !== erwartetSlave, 'anderer Fingerprint → anderer Beweis (Mittelsmann)');
  pruefe(slaveBeweis(code, { ...d, schluessel: 'Q' }) !== erwartetSlave, 'anderer Schlüssel → anderer Beweis');
  pruefe(gleicherBeweis(erwartetSlave, erwartetSlave), 'gleicherBeweis: gleicher Wert → true');
  pruefe(!gleicherBeweis(erwartetSlave, erwartetSlave.slice(0, 10)), 'gleicherBeweis: falsche Länge → false');
  pruefe(!gleicherBeweis(erwartetSlave, 'zz'.repeat(32)), 'gleicherBeweis: kein Hex → false');
  pruefe(!gleicherBeweis(erwartetSlave, 42), 'gleicherBeweis: kein String → false');

  abschnitt('Ed25519');
  const paar = erzeugeSchluesselpaar();
  gleich(paar.oeffentlich.length, 60, 'öffentlicher Schlüssel SPKI-DER base64 = 60 Zeichen');
  gleich(paar.privat.length, 64, 'privater Schlüssel PKCS8-DER base64 = 64 Zeichen');
  pruefe(istEd25519Oeffentlich(paar.oeffentlich), 'eigener öffentlicher Schlüssel ist Ed25519');
  const sig = signiereAnmeldung(paar.privat, d.fp, d.ns, 'r-1');
  pruefe(pruefeAnmeldung(paar.oeffentlich, d.fp, d.ns, 'r-1', sig), 'Signatur prüft');
  pruefe(!pruefeAnmeldung(paar.oeffentlich, d.fp, '33'.repeat(16), 'r-1', sig), 'alte Signatur mit neuer Nonce → false (keine Wiederholung)');
  pruefe(!pruefeAnmeldung(paar.oeffentlich, 'cd'.repeat(32), d.ns, 'r-1', sig), 'Signatur gilt nicht bei anderem Master (fp)');
  pruefe(!pruefeAnmeldung(paar.oeffentlich, d.fp, d.ns, 'r-2', sig), 'Signatur gilt nicht für andere rechnerId');
  pruefe(!pruefeAnmeldung(erzeugeSchluesselpaar().oeffentlich, d.fp, d.ns, 'r-1', sig), 'fremder Schlüssel → false');
  pruefe(!pruefeAnmeldung(paar.oeffentlich, d.fp, d.ns, 'r-1', 'kurz'), 'kaputte Signatur → false, kein Wurf');
  pruefe(!pruefeAnmeldung('AAAA', d.fp, d.ns, 'r-1', sig), 'Müll-Schlüssel → false, kein Wurf');
  pruefe(!pruefeAnmeldung(paar.oeffentlich, d.fp, d.ns, 'r-1', undefined), 'fehlende Signatur → false');
  const rsaPaar = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const rsa = rsaPaar.publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  pruefe(!istEd25519Oeffentlich(rsa), 'RSA-SPKI wird nicht als Ed25519 angenommen');
  // Mit einer ECHTEN RSA-Signatur über denselben Text — ohne Typzwang ginge verify(null) durch (gemessen).
  const rsaSig = sign(null, Buffer.from(`jm-master-link/1/anmelden|${d.fp}|${d.ns}|r-1`, 'utf8'), rsaPaar.privateKey).toString('base64');
  pruefe(!pruefeAnmeldung(rsa, d.fp, d.ns, 'r-1', rsaSig), 'RSA-Schlüssel mit gültiger RSA-Signatur → false (Typ erzwungen)');
  pruefe(!istEd25519Oeffentlich('QUJD|RA=='), 'Nicht-base64-Zeichen → false');
  // Node überliest „|“ beim Dekodieren (gemessen): nur die base64-Prüfung weist das ab.
  pruefe(!istEd25519Oeffentlich(`${paar.oeffentlich.slice(0, 20)}|${paar.oeffentlich.slice(20)}`), 'gültiger Schlüssel mit eingeschobenem „|“ → false');
  pruefe(istEd25519Privat(paar.privat), 'eigener privater Schlüssel ist Ed25519');
  // GEMESSEN: 'AAAA' und abgeschnittene Schlüssel lassen signiereAnmeldung werfen; RSA-PKCS8 signiert, aber nicht Ed25519.
  const rsaPrivat = rsaPaar.privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64');
  gleich([istEd25519Privat('AAAA'), istEd25519Privat(paar.privat.slice(0, 40)), istEd25519Privat(rsaPrivat), istEd25519Privat(undefined)],
    [false, false, false, false], 'privat: Müll, abgeschnitten, RSA-PKCS8, kein Text → kein Ed25519');

  abschnitt('Zertifikat und Fingerprint');
  const z = erzeugeTestZertifikat();
  const x = new X509Certificate(z.cert);
  const pem = derZuPem(x.raw);
  gleich(fingerprintVonPem(pem), certFingerprint(z.cert), 'PEM aus DER hat denselben Fingerprint');
  pruefe(pem.startsWith('-----BEGIN CERTIFICATE-----\n') && !pem.includes('\r'), 'PEM aus DER mit LF');
  gleich(kurzFingerprint(fingerprintVonPem(pem)).length, 16, 'Kurz-Fingerprint = 16 Zeichen');
  pruefe(new Date(x.validFrom).getTime() < Date.now() - 300 * 24 * 3600 * 1000, 'Testzertifikat ist zurückdatiert');
  gleich(x.publicKey.asymmetricKeyDetails?.modulusLength, 2048, 'Testzertifikat RSA-2048');
}
