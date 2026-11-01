#!/usr/bin/env node
// Attrappe der Bridge fuer die Selbsttests. Spielt eine aufgezeichnete
// Ereignisfolge ab, damit src/bridge.ts ohne SDK, ohne Compiler und ohne
// Meeting pruefbar ist. Die Folge waehlt FAKE_SCRIPT.
import { appendFileSync } from 'node:fs';

const script = process.env.FAKE_SCRIPT ?? 'join';

const say = (o) => process.stdout.write(`${JSON.stringify(o)}\n`);

// --- Slots (Connect 0.4.0; Spec 6.2, 6.3, 11.3; Plan A, Task A2) --------------------------------------------
// Die Attrappe spricht denselben Slot-Vertrag wie die Bridge (Gliederung 3.2, 3.3, 3.5): dieselbe Pruefreihenfolge,
// dieselben Fehlerschluessel, dieselben Ereignisse. Sie importiert nichts aus src/, weil sie als reines JavaScript
// ohne --experimental-strip-types laeuft; der Selbsttest gleicht die Kataloge hier mit src/protocol.ts ab.
const SLOT_NR_MAX = 16;
const SLOT_MODES = ['participant', 'speaker', 'share'];
const SLOT_RESOLUTIONS = ['360p', '720p', '1080p'];
const SLOT_AUDIO_SETTINGS = ['off', 'mix', 'person'];
const SLOT_FALLBACKS = ['transparent', 'freeze', 'black', 'white'];
const SPEAKER_SIGNALS = ['speakerVideo', 'activeVideo', 'activeAudio'];
const SPEAKER_HOLD_MAX_MS = 5000;
const SHARE_TYPE_NAMES = ['unknown', 'as', 'ds', 'wb', 'airhost', 'camera', 'data', 'videoFile', 'frame', 'document', 'computerAudio'];
/** Hoechstens so viele Code-Punkte hat ein NDI-Name (E26). */
const NDI_NAME_MAX = 60;
/** Groesste Kennung (unsigned int im SDK); darueber ist id unlesbar (slotBadTarget, A-EP2). */
const UINT_MAX = 4294967295;
/** Die eigene Kennung der Attrappe (Teilnehmer "JM Connect"); nie Sprecher-Kandidat (6.8 Nr. 2). */
const EIGENE_KENNUNG = 100;
/** So lange nach einem Umhaengen kommen das erste Bild und das erste Ton-Paket (live/frames, live/packets). */
const ERSTES_BILD_MS = 100;
/** Takt von slotStats und bridgeStats (6.3) und der Vorschau (hoechstens zweimal je Sekunde, 6.16). */
const STATS_MS = 2000;
const VORSCHAU_MS = 500;
/** Bildpause einer Freigabe (6.9): ab 200 ms sendet der Slot die Kopie (sent held), ab 2 s wechselt der Zustand. */
const FREIGABE_HALTEN_MS = 200;
const FREIGABE_ZUSTAND_MS = 2000;
/** Nenngroesse je Stufe (6.11); Vorgabe fuer slotStats ohne FAKE_AUFLOESUNG_GELIEFERT. */
const NENNGROESSE = { '360p': [640, 360], '720p': [1280, 720], '1080p': [1920, 1080] };
/** ZoomSDKResolution (rawdata_renderer_interface.h:12-20) als slotStats.resGot. */
const ZOOM_STUFE = { '360p': 2, '720p': 3, '1080p': 4 };
/** Ein festes, gueltiges 1x1-JPEG fuer preview (mit System.Drawing erzeugt und zurueckgelesen, Plan A, Task A2). */
const VORSCHAU_JPEG = [
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA',
  '8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/',
  'wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBR',
  'IhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4',
  'eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHw',
  'EAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMz',
  'UvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoq',
  'OkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDwqiiiv3M/HD//2Q==',
].join('');

/** „a:b,c:d" -> [['a','b'],['c','d']] (Formate der Stellschrauben, 11.3); leer oder fehlend -> []. */
const eintraege = (text) => (text ?? '').split(',').map((t) => t.trim()).filter(Boolean).map((t) => t.split(':'));
/** „nr:wert,…" -> Map(nr -> wert); Eintraege ohne Doppelpunkt zaehlen nicht (die alte Lesart gibt es seit Plan B, Task B23 nicht mehr, A-EP7). */
const paare = (text) => new Map(eintraege(text).filter((t) => t.length === 2).map(([nr, wert]) => [Number(nr), wert]));

/**
 * Drehbuch „Slots" (FAKE_SCRIPT=slots, Spec 11.3, A-EP22): das Drehbuch steuerung mit dieser festen Folge. Zeiten in
 * ms ab inMeeting; Teilnehmer aus der Namensliste: Anna 16778240, Ben 16778241, Carla 16778242.
 *
 *   |   ms | Ereignis                                              | Stellschraube                          |
 *   |    0 | roster                                                | FAKE_TEILNEHMER=3                      |
 *   |   50 | Erlaubnis (privilege canRecordRaw:true)               | wie steuerung                          |
 *   |  800 | speakerSignal speakerVideo Ben                        | FAKE_SPRECHER_FOLGE                    |
 *   | 1100 | speakerSignal speakerVideo Carla                      | FAKE_SPRECHER_FOLGE                    |
 *   | 1400 | speakerSignal speakerVideo Ben (schneller Wechsel)    | FAKE_SPRECHER_FOLGE                    |
 *   | 2000 | Anna Kamera aus (videoStatus)                         | FAKE_KAMERA_AUS_MS                     |
 *   | 2600 | Anna Kamera an (videoStatus)                          | nur im Drehbuch (DREHBUCH_KAMERA_AN)   |
 *   | 3000 | Freigabe Ben beginnt (Freigabe 101, Typ ds)           | FAKE_FREIGABEN                         |
 *   | 3200 | Freigabe Carla beginnt (Freigabe 102, Typ as)         | FAKE_FREIGABEN                         |
 *   | 3800 | Freigabe Carla endet                                  | FAKE_FREIGABEN                         |
 *   | 4400 | Anna geht (left)                                      | FAKE_WIEDERBEITRITT_MS                 |
 *   | 4900 | Anna kommt als 16778250 zurück (joined)               | FAKE_RUECKKEHR_MS=500                  |
 *   | 5600 | Entzug der Erlaubnis                                  | FAKE_ENTZUG_MS=5550 (ab der Erlaubnis) |
 *   | 6200 | Wiedererteilung                                       | FAKE_ERTEILUNG_MS=600 (ab dem Entzug)  |
 *   | 6500 | später Abbau aller Slots (privilegeRevoked)           | FAKE_ABBAU_MS=900 (ab dem Entzug)      |
 *
 * Moduswechsel schickt der Test (slotSet). Gesetzte Umgebungsvariablen gehen vor.
 */
const DREHBUCH_SLOTS = {
  FAKE_TEILNEHMER: '3',
  FAKE_SPRECHER_FOLGE: '800:16778241,1100:16778242,1400:16778241',
  FAKE_KAMERA_AUS_MS: '16778240:2000',
  FAKE_FREIGABEN: '3000:16778241:101:begin,3000:16778241:101:typ=ds,3200:16778242:102:begin,3200:16778242:102:typ=as,3800:16778242:102:end',
  FAKE_WIEDERBEITRITT_MS: '4400',
  FAKE_RUECKKEHR_MS: '500',
  FAKE_ENTZUG_MS: '5550',
  FAKE_ERTEILUNG_MS: '600',
  FAKE_ABBAU_MS: '900',
};
/** Kamera wieder an (Drehbuch „Slots", ms ab inMeeting); FAKE_KAMERA_AUS_MS kennt nur „aus" (Format 11.3). */
const DREHBUCH_KAMERA_AN = [[16778240, 2600]];

/**
 * Liest ein Feld einer Befehlszeile dreiwertig wie der native Feldleser (A-EP11): { art: 'fehlt' },
 * { art: 'unlesbar' } oder { art: 'gelesen', wert, roh }. Gelesen wird der ROHTEXT nach `"feld":`, darum ist
 * "id":4.5 oder "id":"7" unlesbar statt 4 bzw. 7, und eine \u-Folge im Namen bleibt sichtbar (6.2).
 */
function feld(zeile, name, art) {
  const m = new RegExp(`"${name}"\\s*:\\s*("(?:[^"\\\\]|\\\\.)*"|[^,}\\s]+)`).exec(zeile);
  if (!m) return { art: 'fehlt' };
  const roh = m[1];
  if (art === 'zahl') return /^\d+$/.test(roh) && Number(roh) <= UINT_MAX ? { art: 'gelesen', wert: Number(roh), roh } : { art: 'unlesbar' };
  if (art === 'bool') return roh === 'true' || roh === 'false' ? { art: 'gelesen', wert: roh === 'true', roh } : { art: 'unlesbar' };
  return roh.startsWith('"') ? { art: 'gelesen', wert: JSON.parse(roh), roh } : { art: 'unlesbar' };
}

/**
 * Ungueltiger NDI-Name (6.2 Nr. 2, E26): fehlt, unlesbar, leer, mehr als 60 Code-Punkte, mit ":", mit einem
 * Steuerzeichen (JSON.stringify schreibt sie als \n, \t oder \u00XX) oder mit einer \u-Folge im Rohtext.
 */
function ndiUngueltig(f) {
  if (f.art !== 'gelesen' || typeof f.wert !== 'string') return true;
  const n = f.wert;
  return n === '' || [...n].length > NDI_NAME_MAX || n.includes(':') || /\p{Cc}/u.test(n) || f.roh.includes('\\u');
}

/** Slot-Nummer nach 6.2 Nr. 1, sonst null (slotBadNumber, ohne slot). */
function slotNummer(zeile) {
  const f = feld(zeile, 'slot', 'zahl');
  return f.art === 'gelesen' && f.wert >= 1 && f.wert <= SLOT_NR_MAX ? f.wert : null;
}

