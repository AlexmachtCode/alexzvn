import { useEffect } from 'react';
import { StageOberflaeche } from '@/views/StageOberflaeche';
import { useStage } from '@/store/stage';

export function App() {
  const load = useStage((s) => s.load);
  useEffect(() => {
    void load();
  }, [load]);
  return <StageOberflaeche />;
}
