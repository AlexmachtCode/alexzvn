// Hook der geführten Anleitungen (P4, EP11): misst das Ziel einer Sprechblase alle `taktMs` und bei jeder Größenänderung
// des Fensters über findeZiel. Ohne Kennung oder ohne window: null. window und document nur im Effekt (Render-Tests laufen
// ohne DOM, der erste Wert ist null); das Aufräumen beendet Takt und Abo.
import { useEffect, useState } from 'react';
import { findeZiel, gleichesRechteck, type Rechteck } from './anleitung-dom';

export function useAnleitungsZiel(kennung: string | null, taktMs = 250): Rechteck | null {
  const [rechteck, setRechteck] = useState<Rechteck | null>(null);
  useEffect(() => {
    if (kennung === null || typeof window === 'undefined') {
      setRechteck(null);
      return undefined;
    }
    const messen = (): void => {
      const neu = findeZiel(document, kennung, { breite: window.innerWidth, hoehe: window.innerHeight });
      setRechteck((alt) => (gleichesRechteck(alt, neu) ? alt : neu));
    };
    messen();
    const takt = window.setInterval(messen, taktMs);
    window.addEventListener('resize', messen);
    return () => {
      window.clearInterval(takt);
      window.removeEventListener('resize', messen);
    };
  }, [kennung, taktMs]);
  return rechteck;
}
