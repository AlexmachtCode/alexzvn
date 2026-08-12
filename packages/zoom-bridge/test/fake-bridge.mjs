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
    say({ ev: 'privilege', canRecordRaw: true });
  },
  // DER Spike-Fall: connecting kommt sofort und dann NICHTS mehr.
  hang: () => {
    say({ ev: 'ready', sdkVersion: '7.1.5 (attrappe)' });
    say({ ev: 'auth', code: 0 });
    say({ ev: 'status', status: 'connecting', raw: 1, code: 0 });
    // und dann Schweigen.
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
