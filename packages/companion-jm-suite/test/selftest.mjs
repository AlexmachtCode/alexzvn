// Selbsttest des JM-Suite-Companion-Moduls (kein Framework):
//   node test/selftest.mjs
// Prüft den Zeilenbau gegen die generierten Capabilities und — als Kernpunkt —
// dass JEDE generierte Befehlszeile vom Suite-Protokoll-Parser wieder korrekt
// (ns + verb) gelesen wird (Round-Trip Modul → Tool).
import crypto from 'node:crypto'
import { readFileSync } from 'node:fs'
import { CAPABILITIES, KNOWN_ROLES, parseSuiteCommand, parseSuiteState, formatSuiteState, parseAuthReq, formatAuth, isAuthOk, isAuthFail } from '../generated/protocol.mjs'
import { buildCommandLine, matchesRole, isControlService, pickEndpoint, isTruthy, slotSchluessel, feedbackAn, presetFeedbacks } from '../lib.mjs'
import { computeAuthProof, normalizeFingerprint } from '../auth.mjs'

let failed = 0
function eq(actual, expected, msg) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a !== e) {
    failed++
    console.error(`FAIL ${msg}\n  erwartet: ${e}\n  bekommen: ${a}`)
  } else {
    console.log(`ok   ${msg}`)
  }
}

// ── Konkrete Zeilen ──────────────────────────────────────────────────────────
const A = (role, id) => CAPABILITIES[role].actions.find((a) => a.id === id)
eq(buildCommandLine('switcher', A('switcher', 'preview'), { scene: 2 }, {}), 'PREVIEW 2', 'switcher PREVIEW 2 (kein NS)')
eq(buildCommandLine('switcher', A('switcher', 'cut'), {}, {}), 'CUT', 'switcher CUT')
eq(buildCommandLine('switcher', A('switcher', 'record'), { mode: 'toggle' }, { recording: '1' }), 'RECORD OFF', 'switcher RECORD toggle@on → OFF')
eq(buildCommandLine('switcher', A('switcher', 'record'), { mode: 'toggle' }, { recording: '0' }), 'RECORD ON', 'switcher RECORD toggle@off → ON')
eq(buildCommandLine('timer', A('timer', 'start'), {}, {}), 'TIMER START', 'timer TIMER START')
eq(buildCommandLine('timer', A('timer', 'add'), { seconds: 30 }, {}), 'TIMER ADD 30', 'timer TIMER ADD 30')
eq(buildCommandLine('player', A('player', 'cue'), { n: 3 }, {}), 'PLAYER CUE 3', 'player PLAYER CUE 3')
eq(buildCommandLine('titler', A('titler', 'template'), { kind: 'banner' }, {}), 'TITLER TEMPLATE banner', 'titler TEMPLATE banner')
eq(buildCommandLine('prompter', A('prompter', 'scroll'), { mode: 'toggle' }, { scrolling: '0' }), 'PROMPTER SCROLL ON', 'prompter SCROLL toggle@off → ON')
eq(buildCommandLine('recorder', A('recorder', 'record'), { mode: 'on' }, {}), 'RECORDER RECORD ON', 'recorder RECORD ON')
eq(buildCommandLine('daw', A('daw', 'rec'), { mode: 'off' }, {}), 'DAW REC OFF', 'daw REC OFF')

// ── matchesRole ──────────────────────────────────────────────────────────────
eq(matchesRole('switcher', ''), true, 'switcher akzeptiert leeres ns (Legacy)')
eq(matchesRole('switcher', 'switcher'), true, 'switcher akzeptiert ns=switcher')
eq(matchesRole('timer', 'timer'), true, 'timer akzeptiert ns=timer')
eq(matchesRole('timer', ''), false, 'timer lehnt leeres ns ab')

