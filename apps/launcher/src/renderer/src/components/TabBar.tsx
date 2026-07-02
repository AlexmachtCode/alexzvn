import { cn } from '@jm/ui';
import { useTools, type LauncherView } from '@/store/tools';

const TABS: { key: LauncherView; label: string }[] = [
  { key: 'catalog', label: 'Werkzeugkasten' },
  { key: 'jmshow', label: 'JM Show' },
];

/**
 * Reiter-Leiste (#157): schaltet die Shell zwischen Werkzeugkasten und JM Show.
 * Sitzt unter der Topbar (Header) — daher KEIN Drag-Region, sonst wären die
 * Reiter nicht klickbar.
 */
export function TabBar(): React.JSX.Element {
  const view = useTools((s) => s.view);
  const setView = useTools((s) => s.setView);
  const runningCount = useTools((s) => s.presence.filter((p) => p.running).length);

  return (
    <div
      role="tablist"
      aria-label="Ansicht"
      className="shrink-0 flex items-center gap-1 px-7 border-b border-[var(--border)]/60 bg-[var(--card)]/40"
    >
      {TABS.map((tab) => {
        const active = view === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setView(tab.key)}
            className={cn(
              'relative -mb-px h-11 px-4 text-sm font-extrabold uppercase tracking-[0.08em]',
              'flex items-center gap-2 border-b-2 transition-colors',
              active
                ? 'border-[var(--primary)] text-[var(--foreground)]'
                : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
            )}
          >
            {tab.label}
            {tab.key === 'jmshow' && runningCount > 0 && (
              <span
                aria-hidden
                className="grid min-w-4 h-4 place-items-center rounded-[var(--radius-full)]
                           bg-[var(--success)] px-1 text-[9px] font-bold leading-none text-black tabular-nums"
              >
                {runningCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
