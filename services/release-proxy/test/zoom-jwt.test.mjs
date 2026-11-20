// Zoom-JWT im Worker signieren, byte-gleich zu buildJwt (Anmeldung Teil 2, Aufgabe 5; Spec "Zoom-JWT", OT2, RF4).
//   node --experimental-strip-types services/release-proxy/test/zoom-jwt.test.mjs
// Die Gegenprobe ist die Connect-Umsetzung packages/zoom-bridge/src/jwt.ts (Node-crypto); der Worker nimmt Web Crypto.
import { buildJwt } from '../../../packages/zoom-bridge/src/jwt.ts';
import worker from '../worker.js';
import { signiereZoomJwt, zoomZugangBrauchbar, ZOOM_JWT_TTL_S } from '../zoom-jwt.js';
import { zoomJwtLaufzeit } from '../zoom-relay.js';
import { abschluss, check, makeKontoNs, makeRLBindungen, makeUhr, makeWaitCtx, pruefeFaelle, testFreigabe, testSchluessel, testSitzung } from './konto-attrappen.mjs';

// Mitschnitt der Konsole, gesetzt vor dem ersten Aufruf des Workers (T6 G4: kein JWT, keine Freigabe, kein Secret im Log).
// console.log des Harness (Zählung) läuft über das beim Laden von konto-attrappen.mjs gesicherte echte log und landet nicht hier.
const protokoll = [];
for (const art of ['warn', 'log']) console[art] = (...a) => protokoll.push(a.map(String).join(' '));

const JETZT_MS = Date.UTC(2026, 10, 20, 9, 0, 0) + 789;
const teile = (jwt) => jwt.split('.').slice(0, 2).map((t) => JSON.parse(Buffer.from(t, 'base64url').toString('utf8')));

/** Prüft den dritten Teil des JWT per WebCrypto-verify gegen kopf.nutzlast. */
async function hmacGueltig(jwt, secret) {
  const [kopf, nutzlast, sig] = jwt.split('.');
  const schluessel = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  return crypto.subtle.verify('HMAC', schluessel, Buffer.from(sig, 'base64url'), new TextEncoder().encode(`${kopf}.${nutzlast}`));
}

const r = await signiereZoomJwt({ clientId: 'test-id-1234', clientSecret: 'test-secret-5678', jetztMs: JETZT_MS });
const [kopf, nutz] = teile(r.jwt);
check('T5 OT2: Kopf {alg HS256, typ JWT}; Nutzlast genau appKey, iat, exp, tokenExp in dieser Reihenfolge; iat = jetzt − 30 s; exp = tokenExp = iat + 43 200; kein mn, keine role',
  JSON.stringify(kopf) === '{"alg":"HS256","typ":"JWT"}' && JSON.stringify(Object.keys(nutz)) === '["appKey","iat","exp","tokenExp"]'
    && nutz.appKey === 'test-id-1234' && nutz.iat === Math.floor(JETZT_MS / 1000) - 30 && nutz.exp === nutz.iat + ZOOM_JWT_TTL_S
    && nutz.tokenExp === nutz.exp && r.iat === nutz.iat && r.exp === nutz.exp);
const faelle = Array.from({ length: 50 }, (_, i) => ({ name: `Fall ${i}`, id: `test-id-${i}${i % 7 === 0 ? '-ä' : ''}`, secret: `test-secret-${(i * 7919) % 1000}`, ms: JETZT_MS + i * 3_600_123, ttl: 1800 + i * 600 }));
await pruefeFaelle('T5 OT2: byte-gleich zu buildJwt (packages/zoom-bridge/src/jwt.ts)', faelle, async (f) => {
  const w = await signiereZoomJwt({ clientId: f.id, clientSecret: f.secret, jetztMs: f.ms, ttlSeconds: f.ttl });
  return w.jwt === buildJwt({ clientId: f.id, clientSecret: f.secret, now: Math.floor(f.ms / 1000), ttlSeconds: f.ttl }) ? null : 'abweichend';
});
check('T5 OT2: Signatur mit HMAC-SHA256 und dem Secret prüfbar (WebCrypto verify)', await hmacGueltig(r.jwt, 'test-secret-5678'));
check('T5 RF4: zoomZugangBrauchbar: Leerraum am Rand oder innen, leer, kein Text → false; test-id und test-secret → true',
  [[' id', 's'], ['id\n', 's'], ['id', 's\r\n'], ['a b', 's'], ['', 's'], ['id', undefined]].every(([a, b]) => zoomZugangBrauchbar(a, b) === false)
    && zoomZugangBrauchbar('test-id', 'test-secret') === true);
