// Gemessener Zustand des Ausgabefensters. Rein und ohne Laufzeit-Abhängigkeit zur Shell:
// auch aus Renderer- und Testcode importierbar (`@jm/output-window/zustand`).

export type AusgabeArt = 'zu' | 'offen' | 'bildschirm-fehlt' | 'abgestuerzt';

export interface AusgabeZustand {
  art: AusgabeArt;
  /** Bildschirm, auf dem das Fenster liegt; `null`, solange es zu ist. */
  displayId: number | null;
}

export const AUSGABE_ZU: AusgabeZustand = { art: 'zu', displayId: null };

export type AusgabeEreignis =
  | { t: 'geoeffnet'; displayId: number; neu: boolean }
  | { t: 'geschlossen' }
  | { t: 'bildschirm-weg'; displayId: number }
  | { t: 'abgestuerzt' };

export function naechsterAusgabeZustand(z: AusgabeZustand, e: AusgabeEreignis): AusgabeZustand {
  switch (e.t) {
    case 'geoeffnet':
      // Ein Umzug lädt nicht neu: ein abgestürztes Fenster bleibt abgestürzt.
      if (!e.neu && z.art === 'abgestuerzt') return z;
      return { art: 'offen', displayId: e.displayId };
    case 'geschlossen':
      return AUSGABE_ZU;
    case 'bildschirm-weg':
      return z.art === 'offen' && z.displayId === e.displayId ? { art: 'bildschirm-fehlt', displayId: z.displayId } : z;
    case 'abgestuerzt':
      return z.art === 'zu' ? z : { art: 'abgestuerzt', displayId: z.displayId };
  }
}
