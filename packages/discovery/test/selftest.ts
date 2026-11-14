// Mini-Selbsttest (kein Framework): node --experimental-strip-types test/selftest.ts
// Deckt die mDNS-Annoncen-Signatur ab (reines node:crypto, kein bonjour-Import).
import { readFileSync } from 'node:fs';
import { signAdvertisement, verifyAdvertisement, assessAdvertisement } from '../src/sign.ts';
import { neuesBonjour } from '../src/bonjour.ts';

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

// ── neuesBonjour: mDNS-Fehler dürfen NIE werfen (Absturz 02.11.2026) ───────────
// Echter Weg: respondToQuery → server.mdns.respond(..., cb) → cb(err) → errorCallback.
// bonjour-service wirft dort standardmäßig (`throw err`) → uncaughtException.
const SENDEFEHLER = 'send EHOSTUNREACH 224.0.0.251:5353';
/** Löst über eine echte Anfrage den Sendefehler-Weg aus; liefert, ob geworfen wurde. */
function sendefehlerAusloesen(b: any, fehler: Error): boolean {
  b.server.register({ name: '_jmps._tcp.local', type: 'PTR', ttl: 120, data: 'x._jmps._tcp.local' });
  let respondAufgerufen = false;
  b.server.mdns.respond = (_res: unknown, cb: (e: Error) => void) => {
    respondAufgerufen = true;
    cb(fehler);
  };
  try {
    b.server.respondToQuery({ questions: [{ name: '_jmps._tcp.local', type: 'PTR' }] });
  } catch {
    return true;
  } finally {
    ok(respondAufgerufen, 'Testweg: respond wurde wirklich aufgerufen');
  }
  return false;
}
{
  const fehler = new Error(SENDEFEHLER);
  const empfangen: Error[] = [];
  const b = neuesBonjour((e) => empfangen.push(e));
  ok(!sendefehlerAusloesen(b, fehler), 'neuesBonjour: Sendefehler (respondToQuery) wirft nicht');
  ok(empfangen.length === 1 && empfangen[0] === fehler, 'neuesBonjour: onError bekommt genau diesen Fehler');
  b.destroy();
}
{
  const b = neuesBonjour();
  const alteWarn = console.warn;
  const warnungen: string[] = [];
  console.warn = (m: unknown) => void warnungen.push(String(m));
  const warf = sendefehlerAusloesen(b, new Error(SENDEFEHLER));
  console.warn = alteWarn;
  ok(!warf, 'neuesBonjour ohne onError: wirft nicht');
  ok(warnungen.some((w) => w.includes('[discovery] mDNS-Fehler (ignoriert)') && w.includes('EHOSTUNREACH')), 'neuesBonjour ohne onError: warnt per console.warn');
  b.destroy();
}
{
  const b = neuesBonjour(() => {
    throw new Error('onError selbst kaputt');
  });
  ok(!sendefehlerAusloesen(b, new Error(SENDEFEHLER)), 'neuesBonjour: werfender onError dringt nicht nach außen');
  b.destroy();
}
// Zweiter Weg: multicast-dns emittiert 'error' bei EACCES/EADDRINUSE/Bind-Fehlern; ohne
// Listener ist das eine uncaughtException (z. B. Port 5353 belegt/blockiert).
{
  const fehler = new Error('bind EADDRINUSE 0.0.0.0:5353');
  const empfangen: Error[] = [];
  const b = neuesBonjour((e) => empfangen.push(e));
  let warf = false;
  try {
    (b as any).server.mdns.emit('error', fehler);
  } catch {
    warf = true;
  }
  ok(!warf, "neuesBonjour: mdns-'error' (EADDRINUSE) wirft nicht");
  ok(empfangen.length === 1 && empfangen[0] === fehler, "neuesBonjour: onError bekommt den mdns-'error'");
  b.destroy();
}
{
  const b = neuesBonjour();
  const alteWarn = console.warn;
  console.warn = () => {};
  let warf = false;
  try {
    (b as any).server.mdns.emit('error', new Error('bind EADDRINUSE 0.0.0.0:5353'));
  } catch {
    warf = true;
  }
  console.warn = alteWarn;
  ok(!warf, "neuesBonjour ohne onError: mdns-'error' wirft nicht");
  b.destroy();
}
// Durchreichen: advertise()/discover() müssen ihr opts.onError an neuesBonjour geben
// (die Instanz ist von außen nicht greifbar → Quelltext-Check beider Aufrufstellen).
{
  const quelle = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');
  ok((quelle.match(/neuesBonjour\(opts\.onError\)/g) ?? []).length === 2, 'advertise() und discover() übergeben opts.onError an neuesBonjour');
  ok(!/new Bonjour\(/.test(quelle), 'index.ts erzeugt kein ungeschütztes new Bonjour()');
}

console.log(failed === 0 ? '\nALLE TESTS OK' : `\n${failed} FEHLER`);
process.exit(failed === 0 ? 0 : 1);
