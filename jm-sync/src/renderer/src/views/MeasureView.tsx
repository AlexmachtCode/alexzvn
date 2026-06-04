import { useCallback, useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { OffsetReadout } from '@/components/OffsetReadout';
import { HistoryGraph } from '@/components/HistoryGraph';
import { useCalibration } from '@/store/calibration';
import { useSettings } from '@/store/settings';
import { SyncMeter, type SyncMeterUpdate } from '@/core/sync-meter';
import {
  listDevices,
  getUserStream,
  getDisplayStream,
  stopStream,
  type DeviceLists,
} from '@/core/sources';
import { runtime } from '@/platform';
import { cn } from '@/lib/cn';

type Phase = 'idle' | 'running';
const EMPTY: SyncMeterUpdate = { stats: null, samples: [] };

export function MeasureView() {
  // A SINGLE video element, mounted for the whole lifetime of the view. It is
  // both the flash-detector input and the live preview — never swapped between
  // phases (swapping it detaches the detector and kills frame callbacks).
  const videoRef = useRef<HTMLVideoElement>(null);
  const meterRef = useRef<SyncMeter | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [phase, setPhase] = useState<Phase>('idle');
  const [devices, setDevices] = useState<DeviceLists>({ video: [], audio: [] });
  const [update, setUpdate] = useState<SyncMeterUpdate>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const baselineMs = useCalibration((s) => s.baselineMs);

  const videoId = useSettings((s) => s.videoId);
  const audioId = useSettings((s) => s.audioId);
  const setVideoId = useSettings((s) => s.setVideoId);
  const setAudioId = useSettings((s) => s.setAudioId);
  const targetFreq = useSettings((s) => s.targetFreq);

  const refreshDevices = useCallback(async () => {
    const list = await listDevices();
    setDevices(list);
    // Keep a valid selection: fall back to the first device if the saved one vanished.
    if (!list.video.some((d) => d.deviceId === useSettings.getState().videoId)) {
      setVideoId(list.video[0]?.deviceId ?? '');
    }
    if (!list.audio.some((d) => d.deviceId === useSettings.getState().audioId)) {
      setAudioId(list.audio[0]?.deviceId ?? '');
    }
  }, [setVideoId, setAudioId]);

  const loadDevices = useCallback(async () => {
    setError(null);
    try {
      const probe = await getUserStream(); // prompt → unlocks device labels
      stopStream(probe);
      await refreshDevices();
    } catch (e) {
      setError(friendly(e));
    }
  }, [refreshDevices]);

  // Enumerate on mount (labels stay blank until permission) and on hot-plug.
  useEffect(() => {
    refreshDevices().catch(() => undefined);
    const md = navigator.mediaDevices;
    if (!md?.addEventListener) return;
    const handler = () => refreshDevices().catch(() => undefined);
    md.addEventListener('devicechange', handler);
    return () => md.removeEventListener('devicechange', handler);
  }, [refreshDevices]);

  const start = useCallback(
    async (display = false) => {
      if (!videoRef.current) return;
      setError(null);
      try {
        const stream = display ? await getDisplayStream() : await getUserStream(videoId, audioId);
        streamRef.current = stream;
        setUpdate(EMPTY);
        setPhase('running'); // show the preview before detection starts
        const meter = new SyncMeter(videoRef.current, setUpdate, { targetFreq });
        meterRef.current = meter;
        await meter.start(stream);
        // Labels may have unlocked now that we hold a stream.
        refreshDevices().catch(() => undefined);
      } catch (e) {
        stopStream(streamRef.current);
        streamRef.current = null;
        meterRef.current = null;
        setPhase('idle');
        setError(friendly(e));
      }
    },
    [videoId, audioId, targetFreq, refreshDevices],
  );

  const stop = useCallback(() => {
    meterRef.current?.stop();
    stopStream(streamRef.current);
    meterRef.current = null;
    streamRef.current = null;
    setPhase('idle');
  }, []);

  // Clean up on unmount.
  useEffect(() => stop, [stop]);

  const base = baselineMs ?? 0;
  const recent = update.samples.slice(-8).reverse();
  const hasDevices = devices.video.length > 0 || devices.audio.length > 0;

  return (
    <div className="h-full flex flex-col gap-5">
      {phase === 'idle' ? (
        <Card className="p-7">
          <span className="inline-block text-[10px] uppercase tracking-[0.14em] font-extrabold text-[var(--primary)]">
            Messung
          </span>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight">Versatz messen</h1>
          <p className="mt-2 text-sm text-[var(--muted-foreground)] leading-relaxed max-w-2xl">
            {runtime === 'web'
              ? 'Handy-Kamera auf den Screen, Mikro Richtung Lautsprecher. Generator (Blitz + Piep) muss durch die Pipeline laufen — die gemessene Differenz ist der A/V-Versatz.'
              : 'Capture-Card als Kamera, Audio-Interface als Mikrofon wählen. Der Generator-Blitz + Piep läuft durch die Pipeline; die gemessene Differenz ist der A/V-Versatz.'}
          </p>

          <div className="mt-6">
            <Button variant="outline" size="sm" onClick={loadDevices}>
              Zugriff erlauben &amp; Geräte laden
            </Button>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 max-w-2xl">
            <Field label="Videoquelle">
              <NativeSelect
                value={videoId}
                onChange={setVideoId}
                options={devices.video}
                placeholder={hasDevices ? 'Videoquelle wählen' : 'Erst Geräte laden'}
              />
            </Field>
            <Field label="Audioquelle">
              <NativeSelect
                value={audioId}
                onChange={setAudioId}
                options={devices.audio}
                placeholder={hasDevices ? 'Audioquelle wählen' : 'Erst Geräte laden'}
              />
            </Field>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button onClick={() => start(false)}>Messung starten</Button>
            {runtime === 'electron' && (
              <Button variant="ghost" onClick={() => start(true)} uppercase={false}>
                Bildschirm/Tab als Quelle (Quick-Check)
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <Card className="p-7">
          <OffsetReadout stats={update.stats} baselineMs={baselineMs} />
          <div className="mt-6">
            <HistoryGraph samples={update.samples} baselineMs={base} />
          </div>
          <div className="mt-6 flex gap-3">
            <Button variant="destructive" onClick={stop}>
              Stoppen
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                meterRef.current?.reset();
                setUpdate(EMPTY);
              }}
            >
              Zurücksetzen
            </Button>
          </div>
        </Card>
      )}

      {/* Persistent preview + detection video — always mounted, hidden until running. */}
      <Card variant="nested" className={cn('p-5', phase !== 'running' && 'hidden')}>
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-[0.12em] font-bold text-[var(--muted-foreground)]">
            Vorschau
          </span>
          <span className="text-xs text-[var(--muted-foreground)]">{update.samples.length} Zyklen</span>
        </div>
        <video
          ref={videoRef}
          className="mt-3 w-full rounded-[var(--radius)] bg-black aspect-video object-contain"
          muted
          playsInline
        />
        <ul className="mt-4 space-y-1.5 tabular">
          {recent.length === 0 && (
            <li className="text-sm text-[var(--muted-foreground)]">Warte auf Blitz + Piep…</li>
          )}
          {recent.map((s) => {
            const v = s.offsetMs - base;
            return (
              <li key={s.cycle} className="flex justify-between text-sm">
                <span className="text-[var(--muted-foreground)]">#{s.cycle + 1}</span>
                <span className={cn(v >= 0 ? 'text-[var(--primary)]' : 'text-[var(--foreground)]')}>
                  {v >= 0 ? '+' : ''}
                  {v.toFixed(1)} ms
                </span>
              </li>
            );
          })}
        </ul>
      </Card>

      {error && (
        <Card variant="nested" className="px-4 py-3 text-sm text-[var(--destructive)]">
          {error}
        </Card>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs uppercase tracking-[0.12em] font-bold text-[var(--muted-foreground)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function NativeSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (id: string) => void;
  options: { deviceId: string; label: string }[];
  placeholder: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={options.length === 0}
      className={cn(
        'h-10 px-3 rounded-[var(--radius)] text-sm',
        'border border-[var(--border)] bg-[var(--input)] text-[var(--foreground)]',
        'disabled:opacity-50',
      )}
    >
      {options.length === 0 && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.deviceId} value={o.deviceId}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function friendly(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/Permission|NotAllowed/i.test(msg)) return 'Zugriff auf Kamera/Mikrofon verweigert.';
  if (/NotFound|Requested device/i.test(msg)) return 'Gewähltes Gerät nicht gefunden.';
  return msg;
}