const AUSWAHLFELDER = [
  ['mode', SLOT_MODES, 'slotBadMode'],
  ['resolution', SLOT_RESOLUTIONS, 'slotBadResolution'],
  ['audio', SLOT_AUDIO_SETTINGS, 'slotBadAudio'],
  ['fallback', SLOT_FALLBACKS, 'slotBadFallback'],
];

/**
 * Prueft die Felder von slotOn (alle Pflicht ausser id) bzw. slotSet (nur die vorhandenen) nach Gliederung 3.2 Nr. 4-6 in
 * dieser Reihenfolge; liefert { fehler } beim ersten Fehler, sonst { werte }.
 */
function pruefeFelder(zeile, pflicht) {
  const werte = {};
  for (const [name, erlaubt, code] of AUSWAHLFELDER) {
    const f = feld(zeile, name, 'text');
    if (f.art === 'fehlt' && !pflicht) continue;
    if (f.art !== 'gelesen' || !erlaubt.includes(f.wert)) return { fehler: code };
    werte[name] = f.wert;
  }
  for (const name of ['shareAudio', 'showNoVideo']) {
    const f = feld(zeile, name, 'bool');
    if (f.art === 'fehlt' && !pflicht) continue;
    if (f.art !== 'gelesen') return { fehler: 'slotBadFlag' };
    werte[name] = f.wert;
  }
  const id = feld(zeile, 'id', 'zahl');
  if (id.art === 'unlesbar') return { fehler: 'slotBadTarget' };
  if (id.art === 'gelesen') werte.id = id.wert;
  return { werte };
}

