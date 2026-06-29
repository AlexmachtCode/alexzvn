// Dünner Wrapper um @jm/regieplan mit Rundown-Defaults: die Dauer ist hier
// optional (ein Regieplan ist oft nur eine Punkteliste). Gemeinsame Parse-/
// Export-Logik (mit JM Timer geteilt) liegt im Paket — vorher hier dupliziert.
import { parseRegieplan as parseSheet, rowsToAoa, exportRegieplanXlsx } from '@jm/regieplan';

// Rundown-Namen für die bestehende interne API beibehalten.
export type { ParsedRow as ParsedRegieRow, ParseResult as RegieParseResult } from '@jm/regieplan';

/** Eine XLSX/XLS/CSV-Datei in Regieplan-Zeilen parsen (Dauer optional). */
export function parseRegieplan(data: Uint8Array | ArrayBuffer) {
  return parseSheet(data, { requireDuration: false });
}

/**
 * Den aktuellen Ablauf als Regieplan-XLSX herunterladen (Issue #85). Spalten
 * Programmpunkt / Dauer (HH:MM:SS) / Notiz — dasselbe Format, das der JM Timer
 * importiert. So wandert ein in Rundown gepflegter Ablauf direkt in den Timer.
 */
export async function exportRegieplan(
  rows: { label: string; durationMs?: number; note?: string }[],
  filename = 'JM-Rundown-Regieplan.xlsx',
): Promise<void> {
  await exportRegieplanXlsx(rowsToAoa(rows), filename);
}
