// Dünner Wrapper um @jm/regieplan mit Timer-Defaults: die Dauer ist beim Timer
// Pflicht (Countdown), und der Export trägt Timer-Dateinamen + eine Beispiel-
// vorlage. Die gemeinsame Parse-/Export-Logik (mit JM Rundown geteilt) liegt im
// Paket — vorher war sie hier dupliziert.
import { parseRegieplan, inspectRegieplan, extractRowsFromMapping, rowsToAoa, exportRegieplanXlsx, REGIEPLAN_HEADER } from '@jm/regieplan';
import type { ColumnMapping } from '@jm/regieplan';

export type { ParsedRow, ParseResult, InspectResult, ColumnMapping, AvailableColumn } from '@jm/regieplan';

/** XLSX/XLS/CSV in Timetable-Items parsen — Timer: Dauer-Spalte erforderlich. */
export function parseXlsx(buffer: ArrayBuffer) {
  return parseRegieplan(buffer, { requireDuration: true });
}

/** Datei inspizieren (Timer: Dauer für die Auto-Vorbelegung bevorzugt). */
export function inspectXlsx(buffer: ArrayBuffer) {
  return inspectRegieplan(buffer, { requireDuration: true });
}

/** Zeilen aus einem (evtl. manuell korrigierten) Mapping bauen — Timer: Dauer Pflicht. */
export function extractRows(
  rawRows: Array<Record<string, unknown>>,
  headerRow: number,
  mapping: ColumnMapping,
) {
  return extractRowsFromMapping(rawRows, headerRow, mapping, { requireDuration: true });
}

/**
 * Beispiel-XLSX (Header + Beispielzeilen) zum Download anbieten (Issue #11a).
 * Spalten entsprechen exakt der Auto-Erkennung beim Import.
 */
export async function downloadTemplate(): Promise<void> {
  await exportRegieplanXlsx(
    [
      [...REGIEPLAN_HEADER],
      ['Begrüßung', '09:00', '00:05:00', 'Einlauf / Moderation'],
      ['Keynote', '', '00:30:00', ''],
      ['Pause', '', '00:15:00', 'Catering'],
      ['Podiumsdiskussion', '12:00', '00:45:00', '3 Gäste (Fixslot)'],
      ['Abschluss', '', '00:10:00', ''],
    ],
    'JM-Timer-Regieplan-Vorlage.xlsx',
  );
}

/**
 * Den AKTUELLEN Ablauf als Regieplan-XLSX herunterladen (Issue #85) — dasselbe
 * Format, das JM Rundown importiert (und umgekehrt).
 */
export async function exportTimetable(
  items: Array<{ label: string; durationMs: number; note?: string; plannedStartMs?: number }>,
): Promise<void> {
  await exportRegieplanXlsx(rowsToAoa(items), 'JM-Timer-Ablauf.xlsx');
}
