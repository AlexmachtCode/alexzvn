// Web-Audio-Graph des Interpreters (#164). Zwei Eingänge, ein Mix, ein Ausgang:
//
//   Floor (O-Ton) ──▶ floorGain ──┐
//                                 ├──▶ mixDest ──▶ <audio> ──setSinkId──▶ VB-Cable ──▶ Zoom/Webex
//   Dolmetscher ──▶ interpGain ───┘
//                        │
//                        └──▶ Analyser ──▶ ducking.step() ──▶ floorGain.setTargetAtTime(…)
//
// Die Entscheidung, WIE laut der Floor sein darf, trifft `@shared/ducking` — reine Logik, ohne
// Web-Audio, mit eigenem Selbsttest. Hier steht nur die Verkabelung.
//
// Die Regelschleife läuft als `setInterval`, NICHT als requestAnimationFrame: rAF wird angehalten,
// sobald das Fenster verdeckt oder minimiert ist — das Ducking bliebe dann stehen, wo es gerade
// war. Zusätzlich setzt das Hauptfenster `backgroundThrottling: false`, sonst drosselt Chromium
// auch den Timer.
import { DEFAULT_SETTINGS, INITIAL_STATE, dbToGain, rmsDb, step, type DuckSettings, type DuckState } from '@shared/ducking';

/** Regeltakt. 10 ms sind gegenüber den Attack-/Release-Zeiten (≥ 60 ms) reichlich fein. */
const TICK_MS = 10;
/** Aufnahme ohne jede Aufbereitung: AGC/Rauschunterdrückung würden die Ducking-Regelung sabotieren. */
const RAW_AUDIO: MediaTrackConstraints = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
};

export interface EngineState {
  running: boolean;
  ducking: boolean;
  /** Aktueller Pegel in dBFS (-Infinity = Stille). */
  floorDb: number;
  interpreterDb: number;
  error: string | null;
}

export interface Devices {
  floorId: string;
  interpreterId: string;
  /** Ausgabegerät (VB-Cable o. ä.). Leer = Systemstandard. */
  outputId: string;
}

export interface DeviceInfo {
  deviceId: string;
  label: string;
}

/**
 * Geräte auflisten. Ohne einmal erteilte Mikrofon-Freigabe liefert der Browser leere Labels —
 * deshalb vorher einen Stream anfordern und sofort wieder schließen. `labelsAvailable` meldet,
 * ob echte Namen herausgegeben wurden: ohne sie ist keine Kabel-Erkennung möglich, und die
 * Oberfläche darf das nicht mit „kein Kabel gefunden" verwechseln.
 */
export async function listDevices(): Promise<{
  inputs: DeviceInfo[];
  outputs: DeviceInfo[];
  labelsAvailable: boolean;
}> {
  try {
    const probe = await navigator.mediaDevices.getUserMedia({ audio: true });
    probe.getTracks().forEach((t) => t.stop());
  } catch {
    // Verweigert: wir listen trotzdem, die Labels bleiben dann leer.
  }
  const all = await navigator.mediaDevices.enumerateDevices();
  const pick = (kind: MediaDeviceKind): DeviceInfo[] =>
    all
      .filter((d) => d.kind === kind)
      .map((d) => ({ deviceId: d.deviceId, label: d.label || `${kind} ${d.deviceId.slice(0, 6)}` }));
  return {
    inputs: pick('audioinput'),
    outputs: pick('audiooutput'),
    labelsAvailable: all.some((d) => d.label.trim().length > 0),
  };
}

export class InterpreterEngine {
  private ctx: AudioContext | null = null;
  private floorStream: MediaStream | null = null;
  private interpreterStream: MediaStream | null = null;
  private floorGain: GainNode | null = null;
  private interpreterGain: GainNode | null = null;
  private floorMeter: AnalyserNode | null = null;
  private interpreterMeter: AnalyserNode | null = null;
  private mixDest: MediaStreamAudioDestinationNode | null = null;
  private out: HTMLAudioElement | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private buf = new Float32Array(1024);

  private settings: DuckSettings = { ...DEFAULT_SETTINGS };
  private bypass = false;
  private duck: DuckState = { ...INITIAL_STATE };
  private lastTarget = Number.NaN; // erneutes setTargetAtTime auf denselben Wert bremst die Rampe
  private lastPublish = 0;

  private state: EngineState = { running: false, ducking: false, floorDb: -Infinity, interpreterDb: -Infinity, error: null };
  private listeners = new Set<() => void>();

  subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  getState(): EngineState {
    return { ...this.state };
  }

  private patch(p: Partial<EngineState>): void {
    this.state = { ...this.state, ...p };
    for (const l of this.listeners) l();
  }

  setSettings(s: DuckSettings): void {
    this.settings = s;
    if (this.interpreterGain && this.ctx) {
      this.interpreterGain.gain.setTargetAtTime(dbToGain(s.interpreterGainDb), this.ctx.currentTime, 0.01);
    }
    this.lastTarget = Number.NaN; // Floor-Trim/duckDb können sich geändert haben → neu anfahren
  }

  /** Ducking überbrücken: beide Wege unbearbeitet in den Mix (zum Vergleichshören). */
  setBypass(on: boolean): void {
    this.bypass = on;
    this.lastTarget = Number.NaN;
  }

