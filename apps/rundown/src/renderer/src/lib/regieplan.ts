// Regieplan-Import (Issue #82): eine Excel-/CSV-Tabelle in Rundown-Zeilen
// überführen. Spalten werden per Schlüsselwort erkannt (Titel / Dauer / Notiz),
// genau wie der JM-Timer-Import — so ist dasselbe Tabellenformat zwischen Timer
// und Rundown austauschbar (Vorarbeit für #85). Unterschied zum Timer: die DAUER
// ist optional (ein Regieplan ist oft nur eine Punkteliste), Zeilen mit Label
// bleiben erhalten. SheetJS wird lazy geladen (~700 KB nur beim Import).

export interface ParsedRegieRow {
  label: string;
  /** Dauer in ms, sofern eine Dauer-Spalte erkannt wurde (sonst 0). Für #85. */
  durationMs: number;
  note?: string;
}

export interface RegieParseResult {
  rows: ParsedRegieRow[];
  source: {
    sheetName: string;
    headerRow: number; // 0-basiert; -1 = kein Header erkannt (positionsbasiert)
    columns: { label: string | null; duration: string | null; note: string | null };
    totalRows: number;
    skippedRows: number;
  };
}

const LABEL_KEYWORDS = /titel|programmpunkt|programm|punkt|item|label|name|topic|inhalt|thema|regie/;
const DURATION_KEYWORDS = /dauer|duration|laenge|länge|length|time|zeit/;
const NOTE_KEYWORDS = /notiz|note|bemerkung|kommentar|info|hinweis|anmerkung/;

/** Eine XLSX/XLS/CSV-Datei in Regieplan-Zeilen parsen (Dauer optional). */
export async function parseRegieplan(data: Uint8Array | ArrayBuffer): Promise<RegieParseResult> {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(data, { type: 'array', cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error('Datei enthält kein Tabellenblatt.');
  const ws = wb.Sheets[sheetName];

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    header: 'A',
    raw: true,
    defval: '',
  });

  const { headerIdx, columns } = detectHeader(rawRows);

  const rows: ParsedRegieRow[] = [];
  let skipped = 0;
  for (let i = headerIdx + 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    const label = columns.label !== null ? String(row[columns.label] ?? '').trim() : '';
    const durationRaw = columns.duration !== null ? row[columns.duration] : undefined;
    const note = columns.note !== null ? String(row[columns.note] ?? '').trim() : '';
    if (!label) {
      skipped += 1;
      continue; // Dauer ist optional — nur Zeilen OHNE Titel überspringen.
    }
    rows.push({ label, durationMs: parseDuration(durationRaw), note: note || undefined });
  }

  return {
    rows,
    source: {
      sheetName,
      headerRow: headerIdx,
      columns,
      totalRows: rawRows.length - (headerIdx + 1),
      skippedRows: skipped,
    },
  };
}

interface DetectedColumns {
  label: string | null;
  duration: string | null;
  note: string | null;
}

function detectHeader(rows: Array<Record<string, unknown>>): {
  headerIdx: number;
  columns: DetectedColumns;
} {
  const scanLimit = Math.min(5, rows.length);
  for (let i = 0; i < scanLimit; i++) {
    const cols = matchHeader(rows[i]);
    // Für Rundown reicht eine erkannte TITEL-Spalte (Dauer optional).
    if (cols.label !== null) return { headerIdx: i, columns: cols };
  }
  // Fallback — Spalte A = Titel, B = Dauer, C = Notiz (positionsbasiert).
  return { headerIdx: -1, columns: { label: 'A', duration: 'B', note: 'C' } };
}

function matchHeader(row: Record<string, unknown>): DetectedColumns {
  const out: DetectedColumns = { label: null, duration: null, note: null };
  for (const [col, val] of Object.entries(row)) {
    const v = String(val ?? '').toLowerCase().trim();
    if (!v) continue;
    if (out.label === null && LABEL_KEYWORDS.test(v)) out.label = col;
    if (out.duration === null && DURATION_KEYWORDS.test(v)) out.duration = col;
    if (out.note === null && NOTE_KEYWORDS.test(v)) out.note = col;
  }
  return out;
}

/**
 * Dauer-Zelle in Millisekunden. Akzeptiert Excel-Zeitbruch, Date, "HH:MM:SS",
 * "MM:SS", "5 min"/"5m" und reine Zahlen (= Minuten). 0, wenn nicht parsebar.
 */
function parseDuration(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  if (value instanceof Date) {
    return ((value.getUTCHours() * 60 + value.getUTCMinutes()) * 60 + value.getUTCSeconds()) * 1000;
  }
  if (typeof value === 'number') {
    if (value > 0 && value < 1) return Math.round(value * 86_400_000); // Excel-Zeit (Bruchteil eines Tages)
    if (value >= 1) return Math.round(value * 60_000); // sonst Minuten
    return 0;
  }
  if (typeof value === 'string') {
    const s = value.trim();
    if (!s) return 0;
    const hms = s.match(/^(\d{1,2}):(\d{1,2}):(\d{1,2})$/);
    if (hms) return ((Number(hms[1]) * 60 + Number(hms[2])) * 60 + Number(hms[3])) * 1000;
    const ms = s.match(/^(\d{1,2}):(\d{1,2})$/);
    if (ms) return (Number(ms[1]) * 60 + Number(ms[2])) * 1000;
    const minSuffix = s.match(/^(\d+(?:[.,]\d+)?)\s*(min|m)$/i);
    if (minSuffix) return Math.round(Number(minSuffix[1].replace(',', '.')) * 60_000);
    const num = Number(s.replace(',', '.'));
    if (!Number.isNaN(num)) return Math.round(num * 60_000);
  }
  return 0;
}
