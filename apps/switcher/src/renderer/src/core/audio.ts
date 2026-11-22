// Programm-Audio: nimmt EIN Eingangsgerät (Mikro/Line-In/Capture-Ton) über
// getUserMedia, führt es durch einen WebAudio-Graph (Gain für Fader/Mute +
// Analyser für den Pegel) und liefert einen Ausgangs-Track, der zusammen mit dem
// Program-Canvas in den MediaRecorder (Aufnahme + RTMP) geht.
//
//   getUserMedia → MediaStreamSource → Gain → (Analyser, MediaStreamDestination)
//
// Fader/Mute wirken live (Gain-Node). Ein Gerätewechsel baut den Graph neu — das
// wirkt im Output erst beim nächsten Start (MediaRecorder-Track ist fix).
//
// Abziehen (0.12.1): Endet die Eingangsspur des offenen Geräts, meldet der Controller `getrennt` und löst nur die Quelle.
// Gain, Analyser und Ausgang bleiben, damit eine laufende Aufnahme oder Sendung ihre Spur behält. Meldet der Browser danach
// ein devicechange und steht das Gerät wieder in der Liste, hängt eine neue Quelle an denselben Gain: Der Ton kommt zurück.

export interface AudioState {
  hasDevice: boolean;
  muted: boolean;
  gain: number; // 0..1.5
  level: number; // 0..1 (RMS)
  error: string | null;
  /** Die Eingangsspur des gewählten Geräts ist beendet (abgezogen) und noch nicht wieder verbunden. */
  getrennt: boolean;
}

/** Ruft `cb` bei jedem devicechange; die Rückgabe meldet ab. Ohne mediaDevices (kein Browser) ohne Wirkung. */
export function beobachteGeraetewechsel(md: MediaDevices | undefined, cb: () => void): () => void {
  if (!md || typeof md.addEventListener !== 'function') return () => {};
  const bei = (): void => cb();
  md.addEventListener('devicechange', bei);
  return () => md.removeEventListener('devicechange', bei);
}

