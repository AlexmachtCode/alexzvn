/**
 * Shared state module — used by both the Electron main process (authoritative)
 * and the renderer (mirrored copy). Must stay platform-agnostic: no DOM, no Node.
 */

export interface ColorConfig {
  /** while remaining > warningAtSec */
  normal: string;
  /** while remaining <= warningAtSec and > 0 */
  warning: string;
  /** while remaining <= 0 (overtime) */
  overtime: string;
  /** seconds threshold for normal → warning */
  warningAtSec: number;
}

export interface CountdownState {
  durationMs: number;
  delayMs: number;
  startedAtMs: number | null;
  pausedRemainingMs: number | null;
}

export interface TimetableItem {
  id: string;
  label: string;
  durationMs: number;
  note?: string;
  /** Geplante Startzeit als ms seit LOKALER Mitternacht (Tageszeit). Optional; leer = aus der Kette. */
  plannedStartMs?: number;
  /** Verantwortlich (freier Text). Optional. */
  owner?: string;
  /** Kategorie (freier Text). Optional. */
  category?: string;
}

export interface TimetableState {
  items: TimetableItem[];
  /** Index of the item currently loaded into the countdown, or null when ad-hoc. */
  activeIndex: number | null;
  /** When true, the operator window auto-advances to the next item after the
   *  current item's countdown reaches -graceSec (i.e. graceSec overtime). */
  autoAdvance: boolean;
  /** Grace period in seconds after overtime before auto-advance fires. */
  autoAdvanceGraceSec: number;
}

export interface MessageState {
  /** Free-form text shown on Speaker view. Empty = no message. */
  text: string;
  /** When true, the message hard-cuts on/off at ~1Hz. */
  blinking: boolean;
}

export interface SyncedState {
  countdown: CountdownState;
  colors: ColorConfig;
  timetable: TimetableState;
  message: MessageState;
}

export const DEFAULT_COLORS: ColorConfig = {
  normal: '#FFE819',
  warning: '#FFB81C',
  overtime: '#F61C56',
  warningAtSec: 60,
};

export const INITIAL_STATE: SyncedState = {
  countdown: {
    durationMs: 5 * 60 * 1000,
    delayMs: 0,
    startedAtMs: null,
    pausedRemainingMs: null,
  },
  colors: { ...DEFAULT_COLORS },
  timetable: {
    items: [],
    activeIndex: null,
    autoAdvance: false,
    autoAdvanceGraceSec: 5,
  },
  message: { text: '', blinking: false },
};

export type Command =
  | { type: 'setDuration'; ms: number }
  | { type: 'start' }
  | { type: 'pause' }
  | { type: 'reset' }
  | { type: 'addDelay'; sec: number }
  | { type: 'clearDelay' }
  | { type: 'setColors'; patch: Partial<ColorConfig> }
  | { type: 'tt:add'; item: Omit<TimetableItem, 'id'> }
  | { type: 'tt:update'; id: string; patch: Partial<Omit<TimetableItem, 'id'>> }
  | { type: 'tt:delete'; id: string }
  | { type: 'tt:move'; id: string; direction: 'up' | 'down' }
  | { type: 'tt:setAll'; items: Array<Omit<TimetableItem, 'id'>> }
  | { type: 'tt:replaceItems'; items: Array<Omit<TimetableItem, 'id'>> }
  | { type: 'tt:loadItem'; index: number }
  | { type: 'tt:next' }
  | { type: 'tt:prev' }
  | { type: 'tt:clearActive' }
  | { type: 'tt:setAutoAdvance'; enabled: boolean }
  | { type: 'tt:setAutoAdvanceGrace'; sec: number }
  | { type: 'msg:set'; text: string }
  | { type: 'msg:setBlink'; blinking: boolean }
  | { type: 'msg:clear' };

