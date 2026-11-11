// #293: Regeln für Übergänge (global + pro Folie) und die Schleife. Rein, ohne Electron/DOM —
// gemeinsam genutzt von Hauptprozess (Schleifen-Timer), Publikumsansicht und Editor.
import type { Slide, Uebergang, Wiedergabe } from './types';

export const DAUER_MIN_MS = 100;
export const DAUER_MAX_MS = 5000;
export const STANDZEIT_MIN_SEK = 1;
export const STANDZEIT_MAX_SEK = 3600;

/** Was gilt, solange nichts eingestellt ist — und für Projekte von vor 0.11.0: wie bisher. */
export const WIEDERGABE_VORGABE: Wiedergabe = {
  uebergang: { art: 'schnitt', dauerMs: 500 },
  schleife: false,
  standzeitSek: 10,
};

function zahl(v: unknown, min: number, max: number, sonst: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : sonst;
}

export function normiereUebergang(raw: unknown, sonst: Uebergang = WIEDERGABE_VORGABE.uebergang): Uebergang {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    art: r.art === 'blende' || r.art === 'schnitt' ? r.art : 'schnitt',
    dauerMs: Math.round(zahl(r.dauerMs, DAUER_MIN_MS, DAUER_MAX_MS, sonst.dauerMs)),
  };
}

/** Gelesene Einstellungen prüfen; fehlt etwas oder passt der Typ nicht, gilt die Vorgabe. */
export function normiereWiedergabe(raw: unknown): Wiedergabe {
  if (!raw || typeof raw !== 'object') return { ...WIEDERGABE_VORGABE, uebergang: { ...WIEDERGABE_VORGABE.uebergang } };
  const r = raw as Record<string, unknown>;
  return {
    uebergang: normiereUebergang(r.uebergang),
    schleife: r.schleife === true,
    standzeitSek: zahl(r.standzeitSek, STANDZEIT_MIN_SEK, STANDZEIT_MAX_SEK, WIEDERGABE_VORGABE.standzeitSek),
  };
}

/**
 * Übergang beim Hereinkommen dieser Folie: ihr eigener, sonst der für alle. Der Wert der Folie kommt
 * ungeprüft aus der Projektdatei — deshalb hier geprüft.
 */
export function uebergangFuer(slide: Slide, w: Wiedergabe): Uebergang {
  return slide.uebergang ? normiereUebergang(slide.uebergang, w.uebergang) : w.uebergang;
}

/**
 * Standzeit dieser Folie in der Schleife (Sekunden): ihre eigene, sonst die für alle. Geprüft und
 * begrenzt, damit ein kaputter Wert die Schleife nie im Dauerfeuer blättern lässt.
 */
export function standzeitFuer(slide: Slide, w: Wiedergabe): number {
  return zahl(slide.standzeitSek, STANDZEIT_MIN_SEK, STANDZEIT_MAX_SEK, w.standzeitSek);
}

/** Nächste Folie: mit Schleife nach der letzten wieder die erste, sonst bleibt die letzte stehen. */
export function naechsterIndex(index: number, total: number, schleife: boolean): number {
  if (total <= 0) return 0;
  if (index >= total - 1) return schleife ? 0 : total - 1;
  return index + 1;
}
