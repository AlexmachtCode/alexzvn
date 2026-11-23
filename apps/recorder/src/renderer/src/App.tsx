import { useEffect } from 'react';
import { useRec } from '@/store/recorder';
import { RecorderOberflaeche } from '@/views/RecorderOberflaeche';

export function App() {
  const init = useRec((s) => s.init);

  // Einziger Ort für init() (Funktionsliste Nr. 64, 111): verdrahtet Pegel, Zustand, Meldung, Fernbefehle und Show-Vorgaben.
  // Im Wurzelknoten, nie in einer Ansicht, die bei einem Wechsel abgebaut würde (N2a Risiko 1).
  useEffect(() => {
    void init();
  }, [init]);

  return <RecorderOberflaeche />;
}
