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

console.log(failed === 0 ? '\nALLE TESTS OK' : `\n${failed} FEHLER`);
process.exit(failed === 0 ? 0 : 1);
