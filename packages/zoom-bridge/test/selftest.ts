// Selbsttests der reinen TypeScript-Logik. Brauchen KEIN Zoom-SDK, KEINEN Compiler
// und KEIN Meeting — sie laufen auch auf Linux.
//   npm run selftest -w @jm/zoom-bridge
import { buildJwt, readCredentials } from '../src/jwt.ts';
import {
  LineSplitter,
  authResultName,
  enrich,
  explainStatus,
  endReason,
  failCodeName,
  failReason,
  FAIL_CODE_NAMES,
  normalizeMeetingId,
  parseWireEvent,
  sdkErrorName,
  serializeCommand,
  SDK_ERROR_NAMES,
  OWN_ERROR_NAMES,
  AUTH_RESULT_NAMES,
  VIDEO_RESOLUTIONS,
  VIDEO_DELAY_MAX_MS,
  type AudioReason,
  type BridgeEvent,
  type Participant,
  type WireEvent,
} from '../src/protocol.ts';
import { withNdiRuntimeOnPath } from '../src/ndi-path.ts';
import { PE_MASCHINE_X64, PE_MASCHINE_X86, SDK_FASSUNG, SDK_FASSUNG_BRIDGE, findeSdkBin, peInfo } from '../src/sdk.ts';
import * as paket from '../src/index.ts';
import type {
  AudioReason as PaketAudioReason,
  AudioState as PaketAudioState,
  VideoReason as PaketVideoReason,
  VideoState as PaketVideoState,
} from '../src/index.ts';
import { tmpdir } from 'node:os';
import { delimiter } from 'node:path';
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

console.log('\nreadCredentials — eine uebergebene Umgebung statt process.env:');
{
  // Die Start-EXE (cli/steuerung.mjs) liest die Zugangsdaten aus einer
  // UEBERGEBENEN Umgebung - die Selbsttests fahren sie gegen die Attrappe,
  // ohne process.env anzufassen. Was dort steht, darf dann NICHT gewinnen.
  const savedEnv = { ...process.env };
  try {
    process.env.ZOOM_SDK_CLIENT_ID = 'aus-process-env';
    process.env.ZOOM_SDK_CLIENT_SECRET = 'aus-process-env-secret';
    const creds = readCredentials({ ZOOM_SDK_CLIENT_ID: 'uebergeben', ZOOM_SDK_CLIENT_SECRET: 'uebergeben-secret' });
    assert(creds.clientId === 'uebergeben' && creds.clientSecret === 'uebergeben-secret', 'die uebergebene Umgebung wird gelesen, nicht process.env');

    const tempFile = `${tmpdir()}/zoom-test-${Date.now()}-env.json`;
    writeFileSync(tempFile, JSON.stringify({ clientId: 'datei-id', client_secret: 'datei-secret' }), 'utf8');
    const ausDatei = readCredentials({ ZOOM_SDK_CREDENTIALS: tempFile });
    unlinkSync(tempFile);
    assert(ausDatei.clientId === 'datei-id' && ausDatei.clientSecret === 'datei-secret', 'auch der Dateipfad kommt aus der uebergebenen Umgebung');

    let warf = false;
    try {
      readCredentials({});
    } catch {
      warf = true;
    }
    assert(warf, 'eine leere uebergebene Umgebung wirft - process.env springt NICHT ein');

    // GEMESSEN (Node 24): JSON.parse zitiert in seiner Fehlermeldung einen
    // AUSSCHNITT DER EINGABE ('..."tSecret": GEHEIM-xyz"... is not valid
    // JSON'). Die Steuerung druckt e.message - eine kaputte Zugangsdaten-Datei
    // braechte so das Secret auf den Schirm des Operators.
    const kaputtDatei = `${tmpdir()}/zoom-test-${Date.now()}-kaputt.json`;
    writeFileSync(kaputtDatei, '{"clientId": "id-ok", "clientSecret": GEHEIM-xyz}', 'utf8');
    let meldung = '';
    try {
      readCredentials({ ZOOM_SDK_CREDENTIALS: kaputtDatei });
    } catch (e) {
      meldung = (e as Error).message;
    }
    unlinkSync(kaputtDatei);
    assert(meldung.includes('ZOOM_SDK_CREDENTIALS') && meldung.includes('JSON'), 'kaputte Datei: die Meldung nennt Variable und Ursache');
    assert(!meldung.includes('GEHEIM') && !meldung.includes('id-ok'), 'kaputte Datei: KEIN Ausschnitt des Inhalts in der Meldung');
  } finally {
    process.env = savedEnv;
  }
}

console.log('\nreadCredentials — Datei mit BOM (UTF-8 mit BOM, UTF-16):');
{
  // GEMESSEN (Nachbesserung Einsatzpaket): start.ps1 liest die Datei mit
  // Get-Content | ConvertFrom-Json und vertraegt einen BOM - readCredentials
  // las bisher readFileSync(...,'utf8') und liess U+FEFF stehen. Folge: das
  // Start-Skript erklaerte die Datei fuer gueltig, zoom-join.exe wies dieselbe
  // Datei als "kein gueltiges JSON" ab. Windows PowerShell 5.1 schreibt mit
  // Set-Content -Encoding UTF8 einen BOM, Notepad mit "UTF-16" ebenfalls -
  // solche Dateien entstehen leicht. Beide Pruefer muessen dasselbe sagen.
  const json = JSON.stringify({ clientId: 'bom-id', clientSecret: 'bom-secret' });
  const be = Buffer.from(json, 'utf16le');
  be.swap16();
  const varianten: [string, Buffer][] = [
    ['UTF-8 mit BOM (EF BB BF)', Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(json, 'utf8')])],
    ['UTF-16 LE mit BOM (FF FE)', Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(json, 'utf16le')])],
    ['UTF-16 BE mit BOM (FE FF)', Buffer.concat([Buffer.from([0xfe, 0xff]), be])],
  ];
  for (const [name, inhalt] of varianten) {
    const datei = `${tmpdir()}/zoom-test-${Date.now()}-bom.json`;
    writeFileSync(datei, inhalt);
    let ergebnis = '';
    try {
      const c = readCredentials({ ZOOM_SDK_CREDENTIALS: datei });
      ergebnis = `${c.clientId}|${c.clientSecret}`;
    } catch (e) {
      ergebnis = `WARF: ${(e as Error).message}`;
    }
    unlinkSync(datei);
    assert(ergebnis === 'bom-id|bom-secret', `${name}: wird gelesen wie ohne BOM`);
  }
}

console.log('\nprotocol — Meeting-Nummer aufraeumen:');
{
  // ACHTUNG: FREI ERFUNDENE Nummer, KEINE echte Meeting-Nummer (Abschluss-
  // Sichtung Punkt I) - eine fruehere Fassung benutzte woertlich die Nummer
  // des Stage-0-Spikes. Der Wert ist fuer diese Zusicherungen gleichgueltig
  // (es geht nur um Leerzeichen/Bindestriche vs. reine Ziffern) - bitte NICHT
  // "realistischer" machen.
  assert(normalizeMeetingId('111 2222 3333') === '11122223333', 'Leerzeichen fallen weg');
  assert(normalizeMeetingId('111-2222-3333') === '11122223333', 'Bindestriche fallen weg');
  assert(normalizeMeetingId('11122223333') === '11122223333', 'reine Ziffern bleiben');
  let threw = false;
  let badMeetingIdMsg = '';
  try {
    normalizeMeetingId('111abc3333');
  } catch (e) {
    threw = true;
    badMeetingIdMsg = (e as Error).message;
  }
  // Buchstaben still zu entfernen waere die gefaehrliche Variante: aus einer falschen
  // Eingabe wuerde klaglos eine falsche Nummer, und der Beitritt scheiterte spaeter
  // aus scheinbar unerklaerlichem Grund.
  assert(threw, 'Buchstaben werden abgewiesen, nicht still entfernt');
  // Nachbesserung 1, Befund B: die Meldung darf die fehlerhafte Eingabe nicht
  // wiederholen - der haeufigste Vertipper ist ein Kenncode im Nummernfeld.
  assert(!badMeetingIdMsg.includes('111abc3333'), 'die Fehlermeldung wiederholt die fehlerhafte Eingabe nicht');
}

console.log('\nprotocol — Fehlerkatalog:');
{
  assert(sdkErrorName(0) === 'SDKERR_SUCCESS', 'Code 0 ist SDKERR_SUCCESS');
  // Zwei am echten SDK GEMESSENE Anker: Lauf 1 lieferte 7 fuer den
  // uninitialisierten Zustand, Lauf 4 lieferte 12 fuer die fehlende Erlaubnis.
  assert(sdkErrorName(7) === 'SDKERR_UNINITIALIZE', 'Code 7 ist SDKERR_UNINITIALIZE (gemessen, Lauf 1)');
  assert(sdkErrorName(12) === 'SDKERR_NO_PERMISSION', 'Code 12 ist SDKERR_NO_PERMISSION (gemessen, Lauf 4)');
  assert(sdkErrorName(9999) === 'SDKERR_UNKNOWN(9999)', 'unbekannter Code wird nicht gerundet');

  const names = Object.values(SDK_ERROR_NAMES);
  assert(new Set(names).size === names.length, 'kein Name kommt zweimal vor');
  assert(names.length === 38, 'der Katalog hat 38 Eintraege (zoom_sdk_def.h, Fassung 7.1.5)');

  assert(authResultName(0) === 'AUTHRET_SUCCESS', 'AuthResult 0 ist AUTHRET_SUCCESS');
  assert(authResultName(11) === 'AUTHRET_JWTTOKENWRONG', 'AuthResult 11 ist AUTHRET_JWTTOKENWRONG');
  assert(authResultName(77) === 'AUTHRET_UNKNOWN_CODE(77)', 'unbekannter AuthResult wird nicht gerundet');
  const auths = Object.values(AUTH_RESULT_NAMES);
  assert(new Set(auths).size === auths.length, 'kein AuthResult-Name kommt zweimal vor');
}

console.log('\nprotocol — code bedeutet je nach status etwas anderes:');
{
  // MEETING_FAIL_PASSWORD_ERR = 4 und EndMeetingReason_NoAttendee = 4.
  // Derselbe Zahlenwert, zwei voellig verschiedene Aussagen. Wer den Code ohne
  // den Status ausliest, liest Kaffeesatz.
  const a = explainStatus('failed', 4);
  const b = explainStatus('ended', 4);
  assert(a !== b, 'failed(4) und ended(4) ergeben verschiedene Klartexte');
  assert(a.includes('Kenncode'), 'failed(4) nennt den falschen Kenncode');
  assert(b.includes('niemand'), 'ended(4) nennt, dass niemand mehr da war');
  assert(explainStatus('connecting', 4) !== a, 'bei connecting bedeutet 4 nichts Verwertbares');
}

console.log('\nprotocol — Zeilenteiler:');
{
  const s = new LineSplitter();
  assert(s.push('{"ev":"bye"}\n').length === 1, 'eine ganze Zeile ergibt ein Stueck');

  const s2 = new LineSplitter();
  // DIE Falle: die Puffergrenze faellt mitten ins JSON. Wer je Datenpaket parst,
  // verliert hier ein Ereignis — und merkt es nie, weil nichts abstuerzt.
  assert(s2.push('{"ev":"re').length === 0, 'halbe Zeile ergibt noch nichts');
  const rest = s2.push('ady","sdkVersion":"7.1.5"}\n');
  assert(rest.length === 1 && rest[0] === '{"ev":"ready","sdkVersion":"7.1.5"}', 'die zweite Haelfte vervollstaendigt sie');

  const s3 = new LineSplitter();
  assert(s3.push('{"ev":"bye"}\n{"ev":"bye"}\n').length === 2, 'zwei Zeilen in einem Puffer ergeben zwei Stuecke');

  const s4 = new LineSplitter();
  assert(s4.push('{"ev":"bye"}\r\n').length === 1, 'CRLF wird wie LF behandelt');
  assert(s4.push('{"ev":"bye"}\r\n')[0] === '{"ev":"bye"}', 'das \\r bleibt nicht am Ende haengen');
}

console.log('\nprotocol — Ereignisse lesen:');
{
  assert(parseWireEvent('{"ev":"bye"}')?.ev === 'bye', 'wohlgeformtes Ereignis wird gelesen');
  assert(parseWireEvent('nicht json') === null, 'kaputtes JSON ergibt null, es wirft nicht');
  assert(parseWireEvent('') === null, 'leere Zeile ergibt null');
  assert(parseWireEvent('{"kein":"ev"}') === null, 'Objekt ohne ev ergibt null');
  assert(parseWireEvent('{"ev":"voellig_neu"}')?.ev === 'voellig_neu', 'unbekanntes Ereignis kommt durch, es wird nicht verworfen');
  assert(parseWireEvent('[1,2,3]') === null, 'ein Array ist kein Ereignis');
}

console.log('\nprotocol — Anreicherung:');
{
  const e = enrich({ ev: 'error', where: 'join', code: 12 });
  assert(e.ev === 'error' && (e as { name: string }).name === 'SDKERR_NO_PERMISSION', 'error bekommt seinen Namen dazu');

  const a = enrich({ ev: 'auth', code: 0 });
  assert((a as { result: string }).result === 'AUTHRET_SUCCESS', 'auth bekommt result dazu');

  const t = enrich({ ev: 'error', where: 'join', code: 'joinTimeout' });
  assert((t as { name: string }).name === 'JOIN_TIMEOUT', 'ein selbst erzeugter Fehler behaelt seinen eigenen Namen');

  // Zwei verschiedene Ursachen duerfen nie dieselbe Meldung bekommen: die
  // Anmeldung hat ihren EIGENEN Timeout-Code, nicht den des Beitritts.
  const at = enrich({ ev: 'error', where: 'auth', code: 'authTimeout' });
  assert((at as { name: string }).name === 'AUTH_TIMEOUT', 'ein Anmelde-Timeout traegt AUTH_TIMEOUT');
  assert(
    (t as { name: string }).name !== (at as { name: string }).name,
    'Beitritts-Timeout und Anmelde-Timeout tragen verschiedene Namen - sonst sucht man den Fehler am falschen Ort',
  );

  // Der native EOF-Wachhund fuer einen noch offenen Beitritt (main.cpp,
  // sessionJoinPending()) misst eine ANDERE Ursache als joinTimeout oben (das
  // misst hier in bridge.ts, ob je ein Endzustand erreicht wird) - er bekommt
  // darum seinen EIGENEN Code.
  const je = enrich({ ev: 'error', where: 'join', code: 'joinEofTimeout' });
  assert((je as { name: string }).name === 'JOIN_EOF_TIMEOUT', 'ein EOF-Beitrittstimeout traegt JOIN_EOF_TIMEOUT');
  assert(
    (je as { name: string }).name !== (t as { name: string }).name,
    'EOF-Beitrittstimeout und Beitritts-Endzustand-Timeout tragen verschiedene Namen - zwei verschiedene Ursachen, zwei verschiedene Namen',
  );

  // Der native EOF-Wachhund fuer eine noch offene Aufnahme-Erlaubnis-Anfrage
  // (main.cpp, sessionPrivilegePending()) - RequestLocalRecordingPrivilege()
  // beantwortet sich ASYNCHRON ueber onLocalRecordingPrivilegeRequestStatus,
  // dieselbe Rennbedingung wie bei auth/join, aber eine ANDERE Ursache als
  // jede der drei oben - keine von ihnen beschreibt eine Aufnahme-Erlaubnis.
  const pe = enrich({ ev: 'error', where: 'privilege', code: 'privilegeEofTimeout' });
  assert(
    (pe as { name: string }).name === 'PRIVILEGE_EOF_TIMEOUT',
    'ein EOF-Erlaubnistimeout traegt PRIVILEGE_EOF_TIMEOUT',
  );
  // Gegenprobe: die Erlaubnis-EOF-Meldung traegt einen ANDEREN Namen als jede
  // ihrer drei Geschwister - sonst sucht man den Fehler am falschen Ort.
  assert(
    (pe as { name: string }).name !== (at as { name: string }).name &&
      (pe as { name: string }).name !== (t as { name: string }).name &&
      (pe as { name: string }).name !== (je as { name: string }).name,
    'Erlaubnis-EOF-Timeout traegt einen anderen Namen als authTimeout, joinTimeout und joinEofTimeout',
  );

  // sessionLeave()s eigene 5-s-Pumpobergrenze (session.cpp) - eine ANDERE
  // Ursache als alle vier oben: sie misst nicht die ANMELDUNG, den BEITRITT
  // oder die AUFNAHME-ERLAUBNIS, sondern das VERLASSEN - nach einer
  // abgelaufenen Frist (Owner-Entscheidung, Abschluss-Sichtung Punkt A) die
  // letzte verwertbare Information vor einem moeglichen TerminateProcess.
  // Kam bereits in Aufgabe 7 auf die Leitung, hatte aber NIE eine
  // Zusicherung (Abschluss-Sichtung, Punkt C) - ohne sie waere
  // OWN_UNKNOWN(leaveTimeout) kein stiller Fehler gewesen, aber ein
  // ungeprueftes Loch im Katalog.
  const le = enrich({ ev: 'error', where: 'leave', code: 'leaveTimeout' });
  assert((le as { name: string }).name === 'LEAVE_TIMEOUT', 'eine abgelaufene Leave-Pumpobergrenze traegt LEAVE_TIMEOUT');
  assert(
    (le as { name: string }).name !== (at as { name: string }).name &&
      (le as { name: string }).name !== (t as { name: string }).name &&
      (le as { name: string }).name !== (je as { name: string }).name &&
      (le as { name: string }).name !== (pe as { name: string }).name,
    'Leave-Timeout traegt einen anderen Namen als authTimeout, joinTimeout, joinEofTimeout und privilegeEofTimeout',
  );

  // bridge.ts' stop()-Nachbrenner (Nachbesserung 1, Befund A): schlaegt das
  // erzwungene kill() fehl, darf das nicht spurlos verschwinden - eine ANDERE
  // Ursache als jede der fuenf oben, denn sie misst das GEGENTEIL vom Start
  // bzw. vom eigenmaechtigen Ende (exited): der Prozess laesst sich am ENDE
  // nicht mehr beenden.
  const kf = enrich({ ev: 'error', where: 'stop', code: 'killFailed' });
  assert((kf as { name: string }).name === 'KILL_FAILED', 'ein gescheitertes kill() traegt KILL_FAILED');
  assert(
    (kf as { name: string }).name !== (at as { name: string }).name &&
      (kf as { name: string }).name !== (t as { name: string }).name &&
      (kf as { name: string }).name !== (je as { name: string }).name &&
      (kf as { name: string }).name !== (pe as { name: string }).name &&
      (kf as { name: string }).name !== (le as { name: string }).name,
    'kill()-Fehlschlag traegt einen anderen Namen als authTimeout, joinTimeout, joinEofTimeout, privilegeEofTimeout und leaveTimeout',
  );

  // bridge.ts' dauerhafter stdin-Lauscher (Nachbesserung 2): ein asynchroner
  // Fehler beim SENDEN (write nach end, EPIPE) ist eine ANDERE Ursache als
  // killFailed (das misst das TERMINIEREN) und erst recht als jede der fuenf
  // vorherigen - zwei verschiedene Vorgaenge duerfen nie denselben Namen tragen.
  const se = enrich({ ev: 'error', where: 'stdin', code: 'stdinError' });
  assert((se as { name: string }).name === 'STDIN_ERROR', 'ein asynchroner stdin-Fehler traegt STDIN_ERROR');
  assert(
    (se as { name: string }).name !== (at as { name: string }).name &&
      (se as { name: string }).name !== (t as { name: string }).name &&
      (se as { name: string }).name !== (je as { name: string }).name &&
      (se as { name: string }).name !== (pe as { name: string }).name &&
      (se as { name: string }).name !== (le as { name: string }).name &&
      (se as { name: string }).name !== (kf as { name: string }).name,
    'stdin-Fehler traegt einen anderen Namen als authTimeout, joinTimeout, joinEofTimeout, privilegeEofTimeout, leaveTimeout und killFailed',
  );

  const b = enrich({ ev: 'bye' });
  assert(b.ev === 'bye' && Object.keys(b).length === 1, 'was nichts braucht, wird nicht angereichert');
}

