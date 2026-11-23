// Lesende Brücken von Studio-Control für useBrueckenWert (UX Welle 2b, Studio-Control b; Spec 3.8, 3.9): die Master-Link-
// Meldung (`jmps:master-link`) und die Meldung des Steuerservers (`studio:fernsteuerung`, Port 8735). Modulweite Konstanten,
// damit der Hook eine stabile Quelle bekommt.
// window.jms wird nur in den Funktionskörpern gelesen und nur hinter typeof window: Render-Tests und Server-Render laufen
// ohne window. Fehlt der Preload (Browser-Client am Socket-Server) oder eine seiner Methoden, antwortet die Abfrage null und
// das Ereignis meldet nie.
import type { BrueckenQuelle } from '@jm/ui';
import type { FernsteuerungMeldung } from '@shared/fernsteuerung';
import type { MasterLinkMeldungZeile } from '@/sync/jms';

/** Die Preload-Brücke, wenn es sie gibt; ohne window (Node, Test) oder ohne Preload undefined. */
function preload(): Partial<NonNullable<Window['jms']>> | undefined {
  return typeof window === 'undefined' ? undefined : window.jms;
}

/** Läuft die Oberfläche im Electron-Fenster (Preload da) oder als Browser-Client (W2-V4: dort fehlen Master-Link und Fernsteuerung)? */
export function umgebung(): 'electron' | 'browser' {
  return preload()?.isElectron === true ? 'electron' : 'browser';
}

/** Master-Link-Meldung (Spec 3.9): Abfrage beim Einhängen, danach jedes Ereignis. */
export const MASTER_LINK_QUELLE: BrueckenQuelle<MasterLinkMeldungZeile> = {
  abfrage: () => preload()?.masterLink?.() ?? Promise.resolve(null),
  ereignis: (cb) => preload()?.onMasterLink?.(cb) ?? (() => {}),
};

/** Meldung des Steuerservers (Port 8735): null, solange Main noch nichts gemeldet hat (Statusleiste: unbekannt). */
export const FERNSTEUERUNG_QUELLE: BrueckenQuelle<FernsteuerungMeldung> = {
  abfrage: () => preload()?.fernsteuerung?.() ?? Promise.resolve(null),
  ereignis: (cb) => preload()?.onFernsteuerung?.(cb) ?? (() => {}),
};
