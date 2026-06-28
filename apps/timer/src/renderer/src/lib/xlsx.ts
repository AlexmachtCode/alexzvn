export interface ParsedRow {
  label: string;
  durationMs: number;
  note?: string;
}

export interface ParseResult {
  rows: ParsedRow[];
  source: {
    sheetName: string;
    headerRow: number; // 0-based; -1 means "no header detected"
    columns: { label: string | null; duration: string | null; note: string | null };
    totalRows: number;
    skippedRows: number;
  };
}

const LABEL_KEYWORDS = /titel|programmpunkt|programm|punkt|item|label|name|topic|inhalt|thema/;
const DURATION_KEYWORDS = /dauer|duration|laenge|länge|length|time|zeit/;
const NOTE_KEYWORDS = /notiz|note|bemerkung|kommentar|info|hinweis|anmerkung/;

/** Parse an XLSX/XLS ArrayBuffer into normalised TimetableItems.
 *  SheetJS is loaded lazily — the ~700 KB chunk only ships when the user
 *  actually imports a file.
 */
export async function parseXlsx(buffer: ArrayBuffer): Promise<ParseResult> {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error('Datei enthält kein Tabellenblatt.');
  const ws = wb.Sheets[sheetName];

  // Read raw rows by column letter so we keep arbitrary headers
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    header: 'A',
    raw: true,
    defval: '',
  });

  const { headerIdx, columns } = detectHeader(rawRows);

  const rows: ParsedRow[] = [];
  let skipped = 0;
  for (let i = headerIdx + 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    const label =
      columns.label !== null ? String(row[columns.label] ?? '').trim() : '';
    const durationRaw = columns.duration !== null ? row[columns.duration] : undefined;
    const note =
      columns.note !== null ? String(row[columns.note] ?? '').trim() : '';

    const durationMs = parseDuration(durationRaw);
    if (!label || durationMs <= 0) {
      skipped += 1;
      continue;
    }
    rows.push({ label, durationMs, note: note || undefined });
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

/**
 * Erzeugt eine Beispiel-XLSX (Header + Beispielzeilen) und bietet sie zum
 * Download an (Issue #11a). Die Spalten entsprechen exakt der Auto-Erkennung
 * beim Import (Programmpunkt / Dauer / Notiz), die Dauern sind als HH:MM:SS
 * geschrieben. SheetJS wird wie beim Import erst hier lazy geladen.
 */
export async function downloadTemplate(): Promise<void> {
  await buildAndDownload(
    [
      ['Programmpunkt', 'Dauer', 'Notiz'],
      ['Begrüßung', '00:05:00', 'Einlauf / Moderation'],
      ['Keynote', '00:30:00', ''],
      ['Pause', '00:15:00', 'Catering'],
      ['Podiumsdiskussion', '00:45:00', '3 Gäste'],
      ['Abschluss', '00:10:00', ''],
    ],
    'JM-Timer-Regieplan-Vorlage.xlsx',
  );
}

/**
 * Den AKTUELLEN Ablauf als Regieplan-XLSX herunterladen (Issue #85). Spalten +
 * HH:MM:SS-Dauern entsprechen dem Import — so wandert der Timer-Ablauf direkt ins
 * JM Rundown (und umgekehrt: Rundown exportiert dasselbe Format).
 */
export async function exportTimetable(
  items: Array<{ label: string; durationMs: number; note?: string }>,
): Promise<void> {
  await buildAndDownload(
    [
      ['Programmpunkt', 'Dauer', 'Notiz'],
      ...items.map((it) => [it.label, hms(it.durationMs), it.note ?? '']),
    ],
    'JM-Timer-Ablauf.xlsx',
  );
}

/** ms → "HH:MM:SS" (Export-Spaltenformat). Leer bei 0. */
function hms(ms: number): string {
  if (!ms || ms <= 0) return '';
  const total = Math.round(ms / 1000);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

/** Eine AoA als XLSX („Regieplan"-Blatt) bauen und im Browser herunterladen. */
async function buildAndDownload(aoa: string[][], filename: string): Promise<void> {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 28 }, { wch: 12 }, { wch: 32 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Regieplan');
  const data = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  const blob = new Blob([data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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
  // Scan the first 5 rows for a header
  const scanLimit = Math.min(5, rows.length);
  for (let i = 0; i < scanLimit; i++) {
    const row = rows[i];
    const cols = matchHeader(row);
    if (cols.label !== null && cols.duration !== null) {
      return { headerIdx: i, columns: cols };
    }
  }
  // Fallback — assume column A = label, B = duration, C = note (positional)
  return {
    headerIdx: -1,
    columns: { label: 'A', duration: 'B', note: 'C' },
  };
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
 * Parse a duration cell into milliseconds. Accepts:
 *   - Excel time fraction: 0.0034722 → 5 min
 *   - Date object (Excel time-only cell parsed by SheetJS)
 *   - "HH:MM:SS" / "MM:SS"
 *   - "5 min" / "5m"
 *   - plain number → interpreted as minutes
 */
function parseDuration(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;

  if (value instanceof Date) {
    const h = value.getUTCHours();
    const m = value.getUTCMinutes();
    const s = value.getUTCSeconds();
    return ((h * 60 + m) * 60 + s) * 1000;
  }

  if (typeof value === 'number') {
    // Excel time-of-day is a fraction of one day (0..1)
    if (value > 0 && value < 1) return Math.round(value * 86_400_000);
    // Otherwise we interpret as minutes
    if (value >= 1) return Math.round(value * 60_000);
    return 0;
  }

  if (typeof value === 'string') {
    const s = value.trim();
    if (!s) return 0;

    const hms = s.match(/^(\d{1,2}):(\d{1,2}):(\d{1,2})$/);
    if (hms) {
      const [, h, m, ss] = hms;
      return ((Number(h) * 60 + Number(m)) * 60 + Number(ss)) * 1000;
    }

    const ms = s.match(/^(\d{1,2}):(\d{1,2})$/);
    if (ms) {
      const [, m, ss] = ms;
      return (Number(m) * 60 + Number(ss)) * 1000;
    }

    const minSuffix = s.match(/^(\d+(?:[.,]\d+)?)\s*(min|m)$/i);
    if (minSuffix) {
      return Math.round(Number(minSuffix[1].replace(',', '.')) * 60_000);
    }

    const num = Number(s.replace(',', '.'));
    if (!Number.isNaN(num)) return Math.round(num * 60_000);
  }

  return 0;
}
