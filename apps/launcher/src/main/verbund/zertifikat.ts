import { randomUUID } from 'node:crypto';
import selfsigned from 'selfsigned';
import { kuerzeName, pruefeIdentitaet, type Identitaet } from '@jm/master-link';

/**
 * Master-Identität (Spec 3.5): RSA-2048/SHA-256 (selfsigned nähme sonst RSA-1024/SHA-1),
 * 10 Jahre, um 1 Jahr zurückdatiert — eine nachgehende Slave-Uhr meldete sonst CERT_NOT_YET_VALID.
 * GEMESSEN: selfsigned 2.4.1/node-forge 1.4.0 kodiert eine Seriennummer 00 00 xx (≈1/65536) nicht minimal;
 * OpenSSL lehnt so ein Zertifikat ab (ERR_OSSL_ASN1_ILLEGAL_PADDING), der Master startete nie. Deshalb verlässt
 * nur eine Identität diese Funktion, die pruefeIdentitaet besteht — nur sie wird je geschrieben.
 */
export function erzeugeMasterIdentitaet(name: string): Identitaet {
  for (let versuch = 1; versuch <= 5; versuch++) {
    const p = selfsigned.generate([{ name: 'commonName', value: 'jm-master-link' }], {
      days: 3650,
      keySize: 2048,
      algorithm: 'sha256',
      notBeforeDate: new Date(Date.now() - 365 * 24 * 3600 * 1000),
    });
    const id = pruefeIdentitaet({ masterId: randomUUID(), name: kuerzeName(name), zertifikat: p.cert, schluessel: p.private });
    if (id) return id;
  }
  throw new Error('Master-Identität: kein brauchbares Zertifikat erzeugt');
}
