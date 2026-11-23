// Testhilfen der Studio-Control-Oberflächentests (UX Welle 2b, Task 13): feste Zustände und Hilfen für Render- und
// Quelltext-Prüfungen. Wächst mit den folgenden Aufgaben (Brücken: Zustand der Fernsteuerungs-Meldung; Rahmen und Panels:
// Render-Hilfen für Statusleiste und Abschnitte, Vorbild apps/prompter/test/ui/testzustand.ts).
import { useApp } from '@/store/app';

/** Quelltext ohne Kommentare (Zeilen- und Blockkommentare), für Prüfungen am Code. */
export function ohneKommentare(quelle: string): string {
  return quelle.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/**
 * Führt f mit einem Zustand des App-Stores (Abschnitt, Geräte …) aus. Beim Server-Render liest zustand den Anfangszustand
 * (getInitialState); ein setState wirkt dort nicht. Deshalb werden dessen Felder für die Dauer von f gesetzt und danach
 * zurückgestellt.
 */
export function mitStore<T>(patch: Partial<ReturnType<typeof useApp.getState>>, f: () => T): T {
  const anfang = useApp.getInitialState() as unknown as Record<string, unknown>;
  const vorher: Record<string, unknown> = {};
  for (const k of Object.keys(patch)) vorher[k] = anfang[k];
  Object.assign(anfang, patch);
  try {
    return f();
  } finally {
    Object.assign(anfang, vorher);
  }
}
