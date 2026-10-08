import { cn } from '../lib/cn';
import { useFeld } from './Field';

export interface ToggleProps {
  checked: boolean;
  onChange(next: boolean): void;
  disabled?: boolean;
  id?: string;
  className?: string;
  'aria-label'?: string;
}

/**
 * Schalter an/aus (Spec 3.5): `<button role="switch" aria-checked>`. Der Zustand steckt in der Form (Knopf rechts = an,
 * links = aus) und im aria-checked, nicht nur in der Farbe. „An“ nutzt --tally-selected mit gelber Kante (E5).
 */
export function Toggle({ checked, onChange, disabled, id, className, 'aria-label': ariaLabel }: ToggleProps): React.JSX.Element {
  const feld = useFeld();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      id={id ?? feld?.ids.input}
      aria-label={ariaLabel}
      aria-describedby={feld?.describedBy}
      aria-invalid={feld?.invalid ? true : undefined}
      disabled={disabled || feld?.gesperrt || undefined}
      data-state={checked ? 'an' : 'aus'}
      onClick={() => onChange(!checked)}
      className={cn(
        'inline-flex h-[var(--control-h)] w-14 shrink-0 items-center rounded-[var(--radius-full)] border-2 p-0.5',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]',
        'disabled:cursor-not-allowed disabled:opacity-60 motion-safe:transition-colors motion-safe:duration-150',
        checked
          ? 'justify-end border-[var(--brand-yellow)] bg-[var(--tally-selected)]'
          : 'justify-start border-[var(--field-border)] bg-[var(--input)]',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'block h-6 w-6 rounded-[var(--radius-full)]',
          checked ? 'bg-[var(--primary-foreground)]' : 'bg-[var(--muted-foreground)]',
        )}
      />
    </button>
  );
}
