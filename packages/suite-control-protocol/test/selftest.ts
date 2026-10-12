// Mini-Selbsttest (kein Framework): node --experimental-strip-types test/selftest.ts
// Schwerpunkt: generische Grammatik + RÜCKWÄRTSKOMPATIBILITÄT zum Switcher-
// Protokoll (alte Zeilen müssen byte-/semantisch unverändert geparst werden).
import {
  parseSuiteCommand,
  formatSuiteCommand,
  formatSuiteState,
  parseSuiteState,
  createLineBuffer,
  parseCommand,
  formatState,
  parseState,
  switcherStateToSuite,
  switcherStateFromSuite,
  formatAuthReq,
  parseAuthReq,
  formatAuth,
  parseAuth,
  isAuthOk,
  isAuthFail,
  AUTH_PROTO,
  kodiereStateWert,
  dekodiereStateWert,
  type SwitcherStateMsg,
  type SuiteState,
} from '../src/index.ts';
import { CAPABILITIES, KNOWN_ROLES } from '../src/capabilities.ts';

let failed = 0;
function eq(actual: unknown, expected: unknown, msg: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    failed++;
    console.error(`FAIL ${msg}\n  erwartet: ${e}\n  bekommen: ${a}`);
  } else {
    console.log(`ok   ${msg}`);
  }
}

// ── Generische Befehls-Grammatik ─────────────────────────────────────────────
eq(parseSuiteCommand('TIMER START'), { ns: 'timer', verb: 'start', args: [] }, 'TIMER START');
eq(parseSuiteCommand('timer add 30'), { ns: 'timer', verb: 'add', args: ['30'] }, 'timer add 30 (case-insensitive)');
eq(parseSuiteCommand('PLAYER CUE 3'), { ns: 'player', verb: 'cue', args: ['3'] }, 'PLAYER CUE 3');
eq(parseSuiteCommand('TITLER TAKE 2'), { ns: 'titler', verb: 'take', args: ['2'] }, 'TITLER TAKE 2');
eq(parseSuiteCommand('PROMPTER SCROLL ON'), { ns: 'prompter', verb: 'scroll', args: ['ON'] }, 'PROMPTER SCROLL ON');
eq(parseSuiteCommand('STATE?'), { ns: '', verb: 'query', args: [] }, 'STATE? → query');
eq(parseSuiteCommand('  '), null, 'Leerzeile → null');
eq(parseSuiteCommand('TIMER'), null, 'Namespace ohne Verb → null');

// ── Rückwärtskompat: Switcher-Verben OHNE Namespace → ns=switcher ────────────
eq(parseSuiteCommand('PREVIEW 2'), { ns: 'switcher', verb: 'preview', args: ['2'] }, 'PREVIEW 2 → switcher');
eq(parseSuiteCommand('CUT'), { ns: 'switcher', verb: 'cut', args: [] }, 'CUT → switcher');
eq(parseSuiteCommand('RECORD START'), { ns: 'switcher', verb: 'record', args: ['START'] }, 'RECORD START → switcher');

// ── formatSuiteCommand ───────────────────────────────────────────────────────
eq(formatSuiteCommand({ ns: 'timer', verb: 'add', args: ['30'] }), 'TIMER ADD 30\n', 'formatSuiteCommand timer');
eq(formatSuiteCommand({ ns: 'switcher', verb: 'cut', args: [] }), 'CUT\n', 'formatSuiteCommand switcher (kein NS-Präfix)');

// ── Generischer STATE ────────────────────────────────────────────────────────
eq(
  formatSuiteState({ ns: 'timer', kv: { running: true, remaining_s: 270, block_label: 'Block-A' } }),
  'STATE ns=timer running=1 remaining_s=270 block_label=Block-A\n',
  'formatSuiteState (bool→1, ns + kv)',
);
eq(
  parseSuiteState('STATE ns=timer running=1 remaining_s=270 block_label=Block-A'),
  { ns: 'timer', kv: { running: '1', remaining_s: '270', block_label: 'Block-A' } },
  'parseSuiteState generisch',
);
eq(parseSuiteState('nope'), null, 'parseSuiteState Nicht-STATE → null');

// ── Switcher-Brücke + Rückwärtskompat des STATE-Formats ─────────────────────
const sw: SwitcherStateMsg = { program: 2, preview: 1, recording: true, streaming: false, scenes: 3 };

