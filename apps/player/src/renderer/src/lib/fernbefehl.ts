// Altfehler PL-16a: Nummer eines Fernbefehls `cue` oder `standby` prüfen. Rein; der Store zeigt den Hinweis in der
// Hinweisleiste und schickt die Log-Zeile an den Hauptprozess. Protokoll und Companion-Modul bleiben unverändert.

import { PLAYER_TEXTE } from '@/lib/oberflaeche';

export type FernNummerErgebnis = { ok: true } | { ok: false; hinweis: string; log: string };

/** Gültig ist 1 bis `anzahl` (Zahl der Cues der Show). */
export function pruefeFernNummer(verb: 'CUE' | 'STANDBY', n: number, anzahl: number): FernNummerErgebnis {
  if (n >= 1 && n <= anzahl) return { ok: true };
  return {
    ok: false,
    hinweis: PLAYER_TEXTE.fernbefehlAbgelehnt(verb, n, anzahl),
    log: `Fernbefehl abgelehnt: ${verb} ${n} (Show hat ${anzahl} Cues)`,
  };
}
