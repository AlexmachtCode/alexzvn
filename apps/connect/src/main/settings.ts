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
import { getLog } from '@jm/app-runtime';
import type { ProxyKeySource } from '@shared/types';
import { ANZEIGENAME_VORGABE } from './zoom/kern';
import {
  gueltigerAnzeigename,
  gueltigerVersatz,
  waehleZugang,
  zugangAusKlartext,
  zugangAusUmgebung,
  type GespeicherterZugang,
} from './zoom/einstellungen';

/** Öffentlicher Suite-Proxy — dieselbe Adresse, die der Launcher als Vorgabe nutzt. */
export const DEFAULT_PROXY_URL = 'https://jm-suite-proxy.jm-production-suite.workers.dev';

interface Stored {
  proxyUrl?: string;
  /** PROXY_KEY, safeStorage-verschlüsselt, base64. Nie im Klartext. */
  proxyKeyEnc?: string;
  /** Zoom: safeStorage(JSON { clientId, clientSecret }), base64. Nie im Klartext (Spec 5.6). */
  zoomZugangEnc?: string;
  /** Zoom: Laufzeit-Ordner und Fassung, nach erfolgreicher Einrichtung. */
  zoomLaufzeit?: { dir: string; fassung: string; eingerichtetAm: string };
  /** Zoom: 1 bis 64 Zeichen; fehlt = „JM Connect“. */
  zoomAnzeigename?: string;
  /** Zoom: ganze Zahl 0 bis 1000; fehlt = 0. */
  zoomVersatzMs?: number;
  /** Zoom: SDK-Schlüssel für „Zoom-SDK laden“, safeStorage-verschlüsselt, base64. Nie im Klartext (Spec SDK nachladen 4.2). */
  zoomSdkKeyEnc?: string;
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

/** `false`, wenn nichts auf der Platte gelandet ist; wer davon eine Anzeige abhängig macht, muss das prüfen. */
function write(next: Stored): boolean {
  try {
    const p = file();
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, JSON.stringify(next, null, 2) + '\n', { mode: 0o600 });
    return true;
  } catch (e) {
    getLog().error('[connect] Einstellungen konnten nicht gespeichert werden:', e instanceof Error ? e.message : e);
    return false;
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
    getLog().warn('[connect] safeStorage nicht verfügbar — der Proxy-Key wird nur für diese Sitzung gehalten.');
  }
}

// ── Zoom (Stage 4, Spec 5.6) ────────────────────────────────────────────────────────────────
// Zugangsdaten der Meeting-SDK-App: Umgebung > gespeichert (safeStorage) > Sitzung, wie beim
// Proxy-Key. Die Regeln selbst stehen ohne Electron in zoom/einstellungen.ts (getestet); hier
// kommen nur Datei, safeStorage und die Sitzung dazu. Der Renderer erfährt nie die Werte, nur
// Herkunft und die letzten 4 Zeichen der Client-ID (rechnet der Kern aus, Spec 5.7).

export interface ZoomZugangDaten {
  clientId: string;
  clientSecret: string;
}

/** Nur ohne OS-Schlüsselbund belegt: dann gelten die Zugangsdaten nur für diese Sitzung (A4). */
let zoomSitzung: ZoomZugangDaten | null = null;
/** 'schreibfehler': die Sitzungsdaten gelten, obwohl ein Schlüsselbund da ist, weil die Einstellungsdatei nicht schreibbar war. */
let zoomSitzungGrund: 'schreibfehler' | undefined;
/** zoomZugangEnc, EINMAL entschlüsselt (Spec 6.1). `undefined` = noch nicht gelesen, `null` = nichts hinterlegt. */
let zoomGespeichert: GespeicherterZugang | null | undefined;
/** Gilt nur, solange das Schreiben der Platte scheiterte: sonst würde der Getter den alten Plattenwert zeigen. */
let zoomAnzeigenameSitzung: string | null = null;
let zoomVersatzSitzung: number | null = null;
let zoomUmgebungGewarnt = false;
let zoomSitzungGewarnt = false;

