import { Button, Modal } from '@jm/ui';
import { PLAYER_TEXTE, type EntfernenRueckfrage } from '@/lib/oberflaeche';

/**
 * Rückfrage beim Entfernen eines Cues während der Show und eines Mediums, das Cues oder Pads benutzen (Altfehler PL-10, Ruling R16):
 * ein Fenster im Fenster (Modal aus @jm/ui) statt der Rückfrage des Browsers. Sie hält nichts an: Companion-Befehle, das Ende eines
 * Cues und Vorläufe wirken weiter, solange sie offen ist. „Abbrechen“ steht zuerst und bekommt beim Öffnen den Fokus (Modal fokussiert
 * das erste fokussierbare Element; ohne Titel steht kein ✕ davor), Leertaste und Enter darauf entfernen also nichts. Escape und ein
 * Klick auf den Hintergrund schließen wie „Abbrechen“; „Entfernen“ schließt und entfernt. `onSchliessen` muss stabil sein
 * (useCallback): Modal meldet sich bei jedem neuen onClose neu an und holte den Fokus sonst bei jeder Store-Änderung zurück.
 */
export function EntfernenFrage({ rueckfrage, onSchliessen }: { rueckfrage: EntfernenRueckfrage; onSchliessen: () => void }): React.JSX.Element {
  const T = PLAYER_TEXTE.rueckfrage;
  return (
    <Modal onClose={onSchliessen} className="w-full max-w-md">
      <p className="text-sm font-semibold leading-relaxed">{rueckfrage.frage}</p>
      <div className="mt-6 flex items-center justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onSchliessen}>
          {T.abbrechen}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          onClick={() => {
            onSchliessen();
            rueckfrage.entfernen();
          }}
        >
          {T.entfernen}
        </Button>
      </div>
    </Modal>
  );
}
