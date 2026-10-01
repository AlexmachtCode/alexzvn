#!/usr/bin/env node
// Attrappe der Bridge fuer die Selbsttests. Spielt eine aufgezeichnete
// Ereignisfolge ab, damit src/bridge.ts ohne SDK, ohne Compiler und ohne
// Meeting pruefbar ist. Die Folge waehlt FAKE_SCRIPT.
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
  // Der Vertrag folgt dem Original: Fehler tragen die Kennung, wo eine gelesen
  // wurde; videoDelay prueft ganze Zahl 0..1000 und bestaetigt den geltenden
  // Wert; ein Abo ohne "audio" hat Ton (Vorgabe true); beim Abbau meldet sich
  // der Ton VOR dem Bild ab (README Abschnitt 7); quit verlaesst ein laufendes
  // Meeting erst und sagt dann "bye"; EOF wirkt wie quit.
  steuerung: () => {
    const authCode = Number(process.env.FAKE_AUTH_CODE ?? '0');
    const privileg = process.env.FAKE_PRIVILEGE ?? 'ja';
    const fremde = Number(process.env.FAKE_TEILNEHMER ?? '2');
    const namen = ['Anna', 'Ben', 'Carla', 'Dora', 'Emil', 'Frieda', 'Gustav', 'Hanna'];
    const person = (id, name, ueber = {}) => ({
      id, name, persistentId: `p${id}`, self: false, videoOn: true, hasCamera: true, inWaitingRoom: false, role: 'attendee', ...ueber,
    });
    const teilnehmer = new Map();
    let canRecordRaw = false;
    let imMeeting = false;
    const abos = new Map(); // id -> { source, audio }

    const abbauen = (grund) => {
      for (const [id, a] of abos) {
        if (a.audio) say({ ev: 'audio', id, state: 'off', reason: grund });
        say({ ev: 'video', id, state: 'unsubscribed', source: a.source, reason: grund, rebindable: true });
      }
      abos.clear();
    };

    const beitreten = () => {
      say({ ev: 'status', status: 'connecting', raw: 1, code: 0 });
      say({ ev: 'status', status: 'inMeeting', raw: 3, code: 0 });
      imMeeting = true;
      teilnehmer.set(100, person(100, 'JM Connect', { self: true, persistentId: 'p-self' }));
      for (let i = 0; i < fremde; i++) {
        teilnehmer.set(16778240 + i, person(16778240 + i, namen[i] ?? `Gast ${i}`, i === 0 ? { role: 'host' } : {}));
      }
      say({ ev: 'roster', list: [...teilnehmer.values()] });
      say({ ev: 'privilege', canRecordRaw: false, source: 'check', requested: true });
      if (privileg === 'ja') {
        setTimeout(() => {
          canRecordRaw = true;
          say({ ev: 'privilege', canRecordRaw: true, source: 'requestAnswer' });
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
      if (process.env.FAKE_MEETING_ENDE_MS) {
        setTimeout(() => {
          imMeeting = false;
          say({ ev: 'status', status: 'ended', raw: 7, code: 2 });
          abbauen('meetingEnded');
          say({ ev: 'status', status: 'idle', raw: 0, code: 0 });
        }, Number(process.env.FAKE_MEETING_ENDE_MS));
      }
    };

    const beenden = () => {
      if (imMeeting) {
        abbauen('command');
        say({ ev: 'status', status: 'disconnecting', raw: 5, code: 0 });
        say({ ev: 'status', status: 'ended', raw: 7, code: 0 });
      }
      say({ ev: 'bye' });
      process.exit(0);
    };

    const befehl = (zeile) => {
      process.stderr.write(`ATTRAPPE empfing: ${zeile}\n`);
      let c;
      try {
        c = JSON.parse(zeile);
      } catch {
        say({ ev: 'error', where: 'parse', code: 'badJson' });
        return;
      }
      if (c.cmd === 'init') say({ ev: 'ready', sdkVersion: '7.1.5 (attrappe)' });
      else if (c.cmd === 'auth') say({ ev: 'auth', code: authCode });
      else if (c.cmd === 'join') beitreten();
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
        abos.set(c.id, { source, audio });
        say({ ev: 'video', id: c.id, state: 'subscribed', source, reason: 'command', rebindable: true });
        say({ ev: 'audio', id: c.id, state: audio ? 'waiting' : 'off', reason: 'command' });
      } else if (c.cmd === 'videoUnsubscribe') {
        if (!abos.has(c.id)) return say({ ev: 'error', where: 'video', code: 'videoNotSubscribed', id: c.id });
        const a = abos.get(c.id);
        abos.delete(c.id);
        if (a.audio) say({ ev: 'audio', id: c.id, state: 'off', reason: 'command' });
        say({ ev: 'video', id: c.id, state: 'unsubscribed', source: a.source, reason: 'command', rebindable: true });
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
