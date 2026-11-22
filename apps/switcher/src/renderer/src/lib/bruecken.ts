// Lesende Brücken des Switchers für useBrueckenWert (UX Welle 1, Aufgabe b; Spec 3.8, 3.9): die Master-Link-Meldung
// (`jmps:master-link`) und die Fernsteuerungs-Meldung aus dem erweiterten Kanal `control:status` (Ruling R1).
// Modulweite Konstanten, damit der Hook eine stabile Quelle bekommt. window.jmswitch wird nur in den Funktionskörpern
// gelesen und nur hinter typeof window: Render-Tests und Server-Render laufen ohne window, dort würfe schon `window?.`
// einen ReferenceError. Fehlt der Preload oder eine seiner Methoden, antwortet die Abfrage null und das Ereignis
// meldet nie.
import type { BrueckenQuelle } from '@jm/ui';
import { controlStatusZuMeldung, type FernsteuerungMeldung } from '@shared/fernsteuerung';
import type { ControlStatus, JmswitchApi, MasterLinkMeldungZeile } from '@shared/types';

/** Die Preload-Brücke, wenn es sie gibt; ohne window (Node, Test) oder ohne Preload undefined. */
function preload(): Partial<JmswitchApi> | undefined {
  return typeof window === 'undefined' ? undefined : window.jmswitch;
}

/** Master-Link-Meldung (Spec 3.9): Abfrage beim Einhängen, danach jedes Ereignis. */
export const MASTER_LINK_QUELLE: BrueckenQuelle<MasterLinkMeldungZeile> = {
  abfrage: () => preload()?.masterLink?.() ?? Promise.resolve(null),
  ereignis: (cb) => preload()?.onMasterLink?.(cb) ?? (() => {}),
};

/**
 * Noch nie gemeldet: Der Main antwortet dann mit dem Grundwert (nicht laufend, Port 0, nichts sonst). Jede echte Meldung
 * trägt einen Port über 0 (naechsteFernsteuerung), also ist das „unbekannt“ und nicht „aus“.
 */
function ohneMeldung(s: ControlStatus): boolean {
  return !s.running && s.port === 0 && s.clients === 0 && s.modus === undefined && s.fehler === undefined;
}

/** Fernsteuerungs-Meldung (Spec 3.9): Abfrage `control.getStatus`, Ereignis `control.onStatus`, beides als Meldung. */
export const FERNSTEUERUNG_QUELLE: BrueckenQuelle<FernsteuerungMeldung> = {
  abfrage: async () => {
    const s = await preload()?.control?.getStatus?.().catch(() => null);
    return s && !ohneMeldung(s) ? controlStatusZuMeldung(s) : null;
  },
  ereignis: (cb) => preload()?.control?.onStatus?.((s) => cb(controlStatusZuMeldung(s))) ?? (() => {}),
};
