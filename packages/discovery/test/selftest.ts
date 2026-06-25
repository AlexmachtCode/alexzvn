// Mini-Selbsttest (kein Framework): node --experimental-strip-types test/selftest.ts
// Deckt die mDNS-Annoncen-Signatur ab (reines node:crypto, kein bonjour-Import).
import { signAdvertisement, verifyAdvertisement } from '../src/sign.ts';

let failed = 0;
function ok(cond: boolean, msg: string): void {
  if (cond) console.log(`ok   ${msg}`);
  else {
    failed++;
    console.error(`FAIL ${msg}`);
  }
}

const id = { appId: 'jm-timer', role: 'timer', port: 8724 };
const KEY = 'pairing-secret';

const sig = signAdvertisement(KEY, id);
ok(/^[0-9a-f]{64}$/.test(sig), 'signAdvertisement: HMAC-SHA256 hex');
ok(signAdvertisement(KEY, id) === sig, 'signAdvertisement deterministisch');
ok(verifyAdvertisement(KEY, id, sig) === true, 'verifyAdvertisement akzeptiert gültige Signatur');
ok(verifyAdvertisement('falsch', id, sig) === false, 'verifyAdvertisement lehnt falschen Key ab');
ok(verifyAdvertisement(KEY, { ...id, port: 9999 }, sig) === false, 'verifyAdvertisement lehnt manipulierten Port ab (Spoofing)');
ok(verifyAdvertisement(KEY, { ...id, appId: 'jm-fake' }, sig) === false, 'verifyAdvertisement lehnt manipulierte appId ab');
ok(verifyAdvertisement(KEY, id, undefined) === false, 'verifyAdvertisement lehnt fehlende Signatur ab (unsignierte Annonce)');
ok(verifyAdvertisement(KEY, id, 'nicht-hex') === false, 'verifyAdvertisement lehnt Müll-Signatur ab');

console.log(failed === 0 ? '\nALLE TESTS OK' : `\n${failed} FEHLER`);
process.exit(failed === 0 ? 0 : 1);
