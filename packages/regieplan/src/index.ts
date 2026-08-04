// ─────────────────────────────────────────────────────────────────────────────
// @jm/regieplan — geteilte Regieplan-/Ablauf-Tabellenlogik (XLSX/XLS/CSV) für
// JM Timer und JM Rundown.
//
// Vorher war diese Logik dupliziert (apps/timer/.../lib/xlsx.ts +
// apps/rundown/.../lib/regieplan.ts): identisches Dauer-Parsing, dieselbe Spalten-
// Auto-Erkennung und derselbe XLSX-Export. Hier vereint, parametrisiert über
// `requireDuration` — der einzige echte Unterschied: der Timer braucht eine
// Dauer-Spalte (Countdown), der Rundown-Regieplan nicht (oft nur eine Punkteliste).
//
// SheetJS wird LAZY importiert (~700 KB landen nur beim tatsächlichen Im-/Export).
// Der Datei-Download (Blob/anchor) ist DOM und lebt im Renderer der Apps.
// ─────────────────────────────────────────────────────────────────────────────

export interface ParsedRow {
  label: string;
  /** Dauer in ms; 0, wenn keine/keine parsebare Dauer-Spalte. */
  durationMs: number;
  note?: string;
  /** Geplante Startzeit als ms seit Mitternacht (Tageszeit), wenn eine Startzeit-Spalte vorhanden ist. */
  plannedStartMs?: number;
}

export interface ParseResult {
  rows: ParsedRow[];
  source: {
    sheetName: string;
    headerRow: number; // 0-basiert; -1 = kein Header erkannt (positionsbasiert)
    columns: { label: string | null; start: string | null; duration: string | null; note: string | null };
    totalRows: number;
    skippedRows: number;
  };
}

export interface ParseOptions {
  /**
   * true (Timer): eine Zeile braucht Titel UND Dauer>0, und die Header-Erkennung
   * verlangt zusätzlich eine Dauer-Spalte. false (Rundown, Default): nur ein Titel
   * genügt, die Dauer ist optional.
   */
  requireDuration?: boolean;
}

const LABEL_KEYWORDS =
  /titel|programmpunkt|programm|punkt|item|label|name|topic|inhalt|thema|regie/;
const DURATION_KEYWORDS = /dauer|duration|laenge|länge|length|time|zeit/;
const START_KEYWORDS = /startzeit|beginn|uhrzeit|clock|^\s*start\s*$/;
const NOTE_KEYWORDS = /notiz|note|bemerkung|kommentar|info|hinweis|anmerkung/;

/** Standard-Spaltenüberschriften des Export-Formats (Import-kompatibel). */
export const REGIEPLAN_HEADER = ['Programmpunkt', 'Startzeit', 'Dauer', 'Notiz'] as const;

interface DetectedColumns {
  label: string | null;
  start: string | null;
  duration: string | null;
  note: string | null;
}

function matchHeader(row: Record<string, unknown>): DetectedColumns {
  const out: DetectedColumns = { label: null, start: null, duration: null, note: null };
  for (const [col, val] of Object.entries(row)) {
    const v = String(val ?? '')
      .toLowerCase()
      .trim();
    if (!v) continue;
    if (out.label === null && LABEL_KEYWORDS.test(v)) out.label = col;
    // Start VOR Dauer: "Startzeit" enthält "zeit" und würde sonst als Dauer erkannt.
    if (out.start === null && START_KEYWORDS.test(v)) out.start = col;
    if (out.duration === null && col !== out.start && DURATION_KEYWORDS.test(v)) out.duration = col;
    if (out.note === null && NOTE_KEYWORDS.test(v)) out.note = col;
  }
  return out;
}

function detectHeader(
  rows: Array<Record<string, unknown>>,
  requireDuration: boolean,
): { headerIdx: number; columns: DetectedColumns } {
  const scanLimit = Math.min(5, rows.length);
  for (let i = 0; i < scanLimit; i++) {
    const cols = matchHeader(rows[i]);
    const ok = requireDuration ? cols.label !== null && cols.duration !== null : cols.label !== null;
    if (ok) return { headerIdx: i, columns: cols };
  }
  // Fallback — Spalte A = Titel, B = Dauer, C = Notiz (positionsbasiert).
  return { headerIdx: -1, columns: { label: 'A', start: null, duration: 'B', note: 'C' } };
}

