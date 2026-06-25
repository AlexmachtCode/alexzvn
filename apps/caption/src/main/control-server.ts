// TCP-Steuerserver der Caption über das suite-weite Zeilenprotokoll
// (@jm/suite-control-protocol) — so lassen sich Transkription, Hold, NDI und
// Leeren per Bitfocus Companion fernsteuern:
//
//   Client → Caption:  CAPTION transcribe on|off|toggle | CAPTION hold on|off|toggle |
//                      CAPTION ndi on|off|toggle | CAPTION clear | STATE?
//   Caption → Client:  STATE ns=caption running=1 hold=0 ndi=1 connections=2 lines=12
//
// Der autoritative Zustand lebt in index.ts → Callback-Verdrahtung
// (getState/onCommand). controlEndpoint:true annonciert den Endpunkt per mDNS mit
// TXT ctl=1 (Name jm-caption-ctl) → Companion findet ihn automatisch.
import { SuiteControlServer } from '@jm/suite-control-protocol/server';
import { app } from 'electron';
import type { SuiteCommand, SuiteState } from '@jm/suite-control-protocol';

/** Eigener TCP-Steuerport. */
export const CONTROL_PORT = 8732;

let server: SuiteControlServer | null = null;

export interface CaptionControlHandlers {
  getState: () => SuiteState;
  onCommand: (cmd: SuiteCommand) => void;
}

export function startControlServer(
  handlers: CaptionControlHandlers,
): Promise<{ ok: boolean; error?: string; port?: number }> {
  stopControlServer();
  server = new SuiteControlServer({
    appDataDir: app.getPath('appData'),
    role: 'caption',
    appId: 'jm-caption',
    controlEndpoint: true,
    getState: handlers.getState,
    onCommand: (cmd) => {
      if (cmd.ns === 'caption') handlers.onCommand(cmd);
    },
  });
  return server.start(CONTROL_PORT);
}

export function stopControlServer(): void {
  if (server) {
    server.stop();
    server = null;
  }
}

/** Neuen Zustand an alle Steuer-Clients broadcasten (nach Start/Stop/Hold/NDI …). */
export function pushControlState(state: SuiteState): void {
  server?.pushState(state);
}

/** on/off/toggle → konkreter Soll-Zustand (für Roh-Telnet, das 'toggle' schickt). */
export function resolveMode(arg: string | undefined, current: boolean): boolean {
  const a = String(arg ?? 'toggle').toLowerCase();
  if (a === 'on' || a === '1' || a === 'true') return true;
  if (a === 'off' || a === '0' || a === 'false') return false;
  return !current;
}
