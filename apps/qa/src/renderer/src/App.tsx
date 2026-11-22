import { useEffect } from 'react';
import { useQa } from '@/store/useQa';
import { QaOberflaeche, type QaViewAktionen } from '@/views/QaOberflaeche';

export function App(): React.JSX.Element {
  const { state, load, next, endActive, setRemote, setEndpoint, setConfig, setCloudConfig, setProxyKey, cloudGenerateEvent } = useQa();

  useEffect(() => {
    void load();
  }, [load]);

  if (!state) {
    return <div className="grid h-full place-items-center text-[var(--muted-foreground)]">Lädt …</div>;
  }

  // Die Handler des Stores (Bedienlogik unverändert), als Rückrufe ohne Rückgabe für die Oberfläche.
  const aktionen: QaViewAktionen = {
    next: () => void next(),
    endActive: () => void endActive(),
    setRemote: (an) => void setRemote(an),
    setEndpoint: (role, host, port) => void setEndpoint(role, host, port),
    setConfig: (patch) => void setConfig(patch),
    setCloudConfig: (patch) => void setCloudConfig(patch),
    setProxyKey: (key) => void setProxyKey(key),
    cloudGenerateEvent: () => void cloudGenerateEvent(),
  };

  return <QaOberflaeche state={state} aktionen={aktionen} />;
}
