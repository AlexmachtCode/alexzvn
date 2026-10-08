// Feste Werte der Zoom-Anbindung (Spec 5.2, G3) an EINER Stelle. Rein (G8): kein Electron, keine node:-Module.
// kern.ts reicht alle Namen unverändert weiter; zoom.ts, index.ts, settings.ts und die Tests importieren sie darum
// weiter aus './zoom/kern'. klartext.ts leitet die Sekunden in B16, CT und CE hieraus ab (N4b.3 Nr. 8).

/** Spec 5.2. Für Tests einspeisbar (`fristen`); `abgleichMs` bleibt in den Fällen 14/14b bei 300. */
export const ZOOM_FRISTEN = {
  anmeldeMs: 30_000,
  joinTimeoutMs: 30_000,
  killTimeoutMs: 12_000,
  abgleichMs: 300,
  aboAntwortMs: 10_000,
  abbildTaktMs: 100,
  unsubscribeWarteMs: 2_000,
} as const;
export type ZoomFristen = { [K in keyof typeof ZOOM_FRISTEN]: number };

/** Wartezeit vor Wiederbeitritts-Versuch 1 bis 5 in Sekunden (Spec 6.4). Länge = WIEDERBEITRITT_VERSUCHE. */
export const WIEDERBEITRITT_PLAN_S: readonly number[] = [2, 5, 10, 20, 30];
export const BEENDEN_FRIST_MS = 15_000;
export const JWT_GUELTIG_S = 43_200;
export const AUFLOESUNG = '720p' as const;
export const HINWEISE_MAX = 5;
export const ANZEIGENAME_VORGABE = 'JM Connect';

/** Steht in shared/zoom-text.ts, damit die Karte sie ohne Main-Import nutzt (L16). */
export { BETRIEBSGROESSE } from '../../shared/zoom-text';