console.log('\nprotocol - privilege traegt seine Ursache (source):');
{
  // Drei verschiedene Ursachen im nativen Teil koennen dieselbe Kombination
  // aus ev/canRecordRaw melden (Nachbesserung 1, Befund A) - "source"
  // unterscheidet sie. Erst ueber parseWireEvent lesen (wie die Bridge es
  // tatsaechlich empfangen wuerde), dann pruefen, dass enrich() das Feld
  // unveraendert durchreicht (enrich() fasst 'privilege' nicht eigens an).
  const broadcast = parseWireEvent('{"ev":"privilege","canRecordRaw":true,"source":"broadcast"}');
  const requestAnswer = parseWireEvent('{"ev":"privilege","canRecordRaw":true,"source":"requestAnswer"}');
  const check = parseWireEvent('{"ev":"privilege","canRecordRaw":true,"source":"check"}');
  assert((broadcast as { source: string } | null)?.source === 'broadcast', 'ein Rundruf traegt source:broadcast');
  assert((requestAnswer as { source: string } | null)?.source === 'requestAnswer', 'eine Gesuchsantwort traegt source:requestAnswer');
  assert((check as { source: string } | null)?.source === 'check', 'eine Sofortpruefung traegt source:check');
  assert(
    (broadcast as { source: string }).source !== (requestAnswer as { source: string }).source &&
      (requestAnswer as { source: string }).source !== (check as { source: string }).source &&
      (broadcast as { source: string }).source !== (check as { source: string }).source,
    'alle drei source-Werte sind paarweise verschieden - drei Ursachen, drei Namen',
  );

  const enrichedCheck = enrich(check!);
  assert((enrichedCheck as { source: string }).source === 'check', 'enrich() reicht source unveraendert durch');
}

console.log('\nprotocol — Befehle schreiben:');
{
  assert(serializeCommand({ cmd: 'init' }) === '{"cmd":"init"}\n', 'init endet mit genau einem Zeilenumbruch');
  const j = serializeCommand({ cmd: 'join', meetingId: '11122223333', passcode: 'a"b', displayName: 'JM Connect' }); // erfunden, siehe Punkt I oben
  assert(j.endsWith('\n') && j.split('\n').length === 2, 'auch join ist genau eine Zeile');
  assert(JSON.parse(j).passcode === 'a"b', 'Anfuehrungszeichen im Kenncode werden maskiert');
}

import { initialSession, isSettled, reduce, type Session } from '../src/state.ts';

function person(over: Partial<Participant> = {}): Participant {
  return {
    id: 1,
    name: 'Alex',
    persistentId: 'p-alex',
    self: false,
    videoOn: true,
    hasCamera: true,
    inWaitingRoom: false,
    role: 'host',
    ...over,
  };
}

function run(events: BridgeEvent[]): Session {
  return events.reduce((s, e) => reduce(s, enrich(e)), initialSession());
}

console.log('\nstate — ruhende Zustaende:');
{
  // DER Testfall des Spikes: der Beitritt hing 90 Sekunden bei CONNECTING.
  // Ein Wachhund, der bei "connecting" einschlaeft, haette genau das verschlafen.
  assert(!isSettled('connecting'), 'connecting ist NICHT ruhend — sonst verschlaeft der Wachhund den Haenger');
  assert(!isSettled('reconnecting'), 'reconnecting ist nicht ruhend');
  assert(!isSettled('disconnecting'), 'disconnecting ist nicht ruhend');
  assert(!isSettled('idle'), 'idle ist nicht ruhend');
  assert(!isSettled('other'), 'other ist nicht ruhend');
  assert(isSettled('inMeeting'), 'inMeeting ist ruhend');
  assert(isSettled('waitingRoom'), 'waitingRoom ist ruhend — dort ist Warten die richtige Antwort');
  assert(isSettled('waitingForHost'), 'waitingForHost ist ruhend');
  assert(isSettled('failed'), 'failed ist ruhend');
  assert(isSettled('ended'), 'ended ist ruhend');
}

console.log('\nstate — sauberer Beitritt:');
{
  const s = run([
    { ev: 'ready', sdkVersion: '7.1.5' },
    { ev: 'auth', code: 0 },
    { ev: 'status', status: 'connecting', raw: 1, code: 0 },
    { ev: 'status', status: 'inMeeting', raw: 3, code: 0 },
    { ev: 'roster', list: [person(), person({ id: 2, name: 'Bridge', self: true, role: 'attendee' })] },
  ]);
  assert(s.phase === 'inMeeting', 'Phase ist inMeeting');
  assert(s.meeting === 'inMeeting', 'Meeting-Status ist inMeeting');
  assert(s.participants.size === 2, 'zwei Teilnehmer bekannt');
  assert(s.participants.get(2)?.self === true, 'die Bridge erkennt sich selbst');
  assert(s.lastError === null, 'kein Fehler');
}

console.log('\nstate — Warteraum und verspaeteter Gastgeber:');
{
  const a = run([
    { ev: 'status', status: 'waitingRoom', raw: 10, code: 0 },
    { ev: 'status', status: 'inMeeting', raw: 3, code: 0 },
  ]);
  assert(a.meeting === 'inMeeting' && a.phase !== 'error', 'Warteraum ist kein Fehler');

  const b = run([
    { ev: 'status', status: 'waitingForHost', raw: 2, code: 0 },
    { ev: 'status', status: 'inMeeting', raw: 3, code: 0 },
  ]);
  assert(b.meeting === 'inMeeting' && b.phase !== 'error', 'auf den Gastgeber warten ist kein Fehler');
}

console.log('\nstate — Erlaubnis kommt verspaetet:');
{
  const s = run([
    { ev: 'status', status: 'inMeeting', raw: 3, code: 0 },
    { ev: 'privilege', canRecordRaw: false, source: 'check', requested: true },
    { ev: 'privilege', canRecordRaw: true, source: 'requestAnswer' },
  ]);
  assert(s.canRecordRaw === true, 'nach der Freigabe darf aufgenommen werden');
  assert(s.privilegeRequested === true, 'dass gefragt wurde, bleibt sichtbar');
  assert(s.phase === 'inMeeting', 'die fehlende Erlaubnis war nie ein Fehler');
}

console.log('\nstate - Zeitueberschreitung ist ENDGUELTIG, "gerade gefragt" ist es NICHT:');
{
  // Vorher (bis Nachbesserung 1) waren diese beiden nativen Zeilen byte-gleich
  // - {"canRecordRaw":false,"requested":true} - obwohl der eine Zustand
  // VORUEBERGEHEND ist (Antwort steht noch aus, checkPrivilege()) und der
  // andere ENDGUELTIG (das SDK hat aufgegeben, onLocalRecordingPrivilegeRequestStatus
  // im Timeout-Zweig). Wer auf "die Antwort steht noch aus" wartet, wuerde bei
  // einer Zeitueberschreitung ohne diese Unterscheidung fuer immer warten.
  const pending = run([
    { ev: 'status', status: 'inMeeting', raw: 3, code: 0 },
    { ev: 'privilege', canRecordRaw: false, source: 'check', requested: true },
  ]);
  assert(pending.privilegeTimedOut === false, 'gerade erst gefragt: NICHT als endgueltig aufgegeben markiert');
  assert(pending.privilegeRequested === true, 'gerade erst gefragt: das Gesuch selbst ist trotzdem sichtbar');

  const timedOut = run([
    { ev: 'status', status: 'inMeeting', raw: 3, code: 0 },
    { ev: 'privilege', canRecordRaw: false, source: 'requestAnswer', requested: true, timedOut: true },
  ]);
  assert(timedOut.privilegeTimedOut === true, 'Zeitueberschreitung: ENDGUELTIG als "keine Antwort mehr" markiert');
  assert(timedOut.privilegeRequested === true, 'Zeitueberschreitung: das Gesuch selbst bleibt sichtbar');
  assert(timedOut.phase !== 'error', 'eine Zeitueberschreitung ist weiterhin kein Fehler (Timeout ist keine Ablehnung)');

  // Eine SPAETERE, erfolgreiche Antwort hebt eine fruehere Zeitueberschreitung
  // wieder auf - privilegeTimedOut spiegelt das ZULETZT verarbeitete Ereignis,
  // genau wie canRecordRaw, nicht eine einmal gesetzte Flagge fuer immer.
  const recovered = run([
    { ev: 'status', status: 'inMeeting', raw: 3, code: 0 },
    { ev: 'privilege', canRecordRaw: false, source: 'requestAnswer', requested: true, timedOut: true },
    { ev: 'privilege', canRecordRaw: true, source: 'broadcast' },
  ]);
  assert(recovered.privilegeTimedOut === false, 'eine spaetere Freigabe hebt eine fruehere Zeitueberschreitung auf');
  assert(recovered.canRecordRaw === true, 'und die Freigabe selbst ist angekommen');
}

console.log('\nstate - Ablehnung ist von "warte noch" unterscheidbar:');
{
  // Dieselbe Falle wie bei privilegeTimedOut oben (Nachbesserung 1, Befund
  // B), nur fuer eine ANDERE Ursache (Abschluss-Sichtung, Punkt D): eine
  // Ablehnung ({"denied":true}, callbacks.cpp
  // RecordingListener::onLocalRecordingPrivilegeRequestStatus,
  // RequestLocalRecording_Denied) landete VOR dieser Aenderung byte-gleich
  // im Zustand wie "gerade gefragt, Antwort steht noch aus"
  // (canRecordRaw:false, privilegeRequested:true, privilegeTimedOut:false) -
  // reduce() las das denied-Feld schlicht nicht. Wer auf eine
  // Zustandsaenderung wartet (Stage 4), haette nach einer Ablehnung fuer
  // immer gewartet.
  const denied = run([
    { ev: 'status', status: 'inMeeting', raw: 3, code: 0 },
    { ev: 'privilege', canRecordRaw: false, source: 'requestAnswer', denied: true },
  ]);
  assert(denied.privilegeDenied === true, 'eine Ablehnung kommt im Zustand an');
  assert(denied.canRecordRaw === false, 'nach einer Ablehnung darf nicht aufgenommen werden');
  assert(denied.phase !== 'error', 'eine Ablehnung ist kein Fehler - sie ist eine gueltige Antwort');

  const pending = run([
    { ev: 'status', status: 'inMeeting', raw: 3, code: 0 },
    { ev: 'privilege', canRecordRaw: false, source: 'check', requested: true },
  ]);
  assert(
    pending.privilegeDenied === false,
    '"gerade gefragt" ist NICHT als abgelehnt markiert - unterscheidbar von einer echten Ablehnung',
  );

  // Eine SPAETERE Freigabe hebt eine fruehere Ablehnung wieder auf -
  // privilegeDenied spiegelt das ZULETZT verarbeitete Ereignis, genau wie
  // canRecordRaw und privilegeTimedOut, nicht eine einmal gesetzte Flagge.
  const recoveredFromDenial = run([
    { ev: 'status', status: 'inMeeting', raw: 3, code: 0 },
    { ev: 'privilege', canRecordRaw: false, source: 'requestAnswer', denied: true },
    { ev: 'privilege', canRecordRaw: true, source: 'broadcast' },
  ]);
  assert(recoveredFromDenial.privilegeDenied === false, 'eine spaetere Freigabe hebt eine fruehere Ablehnung auf');
  assert(recoveredFromDenial.canRecordRaw === true, 'und die Freigabe selbst ist angekommen');
}

console.log('\nstate — Teilnehmer kommen, heissen anders, gehen:');
{
  const s = run([
    { ev: 'status', status: 'inMeeting', raw: 3, code: 0 },
    { ev: 'roster', list: [person()] },
    { ev: 'joined', p: person({ id: 2, name: 'Bea' }) },
    { ev: 'renamed', id: 2, name: 'Beatrix' },
    { ev: 'left', id: 1 },
  ]);
  assert(s.participants.size === 1, 'einer ist gegangen, einer ist da');
  assert(s.participants.get(2)?.name === 'Beatrix', 'die Umbenennung ist angekommen');

  // Ereignisse koennen sich ueberholen. Keiner dieser Faelle ist ein Fehler.
  const t = run([
    { ev: 'status', status: 'inMeeting', raw: 3, code: 0 },
    { ev: 'left', id: 99 },
    { ev: 'renamed', id: 98, name: 'Geist' },
    { ev: 'joined', p: person({ id: 5 }) },
    { ev: 'joined', p: person({ id: 5, name: 'Alex zum Zweiten' }) },
  ]);
  assert(t.phase === 'inMeeting', 'ueberholende Ereignisse sind kein Fehler');
  assert(t.participants.size === 1, 'ein zweites joined verdoppelt nicht, es aktualisiert');
  assert(t.participants.get(5)?.name === 'Alex zum Zweiten', 'das zweite joined hat aktualisiert');
  assert(!t.participants.has(98), 'ein renamed fuer einen Unbekannten legt niemanden an');
}

console.log('\nstate — Wiederverbindung ersetzt die Karte vollstaendig:');
{
  const s = run([
    { ev: 'status', status: 'inMeeting', raw: 3, code: 0 },
    { ev: 'roster', list: [person({ id: 11 }), person({ id: 12, name: 'Bea' })] },
    { ev: 'status', status: 'reconnecting', raw: 5, code: 0 },
    { ev: 'status', status: 'inMeeting', raw: 3, code: 0 },
    // Nach der Wiederverbindung sind die IDs ANDERE. Wer nur ergaenzt, behaelt
    // Karteileichen und laesst spaeter NDI-Sender fuer Geister laufen.
    { ev: 'roster', list: [person({ id: 21 }), person({ id: 22, name: 'Bea' })] },
  ]);
  assert(s.participants.size === 2, 'die Karte hat zwei Eintraege, nicht vier');
  assert(s.participants.has(21) && !s.participants.has(11), 'die alten IDs sind weg');
}

console.log('\nstate — Abbruch und Fehler:');
{
  const s = run([
    { ev: 'status', status: 'inMeeting', raw: 3, code: 0 },
    { ev: 'status', status: 'ended', raw: 7, code: 2 },
  ]);
  assert(s.phase !== 'error', 'ein beendetes Meeting ist kein Fehler');
  assert(s.meeting === 'ended', 'der Status ist ended');

  const e = run([{ ev: 'error', where: 'join', code: 12 }]);
  assert(e.phase === 'error', 'nur ein error-Ereignis fuehrt in die Fehlerphase');
  assert(e.lastError?.name === 'SDKERR_NO_PERMISSION', 'der Fehler traegt seinen Namen');
  assert(e.lastError?.where === 'join', 'und die Stelle, an der er auftrat');
}

console.log('\nstate — ein Video-Fehler kippt die SITZUNG nicht:');
{
  // Abschluss-Sichtung, I5. Stage 2 bringt Fehler, die im NORMALBETRIEB
  // auftreten: zweimal geklickt (videoAlreadySubscribed), ein
  // bufferMismatch mitten in der Sendung. Wuerden die phase auf 'error'
  // setzen, stuende eine laufende Sitzung fuer immer als kaputt da - und
  // test/join.mjs wie test/video-limit.mjs benutzen phase === 'error' als
  // Abbruchmerkmal, der Messlauf haette sich also selbst ausgehebelt.
  const laufend = run([
    { ev: 'status', status: 'inMeeting', raw: 3, code: 0 },
    { ev: 'error', where: 'video', code: 'videoAlreadySubscribed' },
  ]);
  assert(laufend.phase === 'inMeeting', 'ein Video-Fehler laesst die Phase stehen, wo sie war');
  // Der Fehler VERSCHWINDET deswegen nicht - nur die Sitzung ist nicht kaputt.
  assert(laufend.lastError?.name === 'VIDEO_ALREADY_SUBSCRIBED', 'der Video-Fehler steht trotzdem in lastError');
  assert(laufend.lastError?.where === 'video', 'samt der Stelle, an der er auftrat');

  const mismatch = run([
    { ev: 'status', status: 'inMeeting', raw: 3, code: 0 },
    { ev: 'error', where: 'video', code: 'videoBufferMismatch' },
  ]);
  assert(mismatch.phase === 'inMeeting', 'auch ein bufferMismatch mitten in der Sendung kippt die Sitzung nicht');

  // DIE GEGENPROBE, und sie ist der eigentliche Punkt: die Ausnahme gilt
  // NUR fuer where:'video'. Ein Fehler mit einer anderen Stelle muss
  // weiterhin in die Fehlerphase fuehren - sonst waere aus der Ausnahme
  // stillschweigend die Regel geworden.
  const woanders = run([
    { ev: 'status', status: 'inMeeting', raw: 3, code: 0 },
    { ev: 'error', where: 'auth', code: 'authTimeout' },
  ]);
  assert(woanders.phase === 'error', 'ein Fehler mit anderem where kippt die Sitzung sehr wohl');

  // where:'ndi' ist AUSDRUECKLICH kein Video-Fehler in diesem Sinne: "auf
  // diesem Rechner geht NDI gar nicht" ist eine Aussage ueber den Aufbau,
  // nicht ueber ein einzelnes Abo.
  const ndi = run([
    { ev: 'status', status: 'inMeeting', raw: 3, code: 0 },
    { ev: 'error', where: 'ndi', code: 'ndiInitFailed' },
  ]);
  assert(ndi.phase === 'error', 'eine fehlende NDI-Laufzeit kippt die Sitzung sehr wohl');
}

