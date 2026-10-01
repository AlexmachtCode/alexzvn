// Release-Liste seitenweise lesen - ohne Electron, damit der Selbsttest es prüfen kann.
//
// GEMESSEN am 01.10.2026: das Monorepo hatte 187 Releases, gelesen wurde nur
// Seite 1 (per_page=100). Die neuesten Releases von copy, grafiktool und
// media-converter lagen auf Seite 2 und waren damit unsichtbar: weder
// installier- noch aktualisierbar. Jeder neue Tag schob weitere Tools hinaus.
// Derselbe Fehler stand im Release-Proxy (services/release-proxy/worker.js).

export const RELEASES_PRO_SEITE = 100;
/** Schutz vor einer Endlosschleife: 30 Seiten = 3000 Releases. */
export const RELEASES_MAX_SEITEN = 30;

/**
 * Holt Seite 1, 2, … bis eine Seite kürzer als RELEASES_PRO_SEITE ist.
 * Scheitert eine Folgeseite, scheitert der ganze Aufruf: eine halbe Liste sähe
 * aus wie "es gibt kein neueres Release" - genau der stille Fehler, den das
 * Blättern behebt.
 */
export async function holeAlleSeiten<T>(holeSeite: (seite: number) => Promise<T[]>): Promise<T[]> {
  const alle: T[] = [];
  for (let seite = 1; seite <= RELEASES_MAX_SEITEN; seite++) {
    const teil = await holeSeite(seite);
    if (!Array.isArray(teil)) throw new Error('GitHub API: Release-Liste ist kein Array');
    alle.push(...teil);
    if (teil.length < RELEASES_PRO_SEITE) return alle;
  }
  console.warn(
    `[release-liste] Obergrenze von ${RELEASES_MAX_SEITEN} Seiten erreicht (${alle.length} Releases) - ältere bleiben ungelesen`,
  );
  return alle;
}
