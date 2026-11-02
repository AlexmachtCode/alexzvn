// utilityProcess-Entry: EMPFÄNGT die Programm-NDI-Quelle (i. d. R. der Switcher-PGM) und
// leitet die BGRA-Videoframes an den versteckten Peer-Renderer weiter → dort per WebCodecs in
// einen MediaStreamTrackGenerator → als EIN geteilter `program-video`-Track an die SFU → alle
// Gäste sehen das Programm (Rückkanal, Welle 6.2a).
//
// Läuft isoliert (wie apps/switcher/src/utility/ndi-recv.ts), weil ndi.receive() synchron pollt.
// Der native Receiver ist global je Prozess → ein eigener Prozess für den Programm-Empfang.
//
// Nachrichten über parentPort (der Main bridgt Frame-Port ↔ Peer):
//   { type:'start', nameHint }  → @jm/ndi laden, init, „bereit“, dann findSources (Substring-Match) + createReceiver + Poll-Schleife
//   { type:'stop' }             → closeReceiver + destroy
//   { type:'ack' }              → Peer hat das letzte Videoframe verarbeitet (Backpressure)
// An den Main zurück (Plan C, Spec 22.4, E51; der Leser in main/ndi-lage.ts kennt nur diese Leitung):
//   { type:'bereit' }                                            → nach ndi.init(), vor der ersten Suche
//   { type:'abbruch', grund:'addon'|'init', text }               → Laden oder init() scheiterte; text nur fürs Log
//   { type:'lage', zustand, quelle? }                            → alle 500 ms ab „bereit“ (Lebenszeichen, E50); quelle
//                                                                  Pflicht in verbunden, ohneBild, staut und fehler, sonst keine
//   { type:'video', buffer(ArrayBuffer BGRA tight), w, h, fpsN }  → an den Peer-Frame-Port
//   { type:'audio', buffer(ArrayBuffer FLTP), ch, n, sr }         → Peer-Web-Audio-Mixer (6.2b)
// `stopped` meldet der Empfänger nicht mehr (22.4); nach „abbruch“ wartet er, bis der Main ihn beendet (E51).
//
// Backpressure wie im Switcher: nach jedem VIDEO-Frame wartet ein Bild auf den Ack (`wartetSeit`);
// bis der Peer 'ack' schickt, werden weitere Videoframes nur aus dem NDI-Puffer gezogen und verworfen (Latenz niedrig).
// Audio wird NIE verworfen (Lücken wären hörbar) — es ist klein genug.
// Bildwache (22.4, E34, C-EP2): programmBildLage aus main/ndi-lage.ts (rein, mitgebündelt) rechnet alle 500 ms aus den
// Zeitpunkten des Verbindens, des letzten NDI-Videobilds und des wartenden Bilds verbunden, ohneBild oder staut.
// Alle Zeiten auf der monotonen Uhr (E50, PK55).
import type * as NdiModul from '@jm/ndi';
import type { NdiFrame } from '@jm/ndi';
import { programmBildLage } from '../main/ndi-lage';

type Msg = { type: 'start'; nameHint?: string } | { type: 'stop' } | { type: 'ack' };
type LageZustand = 'sucht' | 'keineQuelle' | 'verbunden' | 'ohneBild' | 'staut' | 'fehler';

/** Monotone Uhr (E50, PK55). */
const jetzt = (): number => performance.now();

let ndi: typeof NdiModul | null = null;
let gestartet = false;
let connected = false;
let polling = false;
let stopRequested = false;
let searchTimer: ReturnType<typeof setTimeout> | null = null;
let lageTakt: ReturnType<typeof setInterval> | null = null;
// Leitung und Bildwache: Zustand, Quelle und die Zeitpunkte (monoton).
let zustand: LageZustand = 'sucht';
let quelle: string | null = null;
let verbundenSeit = 0;
let letztesBild: number | null = null;
let wartetSeit: number | null = null;
// Diagnose: liefert die Quelle überhaupt Frames? Werden sie verworfen (Peer ackt nicht)?
let videoRx = 0;
let audioRx = 0;
let videoDropped = 0;
let emptyPolls = 0;

function melde(m: { type: 'bereit' } | { type: 'abbruch'; grund: 'addon' | 'init'; text: string } | { type: 'lage'; zustand: LageZustand; quelle?: string }): void {
  process.parentPort.postMessage(m);
}

function fehlerText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function safeReceive(timeoutMs: number): NdiFrame | null {
  if (!ndi) return null;
  try {
    return ndi.receive(timeoutMs);
  } catch {
    return null;
  }
}

