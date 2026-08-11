// Baut das JWT fuer die Meeting-SDK-Anmeldung.
//
// WARUM IN TYPESCRIPT UND NICHT IN C++: HMAC-SHA256 und base64url sind in Node drei
// Zeilen, in C++ waeren es BCrypt-Aufrufe und eigener Base64-Code. Wichtiger noch:
// so erreichen Client-ID und Secret den nativen Teil NIE — die Bridge sieht
// ausschliesslich das fertige JWT.
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export interface JwtOptions {
  clientId: string;
  clientSecret: string;
  /** Sekunden seit 1970. Nur fuer Tests; sonst die Uhr. */
  now?: number;
  /** Gueltigkeitsdauer in Sekunden. Zoom laesst hoechstens zwei Tage zu. */
  ttlSeconds?: number;
}

export function buildJwt(opts: JwtOptions): string {
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  // 30 s Vorlauf gegen Uhrendrift: liegt iat auch nur eine Sekunde in der Zukunft,
  // weist Zoom das Token mit AUTHRET_JWTTOKENWRONG ab — und das sieht aus wie ein
  // falsches Secret. Die Setzung stammt aus dem Stage-0-Spike.
  const iat = now - 30;
  const exp = iat + (opts.ttlSeconds ?? 3600);

  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({ appKey: opts.clientId, iat, exp, tokenExp: exp }));
  const sig = b64url(createHmac('sha256', opts.clientSecret).update(`${header}.${payload}`).digest());
  return `${header}.${payload}.${sig}`;
}

/**
 * Liest Client-ID und Secret aus der Umgebung oder aus einer JSON-Datei, auf die
 * ZOOM_SDK_CREDENTIALS zeigt. Die Datei gehoert AUSSERHALB des Repos — dann kann sie
 * gar nicht erst committet werden, und der gitleaks-Lauf in CI findet nichts.
 */
export function readCredentials(): { clientId: string; clientSecret: string } {
  let clientId = process.env.ZOOM_SDK_CLIENT_ID;
  let clientSecret = process.env.ZOOM_SDK_CLIENT_SECRET;

  const file = process.env.ZOOM_SDK_CREDENTIALS;
  if (file && (!clientId || !clientSecret)) {
    const j = JSON.parse(readFileSync(file, 'utf8')) as Record<string, string>;
    clientId ??= j.clientId ?? j.client_id ?? j.appKey ?? j.sdkKey;
    clientSecret ??= j.clientSecret ?? j.client_secret ?? j.appSecret ?? j.sdkSecret;
  }

  if (!clientId || !clientSecret) {
    // Die Meldung nennt die Namen der Variablen, NIE ihre Werte.
    throw new Error(
      'Zugangsdaten fehlen: entweder ZOOM_SDK_CLIENT_ID und ZOOM_SDK_CLIENT_SECRET setzen,\n' +
        'oder ZOOM_SDK_CREDENTIALS auf eine JSON-Datei mit { "clientId": "…", "clientSecret": "…" } richten.',
    );
  }
  return { clientId, clientSecret };
}
