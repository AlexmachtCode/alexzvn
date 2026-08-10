#!/usr/bin/env node
// Baut das JWT fuer die Meeting-SDK-Anmeldung und gibt NUR das JWT auf stdout aus.
//
// WARUM GETRENNT VON C++: HMAC-SHA256 und base64url sind in Node drei Zeilen, in C++ waeren
// es BCrypt-Aufrufe und eigener Base64-Code. Der C++-Teil soll das SDK pruefen, nicht Krypto.
//
// GEHEIMNISSE: Client-ID und Secret werden NIE ausgegeben, nicht ins Log geschrieben und
// nicht ins Repo gelegt. Sie kommen entweder aus der Umgebung
//   ZOOM_SDK_CLIENT_ID / ZOOM_SDK_CLIENT_SECRET
// oder aus einer JSON-Datei, auf die ZOOM_SDK_CREDENTIALS zeigt:
//   { "clientId": "...", "clientSecret": "..." }
// Lege diese Datei AUSSERHALB des Repos ab — dann kann sie gar nicht erst committet werden.
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

let clientId = process.env.ZOOM_SDK_CLIENT_ID;
let clientSecret = process.env.ZOOM_SDK_CLIENT_SECRET;

const credFile = process.env.ZOOM_SDK_CREDENTIALS;
if (credFile && (!clientId || !clientSecret)) {
  const j = JSON.parse(readFileSync(credFile, 'utf8'));
  clientId ??= j.clientId ?? j.client_id ?? j.appKey ?? j.sdkKey;
  clientSecret ??= j.clientSecret ?? j.client_secret ?? j.appSecret ?? j.sdkSecret;
}

if (!clientId || !clientSecret) {
  console.error(
    'Weder ZOOM_SDK_CLIENT_ID/ZOOM_SDK_CLIENT_SECRET gesetzt noch ZOOM_SDK_CREDENTIALS auf eine\n' +
      'JSON-Datei mit { "clientId": "...", "clientSecret": "..." } gerichtet.',
  );
  process.exit(2);
}

// Zoom verlangt Sekunden, nicht Millisekunden. tokenExp muss >= exp sein und darf laut
// Zoom hoechstens 2 Tage in der Zukunft liegen; fuer einen Sondierlauf reicht eine Stunde.
const iat = Math.floor(Date.now() / 1000) - 30; // 30 s Vorlauf gegen Uhrendrift
const exp = iat + 3600;

const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
const payload = b64url(JSON.stringify({ appKey: clientId, iat, exp, tokenExp: exp }));
const sig = b64url(createHmac('sha256', clientSecret).update(`${header}.${payload}`).digest());

// NUR das JWT auf stdout — alles andere geht nach stderr, damit der Aufrufer die Ausgabe
// unveraendert weiterreichen kann.
process.stdout.write(`${header}.${payload}.${sig}`);
process.stderr.write(`[zoom-spike] JWT gebaut, gueltig bis ${new Date(exp * 1000).toISOString()}\n`);
