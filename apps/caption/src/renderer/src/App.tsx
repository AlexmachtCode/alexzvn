import { useCallback, useEffect, useRef, useState } from 'react';
import { useCaption } from '@/store/useCaption';
import { startCapture, listAudioInputs, type Capture } from '@/lib/capture';
import { useCaptionNdiEngine } from '@/lib/ndi-engine';
import type { CaptionConfig, WhisperModelId } from '@shared/types';

const MODELS: { id: WhisperModelId; label: string }[] = [
  { id: 'tiny', label: 'Tiny (schnell)' },
  { id: 'base', label: 'Base' },
  { id: 'small', label: 'Small' },
  { id: 'medium', label: 'Medium' },
  { id: 'large-v3', label: 'Large v3 (genau)' },
];
const LANGS = [
  { id: 'de', label: 'Deutsch' },
  { id: 'en', label: 'Englisch' },
  { id: 'auto', label: 'Auto-Erkennung' },
];
const RES = [
  { id: '1920x1080', label: '1080p', w: 1920, h: 1080 },
  { id: '1280x720', label: '720p', w: 1280, h: 720 },
  { id: '3840x2160', label: '2160p', w: 3840, h: 2160 },
];
const sel = 'rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm text-neutral-100';

// Nur als Platzhalter, bis der echte State (mit config) vom Main geladen ist —
// die Engine-Hooks laufen unbedingt, brauchen aber eine vollständige Config.
const FALLBACK_CFG: CaptionConfig = {
  model: 'base',
  language: 'de',
  maxUtteranceSec: 8,
  silenceMs: 700,
  silenceThreshold: 0.012,
  audioInputDeviceId: '',
  ndiName: 'JM Caption',
  ndiWidth: 1920,
  ndiHeight: 1080,
  ndiFps: 30,
  ndiFontSize: 54,
  ndiLines: 2,
  ndiBand: true,
};

