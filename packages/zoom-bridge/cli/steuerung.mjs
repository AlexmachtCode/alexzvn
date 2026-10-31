// Die Steuerung der Bridge: tritt einem echten Meeting bei, druckt jedes
// Ereignis in Klartext, nimmt Live-Befehle von der Tastatur an und geht
// wieder.
//
// ZWEI AUFRUFER, EINE LOGIK (seit dem Einsatzpaket, 01.10.2026):
//   - test/join.mjs      der Konsolen-Pruefstand im Repo (npm run join), Vorgabe 60 s
//   - cli/zoom-join.mjs  die Start-EXE zoom-join.exe im Einsatzpaket, laeuft
//                        ohne Node auf dem Projekt-PC, Vorgabe "bis ende"
// Was hier steht, lief bis dahin woertlich in test/join.mjs; Meldungen und
// Reihenfolge sind unveraendert. Neu sind nur die Live-Befehle (deuteEingabe),
// der Nur-Anmelden-Modus und der Endlos-Lauf bis "ende"/Meeting-Ende.
//
// ZUGANGSDATEN: kommen aus der Umgebung oder aus einer Datei AUSSERHALB des
// Repos. Meeting-Nummer und Kenncode gehoeren nirgends ins Repo, auch nicht als
// Beispiel - deshalb stehen unten nur Platzhalter, keine Ziffern. Der Kenncode
// wird nie gedruckt.
//
//   ZOOM_SDK_CREDENTIALS  = "<Pfad ausserhalb des Repos>\zoom-credentials.json"
//   ZOOM_MEETING_ID       = "<nur Ziffern>"
//   ZOOM_MEETING_PASSCODE = "<Kenncode>"
//
// OPTIONAL: ZOOM_DISPLAY_NAME (Vorgabe "JM Connect").
//
// OPTIONAL: ZOOM_NUR_ANMELDEN = "1" - nur init + auth, Ergebnis drucken, dann
// sauber beenden, OHNE Beitritt. Braucht keine Meeting-Nummer. Fuer
// Rauchtests und als "Zugangsdaten pruefen" fuer den Operator: so laesst sich
// die Einrichtung gegen das echte Zoom pruefen, ohne einem Meeting
// beizutreten. Rueckgabe 0 bei Anmeldung ok, 1 bei Ablehnung/Zeitueberschreitung.
//
// OPTIONAL: ZOOM_VIDEO_SUBSCRIBE = "<kommagetrennte Teilnehmerkennungen>"
// startet nach dem Beitritt je Kennung einen Slot (Modus Teilnehmer, 720p,
// Ersatzbild schwarz, Ton der Person; README.md Abschnitt 7). Seit Connect
// 0.4.0 laufen Bild und Ton ueber Slots (Spec 6.18): jeder Slot ist eine
// feste NDI-Quelle mit einer Nummer, die Bridge haengt nie selbst um. Ohne
// diese Variable geht beim Start kein Slot-Befehl raus - gestartet wird dann
// im Lauf mit "+<id>".
//
// OPTIONAL: ZOOM_AUDIO_OFF = "<Teilmenge davon>" startet die genannten Slots
// OHNE Ton (`audio:"off"`) - Bild ohne Ton. Gebraucht fuer Abnahmepunkt 3
// (Spec Abschnitt 9): dass der Ton-Schalter wirkt, laesst sich sonst gegen ein
// echtes Meeting ueberhaupt nicht pruefen. Die Kennungen muessen auch in
// ZOOM_VIDEO_SUBSCRIBE stehen - eine Kennung nur hier startet nichts, und
// darum wird sie unten ausdruecklich als folgenlos gemeldet statt still
// verschluckt. (Im Lauf: "+<id> stumm".)
//
// OPTIONAL: ZOOM_VIDEO_DELAY_MS = "<0 bis 1000>" setzt den Bild-Versatz
// fuer ALLE Zoom-Quellen gleich beim Start (Abnahmepunkt 5, Lippensynchronitaet).
// WAEHREND DES LAUFS nachstellen: eine Zahl tippen und Enter druecken - die
// Bridge bestaetigt den Wert, der ab jetzt gilt ("Bild-Versatz: ... ms"), oder
// meldet VIDEO_BAD_DELAY und laesst den alten stehen. So laesst sich beim
// Klatschtest nachregeln, ohne das Meeting zu verlassen: Ton hinterher ->
// groesser, Bild hinterher -> kleiner.
//
// DIE KENNUNGEN STEHEN NICHT VORHER FEST: sie gelten nur fuer DIESES Meeting.
// Den Teilnehmer-Block ablesen (die Zahl links) und dann im Lauf mit "+<id>"
// abonnieren - oder, wie frueher, ohne die Variable beitreten, ablesen und mit
// ihr neu starten. Ist die Variable gesetzt, WARTET der Lauf vor dem
// Abonnieren auf die Rohdaten-Erlaubnis - sie kommt regelmaessig erst Sekunden
// NACH dem Beitritt, wenn der Gastgeber sie im Zoom-Client bestaetigt.
//
// KEIN TOP-LEVEL-AWAIT in dieser Datei: die Start-EXE buendelt sie per
// esbuild zu EINER CommonJS-Datei (scripts/build-release.mjs), und CommonJS
// kennt kein Top-Level-await.
import { Bridge, buildJwt, normalizeMeetingId, readCredentials, SLOT_NR_MAX } from '../src/index.ts';
import { LineSplitter } from '../src/protocol.ts';

/**
 * Gemessene Betriebsgroesse (Owner, 14.08.2026: hoechstens 5 je
 * Veranstaltung; fuenf gleichzeitige Abos am echten Meeting abgenommen,
 * README Abschnitt 4). Darueber ist NICHTS belegt - weder dass es geht, noch
 * dass es nicht geht. Darum wird gewarnt, nicht verhindert.
 */
export const BETRIEBSGROESSE = 5;

/** Die kurze Uebersicht - einmal nach dem Teilnehmer-Block gedruckt. */
export const HILFE_KURZ =
  '  Befehle: <Zahl> = Bild-Versatz in ms · +<id> = Slot starten · +<id> stumm = ohne Ton · -<id> = Slot stoppen · =<Slot> <id> = umhaengen · liste · ende · hilfe';

/** Die ausfuehrliche Uebersicht - auf "hilfe" oder "?". */
export function hilfeText() {
  return [
    'Befehle (Zeile tippen, dann Enter):',
    '  <Zahl>         Bild-Versatz in ms fuer ALLE Zoom-Quellen, 0 bis 1000. Ton hinterher -> groesser, Bild hinterher -> kleiner.',
    '  +<id>          einen Slot fuer diese Teilnehmerkennung starten: eigene NDI-Quelle mit Bild und Ton (720p).',
    '  +<id> stumm    dasselbe, aber nur Bild, ohne Ton.',
    '  -<id>          den Slot stoppen, der diese Kennung zeigt. ("-" heisst stoppen - einen negativen Versatz gibt es nicht.)',
    '  =<Slot> <id>   den Slot auf eine andere Kennung umhaengen (dieselbe NDI-Quelle), etwa nach einem Wiederbeitritt.',
    '  liste          Teilnehmer (die Zahl links ist die Kennung) und laufende Slots anzeigen.',
    '  ende           Meeting verlassen und beenden (Strg+C geht auch - das Fenster aber NICHT mit dem X schliessen).',
    '  hilfe oder ?   diese Uebersicht.',
  ].join('\n');
}

