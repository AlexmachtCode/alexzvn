// Lesende Brücke des Interpreters für useBrueckenWert (UX Welle 2a, Interpreter b; Spec 3.8, 3.9): die Master-Link-Meldung
// (`jmps:master-link`). Der Interpreter hat keinen Steuerserver, also keine Fernsteuerungs-Meldung. Modulweite Konstante,
// damit der Hook eine stabile Quelle bekommt. window.jminterpreter wird nur im Funktionskörper gelesen und nur hinter
// typeof window: Render-Tests und Server-Render laufen ohne window. Fehlt der Preload oder eine seiner Methoden, antwortet
// die Abfrage null und das Ereignis meldet nie.
import type { BrueckenQuelle } from '@jm/ui';
import type { JmInterpreterApi, MasterLinkMeldungZeile } from '@shared/api';

/** Die Preload-Brücke, wenn es sie gibt; ohne window (Node, Test) oder ohne Preload undefined. */
function preload(): Partial<JmInterpreterApi> | undefined {
  return typeof window === 'undefined' ? undefined : window.jminterpreter;
}

/** Master-Link-Meldung (Spec 3.9): Abfrage beim Einhängen, danach jedes Ereignis. */
export const MASTER_LINK_QUELLE: BrueckenQuelle<MasterLinkMeldungZeile> = {
  abfrage: () => preload()?.masterLink?.() ?? Promise.resolve(null),
  ereignis: (cb) => preload()?.onMasterLink?.(cb) ?? (() => {}),
};
