import { useEffect, useState } from 'react';
import {
  useStore,
  getCountdownRemaining,
  getProjectedEndMs,
  isCountdownRunning,
  isCountdownPaused,
} from '@/store/timer';
import { useTick } from '@/lib/useTick';
import { formatHMS, parseHMS } from '@/lib/time';
import { istEingabeZiel } from '@/lib/oberflaeche';
import { TimerDisplay } from './TimerDisplay';
import { Button } from '@jm/ui';
import { Input } from './ui/Input';
import { SectionHeader } from './ui/SectionHeader';
import { StatusPill } from './ui/StatusPill';
import { Card } from '@jm/ui';
import { DelayControls } from './DelayControls';

export function Countdown() {
  const cd = useStore((s) => s.countdown);
  const start = useStore((s) => s.startCountdown);
  const pause = useStore((s) => s.pauseCountdown);
  const reset = useStore((s) => s.resetCountdown);
  const setDuration = useStore((s) => s.setCountdownDuration);

  const now = useTick();
  const remaining = getCountdownRemaining(cd, now);
  const endsAt = getProjectedEndMs(cd, now);
  const running = isCountdownRunning(cd);
  const paused = isCountdownPaused(cd);

  const [draft, setDraft] = useState(() => formatHMS(cd.durationMs));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!running && !paused) setDraft(formatHMS(cd.durationMs));
  }, [cd.durationMs, running, paused]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (istEingabeZiel(e.target)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        running ? pause() : start();
      } else if (e.code === 'KeyR') {
        e.preventDefault();
        reset();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [running, start, pause, reset]);

  function applyDraft() {
    const ms = parseHMS(draft);
    if (ms === null) {
      setError('Format: HH:MM:SS');
      return;
    }
    setError(null);
    setDuration(ms);
  }

  const status = running ? 'live' : paused ? 'setup' : 'info';
  const statusLabel = running ? 'Running' : paused ? 'Paused' : 'Idle';
  const hasDelay = cd.delayMs !== 0;

  return (
    <section className="flex flex-col h-full px-2">
      <div className="flex items-center justify-between pb-6">
        <SectionHeader>Countdown</SectionHeader>
        <div className="flex items-center gap-2">
          {hasDelay && (
            <span
              className="inline-flex items-center rounded-[var(--radius-sm)] px-2 py-0.5
                         text-xs uppercase tracking-wide font-extrabold border"
              style={{
                color: cd.delayMs > 0 ? 'var(--destructive)' : 'var(--primary)',
                borderColor: cd.delayMs > 0 ? 'var(--destructive)' : 'var(--primary)',
              }}
            >
              Delay {cd.delayMs > 0 ? '+' : '−'}
              {formatHMS(Math.abs(cd.delayMs))}
            </span>
          )}
          <StatusPill status={status}>{statusLabel}</StatusPill>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-6 py-4">
        <TimerDisplay ms={remaining} reactive />

        <div className="flex items-center gap-6 text-xs uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
          <span>
            <span className="text-[var(--slash)] mr-2">/</span>
            Plan {formatHMS(cd.durationMs)}
          </span>
          {endsAt !== null && (
            <span>
              <span className="text-[var(--slash)] mr-2">/</span>
              Endet {formatWallClock(endsAt)}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-[1320px] items-start">
          <Card variant="nested" className="w-full">
            <div className="p-5 flex flex-col gap-4">
              <SectionHeader>Dauer · HH:MM:SS</SectionHeader>
              <div className="flex items-end gap-3">
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={applyDraft}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                  }}
                  disabled={running || paused}
                  placeholder="00:05:00"
                  className="flex-1 text-lg font-extrabold"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {[60_000, 5 * 60_000, 10 * 60_000, 15 * 60_000].map((ms) => (
                  <Button
                    key={ms}
                    variant="ghost"
                    size="sm"
                    uppercase={false}
                    disabled={running || paused}
                    onClick={() => {
                      setDuration(ms);
                      setDraft(formatHMS(ms));
                    }}
                  >
                    +{ms / 60_000} min
                  </Button>
                ))}
              </div>
              {error && <div className="text-xs text-[var(--destructive)]">{error}</div>}
              <div className="text-xs text-[var(--muted-foreground)]">
                Während der Timer läuft, Dauer per Delay-Karte rechts anpassen.
              </div>
            </div>
          </Card>

          <DelayControls />
        </div>

        <div className="flex items-center gap-3">
          {!running ? (
            <Button variant="primary" size="lg" onClick={start}>
              {paused ? 'Resume' : 'Start'}
            </Button>
          ) : (
            <Button variant="accent" size="lg" onClick={pause}>
              Pause
            </Button>
          )}
          <Button variant="outline" size="lg" onClick={reset} disabled={!running && !paused && !hasDelay}>
            Reset
          </Button>
        </div>

        <div className="text-xs uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
          Space · Start / Pause      R · Reset
        </div>
      </div>
    </section>
  );
}

function formatWallClock(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
