// Zoom-Meeting-SDK-JWT im Worker signieren (Anmeldung Teil 2, Aufgabe 5; Spec "Zoom-JWT").
// Byte-gleich zu buildJwt in packages/zoom-bridge/src/jwt.ts: Kopf, Nutzlast-Reihenfolge appKey, iat, exp, tokenExp, base64url ohne
// Auffüllung, HMAC-SHA256 über "kopf.nutzlast" mit dem Client-Secret. Nur Web-APIs, keine Importe, keine Konsolenausgabe.

export const ZOOM_JWT_TTL_S = 43_200;
export const ZOOM_JWT_VORLAUF_S = 30;

const enc = new TextEncoder();

function b64url(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Beide Werte sind nicht leere Zeichenketten aus druckbarem ASCII ohne Leerraum (\x21-\x7e). Ein Secret mit Zeilenende aus
 * `wrangler secret put` würde sonst still falsch signieren.
 */
export function zoomZugangBrauchbar(clientId, clientSecret) {
  const ok = (w) => typeof w === 'string' && /^[\x21-\x7e]+$/.test(w);
  return ok(clientId) && ok(clientSecret);
}

export async function signiereZoomJwt({ clientId, clientSecret, jetztMs, ttlSeconds = ZOOM_JWT_TTL_S }) {
  const iat = Math.floor(jetztMs / 1000) - ZOOM_JWT_VORLAUF_S;
  const exp = iat + ttlSeconds;
  const kopf = b64url(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const nutz = b64url(enc.encode(JSON.stringify({ appKey: clientId, iat, exp, tokenExp: exp })));
  const schluessel = await crypto.subtle.importKey('raw', enc.encode(clientSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', schluessel, enc.encode(`${kopf}.${nutz}`)));
  return { jwt: `${kopf}.${nutz}.${b64url(sig)}`, iat, exp };
}
