import { cn } from '@jm/ui';
import { kopfEingang, kopfText, kopfZeile } from '@/lib/kopfanzeige';
import { useVerbund } from '@/store/verbund';
import { FARBE_KLASSE } from './VerbundTeile';

/**
 * Immer sichtbare Kopfanzeige des Verbunds (Spec 5.4). Klick öffnet das Modal.
 * Bei 980 px ist der Platz knapp, aber die Tabelle 5.4 unterscheidet ihre Zustände im Statusteil, im Code und am
 * „· Karte fehlt“: die Anzeige bricht deshalb lieber um, als sie abzuschneiden. Gekürzt wird NUR der Master-Name
 * (eigenes truncate mit fester Breite); sein voller Text steht im Tooltip und in der Pille des Modals.
 */
export function VerbundBadge() {
  const stand = useVerbund((s) => s.stand);
  const oeffne = useVerbund((s) => s.oeffne);
  if (!stand) return null;
  const z = kopfZeile(kopfEingang(stand));
  return (
    <button
      type="button"
      onClick={oeffne}
      aria-label="Verbund"
      title={`Verbund · ${kopfText(z)}`}
      className={cn(
        'min-h-8 max-w-[17rem] break-words rounded-[var(--radius-full)] border px-3 py-1 text-[11px] font-bold leading-tight transition-colors hover:brightness-110',
        FARBE_KLASSE[z.farbe],
      )}
    >
      {z.vor}
      {z.name && <span className="inline-block max-w-[10rem] truncate align-bottom">{z.name}</span>}
      {z.nach}
      {/* „· Karte fehlt“ bricht nie in sich um (C7); umbrechen darf die Zeile nur davor. */}
      {z.hinweis && <> <span className="whitespace-nowrap">{z.hinweis}</span></>}
    </button>
  );
}
