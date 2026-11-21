// Werkzeugleiste des Switchers (UX Welle 1, d1; E6): die Projekt-Leiste aus dem Mischer – Name, „· ungespeichert“, Neu, Öffnen,
// Speichern, Speichern unter. Reine Darstellung: Die Abläufe (Rückfrage bei „Neu“, Dialoge, Speichern) bleiben in SwitcherView
// und kommen als Aktionen herein; der Rahmen setzt die Leiste in die toolbar des AppShell.
import { Button } from '@jm/ui';
import { SWITCHER_TEXTE, type ProjektAktionen } from '@/lib/oberflaeche';

export interface WerkzeugleisteProps {
  name: string;
  /** Pfad der geöffneten Datei; null = noch nicht gespeichert. */
  pfad: string | null;
  aktionen: ProjektAktionen;
}

export function Werkzeugleiste({ name, pfad, aktionen }: WerkzeugleisteProps): React.JSX.Element {
  const T = SWITCHER_TEXTE.projekt;
  return (
    <>
      <span className="text-[10px] uppercase tracking-[0.14em] font-bold text-[var(--muted-foreground)]">{T.titel}</span>
      <span className="text-sm font-semibold truncate max-w-[320px]" title={pfad ?? T.nichtGespeichert}>
        {name}
      </span>
      {!pfad && <span className="text-[10px] text-[var(--muted-foreground)]">{T.ungespeichert}</span>}
      <div className="ml-auto flex items-center gap-1.5">
        <Button size="sm" variant="ghost" onClick={aktionen.neu}>
          {T.neu}
        </Button>
        <Button size="sm" variant="outline" onClick={aktionen.oeffnen}>
          {T.oeffnen}
        </Button>
        <Button size="sm" variant="outline" onClick={aktionen.speichern}>
          {T.speichern}
        </Button>
        <Button size="sm" variant="outline" onClick={aktionen.speichernUnter}>
          {T.speichernUnter}
        </Button>
      </div>
    </>
  );
}
