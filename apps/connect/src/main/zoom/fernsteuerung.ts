// Fernsteuer-Befehle für Zoom (Spec 11.2, 8.6) als reine Funktionen. Ohne Electron (G8).
// Der Kern (steuerbefehl) ruft deuteZoomBefehl für jedes zoom_*-Verb und ladeZiel für zoom_load. Was vom
// Zustand abhängt (F4 „nicht im Meeting“/„keine Aufnahme-Erlaubnis“, F5, F8, „schon geladen“), entscheidet
// der Kern; hier steht nur, was ohne Zustand feststeht (F1, F6, F7) und wen ein Name meint (F2, F3, F4 Warteraum).
import { SLOT_NR_MAX } from '@jm/zoom-bridge/protocol';
import type { ZoomSlotModus } from '../../shared/types';
import { istSlotModus } from './einstellungen';
import { FT, fernLogText } from './klartext';
import { normName } from './teilnehmer';

/** Wert von `zoom_slot` und `zoom_slot_audio` (Spec 8.3); TOGGLE löst der Kern auf (Task B13). */
export type SlotSchalter = 'on' | 'off' | 'toggle';

/** Gedeuteter zoom_*-Befehl. `abgelehnt` trägt den Hinweis (mit Vorsatz „Companion: “) und die Logzeile ohne Namen. */
export type ZoomFernbefehl =
  | { art: 'laden'; name: string }
  | { art: 'entladen'; name: string }
  | { art: 'versatz'; ms: number }
  | { art: 'slot'; nr: number; wert: SlotSchalter }
  | { art: 'slotModus'; nr: number; modus: ZoomSlotModus }
  | { art: 'slotPerson'; nr: number; name: string }
  | { art: 'slotTon'; nr: number; wert: SlotSchalter }
  | { art: 'abgelehnt'; kennung: 'f1' | 'f6' | 'f7' | 'f9' | 'f10' | 'f11' | 'f13'; text: string; logText: string };

/**
 * `verb` ohne Rücksicht auf Groß-/Kleinschreibung (der Parser liefert es klein). Name = args.join(' ').trim():
 * Der Parser trennt an Leerraum, Connect fügt mit einem Leerzeichen zusammen (Spec 0.5, 11.2); den Rest
 * gleicht normName beim Vergleich aus. Versatz: nur Ziffern, höchstens 1000 ms (G4); sonst F6 mit dem Argument.
 */
export function deuteZoomBefehl(verb: string, args: readonly string[]): ZoomFernbefehl {
  const v = verb.toLowerCase();
  const arg = args.join(' ').trim();
  switch (v) {
    case 'zoom_load':
    case 'zoom_unload':
      if (arg === '') return { art: 'abgelehnt', kennung: 'f1', text: FT.F1, logText: fernLogText('f1', v) };
      return v === 'zoom_load' ? { art: 'laden', name: arg } : { art: 'entladen', name: arg };
    case 'zoom_delay':
      if (!/^\d+$/.test(arg) || Number(arg) > 1000) return { art: 'abgelehnt', kennung: 'f6', text: FT.F6(arg), logText: fernLogText('f6', v) };
      return { art: 'versatz', ms: Number(arg) };
    case 'zoom_slot':
    case 'zoom_slot_mode':
    case 'zoom_slot_person':
    case 'zoom_slot_audio':
      return deuteSlotBefehl(v, args);
    default:
      return { art: 'abgelehnt', kennung: 'f7', text: FT.F7(v), logText: fernLogText('f7', v) };
  }
}

/**
 * Die vier Slot-Verben (Spec 8.3, E25). Erstes Argument = Slot-Nummer: nur Ziffern, 1 bis SLOT_NR_MAX, sonst F9 mit dem
 * Argument (ob der Slot angelegt ist, prüft der Kern; auch das ist F9). Der Rest der Argumente, mit einem Leerzeichen
 * verbunden, ist der Modus (F10), der Name (F11, wenn leer) oder ON/OFF/TOGGLE (F13); Werte ohne Groß-/Kleinschreibung.
 */
function deuteSlotBefehl(v: string, args: readonly string[]): ZoomFernbefehl {
  const roh = (args[0] ?? '').trim();
  if (!/^\d+$/.test(roh) || Number(roh) < 1 || Number(roh) > SLOT_NR_MAX) return abgelehnt('f9', FT.F9(roh), v);
  const nr = Number(roh);
  const rest = args.slice(1).join(' ').trim();
  if (v === 'zoom_slot_person') return rest === '' ? abgelehnt('f11', FT.F11(nr), v) : { art: 'slotPerson', nr, name: rest };
  if (v === 'zoom_slot_mode') {
    const modus = rest.toLowerCase();
    return istSlotModus(modus) ? { art: 'slotModus', nr, modus } : abgelehnt('f10', FT.F10(rest), v);
  }
  const wert = rest.toLowerCase();
  if (wert !== 'on' && wert !== 'off' && wert !== 'toggle') return abgelehnt('f13', FT.F13(rest), v);
  return v === 'zoom_slot' ? { art: 'slot', nr, wert } : { art: 'slotTon', nr, wert };
}

/** Abgelehnter Slot-Befehl: Hinweis mit Vorsatz, Logzeile nur mit Kennung und Verb (N4b.2). */
function abgelehnt(kennung: 'f9' | 'f10' | 'f11' | 'f13', text: string, verb: string): ZoomFernbefehl {
  return { art: 'abgelehnt', kennung, text, logText: fernLogText(kennung, verb) };
}

/** Wen `zoom_load <Name>` meint. */
export type LadeZiel = { art: 'gefunden'; id: number } | { art: 'niemand' } | { art: 'mehrdeutig'; n: number } | { art: 'warteraum'; id: number };

/**
 * Vergleich über den normierten Namen (Spec 4), Teilnehmer im Warteraum zählen mit wie beim Doppelnamen:
 * keiner → niemand (F2); zwei oder mehr → mehrdeutig (F3); genau einer im Warteraum → warteraum (F4);
 * genau einer → gefunden. Die eigene Zeile der Bridge filtert der Aufrufer.
 */
export function ladeZiel(name: string, teilnehmer: ReadonlyArray<{ id: number; name: string; imWarteraum: boolean }>): LadeZiel {
  const gesucht = normName(name);
  const treffer = teilnehmer.filter((t) => normName(t.name) === gesucht);
  if (treffer.length === 0) return { art: 'niemand' };
  if (treffer.length > 1) return { art: 'mehrdeutig', n: treffer.length };
  return treffer[0].imWarteraum ? { art: 'warteraum', id: treffer[0].id } : { art: 'gefunden', id: treffer[0].id };
}
