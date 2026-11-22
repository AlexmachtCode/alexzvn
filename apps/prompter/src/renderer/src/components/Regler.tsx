import { cn } from '@jm/ui';

/** Regler mit Beschriftung und Wert (Schieber). Aussehen wie bisher im Steuerpult, Farben nur aus Tokens. */
export function Regler({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
  className,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (v: number) => void;
  className?: string;
}): React.JSX.Element {
  return (
    <label className={cn('block', className)}>
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="font-semibold">{label}</span>
        <span className="tabular text-[var(--muted-foreground)]">
          {value.toFixed(step < 1 ? (step < 0.1 ? 2 : 1) : 0)}
          {suffix ?? ''}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--primary)]"
      />
    </label>
  );
}
