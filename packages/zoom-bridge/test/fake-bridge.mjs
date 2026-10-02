#!/usr/bin/env node
// Attrappe der Bridge fuer die Selbsttests. Spielt eine aufgezeichnete
// Ereignisfolge ab, damit src/bridge.ts ohne SDK, ohne Compiler und ohne
// Meeting pruefbar ist. Die Folge waehlt FAKE_SCRIPT.
import { appendFileSync } from 'node:fs';

const script = process.env.FAKE_SCRIPT ?? 'join';

const say = (o) => process.stdout.write(`${JSON.stringify(o)}\n`);

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
    say({ ev: 'envprobe', seen });
  },
  // Ein Abo, wie es der native Teil meldet: erst steht der Sender, dann
  // fliessen Bilder. Wartet auf den Befehl, damit die Reihenfolge stimmt.
  video: () => {
    say({ ev: 'ready', sdkVersion: '7.1.5 (attrappe)' });
    say({ ev: 'auth', code: 0 });
    say({ ev: 'status', status: 'inMeeting', raw: 3, code: 0 });
    say({ ev: 'privilege', canRecordRaw: true, source: 'requestAnswer' });
    process.stdin.on('data', (d) => {
      const s = String(d);
      if (s.includes('"videoSubscribe"')) {
        say({ ev: 'video', id: 42, state: 'subscribed', source: 'JM Connect – Zoom Attrappe', reason: 'command', rebindable: true });
        say({ ev: 'video', id: 42, state: 'live', source: 'JM Connect – Zoom Attrappe', reason: 'frames', rebindable: true, rotation: 0, limitedRange: true });
        say({ ev: 'audio', id: 42, state: 'waiting', reason: 'command' });
        say({ ev: 'audio', id: 42, state: 'live', reason: 'packets', sampleRate: 32000, channels: 1 });
      }
      if (s.includes('"videoUnsubscribe"')) {
        say({ ev: 'audio', id: 42, state: 'off', reason: 'command' });
        say({ ev: 'video', id: 42, state: 'unsubscribed', source: 'JM Connect – Zoom Attrappe', reason: 'command', rebindable: true });
      }
    });
  },
  // Antwortet auf BEFEHLE wie das Original (native/main.cpp), statt eine
  // feste Folge abzuspielen - fuer die Steuerung der Start-EXE
  // (cli/steuerung.mjs), deren Ablauf von den Antworten abhaengt: erst
  // init -> ready, auth -> auth, DANN join. Jede empfangene Befehlszeile geht
  // als "ATTRAPPE empfing: <zeile>" auf stderr, damit ein Test pruefen kann,
  // was gesendet wurde - und was NICHT (kein join im Nur-Anmelden-Modus, kein
  // videoSubscribe ohne Erlaubnis).
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
  //                         als 16778250 zurueck. Laeuft ein Abo auf sie, haengt
  //                         es sich ueber den Namen um (reboundByName) - in der
  //                         Reihenfolge von native/callbacks.cpp onUserJoin:
  //                         ERST joined, DANN das video-Ereignis.
  //   FAKE_ABGANG_MS        quit braucht so lange, bevor das Meeting verlassen wird
  //   FAKE_LOGDATEI         jede empfangene Befehlszeile auch in diese Datei
  //                         (fuer den Konsolen-Pruefstand, der stderr nicht sieht)
  //
  // Der Vertrag folgt dem Original: Fehler tragen die Kennung, wo eine gelesen
  // wurde; videoDelay prueft ganze Zahl 0..1000 und bestaetigt den geltenden
  // Wert; ein Abo ohne "audio" hat Ton (Vorgabe true); beim Abbau meldet sich
  // der Ton VOR dem Bild ab (README Abschnitt 7); quit verlaesst ein laufendes
  // Meeting erst und sagt dann "bye"; EOF wirkt wie quit.
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
    const abos = new Map(); // id -> { source, audio, rebindable }
    const logDatei = process.env.FAKE_LOGDATEI;

    const abbauen = (grund) => {
      for (const [id, a] of abos) {
        if (a.audio) say({ ev: 'audio', id, state: 'off', reason: grund });
        say({ ev: 'video', id, state: 'unsubscribed', source: a.source, reason: grund, rebindable: a.rebindable });
      }
      abos.clear();
    };

    const imMeetingAnkommen = () => {
      say({ ev: 'status', status: 'inMeeting', raw: 3, code: 0 });
      imMeeting = true;
      teilnehmer.set(100, person(100, 'JM Connect', { self: true, persistentId: 'p-self' }));
      for (let i = 0; i < fremde; i++) {
        const ueber = i === 0 ? { role: 'host' } : {};
        // Fuer den Wiederbeitritt OHNE persistentId - der Weg ueber den Namen
        // braucht keine (native/video.cpp, videoParticipantJoined).
        if (i === 0 && wiederbeitritt) ueber.persistentId = '';
        teilnehmer.set(16778240 + i, person(16778240 + i, namen[i] ?? `Gast ${i}`, ueber));
      }
      say({ ev: 'roster', list: [...teilnehmer.values()] });
      say({ ev: 'privilege', canRecordRaw: false, source: 'check', requested: true });
      if (privileg === 'ja') {
        setTimeout(() => {
          canRecordRaw = true;
          say({ ev: 'privilege', canRecordRaw: true, source: 'requestAnswer' });
          if (process.env.FAKE_ABSTURZ_MS) {
            setTimeout(() => process.exit(0xc0000005 | 0), Number(process.env.FAKE_ABSTURZ_MS));
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
          const neu = { ...alt, id: 16778250 };
          teilnehmer.set(neu.id, neu);
          // ERST joined, DANN das Umhaengen (native/callbacks.cpp onUserJoin).
          say({ ev: 'joined', p: neu });
          const a = abos.get(16778240);
          if (a) {
            abos.delete(16778240);
            abos.set(neu.id, a);
            say({ ev: 'video', id: neu.id, state: 'subscribed', source: a.source, reason: 'reboundByName', rebindable: a.rebindable });
            if (a.audio) say({ ev: 'audio', id: neu.id, state: 'waiting', reason: 'command' });
          }
        }, Number(wiederbeitritt));
      }
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
          setTimeout(() => {
            imMeeting = false;
            say({ ev: 'status', status: 'failed', raw: 9, code: 2 });
            abbauen('meetingEnded');
          }, 50);
        }, Number(process.env.FAKE_VERBINDUNG_WEG_MS));
      }
    };

    const beitreten = () => {
      say({ ev: 'status', status: 'connecting', raw: 1, code: 0 });
      if (process.env.FAKE_WARTERAUM === '1') {
        say({ ev: 'status', status: 'waitingRoom', raw: 8, code: 0 });
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
        } else say({ ev: 'ready', sdkVersion: '7.1.5 (attrappe)' });
      } else if (c.cmd === 'auth') {
        if (!sdkOben) say({ ev: 'error', where: 'auth', code: 7 });
        else if (process.env.FAKE_AUTH_SOFORTFEHLER) say({ ev: 'error', where: 'auth', code: Number(process.env.FAKE_AUTH_SOFORTFEHLER) });
        else say({ ev: 'auth', code: authCode });
      } else if (c.cmd === 'join') beitreten();
      else if (c.cmd === 'quit') beenden();
      else if (c.cmd === 'videoDelay') {
        if (Number.isInteger(c.ms) && c.ms >= 0 && c.ms <= 1000) say({ ev: 'videoDelay', ms: c.ms });
        else say({ ev: 'error', where: 'video', code: 'videoBadDelay' });
      } else if (c.cmd === 'videoSubscribe') {
        if (!Number.isInteger(c.id)) return say({ ev: 'error', where: 'video', code: 'videoUnknownParticipant' });
        if ('audio' in c && typeof c.audio !== 'boolean') return say({ ev: 'error', where: 'video', code: 'videoBadAudioFlag', id: c.id });
        if (!canRecordRaw) return say({ ev: 'error', where: 'video', code: 'videoNoPrivilege', id: c.id });
        if (!teilnehmer.has(c.id)) return say({ ev: 'error', where: 'video', code: 'videoUnknownParticipant', id: c.id });
        if (abos.has(c.id)) return say({ ev: 'error', where: 'video', code: 'videoAlreadySubscribed', id: c.id });
        const source = `JM Connect – Zoom ${teilnehmer.get(c.id).name}`;
        const audio = c.audio !== false;
        // Wie emitVideo() in native/video.cpp: umhaengbar ueber die persistentId
        // nur, wenn sie nicht leer ist.
        const rebindable = teilnehmer.get(c.id).persistentId !== '';
        abos.set(c.id, { source, audio, rebindable });
        say({ ev: 'video', id: c.id, state: 'subscribed', source, reason: 'command', rebindable });
        say({ ev: 'audio', id: c.id, state: audio ? 'waiting' : 'off', reason: 'command' });
      } else if (c.cmd === 'videoUnsubscribe') {
        if (!abos.has(c.id)) return say({ ev: 'error', where: 'video', code: 'videoNotSubscribed', id: c.id });
        const a = abos.get(c.id);
        abos.delete(c.id);
        if (a.audio) say({ ev: 'audio', id: c.id, state: 'off', reason: 'command' });
        say({ ev: 'video', id: c.id, state: 'unsubscribed', source: a.source, reason: 'command', rebindable: a.rebindable });
      } else say({ ev: 'error', where: 'cmd', code: 1 });
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
