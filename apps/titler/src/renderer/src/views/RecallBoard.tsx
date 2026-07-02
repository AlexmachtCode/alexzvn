import { useMemo, useState } from 'react';
import { cn, Logo } from '@jm/ui';
import { useTitler } from '@/store/titler';

/**
 * Recall-Button-Board (#152): ein Raster aus Buttons, je einer pro DataLink-
 * Eintrag (z. B. Personenname). Klick ruft den Eintrag ab (RECALL) → dessen
 * Variablen füllen die Bauchbinde. Für einen zweiten Bildschirm/Touch gedacht;
 * live-aktualisiert (teilt sich den Zustand mit dem Operator-Fenster).
 */
export function RecallBoard(): React.JSX.Element {
  const state = useTitler((s) => s.state);
  const entries = state?.status.entries ?? [];
  const activeEntry = state?.status.activeEntry ?? -1;
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return entries
      .map((label, i) => ({ label, i }))
      .filter((e) => !t || e.label.toLowerCase().includes(t));
  }, [entries, q]);

  return (
    <div className="h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)]">
      <header className="h-14 shrink-0 flex items-center gap-3 px-5 border-b border-[var(--border)]/60">
        <Logo size={22} />
        <span className="text-sm font-extrabold tracking-[0.06em]">RECALL-BOARD</span>
        <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
          {entries.length} Einträge
        </span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Suchen…"
          spellCheck={false}
          className="ml-auto h-9 w-56 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-3 text-sm"
        />
      </header>

      {entries.length === 0 ? (
        <div className="flex-1 grid place-items-center px-6 text-center text-sm text-[var(--muted-foreground)]">
          Keine Einträge. Wähle im Operator-Fenster einen DataLink-Ordner (oder öffne eine iveo-Show mit Speakern).
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto p-4">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2">
            {filtered.map(({ label, i }) => (
              <button
                key={`${i}-${label}`}
                onClick={() => void window.jmtitler.recallEntry(String(i + 1))}
                title={label}
                className={cn(
                  'h-16 rounded-[var(--radius-lg)] border px-3 text-sm font-bold leading-tight',
                  'flex items-center justify-center text-center break-words',
                  i === activeEntry
                    ? 'bg-[var(--primary)] text-[var(--primary-foreground)] border-transparent ring-2 ring-[var(--primary)]'
                    : 'border-[var(--border)] hover:bg-[var(--highlight)]',
                )}
              >
                <span className="line-clamp-2">{label || '—'}</span>
              </button>
            ))}
          </div>
          {filtered.length === 0 ? (
            <p className="mt-6 text-center text-sm text-[var(--muted-foreground)]">
              Kein Eintrag passt zu „{q}".
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
