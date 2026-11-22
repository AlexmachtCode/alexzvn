// Kopfzeile Mitte des Rundowns (UX Welle 1, Aufgabe d; Spec 3.2, 5.1; E11): die V-Zeile aus Master-Link 2b R2 („Show vom Master:
// … · Stand …“) als StatusPill wie bei Titler und Timer. Die Farbe der Zeile wird zum Zustand (Symbol und Rand), das Wort bleibt in
// Vordergrundfarbe (Spec 4.2); der volle Text steht im Tooltip. Kein window: Die Anzeige kommt von der View.
import { StatusPill } from '@jm/ui';
import { verbundZeileZustand } from '@/lib/oberflaeche';
import type { VerbundAnzeigeZeile } from '@shared/types';

export interface KopfMitteProps {
  /** V-Zeile oder nichts (Einzelplatz, Brücke noch offen oder ohne Preload). */
  anzeige: VerbundAnzeigeZeile | null | undefined;
}

export function KopfMitte({ anzeige }: KopfMitteProps): React.JSX.Element | null {
  if (!anzeige) return null;
  return (
    <span data-rundown="verbund" className="block min-w-0 max-w-full overflow-hidden">
      <StatusPill state={verbundZeileZustand(anzeige.farbe)} text={anzeige.text} title={anzeige.text} kuerzen />
    </span>
  );
}