// Legacy-Zeile (OHNE ns) bleibt byte-identisch:
eq(formatState(sw), 'STATE program=2 preview=1 recording=1 streaming=0 scenes=3\n', 'formatState (Legacy, byte-identisch)');

// Neuer Server sendet ns=switcher — der ALTE Switcher-Parser muss es trotzdem lesen:
const suiteLine = formatSuiteState(switcherStateToSuite(sw));
eq(suiteLine, 'STATE ns=switcher program=2 preview=1 recording=1 streaming=0 scenes=3\n', 'switcherStateToSuite → ns=switcher-Zeile');
eq(parseState(suiteLine), sw, 'Legacy parseState liest ns=switcher-Zeile korrekt (Rückwärtskompat!)');
eq(parseState(formatState(sw)), sw, 'Legacy parseState round-trip (alte Zeile)');

// SuiteState → SwitcherStateMsg:
eq(switcherStateFromSuite(parseSuiteState(suiteLine) as SuiteState), sw, 'switcherStateFromSuite round-trip');

// ── Legacy parseCommand unverändert ──────────────────────────────────────────
eq(parseCommand('AUTO 500'), { type: 'auto', ms: 500 }, 'Legacy parseCommand AUTO 500');
eq(parseCommand('STREAM STOP'), { type: 'stream', on: false }, 'Legacy parseCommand STREAM STOP');
eq(parseCommand('STATE?'), { type: 'queryState' }, 'Legacy parseCommand STATE?');
eq(parseCommand('BLAH'), null, 'Legacy parseCommand Unbekannt → null');

// ── LineBuffer ───────────────────────────────────────────────────────────────
const lines: string[] = [];
const feed = createLineBuffer((l) => lines.push(l));
feed('TIMER START\nPLAYER ');
feed('CUE 2\n');
eq(lines, ['TIMER START', 'PLAYER CUE 2'], 'LineBuffer splittet über Chunks');

// ── Capabilities-Struktur ────────────────────────────────────────────────────
eq(KNOWN_ROLES.includes('switcher') && KNOWN_ROLES.includes('timer'), true, 'CAPABILITIES enthält switcher + timer');
eq(CAPABILITIES.switcher.actions.some((a) => a.id === 'cut'), true, 'Switcher-Capability hat cut-Action');

// ── Auth-Handshake-Grammatik (P1, #59) ──────────────────────────────────────
eq(formatAuthReq('abcd1234'), `AUTHREQ ${AUTH_PROTO} nonce=abcd1234\n`, 'formatAuthReq');
eq(parseAuthReq('AUTHREQ scs/1 nonce=abcd1234'), { proto: 'scs/1', nonce: 'abcd1234' }, 'parseAuthReq');
eq(parseAuthReq(formatAuthReq('deadbeef').trim()), { proto: 'scs/1', nonce: 'deadbeef' }, 'AUTHREQ format↔parse round-trip');
eq(parseAuthReq('AUTHREQ scs/1'), null, 'parseAuthReq ohne nonce → null');
eq(parseAuthReq('TIMER START'), null, 'parseAuthReq Nicht-AUTHREQ → null');
eq(formatAuth('ff00'), 'AUTH ff00\n', 'formatAuth');
eq(parseAuth('AUTH ff00'), { proof: 'ff00' }, 'parseAuth');
eq(parseAuth(formatAuth('cafe').trim()), { proof: 'cafe' }, 'AUTH format↔parse round-trip');
eq(parseAuth('AUTH'), null, 'parseAuth ohne Beweis → null');
eq(isAuthOk('AUTHOK') && isAuthOk('  authok '), true, 'isAuthOk (trim + case-insensitive)');
eq(isAuthFail('AUTHFAIL'), true, 'isAuthFail');
eq(isAuthOk('AUTHFAIL') || isAuthFail('AUTHOK'), false, 'AUTHOK/AUTHFAIL nicht verwechselt');
// Handshake-Zeilen kollidieren nicht mit echten Befehls-Namespaces:
eq(parseSuiteCommand('AUTHREQ scs/1 nonce=x')?.ns, 'authreq', 'AUTHREQ landet in eigenem ns (keine Tool-Rolle)');

// ── STATE-Werte kodieren (Zoom Stage 4b, Spec 17.2 Nr. 3, Review Focus 5) ─────
// Der Parser trennt an jedem Leerraum. Ohne Kodierung käme „Anna Maria Beispiel“
// nur als „Anna“ an. Kodiert werden nur Leerraum und '%', nur in String-Werten.
const rund = (wert: string): unknown =>
  parseSuiteState(formatSuiteState({ ns: 'connect', kv: { active_label: wert } }))?.kv.active_label;
