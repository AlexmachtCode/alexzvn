import { app } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { COOKBOOK } from '@jm/cookbook';
import type { Cookbook, Recipe } from '@jm/cookbook';
import { resolveCookbookUrl, resolveProxy, resolveProxyKey } from './settings';

// Kochbuch-Rezepte: gebündelter Fallback (COOKBOOK aus @jm/cookbook) + Live-Quelle
// vom Proxy (/cookbook.json aus dem Katalog-Branch). So erscheinen neue Rezepte
// OHNE Launcher-Release — Muster wie changelog.ts/manifest.ts.
let cache: Cookbook = COOKBOOK;

function cacheFile(): string {
  return join(app.getPath('userData'), 'cookbook-cache.json');
}

function headers(url: string): Record<string, string> {
  const h: Record<string, string> = { Accept: 'application/json' };
  const proxy = resolveProxy();
  const key = resolveProxyKey();
  if (proxy && key && url.startsWith(proxy.replace(/\/$/, ''))) {
    h['X-Proxy-Key'] = key;
  }
  return h;
}

function isValid(value: unknown): value is Cookbook {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    Array.isArray((value as Cookbook).recipes) &&
    (value as Cookbook).recipes.every(
      (r) => r && typeof (r as Recipe).id === 'string' && typeof (r as Recipe).title === 'string',
    )
  );
}

/** Lokalen Kochbuch-Cache synchron beim Start laden (falls vorhanden). */
export function initCookbook(): void {
  try {
    if (existsSync(cacheFile())) {
      const parsed = JSON.parse(readFileSync(cacheFile(), 'utf8'));
      if (isValid(parsed)) cache = parsed;
    }
  } catch {
    // korrupter Cache → gebündelte Rezepte behalten
  }
}

/**
 * Holt die remote cookbook.json, validiert, cached und aktualisiert den
 * In-memory-Stand. Liefert true, wenn sich etwas geändert hat.
 */
export async function refreshCookbook(): Promise<boolean> {
  const url = resolveCookbookUrl();
  try {
    const res = await fetch(url, { headers: headers(url) });
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

/**
 * Aktuelle Rezepte: gebündelte Rezepte als Untergrenze mit der Live-Quelle
 * (Cache/Proxy) VEREINT — per id, Live gewinnt bei Konflikten. So erscheinen NEU
 * gebündelte Rezepte (eine frische Launcher-Version mit zusätzlichen Einträgen,
 * z. B. die Best-Practices-Kategorie) sofort, auch wenn der Proxy noch ein
 * älteres cookbook.json liefert; Live-Updates bestehender Rezepte greifen weiter.
 * (Früher ersetzte der Proxy-Stand die gebündelten Rezepte komplett → neue
 * gebündelte Einträge blieben unsichtbar, bis der Proxy neu deployt war.)
 */
export function getCookbook(): Recipe[] {
  if (cache === COOKBOOK) return cache.recipes;
  const byId = new Map<string, Recipe>();
  for (const r of COOKBOOK.recipes) byId.set(r.id, r);
  for (const r of cache.recipes) byId.set(r.id, r);
  return [...byId.values()];
}
