// Testhilfen der Presenter-Oberflächentests (UX Welle 2b, Presenter b): feste Zustände und Attrappen für Render- und
// Ableitungstests. Wächst mit den Aufgaben c bis d; Aufgabe b liefert den Zustand der Fernsteuerungs-Meldung, Aufgabe c den
// OberflaechenStand, laufende Präsentationen, Bildschirmlisten und die Attrappe für `window.jmpr.present`.
import type { OberflaechenStand } from '@/lib/oberflaeche';
import type { FernsteuerungMeldung } from '@shared/fernsteuerung';
import type { DisplayInfo, JmprApi, PresentationState } from '@shared/types';

/** Meldung eines laufenden Steuerservers ohne Clients (Port 8728, offener Modus). */
export function basisMeldung(z: Partial<FernsteuerungMeldung> = {}): FernsteuerungMeldung {
  return { laeuft: true, port: 8728, clients: 0, modus: 'open', ...z };
}

/** Quelltext ohne Kommentare (Zeilen- und Blockkommentare), für Prüfungen am Code. */
export function ohneKommentare(quelle: string): string {
  return quelle.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/** Stand vor jeder Antwort (alles undefined), Editor unter Windows; `teil` überschreibt einzelne Eingänge. */
export function grundStand(teil: Partial<OberflaechenStand> = {}): OberflaechenStand {
  return {
    praesentation: undefined,
    bildschirme: undefined,
    ndi: undefined,
    handy: undefined,
    gastKlicker: undefined,
    timer: undefined,
    masterLink: undefined,
    fernsteuerung: undefined,
    fenster: 'editor',
    plattform: 'win32',
    ...teil,
  };
}

/** Laufende Präsentation, Folie 1 von 3, Publikum sieht die Folie. */
export function laufend(z: Partial<PresentationState> = {}): PresentationState {
  return { active: true, index: 0, total: 3, screen: 'live', ...z };
}

/**
 * Drei Bildschirme wie `getDisplays` im Main (Name „Bildschirm n[ (Haupt)] · B×H“), ids absichtlich nicht 1 bis 3, damit
 * Position und id nie zufällig gleich sind: 11 (Haupt), 22, 33. `publikum` = id des Bildschirms mit `current`, null = keiner.
 */
export function bildschirme(publikum: number | null): DisplayInfo[] {
  const bs = (id: number, n: number, primary: boolean, breite: number, hoehe: number): DisplayInfo => ({
    id,
    label: `Bildschirm ${n}${primary ? ' (Haupt)' : ''} · ${breite}×${hoehe}`,
    bounds: { x: (n - 1) * breite, y: 0, width: breite, height: hoehe },
    primary,
    current: id === publikum,
  });
  return [bs(11, 1, true, 2032, 1144), bs(22, 2, false, 1920, 1080), bs(33, 3, false, 1280, 720)];
}

type PresentAttrappe = Pick<JmprApi['present'], 'next' | 'prev' | 'goto' | 'setScreen' | 'stop'>;

/** Attrappe für `window.jmpr.present`: jeder Aufruf landet als Zeile in `aufrufe` („next“, „goto(0)“, „setScreen(black)“). */
export function presentAttrappe(): { present: PresentAttrappe; aufrufe: string[] } {
  const aufrufe: string[] = [];
  const merke =
    (name: string) =>
    (...a: unknown[]): Promise<void> => {
      aufrufe.push(a.length === 0 ? name : `${name}(${a.map(String).join(',')})`);
      return Promise.resolve();
    };
  return { aufrufe, present: { next: merke('next'), prev: merke('prev'), goto: merke('goto'), setScreen: merke('setScreen'), stop: merke('stop') } };
}
