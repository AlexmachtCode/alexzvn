// Renderer-Seite der NDI-Ausgabe: liest pro Tick das gewählte Quell-Canvas
// (Program- oder Multiview-Bild), wandelt RGBA→BGRA und postet es auf den vom
// Main übergebenen Frame-Port (→ utilityProcess → sendVideoBGRA). Gedrosselt auf
// eine Ziel-Framerate, damit der Encoder/Netz nicht überlastet wird.
//
// Zusätzlich wird der PROGRAMM-TON (derselbe Track, der in Aufnahme/RTMP geht)
// per MediaStreamTrackProcessor als float32-planar (FLTP) mitgesendet → sendAudioFLTP.
// Vorher war die NDI-Quelle stumm; Empfänger wie der JM-Connect-Rückkanal, OBS oder
// vMix bekamen nur Bild.
//
// Gleiche Pixel-Mechanik wie der JM Titler: ohne Transfer posten (Buffer wird
// kopiert; ein transferierter ArrayBuffer käme über die Port-Grenze als null an).

// Die Ausgabe-Auflösung ist NICHT mehr fest: der Pump liest die tatsächliche Größe des
// Quell-Canvas (Programm bzw. Multiview) und gibt sie 1:1 aus. So folgt NDI automatisch der
// Einstellung „Programm-Auflösung" (720p/1080p) und dem Program/Multiview-Umschalter, ohne
// hochzuskalieren. Nur die Bildrate ist eine eigene Einstellung.
const DEFAULT_FPS = 25;

export interface NdiOutputState {
  active: boolean;
  name: string;
  connections: number;
  error: string | null;
}

export class NdiOutputController {
  private getSource: () => HTMLCanvasElement | null;
  private getAudioTrack: () => MediaStreamTrack | null;
  private out: HTMLCanvasElement;
  private outCtx: CanvasRenderingContext2D | null;
  private port: MessagePort | null = null;
  // Taktgeber: BEWUSST ein Timer, NICHT requestAnimationFrame. rAF hängt am Display-Takt und wird
  // von Chromium angehalten, sobald das Fenster verdeckt/minimiert ist — der Programm-Ausgang blieb
  // dann im Netz sichtbar, sendete aber keine Frames mehr. Ein Live-Ausgang muss durchlaufen.
  private timer: ReturnType<typeof setInterval> | null = null;
  private framesSent = 0;
  private diagCount = 0;
  private pumpLogged = false;
  private blockLogged = false;
  private blockedTicks = 0;
  private noSrcLogged = false;
  private state: NdiOutputState = { active: false, name: '', connections: 0, error: null };
  private listeners = new Set<() => void>();
  private attached = false;
  private offStatus: (() => void) | null = null;
  private onPortMsg: (e: MessageEvent) => void;
  // Programm-Ton → NDI. Der gepumpte Track wird gemerkt, um einen Gerätewechsel zu erkennen.
  private audioTrack: MediaStreamTrack | null = null;
  private audioReader: ReadableStreamDefaultReader<AudioData> | null = null;
  // Bildrate (Einstellung). Live über setFps() umstellbar; startet den Timer neu.
  private fps: number;

  constructor(
    getSource: () => HTMLCanvasElement | null,
    getAudioTrack: () => MediaStreamTrack | null,
    fps = DEFAULT_FPS,
  ) {
    this.getSource = getSource;
    this.getAudioTrack = getAudioTrack;
    this.fps = fps > 0 ? fps : DEFAULT_FPS;
    // Größe wird im Pump aus dem Quell-Canvas übernommen (lazy) — hier nur anlegen.
    this.out = document.createElement('canvas');
    this.outCtx = this.out.getContext('2d', { willReadFrequently: true });

    // Frame-Port der NDI-Ausgabe vom Main empfangen (Preload → window 'message').
    this.onPortMsg = (e: MessageEvent): void => {
      const data = e.data as { kind?: string } | null;
      if (!data || data.kind !== 'jmswitch:ndi-out-port' || !e.ports[0]) return;
      try {
        this.port?.close();
      } catch {
        // egal
      }
      this.port = e.ports[0];
      this.port.start();
      // Empfangsquittung ins Terminal: fehlt sie, ist der Frame-Port nie im Renderer angekommen.
      console.log('[ndi-out] Frame-Port im Renderer angekommen');
    };
  }

