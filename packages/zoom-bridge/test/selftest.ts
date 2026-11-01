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
  type BridgeEvent,
  type Participant,
  type WireEvent,
} from '../src/protocol.ts';
import { withNdiRuntimeOnPath } from '../src/ndi-path.ts';
import { PE_MASCHINE_X64, PE_MASCHINE_X86, SDK_FASSUNG, SDK_FASSUNG_BRIDGE, findeSdkBin, peInfo } from '../src/sdk.ts';
import * as paket from '../src/index.ts';
import type { AudioState as PaketAudioState } from '../src/index.ts';
import { tmpdir } from 'node:os';
import { delimiter } from 'node:path';
import { mkdtempSync, rmSync, writeFileSync, unlinkSync } from 'node:fs';

let failures = 0;
function assert(cond: boolean, name: string): void {
  if (cond) console.log(`  ok  ${name}`);
  else {
    failures++;
    console.error(`FAIL  ${name}`);
  }
}

// Ein eigener Temp-Ordner JE LAUF fuer die Zugangsdaten-Dateien unten. Frueher hiessen sie
// `${tmpdir()}/zoom-test-${Date.now()}-…` direkt in %TEMP%: zwei gleichzeitige Laeufe (z. B.
// zwei Worktrees) trafen dieselbe Millisekunde, der eine loeschte die Datei des anderen.
// GEMESSEN (Schliff S2, 10 Paare parallel): 4 von 20 Laeufen rot - dreimal Absturz in
// unlinkSync (ENOENT), einmal FAIL "UTF-16 BE mit BOM (FE FF): wird gelesen wie ohne BOM".
// `join` kommt aus dem Import weiter unten (Importe gelten im ganzen Modul).
const testTemp = mkdtempSync(join(tmpdir(), 'jm-bridge-test-'));
process.on('exit', () => {
  try {
    rmSync(testTemp, { recursive: true, force: true });
  } catch {
    // Aufraeumen darf das Ergebnis nicht aendern; ein liegengebliebener Ordner stoert keinen Lauf.
  }
});

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
    const tempFile1 = join(testTemp, 'zugang-1.json');
    writeFileSync(tempFile1, JSON.stringify({ clientId: 'file-clientid', clientSecret: 'file-secret' }), 'utf8');
    process.env.ZOOM_SDK_CREDENTIALS = tempFile1;
    creds = readCredentials();
    assert(creds.clientId === 'file-clientid' && creds.clientSecret === 'file-secret', 'Dateiweg: Client-ID und Secret aus JSON');
    unlinkSync(tempFile1);

    // Namensvarianten client_id/client_secret
    const tempFile2 = join(testTemp, 'zugang-2.json');
    writeFileSync(tempFile2, JSON.stringify({ client_id: 'alt-clientid', client_secret: 'alt-secret' }), 'utf8');
    process.env.ZOOM_SDK_CREDENTIALS = tempFile2;
    creds = readCredentials();
    assert(creds.clientId === 'alt-clientid' && creds.clientSecret === 'alt-secret', 'Namensvarianten: client_id/client_secret');
    unlinkSync(tempFile2);

    // Namensvarianten appKey/sdkSecret
    const tempFile3 = join(testTemp, 'zugang-3.json');
    writeFileSync(tempFile3, JSON.stringify({ appKey: 'app-key', sdkSecret: 'sdk-secret' }), 'utf8');
    process.env.ZOOM_SDK_CREDENTIALS = tempFile3;
    creds = readCredentials();
    assert(creds.clientId === 'app-key' && creds.clientSecret === 'sdk-secret', 'Namensvarianten: appKey/sdkSecret');
    unlinkSync(tempFile3);

    // Vorrang: Umgebung gewinnt ueber Datei
    process.env.ZOOM_SDK_CLIENT_ID = 'env-wins';
    process.env.ZOOM_SDK_CLIENT_SECRET = 'env-wins-secret';
    const tempFile4 = join(testTemp, 'zugang-4.json');
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

    const tempFile = join(testTemp, 'zugang-env.json');
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
    const kaputtDatei = join(testTemp, 'zugang-kaputt.json');
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
    const datei = join(testTemp, 'zugang-bom.json');
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
  // Stage 4b (N4b.2): Eine kaputte EREIGNIS-Zeile kann Teilnehmernamen tragen. Von ihr stehen nur
  // Laenge und Ereignisart im Log; fremde Zeilen des SDK (oben) bleiben woertlich.
  assert(
    logs.some((l) => /^unlesbare Zeile \(\d+ Zeichen, beginnt mit \{"ev":"roster"\)$/.test(l)),
    'eine kaputte roster-Zeile steht nur mit Laenge und Ereignisart im Log',
  );
  assert(!logs.some((l) => l.includes('Anna Maria')), 'kein Teilnehmername aus der kaputten Zeile im Log (N4b.2)');
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

// Die Reducer-Fälle zu video (Abo-Buchführung, derselbe Zustand mit zwei Ursachen, Umhängen über persistentId
// und Namen) zogen nach A1 PT1 um (Plan A, Task A3; 11.10): Slots schlüsseln nach Slot-Nummer, die Bridge hängt
// nie selbst um (6.18), „zwei Ursachen, ein Zustand“ prüft A1 mit noFrames neben cameraOff.

// Das Abo über das Drehbuch "video" (videoSubscribe → video/audio) zog nach A2 PT5 um (Plan A, Task A2, 11.10):
// die Attrappe beantwortet videoSubscribe nur noch im Altweg.
// WIDERRUF (Plan B, Task B23): Den Altweg gibt es nicht mehr; videoSubscribe ist ein unbekannter Befehl.

// --- NDI-Laufzeit auf dem PATH des Kindprozesses ------------------------
// REGRESSION, gemessen am 2026-08-13: zoom-bridge.exe ist seit Stage 2 auch
// gegen die NDI-Importbibliothek gebunden und startet ohne
// Processing.NDI.Lib.x64.dll gar nicht - ohne eine einzige Zeile Ausgabe.
// test/join.mjs gibt ein EIGENES PATH mit und loeschte damit beim Merge die
// Erweiterung, die es nie hatte. Diese Zusicherungen halten die Reihenfolge
// fest, nicht nur die Funktion.
{
  // Beispielpfade passend zur Plattform: Unter Linux ist der PATH-Trenner ':',
  // ein Windows-Pfad wie C:\ndi zerfiele dort am Laufwerksdoppelpunkt
  // (gemessen im ersten Linux-CI-Lauf am 2026-10-06).
  const A = process.platform === 'win32' ? 'C:\\a' : '/a';
  const NDI = process.platform === 'win32' ? 'C:\\ndi' : '/opt/ndi';
  const mitPfad = withNdiRuntimeOnPath({ PATH: A }, NDI);
  assert(mitPfad.PATH === `${NDI}${delimiter}${A}`, 'NDI-Laufzeit kommt VORN auf den PATH');

  const ohneFund = { PATH: A };
  assert(withNdiRuntimeOnPath(ohneFund, null) === ohneFund, 'ohne gefundene DLL bleibt die Umgebung unveraendert');

  const schonDa = { PATH: `${NDI}${delimiter}${A}` };
  assert(withNdiRuntimeOnPath(schonDa, NDI) === schonDa, 'ein bereits vorhandener Eintrag wird nicht verdoppelt');

  assert(withNdiRuntimeOnPath({}, NDI).PATH === NDI, 'ohne PATH entsteht ein PATH mit genau diesem Eintrag');

  const original = { PATH: 'C:\\a' };
  withNdiRuntimeOnPath(original, 'C:\\ndi');
  assert(original.PATH === 'C:\\a', 'die uebergebene Umgebung wird nicht veraendert');

  // Die eigentliche Regression: der Merge in bridge.ts laesst ein vom Aufrufer
  // gesetztes PATH GEWINNEN. Wird die NDI-Laufzeit vorher angehaengt, ist sie
  // danach weg. Diese Zusicherung bildet genau diese Reihenfolge nach.
  const wieInBridge = withNdiRuntimeOnPath({ ...{ PATH: 'system' }, ...{ PATH: 'aufrufer' } }, 'C:\\ndi');
  assert(wieInBridge.PATH === `C:\\ndi${delimiter}aufrufer`, 'ein vom Aufrufer gesetztes PATH behaelt die NDI-Laufzeit');
}

// --- Ton: Protokoll und Zustand (seit Plan A, Task A3 mit slotAudio; 11.10 → PT1) ---------------------
console.log('\nprotocol — Ton:');
{
  const ev = parseWireEvent('{"ev":"slotAudio","slot":1,"state":"live","source":"person","configured":"person","reason":"packets","sampleRate":32000,"channels":1}');
  assert(ev?.ev === 'slotAudio', 'ein slotAudio-Ereignis wird gelesen');
  assert((ev as { sampleRate?: number }).sampleRate === 32000, 'die Abtastrate kommt durch');
  const ohne = parseWireEvent('{"ev":"slotAudio","slot":1,"state":"waiting","source":"none","configured":"person","reason":"command"}');
  assert((ohne as { sampleRate?: number })?.sampleRate === undefined,
    'ohne gemessenes Paket fehlt die Abtastrate — sie wird NICHT erfunden');
  assert(serializeCommand(slotAn(1, 'JM Connect – Zoom Anna', { audio: 'off' })).includes('"audio":"off"'),
    'der Ton-Schalter steht im Befehl (slotOn mit audio off)');
  const fehler = enrich({ ev: 'error', where: 'audio', code: 'audioQueueOverflow' } as WireEvent);
  assert((fehler as { name?: string }).name === 'AUDIO_QUEUE_OVERFLOW', 'der Ueberlauf hat einen eigenen Namen');
}

console.log('\nstate — Ton:');
{
  // 'audioUnavailable' und 'command' sind zwei Ursachen und zwei Namen (Review Task 5), jetzt am slotAudio. Die
  // Zuweisungen prüft tsc: fehlt einer der Werte in SlotAudioReason, ist der Typcheck rot.
  const ausgefallen: PaketSlotAudioReason = 'audioUnavailable';
  const abgeschaltet: PaketSlotAudioReason = 'command';
  let t = initialSession();
  t = reduce(t, enrich({ ev: 'slotAudio', slot: 9, state: 'off', source: 'none', configured: 'person', reason: ausgefallen } as WireEvent));
  t = reduce(t, enrich({ ev: 'slotAudio', slot: 10, state: 'off', source: 'none', configured: 'person', reason: abgeschaltet } as WireEvent));
  assert(t.slotAudio.get(9)?.reason === 'audioUnavailable' && t.slotAudio.get(10)?.reason === 'command',
    'reduce() speichert beide Gruende unveraendert und unterscheidbar, statt einen auf den anderen abzubilden');
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
  // PT8 (6.18): "=<Slot> <Kennung>" hängt einen Slot um.
  assert(gleich(d('=1 16778250'), { art: 'umhaengen', slot: 1, id: 16778250 }), '"=1 16778250" hängt Slot 1 um');
  assert(gleich(d(' = 2   16778241 '), { art: 'umhaengen', slot: 2, id: 16778241 }), '"= 2   16778241" (Leerraum stört nicht)');
  for (const kaputt of ['abc', '+', '+abc', '+16778240 laut', '-', '-4.5', '-abc', 'ende jetzt', '+99999999999999999999',
    '=', '=1', '=a 5', '=1 5 x', '=1 99999999999999999999']) {
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
  assert(await bisZeile(t.zeilen, 'slot 1: starting (command)'), '"+<id>" startet einen Slot im Lauf');
  const abo = t.befehle().find((b) => b.cmd === 'slotOn' && b.id === 16778240);
  assert(abo?.slot === 1 && abo.mode === 'participant' && abo.resolution === '720p' && abo.audio === 'person' && abo.shareAudio === false
      && abo.fallback === 'black' && abo.showNoVideo === true && abo.ndi === 'JM Connect – Zoom Anna',
    'slotOn mit der kleinsten freien Nummer, 720p, Ton der Person, Ersatzbild schwarz, NDI-Name nach der Namensregel (A-EP8, A-EP9)');

  t.tippe('+16778241 stumm');
  assert(await bisZeile(t.zeilen, 'ton 2: off (command)'), '"+<id> stumm" liefert Bild ohne Ton');
  const stumm = t.befehle().find((b) => b.cmd === 'slotOn' && b.id === 16778241);
  assert(stumm?.audio === 'off' && stumm.slot === 2, '"stumm" sendet audio:"off" (Slot 2)');

  t.tippe('+999');
  assert(await bisZeile(t.zeilen, 'nicht in der Teilnehmerliste'), 'eine unbekannte Kennung wird gemeldet');
  await new Promise((r) => setTimeout(r, 100));
  assert(!t.befehle().some((b) => b.id === 999), 'eine unbekannte Kennung geht NICHT an die Bridge');

  t.tippe('liste');
  assert(await bisZeile(t.zeilen, 'Slots (2):'), '"liste" nennt die laufenden Slots');
  assert(t.zeilen.filter((z) => z.includes('(das sind wir)')).length >= 2, '"liste" druckt die Teilnehmer erneut, samt "(das sind wir)"');

  t.tippe('-16778240');
  assert(await bisZeile(t.zeilen, 'slot 1: off (command)'), '"-<id>" stoppt den Slot mit diesem Ziel');
  assert(t.befehle().some((b) => b.cmd === 'slotOff' && b.slot === 1), 'als slotOff {slot:1}');

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
  assert(!t.befehle().some((b) => b.cmd === 'slotOn'), 'ohne Erlaubnis geht KEIN slotOn raus');
  t.strgC();
  const code = await t.lauf;
  assert(code === 3, 'Strg+C ohne Erlaubnis -> Rueckgabe 3');
  assert(t.zeilen.some((z) => z.includes('Abbruch — verlasse das Meeting')), 'Strg+C meldet sich wie bisher');
}

console.log('\nsteuerung — Meeting-Ende im Endlos-Modus:');
{
  const t = steuere({ FAKE_MEETING_ENDE_MS: '600' }, { ZOOM_MEETING_ID: '1', ZOOM_VIDEO_SUBSCRIBE: '16778240' });
  assert(await bisZeile(t.zeilen, 'slot 1: starting (command)'), 'der Start-Slot laeuft');
  const code = await Promise.race([t.lauf, new Promise<number>((r) => setTimeout(() => r(-99), 5000))]);
  assert(code === 0, 'Meeting-Ende beendet den Endlos-Lauf von selbst, mit Rueckgabe 0 (Erlaubnis war erteilt)');
  assert(t.zeilen.some((z) => z.includes('slot 1: off (meetingEnded)')), 'der Abbau wird noch gedruckt');
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
    assert(await bisZeile(t.zeilen, `slot ${i + 1}: starting`), `Slot ${i + 1} laeuft`);
  }
  assert(!t.zeilen.some((z) => z.includes('gemessen sind 5')), 'bis 5 Slots keine Warnung');
  t.tippe('+16778245');
  assert(await bisZeile(t.zeilen, 'gemessen sind 5'), 'beim 6. Slot kommt die Warnung');
  assert(await bisZeile(t.zeilen, 'slot 6: starting'), '... und der Slot wird trotzdem gestartet');
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
  assert(!t.zeilen.some((z) => z.includes('wird gestartet')), 'kein Slot wird mehr angekuendigt');
  assert(t.zeilen.some((z) => z.includes('Eingabe ignoriert')), 'spaete Eingaben werden als ignoriert gemeldet');
  assert(!t.befehle().some((b) => b.cmd === 'slotOn' || b.cmd === 'videoDelay'), 'an die Bridge geht nichts mehr');
}

console.log('\nsteuerung — ein laufendes Abo wird nicht ein zweites Mal gesendet:');
{
  const t = steuere({}, { ZOOM_MEETING_ID: '1' });
  assert(await bisZeile(t.zeilen, 'Rohdaten-Erlaubnis: JA'), 'im Meeting mit Erlaubnis');
  t.tippe('+16778241');
  assert(await bisZeile(t.zeilen, 'slot 1: starting (command)'), 'der Slot laeuft');
  t.tippe('+16778241 stumm');
  assert(await bisZeile(t.zeilen, 'laeuft schon'), '"+<id> stumm" auf eine gezeigte Kennung: "laeuft schon"');
  assert(t.zeilen.some((z) => z.includes('-16778241')), '... mit dem Weg zum Umschalten (erst -<id>)');
  await new Promise((r) => setTimeout(r, 150));
  assert(t.befehle().filter((b) => b.cmd === 'slotOn' && b.id === 16778241).length === 1, 'es geht KEIN zweites slotOn raus');
  assert(!t.zeilen.some((z) => z.includes('SLOT_ALREADY_ON')), 'kein SLOT_ALREADY_ON');
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

console.log('\nsteuerung — Wiederbeitritt: Rückkehr-Hinweis, kein Umhängen von selbst (6.18, PT8):');
{
  const t = steuere({ FAKE_WIEDERBEITRITT_MS: '1000' }, { ZOOM_MEETING_ID: '1' });
  assert(await bisZeile(t.zeilen, 'Rohdaten-Erlaubnis: JA'), 'im Meeting mit Erlaubnis');
  const anna = t.zeilen.find((z) => z.includes('16778240  Anna')) ?? '';
  assert(anna !== '' && !anna.includes('umhaengbar'), 'die Teilnehmerzeile verspricht kein Umhaengen mehr (die Bridge haengt nie selbst um)');
  t.tippe('+16778240');
  assert(await bisZeile(t.zeilen, 'slot 1: starting (command)'), 'Anna laeuft in Slot 1');
  assert(await bisZeile(t.zeilen, 'slot 1: fallback (participantLeft)'), 'Anna geht: Slot 1 ohne Ziel, der Sender bleibt');
  assert(await bisZeile(t.zeilen, 'Rückkehr? =1 16778250'), 'PT8: Anna kommt wieder, die Konsole nennt „Rückkehr? =1 16778250“');
  await new Promise((r) => setTimeout(r, 300));
  assert(!t.befehle().some((b) => b.cmd === 'slotSet'), 'PT8: kein slotSet von selbst');
  assert(!t.zeilen.some((z) => z.includes('abonnieren mit +16778250')), 'statt „abonnieren mit +<neu>“ steht nur der Rückkehr-Hinweis da');
  t.tippe('=1 16778250');
  assert(await bisZeile(t.zeilen, 'slot 1: starting (targetChanged)'), 'PT8: "=1 16778250" haengt Slot 1 um');
  assert(t.befehle().some((b) => b.cmd === 'slotSet' && b.slot === 1 && b.id === 16778250), '... als slotSet {slot:1, id:16778250}');
  t.tippe('+16778250');
  assert(await bisZeile(t.zeilen, 'laeuft schon'), 'wer +<neu> trotzdem tippt, bekommt "laeuft schon"');
  assert(!t.befehle().some((b) => b.cmd === 'slotOn' && b.id === 16778250), '... und es geht nichts an die Bridge');
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
  // AudioReason, VideoState und VideoReason entfallen mit dem Altweg (Plan B, Task B23); dass sie fehlen, prueft Abschnitt B23.
  const typen: [PaketAudioState] = ['off'];
  assert(typen.length === 1, 'src/index.ts exportiert den Typ AudioState (prueft tsc)');
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
 * IMMER stop(). Liefert alle Ereignisse, auch die beim Abbau. `zeilen` sammelt
 * auf Wunsch die stderr-Zeilen der Attrappe (Stage 4b, FAKE_NAMENSZEILE).
 */
async function fahreSteuerung(
  fakeEnv: Record<string, string>,
  schritte: (b: Bridge, ev: BridgeEvent[]) => Promise<void>,
  zeilen: string[] = [],
): Promise<BridgeEvent[]> {
  const ev: BridgeEvent[] = [];
  const b = new Bridge({
    exePath: process.execPath,
    exeArgs: [fake],
    env: { FAKE_SCRIPT: 'steuerung', ...fakeEnv },
    joinTimeoutMs: 5000,
    killTimeoutMs: 3000,
    onEvent: (e) => ev.push(e),
    onLog: (l) => zeilen.push(l),
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

// ── A2 · Hilfen für die Slot-Fälle der Attrappe (Plan A, Task A2) ──
// Als function bzw. VOR dem ersten Gebrauch definiert: Die Stage-4- und 4b-Fälle unten laufen schon mit Slots (11.10).
const ANNA = 16778240;
const BEN = 16778241;
const CARLA = 16778242;
/** Annas neue Kennung nach dem Wiederbeitritt (FAKE_WIEDERBEITRITT_MS). */
const ANNA_NEU = 16778250;

/** slotOn eines Teilnehmer-Slots mit Person-Ton; `mehr` ersetzt einzelne Felder (auch absichtlich ungültige). */
function slotAn(slot: number, ndi: string, mehr: Record<string, unknown> = {}): Command {
  return {
    cmd: 'slotOn', slot, ndi, mode: 'participant', resolution: '720p', audio: 'person', shareAudio: false,
    fallback: 'transparent', showNoVideo: true, ...mehr,
  } as Command;
}

/** Beitritt senden und die Erlaubnis abwarten (Drehbuch steuerung: privilege 50 ms nach inMeeting). */
async function imMeeting(b: Bridge, ev: BridgeEvent[]): Promise<void> {
  b.send(BEITRITT);
  await bisEreignis(ev, art('privilege', { canRecordRaw: true }));
}

/** Die slot-Ereignisse eines Slots als „state/reason@target“, bei Freigabe-Slots mit „#share“. */
function slotFolge(ev: BridgeEvent[], slot: number): string[] {
  return ev.filter(art('slot', { slot })).map((e) => {
    const s = e as unknown as { state: string; reason: string; target: number; share: number };
    return `${s.state}/${s.reason}@${s.target}${s.share ? `#${s.share}` : ''}`;
  });
}

/** Die slotAudio-Ereignisse eines Slots als „state/reason:source“. */
function tonFolge(ev: BridgeEvent[], slot: number): string[] {
  return ev.filter(art('slotAudio', { slot })).map((e) => {
    const s = e as unknown as { state: string; reason: string; source: string };
    return `${s.state}/${s.reason}:${s.source}`;
  });
}

/** Stelle des ersten passenden Ereignisses NACH `ab`, sonst -1. */
function stelleNach(ev: BridgeEvent[], ab: number, pred: (e: BridgeEvent) => boolean): number {
  return ev.findIndex((e, i) => i > ab && pred(e));
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
    b.send(slotAn(1, 'JM Connect – Zoom Anna', { id: ANNA }));
    await bisEreignis(ev, art('error', { code: 'slotNoPrivilege' }));
  });
  const iJa = stelle(ev, art('privilege', { canRecordRaw: true }));
  const iEntzug = stelle(ev, art('privilege', { canRecordRaw: false, source: 'broadcast' }));
  assert(iJa >= 0 && iEntzug > iJa, 'FAKE_ENTZUG_MS: privilege broadcast canRecordRaw:false nach der Erlaubnis');
  assert(stelle(ev, art('error', { where: 'slot', code: 'slotNoPrivilege', slot: 1 })) > iEntzug,
    '... ein folgendes slotOn wird mit slotNoPrivilege abgewiesen');
}
{
  let zwischenMs = -1;
  let vorSet = -1;
  const ev = await fahreSteuerung({ FAKE_WIEDERBEITRITT_MS: '1000', FAKE_RUECKKEHR_MS: '500' }, async (b, ev) => {
    await imMeeting(b, ev);
    b.send(slotAn(1, 'JM Connect – Zoom Anna', { id: ANNA }));
    await bisEreignis(ev, art('left'));
    const weg = Date.now();
    await bisEreignis(ev, art('joined'));
    zwischenMs = Date.now() - weg;
    await new Promise((r) => setTimeout(r, 300));
    vorSet = ev.length;
    b.send({ cmd: 'slotSet', slot: 1, id: ANNA_NEU });
    await bisEreignis(ev, art('slot', { slot: 1, state: 'live', target: ANNA_NEU }));
  });
  const iLeft = stelle(ev, art('left', { id: ANNA }));
  const iErsatz = stelle(ev, art('slot', { slot: 1, state: 'fallback', reason: 'participantLeft', target: 0 }));
  const iTonAus = stelle(ev, art('slotAudio', { slot: 1, state: 'off', reason: 'participantLeft' }));
  assert(iLeft >= 0 && iErsatz === iLeft + 1 && iTonAus === iErsatz + 1,
    'Weggang mit Slot: left, slot fallback/participantLeft (Ziel 0), slotAudio off/participantLeft (3.5, 6.7)');
  assert((ev[iErsatz] as { ndi?: string } | undefined)?.ndi === 'JM Connect – Zoom Anna', '... der Sender bleibt mit seinem Namen');
  const iJoined = stelle(ev, art('joined'));
  const zurueck = ev[iJoined] as { p?: Participant } | undefined;
  assert(iJoined > iTonAus && zurueck?.p?.id === ANNA_NEU && zurueck.p.name === 'Anna', 'Anna kommt als 16778250 zurueck');
  assert(zwischenMs >= 450, 'FAKE_RUECKKEHR_MS=500: zwischen left und joined liegen mindestens 450 ms (über der 300-ms-Entprellung)');
  assert(vorSet > iJoined && !ev.slice(iJoined, vorSet).some(art('slot', { slot: 1 })),
    '... die Attrappe hängt nicht selbst um (300 ms nach joined kein slot-Ereignis, 11.3)');
  const iSet = stelleNach(ev, vorSet - 1, art('slot', { slot: 1, state: 'starting', reason: 'targetChanged', target: ANNA_NEU }));
  assert(iSet >= vorSet, '... erst slotSet {id} → starting/targetChanged (6.7)');
  assert(stelleNach(ev, iSet, art('slotAudio', { slot: 1, state: 'waiting', reason: 'targetChanged' })) > iSet,
    '... und der Person-Ton wartet wieder (waiting/targetChanged, 6.10 Schritt 8)');
}
{
  const ev = await fahreSteuerung({ FAKE_WIEDERBEITRITT_MS: '1000', FAKE_RUECKKEHR_NAME: 'anna' }, async (b, ev) => {
    await imMeeting(b, ev);
    b.send(slotAn(1, 'JM Connect – Zoom Anna', { id: ANNA }));
    await bisEreignis(ev, art('joined'));
    await new Promise((r) => setTimeout(r, 300));
  });
  const zurueck = ev.find(art('joined')) as { p?: Participant } | undefined;
  assert(zurueck?.p?.id === ANNA_NEU && zurueck.p.name === 'anna', 'FAKE_RUECKKEHR_NAME: sie kommt als "anna" zurueck');
  assert(slotFolge(ev, 1).join(' ') === `starting/command@${ANNA} live/frames@${ANNA} fallback/participantLeft@0 off/command@0`,
    '... und der Slot bleibt ohne Ziel bis zum Ende (die Attrappe hängt nie selbst um)');
}
// Doppelname bei der Rückkehr entfällt hier (Plan A, Task A2): Die Attrappe hängt nie selbst um, die Zuordnung
// eines Namens trifft Connect (Plan B, PK6).
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

// --- Stage 4b: Entzug, Wiedererteilung, Rueckkehr, verzoegertes Abo, "(2)", Pufferfehler ---

/** Wie viele Ereignisse `pred` erfuellen. */
const anzahl = (ev: BridgeEvent[], pred: (e: BridgeEvent) => boolean): number => ev.filter(pred).length;

/** Kurz warten (nur dort, wo ein AUSBLEIBEN geprueft wird). */
const warte = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

console.log('\nAttrappe — Stage 4b:');
{
  // Der Grund ist ein EIGENER Name (G18); die Zuweisungen prüft tsc. Mit Slots: slot off löscht Slot und Ton.
  const bild: PaketSlotReason = 'privilegeRevoked';
  const ton: PaketSlotAudioReason = 'privilegeRevoked';
  let s = initialSession();
  s = reduce(s, enrich({ ev: 'slot', slot: 1, state: 'starting', mode: 'participant', target: 7, share: 0, reason: 'command',
    sent: 'transparent', ndi: 'JM Connect – Zoom Anna' } as WireEvent));
  s = reduce(s, enrich({ ev: 'slotAudio', slot: 1, state: 'waiting', source: 'none', configured: 'person', reason: 'command' } as WireEvent));
  s = reduce(s, enrich({ ev: 'slotAudio', slot: 1, state: 'off', source: 'none', configured: 'person', reason: ton } as WireEvent));
  s = reduce(s, enrich({ ev: 'slot', slot: 1, state: 'off', mode: 'participant', target: 7, share: 0, reason: bild, sent: 'none',
    ndi: 'JM Connect – Zoom Anna' } as WireEvent));
  assert(s.slots.size === 0 && s.slotAudio.size === 0,
    'Reducer: slot off mit privilegeRevoked entfernt den Slot samt Ton aus Session.slots und Session.slotAudio');
}
{
  // FAKE_ENTZUG_MS baut alle Slots ab (N4b.1, 6.15): erst privilege false, dann je Slot slotAudio off vor slot off.
  const ev = await fahreSteuerung({ FAKE_ENTZUG_MS: '1000' }, async (b, ev) => {
    await imMeeting(b, ev);
    b.send(slotAn(1, 'JM Connect – Zoom Anna', { id: ANNA }));
    b.send(slotAn(2, 'JM Connect – Zoom Ben', { id: BEN, audio: 'off' }));
    await bisEreignis(ev, art('slot', { slot: 2, state: 'off' }));
    b.send(slotAn(1, 'JM Connect – Zoom Anna', { id: ANNA }));
    await bisEreignis(ev, art('error', { code: 'slotNoPrivilege' }));
  });
  const iEntzug = stelle(ev, art('privilege', { canRecordRaw: false, source: 'broadcast' }));
  for (const nr of [1, 2]) {
    const iTon = stelle(ev, art('slotAudio', { slot: nr, state: 'off', reason: 'privilegeRevoked' }));
    const iAus = stelle(ev, art('slot', { slot: nr, state: 'off', reason: 'privilegeRevoked' }));
    assert(iEntzug >= 0 && iTon > iEntzug && iAus === iTon + 1, `Entzug baut Slot ${nr} ab: slotAudio off vor slot off, Grund privilegeRevoked`);
  }
  assert(ev.filter(art('slot', { state: 'off' })).every((e) => (e as { reason?: string }).reason === 'privilegeRevoked'),
    '... kein Abbau mit command oder meetingEnded (eine Ursache, ein Name)');
  assert(stelle(ev, art('error', { where: 'slot', code: 'slotNoPrivilege', slot: 1 })) > iEntzug
      && anzahl(ev, art('slot', { state: 'starting' })) === 2,
    'nach dem Entzug: slotOn → slotNoPrivilege, und es entsteht kein neuer Slot');
}
{
  const ev = await fahreSteuerung({ FAKE_ENTZUG_MS: '1000', FAKE_ERTEILUNG_MS: '200' }, async (b, ev) => {
    await imMeeting(b, ev);
    b.send(slotAn(1, 'JM Connect – Zoom Anna', { id: ANNA }));
    await bisEreignis(ev, art('privilege', { canRecordRaw: true, source: 'broadcast' }));
    b.send(slotAn(1, 'JM Connect – Zoom Anna', { id: ANNA }));
    await bisEreignis(ev, () => anzahl(ev, art('slot', { slot: 1, state: 'starting' })) === 2);
  });
  const iAbbau = stelle(ev, art('slot', { slot: 1, state: 'off', reason: 'privilegeRevoked' }));
  const iErteilung = stelle(ev, art('privilege', { canRecordRaw: true, source: 'broadcast' }));
  const neu = ev.filter(art('slot', { slot: 1, state: 'starting' }))[1] as { ndi?: string } | undefined;
  assert(iAbbau >= 0 && iErteilung > iAbbau, "Wiedererteilung: privilege canRecordRaw:true source:'broadcast' nach dem Abbau (FAKE_ERTEILUNG_MS)");
  assert(ev.indexOf(neu as BridgeEvent) > iErteilung && neu?.ndi === 'JM Connect – Zoom Anna',
    '... slotOn danach → starting, mit demselben NDI-Namen');
}
{
  // FAKE_ERTEILUNG_MS=0: beide Rundrufe in derselben Pumprunde der Bridge (L2).
  const ev = await fahreSteuerung({ FAKE_ENTZUG_MS: '1000', FAKE_ERTEILUNG_MS: '0' }, async (b, ev) => {
    await imMeeting(b, ev);
    b.send(slotAn(1, 'JM Connect – Zoom Anna', { id: ANNA }));
    await bisEreignis(ev, art('slot', { slot: 1, state: 'off' }));
    b.send(slotAn(1, 'JM Connect – Zoom Anna', { id: ANNA }));
    await bisEreignis(ev, () => anzahl(ev, art('slot', { slot: 1, state: 'starting' })) === 2);
  });
  const iFalsch = stelle(ev, art('privilege', { canRecordRaw: false, source: 'broadcast' }));
  const iWahr = stelle(ev, art('privilege', { canRecordRaw: true, source: 'broadcast' }));
  const iAbbau = stelle(ev, art('slot', { slot: 1, state: 'off', reason: 'privilegeRevoked' }));
  assert(iFalsch >= 0 && iWahr === iFalsch + 1 && iAbbau > iWahr, 'FAKE_ERTEILUNG_MS=0: Reihenfolge privilege false, privilege true, dann slot off');
  assert(stelleNach(ev, iAbbau, art('slot', { slot: 1, state: 'starting' })) > iAbbau, '... danach geht slotOn wieder durch');
}
{
  // FAKE_ABBAU_MS gilt auch für Slots: Die Bridge baut langsamer ab, als Connect bis zum Abgleich wartet (300 ms; M18).
  let wahrUm = 0;
  let abbauUm = 0;
  const ev = await fahreSteuerung({ FAKE_ENTZUG_MS: '1000', FAKE_ERTEILUNG_MS: '0', FAKE_ABBAU_MS: '600' }, async (b, ev) => {
    await imMeeting(b, ev);
    b.send(slotAn(1, 'JM Connect – Zoom Anna', { id: ANNA }));
    await bisEreignis(ev, art('privilege', { canRecordRaw: true, source: 'broadcast' }));
    wahrUm = Date.now();
    await bisEreignis(ev, art('slot', { slot: 1, state: 'off' }));
    abbauUm = Date.now();
  });
  const iWahr = stelle(ev, art('privilege', { canRecordRaw: true, source: 'broadcast' }));
  const iAbbau = stelle(ev, art('slot', { slot: 1, state: 'off', reason: 'privilegeRevoked' }));
  if (!(abbauUm - wahrUm >= 400)) console.log(`     (Abstand Wiedererteilung → Abbau gemessen: ${abbauUm - wahrUm} ms)`);
  assert(iWahr >= 0 && iAbbau > iWahr && abbauUm - wahrUm >= 400,
    'FAKE_ABBAU_MS=600: der Abbau der Slots (privilegeRevoked) kommt erst mindestens 400 ms nach der Wiedererteilung');
}
{
  let mitten = '';
  const ev = await fahreSteuerung({ FAKE_VERBINDUNG_HAENGT_MS: '1000', FAKE_VERBINDUNG_ZURUECK_MS: '200' }, async (b, ev) => {
    await imMeeting(b, ev);
    b.send(slotAn(1, 'JM Connect – Zoom Anna', { id: ANNA }));
    b.send(slotAn(2, 'JM Connect – Zoom Sprecher', { mode: 'speaker', audio: 'mix' }));
    await bisEreignis(ev, () => anzahl(ev, art('roster')) === 2);
    mitten = statusFolge(ev);
    b.send(slotAn(1, 'JM Connect – Zoom Anna', { id: ANNA }));
    await bisEreignis(ev, art('error', { code: 'slotAlreadyOn' }));
  });
  const iZurueck = stelleNach(ev, stelle(ev, art('status', { status: 'reconnecting' })), art('status', { status: 'inMeeting' }));
  assert(mitten === 'connecting,inMeeting,reconnecting,connecting,inMeeting', 'Rückkehr aus reconnecting: connecting, inMeeting (FAKE_VERBINDUNG_ZURUECK_MS)');
  assert(iZurueck >= 0 && !ev.slice(0, iZurueck).some(art('slot', { state: 'off' })), '... die Slots bestehen: kein slot off bis zur Rückkehr');
  const roster2 = ev.filter(art('roster'))[1] as { list?: Participant[] } | undefined;
  assert(ev.indexOf(roster2 as BridgeEvent) > iZurueck && (roster2?.list ?? []).map((p) => p.id).join(',') === '100,16778240,16778241',
    '... danach wie das Original roster mit denselben Kennungen');
  assert(stelle(ev, art('privilege', { canRecordRaw: true, source: 'check' })) > iZurueck, "... und privilege canRecordRaw:true source:'check'");
  assert(stelleNach(ev, iZurueck, art('slot', { slot: 1, state: 'fallback', reason: 'noTarget', target: 0 })) > iZurueck
      && stelleNach(ev, iZurueck, art('slot', { slot: 2, state: 'fallback', reason: 'speakerNone', target: 0 })) > iZurueck,
    '... Teilnehmer-Slot ohne Ziel (noTarget, bis Connect neue Kennungen schickt), Sprecher-Slot speakerNone (6.15)');
  assert(stelle(ev, art('error', { where: 'slot', code: 'slotAlreadyOn', slot: 1 })) > iZurueck, '... der Slot lebt noch (slotAlreadyOn)');
}
// FAKE_ABO_VERZOEGERUNG_MS (verzögertes videoSubscribe) gilt nur noch im Altweg (A-EP1); seine beiden Fälle entfallen
// hier, Connect prüft den Altweg bis Plan B, Task B23 (zoom-kern.test.ts; WIDERRUF mit B23: Altweg und Stellschraube sind
// entfernt, kein Test setzt sie mehr). „(2)" bei gleichem Namen entfällt: Den Namen
// vergibt Connect; ein belegter Name ist slotNameTaken (A2 Prüffolge mit laufendem Slot).
{
  const ev = await fahreSteuerung({ FAKE_PUFFERFEHLER_MS: '100' }, async (b, ev) => {
    await imMeeting(b, ev);
    b.send(slotAn(1, 'JM Connect – Zoom Anna', { id: ANNA }));
    b.send(slotAn(2, 'JM Connect – Zoom Ben', { id: BEN, audio: 'off' }));
    await bisEreignis(ev, art('error', { code: 'slotBufferMismatch', slot: 2 }));
    await warte(400);
  });
  assert(anzahl(ev, art('error', { where: 'slot', code: 'slotBufferMismatch', slot: 1 })) === 1
      && anzahl(ev, art('error', { where: 'slot', code: 'slotBufferMismatch', slot: 2 })) === 1,
    'Pufferfehler: je Slot einmal slotBufferMismatch mit slot');
  assert(anzahl(ev, art('error', { where: 'audio', code: 'audioBufferMismatch', slot: 1 })) === 1
      && !ev.some(art('error', { code: 'audioBufferMismatch', slot: 2 }))
      && !ev.some((e) => e.ev === 'error' && 'id' in e),
    '... audioBufferMismatch mit slot statt id, nur bei einem Slot mit Ton (6.4)');
  assert(ev.find(art('error', { code: 'slotBufferMismatch' }))?.name === 'SLOT_BUFFER_MISMATCH'
      && ev.find(art('error', { code: 'audioBufferMismatch' }))?.name === 'AUDIO_BUFFER_MISMATCH',
    '... mit den Namen SLOT_BUFFER_MISMATCH und AUDIO_BUFFER_MISMATCH');
}
{
  // FAKE_ABO_FEHLER „nr:sdk“ (11.3, A-EP7): Das erste Abo des Slots scheitert; der Slot läuft mit Ersatzbild weiter.
  const ev = await fahreSteuerung({ FAKE_ABO_FEHLER: '1:9' }, async (b, ev) => {
    await imMeeting(b, ev);
    b.send(slotAn(1, 'JM Connect – Zoom Anna', { id: ANNA }));
    await bisEreignis(ev, art('slot', { slot: 1 }));
    b.send(slotAn(1, 'JM Connect – Zoom Anna', { id: ANNA }));
    b.send({ cmd: 'slotOff', slot: 1 });
    b.send(slotAn(1, 'JM Connect – Zoom Anna', { id: ANNA }));
    await bisEreignis(ev, art('slot', { slot: 1, state: 'live' }));
  });
  const iFehler = stelle(ev, art('error', { where: 'slot', code: 'slotSubscribeFailed', slot: 1, sdk: 9, type: 'video' }));
  assert(iFehler >= 0 && ev[iFehler]?.name === 'SLOT_SUBSCRIBE_FAILED',
    'FAKE_ABO_FEHLER=1:9: error where:slot code:slotSubscribeFailed mit sdk 9, type video und dem Namen SLOT_SUBSCRIBE_FAILED');
  assert(iFehler < stelle(ev, art('slot', { slot: 1 })) && slotFolge(ev, 1).join(' ')
      === 'fallback/subscribeFailed@16778240 off/command@16778240 starting/command@16778240 live/frames@16778240 off/command@16778240',
    '... danach slot fallback/subscribeFailed; Stopp und Start versuchen es neu und gehen durch');
  assert(ev.some(art('error', { where: 'slot', code: 'slotAlreadyOn', slot: 1 })), '... dazwischen läuft der Slot weiter (slotAlreadyOn)');
}
{
  const zeilen: string[] = [];
  await fahreSteuerung({ FAKE_NAMENSZEILE: '1' }, async (b, ev) => {
    b.send(BEITRITT);
    await bisEreignis(ev, art('roster'));
    const ende = Date.now() + 2000;
    while (Date.now() < ende && !zeilen.some((z) => z.startsWith('Namensprobe:'))) await warte(20);
  }, zeilen);
  assert(zeilen.includes('Namensprobe: Anna, Ben'), 'Namensprobe auf stderr nennt die fremden Teilnehmer (FAKE_NAMENSZEILE=1)');
  const ohne: string[] = [];
  await fahreSteuerung({}, async (b, ev) => {
    b.send(BEITRITT);
    await bisEreignis(ev, art('roster'));
    await warte(200);
  }, ohne);
  assert(ohne.length > 0 && !ohne.some((z) => z.startsWith('Namensprobe')), '... ohne FAKE_NAMENSZEILE keine solche Zeile');
}

// --- Stage 4b: nativer Teil - Quelltext-Waechter ------------------------------------
// Laufen OHNE Compiler und ohne SDK, auch unter Linux (CI). Sie sichern nur die
// STRUKTUR (wer ruft was, in welcher Reihenfolge, was steht im Log); ob die Bridge
// sich am echten SDK so verhaelt, belegt erst die Abnahme 0.3.0 (Messung M18).

import { readFileSync, readdirSync } from 'node:fs';

const nativOrdner = join(testDir, '..', 'native');

/**
 * C++-Quelltext ohne Kommentare: jedes Zeichen eines Kommentars wird ein Leerzeichen,
 * Zeilenumbrueche bleiben (Zeilennummern stimmen weiter). Mit `ohneTexte` werden auch
 * die INHALTE von "..."- und '...'-Literalen geleert (die Anfuehrungszeichen bleiben):
 * ein Wort in einem Logtext ist kein Bezeichner.
 */
function cppOhneKommentare(src: string, ohneTexte = false): string {
  let aus = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (c === '/' && n === '/') {
      while (i < src.length && src[i] !== '\n') { aus += ' '; i++; }
      continue;
    }
    if (c === '/' && n === '*') {
      const ende = src.indexOf('*/', i + 2);
      const bis = ende < 0 ? src.length : ende + 2;
      aus += src.slice(i, bis).replace(/[^\n]/g, ' ');
      i = bis;
      continue;
    }
    if (c === '"' || c === "'") {
      aus += c;
      i++;
      while (i < src.length && src[i] !== c) {
        const schritt = src[i] === '\\' ? 2 : 1;
        const stueck = src.slice(i, i + schritt);
        aus += ohneTexte ? stueck.replace(/[^\n]/g, ' ') : stueck;
        i += schritt;
      }
      aus += c;
      i++;
      continue;
    }
    aus += c;
    i++;
  }
  return aus;
}

/** Der Rumpf `{ ... }` nach der ersten Fundstelle von `kopf` (Klammern gezaehlt), sonst ''. */
function rumpf(src: string, kopf: string): string {
  const stelleKopf = src.indexOf(kopf);
  if (stelleKopf < 0) return '';
  const auf = src.indexOf('{', stelleKopf + kopf.length);
  if (auf < 0) return '';
  let tiefe = 0;
  for (let i = auf; i < src.length; i++) {
    if (src[i] === '{') tiefe++;
    else if (src[i] === '}' && --tiefe === 0) return src.slice(auf, i + 1);
  }
  return '';
}

const nativ = (datei: string, ohneTexte = false): string =>
  cppOhneKommentare(readFileSync(join(nativOrdner, datei), 'utf8'), ohneTexte);

console.log('\nNativer Teil — Quelltext-Waechter (Stage 4b):');
{
  // N4b.2: keine emitLog-Anweisung fuehrt einen Teilnehmernamen. Je Aufruf
  // `emitLog(` bis zum naechsten `;`, Texte vorher geleert.
  // PT6 d (Plan A, A11): auch kein NDI-Name - ndi, ndiName und source sind seit den Slots verboten (0.23).
  const namensBezeichner = /\b(name|displayName|userName|nameOut|ndi|ndiName|source)\b|GetUserName/;
  let gefunden = 0;
  const treffer: string[] = [];
  for (const datei of readdirSync(nativOrdner).filter((f) => f.endsWith('.cpp')).sort()) {
    const src = nativ(datei, true);
    const aufruf = /(?<!void\s)\bemitLog\s*\(/g;
    let m: RegExpExecArray | null;
    while ((m = aufruf.exec(src)) !== null) {
      gefunden++;
      const anweisung = src.slice(m.index, src.indexOf(';', m.index));
      if (namensBezeichner.test(anweisung)) treffer.push(`${datei}:${src.slice(0, m.index).split('\n').length}`);
    }
  }
  assert(gefunden > 40, 'nativ: der Waechter findet die emitLog-Anweisungen (mehr als 40)');
  assert(treffer.length === 0, 'nativ: keine emitLog-Anweisung führt einen Teilnehmer- oder NDI-Namen (PT6 d)');
  if (treffer.length > 0) console.error(`      Treffer: ${treffer.join(', ')}`);
}
{
  // L1 / Lehre vom 18.08.2026: im Rundruf NUR den Merker setzen - unSubscribe() aus
  // einem SDK-Rueckruf beendete die Bridge mit 0xC0000005.
  const koerper = rumpf(nativ('callbacks.cpp', true), 'void RecordingListener::onRecordPrivilegeChanged(bool bCanRec)');
  assert(/if\s*\(\s*!\s*bCanRec\s*\)\s*\{[^}]*g_entzugAbbauOffen\s*=\s*true/.test(koerper),
    'nativ: onRecordPrivilegeChanged setzt bei false den Merker g_entzugAbbauOffen');
  assert(koerper !== '' && !/\b(slotsAbbauAlle|slotsPrivilegeRevoked|slotsShutdownAll|slotsMeetingEnded|slotOff|audioClearSubscribed|audioShutdown|unSubscribe|destroyRenderer|StopRawRecording|sessionStopRawRecording)\b/.test(koerper),
    'nativ: onRecordPrivilegeChanged ruft keinen Abbau und kein unSubscribe/StopRawRecording');
}
{
  const main = nativ('main.cpp', true);
  const schleife = main.slice(Math.max(0, main.indexOf('while (!g_quit) {')));
  const iPumpe = schleife.indexOf('pumpOnce(');
  const iEnde = schleife.indexOf('callbacksTakeMeetingEndTeardown(');
  const iEntzug = schleife.indexOf('callbacksTakePrivilegeRevokedTeardown(');
  const iTakt = schleife.indexOf('slotsTick(');
  assert(main.includes('while (!g_quit) {') && iPumpe >= 0 && iEnde > iPumpe && iEntzug > iEnde && iTakt > iEntzug,
    'nativ: main.cpp arbeitet den Entzug nach pumpOnce() und vor slotsTick() ab (nach dem Meeting-Ende-Abbau)');
  // Seit A14 legt abbauPlan die Reihenfolge fest (AudioClearSubscribed, Slots, StopRawRecording;
  // PB20); main.cpp ruft nur noch die Kette.
  const block = rumpf(schleife, 'if (callbacksTakePrivilegeRevokedTeardown())');
  assert(block.includes('slotsPrivilegeRevoked(') && !/\b(audioClearSubscribed|sessionStopRawRecording)\s*\(/.test(block),
    'nativ: der Entzug-Block ruft nur die Kette slotsPrivilegeRevoked (Reihenfolge nach abbauPlan)');
}
{
  const koerper = rumpf(nativ('video.cpp'), 'void slotsPrivilegeRevoked()');
  assert(/abbauAusfuehren\(\s*Kette::Entzug\s*,\s*Grund::privilegeRevoked\s*\)/.test(koerper),
    'nativ: slotsPrivilegeRevoked baut mit abbauAusfuehren(Kette::Entzug, Grund::privilegeRevoked) ab (PT6 b)');
  const stopp = rumpf(nativ('session.cpp', true), 'SDKError sessionStopRawRecording()');
  const iZurueck = stopp.indexOf('g_rawRecordingOn.exchange(false)');
  const iReturn = stopp.indexOf('return');
  assert(iZurueck >= 0 && iReturn > iZurueck && stopp.includes('StopRawRecording()'),
    'nativ: sessionStopRawRecording setzt das Merkzeichen vor jedem return zurück und ruft StopRawRecording()');
  assert(/\bbool\s+callbacksTakePrivilegeRevokedTeardown\(\s*\)\s*;/.test(nativ('callbacks.h'))
      && /\bvoid\s+slotsPrivilegeRevoked\(\s*\)\s*;/.test(nativ('video.h'))
      && /\bSDKError\s+sessionStopRawRecording\(\s*\)\s*;/.test(nativ('session.h')),
    'nativ: callbacks.h, video.h und session.h erklären die drei neuen Funktionen');
}

// ── A1 · Slot-Vertrag: Kataloge, Befehle, Ereignisse, Fehlerschlüssel, Reducer, Exporte (Spec 6.2–6.4, 11.2 PT1–PT4) ──
import {
  AUDIO_ABO_FEHLER, SHARE_TYPE_NAMES, SHARING_STATUS_NAMES, SLOT_AUDIO_REASONS, SLOT_AUDIO_SETTINGS, SLOT_AUDIO_SOURCES,
  SLOT_ERROR_KEYS, SLOT_FALLBACKS, SLOT_MODES, SLOT_NR_MAX, SLOT_REASONS, SLOT_RESOLUTIONS, SLOT_SENT, SLOT_STATES,
  SPEAKER_HOLD_MAX_MS, SPEAKER_SIGNALS, type Command,
} from '../src/protocol.ts';
import type { SlotAudioSub, SlotSub } from '../src/state.ts';
import type {
  RecvStat as PaketRecvStat, ShareCallback as PaketShareCallback, ShareEntry as PaketShareEntry,
  ShareTypeName as PaketShareTypeName, SharingStatusName as PaketSharingStatusName, SlotAudioReason as PaketSlotAudioReason,
  SlotAudioSetting as PaketSlotAudioSetting, SlotAudioSource as PaketSlotAudioSource, SlotAudioSub as PaketSlotAudioSub,
  SlotFallback as PaketSlotFallback, SlotFehler as PaketSlotFehler, SlotMode as PaketSlotMode, SlotReason as PaketSlotReason,
  SlotResolution as PaketSlotResolution, SlotSent as PaketSlotSent, SlotState as PaketSlotState, SlotSub as PaketSlotSub,
  SpeakerSignal as PaketSpeakerSignal,
} from '../src/index.ts';

/** Gleich nach Inhalt, unabhängig von der Reihenfolge der Schlüssel; undefined ist nie gleich. */
const gleichFelder = (a: object | undefined, b: object): boolean =>
  a !== undefined && JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());

console.log('\nA1 protocol — Slot-Kataloge (Spec 6.2–6.4, Gliederung 3.1):');
{
  const liste = (a: readonly string[]): string => a.join(',');
  assert(SLOT_NR_MAX === 16, 'A1 E2: SLOT_NR_MAX ist 16');
  assert(liste(SLOT_MODES) === 'participant,speaker,share', 'A1 6.2: SLOT_MODES participant, speaker, share');
  assert(liste(SLOT_RESOLUTIONS) === '360p,720p,1080p' && SLOT_RESOLUTIONS.every((r) => (VIDEO_RESOLUTIONS as readonly string[]).includes(r)),
    'A1 6.11: SLOT_RESOLUTIONS 360p, 720p, 1080p, eine Teilmenge von VIDEO_RESOLUTIONS');
  assert(liste(SLOT_AUDIO_SETTINGS) === 'off,mix,person', 'A1 6.2: SLOT_AUDIO_SETTINGS off, mix, person');
  assert(liste(SLOT_FALLBACKS) === 'transparent,freeze,black,white', 'A1 6.2: SLOT_FALLBACKS transparent, freeze, black, white');
  assert(liste(SLOT_STATES) === 'starting,live,fallback,held,off', 'A1 6.3: SLOT_STATES starting, live, fallback, held, off');
  assert(SLOT_SENT.length === 6 && liste(SLOT_SENT) === 'none,transparent,freeze,black,white,held', 'A1 6.12: SLOT_SENT hat 6 Werte');
  assert(SLOT_REASONS.length === 20 && new Set(SLOT_REASONS).size === 20, 'A1 6.3: SLOT_REASONS hat genau 20 verschiedene Werte');
  assert(SLOT_REASONS.includes('noFrames') && SLOT_REASONS.includes('cameraOff'),
    'A1 6.3: noFrames steht neben cameraOff (zwei Ursachen, zwei Namen)');
  assert(SLOT_AUDIO_REASONS.length === 12 && new Set(SLOT_AUDIO_REASONS).size === 12, 'A1 6.3: SLOT_AUDIO_REASONS hat genau 12 verschiedene Werte');
  assert(SLOT_AUDIO_SOURCES.length === 5 && liste(SLOT_AUDIO_SOURCES) === 'mix,person,share,mixShare,none', 'A1 6.3: SLOT_AUDIO_SOURCES hat 5 Werte');
  assert(liste(SPEAKER_SIGNALS) === 'speakerVideo,activeVideo,activeAudio' && SPEAKER_HOLD_MAX_MS === 5000,
    'A1 6.2: drei Sprecher-Signale, Haltezeit höchstens 5000 ms');
  assert(SHARE_TYPE_NAMES.length === 11 && SHARE_TYPE_NAMES[0] === 'unknown' && SHARE_TYPE_NAMES[2] === 'ds' && SHARE_TYPE_NAMES[10] === 'computerAudio',
    'A1 A-EP4: SHARE_TYPE_NAMES hat 11 Werte, Index = enum ShareType (0 unknown, 2 ds, 10 computerAudio)');
  assert(SHARING_STATUS_NAMES.length === 11 && SHARING_STATUS_NAMES[4] === 'otherShareBegin' && SHARING_STATUS_NAMES[9] === 'pause'
      && SHARING_STATUS_NAMES[10] === 'resume',
    'A1 A-EP4: SHARING_STATUS_NAMES hat 11 Werte, Index = enum SharingStatus (4 otherShareBegin, 9 pause, 10 resume)');
  assert(SLOT_ERROR_KEYS.length === 21 && new Set(SLOT_ERROR_KEYS).size === 21 && SLOT_ERROR_KEYS.includes('slotBadTarget'),
    'A1 6.4: SLOT_ERROR_KEYS hat 21 verschiedene Schlüssel, darunter slotBadTarget (A-EP2)');
  assert(liste(AUDIO_ABO_FEHLER) === 'audioVoipJoinFailed,audioHelperMissing,audioSubscribeFailed', 'A1 6.4: genau drei Ton-Abo-Fehler');
}

console.log('\nA1 protocol — Slot-Fehlerschlüssel in OWN_ERROR_NAMES (PT3):');
{
  const gross = (k: string): string => k.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase();
  assert(SLOT_ERROR_KEYS.every((k) => OWN_ERROR_NAMES[k] === gross(k)),
    'A1 PT3: jeder Slot-Schlüssel hat seinen Namen in Großbuchstaben (slotBadNumber → SLOT_BAD_NUMBER)');
  assert(new Set(SLOT_ERROR_KEYS.map((k) => OWN_ERROR_NAMES[k])).size === 21, 'A1 PT3: die 21 Namen sind paarweise verschieden');
  assert(SLOT_ERROR_KEYS.every((k) => (enrich({ ev: 'error', where: 'slot', code: k, slot: 1 } as WireEvent) as { name?: string }).name === gross(k)),
    'A1 PT3: enrich() löst jeden Slot-Schlüssel auf');
  assert(AUDIO_ABO_FEHLER.every((k) => OWN_ERROR_NAMES[k] !== undefined), 'A1 6.4: die drei Ton-Abo-Fehler stehen schon im Katalog');
  assert(Object.keys(OWN_ERROR_NAMES).length === 48, 'A1 PT3: OWN_ERROR_NAMES hat 27 + 21 = 48 Schlüssel');
}

console.log('\nA1 protocol — Slot-Befehle (6.2):');
{
  const befehle: Command[] = [
    { cmd: 'slotOn', slot: 1, ndi: 'JM Connect – Zoom Anna', mode: 'participant', id: 16778240, resolution: '720p', audio: 'person',
      shareAudio: false, fallback: 'transparent', showNoVideo: true },
    { cmd: 'slotOn', slot: 2, ndi: 'JM Connect – Zoom Sprecher', mode: 'speaker', resolution: '1080p', audio: 'mix', shareAudio: true,
      fallback: 'freeze', showNoVideo: false },
    { cmd: 'slotSet', slot: 1, id: 16778250 },
    { cmd: 'slotSet', slot: 2, mode: 'share', audio: 'off', shareAudio: true },
    { cmd: 'slotOff', slot: 1 },
    { cmd: 'speakerConfig', signal: 'activeAudio', holdMs: 2500 },
    { cmd: 'previewMode', on: true },
  ];
  befehle.forEach((b, n) => assert(serializeCommand(b) === `${JSON.stringify(b)}\n`, `A1 6.2: Befehl ${n + 1} (${b.cmd}) geht als genau eine Zeile raus`));
  assert(!serializeCommand(befehle[1]).includes('"id"'), 'A1 6.2: slotOn ohne id (kein Ziel) schreibt kein id-Feld');
}

console.log('\nA1 state — Slots im Reducer (PT1):');
{
  assert(initialSession().slots.size === 0 && initialSession().slotAudio.size === 0, 'A1 PT1: eine neue Sitzung hat keine Slots');
  const slotFelder = { state: 'live', mode: 'share', target: 16778241, share: 101, reason: 'frames', sent: 'none',
    ndi: 'JM Connect – Zoom Freigabe', rotation: 90, limitedRange: false } as const;
  let s = reduce(initialSession(), enrich({ ev: 'slot', slot: 3, ...slotFelder } as WireEvent));
  assert(gleichFelder(s.slots.get(3), slotFelder), 'A1 PT1: slot übernimmt jedes Feld aus 6.3 unter seiner Slot-Nummer');

  s = reduce(s, enrich({ ev: 'slot', slot: 4, state: 'starting', mode: 'participant', target: 7, share: 0, reason: 'command',
    sent: 'transparent', ndi: 'JM Connect – Zoom X' } as WireEvent));
  const ohneBild = s.slots.get(4);
  assert(ohneBild !== undefined && !('rotation' in ohneBild) && !('limitedRange' in ohneBild),
    'A1 PT1: ein slot ohne Bild legt weder rotation noch limitedRange an (keine erfundenen Werte)');

  const tonFelder = { state: 'live', source: 'mixShare', configured: 'mixShare', reason: 'packets', sampleRate: 32000, channels: 1 } as const;
  s = reduce(s, enrich({ ev: 'slotAudio', slot: 3, ...tonFelder } as WireEvent));
  assert(gleichFelder(s.slotAudio.get(3), tonFelder), 'A1 PT1: slotAudio übernimmt jedes Feld aus 6.3');

  s = reduce(s, enrich({ ev: 'slotAudio', slot: 4, state: 'off', source: 'none', configured: 'none', reason: 'personNotInMode' } as WireEvent));
  assert(s.slotAudio.get(4)?.state === 'off' && s.slotAudio.get(4)?.reason === 'personNotInMode',
    'A1 PT1: slotAudio off/personNotInMode bleibt als Eintrag stehen (Dauerzustand, A-EP6)');
  const ton4 = s.slotAudio.get(4);
  assert(ton4 !== undefined && !('sampleRate' in ton4) && !('channels' in ton4), 'A1 PT1: ohne Paket keine Abtastrate und keine Kanalzahl');

  s = reduce(s, enrich({ ev: 'slot', slot: 3, state: 'off', mode: 'share', target: 16778241, share: 101, reason: 'command', sent: 'none',
    ndi: 'JM Connect – Zoom Freigabe' } as WireEvent));
  assert(!s.slots.has(3) && !s.slotAudio.has(3), 'A1 PT1: slot off löscht den Slot und seinen Ton');
  assert(s.slots.has(4) && s.slotAudio.has(4), 'A1 PT1: ... und nur diesen');
}

console.log('\nA1 state — videoStatus führt videoOn des Teilnehmers nach (PT1, 0.18):');
{
  const vorher = run([{ ev: 'roster', list: [person({ id: 7, videoOn: true })] }]);
  const nachher = reduce(vorher, enrich({ ev: 'videoStatus', id: 7, videoOn: false, mutedByHost: true } as WireEvent));
  assert(nachher.participants.get(7)?.videoOn === false, 'A1 PT1: videoStatus setzt videoOn des Teilnehmers');
  assert(vorher.participants.get(7)?.videoOn === true, 'A1 PT1: ... ohne den alten Zustand zu verändern');
  const fremd = reduce(vorher, enrich({ ev: 'videoStatus', id: 99, videoOn: false, mutedByHost: false } as WireEvent));
  assert(fremd === vorher, 'A1 PT1: videoStatus für einen Unbekannten ändert nichts');
}

console.log('\nA1 state — ein Slot-Fehler kippt die Sitzung nicht (PT2):');
{
  const s = run([{ ev: 'status', status: 'inMeeting', raw: 3, code: 0 }, { ev: 'error', where: 'slot', code: 'slotNotOn', slot: 2 }]);
  assert(s.phase === 'inMeeting', 'A1 PT2: error where:slot lässt die Phase stehen');
  assert(s.lastError?.name === 'SLOT_NOT_ON' && s.lastError.slot === 2, 'A1 PT2: ... und steht mit Namen und Slot in lastError');
  assert(run([{ ev: 'error', where: 'slot', code: 'slotBadNumber' }]).lastError?.slot === undefined,
    'A1 PT2: ohne slot im Ereignis erfindet der Reducer keinen');
  const auth = run([{ ev: 'status', status: 'inMeeting', raw: 3, code: 0 }, { ev: 'error', where: 'auth', code: 'authTimeout' }]);
  assert(auth.phase === 'error', 'A1 PT2: where:auth kippt die Sitzung weiterhin');
}

console.log('\nA1 index — Exporte des Slot-Vertrags (PT4):');
{
  assert(paket.SLOT_NR_MAX === SLOT_NR_MAX && paket.SLOT_MODES === SLOT_MODES && paket.SLOT_RESOLUTIONS === SLOT_RESOLUTIONS
      && paket.SLOT_AUDIO_SETTINGS === SLOT_AUDIO_SETTINGS && paket.SLOT_FALLBACKS === SLOT_FALLBACKS && paket.SLOT_STATES === SLOT_STATES
      && paket.SLOT_SENT === SLOT_SENT && paket.SLOT_REASONS === SLOT_REASONS && paket.SLOT_AUDIO_REASONS === SLOT_AUDIO_REASONS
      && paket.SLOT_AUDIO_SOURCES === SLOT_AUDIO_SOURCES && paket.SPEAKER_SIGNALS === SPEAKER_SIGNALS
      && paket.SPEAKER_HOLD_MAX_MS === SPEAKER_HOLD_MAX_MS && paket.SHARE_TYPE_NAMES === SHARE_TYPE_NAMES
      && paket.SHARING_STATUS_NAMES === SHARING_STATUS_NAMES && paket.SLOT_ERROR_KEYS === SLOT_ERROR_KEYS
      && paket.AUDIO_ABO_FEHLER === AUDIO_ABO_FEHLER,
    'A1 PT4: src/index.ts exportiert alle 16 Slot-Konstanten');
  const typen: [PaketSlotMode, PaketSlotResolution, PaketSlotAudioSetting, PaketSlotFallback, PaketSlotState, PaketSlotSent,
    PaketSlotReason, PaketSlotAudioReason, PaketSlotAudioSource, PaketSpeakerSignal, PaketShareTypeName, PaketSharingStatusName,
    PaketSlotFehler] = ['share', '1080p', 'person', 'white', 'held', 'held', 'noFrames', 'personNotInMode', 'mixShare', 'activeAudio',
    'computerAudio', 'resume', 'slotBadTarget'];
  const sub: PaketSlotSub = { state: 'live', mode: 'participant', target: 7, share: 0, reason: 'frames', sent: 'none', ndi: 'X' };
  const ton: PaketSlotAudioSub = { state: 'waiting', source: 'none', configured: 'person', reason: 'command' };
  const lokal: [SlotSub, SlotAudioSub] = [sub, ton];
  const eintrag: PaketShareEntry = { user: 7, share: 101, status: 'paused', type: 'ds', audioOnly: false, pauses: 1 };
  const rueckruf: PaketShareCallback = { ms: 1, cb: 'shareContent', status: 'otherShareBegin', user: 7, share: 101, type: 'ds' };
  const empfang: PaketRecvStat = { w: 1280, h: 720, fps: 30 };
  assert(typen.length === 13 && lokal.length === 2 && eintrag.pauses === 1 && rueckruf.cb === 'shareContent' && empfang.fps === 30,
    'A1 PT4: src/index.ts exportiert die Slot-Typen samt SlotSub und SlotAudioSub (prüft tsc)');
}

// ── A2 · Attrappe: Slot-Befehle, Ereignisse, Stellschrauben, Drehbuch „Slots“, Altweg (Spec 11.3, 11.2 PT5, PT7) ──
import { spawn } from 'node:child_process';

console.log('\nA2 Attrappe — Slot-Befehle werden beantwortet, videoSubscribe ist ein unbekannter Befehl (PT5):');
{
  const ev = await fahreSteuerung({}, async (b, ev) => {
    b.send({ cmd: 'speakerConfig', signal: 'activeVideo', holdMs: 0 });
    b.send({ cmd: 'previewMode', on: false });
    await imMeeting(b, ev);
    b.send(slotAn(1, 'JM Connect – Zoom Anna', { id: ANNA }));
    await bisEreignis(ev, art('slotAudio', { slot: 1, state: 'live' }));
    b.send({ cmd: 'slotSet', slot: 1, fallback: 'black' });
    b.send({ cmd: 'slotOff', slot: 1 });
    // videoSubscribe steht seit Plan B, Task B23 nicht mehr in Command; der Fall schickt ihn absichtlich.
    b.send({ cmd: 'videoSubscribe', id: ANNA, resolution: '720p' } as unknown as Command);
    await bisEreignis(ev, art('error', { where: 'cmd' }));
  });
  assert(ev.some(art('speakerConfig', { signal: 'activeVideo', holdMs: 0 })) && ev.some(art('previewMode', { on: false })),
    'A2 PT5: speakerConfig und previewMode werden auch vor dem Beitritt bestätigt');
  assert(slotFolge(ev, 1).join(' ') === 'starting/command@16778240 live/frames@16778240 live/command@16778240 off/command@16778240',
    'A2 PT5: slotOn → starting, live; slotSet → Bestätigung mit Grund command; slotOff → off/command');
  assert(tonFolge(ev, 1).join(' ') === 'waiting/command:none live/packets:person off/command:none',
    'A2 PT5: Person-Ton waiting/command, dann live/packets; beim slotOff slotAudio off');
  assert(stelle(ev, art('slotAudio', { slot: 1, state: 'off' })) === stelle(ev, art('slot', { slot: 1, state: 'off' })) - 1,
    'A2 6.15: Ton vor Bild (slotAudio off direkt vor slot off)');
  assert(ev.some(art('error', { where: 'cmd', code: 1 })) && !ev.some(art('video')),
    'A2 PT5: videoSubscribe ohne FAKE_ALTWEG → error where:cmd code:1, kein video-Ereignis');
}

console.log('\nA2 Attrappe — dieselben Kataloge wie src/protocol.ts (Review Focus 6):');
{
  const quelle = readFileSync(fake, 'utf8');
  const katalog = (name: string): string => {
    const m = new RegExp(`^const ${name} = \\[([^\\]]*)\\];`, 'm').exec(quelle);
    return m ? [...m[1].matchAll(/'([^']*)'/g)].map((x) => x[1]).join(',') : '';
  };
  const paare: [string, readonly string[]][] = [
    ['SLOT_MODES', SLOT_MODES], ['SLOT_RESOLUTIONS', SLOT_RESOLUTIONS], ['SLOT_AUDIO_SETTINGS', SLOT_AUDIO_SETTINGS],
    ['SLOT_FALLBACKS', SLOT_FALLBACKS], ['SPEAKER_SIGNALS', SPEAKER_SIGNALS], ['SHARE_TYPE_NAMES', SHARE_TYPE_NAMES],
  ];
  for (const [name, werte] of paare) assert(katalog(name) === werte.join(','), `A2: ${name} der Attrappe gleicht src/protocol.ts`);
  assert(new RegExp(`^const SLOT_NR_MAX = ${SLOT_NR_MAX};`, 'm').test(quelle) && new RegExp(`^const SPEAKER_HOLD_MAX_MS = ${SPEAKER_HOLD_MAX_MS};`, 'm').test(quelle),
    'A2: SLOT_NR_MAX und SPEAKER_HOLD_MAX_MS der Attrappe gleichen src/protocol.ts');
  assert(['|    0 | roster ', '|   50 | Erlaubnis ', '|  800 | speakerSignal speakerVideo Ben ', '| 1100 | speakerSignal speakerVideo Carla ', '| 1400 | speakerSignal speakerVideo Ben (schneller Wechsel) ', '| 2000 | Anna Kamera aus ', '| 2600 | Anna Kamera an ', '| 3000 | Freigabe Ben beginnt (Freigabe 101, Typ ds) ', '| 3200 | Freigabe Carla beginnt (Freigabe 102, Typ as) ', '| 3800 | Freigabe Carla endet ', '| 4400 | Anna geht (left) ', '| 4900 | Anna kommt als 16778250 zurück (joined)', '| 5600 | Entzug der Erlaubnis ', '| 6200 | Wiedererteilung ', '| 6500 | später Abbau aller Slots (privilegeRevoked) '].every((z) => quelle.includes(z)), 'A2 A-EP22: die Kopfdoku trägt die Tabelle des Drehbuchs „Slots“ (PK36 liest sie dort)');
}

/** Startet die Attrappe ohne Bridge und schickt ROHE Zeilen (die Falltabelle braucht "id":4.5 und \u wörtlich). */
async function fahreRoh(zeilen: string[]): Promise<{ antworten: Record<string, unknown>[][]; stderr: string[] }> {
  const kind = spawn(process.execPath, [fake], { env: { ...process.env, FAKE_SCRIPT: 'steuerung' }, stdio: ['pipe', 'pipe', 'pipe'] });
  const aus: Record<string, unknown>[] = [];
  const fehler: string[] = [];
  const o = new LineSplitter();
  const e = new LineSplitter();
  kind.stdout.setEncoding('utf8').on('data', (d: string) => {
    for (const l of o.push(d)) {
      const x = JSON.parse(l) as Record<string, unknown>;
      if (x.ev !== 'bridgeStats' && x.ev !== 'slotStats') aus.push(x);
    }
  });
  kind.stderr.setEncoding('utf8').on('data', (d: string) => fehler.push(...e.push(d)));
  const schicke = async (z: string): Promise<Record<string, unknown>[]> => {
    const vor = aus.length;
    kind.stdin.write(`${z}\n`);
    const ende = Date.now() + 2000;
    while (aus.length === vor && Date.now() < ende) await warte(10);
    await warte(30);
    return aus.slice(vor);
  };
  await schicke('{"cmd":"init"}');
  await schicke('{"cmd":"auth","jwt":"attrappe"}');
  const antworten: Record<string, unknown>[][] = [];
  for (const z of zeilen) antworten.push(await schicke(z));
  const ende = new Promise((r) => kind.on('exit', r));
  kind.stdin.end();
  await ende;
  return { antworten, stderr: fehler };
}

console.log('\nA2 Attrappe — Prüffolge aus test/slot-pruefung-faelle.json (Gliederung 3.2, A-EP12):');
{
  type Fall = { name: string; zeile: string; ev: string; where: string | null; code: string | number | null; mitSlot: boolean; stderr: boolean };
  const faelle = JSON.parse(readFileSync(join(testDir, 'slot-pruefung-faelle.json'), 'utf8')) as Fall[];
  const { antworten, stderr } = await fahreRoh(faelle.map((f) => f.zeile));
  // stderr je Befehl: Die Attrappe schreibt „ATTRAPPE empfing: <zeile>“ vor jeder Antwort (init und auth zuerst).
  const empfang = stderr.flatMap((z, i) => (z.startsWith('ATTRAPPE empfing: ') ? [i] : []));
  const abschnitt = (n: number): string[] => stderr.slice(empfang[n + 2], empfang[n + 3] ?? stderr.length);
  // A11 ergänzt zwei Fälle mit einer Auflösung über 1080p (Nachbesserung a3, NB-a3-5).
  assert(faelle.length === 58 && empfang.length === faelle.length + 2, 'A2 A-EP12: die Falltabelle hat 58 Fälle, jeder kam an');
  faelle.forEach((f, n) => {
    const a = antworten[n] ?? [];
    const erste = a[0] ?? {};
    const passt = f.ev === 'error'
      ? erste.ev === 'error' && erste.where === f.where && erste.code === f.code && ('slot' in erste) === f.mitSlot
      : erste.ev === f.ev;
    const gelesen = abschnitt(n).some((z) => z.startsWith('Befehl gelesen: slotOn '));
    assert(passt && a.length === 1 && gelesen === f.stderr, `A2 Prüffolge: ${f.name}`);
  });
}

console.log('\nA2 Attrappe — Prüffolge mit laufendem Slot: Name belegt, Slot läuft schon, ungültiges slotSet (Gliederung 3.2 Nr. 3, 7; Spec 6.2):');
{
  let nachFehlern = -1;
  const ev = await fahreSteuerung({}, async (b, ev) => {
    await imMeeting(b, ev);
    b.send(slotAn(1, 'JM Connect – Zoom Anna', { id: ANNA }));
    await bisEreignis(ev, art('slot', { slot: 1, state: 'live' }));
    b.send(slotAn(2, 'JM Connect – Zoom Anna', { mode: 'galerie' }));
    b.send(slotAn(2, 'JM Connect – Zoom Anna'));
    b.send(slotAn(1, 'JM Connect – Zoom Anna', { id: ANNA }));
    b.send(slotAn(1, 'JM Connect – Zoom Ben', { id: BEN, mode: 'galerie' }));
    b.send(slotAn(1, 'JM Connect – Zoom Ben', { id: BEN }));
    // Ein gültiges (mode), ein ungültiges (fallback) und ein drittes gültiges Feld (showNoVideo): nichts davon gilt.
    const ungueltig: Record<string, unknown> = { mode: 'speaker', fallback: 'grau', showNoVideo: false };
    b.send({ cmd: 'slotSet', slot: 1, ...ungueltig } as Command);
    await bisEreignis(ev, () => anzahl(ev, art('error', { where: 'slot' })) >= 6);
    nachFehlern = ev.length;
    b.send({ cmd: 'slotSet', slot: 1, fallback: 'black' });
    await bisEreignis(ev, art('slot', { slot: 1, state: 'live', reason: 'command' }));
  });
  const fehler = ev.filter(art('error', { where: 'slot' })).map((e) => `${(e as { slot?: number }).slot}:${(e as { code?: string }).code}`);
  assert(fehler.join(' ') === '2:slotNameTaken 2:slotNameTaken 1:slotAlreadyOn 1:slotBadMode 1:slotAlreadyOn 1:slotBadFallback',
    'A2 3.2: slotNameTaken kommt direkt nach dem Namen, vor einem Feldfehler (Spec 6.2); ein Feldfehler kommt vor slotAlreadyOn; derselbe Slot meldet slotAlreadyOn, auch mit seinem eigenen Namen');
  assert(!ev.some(art('slot', { slot: 2 })) && anzahl(ev, art('slot', { slot: 1, state: 'starting' })) === 1,
    'A2 3.2: bei einem Fehler wird nichts angelegt und nichts geändert');
  const bestaetigung = ev.slice(nachFehlern).find(art('slot', { slot: 1 })) as { mode?: string; target?: number } | undefined;
  assert(nachFehlern > 0 && bestaetigung?.mode === 'participant' && bestaetigung.target === ANNA
      && slotFolge(ev, 1).join(' ') === `starting/command@${ANNA} live/frames@${ANNA} live/command@${ANNA} off/command@${ANNA}`,
    'A2 6.2: slotSet mit einem ungültigen von drei Feldern ändert nichts, auch nicht das gültige mode (das nächste slot-Ereignis zeigt participant mit Ziel Anna)');
}

console.log('\nA2 Attrappe — slotSet hängt nur bei einer anderen Auflösung um (6.2, wie die EXE, NB-a1-4):');
{
  const ev = await fahreSteuerung({}, async (b, ev) => {
    await imMeeting(b, ev);
    b.send(slotAn(1, 'JM Connect – Zoom Anna', { id: ANNA }));
    await bisEreignis(ev, art('slot', { slot: 1, state: 'live' }));
    b.send({ cmd: 'slotSet', slot: 1, resolution: '720p' });
    await bisEreignis(ev, art('slot', { slot: 1, state: 'live', reason: 'command' }));
    b.send({ cmd: 'slotSet', slot: 1, resolution: '1080p' });
    await bisEreignis(ev, () => anzahl(ev, art('slot', { slot: 1, state: 'live', reason: 'frames' })) === 2);
  });
  assert(slotFolge(ev, 1).join(' ') === `starting/command@${ANNA} live/frames@${ANNA} live/command@${ANNA} starting/resolutionChanged@${ANNA} live/frames@${ANNA} off/command@${ANNA}`,
    'A2 6.2: slotSet mit derselben Auflösung bestätigt nur (command), erst eine andere Auflösung hängt um (resolutionChanged)');
}

console.log('\nA2 Attrappe — slotOn während reconnecting: slotReconnecting, nichts angelegt (3.5, 6.2 Nr. 8):');
{
  const zeilen: string[] = [];
  const ev = await fahreSteuerung({ FAKE_VERBINDUNG_HAENGT_MS: '1000', FAKE_VERBINDUNG_ZURUECK_MS: '1000' }, async (b, ev) => {
    await imMeeting(b, ev);
    await bisEreignis(ev, art('status', { status: 'reconnecting' }));
    b.send(slotAn(1, 'JM Connect – Zoom Anna', { id: ANNA }));
    await bisEreignis(ev, art('error', { code: 'slotReconnecting' }));
    await bisEreignis(ev, () => anzahl(ev, art('status', { status: 'inMeeting' })) === 2);
    b.send(slotAn(1, 'JM Connect – Zoom Anna', { id: ANNA }));
    await bisEreignis(ev, art('slot', { slot: 1 }));
  }, zeilen);
  const iWieder = stelle(ev, art('status', { status: 'reconnecting' }));
  const iZurueck = stelleNach(ev, iWieder, art('status', { status: 'inMeeting' }));
  assert(stelle(ev, art('error', { where: 'slot', code: 'slotReconnecting', slot: 1 })) > iWieder
      && ev.find(art('error', { code: 'slotReconnecting' }))?.name === 'SLOT_RECONNECTING',
    'A2 6.2 Nr. 8: slotOn während reconnecting → error slotReconnecting mit slot');
  assert(zeilen.filter((z) => z === 'Befehl gelesen: slotOn 1, Modus participant, Ton person').length === 2,
    'A2 A-EP3: die stderr-Zeile „Befehl gelesen: slotOn …“ steht vor der Sperre (beide Male)');
  assert(iZurueck > 0 && !ev.slice(0, iZurueck).some(art('slot', { slot: 1 })), 'A2 6.2: ... und nichts angelegt');
  assert(stelleNach(ev, iZurueck, art('slot', { slot: 1, state: 'starting' })) > iZurueck, 'A2 6.2: nach inMeeting startet derselbe Befehl den Slot');
}

console.log('\nA2 Attrappe — Kamera aus und kein Bild (FAKE_KAMERA_AUS_MS, FAKE_KEIN_BILD_MS, PT7):');
{
  const ev = await fahreSteuerung({ FAKE_KAMERA_AUS_MS: `${ANNA}:1000` }, async (b, ev) => {
    await imMeeting(b, ev);
    b.send(slotAn(1, 'JM Connect – Zoom Anna', { id: ANNA, fallback: 'freeze' }));
    await bisEreignis(ev, art('videoStatus', { id: ANNA }));
    b.send(slotAn(2, 'JM Connect – Zoom Anna 2', { id: ANNA, fallback: 'freeze' }));
    await bisEreignis(ev, art('slot', { slot: 2 }));
    await warte(300);
  });
  assert(ev.some(art('videoStatus', { id: ANNA, videoOn: false, mutedByHost: false })), 'A2 PT7: FAKE_KAMERA_AUS_MS meldet videoStatus mit videoOn:false');
  assert(slotFolge(ev, 1).join(' ') === 'starting/command@16778240 live/frames@16778240 fallback/cameraOff@16778240 off/command@16778240',
    'A2 PT7: ... der laufende Slot wechselt auf fallback/cameraOff');
  assert((ev.find(art('slot', { slot: 1, reason: 'cameraOff' })) as { sent?: string } | undefined)?.sent === 'freeze',
    'A2 6.12: mit einer Kopie dieses Ziels sendet „eingefroren“ das letzte Bild (sent freeze)');
  assert(slotFolge(ev, 2).join(' ') === 'fallback/cameraOff@16778240 off/command@16778240' && (ev.find(art('slot', { slot: 2 })) as { sent?: string } | undefined)?.sent === 'transparent',
    'A2 6.10 Schritt 7: ein neuer Slot auf diese Person meldet sofort fallback/cameraOff; ohne Kopie sendet „eingefroren“ transparent');
}
{
  const ev = await fahreSteuerung({ FAKE_KEIN_BILD_MS: `${ANNA}:1000` }, async (b, ev) => {
    await imMeeting(b, ev);
    b.send(slotAn(1, 'JM Connect – Zoom Anna', { id: ANNA }));
    await bisEreignis(ev, art('slot', { slot: 1, state: 'fallback' }));
    b.send(slotAn(2, 'JM Connect – Zoom Anna 2', { id: ANNA }));
    await warte(400);
  });
  assert(slotFolge(ev, 1).join(' ') === 'starting/command@16778240 live/frames@16778240 fallback/noFrames@16778240 off/command@16778240',
    'A2 PT7: FAKE_KEIN_BILD_MS: der laufende Slot wechselt auf fallback/noFrames');
  assert(!ev.some(art('videoStatus')), 'A2 PT7: ... ohne videoStatus (Zoom meldet die Kamera als an)');
  assert(slotFolge(ev, 2).join(' ') === 'starting/command@16778240 off/command@16778240', 'A2 6.12: ein neuer Slot ohne Bilder bleibt starting');
}

console.log('\nA2 Attrappe — Sprecher-Signale (FAKE_SPRECHER_FOLGE, FAKE_SPRECHER_SIGNAL, PT7):');
{
  const ev = await fahreSteuerung({ FAKE_SPRECHER_FOLGE: `1000:${BEN},2000:${ANNA}`, FAKE_SPRECHER_SIGNAL: 'activeAudio' }, async (b, ev) => {
    b.send({ cmd: 'speakerConfig', signal: 'activeAudio', holdMs: 100 });
    await imMeeting(b, ev);
    b.send(slotAn(2, 'JM Connect – Zoom Sprecher', { mode: 'speaker', audio: 'mix', shareAudio: true }));
    await bisEreignis(ev, art('slot', { slot: 2, target: ANNA, state: 'live' }), 5000);
  });
  assert(ev.filter(art('speakerSignal', { signal: 'activeAudio' })).map((e) => (e as { ids?: number[] }).ids?.join()).join(' ') === `${BEN} ${ANNA}`,
    'A2 PT7: FAKE_SPRECHER_FOLGE meldet je Eintrag ein speakerSignal, mit dem Signal aus FAKE_SPRECHER_SIGNAL');
  assert(slotFolge(ev, 2).join(' ') === `fallback/speakerNone@0 starting/speakerChanged@${BEN} live/frames@${BEN} starting/speakerChanged@${ANNA} live/frames@${ANNA} off/command@${ANNA}`,
    'A2 6.8: ohne Ziel springt der Sprecher-Slot sofort, danach nach der Haltezeit');
  assert(tonFolge(ev, 2).join(' ') === 'waiting/command:none live/packets:mix off/command:none',
    'A2 6.13: Mischton im Sprecher-Slot hängt an keinem Ziel (kein Ton-Ereignis beim Sprecherwechsel)');
}

console.log('\nA2 Attrappe — Freigaben (FAKE_FREIGABEN, FAKE_FREIGABE_BEFUELLT, PT7):');
{
  const ev = await fahreSteuerung({
    FAKE_FREIGABEN: `1000:${BEN}:101:begin,1000:${BEN}:101:typ=ds,1100:${CARLA}:102:ton,1600:${BEN}:101:pause,2600:${BEN}:101:resume,3100:${BEN}:101:end`,
    FAKE_FREIGABE_BEFUELLT: 'unavailable',
  }, async (b, ev) => {
    await imMeeting(b, ev);
    b.send(slotAn(3, 'JM Connect – Zoom Freigabe', { mode: 'share', audio: 'off', shareAudio: true }));
    await bisEreignis(ev, () => anzahl(ev, art('slot', { slot: 3, reason: 'shareNone' })) === 2, 6000);
  });
  type Anteil = { list: { user: number; share: number; status: string; type: string; audioOnly: boolean; pauses: number }[]; shown: number;
    seeded?: string; recent: { cb: string; status: string }[] };
  const anteile = ev.filter(art('shares')) as unknown as Anteil[];
  assert(anteile[0]?.seeded === 'unavailable' && anteile[0].list.length === 0, 'A2 PT7: FAKE_FREIGABE_BEFUELLT: das Befüllen beim ersten Freigabe-Slot meldet seeded');
  assert(anteile.some((a) => a.shown === 101 && a.list.some((x) => x.user === BEN && x.share === 101 && x.type === 'ds' && !x.audioOnly)),
    'A2 PT7: FAKE_FREIGABEN begin und typ=ds: Eintrag mit Typ ds, gezeigt');
  assert(anteile.some((a) => a.shown === 101 && a.list.some((x) => x.share === 102 && x.audioOnly)), 'A2 6.9: eine reine Ton-Freigabe wird nie gezeigt');
  assert(anteile.some((a) => a.list.some((x) => x.share === 101 && x.status === 'paused' && x.pauses === 1)), 'A2 6.9: Pause zählt pauses');
  const letzte = anteile.at(-1);
  assert(letzte?.shown === 0 && letzte.list.length === 1 && letzte.recent.map((r) => `${r.cb}:${r.status}`).join(' ')
      === 'sharingStatus:otherShareBegin shareContent:otherShareBegin sharingStatus:otherSharePureAudioBegin sharingStatus:pause sharingStatus:resume sharingStatus:otherShareEnd',
    'A2 6.3: shares.recent führt die Rückrufe roh; nach dem Ende ist nichts gezeigt');
  assert(slotFolge(ev, 3).join(' ') === `fallback/shareNone@0 starting/shareChanged@${BEN}#101 live/frames@${BEN}#101 live/frames@${BEN}#101 live/frames@${BEN}#101 fallback/shareNone@0 off/command@0`,
    'A2 6.9: der Freigabe-Slot hängt auf die gezeigte Freigabe um und fällt mit ihrem Ende zurück');
  assert(ev.filter(art('slot', { slot: 3, state: 'live' })).map((e) => (e as { sent?: string }).sent).join(' ') === 'none held none',
    'A2 6.9: in der Pause sendet er nach 200 ms die Kopie (sent held), mit dem nächsten Bild wieder none');
  assert(tonFolge(ev, 3).join(' ') === 'waiting/command:none off/noShare:none waiting/targetChanged:none live/packets:share off/noShare:none off/command:none',
    'A2 6.13: direkter Computerton: ohne Freigabe off/noShare, mit Freigabe waiting/targetChanged und live/packets');
}

console.log('\nA2 Attrappe — Messwerte, Vorschau, gelieferte Auflösung (FAKE_AUFLOESUNG_GELIEFERT, 6.3, 6.16, PT7):');
{
  let vorAn = -1;
  let beimAus = -1;
  const ev = await fahreSteuerung({ FAKE_AUFLOESUNG_GELIEFERT: '1280x720' }, async (b, ev) => {
    await imMeeting(b, ev);
    b.send(slotAn(1, 'JM Connect – Zoom Anna', { id: ANNA, resolution: '1080p' }));
    await bisEreignis(ev, art('slot', { slot: 1, state: 'live' }));
    await warte(600);
    vorAn = anzahl(ev, art('preview'));
    b.send({ cmd: 'previewMode', on: true });
    await bisEreignis(ev, () => ev.some(art('preview', { slot: 1 })) && ev.some(art('slotStats', { slot: 1 })), 3000);
    b.send({ cmd: 'previewMode', on: false });
    await bisEreignis(ev, art('previewMode', { on: false }));
    beimAus = anzahl(ev, art('preview'));
    await warte(700);
  });
  const stats = ev.find(art('slotStats', { slot: 1 })) as Record<string, unknown> | undefined;
  assert(stats?.w === 1280 && stats.h === 720 && stats.fps === 30 && stats.resWanted === '1080p' && stats.resGot === 4 && stats.rawType === 0
      && !('lastW' in stats),
    'A2 PT7: FAKE_AUFLOESUNG_GELIEFERT=1280x720: slotStats meldet 1280×720 bei gewünschtem 1080p (resGot = ZoomSDKResolution_1080P)');
  assert(['fallbackFps', 'heldFrames', 'workUs', 'copyUs', 'previewUs', 'memKb', 'foreignFrames', 'lateFrames', 'tooFrequent', 'noShareData',
    'rendererNew', 'rendererLost'].every((k) => typeof stats?.[k] === 'number'), 'A2 6.3: slotStats trägt jedes Pflichtfeld als Zahl');
  const brueckeStats = ev.find(art('bridgeStats')) as Record<string, unknown> | undefined;
  assert(['cpuPct', 'sysPct', 'memMb', 'audioQueueMax', 'audioDropped', 'merkerVerworfen', 'halteliste', 'shareAudioPackets', 'shareAudioUnassigned']
    .every((k) => typeof brueckeStats?.[k] === 'number') && typeof brueckeStats?.previewOn === 'boolean', 'A2 6.3: bridgeStats alle 2 s nach init, mit jedem Pflichtfeld');
  const vorschau = ev.find(art('preview', { slot: 1 })) as { target?: number; w?: number; h?: number; jpeg?: string } | undefined;
  const bild = Buffer.from(vorschau?.jpeg ?? '', 'base64');
  assert(vorAn === 0 && vorschau?.target === ANNA && vorschau.w === 1 && vorschau.h === 1
      && bild.subarray(0, 3).toString('hex') === 'ffd8ff' && bild.subarray(-2).toString('hex') === 'ffd9',
    'A2 6.16: preview erst nach previewMode on, mit Ziel und einem gültigen JPEG (FF D8 … FF D9)');
  assert(beimAus >= 1 && anzahl(ev, art('preview')) === beimAus && ev.some(art('previewMode', { on: true })),
    'A2 6.16: nach previewMode off kommt keine Vorschau mehr');
}

console.log('\nA2 Attrappe — Aufbaufehler und stumme Slots (FAKE_SLOT_FEHLER, FAKE_SLOT_STUMM, PT7):');
{
  const zeilen: string[] = [];
  const ev = await fahreSteuerung({ FAKE_SLOT_FEHLER: '2:slotRendererFailed' }, async (b, ev) => {
    await imMeeting(b, ev);
    b.send(slotAn(1, 'JM Connect – Zoom Anna', { id: ANNA }));
    b.send(slotAn(2, 'JM Connect – Zoom Ben', { id: BEN }));
    await bisEreignis(ev, art('error', { code: 'slotRendererFailed' }));
    b.send(slotAn(2, 'JM Connect – Zoom Ben', { id: BEN }));
    await bisEreignis(ev, art('slot', { slot: 2 }));
  }, zeilen);
  const iFehler = stelle(ev, art('error', { where: 'slot', code: 'slotRendererFailed', slot: 2 }));
  assert(iFehler >= 0 && ev[iFehler]?.name === 'SLOT_RENDERER_FAILED' && stelle(ev, art('slot', { slot: 2 })) > iFehler,
    'A2 PT7: FAKE_SLOT_FEHLER=2:slotRendererFailed: das erste slotOn 2 scheitert ohne Slot, das zweite geht durch');
  assert(zeilen.filter((z) => z === 'Befehl gelesen: slotOn 2, Modus participant, Ton person').length === 2
      && ev.some(art('slot', { slot: 1, state: 'starting' })),
    'A2 6.2 Nr. 11: ... nach der stderr-Zeile; die anderen Slots laufen');
}
{
  const ev = await fahreSteuerung({ FAKE_SLOT_STUMM: '3' }, async (b, ev) => {
    await imMeeting(b, ev);
    b.send(slotAn(3, 'JM Connect – Zoom Anna', { id: ANNA }));
    b.send(slotAn(1, 'JM Connect – Zoom Ben', { id: BEN }));
    await bisEreignis(ev, art('slot', { slot: 1 }));
    await warte(300);
  });
  assert(!ev.some((e) => (e as { slot?: number }).slot === 3) && ev.some(art('slot', { slot: 1, state: 'starting' })),
    'A2 PT7: FAKE_SLOT_STUMM=3: auf slotOn 3 kommt kein Ereignis, die anderen Slots antworten');
}

console.log('\nA2 Attrappe — Drehbuch „Slots“ von Anfang bis Ende (11.3, A-EP22, PT7):');
{
  let zwischenMs = -1;
  const ev = await fahreSteuerung({ FAKE_SCRIPT: 'slots' }, async (b, ev) => {
    await imMeeting(b, ev);
    b.send(slotAn(1, 'JM Connect – Zoom Anna', { id: ANNA, resolution: '360p', fallback: 'black' }));
    b.send(slotAn(2, 'JM Connect – Zoom Sprecher', { mode: 'speaker', audio: 'mix', shareAudio: true }));
    b.send(slotAn(3, 'JM Connect – Zoom Freigabe', { mode: 'share', audio: 'mix', shareAudio: true }));
    await bisEreignis(ev, () => anzahl(ev, art('slot', { slot: 3, share: 101, state: 'live' })) === 2, 6000);
    b.send({ cmd: 'slotSet', slot: 2, mode: 'share' });
    await bisEreignis(ev, art('left', { id: ANNA }), 3000);
    const weg = Date.now();
    await bisEreignis(ev, art('joined'), 3000);
    zwischenMs = Date.now() - weg;
    await warte(100);
    b.send({ cmd: 'slotSet', slot: 1, id: ANNA_NEU });
    await bisEreignis(ev, () => anzahl(ev, art('slot', { state: 'off', reason: 'privilegeRevoked' })) === 3, 4000);
  });
  assert(ev.filter(art('speakerSignal', { signal: 'speakerVideo' })).map((e) => (e as { ids?: number[] }).ids?.join()).join(' ') === `${BEN} ${CARLA} ${BEN}`,
    'A2 Drehbuch: drei Sprecher-Signale Ben, Carla, Ben');
  const folge2 = slotFolge(ev, 2).join(' ');
  assert(folge2.startsWith(`fallback/speakerNone@0 starting/speakerChanged@${BEN} live/frames@${BEN} starting/modeChanged@${BEN}#101`)
      && !folge2.includes(`@${CARLA}`),
    'A2 Drehbuch: der Sprecher-Slot springt sofort auf Ben, der schnelle Wechsel zu Carla verfällt, dann Moduswechsel auf die Freigabe');
  assert(tonFolge(ev, 2).join(' ') === 'waiting/command:none live/packets:mix waiting/modeChanged:none live/packets:mixShare off/privilegeRevoked:none',
    'A2 Drehbuch: Moduswechsel Sprecher → Freigabe schaltet den Mischer ein (configured mixShare, 6.10 Schritt 8)');
  assert(slotFolge(ev, 1).join(' ') === `starting/command@${ANNA} live/frames@${ANNA} fallback/cameraOff@${ANNA} live/frames@${ANNA} fallback/participantLeft@0 starting/targetChanged@${ANNA_NEU} live/frames@${ANNA_NEU} off/privilegeRevoked@${ANNA_NEU}`,
    'A2 Drehbuch: Teilnehmer-Slot Anna: Kamera aus und an, Weggang ohne Umhängen, Rückkehr per slotSet, Abbau nach dem Entzug');
  assert(ev.filter(art('videoStatus', { id: ANNA })).map((e) => (e as { videoOn?: boolean }).videoOn).join(' ') === 'false true',
    'A2 Drehbuch: videoStatus Kamera aus, dann an');
  assert(zwischenMs >= 450, 'A2 Drehbuch: Anna kommt nach 500 ms zurück (mindestens 450 ms, über der 300-ms-Entprellung)');
  assert(slotFolge(ev, 3).join(' ') === `fallback/shareNone@0 starting/shareChanged@${BEN}#101 live/frames@${BEN}#101 starting/shareChanged@${CARLA}#102 live/frames@${CARLA}#102 starting/shareChanged@${BEN}#101 live/frames@${BEN}#101 off/privilegeRevoked@${BEN}#101`,
    'A2 Drehbuch: Freigabe-Slot zeigt Ben, dann die neuere Freigabe von Carla, nach deren Ende wieder Ben');
  const iFalsch = stelle(ev, art('privilege', { canRecordRaw: false, source: 'broadcast' }));
  const iWahr = stelle(ev, art('privilege', { canRecordRaw: true, source: 'broadcast' }));
  assert(iFalsch >= 0 && iWahr > iFalsch && stelle(ev, art('slot', { state: 'off' })) > iWahr,
    'A2 Drehbuch: Entzug, Wiedererteilung, dann der späte Abbau aller drei Slots');
  assert(ev.some(art('slotStats', { slot: 1, w: 640, h: 360, resWanted: '360p' })), 'A2 Drehbuch: ohne FAKE_AUFLOESUNG_GELIEFERT meldet slotStats die Nenngröße (360p: 640×360)');
}

// ── A3 · Konsole auf Slots, alte Reducer-Zweige weg (Spec 6.18, 11.2 PT8) ──
import { konsolenNdiName } from '../cli/steuerung.mjs';

console.log('\nA3 Konsole — Namensregel der Konsolen-Slots (A-EP9, Beispiele wie PK35):');
{
  const n = konsolenNdiName as (anzeigename: string, belegt?: string[]) => string;
  assert(n('A:B') === 'JM Connect – Zoom A B', 'A3 PT8: „A:B“ → „JM Connect – Zoom A B“');
  assert(n('A: B') === 'JM Connect – Zoom A  B', 'A3 PT8: „A: B“ → zwei Leerzeichen, wie 0.3.0 nach NDI');
  assert(n('A  B') === 'JM Connect – Zoom A  B' && n(' A') === 'JM Connect – Zoom  A' && n('A ') === 'JM Connect – Zoom A ',
    'A3 PT8: doppelter, führender und abschließender Leerraum bleibt Zeichen für Zeichen erhalten');
  assert(n('A\x07B\tC') === 'JM Connect – Zoom ABC', 'A3 PT8: Steuerzeichen fallen weg');
  const lang = n('x'.repeat(70));
  assert([...lang].length === 60 && lang === `JM Connect – Zoom ${'x'.repeat(42)}`, 'A3 PT8: 70 Zeichen → 60 Code-Punkte');
  assert(n('Anna', ['JM Connect – Zoom anna']) === 'JM Connect – Zoom Anna (2)', 'A3 PT8: Kollision ohne Groß-/Kleinschreibung → „ (2)“');
  assert(n('Anna', ['JM Connect – Zoom Anna', 'JM Connect – Zoom Anna (2)']) === 'JM Connect – Zoom Anna (3)', 'A3 PT8: ... und „ (3)“');
  const mitZusatz = n('y'.repeat(70), [n('y'.repeat(70))]);
  assert([...mitZusatz].length === 60 && mitZusatz.endsWith('y (2)'), 'A3 PT8: vor dem Kürzen bleibt Platz für „ (2)“');
}

console.log('\nA3 Konsole — Slots statt Abos: +, -, =, liste (6.18, PT8):');
{
  const t = steuere({}, { ZOOM_MEETING_ID: '1' });
  assert(await bisZeile(t.zeilen, 'Rohdaten-Erlaubnis: JA'), 'im Meeting mit Erlaubnis');
  t.tippe('+16778240');
  assert(await bisZeile(t.zeilen, 'slot 1: live (frames)'), 'A3 PT8: +16778240 → Slot 1 läuft');
  t.tippe('+16778241');
  assert(await bisZeile(t.zeilen, 'slot 2: live (frames)'), 'A3 PT8: +16778241 → Slot 2 (die kleinste freie Nummer)');
  t.tippe('-16778241');
  assert(await bisZeile(t.zeilen, 'slot 2: off (command)'), 'A3 PT8: -16778241 stoppt den Slot mit diesem Ziel');
  assert(t.befehle().filter((b) => b.cmd === 'slotOff').map((b) => b.slot).join() === '2', 'A3 PT8: ... als slotOff {slot:2}, nicht der kleinste Slot');
  t.tippe('+16778241');
  assert(await bisZeile(t.zeilen, 'Slot 2 wird gestartet'), 'A3 PT8: die freie Nummer 2 wird wieder vergeben');
  t.tippe('=1 16778241');
  assert(await bisZeile(t.zeilen, 'slot 1: starting (targetChanged)'), 'A3 PT8: =1 16778241 hängt Slot 1 um');
  t.tippe('=5 16778240');
  assert(await bisZeile(t.zeilen, 'Slot 5 laeuft nicht'), 'A3 PT8: =<Slot> auf einen Slot, der nicht läuft, wird gemeldet');
  assert(t.befehle().filter((b) => b.cmd === 'slotSet').map((b) => `${b.slot}:${b.id}`).join() === '1:16778241',
    'A3 PT8: ... und geht nicht an die Bridge (nur ein slotSet {slot:1, id:16778241})');
  t.tippe('liste');
  assert(await bisZeile(t.zeilen, 'Slots (2):') && (await bisZeile(t.zeilen, '    1  Ziel 16778241')), 'A3 PT8: liste zeigt Nummer, Ziel und Zustand je Slot');
  t.tippe('ende');
  assert((await t.lauf) === 0, 'A3 PT8: ende → Rückgabe 0');
}

console.log('\nA3 Konsole — der Rückkehr-Hinweis vergleicht normierte Namen (6.18, normName):');
{
  // Anna kommt als „anna “ zurück (klein, mit Leerzeichen): normiert derselbe Name, wörtlich ein anderer.
  const t = steuere({ FAKE_WIEDERBEITRITT_MS: '1000', FAKE_RUECKKEHR_NAME: 'anna ' }, { ZOOM_MEETING_ID: '1' });
  const imMeetingDa = await bisZeile(t.zeilen, 'Rohdaten-Erlaubnis: JA');
  t.tippe('+16778240');
  const hinweis = imMeetingDa && (await bisZeile(t.zeilen, 'Rückkehr? =1 16778250'));
  assert(hinweis && !t.zeilen.some((z) => z.includes('abonnieren mit +16778250')),
    'A3 PT8: „anna “ statt „Anna“: die Konsole nennt „Rückkehr? =1 16778250“ (normName: NFC, Leerraum, ohne Groß-/Kleinschreibung)');
  t.tippe('ende');
  await t.lauf;
}

console.log('\nA3 state — der Reducer kennt video und audio nicht mehr (6.18, Gliederung 3.4):');
{
  const s0 = run([{ ev: 'status', status: 'inMeeting', raw: 3, code: 0 }]);
  const s1 = reduce(s0, enrich({ ev: 'video', id: 7, state: 'live', source: 'X', reason: 'frames', rebindable: true } as WireEvent));
  const s2 = reduce(s1, enrich({ ev: 'audio', id: 7, state: 'live', reason: 'packets' } as WireEvent));
  assert(s1 === s0 && s2 === s0, 'A3 6.18: video- und audio-Ereignisse ändern nichts mehr (unbekannt)');
  assert(!('videoSubs' in s0) && !('audioSubs' in s0), 'A3 6.18: Session hat weder videoSubs noch audioSubs');
  assert(reduce(s0, enrich({ ev: 'wasAuchImmer', slot: 1 } as WireEvent)) === s0, 'A3 3.4: ein unbekanntes Ereignis ändert nichts, auch nicht an slots');
}

// --- Zoom-Slots, Plan A Block a2: Entscheidungslogik in C++ ohne SDK (Task A4) -------------------------
// Laufen ohne Compiler und ohne SDK (auch unter Linux). Was die Logik TUT, pruefen die C++-Faelle in
// native/*_test.cpp ueber `npm run logik-test`; hier steht nur, was ohne Compiler pruefbar ist: Namen gegen
// die Kataloge, Einbindungen, Rueckgabe 2 ohne Compiler und dass jede Testdatei in jedem Lauf steht.
import * as protokollA4 from '../src/protocol.ts';
import { spawnSync } from 'node:child_process';

/** Rohtext einer Datei des Pakets, '' wenn sie fehlt (dann FAIL statt Absturz). */
function paketDateiOderLeer(...teile: string[]): string {
  try {
    return readFileSync(join(testDir, '..', ...teile), 'utf8');
  } catch {
    return '';
  }
}
/** Zeichenketten einer Namens-Tabelle `NAME[n] = { "a", "b" }`; null, wenn sie fehlt. */
function namensTabelle(src: string, name: string): { n: number; namen: string[] } | null {
  const m = new RegExp(`\\b${name}\\[(\\d+)\\]\\s*=\\s*\\{([^}]*)\\}`).exec(src);
  if (!m) return null;
  return { n: Number(m[1]), namen: [...m[2].matchAll(/"([^"]*)"/g)].map((x) => x[1]) };
}
/** Werte von `enum class NAME : uint8_t { A, B }`, je mit kleinem Anfangsbuchstaben; null, wenn sie fehlt. */
function aufzaehlung(src: string, name: string): string[] | null {
  const m = new RegExp(`enum\\s+class\\s+${name}\\s*:\\s*uint8_t\\s*\\{([^}]*)\\}`).exec(src);
  if (!m) return null;
  return m[1].split(',').map((s) => s.trim()).filter((s) => s !== '').map((s) => s[0].toLowerCase() + s.slice(1));
}

console.log('\nZoom-Slots — slot_logic.h gegen protocol.ts (Plan A, Task A4; A-EP10):');
{
  const logik = cppOhneKommentare(paketDateiOderLeer('native', 'slot_logic.h'));
  const paare: [string, string, string, readonly string[]][] = [
    ['SlotMode', 'MODUS_NAMEN', 'SLOT_MODES', protokollA4.SLOT_MODES],
    ['Fallback', 'FALLBACK_NAMEN', 'SLOT_FALLBACKS', protokollA4.SLOT_FALLBACKS],
    ['SlotAudio', 'AUDIO_NAMEN', 'SLOT_AUDIO_SETTINGS', protokollA4.SLOT_AUDIO_SETTINGS],
    ['Sent', 'SENT_NAMEN', 'SLOT_SENT', protokollA4.SLOT_SENT],
    ['SlotState', 'ZUSTAND_NAMEN', 'SLOT_STATES', protokollA4.SLOT_STATES],
    ['Grund', 'GRUND_NAMEN', 'SLOT_REASONS', protokollA4.SLOT_REASONS],
    ['TonGrund', 'TONGRUND_NAMEN', 'SLOT_AUDIO_REASONS', protokollA4.SLOT_AUDIO_REASONS],
    ['TonQuelle', 'TONQUELLE_NAMEN', 'SLOT_AUDIO_SOURCES', protokollA4.SLOT_AUDIO_SOURCES],
    ['TonZustand', 'TONZUSTAND_NAMEN', 'AUDIO_STATES', protokollA4.AUDIO_STATES],
    ['Signal', 'SIGNAL_NAMEN', 'SPEAKER_SIGNALS', protokollA4.SPEAKER_SIGNALS],
  ];
  for (const [aufz, tabelle, katalogName, katalog] of paare) {
    const t = namensTabelle(logik, tabelle);
    assert(
      t !== null && t.n === katalog.length && JSON.stringify(t.namen) === JSON.stringify(katalog),
      `A4 ${tabelle} in slot_logic.h gleicht ${katalogName} (Zahl, Reihenfolge, Schreibweise)`,
    );
    assert(
      JSON.stringify(aufzaehlung(logik, aufz)) === JSON.stringify(katalog),
      `A4 enum class ${aufz} folgt ${katalogName} in derselben Reihenfolge`,
    );
  }
}
{
  // G-A2: die reine Logik bindet nur die C++-Standardbibliothek ein (kein windows.h, kein Zoom-, kein NDI-Header)
  // und liest keine Uhr: jede Zeit kommt als Argument von aussen, sonst waere sie im Logik-Test nicht pruefbar.
  // Darum sind auch <chrono> und <ctime> samt ihren Uhren verboten (Nachbesserung a2, NB-a2-3).
  const UHR = /<chrono>|<ctime>|\b(steady_clock|system_clock|high_resolution_clock|GetTickCount64|GetTickCount|QueryPerformanceCounter|timeGetTime)\b|\b(time|clock)\s*\(/g;
  for (const kopf of ['slot_logic.h', 'audio_mix.h']) {
    const text = cppOhneKommentare(paketDateiOderLeer('native', kopf));
    const einbindungen = [...text.matchAll(/#\s*include\s*([<"][^>"]*[>"])/g)].map((m) => m[1]);
    assert(
      einbindungen.length > 0 && einbindungen.every((e) => /^<[a-z_]+>$/.test(e)),
      `A4 ${kopf} bindet nur Standard-Header ein (G-A2)`,
    );
    if (einbindungen.some((e) => !/^<[a-z_]+>$/.test(e))) console.error(`      Einbindungen: ${einbindungen.join(', ')}`);
    const uhren = [...text.matchAll(UHR)].map((m) => m[0]);
    assert(uhren.length === 0, `A4 ${kopf} liest keine Uhr, die Zeit kommt von aussen (G-A2)`);
    if (uhren.length > 0) console.error(`      Uhr: ${uhren.join(', ')}`);
  }
}
{
  // Spec 11.1, A-EP16: ohne Compiler nie still gruen.
  const skript = join(testDir, '..', 'scripts', 'logik-test.mjs');
  const lauf = (wert: string) =>
    spawnSync(process.execPath, [skript], { encoding: 'utf8', env: { ...process.env, LOGIK_TEST_COMPILER: wert } });
  const ohne = lauf('keiner');
  assert(
    ohne.status === 2 && `${ohne.stdout}${ohne.stderr}`.includes('logik-test: kein C++-Compiler gefunden (g++, clang++, cl über vswhere).'),
    'A4 logik-test ohne Compiler: Rückgabe 2 und die Zeile „kein C++-Compiler gefunden“',
  );
  const falsch = lauf('gcc');
  assert(
    falsch.status === 2 && `${falsch.stdout}${falsch.stderr}`.includes('LOGIK_TEST_COMPILER muss g++, clang++, cl oder keiner sein (ist: gcc).'),
    'A4 logik-test mit unbekanntem LOGIK_TEST_COMPILER: Rückgabe 2 mit Hinweis',
  );
}
{
  // Jede Testdatei unter native/ laeuft in allen drei Wegen: logik-test (CI), CMake-Ziel und npm run slot-test.
  const skriptText = paketDateiOderLeer('scripts', 'logik-test.mjs');
  const cmake = paketDateiOderLeer('CMakeLists.txt');
  const slotTest = (JSON.parse(paketDateiOderLeer('package.json')) as { scripts: Record<string, string> }).scripts['slot-test'] ?? '';
  const tests = readdirSync(nativOrdner).filter((f) => f.endsWith('_test.cpp')).sort();
  assert(tests.length >= 2, 'A4 native/ enthält mindestens slot_logic_test.cpp und delay_line_test.cpp');
  for (const datei of tests) {
    const ziel = `${datei.replace(/_test\.cpp$/, '').replace(/_/g, '-')}-test`;
    assert(skriptText.includes(`'native/${datei}'`), `A4 ${datei} steht in scripts/logik-test.mjs (TESTDATEIEN)`);
    assert(new RegExp(`add_executable\\(${ziel} native/${datei}\\)`).test(cmake), `A4 ${datei} hat das CMake-Ziel ${ziel}`);
    assert(slotTest.includes(`--target`) && slotTest.includes(` ${ziel}`) && slotTest.includes(`build\\Release\\${ziel}.exe`),
      `A4 ${datei} läuft in npm run slot-test (Ziel und Programm)`);
  }
}
console.log('\nZoom-Slots — Freigabe-Namen in slot_logic.h (Plan A, Task A5; A-EP4):');
{
  const logik = cppOhneKommentare(paketDateiOderLeer('native', 'slot_logic.h'));
  const paare: [string, string, readonly string[]][] = [
    ['SHARE_TYP_NAMEN', 'SHARE_TYPE_NAMES', protokollA4.SHARE_TYPE_NAMES],
    ['SHARING_STATUS_NAMEN', 'SHARING_STATUS_NAMES', protokollA4.SHARING_STATUS_NAMES],
    ['BEFUELLT_NAMEN', 'shares.seeded (Gliederung 3.3)', ['ok', 'empty', 'unavailable']],
  ];
  for (const [tabelle, katalogName, katalog] of paare) {
    const t = namensTabelle(logik, tabelle);
    assert(
      t !== null && t.n === katalog.length && JSON.stringify(t.namen) === JSON.stringify(katalog),
      `A5 ${tabelle} in slot_logic.h gleicht ${katalogName} (Index = Wert im Header)`,
    );
  }
  assert(JSON.stringify(aufzaehlung(logik, 'Befuellt')) === JSON.stringify(['ok', 'leer', 'nichtVerfuegbar']),
    'A5 enum class Befuellt folgt BEFUELLT_NAMEN (Ok, Leer, NichtVerfuegbar)');
}
console.log('\nZoom-Slots — sent ohne Bild in der Attrappe (Plan A, Task A6; Tabelle 6.12, Nachbesserung a2):');
{
  // Ein Vertrag, zwei Umsetzungen: Was slot_logic.h fuer „kein Bild dieses Ziels“ entscheidet (pb16_kreuzprodukt),
  // meldet auch die Attrappe aus A2, gegen die Plan B prueft. Zwei Freigabe-Slots (weiss, eingefroren) erleben
  // Ziel 0, starting ohne Bild, live und das Ende der Freigabe (wieder Ziel 0, die Kopie gehoert dem alten Ziel).
  const ev = await fahreSteuerung({
    FAKE_FREIGABEN: `1000:${BEN}:101:begin,1000:${BEN}:101:typ=ds,2000:${BEN}:101:end`,
  }, async (b, ev) => {
    await imMeeting(b, ev);
    b.send(slotAn(3, 'JM Connect – Zoom Weiss', { mode: 'share', audio: 'off', fallback: 'white' }));
    b.send(slotAn(4, 'JM Connect – Zoom Eingefroren', { mode: 'share', audio: 'off', fallback: 'freeze' }));
    await bisEreignis(ev, () => anzahl(ev, art('slot', { slot: 4, reason: 'shareNone' })) === 2, 6000);
  });
  const sentFolge = (nr: number) => ev.filter(art('slot', { slot: nr })).map((e) => {
    const s = e as unknown as { state: string; reason: string; sent: string };
    return `${s.state}/${s.reason}:${s.sent}`;
  }).join(' ');
  assert(sentFolge(3) === 'fallback/shareNone:white starting/shareChanged:white live/frames:none fallback/shareNone:white off/command:none',
    'A6 6.12 Attrappe: ein weißer Freigabe-Slot sendet ohne Bild weiß, auch bei Ziel 0 nach dem Ende der Freigabe');
  assert(sentFolge(4) === 'fallback/shareNone:transparent starting/shareChanged:transparent live/frames:none fallback/shareNone:transparent off/command:none',
    'A6 6.12 Attrappe: „eingefroren“ ohne Kopie dieses Ziels sendet transparent, auch nach dem Ende der Freigabe');
}
console.log('\nNativer Teil — A9 NDI-Sender: UYVA, Weiß, Transparent, Kopie, ohne Versatz (Spec 6.12, 6.14):');
{
  const sender = nativ('ndi_sender.cpp');
  const uyva = rumpf(sender, 'void fillFrameUyva(');
  assert(/FourCC\s*=\s*NDIlib_FourCC_video_type_UYVA\b/.test(uyva) && /line_stride_in_bytes\s*=\s*2\s*\*\s*w\s*;/.test(uyva),
    'A9 UYVA: fillFrameUyva setzt NDIlib_FourCC_video_type_UYVA und line_stride_in_bytes = 2 * w');
  assert(rumpf(sender, 'void NdiSender::sendTransparentLocked(').includes('sendUYVALocked(')
      && rumpf(sender, 'void NdiSender::sendUYVALocked(').includes('fillFrameUyva('),
    'A9 UYVA: sendTransparentLocked sendet über sendUYVALocked und fillFrameUyva');
  const transparent = rumpf(sender, 'void fillTransparentUYVA(');
  assert(/static_cast<size_t>\(w\)\s*\*\s*h\s*\*\s*2/.test(transparent) && /uyvy\s*\+\s*static_cast<size_t>\(w\)\s*\*\s*h\s*,\s*0\)/.test(transparent),
    'A9 UYVA: Puffer = UYVY-Ebene (2 * B * H) + Alpha-Ebene (B * H), Alpha 0');
  assert(/static_cast<uint8_t>\(235\)/.test(rumpf(sender, 'void fillWhiteI420(')) && /static_cast<uint8_t>\(128\)/.test(rumpf(sender, 'void fillWhiteI420(')),
    'A9 Weiß: fillWhiteI420 füllt Y 235 und U/V 128');
  const i420 = rumpf(sender, 'void NdiSender::sendI420(');
  const iDirekt = i420.search(/if\s*\(\s*ohneVersatz_\s*\|\|/);
  assert(iDirekt >= 0 && i420.indexOf('pushFrame(') > iDirekt && i420.indexOf('return;', iDirekt) < i420.indexOf('pushFrame('),
    'A9 ohne Versatz: sendI420 sendet mit ohneVersatz_ direkt, vor jedem pushFrame');
  const ersatz = rumpf(sender, 'void NdiSender::sendErsatz(');
  const iErsatz = ersatz.search(/if\s*\(\s*ohneVersatz_\s*\|\|/);
  assert(iErsatz >= 0 && ersatz.indexOf('pushBild(') > iErsatz,
    'A9 ohne Versatz: sendErsatz sendet mit ohneVersatz_ direkt, vor jedem pushBild');
  const freigabe = rumpf(sender, 'int NdiSender::releaseDueLocked(');
  assert(freigabe.includes('versatzMsLocked()') && !freigabe.includes('ndiVideoDelayMs()'),
    'A9 ohne Versatz: releaseDueLocked rechnet mit versatzMsLocked(), nicht mit dem globalen Wert');
  assert(['Bildart::Schwarz', 'Bildart::Weiss', 'Bildart::Transparent'].every((a) => freigabe.includes(a)),
    'A9 Bildarten: die Warteschlange gibt Schwarz, Weiß und Transparent als eigene Bildart aus');
  const delay = nativ('delay_line.h');
  assert(!/\bbool\s+black\b/.test(delay) && !/\bpushBlack\s*\(/.test(delay) && !/\bpushBlack\s*\(|\.black\b/.test(sender),
    'A9 Bildarten: Frame::black und pushBlack sind entfernt, der Sender liest nur Frame::art');
  assert(/\bvoid\s+sendCopy\(\s*const\s+FrameCopy\s*&\s*c\s*\)\s*;/.test(nativ('ndi_sender.h'))
      && /std::lock_guard<std::mutex>\s+lock\(c\.m\)/.test(rumpf(sender, 'void NdiSender::sendCopy(')),
    'A9 Kopie: sendCopy(const FrameCopy&) hält die Sperre der Kopie über dem Senden');
}
console.log('\nNativer Teil — A10 Lauscher, Merker, Regler (Spec 6.5, 6.6 Nr. 4, PT6 a):');
// PT6 a als Verbotsliste (A-EP13): kein Rückruf ruft eine Renderer-Funktion, eine slot…- oder eine
// videoParticipant…-Funktion. Erlaubt bleiben SetEvent, emitRoster, checkPrivilege und alles Übrige von heute.
const RUECKRUF_VERBOTEN = /\b(subscribe|unSubscribe|setRawDataResolution|createRenderer|destroyRenderer)\s*\(|\bslot\w*\s*\(|\bvideoParticipant\w*\s*\(/;
/** Alle Methoden-Rümpfe `void Klasse::on…(…) {…}` einer Datei, als [Kopf, Rumpf]. */
function rueckrufRuempfe(src: string): Array<[string, string]> {
  const aus: Array<[string, string]> = [];
  const kopf = /\bvoid\s+(\w+)::(on\w+)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = kopf.exec(src)) !== null) aus.push([`${m[1]}::${m[2]}`, rumpf(src.slice(m.index), m[0])]);
  return aus;
}
{
  const cb = rueckrufRuempfe(nativ('callbacks.cpp', true));
  const vd = rueckrufRuempfe(nativ('video.cpp', true));
  const tonKlasse = rumpf(nativ('audio.cpp', true), 'class AudioDelegate');
  assert(cb.length >= 18 && vd.length >= 2 && tonKlasse.includes('onOneWayAudioRawDataReceived'),
    `A10 PT6 a: der Wächter findet die Rückruf-Rümpfe (callbacks.cpp ${cb.length} ≥ 18, Bild-Delegate ${vd.length} ≥ 2, Ton-Delegate)`);
  const verstoss = [...cb, ...vd, ['AudioDelegate', tonKlasse] as [string, string]]
    .filter(([, koerper]) => koerper === '' || RUECKRUF_VERBOTEN.test(koerper)).map(([name]) => name);
  assert(verstoss.length === 0,
    'A10 PT6 a: kein Rückruf ruft subscribe, unSubscribe, setRawDataResolution, createRenderer, destroyRenderer, slot…() oder videoParticipant…()');
  if (verstoss.length > 0) console.error(`      Verstoß in: ${verstoss.join(', ')}`);
  const cbSrc = nativ('callbacks.cpp', true);
  assert(!/\bvideo\w*\s*\(/.test(rumpf(cbSrc, 'void ParticipantsListener::onUserJoin('))
      && !/\bvideo\w*\s*\(/.test(rumpf(cbSrc, 'void ParticipantsListener::onUserLeft('))
      && /merkerEinreihen\(\s*g_merkerTeilnehmer/.test(rumpf(cbSrc, 'void ParticipantsListener::onUserLeft(')),
    'A10 E6: onUserJoin und onUserLeft rufen keine video…-Funktion, sie reihen nur einen Merker ein');
  const neue = ['ShareListener::', 'VideoCtrlListener::', 'AudioCtrlListener::'];
  const neueRuempfe = cb.filter(([name]) => neue.some((n) => name.startsWith(n)));
  assert(neueRuempfe.length === 11 && neueRuempfe.every(([, koerper]) => !/\bemitRaw\s*\(/.test(koerper)),
    'A10 E21: die 11 ausprogrammierten Methoden der drei neuen Lauscher reihen ein oder schreiben stderr, nie stdout');
}
{
  const kopf = nativ('callbacks.h');
  const stelle = (s: string) => kopf.indexOf(s);
  const iWin = stelle('#include <windows.h>');
  const iMsi = stelle('#include "meeting_service_interface.h"');
  const iNeu = ['meeting_sharing_interface.h', 'meeting_video_interface.h', 'meeting_audio_interface.h']
    .map((h) => stelle(`#include "meeting_service_components/${h}"`));
  assert(iWin >= 0 && iMsi > iWin && iNeu.every((i) => i > iMsi),
    'A10 B43: callbacks.h bindet windows.h, dann meeting_service_interface.h, erst danach Freigabe-, Video- und Ton-Header ein');
  const anzahl = (klasse: string) => (rumpf(kopf, `class ${klasse} : public`).match(/\boverride\b/g) ?? []).length;
  assert(anzahl('ShareListener') === 9 && anzahl('VideoCtrlListener') === 12 && anzahl('AudioCtrlListener') === 5,
    'A10 B41: ShareListener 9, VideoCtrlListener 12, AudioCtrlListener 5 Methoden (override, ohne #if)');
  assert(/constexpr\s+size_t\s+kMerkerMax\s*=\s*1024\s*;/.test(kopf)
      && /if\s*\(\s*q\.size\(\)\s*>=\s*kMerkerMax\s*\)\s*\{\s*g_merkerVerworfen\.fetch_add\(1\);\s*return;/.test(rumpf(nativ('callbacks.cpp'), 'void merkerEinreihen(')),
    'A10 B20: je Merker-Warteschlange höchstens 1024 Einträge, Überlauf zählt merkerVerworfen');
}
{
  const ses = nativ('session.cpp', true);
  const abbau = rumpf(ses, 'bool sessionShutdown()');
  assert(['shareCtrl', 'videoCtrl', 'audioCtrl']
    .every((g) => new RegExp(`(\\w+)\\s*=\\s*${g}\\(\\);\\s*if\\s*\\(\\s*\\1\\s*!=\\s*nullptr\\s*\\)\\s*\\1->SetEvent\\(nullptr\\)`).test(abbau)),
    'A10 6.5: sessionShutdown meldet die drei neuen Lauscher mit SetEvent(nullptr) ab');
  assert(/sessionRegisterCtrlListeners\(\s*\)\s*;[\s\S]*g_inMeetingOffen\s*=\s*true/.test(rumpf(nativ('callbacks.cpp', true), 'void MeetingListener::onMeetingStatusChanged(')),
    'A10 6.5: INMEETING meldet die drei Lauscher an und setzt den Merker g_inMeetingOffen');
  const alle = readdirSync(nativOrdner).filter((f) => f.endsWith('.cpp')).map((f) => nativ(f, true)).join('\n');
  assert(!/\b(EnableHDVideo|EnableAlwaysUseOriginalSizeVideo)\s*\(/.test(alle) && /CreateSettingService\(/.test(ses),
    'A10 6.11: der Einstellungsdienst wird nur gelesen (kein EnableHDVideo, kein EnableAlwaysUseOriginalSizeVideo)');
  // 6.11/6.19 „nur lesend“ als Positivliste (Nachbesserung a3, NB-a3-6): Die Verbotsliste oben kennt zwei Setter,
  // der Einstellungsdienst hat Dutzende (EnableAlwaysShowNameOnVideo, EnableFaceBeautyEffect …). Ob das SDK eine
  // Einstellung über das Meeting hinaus am Rechner speichert, belegt kein Header (unbelegt) - darum gar keiner.
  const fremd = readdirSync(nativOrdner).filter((f) => /\.(cpp|h)$/.test(f) && f !== 'session.cpp' && f !== 'session.h')
    .filter((f) => /\b(g_settings|ISettingService|IVideoSettingContext|GetVideoSettings)\b/.test(nativ(f, true)));
  const dienst = [...ses.matchAll(/\bg_settings\s*->\s*(\w+)\s*\(/g)].map((m) => m[1]);
  const kontext = [...ses.matchAll(/\bIVideoSettingContext\s*\*\s*(\w+)\s*=/g)].flatMap((m) => {
    const ende = ses.indexOf('\n}', m.index);
    const stueck = ses.slice(m.index, ende < 0 ? ses.length : ende);
    return [...stueck.matchAll(new RegExp(`\\b${m[1]}\\s*->\\s*(\\w+)\\s*\\(`, 'g'))].map((n) => n[1]);
  });
  const nurLesend = fremd.length === 0 && dienst.length > 0 && dienst.every((a) => a === 'GetVideoSettings')
    && kontext.length > 0 && kontext.every((a) => /^Is[A-Z]/.test(a));
  assert(nurLesend,
    'A10 6.11: Positivliste - g_settings ruft nur GetVideoSettings(), der Video-Kontext nur Is…-Getter, beides nur in session.cpp');
  if (!nurLesend) console.error(`      g_settings: ${dienst.join(', ') || '(keiner)'}; Video-Kontext: ${kontext.join(', ') || '(keiner)'}; außerhalb von session.cpp: ${fremd.join(', ') || '(keine)'}`);
  const main = nativ('main.cpp', true);
  const schleife = main.slice(Math.max(0, main.indexOf('while (!g_quit) {')));
  const iEntzug = schleife.indexOf('callbacksTakePrivilegeRevokedTeardown(');
  const iMerker = schleife.indexOf('merkerNehmen(');
  const iTakt = schleife.search(/\b(videoTick|slotsTick)\(/);
  assert(iEntzug >= 0 && iMerker > iEntzug && iTakt > iMerker,
    'A10 6.6: die Hauptschleife nimmt die Merker nach dem Entzug und vor dem Herzschlag');
  const nehmen = rumpf(main, 'void merkerNehmen()');
  assert(nehmen.indexOf('callbacksTakeInMeeting(') >= 0 && nehmen.indexOf('callbacksTakeInMeeting(') < nehmen.indexOf('callbacksTakeTeilnehmer(')
      && /slotsInMeeting\(\)/.test(nehmen),
    'A10 6.6 Nr. 4: zuerst INMEETING (Kette mit eigener Kennung neu, A14), dann die Teilnehmer');
}
console.log('\nNativer Teil — A11 Slot-Verwaltung, Befehle, Umhängen (Spec 6.1, 6.2, 6.10, G-A3):');
{
  const video = nativ('video.cpp', true);
  // G-A3: jede Renderer-Funktion steht nur in den Ausführern (Umhängen: planAusfuehren,
  // subscribeAusfuehren, rendererAnlegen; Abbau: slotsAbbauAlle bis A14).
  const erlaubt = ['void planAusfuehren(Slot& s, UmhaengLauf& lauf, const UmhaengPlan& plan) ', 'void subscribeAusfuehren(Slot& s, UmhaengLauf& lauf)', 'SDKError rendererAnlegen(', 'void abbauAusfuehren(']
    .map((kopf) => {
      const start = video.indexOf(kopf);
      const koerper = rumpf(video, kopf);
      return start < 0 || koerper === '' ? [-1, -1] : [video.indexOf(koerper, start), video.indexOf(koerper, start) + koerper.length];
    });
  const aufruf = /\b(subscribe|unSubscribe|setRawDataResolution|createRenderer|destroyRenderer)\s*\(/g;
  const ausserhalb: number[] = [];
  let gefunden = 0;
  let m: RegExpExecArray | null;
  while ((m = aufruf.exec(video)) !== null) {
    gefunden++;
    if (!erlaubt.some(([von, bis]) => m!.index > von && m!.index < bis)) ausserhalb.push(video.slice(0, m.index).split('\n').length);
  }
  assert(erlaubt.every(([von]) => von >= 0) && gefunden >= 7,
    `A11 G-A3: der Wächter findet die Ausführer und die Renderer-Aufrufe in video.cpp (${gefunden} ≥ 7)`);
  assert(ausserhalb.length === 0,
    'A11 G-A3: subscribe, unSubscribe, setRawDataResolution, createRenderer, destroyRenderer stehen nur in den Ausführern');
  if (ausserhalb.length > 0) console.error(`      außerhalb in video.cpp, Zeilen ${ausserhalb.join(', ')}`);
  assert((video.match(/\bcreateRenderer\s*\(/g) ?? []).length === 1 && rumpf(video, 'SDKError rendererAnlegen(').includes('createRenderer('),
    'A11 6.2/6.10: createRenderer steht genau einmal, in rendererAnlegen');
  const alle = readdirSync(nativOrdner).filter((f) => /\.(cpp|h)$/.test(f)).map((f) => nativ(f, true)).join('\n');
  const reste = ['g_subs', 'teilnehmerWeg', 'reboundByName', 'uniqueSourceName', 'videoParticipantJoined', 'videoParticipantLeft',
    'videoSubscribe', 'videoUnsubscribe', 'sessionCountParticipantsByName'].filter((n) => new RegExp(`\\b${n}\\b`).test(alle));
  assert(reste.length === 0, 'A11 6.18: kein g_subs, teilnehmerWeg, rebound…, uniqueSourceName, videoSubscribe/-Unsubscribe mehr im nativen Code');
  if (reste.length > 0) console.error(`      noch da: ${reste.join(', ')}`);
  const bild = rumpf(video, 'void Delegate::onRawDataFrameReceived(');
  assert(bild.includes('bildAnkunft(') && !/\bsender\s*\./.test(bild) && !/\bsend\w*\s*\(/.test(bild),
    'A11 0.30: der Bild-Delegate gibt jedes Bild an Slot::bildAnkunft, nie direkt an den Sender');
  const ankunft = rumpf(video, 'void Slot::bildAnkunft(');
  const iRiegel = ankunft.search(/riegelVerwirft\(\s*abo\.subscribed\.load\(\)\s*,\s*abo\.umhaengen\.load\(\)\s*\)/);
  assert(iRiegel >= 0 && iRiegel < ankunft.indexOf('sendI420(') && /lateFrames\.fetch_add\(1\)/.test(ankunft),
    'A11 6.10: der Riegel verwirft Bilder ohne subscribed oder während des Umhängens vor dem Senden und zählt lateFrames');
  // 6.10 „Erstes Bild danach“ (Nachbesserung a3, NB-a3-1): bildSeitUmhaengen und live/frames am ERSTEN Bild, das den
  // Riegel passiert - über bildAnnehmen() aus A6 (PB23), nie an GetSourceID() gebunden. Die Lücke (gapMs, MS13) endet
  // getrennt davon am ersten passenden Bild, sonst nach 2 s am ersten Bild nach Schritt 6 (gapUngeprueft).
  assert(/\bif\s*\(\s*bildAnnehmen\(\s*z\s*,\s*w\s*,\s*h\s*,\s*jetzt\s*\)\s*\)\s*gapErstesBildMs\s*=\s*jetzt\s*;/.test(ankunft)
      && !/bildSeitUmhaengen\s*=/.test(ankunft)
      && /if\s*\(\s*gapOffen\s*&&\s*\(\s*passt\s*\|\|\s*jetzt\s*-\s*z\.retargetMs\s*>=\s*2000\s*\)\s*\)/.test(ankunft)
      && /gapMs\s*=\s*\(\s*passt\s*\?\s*jetzt\s*:\s*gapErstesBildMs\s*\)\s*-\s*z\.retargetMs\s*;/.test(ankunft)
      && /gapUngeprueft\s*=\s*!passt\s*;/.test(ankunft)
      && /s\.gapOffen\s*=\s*true\s*;/.test(rumpf(video, 'void planAusfuehren(Slot& s, UmhaengLauf& lauf, const UmhaengPlan& plan) ')),
    'A11 6.10 erstes Bild: bildAnkunft ruft bildAnnehmen (live/frames ohne GetSourceID); die Lücke endet am ersten passenden Bild, sonst nach 2 s am ersten Bild (gapUngeprueft)');
  // E3 (6.10 „Der Sender bleibt in jedem Fall“; Nachbesserung a3, NB-a3-4): ein Sender je Slot. sender.open steht genau
  // einmal (slotOn), sender.close nur im Fehlerpfad von slotOn und im Abbau (slotsAbbauAlle bis A14, abbauAusfuehren
  // ab A14) - kein Wechsel von Modus, Ziel, Auflösung, Sprecher oder Freigabe öffnet ihn neu.
  const stelleIn = (kopf: string, i: number): boolean => {
    const start = video.indexOf(kopf);
    const koerper = start < 0 ? '' : rumpf(video, kopf);
    const anfang = koerper === '' ? -1 : video.indexOf(koerper, start);
    return anfang >= 0 && i > anfang && i < anfang + koerper.length;
  };
  const oeffnen = [...video.matchAll(/\bsender\.open\s*\(/g)].map((t) => t.index ?? -1);
  const schliessen = [...video.matchAll(/\bsender\.close\s*\(/g)].map((t) => t.index ?? -1);
  const senderOrte = ['void slotOn(const SlotBefehl& b)', 'void slotsAbbauAlle(', 'void abbauAusfuehren('];
  const einSender = oeffnen.length === 1 && stelleIn('void slotOn(const SlotBefehl& b)', oeffnen[0])
    && schliessen.length > 0 && schliessen.every((i) => senderOrte.some((k) => stelleIn(k, i)));
  assert(einSender, 'A11 E3: ein Sender je Slot - sender.open genau einmal (slotOn), sender.close nur im Fehlerpfad von slotOn und im Abbau');
  if (!einSender) console.error(`      sender.open in Zeile ${oeffnen.map((i) => video.slice(0, i).split('\n').length).join(', ') || '(keiner)'}; sender.close in Zeile ${schliessen.map((i) => video.slice(0, i).split('\n').length).join(', ') || '(keiner)'}`);
  // 6.2 (Nachbesserung a3, NB-a3-3): Ohne Meeting sieht kein Prüfstand, was im Slot ankommt - der Wächter hält fest,
  // dass slotOn jedes gelesene Feld übernimmt und slotSet jedes gesetzte.
  const anRumpf = rumpf(video, 'void slotOn(const SlotBefehl& b)');
  const setRumpf = rumpf(video, 'void slotSet(const SlotAenderung& a)');
  assert(['ndi', 'mode', 'res', 'audio', 'shareAudio', 'fallback', 'showNoVideo'].every((f) => new RegExp(`\\bs\\.${f}\\s*=\\s*b\\.${f}\\s*;`).test(anRumpf))
      && /if\s*\(\s*a\.fallbackGesetzt\s*\)\s*\{?\s*s\.fallback\s*=\s*a\.fallback\s*;/.test(setRumpf)
      && /if\s*\(\s*a\.showNoVideoGesetzt\s*\)\s*\{?\s*s\.showNoVideo\s*=\s*a\.showNoVideo\s*;/.test(setRumpf)
      && /\bs\.audio\s*=\s*audio\s*;/.test(setRumpf) && /\bs\.shareAudio\s*=\s*share\s*;/.test(setRumpf)
      // je Umhäng-Zweig einmal: Modus, Ziel, Auflösung; seit Nachtrag N2a.6 auch Sprecher nach showNoVideo
      && (setRumpf.match(/\bs\.res\s*=\s*a\.res\s*;/g) ?? []).length === 4,
    'A11 6.2: slotOn übernimmt jedes gelesene Feld in den Slot, slotSet jedes gesetzte (ohne Meeting nur so prüfbar)');
  const tot = rumpf(video, 'void Delegate::onRendererBeDestroyed(');
  assert(/rendererTot\.exchange\(true\)/.test(tot) && /rendererLost\.fetch_add\(1\)/.test(tot) && !RUECKRUF_VERBOTEN.test(tot),
    'A11 6.5: onRendererBeDestroyed setzt nur rendererTot und zählt rendererLost');
  const bau = rumpf(video, 'void slotRetargetIntern(');
  const iRiegelAn = bau.indexOf('abo.umhaengen = true');
  assert(iRiegelAn >= 0 && iRiegelAn < bau.indexOf('planAusfuehren(') && bau.lastIndexOf('abo.umhaengen = false') > bau.indexOf('planAusfuehren('),
    'A11 6.10 Schritt 1: der Riegel steht vor dem Ausführen des Plans und fällt erst danach');
}
{
  // Verträge aus A7 (Block a2, E-a2-7, E-a2-8): Hilfsfelder altesZiel, rendererGescheitert, tonFolge; tonAboNoetig.
  const video = nativ('video.cpp');
  assert(/l\.altesZiel\s*=\s*abo\.target\.load\(\)\s*;/.test(rumpf(video, 'UmhaengLage lageFuer(')),
    'A11 E-a2-7: lageFuer setzt altesZiel aus dem bisherigen Ziel (neue Auflösung ohne Zielwechsel: der Ton bleibt)');
  const ausf = rumpf(video, 'void planAusfuehren(Slot& s, UmhaengLauf& lauf, const UmhaengPlan& plan) ');
  assert((ausf.match(/lauf\.lage\.rendererGescheitert\s*=\s*true;\s*lauf\.sdkFehler\s*=\s*static_cast<int>\(err\);\s*planAusfuehren\(s,\s*lauf,\s*umhaengNachSubscribe\(lauf\.lage,/g) ?? []).length === 2,
    'A11 E-a2-7: scheitert createRenderer (neuer Delegate nach rendererTot oder beim Typwechsel), führt der Ausführer umhaengNachSubscribe mit rendererGescheitert aus');
  const iFehler = ausf.indexOf('case UmhaengSchritt::FehlerSubscribeMelden:');
  const fehler = iFehler < 0 ? '' : ausf.slice(iFehler, ausf.indexOf('break;', iFehler));
  assert(fehler.includes('slotSubscribeFailed') && /\\"sdk\\":"\s*\+\s*std::to_string\(lauf\.sdkFehler\)/.test(fehler)
      && /lauf\.sdkFehler\s*=\s*static_cast<int>\(err\)/.test(rumpf(video, 'void subscribeAusfuehren(Slot& s, UmhaengLauf& lauf)')),
    'A11 3.3: slotSubscribeFailed trägt sdk (Rückgabe von subscribe bzw. createRenderer)');
  assert(/plan\.tonFolge\[tonNr\+\+\]/.test(ausf)
      && (video.match(/for \(const TonMeldung& m : tp\.tonFolge\) tonMelden\(s, m\.zustand, m\.grund\);/g) ?? []).length === 2
      && (video.match(/tonAboNoetig\(l, aenderung\)/g) ?? []).length === 2,
    'A11 E-a2-7/E-a2-8: Ton-Meldungen kommen aus tonFolge in Reihenfolge; slotOn und slotSet fragen tonAboNoetig()');
}
{
  const main = nativ('main.cpp');
  const zweig = rumpf(main, 'if (cmd == "slotOn")');
  const iZeile = zweig.indexOf('emitLog(L"Befehl gelesen: slotOn "');
  // Reihenfolge nach Spec 6.2 (Nachbesserung a1): slotNameTaken direkt nach slotBadName, und nur gegen ANDERE
  // laufende Slots (slotNameBelegt bekommt die eigene Nummer und uebergeht sie).
  const pruef = ['leseSlotNummer(', '"slotBadName"', '"slotNameTaken"', '"slotBadMode"', '"slotBadResolution"', '"slotBadAudio"',
    '"slotBadFallback"', '"slotBadFlag"', '"slotBadTarget"', '"slotAlreadyOn"'].map((s) => zweig.indexOf(s));
  const belegt = rumpf(nativ('video.cpp'), 'bool slotNameBelegt(');
  assert(pruef.every((i, k) => i >= 0 && (k === 0 || i > pruef[k - 1])) && iZeile > pruef[pruef.length - 1] && zweig.indexOf('slotOn(b)') > iZeile
      && /slotNameBelegt\(b\.ndi,\s*nr\)/.test(zweig) && /nr\s*!=\s*ausser\s*&&/.test(belegt),
    'A11 3.2: slotOn prüft 1.–7. in dieser Reihenfolge, schreibt dann die stderr-Zeile und erst danach slotOn() (Sperre, Erlaubnis)');
  assert(!/\b(ndi|ndiName|source)\b/.test(zweig.slice(iZeile, zweig.indexOf(';', iZeile))),
    'A11 0.23: die stderr-Zeile „Befehl gelesen: slotOn …“ trägt keinen NDI-Namen');
  // Nachbesserung a3 (NB-a3-3): Die zweite Zeile „Felder gelesen: …“ trägt die gelesenen Werte (Auflösung, Ersatzbild,
  // Computerton, ohne Kamera, Ziel; bei slotSet jedes gesetzte Feld). command-probe und bool-probe vergleichen sie ohne
  // Meeting mit dem Gesendeten. Sie steht nach der Feldprüfung, vor slotOn()/slotSet(), ohne NDI-Namen (0.23).
  const setZweig = rumpf(main, 'if (cmd == "slotSet")');
  const iFelderAn = zweig.indexOf('emitLog(L"Felder gelesen: slotOn "');
  const iFelderSet = setZweig.indexOf('emitLog(L"Felder gelesen: slotSet "');
  assert(iZeile >= 0 && iFelderAn > iZeile && zweig.indexOf('slotOn(b)') > iFelderAn
      && iFelderSet > setZweig.indexOf('"slotBadTarget"') && setZweig.indexOf('"slotBadTarget"') >= 0 && setZweig.indexOf('slotSet(a)') > iFelderSet
      && !/\b(ndi|ndiName|source)\b/.test(zweig.slice(iFelderAn, zweig.indexOf('slotOn(b)')) + setZweig.slice(iFelderSet, setZweig.indexOf('slotSet(a)'))),
    'A11 0.23: die Zeilen „Felder gelesen: slotOn/slotSet …“ stehen nach der Feldprüfung, vor slotOn()/slotSet(), ohne NDI-Namen');
}

console.log('\nA11 Attrappe — E3: der NDI-Name eines Slots bleibt über jeden Wechsel (Drehbuch „Slots“, Nachbesserung a3):');
{
  // Plan B prüft gegen die Attrappe: Sie muss wie die EXE (Wächter „A11 E3“) den Sender und seinen Namen über
  // Sprecher-, Modus-, Freigabe-, Ziel- und Auflösungswechsel behalten. Grün schon vor dem Code dieser Aufgabe,
  // weil er die Attrappe aus A2 prüft.
  const namen: Record<number, string> = { 1: 'JM Connect – Zoom Anna', 2: 'JM Connect – Zoom Sprecher', 3: 'JM Connect – Zoom Freigabe' };
  const ev = await fahreSteuerung({ FAKE_SCRIPT: 'slots' }, async (b, ev) => {
    await imMeeting(b, ev);
    b.send(slotAn(1, namen[1], { id: ANNA, resolution: '360p', fallback: 'black' }));
    b.send(slotAn(2, namen[2], { mode: 'speaker', audio: 'mix', shareAudio: true }));
    b.send(slotAn(3, namen[3], { mode: 'share', audio: 'mix', shareAudio: true }));
    await bisEreignis(ev, art('slot', { slot: 1, state: 'live' }));
    b.send({ cmd: 'slotSet', slot: 1, resolution: '720p' });
    await bisEreignis(ev, () => anzahl(ev, art('slot', { slot: 3, share: 101, state: 'live' })) === 2, 6000);
    b.send({ cmd: 'slotSet', slot: 2, mode: 'share' });
    await bisEreignis(ev, art('left', { id: ANNA }), 3000);
    await bisEreignis(ev, art('joined'), 3000);
    await warte(100);
    b.send({ cmd: 'slotSet', slot: 1, id: ANNA_NEU });
    await bisEreignis(ev, () => anzahl(ev, art('slot', { state: 'off', reason: 'privilegeRevoked' })) === 3, 4000);
  });
  const slotEv = ev.filter(art('slot')) as unknown as Array<{ slot: number; reason: string; ndi?: string }>;
  const gruende = new Set(slotEv.map((e) => e.reason));
  const abweichend = slotEv.filter((e) => e.ndi !== namen[e.slot]);
  const alleWechsel = ['speakerChanged', 'modeChanged', 'shareChanged', 'targetChanged', 'resolutionChanged', 'participantLeft', 'cameraOff']
    .every((g) => gruende.has(g));
  assert(alleWechsel && abweichend.length === 0,
    'A11 E3 (Attrappe): jedes slot-Ereignis trägt den NDI-Namen aus slotOn, über Sprecher-, Modus-, Freigabe-, Ziel- und Auflösungswechsel');
  if (!alleWechsel || abweichend.length > 0) console.error(`      Gründe: ${[...gruende].join(', ')}; abweichend: ${abweichend.map((e) => `${e.slot}/${e.reason}`).join(', ') || '(keins)'}`);
}
console.log('\nNativer Teil — A12 Sprecher, Freigabe, Moduswechsel, ohne Versatz (Spec 6.6 Nr. 5, 6.8, 6.9, 6.14):');
{
  const main = nativ('main.cpp', true);
  const schleife = main.slice(Math.max(0, main.indexOf('while (!g_quit) {')));
  const iMerker = schleife.indexOf('merkerNehmen(');
  const iLogik = schleife.indexOf('slotLogicTick(');
  const iTakt = schleife.indexOf('slotsTick(');
  assert(iMerker >= 0 && iLogik > iMerker && iTakt > iLogik,
    'A12 6.6: slotLogicTick steht zwischen dem Merker-Schritt und slotsTick');
  // Die Zeit wird eingespeist (G-A2): jeder Aufruf bekommt die Bridge-Uhr, keine feste Zahl (Nachbesserung a2, NB-a2-3).
  const zeiten = [...main.matchAll(/slotLogicTick\(([^;]*)\);/g)].map((m) => m[1].replace(/\s+/g, ''));
  assert(zeiten.length > 0 && zeiten.every((z) => z === 'static_cast<int64_t>(GetTickCount64())' || z === 'jetztMs()'),
    'A12 6.6 Nr. 5: slotLogicTick bekommt die Bridge-Uhr (GetTickCount64 bzw. jetztMs), keine feste Zeit');
  if (zeiten.some((z) => z !== 'static_cast<int64_t>(GetTickCount64())' && z !== 'jetztMs()')) console.error(`      Aufrufe: ${zeiten.join(', ')}`);
  const nehmen = rumpf(main, 'void merkerNehmen()');
  assert(/callbacksTakeKamera\(&k\)\)\s*slotsKamera\(/.test(nehmen) && /callbacksTakeFreigabe\(&f\)\)\s*slotsFreigabe\(/.test(nehmen)
      && /callbacksTakeSprecher\(&s\)\)\s*slotsSprecher\(/.test(nehmen) && nehmen.indexOf('slotsInMeeting(') > nehmen.indexOf('callbacksTakeInMeeting('),
    'A12 6.6 Nr. 4: Kamera, Freigaben und Sprecher-Signale gehen aus der Hauptschleife an die Slot-Logik, INMEETING an slotsInMeeting');
  const sprecher = rumpf(nativ('main.cpp'), 'if (cmd == "speakerConfig")');
  assert(sprecher.includes('"speakerBadSignal"') && sprecher.includes('"speakerBadHold"') && sprecher.includes('kSpeakerHoldMaxMs')
      && !/sessionCanRecordRaw|g_sdkInitialized/.test(sprecher),
    'A12 6.2: speakerConfig prüft Signal und Haltezeit (bis kSpeakerHoldMaxMs) und braucht kein init');
}
{
  const video = nativ('video.cpp', true);
  const plan = rumpf(video, 'void planAusfuehren(Slot& s, UmhaengLauf& lauf, const UmhaengPlan& plan) ');
  const fall = (schritt: string) => {
    const i = plan.indexOf(`case UmhaengSchritt::${schritt}:`);
    return i < 0 ? '' : plan.slice(i, plan.indexOf('break;', i));
  };
  assert(/s\.sender\.setOhneVersatz\(\s*lauf\.lage\.modusNachher\s*==\s*SlotMode::Share\s*\)/.test(fall('OhneVersatzSetzen')),
    'A12 6.14: Freigabe-Slots setzen am Sender „ohne Versatz“ (Schritt OhneVersatzSetzen)');
  assert(/s\.sender\.leereVersatz\(\)/.test(fall('VersatzLeeren')),
    'A12 6.14: ein Moduswechsel von oder zur Freigabe leert die Versatz-Warteschlange (Schritt VersatzLeeren)');
  const ziel = rumpf(video, 'unsigned zielNachModus(');
  assert(/vorbelegen\(\s*g_erinnerung/.test(ziel) && /g_freigaben\.gezeigt\(\)/.test(ziel) && /freigabenBefuellen\(\s*true\s*\)/.test(ziel),
    'A12 6.8/6.9: das Ziel nach Modus kommt aus der vorbelegten SprecherWahl bzw. der gezeigten Freigabe; der erste Freigabe-Slot befüllt nur ergänzend');
  const folgen = rumpf(video, 'void freigabeFolgen()');
  assert(/Grund::shareChanged/.test(folgen) && /Grund::shareNone/.test(folgen) && /slotRetarget\(/.test(folgen) && /lage\.freigabePausiert\s*=\s*dieseFreigabe\s*&&\s*gezeigt->paused\s*;/.test(rumpf(video, 'void ersatzbildTick(')),
    'A12 6.9: alle Freigabe-Slots folgen der gezeigten Freigabe (shareChanged bzw. shareNone), der Herzschlag sieht ihre Pause');
  // Seit A14: die Kette InMeetingErneut nach abbauPlan (Ausfuehrer und alleNeuZuordnen).
  const neu = /abbauAusfuehren\(\s*Kette::InMeetingErneut/.test(rumpf(video, 'void slotsInMeeting()'))
    ? rumpf(video, 'void abbauAusfuehren(') + rumpf(video, 'void alleNeuZuordnen()') : '';
  assert(['g_erinnerung.leeren()', 'g_freigaben.leeren()', 'freigabenBefuellen(false)', 'Grund::noTarget', 'Grund::speakerNone']
    .every((s) => neu.includes(s)),
    'A12 6.15: INMEETING leert Erinnerung und Freigaben, befüllt neu; Teilnehmer noTarget, Sprecher speakerNone');
  const weg = rumpf(video, 'void slotsParticipantLeft(');
  assert(/g_erinnerung\.entferne\(id\)/.test(weg) && /g_freigaben\.weggang\(id\)/.test(weg) && /->weggang\(id,/.test(weg),
    'A12 6.8 Nr. 6 / 6.9: ein Weggang entfernt die Kennung aus Erinnerung, Freigaben und Sprecher-Wahl');
}
console.log('\nNativer Teil — A13 Vorschau (Spec 6.16, PT6 e):');
{
  const dateien = readdirSync(nativOrdner).filter((f) => /\.(cpp|h)$/.test(f));
  // PT6 e: das Ereignis "preview" gibt nur preview.cpp aus (im C++-Text maskiert als \"preview\").
  const mitPreview = dateien.filter((f) => nativ(f).includes('\\"preview\\"'));
  assert(mitPreview.length === 1 && mitPreview[0] === 'preview.cpp',
    `A13 PT6 e: „preview“ wird nur in native/preview.cpp ausgegeben (gefunden in: ${mitPreview.join(', ') || 'keiner'})`);
  const vorschau = nativ('preview.cpp', true);
  assert(vorschau.length > 0 && !/\bg_slots\b/.test(vorschau) && !/#include\s+"video\.h"/.test(nativ('preview.cpp')),
    'A13 PT6 e: native/preview.cpp liest g_slots nicht (und bindet video.h nicht ein)');
  const video = nativ('video.cpp', true);
  const ankunft = rumpf(video, 'void Slot::bildAnkunft(');
  // Seit Nachtrag N2a.1 bekommt vorschauBild das Ziel, das der Rückruf VOR dem Riegel las (aboZiel).
  assert(/vorschauBild\(\s*nr\s*,\s*(abo\.target\.load\(\)|aboZiel)\s*,\s*buf\s*,/.test(ankunft) && !rumpf(video, 'void ersatzbildTick(').includes('vorschauBild('),
    'A13 E16: Vorschau nur aus echten Bildern (bildAnkunft), nie aus dem Ersatzbild-Herzschlag');
  assert(/vorschauAnmelden\(\s*b\.nr\s*\)/.test(rumpf(video, 'void slotOn(const SlotBefehl& b)'))
      && /case UmhaengSchritt::VorschauPlatzLeeren:\s*vorschauLeeren\(\s*s\.nr\s*\)/.test(video),
    'A13 6.16: slotOn meldet den Vorschau-Platz an, das Umhängen leert ihn');
  const ende = rumpf(nativ('preview.cpp', true), 'void vorschauBild(');
  assert(/p->m\.try_lock\(\)/.test(ende) && /jetzt\s*-\s*p->letzteMs\s*<\s*500/.test(ende) && /kMaxB\s*=\s*192/.test(vorschau) && /kMaxH\s*=\s*108/.test(vorschau),
    'A13 6.16: Verkleinern per try_lock, höchstens alle 500 ms, in 192 × 108 eingepasst');
  const main = nativ('main.cpp', true);
  // Seit A14 beendet der Schritt VorschauThreadEnde der Kette quit/EOF den Thread (Reihenfolge PB20).
  assert(/case AbbauSchritt::VorschauThreadEnde:\s*vorschauThreadEnde\(\)/.test(video) && main.lastIndexOf('slotsShutdownAll(') < main.lastIndexOf('sessionShutdown('),
    'A13 6.15: quit/EOF beendet den Vorschau-Thread im Abbau-Plan, vor sessionShutdown');
  assert(/CoInitializeEx\(\s*nullptr\s*,\s*COINIT_MULTITHREADED\s*\)/.test(vorschau) && /previewUnavailable/.test(nativ('preview.cpp')) && /\bvorschauModus\(\s*an\s*\)/.test(rumpf(nativ('main.cpp'), 'if (cmd == "previewMode")')) && /\bg_an\s*=\s*!\s*g_unavailableGemeldet\.load\(\)\s*;/.test(rumpf(rumpf(vorschau, 'void vorschauModus(bool an)'), 'if (an)')),
    'A13 E15: der Vorschau-Thread startet COM als MTA und meldet previewUnavailable, wenn WIC/COM fehlen; previewMode gibt on an vorschauModus, nach previewUnavailable bleibt die Vorschau aus');
  const cmake = readFileSync(join(nativOrdner, '..', 'CMakeLists.txt'), 'utf8');
  assert(/native\/preview\.cpp/.test(cmake) && /target_link_libraries\(zoom-bridge[^)]*\bwindowscodecs\b[^)]*\bole32\b/.test(cmake),
    'A13 6.16: CMakeLists.txt baut preview.cpp und linkt windowscodecs und ole32');
}
console.log('\nNativer Teil — A14 Abbau-Ketten, Renderer-Sperre, Halteliste (Spec 6.5, 6.6, 6.15, PT6 b/c):');
{
  const video = nativ('video.cpp', true);
  const RENDERER = /\b(subscribe|unSubscribe|setRawDataResolution|createRenderer|destroyRenderer)\s*\(/;
  // PT6 b (Restrunde RR3): das ARGUMENT des Aufrufs wird geprüft, nicht das Fehlen eines Aufrufs.
  const ende = rumpf(video, 'void slotsMeetingEnded()');
  const entzug = rumpf(video, 'void slotsPrivilegeRevoked()');
  assert(/abbauAusfuehren\(\s*Kette::MeetingEnde\s*,\s*Grund::meetingEnded\s*\)/.test(ende) && !RENDERER.test(ende),
    'A14 PT6 b: slotsMeetingEnded ruft abbauAusfuehren mit Kette::MeetingEnde, selbst keine Renderer-Funktion');
  assert(/abbauAusfuehren\(\s*Kette::Entzug\s*,/.test(entzug) && !RENDERER.test(entzug),
    'A14 PT6 b: slotsPrivilegeRevoked ruft abbauAusfuehren mit Kette::Entzug, selbst keine Renderer-Funktion');
  const aus = rumpf(video, 'void abbauAusfuehren(');
  const zweig = (name: string) => {
    const i = aus.indexOf(`case AbbauSchritt::${name}:`);
    if (i < 0) return '';
    const j = aus.indexOf('case AbbauSchritt::', i + 1);
    return aus.slice(i, j < 0 ? aus.length : j);
  };
  assert(zweig('ZeigerVerwerfen') !== '' && !RENDERER.test(zweig('ZeigerVerwerfen'))
      && zweig('HaltelisteVerwerfen') !== '' && !RENDERER.test(zweig('HaltelisteVerwerfen')),
    'A14 PT6 b: im Ausführer rufen die Zweige ZeigerVerwerfen und HaltelisteVerwerfen keine Renderer-Funktion');
  assert(/abbauPlan\(\s*kette\s*,\s*rendererSperre\(\)\s*,\s*verlassen\s*\)/.test(aus),
    'A14 6.15: der Ausführer holt den Plan aus abbauPlan(kette, rendererSperre(), verlassen)');
  // Seit dem Abschluss-Fix F3 vergleicht HaltelisteAbbauen über den getesteten Helfer halteEintragGehoertZu (PB20).
  const MEETING_FREMD = /it->meeting\s*!=\s*g_meetingNr|!halteEintragGehoertZu\(\s*static_cast<uint32_t>\(\s*it->meeting\s*\)\s*,\s*static_cast<uint32_t>\(\s*g_meetingNr\s*\)\s*\)/;
  assert(/g_slotsHalt\.push_back\(\s*HalteEintrag\{\s*std::move\(\*slot\)\s*,\s*g_meetingNr\s*\}\s*\)/.test(zweig('InHalteliste'))
      && MEETING_FREMD.test(zweig('HaltelisteAbbauen')),
    'A14 W2: InHalteliste verschiebt den ganzen Slot samt Meeting-Nummer; HaltelisteAbbauen fasst nur Einträge dieses Meetings an');
  // 6.5: jede Funktion mit Renderer-Aufrufen liest vorher die Renderer-Sperre.
  const mitSperre = ['void planAusfuehren(Slot& s, UmhaengLauf& lauf, const UmhaengPlan& plan) ', 'void subscribeAusfuehren(Slot& s, UmhaengLauf& lauf)',
    'SDKError rendererAnlegen(']
    .every((kopf) => { const k = rumpf(video, kopf); const r = k.search(RENDERER); return r < 0 || (k.indexOf('rendererSperre()') >= 0 && k.indexOf('rendererSperre()') < r); });
  const imAbbau = ['Unsubscribe', 'DestroyRenderer'].every((n) => /!rendererSperre\(\)/.test(zweig(n)))
    && /rendererSperre\(\)/.test(zweig('HaltelisteAbbauen'));
  assert(mitSperre && imAbbau, 'A14 6.5: jede Renderer-Funktion in video.cpp steht hinter einer Prüfung von rendererSperre()');
  const leave = rumpf(video, 'void slotsLeave()');
  assert(/abbauAusfuehren\(\s*Kette::Leave\s*,/.test(leave) && /abbauAusfuehren\(\s*Kette::LeaveNachlauf\s*,\s*Grund::command\s*,\s*g_sessionLeaveErgebnis\s*\)/.test(leave)
      && /g_sessionLeaveErgebnis\s*=\s*sessionLeave\(\)/.test(zweig('SessionLeave')),
    'A14 N8: leave führt zwei Pläne aus, den Nachlauf mit der Rückgabe von sessionLeave()');
  assert(/rendererSperre\(\)\)\s*\{\s*emitSlotFehler\(\s*"slotReconnecting"/.test(nativ('video.cpp')),
    'A14 W2: slotOn antwortet während der Renderer-Sperre slotReconnecting');
}
{
  // PT6 c: Reihenfolge der Hauptschleife nach 6.6.
  const main = nativ('main.cpp', true);
  const schleife = main.slice(Math.max(0, main.indexOf('while (!g_quit) {')));
  const folge = ['pumpOnce(', 'callbacksTakeMeetingEndTeardown(', 'callbacksTakePrivilegeRevokedTeardown(', 'merkerNehmen(', 'slotLogicTick(',
    'slotsTick(', 'nextLine('].map((s) => schleife.indexOf(s));
  assert(folge.every((i, k) => i >= 0 && (k === 0 || i > folge[k - 1])),
    'A14 PT6 c: Hauptschleife pumpOnce < Meeting-Ende < Entzug < Merker < slotLogicTick < slotsTick < Befehle');
  const fall = (cmd: string) => rumpf(nativ('main.cpp'), `if (cmd == "${cmd}")`);
  assert(/slotsLeave\(\)/.test(fall('leave')) && !/\b(audioShutdown|sessionLeave|slotsShutdownAll)\s*\(/.test(fall('leave'))
      && /slotsMeetingNeu\(\)/.test(fall('join')),
    'A14 6.15: leave ruft nur die Kette slotsLeave; join zählt die Meeting-Nummer der Halteliste hoch');
}
console.log('\nNativer Teil — A15 Ton je Slot: Arten, Mischer, Stille (Spec 6.13, 0.35):');
{
  const audio = nativ('audio.cpp', true);
  const ton = rumpf(audio, 'class AudioDelegate');
  assert(/einreihen\(\s*data\s*,\s*0\s*,\s*AudioArt::Mix\s*\)/.test(ton) && /einreihen\(\s*data\s*,\s*userId\s*,\s*AudioArt::Share\s*\)/.test(ton)
      && /einreihen\(\s*data\s*,\s*userId\s*,\s*AudioArt::Person\s*\)/.test(ton),
    'A15 6.13: Person-, Misch- und Computerton werden kopiert und mit ihrer Art eingereiht');
  assert(!/\b(g_slots|tonZiele|sendAudio|slot\w*)\s*[(.[]/.test(ton) && !/\bSlot\b/.test(ton),
    'A15 6.13: der Ton-Delegate legt Pakete nur in die Warteschlange (keine Zuordnung im Rückruf)');
  assert(/constexpr\s+size_t\s+kMaxPakete\s*=\s*512\s*;/.test(audio),
    'A15 6.13: die Ton-Warteschlange fasst 512 Pakete');
  assert(/g_shareAudioPackets\.fetch_add\(1\)/.test(rumpf(ton, 'void onShareAudioRawDataReceived(')),
    'A15 B39: Freigabe-Ton wird vor der Zuordnung gezählt (shareAudioPackets)');
  const sichern = rumpf(nativ('audio.cpp'), 'bool audioEnsureSubscribed(int slot)');
  assert(['audioVoipJoinFailed', 'audioHelperMissing', 'audioSubscribeFailed'].every((c) => sichern.includes(`tonAboFehler("${c}", slot)`)),
    'A15 6.4: die drei Ton-Abo-Fehler tragen slot, wenn ein Slot sie auslöste');
  const video = nativ('video.cpp', true);
  assert(/audioEnsureSubscribed\(\s*b\.nr\s*\)/.test(video) && /audioEnsureSubscribed\(\s*s\.nr\s*\)/.test(video) && !/audioEnsureSubscribed\(\s*\)/.test(video),
    'A15 B70: jedes Einschalten von Ton ruft audioEnsureSubscribed mit der Slot-Nummer');
  const tick = rumpf(video, 'void slotsTick()');
  assert(/tonZiele\(\s*art\s*,\s*p\.userId\s*,\s*sicht\s*\)/.test(tick) && /p\.kind\s*==\s*AudioArt::Mix/.test(tick)
      && /audioShareNichtZugeordnet\(\)/.test(tick) && /mischerEinspeisen\(/.test(tick) && /mischerAusgeben\(/.test(tick),
    'A15 6.13: die Zuordnung je Paket folgt tonZiele(Art, Kennung, Slots), Mischer A/B, Mischer-Ausgabe je Herzschlag');
  const stille = rumpf(video, 'void stilleSenden(');
  const iMischer = stille.search(/if\s*\(\s*weg\s*==\s*TonQuelle::MixShare\s*\)\s*return;/);
  assert(iMischer >= 0 && iMischer < stille.indexOf('sendSilence('),
    'A15 0.35: Mischer-Slots rufen den Stille-Herzschlag nicht');
  assert(/std::lock_guard<std::mutex>\s+lock\(s\.fieldMutex\);\s*s\.ton\.silenceBisMs\s*=\s*r\.neuerSilenceBisMs;/.test(stille)
      && /stilleBloecke\(\s*weg\s*,/.test(stille),
    'A15 RN6: stilleBloecke entscheidet, silenceBisMs wird unter fieldMutex fortgeschrieben');
  assert(/case UmhaengSchritt::MischerNeu:[^}]*?s\.mix\s*=\s*AudioMix\{\}/.test(video) && /case UmhaengSchritt::MischerEingangBNeu:[^}]*?s\.mix\.eingangBNeu\(\)/.test(video),
    'A15 N1: MischerNeu beginnt den Mischer neu, MischerEingangBNeu nur dessen Eingang B');
}
console.log('\nNativer Teil — A16 Messwerte slotStats und bridgeStats (Spec 6.3, 6.17):');
{
  const video = nativ('video.cpp');
  // Gliederung 3.3: Pflichtfelder stehen immer (pflicht), Messfelder nur hinter einer Gemessen-Prüfung (wenn).
  const pruefe = (rumpfText: string, pflichtFelder: string[], messFelder: string[]) => ({
    fehlt: [...pflichtFelder.filter((f) => !rumpfText.includes(`pflicht("${f}"`)),
      ...messFelder.filter((f) => !new RegExp(`wenn\\([^;]*"${f}"`).test(rumpfText))],
    ungeprueft: messFelder.filter((f) => rumpfText.includes(`pflicht("${f}"`)),
  });
  const slot = pruefe(rumpf(video, 'void slotStatsMelden('),
    ['fallbackFps', 'heldFrames', 'workUs', 'copyUs', 'previewUs', 'memKb', 'resWanted', 'foreignFrames', 'lateFrames', 'tooFrequent',
      'noShareData', 'rendererNew', 'rendererLost'],
    ['w', 'h', 'lastW', 'lastH', 'fps', 'resSet', 'resGot', 'rawType', 'userVideoW', 'userVideoH', 'gapMs', 'gapUngeprueft', 'audioPps',
      'audioRate', 'audioCh', 'shareAudioRate', 'shareAudioCh', 'mixDrops', 'mixSilenceMs']);
  assert(slot.fehlt.length === 0 && slot.ungeprueft.length === 0,
    'A16 3.3: slotStats führt jedes Feld, Messfelder nur gemessen (kein fps ohne Bild, keine erfundene 0)');
  if (slot.fehlt.length + slot.ungeprueft.length > 0) console.error(`      fehlt: ${slot.fehlt.join(', ')}; ohne Prüfung: ${slot.ungeprueft.join(', ')}`);
  const bruecke = pruefe(rumpf(video, 'void bridgeStatsTick(bool initGelaufen)'),
    ['cpuPct', 'sysPct', 'memMb', 'audioQueueMax', 'audioDropped', 'merkerVerworfen', 'halteliste', 'shareAudioPackets',
      'shareAudioUnassigned', 'previewOn'],
    ['shareAudioLastId', 'hdVideo', 'originalSize', 'recvVideo', 'recvShare']);
  assert(bruecke.fehlt.length === 0 && bruecke.ungeprueft.length === 0,
    'A16 3.3: bridgeStats führt jedes Feld, hdVideo/originalSize/recv… nur wenn verfügbar');
  if (bruecke.fehlt.length + bruecke.ungeprueft.length > 0) console.error(`      fehlt: ${bruecke.fehlt.join(', ')}; ohne Prüfung: ${bruecke.ungeprueft.join(', ')}`);
  const mess = rumpf(video, 'void slotStatsMelden(');
  assert(/wenn\(\s*bildDa\s*,\s*"fps"/.test(mess) && /if\s*\(\s*spanne\s*<\s*2000\s*\)\s*return;/.test(mess),
    'A16 6.17: slotStats alle 2 s; fps nur aus Bildern des laufenden Fensters');
  // B55 (Spec 6.3, Nachbesserung a3, NB-a3-7): Messfelder je ZIEL. Das Umhängen (ZielStandNeu) beginnt das Fenster für
  // w/h/fps und audioPps neu; w/h/fps nur mit einem Bild des neuen Ziels (bildSeitUmhaengen) - nie w = 0 und nie die
  // Bildrate des alten Ziels nach einem Sprecherwechsel.
  const zielNeu = (() => {
    const plan = rumpf(video, 'void planAusfuehren(Slot& s, UmhaengLauf& lauf, const UmhaengPlan& plan) ');
    const i = plan.indexOf('case UmhaengSchritt::ZielStandNeu:');
    return i < 0 ? '' : plan.slice(i, plan.indexOf('break;', i));
  })();
  assert(/s\.statsZielBeginnMs\s*=\s*abo\.ziel\.retargetMs\s*;/.test(zielNeu) && /s\.statsFrames\s*=\s*s\.frameCount\.load\(\)\s*;/.test(zielNeu)
      && /s\.statsAudio\s*=\s*s\.audioPakete\.load\(\)\s*;/.test(zielNeu) && /const\s+uint64_t\s+zielMs\s*=\s*jetzt\s*>\s*zielBeginn\s*\?\s*static_cast<uint64_t>\(\s*jetzt\s*-\s*zielBeginn\s*\)\s*:\s*1\s*;/.test(mess)
      && /const\s+bool\s+bildDa\s*=\s*frames\s*>\s*0\s*&&\s*z\.bildSeitUmhaengen\s*;/.test(mess)
      && ['w', 'h'].every((f) => new RegExp(`wenn\\(\\s*bildDa\\s*,\\s*"${f}"`).test(mess))
      && /s\.statsZielBeginnMs\s*>\s*beginn\s*\?\s*s\.statsZielBeginnMs\s*:\s*beginn/.test(mess) && (mess.match(/frames\s*\*\s*10000\s*\/\s*zielMs\b/g) ?? []).length === 2 && /pakete\s*\*\s*1000\s*\/\s*zielMs\b/.test(mess),
    'A16 B55: das Umhängen beginnt das Messfenster je Ziel neu; w/h/fps nur mit einem Bild des neuen Ziels, fps und audioPps über die Zeit seit dem Umhängen');
  assert(/slotStatsMelden\(\s*\*s\s*,\s*jetzt\s*\)/.test(rumpf(nativ('video.cpp', true), 'void slotsTick()')),
    'A16 6.6 Nr. 6: der Herzschlag meldet slotStats je laufendem Slot');
  const bt = rumpf(nativ('video.cpp', true), 'void bridgeStatsTick(bool initGelaufen)');
  assert(/^\{\s*if\s*\(\s*!initGelaufen\s*\)\s*return;/.test(bt) && /bridgeStatsTick\(\s*g_sdkInitialized\.load\(\)\s*\)/.test(nativ('main.cpp', true)),
    'A16 6.3: bridgeStats erst, sobald init gelaufen ist');
  // An die Zuweisung gebunden (Nachbesserung a3, NB-a3-8): Ein reiner Tausch von *w und *h enthält beide Muster und
  // blieb vorher grün. Header: „HIWORD->height, LOWORD->width“ (meeting_service_interface.h:589).
  const empfang = rumpf(nativ('session.cpp', true), 'bool sessionEmpfangsStatistik(');
  assert(/\*w\s*=\s*info\.recvResolution\s*&\s*0xFFFF\s*;/.test(empfang) && /\*h\s*=\s*\(\s*info\.recvResolution\s*>>\s*16\s*\)\s*&\s*0xFFFF\s*;/.test(empfang),
    'A16 A-EP5: recvResolution HIWORD = Höhe, LOWORD = Breite');
}
// ── A17 · Prüfstände mit Meeting auf Slots (E22) und Riegel gegen einen Neubau des Einsatzpakets (PT9, Spec 6.18) ──
// video-limit.mjs und video-stress.mjs treten einem Meeting bei; sie laufen nie im Selbsttest (Plan A GG5). Geprüft
// werden ihr Quelltext (ohne Kommentare) und ihre Syntax (node --check). Den Riegel in scripts/build-release.mjs prüft
// der Selbsttest nur an Kopien in testTemp: dort fehlt build/Release/zoom-bridge.exe, der Bau endet also spätestens an
// der Frische-Prüfung (Windows) bzw. an der Plattform-Prüfung (Linux) und erzeugt nie ein Paket.
// Eigene Importnamen (a17…), damit kein gleichnamiger Import eines anderen Blocks kollidiert.
import { spawnSync as a17Starte } from 'node:child_process';
import {
  copyFileSync as a17Kopiere,
  mkdirSync as a17Ordner,
  readFileSync as a17Lies,
  writeFileSync as a17Schreibe,
} from 'node:fs';

console.log('\nA17 — Prüfstände mit Meeting auf Slots (E22):');
{
  const PFLICHT = ['slot', 'ndi', 'mode', 'resolution', 'audio', 'shareAudio', 'fallback', 'showNoVideo'];
  const KATALOG: Record<string, readonly string[]> = {
    mode: paket.SLOT_MODES,
    resolution: paket.SLOT_RESOLUTIONS,
    audio: paket.SLOT_AUDIO_SETTINGS,
    fallback: paket.SLOT_FALLBACKS,
  };
  /** Quelltext ohne Block-Kommentare und ohne ganze //-Zeilen (Code bleibt, Zeilen nicht). */
  const ohneKommentare = (src: string): string =>
    src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((l) => !/^\s*\/\//.test(l))
      .join('\n');
  /** Der Rumpf `{ … }` der Funktion slotOnBefehl (Klammern gezählt), sonst ''. */
  const befehlsRumpf = (src: string): string => {
    const kopf = src.indexOf('function slotOnBefehl(');
    const auf = kopf < 0 ? -1 : src.indexOf('{', kopf);
    if (auf < 0) return '';
    let tiefe = 0;
    for (let i = auf; i < src.length; i++) {
      if (src[i] === '{') tiefe++;
      else if (src[i] === '}' && --tiefe === 0) return src.slice(auf, i + 1);
    }
    return '';
  };
  for (const datei of ['video-limit.mjs', 'video-stress.mjs']) {
    const pfad = join(testDir, datei);
    const code = ohneKommentare(a17Lies(pfad, 'utf8').replace(/\r\n/g, '\n'));
    const stress = datei === 'video-stress.mjs';
    assert(
      !/\bvideo(Subscribe|Unsubscribe|Subs)\b/.test(code) &&
        /\bslots\.(get|has)\(/.test(code) &&
        (!stress || /\bcmd:\s*'slotOff'/.test(code)),
      `A17 E22: ${datei} ohne videoSubscribe, videoUnsubscribe und videoSubs, liest Session.slots` +
        (stress ? ', baut mit slotOff ab' : ''),
    );
    const rumpf = befehlsRumpf(code);
    const probleme = [
      ...(rumpf.includes("cmd: 'slotOn',") ? [] : ["cmd: 'slotOn' fehlt"]),
      ...PFLICHT.filter((k) => !new RegExp(`^\\s*${k}\\s*[:,]`, 'm').test(rumpf)).map((k) => `${k} fehlt`),
      ...Object.entries(KATALOG)
        .filter(([k, werte]) => {
          const m = new RegExp(`^\\s*${k}:\\s*'([^']*)',`, 'm').exec(rumpf);
          return m === null || !werte.includes(m[1]);
        })
        .map(([k]) => `${k} ohne Katalogwert`),
      ...['shareAudio', 'showNoVideo']
        .filter((k) => !new RegExp(`^\\s*${k}:\\s*(true|false),`, 'm').test(rumpf))
        .map((k) => `${k} ohne true/false`),
    ];
    assert(
      rumpf !== '' && probleme.length === 0,
      `A17 E22: ${datei} schickt slotOn mit allen Pflichtfeldern, Werte aus den Katalogen (Spec 6.2)`,
    );
    if (probleme.length > 0) console.error(`      ${datei}: ${probleme.join(', ')}`);
    const syntax = a17Starte(process.execPath, ['--check', pfad], { encoding: 'utf8' });
    assert(syntax.status === 0, `A17 E22: ${datei} besteht node --check`);
    if (syntax.status !== 0) console.error(`      ${(syntax.stderr ?? '').trim().split('\n').slice(0, 4).join(' | ')}`);
  }
}

console.log('\nA17 — Riegel gegen einen Neubau des Einsatzpakets (PT9, Spec 6.18):');
{
  const paketOrdner = join(testDir, '..');
  const SATZ = 'hängt die Bridge das Abo von selbst um';
  const liesmich = a17Lies(join(paketOrdner, 'paket', 'LIESMICH.txt'), 'utf8');
  /**
   * Prüfordner mit Kopien von build-release.mjs, auslieferung.mjs und package.json und dem gegebenen LIESMICH-Text;
   * startet den Bau dort. Ohne build/Release/zoom-bridge.exe entsteht nie ein Paket.
   */
  const baue = (fall: string, text: string): { status: number | null; stderr: string } => {
    const ordner = join(testTemp, 'a17-riegel', fall);
    a17Ordner(join(ordner, 'scripts'), { recursive: true });
    a17Ordner(join(ordner, 'paket'), { recursive: true });
    for (const f of ['build-release.mjs', 'auslieferung.mjs']) {
      a17Kopiere(join(paketOrdner, 'scripts', f), join(ordner, 'scripts', f));
    }
    a17Kopiere(join(paketOrdner, 'package.json'), join(ordner, 'package.json'));
    a17Schreibe(join(ordner, 'paket', 'LIESMICH.txt'), text, 'utf8');
    const r = a17Starte(process.execPath, [join(ordner, 'scripts', 'build-release.mjs')], {
      encoding: 'utf8',
      timeout: 30_000,
    });
    return { status: r.status, stderr: r.stderr ?? '' };
  };
  const riegel = (r: { status: number | null; stderr: string }): boolean =>
    r.status === 1 && r.stderr.includes('Riegel: paket/LIESMICH.txt');
  const zeige = (fall: string, r: { status: number | null; stderr: string }): void =>
    console.error(`      ${fall}: Rueckgabe ${r.status}, ${r.stderr.trim().split('\n').slice(-2).join(' | ')}`);

  const einzeilig = baue('einzeilig', `﻿LIESMICH\r\n\r\nIst ihr Name eindeutig, ${SATZ}.\r\n`);
  const einzeiligGut =
    riegel(einzeilig) &&
    einzeilig.stderr.includes('2026-10-17-connect-zoom-slots-design.md, Abschnitt 6.18') &&
    einzeilig.stderr.includes('berichtigt zuerst paket/LIESMICH.txt und die Version');
  assert(einzeiligGut, 'A17 PT9: Satz in einer Zeile → Abbruch mit Hinweis auf Spec 6.18 und den Weg (LIESMICH und Version)');
  if (!einzeiligGut) zeige('einzeilig', einzeilig);

  const echt = baue('echt', liesmich);
  assert(!liesmich.includes(SATZ) && riegel(echt), 'A17 PT9: paket/LIESMICH.txt wie im Repo (Satz über zwei Zeilen) → Abbruch');
  if (!riegel(echt)) zeige('echt', echt);

  const leerraum = baue('leerraum', 'Ist ihr Name eindeutig, hängt  die\tBridge das Abo von\n   selbst um.\n');
  assert(riegel(leerraum), 'A17 PT9: Satz mit Tabulator, doppeltem Leerzeichen und LF-Umbruch → Abbruch');
  if (!riegel(leerraum)) zeige('leerraum', leerraum);

  const ohneSatz = liesmich.replace(/hängt die Bridge das Abo von\s+selbst um/, 'bleibt die Quelle stehen');
  const ohne = baue('ohne', ohneSatz);
  const naechste = process.platform === 'win32' ? 'zoom-bridge.exe fehlt' : 'nur unter Windows';
  const ohneGut = ohneSatz !== liesmich && ohne.status === 1 && !ohne.stderr.includes('Riegel') && ohne.stderr.includes(naechste);
  assert(ohneGut, 'A17 PT9: ohne den Satz lässt der Riegel durch (der Bau endet erst an der nächsten Vorbedingung)');
  if (!ohneGut) zeige('ohne', ohne);
}
// ── A18 · Doku der Bridge (Spec 14: D1–D5, D7, D15, D16) ──
// Die README ist Teil des Vertrags: Sie nennt die Slot-Befehle und die neuen Skripte, und jeder widerrufene Satz
// bleibt mit Vermerk stehen (Lehre „Widerruf“). a17Lies kommt aus dem Abschnitt A17 oben. Gesucht wird in Text mit
// zusammengefasstem Leerraum (flach), weil die README ihre Zeilen umbricht; Tabellenzeilen und Listenpunkte zeilenweise.
console.log('\nA18 — Doku der Bridge (README, package.json):');
{
  const readme = a17Lies(join(testDir, '..', 'README.md'), 'utf8').replace(/\r\n/g, '\n');
  /** Abschnitt „## n · …“ bis vor den nächsten „## “, sonst ''. */
  const abschnitt = (nr: number): string => {
    const a = readme.indexOf(`\n## ${nr} · `);
    if (a < 0) return '';
    const b = readme.indexOf('\n## ', a + 1);
    return readme.slice(a, b < 0 ? undefined : b);
  };
  const flach = (text: string): string => text.replace(/\s+/g, ' ');
  /** Die Tabellenzeile, die mit „| `name` |“ beginnt, sonst ''. */
  const zeile = (text: string, name: string): string =>
    text.split('\n').find((l) => l.startsWith(`| \`${name}\` |`)) ?? '';

  const s1 = flach(abschnitt(1));
  assert(
    ['**16 Slots**', '**Teilnehmer**', '**Aktiver Sprecher**', '**Bildschirmfreigabe**', '**Stage 1–3 von 4**'].every((t) =>
      s1.includes(t),
    ),
    'A18 D1: §1 beschreibt bis zu 16 Slots mit drei Modi, „Stage 1–3 von 4“ bleibt als Rückblick',
  );

  const s2 = flach(abschnitt(2));
  const s3 = flach(abschnitt(3));
  assert(
    s2.includes('npm run slot-test -w @jm/zoom-bridge') &&
      s3.includes('npm run logik-test -w @jm/zoom-bridge') &&
      s3.includes('`logik-test: kein C++-Compiler gefunden (g++, clang++, cl über vswhere).`'),
    'A18 D15: §2 nennt slot-test, §3 nennt logik-test samt der Zeile ohne Compiler',
  );

  const s4 = abschnitt(4);
  assert(
    zeile(s4, '+<id>').includes('`slotOn`') &&
      zeile(s4, '-<id>').includes('`slotOff`') &&
      zeile(s4, '=<Slot> <Kennung>').includes('`slotSet {slot, id}`') &&
      flach(s4).includes('„Rückkehr? =<Slot> <Kennung>“'),
    'A18 D15: §4 beschreibt die Konsole mit Slots (+, -, =, Rückkehr-Hinweis, kein Umhängen von selbst)',
  );

  const s6 = abschnitt(6);
  const neu6 = ['slotOn', 'slotSet', 'slotOff', 'speakerConfig', 'previewMode', 'videoDelay', 'slot', 'slotAudio',
    'slotStats', 'bridgeStats', 'shares', 'speakerSignal', 'videoStatus', 'preview'];
  const fehlen6 = neu6.filter((n) => zeile(s6, n) === '');
  const ohneVermerk6 = ['videoSubscribe', 'videoUnsubscribe', 'video', 'audio'].filter(
    (n) => !zeile(s6, n).includes('**Entfallen mit Connect 0.4.0**'),
  );
  assert(
    fehlen6.length === 0 && ohneVermerk6.length === 0,
    'A18 D2: §6 nennt Slot-Befehle und -Ereignisse; videoSubscribe, videoUnsubscribe, video und audio als entfallen',
  );
  if (fehlen6.length + ohneVermerk6.length > 0) {
    console.error(`      fehlt: ${fehlen6.join(', ') || '-'}; ohne Vermerk: ${ohneVermerk6.join(', ') || '-'}`);
  }

  const s7 = flach(abschnitt(7));
  const fehlen7 = ['slotRetarget', 'umhaengPlan', '**Riegel.**', '**Renderer-Sperre.**', '**Halteliste.**', 'abbauPlan',
    '**Ersatzbild und Halten.**', '**Ton je Slot.**', 'eigener Uhr', '**Bild-Versatz ohne Freigabe.**',
    '**Speicher je Slot.**', '**Vorschau.**', '### Bis 0.3.0: Video-Abos je Teilnehmer (Stage 2 und 3)'].filter(
    (t) => !s7.includes(t),
  );
  assert(
    fehlen7.length === 0,
    'A18 D3: §7 beschreibt Slots, Umhängen, Riegel, Renderer-Sperre, Halteliste, Ersatzbild, Ton samt Mischer-Uhr, Versatz, Speicher, Vorschau; Stage 2 bleibt mit Vermerk',
  );
  if (fehlen7.length > 0) console.error(`      fehlt in §7: ${fehlen7.join(', ')}`);

  const s8 = flach(abschnitt(8));
  assert(
    s8.includes('(Share 9/0, Video 12/0, Audio 5/0)') && s8.includes('Renderer-Sperre ab `DISCONNECTING`'),
    'A18 D4: §8 zählt die drei neuen Lauscher (WIN32) und nennt die Renderer-Sperre ab DISCONNECTING',
  );

  const s9 = abschnitt(9);
  /** Der alte Punkt steht noch, und in demselben Listenpunkt steht der Widerruf. */
  const mitWiderruf = (alt: string): boolean => {
    const i = s9.indexOf(alt);
    if (i < 0) return false;
    const ende = s9.indexOf('\n- **', i + alt.length);
    return s9.slice(i, ende < 0 ? undefined : ende).includes('**Widerrufen mit Connect 0.4.0**');
  };
  assert(
    mitWiderruf('- **Kein Mischton.** `onMixedAudioRawDataReceived` bleibt ungenutzt') &&
      mitWiderruf('- **Kein Bildschirmton.** `onShareAudioRawDataReceived` bleibt ebenso'),
    'A18 D5: „Kein Mischton“ und „Kein Bildschirmton“ stehen weiter, je mit Widerruf daneben',
  );

  const s10 = flach(abschnitt(10));
  assert(
    s10.includes('Einsatzpaket `zoom-bridge-v0.1.0` zeigt den Stand 0.1.0') && s10.includes('Riegel') && s10.includes('„hängt die Bridge das Abo von selbst um“'),
    'A18 D16: §10 nennt den Stand 0.1.0 des Einsatzpakets und den Riegel in build-release.mjs',
  );

  const beschreibung = String(JSON.parse(a17Lies(join(testDir, '..', 'package.json'), 'utf8')).description ?? '');
  assert(
    beschreibung.includes('bis zu 16 Slots') && !beschreibung.includes('je Teilnehmer'),
    'A18 D7: package.json beschreibt Slots statt Quellen je Teilnehmer',
  );
}
console.log('\nNativer Teil — Nachtrag N2a (Riegel unter Sperre, Wiederholung, Rollenprüfung, Versatz, showNoVideo, vorgemerkter Modus):');
{
  const video = nativ('video.cpp', true);
  const ausf = rumpf(video, 'void planAusfuehren(Slot& s, UmhaengLauf& lauf, const UmhaengPlan& plan) ');
  /** Text eines Zweigs `case UmhaengSchritt::<name>:` bis zum nächsten `case UmhaengSchritt::`. */
  const zweigN2a = (name: string): string => {
    const i = ausf.indexOf(`case UmhaengSchritt::${name}:`);
    if (i < 0) return '';
    const j = ausf.indexOf('case UmhaengSchritt::', i + 1);
    return ausf.slice(i, j < 0 ? ausf.length : j);
  };

  // N2a.1 (Task-11-Review I1, Task-13-Review; Spec 6.10 „Riegel“, B53): ein Bild, das den Riegel oben passierte, bevor
  // die Hauptschleife umhängt, darf den frisch geleerten Ziel-Stand nicht füllen (live/frames, Lücke, kopieGueltig), die
  // Kopie nicht überschreiben und keinen Vorschau-Platz unter dem neuen Ziel belegen. Die Umhäng-Generation je Abo
  // zählt ZielStandNeu unter fieldMutex hoch; der Rückruf liest sie (und das Ziel) VOR dem Riegel und vergleicht sie im
  // Sperr-Block erneut, zusammen mit imAbbau und riegelVerwirft. Ebenso der Status-Rückruf.
  const aboStruktur = rumpf(video, 'struct Abo ');
  const zielNeu = zweigN2a('ZielStandNeu');
  const ankunft = rumpf(video, 'void Slot::bildAnkunft(');
  const iGen = ankunft.search(/const\s+uint64_t\s+aboGen\s*=\s*abo\.umhaengGeneration\.load\(\)\s*;/);
  const iZiel = ankunft.search(/const\s+unsigned\s+aboZiel\s*=\s*abo\.target\.load\(\)\s*;/);
  const iRiegelOben = ankunft.indexOf('riegelVerwirft(');
  const iAnnehmen = ankunft.indexOf('bildAnnehmen(');
  const iSperre = ankunft.lastIndexOf('std::lock_guard<std::mutex> lock(fieldMutex);', iAnnehmen);
  const sperrKopf = iSperre < 0 || iAnnehmen < 0 ? '' : ankunft.slice(iSperre, iAnnehmen);
  const iSpaet = ankunft.search(/if\s*\(\s*spaet\s*\)\s*\{\s*lateFrames\.fetch_add\(1\)\s*;\s*return\s*;\s*\}/);
  const iVorschau = ankunft.indexOf('vorschauBild(');
  const iKopie = ankunft.indexOf('last.i420.assign(');
  const kopieWeg = iKopie < 0 ? '' : ankunft.slice(ankunft.lastIndexOf('last.m.try_lock()', iKopie), iKopie);
  assert(/std::atomic<uint64_t>\s+umhaengGeneration\{0\}\s*;/.test(aboStruktur)
      && /std::lock_guard<std::mutex>\s+lock\(s\.fieldMutex\)\s*;/.test(zielNeu)
      && zielNeu.search(/abo\.umhaengGeneration\.fetch_add\(1\)\s*;/) > zielNeu.indexOf('abo.target = lauf.ziel;')
      && zielNeu.indexOf('abo.target = lauf.ziel;') > 0
      && (video.match(/umhaengGeneration\.fetch_add\(/g) ?? []).length === 1,
    'N2a.1 6.10: das Abo führt eine Umhäng-Generation; nur ZielStandNeu zählt sie hoch, unter fieldMutex, nach dem neuen Ziel');
  assert(iGen >= 0 && iZiel > iGen && iRiegelOben > iZiel
      && /const\s+bool\s+passt\s*=\s*quelle\s*==\s*aboZiel\s*;/.test(ankunft),
    'N2a.1 6.10: bildAnkunft liest Generation und Ziel VOR dem Riegel (und misst die Lücke gegen dieses Ziel)');
  // Fixrunde 1, F3: die Schreibzugriffe stehen im else-Zweig GENAU dieser Prüfung (sonst liefe der Rumpf trotz spaet).
  const iSpaetWahr = ankunft.indexOf('spaet = true;');
  const nachSpaet = iSpaetWahr < 0 ? '' : ankunft.slice(iSpaetWahr + 'spaet = true;'.length);
  const sonstZweig = /^\s*\}\s*else\s*\{/.test(nachSpaet) ? rumpf(nachSpaet, 'else') : '';
  assert(sperrKopf !== '' && /imAbbau\.load\(\)/.test(sperrKopf)
      && /riegelVerwirft\(\s*abo\.subscribed\.load\(\)\s*,\s*abo\.umhaengen\.load\(\)\s*\)/.test(sperrKopf)
      && /abo\.umhaengGeneration\.load\(\)\s*!=\s*aboGen/.test(sperrKopf) && /spaet\s*=\s*true\s*;/.test(sperrKopf)
      && sonstZweig.includes('bildAnnehmen(') && /gapOffen\s*=\s*false\s*;/.test(sonstZweig)
      && /kopieGueltig\s*=\s*true\s*;/.test(sonstZweig) && /state\s*=\s*SlotState::Live\s*;/.test(sonstZweig),
    'N2a.1 6.10 (I3 aus Stage 4): bildAnkunft prüft Riegel und Generation ein zweites Mal im Sperr-Block, vor bildAnnehmen');
  assert(iSpaet > iAnnehmen && iVorschau > iSpaet && /vorschauBild\(\s*nr\s*,\s*aboZiel\s*,\s*buf\s*,/.test(ankunft)
      && /abo\.umhaengGeneration\.load\(\)\s*==\s*aboGen/.test(kopieWeg),
    'N2a.1 B53/7.7: ein spätes Bild zählt lateFrames und endet vor vorschauBild (mit dem Ziel von oben); die Kopie nimmt nur Bilder dieser Generation');
  const status = rumpf(video, 'void Delegate::onRawDataStatusChanged(');
  const iStatusGen = status.search(/const\s+uint64_t\s+aboGen\s*=\s*abo_->umhaengGeneration\.load\(\)\s*;/);
  const iStatusSperre = status.indexOf('std::lock_guard<std::mutex> lock(slot_->fieldMutex);');
  const statusNachSperre = iStatusSperre < 0 ? '' : status.slice(iStatusSperre, status.indexOf('rawOffGesehen'));
  assert(iStatusGen >= 0 && iStatusGen < status.indexOf('riegelVerwirft(')
      && /riegelVerwirft\(\s*abo_->subscribed\.load\(\)\s*,\s*abo_->umhaengen\.load\(\)\s*\)/.test(statusNachSperre)
      && /abo_->umhaengGeneration\.load\(\)\s*!=\s*aboGen/.test(statusNachSperre),
    'N2a.1 6.10: der Status-Rückruf prüft Riegel und Generation ebenso ein zweites Mal unter der Sperre');

  // N2a.2 (Task-11-Review I2, Task-12-Review; Spec 6.10 Tabelle, Zeilen 18/29): die Wiederholung nach 18 nimmt Ziel,
  // Modus und Grund DES Umhängens, das 18 bekam (abo.target ist dann noch das alte Ziel), und den Modus von vorher
  // (slotRetargetIntern stellt s.mode schon um). Der Merker abschlussGelaufen gilt nur dem 29-Weg mit Abschluss (ein
  // VIDEO-Abschluss enthält IsVideoOnFragen), geht über subscribeAusfuehren in die Lage und fällt beim nächsten Umhängen.
  // WIDERRUFEN durch den Abschluss-Fix F2 (R1): auch der 18-Weg läuft mit Abschluss (VIDEO samt IsVideoOnFragen) und
  // setzt den Merker; „nur nach 29“ und „abo.target ist dann noch das alte Ziel“ gelten seitdem nicht mehr.
  const wiederholen = zweigN2a('WiederholenIn500ms');
  const wdh = rumpf(video, 'void wiederholungen(');
  const sub = rumpf(video, 'void subscribeAusfuehren(Slot& s, UmhaengLauf& lauf)');
  const bauN2a = rumpf(video, 'void slotRetargetIntern(');
  const nichtNurVormerken = rumpf(bauN2a, 'if (!nurVormerken)');
  assert(['unsigned wiederholZiel', 'SlotMode wiederholModus', 'SlotMode wiederholModusVorher', 'Grund wiederholGrund', 'bool abschlussGelaufen']
      .every((f) => new RegExp(`\\b${f.replace(' ', '\\s+')}\\s*=`).test(aboStruktur)),
    'N2a.2 6.10: das Abo merkt Ziel, Modus, Modus von vorher und Grund der Wiederholung samt Merker abschlussGelaufen');
  assert(/abo\.wiederholZiel\s*=\s*lauf\.ziel\s*;/.test(wiederholen) && /abo\.wiederholModus\s*=\s*lauf\.lage\.modusNachher\s*;/.test(wiederholen)
      && /abo\.wiederholGrund\s*=\s*lauf\.lage\.aufruf\s*;/.test(wiederholen)
      && /abo\.wiederholModusVorher\s*=\s*abo\.abschlussGelaufen\s*\?\s*lauf\.lage\.modusNachher\s*:\s*lauf\.lage\.modusVorher\s*;/.test(wiederholen)
      // seit dem Abschluss-Fix F2 (R1) läuft der Abschluss auch bei 18 sofort: der Merker folgt jedem Plan mit Abschluss
      // vor WiederholenIn500ms (18 oder 29), nicht mehr nur dem 29
      && /if\s*\(\s*abschlussHier\s*\)\s*abo\.abschlussGelaufen\s*=\s*true\s*;/.test(wiederholen)
      && (video.match(/abschlussGelaufen\s*=\s*true/g) ?? []).length === 1
      && /abschlussHier\s*=\s*true\s*;/.test(zweigN2a('ZielStandNeu')),
    'N2a.2 6.10: WiederholenIn500ms merkt Ziel, Modus und Grund des laufenden Umhängens; abschlussGelaufen nach einem 18 oder 29 mit Abschluss (F2)');
  assert(/lauf\.ziel\s*=\s*abo\.wiederholZiel\s*;/.test(wdh)
      && /lageFuer\(\s*\*s\s*,\s*abo\.wiederholModus\s*,\s*abo\.wiederholZiel\s*,\s*abo\.wiederholGrund\s*\)/.test(wdh)
      && /lauf\.lage\.modusVorher\s*=\s*abo\.wiederholModusVorher\s*;/.test(wdh)
      && !/abo\.target\.load\(\)/.test(wdh) && !/Grund::command/.test(wdh),
    'N2a.2 6.10: wiederholungen abonniert das gemerkte Ziel mit gemerktem Modus und Grund, nicht abo.target und nicht command');
  const iMerkerLage = sub.search(/lauf\.lage\.abschlussGelaufen\s*=\s*abo\.abschlussGelaufen\s*;/);
  assert(iMerkerLage >= 0 && iMerkerLage < sub.indexOf('umhaengNachSubscribe(')
      && /abo\.abschlussGelaufen\s*=\s*false\s*;/.test(nichtNurVormerken),
    'N2a.2 6.10: subscribeAusfuehren gibt den Merker an umhaengNachSubscribe; das nächste echte Umhängen löscht ihn');

  // N2a.3 (Task-11-Review I3; Spec 6.10 Schritt 2, B32): kam onRendererBeDestroyed, während eine Wiederholung wartet,
  // ruft die Wiederholung nie subscribe auf den toten Renderer, sondern führt den Plan von umhaengPlan aus (Zeiger
  // verwerfen, createRenderer mit neuem Delegate, Schritte 4-5); nur mit lebendem Renderer gleich subscribeAusfuehren.
  assert(/if\s*\(\s*lauf\.lage\.rendererTot\s*\)\s*planAusfuehren\(\s*\*s\s*,\s*lauf\s*,\s*umhaengPlan\(\s*lauf\.lage\s*\)\s*\)\s*;\s*else\s+subscribeAusfuehren\(\s*\*s\s*,\s*lauf\s*\)\s*;/.test(wdh)
      && (wdh.match(/\bsubscribeAusfuehren\(/g) ?? []).length === 1,
    'N2a.3 6.10 Schritt 2/B32: ist der Renderer bis zur Wiederholung tot, kein subscribe auf ihn - neuer Renderer mit neuem Delegate über umhaengPlan');

  // N2a.4 (Task-11-Review I4, Task-12-Review; Spec 6.7 „Ist die Kennung keinem Teilnehmer zugeordnet, gilt dasselbe“):
  // EIN Helfer prüft die Kennung aus einem Befehl gegen die Teilnehmer (unbekannt: Ziel 0, noTarget, stderr-Zeile) -
  // für slotOn, den Moduswechsel von slotSet (über zielNachModus) und den id-Zweig von slotSet; die Kopien entfallen.
  const teilnehmerHelfer = rumpf(video, 'unsigned teilnehmerZiel(int nr, unsigned id)');
  const zielN2a = rumpf(video, 'unsigned zielNachModus(');
  const anN2a = rumpf(video, 'void slotOn(const SlotBefehl& b)');
  const setN2a = rumpf(video, 'void slotSet(const SlotAenderung& a)');
  assert(/if\s*\(\s*id\s*==\s*0\s*\|\|\s*sessionFindParticipant\(\s*id\s*,\s*nullptr\s*,\s*nullptr\s*\)\s*\)\s*return\s+id\s*;/.test(teilnehmerHelfer)
      && /emitLog\(/.test(teilnehmerHelfer) && /return\s+0\s*;/.test(teilnehmerHelfer)
      && (video.match(/\bsessionFindParticipant\(/g) ?? []).length === 1,
    'N2a.4 6.7: EIN Helfer teilnehmerZiel prüft die Kennung gegen die Teilnehmer (unbekannt: Ziel 0 mit stderr-Zeile), keine Kopie mehr');
  assert(/if\s*\(\s*m\s*==\s*SlotMode::Participant\s*\)\s*return\s+teilnehmerZiel\(\s*s\.nr\s*,\s*idTeilnehmer\s*\)\s*;/.test(zielN2a)
      && /zielNachModus\(\s*s\s*,\s*b\.mode\s*,\s*b\.id\s*,/.test(anN2a) && /zielNachModus\(\s*s\s*,\s*a\.mode\s*,/.test(setN2a)
      && /teilnehmerZiel\(\s*s\.nr\s*,\s*a\.id\s*\)/.test(setN2a),
    'N2a.4 6.7/6.10: slotOn, der Moduswechsel von slotSet (zielNachModus) und der id-Zweig von slotSet nehmen die Kennung nur über teilnehmerZiel');

  // N2a.5 (Task-12-Review I1; Spec 6.14 „Freigabe-Slots setzen ihn“, E11): slotOn ist kein Moduswechsel, umhaengPlan
  // plant dort kein OhneVersatzSetzen. Darum setzt slotOn den Schalter am frisch geöffneten Sender selbst, vor dem
  // ersten Umhängen; Teilnehmer- und Sprecher-Slots bleiben mit Versatz.
  const iSenderAuf = anN2a.indexOf('s.sender.open(');
  const iOhneVersatz = anN2a.search(/s\.sender\.setOhneVersatz\(\s*b\.mode\s*==\s*SlotMode::Share\s*\)\s*;/);
  assert(iSenderAuf >= 0 && iOhneVersatz > iSenderAuf && iOhneVersatz < anN2a.indexOf('slotRetargetIntern(')
      && (anN2a.match(/setOhneVersatz\(/g) ?? []).length === 1,
    'N2a.5 6.14: slotOn setzt am neuen Sender „ohne Versatz“ genau für Freigabe-Slots, vor dem ersten Umhängen');

  // N2a.6 (Task-12-Review I2; Spec 6.8, 6.2): slotSet {showNoVideo} auf einem Sprecher-Slot wertet die neue,
  // vorbelegte Wahl aus. Zeigt sie jemand anderen als das Abo (auch niemanden), hängt der Slot um - mit Ziel und Grund
  // der Wahl, nach dem Moduswechsel- und vor dem Auflösungs-Zweig, und höchstens EINMAL je slotSet (Reihenfolge 6.2).
  const showZweig = rumpf(setN2a, 'if (a.showNoVideoGesetzt)');
  const sprecherZweig = rumpf(setN2a, 'if (sprecherWechsel)');
  const iSprecherZweig = setN2a.indexOf('if (sprecherWechsel)');
  assert(/sprecher\s*=\s*s\.wahl->vorbelegen\(\s*g_erinnerung\s*,/.test(showZweig)
      // seit Fixrunde 1 (F1) gegen das gewünschte Ziel zielImLauf(abo); F1 unten pinnt diese Form
      && /sprecherWechsel\s*=\s*s\.wahl->ziel\(\)\s*!=\s*(abo\.target\.load\(\)|zielImLauf\(\s*abo\s*\))\s*;/.test(showZweig) && !/slotRetarget\(/.test(showZweig),
    'N2a.6 6.8: der showNoVideo-Zweig wertet die vorbelegte Wahl aus (Ziel gegen das Abo) und hängt nicht selbst um');
  assert(/slotRetarget\(\s*s\s*,\s*SlotMode::Speaker\s*,\s*s\.wahl->ziel\(\)\s*,\s*sprecher\.grund\s*\)\s*;\s*return\s*;/.test(sprecherZweig)
      && iSprecherZweig > setN2a.indexOf('if (a.modeGesetzt && a.mode != vorher)') && iSprecherZweig < setN2a.indexOf('if (a.resGesetzt && a.res != s.res)'),
    'N2a.6 6.8/6.10: weicht die Wahl ab, hängt slotSet den Sprecher-Slot mit Ziel und Grund der Wahl um (statt des Auflösungs-Zweigs)');
  const umhaengenInSet = [...setN2a.matchAll(/slotRetarget\([^;]*\);(\s*return\s*;)?/g)];
  assert(umhaengenInSet.length === 4 && umhaengenInSet.every((t) => t[1] !== undefined),
    'N2a.6 6.2: in slotSet endet jedes Umhängen den Befehl (Modus, Ziel, Sprecher nach showNoVideo, Auflösung) - höchstens EIN Umhängen');

  // N2a.7 (Task-12-Review M2; Spec 6.10 Schritt 0, 6.15 „Zoom verbindet selbst neu“): ein während der Renderer-Sperre
  // vorgemerkter Moduswechsel gilt nach INMEETING. alleNeuZuordnen ordnet nach dem vorgemerkten Modus neu zu (das Ziel
  // je Modus nach 6.15, weil die Kennungen mit INMEETING wechseln) und bestätigt ihn mit modeChanged.
  const neuZuordnen = rumpf(video, 'void alleNeuZuordnen()');
  assert(/const\s+SlotMode\s+m\s*=\s*s->vorgemerkt\s*\?\s*s->vorgemerktMode\s*:\s*s->mode\.load\(\)\s*;/.test(neuZuordnen)
      && !/const\s+SlotMode\s+m\s*=\s*s->mode\.load\(\)\s*;/.test(neuZuordnen)
      && /const\s+bool\s+modusNeu\s*=\s*m\s*!=\s*s->mode\.load\(\)\s*;/.test(neuZuordnen)
      && /modusNeu\s*\?\s*Grund::modeChanged\s*:\s*Grund::shareChanged/.test(neuZuordnen),
    'N2a.7 6.10 Schritt 0: nach INMEETING ordnet alleNeuZuordnen nach dem vorgemerkten Modus neu zu (Freigabe mit modeChanged)');

  // Fixrunde 1, F1 (Spec 6.10 Tabelle 18, 6.7 Weggang, 6.8): während einer 18-Wartezeit ist abo.target noch das alte
  // Ziel. Wer das GEWÜNSCHTE Ziel meint (Vergleich mit einem Befehl, Weggang, Sprecher-Wahl, Umhängen auf eine neue
  // Auflösung), fragt EINEN Helfer zielImLauf (slot_logic.h gewuenschtesZiel); der gezeigte Ziel-Stand bleibt am Abo.
  const zielImLaufHelfer = rumpf(video, 'unsigned zielImLauf(const Abo& a)');
  const setUmhaengen = setN2a.slice(Math.max(0, setN2a.indexOf('const SlotMode vorher = s.mode.load();')));
  const wegF1 = rumpf(video, 'void slotsParticipantLeft(');
  const sprecherEinst = rumpf(video, 'void slotsSprecherEinstellung(');
  assert(/return\s+gewuenschtesZiel\(\s*a\.wiederholen\s*,\s*a\.wiederholZiel\s*,\s*a\.target\.load\(\)\s*\)\s*;/.test(zielImLaufHelfer),
    'F1 6.10: zielImLauf ist während einer anstehenden Wiederholung deren Ziel, sonst das Abo-Ziel');
  assert(setUmhaengen.length > 0 && /a\.id\s*!=\s*zielImLauf\(\s*abo\s*\)/.test(setUmhaengen)
      && /slotRetarget\(\s*s\s*,\s*vorher\s*,\s*zielImLauf\(\s*abo\s*\)\s*,\s*Grund::resolutionChanged\s*\)/.test(setUmhaengen)
      && !/abo\.target\.load\(\)/.test(setUmhaengen)
      && /sprecherWechsel\s*=\s*s\.wahl->ziel\(\)\s*!=\s*zielImLauf\(\s*abo\s*\)\s*;/.test(showZweig),
    'F1 6.2/6.8: slotSet vergleicht id und Sprecher-Wahl mit dem gewünschten Ziel und hängt auf eine neue Auflösung des gewünschten Ziels um');
  assert(/SlotMode::Participant\s*&&\s*zielImLauf\(\s*s->abo\(\)\s*\)\s*==\s*id/.test(wegF1) && !/target\.load\(\)/.test(wegF1)
      && /s->wahl->ziel\(\)\s*!=\s*zielImLauf\(\s*s->abo\(\)\s*\)/.test(sprecherEinst) && !/target\.load\(\)/.test(sprecherEinst),
    'F1 6.7/6.8: der Weggang trifft das gewünschte Ziel, speakerConfig vergleicht die neue Wahl mit ihm');

  // Fixrunde 1, F2 (Spec 6.10 Riegel, 6.4 slotBufferMismatch einmal je Ziel): auch ein falsch geformtes Bild prüft
  // Riegel und Generation unter der Sperre, bevor es bufferMismatch/mismatchGemeldet setzt - ein spätes Bild des alten
  // Ziels markiert den neuen Ziel-Stand nicht als gemeldet; es zählt lateFrames.
  const iPuffer = ankunft.indexOf('GetBufferLen() != erwartet');
  const pufferBlock = iPuffer < 0 ? '' : ankunft.slice(iPuffer, ankunft.indexOf('const int64_t jetzt = jetztMs();', iPuffer));
  const iPufferSperre = pufferBlock.indexOf('std::lock_guard<std::mutex> lock(fieldMutex);');
  const iPufferPruef = pufferBlock.search(/if\s*\(\s*imAbbau\.load\(\)\s*\|\|\s*riegelVerwirft\(\s*abo\.subscribed\.load\(\)\s*,\s*abo\.umhaengen\.load\(\)\s*\)\s*\|\|\s*abo\.umhaengGeneration\.load\(\)\s*!=\s*aboGen\s*\)\s*\{\s*verworfen\s*=\s*true\s*;\s*\}\s*else\s*\{\s*bufferMismatch\s*=\s*true\s*;/);
  const iPufferSpaet = pufferBlock.search(/if\s*\(\s*verworfen\s*\)\s*\{\s*lateFrames\.fetch_add\(1\)\s*;\s*return\s*;\s*\}/);
  assert(iPufferSperre >= 0 && iPufferPruef > iPufferSperre && iPufferSpaet > iPufferPruef && iPufferSpaet < pufferBlock.indexOf('emitSlotFehler(')
      && (pufferBlock.match(/bufferMismatch\s*=\s*true/g) ?? []).length === 1,
    'F2 6.10/6.4: der Pufferfehler-Pfad prüft Riegel und Generation unter der Sperre, sonst lateFrames und nichts gesetzt');

  // Fixrunde 1, F4 (Spec 6.2 slotOn „Ton nach 6.13“, 6.13): bekommt das erste Umhängen von slotOn ein 18, meldet slotOn
  // den Ton selbst - gegen das GEWÜNSCHTE Ziel (sonst off/noShare, obwohl eine Freigabe gezeigt wird) -, und die
  // Wiederholung trägt tonMitmelden des Umhängens weiter (sonst ein zweites waiting/targetChanged). slotSet ebenso.
  assert(/\bbool\s+wiederholTonMitmelden\s*=\s*true\s*;/.test(aboStruktur)
      && /abo\.wiederholTonMitmelden\s*=\s*lauf\.tonMitmelden\s*;/.test(zweigN2a('WiederholenIn500ms'))
      && /lauf\.tonMitmelden\s*=\s*abo\.wiederholTonMitmelden\s*;/.test(wdh),
    'F4 6.13: die Wiederholung meldet den Ton nur, wenn ihr Umhängen ihn melden sollte (slotOn meldet ihn selbst)');
  assert(/lageFuer\(\s*s\s*,\s*b\.mode\s*,\s*zielImLauf\(\s*abo\s*\)\s*,\s*Grund::command\s*\)/.test(anN2a) && !/target\.load\(\)/.test(anN2a)
      && /lageFuer\(\s*s\s*,\s*s\.mode\.load\(\)\s*,\s*zielImLauf\(\s*abo\s*\)\s*,\s*Grund::command\s*\)/.test(setN2a)
      && /lauf\.ziel\s*=\s*zielImLauf\(\s*abo\s*\)\s*;/.test(setN2a) && !/target\.load\(\)/.test(setN2a),
    'F4 6.13: die Ton-Bestätigung von slotOn und slotSet rechnet mit dem gewünschten Ziel');
}
console.log('\nNativer Teil — Nachtrag N2b (Sperre nur bei echtem INMEETING, Ton-Pläne in der Sperre, Mischer-Format, bridgeStats nach dem Messen, fallbackFps, Freigabeton zurückgesetzt):');
{
  const cbN2b = nativ('callbacks.cpp', true);
  const videoN2b = nativ('video.cpp', true);

  // N2b.1 (Task-14-Review C1, Critical; Spec 6.5, 6.6 Nr. 4, 6.15): ein INMEETING, das ein späteres DISCONNECTING/
  // RECONNECTING bzw. ENDED/FAILED in derselben Pumprunde überholt hat, löst die Renderer-Sperre nicht mehr. Der
  // Status-Rückruf merkt jeden Status (vor allen Zweigen, an genau einer Stelle) und löscht den INMEETING-Merker in den
  // Zweigen Trennen/Neu-Verbinden und Ende; die INMEETING-Kette löst die Sperre nur, wenn der zuletzt gemeldete Status
  // im Meeting ist (sperreLoesenErlaubt, Logik-Fall n2b1; das Meeting-Ende löst immer). Kein Hängenbleiben: jedes
  // INMEETING setzt Merker und Status neu, und SperreLoesen liest den Status erst beim Ausführen.
  const statusN2b = rumpf(cbN2b, 'void MeetingListener::onMeetingStatusChanged(');
  const iStatusMerken = statusN2b.search(/g_letzterStatus\s*=\s*static_cast<int>\(\s*status\s*\)\s*;/);
  const iErsterZweig = statusN2b.search(/if\s*\(\s*status\s*==/);
  const zweigImMeeting = rumpf(statusN2b, 'if (status == MEETING_STATUS_INMEETING)');
  const zweigTrennt = rumpf(statusN2b, 'if (status == MEETING_STATUS_DISCONNECTING || status == MEETING_STATUS_RECONNECTING)');
  const zweigEnde = rumpf(statusN2b, 'if (status == MEETING_STATUS_ENDED || status == MEETING_STATUS_FAILED)');
  assert(/std::atomic<int>\s+g_letzterStatus\{/.test(cbN2b) && iStatusMerken >= 0 && iErsterZweig > iStatusMerken
      && (cbN2b.match(/g_letzterStatus\s*=[^=]/g) ?? []).length === 1,
    'N2b.1 6.5: der Status-Rückruf merkt jeden Meeting-Status, vor allen Zweigen, an genau einer Stelle');
  assert(/g_inMeetingOffen\s*=\s*false\s*;/.test(zweigTrennt) && /g_rendererSperre\s*=\s*true\s*;/.test(zweigTrennt)
      && /g_inMeetingOffen\s*=\s*false\s*;/.test(zweigEnde)
      && /g_inMeetingOffen\s*=\s*true\s*;/.test(zweigImMeeting) && !/g_inMeetingOffen\s*=\s*false/.test(zweigImMeeting)
      && (cbN2b.match(/g_inMeetingOffen\s*=\s*true/g) ?? []).length === 1 && (cbN2b.match(/g_inMeetingOffen\s*=\s*false/g) ?? []).length === 2,
    'N2b.1 6.5 (C1): DISCONNECTING/RECONNECTING und ENDED/FAILED löschen den INMEETING-Merker; nur INMEETING setzt ihn');
  assert(/bool\s+callbacksStatusImMeeting\(\)\s*\{\s*return\s+slotlogic::statusImMeeting\(\s*g_letzterStatus\.load\(\)\s*\)\s*;\s*\}/.test(cbN2b)
      && /static_assert\(\s*MEETING_STATUS_INMEETING\s*==\s*slotlogic::STATUS_INMEETING\b/.test(cbN2b)
      && /MEETING_STATUS_LOCKED\s*==\s*slotlogic::STATUS_LOCKED\b/.test(cbN2b) && /MEETING_STATUS_UNLOCKED\s*==\s*slotlogic::STATUS_UNLOCKED\b/.test(cbN2b),
    'N2b.1 6.5: callbacksStatusImMeeting liest den zuletzt gemeldeten Status beim Aufruf (Werte gegen den SDK-Header geprüft)');
  const ausN2b = rumpf(videoN2b, 'void abbauAusfuehren(');
  const iLoesen = ausN2b.indexOf('case AbbauSchritt::SperreLoesen:');
  const zweigLoesen = iLoesen < 0 ? '' : ausN2b.slice(iLoesen, ausN2b.indexOf('case AbbauSchritt::', iLoesen + 1));
  // Fixrunde 1, G3: „die einzige Stelle“ gezählt über ALLE native/*.cpp (Kommentare und Texte entfernt): außer der
  // Definition in callbacks.cpp genau ein Aufruf, und der steht in video.cpp; g_rendererSperre = false nur in der Definition.
  const cppDateienN2b = readdirSync(nativOrdner).filter((f) => f.endsWith('.cpp')).sort();
  const loesenAufrufe = cppDateienN2b.flatMap((d) => [...nativ(d, true).matchAll(/(?<!void\s+)\bcallbacksRendererSperreLoesen\s*\(/g)].map(() => d));
  const sperreAus = cppDateienN2b.flatMap((d) => [...nativ(d, true).matchAll(/\bg_rendererSperre\s*=\s*false\b/g)].map(() => d));
  assert(/if\s*\(\s*sperreLoesenErlaubt\(\s*kette\s*,\s*callbacksStatusImMeeting\(\)\s*\)\s*\)\s*callbacksRendererSperreLoesen\(\)\s*;/.test(zweigLoesen)
      && (videoN2b.match(/callbacksRendererSperreLoesen\(/g) ?? []).length === 1
      && loesenAufrufe.length === 1 && loesenAufrufe[0] === 'video.cpp'
      && sperreAus.length === 1 && /void\s+callbacksRendererSperreLoesen\(\)\s*\{\s*g_rendererSperre\s*=\s*false\s*;\s*\}/.test(cbN2b),
    'N2b.1 6.5/6.15: SperreLoesen löst nur mit sperreLoesenErlaubt(kette, Status im Meeting) - die einzige Stelle, die löst');
  if (loesenAufrufe.length !== 1 || sperreAus.length !== 1) console.error(`      Aufrufe: ${loesenAufrufe.join(', ')}; g_rendererSperre = false: ${sperreAus.join(', ')}`);

  // N2b.2 (Task-14-Review I1, Task-15-Review; Spec 6.5, 6.10 Schritt 0, 6.13): während der Renderer-Sperre wartet nur ein
  // Plan mit Renderer-Schritt (planBrauchtRenderer, N1.3); Ton- und Feld-Pläne (slotSet {audio|shareAudio}: TonStandNeu,
  // MischerNeu, TonMelden) laufen. Dazu der Abgleich: jeder Zweig des Ausführers, der einen Renderer anfasst, ist in
  // planBrauchtRenderer ein Renderer-Schritt - ein Plan ohne solchen Schritt erreicht nie subscribe, createRenderer oder
  // destroyRenderer.
  const ausfN2b = rumpf(videoN2b, 'void planAusfuehren(Slot& s, UmhaengLauf& lauf, const UmhaengPlan& plan) ');
  const braucht = rumpf(nativ('slot_logic.h', true), 'inline bool planBrauchtRenderer(');
  const rendererSchritte = [...braucht.slice(0, braucht.indexOf('return true;')).matchAll(/case\s+UmhaengSchritt::(\w+):/g)].map((m) => m[1]);
  const FASST_RENDERER = /\b(subscribe|unSubscribe|setRawDataResolution|getResolution|getRawDataType|createRenderer|destroyRenderer|rendererAnlegen|subscribeAusfuehren)\s*\(|\babo\.renderer\b/;
  const zweigeMitRenderer = [...ausfN2b.matchAll(/case\s+UmhaengSchritt::(\w+):/g)].map((m) => m[1]).filter((name) => {
    const i = ausfN2b.indexOf(`case UmhaengSchritt::${name}:`);
    const j = ausfN2b.indexOf('case UmhaengSchritt::', i + 1);
    return FASST_RENDERER.test(ausfN2b.slice(i, j < 0 ? ausfN2b.length : j));
  });
  assert(/^\{\s*if\s*\(\s*rendererSperre\(\)\s*&&\s*planBrauchtRenderer\(\s*plan\s*\)\s*\)\s*return\s*;/.test(ausfN2b)
      && !/schritte\.size\(\)/.test(ausfN2b) && !/UmhaengSchritt::Vormerken\)/.test(ausfN2b.slice(0, ausfN2b.indexOf('for (const UmhaengSchritt')))
      && rendererSchritte.length === 8 && zweigeMitRenderer.length === 8 && zweigeMitRenderer.every((n) => rendererSchritte.includes(n)),
    'N2b.2 6.5: planAusfuehren überspringt in der Sperre nur Pläne mit Renderer-Schritt; planBrauchtRenderer kennt jeden Renderer-Zweig (8 von 8)');
  if (!zweigeMitRenderer.every((n) => rendererSchritte.includes(n))) console.error(`      Zweige: ${zweigeMitRenderer.join(', ')}; planBrauchtRenderer: ${rendererSchritte.join(', ')}`);

  // N2b.3 (Task-15-Review I1; Spec 6.13, 6.3 slotAudio.sampleRate/channels): der Mischer schreibt in SEINEM Format
  // (rate()/kanaele(), dieselbe Wahl wie in ausgabe()). Gesendet wird genau damit, und s.ton - die Quelle von
  // slotAudio.sampleRate/channels - folgt nach jedem Einspeisen dem Mischer statt dem letzten Paket.
  const ausgeben = rumpf(videoN2b, 'void mischerAusgeben(');
  const einspeisen = rumpf(videoN2b, 'void mischerEinspeisen(');
  const iEingang = Math.max(einspeisen.indexOf('s.mix.eingangA('), einspeisen.indexOf('s.mix.eingangB('));
  assert(/s\.sender\.sendAudio\(\s*aus\.data\(\)\s*,\s*n\s*,\s*s\.mix\.rate\(\)\s*,\s*s\.mix\.kanaele\(\)\s*\)/.test(ausgeben) && !/s\.ton\b/.test(ausgeben)
      && /s\.ton\.audioRate\s*=\s*s\.mix\.rate\(\)\s*;/.test(einspeisen) && /s\.ton\.audioChannels\s*=\s*s\.mix\.kanaele\(\)\s*;/.test(einspeisen)
      && !/s\.ton\.audio(Rate|Channels)\s*=\s*p\./.test(einspeisen) && einspeisen.search(/s\.ton\.audioRate\s*=\s*s\.mix\.rate\(\)/) > iEingang && iEingang > 0,
    'N2b.3 6.13: der Mischer sendet in seinem eigenen Format; s.ton (slotAudio.sampleRate/channels) folgt ihm nach dem Einspeisen');

  // N2b.4 (Task-16-Review I1; Spec 6.3 „keine erfundenen Werte“, 6.17): kein wenn(/pflicht(-Aufruf misst und liest im
  // selben Aufruf - die Reihenfolge der Argumente ist unbestimmt (MSVC meist rechts nach links), der Wert entstünde vor
  // der Messung. Je Aufruf: eine Variable, deren Adresse ein Argument übergibt, kommt im Aufruf sonst nicht vor. Dazu in
  // bridgeStatsTick: jede session…-Messung steht für sich in einer eigenen const bool.
  const aufrufeN2b: string[] = [];
  for (const m of videoN2b.matchAll(/\b(wenn|pflicht)\(/g)) {
    let tiefe = 0;
    for (let i = (m.index ?? 0) + m[0].length - 1; i < videoN2b.length; i++) {
      if (videoN2b[i] === '(') tiefe++;
      else if (videoN2b[i] === ')' && --tiefe === 0) { aufrufeN2b.push(videoN2b.slice(m.index ?? 0, i + 1)); break; }
    }
  }
  const messenUndLesen = aufrufeN2b.filter((a) => [...a.matchAll(/[(,]\s*&\s*([A-Za-z_]\w*)/g)]
    .some((m) => (a.match(new RegExp(`\\b${m[1]}\\b`, 'g')) ?? []).length > 1));
  const statsN2b = rumpf(videoN2b, 'void bridgeStatsTick(bool initGelaufen)');
  const sessionMessungen = [...statsN2b.matchAll(/\bsession\w+\(/g)].map((m) => statsN2b.slice(statsN2b.lastIndexOf(';', m.index ?? 0) + 1, m.index ?? 0));
  assert(aufrufeN2b.length > 40 && messenUndLesen.length === 0 && sessionMessungen.length === 4
      && sessionMessungen.every((vor) => /^\s*const\s+bool\s+\w+\s*=\s*$/.test(vor)),
    'N2b.4 6.3: kein wenn(/pflicht(-Aufruf misst und liest dieselbe Variable; bridgeStats misst zuerst (eigene const bool)');
  if (messenUndLesen.length > 0) console.error(`      Treffer: ${messenUndLesen.map((a) => a.replace(/\s+/g, ' ').slice(0, 70)).join(' | ')}`);

  // N2b.5 (Task-16-Review I2; Spec 6.17 „fallbackFps, heldFrames | Herzschlag | gesendete Ersatz- und Haltebilder je
  // Sekunde bzw. gehaltene Bilder seit dem Umhängen“; 12 und FR9: „fallbackFps zählt auch die Haltebilder“): jedes
  // gesendete Ersatz- oder Haltebild zählt in fallbackCount (Quelle von fallbackFps), ein Haltebild zusätzlich in
  // heldFrames (je Ziel).
  const sendeBlock = rumpf(rumpf(videoN2b, 'void ersatzbildTick('), 'if (e.jetztSenden && e.sent != Sent::None)');
  assert(/s\.fallbackCount\.fetch_add\(1\)\s*;\s*if\s*\(\s*e\.sent\s*==\s*Sent::Held\s*\)\s*s\.heldFrames\.fetch_add\(1\)\s*;/.test(sendeBlock)
      && !/else\s+s\.fallbackCount/.test(sendeBlock) && (videoN2b.match(/fallbackCount\.fetch_add\(/g) ?? []).length === 1
      && /const\s+uint64_t\s+ersatz\s*=\s*s\.fallbackCount\.load\(\)\s*-\s*s\.statsFallback\s*;/.test(rumpf(videoN2b, 'void slotStatsMelden('))
      && /pflicht\("fallbackFps",\s*jeSekunde\(\s*ersatz\s*\)\)/.test(rumpf(nativ('video.cpp'), 'void slotStatsMelden(')),
    'N2b.5 6.17: fallbackFps zählt jedes gesendete Ersatz- UND Haltebild; Haltebilder zusätzlich in heldFrames');

  // N2b.6 (Task-16-Review I3; Spec 6.17 „fehlt ein Wert, ist nichts angekommen“, B55, GG22): das Format des
  // Computertons (shareAudioRate/-Ch) gehört zum Ton-Stand. TonStandNeu (Computerton aus, Freigabewechsel mit Tonweg
  // share, Moduswechsel aus einem Computerton-Weg) und MischerEingangBNeu (Freigabewechsel im Mischer-Slot, dort ohne
  // TonStandNeu, RR8) setzen es zurück; slotStats lässt die Felder bei 0 weg.
  const planZweigN2b = (name: string): string => {
    const i = ausfN2b.indexOf(`case UmhaengSchritt::${name}:`);
    if (i < 0) return '';
    const j = ausfN2b.indexOf('case UmhaengSchritt::', i + 1);
    return ausfN2b.slice(i, j < 0 ? ausfN2b.length : j);
  };
  const tonNeuN2b = planZweigN2b('TonStandNeu');
  const eingangBN2b = planZweigN2b('MischerEingangBNeu');
  const statsMitTexten = rumpf(nativ('video.cpp'), 'void slotStatsMelden(');
  assert([tonNeuN2b, eingangBN2b].every((z) => /s\.shareRate\s*=\s*0\s*;/.test(z) && /s\.shareCh\s*=\s*0\s*;/.test(z))
      && /s\.ton\s*=\s*TonStand\{\}\s*;/.test(tonNeuN2b) && /s\.mix\.eingangBNeu\(\)\s*;/.test(eingangBN2b)
      && /wenn\(\s*s\.shareRate\s*>\s*0\s*,\s*"shareAudioRate"/.test(statsMitTexten) && /wenn\(\s*s\.shareRate\s*>\s*0\s*,\s*"shareAudioCh"/.test(statsMitTexten),
    'N2b.6 6.17: TonStandNeu und MischerEingangBNeu setzen das Format des Computertons zurück; slotStats lässt es dann weg');

  // N2b Fixrunde 1, G1 (Review; Spec 6.15 „leave nach einem sessionLeave(), das false lieferte: nichts; die Einträge
  // bleiben bis zum Prozessende stehen, kein Aufruf am Renderer“): leave ändert g_meetingNr nicht - ohne Einfrieren
  // erreichte jedes spätere INMEETING desselben Meetings HaltelisteAbbauen (unSubscribe/destroyRenderer). Der
  // Nachlauf-Schritt HaltelisteEinfrieren gibt den Einträgen dieses Meetings eine Nummer, die nie trifft
  // (kMeetingEingefroren = -1; g_meetingNr beginnt bei 0, nur join zählt hoch), ruft keine Renderer-Funktion, löscht
  // nichts und gibt keinen Delegate frei; Abbauen und Verwerfen filtern weiter nach der Meeting-Nummer.
  const abbauZweigG1 = (name: string): string => {
    const i = ausN2b.indexOf(`case AbbauSchritt::${name}:`);
    if (i < 0) return '';
    const j = ausN2b.indexOf('case AbbauSchritt::', i + 1);
    return ausN2b.slice(i, j < 0 ? ausN2b.length : j);
  };
  const einfrierenG1 = abbauZweigG1('HaltelisteEinfrieren');
  const RENDERER_G1 = /\b(subscribe|unSubscribe|setRawDataResolution|createRenderer|destroyRenderer)\s*\(/;
  const meetingNrSchreiben = videoN2b.match(/\bg_meetingNr\s*[-+]?=(?!=)|(\+\+|--)\s*g_meetingNr\b|\bg_meetingNr\s*(\+\+|--)/g) ?? [];
  assert(einfrierenG1 !== '' && /constexpr\s+int\s+kMeetingEingefroren\s*=\s*-1\s*;/.test(videoN2b)
      && /if\s*\(\s*(\w+)\.meeting\s*==\s*g_meetingNr\s*\)\s*\1\.meeting\s*=\s*kMeetingEingefroren\s*;/.test(einfrierenG1)
      && !RENDERER_G1.test(einfrierenG1) && !/erase\(|renderer\s*=|delegate|reset\(/.test(einfrierenG1)
      && /\bint\s+g_meetingNr\s*=\s*0\s*;/.test(videoN2b) && /void\s+slotsMeetingNeu\(\)\s*\{\s*\+\+g_meetingNr\s*;\s*\}/.test(videoN2b)
      && meetingNrSchreiben.length === 2
      // HaltelisteAbbauen seit dem Abschluss-Fix F3 über halteEintragGehoertZu (derselbe Vergleich, PB20)
      && /it->meeting\s*!=\s*g_meetingNr|!halteEintragGehoertZu\(\s*static_cast<uint32_t>\(\s*it->meeting\s*\)\s*,\s*static_cast<uint32_t>\(\s*g_meetingNr\s*\)\s*\)/.test(abbauZweigG1('HaltelisteAbbauen'))
      && /it->meeting\s*!=\s*g_meetingNr/.test(abbauZweigG1('HaltelisteVerwerfen')),
    'G1 6.15: HaltelisteEinfrieren nimmt die Einträge dieses Meetings aus Abbauen/Verwerfen (Nummer -1), ohne Renderer-Aufruf und ohne Löschen');

  // N2b Fixrunde 1, G2: die Zeile „INMEETING ist überholt … Renderer-Sperre bleibt“ nur, wenn die Sperre wirklich steht
  // (sonst z. B. beim ersten Beitritt mit Warteraum in derselben Pumprunde - eine Zeile, die lügt).
  assert(/callbacksRendererSperreLoesen\(\)\s*;\s*else\s+if\s*\(\s*rendererSperre\(\)\s*\)\s*emitLog\(/.test(zweigLoesen)
      && (zweigLoesen.match(/\bemitLog\s*\(/g) ?? []).length === 1,
    'G2 6.5: SperreLoesen meldet die überholte INMEETING-Kette nur bei gesetzter Sperre');

  // N2b Fixrunde 1, G4 (zu N2b.3): nach MischerEingangBNeu (Eingang B leer) schreibt der Mischer im Format von A -
  // s.ton (slotAudio.sampleRate/channels) folgt ihm sofort unter fieldMutex, nicht erst mit dem nächsten Paket.
  const eingangBG4 = planZweigN2b('MischerEingangBNeu');
  const iNeuG4 = eingangBG4.indexOf('s.mix.eingangBNeu();');
  const iSperreG4 = eingangBG4.search(/std::lock_guard<std::mutex>\s+lock\(s\.fieldMutex\)\s*;/);
  assert(iNeuG4 > 0 && iSperreG4 > iNeuG4
      && eingangBG4.search(/s\.ton\.audioRate\s*=\s*s\.mix\.rate\(\)\s*;/) > iSperreG4
      && eingangBG4.search(/s\.ton\.audioChannels\s*=\s*s\.mix\.kanaele\(\)\s*;/) > iSperreG4,
    'G4 6.13: MischerEingangBNeu setzt s.ton aus dem Mischer-Format (unter fieldMutex, nach eingangBNeu)');
}
console.log('\nDoku — Nachtrag N3 (README an Sperre, Halteliste, Wiederholung, Mischer und Messwerte angeglichen):');
{
  const readme = a17Lies(join(testDir, '..', 'README.md'), 'utf8').replace(/\r\n/g, '\n');
  const a7 = readme.indexOf('\n## 7 · ');
  const e7 = readme.indexOf('\n## ', a7 + 1);
  const s7 = readme.slice(a7, e7 < 0 ? undefined : e7);
  const flach7 = s7.replace(/\s+/g, ' ');
  /** Der Absatz, der mit `**<kopf>**` beginnt, bis zur Leerzeile, flach; sonst ''. */
  const absatz = (kopf: string): string => {
    const i = s7.indexOf(`\n${kopf}`);
    if (i < 0) return '';
    const j = s7.indexOf('\n\n', i + 1);
    return s7.slice(i, j < 0 ? undefined : j).replace(/\s+/g, ' ');
  };
  const zeile7 = (anfang: string): string => s7.split('\n').find((l) => l.startsWith(anfang)) ?? '';

  const sperre = absatz('**Renderer-Sperre.**');
  assert(
    sperre.includes('nur, wenn der zuletzt gemeldete Meeting-Status noch ein laufendes Meeting ist: `INMEETING`, `LOCKED` oder `UNLOCKED`')
      && sperre.includes('Bei `DISCONNECTING`, `RECONNECTING`, `ENDED` und `FAILED` fällt ein noch nicht abgearbeitetes `INMEETING` weg')
      && sperre.includes('Ton- und Feld-Pläne')
      && sperre.includes('laufen auch während der Sperre')
      && sperre.includes('Ein Moduswechsel (`slotSet {mode}`) während der Sperre geht nicht verloren')
      && sperre.includes('nach dem vorgemerkten Modus'),
    'N3 N2b.1/N2a.7: README nennt die Bedingung der Sperre (INMEETING, LOCKED, UNLOCKED), Ton-Pläne während der Sperre, vorgemerkten Modus');

  const halt = absatz('**Halteliste.**');
  assert(
    halt.includes('Liefert `sessionLeave()` bei `leave` false') && halt.includes('friert die Bridge die Einträge dieses Meetings ein')
      && halt.includes('bis zum Prozessende') && halt.includes('ohne Aufruf am Renderer') && halt.includes('`bridgeStats.halteliste`'),
    'N3 N2b-G1: README beschreibt die eingefrorene Halteliste nach leave (kein Renderer-Aufruf, bis Prozessende)');

  const wdh = absatz('**Wiederholung nach Fehler 18.**');
  assert(
    wdh.includes('höchstens dreimal im Abstand von 500 ms') && wdh.includes('das gewünschte Ziel, den Modus und den Grund der laufenden Umhängung')
      && wdh.includes('`participantLeft`') && wdh.includes('`resolutionChanged`')
      && wdh.includes('Ist der Renderer inzwischen tot, legt die Wiederholung einen neuen an')
      && wdh.includes('`slotSubscribeFailed` kann auch danach noch kommen')
      && wdh.includes('löst keinen zweiten Abschluss aus'),
    'N3 N2a.2/N2a.3/N1.2: README beschreibt die Wiederholung nach 18 (gewünschtes Ziel, neuer Renderer, ein Abschluss)');
  assert(
    zeile7('| `slotSubscribeFailed` |').includes('auch bei der Wiederholung nach Fehler 18 und nach neuem Renderer'),
    'N3 N2a.3: die Fehlerschlüssel-Zeile slotSubscribeFailed nennt die Wiederholung');

  const ton = absatz('**Ton je Slot.**');
  assert(
    ton.includes('**eigener Uhr**') && ton.includes('höchstens 200 ms aus')
      && ton.includes('bewusste Abweichung von Spec 6.13') && ton.includes('verworfen in `mixDrops` (`slotStats`, Millisekunden)')
      && ton.includes('Er sendet im eigenen Format, nämlich Rate und Kanalzahl des Computertons')
      && ton.includes('geht nur der Computerton hinaus'),
    'N3 N1.1/N2b.3: README nennt die Kappe von 200 ms (Abweichung von Spec 6.13), mixDrops und das eigene Format des Mischers');

  const messwerte = absatz('**Messwerte.**');
  assert(
    messwerte.includes('`fallbackFps` zählt die gesendeten Ersatzbilder und die Haltebilder')
      && messwerte.includes('`shareAudioRate` und `shareAudioCh` stehen in `slotStats`, nicht in `bridgeStats`')
      && messwerte.includes('fallen bei neuem Ton-Stand und bei neuem Eingang B des Mischers wieder weg'),
    'N3 N2b.5/N2b.6: README nennt fallbackFps mit Haltebildern und den Ort/das Zurücksetzen von shareAudioRate/-Ch');

  assert(
    zeile7('| Teilnehmer (`participant`) |').includes('steht sie nicht in der Teilnehmerliste: kein Ziel (`noTarget`), ohne `subscribe`')
      && zeile7('| Aktiver Sprecher (`speaker`) |').includes('Ein `slotSet {showNoVideo}`, das die Wahl ändert, hängt den Sprecher-Slot sofort um')
      && absatz('**Bild-Versatz ohne Freigabe.**').includes('auch gleich nach `slotOn`'),
    'N3 N2a.4/N2a.5/N2a.6: README nennt unbekannte Kennung (noTarget), showNoVideo mit Umhängen, Freigabe-Slot ohne Versatz ab slotOn');

  // Keine ASCII-Anführungszeichen in den neuen Nutzertexten (Regel des Briefs): die Absätze oben enthalten keine
  // (der alte Ton-Absatz führt `audio:"person"` als Code und bleibt darum außen vor).
  assert(![sperre, halt, wdh, messwerte].some((t) => t.includes('"')), 'N3: die neuen README-Absätze enthalten keine ASCII-Anführungszeichen');
  assert(flach7.includes('Spec 6.5 sagt nur „bis `INMEETING`“'), 'N3 N2b.1: die README nennt die Abweichung von Spec 6.5 (LOCKED/UNLOCKED zählen mit)');
}
console.log('\nNativer Teil — Abschluss-Fix Plan A (Delegates bis Prozessende, 18-Wartezeit, Abbau über getestete Helfer, Wächter):');
{
  const vAF = nativ('video.cpp', true);   // ohne Kommentare und ohne Texte
  const vAFt = nativ('video.cpp');        // ohne Kommentare, mit Texten
  const logikAF = nativ('slot_logic.h', true);
  const ausfAF = rumpf(vAF, 'void planAusfuehren(Slot& s, UmhaengLauf& lauf, const UmhaengPlan& plan) ');
  const planZweigAF = (name: string): string => {
    const i = ausfAF.indexOf(`case UmhaengSchritt::${name}:`);
    if (i < 0) return '';
    const j = ausfAF.indexOf('case UmhaengSchritt::', i + 1);
    return ausfAF.slice(i, j < 0 ? ausfAF.length : j);
  };
  const abbauAF = rumpf(vAF, 'void abbauAusfuehren(');
  const abbauZweigAF = (name: string): string => {
    const i = abbauAF.indexOf(`case AbbauSchritt::${name}:`);
    if (i < 0) return '';
    const j = abbauAF.indexOf('case AbbauSchritt::', i + 1);
    return abbauAF.slice(i, j < 0 ? abbauAF.length : j);
  };
  const vorDem = (text: string, a: string, b: string): boolean => text.indexOf(a) >= 0 && text.indexOf(b) > text.indexOf(a);
  const RENDERER_AF = /\b(subscribe|unSubscribe|setRawDataResolution|createRenderer|destroyRenderer)\s*\(/g;

  // F1 (Abschlussprüfung I-1; Spec 6.10 Schritt 2, 6.15 Halteliste „das SDK ruft beim Abbau eines Renderers dessen
  // Delegate“, AN11): kein Delegate, den das SDK noch rufen kann, wird frei. Alle Delegates gehören g_delegates (new ohne
  // delete, die Liste wächst nur); das Abo zeigt nur auf seinen. Wer einen Renderer verwirft, abbaut oder seinen Slot
  // löscht, setzt vorher Delegate::abgemeldet; die drei Rückrufe prüfen es ZUERST und fassen danach weder Slot noch Abo an.
  const delegateKlasse = rumpf(vAF, 'class Delegate : public IZoomSDKRendererDelegate');
  const aboAF = rumpf(vAF, 'struct Abo ');
  const [zerstoert, bild, status] = ['void Delegate::onRendererBeDestroyed(', 'void Delegate::onRawDataFrameReceived(',
    'void Delegate::onRawDataStatusChanged('].map((k) => rumpf(vAF, k));
  const zugriffNachRueckkehr = (r: string): boolean => {
    const zugriff = r.search(/\b(slot_|abo_)/);
    const rueck = r.search(/\breturn\s*;/);
    return r !== '' && rueck >= 0 && (zugriff < 0 || rueck < zugriff);
  };
  // Seit F15 prüft jeder Rückruf abgemeldet über den Flug-Wächter RueckrufImFlug (erst zählen, dann prüfen): die erste
  // Anweisung legt ihn an, die zweite kehrt ohne drin() zurück - vor jedem Zugriff auf Slot oder Abo.
  const FLUG = /^\{\s*const\s+RueckrufImFlug\s+(\w+)\(\s*wache\s*\)\s*;/;
  const flugName = (r: string): string => FLUG.exec(r)?.[1] ?? '\\u0000';
  assert(/\bRueckrufWache\s+wache\s*;/.test(delegateKlasse)
      && new RegExp(`^\\{\\s*const\\s+RueckrufImFlug\\s+(\\w+)\\(\\s*wache\\s*\\)\\s*;\\s*if\\s*\\(\\s*!${flugName(bild)}\\.drin\\(\\)\\s*\\|\\|\\s*data\\s*==\\s*nullptr\\s*\\)\\s*return\\s*;`).test(bild)
      && new RegExp(`^\\{\\s*const\\s+RueckrufImFlug\\s+(\\w+)\\(\\s*wache\\s*\\)\\s*;\\s*if\\s*\\(\\s*!${flugName(status)}\\.drin\\(\\)\\s*\\)\\s*return\\s*;`).test(status)
      && FLUG.test(zerstoert) && new RegExp(`if\\s*\\(\\s*!${flugName(zerstoert)}\\.drin\\(\\)\\s*\\)\\s*return\\s*;`).test(zerstoert)
      && [zerstoert, bild, status].every(zugriffNachRueckkehr),
    'AF1 6.10/6.15 (I-1): Delegate::abgemeldet - alle drei Rückrufe prüfen es zuerst und kehren vor jedem Zugriff auf Slot oder Abo zurück');
  // Seit F15 durchsucht slotFreigabeAbwarten g_delegates (zwei Bereichsschleifen, nur lesend); sonst nur push_back/back.
  const vohneFreigabe = vAF.replace(rumpf(vAF, 'bool slotFreigabeAbwarten(Slot& s)'), '{}');
  const delegatesNutzung = [...vohneFreigabe.matchAll(/\bg_delegates\b(\s*\.\s*(\w+))?/g)].map((m) => m[2] ?? '');
  const delegateZuweisungen = [...vAF.matchAll(/\bdelegate\s*=(?!=)\s*([^;]*);/g)].map((m) => m[1].trim());
  assert(/std::vector<Delegate\*>\s+g_delegates\s*;/.test(vAF)
      && delegatesNutzung.filter((n) => n === '').length === 1 && delegatesNutzung.every((n) => ['', 'push_back', 'back'].includes(n))
      && (vAF.match(/\bnew\s+Delegate\s*\(/g) ?? []).length === 1 && /\bnew\s+Delegate\s*\(/.test(rumpf(vAF, 'Delegate* neuerDelegate('))
      && !/\bdelete\b/.test(vAF) && !/unique_ptr<\s*Delegate\s*>/.test(vAF) && !/\balteDelegates\b/.test(vAF)
      && /Delegate\*\s+delegate\s*=\s*nullptr\s*;/.test(aboAF)
      && delegateZuweisungen.length >= 4 && delegateZuweisungen.every((z) => /^neuerDelegate\(\s*s\s*,\s*abo\s*\)$|^nullptr$/.test(z)),
    'AF1 (I-1): jeder Delegate entsteht in neuerDelegate und gehört g_delegates bis zum Prozessende - kein delete, kein erase, kein unique_ptr<Delegate>');
  const typwechselAF = planZweigAF('CreateRendererTypwechsel');
  assert(!/CreateRendererGleicherDelegate/.test(logikAF + vAF) && /case\s+UmhaengSchritt::CreateRendererTypwechsel\s*:/.test(rumpf(logikAF, 'inline bool planBrauchtRenderer('))
      && vorDem(typwechselAF, 'abo.delegate = neuerDelegate(s, abo);', 'rendererAnlegen(abo)') && /s\.rendererNew\.fetch_add\(1\)/.test(typwechselAF)
      && vorDem(planZweigAF('CreateRendererNeuerDelegate'), 'abo.delegate = neuerDelegate(s, abo);', 'rendererAnlegen(abo)')
      && !/rendererNew/.test(planZweigAF('CreateRendererNeuerDelegate')),
    'AF1 6.10 (Ruling, Abweichung von AN11): der Typwechsel legt den neuen Renderer mit einem NEUEN Delegate an; rendererNew zählt weiter nur diesen Fall');
  const slotOnText = rumpf(vAFt, 'void slotOn(const SlotBefehl& b)');
  // Seit F15 setzt delegateAbmelden den Merker über rueckrufAbmelden (seq_cst); zwischen Abmelden und return true steht
  // in SlotLoeschen das Abwarten der Rückrufe im Flug.
  assert(/void\s+delegateAbmelden\(\s*Abo&\s*abo\s*\)\s*\{\s*if\s*\(\s*abo\.delegate\s*!=\s*nullptr\s*\)\s*rueckrufAbmelden\(\s*abo\.delegate->wache\s*\)\s*;\s*\}/.test(vAF)
      && vorDem(planZweigAF('ZeigerVerwerfen'), 'delegateAbmelden(abo);', 'abo.delegate = nullptr;')
      && vorDem(planZweigAF('DestroyRenderer'), 'delegateAbmelden(abo);', 'destroyRenderer(')
      && /for\s*\(\s*auto&\s*abo\s*:\s*s->abos\s*\)\s*delegateAbmelden\(\s*\*abo\s*\)\s*;/.test(abbauZweigAF('SlotLoeschen'))
      && vorDem(abbauZweigAF('SlotLoeschen'), 'delegateAbmelden(*abo);', 'return true;')
      && vorDem(abbauZweigAF('HaltelisteAbbauen'), 'delegateAbmelden(*abo);', 'g_slotsHalt.erase(')
      && vorDem(abbauZweigAF('HaltelisteVerwerfen'), 'delegateAbmelden(*abo);', 'g_slotsHalt.erase(')
      && vorDem(slotOnText, 'delegateAbmelden(abo);', '"slotRendererFailed"'),
    'AF1 (I-1): abgemeldet wird beim Verwerfen (rendererTot), beim Typwechsel vor destroyRenderer, vor dem Löschen eines Slots, beim Leeren der Halteliste und im Fehlerpfad von slotOn');
  assert((zerstoert.match(/\bemitLog\s*\(/g) ?? []).length === 1 && /std::to_wstring\(\s*nr_\s*\)/.test(zerstoert) && /\bint\s+nr_\s*;/.test(delegateKlasse)
      && zerstoert.indexOf('emitLog(') < zerstoert.search(/\b(slot_|abo_)/)
      && /rendererTot\.exchange\(true\)/.test(zerstoert) && /rendererLost\.fetch_add\(1\)/.test(zerstoert),
    'AF1 Abnahme Gruppe L: onRendererBeDestroyed schreibt eine stderr-Zeile mit der Slot-Nummer aus dem Delegate (nr_), auch nach dem Abmelden');

  // F3 (SG1, SG2, M3 teilweise; Spec 6.5, 6.10 Schritt 2, B32): im Slot-Block rufen Unsubscribe und DestroyRenderer den
  // Renderer nur mit !rendererTot und ohne Sperre (fuerSlot hier nicht: er brächte für einen toten Renderer eine
  // zusätzliche stderr-Zeile aus ZeigerVerwerfen - der Brief erlaubt die Helfer nur ohne Verhaltensänderung).
  // HaltelisteAbbauen nimmt die getesteten Helfer halteEintragGehoertZu und halteEintragAbbauen (PB20 prüft so den
  // echten Weg) und überspringt in der Sperre.
  const BEDINGUNG_SLOT = /if\s*\(\s*abo->renderer\s*!=\s*nullptr\s*&&\s*!abo->rendererTot\.load\(\)\s*&&\s*!rendererSperre\(\)\s*\)/;
  assert(['Unsubscribe', 'DestroyRenderer'].every((n) => {
    const z = abbauZweigAF(n);
    const aufrufe = [...z.matchAll(RENDERER_AF)].map((m) => m.index ?? -1);
    const i = z.search(BEDINGUNG_SLOT);
    return i >= 0 && aufrufe.length === 1 && aufrufe[0] > i;
  }), 'AF3 SG1 (B32, 6.5): im Abbau rufen Unsubscribe und DestroyRenderer den Renderer nur mit !rendererTot und ohne Renderer-Sperre');
  const halteAbAF = abbauZweigAF('HaltelisteAbbauen');
  const iFilterAF = halteAbAF.search(/if\s*\(\s*!halteEintragGehoertZu\(\s*static_cast<uint32_t>\(\s*it->meeting\s*\)\s*,\s*static_cast<uint32_t>\(\s*g_meetingNr\s*\)\s*\)\s*\|\|\s*rendererSperre\(\)\s*\)\s*\{\s*\+\+it\s*;\s*continue\s*;\s*\}/);
  const schritteAF = /for\s*\(\s*const\s+AbbauSchritt\s+(\w+)\s*:\s*halteEintragAbbauen\(\s*abo->rendererTot\.load\(\)\s*\)\s*\)/.exec(halteAbAF);
  const rendererHalteAF = [...halteAbAF.matchAll(RENDERER_AF)].map((m) => m.index ?? -1);
  assert(iFilterAF >= 0 && schritteAF !== null && (schritteAF.index ?? -1) > iFilterAF && rendererHalteAF.length === 2
      && rendererHalteAF.every((i) => i > (schritteAF.index ?? 0))
      && new RegExp(`if\\s*\\(\\s*${schritteAF[1]}\\s*==\\s*AbbauSchritt::Unsubscribe\\s*\\)\\s*logSdkError\\([^;]*->unSubscribe\\(\\)\\s*\\)\\s*;`).test(halteAbAF)
      && new RegExp(`if\\s*\\(\\s*${schritteAF[1]}\\s*==\\s*AbbauSchritt::DestroyRenderer\\s*\\)\\s*logSdkError\\([^;]*destroyRenderer\\(\\s*abo->renderer\\s*\\)\\s*\\)\\s*;`).test(halteAbAF),
    'AF3 SG1/SG2 (M3, PB20): HaltelisteAbbauen filtert mit halteEintragGehoertZu, überspringt in der Sperre und ruft nur, was halteEintragAbbauen(rendererTot) plant');
  const sharesAF = rumpf(vAF, 'void emitShares(const char* seeded)');
  assert(/const\s+char\*\s+(\w+)\s*=\s*sharingStatusName\(\s*r\.status\s*\)\s*;\s*if\s*\(\s*\1\s*==\s*nullptr\s*\)\s*continue\s*;/.test(sharesAF)
      && !/SHARING_STATUS_NAMEN/.test(sharesAF),
    'AF3 M3 (6.3): shares.recent nennt den Status über sharingStatusName; ein unbekannter Wert wird nicht gemeldet (kein „unknown“)');

  // F4 (SG3; Spec 6.1 Thread-Regel, PT6 a): auch Slot::bildAnkunft, der eigentliche Bild-Rückruf, fasst weder g_slots noch
  // eine andere Hauptthread-Liste an und ruft keine Renderer-, slot…- oder videoParticipant…-Funktion.
  const GLOBAL_HAUPTTHREAD = /\b(g_slots|g_slotsHalt|g_slotsImFlug|g_delegates|g_freigaben|g_erinnerung|g_sprecher)\b/;
  const sdkRuempfeAF: Array<[string, string]> = [['Slot::bildAnkunft', rumpf(vAF, 'void Slot::bildAnkunft(')], ...rueckrufRuempfe(vAF)];
  const verstossAF = sdkRuempfeAF.filter(([, k]) => k === '' || RUECKRUF_VERBOTEN.test(k) || GLOBAL_HAUPTTHREAD.test(k)).map(([n]) => n);
  assert(sdkRuempfeAF.length >= 4 && verstossAF.length === 0,
    'AF4 PT6 a (SG3): weder Slot::bildAnkunft noch ein Delegate-Rückruf ruft Renderer-, slot…- oder videoParticipant…-Funktionen oder fasst g_slots, Halteliste, g_delegates an');
  if (verstossAF.length > 0) console.error(`      Verstoß in: ${verstossAF.join(', ')}`);

  // F7 (M1 d; Spec 6.2 slotSet „Bestätigung immer mit einem slot-Ereignis“): merkt die Renderer-Sperre das Umhängen eines
  // slotSet nur vor (6.10 Schritt 0), bestätigt slotRetargetIntern mit dem aktuellen Stand und Grund command - nur für
  // slotSet (Merker mit Aufräumer), nicht für Sprecher, Freigabe oder Weggang.
  const bauAF = rumpf(vAF, 'void slotRetargetIntern(');
  const setAF = rumpf(vAF, 'void slotSet(const SlotAenderung& a)');
  assert(/if\s*\(\s*nurVormerken\s*\)\s*\{\s*if\s*\(\s*s\.slotSetLaeuft\s*\)\s*slotBestaetigen\(\s*s\s*\)\s*;\s*return\s*;\s*\}/.test(bauAF)
      && vorDem(setAF, 's.slotSetLaeuft = true;', 'slotRetarget(') && /~\w+\(\)\s*\{\s*s->slotSetLaeuft\s*=\s*false\s*;\s*\}/.test(setAF)
      && /slotBestaetigen\(\s*s\s*\)\s*;\s*\}$/.test(setAF.trim())
      && /s\.grund\s*=\s*Grund::command\s*;[\s\S]*emitSlot\(\s*s\s*\)\s*;/.test(rumpf(vAF, 'void slotBestaetigen(Slot& s)'))
      && (vAF.match(/\bslotSetLaeuft\s*=\s*true/g) ?? []).length === 1,
    'AF7 6.2 (M1 d): ein slotSet, dessen Umhängen die Renderer-Sperre nur vormerkt, bestätigt mit einem slot-Ereignis (aktueller Stand, Grund command)');

  // F8 a/e (M1 a, e; die Spec schweigt, die EXE folgt der Attrappe): slot off trägt das aktuelle Paar target/share; der
  // erste Freigabe-Slot nach dem Leeren der Liste (INMEETING, leave, Meeting-Ende, quit) ergänzt einmal (seeded einmal).
  const offAF = rumpf(vAF, 'void emitSlotOff(Slot& s, Grund grund)');
  const slotEvAF = rumpf(vAF, 'void emitSlot(Slot& s)');
  assert(/zielPaar\(\s*s\s*,/.test(offAF) && /zielPaar\(\s*s\s*,/.test(slotEvAF) && !/\\"target\\":0,\\"share\\":0/.test(rumpf(vAFt, 'void emitSlotOff(Slot& s, Grund grund)'))
      && /std::to_string\(\s*target\s*\)/.test(offAF) && /std::to_string\(\s*share\s*\)/.test(offAF),
    'AF8 a (M1 a, wie die Attrappe): slot off trägt das aktuelle Paar target/share (zielPaar wie jedes slot-Ereignis), nicht 0/0');
  assert(/if\s*\(\s*!g_freigabenErgaenzt\s*\)\s*\{\s*g_freigabenErgaenzt\s*=\s*true\s*;\s*freigabenBefuellen\(\s*true\s*\)\s*;\s*\}/.test(rumpf(vAF, 'unsigned zielNachModus('))
      && /g_freigabenErgaenzt\s*=\s*false\s*;/.test(abbauZweigAF('FreigabenLeeren')) && !/\bandererFreigabeSlot\b/.test(vAF),
    'AF8 e (M1 e, wie die Attrappe): der erste Freigabe-Slot nach dem Leeren der Liste ergänzt einmal (seeded einmal je Meeting)');

  // F9 (M2; Spec 6.16): previewMode bestätigt den tatsächlichen Zustand - nach previewUnavailable on:false.
  const modusAF = rumpf(nativ('preview.cpp'), 'void vorschauModus(bool an)');
  assert(/\(\s*g_an\.load\(\)\s*\?\s*"true"\s*:\s*"false"\s*\)/.test(modusAF) && !/\(\s*an\s*\?\s*"true"/.test(modusAF),
    'AF9 6.16 (M2): previewMode bestätigt den tatsächlichen Zustand (g_an), nach previewUnavailable also on:false');

  // F10 (M4; Spec 6.3 speakerSignal.ms „Bridge-Uhr“): eine Uhr für speakerSignal.ms und shares.recent[].ms - jetztMs()
  // (GetTickCount64, ms), dieselbe, die die Slot-Logik bekommt (A12).
  const sprecherAF = rumpf(vAFt, 'void slotsSprecher(const MerkerSprecher& m)');
  assert(/\\"ms\\":"\s*\+\s*std::to_string\(\s*jetzt\s*\)/.test(sprecherAF) && !/m\.qpc/.test(sprecherAF)
      && /const\s+int64_t\s+jetzt\s*=\s*jetztMs\(\)\s*;/.test(sprecherAF)
      && /g_freigabeRecent\.push_back\(\s*FreigabeRueckruf\{\s*jetztMs\(\)\s*,/.test(rumpf(vAF, 'void slotsFreigabe(const MerkerFreigabe& f)'))
      && /int64_t\s+jetztMs\(\)\s*\{\s*return\s+static_cast<int64_t>\(\s*GetTickCount64\(\)\s*\)\s*;\s*\}/.test(vAF)
      // Restpunkt R-e der Nachprüfung: MerkerSprecher.qpc wurde nach F10 nur noch geschrieben - entfernt
      && /struct\s+MerkerSprecher\s*\{\s*int\s+signal\s*=\s*0\s*;\s*std::vector<unsigned>\s+ids\s*;\s*\}\s*;/.test(nativ('callbacks.h', true))
      && !/\bqpcJetzt\b|\.qpc\b/.test(nativ('callbacks.cpp', true)),
    'AF10 6.3 (M4): speakerSignal.ms und shares.recent[].ms kommen aus derselben Bridge-Uhr (jetztMs, GetTickCount64, ms)');

  // F11 (M5, Ruling; Spec 6.13 „bleibt ohne Ton … bis an ihm Ton wieder eingeschaltet wird“): tonSicht gibt den Merker
  // weiter, tonZiele überspringt solche Slots (Logik-Fall af11).
  assert(/TonSlotSicht\{[^}]*s->tonAudioUnavailable\s*\}/.test(rumpf(vAF, 'std::vector<TonSlotSicht> tonSicht()'))
      && /if\s*\(\s*!s\.laeuft\s*\|\|\s*s\.tonAudioUnavailable\s*\)\s*continue\s*;/.test(rumpf(logikAF, 'inline std::vector<TonZiel> tonZiele(')),
    'AF11 6.13 (M5, Ruling): ein Slot auf off/audioUnavailable fällt aus tonSicht/tonZiele, bis an ihm Ton wieder eingeschaltet wird');

  // F12 (M6; E15 ungemessen): emitSlot liest den Stand und schreibt die Zeile unter EINER Ausgabe-Sperre je Slot.
  // Reihenfolge: emitMutex vor fieldMutex, nie umgekehrt (kein emit*() im Sperrblock von fieldMutex); kein SDK- oder
  // NDI-Aufruf darunter. slot off nimmt dieselbe Sperre; nach slot off (imAbbau) schreibt emitSlot nichts mehr.
  const iAusgabeAF = slotEvAF.search(/^\{\s*std::lock_guard<std::mutex>\s+\w+\(\s*s\.emitMutex\s*\)\s*;/);
  assert(/std::mutex\s+emitMutex\s*;/.test(rumpf(vAF, 'struct Slot '))
      && iAusgabeAF === 0 && vorDem(slotEvAF, 's.emitMutex', 's.fieldMutex') && vorDem(slotEvAF, 's.emitMutex', 'emitRaw(')
      && /if\s*\(\s*s\.imAbbau\.load\(\)\s*\)\s*return\s*;/.test(slotEvAF) && !/\bsender\b|\bsend\w*\s*\(|->/.test(slotEvAF)
      && /^\{\s*std::lock_guard<std::mutex>\s+\w+\(\s*s\.emitMutex\s*\)\s*;/.test(offAF)
      && (vAF.match(/\bemitMutex\b/g) ?? []).length === 3,
    'AF12 6.3 (M6): emitSlot liest und schreibt unter der Ausgabe-Sperre des Slots (vor fieldMutex, kein SDK-/NDI-Aufruf), slot off ebenso');

  // F13 (M7; Spec 6.5): während der Renderer-Sperre keine periodischen SDK-Leser - IsVideoOn (kameraAn: „unbekannt“ =
  // an), die RawData_Off-Abfrage wartet, GetUserVideoSize und GetMeeting…StatisticInfo fallen aus (Felder fehlen dann).
  assert(/^\{\s*if\s*\(\s*rendererSperre\(\)\s*\)\s*return\s+true\s*;/.test(rumpf(vAF, 'bool kameraAn(unsigned id)'))
      && /if\s*\(\s*z\.rawOffGesehen\s*&&\s*!rendererSperre\(\)\s*\)/.test(rumpf(vAF, 'void ersatzbildTick(Slot& s, int64_t jetzt)'))
      // Restpunkt R-b der Nachprüfung: die Sperre ZUERST - videoCtrl() ist selbst ein SDK-Leser (GetMeetingVideoController)
      && /if\s*\(\s*!rendererSperre\(\)\s*&&\s*mode\s*!=\s*SlotMode::Share\s*&&\s*ziel\s*!=\s*0\s*&&\s*videoCtrl\(\)\s*!=\s*nullptr\s*\)/.test(rumpf(vAF, 'void slotStatsMelden(Slot& s, int64_t jetzt)'))
      && /^\{\s*if\s*\(\s*g_meeting\s*==\s*nullptr\s*\|\|\s*callbacksRendererSperre\(\)\s*\)\s*return\s+false\s*;/.test(rumpf(nativ('session.cpp', true), 'bool sessionEmpfangsStatistik(')),
    'AF13 6.5 (M7): während der Renderer-Sperre keine periodischen SDK-Leser (IsVideoOn, GetUserVideoSize, GetMeeting…StatisticInfo)');
}
console.log('\nDoku — Abschluss-Fix Plan A (README: Delegates, 18-Wartezeit, Abweichungen mit Spec-Verweis, N3-Review Minor 1/2):');
{
  const readme = a17Lies(join(testDir, '..', 'README.md'), 'utf8').replace(/\r\n/g, '\n');
  const a7 = readme.indexOf('\n## 7 · ');
  const e7 = readme.indexOf('\n## ', a7 + 1);
  const s7 = readme.slice(a7, e7 < 0 ? undefined : e7);
  /** Der Absatz, der mit `**<kopf>**` beginnt, bis zur Leerzeile, flach; sonst ''. */
  const absatzAF = (kopf: string): string => {
    const i = s7.indexOf(`\n${kopf}`);
    if (i < 0) return '';
    const j = s7.indexOf('\n\n', i + 1);
    return s7.slice(i, j < 0 ? undefined : j).replace(/\s+/g, ' ');
  };
  const wdh = absatzAF('**Wiederholung nach Fehler 18.**');
  const ton = absatzAF('**Ton je Slot.**');
  const deleg = absatzAF('**Delegates.**');
  const ersatz = absatzAF('**Ersatzbild und Halten.**');
  const vorschau = absatzAF('**Vorschau.**');
  const sperre = absatzAF('**Renderer-Sperre.**');
  // F14, N3-Review Minor 1: der Satz zu 29 gilt nur Freigabe-Slots (29 gibt es nur bei SHARE, Spec 6.10 Tabelle).
  assert(/Bei Freigabe-Slots [^.]*`SDKERR_NO_SHARE_DATA` \(29\)/.test(wdh) && !/Meldet das SDK `SDKERR_NO_SHARE_DATA`/.test(wdh),
    'AF14 (N3-Review Minor 1): der Satz zu SDKERR_NO_SHARE_DATA (29) gilt in der README nur Freigabe-Slots');
  // F14, N3-Review Minor 2: der Anführungszeichen-Wächter gilt auch für den Ton-Absatz; ausgenommen sind nur seine
  // Code-Spannen mit dem Protokoll-Wert (`audio:"person"`, dazu `audio:"mix"`, das im selben Absatz steht).
  const ohneCode = (t: string): string => t.replace(/`audio:"(person|mix)"`/g, '');
  assert(ton !== '' && [wdh, deleg, ersatz, vorschau, sperre].every((t) => t !== '')
      && ![ohneCode(ton), wdh, deleg, ersatz, vorschau, sperre].some((t) => t.includes('"')),
    'AF14 (N3-Review Minor 2): keine ASCII-Anführungszeichen im Ton-Absatz (außer in den Code-Spannen audio:…) und in den neuen Absätzen');
  assert(deleg.includes('Spec 6.10') && deleg.includes('AN11') && deleg.includes('neuen Delegate') && deleg.includes('bis zum Prozessende')
      && deleg.includes('`onRendererBeDestroyed`') && deleg.includes('Slot-Nummer'),
    'AF1 README: Delegates leben bis zum Prozessende; der Typwechsel nimmt einen neuen Delegate (Abweichung von Spec 6.10/AN11 genannt)');
  assert(wdh.includes('sofort') && wdh.includes('Spec 6.10') && wdh.includes('weder Bild noch Ton'),
    'AF2 README: bei 18 läuft der Abschluss sofort, vom alten Ziel geht weder Bild noch Ton hinaus (Abweichung von Spec 6.10 genannt)');
  assert(ersatz.includes('vor dem ersten Bild') && ersatz.includes('`fallback/cameraOff`') && ersatz.includes('Spec 6.12'),
    'AF6 README: Kamera laut Zoom aus vor dem ersten Bild gleich fallback/cameraOff (Abweichung von Spec 6.12 genannt)');
  // Restpunkt R-c der Nachprüfung: die Attrappe beachtet die Sperre bei slotSet nicht - die README nennt den Unterschied.
  assert(sperre.includes('Attrappe und Bridge unterscheiden sich') && sperre.includes('`modeChanged`') && sperre.includes('`targetChanged`'),
    'AF7 README (R-c): die README nennt, dass die Attrappe ein slotSet in der Sperre sofort umhängt, die Bridge nur bestätigt');
  assert(vorschau.includes('`previewMode`') && vorschau.includes('tatsächlichen Zustand') && vorschau.includes('Spec 6.3'),
    'AF9 README: previewMode bestätigt den tatsächlichen Zustand (Abweichung von Spec 6.3 „wie gesendet“ genannt)');
}
console.log('\nNativer Teil — Abschluss-Fix F15 (Rückrufe im Flug werden vor dem Freigeben eines Slots abgewartet):');
{
  // F15 (Sicherheitsprüfung an 28ebfa9d88, MEDIUM, TOCTOU; Ruling des Controllers): zwischen der Prüfung von abgemeldet
  // und dem Zugriff auf Slot/Abo lag kein Schutz - ein Rückruf im Flug konnte einen eben freigegebenen Slot treffen.
  // Flugzähler im Delegate (Dekker, seq_cst): der Rückruf zählt ZUERST und prüft DANN abgemeldet; der Hauptthread meldet
  // ab und wartet OHNE gehaltene Sperre, bis der Zähler 0 ist - höchstens RUECKRUF_FRIST_MS, sonst bleibt der Slot bis
  // zum Prozessende stehen (Sender schon zu). Jede Freigabestelle eines Slots geht über slotFreigabeAbwarten.
  const vF = nativ('video.cpp', true);
  const vFt = nativ('video.cpp');
  const logikF = nativ('slot_logic.h', true);
  const vorDemF = (text: string, a: string, b: string): boolean => text.indexOf(a) >= 0 && text.indexOf(b) > text.indexOf(a);
  const betreten = rumpf(logikF, 'inline bool rueckrufBetreten(RueckrufWache& w)');
  const iZaehlen = betreten.search(/w\.imFlug\.fetch_add\(\s*1\s*,\s*std::memory_order_seq_cst\s*\)\s*;/);
  const iPruefen = betreten.search(/w\.abgemeldet\.load\(\s*std::memory_order_seq_cst\s*\)/);
  const flugTeil = (() => {
    const i = logikF.indexOf('struct RueckrufWache');
    const j = logikF.indexOf('class RueckrufImFlug', i);
    return i < 0 || j < 0 ? '' : logikF.slice(i, j) + rumpf(logikF.slice(j), 'class RueckrufImFlug');
  })();
  assert(/struct\s+RueckrufWache\s*\{\s*std::atomic<int>\s+imFlug\{0\}\s*;\s*std::atomic<bool>\s+abgemeldet\{false\}\s*;\s*\}/.test(logikF)
      && iZaehlen >= 0 && iPruefen > iZaehlen
      && /w\.imFlug\.fetch_sub\(\s*1\s*,\s*std::memory_order_seq_cst\s*\)\s*;\s*return\s+false\s*;/.test(betreten)
      && /void\s+rueckrufAbmelden\(\s*RueckrufWache&\s*w\s*\)\s*\{\s*w\.abgemeldet\.store\(\s*true\s*,\s*std::memory_order_seq_cst\s*\)\s*;\s*\}/.test(logikF)
      && /drin_\(\s*rueckrufBetreten\(\s*w\s*\)\s*\)/.test(flugTeil) && /~RueckrufImFlug\(\)\s*\{\s*if\s*\(\s*drin_\s*\)\s*rueckrufVerlassen\(\s*\*w_\s*\)\s*;\s*\}/.test(flugTeil)
      && flugTeil !== '' && !/memory_order_(relaxed|acquire|release|acq_rel|consume)/.test(flugTeil)
      && /inline\s+constexpr\s+int64_t\s+RUECKRUF_FRIST_MS\s*=\s*500\s*;/.test(logikF),
    'AF15 (Dekker, seq_cst): ein Rückruf zählt sich ZUERST und prüft DANN abgemeldet; abgewiesen gibt er sofort zurück; der Wächter verlässt nur, wenn er drin ist');
  const rueckrufeF = ['void Delegate::onRendererBeDestroyed(', 'void Delegate::onRawDataFrameReceived(', 'void Delegate::onRawDataStatusChanged(']
    .map((k) => rumpf(vF, k));
  assert(rueckrufeF.every((r) => /^\{\s*const\s+RueckrufImFlug\s+\w+\(\s*wache\s*\)\s*;/.test(r) && !/\babgemeldet\b|\bimFlug\b/.test(r)),
    'AF15: alle drei Rückrufe legen als erste Anweisung den Flug-Wächter an und lesen abgemeldet nie selbst (sonst kippt die Reihenfolge)');
  const freigabe = rumpf(vF, 'bool slotFreigabeAbwarten(Slot& s)');
  const freigabeText = rumpf(vFt, 'bool slotFreigabeAbwarten(Slot& s)');
  assert(freigabe !== '' && vorDemF(freigabe, 'rueckrufAbmelden(d->wache)', 'rueckrufeAbwarten(d->wache')
      && /for\s*\(\s*Delegate\*\s+d\s*:\s*g_delegates\s*\)\s*\{?\s*if\s*\(\s*d->zeigtAuf\(\s*&s\s*\)\s*\)\s*rueckrufAbmelden\(\s*d->wache\s*\)\s*;/.test(freigabe)
      && /jetztMs\(\)\s*\+\s*RUECKRUF_FRIST_MS/.test(freigabe)
      && !/lock_guard|unique_lock|scoped_lock|\.lock\(|fieldMutex|emitMutex|try_lock/.test(freigabe)
      && (freigabe.match(/\bemitLog\s*\(/g) ?? []).length === 1 && /std::to_wstring\(\s*s\.nr\s*\)/.test(freigabe)
      && !/\b(name|ndi|ndiName|source)\b/.test(freigabeText.slice(freigabeText.indexOf('emitLog('))),
    'AF15: slotFreigabeAbwarten meldet jeden Delegate des Slots ab und wartet danach - ohne gehaltene Sperre, mit Frist und stderr-Zeile (Slot-Nummer)');
  const ausF = rumpf(vF, 'void abbauAusfuehren(');
  const zweigF = (name: string): string => {
    const i = ausF.indexOf(`case AbbauSchritt::${name}:`);
    if (i < 0) return '';
    const j = ausF.indexOf('case AbbauSchritt::', i + 1);
    return ausF.slice(i, j < 0 ? ausF.length : j);
  };
  const imFlugNutzung = [...vF.matchAll(/\bg_slotsImFlug\b(\s*\.\s*(\w+))?/g)].map((m) => m[2] ?? '');
  assert(vorDemF(zweigF('SlotLoeschen'), 'if (!slotFreigabeAbwarten(*s)) g_slotsImFlug.push_back(slot->release());', 'return true;')
      && vorDemF(zweigF('HaltelisteAbbauen'), 'if (!slotFreigabeAbwarten(*it->slot)) g_slotsImFlug.push_back(it->slot.release());', 'g_slotsHalt.erase(')
      && vorDemF(zweigF('HaltelisteVerwerfen'), 'if (!slotFreigabeAbwarten(*it->slot)) g_slotsImFlug.push_back(it->slot.release());', 'g_slotsHalt.erase(')
      && /s\.sender\.close\(\);\s*if\s*\(\s*!slotFreigabeAbwarten\(\s*s\s*\)\s*\)\s*g_slotsImFlug\.push_back\(\s*slot\.release\(\)\s*\)\s*;/.test(rumpf(vF, 'void slotOn(const SlotBefehl& b)'))
      && (vF.match(/\bg_slots\.erase\(/g) ?? []).length === 1 && (vF.match(/\bg_slotsHalt\.erase\(/g) ?? []).length === 2
      && /std::vector<Slot\*>\s+g_slotsImFlug\s*;/.test(vF)
      && imFlugNutzung.filter((n) => n === '').length === 1 && imFlugNutzung.every((n) => ['', 'push_back'].includes(n)),
    'AF15: jede Freigabestelle eines Slots (SlotLoeschen, HaltelisteAbbauen, HaltelisteVerwerfen, Fehlerpfad slotOn) geht über slotFreigabeAbwarten; läuft die Frist ab, bleibt der Slot bis zum Prozessende');
  // Sender schon zu, bevor ein Slot nach der Frist stehen bleibt: in jedem Plan steht SenderZu vor SlotLoeschen und
  // InHalteliste (Halteliste-Einträge haben ihren Sender also schon zu), slotOn schließt ihn vorher selbst.
  const sl = nativ('slot_logic.h', true);
  const block = rumpf(sl, 'inline void slotBlock(');
  assert(/s\.push_back\(AbbauSchritt::SenderZu\);\s*s\.push_back\(AbbauSchritt::InHalteliste\);\s*return;/.test(block)
      && /s\.push_back\(AbbauSchritt::SenderZu\);\s*s\.push_back\(AbbauSchritt::SlotLoeschen\);\s*\}$/.test(block.trim()),
    'AF15: SenderZu steht im Slot-Block vor InHalteliste und vor SlotLoeschen - ein stehen gebliebener Slot sendet nichts mehr');
}
{
  const readme = a17Lies(join(testDir, '..', 'README.md'), 'utf8').replace(/\r\n/g, '\n');
  const a7 = readme.indexOf('\n## 7 · ');
  const e7 = readme.indexOf('\n## ', a7 + 1);
  const s7 = readme.slice(a7, e7 < 0 ? undefined : e7);
  const i = s7.indexOf('\n**Delegates.**');
  const j = i < 0 ? -1 : s7.indexOf('\n\n', i + 1);
  const deleg = i < 0 ? '' : s7.slice(i, j < 0 ? undefined : j).replace(/\s+/g, ' ');
  assert(deleg.includes('abgewartet') && deleg.includes('ohne gehaltene Sperre') && deleg.includes('500 ms') && deleg.includes('bis zum Prozessende')
      && !deleg.includes('"'),
    'AF15 README: Rückrufe im Flug werden vor dem Freigeben eines Slots ohne gehaltene Sperre abgewartet, höchstens 500 ms');
}
// ── Plan B, Task B23 · Der Altweg ist entfernt (Spec 6.18, 0.20; Gliederung A-EP1, A-EP7) ──
console.log('\nB23 Altweg — weder Paket noch Attrappe kennen videoSubscribe, video oder audio:');
{
  const quelle = (datei: string): string => readFileSync(join(testDir, '..', 'src', datei), 'utf8');
  const protokoll = quelle('protocol.ts');
  const zustand = quelle('state.ts');
  const index = quelle('index.ts');
  assert(![protokoll, zustand, index].some((t) => t.includes('@deprecated')),
    'B23: protocol.ts, state.ts und index.ts tragen kein @deprecated mehr (der Altweg ist ganz weg)');
  assert(!/export (type|interface) (VideoState|VideoReason|AudioReason|VideoSub|AudioSub)\b/.test(protokoll + zustand),
    'B23 6.18: VideoState, VideoReason, AudioReason, VideoSub und AudioSub gibt es nicht mehr');
  assert(!/\b(VideoState|VideoReason|AudioReason)\b/.test(index), 'B23 6.18: src/index.ts exportiert keinen der alten Typen');
  assert(!/cmd: 'video(Un)?[Ss]ubscribe'|ev: 'video'|ev: 'audio'/.test(protokoll),
    'B23 6.2/6.3: Command ohne videoSubscribe/videoUnsubscribe, WireEvent ohne video/audio');
  const attrappe = readFileSync(fake, 'utf8');
  assert(!attrappe.includes('FAKE_' + 'ALTWEG'), 'B23 A-EP1: fake-bridge.mjs kennt den Altweg-Schalter nicht mehr');
  assert(!attrappe.includes('FAKE_' + 'ABO_VERZOEGERUNG_MS'), 'B23 A-EP1: … und die Stellschraube des verzögerten videoSubscribe nicht');
  assert(!/'video(Un)?[Ss]ubscribe'|ev: 'video'|ev: 'audio'/.test(attrappe),
    'B23 6.18: fake-bridge.mjs hat keinen Zweig für videoSubscribe/videoUnsubscribe und sendet kein video-/audio-Ereignis');
}
{
  // Alte Umgebungen (etwa eine Fabrik, die FAKE_ALTWEG noch setzt) bekommen das Verhalten der nativen Bridge seit A11.
  const ev = await fahreSteuerung({ FAKE_ALTWEG: '1', FAKE_ABO_FEHLER: 'videoSenderFailed' }, async (b, ev) => {
    await imMeeting(b, ev);
    // videoSubscribe steht seit dieser Aufgabe nicht mehr in Command; der Fall schickt ihn absichtlich.
    b.send({ cmd: 'videoSubscribe', id: ANNA, resolution: '720p' } as unknown as Command);
    await bisEreignis(ev, art('error'));
    b.send(slotAn(1, 'JM Connect – Zoom Anna', { id: ANNA }));
    await bisEreignis(ev, art('slot', { slot: 1, state: 'live' }));
  });
  assert(ev.some(art('error', { where: 'cmd', code: 1 })) && !ev.some(art('video')) && !ev.some(art('audio')),
    'B23 A-EP1: auch mit FAKE_ALTWEG=1 ist videoSubscribe ein unbekannter Befehl (where:cmd code:1), kein video-/audio-Ereignis');
  assert(!ev.some(art('error', { where: 'video' })) && !ev.some(art('error', { where: 'slot' }))
    && ev.some(art('slot', { slot: 1, state: 'live', reason: 'frames' })),
    'B23 A-EP7: FAKE_ABO_FEHLER ohne Doppelpunkt wirkt nicht mehr (kein Fehler, Slot 1 zeigt Bild)');
}

// ── Nachtrag B zu Plan B (Ruling R10) · Die Attrappe antwortet verspätet (FAKE_SLOT_SPAET) ──
console.log('\nNachtrag B Attrappe — verspätete Antworten (FAKE_SLOT_SPAET):');
{
  let antwort1 = -1;
  let antwort2 = -1;
  const ev = await fahreSteuerung({ FAKE_SLOT_SPAET: '2:400' }, async (b, ev) => {
    await imMeeting(b, ev);
    const t0 = Date.now();
    b.send(slotAn(2, 'JM Connect – Zoom Ben', { id: BEN }));
    b.send(slotAn(1, 'JM Connect – Zoom Anna', { id: ANNA }));
    b.send({ cmd: 'slotSet', slot: 2, fallback: 'black' });
    b.send({ cmd: 'slotOff', slot: 2 });
    await bisEreignis(ev, art('slot', { slot: 1 }));
    antwort1 = Date.now() - t0;
    await bisEreignis(ev, art('slot', { slot: 2 }));
    antwort2 = Date.now() - t0;
    await bisEreignis(ev, art('slot', { slot: 2, state: 'off' }));
  });
  const spaet = antwort2 >= 400 && antwort1 >= 0 && antwort1 < 400 && stelle(ev, art('slot', { slot: 1 })) < stelle(ev, art('slot', { slot: 2 }));
  if (!spaet) console.error(`      gemessen: slotOn 2 nach ${antwort2} ms, slotOn 1 nach ${antwort1} ms`);
  assert(spaet, 'Nachtrag B R10: FAKE_SLOT_SPAET=2:400 → slotOn 2 frühestens nach 400 ms beantwortet, das spätere slotOn 1 vorher');
  const zwei = ev.filter(art('slot', { slot: 2 })) as unknown as Array<{ state: string; reason: string; sent: string }>;
  assert(JSON.stringify(slotFolge(ev, 2)) === JSON.stringify([`starting/command@${BEN}`, `starting/command@${BEN}`, `off/command@${BEN}`])
      && zwei[1]?.sent === 'black',
    'Nachtrag B R10: … slotSet und slotOff danach der Reihe nach: Aufbau, Bestätigung mit dem neuen Ersatzbild, dann slot off/command');
}
{
  let antwort = -1;
  const ev = await fahreSteuerung({ FAKE_SLOT_SPAET: '3:300' }, async (b, ev) => {
    await imMeeting(b, ev);
    b.send(slotAn(3, 'JM Connect – Zoom Carla', { id: ANNA }));
    await bisEreignis(ev, art('slot', { slot: 3, state: 'live' }));
    const t0 = Date.now();
    b.send({ cmd: 'slotSet', slot: 3, resolution: '1080p' });
    await bisEreignis(ev, art('slot', { slot: 3, reason: 'resolutionChanged' }));
    antwort = Date.now() - t0;
  });
  const spaet = antwort >= 300 && ev.some(art('slot', { slot: 3, reason: 'resolutionChanged' }));
  if (!spaet) console.error(`      gemessen: slotSet nach ${antwort} ms beantwortet`);
  assert(spaet, 'Nachtrag B R10: auch slotSet an einen laufenden Slot wird erst nach 300 ms beantwortet');
}

console.log(failures === 0 ? '\nAlle Selbsttests bestanden.' : `\n${failures} Selbsttest(s) fehlgeschlagen.`);
process.exit(failures === 0 ? 0 : 1);
