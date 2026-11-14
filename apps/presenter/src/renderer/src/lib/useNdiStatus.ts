import { useCallback, useEffect, useState } from 'react';
import type { NdiStatus } from '@shared/types';
import { NDI_STATUS_AUS } from '../../../shared/ndi';

/** NDI-Status aus dem Main (Start per Abfrage, danach per Push) und der Schalter dazu. */
export function useNdiStatus(): { status: NdiStatus; setzeAn: (an: boolean) => void } {
  const [status, setStatus] = useState<NdiStatus>(NDI_STATUS_AUS);

  useEffect(() => {
    let aktiv = true;
    // Push zuerst abonnieren, damit zwischen Abfrage und Abo nichts verloren geht.
    const ab = window.jmpr.ndi.onStatus((s) => {
      if (aktiv) setStatus(s);
    });
    void window.jmpr.ndi.status().then((s) => {
      if (aktiv) setStatus(s);
    });
    return () => {
      aktiv = false;
      ab();
    };
  }, []);

  const setzeAn = useCallback((an: boolean) => {
    void window.jmpr.ndi.setzeAn(an).then(setStatus);
  }, []);

  return { status, setzeAn };
}