process.parentPort.on('message', (e) => {
  const d = e.data as Msg | null;
  if (!d || typeof d !== 'object') return;
  if (d.type === 'start') handleStart(d.nameHint || 'JM Switcher');
  else if (d.type === 'stop') handleStop();
  else if (d.type === 'ack') wartetSeit = null;
});

/**
 * Erster Auftrag (22.4): @jm/ndi laden, ndi.init(), erst dann „bereit“ und die erste Suche. Daran hängen die Frist bis
 * „bereit“ (E50) und die Grenze zwischen startAbbruch und abbruch {init} (NF8). Ein Prozess, ein Start: Ein Neustart des
 * Empfangs ist ein neuer Prozess (ndi-program.ts).
 */
function handleStart(nameHint: string): void {
  if (gestartet) return;
  gestartet = true;
  stopRequested = false;
  let modul: typeof NdiModul;
  try {
    modul = require('@jm/ndi') as typeof NdiModul;
  } catch (err) {
    melde({ type: 'abbruch', grund: 'addon', text: fehlerText(err) });
    return;
  }
  try {
    modul.init();
  } catch (err) {
    console.error('[ndi-program-receiver] ndi.init fehlgeschlagen:', err);
    melde({ type: 'abbruch', grund: 'init', text: fehlerText(err) });
    return;
  }
  ndi = modul;
  melde({ type: 'bereit' });
  zustand = 'sucht';
  quelle = null;
  lageTakt = setInterval(meldeLage, 500);
  searchLoop(nameHint);
}

/** Lebenszeichen und Lage alle 500 ms (E50); im verbundenen Zustand rechnet die Bildwache (22.4). */
function meldeLage(): void {
  if (stopRequested) return;
  if (connected) zustand = programmBildLage({ jetzt: jetzt(), verbundenSeit, letztesBild, wartetSeit });
  const mitQuelle = zustand === 'verbunden' || zustand === 'ohneBild' || zustand === 'staut' || zustand === 'fehler';
  melde(mitQuelle && quelle !== null ? { type: 'lage', zustand, quelle } : { type: 'lage', zustand });
}

// Die Suche läuft endlos alle 3 s (der Switcher darf später starten). Die Fehlanzeige darf das Log
// deshalb nicht fluten — es ist inzwischen unser Hauptdiagnosemittel. Gemeldet wird die erste
// Fehlanzeige, jede Änderung der Zahl der gesehenen Quellen und danach höchstens alle 30 s.
const MISS_LOG_GAP_MS = 30_000;
let lastMissAt: number | null = null;
let lastMissZahl: number | null = null;

/** Quelle per Namens-Hinweis auflösen (NDI zeigt sie als „<HOST> (JM Switcher)" → Substring). */
function resolveSource(nameHint: string): string | null {
  if (!ndi) return null;
  const seen = new Set<string>();
  // Discovery ist asynchron und akkumuliert → mehrere kurze Runden (wie ndi-recv.ts, Issue #17).
  for (let i = 0; i < 3; i++) {
    for (const s of ndi.findSources(500)) seen.add(s);
    const hit = [...seen].find((s) => s.toLowerCase().includes(nameHint.toLowerCase()));
    if (hit) {
      // Ohne Namen (GG21, E35): den Namen der Quelle zeigt das Programm-Abzeichen (T123–T126), nicht das Log.
      console.log('[ndi-program-receiver] Programm-Quelle gefunden.');
      lastMissAt = null;
      lastMissZahl = null;
      return hit;
    }
  }
  // Diagnose ohne Namen (Plan C, GG21, E35; Spec 0.23: ein NDI-Name kann einen Personennamen enthalten). Seit 0.4.0 tragen
  // frei benannte Zoom-Slots („Zoom 1“ oder ein beliebiger Name, Spec 0.22, E26) keinen Vorsatz „JM Connect – “ mehr; ein Filter darauf
  // ließe ihre Namen ins Log. Darum stehen nur Anzahlen im Log: alle gesehenen Quellen und davon die mit „JM Connect – “ im
  // Namen (Gäste und Übergangs-Slots, Spec Zoom Stage 4, N4b.2). Den Suchnamen zeigt der Tooltip von T122, die gefundene
  // Quelle das Programm-Abzeichen (Nachbesserung C-sicherheit:1, C-code:3; Owner-Frage OFC3).
  const fremde = [...seen].filter((s) => !s.includes('JM Connect – '));
  const anzahl = seen.size;
  const eigene = anzahl - fremde.length;
  const now = jetzt();
  if (anzahl !== lastMissZahl || lastMissAt === null || now - lastMissAt >= MISS_LOG_GAP_MS) {
    lastMissZahl = anzahl;
    lastMissAt = now;
    console.log(`[ndi-program-receiver] Programm-Quelle nicht gefunden, ${anzahl} NDI-Quellen gesehen, ${eigene} davon mit „JM Connect – “ im Namen (Namen nicht im Log).`);
  }
  return null;
}

