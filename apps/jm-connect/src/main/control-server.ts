// TCP-Steuerserver von JM Connect über das suite-weite Zeilenprotokoll
// (@jm/suite-control-protocol) — so lässt sich die Zuschaltung per Bitfocus Companion
// / JM Rundown fernsteuern (ein GO holt den Standby-Gast auf Sendung):
//
//   Client → Connect:  CONNECT GO | CONNECT NEXT | CONNECT ONAIR <id> | STATE?
//   Connect → Client:  STATE ns=connect room=<r> onair=<n> lobby=<n> standby=<id> …
//
// Der autoritative Raumzustand lebt im ConnectRoom-DO (Cloud); der Operator-Renderer
// spiegelt ihn und meldet den abgeleiteten STATE via IPC hierher. controlEndpoint:true
// annonciert den Endpunkt per mDNS (TXT ctl=1, Name jm-connect-ctl) → Companion/Health
// finden ihn automatisch.
import { SuiteControlServer } from '@jm/suite-control-protocol/server';
import { app } from 'electron';
import type { SuiteCommand, SuiteState } from '@jm/suite-control-protocol';

/** Eigener TCP-Steuerport (nächster nach Launcher 8736). */
export const CONTROL_PORT = 8737;

let server: SuiteControlServer | null = null;
let lastState: SuiteState = { ns: 'connect', kv: { room: '', onair: 0, lobby: 0, guests: 0, talkback: 0 } };

export interface ConnectControlHandlers {
  onCommand: (cmd: SuiteCommand) => void;
}

export function startControlServer(
  handlers: ConnectControlHandlers,
): Promise<{ ok: boolean; error?: string; port?: number }> {
  stopControlServer();
  server = new SuiteControlServer({
    appDataDir: app.getPath('appData'),
    role: 'connect',
    appId: 'jm-connect',
    controlEndpoint: true,
    getState: () => lastState,
    onCommand: (cmd) => {
      if (cmd.ns === 'connect') handlers.onCommand(cmd);
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

/** Abgeleiteten Zustand (vom Operator-Renderer) an alle Steuer-Clients broadcasten. */
export function pushControlState(kv: Record<string, string | number | boolean>): void {
  lastState = { ns: 'connect', kv };
  server?.pushState(lastState);
}
