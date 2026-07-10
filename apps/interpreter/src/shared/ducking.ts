// Reine Ducking-Logik (Issue #164) — KEIN Web-Audio, keine DOM-Typen. Damit ist die eine
// Stelle, an der wirklich etwas entschieden wird, ohne Browser testbar (test/selftest.ts).
//
// Der Rest der App ist Verkabelung: Analyser misst den Dolmetscher-Pegel, dieser Zustandsautomat
// sagt, wie laut der Floor (O-Ton) sein darf, und ein GainNode fährt den Wert per
// `setTargetAtTime` weich an.

export interface DuckSettings {
  /** Ab welchem Dolmetscher-Pegel (dBFS) wird abgesenkt. */
  thresholdDb: number;
  /** Um wie viel dB der Floor abgesenkt wird, solange gesprochen wird. */
  duckDb: number;
  /** Anschwellzeit der Absenkung (ms). */
  attackMs: number;
  /** Abklingzeit bis der Floor wieder voll da ist (ms). */
  releaseMs: number;
  /** Nachlaufzeit: kurze Sprechpausen sollen den Floor nicht hochreißen (ms). */
  holdMs: number;
  /** Vorverstärkung der beiden Wege (dB). */
  floorGainDb: number;
  interpreterGainDb: number;
}

export const DEFAULT_SETTINGS: DuckSettings = {
  thresholdDb: -42,
  duckDb: -18,
  attackMs: 60,
  releaseMs: 400,
  holdMs: 350,
  floorGainDb: 0,
  interpreterGainDb: 0,
};

export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

export function gainToDb(gain: number): number {
  return gain <= 0 ? -Infinity : 20 * Math.log10(gain);
}

/** Effektivwert eines Zeitfensters → dBFS. Stille liefert -Infinity, nicht NaN. */
export function rmsDb(samples: Float32Array): number {
  if (!samples.length) return -Infinity;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return gainToDb(Math.sqrt(sum / samples.length));
}

export interface DuckState {
  /** Duckt gerade (Dolmetscher spricht oder Nachlauf läuft). */
  ducking: boolean;
  /** Zeitpunkt, an dem der Nachlauf endet (ms, 0 = kein Nachlauf). */
  holdUntilMs: number;
}

export const INITIAL_STATE: DuckState = { ducking: false, holdUntilMs: 0 };

export interface DuckDecision {
  state: DuckState;
  /** Zielverstärkung des Floors (linear, inkl. Vorverstärkung). */
  targetGain: number;
  /** Zeitkonstante für `setTargetAtTime` (Sekunden). */
  tau: number;
}

/**
 * Ein Schritt der Ducking-Schleife.
 *
 * Der Nachlauf (`holdMs`) ist der Grund, warum das ein Automat und keine Formel ist: ohne ihn
 * reißt jede Atempause des Dolmetschers den O-Ton kurz hoch und wieder herunter — hörbar als
 * Pumpen. Die Absenkung endet erst, wenn er `holdMs` lang unter der Schwelle war.
 *
 * `setTargetAtTime` nähert sich exponentiell; nach 3·tau sind ~95 % erreicht. Deshalb tau = t/3,
 * damit die eingestellten Attack-/Release-Zeiten dem gehörten Verlauf entsprechen.
 */
export function step(prev: DuckState, interpreterDb: number, nowMs: number, s: DuckSettings): DuckDecision {
  const speaking = interpreterDb > s.thresholdDb;
  let { ducking, holdUntilMs } = prev;

  if (speaking) {
    ducking = true;
    holdUntilMs = nowMs + s.holdMs;
  } else if (ducking && nowMs >= holdUntilMs) {
    ducking = false;
    holdUntilMs = 0;
  }

  const floor = dbToGain(s.floorGainDb);
  const targetGain = ducking ? floor * dbToGain(s.duckDb) : floor;
  const tau = Math.max(0.001, (ducking ? s.attackMs : s.releaseMs) / 1000 / 3);
  return { state: { ducking, holdUntilMs }, targetGain, tau };
}
