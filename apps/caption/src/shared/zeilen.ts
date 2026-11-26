// Korrektur einer Zeile des Verlaufs (Altfehler CA-5): rein und ohne electron, damit der Main (caption:correctLine) und der Test
// dieselbe Regel nutzen. Die Kennung der Zeile vergibt der Main beim Eintrag (src/main/index.ts, onText).
import type { CaptionLine } from './types';

/**
 * Ersetzt den Text der Zeile mit dieser Kennung, die übrigen Zeilen bleiben; die übergebene Liste bleibt unverändert. Gibt es die
 * Kennung nicht (mehr), etwa nach „Leeren“ oder wenn die Zeile aus den letzten 40 gefallen ist: null, dann ändert sich nichts.
 */
export function korrigiereZeile(lines: CaptionLine[], id: string, text: string): CaptionLine[] | null {
  const i = lines.findIndex((l) => l.id === id);
  if (i < 0) return null;
  return lines.map((l, j) => (j === i ? { ...l, text } : l));
}
