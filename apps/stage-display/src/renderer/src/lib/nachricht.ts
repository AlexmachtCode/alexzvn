import type { StageState } from '@shared/types';

export interface BuehnenNachricht {
  text: string;
  blinkt: boolean;
}

/** Ad-hoc-Nachricht (getrimmt) vor Timer-Nachricht (nur mit Anzeige-Element „Timer“); blinkt nur die Timer-Nachricht,
 *  wenn der Timer blinkt. Haken „Nachricht“ aus oder kein Text → null. Regeln wie bisher in StageScreen. */
export function buehnenNachricht(state: StageState): BuehnenNachricht | null {
  const { config, timer } = state;
  const w = config.widgets;
  if (!w.message) return null;
  const adHoc = config.message.trim();
  const timerMsg = w.timer ? timer.message.trim() : '';
  const text = adHoc || timerMsg;
  if (!text) return null;
  return { text, blinkt: !adHoc && timer.blinking };
}
