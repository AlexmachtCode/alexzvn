// Reine Helfer für den Rundown-Main rund um die scharfe Zeile und die Annahme
// von Editor-Änderungen (Master-Link Teil 2a, Spec 4.3, 4.5, 5.1, 5.3, 5.5).
// Rein: keine node-/electron-Importe, keine Uhr, kein Zufall (neue IDs kommen
// über `neueId`), zwischen den shared-Modulen nur `import type` — der
// Selbsttest läuft mit `node --experimental-strip-types` (test/selftest.ts).
import type { RundownRow } from './types';

/** Nicht entfallen = feuert und kann scharf werden (4.3). */
function lebt(r: RundownRow): boolean {
  return r.entfallen !== true;
}

/**
 * Scharfe Zeile nach einer Bearbeitung im Editor (5.3). Gehalten wird über die
 * Kennung, nicht über die Nummer: Löschen oder Verschieben einer Zeile darüber
 * lässt die Markierung, wo sie ist.
 *  - `scharfId` null oder unter `alt` unbekannt → erste nicht entfallene Zeile von `neu`
 *  - die scharfe Zeile steht in `neu` und ist nicht entfallen → bleibt scharf,
 *    auch an neuer Stelle
 *  - sonst (gelöscht) R7 (c) sinngemäß: die erste Zeile, die in `alt` hinter ihr
 *    stand und in `neu` nicht entfallen ist; sonst die letzte nicht entfallene
 *    Zeile von `neu`; sonst null
 */
export function scharfNachBearbeitung(
  alt: RundownRow[],
  neu: RundownRow[],
  scharfId: string | null,
): string | null {
  const ersteLebende = neu.find(lebt)?.id ?? null;
  if (scharfId === null) return ersteLebende;
  const altStelle = alt.findIndex((r) => r.id === scharfId);
  if (altStelle < 0) return ersteLebende;
  const neuNachId = new Map(neu.map((r) => [r.id, r] as const));
  const jetzt = neuNachId.get(scharfId);
  if (jetzt && lebt(jetzt)) return jetzt.id;
  // R7 (c) sinngemäß: erste Zeile, die vorher hinter ihr stand und nicht entfallen ist …
  for (const r of alt.slice(altStelle + 1)) {
    const kandidat = neuNachId.get(r.id);
    if (kandidat && lebt(kandidat)) return kandidat.id;
  }
  // … sonst die letzte nicht entfallene, sonst keine.
  for (let i = neu.length - 1; i >= 0; i--) if (lebt(neu[i])) return neu[i].id;
  return null;
}

/**
 * Stelle der scharfen Zeile in `rows`. Der Main führt `scharfId` (5.3), die
 * Nummer wird daraus errechnet — für `navigate` und STATE `cue=`.
 * `scharfId` null oder nicht gefunden (auch bei leerer Liste) → 0, wie heute
 * der Anfangswert von `index`.
 */
export function indexVon(rows: RundownRow[], scharfId: string | null): number {
  if (scharfId === null) return 0;
  const i = rows.findIndex((r) => r.id === scharfId);
  return i < 0 ? 0 : i;
}

/**
 * Dieselbe Zeile als eigene Zeile: ohne `quelle` und `entfallen`, mit der
 * übergebenen `id`. Für die Absicherung in `setDoc` (4.5), den Regieplan-Import
 * und den Knopf „Als eigene Zeile behalten“ (4.3, dort mit `newId('r')`).
 */
export function alsEigeneZeile(r: RundownRow, id: string): RundownRow {
  const kopie: RundownRow = { ...r, id };
  delete kopie.quelle;
  delete kopie.entfallen;
  return kopie;
}

/**
 * Absicherung in `rundown:setDoc` (4.5). Eine Zeile mit `quelle: 'ablauf'` wird
 * nur angenommen,
 *  - lebend, wenn ihre `id` ein Schlüssel des aktuellen Ablaufs ist,
 *  - entfallen, wenn es vorher schon eine entfallene Zeile mit dieser `id` gab
 *    (`bisherEntfallen`: die Kennungen der entfallenen Zeilen des Dokuments VOR
 *    der Änderung).
 * Die Markierung `entfallen` setzt dabei der Main aus diesem Wissen, nicht der
 * Renderer. Je Kennung gilt nur die erste solche Zeile.
 * Jede andere Zeile mit `quelle` wird eine eigene Zeile mit neuer `id` aus
 * `neueId()`, damit sie nie mit einer Ablaufzeile gleichen Schlüssels
 * kollidiert (R3). Eigene Zeilen behalten ihre `id`, verlieren nur ein
 * unzulässiges `entfallen` und bekommen nur dann eine neue `id`, wenn ihre
 * schon vergeben ist (auch an einen Schlüssel des Ablaufs).
 * Nur anwenden, solange eine Show gemerkt ist: Ohne Show ist alles frei (4.5).
 * Verändert die Eingabe nicht; unveränderte Zeilen kommen als dasselbe Objekt zurück.
 */
