// Schließen des Verbund-Modals (Endprüfung C7) als reine Funktion — keine Laufzeit-Importe (strip-types-Selbsttest).

export interface SchliessAufrufe {
  schliesseKopplung: () => Promise<unknown>;
  brecheKoppelnAb: () => Promise<unknown>;
  stoppeMasterSuche: () => Promise<unknown>;
}

/**
 * Spec 3.2/3.3: Dialog zu → Kopplungsfenster am Master zu, laufendes Koppeln abbrechen, Suche aus. IMMER alle drei
 * anstoßen: der gespeicherte Stand kann veraltet sein (Schließen vor der Antwort von „Rechner koppeln“ ließe das Fenster
 * sonst 2 min offen; am Slave ist schliesseKopplung ein No-op). Eine Ablehnung sähe im geschlossenen Modal niemand:
 * sie geht an `warne`, nie still verloren.
 */
export function beimSchliessen(api: SchliessAufrufe, warne: (e: unknown) => void): void {
  for (const aufruf of [() => api.schliesseKopplung(), () => api.brecheKoppelnAb(), () => api.stoppeMasterSuche()]) {
    // async: auch ein synchroner Wurf (fehlende Brücke) landet in warne.
    void (async () => {
      try {
        await aufruf();
      } catch (e) {
        warne(e);
      }
    })();
  }
}
