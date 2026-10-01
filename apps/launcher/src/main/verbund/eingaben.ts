import type { VerbundRolle } from '@shared/types';
import { teileAdresse } from './slave';

// Prüfung der Renderer-Eingaben im Main (Endprüfung B8, OHNE Electron, per tsx getestet). Über IPC kann ein Renderer
// beliebige Werte schicken: Ungültiges wird mit „EINVAL: …“ am Meldungsanfang abgelehnt (ablehnungCode im Renderer
// liest den Code dort) und NIE in master-link.json geschrieben — ein Wert außerhalb der Union machte die Datei sonst
// für alle Tools defekt.

/** Obergrenzen in Zeichen (großzügig: sie schützen nur vor Unsinn, Namen kürzt kuerzeName ohnehin auf 60). */
export const EINGABE_GRENZEN = { karte: 256, rechnerId: 128, code: 64, adresse: 256, name: 4096 } as const;

export function ungueltig(was: string): Error {
  return Object.assign(new Error(`EINVAL: ${was} ungültig`), { code: 'EINVAL' });
}

const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;

export function pruefeRolle(v: unknown): VerbundRolle {
  if (v === 'aus' || v === 'master' || v === 'slave') return v;
  throw ungueltig('Rolle');
}

export function pruefeKarte(v: unknown): string | null {
  if (v === null) return null;
  if (text(v, EINGABE_GRENZEN.karte)) return v;
  throw ungueltig('Netzwerkkarte');
}

export function pruefeName(v: unknown): string {
  if (text(v, EINGABE_GRENZEN.name)) return v;
  throw ungueltig('Name');
}

export function pruefeRechnerId(v: unknown): string {
  if (text(v, EINGABE_GRENZEN.rechnerId) && v.length > 0) return v;
  throw ungueltig('Rechnerkennung');
}

export function pruefeKoppelEingabe(adresse: unknown, code: unknown): { adresse: string; code: string } {
  if (!text(adresse, EINGABE_GRENZEN.adresse)) throw ungueltig('Adresse');
  if (!text(code, EINGABE_GRENZEN.code)) throw ungueltig('Code');
  return { adresse, code };
}

/**
 * Feste Master-Adresse (Spec 4.5): leer → null; sonst „host“ oder „host:port“ wie beim Koppeln (teileAdresse). Ein Port
 * ist nur erlaubt, wenn er der Kopplungsport ist — gespeichert wird nur der Host (der Client verbindet auf host + Port
 * der Kopplung; „10.0.0.110:8738“ als Hostname endete sonst in ENOTFOUND).
 */
export function pruefeFesteAdresse(v: unknown, kopplungsPort: number): string | null {
  if (v === null) return null;
  if (!text(v, EINGABE_GRENZEN.adresse)) throw ungueltig('Adresse');
  const t = v.trim();
  if (!t) return null;
  const ziel = teileAdresse(t);
  if (!ziel) throw ungueltig('Adresse');
  if (t.includes(':') && ziel.port !== kopplungsPort) throw ungueltig('Port (nur der Port der Kopplung ist erlaubt)');
  return ziel.host;
}
