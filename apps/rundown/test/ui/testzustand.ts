// Testhilfen der Rundown-Oberflächentests (UX Welle 1): feste Zustände und Attrappen für Render- und Ableitungstests.
// Wächst mit den Aufgaben c bis d; Aufgabe b liefert den Zustand der Fernsteuerungs-Meldung.
import type { FernsteuerungMeldung } from '@shared/fernsteuerung';

/** Meldung eines laufenden Steuerservers ohne Clients (Port 8731, offener Modus). */
export function basisMeldung(z: Partial<FernsteuerungMeldung> = {}): FernsteuerungMeldung {
  return { laeuft: true, port: 8731, clients: 0, modus: 'open', ...z };
}
