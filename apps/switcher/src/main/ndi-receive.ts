// NDI-Empfangs-Bridge im Main — MEHRERE Empfänger gleichzeitig.
//
// Das native Addon hat pro Prozess genau einen Receiver (globaler g_recv).
// Darum: EIN utilityProcess pro NDI-Quelle (jeder mit eigener NDI-Runtime +
// Receiver), gekeyed per `recvId` (= Engine-Source-id). Suchen läuft in einem
// kurzlebigen Finder-Prozess (braucht keinen Receiver).
//
//   utilityProcess(recvId)  ⇄  Main  ⇄  Renderer (eigener Frame-Port je recvId)
//
// Frames laufen wie gehabt per KOPIE (kein Transfer) mit 1-Frame-Ack-Backpressure.
import { MessageChannelMain, utilityProcess, type BrowserWindow, type UtilityProcess } from 'electron';
import { join } from 'node:path';
import type { NdiStatus } from '@shared/types';

declare const __dirname: string;

interface Receiver {
  child: UtilityProcess;
  port2: Electron.MessagePortMain;
}

const receivers = new Map<string, Receiver>();
const statuses = new Map<string, NdiStatus>();
let targetWindow: BrowserWindow | null = null;

export function attachNdiWindow(win: BrowserWindow): void {
  targetWindow = win;
}

function utilityPath(): string {
  return join(__dirname, 'ndi-recv.cjs');
}

function mapState(state: string): NdiStatus['state'] {
  switch (state) {
    case 'connecting':
    case 'connected':
    case 'disconnected':
    case 'error':
      return state;
    default:
      return 'idle';
  }
}

function sendStatus(recvId: string, state: NdiStatus['state'], source: string | null): void {
  const status: NdiStatus = { recvId, state, source };
  if (state === 'idle') statuses.delete(recvId);
  else statuses.set(recvId, status);
  // Kindprozess-`exit` kann nach dem Fenster-Schließen feuern → zerstörtes
  // webContents abfangen (sonst „Object has been destroyed" beim Quit).
  if (!targetWindow || targetWindow.isDestroyed()) return;
  const wc = targetWindow.webContents;
  if (!wc.isDestroyed()) wc.send('ndi:status', status);
}

// PERSISTENTER Finder-Prozess. NDI-Discovery (mDNS) ist asynchron und akkumuliert
// über die Zeit im nativen g_find. Forkten wir pro Suche einen frischen Prozess
// (fork+kill), startete die Discovery jedes Mal KALT → 1,5 s reichen bei mehreren
// Geräten nicht → jeder Scan sieht nur eine zufällige Teilmenge (#17). Stattdessen
// halten wir EINEN Finder am Leben: sein g_find sammelt im Hintergrund weiter,
// jeder Scan liefert den aktuellen (wachsenden) Stand — zusammen mit dem
// Renderer-Doppelscan/Refresh konvergiert die Liste auf ALLE Quellen.
let finder: UtilityProcess | null = null;
const findQueue: Array<(list: string[]) => void> = [];

function ensureFinder(): UtilityProcess {
  if (finder) return finder;
  const f = utilityProcess.fork(utilityPath());
  f.on('message', (msg: unknown) => {
    const m = msg as { type?: string; list?: string[] } | null;
    if (m && m.type === 'sources') {
      // Suchen laufen sequenziell (Renderer awaitet jeden Scan) → FIFO genügt.
      findQueue.shift()?.(Array.isArray(m.list) ? m.list : []);
    }
  });
  f.on('exit', () => {
    finder = null; // beim nächsten Scan neu forken
    while (findQueue.length) findQueue.shift()?.([]);
  });
  finder = f;
  return f;
}

/** Sichtbare NDI-Quellen suchen — fragt den persistenten Finder ab. */
export function ndiFind(timeoutMs = 1500): Promise<string[]> {
  return new Promise((resolve) => {
    const f = ensureFinder();
    let done = false;
    const finish = (list: string[]): void => {
      if (done) return;
      done = true;
      resolve(list);
    };
    findQueue.push(finish);
    f.postMessage({ type: 'find', timeoutMs });
    // Sicherheits-Timeout: bleibt die Antwort aus, diesen Resolver wieder aus der
    // Queue nehmen (sonst geriete die FIFO-Zuordnung durcheinander) und leer melden.
    setTimeout(() => {
      if (done) return;
      const i = findQueue.indexOf(finish);
      if (i >= 0) findQueue.splice(i, 1);
      finish([]);
    }, timeoutMs + 4000);
  });
}

export function ndiConnect(recvId: string, source: string): void {
  if (!targetWindow) return;
  ndiDisconnect(recvId);

  const child = utilityProcess.fork(utilityPath());
  const { port1, port2 } = new MessageChannelMain();
  port2.on('message', (e) => child.postMessage(e.data)); // Ack vom Renderer → Utility
  port2.start();

  child.on('message', (msg: unknown) => {
    const m = msg as { type?: string; state?: string; message?: string } | null;
    if (!m || typeof m !== 'object') return;
    if (m.type === 'video') {
      port2.postMessage(m); // Kopie → Renderer
    } else if (m.type === 'status') {
      sendStatus(recvId, mapState(String(m.state)), (m.message as string) ?? null);
    }
  });
  child.on('exit', () => {
    if (receivers.get(recvId)?.child === child) {
      receivers.delete(recvId);
      sendStatus(recvId, 'idle', null);
    }
  });

  receivers.set(recvId, { child, port2 });
  child.postMessage({ type: 'connect', source });
  // recvId mitgeben, damit der Renderer den Port der richtigen Quelle zuordnet.
  targetWindow.webContents.postMessage('jmswitch:ndi-port', { recvId }, [port1]);
}

export function ndiDisconnect(recvId: string): void {
  const r = receivers.get(recvId);
  if (!r) return;
  receivers.delete(recvId);
  try {
    r.child.postMessage({ type: 'disconnect' });
    r.child.kill();
  } catch {
    // egal
  }
  sendStatus(recvId, 'idle', null);
}

export function ndiStatus(): NdiStatus[] {
  return [...statuses.values()];
}

/** Beim Beenden/Fenster-Schließen alle Empfänger stoppen. */
export function stopNdi(): void {
  for (const [, r] of receivers) {
    try {
      r.child.kill();
    } catch {
      // egal
    }
  }
  receivers.clear();
  statuses.clear();
  // Persistenten Finder mit beenden.
  if (finder) {
    try {
      finder.kill();
    } catch {
      // egal
    }
    finder = null;
  }
  while (findQueue.length) findQueue.shift()?.([]);
}
