// Zahlenfeld mit Klemmwert im Handler (UX Welle 1, Fund C4): NumberInput aus @jm/ui, das nach dem Übernehmen immer den echten Wert
// zeigt. Steht der Wert schon am Klemmwert und wird jenseits davon übernommen (Redezeit 5, Eingabe 3), bleibt der gespeicherte Wert
// gleich; NumberInput bekäme keinen neuen Wert zurück und zeigte nach der Frist „Noch nicht übernommen.“ bei der Eingabe. Dann baut
// die Hülle das Feld neu auf (neuer key), und es beginnt beim echten Wert; ein Fokus im Feld kommt mit. Lokal je App, kein Umbau von
// @jm/ui.
import { NumberInput } from '@jm/ui';
import { useEffect, useRef, useState, type ComponentProps } from 'react';

type NumberInputProps = ComponentProps<typeof NumberInput>;

export interface GeklemmteZahlProps extends Omit<NumberInputProps, 'value' | 'onChange'> {
  value: number;
  /** Der Klemmwert des Handlers, z. B. (v) => Math.max(5, v). */
  klemme(v: number): number;
  /** Bekommt den geklemmten Wert. */
  onChange(v: number): void;
}

/**
 * Was beim Übernehmen von `eingabe` geschieht: Der geklemmte Wert geht an onChange; gleicht er dem aktuellen Wert, kommt kein neuer
 * Wert zurück, und das Feld muss neu aufgebaut werden, damit es den echten Wert zeigt. Ohne DOM prüfbar.
 */
export function klemmUebernahme(aktuell: number | null, eingabe: number, klemme: (v: number) => number): { wert: number; neuAufbauen: boolean } {
  const wert = klemme(eingabe);
  return { wert, neuAufbauen: wert === aktuell && eingabe !== aktuell };
}

export function GeklemmteZahl({ value, klemme, onChange, ...rest }: GeklemmteZahlProps): React.JSX.Element {
  const [aufbau, setAufbau] = useState(0);
  const huelle = useRef<HTMLDivElement>(null);
  const fokusZurueck = useRef(false);
  // Nach dem Neuaufbau: Hatte das Feld den Fokus (Übernehmen mit Enter), bekommt das neue Feld ihn wieder.
  useEffect(() => {
    if (!fokusZurueck.current) return;
    fokusZurueck.current = false;
    huelle.current?.querySelector('input')?.focus();
  }, [aufbau]);
  return (
    <div ref={huelle} className="contents">
      <NumberInput
        key={aufbau}
        {...rest}
        value={value}
        onChange={(v) => {
          const r = klemmUebernahme(value, v, klemme);
          onChange(r.wert);
          if (r.neuAufbauen) {
            fokusZurueck.current = huelle.current?.contains(document.activeElement) ?? false;
            setAufbau((n) => n + 1);
          }
        }}
      />
    </div>
  );
}
