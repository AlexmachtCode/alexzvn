import { useMemo, useRef, useState } from 'react';
import {
  inspectXlsx,
  extractRows,
  downloadTemplate,
  exportTimetable,
  type InspectResult,
  type ColumnMapping,
} from '@/lib/xlsx';
import { formatTimeOfDay } from '@jm/regieplan';
import { formatHMS } from '@/lib/time';
import { useStore } from '@/store/timer';
import { Button } from '@jm/ui';
import { Card } from '@jm/ui';
import { SectionHeader } from './ui/SectionHeader';
import { cn } from '@jm/ui';

interface Props {
  open: boolean;
  onClose: () => void;
}

const EMPTY_MAPPING: ColumnMapping = { label: null, start: null, duration: null, note: null };

export function XlsxImport({ open, onClose }: Props) {
  const ttSetAll = useStore((s) => s.ttSetAll);
  const ttAdd = useStore((s) => s.ttAdd);
  const items = useStore((s) => s.timetable.items);
  const [inspection, setInspection] = useState<InspectResult | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>(EMPTY_MAPPING);
  const [filename, setFilename] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'replace' | 'append'>('replace');
  const inputRef = useRef<HTMLInputElement | null>(null);

  const extracted = useMemo(
    () =>
      inspection
        ? extractRows(inspection.rawRows, inspection.headerRow, mapping)
        : { rows: [], skippedRows: 0 },
    [inspection, mapping],
  );

  if (!open) return null;

  async function handleFile(file: File) {
    setError(null);
    setFilename(file.name);
    try {
      const buf = await file.arrayBuffer();
      const r = await inspectXlsx(buf);
      if (r.availableColumns.length === 0) {
        setError('Die Datei enthält keine lesbaren Spalten.');
        setInspection(null);
        return;
      }
      setInspection(r);
      setMapping(r.columns);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Datei konnte nicht gelesen werden.');
      setInspection(null);
    }
  }

  function setField(field: keyof ColumnMapping, key: string) {
    setMapping((m) => ({ ...m, [field]: key === '' ? null : key }));
  }

  const canImport = !!mapping.label && !!mapping.duration && extracted.rows.length > 0;

  function confirmImport() {
    if (!canImport) return;
    if (mode === 'replace') {
      ttSetAll(extracted.rows);
    } else {
      for (const row of extracted.rows) ttAdd(row);
    }
    handleClose();
  }

  function handleClose() {
    setInspection(null);
    setMapping(EMPTY_MAPPING);
    setFilename(null);
    setError(null);
    setMode('replace');
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[820px] max-h-[85vh] overflow-hidden">
        <Card>
          <div className="p-6 flex flex-col gap-5 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <SectionHeader>XLSX · Regieplan importieren</SectionHeader>
              <button
                type="button"
                onClick={handleClose}
                className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-sm"
                aria-label="Schließen"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-[var(--muted-foreground)]">
              Die App erkennt Spalten für <b>Titel</b>, <b>Startzeit</b>, <b>Dauer</b> und <b>Notiz</b>{' '}
              automatisch. Passt die Zuordnung nicht, korrigiere sie unten — die Vorschau aktualisiert sich sofort.
            </p>

            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.xlsm,.csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = '';
              }}
            />

            <div className="flex items-center gap-3">
              <Button onClick={() => inputRef.current?.click()}>Datei auswählen</Button>
              <Button variant="outline" onClick={() => void downloadTemplate()}>
                Vorlage herunterladen
              </Button>
              <Button
                variant="outline"
                onClick={() => void exportTimetable(items)}
                disabled={items.length === 0}
                title="Aktuellen Ablauf als Regieplan (Excel) exportieren — z. B. für JM Rundown"
              >
                Ablauf exportieren
              </Button>
              {filename && <span className="text-sm text-[var(--muted-foreground)] truncate">{filename}</span>}
            </div>
            <p className="-mt-2 text-xs text-[var(--muted-foreground)]">
              Noch keine Datei? Lade die Vorlage herunter, fülle sie aus und importiere sie wieder.
            </p>

            {error && <div className="text-sm text-[var(--destructive)]">{error}</div>}

            {inspection && (
              <>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <Meta label="Tabellenblatt" value={inspection.sheetName} />
                  <Meta
                    label="Kopfzeile"
                    value={
                      inspection.headerRow >= 0
                        ? `Zeile ${inspection.headerRow + 1}`
                        : 'Ohne Kopfzeile (positional)'
                    }
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)] font-extrabold">
                    Spalten-Zuordnung
                  </span>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <MapSelect label="Titel" required field="label" value={mapping.label} columns={inspection.availableColumns} onChange={setField} />
                    <MapSelect label="Startzeit" field="start" value={mapping.start} columns={inspection.availableColumns} onChange={setField} />
                    <MapSelect label="Dauer" required field="duration" value={mapping.duration} columns={inspection.availableColumns} onChange={setField} />
                    <MapSelect label="Notiz" field="note" value={mapping.note} columns={inspection.availableColumns} onChange={setField} />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 text-xs">
                  <Meta label="Items erkannt" value={`${extracted.rows.length}`} accent />
                  <Meta label="Übersprungen" value={`${extracted.skippedRows}`} />
                  <Meta label="Gesamt-Dauer" value={formatHMS(extracted.rows.reduce((s, r) => s + r.durationMs, 0))} />
                </div>

                <div className="rounded-[var(--radius-md)] border border-[var(--border)]/40 overflow-hidden">
                  <div className="grid grid-cols-[40px_minmax(0,1fr)_80px_110px_minmax(0,1fr)] gap-2 px-3 py-2 bg-[var(--card)]/60 text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)] font-extrabold">
                    <span>#</span>
                    <span>Titel</span>
                    <span className="text-center">Start</span>
                    <span className="text-center">Dauer</span>
                    <span>Notiz</span>
                  </div>
                  <div className="divide-y divide-[var(--border)]/40 max-h-[260px] overflow-y-auto">
                    {extracted.rows.slice(0, 50).map((row, i) => (
                      <div
                        key={i}
                        className="grid grid-cols-[40px_minmax(0,1fr)_80px_110px_minmax(0,1fr)] gap-2 px-3 py-2 text-sm"
                      >
                        <span className="text-[var(--muted-foreground)] tabular text-xs">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <span className="truncate font-semibold">{row.label}</span>
                        <span className="text-center tabular text-xs">
                          {formatTimeOfDay(row.plannedStartMs) || '—'}
                        </span>
                        <span className="text-center tabular">{formatHMS(row.durationMs)}</span>
                        <span className="truncate text-[var(--muted-foreground)] text-xs">{row.note ?? '—'}</span>
                      </div>
                    ))}
                    {extracted.rows.length === 0 && (
                      <div className="px-3 py-6 text-center text-xs text-[var(--muted-foreground)]">
                        Keine Zeilen — prüfe die Spalten-Zuordnung (Titel und Dauer nötig).
                      </div>
                    )}
                    {extracted.rows.length > 50 && (
                      <div className="px-3 py-2 text-center text-xs text-[var(--muted-foreground)]">
                        … +{extracted.rows.length - 50} weitere
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-2">
                  <div className="flex rounded-[var(--radius)] overflow-hidden border border-[var(--border)]">
                    <ToggleBtn active={mode === 'replace'} onClick={() => setMode('replace')}>
                      Ersetzen
                    </ToggleBtn>
                    <ToggleBtn active={mode === 'append'} onClick={() => setMode('append')}>
                      Anhängen
                    </ToggleBtn>
                  </div>
                  <div className="flex items-center gap-2">
                    {!canImport && (
                      <span className="text-xs text-[var(--muted-foreground)]">
                        Ordne Titel und Dauer einer Spalte zu.
                      </span>
                    )}
                    <Button variant="outline" onClick={handleClose}>
                      Abbrechen
                    </Button>
                    <Button variant="primary" onClick={confirmImport} disabled={!canImport}>
                      Importieren
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function MapSelect({
  label,
  field,
  value,
  columns,
  onChange,
  required,
}: {
  label: string;
  field: keyof ColumnMapping;
  value: string | null;
  columns: Array<{ key: string; header: string; sample: string }>;
  onChange: (field: keyof ColumnMapping, key: string) => void;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 min-w-0">
      <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)] font-extrabold">
        {label}
        {required && <span className="text-[var(--destructive)]"> *</span>}
      </span>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(field, e.target.value)}
        className={cn(
          'h-10 px-2 rounded-[var(--radius)] bg-[var(--background)]/40 border text-sm truncate',
          required && !value ? 'border-[var(--destructive)]/60' : 'border-[var(--border)]',
        )}
      >
        <option value="">— (keine)</option>
        {columns.map((c) => (
          <option key={c.key} value={c.key}>
            {(c.header || `Spalte ${c.key}`) + (c.sample ? ` · Bsp: ${c.sample}` : '')}
          </option>
        ))}
      </select>
    </label>
  );
}

function Meta({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-1 p-3 rounded-[var(--radius)] bg-[var(--background)]/40 border border-[var(--border)]/40">
      <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">{label}</span>
      <span className={cn('text-sm font-extrabold tabular', accent && 'text-[var(--primary)]')}>{value}</span>
    </div>
  );
}

function ToggleBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-10 px-4 text-xs uppercase tracking-wide font-extrabold transition-colors',
        active
          ? 'bg-[var(--accent)] text-[var(--foreground)]'
          : 'bg-transparent text-[var(--muted-foreground)] hover:bg-[var(--highlight)]',
      )}
    >
      {children}
    </button>
  );
}
