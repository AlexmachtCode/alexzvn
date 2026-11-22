// Vertrag der Preload-Bruecke. Liegt in shared, damit Preload und Renderer denselben Typ
// benutzen — das Muster des Media Converters (@shared/types).
/**
 * Master-Link-Zustand für die Statusleiste (Spec 3.9). Spiegel von MasterLinkMeldung aus @jm/app-runtime, das im Renderer
 * nicht importierbar ist (Main-Code). Den Gleichlauf prüft die Typprüfung des Preloads.
 */
export type MasterLinkMeldungZeile =
  | { art: 'aus' }
  | { art: 'sucht' }
  | { art: 'verbindet'; adresse: string }
  | { art: 'verbunden'; adresse: string; seit: number; masterName: string; suite: string }
  | { art: 'fehler'; code: string; text: string; errCode?: string }
  | { art: 'ohne-client' };

export interface JmInterpreterApi {
  platform: string;
  /**
   * Oeffnet die Bezugsquelle des empfohlenen virtuellen Kabels im Standardbrowser.
   * Nimmt bewusst KEINE URL entgegen: ein Kanal, der beliebige Adressen an
   * shell.openExternal durchreicht, waere eine offene Tuer aus dem Renderer heraus.
   */
  openCableDownload: () => Promise<void>;
  /** Master-Link-Zustand (Spec 3.9): Meldung oder null (Brücke fehlt oder lehnt ab → „unbekannt“). */
  masterLink: () => Promise<MasterLinkMeldungZeile | null>;
  onMasterLink: (cb: (m: MasterLinkMeldungZeile) => void) => () => void;
}
