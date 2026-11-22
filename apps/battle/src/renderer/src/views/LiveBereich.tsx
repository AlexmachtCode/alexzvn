// Live-Bereich von Battle (UX Welle 1, Aufgabe d; Spec 3.4, 5.1, Anhang A „Battle“; E8, E16, R10, R16): oben die Ecken A/B (immer
// sichtbar) und darunter die vier Haupttasten als TallyButtons (VS, Voting, Nächste Runde, Replay); darunter scrollt der Rest: links
// Scoreboard und Ergebnis, rechts die Karten Publikums-Voting (QR) und Instant-Replay (Quelle, Länge, Clips; bei weniger als 640 px
// Breite unter dem Scoreboard). Zustände der Tasten kommen aus hauptTasten und tastenBeschriftung (lib/oberflaeche.ts), die Handler
// sind die des Stores. Unter dem VS-Knopf steht der Hinweis, wenn der Titler fehlt (E16); der Knopf bleibt bedienbar.
//
// Platz (R16, Rechnung in lib/oberflaeche.ts): bei 980 × 660 mit Panel bleiben dem Inhalt 980 − 16 − 361 = 603 px, nach dem
// Innenabstand 571 px: Die Tasten stehen 2×2 (ab 756 px in einer Reihe, nie 3+1), die rechte Spalte unter dem Scoreboard. Die obere
// Zone ist shrink-0, der untere Bereich scrollt selbst (min-h-0): Nichts überlappt die Haupttasten.
import { TallyButton, type TallyButtonProps } from '@jm/ui';
import { ClipPanel, type ClipAktionen } from '@/components/ClipPanel';
import { Competitors, type EckenAktionen } from '@/components/Competitors';
import { RemotePanel, type RemoteAktionen } from '@/components/RemotePanel';
import { Scoreboard, type ScoreboardAktionen } from '@/components/Scoreboard';
import { hauptTasten, tastenBeschriftung, vsHinweis, type OberflaechenStand } from '@/lib/oberflaeche';
import { decided, overallWinner } from '@shared/scoring';
import type { BattleState } from '@shared/types';

/** Was die Haupttasten auslösen: die Handler `setLive(!live)`, `setVotingOpen(!votingOpen)`, `nextRound()` und `clip()` des Stores. */
export interface TastenAktionen {
  setLive(an: boolean): void;
  setVotingOpen(offen: boolean): void;
  nextRound(): void;
  clip(): void;
}

/** Alles, was der Live-Bereich auslöst. */
export interface LiveAktionen extends TastenAktionen, EckenAktionen, ScoreboardAktionen, RemoteAktionen, ClipAktionen {}

// Container-Query statt Viewport: tastenSpalten(breite) beschreibt das Raster. Die Klassen stehen als Literal da (Tailwind-Scan);
// 756 = TASTEN_VIER_BREITE; gemessen wird die Inhaltsbox hinter dem Innenabstand.
const RASTER = 'grid w-full grid-cols-2 gap-3 @[756px]:grid-cols-4';

export type TastenRolle = 'vs' | 'voting' | 'naechste' | 'replay';

/** Die vier Haupttasten mit ihrer Rolle in Anzeigereihenfolge (VS, Voting, Nächste Runde, Replay). Die Rolle ist der React-key: Die Beschriftung wechselt, der Knopf bleibt (R10). */
function rollenTasten(s: Pick<OberflaechenStand, 'state'>, a: TastenAktionen): Array<[TastenRolle, TallyButtonProps]> {
  const t = hauptTasten(s);
  const b = tastenBeschriftung(s);
  return [
    ['vs', { ...t.vs, label: b.vs, onClick: () => a.setLive(!s.state.live) }],
    ['voting', { ...t.voting, onClick: () => a.setVotingOpen(!s.state.votingOpen) }],
    ['naechste', { ...t.naechste, label: b.naechste, onClick: a.nextRound }],
    ['replay', { ...t.replay, label: b.replay, onClick: a.clip }],
  ];
}

const KEINE: TastenAktionen = { setLive() {}, setVotingOpen() {}, nextRound() {}, clip() {} };

/** Die Rollen der Tasten in Anzeigereihenfolge, aus derselben Quelle wie das, was HauptTasten rendert. */
export function tastenSchluessel(s: Pick<OberflaechenStand, 'state'>): TastenRolle[] {
  return rollenTasten(s, KEINE).map(([rolle]) => rolle);
}

/** Die Haupttasten als Props in Anzeigereihenfolge. Ohne DOM prüfbar. */
export function liveTasten(s: Pick<OberflaechenStand, 'state'>, a: TastenAktionen): TallyButtonProps[] {
  return rollenTasten(s, a).map(([, taste]) => taste);
}

export function HauptTasten({ stand, aktionen }: { stand: Pick<OberflaechenStand, 'state'>; aktionen: TastenAktionen }): React.JSX.Element {
  const hinweis = vsHinweis(stand);
  return (
    <div data-ba="haupttasten" className="@container w-full">
      <div className={RASTER}>
        {rollenTasten(stand, aktionen).map(([rolle, taste]) => (
          <div key={rolle}>
            <TallyButton {...taste} />
            {rolle === 'vs' && hinweis ? (
              <p data-ba="vs-hinweis" className="mt-1 text-[11px] text-[var(--muted-foreground)]">
                <span aria-hidden="true" className="text-[var(--status-warn)]">
                  ▲
                </span>{' '}
                {hinweis}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Ergebnis-Karte: erscheint, sobald alle Runden entschieden sind (decided). */
function Ergebnis({ state }: { state: BattleState }): React.JSX.Element | null {
  if (!decided(state.rounds)) return null;
  const winner = overallWinner(state.rounds);
  const winnerName = winner === 'tie' ? 'Unentschieden' : state.competitors[winner].name;
  return (
    <div data-ba="ergebnis" className="rounded-[var(--radius-xl)] border border-[var(--tally-selected)] bg-[var(--highlight)] p-4 text-center">
      <div className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">Ergebnis</div>
      <div className="text-2xl font-black text-[var(--foreground)]">{winner === 'tie' ? '🤝 Unentschieden' : `🏆 ${winnerName}`}</div>
    </div>
  );
}

export function LiveBereich({ state, aktionen }: { state: BattleState; aktionen: LiveAktionen }): React.JSX.Element {
  return (
    <div data-ba="live" className="flex h-full min-h-0 flex-col">
      <div data-ba="oben" className="shrink-0 space-y-3 p-4 pb-3">
        <Competitors state={state} aktionen={aktionen} />
        <HauptTasten stand={{ state }} aktionen={aktionen} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div data-ba="unten" className="@container px-4 pb-4">
          <div className="grid grid-cols-1 gap-4 @[640px]:grid-cols-[minmax(0,1fr)_256px]">
            <div data-ba="spalte-links" className="min-w-0 space-y-3">
              <Scoreboard state={state} aktionen={aktionen} />
              <Ergebnis state={state} />
            </div>
            <div data-ba="spalte-rechts" className="min-w-0 space-y-3">
              <RemotePanel state={state} aktionen={aktionen} />
              <ClipPanel state={state} aktionen={aktionen} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
