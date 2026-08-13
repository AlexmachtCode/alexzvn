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
      }
      if (s.includes('"videoUnsubscribe"')) {
        say({ ev: 'video', id: 42, state: 'unsubscribed', source: 'JM Connect – Zoom Attrappe', reason: 'command', rebindable: true });
      }
    });
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
