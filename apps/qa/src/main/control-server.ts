// TCP-Steuerserver von Q&A über das suite-weite Zeilenprotokoll
// (@jm/suite-control-protocol) — so lässt sich die Wortmeldungs-Queue per Bitfocus
// Companion fernsteuern:
//
//   Client → Q&A:  QA NEXT | QA END | QA EXTEND <s> | QA CLEAR | STATE?
//   Q&A → Client:  STATE ns=qa active=<name> waiting=<n> total=<n> live=1 remote=0
//
// Der autoritative Zustand lebt in index.ts → Callback-Verdrahtung
// (getState/onCommand). controlEndpoint:true annonciert den Endpunkt per mDNS mit
// TXT ctl=1 (Name jm-qa-ctl) → Companion findet ihn automatisch.
import { SuiteControlServer } from '@jm/suite-control-protocol/server';
import { app } from 'electron';
import type { SuiteCommand, SuiteState } from '@jm/suite-control-protocol';

/** Eigener TCP-Steuerport. */
export const CONTROL_PORT = 8733;

let server: SuiteControlServer | null = null;

export interface QaControlHandlers {
  getState: () => SuiteState;
  onCommand: (cmd: SuiteCommand) => void;
}

export function startControlServer(
  handlers: QaControlHandlers,
): Promise<{ ok: boolean; error?: string; port?: number }> {
  stopControlServer();
  server = new SuiteControlServer({
    appDataDir: app.getPath('appData'),
    role: 'qa',
    appId: 'jm-qa',
    controlEndpoint: true,
    getState: handlers.getState,
    onCommand: (cmd) => {
      if (cmd.ns === 'qa') handlers.onCommand(cmd);
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

/** Neuen Zustand an alle Steuer-Clients broadcasten. */
export function pushControlState(state: SuiteState): void {
  server?.pushState(state);
}