console.log('\nstate — ein TON-Fehler kippt die SITZUNG genausowenig:');
{
  // Schlusspruefung Stage 3, Critical 1: dieselbe Ausnahme wie beim Bild
  // eine Zeile hoeher - Stage 3 hat vier where:'audio'-Schluessel dazugelegt
  // und die Ausnahme zunaechst NICHT mitgezogen. Zwei davon treten im
  // NORMALBETRIEB auf: audioQueueOverflow bei jedem Hakler der Hauptschleife
  // jenseits einer halben Sekunde, audioBufferMismatch mitten in einem
  // laufenden Abo. Beide setzten die Phase ENDGUELTIG auf 'error' (keine
  // Verzweigung holt eine Sitzung da wieder heraus, 'bye' schreibt sie
  // ausdruecklich fort), waehrend Bild und Ton einwandfrei weiterliefen.
  const ueberlauf = run([
    { ev: 'status', status: 'inMeeting', raw: 3, code: 0 },
    { ev: 'error', where: 'audio', code: 'audioQueueOverflow' },
  ]);
  assert(ueberlauf.phase === 'inMeeting', 'ein Ueberlauf laesst die Phase stehen, wo sie war');
  assert(ueberlauf.lastError?.name === 'AUDIO_QUEUE_OVERFLOW', 'der Ton-Fehler steht trotzdem in lastError');

  // Und die Kennung kommt MIT an. Sie ist der ganze Grund, aus dem
  // audioBufferMismatch eine traegt: ohne sie liesse sich die Zeile keinem
  // Gast zuordnen. Der Reducer verwarf sie vorher stillschweigend.
  const mismatch = run([
    { ev: 'status', status: 'inMeeting', raw: 3, code: 0 },
    { ev: 'error', where: 'audio', code: 'audioBufferMismatch', id: 16778240 },
  ]);
  assert(mismatch.phase === 'inMeeting', 'auch ein Puffer-Fehler mitten im Abo kippt die Sitzung nicht');
  assert(mismatch.lastError?.id === 16778240, 'die Kennung des betroffenen Abos steht in lastError');

  // GEGENPROBE zur Kernregel "Keine erfundenen Werte": audioQueueOverflow
  // traegt AUSDRUECKLICH keine id (eine Aussage ueber die Maschine, nicht
  // ueber einen Gast) - dann darf auch in lastError keine stehen.
  assert(ueberlauf.lastError?.id === undefined, 'ohne id im Ereignis erfindet der Reducer keine');
}

console.log('\nstate — reduce veraendert nichts Bestehendes:');
{
  // Ausgangszustand: zwei Teilnehmer
  const initialState = run([
    { ev: 'status', status: 'inMeeting', raw: 3, code: 0 },
    { ev: 'roster', list: [person({ id: 1, name: 'Alex' }), person({ id: 2, name: 'Bea' })] },
  ]);

  // Referenzen festhalten VOR dem reduce
  const oldSession = initialState;
  const oldParticipants = oldSession.participants;
  const oldAlex = oldParticipants.get(1)!;

  // renamed aufrufen
  const newSession = reduce(oldSession, enrich({ ev: 'renamed', id: 1, name: 'Alexander' }));

  // Behauptungen fuer renamed:
  assert(oldAlex.name === 'Alex', 'der alte Participant hat seinen Namen nicht geaendert');
  assert(oldParticipants.get(1)?.name === 'Alex', 'die alte Map hat den alten Namen');
  assert(oldSession !== newSession, 'reduce gibt ein ANDERES Session-Objekt zurueck');
  assert(oldParticipants !== newSession.participants, 'die neue Map ist eine ANDERE Map');
  assert(newSession.participants.get(1)?.name === 'Alexander', 'die neue Map hat den neuen Namen');

  // Wiederverbindung: alte Map festhalten
  const beforeRoster = newSession;
  const oldParticipantsBeforeRoster = beforeRoster.participants;
  const afterRoster = reduce(
    beforeRoster,
    enrich({ ev: 'roster', list: [person({ id: 21 }), person({ id: 22, name: 'Bea' })] }),
  );

  // Behauptungen fuer roster:
  assert(oldParticipantsBeforeRoster.has(1), 'die alte Map hat noch die alten IDs');
  assert(oldParticipantsBeforeRoster !== afterRoster.participants, 'roster gibt eine ANDERE Map zurueck');
  assert(!afterRoster.participants.has(1), 'die neue Map hat die neuen IDs');

  // joined: alte Map festhalten
  const beforeJoined = run([
    { ev: 'status', status: 'inMeeting', raw: 3, code: 0 },
    { ev: 'roster', list: [person({ id: 1, name: 'Alex' })] },
  ]);
  const oldMapBeforeJoined = beforeJoined.participants;
  const participant2 = person({ id: 2, name: 'Carol' });
  const afterJoined = reduce(beforeJoined, enrich({ ev: 'joined', p: participant2 }));

  // Behauptungen fuer joined:
  assert(oldMapBeforeJoined.size === 1, 'die alte Map hatte einen Eintrag');
  assert(oldMapBeforeJoined !== afterJoined.participants, 'joined gibt eine ANDERE Map zurueck');
  assert(oldMapBeforeJoined.size === 1, 'die alte Map hat ihre Groesse nicht geaendert');

  // left: alte Map festhalten
  const beforeLeft = afterJoined;
  const oldMapBeforeLeft = beforeLeft.participants;
  const afterLeft = reduce(beforeLeft, enrich({ ev: 'left', id: 1 }));

  // Behauptungen fuer left:
  assert(oldMapBeforeLeft.has(1), 'die alte Map hat noch den Teilnehmer');
  assert(oldMapBeforeLeft !== afterLeft.participants, 'left gibt eine ANDERE Map zurueck');
  assert(oldMapBeforeLeft.has(1), 'die alte Map hat den Teilnehmer noch nicht geloescht');

  // Gegenprobe: left mit unbekannter ID gibt DENSELBEN Zustand
  const beforeNoOp = run([{ ev: 'status', status: 'inMeeting', raw: 3, code: 0 }]);
  const afterNoOp = reduce(beforeNoOp, enrich({ ev: 'left', id: 999 }));
  assert(beforeNoOp === afterNoOp, 'left mit unbekannter ID gibt DENSELBEN Zustand zurueck');
}

import { Bridge } from '../src/bridge.ts';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const testDir = dirname(fileURLToPath(import.meta.url));
const fake = join(testDir, 'fake-bridge.mjs');

console.log('\nbridge - gegen die Attrappe:');
{
  const seen: string[] = [];
  const bridgeEvents: BridgeEvent[] = [];
  const b = new Bridge({
    exePath: process.execPath,
    exeArgs: [fake],
    env: { FAKE_SCRIPT: 'join' },
    onEvent: (e) => {
      seen.push(e.ev);
      bridgeEvents.push(e);
    },
  });
  await b.start();
  await b.waitFor((s) => s.phase === 'inMeeting', 4000);
  assert(b.session.phase === 'inMeeting', 'die Sitzung erreicht inMeeting');
  assert(b.session.participants.size === 1, 'die Teilnehmerliste ist angekommen');
  assert(b.session.canRecordRaw === true, 'die Erlaubnis ist angekommen');
  assert(seen.includes('ready') && seen.includes('roster'), 'jedes Ereignis wurde durchgereicht');
  // Abschluss-Sichtung, Punkt H1: fake-bridge.mjs sandte hier vorher ein
  // privilege-Ereignis OHNE "source" - protocol.ts legt "source" ausdruecklich
  // als PFLICHT fest, und der echte native Teil vergibt es an ALLEN Stellen.
  // Eine Attrappe, die etwas sendet, was das Original nicht senden kann, darf
  // keinen Verbraucher scheitern lassen, der sich auf den Vertrag verlaesst.
  const privilegeEvent = bridgeEvents.find((e) => e.ev === 'privilege');
  assert(
    (privilegeEvent as { source?: string } | undefined)?.source === 'requestAnswer',
    'das privilege-Ereignis der Attrappe traegt "source", genau wie es der echte native Teil taete',
  );
  const code = await b.stop();
  assert(code === 0, 'die Attrappe endet mit 0');
}

console.log('\nbridge - der Wachhund faengt den Haenger:');
{
  // Ohne Wachhund saehe dieser Lauf aus wie ein Netzwerkproblem - genau der
  // 90-Sekunden-Haenger aus dem Stage-0-Spike.
  const errors: BridgeEvent[] = [];
  const b = new Bridge({
    exePath: process.execPath,
    exeArgs: [fake],
    env: { FAKE_SCRIPT: 'hang' },
    joinTimeoutMs: 400,
    onEvent: (e) => {
      if (e.ev === 'error') errors.push(e);
    },
  });
  await b.start();
  b.send({ cmd: 'join', meetingId: '1', passcode: '', displayName: 'JM Connect' });
  await b.waitFor((s) => s.phase === 'error', 4000);
  assert(errors.length === 1, 'genau ein Fehler');
  assert(errors[0]?.name === 'JOIN_TIMEOUT', 'und zwar JOIN_TIMEOUT');
  assert((errors[0] as { lastStatus?: string }).lastStatus === 'connecting', 'der Fehler nennt den zuletzt gesehenen Status');
  await b.stop();
}

console.log('\nbridge - der Wachhund schlaeft nach dem Warteraum NICHT ein:');
{
  // GEMESSEN in der Owner-Abnahme, auf dem Normalweg mit Warteraum:
  // connecting -> waitingRoom -> reconnecting -> connecting -> inMeeting.
  // `waitingRoom` ist ruhend und schaltet den Beitritts-Wachhund ab - die
  // zweite Verbindungsphase beim Einlass stand danach unbewacht da. Haenge
  // sie, bliebe es still.
  const errors: BridgeEvent[] = [];
  const b = new Bridge({
    exePath: process.execPath,
    exeArgs: [fake],
    env: { FAKE_SCRIPT: 'admitstuck' },
    joinTimeoutMs: 400,
    onEvent: (e) => {
      if (e.ev === 'error') errors.push(e);
    },
  });
  await b.start();
  b.send({ cmd: 'join', meetingId: '1', passcode: '', displayName: 'JM Connect' });
  await b.waitFor((s) => s.phase === 'error', 4000);
  assert(errors.length === 1, 'genau ein Fehler');
  // Der NAME ist der eigentliche Prueffall: JOIN_TIMEOUT hiesse, der Beitritt
  // haette nie geantwortet - er hat aber geantwortet, naemlich "Warteraum".
  assert(errors[0]?.name === 'RECONNECT_TIMEOUT', 'und zwar RECONNECT_TIMEOUT, nicht JOIN_TIMEOUT');
  assert((errors[0] as { where?: string }).where === 'meeting', 'der Ort ist die laufende Verbindung, nicht der Beitritt');
  assert(
    (errors[0] as { lastStatus?: string }).lastStatus === 'reconnecting',
    'der Fehler nennt den zuletzt gesehenen Status',
  );
  await b.stop();
}

console.log('\nbridge - ein ordentlicher Abgang loest KEINEN Wachhund aus:');
{
  // Gegenprobe zum Fall darueber, und der Grund, warum nur connecting und
  // reconnecting scharf stellen: 'disconnecting' und das darauf folgende
  // 'idle' sind ebenfalls NICHT ruhend. Ein Wachhund, der auf sie anspringt,
  // meldete nach JEDEM sauber verlassenen Meeting einen Fehler - ein
  // Daueralarm misst nichts. Kein join-Befehl hier: der Abgang soll fuer sich
  // stehen.
  const errors: BridgeEvent[] = [];
  const b = new Bridge({
    exePath: process.execPath,
    exeArgs: [fake],
    env: { FAKE_SCRIPT: 'leftclean' },
    joinTimeoutMs: 200,
    onEvent: (e) => {
      if (e.ev === 'error') errors.push(e);
    },
  });
  await b.start();
  await b.waitFor((s) => s.meeting === 'idle' && s.phase === 'left', 4000);
  // Laenger warten als joinTimeoutMs: waere faelschlich scharf gestellt
  // worden, muesste der Wachhund in dieser Spanne zuschlagen.
  await new Promise((r) => setTimeout(r, 600));
  assert(errors.length === 0, 'kein einziger Fehler nach einem vollstaendigen, sauberen Abgang');
  await b.stop();
}

console.log('\nbridge - kaputte Zeilen reissen nichts ab:');
{
  // Nachbesserung 1, Befund C: nicht nur PRUEFEN, dass inMeeting trotz Muell
  // erreicht wird, sondern auch ZUSICHERN, dass die unlesbare Zeile wirklich
  // GEMELDET wird (onLog), statt nur als Konsolenzeile sichtbar zu sein. Das
  // echte SDK schreibt von sich aus fremde Zeilen (z. B. getServiceHub) auf
  // stdout - fremde Zeilen sind hier der NORMALFALL, nicht die Ausnahme.
  const logs: string[] = [];
  const b = new Bridge({ exePath: process.execPath, exeArgs: [fake], env: { FAKE_SCRIPT: 'messy' }, onLog: (l) => logs.push(l) });
  await b.start();
  await b.waitFor((s) => s.phase === 'inMeeting', 4000);
  assert(b.session.phase === 'inMeeting', 'trotz halber Zeile und Muell wird inMeeting erreicht');
  assert(logs.some((l) => l.includes('das hier ist kein json')), 'die unlesbare Zeile wird ueber onLog gemeldet, nicht nur uebersprungen');
  await b.stop();
}

console.log('\nbridge - stop() killt einen Prozess, der nicht von selbst geht:');
{
  // Nachbesserung 1, Befund A (Teil 1): die Attrappe 'stuck' reagiert auf
  // GAR NICHTS (kein quit, kein stdin-EOF) - nur stop()s Nachbrenner-
  // Zeitgeber kann sie noch beenden. killTimeoutMs klein gesetzt, damit die
  // Zusicherung nicht die vollen (vorgegebenen) 8 s abwarten muss - dasselbe
  // Prinzip wie joinTimeoutMs beim Beitritts-Wachhund oben.
  const events: BridgeEvent[] = [];
  const b = new Bridge({
    exePath: process.execPath,
    exeArgs: [fake],
    env: { FAKE_SCRIPT: 'stuck' },
    killTimeoutMs: 200,
    onEvent: (e) => events.push(e),
  });
  await b.start();
  await b.waitFor((s) => s.phase === 'inMeeting', 4000);
  const startedStop = Date.now();
  const code = await b.stop();
  const elapsedMs = Date.now() - startedStop;
  assert(code === -1, 'stop() meldet den erzwungenen Abbruch (-1), nicht den Attrappen-Exitcode');
  assert(
    elapsedMs >= 150 && elapsedMs < 3000,
    `stop() wartet nur bis killTimeoutMs (200ms), nicht bis zur 8000ms-Vorgabe (gemessen: ${elapsedMs}ms)`,
  );
  // Schluss-Pruefung IMPORTANT 1, GENAU dieser Aufbau reproduzierte den Fund:
  // doStop()s kill()-Zweig loest sein eigenes Promise.race SYNCHRON auf
  // (resolve(-1) direkt nach child.kill()) - this.child wird genullt und
  // stopPromise im finally auf null gesetzt, BEVOR das ECHTE 'exit'-Ereignis
  // dieses (jetzt tatsaechlich sterbenden) Kindes eintrifft. Ohne die
  // this.child===child-Zusatzpruefung im exit-Rueckruf saehe dieser
  // verspaetete Rueckruf stopPromise===null und meldete EXITED_UNEXPECTEDLY
  // fuer ein Kind, das WIR selbst abgeschossen haben. stop() ist hier
  // bereits zurueck (code/elapsedMs oben) - extra warten, damit das
  // verspaetete echte 'exit' Zeit hat, DOCH noch faelschlich zu feuern, falls
  // die Korrektur fehlte.
  await new Promise((r) => setTimeout(r, 500));
  assert(
    !events.some((e) => (e as { name?: string }).name === 'EXITED_UNEXPECTEDLY'),
    'ein per stop() erzwungener kill() meldet KEIN EXITED_UNEXPECTEDLY, obwohl das echte exit-Ereignis dieses Kindes erst NACH stop() eintrifft',
  );
}

console.log('\nbridge - ein gescheitertes kill() verschwindet nicht spurlos:');
{
  // Nachbesserung 1, Befund A (Teil 2): ein ECHTES fehlgeschlagenes kill()
  // gegen einen LEBENDEN Kindprozess liess sich auf dieser Plattform nicht
  // deterministisch erzwingen (siehe task-10-report.md: kill() gegen einen
  // bereits beendeten Prozess liefert lediglich `false` OHNE ein 'error'-
  // Ereignis - und genau dieser Fall ist in stop()s eigenem Promise.race gar
  // nicht erreichbar, weil exitCode dann laengst gewonnen haette). Getestet
  // wird darum die Melde-Methode selbst (reportKillFailure), ueber die BEIDE
  // echten Ausloeser laufen: kill()===false in stop(), und das dauerhafte
  // 'error' in start(). Direkter Zugriff auf die private Methode, weil der
  // oeffentliche Weg dorthin (ein echter kill()-Fehlschlag) nicht reproduzierbar war.
  const events: BridgeEvent[] = [];
  const b = new Bridge({ exePath: process.execPath, exeArgs: [fake], env: { FAKE_SCRIPT: 'join' }, onEvent: (e) => events.push(e) });
  await b.start();
  await b.waitFor((s) => s.phase === 'inMeeting', 4000);
  (b as unknown as { reportKillFailure(detail: string): void }).reportKillFailure('Testausloeser (kein echter Fehlschlag)');
  const last = events.at(-1);
  assert(last?.ev === 'error' && (last as { name?: string }).name === 'KILL_FAILED', 'ein gescheitertes kill() meldet sich als KILL_FAILED-Ereignis');
  assert(b.session.phase === 'error', 'die Sitzung wechselt in die Fehlerphase');
  assert(b.session.lastError?.name === 'KILL_FAILED', 'lastError traegt denselben Namen');
  await b.stop();
}

console.log('\nbridge - eine gescheiterte spawn() ist kein KILL_FAILED:');
{
  // Eigene Absicherung, waehrend Nachbesserung 1s Befund A umgesetzt wurde
  // (nicht vom Koordinator verlangt, aber eine direkte Folge des dauerhaften
  // child.on('error', ...)-Listeners): der laeuft ab jetzt fuer die GESAMTE
  // Lebensdauer, auch waehrend spawn() selbst noch scheitern kann - ohne die
  // this.spawned-Weiche in bridge.ts wuerde eine gescheiterte spawn() (Start)
  // faelschlich als killFailed (Beenden) gemeldet. Zwei verschiedene
  // Ursachen, die dann denselben Namen bekaemen - genau der Fehler, den
  // dieses Vorhaben ueberall sonst vermeidet.
  const events: BridgeEvent[] = [];
  const b = new Bridge({ exePath: join(testDir, 'datei-die-es-nicht-gibt.exe'), onEvent: (e) => events.push(e) });
  let threw = false;
  try {
    await b.start();
  } catch {
    threw = true;
  }
  assert(threw, 'start() wirft, wenn die exe nicht existiert');
  assert(!events.some((e) => (e as { name?: string }).name === 'KILL_FAILED'), 'eine gescheiterte spawn() wird NICHT als KILL_FAILED gemeldet');
}

