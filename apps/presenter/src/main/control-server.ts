// TCP-Steuerserver des Presenters über das suite-weite Zeilenprotokoll
// (@jm/suite-control-protocol) — getrieben z. B. vom Bitfocus-Companion-Modul.
// Läuft NEBEN dem HTTP+SSE-Remote (Port 7330) und nutzt dieselbe Befehls-/State-
// Logik aus present.ts (die einzige Wahrheit; beide Pfade gehen dorthin).
//
//   Client → Presenter:  PRESENTER NEXT|PREV | PRESENTER GOTO <n> |
//                        PRESENTER BLACK|WHITE|LIVE|STOP | STATE?
//   Presenter → Client:  STATE ns=presenter slide=<n> total=<n> active=0|1
//                        live=0|1 black=0|1 white=0|1
//
// mDNS: als Steuer-Endpunkt annonciert (controlEndpoint:true → TXT ctl=1, Name
// jm-presenter-ctl). Presenter hat DANEBEN einen role=presenter-Advert für sein
// HTTP+SSE-Remote (Port 7330, von Stage Display konsumiert); ctl=1 hält beide
// auseinander (Stage Display filtert !ctl, Companion nimmt ctl=1).
import { SuiteControlServer } from '@jm/suite-control-protocol/server';
import { app } from 'electron';
import type { SuiteState } from '@jm/suite-control-protocol';
import { getState, goto, next, prev, setScreen, stopPresentation, subscribe } from './present';
import { openByPath } from './control-open';

/** Eigener TCP-Steuerport (getrennt vom HTTP-Remote 7330). */
export const CONTROL_PORT = 8728;

let server: SuiteControlServer | null = null;
let unsubscribe: (() => void) | null = null;

function toSuiteState(): SuiteState {
  const s = getState();
  return {
    ns: 'presenter',
    kv: {
      slide: s.total > 0 ? s.index + 1 : 0, // 1-basiert (0 = keine Präsentation)
      total: s.total,
      active: s.active,
      live: s.screen === 'live',
      black: s.screen === 'black',
      white: s.screen === 'white',
    },
  };
}

export function startControlServer(): Promise<{ ok: boolean; error?: string; port?: number }> {
  stopControlServer();
  server = new SuiteControlServer({
    appDataDir: app.getPath('appData'),
    role: 'presenter',
    appId: 'jm-presenter',
    controlEndpoint: true,
    getState: toSuiteState,
    onCommand: (cmd, ctx) => {
      if (cmd.ns !== 'presenter') return;
      switch (cmd.verb) {
        case 'open': {
          // Pfad aus der ROHEN Zeile rekonstruieren — Dateipfade enthalten
          // Leerzeichen, der Token-Parser (split /\s+/) würde sie zerlegen.
          const p = ctx.raw.replace(/^\s*presenter\s+open\s+/i, '').trim();
          if (p) void openByPath(p);
          break;
        }
        case 'next':
          next();
          break;
        case 'prev':
          prev();
          break;
        case 'goto': {
          const n = Number(cmd.args[0]);
          if (Number.isFinite(n)) goto(Math.trunc(n) - 1); // 1-basiert → 0-basiert
          break;
        }
        case 'black':
          setScreen('black');
          break;
        case 'white':
          setScreen('white');
          break;
        case 'live':
          setScreen('live');
          break;
        case 'stop':
          stopPresentation();
          break;
      }
    },
  });
  // present.ts ist die Wahrheit → bei jeder Änderung den TCP-Clients pushen.
  unsubscribe = subscribe(() => server?.pushState(toSuiteState()));
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
}
