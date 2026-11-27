import { app } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PartialStageConfig, StageConfig } from '@shared/types';
// Altfehler SD-1: Standardwerte, Lesen und Mischen stehen als reines Modul in shared/konfig-regeln.ts (dort getestet).
import { DEFAULT_CONFIG, konfigAusDatei, konfigMischen } from '@shared/konfig-regeln';

function configFile(): string {
  return join(app.getPath('userData'), 'stage-config.json');
}

let cache: StageConfig | null = null;

export function getConfig(): StageConfig {
  if (cache) return cache;
  try {
    if (existsSync(configFile())) {
      cache = konfigAusDatei(JSON.parse(readFileSync(configFile(), 'utf8')) as Partial<StageConfig>);
      return cache;
    }
  } catch {
    // korrupt → Defaults
  }
  cache = { ...DEFAULT_CONFIG };
  return cache;
}

/** Teil-Update mit verschachteltem Merge; persistiert und liefert den neuen Stand. */
export function patchConfig(patch: PartialStageConfig): StageConfig {
  const next = konfigMischen(getConfig(), patch);
  cache = next;
  try {
    mkdirSync(app.getPath('userData'), { recursive: true });
    writeFileSync(configFile(), JSON.stringify(next, null, 2));
  } catch {
    // nicht schreibbar → nur In-Memory
  }
  return next;
}
