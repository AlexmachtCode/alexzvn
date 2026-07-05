// Mini-Selbsttest (kein Framework): node --experimental-strip-types test/selftest.ts
// Deckt die mDNS-Annoncen-Signatur ab (reines node:crypto, kein bonjour-Import).
import { signAdvertisement, verifyAdvertisement, assessAdvertisement } from '../src/sign.ts';

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

// ── assessAdvertisement: Zwei-Phasen-Vertrauensentscheidung (A3, #59) ──────────
// Ohne Key (open/keine Prüfung) → immer akzeptieren, verified:true.
{
  const t = assessAdvertisement(undefined, id, sig);
  ok(t.accept && t.verified && t.signed, 'assess ohne Key: akzeptiert, verified, signiert-erkannt');
}
{
  const t = assessAdvertisement(undefined, id, undefined);
  ok(t.accept && t.verified && !t.signed, 'assess ohne Key + ohne sig: akzeptiert (Legacy), signed:false');
}
// Mit Key: gültige Signatur akzeptieren.
{
  const t = assessAdvertisement(KEY, id, sig);
  ok(t.accept && t.verified && t.signed, 'assess mit Key + gültiger sig: akzeptiert + verified');
}
// Mit Key: vorhandene, aber falsche Signatur IMMER verwerfen (Spoof/Manipulation).
{
  const t = assessAdvertisement(KEY, { ...id, port: 9999 }, sig);
  ok(!t.accept && !t.verified && t.signed, 'assess mit Key + manipulierter sig: VERWORFEN (signed, !verified)');
}
{
  const t = assessAdvertisement('falsch', id, sig);
  ok(!t.accept && !t.verified, 'assess mit falschem Key: VERWORFEN');
}
// Mit Key: fehlende Signatur → Phase 1 toleriert, Phase 2 (strict) verworfen.
{
  const t = assessAdvertisement(KEY, id, undefined);
  ok(t.accept && !t.verified && !t.signed, 'assess Phase 1: unsignierte Annonce toleriert (accept, !verified)');
}
{
  const t = assessAdvertisement(KEY, id, '');
  ok(t.accept && !t.signed, 'assess Phase 1: leere sig zählt als unsigniert → toleriert');
}
{
  const t = assessAdvertisement(KEY, id, undefined, true);
  ok(!t.accept && !t.signed, 'assess Phase 2 (strict): unsignierte Annonce VERWORFEN');
}
{
  const t = assessAdvertisement(KEY, id, sig, true);
  ok(t.accept && t.verified, 'assess Phase 2 (strict): gültig signierte weiterhin akzeptiert');
}

console.log(failed === 0 ? '\nALLE TESTS OK' : `\n${failed} FEHLER`);
process.exit(failed === 0 ? 0 : 1);
