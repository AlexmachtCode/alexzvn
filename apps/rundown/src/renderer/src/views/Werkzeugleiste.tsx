// Werkzeugleiste des Rundowns (UX Welle 1, Aufgabe d; E11): Namensfeld, „• ungespeichert“, die kurze Rückmeldung und die sechs Datei-,
// Import- und Export-Knöpfe aus der alten Kopfzeile. Reine Darstellung: Die Abläufe (Regieplan-Import samt Rückfrage, Export, Datei-
// Dialoge) bleiben in App.tsx und kommen als Aktionen herein; der Rahmen setzt die Leiste in die toolbar des AppShell.
import { Button } from '@jm/ui';
import { RUNDOWN_TEXTE } from '@/lib/oberflaeche';
import type { RundownState } from '@shared/types';

export interface DateiAktionen {
  neu(): void;
  oeffnen(): void;
  regieplan(): void;
  exportieren(): void;
  speichern(): void;
  speichernUnter(): void;
  /** Der Name des Ablaufs wurde im Feld geändert (bei onBlur). */
  umbenennen(name: string): void;
}

export interface WerkzeugleisteProps {
  state: Pick<RundownState, 'doc' | 'filePath' | 'abweisungen' | 'dirty'>;
  /** Kurze Rückmeldung (Import, Export), blendet die App nach 5 s aus. */
  notice: string | null;
  aktionen: DateiAktionen;
}

export function Werkzeugleiste({ state, notice, aktionen }: WerkzeugleisteProps): React.JSX.Element {
  const T = RUNDOWN_TEXTE.datei;
  return (
    <>
      <input
        key={`${state.doc.name}|${state.filePath ?? ''}|${state.abweisungen}`}
        defaultValue={state.doc.name}
        onBlur={(e) => aktionen.umbenennen(e.target.value)}
        aria-label={T.namensfeld}
        className="h-[var(--control-h)] w-56 min-w-0 rounded-[var(--radius-md)] border border-transparent bg-transparent px-2 text-sm font-semibold text-[var(--foreground)] select-text hover:border-[var(--border)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)]"
      />
      {state.dirty && <span className="shrink-0 text-xs text-[var(--primary)]">{T.ungespeichert}</span>}
      {notice && <span className="min-w-0 truncate text-xs text-[var(--muted-foreground)]" title={notice}>{notice}</span>}
      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        <Button type="button" size="sm" variant="ghost" uppercase={false} onClick={aktionen.neu}>
          {T.neu}
        </Button>
        <Button type="button" size="sm" variant="outline" uppercase={false} onClick={aktionen.oeffnen}>
          {T.oeffnen}
        </Button>
        <Button type="button" size="sm" variant="outline" uppercase={false} title={T.regieplanTitel} onClick={aktionen.regieplan}>
          {T.regieplan}
        </Button>
        <Button type="button" size="sm" variant="outline" uppercase={false} title={T.exportierenTitel} onClick={aktionen.exportieren}>
          {T.exportieren}
        </Button>
        <Button type="button" size="sm" variant="outline" uppercase={false} onClick={aktionen.speichern}>
          {T.speichern}
        </Button>
        <Button type="button" size="sm" variant="outline" uppercase={false} onClick={aktionen.speichernUnter}>
          {T.speichernUnter}
        </Button>
      </div>
    </>
  );
}
