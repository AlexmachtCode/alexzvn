// TCP-Steuerserver des Prompters über das suite-weite Zeilenprotokoll
// (@jm/suite-control-protocol) — getrieben z. B. vom Bitfocus-Companion-Modul.
// Läuft NEBEN der HTTP/SSE-Fernbedienung (Port 7781); beide gehen auf denselben
// Transport im Main (die einzige Wahrheit).
//
//   Client → Prompter:  PROMPTER SCROLL ON|OFF|TOGGLE | PROMPTER SPEED <n> |
//                       PROMPTER FASTER|SLOWER | PROMPTER TOP | STATE?
//   Prompter → Client:  STATE ns=prompter scrolling=0|1 speed=<n>
//
// Die Transport-Funktionen (play/pause/reset, Tempo) leben modul-lokal in
// index.ts; daher die Callback-Verdrahtung (getState/onCommand) statt direkter
// Importe. mDNS: als Steuer-Endpunkt annonciert (controlEndpoint:true → TXT ctl=1,
// Name jm-prompter-ctl); daneben gibt es einen role=prompter-Advert für die
// HTTP/SSE-Fernbedienung. ctl=1 hält beide auseinander (Companion nimmt ctl=1).
import { SuiteControlServer } from '@jm/suite-control-protocol/server';
import { app } from 'electron';
import type { SuiteCommand, SuiteState } from '@jm/suite-control-protocol';

/** Eigener TCP-Steuerport (getrennt vom HTTP-Remote 7781). */
export const CONTROL_PORT = 8727;

let server: SuiteControlServer | null = null;

export interface PrompterControlHandlers {
  getState: () => SuiteState;
  onCommand: (cmd: SuiteCommand) => void;
}

export function startControlServer(
  handlers: PrompterControlHandlers,
): Promise<{ ok: boolean; error?: string; port?: number }> {
  stopControlServer();
  server = new SuiteControlServer({
    appDataDir: app.getPath('appData'),
    role: 'prompter',
    appId: 'jm-prompter',
    controlEndpoint: true,
    getState: handlers.getState,
    onCommand: (cmd) => {
      if (cmd.ns === 'prompter') handlers.onCommand(cmd);
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
export function pushState(state: SuiteState): void {
  server?.pushState(state);
}
