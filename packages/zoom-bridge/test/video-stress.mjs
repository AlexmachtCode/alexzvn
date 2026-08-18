#!/usr/bin/env node
// Belastungslauf zu Befund I6: haelt der Abbau eines Abos, wenn er MITTEN IM
// LAUFENDEN BILD passiert - immer wieder, und waehrend andere Abos weiterlaufen?
//
// WAS HIER AUF DEM SPIEL STEHT: destroyRenderer() zerstoert das Sub samt
// seinem Mutex und seinem NDI-Sender, waehrend Delegate::owner_ ein ROHER
// Zeiger darauf ist. Das traegt nur, wenn destroyRenderer() synchron gegen
// einen LAUFENDEN Rueckruf abschliesst. Die Zoom-Kopfdateien sagen dazu
// NICHTS (nachgesehen: destroyRenderer und unSubscribe sind beide voellig
// unkommentiert). Die Annahme steht darum ausdruecklich als UNBELEGT im
// Quelltext (native/video.cpp, videoUnsubscribe).
//
// GEMESSEN ist inzwischen, dass Rueckrufe waehrend des Abbaus tatsaechlich
// noch laufen (ein RawData_Off kam nach dem unsubscribed an, siehe
// Sub::imAbbau). Das Fenster ist also real. NICHT gemessen ist, ob es je
// jemanden trifft. Genau das misst dieser Lauf - und ein Absturz ist hier
// nicht der Fehlschlag des Laufs, sondern SEIN ERGEBNIS.
//
//   $env:ZOOM_SDK_DIR          = "<Pfad zum entpackten Zoom-Meeting-SDK>"
//   $env:ZOOM_SDK_CREDENTIALS  = "<Pfad ausserhalb des Repos>\zoom-credentials.json"
//   $env:ZOOM_MEETING_ID       = "<nur Ziffern>"
//   $env:ZOOM_MEETING_PASSCODE = "<Kenncode>"
//   $env:ZOOM_VIDEO_SUBSCRIBE  = "<Kennungen, komma-getrennt - Kameras AN>"
//   npm run video-stress -w @jm/zoom-bridge
//
// OPTIONAL: $env:ZOOM_STRESS_CYCLES (Vorgabe 10) - wie oft jede Kennung ab-
// und wieder angemeldet wird.
import { join } from 'node:path';
import { Bridge, buildJwt, normalizeMeetingId, readCredentials } from '../src/index.ts';

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

const sdk = process.env.ZOOM_SDK_DIR;
if (!sdk) fail('ZOOM_SDK_DIR ist nicht gesetzt.');
if (!process.env.ZOOM_MEETING_ID) fail('ZOOM_MEETING_ID ist nicht gesetzt.');

const ids = (process.env.ZOOM_VIDEO_SUBSCRIBE ?? '')
  .split(',')
  .map((s) => Number(s.trim()))
  .filter((n) => Number.isInteger(n) && n > 0);
if (ids.length === 0) {
  fail('ZOOM_VIDEO_SUBSCRIBE ist leer - dieser Lauf braucht mindestens eine Kennung mit ANGESCHALTETER Kamera.');
}

const cycles = Number(process.env.ZOOM_STRESS_CYCLES ?? '10');
if (!Number.isInteger(cycles) || cycles < 1) fail('ZOOM_STRESS_CYCLES muss eine ganze Zahl >= 1 sein.');

let meetingId;
try {
  meetingId = normalizeMeetingId(process.env.ZOOM_MEETING_ID);
} catch (e) {
  fail(`ZOOM_MEETING_ID: ${e.message}`);
}

// DER ABSTURZ IST DAS MESSERGEBNIS, nicht ein Unfall des Pruefstands. Er
// kommt als {"ev":"error","where":"exit"} herein (bridge.ts meldet ein
// unerwartet beendetes Kind so, samt Rueckgabewert im Text - bei einem
// Zugriffsfehler steht dort -1073741819 = 0xC0000005). Festgehalten wird er
// in einer Variablen, damit JEDE Warteschleife ihn sofort abbrechen kann,
// statt in ihre Frist zu laufen und "Zeitueberschreitung" zu melden - zwei
// Ursachen duerfen nie denselben Namen bekommen.
let abgestuerzt = null;
let authCode = null;

const bridge = new Bridge({
  env: { PATH: `${join(sdk, 'x64', 'bin')};${process.env.PATH}` },
  envRemove: ['ZOOM_SDK_CLIENT_ID', 'ZOOM_SDK_CLIENT_SECRET', 'ZOOM_SDK_CREDENTIALS'],
  onEvent: (ev) => {
    if (ev.ev === 'auth') authCode = ev.code;
    if (ev.ev === 'error' && ev.where === 'exit') abgestuerzt = ev.detail ?? 'ohne naehere Angabe';
    if (ev.ev === 'error' && ev.where === 'video') console.log(`  FEHLER: ${ev.name} (${ev.code})`);
  },
});

async function finish(code) {
  try {
    await bridge.stop();
  } catch {
    // Beim Abbau nach einem Absturz gibt es nichts mehr zu beenden.
  }
  process.exit(code);
}

