// NDI-Gäste-Pool: EIN utilityProcess (nativer NDI-Sender) je QUELLE. Ein Gast hat bis zu zwei:
// sein Kamerabild und (Welle 6.3) seinen geteilten Bildschirm. Der Pool wird deshalb über den
// NDI-Pool-Schlüssel adressiert (`@jm/rtc`: Gast-ID bzw. `<id>::screen`), nicht über die Gast-ID.
// Löst die „ein Sender pro Prozess"-Regel von @jm/ndi durch Isolation je Quelle —
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
import { ndiPoolKey } from '@jm/rtc/protocol';
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

/** NDI-Sender für eine Quelle starten (bei spinUpNdi-Effekt). `key` = NDI-Pool-Schlüssel. */
export function spinUp(key: string, label: string): void {
  if (senders.has(key)) return;
  const peer = getPeer();
  if (!peer || peer.isDestroyed()) {
    console.warn('[ndi-guests] kein Peer-Fenster — spinUp verschoben:', key);
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
  senders.set(key, entry);

  // port1 an den versteckten Peer-Renderer, getaggt mit dem Pool-Schlüssel der Quelle.
  peer.webContents.postMessage(PEER_FRAME_PORT, { key }, [port1]);
  onChange();
}

/**
 * NDI-Sender einer Quelle stoppen (tearDownNdi / Kick / Leave). Wird die KAMERA eines Gasts
 * abgeräumt, geht auch sein Bildschirm — der Gast ist weg. Umgekehrt nicht: das Beenden der
 * Bildschirmfreigabe lässt die Kamera laufen.
 */
export function tearDown(key: string): void {
  if (!key.includes('::')) tearDown(ndiPoolKey(key, 'screen'));
  const s = senders.get(key);
  if (!s) return;
  try {
    s.child.postMessage({ type: 'stop' });
    s.child.kill();
    s.port2.close();
  } catch {
    /* egal */
  }
  senders.delete(key);
  onChange();
}

/** Alle Sender beenden (Raum schließen / App beenden). */
export function tearDownAll(): void {
  for (const id of [...senders.keys()]) tearDown(id);
}

export function activeCount(): number {
  return senders.size;
}
