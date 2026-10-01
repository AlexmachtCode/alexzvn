// Ausgangsstand beim Öffnen einer Show (Master-Link Teil 2a, Spec 4.8 und 5.2):
// Gedächtnis bzw. eigene Rundown-Datei der Show → alter Autosave aus Rundown 0.5
// (Übergangsregel) → leer. Danach gleicht der Aufrufer mit `wendeShowAn` ab.
// Rein: Dateien liest der Aufrufer und reicht Inhalt und Dateistand herein.
// Keine node-/electron-Importe, zwischen den shared-Modulen nur `import type` —
// der Selbsttest läuft mit `node --experimental-strip-types` (test/selftest.ts).
import type { RundownDoc } from './types';

/** Stand einer eigenen Rundown-Datei, wie das Gedächtnis sie gesehen hat (4.7, 4.8). */
export interface DateiStand {
  pfad: string;
  mtimeMs: number;
  groesse: number;
  sha256: string;
}

/** Inhalt von `<userData>/regie/<schlüssel>.json` (4.7). */
export interface GedaechtnisInhalt {
  schemaVersion: 2;
  showPfad: string;
  showName: string;
  /** Aktuelle Zeilen samt Archiv. */
  doc: RundownDoc;
  scharfId: string | null;
  gespeichertAm: string;
  /** Stand der eigenen Rundown-Datei beim letzten Laden oder Speichern (4.8). */
  datei?: DateiStand;
}

export type Ausgangsstand =
  | { quelle: 'gedaechtnis'; doc: RundownDoc; scharfId: string | null; ungespeichert: boolean }
  | { quelle: 'datei'; doc: RundownDoc; hinweisAusserhalb: boolean }
  | { quelle: 'autosave-v1'; doc: RundownDoc }
  | { quelle: 'leer' };

/** Gleicher Dateistand: Pfad, Größe, Änderungszeit UND SHA-256 (4.8). */
function gleicherStand(a: DateiStand, b: DateiStand): boolean {
  return a.pfad === b.pfad && a.groesse === b.groesse && a.mtimeMs === b.mtimeMs && a.sha256 === b.sha256;
}

/** JSON mit sortierten Schlüsseln: Inhaltsvergleich unabhängig von der Feldreihenfolge. */
function stabil(wert: unknown): string {
  return JSON.stringify(wert, (_k, v: unknown) => {
    if (v === null || typeof v !== 'object' || Array.isArray(v)) return v;
    const o = v as Record<string, unknown>;
    return Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
  });
}

/**
 * Ausgangsstand beim Öffnen einer Show (5.2, Reihenfolge wie dort):
 *  1. Eigene Rundown-Datei der Show (`datei`, gelesen) nach 4.8:
 *     - kein Gedächtnis → die Datei gilt
 *     - Gedächtnis, dessen `datei` in Pfad, Größe, Änderungszeit und SHA-256
 *       gleich ist → das Gedächtnis gilt; `ungespeichert`, wenn sein Dokument
 *       inhaltlich von der Datei abweicht
 *     - sonst (außerhalb geändert, hineinkopiert, ersetzt, nie gesehen) → die
 *       Datei gilt, mit `hinweisAusserhalb`
 *  2. Ohne Datei: das Gedächtnis, falls vorhanden.
 *  3. Übergangsregel (Ergänzung 0.7): weder Gedächtnis noch Datei, der beim
 *     Start geladene Autosave war ein Version-1-Dokument und heißt wie die
 *     Show → er wird Ausgangsstand, mit `zuordnungOffen` (4.9). Das Sichern als
 *     `rundown.autosave.v1.jmrundown` erledigt der Aufrufer vorher.
 *  4. Sonst leer. Das Beispiel-Dokument ist nie Ausgangsstand: Gab es keinen
 *     Autosave, übergibt der Aufrufer `autosave: null`.
 * Verändert die Eingaben nicht.
 */
export function waehleAusgangsstand(e: {
  gedaechtnis: GedaechtnisInhalt | null;
  datei: { doc: RundownDoc; stand: DateiStand } | null;
  autosave: RundownDoc | null;
  autosaveWarV1: boolean;
  showName: string;
}): Ausgangsstand {
  const { gedaechtnis, datei } = e;
  if (datei) {
    if (!gedaechtnis) return { quelle: 'datei', doc: datei.doc, hinweisAusserhalb: false };
    if (gedaechtnis.datei && gleicherStand(gedaechtnis.datei, datei.stand)) {
      return {
        quelle: 'gedaechtnis',
        doc: gedaechtnis.doc,
        scharfId: gedaechtnis.scharfId,
        ungespeichert: stabil(gedaechtnis.doc) !== stabil(datei.doc),
      };
    }
    return { quelle: 'datei', doc: datei.doc, hinweisAusserhalb: true };
  }
  if (gedaechtnis) {
    return { quelle: 'gedaechtnis', doc: gedaechtnis.doc, scharfId: gedaechtnis.scharfId, ungespeichert: false };
  }
  if (e.autosave && e.autosaveWarV1 && e.autosave.name === e.showName) {
    return { quelle: 'autosave-v1', doc: { ...e.autosave, zuordnungOffen: true } };
  }
  return { quelle: 'leer' };
}
