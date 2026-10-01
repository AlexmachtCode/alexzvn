// ─────────────────────────────────────────────────────────────────────────────
// Show-Datei lesen MIT Grund (Master-Link Teil 2a) — OHNE Electron, per tsx getestet (test/iveo-huelle.test.ts).
// Wer null bekommt, erfährt hier, warum: der Fehlercode (ENOENT, EBUSY, EPERM …) oder „kein gültiges JSON“.
// Nie Dateiinhalt (G6) und nie der Pfad — wie show-schreiben.ts.
// ─────────────────────────────────────────────────────────────────────────────

import { parseShow, type Show } from '@jm/show';
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
