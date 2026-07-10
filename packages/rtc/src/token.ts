// @jm/rtc/token — kurzlebige, signierte Join-Token für Remote-Gäste (Welle 6, Spur S1).
//
// Isomorph über Web Crypto (globalThis.crypto.subtle): IDENTISCHER Code mintet in der App
// (Node/Electron-Main, wo der Launcher als CA das Event-Secret erzeugt) und verifiziert im
// Cloudflare Durable Object (workerd). Bewusst NICHT auf @jm/auth-core aufgebaut (das ist
// node:crypto-only und liefe nicht im Worker) — die Primitive ist aber dasselbe HMAC-SHA256 wie
// auth-core.hmacProof. Das Event-Secret ist symmetrisch (App mintet, Worker/DO verifiziert mit
// demselben Schlüssel): laut Roadmap S5 akzeptabel, da die SFU ohnehin Klartext-Medien sieht
// (nicht E2E-blind) — eine asymmetrische Ed25519-Variante wäre der Aufwertungspfad.

export interface JoinClaims {
  room: string;
  guestId: string;
  scope: 'guest' | 'operator' | 'interpreter';
  /** Ablauf als Unix-ms. */
  exp: number;
  /** Optionaler Anzeigename-Hinweis (der DO nimmt den vom hello). */
  name?: string;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

// UTF-8-Bytes als BufferSource. TypeScript ≥5.7 macht TypedArrays generisch über den
// Buffer-Typ; TextEncoder.encode() liefert Uint8Array<ArrayBufferLike>, crypto.subtle
// erwartet aber ArrayBuffer-gestützt — dieser Helfer überbrückt das (Laufzeit unverändert).
function utf8(s: string): BufferSource {
  return new TextEncoder().encode(s) as unknown as BufferSource;
}

/** 32-Byte-Zufalls-Secret pro Event (hex). Von der App als Verify-Key an Worker/DO übergeben. */
export function randomEventSecret(): string {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
}

/** Kurzer Zufalls-Bezeichner (hex) für Gäste/Räume. */
export function randomId(bytes = 8): string {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function mintJoinToken(secretHex: string, claims: JoinClaims): Promise<string> {
  const payload = b64urlEncode(enc.encode(JSON.stringify(claims)));
  const key = await hmacKey(secretHex);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, utf8(payload)));
  return `${payload}.${b64urlEncode(sig)}`;
}

/** Verifiziert Signatur UND Ablauf. Gibt die Claims zurück oder null (ungültig/abgelaufen). */
export async function verifyJoinToken(secretHex: string, token: string, nowMs: number): Promise<JoinClaims | null> {
  const dot = token.indexOf('.');
  if (dot < 0) return null;
  const payload = token.slice(0, dot);
  let sigBytes: Uint8Array<ArrayBuffer>;
  try {
    sigBytes = b64urlDecode(token.slice(dot + 1));
  } catch {
    return null;
  }
  const key = await hmacKey(secretHex);
  // subtle.verify vergleicht die HMAC konstant-zeitig intern.
  const ok = await crypto.subtle.verify('HMAC', key, sigBytes, utf8(payload));
  if (!ok) return null;
  let claims: JoinClaims;
  try {
    claims = JSON.parse(dec.decode(b64urlDecode(payload)));
  } catch {
    return null;
  }
  if (typeof claims.exp !== 'number' || claims.exp <= nowMs) return null;
  return claims;
}

// ── interne Helfer (isomorph: btoa/atob/subtle existieren in Browser, Node ≥16/20, workerd) ──
// Rückgabetyp bewusst inferiert (nicht als CryptoKey annotiert), damit das Modul auch ohne
// DOM-/workers-Lib typprüft.
async function hmacKey(secretHex: string) {
  return crypto.subtle.importKey('raw', hexToBytes(secretHex), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);
}

function b64urlEncode(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(s: string): Uint8Array<ArrayBuffer> {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}
function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const clean = hex.length % 2 ? '0' + hex : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}
function bytesToHex(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += b.toString(16).padStart(2, '0');
  return s;
}
