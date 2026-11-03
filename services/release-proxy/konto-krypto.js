// Anmeldung im Launcher (Teil 1) · Krypto des Kontos (Spec 4, 4.1, 6.4, 7, 9; Plan 10.3, EP2, EP4, EP5, EP7).
// Signierte Sitzungen und Freigaben `jm1.<payload>.<sig>` (HMAC-SHA256), Codes ohne 0, O, 1, I, Passwort-Hash PBKDF2-SHA256,
// zeitkonstanter Vergleich, AES-GCM für iveo-Tokens, Gerätebeweis ECDSA P-256. Nur Web Crypto (globalThis.crypto), kein
// node:-Modul, keine Konsole, nur benannte Exporte: läuft im Worker (workerd), unter Node (Tests) und im Launcher-Test (P8).
// Schlüssel (Worker-Secrets KONTO_SCHLUESSEL, IVEO_SCHLUESSEL) sind genau 32 Zufallsbytes als Base64 oder Base64url.
// Fehler nennen nie einen Wert; Prüfungen geben null bzw. false statt zu werfen.

export const TOKEN_PRAEFIX = 'jm1.';
export const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const PBKDF2_ITERATIONEN = 100_000;
export const BEWEIS_FENSTER_MS = 5 * 60_000;

const kodierer = new TextEncoder();
const dekodierer = new TextDecoder();

