// utilityProcess-Entry: EIN nativer NDI-Sender für EINE Gast-Quelle.
// Der ndi-guests-Pool im Main forkt je Quelle einen solchen Prozess (löst die
// „ein Sender pro Prozess"-Regel von @jm/ndi) und bridgt die vom versteckten
// Peer-Renderer dekodierten Frames hierher.
//
// Nachrichten über parentPort (der Main bridgt den Peer-Frame-Port weiter):
//   { type: 'init',  name }                                  → @jm/ndi laden, init + createSender
//   { type: 'video', buffer(ArrayBuffer, BGRA), w, h, fpsN } → sendVideoBGRA
//   { type: 'audio', buffer(ArrayBuffer, FLTP), ch, n, sr }  → sendAudioFLTP
//   { type: 'stop' }                                         → destroy
// An den Main zurück, nur diese Leitung (Plan C, Spec 22.3, E51; der Leser in main/ndi-lage.ts kennt nur sie):
//   { type: 'bereit' }                                       → nach init() und createSender()
//   { type: 'abbruch', grund: 'addon'|'init'|'sender', text } → Laden, init() oder createSender() scheiterte; text nur fürs Log
//   { type: 'stat', connections }                            → ab „bereit“ jede Sekunde (Lebenszeichen, E50)
// Nach „abbruch“ wartet der Prozess, bis der Main ihn beendet (kein process.exit, E51).
//
// @jm/ndi wird erst im Auftrag geladen (Plan C, E32): Der Lader wirft schon beim Laden, wenn Addon oder NDI-Laufzeit
// fehlen (packages/ndi/index.js). Oben steht darum nur `import type`; geladen wird mit `require` in try/catch, denn das
// Bündel ist CommonJS (electron.vite.config.ts) und `module.exports` des Laders ist das Addon selbst.
import type * as NdiModul from '@jm/ndi';

type Msg =
  | { type: 'init'; name: string }
  | { type: 'video'; buffer: ArrayBuffer; w: number; h: number; fpsN: number }
  | { type: 'audio'; buffer: ArrayBuffer; ch: number; n: number; sr: number }
  | { type: 'stop' };

type Meldung =
  | { type: 'bereit' }
  | { type: 'abbruch'; grund: 'addon' | 'init' | 'sender'; text: string }
  | { type: 'stat'; connections: number };

/** Monotone Uhr (E50, PK55): ein Sprung der Wanduhr löst keine Warnung aus und macht keine taub. */
const jetzt = (): number => performance.now();

let ndi: typeof NdiModul | null = null;
let started = false;
let videoFrames = 0;
let lastFrameAt = 0;
let stallWarned = false;
let watchdog: ReturnType<typeof setInterval> | null = null;
let statTakt: ReturnType<typeof setInterval> | null = null;

function melde(m: Meldung): void {
  process.parentPort.postMessage(m);
}

function fehlerText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// Der Sender ist im NDI-Netz sichtbar, sobald er existiert. Bleibt die Pumpe stumm oder friert
// sie nach ein paar Bildern ein, sehen Empfänger „verbunden, aber Standbild" — und nichts sagt
// einem, woran es liegt. Genau das kostete beim Switcher (rAF-Drosselung) und hier (verstecktes
// Peer-Fenster ohne `backgroundThrottling:false`) je eine Debug-Runde. Muster: switcher ndi-send.ts.
// Plan C: Der Wachhund bleibt eine Logzeile; den Zustand „kein Bild“ führt die Lage im Main (22.3 Nr. 7).
function startWatchdog(): void {
  setTimeout(() => {
    if (started && videoFrames === 0) {
      console.log('[ndi-guest-sender] WARNUNG: 3 s ohne Videoframe vom Peer — die Pumpe liefert nichts.');
    }
  }, 3000);
  watchdog = setInterval(() => {
    if (!started || videoFrames === 0) return;
    if (jetzt() - lastFrameAt > 3000) {
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

/** Erster Auftrag: @jm/ndi laden, init() und createSender(); jede Stufe meldet ihr Scheitern mit Grund (22.3, E51). */
function starte(name: string): void {
  if (ndi) return; // ein Prozess, ein Sender
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
    melde({ type: 'abbruch', grund: 'init', text: fehlerText(err) });
    return;
  }
  try {
    modul.createSender(name);
  } catch (err) {
    melde({ type: 'abbruch', grund: 'sender', text: fehlerText(err) });
    return;
  }
  ndi = modul;
  started = true;
  melde({ type: 'bereit' });
  // N4b.2: Der Sendername trägt den Gastnamen. Die Kennung steht schon im Präfix, das ndi-guests.ts voranstellt.
  console.log('[ndi-guest-sender] NDI-Sender aktiv.');
  startWatchdog();
  // Lebenszeichen (E50): jede Sekunde die Zahl der Empfänger, auch ohne Bild (vorher nur nach je 30 Bildern).
  statTakt = setInterval(() => {
    if (started && ndi) melde({ type: 'stat', connections: ndi.connections() });
  }, 1000);
}

process.parentPort.on('message', (e) => {
  const d = e.data as Msg | null;
  if (!d || typeof d !== 'object') return;

  if (d.type === 'init') {
    starte(d.name);
    return;
  }

  if (!started || !ndi) return;

  if (d.type === 'video') {
    ndi.sendVideoBGRA(new Uint8Array(d.buffer), d.w, d.h, d.fpsN, 1);
    videoFrames++;
    lastFrameAt = jetzt();
  } else if (d.type === 'audio') {
    ndi.sendAudioFLTP(new Float32Array(d.buffer), d.ch, d.n, d.sr);
  } else if (d.type === 'stop') {
    if (watchdog) clearInterval(watchdog);
    if (statTakt) clearInterval(statTakt);
    watchdog = null;
    statTakt = null;
    ndi.destroy();
    started = false;
    console.log('[ndi-guest-sender] gestoppt');
  }
});
