// Lesende Brücken von Q&A für useBrueckenWert (UX Welle 1, Spec 3.8, 3.9): die Master-Link-Meldung (`jmps:master-link`)
// und die Meldung des Steuerservers (`qa:fernsteuerung`). Modulweite Konstanten, damit der Hook eine stabile Quelle
// bekommt. window.jmqa wird nur in den Funktionskörpern gelesen und nur hinter typeof window: Render-Tests und
// Server-Render laufen ohne window, dort würfe schon `window?.` einen ReferenceError. Fehlt der Preload oder eine
// seiner Methoden, antwortet die Abfrage null und das Ereignis meldet nie (G7).
import type { BrueckenQuelle } from '@jm/ui';
import type { FernsteuerungMeldung } from '@shared/fernsteuerung';
import type { JmQaApi, MasterLinkMeldungZeile } from '@shared/types';

/** Die Preload-Brücke, wenn es sie gibt; ohne window (Node, Test) oder ohne Preload undefined. */
function preload(): Partial<JmQaApi> | undefined {
  return typeof window === 'undefined' ? undefined : window.jmqa;
}

/** Master-Link-Meldung (Spec 3.9): Abfrage beim Einhängen, danach jedes Ereignis. */
export const MASTER_LINK_QUELLE: BrueckenQuelle<MasterLinkMeldungZeile> = {
  abfrage: () => preload()?.masterLink?.() ?? Promise.resolve(null),
  ereignis: (cb) => preload()?.onMasterLink?.(cb) ?? (() => {}),
};

/** Meldung des Steuerservers (Port 8733): null, solange der Main noch nichts gemeldet hat. */
export const FERNSTEUERUNG_QUELLE: BrueckenQuelle<FernsteuerungMeldung | null> = {
  abfrage: () => preload()?.fernsteuerung?.() ?? Promise.resolve(null),
  ereignis: (cb) => preload()?.onFernsteuerung?.(cb) ?? (() => {}),
};
