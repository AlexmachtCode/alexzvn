import { useEffect } from 'react';
import { OperatorView } from '@/views/OperatorView';
import { RecallBoard } from '@/views/RecallBoard';
import { OutputView } from '@/views/OutputView';
import { useTitler } from '@/store/titler';

export function App(): React.JSX.Element {
  const load = useTitler((s) => s.load);
  useEffect(() => {
    void load();
  }, [load]);
  // Weitere Fenster laden denselben Renderer mit ?view=:
  //  · view=recall → Recall-Button-Board (#152)
  //  · view=output → 2. Bildschirm, CG auf Chroma-Green (#161)
  const view = new URLSearchParams(window.location.search).get('view');
  if (view === 'recall') return <RecallBoard />;
  if (view === 'output') return <OutputView />;
  return <OperatorView />;
}
