// TCP-Steuerserver des Timers über das suite-weite Zeilenprotokoll
// (@jm/suite-control-protocol) — getrieben z. B. vom Bitfocus-Companion-Modul.
// Läuft NEBEN dem bestehenden Socket.IO-/HTTP-Server (state.ts ist die einzige
// Wahrheit; beide Server gehen auf dasselbe dispatch/subscribe).
//
//   Client → Timer:  TIMER START|STOP|RESET | TIMER ADD <s> | TIMER SET <s> |
//                    TIMER GOTO <block> | TIMER NEXT|PREV | STATE?
//   Timer → Client:  STATE ns=timer remaining=mm:ss remaining_s=… running=0|1
//                    overrun=0|1 warning=0|1 block_label=…
//
// mDNS: als Steuer-Endpunkt annonciert (controlEndpoint:true → TXT ctl=1, Name
// jm-timer-ctl). Der Timer hat DANEBEN einen eigenen role=timer-Advert für
// seinen Socket.IO-Server (Port 7777, von Stage Display konsumiert). Der ctl=1-
// Marker hält beide auseinander: Stage Display filtert auf !ctl (Socket.IO),
// das Companion-Modul nimmt per Auto-Discovery den ctl=1-Endpunkt (dieser Port).
import { SuiteControlServer } from '@jm/suite-control-protocol/server';
import { app } from 'electron';
import type { SuiteCommand, SuiteState } from '@jm/suite-control-protocol';
import {
  getCountdownRemaining,
  isCountdownRunning,
  type Command,
  type SyncedState,
} from '@shared/timer-state';
import { dispatch, getState, subscribe } from './state';

/** Eigener TCP-Steuerport (getrennt vom Socket.IO-Port 7777). */
export const CONTROL_PORT = 8724;

let server: SuiteControlServer | null = null;
let unsubscribe: (() => void) | null = null;
let tick: ReturnType<typeof setInterval> | null = null;

function fmtClock(totalSec: number): string {
  const neg = totalSec < 0;
  const s = Math.abs(totalSec);
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${neg ? '-' : ''}${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

/** Aktuellen Timer-Zustand in einen STATE-Push übersetzen. */
function toSuiteState(st: SyncedState = getState()): SuiteState {
  const cd = st.countdown;
  const remS = Math.round(getCountdownRemaining(cd) / 1000);
  const running = isCountdownRunning(cd);
  const idx = st.timetable.activeIndex;
  const label = idx !== null && st.timetable.items[idx] ? st.timetable.items[idx].label : '';
  return {
    ns: 'timer',
    kv: {
      remaining: fmtClock(remS),
      remaining_s: remS,
      running,
      overrun: remS < 0,
      warning: remS > 0 && remS <= st.colors.warningAtSec,
      // STATE ist whitespace-getrennt → Leerzeichen im Label ersetzen.
      block_label: label.trim().replace(/\s+/g, '_') || '-',
    },
  };
}

/** SuiteCommand (ns=timer) → Timer-Command. Liefert null bei Unbekanntem. */
function toTimerCommand(cmd: SuiteCommand): Command | null {
  switch (cmd.verb) {
    case 'start':
      return { type: 'start' };
    case 'stop':
    case 'pause':
      return { type: 'pause' };
    case 'reset':
      return { type: 'reset' };
    case 'add': {
      const sec = Number(cmd.args[0]);
      return Number.isFinite(sec) ? { type: 'addDelay', sec } : null;
    }
    case 'set': {
      const sec = Number(cmd.args[0]);
      return Number.isFinite(sec) ? { type: 'setDuration', ms: Math.max(0, Math.round(sec * 1000)) } : null;
    }
    case 'goto': {
      const n = Number(cmd.args[0]);
      return Number.isFinite(n) ? { type: 'tt:loadItem', index: Math.trunc(n) - 1 } : null;
    }
    case 'next':
      return { type: 'tt:next' };
    case 'prev':
      return { type: 'tt:prev' };
    default:
      return null;
  }
}

export function startControlServer(): Promise<{ ok: boolean; error?: string; port?: number }> {
  stopControlServer();
  server = new SuiteControlServer({
    appDataDir: app.getPath('appData'),
    role: 'timer',
    appId: 'jm-timer',
    controlEndpoint: true,
    getState: () => toSuiteState(),
    onCommand: (cmd) => {
      if (cmd.ns !== 'timer') return;
      const tc = toTimerCommand(cmd);
      if (tc) dispatch(tc); // löst subscribe → pushState aus
    },
  });
  // Jede Zustandsänderung sofort broadcasten …
  unsubscribe = subscribe((s) => server?.pushState(toSuiteState(s)));
  // … und während der Countdown läuft sekündlich (Restzeit/overrun/warning ticken).
  // pushState ist no-op ohne Clients, daher günstig.
  tick = setInterval(() => {
    if (isCountdownRunning(getState().countdown)) server?.pushState(toSuiteState());
  }, 1000);
  return server.start(CONTROL_PORT);
}

export function stopControlServer(): void {
  if (tick) {
    clearInterval(tick);
    tick = null;
  }
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  if (server) {
    server.stop();
    server = null;
  }
}
