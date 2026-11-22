// Lesende Brücken des Players für useBrueckenWert (UX Welle 2a, Player b; Spec 3.8, 3.9): die Master-Link-Meldung
// (`jmps:master-link`), die Meldung des Steuerservers (`player:fernsteuerung`) und der gemessene Zustand der
// Videoausgabe (`output:zustand`). Modulweite Konstanten, damit der Hook eine stabile Quelle bekommt.
// window.jmplay wird nur in den Funktionskörpern gelesen und nur hinter typeof window: Render-Tests und Server-Render
// laufen ohne window. Fehlt der Preload oder eine seiner Methoden, antwortet die Abfrage null und das Ereignis meldet nie.
import type { BrueckenQuelle } from '@jm/ui';
import type { AusgabeZustand } from '@jm/output-window/zustand';
import type { FernsteuerungMeldung } from '@shared/fernsteuerung';
import type { JmplayApi, MasterLinkMeldungZeile } from '@shared/types';

/** Die Preload-Brücke, wenn es sie gibt; ohne window (Node, Test) oder ohne Preload undefined. */
function preload(): Partial<JmplayApi> | undefined {
  return typeof window === 'undefined' ? undefined : window.jmplay;
}

/** Master-Link-Meldung (Spec 3.9): Abfrage beim Einhängen, danach jedes Ereignis. */
export const MASTER_LINK_QUELLE: BrueckenQuelle<MasterLinkMeldungZeile> = {
  abfrage: () => preload()?.masterLink?.() ?? Promise.resolve(null),
  ereignis: (cb) => preload()?.onMasterLink?.(cb) ?? (() => {}),
};

/** Meldung des Steuerservers (Port 8725): null, solange Main noch nichts gemeldet hat (Statusleiste: unbekannt). */
export const FERNSTEUERUNG_QUELLE: BrueckenQuelle<FernsteuerungMeldung> = {
  abfrage: () => preload()?.fernsteuerung?.() ?? Promise.resolve(null),
  ereignis: (cb) => preload()?.onFernsteuerung?.(cb) ?? (() => {}),
};

/** Gemessener Zustand des Videoausgabe (W2-2): null, solange unbekannt. */
export const AUSGABE_QUELLE: BrueckenQuelle<AusgabeZustand> = {
  abfrage: () => preload()?.output?.zustand?.() ?? Promise.resolve(null),
  ereignis: (cb) => preload()?.output?.onZustand?.(cb) ?? (() => {}),
};