const scripts = {
  // Sauberer Ablauf.
  join: () => {
    say({ ev: 'ready', sdkVersion: '7.1.5 (attrappe)' });
    say({ ev: 'auth', code: 0 });
    say({ ev: 'status', status: 'connecting', raw: 1, code: 0 });
    say({ ev: 'status', status: 'inMeeting', raw: 3, code: 0 });
    say({ ev: 'roster', list: [{ id: 1, name: 'Alex', persistentId: 'p1', self: false, videoOn: true, hasCamera: true, inWaitingRoom: false, role: 'host' }] });
    // "source" ist PFLICHT (siehe protocol.ts, WireEvent) - der echte native
    // Teil vergibt es an ALLEN Stellen. Eine Attrappe, die etwas sendet, was
    // das Original nicht senden kann, darf keinen Verbraucher scheitern
    // lassen, der sich auf den Vertrag verlaesst (Abschluss-Sichtung, H1).
    say({ ev: 'privilege', canRecordRaw: true, source: 'requestAnswer' });
  },
  // DER Spike-Fall: connecting kommt sofort und dann NICHTS mehr.
  hang: () => {
    say({ ev: 'ready', sdkVersion: '7.1.5 (attrappe)' });
    say({ ev: 'auth', code: 0 });
    say({ ev: 'status', status: 'connecting', raw: 1, code: 0 });
    // und dann Schweigen.
  },
  // Der Warteraum-Fall aus der Owner-Abnahme, an der entscheidenden Stelle
  // angehalten: der Beitritt IST beantwortet (waitingRoom ist ruhend und
  // schaltet den Beitritts-Wachhund ab), danach geht die Verbindung beim
  // Einlass wieder auf - und dann kommt nichts mehr. Genau die Luecke, die
  // reconnectTimeout schliesst.
  admitstuck: () => {
    say({ ev: 'ready', sdkVersion: '7.1.5 (attrappe)' });
    say({ ev: 'auth', code: 0 });
    // WARTET auf den join-Befehl, statt die Statusfolge sofort abzufeuern.
    // Tragend fuer die Aussagekraft dieses Falls: den Beitritts-Wachhund
    // stellt erst send({cmd:'join'}) scharf. Kaeme die Folge davor, liefe beim
    // 'reconnecting' schon ein Wachhund, den der join-Befehl danach neu
    // stellte - der Test maesse dann JOIN_TIMEOUT statt RECONNECT_TIMEOUT,
    // und zwar je nach Prozessstart mal so, mal so. Das Original verhaelt
    // sich ohnehin so herum: Statusmeldungen gibt es erst nach einem Beitritt.
    process.stdin.on('data', (d) => {
      if (!String(d).includes('"join"')) return;
      say({ ev: 'status', status: 'connecting', raw: 1, code: 0 });
      say({ ev: 'status', status: 'waitingRoom', raw: 6, code: 0 });
      say({ ev: 'status', status: 'reconnecting', raw: 7, code: 0 });
      // und dann Schweigen.
    });
  },
  // Ein ORDENTLICHER Abgang, vollstaendig bis zum Schluss - einschliesslich
  // des 'idle', das dem beendeten Meeting folgt. Gegenprobe zu admitstuck:
  // hier darf KEIN Wachhund anspringen. Ein Wachhund, der auf disconnecting
  // oder idle anschlaegt, machte aus jedem sauberen Abgang einen Fehler.
  leftclean: () => {
    say({ ev: 'ready', sdkVersion: '7.1.5 (attrappe)' });
    say({ ev: 'auth', code: 0 });
    say({ ev: 'status', status: 'connecting', raw: 1, code: 0 });
    say({ ev: 'status', status: 'inMeeting', raw: 3, code: 0 });
    say({ ev: 'status', status: 'disconnecting', raw: 4, code: 0 });
    say({ ev: 'status', status: 'ended', raw: 8, code: 0 });
    say({ ev: 'status', status: 'idle', raw: 0, code: 0 });
  },
  // Halbe Zeilen und Muell dazwischen.
  messy: () => {
    process.stdout.write('{"ev":"re');
    process.stdout.write('ady","sdkVersion":"7.1.5"}\n');
    process.stdout.write('das hier ist kein json\n');
    // Stage 4b (N4b.2): eine abgeschnittene Ereigniszeile MIT Teilnehmernamen. Die Bruecke darf
    // von ihr nur Laenge und Ereignisart ins Log geben, nie den Inhalt.
    process.stdout.write('{"ev":"roster","list":[{"id":7,"name":"Anna Maria Beispiel","self":false\n');
    say({ ev: 'auth', code: 0 });
    say({ ev: 'status', status: 'inMeeting', raw: 3, code: 0 });
  },
  // Reagiert auf GAR NICHTS - kein "quit", kein stdin-EOF. Nur ein aeusseres
  // kill() beendet sie. Simuliert eine Bruecke, die sich nicht von selbst
  // herunterfaehrt - der Fall, den stop()s Nachbrenner-Zeitgeber abfangen
  // muss (Nachbesserung 1 zu Task 10, Befund A: der Zeitgeber wurde nie
  // geloescht/genutzt und ein gescheitertes kill() verschwand spurlos).
  // Meldet, ob bestimmte Variablen in der EIGENEN Prozessumgebung sichtbar
  // sind - ENV_PROBE_NAMES (kommagetrennt) legt fest, welche. Prueft damit
  // envRemove in bridge.ts von der EMPFANGENDEN Seite aus: kein SDK noetig,
  // nur die Attrappe selbst als eigener Kindprozess (siehe Nachbesserung 1,
  // Befund A).
  envprobe: () => {
    const names = (process.env.ENV_PROBE_NAMES ?? '').split(',').filter(Boolean);
    const seen = {};
    for (const n of names) seen[n] = Object.prototype.hasOwnProperty.call(process.env, n);
    // path: der PATH, den das Kind WIRKLICH bekommt (Stage 4, Spec 12.1 Nr. 4) -
    // damit prueft JM Connect kindPfad()/pfadVarianten() von der empfangenden Seite.
    say({ ev: 'envprobe', seen, path: process.env.PATH });
  },
  // Das fruehere Drehbuch "video" (videoSubscribe -> video/audio ohne Befehlspruefung) entfaellt mit den Slots
  // (Plan A, Task A2): sein einziger Fall im Selbsttest zog nach A2 PT5 um.
  // Antwortet auf BEFEHLE wie das Original (native/main.cpp), statt eine
  // feste Folge abzuspielen - fuer die Steuerung der Start-EXE
  // (cli/steuerung.mjs), deren Ablauf von den Antworten abhaengt: erst
  // init -> ready, auth -> auth, DANN join. Jede empfangene Befehlszeile geht
  // als "ATTRAPPE empfing: <zeile>" auf stderr, damit ein Test pruefen kann,
  // was gesendet wurde - und was NICHT (kein join im Nur-Anmelden-Modus, kein
  // slotOn ohne Erlaubnis).
  //
  // Stellschrauben (Umgebung):
  //   FAKE_AUTH_CODE        Ergebnis der Anmeldung (Vorgabe 0 = AUTHRET_SUCCESS)
  //   FAKE_PRIVILEGE        'ja' (Vorgabe) | 'offen' (angefragt, keine Antwort) | 'nein'
  //   FAKE_TEILNEHMER       Zahl der fremden Teilnehmer (Vorgabe 2), Kennungen ab 16778240
  //   FAKE_BEITRITT_MS      nach so vielen ms im Meeting tritt "Carla" (16778242) bei
  //   FAKE_MEETING_ENDE_MS  nach so vielen ms im Meeting beendet der Gastgeber es
  //
  // Fehlerwege (Nachbesserung zum Einsatzpaket, 01.10.2026):
  //   FAKE_SOFORT_ENDE      stirbt beim Start mit diesem Rueckgabewert, OHNE eine
  //                         Zeile - wie zoom-bridge.exe, wenn eine DLL fehlt
  //                         (0xC0000135, STATUS_DLL_NOT_FOUND)
  //   FAKE_INIT_FEHLER=1    init -> error where:'init' (SDKERR_WRONG_USAGE) statt
  //                         ready; auth -> error where:'auth' code 7 und KEIN
  //                         auth-Ereignis (native/session.cpp, !g_sdkUp)
  //   FAKE_AUTH_SOFORTFEHLER  auth -> error where:'auth' mit diesem Code und KEIN
  //                         auth-Ereignis (synchroner SDKAuth-Fehler, main.cpp)
  //   FAKE_ABSTURZ_MS       so lange nach der Erlaubnis stirbt die Attrappe mit
  //                         0xC0000005 - ein Absturz MITTEN im Meeting
  //   FAKE_WARTERAUM=1      join -> connecting, waitingRoom, dann Stille
  //   FAKE_BEITRITT_SCHEITERT  join -> connecting, failed mit diesem Code
  //                         (4 = falscher Kenncode)
  //   FAKE_VERBINDUNG_WEG_MS  so lange nach dem Beitritt: reconnecting, dann
  //                         failed (2 = Wiederverbinden fehlgeschlagen)
  //   FAKE_WIEDERBEITRITT_MS  "Anna" (16778240, OHNE persistentId) geht und kommt
  //                         als 16778250 zurueck: left, dann die Folgen des Weggangs
  //                         fuer die Slots (unter "Slots" unten); bei der Rueckkehr
  //                         nur joined. Die Attrappe haengt nie selbst um (11.3),
  //                         die Rueckkehr schickt Connect per slotSet.
  //   FAKE_ABGANG_MS        quit braucht so lange, bevor das Meeting verlassen wird
  //   FAKE_LOGDATEI         jede empfangene Befehlszeile auch in diese Datei
  //                         (fuer den Konsolen-Pruefstand, der stderr nicht sieht)
  //
  // Stage 4 (JM Connect, Spec 12.1 Nr. 4):
  //   FAKE_SDK_FASSUNG      sdkVersion im ready-Ereignis (Vorgabe '7.1.5 (attrappe)');
  //                         die Connect-Tests setzen immer '7.1.5 (43953)'
  //   FAKE_NDI_FEHLER=1     direkt nach ready: error where:'ndi' code:'ndiInitFailed',
  //                         also noch VOR der Antwort auf die Anmeldung (native/main.cpp)
  //   FAKE_DOPPELNAME=1     der zweite fremde Teilnehmer (16778241) heisst ebenfalls "Anna"
  //   FAKE_EINLASS_MS       nur mit FAKE_WARTERAUM=1: so lange nach waitingRoom laesst
  //                         der Host ein - gemessene Folge reconnecting, connecting,
  //                         inMeeting
  //   FAKE_EINLASS_HAENGT=1 mit FAKE_EINLASS_MS: nur reconnecting, dann Stille
  //   FAKE_VERBINDUNG_HAENGT_MS  so lange nach dem Beitritt: reconnecting, dann
  //                         Stille. Die Attrappe bleibt "im Meeting", quit meldet
  //                         darum disconnecting und ended
  //   FAKE_ENTZUG_MS        so lange nach der Erlaubnis entzieht der Host sie:
  //                         privilege canRecordRaw:false, source:'broadcast'. Ab
  //                         Stage 4b baut die Attrappe danach ALLE Slots ab, wie die
  //                         Bridge (native/main.cpp, Abbau nach pumpOnce()): einen
  //                         Takt spaeter (setImmediate), je Slot slotAudio off vor
  //                         slot off, Grund privilegeRevoked
  //   FAKE_RUECKKEHR_MS     mit FAKE_WIEDERBEITRITT_MS: Abstand zwischen left und
  //                         joined (Vorgabe 0 = sofort, wie bisher)
  //   FAKE_RUECKKEHR_NAME   mit FAKE_WIEDERBEITRITT_MS: Name bei der Rueckkehr
  //                         (Vorgabe: unveraendert), etwa "anna" fuer die Rueckkehr
  //                         mit nur normiert gleichem Namen
  //
  // Stage 4b (JM Connect 0.3.0):
  //   FAKE_ERTEILUNG_MS     nur mit FAKE_ENTZUG_MS: so lange nach dem Entzug erteilt
  //                         der Host die Erlaubnis wieder: privilege canRecordRaw:true,
  //                         source:'broadcast'. 0 = synchron direkt nach privilege
  //                         false, also VOR dem Abbau (beide Rundrufe in derselben
  //                         Pumprunde der Bridge); abgebaut wird trotzdem
  //   FAKE_ABBAU_MS         nur mit FAKE_ENTZUG_MS: so lange nach dem Entzug baut die
  //                         Attrappe ab (Vorgabe: einen Takt spaeter, setImmediate).
  //                         Bildet eine Bridge nach, deren Abbau laenger dauert als der
  //                         Abgleich von JM Connect (300 ms) - am echten SDK ungemessen (M18)
  //   FAKE_VERBINDUNG_ZURUECK_MS  nur mit FAKE_VERBINDUNG_HAENGT_MS: so lange nach
  //                         reconnecting verbindet Zoom selbst: connecting, inMeeting,
  //                         dann wie das Original roster und privilege source:'check'.
  //                         Slots und Teilnehmer (samt Kennungen) bleiben
  //   FAKE_PUFFERFEHLER_MS  so lange nach dem ersten Bild je Slot einmal error
  //                         where:'slot' code:'slotBufferMismatch', bei laufendem Ton
  //                         dazu where:'audio' code:'audioBufferMismatch', beide mit slot
  //   FAKE_NAMENSZEILE=1    100 ms nach dem roster eine stderr-Zeile "Namensprobe: Anna, Ben"
  //                         mit allen fremden Teilnehmern (Pruefstand: JM Connect
  //                         schreibt keine Teilnehmernamen ins Log)
  //
  // Slots (Connect 0.4.0, Spec 11.3; Plan A, Task A2). Zeiten in ms ab inMeeting. videoSubscribe und
  // videoUnsubscribe sind unbekannte Befehle (error where:'cmd' code:1, wie die Bridge, 6.2; der
  // Altweg-Schalter ist mit Plan B, Task B23 entfernt):
  //   FAKE_SPRECHER_FOLGE   „ms:kennung,…": je Eintrag ein speakerSignal mit ids [kennung]
  //   FAKE_SPRECHER_SIGNAL  das Signal dieser Folge (Vorgabe speakerVideo); steuern tut nur das per speakerConfig
  //                         gewaehlte (Vorgabe speakerVideo, Haltezeit 1000 ms, vereinfacht nachgebildet)
  //   FAKE_KAMERA_AUS_MS    „kennung:ms,…": Zoom meldet die Kamera als aus: videoStatus videoOn:false, Slots mit
  //                         diesem Ziel fallback/cameraOff
  //   FAKE_KEIN_BILD_MS     „kennung:ms,…": keine Bilder mehr, ohne videoStatus: ein laufender Slot geht auf
  //                         fallback/noFrames, ein neuer bleibt starting
  //   FAKE_FREIGABEN        „ms:person:freigabe:aktion,…" mit aktion begin, end, pause, resume, ton (reine
  //                         Ton-Freigabe, nie gezeigt) oder typ=<Typ> (Typ-Nachtrag, Namen wie SHARE_TYPE_NAMES)
  //   FAKE_FREIGABE_BEFUELLT  ok | empty | unavailable: seeded im shares nach dem Befuellen beim ersten
  //                         Freigabe-Slot eines Meetings (Vorgabe ok mit Eintraegen, sonst empty)
  //   FAKE_AUFLOESUNG_GELIEFERT  „BxH", etwa 1280x720: gelieferte Groesse in slotStats (Vorgabe die Nenngroesse)
  //   FAKE_SLOT_FEHLER      „nr:schluessel,…": das erste slotOn dieses Slots nach der Pruefung scheitert mit dem
  //                         Schluessel (slotRawRecordingFailed, slotSenderFailed, slotRendererFailed); nichts angelegt
  //   FAKE_ABO_FEHLER       „nr:sdk,…": das erste Abo dieses Slots scheitert: error slotSubscribeFailed mit sdk und
  //                         type, dann slot fallback/subscribeFailed; der Slot laeuft weiter
  //   FAKE_SLOT_STUMM       „nr,…": slotOn fuer diesen Slot bleibt ohne jede Antwort
  //   FAKE_SLOT_SPAET       „nr:ms,…" (Nachtrag B zu Plan B, Ruling R10): slotOn und slotSet dieses Slots werden erst ms
  //                         nach dem Eingang ausgefuehrt und beantwortet; jeder Befehl dieses Slots (auch slotOff) erst nach
  //                         den frueheren, also in Eingangsreihenfolge wie die Bridge (ein slotOff waehrend eines
  //                         verzoegerten Aufbaus beendet ihn danach mit slot off). Andere Slots antworten sofort
  //   FAKE_ENTZUG_MS, FAKE_ERTEILUNG_MS, FAKE_ABBAU_MS, FAKE_MEETING_ENDE_MS, FAKE_VERBINDUNG_*, FAKE_WIEDERBEITRITT_MS,
  //   FAKE_RUECKKEHR_*, FAKE_PUFFERFEHLER_MS gelten fuer Slots: Abbau je Slot mit slotAudio off vor slot off;
  //                         Weggang -> left, dann slot fallback/participantLeft, KEIN Umhaengen (Connect schickt
  //                         slotSet); Pufferfehler -> slotBufferMismatch und bei laufendem Ton audioBufferMismatch,
  //                         beide mit slot
  //   Solange reconnecting ohne folgendes inMeeting gilt, beantwortet sie slotOn mit slotReconnecting (6.2 Nr. 8).
  //   bridgeStats und slotStats kommen alle 2 s nach init, preview nur bei previewMode on (festes 1x1-JPEG).
  //   Bekannte Abweichungen von der EXE (Plan A, Vertrag 3.5; Nachbesserung a1):
  //   - slotSet {fallback} ohne Umhaengen bestaetigt hier mit dem NEUEN sent (Spec 6.12); die EXE aus Task A11
  //     meldet ihn erst im naechsten Herzschlag.
  //   - slotSet mit Moduswechsel UND audio/shareAudio: hier regelt allein der Tonweg des neuen Modus den Ton; die
  //     EXE meldet davor den Ton-Umschaltplan im alten Modus (waiting/command ...). waiting/command nach so einem
  //     Befehl laesst sich gegen die Attrappe nicht pruefen.
  //   - Gleich wie die EXE: slotSet {resolution} haengt nur bei einer ANDEREN Aufloesung um.
  // Der Vertrag folgt dem Original: Slot-Fehler tragen die Slot-Nummer, wo eine
  // gelesen wurde; videoDelay prueft ganze Zahl 0..1000 und bestaetigt den
  // geltenden Wert; beim Abbau meldet sich der Ton VOR dem Bild ab (slotAudio
  // off vor slot off, 6.15); quit verlaesst ein laufendes Meeting erst und sagt
  // dann "bye"; EOF wirkt wie quit.
  steuerung: () => {
    if (process.env.FAKE_SOFORT_ENDE) {
      // process.exit() nimmt eine 32-Bit-Zahl MIT Vorzeichen; Windows meldet
      // denselben Wert dem Elternprozess ohne Vorzeichen (0xC0000135 =
      // 3221225781) - genau wie beim echten Ladefehler.
      process.exit(Number(process.env.FAKE_SOFORT_ENDE) | 0);
    }
    const authCode = Number(process.env.FAKE_AUTH_CODE ?? '0');
    const privileg = process.env.FAKE_PRIVILEGE ?? 'ja';
    const fremde = Number(process.env.FAKE_TEILNEHMER ?? '2');
    const namen = ['Anna', 'Ben', 'Carla', 'Dora', 'Emil', 'Frieda', 'Gustav', 'Hanna'];
    const wiederbeitritt = process.env.FAKE_WIEDERBEITRITT_MS;
    const person = (id, name, ueber = {}) => ({
      id, name, persistentId: `p${id}`, self: false, videoOn: true, hasCamera: true, inWaitingRoom: false, role: 'attendee', ...ueber,
    });
    const teilnehmer = new Map();
    let canRecordRaw = false;
    let imMeeting = false;
    let sdkOben = true;
    const logDatei = process.env.FAKE_LOGDATEI;

    // --- Slots (Spec 6.1-6.17, 11.3; Gliederung 3.5) ---------------------------------------------------------
    // Nummer -> Slot (Felder siehe slotOn). Die Attrappe haengt NIE selbst um (11.3): ein Weggang setzt das Ziel
    // auf 0, die Rueckkehr schickt Connect per slotSet.
    const slots = new Map();
    // reconnecting gemeldet, inMeeting steht noch aus: wie die Renderer-Sperre der Bridge (6.5) -> slotReconnecting.
    let verbindetNeu = false;
    let vorschauAn = false; // previewMode; Startwert aus (6.16)
    let sprecher = { signal: 'speakerVideo', holdMs: 1000 }; // speakerConfig; Vorgabe E19
    const sprecherSignalName = process.env.FAKE_SPRECHER_SIGNAL ?? 'speakerVideo';
    const erinnerung = new Map(); // Sprecher-Erinnerung (6.8): Signal -> letzte Kennung
    const freigaben = []; // Freigabe-Liste (6.9): { user, share, status, type, audioOnly, pauses, seq }
    const rueckrufe = []; // die letzten 10 Freigabe-Rueckrufe roh (shares.recent)
    let freigabeSeq = 0;
    let gezeigtShare = 0;
    let befuellt = false; // in diesem Meeting schon befuellt (6.9, erstes Einschalten eines Freigabe-Slots)
    const kameraAus = new Set(); // Kennungen, deren Kamera Zoom als aus meldet (videoStatus)
    const keinBild = new Set(); // Kennungen, die keine Bilder mehr liefern (FAKE_KEIN_BILD_MS)
    const uhrNull = Date.now(); // Bridge-Uhr fuer speakerSignal.ms und shares.recent[].ms
    const slotFehler = paare(process.env.FAKE_SLOT_FEHLER); // nr -> Schluessel, je einmal
    const aboFehlerSlot = paare(process.env.FAKE_ABO_FEHLER); // nr -> SDKError, je einmal
    const stummeSlots = new Set(eintraege(process.env.FAKE_SLOT_STUMM).map(([nr]) => Number(nr)));
    // FAKE_SLOT_SPAET: je Slot eine Warteschlange { liste: [{ faellig, f }], zeit } in Eingangsreihenfolge.
    const spaeteSlots = new Map([...paare(process.env.FAKE_SLOT_SPAET)].map(([nr, ms]) => [nr, Number(ms)]));
    const schlangen = new Map();
    const abarbeiten = (q) => {
      q.zeit = null;
      while (q.liste.length > 0) {
        const rest = q.liste[0].faellig - Date.now();
        if (rest > 0) {
          q.zeit = setTimeout(() => abarbeiten(q), rest);
          return;
        }
        q.liste.shift().f();
      }
    };
    // Ohne den Schalter (oder fuer andere Slots) sofort wie bisher; slotOn und slotSet verzoegert, slotOff nur der Reihe nach.
    const derReiheNach = (zeile, verzoegern, f) => {
      const nr = slotNummer(zeile);
      if (nr === null || !spaeteSlots.has(nr)) return f();
      let q = schlangen.get(nr);
      if (!q) {
        q = { liste: [], zeit: null };
        schlangen.set(nr, q);
      }
      q.liste.push({ faellig: Date.now() + (verzoegern ? spaeteSlots.get(nr) : 0), f });
      if (q.zeit === null) abarbeiten(q);
    };
    const geliefert = /^(\d+)x(\d+)$/.exec(process.env.FAKE_AUFLOESUNG_GELIEFERT ?? '');
    let statsTakt = null;
    let vorschauTakt = null;

    const kameraIstAus = (id) => kameraAus.has(id) || teilnehmer.get(id)?.videoOn === false;
    const ersatzArt = (s) => (s.fallback === 'freeze' ? (s.kopie ? 'freeze' : 'transparent') : s.fallback);
    // Ziel-0-Grund (6.10 Schritt 3, Nachfix W7): der Grund des Aufrufs, wenn er schon "kein Ziel" sagt, sonst nach Modus.
    const ziel0Grund = (mode, grund) => (['participantLeft', 'noTarget', 'speakerNone', 'shareNone'].includes(grund)
      ? grund
      : { participant: 'noTarget', speaker: 'speakerNone', share: 'shareNone' }[mode]);
    const meldeSlot = (s) => {
      const ev = { ev: 'slot', slot: s.nr, state: s.state, mode: s.mode, target: s.target, share: s.share, reason: s.reason, sent: s.sent, ndi: s.ndi };
      // rotation und limitedRange erst nach dem ersten Bild dieses Ziels (keine erfundenen Werte, 6.3)
      if (s.bild) Object.assign(ev, { rotation: 0, limitedRange: true });
      say(ev);
    };
    const setze = (s, state, reason, sent) => {
      Object.assign(s, { state, reason, sent });
      meldeSlot(s);
    };
    // Zeitgeber, die am Ziel haengen (erstes Bild, Pause, Pufferfehler, Haltezeit): fallen bei jedem Umhaengen weg.
    const spaeter = (s, ms, f) => {
      const t = setTimeout(() => {
        s.zeiten.delete(t);
        if (slots.get(s.nr) === s) f();
      }, ms);
      s.zeiten.add(t);
    };
    const zeitenWeg = (s) => {
      for (const t of s.zeiten) clearTimeout(t);
      s.zeiten.clear();
      clearTimeout(s.halte);
    };

    // Tonweg (6.10 Schritt 8, Ton-Abbildung 7.1): was der Slot in seinem Modus sendet; zugleich slotAudio.configured.
    const tonWeg = (s) => {
      if (s.mode === 'participant') return s.audio === 'off' ? 'none' : s.audio;
      if (s.mode === 'speaker') return s.audio === 'mix' ? 'mix' : 'none';
      if (s.audio === 'mix') return s.shareAudio ? 'mixShare' : 'mix';
      return s.shareAudio ? 'share' : 'none';
    };
    // Was gerade gemessen hinausgeht (slotAudio.source): Person-Ton nur mit Ziel, Computerton nur mit Freigabe.
    const tonQuelle = (s) => {
      const w = tonWeg(s);
      if (w === 'person') return s.target !== 0 ? 'person' : 'none';
      if (w === 'share') return s.share !== 0 ? 'share' : 'none';
      if (w === 'mixShare') return s.share !== 0 ? 'mixShare' : 'mix';
      return w;
    };
    const personAusserhalb = (s) => s.audio === 'person' && s.mode !== 'participant';
    const meldeTon = (s, state, reason, source) => {
      s.ton = { state, reason, source };
      const ev = { ev: 'slotAudio', slot: s.nr, state, source, configured: tonWeg(s), reason };
      if (state === 'live') Object.assign(ev, { sampleRate: 32000, channels: 1 });
      say(ev);
    };
    // Erstes Paket nach ERSTES_BILD_MS: live/packets, wenn die Quelle etwas liefert. Person-Ton ausserhalb von
    // Teilnehmer bleibt off/personNotInMode; dort folgt nur source der Messung (6.13, Sechste Runde RN5).
    const tonPakete = (s) => {
      clearTimeout(s.tonZeit);
      s.tonZeit = setTimeout(() => {
        if (slots.get(s.nr) !== s) return;
        const quelle = tonQuelle(s);
        if (personAusserhalb(s)) {
          if (quelle !== s.ton.source) meldeTon(s, 'off', 'personNotInMode', quelle);
        } else if (s.ton.state === 'waiting' && quelle !== 'none') meldeTon(s, 'live', 'packets', quelle);
        else if (s.ton.state === 'live' && quelle !== s.ton.source) meldeTon(s, 'live', 'packets', quelle);
      }, ERSTES_BILD_MS);
    };
    // Ton ein- oder umschalten (slotOn; slotSet mit audio/shareAudio; 6.13): Tonweg none -> off/command, sonst
    // waiting/command (audioEnsureSubscribed gelingt in der Attrappe immer) und unmittelbar danach
    // off/personNotInMode bzw. off/noShare, wo die Regel es verlangt.
    const tonEinschalten = (s) => {
      if (tonWeg(s) === 'none' && !personAusserhalb(s)) return meldeTon(s, 'off', 'command', 'none');
      meldeTon(s, 'waiting', 'command', 'none');
      if (personAusserhalb(s)) meldeTon(s, 'off', 'personNotInMode', 'none');
      else if (tonWeg(s) === 'share' && s.share === 0) return meldeTon(s, 'off', 'noShare', 'none');
      tonPakete(s);
    };
    // Ton nach einem Umhaengen OHNE Moduswechsel (6.10 Schritt 8): nur wo er am Ziel haengt.
    const tonNachZiel = (s) => {
      const w = tonWeg(s);
      if (personAusserhalb(s)) return tonPakete(s);
      if (w === 'person' && s.target === 0) return meldeTon(s, 'off', 'participantLeft', 'none');
      if (w === 'share' && s.share === 0) return meldeTon(s, 'off', 'noShare', 'none');
      if (w === 'person' || w === 'share') meldeTon(s, 'waiting', 'targetChanged', 'none');
      if (w !== 'none') tonPakete(s);
    };
    // Ton nach einem Moduswechsel (6.10 Schritt 8, Restnachfix N1): allein der Tonweg zaehlt.
    const tonNachModus = (s, alterWeg) => {
      const w = tonWeg(s);
      if (w === alterWeg) return tonPakete(s);
      if (personAusserhalb(s)) {
        meldeTon(s, 'off', 'personNotInMode', 'none');
        return tonPakete(s);
      }
      if (w === 'person' && s.target === 0) return meldeTon(s, 'off', 'participantLeft', 'none');
      if (w === 'share' && s.share === 0) return meldeTon(s, 'off', 'noShare', 'none');
      if (w === 'none') return meldeTon(s, 'off', 'modeChanged', 'none');
      meldeTon(s, 'waiting', 'modeChanged', 'none');
      tonPakete(s);
    };

    const pufferFehler = (s) => {
      if (!process.env.FAKE_PUFFERFEHLER_MS || s.pufferGemeldet) return;
      spaeter(s, Number(process.env.FAKE_PUFFERFEHLER_MS), () => {
        s.pufferGemeldet = true;
        say({ ev: 'error', where: 'slot', code: 'slotBufferMismatch', slot: s.nr });
        if (s.ton.state === 'live' || s.ton.state === 'waiting') say({ ev: 'error', where: 'audio', code: 'audioBufferMismatch', slot: s.nr });
      });
    };
    const freigabeVon = (share) => freigaben.find((f) => f.share === share);
    // Erstes Bild des Ziels nach ERSTES_BILD_MS (6.10 "Erstes Bild danach"), ausser das Ziel liefert keins.
    const bilderFuer = (s) => {
      spaeter(s, ERSTES_BILD_MS, () => {
        if (s.target === 0 || keinBild.has(s.target)) return;
        if (s.mode !== 'share' && kameraIstAus(s.target)) return;
        if (s.mode === 'share' && freigabeVon(s.share)?.status === 'paused') return;
        s.bild = true;
        s.kopie = s.fallback === 'freeze' || s.mode === 'share'; // Kopie nur bei freeze oder Freigabe (6.12)
        s.zuletzt = geliefert ? [Number(geliefert[1]), Number(geliefert[2])] : NENNGROESSE[s.resolution];
        setze(s, 'live', 'frames', 'none');
        pufferFehler(s);
      });
    };
    // slotRetarget (6.10): Ziel-Stand neu; Schritt 3 (Ziel 0), 5 (FAKE_ABO_FEHLER), 7 (Kamera aus), 8 (starting).
    // Den Ton regeln die Aufrufer (tonEinschalten, tonNachZiel, tonNachModus).
    const umhaengen = (s, ziel, share, grund) => {
      zeitenWeg(s);
      Object.assign(s, { target: ziel, share, bild: false, kopie: false, zuletzt: null, pufferGemeldet: false });
      if (ziel === 0) return setze(s, 'fallback', ziel0Grund(s.mode, grund), ersatzArt(s));
      if (aboFehlerSlot.has(s.nr)) {
        const sdk = Number(aboFehlerSlot.get(s.nr));
        aboFehlerSlot.delete(s.nr);
        say({ ev: 'error', where: 'slot', code: 'slotSubscribeFailed', slot: s.nr, sdk, type: s.mode === 'share' ? 'share' : 'video' });
        return setze(s, 'fallback', 'subscribeFailed', ersatzArt(s));
      }
      if (s.mode !== 'share' && kameraIstAus(ziel)) {
        return setze(s, 'fallback', s.mode === 'speaker' ? 'speakerNoVideo' : 'cameraOff', ersatzArt(s));
      }
      setze(s, 'starting', grund, ersatzArt(s));
      bilderFuer(s);
      if (s.mode === 'share' && freigabeVon(share)?.status === 'paused') {
        spaeter(s, FREIGABE_ZUSTAND_MS, () => setze(s, 'fallback', 'sharePaused', ersatzArt(s)));
      }
    };

    // Abbau-Ketten (6.15): jeder Slot meldet slotAudio off/<grund> vor slot off/<grund> (Ton vor Bild).
    const slotAbbauen = (s, grund) => {
      zeitenWeg(s);
      clearTimeout(s.tonZeit);
      slots.delete(s.nr);
      say({ ev: 'slotAudio', slot: s.nr, state: 'off', source: 'none', configured: tonWeg(s), reason: grund });
      say({ ev: 'slot', slot: s.nr, state: 'off', mode: s.mode, target: s.target, share: s.share, reason: grund, sent: 'none', ndi: s.ndi });
    };
    const slotsAbbauen = (grund) => {
      for (const s of [...slots.values()]) slotAbbauen(s, grund);
    };

    // Sprecher (6.8): jedes Signal geht als speakerSignal hinaus und fuettert die Erinnerung; nur das gewaehlte
    // steuert. Ohne Ziel springt ein Sprecher-Slot sofort, sonst muss derselbe Kandidat holdMs lang Kandidat
    // bleiben (vereinfacht, 11.3); kehrt der Gezeigte zurueck, verfaellt der Wechsel.
    const sprecherKandidat = (s, id) => id !== 0 && id !== EIGENE_KENNUNG && teilnehmer.has(id) && (s.showNoVideo || !kameraIstAus(id));
    const sprecherAusErinnerung = (s) => {
      const id = erinnerung.get(sprecher.signal) ?? 0;
      return sprecherKandidat(s, id) ? id : 0;
    };
    const sprecherSignal = (signal, id) => {
      erinnerung.set(signal, id);
      say({ ev: 'speakerSignal', signal, ids: [id], ms: Date.now() - uhrNull });
      if (signal !== sprecher.signal) return;
      for (const s of slots.values()) {
        if (s.mode !== 'speaker') continue;
        clearTimeout(s.halte);
        if (!sprecherKandidat(s, id) || id === s.target) continue;
        if (s.target === 0) {
          umhaengen(s, id, 0, 'speakerChanged');
          tonNachZiel(s);
          continue;
        }
        s.halte = setTimeout(() => {
          if (slots.get(s.nr) !== s || s.mode !== 'speaker' || erinnerung.get(sprecher.signal) !== id) return;
          umhaengen(s, id, 0, 'speakerChanged');
          tonNachZiel(s);
        }, sprecher.holdMs);
      }
    };

    // Freigaben (6.9): gezeigt wird der Eintrag mit dem hoechsten seq, der kein reiner Ton ist.
    const gezeigt = () => freigaben.filter((f) => !f.audioOnly).sort((a, b) => b.seq - a.seq)[0] ?? null;
    const meldeFreigaben = (seeded) => {
      const list = freigaben.map(({ user, share, status, type, audioOnly, pauses }) => ({ user, share, status, type, audioOnly, pauses }));
      const ev = { ev: 'shares', list, shown: gezeigtShare, recent: rueckrufe.slice() };
      if (seeded) ev.seeded = seeded;
      say(ev);
    };
    // Nach jeder Aenderung der Liste: shares melden; aendert sich die gezeigte Freigabe, haengen alle
    // Freigabe-Slots um (shareChanged bzw. shareNone).
    const freigabenGeaendert = () => {
      const g = gezeigt();
      const neu = g ? g.share : 0;
      const wechsel = neu !== gezeigtShare;
      gezeigtShare = neu;
      meldeFreigaben();
      if (!wechsel) return;
      for (const s of slots.values()) {
        if (s.mode !== 'share') continue;
        umhaengen(s, g ? g.user : 0, neu, g ? 'shareChanged' : 'shareNone');
        tonNachZiel(s);
      }
    };
    const rueckruf = (cb, status, f) => {
      rueckrufe.push({ ms: Date.now() - uhrNull, cb, status, user: f.user, share: f.share, type: f.type });
      if (rueckrufe.length > 10) rueckrufe.shift();
    };
    // Pause der gezeigten Freigabe (6.9, Nachfix W1): ab 200 ms ohne Bild sendet der Slot die Kopie (sent held, der
    // Zustand bleibt live), nach 2 s wechselt der Zustand (held/sharePaused mit Kopie, sonst fallback/sharePaused).
    // Mit dem naechsten Bild geht es weiter (live/frames).
    const freigabePause = (f) => {
      for (const s of slots.values()) {
        if (s.mode !== 'share' || s.share !== f.share) continue;
        zeitenWeg(s);
        if (f.status === 'running') {
          if (s.bild) setze(s, 'live', 'frames', 'none');
          else bilderFuer(s);
        } else if (!s.bild) {
          spaeter(s, FREIGABE_ZUSTAND_MS, () => setze(s, 'fallback', 'sharePaused', ersatzArt(s)));
        } else {
          spaeter(s, FREIGABE_HALTEN_MS, () => setze(s, 'live', 'frames', s.kopie ? 'held' : ersatzArt(s)));
          spaeter(s, FREIGABE_ZUSTAND_MS, () => (s.kopie ? setze(s, 'held', 'sharePaused', 'held') : setze(s, 'fallback', 'sharePaused', ersatzArt(s))));
        }
      }
    };
    // Ein Eintrag aus FAKE_FREIGABEN („ms:person:freigabe:aktion", 11.3).
    const freigabeAktion = (user, share, aktion) => {
      let f = freigaben.find((x) => x.user === user && x.share === share);
      if (aktion === 'begin' || aktion === 'ton') {
        if (!f) {
          f = { user, share, status: 'running', type: 'unknown', audioOnly: aktion === 'ton', pauses: 0, seq: ++freigabeSeq };
          freigaben.push(f);
        }
        rueckruf('sharingStatus', aktion === 'ton' ? 'otherSharePureAudioBegin' : 'otherShareBegin', f);
      } else if (!f) {
        return; // ohne Eintrag nichts (6.9, Typ-Nachtrag ohne passenden Eintrag)
      } else if (aktion === 'end') {
        freigaben.splice(freigaben.indexOf(f), 1);
        rueckruf('sharingStatus', f.audioOnly ? 'otherSharePureAudioEnd' : 'otherShareEnd', f);
      } else if (aktion === 'pause' || aktion === 'resume') {
        f.status = aktion === 'pause' ? 'paused' : 'running';
        if (aktion === 'pause') f.pauses++;
        rueckruf('sharingStatus', aktion, f);
        freigabePause(f);
      } else if (aktion.startsWith('typ=')) {
        const typ = aktion.slice(4);
        f.type = SHARE_TYPE_NAMES.includes(typ) ? typ : 'unknown';
        if (f.type === 'computerAudio') f.audioOnly = true;
        // Der Rueckruf traegt den Status aus ZoomSDKSharingSourceInfo (meeting_sharing_interface.h:49): den des Eintrags.
        rueckruf('shareContent', f.audioOnly ? 'otherSharePureAudioBegin' : f.status === 'paused' ? 'pause' : 'otherShareBegin', f);
      }
      freigabenGeaendert();
    };
    // Befuellen beim ersten Freigabe-Slot eines Meetings (6.9): Die Attrappe kennt alle Freigaben schon, das
    // Befuellen ergaenzt nichts; FAKE_FREIGABE_BEFUELLT bestimmt nur, was es meldet (seeded).
    const befuellen = () => {
      if (befuellt) return;
      befuellt = true;
      meldeFreigaben(process.env.FAKE_FREIGABE_BEFUELLT ?? (freigaben.length > 0 ? 'ok' : 'empty'));
    };

    // Zoom meldet die Kamera einer Person (0.18): videoStatus, dann je Slot mit diesem Ziel (nicht Freigabe)
    // fallback/cameraOff bzw. mit dem naechsten Bild live/frames.
    const kameraSetzen = (id, an) => {
      if (an) kameraAus.delete(id);
      else kameraAus.add(id);
      const p = teilnehmer.get(id);
      if (p) p.videoOn = an;
      say({ ev: 'videoStatus', id, videoOn: an, mutedByHost: false });
      for (const s of slots.values()) {
        if (s.target !== id || s.mode === 'share') continue;
        zeitenWeg(s);
        if (an) bilderFuer(s);
        else setze(s, 'fallback', 'cameraOff', ersatzArt(s));
      }
    };
    // FAKE_KEIN_BILD_MS: keine Bilder mehr, ohne dass Zoom die Kamera als aus meldet (6.12): ein laufender Slot
    // geht auf fallback/noFrames; vor dem ersten Bild bleibt ein Slot starting.
    const bildWeg = (id) => {
      keinBild.add(id);
      for (const s of slots.values()) {
        if (s.target !== id || s.mode === 'share') continue;
        zeitenWeg(s);
        if (s.state === 'live') setze(s, 'fallback', kameraIstAus(id) ? 'cameraOff' : 'noFrames', ersatzArt(s));
      }
    };
    // Weggang einer Person (6.7, 6.8 Nr. 6, 6.9): Teilnehmer-Slots Ziel 0 (participantLeft), Sprecher-Slots Ziel 0
    // (speakerNone), ihre Freigaben fallen weg (AN9); die Erinnerung verliert ihre Kennung.
    const slotsBeiWeggang = (id) => {
      for (const [signal, k] of erinnerung) if (k === id) erinnerung.delete(signal);
      for (const s of slots.values()) {
        if (s.target !== id || s.mode === 'share') continue;
        umhaengen(s, 0, 0, s.mode === 'speaker' ? 'speakerNone' : 'participantLeft');
        tonNachZiel(s);
      }
      if (freigaben.some((f) => f.user === id)) {
        for (let i = freigaben.length - 1; i >= 0; i--) if (freigaben[i].user === id) freigaben.splice(i, 1);
        freigabenGeaendert();
      }
    };

    // slotStats je laufendem Slot und bridgeStats, alle 2 s nach init (6.3, 6.17), mit festen Testwerten.
    // Messfelder nur, wo die Attrappe ein Bild bzw. Paket "geliefert" hat (keine erfundenen Werte).
    const statsSenden = () => {
      say({
        ev: 'bridgeStats', cpuPct: 1.5, sysPct: 12, memMb: 85, audioQueueMax: 0, audioDropped: 0, merkerVerworfen: 0,
        halteliste: 0, shareAudioPackets: 0, shareAudioUnassigned: 0, previewOn: vorschauAn,
        ...(imMeeting ? { hdVideo: false, originalSize: false, recvVideo: { w: 1280, h: 720, fps: 30 } } : {}),
      });
      for (const s of slots.values()) {
        const ev = {
          ev: 'slotStats', slot: s.nr, fallbackFps: s.sent === 'none' ? 0 : 10, heldFrames: 0, workUs: 0, copyUs: 0,
          previewUs: 0, memKb: 0, resWanted: s.resolution, foreignFrames: 0, lateFrames: 0, tooFrequent: 0,
          noShareData: 0, rendererNew: 0, rendererLost: 0,
        };
        if (s.target !== 0) Object.assign(ev, { resSet: 0, resGot: ZOOM_STUFE[s.resolution], rawType: s.mode === 'share' ? 1 : 0 });
        if (s.state === 'live' && s.sent === 'none') Object.assign(ev, { w: s.zuletzt[0], h: s.zuletzt[1], fps: 30 });
        else if (s.zuletzt) Object.assign(ev, { lastW: s.zuletzt[0], lastH: s.zuletzt[1] });
        if (s.ton.state === 'live') Object.assign(ev, { audioPps: 50, audioRate: 32000, audioCh: 1 });
        say(ev);
      }
    };
    // Vorschau (6.16): nur bei previewMode on, je Slot mit Bild hoechstens zweimal je Sekunde, ein festes 1x1-JPEG.
    // target ist das Ziel bzw. bei Freigabe-Slots die Freigabe-Kennung des Bildes (6.3).
    const vorschauSenden = () => {
      for (const s of slots.values()) {
        if (s.state !== 'live' || s.sent !== 'none') continue;
        say({ ev: 'preview', slot: s.nr, target: s.mode === 'share' ? s.share : s.target, w: 1, h: 1, jpeg: VORSCHAU_JPEG });
      }
    };

    const slotFehlerSagen = (code, nr) => say(nr === undefined ? { ev: 'error', where: 'slot', code } : { ev: 'error', where: 'slot', code, slot: nr });
    // Erstes Ziel nach Modus (6.7-6.9): Teilnehmer die Kennung (unbekannt -> 0 mit stderr-Zeile), Sprecher aus der
    // Erinnerung, Freigabe die gezeigte Freigabe.
    const erstesZiel = (s, id) => {
      if (s.mode === 'participant') {
        if (id !== 0 && !teilnehmer.has(id)) process.stderr.write(`Slot ${s.nr}: Kennung ${id} gehoert zu keinem Teilnehmer - kein Ziel\n`);
        return [teilnehmer.has(id) ? id : 0, 0];
      }
      if (s.mode === 'speaker') return [sprecherAusErinnerung(s), 0];
      befuellen();
      const g = gezeigt();
      return g ? [g.user, g.share] : [0, 0];
    };
    // slotOn (6.2; Pruefreihenfolge Gliederung 3.2, Faelle in test/slot-pruefung-faelle.json).
    const slotOn = (zeile) => {
      const nr = slotNummer(zeile);
      if (nr === null) return slotFehlerSagen('slotBadNumber');
      if (stummeSlots.has(nr)) return; // FAKE_SLOT_STUMM: keine Antwort
      const ndi = feld(zeile, 'ndi', 'text');
      if (ndiUngueltig(ndi)) return slotFehlerSagen('slotBadName', nr);
      // Nr. 3 (Spec 6.2): direkt nach dem Namen, nur gegen ANDERE laufende Slots (ein zweites slotOn desselben Slots
      // mit seinem eigenen Namen ist slotAlreadyOn, Nachbesserung a1).
      if ([...slots.values()].some((x) => x.nr !== nr && x.ndi === ndi.wert)) return slotFehlerSagen('slotNameTaken', nr);
      const p = pruefeFelder(zeile, true);
      if (p.fehler) return slotFehlerSagen(p.fehler, nr);
      if (slots.has(nr)) return slotFehlerSagen('slotAlreadyOn', nr);
      process.stderr.write(`Befehl gelesen: slotOn ${nr}, Modus ${p.werte.mode}, Ton ${p.werte.audio}\n`);
      if (verbindetNeu) return slotFehlerSagen('slotReconnecting', nr);
      if (!canRecordRaw) return slotFehlerSagen('slotNoPrivilege', nr);
      if (process.env.FAKE_NDI_FEHLER === '1') return say({ ev: 'error', where: 'ndi', code: 'ndiInitFailed' });
      if (slotFehler.has(nr)) {
        const code = slotFehler.get(nr);
        slotFehler.delete(nr);
        return slotFehlerSagen(code, nr);
      }
      const { id = 0, ...werte } = p.werte;
      const s = {
        nr, ndi: ndi.wert, ...werte, target: 0, share: 0, state: 'starting', reason: 'command', sent: 'none', bild: false,
        kopie: false, zuletzt: null, pufferGemeldet: false, zeiten: new Set(), halte: null, tonZeit: null,
        ton: { state: 'off', reason: 'command', source: 'none' },
      };
      slots.set(nr, s);
      const [ziel, share] = erstesZiel(s, id);
      umhaengen(s, ziel, share, 'command');
      tonEinschalten(s);
    };
    // slotSet (6.2): erst alle vorhandenen Felder pruefen, dann slotNotOn, dann aendern: fallback, showNoVideo, Ton,
    // hoechstens ein Umhaengen (mode, id, resolution). Bestaetigung immer mit einem slot-Ereignis.
    const slotSet = (zeile) => {
      const nr = slotNummer(zeile);
      if (nr === null) return slotFehlerSagen('slotBadNumber');
      const p = pruefeFelder(zeile, false);
      if (p.fehler) return slotFehlerSagen(p.fehler, nr);
      const s = slots.get(nr);
      if (!s) return slotFehlerSagen('slotNotOn', nr);
      const w = p.werte;
      const alterWeg = tonWeg(s);
      const alteAufloesung = s.resolution;
      if (w.fallback !== undefined) s.fallback = w.fallback;
      if (w.showNoVideo !== undefined) s.showNoVideo = w.showNoVideo;
      if (w.audio !== undefined) s.audio = w.audio;
      if (w.shareAudio !== undefined) s.shareAudio = w.shareAudio;
      if (w.resolution !== undefined) s.resolution = w.resolution;
      // Vereinfachung: mit einem Moduswechsel im selben Befehl regelt allein der Tonweg den Ton (6.10 Schritt 8).
      if (w.mode !== undefined && w.mode !== s.mode) {
        s.mode = w.mode;
        const [ziel, share] = erstesZiel(s, w.id ?? 0);
        umhaengen(s, ziel, share, 'modeChanged');
        return tonNachModus(s, alterWeg);
      }
      if (w.audio !== undefined || w.shareAudio !== undefined) tonEinschalten(s);
      if (w.id !== undefined && s.mode === 'participant' && w.id !== s.target) {
        umhaengen(s, teilnehmer.has(w.id) ? w.id : 0, 0, 'targetChanged');
        return tonNachZiel(s);
      }
      // Wie die EXE (slotSet in native/video.cpp): nur eine ANDERE Aufloesung haengt um (Nachbesserung a1).
      if (w.resolution !== undefined && w.resolution !== alteAufloesung) return umhaengen(s, s.target, s.share, 'resolutionChanged');
      // Ohne Umhaengen: Bestaetigung mit Grund command; sent folgt einem neuen Ersatzbild (6.12).
      if (s.sent !== 'none') s.sent = ersatzArt(s);
      s.reason = 'command';
      meldeSlot(s);
    };
    const slotOff = (zeile) => {
      const nr = slotNummer(zeile);
      if (nr === null) return slotFehlerSagen('slotBadNumber');
      const s = slots.get(nr);
      if (!s) return slotFehlerSagen('slotNotOn', nr);
      slotAbbauen(s, 'command');
    };
    // speakerConfig und previewMode brauchen kein init (6.2) und werden bestaetigt.
    const speakerConfig = (zeile) => {
      const signal = feld(zeile, 'signal', 'text');
      if (signal.art !== 'gelesen' || !SPEAKER_SIGNALS.includes(signal.wert)) return slotFehlerSagen('speakerBadSignal');
      const halt = feld(zeile, 'holdMs', 'zahl');
      if (halt.art !== 'gelesen' || halt.wert > SPEAKER_HOLD_MAX_MS) return slotFehlerSagen('speakerBadHold');
      sprecher = { signal: signal.wert, holdMs: halt.wert };
      say({ ev: 'speakerConfig', signal: sprecher.signal, holdMs: sprecher.holdMs });
      // Neues Signal: Sprecher-Slots ohne Ziel springen auf die Erinnerung dieses Signals (6.8, vorbelegt).
      for (const s of slots.values()) {
        if (s.mode !== 'speaker' || s.target !== 0) continue;
        const id = sprecherAusErinnerung(s);
        if (id === 0) continue;
        umhaengen(s, id, 0, 'speakerChanged');
        tonNachZiel(s);
      }
    };
    const previewMode = (zeile) => {
      const on = feld(zeile, 'on', 'bool');
      if (on.art !== 'gelesen') return slotFehlerSagen('slotBadFlag');
      vorschauAn = on.wert;
      say({ ev: 'previewMode', on: vorschauAn });
      clearInterval(vorschauTakt);
      vorschauTakt = vorschauAn ? setInterval(vorschauSenden, VORSCHAU_MS) : null;
    };

    // Abbau-Ketten (6.15): Entzug, Meeting-Ende, Abriss und quit bauen alle Slots ab.
    const abbauen = (grund) => slotsAbbauen(grund);

    const imMeetingAnkommen = () => {
      say({ ev: 'status', status: 'inMeeting', raw: 3, code: 0 });
      imMeeting = true;
      teilnehmer.set(100, person(100, 'JM Connect', { self: true, persistentId: 'p-self' }));
      for (let i = 0; i < fremde; i++) {
        const ueber = i === 0 ? { role: 'host' } : {};
        // Fuer den Wiederbeitritt OHNE persistentId - die Rueckkehr ueber den
        // Namen (Connect, Spec 7.3) braucht keine.
        if (i === 0 && wiederbeitritt) ueber.persistentId = '';
        // FAKE_DOPPELNAME: zwei Fremde mit demselben Namen (Spec 4 "Doppelname").
        const name = i === 1 && process.env.FAKE_DOPPELNAME === '1' ? 'Anna' : (namen[i] ?? `Gast ${i}`);
        teilnehmer.set(16778240 + i, person(16778240 + i, name, ueber));
      }
      say({ ev: 'roster', list: [...teilnehmer.values()] });
      if (process.env.FAKE_NAMENSZEILE === '1') {
        // Pruefstand fuer "keine Teilnehmernamen im Log" (Spec N4b.2): eine
        // stderr-Zeile MIT Namen, wie sie eine Diagnose der Bridge enthalten
        // koennte. JM Connect muss sie maskiert ins Log schreiben. 100 ms Abstand:
        // stdout und stderr sind zwei Leitungen; ohne ihn kann die Zeile beim Kern
        // ankommen, bevor er den roster gelesen hat (Plan Aufgabe 12).
        const fremde = [...teilnehmer.values()].filter((p) => !p.self).map((p) => p.name);
        setTimeout(() => process.stderr.write(`Namensprobe: ${fremde.join(', ')}\n`), 100);
      }
      say({ ev: 'privilege', canRecordRaw: false, source: 'check', requested: true });
      if (privileg === 'ja') {
        setTimeout(() => {
          canRecordRaw = true;
          say({ ev: 'privilege', canRecordRaw: true, source: 'requestAnswer' });
          if (process.env.FAKE_ABSTURZ_MS) {
            setTimeout(() => process.exit(0xc0000005 | 0), Number(process.env.FAKE_ABSTURZ_MS));
          }
          if (process.env.FAKE_ENTZUG_MS) {
            // Der Host entzieht die Erlaubnis (native/callbacks.cpp
            // onRecordPrivilegeChanged): ein unaufgeforderter Rundruf. Ab 4b baut
            // die Bridge danach ALLE Abos ab - nicht im Rundruf, sondern im
            // naechsten Schleifendurchlauf (native/main.cpp, nach pumpOnce()).
            // Die Attrappe bildet das mit setImmediate nach (Plan L1/L2).
            setTimeout(() => {
              if (!imMeeting) return;
              canRecordRaw = false;
              say({ ev: 'privilege', canRecordRaw: false, source: 'broadcast' });
              const erteilung = process.env.FAKE_ERTEILUNG_MS;
              const erteilen = () => {
                if (!imMeeting) return;
                canRecordRaw = true;
                say({ ev: 'privilege', canRecordRaw: true, source: 'broadcast' });
              };
              // 0: beide Rundrufe kamen in derselben Pumprunde - privilege true
              // steht VOR dem Abbau auf der Leitung, abgebaut wird trotzdem.
              if (erteilung === '0') erteilen();
              const abbauMs = process.env.FAKE_ABBAU_MS;
              if (abbauMs === undefined) setImmediate(() => abbauen('privilegeRevoked'));
              else setTimeout(() => abbauen('privilegeRevoked'), Number(abbauMs));
              if (erteilung !== undefined && erteilung !== '0') setTimeout(erteilen, Number(erteilung));
            }, Number(process.env.FAKE_ENTZUG_MS));
          }
        }, 50);
      } else if (privileg === 'nein') {
        setTimeout(() => say({ ev: 'privilege', canRecordRaw: false, source: 'requestAnswer', denied: true }), 50);
      }
      if (process.env.FAKE_BEITRITT_MS) {
        setTimeout(() => {
          const p = person(16778242, 'Carla');
          teilnehmer.set(p.id, p);
          say({ ev: 'joined', p });
        }, Number(process.env.FAKE_BEITRITT_MS));
      }
      if (wiederbeitritt) {
        setTimeout(() => {
          const alt = teilnehmer.get(16778240);
          teilnehmer.delete(16778240);
          say({ ev: 'left', id: 16778240 });
          slotsBeiWeggang(16778240);
          const rueckkehr = () => {
            const neu = { ...alt, id: 16778250, name: process.env.FAKE_RUECKKEHR_NAME ?? alt.name };
            teilnehmer.set(neu.id, neu);
            // Nur joined: Die Attrappe haengt nie selbst um (11.3); die Rueckkehr schickt Connect per slotSet.
            say({ ev: 'joined', p: neu });
          };
          const rueckkehrMs = Number(process.env.FAKE_RUECKKEHR_MS ?? '0');
          if (rueckkehrMs > 0) setTimeout(rueckkehr, rueckkehrMs);
          else rueckkehr();
        }, Number(wiederbeitritt));
      }
      // Slots (11.3): Ein neues Meeting beginnt ohne Sperre, mit leerer Sprecher-Erinnerung und leerer
      // Freigabe-Liste (6.8, 6.9). Die neuen Stellschrauben zaehlen ab inMeeting.
      verbindetNeu = false;
      erinnerung.clear();
      freigaben.length = 0;
      gezeigtShare = 0;
      befuellt = false;
      for (const [ms, id] of eintraege(process.env.FAKE_SPRECHER_FOLGE)) {
        setTimeout(() => imMeeting && sprecherSignal(sprecherSignalName, Number(id)), Number(ms));
      }
      for (const [id, ms] of eintraege(process.env.FAKE_KAMERA_AUS_MS)) setTimeout(() => imMeeting && kameraSetzen(Number(id), false), Number(ms));
      for (const [id, ms] of eintraege(process.env.FAKE_KEIN_BILD_MS)) setTimeout(() => imMeeting && bildWeg(Number(id)), Number(ms));
      for (const [ms, user, share, aktion] of eintraege(process.env.FAKE_FREIGABEN)) {
        setTimeout(() => imMeeting && freigabeAktion(Number(user), Number(share), aktion), Number(ms));
      }
      if (script === 'slots') for (const [id, ms] of DREHBUCH_KAMERA_AN) setTimeout(() => imMeeting && kameraSetzen(id, true), ms);
      if (process.env.FAKE_MEETING_ENDE_MS) {
        setTimeout(() => {
          imMeeting = false;
          say({ ev: 'status', status: 'ended', raw: 7, code: 2 });
          abbauen('meetingEnded');
          say({ ev: 'status', status: 'idle', raw: 0, code: 0 });
        }, Number(process.env.FAKE_MEETING_ENDE_MS));
      }
      if (process.env.FAKE_VERBINDUNG_WEG_MS) {
        setTimeout(() => {
          say({ ev: 'status', status: 'reconnecting', raw: 7, code: 0 });
          verbindetNeu = true;
          setTimeout(() => {
            imMeeting = false;
            say({ ev: 'status', status: 'failed', raw: 9, code: 2 });
            abbauen('meetingEnded');
          }, 50);
        }, Number(process.env.FAKE_VERBINDUNG_WEG_MS));
      }
      if (process.env.FAKE_VERBINDUNG_HAENGT_MS) {
        // Zoom verbindet neu und kommt nie an: reconnecting, dann Stille.
        // imMeeting bleibt true - quit verlaesst darum das Meeting (disconnecting, ended).
        setTimeout(() => {
          say({ ev: 'status', status: 'reconnecting', raw: 7, code: 0 });
          verbindetNeu = true;
          if (process.env.FAKE_VERBINDUNG_ZURUECK_MS) {
            // ... ausser Zoom kommt selbst zurueck (Stage 4b). Wie das Original bei
            // JEDEM inMeeting (native/callbacks.cpp onMeetingStatusChanged): roster
            // und die Sofortpruefung der Erlaubnis (native/session.cpp
            // checkPrivilege()). Slots und Kennungen bleiben; ob Zoom die
            // Kennungen dabei wechselt, ist ungemessen.
            setTimeout(() => {
              if (!imMeeting) return;
              say({ ev: 'status', status: 'connecting', raw: 1, code: 0 });
              say({ ev: 'status', status: 'inMeeting', raw: 3, code: 0 });
              say({ ev: 'roster', list: [...teilnehmer.values()] });
              if (canRecordRaw) say({ ev: 'privilege', canRecordRaw: true, source: 'check' });
              else say({ ev: 'privilege', canRecordRaw: false, source: 'check', requested: true });
              // Zoom verbindet selbst neu (6.15): Sperre geloest, Erinnerung leer; Teilnehmer-Slots ohne Ziel
              // (noTarget, bis Connect neue Kennungen schickt, PK21), Sprecher-Slots ohne Ziel (speakerNone).
              verbindetNeu = false;
              erinnerung.clear();
              for (const s of slots.values()) {
                if (s.mode === 'share') continue;
                umhaengen(s, 0, 0, s.mode === 'speaker' ? 'speakerNone' : 'noTarget');
                tonNachZiel(s);
              }
            }, Number(process.env.FAKE_VERBINDUNG_ZURUECK_MS));
          }
        }, Number(process.env.FAKE_VERBINDUNG_HAENGT_MS));
      }
    };

    const beitreten = () => {
      say({ ev: 'status', status: 'connecting', raw: 1, code: 0 });
      if (process.env.FAKE_WARTERAUM === '1') {
        say({ ev: 'status', status: 'waitingRoom', raw: 8, code: 0 });
        if (process.env.FAKE_EINLASS_MS) {
          // Der Host laesst ein. GEMESSEN (Owner-Abnahme): reconnecting,
          // connecting, inMeeting (Spec 3.2-19).
          setTimeout(() => {
            say({ ev: 'status', status: 'reconnecting', raw: 7, code: 0 });
            verbindetNeu = true;
            if (process.env.FAKE_EINLASS_HAENGT === '1') return; // und dann Stille
            say({ ev: 'status', status: 'connecting', raw: 1, code: 0 });
            imMeetingAnkommen();
          }, Number(process.env.FAKE_EINLASS_MS));
        }
        return; // und dann Stille - bis jemand einlaesst oder wir gehen
      }
      if (process.env.FAKE_BEITRITT_SCHEITERT) {
        say({ ev: 'status', status: 'failed', raw: 9, code: Number(process.env.FAKE_BEITRITT_SCHEITERT) });
        return;
      }
      imMeetingAnkommen();
    };

    const beenden = () => {
      const abgang = () => {
        if (imMeeting) {
          abbauen('command');
          say({ ev: 'status', status: 'disconnecting', raw: 5, code: 0 });
          say({ ev: 'status', status: 'ended', raw: 7, code: 0 });
        }
        say({ ev: 'bye' });
        process.exit(0);
      };
      if (process.env.FAKE_ABGANG_MS) setTimeout(abgang, Number(process.env.FAKE_ABGANG_MS));
      else abgang();
    };

    const befehl = (zeile) => {
      process.stderr.write(`ATTRAPPE empfing: ${zeile}\n`);
      if (logDatei) appendFileSync(logDatei, `${zeile}\n`);
      let c;
      try {
        c = JSON.parse(zeile);
      } catch {
        say({ ev: 'error', where: 'parse', code: 'badJson' });
        return;
      }
      if (c.cmd === 'init') {
        if (process.env.FAKE_INIT_FEHLER === '1') {
          sdkOben = false;
          say({ ev: 'error', where: 'init', code: 2 });
        } else {
          say({ ev: 'ready', sdkVersion: process.env.FAKE_SDK_FASSUNG ?? '7.1.5 (attrappe)' });
          if (statsTakt === null) statsTakt = setInterval(statsSenden, STATS_MS);
          if (process.env.FAKE_NDI_FEHLER === '1') say({ ev: 'error', where: 'ndi', code: 'ndiInitFailed' });
        }
      } else if (c.cmd === 'auth') {
        if (!sdkOben) say({ ev: 'error', where: 'auth', code: 7 });
        else if (process.env.FAKE_AUTH_SOFORTFEHLER) say({ ev: 'error', where: 'auth', code: Number(process.env.FAKE_AUTH_SOFORTFEHLER) });
        else say({ ev: 'auth', code: authCode });
      } else if (c.cmd === 'join') beitreten();
      else if (c.cmd === 'quit') beenden();
      else if (c.cmd === 'videoDelay') {
        if (Number.isInteger(c.ms) && c.ms >= 0 && c.ms <= 1000) say({ ev: 'videoDelay', ms: c.ms });
        else say({ ev: 'error', where: 'video', code: 'videoBadDelay' });
      } else if (c.cmd === 'slotOn') derReiheNach(zeile, true, () => slotOn(zeile));
      else if (c.cmd === 'slotSet') derReiheNach(zeile, true, () => slotSet(zeile));
      else if (c.cmd === 'slotOff') derReiheNach(zeile, false, () => slotOff(zeile));
      else if (c.cmd === 'speakerConfig') speakerConfig(zeile);
      else if (c.cmd === 'previewMode') previewMode(zeile);
      // Alles andere, auch videoSubscribe und videoUnsubscribe (6.18): unbekannter Befehl wie in native/main.cpp.
      else say({ ev: 'error', where: 'cmd', code: 1 });
    };

    let rest = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (d) => {
      rest += d;
      const teile = rest.split('\n');
      rest = teile.pop() ?? '';
      for (const z of teile) if (z.trim()) befehl(z.trim());
    });
    process.stdin.on('end', beenden);
    return true; // eigene quit-/EOF-Behandlung, nicht die gemeinsame unten
  },
  // Drehbuch „Slots" (11.3, A-EP22): das Drehbuch steuerung mit der festen Folge aus DREHBUCH_SLOTS (Tabelle dort).
  // Gesetzte Umgebungsvariablen gehen vor.
  slots: () => {
    for (const [k, v] of Object.entries(DREHBUCH_SLOTS)) process.env[k] ??= v;
    return scripts.steuerung();
  },
  stuck: () => {
    say({ ev: 'ready', sdkVersion: '7.1.5 (attrappe)' });
    say({ ev: 'auth', code: 0 });
    say({ ev: 'status', status: 'connecting', raw: 1, code: 0 });
    say({ ev: 'status', status: 'inMeeting', raw: 3, code: 0 });
    // Ein UNGELESENES process.stdin haelt den Event-Loop NICHT am Leben
    // (gemessen: ohne dies beendet sich der Prozess sofort von selbst, sobald
    // die vier say()-Aufrufe durch sind - das GEGENTEIL von "stuck"). Der
    // Zeitgeber hier ist rein ein Wach-Halter, kein Zeitmesswert.
    setInterval(() => {}, 100_000);
    return true; // ueberspringt den gemeinsamen stdin-Block unten - siehe dort
  },
};

const ignoresStdin = (scripts[script] ?? scripts.join)() === true;

// Auf quit und auf EOF wie das Original reagieren - ausser 'stuck' hat sich
// bewusst dagegen entschieden (siehe oben).
if (!ignoresStdin) {
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (d) => {
    if (d.includes('"quit"')) {
      say({ ev: 'bye' });
      process.exit(0);
    }
  });
  process.stdin.on('end', () => {
    say({ ev: 'bye' });
    process.exit(0);
  });
}
