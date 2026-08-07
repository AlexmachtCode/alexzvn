// Selbsttest der Ducking-Logik (#164). Läuft ohne Browser: `npm run selftest -w @jm/interpreter`.
import { DEFAULT_SETTINGS, INITIAL_STATE, dbToGain, gainToDb, rmsDb, step } from '../src/shared/ducking.ts';
import { counterpartPresent, detectCable } from '../src/shared/virtual-cable.ts';

let failures = 0;
function assert(cond: boolean, name: string): void {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}`);
  }
}

const near = (a: number, b: number, eps = 1e-6): boolean => Math.abs(a - b) < eps;

console.log('ducking — Pegel-Umrechnung:');
assert(near(dbToGain(0), 1), '0 dB → Verstärkung 1');
assert(near(dbToGain(-6), 0.5011872336272722, 1e-9), '-6 dB → ~0.5');
assert(near(gainToDb(1), 0), 'Verstärkung 1 → 0 dB');
assert(gainToDb(0) === -Infinity, 'Stille → -Infinity, nicht NaN');
assert(rmsDb(new Float32Array(0)) === -Infinity, 'leeres Fenster → -Infinity');
assert(near(rmsDb(new Float32Array([1, -1, 1, -1])), 0), 'Vollaussteuerung → 0 dBFS');

console.log('\nducking — Zustandsautomat:');
const s = { ...DEFAULT_SETTINGS, thresholdDb: -40, duckDb: -20, holdMs: 300, floorGainDb: 0 };

// Unter der Schwelle → Floor bleibt voll.
const quiet = step(INITIAL_STATE, -60, 1000, s);
assert(!quiet.state.ducking, 'leiser Dolmetscher → kein Ducking');
assert(near(quiet.targetGain, 1), 'kein Ducking → Floor bei voller Verstärkung');

// Über der Schwelle → Floor abgesenkt, Nachlauf gesetzt.
const loud = step(quiet.state, -20, 1000, s);
assert(loud.state.ducking, 'Dolmetscher spricht → Ducking');
assert(near(loud.targetGain, dbToGain(-20)), 'Ducking → Floor um duckDb abgesenkt');
assert(loud.state.holdUntilMs === 1300, 'Nachlauf endet 300 ms nach dem letzten Sprechen');

// DER Kern: eine Atempause innerhalb des Nachlaufs darf den Floor NICHT hochreißen.
const pause = step(loud.state, -70, 1200, s);
assert(pause.state.ducking, 'Atempause im Nachlauf → Ducking bleibt (kein Pumpen)');
assert(near(pause.targetGain, dbToGain(-20)), 'Atempause → Floor bleibt abgesenkt');

// Erst nach Ablauf des Nachlaufs kommt der O-Ton zurück.
const back = step(pause.state, -70, 1300, s);
assert(!back.state.ducking, 'nach dem Nachlauf → Ducking endet');
assert(near(back.targetGain, 1), 'nach dem Nachlauf → Floor wieder voll');
assert(back.state.holdUntilMs === 0, 'Nachlauf zurückgesetzt');

// Weiterspechen verlängert den Nachlauf.
const again = step(loud.state, -10, 1250, s);
assert(again.state.holdUntilMs === 1550, 'Weitersprechen schiebt den Nachlauf nach hinten');

console.log('\nducking — Zeitkonstanten:');
const atk = step(INITIAL_STATE, 0, 0, { ...s, attackMs: 60 });
assert(near(atk.tau, 0.02), 'Attack 60 ms → tau 20 ms (nach 3·tau ~95 %)');
const rel = step({ ducking: true, holdUntilMs: 0 }, -99, 10, { ...s, releaseMs: 600 });
assert(near(rel.tau, 0.2), 'Release 600 ms → tau 200 ms');
assert(step(INITIAL_STATE, -99, 0, { ...s, releaseMs: 0 }).tau >= 0.001, 'tau nie 0 (setTargetAtTime wirft sonst)');

console.log('\nducking — Vorverstärkung:');
const trimmed = step(INITIAL_STATE, -99, 0, { ...s, floorGainDb: -6 });
assert(near(trimmed.targetGain, dbToGain(-6)), 'Floor-Trim wirkt auch ohne Ducking');
const trimmedDuck = step({ ducking: true, holdUntilMs: 9999 }, 0, 0, { ...s, floorGainDb: -6 });
assert(near(trimmedDuck.targetGain, dbToGain(-26)), 'Floor-Trim und Absenkung addieren sich in dB');

console.log('\nvirtual-cable — Erkennung:');
{
  const vb = detectCable('CABLE Input (VB-Audio Virtual Cable)');
  assert(vb?.id === 'vb-cable', 'VB-CABLE erkannt');
  assert(
    vb?.zoomInputLabel === 'CABLE Output (VB-Audio Virtual Cable)',
    'VB-CABLE nennt das Zoom-Gegenstueck exakt',
  );

  assert(
    detectCable('Standard - CABLE Input (VB-Audio Virtual Cable)')?.id === 'vb-cable',
    'Praefix "Standard - " stoert die Erkennung nicht',
  );
  assert(
    detectCable('cable input (vb-audio virtual cable)')?.id === 'vb-cable',
    'Gross-/Kleinschreibung egal',
  );
  assert(detectCable('CABLE-A Input (VB-Audio Cable A)')?.id === 'vb-cable-a', 'VB-CABLE A erkannt');
  assert(detectCable('CABLE-B Input (VB-Audio Cable B)')?.id === 'vb-cable-b', 'VB-CABLE B erkannt');
  assert(
    detectCable('VoiceMeeter Input (VB-Audio VoiceMeeter VAIO)')?.id === 'voicemeeter',
    'VoiceMeeter erkannt',
  );
  assert(
    detectCable('VoiceMeeter Aux Input (VB-Audio VoiceMeeter AUX VAIO)')?.id === 'voicemeeter-aux',
    'VoiceMeeter AUX nicht mit dem Haupt-VAIO verwechselt',
  );
}

console.log('virtual-cable — Negativfaelle (duerfen NICHT als Kabel gelten):');
{
  // Dante meldet Sende- und Empfangsseite getrennt, sie sind aber nicht intern verbunden.
  assert(detectCable('DVS Transmit 1-2') === null, 'Dante DVS Transmit ist kein Kabel');
  assert(detectCable('DVS Receive 1-2') === null, 'Dante DVS Receive ist kein Kabel');
  assert(detectCable('Lautsprecher (Realtek Audio)') === null, 'Realtek-Lautsprecher ist kein Kabel');
  assert(detectCable('NDI Webcam Audio') === null, 'NDI Webcam Audio ist kein Kabel');
  assert(detectCable('') === null, 'leerer Name ergibt null');
}

console.log('virtual-cable — Gegenseite:');
{
  const vb = detectCable('CABLE Input (VB-Audio Virtual Cable)');
  if (!vb) throw new Error('Vorbedingung: VB-CABLE muss erkannt werden');
  assert(
    counterpartPresent(vb, ['Mikrofon (Realtek)', 'CABLE Output (VB-Audio Virtual Cable)']),
    'Aufnahmeseite wird gefunden',
  );
  assert(
    !counterpartPresent(vb, ['Mikrofon (Realtek)', 'DVS Receive 1-2']),
    'fehlende Aufnahmeseite wird gemeldet',
  );
  assert(!counterpartPresent(vb, []), 'leere Geraeteliste ergibt false');
}

if (failures) {
  console.error(`\n${failures} Selbsttest(s) fehlgeschlagen.`);
  process.exit(1);
}
console.log('\nAlle @jm/interpreter-Selbsttests grün.');
