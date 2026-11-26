// Block-Wächter der Aufnahme (Altfehler RE-3, B1): Liefert ein Eingang, der kein Loopback ist, während einer Aufnahme 2 s lang keine Blöcke
// (Dante weg, USB-Interface gezogen), endet die Aufnahme wie bei einem Schreibfehler; es steht nie „REC“, während nichts geschrieben wird.
// Rein, ohne Electron und ohne Importe: main/recorder.ts ruft `bloeckeLage` in jedem Takt des Wächters (BLOECKE_TAKT_MS).
// Loopback-Eingänge haben ihren eigenen Stille-Wächter (main/stille.ts): Windows liefert dort in Stille keine Blöcke, das ist kein Fehler.

/** So lange ohne Block gilt der Eingang als weg. */
export const KEINE_BLOECKE_MS = 2000;
/** Takt des Wächters. */
export const BLOECKE_TAKT_MS = 250;

/**
 * Lage in einem Takt des Wächters:
 * - `stau`: der letzte Takt liegt mindestens KEINE_BLOECKE_MS zurück; die Ereignisschleife hing (etwa ein langsames writeSync), die Blöcke
 *   dieser Zeit liegen gepuffert und kommen gleich. Kein Geräteverlust; die Grundlinie beginnt neu.
 * - `fehlen`: seit dem letzten Block sind mindestens KEINE_BLOECKE_MS vergangen.
 * - sonst `ok`.
 */
export function bloeckeLage(l: { jetzt: number; letzterBlock: number; letzterTakt: number }): 'ok' | 'stau' | 'fehlen' {
  if (l.jetzt - l.letzterTakt >= KEINE_BLOECKE_MS) return 'stau';
  if (l.jetzt - l.letzterBlock >= KEINE_BLOECKE_MS) return 'fehlen';
  return 'ok';
}
