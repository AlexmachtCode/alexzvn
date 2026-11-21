// Lesende Brücken des Timers für useBrueckenWert (UX Welle 1, Timer b; Spec 3.8, 3.9): die Master-Link-Meldung
// (`jmps:master-link`), die Meldung des Steuerservers (`timer:fernsteuerung`) und die V-Zeile aus Master-Link 2b R2
// (`jmps:verbund-anzeige`, schon im Preload). Modulweite Konstanten, damit der Hook eine stabile Quelle bekommt.
// window.jm wird nur in den Funktionskörpern gelesen und nur hinter typeof window: Render-Tests und Server-Render laufen
// ohne window, dort würfe schon `window?.` einen ReferenceError. Fehlt der Preload (Browser: Speaker, Remote) oder eine
// seiner Methoden, antwortet die Abfrage null und das Ereignis meldet nie.
import type { BrueckenQuelle } from '@jm/ui';
import type { FernsteuerungMeldung } from '@shared/fernsteuerung';
import type { MasterLinkMeldungZeile, VerbundAnzeigeZeile } from '@shared/verbund';

type JmBruecke = NonNullable<Window['jm']>;

/** Die Preload-Brücke, wenn es sie gibt; ohne window (Node, Test) oder ohne Preload undefined. */
function preload(): Partial<JmBruecke> | undefined {
  return typeof window === 'undefined' ? undefined : window.jm;
}

/** Master-Link-Meldung (Spec 3.9): Abfrage beim Einhängen, danach jedes Ereignis. */
export const MASTER_LINK_QUELLE: BrueckenQuelle<MasterLinkMeldungZeile> = {
  abfrage: () => preload()?.masterLink?.() ?? Promise.resolve(null),
  ereignis: (cb) => preload()?.onMasterLink?.(cb) ?? (() => {}),
};

/** Meldung des Steuerservers (Port 8724): null, solange Main noch nichts gemeldet hat (Statusleiste: unbekannt). */
export const FERNSTEUERUNG_QUELLE: BrueckenQuelle<FernsteuerungMeldung> = {
  abfrage: () => preload()?.fernsteuerung?.() ?? Promise.resolve(null),
  ereignis: (cb) => preload()?.onFernsteuerung?.(cb) ?? (() => {}),
};

/** V-Zeile „Show vom Master: … · Stand …“ (Master-Link 2b R2) für die Kopfzeile Mitte. */
export const VERBUND_QUELLE: BrueckenQuelle<VerbundAnzeigeZeile> = {
  abfrage: () => preload()?.verbundAnzeige?.() ?? Promise.resolve(null),
  ereignis: (cb) => preload()?.onVerbundAnzeige?.(cb) ?? (() => {}),
};
