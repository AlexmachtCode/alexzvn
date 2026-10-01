// Testzertifikate — KEIN Secret, nur für die Selbsttests.
import { generateKeyPairSync, X509Certificate } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { createSecureContext } from 'node:tls';
import selfsigned from 'selfsigned';

export interface TestZertifikat {
  cert: string;
  key: string;
}

/** Wie die Master-Identität (Spec 3.5): 2048/sha256, 10 Jahre, zurückdatiert. */
export function erzeugeTestZertifikat(): TestZertifikat {
  // GEMESSEN: selfsigned 2.4.1/node-forge 1.4.0 kodiert eine Seriennummer 00 00 xx (≈1/65536) nicht minimal;
  // X509Certificate und createSecureContext werfen dann ERR_OSSL_ASN1_ILLEGAL_PADDING → neu erzeugen.
  for (let versuch = 1; ; versuch++) {
    const p = selfsigned.generate([{ name: 'commonName', value: 'jm-master-link' }], {
      days: 3650,
      keySize: 2048,
      algorithm: 'sha256',
      notBeforeDate: new Date(Date.now() - 365 * 24 * 3600 * 1000),
    });
    try {
      new X509Certificate(p.cert);
      createSecureContext({ key: p.private, cert: p.cert });
      return { cert: p.cert, key: p.private };
    } catch (e) {
      if (versuch >= 5) throw e;
    }
  }
}

// selfsigned verweigert notBefore in der Zukunft (gemessen) → für 'uhr'-Tests direkt
// node-forge, das als Abhängigkeit von selfsigned ohnehin installiert ist.
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const forge: any = require(require.resolve('node-forge', { paths: [dirname(require.resolve('selfsigned'))] }));

export function zertifikatMitGueltigkeit(von: Date, bis: Date): TestZertifikat {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  });
  const c = forge.pki.createCertificate();
  c.publicKey = forge.pki.publicKeyFromPem(publicKey);
  c.serialNumber = '01';
  c.validity.notBefore = von;
  c.validity.notAfter = bis;
  const attrs = [{ name: 'commonName', value: 'jm-master-link' }];
  c.setSubject(attrs);
  c.setIssuer(attrs);
  c.sign(forge.pki.privateKeyFromPem(privateKey), forge.md.sha256.create());
  return { cert: forge.pki.certificateToPem(c), key: privateKey };
}
