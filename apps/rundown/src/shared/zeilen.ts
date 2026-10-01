// Kleine reine Helfer rund um Zeilen und Sprung-Aktionen (Spec 4.4, 5.2, 6.2),
// die Main und Renderer gleich brauchen. Ohne Laufzeit-Importe (G2): die
// Auflösung des Sprungs (`loeseSprungZiel` aus sprung.ts) wird übergeben.
import type { SprungErgebnis } from './sprung';
import type { RundownAction, RundownRow } from './types';

/** Kontext einer iveo-Show (4.4): Side Event oder Programmliste. */
export function kontextIstIveo(kontext: string | undefined): boolean {
  return !!kontext && (kontext.startsWith('se:') || kontext.startsWith('liste:'));
}

/** Kennung der ersten nicht entfallenen Zeile, sonst null. */
export function ersteLebendeZeile(rows: RundownRow[]): string | null {
  return rows.find((r) => r.entfallen !== true)?.id ?? null;
}

/**
 * Schlüssel der lebenden Ablaufzeilen in Reihenfolge. Nach einem Abgleich ist
 * das genau die Schlüsselliste des Ablaufs (R1, R3). Der Main nutzt sie nur,
 * wenn die gemerkte Show beim Start nicht lesbar ist (5.2).
 */
export function ablaufSchluesselAusZeilen(rows: RundownRow[]): string[] {
  return rows.filter((r) => r.quelle === 'ablauf' && r.entfallen !== true).map((r) => r.id);
}

/** `timer goto` — die einzige Aktion mit Sprung-Ziel (6.2). */
export function istSprung(a: RundownAction): boolean {
  return a.role === 'timer' && a.verb === 'goto';
}

/**
 * Argumente, mit denen eine Aktion JETZT gesendet würde (6.2). Nur ein
 * gebundener `timer goto` bekommt die aufgelöste Nummer in `args[0]`; nicht
 * gebundene Aktionen gehen unverändert raus wie bisher. null = Ziel entfallen,
 * nichts senden. `loese` ist `(a) => loeseSprungZiel(a, ablaufSchluessel, eigeneTimerListe)`.
 */
export function sendeArgs(
  a: RundownAction,
  loese: (a: RundownAction) => SprungErgebnis,
): (string | number)[] | null {
  if (!istSprung(a)) return a.args;
  const z = loese(a);
  if ('entfallen' in z) return null;
  return z.gebunden ? [z.n, ...a.args.slice(1)] : a.args;
}

/** Titel des Sprung-Ziels für Hinweis und Log; ohne Zeile „Punkt <args[0]>“. */
export function sprungZielTitel(rows: RundownRow[], a: RundownAction): string {
  return rows.find((r) => r.id === a.zielId)?.label ?? `Punkt ${String(a.args[0] ?? '?')}`;
}
