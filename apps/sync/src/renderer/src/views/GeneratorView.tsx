import { useCallback, useEffect, useRef, useState } from 'react';
import { Card } from '@jm/ui';
import { Button } from '@jm/ui';
import { SignalGenerator } from '@/core/generator';
import { useSettings } from '@/store/settings';
import { cn } from '@jm/ui';

export function GeneratorView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const genRef = useRef<SignalGenerator | null>(null);

  const [running, setRunning] = useState(false);
  const [cycle, setCycle] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const intervalMs = useSettings((s) => s.intervalMs);
  const beepFreq = useSettings((s) => s.targetFreq);
  const setIntervalMs = useSettings((s) => s.setIntervalMs);
  const setBeepFreq = useSettings((s) => s.setTargetFreq);

  const start = useCallback(async () => {
    if (!canvasRef.current) return;
    setError(null);
    try {
      const gen = new SignalGenerator(canvasRef.current, setCycle, { intervalMs, beepFreq });
      genRef.current = gen;
      await gen.start();
      setRunning(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [intervalMs, beepFreq]);

  const stop = useCallback(() => {
    genRef.current?.stop();
    genRef.current = null;
    setRunning(false);
    setCycle(0);
  }, []);

  // Live-apply parameter changes without restarting.
  useEffect(() => {
    genRef.current?.setOptions({ intervalMs, beepFreq });
  }, [intervalMs, beepFreq]);

  useEffect(() => stop, [stop]);

  const goFullscreen = useCallback(() => {
    canvasRef.current?.requestFullscreen?.().catch(() => undefined);
  }, []);

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px] items-start">
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-[0.12em] font-bold text-[var(--muted-foreground)]">
            Referenzsignal
          </span>
          <span className="text-xs text-[var(--muted-foreground)] tabular">Zyklus {cycle}</span>
        </div>
        <canvas
          ref={canvasRef}
          width={640}
          height={360}
          onDoubleClick={goFullscreen}
          className="mt-3 w-full aspect-video rounded-[var(--radius)] bg-black cursor-pointer"
        />
        <p className="mt-2 text-xs text-[var(--muted-foreground)]">
          Doppelklick = Vollbild. Diese Fläche durch die Pipeline schicken (Kamera/Capture davor).
        </p>
      </Card>

      <Card className="p-6">
        <h1 className="text-xl font-extrabold tracking-tight">Generator</h1>
        <p className="mt-2 text-sm text-[var(--muted-foreground)] leading-relaxed">
          Blitz + Piep werden exakt gleichzeitig ausgelöst. Frequenz &amp; Intervall sind mit der
          Messung gekoppelt – die Erkennung lockt automatisch auf dieselbe Frequenz.
        </p>

        <div className="mt-5 space-y-4">
          <Slider
            label="Intervall"
            value={intervalMs}
            min={1000}
            max={5000}
            step={250}
            unit="ms"
            onChange={setIntervalMs}
          />
          <Slider
            label="Frequenz"
            value={beepFreq}
            min={400}
            max={2000}
            step={50}
            unit="Hz"
            onChange={setBeepFreq}
          />
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {running ? (
            <Button variant="destructive" onClick={stop}>
              Stoppen
            </Button>
          ) : (
            <Button onClick={start}>Starten</Button>
          )}
          <Button variant="outline" onClick={goFullscreen} disabled={!running}>
            Vollbild
          </Button>
        </div>

        {error && <p className="mt-4 text-sm text-[var(--destructive)]">{error}</p>}
      </Card>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <div className="flex justify-between text-xs">
        <span className="uppercase tracking-[0.12em] font-bold text-[var(--muted-foreground)]">
          {label}
        </span>
        <span className="tabular font-bold">
          {value} {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cn('mt-2 w-full accent-[var(--primary)]')}
      />
    </label>
  );
}
