// Lesende Brücken des Presenters für useBrueckenWert (UX Welle 2b, Presenter b; Spec 3.8, 3.9, B2): die Master-Link-Meldung
// (`jmps:master-link`) und die Meldung des Steuerservers (`presenter:fernsteuerung`). Modulweite Konstanten, damit der Hook
// eine stabile Quelle bekommt. Das Bildschirm-Ereignis (`present:bildschirme`) ist keine Quelle mit Wert; es steht als
// `window.jmpr.present.onBildschirme` im Preload.
// window.jmpr wird nur in den Funktionskörpern gelesen und nur hinter typeof window: Render-Tests und Server-Render
// laufen ohne window. Fehlt der Preload oder eine seiner Methoden, antwortet die Abfrage null und das Ereignis meldet nie.
import type { BrueckenQuelle } from '@jm/ui';
import type { FernsteuerungMeldung } from '@shared/fernsteuerung';
import type { JmprApi, MasterLinkMeldungZeile } from '@shared/types';

/** Die Preload-Brücke, wenn es sie gibt; ohne window (Node, Test) oder ohne Preload undefined. */
function preload(): Partial<JmprApi> | undefined {
  return typeof window === 'undefined' ? undefined : window.jmpr;
}

/** Master-Link-Meldung (Spec 3.9): Abfrage beim Einhängen, danach jedes Ereignis. */
export const MASTER_LINK_QUELLE: BrueckenQuelle<MasterLinkMeldungZeile> = {
  abfrage: () => preload()?.masterLink?.() ?? Promise.resolve(null),
  ereignis: (cb) => preload()?.onMasterLink?.(cb) ?? (() => {}),
};

/** Meldung des Steuerservers (Port 8728): null, solange Main noch nichts gemeldet hat (Statusleiste: unbekannt). */
export const FERNSTEUERUNG_QUELLE: BrueckenQuelle<FernsteuerungMeldung> = {
  abfrage: () => preload()?.fernsteuerung?.() ?? Promise.resolve(null),
  ereignis: (cb) => preload()?.onFernsteuerung?.(cb) ?? (() => {}),
};
