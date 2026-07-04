import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

interface Props {
  /** Überschrift der Sektion (uppercase). */
  title: string;
  /** Optionale Kurzbeschreibung unter dem Header. */
  description?: ReactNode;
  /** Optionaler Inhalt rechts im Header (z. B. Aktions-Button, Status). */
  right?: ReactNode;
  className?: string;
  children: ReactNode;
}

/**
 * Immer sichtbarer Einstellungs-/Bedien-Abschnitt in der JM-Designsprache —
 * die geteilte Variante der zuvor pro App lokal definierten `Section`-Helfer
 * (#165). Für ausklappbare Abschnitte {@link Collapsible} nutzen; beide teilen
 * denselben uppercase-Header-Stil.
 */
export function SettingsSection({ title, description, right, className, children }: Props): React.JSX.Element {
  return (
    <section className={cn('space-y-2.5', className)}>
      <div className="flex items-center gap-2">
        <h3 className="text-[10px] uppercase tracking-[0.14em] font-extrabold text-[var(--muted-foreground)]">
          {title}
        </h3>
        {right ? <span className="ml-auto flex items-center">{right}</span> : null}
      </div>
      {description ? (
        <p className="text-[11px] text-[var(--muted-foreground)] -mt-1">{description}</p>
      ) : null}
      {children}
    </section>
  );
}
