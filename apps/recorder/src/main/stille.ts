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
  // Hat der Wächter die Pause bei laufendem Hauptprozess gesehen? Sonst kann eine Lücke auch ein
  // Stau sein: das Addon puffert die Blöcke ohne Zeitstempel, sie kommen danach auf einen Schlag.
  private bestaetigt = false;

  constructor(
    private readonly sampleRate: number,
    private readonly startMs: number,
  ) {
    this.letzterBlockMs = startMs;
  }

  private erwartet(jetztMs: number): number {
    return Math.floor(((jetztMs - this.startMs) / 1000) * this.sampleRate);
  }

  /**
   * Echter Block kommt an: wie viele Stille-Frames fehlen VOR ihm? Nur nach einer vom Wächter
   * bestätigten Pause (`fehlend`), sonst 0. Zählt `frames` dazu.
   */
  block(frames: number, jetztMs: number): number {
    const n = this.bestaetigt ? Math.max(0, this.erwartet(jetztMs) - frames - this.geschrieben) : 0;
    this.bestaetigt = false;
    this.letzterBlockMs = jetztMs;
    this.geschrieben += frames;
    return n;
  }

  /** Wächter/Stopp: fehlende Stille-Frames; 0, solange Blöcke fließen. Eine Pause gilt damit als bestätigt. */
  fehlend(jetztMs: number): number {
    if (jetztMs - this.letzterBlockMs < STILLE_PAUSE_MS) return 0;
    this.bestaetigt = true;
    return Math.max(0, this.erwartet(jetztMs) - this.geschrieben);
  }

  /** Nach einem Stau im Hauptprozess: Grundlinie neu, die Lücke ist keine Stille. */
  weiter(jetztMs: number): void {
    this.letzterBlockMs = jetztMs;
    this.bestaetigt = false;
  }

  /** Stille wurde geschrieben. */
  aufgefuellt(frames: number): void {
    this.geschrieben += frames;
  }
}
