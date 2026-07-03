import { app, safeStorage } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { IVEO_DEFAULT_BASE_URL } from '@jm/iveo';
import type { RecentShow, SuiteSettingsInput, SuiteSettingsView } from '@shared/types';

interface StoredSettings {
  /** Legacy-Klartext-Token (alte Datei). Wird beim nächsten Schreiben migriert. */
  githubToken?: string;
  /** GitHub-Token verschlüsselt (OS-Keychain via safeStorage), base64. Bevorzugt. */
  githubTokenEnc?: string;
  proxyUrl?: string;
  manifestUrl?: string;
  /** iveo-Basis-URL (kein Secret; Default = Staging). */
  iveoBaseUrl?: string;
  /**
   * iveo Bearer-Token PRO EVENT, verschlüsselt (safeStorage, base64). Schlüssel =
   * Event-Slug/UUID. Bewusst getrennt von der portablen .jmshow — das Secret
   * bleibt nur hier. #11.
   */
  iveoTokensEnc?: Record<string, string>;
  /** Klartext-Fallback (nur wenn safeStorage fehlt, z. B. Linux ohne Keyring). */
  iveoTokens?: Record<string, string>;
  /** Zuletzt geöffnete Shows (#157), neueste zuerst. */
  recentShows?: RecentShow[];
}

/** Wie viele zuletzt geöffnete Shows gemerkt werden (#157). */
const RECENT_SHOWS_CAP = 8;

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

/**
 * Token verschlüsselt ablegen (OS-Keychain via safeStorage), Klartext entfernen.
 * Greift sowohl für frisch gesetzte Tokens als auch für ein Legacy-Klartext-Token
 * aus einer alten Datei (Migration). Ist die Verschlüsselung nicht verfügbar
 * (z. B. Linux ohne Keyring), bleibt der Klartext erhalten — Token-Verlust wäre
 * schlimmer als at-rest-Klartext auf einem Einzelplatz.
 */
function sealToken(s: StoredSettings): StoredSettings {
  const out: StoredSettings = { ...s };
  if (out.githubToken && safeStorage.isEncryptionAvailable()) {
    out.githubTokenEnc = safeStorage.encryptString(out.githubToken).toString('base64');
    delete out.githubToken;
  }
  return out;
}

/** Gespeichertes Token lesen: verschlüsselt bevorzugt, Klartext-Fallback (Legacy). */
function storedToken(s: StoredSettings): string | undefined {
  if (s.githubTokenEnc && safeStorage.isEncryptionAvailable()) {
    try {
      return safeStorage.decryptString(Buffer.from(s.githubTokenEnc, 'base64')) || undefined;
    } catch {
      // Unlesbar (anderes OS-Profil/Schlüssel) → wie kein Token behandeln.
      return undefined;
    }
  }
  return s.githubToken || undefined;
}

function write(value: StoredSettings): void {
  mkdirSync(app.getPath('userData'), { recursive: true });
  // Vor dem Schreiben das Token versiegeln (Klartext → verschlüsselt).
  writeFileSync(settingsFile(), JSON.stringify(sealToken(value), null, 2), { mode: 0o600 });
}

/**
 * Einmalige Migration beim Start: ein vorhandenes Klartext-Token verschlüsselt
 * neu ablegen. No-op, wenn keins existiert oder die Verschlüsselung fehlt.
 * Muss NACH app.whenReady laufen (safeStorage braucht die bereite App).
 */
export function migrateTokenAtRest(): void {
  const s = read();
  if (s.githubToken && safeStorage.isEncryptionAvailable()) write(s);
}

