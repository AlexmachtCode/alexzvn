// Rückfrage an „Meeting verlassen“ (Slot-Spec 7.5 Nr. 5/6, T80; Altfehler CN-MV, Stufe 2): Mit laufenden Slots macht der erste Klick
// aus „Meeting verlassen“ auf derselben Taste die Rückfrage „Ja, verlassen (n Slots laufen)“ (Tastenplatz: die Taste bleibt an ihrem
// Platz, Plan UX Welle 2b :77-78, W79). Bis Stufe 2 nahm die Rückfrage sofort einen Klick an, ein Doppelklick verließ also das
// Meeting. Jetzt nimmt sie erst nach VERLASSEN_SPERRE_MS einen Klick an (P6); in der Sperrzeit ist die Taste aria-disabled, Platz,
// Text und Tastaturfokus bleiben, der Klick wird verworfen (D9). Ohne laufende Slots verlässt ein Klick sofort wie bisher, auch wenn
// die Slots während der Sperre auf 0 fallen (Review Focus 5, G19). Rein: kein window, keine Uhr; die Zeit kommt als Zahl (in
// ZoomCard die monotone Uhr performance.now()). Nicht in @shared/zoom-text (dort wächst seit der Erhebung nur ohneVorsatz).

/** Sperrzeit der Rückfrage in ms: über der Doppelklickzeit von Windows (einstellbar bis etwa 900 ms, nicht gemessen). */
export const VERLASSEN_SPERRE_MS = 1000;

/** Was ein Klick auf die Taste tut: verlassen, die Rückfrage stellen oder (in der Sperrzeit) nichts. */
export type VerlassenSchritt = 'verlassen' | 'fragen' | 'warten';

/** Ist die Rückfrage gestellt und ihre Sperrzeit noch nicht um? `frageSeit` = Zeitpunkt der Rückfrage, null = keine. */
export function verlassenGesperrt(frageSeit: number | null, jetzt: number): boolean {
  return frageSeit !== null && jetzt - frageSeit < VERLASSEN_SPERRE_MS;
}

/**
 * Der Schritt eines Klicks bei n laufenden Slots: ohne laufende Slots verlassen (wie bisher, auch nach einer Rückfrage); ohne
 * Rückfrage fragen; in der Sperrzeit warten; danach verlassen.
 */
export function verlassenSchritt(n: number, frageSeit: number | null, jetzt: number): VerlassenSchritt {
  if (!(n > 0)) return 'verlassen';
  if (frageSeit === null) return 'fragen';
  return verlassenGesperrt(frageSeit, jetzt) ? 'warten' : 'verlassen';
}

/**
 * Hooklose Verdrahtung der Taste (Muster slotWahl): der Klick-Handler zum Stand eines Renders. „fragen“ merkt den Zeitpunkt,
 * „verlassen“ löscht die Rückfrage und verlässt, „warten“ verwirft den Klick.
 */
export function verlassenBedienung(b: {
  n: number;
  frageSeit: number | null;
  setzeFrageSeit: (t: number | null) => void;
  jetzt: () => number;
  verlasse: () => void;
}): () => void {
  return () => {
    const t = b.jetzt();
    const schritt = verlassenSchritt(b.n, b.frageSeit, t);
    if (schritt === 'fragen') {
      b.setzeFrageSeit(t);
    } else if (schritt === 'verlassen') {
      b.setzeFrageSeit(null);
      b.verlasse();
    }
  };
}