// ── mDNS-Auto-Discovery: Endpunkt-Auswahl (Welle 1.6, Stufe 2) ───────────────
// Timer/Presenter annoncieren ZWEI Dienste (eigener + ctl=1-Steuer-Endpunkt);
// das Modul muss den Steuer-Endpunkt wählen. Switcher hat nur seinen ctl-losen
// Alt-Advert (= Steuerserver) → gilt ebenfalls als Steuer-Endpunkt.
const svcs = [
  { role: 'timer', host: '10.0.0.5', port: 7777, name: 'jm-timer', ctl: false }, // Socket.IO
  { role: 'timer', host: '10.0.0.5', port: 8724, name: 'jm-timer-ctl', ctl: true }, // Steuer
  { role: 'switcher', host: '10.0.0.9', port: 8723, name: 'jm-switcher', ctl: false }, // Alt-Advert = Steuer
  { role: 'presenter', host: '10.0.0.7', port: 7330, name: 'jm-presenter', ctl: false }, // nur SSE
]
eq(isControlService({ role: 'timer', ctl: true }), true, 'isControlService: ctl=1 → true')
eq(isControlService({ role: 'timer', ctl: false }), false, 'isControlService: timer ohne ctl → false')
eq(isControlService({ role: 'switcher', ctl: false }), true, 'isControlService: switcher ohne ctl → true (Alt-Advert)')
eq(pickEndpoint('timer', svcs), { host: '10.0.0.5', port: 8724, name: 'jm-timer-ctl' }, 'pickEndpoint timer → ctl=1-Port 8724')
eq(pickEndpoint('switcher', svcs), { host: '10.0.0.9', port: 8723, name: 'jm-switcher' }, 'pickEndpoint switcher → 8723')
eq(pickEndpoint('presenter', svcs), null, 'pickEndpoint presenter → null (nur SSE-Advert, kein Steuer-Endpunkt)')
eq(pickEndpoint('daw', svcs), null, 'pickEndpoint daw → null (nicht im LAN gefunden)')

// ── Round-Trip: jede Action → parsebar mit korrektem ns + verb ───────────────
let rtCount = 0
for (const role of KNOWN_ROLES) {
  for (const a of CAPABILITIES[role].actions) {
    const options = {}
    for (const arg of a.args ?? []) options[arg.id] = arg.default
    const line = buildCommandLine(role, a, options, {})
    const parsed = parseSuiteCommand(line)
    const expectedNs = role // parseSuiteCommand setzt für Switcher-Verben ns='switcher'
    if (!parsed) {
      failed++
      console.error(`FAIL Round-Trip ${role}.${a.id}: "${line}" nicht parsebar`)
    } else if (parsed.ns !== expectedNs || parsed.verb !== a.verb) {
      failed++
      console.error(`FAIL Round-Trip ${role}.${a.id}: "${line}" → ${JSON.stringify(parsed)} (erwartet ns=${expectedNs} verb=${a.verb})`)
    } else {
      rtCount++
    }
  }
}
console.log(`ok   Round-Trip: ${rtCount} Actions bauen gültige, parsebare Protokollzeilen`)

// ── Sicherer Steuer-Handshake (P1, #59) ──────────────────────────────────────
// Auth-Grammatik aus der generierten Protokoll-Schicht + Krypto aus auth.mjs.
eq(parseAuthReq('AUTHREQ scs/1 nonce=abc123'), { proto: 'scs/1', nonce: 'abc123' }, 'parseAuthReq liest proto+nonce')
eq(parseAuthReq('STATE ns=timer running=1'), null, 'parseAuthReq ignoriert Nicht-AUTHREQ')
eq(formatAuth('deadbeef'), 'AUTH deadbeef\n', 'formatAuth → "AUTH <proof>\\n"')
eq(isAuthOk('AUTHOK'), true, 'isAuthOk erkennt AUTHOK')
eq(isAuthOk('authok'), true, 'isAuthOk case-insensitiv')
eq(isAuthFail('AUTHFAIL'), true, 'isAuthFail erkennt AUTHFAIL')
eq(isAuthFail('AUTHOK'), false, 'isAuthFail nur bei AUTHFAIL')

// Fester HMAC-Vektor (pinnt Algorithmus = @jm/auth-core hmacProof).
eq(
  computeAuthProof('tok-123', 'nonceABC'),
  'c4bf1c8188714fa86adb6adf82536e565d3e09154af616eb1930be075755e719',
  'computeAuthProof: fester HMAC-SHA256-Vektor',
)
// Beweis verifiziert konstantzeitig gegen denselben HMAC (= Server-Seite).
{
  const token = 'geheim-xyz'
  const nonce = crypto.randomBytes(16).toString('hex')
  const proof = computeAuthProof(token, nonce)
  const expected = crypto.createHmac('sha256', token).update(nonce).digest('hex')
  eq(
    proof.length === expected.length && crypto.timingSafeEqual(Buffer.from(proof, 'hex'), Buffer.from(expected, 'hex')),
    true,
    'computeAuthProof: Beweis verifiziert gegen Server-HMAC',
  )
  eq(computeAuthProof('falsch', nonce) === expected, false, 'computeAuthProof: falsches Token → anderer Beweis')
}

