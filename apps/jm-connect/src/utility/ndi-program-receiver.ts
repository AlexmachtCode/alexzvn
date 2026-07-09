// utilityProcess-Entry: EMPFÄNGT die Programm-NDI-Quelle (i. d. R. der Switcher-PGM) und
// leitet die BGRA-Videoframes an den versteckten Peer-Renderer weiter → dort per WebCodecs in
// einen MediaStreamTrackGenerator → als EIN geteilter `program-video`-Track an die SFU → alle
// Gäste sehen das Programm (Rückkanal, Welle 6.2a).
//
// Läuft isoliert (wie apps/switcher/src/utility/ndi-recv.ts), weil ndi.receive() synchron pollt.
// Der native Receiver ist global je Prozess → ein eigener Prozess für den Programm-Empfang.
//
// Nachrichten über parentPort (der Main bridgt Frame-Port ↔ Peer):
//   { type:'start', nameHint }  → findSources (Substring-Match) + createReceiver + Poll-Schleife
//   { type:'stop' }             → closeReceiver + destroy
//   { type:'ack' }              → Peer hat das letzte Videoframe verarbeitet (Backpressure)
// An den Main zurück:
//   { type:'status', state, source? }                    → Operator-UI
//   { type:'video', buffer(ArrayBuffer BGRA tight), w, h, fpsN } → an den Peer-Frame-Port
//
// Backpressure wie im Switcher: nach jedem Frame `awaitingAck`; bis der Peer 'ack' schickt,
// werden weitere Videoframes nur aus dem NDI-Puffer gezogen und verworfen (Latenz niedrig).
import * as ndi from '@jm/ndi';
import type { NdiFrame } from '@jm/ndi';

type Msg = { type: 'start'; nameHint?: string } | { type: 'stop' } | { type: 'ack' };

let connected = false;
let polling = false;
let stopRequested = false;
let awaitingAck = false;
let searchTimer: ReturnType<typeof setTimeout> | null = null;

function postStatus(state: string, source?: string): void {
  process.parentPort.postMessage({ type: 'status', state, source });
}

function safeReceive(timeoutMs: number): NdiFrame | null {
  try {
    return ndi.receive(timeoutMs);
  } catch {
    return null;
  }
}

process.parentPort.on('message', (e) => {
  const d = e.data as Msg | null;
  if (!d || typeof d !== 'object') return;
  if (d.type === 'start') void handleStart(d.nameHint || 'JM Switcher');
  else if (d.type === 'stop') handleStop();
  else if (d.type === 'ack') awaitingAck = false;
});

/** Quelle per Namens-Hinweis auflösen (NDI zeigt sie als „<HOST> (JM Switcher)" → Substring). */
function resolveSource(nameHint: string): string | null {
  const seen = new Set<string>();
  // Discovery ist asynchron und akkumuliert → mehrere kurze Runden (wie ndi-recv.ts, Issue #17).
  for (let i = 0; i < 3; i++) {
    for (const s of ndi.findSources(500)) seen.add(s);
    const hit = [...seen].find((s) => s.toLowerCase().includes(nameHint.toLowerCase()));
    if (hit) {
      console.log('[ndi-program-receiver] Programm-Quelle gefunden:', hit);
      return hit;
    }
  }
  // Diagnose: ALLE gesehenen NDI-Quellnamen ausgeben (damit ein Namens-Mismatch sichtbar wird).
  console.log(`[ndi-program-receiver] Hinweis „${nameHint}" nicht gefunden. Gesehene NDI-Quellen:`, [...seen].join(' | ') || '(keine)');
  return null;
}

async function handleStart(nameHint: string): Promise<void> {
  handleStop();
  stopRequested = false;
  postStatus('searching');
  try {
    ndi.init();
  } catch (err) {
    postStatus('error');
    console.error('[ndi-program-receiver] ndi.init fehlgeschlagen:', err);
    return;
  }
  searchLoop(nameHint);
}

/** Sucht die Programm-Quelle und verbindet; findet sie sich (noch) nicht, wird ALLE 3 s erneut
 *  gesucht (der Switcher-NDI-Ausgang kann jederzeit später eingeschaltet werden → kein terminales
 *  „notfound" mehr, der Empfang heilt sich selbst). */
function searchLoop(nameHint: string): void {
  if (stopRequested) return;
  const source = resolveSource(nameHint);
  if (stopRequested) return;
  if (source) {
    try {
      const ok = ndi.createReceiver(source);
      if (!ok) {
        postStatus('error', source);
        searchTimer = setTimeout(() => searchLoop(nameHint), 3000);
        return;
      }
      connected = true;
      awaitingAck = false;
      postStatus('connected', source);
      pump();
    } catch (err) {
      console.error('[ndi-program-receiver] createReceiver fehlgeschlagen:', err);
      searchTimer = setTimeout(() => searchLoop(nameHint), 3000);
    }
    return;
  }
  postStatus('notfound'); // Badge zeigt „keine Quelle", aber wir suchen weiter
  searchTimer = setTimeout(() => searchLoop(nameHint), 3000);
}

function handleStop(): void {
  stopRequested = true;
  if (searchTimer) {
    clearTimeout(searchTimer);
    searchTimer = null;
  }
  if (connected) {
    connected = false;
    try {
      ndi.closeReceiver();
    } catch {
      /* Receiver war evtl. nie offen */
    }
  }
  try {
    ndi.destroy();
  } catch {
    /* egal */
  }
  postStatus('stopped');
}

function pump(): void {
  if (polling) return;
  polling = true;

  const tick = (): void => {
    if (stopRequested || !connected) {
      polling = false;
      return;
    }
    for (let i = 0; i < 4; i++) {
      const frame = safeReceive(60);
      if (!frame) break;
      if (frame.type !== 'video') continue; // Audio wird gedraint (Mix-Minus folgt in 6.2b)
      if (awaitingAck) continue; // Peer noch beschäftigt → Frame verwerfen (Latenz niedrig halten)
      awaitingAck = true;
      process.parentPort.postMessage({
        type: 'video',
        buffer: toTightBgra(frame.data, frame.width, frame.height, frame.lineStride),
        w: frame.width,
        h: frame.height,
        fpsN: frame.fpsD ? Math.round(frame.fpsN / frame.fpsD) : 25,
      });
    }
    setTimeout(tick, 0);
  };
  tick();
}

/**
 * NDI liefert BGRA mit `lineStride` (evtl. Zeilen-Padding). WebCodecs' VideoFrame (in
 * @jm/rtc/frames.bgraToVideoFrame) erwartet tight-gepacktes BGRA (stride = w*4). Bei Padding
 * Zeile für Zeile umkopieren; sonst 1:1 in einen frischen ArrayBuffer (Copy, kein Transfer).
 */
function toTightBgra(data: Uint8Array, w: number, h: number, lineStride: number): ArrayBuffer {
  const tightStride = w * 4;
  const out = new Uint8Array(tightStride * h);
  if (lineStride === tightStride) {
    out.set(data.subarray(0, tightStride * h));
  } else {
    for (let y = 0; y < h; y++) {
      out.set(data.subarray(y * lineStride, y * lineStride + tightStride), y * tightStride);
    }
  }
  return out.buffer;
}
