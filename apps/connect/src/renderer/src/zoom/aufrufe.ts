// Zoom-Aufrufe der Oberfläche (UX Welle 2b, Connect d2; B20, B8): der Doppelklick-Schutz je Knopf (`laeuft`, Funktionsliste Nr. 103)
// und der Ort einer abgelehnten Antwort, bis Task 24 lokaler Zustand der Zoom-Karte (ZoomCard.tsx:51, :111-115, :186-207). Den Zustand
// hält jetzt die Wurzel-View (views/ConnectOberflaeche.tsx); sie gibt ihn als ZoomAufrufe an die Zoom-Spalte und an das Panel, beide
// sehen dieselbe Antwort und dieselben laufenden Aufrufe. Hier stehen nur der Typ und die Logik von fuehreAus als reine Funktion
// (unverändert verschoben); kein window, kein Effekt.
import type { ZoomErgebnis } from '@shared/types';

/**
 * Wo eine abgelehnte Antwort (ZoomErgebnis.text) erscheint: 'karte' = in der Zoom-Spalte unter der Statuszeile, auch für unerwartete
 * IPC-Fehler; 'einrichtung' und 'vorgaben' = in den Panel-Abschnitten „Zoom-Einrichtung“ bzw. „Zoom-Vorgaben“ (Task 24; die Vorgaben
 * antworteten bis dahin im Kopf der Slots, 'slots'); sonst Beitritt, Teilnehmerzeile, Kachel oder Kopf der Slots.
 */
export type Ort = 'karte' | 'einrichtung' | 'vorgaben' | 'beitritt' | `zeile:${number}` | `slot:${number}` | 'slots';

/** Eine abgelehnte Antwort an ihrem Ort. */
export interface ZoomAntwort {
  ort: Ort;
  text: string;
}

/** Was Zoom-Spalte und Panel von der Wurzel-View bekommen: laufende Aufrufe, die eine Antwort und der Aufruf selbst. */
export interface ZoomAufrufe {
  /** Laufende Aufrufe (gegen Doppelklicks), je Knopf ein Schlüssel. */
  laeuft: ReadonlySet<string>;
  antwort: ZoomAntwort | null;
  /** Führt einen Aufruf aus; ein abgelehnter mit Text erscheint am Ort `ort` (null = nirgends, weil das Abbild ihn zeigt). */
  fuehreAus(schluessel: string, ort: Ort | null, f: () => Promise<ZoomErgebnis>): Promise<ZoomErgebnis>;
}

/** Wie fuehreZoomAus den Zustand der Wurzel-View fortschreibt (die Setter von useState passen). */
export interface ZoomAufrufSetzer {
  antwort(a: ZoomAntwort | null): void;
  laeuft(neu: (s: ReadonlySet<string>) => ReadonlySet<string>): void;
}

/**
 * fuehreAus der bisherigen Zoom-Karte (ZoomCard.tsx:186-207), als reine Funktion: Die alte Antwort fällt weg, der Schlüssel steht
 * für die Dauer des Aufrufs in `laeuft`; ein abgelehnter Aufruf mit Text steht danach am Ort, ein Wurf (unerwarteter IPC-Fehler) am
 * Ort oder, ohne Ort, in der Spalte ('karte').
 */
export async function fuehreZoomAus(setze: ZoomAufrufSetzer, schluessel: string, ort: Ort | null, f: () => Promise<ZoomErgebnis>): Promise<ZoomErgebnis> {
  setze.antwort(null);
  setze.laeuft((s) => new Set(s).add(schluessel));
  try {
    const r = await f();
    if (!r.ok && r.text && ort !== null) setze.antwort({ ort, text: r.text });
    return r;
  } catch (e) {
    const text = e instanceof Error ? e.message : String(e);
    setze.antwort({ ort: ort ?? 'karte', text });
    return { ok: false, text };
  } finally {
    setze.laeuft((s) => {
      const n = new Set(s);
      n.delete(schluessel);
      return n;
    });
  }
}

/** Text der Antwort an diesem Ort, sonst null. */
export function antwortAm(zoom: Pick<ZoomAufrufe, 'antwort'>, ort: Ort): string | null {
  return zoom.antwort && zoom.antwort.ort === ort ? zoom.antwort.text : null;
}

/** Für Aufrufe ohne Ergebnis (verlassen, schließen …): einheitlich durch fuehreAus schicken. */
export async function ohneText(p: Promise<void>): Promise<ZoomErgebnis> {
  await p;
  return { ok: true };
}
