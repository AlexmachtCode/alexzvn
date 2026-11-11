import { useEffect, useState } from 'react';
import type { PresentationState, Slide, Wiedergabe } from '@shared/types';
import { normiereWiedergabe } from '../../../shared/wiedergabe';
import { clearAssets, putImage, putSource } from './assets';
import { clearPdfCaches } from './pdf';

const EMPTY: PresentationState = { active: false, index: 0, total: 0, screen: 'live' };

/**
 * Used by the presenter + audience windows. Pulls the payload handed over by the
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
      if (payload) {
        clearPdfCaches();
        clearAssets();
        for (const [id, s] of Object.entries(payload.sources)) putSource(id, s.kind, s.bytes);
        for (const [id, b] of Object.entries(payload.images)) putImage(id, b);
        setSlides(payload.slides);
        setWiedergabe(normiereWiedergabe(payload.wiedergabe));
      }
      setState(await window.jmpr.present.getState());
      off = window.jmpr.present.onState(setState);
    })();
    return () => off();
  }, []);

  return { slides, state, wiedergabe };
}

/** Wire keyboard + USB-clicker navigation to the main-process presentation hub. */
export function usePresenterKeys(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent): void => {
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case 'PageDown':
        case ' ':
        case 'Enter':
          e.preventDefault();
          void window.jmpr.present.next();
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
        case 'Backspace':
          e.preventDefault();
          void window.jmpr.present.prev();
          break;
        case 'Home':
          e.preventDefault();
          void window.jmpr.present.goto(0);
          break;
        case 'End':
          e.preventDefault();
          void window.jmpr.present.goto(9999);
          break;
        // PowerPoint-style pause screens: B = black, W = white (toggle).
        case 'b':
        case 'B':
        case '.':
          e.preventDefault();
          void window.jmpr.present.setScreen('black');
          break;
        case 'w':
        case 'W':
        case ',':
          e.preventDefault();
          void window.jmpr.present.setScreen('white');
          break;
        case 'Escape':
          e.preventDefault();
          void window.jmpr.present.stop();
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
