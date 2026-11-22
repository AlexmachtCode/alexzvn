// Lesende Brücken der Caption für useBrueckenWert (UX Welle 2a, Caption b; Spec 3.8, 3.9): die Master-Link-Meldung
// (`jmps:master-link`) und die Meldung des Steuerservers (`caption:fernsteuerung`). Die Caption hat kein Ausgabefenster,
// also keine Quelle für `output:zustand`. Modulweite Konstanten, damit der Hook eine stabile Quelle bekommt.
// window.jmcaption wird nur in den Funktionskörpern gelesen und nur hinter typeof window: Render-Tests und Server-Render
// laufen ohne window. Fehlt der Preload oder eine seiner Methoden, antwortet die Abfrage null und das Ereignis meldet nie.
import type { BrueckenQuelle } from '@jm/ui';
import type { FernsteuerungMeldung } from '@shared/fernsteuerung';
import type { JmCaptionApi, MasterLinkMeldungZeile } from '@shared/types';

/** Die Preload-Brücke, wenn es sie gibt; ohne window (Node, Test) oder ohne Preload undefined. */
function preload(): Partial<JmCaptionApi> | undefined {
  return typeof window === 'undefined' ? undefined : window.jmcaption;
}

/** Master-Link-Meldung (Spec 3.9): Abfrage beim Einhängen, danach jedes Ereignis. */
export const MASTER_LINK_QUELLE: BrueckenQuelle<MasterLinkMeldungZeile> = {
  abfrage: () => preload()?.masterLink?.() ?? Promise.resolve(null),
  ereignis: (cb) => preload()?.onMasterLink?.(cb) ?? (() => {}),
};

/** Meldung des Steuerservers (Port 8732): null, solange Main noch nichts gemeldet hat (Statusleiste: unbekannt). */
export const FERNSTEUERUNG_QUELLE: BrueckenQuelle<FernsteuerungMeldung> = {
  abfrage: () => preload()?.fernsteuerung?.() ?? Promise.resolve(null),
  ereignis: (cb) => preload()?.onFernsteuerung?.(cb) ?? (() => {}),
};
