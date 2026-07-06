// NDI-Gäste-Pool: EIN utilityProcess (nativer NDI-Sender) je freigegebenem Gast.
// Löst die „ein Sender pro Prozess"-Regel von @jm/ndi durch Isolation je Gast —
// gespiegelt aus dem Map-keyed-ein-Prozess-pro-Quelle-Muster des Switchers
// (apps/switcher/src/main/ndi-receive.ts), nur in SEND-Richtung.
//
// Frame-Weg (Welle 6.1): der versteckte Peer-Renderer dekodiert die vom SFU
// abonnierten Gast-Tracks (WebCodecs → BGRA/FLTP) und postet sie auf port1; port2
// bleibt im Main und leitet jede Nachricht per child.postMessage an den Utility
// weiter — Buffer werden KOPIERT, nicht transferiert (ein transferierter
// ArrayBuffer käme über die Port-Grenze als null an).
import { MessageChannelMain, utilityProcess, type BrowserWindow, type MessagePortMain, type UtilityProcess } from 'electron';
import { join } from 'node:path';
import { PEER_FRAME_PORT } from '@shared/ipc';

declare const __dirname: string;

interface GuestSender {
  child: UtilityProcess;
  port2: MessagePortMain;
  label: string;
  connections: number;
}

const senders = new Map<string, GuestSender>();
let getPeer: () => BrowserWindow | null = () => null;
let onChange: () => void = () => {};

export function initNdiGuests(deps: { getPeer: () => BrowserWindow | null; onChange: () => void }): void {
  getPeer = deps.getPeer;
  onChange = deps.onChange;
}

/** NDI-Sender für einen freigegebenen Gast starten (bei spinUpNdi-Effekt). */
export function spinUp(guestId: string, label: string): void {
  if (senders.has(guestId)) return;
  const peer = getPeer();
  if (!peer || peer.isDestroyed()) {
    console.warn('[ndi-guests] kein Peer-Fenster — spinUp verschoben:', guestId);
    return;
  }

  const child = utilityProcess.fork(join(__dirname, 'ndi-guest-sender.cjs'));
  const entry: GuestSender = { child, port2: null as unknown as MessagePortMain, label, connections: 0 };

  child.on('message', (msg: unknown) => {
    const m = msg as { type?: string; connections?: number } | null;
    if (m && m.type === 'stat' && typeof m.connections === 'number') {
      entry.connections = m.connections;
    }
  });
  child.postMessage({ type: 'init', name: label });

  const { port1, port2 } = new MessageChannelMain();
  port2.on('message', (e) => {
    // Ohne Transfer weiterreichen (Buffer wird kopiert).
    child.postMessage(e.data);
  });
  port2.start();
  entry.port2 = port2;
  senders.set(guestId, entry);

  // port1 an den versteckten Peer-Renderer, getaggt mit der Gast-ID.
  peer.webContents.postMessage(PEER_FRAME_PORT, { guestId }, [port1]);
  onChange();
}

/** NDI-Sender eines Gasts stoppen (bei tearDownNdi-Effekt / Kick / Leave). */
export function tearDown(guestId: string): void {
  const s = senders.get(guestId);
  if (!s) return;
  try {
    s.child.postMessage({ type: 'stop' });
    s.child.kill();
    s.port2.close();
  } catch {
    /* egal */
  }
  senders.delete(guestId);
  onChange();
}

/** Alle Sender beenden (Raum schließen / App beenden). */
export function tearDownAll(): void {
  for (const id of [...senders.keys()]) tearDown(id);
}

export function activeCount(): number {
  return senders.size;
}
