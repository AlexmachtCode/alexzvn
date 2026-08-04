import { create } from 'zustand';
import { sendCommand } from '@/sync/client';
import {
  INITIAL_STATE,
  type ColorConfig,
  type CountdownState,
  type SyncedState,
  type TimetableItem,
} from '@shared/timer-state';

export type Mode = 'clock' | 'countdown' | 'timetable' | 'remote' | 'settings';

export interface AppState extends SyncedState {
  /** Per-window view selection (not synced). */
  mode: Mode;
  /** Live websocket status. */
  connected: boolean;

  setMode: (mode: Mode) => void;
  setConnected: (c: boolean) => void;
  /** Called by the sync client when the server pushes a new state. */
  applyServerState: (s: SyncedState) => void;

  // Countdown commands
  setCountdownDuration: (ms: number) => void;
  startCountdown: () => void;
  pauseCountdown: () => void;
  resetCountdown: () => void;
  addDelay: (deltaSec: number) => void;
  clearDelay: () => void;
  setColors: (patch: Partial<ColorConfig>) => void;

  // Timetable commands
  ttAdd: (item: Omit<TimetableItem, 'id'>) => void;
  ttUpdate: (id: string, patch: Partial<Omit<TimetableItem, 'id'>>) => void;
  ttDelete: (id: string) => void;
  ttMove: (id: string, direction: 'up' | 'down') => void;
  ttSetAll: (items: Array<Omit<TimetableItem, 'id'>>) => void;
  ttLoadItem: (index: number) => void;
  ttNext: () => void;
  ttPrev: () => void;
  ttClearActive: () => void;
  ttSetAutoAdvance: (enabled: boolean) => void;
  ttSetAutoAdvanceGrace: (sec: number) => void;

  // Message commands
  setMessage: (text: string) => void;
  setMessageBlink: (blinking: boolean) => void;
  clearMessage: () => void;
}

export const useStore = create<AppState>((set) => ({
  ...INITIAL_STATE,
  mode: 'clock',
  connected: false,

  setMode: (mode) => set({ mode }),
  setConnected: (connected) => set({ connected }),
  applyServerState: (s) =>
    set({
      countdown: s.countdown,
      colors: s.colors,
      timetable: s.timetable,
      message: s.message,
    }),

  setCountdownDuration: (ms) => sendCommand({ type: 'setDuration', ms }),
  startCountdown: () => sendCommand({ type: 'start' }),
  pauseCountdown: () => sendCommand({ type: 'pause' }),
  resetCountdown: () => sendCommand({ type: 'reset' }),
  addDelay: (sec) => sendCommand({ type: 'addDelay', sec }),
  clearDelay: () => sendCommand({ type: 'clearDelay' }),
  setColors: (patch) => sendCommand({ type: 'setColors', patch }),

  ttAdd: (item) => sendCommand({ type: 'tt:add', item }),
  ttUpdate: (id, patch) => sendCommand({ type: 'tt:update', id, patch }),
  ttDelete: (id) => sendCommand({ type: 'tt:delete', id }),
  ttMove: (id, direction) => sendCommand({ type: 'tt:move', id, direction }),
  ttSetAll: (items) => sendCommand({ type: 'tt:setAll', items }),
  ttLoadItem: (index) => sendCommand({ type: 'tt:loadItem', index }),
  ttNext: () => sendCommand({ type: 'tt:next' }),
  ttPrev: () => sendCommand({ type: 'tt:prev' }),
  ttClearActive: () => sendCommand({ type: 'tt:clearActive' }),
  ttSetAutoAdvance: (enabled) =>
    sendCommand({ type: 'tt:setAutoAdvance', enabled }),
  ttSetAutoAdvanceGrace: (sec) =>
    sendCommand({ type: 'tt:setAutoAdvanceGrace', sec }),

  setMessage: (text) => sendCommand({ type: 'msg:set', text }),
  setMessageBlink: (blinking) => sendCommand({ type: 'msg:setBlink', blinking }),
  clearMessage: () => sendCommand({ type: 'msg:clear' }),
}));

export {
  effectiveDurationMs,
  getCountdownRemaining,
  getProjectedEndMs,
  getProjectedSchedule,
  computeDrift,
  isCountdownPaused,
  isCountdownRunning,
} from '@shared/timer-state';

export type { ColorConfig, CountdownState, TimetableItem };
