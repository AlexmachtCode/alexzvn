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
let lastFrameAt = 0;
let stallWarned = false;
let watchdog: ReturnType<typeof setInterval> | null = null;

// Der Sender ist im NDI-Netz sichtbar, sobald er existiert. Bleibt die Pumpe stumm oder friert
// sie nach ein paar Bildern ein, sehen Empfänger „verbunden, aber Standbild" — und nichts sagt
// einem, woran es liegt. Genau das kostete beim Switcher (rAF-Drosselung) und hier (verstecktes
// Peer-Fenster ohne `backgroundThrottling:false`) je eine Debug-Runde. Muster: switcher ndi-send.ts.
function startWatchdog(): void {
  setTimeout(() => {
    if (started && videoFrames === 0) {
      console.log('[ndi-guest-sender] WARNUNG: 3 s ohne Videoframe vom Peer — die Pumpe liefert nichts.');
    }
  }, 3000);
  watchdog = setInterval(() => {
    if (!started || videoFrames === 0) return;
    if (Date.now() - lastFrameAt > 3000) {
      if (!stallWarned) {
        stallWarned = true;
        console.log(`[ndi-guest-sender] WARNUNG: Bild steht (${videoFrames} Frames gesendet, dann Stillstand).`);
      }
    } else if (stallWarned) {
      stallWarned = false;
      console.log('[ndi-guest-sender] Bild läuft wieder.');
    }
  }, 1000);
  watchdog.unref?.();
}

process.parentPort.on('message', (e) => {
  const d = e.data as Msg | null;
  if (!d || typeof d !== 'object') return;

  if (d.type === 'init') {
    try {
      ndi.init();
      ndi.createSender(d.name);
      started = true;
      console.log('[ndi-guest-sender] NDI-Sender aktiv:', d.name);
      startWatchdog();
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
    lastFrameAt = Date.now();
    if (videoFrames % 30 === 0) {
      process.parentPort.postMessage({ type: 'stat', connections: ndi.connections() });
    }
  } else if (d.type === 'audio') {
    ndi.sendAudioFLTP(new Float32Array(d.buffer), d.ch, d.n, d.sr);
  } else if (d.type === 'stop') {
    if (watchdog) clearInterval(watchdog);
    watchdog = null;
    ndi.destroy();
    started = false;
    console.log('[ndi-guest-sender] gestoppt');
  }
});