/** Effektives Token: Umgebungsvariable hat Vorrang vor gespeichertem Wert. */
export function resolveToken(): string | undefined {
  return process.env['JMPS_GITHUB_TOKEN'] || storedToken(read()) || undefined;
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

// ── iveo (#11) ────────────────────────────────────────────────────────────────
// Der Launcher ist der EINZIGE Token-Halter/iveo-Client (single-holder). Das
// per-Event-Token liegt verschlüsselt hier — NIE in der portablen .jmshow und nie
// im Renderer. Env-Override JMPS_IVEO_TOKEN gilt global (nur für Dev/CI).

/** Effektive iveo-Basis-URL: Env > gespeichert > Staging-Default. Kein Secret. */
export function resolveIveoBaseUrl(): string {
  return process.env['JMPS_IVEO_BASE_URL'] || read().iveoBaseUrl || IVEO_DEFAULT_BASE_URL;
}

export function setIveoBaseUrl(url: string | undefined): void {
  const s = read();
  s.iveoBaseUrl = url?.trim() || undefined;
  write(s);
}

/** iveo-Token für ein Event ablegen (verschlüsselt) bzw. löschen (leerer Wert). */
export function setIveoToken(eventKey: string, token: string): void {
  const key = eventKey.trim();
  if (!key) return;
  const s = read();
  const enc = { ...(s.iveoTokensEnc ?? {}) };
  const plain = { ...(s.iveoTokens ?? {}) };
  // Beide Repräsentationen für diesen Key zurücksetzen, dann neu ablegen.
  delete enc[key];
  delete plain[key];
  const t = token.trim();
  if (t) {
    if (safeStorage.isEncryptionAvailable()) {
      enc[key] = safeStorage.encryptString(t).toString('base64');
    } else {
      // Fallback: at-rest-Klartext auf einem Einzelplatz — Token-Verlust wäre schlimmer.
      plain[key] = t;
    }
  }
  s.iveoTokensEnc = Object.keys(enc).length ? enc : undefined;
  s.iveoTokens = Object.keys(plain).length ? plain : undefined;
  write(s);
}

/** iveo-Token für ein Event lesen: Env-Override > verschlüsselt > Klartext-Fallback. */
export function getIveoToken(eventKey: string): string | undefined {
  const envTok = process.env['JMPS_IVEO_TOKEN'];
  if (envTok) return envTok;
  const key = eventKey.trim();
  if (!key) return undefined;
  const s = read();
  const enc = s.iveoTokensEnc?.[key];
  if (enc && safeStorage.isEncryptionAvailable()) {
    try {
      return safeStorage.decryptString(Buffer.from(enc, 'base64')) || undefined;
    } catch {
      return undefined; // anderes OS-Profil/Schlüssel → wie kein Token
    }
  }
  return s.iveoTokens?.[key] || undefined;
}

export function deleteIveoToken(eventKey: string): void {
  setIveoToken(eventKey, '');
}

export function hasIveoToken(eventKey: string): boolean {
  return Boolean(getIveoToken(eventKey));
}

/** Event-Keys, für die ein Token hinterlegt ist (ohne die Tokens preiszugeben). */
export function listIveoTokenKeys(): string[] {
  const s = read();
  return [...new Set([...Object.keys(s.iveoTokensEnc ?? {}), ...Object.keys(s.iveoTokens ?? {})])];
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
    iveoBaseUrl: resolveIveoBaseUrl(),
    iveoBaseUrlFromEnv: Boolean(process.env['JMPS_IVEO_BASE_URL']),
  };
}

/** Zuletzt geöffnete Shows lesen (#157), neueste zuerst. */
export function getRecentShows(): RecentShow[] {
  return read().recentShows ?? [];
}

/**
 * Eine geöffnete Show oben in die Recent-Liste schieben (#157). Dedupe nach
 * normalisiertem Pfad (case-insensitiv auf Windows), auf {@link RECENT_SHOWS_CAP}
 * begrenzt. Fehler beim Schreiben werden verschluckt — die Liste ist Komfort,
 * kein kritischer Zustand.
 */
export function pushRecentShow(entry: RecentShow): void {
  try {
    const key = entry.path.toLowerCase();
    const current = read();
    const rest = (current.recentShows ?? []).filter((r) => r.path.toLowerCase() !== key);
    write({ ...current, recentShows: [entry, ...rest].slice(0, RECENT_SHOWS_CAP) });
  } catch {
    // Komfortfunktion → Schreibfehler ignorieren.
  }
}

export function setSettings(input: SuiteSettingsInput): SuiteSettingsView {
  const current = read();
  const next: StoredSettings = { ...current };
  // Leerer String => Wert löschen; undefined => unverändert lassen.
  if (input.githubToken !== undefined) {
    const t = input.githubToken.trim();
    // Beide Repräsentationen zurücksetzen, dann (in write→sealToken) neu versiegeln.
    delete next.githubToken;
    delete next.githubTokenEnc;
    if (t) next.githubToken = t;
  }
  if (input.proxyUrl !== undefined) {
    next.proxyUrl = input.proxyUrl.trim() || undefined;
  }
  if (input.manifestUrl !== undefined) {
    next.manifestUrl = input.manifestUrl.trim() || undefined;
  }
  if (input.iveoBaseUrl !== undefined) {
    next.iveoBaseUrl = input.iveoBaseUrl.trim() || undefined;
  }
  write(next);
  return getSettingsView();
}
