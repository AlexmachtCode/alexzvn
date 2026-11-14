import { MessageChannelMain, utilityProcess } from 'electron';
import type { BrowserWindow, MessagePortMain, UtilityProcess } from 'electron';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { AnSender, VomSender } from '../../shared/ndi';

declare const __dirname: string;

// Utility-Prozess des NDI-Ausgangs (#303), nach apps/titler/src/main/ndi/sender-process.ts.
//
// Bild-Weg: Das NDI-Fenster bekommt `port1` und postet darauf BGRA-Vollbilder; `port2` bleibt im Main und
// reicht jede Nachricht `bild` per `kind.postMessage` an den Utility-Prozess weiter. Ein direkter Port
// Renderer↔Utility liefert in dieser Electron-Version nicht zuverlässig, darum die Brücke über den Main.

export interface SenderMeldungen {
  bereit(): void;
  fehler(grund: string): void;
  empfaenger(n: number): void;
  /** Der Prozess ist von selbst geendet (nicht durch `stoppeSender`). */
  beendet(code: number): void;
}

let kind: UtilityProcess | null = null;
let port: MessagePortMain | null = null;

function schliessePort(): void {
  if (!port) return;
  port.close();
  port = null;
}

/** Startet einen frischen Sender (ein laufender wird vorher beendet). `false`, wenn der Sender im Paket fehlt. */
export function starteSender(m: SenderMeldungen): boolean {
  stoppeSender();
  const datei = join(__dirname, 'ndi-sender.cjs');
  if (!existsSync(datei)) return false;
  const k = utilityProcess.fork(datei);
  kind = k;
  k.on('message', (nachricht: unknown) => {
    if (kind !== k) return; // Nachzügler eines beendeten Senders
    const d = nachricht as VomSender | null;
    if (!d || typeof d !== 'object') return;
    if (d.type === 'bereit') m.bereit();
    else if (d.type === 'fehler') m.fehler(String(d.grund ?? ''));
    else if (d.type === 'stat' && typeof d.empfaenger === 'number') m.empfaenger(d.empfaenger);
  });
  k.on('exit', (code: number) => {
    if (kind !== k) return; // von stoppeSender beendet oder schon ersetzt
    kind = null;
    schliessePort();
    m.beendet(code);
  });
  k.postMessage({ type: 'init' } satisfies AnSender);
  return true;
}

/** Neuer Bild-Port für das NDI-Fenster; ein alter wird geschlossen. */
export function verbindeFenster(win: BrowserWindow): void {
  schliessePort();
  if (win.isDestroyed()) return;
  const { port1, port2 } = new MessageChannelMain();
  port2.on('message', (e) => {
    const d = e.data as AnSender | null;
    // Ohne Transfer weiterreichen – der Buffer wird kopiert. Ein transferierter ArrayBuffer käme über die
    // Port-Grenze als null an.
    if (d && typeof d === 'object' && d.type === 'bild') kind?.postMessage({ type: 'bild', buffer: d.buffer } satisfies AnSender);
  });
  port2.start();
  port = port2;
  win.webContents.postMessage('jmpr:ndi-port', null, [port1]);
}

/** Beendet Sender und Bild-Port. Mehrfach aufrufbar. */
export function stoppeSender(): void {
  schliessePort();
  const k = kind;
  kind = null; // vor kill(): dessen exit meldet dann kein `beendet`
  if (!k) return;
  try {
    k.postMessage({ type: 'stop' } satisfies AnSender);
  } catch {
    // schon tot
  }
  k.kill();
}
