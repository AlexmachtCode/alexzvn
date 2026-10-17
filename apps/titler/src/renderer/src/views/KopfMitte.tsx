// Kopfzeile Mitte des Titlers (UX-Pilot C9; Spec 3.2, 5.1, 9.2; E18): die V-Zeile aus Master-Link 2b R2 („Show vom
// Master: … · Stand …“) als StatusPill. Die Farbe der Zeile wird zum Zustand (Symbol und Rand), das Wort bleibt in
// Vordergrundfarbe (Spec 4.2). In der schmalen Mitte endet der Text mit „…“ (kuerzen, 2b-Spec 16.5); der volle Text steht
// im Tooltip.
import { StatusPill } from '@jm/ui';
import type { VerbundAnzeigeZeile } from '@shared/types';
import { verbundZeileZustand } from '@/lib/oberflaeche';

/** V-Zeile oder nichts (Einzelplatz, Brücke noch offen oder ohne Preload). */
export function VerbundZeile({ anzeige }: { anzeige: VerbundAnzeigeZeile | null | undefined }): React.JSX.Element | null {
  if (!anzeige) return null;
  return (
    <span data-titler="verbund" className="block min-w-0 max-w-full overflow-hidden">
      <StatusPill state={verbundZeileZustand(anzeige.farbe)} text={anzeige.text} title={anzeige.text} kuerzen />
    </span>
  );
}
