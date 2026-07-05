import type { QaState } from '@shared/types';

const endBtn = 'rounded-md bg-[var(--destructive)] px-4 py-1.5 text-sm font-semibold text-[var(--destructive-foreground)]';
const nextBtn =
  'rounded-md px-4 py-1.5 text-sm font-semibold text-[var(--brand-dark)]';

/** Großer „Am Wort"-Block: aktiver Sprecher + Redezeit (vom Timer) + Beenden/Nächste. */
export function ActivePanel({
  state,
  onEnd,
  onNext,
}: {
  state: QaState;
  onEnd: () => void;
  onNext: () => void;
}) {
  const active = state.entries.find((e) => e.id === state.activeId) ?? null;
  const timer = state.links.find((l) => l.role === 'timer');
  const remaining = timer?.state?.remaining;
  const running = timer?.state?.running === '1';
  const overrun = timer?.state?.overrun === '1';

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)]/50 p-4">
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
            <div className="mt-2 rounded-lg bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)]">
              {active.question}
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <button onClick={onEnd} className={endBtn}>
              ■ Beenden
            </button>
            <button onClick={onNext} className={nextBtn} style={{ background: 'var(--brand-yellow)' }}>
              Nächste ▶
            </button>
          </div>
        </>
      ) : (
        <div className="py-3 text-sm text-[var(--muted-foreground)]">
          Niemand am Wort. „Nächste" ruft die erste Wortmeldung auf.
          <div className="mt-3">
            <button onClick={onNext} className={nextBtn} style={{ background: 'var(--brand-yellow)' }}>
              Nächste ▶
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