eq(
  formatSuiteState({ ns: 'connect', kv: { onair: 1, active_label: 'Anna Maria Beispiel' } }),
  'STATE ns=connect onair=1 active_label=Anna%20Maria%20Beispiel\n',
  'STATE-Kodierung: Leerzeichen im Namen → %20, die Zeile bleibt eine Zeile',
);
eq(rund('Anna Maria Beispiel'), 'Anna Maria Beispiel', 'STATE-Kodierung: „Anna Maria Beispiel“ kommt ganz an (17.2 Nr. 3)');
for (const [name, wert] of [
  ['Prozent', '50% Rabatt'],
  ['Gleichheitszeichen', 'a=b'],
  ['doppeltes Leerzeichen', 'Doppel  Leer'],
  ['Leerzeichen am Rand', ' rand '],
  ['geschütztes Leerzeichen (NBSP)', 'Anna Maria'],
  ['Tabulator', 'Spalte\tWert'],
  ['Zeilenumbruch', 'Zeile1\nZeile2'],
  ['ideographisches Leerzeichen', 'Anna　Maria'],
  ['Emoji', 'Gast 🎤 Bühne'],
  ['wörtliches %20', 'schon%20kodiert'],
  ['Umlaute und Bindestrich', 'Jörg Müller-Lüdenscheidt'],
  ['leer', ''],
] as const) {
  eq(rund(wert), wert, `STATE-Kodierung: Rundweg verlustfrei (${name})`);
}
eq(formatSuiteState({ ns: 'connect', kv: { active_label: '' } }), 'STATE ns=connect active_label=\n', 'STATE-Kodierung: leerer Wert bleibt key=');
eq(parseSuiteState('STATE ns=connect active_label=')?.kv.active_label, '', 'STATE-Kodierung: key= wird zu leerem Text');
eq(
  formatSuiteState({ ns: 'connect', kv: { onair: 2, talkback: true, guests: 0 } }),
  'STATE ns=connect onair=2 talkback=1 guests=0\n',
  'STATE-Kodierung: Zahlen und Booleans unverändert',
);
eq(parseSuiteState('STATE ns=connect onair=2 running=1')?.kv, { onair: '2', running: '1' }, 'STATE-Kodierung: Zahlen aus alten Zeilen unverändert');
eq(
  parseSuiteState('STATE ns=timer block_label=Block-A pct=100% roh=%zz halb=%C2'),
  { ns: 'timer', kv: { block_label: 'Block-A', pct: '100%', roh: '%zz', halb: '%C2' } },
  'STATE-Kodierung: alte Zeile ohne Kodierung, ungültige %-Folgen bleiben wörtlich',
);
eq(formatSuiteState({ ns: 't', kv: { 'k%1': 'x y' } }), 'STATE ns=t k%1=x%20y\n', 'STATE-Kodierung: Schlüssel werden nie kodiert');
eq(parseSuiteState('STATE ns=t a%20b=1')?.kv, { 'a%20b': '1' }, 'STATE-Kodierung: Schlüssel werden nie dekodiert');
eq(kodiereStateWert('Anna Maria'), 'Anna%20Maria', 'kodiereStateWert: Leerzeichen');
eq(kodiereStateWert('100%'), '100%25', 'kodiereStateWert: Prozent');
eq(kodiereStateWert('a b\tc'), 'a%C2%A0b%09c', 'kodiereStateWert: NBSP als UTF-8-Bytes, Tab');
eq(kodiereStateWert('Grüße=🎤'), 'Grüße=🎤', 'kodiereStateWert: alles andere unverändert');
eq(dekodiereStateWert('Anna%20Maria'), 'Anna Maria', 'dekodiereStateWert: %20');
eq(dekodiereStateWert('a%C2%A0b'), 'a b', 'dekodiereStateWert: mehrbytige Folge');
eq(dekodiereStateWert('%E2%82'), '%E2%82', 'dekodiereStateWert: abgeschnittene Folge bleibt wörtlich');
eq(
  parseSuiteCommand('CONNECT ZOOM_LOAD Anna Maria'),
  { ns: 'connect', verb: 'zoom_load', args: ['Anna', 'Maria'] },
  'Befehlszeilen werden nicht kodiert: CONNECT ZOOM_LOAD Anna Maria → zwei Argumente',
);

