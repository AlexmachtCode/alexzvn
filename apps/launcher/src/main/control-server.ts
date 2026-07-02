// TCP-Steuerserver des Launchers über das suite-weite Zeilenprotokoll
// (@jm/suite-control-protocol). Zweck (#11): der Launcher ist iveo-Token-Halter —
// ein Dirigent (JM Rundown per GO, Bitfocus Companion) kann die offene Show live
// auf ein iveo Side Event umschalten, OHNE je Side Event eine eigene Show anzulegen:
//
//   Client → Launcher:  LAUNCHER SIDEEVENT <programId>   (leer = Tagesübersicht)
//   Launcher → Client:  STATE ns=launcher iveo_event=… iveo_day=… iveo_side_event=…
//
// controlEndpoint:true annonciert den Endpunkt per mDNS (TXT ctl=1) → der Rundown-
// Conductor und Companion finden ihn automatisch. Der eigentliche Umschalt-Vorgang
// (Ablauf=Agenda + Speaker → Timer/Titler RELOAD) liegt in iveo-sync.switchSideEvent.
import { SuiteControlServer } from '@jm/suite-control-protocol/server';
import { app } from 'electron';
import { getLog } from '@jm/app-runtime';
import type { SuiteCommand, SuiteState } from '@jm/suite-control-protocol';
import { switchSideEvent, iveoStateKv } from './iveo-sync';

/** Eigener TCP-Steuerport (erster freier nach studio-control 8735). */
export const CONTROL_PORT = 8736;

let server: SuiteControlServer | null = null;

export function startLauncherControlServer(): Promise<{ ok: boolean; error?: string; port?: number }> {
  stopLauncherControlServer();
  server = new SuiteControlServer({
    appDataDir: app.getPath('appData'),
    role: 'launcher',
    appId: 'jm-launcher',
    controlEndpoint: true,
    getState: (): SuiteState => ({ ns: 'launcher', kv: iveoStateKv() }),
    onCommand: (cmd: SuiteCommand) => {
      if (cmd.ns !== 'launcher') return;
      if (cmd.verb === 'sideevent') {
        const programId = cmd.args[0]?.trim();
        void switchSideEvent({ programId: programId || undefined }).then((r) => {
          getLog().info(
            `iveo: LAUNCHER SIDEEVENT „${programId || '(Tagesübersicht)'}" → ${r.ok ? 'ok' : r.message}`,
          );
        });
      }
    },
  });
  return server.start(CONTROL_PORT);
}

export function stopLauncherControlServer(): void {
  if (server) {
    server.stop();
    server = null;
  }
}

/** Aktuellen iveo-Zustand an verbundene Steuer-Clients broadcasten (Companion-Variablen). */
export function pushLauncherControlState(state: SuiteState): void {
  server?.pushState(state);
}
