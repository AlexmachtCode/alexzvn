import type { BrowserWindow } from 'electron';
import path from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import type * as AudioNS from '@jm/audio';
import {
  ERST_AUFNAHME_STOPPEN,
  FERNBEFEHL_ABGELEHNT,
  type ArmInput,
  type AudioDevice,
  type OpResult,
  type RecordInput,
  type RecordResult,
  type RecorderFehler,
  type RecorderState,
  type ScheduleInput,
} from '../shared/types';
import { MultiWavWriter, WavWriter } from './wav';
import { freierBasisname } from './dateiname';
import { BLOECKE_TAKT_MS, bloeckeLage } from './eingang-waechter';
import { istLoopback, StilleUhr, STILLE_PAUSE_MS, STILLE_TAKT_MS } from './stille';

// Lazy-Load des nativen Addons: das Fenster startet auch ohne gebautes @jm/audio
// (z. B. im Codespace). Erst beim ersten Geräte-/Aufnahme-Zugriff geladen.
let audioMod: typeof AudioNS | null = null;
let inited = false;
function engine(): typeof AudioNS {
  if (!audioMod) {
    audioMod = require('@jm/audio') as typeof AudioNS;
  }
  if (!inited) {
    audioMod.init();
    inited = true;
  }
  return audioMod;
}

let getWin: () => BrowserWindow | null = () => null;
export function setWindowGetter(fn: () => BrowserWindow | null): void {
  getWin = fn;
}

const state: RecorderState = {
  status: 'idle',
  device: null,
  channels: 0,
  sampleRate: 0,
  filePath: null,
  recordedSec: 0,
  scheduledStartAt: null,
  scheduledStopAt: null,
  fehler: null,
  spuren: false,
};
let writer: WavWriter | null = null;
let multiWriter: MultiWavWriter | null = null;
/** Fix-Runde 1 (Ruling R18b): Ordner der Einzelspuren der laufenden Aufnahme (für die Meldung, wenn ihr Kopf scheitert); null ohne Spuren. */
let spurenOrdner: string | null = null;
let peaks: number[] = [];
let lastEmit = 0;
// Loopback-Eingänge: kein Block in Stille → Uhr + Wächter füllen die Lücken auf.
let loopback = false;
let uhr: StilleUhr | null = null;
let waechter: ReturnType<typeof setInterval> | null = null;
let letzterBlockMs = 0;
// Letzter Wächtertakt: liegt er ≥ STILLE_PAUSE_MS zurück, hing die Ereignisschleife (Stau, keine Stille).
let letzterTaktMs = 0;
// Altfehler RE-3 (B1): Block-Wächter nur in der Aufnahme an einem Eingang, der kein Loopback ist; sein letzter Takt (Stau-Erkennung).
let blockWaechter: ReturnType<typeof setInterval> | null = null;
let letzterBlockTaktMs = 0;

/**
 * Altfehler RE-3 (D3): Logzeile einer Aufnahme, die mit einem Fehler endete. main/ipc.ts hängt hier getLog().warn ein; dieses Modul bleibt
 * ohne @jm/app-runtime und damit unter tsx testbar. Standard: nichts.
 */
let protokoll: (zeile: string) => void = () => {};
export function setProtokoll(f: (zeile: string) => void): void {
  protokoll = f;
}

/**
 * Altfehler RE-3: Meldung bis „OK“ (recorder:notice) und Logzeile, wenn eine Aufnahme mit einem Fehler endet (Pre-flight K4: benannte
 * Konstante im Hauptprozess). `eingangGrund` ist der Text des Fehlerfelds bei 2 s ohne Audiodaten (B1).
 */
