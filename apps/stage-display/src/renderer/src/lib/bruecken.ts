// Lesende Brücken des Stage-Displays für useBrueckenWert (UX Welle 2a, Stage-Display b; Spec 3.8, 3.9): die Master-Link-Meldung
// (`jmps:master-link`) und der gemessene Zustand des Bühnenschirms (`output:zustand`). Der Stage-Display hat keinen
// Steuerserver, also keine Fernsteuerungs-Meldung. Modulweite Konstanten, damit der Hook eine stabile Quelle bekommt.
// window.jmstage wird nur in den Funktionskörpern gelesen und nur hinter typeof window: Render-Tests und Server-Render
// laufen ohne window. Fehlt der Preload oder eine seiner Methoden, antwortet die Abfrage null und das Ereignis meldet nie.
import type { BrueckenQuelle } from '@jm/ui';
import type { AusgabeZustand } from '@jm/output-window/zustand';
import type { JmstageApi, MasterLinkMeldungZeile } from '@shared/types';

/** Die Preload-Brücke, wenn es sie gibt; ohne window (Node, Test) oder ohne Preload undefined. */
function preload(): Partial<JmstageApi> | undefined {
  return typeof window === 'undefined' ? undefined : window.jmstage;
}

/** Master-Link-Meldung (Spec 3.9): Abfrage beim Einhängen, danach jedes Ereignis. */
export const MASTER_LINK_QUELLE: BrueckenQuelle<MasterLinkMeldungZeile> = {
  abfrage: () => preload()?.masterLink?.() ?? Promise.resolve(null),
  ereignis: (cb) => preload()?.onMasterLink?.(cb) ?? (() => {}),
};

/** Gemessener Zustand des Bühnenschirms (W2-2): null, solange unbekannt. */
export const AUSGABE_QUELLE: BrueckenQuelle<AusgabeZustand> = {
  abfrage: () => preload()?.output?.zustand?.() ?? Promise.resolve(null),
  ereignis: (cb) => preload()?.output?.onZustand?.(cb) ?? (() => {}),
};
