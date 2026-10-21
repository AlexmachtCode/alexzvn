// Hook der geführten Anleitungen (P4, EP11): misst das Ziel einer Sprechblase alle `taktMs` und bei jeder Größenänderung
// des Fensters über findeZiel. Ohne Kennung: null. window und document nur im Effekt; das Aufräumen beendet Takt und Abo.
// Das Rechteck gilt nur zusammen mit seiner Kennung (zielStand, G7): Bis zur ersten Messung einer Kennung (erster Render,
// Schrittwechsel, Render-Tests ohne DOM) ist das Ziel 'ungemessen' — weder Hervorhebung noch „Ziel fehlt“. Im Browser misst
// ein Layout-Effekt vor dem Malen (Muster SettingsPanel), ohne DOM ein normaler Effekt (React warnt sonst beim Rendern).
import { useEffect, useLayoutEffect, useState } from 'react';
import { findeZiel, neueMessung, zielStand, type ZielMessung, type ZielStand } from './anleitung-dom';

const useMessEffekt = typeof document !== 'undefined' ? useLayoutEffect : useEffect;

export function useAnleitungsZiel(kennung: string | null, taktMs = 250): ZielStand {
  const [messung, setMessung] = useState<ZielMessung | null>(null);
  useMessEffekt(() => {
    if (kennung === null || typeof window === 'undefined') {
      setMessung(null);
      return undefined;
    }
    const messen = (): void => {
      const neu = findeZiel(document, kennung, { breite: window.innerWidth, hoehe: window.innerHeight });
      setMessung((alt) => neueMessung(alt, { kennung, rechteck: neu }));
    };
    messen();
    const takt = window.setInterval(messen, taktMs);
    window.addEventListener('resize', messen);
    return () => {
      window.clearInterval(takt);
      window.removeEventListener('resize', messen);
    };
  }, [kennung, taktMs]);
  return zielStand(messung, kennung);
}
