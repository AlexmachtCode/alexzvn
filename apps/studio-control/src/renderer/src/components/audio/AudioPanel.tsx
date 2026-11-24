// Audio · Mischpult (UX Welle 2b, Studio-Control d2; B16, Ruling Task 18): Pille über StatusPill aus @jm/ui mit geraetPille;
// Fader und Mute bleiben normale Bedienelemente. Der Gerätezustand gilt nur bei verbundenem Server (gemeldet).
import { useMemo, useState } from 'react';
import { Card, Button, StatusPill, cn } from '@jm/ui';
import { Input } from '@/components/ui/Input';
import { Headline } from '@/components/ui/Headline';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { gemeldet, geraetPille, type OberflaechenStand } from '@/lib/oberflaeche';
import { useApp } from '@/store/app';
import { useSession } from '@/store/session';
import { emitWithAck, apiFetch } from '@/sync/client';
import { EVENTS } from '@shared/protocol';
import {
  AUDIO_TRANSPORTS,
  AUDIO_TRANSPORT_LABELS,
  CONSOLE_PROFILES,
  CONSOLE_TYPES,
  consoleProfile,
  defaultPortFor,
  FADER_MAX_DB,
  FADER_MIN_DB,
  type AudioConsoleConfig,
  type AudioTransport,
  type ConsoleType,
} from '@shared/audio';
import { canDo } from '@shared/roles';

