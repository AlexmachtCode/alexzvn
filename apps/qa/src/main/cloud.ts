// Externe Q&A-Einreichung über den Cloud-Relay (#166) — Client-Seite.
//
// Der Titler/Q&A-Rechner öffnet KEINEN Inbound-Port. Stattdessen:
//  - erzeugt er ein Event-Schlüsselpaar (RSA-OAEP-2048); der PRIVATE Key bleibt
//    hier (single-holder), verschlüsselt at-rest über Electron safeStorage;
//  - lädt den PUBLIC Key + den SHA-256-Hash des Presse-Codes zum Worker;
//  - pollt die dort eingegangenen, Ende-zu-Ende verschlüsselten Einreichungen,
//    entschlüsselt sie lokal und quittiert sie (Löschen im Worker).
//
// Der Worker sieht nie Klartext (Blind-Relay, siehe docs/qa/external-submission.md).
// Der Renderer sieht weder Private Key noch Proxy-Key — alles bleibt im Main.
import { safeStorage } from 'electron';
import { webcrypto } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const { subtle } = webcrypto;
const enc = new TextEncoder();
const dec = new TextDecoder();

/** Nicht-geheime Cloud-Parameter (aus der QaConfig). */
export interface CloudCfg {
  proxyUrl: string;
  eventId: string;
  pressCode: string;
  streamOpen: boolean;
  pressOpen: boolean;
}

/** Geheimnisse (verschlüsselt at-rest): Event-Schlüsselpaar + Proxy-Key. */
export interface CloudSecrets {
  publicJwk: JsonWebKey | null;
  privateJwk: JsonWebKey | null;
  proxyKey: string;
}

/** Eine entschlüsselte, abgeholte Einreichung (bereit für die Queue). */
export interface IngestItem {
  itemId: string;
  channel: 'stream' | 'press';
  at: number;
  name: string;
  affiliation: string;
  question: string;
  contact?: string;
}

const EMPTY: CloudSecrets = { publicJwk: null, privateJwk: null, proxyKey: '' };

function secretPath(userDataDir: string): string {
  return join(userDataDir, 'qa.cloud.secret');
}

/** Geheimnisse laden (via safeStorage entschlüsseln). Fehlt/defekt → leer. */
export function loadSecrets(userDataDir: string): CloudSecrets {
  try {
    const raw = readFileSync(secretPath(userDataDir));
    const text = safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(raw) : raw.toString('utf8');
    const obj = JSON.parse(text) as Partial<CloudSecrets>;
    return { publicJwk: obj.publicJwk ?? null, privateJwk: obj.privateJwk ?? null, proxyKey: obj.proxyKey ?? '' };
  } catch {
    return { ...EMPTY };
  }
}

/** Geheimnisse speichern (via safeStorage verschlüsselt, wenn verfügbar). */
export function saveSecrets(userDataDir: string, s: CloudSecrets): void {
  const text = JSON.stringify(s);
  const buf = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(text)
    : Buffer.from(text, 'utf8');
  writeFileSync(secretPath(userDataDir), buf);
}

