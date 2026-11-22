import { useEffect } from 'react';
import { useBattle } from '@/store/useBattle';
import { BattleOberflaeche, type BattleViewAktionen } from '@/views/BattleOberflaeche';

export function App(): React.JSX.Element {
  const store = useBattle();
  const { state, load } = store;

  useEffect(() => {
    void load();
  }, [load]);

  if (!state) {
    return <div className="grid h-full place-items-center text-[var(--muted-foreground)]">Lädt …</div>;
  }

  // Die Handler des Stores (Bedienlogik unverändert), als Rückrufe ohne Rückgabe für die Oberfläche.
  const aktionen: BattleViewAktionen = {
    setLive: (an) => void store.setLive(an),
    setVotingOpen: (offen) => void store.setVotingOpen(offen),
    nextRound: () => void store.nextRound(),
    clip: () => void store.clip(),
    setCompetitor: (side, patch) => void store.setCompetitor(side, patch),
    swapCompetitors: () => void store.swapCompetitors(),
    prevRound: () => void store.prevRound(),
    gotoRound: (runde) => void store.gotoRound(runde),
    setJuryWinner: (runde, winner) => void store.setJuryWinner(runde, winner),
    clearVotes: (runde) => void store.clearVotes(runde),
    setRemote: (an) => void store.setRemote(an),
    pickRecording: () => void store.pickRecording(),
    pickClipDir: () => void store.pickClipDir(),
    setConfig: (patch) => void store.setConfig(patch),
    setEndpoint: (role, host, port) => void store.setEndpoint(role, host, port),
    reset: () => void store.reset(),
  };

  return <BattleOberflaeche state={state} aktionen={aktionen} />;
}
