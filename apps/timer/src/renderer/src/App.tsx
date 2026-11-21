import { useEffect, useState } from 'react';
import { connect, resolveServerUrl } from '@/sync/client';
import { useStore } from '@/store/timer';
import { OperatorView } from '@/views/Operator';
import { SpeakerView } from '@/views/Speaker';

type View = 'operator' | 'speaker' | 'remote';

function detectView(): View {
  const v = new URLSearchParams(window.location.search).get('view');
  if (v === 'speaker') return 'speaker';
  if (v === 'remote') return 'remote';
  return 'operator';
}

export function App() {
  const applyServerState = useStore((s) => s.applyServerState);
  const setConnected = useStore((s) => s.setConnected);
  // Der Store startet mit connected=false: Erst das erste Socket-Ereignis (verbunden oder getrennt) macht daraus eine Aussage;
  // bis dahin zeigt die Statusleiste „unbekannt“ (Spec 7.2).
  const [verbindungBekannt, setVerbindungBekannt] = useState(false);

  useEffect(() => {
    connect(resolveServerUrl(), applyServerState, (c) => {
      setConnected(c);
      setVerbindungBekannt(true);
    });
  }, [applyServerState, setConnected]);

  const view = detectView();
  if (view === 'speaker' || view === 'remote') return <SpeakerView />;
  return <OperatorView verbindungBekannt={verbindungBekannt} />;
}
