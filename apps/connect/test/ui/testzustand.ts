// Testhilfen der Connect-Oberflächentests (UX Welle 2b, Task 21): feste Zustände und Hilfen für Render- und Quelltext-
// Prüfungen. Wächst mit den folgenden Aufgaben (Rahmen, Panels).
import type { FernsteuerungMeldung } from '@shared/fernsteuerung';

/** Quelltext ohne Kommentare (Zeilen- und Blockkommentare), für Prüfungen am Code. */
export function ohneKommentare(quelle: string): string {
  return quelle.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/** Fernsteuerungs-Meldung des Steuerservers (Port 8737) mit Vorgaben; Felder ohne Wert fehlen (nie undefined). */
export function basisMeldung(patch: Partial<FernsteuerungMeldung> = {}): FernsteuerungMeldung {
  return { laeuft: true, port: 8737, clients: 0, ...patch };
}