function zoomGespeichertLesen(): GespeicherterZugang | null {
  if (zoomGespeichert === undefined) {
    const enc = read().zoomZugangEnc;
    zoomGespeichert = enc ? zugangAusKlartext(decryptKey(enc)) : null;
  }
  return zoomGespeichert;
}

/** `unlesbar`: zoomZugangEnc ist da, lässt sich aber nicht entschlüsseln (Mangel zugang_unlesbar, A5). */
export function zoomZugangLesen(): { daten: ZoomZugangDaten | null; herkunft: ProxyKeySource; grund?: 'schreibfehler'; unlesbar: boolean } {
  const umgebung = zugangAusUmgebung(process.env);
  if (umgebung.fehler && !zoomUmgebungGewarnt) {
    zoomUmgebungGewarnt = true;
    getLog().warn('[zoom] Zugangsdaten aus der Umgebung unbrauchbar:', umgebung.fehler);
  }
  const stand = waehleZugang({ umgebung: umgebung.daten, gespeichert: zoomGespeichertLesen(), sitzung: zoomSitzung });
  return stand.herkunft === 'session' && zoomSitzungGrund ? { ...stand, grund: zoomSitzungGrund } : stand;
}

export function zoomZugangSpeichern(d: ZoomZugangDaten): 'stored' | 'session' {
  const daten = { clientId: d.clientId, clientSecret: d.clientSecret };
  const next = read();
  if (safeStorage.isEncryptionAvailable()) {
    next.zoomZugangEnc = safeStorage.encryptString(JSON.stringify(daten)).toString('base64');
    if (write(next)) {
      zoomSitzung = null;
      zoomSitzungGrund = undefined;
      zoomGespeichert = { daten, unlesbar: false };
      return 'stored';
    }
    // Nichts auf der Platte: ehrlich „nur für diese Sitzung“ (A4), nicht „gespeichert“.
    zoomGespeichert = null;
    zoomSitzung = daten;
    zoomSitzungGrund = 'schreibfehler';
    return 'session';
  }
  // Ohne Schlüsselbund NIE im Klartext auf die Platte (Spec 5.6, E7). Ein altes, hier nicht
  // entschlüsselbares zoomZugangEnc fliegt raus: die neue Wahl des Bedieners gilt.
  delete next.zoomZugangEnc;
  write(next);
  zoomGespeichert = null;
  zoomSitzung = daten;
  zoomSitzungGrund = undefined;
  if (!zoomSitzungGewarnt) {
    zoomSitzungGewarnt = true;
    getLog().warn('[zoom] safeStorage nicht verfügbar — die Zoom-Zugangsdaten gelten nur für diese Sitzung.');
  }
  return 'session';
}

export function zoomZugangLoeschen(): void {
  const next = read();
  delete next.zoomZugangEnc;
  write(next);
  zoomSitzung = null;
  zoomSitzungGrund = undefined;
  zoomGespeichert = null;
}

/** Ungültig oder fehlend → Vorgabe „JM Connect“ (G4). */
export function zoomAnzeigename(): string {
  return zoomAnzeigenameSitzung ?? gueltigerAnzeigename(read().zoomAnzeigename) ?? ANZEIGENAME_VORGABE;
}

export function setzeZoomAnzeigename(n: string): void {
  const v = gueltigerAnzeigename(n);
  if (v === null) return; // der Kern prüft vorher (N0b); Ungültiges wird nie gespeichert
  const next = read();
  next.zoomAnzeigename = v;
  zoomAnzeigenameSitzung = write(next) ? null : v;
}

/** Ungültig oder fehlend → 0 (G4). */
export function zoomVersatzMs(): number {
  return zoomVersatzSitzung ?? gueltigerVersatz(read().zoomVersatzMs) ?? 0;
}

