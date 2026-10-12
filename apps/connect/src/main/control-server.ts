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
//
// Zoom (Stage 4b, Spec 11.3): Die zoom_*-Werte meldet die Zoom-Hülle (setZoomControlState). Raum-Teil
// und Zoom-Teil liegen getrennt (control-state.ts); jeder Push ersetzt nur seinen Teil.
import { SuiteControlServer } from '@jm/suite-control-protocol/server';
import { app } from 'electron';
import type { SuiteCommand, SuiteState } from '@jm/suite-control-protocol';
import { erzeugeStateSpeicher, type Kv } from './control-state';

/** Eigener TCP-Steuerport (nächster nach Launcher 8736). */
export const CONTROL_PORT = 8737;

let server: SuiteControlServer | null = null;
const stand = erzeugeStateSpeicher((kv) => {
  lastState = { ns: 'connect', kv };
  server?.pushState(lastState);
});
let lastState: SuiteState = { ns: 'connect', kv: stand.aktuell() };

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

/** Raum-Teil (vom Operator-Renderer) setzen und den gemischten STATE an alle Steuer-Clients broadcasten. */
export function pushControlState(kv: Kv): void {
  stand.raum(kv);
}

/** Zoom-Teil (von der Zoom-Hülle, nur bei Änderung) setzen und den gemischten STATE broadcasten. */
export function setZoomControlState(kv: Kv): void {
  stand.zoom(kv);
}
