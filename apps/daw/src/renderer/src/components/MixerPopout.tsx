import { useEffect, useRef, useState } from 'react';
import { cn } from '@jm/ui';
import type { MixerCommand, MixerSnapshot, MixerStripSnapshot } from '@shared/ipc-types';
import { Fader, Meter, StripToggle, meterPct } from './strip-parts';
import { formatDb, formatMeterPeak, formatPan, meterUnitLabel, type MeterUnit } from '@/lib/format';

// Schlankes Mixer-Fenster (#95): rendert aus den Momentaufnahmen des Host-
// Fensters (kein eigener Store/keine Engine) und schickt Steuerbefehle zurück.
// Teilt sich die Pegel-Einheit (localStorage) und die Bausteine mit dem Mixer.

const UNIT_KEY = 'jmdaw.meterUnit';
function loadUnit(): MeterUnit {
  try {
    return localStorage.getItem(UNIT_KEY) === 'dbu' ? 'dbu' : 'dbfs';
  } catch {
    return 'dbfs';
  }
}

function send(cmd: MixerCommand): void {
  window.jmdaw.mixerWin.sendCommand(cmd);
}

export function MixerPopout(): React.JSX.Element {
  const [snap, setSnap] = useState<MixerSnapshot | null>(null);
  const [unit, setUnit] = useState<MeterUnit>(loadUnit);

  useEffect(() => window.jmdaw.mixerWin.onSnapshot(setSnap), []);

  const toggleUnit = (): void => {
    const next: MeterUnit = unit === 'dbfs' ? 'dbu' : 'dbfs';
    setUnit(next);
    try {
      localStorage.setItem(UNIT_KEY, next);
    } catch {
      /* nur In-Memory */
    }
  };

  const audio = snap?.strips.filter((s) => s.kind === 'audio') ?? [];
  const buses = snap?.strips.filter((s) => s.kind === 'bus') ?? [];

  return (
    <div className="h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)]">
      <div className="shrink-0 px-3 py-2.5 border-b border-[var(--border)]/50 flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[0.14em] font-bold text-[var(--muted-foreground)]">
          Mixer
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={toggleUnit}
            title="Pegel-Einheit umschalten (dBFS ↔ dBu, EBU R68: 0 dBFS = +18 dBu)"
            className="h-6 px-2 rounded-[var(--radius)] text-[10px] font-bold border border-[var(--border)] tabular-nums text-[var(--foreground)]/85 hover:bg-[var(--highlight)]"
          >
            {meterUnitLabel(unit)}
          </button>
          <button
            type="button"
            onClick={() => send({ kind: 'addBus' })}
            title="AUX-Bus hinzufügen"
            className="h-6 px-2 rounded-[var(--radius)] text-[10px] font-bold border border-[var(--border)] text-[var(--foreground)]/85 hover:bg-[var(--highlight)]"
          >
            + Bus
          </button>
        </div>
      </div>

      {!snap ? (
        <div className="flex-1 grid place-items-center text-[var(--muted-foreground)] text-sm">
          Verbinde mit dem Hauptfenster…
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-x-auto flex gap-2 p-3">
          {audio.map((s) => (
            <PopStrip key={s.id} s={s} active={s.id === snap.activeTrackId} unit={unit} />
          ))}
          {buses.length > 0 && <div className="w-px shrink-0 bg-[var(--border)]/60 mx-1" />}
          {buses.map((s) => (
            <PopStrip key={s.id} s={s} active={s.id === snap.activeTrackId} unit={unit} isBus />
          ))}
          <PopMaster gain={snap.master.gain} meter={snap.master.meter} unit={unit} />
        </div>
      )}
    </div>
  );
}