export function setzeZoomVersatzMs(ms: number): void {
  const v = gueltigerVersatz(ms);
  if (v === null) return; // der Kern prüft vorher (Q13)
  const next = read();
  next.zoomVersatzMs = v;
  zoomVersatzSitzung = write(next) ? null : v;
}

export function setzeZoomLaufzeit(v: { dir: string; fassung: string; eingerichtetAm: string }): void {
  const next = read();
  next.zoomLaufzeit = { dir: v.dir, fassung: v.fassung, eingerichtetAm: v.eingerichtetAm };
  write(next);
}

// ── Zoom-SDK nachladen (Spec 2026-10-06, 4.2) ────────────────────────────────────────────────
// Eigener SDK-Schlüssel für GET /zoom-sdk/:fassung. Muster wie die Zugangsdaten: Umgebung
// JMPS_ZOOM_SDK_KEY > zoomSdkKeyEnc (safeStorage) > Sitzung. Ohne Schlüsselbund oder wenn die Datei
// nicht schreibbar ist, gilt er nur für diese Sitzung, nie im Klartext auf der Platte. Der Renderer
// erfährt nur die Herkunft (der Kern trägt sie ins Abbild), nie den Wert.

/** Nur belegt, wenn nichts auf der Platte gelandet ist. */
let zoomSdkSitzung: string | null = null;
/** zoomSdkKeyEnc, EINMAL entschlüsselt. `undefined` = noch nicht gelesen, `null` = nichts (oder nicht entschlüsselbar). */
let zoomSdkGespeichert: string | null | undefined;
let zoomSdkSitzungGewarnt = false;

function zoomSdkGespeichertLesen(): string | null {
  if (zoomSdkGespeichert === undefined) zoomSdkGespeichert = decryptKey(read().zoomSdkKeyEnc);
  return zoomSdkGespeichert;
}

export function zoomSdkSchluesselLesen(): { wert: string | null; herkunft: ProxyKeySource } {
  const env = (process.env.JMPS_ZOOM_SDK_KEY || '').trim();
  if (env) return { wert: env, herkunft: 'env' };
  const gespeichert = zoomSdkGespeichertLesen();
  if (gespeichert) return { wert: gespeichert, herkunft: 'stored' };
  if (zoomSdkSitzung) return { wert: zoomSdkSitzung, herkunft: 'session' };
  return { wert: null, herkunft: 'none' };
}

/** Der Kern hat getrimmt und geprüft (S18). 'session', wenn nichts auf der Platte gelandet ist. */
export function zoomSdkSchluesselSpeichern(wert: string): 'stored' | 'session' {
  const next = read();
  if (safeStorage.isEncryptionAvailable()) {
    next.zoomSdkKeyEnc = safeStorage.encryptString(wert).toString('base64');
    if (write(next)) {
      zoomSdkGespeichert = wert;
      zoomSdkSitzung = null;
      return 'stored';
    }
    // Nichts auf der Platte: ehrlich „nur für diese Sitzung“, und der neue Wert gilt, nicht ein alter von der Platte.
    zoomSdkGespeichert = null;
    zoomSdkSitzung = wert;
    return 'session';
  }
  // Ohne Schlüsselbund NIE im Klartext auf die Platte; ein altes, hier nicht entschlüsselbares Feld fliegt raus.
  delete next.zoomSdkKeyEnc;
  write(next);
  zoomSdkGespeichert = null;
  zoomSdkSitzung = wert;
  if (!zoomSdkSitzungGewarnt) {
    zoomSdkSitzungGewarnt = true;
    getLog().warn('[zoom] safeStorage nicht verfügbar — der SDK-Schlüssel gilt nur für diese Sitzung.');
  }
  return 'session';
}

export function zoomSdkSchluesselLoeschen(): void {
  const next = read();
  delete next.zoomSdkKeyEnc;
  write(next);
  zoomSdkGespeichert = null;
  zoomSdkSitzung = null;
}
