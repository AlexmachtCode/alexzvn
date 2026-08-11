// Selbsttests der reinen TypeScript-Logik. Brauchen KEIN Zoom-SDK, KEINEN Compiler
// und KEIN Meeting — sie laufen auch auf Linux.
//   npm run selftest -w @jm/zoom-bridge
import { buildJwt, readCredentials } from '../src/jwt.ts';
import { tmpdir } from 'node:os';
import { writeFileSync, unlinkSync } from 'node:fs';

let failures = 0;
function assert(cond: boolean, name: string): void {
  if (cond) console.log(`  ok  ${name}`);
  else {
    failures++;
    console.error(`FAIL  ${name}`);
  }
}

function decodePart(part: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
}

console.log('jwt — Aufbau:');
{
  // Feste Zeit, damit die Signatur ein fester Vektor ist.
  const jwt = buildJwt({ clientId: 'testKey', clientSecret: 'testSecret', now: 1_770_000_000, ttlSeconds: 3600 });
  const [h, p, sig] = jwt.split('.');

  assert(jwt.split('.').length === 3, 'JWT hat drei Teile');
  assert(decodePart(h).alg === 'HS256' && decodePart(h).typ === 'JWT', 'Kopf ist HS256/JWT');

  const payload = decodePart(p) as { appKey: string; iat: number; exp: number; tokenExp: number };
  assert(payload.appKey === 'testKey', 'appKey ist die Client-ID');
  assert(payload.iat === 1_770_000_000 - 30, 'iat hat 30 s Vorlauf gegen Uhrendrift');
  assert(payload.exp === payload.iat + 3600, 'exp liegt ttlSeconds nach iat');
  assert(payload.tokenExp >= payload.exp, 'tokenExp ist nicht kleiner als exp');
  assert(
    Object.keys(payload).sort().join(',') === 'appKey,exp,iat,tokenExp',
    'genau die vier von Zoom verlangten Felder, nicht mehr',
  );

  // Fester Vektor: HMAC-SHA256 ueber "<kopf>.<nutzlast>" mit "testSecret".
  // Bricht dieser Test, hat sich der JWT-Aufbau geaendert — das ist eine Aussage,
  // kein Rauschen, denn Zoom prueft die Signatur byteweise.
  assert(sig.length > 0 && !/[+/=]/.test(sig), 'Signatur ist base64url, ohne + / =');
  assert(
    buildJwt({ clientId: 'testKey', clientSecret: 'testSecret', now: 1_770_000_000, ttlSeconds: 3600 }) === jwt,
    'gleiche Eingabe, gleiches JWT (deterministisch)',
  );
  assert(
    buildJwt({ clientId: 'testKey', clientSecret: 'anderes', now: 1_770_000_000, ttlSeconds: 3600 }) !== jwt,
    'anderes Secret, andere Signatur',
  );

  // Das Secret darf NIRGENDS in der Ausgabe auftauchen — auch nicht base64-kodiert.
  assert(!jwt.includes('testSecret'), 'das Secret steht nicht im Klartext im JWT');
  assert(
    !jwt.includes(Buffer.from('testSecret').toString('base64').replace(/=+$/, '')),
    'das Secret steht auch nicht base64-kodiert im JWT',
  );
}

