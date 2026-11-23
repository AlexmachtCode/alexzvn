import { useEffect } from 'react';
import { istEingabeZiel } from '@/lib/oberflaeche';

/** Tastatursteuerung des Prompters (greift nicht, wenn ein Eingabefeld fokussiert ist). */
export function usePrompterHotkeys(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (istEingabeZiel(e.target)) return;
      const api = window.jmprompt;
      switch (e.key) {
        case ' ':
          e.preventDefault();
          void api.transport.toggle();
          break;
        case 'ArrowDown':
          e.preventDefault();
          void api.transport.nudge(e.shiftKey ? 3 : 1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          void api.transport.nudge(e.shiftKey ? -3 : -1);
          break;
        case 'Home':
          e.preventDefault();
          void api.transport.reset();
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
