// Selbsttests der reinen TypeScript-Logik. Brauchen KEIN Zoom-SDK, KEINEN Compiler
// und KEIN Meeting — sie laufen auch auf Linux.
//   npm run selftest -w @jm/zoom-bridge
import { buildJwt, readCredentials } from '../src/jwt.ts';
import {
  LineSplitter,
  authResultName,
  enrich,
  explainStatus,
  normalizeMeetingId,
  parseWireEvent,
  sdkErrorName,
  serializeCommand,
  SDK_ERROR_NAMES,
  AUTH_RESULT_NAMES,
  type BridgeEvent,
  type Participant,
} from '../src/protocol.ts';
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

console.log(failures === 0 ? '\nAlle Selbsttests bestanden.' : `\n${failures} Selbsttest(s) fehlgeschlagen.`);
process.exit(failures === 0 ? 0 : 1);
