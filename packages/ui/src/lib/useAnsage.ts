// Ansage der geführten Anleitungen (P5; Spec 6): spielt die Audiodatei eines Textes, stoppt beim Wechsel und meldet Fehler
// (G7: jede Diagnose wird angezeigt). Audio nur im Effekt (Render-Tests laufen ohne DOM); den Körper des Effekts rechnet
// starteAnsage, rein und mit Attrappe getestet. Lautstärke folgt dem System; die App entscheidet über `spielen`.
import { useEffect, useState } from 'react';

export type AnsageFehler = 'fehlt' | 'abspielen';

/** Was starteAnsage vom Abspieler braucht (HTMLAudioElement passt). */
export interface Abspieler {
  play(): Promise<void>;
  pause(): void;
}

/**
 * Körper des Effekts: ohne `spielen` oder ohne Ansage-ID nichts; ohne Datei → 'fehlt'; sonst abspielen, ein Wurf oder ein
 * abgelehntes play() → 'abspielen'. Rückgabe: stoppen; danach meldet die Ansage nichts mehr. Nur aus dieser Datei exportiert.
 */
export function starteAnsage(
  url: string | null,
  id: string | null,
  spielen: boolean,
  erzeuge: (url: string) => Abspieler,
  melde: (fehler: AnsageFehler) => void,
): () => void {
  if (!spielen || id === null) return () => undefined;
  if (url === null) {
    melde('fehlt');
    return () => undefined;
  }
  let aktiv = true;
  let ton: Abspieler;
  try {
    ton = erzeuge(url);
    ton.play().catch(() => {
      if (aktiv) melde('abspielen');
    });
  } catch {
    melde('abspielen');
    return () => undefined;
  }
  return () => {
    aktiv = false;
    ton.pause();
  };
}

/** Angezeigter Fehler: nur für die aktuelle Ansage und nur, solange gespielt werden soll. Nur aus dieser Datei exportiert. */
export function ansageFehlerFuer(stand: { id: string; fehler: AnsageFehler } | null, id: string | null, spielen: boolean): AnsageFehler | null {
  return spielen && stand !== null && stand.id === id ? stand.fehler : null;
}

/** Spielt die Ansage `id` aus `url`, solange `spielen` gilt; Wechsel von url, id oder spielen stoppt die alte. */
export function useAnsage(url: string | null, id: string | null, spielen: boolean): AnsageFehler | null {
  const [stand, setStand] = useState<{ id: string; fehler: AnsageFehler } | null>(null);
  useEffect(() => {
    if (id === null || typeof Audio === 'undefined') return undefined;
    return starteAnsage(url, id, spielen, (u) => new Audio(u), (fehler) => setStand({ id, fehler }));
  }, [url, id, spielen]);
  return ansageFehlerFuer(stand, id, spielen);
}
