import type { PresentationPayload, PresentationState, ScreenMode } from '@shared/types';
import {
  broadcastAll,
  closePresentationWindows,
  openAudienceWindow,
  openPresenterWindow,
  setPresentationClosedHandler,
} from './windows';
import { naechsterIndex, normiereWiedergabe, standzeitFuer, WIEDERGABE_VORGABE } from '../shared/wiedergabe';
import type { Wiedergabe } from '@shared/types';

// The main process owns the live presentation so presenter + audience windows
// (separate renderers) always agree on the current slide.
let payload: PresentationPayload | null = null;
let state: PresentationState = { active: false, index: 0, total: 0, screen: 'live' };

// #293: Wiedergabe des laufenden Projekts + Timer der Schleife. Der Timer lebt hier im Main,
// damit Tastatur, Fernbedienung und Companion dieselbe Schleife sehen und neu starten.
let wiedergabe: Wiedergabe = WIEDERGABE_VORGABE;
let schleifenTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Nächstes Selbst-Weiterblättern planen — bei jeder Zustandsänderung neu: Hand-Navigation startet
 * die Standzeit neu, Schwarz-/Weißbild und „Schleife aus“ halten an, eine Folie allein blättert nicht.
 */
function planeSchleife(): void {
  if (schleifenTimer) {
    clearTimeout(schleifenTimer);
    schleifenTimer = null;
  }
  const slide = payload?.slides[state.index];
  if (!state.active || !state.schleife || state.screen !== 'live' || state.total < 2 || !slide) {
    state = { ...state, schleifeBisMs: null };
    return;
  }
  const ms = standzeitFuer(slide, wiedergabe) * 1000;
  state = { ...state, schleifeBisMs: Date.now() + ms };
  schleifenTimer = setTimeout(() => {
    schleifenTimer = null;
    goto(naechsterIndex(state.index, state.total, true));
  }, ms);
}

// Monotonic revision, bumped on every state change. Network consumers (the stage
// display) use it to know when to refetch the rendered slide image (#38, 2b).
let rev = 0;

// Subscribers notified on every state change (the network remote pushes these to
// connected phones via SSE). Kept here so present.ts stays the single source of
// truth — windows get the broadcast, the remote gets the callback.
const listeners = new Set<() => void>();
export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function clampIndex(i: number): number {
  if (state.total <= 0) return 0;
  return Math.max(0, Math.min(i, state.total - 1));
}

function publish(): void {
  planeSchleife();
  rev++;
  broadcastAll('present:state', state);
  for (const cb of listeners) cb();
}

export function getPayload(): PresentationPayload | null {
  return payload;
}

export function getState(): PresentationState {
  return state;
}

/** Compact view for the phone remote: current/next titles + notes + position. */
export function getRemoteView(): {
  active: boolean;
  index: number;
  total: number;
  screen: ScreenMode;
  title: string;
  notes: string;
  nextTitle: string | null;
  rev: number;
} {
  const slides = payload?.slides ?? [];
  const current = slides[state.index];
  const next = slides[state.index + 1];
  return {
    active: state.active,
    index: state.index,
    total: state.total,
    screen: state.screen,
    title: current?.title ?? '',
    notes: current?.notes ?? '',
    nextTitle: next ? next.title || `Folie ${state.index + 2}` : null,
    rev,
  };
}

export function startPresentation(
  next: PresentationPayload,
  audienceDisplayId: number | null,
): void {
  payload = next;
  wiedergabe = normiereWiedergabe(next.wiedergabe);
  state = {
    active: true,
    index: clampIndexFor(next.slides.length, next.startIndex),
    total: next.slides.length,
    screen: 'live',
    schleife: wiedergabe.schleife,
    schleifeBisMs: null,
  };
  openPresenterWindow();
  openAudienceWindow(audienceDisplayId);
  // Windows pull the payload via present:getPayload once their renderer loads;
  // the initial state is broadcast as soon as they subscribe (they also call
  // present:getState on mount).
  publish();
}

function clampIndexFor(total: number, i: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(i, total - 1));
}

export function goto(index: number): void {
  // Navigating always clears a black/white pause screen — you want to see the
  // slide you just jumped to.
  state = { ...state, index: clampIndex(index), screen: 'live' };
  publish();
}

export function next(): void {
  // Mit Schleife geht es nach der letzten Folie wieder zur ersten (#293).
  goto(naechsterIndex(state.index, state.total, state.schleife === true));
}

export function prev(): void {
  goto(state.index - 1);
}

/** Set the audience pause screen. Selecting the active mode again returns to live. */
export function setScreen(mode: ScreenMode): void {
  if (!state.active) return;
  const nextMode: ScreenMode = state.screen === mode ? 'live' : mode;
  state = { ...state, screen: nextMode };
  publish();
}

/** #293: Schleife live an-/ausschalten (Referentenansicht). */
export function setSchleife(an: boolean): void {
  if (!state.active) return;
  state = { ...state, schleife: an };
  publish();
}

export function stopPresentation(): void {
  if (!state.active) return; // guard re-entrancy from window 'closed' events
  state = { active: false, index: 0, total: 0, screen: 'live' };
  payload = null;
  publish();
  closePresentationWindows();
}

// Closing either presentation window ends the presentation cleanly.
setPresentationClosedHandler(stopPresentation);
