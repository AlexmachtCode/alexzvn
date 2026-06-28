import fs from 'node:fs';
import path from 'node:path';

// @jm/control-config — geteilte Steuerebenen-Konfiguration (P1-Adoption, #59).
//
// Problem: jede App hat ihr eigenes app.getPath('userData'); es gibt keinen
// suite-weiten Ort. Lösung: EINE Datei unter dem gemeinsamen appData-Root
// (`<appData>/JM Production Suite/control.json`), die alle Tools sehen — egal,
// ob sie vom Launcher oder direkt gestartet wurden. Der Launcher schreibt sie
// (Pairing/Provisionierung), die Tools lesen sie beim Start ihres Steuerservers.
//
// Reines node:fs/path → testbar ohne Electron (appData-Root wird übergeben).

const SUITE_DIR = 'JM Production Suite';
const FILE = 'control.json';

export interface SuiteControlConfig {
  /** Betriebsmodus aller Steuerserver. Fehlt → 'open' (heutiges Verhalten). */
  mode?: 'open' | 'secure';
  /** Geteiltes Suite-Token (Handshake + @jm/remote). */
  token?: string;
  /** TLS-Material (selbstsigniert, vom Launcher erzeugt). Inline-PEM. */
  tls?: { cert: string; key: string };
  /** SHA-256-Fingerprint des TLS-Zertifikats (für Clients/Anzeige/QR). */
  tlsFingerprint?: string;
  /** Bind-Adresse der Steuerserver (z. B. '127.0.0.1'). Fehlt → alle Interfaces. */
  bindHost?: string;
  /** Pairing-Key zum Signieren/Prüfen der mDNS-Annoncen. */
  signKey?: string;
}

/** Pfad der geteilten Konfig unter dem appData-Root (z. B. app.getPath('appData')). */
export function controlConfigPath(appDataDir: string): string {
  return path.join(appDataDir, SUITE_DIR, FILE);
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/** Nur bekannte, typgeprüfte Felder übernehmen (defensiv gegen Müll/alte Schemata). */
function sanitize(raw: unknown): SuiteControlConfig {
  if (!isObj(raw)) return {};
  const out: SuiteControlConfig = {};
  if (raw.mode === 'open' || raw.mode === 'secure') out.mode = raw.mode;
  if (typeof raw.token === 'string' && raw.token) out.token = raw.token;
  if (typeof raw.bindHost === 'string' && raw.bindHost) out.bindHost = raw.bindHost;
  if (typeof raw.tlsFingerprint === 'string' && raw.tlsFingerprint) out.tlsFingerprint = raw.tlsFingerprint;
  if (typeof raw.signKey === 'string' && raw.signKey) out.signKey = raw.signKey;
  if (isObj(raw.tls) && typeof raw.tls.cert === 'string' && typeof raw.tls.key === 'string') {
    out.tls = { cert: raw.tls.cert, key: raw.tls.key };
  }
  return out;
}

/** Konfig lesen; fehlt sie oder ist defekt → leere Konfig (= open, unverändert). */
export function readControlConfig(appDataDir: string): SuiteControlConfig {
  try {
    return sanitize(JSON.parse(fs.readFileSync(controlConfigPath(appDataDir), 'utf8')));
  } catch {
    return {};
  }
}

/** Konfig schreiben (atomar genug für lokalen Gebrauch, 0600). Launcher-seitig. */
export function writeControlConfig(appDataDir: string, cfg: SuiteControlConfig): void {
  const p = controlConfigPath(appDataDir);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(sanitize(cfg), null, 2) + '\n', { mode: 0o600 });
}

/**
 * Konfig → spreadbare Optionen für `new SuiteControlServer({...})`:
 *   new SuiteControlServer({ role, appId, …, ...controlServerOptions(cfg) })
 * Leere Konfig → `{}` → Server bleibt im open-Modus (kein Verhaltenswechsel).
 */
export function controlServerOptions(cfg: SuiteControlConfig): {
  mode?: 'open' | 'secure';
  bindHost?: string;
  auth?: { token: string };
  tls?: { cert: string; key: string };
} {
  const out: ReturnType<typeof controlServerOptions> = {};
  if (cfg.mode) out.mode = cfg.mode;
  if (cfg.bindHost) out.bindHost = cfg.bindHost;
  if (cfg.token) out.auth = { token: cfg.token };
  if (cfg.tls?.cert && cfg.tls?.key) out.tls = { cert: cfg.tls.cert, key: cfg.tls.key };
  return out;
}

/**
 * Konfig → spreadbare Optionen für `new SuiteControlClient({...})` (Gegenstück zu
 * controlServerOptions, P1-Adoption Client-Seite):
 *   new SuiteControlClient({ onState, …, ...controlClientOptions(cfg) })
 *
 * Nur im `secure`-Modus werden Token/TLS gesetzt — sonst leer, damit ein Client
 * gegen einen open-Server NICHT versehentlich TLS spricht (das würde den
 * Handshake brechen). Ein gesetztes Token gegen einen open-Server wäre harmlos,
 * TLS dagegen nicht; deshalb gaten wir beide an `mode === 'secure'`.
 */
export function controlClientOptions(cfg: SuiteControlConfig): {
  auth?: string;
  tls?: { fingerprint: string };
} {
  const out: ReturnType<typeof controlClientOptions> = {};
  if (cfg.mode !== 'secure') return out;
  if (cfg.token) out.auth = cfg.token;
  if (cfg.tlsFingerprint) out.tls = { fingerprint: cfg.tlsFingerprint };
  return out;
}
