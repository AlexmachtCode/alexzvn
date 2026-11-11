// Loopback-Eingänge (Windows WASAPI) liefern in Stille KEINE Audioblöcke → die Datei würde
// kürzer als die Echtzeit und gegen Video driften. Die Uhr rechnet aus, wie viele
// Stille-Frames zur Wanduhr fehlen. Reine Logik, ohne Timer und ohne Addon.

/** Ab dieser Pause ohne Block gilt der Eingang als still (ms). */
export const STILLE_PAUSE_MS = 250;
/** Takt des Wächters im Main (ms). */
export const STILLE_TAKT_MS = 100;

/** Loopback-Geräte tragen „[Loopback]“ im Namen. */
export function istLoopback(name: string): boolean {
  return /\[loopback\]/i.test(name);
}

export class StilleUhr {
  private geschrieben = 0; // Frames in der Datei (echt + Stille)
  private letzterBlockMs: number;

  constructor(
    private readonly sampleRate: number,
    private readonly startMs: number,
  ) {
    this.letzterBlockMs = startMs;
  }

  private erwartet(jetztMs: number): number {
    return Math.floor(((jetztMs - this.startMs) / 1000) * this.sampleRate);
  }

  /** Echter Block kommt an: wie viele Stille-Frames fehlen VOR ihm? Zählt `frames` dazu. */
  block(frames: number, jetztMs: number): number {
    const pause = jetztMs - this.letzterBlockMs;
    this.letzterBlockMs = jetztMs;
    const n = pause < STILLE_PAUSE_MS ? 0 : Math.max(0, this.erwartet(jetztMs) - frames - this.geschrieben);
    this.geschrieben += frames;
    return n;
  }

  /** Wächter/Stopp: fehlende Stille-Frames; 0, solange Blöcke fließen. */
  fehlend(jetztMs: number): number {
    if (jetztMs - this.letzterBlockMs < STILLE_PAUSE_MS) return 0;
    return Math.max(0, this.erwartet(jetztMs) - this.geschrieben);
  }

  /** Stille wurde geschrieben. */
  aufgefuellt(frames: number): void {
    this.geschrieben += frames;
  }
}
