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
// abonniert nach dem Beitritt das Video der genannten Kennungen (720p,
// siehe README.md Abschnitt 7). Ohne diese Variable geht beim Start kein
// Video-Befehl raus - abonniert wird dann im Lauf mit "+<id>".
//
// OPTIONAL: ZOOM_AUDIO_OFF = "<Teilmenge davon>" schickt fuer die
// genannten Kennungen ein videoSubscribe MIT `audio:false` - Bild ohne Ton.
// Gebraucht fuer Abnahmepunkt 3 (Spec Abschnitt 9): dass der Ton-Schalter
// wirkt, laesst sich sonst gegen ein echtes Meeting ueberhaupt nicht pruefen,
// weil das Feld ohne Angabe auf `true` steht (protocol.ts) und dieser
// Pruefstand es bisher nie gesetzt hat. Die Kennungen muessen auch in
// ZOOM_VIDEO_SUBSCRIBE stehen - eine Kennung nur hier abonniert nichts, und
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
import { Bridge, buildJwt, normalizeMeetingId, readCredentials } from '../src/index.ts';
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
  '  Befehle: <Zahl> = Bild-Versatz in ms · +<id> = abonnieren · +<id> stumm = ohne Ton · -<id> = abbestellen · liste · ende · hilfe';

/** Die ausfuehrliche Uebersicht - auf "hilfe" oder "?". */
export function hilfeText() {
  return [
    'Befehle (Zeile tippen, dann Enter):',
    '  <Zahl>         Bild-Versatz in ms fuer ALLE Zoom-Quellen, 0 bis 1000. Ton hinterher -> groesser, Bild hinterher -> kleiner.',
    '  +<id>          Bild und Ton dieser Teilnehmerkennung als NDI-Quelle abonnieren (720p).',
    '  +<id> stumm    dasselbe, aber nur Bild, ohne Ton.',
    '  -<id>          dieses Abo beenden. ("-" heisst abbestellen - einen negativen Versatz gibt es nicht.)',
    '  liste          Teilnehmer (die Zahl links ist die Kennung) und laufende Abos anzeigen.',
    '  ende           Meeting verlassen und beenden (Strg+C geht auch).',
    '  hilfe oder ?   diese Uebersicht.',
  ].join('\n');
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

  const ms = Number(t);
  if (Number.isFinite(ms)) return { art: 'versatz', ms };
  return unbekannt('weder eine Zahl noch ein bekannter Befehl');
}

/** Strg+C abfangen - Vorgabe fuer den echten Betrieb. Liefert die Abmeldung. */
function strgCAbfangen(handler) {
  process.on('SIGINT', handler);
  return () => process.off('SIGINT', handler);
}

