// Reine Regeln für die Zoom-Felder in connect-settings.json (Spec 5.6): gültige Werte, Zugangsdaten
// aus der Umgebung, Inhalt von zoomZugangEnc, Rangfolge der Herkünfte. Ohne Electron, damit `tsx`
// sie prüfen kann; settings.ts bringt nur Datei, safeStorage und Sitzung dazu.
import { readCredentials } from '@jm/zoom-bridge';
import { SLOT_NR_MAX, SPEAKER_HOLD_MAX_MS } from '@jm/zoom-bridge/protocol';
import type {
  ZoomSlotAufloesung, ZoomSlotEinstellung, ZoomSlotErsatzbild, ZoomSlotModus, ZoomSlotTonArt, ZoomSlotVorgaben, ZoomSprecherEinstellung,
  ZoomSprecherSignal,
} from '../../shared/types';
import { HALTEZEIT_UNGUELTIG, NDI_NAME_MAX, NDI_NAME_TEXT } from '../../shared/zoom-text';
import type { ZugangDaten, ZugangStand } from './kern';
import { gleicherNdiName, NDI_PRAEFIX } from './teilnehmer';

/** Was in zoomZugangEnc steht, nach dem Entschlüsseln. */
export interface GespeicherterZugang {
  daten: ZugangDaten | null;
  /** zoomZugangEnc ist da, lässt sich aber nicht entschlüsseln oder ist kaputt (A5). */
  unlesbar: boolean;
}

/** 1 bis 64 Zeichen nach `trim` (G4), sonst `null`. Der Aufrufer setzt dann die Vorgabe „JM Connect“. */
export function gueltigerAnzeigename(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length >= 1 && t.length <= 64 ? t : null;
}

/** Ganze Zahl 0 bis 1000 (G4), sonst `null`. Der Aufrufer setzt dann 0. */
export function gueltigerVersatz(v: unknown): number | null {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 1000 ? v : null;
}

/**
 * Zugangsdaten aus der Umgebung: ZOOM_SDK_CLIENT_ID + ZOOM_SDK_CLIENT_SECRET oder ZOOM_SDK_CREDENTIALS
 * (Entwicklungsweg, Herkunft 'env', Spec 5.6). Ohne jede dieser Variablen: keine Daten, kein Fehler.
 * `fehler` nennt nie einen Wert: readCredentials zitiert weder das Secret noch den Dateiinhalt.
 */
export function zugangAusUmgebung(env: Record<string, string | undefined>): { daten: ZugangDaten | null; fehler: string | null } {
  if (!env.ZOOM_SDK_CLIENT_ID && !env.ZOOM_SDK_CLIENT_SECRET && !env.ZOOM_SDK_CREDENTIALS) {
    return { daten: null, fehler: null };
  }
  try {
    const { clientId, clientSecret } = readCredentials(env);
    return { daten: { clientId, clientSecret }, fehler: null };
  } catch (e) {
    return { daten: null, fehler: e instanceof Error ? e.message : String(e) };
  }
}

/** Inhalt von zoomZugangEnc nach dem Entschlüsseln. `klartext === null` heißt: nicht entschlüsselbar. */
export function zugangAusKlartext(klartext: string | null): GespeicherterZugang {
  if (klartext !== null) {
    try {
      const j = JSON.parse(klartext) as { clientId?: unknown; clientSecret?: unknown } | null;
      if (j && typeof j.clientId === 'string' && j.clientId && typeof j.clientSecret === 'string' && j.clientSecret) {
        return { daten: { clientId: j.clientId, clientSecret: j.clientSecret }, unlesbar: false };
      }
    } catch {
      // kaputt → unten „unlesbar“; der Inhalt geht nirgendwohin (G5)
    }
  }
  return { daten: null, unlesbar: true };
}

/** Rangfolge Umgebung > Gespeichertes > Sitzung (Spec 5.6, wie beim Proxy-Key in settings.ts). */
export function waehleZugang(e: {
  umgebung: ZugangDaten | null;
  gespeichert: GespeicherterZugang | null;
  sitzung: ZugangDaten | null;
}): ZugangStand {
  if (e.umgebung) return { daten: e.umgebung, herkunft: 'env', unlesbar: false };
  if (e.gespeichert?.daten) return { daten: e.gespeichert.daten, herkunft: 'stored', unlesbar: false };
  if (e.sitzung) return { daten: e.sitzung, herkunft: 'session', unlesbar: false };
  return { daten: null, herkunft: 'none', unlesbar: e.gespeichert?.unlesbar === true };
}