  /**
   * Fenster-Listener (Frame-Port) und Status-Abo aufsetzen; idempotent.
   *
   * BEWUSST nicht im Konstruktor: der Controller wird im Render-Körper erzeugt, und React StrictMode
   * ruft den Render-Körper doppelt auf (→ zwei Instanzen, eine wird verworfen) und simuliert danach ein
   * Unmount/Remount (Effekt → Cleanup → Effekt). Verdrahtete der Konstruktor, hinge der Frame-Port an der
   * VERWORFENEN Instanz, während die benutzte nach `destroy()` ohne Listener dastünde: der NDI-Sender wäre
   * im Netz sichtbar, sendete aber nie ein Frame. Deshalb ist der Konstruktor nebenwirkungsfrei und der
   * Effekt verdrahtet — er stellt die Verbindung nach jeder Cleanup wieder her.
   */
  attach(): void {
    if (this.attached) return;
    this.attached = true;
    window.addEventListener('message', this.onPortMsg);
    this.offStatus = window.jmswitch.output.onNdiStatus((s) => {
      this.patch({ active: s.active, name: s.name, connections: s.connections });
    });
  }

  private detach(): void {
    if (!this.attached) return;
    this.attached = false;
    window.removeEventListener('message', this.onPortMsg);
    this.offStatus?.();
    this.offStatus = null;
  }

  subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  getState(): NdiOutputState {
    return { ...this.state };
  }

  private notify(): void {
    for (const l of this.listeners) l();
  }

  private patch(p: Partial<NdiOutputState>): void {
    this.state = { ...this.state, ...p };
    this.notify();
  }

  async start(name: string): Promise<void> {
    // Aufrufer sind `void ndiOut.start(...)` — ein Wurf hier verschwände als unbehandelte Rejection
    // und die Ausgabe bliebe wortlos stumm (Sender im Netz sichtbar, aber keine Frames).
    try {
      console.log('[ndi-out] start():', name);
      const res = await window.jmswitch.output.ndiStart(name);
      console.log('[ndi-out] ndiStart-Ergebnis:', JSON.stringify(res));
      if (!res || !res.ok) {
        this.patch({ error: (res && res.error) ?? 'NDI-Ausgabe konnte nicht starten.' });
        return;
      }
      this.patch({ active: true, name, error: null });
      this.framesSent = 0;
      this.diagCount = 0;
      this.pumpLogged = false;
      this.blockLogged = false;
      this.blockedTicks = 0;
      this.noSrcLogged = false;
      if (!this.timer) this.timer = setInterval(this.tick, Math.round(1000 / this.fps));
      console.log(`[ndi-out] Timer gestartet (${this.fps} fps) · Port ${this.port ? 'da' : 'FEHLT'} · active=${this.state.active}`);
    } catch (e) {
      console.log('[ndi-out] start() fehlgeschlagen:', e instanceof Error ? e.message : String(e));
      this.patch({ error: e instanceof Error ? e.message : String(e) });
    }
  }

  async stop(): Promise<void> {
    await window.jmswitch.output.ndiStop();
    this.patch({ active: false, connections: 0 });
    void this.stopAudioPump();
    this.audioTrack = null;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Bildrate live umstellen (Einstellung). Läuft der Sender, wird der Timer neu getaktet. */
  setFps(fps: number): void {
    const next = fps > 0 ? fps : DEFAULT_FPS;
    if (next === this.fps) return;
    this.fps = next;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = setInterval(this.tick, Math.round(1000 / this.fps));
    }
  }

