import { createContext, useContext, useId, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { beschreibtDurch, feldIds, type FeldIds } from '../lib/eingabe';
import { STATUS_SYMBOL, STATUS_SYMBOL_KLASSE } from '../lib/status';
import { UI_TEXTE } from '../lib/texte';

export interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  lockedReason?: string;
  /** Basis-id; ohne sie entsteht eine per useId(). */
  id?: string;
  className?: string;
  children: ReactNode;
}

/** Was eine Eingabe im Field erfährt (E13). */
export interface FeldKontext {
  ids: FeldIds;
  describedBy?: string;
  invalid: boolean;
  gesperrt: boolean;
}

const FeldKontextReact = createContext<FeldKontext | null>(null);

/** Kontext des umgebenden Field, sonst null (Eingabe steht allein). */
export function useFeld(): FeldKontext | null {
  return useContext(FeldKontextReact);
}

/**
 * Gemeinsame Klassen aller einzeiligen Eingaben (TextInput, NumberInput, Select): Höhe aus --control-h (Dichte über
 * den Token, nicht über überschreibbare Klassen – cn hat kein tailwind-merge), Fokus-Ring, Fehlerrand bei aria-invalid.
 * Nur aus dieser Datei exportiert, nicht aus index.ts.
 */
export const EINGABE_KLASSE =
  'h-[var(--control-h)] w-full min-w-0 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--input)] px-2.5 ' +
  'text-[13px] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] select-text ' +
  'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)] ' +
  'disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-[var(--status-error)]';

/** id-Listen für aria-describedby zusammenfügen; leer → undefined. Nur aus dieser Datei exportiert. */
export function verbindeIds(...ids: Array<string | undefined>): string | undefined {
  const liste = ids.filter((id): id is string => Boolean(id));
  return liste.length > 0 ? liste.join(' ') : undefined;
}

/**
 * Beschriftete Eingabe (Spec 3.5; E13): Beschriftung, Eingabe, Hilfe, Sperrgrund, Fehler. Stellt den Eingaben id,
 * aria-describedby (Hilfe, Sperre, Fehler), aria-invalid und die Sperre über den Kontext bereit.
 */
export function Field({ label, hint, error, lockedReason, id, className, children }: FieldProps): React.JSX.Element {
  const eigeneId = useId();
  const ids = feldIds(id ?? eigeneId);
  const kontext: FeldKontext = {
    ids,
    describedBy: beschreibtDurch(ids, { hilfe: Boolean(hint), sperre: Boolean(lockedReason), fehler: Boolean(error) }),
    invalid: Boolean(error),
    gesperrt: Boolean(lockedReason),
  };
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={ids.input} className="text-xs font-semibold text-[var(--foreground)]">
        {label}
      </label>
      <FeldKontextReact.Provider value={kontext}>{children}</FeldKontextReact.Provider>
      {hint ? (
        <p id={ids.hilfe} className="text-[11px] text-[var(--muted-foreground)]">
          {hint}
        </p>
      ) : null}
      {lockedReason ? (
        <p id={ids.sperre} className="text-[11px] text-[var(--muted-foreground)]">
          {UI_TEXTE.gesperrt(lockedReason)}
        </p>
      ) : null}
      {error ? (
        <p id={ids.fehler} className="text-[11px] font-semibold text-[var(--foreground)]">
          <span aria-hidden="true" className={STATUS_SYMBOL_KLASSE.error}>
            {STATUS_SYMBOL.error}
          </span>{' '}
          {error}
        </p>
      ) : null}
    </div>
  );
}
