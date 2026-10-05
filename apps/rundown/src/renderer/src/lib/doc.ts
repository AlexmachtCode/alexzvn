// Reine Dokument-Mutationen für den Editor (geben immer ein NEUES Doc zurück;
// der Renderer schickt es per setDoc an den Main, der es persistiert).
import { newId } from '@shared/conductor';
import { ersetzeEigeneZeilen } from '@shared/scharf';
import { aktionAendern, dupliziereZeile } from '@shared/zeilen';
import type { RundownAction, RundownDoc, RundownRow } from '@shared/types';

function withRows(doc: RundownDoc, rows: RundownRow[]): RundownDoc {
  return { ...doc, rows };
}

export function updateRow(doc: RundownDoc, rowId: string, patch: Partial<RundownRow>): RundownDoc {
  return withRows(
    doc,
    doc.rows.map((r) => (r.id === rowId ? { ...r, ...patch } : r)),
  );
}

export function addRow(doc: RundownDoc, afterIndex: number): RundownDoc {
  const rows = doc.rows.slice();
  rows.splice(afterIndex + 1, 0, { id: newId('r'), label: 'Neue Zeile', actions: [] });
  return withRows(doc, rows);
}

/**
 * Zeilen aus einem importierten Regieplan (Issue #82) bauen — je Punkt eine Zeile
 * mit Titel + optionaler Notiz, noch ohne Aktionen (die legt der Operator an).
 */
export function rowsFromImport(
  items: { label: string; note?: string; durationMs?: number }[],
): RundownRow[] {
  return items.map((it) => ({
    id: newId('r'),
    label: it.label,
    ...(it.note ? { note: it.note } : {}),
    // Dauer aus dem Regieplan mitführen (Issue #85, Timer-Austausch).
    ...(it.durationMs && it.durationMs > 0 ? { durationMs: it.durationMs } : {}),
    actions: [],
  }));
}

/**
 * Importierte Zeilen ins Dokument übernehmen — ersetzen oder anhängen. Ist eine
 * Show gemerkt, ersetzt „Ersetzen“ nur die eigenen Zeilen: Ablaufzeilen und
 * entfallene Zeilen bleiben, die importierten kommen ans Ende (4.5).
 */
export function applyImportedRows(
  doc: RundownDoc,
  rows: RundownRow[],
  replace: boolean,
  showGemerkt = false,
): RundownDoc {
  if (!replace) return withRows(doc, [...doc.rows, ...rows]);
  return withRows(doc, showGemerkt ? ersetzeEigeneZeilen(doc.rows, rows) : rows);
}

export function removeRow(doc: RundownDoc, rowId: string): RundownDoc {
  return withRows(
    doc,
    doc.rows.filter((r) => r.id !== rowId),
  );
}

export function moveRow(doc: RundownDoc, from: number, to: number): RundownDoc {
  if (to < 0 || to >= doc.rows.length) return doc;
  const rows = doc.rows.slice();
  const [r] = rows.splice(from, 1);
  rows.splice(to, 0, r);
  return withRows(doc, rows);
}

/**
 * Dupliziert eine Zeile inkl. all ihrer Aktionen direkt darunter. Alle IDs (Zeile
 * + Aktionen) werden neu vergeben, damit Original und Kopie unabhängig bleiben;
 * `args` wird kopiert (kein geteiltes Array). Label bekommt einen „(Kopie)"-Zusatz.
 * Die Kopie ist immer eine eigene Zeile, auch die einer Ablaufzeile (4.5). Die
 * Logik liegt in @shared/zeilen, damit der Selbsttest sie ohne Vite prüft.
 */
export function duplicateRow(doc: RundownDoc, rowId: string): RundownDoc {
  return dupliziereZeile(doc, rowId, newId);
}

/** Dupliziert eine Aktion innerhalb ihrer Zeile direkt darunter (neue ID, kopierte args). */
export function duplicateAction(doc: RundownDoc, rowId: string, actionId: string): RundownDoc {
  const row = doc.rows.find((r) => r.id === rowId);
  if (!row) return doc;
  const idx = row.actions.findIndex((a) => a.id === actionId);
  if (idx < 0) return doc;
  const src = row.actions[idx];
  const copy: RundownAction = { ...src, id: newId('a'), args: src.args.slice() };
  const actions = row.actions.slice();
  actions.splice(idx + 1, 0, copy);
  return updateRow(doc, rowId, { actions });
}

export function addAction(doc: RundownDoc, rowId: string): RundownDoc {
  const row = doc.rows.find((r) => r.id === rowId);
  if (!row) return doc;
  const action: RundownAction = { id: newId('a'), role: 'timer', verb: 'start', args: [], enabled: true };
  return updateRow(doc, rowId, { actions: [...row.actions, action] });
}

export function updateAction(
  doc: RundownDoc,
  rowId: string,
  actionId: string,
  patch: Partial<RundownAction>,
): RundownDoc {
  const row = doc.rows.find((r) => r.id === rowId);
  if (!row) return doc;
  // Teil 2b (Spec 8.1): aktionAendern entfernt die Speaker-Kennung, wenn Rolle, Verb oder der Name sich ändern.
  return updateRow(doc, rowId, {
    actions: row.actions.map((a) => (a.id === actionId ? aktionAendern(a, patch) : a)),
  });
}

export function removeAction(doc: RundownDoc, rowId: string, actionId: string): RundownDoc {
  const row = doc.rows.find((r) => r.id === rowId);
  if (!row) return doc;
  return updateRow(doc, rowId, { actions: row.actions.filter((a) => a.id !== actionId) });
}
