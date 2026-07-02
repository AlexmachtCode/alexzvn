import type { ReactNode } from 'react';
import { Button, Card } from '@jm/ui';
import { useTools } from '@/store/tools';

/** SVGs identisch zu den Topbar-Icons (Header.tsx), damit die Optik matcht. */
const ICON = {
  open: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="2" width="20" height="20" rx="2.18" />
      <line x1="7" y1="2" x2="7" y2="22" />
      <line x1="17" y1="2" x2="17" y2="22" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <line x1="2" y1="7" x2="7" y2="7" />
      <line x1="2" y1="17" x2="7" y2="17" />
      <line x1="17" y1="17" x2="22" y2="17" />
      <line x1="17" y1="7" x2="22" y2="7" />
    </svg>
  ),
  create: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M12 18v-6M9 15h6" />
    </svg>
  ),
  system: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  ),
} as const;

type ButtonVariant = 'primary' | 'accent' | 'outline' | 'ghost' | 'destructive' | 'link';

interface ShowAction {
  key: string;
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  onClick: () => void;
  variant: ButtonVariant;
  /** Kleine grüne Zahl auf der Icon-Kachel (z. B. laufende Tools). */
  badge?: number;
}

/**
 * Der „JM Show"-Reiter (#157): große, klar beschriftete Aktions-Karten für neue
 * Operator. Ruft dieselben Store-Actions wie die Topbar-Icons auf (keine
 * Logik-Duplikate), plus eine Liste der zuletzt geöffneten Shows.
 */
export function ShowView(): React.JSX.Element {
  const openShow = useTools((s) => s.openShow);
  const openShowEditor = useTools((s) => s.openShowEditor);
  const openSystem = useTools((s) => s.openSystem);
  const openShowPath = useTools((s) => s.openShowPath);
  const recentShows = useTools((s) => s.recentShows);
  const runningCount = useTools((s) => s.presence.filter((p) => p.running).length);

  const actions: ShowAction[] = [
    {
      key: 'open',
      icon: ICON.open,
      title: 'Show öffnen / starten',
      description: 'Eine .jmshow wählen — der Launcher startet alle enthaltenen Tools koordiniert.',
      actionLabel: 'Show öffnen',
      onClick: () => void openShow(),
      variant: 'primary',
    },
    {
      key: 'create',
      icon: ICON.create,
      title: 'Neue Show anlegen',
      description: 'Tools auswählen und als .jmshow für die Produktion speichern.',
      actionLabel: 'Show anlegen',
      onClick: openShowEditor,
      variant: 'outline',
    },
    {
      key: 'system',
      icon: ICON.system,
      title: 'System-Zustand',
      description: 'Laufende Tools und Steuer-Endpunkte im Blick behalten.',
      actionLabel: 'System öffnen',
      onClick: openSystem,
      variant: 'outline',
      badge: runningCount || undefined,
    },
    // TODO(iveo): Side-Events-Aktion (guarded by iveoActive) hier einhängen —
    // { key: 'sideEvents', icon: ICON.sideEvents, title: 'Side Events', …,
    //   onClick: openSideEvents, variant: 'accent' } (siehe feat/iveo-integration).
  ];

  return (
    <div className="max-w-[1200px] mx-auto px-7 py-7 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">JM Show</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Shows starten, anlegen und den Systemzustand prüfen.
        </p>
      </div>

      <div className="grid gap-5 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        {actions.map((a) => (
          <ActionCard key={a.key} action={a} />
        ))}
      </div>

      {recentShows.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
            Zuletzt geöffnet
          </h2>
          <Card variant="nested" className="overflow-hidden p-0">
            <div className="flex flex-col divide-y divide-[var(--border)]/50">
              {recentShows.map((show) => (
                <button
                  key={show.path}
                  type="button"
                  onClick={() => void openShowPath(show.path)}
                  title={`${show.name} — ${show.path}`}
                  className="flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--highlight)] transition-colors"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-[var(--radius)] border border-[var(--primary)]/30 bg-[var(--highlight)] text-[var(--primary)]">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-bold">{show.name}</span>
                    <span className="truncate text-[11px] text-[var(--muted-foreground)]">{show.path}</span>
                  </span>
                </button>
              ))}
            </div>
          </Card>
        </section>
      )}
    </div>
  );
}

function ActionCard({ action }: { action: ShowAction }): React.JSX.Element {
  return (
    <Card variant="major" className="h-full p-6 jm-fade-in">
      <div className="flex flex-col gap-4">
        <div className="relative grid size-12 place-items-center rounded-[var(--radius-lg)] border border-[var(--primary)]/40 bg-[var(--highlight)] text-[var(--primary)]">
          {action.icon}
          {action.badge ? (
            <span
              aria-hidden
              className="absolute -top-1.5 -right-1.5 grid min-w-4 h-4 place-items-center rounded-[var(--radius-full)]
                         bg-[var(--success)] px-1 text-[9px] font-bold leading-none text-black tabular-nums"
            >
              {action.badge}
            </span>
          ) : null}
        </div>
        <h3 className="text-lg font-extrabold leading-tight">{action.title}</h3>
        <p className="text-sm leading-snug text-[var(--foreground)]/80">{action.description}</p>
        <Button size="lg" variant={action.variant} className="w-full" onClick={action.onClick}>
          {action.actionLabel}
        </Button>
      </div>
    </Card>
  );
}
