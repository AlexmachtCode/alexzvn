// Selbsttest für @jm/rtc — die sicherheitskritischen State-Machine-Gates + Token-Round-Trip.
// Ausführen: `npm run selftest` (im Paket) bzw. `npx tsx test/selftest.ts`.

import { initialRoomState, reduce, onAirGuest, onAirGuests, lobbyCount } from '../src/state';
import { mintJoinToken, verifyJoinToken, randomEventSecret, randomId } from '../src/token';
import type { RoomState, RoomEvent, RoomEffect } from '../src/protocol';

let failures = 0;
function assert(cond: boolean, msg: string): void {
  if (cond) {
    console.log('  ✓', msg);
  } else {
    console.error('  ✗', msg);
    failures++;
  }
}

function apply(state: RoomState, events: RoomEvent[], now = 1000): { state: RoomState; effects: RoomEffect[] } {
  let s = state;
  const all: RoomEffect[] = [];
  for (const ev of events) {
    const r = reduce(s, ev, now);
    s = r.state;
    all.push(...r.effects);
  }
  return { state: s, effects: all };
}

console.log('state machine — Warteraum- & Consent-Gates:');
{
  const s0 = initialRoomState('room-1');

  // Gast joint → lobby, KEINE Publish-Rechte, kein NDI (struktureller Warteraum).
  const r1 = apply(s0, [{ t: 'guestJoin', guestId: 'g1', name: 'Alex' }]);
  assert(r1.state.guests[0].phase === 'lobby', 'join → lobby');
  assert(lobbyCount(r1.state) === 1, 'lobbyCount = 1');
  assert(!r1.effects.some((e) => e.t === 'grantPublish'), 'lobby: kein grantPublish (Warteraum-Gate)');
  assert(!r1.effects.some((e) => e.t === 'spinUpNdi'), 'lobby: kein NDI-Sender');

  // approve → publish + NDI + preview.
  const r2 = apply(r1.state, [{ t: 'approve', guestId: 'g1' }]);
  assert(r2.state.guests[0].phase === 'approved', 'approve → approved');
  assert(r2.effects.some((e) => e.t === 'grantPublish'), 'approve → grantPublish');
  assert(
    r2.effects.some((e) => e.t === 'spinUpNdi' && e.label.startsWith('JM Connect')),
    'approve → spinUpNdi mit NDI-Label',
  );

  // onair OHNE Consent muss blockieren.
  const r3 = apply(r2.state, [{ t: 'onair', guestId: 'g1' }]);
  assert(r3.state.guests[0].phase === 'approved', 'onair ohne Consent bleibt approved (Consent-Gate)');
  assert(
    r3.effects.some((e) => e.t === 'notify' && e.code === 'consentRequired'),
    'onair ohne Consent → consentRequired',
  );

  // Mit Consent → onair.
  const r4 = apply(r3.state, [{ t: 'guestConsent', guestId: 'g1' }, { t: 'onair', guestId: 'g1' }]);
  assert(onAirGuest(r4.state)?.id === 'g1', 'mit Consent → onair');
  assert(r4.effects.some((e) => e.t === 'tally' && e.tally === 'program'), 'onair → tally program');

  // Standby + GO auf einen zweiten (freigegebenen, mit Consent) Gast.
  const r5 = apply(r4.state, [
    { t: 'guestJoin', guestId: 'g2', name: 'Sam' },
    { t: 'approve', guestId: 'g2' },
    { t: 'guestConsent', guestId: 'g2' },
    { t: 'standby', guestId: 'g2' },
    { t: 'go' },
  ]);
  assert(
    r5.state.guests.find((g) => g.id === 'g2')?.phase === 'onair',
    'GO schaltet Standby-Gast g2 on-air',
  );
  assert(onAirGuests(r5.state).length === 2, 'Panel: g1 und g2 gleichzeitig on-air');
  assert(r5.state.standbyId === null, 'nach GO ist Standby geleert');

  // Kick → teardown + revoke.
  const r6 = apply(r5.state, [{ t: 'kick', guestId: 'g2' }]);
  assert(r6.state.guests.find((g) => g.id === 'g2')?.phase === 'kicked', 'kick → kicked');
  assert(r6.effects.some((e) => e.t === 'tearDownNdi'), 'kick → tearDownNdi');
  assert(r6.effects.some((e) => e.t === 'revokePublish'), 'kick → revokePublish');
}

console.log('token — Mint/Verify-Round-Trip:');
await (async () => {
  const secret = randomEventSecret();
  const gid = randomId();
  const tok = await mintJoinToken(secret, { room: 'room-1', guestId: gid, scope: 'guest', exp: 5000 });
  assert((await verifyJoinToken(secret, tok, 1000))?.guestId === gid, 'gültiges Token verifiziert');
  assert((await verifyJoinToken(secret, tok, 6000)) === null, 'abgelaufenes Token abgelehnt');
  assert((await verifyJoinToken(randomEventSecret(), tok, 1000)) === null, 'falsches Secret abgelehnt');
  assert((await verifyJoinToken(secret, tok.slice(0, -2) + 'xx', 1000)) === null, 'manipulierte Signatur abgelehnt');
})();

if (failures) {
  console.error(`\n${failures} Selbsttest(s) fehlgeschlagen.`);
  process.exit(1);
}
console.log('\nAlle @jm/rtc-Selbsttests grün.');
