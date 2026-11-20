import { useEffect, useState } from 'react';
import { cn } from '@jm/ui';
import { KOPF_BREIT_AB_PX, KOPF_FARBE_KLASSE, kontoKopf } from '@/lib/konto-anzeige';
import { useKonto } from '@/store/konto';

/** OFP5: ab 1180 px Fensterbreite Kreis plus „Name · Stufe“, darunter nur der Kreis (Name und Stufe im Tooltip). */
function useBreit(): boolean {
  const [breit, setBreit] = useState(() => window.innerWidth >= KOPF_BREIT_AB_PX);
  useEffect(() => {
    const neu = (): void => setBreit(window.innerWidth >= KOPF_BREIT_AB_PX);
    window.addEventListener('resize', neu);
    return () => window.removeEventListener('resize', neu);
  }, []);
  return breit;
}

/**
 * Anmeldung (Plan P24, Spec 4.2): „angemeldet als …“ rechts außen im Kopf — Kreis mit Initialen in der Stufenfarbe, daneben
 * „Name · Stufe“ bzw. der Zustand; ohne Anmeldung „Anmelden“. Was gezeigt wird, entscheidet allein kontoKopf (G7); vor der
 * ersten Ansicht zeigt der Kopf nichts. Klick: Anmelde-Dialog bzw. Konto-Dialog.
 */
export function KontoKreis(): React.JSX.Element | null {
  const ansicht = useKonto((s) => s.ansicht);
  const anmelden = useKonto((s) => s.anmelden);
  const oeffneKonto = useKonto((s) => s.oeffneKonto);
  const breit = useBreit();
  const k = kontoKopf(ansicht, breit);
  if (k.aktion === null) return null;
  return (
    <button
      type="button"
      onClick={k.aktion === 'anmelden' ? anmelden : oeffneKonto}
      data-anleitung="kopf.konto"
      aria-label={k.titel}
      title={k.titel}
      className={cn(
        'flex h-8 items-center gap-2 rounded-[var(--radius-full)] px-1 transition-colors hover:bg-[var(--highlight)]',
        k.initialen === null && cn('px-3 text-xs font-semibold whitespace-nowrap', KOPF_FARBE_KLASSE[k.farbe]),
      )}
    >
      {k.initialen !== null && (
        <span
          aria-hidden
          className={cn('grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-extrabold', KOPF_FARBE_KLASSE[k.farbe])}
        >
          {k.initialen}
        </span>
      )}
      {k.initialen !== null && k.text && <span className="whitespace-nowrap pr-2 text-xs font-semibold">{k.text}</span>}
      {k.initialen === null && k.text}
    </button>
  );
}
