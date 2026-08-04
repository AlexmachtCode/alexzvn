// Dünner Wrapper um @jm/regieplan mit Timer-Defaults: die Dauer ist beim Timer
// Pflicht (Countdown), und der Export trägt Timer-Dateinamen + eine Beispiel-
// vorlage. Die gemeinsame Parse-/Export-Logik (mit JM Rundown geteilt) liegt im
// Paket — vorher war sie hier dupliziert.
import { parseRegieplan, rowsToAoa, exportRegieplanXlsx, REGIEPLAN_HEADER } from '@jm/regieplan';

export type { ParsedRow, ParseResult } from '@jm/regieplan';

/** XLSX/XLS/CSV in Timetable-Items parsen — Timer: Dauer-Spalte erforderlich. */
export function parseXlsx(buffer: ArrayBuffer) {
  return parseRegieplan(buffer, { requireDuration: true });
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
