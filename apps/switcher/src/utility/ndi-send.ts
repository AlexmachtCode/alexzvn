// utilityProcess-Entry: hält das native @jm/ndi-Addon und SENDET die vom
// Renderer gezeichneten Frames (Program- oder Multiview-Bild) als NDI-Quelle.
// Läuft isoliert vom Main-/UI-Pfad (eigene NDI-Runtime + Sender pro Prozess).
//
// Nachrichten kommen über parentPort (Main bridgt den Renderer-Frame-Port hierher):
//   { type: 'init',  name }                                  → init + createSender
//   { type: 'video', buffer(ArrayBuffer, BGRA), w, h, fpsN } → sendVideoBGRA
//   { type: 'audio', buffer(ArrayBuffer, FLTP), ch, n, sr }  → sendAudioFLTP
//   { type: 'stop' }                                         → destroy
//
// Identische Mechanik wie der NDI-Sender des JM Titler — bewusst dupliziert, weil
// jede App ihren utilityProcess selbst bündelt (kein gemeinsames .cjs).
import * as ndi from '@jm/ndi';

type Msg =
  | { type: 'init'; name: string }
  | { type: 'video'; buffer: ArrayBuffer; w: number; h: number; fpsN: number }
  | { type: 'audio'; buffer: ArrayBuffer; ch: number; n: number; sr: number }
  | { type: 'diag'; msg: string }
  | { type: 'stop' };

let started = false;
let videoFrames = 0;
let audioChunks = 0;

process.parentPort.on('message', (e) => {
  const d = e.data as Msg | null;
  if (!d || typeof d !== 'object') return;

  if (d.type === 'init') {
    try {
      ndi.init();
      ndi.createSender(d.name);
      started = true;
      console.log('[ndi-send] NDI-Ausgabe aktiv:', d.name);
      // Wachhund: der Sender ist im Netz sichtbar, auch wenn der Renderer keine Frames liefert.
      // Empfänger sehen dann „verbunden, kein Bild" — hier soll das laut werden.
      setTimeout(() => {
        if (videoFrames === 0) {
          console.log('[ndi-send] WARNUNG: 3 s ohne Videoframe vom Renderer — die Ausgabe-Pumpe liefert nichts.');
        }
      }, 3000);
    } catch (err) {
      started = false;
      console.error('[ndi-send] init/createSender fehlgeschlagen:', err);
    }
    return;
  }

  // Diagnose des Renderers (er hat keine sichtbare Konsole) → ins Terminal.
  if (d.type === 'diag') {
    console.log('[ndi-send] Renderer meldet:', d.msg);
    return;
  }

  if (!started) return;

  if (d.type === 'video') {
    if (videoFrames === 0) console.log(`[ndi-send] erstes Videoframe vom Renderer (${d.w}x${d.h}) → sendVideoBGRA`);
    ndi.sendVideoBGRA(new Uint8Array(d.buffer), d.w, d.h, d.fpsN, 1);
    videoFrames++;
    // ~1×/s die Empfängerzahl an den Main melden (für die Statusanzeige).
    if (videoFrames % 30 === 0) {
      const connections = ndi.connections();
      process.parentPort.postMessage({ type: 'stat', connections });
    }
  } else if (d.type === 'audio') {
    // Programm-Ton mit ausspielen: bis dahin war die NDI-Quelle stumm — jeder Empfänger
    // (JM Connect-Rückkanal, OBS, vMix, Recorder) bekam nur Bild.
    if (audioChunks === 0) console.log(`[ndi-send] erster Audio-Chunk vom Renderer (${d.ch}ch ${d.sr}Hz) → sendAudioFLTP`);
    audioChunks++;
    ndi.sendAudioFLTP(new Float32Array(d.buffer), d.ch, d.n, d.sr);
  } else if (d.type === 'stop') {
    try {
      ndi.destroy();
    } catch {
      // egal — evtl. nie initialisiert
    }
    started = false;
    console.log('[ndi-send] gestoppt');
  }
});
