import type { SyncSample } from '@shared/types';

interface Props {
  samples: SyncSample[];
  /** Subtracted from each offset before plotting (calibration baseline). */
  baselineMs?: number;
  height?: number;
}

/** Compact sparkline of the A/V offset over recent cycles, with a zero line. */
export function HistoryGraph({ samples, baselineMs = 0, height = 96 }: Props) {
  const W = 100; // viewBox width (percentage-like, scales to container)
  const H = height;
  const values = samples.slice(-40).map((s) => s.offsetMs - baselineMs);

  if (values.length < 2) {
    return (
      <div
        className="flex items-center justify-center rounded-[var(--radius)] border border-[var(--border)]/50 text-xs text-[var(--muted-foreground)]"
        style={{ height: H }}
      >
        Sammle Messpunkte…
      </div>
    );
  }

  // Symmetric scale around zero, at least ±20 ms so small jitter stays readable.
  const peak = Math.max(20, ...values.map((v) => Math.abs(v)));
  const x = (i: number) => (i / (values.length - 1)) * W;
  const y = (v: number) => H / 2 - (v / peak) * (H / 2 - 6);
  const path = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(' ');

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="w-full rounded-[var(--radius)] border border-[var(--border)]/50 bg-[var(--card)]/30"
      style={{ height: H }}
    >
      {/* zero line */}
      <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke="var(--border)" strokeWidth="0.5" />
      <path d={path} fill="none" stroke="var(--primary)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      {values.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r="0.9" fill="var(--primary)" />
      ))}
      {/* peak labels */}
      <text x="0.5" y="6" fontSize="5" fill="var(--muted-foreground)">
        +{peak.toFixed(0)}
      </text>
      <text x="0.5" y={H - 1.5} fontSize="5" fill="var(--muted-foreground)">
        −{peak.toFixed(0)}
      </text>
    </svg>
  );
}
