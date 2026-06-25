// TCP-Steuerserver der DAW über das suite-weite Zeilenprotokoll
// (@jm/suite-control-protocol) — getrieben z. B. vom Bitfocus-Companion-Modul.
//
//   Client → DAW:  DAW PLAY|STOP|TOGGLE | DAW REC ON|OFF|TOGGLE | STATE?
//   DAW → Client:  STATE ns=daw playing=0|1 recording=0|1
//
// Transport (Play/Stop) lebt im Renderer-Store, die Aufnahme-Flows ebenfalls
// (sie platzieren den aufgenommenen Clip). Daher gehen Befehle per IPC
// ('daw:remote-cmd') an den Renderer; der meldet seinen Zustand via
// 'daw:report-state' zurück, den der Steuerserver cached + broadcastet.
//
// mDNS: als Steuer-Endpunkt annonciert (controlEndpoint:true → TXT ctl=1, Name
// jm-daw-ctl) → vom Companion-Modul per Auto-Discovery gefunden.
import type { BrowserWindow } from 'electron';
import { SuiteControlServer } from '@jm/suite-control-protocol/server';
import { app } from 'electron';
import type { SuiteCommand, SuiteState } from '@jm/suite-control-protocol';
import type { DawRemoteCommand, DawRemoteState } from '@shared/ipc-types';

/** Eigener TCP-Steuerport. */
export const CONTROL_PORT = 8730;

let server: SuiteControlServer | null = null;
let getWindow: (() => BrowserWindow | null) | null = null;
let lastState: DawRemoteState = { playing: false, recording: false };

function toSuiteState(s: DawRemoteState = lastState): SuiteState {
  return { ns: 'daw', kv: { playing: s.playing, recording: s.recording } };
}

/** SuiteCommand (ns=daw) → DawRemoteCommand für den Renderer. */
function toRemoteCommand(cmd: SuiteCommand): DawRemoteCommand | null {
  switch (cmd.verb) {
    case 'play':
      return { t: 'play' };
    case 'stop':
      return { t: 'stop' };
    case 'toggle':
      return { t: 'toggle' };
    case 'rec': {
      const m = (cmd.args[0] ?? 'toggle').toLowerCase();
      const mode = m === 'on' || m === '1' || m === 'start' ? 'on' : m === 'off' || m === '0' || m === 'stop' ? 'off' : 'toggle';
      return { t: 'rec', mode };
    }
    default:
      return null;
  }
}

export function startControlServer(
  getWin: () => BrowserWindow | null,
): Promise<{ ok: boolean; error?: string; port?: number }> {
  stopControlServer();
  getWindow = getWin;
  server = new SuiteControlServer({
    appDataDir: app.getPath('appData'),
    role: 'daw',
    appId: 'jm-daw',
    controlEndpoint: true,
    getState: () => toSuiteState(),
    onCommand: (cmd) => {
      if (cmd.ns !== 'daw') return;
      const rc = toRemoteCommand(cmd);
      if (!rc) return;
      const win = getWindow?.();
      if (win && !win.isDestroyed()) win.webContents.send('daw:remote-cmd', rc);
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

/** Renderer meldet neuen Transport-/Aufnahme-Zustand → cachen + broadcasten. */
export function updateDawState(state: DawRemoteState): void {
  lastState = state;
  server?.pushState(toSuiteState(state));
}
