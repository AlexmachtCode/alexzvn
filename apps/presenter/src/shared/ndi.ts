// NDI-Ausgang (#303): Konstanten, Nachrichten zwischen Main und Utility-Prozess, Grundzustand des Schalters.
// Ohne Laufzeit-Importe – Main, Utility und Renderer laden diese Datei.
import type { NdiStatus } from './types';

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

/** Schalter aus – Vorgabe und Zustand nach dem Ausschalten. */
export const NDI_STATUS_AUS: NdiStatus = { an: false, lage: 'aus', empfaenger: 0, grund: null };

/** Beschriftung des NDI-Schalters (Werkzeugleiste und Referentenansicht). */
export function ndiSchalterText(s: NdiStatus): string {
  if (s.lage === 'nicht-verfuegbar') return 'NDI nicht verfügbar';
  if (s.lage === 'startet') return 'NDI startet …';
  if (s.lage === 'sendet') return `NDI ● an · ${s.empfaenger} Empfänger`;
  return 'NDI aus';
}

/** Kommt gerade ein Bild bei den NDI-Empfängern an? */
export function ndiLiefertBild(s: NdiStatus): boolean {
  return s.an && s.lage === 'sendet';
}
