// Persistente Q&A-Konfiguration (Redezeit, Auto-Kopplung, Moderation, Remote) +
// manuelle Endpunkt-Overrides je Rolle (Cross-Subnet / mDNS aus). Liegt in userData.
import { app } from 'electron';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Endpoint, QaConfig } from '@shared/types';

export const defaultConfig: QaConfig = {
  speakSeconds: 120,
  autoTimer: true,
  autoTitler: true,
  moderation: true,
  remoteEnabled: false,
  titlerTemplate: 'lowerthird',
  // Externe Einreichung (Cloud-Relay, #166) — standardmäßig aus.
  cloudEnabled: false,
  proxyUrl: '',
  eventId: '',
  pressCode: '',
  streamOpen: true,
  pressOpen: true,
};

interface Persisted {
  config: QaConfig;
  overrides: Record<string, Endpoint>;
}

function configPath(): string {
  return join(app.getPath('userData'), 'qa.config.json');
}

let cache: Persisted | null = null;

function load(): Persisted {
  if (cache) return cache;
  try {
    const raw = JSON.parse(readFileSync(configPath(), 'utf8')) as {
      config?: Partial<QaConfig>;
      overrides?: Record<string, Partial<Endpoint>>;
    };
    const config = { ...defaultConfig, ...(raw.config ?? {}) };
    const overrides: Record<string, Endpoint> = {};
    for (const [role, ep] of Object.entries(raw.overrides ?? {})) {
      if (ep && typeof ep.host === 'string' && typeof ep.port === 'number') {
        overrides[role] = { host: ep.host, port: ep.port };
      }
    }
    cache = { config, overrides };
  } catch {
    cache = { config: { ...defaultConfig }, overrides: {} };
  }
  return cache;
}

function save(): void {
  try {
    writeFileSync(configPath(), JSON.stringify(cache, null, 2));
  } catch {
    /* best-effort */
  }
}

export function getConfig(): QaConfig {
  return load().config;
}

export function patchConfig(patch: Partial<QaConfig>): QaConfig {
  const c = load();
  cache = { config: { ...c.config, ...patch }, overrides: c.overrides };
  save();
  return cache.config;
}

export function getOverrides(): Record<string, Endpoint> {
  return load().overrides;
}

export function setOverride(role: string, host: string | null, port: number | null): Record<string, Endpoint> {
  const c = load();
  const overrides = { ...c.overrides };
  if (host && port && Number.isFinite(port)) overrides[role] = { host, port };
  else delete overrides[role];
  cache = { config: c.config, overrides };
  save();
  return overrides;
}