export const AUFNAHME_FEHLER_TEXTE = {
  schreiben: (datei: string, grund: string): string => `Aufnahme beendet: Schreibfehler in „${datei}“: ${grund}. Das bisher Aufgenommene ist gespeichert.`,
  kopf: (datei: string, grund: string): string => `Aufnahme beendet: Der Dateikopf von „${datei}“ konnte nicht geschrieben werden: ${grund}.`,
  eingang: 'Aufnahme beendet: Vom Eingang kamen 2 s lang keine Audiodaten. Das bisher Aufgenommene ist gespeichert.',
  eingangGrund: 'Keine Audiodaten vom Eingang',
  log: (art: RecorderFehler['art'], datei: string, grund: string): string => `Aufnahme beendet (${art}): ${datei}: ${grund}`,
} as const;

const grundVon = (e: unknown): string => (e instanceof Error ? e.message : String(e));
// Aufnahme-Verstärkung (#94): linearer Faktor, der je Audioblock VOR Pegel-
// messung und Schreiben angewandt wird → der Meter zeigt den verstärkten Pegel.
let gainFactor = 1;

/** Aufnahme-Gain in dB setzen (geklemmt). 0 dB = unverändert. */
export function setGain(db: number): void {
  const clamped = Math.max(-24, Math.min(36, Number.isFinite(db) ? db : 0));
  gainFactor = Math.pow(10, clamped / 20);
}

// Zeitgesteuerte Aufnahme (Slice C3): Timer + gemerkter Aufnahme-Input.
let startTimer: ReturnType<typeof setTimeout> | null = null;
let stopTimer: ReturnType<typeof setTimeout> | null = null;
let pendingInput: RecordInput | null = null;

function send(channel: string, payload: unknown): void {
  const win = getWin();
  if (!win || win.isDestroyed()) return;
  const wc = win.webContents;
  if (!wc.isDestroyed()) wc.send(channel, payload);
}

// Zustands-Listener (z. B. der TCP-Steuerserver für den Companion-STATE-Push).
const stateListeners = new Set<() => void>();
export function onStateChange(cb: () => void): () => void {
  stateListeners.add(cb);
  return () => stateListeners.delete(cb);
}

function emitState(): void {
  send('recorder:state', { ...state });
  for (const cb of stateListeners) cb();
}
function notice(msg: string): void {
  send('recorder:notice', msg);
}

export function getState(): RecorderState {
  return { ...state };
}

export function listDevices(): AudioDevice[] {
  return engine()
    .listDevices()
    .filter((d) => d.maxInputChannels > 0)
    .map((d) => ({
      index: d.index,
      name: d.name,
      hostApiName: d.hostApiName,
      maxInputChannels: d.maxInputChannels,
      defaultSampleRate: Math.round(d.defaultSampleRate),
    }));
}

// Läuft je Audioblock (TSFN → Node-Loop): Pegel sammeln, ggf. schreiben,
// gedrosselt Pegel/State an den Renderer senden.
function onFrames(planar: Float32Array, channels: number, frames: number): void {
  letzterBlockMs = Date.now();
  // Gain zuerst auf den ganzen Block anwenden (in place) → Pegel + Datei zeigen/
  // schreiben den verstärkten Ton. 32-bit-Float-WAV behält Werte >1 (kein Hard-
  // Clip in der Datei); der Meter warnt rot ab ~0 dBFS.
  if (gainFactor !== 1) {
    for (let i = 0; i < planar.length; i++) planar[i] *= gainFactor;
  }
  if (peaks.length !== channels) peaks = new Array(channels).fill(0);
  for (let c = 0; c < channels; c++) {
    let p = peaks[c];
    const base = c * frames;
    for (let i = 0; i < frames; i++) {
      const v = Math.abs(planar[base + i]);
      if (v > p) p = v;
    }
    peaks[c] = p;
  }

  if (state.status === 'recording' && writer) {
    // Altfehler RE-3 (B2): kein Schreibfehler erreicht das Addon (die JS-Ausnahme bliebe als offene N-API-Ausnahme stehen, jeder weitere
    // Block würfe wieder); die Aufnahme endet sauber über schreibfehler.
    try {
      // Loopback: erst die fehlende Stille vor diesem Block, dann der echte Block.
      if (uhr) {
        const n = uhr.block(frames, letzterBlockMs);
        if (n > 0) schreibeStille(n);
      }
      writer.writeBlock(planar, channels, frames);
      multiWriter?.writeBlock(planar, channels, frames);
      state.recordedSec += frames / (state.sampleRate || 1);
    } catch (e) {
      schreibfehler('schreiben', e);
    }
  }

  const now = Date.now();
  if (now - lastEmit >= 50) {
    send('recorder:levels', { peaks: peaks.slice() });
    if (state.status === 'recording') emitState();
    peaks = new Array(channels).fill(0);
    lastEmit = now;
  }
  // Nach dem Schreiben: ein langsames writeSync (USB-Stick, NAS) zählt nicht als Pause.
  letzterBlockMs = Date.now();
}

