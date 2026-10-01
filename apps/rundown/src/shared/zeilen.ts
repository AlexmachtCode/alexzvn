// Kleine reine Helfer rund um Zeilen und Sprung-Aktionen (Spec 4.4, 5.2, 6.2),
// die Main und Renderer gleich brauchen. Ohne Laufzeit-Importe (G2): die
// Auflösung des Sprungs (`loeseSprungZiel` aus sprung.ts) wird übergeben.
import type { SprungErgebnis } from './sprung';
import type { RundownAction, RundownDoc, RundownRow } from './types';

/** Kontext einer iveo-Show (4.4): Side Event oder Programmliste. */
export function kontextIstIveo(kontext: string | undefined): boolean {
  return !!kontext && (kontext.startsWith('se:') || kontext.startsWith('liste:'));
}

/** Kennung der ersten nicht entfallenen Zeile, sonst null. */
export function ersteLebendeZeile(rows: RundownRow[]): string | null {
  return rows.find((r) => r.entfallen !== true)?.id ?? null;
}

/**
 * Schlüssel der lebenden Ablaufzeilen in Reihenfolge. Nach einem Abgleich ist
 * das genau die Schlüsselliste des Ablaufs (R1, R3). Der Main nutzt sie nur,
 * wenn die gemerkte Show beim Start nicht lesbar ist (5.2).
 */
export function ablaufSchluesselAusZeilen(rows: RundownRow[]): string[] {
  return rows.filter((r) => r.quelle === 'ablauf' && r.entfallen !== true).map((r) => r.id);
}

/** `timer goto` — die einzige Aktion mit Sprung-Ziel (6.2). */
export function istSprung(a: RundownAction): boolean {
  return a.role === 'timer' && a.verb === 'goto';
}

/**
 * Argumente, mit denen eine Aktion JETZT gesendet würde (6.2). Nur ein
 * gebundener `timer goto` bekommt die aufgelöste Nummer in `args[0]`; nicht
 * gebundene Aktionen gehen unverändert raus wie bisher. null = Ziel entfallen,
 * nichts senden. `loese` ist `(a) => loeseSprungZiel(a, ablaufSchluessel, eigeneTimerListe)`.
 */
export function sendeArgs(
  a: RundownAction,
  loese: (a: RundownAction) => SprungErgebnis,
): (string | number)[] | null {
  if (!istSprung(a)) return a.args;
  const z = loese(a);
  if ('entfallen' in z) return null;
  return z.gebunden ? [z.n, ...a.args.slice(1)] : a.args;
}

/** Titel des Sprung-Ziels für Hinweis und Log; ohne Zeile „Punkt <args[0]>“. */
export function sprungZielTitel(rows: RundownRow[], a: RundownAction): string {
  return rows.find((r) => r.id === a.zielId)?.label ?? `Punkt ${String(a.args[0] ?? '?')}`;
}

// ── Für den Renderer: Sperren, Hinweise, Sprung-Auswahl, Duplizieren (4.5, 6.2) ──

/** Was Liste und Editor über die gemerkte Show wissen (aus RundownState). */
export interface ShowSicht {
  showGemerkt: boolean;
  mitIveo: boolean;
  ablaufSchluessel: string[];
  eigeneTimerListe: boolean;
}

export type ZeilenArt = 'ablauf' | 'entfallen' | 'eigen';

/** Lebende Ablaufzeile, entfallene Zeile oder eigene Zeile (Begriffe, Spec 2). */
export function zeilenArt(row: RundownRow): ZeilenArt {
  if (row.quelle !== 'ablauf') return 'eigen';
  return row.entfallen ? 'entfallen' : 'ablauf';
}

/** Was an einer Zeile gesperrt ist (Tabelle 4.5). Aktionen und Duplizieren sind immer frei. */
export interface Sperren {
  /** Titel, Notiz und Dauer. */
  text: boolean;
  verschieben: boolean;
  loeschen: boolean;
}

export function sperrenFuer(row: RundownRow, showGemerkt: boolean): Sperren {
  const art = zeilenArt(row);
  if (!showGemerkt || art === 'eigen') return { text: false, verschieben: false, loeschen: false };
  return { text: true, verschieben: true, loeschen: art === 'ablauf' };
}