// ── Zoom-Slots (Connect 0.4.0; Spec 7.2, 7.6, E26; Plan B, Task B3): Werte, Normierung, Namensregeln, Haltezeit ──

/** Erlaubte Werte je Aufzählung (Spec 7.1). Ein Record macht eine vergessene Variante zum Typfehler. */
const MODI: Record<ZoomSlotModus, true> = { teilnehmer: true, sprecher: true, freigabe: true };
const AUFLOESUNGEN: Record<ZoomSlotAufloesung, true> = { '360p': true, '720p': true, '1080p': true };
const ERSATZBILDER: Record<ZoomSlotErsatzbild, true> = { transparent: true, eingefroren: true, schwarz: true, weiss: true };
const TONARTEN: Record<ZoomSlotTonArt, true> = { mischton: true, person: true };
const SIGNALE: Record<ZoomSprecherSignal, true> = { sprecherVideo: true, aktivesVideo: true, tonAktiv: true };
const istIn = <T extends string>(werte: Record<T, true>, v: unknown): v is T => typeof v === 'string' && Object.hasOwn(werte, v);
export const istSlotModus = (v: unknown): v is ZoomSlotModus => istIn(MODI, v);
export const istSlotAufloesung = (v: unknown): v is ZoomSlotAufloesung => istIn(AUFLOESUNGEN, v);
export const istSlotErsatzbild = (v: unknown): v is ZoomSlotErsatzbild => istIn(ERSATZBILDER, v);
export const istSlotTonArt = (v: unknown): v is ZoomSlotTonArt => istIn(TONARTEN, v);
export const istSprecherSignal = (v: unknown): v is ZoomSprecherSignal => istIn(SIGNALE, v);
const istObjekt = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Spec 7.2 (Tabelle `Stored`, „fehlt =“): Vorgaben 720p (E7) und Ton an; Sprecher-Signal sprecherVideo, Haltezeit 1000 ms. */
export const SLOT_VORGABEN_VORGABE: Readonly<ZoomSlotVorgaben> = { aufloesung: '720p', tonAn: true };
export const SPRECHER_VORGABE: Readonly<ZoomSprecherEinstellung> = { signal: 'sprecherVideo', haltezeitMs: 1000 };

/** Länge in Unicode-Code-Punkten (E26, B26): ein Emoji außerhalb der BMP zählt 1, wie in der Bridge. */
export function codePunkte(s: string): number {
  return [...s].length;
}
/** Auf höchstens `max` Code-Punkte gekürzt, nie mitten in einem Ersatzpaar. */
function kuerze(s: string, max: number): string {
  return [...s].slice(0, max).join('');
}
/** Steuerzeichen (Unicode-Kategorie Cc: U+0000–U+001F, U+007F–U+009F); die Bridge lehnt sie im NDI-Namen ab (E26). */
const STEUERZEICHEN = /\p{Cc}/u;
const STEUERZEICHEN_ALLE = /\p{Cc}/gu;

/**
 * `grund` auf NDI_NAME_MAX Code-Punkte gekürzt und eindeutig unter `belegt` nach gleicherNdiName (NFC, ohne Groß- und
 * Kleinschreibung): sonst „ (2)“, „ (3)“ …, mit Platz für den Zusatz vor dem Kürzen (Spec 7.2, 7.6).
 */
function freierName(grund: string, belegt: readonly string[]): string {
  for (let n = 1; ; n++) {
    const zusatz = n === 1 ? '' : ` (${n})`;
    const kandidat = kuerze(grund, NDI_NAME_MAX - codePunkte(zusatz)) + zusatz;
    if (!belegt.some((b) => gleicherNdiName(b, kandidat))) return kandidat;
  }
}

/** Form eines NDI-Namens (E26): Länge 1–60 Code-Punkte (T43), kein „:“ (T44), keine Steuerzeichen (T47); null = in Ordnung. */
function ndiNameFormFehler(name: string): string | null {
  const n = codePunkte(name);
  if (n < 1 || n > NDI_NAME_MAX) return NDI_NAME_TEXT.laenge;
  if (name.includes(':')) return NDI_NAME_TEXT.doppelpunkt;
  if (STEUERZEICHEN.test(name)) return NDI_NAME_TEXT.steuerzeichen;
  return null;
}

/** `fehler` ∈ {T43, T44, T45, T47} verhindert das Speichern; `warnung` (T46) nicht. */
export interface NdiNamensPruefung { fehler: string | null; warnung: string | null }

/**
 * NDI-Name eines Slots (Spec E26, 0.22, PK24): erst die Form (T43, T44, T47), dann eindeutig unter den anderen Slots nach
 * gleicherNdiName (T45 nennt die kleinste Nummer). Gleichheit mit einem Browser-Gast ist nur eine Warnung (T46), das
 * Speichern gelingt. Der eigene Slot (`nr`) zählt nicht als Doppel.
 */