/**
 * Eine Dauer-Zelle in Millisekunden. Akzeptiert Excel-Zeitbruch (0..1), Date,
 * "HH:MM:SS", "MM:SS", "5 min"/"5m" und reine Zahlen (= Minuten). 0, wenn nicht
 * parsebar.
 */
export function parseDuration(value: unknown): number {
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

/** ms → "HH:MM:SS" (Export-Spaltenformat). Leer bei 0/ungültig. */
export function formatHms(ms: number | undefined): string {
  if (!ms || ms <= 0) return '';
  const total = Math.round(ms / 1000);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

/**
 * Eine Uhrzeit-Zelle als Millisekunden seit Mitternacht (Tageszeit). Akzeptiert
 * "HH:MM", "HH:MM:SS", Excel-Zeitbruch (0..1) und Date. `null`, wenn nicht
 * eindeutig als Uhrzeit parsebar (eine nackte Zahl ist mehrdeutig → null).
 */
export function parseTimeOfDay(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) {
    return (value.getUTCHours() * 60 + value.getUTCMinutes()) * 60_000 + value.getUTCSeconds() * 1000;
  }
  if (typeof value === 'number') {
    if (value > 0 && value < 1) return Math.round(value * 86_400_000); // Excel-Tageszeit-Bruch
    return null; // nackte Zahl bei einer Uhrzeit-Spalte ist mehrdeutig
  }
  if (typeof value === 'string') {
    const s = value.trim();
    const hms = s.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
    if (hms) {
      const h = Number(hms[1]), m = Number(hms[2]), sec = Number(hms[3]);
      if (h > 23 || m > 59 || sec > 59) return null;
      return (h * 60 + m) * 60_000 + sec * 1000;
    }
    const hm = s.match(/^(\d{1,2}):(\d{2})$/);
    if (hm) {
      const h = Number(hm[1]), m = Number(hm[2]);
      if (h > 23 || m > 59) return null;
      return (h * 60 + m) * 60_000;
    }
  }
  return null;
}

/** ms seit Mitternacht → "HH:MM" (Export-/Anzeigeformat). Leer bei null/undefined. */
export function formatTimeOfDay(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || ms < 0) return '';
  const totalMin = Math.round(ms / 60_000);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${pad(Math.floor(totalMin / 60) % 24)}:${pad(totalMin % 60)}`;
}

/**
 * Eine XLSX/XLS/CSV-Datei in Regieplan-Zeilen parsen. `requireDuration` steuert,
 * ob eine Dauer-Spalte/-Wert nötig ist (Timer) oder optional (Rundown).
 */
export async function parseRegieplan(
  data: ArrayBuffer | Uint8Array,
  opts: ParseOptions = {},
): Promise<ParseResult> {
  const requireDuration = opts.requireDuration ?? false;
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

  const { headerIdx, columns } = detectHeader(rawRows, requireDuration);

  const rows: ParsedRow[] = [];
  let skipped = 0;
  for (let i = headerIdx + 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    const label = columns.label !== null ? String(row[columns.label] ?? '').trim() : '';
    const startRaw = columns.start !== null ? row[columns.start] : undefined;
    const durationRaw = columns.duration !== null ? row[columns.duration] : undefined;
    const note = columns.note !== null ? String(row[columns.note] ?? '').trim() : '';
    const durationMs = parseDuration(durationRaw);
    const plannedStartMs = parseTimeOfDay(startRaw);
    if (!label || (requireDuration && durationMs <= 0)) {
      skipped += 1;
      continue;
    }
    rows.push({ label, durationMs, note: note || undefined, plannedStartMs: plannedStartMs ?? undefined });
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

/** Ablauf-Zeilen → AoA (Header + Zeilen) im Export-Format. */
export function rowsToAoa(
  rows: Array<{ label: string; durationMs?: number; note?: string; plannedStartMs?: number }>,
): string[][] {
  return [
    [...REGIEPLAN_HEADER],
    ...rows.map((r) => [r.label ?? '', formatTimeOfDay(r.plannedStartMs), formatHms(r.durationMs), r.note ?? '']),
  ];
}

/**
 * Eine AoA als „Regieplan"-XLSX bauen und im Browser herunterladen (DOM). Spalten-
 * format ist import-kompatibel — so wandert ein Ablauf zwischen Timer und Rundown.
 */
export async function exportRegieplanXlsx(aoa: string[][], filename: string): Promise<void> {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 28 }, { wch: 10 }, { wch: 12 }, { wch: 32 }];
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
