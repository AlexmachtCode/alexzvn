import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface TabItem<K extends string = string> {
  key: K;
  label: ReactNode;
  /** Optionaler Zähler/Badge rechts vom Label. */
  badge?: ReactNode;
}

interface Props<K extends string = string> {
  items: TabItem<K>[];
  value: K;
  onChange: (key: K) => void;
  /** Volle Breite gleichmäßig aufteilen (Default) oder nach Inhalt. */
  fill?: boolean;
  className?: string;
}

/**
 * Segmentierte Tab-Umschaltung in der JM-Designsprache (aktiver Tab primär
 * hervorgehoben) — z. B. „Steuerung" / „Einstellungen" (#165). Rein
 * präsentationell; der aktive Schlüssel wird vom Aufrufer gehalten.
 */
export function Tabs<K extends string = string>({
  items,
  value,
  onChange,
  fill = true,
  className,
}: Props<K>): React.JSX.Element {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex gap-1 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] p-1',
        fill && 'flex w-full',
        className,
      )}
    >
      {items.map((t) => {
        const active = t.key === value;
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.key)}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 h-8 rounded-[calc(var(--radius)-2px)] px-3',
              'text-xs font-extrabold uppercase tracking-wide transition-colors',
              fill && 'flex-1',
              active
                ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--highlight)]',
            )}
          >
            {t.label}
            {t.badge != null ? <span className="tabular">{t.badge}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
