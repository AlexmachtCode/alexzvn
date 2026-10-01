// Sprung-Aktionen über die Kennung (Master-Link Teil 2a, Spec 6.2).
//
// Ein `timer goto` mit `zielId` zielt auf einen Ablaufpunkt, nicht auf eine
// Nummer. Die Nummer wird erst beim Senden aus dem DANN aktuellen Ablauf
// errechnet — bei verzögerten Aktionen also erst nach Ablauf von `delayMs` (5.4).
// Rein: keine node-/electron-Importe, zwischen den shared-Modulen nur
// `import type` — der Selbsttest läuft mit `node --experimental-strip-types`.
import type { RundownAction } from './types';

/** Ergebnis der Auflösung: 1-basierte Nummer oder „Ziel entfallen“. */
export type SprungErgebnis = { n: number; gebunden: boolean } | { entfallen: true };

/**
 * Nummer, an die ein `timer goto` JETZT springen soll (6.2).
 *  - keine `zielId` oder eigene Timer-Liste → `{ n: args[0], gebunden: false }`;
 *    der Aufrufer sendet die Aktion dann unverändert wie heute
 *  - `zielId` steht in `ablaufSchluessel` → `{ n: Stelle + 1, gebunden: true }`
 *  - `zielId` fehlt, auch bei leerem Ablauf → `{ entfallen: true }`: nicht senden
 * `ablaufSchluessel` = Schlüssel des normalisierten `show.ablauf` in Reihenfolge,
 * also genau die Liste, die der Timer hat. Dieselbe Funktion nutzen `fireOne`
 * beim Senden, der Test-Knopf (`rundown:fireAction`), Chip und Vorschau.
 */
export function loeseSprungZiel(
  aktion: RundownAction,
  ablaufSchluessel: string[],
  eigeneTimerListe: boolean,
): SprungErgebnis {
  if (!aktion.zielId || eigeneTimerListe) return { n: Number(aktion.args[0]), gebunden: false };
  const stelle = ablaufSchluessel.indexOf(aktion.zielId);
  if (stelle < 0) return { entfallen: true };
  return { n: stelle + 1, gebunden: true };
}
