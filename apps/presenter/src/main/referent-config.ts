import { app } from 'electron';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { ReferentConfig } from '@shared/types';
import { normiereReferentConfig } from './referent-vollbild';

// #309: Vollbild der Referentenansicht, gemerkt in userData (Muster timer-config.json) – gilt auch nach einem
// Neustart der App.
const FILE = (): string => path.join(app.getPath('userData'), 'referent-config.json');

export function loadReferentConfig(): ReferentConfig {
  try {
    return normiereReferentConfig(JSON.parse(readFileSync(FILE(), 'utf8')));
  } catch {
    return { vollbild: false };
  }
}

export function saveReferentConfig(config: ReferentConfig): void {
  try {
    writeFileSync(FILE(), JSON.stringify(normiereReferentConfig(config), null, 2), 'utf8');
  } catch {
    // Nicht schlimm: Das Fenster bleibt, wie es ist; nur das Merken für das nächste Mal fällt aus.
  }
}