// Nullen in Stücken ≤ 1 s an beide Writer; zählt recordedSec und die Uhr mit.
function schreibeStille(n: number): void {
  if (!writer || n <= 0) return;
  let rest = n;
  while (rest > 0) {
    const k = Math.min(rest, Math.max(1, state.sampleRate));
    const nullen = new Float32Array(state.channels * k);
    writer.writeBlock(nullen, state.channels, k);
    multiWriter?.writeBlock(nullen, state.channels, k);
    state.recordedSec += k / (state.sampleRate || 1);
    uhr?.aufgefuellt(k);
    rest -= k;
  }
}

// Wächter: `fehlend` (bestätigt die Pause). Stopp/Abbau: `fehlendBeimStopp` (echter letzter Block).
function stilleBisJetzt(beimStopp = false): void {
  if (!uhr || state.status !== 'recording') return;
  const jetzt = Date.now();
  schreibeStille(beimStopp ? uhr.fehlendBeimStopp(jetzt) : uhr.fehlend(jetzt));
}

function stopWaechter(): void {
  if (waechter) {
    clearInterval(waechter);
    waechter = null;
  }
}

// Wächter: bleiben Blöcke aus, fällt der Pegel auf 0 und die Aufnahme füllt Stille auf.
function waechterTakt(): void {
  const jetzt = Date.now();
  const stau = jetzt - letzterTaktMs >= STILLE_PAUSE_MS;
  letzterTaktMs = jetzt;
  if (stau) {
    // Die Ereignisschleife hing: die Blöcke dieser Zeit liegen gepuffert und kommen gleich.
    // Grundlinie neu, in diesem Takt weder auffüllen noch Null-Pegel.
    letzterBlockMs = jetzt;
    uhr?.weiter(jetzt);
    return;
  }
  if (jetzt - letzterBlockMs < STILLE_PAUSE_MS) return;
  send('recorder:levels', { peaks: new Array(state.channels).fill(0) });
  if (state.status === 'recording') {
    try {
      stilleBisJetzt();
    } catch (e) {
      // Altfehler RE-3: ein Schreibfehler beim Auffüllen beendet die Aufnahme wie ein Schreibfehler im Block (eine Meldung, eine Logzeile;
      // bisher lief sie ohne Auffüllen weiter).
      schreibfehler('schreiben', e);
      return;
    }
    emitState();
  }
}

function stopBlockWaechter(): void {
  if (blockWaechter) {
    clearInterval(blockWaechter);
    blockWaechter = null;
  }
}

// Altfehler RE-3 (B1): Block-Wächter. Hing die Ereignisschleife (Stau), beginnt die Grundlinie neu; 2 s ohne Block beenden die Aufnahme.
function blockTakt(): void {
  if (state.status !== 'recording') return;
  const jetzt = Date.now();
  const lage = bloeckeLage({ jetzt, letzterBlock: letzterBlockMs, letzterTakt: letzterBlockTaktMs });
  letzterBlockTaktMs = jetzt;
  if (lage === 'stau') {
    letzterBlockMs = jetzt;
    return;
  }
  if (lage === 'fehlen') schreibfehler('eingang', new Error(AUFNAHME_FEHLER_TEXTE.eingangGrund));
}

