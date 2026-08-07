// Renderer-Seite des Program-Outputs: kodiert den Program-Canvas per
// MediaRecorder zu WebM und streamt die Chunks an den Main (Datei + ffmpeg/RTMP).
// Pro Output ein eigener MediaRecorder → jeder Sink bekommt einen eigenen
// WebM-Header (sauberer Stream-Start, kein Late-Join-Problem).

export interface OutputState {
  recording: boolean;
  streaming: boolean;
  recPath: string | null;
  error: string | null;
}

/** Bildrate des Canvas-Abgriffs, bis der Store seine Einstellung durchreicht. */
const DEFAULT_FPS = 30;
const DEFAULT_REC_BITS = 12_000_000;
const MIN_STREAM_INTERMEDIATE = 8_000_000;
const TIMESLICE_MS = 500;

function pickMimeType(): string {
  const candidates = [
    'video/webm;codecs=h264',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  for (const m of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) return m;
  }
  return 'video/webm';
}

export class OutputController {
  private getCanvas: () => HTMLCanvasElement | null;
  private getAudioTrack: () => MediaStreamTrack | null;
  private canvasStream: MediaStream | null = null;
  /** Bildrate fuer captureStream. Live umstellbar; wirkt beim naechsten Start eines Recorders. */
  private fps = DEFAULT_FPS;
  /** Eine Bildratenaenderung wartet darauf, dass der Canvas-Abgriff frei wird. */
  private fpsDirty = false;
  /** Starts, die noch in der Schwebe sind (Dialog bzw. ffmpeg-Start laeuft). Solange > 0 steckt
   *  die Video-Spur des Abgriffs bereits in einem Stream, der gleich einem MediaRecorder
   *  uebergeben wird — sie darf dann nicht gestoppt werden. */
  private pendingStarts = 0;
  private recRecorder: MediaRecorder | null = null;
  private streamRecorder: MediaRecorder | null = null;
  private state: OutputState = { recording: false, streaming: false, recPath: null, error: null };
  private listeners = new Set<() => void>();
  private offError: (() => void) | null = null;
  private offStatus: (() => void) | null = null;

  constructor(
    getCanvas: () => HTMLCanvasElement | null,
    getAudioTrack: () => MediaStreamTrack | null = () => null,
  ) {
    this.getCanvas = getCanvas;
    this.getAudioTrack = getAudioTrack;
  }

  /**
   * Main-Meldungen abonnieren; idempotent. Nicht im Konstruktor, weil `destroy()` sie wieder abhängt und
   * StrictMode/HMR den Effekt danach erneut laufen lassen — sonst erreichten ffmpeg-Fehler und
   * Stream-Abbrüche die Oberfläche nie wieder (siehe `NdiOutputController.attach`).
   */
  attach(): void {
    if (this.offError) return;
    this.offError = window.jmswitch.output.onError((err) => {
      this.teardown(err.scope === 'record' ? 'rec' : 'stream');
      this.patch({ error: err.message });
    });
    this.offStatus = window.jmswitch.output.onStatus((s) => {
      // Main meldet z. B. ffmpeg-Exit → Stream-Recorder mitziehen.
      if (!s.streaming && this.streamRecorder) this.teardown('stream');
    });
  }

  subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  getState(): OutputState {
    return { ...this.state };
  }

  /**
   * Bildrate des Canvas-Abgriffs setzen. Der zwischengespeicherte Abgriff wird verworfen, sobald
   * ihn niemand mehr benutzt — der naechste Start greift dann mit der neuen Rate ab.
   *
   * Laeuft eine Aufnahme oder Sendung, bleibt der Stream stehen: MediaRecorder-Spuren sind nach
   * dem Start unveraenderlich (dasselbe gilt fuer den Ton, siehe core/audio.ts). Eine laufende
   * Sendung dafuer neu zu starten waere schlimmer als die verspaetete Wirkung — die neue Rate
   * greift beim naechsten Start.
   */
  setFps(fps: number): void {
    const next = fps > 0 ? fps : DEFAULT_FPS;
    if (next === this.fps) return;
    this.fps = next;
    this.fpsDirty = true;
    this.dropCanvasStreamIfIdle();
  }

  private notify(): void {
    for (const l of this.listeners) l();
  }

  private patch(p: Partial<OutputState>): void {
    this.state = { ...this.state, ...p };
    this.notify();
  }

  /** Benutzt gerade jemand den Canvas-Abgriff? */
  private canvasStreamInUse(): boolean {
    return this.pendingStarts > 0 || this.state.recording || this.state.streaming;
  }

  /**
   * Eine wartende Bildratenaenderung einloesen, sobald der Canvas-Abgriff frei ist: alte Spuren
   * stoppen und den Cache leeren, damit `ensureCanvasStream()` beim naechsten Start mit der
   * aktuellen Rate neu abgreift. Wird aus `setFps` und am Ende jedes `teardown` versucht.
   */
  private dropCanvasStreamIfIdle(): void {
    if (!this.fpsDirty || this.canvasStreamInUse()) return;
    this.canvasStream?.getTracks().forEach((t) => t.stop());
    this.canvasStream = null;
    this.fpsDirty = false;
  }

  private ensureCanvasStream(): MediaStream | null {
    if (this.canvasStream) return this.canvasStream;
    const c = this.getCanvas();
    if (!c) return null;
    this.canvasStream = c.captureStream(this.fps);
    return this.canvasStream;
  }

