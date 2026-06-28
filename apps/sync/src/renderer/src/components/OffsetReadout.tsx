import type { MeasurementStats } from '@shared/types';

interface Props {
  stats: MeasurementStats | null;
  /** Calibration baseline subtracted from the raw offset, if set. */
  baselineMs?: number | null;
}

/** Big headline readout of the measured A/V offset. */
export function OffsetReadout({ stats, baselineMs }: Props) {
  if (!stats) {
    return (
      <div className="py-6">
        <div className="text-5xl font-extrabold tracking-tight text-[var(--muted-foreground)]">
          — ms
        </div>
        <p className="mt-3 text-sm text-[var(--muted-foreground)]">
          Messung läuft – warte auf die ersten Blitz-/Piep-Zyklen…
        </p>
      </div>
    );
  }

  const base = baselineMs ?? 0;
  const ms = stats.medianMs - base;
  const lead = Math.abs(ms) < 1 ? 'synchron' : ms > 0 ? 'Audio führt' : 'Video führt';

  return (
    <div className="py-2">
      <div className="flex items-baseline gap-3 tabular">
        <span className="text-6xl font-extrabold tracking-tight">
          {ms >= 0 ? '+' : ''}
          {ms.toFixed(1)}
        </span>
        <span className="text-2xl font-bold text-[var(--muted-foreground)]">ms</span>
      </div>
      <div className="mt-2 text-lg font-bold text-[var(--primary)]">{lead}</div>

      {baselineMs != null && (
        <div className="mt-1 text-xs text-[var(--muted-foreground)] tabular">
          roh {stats.medianMs >= 0 ? '+' : ''}
          {stats.medianMs.toFixed(1)} ms · kalibriert ({base >= 0 ? '−' : '+'}
          {Math.abs(base).toFixed(1)} ms)
        </div>
      )}

      <div className="mt-5 grid grid-cols-3 gap-3 max-w-md tabular">
        <Stat label="Jitter (MAD)" value={`±${stats.madMs.toFixed(1)} ms`} />
        <Stat
          label="Bereich"
          value={`${(stats.minMs - base).toFixed(0)}…${(stats.maxMs - base).toFixed(0)}`}
        />
        <Stat label="Messungen" value={String(stats.count)} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--border)]/50 px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.12em] font-bold text-[var(--muted-foreground)]">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-extrabold">{value}</div>
    </div>
  );
}