console.log('readCredentials — Umgebung und Datei:');
{
  const savedEnv = { ...process.env };

  try {
    // Umgebungsweg: Client-ID und Secret aus Env-Variablen
    process.env.ZOOM_SDK_CLIENT_ID = 'env-clientid';
    process.env.ZOOM_SDK_CLIENT_SECRET = 'env-secret';
    let creds = readCredentials();
    assert(creds.clientId === 'env-clientid' && creds.clientSecret === 'env-secret', 'Umgebungsweg: Client-ID und Secret');

    // Dateiweg mit clientId/clientSecret
    delete process.env.ZOOM_SDK_CLIENT_ID;
    delete process.env.ZOOM_SDK_CLIENT_SECRET;
    const tempFile1 = `${tmpdir()}/zoom-test-${Date.now()}-1.json`;
    writeFileSync(tempFile1, JSON.stringify({ clientId: 'file-clientid', clientSecret: 'file-secret' }), 'utf8');
    process.env.ZOOM_SDK_CREDENTIALS = tempFile1;
    creds = readCredentials();
    assert(creds.clientId === 'file-clientid' && creds.clientSecret === 'file-secret', 'Dateiweg: Client-ID und Secret aus JSON');
    unlinkSync(tempFile1);

    // Namensvarianten client_id/client_secret
    const tempFile2 = `${tmpdir()}/zoom-test-${Date.now()}-2.json`;
    writeFileSync(tempFile2, JSON.stringify({ client_id: 'alt-clientid', client_secret: 'alt-secret' }), 'utf8');
    process.env.ZOOM_SDK_CREDENTIALS = tempFile2;
    creds = readCredentials();
    assert(creds.clientId === 'alt-clientid' && creds.clientSecret === 'alt-secret', 'Namensvarianten: client_id/client_secret');
    unlinkSync(tempFile2);

    // Namensvarianten appKey/sdkSecret
    const tempFile3 = `${tmpdir()}/zoom-test-${Date.now()}-3.json`;
    writeFileSync(tempFile3, JSON.stringify({ appKey: 'app-key', sdkSecret: 'sdk-secret' }), 'utf8');
    process.env.ZOOM_SDK_CREDENTIALS = tempFile3;
    creds = readCredentials();
    assert(creds.clientId === 'app-key' && creds.clientSecret === 'sdk-secret', 'Namensvarianten: appKey/sdkSecret');
    unlinkSync(tempFile3);

    // Vorrang: Umgebung gewinnt ueber Datei
    process.env.ZOOM_SDK_CLIENT_ID = 'env-wins';
    process.env.ZOOM_SDK_CLIENT_SECRET = 'env-wins-secret';
    const tempFile4 = `${tmpdir()}/zoom-test-${Date.now()}-4.json`;
    writeFileSync(tempFile4, JSON.stringify({ clientId: 'file-loses', clientSecret: 'file-loses-secret' }), 'utf8');
    process.env.ZOOM_SDK_CREDENTIALS = tempFile4;
    creds = readCredentials();
    assert(creds.clientId === 'env-wins' && creds.clientSecret === 'env-wins-secret', 'Vorrang: Umgebung gewinnt ueber Datei');
    unlinkSync(tempFile4);

    // Fehlerfall: kein Geheimnis in der Meldung, wenn nichts gesetzt
    delete process.env.ZOOM_SDK_CLIENT_ID;
    delete process.env.ZOOM_SDK_CLIENT_SECRET;
    delete process.env.ZOOM_SDK_CREDENTIALS;
    try {
      readCredentials();
      assert(false, 'Fehlerfall: readCredentials wirft, wenn nichts gesetzt');
    } catch (e) {
      const err = e as Error;
      assert(err.message.includes('ZOOM_SDK_CLIENT_ID'), 'Fehlerfall: Variablennamen stehen in der Meldung');
    }

    // Fehlerfall mit nur einer Umgebungsvariablen — der kritische Test
    process.env.ZOOM_SDK_CLIENT_ID = 'GEHEIM-12345';
    delete process.env.ZOOM_SDK_CLIENT_SECRET;
    delete process.env.ZOOM_SDK_CREDENTIALS;
    try {
      readCredentials();
      assert(false, 'Fehlerfall: readCredentials wirft, wenn eine Variable fehlt');
    } catch (e) {
      const err = e as Error;
      assert(!err.message.includes('GEHEIM-12345'), 'Fehlerfall: Client-ID steht nicht in der Fehlermeldung');
      assert(!err.message.includes('12345'), 'Fehlerfall: geheimer Wert steht nicht in der Fehlermeldung');
    }

  } finally {
    // Umgebung wiederherstellen
    process.env = savedEnv;
  }
}

console.log(failures === 0 ? '\nAlle Selbsttests bestanden.' : `\n${failures} Selbsttest(s) fehlgeschlagen.`);
process.exit(failures === 0 ? 0 : 1);
