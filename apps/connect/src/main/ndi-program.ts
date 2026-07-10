// Programm-NDI-Empfang (Rückkanal, Welle 6.2a): forkt EINEN utilityProcess, der die Programm-
// Quelle (Switcher-PGM) empfängt, und bridgt dessen BGRA-Frames an den versteckten Peer-Renderer.
// Von dort werden sie als geteilter `program-video`-Track an die SFU published (alle Gäste sehen
// das Programm). Gespiegelt aus apps/switcher/src/main/ndi-receive.ts — nur EIN Empfänger.
//
// Frame-Weg: utility → parentPort → hier (child.on('message')) → port2.postMessage → Peer (port1).
// Ack-Weg:   Peer (port1) → port2.on('message') → child.postMessage (Backpressure).
import { MessageChannelMain, utilityProcess, type BrowserWindow, type MessagePortMain, type UtilityProcess } from 'electron';
import { join } from 'node:path';
import { getLog } from '@jm/app-runtime';
import { PEER_PROGRAM_PORT } from '@shared/ipc';

declare const __dirname: string;

export interface ProgramStatus {
  /** 'off' | 'searching' | 'notfound' | 'connected' | 'error' | 'stopped' */
  state: string;
  source: string | null;
}

let child: UtilityProcess | null = null;
let port2: MessagePortMain | null = null;
let getPeer: () => BrowserWindow | null = () => null;
let onStatus: (s: ProgramStatus) => void = () => {};
let status: ProgramStatus = { state: 'off', source: null };

export function initNdiProgram(deps: { getPeer: () => BrowserWindow | null; onStatus: (s: ProgramStatus) => void }): void {
  getPeer = deps.getPeer;
  onStatus = deps.onStatus;
}

export function programStatus(): ProgramStatus {
  return status;
}

/**
 * Programm-Empfang starten und den Frame-Port an den Peer geben. Idempotent (Neustart).
 * Der zu suchende NDI-Quellname ist per `JMPS_PROGRAM_NDI` überschreibbar (Default „JM Switcher"),
 * falls die Rückkanal-Quelle anders heißt.
 */
export function startProgram(nameHint = (process.env.JMPS_PROGRAM_NDI || 'JM Switcher').trim()): void {
  const peer = getPeer();
  if (!peer || peer.isDestroyed()) {
    getLog().warn('[ndi-program] kein Peer-Fenster — Start verschoben');
    return;
  }
  stopProgram();

  // `stdio: 'pipe'`: der gepackten GUI-App fehlt die Konsole, an die 'inherit' erben würde —
  // die Suchmeldungen des Empfängers („notfound", gesehene Quellnamen) landen so in der Logdatei.
  child = utilityProcess.fork(join(__dirname, 'ndi-program-receiver.cjs'), [], { stdio: 'pipe' });
  const forward = (level: 'info' | 'error') => (chunk: Buffer) => {
    for (const line of chunk.toString().split('\n')) {
      if (line.trim()) getLog()[level](`[program-receiver] ${line.trim()}`);
    }
  };
  child.stdout?.on('data', forward('info'));
  child.stderr?.on('data', forward('error'));
  child.on('message', (msg: unknown) => {
    const m = msg as { type?: string; state?: string; source?: string } | null;
    if (!m) return;
    if (m.type === 'video' || m.type === 'audio') {
      port2?.postMessage(m); // an den Peer (Copy, kein Transfer) — Video-Frames + Programm-Ton
    } else if (m.type === 'status') {
      status = { state: m.state || 'off', source: m.source ?? null };
      onStatus(status);
    }
  });
  child.on('exit', () => {
    if (child) {
      child = null;
      status = { state: 'off', source: null };
      onStatus(status);
    }
  });

  const chan = new MessageChannelMain();
  port2 = chan.port2;
  port2.on('message', (e) => child?.postMessage(e.data)); // Ack Peer → Utility
  port2.start();
  peer.webContents.postMessage(PEER_PROGRAM_PORT, {}, [chan.port1]);

  child.postMessage({ type: 'start', nameHint });
  status = { state: 'searching', source: null };
  onStatus(status);
}

export function stopProgram(): void {
  if (child) {
    try {
      child.postMessage({ type: 'stop' });
      child.kill();
    } catch {
      /* egal */
    }
    child = null;
  }
  if (port2) {
    try {
      port2.close();
    } catch {
      /* egal */
    }
    port2 = null;
  }
  status = { state: 'off', source: null };
}
