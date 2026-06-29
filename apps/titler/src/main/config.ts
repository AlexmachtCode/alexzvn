import { app } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_CONFIG, DEFAULT_COLORS } from '@shared/types';
import type { PartialTitlerConfig, TitlerConfig } from '@shared/types';

function configFile(): string {
  return join(app.getPath('userData'), 'titler-config.json');
}

let cache: TitlerConfig | null = null;

export function getConfig(): TitlerConfig {
  if (cache) return cache;
  try {
    if (existsSync(configFile())) {
      const data = JSON.parse(readFileSync(configFile(), 'utf8')) as Partial<TitlerConfig>;
      cache = {
        ...DEFAULT_CONFIG,
        ...data,
        colors: { ...DEFAULT_COLORS, ...data.colors },
      };
      return cache;
    }
  } catch {
    // korrupt → Defaults
  }
  cache = { ...DEFAULT_CONFIG };
  return cache;
}

/** Teil-Update mit verschachteltem Merge; persistiert und liefert den neuen Stand. */
export function patchConfig(patch: PartialTitlerConfig): TitlerConfig {
  const cur = getConfig();
  const next: TitlerConfig = {
    ...cur,
    ...(patch.template !== undefined ? { template: patch.template } : {}),
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.subtitle !== undefined ? { subtitle: patch.subtitle } : {}),
    ...(patch.bannerText !== undefined ? { bannerText: patch.bannerText } : {}),
    ...(patch.tickerText !== undefined ? { tickerText: patch.tickerText } : {}),
    ...(patch.tickerSpeed !== undefined ? { tickerSpeed: patch.tickerSpeed } : {}),
    ...(patch.dataFolder !== undefined ? { dataFolder: patch.dataFolder } : {}),
    ...(patch.position !== undefined ? { position: patch.position } : {}),
    ...(patch.scale !== undefined ? { scale: patch.scale } : {}),
    ...(patch.ndiName !== undefined ? { ndiName: patch.ndiName } : {}),
    ...(patch.width !== undefined ? { width: patch.width } : {}),
    ...(patch.height !== undefined ? { height: patch.height } : {}),
    ...(patch.fps !== undefined ? { fps: patch.fps } : {}),
    colors: { ...cur.colors, ...patch.colors },
  };
  cache = next;
  try {
    mkdirSync(app.getPath('userData'), { recursive: true });
    writeFileSync(configFile(), JSON.stringify(next, null, 2));
  } catch {
    // nicht schreibbar → nur In-Memory
  }
  return next;
}