// ── Rolle connect: Zoom-Teile (Zoom Stage 4b, Spec 11.1 wörtlich) ────────────
{
  const c = CAPABILITIES.connect;
  const ids = (xs: { id: string }[]): string[] => xs.map((x) => x.id);
  eq(
    ids(c.actions),
    ['go', 'next', 'standby', 'onair', 'off', 'approve', 'talkback', 'slides', 'kick', 'zoom_load', 'zoom_unload', 'zoom_delay'],
    'connect: 9 Raum-Aktionen wie bisher + 3 Zoom-Aktionen',
  );
  eq(
    c.actions.filter((a) => a.id.startsWith('zoom_')),
    [
      { id: 'zoom_load', label: 'Zoom: Person als Quelle laden', verb: 'zoom_load', args: [{ id: 'name', label: 'Anzeigename in Zoom', type: 'string', default: '' }] },
      { id: 'zoom_unload', label: 'Zoom: Quelle entladen', verb: 'zoom_unload', args: [{ id: 'name', label: 'Anzeigename in Zoom', type: 'string', default: '' }] },
      { id: 'zoom_delay', label: 'Zoom: Bild-Versatz setzen', verb: 'zoom_delay', args: [{ id: 'ms', label: 'Versatz (ms)', type: 'number', default: 0, min: 0, max: 1000 }] },
    ],
    'connect: Zoom-Aktionen wörtlich, verb === id',
  );
  eq(
    ids(c.variables),
    ['room', 'connected', 'guests', 'lobby', 'onair', 'active_label', 'standby', 'standby_label', 'talkback',
      'zoom_status', 'zoom_sources', 'zoom_live', 'zoom_privilege', 'zoom_alarm', 'zoom_cmd', 'zoom_cmd_rejected'],
    'connect: 9 Raum-Variablen wie bisher + 7 Zoom-Variablen',
  );
  eq(
    c.variables.filter((v) => v.id.startsWith('zoom_')),
    [
      { id: 'zoom_status', label: 'Zoom: Status (einrichtung/bereit/tritt_bei/warteraum/im_meeting/abriss/verlaesst/fehler)' },
      { id: 'zoom_sources', label: 'Zoom: geladene Quellen (Anzahl)' },
      { id: 'zoom_live', label: 'Zoom: mindestens eine Quelle geladen (1/0)' },
      { id: 'zoom_privilege', label: 'Zoom: Aufnahme-Erlaubnis erteilt (1/0)' },
      { id: 'zoom_alarm', label: 'Zoom: Eingriff nötig (1/0)' },
      { id: 'zoom_cmd', label: 'Zoom: Ergebnis des letzten Zoom-Befehls (ok, f1 … f8)' },
      { id: 'zoom_cmd_rejected', label: 'Zoom: letzter Zoom-Befehl abgelehnt (1/0)' },
    ],
    'connect: Zoom-Variablen wörtlich',
  );
  eq(ids(c.feedbacks), ['onair', 'lobby', 'talkback', 'zoom_live', 'zoom_alarm', 'zoom_cmd_rejected'], 'connect: 3 Raum-Feedbacks wie bisher + 3 Zoom-Feedbacks');
  eq(
    c.feedbacks.filter((f) => f.id.startsWith('zoom_')),
    [
      { id: 'zoom_live', label: 'Connect: Zoom-Quellen geladen', stateKey: 'zoom_live', match: 'truthy', bgcolor: [30, 160, 60], color: [255, 255, 255] },
      { id: 'zoom_alarm', label: 'Connect: Zoom braucht einen Eingriff', stateKey: 'zoom_alarm', match: 'truthy', bgcolor: [200, 30, 30], color: [255, 255, 255] },
      { id: 'zoom_cmd_rejected', label: 'Connect: letzter Zoom-Befehl abgelehnt', stateKey: 'zoom_cmd_rejected', match: 'truthy', bgcolor: [251, 231, 59], color: [0, 0, 0] },
    ],
    'connect: Zoom-Feedbacks wörtlich (GREEN, RED, YELLOW/BLACK), alle truthy',
  );
  eq(KNOWN_ROLES.includes('connect'), true, 'connect ist eine bekannte Rolle');
}

console.log(failed === 0 ? '\nALLE TESTS OK' : `\n${failed} FEHLER`);
process.exit(failed === 0 ? 0 : 1);