export function pruefeNdiName(
  name: string, nr: number, andere: readonly { nr: number; ndiName: string }[], gastNamen: readonly string[],
): NdiNamensPruefung {
  const form = ndiNameFormFehler(name);
  if (form !== null) return { fehler: form, warnung: null };
  const belegt = andere.filter((a) => a.nr !== nr && gleicherNdiName(a.ndiName, name)).map((a) => a.nr).sort((a, b) => a - b);
  if (belegt.length > 0) return { fehler: NDI_NAME_TEXT.doppelt(belegt[0]), warnung: null };
  return { fehler: null, warnung: gastNamen.some((g) => gleicherNdiName(g, name)) ? NDI_NAME_TEXT.gast(name) : null };
}

/**
 * Übergangs-Namensregel (Spec 7.2, E13; B22, B79a, Nachfix W4, PK35): „JM Connect – Zoom “ + Anzeigename; jedes „:“ wird
 * ein Leerzeichen (wie NDI in 0.3.0), Steuerzeichen fallen weg, sonst bleibt der Anzeigename unverändert (auch doppelte,
 * führende und abschließende Leerzeichen); höchstens 60 Code-Punkte; Kollision mit irgendeinem Slot (`belegt`) → „ (2)“ …
 */
export function uebergangsNdiName(anzeigename: string, belegt: readonly string[]): string {
  return freierName(NDI_PRAEFIX + anzeigename.replace(/:/g, ' ').replace(STEUERZEICHEN_ALLE, ''), belegt);
}

/**
 * Neuer Slot (Spec 7.6, 0.22, 0.28): Modus Teilnehmer, keine Person, Ersatzbild transparent, Tonart Mischton, Computerton
 * an, ohne Kamera an, Start aus, Auflösung und Ton aus den Vorgaben; NDI-Name „Zoom {nr}“, bei Kollision „Zoom {nr} (2)“ …
 * „Als Slot laden“ und `zoom_load` (Task B13) setzen danach Person, Übergangsnamen und Start-Taste.
 */
export function neuerSlot(nr: number, v: ZoomSlotVorgaben, belegteNamen: readonly string[]): ZoomSlotEinstellung {
  return {
    nr, ndiName: freierName(`Zoom ${nr}`, belegteNamen), modus: 'teilnehmer', person: '', an: false, aufloesung: v.aufloesung,
    ersatzbild: 'transparent', tonAn: v.tonAn, tonArt: 'mischton', computerton: true, ohneKamera: true,
  };
}

/**
 * Der eine Konstruktor von ZoomSlotEinstellung (Spec 7.2 „Lesen“, 7.10): unbekannte oder fehlende Werte → Vorgabe eines
 * neuen Slots (7.6). Verworfen (`null`) wird ein Eintrag ohne Nummer 1–16 oder ohne gültigen NDI-Namen (E26): Ein
 * ungültiger Name wird nicht still ersetzt, sonst verlöre ein Bildmischer-Eingang seine Quelle (T91 nennt die Zahl).
 * Genau die elf Felder; fremde fallen weg.
 */
export function normiereSlot(roh: unknown): ZoomSlotEinstellung | null {
  if (!istObjekt(roh)) return null;
  const { nr, ndiName, modus, person, an, aufloesung, ersatzbild, tonAn, tonArt, computerton, ohneKamera } = roh;
  if (typeof nr !== 'number' || !Number.isInteger(nr) || nr < 1 || nr > SLOT_NR_MAX) return null;
  if (typeof ndiName !== 'string' || ndiNameFormFehler(ndiName) !== null) return null;
  return {
    nr,
    ndiName,
    modus: istSlotModus(modus) ? modus : 'teilnehmer',
    person: typeof person === 'string' ? person : '',
    an: typeof an === 'boolean' ? an : false,
    aufloesung: istSlotAufloesung(aufloesung) ? aufloesung : SLOT_VORGABEN_VORGABE.aufloesung,
    ersatzbild: istSlotErsatzbild(ersatzbild) ? ersatzbild : 'transparent',
    tonAn: typeof tonAn === 'boolean' ? tonAn : SLOT_VORGABEN_VORGABE.tonAn,
    tonArt: istSlotTonArt(tonArt) ? tonArt : 'mischton',
    computerton: typeof computerton === 'boolean' ? computerton : true,
    ohneKamera: typeof ohneKamera === 'boolean' ? ohneKamera : true,
  };
}

