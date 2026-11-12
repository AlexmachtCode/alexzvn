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
  // Der echte letzte Block (nur block() setzt ihn): weiter() verschiebt ihn nicht, der Stopp
  // rechnet damit, wie lange wirklich nichts mehr kam.
  private letzterEchterBlockMs: number;
  // Wann hat der Wächter die Pause bei laufendem Hauptprozess gesehen? Sonst kann eine Lücke auch
  // ein Stau sein: das Addon puffert die Blöcke ohne Zeitstempel, sie kommen danach auf einen
  // Schlag. Die Bestätigung gilt nur kurz: hängt der Hauptprozess danach, ist sie veraltet.
  private bestaetigtMs: number | null = null;

  constructor(
    private readonly sampleRate: number,
    private readonly startMs: number,
  ) {
    this.letzterBlockMs = startMs;
    this.letzterEchterBlockMs = startMs;
  }

  private erwartet(jetztMs: number): number {
    return Math.floor(((jetztMs - this.startMs) / 1000) * this.sampleRate);
  }

  /**
   * Echter Block kommt an: wie viele Stille-Frames fehlen VOR ihm? Nur nach einer frischen
   * (< STILLE_PAUSE_MS alten) Bestätigung durch `fehlend`, sonst 0. Zählt `frames` dazu.
   */
  block(frames: number, jetztMs: number): number {
    const frisch = this.bestaetigtMs !== null && jetztMs - this.bestaetigtMs < STILLE_PAUSE_MS;
    const n = frisch ? Math.max(0, this.erwartet(jetztMs) - frames - this.geschrieben) : 0;
    this.bestaetigtMs = null;
    this.letzterBlockMs = jetztMs;
    this.letzterEchterBlockMs = jetztMs;
    this.geschrieben += frames;
    return n;
  }

  /** Wächter: fehlende Stille-Frames; 0, solange Blöcke fließen. Eine Pause gilt damit als bestätigt. */
  fehlend(jetztMs: number): number {
    if (jetztMs - this.letzterBlockMs < STILLE_PAUSE_MS) return 0;
    this.bestaetigtMs = jetztMs;
    return Math.max(0, this.erwartet(jetztMs) - this.geschrieben);
  }

  /**
   * Stopp/Abbau: fehlende Stille-Frames bis zum Ende. Maßgeblich ist der echte letzte Block, nicht
   * die Grundlinie nach einem Stau — sonst fehlt der Stille-Rest direkt nach einem Stau.
   */
  fehlendBeimStopp(jetztMs: number): number {
    if (jetztMs - this.letzterEchterBlockMs < STILLE_PAUSE_MS) return 0;
    return Math.max(0, this.erwartet(jetztMs) - this.geschrieben);
  }

  /** Nach einem Stau im Hauptprozess: Grundlinie neu, die Lücke ist keine Stille. */
  weiter(jetztMs: number): void {
    this.letzterBlockMs = jetztMs;
    this.bestaetigtMs = null;
  }

  /** Stille wurde geschrieben. */
  aufgefuellt(frames: number): void {
    this.geschrieben += frames;
  }
}
