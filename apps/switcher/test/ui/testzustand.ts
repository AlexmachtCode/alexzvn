// Testhilfen der Switcher-Oberflächentests (UX Welle 1): feste Zustände und Attrappen für Render- und Ableitungstests.
// Wächst mit den Aufgaben c bis d2; Aufgabe b liefert die Zustände der Fernsteuerungs-Meldung.
import type { FernsteuerungMeldung } from '@shared/fernsteuerung';
import type { ControlStatus } from '@shared/types';

/** Meldung eines laufenden Steuerservers ohne Clients (Standardport, offener Modus). */
export function basisMeldung(z: Partial<FernsteuerungMeldung> = {}): FernsteuerungMeldung {
  return { laeuft: true, port: 8723, clients: 0, modus: 'open', ...z };
}

/** Dieselbe Meldung in der Form des Kanals control:status. */
export function basisControlStatus(z: Partial<ControlStatus> = {}): ControlStatus {
  return { running: true, port: 8723, clients: 0, modus: 'open', ...z };
}
