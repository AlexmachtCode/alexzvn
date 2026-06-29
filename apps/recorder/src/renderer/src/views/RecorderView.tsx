import { useEffect, useState } from 'react';
import { Badge, Button, Card, cn } from '@jm/ui';
import { useRec } from '@/store/recorder';
import { basename, dbfsLabel, formatClock, meterColor, meterPct } from '@/lib/format';

export function RecorderView() {
  const loading = useRec((s) => s.loading);
  const devices = useRec((s) => s.devices);
  const deviceIndex = useRec((s) => s.deviceIndex);
  const channels = useRec((s) => s.channels);
  const sampleRate = useRec((s) => s.sampleRate);
  const dir = useRec((s) => s.dir);
  const fileName = useRec((s) => s.fileName);
  const state = useRec((s) => s.state);
  const peaks = useRec((s) => s.peaks);
  const gainDb = useRec((s) => s.gainDb);
  const setGain = useRec((s) => s.setGain);

  const selectDevice = useRec((s) => s.selectDevice);
  const setChannels = useRec((s) => s.setChannels);
  const setSampleRate = useRec((s) => s.setSampleRate);
  const setFileName = useRec((s) => s.setFileName);
  const separateTracks = useRec((s) => s.separateTracks);
  const setSeparateTracks = useRec((s) => s.setSeparateTracks);
  const pickDir = useRec((s) => s.pickDir);
  const refreshDevices = useRec((s) => s.refreshDevices);
  const arm = useRec((s) => s.arm);
  const disarm = useRec((s) => s.disarm);
  const record = useRec((s) => s.record);
  const stop = useRec((s) => s.stop);

  const selected = devices.find((d) => d.index === deviceIndex) ?? null;
  const status = state.status;
  const open = status !== 'idle';
  const recording = status === 'recording';
  const meterCount = open ? state.channels : channels;

  return (
    <div className="max-w-[1100px] mx-auto px-7 py-7 flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Aufnahme</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            {loading ? 'Suche Audiogeräte…' : `${devices.length} Eingänge`}
          </p>
        </div>
        <Button size="sm" variant="outline" disabled={open} onClick={() => void refreshDevices()}>
          Geräte aktualisieren
        </Button>
      </div>

      {/* Eingang */}
      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-4 items-end">
          <Field label="Eingang">
            <select
              value={deviceIndex ?? ''}
              disabled={open || devices.length === 0}
              onChange={(e) => selectDevice(Number(e.target.value))}
              className="h-10 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-3 text-sm disabled:opacity-50"
            >
              {devices.length === 0 && <option value="">Kein Eingang gefunden</option>}
              {devices.map((d) => (
                <option key={d.index} value={d.index}>
                  {d.name} — {d.hostApiName} ({d.maxInputChannels} ch)
                </option>
              ))}
            </select>
          </Field>

          <Field label="Kanäle">
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={selected?.maxInputChannels ?? 64}
                value={channels}
                disabled={open}
                onChange={(e) => setChannels(Number(e.target.value))}
                className="h-10 w-20 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-3 text-sm tabular disabled:opacity-50"
              />
              {selected && (
                <button
                  type="button"
                  disabled={open}
                  onClick={() => setChannels(selected.maxInputChannels)}
                  className="h-10 px-2.5 rounded-[var(--radius)] border border-[var(--border)] text-xs font-bold hover:bg-[var(--highlight)] disabled:opacity-50"
                  title={`Alle ${selected.maxInputChannels} Kanäle`}
                >
                  Max
                </button>
              )}
            </div>
          </Field>

          <Field label="Samplerate (Hz)">
            <input
              type="number"
              min={8000}
              step={100}
              value={sampleRate}
              disabled={open}
              onChange={(e) => setSampleRate(Number(e.target.value))}
              className="h-10 w-28 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-3 text-sm tabular disabled:opacity-50"
            />
          </Field>
        </div>

        {selected && /asio/i.test(selected.hostApiName) && (
          <p className="text-[11px] text-[var(--muted-foreground)] mt-3">
            ASIO: Samplerate muss exakt zur Geräte-Einstellung (z. B. DVSC) passen, sonst schlägt das Öffnen fehl.
          </p>
        )}
      </Card>

      {/* Transport */}
      <Card className="p-6">
        <div className="flex flex-wrap items-center gap-4">
          {!open ? (
            <Button variant="primary" disabled={deviceIndex == null} onClick={() => void arm()}>
              Eingang öffnen
            </Button>
          ) : recording ? (
            <button
              type="button"
              onClick={() => void stop()}
              className="inline-flex items-center gap-3 h-12 px-6 rounded-[var(--radius)] font-extrabold uppercase tracking-wide
                         bg-[var(--destructive)] text-[var(--destructive-foreground)] hover:opacity-90 transition-opacity"
            >
              <span className="size-3 rounded-[2px] bg-current" />
              Stopp
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void record()}
              className="inline-flex items-center gap-3 h-12 px-6 rounded-[var(--radius)] font-extrabold uppercase tracking-wide
                         bg-[var(--destructive)] text-[var(--destructive-foreground)] hover:opacity-90 transition-opacity"
            >
              <span className="size-3 rounded-full bg-current" />
              Aufnahme
            </button>
          )}

          {open && (
            <Button variant="outline" onClick={() => void disarm()}>
              Eingang schließen
            </Button>
          )}

          <div className="ml-auto flex items-center gap-4">
            <Badge tone={recording ? 'warning' : open ? 'success' : 'muted'}>
              {recording ? 'Aufnahme' : open ? 'Bereit' : 'Inaktiv'}
            </Badge>
            <span className="tabular text-2xl font-extrabold">{formatClock(state.recordedSec)}</span>
          </div>
        </div>

        {/* Ziel */}
        <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-4 items-end mt-6">
          <Field label="Zielordner">
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => void pickDir()}>
                Ordner wählen…
              </Button>
              <span className="text-xs text-[var(--muted-foreground)] truncate max-w-[280px]">
                {dir ? dir : 'noch keiner gewählt'}
              </span>
            </div>
          </Field>
          <Field label="Dateiname (optional)">
            <input
              value={fileName}
              placeholder="leer = Zeitstempel"
              onChange={(e) => setFileName(e.target.value)}
              className="h-10 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-3 text-sm"
            />
          </Field>
        </div>

        <label className="mt-4 flex w-fit items-center gap-2.5 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={separateTracks}
            disabled={recording}
            onChange={(e) => setSeparateTracks(e.target.checked)}
            className="size-4 accent-[var(--primary)] disabled:opacity-50"
          />
          <span className={cn('font-semibold', recording && 'opacity-50')}>
            Spuren zusätzlich einzeln speichern
          </span>
          <span className="text-[11px] text-[var(--muted-foreground)]">
            je Kanal eine Mono-WAV im Unterordner „…-Spuren"
          </span>
        </label>

        {state.filePath && (
          <button
            type="button"
            onClick={() => window.jmrec.shell.reveal(state.filePath as string)}
            className="mt-3 text-[11px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] truncate block max-w-full"
            title="Im Ordner zeigen"
          >
            → {basename(state.filePath)}
          </button>
        )}
      </Card>

      {/* Geplante Aufnahme */}
      <ScheduleCard />

      {/* Pegelmeter */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-extrabold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
            Pegel
          </h2>
          {!open && <span className="text-xs text-[var(--muted-foreground)]">Eingang öffnen zum Messen</span>}
        </div>

        {/* Aufnahme-Verstärkung (#94): hebt leise Eingänge an, wirkt live auf Pegel + Aufnahme. */}
        <div className="flex items-center gap-3 mb-3">
          <span className="tabular text-[10px] font-bold text-[var(--muted-foreground)] w-9">GAIN</span>
          <input
            type="range"
            min={-12}
            max={24}
            step={1}
            value={gainDb}
            onChange={(e) => setGain(Number(e.target.value))}
            className="flex-1 accent-[var(--primary)]"
            title="Aufnahme-Verstärkung"
          />
          <span className="tabular text-xs font-bold w-14 text-right">
            {gainDb > 0 ? `+${gainDb}` : gainDb} dB
          </span>
          <button
            type="button"
            onClick={() => setGain(0)}
            disabled={gainDb === 0}
            className="h-7 px-2 rounded-[var(--radius)] border border-[var(--border)] text-[10px] font-bold hover:bg-[var(--highlight)] disabled:opacity-40"
            title="Auf 0 dB zurücksetzen"
          >
            0 dB
          </button>
        </div>
        {gainDb > 0 ? (
          <p className="text-[11px] text-[var(--muted-foreground)] -mt-1 mb-3">
            Verstärkung hebt leise Aufnahmen an; zu viel übersteuert (Meter wird rot).
          </p>
        ) : null}

        <div className={cn('flex flex-col gap-1.5', !open && 'opacity-40')}>
          {Array.from({ length: Math.max(meterCount, 1) }, (_, c) => {
            const peak = peaks[c] ?? 0;
            return (
              <div key={c} className="flex items-center gap-3">
                <span className="tabular text-[10px] font-bold text-[var(--muted-foreground)] w-9">
                  CH{String(c + 1).padStart(2, '0')}
                </span>
                <div className="flex-1 h-3 rounded-full bg-[var(--muted)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-[width] duration-75"
                    style={{ width: `${meterPct(peak)}%`, background: meterColor(peak) }}
                  />
                </div>
                <span className="tabular text-[10px] text-[var(--muted-foreground)] w-12 text-right">
                  {dbfsLabel(peak)} dB
                </span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

/** Zeitgesteuerte Aufnahme: Startzeit planen + Auto-Stopp nach Dauer. */
function ScheduleCard() {
  const status = useRec((s) => s.state.status);
  const scheduledStartAt = useRec((s) => s.state.scheduledStartAt);
  const scheduledStopAt = useRec((s) => s.state.scheduledStopAt);
  const scheduleStart = useRec((s) => s.scheduleStart);
  const scheduleDurationMin = useRec((s) => s.scheduleDurationMin);
  const setScheduleStart = useRec((s) => s.setScheduleStart);
  const setScheduleDurationMin = useRec((s) => s.setScheduleDurationMin);
  const schedule = useRec((s) => s.schedule);
  const cancelSchedule = useRec((s) => s.cancelSchedule);

  const open = status !== 'idle';
  const recording = status === 'recording';
  const pendingStart = scheduledStartAt != null;
  const pendingStop = scheduledStopAt != null;

  // 1×/s ticken, damit die Countdowns laufen.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!pendingStart && !pendingStop) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [pendingStart, pendingStop]);

  const startIn = pendingStart ? Math.max(0, Math.round((scheduledStartAt! - now) / 1000)) : 0;
  const stopIn = pendingStop ? Math.max(0, Math.round((scheduledStopAt! - now) / 1000)) : 0;

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-extrabold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
          Geplante Aufnahme
        </h2>
        {pendingStart && (
          <Badge tone="warning">Start in {formatClock(startIn)}</Badge>
        )}
        {!pendingStart && recording && pendingStop && (
          <Badge tone="warning">Auto-Stopp in {formatClock(stopIn)}</Badge>
        )}
      </div>

      {!open ? (
        <p className="text-sm text-[var(--muted-foreground)]">
          Erst den Eingang öffnen — dann lässt sich Start- und Stoppzeit planen.
        </p>
      ) : pendingStart ? (
        <div className="flex items-center gap-4">
          <span className="text-sm">
            Geplant für{' '}
            <span className="font-semibold tabular">
              {new Date(scheduledStartAt!).toLocaleString()}
            </span>
            {pendingStop && (
              <>
                {' '}· Stopp{' '}
                <span className="font-semibold tabular">
                  {new Date(scheduledStopAt!).toLocaleTimeString()}
                </span>
              </>
            )}
          </span>
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => void cancelSchedule()}>
            Abbrechen
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-4 items-end">
          <Field label="Startzeit (leer = sofort)">
            <input
              type="datetime-local"
              value={scheduleStart}
              disabled={recording}
              onChange={(e) => setScheduleStart(e.target.value)}
              className="h-10 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-3 text-sm disabled:opacity-50"
            />
          </Field>
          <Field label="Dauer (Min, 0 = manuell)">
            <input
              type="number"
              min={0}
              step={1}
              value={scheduleDurationMin}
              disabled={recording}
              onChange={(e) => setScheduleDurationMin(Number(e.target.value))}
              className="h-10 w-28 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-3 text-sm tabular disabled:opacity-50"
            />
          </Field>
          <Button variant="primary" disabled={recording} onClick={() => void schedule()}>
            Planen
          </Button>
        </div>
      )}

      <p className="text-[11px] text-[var(--muted-foreground)] mt-3">
        Start/Stopp laufen zuverlässig im Hintergrund (auch unbeaufsichtigt). Zielordner, Dateiname
        und „Spuren einzeln" gelten wie oben eingestellt. Ein manueller Stopp hebt den Auto-Stopp auf.
      </p>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10px] uppercase tracking-[0.12em] font-extrabold text-[var(--muted-foreground)]">
        {label}
      </span>
      {children}
    </label>
  );
}