console.log('\nbridge - ein gestorbenes Kind wird gemeldet, ein regulaeres stop() nicht:');
{
  // Abschluss-Sichtung, Punkt E: vorher reagierte bridge.ts auf
  // child.on('exit') NUR, indem sie ein Versprechen aufloeste - kein
  // Ereignis, kein dispatch(). Stuerzte zoom-bridge.exe ab (Punkt A zeigt,
  // dass das real ist) oder wurde sie abgeschossen, blieb Session.phase
  // FUER IMMER auf 'inMeeting' stehen - die Bruecke wurde einfach still.
  // BEIDE Richtungen werden geprueft, mit ZWEI Bridge-Instanzen, damit sie
  // sich nicht gegenseitig verunreinigen: ein Kind, das OHNE stop() endet
  // (hier: von aussen abgeschossen, simuliert einen Absturz), erzeugt
  // EXITED_UNEXPECTEDLY UND verlaesst die Phase 'inMeeting' - ein Kind, das
  // WEGEN eines regulaeren stop()-Aufrufs endet, erzeugt es NICHT, sonst
  // waere der Normalweg ein Dauerfehler.
  const killedEvents: BridgeEvent[] = [];
  const killed = new Bridge({
    exePath: process.execPath,
    exeArgs: [fake],
    env: { FAKE_SCRIPT: 'join' },
    onEvent: (e) => killedEvents.push(e),
  });
  await killed.start();
  await killed.waitFor((s) => s.phase === 'inMeeting', 4000);
  // Reach-around wie beim stdin-Fehler-Test oben: kill() DIREKT auf dem
  // Kindprozess, OHNE bridge.stop() zu rufen - genau der Fall "von selbst
  // gestorben, kein stop() in Arbeit".
  (killed as unknown as { child: { kill(): boolean } }).child.kill();
  await new Promise((r) => setTimeout(r, 500));
  const exitedEvent = killedEvents.find((e) => (e as { name?: string }).name === 'EXITED_UNEXPECTEDLY');
  assert(exitedEvent?.ev === 'error', 'ein von aussen abgeschossenes Kind meldet sich als EXITED_UNEXPECTEDLY');
  assert(killed.session.phase !== 'inMeeting', 'die Phase bleibt NICHT fuer immer auf inMeeting stehen');
  // Schluss-Pruefung MINOR 7: der exit-Rueckruf nullt this.child jetzt SELBST
  // (nach der EXITED_UNEXPECTEDLY-Pruefung, siehe bridge.ts) - stop() sieht
  // darum bereits `!this.child` und kehrt ueber die bestehende Kurzschluss-
  // Pruefung mit 0 zurueck, ohne noch einmal in ein totes stdin zu schreiben.
  const code = await killed.stop();
  assert(code === 0, 'stop() nach einem unerwarteten Tod ist ein echtes Kurzschluss-Aufraeumen (this.child war bereits genullt)');
  // Direkte Folge, vom Koordinator ausdruecklich verlangt (MINOR 7): OHNE das
  // Nullen wuerde start()s Wiedereintrittsschutz (Punkt H2) einen Wiederanlauf
  // nach einem Absturz mit "Bridge laeuft bereits" verweigern, bis irgendwann
  // stop() gelaufen ist - hier WAR stop() schon gelaufen, die Probe gilt
  // trotzdem: sie zeigt, dass DER GRUND kein Zufall ist, sondern this.child
  // wirklich null ist (ein throw waere sonst auch NACH stop() aufgetreten,
  // haette also nichts bewiesen).
  await killed.start();
  await killed.waitFor((s) => s.phase === 'inMeeting', 4000);
  assert(killed.session.phase === 'inMeeting', 'ein Wiederanlauf nach einem Absturz gelingt, start() wirft NICHT mehr "Bridge laeuft bereits"');
  await killed.stop();

  const cleanEvents: BridgeEvent[] = [];
  const clean = new Bridge({
    exePath: process.execPath,
    exeArgs: [fake],
    env: { FAKE_SCRIPT: 'join' },
    onEvent: (e) => cleanEvents.push(e),
  });
  await clean.start();
  await clean.waitFor((s) => s.phase === 'inMeeting', 4000);
  await clean.stop();
  assert(
    !cleanEvents.some((e) => (e as { name?: string }).name === 'EXITED_UNEXPECTEDLY'),
    'ein REGULAERES stop() meldet KEIN EXITED_UNEXPECTEDLY - sonst waere der Normalweg ein Dauerfehler',
  );
}

console.log('\nbridge - start() zweimal gerufen laesst kein Kind verwaist zurueck:');
{
  // Abschluss-Sichtung, Punkt H2: derselbe Wiedereintrittsschutz wie stop()
  // (Nachbesserung 2 zu Task 10), nur fuer den START statt fuer den ABBAU.
  // Ohne ihn ueberschreibt ein zweiter start()-Aufruf this.child
  // kommentarlos - das ERSTE Kind waere verwaist und saesse im Meeting,
  // bis der Wirtsprozess stirbt.
  const b = new Bridge({ exePath: process.execPath, exeArgs: [fake], env: { FAKE_SCRIPT: 'join' } });
  await b.start();
  let threwOnSecondStart = false;
  try {
    await b.start();
  } catch {
    threwOnSecondStart = true;
  }
  assert(threwOnSecondStart, 'ein zweiter start()-Aufruf wirft, statt das laufende Kind still zu ersetzen');
  // Der Beleg, dass wirklich NICHTS ersetzt wurde: das ERSTE Kind ist
  // weiterhin unter derselben Bridge-Instanz erreichbar und laesst sich
  // sauber beenden - waere this.child ueberschrieben worden, wuerde stop()
  // hier ein ANDERES (oder gar kein) Kind treffen.
  const code = await b.stop();
  assert(code === 0, 'das ERSTE Kind ist weiterhin erreichbar - stop() beendet es sauber');
}

console.log('\nbridge - zwei gleichzeitige stop()-Aufrufe stuerzen nichts ab:');
{
  // Nachbesserung 2: Promise.all([b.stop(), b.stop()]) OHNE Abwarten
  // dazwischen. Vor der Korrektur fingen beide denselben this.child ein - der
  // erste rief child.stdin.end(), bevor der zweite drankam, dessen
  // child.stdin.write(...) schrieb dann gegen einen bereits beendeten Strom.
  // Das wirft NICHT synchron (kein try/catch faengt es), sondern loest
  // ASYNCHRON ein 'error' (ERR_STREAM_WRITE_AFTER_END) aus - unbehandelt,
  // stuerzte das den GESAMTEN Wirtsprozess ab (siehe task-10-report.md fuer
  // die externe Vorher/Nachher-Messung: ein echter Absturz kann sich nicht
  // selbst zusichern, darum die Messung in einem eigenen Kindprozess).
  const b = new Bridge({ exePath: process.execPath, exeArgs: [fake], env: { FAKE_SCRIPT: 'join' } });
  await b.start();
  await b.waitFor((s) => s.phase === 'inMeeting', 4000);
  const [codeA, codeB] = await Promise.all([b.stop(), b.stop()]);
  assert(codeA === 0 && codeB === 0, 'beide gleichzeitigen Aufrufe liefern dasselbe Ergebnis (0), keiner stuerzt ab');
}

console.log('\nbridge - stop() bleibt nach dem Abbau idempotent (sequentiell):');
{
  // Gegenprobe zum Block oben: der SEQUENTIELLE Fall war schon vorher
  // richtig und darf es durch die Wiedereintritts-Absicherung nicht
  // aufhoeren zu sein. 'stuck' + kurzes killTimeoutMs sorgt dafuer, dass der
  // ERSTE Aufruf NICHT 0 liefert (sondern -1, erzwungener Abbruch, weil sich
  // die Attrappe nicht von selbst beendet) - so kann eine Mutation, die das
  // gecachte Versprechen nach Abschluss NICHT zuruecksetzt, den ZWEITEN,
  // SEQUENTIELLEN Aufruf nicht heimlich denselben (falschen) Wert liefern
  // lassen wie den ersten. Mit `FAKE_SCRIPT: 'join'` waeren beide Werte
  // zufaellig gleich (0) gewesen, und die Zusicherung haette diesen Fehler
  // gar nicht faengen koennen.
  const b = new Bridge({
    exePath: process.execPath,
    exeArgs: [fake],
    env: { FAKE_SCRIPT: 'stuck' },
    killTimeoutMs: 200,
  });
  await b.start();
  await b.waitFor((s) => s.phase === 'inMeeting', 4000);
  const first = await b.stop();
  const second = await b.stop();
  assert(first === -1, 'der erste Abbau erzwingt kill() (-1), weil sich die Attrappe nicht von selbst beendet');
  assert(second === 0, 'ein zweiter, SEQUENTIELLER Aufruf danach liefert 0, NICHT den gecachten -1-Wert des ersten');
}

console.log('\nbridge - ein asynchroner stdin-Fehler verschwindet nicht spurlos:');
{
  // Anders als bei KILL_FAILED (Nachbesserung 1) liess sich dieser Ausloeser
  // ECHT und deterministisch nachstellen (gemessen: write() nach end() wirft
  // NICHT synchron, loest aber zuverlaessig ein asynchrones 'error' aus) -
  // kein Reach-around auf eine private Melde-Methode noetig, nur auf das
  // private child-Feld, um den echten Fehler von aussen auszuloesen.
  const events: BridgeEvent[] = [];
  // ACHTUNG (Abschluss-Sichtung Punkt E): dieser Test loest die Attrappe per
  // Hand aus (child.stdin.end() OHNE stop() zu rufen) - genau der Fall, in
  // dem bridge.ts seit Punkt E ein 'exited' meldet, WEIL kein stop() in
  // Arbeit ist (fake-bridge.mjs reagiert auf dasselbe end() mit ihrem
  // eigenen 'bye'+process.exit(0)). lastError spiegelt darum, WELCHES der
  // beiden Ereignisse ZULETZT verarbeitet wurde - das ist bei zwei
  // asynchronen Vorgaengen (der stdin-Fehler UND das Kindprozess-Ende) keine
  // feste Reihenfolge. Der Schnappschuss aus onEvent() zum Zeitpunkt des
  // STDIN_ERROR-Ereignisses ist darum der robuste Beleg, nicht der
  // Endzustand b.session danach.
  let lastErrorAtStdinError: Session['lastError'] | undefined;
  const b = new Bridge({
    exePath: process.execPath,
    exeArgs: [fake],
    env: { FAKE_SCRIPT: 'join' },
    onEvent: (e, s) => {
      events.push(e);
      if ((e as { name?: string }).name === 'STDIN_ERROR') lastErrorAtStdinError = s.lastError;
    },
  });
  await b.start();
  await b.waitFor((s) => s.phase === 'inMeeting', 4000);
  const child = (b as unknown as { child: { stdin: { end(): void; write(s: string): void } } }).child;
  child.stdin.end();
  child.stdin.write('{"cmd":"quit"}\n'); // gegen den bereits beendeten Strom - genau die Lage aus zwei gleichzeitigen stop()-Aufrufen
  await new Promise((r) => setTimeout(r, 100)); // dem asynchronen 'error' Zeit geben
  // NICHT events.at(-1): die Attrappe reagiert auf dasselbe end() mit ihrem
  // eigenen 'bye' (siehe fake-bridge.mjs, process.stdin.on('end', ...)) -
  // das kann NACH unserem Fehler ankommen. Gesucht wird darum gezielt.
  const stdinErrorEvent = events.find((e) => (e as { name?: string }).name === 'STDIN_ERROR');
  assert(stdinErrorEvent?.ev === 'error', 'ein asynchroner stdin-Fehler meldet sich als STDIN_ERROR-Ereignis');
  assert(lastErrorAtStdinError?.name === 'STDIN_ERROR', 'lastError trug STDIN_ERROR GENAU zum Zeitpunkt des Ereignisses');
  await b.stop();
}

console.log('\nbridge - envRemove entfernt eine geerbte Variable wirklich, nicht nur scheinbar:');
{
  // Nachbesserung 1, Befund A: { ...process.env, ...this.opts.env } (der
  // Merge in start()) macht eine bloss FEHLENDE Variable in this.opts.env
  // unsichtbar - process.env darunter liefert sie wieder. Zwei sentinelhafte
  // Variablen in der EIGENEN Prozessumgebung dieses Selbsttests: eine steht
  // in envRemove (muss beim Kind FEHLEN), die andere nicht (muss ANKOMMEN -
  // die Gegenprobe, dass envRemove nicht zu viel entfernt).
  process.env.ZOOM_BRIDGE_TEST_SECRET = 'GEHEIM_DARF_NICHT_DURCH';
  process.env.ZOOM_BRIDGE_TEST_KEEP = 'bleibt-sichtbar';
  try {
    const events: BridgeEvent[] = [];
    const b = new Bridge({
      exePath: process.execPath,
      exeArgs: [fake],
      env: { FAKE_SCRIPT: 'envprobe', ENV_PROBE_NAMES: 'ZOOM_BRIDGE_TEST_SECRET,ZOOM_BRIDGE_TEST_KEEP' },
      envRemove: ['ZOOM_BRIDGE_TEST_SECRET'],
      onEvent: (e) => events.push(e),
    });
    await b.start();
    // Die Attrappe meldet 'envprobe' synchron beim Start - reduce() kennt das
    // Ereignis nicht (Standardzweig), darum kein waitFor() auf den Zustand,
    // sondern kurz auf das Ereignis selbst warten (gleiches Muster wie beim
    // asynchronen stdin-Fehler oben).
    await new Promise((r) => setTimeout(r, 200));
    const probe = events.find((e) => e.ev === 'envprobe') as { seen?: Record<string, boolean> } | undefined;
    assert(probe?.seen?.ZOOM_BRIDGE_TEST_SECRET === false, 'envRemove entfernt die genannte Variable wirklich - das Kind sieht sie NICHT');
    assert(probe?.seen?.ZOOM_BRIDGE_TEST_KEEP === true, 'Gegenprobe: eine NICHT genannte Variable kommt weiterhin an');
    await b.stop();
  } finally {
    delete process.env.ZOOM_BRIDGE_TEST_SECRET;
    delete process.env.ZOOM_BRIDGE_TEST_KEEP;
  }
}

console.log('\nprotocol — Video: Auflösungsschlüssel:');
{
  assert(VIDEO_RESOLUTIONS.includes('720p'), '720p ist ein gültiger Schlüssel');
  // Cast noetig: VIDEO_RESOLUTIONS ist `as const`, TS' strict-Modus verbietet
  // sonst .includes() mit einem Literal, das gar nicht im Vereinigungstyp
  // vorkommt (Abweichung vom Brief-Wortlaut, siehe task-2-report.md) - die
  // LAUFZEIT-Pruefung bleibt exakt dieselbe, nur der Compiler wird nicht
  // mehr getaeuscht.
  assert(!(VIDEO_RESOLUTIONS as readonly string[]).includes('480p'), '480p ist KEIN gültiger Schlüssel — Zoom kennt es nicht');
}

console.log('\nprotocol — Video: jede Ursache hat ihren eigenen Namen:');
{
  const namen = [
    'videoNoPrivilege', 'videoUnknownParticipant', 'videoAlreadySubscribed',
    'videoNotSubscribed', 'videoRendererFailed', 'videoSenderFailed',
    // videoBadAudioFlag steht NEBEN videoBadResolution, nicht statt seiner:
    // beide heissen "ein Befehlsfeld ist unlesbar", schicken die Suche aber
    // an verschiedene Stellen (Aufloesung vs. Ton-Schalter).
    'videoBadResolution', 'videoBadAudioFlag', 'videoBufferMismatch', 'ndiInitFailed',
  ].map((k) => (enrich({ ev: 'error', where: 'video', code: k } as WireEvent) as { name: string }).name);
  assert(new Set(namen).size === namen.length, 'die aufgezählten Ursachen tragen paarweise verschiedene Namen');
  assert(!namen.some((n) => n.startsWith('OWN_UNKNOWN')), 'keiner faellt auf OWN_UNKNOWN zurueck');
  // ÜBER DIE GANZE TABELLE, nicht über eine abgeschriebene Liste. Die
  // Aufzählung oben ist eine Handkopie und war beim Zählen bereits von der
  // Wirklichkeit abgewichen (sie ließ videoRawRecordingFailed aus und hieß
  // trotzdem „zehn Ursachen"). Eine Handkopie kann die Frage „sind ALLE Namen
  // verschieden?" nicht beantworten — sie beantwortet nur „sind die
  // verschieden, an die sich jemand erinnert hat". Diese Zusicherung liest die
  // Quelle selbst und deckt darum jeden künftig hinzugefügten Schlüssel mit ab,
  // ohne dass jemand daran denken muss.
  const alleSchluessel = Object.keys(OWN_ERROR_NAMES);
  const alleNamen = alleSchluessel.map((k) => OWN_ERROR_NAMES[k]);
  assert(new Set(alleNamen).size === alleNamen.length,
    `alle ${alleSchluessel.length} Fehlerschlüssel tragen paarweise verschiedene Namen — zwei Ursachen dürfen nie einen Namen teilen`);
  assert(alleSchluessel.every((k) => (enrich({ ev: 'error', where: 'video', code: k } as WireEvent) as { name: string }).name === OWN_ERROR_NAMES[k]),
    'jeder Schlüssel der Tabelle wird von enrich() auch wirklich aufgelöst');

  const fremd = enrich({ ev: 'error', where: 'video', code: 'videoWasAuchImmer' } as WireEvent);
  assert(
    (fremd as { name: string }).name === 'OWN_UNKNOWN(videoWasAuchImmer)',
    'ein unbekannter Schluessel wird SICHTBAR unbekannt, nicht stillschweigend gerundet',
  );
}

console.log('\nstate — Video: Abo-Buchführung:');
{
  let s = initialSession();
  s = reduce(s, enrich({ ev: 'video', id: 7, state: 'subscribed', source: 'JM Connect – Zoom Anna', reason: 'command', rebindable: true } as WireEvent));
  assert(s.videoSubs.get(7)?.state === 'subscribed', 'ein Abo wird gebucht');
  assert(s.videoSubs.get(7)?.source === 'JM Connect – Zoom Anna', 'der vergebene Name wird festgehalten');
  // Nachbesserungsrunde 1: die Gegenprobe zu "die gemessene Drehung wird
  // festgehalten" weiter unten. Ohne Bild (state:"subscribed") FEHLEN
  // rotation/limitedRange im Ereignis - reduce() darf hier NICHTS erfinden
  // (z. B. per `?? 0`/`?? true`), sonst waere eine erfundene 0 von einer
  // spaeter GEMESSENEN 0 nicht mehr zu unterscheiden.
  assert(s.videoSubs.get(7)?.rotation === undefined, 'ohne Bild wird KEINE Drehung erfunden');
  assert(s.videoSubs.get(7)?.limitedRange === undefined, 'ohne Bild wird KEIN Wertebereich erfunden');

  s = reduce(s, enrich({ ev: 'video', id: 7, state: 'live', source: 'JM Connect – Zoom Anna', reason: 'frames', rebindable: true, rotation: 0, limitedRange: true } as WireEvent));
  assert(s.videoSubs.get(7)?.state === 'live', 'der Zustand folgt dem Ereignis');
  assert(s.videoSubs.get(7)?.rotation === 0, 'die gemessene Drehung wird festgehalten');

  s = reduce(s, enrich({ ev: 'video', id: 7, state: 'black', source: 'JM Connect – Zoom Anna', reason: 'cameraOff', rebindable: true } as WireEvent));
  assert(s.videoSubs.get(7)?.reason === 'cameraOff', 'die URSACHE wird getrennt vom Zustand gefuehrt');

  s = reduce(s, enrich({ ev: 'video', id: 7, state: 'unsubscribed', source: 'JM Connect – Zoom Anna', reason: 'command', rebindable: true } as WireEvent));
  assert(!s.videoSubs.has(7), 'ein abgebautes Abo verschwindet aus der Buchfuehrung');
}