  /** Frischen Output-Stream bauen: Program-Video + aktueller Audio-Track (falls). */
  private buildOutputStream(): MediaStream | null {
    const cv = this.ensureCanvasStream();
    const video = cv?.getVideoTracks()[0];
    if (!video) return null;
    const audio = this.getAudioTrack();
    return new MediaStream(audio ? [video, audio] : [video]);
  }

  /** Aufnahme mit Speicherdialog (UI-Button). */
  startRecording(bitrateKbps?: number): Promise<void> {
    return this.beginRecording(() => window.jmswitch.output.recStart(), bitrateKbps);
  }

  /** Aufnahme ohne Dialog (Fernsteuerung): Standardordner + Zeitstempel. */
  startRecordingAuto(bitrateKbps?: number): Promise<void> {
    return this.beginRecording(() => window.jmswitch.output.recStartAuto(), bitrateKbps);
  }

  private async beginRecording(
    open: () => Promise<{ ok: boolean; path?: string; error?: string }>,
    bitrateKbps?: number,
  ): Promise<void> {
    if (this.recRecorder) return;
    // Ab hier haengt die Video-Spur des Abgriffs in der Schwebe: sie steckt schon in `stream`,
    // der Recorder entsteht aber erst nach dem await. Solange darf setFps sie nicht stoppen.
    this.pendingStarts++;
    try {
      const stream = this.buildOutputStream();
      if (!stream) {
        this.patch({ error: 'Kein Program-Bild zum Aufnehmen.' });
        return;
      }
      const res = await open();
      if (!res.ok) {
        if (res.error) this.patch({ error: res.error });
        return; // abgebrochen
      }
      const bits = bitrateKbps ? bitrateKbps * 1000 : DEFAULT_REC_BITS;
      const rec = new MediaRecorder(stream, { mimeType: pickMimeType(), videoBitsPerSecond: bits });
      rec.ondataavailable = (e) => void this.send(e.data, 'rec');
      rec.onstop = () => window.jmswitch.output.recStop();
      rec.onerror = () => {
        this.teardown('rec');
        this.patch({ error: 'Aufnahme-Encoder-Fehler.' });
      };
      rec.start(TIMESLICE_MS);
      this.recRecorder = rec;
      this.patch({ recording: true, recPath: res.path ?? null, error: null });
    } finally {
      this.pendingStarts--;
      // Wurde waehrend des Starts die Bildrate geaendert oder der Start abgebrochen: jetzt einloesen.
      this.dropCanvasStreamIfIdle();
    }
  }

  stopRecording(): void {
    this.teardown('rec');
  }

  async startStreaming(url: string, bitrateKbps?: number): Promise<void> {
    if (this.streamRecorder) return;
    // Siehe beginRecording: zwischen buildOutputStream und rec.start haengt die Video-Spur in der Schwebe.
    this.pendingStarts++;
    try {
      const stream = this.buildOutputStream();
      if (!stream) {
        this.patch({ error: 'Kein Program-Bild zum Streamen.' });
        return;
      }
      const hasAudio = stream.getAudioTracks().length > 0;
      const res = await window.jmswitch.output.streamStart(url, bitrateKbps, hasAudio);
      if (!res.ok) {
        this.patch({ error: res.error ?? 'Stream-Start fehlgeschlagen.' });
        return;
      }
      // Zwischen-WebM nicht unter die Stream-Zielbitrate drücken (sonst Qualitätsverlust
      // vor dem x264-Re-Encode).
      const interBits = Math.max(MIN_STREAM_INTERMEDIATE, (bitrateKbps ?? 0) * 1000);
      const rec = new MediaRecorder(stream, { mimeType: pickMimeType(), videoBitsPerSecond: interBits });
      rec.ondataavailable = (e) => void this.send(e.data, 'stream');
      rec.onstop = () => window.jmswitch.output.streamStop();
      rec.onerror = () => {
        this.teardown('stream');
        this.patch({ error: 'Stream-Encoder-Fehler.' });
      };
      rec.start(TIMESLICE_MS);
      this.streamRecorder = rec;
      this.patch({ streaming: true, error: null });
    } finally {
      this.pendingStarts--;
      this.dropCanvasStreamIfIdle();
    }
  }

  stopStreaming(): void {
    this.teardown('stream');
  }

  private async send(blob: Blob, scope: 'rec' | 'stream'): Promise<void> {
    if (!blob || blob.size === 0) return;
    const buf = new Uint8Array(await blob.arrayBuffer());
    if (scope === 'rec') window.jmswitch.output.recChunk(buf);
    else window.jmswitch.output.streamChunk(buf);
  }

  private teardown(scope: 'rec' | 'stream'): void {
    const rec = scope === 'rec' ? this.recRecorder : this.streamRecorder;
    if (rec) {
      try {
        if (rec.state !== 'inactive') rec.stop(); // onstop → recStop/streamStop an den Main
      } catch {
        // egal
      }
    }
    if (scope === 'rec') {
      this.recRecorder = null;
      this.patch({ recording: false });
    } else {
      this.streamRecorder = null;
      this.patch({ streaming: false });
    }
    // Nach dem Stoppen kann eine wartende Bildratenaenderung greifen.
    this.dropCanvasStreamIfIdle();
  }

  destroy(): void {
    this.teardown('rec');
    this.teardown('stream');
    this.offError?.();
    this.offError = null;
    this.offStatus?.();
    this.offStatus = null;
    this.canvasStream?.getTracks().forEach((t) => t.stop());
    this.canvasStream = null;
    this.listeners.clear();
  }
}
