import { useMemo, useState } from 'react';
import { Card, cn } from '@jm/ui';
import type { CookbookCategory, Recipe } from '@jm/cookbook';
import { useCookbook } from '@/store/cookbook';
import { RecipeDetail } from '@/components/RecipeDetail';

/** Suche greift erst ab dieser Länge (analog Werkzeugkasten, Issue #27). */
const MIN_QUERY = 3;

const CATEGORY_ORDER: CookbookCategory[] = [
  'Veranstaltungsformate',
  'Technik-Setups',
  'Kunden-/Location-Setups',
  'Tool-Manuals',
];

export function CookbookModal() {
  const open = useCookbook((s) => s.open);
  const close = useCookbook((s) => s.closeCookbook);
  const openDraft = useCookbook((s) => s.openDraft);
  const recipes = useCookbook((s) => s.recipes);
  const selectedId = useCookbook((s) => s.selectedId);
  const select = useCookbook((s) => s.select);
  const [query, setQuery] = useState('');

  // Namens-/Stichwortsuche (ab MIN_QUERY Zeichen): Titel, Summary, Tags.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < MIN_QUERY) return recipes;
    return recipes.filter((r) =>
      `${r.title} ${r.summary} ${r.tags.join(' ')}`.toLowerCase().includes(q),
    );
  }, [recipes, query]);

  // Nach Kategorie gruppieren, in fester Reihenfolge.
  const grouped = useMemo(() => {
    const groups: { category: CookbookCategory; recipes: Recipe[] }[] = [];
    for (const category of CATEGORY_ORDER) {
      const inCat = filtered.filter((r) => r.category === category);
      if (inCat.length) groups.push({ category, recipes: inCat });
    }
    return groups;
  }, [filtered]);

  if (!open) return null;

  const selected = recipes.find((r) => r.id === selectedId) ?? filtered[0];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm px-6">
      <Card className="w-full max-w-5xl p-0 jm-fade-in overflow-hidden">
        <div className="flex items-start justify-between gap-4 px-6 pt-6">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight">JM Kochbuch</h2>
            <p className="text-xs text-[var(--muted-foreground)] mt-1">
              Best Practices & Manuals — Zutaten, Aufbau und Schritt-für-Schritt.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={openDraft}
              title="Neues Rezept mit KI erstellen — öffnet einen PR zur Prüfung"
              className="inline-flex items-center gap-1.5 h-8 rounded-[var(--radius)] border border-[var(--border)]
                         px-3 text-xs font-extrabold uppercase tracking-wide text-[var(--foreground)]
                         hover:border-[var(--primary)]/50 hover:bg-[var(--highlight)] transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 5v14M5 12h14" />
              </svg>
              Neues Rezept
            </button>
            <button
              type="button"
              onClick={close}
              aria-label="Schließen"
              className="grid place-items-center size-8 rounded-[var(--radius)] border border-[var(--border)]
                         text-[var(--muted-foreground)] hover:bg-[var(--highlight)] hover:text-[var(--foreground)] transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-[240px_1fr] gap-0 border-t border-[var(--border)]">
          {/* Rezept-Auswahl: Suche + nach Kategorie gruppierte Liste */}
          <nav className="border-r border-[var(--border)] p-2 max-h-[68vh] overflow-auto flex flex-col gap-3">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rezept suchen…"
              aria-label="Rezept suchen"
              className="h-9 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]
                         px-3 text-sm outline-none focus:border-[var(--primary)]"
            />
            {grouped.length === 0 && (
              <p className="px-2 text-xs text-[var(--muted-foreground)]">Keine Rezepte gefunden.</p>
            )}
            {grouped.map((group) => (
              <div key={group.category}>
                <div className="px-2 pb-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
                  {group.category}
                </div>
                {group.recipes.map((r) => {
                  const active = r.id === selected?.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => select(r.id)}
                      className={cn(
                        'w-full text-left rounded-[var(--radius)] px-3 py-2 text-sm font-semibold transition-colors',
                        active
                          ? 'bg-[var(--highlight)] text-[var(--foreground)]'
                          : 'text-[var(--muted-foreground)] hover:bg-[var(--highlight)]/60 hover:text-[var(--foreground)]',
                      )}
                    >
                      {r.title}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* Detail des gewählten Rezepts */}
          <div className="p-6 max-h-[68vh] overflow-auto">
            {selected ? (
              <RecipeDetail key={selected.id} recipe={selected} />
            ) : (
              <p className="text-sm text-[var(--muted-foreground)]">Kein Rezept ausgewählt.</p>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
