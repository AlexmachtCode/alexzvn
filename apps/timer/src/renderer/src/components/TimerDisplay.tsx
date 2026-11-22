import { useStore } from '@/store/timer';
import { formatHMS } from '@/lib/time';
import { cn } from '@jm/ui';

interface Props {
  /** Milliseconds to display. Negative values render as -HH:MM:SS (overtime). */
  ms: number;
  /** Color shifts to warning/overtime when true (Countdown). Off for wall-clock. */
  reactive?: boolean;
  className?: string;
  /**
   * override the size (CSS clamp by default). `fit` (Bedienfenster) richtet sich nach der Breite des nächsten @container
   * (cqi), damit die Zeit neben Seitenleiste und Panel in ihrer Spalte bleibt; `fullscreen` (Speaker, E18) und `preview`
   * rechnen weiter mit dem Fenster (vw).
   */
  size?: 'fit' | 'fullscreen' | 'preview';
}

const FONT_SIZES: Record<NonNullable<Props['size']>, string> = {
  fit: 'clamp(3rem, 14cqi, 14rem)',
  fullscreen: 'clamp(6rem, 22vw, 26rem)',
  preview: 'clamp(1.25rem, 3.2vw, 2rem)',
};

export function TimerDisplay({ ms, reactive = true, className, size = 'fit' }: Props) {
  const colors = useStore((s) => s.colors);

  let color: string = colors.normal;
  if (reactive) {
    if (ms <= 0) color = colors.overtime;
    else if (ms <= colors.warningAtSec * 1000) color = colors.warning;
  }

  return (
    <div
      className={cn(
        'font-extrabold leading-none tabular tracking-tight select-none whitespace-nowrap',
        className,
      )}
      style={{ color, fontSize: FONT_SIZES[size] }}
    >
      {formatHMS(ms)}
    </div>
  );
}
