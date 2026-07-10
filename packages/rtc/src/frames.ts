// @jm/rtc/frames — WebCodecs ↔ NDI-Frame-Konverter (Welle 6). NUR im Renderer/hidden-Peer nutzbar
// (WebCodecs VideoFrame/AudioData existieren nur dort, mit lib.dom) — NICHT im Worker/DO importieren;
// deshalb ist dieses Modul bewusst NICHT vom @jm/rtc-Root re-exportiert.
//
// Extrahiert aus apps/ndi-screen-capture (App.tsx handleFrame/handleAudio): der Suite-weite,
// erprobte Pfad ist BGRA (Video, alpha-fähig) + f32-planar/FLTP (Audio) — exakt das, was
// @jm/ndi.sendVideoBGRA / sendAudioFLTP erwarten. WICHTIG: die entstehenden Buffer NICHT über
// MessagePorts transferieren — ein transferierter ArrayBuffer kommt jenseits der Renderer→Main-
// Port-Grenze als null an (verifiziert im Switcher); immer kopieren.

export interface BgraFrame {
  buffer: ArrayBuffer;
  width: number;
  height: number;
}
export interface FltpAudio {
  buffer: ArrayBuffer;
  ch: number;
  n: number;
  sr: number;
}

/** VideoFrame → tightly-packed BGRA (wie @jm/ndi.sendVideoBGRA erwartet). */
export async function videoFrameToBgra(frame: VideoFrame): Promise<BgraFrame> {
  const size = frame.allocationSize({ format: 'BGRA' });
  const buffer = new ArrayBuffer(size);
  await frame.copyTo(new Uint8Array(buffer), { format: 'BGRA' });
  return { buffer, width: frame.displayWidth, height: frame.displayHeight };
}

/** AudioData → float32-planar (FLTP-Layout [ch0…][ch1…], wie @jm/ndi.sendAudioFLTP erwartet). */
export async function audioDataToFltp(data: AudioData): Promise<FltpAudio> {
  const ch = data.numberOfChannels;
  const n = data.numberOfFrames;
  const out = new Float32Array(ch * n);
  for (let c = 0; c < ch; c++) {
    await data.copyTo(out.subarray(c * n, c * n + n), { planeIndex: c, format: 'f32-planar' });
  }
  return { buffer: out.buffer, ch, n, sr: data.sampleRate };
}

// ── Rückkanal (Welle 6.2): BGRA/FLTP → WebCodecs, um Programm-/Mix-Minus-Frames in einen
// MediaStreamTrackGenerator zu speisen (Programm-NDI → Peer → publish an die Gäste).
export function bgraToVideoFrame(f: BgraFrame, timestampUs: number): VideoFrame {
  return new VideoFrame(new Uint8Array(f.buffer), {
    format: 'BGRA',
    codedWidth: f.width,
    codedHeight: f.height,
    timestamp: timestampUs,
  });
}
export function fltpToAudioData(a: FltpAudio, timestampUs: number): AudioData {
  return new AudioData({
    format: 'f32-planar',
    sampleRate: a.sr,
    numberOfFrames: a.n,
    numberOfChannels: a.ch,
    timestamp: timestampUs,
    data: new Float32Array(a.buffer),
  });
}
