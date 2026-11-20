// Zoom-JWT im Worker signieren, byte-gleich zu buildJwt (Anmeldung Teil 2, Aufgabe 5; Spec "Zoom-JWT", OT2, RF4).
//   node --experimental-strip-types services/release-proxy/test/zoom-jwt.test.mjs
// Die Gegenprobe ist die Connect-Umsetzung packages/zoom-bridge/src/jwt.ts (Node-crypto); der Worker nimmt Web Crypto.
import { buildJwt } from '../../../packages/zoom-bridge/src/jwt.ts';
import { signiereZoomJwt, zoomZugangBrauchbar, ZOOM_JWT_TTL_S } from '../zoom-jwt.js';
import { abschluss, check, pruefeFaelle } from './konto-attrappen.mjs';

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
abschluss();
