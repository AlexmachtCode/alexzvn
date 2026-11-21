import { useTick } from '@/lib/useTick';
import { TimerDisplay } from './TimerDisplay';
import { ModusKopf } from './ModusKopf';

export function Clock() {
  const now = useTick();
  const d = new Date(now);
  const msOfDay =
    ((d.getHours() * 60 + d.getMinutes()) * 60 + d.getSeconds()) * 1000;

  const dateLabel = d.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <section data-timer="modus-clock" className="flex flex-col h-full px-2">
      <ModusKopf titel="Real-Time Clock" />

      <div className="flex-1 flex flex-col items-center justify-center gap-6">
        <TimerDisplay ms={msOfDay} reactive={false} />
        <div className="text-sm uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
          {dateLabel}
        </div>
      </div>
    </section>
  );
}