function PopStrip({
  s,
  active,
  unit,
  isBus,
}: {
  s: MixerStripSnapshot;
  active: boolean;
  unit: MeterUnit;
  isBus?: boolean;
}): React.JSX.Element {
  // Lokale, optimistische Fader-/Pan-Werte während des Ziehens (der Snapshot-
  // Rücklauf hat Latenz). Außerhalb des Drags folgen sie dem Snapshot.
  const draggingGain = useRef(false);
  const draggingPan = useRef(false);
  const [gain, setGain] = useState(s.gain);
  const [pan, setPan] = useState(s.pan);
  useEffect(() => {
    if (!draggingGain.current) setGain(s.gain);
  }, [s.gain]);
  useEffect(() => {
    if (!draggingPan.current) setPan(s.pan);
  }, [s.pan]);

  return (
    <div
      onPointerDown={() => send({ kind: 'select', id: s.id })}
      title="Klick: Kanal wählen"
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
        <span className="text-[10px] font-bold truncate flex-1 text-center" title={s.name}>
          {s.name}
        </span>
        {s.fx > 0 && (
          <span className="text-[8px] font-bold text-[var(--primary)]" title={`${s.fx} Effekt(e)`}>
            ƒx{s.fx}
          </span>
        )}
        {isBus && (
          <button
            type="button"
            title="Bus entfernen"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => send({ kind: 'removeBus', id: s.id })}
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
          value={pan}
          onPointerDown={() => {
            draggingPan.current = true;
            send({ kind: 'pan', id: s.id, value: pan, phase: 'start' });
          }}
          onPointerUp={() => {
            draggingPan.current = false;
            send({ kind: 'pan', id: s.id, value: pan, phase: 'end' });
          }}
          onDoubleClick={() => {
            send({ kind: 'pan', id: s.id, value: 0, phase: 'start' });
            send({ kind: 'pan', id: s.id, value: 0, phase: 'move' });
            send({ kind: 'pan', id: s.id, value: 0, phase: 'end' });
            setPan(0);
          }}
          onChange={(e) => {
            const v = Number(e.target.value);
            setPan(v);
            send({ kind: 'pan', id: s.id, value: v, phase: 'move' });
          }}
          title={`Pan ${formatPan(pan)} (Doppelklick: Mitte)`}
          className="w-full"
        />
        <span className="text-[9px] tabular-nums text-[var(--muted-foreground)] leading-tight">{formatPan(pan)}</span>
      </div>

      <div className="flex-1 min-h-0 flex items-stretch justify-center gap-1.5">
        <Fader
          value={gain}
          onBegin={() => {
            draggingGain.current = true;
            send({ kind: 'gain', id: s.id, value: gain, phase: 'start' });
          }}
          onEnd={() => {
            draggingGain.current = false;
            send({ kind: 'gain', id: s.id, value: gain, phase: 'end' });
          }}
          onChange={(v) => {
            setGain(v);
            send({ kind: 'gain', id: s.id, value: v, phase: 'move' });
          }}
        />
        <Meter pct={meterPct(s.meter)} />
      </div>

      <span
        className="shrink-0 text-[8px] tabular-nums text-[var(--muted-foreground)]/70 leading-none"
        title={`Spitzenpegel (${meterUnitLabel(unit)})`}
      >
        {formatMeterPeak(s.meter, unit)} {meterUnitLabel(unit)}
      </span>
      <span className="shrink-0 text-[9px] tabular-nums text-[var(--muted-foreground)]" title="Fader-Pegel">
        {formatDb(gain)} dB
      </span>

      <div className="shrink-0 flex items-center gap-1">
        <StripToggle active={s.muted} label="M" tone="mute" onClick={() => send({ kind: 'mute', id: s.id })} />
        {!isBus && <StripToggle active={s.solo} label="S" tone="solo" onClick={() => send({ kind: 'solo', id: s.id })} />}
      </div>
    </div>
  );
}

function PopMaster({
  gain,
  meter,
  unit,
}: {
  gain: number;
  meter: number;
  unit: MeterUnit;
}): React.JSX.Element {
  const dragging = useRef(false);
  const [g, setG] = useState(gain);
  useEffect(() => {
    if (!dragging.current) setG(gain);
  }, [gain]);

  return (
    <div className="w-[80px] shrink-0 h-full flex flex-col items-center gap-1.5 overflow-hidden rounded-[var(--radius)] border border-[var(--primary)]/40 bg-[var(--primary)]/5 p-2 ml-1">
      <span className="shrink-0 text-[10px] font-extrabold uppercase tracking-wide text-[var(--primary)]">Master</span>
      <div className="shrink-0 h-[18px]" />
      <div className="flex-1 min-h-0 flex items-stretch justify-center gap-1.5">
        <Fader
          value={g}
          onBegin={() => {
            dragging.current = true;
            send({ kind: 'gain', id: 'master', value: g, phase: 'start' });
          }}
          onEnd={() => {
            dragging.current = false;
            send({ kind: 'gain', id: 'master', value: g, phase: 'end' });
          }}
          onChange={(v) => {
            setG(v);
            send({ kind: 'gain', id: 'master', value: v, phase: 'move' });
          }}
        />
        <Meter pct={meterPct(meter)} />
      </div>
      <span
        className="shrink-0 text-[8px] tabular-nums text-[var(--muted-foreground)]/70 leading-none"
        title={`Spitzenpegel (${meterUnitLabel(unit)})`}
      >
        {formatMeterPeak(meter, unit)} {meterUnitLabel(unit)}
      </span>
      <span className="shrink-0 text-[9px] tabular-nums text-[var(--muted-foreground)]" title="Fader-Pegel">
        {formatDb(g)} dB
      </span>
    </div>
  );
}
