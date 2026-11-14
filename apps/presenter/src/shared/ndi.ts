// NDI-Ausgang (#303): Konstanten und Nachrichten zwischen Main und Utility-Prozess. Nur Typen und Zahlen.

/** Quellname; das NDI-SDK hängt den Rechnernamen an. */
export const NDI_NAME = 'JM Presenter';
export const NDI_BREITE = 1920;
export const NDI_HOEHE = 1080;
export const NDI_FPS = 25;
/** Sendetakt in Millisekunden (1000 / NDI_FPS). */
export const NDI_TAKT_MS = 40;
/** Größe eines BGRA-Vollbilds in Bytes. */
export const NDI_BILD_BYTES = 1920 * 1080 * 4;

/** Main → Utility-Prozess. */
export type AnSender = { type: 'init' } | { type: 'bild'; buffer: ArrayBuffer } | { type: 'stop' };

/** Utility-Prozess → Main. */
export type VomSender =
  | { type: 'bereit' }
  | { type: 'fehler'; grund: string }
  | { type: 'stat'; empfaenger: number };