/**
 * Startet die Bridge und fuehrt den ganzen Lauf. Liefert den Rueckgabewert
 * (README Abschnitt 4): 0 im Meeting mit Rohdaten-Erlaubnis (bzw. im
 * Nur-Anmelden-Modus: Anmeldung ok), 3 im Meeting ohne Erlaubnis, 4 nicht ins
 * Meeting gekommen, 1 Vorbedingung fehlt/Anmeldung abgelehnt. Der Aufrufer
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

  function druckeTeilnehmer(list) {
    log(`  Teilnehmer (${list.length}):`);
    // "ohne persistentId" IMMER anzeigen: ohne diese Kennung kann ein Abo
    // einen Wiederbeitritt NICHT ueberleben (siehe videoParticipantJoined
    // in native/video.cpp - zwei Gaeste ohne persistentId waeren nicht
    // auseinanderzuhalten, und ein Umhaengen auf Verdacht waere eine
    // Personenverwechslung auf Sendung). Das ist eine Eigenschaft des
    // Zoom-Kontos des GASTES, keine unserer Entscheidungen - aber wer sie
    // nicht sieht, sucht den Fehler bei uns.
    for (const p of list) {
      const pid = p.persistentId ? '' : '  [ohne persistentId → Wiederbeitritt nicht umhaengbar]';
      log(`    ${p.id}  ${p.name}${p.self ? '  (das sind wir)' : ''}  Rolle ${p.role}${pid}`);
    }
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
    onEvent: (ev) => {
      if (ev.ev === 'status') log(`  Status: ${ev.status}  (${ev.explain})`);
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
        if (!bekannt.has(ev.p.id) && !ev.p.self) log(`    abonnieren mit +${ev.p.id}`);
        bekannt.add(ev.p.id);
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
        // Die Kennung NUR anhaengen, wenn sie dasteht. Zwei Stellen in main.cpp
        // melden videoUnknownParticipant, ohne je eine Kennung gelesen zu haben
        // - dort waere jede angezeigte Zahl erfunden.
        const wen = ev.id !== undefined ? ` fuer ${ev.id}` : '';
        log(`  FEHLER bei ${ev.where}${wen}: ${ev.name} (${ev.code})`);
        // "detail" MIT ANZEIGEN: bei where:"exit" steht dort der Rueckgabewert
        // bzw. das Signal des Kindprozesses. Ohne ihn sieht ein Absturz
        // (0xC0000005) genauso aus wie ein geordnetes Ende - zwei Ursachen, ein
        // Bild. Eingerueckt und in einer eigenen Zeile, damit die Fehlerzeile
        // selbst kurz bleibt.
        if (ev.detail) log(`      ${ev.detail}`);
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
        log(zeile);
      } else if (ev.ev === 'audio') {
        let zeile = `  audio ${ev.id}: ${ev.state} (${ev.reason})`;
        // Format NUR anzeigen, wenn es gemessen wurde - sonst waere die Zeile
        // eine Behauptung ueber etwas, das noch nie ankam.
        if (ev.sampleRate !== undefined) zeile += `  ${ev.sampleRate} Hz, ${ev.channels} Kanal/Kanaele`;
        log(zeile);
      } else if (ev.ev === 'videoDelay') {
        // Die BESTAETIGUNG der Bridge, nicht das Echo der Eingabe: nur diese
        // Zahl gilt. Beim Klatschtest wird sie mitgeschrieben.
        log(`  Bild-Versatz: ${ev.ms} ms (von der Bridge bestaetigt, gilt fuer alle Zoom-Quellen)`);
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
    } catch (e) {
      log(`  ${woher}: nicht gesendet - ${e.message}`);
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

  /**
   * "+<id>" im Lauf. Drei Dinge werden VOR dem Senden geprueft - jedes, weil
   * die Antwort der Bridge an dieser Stelle die falsche Suche ausloesen wuerde:
   *  - keine Rohdaten-Erlaubnis: die Bridge antwortete VIDEO_NO_PRIVILEGE, und
   *    das liest sich wie ein Fehler der Bruecke. Es ist eine Zeitfrage bzw.
   *    eine Frage an den Gastgeber (gemessen am 13.08.2026: das JA kommt
   *    regelmaessig erst Sekunden nach dem Beitritt) - darum erklaeren, wo sie
   *    zu erteilen ist, statt zu senden.
   *  - unbekannte Kennung: meist ein Tippfehler oder eine Kennung aus einem
   *    FRUEHEREN Meeting (sie gelten nur fuer dieses). Nicht senden.
   *  - mehr als BETRIEBSGROESSE Abos: warnen, aber senden - darueber ist
   *    nichts belegt, auch kein Scheitern.
   */
  function abonniere(id, stumm) {
    const s = bridge.session;
    if (s.meeting !== 'inMeeting') {
      log(`  Kein Abo gesendet: wir sind (noch oder nicht mehr) nicht im Meeting.`);
      return;
    }
    if (!s.canRecordRaw) {
      const grund = s.privilegeDenied
        ? 'der Gastgeber hat die Rohdaten-Erlaubnis abgelehnt'
        : s.privilegeTimedOut
          ? 'die Anfrage nach der Rohdaten-Erlaubnis lief ab'
          : 'die Rohdaten-Erlaubnis fehlt noch';
      log(`  Kein Abo gesendet: ${grund}. Der Gastgeber muss sie im Zoom-Client erteilen (Aufnahme erlauben) - danach erneut +${id}.`);
      return;
    }
    if (!s.participants.has(id)) {
      log(`  Kein Abo gesendet: ${id} steht nicht in der Teilnehmerliste. "liste" zeigt die Kennungen - sie gelten nur fuer DIESES Meeting.`);
      return;
    }
    if (!s.videoSubs.has(id) && s.videoSubs.size >= BETRIEBSGROESSE) {
      log(
        `  ACHTUNG: das wird das ${s.videoSubs.size + 1}. gleichzeitige Abo - gemessen sind ${BETRIEBSGROESSE} (Betriebsgroesse), ` +
          'darueber ist nichts belegt. Wird trotzdem gesendet.',
      );
    }
    log(`  Video wird abonniert: ${id} (720p)${stumm ? '  OHNE Ton (audio:false)' : ''}`);
    // Das Feld nur setzen, wenn es auf false soll - siehe die Abos beim Start.
    if (stumm) sicherSenden({ cmd: 'videoSubscribe', id, resolution: '720p', audio: false }, 'Eingabe');
    else sicherSenden({ cmd: 'videoSubscribe', id, resolution: '720p' }, 'Eingabe');
  }

  function druckeListe() {
    const s = bridge.session;
    druckeTeilnehmer([...s.participants.values()]);
    if (s.videoSubs.size === 0) log('  Abonniert: keine.');
    else {
      log(`  Abonniert (${s.videoSubs.size}):`);
      for (const [id, v] of s.videoSubs) {
        const a = s.audioSubs.get(id);
        const ton = a ? `${a.state} (${a.reason})` : 'aus';
        log(`    ${id}  Bild ${v.state} (${v.reason})  Ton ${ton}  Quelle "${v.source}"`);
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

  /** Schlaeft `ms` - oder bis zum Abbruch. setTimeout, damit sich auch NaN wie bisher verhaelt. */
  async function schlafe(ms) {
    let t;
    await Promise.race([new Promise((r) => (t = setTimeout(r, ms))), abgebrochen]);
    clearTimeout(t);
  }

  const meetingVorbei = (s) => s.meeting === 'ended' || s.meeting === 'failed' || s.phase === 'left';
  // Die Bridge selbst ist weg (EXITED_UNEXPECTEDLY): im Endlos-Lauf gaebe es
  // sonst nichts mehr, worauf man warten koennte.
  const bridgeTot = (s) => s.lastError?.where === 'exit';

  function aufEingabe(zeile) {
    const e = deuteEingabe(zeile);
    if (e.art === 'leer') return;
    if (e.art === 'versatz') sendeVersatz(zeile.trim(), 'Eingabe');
    else if (e.art === 'abonnieren') abonniere(e.id, e.stumm);
    else if (e.art === 'abbestellen') {
      log(`  Abo wird beendet: ${e.id}`);
      sicherSenden({ cmd: 'videoUnsubscribe', id: e.id }, 'Eingabe');
    } else if (e.art === 'liste') druckeListe();
    else if (e.art === 'hilfe') log(hilfeText());
    else if (e.art === 'ende') {
      // Wie Strg+C, mit demselben Rueckgabewert.
      log('\nEnde — verlasse das Meeting …');
      void finish(bridge.session.canRecordRaw ? 0 : 3);
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
    // Im Nur-Anmelden-Modus wird ENGER gewartet: nur auf die Anmelde-Antwort
    // oder das Ende der Bridge, nicht auf jede phase 'error'. Sonst hiesse ein
    // NDI_INIT_FAILED (setzt phase 'error', README Abschnitt 7) dort
    // "Anmeldung nicht durchgekommen - stimmen Client-ID und Secret?", und
    // genau dieser Modus soll die Zugangsdaten pruefen.
    const angemeldet = nurAnmelden
      ? (s) => authCode !== null || bridgeTot(s)
      : (s) => authCode !== null || s.phase === 'error';
    const a = await warte(angemeldet, o.anmeldeFristMs ?? 30_000);
    if (a === 'abbruch') return;
    if (a === 'zeit' || (nurAnmelden && authCode === null)) {
      log('\nKeine Antwort auf die Anmeldung — es wurde kein Meeting betreten.');
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

    const b = await warte((s) => s.meeting === 'inMeeting' || s.phase === 'error', o.beitrittsFristMs ?? 45_000);
    if (b === 'abbruch') return;
    if (b === 'zeit') {
      log('\nNicht ins Meeting gekommen — keine Aussage ueber die Rohdaten-Frage, sie wurde nie gestellt.');
      return finish(4);
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
      const p = await warte((s) => s.canRecordRaw || s.privilegeDenied || s.privilegeTimedOut, o.erlaubnisFristMs ?? 60_000);
      if (p === 'abbruch') return;
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
      const stumm = ohneTon.has(id);
      log(`  Video wird abonniert: ${id} (720p)${stumm ? '  OHNE Ton (audio:false)' : ''}`);
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
        log(`  ZOOM_AUDIO_OFF: ${id} steht nicht in ZOOM_VIDEO_SUBSCRIBE - folgenlos.`);
      }
    }

    if (sekunden !== null) {
      log(`\nIm Meeting. Bleibe ${sekunden} s (Strg+C beendet frueher).`);
      log('Bild-Versatz nachstellen: Zahl in ms tippen + Enter (0 bis 1000). Ton hinterher -> groesser.');
      await schlafe(sekunden * 1000);
      if (stopping) return;
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
    if (meetingVorbei(bridge.session)) log('\nDas Meeting ist zu Ende — die Bridge wird beendet.');
    else log('\nDie Bridge hat sich unerwartet beendet (siehe FEHLER-Zeile oben) — die Steuerung endet.');
    return finish(bridge.session.canRecordRaw ? 0 : 3);
  }

  // VOR dem Start registrieren: bricht der Start ab, muss Strg+C trotzdem greifen.
  const abmelden = (o.abbruchSignal ?? strgCAbfangen)(() => {
    log('\nAbbruch — verlasse das Meeting …');
    void finish(bridge.session.canRecordRaw ? 0 : 3);
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
