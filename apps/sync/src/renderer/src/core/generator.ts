// Reference-signal generator: paints a full-frame flash and fires a tone burst at
// the SAME instant, repeating on a fixed cadence. Only the simultaneity at the
// source matters — the receiver derives the A/V offset from the gap it sees.

export interface GeneratorOptions {
  /** Time between successive flash+beep cycles (ms). */
  intervalMs: number;
  /** Beep frequency (Hz) — must match the measurement target frequency. */
  beepFreq: number;
  /** Beep duration (ms). */
  beepMs: number;
  /** Flash on-duration (ms). */
  flashMs: number;
}

export const DEFAULT_GENERATOR_OPTIONS: GeneratorOptions = {
  intervalMs: 2000,
  beepFreq: 1000,
  beepMs: 60,
  flashMs: 120,
};

export class SignalGenerator {
  private opts: GeneratorOptions;
  private ctx2d: CanvasRenderingContext2D;
  private audio: AudioContext | null = null;
  private raf = 0;
  private running = false;
  private nextFire = 0;
  private flashOffAt = 0;
  private cycle = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly onCycle: (cycle: number) => void = () => {},
    opts: Partial<GeneratorOptions> = {},
  ) {
    this.opts = { ...DEFAULT_GENERATOR_OPTIONS, ...opts };
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D-Canvas-Kontext nicht verfügbar.');
    this.ctx2d = ctx;
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.audio = new AudioContext();
    if (this.audio.state === 'suspended') await this.audio.resume();
    this.running = true;
    this.cycle = 0;
    this.nextFire = performance.now() + 500; // brief lead-in
    this.flashOffAt = 0;
    this.paint(false);
    this.loop();
  }

  private loop = (): void => {
    if (!this.running) return;
    const now = performance.now();

    if (now >= this.nextFire) {
      this.fire(now);
      this.nextFire += this.opts.intervalMs;
      // Resync if we fell badly behind (e.g. tab was backgrounded).
      if (now - this.nextFire > this.opts.intervalMs) this.nextFire = now + this.opts.intervalMs;
    }
    if (this.flashOffAt && now >= this.flashOffAt) {
      this.paint(false);
      this.flashOffAt = 0;
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  /** Paint the flash and fire the beep together, then schedule flash-off. */
  private fire(now: number): void {
    this.paint(true);
    this.beep();
    this.flashOffAt = now + this.opts.flashMs;
    this.onCycle(++this.cycle);
  }

  private beep(): void {
    const ctx = this.audio;
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = this.opts.beepFreq;
    // Sharp attack (good for onset detection), short release (avoid clicks).
    const dur = this.opts.beepMs / 1000;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(1, t + 0.001);
    gain.gain.setValueAtTime(1, t + dur);
    gain.gain.linearRampToValueAtTime(0, t + dur + 0.005);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private paint(on: boolean): void {
    const { width, height } = this.canvas;
    this.ctx2d.fillStyle = on ? '#ffffff' : '#000000';
    this.ctx2d.fillRect(0, 0, width, height);
  }

  setOptions(opts: Partial<GeneratorOptions>): void {
    this.opts = { ...this.opts, ...opts };
  }

  stop(): void {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.paint(false);
    this.audio?.close();
    this.audio = null;
  }
}
