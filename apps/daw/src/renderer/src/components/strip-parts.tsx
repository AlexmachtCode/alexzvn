import { cn } from '@jm/ui';

// Geteilte, zustandsfreie Mixer-Bausteine (#95). Bewusst OHNE Audio-Engine-/
// Store-Importe, damit sie auch im schlanken Mixer-Popout-Fenster nutzbar sind.

export const GAIN_MAX = 1.6; // ~ +4 dB Headroom

/** Lineare Spitze (0..1) → Balkenhöhe in % (−60..0 dBFS). */
export function meterPct(peak: number): number {
  if (peak <= 0) return 0;
  const db = 20 * Math.log10(peak);
  return Math.max(0, Math.min(100, ((db + 60) / 60) * 100));
}

/** Vertikaler Fader — echtes vertikales Range-Input (Chromium: writing-mode). */
export function Fader({
  value,
  onBegin,
  onEnd,
  onChange,
}: {
  value: number;
  onBegin: () => void;
  onEnd: () => void;
  onChange: (v: number) => void;
}) {
  return (
    <input
      type="range"
      min={0}
      max={GAIN_MAX}
      step={0.01}
      value={value}
      onPointerDown={onBegin}
      onPointerUp={onEnd}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-full cursor-pointer"
      // Vertikal: unten = leise, oben = laut. Füllt die Resthöhe des Kanalzugs.
      style={{ writingMode: 'vertical-lr', direction: 'rtl', width: 18 }}
    />
  );
}

export function Meter({ pct }: { pct: number }) {
  return (
    <div className="w-2 h-full rounded-full bg-black/40 overflow-hidden relative">
      <div
        className={cn(
          'absolute bottom-0 left-0 right-0 transition-[height] duration-75',
          pct > 92 ? 'bg-red-500' : pct > 75 ? 'bg-amber-400' : 'bg-emerald-400',
        )}
        style={{ height: `${pct}%` }}
      />
    </div>
  );
}

export function StripToggle({
  active,
  label,
  tone,
  onClick,
}: {
  active: boolean;
  label: string;
  tone: 'mute' | 'solo';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-6 h-6 rounded text-[10px] font-bold',
        active
          ? tone === 'solo'
            ? 'bg-amber-400 text-black'
            : 'bg-[var(--primary)] text-[var(--primary-foreground)]'
          : 'border border-[var(--border)] text-[var(--muted-foreground)]',
      )}
    >
      {label}
    </button>
  );
}