/** Hinweis an der Zeile (Tabelle 4.5); null = kein Hinweis. */
export function zeilenHinweis(row: RundownRow, showGemerkt: boolean, mitIveo: boolean): string | null {
  switch (zeilenArt(row)) {
    case 'ablauf':
      if (!showGemerkt) return null;
      return mitIveo ? 'kommt aus iveo' : 'kommt aus der Show, im Show-Editor ändern';
    case 'entfallen':
      // Auch ohne gemerkte Show behalten entfallene Zeilen Markierung und Hinweis.
      return mitIveo ? 'in iveo entfallen' : 'in der Show entfallen';
    default:
      return null;
  }
}

export interface AblaufPunkt {
  n: number;
  id: string;
  label: string;
}

/** Auswahl für `timer goto` (6.2): Ablaufpunkte in Ablaufreihenfolge, Titel aus der Zeile. */
export function ablaufPunkte(rows: RundownRow[], ablaufSchluessel: string[]): AblaufPunkt[] {
  return ablaufSchluessel.map((id, i) => ({ n: i + 1, id, label: rows.find((r) => r.id === id)?.label ?? id }));
}

/** Kopie ohne Herkunft: ohne `quelle` und `entfallen` = eigene Zeile (wie `alsEigeneZeile` in scharf.ts, G2). */
function ohneHerkunft(r: RundownRow): RundownRow {
  const kopie: RundownRow = { ...r };
  delete kopie.quelle;
  delete kopie.entfallen;
  return kopie;
}

/**
 * Zeile duplizieren (4.5): Die Kopie ist immer eine eigene Zeile — neue ids für
 * Zeile und Aktionen, ohne `quelle`/`entfallen`, Titel mit „(Kopie)“, direkt
 * hinter dem Original. `args` werden kopiert, nicht geteilt.
 */
export function dupliziereZeile(
  doc: RundownDoc,
  rowId: string,
  neueId: (praefix: 'r' | 'a') => string,
): RundownDoc {
  const idx = doc.rows.findIndex((r) => r.id === rowId);
  if (idx < 0) return doc;
  const src = doc.rows[idx];
  const kopie: RundownRow = {
    ...ohneHerkunft(src),
    id: neueId('r'),
    label: `${src.label} (Kopie)`,
    actions: src.actions.map((a) => ({ ...a, id: neueId('a'), args: a.args.slice() })),
  };
  const rows = doc.rows.slice();
  rows.splice(idx + 1, 0, kopie);
  return { ...doc, rows };
}

/**
 * RELOAD (5.2): Hatte die gemerkte Show vorher keinen Ablauf und hat jetzt einen,
 * ist das wie „andere Show“ (Ausgangsstand-Regel, .v1-Sicherung, GO-Folgen
 * abbrechen) und nicht nur ein Abgleich des Bestehenden.
 */
export function ablaufNeuEntstanden(vorherLeer: boolean, ablaufJetzt: number): boolean {
  return vorherLeer && ablaufJetzt > 0;
}

/** Verschieben (4.5): nur eigene Zeilen; Ablaufzeilen (lebend oder entfallen) sind bei gemerkter Show gesperrt. */
export function darfVerschieben(row: RundownRow, showGemerkt: boolean): boolean {
  return !sperrenFuer(row, showGemerkt).verschieben;
}

/**
 * Zeile `from` an Stelle `to` setzen. Gesperrte oder ungültige Verschiebung gibt
 * dieselbe Liste zurück (gleiche Referenz). Da nur eigene Zeilen wandern, bleibt die
 * relative Reihenfolge der Ablaufzeilen erhalten; die Zeile hängt danach an der
 * nächsten lebenden Ablaufzeile über ihr (R6).
 */
export function verschiebeZeilen(rows: RundownRow[], from: number, to: number, showGemerkt: boolean): RundownRow[] {
  if (from === to || from < 0 || from >= rows.length || to < 0 || to >= rows.length) return rows;
  if (!darfVerschieben(rows[from], showGemerkt)) return rows;
  const neu = rows.slice();
  const [r] = neu.splice(from, 1);
  neu.splice(to, 0, r);
  return neu;
}

/** Meldung nach dem Regieplan-Import (5.5): Hat der Main abgewiesen, wird nicht Erfolg gemeldet. */
export function importMeldung(anzahl: number, ersetzt: boolean, abweisungenVorher: number, abweisungenNachher: number): string {
  if (abweisungenNachher > abweisungenVorher) {
    return 'Import abgewiesen, Show hat sich geändert – bitte erneut importieren.';
  }
  return `${anzahl} Punkte ${ersetzt ? 'importiert (ersetzt)' : 'angehängt'}.`;
}