/** So beginnt der NDI-Name jedes Konsolen-Slots; dasselbe Praefix wie in JM Connect (NDI_PRAEFIX, teilnehmer.ts). */
export const NDI_PRAEFIX = 'JM Connect – Zoom ';
/** Hoechstens so viele Code-Punkte hat ein NDI-Name (E26). */
const NDI_NAME_MAX = 60;

/** Normierter Name (wie normName in JM Connect, Spec 4): NFC, trim, Leerraum zu einem Leerzeichen, klein. */
export function normName(name) {
  return String(name).normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('de');
}

/** Gleicher NDI-Name wie gleicherNdiName in JM Connect: nach NFC, ohne Gross-/Kleinschreibung. */
function gleicherNdiName(a, b) {
  return a.normalize('NFC').toLocaleLowerCase('de') === b.normalize('NFC').toLocaleLowerCase('de');
}

/**
 * NDI-Name eines Konsolen-Slots nach der Uebergangs-Namensregel (Spec 7.2, A-EP9): Praefix plus Anzeigename, jedes
 * ":" wird ein Leerzeichen, Steuerzeichen fallen weg, sonst bleibt der Name unveraendert (auch doppelter,
 * fuehrender oder abschliessender Leerraum, wie in 0.3.0). Hoechstens 60 Code-Punkte. Kollidiert er mit einem
 * belegten Namen (gleicherNdiName), folgen " (2)", " (3)" ...; vor dem Kuerzen bleibt Platz dafuer. Zweite
 * Fassung der Regel aus JM Connect (die Bridge importiert nicht aus apps/), dieselben Beispiele wie PK35.
 * @param {string} anzeigename
 * @param {string[]} [belegt]
 * @returns {string}
 */
export function konsolenNdiName(anzeigename, belegt = []) {
  const grund = Array.from(NDI_PRAEFIX + String(anzeigename).replace(/:/g, ' ').replace(/\p{Cc}/gu, ''));
  for (let n = 1; ; n++) {
    const zusatz = n === 1 ? '' : ` (${n})`;
    const name = grund.slice(0, NDI_NAME_MAX - zusatz.length).join('') + zusatz;
    if (!belegt.some((b) => gleicherNdiName(b, name))) return name;
  }
}

const unbekannt = (grund) => ({ art: 'unbekannt', grund });

/**
 * Deutet EINE Eingabezeile. Rein - kein Senden, kein Zustand.
 *
 *   "<Zahl>"        -> { art:'versatz', ms }        (die PRUEFUNG 0..1000/ganzzahlig
 *                                                    macht die Bridge - "4.5" muss sie
 *                                                    erreichen, Drehbuch A3 e)
 *   "+<id>"         -> { art:'abonnieren', id, stumm:false }
 *   "+<id> stumm"   -> { art:'abonnieren', id, stumm:true }
 *   "-<id>"         -> { art:'abbestellen', id }    (BEWUSST: "-5" war bis zum
 *                                                    Einsatzpaket ein - ungueltiger -
 *                                                    negativer Versatz)
 *   "=<Slot> <id>"  -> { art:'umhaengen', slot, id }  (Spec 6.18: Rueckkehr von Hand)
 *   "liste" | "ende" | "hilfe"/"?" | "" (leer)
 *   alles andere    -> { art:'unbekannt', grund }
 *
 * Gross-/Kleinschreibung der Woerter ist egal, Leerraum aussen auch.
 */
export function deuteEingabe(zeile) {
  const t = String(zeile).trim();
  if (t === '') return { art: 'leer' };
  const klein = t.toLowerCase();
  if (klein === 'liste') return { art: 'liste' };
  if (klein === 'ende') return { art: 'ende' };
  if (klein === 'hilfe' || klein === '?') return { art: 'hilfe' };

  // "+" und "-" VOR der Zahlpruefung: Number("+5") ist 5 und Number("-5") ist
  // -5 - beide waeren sonst ein Versatz.
  if (t.startsWith('+')) {
    const m = /^\+\s*(\d+)(?:\s+(\S+))?$/.exec(t);
    if (!m) return unbekannt('"+" erwartet eine Teilnehmerkennung (die Zahl links in "liste"), optional gefolgt von "stumm"');
    const id = Number(m[1]);
    if (!Number.isSafeInteger(id)) return unbekannt('diese Kennung ist zu gross, um eine Teilnehmerkennung zu sein');
    if (m[2] !== undefined && m[2].toLowerCase() !== 'stumm') return unbekannt(`nach der Kennung ist nur "stumm" erlaubt, nicht "${m[2]}"`);
    return { art: 'abonnieren', id, stumm: m[2] !== undefined };
  }
  if (t.startsWith('-')) {
    const m = /^-\s*(\d+)$/.exec(t);
    if (!m || !Number.isSafeInteger(Number(m[1]))) {
      return unbekannt('"-" erwartet eine Teilnehmerkennung zum Abbestellen - einen negativen Bild-Versatz gibt es nicht');
    }
    return { art: 'abbestellen', id: Number(m[1]) };
  }

  if (t.startsWith('=')) {
    const m = /^=\s*(\d+)\s+(\d+)$/.exec(t);
    if (!m || !Number.isSafeInteger(Number(m[2]))) {
      return unbekannt('"=" erwartet eine Slot-Nummer und eine Teilnehmerkennung, etwa "=1 16778250"');
    }
    return { art: 'umhaengen', slot: Number(m[1]), id: Number(m[2]) };
  }

  const ms = Number(t);
  if (Number.isFinite(ms)) return { art: 'versatz', ms };
  return unbekannt('weder eine Zahl noch ein bekannter Befehl');
}

/**
 * Strg+C abfangen - Vorgabe fuer den echten Betrieb. Liefert die Abmeldung.
 *
 * DREI Signale, ein Weg (Nachbesserung Einsatzpaket, 01.10.2026):
 *   SIGINT   Strg+C
 *   SIGBREAK Strg+Pause - ohne Lauscher beendet Windows den Prozess sofort
 *   SIGHUP   so meldet Node unter Windows das SCHLIESSEN des Konsolenfensters
 *            (CTRL_CLOSE_EVENT). GEMESSEN ohne Lauscher: zoom-join.exe starb
 *            sofort, die Bridge wurde ueber das Job-Objekt mitgerissen - ohne
 *            quit, also ohne das Meeting zu verlassen. Mit Lauscher haelt
 *            libuv den Steuer-Thread an, und Windows gibt einige Sekunden fuer
 *            quit und Abbau, bevor es den Prozess beendet.
 */
export function strgCAbfangen(handler) {
  const signale = ['SIGINT', 'SIGBREAK', 'SIGHUP'];
  for (const s of signale) process.on(s, handler);
  return () => {
    for (const s of signale) process.off(s, handler);
  };
}

/**
 * Windows-Rueckgabewerte, die beim Start "eine DLL fehlt oder passt nicht"
 * heissen. Ohne diese Deutung stand bei einer unvollstaendig kopierten
 * Zoom-Laufzeit "Anmeldung nicht durchgekommen ... stimmen Client-ID und
 * Secret?" auf dem Schirm (README Abschnitt 8, "Eine fehlende DLL sieht aus
 * wie ein Anmeldefehler") - die Suche lief zu den Zugangsdaten.
 */
const DLL_FEHLER = new Map([
  [0xc0000135, '0xC0000135, STATUS_DLL_NOT_FOUND: eine DLL fehlt'],
  [0xc0000139, '0xC0000139, STATUS_ENTRYPOINT_NOT_FOUND: eine DLL ist zu alt oder passt nicht'],
  [0xc000007b, '0xC000007B, STATUS_INVALID_IMAGE_FORMAT: eine DLL ist kein 64-Bit-Windows-Programm oder beschaedigt'],
]);

