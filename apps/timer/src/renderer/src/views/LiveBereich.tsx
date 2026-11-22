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

const RASTER_ZWEI = 'grid w-full grid-cols-2 gap-3';
const RASTER_VIER = 'grid w-full grid-cols-2 gap-3 @[676px]:grid-cols-4';

export type TastenRolle = 'prev' | 'start' | 'reset' | 'next';

/** Die Haupttasten mit ihrer Rolle in Anzeigereihenfolge. Die Rolle ist der React-key: Die Beschriftung wechselt (Start, Pause, Resume), der Knopf bleibt. */
function rollenTasten(s: Pick<OberflaechenStand, 'timer'>, mode: 'countdown' | 'timetable', a: HauptAktionen): Array<[TastenRolle, TallyButtonProps]> {
  const t = hauptTasten(s, mode);
  if (t === null) return [];
  const laeuft = isCountdownRunning(s.timer.countdown);
  const start: TallyButtonProps = { ...t.start, onClick: laeuft ? a.pause : a.start };
  const reset: TallyButtonProps = { ...t.reset, onClick: a.reset };
  if (mode === 'countdown' || !t.prev || !t.next) return [['start', start], ['reset', reset]];
  return [['prev', { ...t.prev, onClick: a.prev }], ['start', start], ['reset', reset], ['next', { ...t.next, onClick: a.next }]];
}

const KEINE: HauptAktionen = { start() {}, pause() {}, reset() {}, prev() {}, next() {} };

/** Die Haupttasten als Props in Anzeigereihenfolge; leer für die Uhr. Ohne DOM prüfbar. */
export function liveTasten(s: Pick<OberflaechenStand, 'timer'>, mode: 'countdown' | 'timetable', a: HauptAktionen): TallyButtonProps[] {
  return rollenTasten(s, mode, a).map(([, t]) => t);
}

/** Die keys der Tasten (Rollen), unabhängig von Beschriftung und Zustand. */
export function tastenSchluessel(s: Pick<OberflaechenStand, 'timer'>, mode: 'countdown' | 'timetable'): TastenRolle[] {
  return rollenTasten(s, mode, KEINE).map(([r]) => r);
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
  const tasten = rollenTasten(stand, mode, aktionen);
  return (
    // Container-Query statt Viewport: tastenSpalten(anzahl, breite) beschreibt das Raster; die Klassen stehen als Literal da (Tailwind-Scan).
    <div data-timer="haupttasten" className="@container w-full">
      <div className={tasten.length === 4 ? RASTER_VIER : RASTER_ZWEI}>
        {tasten.map(([rolle, taste]) => (
          <TallyButton key={rolle} {...taste} />
        ))}
      </div>
    </div>
  );
}
