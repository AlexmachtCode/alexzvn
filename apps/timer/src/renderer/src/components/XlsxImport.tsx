import { useRef, useState } from 'react';
import { parseXlsx, downloadTemplate, exportTimetable, type ParseResult } from '@/lib/xlsx';
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

export function XlsxImport({ open, onClose }: Props) {
  const ttSetAll = useStore((s) => s.ttSetAll);
  const items = useStore((s) => s.timetable.items);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'replace' | 'append'>('replace');
  const ttAdd = useStore((s) => s.ttAdd);
  const inputRef = useRef<HTMLInputElement | null>(null);

  if (!open) return null;

  async function handleFile(file: File) {
    setError(null);
    setFilename(file.name);
    try {
      const buf = await file.arrayBuffer();
      const r = await parseXlsx(buf);
      if (r.rows.length === 0) {
        setError(
          'Keine gültigen Zeilen erkannt. Erwartet werden Spalten für Titel + Dauer (z. B. „Programmpunkt", „Dauer").',
        );
      }
      setResult(r);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Datei konnte nicht gelesen werden.');
      setResult(null);
    }
  }

  function confirmImport() {
    if (!result) return;
    if (mode === 'replace') {
      ttSetAll(result.rows);
    } else {
      for (const row of result.rows) ttAdd(row);
    }
    handleClose();
  }

  function handleClose() {
    setResult(null);
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
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[820px] max-h-[85vh] overflow-hidden"
      >
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
              Die App erkennt automatisch Spalten für <b>Titel / Programmpunkt</b>, <b>Dauer</b>{' '}
              und (optional) <b>Notiz</b>. Dauern werden als <code>HH:MM:SS</code>, <code>MM:SS</code>,
              Excel-Zeit oder reine Zahl in Minuten interpretiert.
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
              <Button onClick={() => inputRef.current?.click()}>
                Datei auswählen
              </Button>
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
              {filename && (
                <span className="text-sm text-[var(--muted-foreground)] truncate">
                  {filename}
                </span>
              )}
            </div>
            <p className="-mt-2 text-xs text-[var(--muted-foreground)]">
              Noch keine Datei? Lade die Vorlage herunter, fülle sie aus und importiere sie wieder.
            </p>

            {error && <div className="text-sm text-[var(--destructive)]">{error}</div>}

            {result && (
              <>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <Meta label="Tabellenblatt" value={result.source.sheetName} />
                  <Meta
                    label="Header"
                    value={
                      result.source.headerRow >= 0
                        ? `Zeile ${result.source.headerRow + 1}`
                        : 'Positional A/B/C'
                    }
                  />
                  <Meta
                    label="Spalten"
                    value={
                      [
                        result.source.columns.label && `T:${result.source.columns.label}`,
                        result.source.columns.start && `S:${result.source.columns.start}`,
                        result.source.columns.duration &&
                          `D:${result.source.columns.duration}`,
                        result.source.columns.note && `N:${result.source.columns.note}`,
                      ]
                        .filter(Boolean)
                        .join(' · ') || '–'
                    }
                  />
                  <Meta
                    label="Items erkannt"
                    value={`${result.rows.length}`}
                    accent
                  />
                  <Meta
                    label="Übersprungen"
                    value={`${result.source.skippedRows}`}
                  />
                  <Meta
                    label="Gesamt-Dauer"
                    value={formatHMS(
                      result.rows.reduce((sum, r) => sum + r.durationMs, 0),
                    )}
                  />
                </div>

                <div className="rounded-[var(--radius-md)] border border-[var(--border)]/40 overflow-hidden">
                  <div className="grid grid-cols-[40px_minmax(0,1fr)_80px_110px_minmax(0,1fr)] gap-2 px-3 py-2 bg-[var(--card)]/60 text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)] font-extrabold">
                    <span>#</span>
                    <span>Titel</span>
                    <span className="text-center">Start</span>
                    <span className="text-center">Dauer</span>
                    <span>Notiz</span>
                  </div>
                  <div className="divide-y divide-[var(--border)]/40 max-h-[280px] overflow-y-auto">
                    {result.rows.slice(0, 50).map((row, i) => (
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
                        <span className="text-center tabular">
                          {formatHMS(row.durationMs)}
                        </span>
                        <span className="truncate text-[var(--muted-foreground)] text-xs">
                          {row.note ?? '—'}
                        </span>
                      </div>
                    ))}
                    {result.rows.length > 50 && (
                      <div className="px-3 py-2 text-center text-xs text-[var(--muted-foreground)]">
                        … +{result.rows.length - 50} weitere
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-2">
                  <div className="flex rounded-[var(--radius)] overflow-hidden border border-[var(--border)]">
                    <ToggleBtn
                      active={mode === 'replace'}
                      onClick={() => setMode('replace')}
                    >
                      Ersetzen
                    </ToggleBtn>
                    <ToggleBtn
                      active={mode === 'append'}
                      onClick={() => setMode('append')}
                    >
                      Anhängen
                    </ToggleBtn>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={handleClose}>
                      Abbrechen
                    </Button>
                    <Button
                      variant="primary"
                      onClick={confirmImport}
                      disabled={result.rows.length === 0}
                    >
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

function Meta({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 p-3 rounded-[var(--radius)] bg-[var(--background)]/40 border border-[var(--border)]/40">
      <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
        {label}
      </span>
      <span
        className={cn(
          'text-sm font-extrabold tabular',
          accent && 'text-[var(--primary)]',
        )}
      >
        {value}
      </span>
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
