import type { InputHTMLAttributes } from 'react';
import { cn } from '../lib/cn';
import { EINGABE_KLASSE, useFeld, verbindeIds } from './Field';

export interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'size'> {
  value: string;
  onChange(value: string): void;
}

/**
 * Einzeiliges Textfeld (Spec 3.5). Im Field übernimmt es id, aria-describedby, aria-invalid und die Sperre; eigene
 * Props gehen bei id vor, aria-describedby wird ergänzt. Eine Sperre aus dem Field kann die Eingabe nicht aufheben.
 */
export function TextInput({
  value,
  onChange,
  id,
  disabled,
  className,
  type = 'text',
  'aria-describedby': eigeneBeschreibung,
  'aria-invalid': eigenesInvalid,
  ...rest
}: TextInputProps): React.JSX.Element {
  const feld = useFeld();
  return (
    <input
      {...rest}
      type={type}
      id={id ?? feld?.ids.input}
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
      disabled={disabled || feld?.gesperrt || undefined}
      aria-describedby={verbindeIds(feld?.describedBy, eigeneBeschreibung)}
      aria-invalid={eigenesInvalid ?? (feld?.invalid ? true : undefined)}
      className={cn(EINGABE_KLASSE, className)}
    />
  );
}
