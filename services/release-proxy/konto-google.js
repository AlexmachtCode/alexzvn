// Google-Anmeldung der Kollegen (Anmeldung im Launcher, Plan Teil 1, P18; Spec 4, 4.1 Schritt 2; EP6).
//
// OAuth 2.0 mit OpenID Connect, Web-Client des Workspaces jakobsmedien.com (vom Owner als „intern“ angelegt, Secrets
// GOOGLE_CLIENT_ID und GOOGLE_CLIENT_SECRET): Start mit PKCE S256, `state` und `nonce` im Anmeldevorgang (DO), `hd` und
// `prompt=select_account`. Die Rückkehr tauscht den Code serverseitig gegen Tokens; das id_token kommt dabei direkt vom
// Token-Endpunkt über TLS und wird darum ohne JWKS geprüft (OIDC Core 3.1.3.7 Nr. 6): iss, aud (azp), exp, nonce, dann hd,
// email_verified und die E-Mail-Domain. Ins Log gehen nur Gründe und HTTP-Status, nie Code, Token, Secret oder E-Mail.
import { DOMAIN, istDomainKonto } from './konto-kern.js';

export const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
const GOOGLE_ISS = ['https://accounts.google.com', 'accounts.google.com'];
// Härtung des Token-Abrufs (Z1-W2): Frist, Größe der Antwort. Google antwortet in wenigen KiB; mehr ist kein id_token.
const TOKEN_FRIST_MS = 10_000;
const TOKEN_ANTWORT_MAX = 64 * 1024;

/** Ist die Google-Anmeldung eingerichtet (Client-ID und Secret)? Sonst zeigt die Seite B6 und nur die Passwort-Anmeldung. */
export function googleBereit(env) {
  return !!env.GOOGLE_CLIENT_ID && !!env.GOOGLE_CLIENT_SECRET;
}

function b64url(bytes) {
  let s = '';
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function ausB64url(text) {
  const t = String(text).replace(/-/g, '+').replace(/_/g, '/');
  const roh = atob(t + '='.repeat((4 - (t.length % 4)) % 4));
  return Uint8Array.from(roh, (c) => c.charCodeAt(0));
}

/** PKCE (RFC 7636): code_challenge = b64url(SHA-256(verifier)), Methode S256. */
export async function pkceChallenge(verifier) {
  return b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
}

/** Adresse für den Sprung zu Google (302). `state`, `nonce`, `verifier` hat der Vorgang im DO gemerkt. */
export async function googleStartAdresse(env, { state, nonce, verifier, redirectUri }) {
  const p = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    hd: DOMAIN,
    prompt: 'select_account',
    state,
    nonce,
    code_challenge: await pkceChallenge(verifier),
    code_challenge_method: 'S256',
  });
  return `${GOOGLE_AUTH}?${p}`;
}

/** Angaben (Payload) eines JWT ohne Signaturprüfung; null bei fremder Form. */
function jwtAngaben(token) {
  if (typeof token !== 'string') return null;
  const teile = token.split('.');
  if (teile.length !== 3 || !teile[1]) return null;
  try {
    const angaben = JSON.parse(new TextDecoder().decode(ausB64url(teile[1])));
    return angaben && typeof angaben === 'object' && !Array.isArray(angaben) ? angaben : null;
  } catch {
    return null;
  }
}

/**
 * Antwort von Google als JSON, höchstens TOKEN_ANTWORT_MAX Bytes: größer als content-length verspricht → null ohne zu lesen;
 * sonst Stück für Stück gelesen und beim Überschreiten abgebrochen (auch ohne content-length). Ein Lesefehler mitten im Stream,
 * ein Body ohne JSON-Objekt oder eine zu große Antwort → null.
 */
async function liesTokenAntwort(antwort) {
  const cl = Number(antwort.headers.get('content-length'));
  if (Number.isFinite(cl) && cl > TOKEN_ANTWORT_MAX) {
    await verwirf(antwort);
    return null;
  }
  if (!antwort.body) return null;
  const leser = antwort.body.getReader();
  const stuecke = [];
  let summe = 0;
  try {
    for (;;) {
      const { done, value } = await leser.read();
      if (done) break;
      summe += value.byteLength;
      if (summe > TOKEN_ANTWORT_MAX) {
        await leser.cancel().catch(() => {});
        return null;
      }
      stuecke.push(value);
    }
  } catch {
    return null;
  }
  const alles = new Uint8Array(summe);
  let pos = 0;
  for (const s of stuecke) {
    alles.set(s, pos);
    pos += s.byteLength;
  }
  try {
    const daten = JSON.parse(new TextDecoder().decode(alles));
    return daten && typeof daten === 'object' && !Array.isArray(daten) ? daten : null;
  } catch {
    return null;
  }
}

/** Den Rest eines Bodys verwerfen, den niemand liest (gibt die Verbindung frei); Fehler dabei sind ohne Belang. */
async function verwirf(antwort) {
  try {
    if (antwort.body) await antwort.body.cancel();
  } catch {
    // nichts zu tun
  }
}

function nein(grund, warum) {
  console.warn(`konto-google: Anmeldung abgelehnt (${warum})`);
  return { ok: false, grund };
}

/**
 * Rückkehr von Google: Code gegen Tokens tauschen (mit code_verifier und Client-Secret) und das id_token prüfen.
 * → { ok: true, email, name } | { ok: false, grund: 'domain' | 'email-unbestaetigt' | 'fehler' }
 */
export async function googleRueckkehr(env, { code, verifier, nonce, redirectUri, jetzt }) {
  let antwort;
  try {
    antwort = await fetch(GOOGLE_TOKEN, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code_verifier: verifier,
      }).toString(),
      // Z1-W2: keiner Weiterleitung folgen (das Secret steht im Body), und nicht länger als TOKEN_FRIST_MS warten.
      redirect: 'error',
      signal: AbortSignal.timeout(TOKEN_FRIST_MS),
    });
  } catch (e) {
    return nein('fehler', `Token-Tausch nicht erreichbar: ${(e && e.name) || 'unbekannt'}`);
  }
  if (!antwort.ok) {
    await verwirf(antwort);
    return nein('fehler', `Token-Tausch HTTP ${antwort.status}`);
  }
  const daten = await liesTokenAntwort(antwort);
  const a = jwtAngaben(daten && daten.id_token);
  if (!a) return nein('fehler', 'id_token fehlt oder unlesbar');
  // OIDC Core 3.1.3.7: Aussteller, Empfänger (bei mehreren Empfängern azp), Ablauf, nonce.
  if (!GOOGLE_ISS.includes(a.iss)) return nein('fehler', 'iss');
  const aud = Array.isArray(a.aud) ? a.aud : [a.aud];
  if (!aud.includes(env.GOOGLE_CLIENT_ID) || (aud.length > 1 && a.azp !== env.GOOGLE_CLIENT_ID)) return nein('fehler', 'aud');
  if (typeof a.exp !== 'number' || !(a.exp * 1000 > jetzt)) return nein('fehler', 'exp');
  if (typeof nonce !== 'string' || !nonce || a.nonce !== nonce) return nein('fehler', 'nonce');
  // Spec 4: nur Firmenkonten von jakobsmedien.com mit bestätigter E-Mail.
  if (a.hd !== DOMAIN) return nein('domain', 'hd');
  if (a.email_verified !== true) return nein('email-unbestaetigt', 'email_verified');
  if (!istDomainKonto(a.email)) return nein('domain', 'E-Mail-Domain');
  return { ok: true, email: a.email.trim().toLowerCase(), name: typeof a.name === 'string' ? a.name.trim().slice(0, 80) : '' };
}
