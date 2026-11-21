// Haupttasten des Timers als TallyButtons (UX Welle 1, Aufgabe d; Spec 3.4, 5.1, Anhang A „Timer“; E8, E9): Countdown zwei
// (Start/Pause, Reset), Ablauf vier (← Prev, Start/Pause, Reset, Next →). Zustände kommen aus hauptTasten (lib/oberflaeche.ts),
// die Handler sind die des Stores (startCountdown, pauseCountdown, resetCountdown, ttPrev, ttNext). Kürzel zeigt nur der
// Countdown (Leertaste, R; der Handler dazu liegt in Countdown.tsx). Rein darstellend: kein window, kein Effekt.
import { TallyButton, type TallyButtonProps } from '@jm/ui';
import { isCountdownRunning } from '@shared/timer-state';
import { hauptTasten, type OberflaechenStand } from '@/lib/oberflaeche';

export interface HauptAktionen {
  start(): void;
  pause(): void;
  reset(): void;
  prev(): void;
  next(): void;
}

/** Die Haupttasten als Props in Anzeigereihenfolge; leer für die Uhr. Ohne DOM prüfbar. */
export function liveTasten(s: Pick<OberflaechenStand, 'timer'>, mode: 'countdown' | 'timetable', a: HauptAktionen): TallyButtonProps[] {
  const t = hauptTasten(s, mode);
  if (t === null) return [];
  const laeuft = isCountdownRunning(s.timer.countdown);
  const start: TallyButtonProps = { ...t.start, onClick: laeuft ? a.pause : a.start };
  const reset: TallyButtonProps = { ...t.reset, onClick: a.reset };
  if (mode === 'countdown' || !t.prev || !t.next) return [start, reset];
  return [{ ...t.prev, onClick: a.prev }, start, reset, { ...t.next, onClick: a.next }];
}

export function HauptTasten({
  stand,
  mode,
  aktionen,
}: {
  stand: Pick<OberflaechenStand, 'timer'>;
  mode: 'countdown' | 'timetable';
  aktionen: HauptAktionen;
}): React.JSX.Element {
  return (
    <div data-timer="haupttasten" className={mode === 'countdown' ? 'grid w-full grid-cols-2 gap-3' : 'grid w-full grid-cols-2 gap-3 md:grid-cols-4'}>
      {liveTasten(stand, mode, aktionen).map((taste) => (
        <TallyButton key={taste.label} {...taste} />
      ))}
    </div>
  );
}
