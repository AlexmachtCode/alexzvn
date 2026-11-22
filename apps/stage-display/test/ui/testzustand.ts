// Testhilfen der Stage-Display-Oberflächentests (UX Welle 2a, Aufgabe b): feste Zustände und Attrappen für Render- und
// Ableitungstests. Wächst mit den Aufgaben c bis d.
import type { AusgabeZustand } from '@jm/output-window/zustand';

/** Ausgabezustand „offen“ auf Bildschirm 2. */
export function offenerSchirm(z: Partial<AusgabeZustand> = {}): AusgabeZustand {
  return { art: 'offen', displayId: 2, ...z };
}

/** Quelltext ohne Kommentare (Zeilen- und Blockkommentare), für Prüfungen am Code. */
export function ohneKommentare(quelle: string): string {
  return quelle.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}
