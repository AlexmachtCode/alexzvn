import { app, safeStorage } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { IVEO_DEFAULT_BASE_URL, normalizeIveoBaseUrl } from '@jm/iveo';
import type { ManualEndpoint, RecentShow, SuiteSettingsInput, SuiteSettingsView } from '@shared/types';
import type { EntzugGrund } from '@shared/konto';
import { erzeugeIveoZentral, iveoSchluessel, type IveoGrund, type IveoZentralSpeicher } from './konto/iveo-zentral';
import { ohneGithubZugang, type UebergangsMerker } from './konto/huelle-kern';
import { leseEntzugAus } from './konto/sitzung-kern';

interface StoredSettings {
  /** Legacy-Klartext-Token (alte Datei). Wird beim nächsten Schreiben migriert. */
  githubToken?: string;
  /** GitHub-Token verschlüsselt (OS-Keychain via safeStorage), base64. Bevorzugt. */
  githubTokenEnc?: string;
  proxyUrl?: string;
  manifestUrl?: string;
  /** iveo-Basis-URL (kein Secret; Default = Production, iveo-Paket Spec 7.1). Fehlt sie, gilt der Standard. */
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
  /** Manuell eingetragene Steuer-Adressen (A4-Fallback bei blockiertem mDNS). */
  manualEndpoints?: ManualEndpoint[];
  /** iveo-Paket, Spec 9.14 (OF8): Anhänge in Side-Event-Ordnern ablegen; fehlt der Eintrag, gilt „an“. */
  iveoAnhangOrdner?: boolean;
  /**
   * Anmeldung (Plan P21, EP2): Sitzung samt beim Start festgehaltenem Kontostand, nur safeStorage-verschlüsselt (base64).
   * Verschlüsselt wird in konto/huelle.ts; ohne Schlüsselspeicher steht hier nichts (G6), nie Klartext.
   */
  kontoSitzungEnc?: string;
  /** Anmeldung (EP7): privater Geräteschlüssel, nur safeStorage-verschlüsselt (base64, aus konto/geraet.ts), nie Klartext. */
  geraetSchluesselEnc?: string;
  /** Anmeldung (R2, R5, EP23): festgestellter Entzug mit Grund, bis zur nächsten Anmeldung. Kein Geheimnis. */
  kontoEntzug?: { grund: EntzugGrund; am: number };
  /** Anmeldung (R9, OFP1): Zeitpunkt der ersten Anmeldung auf diesem Rechner (ms). Kein Geheimnis. */
  kontoErsteAnmeldung?: number;
  /** Anmeldung (EP14): Event-Schlüssel `‹Basis›|‹Slug›`, die DIESER Rechner mit iveo abgleicht. Kein Geheimnis. */
  iveoAbgleichHier?: string[];
  /** Anmeldung (Z1): die Übergangsmeldung K32/I11 steht noch aus (überlebt einen Neustart); `github`: ein GitHub-Zugang wurde gelöscht. Kein Geheimnis. */
  kontoUebergang?: { melden: true; github: boolean };
}

/** Wie viele zuletzt geöffnete Shows gemerkt werden (#157). */
const RECENT_SHOWS_CAP = 8;

// Standard-Server der Suite (Worker jm-suite-proxy). Die URL ist kein Secret. Einen eingebackenen Schlüssel gibt es
// nicht mehr (Anmeldung P32, EP11): Der Launcher kommt über die Sitzung der Anmeldung an den Worker; nur die Entwicklung
// setzt noch die Umgebungsvariable (resolveProxyKey).
const DEFAULT_PROXY_URL = 'https://jm-suite-proxy.jm-production-suite.workers.dev';

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

/**
 * Alter Proxy-Key nur noch für die Entwicklung (EP12): die Umgebungsvariable JMPS_PROXY_KEY — nie eingebacken, nie in den
 * Settings. Der Worker nimmt ihn bis ALTKEY_BIS an (EP9); der Konto-Dialog nennt die gesetzte Variable (K31).
 */
