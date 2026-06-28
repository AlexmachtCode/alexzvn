import { useState } from 'react';
import { Badge, Button, cn } from '@jm/ui';
import type { EquipmentOwner, Recipe } from '@jm/cookbook';
import { useTools } from '@/store/tools';
import { Markdown } from '@/components/Markdown';

const OWNER_LABEL: Record<EquipmentOwner, string> = {
  'kunde-haus': 'Kunde / Haustechnik',
  jm: 'JM-Material',
  gemischt: 'Gemischt (Haus + JM)',
};

const DIFFICULTY_TONE: Record<Recipe['difficulty'], 'success' | 'neutral' | 'warning'> = {
  einfach: 'success',
  mittel: 'neutral',
  anspruchsvoll: 'warning',
  profi: 'warning',
};

/** Aufbauzeit menschenlesbar: Minuten → Tage / Stunden / Minuten. */
function formatSetupTime(min: number): string {
  if (min >= 1440) {
    const d = min / 1440;
    return Number.isInteger(d) ? `${d} ${d === 1 ? 'Tag' : 'Tage'}` : `${d.toFixed(1).replace('.', ',')} Tage`;
  }
  if (min >= 60) {
    const h = min / 60;
    return `${Number.isInteger(h) ? h : h.toFixed(1).replace('.', ',')} h`;
  }
  return `${min} min`;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2 text-sm leading-snug text-[var(--foreground)]/85">
          <span className="mt-2 size-1 shrink-0 rounded-full bg-[var(--primary)]" aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function RecipeDetail({ recipe }: { recipe: Recipe }) {
  const tools = useTools((s) => s.tools);
  const open = useTools((s) => s.open);
  const busy = useTools((s) => s.busy);
  // Erledigt-Zustand der Checklisten ist UI-lokal (nicht persistiert). Wird beim
  // Rezeptwechsel zurückgesetzt, weil das Modal die Komponente per key neu mountet.
  const [done, setDone] = useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const related = recipe.relatedTools
    .map((id) => tools.find((t) => t.id === id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));

  const { blocks } = recipe;
  // Doc-Einträge (Best Practices) führen ihren Inhalt als Roh-Markdown statt in
  // den Rezept-Blöcken → Markdown rendern, rezept-spezifische Metadaten ausblenden.
  const isDoc = Boolean(recipe.markdown);

  return (
    <div className="flex flex-col gap-6">
      {/* Kopf: Titel, Kurzbeschreibung, Metadaten-Badges */}
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight">{recipe.title}</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">{recipe.summary}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="muted">{recipe.category}</Badge>
          <Badge tone={DIFFICULTY_TONE[recipe.difficulty]}>{recipe.difficulty}</Badge>
          {!isDoc && (
            <>
              <Badge tone="muted">⏱ {formatSetupTime(recipe.setupTimeMin)}</Badge>
              <Badge tone="muted">👥 {recipe.teamSize}</Badge>
              <Badge tone="muted">{OWNER_LABEL[recipe.equipmentOwner]}</Badge>
            </>
          )}
          {recipe.location && <Badge tone="muted">📍 {recipe.location}</Badge>}
        </div>
        {recipe.crewRoles.length > 0 && (
          <p className="text-xs text-[var(--muted-foreground)]">
            <span className="font-bold text-[var(--foreground)]/70">Crew:</span> {recipe.crewRoles.join(' · ')}
          </p>
        )}
      </div>

      {/* Verknüpfte JM-Tools (Deep-Link: öffnen) */}
      {related.length > 0 && (
        <Section title="Passende JM-Tools">
          <div className="flex flex-wrap gap-2">
            {related.map((tool) => (
              <div
                key={tool.id}
                className="flex items-center gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5"
              >
                <div className="leading-tight">
                  <div className="text-xs font-bold">{tool.name}</div>
                  <div className="text-[10px] text-[var(--muted-foreground)]">{tool.tagline}</div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  uppercase={false}
                  disabled={busy[tool.id] ?? false}
                  onClick={() => void open(tool.id)}
                >
                  Öffnen
                </Button>
              </div>
            ))}
          </div>
        </Section>
      )}

      {isDoc && recipe.markdown ? (
        <Markdown source={recipe.markdown} />
      ) : (
      <>
      {recipe.prerequisites.length > 0 && (
        <Section title="Voraussetzungen">
          <Bullets items={recipe.prerequisites} />
        </Section>
      )}

      <Section title="Zutaten / Was brauche ich">
        <div className="flex flex-col gap-4">
          {blocks.ingredients.map((group, i) => (
            <div key={i}>
              <div className="mb-1.5 text-xs font-extrabold text-[var(--foreground)]/80">{group.title}</div>
              <Bullets items={group.items} />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Schritt-für-Schritt">
        <div className="flex flex-col gap-4">
          {([
            ['Vorbereitung', blocks.steps.vor],
            ['Während', blocks.steps.waehrend],
            ['Nachbereitung', blocks.steps.nach],
          ] as const).map(([phase, items]) =>
            items.length > 0 ? (
              <div key={phase}>
                <div className="mb-1.5 text-xs font-extrabold text-[var(--foreground)]/80">{phase}</div>
                <ol className="flex flex-col gap-1.5">
                  {items.map((item, i) => (
                    <li key={i} className="flex gap-2 text-sm leading-snug text-[var(--foreground)]/85">
                      <span className="mt-0.5 w-5 shrink-0 text-right text-[11px] font-bold tabular-nums text-[var(--primary)]">
                        {i + 1}.
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null,
          )}
        </div>
      </Section>

      {blocks.tips && blocks.tips.length > 0 && (
        <Section title="Profi-Tipps">
          <Bullets items={blocks.tips} />
        </Section>
      )}

      {blocks.troubleshooting.length > 0 && (
        <Section title="Pannenhilfe">
          <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--border)]">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-[var(--highlight)]/60 text-left text-[11px] uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
                  <th className="px-3 py-2 font-extrabold">Risiko</th>
                  <th className="px-3 py-2 font-extrabold">Gegenmaßnahme</th>
                </tr>
              </thead>
              <tbody>
                {blocks.troubleshooting.map((row, i) => (
                  <tr key={i} className="border-t border-[var(--border)] align-top">
                    <td className="px-3 py-2 font-semibold">{row.risk}</td>
                    <td className="px-3 py-2 text-[var(--foreground)]/85">{row.remedy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {blocks.checklists.length > 0 && (
        <Section title="Checklisten">
          <div className="flex flex-col gap-4">
            {blocks.checklists.map((list, li) => (
              <div key={li}>
                <div className="mb-1.5 text-xs font-extrabold text-[var(--foreground)]/80">{list.title}</div>
                <ul className="flex flex-col gap-1">
                  {list.items.map((item, ii) => {
                    const key = `${li}:${ii}`;
                    const checked = done.has(key);
                    return (
                      <li key={ii}>
                        <button
                          type="button"
                          onClick={() => toggle(key)}
                          className="flex w-full items-center gap-2.5 text-left text-sm leading-snug"
                        >
                          <span
                            className={cn(
                              'grid size-4 shrink-0 place-items-center rounded-[4px] border transition-colors',
                              checked
                                ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]'
                                : 'border-[var(--border)] text-transparent',
                            )}
                            aria-hidden
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20 6 9 17l-5-5" />
                            </svg>
                          </span>
                          <span className={cn(checked && 'text-[var(--muted-foreground)] line-through')}>{item}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </Section>
      )}
      </>
      )}

      <p className="border-t border-[var(--border)] pt-3 text-[11px] text-[var(--muted-foreground)]">
        Zuletzt geprüft: {recipe.lastReviewed} · Verantwortlich: {recipe.owner}
      </p>
    </div>
  );
}
