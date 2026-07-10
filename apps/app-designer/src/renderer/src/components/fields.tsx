// Kleine Formular-Bausteine. @jm/ui hat bewusst kein Select/NumberField —
// die Apps rollen ihre eigenen. Hier zentral, damit Inspector und Regel-Editor
// gleich aussehen.

import type { ReactNode } from 'react';

const INPUT =
  'w-full rounded border border-[var(--border)] bg-[var(--input,rgba(255,255,255,.05))] px-2 py-1 text-sm ' +
  'outline-none focus:border-[var(--primary)]';

export function Row({ label, children }: { label: string; children: ReactNode }): JSX.Element {
  return (
    <label className="mb-2 flex items-center gap-2 text-sm">
      <span className="w-28 shrink-0 text-[var(--muted-foreground)]">{label}</span>
      {children}
    </label>
  );
}

export function TextField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}): JSX.Element {
  return (
    <input
      className={INPUT}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function NumberField({
  value,
  onChange,
  min,
  max,
  step,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}): JSX.Element {
  return (
    <input
      type="number"
      className={INPUT}
      value={Number.isFinite(value) ? value : 0}
      min={min}
      max={max}
      step={step}
      onChange={(e) => {
        const n = Number(e.target.value);
        if (Number.isFinite(n)) onChange(n);
      }}
    />
  );
}

export function ColorField({ value, onChange }: { value: string; onChange: (v: string) => void }): JSX.Element {
  return (
    <div className="flex w-full gap-2">
      <input
        type="color"
        className="h-8 w-10 shrink-0 cursor-pointer rounded border border-[var(--border)] bg-transparent"
        value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'}
        onChange={(e) => onChange(e.target.value)}
      />
      <input className={INPUT} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export interface Option {
  value: string;
  label: string;
}

export function SelectField({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder?: string;
}): JSX.Element {
  return (
    <select className={INPUT} value={value} onChange={(e) => onChange(e.target.value)}>
      {placeholder != null && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function CheckField({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}): JSX.Element {
  return (
    <label className="mb-2 flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
