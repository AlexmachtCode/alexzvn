import { useEffect, useMemo } from 'react';
import { Button, Card, cn } from '@jm/ui';
import { useTools } from '@/store/tools';

// ─────────────────────────────────────────────────────────────────────────────
// Lade-Overlay beim Öffnen einer Show (#76). Der Launcher startet beim Öffnen
// einer .jmshow mehrere Tools; deren Kaltstart dauert. Statt den Nutzer „in der
// Luft hängen" zu lassen, zeigt dieses Overlay sofort die erwarteten Tools und
// tickt jedes via Presence (Heartbeat) auf „läuft", sobald es wirklich da ist.
// Es schließt automatisch, sobald alle starteten — oder nach einem Sicherheits-
// Timeout (falls ein Tool nie hochkommt) — und lässt sich jederzeit wegklicken.
// ─────────────────────────────────────────────────────────────────────────────

const SAFETY_CLOSE_MS = 30_000;

export function ShowLaunchOverlay() {
  const launch = useTools((s) => s.showLaunch);
  const presence = useTools((s) => s.presence);
  const dismiss = useTools((s) => s.dismissShowLaunch);

  const running = useMemo(
    () => new Set(presence.filter((p) => p.running).map((p) => p.appId)),
    [presence],
  );

  const missing = useMemo(() => new Set(launch?.missing ?? []), [launch]);
  const expected = useMemo(
    () => (launch ? launch.tools.filter((t) => !missing.has(t.appId)) : []),
    [launch, missing],
  );
  const upCount = expected.filter((t) => running.has(t.appId)).length;
  const allUp = expected.length > 0 && upCount === expected.length;

  // Auto-Close: sobald alle erwarteten Tools laufen (kurz nachklingen lassen),
  // sonst nach dem Sicherheits-Timeout ab `done`. Vor `done` bleibt es offen.
  useEffect(() => {
    if (!launch?.done) return;
    const delay =
      expected.length === 0 ? 3000 : allUp ? 1400 : Math.max(1500, SAFETY_CLOSE_MS - (Date.now() - launch.doneAt));
    const id = window.setTimeout(dismiss, delay);
    return () => window.clearTimeout(id);
  }, [launch, allUp, expected.length, dismiss]);

  if (!launch) return null;

  const total = launch.tools.length;
  const heading = !launch.done
    ? `Show „${launch.name}" wird gestartet…`
    : allUp
      ? `Show „${launch.name}" läuft`
      : `Show „${launch.name}" gestartet`;

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/55 backdrop-blur-sm px-6">
      <Card className="w-full max-w-md p-6 jm-fade-in">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight">{heading}</h2>
            <p className="text-xs text-[var(--muted-foreground)] mt-1">
              {expected.length > 0
                ? `${upCount}/${expected.length} Tools laufen · Tools starten kann einen Moment dauern.`
                : 'Keine startbaren Tools in dieser Show.'}
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={dismiss}>
            ✕
          </Button>
        </div>

        <div className="mt-4 flex flex-col gap-1.5 max-h-[50vh] overflow-auto">
          {launch.tools.map((t) => {
            const isMissing = missing.has(t.appId);
            const isUp = running.has(t.appId);
            const status = isMissing ? 'nicht verfügbar' : isUp ? 'läuft' : 'startet…';
            return (
              <div
                key={t.appId}
                className="flex items-center justify-between gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-2"
              >
                <span className="text-sm font-semibold">{t.name}</span>
                <span
                  className={cn(
                    'flex items-center gap-1.5 text-[11px] uppercase tracking-wide tabular-nums',
                    isMissing
                      ? 'text-[var(--muted-foreground)]'
                      : isUp
                        ? 'text-emerald-400'
                        : 'text-[var(--muted-foreground)]',
                  )}
                >
                  <span aria-hidden>{isMissing ? '✕' : isUp ? '✓' : '…'}</span>
                  {status}
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex items-center justify-end">
          <Button variant="ghost" onClick={dismiss}>
            {launch.done ? 'Schließen' : 'Ausblenden'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
