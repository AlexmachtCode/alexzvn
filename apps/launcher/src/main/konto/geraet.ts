// ─────────────────────────────────────────────────────────────────────────────
// Anmeldung im Launcher (Teil 1) · Geräteschlüssel (Plan 10.6, EP7; Spec 7, 2).
// ECDSA P-256 über Web Crypto. Der private Schlüssel liegt nur verschlüsselt in settings.json (PKCS8, base64, über den
// eingespeisten Verschlüsseler = safeStorage in der Hülle, Task 21). Ohne Schlüsselspeicher gibt es kein Gerät und es wird
// nichts geschrieben: kein Klartext-Rückfall wie bei den iveo-Tokens (settings.ts). Ein unlesbarer Schlüssel (anderes
// Windows-Profil, neues System) ergibt ein neues Gerät; der Admin markiert es bei Bedarf neu als JM-Rechner.
// Gerätekennung und Beweis wie services/release-proxy/konto-krypto.js (geraetIdAus, beweisText, pruefeGeraeteBeweis):
// gid = erste 22 Zeichen b64url von SHA-256 über SPKI, Beweis = Signatur (P1363, b64url) über `jm-geraet|zweck|bezug|ts`.
// Kein electron-Import (G9).
// ─────────────────────────────────────────────────────────────────────────────

export interface Verschluesseler { verfuegbar(): boolean; verschluesseln(klar: string): string; entschluesseln(b64: string): string }
export interface GeraetBeweis { gid: string; ts: number; sig: string }
export interface GeraetHandle { gid: string; publicJwk: JsonWebKey; beweis(zweck: 'abholen' | 'erneuern', bezug: string, jetzt: number): Promise<GeraetBeweis> }
export type GeraetLaden = { art: 'ok'; geraet: GeraetHandle; neu: boolean } | { art: 'neu-wegen-unlesbar'; geraet: GeraetHandle } | { art: 'kein-schluesselspeicher' };

const ALGO = { name: 'ECDSA', namedCurve: 'P-256' } as const;
const SIGNATUR = { name: 'ECDSA', hash: 'SHA-256' } as const;

function subtle(): SubtleCrypto {
  return globalThis.crypto.subtle;
}

function b64url(daten: ArrayBuffer): string {
  return Buffer.from(daten).toString('base64url');
}

/** Öffentlicher Teil ohne Beiwerk: nur kty, crv, x, y (der Worker lehnt einen Schlüssel mit privatem Anteil `d` ab). */
function oeffentlich(jwk: JsonWebKey): JsonWebKey {
  return { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y };
}

/** Text, den das Gerät signiert (Zwecke `abholen` mit Vorgang, `erneuern` mit Konto-Kennung). */
export function beweisText(zweck: string, bezug: string, ts: number): string {
  return `jm-geraet|${zweck}|${bezug}|${ts}`;
}

/** Gerätekennung: die ersten 22 Zeichen b64url von SHA-256 über den öffentlichen Schlüssel als SPKI. */
export async function geraetIdAus(publicJwk: JsonWebKey): Promise<string> {
  const schluessel = await subtle().importKey('jwk', oeffentlich(publicJwk), ALGO, true, ['verify']);
  const spki = await subtle().exportKey('spki', schluessel);
  return b64url(await subtle().digest('SHA-256', spki)).slice(0, 22);
}

async function handleAus(privat: CryptoKey): Promise<GeraetHandle> {
  const jwk = await subtle().exportKey('jwk', privat);
  const publicJwk = oeffentlich(jwk);
  const gid = await geraetIdAus(publicJwk);
  // Zum Signieren eine nicht exportierbare Fassung: der private Schlüssel verlässt diesen Prozess nur verschlüsselt.
  const signierer = await subtle().importKey('jwk', jwk, ALGO, false, ['sign']);
  return {
    gid,
    publicJwk,
    async beweis(zweck, bezug, jetzt) {
      const sig = await subtle().sign(SIGNATUR, signierer, new TextEncoder().encode(beweisText(zweck, bezug, jetzt)));
      return { gid, ts: jetzt, sig: b64url(sig) };
    },
  };
}

/** Neues Schlüsselpaar, verschlüsselt abgelegt; null, wenn Verschlüsseln oder Ablegen scheitert (dann nichts geschrieben). */
async function erzeuge(v: Verschluesseler, ablage: { schreib(b64: string): void }): Promise<GeraetHandle | null> {
  const paar = (await subtle().generateKey(ALGO, true, ['sign', 'verify'])) as CryptoKeyPair;
  const pkcs8 = Buffer.from(await subtle().exportKey('pkcs8', paar.privateKey)).toString('base64');
  let verschluesselt: string;
  try {
    verschluesselt = v.verschluesseln(pkcs8);
  } catch {
    return null;
  }
  ablage.schreib(verschluesselt);
  return handleAus(paar.privateKey);
}

/**
 * Geräteschlüssel laden oder beim ersten Mal erzeugen (EP7). Ohne Schlüsselspeicher → `kein-schluesselspeicher` und nichts
 * geschrieben. Gespeicherter Schlüssel unlesbar → neues Gerät (`neu-wegen-unlesbar`), der alte Eintrag wird überschrieben.
 */
export async function ladeOderErzeugeGeraet(
  v: Verschluesseler,
  ablage: { lies(): string | undefined; schreib(b64: string): void },
): Promise<GeraetLaden> {
  if (!v.verfuegbar()) return { art: 'kein-schluesselspeicher' };
  const gespeichert = ablage.lies();
  if (gespeichert) {
    try {
      const pkcs8 = Buffer.from(v.entschluesseln(gespeichert), 'base64');
      const privat = await subtle().importKey('pkcs8', pkcs8, ALGO, true, ['sign']);
      return { art: 'ok', geraet: await handleAus(privat), neu: false };
    } catch {
      const neu = await erzeuge(v, ablage);
      return neu ? { art: 'neu-wegen-unlesbar', geraet: neu } : { art: 'kein-schluesselspeicher' };
    }
  }
  const neu = await erzeuge(v, ablage);
  return neu ? { art: 'ok', geraet: neu, neu: true } : { art: 'kein-schluesselspeicher' };
}

// ── Ende des Moduls ──
