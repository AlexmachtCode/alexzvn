import { useEffect, useState } from 'react';
import { useStore } from '@/store/timer';
import { Logo } from '@jm/ui';
import { cn, dragRegion, noDragRegion, isElectronMac } from '@jm/ui';
import type { VerbundAnzeigeZeile } from '@shared/verbund';

const MODE_LABELS: Record<string, string> = {
  clock: 'Real-Time Clock',
  countdown: 'Countdown',
  timetable: 'Timetable',
  remote: 'Remote · LAN',
  settings: 'Timer Farben',
};

export function Topbar() {
  const mode = useStore((s) => s.mode);
  const connected = useStore((s) => s.connected);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [speakerOpen, setSpeakerOpen] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.classList.toggle('light', theme === 'light');
  }, [theme]);

  useEffect(() => {
    if (!window.jm?.speaker) return;
    window.jm.speaker.isOpen().then(setSpeakerOpen);
    const off = window.jm.speaker.onStatus(setSpeakerOpen);
    return off;
  }, []);

  return (
    <header
      style={dragRegion}
      className={cn(
        'relative h-14 flex items-center justify-between',
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
        <Logo className="lg:hidden" size={22} />
        <span className="text-xs uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
          <span className="text-[var(--slash)] mr-2">/</span>
          {MODE_LABELS[mode] ?? mode}
        </span>
      </div>

      <div className="flex items-center gap-2" style={noDragRegion}>
        <VerbundPille />
        <SyncPill connected={connected} />
        <button
          type="button"
          onClick={() => window.jm?.speaker.toggle()}
          className={cn(
            'h-8 px-3 rounded-[var(--radius)] text-xs uppercase tracking-wide font-extrabold',
            'border transition-colors',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]',
            speakerOpen
              ? 'border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--highlight)]'
              : 'border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--highlight)]',
          )}
        >
          {speakerOpen ? 'Speaker · Open' : 'Open Speaker'}
        </button>
        <button
          type="button"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className={cn(
            'h-8 px-3 rounded-[var(--radius)] text-xs uppercase tracking-wide font-extrabold',
            'border border-[var(--border)] text-[var(--foreground)]',
            'hover:bg-[var(--highlight)] transition-colors',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]',
          )}
        >
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
      </div>
    </header>
  );
}

const VERBUND_FARBE: Record<VerbundAnzeigeZeile['farbe'], string> = {
  gruen: 'border-[var(--success)]/50 text-[var(--success)]',
  gelb: 'border-[var(--warning)]/60 text-[var(--warning)]',
  rot: 'border-[var(--destructive)]/60 text-[var(--destructive)]',
  gedaempft: 'border-[var(--border)] text-[var(--muted-foreground)]',
};

/**
 * Verbund-Anzeige neben „Sync“ (Master-Link Teil 2b, Spec 16.4/16.5): die V-Zeile aus app-runtime,
 * gekürzt mit „…“, voller Text als Tooltip. Am Einzelplatz (null) nichts.
 */
function VerbundPille() {
  const [anzeige, setAnzeige] = useState<VerbundAnzeigeZeile | null>(null);
  useEffect(() => {
    const jm = window.jm;
    if (!jm?.verbundAnzeige) return;
    void jm.verbundAnzeige().then(setAnzeige);
    return jm.onVerbundAnzeige(setAnzeige);
  }, []);
  if (!anzeige) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-[var(--radius-sm)] px-2 h-6 max-w-[22rem]',
        'text-[11px] font-semibold border',
        VERBUND_FARBE[anzeige.farbe],
      )}
      title={anzeige.text}
    >
      <span className="truncate">{anzeige.text}</span>
    </span>
  );
}

function SyncPill({ connected }: { connected: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-[var(--radius-sm)] px-2 h-6',
        'text-[10px] uppercase tracking-[0.14em] font-extrabold border',
        connected
          ? 'border-[var(--primary)]/40 text-[var(--primary)]'
          : 'border-[var(--destructive)]/60 text-[var(--destructive)]',
      )}
      title={connected ? 'Verbunden mit JM Timer-Sync' : 'Keine Verbindung'}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: connected ? 'var(--primary)' : 'var(--destructive)' }}
      />
      {connected ? 'Sync' : 'Offline'}
    </span>
  );
}
