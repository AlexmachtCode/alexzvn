import { useId } from 'react';
import { Button, Card } from '@jm/ui';
import type { BattleState, Competitor, Side } from '@shared/types';
import { juryWins, voteTotals } from '@shared/scoring';
import { ECKEN_FARBE } from '@/lib/oberflaeche';

// Namensfelder ohne eigenen Rahmen; der Fokusring bleibt (focus-visible), der Grund wird bei Fokus dunkler.
const FELD =
  'w-full rounded bg-transparent px-1 text-center outline-none focus:bg-[var(--muted)] ' +
  'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)]';
const NAME = `${FELD} text-2xl font-bold text-[var(--foreground)]`;
const CREW = `${FELD} text-sm text-[var(--muted-foreground)]`;

/** Was die Ecken auslösen: die Handler des Stores, als Rückrufe ohne Rückgabe. Die Namensfelder schreiben bei jedem Tastendruck. */
export interface EckenAktionen {
  setCompetitor(side: Side, patch: Partial<Competitor>): void;
  swapCompetitors(): void;
}

/**
 * Eine Ecke (editierbar) mit Rundensiegen und Stimmen. Eigene Komponente auf Modulebene: Früher entstand sie bei jedem Rendern neu
 * (eine Komponente innerhalb der Komponente), das Feld verlor mit jedem Tastendruck den Fokus.
 */
function Ecke({ side, state, aktionen }: { side: Side; state: BattleState; aktionen: EckenAktionen }): React.JSX.Element {
  const kopfId = useId();
  const c = state.competitors[side];
  const farbe = ECKEN_FARBE[side];
  const wins = juryWins(state.rounds)[side];
  const stimmen = voteTotals(state.rounds)[side];
  return (
    <Card glossy={false} className="min-w-0 flex-1 p-4" style={{ borderTopColor: farbe, borderTopWidth: 3 }}>
      <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
        <span id={kopfId}>Ecke {side}</span>
        <span className="tabular">{stimmen} Stimmen</span>
      </div>
      <input
        className={NAME}
        aria-labelledby={kopfId}
        value={c.name}
        onChange={(e) => aktionen.setCompetitor(side, { name: e.target.value })}
        spellCheck={false}
      />
      <input
        className={CREW}
        aria-labelledby={kopfId}
        value={c.crew}
        placeholder="Crew / Stadt"
        onChange={(e) => aktionen.setCompetitor(side, { crew: e.target.value })}
        spellCheck={false}
      />
      <div className="mt-2 text-center text-4xl font-black tabular" style={{ color: farbe }}>
        {wins}
      </div>
      <div className="text-center text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">Rundensiege</div>
    </Card>
  );
}

/** Kontrahenten A/B (editierbar) + Live-Gesamtstand (Jury-Rundensiege, Stimmen). */
export function Competitors({ state, aktionen }: { state: BattleState; aktionen: EckenAktionen }): React.JSX.Element {
  return (
    <div data-ba="ecken" className="flex items-stretch gap-3">
      <Ecke side="A" state={state} aktionen={aktionen} />
      <div className="flex flex-col items-center justify-center gap-2">
        <span className="text-lg font-black text-[var(--muted-foreground)]">VS</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          uppercase={false}
          title="Ecken tauschen"
          aria-label="Ecken tauschen"
          onClick={() => aktionen.swapCompetitors()}
        >
          ⇄
        </Button>
      </div>
      <Ecke side="B" state={state} aktionen={aktionen} />
    </div>
  );
}
