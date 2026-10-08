// Reiner STATE-Bau des Presenters für das Suite-Steuerprotokoll — ohne Electron,
// damit er im Selbsttest (test/suite-state.test.ts) läuft.
import type { SuiteState } from '@jm/suite-control-protocol';
import type { PresentationState } from '@shared/types';

/**
 * key=value-Paare für `STATE ns=presenter …` aus dem Präsentationszustand.
 *
 * `live` gilt nur, solange eine Präsentation läuft (#228): Der Leerlauf-Zustand
 * steht ebenfalls auf screen='live', und der Launcher zeigt bei live=1 „ON AIR“.
 */
export function presenterStateKv(s: PresentationState): SuiteState['kv'] {
  return {
    slide: s.total > 0 ? s.index + 1 : 0, // 1-basiert (0 = keine Präsentation)
    total: s.total,
    active: s.active,
    live: s.active && s.screen === 'live',
    black: s.screen === 'black',
    white: s.screen === 'white',
  };
}
