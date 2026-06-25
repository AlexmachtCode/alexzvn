// TCP-Steuerserver des Rundowns über das suite-weite Zeilenprotokoll
// (@jm/suite-control-protocol) — so kann der Ablauf selbst per Bitfocus Companion
// (oder einem anderen Dirigenten) ferngesteuert werden:
//
//   Client → Rundown:  RUNDOWN GO | RUNDOWN NEXT | RUNDOWN PREV |
//                      RUNDOWN GOTO <n> | STATE?
//   Rundown → Client:  STATE ns=rundown cue=<n> total=<n> label=<titel>
//
// Der Zustand (doc + scharfe Zeile) lebt modul-lokal in index.ts → Callback-
// Verdrahtung (getState/onCommand). controlEndpoint:true annonciert den Endpunkt
// per mDNS mit TXT ctl=1 (Name jm-rundown-ctl) → Companion findet ihn automatisch.
import { SuiteControlServer } from '@jm/suite-control-protocol/server';
import { app } from 'electron';
import type { SuiteCommand, SuiteState } from '@jm/suite-control-protocol';

/** Eigener TCP-Steuerport. */
export const CONTROL_PORT = 8731;

let server: SuiteControlServer | null = null;

export interface RundownControlHandlers {
  getState: () => SuiteState;
  onCommand: (cmd: SuiteCommand) => void;
}

export function startControlServer(
  handlers: RundownControlHandlers,
): Promise<{ ok: boolean; error?: string; port?: number }> {
  stopControlServer();
  server = new SuiteControlServer({
    appDataDir: app.getPath('appData'),
    role: 'rundown',
    appId: 'jm-rundown',
    controlEndpoint: true,
    getState: handlers.getState,
    onCommand: (cmd) => {
      if (cmd.ns === 'rundown') handlers.onCommand(cmd);
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

/** Neuen Zustand an alle Steuer-Clients broadcasten (z. B. nach GO/NEXT). */
export function pushControlState(state: SuiteState): void {
  server?.pushState(state);
}
