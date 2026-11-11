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
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { getLog } from '@jm/app-runtime';
import type { ProxyKeySource, ZoomSlotEinstellung, ZoomSlotVorgaben, ZoomSprecherEinstellung } from '@shared/types';
import { ANZEIGENAME_VORGABE } from './zoom/kern';
import {
  gueltigerAnzeigename,
  gueltigerVersatz,
  gueltigeLetzteNummer,
  normiereSlots,
  normiereSprecher,
  normiereVorgaben,
  sicherungsName,
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
  /** Zoom-Slots (Spec 7.2): Fassung des Slot-Formats, beim Schreiben 1; fehlt = 1. */
  zoomSlotsFassung?: number;
  /** Höchstens 16 dauerhafte Slots, nie ein vorübergehender; gelesen nur über normiereSlots (zoom/einstellungen.ts). */
  zoomSlots?: unknown;
  /** `{ aufloesung, tonAn }`; fehlt = 720p, Ton an. */
  zoomSlotVorgaben?: unknown;
  /** `{ signal, haltezeitMs }`; fehlt = sprecherVideo, 1000. */
  zoomSprecher?: unknown;
  /** Schalter „Vorschau“; fehlt = an. */
  zoomVorschau?: unknown;
  /** Zustimmung zu mehr als 5 eingeschalteten Slots (E4); fehlt = aus. */
  zoomSlotsUeber5?: unknown;
  /** Zuletzt benutzte Meeting-Nummer (#290); bleibt, bis eine neue eingegeben wird. */
  zoomLetzteNummer?: string;
  /** Kenncode dazu, safeStorage-verschlüsselt, base64. Nie im Klartext; ohne Schlüsselbund fehlt er. */
  zoomLetzterKenncodeEnc?: string;
}

/** Nur belegt, wenn kein OS-Schlüsselbund da ist: dann lebt der Key nur für diese Sitzung. */
let sessionKey: string | null = null;
let warned = false;

function file(): string {
  return join(app.getPath('userData'), 'connect-settings.json');
}

/**
 * Beim Lesen unlesbar gesehen (Spec 7.2, 0.17; B-EP11): Zeitpunkt für den Namen der Sicherungskopie. Das nächste write()
 * benennt die Datei vorher um. `null` = nichts zu sichern.
 */
let unlesbarSeit: Date | null = null;
/** Name der Sicherungskopie dieser Sitzung (T90, einstellungsLage); bleibt bis zum Beenden. */
let gesichertAls: string | null = null;

function read(): Stored {
  try {
    const p = file();
    if (!existsSync(p)) return {};
    const inhalt: unknown = JSON.parse(readFileSync(p, 'utf8'));
    if (typeof inhalt === 'object' && inhalt !== null && !Array.isArray(inhalt)) return inhalt as Stored;
  } catch {
    // nicht lesbar oder kein JSON: unten
  }
  // Beschädigt (auch gültiges JSON, das kein Objekt ist) → wie „nichts hinterlegt“. Das nächste write() sichert die Datei
  // vorher, statt sie still zu überschreiben (Spec 0.17, T90).
  unlesbarSeit ??= new Date();
  return {};
}

/**
 * `false`, wenn nichts auf der Platte gelandet ist; wer davon eine Anzeige abhängig macht, muss das prüfen. War die Datei
 * beim Lesen unlesbar, wird sie vorher zur Sicherungskopie umbenannt (Spec 7.2); scheitert das, wird nicht geschrieben.
 */