  async start(devices: Devices): Promise<void> {
    await this.stop();
    try {
      const ctx = new AudioContext({ latencyHint: 'interactive' });
      this.ctx = ctx;

      this.floorStream = await this.open(devices.floorId);
      this.interpreterStream = await this.open(devices.interpreterId);

      this.floorGain = ctx.createGain();
      this.floorGain.gain.value = dbToGain(this.settings.floorGainDb);
      this.interpreterGain = ctx.createGain();
      this.interpreterGain.gain.value = dbToGain(this.settings.interpreterGainDb);

      this.floorMeter = ctx.createAnalyser();
      this.floorMeter.fftSize = 2048;
      this.interpreterMeter = ctx.createAnalyser();
      this.interpreterMeter.fftSize = 2048;

      this.mixDest = ctx.createMediaStreamDestination();

      ctx.createMediaStreamSource(this.floorStream).connect(this.floorGain);
      ctx.createMediaStreamSource(this.interpreterStream).connect(this.interpreterGain);
      // Gemessen wird HINTER der Vorverstärkung: was man hört, löst auch aus.
      this.floorGain.connect(this.floorMeter);
      this.interpreterGain.connect(this.interpreterMeter);
      this.floorGain.connect(this.mixDest);
      this.interpreterGain.connect(this.mixDest);

      await this.route(devices.outputId);
      await ctx.resume();

      this.duck = { ...INITIAL_STATE };
      this.lastTarget = Number.NaN;
      this.timer = setInterval(this.tick, TICK_MS);
      this.patch({ running: true, error: null });
    } catch (e) {
      await this.stop();
      this.patch({ error: e instanceof Error ? e.message : String(e) });
    }
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.out?.pause();
    this.out = null;
    for (const s of [this.floorStream, this.interpreterStream]) s?.getTracks().forEach((t) => t.stop());
    this.floorStream = this.interpreterStream = null;
    this.floorGain = this.interpreterGain = null;
    this.floorMeter = this.interpreterMeter = null;
    this.mixDest = null;
    if (this.ctx) await this.ctx.close().catch(() => {});
    this.ctx = null;
    this.patch({ running: false, ducking: false, floorDb: -Infinity, interpreterDb: -Infinity });
  }

  private open(deviceId: string): Promise<MediaStream> {
    const audio: MediaTrackConstraints = { ...RAW_AUDIO };
    if (deviceId) audio.deviceId = { exact: deviceId };
    return navigator.mediaDevices.getUserMedia({ audio });
  }

  /**
   * Mix auf das Ausgabegerät legen. `setSinkId` ist der ganze Trick der Einspeisung: das Ziel ist
   * ein virtuelles Kabel (VB-Cable), das Zoom/Webex als „Mikrofon" auswählen. Ein eigenes
   * virtuelles Gerät bräuchte einen signierten Kernel-Treiber — ausdrücklich außerhalb des Umfangs.
   */
  private async route(outputId: string): Promise<void> {
    if (!this.mixDest) return;
    const el = new Audio();
    el.srcObject = this.mixDest.stream;
    el.autoplay = true;
    if (outputId) {
      // setSinkId ist (noch) nicht in lib.dom typisiert.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (el as any).setSinkId(outputId);
    }
    await el.play();
    this.out = el;
  }

  private tick = (): void => {
    const ctx = this.ctx;
    const meter = this.interpreterMeter;
    const floorMeter = this.floorMeter;
    const gain = this.floorGain;
    if (!ctx || !meter || !floorMeter || !gain) return;

    if (this.buf.length !== meter.fftSize) this.buf = new Float32Array(meter.fftSize);
    meter.getFloatTimeDomainData(this.buf);
    const interpreterDb = rmsDb(this.buf);

    // Nur bei ZIELÄNDERUNG neu anfahren: `setTargetAtTime` startet die Exponentialrampe bei jedem
    // Aufruf von vorn — einmal pro Takt gerufen käme sie nie an und das Ducking bliebe zäh.
    if (this.bypass) {
      this.duck = { ...INITIAL_STATE };
      this.ramp(gain, ctx, dbToGain(this.settings.floorGainDb), 0.01);
    } else {
      const d = step(this.duck, interpreterDb, performance.now(), this.settings);
      this.duck = d.state;
      this.ramp(gain, ctx, d.targetGain, d.tau);
    }

    floorMeter.getFloatTimeDomainData(this.buf);
    this.publish(interpreterDb, rmsDb(this.buf));
  };

  private ramp(gain: GainNode, ctx: AudioContext, target: number, tau: number): void {
    if (target === this.lastTarget) return;
    gain.gain.setTargetAtTime(target, ctx.currentTime, tau);
    this.lastTarget = target;
  }

  /**
   * Der Regeltakt läuft 100×/s — so oft darf die Oberfläche nicht neu zeichnen. Pegel werden
   * gedrosselt gemeldet, der Ducking-Wechsel aber sofort (er ist die eine Zustandsänderung,
   * die man ohne Verzögerung sehen will).
   */
  private publish(interpreterDb: number, floorDb: number): void {
    const ducking = !this.bypass && this.duck.ducking;
    const now = performance.now();
    if (ducking === this.state.ducking && now - this.lastPublish < 66) return;
    this.lastPublish = now;
    this.patch({ ducking, interpreterDb, floorDb });
  }

  destroy(): void {
    void this.stop();
    this.listeners.clear();
  }
}
