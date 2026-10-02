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
 * Liest eine Textdatei so, wie Windows-Werkzeuge sie schreiben: mit oder ohne
 * BOM. GEMESSEN (Nachbesserung Einsatzpaket, 01.10.2026): readFileSync(...,
 * 'utf8') laesst ein fuehrendes U+FEFF stehen, und JSON.parse scheitert daran.
 * start.ps1 (Get-Content | ConvertFrom-Json) vertraegt den BOM dagegen - das
 * Start-Skript erklaerte eine Datei fuer gueltig, die zoom-join.exe danach als
 * "kein gueltiges JSON" abwies. Windows PowerShell 5.1 schreibt mit
 * `Set-Content -Encoding UTF8` einen BOM, Notepad mit "UTF-16" ebenfalls -
 * solche Dateien entstehen leicht.
 */
function readTextWithBom(file: string): string {
  const b = readFileSync(file);
  if (b.length >= 2 && b[0] === 0xff && b[1] === 0xfe) return b.subarray(2).toString('utf16le');
  if (b.length >= 2 && b[0] === 0xfe && b[1] === 0xff) {
    const be = Buffer.from(b.subarray(2));
    // Ungerade Laenge ist kein UTF-16 - dann eben kein gueltiges JSON (die
    // Meldung unten), statt einer RangeError-Meldung aus swap16().
    if (be.length % 2 !== 0) return '';
    return be.swap16().toString('utf16le');
  }
  const t = b.toString('utf8');
  return t.charCodeAt(0) === 0xfeff ? t.slice(1) : t;
}

/**
 * Liest Client-ID und Secret aus der Umgebung oder aus einer JSON-Datei, auf die
 * ZOOM_SDK_CREDENTIALS zeigt. Die Datei gehoert AUSSERHALB des Repos — dann kann sie
 * gar nicht erst committet werden, und der gitleaks-Lauf in CI findet nichts.
 *
 * `env` ist die Umgebung, aus der gelesen wird - Vorgabe process.env. Die
 * Start-EXE (cli/steuerung.mjs) reicht ihre eigene durch; die Selbsttests
 * fahren sie damit gegen die Attrappe, ohne process.env anzufassen. Eine
 * uebergebene Umgebung ist dann die EINZIGE Quelle - process.env springt
 * nicht ein.
 */
export function readCredentials(env: NodeJS.ProcessEnv = process.env): { clientId: string; clientSecret: string } {
  let clientId = env.ZOOM_SDK_CLIENT_ID;
  let clientSecret = env.ZOOM_SDK_CLIENT_SECRET;

  const file = env.ZOOM_SDK_CREDENTIALS;
  if (file && (!clientId || !clientSecret)) {
    let j: Record<string, string>;
    try {
      j = JSON.parse(readTextWithBom(file)) as Record<string, string>;
    } catch (e) {
      // NICHT e.message weiterreichen, wenn das Parsen scheiterte: GEMESSEN
      // (Node 24) zitiert JSON.parse einen AUSSCHNITT DER EINGABE in seiner
      // Meldung ('..."tSecret": GEHEIM…"... is not valid JSON') - eine
      // kaputte Datei braechte so das Secret auf den Schirm. Ein Lesefehler
      // (ENOENT u. ae.) nennt nur den Pfad und bleibt wie er ist.
      if (e instanceof SyntaxError) {
        throw new Error('ZOOM_SDK_CREDENTIALS: die Datei ist kein gueltiges JSON (Inhalt wird absichtlich nicht angezeigt).');
      }
      throw e;
    }
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
