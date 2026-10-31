#!/usr/bin/env node
// Messlauf: wie viele gleichzeitige Video-Abos laesst das Zoom-SDK zu?
// Diese Zahl steht in KEINEM Header. Sie zu schaetzen waere eine Behauptung.
//
// Umgebung wie test/join.mjs. Zusaetzlich noetig: ein Meeting mit MEHREREN
// Teilnehmern, deren Kameras an sind - die Grenze laesst sich nur mit echten
// Teilnehmern messen, denn ein Teilnehmer laesst sich nicht zweimal
// abonnieren (das waere videoAlreadySubscribed und wuerde nichts messen).
//
// SEIT DEN ZOOM-SLOTS (Connect 0.4.0, Spec docs/superpowers/specs/
// 2026-10-17-connect-zoom-slots-design.md, E22): Den Befehl fuer ein Abo je
// Teilnehmer gibt es nicht mehr. Gemessen wird mit einem Slot je fremdem
// Teilnehmer (Modus Teilnehmer, slotOn mit allen Pflichtfeldern), hoechstens
// SLOT_NR_MAX - mehr Slots kennt die Bridge nicht. Jeder Slot haelt genau ein
// Abo, die Frage des Laufs ist dieselbe. Der Satz ueber
// videoAlreadySubscribed oben gilt sinngemaess weiter: zwei Slots auf dieselbe
// Person messen nicht die Grenze, sondern etwas anderes (Spec MS21).
//
// Laeuft nie im Selbsttest (Meeting). test/selftest.ts prueft nur Quelltext und
// Syntax (node --check), Plan A Task A17.
import { join } from 'node:path';
import { Bridge, SLOT_NR_MAX, buildJwt, normalizeMeetingId, readCredentials } from '../src/index.ts';

/**
 * slotOn mit allen Pflichtfeldern (Spec 6.2). Ton wie vor den Slots an (Ton der
 * Person), Ersatzbild Schwarz wie vor den Slots. Der NDI-Name traegt nur die
 * Slot-Nummer, nie einen Teilnehmernamen.
 */
function slotOnBefehl(slot, id) {
  return {
    cmd: 'slotOn',
    slot,
    ndi: 'JM Connect – Zoom Messlauf ' + slot,
    mode: 'participant',
    id,
    resolution: '720p',
    audio: 'person',
    shareAudio: false,
    fallback: 'black',
    showNoVideo: true,
  };
}

const sdk = process.env.ZOOM_SDK_DIR;
if (!sdk) { console.error('ZOOM_SDK_DIR ist nicht gesetzt.'); process.exit(1); }

const fehler = [];
const bridge = new Bridge({
  env: { PATH: `${join(sdk, 'x64', 'bin')};${process.env.PATH}` },
  envRemove: ['ZOOM_SDK_CLIENT_ID', 'ZOOM_SDK_CLIENT_SECRET', 'ZOOM_SDK_CREDENTIALS'],
  onEvent: (ev) => {
    // Jeder Slot- und NDI-Fehler beendet den Lauf; als Grenze zaehlt unten nur,
    // was Zoom selbst ablehnt (slotSubscribeFailed, slotRendererFailed).
    if (ev.ev === 'error' && (ev.where === 'slot' || ev.where === 'ndi')) fehler.push(ev);
    if (ev.ev === 'slot') console.log(`  Slot ${ev.slot} (Kennung ${ev.target}): ${ev.state} (${ev.reason})`);
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
// Ein Slot je Kennung, Nummer = laufende Nummer ab 1. Mehr als SLOT_NR_MAX
// beantwortete die Bridge mit slotBadNumber - das waere keine Zoom-Grenze.
const kandidaten = andere.slice(0, SLOT_NR_MAX);
let gelungen = 0;
let abbruchGrund = null;
// 'hart' = Zoom lehnt ab, 'anders' = anderer Fehler (keine Grenze), 'weich' = nur Zeitablauf
let abbruchArt = null;
for (const p of kandidaten) {
  const vorher = fehler.length;
  const nr = gelungen + 1;
  bridge.send(slotOnBefehl(nr, p.id));
  try {
    await bridge.waitFor((s) => s.slots.get(nr)?.state === 'live' || fehler.length > vorher, 5000);
  } catch {
    abbruchArt = 'weich';
    abbruchGrund = `keine Bilder innerhalb von 5 s (Slot ${nr})`;
    break;
  }
  if (fehler.length > vorher) {
    const f = fehler[fehler.length - 1];
    // Nur was Zoom selbst ablehnt, ist die gesuchte Grenze. Ein NDI- oder
    // Aufbaufehler der Bridge (slotSenderFailed, ndiInitFailed, ...) ist es
    // nicht - zwei Ursachen duerfen nie denselben Namen bekommen.
    abbruchArt = f.code === 'slotSubscribeFailed' || f.code === 'slotRendererFailed' ? 'hart' : 'anders';
    abbruchGrund = `${f.name}${f.sdk !== undefined ? ` (SDK ${f.sdk})` : ''}${f.detail ? ` (${f.detail})` : ''}`;
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
} else if (abbruchArt === 'anders') {
  console.log(
    `\nKEIN MESSERGEBNIS: ${gelungen} gleichzeitige Slots liefen, der ${gelungen + 1}. scheiterte an ` +
      `${abbruchGrund} — das ist ein Fehler der Bridge oder von NDI, keine Grenze von Zoom. ` +
      `Ursache beheben und den Lauf wiederholen.`,
  );
} else if (andere.length > SLOT_NR_MAX) {
  console.log(
    `\nGemessen: ${gelungen} gleichzeitige Slots erfolgreich — die Grenze wurde NICHT erreicht. Es waren ` +
      `${andere.length} Teilnehmer da, die Bridge kennt aber hoechstens ${SLOT_NR_MAX} Slots.`,
  );
} else {
  console.log(
    `\nGemessen: ${gelungen} gleichzeitige Abos erfolgreich — die Grenze wurde NICHT erreicht (` +
      `es waren nur ${andere.length} Teilnehmer da). Fuer eine echte Obergrenze braucht es mehr Teilnehmer.`,
  );
}

await bridge.stop();
process.exit(0);
