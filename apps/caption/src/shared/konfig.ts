// Grenzen der Zahlenfelder (Altfehler CA-8, C1): rein und ohne electron, damit das Panel (NumberInput, R/views/Einstellungen.tsx) und
// der Main (loadConfig, caption:setConfig) dieselben Zahlen haben. Das Feld zieht nicht auf die Grenzen: Ein ungültiger Wert zeigt dort
// den Fehlertext aus @jm/ui und wirkt nicht (wie im Recorder, E13). Der Main zieht jeden Wert aus der Datei und vom IPC auf die Grenzen;
// eine Schrift unter dem Mindestwert gibt es so nirgends.
import type { CaptionConfig } from './types';

export const CAPTION_GRENZEN = {
  ndiFontSize: { min: 16, max: 160 },
  maxUtteranceSec: { min: 2, max: 15 },
} as const;

type GrenzSchluessel = keyof typeof CAPTION_GRENZEN;
const GRENZ_SCHLUESSEL = Object.keys(CAPTION_GRENZEN) as GrenzSchluessel[];

/**
 * Prüft einen Teil der Konfiguration (aus caption.config.json oder vom IPC) und gibt einen neuen zurück; der übergebene bleibt
 * unverändert. Für Schrift und Max. Äußerung: Was keine endliche Zahl ist, fällt weg (der alte Wert bzw. die Vorgabe bleibt), eine Zahl
 * außerhalb wird auf die Grenze gezogen. Alle anderen Schlüssel bleiben, wie sie sind.
 */
export function pruefeKonfig(patch: Partial<CaptionConfig>): Partial<CaptionConfig> {
  const aus: Partial<CaptionConfig> = { ...patch };
  for (const schluessel of GRENZ_SCHLUESSEL) {
    if (!(schluessel in aus)) continue;
    const wert: unknown = aus[schluessel];
    if (typeof wert !== 'number' || !Number.isFinite(wert)) {
      delete aus[schluessel];
      continue;
    }
    const { min, max } = CAPTION_GRENZEN[schluessel];
    aus[schluessel] = Math.min(max, Math.max(min, wert));
  }
  return aus;
}
