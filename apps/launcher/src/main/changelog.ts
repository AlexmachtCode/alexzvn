import { app } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CHANGELOG } from '@jm/suite-manifest';
import type { AppChangelog } from '@jm/suite-manifest';
import { resolveChangelogUrl } from './settings';
import { zugangsKopfFuer } from './konto/huelle';
import { redirectFuer } from './konto/worker-client';

// App-Patchnotes: gebündelter Fallback (CHANGELOG aus @jm/suite-manifest) +
// Live-Quelle vom Proxy (/changelog.json aus dem Katalog-Branch). So erscheinen
// neue App-Notes OHNE Launcher-Release (Issue #19). Muster wie manifest.ts.
let cache: AppChangelog[] = CHANGELOG;

function cacheFile(): string {
  return join(app.getPath('userData'), 'changelog-cache.json');
}

/** Anmeldung P22: Zugangskopf nur für Adressen des Workers (Sitzung, sonst Entwicklungs-Schlüssel). */
async function headers(url: string): Promise<Record<string, string>> {
  return { Accept: 'application/json', ...(await zugangsKopfFuer(url)) };
}

function isValid(value: unknown): value is AppChangelog[] {
  return (
    Array.isArray(value) &&
    value.every((c) => c && typeof (c as AppChangelog).app === 'string' && Array.isArray((c as AppChangelog).entries))
  );
}

/** Lokalen Changelog-Cache synchron beim Start laden (falls vorhanden). */
export function initChangelog(): void {
  try {
    if (existsSync(cacheFile())) {
      const parsed = JSON.parse(readFileSync(cacheFile(), 'utf8'));
      if (isValid(parsed)) cache = parsed;
    }
  } catch {
    // korrupter Cache → gebündelte Patchnotes behalten
  }
}

/**
 * Holt die remote changelog.json, validiert, cached und aktualisiert den
 * In-memory-Stand. Liefert true, wenn sich etwas geändert hat.
 */
export async function refreshChangelog(): Promise<boolean> {
  const url = resolveChangelogUrl();
  try {
    // Z1: trägt der Kopf eine Sitzung oder einen Schlüssel, folgt der Abruf keiner Weiterleitung (redirectFuer).
    const kopf = await headers(url);
    const res = await fetch(url, { headers: kopf, redirect: redirectFuer(kopf) });
    if (!res.ok) return false;
    const parsed = (await res.json()) as unknown;
    if (!isValid(parsed)) return false;
    const changed = JSON.stringify(parsed) !== JSON.stringify(cache);
    cache = parsed;
    mkdirSync(app.getPath('userData'), { recursive: true });
    writeFileSync(cacheFile(), JSON.stringify(parsed, null, 2));
    return changed;
  } catch {
    return false;
  }
}

export function getChangelog(): AppChangelog[] {
  return cache;
}
