// Lokale Eingaben des Titlers (UX-Pilot C9, C11): Slider (Ticker-Tempo, Größe) und Farbfeld (Stil), unverändert aus
// OperatorView.tsx verschoben; @jm/ui hat dafür keinen Baustein (E23). Field und Labeled sind mit C11 entfallen: Der Inhalt
// nutzt Field und TextInput aus @jm/ui, das Panel die Abschnitte aus @jm/settings.

export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}): React.JSX.Element {
  return (
    <label className="flex-1">
      <div className="text-[11px] font-semibold mb-1 text-[var(--muted-foreground)]">{label}</div>
      <div className="flex items-center gap-2 h-9 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-6 w-7 rounded cursor-pointer bg-transparent border-0 p-0"
        />
        <span className="text-[11px] tabular text-[var(--muted-foreground)] uppercase">{value}</span>
      </div>
    </label>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}): React.JSX.Element {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between text-sm mb-1">
        <span className="font-semibold">{label}</span>
        <span className="tabular text-[var(--muted-foreground)]">{value.toFixed(2)}</span>
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
