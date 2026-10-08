import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '../lib/cn';
import { starteFrist, zahlEntwurfAus, zahlSchrittMitSperre, type ZahlEntwurf, type ZahlEreignis, type ZahlRegeln } from '../lib/eingabe';
import { STATUS_SYMBOL, STATUS_SYMBOL_KLASSE } from '../lib/status';
import { EINGABE_KLASSE, useFeld, verbindeIds } from './Field';

export interface NumberInputProps {
  value: number | null;
  onChange(value: number): void;
  min?: number;
  max?: number;
  ganzzahl?: boolean;
  unit?: string;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  'aria-label'?: string;
}

/**
 * Tastatur im Zahlenfeld (E8, E12): Enter übernimmt; Escape verwirft einen geänderten Entwurf und verbraucht die Taste
 * (stopPropagation + preventDefault), damit ein offenes Einstellungs-Panel dabei nicht schließt. Ohne Änderung bleibt
 * Escape frei. Nur aus dieser Datei exportiert, nicht aus index.ts.
 */
export function zahlTaste(
  e: { key: string; stopPropagation(): void; preventDefault(): void },
  schritt: (ereignis: ZahlEreignis) => { verbraucht: boolean },
): void {
  if (e.key === 'Enter') {
    schritt({ art: 'uebernehmen' });
    return;
  }
  if (e.key !== 'Escape') return;
  if (schritt({ art: 'verwerfen' }).verbraucht) {
    e.stopPropagation();
    e.preventDefault();
  }
}

export interface NumberInputAnsichtProps extends Omit<NumberInputProps, 'value' | 'onChange' | 'min' | 'max'> {
  entwurf: ZahlEntwurf;
  onTippen(text: string): void;
  onUebernehmen(): void;
  onTaste(e: { key: string; stopPropagation(): void; preventDefault(): void }): void;
}

/** Handler des Eingabefelds (E12): Tippen, Verlassen und Tasten gehen an die Ansicht-Rückrufe. Nur aus dieser Datei exportiert. */
export function zahlFeldHandler(p: Pick<NumberInputAnsichtProps, 'onTippen' | 'onUebernehmen' | 'onTaste'>): {
  onChange(e: { currentTarget: { value: string } }): void;
  onBlur(): void;
  onKeyDown(e: { key: string; stopPropagation(): void; preventDefault(): void }): void;
} {
  return {
    onChange: (e) => p.onTippen(e.currentTarget.value),
    onBlur: () => p.onUebernehmen(),
    onKeyDown: (e) => p.onTaste(e),
  };
}

/** Was NumberInput der Ansicht gibt: jedes Ereignis als Schritt des Entwurfs (Escape über zahlTaste). Nur aus dieser Datei. */
export function zahlAnsichtHandler(
  schritt: (e: ZahlEreignis) => { verbraucht: boolean },
): Pick<NumberInputAnsichtProps, 'onTippen' | 'onUebernehmen' | 'onTaste'> {
  return {
    onTippen: (text) => schritt({ art: 'tippen', text }),
    onUebernehmen: () => schritt({ art: 'uebernehmen' }),
    onTaste: (e) => zahlTaste(e, schritt),
  };
}

/**
 * Reine Darstellung des Zahlenfelds aus einem Entwurf (testbar ohne Zustand). Ein ungültiger Entwurf bleibt stehen,
 * mit Fehlertext direkt unter dem Feld und aria-invalid (kein stilles Klemmen). Nur aus dieser Datei exportiert.
 */
