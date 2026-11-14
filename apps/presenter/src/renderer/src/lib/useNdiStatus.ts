import { useCallback, useEffect, useState } from 'react';
import type { NdiStatus } from '@shared/types';
import { NDI_STATUS_AUS } from '../../../shared/ndi';

/** NDI-Status aus dem Main (Start per Abfrage, danach per Push) und der Schalter dazu. */
export function useNdiStatus(): { status: NdiStatus; setzeAn: (an: boolean) => void } {
  const [status, setStatus] = useState<NdiStatus>(NDI_STATUS_AUS);

  useEffect(() => {
    let aktiv = true;
    let pushDa = false;
    // Push zuerst abonnieren, damit zwischen Abfrage und Abo nichts verloren geht.
    const ab = window.jmpr.ndi.onStatus((s) => {
      pushDa = true;
      if (aktiv) setStatus(s);
    });
    // Kam schon ein Push, ist die Antwort der Abfrage nicht neuer – sie überschriebe den jüngeren Stand.
    void window.jmpr.ndi.status().then((s) => {
      if (aktiv && !pushDa) setStatus(s);
    });
    return () => {
      aktiv = false;
      ab();
    };
  }, []);

  const setzeAn = useCallback((an: boolean) => {
    // Scheitert der Aufruf, bleibt der zuletzt bestätigte Stand stehen.
    window.jmpr.ndi.setzeAn(an).then(setStatus, (err: unknown) => {
      console.error('[ndi] Schalter nicht gesetzt:', err);
    });
  }, []);

  return { status, setzeAn };
}
