import { useState } from 'react';
import {
  useStore,
  getCountdownRemaining,
  getProjectedEndMs,
  getProjectedSchedule,
  computeDrift,
  isCountdownPaused,
  isCountdownRunning,
} from '@/store/timer';
import { useTick } from '@/lib/useTick';
import { formatHMS } from '@/lib/time';
import { TimerDisplay } from './TimerDisplay';
import { SectionHeader } from './ui/SectionHeader';
import { StatusPill } from './ui/StatusPill';
import { Button } from '@jm/ui';
import { Card } from '@jm/ui';
import { TimetableRow } from './TimetableRow';
import { XlsxImport } from './XlsxImport';
import { DelayControls } from './DelayControls';
import { AutoAdvanceSettings } from './AutoAdvanceSettings';

export function Timetable() {
  const tt = useStore((s) => s.timetable);
  const cd = useStore((s) => s.countdown);
  const start = useStore((s) => s.startCountdown);
  const pause = useStore((s) => s.pauseCountdown);
  const reset = useStore((s) => s.resetCountdown);
  const ttAdd = useStore((s) => s.ttAdd);
  const ttNext = useStore((s) => s.ttNext);
  const ttPrev = useStore((s) => s.ttPrev);
  const ttClearActive = useStore((s) => s.ttClearActive);

  const now = useTick();
  const running = isCountdownRunning(cd);
  const paused = isCountdownPaused(cd);
  const remaining = getCountdownRemaining(cd, now);
  const endsAt = getProjectedEndMs(cd, now);
  const schedule = getProjectedSchedule(tt, cd, now);
  const drift = computeDrift(tt, cd, now);

  const [importOpen, setImportOpen] = useState(false);

  const activeItem =
    tt.activeIndex !== null ? tt.items[tt.activeIndex] : null;
  const nextItem =
    tt.activeIndex !== null && tt.activeIndex + 1 < tt.items.length
      ? tt.items[tt.activeIndex + 1]
      : null;

  const totalDuration = tt.items.reduce((sum, it) => sum + it.durationMs, 0);
  const status = running ? 'live' : paused ? 'setup' : 'info';
  const statusLabel = running ? 'Running' : paused ? 'Paused' : 'Idle';

  return (
    <section className="flex flex-col h-full px-2 gap-6">
      <div className="flex items-center justify-between">
        <SectionHeader>Timetable · Regieplan</SectionHeader>
        <div className="flex items-center gap-2">
          <StatusPill status={status}>{statusLabel}</StatusPill>
          {drift.driftMs !== null && (
            <span
              className="text-xs font-extrabold tabular px-2 py-1 rounded-[var(--radius)]"
              style={{
                color: drift.driftMs > 30_000 ? 'var(--destructive)' : drift.driftMs < -30_000 ? 'var(--primary)' : 'var(--muted-foreground)',
                background: 'var(--card)',
              }}
              title="Soll/Ist-Drift der Show"
            >
              {driftPillText(drift.driftMs)}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            uppercase={false}
            onClick={() => setImportOpen(true)}
          >
            XLSX importieren
          </Button>
          <Button
            variant="ghost"
            size="sm"
            uppercase={false}
            onClick={() =>
              ttAdd({ label: 'Neuer Programmpunkt', durationMs: 5 * 60 * 1000 })
            }
          >
            + Item
          </Button>
        </div>
      </div>

      {activeItem ? (
        <Card>
          <div className="p-6 flex flex-col gap-5">
            <div className="flex items-start justify-between gap-6">
              <div className="flex flex-col gap-2 min-w-0">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)] font-extrabold">
                    #{String((tt.activeIndex ?? 0) + 1).padStart(2, '0')}
                    {' · Live'}
                  </span>
                  {cd.delayMs !== 0 && (
                    <span
                      className="text-xs font-extrabold tabular"
                      style={{
                        color:
                          cd.delayMs > 0
                            ? 'var(--destructive)'
                            : 'var(--primary)',
                      }}
                    >
                      Delay {cd.delayMs > 0 ? '+' : '−'}
                      {formatHMS(Math.abs(cd.delayMs))}
                    </span>
                  )}
                </div>
                <h2 className="text-3xl font-extrabold leading-tight truncate">
                  {activeItem.label}
                </h2>
                {activeItem.note && (
                  <p className="text-sm text-[var(--muted-foreground)]">
                    {activeItem.note}
                  </p>
                )}
              </div>

              <TimerDisplay ms={remaining} reactive className="!leading-none" />
            </div>

            <div className="flex items-center gap-6 text-xs uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
              <span>
                <span className="text-[var(--slash)] mr-2">/</span>
                Plan {formatHMS(activeItem.durationMs)}
              </span>
              {endsAt !== null && (
                <span>
                  <span className="text-[var(--slash)] mr-2">/</span>
                  Endet {formatWallClock(endsAt)}
                </span>
              )}
              {nextItem && (
                <span>
                  <span className="text-[var(--slash)] mr-2">/</span>
                  Up next · {nextItem.label}
                </span>
              )}
            </div>

            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="md"
                  onClick={ttPrev}
                  disabled={(tt.activeIndex ?? 0) <= 0}
                >
                  ← Prev
                </Button>
                {!running ? (
                  <Button variant="primary" size="md" onClick={start}>
                    {paused ? 'Resume' : 'Start'}
                  </Button>
                ) : (
                  <Button variant="accent" size="md" onClick={pause}>
                    Pause
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="md"
                  onClick={reset}
                  disabled={!running && !paused && cd.delayMs === 0}
                >
                  Reset
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={ttNext}
                  disabled={(tt.activeIndex ?? 0) >= tt.items.length - 1}
                >
                  Next →
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                uppercase={false}
                onClick={ttClearActive}
              >
                Deaktivieren
              </Button>
            </div>

            <DelayControls />
          </div>
        </Card>
      ) : tt.items.length > 0 ? (
        <Card variant="nested">
          <div className="p-6 flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold">Show nicht gestartet</div>
              <p className="text-xs text-[var(--muted-foreground)] mt-1">
                Wähle einen Programmpunkt aus oder klicke „Start Show" — das lädt
                automatisch das erste Item.
              </p>
            </div>
            <Button variant="primary" onClick={ttNext}>
              Start Show
            </Button>
          </div>
        </Card>
      ) : null}

      {tt.items.length > 0 && <AutoAdvanceSettings />}

      {tt.items.length > 0 ? (
        <Card>
          <div className="p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <SectionHeader>Programmpunkte · {tt.items.length}</SectionHeader>
              <span className="text-xs text-[var(--muted-foreground)] tabular">
                Σ {formatHMS(totalDuration)}
              </span>
            </div>

            <div className="grid grid-cols-[36px_minmax(0,1fr)_96px_120px_minmax(0,1fr)_96px_136px] gap-3 px-4 py-2 text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)] font-extrabold">
              <span className="text-center">#</span>
              <span>Titel</span>
              <span className="text-center">Soll</span>
              <span className="text-center">Dauer</span>
              <span>Notiz</span>
              <span className="text-center">Ist / Δ</span>
              <span className="text-right">Aktionen</span>
            </div>

            <div className="flex flex-col gap-2">
              {tt.items.map((item, idx) => {
                const status =
                  tt.activeIndex === null
                    ? 'upcoming'
                    : idx < tt.activeIndex
                      ? 'past'
                      : idx === tt.activeIndex
                        ? 'active'
                        : 'upcoming';
                return (
                  <TimetableRow
                    key={item.id}
                    item={item}
                    index={idx}
                    total={tt.items.length}
                    status={status}
                    projectedStartMs={schedule[idx]}
                    deltaMs={drift.perItem[idx]?.deltaMs ?? null}
                  />
                );
              })}
            </div>
          </div>
        </Card>
      ) : (
        <EmptyState onImport={() => setImportOpen(true)} onAdd={() => ttAdd({ label: 'Begrüßung', durationMs: 5 * 60 * 1000 })} />
      )}

      <XlsxImport open={importOpen} onClose={() => setImportOpen(false)} />
    </section>
  );
}

function EmptyState({ onImport, onAdd }: { onImport: () => void; onAdd: () => void }) {
  return (
    <Card>
      <div className="py-16 flex flex-col items-center text-center gap-4 px-6">
        <div className="text-xl font-semibold">Noch keine Programmpunkte</div>
        <p className="text-sm text-[var(--muted-foreground)] max-w-md">
          Lade einen Regieplan als XLSX hoch oder lege Items manuell an.
          Beim Start einer Show kannst du dann mit „Next" durch die Punkte
          gehen — die Endzeiten kalkulieren sich automatisch.
        </p>
        <div className="flex items-center gap-2">
          <Button onClick={onImport}>XLSX importieren</Button>
          <Button variant="outline" onClick={onAdd}>
            Item anlegen
          </Button>
        </div>
      </div>
    </Card>
  );
}

function formatWallClock(ms: number): string {
  return new Date(ms).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function driftPillText(ms: number): string {
  const abs = Math.abs(ms);
  if (abs <= 30_000) return 'pünktlich';
  const total = Math.round(abs / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const hms = h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
  return ms > 0 ? `${hms} hinter Plan` : `${hms} vor Plan`;
}
