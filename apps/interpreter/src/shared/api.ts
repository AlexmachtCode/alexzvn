// Vertrag der Preload-Bruecke. Liegt in shared, damit Preload und Renderer denselben Typ
// benutzen — das Muster des Media Converters (@shared/types).
export interface JmInterpreterApi {
  platform: string;
  /**
   * Oeffnet die Bezugsquelle des empfohlenen virtuellen Kabels im Standardbrowser.
   * Nimmt bewusst KEINE URL entgegen: ein Kanal, der beliebige Adressen an
   * shell.openExternal durchreicht, waere eine offene Tuer aus dem Renderer heraus.
   */
  openCableDownload: () => Promise<void>;
}
