import { useMemo, useState } from 'react';
import { Button } from '@jm/ui';
import type { ToolCategory } from '@shared/types';
import { CategoryChips, type CategoryFilter } from '@/components/CategoryChips';
import { StatusChips, type StatusFilter } from '@/components/StatusChips';
import { ToolCard } from '@/components/ToolCard';
import { displayName } from '@/lib/monogram';
import { useTools } from '@/store/tools';
import { werkzeugkastenHinweis } from '@/lib/konto-anzeige';
import { useKonto } from '@/store/konto';

/** Suche greift erst ab dieser Länge (Issue #27). */
const MIN_QUERY = 3;

const CATEGORY_ORDER: ToolCategory[] = ['Ingest', 'Grafik', 'Studio', 'Utilities'];

/**
 * Der „Werkzeugkasten"-Reiter (#157): die Tool-Übersicht (Suche, Filter, Grid).
 * Aus App.tsx herausgelöst, damit die Shell nur noch zwischen den Reitern
 * umschaltet; Verhalten unverändert.
 */
export function ToolboxView(): React.JSX.Element {
  const tools = useTools((s) => s.tools);
  const states = useTools((s) => s.states);
  const loading = useTools((s) => s.loading);
  const updatingAll = useTools((s) => s.updatingAll);
  const updateAll = useTools((s) => s.updateAll);
  // Anmeldung P24 (F5): ohne gültige Anmeldung und ohne andere Quelle sagt eine Zeile, warum Installieren nicht geht.
  const ansicht = useKonto((s) => s.ansicht);
  const quelle = useTools((s) => s.settings?.source ?? null);
  const hinweis = werkzeugkastenHinweis(ansicht, quelle);

  const [filter, setFilter] = useState<CategoryFilter>('Alle');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('Alle');
  const [query, setQuery] = useState('');

  const categories = useMemo<CategoryFilter[]>(() => {
    const present = CATEGORY_ORDER.filter((c) => tools.some((t) => t.category === c));
    return ['Alle', ...present];
  }, [tools]);

  // Erst nach Kategorie, dann nach Installationsstatus filtern (Issues #14).
  const byCategory = useMemo(
    () => (filter === 'Alle' ? tools : tools.filter((t) => t.category === filter)),
    [tools, filter],
  );

  // Namenssuche (ab MIN_QUERY Zeichen, Issue #27). Matcht Anzeigename, vollen
  // Namen und Tagline, damit z.B. "JM" wie "Player" beides findet.
  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < MIN_QUERY) return byCategory;
    return byCategory.filter((t) =>
      `${displayName(t.name)} ${t.name} ${t.tagline}`.toLowerCase().includes(q),
    );
  }, [byCategory, query]);

  const statusCounts = useMemo<Record<StatusFilter, number>>(() => {
    const counts: Record<StatusFilter, number> = {
      Alle: searched.length,
      installed: 0,
      'update-available': 0,
      'not-installed': 0,
    };
    for (const t of searched) counts[states[t.id]?.status ?? 'not-installed'] += 1;
    return counts;
  }, [searched, states]);

  const visible = useMemo(
    () =>
      statusFilter === 'Alle'
        ? searched
        : searched.filter((t) => (states[t.id]?.status ?? 'not-installed') === statusFilter),
    [searched, statusFilter, states],
  );

  const installedCount = Object.values(states).filter((s) => s.status === 'installed').length;
  const updateCount = Object.values(states).filter((s) => s.status === 'update-available').length;

  return (
    <div className="max-w-[1200px] mx-auto px-7 py-7 flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Werkzeugkasten</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            {loading ? 'Lade Tools…' : `${tools.length} Tools · ${installedCount} installiert`}
          </p>
          {hinweis && (
            <p
              role="status"
              className="mt-2 text-xs rounded-[var(--radius)] border border-[var(--border)] bg-[var(--muted)] px-3 py-2 text-[var(--muted-foreground)]"
            >
              {hinweis}
            </p>
          )}
          {updateCount > 0 && (
            <div className="mt-2">
              <Button
                size="sm"
                variant="primary"
                disabled={updatingAll}
                onClick={() => void updateAll()}
              >
                {updatingAll
                  ? 'Aktualisiere…'
                  : `${updateCount} ${updateCount === 1 ? 'Update' : 'Updates'} · Alle installieren`}
              </Button>
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2" data-anleitung="werkzeugkasten.kategorien">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tool suchen…"
            aria-label="Tool suchen"
            className="h-9 w-56 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]
                       px-3 text-sm outline-none focus:border-[var(--primary)]"
          />
          <CategoryChips categories={categories} active={filter} onChange={setFilter} />
          <StatusChips active={statusFilter} counts={statusCounts} onChange={setStatusFilter} />
        </div>
      </div>

      {!loading && visible.length === 0 && (
        <p className="text-sm text-[var(--muted-foreground)]">Keine Tools für diese Auswahl.</p>
      )}

      <div className="grid gap-5 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((tool) => (
          <ToolCard key={tool.id} tool={tool} state={states[tool.id]} />
        ))}
      </div>
    </div>
  );
}
