import { app } from 'electron';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { coerceGastKlickerConfig, type GastKlickerConfig } from '../shared/gast-klicker';

// #317: Gast-Klicker-Einstellung in userData — der Link soll Neustarts überleben (ein Link je Event).
const FILE = (): string => path.join(app.getPath('userData'), 'gast-klicker.json');

export function loadGastKlickerConfig(): GastKlickerConfig {
  try {
    return coerceGastKlickerConfig(JSON.parse(readFileSync(FILE(), 'utf8')));
  } catch {
    return { an: false, raum: null, geheimnis: null };
  }
}

export function saveGastKlickerConfig(config: GastKlickerConfig): void {
  try {
    writeFileSync(FILE(), JSON.stringify({ an: config.an, raum: config.raum, geheimnis: config.geheimnis }, null, 2), 'utf8');
  } catch {
    // Nicht fatal: die Sitzung läuft mit der Einstellung im Speicher weiter.
  }
}