/**
 * Altfehler RE-3 (B2, D3): die Aufnahme endet sauber nach einem Schreibfehler (`schreiben`, mit `kopf` beim Stopp) oder ohne Blöcke vom
 * Eingang (`eingang`): keine Stille mehr auffüllen, Block-Wächter und geplante Start- und Stopp-Zeitgeber lösen, beide Schreiber je für
 * sich abschließen, Status `armed` (der Eingang bleibt offen), das Fehlerfeld setzen, eine Meldung bis „OK“, eine Logzeile, Zustand an
 * Fenster und Steuerserver. Companion sieht recording=0; main/control-server.ts ändert sich nicht.
 */
function schreibfehler(art: RecorderFehler['art'], e: unknown, kopf = false, genannt?: string): void {
  if (state.status !== 'recording') return;
  const T = AUFNAHME_FEHLER_TEXTE;
  // Fix-Runde 1 (Ruling R18b): scheiterte nicht die Kombidatei, sondern etwas anderes (der Kopf der Spuren), nennen Meldung, Log und
  // Fehlerfeld das, was scheiterte.
  const datei = genannt ?? state.filePath ?? '';
  const grund = art === 'eingang' ? T.eingangGrund : grundVon(e);
  let kopfGrund: string | null = kopf ? grund : null;
  uhr = null;
  stopBlockWaechter();
  clearTimers();
  state.scheduledStartAt = null;
  state.scheduledStopAt = null;
  pendingInput = null;
  if (writer) {
    try {
      writer.finalize();
    } catch (fin) {
      // Auch der Kopf ließ sich nicht schreiben: die Meldung sagt das, statt „gespeichert“ zu behaupten.
      kopfGrund = grundVon(fin);
    }
    writer = null;
  }
  if (multiWriter) {
    try {
      multiWriter.finalize();
    } catch {
      // eine Spur bricht das Abschließen der übrigen nicht ab
    }
    multiWriter = null;
  }
  state.status = 'armed';
  state.fehler = { art, text: grund, datei: genannt ?? state.filePath };
  notice(kopfGrund !== null ? T.kopf(datei, kopfGrund) : art === 'eingang' ? T.eingang : T.schreiben(datei, grund));
  protokoll(T.log(art, datei, grund));
  emitState();
}

export function arm(input: ArmInput): OpResult {
  // Altfehler RE-2 (B6): nie eine laufende Aufnahme beenden. Der Renderer lehnt einen Fernbefehl ARM schon ab; dieser Wächter fängt
  // den Wettlauf, in dem ein ARM kurz nach RECORD ON ankommt, bevor das Fenster „recording“ kennt.
  if (state.status === 'recording') return { ok: false, error: ERST_AUFNAHME_STOPPEN };
  try {
    if (state.status !== 'idle') disarm();
    engine().openInput(
      { device: input.device, channels: input.channels, sampleRate: input.sampleRate },
      onFrames,
    );
    // Loopback-Erkennung am Gerätenamen; ein Fehler beim Nachschlagen heißt: kein Loopback.
    try {
      const dev = engine().listDevices().find((d) => d.index === input.device);
      loopback = dev ? istLoopback(dev.name) : false;
    } catch {
      loopback = false;
    }
    letzterBlockMs = Date.now();
    if (loopback) {
      letzterTaktMs = Date.now();
      waechter = setInterval(waechterTakt, STILLE_TAKT_MS);
      waechter.unref?.();
    }
    state.status = 'armed';
    state.device = input.device;
    state.channels = input.channels;
    state.sampleRate = input.sampleRate;
    state.filePath = null;
    state.recordedSec = 0;
    peaks = new Array(input.channels).fill(0);
    emitState();
    return { ok: true };
  } catch (e) {
    state.status = 'idle';
    emitState();
    return { ok: false, error: (e as Error).message };
  }
}

