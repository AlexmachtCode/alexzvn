// Modus-Wahl links im Inhalt (E9): Clock, Countdown, Timetable. „Remote“ und „Farben“ sind Panel-Abschnitte, kein Modus.
import { useStore, type Mode } from '@/store/timer';
import { anzeigeModus } from '@/lib/oberflaeche';
import { cn } from '@jm/ui';

interface Item {
  id: Mode;
  label: string;
  hint?: string;
}

const ITEMS: Item[] = [
  { id: 'clock',     label: 'Clock',     hint: 'Real-Time' },
  { id: 'countdown', label: 'Countdown', hint: 'HH:MM:SS' },
  { id: 'timetable', label: 'Timetable', hint: 'Regieplan' },
];

export function Sidebar() {
  const mode = anzeigeModus(useStore((s) => s.mode));
  const setMode = useStore((s) => s.setMode);

  return (
    <aside className="hidden lg:flex w-[200px] shrink-0 flex-col bg-[var(--sidebar)] border-r border-[var(--border)]/60">
      <nav className="flex flex-col p-3 gap-1">
        <div className="px-2 py-2 text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
          <span className="text-[var(--slash)] mr-2">/</span>Modi
        </div>
        {ITEMS.map((item) => (
          <NavItem
            key={item.id}
            label={item.label}
            hint={item.hint}
            active={mode === item.id}
            onClick={() => setMode(item.id)}
          />
        ))}
      </nav>
    </aside>
  );
}

function NavItem({
  label,
  hint,
  active,
  onClick,
}: {
  label: string;
  hint?: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative w-full text-left rounded-[var(--radius)]',
        'px-3 py-2.5 flex items-center justify-between',
        'transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]',
        active
          ? 'bg-[var(--highlight)] text-[var(--foreground)]'
          : 'text-[var(--foreground)]/85 hover:bg-[var(--highlight)]',
      )}
    >
      {active && (
        <span
          aria-hidden
          className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-sm bg-[var(--primary)]"
        />
      )}
      <span className="text-sm font-semibold">{label}</span>
      {hint && (
        <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
          {hint}
        </span>
      )}
    </button>
  );
}
