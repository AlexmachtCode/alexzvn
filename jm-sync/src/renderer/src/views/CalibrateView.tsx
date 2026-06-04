import { useCallback, useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SyncMeter, type SyncMeterUpdate } from '@/core/sync-meter';
import { getUserStream, getDisplayStream, stopStream } from '@/core/sources';
import { useCalibration } from '@/store/calibration';
import { useSettings } from '@/store/settings';
import { runtime } from '@/platform';

const EMPTY: SyncMeterUpdate = { stats: null, samples: [] };

export function CalibrateView() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const meterRef = useRef<SyncMeter | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [running, setRunning] = useState(false);
  const [update, setUpdate] = useState<SyncMeterUpdate>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  const { baselineMs, capturedAt, setBaseline, clear } = useCalibration();
  const targetFreq = useSettings((s) => s.targetFreq);

  const start = useCallback(
    async (display = false) => {
      if (!videoRef.current) return;
      setError(null);
      try {
        const stream = display ? await getDisplayStream() : await getUserStream();
        streamRef.current = stream;
        const meter = new SyncMeter(videoRef.current, setUpdate, { targetFreq });
        meterRef.current = meter;
        await meter.start(stream);
        setUpdate(EMPTY);
        setRunning(true);
      } catch (e) {
        stopStream(streamRef.current);
        streamRef.current = null;
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [targetFreq],
  );

  const stop = useCallback(() => {
    meterRef.current?.stop();
    stopStream(streamRef.current);
    meterRef.current = null;
    streamRef.current = null;
    setRunning(false);
  }, []);

  useEffect(() => stop, [stop]);

  const capture = useCallback(() => {
    const med = meterRef.current?.currentStats?.medianMs;
    if (med == null) return;
    setBaseline(med, new Date().toISOString());
    stop();
  }, [setBaseline, stop]);

  const stats = update.stats;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px] items-start">
      <Card className="p-7">
        <span className="inline-block text-[10px] uppercase tracking-[0.14em] font-extrabold text-[var(--primary)]">
          Kalibrierung
        </span>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight">Null-Abgleich</h1>
        <p className="mt-2 text-sm text-[var(--muted-foreground)] leading-relaxed max-w-xl">
          Generator und Messung <b>direkt</b> gegeneinander laufen lassen (ohne Pipeline) — z.&nbsp;B.
          Kamera auf den eigenen Generator-Screen, Mikro am Lautsprecher. Der gemessene Wert ist die
          Eigenlatenz und wird von jeder echten Messung abgezogen.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {running ? (
            <>
              <Button onClick={capture} disabled={stats == null}>
                Als Null übernehmen
              </Button>
              <Button variant="outline" onClick={stop}>
                Abbrechen
              </Button>
            </>
          ) : (
            <>
              <Button onClick={() => start(false)}>Abgleich starten</Button>
              {runtime === 'electron' && (
                <Button variant="ghost" uppercase={false} onClick={() => start(true)}>
                  Bildschirm als Quelle
                </Button>
              )}
            </>
          )}
        </div>

        {running && (
          <div className="mt-5 tabular">
            <span className="text-sm text-[var(--muted-foreground)]">Aktuell gemessen: </span>
            <span className="text-lg font-extrabold">
              {stats ? `${stats.medianMs >= 0 ? '+' : ''}${stats.medianMs.toFixed(1)} ms` : '— ms'}
            </span>
            <span className="ml-2 text-xs text-[var(--muted-foreground)]">
              ({update.samples.length} Zyklen)
            </span>
          </div>
        )}

        {error && <p className="mt-4 text-sm text-[var(--destructive)]">{error}</p>}
        <video ref={videoRef} className="hidden" muted playsInline />
      </Card>

      <Card variant="nested" className="p-6">
        <span className="text-xs uppercase tracking-[0.12em] font-bold text-[var(--muted-foreground)]">
          Gespeicherte Baseline
        </span>
        {baselineMs == null ? (
          <p className="mt-3 text-sm text-[var(--muted-foreground)]">
            Noch keine Kalibrierung. Messungen werden unkorrigiert (roh) angezeigt.
          </p>
        ) : (
          <>
            <div className="mt-3 text-3xl font-extrabold tabular">
              {baselineMs >= 0 ? '+' : ''}
              {baselineMs.toFixed(1)} ms
            </div>
            {capturedAt && (
              <div className="mt-1 text-xs text-[var(--muted-foreground)]">
                erfasst {new Date(capturedAt).toLocaleString('de-DE')}
              </div>
            )}
            <Button variant="outline" size="sm" className="mt-4" onClick={clear}>
              Zurücksetzen
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}