/** Der Rueckgabewert aus der detail-Zeile von bridge.ts ("... exitCode=<n>"), sonst null. */
function exitCodeAus(detail) {
  const m = /exitCode=(\d+)/.exec(detail ?? '');
  return m ? Number(m[1]) : null;
}

// Den Hinweis "abonnieren mit +<id>" gibt es sofort: Seit Connect 0.4.0 haengt die Bridge nie selbst um
// (Spec 6.18), das Warten auf ein Umhaengen (bis 0.3.0: 300 ms) entfaellt.

/**
 * Startet die Bridge und fuehrt den ganzen Lauf. Liefert den Rueckgabewert
 * (README Abschnitt 4): 0 im Meeting mit Rohdaten-Erlaubnis (bzw. im
 * Nur-Anmelden-Modus: Anmeldung ok), 3 im Meeting ohne Erlaubnis, 4 nicht ins
 * Meeting gekommen (auch: vorher mit "ende"/Strg+C abgebrochen), 1
 * Vorbedingung fehlt/Anmeldung abgelehnt/Bridge startet nicht, 5 die Bridge
 * ist nach der Anmeldung unerwartet beendet (Absturz), 6 die Verbindung zum
 * Meeting ist abgerissen (Status failed nach dem Beitritt). Der Aufrufer
 * ruft damit process.exit() - diese Funktion selbst beendet nie den Prozess.
 *
 * @param {object} o
 * @param {string} [o.exePath]       zoom-bridge.exe; Vorgabe binPath() (build\Release)
 * @param {string[]} [o.exeArgs]     nur fuer die Selbsttests (Pfad der Attrappe)
 * @param {string|null} [o.zoomDllDir] Verzeichnis der Zoom-Laufzeit-DLLs, kommt vorn
 *                                   auf den PATH des Kindes; null = PATH unveraendert
 * @param {number|null} [o.sekunden] Laufdauer im Meeting; null = bis "ende",
 *                                   Strg+C oder Meeting-Ende
 * @param {Record<string,string|undefined>} [o.env]  Quelle fuer ZOOM_* und Zugangsdaten
 * @param {Record<string,string>} [o.kindEnv]  zusaetzlich an den Kindprozess (Tests)
 * @param {NodeJS.ReadableStream} [o.eingabe]  Live-Befehle; Vorgabe process.stdin
 * @param {(z: string) => void} [o.log]      Klartext; Vorgabe console.log
 * @param {(z: string) => void} [o.fehler]   Vorbedingungsfehler; Vorgabe console.error
 * @param {(z: string) => void} [o.bridgeLog] stderr der Bridge; Vorgabe siehe bridge.ts
 * @param {(h: () => void) => () => void} [o.abbruchSignal] meldet Strg+C an, liefert die Abmeldung
 * @param {(s: import('../src/state.ts').Session) => void} [o.beimEnde] nach dem Abbau, mit dem letzten Zustand
 * @param {(ms: number) => void} [o.beiVersatz] SOFORT bei jedem von der Bridge bestaetigten
 *                                   Bild-Versatz - nicht erst am Ende, das es nach einem
 *                                   geschlossenen Fenster nicht mehr gibt
 * @param {number} [o.joinTimeoutMs]
 * @param {number} [o.killTimeoutMs]
 * @param {number} [o.anmeldeFristMs]   Vorgabe 30 s (wie bisher)
 * @param {number} [o.beitrittsFristMs] Vorgabe 45 s (wie bisher)
 * @param {number} [o.erlaubnisFristMs] Vorgabe 60 s (wie bisher)
 * @returns {Promise<number>}
 */
