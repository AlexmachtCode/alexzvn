import { useEffect, useState } from 'react';
import { cn } from '@jm/ui';
import type { Track } from '@shared/project';
import { useProject } from '@/store/project';
import { engine, type MeterData } from '@/audio/engine';
import { formatDb, formatMeterPeak, formatPan, meterUnitLabel, type MeterUnit } from '@/lib/format';
import { Fader, Meter, StripToggle, meterPct } from './strip-parts';

// Gewählte Pegel-Einheit (dBFS/dBu) — persistiert, damit sie Sessions übersteht.
const UNIT_KEY = 'jmdaw.meterUnit';
function loadUnit(): MeterUnit {
  try {
    return localStorage.getItem(UNIT_KEY) === 'dbu' ? 'dbu' : 'dbfs';
  } catch {
    return 'dbfs';
  }
}

export function Mixer() {
  const tracks = useProject((s) => s.present.tracks);
  const masterGain = useProject((s) => s.present.master.gain);
  const activeTrackId = useProject((s) => s.activeTrackId);
  const setActiveTrack = useProject((s) => s.setActiveTrack);
  const addBus = useProject((s) => s.addBus);
  const removeBus = useProject((s) => s.removeBus);
  const [meters, setMeters] = useState<MeterData>({ master: 0, tracks: {} });
  const [unit, setUnit] = useState<MeterUnit>(loadUnit);
  const audioTracks = tracks.filter((t) => t.kind === 'audio');
  const buses = tracks.filter((t) => t.kind === 'bus');

  const toggleUnit = (): void => {
    const next: MeterUnit = unit === 'dbfs' ? 'dbu' : 'dbfs';
    setUnit(next);
    try {
      localStorage.setItem(UNIT_KEY, next);
    } catch {
      // localStorage nicht verfügbar → nur In-Memory
    }
  };

  useEffect(() => {
    let raf = 0;
    let last = 0;
    const loop = (t: number): void => {
      if (t - last > 33) {
        setMeters(engine.meters());
        last = t;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="h-full flex flex-col bg-[var(--card)]/30 border-l border-[var(--border)]/60">
      <div className="px-3 py-2.5 border-b border-[var(--border)]/50 flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[0.14em] font-bold text-[var(--muted-foreground)]">
          Mixer
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={toggleUnit}
            title="Pegel-Einheit umschalten (dBFS ↔ dBu, EBU R68: 0 dBFS = +18 dBu)"
            className={cn(
              'h-6 px-2 rounded-[var(--radius)] text-[10px] font-bold border border-[var(--border)] tabular-nums',
              'text-[var(--foreground)]/85 hover:bg-[var(--highlight)]',
            )}
          >
            {meterUnitLabel(unit)}
          </button>
          <button
            type="button"
            onClick={addBus}
            title="AUX-Bus hinzufügen (für Sends, z. B. Reverb-Return)"
            className={cn(
              'h-6 px-2 rounded-[var(--radius)] text-[10px] font-bold border border-[var(--border)]',
              'text-[var(--foreground)]/85 hover:bg-[var(--highlight)]',
            )}
          >
            + Bus
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-x-auto flex gap-2 p-3">
        {audioTracks.map((track) => (
          <ChannelStrip
            key={track.id}
            track={track}
            meter={meters.tracks[track.id] ?? 0}
            unit={unit}
            active={track.id === activeTrackId}
            onSelect={() => setActiveTrack(track.id)}
          />
        ))}
        {buses.length > 0 && <div className="w-px shrink-0 bg-[var(--border)]/60 mx-1" />}
        {buses.map((track) => (
          <ChannelStrip
            key={track.id}
            track={track}
            meter={meters.tracks[track.id] ?? 0}
            unit={unit}
            active={track.id === activeTrackId}
            onSelect={() => setActiveTrack(track.id)}
            isBus
            onRemove={() => removeBus(track.id)}
          />
        ))}
        <MasterStrip gain={masterGain} meter={meters.master} unit={unit} />
      </div>
    </div>
  );
}

function ChannelStrip({
  track,
  meter,
  unit,
  active,
  onSelect,
  isBus,
  onRemove,
}: {
  track: Track;
  meter: number;
  unit: MeterUnit;
  active: boolean;
  onSelect: () => void;
  isBus?: boolean;
  onRemove?: () => void;
}) {
  const beginDrag = useProject((s) => s.beginDrag);
  const dragUpdate = useProject((s) => s.dragUpdate);
  const endDrag = useProject((s) => s.endDrag);
  const toggleMute = useProject((s) => s.toggleMute);
  const toggleSolo = useProject((s) => s.toggleSolo);
  const fxCount = track.effects?.length ?? 0;

  const setGain = (v: number): void =>
    dragUpdate((d) => {
      const t = d.tracks.find((tt) => tt.id === track.id);
      if (t) t.gain = v;
    });
  const setPan = (v: number): void =>
    dragUpdate((d) => {
      const t = d.tracks.find((tt) => tt.id === track.id);
      if (t) t.pan = v;
    });

  return (
    <div
      onPointerDown={onSelect}
      title="Klick: Kanal für Effekte/Sends wählen"
      className={cn(
        'w-[72px] shrink-0 h-full flex flex-col items-center gap-1.5 overflow-hidden rounded-[var(--radius)] border p-2 cursor-pointer',
        isBus ? 'bg-violet-500/5' : 'bg-[var(--background)]/40',
        active
          ? 'border-[var(--primary)]/70 ring-1 ring-[var(--primary)]/40'
          : isBus
            ? 'border-violet-400/40'
            : 'border-[var(--border)]/50',
      )}
    >
      <div className="shrink-0 w-full flex items-center gap-1">
        {isBus && <span className="text-[7px] font-extrabold uppercase text-violet-300 tracking-wide">Bus</span>}
        <span className="text-[10px] font-bold truncate flex-1 text-center" title={track.name}>
          {track.name}
        </span>
        {fxCount > 0 && (
          <span className="text-[8px] font-bold text-[var(--primary)]" title={`${fxCount} Effekt(e)`}>
            ƒx{fxCount}
          </span>
        )}
        {isBus && onRemove && (
          <button
            type="button"
            title="Bus entfernen"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onRemove}
            className="text-[9px] text-[var(--muted-foreground)] hover:text-[var(--destructive)]"
          >
            ✕
          </button>
        )}
      </div>

      <div className="shrink-0 w-full flex flex-col items-center">
        <input
          type="range"
          min={-1}
          max={1}
          step={0.02}
          value={track.pan}
          onPointerDown={beginDrag}
          onPointerUp={endDrag}
          onDoubleClick={() => {
            beginDrag();
            setPan(0);
            endDrag();
          }}
          onChange={(e) => setPan(Number(e.target.value))}
          title={`Pan ${formatPan(track.pan)} (Doppelklick: Mitte)`}
          className="w-full"
        />
        <span className="text-[9px] tabular-nums text-[var(--muted-foreground)] leading-tight">
          {formatPan(track.pan)}
        </span>
      </div>

      <div className="flex-1 min-h-0 flex items-stretch justify-center gap-1.5">
        <Fader value={track.gain} onBegin={beginDrag} onEnd={endDrag} onChange={setGain} />
        <Meter pct={meterPct(meter)} />
      </div>

      <span
        className="shrink-0 text-[8px] tabular-nums text-[var(--muted-foreground)]/70 leading-none"
        title={`Spitzenpegel (${meterUnitLabel(unit)})`}
      >
        {formatMeterPeak(meter, unit)} {meterUnitLabel(unit)}
      </span>
      <span className="shrink-0 text-[9px] tabular-nums text-[var(--muted-foreground)]" title="Fader-Pegel">
        {formatDb(track.gain)} dB
      </span>

      <div className="shrink-0 flex items-center gap-1">
        <StripToggle active={track.muted} label="M" tone="mute" onClick={() => toggleMute(track.id)} />
        {!isBus && <StripToggle active={track.solo} label="S" tone="solo" onClick={() => toggleSolo(track.id)} />}
      </div>
    </div>
  );
}

function MasterStrip({ gain, meter, unit }: { gain: number; meter: number; unit: MeterUnit }) {
  const beginDrag = useProject((s) => s.beginDrag);
  const dragUpdate = useProject((s) => s.dragUpdate);
  const endDrag = useProject((s) => s.endDrag);
  const setGain = (v: number): void =>
    dragUpdate((d) => {
      d.master.gain = v;
    });

  return (
    <div className="w-[80px] shrink-0 h-full flex flex-col items-center gap-1.5 overflow-hidden rounded-[var(--radius)] border border-[var(--primary)]/40 bg-[var(--primary)]/5 p-2 ml-1">
      <span className="shrink-0 text-[10px] font-extrabold uppercase tracking-wide text-[var(--primary)]">Master</span>
      {/* Platzhalter, damit der Master-Fader auf Höhe der Kanal-Fader beginnt (Pan-Reihe). */}
      <div className="shrink-0 h-[18px]" />
      <div className="flex-1 min-h-0 flex items-stretch justify-center gap-1.5">
        <Fader value={gain} onBegin={beginDrag} onEnd={endDrag} onChange={setGain} />
        <Meter pct={meterPct(meter)} />
      </div>
      <span
        className="shrink-0 text-[8px] tabular-nums text-[var(--muted-foreground)]/70 leading-none"
        title={`Spitzenpegel (${meterUnitLabel(unit)})`}
      >
        {formatMeterPeak(meter, unit)} {meterUnitLabel(unit)}
      </span>
      <span className="shrink-0 text-[9px] tabular-nums text-[var(--muted-foreground)]" title="Fader-Pegel">
        {formatDb(gain)} dB
      </span>
    </div>
  );
}