export function disarm(): void {
  stopWaechter();
  stopBlockWaechter();
  try {
    stilleBisJetzt(true); // Lücke bis zum Ende füllen, bevor der Writer schließt
  } catch {
    // Fehler ignorieren: finalize und stopInput müssen immer laufen
  }
  uhr = null;
  loopback = false;
  letzterBlockMs = 0;
  clearTimers(); // geplante Aufnahmen verfallen mit dem Eingang
  state.scheduledStartAt = null;
  state.scheduledStopAt = null;
  pendingInput = null;
  if (writer) {
    try {
      writer.finalize();
    } catch {
      // ignore
    }
    writer = null;
  }
  if (multiWriter) {
    try {
      multiWriter.finalize();
    } catch {
      // ignore: der Eingang muss trotzdem schließen
    }
    multiWriter = null;
  }
  try {
    if (audioMod && inited) audioMod.stopInput();
  } catch {
    // ignore
  }
  state.status = 'idle';
  state.filePath = null;
  state.recordedSec = 0;
  state.spuren = false;
  emitState();
}

/**
 * „Eingang schließen“ aus Fenster und Fernsteuerung (`rec:disarm`, Altfehler RE-2): in der Aufnahme abgelehnt, beenden geht nur mit
 * Stopp; sonst wie `disarm()`. `disarm()` selbst bleibt für `shutdown()` (Fenster zu) und das Neuöffnen in `arm()`.
 */
export function schliesseEingang(): OpResult {
  if (state.status === 'recording') return { ok: false, error: ERST_AUFNAHME_STOPPEN };
  // Altfehler RE-3 (Pre-flight K7): „Eingang schließen“ des Bedieners löscht das Fehlerfeld; `disarm()` (Neuöffnen in arm, shutdown) nicht.
  state.fehler = null;
  disarm();
  return { ok: true };
}

/**
 * Altfehler RE-2, Ruling R11: hat der Wächter in `arm` oder `schliesseEingang` einen Fernbefehl im Wettlauf abgelehnt (das Fenster hielt
 * die Aufnahme noch nicht für laufend), nennt dies Logzeile und Hinweis wie die Ablehnung im Store; main/ipc.ts schreibt die Zeile mit
 * getLog().warn und zeigt den Hinweis bis „OK“. Sonst null.
 */
export function wettlaufAblehnung(verb: 'ARM' | 'DISARM', r: OpResult): { log: string; hinweis: string } | null {
  if (r.ok || r.error !== ERST_AUFNAHME_STOPPEN) return null;
  return { log: FERNBEFEHL_ABGELEHNT.log(verb, FERNBEFEHL_ABGELEHNT.logAufnahmeLaeuft), hinweis: FERNBEFEHL_ABGELEHNT.hinweis(verb, ERST_AUFNAHME_STOPPEN) };
}