export async function starteSteuerung(o = {}) {
  const env = o.env ?? process.env;
  const log = o.log ?? ((z) => console.log(z));
  const fehler = o.fehler ?? ((z) => console.error(z));
  const eingabe = o.eingabe ?? process.stdin;
  const sekunden = o.sekunden ?? null;

  // Vorbedingungen, VOR jedem Kindprozess - Rueckgabe 1 (README Abschnitt 4).
  const nurRoh = env.ZOOM_NUR_ANMELDEN;
  if (nurRoh !== undefined && nurRoh !== '' && nurRoh !== '0' && nurRoh !== '1') {
    // Streng, nicht "alles Wahre": wer "ja" schreibt und sich im Pruefmodus
    // waehnt, wuerde sonst einem Meeting beitreten.
    fehler('ZOOM_NUR_ANMELDEN: erwartet 1 (nur anmelden) oder 0 bzw. leer (beitreten).');
    return 1;
  }
  const nurAnmelden = nurRoh === '1';

  let meetingId = null;
  if (!nurAnmelden) {
    if (!env.ZOOM_MEETING_ID) {
      fehler('ZOOM_MEETING_ID ist nicht gesetzt.');
      return 1;
    }
    try {
      meetingId = normalizeMeetingId(env.ZOOM_MEETING_ID);
    } catch (e) {
      // normalizeMeetingId() selbst nennt nie den Wert (siehe protocol.ts) - hier
      // nur der Variablenname davor, damit klar ist, WELCHE Umgebungsvariable
      // gemeint ist, ohne die fehlerhafte Eingabe zu wiederholen.
      fehler(`ZOOM_MEETING_ID: ${e.message}`);
      return 1;
    }
  }

  let jwt;
  try {
    jwt = buildJwt(readCredentials(env));
  } catch (e) {
    fehler(String(e.message));
    return 1;
  }

  // Der Rueckgabewert von onAuthenticationReturn, sobald er da ist; bis dahin
  // null. Gebraucht, weil der Sitzungszustand eine GESCHEITERTE Anmeldung nicht
  // abbildet: reduce() setzt bei code!==0 die Phase gar nicht um (state.ts, Fall
  // 'auth'), "noch keine Antwort" und "abgelehnt" saehen dort also gleich aus.
  // Rennfrei lesbar, weil warte() den Zustand alle 20 ms POLLT (wie
  // bridge.waitFor()) und onEvent() synchron in dispatch() laeuft (bridge.ts) -
  // beim naechsten Blick steht der Wert bereits.
  let authCode = null;
  // Fuer den Hinweis "abonnieren mit +<id>": nur bei einem WIRKLICH neuen
  // Teilnehmer. Das joined-Ereignis kommt auch fuer eine blosse Aktualisierung
  // eines bekannten (README Abschnitt 6).
  const bekannt = new Set();
  let hilfeGezeigt = false;
  // Waren wir JE im Meeting? Ein "ende"/Strg+C im Warteraum ist "nicht ins
  // Meeting gekommen" (4), nicht "im Meeting ohne Erlaubnis" (3) - gemessen
  // stand dort vorher die 3, und das Start-Skript riet dann dem Gastgeber,
  // die Aufnahme zu erlauben, obwohl er uns nie eingelassen hatte.
  let warImMeeting = false;
  // Gesendete, noch NICHT beantwortete Slots: Nummer -> { id, ndi }. Die Betriebsgroesse
  // und die Wahl der freien Nummer zaehlen sie mit: session.slots waechst erst mit der
  // Antwort der Bridge, und sechs auf einmal eingefuegte "+<id>" sahen sonst alle
  // dieselbe Zahl (gemessen).
  const ausstehend = new Map();
  // Fuer wen die Konsole einen Slot gestartet hat: Nummer -> Anzeigename (Hinweis „Rückkehr?“).
  const konsolenName = new Map();
  // Der Bridge-Tod (where:'exit') samt detail ("exitCode=..."), sobald er da
  // ist. Weckt auch den Schlaf der festen Laufdauer: eine tote Bridge muss
  // man nicht 60 s lang beobachten.
  let bridgeEndeDetail = null;
  let gestorbenMelden;
  const bridgeGestorben = new Promise((r) => (gestorbenMelden = r));
  // InitSDK ist gescheitert (where:'init'): dann kommt nie eine auth-Antwort,
  // nur noch ein auth-Fehler (SDKERR_UNINITIALIZE, native/session.cpp).
  let initFehler = false;

  function druckeTeilnehmer(list) {
    log(`  Teilnehmer (${list.length}):`);
    // Kein Hinweis zur persistentId mehr: Seit Connect 0.4.0 haengt die Bridge
    // nie selbst um (Spec 6.18). Kommt jemand zurueck, nennt die Konsole
    // „Rückkehr? =<Slot> <Kennung>“, und der Operator haengt von Hand um.
    for (const p of list) log(`    ${p.id}  ${p.name}${p.self ? '  (das sind wir)' : ''}  Rolle ${p.role}`);
  }

  /** Was der Operator liest, wenn die Bridge stirbt, BEVOR Zoom die Anmeldung beantwortet hat. */
  function startTodText() {
    const code = exitCodeAus(bridgeEndeDetail);
    const dll = code === null ? undefined : DLL_FEHLER.get(code);
    if (dll) {
      return [
        `\nDie Bridge ist beim Start gestorben (${dll}) — es wurde kein Meeting betreten.`,
        'Meist sind die Zoom-Dateien unvollstaendig: den GESAMTEN Inhalt von <Zoom-SDK>\\x64\\bin',
        '(mit Unterordnern) nach bin kopieren - nicht nur sdk.dll. Im Einsatzpaket liegt dort auch die',
        'Visual-C++-Laufzeit (msvcp140.dll, vcruntime140.dll, vcruntime140_1.dll); fehlt sie, das Paket',
        'neu entpacken. Mit den Zugangsdaten hat das nichts zu tun.',
      ].join('\n');
    }
    return (
      '\nDie Bridge hat sich beendet, bevor Zoom die Anmeldung beantwortet hat (siehe FEHLER-Zeile oben)' +
      ' — es wurde kein Meeting betreten. Die Meldungen darueber mitschicken.'
    );
  }

  /** Was der Operator liest, wenn die Bridge NACH der Anmeldung unerwartet stirbt. */
  function absturzText() {
    const code = exitCodeAus(bridgeEndeDetail);
    const dll = code === null ? undefined : DLL_FEHLER.get(code);
    const wie = code === 0xc0000005 ? ' (0xC0000005: ein Absturz)' : dll ? ` (${dll})` : '';
    return `\nDie Bridge hat sich unerwartet beendet${wie} (siehe FEHLER-Zeile oben) — die Steuerung endet. Die Meldungen darueber mitschicken.`;
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
  const kindEnv = { ...(o.kindEnv ?? {}) };
  if (o.zoomDllDir) kindEnv.PATH = `${o.zoomDllDir};${env.PATH ?? process.env.PATH ?? ''}`;

  const bridge = new Bridge({
    exePath: o.exePath,
    exeArgs: o.exeArgs,
    joinTimeoutMs: o.joinTimeoutMs,
    killTimeoutMs: o.killTimeoutMs,
    onLog: o.bridgeLog,
    env: kindEnv,
    envRemove: ['ZOOM_SDK_CLIENT_ID', 'ZOOM_SDK_CLIENT_SECRET', 'ZOOM_SDK_CREDENTIALS'],
    onEvent: (ev, s) => {
      if (ev.ev === 'status') {
        log(`  Status: ${ev.status}  (${ev.explain})`);
        if (ev.status === 'inMeeting') warImMeeting = true;
        // Mit dem Meeting enden auch alle unbeantworteten Abos.
        if (ev.status === 'ended' || ev.status === 'failed') ausstehend.clear();
      }
      else if (ev.ev === 'auth') {
        authCode = ev.code;
        log(`  Anmeldung: ${ev.result}`);
      }
      else if (ev.ev === 'ready') log(`  SDK: ${ev.sdkVersion}`);
      else if (ev.ev === 'roster') {
        druckeTeilnehmer(ev.list);
        for (const p of ev.list) bekannt.add(p.id);
        // EINMAL, gleich unter dem ersten Teilnehmer-Block: genau dort liest
        // man die Kennungen ab, die "+<id>" braucht.
        if (!hilfeGezeigt) {
          hilfeGezeigt = true;
          log(HILFE_KURZ);
        }
      } else if (ev.ev === 'joined') {
        log(`  + ${ev.p.name} (${ev.p.id})`);
        const neu = !bekannt.has(ev.p.id) && !ev.p.self;
        bekannt.add(ev.p.id);
        if (neu) {
          // Keine Rueckkehr von selbst (Spec 6.18): Gleicht der Name dem eines Konsolen-Slots ohne Ziel,
          // nennt die Konsole den Befehl dafuer - sie schickt ihn nicht.
          const rueckkehr = [...bridge.session.slots]
            .filter(([nr, s]) => s.mode === 'participant' && s.target === 0 && konsolenName.has(nr)
              && normName(konsolenName.get(nr)) === normName(ev.p.name))
            .map(([nr]) => nr);
          for (const nr of rueckkehr) log(`  Rückkehr? =${nr} ${ev.p.id}`);
          if (rueckkehr.length === 0 && slotMitZiel(ev.p.id) === null) log(`    abonnieren mit +${ev.p.id}`);
        }
      }
      else if (ev.ev === 'left') log(`  - ${ev.id}`);
      else if (ev.ev === 'renamed') log(`  ~ ${ev.id} heisst jetzt ${ev.name}`);
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
        if (ev.canRecordRaw) log(`  Rohdaten-Erlaubnis: JA  (${woher})`);
        // "timedOut" ist eine ANDERE Ursache als "noch keine Antwort" (siehe
        // state.ts, privilegeTimedOut) - wer hier weiter "bitte bestaetigen"
        // liest, wartet auf eine Antwort, die das SDK schon aufgegeben hat.
        else if (ev.timedOut) log(`  Rohdaten-Erlaubnis: keine Antwort gekommen (Zeitueberschreitung)  (${woher})`);
        else if (ev.denied) log(`  Rohdaten-Erlaubnis: ABGELEHNT  (${woher})`);
        else log(`  Rohdaten-Erlaubnis: fehlt — angefragt, bitte im Zoom-Client bestaetigen  (${woher})`);
      } else if (ev.ev === 'error') {
        // Die Kennung bzw. Slot-Nummer NUR anhaengen, wenn sie dasteht. Zwei Stellen in
        // main.cpp melden Fehler, ohne je eine Kennung gelesen zu haben - dort waere jede
        // angezeigte Zahl erfunden.
        const wen = ev.id !== undefined ? ` fuer ${ev.id}` : ev.slot !== undefined ? ` fuer Slot ${ev.slot}` : '';
        log(`  FEHLER bei ${ev.where}${wen}: ${ev.name} (${ev.code})`);
        if (ev.where === 'slot' && ev.slot !== undefined) ausstehend.delete(ev.slot);
        if (ev.where === 'init') initFehler = true;
        if (ev.where === 'exit') {
          bridgeEndeDetail = ev.detail ?? null;
          gestorbenMelden();
        }
        // "detail" MIT ANZEIGEN: bei where:"exit" steht dort der Rueckgabewert
        // bzw. das Signal des Kindprozesses. Ohne ihn sieht ein Absturz
        // (0xC0000005) genauso aus wie ein geordnetes Ende - zwei Ursachen, ein
        // Bild. Eingerueckt und in einer eigenen Zeile, damit die Fehlerzeile
        // selbst kurz bleibt.
        if (ev.detail) log(`      ${ev.detail}`);
      }
      else if (ev.ev === 'slot') {
        ausstehend.delete(ev.slot);
        if (ev.state === 'off') konsolenName.delete(ev.slot);
        // "rotation"/"limitedRange" stehen NUR dabei, wenn ein Bild des Ziels sie
        // geliefert hat (protocol.ts) - deshalb bedingt angehaengt, nie erfunden.
        let zeile = `  slot ${ev.slot}: ${ev.state} (${ev.reason})  Ziel ${ev.target || 'keins'}  gesendet ${ev.sent}  Quelle "${ev.ndi}"`;
        if (ev.rotation !== undefined) zeile += `  rotation=${ev.rotation}`;
        if (ev.limitedRange !== undefined) zeile += `  limitedRange=${ev.limitedRange}`;
        log(zeile);
      } else if (ev.ev === 'slotAudio') {
        let zeile = `  ton ${ev.slot}: ${ev.state} (${ev.reason})  Quelle ${ev.source}, eingestellt ${ev.configured}`;
        // Format NUR anzeigen, wenn es gemessen wurde - sonst waere die Zeile
        // eine Behauptung ueber etwas, das noch nie ankam.
        if (ev.sampleRate !== undefined) zeile += `  ${ev.sampleRate} Hz, ${ev.channels} Kanal/Kanaele`;
        log(zeile);
      } else if (ev.ev === 'videoDelay') {
        // Die BESTAETIGUNG der Bridge, nicht das Echo der Eingabe: nur diese
        // Zahl gilt. Beim Klatschtest wird sie mitgeschrieben.
        log(`  Bild-Versatz: ${ev.ms} ms (von der Bridge bestaetigt, gilt fuer alle Zoom-Quellen)`);
        // SOFORT weitergeben, nicht erst am Ende: nach Strg+C oder einem
        // geschlossenen Fenster gibt es kein geordnetes Ende mehr, und der
        // per Klatschtest gefundene Wert ging verloren (gemessen).
        if (o.beiVersatz && s.videoDelayMs !== null) {
          try {
            o.beiVersatz(s.videoDelayMs);
          } catch (e) {
            log(`  (Bild-Versatz nicht gesichert: ${e.message})`);
          }
        }
      }
    },
  });

  /**
   * Sendet einen Befehl. ABGESICHERT (Review 30.09.2026): nach einem Absturz
   * der Bridge wirft send() "Bridge laeuft nicht." - aus einem data-Lauscher
   * heraus war das eine unbehandelte Ausnahme mit Rueckgabewert 1
   * ("Einrichtungsfehler"), obwohl EXITED_UNEXPECTEDLY samt Rueckgabewert
   * laengst auf dem Schirm stand. Die Eingabe wird jetzt als folgenlos gemeldet.
   */
  function sicherSenden(cmd, woher) {
    try {
      bridge.send(cmd);
      return true;
    } catch (e) {
      log(`  ${woher}: nicht gesendet - ${e.message}`);
      return false;
    }
  }

  /**
   * Schickt einen Bild-Versatz an die Bridge. Die PRUEFUNG macht die Bridge
   * (0..1000, ganze Zahl) - hier wird nur abgewiesen, was gar keine Zahl ist.
   * So laeuft im Abnahmelauf genau die Pruefung, die auch im Betrieb laeuft,
   * und eine Tippfehler-Eingabe wie "4.5" erreicht sie und wird dort gemeldet.
   */
  function sendeVersatz(roh, woher) {
    const ms = Number(roh);
    if (roh.trim() === '' || !Number.isFinite(ms)) {
      log(`  ${woher}: "${roh}" ist keine Zahl - erwartet: Bild-Versatz in ms (0 bis 1000).`);
      return;
    }
    sicherSenden({ cmd: 'videoDelay', ms }, woher);
  }

  /** Slot-Nummer, die diese Kennung zeigt (laufend oder gesendet), sonst null. */
  function slotMitZiel(id) {
    for (const [nr, s] of bridge.session.slots) if (s.target === id) return nr;
    for (const [nr, a] of ausstehend) if (a.id === id) return nr;
    return null;
  }

  /** Die kleinste freie Slot-Nummer (weder laufend noch gesendet), sonst null. */
  function freieNummer() {
    for (let nr = 1; nr <= SLOT_NR_MAX; nr++) if (!bridge.session.slots.has(nr) && !ausstehend.has(nr)) return nr;
    return null;
  }

  /**
   * "+<id>" im Lauf (Spec 6.18): slotOn mit der kleinsten freien Nummer, Modus Teilnehmer, NDI-Name nach
   * konsolenNdiName, 720p, Ersatzbild schwarz, Ton der Person bzw. mit "stumm" keiner (A-EP8). Vorher geprueft,
   * jeweils weil die Antwort der Bridge an dieser Stelle die falsche Suche ausloesen wuerde:
   *  - keine Rohdaten-Erlaubnis: die Bridge antwortete slotNoPrivilege, und das liest sich wie ein Fehler der
   *    Bruecke. Es ist eine Zeitfrage bzw. eine Frage an den Gastgeber - darum erklaeren, wo sie zu erteilen ist.
   *  - unbekannte Kennung: meist ein Tippfehler oder eine Kennung aus einem FRUEHEREN Meeting. Nicht senden.
   *  - diese Kennung zeigt schon ein Slot (oder einer ist unterwegs): nicht senden. Umschalten geht ueber
   *    -<id>, dann +<id>.
   *  - mehr als BETRIEBSGROESSE Slots: warnen, aber senden - darueber ist nichts belegt, auch kein Scheitern.
   *    GEZAEHLT werden laufende UND gesendete, noch unbeantwortete Slots.
   */
  function abonniere(id, stumm) {
    const s = bridge.session;
    if (s.meeting !== 'inMeeting') {
      log(`  Kein Slot gestartet: wir sind (noch oder nicht mehr) nicht im Meeting.`);
      return;
    }
    if (!s.canRecordRaw) {
      const grund = s.privilegeDenied
        ? 'der Gastgeber hat die Rohdaten-Erlaubnis abgelehnt'
        : s.privilegeTimedOut
          ? 'die Anfrage nach der Rohdaten-Erlaubnis lief ab'
          : 'die Rohdaten-Erlaubnis fehlt noch';
      log(`  Kein Slot gestartet: ${grund}. Der Gastgeber muss sie im Zoom-Client erteilen (Aufnahme erlauben) - danach erneut +${id}.`);
      return;
    }
    const p = s.participants.get(id);
    if (!p) {
      log(`  Kein Slot gestartet: ${id} steht nicht in der Teilnehmerliste. "liste" zeigt die Kennungen - sie gelten nur fuer DIESES Meeting.`);
      return;
    }
    const schon = slotMitZiel(id);
    if (schon !== null) {
      log(`  Kein Slot gestartet: ${id} wird schon gezeigt (Slot ${schon}, laeuft schon). Ton umschalten: erst -${id}, dann +${id}${stumm ? ' stumm' : ''}.`);
      return;
    }
    const nr = freieNummer();
    if (nr === null) {
      log(`  Kein Slot gestartet: alle ${SLOT_NR_MAX} Slots sind belegt.`);
      return;
    }
    const laufend = s.slots.size + ausstehend.size;
    if (laufend >= BETRIEBSGROESSE) {
      log(
        `  ACHTUNG: das wird der ${laufend + 1}. gleichzeitige Slot - gemessen sind ${BETRIEBSGROESSE} (Betriebsgroesse), ` +
          'darueber ist nichts belegt. Wird trotzdem gesendet.',
      );
    }
    const belegt = [...[...s.slots.values()].map((x) => x.ndi), ...[...ausstehend.values()].map((a) => a.ndi)];
    const ndi = konsolenNdiName(p.name, belegt);
    log(`  Slot ${nr} wird gestartet: ${id} (720p)${stumm ? '  OHNE Ton (audio:off)' : ''}`);
    ausstehend.set(nr, { id, ndi });
    konsolenName.set(nr, p.name);
    const gesendet = sicherSenden({
      cmd: 'slotOn', slot: nr, ndi, mode: 'participant', id, resolution: '720p', audio: stumm ? 'off' : 'person',
      shareAudio: false, fallback: 'black', showNoVideo: true,
    }, 'Eingabe');
    if (!gesendet) {
      ausstehend.delete(nr);
      konsolenName.delete(nr);
    }
  }

  /** "-<id>": slotOff des Slots, der diese Kennung zeigt - nie einfach der kleinste (Spec 6.18). */
  function stoppe(id) {
    const nr = slotMitZiel(id);
    if (nr === null) {
      log(`  Kein Slot zeigt ${id}. "liste" zeigt die Slots.`);
      return;
    }
    log(`  Slot ${nr} wird gestoppt: ${id}`);
    sicherSenden({ cmd: 'slotOff', slot: nr }, 'Eingabe');
  }

  /** "=<Slot> <id>": slotSet {slot, id} - die Rueckkehr von Hand (Spec 6.18). */
  function umhaenge(nr, id) {
    const s = bridge.session;
    if (!s.slots.has(nr)) {
      log(`  Slot ${nr} laeuft nicht. "liste" zeigt die Slots.`);
      return;
    }
    const p = s.participants.get(id);
    if (!p) {
      log(`  Nicht umgehaengt: ${id} steht nicht in der Teilnehmerliste.`);
      return;
    }
    log(`  Slot ${nr} wird umgehaengt auf ${id}`);
    konsolenName.set(nr, p.name);
    sicherSenden({ cmd: 'slotSet', slot: nr, id }, 'Eingabe');
  }

  function druckeListe() {
    const s = bridge.session;
    druckeTeilnehmer([...s.participants.values()]);
    if (s.slots.size === 0) log('  Slots: keine.');
    else {
      log(`  Slots (${s.slots.size}):`);
      for (const [nr, v] of s.slots) {
        const a = s.slotAudio.get(nr);
        const ton = a ? `${a.state} (${a.reason})` : 'aus';
        log(`    ${nr}  Ziel ${v.target || 'keins'}  Bild ${v.state} (${v.reason})  Ton ${ton}  Quelle "${v.ndi}"`);
      }
    }
    // Bestaetigt oder gar nicht - eine hier eingesetzte 0 saehe aus wie eine
    // Bestaetigung (state.ts, videoDelayMs).
    log(s.videoDelayMs === null ? '  Bild-Versatz: noch keiner bestaetigt.' : `  Bild-Versatz: ${s.videoDelayMs} ms`);
  }

  let stopping = false;
  let abbruchMelden;
  const abgebrochen = new Promise((r) => (abbruchMelden = r));
  let endeMelden;
  const ende = new Promise((r) => (endeMelden = r));
  async function finish(code) {
    if (stopping) return;
    stopping = true;
    abbruchMelden();
    await bridge.stop();
    try {
      o.beimEnde?.(bridge.session);
    } catch (e) {
      log(`  (Nachbereitung fehlgeschlagen: ${e.message})`);
    }
    endeMelden(code);
  }

  /**
   * Wartet, bis `pred` zutrifft - ODER der Lauf abgebrochen wird ('abbruch')
   * ODER die Frist ablaeuft ('zeit'). Ein eigenes Warten statt
   * bridge.waitFor(), weil jenes sich nicht abbrechen laesst: nach Strg+C
   * oder "ende" pollte es bis zu seiner Frist weiter (45 s beim Beitritt).
   * Im Pruefstand beendete process.exit() das; die Steuerung selbst beendet
   * nie den Prozess.
   */
  async function warte(pred, ms) {
    const frist = Date.now() + ms;
    for (;;) {
      if (stopping) return 'abbruch';
      if (pred(bridge.session)) return 'ok';
      if (Date.now() > frist) return 'zeit';
      await new Promise((r) => setTimeout(r, 20));
    }
  }

  /**
   * Schlaeft `ms` - oder bis zum Abbruch, oder bis die Bridge stirbt (dann
   * gibt es nichts mehr zu beobachten). setTimeout, damit sich auch NaN wie
   * bisher verhaelt.
   */
  async function schlafe(ms) {
    let t;
    await Promise.race([new Promise((r) => (t = setTimeout(r, ms))), abgebrochen, bridgeGestorben]);
    clearTimeout(t);
  }

  /**
   * Wartet nach dem join auf das Ergebnis des Beitritts. Wie warte(), mit zwei
   * Unterschieden (Nachbesserung Einsatzpaket, 01.10.2026):
   *  - 'failed'/'ended' beenden das Warten SOFORT. Ein falscher Kenncode
   *    setzt phase 'left', nicht 'error' - gemessen kam danach 45 s lang
   *    keine Zeile, bis die Frist ablief.
   *  - Im ENDLOS-LAUF (Einsatz) laeuft im Warteraum und beim Warten auf den
   *    Gastgeber KEINE Frist: der Gastgeber laesst ein, wann er will, und
   *    vorher aufzugeben hiesse, mitten in der Vorbereitung neu starten zu
   *    muessen. Abbrechen mit "ende". Mit fester Laufdauer (Pruefstand) gilt
   *    die Frist wie bisher.
   * Beim Betreten eines dieser Wartezustaende steht eine Zeile da, was zu tun ist.
   */
  async function warteAufBeitritt() {
    const fristMs = o.beitrittsFristMs ?? 45_000;
    let frist = Date.now() + fristMs;
    let zuletzt = null;
    for (;;) {
      if (stopping) return 'abbruch';
      const s = bridge.session;
      if (s.meeting === 'inMeeting' || s.phase === 'error' || s.meeting === 'failed' || s.meeting === 'ended') return 'ok';
      const wartend = s.meeting === 'waitingRoom' || s.meeting === 'waitingForHost';
      if (s.meeting !== zuletzt) {
        zuletzt = s.meeting;
        if (s.meeting === 'waitingRoom') {
          log('  Im Warteraum - der Gastgeber muss "JM Connect" im Zoom-Client einlassen. Abbrechen mit "ende".');
        } else if (s.meeting === 'waitingForHost') {
          log('  Warte auf den Gastgeber - das Meeting hat noch nicht begonnen. Abbrechen mit "ende".');
        }
      }
      if (wartend && sekunden === null) frist = Date.now() + fristMs;
      if (Date.now() > frist) return 'zeit';
      await new Promise((r) => setTimeout(r, 20));
    }
  }

  const meetingVorbei = (s) => s.meeting === 'ended' || s.meeting === 'failed' || s.phase === 'left';
  // Die Bridge selbst ist weg (EXITED_UNEXPECTEDLY): im Endlos-Lauf gaebe es
  // sonst nichts mehr, worauf man warten koennte.
  const bridgeTot = (s) => s.lastError?.where === 'exit';

  /**
   * Der Rueckgabewert, wenn der OPERATOR beendet ("ende", Strg+C). Er
   * beantwortet die Frage des Laufs wie das regulaere Ende - mit EINER
   * Ausnahme: wer nie im Meeting war (Warteraum, falscher Kenncode, noch beim
   * Verbinden), ist "nicht ins Meeting gekommen" (4). Vorher stand dort 3
   * ("im Meeting, aber ohne Erlaubnis"), und das Start-Skript riet dem
   * Gastgeber zur Aufnahme-Erlaubnis. Im Nur-Anmelden-Modus ist ein Abbruch
   * eine nicht beendete Pruefung (1).
   */
  function abbruchCode() {
    if (nurAnmelden) return 1;
    if (!warImMeeting) return 4;
    return bridge.session.canRecordRaw ? 0 : 3;
  }

  /** "verlasse das Meeting" nur, wenn wir drin waren. */
  function abbruchWas() {
    if (nurAnmelden) return 'beende die Pruefung …';
    return warImMeeting ? 'verlasse das Meeting …' : 'breche den Beitritt ab …';
  }

  function aufEingabe(zeile) {
    const e = deuteEingabe(zeile);
    if (e.art === 'leer') return;
    // Nach "ende"/Strg+C nichts mehr deuten: gemessen wurden Abos dann noch
    // ANGEKUENDIGT, gingen aber still verloren (stdin der Bridge war schon
    // zu), und ein zweites "ende" druckte ein zweites "Ende".
    if (stopping) {
      log(`  Wird gerade beendet - Eingabe ignoriert: "${zeile.trim()}"`);
      return;
    }
    if (e.art === 'versatz') sendeVersatz(zeile.trim(), 'Eingabe');
    else if (e.art === 'abonnieren') abonniere(e.id, e.stumm);
    else if (e.art === 'abbestellen') stoppe(e.id);
    else if (e.art === 'umhaengen') {
      umhaenge(e.slot, e.id);
    } else if (e.art === 'liste') druckeListe();
    else if (e.art === 'hilfe') log(hilfeText());
    else if (e.art === 'ende') {
      // Wie Strg+C, mit demselben Rueckgabewert.
      log(`\nEnde — ${abbruchWas()}`);
      void finish(abbruchCode());
    } else log(`  Eingabe: "${zeile.trim()}" ist kein Befehl (${e.grund}). "hilfe" zeigt die Befehle.`);
  }

  // LIVE-BEFEHLE: jede Zeile auf stdin ist ein Befehl (deuteEingabe).
  // ABSICHTLICH OHNE readline: readline faengt Strg+C am Terminal selbst ab und
  // reicht es NICHT als SIGINT an den Prozess weiter - der Abbruch weiter oben
  // (Meeting verlassen, kein verwaister Prozess, Stage-1-Abnahme) griffe dann
  // nicht mehr. Ein schlichter data-Lauscher laesst das Terminal im
  // Zeilenmodus, und Strg+C bleibt ein SIGINT.
  const zeilen = new LineSplitter();
  const aufDaten = (d) => {
    for (const zeile of zeilen.push(String(d))) aufEingabe(zeile);
  };

  async function ablauf() {
    await bridge.start();
    if (stopping) return;
    bridge.send({ cmd: 'init' });
    bridge.send({ cmd: 'auth', jwt });

    // Der Versatz VOR dem Beitritt: er soll schon stehen, wenn das erste Abo
    // aufgeht - sonst liefen die ersten Bilder ohne ihn raus.
    if (!nurAnmelden && env.ZOOM_VIDEO_DELAY_MS !== undefined) sendeVersatz(env.ZOOM_VIDEO_DELAY_MS, 'ZOOM_VIDEO_DELAY_MS');

    if (!nurAnmelden) {
      eingabe.setEncoding?.('utf8');
      eingabe.on('data', aufDaten);
    }

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
    //
    // Im Nur-Anmelden-Modus wird ENGER gewartet: nur auf die Anmelde-Antwort,
    // das Ende der Bridge oder einen Fehler, nach dem keine Antwort mehr kommt
    // (init/auth - native/session.cpp meldet bei gescheitertem InitSDK und bei
    // einem sofortigen SDKAuth-Fehler NUR error, nie auth; gemessen wartete
    // dieser Modus sonst 30 s auf "Keine Antwort"). NICHT auf jede phase
    // 'error': sonst hiesse ein NDI_INIT_FAILED (README Abschnitt 7) dort
    // "Anmeldung nicht durchgekommen - stimmen Client-ID und Secret?", und
    // genau dieser Modus soll die Zugangsdaten pruefen.
    const ohneAntwort = (s) => bridgeTot(s) || initFehler || s.lastError?.where === 'auth';
    const angemeldet = nurAnmelden
      ? (s) => authCode !== null || ohneAntwort(s)
      : (s) => authCode !== null || s.phase === 'error';
    const a = await warte(angemeldet, o.anmeldeFristMs ?? 30_000);
    if (a === 'abbruch') return;
    if (a === 'zeit') {
      log('\nKeine Antwort auf die Anmeldung — es wurde kein Meeting betreten.');
      return finish(1);
    }

    if (authCode === null) {
      // Ein Fehler kam VOR der Anmelde-Antwort. Jede Ursache mit eigenem
      // Text: eine fehlende DLL oder ein gescheitertes InitSDK als
      // "stimmen Client-ID und Secret?" zu melden, schickte die Suche zu den
      // Zugangsdaten (gemessen mit einer unvollstaendig kopierten Laufzeit).
      const s = bridge.session;
      if (bridgeTot(s)) log(startTodText());
      else if (initFehler) {
        log('\nDas Zoom-SDK liess sich nicht starten (FEHLER bei init, siehe oben) — es wurde kein Meeting betreten.');
        log('Pruefen: liegt der GESAMTE Inhalt von <Zoom-SDK>\\x64\\bin (mit Unterordnern) vor, nicht nur sdk.dll?');
      } else if (s.lastError?.where === 'auth') {
        log('\nAnmeldung nicht durchgekommen — es wurde kein Meeting betreten.');
        log('Pruefen: ist die App im Zoom-Marketplace eine "Meeting SDK"-App (nicht "General"/OAuth),');
        log('und stimmen Client-ID und Secret in der Datei aus ZOOM_SDK_CREDENTIALS?');
      } else {
        log('\nDie Bridge meldet einen Fehler, bevor die Anmeldung beantwortet war (siehe FEHLER-Zeile oben) — es wurde kein Meeting betreten.');
      }
      return finish(1);
    }

    if (authCode !== 0) {
      // Eigener Rueckgabewert 1 (Einrichtungsfehler), NICHT 4: eine abgelehnte
      // Anmeldung sagt nichts ueber die Meeting-Nummer - zwei verschiedene
      // Ursachen duerfen nie denselben Namen bekommen.
      log('\nAnmeldung nicht durchgekommen — es wurde kein Meeting betreten.');
      log('Pruefen: ist die App im Zoom-Marketplace eine "Meeting SDK"-App (nicht "General"/OAuth),');
      log('und stimmen Client-ID und Secret in der Datei aus ZOOM_SDK_CREDENTIALS?');
      return finish(1);
    }

    if (nurAnmelden) {
      log('\nZugangsdaten in Ordnung — Anmeldung bei Zoom erfolgreich. Es wurde kein Meeting betreten (nur anmelden).');
      return finish(0);
    }

    bridge.send({
      cmd: 'join',
      meetingId,
      passcode: env.ZOOM_MEETING_PASSCODE ?? '',
      displayName: env.ZOOM_DISPLAY_NAME ?? 'JM Connect',
    });

    const b = await warteAufBeitritt();
    if (b === 'abbruch') return;
    if (b === 'zeit') {
      log('\nNicht ins Meeting gekommen — keine Aussage ueber die Rohdaten-Frage, sie wurde nie gestellt.');
      return finish(4);
    }

    if (bridgeTot(bridge.session)) {
      log(absturzText());
      return finish(5);
    }
    if (bridge.session.phase === 'error' || bridge.session.meeting !== 'inMeeting') {
      log('\nNicht ins Meeting gekommen — die Rohdaten-Frage wurde nie gestellt.');
      return finish(4);
    }

    // ZOOM_VIDEO_SUBSCRIBE ist OPTIONAL: ohne die Variable geht beim Start
    // kein Video-Befehl raus. Mit ihr kann gegen ein echtes Meeting geprueft
    // werden, was test/video-limit.mjs systematisch misst - hier nur zum
    // Zusehen, ohne Anspruch auf eine Grenze.
    const videoIds = (env.ZOOM_VIDEO_SUBSCRIBE ?? '')
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
      log('\nWarte auf die Rohdaten-Erlaubnis, bevor Video abonniert wird …');
      // Laeuft die Frist ab: weder JA noch NEIN - der Gastgeber hat schlicht
      // nicht reagiert. Das ist eine dritte Tatsache, nicht "abgelehnt".
      const p = await warte(
        (s) => s.canRecordRaw || s.privilegeDenied || s.privilegeTimedOut || bridgeTot(s),
        o.erlaubnisFristMs ?? 60_000,
      );
      if (p === 'abbruch') return;
      if (bridgeTot(bridge.session)) {
        log(absturzText());
        return finish(5);
      }
      if (!bridge.session.canRecordRaw) {
        const grund = bridge.session.privilegeDenied
          ? 'der Gastgeber hat abgelehnt'
          : bridge.session.privilegeTimedOut
            ? 'die Anfrage lief ab'
            : 'es kam keine Antwort';
        log(`  Kein Video-Abo: ${grund}. Die Video-Frage wurde nie gestellt.`);
        videoIds.length = 0;
      }
    }

    // Als Zahlen vergleichen, nicht als Zeichenketten: "07" und "7" sind
    // dieselbe Kennung, saehen aber als Text verschieden aus - und ein
    // Ton-Schalter, der wegen eines fuehrenden Nullzeichens still nicht greift,
    // waere genau die Sorte Fehler, die dieser Pruefstand aufdecken soll.
    const ohneTon = new Set(
      (env.ZOOM_AUDIO_OFF ?? '')
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
        log(`  ZOOM_VIDEO_SUBSCRIBE: "${raw}" ist keine ganze Zahl - uebersprungen.`);
        continue;
      }
      abonniert.add(id);
      // Derselbe Weg wie "+<id>" (Slot, Spec 6.18), samt Pruefung auf Teilnehmer, laufenden Slot und Betriebsgroesse.
      abonniere(id, ohneTon.has(id));
    }

    // Nichts verschwindet still: eine Kennung in ZOOM_AUDIO_OFF, die gar nicht
    // abonniert wurde, hat KEINE Wirkung. Ohne diese Zeile liefe der Abnahmelauf
    // mit Ton weiter und saehe aus, als habe der Schalter versagt.
    for (const id of ohneTon) {
      if (!abonniert.has(id)) {
        log(`  ZOOM_AUDIO_OFF: ${id} steht nicht in ZOOM_VIDEO_SUBSCRIBE - folgenlos.`);
      }
    }

    if (sekunden !== null) {
      log(`\nIm Meeting. Bleibe ${sekunden} s (Strg+C beendet frueher).`);
      log('Bild-Versatz nachstellen: Zahl in ms tippen + Enter (0 bis 1000). Ton hinterher -> groesser.');
      await schlafe(sekunden * 1000);
      if (stopping) return;
      // Ein Absturz ist eine eigene Antwort (5), kein "alles gut" - vorher
      // gab auch der Pruefstand nach einem Absturz 0 zurueck.
      if (bridgeTot(bridge.session)) {
        log(absturzText());
        return finish(5);
      }
      // Der Rueckgabewert beantwortet DIE FRAGE DIESES LAUFS, nicht die Teilfrage
      // "hat der Beitritt geklappt". Ein geglueckter Beitritt ohne Erlaubnis mit 0
      // zu quittieren waere genau die Sorte Luege, die dieses Werkzeug aufdecken soll.
      return finish(bridge.session.canRecordRaw ? 0 : 3);
    }

    // ENDLOS-LAUF (Einsatz): bis "ende", Strg+C oder Meeting-Ende. Ein Meeting,
    // das der Gastgeber beendet, beendet hier auch den Lauf - im Pruefstand mit
    // fester Laufdauer dagegen NICHT (dort laeuft die Bridge absichtlich weiter,
    // ABNAHME-STAGE3.md A6).
    log('\nIm Meeting. Bleibe bis "ende" (Strg+C geht auch) oder bis das Meeting endet.');
    log('Bild-Versatz nachstellen: Zahl in ms tippen + Enter (0 bis 1000). Ton hinterher -> groesser.');
    const w = await warte((s) => meetingVorbei(s) || bridgeTot(s), Infinity);
    if (w === 'abbruch') return;
    // DREI Enden, DREI Antworten (Nachbesserung Einsatzpaket, 01.10.2026).
    // Vorher gab jedes davon canRecordRaw ? 0 : 3 zurueck, und das Start-Skript
    // meldete nach einem Absturz mitten in der Sendung gruen "Im Meeting
    // gewesen, Erlaubnis war erteilt". canRecordRaw steht nach einem Ende
    // ohnehin weiter auf true: native/callbacks.cpp loescht die Erlaubnis bei
    // ENDED/FAILED ausdruecklich OHNE Ereignis.
    const se = bridge.session;
    if (bridgeTot(se)) {
      log(absturzText());
      return finish(5);
    }
    if (se.meeting === 'failed') {
      // 'failed' NACH dem Beitritt heisst: die Verbindung ist abgerissen
      // (gemessen: reconnecting -> failed "Wiederverbinden fehlgeschlagen").
      // Das ist kein Meeting-Ende - das Meeting laeuft ohne uns weiter.
      log('\nDie Verbindung zum Meeting ist abgerissen (siehe Status-Zeile oben) — die Bridge wird beendet. Neu starten, um wieder beizutreten.');
      return finish(6);
    }
    log('\nDas Meeting ist zu Ende — die Bridge wird beendet.');
    return finish(se.canRecordRaw ? 0 : 3);
  }

  // VOR dem Start registrieren: bricht der Start ab, muss Strg+C trotzdem greifen.
  const abmelden = (o.abbruchSignal ?? strgCAbfangen)(() => {
    if (stopping) {
      log('  Wird schon beendet - bitte warten …');
      return;
    }
    log(`\nAbbruch — ${abbruchWas()}`);
    void finish(abbruchCode());
  });

  if (nurAnmelden) log('Nur anmelden: die Zugangsdaten werden bei Zoom geprueft, es wird KEIN Meeting betreten.');

  ablauf().catch((e) => {
    // Nach dem Abbau sind Fehler Folgen, keine Ursache (z. B. send() auf eine
    // eben beendete Bridge) - sie zu melden schickte die Suche falsch.
    if (stopping) return;
    fehler(`Die Steuerung ist auf einen Fehler gelaufen: ${e?.message ?? e}`);
    void finish(1);
  });

  const code = await ende;
  abmelden();
  eingabe.off?.('data', aufDaten);
  eingabe.pause?.();
  return code;
}
