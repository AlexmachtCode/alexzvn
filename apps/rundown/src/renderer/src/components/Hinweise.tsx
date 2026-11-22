// Hinweise im Live-Bereich (UX Welle 1, Aufgabe d; E11, Spec 4.6 des Rundowns): Kurze Hinweise entfernt der Main nach 6 s, stehende
// klickt der Bediener mit dem ✕ weg. Rein darstellend: Der Rückruf kommt von der View.
import { Button } from '@jm/ui';
import { RUNDOWN_TEXTE } from '@/lib/oberflaeche';
import type { RundownHinweis } from '@shared/types';

export function Hinweise({ hinweise, onWeg }: { hinweise: RundownHinweis[]; onWeg: (id: number) => void }): React.JSX.Element | null {
  if (hinweise.length === 0) return null;
  return (
    <div data-rundown="hinweise" className="shrink-0 space-y-1 border-b border-[var(--border)] px-4 py-1.5">
      {hinweise.map((h) => (
        <div
          key={h.id}
          className={`flex items-center gap-2 text-xs ${h.art === 'stehend' ? 'text-[var(--warning)]' : 'text-[var(--muted-foreground)]'}`}
        >
          <span className="min-w-0 flex-1">{h.text}</span>
          {h.art === 'stehend' && (
            <Button type="button" variant="ghost" size="sm" uppercase={false} title={RUNDOWN_TEXTE.hinweise.schliessen} onClick={() => onWeg(h.id)}>
              ✕
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
