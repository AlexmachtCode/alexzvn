import { useEffect, useState } from 'react';
import { pillenText, type GastKlickerStatus } from '@shared/gast-klicker';

/**
 * #317: kleine Anzeige in der Referentenansicht, nur wenn der Gast-Klicker an ist. Ein Klick pausiert bzw. setzt
 * Gast-Klicks fort, damit Niki während der Präsentation nicht ins Fenster „Fernsteuerung“ wechseln muss.
 */
export function GastKlickerPille() {
  const [s, setS] = useState<GastKlickerStatus | null>(null);

  useEffect(() => {
    void window.jmpr.gastKlicker.status().then(setS);
    return window.jmpr.gastKlicker.onStatus(setS);
  }, []);

  const text = s ? pillenText(s) : null;
  if (!s || !text) return null;
  const ok = s.lage === 'verbunden';
  const farbe = !ok
    ? 'bg-[var(--destructive)]/20 ring-[var(--destructive)]/50 text-[var(--destructive)]'
    : s.pausiert
      ? 'bg-amber-500/20 ring-amber-400/60 text-amber-200'
      : 'bg-emerald-500/15 ring-emerald-400/50 text-emerald-200';

  return (
    <button
      type="button"
      onClick={() => void window.jmpr.gastKlicker.pause(!s.pausiert).then(setS)}
      title={
        s.pausiert
          ? 'Gast-Klicks sind pausiert – klicken zum Fortsetzen'
          : `Remote-Gäste können vor/zurück klicken (${s.gaeste} verbunden) – klicken zum Pausieren`
      }
      className={`h-8 px-3 rounded-md text-xs font-semibold ring-1 whitespace-nowrap ${farbe}`}
    >
      {text}
    </button>
  );
}