// ── T6: POST /zoom/jwt (zoom-relay.js) ──────────────────────────────────────────────────────────────────────────────────
const KS = testSchluessel();
const uhr = makeUhr();
const ctx = makeWaitCtx();
const jwtEnv = { KONTO_SCHLUESSEL: KS, ZOOM_CLIENT_ID: 'test-id-1234', ZOOM_CLIENT_SECRET: 'test-secret-5678', ...makeRLBindungen(), KONTO_UHR: uhr };
jwtEnv.KONTO = makeKontoNs(jwtEnv);
const post = (kopf, env = jwtEnv, method = 'POST', body = undefined, ip = '9.9.9.9') => worker.fetch(new Request('https://proxy.test/zoom/jwt', { method, headers: { 'CF-Connecting-IP': ip, ...kopf }, ...(body === undefined ? {} : { body }) }), env, ctx);
const fJ = await testFreigabe(KS, { zweck: 'zoom-jwt', ziel: 'meeting-sdk', jetzt: uhr() });
const a = await post({ Authorization: `Bearer ${fJ}` });
const d = await a.json();
check('T6 OT1: POST /zoom/jwt mit Freigabe zoom-jwt → 200 {jwt, exp, gueltigS 43170}, no-store, JWT byte-gleich zu buildJwt',
  a.status === 200 && a.headers.get('cache-control') === 'no-store' && d.gueltigS === 43_170
    && d.jwt === buildJwt({ clientId: 'test-id-1234', clientSecret: 'test-secret-5678', now: Math.floor(uhr() / 1000), ttlSeconds: 43_200 }));
await pruefeFaelle('T6 RF3, R2: Gegenproben an /zoom/jwt', [
  { name: 'GET', r: await post({ Authorization: `Bearer ${fJ}` }, jwtEnv, 'GET'), s: [404, undefined] },
  { name: 'ohne Kopf', r: await post({}), s: [401, 'nicht-angemeldet'] },
  { name: 'alter PROXY_KEY', r: await post({ 'X-Proxy-Key': 'test-proxy-key' }, { ...jwtEnv, PROXY_KEY: 'test-proxy-key' }), s: [401, 'nicht-angemeldet'] },
  { name: 'Sitzung', r: await post({ Authorization: `Bearer ${await testSitzung(KS, { jetzt: uhr() })}` }), s: [403, 'keine-freigabe'] },
  { name: 'Freigabe zoom-sdk', r: await post({ Authorization: `Bearer ${await testFreigabe(KS, { zweck: 'zoom-sdk', ziel: 'win-x64', jetzt: uhr() })}` }), s: [403, 'kein-recht'] },
  { name: 'Freigabe connect-raum mit Ziel meeting-sdk', r: await post({ Authorization: `Bearer ${await testFreigabe(KS, { zweck: 'connect-raum', ziel: 'meeting-sdk', jetzt: uhr() })}` }), s: [403, 'kein-recht'] },
  { name: 'zoom-jwt mit anderem Ziel', r: await post({ Authorization: `Bearer ${await testFreigabe(KS, { zweck: 'zoom-jwt', ziel: 'x-anders', jetzt: uhr() })}` }), s: [403, 'keine-freigabe'] },
], async (x) => (x.r.status === x.s[0] && (x.s[1] === undefined || (await x.r.json()).code === x.s[1]) ? null : `ist ${x.r.status}`));
const vorRf4 = protokoll.length;
await pruefeFaelle('T6 RF4: Secret fehlt oder mit Leerraum → 503 nicht-eingerichtet, Logzeile nennt nur die Namen', [
  { name: 'ID fehlt', env: { ZOOM_CLIENT_ID: undefined } }, { name: 'Secret mit Zeilenumbruch', env: { ZOOM_CLIENT_SECRET: 'test-secret-5678\n' } },
  { name: 'ID mit Leerzeichen vorn', env: { ZOOM_CLIENT_ID: ' test-id-1234' } },
], async (x) => { const r = await post({ Authorization: `Bearer ${fJ}` }, { ...jwtEnv, ...x.env }); return r.status === 503 && (await r.json()).code === 'nicht-eingerichtet' ? null : `ist ${r.status}`; });
const warnRf4 = protokoll.slice(vorRf4).filter((z) => z.startsWith('zoom-jwt:'));
check('T6 RF4: … Warnung „zoom-jwt: Secret ZOOM_CLIENT_ID oder ZOOM_CLIENT_SECRET fehlt oder hat Leerraum“, ohne Wert',
  warnRf4.length === 3 && warnRf4.every((z) => z === 'zoom-jwt: Secret ZOOM_CLIENT_ID oder ZOOM_CLIENT_SECRET fehlt oder hat Leerraum')
    && !protokoll.slice(vorRf4).join('\n').includes('test-secret-5678') && !protokoll.slice(vorRf4).join('\n').includes('test-id-1234'));
