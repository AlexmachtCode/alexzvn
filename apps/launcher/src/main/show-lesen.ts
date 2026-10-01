// ─────────────────────────────────────────────────────────────────────────────
// Show-Datei lesen MIT Grund (Master-Link Teil 2a) — OHNE Electron, per tsx getestet (test/iveo-huelle.test.ts).
// Wer null bekommt, erfährt hier, warum: der Fehlercode (ENOENT, EBUSY, EPERM …) oder „kein gültiges JSON“.
// Nie Dateiinhalt (G6) und nie der Pfad — wie show-schreiben.ts.
// ─────────────────────────────────────────────────────────────────────────────

import { parseShow, SHOW_FILE_EXT, type Show } from '@jm/show';
import { fehlerCode } from './verbund/fehlercode';

export type ShowGelesen = { show: Show; grund?: undefined } | { show: null; grund: string };

/** Show lesen und parsen. `lies` liefert den Dateitext (in der Produktion readFileSync). Wirft nie. */
export function leseShowMitGrund(pfad: string, lies: (pfad: string) => string): ShowGelesen {
  let text: string;
  try {
    text = lies(pfad);
  } catch (e) {
    return { show: null, grund: fehlerCode(e) }; // fehlt, gesperrt, Netzfreigabe weg
  }
  try {
    return { show: parseShow(text) };
  } catch {
    return { show: null, grund: 'kein gültiges JSON' };
  }
}

/**
 * Show-Editor beim Speichern (Spec 7.5, Regel 1): die Datei so lesen, wie sie JETZT ist. Nur .jmshow-Dateien.
 * Nicht lesbar → null UND eine Warnung mit dem Grund. Still verschluckt fiele Regel 1 weg, ohne dass es jemand sieht
 * (Owner-Regel „Diagnose, die niemand anzeigt“).
 */
export function leseShowFuerEditor(pfad: string, lies: (pfad: string) => string, warn: (m: string) => void): Show | null {
  if (!pfad.toLowerCase().endsWith(SHOW_FILE_EXT)) {
    warn('Show-Editor: keine .jmshow-Datei, nicht gelesen.');
    return null;
  }
  const r = leseShowMitGrund(pfad, lies);
  if (!r.show) warn(`Show-Editor: Show-Datei beim Speichern nicht lesbar (${r.grund}).`);
  return r.show;
}
