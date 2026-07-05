import { Modal } from '@jm/ui';
import type { BattleConfig } from '@shared/types';
import { useBattle } from '@/store/useBattle';

const inp = 'rounded border border-[var(--border)] bg-[var(--input)] px-2 py-1 text-sm text-[var(--foreground)]';

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-b border-[var(--border)]/60 py-2.5">
      <div className="flex-1">
        <div className="text-sm">{label}</div>
        {hint && <div className="text-[11px] text-[var(--muted-foreground)]">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

/** Einstellungen: Runden, Voting, VS-Bauchbinde + Battle zurücksetzen. */
export function Settings({ config, onClose }: { config: BattleConfig; onClose: () => void }) {
  const { setConfig, reset } = useBattle();

  return (
    <Modal onClose={onClose} title="Einstellungen" className="w-[34rem]">
      <Row label="Runden" hint="Anzahl der Battle-Runden.">
        <input
          type="number"
          min={1}
          max={20}
          value={config.rounds}
          onChange={(e) => void setConfig({ rounds: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })}
          className={`${inp} w-20`}
        />
      </Row>

      <Row label="Publikums-Voting" hint="Abstimmung per QR/Handy zulassen.">
        <input type="checkbox" checked={config.votingEnabled} onChange={(e) => void setConfig({ votingEnabled: e.target.checked })} />
      </Row>

      <Row label="VS-Bauchbinde automatisch" hint="JM Titler bei VS-Live mit den Namen ein-/ausblenden (text-Befehl vorwärtskompatibel).">
        <input type="checkbox" checked={config.autoTitler} onChange={(e) => void setConfig({ autoTitler: e.target.checked })} />
      </Row>

      <div className="mt-4 flex justify-end">
        <button
          onClick={() => {
            if (confirm('Battle zurücksetzen? Runden/Stimmen werden geleert (Namen bleiben).')) {
              void reset();
              onClose();
            }
          }}
          className="rounded-md border border-[var(--destructive)]/60 px-3 py-1.5 text-sm text-[var(--destructive)] hover:bg-[var(--destructive)]/10"
        >
          Battle zurücksetzen
        </button>
      </div>
    </Modal>
  );
}
