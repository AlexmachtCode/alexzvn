// #303: Die Entscheidungen des Publikumsbilds, gemeinsam für Bildschirm (AudienceView) und NDI-Ausgang.
// Rein: ohne DOM, ohne Electron. So zeigen beide Wege zu jedem Zeitpunkt dasselbe Bild.
import type { PresentationState, Slide, Wiedergabe } from './types';
import { uebergangFuer } from './wiedergabe';

/** Was das Publikumsbild grundsätzlich zeigt. */
export type BildArt = 'leer' | 'schwarz' | 'weiss' | 'folie';

/** Was beim Wechsel der aktuellen Folie mit dem Schichtenstapel geschieht. */
export type Auflegen =
  | { art: 'leeren' }
  | { art: 'bleibt' }
  | { art: 'neu'; slide: Slide; blendeMs: number };

/** Beim schnellen Weiterklicken höchstens zwei alte Schichten halten. */
export const MAX_ALTE_SCHICHTEN = 2;

/** Die Folie nach Index, wie sie die Publikumsansicht heute wählt (auch gestoppt, ohne `active` zu beachten). */
export function aktuelleFolie(state: PresentationState, slides: readonly Slide[] | null): Slide | null {
  return slides?.[state.index] ?? null;
}

/** Pause Schwarz/Weiß deckt alles; ohne Folie oder gestoppt bleibt das Bild leer. */
export function bildArt(state: PresentationState, folie: Slide | null): BildArt {
  if (!state.active) return 'leer';
  if (state.screen === 'black') return 'schwarz';
  if (state.screen === 'white') return 'weiss';
  return folie ? 'folie' : 'leer';
}

/**
 * Neue Folie oben auflegen. Der Übergang gehört zur hereinkommenden Folie (wie in PowerPoint);
 * die allererste Folie (nichts oben) kommt ohne Übergang.
 */
export function naechsteSchicht(obenId: string | null, folie: Slide | null, w: Wiedergabe): Auflegen {
  if (!folie) return { art: 'leeren' };
  if (obenId === folie.id) return { art: 'bleibt' };
  const u = uebergangFuer(folie, w);
  return { art: 'neu', slide: folie, blendeMs: obenId !== null && u.art === 'blende' ? u.dauerMs : 0 };
}
