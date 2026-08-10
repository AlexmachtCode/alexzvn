// Reine Normen-Logik der DeckLink-Ausgabe. BEWUSST ohne jede native Abhaengigkeit,
// damit der Selbsttest sie unter blossem Node laden kann — dieselbe Trennung wie
// @shared/output-quality im Switcher.
//
// Das Addon BESCHREIBT nur, was die Karte kann; das Urteil faellt hier.

/** Eine Ausgabe-Norm, so wie die Karte sie meldet. */
export interface DisplayMode {
  /** BMD-Kennung als Vierzeichenkuerzel, z. B. 'Hp25'. Damit wird geoeffnet. */
  mode: string;
  /** Name, wie die Karte ihn liefert, z. B. '1080p25'. */
  name: string;
  width: number;
  height: number;
  /** Bildrate als Bruch: fps = fpsN / fpsD. 1080p25 meldet 25000/1000. */
  fpsN: number;
  fpsD: number;
  /** Echtes Halbbild (unteres oder oberes Feld zuerst). */
  interlaced: boolean;
  /** Progressive Segmented Frame — weder echtes Halbbild noch schlichtes Vollbild. */
  segmented: boolean;
  /** Kann diese Karte diese Norm mit BGRA ausgeben? */
  supportsBGRA: boolean;
}

/** Aufloesungen, die der Switcher komponieren kann (Spiegel von RESOLUTIONS dort). */
export const COMPOSABLE: ReadonlyArray<{ w: number; h: number }> = [
  { w: 1280, h: 720 },
  { w: 1920, h: 1080 },
];

/** Bildraten, die der Switcher anbietet (Spiegel von OUTPUT_FPS_OPTIONS dort). */
export const OFFERED_FPS: readonly number[] = [25, 30, 50, 60];

/** Warum eine Norm nicht benutzbar ist. Wird angezeigt, nie verschwiegen. */
export type Unusable = 'interlaced' | 'segmented' | 'resolution' | 'framerate' | 'pixelformat';

export interface JudgedMode extends DisplayMode {
  usable: boolean;
  /** Nur gesetzt, wenn `usable` falsch ist. */
  reason?: Unusable;
}

/** Gerundete Bildrate der Norm. 30000/1001 ergibt 30. */
function roundedFps(m: DisplayMode): number {
  if (!m.fpsD) return 0;
  return Math.round(m.fpsN / m.fpsD);
}

/**
 * Jede Norm einstufen — und JEDE zurueckgeben. Unbenutzbare tragen einen Grund, damit
 * die Oberflaeche sie ausgegraut MIT Begruendung zeigen kann. Eine Liste, aus der etwas
 * kommentarlos fehlt, ist eine Anzeige, die luegt (Lehre aus switcher-v0.10.0).
 *
 * Reihenfolge der Gruende ist Absicht: die grundsaetzlichste Unvertraeglichkeit zuerst.
 */
export function judgeModes(modes: DisplayMode[]): JudgedMode[] {
  return modes.map((m) => {
    let reason: Unusable | undefined;
    if (m.interlaced) reason = 'interlaced';
    else if (m.segmented) reason = 'segmented';
    else if (!COMPOSABLE.some((c) => c.w === m.width && c.h === m.height)) reason = 'resolution';
    else if (!OFFERED_FPS.includes(roundedFps(m))) reason = 'framerate';
    else if (!m.supportsBGRA) reason = 'pixelformat';
    return reason ? { ...m, usable: false, reason } : { ...m, usable: true };
  });
}

/**
 * Norm → Switcher-Einstellungen. Nur fuer benutzbare Normen sinnvoll.
 *
 * Bruchraten werden gerundet und driften dadurch bewusst: 29,97p wird zu 30, der Switcher
 * taktet danach 0,1 % schneller als die Karte. Das ist keine Nachlaessigkeit, sondern die
 * Folge fehlender Synchronisation — sichtbar in den repeated/rejected-Zaehlern der Ausgabe.
 */
export function modeToProgramSettings(m: DisplayMode): { resolution: '720p' | '1080p'; fps: number } {
  return {
    resolution: m.width >= 1920 ? '1080p' : '720p',
    fps: roundedFps(m),
  };
}
