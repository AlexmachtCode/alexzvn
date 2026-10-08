import { cn } from '../lib/cn';
import { selectOptionen, type SelectOption } from '../lib/eingabe';
import { EINGABE_KLASSE, useFeld } from './Field';

export interface SelectProps {
  options: readonly SelectOption[];
  value: string;
  onChange(value: string): void;
  placeholder?: string;
  /** Anzeigename eines gewählten Werts, der in `options` fehlt (z. B. das zuletzt benutzte Gerät). */
  fehlendLabel?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  'aria-label'?: string;
}

/**
 * Natives Auswahlfeld (Spec 3.5; E11). Ein gewählter Wert, der in `options` fehlt, bleibt als erste Option
 * „nicht verfügbar: …“ gewählt und gesperrt – das native select springt sonst still auf eine andere Option.
 * Ein leerer Wert ohne passende Option zeigt „– bitte wählen –“ (oder `placeholder`); das leistet `selectOptionen` (Task 7).
 */
export function Select({
  options,
  value,
  onChange,
  placeholder,
  fehlendLabel,
  disabled,
  id,
  className,
  'aria-label': ariaLabel,
}: SelectProps): React.JSX.Element {
  const feld = useFeld();
  const liste = selectOptionen(options, value, { placeholder, fehlendLabel });
  return (
    <select
      id={id ?? feld?.ids.input}
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
      aria-label={ariaLabel}
      aria-describedby={feld?.describedBy}
      aria-invalid={feld?.invalid ? true : undefined}
      disabled={disabled || feld?.gesperrt || undefined}
      className={cn(EINGABE_KLASSE, className)}
    >
      {liste.map((o, i) => (
        <option key={i} value={o.value} disabled={o.disabled}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
