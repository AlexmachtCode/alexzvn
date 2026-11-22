import { Button, Card } from '@jm/ui';
import type { BattleState, Side } from '@shared/types';
import { ECKEN_FARBE, farbeMischen, UNENTSCHIEDEN_FARBE } from '@/lib/oberflaeche';

/**
 * Was das Scoreboard auslöst: die Handler des Stores. „Nächste Runde“ ist nicht mehr hier, sondern eine Haupttaste; ◀ und die
 * Rundenknöpfe bleiben.
 */
export interface ScoreboardAktionen {
  prevRound(): void;
  gotoRound(runde: number): void;
  setJuryWinner(runde: number, winner: Side | 'tie' | null): void;
  clearVotes(runde: number): void;
}

/** Runden-Navigation + Jury-Entscheid der aktuellen Runde + Voting-Balken. */
export function Scoreboard({ state, aktionen }: { state: BattleState; aktionen: ScoreboardAktionen }): React.JSX.Element {
  const cur = state.rounds.find((r) => r.round === state.round);
  const total = state.competitors;

  const juryBtn = (winner: Side | 'tie', label: string, color: string): React.ReactNode => {
    const active = cur?.juryWinner === winner;
    return (
      <button
        type="button"
        aria-pressed={active}
        onClick={() => aktionen.setJuryWinner(state.round, active ? null : winner)}
        className={
          'flex-1 rounded-[var(--radius-md)] border px-3 py-2 text-sm font-semibold transition ' +
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]'
        }
        style={{
          borderColor: active ? color : 'var(--border)',
          background: active ? farbeMischen(color, 13) : 'transparent',
          color: active ? color : 'var(--foreground)',
        }}
      >
        {label}
      </button>
    );
  };

  const totalVotes = (cur?.votesA ?? 0) + (cur?.votesB ?? 0);
  const pctA = totalVotes > 0 ? Math.round(((cur?.votesA ?? 0) / totalVotes) * 100) : 50;

  return (
    <Card glossy={false} data-ba="scoreboard" className="p-4">
      {/* Runden-Navigation */}
      <div className="mb-3 flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" uppercase={false} onClick={() => aktionen.prevRound()}>
          ◀
        </Button>
        <div className="flex flex-1 flex-wrap justify-center gap-1.5">
          {state.rounds.map((r) => {
            const isCur = r.round === state.round;
            const mark = r.juryWinner === 'A' ? ECKEN_FARBE.A : r.juryWinner === 'B' ? ECKEN_FARBE.B : r.juryWinner === 'tie' ? UNENTSCHIEDEN_FARBE : null;
            return (
              <button
                key={r.round}
                type="button"
                aria-current={isCur ? 'true' : undefined}
                onClick={() => aktionen.gotoRound(r.round)}
                className={
                  'h-8 w-8 rounded-[var(--radius-md)] text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] ' +
                  (isCur ? 'border-2 border-[var(--tally-selected)]' : 'border border-[var(--border)]')
                }
                style={{ background: mark ? farbeMischen(mark, 20) : 'transparent' }}
                title={r.juryWinner ? `Runde ${r.round}: ${r.juryWinner}` : `Runde ${r.round}`}
              >
                {r.round}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-1 text-center text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">Jury — Runde {state.round}</div>
      <div className="flex gap-2">
        {juryBtn('A', total.A.name || 'A', ECKEN_FARBE.A)}
        {juryBtn('tie', 'Unentschieden', UNENTSCHIEDEN_FARBE)}
        {juryBtn('B', total.B.name || 'B', ECKEN_FARBE.B)}
      </div>

      {/* Voting-Balken */}
      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
          <span>Publikum — Runde {state.round}</span>
          {/* Ohne Rückfrage, wie bisher (E16). */}
          <Button type="button" variant="ghost" size="sm" uppercase={false} className="text-[var(--muted-foreground)]" onClick={() => aktionen.clearVotes(state.round)}>
            zurücksetzen
          </Button>
        </div>
        <div className="flex items-center gap-2 text-sm tabular">
          <span style={{ color: ECKEN_FARBE.A }} className="w-10 text-right font-semibold">
            {cur?.votesA ?? 0}
          </span>
          <div className="flex h-3 flex-1 overflow-hidden rounded-full bg-[var(--muted)]">
            <div style={{ width: `${pctA}%`, background: ECKEN_FARBE.A }} className="h-full transition-[width]" />
            <div style={{ width: `${100 - pctA}%`, background: ECKEN_FARBE.B }} className="h-full transition-[width]" />
          </div>
          <span style={{ color: ECKEN_FARBE.B }} className="w-10 font-semibold">
            {cur?.votesB ?? 0}
          </span>
        </div>
      </div>
    </Card>
  );
}
