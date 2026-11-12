// Prüfung der Nutzlasten der Slot-Kanäle (IPC, Spec 7.9, 11.11 KF6), rein und ohne Electron (Muster zugang-eingabe.ts).
// Hier wird nur die FORM geprüft: erlaubte Felder, Typen, Wertebereiche. Regeln mit Text (NDI-Name T43–T47, Haltezeit T74,
// Nachfrage T40) prüft der Kern. Ungültig → die Hülle antwortet `{ ok: false, text: '' }` und ruft den Kern nicht (7.9).
// Gültig → `wert` ist eine neue Kopie mit genau den bekannten Feldern; die Hülle gibt sie unverändert an den Kern (KF5).
import { SLOT_NR_MAX } from '@jm/zoom-bridge/protocol';
import type { ZoomSlotEinstellung, ZoomSlotVorgaben, ZoomSprecherEinstellung } from '../../shared/types';
import { istSlotAufloesung, istSlotErsatzbild, istSlotModus, istSlotTonArt, istSprecherSignal } from './einstellungen';

/** Obergrenze je Zeichenkette (NDI-Name, Person); alles darüber ist keine Eingabe der Karte. */
export const SLOT_TEXT_MAX = 512;
/** Größte Teilnehmer-Kennung (Zooms `unsigned int`). */
const KENNUNG_MAX = 0xffffffff;

export type SlotKanal =
  | 'anlegen' | 'aendern' | 'loeschen' | 'start' | 'ausPerson' | 'person' | 'vorgaben' | 'sprecher' | 'vorschau' | 'messwerte'
  | 'behalten' | 'personImNdiNamen';
/** Teilmenge der Felder von ZoomSlotEinstellung ohne `nr` und `an` (Kanal `zoomSlotAendern`, 7.9). */
export type SlotAenderung = Partial<Omit<ZoomSlotEinstellung, 'nr' | 'an'>>;
/** Geprüfte Nutzlast je Kanal (Spec 7.9). */
export interface SlotEingabeWert {
  anlegen: Record<string, never>;
  aendern: { nr: number; aenderung: SlotAenderung };
  loeschen: { nr: number };
  start: { nr: number; an: boolean; trotz?: boolean };
  ausPerson: { teilnehmerId: number; trotz?: boolean };
  person: { nr: number; teilnehmerId: number };
  vorgaben: ZoomSlotVorgaben;
  sprecher: ZoomSprecherEinstellung;
  vorschau: { an: boolean };
  messwerte: Record<string, never>;
  behalten: { nr: number };
  /** Schalter „Person im NDI-Namen“ (#287). */
  personImNdiNamen: { an: boolean };
}

const istObjekt = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const nurFelder = (o: Record<string, unknown>, erlaubt: readonly string[]): boolean => Object.keys(o).every((k) => erlaubt.includes(k));
const istNr = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= SLOT_NR_MAX;
const istKennung = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= KENNUNG_MAX;
const istText = (v: unknown): v is string => typeof v === 'string' && v.length <= SLOT_TEXT_MAX;
const istBool = (v: unknown): v is boolean => typeof v === 'boolean';
const istTrotz = (v: unknown): v is boolean | undefined => v === undefined || typeof v === 'boolean';

/** Je änderbares Feld die Formprüfung; `nr` und `an` sind nicht änderbar (7.9). */
const AENDERBAR: { [K in keyof SlotAenderung]-?: (v: unknown) => boolean } = {
  ndiName: istText, modus: istSlotModus, person: istText, aufloesung: istSlotAufloesung, ersatzbild: istSlotErsatzbild,
  tonAn: istBool, tonArt: istSlotTonArt, computerton: istBool, ohneKamera: istBool,
};

function aenderung(roh: unknown): SlotAenderung | null {
  if (!istObjekt(roh)) return null;
  const a: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(roh)) {
    if (!Object.hasOwn(AENDERBAR, k) || !AENDERBAR[k as keyof SlotAenderung](v)) return null;
    a[k] = v;
  }
  return a as SlotAenderung;
}

function pruefe(kanal: SlotKanal, roh: unknown): SlotEingabeWert[SlotKanal] | null {
  if (!istObjekt(roh)) return null;
  const { nr, an, trotz, teilnehmerId, aufloesung, tonAn, signal, haltezeitMs } = roh;
  switch (kanal) {
    case 'anlegen':
    case 'messwerte':
      return Object.keys(roh).length === 0 ? {} : null;
    case 'aendern': {
      if (!nurFelder(roh, ['nr', 'aenderung']) || !istNr(nr)) return null;
      const a = aenderung(roh.aenderung);
      return a === null ? null : { nr, aenderung: a };
    }
    case 'loeschen':
    case 'behalten':
      return nurFelder(roh, ['nr']) && istNr(nr) ? { nr } : null;
    case 'start':
      if (!nurFelder(roh, ['nr', 'an', 'trotz']) || !istNr(nr) || !istBool(an) || !istTrotz(trotz)) return null;
      return trotz === undefined ? { nr, an } : { nr, an, trotz };
    case 'ausPerson':
      if (!nurFelder(roh, ['teilnehmerId', 'trotz']) || !istKennung(teilnehmerId) || !istTrotz(trotz)) return null;
      return trotz === undefined ? { teilnehmerId } : { teilnehmerId, trotz };
    case 'person':
      return nurFelder(roh, ['nr', 'teilnehmerId']) && istNr(nr) && istKennung(teilnehmerId) ? { nr, teilnehmerId } : null;
    case 'vorgaben':
      return nurFelder(roh, ['aufloesung', 'tonAn']) && istSlotAufloesung(aufloesung) && istBool(tonAn) ? { aufloesung, tonAn } : null;
    case 'sprecher':
      return nurFelder(roh, ['signal', 'haltezeitMs']) && istSprecherSignal(signal) && typeof haltezeitMs === 'number' && Number.isFinite(haltezeitMs)
        ? { signal, haltezeitMs }
        : null;
    case 'vorschau':
    case 'personImNdiNamen':
      return nurFelder(roh, ['an']) && istBool(an) ? { an } : null;
  }
}

/**
 * Nutzlast eines Slot-Kanals prüfen (Spec 7.9, KF6). Nur ein Objekt mit genau den Feldern des Kanals ist gültig; `trotz`
 * ist optional. Die Haltezeit prüft hier nur die Form (endliche Zahl); ihre Regel (T74) gilt im Kern.
 */
export function pruefeSlotEingabe<K extends SlotKanal>(kanal: K, roh: unknown): { ok: true; wert: SlotEingabeWert[K] } | { ok: false } {
  const wert = pruefe(kanal, roh);
  return wert === null ? { ok: false } : { ok: true, wert: wert as SlotEingabeWert[K] };
}

// ── Ende des Moduls ──
