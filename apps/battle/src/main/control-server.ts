// TCP-Steuerserver von JM Battle über das suite-weite Zeilenprotokoll
// (@jm/suite-control-protocol) — fernsteuerbar per Bitfocus Companion:
//
//   Client → Battle:  BATTLE NEXT | PREV | WIN a|b|tie | VOTING on|off|toggle |
//                     VS on|off|toggle | REPLAY | RESET | STATE?
//   Battle → Client:  STATE ns=battle round=2 total=3 wins_a=1 wins_b=0 votes_a=… live=1 …
//
// controlEndpoint:true annonciert den Endpunkt per mDNS (TXT ctl=1, Name
// jm-battle-ctl) → Companion findet ihn automatisch.
import { SuiteControlServer } from '@jm/suite-control-protocol/server';
import { app } from 'electron';
import type { SuiteCommand, SuiteState } from '@jm/suite-control-protocol';

export const CONTROL_PORT = 8734;

let server: SuiteControlServer | null = null;

export interface BattleControlHandlers {
  getState: () => SuiteState;
  onCommand: (cmd: SuiteCommand) => void;
}

export function startControlServer(
  handlers: BattleControlHandlers,
): Promise<{ ok: boolean; error?: string; port?: number }> {
  stopControlServer();
  server = new SuiteControlServer({
    appDataDir: app.getPath('appData'),
    role: 'battle',
    appId: 'jm-battle',
    controlEndpoint: true,
    getState: handlers.getState,
    onCommand: (cmd) => {
      if (cmd.ns === 'battle') handlers.onCommand(cmd);
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

export function pushControlState(state: SuiteState): void {
  server?.pushState(state);
}

/** on/off/toggle → konkreter Soll-Zustand (Roh-Telnet kann 'toggle' schicken). */
export function resolveMode(arg: string | undefined, current: boolean): boolean {
  const a = String(arg ?? 'toggle').toLowerCase();
  if (a === 'on' || a === '1' || a === 'true') return true;
  if (a === 'off' || a === '0' || a === 'false') return false;
  return !current;
}
