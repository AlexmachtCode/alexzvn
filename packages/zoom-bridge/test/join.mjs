#!/usr/bin/env node
// Konsolen-Pruefstand: tritt einem echten Meeting bei, druckt jedes Ereignis in
// Klartext und geht wieder.
//
// ZUGANGSDATEN: kommen aus der Umgebung oder aus einer Datei AUSSERHALB des
// Repos. Meeting-Nummer und Kenncode gehoeren nirgends ins Repo, auch nicht als
// Beispiel - deshalb stehen unten nur Platzhalter, keine Ziffern. Der Kenncode
// wird nie gedruckt.
//
//   $env:ZOOM_SDK_DIR          = "<Pfad zum entpackten Zoom-Meeting-SDK>"
//   $env:ZOOM_SDK_CREDENTIALS  = "<Pfad ausserhalb des Repos>\zoom-credentials.json"
//   $env:ZOOM_MEETING_ID       = "<nur Ziffern>"
//   $env:ZOOM_MEETING_PASSCODE = "<Kenncode>"
//   npm run join -w @jm/zoom-bridge
//
// OPTIONAL: $env:ZOOM_VIDEO_SUBSCRIBE = "<kommagetrennte Teilnehmerkennungen>"
// abonniert nach dem Beitritt das Video der genannten Kennungen (720p,
// siehe README.md Abschnitt 7). Ohne diese Variable verhaelt sich dieser
// Pruefstand genau wie bisher - kein Video-Befehl geht raus.
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
  // normalizeMeetingId() selbst nennt nie den Wert (siehe protocol.ts) - hier
  // nur der Variablenname davor, damit klar ist, WELCHE Umgebungsvariable
  // gemeint ist, ohne die fehlerhafte Eingabe zu wiederholen.
  fail(`ZOOM_MEETING_ID: ${e.message}`);
}

let jwt;
try {
  jwt = buildJwt(readCredentials());
} catch (e) {
  fail(String(e.message));
}

// Die Zugangsdaten aus der Umgebung des Kindprozesses NEHMEN: die Bridge sieht
// ausschliesslich das fertige JWT. Gleiche Setzung wie im Stage-0-Spike.
//
// envRemove statt delete auf einem selbst gebauten Objekt: bridge.ts mischt
// opts.env NOCH EINMAL mit process.env ({ ...process.env, ...opts.env }) -
// eine hier bloss FEHLENDE Variable waere fuer diesen Merge unsichtbar und
// kaeme aus process.env darunter zurueck (gemessen, Nachbesserung 1, Befund
// A). envRemove wird ERST NACH diesem Merge angewendet und entfernt darum
// wirklich.
// Der Rueckgabewert von onAuthenticationReturn, sobald er da ist; bis dahin
// null. Gebraucht, weil der Sitzungszustand eine GESCHEITERTE Anmeldung nicht
// abbildet: reduce() setzt bei code!==0 die Phase gar nicht um (state.ts, Fall
// 'auth'), "noch keine Antwort" und "abgelehnt" saehen dort also gleich aus.
// Rennfrei lesbar, weil waitFor() den Zustand alle 20 ms POLLT und onEvent()
// synchron in dispatch() laeuft (bridge.ts) - beim naechsten Blick steht der
// Wert bereits.
let authCode = null;

