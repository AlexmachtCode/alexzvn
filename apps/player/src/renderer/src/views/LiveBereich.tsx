// Live-Bereich der Cue-Show (UX Welle 2a, Player d2; Spec 3.4, 5.1; E4, E7, W2-10): oben die Standby-Anzeige (das „immer
// sichtbare“ Element), darunter der Transport als vier TallyButtons aus transportTasten, in der Reihenfolge von heute
// Pause/Weiter, Stop, Panik, GO (GO ganz rechts, wo die Hand des Bedieners es sucht; Ruling vor Prüfung). Jede
// Taste ruft dieselbe Store-Aktion wie der alte Knopf (showGo, showTogglePause, showStop, showPanic); gesperrt nie ohne
// sichtbaren Grund. Rein darstellend: die Aktionen kommen aus der Cue-Show, dieser Bereich liest weder window noch Store und
// hat keine Tastenbehandlung (Leertaste = GO und Esc = Stop bleiben im Hörer der Cue-Show).
import { cn, TallyButton, type TallyButtonProps } from '@jm/ui';
import { PLAYER_TEXTE, standbyText, transportTasten, type Haupttaste, type OberflaechenStand } from '@/lib/oberflaeche';

/** Die Store-Aktionen des Transports, unter ihrem Namen im Store (die Cue-Show reicht sie unverändert durch). */
export interface TransportAktionen {
  showGo(): void;
  showTogglePause(): void;
  showStop(): void;
  showPanic(): void;
}

/** Props eines TallyButton und, wo es einen gibt, der Tooltip (TallyButton hat keinen title; Tasten hüllt ihn). */
export type Taste = TallyButtonProps & { tipp?: string };

/** Eine Haupttaste aus lib/oberflaeche.ts mit ihrem Klick. */
export function knopf(t: Haupttaste, onClick: () => void): Taste {
  return { ...t, onClick };
}

/**
 * Die vier Haupttasten in Anzeigereihenfolge wie bisher (ShowView.tsx:188-209 auf d7cdd79ce0): Pause/Weiter, Stop, Panik, GO.
 * Genau transportTasten plus Klick. Ohne DOM prüfbar.
 */
export function transportKnoepfe(s: Pick<OberflaechenStand, 'player'>, a: TransportAktionen): Taste[] {
  const t = transportTasten(s);
  return [knopf(t.pauseWeiter, a.showTogglePause), knopf(t.stop, a.showStop), knopf(t.panik, a.showPanic), knopf(t.go, a.showGo)];
}

/**
 * Raster der Haupttasten: vier gleich breite Spalten, gap-3 (Spec 5.1, höchstens vier TallyButtons). `abSpalte2` setzt die
 * erste Taste in die zweite Spalte: die Fußleiste stellt Stop und Panik so an dieselbe Stelle wie der Transport der Cue-Show
 * (Spalten 2 und 3); Spalte 4, in der Cue-Show der Platz von GO, bleibt in der Fußleiste frei.
 * `festeHoehe` hält die Zeile auf --control-h-lg + 1,25 rem (66,75 px bei --text-base 15 px): Eine gesperrte Taste mit
 * Grund-Zeile ist 62,19 px hoch, eine bereite 47,99 px (gemessen im Fenster); ohne feste Höhe spränge der Transport beim GO
 * und am Ende der Show um 14 px.
 * Jede Taste steckt in einer Hülle (grid, damit der Knopf die Zeilenhöhe füllt); die Hülle trägt den Tooltip. Die Reihenfolge
 * ist fest, die Beschriftung wechselt (Pause/Weiter): der Index ist der stabile key.
 */
export function Tasten({ tasten, abSpalte2 = false, festeHoehe = false }: { tasten: Taste[]; abSpalte2?: boolean; festeHoehe?: boolean }): React.JSX.Element {
  return (
    <div data-player="tasten" className="grid grid-cols-4 gap-3">
      {tasten.map(({ tipp, ...taste }, i) => (
        <div key={i} title={tipp} className={cn('grid', festeHoehe && 'min-h-[calc(var(--control-h-lg)+1.25rem)]', abSpalte2 && i === 0 && 'col-start-2')}>
          <TallyButton {...taste} />
        </div>
      ))}
    </div>
  );
}

export function LiveBereich({ stand, aktionen }: { stand: Pick<OberflaechenStand, 'player'>; aktionen: TransportAktionen }): React.JSX.Element {
  const S = PLAYER_TEXTE.standby;
  return (
    <div data-player="transport" className="shrink-0 space-y-3 border-t border-[var(--border)]/60 bg-[var(--card)]/50 px-5 py-3">
      <div data-player="standby" className="min-w-0">
        <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">{S.titel}</span>
        <div className="truncate text-sm font-bold">{standbyText(stand.player)}</div>
      </div>
      <Tasten tasten={transportKnoepfe(stand, aktionen)} festeHoehe />
    </div>
  );
}
