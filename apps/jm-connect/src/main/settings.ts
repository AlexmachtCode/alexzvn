// Cloud-Zugang: Adresse des Release-Proxys + der PROXY_KEY, der die Admin-Routen des
// ConnectRoom-Workers schützt (Raum öffnen/schließen).
//
// Bis hierher kamen beide ausschließlich aus Umgebungsvariablen — im gepackten Build gibt es
// keine Shell, die App war damit schlicht nicht konfigurierbar. Jetzt: Eingabe in der Oberfläche.
// Der Key bleibt im Main-Prozess und wird verschlüsselt abgelegt (`safeStorage`); der Renderer
// erfährt nur, OB einer hinterlegt ist und woher er stammt — nie den Wert.
// Muster: apps/qa/src/main/cloud.ts (Key write-only) + apps/launcher/src/main/settings.ts (…Enc-Feld).
//
// Reihenfolge: Umgebungsvariable > gespeicherte Einstellung > Vorgabe (nur bei der URL).
// Die Umgebungsvariablen bleiben absichtlich vorrangig — sie sind der Dev-Workflow.
import { app, safeStorage } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { ProxyKeySource } from '@shared/types';

/** Öffentlicher Suite-Proxy — dieselbe Adresse, die der Launcher als Vorgabe nutzt. */
export const DEFAULT_PROXY_URL = 'https://jm-suite-proxy.jm-production-suite.workers.dev';

interface Stored {
  proxyUrl?: string;
  /** PROXY_KEY, safeStorage-verschlüsselt, base64. Nie im Klartext. */
  proxyKeyEnc?: string;
}

/** Nur belegt, wenn kein OS-Schlüsselbund da ist: dann lebt der Key nur für diese Sitzung. */
let sessionKey: string | null = null;
let warned = false;

function file(): string {
  return join(app.getPath('userData'), 'connect-settings.json');
}

function read(): Stored {
  try {
    const p = file();
    if (!existsSync(p)) return {};
    return JSON.parse(readFileSync(p, 'utf8')) as Stored;
  } catch {
    return {}; // beschädigt → wie „nichts hinterlegt"
  }
}

function write(next: Stored): void {
  try {
    const p = file();
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, JSON.stringify(next, null, 2) + '\n', { mode: 0o600 });
  } catch (e) {
    console.error('[connect] Einstellungen konnten nicht gespeichert werden:', e instanceof Error ? e.message : e);
  }
}

function decryptKey(enc: string | undefined): string | null {
  if (!enc || !safeStorage.isEncryptionAvailable()) return null;
  try {
    return safeStorage.decryptString(Buffer.from(enc, 'base64')) || null;
  } catch {
    return null; // fremder Schlüssel/anderes Profil
  }
}

/** Ein blanker Host (…workers.dev) ist häufig; `fetch` braucht aber ein absolutes URL. */
function normalize(url: string): string {
  const v = url.trim().replace(/\/+$/, '');
  if (!v) return '';
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

export function proxyUrl(): string {
  const env = (process.env.JMPS_PROXY_URL || '').trim();
  const stored = (read().proxyUrl || '').trim();
  return normalize(env || stored || DEFAULT_PROXY_URL);
}

export function proxyKey(): string | null {
  const env = (process.env.JMPS_PROXY_KEY || '').trim();
  if (env) return env;
  return decryptKey(read().proxyKeyEnc) ?? sessionKey;
}

export function proxyKeySource(): ProxyKeySource {
  if ((process.env.JMPS_PROXY_KEY || '').trim()) return 'env';
  if (decryptKey(read().proxyKeyEnc)) return 'stored';
  if (sessionKey) return 'session';
  return 'none';
}

export function setProxyUrl(url: string): void {
  const next = read();
  const v = url.trim();
  if (v) next.proxyUrl = v;
  else delete next.proxyUrl; // leer → zurück zur Vorgabe
  write(next);
}

/** Leerer Key löscht den hinterlegten. */
export function setProxyKey(key: string): void {
  const v = key.trim();
  const next = read();

  if (!v) {
    delete next.proxyKeyEnc;
    sessionKey = null;
    write(next);
    return;
  }

  if (safeStorage.isEncryptionAvailable()) {
    next.proxyKeyEnc = safeStorage.encryptString(v).toString('base64');
    sessionKey = null;
    write(next);
    return;
  }

  // Ohne Schlüsselbund NICHT im Klartext ablegen (gleiche Haltung wie secrets.ts) — lieber
  // für diese Sitzung merken und es dem Operator sagen, als ein Secret auf die Platte zu schreiben.
  sessionKey = v;
  if (!warned) {
    warned = true;
    console.warn('[connect] safeStorage nicht verfügbar — der Proxy-Key wird nur für diese Sitzung gehalten.');
  }
}
