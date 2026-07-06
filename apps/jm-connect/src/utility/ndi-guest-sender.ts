// utilityProcess-Entry: EIN nativer NDI-Sender für EINEN freigegebenen Gast.
// Der ndi-guests-Pool im Main forkt je Gast einen solchen Prozess (löst die
// „ein Sender pro Prozess"-Regel von @jm/ndi) und bridgt die vom versteckten
// Peer-Renderer dekodierten Frames hierher.
//
// Nachrichten über parentPort (der Main bridgt den Peer-Frame-Port weiter):
//   { type: 'init',  name }                                  → init + createSender
//   { type: 'video', buffer(ArrayBuffer, BGRA), w, h, fpsN } → sendVideoBGRA
//   { type: 'audio', buffer(ArrayBuffer, FLTP), ch, n, sr }  → sendAudioFLTP
//   { type: 'stop' }                                         → destroy
import * as ndi from '@jm/ndi';

type Msg =
  | { type: 'init'; name: string }
  | { type: 'video'; buffer: ArrayBuffer; w: number; h: number; fpsN: number }
  | { type: 'audio'; buffer: ArrayBuffer; ch: number; n: number; sr: number }
  | { type: 'stop' };

let started = false;
let videoFrames = 0;

process.parentPort.on('message', (e) => {
  const d = e.data as Msg | null;
  if (!d || typeof d !== 'object') return;

  if (d.type === 'init') {
    try {
      ndi.init();
      ndi.createSender(d.name);
      started = true;
      console.log('[ndi-guest-sender] NDI-Sender aktiv:', d.name);
    } catch (err) {
      started = false;
      console.error('[ndi-guest-sender] init/createSender fehlgeschlagen:', err);
    }
    return;
  }

  if (!started) return;

  if (d.type === 'video') {
    ndi.sendVideoBGRA(new Uint8Array(d.buffer), d.w, d.h, d.fpsN, 1);
    videoFrames++;
    if (videoFrames % 30 === 0) {
      process.parentPort.postMessage({ type: 'stat', connections: ndi.connections() });
    }
  } else if (d.type === 'audio') {
    ndi.sendAudioFLTP(new Float32Array(d.buffer), d.ch, d.n, d.sr);
  } else if (d.type === 'stop') {
    ndi.destroy();
    started = false;
    console.log('[ndi-guest-sender] gestoppt');
  }
});