console.log('\nstate — Video: derselbe Zustand, zwei verschiedene Ursachen:');
{
  // Der eigentliche Prueffall: "black" allein sagt NICHT, ob jemand die
  // Kamera zugedeckt hat oder aus dem Meeting geflogen ist.
  let s = initialSession();
  s = reduce(s, enrich({ ev: 'video', id: 1, state: 'black', source: 'A', reason: 'cameraOff', rebindable: true } as WireEvent));
  s = reduce(s, enrich({ ev: 'video', id: 2, state: 'black', source: 'B', reason: 'participantLeft', rebindable: false } as WireEvent));
  assert(s.videoSubs.get(1)?.state === s.videoSubs.get(2)?.state, 'beide stehen auf demselben Zustand');
  assert(s.videoSubs.get(1)?.reason !== s.videoSubs.get(2)?.reason, 'aber die Ursachen bleiben unterscheidbar');
}

console.log('\nstate — Video: Umhängen behält denselben Sender:');
{
  let s = initialSession();
  s = reduce(s, enrich({ ev: 'video', id: 10, state: 'live', source: 'JM Connect – Zoom Bo', reason: 'frames', rebindable: true } as WireEvent));
  s = reduce(s, enrich({ ev: 'video', id: 10, state: 'black', source: 'JM Connect – Zoom Bo', reason: 'participantLeft', rebindable: true } as WireEvent));
  // 'subscribed', nicht 'live': beim Umhaengen sind noch keine Bilder da —
  // genau das meldet der native Teil (Task 6).
  s = reduce(s, enrich({ ev: 'video', id: 11, state: 'subscribed', source: 'JM Connect – Zoom Bo', reason: 'rebound', rebindable: true } as WireEvent));
  assert(!s.videoSubs.has(10), 'die alte Kennung ist weg');
  assert(s.videoSubs.get(11)?.source === 'JM Connect – Zoom Bo', 'der Quellenname bleibt derselbe — der Switcher merkt nichts');
}

// DERSELBE Lauf noch einmal über den ZWEITEN Umhänge-Weg. Ohne diese
// Zusicherung deckte der Selbsttest nur 'rebound' ab — und genau daran ist
// 'reboundByName' vorbeigelaufen, als es dazukam: die alte Kennung blieb als
// Karteileiche stehen, auf die nie wieder ein Ereignis kommt.
{
  let s = initialSession();
  s = reduce(s, enrich({ ev: 'video', id: 20, state: 'live', source: 'JM Connect – Zoom Cy', reason: 'frames', rebindable: true } as WireEvent));
  s = reduce(s, enrich({ ev: 'video', id: 20, state: 'black', source: 'JM Connect – Zoom Cy', reason: 'participantLeft', rebindable: true } as WireEvent));
  s = reduce(s, enrich({ ev: 'video', id: 21, state: 'subscribed', source: 'JM Connect – Zoom Cy', reason: 'reboundByName', rebindable: true } as WireEvent));
  assert(!s.videoSubs.has(20), 'auch beim Umhängen über den Namen ist die alte Kennung weg');
  assert(s.videoSubs.size === 1, 'nach dem Umhängen über den Namen bleibt genau EIN Abo stehen');
}

console.log('\nbridge — Video: ein Abo über die Attrappe:');
{
  const evs: BridgeEvent[] = [];
  const b = new Bridge({
    exePath: process.execPath,
    exeArgs: [fake],
    env: { FAKE_SCRIPT: 'video' },
    onEvent: (e) => { if (e.ev === 'video') evs.push(e); },
  });
  await b.start();
  b.send({ cmd: 'videoSubscribe', id: 42, resolution: '720p' });
  await b.waitFor((s) => s.videoSubs.get(42)?.state === 'live', 4000);
  assert(evs.length >= 2, 'erst subscribed, dann live — beide Schritte sind sichtbar');
  // Cast noetig (Abweichung vom Brief-Wortlaut, siehe task-2-report.md):
  // evs ist BridgeEvent[], ein Vereinigungstyp, dessen andere Varianten kein
  // "state" fuehren - derselbe Cast-Stil wie an den bestehenden Stellen
  // dieser Datei (z. B. `(errors[0] as { name?: string })`).
  assert((evs[0] as { state?: string })?.state === 'subscribed', 'der erste Schritt ist subscribed');
  await b.stop();
}

// --- NDI-Laufzeit auf dem PATH des Kindprozesses ------------------------
// REGRESSION, gemessen am 2026-08-13: zoom-bridge.exe ist seit Stage 2 auch
// gegen die NDI-Importbibliothek gebunden und startet ohne
// Processing.NDI.Lib.x64.dll gar nicht - ohne eine einzige Zeile Ausgabe.
// test/join.mjs gibt ein EIGENES PATH mit und loeschte damit beim Merge die
// Erweiterung, die es nie hatte. Diese Zusicherungen halten die Reihenfolge
// fest, nicht nur die Funktion.
{
  const mitPfad = withNdiRuntimeOnPath({ PATH: 'C:\\a' }, 'C:\\ndi');
  assert(mitPfad.PATH === `C:\\ndi${delimiter}C:\\a`, 'NDI-Laufzeit kommt VORN auf den PATH');

  const ohneFund = { PATH: 'C:\\a' };
  assert(withNdiRuntimeOnPath(ohneFund, null) === ohneFund, 'ohne gefundene DLL bleibt die Umgebung unveraendert');

  const schonDa = { PATH: `C:\\ndi${delimiter}C:\\a` };
  assert(withNdiRuntimeOnPath(schonDa, 'C:\\ndi') === schonDa, 'ein bereits vorhandener Eintrag wird nicht verdoppelt');

  assert(withNdiRuntimeOnPath({}, 'C:\\ndi').PATH === 'C:\\ndi', 'ohne PATH entsteht ein PATH mit genau diesem Eintrag');

  const original = { PATH: 'C:\\a' };
  withNdiRuntimeOnPath(original, 'C:\\ndi');
  assert(original.PATH === 'C:\\a', 'die uebergebene Umgebung wird nicht veraendert');

  // Die eigentliche Regression: der Merge in bridge.ts laesst ein vom Aufrufer
  // gesetztes PATH GEWINNEN. Wird die NDI-Laufzeit vorher angehaengt, ist sie
  // danach weg. Diese Zusicherung bildet genau diese Reihenfolge nach.
  const wieInBridge = withNdiRuntimeOnPath({ ...{ PATH: 'system' }, ...{ PATH: 'aufrufer' } }, 'C:\\ndi');
  assert(wieInBridge.PATH === `C:\\ndi${delimiter}aufrufer`, 'ein vom Aufrufer gesetztes PATH behaelt die NDI-Laufzeit');
}

// --- Ton: Protokoll und Zustand ----------------------------------------
console.log('\nprotocol — Ton:');
{
  const ev = parseWireEvent('{"ev":"audio","id":7,"state":"live","reason":"packets","sampleRate":32000,"channels":1}');
  assert(ev?.ev === 'audio', 'ein audio-Ereignis wird gelesen');
  assert((ev as { sampleRate?: number }).sampleRate === 32000, 'die Abtastrate kommt durch');

  const ohne = parseWireEvent('{"ev":"audio","id":7,"state":"waiting","reason":"command"}');
  assert((ohne as { sampleRate?: number })?.sampleRate === undefined,
    'ohne gemessenes Paket fehlt die Abtastrate — sie wird NICHT erfunden');

  assert(serializeCommand({ cmd: 'videoSubscribe', id: 7, audio: false }).includes('"audio":false'),
    'der Ton-Schalter steht im Befehl');

  const fehler = enrich({ ev: 'error', where: 'audio', code: 'audioQueueOverflow' } as WireEvent);
  assert((fehler as { name?: string }).name === 'AUDIO_QUEUE_OVERFLOW', 'der Ueberlauf hat einen eigenen Namen');
}

console.log('\nstate — Ton:');
{
  let s = initialSession();
  s = reduce(s, enrich({ ev: 'audio', id: 7, state: 'waiting', reason: 'command' } as WireEvent));
  assert(s.audioSubs.get(7)?.state === 'waiting', 'ein Ton-Abo beginnt als waiting');
  // Load-bearend fuer "Keine erfundenen Werte": parseWireEvent() (oben) kann
  // strukturell gar nichts erfinden, es ist nur JSON.parse + Cast. Die
  // Schicht, die eine 0/32000 unterschieben KOENNTE, ist reduce() selbst -
  // hier wird genau SIE geprueft, unmittelbar nach dem ersten Aufruf mit
  // einem Ereignis ohne Format.
  assert(s.audioSubs.get(7)?.sampleRate === undefined,
    'ohne gemessenes Paket steht auch im Zustand keine Abtastrate — reduce() erfindet nichts');

  s = reduce(s, enrich({ ev: 'audio', id: 7, state: 'live', reason: 'packets', sampleRate: 32000, channels: 1 } as WireEvent));
  assert(s.audioSubs.get(7)?.sampleRate === 32000, 'das gemessene Format wird uebernommen');

  // 'off' ist das Ende eines Ton-Abos - wie 'unsubscribed' beim Bild.
  s = reduce(s, enrich({ ev: 'audio', id: 7, state: 'off', reason: 'meetingEnded' } as WireEvent));
  assert(!s.audioSubs.has(7), 'ein beendetes Ton-Abo verschwindet aus der Karte');

  // Umhaengen (Task 7 lässt das video-Ereignis mit der NEUEN Kennung
  // ankommen) muss die tote ALTE Kennung nicht nur aus videoSubs, sondern
  // auch aus audioSubs raeumen - derselbe Fund wie beim Bild
  // (reboundByName-Kommentar in state.ts), nur auf der Ton-Karte. Aufbau:
  // ein Bild- UND ein Ton-Abo unter der ALTEN Kennung 42, derselbe
  // Quellenname wie im rebound-Ereignis mit der NEUEN Kennung 99.
  let r = initialSession();
  r = reduce(r, enrich({
    ev: 'video', id: 42, state: 'live', source: 'Gast', reason: 'frames', rebindable: true,
  } as WireEvent));
  r = reduce(r, enrich({ ev: 'audio', id: 42, state: 'live', reason: 'packets', sampleRate: 32000, channels: 1 } as WireEvent));
  r = reduce(r, enrich({
    ev: 'video', id: 99, state: 'live', source: 'Gast', reason: 'reboundByName', rebindable: true,
  } as WireEvent));
  assert(!r.videoSubs.has(42), 'nach dem Umhaengen ist die alte Kennung aus videoSubs weg');
  assert(r.videoSubs.has(99), 'die neue Kennung steht in videoSubs');
  assert(!r.audioSubs.has(42),
    'nach dem Umhaengen ist die alte Kennung auch aus audioSubs weg — keine stumme Karteileiche');

  // 'audioUnavailable' vs. 'command' (Review Task 5, Finding 2) — und die
  // Nachbesserung dazu (Review-Runde 2, Finding A): die vorherige Fassung
  // dieses Blocks verglich ausschliesslich Zeichenketten, die der Test
  // SELBST hingeschrieben hatte (statisch immer wahr), liess parseWireEvent()
  // ueber einen Cast pruefen, der `reason` gar nicht validiert (er haette
  // ebenso fuer "bananas" bestanden), und pruefte am Ende
  // `!audioSubs.has(8)` auf eine Session, in die 8 nie eingefuegt wurde -
  // wahr, selbst wenn reduce() die Identitaet waere. Keine der vier
  // Zusicherungen haette versagt, waere Finding 2 zurueckgerollt worden. Der
  // Compiler hatte das schon gesagt (TS2367, "comparison appears
  // unintentional, types have no overlap") - die vorherige Fassung
  // beseitigte die MELDUNG (per `: string`-Annotation), nicht den BEFUND.
  //
  // DIESE Zusicherung hat Zaehne, weil sie nicht zur Laufzeit prueft, sondern
  // beim Typcheck: verschwindet 'audioUnavailable' aus AudioReason, schlaegt
  // `npm run typecheck` fehl. Ein Vergleich zweier Zeichenketten, die der
  // Test selbst hingeschrieben hat, koennte das nie zeigen — er ist wahr,
  // bevor irgendetwas gebaut ist.
  const ausgefallen: AudioReason = 'audioUnavailable';
  const abgeschaltet: AudioReason = 'command';

  // Laufzeit-Ergaenzung mit echtem Bezug zu reduce(): NICHT ueber 'off' (das
  // LOESCHT das Abo aus der Karte, siehe reduce() in state.ts - der Grund
  // waere danach nicht mehr pruefbar, egal welcher es war), sondern ueber
  // 'waiting', wo reduce() reason tatsaechlich in die Karte schreibt. Zwei
  // verschiedene Kennungen, zwei verschiedene Gruende - ein reduce(), das
  // reason verwirft, auf einen bekannten Wert rundet oder beide auf denselben
  // Wert abbildet, faellt hier durch.
  let t = initialSession();
  t = reduce(t, enrich({ ev: 'audio', id: 9, state: 'waiting', reason: ausgefallen } as WireEvent));
  t = reduce(t, enrich({ ev: 'audio', id: 10, state: 'waiting', reason: abgeschaltet } as WireEvent));
  assert(t.audioSubs.get(9)?.reason === 'audioUnavailable' && t.audioSubs.get(10)?.reason === 'command',
    'reduce() speichert beide Gruende unveraendert und unterscheidbar, statt einen auf den anderen abzubilden');

  // WAS DAMIT AUSDRUECKLICH NICHT BELEGT IST: ob der NATIVE Teil
  // (video.cpp) im Fehlschlag-Zweig von audioEnsureSubscribed() tatsaechlich
  // "audioUnavailable" sendet statt "command" oder gar nichts. selftest.ts
  // ist reines TypeScript und kann nicht beobachten, was zoom-bridge.exe auf
  // stdout schreibt. Kein bestehender Pruefstand deckt diese Luecke:
  // command-probe erreicht diesen Zweig nicht (kein echtes Meeting, kein
  // erzwingbarer SDK-Fehlschlag), bool-probe/ndi-probe pruefen etwas
  // anderes. Das gehoert auf die Owner-Abnahmeliste (echtes Meeting, ein
  // Zustand, in dem audioEnsureSubscribed() tatsaechlich scheitert) - eine
  // gruene Zeile hier behauptet das NICHT.
}

console.log('\nvideoDelay — ein Bild-Versatz fuer alle Quellen (Abnahmepunkt 5):');
{
  assert(serializeCommand({ cmd: 'videoDelay', ms: 480 }) === '{"cmd":"videoDelay","ms":480}\n',
    'der Befehl geht als eine Zeile mit ms als ZAHL raus');
  // Die TS-Obergrenze. Dass die NATIVE Grenze (kMaxVideoDelayMs) gleich ist,
  // kann dieser Test nicht sehen - das prueft test/delay-probe.mjs, das
  // DIESE Konstante liest und sie gegen die echte .exe schickt.
  assert(VIDEO_DELAY_MAX_MS === 1000, 'die TS-Obergrenze betraegt 1000 ms');

  // EIN EIGENER NAME, nicht videoBadResolution geliehen: die Suche geht zum
  // Versatzfeld, nicht zum Aufloesungsschluessel.
  const n = enrich({ ev: 'error', where: 'video', code: 'videoBadDelay' } as WireEvent) as { name: string };
  assert(n.name === 'VIDEO_BAD_DELAY', 'videoBadDelay hat seinen eigenen Namen');

  // NICHT ERFUNDEN: bis die Bridge einen Wert BESTAETIGT, ist er unbekannt.
  // Eine 0 saehe aus wie "bestaetigt: kein Versatz" - dasselbe Muster wie
  // rotation/limitedRange, die erst ein Bild liefern darf.
  assert(initialSession().videoDelayMs === null, 'vor jeder Bestaetigung ist der Versatz unbekannt (null), nicht 0');

  let s = reduce(initialSession(), enrich({ ev: 'videoDelay', ms: 480 } as WireEvent));
  assert(s.videoDelayMs === 480, 'die Bestaetigung der Bridge setzt den Versatz');
  s = reduce(s, enrich({ ev: 'videoDelay', ms: 0 } as WireEvent));
  assert(s.videoDelayMs === 0, 'eine bestaetigte 0 ist ein Wert und wird nicht als "fehlt" verschluckt');

  const vorher = reduce(initialSession(), enrich({ ev: 'videoDelay', ms: 480 } as WireEvent));
  const nachFehler = reduce(vorher, enrich({ ev: 'error', where: 'video', code: 'videoBadDelay' } as WireEvent));
  assert(nachFehler.videoDelayMs === 480, 'ein abgewiesener Befehl laesst den geltenden Versatz stehen');
  assert(nachFehler.phase === vorher.phase, 'videoBadDelay kippt die Sitzung nicht auf error (where:video)');
  assert(nachFehler.lastError?.name === 'VIDEO_BAD_DELAY', 'der Fehler steht trotzdem in lastError');

  const kaputt = reduce(initialSession(), enrich({ ev: 'videoDelay', ms: '480' } as unknown as WireEvent));
  assert(kaputt.videoDelayMs === null, 'ein videoDelay-Ereignis ohne Zahl wird nicht gedeutet');
}

// --- Start-EXE: Live-Befehle, Laufzeit-Aufloesung, Ablaeufe -----------------
// Die Steuerung (cli/steuerung.mjs) ist dieselbe fuer den Konsolen-Pruefstand
// test/join.mjs und fuer die Start-EXE zoom-join.exe im Einsatzpaket. Was hier
// gegen die Attrappe laeuft, laeuft dort gegen die echte Bridge.
import { deuteEingabe, starteSteuerung, strgCAbfangen } from '../cli/steuerung.mjs';
import { loeseLaufzeitAuf } from '../cli/laufzeit.mjs';
import { PassThrough } from 'node:stream';
import { win32 } from 'node:path';

console.log('\nsteuerung — Live-Befehle deuten (deuteEingabe):');
{
  const d = (z: string) => deuteEingabe(z) as Record<string, unknown>;
  const gleich = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

  assert(gleich(d('480'), { art: 'versatz', ms: 480 }), '"480" ist ein Bild-Versatz');
  assert(gleich(d('0'), { art: 'versatz', ms: 0 }), '"0" ist ein Bild-Versatz (kein leerer Wert)');
  // Die PRUEFUNG macht die Bridge (ganze Zahl 0..1000) - "4.5" muss sie
  // erreichen und dort VIDEO_BAD_DELAY ausloesen (Drehbuch A3 e).
  assert(gleich(d(' 4.5 '), { art: 'versatz', ms: 4.5 }), '"4.5" geht als Versatz an die Bridge, die ihn abweist');
  assert(gleich(d('+16778240'), { art: 'abonnieren', id: 16778240, stumm: false }), '"+<id>" abonniert Bild und Ton');
  assert(gleich(d('+16778240 stumm'), { art: 'abonnieren', id: 16778240, stumm: true }), '"+<id> stumm" abonniert ohne Ton');
  assert(gleich(d('+ 16778240  STUMM'), { art: 'abonnieren', id: 16778240, stumm: true }), 'Leerraum und Grossschreibung stoeren nicht');
  assert(gleich(d('-16778240'), { art: 'abbestellen', id: 16778240 }), '"-<id>" bestellt ab');
  // BEWUSSTE AENDERUNG: "-5" war bisher ein (ungueltiger) negativer Versatz.
  assert(gleich(d('-5'), { art: 'abbestellen', id: 5 }), '"-5" heisst jetzt abbestellen, nicht negativer Versatz');
  assert(gleich(d('liste'), { art: 'liste' }), '"liste"');
  assert(gleich(d(' LISTE '), { art: 'liste' }), '"LISTE" (gross, mit Leerraum)');
  assert(gleich(d('ende'), { art: 'ende' }), '"ende"');
  assert(gleich(d('Ende'), { art: 'ende' }), '"Ende"');
  assert(gleich(d('hilfe'), { art: 'hilfe' }), '"hilfe"');
  assert(gleich(d('?'), { art: 'hilfe' }), '"?"');
  assert(gleich(d(''), { art: 'leer' }), 'leere Zeile wird ignoriert');
  assert(gleich(d('   '), { art: 'leer' }), 'Zeile nur aus Leerraum wird ignoriert');
  for (const kaputt of ['abc', '+', '+abc', '+16778240 laut', '-', '-4.5', '-abc', 'ende jetzt', '+99999999999999999999']) {
    const r = d(kaputt);
    assert(r.art === 'unbekannt' && typeof r.grund === 'string' && (r.grund as string).length > 0,
      `"${kaputt}" ist unbekannt und bekommt einen Grund`);
  }
}

