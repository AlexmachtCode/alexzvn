// Vorschau einer Slot-Kachel (Spec 7.7, 10.8): welche Fläche die Kachel zeigt. Rein, ohne DOM und ohne Electron; die
// Kachel (SlotKachel, Plan B Task B21) malt nur, was vorschauFlaeche sagt. Texte T52–T57 wörtlich aus Spec 9.3 (E31).
import type { SlotSent } from '@jm/zoom-bridge/protocol';
import type { ZoomSlotZustand } from '../../../shared/types';

/** Spec 9.3: Texte der Vorschau. */
export const VORSCHAU_TEXT = {
  /** T52: Tooltip unter der Vorschau. */
  T52: 'Vorschau ohne Bild-Versatz, etwa 2 Bilder pro Sekunde.',
  /** T53: Kennzeichen bei `sent = freeze`. */
  T53: 'eingefroren',
  /** T54: Kennzeichen in SZ5. */
  T54: 'gehalten',
  /** T55: kein Sender. */
  T55: 'kein Bild',
  /** T55b: Slot zeigt Bild, Vorschau fehlt. */
  T55b: 'kein Vorschaubild',
  /** T56: Schalter „Vorschau“ aus. */
  T56: 'Vorschau aus',
  /** T57: `previewUnavailable`, an jeder Kachel. */
  T57: (detail: string): string => `Vorschau nicht verfügbar (${detail}). Bild und Ton laufen unverändert.`,
};

/**
 * Lage der Vorschau einer Kachel. `frisch`: das letzte Vorschaubild ist jünger als 1,5 s. `letzteDiesesZiels`: ein gemerktes
 * Vorschaubild des aktuellen Ziels besteht (ein `slot`-Ereignis mit anderem `target`, `share` oder `mode` verwirft es, 7.7).
 * `detail`: HRESULT aus `previewUnavailable` (A-EP2).
 */
export interface VorschauEingabe {
  zustand: ZoomSlotZustand; gesendet: SlotSent | null; schalterAn: boolean; verfuegbar: boolean;
  detail: string | null; frisch: boolean; letzteDiesesZiels: boolean;
}

/** Was die Kachel malt: das frische Bild, das letzte Bild dieses Ziels, leer, ein Ersatzbild oder die letzte Fläche abgeblendet. */
export type VorschauFlaeche = {
  art: 'bild' | 'letzte' | 'leer' | 'schachbrett' | 'schwarz' | 'weiss' | 'abgeblendet'; kennzeichen: string | null; text: string | null;
};

const flaeche = (art: VorschauFlaeche['art'], kennzeichen: string | null = null, text: string | null = null): VorschauFlaeche =>
  ({ art, kennzeichen, text });

/** SZ6: das Ersatzbild, das die Bridge sendet (`sent`, 6.12). */
function ersatzFlaeche(e: VorschauEingabe): VorschauFlaeche {
  switch (e.gesendet) {
    case 'transparent':
      return flaeche('schachbrett');
    case 'black':
      return flaeche('schwarz');
    case 'white':
      return flaeche('weiss');
    case 'freeze':
      // Die Kopie entsteht in der Bridge unabhängig von der Vorschau: nie ein Schachbrett (Restrunde RR4).
      return flaeche(e.letzteDiesesZiels ? 'letzte' : 'leer', VORSCHAU_TEXT.T53);
    case 'none':
    case 'held':
    case null:
      // Kommt nicht vor: In SZ6 sendet die Bridge immer eine Ersatzbild-Art (6.12). Die Fläche bleibt leer, ohne Behauptung.
      return flaeche('leer');
  }
}

/** Tabelle 7.7 wörtlich, erste passende Zeile gilt (Prädikate 10.8). */
export function vorschauFlaeche(e: VorschauEingabe): VorschauFlaeche {
  if (!e.schalterAn) return flaeche('leer', null, VORSCHAU_TEXT.T56);
  // Ohne `detail` (kommt nicht vor, die Bridge schickt das HRESULT mit) steht der Fehlerschlüssel.
  if (!e.verfuegbar) return flaeche('leer', null, VORSCHAU_TEXT.T57(e.detail ?? 'previewUnavailable'));
  switch (e.zustand) {
    case 'aus':
    case 'ohne_meeting':
    case 'wartet_erlaubnis':
    case 'startet':
    case 'keine_antwort':
    case 'gescheitert':
    case 'zurueckgestellt':
    case 'geplant':
      return flaeche('leer', null, VORSCHAU_TEXT.T55);
    case 'zeigt':
      // Freigabe, höchstens 2 s ohne neues Bild: Der Sender wiederholt ihr letztes Bild (6.9, Nachfix W1).
      if (e.gesendet === 'held') return e.letzteDiesesZiels ? flaeche('letzte') : flaeche('leer', null, VORSCHAU_TEXT.T55b);
      return e.frisch ? flaeche('bild') : flaeche('leer', null, VORSCHAU_TEXT.T55b);
    case 'gehalten':
      return flaeche(e.letzteDiesesZiels ? 'letzte' : 'leer', VORSCHAU_TEXT.T54);
    case 'ersatz':
      return ersatzFlaeche(e);
    case 'stoppt':
      return flaeche('abgeblendet');
  }
}