function b64url(bytes) {
  let s = '';
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Base64 oder Base64url, mit oder ohne Auffüllung; wirft bei fremden Zeichen. */
function ausB64(text) {
  if (typeof text !== 'string') throw new Error('kein Base64');
  const t = text.trim();
  if (!/^[A-Za-z0-9+/_-]*={0,2}$/.test(t)) throw new Error('kein Base64');
  const ohne = t.replace(/=+$/, '').replace(/-/g, '+').replace(/_/g, '/');
  const roh = atob(ohne + '='.repeat((4 - (ohne.length % 4)) % 4));
  const out = new Uint8Array(roh.length);
  for (let i = 0; i < roh.length; i++) out[i] = roh.charCodeAt(i);
  return out;
}

function schluesselBytes(schluesselB64) {
  try {
    const b = ausB64(schluesselB64);
    return b.length === 32 ? b : null;
  } catch {
    return null;
  }
}

/** Ist ein Worker-Secret als Schlüssel brauchbar (genau 32 Byte Base64)? Sonst antwortet der Worker 503 S5. */
export function schluesselBrauchbar(schluesselB64) {
  return schluesselBytes(schluesselB64) !== null;
}

function gleicheBytes(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function hmacSchluessel(bytes) {
  return crypto.subtle.importKey('raw', bytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

/** Sitzung oder Freigabe signieren: `jm1.` + b64url(JSON) + `.` + b64url(HMAC-SHA256 über `jm1.<payload>`). */
export async function signiere(schluesselB64, claims) {
  const bytes = schluesselBytes(schluesselB64);
  if (!bytes) throw new Error('Schlüssel unbrauchbar');
  const payload = b64url(kodierer.encode(JSON.stringify(claims)));
  const sig = await crypto.subtle.sign('HMAC', await hmacSchluessel(bytes), kodierer.encode(TOKEN_PRAEFIX + payload));
  return `${TOKEN_PRAEFIX}${payload}.${b64url(sig)}`;
}

/** Claims nur bei gültiger Signatur, passendem `typ`, `v === 1` und `exp > jetzt`; sonst null (wirft nie). */
export async function pruefeToken(schluesselB64, token, typ, jetzt) {
  try {
    const bytes = schluesselBytes(schluesselB64);
    if (!bytes || typeof token !== 'string' || !token.startsWith(TOKEN_PRAEFIX)) return null;
    const teile = token.slice(TOKEN_PRAEFIX.length).split('.');
    if (teile.length !== 2 || !teile[0] || !teile[1]) return null;
    const [payload, sig] = teile;
    // Die Signatur nur in der einen kanonischen Form (b64url, 43 Zeichen, keine Restbits): sonst gäbe es mehrere Texte je Token.
    // Die Nutzlast ist über die HMAC byte-genau gebunden und braucht das nicht.
    if (!/^[A-Za-z0-9_-]{43}$/.test(sig) || b64url(ausB64(sig)) !== sig) return null;
    const echt = await crypto.subtle.verify('HMAC', await hmacSchluessel(bytes), ausB64(sig), kodierer.encode(TOKEN_PRAEFIX + payload));
    if (!echt) return null;
    const claims = JSON.parse(dekodierer.decode(ausB64(payload)));
    if (!claims || typeof claims !== 'object' || Array.isArray(claims)) return null;
    if (claims.v !== 1 || claims.typ !== typ) return null;
    if (typeof claims.exp !== 'number' || !(claims.exp > jetzt)) return null;
    return claims;
  } catch {
    return null;
  }
}

/**
 * Zeitkonstanter Vergleich zweier Texte (Muster worker.js `zoomSdkSchluesselPasst`): beide per SHA-256 auf 32 Byte, dann
 * XOR-Schleife ohne frühen Ausstieg. Leere Werte sind nie gleich (ein fehlendes Geheimnis passt auf nichts).
 */
export async function gleichOhneZeitleck(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a === '' || b === '') return false;
  const [x, y] = await Promise.all([crypto.subtle.digest('SHA-256', kodierer.encode(a)), crypto.subtle.digest('SHA-256', kodierer.encode(b))]);
  return gleicheBytes(new Uint8Array(x), new Uint8Array(y));
}

function zeichen(anzahl) {
  // 32 Zeichen im Alphabet: `& 31` ist gleichverteilt.
  let s = '';
  for (const x of crypto.getRandomValues(new Uint8Array(anzahl))) s += CODE_ALPHABET[x & 31];
  return s;
}

/** Bestätigungscode der Anmeldung (Spec 4.1): `XXX-XXX`. */
export function neuerBestaetigungsCode() {
  const z = zeichen(6);
  return `${z.slice(0, 3)}-${z.slice(3)}`;
}

/** Einladungscode für Externe (Spec 4): `XXXX-XXXX-XXXX`, gespeichert nur als SHA-256 der normalisierten Form. */
export function neuerEinladungsCode() {
  const z = zeichen(12);
  return `${z.slice(0, 4)}-${z.slice(4, 8)}-${z.slice(8)}`;
}

/** Eingabe eines Codes: Großbuchstaben, ohne Leerraum und Bindestriche. */
export function normalisiereCode(eingabe) {
  return String(eingabe ?? '').toUpperCase().replace(/[\s-]+/g, '');
}

/** Zufall als b64url (Kennungen, Abholgeheimnis, Seitentoken). */
export function zufall(bytes) {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function sha256B64url(text) {
  return b64url(await crypto.subtle.digest('SHA-256', kodierer.encode(String(text))));
}

async function pbkdf2(passwort, salz, iterationen) {
  const basis = await crypto.subtle.importKey('raw', kodierer.encode(passwort.normalize('NFC')), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salz, iterations: iterationen }, basis, 256));
}

/** Passwort-Hash `pbkdf2-sha256$100000$<salz>$<hash>` (Salz 16 B, Hash 32 B, b64url; EP4). */
export async function hashePasswort(passwort) {
  if (typeof passwort !== 'string') throw new Error('Passwort fehlt');
  const salz = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(passwort, salz, PBKDF2_ITERATIONEN);
  return `pbkdf2-sha256$${PBKDF2_ITERATIONEN}$${b64url(salz)}$${b64url(hash)}`;
}

/** Prüft ein Passwort gegen den gespeicherten Hash, zeitkonstant; fremde Formen und mehr Iterationen als erlaubt → false. */
export async function pruefePasswort(passwort, gespeichert) {
  try {
    if (typeof passwort !== 'string' || typeof gespeichert !== 'string') return false;
    const teile = gespeichert.split('$');
    if (teile.length !== 4 || teile[0] !== 'pbkdf2-sha256') return false;
    if (!/^[1-9][0-9]{0,6}$/.test(teile[1])) return false;
    const iterationen = Number(teile[1]);
    if (iterationen > PBKDF2_ITERATIONEN) return false;
    const salz = ausB64(teile[2]);
    const soll = ausB64(teile[3]);
    if (salz.length < 16 || soll.length !== 32) return false;
    return gleicheBytes(await pbkdf2(passwort, salz, iterationen), soll);
  } catch {
    return false;
  }
}

async function aesSchluessel(schluesselB64) {
  const bytes = schluesselBytes(schluesselB64);
  if (!bytes) throw new Error('Schlüssel unbrauchbar');
  return crypto.subtle.importKey('raw', bytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

/** iveo-Token verschlüsseln (Spec 6.4, EP13): AES-GCM-256, iv 12 B je Aufruf neu; Ergebnis `{ iv, ct }` als b64url. */
export async function iveoVerschluesseln(schluesselB64, klartext) {
  if (typeof klartext !== 'string' || klartext === '') throw new Error('Token fehlt');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesSchluessel(schluesselB64), kodierer.encode(klartext));
  return { iv: b64url(iv), ct: b64url(ct) };
}

/** Klartext oder null (falscher Schlüssel, manipuliertes iv oder ct, fremde Form). */
export async function iveoEntschluesseln(schluesselB64, wert) {
  try {
    if (!wert || typeof wert.iv !== 'string' || typeof wert.ct !== 'string') return null;
    const klar = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ausB64(wert.iv) }, await aesSchluessel(schluesselB64), ausB64(wert.ct));
    return dekodierer.decode(klar);
  } catch {
    return null;
  }
}

/** Öffentlicher P-256-Schlüssel als JWK ohne Beiwerk `{ kty, crv, x, y }`, sonst null (auch bei privatem Anteil `d`). */
export function reinerJwk(jwk) {
  if (!jwk || typeof jwk !== 'object' || jwk.kty !== 'EC' || jwk.crv !== 'P-256' || 'd' in jwk) return null;
  if (typeof jwk.x !== 'string' || typeof jwk.y !== 'string') return null;
  if (!/^[A-Za-z0-9_-]{43}$/.test(jwk.x) || !/^[A-Za-z0-9_-]{43}$/.test(jwk.y)) return null;
  return { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y };
}

async function pruefSchluessel(jwk) {
  const rein = reinerJwk(jwk);
  if (!rein) return null;
  try {
    return await crypto.subtle.importKey('jwk', rein, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify']);
  } catch {
    return null;
  }
}

/** Gerätekennung (EP7): die ersten 22 Zeichen b64url von SHA-256 über SPKI; null bei ungültigem Schlüssel. */
export async function geraetIdAus(publicJwk) {
  const schluessel = await pruefSchluessel(publicJwk);
  if (!schluessel) return null;
  const spki = await crypto.subtle.exportKey('spki', schluessel);
  return b64url(await crypto.subtle.digest('SHA-256', spki)).slice(0, 22);
}

/** Text, den das Gerät signiert (Zwecke `abholen` mit Vorgang, `erneuern` mit Konto-Kennung). */
export function beweisText(zweck, bezug, ts) {
  return `jm-geraet|${zweck}|${bezug}|${ts}`;
}

/** Gerätebeweis `{ gid, ts, sig }` prüfen: ±5 min, gid passt zum Schlüssel, ECDSA P-256 SHA-256, Signatur P1363 b64url. */
export async function pruefeGeraeteBeweis(publicJwk, beweis, zweck, bezug, jetzt) {
  try {
    if (!beweis || typeof beweis !== 'object' || typeof beweis.gid !== 'string' || typeof beweis.sig !== 'string') return false;
    if (!Number.isFinite(beweis.ts) || !Number.isFinite(jetzt)) return false;
    if (Math.abs(jetzt - beweis.ts) > BEWEIS_FENSTER_MS) return false;
    const schluessel = await pruefSchluessel(publicJwk);
    if (!schluessel) return false;
    if (beweis.gid !== (await geraetIdAus(publicJwk))) return false;
    return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, schluessel, ausB64(beweis.sig), kodierer.encode(beweisText(zweck, bezug, beweis.ts)));
  } catch {
    return false;
  }
}
