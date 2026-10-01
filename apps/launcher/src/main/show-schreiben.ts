// ─────────────────────────────────────────────────────────────────────────────
// Show-Datei sicher schreiben (Master-Link Teil 2a, Spec 7.4) — OHNE Electron, per tsx getestet
// (test/iveo-abgleich.test.ts). Die fs-Funktionen und das Warten kommen von außen.
//
// Zwischendatei im selben Ordner, dann umbenennen: Ein Tool, das die Show gerade liest, sieht nie eine halbe
// Datei. Unter Windows scheitert das Umbenennen, solange ein Tool die Show offen hat (EPERM/EBUSY/EACCES) →
// bis zu 5 Versuche im Abstand von 50 ms, SYNCHRON. Synchron ist Absicht: Der iveo-Kern prüft „active === a &&
// generation === gen“ und schreibt danach ohne await dazwischen (Spec 7.3).
// ─────────────────────────────────────────────────────────────────────────────

import { fehlerCode } from './verbund/fehlercode';

/** Die drei fs-Funktionen, die das Schreiben braucht. In der Produktion node:fs, im Test nachgebaut. */
export interface DateiSystem {
  writeFileSync(p: string, d: string, enc: 'utf8'): void;
  renameSync(a: string, b: string): void;
  unlinkSync(p: string): void;
}

/** Vorübergehende Sperren unter Windows (Tool liest gerade, Virenscanner, Indexer). */
const WIEDERHOLBAR = new Set(['EPERM', 'EBUSY', 'EACCES']);
const VERSUCHE = 5;
const PAUSE_MS = 50;

/** Synchrones Warten für die Produktion (blockiert den Main-Prozess höchstens 4 × 50 ms je Schreiben). */
export function warteSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Schreibt `inhalt` atomar nach `pfad`. `true` = die Datei trägt jetzt den neuen Inhalt. `false` = nichts
 * geändert: Warnung im Log (nur der Fehlercode, nie Pfad oder Inhalt), Zwischendatei gelöscht, Original unberührt.
 */
export function schreibeShowAtomar(
  pfad: string,
  inhalt: string,
  fs: DateiSystem,
  warte: (ms: number) => void,
  log: (m: string) => void,
): boolean {
  // Synchron, deshalb überschneiden sich zwei Schreibvorgänge desselben Prozesses nie: die PID genügt als Name.
  const zwischen = `${pfad}.${process.pid}.tmp`;
  const verwerfen = (): void => {
    try {
      fs.unlinkSync(zwischen);
    } catch {
      /* Zwischendatei gibt es nicht (mehr) */
    }
  };
  try {
    fs.writeFileSync(zwischen, inhalt, 'utf8');
  } catch (e) {
    verwerfen();
    log(`Show nicht geschrieben (${fehlerCode(e)}): Zwischendatei nicht anlegbar, Original unverändert.`);
    return false;
  }
  for (let versuch = 1; ; versuch++) {
    try {
      fs.renameSync(zwischen, pfad);
      return true;
    } catch (e) {
      const code = fehlerCode(e);
      if (!WIEDERHOLBAR.has(code) || versuch >= VERSUCHE) {
        verwerfen();
        log(`Show nicht geschrieben (${code} nach ${versuch} Versuch${versuch === 1 ? '' : 'en'}), Original unverändert.`);
        return false;
      }
      warte(PAUSE_MS);
    }
  }
}
