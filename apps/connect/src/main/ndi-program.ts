// Programm-NDI-Empfang (Rückkanal, Welle 6.2a): forkt EINEN utilityProcess, der die Programm-
// Quelle (Switcher-PGM) empfängt, und bridgt dessen BGRA-Frames an den versteckten Peer-Renderer.
// Von dort werden sie als geteilter `program-video`-Track an die SFU published (alle Gäste sehen
// das Programm). Gespiegelt aus apps/switcher/src/main/ndi-receive.ts — nur EIN Empfänger.
//
// Frame-Weg: utility → parentPort → hier (child.on('message')) → port2.postMessage → Peer (port1).
// Ack-Weg:   Peer (port1) → port2.on('message') → child.postMessage (Backpressure).
//
// Plan C (Spec 22.4, E34, E50, E51): Den Zustand führt die reine Lage (ndi-lage.ts, eine Instanz mit den Gast-Quellen,
// angelegt in index.ts). Diese Hülle startet und beendet den Prozess nur, wie die Lage es sagt (programmHandlung), hört auf
// sein `exit` und reicht jede Nachricht außer `video`/`audio` durch den Leser (leseProgrammMeldung). Ein Neustart tauscht
// nur den Prozess und läuft NICHT über stopProgram/startProgram: Der MessageChannelMain zum Peer besteht von startProgram
// bis stopProgram, port2 reicht Bestätigungen an den aktuellen Prozess, Bilder des aktuellen Prozesses gehen an port2.
// Logzeilen tragen Generation und PID, nie Quelle oder Suchname (E35).
import { MessageChannelMain, utilityProcess, type BrowserWindow, type MessagePortMain, type UtilityProcess } from 'electron';
import { join } from 'node:path';
import { getLog } from '@jm/app-runtime';
import { PEER_PROGRAM_PORT } from '@shared/ipc';
import { leseProgrammMeldung, type NdiHandlung, type NdiLage, type NdiProgrammLage } from './ndi-lage';

declare const __dirname: string;

interface Prozess {
  child: UtilityProcess;
  generation: number;
}

/** Der Prozess, der gerade aktuell ist; null zwischen Ausfall und Neustart, in `aus` und in `gescheitert`. */
let aktuell: Prozess | null = null;
let port2: MessagePortMain | null = null;
/** Suchname aus dem letzten startProgram (für den Auftrag eines neu gestarteten Prozesses). */
let hinweis = '';
let getPeer: () => BrowserWindow | null = () => null;
let lage: NdiLage | null = null;
let ausfuehren: (h: NdiHandlung[]) => void = () => {};

export function initNdiProgram(deps: { getPeer: () => BrowserWindow | null; lage: NdiLage; ausfuehren: (h: NdiHandlung[]) => void }): void {
  getPeer = deps.getPeer;
  lage = deps.lage;
  ausfuehren = deps.ausfuehren;
}

/** Lage des Programm-Empfangs für AppStatus und STATE (22.4, E44). Vor initNdiProgram: `aus`. */
export function programmLage(): NdiProgrammLage {
  return lage ? lage.programmLage() : { zustand: 'aus', grund: null, code: null, k: 0, quelle: null, hinweis: '', bereit: false };
}

/** Übergang bis Plan C Task C9 (AppStatus noch mit programState/programSource): die alten Wörter aus der Lage. */
export interface ProgramStatus {
  state: string;
  source: string | null;
}
const ALTES_WORT: Partial<Record<NdiProgrammLage['zustand'], string>> = {
  aus: 'off', sucht: 'searching', keineQuelle: 'notfound', verbunden: 'connected', fehler: 'error',
};
export function programStatus(): ProgramStatus {
  const l = programmLage();
  return { state: ALTES_WORT[l.zustand] ?? l.zustand, source: l.quelle };
}

function schliesseKanal(): void {
  if (!port2) return;
  try {
    port2.close();
  } catch {
    /* egal */
  }
  port2 = null;
}

/**
 * Programm-Empfang starten (Raum öffnen) und den Frame-Port an den Peer geben. Ein laufender Prozess endet (C-EB10), der
 * Kanal zum Peer wird neu angelegt. Der zu suchende NDI-Quellname ist per `JMPS_PROGRAM_NDI` überschreibbar (Default
 * „JM Switcher"), falls die Rückkanal-Quelle anders heißt. Ohne Peer-Fenster: `gescheitert/keinPeer` (Lage).
 */
