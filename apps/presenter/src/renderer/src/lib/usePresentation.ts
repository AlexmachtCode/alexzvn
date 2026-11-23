import { useEffect, useState } from 'react';
import type { PresentationPayload, PresentationState, Slide, Wiedergabe } from '@shared/types';
import { normiereWiedergabe } from '../../../shared/wiedergabe';
import { clearAssets, putImage, putSource } from './assets';
import { verarbeiteTaste } from './oberflaeche';
import { clearPdfCaches } from './pdf';

const EMPTY: PresentationState = { active: false, index: 0, total: 0, screen: 'live' };

/** Legt die Bytes des Payloads in den Speicher dieses Fensters (Quellen und Bilder), nach dem Leeren der alten. */
function legeAb(payload: PresentationPayload): void {
  clearPdfCaches();
  clearAssets();
  for (const [id, s] of Object.entries(payload.sources)) putSource(id, s.kind, s.bytes);
  for (const [id, b] of Object.entries(payload.images)) putImage(id, b);
}

/**
 * Used by the audience window (der Referent nimmt seit UX Welle 2b d2 useFolien und useStand). Pulls the payload handed over by the
 * main process, registers its bytes into this window's asset registry, and keeps
 * the live state (current index) in sync via the broadcast channel.
 */
export function usePresentation(): { slides: Slide[] | null; state: PresentationState; wiedergabe: Wiedergabe } {
  const [slides, setSlides] = useState<Slide[] | null>(null);
  const [wiedergabe, setWiedergabe] = useState<Wiedergabe>(() => normiereWiedergabe(undefined));
  const [state, setState] = useState<PresentationState>(EMPTY);

  useEffect(() => {
    let off = (): void => undefined;
    void (async () => {
      const payload = await window.jmpr.present.getPayload();
      // Zustand VOR den Folien holen und beides im selben Schritt setzen: sonst zeigte die
      // Publikumsansicht kurz Folie 1 und blendete dann zur Startfolie über (#293, Review).
      const start = await window.jmpr.present.getState();
      if (payload) {
        legeAb(payload);
        setSlides(payload.slides);
        setWiedergabe(normiereWiedergabe(payload.wiedergabe));
      }
      setState(start);
      off = window.jmpr.present.onState(setState);
    })();
    return () => off();
  }, []);

  return { slides, state, wiedergabe };
}

/**
 * Referent (UX Welle 2b, d2): nur die Folien des Payloads, einmal beim Einhängen geholt und in den Speicher dieses Fensters
 * gelegt; null, bis sie da sind. Ohne Zustands-Abo: den Präsentationszustand liest der Referent aus seinem Stand (useStand).
 */
export function useFolien(): Slide[] | null {
  const [slides, setSlides] = useState<Slide[] | null>(null);
  useEffect(() => {
    let aktiv = true;
    void window.jmpr.present.getPayload().then((payload) => {
      if (!aktiv || !payload) return;
      legeAb(payload);
      setSlides(payload.slides);
    });
    return () => {
      aktiv = false;
    };
  }, []);
  return slides;
}

/**
 * Wire keyboard + USB-clicker navigation to the main-process presentation hub. Die Tasten und ihre Wirkung stehen in
 * verarbeiteTaste (lib/oberflaeche.ts, rein und ohne pdf.ts testbar); dort auch der Filter B10 für Textfelder.
 */
export function usePresenterKeys(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent): void => verarbeiteTaste(e, window.jmpr.present);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
