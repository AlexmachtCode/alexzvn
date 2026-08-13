#!/usr/bin/env node
// Messlauf: wie viele gleichzeitige Video-Abos laesst das Zoom-SDK zu?
// Diese Zahl steht in KEINEM Header. Sie zu schaetzen waere eine Behauptung.
//
// Umgebung wie test/join.mjs. Zusaetzlich noetig: ein Meeting mit MEHREREN
// Teilnehmern, deren Kameras an sind - die Grenze laesst sich nur mit echten
// Teilnehmern messen, denn ein Teilnehmer laesst sich nicht zweimal
// abonnieren (das waere videoAlreadySubscribed und wuerde nichts messen).
import { join } from 'node:path';
import { Bridge, buildJwt, normalizeMeetingId, readCredentials } from '../src/index.ts';

const sdk = process.env.ZOOM_SDK_DIR;
if (!sdk) { console.error('ZOOM_SDK_DIR ist nicht gesetzt.'); process.exit(1); }

const fehler = [];
const bridge = new Bridge({
  env: { PATH: `${join(sdk, 'x64', 'bin')};${process.env.PATH}` },
  envRemove: ['ZOOM_SDK_CLIENT_ID', 'ZOOM_SDK_CLIENT_SECRET', 'ZOOM_SDK_CREDENTIALS'],
  onEvent: (ev) => {
    if (ev.ev === 'error' && ev.where === 'video') fehler.push(ev);
    if (ev.ev === 'video') console.log(`  ${ev.id}: ${ev.state} (${ev.reason})`);
  },
});

await bridge.start();
bridge.send({ cmd: 'init' });
bridge.send({ cmd: 'auth', jwt: buildJwt(readCredentials()) });
await bridge.waitFor((s) => s.phase === 'authed' || s.phase === 'error', 30_000);
bridge.send({
  cmd: 'join',
  meetingId: normalizeMeetingId(process.env.ZOOM_MEETING_ID ?? ''),
  passcode: process.env.ZOOM_MEETING_PASSCODE ?? '',
  displayName: process.env.ZOOM_DISPLAY_NAME ?? 'JM Connect',
});
await bridge.waitFor((s) => s.meeting === 'inMeeting', 45_000);
await bridge.waitFor((s) => s.canRecordRaw, 60_000);

// Nur FREMDE Teilnehmer: uns selbst zu abonnieren misst nichts ueber die
// Grenze und liefert je nach SDK-Fassung ohnehin kein Bild.
const andere = [...bridge.session.participants.values()].filter((p) => !p.self);
console.log(`\n${andere.length} fremde Teilnehmer im Meeting.\n`);

// NACHBESSERUNG 1: zwei Abbruchgruende sind NICHT gleich stark. Ein vom SDK
// gemeldeter Fehler ist ein HARTES Signal - das SDK selbst benennt die
// Grenze. "Keine Bilder innerhalb von 5 s" OHNE jede Fehlermeldung ist ein
// WEICHES Signal - das kann die Grenze sein, kann aber ebenso gut
// Netzwerk-Ruckeln oder eine Kamera sein, die GENAU dieser eine Teilnehmer
// gerade aus hat. Beide in denselben Satzbau zu werfen waere dieselbe Sorte
// Messfehler wie eine Untergrenze als Obergrenze zu melden - nur eine Stufe
// leiser: der Lauf soll eine Zahl liefern, auf die man sich verlassen kann,
// und dafuer muss er sagen, WIE fest der Boden unter ihr ist.
let gelungen = 0;
let abbruchGrund = null;
let abbruchArt = null; // 'hart' = SDK meldet einen Fehler, 'weich' = nur Zeitablauf
for (const p of andere) {
  const vorher = fehler.length;
  bridge.send({ cmd: 'videoSubscribe', id: p.id, resolution: '720p' });
  try {
    await bridge.waitFor(
      (s) => s.videoSubs.get(p.id)?.state === 'live' || fehler.length > vorher,
      5000,
    );
  } catch {
    abbruchArt = 'weich';
    abbruchGrund = `keine Bilder innerhalb von 5 s (Abo ${gelungen + 1})`;
    break;
  }
  if (fehler.length > vorher) {
    const f = fehler[fehler.length - 1];
    abbruchArt = 'hart';
    abbruchGrund = `${f.name}${f.detail ? ` (${f.detail})` : ''}`;
    break;
  }
  gelungen++;
}

// Wer nur die LETZTE Zeile liest, muss den Unterschied trotzdem sehen -
// darum steht die Einstufung vorn im Satz, nicht als Nebensatz hinten.
if (abbruchArt === 'hart') {
  console.log(
    `\nGEMESSEN (SDK-Fehler, das ist die Grenze): ${gelungen} gleichzeitige Abos erfolgreich, ` +
      `das ${gelungen + 1}. scheiterte an ${abbruchGrund}.`,
  );
} else if (abbruchArt === 'weich') {
  console.log(
    `\nVERDACHT, KEIN BEWEIS: ${gelungen} gleichzeitige Abos erfolgreich, das ${gelungen + 1}. lieferte ` +
      `${abbruchGrund} — OHNE dass das SDK selbst einen Fehler gemeldet hat. Das KANN die Grenze sein, ` +
      `kann aber ebenso gut Netzwerk-Ruckeln oder eine Kamera sein, die GENAU dieser eine Teilnehmer ` +
      `gerade aus hat. Lauf WIEDERHOLEN (moeglichst mit anderer Teilnehmer-Reihenfolge), bevor ${gelungen} ` +
      `als Grenze gilt.`,
  );
} else {
  console.log(
    `\nGemessen: ${gelungen} gleichzeitige Abos erfolgreich — die Grenze wurde NICHT erreicht (` +
      `es waren nur ${andere.length} Teilnehmer da). Fuer eine echte Obergrenze braucht es mehr Teilnehmer.`,
  );
}

await bridge.stop();
process.exit(0);
