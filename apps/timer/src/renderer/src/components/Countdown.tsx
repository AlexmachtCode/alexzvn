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
import { istEingabeZiel, laufPille, TIMER_TEXTE } from '@/lib/oberflaeche';
import { TimerDisplay } from './TimerDisplay';
import { Button, Field, StatusPill, TextInput } from '@jm/ui';
import { DelayControls } from './DelayControls';
import { ModusKopf } from './ModusKopf';
import { HauptTasten } from '@/views/LiveBereich';

export function Countdown() {
  const cd = useStore((s) => s.countdown);
  const start = useStore((s) => s.startCountdown);
  const pause = useStore((s) => s.pauseCountdown);
  const reset = useStore((s) => s.resetCountdown);
  const setDuration = useStore((s) => s.setCountdownDuration);
  const timetable = useStore((s) => s.timetable);

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

  const pille = laufPille(running, paused);
  const hasDelay = cd.delayMs !== 0;

  return (
    <section data-timer="modus-countdown" className="flex flex-col h-full px-2">
      <ModusKopf titel="Countdown">
        {hasDelay && (
          <StatusPill state={cd.delayMs > 0 ? 'warn' : 'ok'} text={`Delay ${cd.delayMs > 0 ? '+' : '−'}${formatHMS(Math.abs(cd.delayMs))}`} />
        )}
        <StatusPill state={pille.state} text={pille.text} />
      </ModusKopf>

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

        <div className="w-full max-w-[640px]">
          <HauptTasten
            stand={{ timer: { countdown: cd, timetable } }}
            mode="countdown"
            aktionen={{ start, pause, reset, prev: noop, next: noop }}
          />
        </div>

        <div className="flex w-full max-w-[640px] flex-col gap-5">
          <Field label="Dauer · HH:MM:SS" hint={TIMER_TEXTE.dauerHinweis} error={error ?? undefined}>
            <TextInput
              value={draft}
              onChange={setDraft}
              onBlur={applyDraft}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
              }}
              disabled={running || paused}
              placeholder="00:05:00"
              className="text-lg font-extrabold"
            />
          </Field>
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

          <DelayControls />
        </div>
      </div>
    </section>
  );
}

const noop = (): void => undefined;

function formatWallClock(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
