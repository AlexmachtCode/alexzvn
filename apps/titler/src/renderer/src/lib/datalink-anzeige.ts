// Reine Anzeige-Helfer für „Daten / Recall“ und das Recall-Board (Master-Link Teil 2b,
// Spec 7.4 und 7.8). Nur `import type`: der Titler-Selbsttest (tsx) lädt das Modul ohne
// Renderer, React oder Alias-Auflösung.
import type { TitlerStatus } from '@shared/types';

/**
 * Zähler über der Liste: „Einträge · 2/5“ mit aktivem Eintrag, sonst „Einträge · 5“ — auch
 * bei einem gehaltenen Eintrag, der nicht als Stelle erscheint (Spec 7.8).
 */
export function zaehlerText(activeEntry: number, anzahl: number): string {
  return activeEntry >= 0 && activeEntry < anzahl ? `Einträge · ${activeEntry + 1}/${anzahl}` : `Einträge · ${anzahl}`;
}

/**
 * Sperre für Zurück/Weiter: nur an den Rändern. Ohne aktiven Eintrag (auch bei einem
 * gehaltenen) sind beide frei, denn beide wählen dann Eintrag 1 (Spec 7.4).
 */
export function navGesperrt(activeEntry: number, anzahl: number): { zurueck: boolean; weiter: boolean } {
  if (anzahl <= 0) return { zurueck: true, weiter: true };
  if (activeEntry < 0) return { zurueck: false, weiter: false };
  return { zurueck: activeEntry <= 0, weiter: activeEntry >= anzahl - 1 };
}

/** Hinweis oben im Board: nur H1, H5 und H6 (Spec 7.8), sonst `null`. */
export function boardHinweis(h: TitlerStatus['hinweis']): string | null {
  if (!h) return null;
  return h.art === 'H1' || h.art === 'H5' || h.art === 'H6' ? h.text : null;
}

/** Karte B1 über den Einträgen im Board, nur bei einem gehaltenen Eintrag (Spec 7.8). */
export function b1Text(g: TitlerStatus['gehalten']): string | null {
  return g ? `Auf Sendung, nicht in der Liste: ${g.label}` : null;
}
