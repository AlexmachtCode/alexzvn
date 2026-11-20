import { app } from 'electron';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// NDI-Schalter (#303) in einer kleinen JSON-Datei in userData: Er überlebt den Neustart – ist er an,
// kommt NDI beim nächsten App-Start von selbst wieder (Muster remote-config.ts).
const DATEI = (): string => path.join(app.getPath('userData'), 'ndi-config.json');

export interface NdiConfig {
  an: boolean;
}

/** Nur ein echtes `true` schaltet ein; fehlende oder kaputte Datei → aus. */
export function ladeNdiConfig(): NdiConfig {
  try {
    const roh = JSON.parse(readFileSync(DATEI(), 'utf8')) as { an?: unknown } | null;
    return { an: roh?.an === true };
  } catch {
    return { an: false };
  }
}

export function speichereNdiConfig(c: NdiConfig): void {
  try {
    writeFileSync(DATEI(), JSON.stringify({ an: c.an === true }, null, 2), 'utf8');
  } catch {
    // Still: Der Schalter gilt in dieser Sitzung trotzdem, nur nicht nach dem Neustart.
  }
}
