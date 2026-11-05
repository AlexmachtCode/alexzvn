// Datei atomar schreiben (Z1-L3, AR85): erst in eine Temp-Datei im selben Ordner, dann umbenennen. Bricht der Rechner dazwischen ab,
// bleibt die alte Datei ganz; eine liegengebliebene Temp-Datei wird nie gelesen. Rein (kein Electron), läuft unter node.
import { renameSync, rmSync, writeFileSync } from 'node:fs';

export function schreibeAtomar(pfad: string, daten: Uint8Array): void {
  const temp = `${pfad}.${process.pid}.tmp`;
  try {
    writeFileSync(temp, daten);
    renameSync(temp, pfad);
  } catch (e) {
    try {
      rmSync(temp, { force: true });
    } catch {
      /* egal */
    }
    throw e;
  }
}