/** Sucht die Programm-Quelle und verbindet; findet sie sich (noch) nicht, wird ALLE 3 s erneut
 *  gesucht (der Switcher-NDI-Ausgang kann jederzeit später eingeschaltet werden → kein terminales
 *  „notfound" mehr, der Empfang heilt sich selbst). */
function searchLoop(nameHint: string): void {
  if (stopRequested || !ndi) return;
  let source: string | null;
  try {
    source = resolveSource(nameHint);
  } catch (err) {
    // findSources wirft, wenn der NDI-Finder nicht entsteht (packages/ndi/src/addon.cc): wie ein Scheitern von init() ein
    // abbruch {init} mit Text statt eines Absturzes nach „bereit“ (Nachtrag C, M-C8-2). Danach meldet der Empfänger nichts
    // mehr und sucht nicht weiter; er wartet, bis der Main ihn beendet (E51).
    console.error('[ndi-program-receiver] findSources fehlgeschlagen:', err);
    if (lageTakt) {
      clearInterval(lageTakt);
      lageTakt = null;
    }
    melde({ type: 'abbruch', grund: 'init', text: fehlerText(err) });
    return;
  }
  if (stopRequested) return;
  if (source) {
    try {
      const ok = ndi.createReceiver(source);
      if (!ok) {
        zustand = 'fehler';
        quelle = source;
        searchTimer = setTimeout(() => searchLoop(nameHint), 3000);
        return;
      }
      connected = true;
      wartetSeit = null;
      letztesBild = null;
      verbundenSeit = jetzt();
      zustand = 'verbunden';
      quelle = source;
      pump();
    } catch (err) {
      // createReceiver wirft im Fehlerfall (packages/ndi/src/addon.cc, C-EP9): derselbe Zustand wie `false`.
      console.error('[ndi-program-receiver] createReceiver fehlgeschlagen:', err);
      zustand = 'fehler';
      quelle = source;
      searchTimer = setTimeout(() => searchLoop(nameHint), 3000);
    }
    return;
  }
  zustand = 'keineQuelle'; // Badge zeigt „keine Quelle", aber wir suchen weiter
  quelle = null;
  searchTimer = setTimeout(() => searchLoop(nameHint), 3000);
}

function handleStop(): void {
  stopRequested = true;
  if (searchTimer) {
    clearTimeout(searchTimer);
    searchTimer = null;
  }
  if (lageTakt) {
    clearInterval(lageTakt);
    lageTakt = null;
  }
  if (!ndi) return;
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
      if (!frame) {
        // Quelle verbunden, aber sie schickt nichts (z. B. Switcher minimiert → rAF pausiert).
        if (++emptyPolls % 50 === 0 && videoRx === 0) {
          console.log(`[ndi-program-receiver] verbunden, aber KEINE Frames (${emptyPolls} Leerabfragen) — sendet der Switcher wirklich Bild?`);
        }
        break;
      }
      if (frame.type === 'audio') {
        // Programm-Ton (FLTP) → Peer → Web-Audio-Mixer (Mix-Minus, 6.2b). KEIN Ack/Drop: Audio ist
        // klein und darf nicht lückenhaft werden (Video-Backpressure gilt nur für Videoframes).
        if (++audioRx === 1) console.log(`[ndi-program-receiver] erster Audio-Frame: ${frame.channels}ch ${frame.sampleRate}Hz`);
        const f32 = new Float32Array(frame.data); // Kopie in einen frischen ArrayBuffer
        process.parentPort.postMessage({
          type: 'audio',
          buffer: f32.buffer,
          ch: frame.channels,
          n: frame.samples,
          sr: frame.sampleRate,
        });
        continue;
      }
      // Jedes NDI-Videobild zählt für die Bildwache, auch ein verworfenes (22.4).
      letztesBild = jetzt();
      if (wartetSeit !== null) {
        // Peer noch beschäftigt → Frame verwerfen (Latenz niedrig halten). Bleibt der Ack dauerhaft
        // aus, hängt der Peer — die Bildwache meldet dann `staut`.
        if (++videoDropped % 100 === 0) console.log(`[ndi-program-receiver] ${videoDropped} Videoframes verworfen (Peer ackt nicht?)`);
        continue;
      }
      wartetSeit = jetzt();
      if (++videoRx === 1) {
        console.log(`[ndi-program-receiver] erster Video-Frame: ${frame.width}x${frame.height} stride=${frame.lineStride} (tight=${frame.width * 4})`);
      } else if (videoRx % 100 === 0) {
        console.log(`[ndi-program-receiver] Video-Frames von NDI: ${videoRx}`);
      }
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
