// Live-Element von Q&A (UX Welle 1, Aufgabe d; Spec 5.1, Anhang A „Q&A“): der Sprecher am Wort samt Redezeit aus dem Timer-STATE,
// immer sichtbar. Rein darstellend: Beenden und Nächste sind jetzt Haupttasten darunter (views/LiveBereich.tsx).
import { QA_TEXTE } from '@/lib/oberflaeche';
import type { QaState } from '@shared/types';

/** Großer „Am Wort“-Block: aktiver Sprecher + Redezeit (vom Timer). */
export function ActivePanel({ state }: { state: QaState }): React.JSX.Element {
  const active = state.entries.find((e) => e.id === state.activeId) ?? null;
  const timer = state.links.find((l) => l.role === 'timer');
  const remaining = timer?.state?.remaining;
  const running = timer?.state?.running === '1';
  const overrun = timer?.state?.overrun === '1';

  return (
    <div data-qa="am-wort" className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">Am Wort</span>
        {remaining && (
          <span
            className={`tabular text-sm ${overrun ? 'text-[var(--destructive)]' : running ? 'text-[var(--success)]' : 'text-[var(--muted-foreground)]'}`}
            title="Redezeit (vom JM Timer)"
          >
            ⏱ {remaining}
          </span>
        )}
      </div>

      {active ? (
        <>
          <div className="text-3xl font-semibold leading-tight">{active.name}</div>
          {active.affiliation && <div className="text-lg text-[var(--muted-foreground)]">{active.affiliation}</div>}
          {active.question && (
            // Die Frage kann bis 500 Zeichen lang sein: Ab etwa sechs Zeilen scrollt sie im Kasten, damit die Haupttasten darunter stehen bleiben (R16).
            <div className="mt-2 max-h-36 overflow-y-auto rounded-[var(--radius-md)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)]">
              {active.question}
            </div>
          )}
        </>
      ) : (
        <div className="py-3 text-sm text-[var(--muted-foreground)]">{QA_TEXTE.leer}</div>
      )}
    </div>
  );
}
