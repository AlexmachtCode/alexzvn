// TCP-Steuerserver des Rundowns über das suite-weite Zeilenprotokoll
// (@jm/suite-control-protocol) — so kann der Ablauf selbst per Bitfocus Companion
// (oder einem anderen Dirigenten) ferngesteuert werden:
//
//   Client → Rundown:  RUNDOWN GO | RUNDOWN NEXT | RUNDOWN PREV |
//                      RUNDOWN GOTO <n> | STATE?
//                      RUNDOWN RELOAD — intern vom Launcher nach einer
//                      iveo-Änderung (Teil 2a, Spec 5.1), wie TIMER RELOAD
//                      nicht im Companion-Katalog
//   Rundown → Client:  STATE ns=rundown cue=<n> total=<n> label=<titel>
//
// Der Zustand (doc + scharfe Zeile) lebt modul-lokal in index.ts → Callback-
// Verdrahtung (getState/onCommand). controlEndpoint:true annonciert den Endpunkt
// per mDNS mit TXT ctl=1 (Name jm-rundown-ctl) → Companion findet ihn automatisch.
import { SuiteControlServer } from '@jm/suite-control-protocol/server';
import { app } from 'electron';
import type { SuiteCommand, SuiteState } from '@jm/suite-control-protocol';
import type { FernsteuerungEreignis } from '@shared/fernsteuerung';

/** Eigener TCP-Steuerport. */
export const CONTROL_PORT = 8731;

let server: SuiteControlServer | null = null;

export interface RundownControlHandlers {
  getState: () => SuiteState;
  onCommand: (cmd: SuiteCommand) => void;
  /**
   * UX Welle 1 (Spec 3.9): Statusmeldung des Servers (läuft, Port, Clients) mit wirksamem Modus, nur lesend.
   * Der Main macht daraus die Fernsteuerungs-Meldung für die Statusleiste.
   */
  onMeldung?: (e: FernsteuerungEreignis) => void;
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
    onStatus: (st) => {
      handlers.onMeldung?.({ art: 'status', ...st, modus: server?.modus() });
    },
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
