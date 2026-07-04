import { Button, Card, cn } from '@jm/ui';
import { useTools } from '@/store/tools';
import { SCENARIOS, toolLabel, type Scenario } from '@/lib/scenarios';

// Szenario-Start „Was willst du produzieren?" (Onboarding B2).
//
// Kuratierte Vorlagen als Kacheln. Ein Klick öffnet den vorhandenen Show-Editor
// vorbefüllt (Tools vorgewählt, Ablauf/Redezeit/Runden gesetzt) — der Operator
// prüft/speichert nur noch. Macht die .jmshow zur Eingangstür, statt vor einem
// leeren Editor zu stehen. Zeigt je Kachel, wie viele der Tools schon installiert
// sind (nicht installierte werden beim späteren Show-Start ohnehin gemeldet).

export function ScenarioPicker() {
  const open = useTools((s) => s.scenariosOpen);
  const close = useTools((s) => s.closeScenarios);
  const startWith = useTools((s) => s.openShowEditorWith);
  const tools = useTools((s) => s.tools);
  const states = useTools((s) => s.states);

  if (!open) return null;

  const nameById = new Map(tools.map((t) => [t.id, t.name]));
  const isInstalled = (id: string): boolean => {
    const st = states[id];
    return Boolean(st && st.status !== 'not-installed');
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm px-6">
      <Card className="w-full max-w-2xl p-6 jm-fade-in">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight">Was willst du produzieren?</h2>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              Vorlage wählen — der Show-Editor öffnet sich mit den passenden Tools und einem
              Ablauf-Startpunkt. Alles anpassbar.
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Schließen"
            className="grid size-8 shrink-0 place-items-center rounded-[var(--radius)] border border-[var(--border)]
                       text-[var(--muted-foreground)] transition-colors hover:bg-[var(--highlight)] hover:text-[var(--foreground)]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {SCENARIOS.map((sc) => (
            <ScenarioTile
              key={sc.id}
              scenario={sc}
              installed={sc.seed.toolIds.filter(isInstalled).length}
              toolNames={sc.seed.toolIds.map((id) => nameById.get(id) ?? toolLabel(id))}
              onStart={() => startWith(sc.seed)}
            />
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <p className="text-[11px] text-[var(--muted-foreground)]">
            Lieber frei starten? „Show anlegen" öffnet den leeren Editor.
          </p>
          <Button variant="ghost" onClick={close}>
            Abbrechen
          </Button>
        </div>
      </Card>
    </div>
  );
}

function ScenarioTile({
  scenario,
  installed,
  toolNames,
  onStart,
}: {
  scenario: Scenario;
  installed: number;
  toolNames: string[];
  onStart: () => void;
}) {
  const total = scenario.seed.toolIds.length;
  const allInstalled = installed === total;
  return (
    <div className="flex h-full flex-col gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="flex items-start gap-3">
        <span aria-hidden className="text-2xl leading-none">
          {scenario.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-extrabold leading-tight">{scenario.title}</div>
          <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{scenario.tagline}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {toolNames.map((n) => (
          <span
            key={n}
            className="rounded-[var(--radius-full)] border border-[var(--border)] bg-[var(--muted)]
                       px-1.5 py-px text-[10px] font-semibold text-[var(--muted-foreground)]"
          >
            {n}
          </span>
        ))}
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        <span
          className={cn(
            'text-[10px] font-bold uppercase tracking-wide',
            allInstalled ? 'text-[var(--success)]' : 'text-[var(--muted-foreground)]',
          )}
        >
          {allInstalled ? 'Alle installiert' : `${installed}/${total} installiert`}
        </span>
        <Button size="sm" variant="primary" onClick={onStart}>
          Los
        </Button>
      </div>
    </div>
  );
}
