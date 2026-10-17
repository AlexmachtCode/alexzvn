// Lesende Brücken des Titlers für useBrueckenWert (UX-Pilot C9; Spec 3.8, 3.9; E5): die Master-Link-Meldung
// (`jmps:master-link`) und die V-Zeile aus Master-Link 2b R2 (`jmps:verbund-anzeige`). Modulweite Konstanten, damit der
// Hook eine stabile Quelle bekommt. window.jmtitler wird nur in den Funktionskörpern gelesen und nur hinter typeof window:
// Render-Tests und Server-Render laufen ohne window, dort würfe schon `window?.` einen ReferenceError. Fehlt der Preload
// oder eine seiner Methoden, antwortet die Abfrage null und das Ereignis meldet nie (G7).
import type { BrueckenQuelle } from '@jm/ui';
import type { JmtitlerApi, MasterLinkMeldungZeile, VerbundAnzeigeZeile } from '@shared/types';

/** Die Preload-Brücke, wenn es sie gibt; ohne window (Node, Test) oder ohne Preload undefined. */
function preload(): Partial<JmtitlerApi> | undefined {
  return typeof window === 'undefined' ? undefined : window.jmtitler;
}

/** Master-Link-Meldung (Spec 3.9): Abfrage beim Einhängen, danach jedes Ereignis. */
export const MASTER_LINK_QUELLE: BrueckenQuelle<MasterLinkMeldungZeile> = {
  abfrage: () => preload()?.masterLink?.() ?? Promise.resolve(null),
  ereignis: (cb) => preload()?.onMasterLink?.(cb) ?? (() => {}),
};

/** V-Zeile „Show vom Master: … · Stand …“ (Master-Link 2b R2) für die Kopfzeile Mitte. */
export const VERBUND_QUELLE: BrueckenQuelle<VerbundAnzeigeZeile> = {
  abfrage: () => preload()?.verbundAnzeige?.() ?? Promise.resolve(null),
  ereignis: (cb) => preload()?.onVerbundAnzeige?.(cb) ?? (() => {}),
};
