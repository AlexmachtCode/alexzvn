import { useEffect, useState, type ReactNode } from 'react';
import { cn } from '../lib/cn';

interface Props {
  /** Überschrift der Sektion (uppercase, wie SettingsSection). */
  title: string;
  /** Optionale Kurzbeschreibung unter dem Header (nur sichtbar, wenn offen). */
  description?: ReactNode;
  /** Optionaler Inhalt rechts im Header (z. B. Status-Badge) — klickt nicht auf. */
  right?: ReactNode;
  /** Startzustand für den ungesteuerten Modus. Default: offen. */
  defaultOpen?: boolean;
  /** Gesteuerter Modus: offen/zu von außen. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * Wenn gesetzt, wird der Auf-/Zu-Zustand unter diesem Schlüssel in
   * localStorage gemerkt (ungesteuerter Modus). Über Apps hinweg eindeutig
   * halten, z. B. "titler.style".
   */
  persistId?: string;
  className?: string;
  children: ReactNode;
}

function readPersisted(persistId: string | undefined, fallback: boolean): boolean {
  if (!persistId || typeof window === 'undefined') return fallback;
  try {
    const v = window.localStorage.getItem(`jm.collapsible.${persistId}`);
    return v == null ? fallback : v === '1';
  } catch {
    return fallback;
  }
}

/**
 * Ausklappbarer Abschnitt (Disclosure) in der JM-Designsprache. Teilt den
 * uppercase-Header-Stil mit {@link SettingsSection}. Persistiert den Open-State
 * optional pro `persistId`, damit die Bedien-UI zwischen Sitzungen ihren
 * Zustand behält (#165).
 */
export function Collapsible({
  title,
  description,
  right,
  defaultOpen = true,
  open,
  onOpenChange,
  persistId,
  className,
  children,
}: Props): React.JSX.Element {
  const controlled = open !== undefined;
  const [internalOpen, setInternalOpen] = useState(() => readPersisted(persistId, defaultOpen));
  const isOpen = controlled ? open : internalOpen;

  useEffect(() => {
    if (controlled || !persistId || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(`jm.collapsible.${persistId}`, internalOpen ? '1' : '0');
    } catch {
      /* localStorage nicht verfügbar — Persistenz ist best effort */
    }
  }, [controlled, persistId, internalOpen]);

  const toggle = (): void => {
    const next = !isOpen;
    if (!controlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  return (
    <section className={cn('space-y-2.5', className)}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={isOpen}
        className="flex w-full items-center gap-2 text-left group"
      >
        <svg
          viewBox="0 0 24 24"
          className={cn(
            'h-3 w-3 shrink-0 text-[var(--muted-foreground)] transition-transform',
            isOpen ? 'rotate-90' : 'rotate-0',
          )}
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M9 6l6 6-6 6" />
        </svg>
        <span className="text-[10px] uppercase tracking-[0.14em] font-extrabold text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]">
          {title}
        </span>
        {right ? <span className="ml-auto flex items-center">{right}</span> : null}
      </button>
      {isOpen ? (
        <div className="space-y-2.5">
          {description ? (
            <p className="text-[11px] text-[var(--muted-foreground)]">{description}</p>
          ) : null}
          {children}
        </div>
      ) : null}
    </section>
  );
}