  /** Ein Tick. Gekapselt: ein einzelner Fehler darf den Ausgang nicht dauerhaft abwürgen
   *  (bei der rAF-Schleife riss ein Wurf die Kette ab und die Quelle sendete nie wieder). */
  private tick = (): void => {
    try {
      this.pump();
    } catch (e) {
      this.diag(`Fehler in der Pumpe: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  /** Diagnose an den utilityProcess → landet im Terminal (die Renderer-Konsole sieht niemand). */
  private diag(msg: string): void {
    if (this.diagCount >= 5 || !this.port) return;
    this.diagCount++;
    this.port.postMessage({ type: 'diag', msg });
  }

  private pump(): void {
    if (!this.pumpLogged) {
      this.pumpLogged = true;
      console.log(`[ndi-out] pump() läuft · Port ${this.port ? 'da' : 'FEHLT'} · active=${this.state.active} · ctx=${!!this.outCtx}`);
    }
    if (!this.port || !this.state.active || !this.outCtx) {
      // Der Frame-Port trifft erst kurz NACH `ndiStart` ein — die ersten Ticks laufen normal leer.
      // Erst wenn er nach einer Sekunde immer noch fehlt, ist etwas kaputt.
      if (++this.blockedTicks >= this.fps && !this.blockLogged) {
        this.blockLogged = true;
        console.log(`[ndi-out] Pumpe blockiert: port=${!!this.port} active=${this.state.active} ctx=${!!this.outCtx}`);
      }
      return;
    }
    this.blockedTicks = 0;
    // Der Ton-Pfad darf den Bild-Pfad NIEMALS mitreißen: wirft die Audio-Pumpe, wäre sonst auch
    // die NDI-Bildausgabe tot (dieselbe Lehre wie im JM-Connect-Peer).
    try {
      this.syncAudioPump();
    } catch (e) {
      this.diag(`Audio-Pumpe fehlgeschlagen (Bild läuft weiter): ${e instanceof Error ? e.message : String(e)}`);
    }
    const src = this.getSource();
    if (!src || src.width === 0 || src.height === 0) {
      if (!this.noSrcLogged) { this.noSrcLogged = true; console.log(`[ndi-out] kein Programmbild — ${src ? 'Canvas width=' + src.width : 'kein Canvas'}`); }
      return;
    }

    // Ausgabegröße = tatsächliche Quell-Canvasgröße (folgt der Programm-Auflösung + dem
    // Program/Multiview-Umschalter). Das Zwischen-Canvas nur bei echter Änderung neu dimensionieren.
    const w = src.width;
    const h = src.height;
    if (this.out.width !== w || this.out.height !== h) {
      this.out.width = w;
      this.out.height = h;
    }
    this.outCtx.drawImage(src, 0, 0);
    const img = this.outCtx.getImageData(0, 0, w, h);
    const u32 = new Uint32Array(img.data.buffer);
    // RGBA (0xAABBGGRR LE) → BGRA (0xAARRGGBB LE): R und B tauschen.
    for (let i = 0; i < u32.length; i++) {
      const p = u32[i];
      u32[i] = (p & 0xff00ff00) | ((p & 0x000000ff) << 16) | ((p & 0x00ff0000) >>> 16);
    }
    this.port.postMessage({ type: 'video', buffer: img.data.buffer, w, h, fpsN: this.fps });
    if (++this.framesSent === 1) console.log(`[ndi-out] erstes NDI-Frame gesendet (${w}x${h}@${this.fps})`);
  }

  /** Audio-Pumpe an den aktuell gewählten Programm-Ton-Track angleichen (Gerätewechsel/-abwahl). */
  private syncAudioPump(): void {
    const track = this.getAudioTrack();
    if (track === this.audioTrack) {
      // Gleicher Track: nur starten, falls noch keine Pumpe läuft (z. B. Gerät nachträglich gewählt).
      if (track && !this.audioReader && track.readyState === 'live') void this.pumpAudio(track);
      return;
    }
    void this.stopAudioPump();
    this.audioTrack = track;
    if (track && track.readyState === 'live') void this.pumpAudio(track);
  }

  /**
   * Programm-Ton → float32-planar (FLTP: [ch0…][ch1…]) → NDI-Sender.
   * Das Layout ist der Vertrag von @jm/ndi.sendAudioFLTP; bewusst hier inline gehalten,
   * wie die RGBA→BGRA-Wandlung oben (jede App bündelt ihren NDI-Pfad selbst).
   */
  private async pumpAudio(track: MediaStreamTrack): Promise<void> {
    if (this.audioReader) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Proc = (window as any).MediaStreamTrackProcessor;
    if (!Proc) return;
    const reader: ReadableStreamDefaultReader<AudioData> = new Proc({ track }).readable.getReader();
    this.audioReader = reader;
    try {
      for (;;) {
        const { value: data, done } = await reader.read();
        if (done) break;
        if (!data) continue;
        try {
          if (!this.state.active || !this.port) break;
          const ch = data.numberOfChannels;
          const n = data.numberOfFrames;
          const out = new Float32Array(ch * n);
          for (let c = 0; c < ch; c++) {
            await data.copyTo(out.subarray(c * n, c * n + n), { planeIndex: c, format: 'f32-planar' });
          }
          this.port.postMessage({ type: 'audio', buffer: out.buffer, ch, n, sr: data.sampleRate });
        } finally {
          data.close();
        }
      }
    } catch {
      // Track beendet / Gerätewechsel — die nächste syncAudioPump-Runde startet neu.
    } finally {
      if (this.audioReader === reader) this.audioReader = null;
    }
  }

  private async stopAudioPump(): Promise<void> {
    const reader = this.audioReader;
    this.audioReader = null;
    if (!reader) return;
    try {
      await reader.cancel();
    } catch {
      // egal
    }
  }

  destroy(): void {
    this.detach();
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    void this.stopAudioPump();
    this.audioTrack = null;
    try {
      this.port?.close();
    } catch {
      // egal
    }
    this.port = null;
    // Ohne das behielte ein Remount (StrictMode/HMR) ein „aktiv"-Abzeichen, obwohl die Ausgabe steht.
    this.state = { ...this.state, active: false, connections: 0 };
    void window.jmswitch.output.ndiStop().catch(() => {});
    this.listeners.clear();
  }
}
