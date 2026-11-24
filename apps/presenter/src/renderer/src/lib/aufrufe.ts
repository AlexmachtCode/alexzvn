// Laufende Aufrufe des Panels (UX Welle 2b, Rückspiel Task 26; Regel aus Connect Task 24: laufende Aufrufe, Doppelklick-Schutz und
// Antworten gehören in die Wurzel-View, nicht in einen Panel-Abschnitt). Bis Task 26 hielten HandyAbschnitt (RemotePanel.tsx) und
// GastKlickerAbschnitt je ein eigenes „beschäftigt“ (useState); das Panel stirbt beim Schließen, ein Wiederöffnen während eines
// laufenden Aufrufs gab Schalter und „Setzen“ wieder frei. Den Zustand hält jetzt die Wurzel-View (EditorOberflaeche bzw.
// ReferentOberflaeche) und gibt ihn mit den Aktionen ans Panel. Hier stehen nur Typ und Logik als reine Funktionen; kein window,
// kein Effekt. Die Aufrufe selbst bleiben dieselben (standAktionen in useStand.ts).
import type { EinstellungenAktionen } from '@/views/Einstellungen';

/** Die Aufrufe des Panels mit eigenem „beschäftigt“: Handy-Server anwenden, Gast-Klicker an/aus, Pause, neuer Link. */
export type PanelAufruf = 'handy' | 'gastKlicker';

/** Gerade laufende Aufrufe; leer = nichts läuft. */
export type LaufendeAufrufe = ReadonlySet<PanelAufruf>;

export const KEIN_AUFRUF: LaufendeAufrufe = new Set<PanelAufruf>();

/** Wie die Wurzel-View den Stand fortschreibt (der Setter von useState passt). */
export type LaufSetzer = (neu: (s: LaufendeAufrufe) => LaufendeAufrufe) => void;

/**
 * Führt `f` aus; der Schlüssel steht für die Dauer des Aufrufs in den laufenden Aufrufen und fällt danach weg, auch wenn `f`
 * scheitert. Der Fehler geht weiter an den Aufrufer (wie bisher try/finally in den Abschnitten).
 */
export async function imLauf(setze: LaufSetzer, schluessel: PanelAufruf, f: () => Promise<unknown>): Promise<void> {
  setze((s) => new Set(s).add(schluessel));
  try {
    await f();
  } finally {
    setze((s) => {
      const n = new Set(s);
      n.delete(schluessel);
      return n;
    });
  }
}

/**
 * Die Aktionen des Panels mit den laufenden Aufrufen der Wurzel-View: Handy-Anwenden läuft unter „handy“, An/Aus, Pause und Neuer
 * Link des Gast-Klickers unter „gastKlicker“; Kopieren hat wie bisher kein „beschäftigt“. `laeuft` ist der Stand, den das Panel
 * zeigt.
 */
export function mitLaufendenAufrufen(a: EinstellungenAktionen, laeuft: LaufendeAufrufe, setze: LaufSetzer): EinstellungenAktionen {
  return {
    ...a,
    laeuft,
    handyAnwenden: (config) => imLauf(setze, 'handy', () => a.handyAnwenden(config)),
    gastKlicker: {
      ...a.gastKlicker,
      setzeAn: (an) => imLauf(setze, 'gastKlicker', () => a.gastKlicker.setzeAn(an)),
      pause: (an) => imLauf(setze, 'gastKlicker', () => a.gastKlicker.pause(an)),
      neuerLink: () => imLauf(setze, 'gastKlicker', () => a.gastKlicker.neuerLink()),
    },
  };
}