console.log('\nsteuerung — Laufzeit-Aufloesung der Start-EXE (loeseLaufzeitAuf):');
{
  const ordner = 'C:\\Projekt PC\\JM Zoom Bridge';
  const bin = win32.join(ordner, 'bin');
  const sdk = 'D:\\Zoom SDK 7';
  const sdkBin = win32.join(sdk, 'x64', 'bin');
  const da = (...pfade: string[]) => (p: string) => pfade.includes(p);

  let r = loeseLaufzeitAuf({ exeOrdner: ordner, env: {}, gibtEs: da(win32.join(bin, 'zoom-bridge.exe'), win32.join(bin, 'sdk.dll')) }) as Record<string, unknown>;
  assert(r.bridgeExe === win32.join(bin, 'zoom-bridge.exe'), 'zoom-bridge.exe liegt unter <EXE-Ordner>\\bin (Pfad mit Leerzeichen)');
  assert(r.zoomDllDir === bin && r.fehler === undefined, 'Komplett-Paket: bin\\sdk.dll vorhanden -> bin auf PATH');

  r = loeseLaufzeitAuf({ exeOrdner: ordner, env: { ZOOM_SDK_DIR: sdk }, gibtEs: da(win32.join(bin, 'zoom-bridge.exe'), win32.join(bin, 'sdk.dll'), win32.join(sdkBin, 'sdk.dll')) }) as Record<string, unknown>;
  assert(r.zoomDllDir === bin, 'liegt sdk.dll im Paket, gewinnt das Paket gegen ZOOM_SDK_DIR');

  r = loeseLaufzeitAuf({ exeOrdner: ordner, env: { ZOOM_SDK_DIR: sdk }, gibtEs: da(win32.join(bin, 'zoom-bridge.exe'), win32.join(sdkBin, 'sdk.dll')) }) as Record<string, unknown>;
  assert(r.zoomDllDir === sdkBin && r.fehler === undefined, 'oeffentliches Paket: ZOOM_SDK_DIR\\x64\\bin mit sdk.dll');

  r = loeseLaufzeitAuf({ exeOrdner: ordner, env: { ZOOM_SDK_DIR: sdk }, gibtEs: da(win32.join(bin, 'zoom-bridge.exe')) }) as Record<string, unknown>;
  assert(typeof r.fehler === 'string' && (r.fehler as string).includes(win32.join(sdkBin, 'sdk.dll')),
    'ZOOM_SDK_DIR ohne sdk.dll: Fehler nennt den gesuchten Pfad');

  r = loeseLaufzeitAuf({ exeOrdner: ordner, env: {}, gibtEs: da(win32.join(bin, 'zoom-bridge.exe')) }) as Record<string, unknown>;
  const f = String(r.fehler ?? '');
  assert(f.includes('x64\\bin') && f.includes(bin) && f.includes('ZOOM_SDK_DIR'),
    'weder Paket noch ZOOM_SDK_DIR: Fehler nennt beide Auswege (x64\\bin nach bin kopieren ODER ZOOM_SDK_DIR)');
  assert(r.bridgeExe === undefined, 'im Fehlerfall wird keine Bridge vorgeschlagen');

  r = loeseLaufzeitAuf({ exeOrdner: ordner, env: { ZOOM_SDK_DIR: sdk }, gibtEs: da(win32.join(sdkBin, 'sdk.dll')) }) as Record<string, unknown>;
  assert(String(r.fehler ?? '').includes('zoom-bridge.exe'), 'fehlt zoom-bridge.exe, sagt der Fehler genau das');
}

/** Wartet, bis eine Zeile das Muster enthaelt. */
async function bisZeile(zeilen: string[], muster: string, ms = 4000): Promise<boolean> {
  const ende = Date.now() + ms;
  while (Date.now() < ende) {
    if (zeilen.some((z) => z.includes(muster))) return true;
    await new Promise((r) => setTimeout(r, 20));
  }
  return false;
}

/** Faehrt die Steuerung gegen die Attrappe (Drehbuch "steuerung"). */
function steuere(fakeEnv: Record<string, string>, zoomEnv: Record<string, string>, extra: Record<string, unknown> = {}) {
  const zeilen: string[] = [];
  const bridgeLog: string[] = [];
  const eingabe = new PassThrough();
  let abbruch: (() => void) | null = null;
  let amEnde: { videoDelayMs: number | null } | null = null;
  const lauf: Promise<number> = starteSteuerung({
    exePath: process.execPath,
    exeArgs: [fake],
    zoomDllDir: null,
    sekunden: null,
    env: { ZOOM_SDK_CLIENT_ID: 'test-id', ZOOM_SDK_CLIENT_SECRET: 'test-secret', ...zoomEnv },
    kindEnv: { FAKE_SCRIPT: 'steuerung', ...fakeEnv },
    eingabe,
    log: (z: unknown) => zeilen.push(...String(z).split('\n')),
    fehler: (z: unknown) => zeilen.push(...String(z).split('\n')),
    bridgeLog: (z: string) => bridgeLog.push(z),
    abbruchSignal: (h: () => void) => {
      abbruch = h;
      return () => {
        abbruch = null;
      };
    },
    beimEnde: (s: { videoDelayMs: number | null }) => {
      amEnde = s;
    },
    ...extra,
  });
  return {
    zeilen,
    bridgeLog,
    lauf,
    tippe: (s: string) => eingabe.write(`${s}\n`),
    /** Mehrere Zeilen in EINEM Rutsch - wie eingefuegter Text. */
    roh: (s: string) => eingabe.write(s),
    strgC: () => abbruch?.(),
    amEnde: () => amEnde,
    /** Die Befehlszeilen, die die Attrappe empfangen hat, als Objekte. */
    befehle: () =>
      bridgeLog
        .filter((l) => l.startsWith('ATTRAPPE empfing: '))
        .map((l) => JSON.parse(l.slice('ATTRAPPE empfing: '.length)) as Record<string, unknown>),
  };
}

console.log('\nsteuerung — nur anmelden (ZOOM_NUR_ANMELDEN=1):');
{
  const t = steuere({}, { ZOOM_NUR_ANMELDEN: '1' });
  const code = await t.lauf;
  assert(code === 0, 'Anmeldung ok -> Rueckgabe 0');
  assert(t.zeilen.some((z) => z.includes('SDK: 7.1.5 (attrappe)')), 'die SDK-Version wird gedruckt');
  assert(t.zeilen.some((z) => z.includes('Anmeldung: AUTHRET_SUCCESS')), 'das Anmeldeergebnis wird gedruckt');
  assert(t.zeilen.some((z) => z.includes('kein Meeting betreten')), 'es wird ausdruecklich gesagt, dass kein Meeting betreten wurde');
  assert(!t.befehle().some((b) => b.cmd === 'join'), 'KEIN join geht an die Bridge');
  assert(t.befehle().some((b) => b.cmd === 'quit'), 'die Bridge wird sauber beendet (quit)');
}
{
  const t = steuere({ FAKE_AUTH_CODE: '2' }, { ZOOM_NUR_ANMELDEN: '1' });
  const code = await t.lauf;
  assert(code === 1, 'Anmeldung abgelehnt -> Rueckgabe 1');
  assert(t.zeilen.some((z) => z.includes('AUTHRET_KEYORSECRETWRONG')), 'der Ablehnungsgrund steht mit Namen da');
  assert(!t.befehle().some((b) => b.cmd === 'join'), 'auch bei Ablehnung KEIN join');
}
{
  const t = steuere({}, {});
  const code = await t.lauf;
  assert(code === 1 && t.zeilen.some((z) => z.includes('ZOOM_MEETING_ID ist nicht gesetzt.')),
    'ohne Nur-Anmelden und ohne Meeting-Nummer: Rueckgabe 1 mit der bisherigen Meldung');
}

console.log('\nsteuerung — Live-Abos im Lauf, liste, abbestellen, Versatz, ende:');
{
  const t = steuere({}, { ZOOM_MEETING_ID: '1' });
  assert(await bisZeile(t.zeilen, 'Teilnehmer (3):'), 'der Teilnehmer-Block erscheint');
  assert(await bisZeile(t.zeilen, 'Befehle:'), 'nach dem Teilnehmer-Block steht die kurze Befehlsuebersicht');
  assert(await bisZeile(t.zeilen, 'Rohdaten-Erlaubnis: JA'), 'die Erlaubnis kommt an');

  t.tippe('+16778240');
  assert(await bisZeile(t.zeilen, 'video 16778240: subscribed (command)'), '"+<id>" abonniert im Lauf');
  const abo = t.befehle().find((b) => b.cmd === 'videoSubscribe' && b.id === 16778240);
  assert(abo?.resolution === '720p', 'das Abo geht mit 720p raus');
  assert(abo !== undefined && !('audio' in abo), 'ohne "stumm" wird das Feld audio WEGGELASSEN (Vorgabefall des Protokolls)');

  t.tippe('+16778241 stumm');
  assert(await bisZeile(t.zeilen, 'audio 16778241: off (command)'), '"+<id> stumm" liefert Bild ohne Ton');
  const stumm = t.befehle().find((b) => b.cmd === 'videoSubscribe' && b.id === 16778241);
  assert(stumm?.audio === false, '"stumm" sendet audio:false');

  t.tippe('+999');
  assert(await bisZeile(t.zeilen, 'nicht in der Teilnehmerliste'), 'eine unbekannte Kennung wird gemeldet');
  await new Promise((r) => setTimeout(r, 100));
  assert(!t.befehle().some((b) => b.id === 999), 'eine unbekannte Kennung geht NICHT an die Bridge');

  t.tippe('liste');
  assert(await bisZeile(t.zeilen, 'Abonniert (2):'), '"liste" nennt die laufenden Abos');
  assert(t.zeilen.filter((z) => z.includes('(das sind wir)')).length >= 2, '"liste" druckt die Teilnehmer erneut, samt "(das sind wir)"');

  t.tippe('-16778240');
  assert(await bisZeile(t.zeilen, 'video 16778240: unsubscribed (command)'), '"-<id>" bestellt ab');
  assert(t.befehle().some((b) => b.cmd === 'videoUnsubscribe' && b.id === 16778240), 'als videoUnsubscribe');

  t.tippe('4.5');
  assert(await bisZeile(t.zeilen, 'FEHLER bei video: VIDEO_BAD_DELAY'), '"4.5" erreicht die Bridge und wird dort abgewiesen');
  t.tippe('300');
  assert(await bisZeile(t.zeilen, 'Bild-Versatz: 300 ms (von der Bridge bestaetigt'), 'ein gueltiger Versatz wird bestaetigt');

  t.tippe('hilfe');
  assert(await bisZeile(t.zeilen, '+<id> stumm'), '"hilfe" zeigt die Befehle');
  t.tippe('quatsch');
  assert(await bisZeile(t.zeilen, '"quatsch"'), 'eine unbekannte Eingabe wird gemeldet');
  assert(t.zeilen.some((z) => z.includes('"quatsch"') && z.includes('hilfe')), '... mit Verweis auf "hilfe"');

  t.tippe('ende');
  const code = await t.lauf;
  assert(code === 0, '"ende" mit erteilter Erlaubnis -> Rueckgabe 0');
  assert(t.zeilen.some((z) => z.includes('verlasse das Meeting')), '"ende" verlaesst das Meeting');
  assert(t.befehle().some((b) => b.cmd === 'quit'), '"ende" beendet die Bridge sauber (quit)');
  assert(t.amEnde()?.videoDelayMs === 300, 'am Ende liegt der zuletzt BESTAETIGTE Versatz vor (fuer die naechste Vorgabe)');
}

console.log('\nsteuerung — Abonnieren ohne Rohdaten-Erlaubnis, dann Strg+C:');
{
  const t = steuere({ FAKE_PRIVILEGE: 'offen' }, { ZOOM_MEETING_ID: '1' });
  assert(await bisZeile(t.zeilen, 'Teilnehmer (3):'), 'im Meeting');
  t.tippe('+16778240');
  assert(await bisZeile(t.zeilen, 'Zoom-Client'), 'ohne Erlaubnis wird erklaert, wo sie zu erteilen ist');
  await new Promise((r) => setTimeout(r, 100));
  assert(!t.befehle().some((b) => b.cmd === 'videoSubscribe'), 'ohne Erlaubnis geht KEIN videoSubscribe raus');
  t.strgC();
  const code = await t.lauf;
  assert(code === 3, 'Strg+C ohne Erlaubnis -> Rueckgabe 3');
  assert(t.zeilen.some((z) => z.includes('Abbruch — verlasse das Meeting')), 'Strg+C meldet sich wie bisher');
}

console.log('\nsteuerung — Meeting-Ende im Endlos-Modus:');
{
  const t = steuere({ FAKE_MEETING_ENDE_MS: '600' }, { ZOOM_MEETING_ID: '1', ZOOM_VIDEO_SUBSCRIBE: '16778240' });
  assert(await bisZeile(t.zeilen, 'video 16778240: subscribed (command)'), 'das Start-Abo laeuft');
  const code = await Promise.race([t.lauf, new Promise<number>((r) => setTimeout(() => r(-99), 5000))]);
  assert(code === 0, 'Meeting-Ende beendet den Endlos-Lauf von selbst, mit Rueckgabe 0 (Erlaubnis war erteilt)');
  assert(t.zeilen.some((z) => z.includes('video 16778240: unsubscribed (meetingEnded)')), 'der Abbau wird noch gedruckt');
  assert(t.zeilen.some((z) => z.includes('Meeting ist zu Ende')), 'das Meeting-Ende wird in Klartext gemeldet');
}

console.log('\nsteuerung — Laufdauer in Sekunden (wie test/join.mjs):');
{
  const vorher = Date.now();
  const t = steuere({}, { ZOOM_MEETING_ID: '1' }, { sekunden: 0.5 });
  const code = await t.lauf;
  assert(code === 0 && Date.now() - vorher >= 450, 'mit Laufdauer endet der Lauf nach der Zeit, Rueckgabe 0');
  assert(t.zeilen.some((z) => z.includes('Bleibe 0.5 s (Strg+C beendet frueher).')), 'die bisherige Zeile "Bleibe <n> s" steht da');
}

console.log('\nsteuerung — jemand tritt im Lauf bei:');
{
  const t = steuere({ FAKE_BEITRITT_MS: '300' }, { ZOOM_MEETING_ID: '1' });
  assert(await bisZeile(t.zeilen, '+ Carla (16778242)'), 'der Beitritt wird wie bisher gemeldet');
  assert(await bisZeile(t.zeilen, 'abonnieren mit +16778242'), '... plus der Hinweis, wie man abonniert');
  t.tippe('ende');
  await t.lauf;
}

console.log('\nsteuerung — mehr als 5 Abos: warnen, nicht verhindern:');
{
  const t = steuere({ FAKE_TEILNEHMER: '7' }, { ZOOM_MEETING_ID: '1' });
  assert(await bisZeile(t.zeilen, 'Rohdaten-Erlaubnis: JA'), 'im Meeting mit Erlaubnis');
  for (let i = 0; i < 5; i++) {
    t.tippe(`+${16778240 + i}`);
    assert(await bisZeile(t.zeilen, `video ${16778240 + i}: subscribed`), `Abo ${i + 1} laeuft`);
  }
  assert(!t.zeilen.some((z) => z.includes('gemessen sind 5')), 'bis 5 Abos keine Warnung');
  t.tippe('+16778245');
  assert(await bisZeile(t.zeilen, 'gemessen sind 5'), 'beim 6. Abo kommt die Warnung');
  assert(await bisZeile(t.zeilen, 'video 16778245: subscribed'), '... und das Abo wird trotzdem gesendet');
  t.tippe('ende');
  await t.lauf;
}

// --- Nachbesserung Einsatzpaket (Befunde der Sichtung vom 01.10.2026) --------

/** Wartet hoechstens `ms` auf den Lauf - ein Haenger wird zu -99 statt zum Haenger des Selbsttests. */
async function mitFrist(lauf: Promise<number>, ms: number): Promise<number> {
  let t: NodeJS.Timeout | undefined;
  const r = await Promise.race([lauf, new Promise<number>((res) => (t = setTimeout(() => res(-99), ms)))]);
  clearTimeout(t);
  return r;
}
const fehltExe = join(testDir, 'gibt es nicht', 'zoom-bridge.exe');

console.log('\nbridge - Start scheitert asynchron (Datei fehlt):');
{
  // GEMESSEN: fuer ein Kind, dessen Start scheitert (ENOENT/EACCES), meldet
  // Node NUR 'error', nie 'exit'. this.child stand aber schon - stop() wartete
  // danach auf ein exit, das nie kommt (kill-Zeitgeber unref'd): der
  // Pruefstand endete mit 13 (unsettled top-level await), zoom-join.exe mit 0.
  const b = new Bridge({ exePath: fehltExe });
  let meldung = '';
  try {
    await b.start();
  } catch (e) {
    meldung = (e as Error).message;
  }
  assert(meldung.includes('ENOENT'), 'start() wirft mit ENOENT');
  const vorher = Date.now();
  const r = await Promise.race([b.stop().then(() => 'fertig'), new Promise((res) => setTimeout(() => res('haengt'), 3000))]);
  assert(r === 'fertig' && Date.now() - vorher < 1000, 'stop() nach gescheitertem Start kehrt sofort zurueck');
  let zweite = '';
  try {
    await b.start();
  } catch (e) {
    zweite = (e as Error).message;
  }
  assert(zweite.includes('ENOENT'), 'ein zweiter start() scheitert am Start, nicht an "laeuft bereits"');
}

console.log('\nsteuerung — Bridge laesst sich nicht starten:');
{
  const t = steuere({}, { ZOOM_NUR_ANMELDEN: '1' }, { exePath: fehltExe, exeArgs: [] });
  const code = await mitFrist(t.lauf, 5000);
  assert(code === 1, 'Start-Fehler -> Rueckgabe 1 (nicht haengen, nicht 0)');
  assert(t.zeilen.some((z) => z.includes('ENOENT')), 'die Ursache steht da');
  assert(t.amEnde() !== null, 'die Nachbereitung (beimEnde) laeuft trotzdem');
}

