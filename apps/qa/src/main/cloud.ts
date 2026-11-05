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
// Der Renderer sieht weder Private Key noch Freigabe noch Proxy-Key — alles bleibt im Main.
// Zugang (Anmeldung im Launcher, Teil 1, P30): Die Admin-Routen /qa/:id bekommen ihre Kopfzeile aus zugangsKopf
// (Freigabe des Launchers als Bearer, im Übergang der alte Proxy-Key); welcher Zugang gilt, entscheidet index.ts (QR1).
import { safeStorage } from 'electron';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type QaFreigabe, type QaZugang, QA_TEXT, RelayFehler, fehlerCode, geheimnisDatei, hatVerworfen, leseGeheimnisse, zugangsKopf } from './cloud-zugang';
import { raeumeTempReste, schreibeAtomar } from './datei-atomar';

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

/**
 * Geheimnisse (verschlüsselt at-rest): Event-Schlüsselpaar, Freigabe des Launchers (befristet, 72 h, nur für ihr Event)
 * und der alte Proxy-Key (nur im Übergang; die erste gültige Freigabe leert ihn, das Schlüsselpaar bleibt, QR3).
 */
export interface CloudSecrets {
  publicJwk: JsonWebKey | null;
  privateJwk: JsonWebKey | null;
  proxyKey: string;
  freigabe: QaFreigabe | null;
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

const EMPTY: CloudSecrets = { publicJwk: null, privateJwk: null, proxyKey: '', freigabe: null };

function secretPath(userDataDir: string): string {
  return join(userDataDir, 'qa.cloud.secret');
}

/** Geheimnisse laden (via safeStorage entschlüsseln). Fehlt/defekt → leer. */
export function loadSecrets(userDataDir: string, log?: (meldung: string) => void): CloudSecrets {
  // Reste abgestürzter Schreibvorgänge (ohne Schlüsselspeicher im Klartext) entfernen, bevor etwas gelesen wird.
  raeumeTempReste(secretPath(userDataDir));
  try {
    const raw = readFileSync(secretPath(userDataDir));
    const text = safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(raw) : raw.toString('utf8');
    // Z1-L3: Key und Freigabe nur aus \x21-\x7e (leseGeheimnisse); Altlast mit CR/LF/NUL wird verworfen und nicht wieder gespeichert.
    const roh: unknown = JSON.parse(text);
    const s = leseGeheimnisse(roh);
    if (hatVerworfen(roh, s)) {
      try {
        saveSecrets(userDataDir, s);
      } catch (e) {
        log?.(`Q&A: Geheimnisse nicht gespeichert (${(e as Error).name})`);
      }
    }
    return s;
  } catch {
    return { ...EMPTY };
  }
}

/**
 * Geheimnisse speichern: mit Schlüsselspeicher nur verschlüsselt (safeStorage); ohne bleibt die Freigabe nur im Speicher und
 * das Schlüsselpaar steht wie in Q&A 0.5.0 im Klartext (geheimnisDatei in cloud-zugang.ts, dort im Verhalten getestet; G6).
 */
export function saveSecrets(userDataDir: string, s: CloudSecrets): void {
  schreibeAtomar(secretPath(userDataDir), geheimnisDatei(s, {
    verfuegbar: () => safeStorage.isEncryptionAvailable(),
    verschluesseln: (text) => safeStorage.encryptString(text),
  }));
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

// RelayFehler und fehlerCode leben im reinen Modul cloud-zugang.ts (dort im Verhalten getestet, Z1-L3 AR85).
export { RelayFehler };

/** Event im Relay öffnen/aktualisieren (Public Key + Presse-Code-Hash + Flags). */
export async function openEvent(cfg: CloudCfg, secrets: CloudSecrets, zugang: QaZugang, retentionSec = 60 * 60 * 24 * 2): Promise<void> {
  if (!secrets.publicJwk) throw new Error(QA_TEXT.keinSchluessel);
  const pressCodeHash = cfg.pressCode ? await sha256Hex(cfg.pressCode) : '';
  const res = await fetch(base(cfg), {
    method: 'POST',
    headers: { ...zugangsKopf(zugang), 'content-type': 'application/json' },
    body: JSON.stringify({
      pubJwk: secrets.publicJwk,
      pressCodeHash,
      streamOpen: cfg.streamOpen,
      pressOpen: cfg.pressOpen,
      retentionSec,
    }),
  });
  if (!res.ok) throw new RelayFehler(`Öffnen fehlgeschlagen (HTTP ${res.status})`, res.status, await fehlerCode(res));
}

/** Offene Einreichungen abholen + entschlüsseln (ohne zu quittieren). */
export async function pollPending(cfg: CloudCfg, secrets: CloudSecrets, zugang: QaZugang): Promise<IngestItem[]> {
  if (!secrets.privateJwk) return [];
  const res = await fetch(`${base(cfg)}/pending`, { headers: zugangsKopf(zugang) });
  if (!res.ok) throw new RelayFehler(`Abruf fehlgeschlagen (HTTP ${res.status})`, res.status, await fehlerCode(res));
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

/** Abgeholte Einreichungen quittieren (Löschen im Relay); ein Fehler wird gemeldet (Q10, QR8). */
export async function ackItems(cfg: CloudCfg, zugang: QaZugang, ids: string[]): Promise<void> {
  if (!ids.length) return;
  const res = await fetch(`${base(cfg)}/ack`, {
    method: 'POST',
    headers: { ...zugangsKopf(zugang), 'content-type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) throw new RelayFehler(QA_TEXT.quittierenFehler(res.status), res.status, await fehlerCode(res));
}

/** Alle Event-Daten im Relay löschen (Ende des Events, DSGVO); ein Fehler wird gemeldet (Q10, QR8). */
export async function purgeEvent(cfg: CloudCfg, zugang: QaZugang): Promise<void> {
  if (!cfg.proxyUrl || !cfg.eventId) return;
  const res = await fetch(base(cfg), { method: 'DELETE', headers: zugangsKopf(zugang) });
  if (!res.ok) throw new RelayFehler(QA_TEXT.loeschenFehler(res.status), res.status, await fehlerCode(res));
}
