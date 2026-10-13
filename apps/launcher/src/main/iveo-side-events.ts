// ─────────────────────────────────────────────────────────────────────────────
// Side-Event-Liste der Show (Master-Link Teil 2b, Release 2, Spec 15.4) — rein, OHNE Electron.
//
// Binden (iveo-sync.ts) und der Abgleich-Kern (iveo-abgleich-kern.ts: Listen-Abfrage, Tagesübersicht,
// Agenda-Abfrage) bilden die Liste mit DERSELBEN Funktion. Sonst wiche die Liste einer Abfrage von der
// gebundenen ab, und jede Abfrage schriebe und schickte RELOAD (Spec 7.2).
// ─────────────────────────────────────────────────────────────────────────────

import { filterPrograms, programDayKey, type IveoProgram, type IveoProgramFilter } from '@jm/iveo';
import type { ShowIveoProgramRef } from '@jm/show';
import type { IveoProgramRef } from '@shared/types';

/** Leichte Programm-Referenzen (id/title/day) für die Side-Event-Auswahl im Editor, nach Tag und Startzeit sortiert. */
export function toProgramList(programs: IveoProgram[]): IveoProgramRef[] {
  return [...programs]
    .sort((a, b) => {
      const da = programDayKey(a);
      const db = programDayKey(b);
      if (da !== db) return da.localeCompare(db);
      return (a.starts_at_local || a.starts_at || '').localeCompare(b.starts_at_local || b.starts_at || '');
    })
    .map((p) => ({ id: p.id, title: p.title?.trim() || '(ohne Titel)', day: programDayKey(p) }));
}

/**
 * Side Events des Tages, token-frei (Spec 15.4, wie beim Binden): Programme nach dem Filter OHNE `programId`
 * (Typ, Format, Tag, ohne Blocker), daraus `{ id, title }` in der Reihenfolge von `toProgramList`.
 */
export function bildeSideEventListe(programs: IveoProgram[], filter: IveoProgramFilter): ShowIveoProgramRef[] {
  const tagesFilter: IveoProgramFilter = {
    typeSlug: filter.typeSlug,
    formatSlug: filter.formatSlug,
    day: filter.day,
    excludeBlockers: filter.excludeBlockers,
  };
  return toProgramList(filterPrograms(programs, tagesFilter)).map((p) => ({ id: p.id, title: p.title }));
}
