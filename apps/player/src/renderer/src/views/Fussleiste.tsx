// Fußleiste in Bibliothek und Soundboard (UX Welle 2a, Player d2; W2-10, E14): Stop und Panik fest unten, dieselben
// Store-Aktionen wie im Transport der Cue-Show (showStop, showPanic; Panik stoppt seit W2-10 auch die Pads), ohne Kürzel
// (Leertaste und Esc gelten nur in der Cue-Show). Die Cue-Show selbst hat keine Fußleiste: dort sitzen Stop und Panik im
// Transport. Stop vor Panik, in den Spalten 2 und 3 des Rasters, an derselben Stelle wie im Transport; Spalte 4 bleibt frei
// (dort liegt in der Cue-Show GO, Panik soll nie dort liegen, wo die Hand GO sucht).
import { useShallow } from 'zustand/react/shallow';
import { fussleistenTasten, type OberflaechenStand } from '@/lib/oberflaeche';
import { usePlayer } from '@/store/player';
import { knopf, Tasten, type Taste, type TransportAktionen } from './LiveBereich';

export type FussleistenAktionen = Pick<TransportAktionen, 'showStop' | 'showPanic'>;

/** Stop und Panik in Anzeigereihenfolge: genau fussleistenTasten plus Klick. Ohne DOM prüfbar. */
export function fussleistenKnoepfe(s: Pick<OberflaechenStand, 'player'>, a: FussleistenAktionen): Taste[] {
  const t = fussleistenTasten(s);
  return [knopf(t.stop, a.showStop), knopf(t.panik, a.showPanic)];
}

/** Die Leiste ohne Store (für Tests und die verbundene Fußleiste). */
export function FussleisteAnzeige({ stand, aktionen }: { stand: Pick<OberflaechenStand, 'player'>; aktionen: FussleistenAktionen }): React.JSX.Element {
  return (
    <div data-player="fussleiste" className="shrink-0 border-t border-[var(--border)]/60 bg-[var(--card)]/50 px-5 py-3">
      <Tasten tasten={fussleistenKnoepfe(stand, aktionen)} abSpalte2 />
    </div>
  );
}

/** Die Fußleiste am Store: derselbe Stand wie in der Oberfläche (vor dem Laden ohne Store), die Aktionen showStop und showPanic. */
export function Fussleiste(): React.JSX.Element {
  const geladen = usePlayer((s) => !s.loading);
  const player = usePlayer(
    useShallow((s) => ({
      activeShowId: s.activeShowId,
      showCues: s.showCues,
      standbyIndex: s.standbyIndex,
      playingCueIds: s.playingCueIds,
      vorlaufCueIds: s.vorlaufCueIds,
      showPaused: s.showPaused,
      videoCue: s.videoCue,
      videoProgress: s.videoProgress,
      outputDisplayId: s.outputDisplayId,
    })),
  );
  const showStop = usePlayer((s) => s.showStop);
  const showPanic = usePlayer((s) => s.showPanic);
  return <FussleisteAnzeige stand={{ player: geladen ? player : undefined }} aktionen={{ showStop, showPanic }} />;
}