export function resolveProxyKey(): string | undefined {
  return process.env['JMPS_PROXY_KEY'] || undefined;
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

/**
 * Anmeldung (Plan P22): Ist eine Sitzung nutzbar? Die Hülle (konto/huelle.ts) meldet sich beim Start hier an; settings.ts
 * importiert sie nicht (kein Import-Zyklus). Bis dahin gibt es keine Sitzung.
 */
let sitzungMoeglich: () => boolean = () => false;
export function verbindeSitzung(f: () => boolean): void {
  sitzungMoeglich = f;
}

/** Der Worker ist nutzbar mit Server-Adresse und Sitzung oder Entwicklungs-Schlüssel (Spec 9.1, EP12). */
function proxyActive(): boolean {
  return Boolean(resolveProxy() && (sitzungMoeglich() || resolveProxyKey()));
}

/** Effektive Remote-Manifest-URL (suite.json): Umgebungsvariable hat Vorrang. */
export function resolveManifestUrl(): string | undefined {
  return process.env['JMPS_MANIFEST_URL'] || read().manifestUrl || undefined;
}

/** Anmeldung P22 (T23): „per Umgebungsvariable gesetzt“ meint nur noch die Server-Adresse; den GitHub-Zugang gibt es im Fenster nicht mehr (P28). */
function envControlled(): boolean {
  return Boolean(process.env['JMPS_RELEASE_PROXY']);
}

// ── iveo (#11) ────────────────────────────────────────────────────────────────
// Der Launcher ist der EINZIGE Token-Halter/iveo-Client (single-holder). Das
// per-Event-Token liegt verschlüsselt hier — NIE in der portablen .jmshow und nie
// im Renderer. Env-Override JMPS_IVEO_TOKEN gilt global (nur für Dev/CI).

/** Effektive iveo-Basis-URL: Env > gespeichert > Production-Default (iveo-Paket, Spec 7.1). Kein Secret. */
export function resolveIveoBaseUrl(): string {
  return process.env['JMPS_IVEO_BASE_URL'] || read().iveoBaseUrl || IVEO_DEFAULT_BASE_URL;
}

export function setIveoBaseUrl(url: string | undefined): void {
  const s = read();
  s.iveoBaseUrl = url?.trim() || undefined;
  write(s);
}

/** iveo-Paket, Spec 9.14 (OF8): Schalter „Anhänge in Side-Event-Ordnern ablegen“ dieses Rechners, Standard an. */
export function getIveoAnhangOrdner(): boolean {
  return read().iveoAnhangOrdner !== false;
}

/** Schalter setzen; „an“ ist der Standard und wird nicht gespeichert (der Eintrag fällt weg). */
export function setIveoAnhangOrdner(an: boolean): void {
  const s = read();
  if (an) delete s.iveoAnhangOrdner;
  else s.iveoAnhangOrdner = false;
  write(s);
}

// Anmeldung P32 (G6, OFP1): iveo-Tokens werden auf diesem Rechner nicht mehr gespeichert. Lokal liegen nur noch alte Tokens
// aus der Zeit vor der Anmeldung; sie werden im Übergang gelesen und nach OFP1 gelöscht (loescheLokaleIveoTokens).

/** Lokal gespeichertes iveo-Token (Bestand; nach der Anmeldung nur noch im Übergang, OFP1): verschlüsselt > Klartext; ohne Env. */
function lokalesIveoToken(eventKey: string): string | undefined {
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

// ── Anmeldung P23 (Spec 6.4; EP13, EP14; Verhalten 11.4): die eine Naht für iveo-Tokens ─────────────────────────────────
// Alle Leser (Kern, Wächter, Ablage, Anhänge, Download, Umschalten) gehen über getIveoToken. Es liest zuerst den Speicher der
// Anmeldung (Tokens nur im Speicher, nie auf der Platte), im Übergang dann ein lokal gespeichertes Token. Der Kern bekommt
// ein Token nur mit „Abgleich hier“ oder lokalem Token (IV1, N8). Die Hülle meldet Speicher und Lage beim Start
// (verbindeIveoZentral); settings.ts importiert sie nicht (kein Import-Zyklus).
const leererIveoSpeicher = erzeugeIveoZentral();
let iveoQuelle: { speicher: IveoZentralSpeicher; lage(): { angemeldet: boolean; geladen: boolean } } | null = null;
export function verbindeIveoZentral(q: { speicher: IveoZentralSpeicher; lage(): { angemeldet: boolean; geladen: boolean } }): void {
  iveoQuelle = q;
}

/**
 * IV1: Token und Grund für ein Event (Slug) und die Basis-URL seiner Bindung (leer = Standard): Entwicklungsvariable >
 * Speicher (Schlüssel genau, dann eindeutiger Slug) > lokales Token; ohne „Abgleich hier“ und ohne lokales Token
 * `kein-abgleich-hier`. `auchOhneAbgleich` zählt zusätzliche Schlüssel als markiert (nur das Binden, IV4).
 */
export function iveoTokenMitGrund(
  eventKey: string,
  basis?: string,
  auchOhneAbgleich: readonly string[] = [],
): { token: string | undefined; grund: IveoGrund } {
  const slug = eventKey.trim();
  if (!slug) return { token: undefined, grund: 'nicht-hinterlegt' };
  const lage = iveoQuelle?.lage() ?? { angemeldet: false, geladen: false };
  return (iveoQuelle?.speicher ?? leererIveoSpeicher).tokenFuer(slug, basis?.trim() || undefined, {
    angemeldet: lage.angemeldet,
    geladen: lage.geladen,
    abgleichHier: [...leseIveoAbgleichHier(), ...auchOhneAbgleich],
    lokal: (s) => lokalesIveoToken(s),
    env: process.env['JMPS_IVEO_TOKEN'] || undefined,
    standardBasis: resolveIveoBaseUrl(),
  });
}

/** iveo-Token für ein Event und seine Basis-URL (Anmeldung P23): über die Naht iveoTokenMitGrund. */
export function getIveoToken(eventKey: string, basis?: string): string | undefined {
  return iveoTokenMitGrund(eventKey, basis).token;
}

/**
 * IV4: Token zum Binden im Show-Editor — wie getIveoToken für genau dieses Event, aber auch ohne „Abgleich hier“ (das setzt
 * erst das Binden). Im Übergang zuletzt der lokal gemerkte Basis-Token (C4). Ungültige Adresse → undefined.
 */
export function iveoTokenZumBinden(slug: string, basis: string): string | undefined {
  const s = slug.trim();
  if (!s) return undefined;
  const adresse = basis.trim() || resolveIveoBaseUrl();
  let key: string;
  try {
    key = iveoSchluessel(adresse, s);
  } catch {
    return undefined;
  }
  return iveoTokenMitGrund(s, adresse, [key]).token ?? lokalesIveoToken(iveoBaseKey(adresse));
}

// ── C4: Token PRO BASIS-URL (Bestand) ───────────────────────────────────────────
// Ein iveo-Token gilt basis-/org-weit — die Discovery `GET /` listet ALLE für den
// Token lesbaren Events. Bis zur Anmeldung legte das Binden es zusätzlich unter einem
// `base:<normalisierte URL>`-Schlüssel ab (kollidiert nicht mit Event-Slugs). Seit der
// Anmeldung (P23, P32) wird nichts mehr abgelegt; ein alter Basis-Token wird nur noch
// gelesen und nach der Frist gelöscht (OFP1, IV5).
function iveoBaseKey(baseUrl: string): string {
  return `base:${normalizeIveoBaseUrl(baseUrl)}`;
}

/**
 * Basis-Token lesen (C4; Anmeldung P23: zuerst der Speicher der Anmeldung — ein Event derselben Basis, ein Token gilt
 * basis-weit —, dann im Übergang der lokal gemerkte). Env-Override wie bei getIveoToken; ungültige Adresse wirft wie bisher.
 */
export function getIveoBaseToken(baseUrl?: string): string | undefined {
  const env = process.env['JMPS_IVEO_TOKEN'];
  if (env) return env;
  const basis = normalizeIveoBaseUrl(baseUrl?.trim() || resolveIveoBaseUrl());
  const e = (iveoQuelle?.speicher ?? leererIveoSpeicher).erlaubteEvents().find((x) => x.key.startsWith(`${basis}|`));
  const zentral = e ? iveoTokenMitGrund(e.slug, basis, [e.key]).token : undefined;
  return zentral ?? lokalesIveoToken(iveoBaseKey(basis));
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
    // iveo-Paket, Spec 7.2 (E15): der GESPEICHERTE Wert, nicht der wirksame. Das Einstellungsfeld zeigt ihn beim Öffnen,
    // damit „Speichern“ eine eingetragene Adresse nicht mehr mit dem leeren Feld löscht.
    iveoBaseUrlEingetragen: read().iveoBaseUrl ?? null,
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

// ── A4: manuelle Steuer-Adressen (Fallback bei blockiertem mDNS) ───────────────
function endpointKey(e: ManualEndpoint): string {
  return `${e.host}:${e.port}`;
}

/** Gültigen host:port normalisieren; null, wenn unbrauchbar. */
function normalizeEndpoint(host: string, port: number): ManualEndpoint | null {
  const h = host.trim();
  const p = Math.trunc(port);
  if (!h || !Number.isFinite(p) || p <= 0 || p > 65535) return null;
  return { host: h, port: p };
}

export function getManualEndpoints(): ManualEndpoint[] {
  return read().manualEndpoints ?? [];
}

/** Manuelle Adresse hinzufügen (dedupe nach host:port) → neue Liste. */
export function addManualEndpoint(host: string, port: number): ManualEndpoint[] {
  const ep = normalizeEndpoint(host, port);
  const current = getManualEndpoints();
  if (!ep) return current;
  const rest = current.filter((e) => endpointKey(e) !== endpointKey(ep));
  const next = [...rest, ep];
  write({ ...read(), manualEndpoints: next });
  return next;
}

/** Manuelle Adresse entfernen → neue Liste. */
export function removeManualEndpoint(host: string, port: number): ManualEndpoint[] {
  const key = `${host.trim()}:${Math.trunc(port)}`;
  const next = getManualEndpoints().filter((e) => endpointKey(e) !== key);
  write({ ...read(), manualEndpoints: next.length ? next : undefined });
  return next;
}

export function setSettings(input: SuiteSettingsInput): SuiteSettingsView {
  const current = read();
  const next: StoredSettings = { ...current };
  // Leerer String => Wert löschen; undefined => unverändert lassen.
  // Anmeldung P32 (N5, EP12): Ein GitHub-Zugang wird nicht mehr gespeichert (Downloads laufen über die Anmeldung); ein
  // leerer Wert löscht einen alten weiter. Das Feld gibt es in den Einstellungen nicht mehr (P28).
  if (input.githubToken !== undefined && !input.githubToken.trim()) {
    delete next.githubToken;
    delete next.githubTokenEnc;
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

// ── Anmeldung (Plan P21; 10.7) ────────────────────────────────────────────────
// Nur Speichern und Lesen. Verschlüsselt wird in konto/huelle.ts (safeStorage); hier steht nie ein Klartext-Geheimnis
// und es gibt keinen Klartext-Rückfall (G6). Jeder Schreiber liest erst und behält alle übrigen Felder (Ist-L 3).

/** Verschlüsseltes Feld der Anmeldung (base64 aus safeStorage), sonst undefined. */
export function leseKontoFeld(feld: 'kontoSitzungEnc' | 'geraetSchluesselEnc'): string | undefined {
  const v = read()[feld];
  return typeof v === 'string' && v ? v : undefined;
}

/** Verschlüsseltes Feld schreiben; undefined löscht es. */
export function schreibeKontoFeld(feld: 'kontoSitzungEnc' | 'geraetSchluesselEnc', wert: string | undefined): void {
  const s = read();
  if (wert) s[feld] = wert;
  else delete s[feld];
  write(s);
}

/** Gemerkter Entzug (R2): Grund und Zeitpunkt, sonst null. */
export function leseKontoEntzug(): { grund: EntzugGrund; am: number } | null {
  // Z1: `grund` muss einer der vier Werte sein, `am` eine endliche Zahl; alles andere gilt als kein Entzug.
  return leseEntzugAus(read().kontoEntzug);
}

/** Entzug merken bzw. (null) vergessen. */
export function schreibeKontoEntzug(e: { grund: EntzugGrund; am: number } | null): void {
  const s = read();
  if (e) s.kontoEntzug = { grund: e.grund, am: e.am };
  else delete s.kontoEntzug;
  write(s);
}

/** Zeitpunkt der ersten Anmeldung auf diesem Rechner (R9, OFP1), sonst null. */
export function leseKontoErsteAnmeldung(): number | null {
  const v = read().kontoErsteAnmeldung;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function schreibeKontoErsteAnmeldung(ms: number): void {
  write({ ...read(), kontoErsteAnmeldung: ms });
}

/** EP14: Event-Schlüssel, die dieser Rechner mit iveo abgleicht („Abgleich hier“). */
export function leseIveoAbgleichHier(): string[] {
  const v = read().iveoAbgleichHier;
  return Array.isArray(v) ? v.filter((k): k is string => typeof k === 'string' && k.length > 0) : [];
}

/** „Abgleich hier“ für einen Event-Schlüssel setzen bzw. (an = false) beenden. */
export function setzeIveoAbgleichHier(key: string, an: boolean): void {
  const k = key.trim();
  if (!k) return;
  const s = read();
  const rest = (s.iveoAbgleichHier ?? []).filter((x) => x !== k);
  const neu = an ? [...rest, k] : rest;
  if (neu.length) s.iveoAbgleichHier = neu;
  else delete s.iveoAbgleichHier;
  write(s);
}

// ── Übergang (Plan P32; Spec 10, 2 Anti-Ziel; N5, N9; EP12, EP14; OFP1) ──────────────────────────────────────────────────
// Nur Löschen und Markieren, nie ein neues Geheimnis (G6). Wann gelöscht wird, entscheidet die Hülle (konto/huelle.ts) nach
// lokaleLoeschen (P14); hier steht nur, wie.

/** N5, EP12: gespeicherten GitHub-Zugang löschen (verschlüsselt und Klartext). true, wenn einer da war. */
export function loescheGithubZugang(): boolean {
  // Z1: nur die beiden GitHub-Felder gehen; `proxyUrl` und alles übrige bleibt (ohneGithubZugang, im Verhalten geprüft).
  const { neu, war } = ohneGithubZugang(read());
  if (!war) return false;
  write(neu);
  return true;
}

/** Z1: die Vormerkung der Übergangsmeldung K32/I11 (überlebt einen Neustart), sonst null. */
export function leseKontoUebergang(): UebergangsMerker | null {
  const u = read().kontoUebergang;
  return u && u.melden === true ? { melden: true, github: u.github === true } : null;
}

/** Z1: Vormerkung setzen bzw. (null) nach der Meldung löschen. */
export function schreibeKontoUebergang(m: UebergangsMerker | null): void {
  const s = read();
  if (m) s.kontoUebergang = { melden: true, github: m.github };
  else delete s.kontoUebergang;
  write(s);
}

/** OFP1, IV5: lokal gespeicherte iveo-Tokens löschen (Schlüssel wie gespeichert: Slug oder `base:‹URL›`), beide Formen. */
export function loescheLokaleIveoTokens(slugs: readonly string[]): void {
  if (slugs.length === 0) return;
  const s = read();
  const enc = { ...(s.iveoTokensEnc ?? {}) };
  const plain = { ...(s.iveoTokens ?? {}) };
  for (const k of slugs) {
    delete enc[k];
    delete plain[k];
  }
  s.iveoTokensEnc = Object.keys(enc).length ? enc : undefined;
  s.iveoTokens = Object.keys(plain).length ? plain : undefined;
  write(s);
}

/** EP14, IV5: „Abgleich hier“ für mehrere Event-Schlüssel setzen, bevor ihr lokales Token gelöscht wird (kein Geheimnis). */
export function markiereAbgleichHier(keys: readonly string[]): void {
  const neu = keys.map((k) => k.trim()).filter((k) => k.length > 0);
  if (neu.length === 0) return;
  const s = read();
  s.iveoAbgleichHier = [...new Set([...(s.iveoAbgleichHier ?? []), ...neu])];
  write(s);
}
