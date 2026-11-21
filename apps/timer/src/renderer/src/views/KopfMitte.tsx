// Kopfzeile Mitte des Timers (UX Welle 1, Aufgabe d; Spec 3.2, 5.1; E3, E18): die V-Zeile aus Master-Link 2b R2 („Show vom Master:
// … · Stand …“) als StatusPill wie beim Titler, daneben der Speaker-Knopf. Die Farbe der Zeile wird zum Zustand (Symbol und Rand), das
// Wort bleibt in Vordergrundfarbe (Spec 4.2); der volle Text steht im Tooltip. Kein window: Der Rückruf kommt von der View.
import { Button, StatusPill } from '@jm/ui';
import type { VerbundAnzeigeZeile } from '@shared/verbund';
import { TIMER_TEXTE, verbundZeileZustand } from '@/lib/oberflaeche';

export interface KopfMitteProps {
  /** V-Zeile oder nichts (Einzelplatz, Brücke noch offen oder ohne Preload). */
  anzeige: VerbundAnzeigeZeile | null | undefined;
  /** Speaker-Fenster offen? undefined = noch nicht gefragt oder ohne Preload. */
  speakerOffen: boolean | undefined;
  onSpeaker(): void;
}

export function KopfMitte({ anzeige, speakerOffen, onSpeaker }: KopfMitteProps): React.JSX.Element {
  return (
    <span className="flex min-w-0 max-w-full items-center justify-center gap-2">
      {anzeige ? (
        <span data-timer="verbund" className="block min-w-0 max-w-full overflow-hidden">
          <StatusPill state={verbundZeileZustand(anzeige.farbe)} text={anzeige.text} title={anzeige.text} kuerzen />
        </span>
      ) : null}
      <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={onSpeaker}>
        {speakerOffen === true ? TIMER_TEXTE.speaker.knopfOffen : TIMER_TEXTE.speaker.knopfZu}
      </Button>
    </span>
  );
}
