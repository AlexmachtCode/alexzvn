#!/usr/bin/env node
// Konsolen-Pruefstand: tritt einem echten Meeting bei, druckt jedes Ereignis in
// Klartext und geht wieder.
//
// ZUGANGSDATEN: kommen aus der Umgebung oder aus einer Datei AUSSERHALB des
// Repos. Meeting-Nummer und Kenncode gehoeren nirgends ins Repo, auch nicht als
// Beispiel - deshalb stehen unten nur Platzhalter, keine Ziffern.
//
//   $env:ZOOM_SDK_DIR          = "<Pfad zum entpackten Zoom-Meeting-SDK>"
//   $env:ZOOM_SDK_CREDENTIALS  = "<Pfad ausserhalb des Repos>\zoom-credentials.json"
//   $env:ZOOM_MEETING_ID       = "<nur Ziffern>"
//   $env:ZOOM_MEETING_PASSCODE = "<Kenncode>"
//   npm run join -w @jm/zoom-bridge
import { join } from 'node:path';
import { Bridge, buildJwt, normalizeMeetingId, readCredentials } from '../src/index.ts';

const seconds = Number(process.env.ZOOM_JOIN_SECONDS ?? '60');

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

const sdk = process.env.ZOOM_SDK_DIR;
if (!sdk) fail('ZOOM_SDK_DIR ist nicht gesetzt.');
if (!process.env.ZOOM_MEETING_ID) fail('ZOOM_MEETING_ID ist nicht gesetzt.');

let meetingId;
try {
  meetingId = normalizeMeetingId(process.env.ZOOM_MEETING_ID);
} catch (e) {
  fail(String(e.message));
}

let jwt;
try {
  jwt = buildJwt(readCredentials());
} catch (e) {
  fail(String(e.message));
}

// Die Zugangsdaten aus der Umgebung des Kindprozesses NEHMEN: die Bridge sieht
// ausschliesslich das fertige JWT. Gleiche Setzung wie im Stage-0-Spike.
const childEnv = { ...process.env, PATH: `${join(sdk, 'x64', 'bin')};${process.env.PATH}` };
delete childEnv.ZOOM_SDK_CLIENT_ID;
delete childEnv.ZOOM_SDK_CLIENT_SECRET;
delete childEnv.ZOOM_SDK_CREDENTIALS;

const bridge = new Bridge({
  env: childEnv,
  onEvent: (ev, s) => {
    if (ev.ev === 'status') console.log(`  Status: ${ev.status}  (${ev.explain})`);
    else if (ev.ev === 'auth') console.log(`  Anmeldung: ${ev.result}`);
    else if (ev.ev === 'ready') console.log(`  SDK: ${ev.sdkVersion}`);
    else if (ev.ev === 'roster') {
      console.log(`  Teilnehmer (${ev.list.length}):`);
      for (const p of ev.list) console.log(`    ${p.id}  ${p.name}${p.self ? '  (das sind wir)' : ''}  Rolle ${p.role}`);
    } else if (ev.ev === 'joined') console.log(`  + ${ev.p.name} (${ev.p.id})`);
    else if (ev.ev === 'left') console.log(`  - ${ev.id}`);
    else if (ev.ev === 'renamed') console.log(`  ~ ${ev.id} heisst jetzt ${ev.name}`);
    else if (ev.ev === 'privilege') {
      if (ev.canRecordRaw) console.log('  Rohdaten-Erlaubnis: JA');
      // "timedOut" ist eine ANDERE Ursache als "noch keine Antwort" (siehe
      // state.ts, privilegeTimedOut) - wer hier weiter "bitte bestaetigen"
      // liest, wartet auf eine Antwort, die das SDK schon aufgegeben hat.
      else if (ev.timedOut) console.log('  Rohdaten-Erlaubnis: keine Antwort gekommen (Zeitueberschreitung)');
      else if (ev.denied) console.log('  Rohdaten-Erlaubnis: ABGELEHNT');
      else console.log('  Rohdaten-Erlaubnis: fehlt — angefragt, bitte im Zoom-Client bestaetigen');
    } else if (ev.ev === 'error') console.log(`  FEHLER bei ${ev.where}: ${ev.name} (${ev.code})`);
  },
});

let stopping = false;
async function finish(code) {
  if (stopping) return;
  stopping = true;
  await bridge.stop();
  process.exit(code);
}

// VOR dem Start registrieren: bricht der Start ab, muss Strg+C trotzdem greifen.
process.on('SIGINT', () => {
  console.log('\nAbbruch — verlasse das Meeting …');
  void finish(bridge.session.canRecordRaw ? 0 : 3);
});

await bridge.start();
bridge.send({ cmd: 'init' });
bridge.send({ cmd: 'auth', jwt });
bridge.send({
  cmd: 'join',
  meetingId,
  passcode: process.env.ZOOM_MEETING_PASSCODE ?? '',
  displayName: process.env.ZOOM_DISPLAY_NAME ?? 'JM Connect',
});

try {
  await bridge.waitFor((s) => s.meeting === 'inMeeting' || s.phase === 'error', 45_000);
} catch {
  console.log('\nNicht ins Meeting gekommen — keine Aussage ueber die Rohdaten-Frage, sie wurde nie gestellt.');
  await finish(4);
}

if (bridge.session.phase === 'error' || bridge.session.meeting !== 'inMeeting') {
  console.log('\nNicht ins Meeting gekommen — die Rohdaten-Frage wurde nie gestellt.');
  await finish(4);
}

console.log(`\nIm Meeting. Bleibe ${seconds} s (Strg+C beendet frueher).`);
await new Promise((r) => setTimeout(r, seconds * 1000));

// Der Rueckgabewert beantwortet DIE FRAGE DIESES LAUFS, nicht die Teilfrage
// "hat der Beitritt geklappt". Ein geglueckter Beitritt ohne Erlaubnis mit 0
// zu quittieren waere genau die Sorte Luege, die dieses Werkzeug aufdecken soll.
await finish(bridge.session.canRecordRaw ? 0 : 3);