export function startProgram(nameHint = (process.env.JMPS_PROGRAM_NDI || 'JM Switcher').trim()): void {
  if (!lage) return;
  hinweis = nameHint;
  schliesseKanal();
  const peer = getPeer();
  if (peer) {
    const chan = new MessageChannelMain();
    port2 = chan.port2;
    // Bestätigungen (Ack) an den Prozess, der GERADE aktuell ist, auch nach einem Neustart.
    port2.on('message', (ev) => aktuell?.child.postMessage(ev.data));
    port2.start();
    peer.webContents.postMessage(PEER_PROGRAM_PORT, {}, [chan.port1]);
  }
  ausfuehren(lage.programmStart(nameHint));
}

/** Raum schließen, Beenden: `aus`, ein geplanter Neustart entfällt, ein `exit` danach ist kein Absturz (Lage). */
export function stopProgram(): void {
  if (lage) ausfuehren(lage.programmStop());
  schliesseKanal();
}

/** Knopf „Programm neu starten“ (22.4): wirkt nur in `gescheitert`; der Kanal zum Peer bleibt. */
export function programmNeustart(): void {
  if (lage) ausfuehren(lage.programmNeustart());
}

/** Führt eine Handlung der Lage für den Programm-Empfang aus (index.ts verteilt sie, C-EP1). */
export function programmHandlung(h: Extract<NdiHandlung, { art: 'prozessStarten' | 'prozessBeenden' }>): void {
  if (h.art === 'prozessStarten') starteProzess(h.generation);
  else beendeProzess(h.generation);
}

function starteProzess(generation: number): void {
  // `stdio: 'pipe'`: der gepackten GUI-App fehlt die Konsole, an die 'inherit' erben würde —
  // die Suchmeldungen des Empfängers (nur Anzahlen, keine NDI-Namen; GG21, OFC3) landen so in der Logdatei.
  const child = utilityProcess.fork(join(__dirname, 'ndi-program-receiver.cjs'), [], { stdio: 'pipe' });
  const prozess: Prozess = { child, generation };
  aktuell = prozess;
  const forward = (level: 'info' | 'error') => (chunk: Buffer) => {
    for (const line of chunk.toString().split('\n')) {
      if (line.trim()) getLog()[level](`[program-receiver G${generation}] ${line.trim()}`);
    }
  };
  child.stdout?.on('data', forward('info'));
  child.stderr?.on('data', forward('error'));
  child.on('message', (roh: unknown) => {
    const art = (roh as { type?: unknown } | null)?.type;
    if (art === 'video' || art === 'audio') {
      // an den Peer (Copy, kein Transfer) — Video-Frames + Programm-Ton, nur vom aktuellen Prozess
      if (aktuell === prozess) port2?.postMessage(roh);
      return;
    }
    // Jede andere Nachricht geht durch den Leser (E51): fremde Arten und Werte kommen nicht in die Lage.
    const m = leseProgrammMeldung(roh);
    if ('verworfen' in m) {
      getLog().warn(`[ndi-program] Programm (Generation ${generation}): Meldung verworfen, ${m.verworfen}`);
      return;
    }
    ausfuehren(lage?.programmMeldung(generation, m) ?? []);
  });
  child.on('exit', (code) => {
    if (aktuell === prozess) aktuell = null;
    getLog().info(`[ndi-program] Programm (Generation ${generation}, PID ${child.pid ?? '?'}): Prozess beendet, Code ${code}`);
    ausfuehren(lage?.programmExit(generation, code) ?? []);
  });
  // Die PID gibt es erst ab `spawn` (wie in ndi-guests.ts; E35, C-EB4).
  child.on('spawn', () => {
    getLog().info(`[ndi-program] Programm (Generation ${generation}, PID ${child.pid ?? '?'}): Prozess gestartet`);
    if (child.pid !== undefined) lage?.prozessPid(generation, child.pid);
  });
  child.postMessage({ type: 'start', nameHint: hinweis });
}

function beendeProzess(generation: number): void {
  const p = aktuell;
  if (!p || p.generation !== generation) return;
  try {
    p.child.postMessage({ type: 'stop' });
    p.child.kill();
  } catch {
    /* schon beendet: das exit kommt trotzdem */
  }
}
