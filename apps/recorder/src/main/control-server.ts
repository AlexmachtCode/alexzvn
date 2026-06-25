// TCP-Steuerserver des Recorders über das suite-weite Zeilenprotokoll
// (@jm/suite-control-protocol) — getrieben z. B. vom Bitfocus-Companion-Modul.
//
//   Client → Recorder:  RECORDER RECORD ON|OFF|TOGGLE | RECORDER ARM|DISARM |
//                       STATE?
//   Recorder → Client:  STATE ns=recorder recording=0|1 armed=0|1 status=…
//                       duration=<sek>
//
// Der Aufnahme-Zustand lebt im Main (recorder.ts) — der STATE-Push liest ihn
// direkt. Aufnahme-START braucht aber die Renderer-Settings (Zielordner/Datei),
// daher gehen Befehle per IPC ('recorder:remote-cmd') an den Renderer, der seine
// vorhandenen Store-Aktionen (record/stop/arm/disarm) aufruft.
//
// mDNS: als Steuer-Endpunkt annonciert (controlEndpoint:true → TXT ctl=1, Name
// jm-recorder-ctl) → vom Companion-Modul per Auto-Discovery gefunden.
import type { BrowserWindow } from 'electron';
import { SuiteControlServer } from '@jm/suite-control-protocol/server';
import { app } from 'electron';
import type { SuiteCommand, SuiteState } from '@jm/suite-control-protocol';
import type { RecorderRemoteCommand } from '@shared/types';
import { getState, onStateChange } from './recorder';

/** Eigener TCP-Steuerport. */
export const CONTROL_PORT = 8729;

let server: SuiteControlServer | null = null;
let getWindow: (() => BrowserWindow | null) | null = null;
let unsubscribe: (() => void) | null = null;
let lastJson = '';

function toSuiteState(): SuiteState {
  const s = getState();
  return {
    ns: 'recorder',
    kv: {
      recording: s.status === 'recording',
      armed: s.status === 'armed',
      status: s.status,
      duration: Math.floor(s.recordedSec),
    },
  };
}

/** SuiteCommand (ns=recorder) → RecorderRemoteCommand für den Renderer. */
function toRemoteCommand(cmd: SuiteCommand): RecorderRemoteCommand | null {
  switch (cmd.verb) {
    case 'record': {
      const m = (cmd.args[0] ?? 'toggle').toLowerCase();
      const mode = m === 'on' || m === '1' || m === 'start' ? 'on' : m === 'off' || m === '0' || m === 'stop' ? 'off' : 'toggle';
      return { t: 'record', mode };
    }
    case 'arm':
      return { t: 'arm' };
    case 'disarm':
      return { t: 'disarm' };
    default:
      return null;
  }
}

/** Nur pushen, wenn sich der (auf ganze Sekunden gerundete) Zustand ändert. */
function pushIfChanged(): void {
  const st = toSuiteState();
  const json = JSON.stringify(st.kv);
  if (json !== lastJson) {
    lastJson = json;
    server?.pushState(st);
  }
}

export function startControlServer(
  getWin: () => BrowserWindow | null,
): Promise<{ ok: boolean; error?: string; port?: number }> {
  stopControlServer();
  getWindow = getWin;
  server = new SuiteControlServer({
    appDataDir: app.getPath('appData'),
    role: 'recorder',
    appId: 'jm-recorder',
    controlEndpoint: true,
    getState: toSuiteState,
    onCommand: (cmd) => {
      if (cmd.ns !== 'recorder') return;
      const rc = toRemoteCommand(cmd);
      if (!rc) return;
      const win = getWindow?.();
      if (win && !win.isDestroyed()) win.webContents.send('recorder:remote-cmd', rc);
    },
  });
  unsubscribe = onStateChange(pushIfChanged);
  return server.start(CONTROL_PORT);
}

export function stopControlServer(): void {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  if (server) {
    server.stop();
    server = null;
  }
  lastJson = '';
}