export function App() {
  const { state, level, load, setLevel, setConfig, start, stop, setHold, clear, correctLast, ndiStart, ndiStop } =
    useCaption();
  const captureRef = useRef<Capture | null>(null);
  // Audio-Eingang, mit dem die laufende Aufnahme gestartet wurde — für den
  // Neustart bei Gerätewechsel im Betrieb.
  const activeDeviceRef = useRef<string>('');
  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    void load();
  }, [load]);

  // Audio-Eingänge auflisten (+ auf An-/Abstecken reagieren).
  const refreshDevices = useCallback(() => {
    void listAudioInputs()
      .then(setAudioDevices)
      .catch(() => setAudioDevices([]));
  }, []);
  useEffect(() => {
    refreshDevices();
    const onChange = (): void => refreshDevices();
    navigator.mediaDevices.addEventListener?.('devicechange', onChange);
    return () => navigator.mediaDevices.removeEventListener?.('devicechange', onChange);
  }, [refreshDevices]);

  const running = state?.running ?? false;
  const cfg = state?.config;
  const hold = state?.hold ?? false;
  const ndiActive = state?.status.ndiActive ?? false;

  // NDI-/Render-Engine (zeichnet Untertitel → Vorschau + NDI-Frames). Läuft immer;
  // sendet nur bei aktivem NDI. Hold friert die Ausgabe ein.
  useCaptionNdiEngine(cfg ?? FALLBACK_CFG, state?.lines ?? [], hold, ndiActive, previewRef);

  // Aufnahme-Lebenszyklus an das running-Flag koppeln.
  useEffect(() => {
    const desiredDevice = cfg?.audioInputDeviceId ?? '';
    // Gerätewechsel im laufenden Betrieb → alte Aufnahme verwerfen, damit sie
    // unten mit dem neuen Eingang neu startet.
    if (running && captureRef.current && activeDeviceRef.current !== desiredDevice) {
      captureRef.current.stop();
      captureRef.current = null;
      setLevel(0);
    }
    if (running && !captureRef.current && cfg) {
      let cancelled = false;
      activeDeviceRef.current = desiredDevice;
      startCapture(
        {
          silenceMs: cfg.silenceMs,
          silenceThreshold: cfg.silenceThreshold,
          maxUtteranceSec: cfg.maxUtteranceSec,
          deviceId: cfg.audioInputDeviceId,
          onLevel: (r) => setLevel(r),
        },
        (pcm, sr) => window.jmcaption.pushUtterance(pcm, sr),
      )
        .then((cap) => {
          if (cancelled) cap.stop();
          else {
            captureRef.current = cap;
            setMicError(null);
          }
        })
        .catch((e: unknown) => setMicError(String((e as Error)?.message ?? e)));
      return () => {
        cancelled = true;
      };
    }
    if (!running && captureRef.current) {
      captureRef.current.stop();
      captureRef.current = null;
      setLevel(0);
    }
    return undefined;
  }, [running, cfg, setLevel]);

  // Beim Verlassen Aufnahme sicher stoppen.
  useEffect(() => () => captureRef.current?.stop(), []);

  if (!state) {
    return <div className="grid h-full place-items-center text-neutral-500">Lädt …</div>;
  }

  const c = state.config;
  const lines = state.lines;
  const last = lines.length ? lines[lines.length - 1] : null;
  const levelPct = Math.min(100, Math.round((level / 0.15) * 100));
  const resId = `${c.ndiWidth}x${c.ndiHeight}`;

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-neutral-800 px-4 py-2">
        <span className="font-bold">JM Caption</span>
        <select
          value={c.model}
          onChange={(e) => void setConfig({ model: e.target.value as WhisperModelId })}
          className={sel}
        >
          {MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <select value={c.language} onChange={(e) => void setConfig({ language: e.target.value })} className={sel}>
          {LANGS.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
        <select
          value={c.audioInputDeviceId}
          onChange={(e) => void setConfig({ audioInputDeviceId: e.target.value })}
          className={sel}
          title="Audio-Eingang (Mikrofon)"
        >
          <option value="">System-Standard (Mikrofon)</option>
          {audioDevices.map((d, i) => (
            <option key={d.deviceId || i} value={d.deviceId}>
              {d.label || `Audiogerät ${i + 1}`}
            </option>
          ))}
        </select>
        <button
          onClick={refreshDevices}
          title="Audiogeräte aktualisieren"
          className="rounded border border-neutral-700 px-2 py-1 text-sm text-neutral-300 hover:bg-neutral-800"
        >
          ⟳
        </button>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => void (running ? stop() : start())}
            className="rounded-md px-4 py-1.5 text-sm font-semibold text-[var(--brand-dark)]"
            style={{ background: running ? '#e0533d' : 'var(--brand-yellow)' }}
          >
            {running ? '■ Stopp' : '● Start'}
          </button>
          <button
            onClick={() => void setHold(!state.hold)}
            className={`rounded-md border px-3 py-1.5 text-sm ${
              state.hold ? 'border-yellow-500 text-yellow-300' : 'border-neutral-700 text-neutral-300 hover:bg-neutral-800'
            }`}
          >
            {state.hold ? 'Hold ✓' : 'Hold'}
          </button>
          <button
            onClick={() => void clear()}
            className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800"
          >
            Leeren
          </button>
        </div>
      </header>

      {/* NDI-Leiste */}
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-800 bg-neutral-900/40 px-4 py-2">
        <button
          onClick={() => void (ndiActive ? ndiStop() : ndiStart(c.ndiName))}
          className={`rounded-md border px-3 py-1.5 text-sm font-semibold ${
            ndiActive ? 'border-green-500 bg-green-600/20 text-green-300' : 'border-neutral-700 text-neutral-200 hover:bg-neutral-800'
          }`}
        >
          {ndiActive ? '◉ NDI an' : '○ NDI starten'}
        </button>
        <input
          value={c.ndiName}
          onChange={(e) => void setConfig({ ndiName: e.target.value })}
          placeholder="NDI-Quellname"
          className={`${sel} w-44`}
        />
        <label className="text-xs text-neutral-500">Auflösung</label>
        <select
          value={resId}
          onChange={(e) => {
            const r = RES.find((x) => x.id === e.target.value);
            if (r) void setConfig({ ndiWidth: r.w, ndiHeight: r.h });
          }}
          className={sel}
        >
          {RES.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
        <label className="text-xs text-neutral-500">fps</label>
        <select value={c.ndiFps} onChange={(e) => void setConfig({ ndiFps: Number(e.target.value) })} className={sel}>
          {[25, 30, 50, 60].map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <label className="text-xs text-neutral-500">Schrift</label>
        <input
          type="number"
          min={16}
          max={160}
          value={c.ndiFontSize}
          onChange={(e) => void setConfig({ ndiFontSize: Number(e.target.value) })}
          className={`${sel} w-16`}
        />
        <label className="text-xs text-neutral-500">Zeilen</label>
        <select value={c.ndiLines} onChange={(e) => void setConfig({ ndiLines: Number(e.target.value) })} className={sel}>
          {[1, 2, 3].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-neutral-300">
          <input
            type="checkbox"
            checked={c.ndiBand}
            onChange={(e) => void setConfig({ ndiBand: e.target.checked })}
          />
          Band
        </label>
        {ndiActive && (
          <span className="ml-auto text-xs text-neutral-400">
            {state.status.connections} Empfänger
          </span>
        )}
      </div>

      {/* Warnungen */}
      {!state.whisperAvailable && (
        <div className="bg-yellow-500/10 px-4 py-1.5 text-xs text-yellow-300">
          whisper.cpp ist hier nicht gebündelt — Transkription läuft erst nach dem Office-Build (Binary + Modell).
        </div>
      )}
      {micError && <div className="bg-red-500/10 px-4 py-1.5 text-xs text-red-300">Mikrofon: {micError}</div>}
      {state.error && <div className="bg-red-500/10 px-4 py-1.5 text-xs text-red-300">{state.error}</div>}

      {/* Live-Untertitel (groß) + NDI-Vorschau */}
      <div className="flex flex-1 gap-4 p-6">
        <div className="grid flex-1 place-items-center">
          <div className="w-full max-w-3xl text-center">
            <div className="min-h-[3.5rem] text-3xl font-semibold leading-snug">
              {last ? last.text : <span className="text-neutral-600">— bereit —</span>}
            </div>
          </div>
        </div>
        <div className="w-80 shrink-0">
          <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-neutral-500">
            <span>NDI-Vorschau</span>
            {hold && <span className="text-yellow-400">eingefroren</span>}
          </div>
          {/* Schachbrett zeigt die Transparenz der Quelle. */}
          <div
            className="overflow-hidden rounded-md border border-neutral-800"
            style={{
              backgroundImage:
                'repeating-conic-gradient(#2a2a2a 0% 25%, #1c1c1c 0% 50%)',
              backgroundSize: '16px 16px',
            }}
          >
            <canvas ref={previewRef} width={320} height={180} className="block w-full" />
          </div>
        </div>
      </div>

      {/* Verlauf + Pegel */}
      <div className="border-t border-neutral-800">
        <div className="flex items-center gap-3 px-4 py-1.5">
          <span className="text-[10px] uppercase tracking-wider text-neutral-500">Pegel</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-800">
            <div
              className="h-full rounded-full transition-[width] duration-75"
              style={{ width: `${levelPct}%`, background: levelPct > 80 ? '#e0533d' : 'var(--brand-yellow)' }}
            />
          </div>
          {state.busy && <span className="text-[10px] text-neutral-400">transkribiert …</span>}
          <span className="text-[10px] text-neutral-500">{lines.length} Zeilen</span>
        </div>
        <div className="max-h-44 overflow-y-auto px-4 pb-3">
          {lines
            .slice()
            .reverse()
            .map((l) =>
              editing === l.id ? (
                <input
                  key={l.id}
                  autoFocus
                  defaultValue={l.text}
                  onBlur={(e) => {
                    void correctLast(e.target.value);
                    setEditing(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  }}
                  className="my-0.5 w-full rounded border border-neutral-600 bg-neutral-800 px-2 py-1 text-sm"
                />
              ) : (
                <div
                  key={l.id}
                  onDoubleClick={() => l.id === last?.id && setEditing(l.id)}
                  title={l.id === last?.id ? 'Doppelklick: letzte Zeile korrigieren' : undefined}
                  className="border-b border-neutral-800/50 py-1 text-sm text-neutral-300"
                >
                  {l.text}
                </div>
              ),
            )}
          {lines.length === 0 && (
            <div className="py-3 text-center text-xs text-neutral-600">Noch keine Untertitel.</div>
          )}
        </div>
      </div>
    </div>
  );
}
