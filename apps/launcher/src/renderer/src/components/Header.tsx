import { useEffect, useState } from 'react';
import { Logo, cn, dragRegion, noDragRegion, isElectronMac } from '@jm/ui';
import { useTools } from '@/store/tools';
import { useCookbook } from '@/store/cookbook';

export function Header() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const openSettings = useTools((s) => s.openSettings);
  const openFeedback = useTools((s) => s.openFeedback);
  const openPatchNotes = useTools((s) => s.openPatchNotes);
  const openShow = useTools((s) => s.openShow);
  const openShowEditor = useTools((s) => s.openShowEditor);
  const openSystem = useTools((s) => s.openSystem);
  const openOnboarding = useTools((s) => s.openOnboarding);
  const openSideEvents = useTools((s) => s.openSideEvents);
  const iveoActive = useTools((s) => s.iveoActive);
  const openCookbook = useCookbook((s) => s.openCookbook);
  const runningCount = useTools((s) => s.presence.filter((p) => p.running).length);
  const version = useTools((s) => s.version);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.classList.toggle('light', theme === 'light');
  }, [theme]);

  return (
    <header
      style={dragRegion}
      className={cn(
        'relative h-16 flex items-center justify-between shrink-0',
        'pr-6 border-b border-[var(--border)]/60',
        isElectronMac ? 'pl-20' : 'pl-6',
        'bg-[var(--card)]/60 backdrop-blur-md',
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px
                   bg-gradient-to-r from-transparent via-[var(--primary)]/30 to-transparent"
      />

      <div className="flex items-center gap-3">
        <Logo size={30} />
        <div className="flex flex-col leading-tight">
          <span className="flex items-center gap-2">
            <span className="text-sm font-extrabold tracking-[0.06em]">JM PRODUCTION SUITE</span>
            {version && (
              <button
                type="button"
                onClick={() => openPatchNotes({ app: 'launcher' })}
                style={noDragRegion}
                title={`Launcher-Version ${version} — Patch Notes anzeigen`}
                className="rounded-[var(--radius-full)] border border-[var(--border)] px-1.5 py-px
                           text-[10px] font-bold tabular-nums text-[var(--muted-foreground)]
                           hover:border-[var(--primary)]/50 hover:text-[var(--foreground)] transition-colors"
              >
                v{version}
              </button>
            )}
          </span>
          <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
            Werkzeugkasten für Media Operators
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2" style={noDragRegion}>
        <button
          type="button"
          onClick={openShowEditor}
          aria-label="Show anlegen"
          title="Show anlegen · Tools auswählen und als .jmshow speichern"
          className={cn(
            'grid place-items-center size-8 rounded-[var(--radius)]',
            'border border-[var(--border)] text-[var(--foreground)]',
            'hover:bg-[var(--highlight)] transition-colors',
          )}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
            <path d="M12 18v-6M9 15h6" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => void openShow()}
          aria-label="Show öffnen"
          title="Show öffnen · Tools koordiniert starten"
          className={cn(
            'grid place-items-center size-8 rounded-[var(--radius)]',
            'border border-[var(--border)] text-[var(--foreground)]',
            'hover:bg-[var(--highlight)] transition-colors',
          )}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="2" y="2" width="20" height="20" rx="2.18" />
            <line x1="7" y1="2" x2="7" y2="22" />
            <line x1="17" y1="2" x2="17" y2="22" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <line x1="2" y1="7" x2="7" y2="7" />
            <line x1="2" y1="17" x2="7" y2="17" />
            <line x1="17" y1="17" x2="22" y2="17" />
            <line x1="17" y1="7" x2="22" y2="7" />
          </svg>
        </button>
        {iveoActive && (
          <button
            type="button"
            onClick={openSideEvents}
            aria-label="Side Events"
            title="iveo Side Events · live umschalten"
            className={cn(
              'grid place-items-center size-8 rounded-[var(--radius)]',
              'border border-[var(--primary)]/50 text-[var(--primary)]',
              'hover:bg-[var(--highlight)] transition-colors',
            )}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18M8 15h5" />
            </svg>
          </button>
        )}
        <button
          type="button"
          onClick={openSystem}
          aria-label="System-Zustand"
          title="System-Zustand · laufende Tools"
          className={cn(
            'relative grid place-items-center size-8 rounded-[var(--radius)]',
            'border border-[var(--border)] text-[var(--foreground)]',
            'hover:bg-[var(--highlight)] transition-colors',
          )}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
          {runningCount > 0 && (
            <span
              aria-hidden
              className="absolute -top-1 -right-1 grid place-items-center min-w-4 h-4 px-1
                         rounded-[var(--radius-full)] bg-[var(--success)] text-[9px] font-bold
                         leading-none text-black tabular-nums"
            >
              {runningCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={openOnboarding}
          aria-label="Erste Schritte"
          title="Erste Schritte · geführter Einstieg"
          className={cn(
            'grid place-items-center size-8 rounded-[var(--radius)]',
            'border border-[var(--border)] text-[var(--foreground)]',
            'hover:bg-[var(--highlight)] transition-colors',
          )}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <path d="M12 17h.01" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => openCookbook()}
          aria-label="Kochbuch"
          title="JM Kochbuch · Best Practices & Manuals"
          className={cn(
            'grid place-items-center size-8 rounded-[var(--radius)]',
            'border border-[var(--border)] text-[var(--foreground)]',
            'hover:bg-[var(--highlight)] transition-colors',
          )}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => openPatchNotes()}
          aria-label="Patch Notes"
          title="Patch Notes / Was ist neu?"
          className={cn(
            'grid place-items-center size-8 rounded-[var(--radius)]',
            'border border-[var(--border)] text-[var(--foreground)]',
            'hover:bg-[var(--highlight)] transition-colors',
          )}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6M9 13h6M9 17h4" />
          </svg>
        </button>
        <button
          type="button"
          onClick={openFeedback}
          aria-label="Feedback senden"
          title="Bug melden / Funktion wünschen"
          className={cn(
            'grid place-items-center size-8 rounded-[var(--radius)]',
            'border border-[var(--border)] text-[var(--foreground)]',
            'hover:bg-[var(--highlight)] transition-colors',
          )}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={openSettings}
          aria-label="Einstellungen"
          title="Einstellungen"
          className={cn(
            'grid place-items-center size-8 rounded-[var(--radius)]',
            'border border-[var(--border)] text-[var(--foreground)]',
            'hover:bg-[var(--highlight)] transition-colors',
          )}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className={cn(
            'h-8 px-3 rounded-[var(--radius)] text-xs uppercase tracking-wide font-extrabold',
            'border border-[var(--border)] text-[var(--foreground)]',
            'hover:bg-[var(--highlight)] transition-colors',
          )}
        >
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
      </div>
    </header>
  );
}