console.log('\nsteuerung — Strg+C, Strg+Pause und Fenster-Schliessen werden abgefangen:');
{
  const signale = ['SIGINT', 'SIGHUP', 'SIGBREAK'] as const;
  const vorher = signale.map((s) => process.listenerCount(s));
  const abmelden = strgCAbfangen(() => {});
  const dabei = signale.map((s) => process.listenerCount(s));
  abmelden();
  const nachher = signale.map((s) => process.listenerCount(s));
  // SIGHUP: so meldet Node unter Windows das Schliessen des Konsolenfensters
  // (CTRL_CLOSE_EVENT). Ohne Lauscher stirbt zoom-join.exe sofort, und die
  // Bridge wird ohne Verlassen des Meetings abgeschossen.
  signale.forEach((s, i) => assert(dabei[i] === vorher[i] + 1, `${s} wird abgefangen`));
  assert(nachher.join() === vorher.join(), 'und wieder abgemeldet');
}

console.log('\nsteuerung — Bridge stirbt, bevor die Anmeldung beantwortet ist (fehlende DLL):');
for (const [modus, zoomEnv] of [['nur anmelden', { ZOOM_NUR_ANMELDEN: '1' }], ['beitreten', { ZOOM_MEETING_ID: '1' }]] as const) {
  const vorher = Date.now();
  const t = steuere({ FAKE_SOFORT_ENDE: String(0xc0000135) }, zoomEnv, { anmeldeFristMs: 10_000 });
  const code = await mitFrist(t.lauf, 5000);
  assert(code === 1 && Date.now() - vorher < 3000, `${modus}: Rueckgabe 1, sofort`);
  assert(!t.zeilen.some((z) => z.includes('Client-ID und Secret')), `${modus}: KEIN Verdacht auf die Zugangsdaten`);
  assert(!t.zeilen.some((z) => z.includes('Keine Antwort auf die Anmeldung')), `${modus}: nicht "Keine Antwort auf die Anmeldung"`);
  if (process.platform === 'win32') {
    assert(t.zeilen.some((z) => z.includes('DLL')) && t.zeilen.some((z) => z.includes('x64\\bin')),
      `${modus}: 0xC0000135 heisst "eine DLL fehlt" - mit dem Ausweg (x64\\bin vollstaendig kopieren)`);
  }
  assert(!t.befehle().some((b) => b.cmd === 'join'), `${modus}: kein join`);
}

console.log('\nsteuerung — nur anmelden: init- und sofortige auth-Fehler warten nicht 30 s:');
{
  let vorher = Date.now();
  let t = steuere({ FAKE_INIT_FEHLER: '1' }, { ZOOM_NUR_ANMELDEN: '1' }, { anmeldeFristMs: 10_000 });
  let code = await mitFrist(t.lauf, 5000);
  assert(code === 1 && Date.now() - vorher < 3000, 'InitSDK-Fehler: Rueckgabe 1, sofort');
  assert(t.zeilen.some((z) => z.includes('FEHLER bei init')), 'der init-Fehler steht mit Namen da');
  assert(t.zeilen.some((z) => z.includes('Zoom-SDK liess sich nicht starten')), 'eine eigene Meldung fuer den init-Fehler');
  assert(!t.zeilen.some((z) => z.includes('Keine Antwort auf die Anmeldung')), 'nicht "Keine Antwort auf die Anmeldung"');

  vorher = Date.now();
  t = steuere({ FAKE_AUTH_SOFORTFEHLER: '3' }, { ZOOM_NUR_ANMELDEN: '1' }, { anmeldeFristMs: 10_000 });
  code = await mitFrist(t.lauf, 5000);
  assert(code === 1 && Date.now() - vorher < 3000, 'sofortiger SDKAuth-Fehler: Rueckgabe 1, sofort');
  assert(t.zeilen.some((z) => z.includes('Anmeldung nicht durchgekommen')), '... als "Anmeldung nicht durchgekommen"');
}

console.log('\nsteuerung — Absturz der Bridge mitten im Meeting:');
{
  const t = steuere({ FAKE_ABSTURZ_MS: '200' }, { ZOOM_MEETING_ID: '1' });
  const code = await mitFrist(t.lauf, 5000);
  assert(code === 5, 'Endlos-Lauf: ein Absturz ist Rueckgabe 5 - nicht 0 (das hiesse "alles gut")');
  assert(t.zeilen.some((z) => z.includes('unerwartet beendet')), 'der Absturz wird in Klartext gemeldet');
  const fest = steuere({ FAKE_ABSTURZ_MS: '200' }, { ZOOM_MEETING_ID: '1' }, { sekunden: 20 });
  const vorher = Date.now();
  const codeFest = await mitFrist(fest.lauf, 5000);
  assert(codeFest === 5 && Date.now() - vorher < 4000, 'feste Laufdauer: endet sofort mit 5, statt die Zeit abzusitzen');
}

console.log('\nsteuerung — Verbindung bricht ab (failed nach dem Beitritt):');
{
  const t = steuere({ FAKE_VERBINDUNG_WEG_MS: '300' }, { ZOOM_MEETING_ID: '1' });
  const code = await mitFrist(t.lauf, 5000);
  assert(code === 6, 'Verbindungsabbruch ist Rueckgabe 6 - nicht 0');
  assert(t.zeilen.some((z) => z.includes('Verbindung zum Meeting')), 'als Verbindungsabbruch gemeldet');
  assert(!t.zeilen.some((z) => z.includes('Meeting ist zu Ende')), 'NICHT als "Das Meeting ist zu Ende"');
}

console.log('\nsteuerung — Warteraum, gescheiterter Beitritt, Abbruch vor dem Betreten:');
{
  // Endlos-Lauf: im Warteraum gibt es keine Frist - der Gastgeber laesst ein,
  // wann er will. Abbrechen mit "ende" ist Rueckgabe 4 (nie im Meeting), nicht 3.
  const t = steuere({ FAKE_WARTERAUM: '1' }, { ZOOM_MEETING_ID: '1' }, { beitrittsFristMs: 300 });
  assert(await bisZeile(t.zeilen, 'Status: waitingRoom'), 'der Warteraum wird gemeldet');
  assert(await bisZeile(t.zeilen, 'einlassen'), '... mit dem Hinweis, dass der Gastgeber einlassen muss');
  const zwischen = await mitFrist(t.lauf, 900);
  assert(zwischen === -99, 'Endlos-Lauf: nach Ablauf der Beitrittsfrist im Warteraum wird NICHT aufgegeben');
  t.tippe('ende');
  const code = await mitFrist(t.lauf, 5000);
  assert(code === 4, '"ende" im Warteraum -> Rueckgabe 4 (nie im Meeting gewesen)');
  assert(t.befehle().some((b) => b.cmd === 'quit'), 'die Bridge wird sauber beendet');
}
{
  const t = steuere({ FAKE_WARTERAUM: '1' }, { ZOOM_MEETING_ID: '1' });
  assert(await bisZeile(t.zeilen, 'Status: waitingRoom'), 'Warteraum (Strg+C)');
  t.strgC();
  assert((await mitFrist(t.lauf, 5000)) === 4, 'Strg+C im Warteraum -> Rueckgabe 4');
}
{
  const t = steuere({ FAKE_WARTERAUM: '1' }, { ZOOM_MEETING_ID: '1' }, { beitrittsFristMs: 300, sekunden: 30 });
  assert((await mitFrist(t.lauf, 5000)) === 4, 'feste Laufdauer (Pruefstand): die Beitrittsfrist gilt weiter, Rueckgabe 4');
}
{
  const vorher = Date.now();
  const t = steuere({ FAKE_BEITRITT_SCHEITERT: '4' }, { ZOOM_MEETING_ID: '1' }, { beitrittsFristMs: 20_000 });
  const code = await mitFrist(t.lauf, 5000);
  assert(code === 4 && Date.now() - vorher < 3000, 'failed beim Beitritt -> sofort Rueckgabe 4, nicht erst nach der Frist');
  assert(t.zeilen.some((z) => z.includes('falscher Kenncode')), 'der Grund steht da');
}

console.log('\nsteuerung — Eingaben nach "ende" werden nicht mehr gedeutet:');
{
  const t = steuere({ FAKE_ABGANG_MS: '600' }, { ZOOM_MEETING_ID: '1' });
  assert(await bisZeile(t.zeilen, 'Rohdaten-Erlaubnis: JA'), 'im Meeting mit Erlaubnis');
  t.tippe('ende');
  assert(await bisZeile(t.zeilen, 'verlasse das Meeting'), 'das Verlassen beginnt');
  t.roh('300\n+16778240\nliste\nende\n');
  const code = await mitFrist(t.lauf, 5000);
  assert(code === 0, 'Rueckgabe wie beim ersten "ende"');
  assert(t.zeilen.filter((z) => z.includes('verlasse das Meeting')).length === 1, '"Ende" erscheint nur einmal');
  assert(!t.zeilen.some((z) => z.includes('Video wird abonniert')), 'kein Abo wird mehr angekuendigt');
  assert(t.zeilen.some((z) => z.includes('Eingabe ignoriert')), 'spaete Eingaben werden als ignoriert gemeldet');
  assert(!t.befehle().some((b) => b.cmd === 'videoSubscribe' || b.cmd === 'videoDelay'), 'an die Bridge geht nichts mehr');
}

console.log('\nsteuerung — ein laufendes Abo wird nicht ein zweites Mal gesendet:');
{
  const t = steuere({}, { ZOOM_MEETING_ID: '1' });
  assert(await bisZeile(t.zeilen, 'Rohdaten-Erlaubnis: JA'), 'im Meeting mit Erlaubnis');
  t.tippe('+16778241');
  assert(await bisZeile(t.zeilen, 'video 16778241: subscribed (command)'), 'das Abo laeuft');
  t.tippe('+16778241 stumm');
  assert(await bisZeile(t.zeilen, 'laeuft schon'), '"+<id> stumm" auf ein laufendes Abo: "laeuft schon"');
  assert(t.zeilen.some((z) => z.includes('-16778241')), '... mit dem Weg zum Umschalten (erst -<id>)');
  await new Promise((r) => setTimeout(r, 150));
  assert(t.befehle().filter((b) => b.cmd === 'videoSubscribe' && b.id === 16778241).length === 1, 'es geht KEIN zweites videoSubscribe raus');
  assert(!t.zeilen.some((z) => z.includes('VIDEO_ALREADY_SUBSCRIBED')), 'kein VIDEO_ALREADY_SUBSCRIBED');
  t.tippe('ende');
  await t.lauf;
}

console.log('\nsteuerung — sechs eingefuegte Abos auf einmal: die Warnung kommt trotzdem:');
{
  const t = steuere({ FAKE_TEILNEHMER: '7' }, { ZOOM_MEETING_ID: '1' });
  assert(await bisZeile(t.zeilen, 'Rohdaten-Erlaubnis: JA'), 'im Meeting mit Erlaubnis');
  t.roh([0, 1, 2, 3, 4, 5].map((i) => `+${16778240 + i}\n`).join(''));
  assert(await bisZeile(t.zeilen, 'gemessen sind 5', 2000), 'die Warnung zaehlt auch noch unbestaetigte Abos mit');
  assert(t.zeilen.filter((z) => z.includes('gemessen sind 5')).length === 1, '... und kommt genau einmal (beim 6.)');
  t.tippe('ende');
  await t.lauf;
}

console.log('\nsteuerung — Wiederbeitritt mit Umhaengen ueber den Namen:');
{
  const t = steuere({ FAKE_WIEDERBEITRITT_MS: '400' }, { ZOOM_MEETING_ID: '1' });
  assert(await bisZeile(t.zeilen, 'Rohdaten-Erlaubnis: JA'), 'im Meeting mit Erlaubnis');
  const anna = t.zeilen.find((z) => z.includes('16778240  Anna')) ?? '';
  // Seit dem Umhaengen ueber den Namen (14.08.2026) ist ein Abo OHNE
  // persistentId sehr wohl umhaengbar - nur eben ueber den Namen.
  assert(anna !== '' && !anna.includes('nicht umhaengbar') && anna.includes('Namen'),
    'Teilnehmer ohne persistentId: der Hinweis nennt den Weg ueber den Namen, nicht "nicht umhaengbar"');
  t.tippe('+16778240');
  assert(await bisZeile(t.zeilen, 'video 16778240: subscribed (command)'), 'Anna ist abonniert');
  const zeile = t.zeilen.find((z) => z.includes('video 16778240: subscribed (command)')) ?? '';
  assert(!zeile.includes('NICHT umhaengbar'), 'die video-Zeile sagt nicht mehr "NICHT umhaengbar"');
  assert(await bisZeile(t.zeilen, 'video 16778250: subscribed (reboundByName)'), 'Anna kommt wieder, das Abo haengt sich um');
  assert(await bisZeile(t.zeilen, 'umgehaengt'), 'das Umhaengen wird als "nichts zu tun" gemeldet');
  await new Promise((r) => setTimeout(r, 600));
  assert(!t.zeilen.some((z) => z.includes('abonnieren mit +16778250')), 'KEIN Hinweis "abonnieren mit +<neu>" fuer ein schon umgehaengtes Abo');
  t.tippe('+16778250');
  assert(await bisZeile(t.zeilen, 'laeuft schon'), 'wer es trotzdem tippt, bekommt "laeuft schon"');
  assert(!t.befehle().some((b) => b.cmd === 'videoSubscribe' && b.id === 16778250), '... und es geht nichts an die Bridge');
  t.tippe('ende');
  await t.lauf;
}

console.log('\nsteuerung — der bestaetigte Versatz wird SOFORT weitergegeben:');
{
  const versatz: number[] = [];
  const t = steuere({}, { ZOOM_MEETING_ID: '1' }, { beiVersatz: (ms: number) => versatz.push(ms) });
  assert(await bisZeile(t.zeilen, 'Rohdaten-Erlaubnis: JA'), 'im Meeting');
  t.tippe('250');
  assert(await bisZeile(t.zeilen, 'Bild-Versatz: 250 ms'), 'die Bridge bestaetigt 250');
  // Nicht erst am Ende: nach Strg+C oder geschlossenem Fenster gibt es kein
  // "Ende" mehr, an dem der Wert noch weitergegeben werden koennte.
  assert(versatz.at(-1) === 250, 'beiVersatz kommt mit der Bestaetigung, nicht erst am Ende');
  t.tippe('4.5');
  assert(await bisZeile(t.zeilen, 'VIDEO_BAD_DELAY'), 'eine Fehleingabe wird abgewiesen');
  assert(versatz.length === 1, '... und gibt keinen Wert weiter');
  t.tippe('ende');
  await t.lauf;
}

// --- Stage 4: SDK-Fassung, PE-Leser, SDK-Ordnersuche (Spec 12.1 Nr. 1-2) -------

console.log('\nsdk — Fassung, PE-Leser, SDK-Ordnersuche (Stage 4):');
{
  /**
   * Kleinste PE-Datei, die peInfo lesen kann: "MZ", e_lfanew = 0x80, dort
   * "PE\0\0" und der Maschinentyp; mit `fassung` zusaetzlich VS_FIXEDFILEINFO
   * (Signatur BD 04 EF FE bei 0x100, dwFileVersionMS bei 0x108, LS bei 0x10c).
   */
  function machePe(maschine: number, fassung: [number, number, number, number] | null): Uint8Array {
    const buf = new Uint8Array(0x200);
    const dv = new DataView(buf.buffer);
    buf.set([0x4d, 0x5a], 0);
    dv.setUint32(0x3c, 0x80, true);
    buf.set([0x50, 0x45, 0, 0], 0x80);
    dv.setUint16(0x84, maschine, true);
    if (fassung) {
      const [a, b, c, d] = fassung;
      buf.set([0xbd, 0x04, 0xef, 0xfe], 0x100);
      dv.setUint32(0x108, ((a << 16) | b) >>> 0, true);
      dv.setUint32(0x10c, ((c << 16) | d) >>> 0, true);
    }
    return buf;
  }
  /** Meldung des geworfenen Fehlers, '' wenn nichts geworfen wurde. */
  const wirft = (f: () => unknown): string => {
    try {
      f();
      return '';
    } catch (e) {
      return (e as Error).message;
    }
  };

  assert(SDK_FASSUNG === '7.1.5.43953', 'SDK_FASSUNG ist 7.1.5.43953');
  assert(SDK_FASSUNG_BRIDGE === '7.1.5 (43953)', 'SDK_FASSUNG_BRIDGE ist "7.1.5 (43953)" (so meldet es ready.sdkVersion)');
  assert(PE_MASCHINE_X64 === 0x8664 && PE_MASCHINE_X86 === 0x014c, 'Maschinentypen: x64 = 0x8664, x86 = 0x014c');

  const x64 = peInfo(machePe(0x8664, [7, 1, 5, 43953]));
  assert(x64.maschine === 'x64' && x64.maschinenTyp === 0x8664 && x64.fassung === '7.1.5.43953', 'x64 + 7.1.5.43953 wird erkannt');
  const x86 = peInfo(machePe(0x014c, [7, 1, 5, 43953]));
  assert(x86.maschine === 'x86' && x86.maschinenTyp === 0x014c, '0x014c ist x86 (32-Bit-SDK, Text S2)');
  const arm = peInfo(machePe(0xaa64, null));
  assert(arm.maschine === 'andere' && arm.maschinenTyp === 0xaa64, 'ein anderer Maschinentyp heisst "andere" und behaelt seinen Wert');
  assert(peInfo(machePe(0x8664, null)).fassung === null, 'ohne Versionsressource: fassung null (Text S3b)');
  assert(peInfo(machePe(0x8664, [65535, 2, 65535, 4])).fassung === '65535.2.65535.4', 'Fassungsteile ueber 32767 werden vorzeichenlos gelesen');

  // Ein Buffer aus readFileSync ist oft ein Ausschnitt mit byteOffset > 0: peInfo
  // muss ab dem Anfang DIESER Datei lesen, nicht ab dem Anfang des Speichers.
  const roh = machePe(0x8664, [7, 1, 5, 43953]);
  const versetzt = new Uint8Array(roh.length + 7);
  versetzt.set(roh, 7);
  assert(peInfo(versetzt.subarray(7)).fassung === '7.1.5.43953', 'ein Ausschnitt mit byteOffset wird richtig gelesen');

  const ohnePe = machePe(0x8664, [7, 1, 5, 43953]);
  ohnePe.set([0x50, 0x58], 0x80); // "PX\0\0"
  assert(wirft(() => peInfo(ohnePe)) === 'Keine PE-Datei (Signatur PE\\0\\0 fehlt).', 'ohne "PE\\0\\0": Fehler mit fester Meldung');
  assert(wirft(() => peInfo(new Uint8Array(0x20))) !== '', 'ein 0x20-Byte-Puffer wirft');
  const zuWeit = machePe(0x8664, null);
  new DataView(zuWeit.buffer).setUint32(0x3c, 0x1fe, true);
  assert(wirft(() => peInfo(zuWeit)) !== '', 'e_lfanew hinter dem Dateiende wirft');

  // findeSdkBin: der Bediener waehlt die SDK-Wurzel, x64 oder x64\bin (Spec 6.1 Schritt 3).
  const w = join(tmpdir(), 'jm-sdk-probe');
  const bin = join(w, 'x64', 'bin');
  const da = (...pfade: string[]) => {
    const s = new Set(pfade);
    return (p: string) => s.has(p);
  };
  const nurBin = da(join(bin, 'sdk.dll'));
  assert(findeSdkBin(w, nurBin) === bin, 'Wurzel gewaehlt -> x64\\bin');
  assert(findeSdkBin(join(w, 'x64'), nurBin) === bin, 'x64 gewaehlt -> x64\\bin');
  assert(findeSdkBin(bin, nurBin) === bin, 'x64\\bin gewaehlt -> derselbe Ordner');
  assert(findeSdkBin(join(w, 'leer'), da()) === null, 'leerer Ordner -> null (Text S1)');
  assert(findeSdkBin(w, da(join(w, 'sdk.dll'), join(bin, 'sdk.dll'))) === w, 'Reihenfolge: sdk.dll direkt im gewaehlten Ordner gewinnt');

  // Die oeffentliche Flaeche: src/index.ts und der Paket-Export "./sdk".
  assert(paket.SDK_FASSUNG === SDK_FASSUNG && paket.SDK_FASSUNG_BRIDGE === SDK_FASSUNG_BRIDGE,
    'src/index.ts exportiert SDK_FASSUNG und SDK_FASSUNG_BRIDGE');
  assert(paket.peInfo === peInfo && paket.findeSdkBin === findeSdkBin, 'src/index.ts exportiert peInfo und findeSdkBin');
  const ueberExport = (await import('@jm/zoom-bridge/sdk')) as { SDK_FASSUNG?: string };
  assert(ueberExport.SDK_FASSUNG === SDK_FASSUNG, 'package.json exportiert "./sdk" (Selbstbezug @jm/zoom-bridge/sdk)');
}