// Fingerprint-Normalisierung (Node liefert "AB:CD:…", Launcher zeigt klein/ohne).
eq(normalizeFingerprint('AB:CD:EF:01'), 'abcdef01', 'normalizeFingerprint: Doppelpunkte weg + klein')
eq(normalizeFingerprint('  abcdef01  '), 'abcdef01', 'normalizeFingerprint: Whitespace weg')
eq(normalizeFingerprint('AB:CD:EF:01'), normalizeFingerprint('abcdef01'), 'normalizeFingerprint: beide Seiten vergleichbar')

// ── isTruthy: Anzahlen > 0 leuchten (Zoom Stage 4b, Spec 17.2 Nr. 2, L9) ────────
// onair und lobby der Rolle connect sind Anzahlen. Bei 2 Gästen auf Sendung blieb
// die Taste bisher dunkel, weil nur '1', 'an' und 'true' als wahr galten.
for (const v of ['1', '2', '5', '17', 'an', 'true']) eq(isTruthy(v), true, `isTruthy(${JSON.stringify(v)}) → an`)
for (const v of ['0', '', '-1', '01', '1.5', '2 ', 'aus', 'false', undefined]) eq(isTruthy(v), false, `isTruthy(${JSON.stringify(v)}) → aus`)

// ── Rolle JM Connect samt Zoom, Titler graphic/slot (Zoom Stage 4b, Spec 11.4, Ergänzung 0.12) ──
// Kommt erst mit der Neu-Generierung von generated/protocol.mjs ins Modul (npm run sync).
const C = CAPABILITIES.connect
eq(KNOWN_ROLES.includes('connect'), true, 'Rolle connect ist im Modul wählbar (KNOWN_ROLES)')
eq(C?.label ?? null, 'JM Connect', 'Rolle connect heißt „JM Connect“')
eq(C ? [C.actions.length, C.variables.length, C.feedbacks.length] : null, [16, 132, 10], 'connect: 16 Aktionen, 132 Variablen, 10 Feedbacks (9/9/3 + Zoom samt Slots, Spec 11.7; + 4 NDI-Variablen und das Feedback ndi_alarm, Spec 22.6)')
eq(['zoom_load', 'zoom_unload', 'zoom_delay'].every((id) => C?.actions.some((a) => a.id === id && a.verb === id)), true, 'connect: zoom_load, zoom_unload, zoom_delay')
eq(['graphic', 'slot'].every((id) => CAPABILITIES.titler.actions.some((a) => a.id === id)), true, 'titler: graphic und slot')
const zl = C?.actions.find((a) => a.id === 'zoom_load')
const zeile = zl ? buildCommandLine('connect', zl, { name: 'Anna Maria' }, {}) : null
eq(zeile, 'CONNECT ZOOM_LOAD Anna Maria', 'zoom_load mit „Anna Maria“ → CONNECT ZOOM_LOAD Anna Maria')
const geparst = zeile ? parseSuiteCommand(zeile) : null
eq(geparst ? [geparst.ns, geparst.verb, geparst.args.join(' ')] : null, ['connect', 'zoom_load', 'Anna Maria'], '… Connect liest ns, verb und den ganzen Namen (args.join)')
const zu = C?.actions.find((a) => a.id === 'zoom_unload')
eq(zu ? buildCommandLine('connect', zu, { name: 'Ben' }, {}) : null, 'CONNECT ZOOM_UNLOAD Ben', 'zoom_unload Ben → CONNECT ZOOM_UNLOAD Ben')
const zd = C?.actions.find((a) => a.id === 'zoom_delay')
eq(zd ? buildCommandLine('connect', zd, { ms: 300 }, {}) : null, 'CONNECT ZOOM_DELAY 300', 'zoom_delay 300 → CONNECT ZOOM_DELAY 300')
const go = C?.actions.find((a) => a.id === 'go')
eq(go ? buildCommandLine('connect', go, {}, {}) : null, 'CONNECT GO', 'connect GO (Connect erstmals per Companion steuerbar)')
const st = parseSuiteState('STATE ns=connect onair=2 lobby=0 active_label=Anna%20Maria%20Beispiel zoom_status=im_meeting zoom_cmd=')
eq(st ? [matchesRole('connect', st.ns), st.kv.active_label, st.kv.zoom_cmd] : null, [true, 'Anna Maria Beispiel', ''], 'STATE: „Anna Maria Beispiel“ kommt ganz in der Variable an (17.2 Nr. 3), zoom_cmd leer')
eq(parseSuiteState(formatSuiteState({ ns: 'connect', kv: { standby_label: 'Jörg Müller' } }))?.kv.standby_label, 'Jörg Müller', 'STATE-Rundweg mit Leerzeichen über das Modul-Protokoll')
// Feedbacks wie main.js buildFeedbacks: Abnahmekriterium 17.2 Nr. 2 – 1, 2 und 5 Gäste → an, 0 → aus.
const leuchtet = (id, wert) => {
  const f = C?.feedbacks.find((x) => x.id === id)
  return f ? f.match === 'truthy' && isTruthy(wert) : null
}
for (const id of ['onair', 'lobby', 'zoom_live', 'zoom_alarm', 'zoom_cmd_rejected']) {
  eq(['1', '2', '5', '0'].map((w) => leuchtet(id, w)), [true, true, true, false], `Feedback ${id}: 1, 2, 5 → an; 0 → aus`)
}
// Modul-Kopf (Spec 11.4 Nr. 2): eine Version in package.json und manifest.json, JM Connect genannt.
const lies = (rel) => JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf8'))
const paket = lies('../package.json')
const manifest = lies('../companion/manifest.json')
eq(manifest.version, paket.version, 'Version in companion/manifest.json = package.json')
eq(
  [manifest.products.includes('JM Connect'), manifest.description.includes('Connect'), paket.description.includes('Connect')],
  [true, true, true],
  'JM Connect in products und in beiden Beschreibungen',
)

