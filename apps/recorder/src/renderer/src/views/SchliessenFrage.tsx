import { Button, Modal } from '@jm/ui';
import { RECORDER_TEXTE } from '@/lib/oberflaeche';

/**
 * Rückfrage beim Schließen des Fensters während einer Aufnahme (Altfehler RE-7a, B3): ein Fenster im Fenster (Modal aus @jm/ui) wie die
 * Rückfrage des Players (EntfernenFrage, Ruling R16). Sie hält nichts an: Aufnahme, Pegel, Companion-Befehle und der Steuerserver laufen
 * weiter, solange sie offen ist. „Weiter aufnehmen“ steht zuerst und bekommt beim Öffnen den Fokus (Modal fokussiert das erste
 * fokussierbare Element; ohne Titel steht kein ✕ davor), Leertaste und Enter darauf beenden also nichts. Escape und ein Klick auf den
 * Hintergrund gelten wie „Weiter aufnehmen“. `onWeiter` muss stabil sein (useCallback): Modal meldet sich bei jedem neuen onClose neu an.
 */
export function SchliessenFrage({ onWeiter, onBeenden }: { onWeiter: () => void; onBeenden: () => void }): React.JSX.Element {
  const T = RECORDER_TEXTE.schliessen;
  return (
    <Modal onClose={onWeiter} className="w-full max-w-md">
      <p className="text-sm font-semibold leading-relaxed">{T.frage}</p>
      <p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">{T.detail}</p>
      <div className="mt-6 flex items-center justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onWeiter}>
          {T.weiter}
        </Button>
        <Button type="button" size="sm" variant="destructive" onClick={onBeenden}>
          {T.beenden}
        </Button>
      </div>
    </Modal>
  );
}