await bridge.start();
bridge.send({ cmd: 'init' });
bridge.send({ cmd: 'auth', jwt: buildJwt(readCredentials()) });
try {
  await bridge.waitFor((s) => authCode !== null || s.phase === 'error', 30_000);
} catch {
  console.log('\nKeine Anmeldeantwort.');
  await finish(1);
}
if (authCode !== 0) {
  console.log('\nAnmeldung nicht durchgekommen.');
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
  console.log('\nNicht ins Meeting gekommen - die Belastungsfrage wurde nie gestellt.');
  await finish(4);
}
if (bridge.session.meeting !== 'inMeeting') {
  console.log('\nNicht ins Meeting gekommen - die Belastungsfrage wurde nie gestellt.');
  await finish(4);
}

console.log('\nWarte auf die Rohdaten-Erlaubnis …');
try {
  await bridge.waitFor((s) => s.canRecordRaw || s.privilegeDenied || s.privilegeTimedOut, 60_000);
} catch {
  // Weder JA noch NEIN - der Gastgeber hat nicht reagiert.
}
if (!bridge.session.canRecordRaw) {
  console.log('Keine Rohdaten-Erlaubnis - die Belastungsfrage wurde nie gestellt.');
  await finish(3);
}

/** Wartet, bis das Abo `id` Bilder liefert. Bricht bei einem Absturz sofort ab. */
async function warteAufLive(id, frist) {
  try {
    await bridge.waitFor(() => abgestuerzt !== null || bridge.session.videoSubs.get(id)?.state === 'live', frist);
  } catch {
    return false;
  }
  return abgestuerzt === null && bridge.session.videoSubs.get(id)?.state === 'live';
}

// ALLE Abos zuerst und GEMEINSAM: der Befund verlangt ausdruecklich mehrere
// gleichzeitige Abos. Ein einzelnes ab- und anzumelden waere ein anderer,
// schwaecherer Test - die Frage ist ja gerade, ob der Abbau des einen die
// Rueckrufe der anderen stoert.
console.log(`\n${ids.length} Abo(s), ${cycles} Runden je Kennung.\n`);
for (const id of ids) bridge.send({ cmd: 'videoSubscribe', id, resolution: '720p' });

const nieLive = [];
for (const id of ids) {
  if (await warteAufLive(id, 15_000)) continue;
  if (abgestuerzt !== null) break;
  nieLive.push(id);
}
if (abgestuerzt === null && nieLive.length > 0) {
  // KEIN stiller Weiterlauf: ohne laufendes Bild misst dieser Lauf genau das
  // NICHT, wofuer es ihn gibt - das Fenster oeffnet sich erst, wenn
  // tatsaechlich Rueckrufe unterwegs sind.
  console.log(`Diese Kennungen lieferten kein Bild: ${nieLive.join(', ')}`);
  console.log('Ohne laufendes Bild misst dieser Lauf nichts. Kameras anschalten und neu starten.');
  await finish(3);
}

let runde = 0;
let ohneBild = 0;
for (runde = 1; runde <= cycles && abgestuerzt === null; runde++) {
  for (const id of ids) {
    if (abgestuerzt !== null) break;
    // MITTEN IM LAUFENDEN BILD abmelden - genau das ist die Frage.
    bridge.send({ cmd: 'videoUnsubscribe', id });
    try {
      await bridge.waitFor(() => abgestuerzt !== null || !bridge.session.videoSubs.has(id), 10_000);
    } catch {
      console.log(`  Runde ${runde}, ${id}: das Abo verschwand nicht innerhalb von 10 s.`);
      await finish(2);
    }
    if (abgestuerzt !== null) break;
    bridge.send({ cmd: 'videoSubscribe', id, resolution: '720p' });
    // Kein harter Abbruch, wenn ein Bild mal ausbleibt: der Gast koennte in
    // genau diesem Moment die Kamera ausgemacht haben. Gezaehlt wird es
    // trotzdem - eine Runde ohne Bild hat das Fenster nicht geoeffnet und
    // darf am Ende nicht als vollwertige Runde durchgehen.
    if (!(await warteAufLive(id, 15_000)) && abgestuerzt === null) ohneBild++;
  }
  console.log(`  Runde ${runde}/${cycles} durch.`);
}

console.log('');
if (abgestuerzt !== null) {
  console.log('GEMESSEN: die Bruecke ist waehrend des Belastungslaufs ABGESTUERZT.');
  console.log(`  Runde ${runde} von ${cycles}, Kindprozess: ${abgestuerzt}`);
  console.log('  Damit ist die unbelegte Lebensdauer-Annahme in native/video.cpp WIDERLEGT:');
  console.log('  destroyRenderer() schliesst NICHT synchron gegen laufende Rueckrufe ab.');
  await finish(2);
}

const vollwertig = cycles * ids.length - ohneBild;
console.log(`OK — ${cycles} Runden je Kennung ueberstanden, ${ids.length} Abo(s) gleichzeitig.`);
console.log(`  ${vollwertig} von ${cycles * ids.length} Wechseln liefen mit laufendem Bild.`);
if (ohneBild > 0) {
  console.log(`  ${ohneBild} Wechsel OHNE Bild - diese haben das Fenster nicht geoeffnet und beweisen nichts.`);
}
// KEIN "die Annahme ist bewiesen": ein nicht eingetretener Absturz ist kein
// Beweis, dass es ihn nicht gibt. Ein Wettlauf, den man 10-mal nicht trifft,
// ist immer noch ein Wettlauf.
console.log('  Das WIDERLEGT die Annahme nicht - es hat sie nur nicht getroffen.');
await finish(0);