const kurz = await post({ Authorization: `Bearer ${fJ}`, 'content-type': 'application/json' }, jwtEnv, 'POST', '{"ttlS":1860}');
const dk = await kurz.json();
check('T6 E9, M4: Rumpf {ttlS 1860} → 200, gueltigS 1830, JWT byte-gleich zu buildJwt mit ttlSeconds 1860',
  kurz.status === 200 && dk.gueltigS === 1830 && dk.jwt === buildJwt({ clientId: 'test-id-1234', clientSecret: 'test-secret-5678', now: Math.floor(uhr() / 1000), ttlSeconds: 1860 }));
check('T6 E9: zoomJwtLaufzeit: leer und {} → 43200; 1800 und 43200 gelten; 1799, 43201, 1860.5, "1860", kein JSON → null',
  zoomJwtLaufzeit('') === 43_200 && zoomJwtLaufzeit('{}') === 43_200 && zoomJwtLaufzeit('{"ttlS":1800}') === 1800 && zoomJwtLaufzeit('{"ttlS":43200}') === 43_200
    && ['{"ttlS":1799}', '{"ttlS":43201}', '{"ttlS":1860.5}', '{"ttlS":"1860"}', 'kein json'].every((t) => zoomJwtLaufzeit(t) === null));
await ctx.fertig();
const eintraege = () => [...jwtEnv.KONTO.speicher().ctx.daten.values()].filter((e) => e && e.was === 'zoom-jwt');
const vorBad = eintraege().length;
const schlecht = await post({ Authorization: `Bearer ${fJ}`, 'content-type': 'application/json' }, jwtEnv, 'POST', '{"ttlS":1799}');
const ds = await schlecht.json();
await ctx.fertig();
check('T6 E9: Rumpf {ttlS 1799} → 400 ungueltige-laufzeit, kein JWT, kein Protokolleintrag',
  schlecht.status === 400 && ds.code === 'ungueltige-laufzeit' && ds.error === 'ungültige Laufzeit' && ds.jwt === undefined && eintraege().length === vorBad);
check('T6 R2: nach ctx.fertig() genau ein Protokolleintrag zoom-jwt mit kid k-test und gid g-test',
  [a, kurz].filter((r) => r.status === 200).length === 2 && vorBad === 2 && eintraege().length === 2 && eintraege().every((e) => e.details && e.details.kid === 'k-test' && e.details.gid === 'g-test'));
// Drossel: eigene Zähler, damit die übrigen Fälle sie nicht stören.
const rlEnv = { ...jwtEnv, ...makeRLBindungen() };
const rlCodes = [];
let letzte = null;
for (let i = 0; i < 31; i++) { letzte = await post({ Authorization: `Bearer ${fJ}` }, rlEnv, 'POST', undefined, '7.7.7.7'); rlCodes.push(letzte.status); }
const andereIp = await post({ Authorization: `Bearer ${fJ}` }, rlEnv, 'POST', undefined, '7.7.7.8');
const vorOhne = protokoll.length;
const ohneBindung = await post({ Authorization: `Bearer ${fJ}` }, { ...jwtEnv, KONTO_RL_ZOOMJWT: undefined });
check('T6 R2: Drossel KONTO_RL_ZOOMJWT: 31. Anfrage je IP → 429 Retry-After 60; ohne Bindung Warnung und offen',
  rlCodes.slice(0, 30).every((s) => s === 200) && rlCodes[30] === 429 && letzte.headers.get('Retry-After') === '60' && (await letzte.json()).code === 'zu-viele'
    && andereIp.status === 200 && ohneBindung.status === 200 && protokoll.slice(vorOhne).some((z) => z.includes('KONTO_RL_ZOOMJWT')));
// Der Konten-DO wirft beim Protokoll: trotzdem 200, Warnung nur mit dem Fehlernamen.
const kaputt = { ...jwtEnv, KONTO: { idFromName: (n) => n, jurisdiction() { return this; }, get() { return { async fetch() { throw new TypeError('GEHEIM-meldung-xyz'); } }; } } };
const vorDo = protokoll.length;
const ctxK = makeWaitCtx();
const rk = await worker.fetch(new Request('https://proxy.test/zoom/jwt', { method: 'POST', headers: { 'CF-Connecting-IP': '6.6.6.6', Authorization: `Bearer ${fJ}` } }), kaputt, ctxK);
const dkaputt = await rk.json();
await ctxK.fertig();
const warnDo = protokoll.slice(vorDo).filter((z) => z.startsWith('zoom-jwt:'));
check('T6: Konten-DO wirft beim Protokoll → trotzdem 200, Warnung nur mit dem Fehlernamen',
  rk.status === 200 && typeof dkaputt.jwt === 'string' && warnDo.length === 1 && warnDo[0].includes('TypeError') && !warnDo[0].includes('GEHEIM')
    && !protokoll.join('\n').includes('GEHEIM'));
check('T6 G4: weder JWT noch Freigabe noch Secret im Mitschnitt der Konsole', !protokoll.join('\n').includes(d.jwt) && !protokoll.join('\n').includes('test-secret-5678') && !protokoll.join('\n').includes(fJ));
abschluss();
