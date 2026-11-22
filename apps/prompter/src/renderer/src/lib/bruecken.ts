// Lesende Brücken des Prompters für useBrueckenWert (UX Welle 2a, Prompter b; Spec 3.8, 3.9): die Master-Link-Meldung
// (`jmps:master-link`), die Meldung des Steuerservers (`prompter:fernsteuerung`) und der gemessene Zustand des
// Talent-Monitors (`output:zustand`). Modulweite Konstanten, damit der Hook eine stabile Quelle bekommt.
// window.jmprompt wird nur in den Funktionskörpern gelesen und nur hinter typeof window: Render-Tests und Server-Render
// laufen ohne window. Fehlt der Preload oder eine seiner Methoden, antwortet die Abfrage null und das Ereignis meldet nie.
import type { BrueckenQuelle } from '@jm/ui';
import type { AusgabeZustand } from '@jm/output-window/zustand';
import type { FernsteuerungMeldung } from '@shared/fernsteuerung';
import type { JmpromptApi, MasterLinkMeldungZeile } from '@shared/types';

/** Die Preload-Brücke, wenn es sie gibt; ohne window (Node, Test) oder ohne Preload undefined. */
function preload(): Partial<JmpromptApi> | undefined {
  return typeof window === 'undefined' ? undefined : window.jmprompt;
}

/** Master-Link-Meldung (Spec 3.9): Abfrage beim Einhängen, danach jedes Ereignis. */
export const MASTER_LINK_QUELLE: BrueckenQuelle<MasterLinkMeldungZeile> = {
  abfrage: () => preload()?.masterLink?.() ?? Promise.resolve(null),
  ereignis: (cb) => preload()?.onMasterLink?.(cb) ?? (() => {}),
};

/** Meldung des Steuerservers (Port 8727): null, solange Main noch nichts gemeldet hat (Statusleiste: unbekannt). */
export const FERNSTEUERUNG_QUELLE: BrueckenQuelle<FernsteuerungMeldung> = {
  abfrage: () => preload()?.fernsteuerung?.() ?? Promise.resolve(null),
  ereignis: (cb) => preload()?.onFernsteuerung?.(cb) ?? (() => {}),
};

/** Gemessener Zustand des Talent-Monitors (W2-2): null, solange unbekannt. */
export const AUSGABE_QUELLE: BrueckenQuelle<AusgabeZustand> = {
  abfrage: () => preload()?.output?.zustand?.() ?? Promise.resolve(null),
  ereignis: (cb) => preload()?.output?.onZustand?.(cb) ?? (() => {}),
};