function write(next: Stored): boolean {
  try {
    const p = file();
    mkdirSync(dirname(p), { recursive: true });
    if (unlesbarSeit !== null) {
      if (existsSync(p)) {
        const name = sicherungsName(unlesbarSeit, (n) => existsSync(join(dirname(p), n)));
        renameSync(p, join(dirname(p), name));
        gesichertAls = name;
        getLog().warn(`[connect] Einstellungsdatei war unlesbar, gesichert als ${name}`);
      }
      unlesbarSeit = null;
    }
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

/**
 * Für diese Sitzung sind die Zugangsdaten danach immer weg. `false`: Sie stehen noch in der Einstellungsdatei
 * (nicht schreibbar) und gelten nach einem Neustart wieder; das muss der Kern sagen. Stand nichts auf der Platte,
 * ist ein gescheitertes Schreiben egal.
 */
export function zoomZugangLoeschen(): boolean {
  const next = read();
  const aufPlatte = next.zoomZugangEnc !== undefined;
  delete next.zoomZugangEnc;
  const geschrieben = write(next);
  zoomSitzung = null;
  zoomSitzungGrund = undefined;
  zoomGespeichert = null;
  return geschrieben || !aufPlatte;
}

// ── Letztes Meeting (#290) ──────────────────────────────────────────────────────────────────
// Nummer im Klartext, Kenncode nur verschlüsselt (safeStorage); ohne Schlüsselbund bleibt nur die Nummer.
// Kein Zwischenspeicher hier (der Kern hält ihn). Nie Nummer oder Kenncode ins Log.

/** `null`, wenn keine gültige Nummer gespeichert ist; Kenncode `null`, wenn keiner da oder nicht entschlüsselbar. */
export function zoomLetztesMeeting(): { nummer: string; kenncode: string | null } | null {
  const st = read();
  const nummer = gueltigeLetzteNummer(st.zoomLetzteNummer);
  if (nummer === null) return null;
  return { nummer, kenncode: decryptKey(st.zoomLetzterKenncodeEnc) };
}

/**
 * `kenncodeGespeichert`: der Kenncode liegt verschlüsselt auf der Platte. Wirft nie: Ein Fehler beim Verschlüsseln darf das
 * Beitreten nicht blockieren, dann bleibt nur die Nummer. Eine ungültige Nummer (gueltigeLetzteNummer) löscht beide Felder.
 */
export function zoomMeetingMerken(nummer: string, kenncode: string): { kenncodeGespeichert: boolean } {
  const next = read();
  const n = gueltigeLetzteNummer(nummer);
  if (n === null) {
    // Nichts Altes stehen lassen: Nummer und Kenncode von früher gehörten nicht zu diesem Beitritt.
    delete next.zoomLetzteNummer;
    delete next.zoomLetzterKenncodeEnc;
    if (!write(next)) getLog().warn('[zoom] Das letzte Meeting konnte nicht entfernt werden.');
    return { kenncodeGespeichert: false };
  }
  next.zoomLetzteNummer = n;
  let verschluesselt = false;
  if (kenncode !== '') {
    try {
      if (safeStorage.isEncryptionAvailable()) {
        next.zoomLetzterKenncodeEnc = safeStorage.encryptString(kenncode).toString('base64');
        verschluesselt = true;
      }
    } catch {
      getLog().warn('[zoom] Kenncode ließ sich nicht verschlüsseln – nur die Nummer gespeichert.');
    }
  }
  // Nie ein alter Kenncode zur neuen Nummer.
  if (!verschluesselt) delete next.zoomLetzterKenncodeEnc;
  if (write(next)) return { kenncodeGespeichert: verschluesselt };
  getLog().warn('[zoom] Das letzte Meeting konnte nicht gespeichert werden.');
  return { kenncodeGespeichert: false };
}

/**
 * Wie zoomZugangLoeschen: `true` = von der Platte gelöscht oder nichts da; `false` = Nummer oder Kenncode stehen noch in der
 * (nicht schreibbaren) Einstellungsdatei und kämen nach einem Neustart wieder. Das muss der Kern sagen.
 */
export function zoomMeetingVergessen(): boolean {
  const next = read();
  const aufPlatte = next.zoomLetzteNummer !== undefined || next.zoomLetzterKenncodeEnc !== undefined;
  delete next.zoomLetzteNummer;
  delete next.zoomLetzterKenncodeEnc;
  const geschrieben = write(next);
  if (!geschrieben && aufPlatte) getLog().warn('[zoom] Das letzte Meeting konnte nicht entfernt werden.');
  return geschrieben || !aufPlatte;
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

/** true = in connect-settings.json gespeichert; false = nur für diese Sitzung (Datei nicht schreibbar) oder ungültig. */
export function setzeZoomVersatzMs(ms: number): boolean {
  const v = gueltigerVersatz(ms);
  if (v === null) return false; // der Kern prüft vorher (Q13)
  const next = read();
  next.zoomVersatzMs = v;
  const gespeichert = write(next);
  zoomVersatzSitzung = gespeichert ? null : v;
  return gespeichert;
}

/** Der geltende Versatz steht nur im Arbeitsspeicher (N4b.3 Nr. 4). */
export function zoomVersatzNurSitzung(): boolean {
  return zoomVersatzSitzung !== null;
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

/** Wie zoomZugangLoeschen: `false`, wenn der Schlüssel noch in der (nicht schreibbaren) Einstellungsdatei steht. */
export function zoomSdkSchluesselLoeschen(): boolean {
  const next = read();
  const aufPlatte = next.zoomSdkKeyEnc !== undefined;
  delete next.zoomSdkKeyEnc;
  const geschrieben = write(next);
  zoomSdkGespeichert = null;
  zoomSdkSitzung = null;
  return geschrieben || !aufPlatte;
}

// ── Zoom-Slots (Connect 0.4.0, Spec 7.2; Plan B, Task B4) ─────────────────────────────────────
// Gelesen wird bei jedem Aufruf neu und nur über die Normierer aus zoom/einstellungen.ts (ein Konstruktor je Typ, 7.10).
// Scheitert das Schreiben, gilt der Wert nur für diese Sitzung (Muster Versatz, T92): Der Getter liefert ihn, der Setter
// meldet false. Vorübergehende Slots und `anNurMeeting` filtert der Kern vorher mit slotsFuerPlatte (einstellungen.ts).

let zoomSlotsSitzung: ZoomSlotEinstellung[] | null = null;
let zoomSlotVorgabenSitzung: ZoomSlotVorgaben | null = null;
let zoomSprecherSitzung: ZoomSprecherEinstellung | null = null;
let zoomVorschauSitzung: boolean | null = null;
let zoomSlotsUeber5Sitzung: boolean | null = null;
/** Zahl der beim Lesen verworfenen Slots (T91); bleibt bis zum Beenden, auch wenn ein späteres Schreiben die Datei bereinigt. */
let zoomSlotsVerworfen = 0;

/** Ein Feld setzen und die ganze Datei schreiben; `true` = auf der Platte. */
function schreibeFeld(setze: (s: Stored) => void): boolean {
  const next = read();
  setze(next);
  return write(next);
}

/** Gespeicherte (dauerhafte) Slots nach Nummer; was normiereSlots verwirft, zählt einstellungsLage() (T91). */
export function zoomSlots(): ZoomSlotEinstellung[] {
  if (zoomSlotsSitzung !== null) return zoomSlotsSitzung.map((s) => ({ ...s }));
  const { slots, verworfen } = normiereSlots(read().zoomSlots);
  if (verworfen > 0) {
    zoomSlotsVerworfen = verworfen;
    getLog().warn(`[zoom] ${verworfen} gespeicherte Slots verworfen (unvollständig oder doppelt)`);
  }
  return slots;
}

/** Schreibt `zoomSlotsFassung` 1 und die Slots durch normiereSlots. `false` = nur für diese Sitzung (T92). */
export function setzeZoomSlots(s: readonly ZoomSlotEinstellung[]): boolean {
  const { slots } = normiereSlots(s);
  const ok = schreibeFeld((st) => {
    st.zoomSlotsFassung = 1;
    st.zoomSlots = slots;
  });
  zoomSlotsSitzung = ok ? null : slots;
  return ok;
}

/** Vorgaben für neue Slots (7.6); fehlt oder ungültig = 720p, Ton an. */
export function zoomSlotVorgaben(): ZoomSlotVorgaben {
  return zoomSlotVorgabenSitzung ?? normiereVorgaben(read().zoomSlotVorgaben);
}

export function setzeZoomSlotVorgaben(v: ZoomSlotVorgaben): boolean {
  const n = normiereVorgaben(v);
  const ok = schreibeFeld((st) => {
    st.zoomSlotVorgaben = n;
  });
  zoomSlotVorgabenSitzung = ok ? null : n;
  return ok;
}

/** Sprecher-Einstellungen (7.6); fehlt oder ungültig = sprecherVideo, 1000 ms. Die Haltezeit prüft der Kern vorher (T74). */
export function zoomSprecher(): ZoomSprecherEinstellung {
  return zoomSprecherSitzung ?? normiereSprecher(read().zoomSprecher);
}

export function setzeZoomSprecher(s: ZoomSprecherEinstellung): boolean {
  const n = normiereSprecher(s);
  const ok = schreibeFeld((st) => {
    st.zoomSprecher = n;
  });
  zoomSprecherSitzung = ok ? null : n;
  return ok;
}

/** Schalter „Vorschau“ (7.7); fehlt = an. */
export function zoomVorschau(): boolean {
  if (zoomVorschauSitzung !== null) return zoomVorschauSitzung;
  const v = read().zoomVorschau;
  return typeof v === 'boolean' ? v : true;
}

export function setzeZoomVorschau(an: boolean): boolean {
  const ok = schreibeFeld((st) => {
    st.zoomVorschau = an;
  });
  zoomVorschauSitzung = ok ? null : an;
  return ok;
}

/** Zustimmung zu mehr als 5 eingeschalteten Slots (E4, 7.4); fehlt = aus. */
export function zoomSlotsUeber5(): boolean {
  if (zoomSlotsUeber5Sitzung !== null) return zoomSlotsUeber5Sitzung;
  const v = read().zoomSlotsUeber5;
  return typeof v === 'boolean' ? v : false;
}

export function setzeZoomSlotsUeber5(an: boolean): boolean {
  const ok = schreibeFeld((st) => {
    st.zoomSlotsUeber5 = an;
  });
  zoomSlotsUeber5Sitzung = ok ? null : an;
  return ok;
}

/**
 * Lage der Einstellungsdatei für T90 (`gesichert`: Sicherungskopie dieser Sitzung), T91 (`verworfen`) und T92 (`nurSitzung`),
 * Spec 7.2. `nurSitzung` (Nachtrag B, NB9): Für irgendein Slot-Feld gilt ein Sitzungswert, weil sein letztes Schreiben
 * scheiterte. Jeder Setter hebt nur seinen eigenen auf; ein späteres erfolgreiches Schreiben eines anderen Felds ändert daran nichts.
 */
export function einstellungsLage(): { gesichert: string | null; verworfen: number; nurSitzung: boolean } {
  const nurSitzung = zoomSlotsSitzung !== null || zoomSlotVorgabenSitzung !== null || zoomSprecherSitzung !== null
    || zoomVorschauSitzung !== null || zoomSlotsUeber5Sitzung !== null;
  return { gesichert: gesichertAls, verworfen: zoomSlotsVerworfen, nurSitzung };
}
