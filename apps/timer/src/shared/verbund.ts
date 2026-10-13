/**
 * Verbund-Anzeige über die Preload-Brücke (Master-Link Teil 2b, Release 2, Spec 16.4/16.5).
 * Strukturgleich mit `VerbundAnzeige` aus `@jm/app-runtime`; eigener Typ, damit die Renderer-
 * Typprüfung (tsconfig.web.json) app-runtime mit seinen Electron-Typen nicht einliest (E28).
 */
export interface VerbundAnzeigeZeile {
  text: string;
  farbe: 'gruen' | 'gelb' | 'rot' | 'gedaempft';
}