// --- Stage 4: Fehlerkatalog fuer die Klartexte in JM Connect (Spec 12.1 Nr. 3) ---

console.log('\nprotocol — Fehlerkatalog Stage 4:');
{
  // SDK-Namen woertlich aus meeting_service_interface.h - die vier, an denen
  // die harte Grenze "nur eigenes Zoom-Konto" haengt (E3, Spec 8.3), und 11,
  // der in FAIL_CODES fehlte.
  assert(failCodeName(63) === 'MEETING_FAIL_UNABLE_TO_JOIN_EXTERNAL_MEETING', 'failCodeName(63)');
  assert(failCodeName(11) === 'MEETING_FAIL_NO_MMR', 'failCodeName(11)');
  assert(failCodeName(64) === 'MEETING_FAIL_BLOCKED_BY_ACCOUNT_ADMIN', 'failCodeName(64)');
  assert(failCodeName(82) === 'MEETING_FAIL_NEED_SIGN_IN_FOR_PRIVATE_MEETING', 'failCodeName(82)');
  assert(failCodeName(503) === 'MEETING_FAIL_USER_LEVEL_TOKEN_NOT_HAVE_HOST_ZAK_OBF', 'failCodeName(503)');
  assert(failCodeName(504) === 'MEETING_FAIL_APP_CAN_NOT_ANONYMOUS_JOIN_MEETING', 'failCodeName(504)');
  assert(failCodeName(0) === 'MEETING_SUCCESS' && failCodeName(0xffff) === 'MEETING_FAIL_UNKNOWN', 'failCodeName(0) und (0xffff)');
  assert(failCodeName(4242) === 'MEETING_FAIL_CODE_4242', 'ein unbekannter Code wird nicht gerundet: MEETING_FAIL_CODE_4242');
  const namen = Object.values(FAIL_CODE_NAMES);
  assert(Object.keys(FAIL_CODE_NAMES).length === 46, 'FAIL_CODE_NAMES hat alle 46 Werte von enum MeetingFailCode');
  assert(new Set(namen).size === namen.length, 'kein MeetingFailCode-Name kommt zweimal vor');

  // failReason/endReason: der deutsche Grund OHNE Vorsatz (Spec 8.3 "Csonst").
  assert(failReason(11) === 'kein Medienserver gefunden', 'failReason(11) ist deutsch');
  assert(!failReason(11).startsWith('gescheitert'), 'failReason traegt keinen Vorsatz "gescheitert: "');
  assert(failReason(2) === 'Wiederverbinden fehlgeschlagen', 'failReason(2) wie bisher');
  assert(failReason(9999) === 'unbekannter Grund', 'failReason eines unbekannten Codes: "unbekannter Grund"');
  const neu = [11, 14, 15, 16, 23, 60, 61, 62, 63, 64, 82, 88, 89, 500, 501, 502, 503, 504, 505, 506];
  assert(neu.every((c) => failReason(c) !== 'unbekannter Grund'), 'FAIL_CODES kennt 11, 14-16, 23, 60-64, 82, 88, 89, 500-506');
  assert(endReason(2) === 'vom Gastgeber beendet', 'endReason(2)');
  assert(endReason(99) === 'Grund 99', 'endReason eines unbekannten Grundes: "Grund 99"');

  // explainStatus bleibt, wie es war (Konsole und Bridge-Log lesen es weiter).
  assert(explainStatus('failed', 4) === 'gescheitert: falscher Kenncode', 'explainStatus(failed, 4) unveraendert');
  assert(explainStatus('ended', 2) === 'beendet: vom Gastgeber beendet', 'explainStatus(ended, 2) unveraendert');
  assert(explainStatus('failed', 4242) === 'gescheitert: Fehlerschluessel 4242', 'explainStatus: unbekannter Code wie bisher');

  // Die oeffentliche Flaeche (src/index.ts), aus der JM Connect liest.
  assert(
    paket.FAIL_CODE_NAMES === FAIL_CODE_NAMES && paket.failCodeName === failCodeName && paket.failReason === failReason && paket.endReason === endReason,
    'src/index.ts exportiert FAIL_CODE_NAMES, failCodeName, failReason, endReason',
  );
  const typen: [PaketAudioState, PaketAudioReason, PaketVideoState, PaketVideoReason] = ['off', 'participantLeft', 'black', 'participantLeft'];
  assert(typen.length === 4, 'src/index.ts exportiert die Typen AudioState, AudioReason, VideoState, VideoReason (prueft tsc)');
}

// --- Stage 4: Attrappe mit den Stellschrauben aus Spec 12.1 Nr. 4 ---------------

/** Wartet, bis ein Ereignis `pred` erfuellt (Takt 20 ms); false nach `ms`. */
async function bisEreignis(ev: BridgeEvent[], pred: (e: BridgeEvent) => boolean, ms = 4000): Promise<boolean> {
  const ende = Date.now() + ms;
  while (Date.now() < ende) {
    if (ev.some(pred)) return true;
    await new Promise((r) => setTimeout(r, 20));
  }
  return false;
}

/** Passt auf ein Ereignis `name`, dessen Felder die Werte aus `felder` tragen. */
const art = (name: string, felder: Record<string, unknown> = {}) => (e: BridgeEvent): boolean =>
  e.ev === name && Object.entries(felder).every(([k, v]) => (e as Record<string, unknown>)[k] === v);

/** Stelle des ersten passenden Ereignisses, sonst -1. */
const stelle = (ev: BridgeEvent[], pred: (e: BridgeEvent) => boolean): number => ev.findIndex(pred);

/** Die Statusfolge, wie sie auf der Leitung stand. */
const statusFolge = (ev: BridgeEvent[]): string =>
  ev.filter((e) => e.ev === 'status').map((e) => (e as { status: string }).status).join(',');

/** Ein Beitritt mit synthetischer Nummer und erfundenem Kenncode (nie echte Werte). */
const BEITRITT = { cmd: 'join', meetingId: '7'.repeat(10), passcode: 'KENNCODE-PROBE-3', displayName: 'JM Connect' } as const;

/**
 * Echte Bridge gegen die Attrappe (Drehbuch "steuerung"), so wie JM Connect sie
 * fuehrt: init und auth senden, auf die Antwort warten, dann `schritte`, am Ende
 * IMMER stop(). Liefert alle Ereignisse, auch die beim Abbau.
 */
async function fahreSteuerung(
  fakeEnv: Record<string, string>,
  schritte: (b: Bridge, ev: BridgeEvent[]) => Promise<void>,
): Promise<BridgeEvent[]> {
  const ev: BridgeEvent[] = [];
  const b = new Bridge({
    exePath: process.execPath,
    exeArgs: [fake],
    env: { FAKE_SCRIPT: 'steuerung', ...fakeEnv },
    joinTimeoutMs: 5000,
    killTimeoutMs: 3000,
    onEvent: (e) => ev.push(e),
    onLog: () => {},
  });
  await b.start();
  try {
    b.send({ cmd: 'init' });
    b.send({ cmd: 'auth', jwt: 'attrappe' });
    await bisEreignis(ev, (e) => e.ev === 'auth' || art('error', { where: 'auth' })(e));
    await schritte(b, ev);
  } finally {
    await b.stop();
  }
  return ev;
}

console.log('\nAttrappe — Stellschrauben Stage 4:');
{
  // FAKE_SDK_FASSUNG: JM Connect prueft die Fassung exakt (G1) - die Attrappe muss sie liefern koennen.
  let ev = await fahreSteuerung({ FAKE_SDK_FASSUNG: '7.1.5 (43953)' }, async () => {});
  const ready = ev.find(art('ready')) as { sdkVersion?: string } | undefined;
  assert(ready?.sdkVersion === SDK_FASSUNG_BRIDGE, 'FAKE_SDK_FASSUNG bestimmt ready.sdkVersion');
  ev = await fahreSteuerung({}, async () => {});
  const vorgabe = ev.find(art('ready')) as { sdkVersion?: string } | undefined;
  assert(vorgabe?.sdkVersion === '7.1.5 (attrappe)', 'ohne FAKE_SDK_FASSUNG bleibt die Vorgabe "7.1.5 (attrappe)"');
}
{
  const ev = await fahreSteuerung({ FAKE_NDI_FEHLER: '1' }, async () => {});
  const iReady = stelle(ev, art('ready'));
  const iNdi = stelle(ev, art('error', { where: 'ndi', code: 'ndiInitFailed' }));
  assert(iReady >= 0 && iNdi === iReady + 1, 'FAKE_NDI_FEHLER: error ndi ndiInitFailed direkt nach ready');
  assert(iNdi >= 0 && stelle(ev, art('auth')) > iNdi, '... also vor der Antwort auf die Anmeldung');
  assert(ev[iNdi]?.name === 'NDI_INIT_FAILED', '... mit dem Namen NDI_INIT_FAILED');
}
{
  const ev = await fahreSteuerung({ FAKE_DOPPELNAME: '1' }, async (b, ev) => {
    b.send(BEITRITT);
    await bisEreignis(ev, art('roster'));
  });
  const roster = ev.find(art('roster')) as { list?: Participant[] } | undefined;
  const annas = (roster?.list ?? []).filter((p) => !p.self && p.name === 'Anna').map((p) => p.id);
  assert(annas.join(',') === '16778240,16778241', 'FAKE_DOPPELNAME: 16778240 und 16778241 heissen beide "Anna"');
}
{
  const ev = await fahreSteuerung({ FAKE_WARTERAUM: '1', FAKE_EINLASS_MS: '100' }, async (b, ev) => {
    b.send(BEITRITT);
    await bisEreignis(ev, art('status', { status: 'inMeeting' }));
  });
  assert(statusFolge(ev).startsWith('connecting,waitingRoom,reconnecting,connecting,inMeeting'),
    'FAKE_EINLASS_MS: der gemessene Einlass connecting, waitingRoom, reconnecting, connecting, inMeeting');
}
{
  let mitten = '';
  const ev = await fahreSteuerung({ FAKE_WARTERAUM: '1', FAKE_EINLASS_MS: '100', FAKE_EINLASS_HAENGT: '1' }, async (b, ev) => {
    b.send(BEITRITT);
    await bisEreignis(ev, art('status', { status: 'reconnecting' }));
    await new Promise((r) => setTimeout(r, 300));
    mitten = statusFolge(ev);
  });
  assert(mitten === 'connecting,waitingRoom,reconnecting', 'FAKE_EINLASS_HAENGT: nach reconnecting kommt nichts mehr');
  assert(statusFolge(ev) === 'connecting,waitingRoom,reconnecting', '... auch beim Beenden nicht (nie im Meeting gewesen)');
}
{
  let mitten = '';
  const ev = await fahreSteuerung({ FAKE_VERBINDUNG_HAENGT_MS: '100' }, async (b, ev) => {
    b.send(BEITRITT);
    await bisEreignis(ev, art('status', { status: 'reconnecting' }));
    await new Promise((r) => setTimeout(r, 300));
    mitten = statusFolge(ev);
  });
  assert(mitten === 'connecting,inMeeting,reconnecting', 'FAKE_VERBINDUNG_HAENGT_MS: reconnecting, dann Stille');
  assert(statusFolge(ev) === 'connecting,inMeeting,reconnecting,disconnecting,ended',
    '... beim stop() meldet sie disconnecting und ended (sie war noch "im Meeting")');
}
{
  const ev = await fahreSteuerung({ FAKE_ENTZUG_MS: '100' }, async (b, ev) => {
    b.send(BEITRITT);
    await bisEreignis(ev, art('privilege', { source: 'broadcast' }));
    b.send({ cmd: 'videoSubscribe', id: 16778240, resolution: '720p' });
    await bisEreignis(ev, art('error', { code: 'videoNoPrivilege' }));
  });
  const iJa = stelle(ev, art('privilege', { canRecordRaw: true }));
  const iEntzug = stelle(ev, art('privilege', { canRecordRaw: false, source: 'broadcast' }));
  assert(iJa >= 0 && iEntzug > iJa, 'FAKE_ENTZUG_MS: privilege broadcast canRecordRaw:false nach der Erlaubnis');
  assert(stelle(ev, art('error', { where: 'video', code: 'videoNoPrivilege', id: 16778240 })) > iEntzug,
    '... ein folgendes videoSubscribe wird mit videoNoPrivilege abgewiesen');
}
{
  let zwischenMs = -1;
  const ev = await fahreSteuerung({ FAKE_WIEDERBEITRITT_MS: '500', FAKE_RUECKKEHR_MS: '200' }, async (b, ev) => {
    b.send(BEITRITT);
    await bisEreignis(ev, art('privilege', { canRecordRaw: true }));
    b.send({ cmd: 'videoSubscribe', id: 16778240, resolution: '720p' });
    await bisEreignis(ev, art('left'));
    const weg = Date.now();
    await bisEreignis(ev, art('joined'));
    zwischenMs = Date.now() - weg;
    await bisEreignis(ev, art('video', { reason: 'reboundByName' }));
  });
  const iLeft = stelle(ev, art('left', { id: 16778240 }));
  const iSchwarz = stelle(ev, art('video', { id: 16778240, state: 'black', reason: 'participantLeft' }));
  const iTonAus = stelle(ev, art('audio', { id: 16778240, state: 'off', reason: 'participantLeft' }));
  assert(iLeft >= 0 && iSchwarz === iLeft + 1 && iTonAus === iSchwarz + 1,
    'Weggang mit Abo: left, video black, audio off (participantLeft) - wie das Original');
  assert((ev[iSchwarz] as { source?: string } | undefined)?.source === 'JM Connect – Zoom Anna', '... die Quelle bleibt bestehen, nur schwarz');
  const iJoined = stelle(ev, art('joined'));
  const zurueck = ev[iJoined] as { p?: Participant } | undefined;
  assert(iJoined > iTonAus && zurueck?.p?.id === 16778250 && zurueck.p.name === 'Anna', 'Anna kommt als 16778250 zurueck');
  assert(zwischenMs >= 150, 'FAKE_RUECKKEHR_MS: zwischen left und joined liegen mindestens 150 ms');
  const iUm = stelle(ev, art('video', { id: 16778250, state: 'subscribed', reason: 'reboundByName' }));
  assert(iUm > iJoined, '... dann haengt sich das Abo um (ERST joined, DANN video reboundByName)');
  assert(stelle(ev, art('audio', { id: 16778250, state: 'waiting', reason: 'reboundByName' })) > iUm,
    '... und der Ton wartet wieder (Grund reboundByName wie im Original)');
}
{
  const ev = await fahreSteuerung({ FAKE_WIEDERBEITRITT_MS: '500', FAKE_RUECKKEHR_NAME: 'anna' }, async (b, ev) => {
    b.send(BEITRITT);
    await bisEreignis(ev, art('privilege', { canRecordRaw: true }));
    b.send({ cmd: 'videoSubscribe', id: 16778240, resolution: '720p' });
    await bisEreignis(ev, art('joined'));
    await new Promise((r) => setTimeout(r, 300));
  });
  const zurueck = ev.find(art('joined')) as { p?: Participant } | undefined;
  assert(zurueck?.p?.id === 16778250 && zurueck.p.name === 'anna', 'FAKE_RUECKKEHR_NAME: sie kommt als "anna" zurueck');
  assert(!ev.some(art('video', { reason: 'reboundByName' })), '... und das Abo haengt NICHT um (Name nicht exakt gleich)');
  assert(stelle(ev, art('video', { id: 16778240, state: 'black', reason: 'participantLeft' })) >= 0, '... es bleibt schwarz unter 16778240');
}
{
  // Doppelname und Rueckkehr: "Anna" gibt es danach zweimal (16778241 und 16778250) -
  // das Original haengt dann nicht um ("lieber ein Handgriff als die falsche Person").
  const ev = await fahreSteuerung({ FAKE_WIEDERBEITRITT_MS: '500', FAKE_DOPPELNAME: '1' }, async (b, ev) => {
    b.send(BEITRITT);
    await bisEreignis(ev, art('privilege', { canRecordRaw: true }));
    b.send({ cmd: 'videoSubscribe', id: 16778240, resolution: '720p' });
    await bisEreignis(ev, art('joined'));
    await new Promise((r) => setTimeout(r, 300));
  });
  assert(stelle(ev, art('joined')) >= 0 && !ev.some(art('video', { reason: 'reboundByName' })),
    'Doppelname: bei der Rueckkehr haengt die Attrappe NICHT um (Name nicht eindeutig)');
}
{
  // envprobe meldet den PATH, den das Kind bekommt. "Path" (so erbt Windows ihn)
  // muss dafuer weg, sonst stuenden "Path" und "PATH" nebeneinander (Spec 3.2-4).
  const marke = join(tmpdir(), 'jm-envprobe-marke');
  const ev: BridgeEvent[] = [];
  const b = new Bridge({
    exePath: process.execPath,
    exeArgs: [fake],
    env: { FAKE_SCRIPT: 'envprobe', PATH: `${marke}${delimiter}${process.env.PATH ?? ''}` },
    envRemove: Object.keys(process.env).filter((k) => k.toLowerCase() === 'path' && k !== 'PATH'),
    onEvent: (e) => ev.push(e),
  });
  await b.start();
  await bisEreignis(ev, art('envprobe'));
  const probe = ev.find(art('envprobe')) as { path?: string } | undefined;
  assert(typeof probe?.path === 'string' && probe.path.split(delimiter).includes(marke), 'envprobe meldet path: den PATH, den das Kind wirklich bekommt');
  await b.stop();
}

console.log(failures === 0 ? '\nAlle Selbsttests bestanden.' : `\n${failures} Selbsttest(s) fehlgeschlagen.`);
process.exit(failures === 0 ? 0 : 1);
