// Kleine Formular-Bausteine. @jm/ui hat bewusst kein Select/NumberField —
// die Apps rollen ihre eigenen. Hier zentral, damit Inspector und Regel-Editor
// gleich aussehen.

import { useState, type ReactNode } from 'react';

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

/**
 * Textfeld mit Entwurf: Tippen ändert nur den lokalen Entwurf, übernommen wird
 * mit Enter oder beim Verlassen des Felds; Escape verwirft den Entwurf.
 *
 * Für Werte, die nicht bei jedem Buchstaben ins Dokument dürfen — ein
 * Variablenname ist zugleich der Verweis in Regeln und Elementen (#231).
 * `onCommit` gibt einen Hinweis zurück, wenn der Wert abgelehnt wird; das Feld
 * zeigt dann wieder den alten Wert und darunter den Hinweis.
 */
export function CommitTextField({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (draft: string) => string | null;
}): JSX.Element {
  // null = kein Entwurf, das Feld zeigt den Wert aus dem Dokument.
  const [draft, setDraft] = useState<string | null>(null);
  // Der Hinweis gilt nur für den Wert, bei dem er entstand: ändert sich der Wert
  // von außen (Undo, eine Zeile darüber gelöscht), verschwindet er.
  const [rejected, setRejected] = useState<{ value: string; hint: string } | null>(null);
  const hint = rejected && rejected.value === value ? rejected.hint : null;
  const setHint = (h: string | null): void => setRejected(h ? { value, hint: h } : null);

  const commit = (): void => {
    if (draft === null) return;
    setDraft(null);
    setHint(onCommit(draft));
  };

  return (
    <div>
      <input
        className={INPUT}
        value={draft ?? value}
        aria-invalid={hint ? true : undefined}
        onChange={(e) => {
          setDraft(e.target.value);
          setHint(null);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            setDraft(null);
            setHint(null);
          }
        }}
      />
      {hint && <p className="mt-0.5 text-xs text-[var(--destructive,#e5484d)]">{hint}</p>}
    </div>
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
