// Unit-Test der ConnectRoom-DO-Brokering-Logik (Welle 6.1 + 6.2a Rückkanal) mit Mock-SFU + Mock-Sockets.
//   node services/release-proxy/test/connect-do.test.mjs   (Node ≥ 23.6: Type-Stripping default)
//
// Der DO ist eine einfache Klasse → direkt instanziierbar. Wir prüfen den SFU-Publish-/Subscribe-
// Broker (Feldnamen/trackNames, Publish-Zustand, guestPublished/subscribeOffer) UND den Rückkanal
// (peerPublish program-video → returnAvailable → guestWantReturn zieht es in die Gast-Session,
// Doppel-Abo-Guard). Der Browser-Medienpfad (WebCodecs/ontrack) ist hier NICHT abgedeckt.
import { ConnectRoom } from '../connect-relay.js';

let passed = 0;
let failed = 0;
function check(name, cond) {
  if (cond) {
    passed++;
    console.log(`  ok  ${name}`);
  } else {
    failed++;
    console.log(`FAIL  ${name}`);
  }
}
const tick = () => new Promise((r) => setTimeout(r, 0));

function mockWs(tags, attachment = {}) {
  const sent = [];
  return { __tags: tags, sent, send: (s) => sent.push(JSON.parse(s)), serializeAttachment() {}, deserializeAttachment: () => attachment, close() {} };
}

function makeCtx(sockets) {
  const store = new Map();
  return {
    storage: {
      async get(k) { return store.get(k); },
      async put(k, v) { store.set(k, v); },
      async deleteAll() { store.clear(); },
      async deleteAlarm() {},
      async setAlarm() {},
    },
    acceptWebSocket() {},
    getWebSockets(tag) { return tag ? sockets.filter((s) => (s.__tags || []).includes(tag)) : sockets; },
    blockConcurrencyWhile(fn) { return fn(); },
  };
}

function mockSfu(calls) {
  return {
    async newSession() { calls.push(['newSession']); return { sessionId: 'sess-X' }; },
    async publish(sid, offer, tracks) { calls.push(['publish', sid, tracks]); return { answer: { type: 'answer', sdp: 'a' }, tracks }; },
    async subscribe(sid, tracks) {
      calls.push(['subscribe', sid, tracks]);
      return { requiresImmediateRenegotiation: true, offer: { type: 'offer', sdp: 'o' }, tracks: tracks.map((t, i) => ({ ...t, mid: String(i) })) };
    },
    async renegotiate(sid, ans) { calls.push(['renegotiate', sid, ans]); },
    async closeTracks(sid, names) { calls.push(['closeTracks', sid, names]); },
  };
}

const approvedGuest = { id: 'g1', name: 'Alex', phase: 'approved', tally: 'preview', consentAt: 1, muted: false, hasVideo: true, hasScreen: false, joinedAt: 0 };

