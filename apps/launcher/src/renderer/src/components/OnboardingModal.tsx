import { Button, Card, cn } from '@jm/ui';
import { useTools } from '@/store/tools';

// Erste-Schritte-Assistent (Onboarding B1).
//
// Zeigt neuen Operatorn beim allerersten Start einen kurzen, geführten Weg statt
// sie im leeren Werkzeugkasten alleinzulassen. Bewusst KEIN Tutorial zum Durch-
// klicken, sondern eine „Erste Schritte"-Checkliste, die vorhandene Aktionen/
// Zustände bündelt: Release-Quelle, Werkzeuge, Netzwerk/Steuerebene (A1-Karte im
// System-Zustand) und die erste .jmshow. Schritte 1/2 zeigen live einen Haken,
// sobald erledigt. Jederzeit über den „Erste Schritte"-Kopfzeilen-Knopf erneut
// aufrufbar; das Gating (jmps:onboardedV1) verhindert erneutes Auto-Aufpoppen.
//
// z-40 (unter den Detail-Modals mit z-50): öffnet ein Schritt ein Modal
// (Einstellungen/System/Show), legt sich dieses darüber und der Assistent bleibt
// als Rücksprung-Ebene erhalten. Nur „Werkzeugkasten" wechselt die Hauptansicht
// und schließt den Assistenten daher (ohne zu persistieren → beim Kopfzeilen-Knopf
// wieder da).

export function OnboardingModal() {
  const open = useTools((s) => s.onboardingOpen);
  const close = useTools((s) => s.closeOnboarding);
  const settings = useTools((s) => s.settings);
  const states = useTools((s) => s.states);
  const openSettings = useTools((s) => s.openSettings);
  const openSystem = useTools((s) => s.openSystem);
  const openShowEditor = useTools((s) => s.openShowEditor);
  const setView = useTools((s) => s.setView);

  if (!open) return null;

  const sourceDone = Boolean(settings && settings.source !== 'none');
  const installedCount = Object.values(states).filter((s) => s.status !== 'not-installed').length;
  const toolsDone = installedCount > 0;

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/50 backdrop-blur-sm px-6">
      <Card className="w-full max-w-xl p-6 jm-fade-in">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight">
              Willkommen bei der JM Production Suite
            </h2>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              In vier Schritten startklar — jederzeit über „Erste Schritte" oben wieder aufrufbar.
            </p>
          </div>
          <button
            type="button"
            onClick={() => close(true)}
            aria-label="Schließen"
            className="grid size-8 shrink-0 place-items-center rounded-[var(--radius)] border border-[var(--border)]
                       text-[var(--muted-foreground)] transition-colors hover:bg-[var(--highlight)] hover:text-[var(--foreground)]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <ol className="mt-5 flex flex-col gap-2.5">
          <Step
            index={1}
            done={sourceDone}
            title="Release-Quelle verbinden"
            desc={
              sourceDone
                ? `Aktiv: ${settings?.source === 'proxy' ? 'Firmen-Proxy' : 'GitHub'}.`
                : 'Proxy-Schlüssel oder GitHub-Zugang hinterlegen, damit Tools installiert und aktualisiert werden können.'
            }
            actionLabel={sourceDone ? 'Ändern' : 'Einrichten'}
            onAction={openSettings}
          />
          <Step
            index={2}
            done={toolsDone}
            title="Werkzeuge installieren"
            desc={
              toolsDone
                ? `${installedCount} Tool(s) installiert — weitere jederzeit im Werkzeugkasten.`
                : 'Im Werkzeugkasten die Tools für deine Produktion auswählen und installieren.'
            }
            actionLabel={toolsDone ? 'Werkzeugkasten' : 'Auswählen'}
            onAction={() => {
              close(false);
              setView('catalog');
            }}
          />
          <Step
            index={3}
            title="Netzwerk & Steuerebene prüfen"
            desc="Sehen, ob sich die Tools im Netz finden — und bei geteilten Netzen mit einem Klick die sichere Steuerebene (Token/TLS, QR-Pairing) aktivieren."
            actionLabel="Prüfen"
            onAction={openSystem}
          />
          <Step
            index={4}
            title="Erste Show anlegen"
            desc="Eine .jmshow bündelt deine Tools + den Ablauf — ein Klick startet später die ganze Produktion koordiniert."
            actionLabel="Show anlegen"
            onAction={openShowEditor}
          />
        </ol>

        <div className="mt-6 flex items-center justify-between gap-3">
          <p className="text-[11px] text-[var(--muted-foreground)]">
            Tipp: Das JM Kochbuch (oben) hat Anleitungen &amp; Best Practices.
          </p>
          <Button variant="primary" onClick={() => close(true)}>
            Fertig
          </Button>
        </div>
      </Card>
    </div>
  );
}

function Step({
  index,
  done,
  title,
  desc,
  actionLabel,
  onAction,
}: {
  index: number;
  done?: boolean;
  title: string;
  desc: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <li className="flex items-start gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-3">
      <span
        aria-hidden
        className={cn(
          'mt-0.5 grid size-6 shrink-0 place-items-center rounded-[var(--radius-full)] text-[11px] font-extrabold',
          done
            ? 'border border-[var(--success)]/40 bg-[var(--success)]/15 text-[var(--success)]'
            : 'border border-[var(--border)] bg-[var(--muted)] text-[var(--muted-foreground)]',
        )}
      >
        {done ? '✓' : index}
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{title}</div>
        <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{desc}</p>
      </div>
      <Button size="sm" variant={done ? 'ghost' : 'primary'} onClick={onAction} className="shrink-0">
        {actionLabel}
      </Button>
    </li>
  );
}
