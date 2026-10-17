// Lesende Status-Brücke im Renderer (Suite-UX-Update, Spec 3.8, 3.9, 7.2; Plan E5). Eine Quelle hat eine Abfrage (eine
// Antwort) und ein Ereignis (jede Änderung). Die Antwort kann nach einem Ereignis ankommen, das später entstand; sie ist
// dann älter und wird verworfen. Kein window.jm*: Die App reicht die Quelle herein.

export interface BrueckenQuelle<T> {
  abfrage(): Promise<T | null>;
  ereignis(cb: (wert: T | null) => void): () => void;
}

export type BrueckenStand<T> = { art: 'offen' } | { art: 'da'; wert: T | null; durch: 'antwort' | 'ereignis' };

/** Ein Schritt: Ein Ereignis gilt immer; eine Antwort nur, solange noch kein Ereignis da ist (sonst bleibt der Stand). */
export function brueckenSchritt<T>(alt: BrueckenStand<T>, e: { art: 'antwort' | 'ereignis'; wert: T | null }): BrueckenStand<T> {
  if (e.art === 'antwort' && alt.art === 'da' && alt.durch === 'ereignis') return alt;
  return { art: 'da', wert: e.wert, durch: e.art };
}

/**
 * Kern des Effekts in useBrueckenWert: erst das Ereignis anmelden, dann abfragen (ein Ereignis zwischen Anfrage und
 * Antwort geht so nicht verloren). Gemeldet wird jeder Wert, der nach brueckenSchritt gilt, eine späte Antwort nach einem
 * Ereignis also nicht. Eine Ablehnung oder ein Wurf der Abfrage meldet null. Rückgabe: abmelden; danach meldet die Brücke
 * nichts mehr, und die Abmeldung der Quelle läuft genau einmal.
 */
export function verbindeBruecke<T>(quelle: BrueckenQuelle<T>, melde: (wert: T | null) => void): () => void {
  let aktiv = true;
  let stand: BrueckenStand<T> = { art: 'offen' };
  const schritt = (e: { art: 'antwort' | 'ereignis'; wert: T | null }): void => {
    if (!aktiv) return;
    const neu = brueckenSchritt(stand, e);
    if (neu === stand) return;
    stand = neu;
    melde(e.wert);
  };
  const ab = quelle.ereignis((wert) => schritt({ art: 'ereignis', wert }));
  let antwort: Promise<T | null>;
  try {
    antwort = Promise.resolve(quelle.abfrage());
  } catch {
    antwort = Promise.resolve(null);
  }
  antwort.then(
    (wert) => schritt({ art: 'antwort', wert }),
    () => schritt({ art: 'antwort', wert: null }),
  );
  return () => {
    if (!aktiv) return;
    aktiv = false;
    ab();
  };
}