export function bereinigeQuellen(
  rows: RundownRow[],
  ablaufSchluessel: string[],
  bisherEntfallen: Set<string>,
  neueId: () => string,
): RundownRow[] {
  const lebend = new Set(ablaufSchluessel);
  // 1. Durchgang: welche Ablaufzeilen werden angenommen (je Kennung nur die erste)?
  const angenommen = new Set<number>();
  const ablaufIds = new Set<string>();
  rows.forEach((r, i) => {
    if (r.quelle !== 'ablauf' || ablaufIds.has(r.id)) return;
    if (!lebend.has(r.id) && !bisherEntfallen.has(r.id)) return;
    angenommen.add(i);
    ablaufIds.add(r.id);
  });
  // 2. Durchgang: Markierung aus dem Wissen des Main, alles andere wird eigene Zeile.
  const vergeben = new Set<string>([...ablaufIds, ...lebend, ...bisherEntfallen]);
  return rows.map((r, i) => {
    if (angenommen.has(i)) {
      const sollEntfallen = !lebend.has(r.id);
      if ((r.entfallen === true) === sollEntfallen) return r;
      const kopie: RundownRow = { ...r };
      if (sollEntfallen) kopie.entfallen = true;
      else delete kopie.entfallen;
      return kopie;
    }
    const id = r.quelle !== undefined || vergeben.has(r.id) ? neueId() : r.id;
    vergeben.add(id);
    if (id === r.id && r.entfallen === undefined) return r;
    return alsEigeneZeile(r, id);
  });
}

/**
 * Annehmen oder abweisen (5.5). `rev` steigt bei jeder Änderung am Dokument,
 * `abgleichRev` hält fest, bei welchem `rev` der letzte Abgleich lief.
 * Abgewiesen wird nur, wenn seit dem Stand des Renderers (`basisRev`) ein
 * Abgleich lief. Eigene schnelle Eingaben (`basisRev < rev` ohne Abgleich)
 * gehen durch, wie heute beim schnellen Tippen.
 */
export function nimmAenderungAn(basisRev: number, abgleichRev: number): boolean {
  return basisRev >= abgleichRev;
}

/**
 * Bündler für RELOADs (5.1): Mehrere Aufrufe binnen `ms` werden zu einem
 * zusammengefasst. Jeder Aufruf storniert den noch ausstehenden und plant neu;
 * ausgeführt wird einmal, `ms` nach dem letzten Aufruf, und zwar die zuletzt
 * übergebene Funktion. Die Uhr kommt von außen (`plane`/`storniere`, in
 * Produktion setTimeout/clearTimeout), damit der Selbsttest ohne Warten läuft.
 */
export function erzeugeBuendler(
  ms: number,
  plane: (fn: () => void, ms: number) => unknown,
  storniere: (h: unknown) => void,
): (fn: () => void) => void {
  let offen = false;
  let handle: unknown = null;
  return (fn) => {
    if (offen) storniere(handle);
    offen = true;
    handle = plane(() => {
      offen = false;
      fn();
    }, ms);
  };
}

/**
 * Regieplan-Import „Ersetzen“, solange eine Show gemerkt ist (4.5): alle eigenen
 * Zeilen fallen weg, Ablaufzeilen (lebende und entfallene) bleiben in ihrer
 * Reihenfolge, die importierten kommen ans Ende — immer als eigene Zeilen.
 */
export function ersetzeEigeneZeilen(rows: RundownRow[], neueZeilen: RundownRow[]): RundownRow[] {
  return [
    ...rows.filter((r) => r.quelle === 'ablauf'),
    ...neueZeilen.map((r) => (r.quelle === undefined && r.entfallen === undefined ? r : alsEigeneZeile(r, r.id))),
  ];
}