/** Frisches Event-Schlüsselpaar (RSA-OAEP-2048) als JWKs. */
export async function generateKeypair(): Promise<{ publicJwk: JsonWebKey; privateJwk: JsonWebKey }> {
  const kp = (await subtle.generateKey(
    { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['encrypt', 'decrypt'],
  )) as CryptoKeyPair;
  return {
    publicJwk: (await subtle.exportKey('jwk', kp.publicKey)) as JsonWebKey,
    privateJwk: (await subtle.exportKey('jwk', kp.privateKey)) as JsonWebKey,
  };
}

/** Zufällige Event-ID (`evt_` + 12 Hex) — passt ins Worker-Muster [A-Za-z0-9_-]. */
export function randomEventId(): string {
  const b = webcrypto.getRandomValues(new Uint8Array(6));
  return 'evt_' + Buffer.from(b).toString('hex');
}

async function sha256Hex(s: string): Promise<string> {
  const b = await subtle.digest('SHA-256', enc.encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

function b64ToBuf(s: string): Uint8Array {
  return Uint8Array.from(Buffer.from(s, 'base64'));
}

/** Chiffretext-Umschlag mit dem Event-Private-Key entschlüsseln. */
async function decryptEnvelope(
  privateJwk: JsonWebKey,
  envelope: { ek: string; iv: string; ct: string },
): Promise<Record<string, unknown>> {
  const priv = await subtle.importKey('jwk', privateJwk, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['decrypt']);
  const rawAes = await subtle.decrypt({ name: 'RSA-OAEP' }, priv, b64ToBuf(envelope.ek));
  const aes = await subtle.importKey('raw', rawAes, { name: 'AES-GCM' }, false, ['decrypt']);
  const pt = await subtle.decrypt({ name: 'AES-GCM', iv: b64ToBuf(envelope.iv) }, aes, b64ToBuf(envelope.ct));
  return JSON.parse(dec.decode(pt)) as Record<string, unknown>;
}

function base(cfg: CloudCfg): string {
  return `${cfg.proxyUrl.replace(/\/+$/, '')}/qa/${encodeURIComponent(cfg.eventId)}`;
}

/** Öffentliche Einreich-URLs (für QR / zum Teilen). */
export function streamUrl(cfg: CloudCfg): string {
  return cfg.proxyUrl && cfg.eventId ? base(cfg) : '';
}
export function pressUrl(cfg: CloudCfg): string {
  return cfg.proxyUrl && cfg.eventId ? `${base(cfg)}/press` : '';
}

/** Event im Relay öffnen/aktualisieren (Public Key + Presse-Code-Hash + Flags). */
export async function openEvent(cfg: CloudCfg, secrets: CloudSecrets, retentionSec = 60 * 60 * 24 * 2): Promise<void> {
  if (!secrets.publicJwk) throw new Error('Kein Event-Schlüssel — erst „Neues Event".');
  const pressCodeHash = cfg.pressCode ? await sha256Hex(cfg.pressCode) : '';
  const res = await fetch(base(cfg), {
    method: 'POST',
    headers: { 'X-Proxy-Key': secrets.proxyKey, 'content-type': 'application/json' },
    body: JSON.stringify({
      pubJwk: secrets.publicJwk,
      pressCodeHash,
      streamOpen: cfg.streamOpen,
      pressOpen: cfg.pressOpen,
      retentionSec,
    }),
  });
  if (!res.ok) throw new Error(`Öffnen fehlgeschlagen (HTTP ${res.status})`);
}

/** Offene Einreichungen abholen + entschlüsseln (ohne zu quittieren). */
export async function pollPending(cfg: CloudCfg, secrets: CloudSecrets): Promise<IngestItem[]> {
  if (!secrets.privateJwk) return [];
  const res = await fetch(`${base(cfg)}/pending`, { headers: { 'X-Proxy-Key': secrets.proxyKey } });
  if (!res.ok) throw new Error(`Abruf fehlgeschlagen (HTTP ${res.status})`);
  const data = (await res.json()) as { items?: Array<{ id: string; channel: string; at: number; blob: { ek: string; iv: string; ct: string } }> };
  const out: IngestItem[] = [];
  for (const it of data.items ?? []) {
    try {
      const c = await decryptEnvelope(secrets.privateJwk, it.blob);
      out.push({
        itemId: it.id,
        channel: it.channel === 'press' ? 'press' : 'stream',
        at: typeof it.at === 'number' ? it.at : Date.now(),
        name: String(c.name ?? ''),
        affiliation: String(c.affiliation ?? ''),
        question: String(c.question ?? ''),
        contact: c.contact ? String(c.contact) : undefined,
      });
    } catch {
      /* nicht entschlüsselbar (fremder Key / defekt) → überspringen */
    }
  }
  return out;
}

/** Abgeholte Einreichungen quittieren (Löschen im Relay). */
export async function ackItems(cfg: CloudCfg, secrets: CloudSecrets, ids: string[]): Promise<void> {
  if (!ids.length) return;
  await fetch(`${base(cfg)}/ack`, {
    method: 'POST',
    headers: { 'X-Proxy-Key': secrets.proxyKey, 'content-type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
}

/** Alle Event-Daten im Relay löschen (Ende des Events, DSGVO). */
export async function purgeEvent(cfg: CloudCfg, secrets: CloudSecrets): Promise<void> {
  if (!cfg.proxyUrl || !cfg.eventId) return;
  await fetch(base(cfg), { method: 'DELETE', headers: { 'X-Proxy-Key': secrets.proxyKey } });
}