async function run() {
  const opSocket = mockWs(['operator']);
  const guestSocket = mockWs(['guest', 'g1']);
  const room = new ConnectRoom(makeCtx([opSocket, guestSocket]), {});
  await tick();
  room.meta = { secretHex: 'aa', consentText: '', retentionSec: 1000, createdAt: 0 };
  room.state = { room: 'r', guests: [approvedGuest], standbyId: null, talkback: { mode: 'off', target: null } };
  const calls = [];
  room._sfuOverride = mockSfu(calls);

  // ── Publish: Gast-Offer mit mid+kind → benannte lokale Tracks, Publish-Zustand, guestPublished ──
  await room.publishGuest(guestSocket, 'g1', { type: 'offer', sdp: 'x' }, [{ mid: '0', kind: 'video' }, { mid: '1', kind: 'audio' }]);

  const pubCall = calls.find((c) => c[0] === 'publish');
  check('publish gerufen', !!pubCall);
  check('publish: lokale Tracks mit trackName g1-video/g1-audio', JSON.stringify(pubCall[2]) === JSON.stringify([
    { location: 'local', mid: '0', trackName: 'g1-video' },
    { location: 'local', mid: '1', trackName: 'g1-audio' },
  ]));
  check('Gast erhält answer', guestSocket.sent.some((m) => m.t === 'answer'));
  check('Operator erhält guestPublished', opSocket.sent.some((m) => m.t === 'guestPublished' && m.guestId === 'g1'));
  const pub = room.pub.get('g1');
  check('Publish-Zustand: sessionId gemerkt', pub && pub.sessionId === 'sess-X');
  check('Publish-Zustand: 2 Tracks (video/audio)', pub && pub.tracks.length === 2 && pub.tracks[0].kind === 'video' && pub.tracks[1].kind === 'audio');

  // ── Subscribe: Peer zieht den Gast → remote-Tracks mit richtiger sessionId, subscribeOffer ──
  const peerSocket = mockWs(['operator']);
  await room.peerSubscribe(peerSocket, 'peer-sess', 'g1');
  const subCall = calls.find((c) => c[0] === 'subscribe');
  check('subscribe gerufen mit peer-Session', subCall && subCall[1] === 'peer-sess');
  check('subscribe: remote-Tracks mit sessionId sess-X', JSON.stringify(subCall[2]) === JSON.stringify([
    { location: 'remote', sessionId: 'sess-X', trackName: 'g1-video' },
    { location: 'remote', sessionId: 'sess-X', trackName: 'g1-audio' },
  ]));
  const offerMsg = peerSocket.sent.find((m) => m.t === 'subscribeOffer');
  check('Peer erhält subscribeOffer für g1', offerMsg && offerMsg.guestId === 'g1');
  // Der Trackname wandert seit 6.3 mit: der Peer hakt damit ab, was er schon gezogen hat.
  check('subscribeOffer: mid→Name/kind-Korrelation (video/audio)', offerMsg && JSON.stringify(offerMsg.tracks) === JSON.stringify([
    { mid: '0', name: 'g1-video', kind: 'video' },
    { mid: '1', name: 'g1-audio', kind: 'audio' },
  ]));

  // ── Rückkanal 6.2a: Peer publisht program-video → returnAvailable; Gast zieht es in seine Session ──
  const progPeer = mockWs(['operator']);
  await room.peerPublish(progPeer, 'peer-sess', { type: 'offer', sdp: 'po' }, [{ mid: '0', trackName: 'program-video' }]);
  const progPub = calls.find(
    (c) => c[0] === 'publish' && JSON.stringify(c[2]) === JSON.stringify([{ location: 'local', mid: '0', trackName: 'program-video' }]),
  );
  check('peerPublish: program-video als lokaler Track', !!progPub);
  check('DO merkt Programm-Track (ret)', room.ret && room.ret.sessionId === 'peer-sess' && room.ret.program === 'program-video');
  check('Peer erhält peerPublished mit answer', progPeer.sent.some((m) => m.t === 'peerPublished' && m.answer));
  check('Gast erhält returnAvailable', guestSocket.sent.some((m) => m.t === 'returnAvailable'));

  // Gast zieht den Programm-Track in seine eigene Publish-Session (sess-X).
  const retBefore = calls.length;
  await room.guestWantReturn(guestSocket, 'g1');
  const retSub = calls.slice(retBefore).find((c) => c[0] === 'subscribe');
  check('wantReturn: subscribe in Gast-Session sess-X', retSub && retSub[1] === 'sess-X');
  check(
    'wantReturn: remote program-video von peer-sess',
    retSub && JSON.stringify(retSub[2]) === JSON.stringify([{ location: 'remote', sessionId: 'peer-sess', trackName: 'program-video' }]),
  );
  check('Gast erhält returnOffer', guestSocket.sent.some((m) => m.t === 'returnOffer'));

  // Doppeltes wantReturn → kein zweites subscribe (retSubs-Guard gegen Doppel-Abo).
  const dupSubs = calls.filter((c) => c[0] === 'subscribe').length;
  await room.guestWantReturn(guestSocket, 'g1');
  check('doppeltes wantReturn → kein erneutes subscribe', calls.filter((c) => c[0] === 'subscribe').length === dupSubs);

  // ── Mix-Minus 6.2b: Peer publisht return-g1-audio → Gast zieht NUR den fehlenden Ton nach ──
  await room.peerPublish(progPeer, 'peer-sess', { type: 'offer', sdp: 'ao' }, [{ mid: '1', trackName: 'return-g1-audio' }]);
  check('peerPublish: return-g1-audio gemerkt', room.ret.audio && room.ret.audio.g1 === 'return-g1-audio');
  check('peerPublish: program bleibt gemerkt', room.ret.program === 'program-video');

  const audioBefore = calls.length;
  await room.guestWantReturn(guestSocket, 'g1');
  const audioSub = calls.slice(audioBefore).find((c) => c[0] === 'subscribe');
  check(
    'wantReturn zieht NUR den noch fehlenden Ton-Track nach',
    audioSub && JSON.stringify(audioSub[2]) === JSON.stringify([{ location: 'remote', sessionId: 'peer-sess', trackName: 'return-g1-audio' }]),
  );
  const audioOffer = guestSocket.sent.filter((m) => m.t === 'returnOffer').pop();
  check('returnOffer für den Ton hat kind=audio', audioOffer && audioOffer.tracks.length && audioOffer.tracks.every((t) => t.kind === 'audio'));

  // Kern-Eigenschaft des Mix-Minus: ein Gast bekommt NIE den Return-Ton eines anderen Gasts.
  const g9 = { ...approvedGuest, id: 'g9' };
  room.state.guests.push(g9);
  room.pub.set('g9', { sessionId: 'sess-Y', tracks: [{ trackName: 'g9-video', kind: 'video' }] });
  const g9ws = mockWs(['guest', 'g9']);
  const isoBefore = calls.length;
  await room.guestWantReturn(g9ws, 'g9');
  const isoSub = calls.slice(isoBefore).find((c) => c[0] === 'subscribe');
  check(
    'Mix-Minus-Isolation: g9 zieht nur program-video, NIE g1s Return-Ton',
    isoSub && JSON.stringify(isoSub[2]) === JSON.stringify([{ location: 'remote', sessionId: 'peer-sess', trackName: 'program-video' }]),
  );

  // tearDown räumt den Rückkanal des Gasts ab (Rejoin zieht frisch).
  room.dispatch({ t: 'tearDownNdi', guestId: 'g1' });
  check('tearDown entfernt g1s Return-Ton-Referenz', !room.ret.audio.g1);
  check('tearDown vergisst g1s Rückkanal-Abos', !room.retSubs.has('g1'));

  // ── Warteraum-Gate: nicht freigegebener Gast darf NICHT publishen ──
  const lobbyGuest = { ...approvedGuest, id: 'g2', phase: 'lobby' };
  room.state.guests.push(lobbyGuest);
  const g2ws = mockWs(['guest', 'g2']);
  const before = calls.length;
  await room.publishGuest(g2ws, 'g2', { type: 'offer', sdp: 'y' }, [{ mid: '0', kind: 'video' }]);
  check('Warteraum-Gate: lobby-Gast → kein SFU-Publish', calls.length === before && g2ws.sent.some((m) => m.t === 'error' && m.code === 'not_approved'));

  // ── SFU nicht konfiguriert (kein Override, kein env) → sfu_not_configured ──
  room._sfuOverride = null;
  const g3 = { ...approvedGuest, id: 'g3' };
  room.state.guests.push(g3);
  const g3ws = mockWs(['guest', 'g3']);
  await room.publishGuest(g3ws, 'g3', { type: 'offer', sdp: 'z' }, [{ mid: '0', kind: 'video' }]);
  check('ohne SFU-Config → sfu_not_configured', g3ws.sent.some((m) => m.t === 'error' && m.code === 'sfu_not_configured'));

  // ── Talkback-Fail-Safe (6.2c): der Zustand wird persistiert. Stirbt die Operator-App, während
  //    jemand die Sprechtaste hält, stünde sonst ein heißes Regie-Mikro im Raum. ──
  const tbOp = mockWs(['operator'], { scope: 'operator' });
  const tbRoom = new ConnectRoom(makeCtx([tbOp]), {});
  await tick();
  tbRoom.state = { room: 'r', guests: [approvedGuest], standbyId: null, talkback: { mode: 'all', target: null } };
  tbRoom.webSocketClose(tbOp);
  check('Operator weg → Talkback wird geschlossen', tbRoom.state.talkback.mode === 'off');

  // Ein gehender GAST darf das Talkback der Regie hingegen nicht abschalten.
  const tbOp2 = mockWs(['operator'], { scope: 'operator' });
  const tbGuest = mockWs(['guest', 'g1'], { scope: 'guest', guestId: 'g1' });
  const tbRoom2 = new ConnectRoom(makeCtx([tbOp2, tbGuest]), {});
  await tick();
  tbRoom2.state = { room: 'r', guests: [approvedGuest], standbyId: null, talkback: { mode: 'all', target: null } };
  tbRoom2.webSocketClose(tbGuest);
  check(
    'Gast weg → Talkback bleibt an, Gast gilt als getrennt',
    tbRoom2.state.talkback.mode === 'all' && tbRoom2.state.guests[0].phase === 'disconnected',
  );

  // ── Welle 6.3: geteilter Bildschirm als EIGENE Quelle ──────────────────────────────────────
  const scOp = mockWs(['operator'], { scope: 'operator' });
  const scGuest = mockWs(['guest', 'g1'], { scope: 'guest', guestId: 'g1' });
  const scRoom = new ConnectRoom(makeCtx([scOp, scGuest]), {});
  await tick();
  scRoom.state = { room: 'r', guests: [{ ...approvedGuest }], standbyId: null, talkback: { mode: 'off', target: null } };
  const scCalls = [];
  scRoom._sfuOverride = mockSfu(scCalls);

  await scRoom.publishGuest(scGuest, 'g1', { type: 'offer', sdp: 'x' }, [{ mid: '0', kind: 'video' }, { mid: '1', kind: 'audio' }]);
  const published = scOp.sent.find((m) => m.t === 'guestPublished');
  check('guestPublished nennt die Tracknamen (Peer zieht später gezielt nach)',
    !!published && published.tracks.join(',') === 'g1-video,g1-audio');

  // Bildschirm kommt MITTEN im Betrieb dazu: gleicher Session, eigener Trackname.
  scCalls.length = 0;
  scOp.sent.length = 0;
  await scRoom.guestAddScreen(scGuest, 'g1', { type: 'offer', sdp: 'scr' }, [{ mid: '2', kind: 'screen' }]);
  const scPubCall = scCalls.find((c) => c[0] === 'publish');
  check('addScreen publisht auf die BESTEHENDE Session als g1-screen',
    !!scPubCall && scPubCall[1] === 'sess-X' && scPubCall[2].length === 1 && scPubCall[2][0].trackName === 'g1-screen');
  check('addScreen setzt hasScreen', scRoom.state.guests[0].hasScreen === true);
  const upNdi = scOp.sent.find((m) => m.t === 'ndi' && m.action === 'up' && m.stream === 'screen');
  check('addScreen → zweiter NDI-Sender „(Bildschirm)"', !!upNdi && /\(Bildschirm\)$/.test(upNdi.label));

  // Der Peer zieht NUR den neuen Track nach — sonst läge das Kamerabild doppelt in seiner Session.
  scCalls.length = 0;
  await scRoom.peerSubscribe(scOp, 'peer-1', 'g1', ['g1-screen']);
  const scSubCall = scCalls.find((c) => c[0] === 'subscribe');
  check('only-Subscribe zieht ausschließlich g1-screen',
    !!scSubCall && scSubCall[2].length === 1 && scSubCall[2][0].trackName === 'g1-screen');
  const scOffer = scOp.sent.filter((m) => m.t === 'subscribeOffer').pop();
  check('subscribeOffer trägt Name + kind=screen',
    !!scOffer && scOffer.tracks[0].name === 'g1-screen' && scOffer.tracks[0].kind === 'screen');

  // Teilen beenden: Track schließen, Bildschirm-Quelle abräumen — Kamera/Publish bleiben.
  scCalls.length = 0;
  scOp.sent.length = 0;
  await scRoom.guestStopScreen('g1');
  const closed = scCalls.find((c) => c[0] === 'closeTracks');
  check('stopScreen schließt g1-screen an der SFU', !!closed && closed[2].join(',') === 'g1-screen');
  check('stopScreen räumt NUR den Bildschirm ab, der Gast publisht weiter',
    scRoom.pub.has('g1') && scRoom.pub.get('g1').tracks.every((t) => t.trackName !== 'g1-screen'));
  const downNdi = scOp.sent.find((m) => m.t === 'ndi' && m.action === 'down');
  check('stopScreen → nur die Bildschirm-Quelle wird gestoppt', !!downNdi && downNdi.stream === 'screen');
  check('stopScreen meldet den Gast NICHT als unpublished', !scOp.sent.some((m) => m.t === 'guestUnpublished'));

  // ── Welle 6.3c: Folien-Fernbedienung des Sprechers ────────────────────────────────────────
  const slOp = mockWs(['operator'], { scope: 'operator' });
  const slGuest = mockWs(['guest', 'g1'], { scope: 'guest', guestId: 'g1' });
  const slRoom = new ConnectRoom(makeCtx([slOp, slGuest]), {});
  await tick();
  slRoom.state = { room: 'r', guests: [{ ...approvedGuest }], standbyId: null, talkback: { mode: 'off', target: null } };

  const slAtt = { scope: 'guest', guestId: 'g1' };
  // Die Drossel greift VOR der Rechteprüfung — sie zählt jede Nachricht, auch eine abgelehnte.
  // Das ist Absicht (ein bösartiger Client soll den DO nicht mit Broadcasts fluten); die Tests
  // setzen sie deshalb zwischen den Phasen zurück.
  const noThrottle = () => slRoom.lastCue.clear();

  // Ohne Freigabe passiert nichts — das Gate sitzt im Reducer, nicht in der Gast-Oberfläche.
  slRoom.onGuest(slGuest, slAtt, { t: 'slide', dir: 'next' });
  check('ohne Freigabe → kein Folien-Cue an die Operator-App', !slOp.sent.some((m) => m.t === 'cue'));

  slRoom.onOperator(slOp, { t: 'slides', guestId: 'g1', on: true });
  noThrottle();
  slOp.sent.length = 0;
  slRoom.onGuest(slGuest, slAtt, { t: 'slide', dir: 'prev' });
  const cue = slOp.sent.find((m) => m.t === 'cue');
  check('mit Freigabe → cue kind=slide dir=prev an die Operator-App', !!cue && cue.kind === 'slide' && cue.dir === 'prev');
  check('der Gast erfährt seine Freigabe über `you.slides`', slGuest.sent.some((m) => m.t === 'you' && m.slides === true));

  // Drossel: ein hängender Finger darf nicht den ganzen Foliensatz durchblättern.
  noThrottle();
  slOp.sent.length = 0;
  slRoom.onGuest(slGuest, slAtt, { t: 'slide', dir: 'next' });
  slRoom.onGuest(slGuest, slAtt, { t: 'slide', dir: 'next' });
  slRoom.onGuest(slGuest, slAtt, { t: 'slide', dir: 'next' });
  check('Drossel: drei Kommandos in Folge → genau ein Cue', slOp.sent.filter((m) => m.t === 'cue').length === 1);

  // Unbekannte Richtung wird auf 'next' normalisiert, nicht durchgereicht.
  noThrottle();
  slOp.sent.length = 0;
  slRoom.onGuest(slGuest, slAtt, { t: 'slide', dir: 'RÜCKWÄRTS; DROP TABLE' });
  const norm = slOp.sent.find((m) => m.t === 'cue');
  check('unbekannte Richtung → auf next normalisiert', !!norm && norm.dir === 'next');

  // Entzug wirkt sofort.
  slRoom.onOperator(slOp, { t: 'slides', guestId: 'g1', on: false });
  noThrottle();
  slOp.sent.length = 0;
  slRoom.onGuest(slGuest, slAtt, { t: 'slide', dir: 'next' });
  check('entzogene Freigabe → kein Cue mehr', !slOp.sent.some((m) => m.t === 'cue'));
}

run()
  .then(() => {
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed ? 1 : 0);
  })
  .catch((e) => {
    console.error('Test-Harness-Fehler:', e);
    process.exit(1);
  });
