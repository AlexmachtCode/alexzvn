import { useEffect } from 'react';
import { PlayerOberflaeche } from '@/views/PlayerOberflaeche';
import { usePlayer } from '@/store/player';

export function App(): React.JSX.Element {
  const load = usePlayer((s) => s.load);

  useEffect(() => {
    void load();
  }, [load]);

  return <PlayerOberflaeche />;
}
