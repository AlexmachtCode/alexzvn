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
//
// OPTIONAL: $env:ZOOM_AUDIO_OFF = "<Teilmenge davon>" schickt fuer die
// genannten Kennungen ein videoSubscribe MIT `audio:false` - Bild ohne Ton.
// Gebraucht fuer Abnahmepunkt 3 (Spec Abschnitt 9): dass der Ton-Schalter
// wirkt, laesst sich sonst gegen ein echtes Meeting ueberhaupt nicht pruefen,
// weil das Feld ohne Angabe auf `true` steht (protocol.ts) und dieser
// Pruefstand es bisher nie gesetzt hat. Die Kennungen muessen auch in
// ZOOM_VIDEO_SUBSCRIBE stehen - eine Kennung nur hier abonniert nichts, und
// darum wird sie unten ausdruecklich als folgenlos gemeldet statt still
// verschluckt.
//
// DIE KENNUNGEN STEHEN NICHT VORHER FEST: sie gelten nur fuer DIESES Meeting.
// Erst ohne die Variable beitreten, den Teilnehmer-Block ablesen (die Zahl
// links), dann mit ihr neu starten. Ist die Variable gesetzt, WARTET der Lauf
// vor dem Abonnieren auf die Rohdaten-Erlaubnis - sie kommt regelmaessig erst
// Sekunden NACH dem Beitritt, wenn der Gastgeber sie im Zoom-Client bestaetigt.
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
      // "ohne persistentId" IMMER anzeigen: ohne diese Kennung kann ein Abo
      // einen Wiederbeitritt NICHT ueberleben (siehe videoParticipantJoined
      // in native/video.cpp - zwei Gaeste ohne persistentId waeren nicht
      // auseinanderzuhalten, und ein Umhaengen auf Verdacht waere eine
      // Personenverwechslung auf Sendung). Das ist eine Eigenschaft des
      // Zoom-Kontos des GASTES, keine unserer Entscheidungen - aber wer sie
      // nicht sieht, sucht den Fehler bei uns.
      for (const p of ev.list) {
        const pid = p.persistentId ? '' : '  [ohne persistentId → Wiederbeitritt nicht umhaengbar]';
        console.log(`    ${p.id}  ${p.name}${p.self ? '  (das sind wir)' : ''}  Rolle ${p.role}${pid}`);
      }
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
    } else if (ev.ev === 'error') {
      // Die Kennung NUR anhaengen, wenn sie dasteht. Zwei Stellen in main.cpp
      // melden videoUnknownParticipant, ohne je eine Kennung gelesen zu haben
      // - dort waere jede angezeigte Zahl erfunden.
      const wen = ev.id !== undefined ? ` fuer ${ev.id}` : '';
      console.log(`  FEHLER bei ${ev.where}${wen}: ${ev.name} (${ev.code})`);
      // "detail" MIT ANZEIGEN: bei where:"exit" steht dort der Rueckgabewert
      // bzw. das Signal des Kindprozesses. Ohne ihn sieht ein Absturz
      // (0xC0000005) genauso aus wie ein geordnetes Ende - zwei Ursachen, ein
      // Bild. Eingerueckt und in einer eigenen Zeile, damit die Fehlerzeile
      // selbst kurz bleibt.
      if (ev.detail) console.log(`      ${ev.detail}`);
    }
    else if (ev.ev === 'video') {
      // "rotation"/"limitedRange" stehen NUR dabei, wenn ein Bild sie
      // geliefert hat (siehe protocol.ts) - deshalb hier bedingt angehaengt,
      // nie mit einem erfundenen Wert aufgefuellt.
      let zeile = `  video ${ev.id}: ${ev.state} (${ev.reason})  Quelle "${ev.source}"`;
      // rebindable IMMER mitdrucken. GEMESSEN am 14.08.2026: bei einem
      // Wiederbeitritt kam das Bild nicht zurueck, und ob das Abo ueberhaupt
      // umhaengbar WAR, stand zwar auf der Leitung, aber in keiner Zeile.
      // Ohne diese Angabe sieht "Zoom kann es nicht" genauso aus wie "wir
      // koennen es nicht".
      zeile += ev.rebindable ? '  umhaengbar' : '  NICHT umhaengbar';
      if (ev.rotation !== undefined) zeile += `  rotation=${ev.rotation}`;
      if (ev.limitedRange !== undefined) zeile += `  limitedRange=${ev.limitedRange}`;
      console.log(zeile);
    } else if (ev.ev === 'audio') {
      let zeile = `  audio ${ev.id}: ${ev.state} (${ev.reason})`;
      // Format NUR anzeigen, wenn es gemessen wurde - sonst waere die Zeile
      // eine Behauptung ueber etwas, das noch nie ankam.
      if (ev.sampleRate !== undefined) zeile += `  ${ev.sampleRate} Hz, ${ev.channels} Kanal/Kanaele`;
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

// AUF DIE ERLAUBNIS WARTEN, BEVOR abonniert wird. GEMESSEN im Owner-Lauf vom
// 2026-08-13: beim Erreichen von inMeeting stand die Rohdaten-Erlaubnis noch
// auf "angefragt"; das JA kam erst Sekunden spaeter, nachdem der Gastgeber im
// Zoom-Client bestaetigt hatte. Ein videoSubscribe an dieser Stelle waere
// darum regelmaessig an videoNoPrivilege abgeprallt - und der Abnahmelauf
// haette eine ZEITFRAGE als fehlende Berechtigung gemeldet. Zwei verschiedene
// Ursachen duerfen nie denselben Namen bekommen.
if (videoIds.length > 0 && !bridge.session.canRecordRaw) {
  console.log('\nWarte auf die Rohdaten-Erlaubnis, bevor Video abonniert wird …');
  try {
    await bridge.waitFor((s) => s.canRecordRaw || s.privilegeDenied || s.privilegeTimedOut, 60_000);
  } catch {
    // waitFor lief ab: weder JA noch NEIN - der Gastgeber hat schlicht nicht
    // reagiert. Das ist eine dritte Tatsache, nicht "abgelehnt".
  }
  if (!bridge.session.canRecordRaw) {
    const grund = bridge.session.privilegeDenied
      ? 'der Gastgeber hat abgelehnt'
      : bridge.session.privilegeTimedOut
        ? 'die Anfrage lief ab'
        : 'es kam keine Antwort';
    console.log(`  Kein Video-Abo: ${grund}. Die Video-Frage wurde nie gestellt.`);
    videoIds.length = 0;
  }
}

// Als Zahlen vergleichen, nicht als Zeichenketten: "07" und "7" sind
// dieselbe Kennung, saehen aber als Text verschieden aus - und ein
// Ton-Schalter, der wegen eines fuehrenden Nullzeichens still nicht greift,
// waere genau die Sorte Fehler, die dieser Pruefstand aufdecken soll.
const ohneTon = new Set(
  (process.env.ZOOM_AUDIO_OFF ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map(Number)
    .filter((n) => Number.isInteger(n)),
);
const abonniert = new Set();

for (const raw of videoIds) {
  const id = Number(raw);
  if (!Number.isInteger(id)) {
    console.log(`  ZOOM_VIDEO_SUBSCRIBE: "${raw}" ist keine ganze Zahl - uebersprungen.`);
    continue;
  }
  abonniert.add(id);
  const stumm = ohneTon.has(id);
  console.log(`  Video wird abonniert: ${id} (720p)${stumm ? '  OHNE Ton (audio:false)' : ''}`);
  // Das Feld nur setzen, wenn es auf false soll. Ein ausdrueckliches
  // `audio:true` waere zwar gleichbedeutend, wuerde aber den Vorgabefall des
  // Protokolls (Feld fehlt) im Abnahmelauf nie mehr durchlaufen - und geprueft
  // wird, was in Betrieb geht.
  if (stumm) bridge.send({ cmd: 'videoSubscribe', id, resolution: '720p', audio: false });
  else bridge.send({ cmd: 'videoSubscribe', id, resolution: '720p' });
}

// Nichts verschwindet still: eine Kennung in ZOOM_AUDIO_OFF, die gar nicht
// abonniert wurde, hat KEINE Wirkung. Ohne diese Zeile liefe der Abnahmelauf
// mit Ton weiter und saehe aus, als habe der Schalter versagt.
for (const id of ohneTon) {
  if (!abonniert.has(id)) {
    console.log(`  ZOOM_AUDIO_OFF: ${id} steht nicht in ZOOM_VIDEO_SUBSCRIBE - folgenlos.`);
  }
}

console.log(`\nIm Meeting. Bleibe ${seconds} s (Strg+C beendet frueher).`);
await new Promise((r) => setTimeout(r, seconds * 1000));

// Der Rueckgabewert beantwortet DIE FRAGE DIESES LAUFS, nicht die Teilfrage
// "hat der Beitritt geklappt". Ein geglueckter Beitritt ohne Erlaubnis mit 0
// zu quittieren waere genau die Sorte Luege, die dieses Werkzeug aufdecken soll.
await finish(bridge.session.canRecordRaw ? 0 : 3);
