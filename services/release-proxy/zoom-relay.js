// POST /zoom/jwt: das Zoom-Meeting-SDK-JWT für JM Connect (Anmeldung Teil 2, Aufgabe 6; Spec 6.3, Entwurf „Zoom-JWT“, R2).
//
// Connect holt das JWT je Start der Bridge hier ab, statt das Client-Secret zu tragen. Der Worker signiert es (zoom-jwt.js,
// byte-gleich zu buildJwt der Bridge) mit den Worker-Secrets ZOOM_CLIENT_ID und ZOOM_CLIENT_SECRET.
//   • Zugang: nur eine Freigabe mit Zweck zoom-jwt und Ziel meeting-sdk. Weder eine Sitzung noch eine Freigabe zoom-sdk oder
//     connect-raum noch der alte Schlüssel öffnen diese Route (kein Alt-Key-Weg, gruppe null).
//   • Drossel je IP (KONTO_RL_ZOOMJWT), VOR der Zugangsprüfung: mehrere Rechner hinter einer IP, eine Anfrage je Start der Bridge.
//   • Rumpf (E9, nur für den Test M4): optional { "ttlS": n }, ganze Zahl 1800–43 200; ohne Rumpf oder ohne ttlS 43 200.
//   • Je ausgestelltem JWT ein Protokolleintrag im Konten-DO (Konto und Gerät, nie das JWT); scheitert er, bekommt Connect
//     das JWT trotzdem (best effort, nur der Fehlername im Log).
// Nie im Log, in einer Fehlermeldung oder im Protokoll: das JWT, die Freigabe, ID oder Secret.
import { ZIEL_ZOOM_JWT } from './konto-kern.js';
import { drosselBindung, FEHLER_TEXT, kontoAktion, kontoJetzt, KONTO_RL, zugangPruefen } from './konto-zugang.js';
import { signiereZoomJwt, ZOOM_JWT_TTL_S, zoomZugangBrauchbar } from './zoom-jwt.js';

/** Kürzeste und längste Laufzeit, die ein Rumpf anfordern darf (Sekunden; E9). */
const TTL_MIN_S = 1800;
/** Der Rumpf ist höchstens eine Handvoll Zeichen groß; mehr ist keine gültige Anfrage. */
const RUMPF_MAX = 1024;

/**
 * E9: Laufzeit in Sekunden aus dem Rumpftext. Leer oder JSON-Objekt ohne `ttlS` → 43 200; `ttlS` eine ganze Zahl von 1800 bis
 * 43 200 → sie; alles andere (keine Zahl, nicht ganz, außerhalb, kein JSON, kein Objekt) → null.
 */
export function zoomJwtLaufzeit(text) {
  if (typeof text !== 'string' || text.length > RUMPF_MAX) return null;
  if (text.trim() === '') return ZOOM_JWT_TTL_S;
  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    return null;
  }
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return null;
  if (!('ttlS' in obj)) return ZOOM_JWT_TTL_S;
  const n = obj.ttlS;
  return Number.isInteger(n) && n >= TTL_MIN_S && n <= ZOOM_JWT_TTL_S ? n : null;
}

/** Nur der Name eines Fehlers, nie die Meldung. */
function fehlerName(e) {
  return (e && typeof e.name === 'string' && e.name) || 'unbekannt';
}

function json(obj, status = 200, extra = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra },
  });
}

/**
 * Routet `/zoom/jwt`. `null` für jeden anderen Pfad (worker.js macht dann normal weiter); sonst die Antwort.
 */
export async function handleZoomJwt(request, env, url, ctx) {
  if (!/^\/zoom\/jwt\/?$/.test(url.pathname)) return null;
  if (request.method !== 'POST') return json({ error: 'not found' }, 404);

  const rl = await drosselBindung(request, env, KONTO_RL.zoomJwt);
  if (!rl.ok) return json({ error: 'zu viele Anfragen', code: 'zu-viele' }, 429, { 'Retry-After': String(rl.retryAfter || 60) });

  const jetzt = kontoJetzt(env);
  const zugang = await zugangPruefen(request, env, { funktion: 'zoom', zweck: 'zoom-jwt', gruppe: null, ziel: ZIEL_ZOOM_JWT, jetzt, ctx });
  if (!zugang.ok) return json({ error: zugang.error, code: zugang.code }, zugang.status);

  if (!zoomZugangBrauchbar(env.ZOOM_CLIENT_ID, env.ZOOM_CLIENT_SECRET)) {
    console.warn('zoom-jwt: Secret ZOOM_CLIENT_ID oder ZOOM_CLIENT_SECRET fehlt oder hat Leerraum');
    return json({ error: FEHLER_TEXT['nicht-eingerichtet'], code: 'nicht-eingerichtet' }, 503);
  }

  let rumpf = '';
  try {
    rumpf = await request.text();
  } catch {
    rumpf = null;
  }
  const ttlSeconds = rumpf === null ? null : zoomJwtLaufzeit(rumpf);
  if (ttlSeconds === null) return json({ error: 'ungültige Laufzeit', code: 'ungueltige-laufzeit' }, 400);

  const { jwt, exp } = await signiereZoomJwt({ clientId: env.ZOOM_CLIENT_ID, clientSecret: env.ZOOM_CLIENT_SECRET, jetztMs: jetzt, ttlSeconds });

  // Protokoll im Konten-DO: best effort, nach der Antwort. Ein Fehler (Wurf oder Ablehnung) verhindert das JWT nie.
  const eintrag = Promise.resolve()
    .then(() => kontoAktion(env, 'zoom-jwt-protokoll', { jetzt, kid: zugang.claims.kid, gid: zugang.claims.gid }))
    .then((r) => {
      if (!r || r.ok !== true) console.warn(`zoom-jwt: Protokolleintrag abgelehnt (code=${(r && r.code) || 'unbekannt'})`);
    })
    .catch((e) => console.warn(`zoom-jwt: Protokolleintrag fehlgeschlagen (${fehlerName(e)})`));
  if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(eintrag);

  return json({ jwt, exp, gueltigS: exp - Math.floor(jetzt / 1000) });
}
