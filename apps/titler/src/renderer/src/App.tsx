import { useEffect } from 'react';
import { OperatorView } from '@/views/OperatorView';
import { RecallBoard } from '@/views/RecallBoard';
import { useTitler } from '@/store/titler';

export function App(): React.JSX.Element {
  const load = useTitler((s) => s.load);
  useEffect(() => {
    void load();
  }, [load]);
  // Zweites Fenster (#152): view=recall → Recall-Button-Board statt Operator-UI.
  const view = new URLSearchParams(window.location.search).get('view');
  return view === 'recall' ? <RecallBoard /> : <OperatorView />;
}
