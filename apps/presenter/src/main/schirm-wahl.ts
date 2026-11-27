// Altfehler Stufe 2, PS-18: die Wahl an Companion „Schwarz“ und „Weiß“ (`PRESENTER BLACK|WHITE [ON|OFF|TOGGLE]`). Rein, ohne
// Electron, damit der Test sie ohne Attrappe lädt (test/schirm-wahl.test.ts); der Steuerserver ruft sie in control-server.ts.
import type { ScreenMode } from '@shared/types';

/**
 * Was an `setScreen` (present.ts) geht, damit die Wahl wirkt, oder `null` für „nichts tun“. `setScreen` schaltet selbst um
 * (gleiches Ziel → Folie), darum:
 *  - `on`/`1`/`true`: ist das Ziel schon da, nichts; sonst das Ziel (aus Weiß wird Schwarz und umgekehrt);
 *  - `off`/`0`/`false`: ist das Ziel da, zurück auf die Folie; sonst nichts;
 *  - alles andere (keine Wahl, `toggle`, Unbekanntes): das Ziel, also Umschalten wie bisher (P2: Tasten aus Modul 0.3.0
 *    senden keine Wahl).
 * Groß- und Kleinschreibung zählt nicht (parseSuiteCommand gibt die Argumente in der Schreibung weiter, in der sie kamen).
 */
export function schirmBefehl(aktuell: ScreenMode, ziel: 'black' | 'white', wahl: string | undefined): ScreenMode | null {
  const w = (wahl ?? '').toLowerCase();
  if (w === 'on' || w === '1' || w === 'true') return aktuell === ziel ? null : ziel;
  if (w === 'off' || w === '0' || w === 'false') return aktuell === ziel ? 'live' : null;
  return ziel;
}