function eingang(deviceId: string): MediaStreamConstraints {
  return {
    audio: { deviceId: { exact: deviceId }, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    video: false,
  };
}

function mediaDevices(): MediaDevices | undefined {
  return typeof navigator === 'undefined' ? undefined : navigator.mediaDevices;
}

/** Chromiums Stellvertreter-Einträge: Sie zeigen auf das jeweilige Systemgerät, das nach dem Abziehen ein anderes sein kann. */
const STELLVERTRETER = new Set(['default', 'communications']);

/** Kennung des physischen Geräts hinter der Spur ('' = unbekannt). */
function gruppeVon(stream: MediaStream): string {
  const s = stream.getAudioTracks()[0]?.getSettings?.();
  return typeof s?.groupId === 'string' ? s.groupId : '';
}

function spurBeendet(stream: MediaStream): boolean {
  return stream.getAudioTracks().some((t) => t.readyState === 'ended');
}

/** Takt, in dem ein getrenntes oder beim Öffnen fehlendes Gerät erneut gesucht wird. */
export const WIEDERHOL_MS = 2000;

export class AudioController {
  private ctx: AudioContext | null = null;
  private srcStream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private dest: MediaStreamAudioDestinationNode | null = null;
  private buf = new Float32Array(2048);
  private meterTimer: ReturnType<typeof setTimeout> | null = null;
  private currentDeviceId = '';
  private geraeteAbmelden: (() => void) | null = null;
  private verbindetNeu = false;
  /** Physisches Gerät (groupId) beim Öffnen; ein Wiederverbinden nimmt nur dasselbe. */
  private gruppe = '';
  /** Gewähltes Gerät, dessen Öffnen scheiterte (z. B. beim Start nicht eingesteckt); wird im Takt erneut versucht. */
  private wartetAuf = '';
  private nachsehenTimer: ReturnType<typeof setTimeout> | null = null;
  private oeffnenNr = 0;
  private readonly wiederholMs: number;

  private state: AudioState = { hasDevice: false, muted: false, gain: 1, level: 0, error: null, getrennt: false };

  constructor(optionen: { wiederholMs?: number } = {}) {
    this.wiederholMs = optionen.wiederholMs ?? WIEDERHOL_MS;
  }
  private listeners = new Set<() => void>();

  subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  getState(): AudioState {
    return { ...this.state };
  }

  private notify(): void {
    for (const l of this.listeners) l();
  }

  private patch(p: Partial<AudioState>): void {
    this.state = { ...this.state, ...p };
    this.notify();
  }

  /** Aktiver Audio-Ausgangs-Track (für die Recorder-Stream-Kombi) oder null. */
  getOutputTrack(): MediaStreamTrack | null {
    return this.dest?.stream.getAudioTracks()[0] ?? null;
  }

  hasAudio(): boolean {
    return this.getOutputTrack() != null;
  }

  /** Eingangsgerät setzen ('' = aus). Baut den Graph (neu) auf. */
  async setDevice(deviceId: string): Promise<void> {
    // Eine andere Wahl (auch „Kein Ton“) beendet das Warten auf ein beim Öffnen gescheitertes Gerät, samt dessen altem Fehler.
    if (this.wartetAuf !== '' && deviceId !== this.wartetAuf) {
      this.wartetAuf = '';
      this.nachsehenStoppen();
      if (this.currentDeviceId === '') this.patch({ error: null });
    }
    // Dieselbe Wahl nach dem Abziehen: neu öffnen, der Graph bleibt.
    if (deviceId !== '' && deviceId === this.currentDeviceId && this.state.getrennt && this.gainNode) {
      await this.wiederVerbinden();
      return;
    }
    if (deviceId === this.currentDeviceId && (deviceId === '' || this.dest)) return;
    this.currentDeviceId = deviceId;
    this.wartetAuf = '';
    this.nachsehenStoppen();
    this.teardownGraph();
    this.gruppe = '';
    if (!deviceId) {
      this.patch({ hasDevice: false, level: 0, error: null, getrennt: false });
      return;
    }
    // Ein anderes Gerät erbt den Fehler „getrennt“ des vorigen nicht, auch nicht für die Dauer des Öffnens.
    if (this.state.getrennt) this.patch({ getrennt: false });
    if (!this.geraeteAbmelden) this.geraeteAbmelden = beobachteGeraetewechsel(mediaDevices(), () => void this.nachsehen());
    // Jedes Öffnen hat eine Nummer: Ein überholtes (anderes Gerät, dieselbe Wahl erneut, destroy) baut keinen zweiten Graphen.
    const nr = ++this.oeffnenNr;
    try {
      const stream = await navigator.mediaDevices.getUserMedia(eingang(deviceId));
      // Falls zwischenzeitlich ein anderes Gerät gewählt wurde oder ein neueres Öffnen läuft: verwerfen.
      if (nr !== this.oeffnenNr || this.currentDeviceId !== deviceId) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const ctx = this.ctx ?? new AudioContext();
      this.ctx = ctx;
      void ctx.resume().catch(() => {});
      this.srcStream = stream;
      this.source = ctx.createMediaStreamSource(stream);
      this.gainNode = ctx.createGain();
      this.gainNode.gain.value = this.state.muted ? 0 : this.state.gain;
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.buf = new Float32Array(this.analyser.fftSize);
      this.dest = ctx.createMediaStreamDestination();
      this.source.connect(this.gainNode);
      this.gainNode.connect(this.analyser);
      this.gainNode.connect(this.dest);
      this.gruppe = gruppeVon(stream);
      this.beiSpurende(stream);
      this.startMeter();
      this.patch({ hasDevice: true, error: null, getrennt: false });
      if (spurBeendet(stream)) this.getrenntMelden(stream);
    } catch (e) {
      // Inzwischen ein anderes Gerät gewählt, ein neueres Öffnen oder destroy: dessen Zustand nicht überschreiben.
      if (nr !== this.oeffnenNr || this.currentDeviceId !== deviceId) return;
      this.currentDeviceId = '';
      this.wartetAuf = deviceId;
      this.patch({ hasDevice: false, error: e instanceof Error ? e.message : String(e), getrennt: false });
      this.nachsehenPlanen();
    }
  }

  /** Endet eine Spur des offenen Streams (Gerät abgezogen): getrennt melden. Abgelöste Streams zählen nicht. */
  private beiSpurende(stream: MediaStream): void {
    for (const spur of stream.getAudioTracks()) {
      spur.addEventListener('ended', () => this.getrenntMelden(stream), { once: true });
    }
  }

  /** Nur die Quelle lösen (Gain und Ausgang bleiben), getrennt melden und im Takt nach dem Gerät sehen. */
  private getrenntMelden(stream: MediaStream): void {
    if (this.srcStream !== stream) return;
    this.quelleLoesen();
    this.patch({ hasDevice: false, getrennt: true, level: 0 });
    this.nachsehenPlanen();
  }

  /** Nur die Eingangsseite abbauen; Gain, Analyser und Ausgang bleiben (laufende Aufnahme und Sendung behalten ihre Spur). */
  private quelleLoesen(): void {
    try {
      this.source?.disconnect();
    } catch {
      // egal
    }
    this.srcStream?.getTracks().forEach((t) => t.stop());
    this.srcStream = null;
    this.source = null;
  }

  /** Muss jemand nach dem Gerät sehen? Getrennt (Graph steht) oder beim Öffnen gescheitert. */
  private sucheNoetig(): boolean {
    return (this.state.getrennt && this.currentDeviceId !== '') || this.wartetAuf !== '';
  }

  private nachsehenPlanen(): void {
    if (this.nachsehenTimer != null || !this.sucheNoetig()) return;
    this.nachsehenTimer = setTimeout(() => {
      this.nachsehenTimer = null;
      void this.nachsehen();
    }, this.wiederholMs);
  }

  private nachsehenStoppen(): void {
    if (this.nachsehenTimer != null) clearTimeout(this.nachsehenTimer);
    this.nachsehenTimer = null;
  }

  /**
   * Dasselbe physische Gerät? Ist die Gruppe von Öffnen und Liste bekannt, muss sie gleich sein. Sonst verbindet nur ein echter
   * Eintrag von selbst, nie „Standard“ oder „Kommunikation“ (die nach dem Abziehen auf ein anderes Mikro zeigen können).
   */
  private gleichesGeraet(id: string, gruppeJetzt: string): boolean {
    if (this.gruppe !== '' && gruppeJetzt !== '') return gruppeJetzt === this.gruppe;
    return !STELLVERTRETER.has(id);
  }

  /** devicechange oder Takt: Steht das gesuchte Gerät in der Liste, verbinden (getrennt) bzw. öffnen (beim Start gescheitert). */
  private async nachsehen(): Promise<void> {
    try {
      if (this.verbindetNeu || !this.sucheNoetig()) return;
      const getrennt = this.state.getrennt;
      const id = getrennt ? this.currentDeviceId : this.wartetAuf;
      let liste: MediaDeviceInfo[];
      try {
        liste = await navigator.mediaDevices.enumerateDevices();
      } catch {
        return;
      }
      const eintrag = liste.find((d) => d.kind === 'audioinput' && d.deviceId === id);
      if (!eintrag) return;
      if (getrennt) {
        if (this.state.getrennt && this.currentDeviceId === id && this.gleichesGeraet(id, eintrag.groupId ?? '')) await this.wiederVerbinden();
      } else if (this.wartetAuf === id && this.currentDeviceId === '') {
        await this.setDevice(id);
      }
    } finally {
      this.nachsehenPlanen();
    }
  }

  /** Das gewählte Gerät neu öffnen und an den bestehenden Gain hängen; scheitert es, bleibt der Zustand getrennt. */
  private async wiederVerbinden(): Promise<void> {
    const id = this.currentDeviceId;
    if (this.verbindetNeu || !id || !this.state.getrennt || !this.ctx || !this.gainNode) return;
    this.verbindetNeu = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia(eingang(id));
      const gruppeJetzt = gruppeVon(stream);
      const anderesGeraet = this.gruppe !== '' && gruppeJetzt !== '' && gruppeJetzt !== this.gruppe;
      if (this.currentDeviceId !== id || !this.state.getrennt || !this.ctx || !this.gainNode || anderesGeraet) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      this.srcStream = stream;
      this.source = this.ctx.createMediaStreamSource(stream);
      this.source.connect(this.gainNode);
      this.beiSpurende(stream);
      this.patch({ hasDevice: true, getrennt: false, error: null });
      if (spurBeendet(stream)) this.getrenntMelden(stream);
    } catch {
      // Gerät noch nicht bereit: getrennt bleibt stehen, der nächste Takt oder devicechange versucht es erneut.
    } finally {
      this.verbindetNeu = false;
    }
  }

  setMuted(muted: boolean): void {
    if (this.gainNode) this.gainNode.gain.value = muted ? 0 : this.state.gain;
    this.patch({ muted });
  }

  setGain(gain: number): void {
    const g = Math.min(1.5, Math.max(0, gain));
    if (this.gainNode && !this.state.muted) this.gainNode.gain.value = g;
    this.patch({ gain: g });
  }

  private startMeter(): void {
    if (this.meterTimer != null) return;
    const tick = (): void => {
      const an = this.analyser;
      if (!an) {
        this.meterTimer = null;
        return;
      }
      an.getFloatTimeDomainData(this.buf);
      let sum = 0;
      for (let i = 0; i < this.buf.length; i++) sum += this.buf[i] * this.buf[i];
      const rms = Math.sqrt(sum / this.buf.length);
      // Leicht geglättet, damit der Balken nicht flackert.
      const level = Math.max(rms, this.state.level * 0.8);
      if (Math.abs(level - this.state.level) > 0.002) this.patch({ level });
      this.meterTimer = setTimeout(tick, 60);
    };
    tick();
  }

  private teardownGraph(): void {
    if (this.meterTimer != null) {
      clearTimeout(this.meterTimer);
      this.meterTimer = null;
    }
    try {
      this.source?.disconnect();
      this.gainNode?.disconnect();
      this.analyser?.disconnect();
    } catch {
      // egal
    }
    this.srcStream?.getTracks().forEach((t) => t.stop());
    this.srcStream = null;
    this.source = null;
    this.gainNode = null;
    this.analyser = null;
    this.dest = null;
  }

  destroy(): void {
    this.geraeteAbmelden?.();
    this.geraeteAbmelden = null;
    this.nachsehenStoppen();
    this.oeffnenNr++;
    this.teardownGraph();
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.listeners.clear();
    // Wiederverwendung nach destroy (StrictMode, HMR): dieselbe Wahl baut neu auf, statt am getrennten Zustand zu hängen.
    this.currentDeviceId = '';
    this.wartetAuf = '';
    this.gruppe = '';
    this.state = { ...this.state, hasDevice: false, level: 0, error: null, getrennt: false };
  }
}
