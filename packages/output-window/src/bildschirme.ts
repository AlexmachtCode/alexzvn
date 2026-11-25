// Bildschirm-Ereignis (UX Welle 2b): angesteckt, abgezogen oder geändert. Rein und ohne Laufzeit-Abhängigkeit zur Shell, damit
// die Anmeldung ohne Electron testbar ist; `beobachteBildschirme` in index.ts reicht die echte Quelle (`screen`) herein.

/** Das, was `beobachte` von einer Bildschirm-Quelle braucht (Electrons `screen` passt). */
export interface BildschirmQuelle {
  on(e: string, h: () => void): void;
  removeListener(e: string, h: () => void): void;
}

const EREIGNISSE = ['display-added', 'display-removed', 'display-metrics-changed'] as const;

/**
 * Meldet sich für die drei Bildschirm-Ereignisse an und ruft `cb` je Ereignis genau einmal, ohne Nutzlast. Gibt die
 * Abmeldung zurück; sie entfernt alle drei Hörer.
 */
export function beobachte(quelle: BildschirmQuelle, cb: () => void): () => void {
  const hoerer = (): void => cb();
  for (const e of EREIGNISSE) quelle.on(e, hoerer);
  return () => {
    for (const e of EREIGNISSE) quelle.removeListener(e, hoerer);
  };
}