export function AudioPanel({ stand }: { stand: OberflaechenStand }) {
  const consoles = useApp((s) => s.audioConsoles);
  const statuses = useApp((s) => s.audioStatuses);
  const patchChannelLocal = useApp((s) => s.patchChannelLocal);
  const role = useSession((s) => s.user?.role);
  const token = useSession((s) => s.token);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);

  const current = useMemo(
    () => consoles.find((c) => c.id === selectedId) ?? consoles[0],
    [consoles, selectedId],
  );
  // Nur bei verbundenem Server gemessen (sonst Pille unbekannt, Fader und Mute gesperrt).
  const status = current ? gemeldet(stand, statuses[current.id]) : undefined;

  const canExec = role ? canDo(role, 'audio:exec') : false;
  const canManage = role ? canDo(role, 'inventory:write') : false;
  const live = status?.state === 'connected';
  const disabled = !canExec || !live;

  function setFader(ch: number, db: number): void {
    if (!current) return;
    patchChannelLocal(current.id, ch, { db });
    void emitWithAck(EVENTS.AUDIO_EXEC, {
      consoleId: current.id,
      action: { kind: 'fader', channel: ch, db },
    }).catch(() => {});
  }
  function setMute(ch: number, on: boolean): void {
    if (!current) return;
    patchChannelLocal(current.id, ch, { mute: on });
    void emitWithAck(EVENTS.AUDIO_EXEC, {
      consoleId: current.id,
      action: { kind: 'mute', channel: ch, on },
    }).catch(() => {});
  }

  async function saveConsole(cfg: AudioConsoleConfig): Promise<void> {
    await apiFetch('/api/audio', { method: 'POST', token, body: JSON.stringify(cfg) });
    setAdding(false);
    setEditing(false);
    setSelectedId(cfg.id);
  }
  async function deleteConsole(id: string): Promise<void> {
    if (!confirm('Pult-Verbindung wirklich entfernen?')) return;
    await apiFetch(`/api/audio/${encodeURIComponent(id)}`, { method: 'DELETE', token });
    setEditing(false);
    setSelectedId(null);
  }

  return (
    <Card data-panel="audio" className="p-6">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <SectionHeader>Audio · Mischpult</SectionHeader>
          <Headline variant="section" className="mt-2">
            Pulte
          </Headline>
        </div>
        <div className="flex items-center gap-3">
          {current ? (
            <>
              <select
                value={current.id}
                onChange={(e) => setSelectedId(e.target.value)}
                className="h-10 px-3 rounded-[var(--radius)] bg-[var(--input)] border border-[var(--border)] text-sm"
              >
                {consoles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {AUDIO_TRANSPORT_LABELS[c.transport]}
                  </option>
                ))}
              </select>
              <StatusPill {...geraetPille(status)} />
              {canManage && (
                <Button size="sm" variant="ghost" onClick={() => setEditing((v) => !v)}>
                  {editing ? 'Schließen' : 'Bearbeiten'}
                </Button>
              )}
            </>
          ) : null}
        </div>
      </div>

      {current && status?.state === 'down' && status.lastError && (
        <div className="mb-4 rounded-[var(--radius)] border border-[var(--destructive)]/50 bg-[var(--destructive)]/10 px-3 py-2 text-xs">
          <span className="font-extrabold uppercase tracking-wider text-[var(--destructive)]">
            Pult nicht erreichbar:
          </span>{' '}
          <span className="text-[var(--foreground)]">{status.lastError}</span>
          <span className="text-[var(--muted-foreground)]">
            {' '}
            — <code className="tabular-nums">{current.host}:{current.port}</code> ({AUDIO_TRANSPORT_LABELS[current.transport]}).
          </span>
        </div>
      )}

      {current && current.transport === 'dante' && (
        <div className="mb-4 rounded-[var(--radius)] border border-[var(--border)]/60 bg-[var(--card)]/40 px-3 py-2 text-[11px] text-[var(--muted-foreground)]">
          Hinweis: Dante transportiert Audio, nicht die Pult-Steuerung. Diese Verbindung nutzt das
          native Protokoll über die Dante-Netz-IP des Pults.
        </div>
      )}

      {current && editing && canManage && (
        <div className="mb-6 rounded-[var(--radius)] border border-[var(--border)]/60 bg-[var(--card)]/40 p-4">
          <ConsoleForm
            initial={current}
            onSubmit={saveConsole}
            onCancel={() => setEditing(false)}
            onDelete={() => deleteConsole(current.id)}
          />
        </div>
      )}

      {!current ? (
        <div className="flex flex-col gap-3 items-start">
          <p className="text-sm text-[var(--muted-foreground)]">
            Noch kein Pult verbunden. Yamaha QL1 (RCP/TCP) oder Allen &amp; Heath SQ5 (MIDI/TCP)
            hinzufügen — Transport TCP, OSC-Bridge oder Dante-Netz.
          </p>
          {canManage ? (
            adding ? (
              <ConsoleForm onSubmit={saveConsole} onCancel={() => setAdding(false)} />
            ) : (
              <Button onClick={() => setAdding(true)}>Pult hinzufügen</Button>
            )
          ) : (
            <p className="text-xs text-[var(--muted-foreground)]">
              Frage einen Admin / Operator, ein Pult im Setup anzulegen.
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 max-h-[60vh] overflow-y-auto pr-1">
            {Array.from({ length: current.channelCount }, (_, i) => i + 1).map((ch) => {
              const st = current.channels.find((c) => c.ch === ch);
              return (
                <ChannelStrip
                  key={ch}
                  ch={ch}
                  db={st?.db ?? 0}
                  muted={st?.mute ?? false}
                  disabled={disabled}
                  onFader={(db) => setFader(ch, db)}
                  onMute={(on) => setMute(ch, on)}
                />
              );
            })}
          </div>

          {canManage && (
            <div className="mt-6 pt-4 border-t border-[var(--border)]/40 flex gap-2">
              {adding ? (
                <ConsoleForm onSubmit={saveConsole} onCancel={() => setAdding(false)} />
              ) : (
                <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
                  Weiteres Pult
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function ChannelStrip({
  ch,
  db,
  muted,
  disabled,
  onFader,
  onMute,
}: {
  ch: number;
  db: number;
  muted: boolean;
  disabled: boolean;
  onFader: (db: number) => void;
  onMute: (on: boolean) => void;
}) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius)] border border-[var(--border)]/50 bg-[var(--card)]/40 p-2.5 flex flex-col gap-2',
        muted && 'border-[var(--destructive)]/50',
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-extrabold tabular-nums">CH {ch}</span>
        <span className="text-[10px] tabular-nums text-[var(--muted-foreground)]">
          {db <= FADER_MIN_DB ? `${FADER_MIN_DB}` : db.toFixed(1)} dB
        </span>
      </div>
      <input
        type="range"
        min={FADER_MIN_DB}
        max={FADER_MAX_DB}
        step={0.5}
        value={db}
        disabled={disabled}
        onChange={(e) => onFader(Number(e.target.value))}
        className="w-full accent-[var(--primary)] disabled:opacity-40"
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => onMute(!muted)}
        className={cn(
          'h-7 rounded-[var(--radius-sm)] text-[10px] uppercase tracking-wider font-extrabold transition-colors',
          muted
            ? 'bg-[var(--destructive)] text-[var(--destructive-foreground)]'
            : 'bg-[var(--input)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
          'disabled:opacity-40',
        )}
      >
        {muted ? 'Muted' : 'Mute'}
      </button>
    </div>
  );
}

function ConsoleForm({
  initial,
  onSubmit,
  onCancel,
  onDelete,
}: {
  initial?: AudioConsoleConfig;
  onSubmit: (cfg: AudioConsoleConfig) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? 'Yamaha QL1');
  const [type, setType] = useState<ConsoleType>(initial?.type ?? 'yamaha-ql');
  const [transport, setTransport] = useState<AudioTransport>(initial?.transport ?? 'tcp');
  const [host, setHost] = useState(initial?.host ?? '');
  const [port, setPort] = useState(String(initial?.port ?? defaultPortFor('yamaha-ql', 'tcp')));
  const [channelCount, setChannelCount] = useState(
    String(initial?.channelCount ?? consoleProfile('yamaha-ql').inputCount),
  );
  const [busy, setBusy] = useState(false);

  // When type/transport change, follow the sensible default port + channel count
  // (only if the user hasn't diverged from a prior default).
  function onType(t: ConsoleType): void {
    setType(t);
    setName((n) => (CONSOLE_PROFILES.some((p) => p.name === n) ? consoleProfile(t).name : n));
    setPort(String(defaultPortFor(t, transport)));
    setChannelCount(String(consoleProfile(t).inputCount));
  }
  function onTransport(t: AudioTransport): void {
    setTransport(t);
    setPort(String(defaultPortFor(type, t)));
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const portNum = Number(port);
        const chNum = Number(channelCount);
        if (!host || !name || !Number.isInteger(portNum) || portNum <= 0 || chNum < 1) return;
        setBusy(true);
        try {
          await onSubmit({
            id: initial?.id ?? `audio-${Date.now().toString(36)}`,
            name,
            type,
            transport,
            host,
            port: portNum,
            channelCount: Math.min(64, chNum),
            channels: initial?.channels ?? [],
          });
        } finally {
          setBusy(false);
        }
      }}
      className="flex flex-col gap-3"
    >
      <div className="flex items-end gap-2 flex-wrap">
        <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] flex-1 min-w-[140px]">
          Name
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
          Pult
          <select
            value={type}
            onChange={(e) => onType(e.target.value as ConsoleType)}
            className="h-10 px-3 rounded-[var(--radius)] bg-[var(--input)] border border-[var(--border)] text-sm"
          >
            {CONSOLE_TYPES.map((t) => (
              <option key={t} value={t}>
                {consoleProfile(t).name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
          Transport
          <select
            value={transport}
            onChange={(e) => onTransport(e.target.value as AudioTransport)}
            className="h-10 px-3 rounded-[var(--radius)] bg-[var(--input)] border border-[var(--border)] text-sm"
          >
            {AUDIO_TRANSPORTS.map((t) => (
              <option key={t} value={t}>
                {AUDIO_TRANSPORT_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex items-end gap-2 flex-wrap">
        <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] flex-1 min-w-[140px]">
          Host / IP
          <Input value={host} onChange={(e) => setHost(e.target.value)} placeholder="192.168.30.20" required />
        </label>
        <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
          Port
          <Input type="number" value={port} onChange={(e) => setPort(e.target.value)} className="w-24" required />
        </label>
        <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
          Kanäle
          <Input type="number" value={channelCount} onChange={(e) => setChannelCount(e.target.value)} className="w-20" />
        </label>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>
          Speichern
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Abbrechen
        </Button>
        {onDelete && (
          <Button type="button" variant="destructive" onClick={onDelete}>
            Entfernen
          </Button>
        )}
      </div>
    </form>
  );
}
