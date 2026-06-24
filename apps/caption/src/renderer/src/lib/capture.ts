// Audio-Aufnahme im Renderer: Mikrofon via getUserMedia, AudioContext @ 16 kHz
// (whisper-tauglich, mono). Erkennt Äußerungen über eine einfache RMS-/Stille-
// Heuristik und liefert je Äußerung einen Float32-PCM-Block zurück. Kein natives
// Addon nötig — die Transkription übernimmt der Main (whisper-cli).
//
// ScriptProcessorNode ist veraltet, funktioniert in Electron aber zuverlässig
// ohne separate Worklet-Datei (Upgrade auf AudioWorklet später möglich).

export interface CaptureOptions {
  silenceMs: number;
  silenceThreshold: number;
  maxUtteranceSec: number;
  /** Audio-Eingang (deviceId aus enumerateDevices); leer/undefined = System-Standard. */
  deviceId?: string;
  onLevel?: (rms: number) => void;
}

export interface Capture {
  stop: () => void;
}

/**
 * Verfügbare Audio-Eingänge auflisten. Ohne erteilte Mikrofon-Berechtigung liefert
 * der Browser leere Labels — dann einmal kurz getUserMedia anfragen, damit die
 * Gerätenamen sichtbar werden (Muster aus apps/switcher).
 */
export async function listAudioInputs(): Promise<MediaDeviceInfo[]> {
  let devices = await navigator.mediaDevices.enumerateDevices();
  const inputs = (): MediaDeviceInfo[] => devices.filter((d) => d.kind === 'audioinput');
  if (inputs().length === 0 || inputs().every((d) => !d.label)) {
    let probe: MediaStream | null = null;
    try {
      probe = await navigator.mediaDevices.getUserMedia({ audio: true });
      devices = await navigator.mediaDevices.enumerateDevices();
    } catch {
      /* keine Berechtigung → (teilweise) Liste ohne Labels zurückgeben */
    } finally {
      probe?.getTracks().forEach((t) => t.stop());
    }
  }
  return inputs();
}

export async function startCapture(
  opts: CaptureOptions,
  onUtterance: (pcm: Float32Array, sampleRate: number) => void,
): Promise<Capture> {
  const audio: MediaTrackConstraints = {
    echoCancellation: false,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: 1,
  };
  if (opts.deviceId) audio.deviceId = { exact: opts.deviceId };
  const stream = await navigator.mediaDevices.getUserMedia({ audio });
  const ctx = new AudioContext({ sampleRate: 16000 });
  const sr = ctx.sampleRate;
  const source = ctx.createMediaStreamSource(stream);
  const proc = ctx.createScriptProcessor(4096, 1, 1);
  // Stumme Senke, damit der Prozessor läuft, ohne das Mikrofon hörbar zu machen.
  const sink = ctx.createGain();
  sink.gain.value = 0;

  let buffered: Float32Array[] = [];
  let bufferedLen = 0;
  let voiced = false;
  let silenceSamples = 0;
  const silenceLimit = Math.round((opts.silenceMs / 1000) * sr);
  const maxSamples = Math.round(opts.maxUtteranceSec * sr);

  const finalize = (): void => {
    if (bufferedLen === 0) return;
    const out = new Float32Array(bufferedLen);
    let o = 0;
    for (const b of buffered) {
      out.set(b, o);
      o += b.length;
    }
    buffered = [];
    bufferedLen = 0;
    voiced = false;
    silenceSamples = 0;
    onUtterance(out, sr);
  };

  proc.onaudioprocess = (e): void => {
    const ch = e.inputBuffer.getChannelData(0);
    const frame = new Float32Array(ch); // Kopie (Puffer wird wiederverwendet)
    let sum = 0;
    for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
    const r = Math.sqrt(sum / frame.length);
    opts.onLevel?.(r);

    if (r >= opts.silenceThreshold) {
      voiced = true;
      silenceSamples = 0;
    } else if (voiced) {
      silenceSamples += frame.length;
    }
    if (voiced) {
      buffered.push(frame);
      bufferedLen += frame.length;
    }
    // Äußerung abschließen: genug Stille nach Sprache ODER Maximaldauer erreicht.
    if (voiced && (silenceSamples >= silenceLimit || bufferedLen >= maxSamples)) finalize();
  };

  source.connect(proc);
  proc.connect(sink);
  sink.connect(ctx.destination);

  return {
    stop: () => {
      finalize();
      try {
        proc.disconnect();
        source.disconnect();
        sink.disconnect();
      } catch {
        /* egal */
      }
      try {
        stream.getTracks().forEach((t) => t.stop());
      } catch {
        /* egal */
      }
      try {
        void ctx.close();
      } catch {
        /* egal */
      }
    },
  };
}