export function NumberInputAnsicht({
  entwurf,
  onTippen,
  onUebernehmen,
  onTaste,
  ganzzahl,
  unit,
  placeholder,
  disabled,
  id,
  className,
  'aria-label': ariaLabel,
}: NumberInputAnsichtProps): React.JSX.Element {
  const feld = useFeld();
  const eigeneId = useId();
  const inputId = id ?? feld?.ids.input ?? eigeneId;
  const einheitId = unit ? `${inputId}-einheit` : undefined;
  const fehlerId = entwurf.fehler ? `${inputId}-zahlfehler` : undefined;
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          id={inputId}
          inputMode={ganzzahl ? 'numeric' : 'decimal'}
          value={entwurf.text}
          placeholder={placeholder}
          aria-label={ariaLabel}
          disabled={disabled || feld?.gesperrt || undefined}
          aria-invalid={entwurf.fehler || feld?.invalid ? true : undefined}
          aria-describedby={verbindeIds(feld?.describedBy, fehlerId, einheitId)}
          {...zahlFeldHandler({ onTippen, onUebernehmen, onTaste })}
          className={cn(EINGABE_KLASSE, 'tabular')}
        />
        {unit ? (
          <span id={einheitId} className="shrink-0 text-xs text-[var(--muted-foreground)]">
            {unit}
          </span>
        ) : null}
      </div>
      {entwurf.fehler ? (
        <p id={fehlerId} className="text-[11px] font-semibold text-[var(--foreground)]">
          <span aria-hidden="true" className={STATUS_SYMBOL_KLASSE.error}>
            {STATUS_SYMBOL.error}
          </span>{' '}
          {entwurf.fehler}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Zahlenfeld (Spec 3.5; E12): Entwurf als Text, Komma und Punkt als Dezimaltrenner. Enter und Verlassen übernehmen nur
 * eine gültige Zahl im Bereich, sonst bleibt der Entwurf mit Fehlertext. Escape verwirft. Einheit rechts als Text.
 */
export function NumberInput({ value, onChange, min, max, ganzzahl, ...ansicht }: NumberInputProps): React.JSX.Element {
  const [entwurf, setEntwurf] = useState<ZahlEntwurf>(() => zahlEntwurfAus(value));
  const entwurfRef = useRef(entwurf);
  const wertRef = useRef(value);
  wertRef.current = value;
  const regelnRef = useRef<ZahlRegeln>({ min, max, ganzzahl });
  regelnRef.current = { min, max, ganzzahl };
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  // Gesperrt wie in der Ansicht (eigenes disabled oder Sperrgrund des Field): ein gesperrtes Feld meldet nichts.
  const feld = useFeld();
  const gesperrt = Boolean(ansicht.disabled || feld?.gesperrt);
  const gesperrtRef = useRef(gesperrt);
  gesperrtRef.current = gesperrt;

  const schritt = (e: ZahlEreignis): { verbraucht: boolean } => {
    const r = zahlSchrittMitSperre(gesperrtRef.current, entwurfRef.current, e, regelnRef.current, wertRef.current);
    entwurfRef.current = r.z;
    setEntwurf(r.z);
    if (r.neuerWert !== undefined) onChangeRef.current(r.neuerWert);
    return r;
  };
  const schrittRef = useRef(schritt);
  schrittRef.current = schritt;

  // Neuer Wert von außen: ein unveränderter Entwurf folgt, ein angefangener bleibt (zahlSchritt 'aussen').
  useEffect(() => {
    schrittRef.current({ art: 'aussen', wert: value });
  }, [value]);

  // Wird das Feld gesperrt, fällt ein angefangener Entwurf weg: Es zeigt den echten Wert (Escape geht im gesperrten Feld nicht).
  useEffect(() => {
    if (gesperrt) schrittRef.current({ art: 'verwerfen' });
  }, [gesperrt]);

  // Frist (E27): Kommt ein gemeldeter Wert nicht zurück, zeigt das Feld nach 2 s „Noch nicht übernommen.“.
  useEffect(
    () => (entwurf.gesendet === undefined ? undefined : starteFrist(() => schrittRef.current({ art: 'frist' }))),
    [entwurf.gesendet],
  );

  return (
    <NumberInputAnsicht {...ansicht} ganzzahl={ganzzahl} entwurf={entwurf} {...zahlAnsichtHandler(schritt)} />
  );
}