/**
 * Spec 7.2 „Lesen“: jede Zeile durch normiereSlot; doppelte Nummer oder doppelter NDI-Name (gleicherNdiName) → verworfen,
 * der erste Eintrag gilt; nach Nummer sortiert. Fehlt das Feld, ist nichts verworfen; ist es da, aber kein Array, zählt
 * es als ein verworfener Eintrag (T91 statt stillen Verlusts).
 */
export function normiereSlots(roh: unknown): { slots: ZoomSlotEinstellung[]; verworfen: number } {
  if (roh === undefined || roh === null) return { slots: [], verworfen: 0 };
  if (!Array.isArray(roh)) return { slots: [], verworfen: 1 };
  const slots: ZoomSlotEinstellung[] = [];
  let verworfen = 0;
  for (const r of roh as unknown[]) {
    const s = normiereSlot(r);
    if (s === null || slots.some((x) => x.nr === s.nr || gleicherNdiName(x.ndiName, s.ndiName))) verworfen++;
    else slots.push(s);
  }
  return { slots: slots.sort((a, b) => a.nr - b.nr), verworfen };
}

/** `zoomSlotVorgaben` (Spec 7.2, 7.6): unbekannte Werte → 720p bzw. Ton an. */
export function normiereVorgaben(roh: unknown): ZoomSlotVorgaben {
  const o: Record<string, unknown> = istObjekt(roh) ? roh : {};
  return {
    aufloesung: istSlotAufloesung(o.aufloesung) ? o.aufloesung : SLOT_VORGABEN_VORGABE.aufloesung,
    tonAn: typeof o.tonAn === 'boolean' ? o.tonAn : SLOT_VORGABEN_VORGABE.tonAn,
  };
}

/** `zoomSprecher` (Spec 7.2, 7.6): unbekanntes Signal → sprecherVideo; Haltezeit nach pruefeHaltezeit, sonst 1000 ms. */
export function normiereSprecher(roh: unknown): ZoomSprecherEinstellung {
  const o: Record<string, unknown> = istObjekt(roh) ? roh : {};
  const ms = o.haltezeitMs;
  return {
    signal: istSprecherSignal(o.signal) ? o.signal : SPRECHER_VORGABE.signal,
    haltezeitMs: typeof ms === 'number' && pruefeHaltezeit(ms) === null ? ms : SPRECHER_VORGABE.haltezeitMs,
  };
}

/** Haltezeit-Prüfregel (Spec 7.6, KF7): 0 bis SPEAKER_HOLD_MAX_MS in Schritten von 100 ms, sonst T74. */
export function pruefeHaltezeit(ms: number): string | null {
  return Number.isInteger(ms) && ms >= 0 && ms <= SPEAKER_HOLD_MAX_MS && ms % 100 === 0 ? null : HALTEZEIT_UNGUELTIG;
}

/**
 * Was auf die Platte darf (Spec 7.2, 0.14, RR7): nie ein vorübergehender Slot (also auch kein Anzeigename aus `zoom_load`);
 * ein dauerhafter Slot mit `anNurMeeting` steht mit `an: false` dort. Der Kern (Task B12, B13) gibt setzeZoomSlots nur
 * dieses Ergebnis.
 */
export function slotsFuerPlatte(l: readonly { e: ZoomSlotEinstellung; voruebergehend: boolean; anNurMeeting: boolean }[]): ZoomSlotEinstellung[] {
  return l.filter((x) => !x.voruebergehend).map((x) => (x.anNurMeeting ? { ...x.e, an: false } : { ...x.e }));
}

/**
 * Name der Sicherungskopie einer unlesbaren Einstellungsdatei (Spec 7.2, 0.17): `connect-settings.unlesbar-<JJJJMMTT-hhmmss>.json`
 * nach der Ortszeit von `zeit`, im selben Ordner. Ist der Name schon vergeben (`gibtEs`), folgen „-2“, „-3“ …, damit keine
 * Sicherung eine andere überschreibt.
 */
export function sicherungsName(zeit: Date, gibtEs: (name: string) => boolean): string {
  const zz = (n: number, stellen = 2): string => String(n).padStart(stellen, '0');
  const stempel = `${zz(zeit.getFullYear(), 4)}${zz(zeit.getMonth() + 1)}${zz(zeit.getDate())}-${zz(zeit.getHours())}${zz(zeit.getMinutes())}${zz(zeit.getSeconds())}`;
  for (let n = 1; ; n++) {
    const name = `connect-settings.unlesbar-${stempel}${n === 1 ? '' : `-${n}`}.json`;
    if (!gibtEs(name)) return name;
  }
}

// ── Ende des Moduls ──
