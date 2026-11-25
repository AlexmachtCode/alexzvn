// Altfehler PL-16a: Nummer eines Fernbefehls `cue` oder `standby` prüfen. Rein; der Store zeigt den Hinweis in der
// Hinweisleiste und schickt die Log-Zeile an den Hauptprozess. Protokoll und Companion-Modul bleiben unverändert.

export type FernNummerErgebnis = { ok: true } | { ok: false; hinweis: string; log: string };

/** Gültig ist 1 bis `anzahl` (Zahl der Cues der Show). */
export function pruefeFernNummer(verb: 'CUE' | 'STANDBY', n: number, anzahl: number): FernNummerErgebnis {
  if (n >= 1 && n <= anzahl) return { ok: true };
  const cues = anzahl === 0 ? 'keine Cues' : anzahl === 1 ? '1 Cue' : `${anzahl} Cues`;
  return {
    ok: false,
    hinweis: `Companion „${verb} ${n}“ abgelehnt: Die Show hat ${cues}.`,
    log: `Fernbefehl abgelehnt: ${verb} ${n} (Show hat ${anzahl} Cues)`,
  };
}