const bridge = new Bridge({
  env: { PATH: `${join(sdk, 'x64', 'bin')};${process.env.PATH}` },
  envRemove: ['ZOOM_SDK_CLIENT_ID', 'ZOOM_SDK_CLIENT_SECRET', 'ZOOM_SDK_CREDENTIALS'],
  onEvent: (ev, s) => {
    if (ev.ev === 'status') console.log(`  Status: ${ev.status}  (${ev.explain})`);
    else if (ev.ev === 'auth') {
      authCode = ev.code;
      console.log(`  Anmeldung: ${ev.result}`);
    }
    else if (ev.ev === 'ready') console.log(`  SDK: ${ev.sdkVersion}`);
    else if (ev.ev === 'roster') {
      console.log(`  Teilnehmer (${ev.list.length}):`);
      for (const p of ev.list) console.log(`    ${p.id}  ${p.name}${p.self ? '  (das sind wir)' : ''}  Rolle ${p.role}`);
    } else if (ev.ev === 'joined') console.log(`  + ${ev.p.name} (${ev.p.id})`);
    else if (ev.ev === 'left') console.log(`  - ${ev.id}`);
    else if (ev.ev === 'renamed') console.log(`  ~ ${ev.id} heisst jetzt ${ev.name}`);
    else if (ev.ev === 'privilege') {
      // Die Herkunft IMMER mitdrucken. GEMESSEN im ersten geglueckten
      // Owner-Lauf: nach der Freigabe kamen ZWEI Ereignisse (die Antwort auf
      // das Gesuch und die Rundmeldung) und standen beide als blosses
      // "Rohdaten-Erlaubnis: JA" da - zwei verschiedene Tatsachen, die auf dem
      // Bildschirm wie eine doppelt gedruckte Zeile aussahen. Genau dagegen
      // traegt das Ereignis "source" (Nachbesserung 1, Owner-Entscheidung):
      // ein Feld, das niemand anzeigt, unterscheidet nichts.
      const woher =
        { check: 'eigene Nachfrage', requestAnswer: 'Antwort auf das Gesuch', broadcast: 'Rundmeldung des Gastgebers' }[
          ev.source
        ] ?? `unbekannte Herkunft: ${ev.source}`;
      if (ev.canRecordRaw) console.log(`  Rohdaten-Erlaubnis: JA  (${woher})`);
      // "timedOut" ist eine ANDERE Ursache als "noch keine Antwort" (siehe
      // state.ts, privilegeTimedOut) - wer hier weiter "bitte bestaetigen"
      // liest, wartet auf eine Antwort, die das SDK schon aufgegeben hat.
      else if (ev.timedOut) console.log(`  Rohdaten-Erlaubnis: keine Antwort gekommen (Zeitueberschreitung)  (${woher})`);
      else if (ev.denied) console.log(`  Rohdaten-Erlaubnis: ABGELEHNT  (${woher})`);
      else console.log(`  Rohdaten-Erlaubnis: fehlt — angefragt, bitte im Zoom-Client bestaetigen  (${woher})`);
    } else if (ev.ev === 'error') console.log(`  FEHLER bei ${ev.where}: ${ev.name} (${ev.code})`);
    else if (ev.ev === 'video') {
      // "rotation"/"limitedRange" stehen NUR dabei, wenn ein Bild sie
      // geliefert hat (siehe protocol.ts) - deshalb hier bedingt angehaengt,
      // nie mit einem erfundenen Wert aufgefuellt.
      let zeile = `  video ${ev.id}: ${ev.state} (${ev.reason})  Quelle "${ev.source}"`;
      if (ev.rotation !== undefined) zeile += `  rotation=${ev.rotation}`;
      if (ev.limitedRange !== undefined) zeile += `  limitedRange=${ev.limitedRange}`;
      console.log(zeile);
    }
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

// ERST die Anmelde-Antwort abwarten, DANN beitreten.
//
// GEMESSEN (erster Owner-Lauf gegen ein echtes Meeting): ohne dieses Warten
// meldet der Beitritt SDKERR_UNAUTHENTICATION (8), und zwar deterministisch.
// Grund liegt im nativen Teil: main() arbeitet ALLE wartenden stdin-Zeilen in
// EINEM Rutsch ab (`while (nextLine(line)) handle(line);`), erst DANACH pumpt
// es wieder Nachrichten. SDKAuth() beantwortet sich aber ausschliesslich UEBER
// diese Pumpe (onAuthenticationReturn) - werden init/auth/join zusammen
// geschickt, laeuft Join() los, waehrend das SDK noch unangemeldet ist.
//
// Die Reihenfolge gehoert HIERHIN und nicht in den nativen Teil: "vor dem
// Beitritt muss die Anmeldung stehen" ist eine Beurteilung, und Beurteilungen
// liegen in dieser Bruecke auf der TypeScript-Seite. Der native Teil hat sich
// richtig verhalten - er hat den Fehler des SDK unverfaelscht mit Namen
// gemeldet, statt ihn zu verstecken.
try {
  await bridge.waitFor((s) => authCode !== null || s.phase === 'error', 30_000);
} catch {
  console.log('\nKeine Antwort auf die Anmeldung — es wurde kein Meeting betreten.');
  await finish(1);
}

if (authCode !== 0) {
  // Eigener Rueckgabewert 1 (Einrichtungsfehler), NICHT 4: eine abgelehnte
  // Anmeldung sagt nichts ueber die Meeting-Nummer - zwei verschiedene
  // Ursachen duerfen nie denselben Namen bekommen.
  console.log('\nAnmeldung nicht durchgekommen — es wurde kein Meeting betreten.');
  console.log('Pruefen: ist die App im Zoom-Marketplace eine "Meeting SDK"-App (nicht "General"/OAuth),');
  console.log('und stimmen Client-ID und Secret in der Datei aus ZOOM_SDK_CREDENTIALS?');
  await finish(1);
}

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

// ZOOM_VIDEO_SUBSCRIBE ist OPTIONAL: ohne die Variable bleibt dieser
// Pruefstand unveraendert (kein Video-Befehl geht raus). Mit ihr kann gegen
// ein echtes Meeting geprueft werden, was test/video-limit.mjs systematisch
// misst - hier nur zum Zusehen, ohne Anspruch auf eine Grenze.
const videoIds = (process.env.ZOOM_VIDEO_SUBSCRIBE ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter((s) => s.length > 0);
for (const raw of videoIds) {
  const id = Number(raw);
  if (!Number.isInteger(id)) {
    console.log(`  ZOOM_VIDEO_SUBSCRIBE: "${raw}" ist keine ganze Zahl - uebersprungen.`);
    continue;
  }
  bridge.send({ cmd: 'videoSubscribe', id, resolution: '720p' });
}

console.log(`\nIm Meeting. Bleibe ${seconds} s (Strg+C beendet frueher).`);
await new Promise((r) => setTimeout(r, seconds * 1000));

// Der Rueckgabewert beantwortet DIE FRAGE DIESES LAUFS, nicht die Teilfrage
// "hat der Beitritt geklappt". Ein geglueckter Beitritt ohne Erlaubnis mit 0
// zu quittieren waere genau die Sorte Luege, die dieses Werkzeug aufdecken soll.
await finish(bridge.session.canRecordRaw ? 0 : 3);