// ── Zoom-Slots: Platzhalter {slot}, Feedbacks, Presets (Connect 0.4.0, Spec 8.5 Nr. 2–3, 11.7) ──
{
  const S = (id) => C?.actions.find((a) => a.id === id)
  const zs = S('zoom_slot')
  eq(zs ? buildCommandLine('connect', zs, { slot: 3, mode: 'toggle' }, { zoom_slot3_on: '1' }) : null, 'CONNECT ZOOM_SLOT 3 OFF', 'zoom_slot Slot 3 Umschalten bei zoom_slot3_on=1 → CONNECT ZOOM_SLOT 3 OFF')
  eq(zs ? buildCommandLine('connect', zs, { slot: 3, mode: 'toggle' }, { zoom_slot3_on: '0' }) : null, 'CONNECT ZOOM_SLOT 3 ON', '… bei zoom_slot3_on=0 → ON')
  eq(zs ? buildCommandLine('connect', zs, { slot: 3, mode: 'toggle' }, { zoom_slot1_on: '1', zoom_slot3_on: '0' }) : null, 'CONNECT ZOOM_SLOT 3 ON', '… liest den Schlüssel von Slot 3, nicht den eines anderen Slots')
  eq(zs ? buildCommandLine('connect', zs, { slot: 16, mode: 'off' }, {}) : null, 'CONNECT ZOOM_SLOT 16 OFF', '… Stopp ohne Auflösung: OFF')
  const za = S('zoom_slot_audio')
  eq(za ? buildCommandLine('connect', za, { slot: 2, mode: 'toggle' }, { zoom_slot2_audio: '1' }) : null, 'CONNECT ZOOM_SLOT_AUDIO 2 OFF', 'zoom_slot_audio Slot 2 Umschalten über zoom_slot2_audio=1 → OFF')
  const zm = S('zoom_slot_mode')
  eq(zm ? buildCommandLine('connect', zm, { slot: 4, modus: 'freigabe' }, {}) : null, 'CONNECT ZOOM_SLOT_MODE 4 freigabe', 'zoom_slot_mode Slot 4 freigabe → CONNECT ZOOM_SLOT_MODE 4 freigabe')
  const zp = S('zoom_slot_person')
  const zeileP = zp ? buildCommandLine('connect', zp, { slot: 1, name: 'Anna Maria' }, {}) : null
  eq(zeileP, 'CONNECT ZOOM_SLOT_PERSON 1 Anna Maria', 'zoom_slot_person „Anna Maria“ → CONNECT ZOOM_SLOT_PERSON 1 Anna Maria')
  const gp = zeileP ? parseSuiteCommand(zeileP) : null
  eq(gp ? [gp.ns, gp.verb, gp.args[0], gp.args.slice(1).join(' ')] : null, ['connect', 'zoom_slot_person', '1', 'Anna Maria'], '… Connect liest Slot-Nummer und den ganzen Namen')
  eq(
    [slotSchluessel('zoom_slot{slot}_live', { slot: 2 }), slotSchluessel('recording', { slot: 2 }), slotSchluessel('zoom_live', {})],
    ['zoom_slot2_live', 'recording', 'zoom_live'],
    'slotSchluessel: {slot} aus der Option, Schlüssel ohne Platzhalter unverändert',
  )
  const fl = C?.feedbacks.find((f) => f.id === 'zoom_slot_live')
  const zustand = { zoom_slot1_live: '0', zoom_slot2_live: '1' }
  eq(fl ? [feedbackAn(fl, { slot: 2 }, zustand), feedbackAn(fl, { slot: 1 }, zustand)] : null, [true, false], 'Feedback zoom_slot_live mit slot: 2 liest zoom_slot2_live (an), mit slot: 1 zoom_slot1_live (aus)')
  const fa = C?.feedbacks.find((f) => f.id === 'zoom_slot_alarm')
  eq(fa ? feedbackAn(fa, { slot: 16 }, { zoom_slot16_alarm: '1' }) : null, true, 'Feedback zoom_slot_alarm mit slot: 16 liest zoom_slot16_alarm')
  const fz = C?.feedbacks.find((f) => f.id === 'zoom_live')
  eq(fz ? [feedbackAn(fz, {}, { zoom_live: '1' }), feedbackAn(fz, {}, { zoom_live: '0' })] : null, [true, false], 'Feedback ohne Platzhalter (zoom_live) wie bisher')
  const fsw = CAPABILITIES.switcher.feedbacks.find((f) => f.match === 'equalsArg')
  eq(
    fsw ? [feedbackAn(fsw, { [fsw.arg.id]: 3 }, { [fsw.stateKey]: '3' }), feedbackAn(fsw, { [fsw.arg.id]: 2 }, { [fsw.stateKey]: '3' })] : null,
    [true, false],
    'Feedback equalsArg (Switcher) wie bisher',
  )
  eq(zs ? presetFeedbacks(C, zs) : null, [{ feedbackId: 'zoom_slot_on', options: { slot: 1 } }], 'Preset zoom_slot trägt das Feedback zoom_slot_on mit slot: 1 (Spec 8.5 Nr. 3, 11.7)')
  eq(za ? presetFeedbacks(C, za) : null, [], 'Preset zoom_slot_audio ohne Feedback (keines mit diesem stateKey)')
  eq(presetFeedbacks(C, S('talkback')), [{ feedbackId: 'talkback', options: {} }], 'Preset talkback wie bisher (Feedback ohne Argument, leere Optionen)')
  eq(
    presetFeedbacks({ feedbacks: [{ id: 'x', stateKey: 'x', match: 'equalsArg', arg: { id: 'n' } }] }, { verb: 'x' }),
    [],
    'Preset mit einem Feedback mit Argument, ohne Platzhalter: wie bisher kein Feedback',
  )
  // main.js lädt @companion-module/base und läuft hier nicht; geprüft wird, dass es die getesteten Helfer nutzt.
  const main = readFileSync(new URL('../main.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
  eq(
    [main.includes('callback: (feedback) => feedbackAn(f, feedback.options, this.state),'), main.includes('feedbacks: presetFeedbacks(cap, a),'), main.includes('this.state[f.stateKey]')],
    [true, true, false],
    'main.js: Feedbacks über feedbackAn, Presets über presetFeedbacks, kein wörtlicher stateKey mehr',
  )
}

// ── NDI (Connect 0.4.0, Spec 22.6, T136, PK52): Variablen und Feedback kommen über den Sync ins Modul ──
eq(
  C ? C.variables.slice(128).map((v) => [v.id, v.label]) : null,
  [
    ['ndi_sources', 'NDI: Gast-Quellen, die bestehen (Anzahl)'],
    ['ndi_failed', 'NDI: ausgefallene Gast-Quellen (Anzahl)'],
    ['ndi_program', 'NDI: Programm-Empfang (aus/sucht/keine_quelle/verbunden/ohne_bild/staut/fehler/neustart/gescheitert)'],
    ['ndi_alarm', 'NDI: Ausfall in Connect (1/0)'],
  ],
  'connect: S T136 vier NDI-Variablen wörtlich, hinter den Slot-Variablen (22.6)',
)
{
  const na = C?.feedbacks.find((f) => f.id === 'ndi_alarm')
  eq(na ? [na.label, na.stateKey, na.match, na.arg ?? null] : null, ['Connect: NDI-Ausfall', 'ndi_alarm', 'truthy', null], 'connect: S T136 Feedback „Connect: NDI-Ausfall“ auf ndi_alarm, truthy, ohne Argument')
  eq(na ? [feedbackAn(na, {}, { ndi_alarm: '1' }), feedbackAn(na, {}, { ndi_alarm: '0' })] : null, [true, false], 'Feedback ndi_alarm: an bei 1, aus bei 0 (22.6)')
}

console.log(failed === 0 ? '\nALLE TESTS OK' : `\n${failed} FEHLER`)
process.exit(failed === 0 ? 0 : 1)
