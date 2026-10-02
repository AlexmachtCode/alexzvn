/**
 * Show → Timer-Punkte (Teil 2a, Spec 6.1). Aus `src/main/index.ts` hierher gezogen, damit der
 * Selbsttest es ohne Electron laden kann (`node --experimental-strip-types`).
 *
 * Regel (G3): aus `@jm/show` und `./timer-state` NUR Typen importieren — die fallen beim
 * Type-Stripping weg, Laufzeit-Importe würde der Selbsttest nicht auflösen (keine Pfad-Aliase).
 * `hatEigeneTimerListe` ruft deshalb der Main direkt aus `@jm/show` auf, nicht dieses Modul.
 */
import type { ShowAblaufItem } from '@jm/show';
import type { TimetableEingang } from './timer-state';

export type { TimetableEingang };

/**
 * Liest einen Ablaufplan aus den (untrusted) Show-Settings — defensiv. Verhalten unverändert:
 * nur label/durationMs/note, KEINE Kennung — eine eigene Timer-Liste hat keine (Spec 12) und
 * hält beim RELOAD über die Nummer.
 */
export function parseTimetable(raw: unknown): TimetableEingang[] | null {
  if (!Array.isArray(raw)) return null;
  const items = raw
    .filter((it): it is Record<string, unknown> => Boolean(it) && typeof it === 'object')
    .map((it) => ({
      label: typeof it.label === 'string' ? it.label : '',
      durationMs:
        typeof it.durationMs === 'number' && it.durationMs >= 0 ? it.durationMs : 0,
      ...(typeof it.note === 'string' ? { note: it.note } : {}),
    }));
  return items.length ? items : null;
}

/**
 * Zentralen Show-Ablauf (#78) in Timetable-Punkte überführen (gleiche Form). Gibt die Kennung
 * des Ablaufpunkts mit (Teil 2a), damit der Timer beim RELOAD seinen aktiven Punkt über die
 * Kennung hält statt über die Nummer. Ohne Kennung kein `id`-Feld — dann vergibt der Timer eine.
 */
export function ablaufToTimetable(ablauf: ShowAblaufItem[] | undefined): TimetableEingang[] | null {
  if (!ablauf || !ablauf.length) return null;
  return ablauf.map((a) => ({
    ...(a.id ? { id: a.id } : {}),
    label: a.label,
    durationMs: typeof a.durationMs === 'number' && a.durationMs > 0 ? a.durationMs : 0,
    ...(a.note ? { note: a.note } : {}),
    ...(typeof a.plannedStartMs === 'number' ? { plannedStartMs: a.plannedStartMs } : {}),
    ...(a.owner ? { owner: a.owner } : {}),
    ...(a.category ? { category: a.category } : {}),
  }));
}