function defaultName(): string {
  const d = new Date();
  const p = (n: number): string => String(n).padStart(2, '0');
  return `Aufnahme-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
function sanitize(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, ' ').trim() || defaultName();
}

export function startRecording(input: RecordInput): OpResult {
  if (state.status !== 'armed') return { ok: false, error: 'Erst den Eingang öffnen (Arm).' };
  try {
    // Ein laufender Start erfüllt eine evtl. geplante Startzeit.
    if (startTimer) {
      clearTimeout(startTimer);
      startTimer = null;
    }
    state.scheduledStartAt = null;
    mkdirSync(input.dir, { recursive: true });
    const gewuenscht = input.fileName?.trim() ? sanitize(input.fileName) : defaultName();
    // Nie überschreiben (#291): Gibt es die Datei schon, läuft die Aufnahme als Name-2, Name-3 …
    const base = freierBasisname(input.dir, gewuenscht, existsSync);
    if (base !== gewuenscht) notice(`„${gewuenscht}.wav“ gibt es schon – die Aufnahme läuft als „${base}.wav“.`);
    const filePath = path.join(input.dir, `${base}.wav`);
    writer = new WavWriter(filePath, state.channels, state.sampleRate);
    // Optional zusätzlich jede Spur einzeln in einen Unterordner (Issue #20). Bei
    // Mono gibt es nichts zu trennen — die Kombi-Datei ist bereits die eine Spur.
    spurenOrdner = null;
    if (input.separateTracks && state.channels > 1) {
      const tracksDir = path.join(input.dir, `${base}-Spuren`);
      mkdirSync(tracksDir, { recursive: true });
      multiWriter = new MultiWavWriter(tracksDir, base, state.channels, state.sampleRate);
      spurenOrdner = tracksDir;
    }
    state.filePath = filePath;
    state.recordedSec = 0;
    // Altfehler RE-PLATZ: gemessen, ob Spuren geschrieben werden (der Wunsch im Fenster kann sich in der Aufnahme ändern).
    state.spuren = multiWriter !== null;
    uhr = loopback ? new StilleUhr(state.sampleRate, Date.now()) : null;
    // Altfehler RE-3 (B1): Block-Wächter nur an einem Eingang, der kein Loopback ist; die Frist beginnt mit dem Start.
    stopBlockWaechter();
    if (!loopback) {
      letzterBlockMs = Date.now();
      letzterBlockTaktMs = Date.now();
      blockWaechter = setInterval(blockTakt, BLOECKE_TAKT_MS);
      blockWaechter.unref?.();
    }
    // Pre-flight K7: ein gelungener Start löscht das Fehlerfeld.
    state.fehler = null;
    state.status = 'recording';
    emitState();
    return { ok: true };
  } catch (e) {
    // Altfehler RE-3 (B2): auch ein gescheiterter Start setzt das Fehlerfeld (für einen unbesetzten Rechner).
    const grund = grundVon(e);
    state.fehler = { art: 'start', text: grund, datei: null };
    emitState();
    return { ok: false, error: grund };
  }
}

export function stopRecording(): RecordResult {
  if (state.status !== 'recording' || !writer) {
    // Altfehler RE-3 (Pre-flight K7): ein Stopp im Fehlerzustand quittiert das Fehlerfeld (ok, ohne Datei).
    if (state.fehler !== null && state.status !== 'recording') {
      state.fehler = null;
      emitState();
      return { ok: true };
    }
    return { ok: false, error: 'Keine laufende Aufnahme.' };
  }
  stopBlockWaechter();
  // Manueller Stopp hebt einen ausstehenden Auto-Stopp auf.
  if (stopTimer) {
    clearTimeout(stopTimer);
    stopTimer = null;
  }
  state.scheduledStopAt = null;
  const filePath = state.filePath ?? '';
  try {
    stilleBisJetzt(true); // Lücke bis zum Stopp füllen
  } catch {
    // weiter mit finalize
  }
  uhr = null;
  let res: ReturnType<WavWriter['finalize']>;
  try {
    res = writer.finalize();
  } catch (e) {
    // Altfehler RE-3: der Kopf ließ sich nicht schreiben. Derselbe Weg wie ein Schreibfehler (Spuren abschließen, `armed`, Fehlerfeld,
    // Meldung „Der Dateikopf … konnte nicht geschrieben werden“, Logzeile); bisher nur ein Toast des Stores.
    writer = null;
    schreibfehler('schreiben', e, true);
    return { ok: false, error: grundVon(e) };
  }
  writer = null;
  if (multiWriter) {
    // Fix-Runde 1 (Ruling R18b): die Spuren genau einmal abschließen (schreibfehler sieht sie danach nicht mehr). Scheitert ihr Kopf, ist die
    // Kombidatei schon fertig: die Meldung nennt den Ordner der Spuren, nicht die Kombidatei.
    const spuren = multiWriter;
    multiWriter = null;
    try {
      spuren.finalize();
    } catch (e) {
      schreibfehler('schreiben', e, true, spurenOrdner ?? filePath);
      return { ok: false, error: grundVon(e) };
    }
  }
  state.status = 'armed';
  emitState();
  return {
    ok: true,
    filePath,
    files: res.files,
    bytes: res.bytes,
    durationSec: res.durationSec,
    channels: state.channels,
    sampleRate: state.sampleRate,
  };
}

// ---- Zeitgesteuerte Aufnahme (C3) ----

function clearTimers(): void {
  if (startTimer) {
    clearTimeout(startTimer);
    startTimer = null;
  }
  if (stopTimer) {
    clearTimeout(stopTimer);
    stopTimer = null;
  }
}

/**
 * Plant eine Aufnahme: optional Startzeit (sonst sofort) und optional Stoppzeit
 * (sonst manuell). Erfordert einen geöffneten Eingang (armed). Die Timer laufen
 * im Main, damit Start/Stopp unabhängig vom Renderer-Zustand zuverlässig feuern.
 */
export function schedule(input: ScheduleInput): OpResult {
  if (state.status === 'idle') return { ok: false, error: 'Erst den Eingang öffnen (Arm).' };
  if (state.status === 'recording') return { ok: false, error: 'Es läuft bereits eine Aufnahme.' };

  const now = Date.now();
  const startAt = input.startAt && input.startAt > now ? input.startAt : null;
  const stopAt = input.stopAt && input.stopAt > now ? input.stopAt : null;
  if (stopAt && startAt && stopAt <= startAt) {
    return { ok: false, error: 'Stoppzeit muss nach der Startzeit liegen.' };
  }
  if (input.stopAt && !stopAt) {
    return { ok: false, error: 'Stoppzeit liegt in der Vergangenheit.' };
  }

  clearTimers();
  pendingInput = { dir: input.dir, fileName: input.fileName, separateTracks: input.separateTracks };
  state.scheduledStartAt = startAt;
  state.scheduledStopAt = stopAt;

  if (startAt) {
    startTimer = setTimeout(doScheduledStart, startAt - now);
    emitState();
    notice(`Aufnahme geplant für ${new Date(startAt).toLocaleTimeString()}.`);
  } else {
    // Sofort starten; ein evtl. gesetzter Stopp wird in doScheduledStart bewaffnet.
    doScheduledStart();
  }
  return { ok: true };
}

function doScheduledStart(): void {
  startTimer = null;
  state.scheduledStartAt = null;
  const input = pendingInput;
  if (!input) return;
  const res = startRecording(input);
  if (!res.ok) {
    state.scheduledStopAt = null;
    notice(res.error ?? 'Geplante Aufnahme konnte nicht starten.');
    return;
  }
  notice('Geplante Aufnahme gestartet.');
  // Auto-Stopp bewaffnen (startRecording räumt scheduledStartAt; Stopp bleibt).
  if (state.scheduledStopAt) {
    const delay = Math.max(0, state.scheduledStopAt - Date.now());
    stopTimer = setTimeout(doScheduledStop, delay);
  }
  emitState();
}

function doScheduledStop(): void {
  stopTimer = null;
  state.scheduledStopAt = null;
  const res = stopRecording();
  if (res.ok) notice(`Geplante Aufnahme beendet${res.filePath ? `: ${res.filePath}` : ''}.`);
}

/** Geplante Aufnahme abbrechen. Eine bereits LAUFENDE Aufnahme bleibt unberührt. */
export function cancelSchedule(): void {
  const had = state.scheduledStartAt != null || state.scheduledStopAt != null;
  clearTimers();
  state.scheduledStartAt = null;
  state.scheduledStopAt = null;
  pendingInput = null;
  emitState();
  if (had) notice('Planung abgebrochen.');
}

/**
 * Beim Fenster-Schließen/Beenden: wie disarm() — eine laufende Aufnahme wird abgeschlossen
 * (Kopf mit echter Länge, #291; vorher blieb er auf 0 und viele Player hielten die Datei für
 * leer), Timer gelöst, Eingang geschlossen.
 */
export function shutdown(): void {
  disarm();
}
