// Testhilfen der Rundown-Oberflächentests (UX Welle 1): feste Zustände und Attrappen für Render- und Ableitungstests.
// Wächst mit den Aufgaben c bis d; Aufgabe b liefert den Zustand der Fernsteuerungs-Meldung.
import type { FernsteuerungMeldung } from '@shared/fernsteuerung';
import type { RundownRow, RundownState } from '@shared/types';

/** Meldung eines laufenden Steuerservers ohne Clients (Port 8731, offener Modus). */
export function basisMeldung(z: Partial<FernsteuerungMeldung> = {}): FernsteuerungMeldung {
  return { laeuft: true, port: 8731, clients: 0, modus: 'open', ...z };
}

/** Leerer Rundown-Stand ohne Show und ohne Gegenstellen; `teil` überschreibt einzelne Felder. */
export function basisState(teil: Partial<RundownState> = {}): RundownState {
  return {
    doc: { schemaVersion: 2, name: 'Test', rows: [] },
    index: 0,
    scharfId: null,
    filePath: null,
    dirty: false,
    links: [],
    overrides: {},
    lastFired: null,
    iveoSpeakers: [],
    iveoSideEvents: [],
    rev: 0,
    hinweise: [],
    abweisungen: 0,
    ablaufSchluessel: [],
    eigeneTimerListe: false,
    showGemerkt: false,
    showMitIveo: false,
    ...teil,
  };
}

/** Eine Zeile ohne Aktionen. */
export function zeile(id: string): RundownRow {
  return { id, label: `Zeile ${id}`, actions: [] };
}
