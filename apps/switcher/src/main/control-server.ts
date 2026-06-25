// TCP-Steuerserver (Slice 6): Fernsteuerung des Switchers über das suite-weite
// Zeilenprotokoll @jm/suite-control-protocol — getrieben z. B. vom Bitfocus-
// Companion-Modul.
//
//   Client → Switcher: PREVIEW/PROGRAM/CUT/AUTO/RECORD/STREAM/STATE?
//   Switcher → Client: STATE ns=switcher … (auf Verbindung, bei jeder Änderung)
//
// Der eigentliche Zustand lebt im Renderer (Engine/Output). Befehle werden per
// IPC dorthin geschickt; der Renderer meldet seinen Zustand via pushState()
// zurück, den wir cachen + an alle Clients broadcasten.
//
// Implementiert als dünner Wrapper um SuiteControlServer (geteilte Server-Logik
// für die ganze Suite). Die exportierten Funktionen bleiben unverändert, damit
// ipc.ts und index.ts nicht angefasst werden müssen. Das gesendete STATE-Format
// (`ns=switcher` + program/preview/…) ist rückwärtskompatibel zum alten
// Companion-Modul (liest die Felder per Schlüssel, ignoriert ns).
import type { BrowserWindow } from 'electron';
import { SuiteControlServer } from '@jm/suite-control-protocol/server';
import { app } from 'electron';
import {
  parseCommand,
  switcherStateToSuite,
  type ControlCommand,
  type SwitcherStateMsg,
} from '@jm/suite-control-protocol';

let server: SuiteControlServer | null = null;
let targetWindow: BrowserWindow | null = null;
let lastState: SwitcherStateMsg = {
  program: 0,
  preview: 0,
  recording: false,
  streaming: false,
  scenes: 0,
};

export interface ControlStatus {
  running: boolean;
  port: number;
  clients: number;
}

export function attachControlWindow(win: BrowserWindow): void {
  targetWindow = win;
}

export function controlStatus(): ControlStatus {
  return server?.status() ?? { running: false, port: 0, clients: 0 };
}

// Beim Beenden räumt stopControlServer() auf, während das Fenster schon zerstört
// ist (Socket-close/notifyStatus feuern dann noch). `?.` schützt nur gegen null,
// nicht gegen ein zerstörtes webContents → sonst „Object has been destroyed".
function send(channel: string, payload: unknown): void {
  if (!targetWindow || targetWindow.isDestroyed()) return;
  const wc = targetWindow.webContents;
  if (!wc.isDestroyed()) wc.send(channel, payload);
}

export function startControlServer(port: number): Promise<{ ok: boolean; error?: string; port?: number }> {
  stopControlServer();
  server = new SuiteControlServer({
    appDataDir: app.getPath('appData'),
    role: 'switcher',
    appId: 'jm-switcher',
    getState: () => switcherStateToSuite(lastState),
    onCommand: (_cmd, ctx) => {
      // Auf die bestehende, vom Renderer erwartete ControlCommand-Form mappen
      // (Legacy-Parser auf der Rohzeile). STATE? beantwortet der Server selbst.
      const legacy = parseCommand(ctx.raw);
      if (legacy && legacy.type !== 'queryState') send('control:command', legacy as ControlCommand);
    },
    onStatus: () => send('control:status', controlStatus()),
  });
  return server.start(port);
}

export function stopControlServer(): void {
  if (server) {
    server.stop();
    server = null;
  }
}

/** Renderer meldet neuen Zustand → cachen + an alle Clients broadcasten. */
export function pushState(state: SwitcherStateMsg): void {
  lastState = state;
  server?.pushState(switcherStateToSuite(state));
}
