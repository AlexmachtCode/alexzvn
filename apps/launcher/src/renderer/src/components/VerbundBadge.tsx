import { cn } from '@jm/ui';
import { kopfanzeige, kopfEingang } from '@/lib/kopfanzeige';
import { useVerbund } from '@/store/verbund';
import { FARBE_KLASSE } from './VerbundTeile';

/** Immer sichtbare Kopfanzeige des Verbunds (Spec 5.4). Klick öffnet das Modal. */
export function VerbundBadge() {
  const stand = useVerbund((s) => s.stand);
  const oeffne = useVerbund((s) => s.oeffne);
  if (!stand) return null;
  const k = kopfanzeige(kopfEingang(stand));
  return (
    <button
      type="button"
      onClick={oeffne}
      aria-label="Verbund"
      title={`Verbund · ${k.text}`}
      className={cn(
        'h-8 max-w-[12rem] truncate rounded-[var(--radius-full)] border px-3 text-[11px] font-bold transition-colors hover:brightness-110',
        FARBE_KLASSE[k.farbe],
      )}
    >
      {k.text}
    </button>
  );
}