function makeId(): string {
  // randomUUID is available in Node 14.17+ and modern browsers
  const c: { randomUUID?: () => string } | undefined =
    (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function resetCountdownToDuration(durationMs: number): CountdownState {
  return {
    durationMs,
    delayMs: 0,
    startedAtMs: null,
    pausedRemainingMs: null,
  };
}

export function reduce(
  state: SyncedState,
  cmd: Command,
  now: number = Date.now(),
): SyncedState {
  const cd = state.countdown;
  const tt = state.timetable;

  switch (cmd.type) {
    case 'setDuration': {
      // Manual duration override clears any active timetable item.
      return {
        ...state,
        countdown: resetCountdownToDuration(Math.max(0, cmd.ms)),
        timetable: tt.activeIndex !== null ? { ...tt, activeIndex: null } : tt,
      };
    }

    case 'start': {
      if (cd.startedAtMs !== null) return state;
      const effective = cd.durationMs + cd.delayMs;
      const startedAtMs =
        cd.pausedRemainingMs !== null
          ? now - (effective - cd.pausedRemainingMs)
          : now;
      return {
        ...state,
        countdown: { ...cd, startedAtMs, pausedRemainingMs: null },
      };
    }

    case 'pause': {
      if (cd.startedAtMs === null) return state;
      const elapsed = now - cd.startedAtMs;
      const remaining = cd.durationMs + cd.delayMs - elapsed;
      return {
        ...state,
        countdown: { ...cd, startedAtMs: null, pausedRemainingMs: remaining },
      };
    }

    case 'reset':
      return { ...state, countdown: resetCountdownToDuration(cd.durationMs) };

    case 'addDelay': {
      const deltaMs = Math.round(cmd.sec * 1000);
      const nextPaused =
        cd.pausedRemainingMs !== null ? cd.pausedRemainingMs + deltaMs : null;
      return {
        ...state,
        countdown: {
          ...cd,
          delayMs: cd.delayMs + deltaMs,
          pausedRemainingMs: nextPaused,
        },
      };
    }

    case 'clearDelay': {
      if (cd.delayMs === 0) return state;
      const nextPaused =
        cd.pausedRemainingMs !== null ? cd.pausedRemainingMs - cd.delayMs : null;
      return {
        ...state,
        countdown: { ...cd, delayMs: 0, pausedRemainingMs: nextPaused },
      };
    }

    case 'setColors':
      return { ...state, colors: { ...state.colors, ...cmd.patch } };

    case 'tt:add': {
      const newItem: TimetableItem = { id: makeId(), ...cmd.item };
      return {
        ...state,
        timetable: { ...tt, items: [...tt.items, newItem] },
      };
    }

    case 'tt:update': {
      const items = tt.items.map((it) =>
        it.id === cmd.id ? { ...it, ...cmd.patch } : it,
      );
      // If the currently active item's duration changed, mirror that into the countdown.
      const activeItem =
        tt.activeIndex !== null ? items[tt.activeIndex] : undefined;
      if (
        tt.activeIndex !== null &&
        activeItem &&
        items[tt.activeIndex].id === cmd.id &&
        'durationMs' in cmd.patch &&
        cd.startedAtMs === null &&
        cd.pausedRemainingMs === null
      ) {
        return {
          ...state,
          timetable: { ...tt, items },
          countdown: resetCountdownToDuration(activeItem.durationMs),
        };
      }
      return { ...state, timetable: { ...tt, items } };
    }

    case 'tt:delete': {
      const idx = tt.items.findIndex((it) => it.id === cmd.id);
      if (idx === -1) return state;
      const items = tt.items.filter((it) => it.id !== cmd.id);
      let activeIndex = tt.activeIndex;
      if (activeIndex !== null) {
        if (idx === activeIndex) activeIndex = null;
        else if (idx < activeIndex) activeIndex -= 1;
      }
      return { ...state, timetable: { ...tt, items, activeIndex } };
    }

    case 'tt:move': {
      const idx = tt.items.findIndex((it) => it.id === cmd.id);
      if (idx === -1) return state;
      const newIdx = cmd.direction === 'up' ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= tt.items.length) return state;
      const items = [...tt.items];
      const [item] = items.splice(idx, 1);
      items.splice(newIdx, 0, item);
      let activeIndex = tt.activeIndex;
      if (activeIndex !== null) {
        if (activeIndex === idx) activeIndex = newIdx;
        else if (idx < activeIndex && newIdx >= activeIndex) activeIndex -= 1;
        else if (idx > activeIndex && newIdx <= activeIndex) activeIndex += 1;
      }
      return { ...state, timetable: { ...tt, items, activeIndex } };
    }

    case 'tt:setAll': {
      const items: TimetableItem[] = cmd.items.map((it) => ({
        id: makeId(),
        ...it,
      }));
      return {
        ...state,
        timetable: { ...tt, items, activeIndex: null },
        countdown: resetCountdownToDuration(cd.durationMs),
      };
    }

    case 'tt:replaceItems': {
      // Nicht-destruktives Ersetzen für Live-Updates (z. B. iveo-Reload während
      // der Show): tauscht die Items, hält den aktiven Index (geklemmt) und lässt
      // den Countdown UNANGETASTET — ein laufender Timer darf nie resetten.
      const items: TimetableItem[] = cmd.items.map((it) => ({ id: makeId(), ...it }));
      let activeIndex = tt.activeIndex;
      if (activeIndex !== null && (items.length === 0 || activeIndex >= items.length)) {
        activeIndex = items.length ? items.length - 1 : null;
      }
      return { ...state, timetable: { ...tt, items, activeIndex } };
    }

    case 'tt:loadItem': {
      if (cmd.index < 0 || cmd.index >= tt.items.length) return state;
      const item = tt.items[cmd.index];
      return {
        ...state,
        timetable: { ...tt, activeIndex: cmd.index },
        countdown: resetCountdownToDuration(item.durationMs),
      };
    }

    case 'tt:next': {
      if (tt.activeIndex === null) {
        // No active item → load first if available
        if (tt.items.length === 0) return state;
        const item = tt.items[0];
        return {
          ...state,
          timetable: { ...tt, activeIndex: 0 },
          countdown: resetCountdownToDuration(item.durationMs),
        };
      }
      if (tt.activeIndex >= tt.items.length - 1) return state;
      const newIndex = tt.activeIndex + 1;
      const item = tt.items[newIndex];
      return {
        ...state,
        timetable: { ...tt, activeIndex: newIndex },
        countdown: resetCountdownToDuration(item.durationMs),
      };
    }

    case 'tt:prev': {
      if (tt.activeIndex === null || tt.activeIndex <= 0) return state;
      const newIndex = tt.activeIndex - 1;
      const item = tt.items[newIndex];
      return {
        ...state,
        timetable: { ...tt, activeIndex: newIndex },
        countdown: resetCountdownToDuration(item.durationMs),
      };
    }

    case 'tt:clearActive':
      if (tt.activeIndex === null) return state;
      return { ...state, timetable: { ...tt, activeIndex: null } };

    case 'tt:setAutoAdvance':
      return { ...state, timetable: { ...tt, autoAdvance: cmd.enabled } };

    case 'tt:setAutoAdvanceGrace': {
      const sec = Math.max(0, Math.round(cmd.sec));
      return { ...state, timetable: { ...tt, autoAdvanceGraceSec: sec } };
    }

    case 'msg:set': {
      const text = cmd.text;
      // Clearing the text auto-disables blinking.
      const blinking = text.trim().length === 0 ? false : state.message.blinking;
      return { ...state, message: { text, blinking } };
    }

    case 'msg:setBlink':
      return { ...state, message: { ...state.message, blinking: cmd.blinking } };

    case 'msg:clear':
      return { ...state, message: { text: '', blinking: false } };
  }
}

export function effectiveDurationMs(cd: CountdownState): number {
  return cd.durationMs + cd.delayMs;
}

export function getCountdownRemaining(
  cd: CountdownState,
  now: number = Date.now(),
): number {
  if (cd.startedAtMs !== null) {
    return effectiveDurationMs(cd) - (now - cd.startedAtMs);
  }
  if (cd.pausedRemainingMs !== null) return cd.pausedRemainingMs;
  return effectiveDurationMs(cd);
}

/** Projected wall-clock ms when the timer reaches zero. Null when idle. */
export function getProjectedEndMs(
  cd: CountdownState,
  now: number = Date.now(),
): number | null {
  if (cd.startedAtMs !== null) {
    return cd.startedAtMs + effectiveDurationMs(cd);
  }
  if (cd.pausedRemainingMs !== null) return now + cd.pausedRemainingMs;
  return null;
}

export function isCountdownRunning(cd: CountdownState): boolean {
  return cd.startedAtMs !== null;
}

export function isCountdownPaused(cd: CountdownState): boolean {
  return cd.startedAtMs === null && cd.pausedRemainingMs !== null;
}

/**
 * Projects wall-clock start times for every item in the timetable, given the
 * currently active item and a reference time. Returns null for items before
 * the active one (already past) and an absolute ms timestamp for upcoming.
 */
export function getProjectedSchedule(
  tt: TimetableState,
  cd: CountdownState,
  now: number = Date.now(),
): Array<number | null> {
  const out: Array<number | null> = new Array(tt.items.length).fill(null);
  if (tt.activeIndex === null) return out;

  // Anchor = projected end of the active item
  const activeEnd =
    getProjectedEndMs(cd, now) ?? now + effectiveDurationMs(cd);

  // The active item's start: if running, that's startedAtMs; otherwise treat now as start
  out[tt.activeIndex] = cd.startedAtMs ?? now;

  let cursor = activeEnd;
  for (let i = tt.activeIndex + 1; i < tt.items.length; i++) {
    out[i] = cursor;
    cursor += tt.items[i].durationMs;
  }
  return out;
}

/** 00:00 des lokalen Tages von `now` als absolute ms. */
export function midnightMsLocal(now: number = Date.now()): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Geplante Tageszeit (ms seit Mitternacht) je Item, oder null. Ohne einen einzigen
 * expliziten `plannedStartMs` → alles null (kein Plan). Sonst Vorwärts-Kette ab dem
 * ersten Anker; ein expliziter Wert verankert die Kette neu (Fixslot); Items vor dem
 * ersten Anker bleiben null.
 */
export function computePlannedSchedule(items: TimetableItem[]): Array<number | null> {
  const out: Array<number | null> = new Array(items.length).fill(null);
  const hasAnchor = items.some((it) => it.plannedStartMs !== undefined && it.plannedStartMs !== null);
  if (!hasAnchor) return out;
  let cursor: number | null = null;
  for (let i = 0; i < items.length; i++) {
    const explicit = items[i].plannedStartMs;
    if (explicit !== undefined && explicit !== null) {
      out[i] = explicit;
      cursor = explicit + items[i].durationMs;
    } else if (cursor !== null) {
      out[i] = cursor;
      cursor += items[i].durationMs;
    }
  }
  return out;
}

export interface DriftPerItem {
  plannedClockMs: number;
  projectedClockMs: number;
  deltaMs: number;
}
export interface DriftResult {
  driftMs: number | null;
  perItem: Array<DriftPerItem | null>;
}

/**
 * Soll/Ist-Drift. Projektion ist LIVE-bewusst: das Ende des aktiven Punktes ist
 * frühestens `now` (damit Überzug in die Drift durchschlägt). driftMs (Headline) =
 * Delta des nächsten Punktes (fällt auf den aktiven zurück). null, wenn kein Plan.
 */
export function computeDrift(
  tt: TimetableState,
  cd: CountdownState,
  now: number = Date.now(),
): DriftResult {
  const items = tt.items;
  const plannedOfDay = computePlannedSchedule(items);
  const midnight = midnightMsLocal(now);
  const projected: Array<number | null> = new Array(items.length).fill(null);
  if (tt.activeIndex !== null) {
    projected[tt.activeIndex] = cd.startedAtMs ?? now;
    const plannedEnd = getProjectedEndMs(cd, now) ?? now + effectiveDurationMs(cd);
    let cursor = Math.max(plannedEnd, now);
    for (let i = tt.activeIndex + 1; i < items.length; i++) {
      projected[i] = cursor;
      cursor += items[i].durationMs;
    }
  }
  const perItem: Array<DriftPerItem | null> = items.map((_, i) => {
    const p = projected[i];
    const pod = plannedOfDay[i];
    if (p === null || pod === null) return null;
    const plannedClockMs = midnight + pod;
    return { plannedClockMs, projectedClockMs: p, deltaMs: p - plannedClockMs };
  });
  let driftMs: number | null = null;
  const idx = tt.activeIndex;
  if (idx !== null) {
    const nextItem = perItem[idx + 1];
    if (idx + 1 < perItem.length && nextItem) driftMs = nextItem.deltaMs;
    else if (perItem[idx]) driftMs = perItem[idx]!.deltaMs;
  }
  return { driftMs, perItem };
}
