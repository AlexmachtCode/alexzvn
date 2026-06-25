import { app } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SuiteSettingsInput, SuiteSettingsView } from '@shared/types';

interface StoredSettings {
  githubToken?: string;
  proxyUrl?: string;
  manifestUrl?: string;
}

// Standard-Release-Quelle: der interne Cloudflare-Proxy. Die URL ist kein
// Secret; der zugehörige Proxy-Key wird beim CI-Build via vite `define` aus dem
// Actions-Secret JMPS_PROXY_KEY eingebacken (leer in lokalen Dev-Builds → dann
// greift der Token-Fallback).
const DEFAULT_PROXY_URL = 'https://jm-suite-proxy.jm-production-suite.workers.dev';
const BAKED_PROXY_KEY = typeof __JMPS_PROXY_KEY__ !== 'undefined' ? __JMPS_PROXY_KEY__ : '';

// Standard-Katalogquelle: derselbe Proxy liefert die suite.json LIVE aus dem
// Repo (Route /suite.json). So erscheinen neue Tools ohne Launcher-Release —
// der Katalog wird zentral in git gepflegt. Überschreibbar per Setting/ENV.
const DEFAULT_MANIFEST_URL = `${DEFAULT_PROXY_URL}/suite.json`;
// App-Patchnotes ebenfalls live vom Proxy (Route /changelog.json) — so erscheinen
// neue Patchnotes ohne Launcher-Release (Issue #19).
const DEFAULT_CHANGELOG_URL = `${DEFAULT_PROXY_URL}/changelog.json`;
// Kochbuch-Rezepte ebenfalls live vom Proxy (Route /cookbook.json) — neue Rezepte
// ohne Launcher-Release.
const DEFAULT_COOKBOOK_URL = `${DEFAULT_PROXY_URL}/cookbook.json`;

/** Eingebackene Standard-Katalog-URL (für den Fetch-Fallback in manifest.ts). */
export function defaultManifestUrl(): string {
  return DEFAULT_MANIFEST_URL;
}

/** Effektive Changelog-URL: Env (JMPS_CHANGELOG_URL) > eingebackener Default. */
export function resolveChangelogUrl(): string {
  return process.env['JMPS_CHANGELOG_URL'] || DEFAULT_CHANGELOG_URL;
}

/** Effektive Cookbook-URL: Env (JMPS_COOKBOOK_URL) > eingebackener Default. */
export function resolveCookbookUrl(): string {
  return process.env['JMPS_COOKBOOK_URL'] || DEFAULT_COOKBOOK_URL;
}

function settingsFile(): string {
  return join(app.getPath('userData'), 'settings.json');
}

function read(): StoredSettings {
  try {
    if (existsSync(settingsFile())) {
      return JSON.parse(readFileSync(settingsFile(), 'utf8')) as StoredSettings;
    }
  } catch {
    // korrupte Datei ignorieren und mit Default weitermachen
  }
  return {};
}

function write(value: StoredSettings): void {
  mkdirSync(app.getPath('userData'), { recursive: true });
  writeFileSync(settingsFile(), JSON.stringify(value, null, 2));
}

/** Effektives Token: Umgebungsvariable hat Vorrang vor gespeichertem Wert. */
export function resolveToken(): string | undefined {
  return process.env['JMPS_GITHUB_TOKEN'] || read().githubToken || undefined;
}

/** Effektive Proxy-URL: Env > gespeichert > eingebackener Default. */
export function resolveProxy(): string | undefined {
  return process.env['JMPS_RELEASE_PROXY'] || read().proxyUrl || DEFAULT_PROXY_URL || undefined;
}

/** Proxy-Key: Env (Dev) > eingebackener Build-Wert. Nicht in den Settings. */
export function resolveProxyKey(): string | undefined {
  return process.env['JMPS_PROXY_KEY'] || BAKED_PROXY_KEY || undefined;
}

/**
 * Lokaler Polaris-KI-Agent fürs Rezept-Drafting (Pfad B, primär). Standardmäßig
 * AUS (undefined) → der Launcher nutzt den Anthropic-Fallback im Proxy. Sobald
 * `JMPS_POLARIS_URL` gesetzt ist, erzeugt Polaris das Rezept lokal (Daten bleiben
 * intern) und der Proxy öffnet nur noch den PR. Optionaler `JMPS_POLARIS_KEY` für
 * Auth gegen Polaris.
 */
export function resolvePolaris(): { url: string; key?: string } | undefined {
  const url = process.env['JMPS_POLARIS_URL']?.trim();
  if (!url) return undefined;
  return { url, key: process.env['JMPS_POLARIS_KEY']?.trim() || undefined };
}

/** Proxy ist nutzbar, wenn URL UND Key vorhanden sind. */
function proxyActive(): boolean {
  return Boolean(resolveProxy() && resolveProxyKey());
}

/** Effektive Remote-Manifest-URL (suite.json): Umgebungsvariable hat Vorrang. */
export function resolveManifestUrl(): string | undefined {
  return process.env['JMPS_MANIFEST_URL'] || read().manifestUrl || undefined;
}

function envControlled(): boolean {
  return Boolean(process.env['JMPS_GITHUB_TOKEN'] || process.env['JMPS_RELEASE_PROXY']);
}

export function getSettingsView(): SuiteSettingsView {
  const token = resolveToken();
  const source: SuiteSettingsView['source'] = proxyActive() ? 'proxy' : token ? 'github' : 'none';
  return {
    hasToken: Boolean(token),
    proxyUrl: resolveProxy(),
    source,
    fromEnv: envControlled(),
    manifestUrl: resolveManifestUrl(),
    manifestFromEnv: Boolean(process.env['JMPS_MANIFEST_URL']),
  };
}

export function setSettings(input: SuiteSettingsInput): SuiteSettingsView {
  const current = read();
  const next: StoredSettings = { ...current };
  // Leerer String => Wert löschen; undefined => unverändert lassen.
  if (input.githubToken !== undefined) {
    next.githubToken = input.githubToken.trim() || undefined;
  }
  if (input.proxyUrl !== undefined) {
    next.proxyUrl = input.proxyUrl.trim() || undefined;
  }
  if (input.manifestUrl !== undefined) {
    next.manifestUrl = input.manifestUrl.trim() || undefined;
  }
  write(next);
  return getSettingsView();
}
